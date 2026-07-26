#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validatePublicationManifest,
} from './validate-case-study-publication.mjs';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..');

export const CASE_STUDY_PATHS = Object.freeze({
  publicationManifest: 'reference/case-study-publication-manifest.json',
  sourceCatalog: 'reference/case-study-public-source-catalog.json',
  canonicalClaims: 'forensics/claims.jsonl',
  nativeSummary: 'forensics/native/function-enrichment-summary.json',
  resourceInventory: 'forensics/resources/resource-usage-map.json',
  resourceReconciliation: 'assets/catalog/resource-reconciliation-ledger.json',
  fidelity: 'forensics/fidelity/fidelity-report-v1.json',
  residuals: 'forensics/fidelity/residual-gap-ledger.json',
  physicsEquivalence: 'forensics/runtime/physics2d-backend-equivalence.json',
  publicRelease: 'release/public-release-variant-manifest.json',
  closeout:
    'plans/260721-2253-pencil-blade-restoration/reports/technical-closeout-manifest.json',
  h5Runtime:
    'plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/h5-runtime-matrix.json',
  androidRuntime:
    'plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/android-runtime-matrix.json',
  productionRuntime:
    'plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/production-pages/production-pages-runtime.json',
  output: 'site/src/generated/facts.json',
});

const CANONICAL_CLAIM_FIELDS = Object.freeze([
  'claim',
  'status',
  'evidenceTier',
  'confidence',
  'evidenceRefs',
  'contradictionIds',
  'contractEligible',
]);

const PRESENTATION_FIELDS = Object.freeze([
  'order',
  'publicCopy',
  'publicExcerpt',
  'publicExplanation',
  'displayQualifier',
  'tags',
  'redaction',
  'publicSourceIds',
]);

const DENIED_DIRECT_PATH_SEGMENTS = Object.freeze([
  '.forensics-work',
  'offline-evidence',
  'jadx-output',
  'apktool-output',
  'reference/historical-media/raw',
  'reference/external-material',
]);

const DENIED_DIRECT_EXTENSIONS = new Set([
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

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function normalizeRepositoryPath(repositoryPath) {
  invariant(
    typeof repositoryPath === 'string' && repositoryPath.length > 0,
    'Repository path must be a non-empty string.',
  );
  invariant(!isAbsolute(repositoryPath), `Absolute path is not allowed: ${repositoryPath}`);
  invariant(!repositoryPath.includes('\0'), 'Repository path contains a null byte.');

  const normalized = repositoryPath.replaceAll('\\', '/');
  invariant(
    normalized.split('/').every((segment) => segment !== '' && segment !== '..'),
    `Unsafe repository path: ${repositoryPath}`,
  );
  return normalized;
}

function resolveRepositoryPath(repositoryRoot, repositoryPath) {
  const normalized = normalizeRepositoryPath(repositoryPath);
  const absolutePath = resolve(repositoryRoot, normalized);
  const fromRoot = relative(repositoryRoot, absolutePath);
  invariant(
    fromRoot !== '..'
      && !fromRoot.startsWith(`..${sep}`)
      && !isAbsolute(fromRoot),
    `Repository path escapes the repository root: ${repositoryPath}`,
  );
  return absolutePath;
}

function defaultReadInput(repositoryRoot, repositoryPath) {
  return readFileSync(resolveRepositoryPath(repositoryRoot, repositoryPath));
}

function readJson(bytes, repositoryPath) {
  try {
    return JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch (error) {
    throw new Error(`Invalid JSON in ${repositoryPath}: ${error.message}`);
  }
}

function readClaims(bytes, repositoryPath) {
  try {
    return Buffer.from(bytes)
      .toString('utf8')
      .split(/\r?\n/u)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
  } catch (error) {
    throw new Error(`Invalid JSONL in ${repositoryPath}: ${error.message}`);
  }
}

function stableClone(value) {
  if (Array.isArray(value)) {
    return value.map(stableClone);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableClone(value[key])]),
    );
  }
  return value;
}

