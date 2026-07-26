import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  resolveFieldAuthority,
  runCli,
  validateAiEpisode,
  validateClaimPresentation,
  validateEvidenceSnapshot,
  validateMediaRecord,
  validatePublicationManifest,
  validatePublicSource,
} from '../scripts/validate-case-study-publication.mjs';

const manifest = JSON.parse(
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

test('reviewed publication manifest passes policy and frozen snapshot validation', () => {
  assert.deepEqual(validatePublicationManifest(manifest), []);
  assert.deepEqual(
    validatePublicationManifest(manifest, { verifySnapshot: true }),
    [],
  );
  assert.equal(manifest.claimPresentations.length, 39);
  assert.equal(
    new Set(manifest.claimPresentations.map((record) => record.canonicalClaimId)).size,
    39,
  );
});

test('claim projections reject canonical overrides, missing locales, and unknown fields', () => {
  const canonical = canonicalClaims[0];
  const record = clone(manifest.claimPresentations[0]);
  record.status = 'unknown';
  delete record.publicCopy.vi;
  record.nativeAddress = '0x1234';

  const findings = validateClaimPresentation(record, canonical);
  assert.equal(hasCode(findings, 'CANONICAL_FIELD_OVERRIDE'), true);
  assert.equal(hasCode(findings, 'MISSING_CLAIM_LOCALE'), true);
  assert.equal(hasCode(findings, 'UNKNOWN_PRESENTATION_FIELD'), true);
});

test('unknown canonical rights claim cannot receive recovered credit', () => {
  const canonical = canonicalClaims.find((claim) => claim.id === 'CLM-CONTENT-RIGHTS');
  const record = clone(
    manifest.claimPresentations.find(
      (entry) => entry.canonicalClaimId === canonical.id,
    ),
  );
  record.tags.push('recovered-credit');

  assert.equal(
    hasCode(validateClaimPresentation(record, canonical), 'INVALID_RECOVERED_CREDIT'),
    true,
  );
});

test('manifest rejects missing, duplicate, and unknown canonical claim IDs', () => {
  const fixture = clone(manifest);
  fixture.claimPresentations.pop();
  fixture.claimPresentations.push(clone(fixture.claimPresentations[0]));
  fixture.claimPresentations[0].canonicalClaimId = 'CLM-NOT-REGISTERED';

  const findings = validatePublicationManifest(fixture);
  assert.equal(hasCode(findings, 'UNKNOWN_CANONICAL_CLAIM'), true);
  assert.equal(hasCode(findings, 'DUPLICATE_CLAIM_ORDER'), true);
  assert.equal(hasCode(findings, 'MISSING_CANONICAL_CLAIM'), true);
});

test('public sources reject raw paths, traversal, hash drift, and private transitive links', () => {
  const rawPath = clone(sourceCatalog.sources[0]);
  rawPath.path = 'offline-evidence/original.apk';
  assert.equal(hasCode(validatePublicSource(rawPath), 'DENIED_PUBLIC_SOURCE'), true);

  const traversal = clone(sourceCatalog.sources[0]);
  traversal.path = '../outside.md';
  assert.equal(hasCode(validatePublicSource(traversal), 'UNSAFE_SOURCE_PATH'), true);

  const drift = clone(sourceCatalog.sources[0]);
  drift.sha256 = '0'.repeat(64);
  assert.equal(hasCode(validatePublicSource(drift), 'SOURCE_HASH_DRIFT'), true);

  const transitive = clone(sourceCatalog.sources[0]);
  transitive.transitiveLinks = ['.forensics-work/native/private.txt'];
  assert.equal(
    hasCode(validatePublicSource(transitive), 'UNSAFE_TRANSITIVE_LINK'),
    true,
  );
});

test('source records require a bilingual sanitized excerpt', () => {
  const fixture = clone(sourceCatalog.sources[0]);
  delete fixture.publicSafeExcerpt.vi;
  assert.equal(
    hasCode(validatePublicSource(fixture), 'MISSING_SOURCE_EXCERPT'),
    true,
  );
});

test('media keeps academic display and commercial rights separate', () => {
  const collapsed = clone(manifest.media[0]);
  collapsed.rightsState = 'approved';
  assert.equal(
    hasCode(validateMediaRecord(collapsed), 'COLLAPSED_RIGHTS_STATE'),
    true,
  );

  const unapproved = clone(manifest.media[0]);
  unapproved.publishable = false;
  assert.equal(hasCode(validateMediaRecord(unapproved), 'UNAPPROVED_MEDIA'), true);

  const missingAlt = clone(manifest.media[0]);
  delete missingAlt.alt.vi;
  assert.equal(
    hasCode(validateMediaRecord(missingAlt), 'MISSING_MEDIA_LOCALE'),
    true,
  );
});

test('AI episode validation rejects raw transcripts and unsupported human wording', () => {
  const raw = {
    id: 'episode-raw',
    decisionActorKind: 'automation',
    rawTranscript: 'private session',
  };
  assert.equal(hasCode(validateAiEpisode(raw), 'RAW_AI_PAYLOAD'), true);

  const unsupportedHuman = {
    id: 'episode-human',
    decisionActorKind: 'mixed',
    reviewDecision: 'Human reviewed and accepted.',
    decisionRef: 'automated-report',
  };
  assert.equal(
    hasCode(validateAiEpisode(unsupportedHuman), 'UNSUPPORTED_HUMAN_REVIEW'),
    true,
  );
});

test('snapshot validation detects missing paths and hash drift', () => {
  const drift = clone(manifest.restorationEvidenceSnapshot);
  drift.authoritativeInputs[0].sha256 = 'f'.repeat(64);
  assert.equal(
    hasCode(
      validateEvidenceSnapshot(drift, { verifyHashes: true }),
      'SNAPSHOT_HASH_DRIFT',
    ),
    true,
  );

  const missing = clone(manifest.restorationEvidenceSnapshot);
  missing.authoritativeInputs[0].path = 'forensics/missing-input.json';
  assert.equal(
    hasCode(
      validateEvidenceSnapshot(missing, { verifyHashes: true }),
      'INVALID_SNAPSHOT_PATH',
    ),
    true,
  );
});

test('field authority resolution is explicit and fail-closed', () => {
  const known = resolveFieldAuthority('canonicalClaims');
  assert.equal(known.finding, null);
  assert.equal(known.authority.path, 'forensics/claims.jsonl');

  const unknown = resolveFieldAuthority('historicalJournalStatus');
  assert.equal(unknown.authority, null);
  assert.equal(unknown.finding.code, 'UNKNOWN_FIELD_AUTHORITY');
});

test('release inputs remain a candidate blocker without invalidating base publication', () => {
  assert.equal(manifest.releaseInputs.candidateStatus, 'blocked-pending-evidence');
  assert.equal(
    manifest.releaseInputs.accountableReleaseOwner.evidenceStatus,
    'pending',
  );
  assert.equal(
    manifest.releaseInputs.vietnameseFactualReview.evidenceStatus,
    'pending',
  );

  const inventedApproval = clone(manifest);
  inventedApproval.releaseInputs.candidateStatus = 'approved';
  assert.equal(
    hasCode(
      validatePublicationManifest(inventedApproval),
      'UNVERIFIED_RELEASE_INPUT_STATUS',
    ),
    true,
  );
});

test('CLI supports policy and snapshot modes and rejects unknown arguments', () => {
  assert.equal(
    runCli([
      '--manifest',
      'reference/case-study-publication-manifest.json',
    ]),
    0,
  );
  assert.equal(
    runCli([
      '--manifest',
      'reference/case-study-publication-manifest.json',
      '--verify-snapshot',
    ]),
    0,
  );
  assert.equal(runCli(['--not-a-real-option']), 2);
});
