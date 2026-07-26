import assert from 'node:assert/strict';
import {
  readFileSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { parse as parseYaml } from '../site/node_modules/yaml/dist/index.js';

import {
  validateAiEpisode,
  validateAiLab,
  validateLocaleParity as validateScriptLocaleParity,
} from '../scripts/case-study-validation/ai-lab.mjs';
import {
  buildAiLabIndex,
  buildEvidenceExplorerEntries,
  buildExplorerFilters,
  getAiLabPublicationManifest,
  resolveCaseFileSources,
  resolveEvidencePresentation,
  validateLocaleParity,
} from '../site/src/data/ai-lab/index.ts';
import {
  matchesExplorerEntry,
  parseExplorerState,
  serializeExplorerState,
} from '../site/src/components/evidence-explorer/filter-state.ts';
import { aiLabRouteFragment } from '../site/src/data/route-fragments/ai-lab.ts';

const repositoryRoot = new URL('../', import.meta.url);
const contentRoot = new URL('../site/src/content/aiEpisodes/', import.meta.url);
const publicationManifest = JSON.parse(
  readFileSync(new URL('../reference/case-study-publication-manifest.json', import.meta.url)),
);
const sourceCatalog = JSON.parse(
  readFileSync(new URL('../reference/case-study-public-source-catalog.json', import.meta.url)),
);
const canonicalClaims = readFileSync(
  new URL('../forensics/claims.jsonl', import.meta.url),
  'utf8',
)
  .trim()
  .split(/\r?\n/u)
  .map((line) => JSON.parse(line));

function parseEpisode(path) {
  const source = readFileSync(path, 'utf8');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  assert.ok(match, `Missing frontmatter in ${path}`);
  return parseYaml(match[1]);
}

function loadEpisodes() {
  return ['en', 'vi'].flatMap((locale) => {
    const directory = new URL(`${locale}/`, contentRoot);
    return readdirSync(directory)
      .filter((name) => name.endsWith('.mdx'))
      .sort()
      .map((name) => parseEpisode(new URL(name, directory)));
  });
}

function context(entries = loadEpisodes()) {
  return {
    entries: entries.map((data) => ({ collection: 'aiEpisodes', data })),
    publicationManifest,
    sourceCatalog,
    canonicalClaims,
  };
}

function hasCode(findings, code) {
  return findings.some((entry) => entry.code === code);
}

function clone(value) {
  return structuredClone(value);
}

test('six bilingual curated episodes pass domain validation and preserve locale parity', () => {
  const episodes = loadEpisodes();
  assert.equal(episodes.length, 12);
  assert.equal(episodes.filter((episode) => episode.locale === 'en').length, 6);
  assert.equal(episodes.filter((episode) => episode.locale === 'vi').length, 6);
  assert.deepEqual(validateAiLab(context(episodes)), []);

  const byId = Map.groupBy(episodes, (episode) => episode.id);
  assert.equal(byId.size, 6);
  for (const pair of byId.values()) {
    const en = pair.find((episode) => episode.locale === 'en');
    const vi = pair.find((episode) => episode.locale === 'vi');
    assert.ok(en);
    assert.ok(vi);
    assert.deepEqual(validateLocaleParity(en, vi), []);
    assert.deepEqual(validateScriptLocaleParity(en, vi), []);
  }

  const correction = episodes.find(
    (episode) => episode.locale === 'en' && episode.id === 'static-only-strategy',
  );
  assert.match(correction.reviewDecision, /proposal was rejected/iu);
  assert.ok(episodes.every((episode) => episode.decisionActorKind !== 'human'));
  assert.ok(episodes.every((episode) => episode.publicSourceIds.includes(episode.decisionRef)));
});

test('AI index is deterministic and canonical state can only come from generated facts', () => {
  const episodes = loadEpisodes().filter((episode) => episode.locale === 'en');
  const first = buildAiLabIndex(getAiLabPublicationManifest(), episodes);
  const second = buildAiLabIndex(getAiLabPublicationManifest(), [...episodes].reverse());
  assert.deepEqual(second, first);
  assert.deepEqual(first.map((episode) => episode.order), [1, 2, 3, 4, 5, 6]);

  const canonical = canonicalClaims.find((claim) => claim.id === 'CLM-CONTENT-RIGHTS');
  const presentation = resolveEvidencePresentation('CLM-CONTENT-RIGHTS', 'en');
  assert.equal(presentation.status, canonical.status);
  assert.equal(presentation.confidence, canonical.confidence);
  assert.deepEqual(presentation.evidenceRefs, canonical.evidenceRefs);
  assert.throws(
    () => resolveEvidencePresentation('CLM-NOT-REGISTERED', 'en'),
    /Unknown canonical claim/u,
  );
});

test('evidence explorer exposes deterministic facets and separate rights dimensions', () => {
  const entries = buildEvidenceExplorerEntries('en');
  const facets = buildExplorerFilters(entries);
  assert.equal(entries.length, 39);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 39);
  assert.deepEqual(entries.map((entry) => entry.order), [...entries.map((entry) => entry.order)].sort((a, b) => a - b));
  assert.deepEqual(facets.locale, ['en', 'vi']);
  assert.ok(facets.chapter.includes('forensics'));
  assert.ok(facets.status.includes('recovered'));
  assert.ok(facets.status.includes('unknown'));
  assert.deepEqual(facets.academicDisplay, ['text-only-no-media-claim']);
  assert.deepEqual(facets.commercialRights, ['blocked']);
  assert.ok(entries.every((entry) => (
    entry.academicDisplay === 'text-only-no-media-claim'
    && entry.commercialRights === 'blocked'
  )));
});

