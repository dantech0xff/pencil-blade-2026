import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  validateChapterDocument,
  validateChapterEntry,
  validateChapterLocalePair,
  validateChapters,
} from '../scripts/case-study-validation/chapters.mjs';

const repositoryRoot = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'reference/case-study-publication-manifest.json'), 'utf8'),
);
const canonicalClaims = readFileSync(
  resolve(repositoryRoot, 'forensics/claims.jsonl'),
  'utf8',
)
  .split(/\r?\n/u)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

function read(path) {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

function splitMdx(path) {
  const source = read(path);
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/u.exec(source);
  assert.ok(match, `${path} must have YAML frontmatter`);
  return { frontmatter: match[1], body: match[2] };
}

function scalar(frontmatter, field) {
  const match = new RegExp(`^${field}:\\s*(.+)$`, 'mu').exec(frontmatter);
  assert.ok(match, `missing ${field}`);
  const raw = match[1].trim().replace(/^"|"$/gu, '');
  if (raw === 'null') return null;
  if (/^\d+$/u.test(raw)) return Number(raw);
  return raw;
}

function array(frontmatter, field) {
  const match = new RegExp(
    `^${field}:\\s*\\n((?:  - .+(?:\\n|$))*)`,
    'mu',
  ).exec(frontmatter);
  if (!match) {
    const inline = new RegExp(`^${field}:\\s*\\[([^\\]]*)\\]$`, 'mu')
      .exec(frontmatter);
    assert.ok(inline, `missing ${field}`);
    return inline[1].trim().length === 0
      ? []
      : inline[1].split(',').map((value) => value.trim());
  }
  return [...match[1].matchAll(/^  - (.+)$/gmu)]
    .map((entry) => entry[1].trim().replace(/^"|"$/gu, ''));
}

function chapterRecord(locale) {
  const { frontmatter, body } = splitMdx(
    `site/src/content/chapters/${locale}/forensics.mdx`,
  );
  return {
    id: scalar(frontmatter, 'id'),
    locale: scalar(frontmatter, 'locale'),
    order: scalar(frontmatter, 'order'),
    chapterKind: scalar(frontmatter, 'chapterKind'),
    evidenceRefs: array(frontmatter, 'evidenceRefs'),
    mediaRefs: array(frontmatter, 'mediaRefs'),
    nextId: scalar(frontmatter, 'nextId'),
    body,
  };
}

const records = ['en', 'vi'].map(chapterRecord);
const validationContext = {
  canonicalClaims,
  publicationManifest: manifest,
};

test('the retained bilingual Forensics chapter validates against canonical evidence', () => {
  for (const [index, record] of records.entries()) {
    assert.deepEqual(
      validateChapterEntry(record, validationContext, `$.chapters[${index}]`),
      [],
    );
    assert.deepEqual(
      validateChapterDocument(record.body, {
        locale: record.locale,
        path: `$.chapters[${index}].body`,
      }),
      [],
    );
    assert.equal(record.chapterKind, 'forensics');
    assert.equal(record.nextId, null);
  }

  assert.deepEqual(validateChapterLocalePair(records[0], records[1]), []);
  assert.deepEqual(
    validateChapters({
      ...validationContext,
      entries: records.map((data) => ({ collection: 'chapters', data })),
    }),
    [],
  );
});

test('Forensics technical denominators and limits remain aligned in both locales', () => {
  for (const locale of ['en', 'vi']) {
    const source = read(`site/src/content/chapters/${locale}/forensics.mdx`);
    for (const token of ['713', '553', '684', '91', '862', '784', '59', '32', '10/10']) {
      assert.match(source, new RegExp(token.replace('/', '\\/'), 'u'));
    }
    assert.match(source, /original runtime|runtime gốc/iu);
  }
});

test('the retained evidence diagram and native trace keep static accessible fallbacks', () => {
  const diagramPath = 'site/src/assets/diagrams/evidence-pipeline.svg';
  const diagram = read(diagramPath);
  assert.match(diagram, /^<svg\b/u);
  assert.doesNotMatch(
    diagram,
    /<script|foreignObject|on\w+\s*=|(?:href|src)\s*=\s*["']https?:\/\//iu,
  );
  assert.ok(statSync(resolve(repositoryRoot, diagramPath)).size < 80_000);

  const trace = read('site/src/components/forensics/native-contract-trace.astro');
  assert.match(trace, /role="tablist"/u);
  assert.match(trace, /<details open>/u);
  assert.match(trace, /<table>/u);
  assert.match(trace, /data-trace-(?:replay|stop|show-all)/u);
});

test('chapter validation fails closed on overclaims, private paths, and locale drift', () => {
  const rhythm = [
    'Question',
    'Artifact',
    'Method',
    'Contract',
    'Proof',
    'Limit',
    'Next step',
  ].join('\n');
  for (const [source, expectedCode] of [
    [`${rhythm}\nWe observed the original runtime.`, 'ORIGINAL_RUNTIME_OVERCLAIM'],
    [`${rhythm}\nWe recovered original C++ source.`, 'ORIGINAL_SOURCE_OVERCLAIM'],
    [`${rhythm}\nfile:///Users/reviewer/private.txt`, 'CHAPTER_PRIVATE_PATH'],
    [`${rhythm}\n<a href="payload.apk">download</a>`, 'CHAPTER_DENIED_ARTIFACT_LINK'],
  ]) {
    assert.ok(
      validateChapterDocument(source).some((entry) => entry.code === expectedCode),
      `${expectedCode} must be reported`,
    );
  }

  assert.ok(
    validateChapterLocalePair(records[0], {
      ...records[1],
      evidenceRefs: records[1].evidenceRefs.slice(1),
    }).some((entry) => entry.code === 'CHAPTER_LOCALE_DRIFT'),
  );
});

test('the chapter route and page entry points expose only bilingual Forensics', () => {
  const routeFragment = read('site/src/data/route-fragments/chapters.ts');
  assert.match(routeFragment, /\/forensics\//u);
  assert.match(routeFragment, /\/vi\/forensics\//u);
  assert.doesNotMatch(routeFragment, /story|reconstruction/u);

  for (const [path, id] of [
    ['site/src/pages/forensics/index.astro', 'forensics.en'],
    ['site/src/pages/vi/forensics/index.astro', 'forensics.vi'],
  ]) {
    const page = read(path);
    assert.match(page, /ChapterPage/u);
    assert.match(page, new RegExp(id.replace('.', '\\.'), 'u'));
  }
});
