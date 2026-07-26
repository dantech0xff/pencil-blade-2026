#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const DEFAULT_MANIFEST = 'reference/case-study-publication-manifest.json';
const CANONICAL_LEDGER = 'forensics/claims.jsonl';
const SOURCE_CATALOG = 'reference/case-study-public-source-catalog.json';

const AUTHORITATIVE_CLAIM_FIELDS = new Set([
  'status',
  'evidenceTier',
  'confidence',
  'evidenceRefs',
  'contradictionIds',
  'contractEligible',
  'claim',
  'reviewer',
  'reviewDate',
  'notes',
]);

const ALLOWED_PRESENTATION_FIELDS = new Set([
  'canonicalClaimId',
  'order',
  'publicCopy',
  'copy',
  'publicExcerpt',
  'publicExplanation',
  'displayQualifier',
  'tags',
  'redaction',
  'publicSourceIds',
]);

const FIELD_AUTHORITIES = Object.freeze({
  canonicalClaims: Object.freeze({
    path: CANONICAL_LEDGER,
    fields: [
      'claim',
      'status',
      'evidenceTier',
      'confidence',
      'evidenceRefs',
      'contradictionIds',
      'contractEligible',
    ],
  }),
  nativeCounters: Object.freeze({
    path: 'forensics/native/function-enrichment-summary.json',
  }),
  resourceInventory: Object.freeze({
    path: 'forensics/resources/resource-usage-map.json',
  }),
  resourceReconciliation: Object.freeze({
    path: 'assets/catalog/resource-reconciliation-ledger.json',
  }),
  fidelity: Object.freeze({
    path: 'forensics/fidelity/fidelity-report-v1.json',
  }),
  residuals: Object.freeze({
    path: 'forensics/fidelity/residual-gap-ledger.json',
  }),
  commercialRights: Object.freeze({
    path: 'release/public-release-variant-manifest.json',
  }),
  academicDisplay: Object.freeze({
    path: 'reference/case-study-academic-display-decision.json',
  }),
});

const DENIED_PATH_SEGMENTS = [
  '.forensics-work',
  'offline-evidence',
  'jadx-output',
  'apktool-output',
  'reference/historical-media/raw',
  'reference/external-material',
];

const DENIED_PUBLIC_EXTENSIONS = new Set([
  '.apk',
  '.apks',
  '.xapk',
  '.so',
  '.gpr',
  '.i64',
  '.idb',
  '.jks',
  '.keystore',
]);

