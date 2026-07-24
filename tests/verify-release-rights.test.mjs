import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';

import { validatePublicReleaseManifest } from '../scripts/verify-release-rights.mjs';

const testRoot = mkdtempSync(join(tmpdir(), 'pencil-blade-rights-'));
const evidencePath = 'rights/approval.txt';
const livePendingExceptions = JSON.parse(
  readFileSync(new URL('../release/public-release-variant-manifest.json', import.meta.url), 'utf8'),
).releaseExceptions.pending;
mkdirSync(join(testRoot, 'rights'), { recursive: true });
mkdirSync(join(testRoot, 'release'), { recursive: true });
writeFileSync(join(testRoot, evidencePath), 'approved fixture\n');
symlinkSync(join(testRoot, evidencePath), join(testRoot, 'rights/approval-link.txt'));
writeFileSync(
  join(testRoot, 'release/recovered-reconstruction-manifest.json'),
  JSON.stringify({
    manifestId: 'pencil-blade-recovered-reconstruction',
    resourceCorpus: { stagingManifestSha256: 'a'.repeat(64) },
    implementation: { originalExecutableCodeIncluded: false },
    rights: { publicDistributionApproved: false },
  }),
);

after(() => {
  rmSync(testRoot, { force: true, recursive: true });
});

test('approved complete manifest passes', () => {
  assert.deepEqual(validatePublicReleaseManifest(createManifest(), { root: testRoot }), []);
});

test('blocked repository manifest shape cannot pass through empty approvals', () => {
  const manifest = createManifest();
  manifest.releaseDecision.status = 'blocked';
  manifest.releaseDecision.approvedBy = null;
  manifest.records[0].rightsStatus = 'unresolved';
  manifest.records[0].shipReady = false;

  const findings = validatePublicReleaseManifest(manifest, { root: testRoot });
  assert.ok(findings.includes('releaseDecision.status must equal approved'));
  assert.ok(findings.includes('releaseDecision.approvedBy must name the accountable approver'));
  assert.ok(findings.includes('records[0].rightsStatus must equal approved'));
  assert.ok(findings.includes('records[0].shipReady must equal true'));
});

test('missing category and missing evidence fail closed', () => {
  const manifest = createManifest();
  manifest.records = manifest.records.filter((record) => record.category !== 'fonts');
  manifest.records[0].rightsEvidenceRefs = [];

  const findings = validatePublicReleaseManifest(manifest, { root: testRoot });
  assert.ok(findings.includes('missing required rights category: fonts'));
  assert.ok(findings.includes(
    'records[0].rightsEvidenceRefs must contain at least one repository evidence file',
  ));
});

test('unsafe, missing, and symlink evidence paths fail closed', () => {
  const manifest = createManifest();
  manifest.records[0].rightsEvidenceRefs = ['../outside'];
  manifest.records[1].rightsEvidenceRefs = ['rights/missing.txt'];
  manifest.records[2].rightsEvidenceRefs = ['rights/approval-link.txt'];

  const findings = validatePublicReleaseManifest(manifest, { root: testRoot });
  assert.ok(findings.includes(
    'records[0].rightsEvidenceRefs[0] must be a safe repository-relative path',
  ));
  assert.ok(findings.includes(
    'records[1].rightsEvidenceRefs[0] does not resolve to an existing repository file',
  ));
  assert.ok(findings.includes(
    'records[2].rightsEvidenceRefs[0] must resolve to a regular non-symlink file',
  ));
});

test('release exceptions are mandatory and both ledgers must be arrays', () => {
  const missing = createManifest();
  delete missing.releaseExceptions;
  assert.ok(
    validatePublicReleaseManifest(missing, { root: testRoot })
      .includes('releaseExceptions must be an object'),
  );

  const malformed = createManifest();
  malformed.releaseExceptions = { approved: {}, pending: null };
  const findings = validatePublicReleaseManifest(malformed, { root: testRoot });
  assert.ok(findings.includes('releaseExceptions.approved must be an array'));
  assert.ok(findings.includes('releaseExceptions.pending must be an array'));
});

