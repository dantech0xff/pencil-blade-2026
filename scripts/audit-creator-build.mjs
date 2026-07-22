#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const ORIGINAL_APK_SHA256 = '95225733d46473f2b155737e8c83b567e028342257c747c0faac6ed4ab87e7aa';
const ORIGINAL_NATIVE_SHA256 = '55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e';
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_EXTRACTED_ENTRY_BYTES = 256 * 1024 * 1024;
const MAX_TOTAL_EXPANDED_BYTES = 1024 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 100_000;
const MAX_NESTED_ARCHIVE_DEPTH = 3;
const LEGACY_NATIVE_FINGERPRINT_MATCHES = 2;
const LEGACY_NATIVE_CHUNK_BYTES = 16 * 1024;

// Fixed evidence fingerprints sample the preserved libgame.so without shipping its bytes.
// Two matches catch a minimally patched or renamed library while making a collision with a
// Creator build implausible. Exact hashes remain the primary identity check.
const LEGACY_NATIVE_CHUNKS = Object.freeze([
  [0, '1c9a212d95f5622811addb359d8a6ab74260eaab0c9c1bbcd66984640974ed1b'],
  [262144, '461594ac1aca450376c880e67f3e956510498adbf7fbf0991d8f83dc19fa6ece'],
  [786432, '9dba041998b27802be3e55975b4757714f4951c6d516bd90b30fe5d3dfac6b82'],
  [1572864, '7f10eb9845d353747d4a0efa403b0e2d7c7d886f6c69c4b65cceb56af2f1dddc'],
  [2359296, 'ad4243623857d6e4d483988776026d8c135eed51c9b6dc6221e79ffe592472b0'],
  [3145728, 'bd07d000b0473b955139cb220414bb16c373b22f8927fcaef300f806d774e2c6'],
  [3932160, '394a4097dad50b2b655e8ea111775dfe7cddd23a0d45b61e183bb5f8d7f24189'],
  [4587520, '4efcde0d1a0b4f154610a10188d7783b60c759fe6ecb45ac7a7708351c1930d7'],
]);

// Creator 3.8.8's installed Android template builds one shared target named `cocos` and
// links the C++ runtime statically. Any other ELF payload is outside this project's pin.
const CREATOR_388_NATIVE_ENTRY = /(?:^|\/)lib\/(?:arm64-v8a|armeabi-v7a|x86|x86_64)\/libcocos\.so$/i;

const ENTRY_PATH_RULES = Object.freeze([
  {
    reason: 'original native gameplay library path',
    pattern: /(?:^|\/)libgame\.so$/i,
  },
  {
    reason: 'legacy native engine library path',
    pattern: /(?:^|\/)libcocos2d(?:cpp|x)?\.so$/i,
  },
  {
    reason: 'embedded Android application archive',
    pattern: /\.(?:apk|apks|xapk)$/i,
  },
  {
    reason: 'decompiler artifact path',
    pattern: /(?:^|\/)(?:apktool(?:-output)?|decompiler(?:-output)?|ghidra|ida|jadx(?:-output)?)(?:\/|$)/i,
  },
  {
    reason: 'legacy runtime path',
    pattern: /(?:^|\/)(?:cocos2d-x-2\.1\.4|legacy-runtime)(?:\/|$)/i,
  },
  {
    reason: 'native compatibility or emulation path',
    pattern: /(?:^|\/)(?:emulation[-_]?layer|native[-_]?(?:compatibility[-_]?)?bridge)(?:\/|$)/i,
  },
]);

