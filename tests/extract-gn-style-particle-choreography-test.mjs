#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'extract-gn-style-particle-choreography.mjs');
const NATIVE = path.join(ROOT, '.forensics-work', 'phase-01', 'native', 'libgame.so');
const CURATED_EVIDENCE = path.join(
  ROOT,
  'forensics',
  'native',
  'gn-style-particle-choreography.json',
);
const CURATED_GENERATED = path.join(
  ROOT,
  'game',
  'assets',
  'scripts',
  'domain',
  'gn-style-particle-choreography.generated.ts',
);
const NATIVE_REPORT = path.join(
  ROOT,
  'plans',
  '260721-2253-pencil-blade-restoration',
  'reports',
  'researcher-2026-07-24-gn-style-native-contract.md',
);
const EXPECTED_BINARY_SHA256
  = '55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e';
const EXPECTED_CSV_SHA256
  = '6c8dd814fb776e15507c2f42081b315bd410ea5b9a9156a4726c186504507c97';

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function runExtractor(binaryPath, evidencePath, generatedPath) {
  return spawnSync(process.execPath, [
    SCRIPT,
    binaryPath,
    evidencePath,
    generatedPath,
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function assertSuccess(result, label) {
  assert.equal(
    result.status,
    0,
    `${label} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
  );
}

function canonicalCsvFromReport() {
  const report = fs.readFileSync(NATIVE_REPORT, 'utf8');
  const header = 'i,pc,minD,maxD,minDurBits,maxDurBits,count,delayBits,point,path,flagA,flagB';
  const start = report.indexOf(`\`\`\`csv\n${header}\n`);
  assert.notEqual(start, -1, 'native report must contain the canonical CSV fence');
  const csvStart = start + '```csv\n'.length;
  const end = report.indexOf('\n```', csvStart);
  assert.notEqual(end, -1, 'native report canonical CSV fence must terminate');
  return `${report.slice(csvStart, end)}\n`;
}

function parseCanonicalCsv(csv) {
  const [header, ...rows] = csv.trimEnd().split('\n');
  assert.equal(
    header,
    'i,pc,minD,maxD,minDurBits,maxDurBits,count,delayBits,point,path,flagA,flagB',
  );
  return rows.map((line) => {
    const [
      ordinal,
      callSite,
      minimumDistance,
      maximumDistance,
      minimumDurationBits,
      maximumDurationBits,
      particleCount,
      startDelayBits,
      pointId,
      family,
      flagA,
      flagB,
    ] = line.split(',');
    return {
      ordinal: Number(ordinal),
      callSite: `0x00${callSite}`,
      minimumDistance: Number(minimumDistance),
      maximumDistance: Number(maximumDistance),
      minimumDurationBits: Number.parseInt(minimumDurationBits, 16),
      maximumDurationBits: Number.parseInt(maximumDurationBits, 16),
      particleCount: Number(particleCount),
      startDelayBits: Number.parseInt(startDelayBits, 16),
      pointId,
      family,
      flagA: Number(flagA),
      flagB: Number(flagB),
    };
  });
}

function evidenceTuple(call) {
  return [
    call.raw.minimumDistance,
    call.raw.maximumDistance,
    Number.parseInt(call.raw.minimumDurationBits, 16),
    Number.parseInt(call.raw.maximumDurationBits, 16),
    call.raw.particleCount,
    Number.parseInt(call.raw.startDelayBits, 16),
    call.point.id,
    Number.parseInt(call.point.xFactorBits, 16),
    Number.parseInt(call.point.yFactorBits, 16),
    call.family,
    call.flags.flagA,
    call.flags.flagB,
  ];
}

test('pins the native image, exact function bounds, and canonical report table', () => {
  assert.equal(sha256(fs.readFileSync(NATIVE)), EXPECTED_BINARY_SHA256);
  const csv = canonicalCsvFromReport();
  assert.equal(Buffer.byteLength(csv), 25_896);
  assert.equal(sha256(csv), EXPECTED_CSV_SHA256);
  assert.equal(parseCanonicalCsv(csv).length, 439);

  const evidence = JSON.parse(fs.readFileSync(CURATED_EVIDENCE, 'utf8'));
  assert.deepEqual(evidence.extraction.functionBounds, {
    start: '0x00151f74',
    endExclusive: '0x001584bc',
  });
  assert.equal(evidence.extraction.binarySha256, EXPECTED_BINARY_SHA256);
  assert.equal(evidence.extraction.canonicalCsvSha256, EXPECTED_CSV_SHA256);
  assert.equal(evidence.extraction.executedInstructionCount, 10_309);
  assert.equal(evidence.extraction.literalPoolBranchCount, 22);
  assert.match(evidence.extraction.method, /static Thumb disassembly/i);
  assert.match(evidence.extraction.method, /never loaded or executed/i);
});

test('extractor deterministically reproduces both curated artifacts from static bytes', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gn-style-particle-extract-'));
  try {
    const firstEvidence = path.join(temporaryRoot, 'first.json');
    const firstGenerated = path.join(temporaryRoot, 'first.ts');
    const secondEvidence = path.join(temporaryRoot, 'second.json');
    const secondGenerated = path.join(temporaryRoot, 'second.ts');
    const beforeHash = sha256(fs.readFileSync(NATIVE));

    assertSuccess(
      runExtractor(NATIVE, firstEvidence, firstGenerated),
      'first static extraction',
    );
    assertSuccess(
      runExtractor(NATIVE, secondEvidence, secondGenerated),
      'second static extraction',
    );

    assert.equal(fs.readFileSync(firstEvidence, 'utf8'), fs.readFileSync(secondEvidence, 'utf8'));
    assert.equal(fs.readFileSync(firstGenerated, 'utf8'), fs.readFileSync(secondGenerated, 'utf8'));
    assert.equal(fs.readFileSync(firstEvidence, 'utf8'), fs.readFileSync(CURATED_EVIDENCE, 'utf8'));
    assert.equal(fs.readFileSync(firstGenerated, 'utf8'), fs.readFileSync(CURATED_GENERATED, 'utf8'));
    assert.equal(sha256(fs.readFileSync(NATIVE)), beforeHash, 'extractor must not modify native input');
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('evidence, report CSV, and generated tuples match one-to-one without sorting or rounding', async () => {
  const evidence = JSON.parse(fs.readFileSync(CURATED_EVIDENCE, 'utf8'));
  const reportRows = parseCanonicalCsv(canonicalCsvFromReport());
  const generatedModule = await import(
    `${pathToFileURL(CURATED_GENERATED).href}?integrity=${Date.now()}`
  );
  const generatedTuples = generatedModule.GN_STYLE_GENERATED_PARTICLE_TUPLES;

  assert.equal(evidence.calls.length, 439);
  assert.equal(generatedTuples.length, 439);
  assert.equal(new Set(evidence.calls.map((call) => call.callSite)).size, 439);

  for (let index = 0; index < 439; index += 1) {
    const report = reportRows[index];
    const call = evidence.calls[index];
    assert.equal(call.ordinal, index + 1);
    assert.equal(call.ordinal, report.ordinal);
    assert.equal(call.callSite, report.callSite);
    assert.deepEqual(evidenceTuple(call), generatedTuples[index]);
    assert.deepEqual(evidenceTuple(call).slice(0, 6), [
      report.minimumDistance,
      report.maximumDistance,
      report.minimumDurationBits,
      report.maximumDurationBits,
      report.particleCount,
      report.startDelayBits,
    ]);
    assert.equal(call.point.id, report.pointId);
    assert.equal(call.family, report.family);
    assert.deepEqual([call.flags.flagA, call.flags.flagB], [report.flagA, report.flagB]);
  }
});

test('integrity summaries prove family, flags, points, delays, and source-order decreases', () => {
  const evidence = JSON.parse(fs.readFileSync(CURATED_EVIDENCE, 'utf8'));
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(evidence.families).map(([family, value]) => [family, value.callCount]),
    ),
    { F5: 223, F4: 128, ST: 32, VN: 30, HX: 17, CI: 9 },
  );
  assert.deepEqual(evidence.summary.flagPairCounts, {
    '0,0': 341,
    '1,0': 64,
    '0,1': 34,
  });
  assert.equal(evidence.summary.reusableAnchorCallCount, 423);
  assert.equal(evidence.summary.directConstructionCallCount, 16);
  assert.equal(evidence.summary.minimumStartDelayBits, '0x40400000');
  assert.equal(evidence.summary.maximumStartDelayBits, '0x43128000');
  assert.equal(evidence.summary.sourceOrderDelayDecreaseCount, 25);

  const directIds = evidence.calls
    .filter((call) => call.point.kind === 'direct-construction')
    .map((call) => call.point.id);
  assert.deepEqual(directIds, Array.from({ length: 16 }, (_, index) => (
    `D${String(index + 1).padStart(2, '0')}`
  )));
});

test('fails closed before disassembly for a changed native image and for unsafe outputs', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gn-style-particle-reject-'));
  try {
    const changedNative = path.join(temporaryRoot, 'changed-libgame.so');
    fs.copyFileSync(NATIVE, changedNative);
    const descriptor = fs.openSync(changedNative, 'r+');
    try {
      fs.writeSync(descriptor, Buffer.from([0]), 0, 1, 0);
    } finally {
      fs.closeSync(descriptor);
    }

    const evidencePath = path.join(temporaryRoot, 'evidence.json');
    const generatedPath = path.join(temporaryRoot, 'generated.ts');
    const changedResult = runExtractor(changedNative, evidencePath, generatedPath);
    assert.notEqual(changedResult.status, 0);
    assert.match(changedResult.stderr, /SHA-256 mismatch/i);
    assert.equal(fs.existsSync(evidencePath), false);
    assert.equal(fs.existsSync(generatedPath), false);

    fs.writeFileSync(evidencePath, 'occupied\n');
    const occupiedResult = runExtractor(NATIVE, evidencePath, generatedPath);
    assert.notEqual(occupiedResult.status, 0);
    assert.match(occupiedResult.stderr, /already exists/i);
    assert.equal(fs.existsSync(generatedPath), false);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
