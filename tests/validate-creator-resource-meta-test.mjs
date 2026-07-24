#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PINNED,
  auditCreatorMetadata,
  fullRectangle,
  parseCli,
  pngDimensions,
} from '../scripts/validate-creator-resource-meta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'validate-creator-resource-meta.mjs');
const STAGING_MANIFEST = path.join(ROOT, 'assets', 'catalog', 'creator-staging-manifest.json');
const REAL_ASSET_ROOT = path.join(ROOT, 'game', 'assets', 'game');
const REAL_ROOT_META = path.join(ROOT, 'game', 'assets', 'game.meta');
const SUITE_ROOT = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'creator-meta-audit-tests-'));
const EDITOR_INFO = path.join(SUITE_ROOT, 'info.json');
const MUTABLE_ASSET_ROOT = path.join(SUITE_ROOT, 'game');
const MUTABLE_ROOT_META = path.join(SUITE_ROOT, 'game.meta');

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function options(
  assetRoot = REAL_ASSET_ROOT,
  rootMetaPath = REAL_ROOT_META,
  stagingManifestPath = STAGING_MANIFEST,
) {
  return {
    stagingManifestPath,
    assetRoot,
    rootMetaPath,
    editorInfoPath: EDITOR_INFO,
  };
}

before(() => {
  writeJson(EDITOR_INFO, { editor: PINNED.editor, engine: PINNED.engine });
  fs.cpSync(REAL_ASSET_ROOT, MUTABLE_ASSET_ROOT, { recursive: true, preserveTimestamps: false });
  fs.copyFileSync(REAL_ROOT_META, MUTABLE_ROOT_META);
});

after(() => {
  fs.rmSync(SUITE_ROOT, { recursive: true, force: true });
});

test('audits every current Creator resource and reports only known fidelity blockers', () => {
  const report = auditCreatorMetadata(options());

  assert.equal(report.status, 'fidelity-blocked');
  assert.deepEqual(report.structuralErrors, []);
  assert.deepEqual(report.inventory, {
    assets: 862,
    bytes: 32_945_747,
    sidecars: 935,
    directories: 73,
    metadataRecords: 2503,
  });
  assert.equal(report.uuids.total, 2503);
  assert.equal(report.uuids.duplicates, 0);
  assert.equal(report.uuids.manifestSha256, PINNED.uuidManifestSha256);
  assert.equal(report.spriteFrames.total, 784);
  assert.equal(report.spriteFrames.trimTypes.none, 784);
  assert.equal(report.spriteFrames.trimmedGeometry, 0);
  assert.equal(report.spriteFrames.targetCompliant, 784);
  assert.equal(report.otf.status, 'unsupported-consumer-blocked');
  assert.equal(report.fidelityBlockers.length, 1);
});

test('metadata audit accepts consumer-ledger churn but rejects the wrong manifest schema', () => {
  const consumerChurnPath = path.join(SUITE_ROOT, 'consumer-churn-manifest.json');
  const consumerChurn = readJson(STAGING_MANIFEST);
  consumerChurn.entries[0].consumerStatus = 'unknown';
  delete consumerChurn.entries[0].consumerIds;
  consumerChurn.entries[0].consumerDispositionId = 'metadata-audit-does-not-own-this-field';
  writeJson(consumerChurnPath, consumerChurn);
  const churnReport = auditCreatorMetadata(options(
    REAL_ASSET_ROOT,
    REAL_ROOT_META,
    consumerChurnPath,
  ));
  assert.equal(churnReport.status, 'fidelity-blocked');
  assert.deepEqual(churnReport.structuralErrors, []);

  const wrongSchemaPath = path.join(SUITE_ROOT, 'wrong-schema-manifest.json');
  const wrongSchema = readJson(STAGING_MANIFEST);
  wrongSchema.schemaVersion = 1;
  writeJson(wrongSchemaPath, wrongSchema);
  const wrongSchemaReport = auditCreatorMetadata(options(
    REAL_ASSET_ROOT,
    REAL_ROOT_META,
    wrongSchemaPath,
  ));
  assert.equal(wrongSchemaReport.status, 'structurally-invalid');
  assert.ok(wrongSchemaReport.structuralErrors.some((message) => (
    message.startsWith('staging manifest schema:')
  )));
});

