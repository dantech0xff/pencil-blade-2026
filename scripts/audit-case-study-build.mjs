#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import { extname, isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  contentTypeForWebPath,
  extractStaticWebReferences,
  inspectWebBuildDirectory,
} from './audit-web-build.mjs';

export const DEFAULT_PAGES_PREFIX = '/pencil-blade-2026/';
export const GAME_SUBTREE = 'play/game';

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.htm',
  '.html',
  '.js',
  '.json',
  '.mjs',
  '.svg',
  '.txt',
  '.xml',
]);
const DENIED_EXTENSIONS = /\.(?:aab|apk|apks|app|bat|class|cmd|com|dex|dll|dylib|exe|gpr|i64|idb|jar|jks|keystore|map|msi|o|obj|ps1|sh|so|xapk)$/iu;
const DENIED_PATH_SEGMENTS = /^(?:\.forensics-work|\.git|apktool(?:-output)?|decompiler(?:-output)?|ghidra|ida|jadx(?:-output)?|offline-evidence|plans?|reference|reports?|tests?)$/iu;
const PRIVATE_TEXT = /(?:file:\/\/\/)?(?:\/Users\/[^/\s"'<>]+|\/home\/[^/\s"'<>]+|\/Volumes\/[^/\s"'<>]+|\/private\/(?:tmp|var)\/|[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"'<>]+)|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:authorization|bearer)\s*[:=]\s*[^\s,;]+/iu;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function finding(path, reason) {
  return Object.freeze({ path, reason });
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

function inspectRelativePath(relativePath) {
  const findings = [];
  const segments = relativePath.split('/');
  if (
    relativePath.includes('\\')
    || relativePath.includes('\0')
    || segments.some((segment) => (
      segment.length === 0
      || segment === '.'
      || segment === '..'
      || /%(?:00|2e|2f|5c)/iu.test(segment)
    ))
  ) {
    findings.push(finding(relativePath, 'unsafe or path-escaping candidate entry'));
  }
  if (DENIED_EXTENSIONS.test(relativePath)) {
    findings.push(finding(relativePath, 'unapproved executable, native, archive, or private artifact type'));
  }
  if (segments.some((segment) => DENIED_PATH_SEGMENTS.test(segment))) {
    findings.push(finding(relativePath, 'raw evidence or development-only path is prohibited'));
  }
  return findings;
}

function isZip(bytes) {
  return bytes.length >= 4 && (
    bytes.readUInt32LE(0) === 0x04034b50
    || bytes.readUInt32LE(0) === 0x06054b50
    || bytes.readUInt32LE(0) === 0x08074b50
  );
}

function isExecutable(bytes) {
  if (bytes.length < 4) return false;
  const magic = bytes.readUInt32BE(0);
  return (
    bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))
    || (bytes[0] === 0x4d && bytes[1] === 0x5a)
    || bytes.subarray(0, 4).equals(Buffer.from('dex\n'))
    || magic === 0xcafebabe
    || magic === 0xfeedface
    || magic === 0xfeedfacf
    || magic === 0xcefaedfe
    || magic === 0xcffaedfe
  );
}

function decodeReference(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&#x2f;', '/')
    .replaceAll('&#47;', '/')
    .trim();
}

function isAllowedExternalHref(reference) {
  if (reference.kind !== 'markup-href' || reference.attribute !== 'href') {
    return false;
  }
  if (reference.element === 'a') {
    return true;
  }
  if (reference.element !== 'link') {
    return false;
  }
  const relationTokens = (reference.rel ?? '')
    .split(/\s+/u)
    .filter(Boolean);
  return (
    relationTokens.length === 1
    && (relationTokens[0] === 'canonical' || relationTokens[0] === 'alternate')
  );
}

