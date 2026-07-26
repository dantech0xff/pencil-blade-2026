#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  existsSync,
  readFileSync,
} from 'node:fs';
import test from 'node:test';

import {
  generatePublicFacts,
  loadPublicationManifest,
  resolvePublicCitation,
  stableJson,
} from '../scripts/generate-case-study-data.mjs';
import {
  aggregateValidationFragments,
  validateCollectionParity,
  validateContentReferences,
  validateInternalLinks,
} from '../scripts/validate-case-study-content.mjs';

const publicationManifest = JSON.parse(
  readFileSync(
    new URL('../reference/case-study-publication-manifest.json', import.meta.url),
    'utf8',
  ),
);
const sourceCatalog = JSON.parse(
  readFileSync(
    new URL('../reference/case-study-public-source-catalog.json', import.meta.url),
    'utf8',
  ),
);
const canonicalClaims = readFileSync(
  new URL('../forensics/claims.jsonl', import.meta.url),
  'utf8',
)
  .trim()
  .split(/\r?\n/u)
  .map((line) => JSON.parse(line));

function clone(value) {
  return structuredClone(value);
}

function hasCode(findings, code) {
  return findings.some((entry) => entry.code === code);
}

test('public facts are deterministic, source-bound, and pure until the CLI runs', () => {
  const outputUrl = new URL('../site/src/generated/facts.json', import.meta.url);
  const existedBefore = existsSync(outputUrl);
  const bytesBefore = existedBefore ? readFileSync(outputUrl) : null;

  const first = generatePublicFacts();
  const second = generatePublicFacts();

  assert.deepEqual(second, first);
  assert.equal(stableJson(second), stableJson(first));
  assert.equal(first.evidenceScope, 'restorationEvidenceSnapshot');
  assert.ok(first.facts.length > 20);
  assert.ok(first.facts.every((entry) => (
    typeof entry.source.path === 'string'
    && typeof entry.source.fieldPointer === 'string'
  )));
  const factsById = new Map(first.facts.map((entry) => [entry.id, entry.value]));
  assert.equal(factsById.get('native.total-functions'), 713);
  assert.equal(factsById.get('native.functions-with-direct-calls'), 553);
  assert.equal(factsById.get('native.functions-with-numeric-constants'), 684);
  assert.equal(factsById.get('native.functions-with-string-xrefs'), 91);
  assert.equal(factsById.get('resources.assets.total'), 862);
  assert.equal(factsById.get('resources.reconciliation.consumed'), 761);
  assert.equal(factsById.get('resources.reconciliation.excluded'), 100);
  assert.equal(factsById.get('resources.reconciliation.unsupported'), 1);
  assert.equal(factsById.get('resources.reconciliation.unknown'), 0);
  assert.equal(factsById.get('fidelity.overall-score-percent'), 100);
  assert.equal(factsById.get('residuals.summary.total'), 25);
  assert.equal(existsSync(outputUrl), existedBefore);
  if (bytesBefore) {
    assert.deepEqual(readFileSync(outputUrl), bytesBefore);
  }
});

test('all 39 presentations join to canonical authority without authored overrides', () => {
  const output = generatePublicFacts();
  assert.equal(output.claimPresentations.length, 39);
  assert.equal(
    new Set(output.claimPresentations.map((record) => record.canonicalClaimId)).size,
    39,
  );

  for (const presentation of output.claimPresentations) {
    const canonical = canonicalClaims.find(
      (claim) => claim.id === presentation.canonicalClaimId,
    );
    assert.ok(canonical);
    for (const field of [
      'claim',
      'status',
      'evidenceTier',
      'confidence',
      'evidenceRefs',
      'contradictionIds',
      'contractEligible',
    ]) {
      assert.deepEqual(presentation[field], canonical[field]);
      assert.equal(
        presentation.fieldSources[field].path,
        'forensics/claims.jsonl',
      );
    }
  }
});

test('caller-provided claim objects cannot replace hash-frozen canonical fields', () => {
  const tamperedClaims = clone(canonicalClaims);
  tamperedClaims[0].claim = 'Invented replacement.';
  tamperedClaims[0].confidence = 0;

  const output = generatePublicFacts({ canonicalClaims: tamperedClaims });
  const first = output.claimPresentations.find(
    (record) => record.canonicalClaimId === tamperedClaims[0].id,
  );
  assert.equal(first.claim, canonicalClaims[0].claim);
  assert.equal(first.confidence, canonicalClaims[0].confidence);
});

test('snapshot hash drift blocks public data generation', () => {
  const snapshot = clone(publicationManifest.restorationEvidenceSnapshot);
  snapshot.authoritativeInputs[0].sha256 = '0'.repeat(64);
  assert.throws(
    () => generatePublicFacts({}, snapshot),
    /Snapshot hash drift for forensics\/claims\.jsonl/u,
  );
});