const TEXT_RULES = Object.freeze([
  { reason: 'original native gameplay library reference', pattern: /\blibgame\.so\b/i },
  { reason: 'legacy engine 2.1.4 reference', pattern: /\bcocos2d(?:-x|x)[^\n]{0,24}2\.1\.4\b/i },
  { reason: 'decompiler dependency', pattern: /\b(?:apktool|ghidra|jadx|decompiler[- ]output)\b/i },
  {
    reason: 'legacy native loading or bridge call',
    pattern: /\b(?:nativeSetApkPath|JNIEXPORT|JNIEnv|dlopen\s*\(|jsb\.reflection)\b|System\.loadLibrary\s*\(\s*['"]game['"]/,
  },
  {
    reason: 'native compatibility or emulation reference',
    pattern: /\b(?:emulation[- ]layer|native[- ]compatibility[- ]bridge)\b/i,
  },
]);

const CRC32_TABLE = createCrc32Table();

export function inspectBuildEntryPath(entryPath) {
  const findings = [];
  if (
    entryPath.length === 0
    || entryPath.startsWith('/')
    || entryPath.includes('//')
    || entryPath.includes('\\')
    || /[\u0000-\u001f\u007f*?\[\]]/u.test(entryPath)
    || entryPath.split('/').some((part) => part === '.' || part === '..')
  ) {
    findings.push(Object.freeze({
      path: entryPath,
      reason: 'unsafe or ambiguous archive entry path',
    }));
  }
  for (const rule of ENTRY_PATH_RULES) {
    if (rule.pattern.test(entryPath)) {
      findings.push(Object.freeze({ path: entryPath, reason: rule.reason }));
    }
  }
  return Object.freeze(findings);
}

export function inspectBuildText(entryPath, source) {
  return Object.freeze(TEXT_RULES
    .filter((rule) => rule.pattern.test(source))
    .map((rule) => Object.freeze({ path: entryPath, reason: rule.reason })));
}

export function inspectBuildEntryBytes(entryPath, bytes, allowCreatorNative = true) {
  const findings = [];
  const digest = sha256(bytes);
  if (digest === ORIGINAL_APK_SHA256) {
    findings.push(Object.freeze({
      path: entryPath,
      reason: 'entry bytes match the original source APK',
    }));
  }
  if (digest === ORIGINAL_NATIVE_SHA256) {
    findings.push(Object.freeze({
      path: entryPath,
      reason: 'entry bytes match the original native gameplay library',
    }));
  }

  if (isElf(bytes)) {
    if (matchesLegacyNativeFingerprint(bytes)) {
      findings.push(Object.freeze({
        path: entryPath,
        reason: 'ELF content matches the preserved native gameplay fingerprint',
      }));
    }
    if (!allowCreatorNative || !CREATOR_388_NATIVE_ENTRY.test(entryPath)) {
      findings.push(Object.freeze({
        path: entryPath,
        reason: 'unexpected ELF payload outside the pinned Creator 3.8.8 native target',
      }));
    }
  } else if (!isZip(bytes)) {
    // Latin-1 preserves every byte while exposing ASCII strings in text, DEX, WASM, and
    // renamed payloads. Native binaries are excluded because normal JNI symbols would be
    // false positives; they are handled by the stricter ELF policy above.
    findings.push(...inspectBuildText(entryPath, bytes.toString('latin1')));
  }

  return Object.freeze(findings);
}

export function auditCreatorBuild(artifactPath) {
  const absoluteArtifact = resolve(artifactPath);
  validateArtifact(absoluteArtifact);

  const artifactBytes = readFileSync(absoluteArtifact);
  if (artifactBytes.length > MAX_ARCHIVE_BYTES) {
    throw new Error(`build artifact exceeds ${MAX_ARCHIVE_BYTES} bytes`);
  }

  const findings = [];
  if (sha256(artifactBytes) === ORIGINAL_APK_SHA256) {
    findings.push(Object.freeze({
      path: absoluteArtifact,
      reason: 'artifact is the original source APK',
    }));
  }

  const state = { entryCount: 0, expandedBytes: 0 };
  findings.push(...auditArchiveBytes(artifactBytes, '', 0, state));
  return Object.freeze(findings);
}

function auditArchiveBytes(archiveBytes, scope, depth, state) {
  if (depth > MAX_NESTED_ARCHIVE_DEPTH) {
    throw new Error(`nested archive depth exceeds ${MAX_NESTED_ARCHIVE_DEPTH}: ${scope}`);
  }

  const findings = [];
  const seenPaths = new Set();
  for (const entry of parseZipEntries(archiveBytes)) {
    state.entryCount += 1;
    if (state.entryCount > MAX_ARCHIVE_ENTRIES) {
      throw new Error(`archive entry count exceeds ${MAX_ARCHIVE_ENTRIES}`);
    }

    const displayPath = scope.length === 0 ? entry.path : `${scope}!/${entry.path}`;
    findings.push(...inspectBuildEntryPath(entry.path)
      .map((finding) => Object.freeze({ ...finding, path: displayPath })));

    if (seenPaths.has(entry.path)) {
      findings.push(Object.freeze({
        path: displayPath,
        reason: 'duplicate archive entry path',
      }));
    }
    seenPaths.add(entry.path);

    if (entry.path.endsWith('/') && entry.bytes.length !== 0) {
      findings.push(Object.freeze({
        path: displayPath,
        reason: 'directory archive entry contains an unexpected payload',
      }));
    }

    state.expandedBytes += entry.bytes.length;
    if (state.expandedBytes > MAX_TOTAL_EXPANDED_BYTES) {
      throw new Error(`expanded archive content exceeds ${MAX_TOTAL_EXPANDED_BYTES} bytes`);
    }

    findings.push(...inspectBuildEntryBytes(displayPath, entry.bytes, depth === 0));
    if (isZip(entry.bytes)) {
      findings.push(...auditArchiveBytes(entry.bytes, displayPath, depth + 1, state));
    }
  }
  return findings;
}

function validateArtifact(artifactPath) {
  if (!existsSync(artifactPath) || !statSync(artifactPath).isFile()) {
    throw new Error(`build artifact does not exist: ${artifactPath}`);
  }
  const extension = extname(artifactPath).toLowerCase();
  if (extension !== '.apk' && extension !== '.aab') {
    throw new Error('build artifact must use the .apk or .aab extension');
  }
  if (statSync(artifactPath).size > MAX_ARCHIVE_BYTES) {
    throw new Error(`build artifact exceeds ${MAX_ARCHIVE_BYTES} bytes`);
  }
}

function parseZipEntries(archiveBytes) {
  const eocdOffset = findEndOfCentralDirectory(archiveBytes);
  const diskNumber = archiveBytes.readUInt16LE(eocdOffset + 4);
  const centralDisk = archiveBytes.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk = archiveBytes.readUInt16LE(eocdOffset + 8);
  const entryCount = archiveBytes.readUInt16LE(eocdOffset + 10);
  const centralSize = archiveBytes.readUInt32LE(eocdOffset + 12);
  const centralOffset = archiveBytes.readUInt32LE(eocdOffset + 16);
  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
    throw new Error('multi-disk ZIP archives are not supported');
  }
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error('ZIP64 archives are not supported by the build audit');
  }
  if (centralOffset + centralSize > eocdOffset) {
    throw new Error('ZIP central directory exceeds archive bounds');
  }

  const entries = [];
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    ensureRange(archiveBytes, cursor, 46, 'ZIP central-directory header');
    if (archiveBytes.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error(`invalid ZIP central-directory signature at entry ${index}`);
    }

    const flags = archiveBytes.readUInt16LE(cursor + 8);
    const method = archiveBytes.readUInt16LE(cursor + 10);
    const expectedCrc = archiveBytes.readUInt32LE(cursor + 16);
    const compressedSize = archiveBytes.readUInt32LE(cursor + 20);
    const uncompressedSize = archiveBytes.readUInt32LE(cursor + 24);
    const nameLength = archiveBytes.readUInt16LE(cursor + 28);
    const extraLength = archiveBytes.readUInt16LE(cursor + 30);
    const commentLength = archiveBytes.readUInt16LE(cursor + 32);
    const startDisk = archiveBytes.readUInt16LE(cursor + 34);
    const localOffset = archiveBytes.readUInt32LE(cursor + 42);
    if (
      compressedSize === 0xffffffff
      || uncompressedSize === 0xffffffff
      || localOffset === 0xffffffff
    ) {
      throw new Error('ZIP64 entries are not supported by the build audit');
    }
    if ((flags & 0x1) !== 0) {
      throw new Error('encrypted ZIP entries are not supported');
    }
    if (startDisk !== 0) {
      throw new Error('multi-disk ZIP entry is not supported');
    }
    if (uncompressedSize > MAX_EXTRACTED_ENTRY_BYTES) {
      throw new Error(`ZIP entry exceeds ${MAX_EXTRACTED_ENTRY_BYTES} bytes`);
    }

    const nameStart = cursor + 46;
    ensureRange(archiveBytes, nameStart, nameLength + extraLength + commentLength, 'ZIP entry metadata');
    const nameBytes = archiveBytes.subarray(nameStart, nameStart + nameLength);
    const path = decodeEntryPath(nameBytes);
    const bytes = extractZipEntry(
      archiveBytes,
      localOffset,
      nameBytes,
      flags,
      method,
      compressedSize,
      uncompressedSize,
      expectedCrc,
    );
    entries.push(Object.freeze({ path, bytes }));
    cursor = nameStart + nameLength + extraLength + commentLength;
  }

  if (cursor !== centralOffset + centralSize) {
    throw new Error('ZIP central-directory size does not match parsed entries');
  }
  return entries;
}