function inspectEditorialReference(reference, pagesPrefix) {
  const value = decodeReference(reference.value);
  if (
    value.length === 0
    || value.startsWith('#')
    || /^(?:about:blank|mailto:|tel:)/iu.test(value)
  ) {
    return [];
  }
  if (/^https:/iu.test(value)) {
    return isAllowedExternalHref(reference)
      ? []
      : [finding(reference.source, `off-origin executable or media reference is prohibited: ${value}`)];
  }
  if (/^(?:http:|wss?:)/iu.test(value) || value.startsWith('//')) {
    return [finding(reference.source, `off-origin executable or media reference is prohibited: ${value}`)];
  }
  if (/^(?:data|blob|file|javascript|vbscript):/iu.test(value)) {
    return [finding(reference.source, `unsafe URL scheme is prohibited: ${value}`)];
  }
  if (value.startsWith('/') && !value.startsWith(pagesPrefix)) {
    return [finding(reference.source, `root-relative URL bypasses the Pages prefix: ${value}`)];
  }
  if (value.includes('\\')) {
    return [finding(reference.source, `unsafe backslash URL is prohibited: ${value}`)];
  }
  const encodedPath = value.split(/[?#]/u, 1)[0];
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(encodedPath);
  } catch {
    return [finding(reference.source, `malformed percent-encoded URL is prohibited: ${value}`)];
  }
  const basePath = posix.dirname(reference.source);
  const localPath = decodedPath.startsWith(pagesPrefix)
    ? decodedPath.slice(pagesPrefix.length)
    : posix.normalize(posix.join(basePath, decodedPath));
  if (
    localPath === '..'
    || localPath.startsWith('../')
    || posix.isAbsolute(localPath)
    || localPath.split('/').some((segment) => segment === '..')
  ) {
    return [finding(reference.source, `URL escapes the candidate root: ${value}`)];
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value)) {
    return [finding(reference.source, `unsupported URL scheme is prohibited: ${value}`)];
  }
  return [];
}

function inspectEditorialFile(file, pagesPrefix) {
  const findings = [];
  const extension = extname(file.path).toLowerCase();
  if (contentTypeForWebPath(file.path) === undefined) {
    findings.push(finding(file.path, 'unsupported static file type'));
  }
  if (isZip(file.bytes)) {
    findings.push(finding(file.path, 'ZIP or embedded application archive payload is prohibited'));
  }
  if (isExecutable(file.bytes)) {
    findings.push(finding(file.path, 'unexpected executable binary payload is prohibited'));
  }
  if (!TEXT_EXTENSIONS.has(extension)) {
    return findings;
  }

  let source;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(file.bytes);
  } catch {
    findings.push(finding(file.path, 'text payload is not valid UTF-8'));
    return findings;
  }
  if (PRIVATE_TEXT.test(source)) {
    findings.push(finding(file.path, 'private machine path, credential, or key material is prohibited'));
  }
  for (const reference of extractStaticWebReferences(file.path, source)) {
    findings.push(...inspectEditorialReference(reference, pagesPrefix));
  }
  return findings;
}

