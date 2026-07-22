#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PINNED = Object.freeze({
  stagingManifestSha256: '9462b09d39004366269b215e25ce61829cf9982d668d79c1940c0fbe10e4e2c2',
  sourceManifestSha256: '0143473b21e56525cde92163f72fd49b2a898ab70ef2b224cdad00eaba9238e3',
  assets: 862,
  bytes: 32945747,
  sidecars: 935,
  directories: 73,
  records: 2503,
  uuidManifestSha256: 'dc0dd3fd998723388b45f84eaeea734ac786eea66ecb7c8f877b0f94dfea0cc8',
  editor: '00b05c9338d59ca4f58792ed65ac37b45b8b4fa7',
  engine: '411f98df047c25902f93440d4b22925c2fb65461',
});

const EXPECTED_IMPORTERS = Object.freeze({
  'directory@1.2.0': 73,
  'image@1.0.27': 784,
  'texture@1.0.22': 784,
  'sprite-frame@1.0.12': 784,
  'audio-clip@1.0.0': 62,
  'ttf-font@1.0.1': 15,
  '*@1.0.0': 1,
});

class MetadataAuditError extends Error {}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readJson(filePath, errors, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${label}: invalid JSON (${error.message})`);
    return null;
  }
}

function pngDimensions(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) return null;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function expectedDirectories(entries) {
  const directories = new Set(['']);
  for (const entry of entries) {
    const parts = entry.canonicalPath.split('/');
    parts.pop();
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      directories.add(current);
    }
  }
  return [...directories].sort(compareText);
}

function scanTree(root) {
  const files = [];
  const directories = [''];
  const stack = [''];
  while (stack.length > 0) {
    const relative = stack.pop();
    const current = relative ? path.join(root, relative) : root;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) {
        files.push({ path: toPosix(child), kind: 'symlink' });
      } else if (entry.isDirectory()) {
        directories.push(toPosix(child));
        stack.push(child);
      } else if (entry.isFile()) {
        files.push({ path: toPosix(child), kind: 'file' });
      } else {
        files.push({ path: toPosix(child), kind: 'other' });
      }
    }
  }
  files.sort((a, b) => compareText(a.path, b.path));
  directories.sort(compareText);
  return { files, directories };
}

function addCount(target, key) {
  target[key] = (target[key] ?? 0) + 1;
}

function traverseMeta(record, label, state, parent = null, subKey = null) {
  if (!record || typeof record !== 'object') {
    state.structuralErrors.push(`${label}: metadata record must be an object`);
    return;
  }
  const importer = `${record.importer}@${record.ver}`;
  addCount(state.importerVersions, importer);
  state.recordCount += 1;

  if (record.imported !== true) state.structuralErrors.push(`${label}: imported must be true`);
  if (typeof record.uuid !== 'string' || record.uuid.length === 0) {
    state.structuralErrors.push(`${label}: missing UUID`);
  } else {
    state.uuids.push({ uuid: record.uuid, label });
  }

  if (parent) {
    if (record.id !== subKey) state.structuralErrors.push(`${label}: subMeta id must match key ${subKey}`);
    if (record.uuid !== `${parent.uuid}@${subKey}`) {
      state.structuralErrors.push(`${label}: subMeta UUID must belong to parent/key`);
    }
  }

  const subMetas = record.subMetas ?? {};
  if (!subMetas || typeof subMetas !== 'object' || Array.isArray(subMetas)) {
    state.structuralErrors.push(`${label}: subMetas must be an object`);
    return;
  }
  for (const key of Object.keys(subMetas).sort(compareText)) {
    traverseMeta(subMetas[key], `${label}#${key}`, state, record, key);
  }
}