const PRIVATE_CONTENT_PATTERNS = [
  /(?:^|[\s"'(])\/Users\/[^/\s]+/mu,
  /(?:^|[\s"'(])\/home\/[^/\s]+/mu,
  /[A-Za-z]:\\Users\\/u,
  /(?:^|[/\\])\.forensics-work(?:[/\\]|$)/mu,
  /(?:^|[/\\])(?:jadx-output|apktool-output)(?:[/\\]|$)/mu,
  /(?:authorization|bearer)\s*[:=]\s*[^\s,;]+/iu,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
];

const RAW_AI_KEYS = new Set([
  'rawchat',
  'rawchats',
  'rawtranscript',
  'transcript',
  'prompt',
  'prompts',
  'systemprompt',
  'hiddenprompt',
  'chainofthought',
  'cot',
  'hiddencot',
]);

function finding(code, pointer, message) {
  return { code, path: pointer, message };
}

function sortFindings(findings) {
  return findings.sort((left, right) =>
    `${left.code}\0${left.path}\0${left.message}`.localeCompare(
      `${right.code}\0${right.path}\0${right.message}`,
    ));
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function readJson(repositoryPath) {
  return JSON.parse(readFileSync(resolveRepositoryPath(repositoryPath), 'utf8'));
}

function readClaims() {
  return readFileSync(resolveRepositoryPath(CANONICAL_LEDGER), 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function extensionOf(repositoryPath) {
  const basename = repositoryPath.split('/').at(-1) ?? '';
  const dot = basename.lastIndexOf('.');
  return dot >= 0 ? basename.slice(dot).toLowerCase() : '';
}

function isDeniedPublicPath(repositoryPath) {
  const normalized = repositoryPath.replaceAll('\\', '/');
  return DENIED_PATH_SEGMENTS.some(
    (segment) =>
      normalized === segment
      || normalized.startsWith(`${segment}/`)
      || normalized.includes(`/${segment}/`),
  ) || DENIED_PUBLIC_EXTENSIONS.has(extensionOf(normalized));
}

function resolveRepositoryPath(repositoryPath, { requireExisting = true } = {}) {
  if (
    typeof repositoryPath !== 'string'
    || repositoryPath.length === 0
    || isAbsolute(repositoryPath)
    || repositoryPath.includes('\0')
  ) {
    throw new Error('path must be a non-empty repository-relative string');
  }

  const normalized = repositoryPath.replaceAll('\\', '/');
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '..' || segment === '')) {
    throw new Error('path traversal and empty path segments are not allowed');
  }

  const absolutePath = resolve(REPOSITORY_ROOT, normalized);
  const relativePath = relative(REPOSITORY_ROOT, absolutePath);
  if (
    relativePath === '..'
    || relativePath.startsWith(`..${sep}`)
    || isAbsolute(relativePath)
  ) {
    throw new Error('path escapes the repository root');
  }

  if (requireExisting) {
    const metadata = lstatSync(absolutePath);
    if (metadata.isSymbolicLink()) {
      throw new Error('symbolic links are not allowed');
    }
    const realPath = realpathSync(absolutePath);
    const realRelative = relative(REPOSITORY_ROOT, realPath);
    if (
      realRelative === '..'
      || realRelative.startsWith(`..${sep}`)
      || isAbsolute(realRelative)
    ) {
      throw new Error('resolved path escapes the repository root');
    }
  }

  return absolutePath;
}

function hasLocalePair(value) {
  return value
    && typeof value === 'object'
    && typeof value.en === 'string'
    && value.en.trim().length > 0
    && typeof value.vi === 'string'
    && value.vi.trim().length > 0;
}

function collectForbiddenAiKeys(value, pointer = '$', output = []) {
  if (!value || typeof value !== 'object') {
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replaceAll(/[^a-z]/gu, '');
    const childPointer = `${pointer}.${key}`;
    if (RAW_AI_KEYS.has(normalizedKey)) {
      output.push(childPointer);
    }
    collectForbiddenAiKeys(child, childPointer, output);
  }
  return output;
}

function containsUnsupportedHumanWording(value) {
  const text = JSON.stringify(value);
  return /\bhuman[- ](?:reviewed|accepted|rejected)\b/iu.test(text);
}

export function resolveFieldAuthority(fieldId, authorityMap = FIELD_AUTHORITIES) {
  const authority = authorityMap[fieldId];
  if (!authority) {
    return {
      finding: finding(
        'UNKNOWN_FIELD_AUTHORITY',
        `$.fieldAuthority.${fieldId}`,
        `No field authority is registered for ${fieldId}.`,
      ),
      authority: null,
    };
  }
  return { authority, finding: null };
}

export function validateClaimPresentation(record, canonicalClaim, options = {}) {
  const pointer = options.pointer ?? '$.claimPresentations[]';
  const findings = [];

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return [finding('INVALID_CLAIM_PRESENTATION', pointer, 'Record must be an object.')];
  }

  for (const field of Object.keys(record)) {
    if (AUTHORITATIVE_CLAIM_FIELDS.has(field)) {
      findings.push(
        finding(
          'CANONICAL_FIELD_OVERRIDE',
          `${pointer}.${field}`,
          `Presentation may not override canonical field ${field}.`,
        ),
      );
    } else if (!ALLOWED_PRESENTATION_FIELDS.has(field)) {
      findings.push(
        finding(
          'UNKNOWN_PRESENTATION_FIELD',
          `${pointer}.${field}`,
          `Unknown authored presentation field ${field}.`,
        ),
      );
    }
  }

  if (!canonicalClaim) {
    findings.push(
      finding(
        'UNKNOWN_CANONICAL_CLAIM',
        `${pointer}.canonicalClaimId`,
        `Unknown canonical claim ID ${String(record.canonicalClaimId)}.`,
      ),
    );
  }

  if (!Number.isInteger(record.order) || record.order < 1) {
    findings.push(
      finding('INVALID_CLAIM_ORDER', `${pointer}.order`, 'Order must be a positive integer.'),
    );
  }

  const publicCopy = record.publicCopy ?? record.copy;
  for (const [name, value] of [
    ['publicCopy', publicCopy],
    ['publicExcerpt', record.publicExcerpt],
    ['publicExplanation', record.publicExplanation],
    ['displayQualifier', record.displayQualifier],
  ]) {
    if (!hasLocalePair(value)) {
      findings.push(
        finding(
          'MISSING_CLAIM_LOCALE',
          `${pointer}.${name}`,
          `${name} requires non-empty en and vi strings.`,
        ),
      );
    }
  }

  if (!Array.isArray(record.publicSourceIds) || record.publicSourceIds.length === 0) {
    findings.push(
      finding(
        'MISSING_PUBLIC_SOURCE',
        `${pointer}.publicSourceIds`,
        'At least one public source ID is required.',
      ),
    );
  }

  if (
    canonicalClaim?.status !== 'recovered'
    && (record.tags ?? []).some((tag) =>
      ['recovered', 'recovered-credit', 'recovered-coverage'].includes(tag))
  ) {
    findings.push(
      finding(
        'INVALID_RECOVERED_CREDIT',
        `${pointer}.tags`,
        `Canonical ${canonicalClaim.id} has status ${canonicalClaim.status} and cannot receive recovered credit.`,
      ),
    );
  }

  const disposition = record.redaction?.disposition;
  if (!['public', 'redacted'].includes(disposition)) {
    findings.push(
      finding(
        'INVALID_REDACTION',
        `${pointer}.redaction.disposition`,
        'Redaction disposition must be public or redacted.',
      ),
    );
  }
  if (disposition === 'redacted' && !hasLocalePair(record.redaction?.reason)) {
    findings.push(
      finding(
        'MISSING_REDACTION_REASON',
        `${pointer}.redaction.reason`,
        'Redacted records require bilingual reasons.',
      ),
    );
  }

  return sortFindings(findings);
}

export function validatePublicSource(record, options = {}) {
  const pointer = options.pointer ?? '$.sources[]';
  const repositoryRoot = options.repositoryRoot ?? REPOSITORY_ROOT;
  const findings = [];

  if (!record || typeof record !== 'object') {
    return [finding('INVALID_PUBLIC_SOURCE', pointer, 'Source record must be an object.')];
  }
  if (typeof record.sourceId !== 'string' || record.sourceId.length === 0) {
    findings.push(finding('MISSING_SOURCE_ID', `${pointer}.sourceId`, 'sourceId is required.'));
  }
  if (!hasLocalePair(record.publicSafeExcerpt)) {
    findings.push(
      finding(
        'MISSING_SOURCE_EXCERPT',
        `${pointer}.publicSafeExcerpt`,
        'A bilingual sanitized excerpt is required.',
      ),
    );
  }
  if (!/^[a-f0-9]{64}$/u.test(record.sha256 ?? '')) {
    findings.push(
      finding('INVALID_SOURCE_HASH', `${pointer}.sha256`, 'Expected a lowercase SHA-256 digest.'),
    );
  }

  if (isDeniedPublicPath(record.path ?? '')) {
    findings.push(
      finding(
        'DENIED_PUBLIC_SOURCE',
        `${pointer}.path`,
        'Denied raw/private path cannot be a public source.',
      ),
    );
  }

  let absolutePath;
  try {
    absolutePath = resolveRepositoryPath(record.path);
  } catch (error) {
    findings.push(
      finding('UNSAFE_SOURCE_PATH', `${pointer}.path`, error.message),
    );
    return sortFindings(findings);
  }

  const bytes = readFileSync(absolutePath);
  if (sha256(bytes) !== record.sha256) {
    findings.push(
      finding('SOURCE_HASH_DRIFT', `${pointer}.sha256`, 'Tracked source hash does not match.'),
    );
  }

  if (record.publicLinkAllowed === true) {
    const content = bytes.toString('utf8');
    for (const pattern of PRIVATE_CONTENT_PATTERNS) {
      if (pattern.test(content)) {
        findings.push(
          finding(
            'UNSAFE_LINKABLE_SOURCE',
            `${pointer}.publicLinkAllowed`,
            'Directly linkable source contains private or restricted content.',
          ),
        );
        break;
      }
    }
  }

  if (!Array.isArray(record.transitiveLinks)) {
    findings.push(
      finding(
        'INVALID_TRANSITIVE_LINKS',
        `${pointer}.transitiveLinks`,
        'transitiveLinks must be an array.',
      ),
    );
  } else {
    record.transitiveLinks.forEach((link, index) => {
      const pathValue = typeof link === 'string' ? link : link?.path;
      try {
        resolveRepositoryPath(pathValue);
        if (isDeniedPublicPath(pathValue)) {
          throw new Error('transitive target is a denied raw/private path');
        }
      } catch (error) {
        findings.push(
          finding(
            'UNSAFE_TRANSITIVE_LINK',
            `${pointer}.transitiveLinks[${index}]`,
            error.message,
          ),
        );
      }
    });
  }

  if (repositoryRoot !== REPOSITORY_ROOT) {
    findings.push(
      finding(
        'UNSUPPORTED_REPOSITORY_ROOT',
        pointer,
        'Validation is bound to the checked-out repository root.',
      ),
    );
  }

  return sortFindings(findings);
}

export function validateMediaRecord(record, options = {}) {
  const pointer = options.pointer ?? '$.media[]';
  const findings = [];

  if (!record || typeof record !== 'object') {
    return [finding('INVALID_MEDIA', pointer, 'Media record must be an object.')];
  }
  for (const collapsedField of ['approvalState', 'rightsState']) {
    if (collapsedField in record) {
      findings.push(
        finding(
          'COLLAPSED_RIGHTS_STATE',
          `${pointer}.${collapsedField}`,
          `${collapsedField} cannot collapse academic and commercial rights.`,
        ),
      );
    }
  }

  for (const field of [
    'mediaId',
    'provenance',
    'academicDisplayDecisionRef',
    'commercialRightsRecordRef',
  ]) {
    if (!record[field]) {
      findings.push(
        finding('MISSING_MEDIA_FIELD', `${pointer}.${field}`, `${field} is required.`),
      );
    }
  }
  for (const field of ['alt', 'caption']) {
    if (!hasLocalePair(record[field])) {
      findings.push(
        finding(
          'MISSING_MEDIA_LOCALE',
          `${pointer}.${field}`,
          `${field} requires non-empty en and vi strings.`,
        ),
      );
    }
  }
  if (!Array.isArray(record.transformationHistory)) {
    findings.push(
      finding(
        'MISSING_MEDIA_TRANSFORM',
        `${pointer}.transformationHistory`,
        'transformationHistory must be an array.',
      ),
    );
  }
  if (record.publishable !== true && record.included !== true) {
    findings.push(
      finding(
        'UNAPPROVED_MEDIA',
        `${pointer}.publishable`,
        'Public media must be explicitly included or publishable.',
      ),
    );
  }

  return sortFindings(findings);
}

export function validateAiEpisode(record, options = {}) {
  const pointer = options.pointer ?? '$.aiEpisodes[]';
  const findings = [];

  if (!record || typeof record !== 'object') {
    return [finding('INVALID_AI_EPISODE', pointer, 'AI episode must be an object.')];
  }

  for (const forbiddenPointer of collectForbiddenAiKeys(record, pointer)) {
    findings.push(
      finding(
        'RAW_AI_PAYLOAD',
        forbiddenPointer,
        'Raw chats, prompts, transcripts, or hidden reasoning are prohibited.',
      ),
    );
  }

  const actorKind = record.decisionActorKind;
  if (!['human', 'automation', 'mixed', 'unknown'].includes(actorKind)) {
    findings.push(
      finding(
        'INVALID_DECISION_ACTOR',
        `${pointer}.decisionActorKind`,
        'decisionActorKind must be human, automation, mixed, or unknown.',
      ),
    );
  }
  if (
    containsUnsupportedHumanWording(record)
    && (actorKind !== 'human' || !record.decisionRef || !record.humanSignoffRef)
  ) {
    findings.push(
      finding(
        'UNSUPPORTED_HUMAN_REVIEW',
        pointer,
        'Human-review wording requires a public-safe human decision and sign-off reference.',
      ),
    );
  }

  return sortFindings(findings);
}

export function validateEvidenceSnapshot(snapshot, options = {}) {
  const pointer = options.pointer ?? '$.restorationEvidenceSnapshot';
  const verifyHashes = options.verifyHashes ?? false;
  const findings = [];

  if (!snapshot || typeof snapshot !== 'object') {
    return [finding('MISSING_EVIDENCE_SNAPSHOT', pointer, 'Evidence snapshot is required.')];
  }
  if (!/^[a-f0-9]{40}$/u.test(snapshot.repositoryCommit ?? '')) {
    findings.push(
      finding(
        'INVALID_SNAPSHOT_COMMIT',
        `${pointer}.repositoryCommit`,
        'Snapshot repositoryCommit must be a full lowercase Git commit.',
      ),
    );
  }
  if (typeof snapshot.snapshotId !== 'string' || snapshot.snapshotId.length === 0) {
    findings.push(
      finding('MISSING_SNAPSHOT_ID', `${pointer}.snapshotId`, 'snapshotId is required.'),
    );
  }
  const inputs = snapshot.authoritativeInputs ?? snapshot.inputs;
  if (!Array.isArray(inputs) || inputs.length === 0) {
    findings.push(
      finding(
        'MISSING_SNAPSHOT_INPUTS',
        `${pointer}.authoritativeInputs`,
        'Snapshot requires authoritative input path/hash records.',
      ),
    );
    return sortFindings(findings);
  }

  const seenPaths = new Set();
  inputs.forEach((input, index) => {
    const inputPointer = `${pointer}.authoritativeInputs[${index}]`;
    if (seenPaths.has(input?.path)) {
      findings.push(
        finding('DUPLICATE_SNAPSHOT_INPUT', `${inputPointer}.path`, 'Input path is duplicated.'),
      );
    }
    seenPaths.add(input?.path);
    if (!/^[a-f0-9]{64}$/u.test(input?.sha256 ?? '')) {
      findings.push(
        finding('INVALID_SNAPSHOT_HASH', `${inputPointer}.sha256`, 'Expected SHA-256 digest.'),
      );
    }
    if (verifyHashes) {
      try {
        const bytes = readFileSync(resolveRepositoryPath(input.path));
        if (sha256(bytes) !== input.sha256) {
          findings.push(
            finding(
              'SNAPSHOT_HASH_DRIFT',
              `${inputPointer}.sha256`,
              `Snapshot input hash drifted for ${input.path}.`,
            ),
          );
        }
      } catch (error) {
        findings.push(
          finding('INVALID_SNAPSHOT_PATH', `${inputPointer}.path`, error.message),
        );
      }
    }
  });

  return sortFindings(findings);
}

function validateReleaseInputs(releaseInputs, options = {}) {
  const findings = [];
  const pointer = '$.releaseInputs';
  if (releaseInputs?.candidateStatus !== 'ready') {
    findings.push(
      finding(
        'UNVERIFIED_RELEASE_INPUT_STATUS',
        `${pointer}.candidateStatus`,
        'Candidate must be ready and bound to a confirmed launch-ownership decision.',
      ),
    );
  }

  const launchDecision = releaseInputs?.launchDecision;
  if (
    typeof launchDecision?.path !== 'string'
    || !/^[a-f0-9]{64}$/u.test(launchDecision?.sha256 ?? '')
  ) {
    findings.push(
      finding(
        'INVALID_LAUNCH_DECISION_REF',
        `${pointer}.launchDecision`,
        'Launch decision requires a repository-relative path and lowercase SHA-256.',
      ),
    );
    return sortFindings(findings);
  }

  let decision = options.launchDecision;
  try {
    const bytes = readFileSync(resolveRepositoryPath(launchDecision.path));
    if (sha256(bytes) !== launchDecision.sha256) {
      findings.push(
        finding(
          'LAUNCH_DECISION_HASH_DRIFT',
          `${pointer}.launchDecision.sha256`,
          'Tracked launch-ownership decision hash does not match.',
        ),
      );
    }
    decision ??= JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    findings.push(
      finding(
        'INVALID_LAUNCH_DECISION_PATH',
        `${pointer}.launchDecision.path`,
        error.message,
      ),
    );
    return sortFindings(findings);
  }

  const ownerId = decision?.owner?.githubLogin;
  const expectedValues = [
    [launchDecision.decisionId, decision?.decisionId, `${pointer}.launchDecision.decisionId`],
    [launchDecision.decisionStatus, 'confirmed', `${pointer}.launchDecision.decisionStatus`],
    [decision?.recordType, 'case-study-launch-ownership-decision', '$launchDecision.recordType'],
    [decision?.decisionStatus, 'confirmed', '$launchDecision.decisionStatus'],
    [decision?.authorizationMode, 'solo-owner-self-review', '$launchDecision.authorizationMode'],
    [ownerId, 'dantech0xff', '$launchDecision.owner.githubLogin'],
    [
      releaseInputs?.accountableReleaseOwner?.roleId,
      'accountable-release-owner',
      `${pointer}.accountableReleaseOwner.roleId`,
    ],
    [
      releaseInputs?.accountableReleaseOwner?.reviewerId,
      ownerId,
      `${pointer}.accountableReleaseOwner.reviewerId`,
    ],
    [
      releaseInputs?.accountableReleaseOwner?.evidenceStatus,
      'confirmed',
      `${pointer}.accountableReleaseOwner.evidenceStatus`,
    ],
    [
      releaseInputs?.publicCorrections?.roleId,
      'public-corrections-owner',
      `${pointer}.publicCorrections.roleId`,
    ],
    [
      releaseInputs?.publicCorrections?.ownerId,
      ownerId,
      `${pointer}.publicCorrections.ownerId`,
    ],
    [
      releaseInputs?.publicCorrections?.channel,
      decision?.reviewedScope?.correctionChannel?.url,
      `${pointer}.publicCorrections.channel`,
    ],
    [
      releaseInputs?.publicCorrections?.channelStatus,
      'confirmed',
      `${pointer}.publicCorrections.channelStatus`,
    ],
    [
      releaseInputs?.vietnameseFactualReview?.roleId,
      'vietnamese-factual-reviewer',
      `${pointer}.vietnameseFactualReview.roleId`,
    ],
    [
      releaseInputs?.vietnameseFactualReview?.reviewerId,
      ownerId,
      `${pointer}.vietnameseFactualReview.reviewerId`,
    ],
    [
      releaseInputs?.vietnameseFactualReview?.reviewMode,
      'solo-owner-self-review',
      `${pointer}.vietnameseFactualReview.reviewMode`,
    ],
    [
      releaseInputs?.vietnameseFactualReview?.evidenceStatus,
      'confirmed',
      `${pointer}.vietnameseFactualReview.evidenceStatus`,
    ],
    [
      decision?.authenticatedEvidence?.reviewerId,
      ownerId,
      '$launchDecision.authenticatedEvidence.reviewerId',
    ],
    [
      decision?.authenticatedEvidence?.reviewState,
      'approved',
      '$launchDecision.authenticatedEvidence.reviewState',
    ],
    [
      decision?.authenticatedEvidence?.deploymentState,
      'success',
      '$launchDecision.authenticatedEvidence.deploymentState',
    ],
    [
      decision?.reviewedScope?.commercialRightsStatus,
      'unchanged and fail-closed',
      '$launchDecision.reviewedScope.commercialRightsStatus',
    ],
  ];
  for (const [actual, expected, valuePointer] of expectedValues) {
    if (actual !== expected) {
      findings.push(
        finding(
          'INVALID_LAUNCH_DECISION_BINDING',
          valuePointer,
          `Expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}.`,
        ),
      );
    }
  }

  const expectedRoles = [
    'accountable-release-owner',
    'public-corrections-owner',
    'vietnamese-factual-reviewer',
  ];
  if (
    JSON.stringify(decision?.owner?.roleIds) !== JSON.stringify(expectedRoles)
    || JSON.stringify(decision?.reviewedScope?.locales) !== JSON.stringify(['en', 'vi'])
  ) {
    findings.push(
      finding(
        'INVALID_SOLO_OWNER_SCOPE',
        '$launchDecision.owner',
        'Solo owner decision must cover the exact release roles and English/Vietnamese locales.',
      ),
    );
  }

  for (const role of [
    releaseInputs?.accountableReleaseOwner,
    releaseInputs?.publicCorrections,
    releaseInputs?.vietnameseFactualReview,
  ]) {
    if (role?.decisionRef !== launchDecision.path) {
      findings.push(
        finding(
          'LAUNCH_DECISION_REF_DRIFT',
          `${pointer}.${role?.roleId ?? 'unknown'}.decisionRef`,
          'Every launch role must reference the same tracked ownership decision.',
        ),
      );
    }
  }

  return sortFindings(findings);
}

export function validatePublicationManifest(manifest, options = {}) {
  const findings = [];
  const canonicalClaims = options.canonicalClaims ?? readClaims();
  const sourceCatalog = options.sourceCatalog ?? readJson(SOURCE_CATALOG);
  const canonicalById = new Map(canonicalClaims.map((claim) => [claim.id, claim]));
  const sourceIds = new Set(sourceCatalog.sources.map((source) => source.sourceId));
  const presentations = manifest?.claimPresentations;

  findings.push(
    ...validateEvidenceSnapshot(manifest?.restorationEvidenceSnapshot, {
      verifyHashes: options.verifySnapshot === true,
    }),
  );

  if (!Array.isArray(manifest?.supportedLocales)
    || manifest.supportedLocales.join(',') !== 'en,vi') {
    findings.push(
      finding(
        'INVALID_SUPPORTED_LOCALES',
        '$.supportedLocales',
        'supportedLocales must be exactly ["en", "vi"].',
      ),
    );
  }

  if (!Array.isArray(presentations)) {
    findings.push(
      finding(
        'MISSING_CLAIM_PRESENTATIONS',
        '$.claimPresentations',
        'claimPresentations must be an array.',
      ),
    );
  } else {
    const seenIds = new Set();
    const seenOrders = new Set();
    presentations.forEach((record, index) => {
      const pointer = `$.claimPresentations[${index}]`;
      findings.push(
        ...validateClaimPresentation(record, canonicalById.get(record?.canonicalClaimId), {
          pointer,
        }),
      );
      if (seenIds.has(record?.canonicalClaimId)) {
        findings.push(
          finding(
            'DUPLICATE_CANONICAL_CLAIM',
            `${pointer}.canonicalClaimId`,
            `Duplicate canonical claim ${String(record?.canonicalClaimId)}.`,
          ),
        );
      }
      seenIds.add(record?.canonicalClaimId);
      if (seenOrders.has(record?.order)) {
        findings.push(
          finding(
            'DUPLICATE_CLAIM_ORDER',
            `${pointer}.order`,
            `Duplicate display order ${String(record?.order)}.`,
          ),
        );
      }
      seenOrders.add(record?.order);
      for (const sourceId of record?.publicSourceIds ?? []) {
        if (!sourceIds.has(sourceId)) {
          findings.push(
            finding(
              'UNKNOWN_PUBLIC_SOURCE',
              `${pointer}.publicSourceIds`,
              `Unknown public source ID ${sourceId}.`,
            ),
          );
        }
      }
    });
    for (const canonicalClaim of canonicalClaims) {
      if (!seenIds.has(canonicalClaim.id)) {
        findings.push(
          finding(
            'MISSING_CANONICAL_CLAIM',
            '$.claimPresentations',
            `Missing presentation for ${canonicalClaim.id}.`,
          ),
        );
      }
    }
    if (presentations.length !== canonicalClaims.length) {
      findings.push(
        finding(
          'CANONICAL_CLAIM_COUNT_MISMATCH',
          '$.claimPresentations',
          `Expected ${canonicalClaims.length} presentations, found ${presentations.length}.`,
        ),
      );
    }
  }

  sourceCatalog.sources.forEach((source, index) => {
    findings.push(
      ...validatePublicSource(source, { pointer: `$.sourceCatalog.sources[${index}]` }),
    );
  });

  const media = manifest?.media ?? manifest?.mediaRecords ?? [];
  if (!Array.isArray(media)) {
    findings.push(finding('INVALID_MEDIA_LIST', '$.media', 'media must be an array.'));
  } else {
    media.forEach((record, index) => {
      findings.push(...validateMediaRecord(record, { pointer: `$.media[${index}]` }));
    });
  }

  const episodes = manifest?.aiEpisodes ?? [];
  if (!Array.isArray(episodes)) {
    findings.push(
      finding('INVALID_AI_EPISODE_LIST', '$.aiEpisodes', 'aiEpisodes must be an array.'),
    );
  } else {
    episodes.forEach((record, index) => {
      findings.push(...validateAiEpisode(record, { pointer: `$.aiEpisodes[${index}]` }));
    });
  }

  findings.push(...validateReleaseInputs(manifest?.releaseInputs, options));

  return sortFindings(findings);
}

function parseArguments(arguments_) {
  let manifestPath = DEFAULT_MANIFEST;
  let verifySnapshot = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--verify-snapshot') {
      verifySnapshot = true;
    } else if (argument === '--manifest') {
      const value = arguments_[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--manifest requires a repository-relative path');
      }
      manifestPath = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return { manifestPath, verifySnapshot };
}

export function runCli(arguments_ = process.argv.slice(2)) {
  let options;
  try {
    options = parseArguments(arguments_);
    const manifest = readJson(options.manifestPath);
    const findings = validatePublicationManifest(manifest, {
      verifySnapshot: options.verifySnapshot,
    });
    if (findings.length > 0) {
      for (const entry of findings) {
        process.stderr.write(`${entry.code} ${entry.path}: ${entry.message}\n`);
      }
      return 1;
    }
    process.stdout.write(
      `Case-study publication validation passed (${options.verifySnapshot ? 'snapshot verified' : 'policy only'}).\n`,
    );
    return 0;
  } catch (error) {
    process.stderr.write(`PUBLICATION_VALIDATOR_ERROR: ${error.message}\n`);
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli();
}
