import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  readFileSync,
  statSync,
} from 'node:fs';
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
  return { frontmatter: match[1], body: match[2], source };
}

function scalar(frontmatter, field) {
  const match = new RegExp(`^${field}:\\s*(.+)$`, 'mu').exec(frontmatter);
  assert.ok(match, `missing ${field}`);
  const raw = match[1].trim().replace(/^"|"$/gu, '');
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
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

function chapterRecord(path) {
  const { frontmatter, body } = splitMdx(path);
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

const chapterKinds = ['story', 'forensics', 'reconstruction'];
const records = chapterKinds.flatMap((kind) => [
  chapterRecord(`site/src/content/chapters/en/${kind}.mdx`),
  chapterRecord(`site/src/content/chapters/vi/${kind}.mdx`),
]);
const validationContext = {
  canonicalClaims,
  publicationManifest: manifest,
};

test('six bilingual chapters validate against canonical evidence and preserve route semantics', () => {
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
  }

  for (const kind of chapterKinds) {
    const en = records.find((record) =>
      record.chapterKind === kind && record.locale === 'en');
    const vi = records.find((record) =>
      record.chapterKind === kind && record.locale === 'vi');
    assert.deepEqual(validateChapterLocalePair(en, vi, `$.pairs.${kind}`), []);
  }

  assert.deepEqual(
    validateChapters({
      ...validationContext,
      entries: records.map((data) => ({ collection: 'chapters', data })),
    }),
    [],
  );
});

test('chapter technical denominators and limits remain aligned in both locales', () => {
  const requiredTokens = [
    '713',
    '553',
    '684',
    '91',
    '862',
    '784',
    '59',
    '3',
    '16',
    '32',
    '10/10',
    '761',
    '100',
    '25',
    'original-runtime identity',
  ];

  for (const locale of ['en', 'vi']) {
    const source = chapterKinds
      .map((kind) => read(`site/src/content/chapters/${locale}/${kind}.mdx`))
      .join('\n');
    for (const token of requiredTokens) {
      assert.match(
        source.toLocaleLowerCase(),
        new RegExp(token.replace('/', '\\/'), 'u'),
        `${locale} copy must preserve ${token}`,
      );
    }
    assert.match(source, /pencil-blade-maximal-recoverable-fidelity@1\.1\.0/u);
    assert.match(source, /originalRuntimeObservation = false|original-runtime identity: false/u);
  }
});

test('all chapter runtime derivatives are exact registered copies with both rights dimensions', () => {
  const derivatives = manifest.media.filter((record) =>
    record.mediaId.startsWith('MEDIA-CHAPTER-RUNTIME-'));
  assert.equal(derivatives.length, 6);
  const originals = new Map(
    manifest.media.map((record) => [record.mediaId, record]),
  );

  for (const record of derivatives) {
    const source = originals.get(record.provenance.sourceMediaId);
    assert.ok(source, `${record.mediaId} source must be registered`);
    assert.equal(record.publishable, true);
    assert.equal(record.kind, 'runtime-display-derivative');
    assert.equal(record.academicDisplayDecisionRef, manifest.academicDisplayDecisionRef);
    assert.equal(record.commercialRightsRecordRef, manifest.commercialRightsRecordRef);
    assert.equal(record.provenance.sha256, source.provenance.sha256);
    assert.equal(record.provenance.width, source.provenance.width);
    assert.equal(record.provenance.height, source.provenance.height);
    assert.equal(
      record.transformationHistory[0],
      `exact byte copy from ${record.provenance.sourceMediaId}`,
    );
    const bytes = readFileSync(resolve(repositoryRoot, record.provenance.path));
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      record.provenance.sha256,
    );
  }
});

test('chapter diagrams and interactions keep accessible static fallbacks', () => {
  for (const path of [
    'site/src/assets/diagrams/apk-layers.svg',
    'site/src/assets/diagrams/evidence-pipeline.svg',
    'site/src/assets/diagrams/reconstruction-architecture.svg',
  ]) {
    const source = read(path);
    assert.match(source, /^<svg\b/u);
    assert.doesNotMatch(source, /<script|foreignObject|on\w+\s*=|(?:href|src)\s*=\s*["']https?:\/\//iu);
    assert.ok(statSync(resolve(repositoryRoot, path)).size < 80_000);
  }

  const dissection = read('site/src/components/forensics/apk-dissection.astro');
  assert.match(dissection, /<details[^>]*open/u);
  assert.match(dissection, /<ol>/u);
  assert.match(dissection, /data-apk-show-all/u);

  const trace = read('site/src/components/forensics/native-contract-trace.astro');
  assert.match(trace, /role="tablist"/u);
  assert.match(trace, /<details open>/u);
  assert.match(trace, /<table>/u);
  assert.match(trace, /data-trace-(?:replay|stop|show-all)/u);

  const proof = read('site/src/components/reconstruction/runtime-proof-matrix.astro');
  assert.match(proof, /loading="lazy"/u);
  assert.match(proof, /original runtime|historical runtime/u);
  assert.match(proof, /resolveApprovedMedia/u);
});

test('negative fixtures fail closed on overclaims, private paths, unsafe downloads, drift, and media', () => {
  const rhythmic = [
    'Question',
    'Artifact',
    'Method',
    'Contract',
    'Proof',
    'Limit',
    'Next chapter',
  ].join('\n');

  const fixtures = [
    [`${rhythmic}\nWe observed the original runtime.`, 'ORIGINAL_RUNTIME_OVERCLAIM'],
    [`${rhythmic}\nWe recovered original C++ source.`, 'ORIGINAL_SOURCE_OVERCLAIM'],
    [`${rhythmic}\nfile:///Users/reviewer/private.txt`, 'CHAPTER_PRIVATE_PATH'],
    [`${rhythmic}\n<a href="payload.apk">download</a>`, 'CHAPTER_DENIED_ARTIFACT_LINK'],
    [`${rhythmic}\nThe result is 100%.`, 'UNQUALIFIED_FIDELITY_PERCENTAGE'],
  ];
  for (const [source, expectedCode] of fixtures) {
    assert.ok(
      validateChapterDocument(source).some((entry) => entry.code === expectedCode),
      `${expectedCode} must be reported`,
    );
  }

  const en = records.find((record) => record.id === 'story.en');
  const vi = records.find((record) => record.id === 'story.vi');
  assert.ok(
    validateChapterLocalePair(en, {
      ...vi,
      evidenceRefs: vi.evidenceRefs.slice(1),
    }).some((entry) => entry.code === 'CHAPTER_LOCALE_DRIFT'),
  );
  assert.ok(
    validateChapterEntry({
      ...en,
      mediaRefs: ['MEDIA-NOT-REGISTERED'],
    }, validationContext).some((entry) => entry.code === 'UNAPPROVED_CHAPTER_MEDIA'),
  );
});

test('chapter route fragment and page entry points cover the complete bilingual sequence', () => {
  const routeFragment = read('site/src/data/route-fragments/chapters.ts');
  for (const path of [
    '/story/',
    '/forensics/',
    '/reconstruction/',
    '/vi/story/',
    '/vi/forensics/',
    '/vi/reconstruction/',
  ]) {
    assert.match(routeFragment, new RegExp(path.replaceAll('/', '\\/'), 'u'));
  }
  for (const localePrefix of ['', 'vi/']) {
    for (const kind of chapterKinds) {
      const page = read(`site/src/pages/${localePrefix}${kind}/index.astro`);
      assert.match(page, /ChapterPage/u);
      assert.match(page, new RegExp(`${kind}\\.${localePrefix ? 'vi' : 'en'}`, 'u'));
    }
  }
});
