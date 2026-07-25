#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectWebBuildDirectory } from './audit-web-build.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PATHS = Object.freeze({
  androidReport:
    'plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/android-runtime-matrix.json',
  h5Report:
    'plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/h5-runtime-matrix.json',
  fidelityReport: 'forensics/fidelity/fidelity-report-v1.json',
  residualLedger: 'forensics/fidelity/residual-gap-ledger.json',
  frozenSuite: 'forensics/fidelity/frozen-evidence-fixture-manifest.json',
  publicRelease: 'release/public-release-variant-manifest.json',
  output:
    'plans/260721-2253-pencil-blade-restoration/reports/technical-closeout-manifest.json',
});

function readJson(path) {
  return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function fileRecord(path) {
  const bytes = readFileSync(resolve(ROOT, path));
  return { path, bytes: bytes.length, sha256: sha256(bytes) };
}

function treeDigest(files) {
  return sha256(
    files
      .map((file) => `${file.path}\0${file.size}\0${file.sha256}\n`)
      .sort()
      .join(''),
  );
}

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function validateWorkspaceArtifacts(android, h5, workspaceRoot = ROOT) {
  const apkPath = resolve(workspaceRoot, android.artifact.path);
  requireCondition(existsSync(apkPath), 'Android artifact is missing');
  requireCondition(!lstatSync(apkPath).isSymbolicLink(), 'Android artifact must not be a symlink');
  const apkBytes = readFileSync(apkPath);
  requireCondition(apkBytes.length === android.artifact.bytes, 'Android artifact byte count drifted');
  requireCondition(sha256(apkBytes) === android.artifact.sha256, 'Android artifact SHA-256 drifted');

  const webPath = resolve(workspaceRoot, h5.build.directory);
  requireCondition(existsSync(webPath), 'H5 artifact directory is missing');
  const audit = inspectWebBuildDirectory(webPath);
  requireCondition(audit.files.length === h5.build.files, 'H5 file count drifted');
  requireCondition(
    audit.files.reduce((sum, file) => sum + file.size, 0) === h5.build.bytes,
    'H5 byte count drifted',
  );
  requireCondition(
    treeDigest(audit.files) === h5.build.treeDigestSha256,
    'H5 tree digest drifted',
  );
}

export function generateTechnicalCloseoutManifest(options = {}) {
  Object.values(PATHS)
    .filter((path) => path !== PATHS.output)
    .forEach((path) => requireCondition(existsSync(resolve(ROOT, path)), `Missing ${path}`));

  const android = readJson(PATHS.androidReport);
  const h5 = readJson(PATHS.h5Report);
  const fidelity = readJson(PATHS.fidelityReport);
  const residuals = readJson(PATHS.residualLedger);
  const frozenSuite = readJson(PATHS.frozenSuite);
  const publicRelease = readJson(PATHS.publicRelease);

  requireCondition(android.status === 'pass', 'Android runtime matrix is not passing');
  requireCondition(h5.status === 'pass', 'H5 runtime matrix is not passing');
  requireCondition(fidelity.status === 'pass', 'Fidelity report is not passing');
  requireCondition(fidelity.overallScorePercent >= 99, 'Fidelity score is below 99%');
  requireCondition(
    residuals.summary.unexplainedDivergences === 0,
    'Unexplained divergences remain',
  );
  requireCondition(
    publicRelease.releaseDecision.status === 'blocked',
    'Public release is not fail-closed',
  );
  requireCondition(
    publicRelease.records.every((record) => record.shipReady === false),
    'A public release record is unexpectedly ship-ready',
  );
  if (options.validateWorkspaceArtifacts !== false) {
    validateWorkspaceArtifacts(android, h5);
  }

  const manifest = {
    schemaVersion: 1,
    status: {
      technicalReconstruction: 'pass',
      publicRelease: 'blocked',
      programCloseout: 'blocked',
    },
    canonicalArtifacts: {
      android: {
        ...android.artifact,
        runtimeReport: fileRecord(PATHS.androidReport),
      },
      h5: {
        ...h5.build,
        browser: h5.browser,
        runtimeRows: h5.rows.map((row) => row.id),
        runtimeReport: fileRecord(PATHS.h5Report),
      },
    },
    fidelity: {
      metricId: fidelity.metricId,
      metricVersion: fidelity.metricVersion,
      overallScorePercent: fidelity.overallScorePercent,
      originalRuntimeIdentityClaim: fidelity.originalRuntimeIdentityClaim,
      unexplainedDivergences: fidelity.unexplainedDivergences,
      report: fileRecord(PATHS.fidelityReport),
      residualLedger: fileRecord(PATHS.residualLedger),
      frozenSuite: {
        ...fileRecord(PATHS.frozenSuite),
        staticEvidenceAggregateSha256: frozenSuite.staticEvidence.aggregateSha256,
        reconstructionFixturesAggregateSha256:
          frozenSuite.reconstructionFixtures.aggregateSha256,
      },
    },
    blockers: [
      'two-external-offline-apk-backups-unverified',
      'public-rights-unapproved',
      'cooper-black-treatment-undecided',
      'protected-runner-pages-environment-and-production-url-unavailable',
    ],
    publicReleaseManifest: fileRecord(PATHS.publicRelease),
  };
  writeFileSync(resolve(ROOT, PATHS.output), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = generateTechnicalCloseoutManifest({
    validateWorkspaceArtifacts: !process.argv.includes('--report-only'),
  });
  process.stdout.write(
    `PASS technical closeout: Android ${manifest.canonicalArtifacts.android.sha256}, `
    + `H5 ${manifest.canonicalArtifacts.h5.treeDigestSha256}; public release blocked\n`,
  );
}
