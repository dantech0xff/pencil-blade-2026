#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_CATEGORIES = Object.freeze([
  'audio',
  'code',
  'engine-runtime',
  'fonts',
  'graphics',
  'name-trademark',
]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const STABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

export function validatePublicReleaseManifest(manifest, options = {}) {
  const root = resolve(options.root ?? process.cwd());
  const findings = [];

  if (!isRecord(manifest)) {
    return Object.freeze(['manifest must be a JSON object']);
  }
  if (manifest.schemaVersion !== 1) {
    findings.push('schemaVersion must equal 1');
  }
  if (manifest.manifestId !== 'pencil-blade-public-web-variant') {
    findings.push('manifestId must identify the Pencil Blade public Web variant');
  }
  if (
    manifest.target?.platform !== 'web-mobile'
    || manifest.target?.distribution !== 'github-pages'
    || manifest.target?.repositoryPrefix !== '/pencil-blade-2026/'
  ) {
    findings.push('target must be the Web Mobile GitHub Pages project prefix');
  }

  const decision = manifest.releaseDecision;
  if (!isRecord(decision) || decision.status !== 'approved') {
    findings.push('releaseDecision.status must equal approved');
  }
  validateApproval(decision, 'releaseDecision', root, findings);
  validateReleaseExceptions(manifest.releaseExceptions, root, findings);

  if (!Array.isArray(manifest.records) || manifest.records.length === 0) {
    findings.push('records must be a non-empty array');
    return Object.freeze(findings);
  }

  const seenIds = new Set();
  const seenCategories = new Set();
  for (const [index, record] of manifest.records.entries()) {
    const label = `records[${index}]`;
    if (!isRecord(record)) {
      findings.push(`${label} must be an object`);
      continue;
    }
    if (typeof record.id !== 'string' || record.id.length === 0) {
      findings.push(`${label}.id must be a non-empty string`);
    } else if (seenIds.has(record.id)) {
      findings.push(`${label}.id is duplicated: ${record.id}`);
    } else {
      seenIds.add(record.id);
    }
    if (!REQUIRED_CATEGORIES.includes(record.category)) {
      findings.push(`${label}.category is not recognized`);
    } else {
      seenCategories.add(record.category);
    }
    if (record.included !== true) {
      findings.push(`${label}.included must equal true for the built public variant`);
    }
    if (typeof record.scope !== 'string' || record.scope.length === 0) {
      findings.push(`${label}.scope must be a non-empty string`);
    }
    if (typeof record.origin !== 'string' || record.origin.length === 0) {
      findings.push(`${label}.origin must be a non-empty string`);
    }
    if (record.rightsStatus !== 'approved') {
      findings.push(`${label}.rightsStatus must equal approved`);
    }
    if (typeof record.license !== 'string' || record.license.length === 0) {
      findings.push(`${label}.license must be a non-empty string`);
    }
    if (record.shipReady !== true) {
      findings.push(`${label}.shipReady must equal true`);
    }
    validateApproval(record, label, root, findings, 'rightsEvidenceRefs', 'approver');
  }

  for (const category of REQUIRED_CATEGORIES) {
    if (!seenCategories.has(category)) {
      findings.push(`missing required rights category: ${category}`);
    }
  }

  validateReconstructionManifest(manifest.reconstructionManifest, root, findings);
  return Object.freeze(findings);
}

function validateReleaseExceptions(releaseExceptions, root, findings) {
  if (!isRecord(releaseExceptions)) {
    findings.push('releaseExceptions must be an object');
    return;
  }

  const seenIds = new Set();
  validateApprovedExceptions(releaseExceptions.approved, seenIds, root, findings);
  validatePendingExceptions(releaseExceptions.pending, seenIds, findings);
}

function validateApprovedExceptions(approved, seenIds, root, findings) {
  if (!Array.isArray(approved)) {
    findings.push('releaseExceptions.approved must be an array');
    return;
  }

  for (const [index, exception] of approved.entries()) {
    const label = `releaseExceptions.approved[${index}]`;
    if (!isRecord(exception)) {
      findings.push(`${label} must be an object`);
      continue;
    }

    validateExceptionIdentity(exception, label, seenIds, findings);
    validateNonEmptyString(exception.scope, `${label}.scope`, findings);
    validateNonEmptyString(exception.treatment, `${label}.treatment`, findings);
    validateNonEmptyString(exception.reason, `${label}.reason`, findings);
    if (exception.status !== 'approved') {
      findings.push(`${label}.status must equal approved`);
    }
    validateApproval(exception, label, root, findings);
  }
}

function validatePendingExceptions(pending, seenIds, findings) {
  if (!Array.isArray(pending)) {
    findings.push('releaseExceptions.pending must be an array');
    return;
  }
  if (pending.length > 0) {
    findings.push('releaseExceptions.pending must be empty before public release');
  }

  for (const [index, exception] of pending.entries()) {
    const label = `releaseExceptions.pending[${index}]`;
    if (!isRecord(exception)) {
      findings.push(`${label} must be an object`);
      continue;
    }

    validateExceptionIdentity(exception, label, seenIds, findings);
    validateNonEmptyString(exception.scope, `${label}.scope`, findings);
    validateNonEmptyString(exception.reason, `${label}.reason`, findings);
    if (exception.status !== 'pending-user-decision') {
      findings.push(`${label}.status must equal pending-user-decision`);
    }
  }
}

