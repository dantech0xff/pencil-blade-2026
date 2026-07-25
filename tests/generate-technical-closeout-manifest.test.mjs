#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
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

test('technical closeout binds one canonical artifact set and keeps public release blocked', () => {
  const manifest = generateTechnicalCloseoutManifest();
  assert.equal(manifest.status.technicalReconstruction, 'pass');
  assert.equal(manifest.status.publicRelease, 'blocked');
  assert.equal(manifest.status.programCloseout, 'blocked');
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
  assert.equal(manifest.blockers.length, 4);

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