function extractZipEntry(
  archiveBytes,
  localOffset,
  centralNameBytes,
  centralFlags,
  method,
  compressedSize,
  uncompressedSize,
  expectedCrc,
) {
  ensureRange(archiveBytes, localOffset, 30, 'ZIP local header');
  if (archiveBytes.readUInt32LE(localOffset) !== 0x04034b50) {
    throw new Error('invalid ZIP local-header signature');
  }

  const localFlags = archiveBytes.readUInt16LE(localOffset + 6);
  const localMethod = archiveBytes.readUInt16LE(localOffset + 8);
  const localNameLength = archiveBytes.readUInt16LE(localOffset + 26);
  const localExtraLength = archiveBytes.readUInt16LE(localOffset + 28);
  const localNameStart = localOffset + 30;
  ensureRange(
    archiveBytes,
    localNameStart,
    localNameLength + localExtraLength + compressedSize,
    'ZIP local entry',
  );
  const localNameBytes = archiveBytes.subarray(localNameStart, localNameStart + localNameLength);
  if (!localNameBytes.equals(centralNameBytes) || localFlags !== centralFlags || localMethod !== method) {
    throw new Error('ZIP local and central entry metadata disagree');
  }

  const dataStart = localNameStart + localNameLength + localExtraLength;
  const compressed = archiveBytes.subarray(dataStart, dataStart + compressedSize);
  let bytes;
  if (method === 0) {
    bytes = Buffer.from(compressed);
  } else if (method === 8) {
    bytes = inflateRawSync(compressed, { maxOutputLength: MAX_EXTRACTED_ENTRY_BYTES });
  } else {
    throw new Error(`unsupported ZIP compression method: ${method}`);
  }

  if (bytes.length !== uncompressedSize) {
    throw new Error('ZIP entry uncompressed size mismatch');
  }
  if (crc32(bytes) !== expectedCrc) {
    throw new Error('ZIP entry CRC32 mismatch');
  }
  return bytes;
}