function equalArray(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function equalNumber(actual, expected) {
  return typeof actual === 'number' && Math.abs(actual - expected) < 1e-9;
}

function fullRectangle(userData, width, height) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const vertices = userData.vertices ?? {};
  return userData.width === width
    && userData.height === height
    && userData.rawWidth === width
    && userData.rawHeight === height
    && userData.trimX === 0
    && userData.trimY === 0
    && userData.offsetX === 0
    && userData.offsetY === 0
    && equalArray(vertices.rawPosition, [
      -halfWidth, -halfHeight, 0,
      halfWidth, -halfHeight, 0,
      -halfWidth, halfHeight, 0,
      halfWidth, halfHeight, 0,
    ])
    && equalArray(vertices.indexes, [0, 1, 2, 2, 1, 3])
    && equalArray(vertices.uv, [0, height, width, height, 0, 0, width, 0])
    && equalArray(vertices.nuv, [0, 0, 1, 0, 0, 1, 1, 1])
    && equalArray(vertices.minPos, [-halfWidth, -halfHeight, 0])
    && equalArray(vertices.maxPos, [halfWidth, halfHeight, 0]);
}

function validateTexture(meta, parentUuid, label, errors) {
  const userData = meta.userData ?? {};
  if (userData.imageUuidOrDatabaseUri !== parentUuid || userData.isUuid !== true) {
    errors.push(`${label}: texture must reference parent image UUID`);
  }
  const expected = {
    wrapModeS: 'clamp-to-edge',
    wrapModeT: 'clamp-to-edge',
    minfilter: 'linear',
    magfilter: 'linear',
    mipfilter: 'none',
    anisotropy: 0,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (userData[key] !== value) errors.push(`${label}: unexpected texture ${key}`);
  }
}

function validateSprite(meta, textureUuid, dimensions, label, state) {
  const data = meta.userData ?? {};
  if (data.imageUuidOrDatabaseUri !== textureUuid || data.isUuid !== true) {
    state.structuralErrors.push(`${label}: sprite-frame must reference texture UUID`);
  }
  if (data.rawWidth !== dimensions.width || data.rawHeight !== dimensions.height) {
    state.structuralErrors.push(`${label}: raw geometry does not match PNG IHDR`);
  }
  const fixedSettings = {
    rotated: false,
    trimThreshold: 1,
    borderTop: 0,
    borderBottom: 0,
    borderLeft: 0,
    borderRight: 0,
    packable: true,
    pixelsToUnit: 100,
    pivotX: 0.5,
    pivotY: 0.5,
    meshType: 0,
  };
  for (const [key, value] of Object.entries(fixedSettings)) {
    if (!equalNumber(data[key], value) && data[key] !== value) {
      state.structuralErrors.push(`${label}: unexpected sprite-frame ${key}`);
    }
  }
  addCount(state.trimTypes, String(data.trimType));
  const isFullRectangle = fullRectangle(data, dimensions.width, dimensions.height);
  if (!isFullRectangle) state.trimmedGeometry += 1;
  if (data.trimType !== 'none' || !isFullRectangle) state.targetCompliantSpriteFrames -= 1;
}

function validateImage(entry, buffer, topMeta, state) {
  const dimensions = pngDimensions(buffer);
  if (!dimensions) {
    state.structuralErrors.push(`${entry.canonicalPath}: invalid PNG`);
    return;
  }
  const children = Object.values(topMeta.subMetas ?? {});
  const textures = children.filter((child) => child.importer === 'texture');
  const sprites = children.filter((child) => child.importer === 'sprite-frame');
  if (textures.length !== 1 || sprites.length !== 1 || children.length !== 2) {
    state.structuralErrors.push(`${entry.canonicalPath}: expected one texture and one sprite-frame subMeta`);
    return;
  }
  validateTexture(textures[0], topMeta.uuid, `${entry.canonicalPath}#texture`, state.structuralErrors);
  validateSprite(sprites[0], textures[0].uuid, dimensions, `${entry.canonicalPath}#sprite-frame`, state);
}