test('public source resolution returns allowlisted excerpts and only approved direct links', () => {
  const [direct] = resolveCaseFileSources(['SRC-PUBLIC-FIDELITY'], 'en');
  assert.equal(direct.linkKind, 'direct');
  assert.match(direct.href, /^https:\/\/github\.com\/dantech0xff\/pencil-blade-2026\/blob\/[a-f0-9]{40}\//u);

  const [excerpt] = resolveCaseFileSources(['SRC-PUBLIC-CLAIMS'], 'vi');
  assert.equal(excerpt.linkKind, 'excerpt-only');
  assert.equal(excerpt.href, null);
  assert.ok(excerpt.excerpt.length > 0);
  assert.throws(
    () => resolveCaseFileSources(['SRC-NOT-ALLOWLISTED']),
    /Unknown public source/u,
  );
});

test('URL filter state is stable, shareable, and entry matching is deterministic', () => {
  const state = parseExplorerState(
    '?status=recovered&chapter=forensics&q=ARM&commercialRights=blocked',
  );
  assert.equal(
    serializeExplorerState(state),
    'q=ARM&chapter=forensics&status=recovered&commercialRights=blocked',
  );
  const entry = {
    searchText: 'CLM-NATIVE-PROFILE ARM Thumb',
    chapter: 'forensics',
    status: 'recovered',
    locale: 'en',
    sourceType: 'canonical-ledger',
    academicDisplay: 'text-only-no-media-claim',
    commercialRights: 'blocked',
    verificationType: 'contract-eligible',
  };
  assert.equal(matchesExplorerEntry(entry, state), true);
  assert.equal(
    matchesExplorerEntry(entry, { ...state, status: 'unknown' }),
    false,
  );
});

test('negative fixtures reject raw payloads, private paths, source drift, media, locale drift, and unsupported human wording', () => {
  const [baseEn, baseVi] = [
    loadEpisodes().find((episode) => episode.locale === 'en'),
    loadEpisodes().find((episode) => episode.locale === 'vi'),
  ];

  const raw = clone(baseEn);
  raw.rawTranscript = { messages: ['not publishable'] };
  assert.equal(
    hasCode(validateAiEpisode(raw, context()), 'FORBIDDEN_AI_PAYLOAD_FIELD'),
    true,
  );

  const privatePath = clone(baseEn);
  privatePath.failureLesson = 'See /Users/example/private/review.txt';
  assert.equal(hasCode(validateAiEpisode(privatePath, context()), 'AI_PRIVATE_PATH'), true);

  const sourceDrift = clone(baseEn);
  sourceDrift.status = 'unknown';
  sourceDrift.sourcePath = 'docs/current-report.md';
  const driftFindings = validateAiEpisode(sourceDrift, context());
  assert.equal(hasCode(driftFindings, 'AI_AUTHORITY_OVERRIDE'), true);

  const source = clone(baseEn);
  source.publicSourceIds = [...source.publicSourceIds, 'SRC-NOT-ALLOWLISTED'];
  assert.equal(hasCode(validateAiEpisode(source, context()), 'UNKNOWN_AI_SOURCE_REF'), true);

  const media = clone(baseEn);
  media.mediaRefs = ['MEDIA-NOT-REGISTERED'];
  assert.equal(hasCode(validateAiEpisode(media, context()), 'UNAPPROVED_AI_MEDIA'), true);

  const localeDrift = clone(baseVi);
  localeDrift.evidence = [...localeDrift.evidence].reverse();
  assert.equal(
    hasCode(validateScriptLocaleParity(baseEn, localeDrift), 'AI_LOCALE_DRIFT'),
    true,
  );

  const human = clone(baseEn);
  human.decisionActorKind = 'human';
  human.reviewDecision = 'Human reviewed and accepted the proposal.';
  const humanFindings = validateAiEpisode(human, context());
  assert.equal(hasCode(humanFindings, 'MISSING_PUBLIC_HUMAN_SIGNOFF'), true);
  assert.equal(hasCode(humanFindings, 'UNSUPPORTED_HUMAN_REVIEW_WORDING'), true);
});

test('route fragment and static route files cover bilingual indexes and stable details', () => {
  assert.equal(aiLabRouteFragment.length, 8);
  assert.deepEqual(
    new Set(aiLabRouteFragment.map((route) => route.locale)),
    new Set(['en', 'vi']),
  );
  for (const path of [
    'site/src/pages/ai-lab/index.astro',
    'site/src/pages/ai-lab/[slug].astro',
    'site/src/pages/evidence/index.astro',
    'site/src/pages/evidence/[id].astro',
    'site/src/pages/vi/ai-lab/index.astro',
    'site/src/pages/vi/ai-lab/[slug].astro',
    'site/src/pages/vi/evidence/index.astro',
    'site/src/pages/vi/evidence/[id].astro',
  ]) {
    const source = readFileSync(new URL(path, repositoryRoot), 'utf8');
    assert.ok(source.length > 0);
  }
  const evidenceIndex = readFileSync(
    new URL('site/src/pages/evidence/index.astro', repositoryRoot),
    'utf8',
  );
  const editorialEnhancements = readFileSync(
    new URL('site/src/scripts/editorial-enhancements.ts', repositoryRoot),
    'utf8',
  );
  assert.match(evidenceIndex, /<noscript>/u);
  assert.match(editorialEnhancements, /enhanceEvidenceExplorer/u);
  assert.doesNotMatch(evidenceIndex, /<img|<video|<audio/iu);
});
