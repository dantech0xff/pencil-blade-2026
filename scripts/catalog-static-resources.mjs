#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const EXPECTED_ASSETS_MANIFEST_SHA256 = '0143473b21e56525cde92163f72fd49b2a898ab70ef2b224cdad00eaba9238e3';
const EXPECTED_RES_MANIFEST_SHA256 = '42b5b4daee422a18c8b1cea70c9be636268f6a66e7e816efcf43db38988fe20f';
const EXPECTED_NATIVE_STRINGS_SHA256 = 'af74fdf1a5e679b2149c7fc213eb72ce730e4c30664654841e0409e17028f73a';

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function manifestDigest(rootDir, files) {
  const hash = crypto.createHash('sha256');
  for (const fullPath of files) {
    hash.update(relPosix(rootDir, fullPath));
    hash.update('\0');
    hash.update(sha256File(fullPath));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function assertReadableFile(filePath, label) {
  if (!exists(filePath) || !fs.statSync(filePath).isFile()) {
    fail(`${label} not found: ${filePath}`);
  }
}

function assertReadableDir(filePath, label) {
  if (!exists(filePath) || !fs.statSync(filePath).isDirectory()) {
    fail(`${label} not found: ${filePath}`);
  }
}

function collectFiles(rootDir) {
  const files = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  }
  files.sort(compareText);
  return files;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function relPosix(rootDir, fullPath) {
  return toPosix(path.relative(rootDir, fullPath));
}

function fileName(relPath) {
  return relPath.split('/').pop();
}

function fileExt(relPath) {
  const base = fileName(relPath);
  const idx = base.lastIndexOf('.');
  return idx >= 0 ? base.slice(idx).toLowerCase() : '';
}

function readPngMetadata(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(signature)) {
    return null;
  }
  const ihdrLength = buffer.readUInt32BE(8);
  const ihdrType = buffer.toString('ascii', 12, 16);
  if (ihdrLength !== 13 || ihdrType !== 'IHDR') {
    return null;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);
  const compressionMethod = buffer.readUInt8(26);
  const filterMethod = buffer.readUInt8(27);
  const interlaceMethod = buffer.readUInt8(28);
  return {
    width,
    height,
    bitDepth,
    colorType,
    compressionMethod,
    filterMethod,
    interlaceMethod,
    hasAlpha: colorType === 4 || colorType === 6,
  };
}

function readWavMetadata(buffer) {
  if (buffer.length < 44) return null;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return null;
  }
  let offset = 12;
  let fmt = null;
  let dataBytes = null;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkData = offset + 8;
    if (chunkData + chunkSize > buffer.length) return null;
    if (chunkId === 'fmt ') {
      if (chunkSize < 16) return null;
      fmt = {
        audioFormat: buffer.readUInt16LE(chunkData),
        numChannels: buffer.readUInt16LE(chunkData + 2),
        sampleRate: buffer.readUInt32LE(chunkData + 4),
        byteRate: buffer.readUInt32LE(chunkData + 8),
        blockAlign: buffer.readUInt16LE(chunkData + 12),
        bitsPerSample: buffer.readUInt16LE(chunkData + 14),
      };
    } else if (chunkId === 'data') {
      dataBytes = chunkSize;
    }
    offset = chunkData + chunkSize + (chunkSize % 2);
  }
  if (!fmt || dataBytes === null) return null;
  return { ...fmt, dataBytes };
}

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[a.length][b.length];
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function printfPatternToRegex(pattern) {
  let escaped = escapeRegex(pattern);
  escaped = escaped.replace(/%0?(\d+)d/g, (_, width) => `\\d{${width}}`);
  escaped = escaped.replace(/%d/g, '\\d+');
  escaped = escaped.replace(/%s/g, '.+');
  escaped = escaped.replace(/%%/g, '%');
  return new RegExp(`^${escaped}$`);
}

function pngCategory(relPath) {
  const base = fileName(relPath).toLowerCase();
  if (base === 'icon.png') return { classification: 'launcher', reason: 'launcher icon file' };
  if (
    base.startsWith('common_signin_') ||
    base.startsWith('ic_plusone_') ||
    base.startsWith('powered_by_google') ||
    base.startsWith('wallet_')
  ) {
    return { classification: 'vendor-ui', reason: 'google play services / sign-in artwork' };
  }
  return { classification: 'game', reason: 'non-vendor PNG under res/' };
}

