#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const DEFAULT_MANIFEST = 'reference/game-release-test-manifest.json';
const GLOB_METACHARACTERS = /[*?[\]{}!]/u;
const DISALLOWED_TEST_PATH = /(?:^site\/|(?:^|[/.-])(?:browser|case-study|github-pages-workflow|play-launcher|playwright|production|release-rights)(?:[/.-]|$))/iu;
const OWNER_HELD_TESTS = new Set([
  'tests/audit-creator-build-test.mjs',
  'tests/catalog-static-resources-test.mjs',
  'tests/extract-gn-style-particle-choreography-test.mjs',
  'tests/generate-technical-closeout-manifest.test.mjs',
  'tests/stage-creator-assets-test.mjs',
]);

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function normalizeRepositoryPath(repositoryPath, label) {
  if (
    typeof repositoryPath !== 'string'
    || repositoryPath.length === 0
    || isAbsolute(repositoryPath)
    || repositoryPath.includes('\0')
    || repositoryPath.includes('\\')
    || GLOB_METACHARACTERS.test(repositoryPath)
  ) {
    throw new Error(`${label} must be an explicit repository-relative path without glob syntax`);
  }

  const segments = repositoryPath.split('/');
  if (
    segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')
    || repositoryPath !== segments.join('/')
  ) {
    throw new Error(`${label} must be a normalized repository-relative path`);
  }
  if (!repositoryPath.startsWith('tests/')) {
    throw new Error(`${label} must stay under tests/`);
  }
  if (DISALLOWED_TEST_PATH.test(repositoryPath)) {
    throw new Error(`${label} crosses the game-owned release-test boundary: ${repositoryPath}`);
  }
  if (OWNER_HELD_TESTS.has(repositoryPath)) {
    throw new Error(`${label} requires owner-held or ignored artifacts: ${repositoryPath}`);
  }
  return repositoryPath;
}

function resolveExistingFile(repositoryRoot, repositoryPath, label) {
  const absolutePath = resolve(repositoryRoot, repositoryPath);
  const relativePath = relative(repositoryRoot, absolutePath);
  if (
    relativePath === '..'
    || relativePath.startsWith(`..${sep}`)
    || isAbsolute(relativePath)
  ) {
    throw new Error(`${label} escapes the repository root`);
  }

  let metadata;
  try {
    metadata = lstatSync(absolutePath);
  } catch {
    throw new Error(`${label} does not exist: ${repositoryPath}`);
  }
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`${label} must be a regular, non-symlink file: ${repositoryPath}`);
  }

  const realPath = realpathSync(absolutePath);
  const realRelativePath = relative(repositoryRoot, realPath);
  if (
    realRelativePath === '..'
    || realRelativePath.startsWith(`..${sep}`)
    || isAbsolute(realRelativePath)
  ) {
    throw new Error(`${label} resolves outside the repository root`);
  }
  return absolutePath;
}

function validateFileList(value, {
  extensions,
  label,
  repositoryRoot,
  seen,
}) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array`);
  }

  return value.map((entry, index) => {
    const entryLabel = `${label}[${index}]`;
    const repositoryPath = normalizeRepositoryPath(entry, entryLabel);
    if (!extensions.some((extension) => repositoryPath.endsWith(extension))) {
      throw new Error(`${entryLabel} has an unsupported test extension: ${repositoryPath}`);
    }
    if (seen.has(repositoryPath)) {
      throw new Error(`duplicate game release test path: ${repositoryPath}`);
    }
    seen.add(repositoryPath);
    return Object.freeze({
      absolutePath: resolveExistingFile(repositoryRoot, repositoryPath, entryLabel),
      path: repositoryPath,
    });
  });
}

export function resolveGameReleaseTestManifest(manifestPath = DEFAULT_MANIFEST, options = {}) {
  const repositoryRoot = realpathSync(resolve(options.repositoryRoot ?? REPOSITORY_ROOT));
  const requestedManifestPath = isAbsolute(manifestPath)
    ? resolve(manifestPath)
    : resolve(repositoryRoot, manifestPath);
  const requestedManifestMetadata = lstatSync(requestedManifestPath);
  if (requestedManifestMetadata.isSymbolicLink() || !requestedManifestMetadata.isFile()) {
    throw new Error('game release test manifest must be a regular, non-symlink file');
  }
  const absoluteManifestPath = realpathSync(requestedManifestPath);
  const manifestRelativePath = relative(repositoryRoot, absoluteManifestPath);
  if (
    manifestRelativePath === '..'
    || manifestRelativePath.startsWith(`..${sep}`)
    || isAbsolute(manifestRelativePath)
  ) {
    throw new Error('game release test manifest must stay inside the repository root');
  }

  const manifest = JSON.parse(readFileSync(absoluteManifestPath, 'utf8'));
  assertPlainObject(manifest, 'game release test manifest');
  const allowedFields = new Set(['schemaVersion', 'description', 'nodeTestFiles', 'shellTestFiles']);
  for (const field of Object.keys(manifest)) {
    if (!allowedFields.has(field)) {
      throw new Error(`unknown game release test manifest field: ${field}`);
    }
  }
  if (manifest.schemaVersion !== 1) {
    throw new Error('game release test manifest schemaVersion must be 1');
  }
  if (typeof manifest.description !== 'string' || manifest.description.trim().length === 0) {
    throw new Error('game release test manifest description must be non-empty');
  }

  const seen = new Set();
  const nodeTests = validateFileList(manifest.nodeTestFiles, {
    extensions: ['.test.mjs', '-test.mjs', '.test.ts'],
    label: 'nodeTestFiles',
    repositoryRoot,
    seen,
  });
  const shellTests = validateFileList(manifest.shellTestFiles, {
    extensions: ['-test.sh'],
    label: 'shellTestFiles',
    repositoryRoot,
    seen,
  });

  return Object.freeze({
    manifestPath: absoluteManifestPath,
    nodeTests: Object.freeze(nodeTests),
    repositoryRoot,
    shellTests: Object.freeze(shellTests),
  });
}

function executeChecked(command, arguments_, options) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.signal) {
    throw new Error(`${command} terminated by signal ${result.signal}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${String(result.status)}`);
  }
}

export function runGameReleaseTests(manifestPath = DEFAULT_MANIFEST, options = {}) {
  const resolvedManifest = resolveGameReleaseTestManifest(manifestPath, options);
  const execute = options.execute ?? executeChecked;

  execute(
    process.execPath,
    [
      '--test',
      '--test-concurrency=1',
      ...resolvedManifest.nodeTests.map((testFile) => testFile.path),
    ],
    { cwd: resolvedManifest.repositoryRoot },
  );
  for (const testFile of resolvedManifest.shellTests) {
    execute('sh', [testFile.path], { cwd: resolvedManifest.repositoryRoot });
  }
  return resolvedManifest;
}

function parseCliArguments(arguments_) {
  let manifestPath = DEFAULT_MANIFEST;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--manifest') {
      const value = arguments_[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--manifest requires a path');
      }
      manifestPath = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }
  return manifestPath;
}

function isExecutedDirectly() {
  return process.argv[1]
    && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isExecutedDirectly()) {
  try {
    const manifestPath = parseCliArguments(process.argv.slice(2));
    const result = runGameReleaseTests(manifestPath);
    process.stdout.write(
      `Game release allowlist passed: ${result.nodeTests.length} Node tests and `
      + `${result.shellTests.length} shell tests.\n`,
    );
  } catch (error) {
    process.stderr.write(`Game release tests failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
