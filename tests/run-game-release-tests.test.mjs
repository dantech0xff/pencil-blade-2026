import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  resolveGameReleaseTestManifest,
  runGameReleaseTests,
} from '../scripts/run-game-release-tests.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const canonicalManifestPath = resolve(
  repositoryRoot,
  'reference/game-release-test-manifest.json',
);

function createFixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'pencil-blade-game-tests-'));
  for (const path of [
    'reference',
    'tests/reconstruction/vertical-slice',
  ]) {
    mkdirSync(resolve(root, path), { recursive: true });
  }
  writeFileSync(resolve(root, 'tests/game.test.mjs'), 'export {};\n');
  writeFileSync(
    resolve(root, 'tests/reconstruction/vertical-slice/gameplay.test.ts'),
    'export {};\n',
  );
  writeFileSync(resolve(root, 'tests/reconstruction-policy-test.sh'), '#!/bin/sh\n');
  return root;
}

function writeManifest(root, overrides = {}) {
  const manifest = {
    schemaVersion: 1,
    description: 'Fixture game allowlist.',
    nodeTestFiles: [
      'tests/game.test.mjs',
      'tests/reconstruction/vertical-slice/gameplay.test.ts',
    ],
    shellTestFiles: ['tests/reconstruction-policy-test.sh'],
    ...overrides,
  };
  const path = resolve(root, 'reference/game-release-test-manifest.json');
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  return path;
}

test('canonical manifest is an explicit, game-owned list with complete reconstruction coverage', () => {
  const manifest = JSON.parse(readFileSync(canonicalManifestPath, 'utf8'));
  const resolvedManifest = resolveGameReleaseTestManifest(canonicalManifestPath);
  const verticalSliceDirectory = resolve(
    repositoryRoot,
    'tests/reconstruction/vertical-slice',
  );
  const expectedVerticalSliceTests = readdirSync(verticalSliceDirectory)
    .filter((entry) => entry.endsWith('.test.ts'))
    .map((entry) => `tests/reconstruction/vertical-slice/${entry}`)
    .sort();
  const manifestVerticalSliceTests = manifest.nodeTestFiles
    .filter((path) => path.startsWith('tests/reconstruction/vertical-slice/'))
    .sort();

  assert.deepEqual(manifestVerticalSliceTests, expectedVerticalSliceTests);
  assert.equal(resolvedManifest.nodeTests.length, manifest.nodeTestFiles.length);
  assert.equal(resolvedManifest.shellTests.length, manifest.shellTestFiles.length);
  assert.ok(manifest.nodeTestFiles.includes('tests/generate-fidelity-report.test.mjs'));
  assert.ok(manifest.nodeTestFiles.includes('tests/verify-web-mobile-build.test.mjs'));
  assert.deepEqual(manifest.shellTestFiles, [
    'tests/reconstruction-policy-test.sh',
    'tests/reconstruction-policy-negative-test.sh',
  ]);

  for (const path of [...manifest.nodeTestFiles, ...manifest.shellTestFiles]) {
    assert.doesNotMatch(path, /[*?[\]{}!]/u);
    assert.doesNotMatch(
      path,
      /(?:site\/|browser|case-study|github-pages-workflow|playwright|production|release-rights)/iu,
    );
  }
  for (const excludedTest of [
    'tests/audit-creator-build-test.mjs',
    'tests/catalog-static-resources-test.mjs',
    'tests/extract-gn-style-particle-choreography-test.mjs',
    'tests/generate-technical-closeout-manifest.test.mjs',
    'tests/stage-creator-assets-test.mjs',
  ]) {
    assert.ok(!manifest.nodeTestFiles.includes(excludedTest));
  }
});

test('runner executes exactly the resolved allowlist without shell expansion', (context) => {
  const root = createFixture();
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const manifestPath = writeManifest(root);
  const calls = [];

  const result = runGameReleaseTests(manifestPath, {
    execute(command, arguments_, options) {
      calls.push({ arguments_, command, options });
    },
    repositoryRoot: root,
  });
  const realRoot = realpathSync(root);

  assert.equal(result.nodeTests.length, 2);
  assert.deepEqual(calls, [
    {
      arguments_: [
        '--test',
        '--test-concurrency=1',
        'tests/game.test.mjs',
        'tests/reconstruction/vertical-slice/gameplay.test.ts',
      ],
      command: process.execPath,
      options: { cwd: realRoot },
    },
    {
      arguments_: ['tests/reconstruction-policy-test.sh'],
      command: 'sh',
      options: { cwd: realRoot },
    },
  ]);
});

for (const fixture of [
  {
    name: 'duplicate paths',
    overrides: {
      nodeTestFiles: ['tests/game.test.mjs', 'tests/game.test.mjs'],
    },
    pattern: /duplicate game release test path/u,
  },
  {
    name: 'glob syntax',
    overrides: {
      nodeTestFiles: ['tests/*.test.mjs'],
    },
    pattern: /without glob syntax/u,
  },
  {
    name: 'missing files',
    overrides: {
      nodeTestFiles: ['tests/missing.test.mjs'],
    },
    pattern: /does not exist/u,
  },
  {
    name: 'case-study tests',
    prepare(root) {
      writeFileSync(resolve(root, 'tests/case-study-pages.test.mjs'), 'export {};\n');
    },
    overrides: {
      nodeTestFiles: ['tests/case-study-pages.test.mjs'],
    },
    pattern: /game-owned release-test boundary/u,
  },
  {
    name: 'site tests',
    prepare(root) {
      mkdirSync(resolve(root, 'site/tests'), { recursive: true });
      writeFileSync(resolve(root, 'site/tests/browser.test.mjs'), 'export {};\n');
    },
    overrides: {
      nodeTestFiles: ['site/tests/browser.test.mjs'],
    },
    pattern: /stay under tests/u,
  },
]) {
  test(`manifest rejects ${fixture.name}`, (context) => {
    const root = createFixture();
    context.after(() => rmSync(root, { force: true, recursive: true }));
    fixture.prepare?.(root);
    const manifestPath = writeManifest(root, fixture.overrides);
    assert.throws(
      () => resolveGameReleaseTestManifest(manifestPath, { repositoryRoot: root }),
      fixture.pattern,
    );
  });
}

test('manifest rejects symlinked test files', (context) => {
  const root = createFixture();
  context.after(() => rmSync(root, { force: true, recursive: true }));
  writeFileSync(resolve(root, 'outside.test.mjs'), 'export {};\n');
  symlinkSync(
    resolve(root, 'outside.test.mjs'),
    resolve(root, 'tests/symlink.test.mjs'),
  );
  const manifestPath = writeManifest(root, {
    nodeTestFiles: ['tests/symlink.test.mjs'],
  });

  assert.throws(
    () => resolveGameReleaseTestManifest(manifestPath, { repositoryRoot: root }),
    /regular, non-symlink file/u,
  );
});

test('fixture helper creates paths with stable portable basenames', () => {
  assert.equal(basename(canonicalManifestPath), 'game-release-test-manifest.json');
});
