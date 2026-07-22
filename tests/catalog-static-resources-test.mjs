#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'catalog-static-resources.mjs');
const RESOURCES_ROOT = path.join(ROOT, '.forensics-work', 'phase-01', 'jadx', 'resources');
const ASSETS_ROOT = path.join(RESOURCES_ROOT, 'assets');
const RES_ROOT = path.join(RESOURCES_ROOT, 'res');
const NATIVE_STRINGS = path.join(ROOT, '.forensics-work', 'phase-01', 'native', 'strings.txt');
const CURATED_CATALOG = path.join(ROOT, 'forensics', 'resources', 'resource-usage-map.json');
const TEST_TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-static-test-suite-'));

process.on('exit', () => {
  fs.rmSync(TEST_TMP_ROOT, { recursive: true, force: true });
});

let pass = 0;
let fail = 0;
const started = process.hrtime.bigint();

function logOk(name) {
  console.log(`PASS ${name}`);
  pass += 1;
}

function logFail(name, error) {
  console.error(`FAIL ${name}`);
  if (error) {
    console.error(String(error.stack || error.message || error));
  }
  fail += 1;
}

function runNode(args, cwd = ROOT) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function ensureSuccess(result, label) {
  assert.equal(result.status, 0, `${label}: expected success, got ${result.status}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
}

function ensureFailure(result, label) {
  assert.notEqual(result.status, 0, `${label}: expected failure`);
}

function collectFiles(rootDir) {
  const entries = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        entries.push(full);
      }
    }
  }
  entries.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return entries;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function manifestDigest(rootDir) {
  const hash = crypto.createHash('sha256');
  for (const file of collectFiles(rootDir)) {
    const rel = path.relative(rootDir, file).split(path.sep).join('/');
    hash.update(rel);
    hash.update('\0');
    hash.update(sha256File(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function runCatalog(outputPath) {
  return runNode([SCRIPT, RESOURCES_ROOT, NATIVE_STRINGS, outputPath], ROOT);
}

function json(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function newCaseDir(label) {
  return fs.mkdtempSync(path.join(TEST_TMP_ROOT, `${label}-`));
}

const tests = [
  {
    name: 'rejects missing inputs',
    fn() {
      const tmpDir = newCaseDir('missing');
      const out = path.join(tmpDir, 'out.json');
      const result = runNode([SCRIPT, '/missing/resources', '/missing/strings.txt', out], ROOT);
      ensureFailure(result, 'rejects missing inputs');
    },
  },
  {
    name: 'rejects existing output',
    fn() {
      const tmpDir = newCaseDir('existing');
      const out = path.join(tmpDir, 'out.json');
      fs.writeFileSync(out, 'already here\n');
      const result = runCatalog(out);
      ensureFailure(result, 'rejects existing output');
      assert.match(result.stderr, /output already exists/i);
    },
  },
  {
    name: 'writes deterministic catalog',
    fn() {
      const tmpDir = newCaseDir('deterministic');
      const out1 = path.join(tmpDir, 'one.json');
      const out2 = path.join(tmpDir, 'two.json');
      const before = {
        assets: manifestDigest(ASSETS_ROOT),
        res: manifestDigest(RES_ROOT),
        strings: sha256File(NATIVE_STRINGS),
      };
      ensureSuccess(runCatalog(out1), 'first catalog run');
      ensureSuccess(runCatalog(out2), 'second catalog run');
      assert.equal(fs.readFileSync(out1, 'utf8'), fs.readFileSync(out2, 'utf8'));
      const after = {
        assets: manifestDigest(ASSETS_ROOT),
        res: manifestDigest(RES_ROOT),
        strings: sha256File(NATIVE_STRINGS),
      };
      assert.deepEqual(after, before);
      const data = json(out1);
      assert.equal(data.schemaVersion, 1);
      assert.deepEqual(data.inputs.evidenceIds, ['DER-WORK-001', 'DER-NATIVE-001']);
      assert.equal(data.inputs.sourceHashes.assetsManifest, before.assets);
      assert.equal(data.inputs.sourceHashes.resManifest, before.res);
      assert.equal(data.inputs.sourceHashes.nativeStrings, before.strings);
      assert.equal(data.summary.assets.png, 784);
      assert.equal(data.summary.assets.wav, 59);
      assert.equal(data.summary.assets.mp3, 3);
      assert.equal(data.summary.assets.fonts, 16);
      assert.equal(data.summary.treePairs.exact, 389);
      assert.equal(data.summary.treePairs.unmatched480x800, 3);
      assert.equal(data.summary.treePairs.unmatched720x1280, 3);
      assert.equal(data.summary.treePairs.nearMatches, 1);
      assert.equal(data.summary.resPng.total, 107);
      assert.equal(data.summary.resPng.launcher, 3);
      assert.equal(data.summary.resPng.vendorUi, 104);
      assert.equal(data.assets.trees['480x800'].files.length, 392);
      assert.equal(data.assets.trees['720x1280'].files.length, 392);
      assert.equal(data.assets.trees['480x800'].unmatchedLogicalPaths.length, 3);
      assert.equal(data.assets.trees['720x1280'].unmatchedLogicalPaths.length, 3);
      assert.equal(data.androidRes.png.length, 107);
      assert.equal(data.native.strings.printfPatternReferences.length > 0, true);
      assert.equal(data.native.numericSequenceGroups.length > 0, true);
    },
  },
  {
    name: 'curated catalog matches generator output',
    fn() {
      const tmpDir = newCaseDir('curated');
      const out = path.join(tmpDir, 'catalog.json');
      ensureSuccess(runCatalog(out), 'catalog run');
      assert.equal(
        fs.readFileSync(out, 'utf8'),
        fs.readFileSync(CURATED_CATALOG, 'utf8'),
        'curated resource map is stale; regenerate it with scripts/catalog-static-resources.mjs',
      );
    },
  },
  {
    name: 'captures known mismatch pair',
    fn() {
      const tmpDir = newCaseDir('mismatch');
      const out = path.join(tmpDir, 'catalog.json');
      ensureSuccess(runCatalog(out), 'catalog run');
      const data = json(out);
      const mismatch = data.assets.pairings.nearMatches.find(
        (entry) => entry.left === 'Text/text-juscombo.png' && entry.right === 'Text/text-justcombo.png',
      );
      assert.ok(mismatch, 'expected text-juscombo/text-justcombo mismatch pair');
      assert.equal(mismatch.kind, 'typo-mismatch');
      assert.equal(mismatch.evidenceStatus, 'inferred');
      assert.equal(mismatch.runtimeUsage, 'unknown');
    },
  },
  {
    name: 'records exact logical matches and printf patterns',
    fn() {
      const tmpDir = newCaseDir('matches');
      const out = path.join(tmpDir, 'catalog.json');
      ensureSuccess(runCatalog(out), 'catalog run');
      const data = json(out);
      const exact = data.native.strings.exactLogicalMatches.map((entry) => entry.nativeString);
      assert.ok(exact.includes('Text/text-justcombo.png'));
      assert.ok(exact.includes('Sounds/menubuttonclick.wav'));
      const unmatched = data.native.strings.unmatched.map((entry) => entry.nativeString);
      assert.ok(unmatched.includes('leave0.png'));
      const patterns = data.native.strings.printfPatternReferences.map((entry) => entry.nativeString);
      assert.ok(patterns.includes('Birds/bird-anim-%d-%d.png'));
      assert.ok(patterns.includes('Blades/blade%d.png'));
      const birdPattern = data.native.strings.printfPatternReferences.find((entry) => entry.nativeString === 'Birds/bird-anim-%d-%d.png');
      assert.equal(birdPattern.matches.length, 60);
    },
  },
  {
    name: 'classifies res png boundary',
    fn() {
      const tmpDir = newCaseDir('res');
      const out = path.join(tmpDir, 'catalog.json');
      ensureSuccess(runCatalog(out), 'catalog run');
      const data = json(out);
      const launcher = data.androidRes.png.filter((entry) => entry.classification === 'launcher');
      const vendor = data.androidRes.png.filter((entry) => entry.classification === 'vendor-ui');
      assert.equal(launcher.length, 3);
      assert.equal(vendor.length, 104);
      assert.ok(launcher.every((entry) => entry.path.endsWith('/icon.png')));
      assert.ok(data.androidRes.png.every((entry) => entry.runtimeUsage === 'unknown'));
    },
  },
  {
    name: 'preserves source hashes',
    fn() {
      const tmpDir = newCaseDir('hashes');
      const out = path.join(tmpDir, 'catalog.json');
      const before = {
        assets: manifestDigest(ASSETS_ROOT),
        res: manifestDigest(RES_ROOT),
        strings: sha256File(NATIVE_STRINGS),
      };
      ensureSuccess(runCatalog(out), 'catalog run');
      const after = {
        assets: manifestDigest(ASSETS_ROOT),
        res: manifestDigest(RES_ROOT),
        strings: sha256File(NATIVE_STRINGS),
      };
      assert.deepEqual(after, before);
    },
  },
];

for (const test of tests) {
  try {
    test.fn();
    logOk(test.name);
  } catch (error) {
    logFail(test.name, error);
  }
}

const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
console.log(`RESULT total=${tests.length} pass=${pass} fail=${fail} duration_ms=${durationMs.toFixed(1)}`);

if (fail > 0) {
  process.exit(1);
}
