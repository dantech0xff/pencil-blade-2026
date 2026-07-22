#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CANONICAL_AUTHORITY,
  createTestAuthority,
  formatResult,
  stageAssets,
  verifyAssets,
} from '../scripts/stage-creator-assets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'stage-creator-assets.mjs');
const REAL_SOURCE = path.join(ROOT, '.forensics-work', 'phase-01', 'jadx', 'resources', 'assets');
const REAL_MAP = path.join(ROOT, 'forensics', 'resources', 'resource-usage-map.json');
const REAL_TARGET = path.join(ROOT, 'game', 'assets', 'game');
const REAL_MANIFEST = path.join(ROOT, 'assets', 'catalog', 'creator-staging-manifest.json');
const EXPECTED_REAL_DIGEST = '0143473b21e56525cde92163f72fd49b2a898ab70ef2b224cdad00eaba9238e3';
const EXPECTED_MAP_DIGEST = '165238f13f4186a9ab429c9c5a8bab07b4a42e941d0608f757d9e41a44d2ce67';
const EXPECTED_REAL_BYTES = 32_945_747;
const REAL_TMP_ROOT = fs.realpathSync(os.tmpdir());
const SUITE_ROOT = fs.mkdtempSync(path.join(REAL_TMP_ROOT, 'creator-asset-staging-tests-'));
const FIXTURE_ROOT = path.join(SUITE_ROOT, 'fixture');
const FIXTURE_SOURCE = path.join(FIXTURE_ROOT, 'source-assets');
const FIXTURE_MAP = path.join(FIXTURE_ROOT, 'resource-map.json');

after(() => {
  fs.rmSync(SUITE_ROOT, { recursive: true, force: true });
});

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function writeFixtureFile(sourceRoot, relativePath, contents) {
  const fullPath = path.join(sourceRoot, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, contents);
  return {
    path: relativePath,
    bytes: contents.length,
    sha256: sha256Buffer(contents),
    extension: path.posix.extname(relativePath).toLowerCase(),
  };
}

function canonicalMapRecords(resourceMap) {
  return [
    ...resourceMap.assets.trees['480x800'].files.map((record) => ({ ...record, canonicalPath: `480x800/${record.path}` })),
    ...resourceMap.assets.trees['720x1280'].files.map((record) => ({ ...record, canonicalPath: `720x1280/${record.path}` })),
    ...resourceMap.assets.shared.sounds.map((record) => ({ ...record, canonicalPath: record.path })),
    ...resourceMap.assets.shared.fonts.map((record) => ({ ...record, canonicalPath: record.path })),
  ].sort((left, right) => compareText(left.canonicalPath, right.canonicalPath));
}

function sourceManifestDigest(records) {
  const digest = crypto.createHash('sha256');
  for (const record of records) {
    digest.update(record.canonicalPath);
    digest.update('\0');
    digest.update(record.sha256);
    digest.update('\0');
  }
  return digest.digest('hex');
}