function validateAsset(entry, assetRoot, state) {
  const assetPath = path.join(assetRoot, ...entry.canonicalPath.split('/'));
  let stat;
  try {
    stat = fs.lstatSync(assetPath);
  } catch {
    state.structuralErrors.push(`${entry.canonicalPath}: missing source asset`);
    return;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    state.structuralErrors.push(`${entry.canonicalPath}: source asset must be a regular non-symlink file`);
    return;
  }
  const buffer = fs.readFileSync(assetPath);
  if (buffer.length !== entry.bytes || sha256(buffer) !== entry.sha256) {
    state.structuralErrors.push(`${entry.canonicalPath}: staged source bytes/hash mismatch`);
  }

  const metaPath = `${assetPath}.meta`;
  const topMeta = state.topMetas.get(entry.canonicalPath);
  if (!topMeta) return;
  const extension = entry.extension.toLowerCase();
  if (extension === '.png') {
    if (topMeta.importer !== 'image' || topMeta.ver !== '1.0.27') {
      state.structuralErrors.push(`${entry.canonicalPath}: expected image@1.0.27`);
    }
    validateImage(entry, buffer, topMeta, state);
  } else if (extension === '.wav' || extension === '.mp3') {
    if (topMeta.importer !== 'audio-clip' || topMeta.ver !== '1.0.0') {
      state.structuralErrors.push(`${entry.canonicalPath}: expected audio-clip@1.0.0`);
    }
  } else if (extension === '.ttf') {
    if (topMeta.importer !== 'ttf-font' || topMeta.ver !== '1.0.1') {
      state.structuralErrors.push(`${entry.canonicalPath}: expected ttf-font@1.0.1`);
    }
  } else if (extension === '.otf') {
    state.otf.count += 1;
    if (
      entry.canonicalPath !== 'Fonts/CooperBlackStd.otf'
      || topMeta.importer !== '*'
      || topMeta.ver !== '1.0.0'
      || Object.keys(topMeta.subMetas ?? {}).length !== 0
    ) {
      state.structuralErrors.push(`${entry.canonicalPath}: OTF must remain exact wildcard metadata without substitution`);
    } else {
      state.otf.status = 'unsupported-consumer-blocked';
    }
  } else {
    state.structuralErrors.push(`${entry.canonicalPath}: unsupported extension ${entry.extension}`);
  }

  if (!fs.existsSync(metaPath)) state.structuralErrors.push(`${entry.canonicalPath}: missing sidecar`);
}

function compareSets(actual, expected, label, errors) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  for (const value of expectedSet) {
    if (!actualSet.has(value)) errors.push(`${label}: missing ${value || '<root>'}`);
  }
  for (const value of actualSet) {
    if (!expectedSet.has(value)) errors.push(`${label}: unexpected ${value || '<root>'}`);
  }
}