test('Phase 1 loader validates and returns the reviewed publication manifest', () => {
  const loaded = loadPublicationManifest();
  assert.equal(loaded.manifestVersion, '1.2.0');
  assert.equal(loaded.claimPresentations.length, 39);

  const invalid = clone(publicationManifest);
  invalid.claimPresentations[0].status = 'unknown';
  assert.throws(
    () => loadPublicationManifest({
      publicationManifest: invalid,
      sourceCatalog,
      canonicalClaims,
      verifySnapshot: false,
    }),
    /CANONICAL_FIELD_OVERRIDE/u,
  );
});

test('public citations expose only commit-pinned allowlisted direct sources', () => {
  const commit = publicationManifest.restorationEvidenceSnapshot.repositoryCommit;
  const direct = resolvePublicCitation(
    'SRC-PUBLIC-FIDELITY',
    sourceCatalog,
    commit,
  );
  assert.equal(
    direct,
    `https://github.com/dantech0xff/pencil-blade-2026/blob/${commit}/`
      + 'forensics/fidelity/fidelity-report-v1.json',
  );

  const excerpt = resolvePublicCitation(
    'SRC-PUBLIC-CLAIMS',
    sourceCatalog,
    commit,
  );
  assert.equal(
    excerpt,
    '/pencil-blade-2026/sources/SRC-PUBLIC-CLAIMS/',
  );
  assert.doesNotMatch(excerpt, /github\.com|forensics\/claims/u);

  const unsafeCatalog = clone(sourceCatalog);
  const directRecord = unsafeCatalog.sources.find(
    (record) => record.sourceId === 'SRC-PUBLIC-FIDELITY',
  );
  directRecord.path = '../private.json';
  assert.throws(
    () => resolvePublicCitation('SRC-PUBLIC-FIDELITY', unsafeCatalog, commit),
    /Unsafe repository path/u,
  );
  assert.throws(
    () => resolvePublicCitation(
      'SRC-PUBLIC-CLAIMS',
      sourceCatalog,
      commit,
      { base: '/missing-trailing-slash' },
    ),
    /start and end/u,
  );
});

test('collection parity and references reject missing locale and unknown IDs', () => {
  const entries = [
    {
      collection: 'chapters',
      data: {
        id: 'scope',
        locale: 'en',
        evidenceRefs: [
          'CLM-NOT-REAL',
          { canonicalClaimId: 'CLM-APK-BYTES', status: 'unknown' },
        ],
        mediaRefs: ['MEDIA-NOT-REAL'],
        publicSourceIds: ['SRC-NOT-REAL'],
      },
    },
  ];
  assert.equal(
    hasCode(validateCollectionParity(entries), 'MISSING_LOCALE_PAIR'),
    true,
  );
  const referenceFindings = validateContentReferences(entries, {
    publicationManifest,
    sourceCatalog,
    canonicalClaims,
  });
  assert.equal(hasCode(referenceFindings, 'UNKNOWN_EVIDENCE_REF'), true);
  assert.equal(hasCode(referenceFindings, 'EVIDENCE_STATUS_MISMATCH'), true);
  assert.equal(hasCode(referenceFindings, 'UNKNOWN_MEDIA_REF'), true);
  assert.equal(hasCode(referenceFindings, 'UNKNOWN_SOURCE_REF'), true);

  const valid = clone(entries);
  valid[0].data.evidenceRefs = [
    { canonicalClaimId: 'CLM-APK-BYTES', status: 'recovered' },
  ];
  valid[0].data.mediaRefs = ['MEDIA-H5-AUDITED-TREE'];
  valid[0].data.publicSourceIds = ['SRC-PUBLIC-FIDELITY'];
  assert.deepEqual(validateContentReferences(valid, publicationManifest), []);
});

test('internal link validation rejects base bypass, duplicate base, and missing targets', () => {
  const findings = validateInternalLinks({
    base: '/pencil-blade-2026/',
    routes: [
      {
        path: '/pencil-blade-2026/',
        links: [
          '/outside/',
          '/pencil-blade-2026/pencil-blade-2026/',
          '/pencil-blade-2026/missing/',
        ],
      },
      {
        path: '/outside/',
        links: [],
      },
      {
        path: '/pencil-blade-2026/pencil-blade-2026/',
        links: [],
      },
    ],
  });
  assert.equal(hasCode(findings, 'BASE_BYPASS'), true);
  assert.equal(hasCode(findings, 'DUPLICATE_PAGES_BASE'), true);
  assert.equal(hasCode(findings, 'MISSING_INTERNAL_TARGET'), true);
});

test('fixed validator aggregation is stable and rejects fragment collisions', () => {
  const findings = aggregateValidationFragments({}, [
    { id: 'chapters', validate: () => [] },
    { id: 'chapters', validate: () => [] },
  ]);
  assert.deepEqual(findings, [
    {
      code: 'DUPLICATE_VALIDATION_FRAGMENT',
      path: '$.validationFragments[1].id',
      message: 'Duplicate validation fragment chapters.',
    },
  ]);
});
