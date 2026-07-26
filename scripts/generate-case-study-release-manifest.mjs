#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertExactPublicRouteFiles,
  assertExactSitemapRoutes,
  assertNoForbiddenRouteFiles,
  assertNoForbiddenSitemapUrls,
  assertRequiredPublicRouteFiles,
  hasExpectedPublicRoutes,
  PUBLIC_ROUTES,
} from './case-study-public-routes.mjs';

export const RELEASE_MANIFEST_PATH = 'case-study-release.json';
export const TREE_MANIFEST_PATH = 'case-study-tree-manifest.json';
export const RELEASE_SCHEMA_VERSION = 1;
export { PUBLIC_ROUTES };

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_PUBLICATION_MANIFEST = resolve(
  REPOSITORY_ROOT,
  'reference/case-study-publication-manifest.json',
);
const METADATA_PATHS = new Set([RELEASE_MANIFEST_PATH, TREE_MANIFEST_PATH]);

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function isContained(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === ''
    || (
      pathFromRoot !== '..'
      && !pathFromRoot.startsWith(`..${sep}`)
      && !isAbsolute(pathFromRoot)
    );
}

function validateRoot(value, label) {
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

function assertSafePath(path, label) {
  const segments = path.split('/');
  if (
    path.length === 0
    || path.includes('\\')
    || path.includes('\0')
    || segments.some((segment) => (
      segment.length === 0
      || segment === '.'
      || segment === '..'
      || /%(?:00|2e|2f|5c)/iu.test(segment)
    ))
  ) {
    throw new Error(`${label} contains an unsafe path: ${path}`);
  }
}

export function collectCandidateFiles(directory, options = {}) {
  const root = validateRoot(directory, options.label ?? 'candidate directory');
  const exclude = new Set(options.exclude ?? []);
  const files = [];
  const pending = [{ absolutePath: root, relativePath: '' }];
  while (pending.length > 0) {
    const current = pending.pop();
    const entries = readdirSync(current.absolutePath, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = current.relativePath
        ? `${current.relativePath}/${entry.name}`
        : entry.name;
      assertSafePath(path, options.label ?? 'tree');
      const absolutePath = resolve(current.absolutePath, entry.name);
      if (!isContained(root, absolutePath)) {
        throw new Error(`${options.label ?? 'tree'} entry escapes its root: ${path}`);
      }
      const metadata = lstatSync(absolutePath);
      if (metadata.isSymbolicLink()) {
        throw new Error(`${options.label ?? 'tree'} contains a symbolic link: ${path}`);
      }
      if (metadata.isDirectory()) {
        pending.push({ absolutePath, relativePath: path });
        continue;
      }
      if (!metadata.isFile()) {
        throw new Error(`${options.label ?? 'tree'} contains a non-file entry: ${path}`);
      }
      if (exclude.has(path)) {
        continue;
      }
      const bytes = readFileSync(absolutePath);
      files.push(Object.freeze({
        absolutePath,
        bytes: bytes.length,
        path,
        sha256: sha256(bytes),
      }));
    }
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  return Object.freeze(files);
}

export function digestFileRecords(files) {
  return sha256(files
    .map((file) => `${file.path}\0${file.bytes}\0${file.sha256}\n`)
    .sort()
    .join(''));
}

function summarize(files) {
  return Object.freeze({
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    files: files.length,
    treeDigestSha256: digestFileRecords(files),
  });
}

function normalizeInputRecords(files, prefix = '') {
  return files.map((file) => Object.freeze({
    bytes: file.bytes,
    path: prefix && file.path.startsWith(prefix)
      ? file.path.slice(prefix.length)
      : file.path,
    sha256: file.sha256,
  }));
}

function readJsonValue(value, label) {
  if (typeof value === 'string') {
    const bytes = readFileSync(resolve(value));
    return {
      bytes,
      label: isAbsolute(value) ? basename(value) : value.replaceAll('\\', '/'),
      record: JSON.parse(bytes.toString('utf8')),
    };
  }
  if (value && typeof value === 'object') {
    const record = value.record ?? value;
    const bytes = Buffer.from(stableJson(record));
    return { bytes, label: value.path ?? label, record };
  }
  throw new Error(`${label} must be a JSON object or file path`);
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, sortObject(value[key])]),
  );
}