export function stableJson(value) {
  return `${JSON.stringify(stableClone(value), null, 2)}\n`;
}

function source(path, fieldPointer) {
  return Object.freeze({ path, fieldPointer });
}

function fact(id, value, path, fieldPointer, extra = {}) {
  return {
    id,
    value,
    ...extra,
    source: source(path, fieldPointer),
  };
}

function sourceCatalogRecords(sourceCatalog) {
  if (Array.isArray(sourceCatalog)) {
    return sourceCatalog;
  }
  return sourceCatalog?.sources ?? [];
}

function sourceCatalogBase(sourceCatalog) {
  const configured = sourceCatalog?.repository?.pagesBase
    ?? sourceCatalog?.pagesBase
    ?? '/pencil-blade-2026/';
  const segments = configured.split('/').filter(Boolean);
  return `/${segments.join('/')}/`;
}

function normalizePagesBase(base) {
  invariant(
    typeof base === 'string' && base.startsWith('/') && base.endsWith('/'),
    'Citation base must start and end with "/".',
  );
  const segments = base.split('/').filter(Boolean);
  invariant(
    segments.every((segment) => segment !== '.' && segment !== '..'),
    'Citation base contains an unsafe path segment.',
  );
  return `/${segments.join('/')}/`;
}

function normalizeGitHubRepositoryUrl(repositoryUrl) {
  let parsed;
  try {
    parsed = new URL(repositoryUrl);
  } catch {
    throw new Error('Citation repository URL must be a valid GitHub URL.');
  }
  invariant(
    parsed.protocol === 'https:' && parsed.hostname === 'github.com',
    'Citation repository URL must use https://github.com.',
  );
  invariant(
    parsed.pathname.split('/').filter(Boolean).length === 2,
    'Citation repository URL must identify one GitHub owner/repository pair.',
  );
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/u, '')}`;
}

function encodeRepositoryPath(repositoryPath) {
  return repositoryPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function isDeniedDirectPath(repositoryPath) {
  const normalized = normalizeRepositoryPath(repositoryPath);
  const extension = normalized.includes('.')
    ? `.${normalized.split('.').at(-1).toLowerCase()}`
    : '';
  return DENIED_DIRECT_EXTENSIONS.has(extension)
    || DENIED_DIRECT_PATH_SEGMENTS.some((segment) => (
      normalized === segment
      || normalized.startsWith(`${segment}/`)
      || normalized.includes(`/${segment}/`)
    ));
}

/**
 * Resolve a cataloged source without ever exposing an unapproved repository path.
 */
export function resolvePublicCitation(sourceId, sourceCatalog, commit, options = {}) {
  const record = sourceCatalogRecords(sourceCatalog)
    .find((entry) => entry.sourceId === sourceId);
  invariant(record, `Unknown public source ID: ${String(sourceId)}`);
  invariant(
    /^[a-f0-9]{40}$/u.test(commit ?? ''),
    'A full lowercase commit SHA is required for public citations.',
  );

  if (record.publicLinkAllowed === true) {
    invariant(
      !isDeniedDirectPath(record.path),
      `Denied repository path cannot be linked directly: ${record.path}`,
    );
    const repositoryUrl = options.repositoryUrl
      ?? sourceCatalog?.repository?.canonicalUrl
      ?? 'https://github.com/dantech0xff/pencil-blade-2026';
    const lineRange = record.lineRange;
    const fragment = Number.isInteger(lineRange?.start)
      ? `#L${lineRange.start}${Number.isInteger(lineRange.end) ? `-L${lineRange.end}` : ''}`
      : '';
    return `${normalizeGitHubRepositoryUrl(repositoryUrl)}/blob/${commit}/${encodeRepositoryPath(
      normalizeRepositoryPath(record.path),
    )}${fragment}`;
  }

  const base = options.base ?? sourceCatalogBase(sourceCatalog);
  const normalizedBase = normalizePagesBase(base);
  return `${normalizedBase}sources/${encodeURIComponent(sourceId)}/`;
}

