import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  prepareCandidateApprovalRequest,
  recordEnvironmentApprovalEvidence,
  runCli,
  validateCandidateApprovalRequest,
  validateDeploymentApprovalEvidence,
  verifyCandidateApprovalRequest,
} from '../scripts/case-study-approval.mjs';

const siteRequire = createRequire(new URL('../site/package.json', import.meta.url));
const Ajv2020 = siteRequire('ajv/dist/2020').default;
const approvalSchema = JSON.parse(readFileSync(
  new URL('../reference/case-study-approval.schema.json', import.meta.url),
  'utf8',
));
const validateApprovalSchema = new Ajv2020({
  allowUnionTypes: true,
  validateFormats: false,
}).compile(approvalSchema);

const digestA = 'a'.repeat(64);
const digestB = 'b'.repeat(64);
const releaseRecord = Object.freeze({
  schemaVersion: 1,
  commitSha: '1'.repeat(40),
  workflow: Object.freeze({
    runId: '91357',
    runAttempt: 2,
  }),
  content: Object.freeze({
    contentTreeDigest: digestA,
  }),
});
const requiredChecklistIds = Object.freeze([
  'owner-candidate-review',
  'editorial-factual-review',
  'vietnamese-factual-review',
  'rights-and-attribution-review',
  'accessibility-and-performance-review',
]);
const supportingReports = Object.freeze([
  'plans/260725-2334-pencil-blade-interactive-case-study/reports/candidate-audit.json',
  'plans/260725-2334-pencil-blade-interactive-case-study/reports/candidate-runtime.json',
]);

function prepare(overrides = {}) {
  return prepareCandidateApprovalRequest({
    releaseRecord,
    treeManifestDigestSha256: digestB,
    requestedAt: '2026-07-26T01:00:00.000Z',
    requiredChecklistIds,
    supportingReports,
    ...overrides,
  });
}

function providerRecord(overrides = {}) {
  return {
    authenticated: true,
    provider: 'github-actions-api',
    environment: 'github-pages',
    state: 'approved',
    reviewerId: 'release-owner',
    approvalObservedAt: '2026-07-26T02:00:00.000Z',
    sourceUrl: 'https://github.com/dantech0xff/pencil-blade-2026/actions/runs/91357',
    providerEventId: 712,
    workflowRunId: '91357',
    workflowRunAttempt: 2,
    deploymentWorkflowRunAttempt: 2,
    commitSha: '1'.repeat(40),
    contentTreeDigestSha256: digestA,
    treeManifestDigestSha256: digestB,
    deployment: {
      deploymentId: 4421,
      environment: 'github-pages',
      state: 'success',
      environmentUrl: 'https://dantech0xff.github.io/pencil-blade-2026/',
      sourceUrl: 'https://github.com/dantech0xff/pencil-blade-2026/deployments/4421',
    },
    ...overrides,
  };
}

test('preapproval request is deterministic, digest-bound, and contains no future event', () => {
  const request = prepare();
  assert.equal(request.recordType, 'candidate-approval-request');
  assert.equal(request.candidate.contentTreeDigestSha256, digestA);
  assert.equal(request.candidate.treeManifestDigestSha256, digestB);
  assert.equal(request.candidate.candidateArtifactName, 'case-study-candidate-91357-2');
  assert.ok(request.unresolvedChecks.every((check) =>
    check.state === 'pending-human-review'));
  assert.doesNotMatch(
    JSON.stringify(request),
    /approvedAt|reviewerId|providerEventId|deploymentId/u,
  );
  assert.deepEqual(prepare(), request);
  assert.doesNotThrow(() => validateCandidateApprovalRequest(request));
});