function stableJson(value) {
  return `${JSON.stringify(sortObject(value), null, 2)}\n`;
}

function requireString(value, label, pattern) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function validateRunAttempt(value) {
  const attempt = typeof value === 'string' ? Number(value) : value;
  if (!Number.isSafeInteger(attempt) || attempt < 1) {
    throw new Error('runAttempt must be a positive safe integer');
  }
  return attempt;
}

function h5PublicationRecord(publication) {
  const record = publication.media?.find(
    (candidate) => candidate?.mediaId === 'MEDIA-H5-AUDITED-TREE',
  );
  if (
    !record
    || !Number.isInteger(record.provenance?.files)
    || !Number.isInteger(record.provenance?.bytes)
    || !/^[a-f0-9]{64}$/u.test(record.provenance?.treeDigestSha256 ?? '')
    || typeof record.academicDisplayDecisionRef !== 'string'
  ) {
    throw new Error('publication manifest lacks complete MEDIA-H5-AUDITED-TREE provenance');
  }
  return record;
}

function assertInputMatchesCandidate(candidateFiles, siteFiles, gameFiles) {
  const expected = new Map();
  for (const file of siteFiles) {
    expected.set(file.path, file);
  }
  for (const file of gameFiles) {
    const path = `play/game/${file.path}`;
    if (expected.has(path)) {
      throw new Error(`site and game inputs collide at ${path}`);
    }
    expected.set(path, file);
  }
  if (expected.size !== candidateFiles.length) {
    throw new Error(
      `candidate content file count differs from inputs: expected ${expected.size}, received ${candidateFiles.length}`,
    );
  }
  for (const candidate of candidateFiles) {
    const input = expected.get(candidate.path);
    if (
      !input
      || input.bytes !== candidate.bytes
      || input.sha256 !== candidate.sha256
    ) {
      throw new Error(`candidate bytes differ from composed inputs: ${candidate.path}`);
    }
  }
}

function readReleaseInputs(candidateFiles, options) {
  const candidateSiteFiles = candidateFiles.filter(
    (file) => !file.path.startsWith('play/game/'),
  );
  const candidateGameFiles = normalizeInputRecords(
    candidateFiles.filter((file) => file.path.startsWith('play/game/')),
    'play/game/',
  );
  const siteFiles = options.siteDist
    ? collectCandidateFiles(options.siteDist, { label: 'siteDist' })
    : candidateSiteFiles;
  const gameFiles = options.gameDist
    ? collectCandidateFiles(options.gameDist, { label: 'gameDist' })
    : candidateGameFiles;
  if (options.siteDist || options.gameDist) {
    if (!options.siteDist || !options.gameDist) {
      throw new Error('siteDist and gameDist must be supplied together');
    }
    assertInputMatchesCandidate(candidateFiles, siteFiles, gameFiles);
  }
  return { gameFiles, siteFiles };
}

function assertPublicationBinding(gameSummary, h5Record, pagesPrefix) {
  for (const field of ['files', 'bytes', 'treeDigestSha256']) {
    if (gameSummary[field] !== h5Record.provenance[field]) {
      throw new Error(
        `game input ${field} does not match publication evidence: `
        + `${String(gameSummary[field])} != ${String(h5Record.provenance[field])}`,
      );
    }
  }
  if (pagesPrefix !== '/pencil-blade-2026/') {
    throw new Error(`release Pages prefix must be /pencil-blade-2026/, received ${pagesPrefix}`);
  }
}

function contentFilesFor(directory) {
  return collectCandidateFiles(directory, {
    exclude: METADATA_PATHS,
    label: 'candidate directory',
  });
}

