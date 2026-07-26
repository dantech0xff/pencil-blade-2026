#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  linkSync,
  lstatSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const PLACEHOLDER_PATTERN = /\b(?:placeholder|replace-me|tbd|todo|unknown|n\/a)\b/iu;
const REQUEST_ARTIFACT_PREFIX = 'case-study-candidate';
const REQUIRED_REVIEWER_ROLES = Object.freeze([
  'project-owner',
  'editorial-reviewer',
  'vietnamese-factual-reviewer',
  'rights-reviewer',
]);

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function requireString(value, label, pattern) {
  if (typeof value !== 'string' || value.length === 0 || PLACEHOLDER_PATTERN.test(value)) {
    throw new Error(`${label} must be a non-placeholder string.`);
  }
  if (pattern && !pattern.test(value)) {
    throw new Error(`${label} has an invalid format.`);
  }
  return value;
}

function requireIsoDate(value, label) {
  requireString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)) {
    throw new Error(`${label} must be an explicit UTC ISO date-time.`);
  }
  return value;
}

function requireExactSet(values, expected, label) {
  if (!Array.isArray(values) || new Set(values).size !== values.length) {
    throw new Error(`${label} must be a unique array.`);
  }
  const actual = [...values].sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} does not match the frozen required set.`);
  }
  return Object.freeze([...actual]);
}

function safeRepositoryPath(pathValue, label) {
  requireString(pathValue, label);
  if (
    pathValue.startsWith('/')
    || pathValue.includes('\\')
    || pathValue.split('/').includes('..')
    || pathValue.includes('\0')
  ) {
    throw new Error(`${label} must be a repository-relative safe path.`);
  }
  return pathValue;
}

function releaseField(releaseRecord, names, label) {
  for (const path of names) {
    const segments = Array.isArray(path) ? path : [path];
    let value = releaseRecord;
    for (const segment of segments) {
      value = value?.[segment];
    }
    if (value !== undefined) {
      return value;
    }
  }
  throw new Error(`Release record is missing ${label}.`);
}

export function candidateIdentityFromRelease({
  releaseRecord,
  treeManifestDigestSha256,
  candidateArtifactName,
}) {
  if (!releaseRecord || typeof releaseRecord !== 'object' || Array.isArray(releaseRecord)) {
    throw new Error('Release record must be an object.');
  }
  const commitSha = String(
    releaseField(releaseRecord, ['commitSha', 'sourceCommitSha', 'commit'], 'commit SHA'),
  );
  const workflowRunId = String(
    releaseField(
      releaseRecord,
      [['workflow', 'runId'], 'workflowRunId', 'runId'],
      'workflow run ID',
    ),
  );
  const workflowRunAttempt = Number(
    releaseField(
      releaseRecord,
      [['workflow', 'runAttempt'], 'workflowRunAttempt', 'runAttempt'],
      'workflow run attempt',
    ),
  );
  const contentTreeDigestSha256 = String(
    releaseField(
      releaseRecord,
      [['content', 'contentTreeDigest'], 'contentTreeDigestSha256', 'contentTreeDigest'],
      'content-tree digest',
    ),
  );

  requireString(commitSha, 'candidate.commitSha', COMMIT_PATTERN);
  if (!/^[1-9][0-9]*$/u.test(workflowRunId)) {
    throw new Error('candidate.workflowRunId must be a positive integer string.');
  }
  if (!Number.isInteger(workflowRunAttempt) || workflowRunAttempt < 1) {
    throw new Error('candidate.workflowRunAttempt must be a positive integer.');
  }
  const expectedArtifactName =
    `${REQUEST_ARTIFACT_PREFIX}-${workflowRunId}-${workflowRunAttempt}`;
  candidateArtifactName ??= expectedArtifactName;
  if (candidateArtifactName !== expectedArtifactName) {
    throw new Error(`candidateArtifactName must be ${expectedArtifactName}.`);
  }
  requireString(
    contentTreeDigestSha256,
    'candidate.contentTreeDigestSha256',
    DIGEST_PATTERN,
  );
  requireString(
    treeManifestDigestSha256,
    'candidate.treeManifestDigestSha256',
    DIGEST_PATTERN,
  );

  return Object.freeze({
    commitSha,
    workflowRunId,
    workflowRunAttempt,
    candidateArtifactName,
    contentTreeDigestSha256,
    treeManifestDigestSha256,
  });
}

export function validateCandidateApprovalRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new Error('Candidate approval request must be an object.');
  }
  const allowedKeys = new Set([
    'schemaVersion',
    'recordType',
    'requestId',
    'requestedAt',
    'candidate',
    'requiredReviewerRoles',
    'requiredChecklistIds',
    'supportingReports',
    'unresolvedChecks',
  ]);
  for (const key of Object.keys(request)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Candidate approval request contains prohibited field ${key}.`);
    }
  }
  if (request.schemaVersion !== 1 || request.recordType !== 'candidate-approval-request') {
    throw new Error('Unsupported candidate approval request schema or record type.');
  }
  requireString(request.requestId, 'requestId', /^case-study-approval-[a-f0-9]{16}$/u);
  requireIsoDate(request.requestedAt, 'requestedAt');
  const candidate = candidateIdentityFromRelease({
    releaseRecord: request.candidate,
    treeManifestDigestSha256: request.candidate?.treeManifestDigestSha256,
    candidateArtifactName: request.candidate?.candidateArtifactName,
  });
  requireExactSet(
    request.requiredReviewerRoles,
    REQUIRED_REVIEWER_ROLES,
    'requiredReviewerRoles',
  );
  if (
    !Array.isArray(request.requiredChecklistIds)
    || request.requiredChecklistIds.length === 0
    || new Set(request.requiredChecklistIds).size !== request.requiredChecklistIds.length
  ) {
    throw new Error('requiredChecklistIds must be a non-empty unique array.');
  }
  request.requiredChecklistIds.forEach((id) =>
    requireString(id, 'requiredChecklistIds entry', ID_PATTERN));
  if (
    !Array.isArray(request.supportingReports)
    || request.supportingReports.length === 0
    || new Set(request.supportingReports).size !== request.supportingReports.length
  ) {
    throw new Error('supportingReports must be a non-empty unique array.');
  }
  request.supportingReports.forEach((path) =>
    safeRepositoryPath(path, 'supportingReports entry'));
  if (
    !Array.isArray(request.unresolvedChecks)
    || request.unresolvedChecks.length === 0
  ) {
    throw new Error('unresolvedChecks must contain the pending human checks.');
  }
  const unresolvedIds = new Set();
  for (const check of request.unresolvedChecks) {
    if (
      !check
      || typeof check !== 'object'
      || Array.isArray(check)
      || Object.keys(check).sort().join(',') !== 'id,state'
    ) {
      throw new Error('Each unresolved check must contain only id and state.');
    }
    requireString(check.id, 'unresolvedChecks.id', ID_PATTERN);
    if (check.state !== 'pending-human-review') {
      throw new Error('Approval requests cannot claim completed human checks.');
    }
    if (unresolvedIds.has(check.id)) {
      throw new Error(`Duplicate unresolved check ${check.id}.`);
    }
    unresolvedIds.add(check.id);
  }
  if (
    JSON.stringify([...unresolvedIds].sort())
    !== JSON.stringify([...request.requiredChecklistIds].sort())
  ) {
    throw new Error('unresolvedChecks must exactly match requiredChecklistIds.');
  }
  const expectedRequestId = `case-study-approval-${sha256(canonicalJson({
    candidate,
    requestedAt: request.requestedAt,
    requiredReviewerRoles: [...request.requiredReviewerRoles].sort(),
    requiredChecklistIds: [...request.requiredChecklistIds].sort(),
    supportingReports: [...request.supportingReports].sort(),
  })).slice(0, 16)}`;
  if (request.requestId !== expectedRequestId) {
    throw new Error('requestId does not match the immutable request inputs.');
  }
  return Object.freeze({ ...request, candidate });
}

