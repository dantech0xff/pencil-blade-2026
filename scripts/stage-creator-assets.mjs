#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_COUNTS = Object.freeze({
  png480x800: 392,
  png720x1280: 392,
  wav: 59,
  mp3: 3,
  fonts: 16,
  total: 862,
});

const CANONICAL_AUTHORITY = Object.freeze({
  resourceMapSha256: '165238f13f4186a9ab429c9c5a8bab07b4a42e941d0608f757d9e41a44d2ce67',
  sourceManifestSha256: '0143473b21e56525cde92163f72fd49b2a898ab70ef2b224cdad00eaba9238e3',
  totalBytes: 32_945_747,
  counts: EXPECTED_COUNTS,
});

const SUPPORTED_EXTENSIONS = new Set(['.png', '.wav', '.mp3', '.ttf', '.otf']);
const RESOURCE_CONSUMER_STATUSES = new Set([
  'consumed',
  'excluded',
  'unknown',
  'unsupported',
]);
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const TARGET_SUFFIX = ['game', 'assets', 'game'];
const NOFOLLOW = fs.constants.O_NOFOLLOW ?? 0;
const RACE_LIMITATION = 'Hostile same-user ancestor swaps cannot be made mathematically race-free without openat; the stage lock and identity rechecks fail closed for the supported workflow.';