export function generateCaseStudyReleaseManifest(options = {}) {
  const candidateDir = validateRoot(options.candidateDir, 'candidateDir');
  const commitSha = requireString(
    options.commitSha,
    'commitSha',
    /^[a-f0-9]{40}$/u,
  );
  const runId = requireString(String(options.runId ?? ''), 'runId', /^[1-9]\d*$/u);
  const runAttempt = validateRunAttempt(options.runAttempt);
  const toolchain = readJsonValue(options.toolchain, 'toolchain');
  const publicationInput = readJsonValue(
    options.publicationManifest ?? DEFAULT_PUBLICATION_MANIFEST,
    'publicationManifest',
  );
  const publication = publicationInput.record;
  const h5Record = h5PublicationRecord(publication);
  const pagesPrefix = publication.repository?.pagesBase;
  if (pagesPrefix !== '/pencil-blade-2026/') {
    throw new Error('publication manifest has an unexpected Pages base');
  }

  const contentFiles = contentFilesFor(candidateDir);
  assertRequiredPublicRouteFiles(
    contentFiles.map((file) => file.path),
    'case-study candidate',
  );
  assertNoForbiddenRouteFiles(
    contentFiles.map((file) => file.path),
    'case-study candidate',
  );
  assertExactPublicRouteFiles(
    contentFiles.map((file) => file.path),
    'case-study candidate',
  );
  const sitemapSources = contentFiles
    .filter((file) => /(?:^|\/)sitemap[^/]*\.xml$/u.test(file.path))
    .map((file) => readFileSync(file.absolutePath, 'utf8'));
  assertNoForbiddenSitemapUrls(
    sitemapSources,
    'case-study candidate sitemap',
  );
  assertExactSitemapRoutes(
    sitemapSources,
    pagesPrefix,
    'case-study candidate sitemap',
  );
  const inputs = readReleaseInputs(contentFiles, options);
  const siteSummary = summarize(inputs.siteFiles);
  const gameSummary = summarize(inputs.gameFiles);
  assertPublicationBinding(gameSummary, h5Record, pagesPrefix);
  const contentSummary = summarize(contentFiles);

  const release = {
    schemaVersion: RELEASE_SCHEMA_VERSION,
    recordType: 'pencil-blade-case-study-release',
    commitSha,
    workflow: {
      runAttempt,
      runId,
    },
    toolchain: {
      path: toolchain.label,
      sha256: sha256(toolchain.bytes),
      record: toolchain.record,
    },
    publication: {
      academicDisplayDecisionRef: h5Record.academicDisplayDecisionRef,
      evidenceSnapshotId: publication.restorationEvidenceSnapshot?.snapshotId,
      manifestId: publication.manifestId,
      manifestPath: publicationInput.label,
      manifestSha256: sha256(publicationInput.bytes),
      manifestVersion: publication.manifestVersion,
      pagesPrefix,
      routes: PUBLIC_ROUTES,
      supportedLocales: publication.supportedLocales,
    },
    inputs: {
      game: gameSummary,
      site: siteSummary,
    },
    content: {
      bytes: contentSummary.bytes,
      contentTreeDigest: contentSummary.treeDigestSha256,
      files: contentSummary.files,
      excludes: [RELEASE_MANIFEST_PATH, TREE_MANIFEST_PATH],
    },
  };
  const releaseBytes = Buffer.from(stableJson(release));
  writeFileSync(resolve(candidateDir, RELEASE_MANIFEST_PATH), releaseBytes);

  const deployableFiles = collectCandidateFiles(candidateDir, {
    exclude: [TREE_MANIFEST_PATH],
    label: 'candidate directory',
  });
  const releaseFile = deployableFiles.find((file) => file.path === RELEASE_MANIFEST_PATH);
  if (!releaseFile) {
    throw new Error('release record was not written into the candidate');
  }
  const treeManifest = {
    schemaVersion: RELEASE_SCHEMA_VERSION,
    recordType: 'pencil-blade-case-study-tree-manifest',
    algorithm: 'sha256(path-NUL-bytes-NUL-sha256-LF)',
    content: {
      bytes: contentSummary.bytes,
      contentTreeDigest: contentSummary.treeDigestSha256,
      files: contentSummary.files,
    },
    releaseRecord: {
      bytes: releaseFile.bytes,
      path: releaseFile.path,
      sha256: releaseFile.sha256,
    },
    files: deployableFiles.map(({ path, bytes, sha256: digest }) => ({
      path,
      bytes,
      sha256: digest,
    })),
  };
  const treeBytes = Buffer.from(stableJson(treeManifest));
  writeFileSync(resolve(candidateDir, TREE_MANIFEST_PATH), treeBytes);
  const verified = verifyCaseStudyReleaseManifest(candidateDir);
  return Object.freeze({
    contentBytes: contentSummary.bytes,
    contentFiles: contentSummary.files,
    contentTreeDigest: contentSummary.treeDigestSha256,
    releaseManifestPath: resolve(candidateDir, RELEASE_MANIFEST_PATH),
    releaseRecordSha256: releaseFile.sha256,
    treeManifestPath: resolve(candidateDir, TREE_MANIFEST_PATH),
    treeManifestSha256: verified.treeManifestSha256,
  });
}

