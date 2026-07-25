#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  copyFileSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  generateTechnicalCloseoutManifest,
  validateWorkspaceArtifacts,
} from '../scripts/generate-technical-closeout-manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function linkOrCopy(source, destination) {
  try {
    linkSync(source, destination);
  } catch (error) {
    if (!['EACCES', 'EPERM', 'EXDEV', 'ENOTSUP'].includes(error.code)) {
      throw error;
    }
    copyFileSync(source, destination);
  }
}

test('technical closeout binds canonical artifacts and the passing academic Pages release', () => {
  const manifest = generateTechnicalCloseoutManifest({ writeOutput: false });
  assert.equal(manifest.status.technicalReconstruction, 'pass');
  assert.equal(manifest.status.publicRelease, 'academic-scope-pass');
  assert.equal(manifest.status.programCloseout, 'pass');
  assert.equal(
    manifest.canonicalArtifacts.android.sha256,
    'e313e149164eec8664b934a16e3c14b3a0f0265f9c7bb6306375a08a7cb5c37d',
  );
  assert.equal(
    manifest.canonicalArtifacts.h5.treeDigestSha256,
    '90f0fed3042364f02cfb6dbe888d32561c71ca9a2218d4316f2ae8a879cb2b54',
  );
  assert.equal(manifest.fidelity.metricVersion, '1.1.0');
  assert.equal(manifest.fidelity.overallScorePercent, 100);
  assert.equal(manifest.fidelity.unexplainedDivergences, 0);
  assert.equal(
    manifest.productionPages.productionUrl,
    'https://dantech0xff.github.io/pencil-blade-2026/',
  );
  assert.equal(manifest.productionPages.deployment.environment, 'github-pages');
  assert.equal(manifest.productionPages.publishedFiles.checked, 2539);
  assert.deepEqual(manifest.productionPages.publishedFiles.failures, []);
  assert.deepEqual(manifest.productionPages.runtimeRows, [
    'chrome-480x800',
    'chrome-720x1280',
  ]);
  assert.deepEqual(manifest.blockers, []);

  for (const path of [
    'docs/cocos-creator-build-audit.md',
    'docs/reconstruction-report.md',
    'plans/260721-2253-pencil-blade-restoration/phase-07-validate-fidelity-and-prepare-release.md',
  ]) {
    const source = readFileSync(resolve(ROOT, path), 'utf8');
    assert.ok(source.includes(manifest.canonicalArtifacts.android.sha256), `${path} APK hash`);
    assert.ok(
      source.includes(manifest.canonicalArtifacts.h5.treeDigestSha256),
      `${path} H5 digest`,
    );
  }
});

test('strict workspace validation rejects missing and drifted Android artifacts', () => {
  const android = JSON.parse(readFileSync(
    resolve(
      ROOT,
      'plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/android-runtime-matrix.json',
    ),
    'utf8',
  ));
  const h5 = JSON.parse(readFileSync(
    resolve(
      ROOT,
      'plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/h5-runtime-matrix.json',
    ),
    'utf8',
  ));
  const fixtureRoot = mkdtempSync(resolve(tmpdir(), 'pencil-closeout-'));
  try {
    assert.throws(
      () => validateWorkspaceArtifacts(android, h5, fixtureRoot),
      /Android artifact is missing/u,
    );
    const apkPath = resolve(fixtureRoot, android.artifact.path);
    mkdirSync(dirname(apkPath), { recursive: true });
    writeFileSync(apkPath, 'drift');
    assert.throws(
      () => validateWorkspaceArtifacts(android, h5, fixtureRoot),
      /Android artifact byte count drifted/u,
    );
  } finally {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
});

test('strict workspace validation rejects H5 audit findings before artifact totals', () => {
  const android = JSON.parse(readFileSync(
    resolve(
      ROOT,
      'plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/android-runtime-matrix.json',
    ),
    'utf8',
  ));
  const h5 = JSON.parse(readFileSync(
    resolve(
      ROOT,
      'plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/h5-runtime-matrix.json',
    ),
    'utf8',
  ));
  const fixtureRoot = mkdtempSync(resolve(tmpdir(), 'pencil-closeout-h5-'));
  try {
    const apkPath = resolve(fixtureRoot, android.artifact.path);
    mkdirSync(dirname(apkPath), { recursive: true });
    linkOrCopy(resolve(ROOT, android.artifact.path), apkPath);

    const webPath = resolve(fixtureRoot, h5.build.directory);
    mkdirSync(webPath, { recursive: true });
    writeFileSync(resolve(webPath, 'index.html'), '<!doctype html><title>incomplete</title>');

    assert.throws(
      () => validateWorkspaceArtifacts(android, h5, fixtureRoot),
      /H5 artifact audit failed/u,
    );
  } finally {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
});