test('otherwise approved manifest is blocked by a live pending exception', () => {
  const manifest = createManifest();
  manifest.releaseExceptions.pending = structuredClone(livePendingExceptions);

  const findings = validatePublicReleaseManifest(manifest, { root: testRoot });
  assert.deepEqual(findings, [
    'releaseExceptions.pending must be empty before public release',
  ]);
});

test('pending and approved exception entries enforce their fail-closed shapes', () => {
  const manifest = createManifest();
  manifest.releaseExceptions.pending = [
    null,
    {
      id: ' not-stable ',
      scope: ' ',
      status: 'approved',
      reason: '',
    },
  ];
  manifest.releaseExceptions.approved = [
    null,
    {
      id: '',
      scope: '',
      treatment: ' ',
      status: 'pending-user-decision',
      reason: '',
      approvedBy: '',
      approvedAt: '2026-02-31',
      evidenceRefs: [],
    },
  ];

  const findings = validatePublicReleaseManifest(manifest, { root: testRoot });
  assert.ok(findings.includes('releaseExceptions.pending[0] must be an object'));
  assert.ok(findings.includes(
    'releaseExceptions.pending[1].id must be a stable non-empty identifier',
  ));
  assert.ok(findings.includes(
    'releaseExceptions.pending[1].scope must be a non-empty string',
  ));
  assert.ok(findings.includes(
    'releaseExceptions.pending[1].status must equal pending-user-decision',
  ));
  assert.ok(findings.includes(
    'releaseExceptions.pending[1].reason must be a non-empty string',
  ));
  assert.ok(findings.includes('releaseExceptions.approved[0] must be an object'));
  assert.ok(findings.includes(
    'releaseExceptions.approved[1].id must be a stable non-empty identifier',
  ));
  assert.ok(findings.includes(
    'releaseExceptions.approved[1].scope must be a non-empty string',
  ));
  assert.ok(findings.includes(
    'releaseExceptions.approved[1].treatment must be a non-empty string',
  ));
  assert.ok(findings.includes(
    'releaseExceptions.approved[1].reason must be a non-empty string',
  ));
  assert.ok(findings.includes(
    'releaseExceptions.approved[1].status must equal approved',
  ));
  assert.ok(findings.includes(
    'releaseExceptions.approved[1].approvedBy must name the accountable approver',
  ));
  assert.ok(findings.includes(
    'releaseExceptions.approved[1].approvedAt is not a valid calendar date',
  ));
  assert.ok(findings.includes(
    'releaseExceptions.approved[1].evidenceRefs must contain at least one repository evidence file',
  ));
});

test('exception IDs cannot duplicate within or overlap between ledgers', () => {
  const manifest = createManifest();
  manifest.releaseExceptions.approved = [
    createApprovedException(),
    createApprovedException(),
  ];
  manifest.releaseExceptions.pending = [{
    id: 'approved-font-treatment',
    scope: 'Fonts/CooperBlackStd.otf',
    status: 'pending-user-decision',
    reason: 'Conflicting pending decision.',
  }];

  const findings = validatePublicReleaseManifest(manifest, { root: testRoot });
  assert.ok(findings.includes(
    'releaseExceptions.approved[1].id is duplicated: approved-font-treatment',
  ));
  assert.ok(findings.includes(
    'releaseExceptions.pending[0].id is duplicated: approved-font-treatment',
  ));
});

test('approved exception evidence must be safe, present, regular, and non-symlinked', () => {
  const manifest = createManifest();
  manifest.releaseExceptions.approved = [
    createApprovedException({
      id: 'unsafe-evidence-treatment',
      evidenceRefs: ['../outside'],
    }),
    createApprovedException({
      id: 'missing-evidence-treatment',
      evidenceRefs: ['rights/missing.txt'],
    }),
    createApprovedException({
      id: 'symlink-evidence-treatment',
      evidenceRefs: ['rights/approval-link.txt'],
    }),
  ];

  const findings = validatePublicReleaseManifest(manifest, { root: testRoot });
  assert.ok(findings.includes(
    'releaseExceptions.approved[0].evidenceRefs[0] must be a safe repository-relative path',
  ));
  assert.ok(findings.includes(
    'releaseExceptions.approved[1].evidenceRefs[0] does not resolve to an existing repository file',
  ));
  assert.ok(findings.includes(
    'releaseExceptions.approved[2].evidenceRefs[0] must resolve to a regular non-symlink file',
  ));
});