function finalizeReport(state, pins, editorInfo) {
  const duplicates = [];
  const seen = new Map();
  for (const item of state.uuids) {
    if (seen.has(item.uuid)) duplicates.push(`${item.uuid}: ${seen.get(item.uuid)} and ${item.label}`);
    else seen.set(item.uuid, item.label);
  }
  for (const duplicate of duplicates) state.structuralErrors.push(`duplicate UUID ${duplicate}`);
  const uuidManifestSha256 = sha256(Buffer.from(
    [...state.uuids]
      .sort((left, right) => compareText(left.label, right.label))
      .map((item) => `${item.label}\0${item.uuid}\0`)
      .join(''),
  ));
  if (pins.uuidManifestSha256 && uuidManifestSha256 !== pins.uuidManifestSha256) {
    state.structuralErrors.push('metadata UUID manifest SHA-256 mismatch');
  }

  const importerKeys = new Set([...Object.keys(state.importerVersions), ...Object.keys(EXPECTED_IMPORTERS)]);
  for (const key of [...importerKeys].sort(compareText)) {
    if ((state.importerVersions[key] ?? 0) !== (EXPECTED_IMPORTERS[key] ?? 0)) {
      state.structuralErrors.push(
        `importer/version ${key}: expected ${EXPECTED_IMPORTERS[key] ?? 0}, got ${state.importerVersions[key] ?? 0}`,
      );
    }
  }
  if (state.recordCount !== pins.records) {
    state.structuralErrors.push(`metadata records: expected ${pins.records}, got ${state.recordCount}`);
  }
  if (editorInfo.editor !== pins.editor || editorInfo.engine !== pins.engine) {
    state.structuralErrors.push('Creator editor/engine fingerprint mismatch');
  }

  const autoTrim = state.trimTypes.auto ?? 0;
  const noneTrim = state.trimTypes.none ?? 0;
  if (noneTrim !== 784 || autoTrim !== 0) {
    state.fidelityBlockers.push(`SpriteFrame trimType target not met: none=${noneTrim}, auto=${autoTrim}`);
  }
  if (state.trimmedGeometry !== 0) {
    state.fidelityBlockers.push(`SpriteFrame geometry still trimmed: ${state.trimmedGeometry}`);
  }
  if (state.otf.status === 'unsupported-consumer-blocked') {
    state.fidelityBlockers.push('Fonts/CooperBlackStd.otf is preserved but unsupported as a Cocos Font consumer');
  }

  return {
    schemaVersion: 1,
    scope: 'recovered-apk-assets-creator-import-audit',
    editor: { editor: editorInfo.editor, engine: editorInfo.engine },
    inventory: {
      assets: pins.assets,
      bytes: pins.bytes,
      sidecars: state.sidecarCount,
      directories: state.directoryCount,
      metadataRecords: state.recordCount,
    },
    importers: Object.fromEntries(Object.entries(state.importerVersions).sort(([a], [b]) => compareText(a, b))),
    uuids: { total: state.uuids.length, duplicates: duplicates.length, manifestSha256: uuidManifestSha256 },
    spriteFrames: {
      total: 784,
      trimTypes: Object.fromEntries(Object.entries(state.trimTypes).sort(([a], [b]) => compareText(a, b))),
      trimmedGeometry: state.trimmedGeometry,
      targetCompliant: state.targetCompliantSpriteFrames,
    },
    otf: state.otf,
    structuralErrors: [...new Set(state.structuralErrors)].sort(compareText),
    fidelityBlockers: [...new Set(state.fidelityBlockers)].sort(compareText),
    status: state.structuralErrors.length > 0
      ? 'structurally-invalid'
      : state.fidelityBlockers.length > 0
        ? 'fidelity-blocked'
        : 'compliant',
  };
}