export function prepareCandidateApprovalRequest({
  releaseRecord,
  treeManifestDigestSha256,
  requestedAt,
  requiredChecklistIds,
  supportingReports,
  requiredReviewerRoles = REQUIRED_REVIEWER_ROLES,
  candidateArtifactName,
}) {
  requireIsoDate(requestedAt, 'requestedAt');
  const candidate = candidateIdentityFromRelease({
    releaseRecord,
    treeManifestDigestSha256,
    candidateArtifactName,
  });
  const roles = requireExactSet(
    requiredReviewerRoles,
    REQUIRED_REVIEWER_ROLES,
    'requiredReviewerRoles',
  );
  if (!Array.isArray(requiredChecklistIds) || requiredChecklistIds.length === 0) {
    throw new Error('requiredChecklistIds must be non-empty.');
  }
  const checkIds = [...new Set(requiredChecklistIds)].sort();
  if (checkIds.length !== requiredChecklistIds.length) {
    throw new Error('requiredChecklistIds cannot contain duplicates.');
  }
  checkIds.forEach((id) => requireString(id, 'requiredChecklistIds entry', ID_PATTERN));
  if (!Array.isArray(supportingReports) || supportingReports.length === 0) {
    throw new Error('supportingReports must be non-empty.');
  }
  const reports = [...new Set(supportingReports)].sort();
  if (reports.length !== supportingReports.length) {
    throw new Error('supportingReports cannot contain duplicates.');
  }
  reports.forEach((path) => safeRepositoryPath(path, 'supportingReports entry'));

  const requestIdentity = {
    candidate,
    requestedAt,
    requiredReviewerRoles: [...roles],
    requiredChecklistIds: checkIds,
    supportingReports: reports,
  };
  const request = {
    schemaVersion: 1,
    recordType: 'candidate-approval-request',
    requestId: `case-study-approval-${sha256(canonicalJson(requestIdentity)).slice(0, 16)}`,
    requestedAt,
    candidate,
    requiredReviewerRoles: [...roles],
    requiredChecklistIds: checkIds,
    supportingReports: reports,
    unresolvedChecks: checkIds.map((id) => ({
      id,
      state: 'pending-human-review',
    })),
  };
  return validateCandidateApprovalRequest(request);
}

