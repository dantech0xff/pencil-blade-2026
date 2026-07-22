import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';

import {
  auditCreatorBuild,
  inspectBuildEntryPath,
  inspectBuildText,
} from '../scripts/audit-creator-build.mjs';

const testRoot = mkdtempSync(join(tmpdir(), 'pencil-blade-build-audit-'));
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const originalApk = readFileSync(join(projectRoot, 'Pencil+Blade_1.5_APKPure.apk'));
const originalNative = readFileSync(
  join(projectRoot, '.forensics-work/phase-01/native/libgame.so'),
);

after(() => {
  rmSync(testRoot, { force: true, recursive: true });
});

test('clean Creator-shaped archive allows current engine native libraries', () => {
  const artifact = createArchive('clean.apk', {
    'assets/main/index.js': 'export const restoredScore = 10;',
    'lib/arm64-v8a/libcocos.so': 'synthetic current Creator engine fixture',
  });

  assert.deepEqual(auditCreatorBuild(artifact), []);
});

test('archive audit rejects original, embedded-app, legacy-runtime, and bridge paths', () => {
  const artifact = createArchive('bad-paths.aab', {
    'base/assets/original.apk': 'synthetic nested application',
    'base/assets/native-compatibility-bridge/adapter.js': 'export const bridge = true;',
    'base/lib/armeabi/libcocos2dcpp.so': 'synthetic legacy engine',
    'base/lib/armeabi/libgame.so': 'synthetic original-name native library',
  });

  const reasons = auditCreatorBuild(artifact).map((finding) => finding.reason);
  assert.ok(reasons.includes('embedded Android application archive'));
  assert.ok(reasons.includes('native compatibility or emulation path'));
  assert.ok(reasons.includes('legacy native engine library path'));
  assert.ok(reasons.includes('original native gameplay library path'));
});

test('archive audit scans packaged text for native-loading and evidence dependencies', () => {
  const artifact = createArchive('bad-source.apk', {
    'assets/main/payload.bin': 'System.loadLibrary("game"); // JADX decompiler output',
  });

  const reasons = auditCreatorBuild(artifact).map((finding) => finding.reason);
  assert.ok(reasons.includes('legacy native loading or bridge call'));
  assert.ok(reasons.includes('decompiler dependency'));
});

test('path and text inspectors reject renamed unsafe paths without a build directory scan', () => {
  assert.notEqual(inspectBuildEntryPath('../outside/libgame.so').length, 0);
  assert.notEqual(
    inspectBuildText('assets/index.js', 'const native = "libgame.so";').length,
    0,
  );
});

test('content hashing rejects exact source APK and native bytes under innocent extensions', () => {
  const artifact = createArchive('renamed-evidence.aab', {
    'base/assets/source-payload.bin': originalApk,
    'base/assets/native-payload.dat': originalNative,
  });

  const reasons = auditCreatorBuild(artifact).map((finding) => finding.reason);
  assert.ok(reasons.includes('entry bytes match the original source APK'));
  assert.ok(reasons.includes('entry bytes match the original native gameplay library'));
});

test('legacy fingerprint rejects a minimally changed native binary renamed as libcocos', () => {
  const artifact = createArchive('patched-native.apk', {
    'lib/arm64-v8a/libcocos.so': Buffer.concat([originalNative, Buffer.from([0])]),
  });

  const reasons = auditCreatorBuild(artifact).map((finding) => finding.reason);
  assert.ok(reasons.includes('ELF content matches the preserved native gameplay fingerprint'));
  assert.ok(!reasons.includes('entry bytes match the original native gameplay library'));
});

test('wildcard-bearing and duplicate entry names fail closed without pattern extraction', () => {
  const wildcardArtifact = createArchive('wildcard.apk', {
    'assets/payload*.so': originalNative,
    'assets/payload-benign.so': 'benign',
  });
  const wildcardReasons = auditCreatorBuild(wildcardArtifact).map((finding) => finding.reason);
  assert.ok(wildcardReasons.includes('unsafe or ambiguous archive entry path'));
  assert.ok(wildcardReasons.includes('entry bytes match the original native gameplay library'));

  const duplicateArtifact = createStoredArchive('duplicates.aab', [
    ['base/assets/repeated.bin', 'first'],
    ['base/assets/repeated.bin', 'second'],
  ]);
  const duplicateReasons = auditCreatorBuild(duplicateArtifact).map((finding) => finding.reason);
  assert.ok(duplicateReasons.includes('duplicate archive entry path'));
});

test('slash-terminated directory entries cannot hide native payload bytes', () => {
  const artifact = createStoredArchive('directory-payload.apk', [
    ['assets/payload/', originalNative],
  ]);

  const reasons = auditCreatorBuild(artifact).map((finding) => finding.reason);
  assert.ok(reasons.includes('directory archive entry contains an unexpected payload'));
  assert.ok(reasons.includes('entry bytes match the original native gameplay library'));
});

function createArchive(name, entries) {
  const fixtureRoot = join(testRoot, name.replace(/\.(?:apk|aab)$/u, ''));
  for (const [entryPath, contents] of Object.entries(entries)) {
    const absoluteEntry = join(fixtureRoot, entryPath);
    mkdirSync(dirname(absoluteEntry), { recursive: true });
    writeFileSync(absoluteEntry, contents);
  }
  const artifact = join(testRoot, name);
  execFileSync('/usr/bin/zip', ['-q', '-r', artifact, '.'], { cwd: fixtureRoot });
  return artifact;
}

function createStoredArchive(name, entries) {
  const localRecords = [];
  const centralRecords = [];
  let localOffset = 0;

  for (const [entryPath, contents] of entries) {
    const pathBytes = Buffer.from(entryPath, 'utf8');
    const contentsBytes = Buffer.from(contents);
    const checksum = crc32(contentsBytes);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(contentsBytes.length, 18);
    localHeader.writeUInt32LE(contentsBytes.length, 22);
    localHeader.writeUInt16LE(pathBytes.length, 26);
    localRecords.push(localHeader, pathBytes, contentsBytes);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(contentsBytes.length, 20);
    centralHeader.writeUInt32LE(contentsBytes.length, 24);
    centralHeader.writeUInt16LE(pathBytes.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralRecords.push(centralHeader, pathBytes);

    localOffset += localHeader.length + pathBytes.length + contentsBytes.length;
  }

  const centralBytes = Buffer.concat(centralRecords);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12);
  eocd.writeUInt32LE(localOffset, 16);

  const artifact = join(testRoot, name);
  writeFileSync(artifact, Buffer.concat([...localRecords, centralBytes, eocd]));
  return artifact;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