function auditCreatorMetadata(options, pins = PINNED) {
  const structuralErrors = [];
  const stagingBytes = fs.readFileSync(options.stagingManifestPath);
  if (sha256(stagingBytes) !== pins.stagingManifestSha256) {
    structuralErrors.push('staging manifest SHA-256 mismatch');
  }
  const staging = readJson(options.stagingManifestPath, structuralErrors, 'staging manifest');
  const editorInfo = readJson(options.editorInfoPath, structuralErrors, 'Creator info') ?? {};
  if (!staging || !Array.isArray(staging.entries)) {
    throw new MetadataAuditError('staging manifest cannot be audited');
  }
  if (staging.source?.manifestSha256 !== pins.sourceManifestSha256) {
    structuralErrors.push('source manifest SHA-256 mismatch');
  }
  if (staging.entries.length !== pins.assets) {
    structuralErrors.push(`asset count: expected ${pins.assets}, got ${staging.entries.length}`);
  }
  const totalBytes = staging.entries.reduce((sum, entry) => sum + entry.bytes, 0);
  if (totalBytes !== pins.bytes) structuralErrors.push(`byte count: expected ${pins.bytes}, got ${totalBytes}`);

  const directories = expectedDirectories(staging.entries);
  const expectedFiles = new Set();
  for (const entry of staging.entries) {
    expectedFiles.add(entry.canonicalPath);
    expectedFiles.add(`${entry.canonicalPath}.meta`);
  }
  for (const directory of directories.slice(1)) expectedFiles.add(`${directory}.meta`);
  const actualTree = scanTree(options.assetRoot);
  compareSets(actualTree.directories, directories, 'directory', structuralErrors);
  compareSets(actualTree.files.map((entry) => entry.path), [...expectedFiles].sort(compareText), 'asset tree', structuralErrors);
  for (const entry of actualTree.files) {
    if (entry.kind !== 'file') structuralErrors.push(`${entry.path}: unsupported filesystem entry ${entry.kind}`);
  }

  let rootMetaPresent = false;
  try {
    const rootMetaStat = fs.lstatSync(options.rootMetaPath);
    rootMetaPresent = rootMetaStat.isFile() && !rootMetaStat.isSymbolicLink();
    if (!rootMetaPresent) structuralErrors.push('game.meta: must be a regular non-symlink file');
  } catch {
    structuralErrors.push('game.meta: missing sidecar');
  }

  const state = {
    structuralErrors,
    fidelityBlockers: [],
    importerVersions: {},
    recordCount: 0,
    uuids: [],
    trimTypes: {},
    trimmedGeometry: 0,
    targetCompliantSpriteFrames: 784,
    otf: { count: 0, path: 'Fonts/CooperBlackStd.otf', status: 'missing-or-invalid' },
    topMetas: new Map(),
    sidecarCount: actualTree.files.filter((entry) => entry.path.endsWith('.meta')).length + Number(rootMetaPresent),
    directoryCount: actualTree.directories.length,
  };

  const rootMeta = readJson(options.rootMetaPath, structuralErrors, 'game.meta');
  if (rootMeta) {
    traverseMeta(rootMeta, 'game.meta', state);
    if (rootMeta.importer !== 'directory' || rootMeta.ver !== '1.2.0') {
      structuralErrors.push('game.meta: expected directory@1.2.0');
    }
    if (rootMeta.userData?.isBundle !== true) {
      structuralErrors.push('game.meta: recovered resources must remain in the game asset bundle');
    }
  }
  for (const directory of directories.slice(1)) {
    const meta = readJson(path.join(options.assetRoot, ...`${directory}.meta`.split('/')), structuralErrors, `${directory}.meta`);
    if (meta) traverseMeta(meta, `${directory}.meta`, state);
  }
  for (const entry of staging.entries) {
    const metaPath = path.join(options.assetRoot, ...`${entry.canonicalPath}.meta`.split('/'));
    const meta = readJson(metaPath, structuralErrors, `${entry.canonicalPath}.meta`);
    if (meta) {
      state.topMetas.set(entry.canonicalPath, meta);
      traverseMeta(meta, `${entry.canonicalPath}.meta`, state);
    }
  }
  for (const entry of staging.entries) validateAsset(entry, options.assetRoot, state);

  if (state.sidecarCount !== pins.sidecars) {
    structuralErrors.push(`sidecar count: expected ${pins.sidecars}, got ${state.sidecarCount}`);
  }
  if (state.directoryCount !== pins.directories) {
    structuralErrors.push(`directory count: expected ${pins.directories}, got ${state.directoryCount}`);
  }
  return finalizeReport(state, pins, editorInfo);
}

function parseCli(argv) {
  const [mode, ...tokens] = argv;
  if (mode !== 'audit') throw new MetadataAuditError('mode must be audit');
  if (tokens.length % 2 !== 0) throw new MetadataAuditError('every option requires a value');
  const allowed = new Set(['--staging-manifest', '--asset-root', '--root-meta', '--editor-info']);
  const values = new Map();
  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index];
    const value = tokens[index + 1];
    if (!allowed.has(key)) throw new MetadataAuditError(`unknown option: ${key}`);
    if (values.has(key)) throw new MetadataAuditError(`duplicate option: ${key}`);
    if (!value || value.startsWith('--')) throw new MetadataAuditError(`missing value for ${key}`);
    values.set(key, value);
  }
  for (const key of allowed) {
    if (!values.has(key)) throw new MetadataAuditError(`missing required option: ${key}`);
  }
  return {
    stagingManifestPath: path.resolve(values.get('--staging-manifest')),
    assetRoot: path.resolve(values.get('--asset-root')),
    rootMetaPath: path.resolve(values.get('--root-meta')),
    editorInfoPath: path.resolve(values.get('--editor-info')),
  };
}

function main() {
  try {
    const options = parseCli(process.argv.slice(2));
    const report = auditCreatorMetadata(options);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.structuralErrors.length > 0 ? 1 : report.fidelityBlockers.length > 0 ? 2 : 0;
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) main();

export {
  EXPECTED_IMPORTERS,
  MetadataAuditError,
  PINNED,
  auditCreatorMetadata,
  fullRectangle,
  parseCli,
  pngDimensions,
};