function createSyntheticFixture() {
  fs.mkdirSync(FIXTURE_SOURCE, { recursive: true });
  const tree480 = [];
  const tree720 = [];
  const sounds = [];
  const fonts = [];
  const duplicateBytes = Buffer.from('preserve-duplicate-content');

  for (let index = 0; index < 392; index += 1) {
    const relativePath = index === 0
      ? 'Blades/Particles/VN Flag/vnflagstar.png'
      : index === 1
        ? 'Blades/duplicate-copy.png'
        : `Images/asset-${String(index).padStart(3, '0')}.png`;
    const contents = index <= 1 ? duplicateBytes : Buffer.from(`480x800:${index}`);
    const record = writeFixtureFile(FIXTURE_SOURCE, `480x800/${relativePath}`, contents);
    tree480.push({ ...record, path: relativePath });
  }

  for (let index = 0; index < 392; index += 1) {
    const relativePath = index === 0
      ? 'Blades/Particles/VN Flag/vnflagstar.png'
      : `Images/asset-${String(index).padStart(3, '0')}.png`;
    const record = writeFixtureFile(
      FIXTURE_SOURCE,
      `720x1280/${relativePath}`,
      Buffer.from(`720x1280:${index}`),
    );
    tree720.push({ ...record, path: relativePath });
  }

  for (let index = 0; index < 62; index += 1) {
    const extension = index < 59 ? '.wav' : '.mp3';
    const relativePath = `Sounds/sound-${String(index).padStart(2, '0')}${extension}`;
    sounds.push(writeFixtureFile(FIXTURE_SOURCE, relativePath, Buffer.from(`sound:${index}:${extension}`)));
  }

  for (let index = 0; index < 16; index += 1) {
    const extension = index === 15 ? '.otf' : '.ttf';
    const relativePath = index === 0 ? 'Fonts/Comic Book.ttf' : `Fonts/font-${String(index).padStart(2, '0')}${extension}`;
    fonts.push(writeFixtureFile(FIXTURE_SOURCE, relativePath, Buffer.from(`font:${index}:${extension}`)));
  }

  tree480.sort((left, right) => compareText(left.path, right.path));
  tree720.sort((left, right) => compareText(left.path, right.path));
  sounds.sort((left, right) => compareText(left.path, right.path));
  fonts.sort((left, right) => compareText(left.path, right.path));
  const resourceMap = {
    schemaVersion: 1,
    inputs: { sourceHashes: { assetsManifest: '' } },
    summary: { assets: { png: 784, wav: 59, mp3: 3, fonts: 16, total: 862 } },
    assets: {
      trees: { '480x800': { files: tree480 }, '720x1280': { files: tree720 } },
      shared: { sounds, fonts },
    },
  };
  resourceMap.inputs.sourceHashes.assetsManifest = sourceManifestDigest(canonicalMapRecords(resourceMap));
  fs.writeFileSync(FIXTURE_MAP, `${JSON.stringify(resourceMap, null, 2)}\n`);
}

createSyntheticFixture();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function authorityFor(resourceMapPath) {
  const resourceMap = readJson(resourceMapPath);
  const records = canonicalMapRecords(resourceMap);
  return createTestAuthority({
    resourceMapSha256: sha256File(resourceMapPath),
    sourceManifestSha256: resourceMap.inputs.sourceHashes.assetsManifest,
    totalBytes: records.reduce((sum, record) => sum + record.bytes, 0),
  });
}

const FIXTURE_AUTHORITY = authorityFor(FIXTURE_MAP);

function newCase(label) {
  const caseRoot = fs.mkdtempSync(path.join(SUITE_ROOT, `${label}-`));
  fs.mkdirSync(path.join(caseRoot, 'game', 'assets'), { recursive: true });
  fs.mkdirSync(path.join(caseRoot, 'assets', 'catalog'), { recursive: true });
  return {
    root: caseRoot,
    sourceRoot: FIXTURE_SOURCE,
    resourceMapPath: FIXTURE_MAP,
    targetRoot: path.join(caseRoot, 'game', 'assets', 'game'),
    manifestPath: path.join(caseRoot, 'assets', 'catalog', 'creator-staging-manifest.json'),
  };
}

function runDirect(mode, options, authority = FIXTURE_AUTHORITY, hooks = {}) {
  try {
    const result = mode === 'stage'
      ? stageAssets(options, authority, hooks)
      : verifyAssets(options, authority);
    return { status: 0, stdout: `${formatResult(mode, result)}\n`, stderr: '', result };
  } catch (error) {
    return { status: 1, stdout: '', stderr: `ERROR: ${error.message}\n`, error };
  }
}

