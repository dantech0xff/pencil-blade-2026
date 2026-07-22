import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

export interface SourceBoundaryFinding {
  readonly path: string;
  readonly reason: string;
}

const IGNORED_CREATOR_PREFIXES = Object.freeze([
  'game/build/',
  'game/library/',
  'game/local/',
  'game/node_modules/',
  'game/profiles/',
  'game/temp/',
]);

const TEXT_EXTENSIONS = new Set([
  '.c', '.cc', '.cjs', '.cpp', '.cxx', '.gradle', '.h', '.hpp', '.java', '.js', '.json',
  '.kt', '.kts', '.m', '.md', '.mjs', '.mm', '.properties', '.sh', '.smali', '.ts', '.tsx',
  '.txt', '.xml', '.yaml', '.yml',
]);

const PATH_RULES: readonly Readonly<{ reason: string; pattern: RegExp }>[] = Object.freeze([
  { reason: 'APK payload', pattern: /\.(?:apk|apks|xapk)$/i },
  { reason: 'native library/object payload', pattern: /\.(?:a|o|so(?:\.\d+)*)$/i },
  { reason: 'native source outside the TypeScript boundary', pattern: /\.(?:c|cc|cpp|cxx|h|hpp|m|mm)$/i },
  { reason: 'Android bytecode payload', pattern: /\.(?:dex|odex|vdex|smali)$/i },
  {
    reason: 'decompiler output',
    pattern: /(?:^|\/)(?:apktool(?:-output)?|decompiler(?:-output)?|ghidra|ida|jadx(?:-output)?)(?:\/|$)/i,
  },
  {
    reason: 'legacy runtime source',
    pattern: /(?:^|\/)(?:cocos2d-x(?:-2\.1\.4)?|cocos2dx|legacy-runtime)(?:\/|$)/i,
  },
  {
    reason: 'native bridge or emulation source',
    pattern: /(?:^|\/)(?:emulation[-_]?layer|jni|jsb|native[-_]?(?:compatibility[-_]?)?bridge)(?:\/|\.|$)/i,
  },
]);

const SOURCE_RULES: readonly Readonly<{ reason: string; pattern: RegExp }>[] = Object.freeze([
  { reason: 'original native library reference', pattern: /\blibgame\.so\b/i },
  { reason: 'legacy Cocos runtime reference', pattern: /\bcocos2d(?:-x|x|::)(?:\s*2\.1\.4)?\b/i },
  { reason: 'decompiler dependency', pattern: /\b(?:apktool|ghidra|jadx|decompiler[- ]output)\b/i },
  {
    reason: 'native bridge call',
    pattern: /\b(?:JNIEnv|JNIEXPORT|nativeSetApkPath|System\.loadLibrary|dlopen\s*\(|jsb\.reflection)\b/,
  },
  { reason: 'emulation or compatibility bridge', pattern: /\b(?:emulation[- ]layer|native[- ]compatibility[- ]bridge)\b/i },
]);

export function listTrackableGameFiles(repositoryRoot: string): readonly string[] {
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'game'],
    { cwd: repositoryRoot },
  );
  return Object.freeze(
    output.toString('utf8').split('\0').filter((path) => path.length > 0).sort(),
  );
}

export function isIgnoredCreatorCache(path: string): boolean {
  return IGNORED_CREATOR_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function inspectProhibitedPath(path: string): readonly SourceBoundaryFinding[] {
  return Object.freeze(PATH_RULES
    .filter((rule) => rule.pattern.test(path))
    .map((rule) => Object.freeze({ path, reason: rule.reason })));
}

export function inspectProhibitedSource(path: string, source: string): readonly SourceBoundaryFinding[] {
  return Object.freeze(SOURCE_RULES
    .filter((rule) => rule.pattern.test(source))
    .map((rule) => Object.freeze({ path, reason: rule.reason })));
}

export function auditTrackableGameBoundary(repositoryRoot: string): readonly SourceBoundaryFinding[] {
  const findings: SourceBoundaryFinding[] = [];
  for (const path of listTrackableGameFiles(repositoryRoot)) {
    findings.push(...inspectProhibitedPath(path));
    if (!TEXT_EXTENSIONS.has(extname(path).toLowerCase())) {
      continue;
    }
    findings.push(...inspectProhibitedSource(path, readFileSync(resolve(repositoryRoot, path), 'utf8')));
  }
  return Object.freeze(findings);
}
