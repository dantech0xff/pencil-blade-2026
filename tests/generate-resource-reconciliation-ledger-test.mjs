#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  EXPECTED_COUNTS,
  generateOutputs,
  parseCli,
} from '../scripts/generate-resource-reconciliation-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(
  ROOT,
  'scripts',
  'generate-resource-reconciliation-ledger.mjs',
);
const RESOURCE_MAP = path.join(
  ROOT,
  'forensics',
  'resources',
  'resource-usage-map.json',
);
const DISPOSITION_MAP = path.join(
  ROOT,
  'forensics',
  'resources',
  'resource-disposition-map.json',
);
const REGISTRY = path.join(
  ROOT,
  'game',
  'assets',
  'scripts',
  'domain',
  'resource-consumer-registry.ts',
);
const CURATED_LEDGER = path.join(
  ROOT,
  'assets',
  'catalog',
  'resource-reconciliation-ledger.json',
);
const SUITE_ROOT = fs.mkdtempSync(path.join(
  fs.realpathSync(os.tmpdir()),
  'resource-reconciliation-ledger-tests-',
));

const EXPECTED_SUMMARY = Object.freeze({
  consumers: {
    consumed: 743,
    total: 862,
    coveragePercent: 86.19,
    status: 'partial',
  },
  reconciliation: {
    classified: 862,
    consumed: 743,
    unknown: 108,
    excluded: 10,
    unsupported: 1,
    total: 862,
    coveragePercent: 100,
    status: 'complete',
  },
});