function runCli(mode, { sourceRoot, resourceMapPath, targetRoot, manifestPath }) {
  return spawnSync(process.execPath, [
    SCRIPT,
    mode,
    '--source', sourceRoot,
    '--resource-map', resourceMapPath,
    '--target', targetRoot,
    '--manifest', manifestPath,
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function expectSuccess(result, label) {
  assert.equal(result.status, 0, `${label}: expected success\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
}

function expectFailure(result, pattern, label) {
  assert.notEqual(result.status, 0, `${label}: expected failure`);
  if (pattern) assert.match(result.stderr, pattern);
}

function cloneFixtureSource(destination) {
  fs.cpSync(FIXTURE_SOURCE, destination, { recursive: true, preserveTimestamps: false });
}

function collectFiles(rootDir) {
  const records = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.isFile()) records.push(fullPath);
    }
  }
  records.sort(compareText);
  return records;
}

function treeSnapshot(rootDir) {
  return collectFiles(rootDir).map((fullPath) => ({
    path: path.relative(rootDir, fullPath).split(path.sep).join('/'),
    bytes: fs.statSync(fullPath).size,
    sha256: sha256File(fullPath),
  }));
}

function corpusDigest(sourceRoot) {
  const digest = crypto.createHash('sha256');
  for (const filePath of collectFiles(sourceRoot)) {
    const relativePath = path.relative(sourceRoot, filePath).split(path.sep).join('/');
    digest.update(relativePath);
    digest.update('\0');
    digest.update(sha256File(filePath));
    digest.update('\0');
  }
  return digest.digest('hex');
}

function stageOrphans(fixture) {
  return fs.readdirSync(path.dirname(fixture.targetRoot))
    .filter((name) => name.startsWith('.game.stage-'))
    .map((name) => path.join(path.dirname(fixture.targetRoot), name));
}

test('canonical authority constants are pinned and synthetic CLI staging is rejected', () => {
  assert.equal(CANONICAL_AUTHORITY.resourceMapSha256, EXPECTED_MAP_DIGEST);
  assert.equal(CANONICAL_AUTHORITY.sourceManifestSha256, EXPECTED_REAL_DIGEST);
  assert.equal(CANONICAL_AUTHORITY.totalBytes, EXPECTED_REAL_BYTES);
  assert.equal(CANONICAL_AUTHORITY.counts.total, 862);
  const fixture = newCase('synthetic-cli-rejected');
  expectFailure(runCli('stage', fixture), /resource map SHA-256 mismatch/i, 'synthetic CLI authority');
  assert.equal(fs.existsSync(fixture.targetRoot), false);
  assert.equal(fs.existsSync(fixture.manifestPath), false);
});

test('direct fixture staging is deterministic and preserves spaces and duplicate bytes', () => {
  const first = newCase('deterministic-one');
  const second = newCase('deterministic-two');
  const sourceBefore = corpusDigest(FIXTURE_SOURCE);
  expectSuccess(runDirect('stage', first), 'first direct stage');
  expectSuccess(runDirect('stage', second), 'second direct stage');
  const firstManifest = fs.readFileSync(first.manifestPath, 'utf8');
  assert.equal(firstManifest, fs.readFileSync(second.manifestPath, 'utf8'));
  assert.equal(corpusDigest(FIXTURE_SOURCE), sourceBefore);
  const manifest = readJson(first.manifestPath);
  assert.equal(manifest.entries.length, 862);
  assert.equal(manifest.summary.inventory.coveragePercent, 100);
  assert.equal(manifest.summary.staging.coveragePercent, 100);
  assert.deepEqual(manifest.summary.consumers, { mapped: 0, total: 862, coveragePercent: 0, status: 'unmapped' });
  assert.equal(manifest.summary.creatorMetadata.coveragePercent, 0);
  assert.equal(manifest.summary.creatorMetadata.status, 'pending');
  assert.equal(firstManifest.includes(first.root), false);
  assert.equal(/timestamp|createdAt|generatedAt/.test(firstManifest), false);
  const spaced = path.join(first.targetRoot, '480x800', 'Blades', 'Particles', 'VN Flag', 'vnflagstar.png');
  const duplicate = path.join(first.targetRoot, '480x800', 'Blades', 'duplicate-copy.png');
  assert.equal(sha256File(spaced), sha256File(duplicate));
  assert.notEqual(fs.statSync(spaced).ino, fs.statSync(duplicate).ino);
  assert.equal(collectFiles(first.targetRoot).some((filePath) => filePath.endsWith('.meta')), false);
});

test('direct verify is repeatable, non-mutating, and permits only expected meta sidecars', () => {
  const fixture = newCase('verify-rerun');
  expectSuccess(runDirect('stage', fixture), 'stage');
  fs.writeFileSync(path.join(fixture.targetRoot, '480x800.meta'), 'creator-owned\n');
  const assetMeta = path.join(fixture.targetRoot, '480x800', 'Images', 'asset-002.png.meta');
  fs.writeFileSync(assetMeta, 'creator-owned\n');
  const before = treeSnapshot(fixture.targetRoot);
  const first = runDirect('verify', fixture);
  const second = runDirect('verify', fixture);
  expectSuccess(first, 'first verify');
  expectSuccess(second, 'second verify');
  assert.equal(first.stdout, second.stdout);
  assert.match(first.stdout, /creator_meta_sidecars=2\/874/);
  assert.match(first.stdout, /creator_meta_status=partial-unparsed/);
  assert.deepEqual(treeSnapshot(fixture.targetRoot), before);
  fs.writeFileSync(path.join(fixture.targetRoot, 'unexpected.meta'), 'unexpected\n');
  expectFailure(runDirect('verify', fixture), /unexpected file/i, 'unexpected meta');
});

test('resource-map structure rejects omissions, duplicates, traversal, unsupported types, and NFC collisions', () => {
  const mutations = [
    {
      label: 'omitted',
      mutate(map) { map.assets.trees['480x800'].files.pop(); },
      pattern: /exactly 392 entries/i,
    },
    {
      label: 'duplicate',
      mutate(map) { map.assets.trees['480x800'].files[1] = { ...map.assets.trees['480x800'].files[0] }; },
      pattern: /duplicate source path/i,
    },
    {
      label: 'traversal',
      mutate(map) { map.assets.trees['480x800'].files[2].path = '../escape.png'; },
      pattern: /traversal|non-canonical/i,
    },
    {
      label: 'backslash',
      mutate(map) { map.assets.trees['480x800'].files[2].path = 'Images\\escape.png'; },
      pattern: /POSIX separators/i,
    },
    {
      label: 'unsupported',
      mutate(map) {
        map.assets.trees['480x800'].files[2].path = 'Images/escape.gif';
        map.assets.trees['480x800'].files[2].extension = '.gif';
      },
      pattern: /unsupported extension/i,
    },
    {
      label: 'nfc-collision',
      mutate(map) {
        map.assets.trees['480x800'].files[0].path = 'Images/Café.png';
        map.assets.trees['480x800'].files[1].path = 'Images/Cafe\u0301.png';
      },
      pattern: /Unicode-normalization source collision/i,
    },
  ];

  for (const mutation of mutations) {
    const fixture = newCase(`map-${mutation.label}`);
    const resourceMap = readJson(FIXTURE_MAP);
    mutation.mutate(resourceMap);
    const mapPath = path.join(fixture.root, `${mutation.label}.json`);
    writeJson(mapPath, resourceMap);
    fixture.resourceMapPath = mapPath;
    expectFailure(runDirect('stage', fixture, authorityFor(mapPath)), mutation.pattern, mutation.label);
  }
});

test('source rejects extra, changed, symlinked, unsupported, and hardlinked files', () => {
  const cases = [
    {
      label: 'extra',
      mutate(source) { fs.writeFileSync(path.join(source, 'extra.png'), 'extra'); },
      pattern: /extra asset|unexpected directory/i,
    },
    {
      label: 'changed',
      mutate(source) { fs.appendFileSync(path.join(source, 'Sounds', 'sound-00.wav'), 'changed'); },
      pattern: /byte-size mismatch|SHA-256 mismatch/i,
    },
    {
      label: 'symlink',
      mutate(source) {
        const filePath = path.join(source, 'Sounds', 'sound-00.wav');
        fs.unlinkSync(filePath);
        fs.symlinkSync('sound-01.wav', filePath);
      },
      pattern: /symlink is not allowed/i,
    },
    {
      label: 'unsupported',
      mutate(source) { fs.writeFileSync(path.join(source, 'unsupported.gif'), 'gif'); },
      pattern: /unsupported extension|extra asset/i,
    },
    {
      label: 'hardlink',
      mutate(source, fixture) {
        fs.linkSync(path.join(source, 'Sounds', 'sound-00.wav'), path.join(fixture.root, 'outside-source-alias.wav'));
      },
      pattern: /exactly one hard link/i,
    },
  ];

  for (const item of cases) {
    const fixture = newCase(`source-${item.label}`);
    const source = path.join(fixture.root, 'source-assets');
    cloneFixtureSource(source);
    fixture.sourceRoot = source;
    item.mutate(source, fixture);
    expectFailure(runDirect('stage', fixture), item.pattern, item.label);
    assert.equal(fs.existsSync(fixture.targetRoot), false);
  }
});

test('source inode swap after validation fails closed and retains the staging orphan', () => {
  const fixture = newCase('source-swap');
  const source = path.join(fixture.root, 'source-assets');
  cloneFixtureSource(source);
  fixture.sourceRoot = source;
  const swapped = path.join(source, 'Sounds', 'sound-00.wav');
  const originalBytes = fs.readFileSync(swapped);
  const result = runDirect('stage', fixture, FIXTURE_AUTHORITY, {
    afterStagingDirectoryCreated() {
      fs.unlinkSync(swapped);
      fs.writeFileSync(swapped, originalBytes);
    },
  });
  expectFailure(result, /path identity changed|identity changed before copy/i, 'source swap');
  assert.match(result.stderr, /orphaned staging directory retained/i);
  assert.equal(stageOrphans(fixture).length, 1);
  assert.equal(fs.existsSync(fixture.targetRoot), false);
});

test('verification rejects target-to-source and target-to-target hardlinks', () => {
  const sourceAlias = newCase('target-source-hardlink');
  const source = path.join(sourceAlias.root, 'source-assets');
  cloneFixtureSource(source);
  sourceAlias.sourceRoot = source;
  expectSuccess(runDirect('stage', sourceAlias), 'source alias stage');
  const sourceFile = path.join(source, 'Sounds', 'sound-00.wav');
  const targetFile = path.join(sourceAlias.targetRoot, 'Sounds', 'sound-00.wav');
  fs.unlinkSync(targetFile);
  fs.linkSync(sourceFile, targetFile);
  expectFailure(runDirect('verify', sourceAlias), /exactly one hard link|aliases a source/i, 'target-to-source hardlink');

  const targetAlias = newCase('target-target-hardlink');
  expectSuccess(runDirect('stage', targetAlias), 'target alias stage');
  const first = path.join(targetAlias.targetRoot, 'Sounds', 'sound-00.wav');
  const second = path.join(targetAlias.targetRoot, 'Sounds', 'sound-01.wav');
  fs.unlinkSync(second);
  fs.linkSync(first, second);
  expectFailure(runDirect('verify', targetAlias), /exactly one hard link|identity is aliased/i, 'target-to-target hardlink');
});

test('stage requires both target and manifest to be absent, including an empty target', () => {
  const empty = newCase('empty-target');
  fs.mkdirSync(empty.targetRoot);
  expectFailure(runDirect('stage', empty), /target must be absent/i, 'empty target');
  assert.deepEqual(fs.readdirSync(empty.targetRoot), []);

  const occupied = newCase('occupied-target');
  fs.mkdirSync(occupied.targetRoot);
  const sentinel = path.join(occupied.targetRoot, 'keep.txt');
  fs.writeFileSync(sentinel, 'user content\n');
  expectFailure(runDirect('stage', occupied), /target must be absent/i, 'occupied target');
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'user content\n');

  const manifest = newCase('existing-manifest');
  fs.writeFileSync(manifest.manifestPath, 'user manifest\n');
  expectFailure(runDirect('stage', manifest), /manifest output must be absent/i, 'existing manifest');
  assert.equal(fs.readFileSync(manifest.manifestPath, 'utf8'), 'user manifest\n');
  assert.equal(fs.existsSync(manifest.targetRoot), false);
});

test('stage rejects ancestor symlinks and an existing exclusive lock', () => {
  const symlinked = newCase('ancestor-symlink');
  const realProject = path.join(symlinked.root, 'real-project');
  fs.mkdirSync(path.join(realProject, 'game', 'assets'), { recursive: true });
  const projectLink = path.join(symlinked.root, 'project-link');
  fs.symlinkSync(realProject, projectLink);
  symlinked.targetRoot = path.join(projectLink, 'game', 'assets', 'game');
  expectFailure(runDirect('stage', symlinked), /ancestor must not be a symlink/i, 'ancestor symlink');
  assert.equal(fs.existsSync(path.join(realProject, 'game', 'assets', 'game')), false);

  const locked = newCase('existing-lock');
  const lockPath = `${locked.targetRoot}.stage.lock`;
  fs.writeFileSync(lockPath, 'other owner\n');
  expectFailure(runDirect('stage', locked), /lock could not be acquired exclusively/i, 'existing lock');
  assert.equal(fs.readFileSync(lockPath, 'utf8'), 'other owner\n');
});

test('lock initialization failures remove only a safely-owned lock and report an uncertain retained path', () => {
  const owned = newCase('lock-init-owned');
  const ownedLockPath = `${owned.targetRoot}.stage.lock`;
  const ownedResult = runDirect('stage', owned, FIXTURE_AUTHORITY, {
    afterStageLockWrite() {
      throw new Error('injected owned lock initialization failure');
    },
  });
  expectFailure(ownedResult, /injected owned lock initialization failure/i, 'owned lock initialization');
  assert.equal(fs.existsSync(ownedLockPath), false);
  assert.equal(stageOrphans(owned).length, 0);
  assert.equal(fs.existsSync(owned.targetRoot), false);
  assert.equal(fs.existsSync(owned.manifestPath), false);

  const uncertain = newCase('lock-init-uncertain');
  const uncertainLockPath = `${uncertain.targetRoot}.stage.lock`;
  const uncertainResult = runDirect('stage', uncertain, FIXTURE_AUTHORITY, {
    afterStageLockWrite({ lockPath }) {
      fs.unlinkSync(lockPath);
      fs.writeFileSync(lockPath, 'replacement lock\n');
      throw new Error('injected uncertain lock initialization failure');
    },
  });
  expectFailure(uncertainResult, /injected uncertain lock initialization failure/i, 'uncertain lock initialization');
  assert.match(uncertainResult.stderr, /replacement retained at lock path/i);
  assert.ok(uncertainResult.stderr.includes(uncertainLockPath));
  assert.equal(fs.readFileSync(uncertainLockPath, 'utf8'), 'replacement lock\n');
  assert.equal(stageOrphans(uncertain).length, 0);
  assert.equal(fs.existsSync(uncertain.targetRoot), false);
  assert.equal(fs.existsSync(uncertain.manifestPath), false);
});

test('manifest equal to or inside target is rejected before target-side parent creation', () => {
  for (const relation of ['equal', 'inside']) {
    const fixture = newCase(`manifest-${relation}-target`);
    fixture.manifestPath = relation === 'equal'
      ? fixture.targetRoot
      : path.join(fixture.targetRoot, 'catalog', 'creator-staging-manifest.json');

    expectFailure(
      runDirect('stage', fixture),
      /manifest output must not be inside target/i,
      `manifest ${relation} target`,
    );
    assert.equal(fs.existsSync(fixture.targetRoot), false);
    assert.equal(fs.existsSync(`${fixture.targetRoot}.stage.lock`), false);
  }
});

test('failure after temporary staging retains an explicit orphan and never recursively cleans it', () => {
  const fixture = newCase('orphan-retained');
  let sentinel;
  const result = runDirect('stage', fixture, FIXTURE_AUTHORITY, {
    afterStagingDirectoryCreated({ stagePath }) {
      sentinel = path.join(stagePath, 'concurrent-user-data.txt');
      fs.writeFileSync(sentinel, 'retain me\n');
      throw new Error('injected failure');
    },
  });
  expectFailure(result, /injected failure/i, 'injected staging failure');
  assert.match(result.stderr, /orphaned staging directory retained/i);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'retain me\n');
  assert.equal(stageOrphans(fixture).length, 1);
  assert.equal(fs.existsSync(`${fixture.targetRoot}.stage.lock`), false);
});

test('concurrent target and manifest data are retained without overwrite or deletion', () => {
  const targetRace = newCase('concurrent-target');
  let targetSentinel;
  const targetResult = runDirect('stage', targetRace, FIXTURE_AUTHORITY, {
    beforeTargetPublication({ targetRoot }) {
      fs.mkdirSync(targetRoot);
      targetSentinel = path.join(targetRoot, 'concurrent.txt');
      fs.writeFileSync(targetSentinel, 'concurrent target\n');
    },
  });
  expectFailure(targetResult, /target must be absent/i, 'concurrent target');
  assert.equal(fs.readFileSync(targetSentinel, 'utf8'), 'concurrent target\n');
  assert.equal(stageOrphans(targetRace).length, 1);

  const manifestRace = newCase('concurrent-manifest');
  const manifestResult = runDirect('stage', manifestRace, FIXTURE_AUTHORITY, {
    beforeManifestPublication({ manifestPath }) {
      fs.writeFileSync(manifestPath, 'concurrent manifest\n');
    },
  });
  expectFailure(manifestResult, /manifest output must be absent/i, 'concurrent manifest');
  assert.match(manifestResult.stderr, /completed target retained/i);
  assert.equal(fs.readFileSync(manifestRace.manifestPath, 'utf8'), 'concurrent manifest\n');
  assert.equal(collectFiles(manifestRace.targetRoot).length, 862);
});

test('a replaced stage lock is never unlinked by cleanup', () => {
  const fixture = newCase('lock-replaced');
  let replacementPath;
  const result = runDirect('stage', fixture, FIXTURE_AUTHORITY, {
    afterStagingDirectoryCreated({ lockPath }) {
      replacementPath = lockPath;
      fs.unlinkSync(lockPath);
      fs.writeFileSync(lockPath, 'replacement lock\n');
      throw new Error('lock replacement injection');
    },
  });
  expectFailure(result, /lock replacement injection/i, 'lock replacement');
  assert.match(result.stderr, /replacement retained/i);
  assert.equal(fs.readFileSync(replacementPath, 'utf8'), 'replacement lock\n');
  assert.equal(stageOrphans(fixture).length, 1);
});

test('manifest inside source and post-stage manifest tampering are rejected without source mutation', () => {
  const unsafe = newCase('manifest-inside-source');
  const source = path.join(unsafe.root, 'source-assets');
  cloneFixtureSource(source);
  unsafe.sourceRoot = source;
  const before = treeSnapshot(source);
  unsafe.manifestPath = path.join(source, 'generated', 'creator-staging-manifest.json');
  expectFailure(runDirect('stage', unsafe), /manifest output must not be inside the immutable source root/i, 'manifest inside source');
  assert.deepEqual(treeSnapshot(source), before);

  const tampered = newCase('manifest-tamper');
  expectSuccess(runDirect('stage', tampered), 'manifest tamper stage');
  const manifest = readJson(tampered.manifestPath);
  manifest.entries[0].consumerStatus = 'mapped-without-evidence';
  writeJson(tampered.manifestPath, manifest);
  expectFailure(runDirect('verify', tampered), /manifest does not match/i, 'manifest tamper verify');
});

test('verify rejects missing, changed, unexpected, and hardlinked target files', () => {
  const missing = newCase('verify-missing');
  expectSuccess(runDirect('stage', missing), 'missing stage');
  fs.unlinkSync(path.join(missing.targetRoot, 'Sounds', 'sound-00.wav'));
  expectFailure(runDirect('verify', missing), /missing canonical asset/i, 'missing target');

  const changed = newCase('verify-changed');
  expectSuccess(runDirect('stage', changed), 'changed stage');
  fs.appendFileSync(path.join(changed.targetRoot, 'Sounds', 'sound-00.wav'), 'changed');
  expectFailure(runDirect('verify', changed), /byte-size mismatch|SHA-256 mismatch/i, 'changed target');

  const extra = newCase('verify-extra');
  expectSuccess(runDirect('stage', extra), 'extra stage');
  fs.writeFileSync(path.join(extra.targetRoot, 'extra.png'), 'extra');
  expectFailure(runDirect('verify', extra), /unexpected file/i, 'extra target');
});

test('production CLI rejects resource-map hash tampering', () => {
  const fixture = newCase('map-hash-tamper');
  const mapPath = path.join(fixture.root, 'resource-map.json');
  fs.copyFileSync(REAL_MAP, mapPath);
  fs.appendFileSync(mapPath, ' \n');
  fixture.sourceRoot = REAL_SOURCE;
  fixture.resourceMapPath = mapPath;
  expectFailure(runCli('stage', fixture), /resource map SHA-256 mismatch/i, 'map hash tamper');
  assert.equal(fs.existsSync(fixture.targetRoot), false);
});

test('production CLI rejects a changed source even when its copied map is updated to match', { timeout: 120_000 }, () => {
  const fixture = newCase('source-map-tamper');
  const source = path.join(fixture.root, 'source-assets');
  fs.cpSync(REAL_SOURCE, source, { recursive: true, preserveTimestamps: false });
  const changedPath = path.join(source, 'Sounds', 'apple.wav');
  fs.appendFileSync(changedPath, 'changed');
  const resourceMap = readJson(REAL_MAP);
  const changedRecord = resourceMap.assets.shared.sounds.find((record) => record.path === 'Sounds/apple.wav');
  changedRecord.bytes = fs.statSync(changedPath).size;
  changedRecord.sha256 = sha256File(changedPath);
  resourceMap.inputs.sourceHashes.assetsManifest = sourceManifestDigest(canonicalMapRecords(resourceMap));
  const mapPath = path.join(fixture.root, 'updated-resource-map.json');
  writeJson(mapPath, resourceMap);
  fixture.sourceRoot = source;
  fixture.resourceMapPath = mapPath;
  expectFailure(runCli('stage', fixture), /resource map SHA-256 mismatch/i, 'changed source and map');
  assert.equal(fs.existsSync(fixture.targetRoot), false);
  assert.equal(fs.existsSync(fixture.manifestPath), false);
});

test('production CLI stages the canonical corpus into a fresh temporary project', { timeout: 120_000 }, () => {
  const fixture = newCase('real-corpus-stage');
  fixture.sourceRoot = REAL_SOURCE;
  fixture.resourceMapPath = REAL_MAP;
  const sourceBefore = corpusDigest(REAL_SOURCE);
  const stage = runCli('stage', fixture);
  expectSuccess(stage, 'real corpus stage');
  assert.match(stage.stdout, /assets=862\/862/);
  assert.match(stage.stdout, /bytes=32945747/);
  assert.match(stage.stdout, new RegExp(`source_manifest_sha256=${EXPECTED_REAL_DIGEST}`));
  assert.match(stage.stdout, /creator_meta_sidecars=0\/934/);
  const verify = runCli('verify', fixture);
  expectSuccess(verify, 'real corpus temporary verify');
  assert.match(verify.stdout, /byte_mismatches=0/);
  assert.equal(collectFiles(fixture.targetRoot).length, 862);
  assert.equal(corpusDigest(REAL_SOURCE), sourceBefore);
});

test('production CLI verifies the current Creator-imported corpus with all 934 metas', { timeout: 120_000 }, () => {
  assert.equal(sha256File(REAL_MAP), EXPECTED_MAP_DIGEST);
  assert.equal(corpusDigest(REAL_SOURCE), EXPECTED_REAL_DIGEST);
  const beforeTarget = treeSnapshot(REAL_TARGET);
  const beforeManifest = fs.readFileSync(REAL_MANIFEST, 'utf8');
  const verify = runCli('verify', {
    sourceRoot: REAL_SOURCE,
    resourceMapPath: REAL_MAP,
    targetRoot: REAL_TARGET,
    manifestPath: REAL_MANIFEST,
  });
  expectSuccess(verify, 'current real verify');
  assert.match(verify.stdout, /assets=862\/862/);
  assert.match(verify.stdout, /bytes=32945747/);
  assert.match(verify.stdout, /creator_meta_sidecars=934\/934/);
  assert.match(verify.stdout, /creator_meta_status=present-unparsed/);
  assert.deepEqual(treeSnapshot(REAL_TARGET), beforeTarget);
  assert.equal(fs.readFileSync(REAL_MANIFEST, 'utf8'), beforeManifest);
});