class StagingError extends Error {}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function invariant(condition, message) {
  if (!condition) throw new StagingError(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function collisionKey(value) {
  return value.normalize('NFC').toLowerCase();
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function lstatMaybe(filePath) {
  try {
    return fs.lstatSync(filePath, { bigint: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function pathExists(filePath) {
  return lstatMaybe(filePath) !== null;
}

function identityOf(stat) {
  return `${stat.dev.toString()}:${stat.ino.toString()}`;
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function assertStableStat(before, after, label) {
  invariant(
    sameIdentity(before, after)
      && before.nlink === after.nlink
      && before.size === after.size
      && before.mode === after.mode,
    `${label} identity changed during access. ${RACE_LIMITATION}`,
  );
}

function assertPathMatchesStat(filePath, expected, label) {
  const actual = lstatMaybe(filePath);
  invariant(actual !== null, `${label} disappeared during access. ${RACE_LIMITATION}`);
  invariant(!actual.isSymbolicLink(), `${label} became a symlink. ${RACE_LIMITATION}`);
  assertStableStat(expected, actual, label);
}

function assertSingleLinkFile(stat, label) {
  invariant(stat.isFile(), `${label} must be a regular file`);
  invariant(stat.nlink === 1n, `${label} must have exactly one hard link; actual=${stat.nlink.toString()}`);
}

function readStableFile(filePath, label, expectedIdentity = null, allowedLinks = 1n) {
  const pathBefore = lstatMaybe(filePath);
  invariant(pathBefore !== null, `${label} does not exist`);
  invariant(!pathBefore.isSymbolicLink(), `${label} must not be a symlink`);
  invariant(pathBefore.isFile(), `${label} must be a regular file`);
  invariant(pathBefore.nlink === allowedLinks, `${label} must have exactly ${allowedLinks.toString()} hard link(s); actual=${pathBefore.nlink.toString()}`);
  if (expectedIdentity) {
    invariant(identityOf(pathBefore) === expectedIdentity, `${label} path identity changed. ${RACE_LIMITATION}`);
  }

  let descriptor;
  try {
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | NOFOLLOW);
  } catch (error) {
    throw new StagingError(`${label} could not be opened without following symlinks: ${error.message}`);
  }

  try {
    const descriptorBefore = fs.fstatSync(descriptor, { bigint: true });
    invariant(descriptorBefore.isFile(), `${label} must be a regular file`);
    invariant(
      descriptorBefore.nlink === allowedLinks,
      `${label} hard-link count changed during open`,
    );
    assertStableStat(pathBefore, descriptorBefore, label);
    const buffer = fs.readFileSync(descriptor);
    const descriptorAfter = fs.fstatSync(descriptor, { bigint: true });
    assertStableStat(descriptorBefore, descriptorAfter, label);
    invariant(descriptorAfter.size === BigInt(buffer.length), `${label} size changed during read`);
    assertPathMatchesStat(filePath, descriptorAfter, label);
    return {
      buffer,
      bytes: buffer.length,
      sha256: sha256Buffer(buffer),
      identity: identityOf(descriptorAfter),
      stat: descriptorAfter,
    };
  } finally {
    fs.closeSync(descriptor);
  }
}

function readStableFileWithLinks(filePath, label, allowedLinks) {
  const pathBefore = lstatMaybe(filePath);
  invariant(pathBefore !== null, `${label} does not exist`);
  invariant(!pathBefore.isSymbolicLink() && pathBefore.isFile(), `${label} must be a regular non-symlink file`);
  invariant(pathBefore.nlink === allowedLinks, `${label} hard-link count changed`);
  const descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | NOFOLLOW);
  try {
    const descriptorBefore = fs.fstatSync(descriptor, { bigint: true });
    invariant(descriptorBefore.isFile() && descriptorBefore.nlink === allowedLinks, `${label} hard-link count changed during open`);
    assertStableStat(pathBefore, descriptorBefore, label);
    const buffer = fs.readFileSync(descriptor);
    const descriptorAfter = fs.fstatSync(descriptor, { bigint: true });
    assertStableStat(descriptorBefore, descriptorAfter, label);
    invariant(descriptorAfter.size === BigInt(buffer.length), `${label} size changed during read`);
    assertPathMatchesStat(filePath, descriptorAfter, label);
    return { buffer, identity: identityOf(descriptorAfter), stat: descriptorAfter };
  } finally {
    fs.closeSync(descriptor);
  }
}

function readStableJson(filePath, label) {
  const file = readStableFile(filePath, label);
  try {
    return { value: JSON.parse(file.buffer.toString('utf8')), file };
  } catch (error) {
    throw new StagingError(`${label} is not valid JSON: ${error.message}`);
  }
}

function validateRelativePosixPath(relativePath, label) {
  invariant(typeof relativePath === 'string' && relativePath.length > 0, `${label} must be a non-empty string`);
  invariant(!relativePath.includes('\\'), `${label} must use POSIX separators`);
  invariant(!relativePath.includes('\0'), `${label} contains a NUL byte`);
  invariant(!path.posix.isAbsolute(relativePath), `${label} must be relative`);
  invariant(!/^[A-Za-z]:/.test(relativePath), `${label} must not be an absolute Windows path`);
  invariant(path.posix.normalize(relativePath) === relativePath, `${label} contains traversal or non-canonical segments`);
  const segments = relativePath.split('/');
  invariant(segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..'), `${label} contains traversal or empty segments`);
  return relativePath;
}

function extensionOf(relativePath) {
  return path.posix.extname(relativePath).toLowerCase();
}

function withoutExtension(relativePath) {
  return relativePath.slice(0, -path.posix.extname(relativePath).length);
}

function assertDirectoryStat(filePath, label) {
  const stat = lstatMaybe(filePath);
  invariant(stat !== null, `${label} does not exist`);
  invariant(!stat.isSymbolicLink(), `${label} must not be a symlink`);
  invariant(stat.isDirectory(), `${label} must be a directory`);
  return stat;
}

function collectTree(rootDir, label) {
  const rootStat = assertDirectoryStat(rootDir, `${label} root`);
  const files = [];
  const directories = [];
  const directorySnapshots = [{ path: rootDir, stat: rootStat }];
  const physicalFiles = new Map();
  const normalizedEntries = new Map();
  const stack = [{ fullPath: rootDir, relativePath: '' }];

  while (stack.length > 0) {
    const current = stack.pop();
    const directoryBefore = assertDirectoryStat(current.fullPath, `${label} directory ${current.relativePath || '.'}`);
    const entries = fs.readdirSync(current.fullPath, { withFileTypes: true });
    const directoryAfter = assertDirectoryStat(current.fullPath, `${label} directory ${current.relativePath || '.'}`);
    invariant(sameIdentity(directoryBefore, directoryAfter), `${label} directory identity changed during traversal: ${current.relativePath || '.'}. ${RACE_LIMITATION}`);
    entries.sort((left, right) => compareText(left.name, right.name));

    for (const entry of entries) {
      const fullPath = path.join(current.fullPath, entry.name);
      const relativePath = current.relativePath ? `${current.relativePath}/${entry.name}` : entry.name;
      validateRelativePosixPath(relativePath, `${label} path ${relativePath}`);
      const folded = collisionKey(relativePath);
      invariant(!normalizedEntries.has(folded), `${label} has a case/Unicode-normalization collision: ${normalizedEntries.get(folded)} and ${relativePath}`);
      normalizedEntries.set(folded, relativePath);
      const stat = lstatMaybe(fullPath);
      invariant(stat !== null, `${label} entry disappeared during traversal: ${relativePath}`);
      invariant(!stat.isSymbolicLink(), `${label} symlink is not allowed: ${relativePath}`);

      if (stat.isDirectory()) {
        directories.push(relativePath);
        directorySnapshots.push({ path: fullPath, stat });
        stack.push({ fullPath, relativePath });
      } else if (stat.isFile()) {
        assertSingleLinkFile(stat, `${label} file ${relativePath}`);
        const identity = identityOf(stat);
        invariant(!physicalFiles.has(identity), `${label} file identity is aliased: ${physicalFiles.get(identity)} and ${relativePath}`);
        physicalFiles.set(identity, relativePath);
        files.push({ fullPath, relativePath, bytes: Number(stat.size), identity, stat });
      } else {
        throw new StagingError(`${label} contains unsupported filesystem entry: ${relativePath}`);
      }
    }
  }

  files.sort((left, right) => compareText(left.relativePath, right.relativePath));
  directories.sort(compareText);
  directorySnapshots.sort((left, right) => compareText(left.path, right.path));
  return { files, directories, directorySnapshots };
}

function recheckSnapshots(snapshots, label) {
  for (const snapshot of snapshots) {
    const actual = lstatMaybe(snapshot.path);
    invariant(actual !== null, `${label} disappeared: ${snapshot.path}. ${RACE_LIMITATION}`);
    invariant(!actual.isSymbolicLink(), `${label} became a symlink: ${snapshot.path}. ${RACE_LIMITATION}`);
    invariant(sameIdentity(snapshot.stat, actual), `${label} identity changed: ${snapshot.path}. ${RACE_LIMITATION}`);
  }
}

function pathComponents(absolutePath) {
  const resolved = path.resolve(absolutePath);
  const parsed = path.parse(resolved);
  const components = [parsed.root];
  let current = parsed.root;
  const remainder = resolved.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for (const segment of remainder) {
    current = path.join(current, segment);
    components.push(current);
  }
  return components;
}

function snapshotExistingAncestors(paths) {
  const snapshots = new Map();
  for (const candidate of paths) {
    for (const component of pathComponents(candidate)) {
      const stat = lstatMaybe(component);
      if (stat === null) break;
      invariant(!stat.isSymbolicLink(), `path ancestor must not be a symlink: ${component}`);
      if (!snapshots.has(component)) snapshots.set(component, { path: component, stat });
    }
  }
  return [...snapshots.values()].sort((left, right) => compareText(left.path, right.path));
}

function manifestDigest(records) {
  const digest = crypto.createHash('sha256');
  for (const record of records) {
    digest.update(record.canonicalPath);
    digest.update('\0');
    digest.update(record.sha256);
    digest.update('\0');
  }
  return digest.digest('hex');
}

function validateAuthority(authority) {
  invariant(isPlainObject(authority), 'authority must be an object');
  invariant(HASH_PATTERN.test(authority.resourceMapSha256), 'authority resource-map SHA-256 is invalid');
  invariant(HASH_PATTERN.test(authority.sourceManifestSha256), 'authority source-manifest SHA-256 is invalid');
  invariant(Number.isSafeInteger(authority.totalBytes) && authority.totalBytes >= 0, 'authority total bytes is invalid');
  invariant(authority.counts?.total === EXPECTED_COUNTS.total, 'authority must require exactly 862 assets');
  return authority;
}

function createTestAuthority({ resourceMapSha256, sourceManifestSha256, totalBytes }) {
  return Object.freeze({
    resourceMapSha256,
    sourceManifestSha256,
    totalBytes,
    counts: EXPECTED_COUNTS,
  });
}

function validateRecord(record, label, expectedExtensionGroup) {
  invariant(isPlainObject(record), `${label} must be an object`);
  const relativePath = validateRelativePosixPath(record.path, `${label}.path`);
  const extension = extensionOf(relativePath);
  invariant(SUPPORTED_EXTENSIONS.has(extension), `${label} has unsupported extension: ${extension || '(none)'}`);
  invariant(record.extension === extension, `${label}.extension does not match its path`);
  invariant(expectedExtensionGroup.has(extension), `${label} has an extension outside its catalog group`);
  invariant(Number.isSafeInteger(record.bytes) && record.bytes >= 0, `${label}.bytes must be a non-negative safe integer`);
  invariant(typeof record.sha256 === 'string' && HASH_PATTERN.test(record.sha256), `${label}.sha256 must be a lowercase SHA-256`);
  return { relativePath, bytes: record.bytes, sha256: record.sha256, extension };
}

function validateSummary(resourceMap, authority) {
  invariant(isPlainObject(resourceMap), 'resource map must be an object');
  invariant(resourceMap.schemaVersion === 1, 'resource map schemaVersion must be 1');
  invariant(isPlainObject(resourceMap.summary?.assets), 'resource map summary.assets is required');
  const summary = resourceMap.summary.assets;
  invariant(summary.png === authority.counts.png480x800 + authority.counts.png720x1280, 'resource map must declare exactly 784 PNG assets');
  invariant(summary.wav === authority.counts.wav, 'resource map must declare exactly 59 WAV assets');
  invariant(summary.mp3 === authority.counts.mp3, 'resource map must declare exactly 3 MP3 assets');
  invariant(summary.fonts === authority.counts.fonts, 'resource map must declare exactly 16 font assets');
  invariant(summary.total === authority.counts.total, 'resource map must declare exactly 862 assets');
  const sourceDigest = resourceMap.inputs?.sourceHashes?.assetsManifest;
  invariant(sourceDigest === authority.sourceManifestSha256, `resource map source manifest SHA-256 mismatch: actual=${sourceDigest} expected=${authority.sourceManifestSha256}`);
  return sourceDigest;
}

function logicalIdFor(canonicalPath, extension) {
  if (extension === '.png') {
    return `image:${withoutExtension(canonicalPath.replace(/^(?:480x800|720x1280)\//, ''))}`;
  }
  if (extension === '.wav' || extension === '.mp3') return `audio:${withoutExtension(canonicalPath)}`;
  return `font:${withoutExtension(canonicalPath)}`;
}

function cocosTypeFor(extension) {
  if (extension === '.png') return 'cc.ImageAsset';
  if (extension === '.wav' || extension === '.mp3') return 'cc.AudioClip';
  return 'cc.TTFFont';
}

function importPolicyFor(extension) {
  if (extension === '.png') {
    return {
      mode: 'exact-source-byte-copy',
      decodeOrReencode: 'forbidden',
      resize: 'forbidden',
      trim: 'forbidden',
      alphaModification: 'forbidden',
      substitution: 'forbidden',
      creatorMetadata: 'pending',
    };
  }
  if (extension === '.wav' || extension === '.mp3') {
    return {
      mode: 'exact-source-byte-copy',
      transcode: 'forbidden',
      resample: 'forbidden',
      channelRemap: 'forbidden',
      substitution: 'forbidden',
      creatorMetadata: 'pending',
    };
  }
  return {
    mode: 'exact-source-byte-copy',
    rewrite: 'forbidden',
    subset: 'forbidden',
    substitution: 'forbidden',
    creatorMetadata: 'pending',
  };
}

function flattenResourceMap(resourceMap, authority = CANONICAL_AUTHORITY) {
  validateAuthority(authority);
  const sourceManifestSha256 = validateSummary(resourceMap, authority);
  const groups = [
    {
      label: 'assets.trees.480x800.files',
      records: resourceMap.assets?.trees?.['480x800']?.files,
      expectedCount: authority.counts.png480x800,
      prefix: '480x800',
      allowedExtensions: new Set(['.png']),
    },
    {
      label: 'assets.trees.720x1280.files',
      records: resourceMap.assets?.trees?.['720x1280']?.files,
      expectedCount: authority.counts.png720x1280,
      prefix: '720x1280',
      allowedExtensions: new Set(['.png']),
    },
    {
      label: 'assets.shared.sounds',
      records: resourceMap.assets?.shared?.sounds,
      expectedCount: authority.counts.wav + authority.counts.mp3,
      requiredPrefix: 'Sounds/',
      allowedExtensions: new Set(['.wav', '.mp3']),
    },
    {
      label: 'assets.shared.fonts',
      records: resourceMap.assets?.shared?.fonts,
      expectedCount: authority.counts.fonts,
      requiredPrefix: 'Fonts/',
      allowedExtensions: new Set(['.ttf', '.otf']),
    },
  ];

  const entries = [];
  for (const group of groups) {
    invariant(Array.isArray(group.records), `${group.label} must be an array`);
    invariant(group.records.length === group.expectedCount, `${group.label} must contain exactly ${group.expectedCount} entries`);
    group.records.forEach((record, index) => {
      const validated = validateRecord(record, `${group.label}[${index}]`, group.allowedExtensions);
      if (group.requiredPrefix) {
        invariant(validated.relativePath.startsWith(group.requiredPrefix), `${group.label}[${index}].path must start with ${group.requiredPrefix}`);
      }
      const canonicalPath = group.prefix ? `${group.prefix}/${validated.relativePath}` : validated.relativePath;
      validateRelativePosixPath(canonicalPath, `${group.label}[${index}] canonical path`);
      entries.push({
        canonicalPath,
        targetPath: `game/assets/game/${canonicalPath}`,
        logicalId: logicalIdFor(canonicalPath, validated.extension),
        bytes: validated.bytes,
        sha256: validated.sha256,
        extension: validated.extension,
        cocosType: cocosTypeFor(validated.extension),
        importPolicy: importPolicyFor(validated.extension),
        rightsStatus: 'unresolved',
        consumerStatus: 'unmapped',
        creatorMetaStatus: 'pending',
        creatorUuidStatus: 'pending',
      });
    });
  }

  invariant(entries.length === authority.counts.total, `resource map must enumerate exactly ${authority.counts.total} assets`);
  entries.sort((left, right) => compareText(left.canonicalPath, right.canonicalPath));
  const sourcePaths = new Set();
  const targetPaths = new Set();
  const foldedSourcePaths = new Map();
  const foldedTargetPaths = new Map();
  for (const entry of entries) {
    invariant(!sourcePaths.has(entry.canonicalPath), `duplicate source path: ${entry.canonicalPath}`);
    invariant(!targetPaths.has(entry.targetPath), `duplicate target path: ${entry.targetPath}`);
    sourcePaths.add(entry.canonicalPath);
    targetPaths.add(entry.targetPath);
    const foldedSource = collisionKey(entry.canonicalPath);
    const foldedTarget = collisionKey(entry.targetPath);
    invariant(!foldedSourcePaths.has(foldedSource), `case/Unicode-normalization source collision: ${foldedSourcePaths.get(foldedSource)} and ${entry.canonicalPath}`);
    invariant(!foldedTargetPaths.has(foldedTarget), `case/Unicode-normalization target collision: ${foldedTargetPaths.get(foldedTarget)} and ${entry.targetPath}`);
    foldedSourcePaths.set(foldedSource, entry.canonicalPath);
    foldedTargetPaths.set(foldedTarget, entry.targetPath);
  }

  const extensionCounts = entries.reduce((counts, entry) => {
    counts[entry.extension] = (counts[entry.extension] || 0) + 1;
    return counts;
  }, {});
  invariant(extensionCounts['.png'] === 784, 'resource map PNG count mismatch');
  invariant(extensionCounts['.wav'] === authority.counts.wav, 'resource map WAV count mismatch');
  invariant(extensionCounts['.mp3'] === authority.counts.mp3, 'resource map MP3 count mismatch');
  invariant((extensionCounts['.ttf'] || 0) + (extensionCounts['.otf'] || 0) === authority.counts.fonts, 'resource map font count mismatch');
  invariant(entries.reduce((sum, entry) => sum + entry.bytes, 0) === authority.totalBytes, `resource map byte total must be exactly ${authority.totalBytes}`);
  return { entries, sourceManifestSha256 };
}

function assertSortedUniqueStrings(values, label, allowEmpty = false) {
  invariant(Array.isArray(values), `${label} must be an array`);
  if (!allowEmpty) invariant(values.length > 0, `${label} must not be empty`);
  const sorted = [...values].sort(compareText);
  invariant(
    values.every((value, index) => (
      typeof value === 'string'
      && value.length > 0
      && value === sorted[index]
      && (index === 0 || value !== values[index - 1])
    )),
    `${label} must contain sorted unique non-empty strings`,
  );
  return values;
}

function percent(numerator, denominator) {
  return denominator === 0
    ? 100
    : Math.round((numerator / denominator) * 10_000) / 100;
}

function resourceReconciliationSummary(entries) {
  const counts = {
    consumed: 0,
    unknown: 0,
    excluded: 0,
    unsupported: 0,
    unmapped: 0,
  };
  for (const entry of entries) {
    invariant(
      entry.consumerStatus === 'unmapped'
      || RESOURCE_CONSUMER_STATUSES.has(entry.consumerStatus),
      `invalid consumer status for ${entry.canonicalPath}: ${String(entry.consumerStatus)}`,
    );
    counts[entry.consumerStatus] += 1;
  }
  const total = entries.length;
  const reconciled = total - counts.unmapped;
  return {
    consumers: {
      consumed: counts.consumed,
      total,
      coveragePercent: percent(counts.consumed, total),
      status: counts.consumed === total
        ? 'complete'
        : counts.consumed === 0
          ? 'unmapped'
          : 'partial',
    },
    reconciliation: {
      classified: reconciled,
      consumed: counts.consumed,
      unknown: counts.unknown,
      excluded: counts.excluded,
      unsupported: counts.unsupported,
      total,
      coveragePercent: percent(reconciled, total),
      status: reconciled === total ? 'complete' : 'incomplete',
    },
  };
}

function applyResourceReconciliationLedger(
  baseEntries,
  ledger,
  authority = CANONICAL_AUTHORITY,
) {
  validateAuthority(authority);
  invariant(isPlainObject(ledger), 'resource reconciliation ledger must be an object');
  invariant(ledger.schemaVersion === 1, 'resource reconciliation ledger schemaVersion must be 1');
  invariant(
    ledger.scope === 'recovered-apk-resource-reconciliation',
    'resource reconciliation ledger scope is invalid',
  );
  invariant(isPlainObject(ledger.source), 'resource reconciliation ledger source is required');
  invariant(
    ledger.source.resourceMapSha256 === authority.resourceMapSha256,
    'resource reconciliation ledger resource-map SHA-256 mismatch',
  );
  invariant(
    ledger.source.sourceManifestSha256 === authority.sourceManifestSha256,
    'resource reconciliation ledger source-manifest SHA-256 mismatch',
  );
  invariant(
    ledger.source.consumerRegistry
      === 'game/assets/scripts/domain/resource-consumer-registry.ts',
    'resource reconciliation ledger consumer registry is invalid',
  );
  invariant(
    HASH_PATTERN.test(ledger.source.consumerRegistrySha256),
    'resource reconciliation ledger consumer registry SHA-256 is invalid',
  );
  invariant(
    ledger.source.dispositions
      === 'forensics/resources/resource-disposition-map.json',
    'resource reconciliation ledger disposition authority is invalid',
  );
  invariant(
    HASH_PATTERN.test(ledger.source.dispositionsSha256),
    'resource reconciliation ledger dispositions SHA-256 is invalid',
  );
  invariant(
    Array.isArray(ledger.entries)
      && ledger.entries.length === baseEntries.length,
    `resource reconciliation ledger must enumerate exactly ${baseEntries.length} entries`,
  );

  const baseByPath = new Map(
    baseEntries.map((entry) => [entry.canonicalPath, entry]),
  );
  const reconciledByPath = new Map();
  let previousPath = null;
  for (const [index, record] of ledger.entries.entries()) {
    const label = `resource reconciliation ledger entries[${index}]`;
    invariant(isPlainObject(record), `${label} must be an object`);
    const canonicalPath = validateRelativePosixPath(
      record.canonicalPath,
      `${label}.canonicalPath`,
    );
    invariant(
      previousPath === null || compareText(previousPath, canonicalPath) < 0,
      'resource reconciliation ledger entries must be sorted with unique canonical paths',
    );
    previousPath = canonicalPath;
    invariant(baseByPath.has(canonicalPath), `${label} is not staged: ${canonicalPath}`);
    invariant(
      RESOURCE_CONSUMER_STATUSES.has(record.status),
      `${label}.status is invalid: ${String(record.status)}`,
    );
    assertSortedUniqueStrings(record.evidenceRefs, `${label}.evidenceRefs`);

    const base = baseByPath.get(canonicalPath);
    const {
      consumerStatus: _consumerStatus,
      creatorMetaStatus,
      creatorUuidStatus,
      ...prefix
    } = base;
    if (record.status === 'consumed') {
      assertSortedUniqueStrings(record.consumerIds, `${label}.consumerIds`);
      invariant(
        record.dispositionId === undefined && record.reason === undefined,
        `${label} consumed entries must not contain disposition fields`,
      );
      reconciledByPath.set(canonicalPath, {
        ...prefix,
        consumerStatus: record.status,
        consumerIds: [...record.consumerIds],
        consumerEvidenceRefs: [...record.evidenceRefs],
        creatorMetaStatus,
        creatorUuidStatus,
      });
      continue;
    }

    invariant(
      typeof record.dispositionId === 'string' && record.dispositionId.length > 0,
      `${label}.dispositionId must be a non-empty string`,
    );
    invariant(
      typeof record.reason === 'string' && record.reason.length > 0,
      `${label}.reason must be a non-empty string`,
    );
    invariant(
      record.consumerIds === undefined,
      `${label} non-consumed entries must not contain consumerIds`,
    );
    reconciledByPath.set(canonicalPath, {
      ...prefix,
      consumerStatus: record.status,
      consumerDispositionId: record.dispositionId,
      consumerEvidenceRefs: [...record.evidenceRefs],
      creatorMetaStatus,
      creatorUuidStatus,
    });
  }

  invariant(
    reconciledByPath.size === baseEntries.length,
    'resource reconciliation ledger omitted staged entries',
  );
  const entries = baseEntries.map((entry) => reconciledByPath.get(entry.canonicalPath));
  const expectedSummary = resourceReconciliationSummary(entries);
  invariant(
    JSON.stringify(ledger.summary) === JSON.stringify(expectedSummary),
    'resource reconciliation ledger summary does not match its entries',
  );
  invariant(
    expectedSummary.reconciliation.status === 'complete',
    'resource reconciliation ledger must explicitly reconcile every staged asset',
  );
  return entries;
}

function expectedDirectories(entries) {
  const directories = new Set();
  for (const entry of entries) {
    let directory = path.posix.dirname(entry.canonicalPath);
    while (directory !== '.') {
      directories.add(directory);
      directory = path.posix.dirname(directory);
    }
  }
  return [...directories].sort(compareText);
}

function assertDirectorySet(actualDirectories, entries, label) {
  const expected = expectedDirectories(entries);
  const actualSet = new Set(actualDirectories);
  const expectedSet = new Set(expected);
  for (const directory of expected) invariant(actualSet.has(directory), `${label} is missing canonical directory: ${directory}`);
  for (const directory of actualDirectories) invariant(expectedSet.has(directory), `${label} contains unexpected directory: ${directory}`);
}

function scanAndValidateSource(sourceRoot, expectedEntries, expectedDigest, previousRecords = null) {
  const tree = collectTree(sourceRoot, 'source');
  assertDirectorySet(tree.directories, expectedEntries, 'source');
  const expectedByPath = new Map(expectedEntries.map((entry) => [entry.canonicalPath, entry]));
  const actualByPath = new Map(tree.files.map((file) => [file.relativePath, file]));
  const missing = [...expectedByPath.keys()].filter((relativePath) => !actualByPath.has(relativePath));
  const extra = [...actualByPath.keys()].filter((relativePath) => !expectedByPath.has(relativePath));
  invariant(missing.length === 0, `source is missing mapped asset: ${missing[0]}`);
  invariant(extra.length === 0, `source contains extra asset: ${extra[0]}`);

  const previousByPath = previousRecords ? new Map(previousRecords.map((record) => [record.canonicalPath, record])) : null;
  const validatedRecords = [];
  const identities = new Set();
  for (const entry of expectedEntries) {
    const actual = actualByPath.get(entry.canonicalPath);
    const extension = extensionOf(entry.canonicalPath);
    invariant(SUPPORTED_EXTENSIONS.has(extension), `source contains unsupported extension: ${entry.canonicalPath}`);
    invariant(actual.bytes === entry.bytes, `source byte-size mismatch: ${entry.canonicalPath}`);
    const read = readStableFile(actual.fullPath, `source file ${entry.canonicalPath}`, actual.identity);
    invariant(read.bytes === entry.bytes, `source byte-size mismatch: ${entry.canonicalPath}`);
    invariant(read.sha256 === entry.sha256, `source SHA-256 mismatch: ${entry.canonicalPath}`);
    invariant(!identities.has(read.identity), `source file identity is aliased: ${entry.canonicalPath}`);
    identities.add(read.identity);
    if (previousByPath) {
      const previous = previousByPath.get(entry.canonicalPath);
      invariant(previous && previous.identity === read.identity, `source file identity changed: ${entry.canonicalPath}. ${RACE_LIMITATION}`);
    }
    validatedRecords.push({
      canonicalPath: entry.canonicalPath,
      fullPath: actual.fullPath,
      bytes: read.bytes,
      sha256: read.sha256,
      identity: read.identity,
    });
  }
  const actualDigest = manifestDigest(validatedRecords);
  invariant(actualDigest === expectedDigest, `source manifest SHA-256 mismatch: actual=${actualDigest} expected=${expectedDigest}`);
  return { records: validatedRecords, identities, digest: actualDigest, directorySnapshots: tree.directorySnapshots };
}

function totalBytes(entries) {
  return entries.reduce((sum, entry) => sum + entry.bytes, 0);
}

function buildManifest(
  entries,
  sourceManifestSha256,
  reconciliationSha256 = null,
) {
  const bytes = totalBytes(entries);
  const resourceSummary = resourceReconciliationSummary(entries);
  const hasReconciliationAuthority = resourceSummary.reconciliation.status === 'complete';
  invariant(
    !hasReconciliationAuthority || HASH_PATTERN.test(reconciliationSha256),
    'a complete resource reconciliation requires its ledger SHA-256',
  );
  invariant(
    hasReconciliationAuthority || reconciliationSha256 === null,
    'an incomplete resource reconciliation must not claim a ledger SHA-256',
  );
  return {
    schemaVersion: 2,
    scope: 'recovered-apk-assets',
    scopeLimit: 'Complete for recovered APK assets only; canonical sample-project completeness is unresolved.',
    source: {
      authority: 'resource-usage-map.json',
      reconciliationAuthority: hasReconciliationAuthority
        ? {
          file: 'resource-reconciliation-ledger.json',
          sha256: reconciliationSha256,
        }
        : null,
      root: 'assets',
      manifestSha256: sourceManifestSha256,
      immutable: true,
    },
    target: {
      root: 'game/assets/game',
      copyMode: 'exact-source-bytes',
    },
    summary: {
      inventory: { assets: entries.length, bytes, coveragePercent: 100, status: 'complete-for-recovered-apk-assets' },
      staging: { assets: entries.length, bytes, coveragePercent: 100, byteMismatches: 0, status: 'byte-verified' },
      consumers: resourceSummary.consumers,
      reconciliation: resourceSummary.reconciliation,
      creatorMetadata: { captured: 0, total: entries.length, coveragePercent: 0, status: 'pending' },
      creatorUuids: { captured: 0, total: entries.length, coveragePercent: 0, status: 'pending' },
      rights: { resolved: 0, unresolved: entries.length, status: 'unresolved' },
      canonicalSampleProjectCompleteness: 'unresolved',
    },
    entries,
  };
}

function serializedManifest(
  entries,
  sourceManifestSha256,
  reconciliationSha256 = null,
) {
  return `${JSON.stringify(buildManifest(
    entries,
    sourceManifestSha256,
    reconciliationSha256,
  ), null, 2)}\n`;
}

function hasTargetSuffix(targetRoot) {
  const segments = path.resolve(targetRoot).split(path.sep).filter(Boolean);
  return TARGET_SUFFIX.every((segment, index) => segments[segments.length - TARGET_SUFFIX.length + index] === segment);
}

function isWithin(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function resolveThroughExistingAncestor(filePath) {
  let existingPath = path.resolve(filePath);
  const missingSegments = [];
  while (!pathExists(existingPath)) {
    const parent = path.dirname(existingPath);
    invariant(parent !== existingPath, 'path has no existing filesystem ancestor');
    missingSegments.unshift(path.basename(existingPath));
    existingPath = parent;
  }
  try {
    return path.join(fs.realpathSync(existingPath), ...missingSegments);
  } catch (error) {
    throw new StagingError(`path cannot be resolved safely: ${error.message}`);
  }
}

function normalizeOptions(options) {
  return {
    sourceRoot: path.resolve(options.sourceRoot),
    resourceMapPath: path.resolve(options.resourceMapPath),
    reconciliationPath: options.reconciliationPath
      ? path.resolve(options.reconciliationPath)
      : null,
    targetRoot: path.resolve(options.targetRoot),
    manifestPath: path.resolve(options.manifestPath),
  };
}

function validatePaths(rawOptions) {
  const options = normalizeOptions(rawOptions);
  const effectiveSource = resolveThroughExistingAncestor(options.sourceRoot);
  const effectiveResourceMap = resolveThroughExistingAncestor(options.resourceMapPath);
  const effectiveReconciliation = options.reconciliationPath
    ? resolveThroughExistingAncestor(options.reconciliationPath)
    : null;
  const effectiveTarget = resolveThroughExistingAncestor(options.targetRoot);
  const effectiveManifest = resolveThroughExistingAncestor(options.manifestPath);
  invariant(hasTargetSuffix(options.targetRoot) && hasTargetSuffix(effectiveTarget), 'target must end with game/assets/game');
  invariant(path.parse(options.targetRoot).root !== options.targetRoot, 'target must not be a filesystem root');
  invariant(options.sourceRoot !== options.targetRoot && effectiveSource !== effectiveTarget, 'source and target must be different paths');
  invariant(!isWithin(options.sourceRoot, options.targetRoot) && !isWithin(effectiveSource, effectiveTarget), 'target must not be inside the immutable source root');
  invariant(!isWithin(options.targetRoot, options.sourceRoot) && !isWithin(effectiveTarget, effectiveSource), 'immutable source root must not be inside target');
  invariant(
    options.manifestPath !== options.sourceRoot
      && effectiveManifest !== effectiveSource
      && !isWithin(options.sourceRoot, options.manifestPath)
      && !isWithin(effectiveSource, effectiveManifest),
    'manifest output must not be inside the immutable source root',
  );
  invariant(
    options.manifestPath !== options.targetRoot
      && effectiveManifest !== effectiveTarget
      && !isWithin(options.targetRoot, options.manifestPath)
      && !isWithin(effectiveTarget, effectiveManifest),
    'manifest output must not be inside target',
  );
  invariant(options.resourceMapPath !== options.manifestPath && effectiveResourceMap !== effectiveManifest, 'resource map and manifest output must be different paths');
  if (options.reconciliationPath) {
    invariant(
      options.reconciliationPath !== options.resourceMapPath
        && effectiveReconciliation !== effectiveResourceMap,
      'resource map and reconciliation ledger must be different paths',
    );
    invariant(
      options.reconciliationPath !== options.manifestPath
        && effectiveReconciliation !== effectiveManifest,
      'reconciliation ledger and manifest output must be different paths',
    );
    invariant(
      options.reconciliationPath !== options.targetRoot
        && effectiveReconciliation !== effectiveTarget
        && !isWithin(options.targetRoot, options.reconciliationPath)
        && !isWithin(effectiveTarget, effectiveReconciliation),
      'reconciliation ledger must not be inside target',
    );
    invariant(
      options.reconciliationPath !== options.sourceRoot
        && effectiveReconciliation !== effectiveSource
        && !isWithin(options.sourceRoot, options.reconciliationPath)
        && !isWithin(effectiveSource, effectiveReconciliation),
      'reconciliation ledger must not be inside the immutable source root',
    );
  }
  return options;
}

function assertPathAbsent(filePath, label) {
  invariant(lstatMaybe(filePath) === null, `${label} must be absent`);
}

function prepareOutputParents(options) {
  const targetParent = path.dirname(options.targetRoot);
  const manifestParent = path.dirname(options.manifestPath);
  snapshotExistingAncestors([targetParent, manifestParent]);
  fs.mkdirSync(targetParent, { recursive: true });
  fs.mkdirSync(manifestParent, { recursive: true });
  assertDirectoryStat(targetParent, 'target parent');
  assertDirectoryStat(manifestParent, 'manifest parent');
}

function stagingAncestorPaths(options) {
  return [
    options.sourceRoot,
    options.resourceMapPath,
    options.reconciliationPath,
    path.dirname(options.targetRoot),
    path.dirname(options.manifestPath),
  ].filter(Boolean);
}

function assertStageOutputsAbsent(options) {
  assertPathAbsent(options.targetRoot, 'target');
  assertPathAbsent(options.manifestPath, 'manifest output');
}

function revalidateImmutableInputs(options, authorityState, authority, ancestorSnapshots, recheckSourceDirectories = false) {
  recheckSnapshots(ancestorSnapshots, 'path ancestor');
  const source = scanAndValidateSource(
    options.sourceRoot,
    authorityState.entries,
    authority.sourceManifestSha256,
    authorityState.source.records,
  );
  if (recheckSourceDirectories) recheckSnapshots(source.directorySnapshots, 'source directory');
  recheckAuthority(
    options.resourceMapPath,
    options.reconciliationPath,
    authorityState,
    authority,
  );
}

function randomSiblingPath(basePath, kind) {
  return path.join(path.dirname(basePath), `.${path.basename(basePath)}.${kind}-${crypto.randomBytes(12).toString('hex')}`);
}

function createExclusiveStageDirectory(targetRoot) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const candidate = randomSiblingPath(targetRoot, 'stage');
    try {
      fs.mkdirSync(candidate, { mode: 0o700 });
      return { path: candidate, stat: assertDirectoryStat(candidate, 'staging directory') };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }
  throw new StagingError('could not create an exclusive random staging directory');
}

function acquireStageLock(targetRoot, hooks = {}) {
  const lockPath = `${targetRoot}.stage.lock`;
  let descriptor;
  try {
    descriptor = fs.openSync(lockPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW, 0o600);
  } catch (error) {
    throw new StagingError(`stage lock could not be acquired exclusively: ${error.message}`);
  }
  const lock = { path: lockPath, descriptor, stat: null, identity: null };
  try {
    const createdStat = fs.fstatSync(descriptor, { bigint: true });
    lock.identity = identityOf(createdStat);
    assertSingleLinkFile(createdStat, 'stage lock');
    assertPathMatchesStat(lockPath, createdStat, 'stage lock');
    const token = crypto.randomBytes(24).toString('hex');
    fs.writeFileSync(descriptor, `${token}\n`);
    hooks.afterStageLockWrite?.({ lockPath });
    fs.fsyncSync(descriptor);
    const stat = fs.fstatSync(descriptor, { bigint: true });
    assertSingleLinkFile(stat, 'stage lock');
    assertPathMatchesStat(lockPath, stat, 'stage lock');
    lock.stat = stat;
    return lock;
  } catch (error) {
    const lockIssue = releaseOwnedLock(lock);
    const message = error instanceof Error ? error.message : String(error);
    throw new StagingError(`stage lock initialization failed: ${message}${lockIssue ? `; recovery: ${lockIssue}` : ''}`);
  }
}

function lockOwnershipState(lock) {
  const descriptorStat = fs.fstatSync(lock.descriptor, { bigint: true });
  const pathStat = lstatMaybe(lock.path);
  return {
    descriptorOwned: identityOf(descriptorStat) === lock.identity && descriptorStat.nlink === 1n,
    pathOwned: pathStat !== null
      && !pathStat.isSymbolicLink()
      && identityOf(pathStat) === lock.identity
      && pathStat.nlink === 1n,
  };
}

function assertOwnedLock(lock) {
  const ownership = lockOwnershipState(lock);
  invariant(ownership.descriptorOwned, `stage lock descriptor identity changed. ${RACE_LIMITATION}`);
  invariant(ownership.pathOwned, `stage lock path identity changed; replacement retained. ${RACE_LIMITATION}`);
}

function releaseOwnedLock(lock) {
  if (!lock) return null;
  let issue = null;
  try {
    const ownership = lockOwnershipState(lock);
    if (ownership.descriptorOwned && ownership.pathOwned) {
      fs.unlinkSync(lock.path);
    } else {
      issue = `stage lock was replaced or aliased; replacement retained at lock path ${lock.path}. ${RACE_LIMITATION}`;
    }
  } catch (error) {
    issue = `stage lock could not be safely released; lock retained at path ${lock.path}: ${error.message}. ${RACE_LIMITATION}`;
  }
  try {
    fs.closeSync(lock.descriptor);
  } catch (error) {
    const closeIssue = `stage lock descriptor could not be closed: ${error.message}`;
    issue = issue ? `${issue}; ${closeIssue}` : closeIssue;
  }
  return issue;
}

function ensureDirectoryInside(rootDir, relativeDirectory) {
  let current = rootDir;
  for (const segment of relativeDirectory.split('/').filter(Boolean)) {
    current = path.join(current, segment);
    const stat = lstatMaybe(current);
    if (stat === null) fs.mkdirSync(current, { mode: 0o755 });
    assertDirectoryStat(current, `staging directory ${toPosix(path.relative(rootDir, current))}`);
  }
}

function writeExclusiveBuffer(filePath, buffer, label, sourceIdentities, targetIdentities) {
  let descriptor;
  try {
    descriptor = fs.openSync(filePath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW, 0o644);
  } catch (error) {
    throw new StagingError(`${label} could not be created exclusively without following symlinks: ${error.message}`);
  }
  let descriptorStat;
  try {
    const before = fs.fstatSync(descriptor, { bigint: true });
    assertSingleLinkFile(before, label);
    const identity = identityOf(before);
    invariant(!sourceIdentities.has(identity), `${label} aliases a source file identity`);
    invariant(!targetIdentities.has(identity), `${label} aliases another target file identity`);
    fs.writeFileSync(descriptor, buffer);
    descriptorStat = fs.fstatSync(descriptor, { bigint: true });
    invariant(sameIdentity(before, descriptorStat) && descriptorStat.nlink === 1n, `${label} identity changed during write. ${RACE_LIMITATION}`);
    invariant(descriptorStat.size === BigInt(buffer.length), `${label} byte-size mismatch after write`);
  } finally {
    fs.closeSync(descriptor);
  }
  assertPathMatchesStat(filePath, descriptorStat, label);
  const verified = readStableFile(filePath, label, identityOf(descriptorStat));
  invariant(verified.buffer.equals(buffer), `${label} bytes changed after write`);
  targetIdentities.add(verified.identity);
  return verified;
}

function copyEntries(sourceRoot, destinationRoot, entries, sourceState) {
  const sourceByPath = new Map(sourceState.records.map((record) => [record.canonicalPath, record]));
  const targetIdentities = new Set();
  for (const entry of entries) {
    const sourceRecord = sourceByPath.get(entry.canonicalPath);
    const sourceRead = readStableFile(sourceRecord.fullPath, `source file ${entry.canonicalPath}`, sourceRecord.identity);
    invariant(sourceRead.bytes === entry.bytes && sourceRead.sha256 === entry.sha256, `source changed before copy: ${entry.canonicalPath}`);
    const destinationPath = path.join(destinationRoot, ...entry.canonicalPath.split('/'));
    ensureDirectoryInside(destinationRoot, path.posix.dirname(entry.canonicalPath));
    const destinationRead = writeExclusiveBuffer(
      destinationPath,
      sourceRead.buffer,
      `staged file ${entry.canonicalPath}`,
      sourceState.identities,
      targetIdentities,
    );
    invariant(destinationRead.bytes === entry.bytes && destinationRead.sha256 === entry.sha256, `staged file mismatch: ${entry.canonicalPath}`);
    const sourceAfterCopy = readStableFile(sourceRecord.fullPath, `source file ${entry.canonicalPath}`, sourceRecord.identity);
    invariant(sourceAfterCopy.bytes === entry.bytes && sourceAfterCopy.sha256 === entry.sha256, `source changed during copy: ${entry.canonicalPath}`);
  }
}

function verifyDestination(targetRoot, entries, sourceIdentities) {
  const tree = collectTree(targetRoot, 'target');
  assertDirectorySet(tree.directories, entries, 'target');
  const canonicalByPath = new Map(entries.map((entry) => [entry.canonicalPath, entry]));
  const allowedMetaPaths = new Set(entries.map((entry) => `${entry.canonicalPath}.meta`));
  for (const directory of expectedDirectories(entries)) allowedMetaPaths.add(`${directory}.meta`);
  const actualCanonical = new Map();
  const metaSidecars = [];
  const targetIdentities = new Set();

  for (const file of tree.files) {
    const read = readStableFile(file.fullPath, `target file ${file.relativePath}`, file.identity);
    invariant(!sourceIdentities.has(read.identity), `target file aliases a source file: ${file.relativePath}`);
    invariant(!targetIdentities.has(read.identity), `target files share an inode: ${file.relativePath}`);
    targetIdentities.add(read.identity);
    if (canonicalByPath.has(file.relativePath)) {
      const entry = canonicalByPath.get(file.relativePath);
      invariant(read.bytes === entry.bytes, `target byte-size mismatch: ${entry.canonicalPath}`);
      invariant(read.sha256 === entry.sha256, `target SHA-256 mismatch: ${entry.canonicalPath}`);
      actualCanonical.set(file.relativePath, read);
    } else if (allowedMetaPaths.has(file.relativePath)) {
      metaSidecars.push(file.relativePath);
    } else {
      throw new StagingError(`target contains unexpected file: ${file.relativePath}`);
    }
  }

  let bytes = 0;
  for (const entry of entries) {
    invariant(actualCanonical.has(entry.canonicalPath), `target is missing canonical asset: ${entry.canonicalPath}`);
    bytes += entry.bytes;
  }
  invariant(actualCanonical.size === entries.length, 'target canonical asset count mismatch');
  metaSidecars.sort(compareText);
  const expectedMetaSidecars = allowedMetaPaths.size;
  const metaStatus = metaSidecars.length === 0
    ? 'pending'
    : metaSidecars.length === expectedMetaSidecars
      ? 'present-unparsed'
      : 'partial-unparsed';
  return {
    assets: actualCanonical.size,
    bytes,
    byteMismatches: 0,
    metaSidecars: metaSidecars.length,
    expectedMetaSidecars,
    metaStatus,
    directorySnapshots: tree.directorySnapshots,
  };
}

function loadAuthority(
  sourceRoot,
  resourceMapPath,
  reconciliationPath,
  authority,
) {
  validateAuthority(authority);
  const resourceMap = readStableJson(resourceMapPath, 'resource map');
  invariant(
    resourceMap.file.sha256 === authority.resourceMapSha256,
    `resource map SHA-256 mismatch: actual=${resourceMap.file.sha256} expected=${authority.resourceMapSha256}`,
  );
  invariant(
    authority !== CANONICAL_AUTHORITY || reconciliationPath !== null,
    'canonical recovered asset staging requires --reconciliation',
  );
  const flattened = flattenResourceMap(resourceMap.value, authority);
  let entries = flattened.entries;
  let reconciliationFile = null;
  if (reconciliationPath) {
    const reconciliation = readStableJson(
      reconciliationPath,
      'resource reconciliation ledger',
    );
    entries = applyResourceReconciliationLedger(
      entries,
      reconciliation.value,
      authority,
    );
    reconciliationFile = reconciliation.file;
  }
  const source = scanAndValidateSource(
    sourceRoot,
    entries,
    authority.sourceManifestSha256,
  );
  invariant(totalBytes(entries) === authority.totalBytes, `source byte total must be exactly ${authority.totalBytes}`);
  return {
    ...flattened,
    entries,
    source,
    resourceMapFile: resourceMap.file,
    reconciliationFile,
  };
}

function recheckAuthority(
  resourceMapPath,
  reconciliationPath,
  authorityState,
  authority,
) {
  const resourceMap = readStableFile(resourceMapPath, 'resource map', authorityState.resourceMapFile.identity);
  invariant(resourceMap.sha256 === authority.resourceMapSha256, `resource map changed during staging. ${RACE_LIMITATION}`);
  if (reconciliationPath) {
    invariant(
      authorityState.reconciliationFile !== null,
      'resource reconciliation authority state is missing',
    );
    const reconciliation = readStableFile(
      reconciliationPath,
      'resource reconciliation ledger',
      authorityState.reconciliationFile.identity,
    );
    invariant(
      reconciliation.sha256 === authorityState.reconciliationFile.sha256,
      `resource reconciliation ledger changed during staging. ${RACE_LIMITATION}`,
    );
  }
}

function createExclusiveManifestTemp(manifestPath, contents, publicationState) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const temporaryPath = randomSiblingPath(manifestPath, 'publish');
    let descriptor;
    try {
      descriptor = fs.openSync(temporaryPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW, 0o644);
    } catch (error) {
      if (error?.code === 'EEXIST') continue;
      throw error;
    }
    publicationState.manifestTempPath = temporaryPath;
    try {
      fs.writeFileSync(descriptor, contents);
      fs.fsyncSync(descriptor);
      const stat = fs.fstatSync(descriptor, { bigint: true });
      assertSingleLinkFile(stat, 'temporary manifest');
      invariant(stat.size === BigInt(Buffer.byteLength(contents)), 'temporary manifest byte-size mismatch');
      publicationState.manifestTempIdentity = identityOf(stat);
      return;
    } finally {
      fs.closeSync(descriptor);
    }
  }
  throw new StagingError('could not create an exclusive temporary manifest');
}

function publishManifest(manifestPath, contents, publicationState) {
  assertPathAbsent(manifestPath, 'manifest output');
  createExclusiveManifestTemp(manifestPath, contents, publicationState);
  const temporary = readStableFile(publicationState.manifestTempPath, 'temporary manifest', publicationState.manifestTempIdentity);
  invariant(temporary.buffer.toString('utf8') === contents, 'temporary manifest content mismatch');
  assertPathAbsent(manifestPath, 'manifest output');
  fs.linkSync(publicationState.manifestTempPath, manifestPath);
  publicationState.manifestPublished = true;
  const temporaryLinked = readStableFileWithLinks(publicationState.manifestTempPath, 'linked temporary manifest', 2n);
  const publishedLinked = readStableFileWithLinks(manifestPath, 'published manifest', 2n);
  invariant(temporaryLinked.identity === publishedLinked.identity, 'published manifest identity mismatch');
  const tempStat = lstatMaybe(publicationState.manifestTempPath);
  invariant(tempStat !== null && identityOf(tempStat) === publicationState.manifestTempIdentity && tempStat.nlink === 2n, 'temporary manifest identity changed before cleanup');
  fs.unlinkSync(publicationState.manifestTempPath);
  publicationState.manifestTempPath = null;
  const published = readStableFile(manifestPath, 'published manifest', publicationState.manifestTempIdentity);
  invariant(published.buffer.toString('utf8') === contents, 'published manifest content mismatch');
}

function recoveryMessage(state) {
  const recovery = [];
  if (state.stagePath && pathExists(state.stagePath)) {
    recovery.push(`orphaned staging directory retained as ${path.basename(state.stagePath)}`);
  }
  if (state.targetPublished) recovery.push('completed target retained');
  if (state.manifestPublished) recovery.push('published manifest retained');
  if (state.manifestTempPath && pathExists(state.manifestTempPath)) {
    recovery.push(`orphaned temporary manifest retained as ${path.basename(state.manifestTempPath)}`);
  }
  if (state.lockIssue) recovery.push(state.lockIssue);
  return recovery.length > 0 ? `; recovery: ${recovery.join('; ')}` : '';
}

function stageAssets(rawOptions, authority = CANONICAL_AUTHORITY, hooks = {}) {
  let options = validatePaths(rawOptions);
  assertStageOutputsAbsent(options);
  snapshotExistingAncestors(stagingAncestorPaths(options));
  prepareOutputParents(options);
  options = validatePaths(options);
  assertStageOutputsAbsent(options);
  const ancestorSnapshots = snapshotExistingAncestors(stagingAncestorPaths(options));

  const state = {
    stagePath: null,
    targetPublished: false,
    manifestPublished: false,
    manifestTempPath: null,
    lockIssue: null,
  };
  let lock = null;
  let result = null;
  let operationError = null;

  try {
    lock = acquireStageLock(options.targetRoot, hooks);
    assertStageOutputsAbsent(options);
    const authorityState = loadAuthority(
      options.sourceRoot,
      options.resourceMapPath,
      options.reconciliationPath,
      authority,
    );
    const manifestContents = serializedManifest(
      authorityState.entries,
      authority.sourceManifestSha256,
      authorityState.reconciliationFile?.sha256 ?? null,
    );
    const stageDirectory = createExclusiveStageDirectory(options.targetRoot);
    state.stagePath = stageDirectory.path;
    hooks.afterStagingDirectoryCreated?.({ stagePath: state.stagePath, lockPath: lock.path });
    copyEntries(options.sourceRoot, state.stagePath, authorityState.entries, authorityState.source);
    hooks.beforeTargetPublication?.({ stagePath: state.stagePath, targetRoot: options.targetRoot, manifestPath: options.manifestPath, lockPath: lock.path });
    assertOwnedLock(lock);
    recheckSnapshots(authorityState.source.directorySnapshots, 'source directory');
    revalidateImmutableInputs(options, authorityState, authority, ancestorSnapshots, true);
    let destination = verifyDestination(state.stagePath, authorityState.entries, authorityState.source.identities);
    assertStageOutputsAbsent(options);
    const stageIdentity = identityOf(assertDirectoryStat(state.stagePath, 'staging directory'));
    fs.renameSync(state.stagePath, options.targetRoot);
    state.stagePath = null;
    state.targetPublished = true;
    invariant(identityOf(assertDirectoryStat(options.targetRoot, 'published target')) === stageIdentity, `published target identity mismatch. ${RACE_LIMITATION}`);
    hooks.beforeManifestPublication?.({ targetRoot: options.targetRoot, manifestPath: options.manifestPath, lockPath: lock.path });
    assertOwnedLock(lock);
    revalidateImmutableInputs(options, authorityState, authority, ancestorSnapshots);
    destination = verifyDestination(options.targetRoot, authorityState.entries, authorityState.source.identities);
    assertPathAbsent(options.manifestPath, 'manifest output');
    publishManifest(options.manifestPath, manifestContents, state);
    result = {
      destination,
      sourceManifestSha256: authority.sourceManifestSha256,
      resourceSummary: resourceReconciliationSummary(authorityState.entries),
    };
  } catch (error) {
    operationError = error instanceof Error ? error : new Error(String(error));
  } finally {
    state.lockIssue = releaseOwnedLock(lock);
  }

  if (operationError || state.lockIssue) {
    const message = operationError?.message || 'stage lock release failed';
    throw new StagingError(`${message}${recoveryMessage(state)}`);
  }
  return result;
}

function verifyAssets(rawOptions, authority = CANONICAL_AUTHORITY) {
  const options = validatePaths(rawOptions);
  const ancestorSnapshots = snapshotExistingAncestors([
    options.sourceRoot,
    options.resourceMapPath,
    options.reconciliationPath,
    options.targetRoot,
    options.manifestPath,
  ].filter(Boolean));
  assertDirectoryStat(options.sourceRoot, 'source root');
  assertDirectoryStat(options.targetRoot, 'target');
  invariant(lstatMaybe(`${options.targetRoot}.stage.lock`) === null, 'stage lock exists; verification refuses an in-progress staging workflow');
  const authorityState = loadAuthority(
    options.sourceRoot,
    options.resourceMapPath,
    options.reconciliationPath,
    authority,
  );
  const expectedManifest = serializedManifest(
    authorityState.entries,
    authority.sourceManifestSha256,
    authorityState.reconciliationFile?.sha256 ?? null,
  );
  const actualManifest = readStableFile(options.manifestPath, 'staging manifest');
  invariant(actualManifest.buffer.toString('utf8') === expectedManifest, 'staging manifest does not match the validated resource map and source');
  const destination = verifyDestination(options.targetRoot, authorityState.entries, authorityState.source.identities);
  scanAndValidateSource(
    options.sourceRoot,
    authorityState.entries,
    authority.sourceManifestSha256,
    authorityState.source.records,
  );
  recheckAuthority(
    options.resourceMapPath,
    options.reconciliationPath,
    authorityState,
    authority,
  );
  recheckSnapshots(ancestorSnapshots, 'path ancestor');
  return {
    destination,
    sourceManifestSha256: authority.sourceManifestSha256,
    resourceSummary: resourceReconciliationSummary(authorityState.entries),
  };
}

function renderManifest(rawOptions, authority = CANONICAL_AUTHORITY) {
  const options = validatePaths(rawOptions);
  assertDirectoryStat(options.sourceRoot, 'source root');
  assertDirectoryStat(options.targetRoot, 'target');
  assertDirectoryStat(path.dirname(options.manifestPath), 'manifest parent');
  assertPathAbsent(options.manifestPath, 'manifest output');
  invariant(
    lstatMaybe(`${options.targetRoot}.stage.lock`) === null,
    'stage lock exists; manifest rendering refuses an in-progress staging workflow',
  );
  const ancestorSnapshots = snapshotExistingAncestors([
    options.sourceRoot,
    options.resourceMapPath,
    options.reconciliationPath,
    options.targetRoot,
    path.dirname(options.manifestPath),
  ].filter(Boolean));
  const authorityState = loadAuthority(
    options.sourceRoot,
    options.resourceMapPath,
    options.reconciliationPath,
    authority,
  );
  const manifestContents = serializedManifest(
    authorityState.entries,
    authority.sourceManifestSha256,
    authorityState.reconciliationFile?.sha256 ?? null,
  );
  const destination = verifyDestination(
    options.targetRoot,
    authorityState.entries,
    authorityState.source.identities,
  );
  scanAndValidateSource(
    options.sourceRoot,
    authorityState.entries,
    authority.sourceManifestSha256,
    authorityState.source.records,
  );
  recheckAuthority(
    options.resourceMapPath,
    options.reconciliationPath,
    authorityState,
    authority,
  );
  recheckSnapshots(ancestorSnapshots, 'path ancestor');
  assertPathAbsent(options.manifestPath, 'manifest output');
  const publicationState = {
    stagePath: null,
    targetPublished: false,
    manifestPublished: false,
    manifestTempPath: null,
    lockIssue: null,
  };
  try {
    publishManifest(options.manifestPath, manifestContents, publicationState);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new StagingError(`${message}${recoveryMessage(publicationState)}`);
  }
  return {
    destination,
    sourceManifestSha256: authority.sourceManifestSha256,
    resourceSummary: resourceReconciliationSummary(authorityState.entries),
  };
}

function parseCli(argv) {
  const [mode, ...tokens] = argv;
  invariant(
    mode === 'stage' || mode === 'verify' || mode === 'render-manifest',
    'mode must be stage, verify, or render-manifest',
  );
  invariant(tokens.length % 2 === 0, 'every option requires a value');
  const required = new Set(['--source', '--resource-map', '--target', '--manifest']);
  const allowed = new Set([...required, '--reconciliation']);
  const values = new Map();
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    invariant(allowed.has(flag), `unknown option: ${flag}`);
    invariant(!values.has(flag), `duplicate option: ${flag}`);
    invariant(typeof value === 'string' && value.length > 0 && !value.startsWith('--'), `missing value for ${flag}`);
    values.set(flag, value);
  }
  for (const flag of required) invariant(values.has(flag), `missing required option: ${flag}`);
  return {
    mode,
    options: {
      sourceRoot: path.resolve(values.get('--source')),
      resourceMapPath: path.resolve(values.get('--resource-map')),
      reconciliationPath: values.has('--reconciliation')
        ? path.resolve(values.get('--reconciliation'))
        : null,
      targetRoot: path.resolve(values.get('--target')),
      manifestPath: path.resolve(values.get('--manifest')),
    },
  };
}

function formatResult(mode, result) {
  const destination = result.destination;
  const consumers = result.resourceSummary.consumers;
  const reconciliation = result.resourceSummary.reconciliation;
  return `${mode.toUpperCase()} OK assets=${destination.assets}/${EXPECTED_COUNTS.total}`
    + ` bytes=${destination.bytes}`
    + ` source_manifest_sha256=${result.sourceManifestSha256}`
    + ` byte_mismatches=${destination.byteMismatches}`
    + ' inventory_coverage=100% staging_coverage=100%'
    + ` consumer_coverage=${consumers.coveragePercent}%`
    + ` consumer_status=${consumers.status}`
    + ` reconciliation_coverage=${reconciliation.coveragePercent}%`
    + ` reconciliation_status=${reconciliation.status}`
    + ` creator_meta_sidecars=${destination.metaSidecars}/${destination.expectedMetaSidecars}`
    + ` creator_meta_status=${destination.metaStatus}`
    + ' creator_uuid_status=pending';
}

function main(argv) {
  try {
    const parsed = parseCli(argv);
    const result = parsed.mode === 'stage'
      ? stageAssets(parsed.options, CANONICAL_AUTHORITY)
      : parsed.mode === 'verify'
        ? verifyAssets(parsed.options, CANONICAL_AUTHORITY)
        : renderManifest(parsed.options, CANONICAL_AUTHORITY);
    console.log(formatResult(parsed.mode, result));
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) main(process.argv.slice(2));

export {
  CANONICAL_AUTHORITY,
  EXPECTED_COUNTS,
  RACE_LIMITATION,
  StagingError,
  applyResourceReconciliationLedger,
  buildManifest,
  collisionKey,
  createTestAuthority,
  flattenResourceMap,
  formatResult,
  manifestDigest,
  parseCli,
  readStableFile,
  renderManifest,
  resourceReconciliationSummary,
  scanAndValidateSource,
  stageAssets,
  verifyAssets,
  verifyDestination,
};