function readPhaseOneInputs(options = {}) {
  const repositoryRoot = options.repositoryRoot ?? REPOSITORY_ROOT;
  const readInput = options.readInput
    ?? ((repositoryPath) => defaultReadInput(repositoryRoot, repositoryPath));
  const publicationManifest = options.publicationManifest
    ?? readJson(readInput(CASE_STUDY_PATHS.publicationManifest), CASE_STUDY_PATHS.publicationManifest);
  const sourceCatalog = options.sourceCatalog
    ?? readJson(readInput(CASE_STUDY_PATHS.sourceCatalog), CASE_STUDY_PATHS.sourceCatalog);
  const canonicalClaims = options.canonicalClaims
    ?? readClaims(readInput(CASE_STUDY_PATHS.canonicalClaims), CASE_STUDY_PATHS.canonicalClaims);

  return {
    repositoryRoot,
    readInput,
    publicationManifest,
    sourceCatalog,
    canonicalClaims,
  };
}

/**
 * Load and validate the complete Phase 1 publication projection.
 */
export function loadPublicationContext(options = {}) {
  const phaseOne = readPhaseOneInputs(options);
  const findings = validatePublicationManifest(phaseOne.publicationManifest, {
    canonicalClaims: phaseOne.canonicalClaims,
    sourceCatalog: phaseOne.sourceCatalog,
    verifySnapshot: options.verifySnapshot !== false
      && phaseOne.repositoryRoot === REPOSITORY_ROOT
      && options.readInput === undefined,
  });
  invariant(
    findings.length === 0,
    `Phase 1 publication manifest is invalid:\n${findings
      .map((entry) => `${entry.code} ${entry.path}: ${entry.message}`)
      .join('\n')}`,
  );
  return phaseOne;
}

export function loadPublicationManifest(options = {}) {
  return loadPublicationContext(options).publicationManifest;
}

function verifySnapshotInputs(snapshot, readInput) {
  invariant(snapshot && typeof snapshot === 'object', 'Evidence snapshot is required.');
  invariant(
    Array.isArray(snapshot.authoritativeInputs) && snapshot.authoritativeInputs.length > 0,
    'Evidence snapshot authoritativeInputs must be a non-empty array.',
  );

  const bytesByPath = new Map();
  const seenPaths = new Set();
  for (const input of snapshot.authoritativeInputs) {
    const repositoryPath = normalizeRepositoryPath(input?.path);
    invariant(!seenPaths.has(repositoryPath), `Duplicate snapshot input: ${repositoryPath}`);
    seenPaths.add(repositoryPath);
    invariant(
      /^[a-f0-9]{64}$/u.test(input?.sha256 ?? ''),
      `Invalid snapshot SHA-256 for ${repositoryPath}`,
    );
    const bytes = Buffer.from(readInput(repositoryPath));
    const actual = sha256(bytes);
    invariant(
      actual === input.sha256,
      `Snapshot hash drift for ${repositoryPath}: expected ${input.sha256}, found ${actual}`,
    );
    bytesByPath.set(repositoryPath, bytes);
  }
  return bytesByPath;
}

function requireSnapshotInput(bytesByPath, repositoryPath) {
  const bytes = bytesByPath.get(repositoryPath);
  invariant(bytes, `Required authoritative input is absent from snapshot: ${repositoryPath}`);
  return bytes;
}

function readSnapshotJson(bytesByPath, repositoryPath) {
  return readJson(requireSnapshotInput(bytesByPath, repositoryPath), repositoryPath);
}