function buildFileRecord(fullPath, rootDir) {
  const rel = relPosix(rootDir, fullPath);
  const buffer = fs.readFileSync(fullPath);
  const record = {
    path: rel,
    bytes: buffer.length,
    sha256: sha256Buffer(buffer),
    extension: fileExt(rel),
  };
  if (record.extension === '.png') {
    const meta = readPngMetadata(buffer);
    if (meta) {
      record.png = meta;
    }
  } else if (record.extension === '.wav') {
    const meta = readWavMetadata(buffer);
    if (meta) {
      record.wav = meta;
    }
  }
  return record;
}

function logicalPathForAsset(relPath) {
  if (relPath.startsWith('480x800/')) return relPath.slice('480x800/'.length);
  if (relPath.startsWith('720x1280/')) return relPath.slice('720x1280/'.length);
  return relPath;
}

function parseNativeResourceStrings(lines) {
  const candidates = new Set();
  const pattern = /(?:(?:[A-Za-z0-9._ -]+\/)*[A-Za-z0-9._% -]+\.(?:png|wav|mp3|ttf|otf))/g;
  for (const line of lines) {
    for (const match of line.matchAll(pattern)) {
      candidates.add(match[0]);
    }
  }
  return [...candidates].sort(compareText);
}

function summarizeScreenModeSignals(allLogicalPaths, nativeLines) {
  const screens = [];
  const modes = [];
  const seen = new Set();
  const add = (type, name, evidence) => {
    const key = `${type}:${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (type === 'screen') {
      screens.push({ name, type, evidenceStatus: 'inferred', runtimeUsage: 'unknown', evidence });
    } else {
      modes.push({ name, type, evidenceStatus: 'inferred', runtimeUsage: 'unknown', evidence });
    }
  };
  for (const rel of allLogicalPaths) {
    if (rel.startsWith('Interfaces/mode-') && rel.endsWith('.png')) {
      add('mode', rel.slice('Interfaces/mode-'.length, -4), `asset:${rel}`);
    }
    if (rel.startsWith('Leaderboard/leaderboard_') && rel.endsWith('.png')) {
      add('screen', 'leaderboard', `asset:${rel}`);
    }
    if (rel.startsWith('Objectives/')) {
      add('screen', 'objectives', `asset:${rel}`);
    }
    if (rel.startsWith('Loading/')) {
      add('screen', 'loading', `asset:${rel}`);
    }
    if (rel.startsWith('Text/')) {
      add('screen', 'text', `asset:${rel}`);
    }
    if (rel.startsWith('Images/')) {
      add('screen', 'images', `asset:${rel}`);
    }
  }
  for (const line of nativeLines) {
    if (line.includes('AboutLayer')) add('screen', 'about', `native:${line}`);
    if (line.includes('MainMenuLayer')) add('screen', 'main-menu', `native:${line}`);
    if (line.includes('Options')) add('screen', 'options', `native:${line}`);
    if (line.includes('DisplayScoreLayer')) add('screen', 'score-display', `native:${line}`);
    if (line.includes('TestLayer') || line.includes('AnimationTestLayer')) add('screen', 'test', `native:${line}`);
    if (line.includes('Crazy')) add('mode', 'crazy', `native:${line}`);
    if (line.includes('Classic')) add('mode', 'classic', `native:${line}`);
    if (line.includes('Combo')) add('mode', 'combo', `native:${line}`);
    if (line.includes('Gnstyle') || line.includes('GnStyle')) add('mode', 'gnstyle', `native:${line}`);
  }
  screens.sort((a, b) => compareText(a.name, b.name));
  modes.sort((a, b) => compareText(a.name, b.name));
  return { screens, modes };
}

function main(argv) {
  const [resourcesRootArg, nativeStringsArg, outputArg] = argv.slice(2);
  if (!resourcesRootArg || !nativeStringsArg || !outputArg || argv.length !== 5) {
    fail('usage: node scripts/catalog-static-resources.mjs <jadx-resources-root> <native-strings-file> <output-json>');
  }

  const resourcesRoot = path.resolve(resourcesRootArg);
  const nativeStringsFile = path.resolve(nativeStringsArg);
  const outputJson = path.resolve(outputArg);
  const assetsRoot = path.join(resourcesRoot, 'assets');
  const resRoot = path.join(resourcesRoot, 'res');

  assertReadableDir(resourcesRoot, 'resources root');
  assertReadableFile(nativeStringsFile, 'native strings file');
  if (exists(outputJson)) {
    fail(`output already exists: ${outputJson}`);
  }
  const outputParent = path.dirname(outputJson);
  fs.mkdirSync(outputParent, { recursive: true });
  if (exists(outputJson)) {
    fail(`output already exists: ${outputJson}`);
  }
  assertReadableDir(assetsRoot, 'assets root');
  assertReadableDir(resRoot, 'res root');

  const nativeLines = fs.readFileSync(nativeStringsFile, 'utf8').split(/\r?\n/).filter(Boolean);
  const nativeStringsSha = sha256File(nativeStringsFile);

  const allAssetFiles = collectFiles(assetsRoot);
  const allResFiles = collectFiles(resRoot);
  const assetsManifestSha = manifestDigest(assetsRoot, allAssetFiles);
  const resManifestSha = manifestDigest(resRoot, allResFiles);
  if (assetsManifestSha !== EXPECTED_ASSETS_MANIFEST_SHA256) {
    fail(`assets manifest SHA-256 mismatch: actual=${assetsManifestSha} expected=${EXPECTED_ASSETS_MANIFEST_SHA256}`);
  }
  if (resManifestSha !== EXPECTED_RES_MANIFEST_SHA256) {
    fail(`res manifest SHA-256 mismatch: actual=${resManifestSha} expected=${EXPECTED_RES_MANIFEST_SHA256}`);
  }
  if (nativeStringsSha !== EXPECTED_NATIVE_STRINGS_SHA256) {
    fail(`native strings SHA-256 mismatch: actual=${nativeStringsSha} expected=${EXPECTED_NATIVE_STRINGS_SHA256}`);
  }
  const treeFiles = {
    '480x800': collectFiles(path.join(assetsRoot, '480x800')),
    '720x1280': collectFiles(path.join(assetsRoot, '720x1280')),
  };
  const sharedSoundFiles = collectFiles(path.join(assetsRoot, 'Sounds'));
  const sharedFontFiles = collectFiles(path.join(assetsRoot, 'Fonts'));
  const resPngFiles = collectFiles(resRoot).filter((file) => file.toLowerCase().endsWith('.png'));

  const treeLogical = {
    '480x800': treeFiles['480x800'].map((f) => relPosix(path.join(assetsRoot, '480x800'), f)),
    '720x1280': treeFiles['720x1280'].map((f) => relPosix(path.join(assetsRoot, '720x1280'), f)),
  };

  const exactPairs = [];
  const unmatched480 = [];
  const unmatched720 = [];
  const set480 = new Set(treeLogical['480x800']);
  const set720 = new Set(treeLogical['720x1280']);
  for (const rel of treeLogical['480x800']) {
    if (set720.has(rel)) {
      exactPairs.push({
        logicalPath: rel,
        path480x800: `480x800/${rel}`,
        path720x1280: `720x1280/${rel}`,
        evidenceStatus: 'recovered',
        runtimeUsage: 'unknown',
      });
    } else {
      unmatched480.push(rel);
    }
  }
  for (const rel of treeLogical['720x1280']) {
    if (!set480.has(rel)) {
      unmatched720.push(rel);
    }
  }

  const nearMatches = [];
  for (const left of unmatched480) {
    const leftBase = fileName(left);
    const leftParent = left.slice(0, left.length - leftBase.length);
    let best = null;
    for (const right of unmatched720) {
      const rightBase = fileName(right);
      const rightParent = right.slice(0, right.length - rightBase.length);
      if (leftParent !== rightParent) continue;
      const dist = editDistance(leftBase, rightBase);
      if (dist <= 2 && (!best || dist < best.distance || (dist === best.distance && compareText(right, best.right) < 0))) {
        best = { left, right, distance: dist };
      }
    }
    if (best) {
      nearMatches.push({
        left: best.left,
        right: best.right,
        kind: 'typo-mismatch',
        distance: best.distance,
        evidence: ['native:Text/text-justcombo.png', 'native:Text/text-juscombo.png'],
        evidenceStatus: 'inferred',
        runtimeUsage: 'unknown',
      });
    }
  }
  nearMatches.sort((a, b) => compareText(a.left, b.left));

  const assetFileRecords = {
    trees: {
      '480x800': treeFiles['480x800'].map((f) => buildFileRecord(f, path.join(assetsRoot, '480x800'))),
      '720x1280': treeFiles['720x1280'].map((f) => buildFileRecord(f, path.join(assetsRoot, '720x1280'))),
    },
    sharedSounds: sharedSoundFiles.map((f) => buildFileRecord(f, assetsRoot)),
    sharedFonts: sharedFontFiles.map((f) => buildFileRecord(f, assetsRoot)),
  };

  const resPngRecords = resPngFiles.map((f) => {
    const record = buildFileRecord(f, resRoot);
    const meta = pngCategory(record.path);
    record.classification = meta.classification;
    record.classificationReason = meta.reason;
    record.evidenceStatus = 'recovered';
    record.classificationStatus = 'inferred';
    record.runtimeUsage = 'unknown';
    return record;
  });

  const allLogicalPaths = [
    ...treeLogical['480x800'],
    ...treeLogical['720x1280'],
    ...sharedSoundFiles.map((f) => relPosix(assetsRoot, f)),
    ...sharedFontFiles.map((f) => relPosix(assetsRoot, f)),
    ...resPngRecords.map((r) => r.path),
  ];

  const nativeResourceStrings = parseNativeResourceStrings(nativeLines);
  const exactLogicalMatches = [];
  const printfPatternRefs = [];
  const exactMatchIndex = new Map();

  const logicalCandidates = new Map();
  for (const rel of treeLogical['480x800']) {
    const key = rel;
    if (!logicalCandidates.has(key)) logicalCandidates.set(key, []);
    logicalCandidates.get(key).push(`480x800/${rel}`);
  }
  for (const rel of treeLogical['720x1280']) {
    const key = rel;
    if (!logicalCandidates.has(key)) logicalCandidates.set(key, []);
    logicalCandidates.get(key).push(`720x1280/${rel}`);
  }
  for (const f of sharedSoundFiles) {
    const rel = relPosix(assetsRoot, f);
    if (!logicalCandidates.has(rel)) logicalCandidates.set(rel, []);
    logicalCandidates.get(rel).push(rel);
  }
  for (const f of sharedFontFiles) {
    const rel = relPosix(assetsRoot, f);
    if (!logicalCandidates.has(rel)) logicalCandidates.set(rel, []);
    logicalCandidates.get(rel).push(rel);
  }

  for (const candidate of nativeResourceStrings) {
    const hasPrintf = candidate.includes('%');
    if (!hasPrintf) {
      const matches = [];
      if (logicalCandidates.has(candidate)) {
        matches.push(...logicalCandidates.get(candidate));
      }
      if (matches.length > 0) {
        exactLogicalMatches.push({
          nativeString: candidate,
          matches: matches.sort(compareText),
          evidenceStatus: 'recovered',
          runtimeUsage: 'unknown',
        });
        exactMatchIndex.set(candidate, true);
      }
      continue;
    }

    const regex = printfPatternToRegex(candidate);
    const matches = allLogicalPaths.filter((logical) => regex.test(logical));
    if (matches.length > 0) {
      printfPatternRefs.push({
        nativeString: candidate,
        regex: regex.source,
        matches: matches.sort(compareText),
        evidenceStatus: 'recovered',
        runtimeUsage: 'unknown',
      });
    }
  }

  exactLogicalMatches.sort((a, b) => compareText(a.nativeString, b.nativeString));
  printfPatternRefs.sort((a, b) => compareText(a.nativeString, b.nativeString));
  const matchedNativeStrings = new Set([
    ...exactLogicalMatches.map((entry) => entry.nativeString),
    ...printfPatternRefs.map((entry) => entry.nativeString),
  ]);
  const unmatchedNativeStrings = nativeResourceStrings
    .filter((entry) => !matchedNativeStrings.has(entry))
    .map((nativeString) => ({
      nativeString,
      evidenceStatus: 'recovered',
      runtimeUsage: 'unknown',
    }));

  const numericSequenceGroups = [];
  const sequenceMap = new Map();
  for (const rel of [
    ...treeLogical['480x800'].map((p) => `480x800/${p}`),
    ...treeLogical['720x1280'].map((p) => `720x1280/${p}`),
    ...sharedSoundFiles.map((f) => relPosix(assetsRoot, f)),
    ...sharedFontFiles.map((f) => relPosix(assetsRoot, f)),
  ]) {
    const base = fileName(rel);
    const match = base.match(/^(.*?)(\d+)(\.[^.]+)$/);
    if (!match) continue;
    const key = `${path.posix.dirname(rel)}|${match[1]}|${match[3]}`;
    if (!sequenceMap.has(key)) {
      sequenceMap.set(key, []);
    }
    sequenceMap.get(key).push(rel);
  }
  for (const [key, values] of sequenceMap.entries()) {
    if (values.length < 2) continue;
    values.sort(compareText);
    const [dir, prefix, ext] = key.split('|');
    numericSequenceGroups.push({
      directory: dir === '.' ? '' : dir,
      prefix,
      extension: ext,
      count: values.length,
      members: values,
      evidenceStatus: 'recovered',
      runtimeUsage: 'unknown',
    });
  }
  numericSequenceGroups.sort((a, b) => compareText(a.members[0], b.members[0]));

  const screenModeNaming = summarizeScreenModeSignals(
    [...treeLogical['480x800'], ...treeLogical['720x1280']],
    nativeLines,
  );

  const summary = {
    schemaVersion: 1,
    assets: {
      png: treeFiles['480x800'].length + treeFiles['720x1280'].length,
      wav: sharedSoundFiles.filter((f) => f.toLowerCase().endsWith('.wav')).length,
      mp3: sharedSoundFiles.filter((f) => f.toLowerCase().endsWith('.mp3')).length,
      fonts: sharedFontFiles.length,
      total: allAssetFiles.length,
    },
    treePairs: {
      exact: exactPairs.length,
      unmatched480x800: unmatched480.length,
      unmatched720x1280: unmatched720.length,
      nearMatches: nearMatches.length,
    },
    resPng: {
      total: resPngRecords.length,
      launcher: resPngRecords.filter((entry) => entry.classification === 'launcher').length,
      vendorUi: resPngRecords.filter((entry) => entry.classification === 'vendor-ui').length,
      game: resPngRecords.filter((entry) => entry.classification === 'game').length,
    },
    native: {
      resourceStrings: nativeResourceStrings.length,
      exactLogicalMatches: exactLogicalMatches.length,
      printfPatterns: printfPatternRefs.length,
      unmatchedResourceStrings: unmatchedNativeStrings.length,
      numericSequenceGroups: numericSequenceGroups.length,
      screenNames: screenModeNaming.screens.length,
      modeNames: screenModeNaming.modes.length,
    },
  };

  const output = {
    schemaVersion: 1,
    inputs: {
      evidenceIds: ['DER-WORK-001', 'DER-NATIVE-001'],
      resourcesRoot: path.basename(resourcesRoot),
      assetsRoot: 'assets',
      resRoot: 'res',
      nativeStringsFile: path.basename(nativeStringsFile),
      sourceHashes: {
        assetsManifest: assetsManifestSha,
        resManifest: resManifestSha,
        nativeStrings: nativeStringsSha,
      },
    },
    summary,
    assets: {
      trees: {
        '480x800': {
          files: assetFileRecords.trees['480x800'],
          exactLogicalPaths: exactPairs.map((pair) => pair.path480x800),
          unmatchedLogicalPaths: unmatched480,
        },
        '720x1280': {
          files: assetFileRecords.trees['720x1280'],
          exactLogicalPaths: exactPairs.map((pair) => pair.path720x1280),
          unmatchedLogicalPaths: unmatched720,
        },
      },
      shared: {
        sounds: assetFileRecords.sharedSounds,
        fonts: assetFileRecords.sharedFonts,
      },
      pairings: {
        exact: exactPairs,
        nearMatches,
      },
    },
    androidRes: {
      png: resPngRecords,
    },
    native: {
      strings: {
        all: nativeResourceStrings.map((nativeString) => ({
          nativeString,
          evidenceStatus: 'recovered',
          runtimeUsage: 'unknown',
        })),
        exactLogicalMatches,
        printfPatternReferences: printfPatternRefs,
        unmatched: unmatchedNativeStrings,
      },
      namingSignals: {
        screens: screenModeNaming.screens,
        modes: screenModeNaming.modes,
      },
      numericSequenceGroups,
    },
  };

  fs.writeFileSync(outputJson, `${JSON.stringify(output, null, 2)}\n`);
}

main(process.argv);