function inspectCandidateTree(outDir, pagesPrefix) {
  const root = validateRoot(outDir, 'candidate directory');
  const files = [];
  const findings = [];
  const pending = [{ absolutePath: root, relativePath: '' }];

  while (pending.length > 0) {
    const directory = pending.pop();
    const entries = readdirSync(directory.absolutePath, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = directory.relativePath
        ? `${directory.relativePath}/${entry.name}`
        : entry.name;
      const absolutePath = resolve(directory.absolutePath, entry.name);
      if (!isContained(root, absolutePath)) {
        findings.push(finding(relativePath, 'candidate entry escapes the candidate root'));
        continue;
      }
      findings.push(...inspectRelativePath(relativePath));
      const metadata = lstatSync(absolutePath);
      if (metadata.isSymbolicLink()) {
        findings.push(finding(relativePath, 'symbolic links are prohibited in a candidate'));
        continue;
      }
      if (metadata.isDirectory()) {
        if (relativePath === GAME_SUBTREE) {
          continue;
        }
        pending.push({ absolutePath, relativePath });
        continue;
      }
      if (!metadata.isFile()) {
        findings.push(finding(relativePath, 'unsafe non-file filesystem entry'));
        continue;
      }
      const bytes = readFileSync(absolutePath);
      const file = Object.freeze({
        absolutePath,
        bytes,
        path: relativePath,
        sha256: sha256(bytes),
        size: metadata.size,
      });
      files.push(file);
      findings.push(...inspectEditorialFile(file, pagesPrefix));
    }
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  return Object.freeze({
    files: Object.freeze(files),
    findings: Object.freeze(findings),
    root,
  });
}

export function treeDigest(files) {
  return sha256(
    files
      .map((file) => `${file.path}\0${file.size}\0${file.sha256}\n`)
      .sort()
      .join(''),
  );
}

function formatAuditFailure(findings) {
  return findings
    .map((item) => `${item.path}: ${item.reason}`)
    .join('\n');
}

function readJsonInput(value, label) {
  if (typeof value === 'string') {
    return JSON.parse(readFileSync(resolve(value), 'utf8'));
  }
  if (value && typeof value === 'object') {
    return value;
  }
  throw new Error(`${label} must be a JSON object or path`);
}

function h5RecordFrom(value, label) {
  const media = Array.isArray(value.media) ? value.media : [];
  const mediaRecord = media.find((record) => record?.mediaId === 'MEDIA-H5-AUDITED-TREE');
  const candidates = [
    mediaRecord?.provenance,
    value.h5Tree?.provenance,
    value.h5Tree,
    value.canonicalArtifacts?.h5,
    value.build,
    value.provenance,
    value,
  ];
  const record = candidates.find((candidate) => (
    candidate
    && Number.isInteger(candidate.files)
    && Number.isInteger(candidate.bytes)
    && typeof candidate.treeDigestSha256 === 'string'
  ));
  if (!record) {
    throw new Error(`${label} does not contain complete H5 tree provenance`);
  }
  return {
    academicDisplayDecisionRef:
      mediaRecord?.academicDisplayDecisionRef
      ?? value.h5Tree?.academicDisplayDecisionRef
      ?? value.academicDisplayDecisionRef,
    bytes: record.bytes,
    files: record.files,
    treeDigestSha256: record.treeDigestSha256,
  };
}

function playRecordsFrom(playFacts) {
  const facts = readJsonInput(playFacts, 'playFacts');
  const records = [];
  if (facts.en) records.push(['playFacts.en', facts.en]);
  if (facts.vi) records.push(['playFacts.vi', facts.vi]);
  if (facts.h5Tree) records.push(['playFacts.h5Tree', h5RecordFrom(facts, 'playFacts')]);
  if (records.length === 0) records.push(['playFacts', facts]);
  return records;
}

function assertSameMetric(actual, expected, field, label) {
  if (actual[field] !== expected[field]) {
    throw new Error(
      `${label} ${field} mismatch: expected ${String(expected[field])}, received ${String(actual[field])}`,
    );
  }
}

export function verifyGameArtifactBinding({
  gameDist,
  evidenceSnapshot,
  playFacts,
  pagesPrefix = DEFAULT_PAGES_PREFIX,
} = {}) {
  const audit = inspectWebBuildDirectory(gameDist);
  if (audit.findings.length > 0) {
    throw new Error(`raw game audit failed:\n${formatAuditFailure(audit.findings)}`);
  }
  const actual = Object.freeze({
    bytes: audit.totalBytes,
    files: audit.files.length,
    treeDigestSha256: treeDigest(audit.files),
  });
  const evidenceValue = readJsonInput(evidenceSnapshot, 'evidenceSnapshot');
  const evidence = h5RecordFrom(evidenceValue, 'evidenceSnapshot');
  for (const field of ['files', 'bytes', 'treeDigestSha256']) {
    assertSameMetric(actual, evidence, field, 'publication evidence');
  }

  const normalizedPrefix = `/${pagesPrefix.split('/').filter(Boolean).join('/')}/`;
  const expectedMount = `${normalizedPrefix}play/game/`;
  for (const [label, record] of playRecordsFrom(playFacts)) {
    const normalizedRecord = record.provenance ? h5RecordFrom(record, label) : record;
    for (const field of ['files', 'bytes', 'treeDigestSha256']) {
      if (normalizedRecord[field] !== undefined) {
        assertSameMetric(actual, normalizedRecord, field, label);
      }
    }
    if (record.gameUrl !== undefined && record.gameUrl !== expectedMount) {
      throw new Error(`${label} gameUrl mismatch: expected ${expectedMount}, received ${record.gameUrl}`);
    }
  }
  const evidencePagesBase = evidenceValue.repository?.pagesBase;
  if (evidencePagesBase !== undefined && evidencePagesBase !== normalizedPrefix) {
    throw new Error(
      `publication Pages base mismatch: expected ${normalizedPrefix}, received ${evidencePagesBase}`,
    );
  }
  return Object.freeze({
    ...actual,
    academicDisplayDecisionRef: evidence.academicDisplayDecisionRef,
    mount: expectedMount,
  });
}

function defaultPlayFacts(publicationManifest, pagesPrefix) {
  const h5Tree = publicationManifest.media.find(
    (record) => record.mediaId === 'MEDIA-H5-AUDITED-TREE',
  );
  const gameUrl = `${pagesPrefix}play/game/`;
  return {
    h5Tree,
    en: { ...h5Tree.provenance, gameUrl },
    vi: { ...h5Tree.provenance, gameUrl },
  };
}

export function auditCaseStudyBuild(outDir, options = {}) {
  const pagesPrefix = `/${(options.pagesPrefix ?? DEFAULT_PAGES_PREFIX)
    .split('/')
    .filter(Boolean)
    .join('/')}/`;
  const candidate = inspectCandidateTree(outDir, pagesPrefix);
  const findings = [...candidate.findings];
  const gameRoot = resolve(candidate.root, GAME_SUBTREE);
  if (!existsSync(gameRoot)) {
    findings.push(finding(`${GAME_SUBTREE}/`, 'required raw game subtree is missing'));
  } else {
    try {
      const gameAudit = inspectWebBuildDirectory(gameRoot, options.gameAuditOptions);
      findings.push(...gameAudit.findings.map((item) => (
        finding(`${GAME_SUBTREE}/${item.path}`, item.reason)
      )));
    } catch (error) {
      findings.push(finding(
        `${GAME_SUBTREE}/`,
        `raw game audit could not run: ${error instanceof Error ? error.message : String(error)}`,
      ));
    }
  }

  if (options.publicationManifest !== undefined && existsSync(gameRoot)) {
    try {
      const publicationManifest = readJsonInput(
        options.publicationManifest,
        'publicationManifest',
      );
      verifyGameArtifactBinding({
        evidenceSnapshot: publicationManifest,
        gameDist: gameRoot,
        pagesPrefix,
        playFacts: options.playFacts ?? defaultPlayFacts(publicationManifest, pagesPrefix),
      });
    } catch (error) {
      findings.push(finding(
        `${GAME_SUBTREE}/`,
        `publication binding failed: ${error instanceof Error ? error.message : String(error)}`,
      ));
    }
  }
  return Object.freeze(findings);
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
    else if (argument === '--pages-prefix') options.pagesPrefix = value;
    else if (argument === '--publication-manifest') options.publicationManifest = value;
    else throw new Error(`unknown option: ${argument}`);
  }
  options.candidateDir ??= positional[0];
  options.publicationManifest ??= positional[1];
  if (positional.length > 2) throw new Error('too many positional arguments');
  return options;
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const findings = auditCaseStudyBuild(options.candidateDir, options);
    if (findings.length > 0) {
      for (const item of findings) {
        process.stderr.write(`FAIL: ${item.path}: ${item.reason}\n`);
      }
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`PASS audited case-study candidate ${resolve(options.candidateDir)}\n`);
  } catch (error) {
    process.stderr.write(`ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