function joinClaimPresentations(manifest, canonicalClaims, sourceCatalog, commit) {
  invariant(canonicalClaims.length === 39, `Expected 39 canonical claims, found ${canonicalClaims.length}`);
  invariant(
    manifest.claimPresentations.length === canonicalClaims.length,
    `Expected ${canonicalClaims.length} claim presentations, found ${manifest.claimPresentations.length}`,
  );

  const canonicalById = new Map(canonicalClaims.map((claim) => [claim.id, claim]));
  return manifest.claimPresentations
    .map((presentation, presentationIndex) => {
      const canonical = canonicalById.get(presentation.canonicalClaimId);
      invariant(canonical, `Unknown canonical claim ${presentation.canonicalClaimId}`);
      for (const field of CANONICAL_CLAIM_FIELDS) {
        invariant(
          !(field in presentation),
          `Presentation ${presentation.canonicalClaimId} overrides canonical field ${field}`,
        );
      }

      const canonicalIndex = canonicalClaims.indexOf(canonical);
      const fieldSources = {};
      for (const field of ['canonicalClaimId', ...PRESENTATION_FIELDS]) {
        if (field === 'canonicalClaimId') {
          fieldSources[field] = source(
            CASE_STUDY_PATHS.canonicalClaims,
            `$line[${canonicalIndex + 1}].id`,
          );
        } else if (field in presentation) {
          fieldSources[field] = source(
            CASE_STUDY_PATHS.publicationManifest,
            `$.claimPresentations[${presentationIndex}].${field}`,
          );
        }
      }
      for (const field of CANONICAL_CLAIM_FIELDS) {
        fieldSources[field] = source(
          CASE_STUDY_PATHS.canonicalClaims,
          `$line[${canonicalIndex + 1}].${field}`,
        );
      }

      const projectedPresentation = Object.fromEntries(
        PRESENTATION_FIELDS
          .filter((field) => field in presentation)
          .map((field) => [field, presentation[field]]),
      );
      const copyField = 'publicCopy' in presentation ? 'publicCopy' : 'copy';
      fieldSources.copy = source(
        CASE_STUDY_PATHS.publicationManifest,
        `$.claimPresentations[${presentationIndex}].${copyField}`,
      );
      return {
        canonicalClaimId: canonical.id,
        ...projectedPresentation,
        copy: presentation[copyField],
        ...Object.fromEntries(
          CANONICAL_CLAIM_FIELDS.map((field) => [field, canonical[field]]),
        ),
        citations: presentation.publicSourceIds.map((sourceId) => ({
          sourceId,
          href: resolvePublicCitation(sourceId, sourceCatalog, commit, {
            repositoryUrl: manifest.repository?.canonicalUrl,
            base: manifest.repository?.pagesBase,
          }),
        })),
        fieldSources,
      };
    })
    .sort((left, right) => left.order - right.order
      || left.canonicalClaimId.localeCompare(right.canonicalClaimId));
}