after(() => {
  fs.rmSync(SUITE_ROOT, { recursive: true, force: true });
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function newCase(label) {
  return fs.mkdtempSync(path.join(SUITE_ROOT, `${label}-`));
}

function directOptions(dispositionMapPath = DISPOSITION_MAP) {
  return {
    resourceMapPath: RESOURCE_MAP,
    registryPath: REGISTRY,
    dispositionMapPath,
  };
}

function outputPaths(caseRoot) {
  return {
    ledgerPath: path.join(caseRoot, 'resource-reconciliation-ledger.json'),
  };
}

function cliArgs(mode, paths) {
  return [
    SCRIPT,
    mode,
    '--resource-map', RESOURCE_MAP,
    '--registry', REGISTRY,
    '--dispositions', paths.dispositionMapPath ?? DISPOSITION_MAP,
    '--ledger', paths.ledgerPath,
  ];
}

function runCli(mode, paths) {
  return spawnSync(process.execPath, cliArgs(mode, paths), {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function expectCliSuccess(result, label) {
  assert.equal(
    result.status,
    0,
    `${label}: expected success\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
  );
}

function expectCliFailure(result, pattern, label) {
  assert.notEqual(result.status, 0, `${label}: expected failure`);
  assert.match(result.stderr, pattern);
}

function dispositionFixture(label, mutate) {
  const caseRoot = newCase(label);
  const fixturePath = path.join(caseRoot, 'resource-disposition-map.json');
  const fixture = structuredClone(readJson(DISPOSITION_MAP));
  mutate(fixture);
  writeJson(fixturePath, fixture);
  return fixturePath;
}

function groupById(dispositions, id) {
  const group = dispositions.groups.find((candidate) => candidate.id === id);
  assert.ok(group, `missing disposition group: ${id}`);
  return group;
}

function assertStrictlySortedUnique(values, label) {
  for (let index = 1; index < values.length; index += 1) {
    assert.ok(
      values[index - 1] < values[index],
      `${label} is not strictly ordinal-sorted at ${index}: `
        + `${values[index - 1]} then ${values[index]}`,
    );
  }
}

function assertProductionOutput(generated) {
  assert.equal(generated.ledger.schemaVersion, 1);
  assert.equal(generated.ledger.scope, 'recovered-apk-resource-reconciliation');
  assert.deepEqual(generated.ledger.summary, EXPECTED_SUMMARY);
  assert.equal(generated.ledger.entries.length, EXPECTED_COUNTS.staged);

  const ledgerPaths = generated.ledger.entries.map(({ canonicalPath }) => canonicalPath);
  assertStrictlySortedUnique(ledgerPaths, 'ledger entries');

  const counts = {
    consumed: 0,
    unknown: 0,
    excluded: 0,
    unsupported: 0,
  };
  for (const entry of generated.ledger.entries) {
    assert.ok(entry.status in counts, `${entry.canonicalPath}: invalid status`);
    counts[entry.status] += 1;
    assert.ok(Array.isArray(entry.evidenceRefs));
    assertStrictlySortedUnique(entry.evidenceRefs, `${entry.canonicalPath} evidenceRefs`);
    if (entry.status === 'consumed') {
      assert.ok(Array.isArray(entry.consumerIds));
      assert.ok(entry.consumerIds.length > 0);
      assertStrictlySortedUnique(entry.consumerIds, `${entry.canonicalPath} consumerIds`);
      assert.equal(entry.dispositionId, undefined);
      assert.equal(entry.reason, undefined);
    } else {
      assert.equal(typeof entry.dispositionId, 'string');
      assert.ok(entry.dispositionId.length > 0);
      assert.equal(typeof entry.reason, 'string');
      assert.ok(entry.reason.length > 0);
      assert.equal(entry.consumerIds, undefined);
    }
  }
  assert.deepEqual(counts, {
    consumed: EXPECTED_COUNTS.consumed,
    unknown: EXPECTED_COUNTS.unknown,
    excluded: EXPECTED_COUNTS.excluded,
    unsupported: EXPECTED_COUNTS.unsupported,
  });

  assert.equal(generated.ledgerContents, `${JSON.stringify(generated.ledger, null, 2)}\n`);
  assert.equal(generated.ledgerContents.includes(ROOT), false);
  assert.equal(/createdAt|generatedAt|timestamp/.test(generated.ledgerContents), false);

  const aboutCompact = generated.ledger.entries.find(
    ({ canonicalPath }) => (
      canonicalPath === '480x800/Backgrounds/aboutbackground-ios.png'
    ),
  );
  const aboutLarge = generated.ledger.entries.find(
    ({ canonicalPath }) => (
      canonicalPath === '720x1280/Backgrounds/aboutbackground-ios.png'
    ),
  );
  assert.deepEqual(
    {
      dispositionId: aboutCompact?.dispositionId,
      status: aboutCompact?.status,
    },
    {
      dispositionId: 'about-ios-android-exclusion',
      status: 'excluded',
    },
  );
  assert.deepEqual(
    {
      dispositionId: aboutLarge?.dispositionId,
      status: aboutLarge?.status,
    },
    {
      dispositionId: 'about-ios-android-exclusion',
      status: 'excluded',
    },
  );
}

test('production inputs generate a deterministic sorted 862-resource reconciliation', async () => {
  const first = await generateOutputs(directOptions());
  const second = await generateOutputs(directOptions());

  assertProductionOutput(first);
  assert.equal(second.ledgerContents, first.ledgerContents);
});

test('generation rejects a semantically identical resource map with different bytes', async () => {
  const caseRoot = newCase('resource-map-byte-drift');
  const changedResourceMap = path.join(caseRoot, 'resource-usage-map.json');
  fs.writeFileSync(
    changedResourceMap,
    ` \n${fs.readFileSync(RESOURCE_MAP, 'utf8')}`,
  );

  await assert.rejects(
    generateOutputs({
      ...directOptions(),
      resourceMapPath: changedResourceMap,
    }),
    /resource map SHA-256 mismatch/,
  );
});

test('generation rejects registry byte drift between stable read and import', async () => {
  const caseRoot = newCase('registry-import-race');
  const registryWrapper = path.join(caseRoot, 'resource-consumer-registry.ts');
  fs.writeFileSync(
    registryWrapper,
    'export { RESOURCE_CONSUMER_REGISTRY, listResourceConsumerRecords } '
      + `from ${JSON.stringify(pathToFileURL(REGISTRY).href)};\n`,
  );

  await assert.rejects(
    generateOutputs(
      {
        ...directOptions(),
        registryPath: registryWrapper,
      },
      {
        afterRegistryRead({ registryPath }) {
          fs.appendFileSync(registryPath, '// byte drift\n');
        },
      },
    ),
    /resource consumer registry changed during import/,
  );
});

test('production CLI writes absent outputs and verifies them without mutation', () => {
  const caseRoot = newCase('production-cli');
  const paths = outputPaths(caseRoot);
  const write = runCli('write', paths);

  expectCliSuccess(write, 'production write');
  assert.match(
    write.stdout,
    /WRITE OK staged=862 consumed=743 unknown=108 excluded=10 unsupported=1 reconciliation_coverage=100%/,
  );
  assert.ok(fs.existsSync(paths.ledgerPath));
  const before = fs.readFileSync(paths.ledgerPath, 'utf8');

  const verify = runCli('verify', paths);
  expectCliSuccess(verify, 'production verify');
  assert.match(verify.stdout, /VERIFY OK staged=862 consumed=743/);
  assert.equal(fs.readFileSync(paths.ledgerPath, 'utf8'), before);
  assert.deepEqual(
    fs.readdirSync(caseRoot).sort(),
    ['resource-reconciliation-ledger.json'],
  );
});

test(
  'checked-in generated ledger matches production generation when curated',
  { skip: !fs.existsSync(CURATED_LEDGER) },
  () => {
    const verify = runCli('verify', {
      ledgerPath: CURATED_LEDGER,
    });
    expectCliSuccess(verify, 'curated output verification');
  },
);

test('CLI parsing requires complete ledger-generation paths', () => {
  const parsed = parseCli(cliArgs('verify', {
    ledgerPath: '/tmp/resource-ledger-a.json',
  }).slice(1));
  assert.equal(parsed.mode, 'verify');
  assert.equal(parsed.options.resourceMapPath, RESOURCE_MAP);
  assert.throws(
    () => parseCli(['verify']),
    /missing required option/,
  );
  assert.throws(
    () => parseCli([
      'verify',
      '--resource-map', RESOURCE_MAP,
      '--resource-map', RESOURCE_MAP,
      '--registry', REGISTRY,
      '--dispositions', DISPOSITION_MAP,
      '--ledger', '/tmp/resource-ledger-b.json',
    ]),
    /duplicate option/,
  );
});

test('omitted disposition paths fail instead of defaulting to unknown', async () => {
  const fixturePath = dispositionFixture('omitted-disposition', (dispositions) => {
    const group = groupById(dispositions, 'advanced-blade-bolts-unowned');
    group.treePairLogicalPaths = group.treePairLogicalPaths.slice(1);
  });

  await assert.rejects(
    generateOutputs(directOptions(fixturePath)),
    /resource disposition map must expand to exactly 119 paths/,
  );
});

test('conflicting disposition groups fail on their duplicated canonical path', async () => {
  const fixturePath = dispositionFixture('conflicting-disposition', (dispositions) => {
    const group = groupById(dispositions, 'advanced-blade-bolts-unowned');
    group.treePairLogicalPaths.push('Backgrounds/aboutbackground-ios.png');
    group.treePairLogicalPaths.sort();
  });

  await assert.rejects(
    generateOutputs(directOptions(fixturePath)),
    /duplicates disposition path: 480x800\/Backgrounds\/aboutbackground-ios\.png/,
  );
});

test('extra non-staged dispositions fail closed', async () => {
  const fixturePath = dispositionFixture('extra-disposition', (dispositions) => {
    const group = groupById(dispositions, 'cooper-black-otf-creator-unsupported');
    group.canonicalPaths.push('Fonts/not-staged.ttf');
    group.canonicalPaths.sort();
  });

  await assert.rejects(
    generateOutputs(directOptions(fixturePath)),
    /is not staged: Fonts\/not-staged\.ttf/,
  );
});

test('invalid disposition status and reason are rejected independently', async () => {
  const invalidStatusPath = dispositionFixture('invalid-status', (dispositions) => {
    groupById(dispositions, 'about-ios-android-exclusion').status = 'consumed';
  });
  await assert.rejects(
    generateOutputs(directOptions(invalidStatusPath)),
    /status is invalid: consumed/,
  );

  const invalidReasonPath = dispositionFixture('invalid-reason', (dispositions) => {
    groupById(dispositions, 'about-ios-android-exclusion').reason = '';
  });
  await assert.rejects(
    generateOutputs(directOptions(invalidReasonPath)),
    /reason must be a non-empty string/,
  );
});

test('tree-pair expansion rejects already-prefixed logical paths', async () => {
  const fixturePath = dispositionFixture('invalid-profile-expansion', (dispositions) => {
    const group = groupById(dispositions, 'about-ios-android-exclusion');
    group.treePairLogicalPaths = [
      '480x800/Backgrounds/aboutbackground-ios.png',
    ];
  });

  await assert.rejects(
    generateOutputs(directOptions(fixturePath)),
    /is not staged: 480x800\/480x800\/Backgrounds\/aboutbackground-ios\.png/,
  );
});

test('a disposition cannot overlap an exact live consumer', async () => {
  const fixturePath = dispositionFixture('consumer-overlap', (dispositions) => {
    const group = groupById(dispositions, 'about-ios-android-exclusion');
    group.canonicalPaths.push('480x800/Backgrounds/aboutbackground.png');
    group.canonicalPaths.sort();
  });

  await assert.rejects(
    generateOutputs(directOptions(fixturePath)),
    /overlaps a live consumer: 480x800\/Backgrounds\/aboutbackground\.png/,
  );
});

test('verify rejects a stale ledger', async () => {
  const caseRoot = newCase('stale-generated-output');
  const paths = outputPaths(caseRoot);
  const generated = await generateOutputs(directOptions());
  fs.writeFileSync(paths.ledgerPath, generated.ledgerContents);
  expectCliSuccess(runCli('verify', paths), 'fresh generated output');

  fs.appendFileSync(paths.ledgerPath, '\n');
  expectCliFailure(
    runCli('verify', paths),
    /resource reconciliation ledger is stale/,
    'stale ledger',
  );
});

test('write refuses an existing ledger without modifying it', () => {
  const existingLedgerRoot = newCase('existing-ledger');
  const existingLedger = outputPaths(existingLedgerRoot);
  fs.writeFileSync(existingLedger.ledgerPath, 'owned ledger\n');
  expectCliFailure(
    runCli('write', existingLedger),
    /generated output must be absent/,
    'existing ledger',
  );
  assert.equal(fs.readFileSync(existingLedger.ledgerPath, 'utf8'), 'owned ledger\n');
  assert.deepEqual(fs.readdirSync(existingLedgerRoot), [
    'resource-reconciliation-ledger.json',
  ]);
});