test('request verifier rejects changed run, commit, digest, role set, checks, and placeholders', () => {
  const request = prepare();
  const valid = {
    request,
    releaseRecord,
    treeManifestDigestSha256: digestB,
  };
  assert.doesNotThrow(() => verifyCandidateApprovalRequest(valid));

  for (const changedRelease of [
    { ...releaseRecord, commitSha: '2'.repeat(40) },
    { ...releaseRecord, workflow: { ...releaseRecord.workflow, runId: '91358' } },
    { ...releaseRecord, workflow: { ...releaseRecord.workflow, runAttempt: 3 } },
    { ...releaseRecord, content: { contentTreeDigest: 'c'.repeat(64) } },
  ]) {
    assert.throws(
      () => verifyCandidateApprovalRequest({
        ...valid,
        releaseRecord: changedRelease,
      }),
      /candidateArtifactName|does not match/u,
    );
  }
  assert.throws(
    () => verifyCandidateApprovalRequest({
      ...valid,
      treeManifestDigestSha256: 'd'.repeat(64),
    }),
    /does not match/u,
  );
  assert.throws(
    () => validateCandidateApprovalRequest({
      ...request,
      candidate: {
        ...request.candidate,
        candidateArtifactName: 'case-study-candidate-99999-1',
      },
    }),
    /candidateArtifactName/u,
  );
  assert.throws(
    () => validateCandidateApprovalRequest({
      ...request,
      requiredReviewerRoles: request.requiredReviewerRoles.slice(1),
    }),
    /requiredReviewerRoles/u,
  );
  assert.throws(
    () => validateCandidateApprovalRequest({
      ...request,
      unresolvedChecks: request.unresolvedChecks.map((check, index) =>
        index === 0 ? { ...check, state: 'passed' } : check),
    }),
    /cannot claim completed/u,
  );
  assert.throws(
    () => prepare({ supportingReports: ['TODO'] }),
    /non-placeholder/u,
  );
});

test('request rejects any field that tries to pre-record approval or deployment', () => {
  const request = prepare();
  for (const futureField of [
    ['environmentApproval', { state: 'approved' }],
    ['reviewerId', 'release-owner'],
    ['approvedAt', '2026-07-26T02:00:00.000Z'],
    ['deployment', { state: 'success' }],
  ]) {
    assert.throws(
      () => validateCandidateApprovalRequest({
        ...request,
        [futureField[0]]: futureField[1],
      }),
      /prohibited field/u,
    );
  }
});

test('post-event recorder requires authenticated approved history and blocks self-review by default', () => {
  const request = prepare();
  const args = {
    request,
    releaseRecord,
    treeManifestDigestSha256: digestB,
    workflowActorId: 'github-actions[bot]',
  };
  const evidence = recordEnvironmentApprovalEvidence({
    ...args,
    providerRecord: providerRecord(),
  });
  assert.equal(evidence.schemaVersion, 2);
  assert.equal(evidence.recordType, 'deployment-approval-evidence');
  assert.equal(evidence.review.reviewerId, 'release-owner');
  assert.equal(evidence.review.authorizationMode, 'independent-review');
  assert.equal(evidence.deployment.state, 'success');
  assert.equal(evidence.deployment.workflowRunAttempt, 2);
  assert.doesNotThrow(() => validateDeploymentApprovalEvidence(evidence, request));

  for (const [change, pattern] of [
    [{ authenticated: false }, /authenticated/u],
    [{ state: 'pending' }, /not approved/u],
    [{ reviewerId: 'github-actions[bot]' }, /self-attested/u],
    [{ approvalObservedAt: '2026-07-25T23:00:00.000Z' }, /predates/u],
    [{ workflowRunId: '99999' }, /different workflow/u],
    [{ contentTreeDigestSha256: 'e'.repeat(64) }, /digest/u],
    [{ deployment: { ...providerRecord().deployment, state: 'failure' } }, /successful/u],
  ]) {
    assert.throws(
      () => recordEnvironmentApprovalEvidence({
        ...args,
        providerRecord: providerRecord(change),
      }),
      pattern,
    );
  }
});

test('solo-owner mode explicitly permits authenticated self-review of the exact candidate', () => {
  const request = prepare();
  const evidence = recordEnvironmentApprovalEvidence({
    request,
    releaseRecord,
    treeManifestDigestSha256: digestB,
    providerRecord: providerRecord({ reviewerId: 'release-owner' }),
    workflowActorId: 'RELEASE-OWNER',
    allowSelfApproval: true,
  });

  assert.equal(evidence.review.reviewerId, 'release-owner');
  assert.equal(evidence.review.authorizationMode, 'solo-owner-self-review');
  assert.doesNotThrow(() => validateDeploymentApprovalEvidence(evidence, request));
});