function buildFacts(data) {
  const {
    native,
    resourceInventory,
    resourceReconciliation,
    fidelity,
    residuals,
    physics,
    publicRelease,
    closeout,
    h5Runtime,
    androidRuntime,
    productionRuntime,
  } = data;

  return [
    fact('native.total-functions', native.totalFunctions, CASE_STUDY_PATHS.nativeSummary, '$.totalFunctions'),
    fact(
      'native.functions-with-direct-calls',
      native.functionsWithDirectCalls,
      CASE_STUDY_PATHS.nativeSummary,
      '$.functionsWithDirectCalls',
    ),
    fact(
      'native.functions-with-numeric-constants',
      native.functionsWithNumericConstants,
      CASE_STUDY_PATHS.nativeSummary,
      '$.functionsWithNumericConstants',
    ),
    fact(
      'native.functions-with-string-xrefs',
      native.functionsWithStringXrefs,
      CASE_STUDY_PATHS.nativeSummary,
      '$.functionsWithStringXrefs',
    ),
    ...Object.entries(resourceInventory.summary.assets).map(([name, value]) =>
      fact(
        `resources.assets.${name}`,
        value,
        CASE_STUDY_PATHS.resourceInventory,
        `$.summary.assets.${name}`,
      )),
    ...Object.entries(resourceReconciliation.summary.reconciliation).map(([name, value]) =>
      fact(
        `resources.reconciliation.${name}`,
        value,
        CASE_STUDY_PATHS.resourceReconciliation,
        `$.summary.reconciliation.${name}`,
      )),
    ...fidelity.domains.map((domain, index) =>
      fact(
        `fidelity.domain.${domain.id}`,
        {
          frozenUnits: domain.frozenUnits,
          passedUnits: domain.passedUnits,
          failedUnits: domain.failedUnits,
          scorePercent: domain.scorePercent,
          status: domain.status,
        },
        CASE_STUDY_PATHS.fidelity,
        `$.domains[${index}]`,
      )),
    fact(
      'fidelity.overall-score-percent',
      fidelity.overallScorePercent,
      CASE_STUDY_PATHS.fidelity,
      '$.overallScorePercent',
    ),
    fact(
      'fidelity.original-runtime-identity-claim',
      fidelity.originalRuntimeIdentityClaim,
      CASE_STUDY_PATHS.fidelity,
      '$.originalRuntimeIdentityClaim',
    ),
    ...Object.entries(residuals.summary).map(([name, value]) =>
      fact(
        `residuals.summary.${name}`,
        value,
        CASE_STUDY_PATHS.residuals,
        `$.summary.${name}`,
      )),
    fact(
      'physics.equivalence-status',
      physics.equivalenceDecision.status,
      CASE_STUDY_PATHS.physicsEquivalence,
      '$.equivalenceDecision.status',
    ),
    fact(
      'runtime.android',
      {
        status: androidRuntime.status,
        apiLevel: androidRuntime.device.apiLevel,
        release: androidRuntime.device.release,
        abi: androidRuntime.device.abi,
      },
      CASE_STUDY_PATHS.androidRuntime,
      '$',
      { evidenceScope: 'restorationEvidenceSnapshot' },
    ),
    fact(
      'runtime.h5',
      {
        status: h5Runtime.status,
        browser: h5Runtime.browser.product,
        browserVersion: h5Runtime.browser.version,
        rows: h5Runtime.rows.map((row) => row.id),
        requestFailures: h5Runtime.rows.reduce(
          (total, row) => total + row.console.requestFailures.length,
          0,
        ),
        pageErrors: h5Runtime.rows.reduce(
          (total, row) => total + row.console.pageErrors.length,
          0,
        ),
      },
      CASE_STUDY_PATHS.h5Runtime,
      '$',
      { evidenceScope: 'restorationEvidenceSnapshot' },
    ),
    fact(
      'runtime.production-pages',
      {
        status: productionRuntime.status,
        publishedFilesExpected: productionRuntime.publishedFiles.expected,
        publishedFilesChecked: productionRuntime.publishedFiles.checked,
        rows: productionRuntime.rows.map((row) => row.id),
      },
      CASE_STUDY_PATHS.productionRuntime,
      '$',
      { evidenceScope: 'restorationEvidenceSnapshot' },
    ),
    fact(
      'closeout.status',
      closeout.status,
      CASE_STUDY_PATHS.closeout,
      '$.status',
      { evidenceScope: 'restorationEvidenceSnapshot' },
    ),
    fact(
      'closeout.android-artifact',
      {
        bytes: closeout.canonicalArtifacts.android.bytes,
        sha256: closeout.canonicalArtifacts.android.sha256,
        package: closeout.canonicalArtifacts.android.package,
      },
      CASE_STUDY_PATHS.closeout,
      '$.canonicalArtifacts.android',
      { evidenceScope: 'restorationEvidenceSnapshot' },
    ),
    fact(
      'closeout.h5-artifact',
      {
        files: closeout.canonicalArtifacts.h5.files,
        bytes: closeout.canonicalArtifacts.h5.bytes,
        treeDigestSha256: closeout.canonicalArtifacts.h5.treeDigestSha256,
      },
      CASE_STUDY_PATHS.closeout,
      '$.canonicalArtifacts.h5',
      { evidenceScope: 'restorationEvidenceSnapshot' },
    ),
    fact(
      'release.public-status',
      publicRelease.releaseDecision.status,
      CASE_STUDY_PATHS.publicRelease,
      '$.releaseDecision.status',
    ),
  ].sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Generate the public projection in memory. This function never writes files.
 */
export function generatePublicFacts(inputs = {}, evidenceSnapshot) {
  const phaseOne = loadPublicationContext({
    ...inputs,
    verifySnapshot: false,
  });
  const snapshot = evidenceSnapshot ?? phaseOne.publicationManifest.restorationEvidenceSnapshot;
  const bytesByPath = verifySnapshotInputs(snapshot, phaseOne.readInput);
  const canonicalClaims = readClaims(
    requireSnapshotInput(bytesByPath, CASE_STUDY_PATHS.canonicalClaims),
    CASE_STUDY_PATHS.canonicalClaims,
  );

  const data = {
    native: readSnapshotJson(bytesByPath, CASE_STUDY_PATHS.nativeSummary),
    resourceInventory: readSnapshotJson(bytesByPath, CASE_STUDY_PATHS.resourceInventory),
    resourceReconciliation: readSnapshotJson(
      bytesByPath,
      CASE_STUDY_PATHS.resourceReconciliation,
    ),
    fidelity: readSnapshotJson(bytesByPath, CASE_STUDY_PATHS.fidelity),
    residuals: readSnapshotJson(bytesByPath, CASE_STUDY_PATHS.residuals),
    physics: readSnapshotJson(bytesByPath, CASE_STUDY_PATHS.physicsEquivalence),
    publicRelease: readSnapshotJson(bytesByPath, CASE_STUDY_PATHS.publicRelease),
    closeout: readSnapshotJson(bytesByPath, CASE_STUDY_PATHS.closeout),
    h5Runtime: readSnapshotJson(bytesByPath, CASE_STUDY_PATHS.h5Runtime),
    androidRuntime: readSnapshotJson(bytesByPath, CASE_STUDY_PATHS.androidRuntime),
    productionRuntime: readSnapshotJson(bytesByPath, CASE_STUDY_PATHS.productionRuntime),
  };

  return stableClone({
    schemaVersion: 1,
    evidenceScope: 'restorationEvidenceSnapshot',
    snapshot: {
      snapshotId: snapshot.snapshotId,
      snapshotVersion: snapshot.snapshotVersion,
      repositoryCommit: snapshot.repositoryCommit,
      authoritativeInputs: snapshot.authoritativeInputs,
    },
    facts: buildFacts(data),
    claimPresentations: joinClaimPresentations(
      phaseOne.publicationManifest,
      canonicalClaims,
      phaseOne.sourceCatalog,
      snapshot.repositoryCommit,
    ),
  });
}

function parseArguments(arguments_) {
  let outputPath = CASE_STUDY_PATHS.output;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--output') {
      const value = arguments_[index + 1];
      invariant(value && !value.startsWith('--'), '--output requires a repository-relative path');
      outputPath = normalizeRepositoryPath(value);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return { outputPath };
}

export function runCli(arguments_ = process.argv.slice(2)) {
  try {
    const options = parseArguments(arguments_);
    const output = generatePublicFacts();
    const absoluteOutput = resolveRepositoryPath(REPOSITORY_ROOT, options.outputPath);
    mkdirSync(dirname(absoluteOutput), { recursive: true });
    writeFileSync(absoluteOutput, stableJson(output));
    process.stdout.write(
      `Generated ${options.outputPath}: ${output.facts.length} facts, `
      + `${output.claimPresentations.length} claim presentations.\n`,
    );
    return 0;
  } catch (error) {
    process.stderr.write(`CASE_STUDY_DATA_ERROR: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli();
}