export function verifyCandidateApprovalRequest({
  request,
  releaseRecord,
  treeManifestDigestSha256,
  requiredChecklistIds = request?.requiredChecklistIds,
  supportingReports = request?.supportingReports,
}) {
  const validated = validateCandidateApprovalRequest(request);
  const expectedCandidate = candidateIdentityFromRelease({
    releaseRecord,
    treeManifestDigestSha256,
    candidateArtifactName: validated.candidate.candidateArtifactName,
  });
  if (canonicalJson(validated.candidate) !== canonicalJson(expectedCandidate)) {
    throw new Error('Approval request candidate identity does not match the release record.');
  }
  requireExactSet(
    validated.requiredChecklistIds,
    requiredChecklistIds,
    'requiredChecklistIds',
  );
  requireExactSet(validated.supportingReports, supportingReports, 'supportingReports');
  return validated;
}

export function recordEnvironmentApprovalEvidence({
  request,
  releaseRecord,
  treeManifestDigestSha256,
  providerRecord,
  workflowActorId,
}) {
  const validatedRequest = verifyCandidateApprovalRequest({
    request,
    releaseRecord,
    treeManifestDigestSha256,
  });
  if (
    !providerRecord
    || typeof providerRecord !== 'object'
    || providerRecord.authenticated !== true
    || providerRecord.provider !== 'github-actions-api'
  ) {
    throw new Error('Post-event evidence requires authenticated GitHub Actions API history.');
  }
  if (providerRecord.environment !== 'github-pages') {
    throw new Error('Approval evidence must come from the github-pages environment.');
  }
  if (providerRecord.state !== 'approved') {
    throw new Error('Environment review history is not approved.');
  }
  const reviewerId = requireString(providerRecord.reviewerId, 'reviewerId');
  if (workflowActorId && reviewerId === workflowActorId) {
    throw new Error('Environment approval cannot be self-attested by the workflow actor.');
  }
  const approvalObservedAt = requireIsoDate(
    providerRecord.approvalObservedAt,
    'approvalObservedAt',
  );
  if (Date.parse(approvalObservedAt) < Date.parse(validatedRequest.requestedAt)) {
    throw new Error('Environment approval observation predates the candidate approval request.');
  }
  const sourceUrl = requireString(
    providerRecord.sourceUrl,
    'review sourceUrl',
    /^https:\/\/github\.com\//u,
  );
  if (
    String(providerRecord.workflowRunId) !== validatedRequest.candidate.workflowRunId
    || Number(providerRecord.workflowRunAttempt)
      !== validatedRequest.candidate.workflowRunAttempt
    || providerRecord.commitSha !== validatedRequest.candidate.commitSha
  ) {
    throw new Error('Authenticated review history refers to a different workflow candidate.');
  }
  const deploymentWorkflowRunAttempt = Number(
    providerRecord.deploymentWorkflowRunAttempt,
  );
  if (
    !Number.isInteger(deploymentWorkflowRunAttempt)
    || deploymentWorkflowRunAttempt < validatedRequest.candidate.workflowRunAttempt
  ) {
    throw new Error(
      'Authenticated deployment attempt predates the immutable workflow candidate.',
    );
  }
  if (
    providerRecord.contentTreeDigestSha256
      !== validatedRequest.candidate.contentTreeDigestSha256
    || providerRecord.treeManifestDigestSha256
      !== validatedRequest.candidate.treeManifestDigestSha256
  ) {
    throw new Error('Authenticated review history digest does not match the candidate.');
  }

  const deployment = providerRecord.deployment;
  if (
    !deployment
    || deployment.state !== 'success'
    || deployment.environment !== 'github-pages'
  ) {
    throw new Error('A successful github-pages deployment record is required.');
  }
  requireString(String(deployment.deploymentId), 'deploymentId');
  requireString(deployment.environmentUrl, 'environmentUrl', /^https:\/\//u);
  requireString(deployment.sourceUrl, 'deployment sourceUrl', /^https:\/\/github\.com\//u);

  return Object.freeze({
    schemaVersion: 1,
    recordType: 'deployment-approval-evidence',
    requestId: validatedRequest.requestId,
    candidate: validatedRequest.candidate,
    environment: 'github-pages',
    review: {
      provider: 'github-actions-api',
      state: 'approved',
      reviewerId,
      approvalObservedAt,
      sourceUrl,
      ...(providerRecord.providerEventId === undefined
        ? {}
        : { providerEventId: providerRecord.providerEventId }),
    },
    deployment: {
      deploymentId: deployment.deploymentId,
      workflowRunAttempt: deploymentWorkflowRunAttempt,
      state: 'success',
      environmentUrl: deployment.environmentUrl,
      sourceUrl: deployment.sourceUrl,
    },
  });
}

export function validateDeploymentApprovalEvidence(evidence, request) {
  if (
    !evidence
    || typeof evidence !== 'object'
    || evidence.schemaVersion !== 1
    || evidence.recordType !== 'deployment-approval-evidence'
  ) {
    throw new Error('Invalid deployment approval evidence record.');
  }
  const validatedRequest = validateCandidateApprovalRequest(request);
  if (
    evidence.requestId !== validatedRequest.requestId
    || canonicalJson(evidence.candidate) !== canonicalJson(validatedRequest.candidate)
  ) {
    throw new Error('Deployment approval evidence does not bind the approval request.');
  }
  if (
    evidence.environment !== 'github-pages'
    || evidence.review?.provider !== 'github-actions-api'
    || evidence.review?.state !== 'approved'
    || evidence.deployment?.state !== 'success'
  ) {
    throw new Error('Deployment approval evidence is not an approved successful Pages event.');
  }
  requireString(evidence.review.reviewerId, 'reviewerId');
  requireIsoDate(evidence.review.approvalObservedAt, 'approvalObservedAt');
  requireString(evidence.review.sourceUrl, 'review sourceUrl', /^https:\/\/github\.com\//u);
  if (
    !Number.isInteger(evidence.deployment?.workflowRunAttempt)
    || evidence.deployment.workflowRunAttempt
      < validatedRequest.candidate.workflowRunAttempt
  ) {
    throw new Error('Deployment workflow attempt does not bind the immutable candidate.');
  }
  requireString(evidence.deployment.environmentUrl, 'environmentUrl', /^https:\/\//u);
  requireString(
    evidence.deployment.sourceUrl,
    'deployment sourceUrl',
    /^https:\/\/github\.com\//u,
  );
  return evidence;
}

function explicitPath(pathValue, label) {
  if (
    typeof pathValue !== 'string'
    || pathValue.length === 0
    || pathValue.includes('\0')
  ) {
    throw new Error(`${label} must be an explicit filesystem path.`);
  }
  return resolve(pathValue);
}

function readJson(pathValue) {
  const input = explicitPath(pathValue, 'JSON input');
  const metadata = lstatSync(input);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`JSON input must be a regular, non-symlink file: ${pathValue}`);
  }
  return JSON.parse(readFileSync(realpathSync(input), 'utf8'));
}

function writeJsonAtomic(pathValue, value) {
  const requestedOutput = explicitPath(pathValue, 'JSON output');
  const requestedParent = dirname(requestedOutput);
  const parentMetadata = lstatSync(requestedParent);
  if (parentMetadata.isSymbolicLink() || !parentMetadata.isDirectory()) {
    throw new Error(`JSON output parent must be a regular, non-symlink directory: ${requestedParent}`);
  }
  const parent = realpathSync(requestedParent);
  const output = resolve(parent, basename(requestedOutput));
  if (existsSync(output)) {
    throw new Error(`JSON output already exists: ${output}`);
  }
  const temporary = resolve(parent, `.${basename(output)}.tmp-${process.pid}-${randomUUID()}`);
  try {
    writeFileSync(temporary, canonicalJson(value), { flag: 'wx' });
    linkSync(temporary, output);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function parseArguments(arguments_) {
  const [command, ...rest] = arguments_;
  const options = { command, checklist: [], report: [] };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected argument ${argument}.`);
    }
    const key = argument.slice(2).replaceAll('-', '_');
    const value = rest[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${argument} requires a value.`);
    }
    if (key === 'checklist' || key === 'report') {
      options[key].push(value);
    } else {
      options[key] = value;
    }
    index += 1;
  }
  return options;
}

export function runCli(arguments_ = process.argv.slice(2)) {
  try {
    const options = parseArguments(arguments_);
    const releaseRecord = readJson(options.release);
    if (options.command === 'prepare') {
      const request = prepareCandidateApprovalRequest({
        releaseRecord,
        treeManifestDigestSha256: options.tree_manifest_digest,
        requestedAt: options.requested_at,
        requiredChecklistIds: options.checklist,
        supportingReports: options.report,
      });
      writeJsonAtomic(options.out, request);
      process.stdout.write(
        `Prepared candidate approval request ${request.requestId}; no approval event recorded.\n`,
      );
      return 0;
    }
    const request = readJson(options.request);
    if (options.command === 'verify') {
      verifyCandidateApprovalRequest({
        request,
        releaseRecord,
        treeManifestDigestSha256: options.tree_manifest_digest,
      });
      process.stdout.write('Candidate approval request verification passed.\n');
      return 0;
    }
    if (options.command === 'record-environment-evidence') {
      const evidence = recordEnvironmentApprovalEvidence({
        request,
        releaseRecord,
        treeManifestDigestSha256: options.tree_manifest_digest,
        providerRecord: readJson(options.provider_history),
        workflowActorId: options.workflow_actor,
      });
      writeJsonAtomic(options.out, evidence);
      process.stdout.write('Recorded authenticated deployment approval evidence.\n');
      return 0;
    }
    throw new Error(
      'Expected command prepare, verify, or record-environment-evidence.',
    );
  } catch (error) {
    process.stderr.write(`CASE_STUDY_APPROVAL_ERROR: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli();
}
