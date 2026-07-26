#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
} from 'node:fs';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

export const GAME_MOUNT = 'play/game';
export const REQUIRED_SITE_FILES = Object.freeze([
  'index.html',
  'play/index.html',
  'vi/index.html',
  'vi/play/index.html',
]);

function isContained(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === ''
    || (
      pathFromRoot !== '..'
      && !pathFromRoot.startsWith(`..${sep}`)
      && !isAbsolute(pathFromRoot)
    );
}

function assertSafeRelativePath(relativePath, label) {
  const normalized = relativePath.replaceAll('\\', '/');
  const segments = normalized.split('/');
  if (
    normalized.length === 0
    || isAbsolute(relativePath)
    || relativePath.includes('\\')
    || relativePath.includes('\0')
    || segments.some((segment) => (
      segment.length === 0
      || segment === '.'
      || segment === '..'
      || /%(?:00|2e|2f|5c)/iu.test(segment)
    ))
  ) {
    throw new Error(`${label} contains an unsafe or escaping path: ${relativePath}`);
  }
  return normalized;
}

function validateSourceRoot(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must name one directory`);
  }
  const root = resolve(value);
  if (!existsSync(root)) {
    throw new Error(`${label} does not exist: ${root}`);
  }
  const metadata = lstatSync(root);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`${label} must be a real directory`);
  }
  return realpathSync(root);
}

function validateOutputRoot(value, sourceRoots) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('outDir must name one directory path');
  }
  const unresolvedOutput = resolve(value);
  if (existsSync(unresolvedOutput) && lstatSync(unresolvedOutput).isSymbolicLink()) {
    throw new Error('output path must not be a symbolic link');
  }
  const missingSegments = [];
  let existingAncestor = unresolvedOutput;
  while (!existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor);
    if (parent === existingAncestor) {
      throw new Error('output directory has no resolvable ancestor');
    }
    missingSegments.unshift(basename(existingAncestor));
    existingAncestor = parent;
  }
  const outDir = resolve(realpathSync(existingAncestor), ...missingSegments);
  for (const sourceRoot of sourceRoots) {
    if (isContained(sourceRoot, outDir) || isContained(outDir, sourceRoot)) {
      throw new Error('output directory must not overlap an input directory');
    }
  }
  if (!existsSync(outDir)) {
    return { outDir, removeEmptyOutput: false };
  }
  const metadata = lstatSync(outDir);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error('output path must be absent or an empty real directory');
  }
  if (readdirSync(outDir).length !== 0) {
    throw new Error('output directory must be empty');
  }
  return { outDir, removeEmptyOutput: true };
}

function inventoryTree(root, label) {
  const files = [];
  const directories = [];
  const pending = [{ absolutePath: root, relativePath: '' }];
  while (pending.length > 0) {
    const directory = pending.pop();
    const entries = readdirSync(directory.absolutePath, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = directory.relativePath
        ? `${directory.relativePath}/${entry.name}`
        : entry.name;
      const safePath = assertSafeRelativePath(relativePath, label);
      const absolutePath = resolve(directory.absolutePath, entry.name);
      if (!isContained(root, absolutePath)) {
        throw new Error(`${label} entry escapes its source root: ${safePath}`);
      }
      const metadata = lstatSync(absolutePath);
      if (metadata.isSymbolicLink()) {
        throw new Error(`${label} contains a symbolic link: ${safePath}`);
      }
      if (metadata.isDirectory()) {
        directories.push(safePath);
        pending.push({ absolutePath, relativePath: safePath });
        continue;
      }
      if (!metadata.isFile()) {
        throw new Error(`${label} contains a non-file entry: ${safePath}`);
      }
      const bytes = readFileSync(absolutePath);
      files.push(Object.freeze({
        absolutePath,
        path: safePath,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        size: metadata.size,
      }));
    }
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  directories.sort((left, right) => left.localeCompare(right));
  return Object.freeze({
    directories: Object.freeze(directories),
    files: Object.freeze(files),
  });
}

function assertRequiredFiles(site, game) {
  const siteFiles = new Set(site.files.map((file) => file.path));
  for (const requiredPath of REQUIRED_SITE_FILES) {
    if (!siteFiles.has(requiredPath)) {
      throw new Error(`site build is missing required launch route: ${requiredPath}`);
    }
  }
  if (!game.files.some((file) => file.path === 'index.html')) {
    throw new Error('game build is missing required entry: index.html');
  }
}

function assertNoCollisions(site, game) {
  const destinations = new Map();
  const register = (destinationPath, kind, source) => {
    const prior = destinations.get(destinationPath);
    if (prior && prior.kind === 'directory' && kind === 'directory') {
      return;
    }
    if (prior) {
      throw new Error(
        `composition path collision at ${destinationPath}: ${prior.source} and ${source}`,
      );
    }
    destinations.set(destinationPath, { kind, source });
  };

  for (const directory of site.directories) {
    register(directory, 'directory', `site:${directory}`);
  }
  for (const file of site.files) {
    register(file.path, 'file', `site:${file.path}`);
  }
  register('play', 'directory', 'game mount parent');
  register(GAME_MOUNT, 'directory', 'game mount');
  for (const directory of game.directories) {
    register(`${GAME_MOUNT}/${directory}`, 'directory', `game:${directory}`);
  }
  for (const file of game.files) {
    register(`${GAME_MOUNT}/${file.path}`, 'file', `game:${file.path}`);
  }
}

function copyInventory(inventory, destinationRoot, mount = '') {
  let totalBytes = 0;
  for (const directory of inventory.directories) {
    const destination = resolve(destinationRoot, mount, directory);
    if (!isContained(destinationRoot, destination)) {
      throw new Error(`destination escapes output root: ${join(mount, directory)}`);
    }
    mkdirSync(destination, { recursive: true });
  }
  for (const file of inventory.files) {
    const destinationPath = mount ? `${mount}/${file.path}` : file.path;
    const destination = resolve(destinationRoot, destinationPath);
    if (!isContained(destinationRoot, destination)) {
      throw new Error(`destination escapes output root: ${destinationPath}`);
    }
    const sourceMetadata = lstatSync(file.absolutePath);
    const sourceBytes = sourceMetadata.isFile() && !sourceMetadata.isSymbolicLink()
      ? readFileSync(file.absolutePath)
      : undefined;
    if (
      !sourceBytes
      || sourceBytes.length !== file.size
      || createHash('sha256').update(sourceBytes).digest('hex') !== file.sha256
    ) {
      throw new Error(`source changed during composition: ${destinationPath}`);
    }
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(file.absolutePath, destination);
    const copied = lstatSync(destination);
    const copiedBytes = copied.isFile() && !copied.isSymbolicLink()
      ? readFileSync(destination)
      : undefined;
    if (
      !copiedBytes
      || copiedBytes.length !== file.size
      || createHash('sha256').update(copiedBytes).digest('hex') !== file.sha256
    ) {
      throw new Error(`copy verification failed: ${destinationPath}`);
    }
    totalBytes += copied.size;
  }
  return Object.freeze({ files: inventory.files.length, bytes: totalBytes });
}

export function composeCaseStudyPages({ siteDist, gameDist, outDir } = {}) {
  const siteRoot = validateSourceRoot(siteDist, 'siteDist');
  const gameRoot = validateSourceRoot(gameDist, 'gameDist');
  if (siteRoot === gameRoot) {
    throw new Error('siteDist and gameDist must be different directories');
  }
  const output = validateOutputRoot(outDir, [siteRoot, gameRoot]);
  const site = inventoryTree(siteRoot, 'siteDist');
  const game = inventoryTree(gameRoot, 'gameDist');
  assertRequiredFiles(site, game);
  assertNoCollisions(site, game);

  mkdirSync(dirname(output.outDir), { recursive: true });
  const stagingRoot = mkdtempSync(join(dirname(output.outDir), '.case-study-compose-'));
  try {
    const siteSummary = copyInventory(site, stagingRoot);
    mkdirSync(resolve(stagingRoot, GAME_MOUNT), { recursive: true });
    const gameSummary = copyInventory(game, stagingRoot, GAME_MOUNT);
    if (output.removeEmptyOutput) {
      rmdirSync(output.outDir);
    }
    renameSync(stagingRoot, output.outDir);
    return Object.freeze({
      game: gameSummary,
      gameMount: `${GAME_MOUNT}/`,
      outDir: output.outDir,
      site: siteSummary,
      totalBytes: siteSummary.bytes + gameSummary.bytes,
      totalFiles: siteSummary.files + gameSummary.files,
    });
  } catch (error) {
    rmSync(stagingRoot, { force: true, recursive: true });
    throw error;
  }
}

function parseArguments(argv) {
  const options = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) {
      positional.push(argument);
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`missing value for ${argument}`);
    }
    index += 1;
    if (argument === '--site-dist') options.siteDist = value;
    else if (argument === '--game-dist') options.gameDist = value;
    else if (argument === '--out-dir') options.outDir = value;
    else throw new Error(`unknown option: ${argument}`);
  }
  options.siteDist ??= positional[0];
  options.gameDist ??= positional[1];
  options.outDir ??= positional[2];
  if (positional.length > 3) {
    throw new Error('too many positional arguments');
  }
  return options;
}

function main() {
  try {
    const result = composeCaseStudyPages(parseArguments(process.argv.slice(2)));
    process.stdout.write(
      `PASS composed ${result.totalFiles} files (${result.totalBytes} bytes) at ${result.outDir}\n`,
    );
  } catch (error) {
    process.stderr.write(`ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