function compareFileLists(actual, expected, label) {
  if (!Array.isArray(expected) || actual.length !== expected.length) {
    throw new Error(`${label} file list length mismatch`);
  }
  for (let index = 0; index < actual.length; index += 1) {
    const actualFile = actual[index];
    const expectedFile = expected[index];
    if (
      actualFile.path !== expectedFile?.path
      || actualFile.bytes !== expectedFile?.bytes
      || actualFile.sha256 !== expectedFile?.sha256
    ) {
      throw new Error(`${label} file mismatch at ${actualFile.path}`);
    }
  }
}

export function verifyCaseStudyReleaseManifest(candidateDirectory) {
  const candidateDir = validateRoot(candidateDirectory, 'candidate directory');
  const releasePath = resolve(candidateDir, RELEASE_MANIFEST_PATH);
  const treePath = resolve(candidateDir, TREE_MANIFEST_PATH);
  if (!existsSync(releasePath) || !existsSync(treePath)) {
    throw new Error('candidate release metadata is incomplete');
  }
  const releaseBytes = readFileSync(releasePath);
  const treeBytes = readFileSync(treePath);
  const release = JSON.parse(releaseBytes.toString('utf8'));
  const tree = JSON.parse(treeBytes.toString('utf8'));
  if (
    release.schemaVersion !== RELEASE_SCHEMA_VERSION
    || release.recordType !== 'pencil-blade-case-study-release'
  ) {
    throw new Error('release record schema is invalid');
  }
  if (
    !/^[a-f0-9]{40}$/u.test(release.commitSha ?? '')
    || !/^[1-9]\d*$/u.test(String(release.workflow?.runId ?? ''))
    || !Number.isSafeInteger(release.workflow?.runAttempt)
    || release.workflow.runAttempt < 1
    || typeof release.toolchain?.path !== 'string'
    || release.toolchain.path.length === 0
    || !/^[a-f0-9]{64}$/u.test(release.toolchain?.sha256 ?? '')
    || !release.toolchain?.record
    || typeof release.toolchain.record !== 'object'
    || !Array.isArray(release.publication?.supportedLocales)
    || !Array.isArray(release.publication?.routes)
    || typeof release.publication?.manifestId !== 'string'
    || release.publication.manifestId.length === 0
    || typeof release.publication?.evidenceSnapshotId !== 'string'
    || release.publication.evidenceSnapshotId.length === 0
    || typeof release.publication?.manifestPath !== 'string'
    || release.publication.manifestPath.length === 0
    || !/^[a-f0-9]{64}$/u.test(release.publication?.manifestSha256 ?? '')
    || release.publication?.pagesPrefix !== '/pencil-blade-2026/'
    || !Array.isArray(release.content?.excludes)
    || release.content.excludes.length !== METADATA_PATHS.size
    || ![...METADATA_PATHS].every((path) => release.content.excludes.includes(path))
  ) {
    throw new Error('release identity or provenance binding is invalid');
  }
  if (
    tree.schemaVersion !== RELEASE_SCHEMA_VERSION
    || tree.recordType !== 'pencil-blade-case-study-tree-manifest'
    || tree.algorithm !== 'sha256(path-NUL-bytes-NUL-sha256-LF)'
  ) {
    throw new Error('tree manifest schema is invalid');
  }
  if (tree.files.some((file) => file.path === TREE_MANIFEST_PATH)) {
    throw new Error('tree manifest must exclude itself');
  }

  const contentFiles = contentFilesFor(candidateDir);
  const contentSummary = summarize(contentFiles);
  const siteSummary = summarize(contentFiles.filter(
    (file) => !file.path.startsWith('play/game/'),
  ));
  const gameSummary = summarize(normalizeInputRecords(
    contentFiles.filter((file) => file.path.startsWith('play/game/')),
    'play/game/',
  ));
  const summaryMatches = (actual, expected) => (
    expected
    && actual.files === expected.files
    && actual.bytes === expected.bytes
    && actual.treeDigestSha256 === expected.treeDigestSha256
  );
  if (
    release.content?.contentTreeDigest !== contentSummary.treeDigestSha256
    || release.content?.files !== contentSummary.files
    || release.content?.bytes !== contentSummary.bytes
    || tree.content?.contentTreeDigest !== contentSummary.treeDigestSha256
    || tree.content?.files !== contentSummary.files
    || tree.content?.bytes !== contentSummary.bytes
  ) {
    throw new Error('release content digest, file count, or byte count does not match candidate bytes');
  }
  if (
    !summaryMatches(siteSummary, release.inputs?.site)
    || !summaryMatches(gameSummary, release.inputs?.game)
    || JSON.stringify(release.publication.supportedLocales) !== JSON.stringify(['en', 'vi'])
    || !hasExpectedPublicRoutes(release.publication.routes)
  ) {
    throw new Error('release input digests or public locale/route set do not match candidate bytes');
  }

  const deployableFiles = collectCandidateFiles(candidateDir, {
    exclude: [TREE_MANIFEST_PATH],
    label: 'candidate directory',
  });
  compareFileLists(deployableFiles, tree.files, 'tree manifest');
  const releaseFile = deployableFiles.find((file) => file.path === RELEASE_MANIFEST_PATH);
  if (
    !releaseFile
    || tree.releaseRecord?.path !== RELEASE_MANIFEST_PATH
    || tree.releaseRecord?.bytes !== releaseFile.bytes
    || tree.releaseRecord?.sha256 !== releaseFile.sha256
    || releaseFile.sha256 !== sha256(releaseBytes)
  ) {
    throw new Error('tree manifest release-record binding is invalid');
  }
  return Object.freeze({
    contentBytes: contentSummary.bytes,
    contentFiles: contentSummary.files,
    contentTreeDigest: contentSummary.treeDigestSha256,
    release,
    releaseRecordSha256: releaseFile.sha256,
    treeManifest: tree,
    treeManifestSha256: sha256(treeBytes),
  });
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
    if (argument === '--candidate-dir') options.candidateDir = value;
    else if (argument === '--site-dist') options.siteDist = value;
    else if (argument === '--game-dist') options.gameDist = value;
    else if (argument === '--commit-sha') options.commitSha = value;
    else if (argument === '--run-id') options.runId = value;
    else if (argument === '--run-attempt') options.runAttempt = value;
    else if (argument === '--toolchain') options.toolchain = value;
    else if (argument === '--publication-manifest') options.publicationManifest = value;
    else throw new Error(`unknown option: ${argument}`);
  }
  options.candidateDir ??= positional[0];
  if (positional.length > 1) throw new Error('too many positional arguments');
  return options;
}

function main() {
  try {
    const result = generateCaseStudyReleaseManifest(parseArguments(process.argv.slice(2)));
    process.stdout.write(
      `PASS release content=${result.contentTreeDigest} tree=${result.treeManifestSha256} `
      + `files=${result.contentFiles} bytes=${result.contentBytes}\n`,
    );
  } catch (error) {
    process.stderr.write(`ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