function validateExceptionIdentity(exception, label, seenIds, findings) {
  if (typeof exception.id !== 'string' || !STABLE_ID.test(exception.id)) {
    findings.push(`${label}.id must be a stable non-empty identifier`);
    return;
  }
  if (seenIds.has(exception.id)) {
    findings.push(`${label}.id is duplicated: ${exception.id}`);
    return;
  }
  seenIds.add(exception.id);
}

function validateNonEmptyString(value, label, findings) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    findings.push(`${label} must be a non-empty string`);
  }
}

function validateApproval(
  record,
  label,
  root,
  findings,
  evidenceField = 'evidenceRefs',
  approverField = 'approvedBy',
) {
  if (
    typeof record[approverField] !== 'string'
    || record[approverField].trim().length === 0
  ) {
    findings.push(`${label}.${approverField} must name the accountable approver`);
  }
  if (typeof record.approvedAt !== 'string' || !ISO_DATE.test(record.approvedAt)) {
    findings.push(`${label}.approvedAt must use YYYY-MM-DD`);
  } else if (!isValidCalendarDate(record.approvedAt)) {
    findings.push(`${label}.approvedAt is not a valid calendar date`);
  }

  const evidenceRefs = record[evidenceField];
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0) {
    findings.push(`${label}.${evidenceField} must contain at least one repository evidence file`);
    return;
  }
  for (const [index, evidenceRef] of evidenceRefs.entries()) {
    validateEvidenceRef(evidenceRef, `${label}.${evidenceField}[${index}]`, root, findings);
  }
}

function isValidCalendarDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function validateEvidenceRef(evidenceRef, label, root, findings) {
  if (
    typeof evidenceRef !== 'string'
    || evidenceRef.length === 0
    || isAbsolute(evidenceRef)
    || evidenceRef.includes('\\')
    || evidenceRef.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    findings.push(`${label} must be a safe repository-relative path`);
    return;
  }

  const absolutePath = resolve(root, evidenceRef);
  if (!isInsideRoot(root, absolutePath) || !existsSync(absolutePath)) {
    findings.push(`${label} does not resolve to an existing repository file`);
    return;
  }
  if (lstatSync(absolutePath).isSymbolicLink() || !lstatSync(absolutePath).isFile()) {
    findings.push(`${label} must resolve to a regular non-symlink file`);
    return;
  }
  if (!isInsideRoot(realpathSync(root), realpathSync(absolutePath))) {
    findings.push(`${label} resolves outside the repository`);
  }
}

function validateReconstructionManifest(manifestRef, root, findings) {
  const label = 'reconstructionManifest';
  if (
    typeof manifestRef !== 'string'
    || isAbsolute(manifestRef)
    || manifestRef.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    findings.push(`${label} must be a safe repository-relative path`);
    return;
  }
  const manifestPath = resolve(root, manifestRef);
  if (!isInsideRoot(root, manifestPath) || !existsSync(manifestPath)) {
    findings.push(`${label} does not exist`);
    return;
  }

  let recovered;
  try {
    recovered = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    findings.push(`${label} is not valid JSON: ${error.message}`);
    return;
  }
  if (
    recovered?.manifestId !== 'pencil-blade-recovered-reconstruction'
    || recovered?.rights?.publicDistributionApproved !== false
    || recovered?.implementation?.originalExecutableCodeIncluded !== false
  ) {
    findings.push(`${label} does not describe the expected non-shipping clean-room reconstruction`);
  }
  const stagingDigest = recovered?.resourceCorpus?.stagingManifestSha256;
  if (typeof stagingDigest !== 'string' || !SHA256.test(stagingDigest)) {
    findings.push(`${label} must pin the recovered staging manifest SHA-256`);
  }
}

function isInsideRoot(root, candidate) {
  const relativePath = relative(root, candidate);
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readManifest(manifestPath) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`unable to read rights manifest: ${error.message}`);
  }
  return manifest;
}

function parseArguments(argv) {
  let manifestPath = 'release/public-release-variant-manifest.json';
  let root = process.cwd();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--manifest' && argv[index + 1]) {
      manifestPath = argv[index + 1];
      index += 1;
    } else if (argument === '--root' && argv[index + 1]) {
      root = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`unknown or incomplete argument: ${argument}`);
    }
  }
  return Object.freeze({ manifestPath, root });
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const root = resolve(options.root);
  const manifestPath = resolve(root, options.manifestPath);
  const findings = validatePublicReleaseManifest(readManifest(manifestPath), { root });
  if (findings.length > 0) {
    console.error('Public release rights gate: BLOCKED');
    for (const finding of findings) {
      console.error(`- ${finding}`);
    }
    process.exitCode = 1;
    return;
  }
  const digest = createHash('sha256').update(readFileSync(manifestPath)).digest('hex');
  console.log(`Public release rights gate: APPROVED (${digest})`);
}

const isCli = process.argv[1]
  && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isCli) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
