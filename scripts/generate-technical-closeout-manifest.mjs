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
  productionPages:
    'plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/production-pages/production-pages-runtime.json',
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
  requireCondition(audit.findings.length === 0, 'H5 artifact audit failed');
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
  const productionPages = readJson(PATHS.productionPages);

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
  requireCondition(
    productionPages.status === 'pass',
    'Production Pages runtime matrix is not passing',
  );
  requireCondition(
    productionPages.productionUrl === 'https://dantech0xff.github.io/pencil-blade-2026/',
    'Production Pages URL drifted',
  );
  requireCondition(
    productionPages.deployment.environment === 'github-pages',
    'Production Pages environment drifted',
  );
  requireCondition(
    productionPages.browser.product === h5.browser.product
      && productionPages.browser.version === h5.browser.version,
    'Production Pages browser drifted',
  );
  requireCondition(
    productionPages.publishedFiles.expected === h5.build.files
      && productionPages.publishedFiles.checked === h5.build.files
      && productionPages.publishedFiles.failures.length === 0,
    'Production Pages asset reachability is incomplete',
  );
  const expectedRows = new Map(h5.rows.map((row) => [row.id, row]));
  requireCondition(
    productionPages.rows.length === expectedRows.size
      && new Set(productionPages.rows.map((row) => row.id)).size === expectedRows.size
      && productionPages.rows.every((row) => {
        const expected = expectedRows.get(row.id);
        return expected
          && row.status === 'pass'
          && row.httpStatus === 200
          && row.viewport.width === expected.viewport.width
          && row.viewport.height === expected.viewport.height
          && row.input.newGameGestureChangedFrame === true
          && row.input.classicGestureChangedFrame === true
          && row.audio.backendAvailable === true
          && row.audio.contextStates.includes('running')
          && row.storage.retainedAcrossLifecycle === true
          && row.storage.probeRemovedAfterTest === true
          && row.lifecycle.backgroundForeground === 'pass'
          && row.lifecycle.canvasVisibleAfterResume === true
          && row.orientation.declared === 'portrait'
          && row.orientation.landscape.canvasVisible === true
          && row.orientation.restoredPortrait.width === expected.viewport.width
          && row.orientation.restoredPortrait.height === expected.viewport.height
          && row.orientation.restoredPortrait.canvasVisible === true
          && row.offline.postLoadGameplay === 'pass'
          && row.offline.canvasVisible === true
          && row.console.errors.length === 0
          && row.console.pageErrors.length === 0
          && row.console.requestFailures.length === 0
          && row.console.badResponses.length === 0
          && row.screenshots.length === 3;
      }),
    'Production Pages runtime rows are incomplete',
  );
  for (const screenshot of productionPages.rows.flatMap((row) => row.screenshots)) {
    requireCondition(existsSync(resolve(ROOT, screenshot.path)), `Missing ${screenshot.path}`);
    requireCondition(
      fileRecord(screenshot.path).sha256 === screenshot.sha256,
      `Production screenshot drifted: ${screenshot.path}`,
    );
  }
  if (options.validateWorkspaceArtifacts !== false) {
    validateWorkspaceArtifacts(android, h5);
  }

  const manifest = {
    schemaVersion: 1,
    status: {
      technicalReconstruction: 'pass',
      publicRelease: 'academic-scope-pass',
      programCloseout: 'pass',
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
    productionPages: {
      productionUrl: productionPages.productionUrl,
      deployment: productionPages.deployment,
      browser: productionPages.browser,
      publishedFiles: productionPages.publishedFiles,
      runtimeRows: productionPages.rows.map((row) => row.id),
      report: fileRecord(PATHS.productionPages),
    },
    blockers: [],
    publicReleaseManifest: {
      ...fileRecord(PATHS.publicRelease),
      disposition:
        'Owner-waived and out of scope for the academic restoration deployment.',
    },
  };
  if (options.writeOutput !== false) {
    writeFileSync(resolve(ROOT, PATHS.output), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = generateTechnicalCloseoutManifest({
    validateWorkspaceArtifacts: !process.argv.includes('--report-only'),
  });
  process.stdout.write(
    `PASS technical closeout: Android ${manifest.canonicalArtifacts.android.sha256}, `
    + `H5 ${manifest.canonicalArtifacts.h5.treeDigestSha256}; `
    + `Pages ${manifest.productionPages.productionUrl}\n`,
  );
}