test('CLI distinguishes fidelity blockers from structural corruption', () => {
  const result = spawnSync(process.execPath, [
    SCRIPT,
    'audit',
    '--staging-manifest', STAGING_MANIFEST,
    '--asset-root', REAL_ASSET_ROOT,
    '--root-meta', REAL_ROOT_META,
    '--editor-info', EDITOR_INFO,
  ], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  assert.equal(result.status, 2, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'fidelity-blocked');
});

test('detects a missing sidecar using actual filesystem counts', () => {
  const metaPath = path.join(MUTABLE_ASSET_ROOT, 'Fonts', 'COOPBL.TTF.meta');
  const original = fs.readFileSync(metaPath);
  fs.unlinkSync(metaPath);
  try {
    const report = auditCreatorMetadata(options(MUTABLE_ASSET_ROOT, MUTABLE_ROOT_META));
    assert.equal(report.status, 'structurally-invalid');
    assert.equal(report.inventory.sidecars, 934);
    assert.ok(report.structuralErrors.some((message) => message.includes('missing Fonts/COOPBL.TTF.meta')));
  } finally {
    fs.writeFileSync(metaPath, original);
  }
});

test('detects duplicate UUIDs and invalid parent-child UUID ownership', () => {
  const firstPath = path.join(MUTABLE_ASSET_ROOT, 'Fonts', 'COOPBL.TTF.meta');
  const secondPath = path.join(MUTABLE_ASSET_ROOT, 'Fonts', 'Linds.ttf.meta');
  const first = readJson(firstPath);
  const second = readJson(secondPath);
  const original = fs.readFileSync(secondPath);
  second.uuid = first.uuid;
  writeJson(secondPath, second);
  try {
    const report = auditCreatorMetadata(options(MUTABLE_ASSET_ROOT, MUTABLE_ROOT_META));
    assert.equal(report.status, 'structurally-invalid');
    assert.equal(report.uuids.duplicates, 1);
    assert.ok(report.structuralErrors.some((message) => message.startsWith('duplicate UUID')));
  } finally {
    fs.writeFileSync(secondPath, original);
  }
});

test('detects staged asset byte drift', () => {
  const assetPath = path.join(MUTABLE_ASSET_ROOT, 'Fonts', 'COOPBL.TTF');
  const original = fs.readFileSync(assetPath);
  fs.appendFileSync(assetPath, Buffer.from([0]));
  try {
    const report = auditCreatorMetadata(options(MUTABLE_ASSET_ROOT, MUTABLE_ROOT_META));
    assert.equal(report.status, 'structurally-invalid');
    assert.ok(report.structuralErrors.includes('Fonts/COOPBL.TTF: staged source bytes/hash mismatch'));
  } finally {
    fs.writeFileSync(assetPath, original);
  }
});

test('requires the recovered resource root to stay configured as the game bundle', () => {
  const meta = readJson(MUTABLE_ROOT_META);
  const original = fs.readFileSync(MUTABLE_ROOT_META);
  meta.userData = {};
  writeJson(MUTABLE_ROOT_META, meta);
  try {
    const report = auditCreatorMetadata(options(MUTABLE_ASSET_ROOT, MUTABLE_ROOT_META));
    assert.equal(report.status, 'structurally-invalid');
    assert.ok(report.structuralErrors.includes(
      'game.meta: recovered resources must remain in the game asset bundle',
    ));
  } finally {
    fs.writeFileSync(MUTABLE_ROOT_META, original);
  }
});

test('does not accept an implicit OTF substitution', () => {
  const metaPath = path.join(MUTABLE_ASSET_ROOT, 'Fonts', 'CooperBlackStd.otf.meta');
  const meta = readJson(metaPath);
  const original = fs.readFileSync(metaPath);
  meta.importer = 'ttf-font';
  meta.ver = '1.0.1';
  writeJson(metaPath, meta);
  try {
    const report = auditCreatorMetadata(options(MUTABLE_ASSET_ROOT, MUTABLE_ROOT_META));
    assert.equal(report.status, 'structurally-invalid');
    assert.ok(report.structuralErrors.some((message) => message.includes('OTF must remain exact wildcard metadata')));
  } finally {
    fs.writeFileSync(metaPath, original);
  }
});

test('parses PNG dimensions and recognizes exact full-rectangle geometry', () => {
  const png = fs.readFileSync(path.join(REAL_ASSET_ROOT, '480x800', 'Fruits', 'fruit-apple.png'));
  const dimensions = pngDimensions(png);
  assert.ok(dimensions);

  const halfWidth = dimensions.width / 2;
  const halfHeight = dimensions.height / 2;
  assert.equal(fullRectangle({
    width: dimensions.width,
    height: dimensions.height,
    rawWidth: dimensions.width,
    rawHeight: dimensions.height,
    trimX: 0,
    trimY: 0,
    offsetX: 0,
    offsetY: 0,
    vertices: {
      rawPosition: [-halfWidth, -halfHeight, 0, halfWidth, -halfHeight, 0, -halfWidth, halfHeight, 0, halfWidth, halfHeight, 0],
      indexes: [0, 1, 2, 2, 1, 3],
      uv: [0, dimensions.height, dimensions.width, dimensions.height, 0, 0, dimensions.width, 0],
      nuv: [0, 0, 1, 0, 0, 1, 1, 1],
      minPos: [-halfWidth, -halfHeight, 0],
      maxPos: [halfWidth, halfHeight, 0],
    },
  }, dimensions.width, dimensions.height), true);
});

test('rejects incomplete and duplicate CLI options', () => {
  assert.throws(() => parseCli(['audit']), /missing required option/);
  assert.throws(() => parseCli([
    'audit',
    '--staging-manifest', 'a',
    '--staging-manifest', 'b',
    '--asset-root', 'c',
    '--root-meta', 'd',
    '--editor-info', 'e',
  ]), /duplicate option/);
});