test('generated solo-owner evidence conforms to the published JSON schema', () => {
  const request = prepare();
  const evidence = recordEnvironmentApprovalEvidence({
    request,
    releaseRecord,
    treeManifestDigestSha256: digestB,
    providerRecord: providerRecord({ reviewerId: 'release-owner' }),
    workflowActorId: 'release-owner',
    allowSelfApproval: true,
  });

  assert.equal(
    validateApprovalSchema(evidence),
    true,
    JSON.stringify(validateApprovalSchema.errors),
  );

  const invalidEvidence = {
    ...evidence,
    review: {
      ...evidence.review,
      authorizationMode: 'workflow-input',
    },
  };
  assert.equal(validateApprovalSchema(invalidEvidence), false);
});

test('post-event evidence permits a later deploy retry without changing candidate identity', () => {
  const request = prepare();
  const evidence = recordEnvironmentApprovalEvidence({
    request,
    releaseRecord,
    treeManifestDigestSha256: digestB,
    providerRecord: providerRecord({
      deploymentWorkflowRunAttempt: 3,
    }),
    workflowActorId: 'github-actions[bot]',
  });
  assert.equal(evidence.candidate.workflowRunAttempt, 2);
  assert.equal(evidence.deployment.workflowRunAttempt, 3);
  assert.doesNotThrow(() => validateDeploymentApprovalEvidence(evidence, request));
  assert.throws(
    () => recordEnvironmentApprovalEvidence({
      request,
      releaseRecord,
      treeManifestDigestSha256: digestB,
      providerRecord: providerRecord({
        deploymentWorkflowRunAttempt: 1,
      }),
      workflowActorId: 'github-actions[bot]',
    }),
    /predates the immutable workflow candidate/u,
  );
});

test('post-event evidence cannot bind a different approval request', () => {
  const request = prepare();
  const evidence = recordEnvironmentApprovalEvidence({
    request,
    releaseRecord,
    treeManifestDigestSha256: digestB,
    providerRecord: providerRecord(),
  });
  const otherRequest = prepare({
    requestedAt: '2026-07-26T01:05:00.000Z',
  });
  assert.throws(
    () => validateDeploymentApprovalEvidence(evidence, otherRequest),
    /does not bind/u,
  );
});

test('CLI accepts controlled runner-temp inputs and atomically refuses an existing output', () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'case-study-approval-cli-'));
  const releasePath = join(temporaryRoot, 'candidate', 'case-study-release.json');
  const outputPath = join(temporaryRoot, 'review', 'candidate-approval-request.json');
  const providerPath = join(temporaryRoot, 'review', 'provider-history.json');
  const evidencePath = join(temporaryRoot, 'review', 'deployment-approval-evidence.json');
  mkdirSync(join(temporaryRoot, 'candidate'));
  mkdirSync(join(temporaryRoot, 'review'));
  writeFileSync(releasePath, `${JSON.stringify(releaseRecord)}\n`);
  writeFileSync(
    providerPath,
    `${JSON.stringify(providerRecord({ reviewerId: 'release-owner' }))}\n`,
  );

  const arguments_ = [
    'prepare',
    '--release', releasePath,
    '--tree-manifest-digest', digestB,
    '--requested-at', '2026-07-26T01:00:00.000Z',
    ...requiredChecklistIds.flatMap((id) => ['--checklist', id]),
    '--report', 'plans/reports/candidate-audit.json',
    '--out', outputPath,
  ];
  assert.equal(runCli(arguments_), 0);
  const request = JSON.parse(readFileSync(outputPath, 'utf8'));
  assert.equal(request.candidate.candidateArtifactName, 'case-study-candidate-91357-2');
  assert.equal(runCli([
    'record-environment-evidence',
    '--release', releasePath,
    '--tree-manifest-digest', digestB,
    '--request', outputPath,
    '--provider-history', providerPath,
    '--workflow-actor', 'release-owner',
    '--allow-self-approval', 'true',
    '--out', evidencePath,
  ]), 0);
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  assert.equal(evidence.review.authorizationMode, 'solo-owner-self-review');
  assert.equal(runCli(arguments_), 1);
});