test('approved release exception with complete evidence passes', () => {
  const manifest = createManifest();
  manifest.releaseExceptions.approved = [createApprovedException()];
  assert.deepEqual(validatePublicReleaseManifest(manifest, { root: testRoot }), []);
});

test('approval dates reject impossible Gregorian dates', () => {
  for (const approvedAt of [
    '2026-00-15',
    '2026-13-15',
    '2026-01-00',
    '2026-02-29',
    '2026-02-30',
    '2026-02-31',
  ]) {
    const manifest = createManifest();
    manifest.releaseDecision.approvedAt = approvedAt;
    const findings = validatePublicReleaseManifest(manifest, { root: testRoot });
    assert.ok(
      findings.includes('releaseDecision.approvedAt is not a valid calendar date'),
      `${approvedAt} must be rejected`,
    );
  }
});

test('all approval surfaces accept a valid Gregorian leap date', () => {
  const manifest = createManifest();
  manifest.releaseDecision.approvedAt = '2028-02-29';
  for (const record of manifest.records) {
    record.approvedAt = '2028-02-29';
  }
  manifest.releaseExceptions.approved = [
    createApprovedException({ approvedAt: '2028-02-29' }),
  ];

  assert.deepEqual(validatePublicReleaseManifest(manifest, { root: testRoot }), []);
});

test('reconstruction manifest must remain clean-room and non-shipping', () => {
  writeFileSync(
    join(testRoot, 'release/recovered-reconstruction-manifest.json'),
    JSON.stringify({
      manifestId: 'pencil-blade-recovered-reconstruction',
      resourceCorpus: { stagingManifestSha256: 'not-a-digest' },
      implementation: { originalExecutableCodeIncluded: true },
      rights: { publicDistributionApproved: true },
    }),
  );

  const findings = validatePublicReleaseManifest(createManifest(), { root: testRoot });
  assert.ok(findings.includes(
    'reconstructionManifest does not describe the expected non-shipping clean-room reconstruction',
  ));
  assert.ok(findings.includes(
    'reconstructionManifest must pin the recovered staging manifest SHA-256',
  ));
});

function createManifest() {
  return {
    schemaVersion: 1,
    manifestId: 'pencil-blade-public-web-variant',
    target: {
      platform: 'web-mobile',
      distribution: 'github-pages',
      repositoryPrefix: '/pencil-blade-2026/',
    },
    reconstructionManifest: 'release/recovered-reconstruction-manifest.json',
    releaseDecision: {
      status: 'approved',
      approvedBy: 'Release reviewer',
      approvedAt: '2026-07-24',
      evidenceRefs: [evidencePath],
    },
    releaseExceptions: {
      approved: [],
      pending: [],
    },
    records: [
      'audio',
      'code',
      'engine-runtime',
      'fonts',
      'graphics',
      'name-trademark',
    ].map((category) => ({
      id: `${category}-record`,
      category,
      included: true,
      scope: `${category} fixture`,
      origin: 'test-fixture',
      rightsStatus: 'approved',
      license: 'fixture-license',
      rightsEvidenceRefs: [evidencePath],
      approver: 'Release reviewer',
      approvedAt: '2026-07-24',
      shipReady: true,
    })),
  };
}

function createApprovedException(overrides = {}) {
  return {
    id: 'approved-font-treatment',
    scope: 'Fonts/CooperBlackStd.otf',
    treatment: 'exclude from the public Web variant',
    status: 'approved',
    reason: 'The public variant omits the unsupported font with accountable approval.',
    approvedBy: 'Release reviewer',
    approvedAt: '2026-07-24',
    evidenceRefs: [evidencePath],
    ...overrides,
  };
}