function findEndOfCentralDirectory(bytes) {
  const minimumOffset = Math.max(0, bytes.length - 22 - 0xffff);
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (bytes.readUInt32LE(offset) !== 0x06054b50) {
      continue;
    }
    const commentLength = bytes.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength === bytes.length) {
      return offset;
    }
  }
  throw new Error('ZIP end-of-central-directory record not found');
}

function decodeEntryPath(nameBytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(nameBytes);
  } catch {
    throw new Error('ZIP entry path is not valid UTF-8');
  }
}

function ensureRange(bytes, offset, length, label) {
  if (
    !Number.isSafeInteger(offset)
    || !Number.isSafeInteger(length)
    || offset < 0
    || length < 0
    || offset + length > bytes.length
  ) {
    throw new Error(`${label} exceeds archive bounds`);
  }
}

function isZip(bytes) {
  return bytes.length >= 4 && (
    bytes.readUInt32LE(0) === 0x04034b50
    || bytes.readUInt32LE(0) === 0x06054b50
    || bytes.readUInt32LE(0) === 0x08074b50
  );
}

function isElf(bytes) {
  return bytes.length >= 4
    && bytes[0] === 0x7f
    && bytes[1] === 0x45
    && bytes[2] === 0x4c
    && bytes[3] === 0x46;
}

function matchesLegacyNativeFingerprint(bytes) {
  let matches = 0;
  for (const [offset, expectedDigest] of LEGACY_NATIVE_CHUNKS) {
    if (offset + LEGACY_NATIVE_CHUNK_BYTES > bytes.length) {
      continue;
    }
    const digest = sha256(bytes.subarray(offset, offset + LEGACY_NATIVE_CHUNK_BYTES));
    if (digest === expectedDigest) {
      matches += 1;
      if (matches >= LEGACY_NATIVE_FINGERPRINT_MATCHES) {
        return true;
      }
    }
  }
  return false;
}

function createCrc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function main() {
  const artifactPath = process.argv[2];
  if (artifactPath === undefined) {
    console.error('Usage: node scripts/audit-creator-build.mjs <build.apk|build.aab>');
    process.exitCode = 2;
    return;
  }

  try {
    const findings = auditCreatorBuild(artifactPath);
    if (findings.length === 0) {
      console.log(`PASS: no prohibited restoration payload found in ${resolve(artifactPath)}`);
      return;
    }
    for (const finding of findings) {
      console.error(`FAIL: ${finding.path}: ${finding.reason}`);
    }
    process.exitCode = 1;
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
