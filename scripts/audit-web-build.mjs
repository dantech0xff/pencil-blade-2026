#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import { extname, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGINAL_APK_SHA256 = '95225733d46473f2b155737e8c83b567e028342257c747c0faac6ed4ab87e7aa';
const ORIGINAL_NATIVE_SHA256 = '55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e';

export const WEB_BUILD_LIMITS = Object.freeze({
  maxFiles: 50_000,
  maxFileBytes: 256 * 1024 * 1024,
  maxTotalBytes: 1024 * 1024 * 1024,
});

const MIME_TYPES = Object.freeze({
  '.aac': 'audio/aac',
  '.astc': 'application/octet-stream',
  '.atlas': 'text/plain; charset=utf-8',
  '.avif': 'image/avif',
  '.bin': 'application/octet-stream',
  '.bmp': 'image/bmp',
  '.ccon': 'application/json; charset=utf-8',
  '.cconb': 'application/octet-stream',
  '.css': 'text/css; charset=utf-8',
  '.eot': 'application/vnd.ms-fontobject',
  '.fnt': 'text/plain; charset=utf-8',
  '.frag': 'text/plain; charset=utf-8',
  '.gif': 'image/gif',
  '.glsl': 'text/plain; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ktx': 'image/ktx',
  '.ktx2': 'image/ktx2',
  '.m4a': 'audio/mp4',
  '.manifest': 'application/manifest+json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.otf': 'font/otf',
  '.pkm': 'application/octet-stream',
  '.plist': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.pvr': 'application/octet-stream',
  '.skel': 'application/octet-stream',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.tbin': 'application/octet-stream',
  '.tmx': 'application/xml; charset=utf-8',
  '.tsv': 'text/tab-separated-values; charset=utf-8',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.tsx': 'application/xml; charset=utf-8',
  '.vert': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
});

const TEXT_EXTENSIONS = new Set([
  '.atlas',
  '.ccon',
  '.css',
  '.fnt',
  '.frag',
  '.glsl',
  '.htm',
  '.html',
  '.js',
  '.json',
  '.manifest',
  '.mjs',
  '.plist',
  '.svg',
  '.tmx',
  '.tsv',
  '.tsx',
  '.txt',
  '.vert',
  '.xml',
]);

const PROHIBITED_FILE_EXTENSION = /\.(?:aab|apk|apks|app|bat|class|cmd|com|dex|dll|dylib|exe|jar|msi|o|obj|ps1|sh|so|xapk)$/iu;
const SOURCE_MAP_EXTENSION = /\.map$/iu;
const EVIDENCE_PATH_SEGMENT = /^(?:\.forensics-work|\.git|apktool(?:-output)?|decompiler(?:-output)?|docs?|evidence|fixtures?|forensics|ghidra|ida|jadx(?:-output)?|plans?|reference|reports?|tests?)$/iu;
const PRIVATE_ABSOLUTE_PATH = /(?:file:\/\/\/)?(?:\/Users\/[^/\s"'<>]+|\/home\/[^/\s"'<>]+|\/Volumes\/[^/\s"'<>]+|\/private\/(?:tmp|var)\/|[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"'<>]+)/iu;
const SOURCE_MAP_DIRECTIVE = /(?:\/\/[#@]\s*sourceMappingURL\s*=|\/\*[#@]\s*sourceMappingURL\s*=)/iu;
const BOX2D_PAYLOAD_MARKER = /\bSystem\.register\(\s*["']chunks:\/\/\/_virtual\/box2d(?:\.umd)?\.(?:m?js)["']/u;

const LEGACY_TEXT_RULES = Object.freeze([
  {
    reason: 'original native gameplay library reference',
    pattern: /\blibgame\.so\b/iu,
  },
  {
    reason: 'legacy Cocos2d-x 2.1.4 runtime reference',
    pattern: /\bcocos2d(?:-x|x)[^\n]{0,24}2\.1\.4\b/iu,
  },
  {
    reason: 'decompiler or reverse-engineering dependency',
    pattern: /\b(?:apktool|decompiler[- ]output|ghidra|jadx)\b/iu,
  },
  {
    reason: 'legacy native loading or bridge reference',
    pattern: /\b(?:JNIEnv|JNIEXPORT|nativeSetApkPath|jsb\.reflection)\b|dlopen\s*\(|System\.loadLibrary\s*\(\s*['"]game['"]/u,
  },
  {
    reason: 'native compatibility or emulation reference',
    pattern: /\b(?:emulation[- ]layer|native[- ]compatibility[- ]bridge)\b/iu,
  },
]);

const UNKNOWN_STATIC_VALUE = Symbol('unknown-static-value');
const STATIC_ANALYSIS_LIMITS = Object.freeze({
  maxBindings: 250_000,
  maxExpressionDepth: 32,
  maxObjectProperties: 256,
  maxStringLength: 64 * 1024,
  maxTemplateExpressions: 64,
  maxTokens: 2_000_000,
});
const CONTROL_FLOW_PARAMETER_PREFIXES = new Set([
  'for',
  'if',
  'switch',
  'while',
  'with',
]);

export function contentTypeForWebPath(relativePath) {
  return MIME_TYPES[extname(relativePath).toLowerCase()];
}

export function inspectWebBuildDirectory(buildDirectory, options = {}) {
  const limits = normalizeLimits(options.limits);
  const root = validateBuildRoot(buildDirectory);
  const findings = [];
  const files = [];
  const directories = [{ absolutePath: root, relativePath: '' }];
  let totalBytes = 0;

  while (directories.length > 0) {
    const directory = directories.pop();
    const entries = readdirSync(directory.absolutePath, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const relativePath = directory.relativePath.length === 0
        ? entry.name
        : `${directory.relativePath}/${entry.name}`;
      const absolutePath = resolve(directory.absolutePath, entry.name);
      assertContainedPath(root, absolutePath, relativePath);
      findings.push(...inspectRelativeBuildPath(relativePath));

      const entryStat = lstatSync(absolutePath);
      if (entryStat.isSymbolicLink()) {
        findings.push(finding(relativePath, 'symbolic links are prohibited in a web build'));
        continue;
      }
      if (entryStat.isDirectory()) {
        directories.push({ absolutePath, relativePath });
        continue;
      }
      if (!entryStat.isFile()) {
        findings.push(finding(relativePath, 'unsafe non-file filesystem entry'));
        continue;
      }

      if (files.length + 1 > limits.maxFiles) {
        throw new Error(`web build file count exceeds ${limits.maxFiles}`);
      }
      if (entryStat.size > limits.maxFileBytes) {
        throw new Error(`${relativePath} exceeds the ${limits.maxFileBytes}-byte file limit`);
      }
      totalBytes += entryStat.size;
      if (totalBytes > limits.maxTotalBytes) {
        throw new Error(`web build content exceeds ${limits.maxTotalBytes} bytes`);
      }

      const bytes = readFileSync(absolutePath);
      const file = Object.freeze({
        absolutePath,
        containsBox2dPayload: /\.(?:m?js)$/iu.test(relativePath)
          && BOX2D_PAYLOAD_MARKER.test(bytes.toString('utf8')),
        path: relativePath,
        sha256: sha256(bytes),
        size: entryStat.size,
      });
      files.push(file);
      findings.push(...inspectWebFile(file, bytes));
    }
  }

  findings.push(...inspectEssentialPayload(files));
  return Object.freeze({
    files: Object.freeze(files),
    findings: Object.freeze(findings),
    root,
    totalBytes,
  });
}

export function auditWebBuild(buildDirectory, options = {}) {
  return inspectWebBuildDirectory(buildDirectory, options).findings;
}

export function extractStaticWebReferences(sourcePath, source) {
  const extension = extname(sourcePath).toLowerCase();
  if (extension === '.html' || extension === '.htm' || extension === '.svg' || extension === '.xml') {
    return freezeReferences(extractMarkupReferences(sourcePath, source));
  }
  if (extension === '.css') {
    return freezeReferences(extractCssReferences(sourcePath, source));
  }
  if (extension === '.js' || extension === '.mjs') {
    return freezeReferences(extractJavaScriptReferences(sourcePath, source));
  }
  if (extension === '.json' || extension === '.manifest' || extension === '.ccon') {
    return freezeReferences(extractJsonReferences(sourcePath, source));
  }
  return Object.freeze([]);
}

export function inspectStaticWebReference(reference) {
  const value = decodeHtmlEntities(reference.value.trim());
  if (
    value.length === 0
    || value.startsWith('#')
    || /^(?:about:blank|blob:|data:|import:|mailto:|tel:)/iu.test(value)
  ) {
    return Object.freeze([]);
  }
  if (/^(?:https?|wss?):/iu.test(value) || value.startsWith('//')) {
    return Object.freeze([
      finding(reference.source, `off-origin URL is prohibited: ${value}`),
    ]);
  }
  if (/^file:/iu.test(value) || PRIVATE_ABSOLUTE_PATH.test(value)) {
    return Object.freeze([
      finding(reference.source, `private absolute path is prohibited: ${value}`),
    ]);
  }
  if (/^(?:javascript|vbscript):/iu.test(value)) {
    return Object.freeze([
      finding(reference.source, `unsafe URL scheme is prohibited: ${value}`),
    ]);
  }
  if (value.startsWith('/')) {
    return Object.freeze([
      finding(reference.source, `root-relative URL bypasses the Pages prefix: ${value}`),
    ]);
  }
  if (value.includes('\\')) {
    return Object.freeze([
      finding(reference.source, `unsafe backslash URL is prohibited: ${value}`),
    ]);
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(value.split(/[?#]/u, 1)[0]);
  } catch {
    return Object.freeze([
      finding(reference.source, `malformed percent-encoded URL is prohibited: ${value}`),
    ]);
  }
  if (decodedPath.includes('/') && decodedPath.split('/').some((segment) => segment === '..')) {
    const resolvedPath = posix.normalize(posix.join(referenceBasePath(reference), decodedPath));
    if (resolvedPath === '..' || resolvedPath.startsWith('../') || posix.isAbsolute(resolvedPath)) {
      return Object.freeze([
        finding(reference.source, `URL escapes the web build root: ${value}`),
      ]);
    }
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value) && !/^(?:cc|cce|db|import):/iu.test(value)) {
    return Object.freeze([
      finding(reference.source, `unsupported URL scheme is prohibited: ${value}`),
    ]);
  }
  return Object.freeze([]);
}

export function resolveStaticWebReference(reference) {
  const value = decodeHtmlEntities(reference.value.trim());
  if (
    value.length === 0
    || value.startsWith('#')
    || /^(?:about:blank|blob:|data:|import:|mailto:|tel:|cc:|cce:|db:)/iu.test(value)
    || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value)
    || value.startsWith('//')
  ) {
    return undefined;
  }
  const encodedPath = value.split(/[?#]/u, 1)[0];
  if (encodedPath.length === 0) {
    return undefined;
  }
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(encodedPath);
  } catch {
    throw new Error(`${reference.source} contains malformed URL encoding: ${value}`);
  }
  if (decodedPath.startsWith('/') || decodedPath.includes('\\')) {
    throw new Error(`${reference.source} contains an unsafe build URL: ${value}`);
  }

  const resolvedPath = posix.normalize(posix.join(referenceBasePath(reference), decodedPath));
  if (resolvedPath === '..' || resolvedPath.startsWith('../') || posix.isAbsolute(resolvedPath)) {
    throw new Error(`${reference.source} contains an escaping build URL: ${value}`);
  }
  if (!looksLikeLocalReference(decodedPath, reference.kind)) {
    return undefined;
  }
  return resolvedPath;
}

function referenceBasePath(reference) {
  return (
    reference.kind === 'javascript-document-path'
    || reference.kind === 'javascript-fetch'
    || reference.kind === 'json-document-path'
  )
    ? '.'
    : posix.dirname(reference.source);
}

function inspectWebFile(file, bytes) {
  const findings = [];
  const extension = extname(file.path).toLowerCase();

  if (SOURCE_MAP_EXTENSION.test(file.path)) {
    findings.push(finding(file.path, 'source-map files are prohibited'));
  }
  if (PROHIBITED_FILE_EXTENSION.test(file.path)) {
    findings.push(finding(file.path, 'native, application, or executable payload type is prohibited'));
  } else if (contentTypeForWebPath(file.path) === undefined) {
    findings.push(finding(file.path, 'unsupported static file type'));
  }
  if (file.sha256 === ORIGINAL_APK_SHA256) {
    findings.push(finding(file.path, 'file bytes match the original source APK'));
  }
  if (file.sha256 === ORIGINAL_NATIVE_SHA256) {
    findings.push(finding(file.path, 'file bytes match the original native gameplay library'));
  }
  if (isZip(bytes)) {
    findings.push(finding(file.path, 'ZIP or embedded application archive payload is prohibited'));
  }
  if (isElf(bytes)) {
    findings.push(finding(file.path, 'ELF or native shared-library payload is prohibited'));
  }
  if (isOtherExecutable(bytes)) {
    findings.push(finding(file.path, 'unexpected executable binary payload is prohibited'));
  }

  const binaryText = bytes.toString('latin1');
  findings.push(...inspectPrivateAndLegacyText(file.path, binaryText));

  if (TEXT_EXTENSIONS.has(extension)) {
    let source;
    try {
      source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      findings.push(finding(file.path, 'text payload is not valid UTF-8'));
      return findings;
    }
    if (SOURCE_MAP_DIRECTIVE.test(source)) {
      findings.push(finding(file.path, 'source-map reference is prohibited'));
    }
    if (
      (extension === '.json' || extension === '.manifest' || extension === '.ccon')
      && !isValidJson(source)
    ) {
      findings.push(finding(file.path, 'JSON payload is malformed'));
    }
    if (isSourceMapJson(extension, source)) {
      findings.push(finding(file.path, 'source-map JSON payload is prohibited'));
    }
    for (const reference of extractStaticWebReferences(file.path, source)) {
      findings.push(...inspectStaticWebReference(reference));
    }
  }

  return findings;
}

function inspectRelativeBuildPath(relativePath) {
  const findings = [];
  const segments = relativePath.split('/');
  if (segments.some(isUnsafePathSegment)) {
    findings.push(finding(relativePath, 'unsafe or path-escaping web build entry'));
  }
  if (segments.some((segment) => EVIDENCE_PATH_SEGMENT.test(segment))) {
    findings.push(finding(relativePath, 'private evidence or development-only path is prohibited'));
  }
  return findings;
}

function inspectPrivateAndLegacyText(relativePath, source) {
  const findings = [];
  if (PRIVATE_ABSOLUTE_PATH.test(source)) {
    findings.push(finding(relativePath, 'private machine-local absolute path is prohibited'));
  }
  for (const rule of LEGACY_TEXT_RULES) {
    if (rule.pattern.test(source)) {
      findings.push(finding(relativePath, rule.reason));
    }
  }
  return findings;
}

function inspectEssentialPayload(files) {
  const findings = [];
  const requirements = [
    {
      matches: (file) => file.path === 'index.html',
      reason: 'required root index.html is missing',
    },
    {
      matches: (file) => /^index(?:[.-][A-Za-z0-9_-]+)?\.(?:m?js)$/u.test(file.path),
      reason: 'required Cocos bootstrap script is missing',
    },
    {
      matches: (file) => /^(?:src\/)?application(?:[.-][A-Za-z0-9_-]+)?\.(?:m?js)$/u.test(file.path),
      reason: 'required Cocos application launcher is missing',
    },
    {
      matches: (file) => /^src\/settings(?:[.-][A-Za-z0-9_-]+)?\.json$/u.test(file.path),
      reason: 'required Cocos settings payload is missing',
    },
    {
      matches: (file) => /^cocos-js\/cc(?:[.-][A-Za-z0-9_-]+)?\.(?:m?js)$/u.test(file.path),
      reason: 'required Cocos engine JavaScript payload is missing',
    },
    {
      matches: (file) => /^assets\/game\/config(?:[.-][A-Za-z0-9_-]+)?\.json$/u.test(file.path),
      reason: 'required game Asset Bundle configuration is missing',
    },
    {
      matches: (file) => /^assets\/game\/index(?:[.-][A-Za-z0-9_-]+)?\.(?:m?js)$/u.test(file.path),
      reason: 'required game Asset Bundle script is missing',
    },
    {
      matches: (file) => file.containsBox2dPayload,
      reason: 'required Creator Box2D JavaScript payload is missing',
    },
  ];
  for (const requirement of requirements) {
    if (!files.some(requirement.matches)) {
      findings.push(finding('.', requirement.reason));
    }
  }
  return findings;
}

function extractMarkupReferences(sourcePath, source) {
  const references = [];
  const markup = source.replace(/<!--[\s\S]*?-->/gu, '');
  const attributePattern = /\b(src|href|poster|data-src|data-href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/giu;
  for (const match of markup.matchAll(attributePattern)) {
    const context = markupAttributeContext(markup, match.index);
    if (context === undefined) {
      continue;
    }
    const attribute = match[1].toLowerCase();
    addReference(
      references,
      sourcePath,
      match[2] ?? match[3] ?? match[4],
      `markup-${attribute}`,
      {
        attribute,
        element: context.element,
        ...(context.rel === undefined ? {} : { rel: context.rel }),
      },
    );
  }
  const srcsetPattern = /\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/giu;
  for (const match of markup.matchAll(srcsetPattern)) {
    const context = markupAttributeContext(markup, match.index);
    if (context === undefined) {
      continue;
    }
    for (const candidate of (match[1] ?? match[2]).split(',')) {
      addReference(
        references,
        sourcePath,
        candidate.trim().split(/\s+/u, 1)[0],
        'markup-srcset',
        {
          attribute: 'srcset',
          element: context.element,
          ...(context.rel === undefined ? {} : { rel: context.rel }),
        },
      );
    }
  }
  for (const match of markup.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/giu)) {
    references.push(...extractCssReferences(sourcePath, match[1]));
  }
  for (const match of markup.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)) {
    if (/\bsrc\s*=/iu.test(match[1])) {
      continue;
    }
    if (/\btype\s*=\s*(?:"application\/json"|'application\/json'|"importmap"|'importmap')/iu.test(match[1])) {
      references.push(...extractJsonReferences(sourcePath, match[2]));
    } else {
      references.push(...extractJavaScriptReferences(sourcePath, match[2]));
    }
  }
  return references;
}

function markupAttributeContext(source, attributeIndex) {
  const openingBracket = source.lastIndexOf('<', attributeIndex);
  if (openingBracket < 0) {
    return undefined;
  }
  const closingBracket = source.indexOf('>', openingBracket + 1);
  if (closingBracket < attributeIndex) {
    return undefined;
  }
  const tagSource = source.slice(openingBracket, closingBracket + 1);
  const elementMatch = /^<\s*([A-Za-z][A-Za-z0-9:-]*)\b/u.exec(tagSource);
  if (elementMatch === null) {
    return undefined;
  }
  const relMatch =
    /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu.exec(tagSource);
  return {
    element: elementMatch[1].toLowerCase(),
    rel: relMatch === null
      ? undefined
      : (relMatch[1] ?? relMatch[2] ?? relMatch[3]).trim().toLowerCase(),
  };
}

function extractCssReferences(sourcePath, source) {
  const references = [];
  const css = source.replace(/\/\*[\s\S]*?\*\//gu, '');
  for (const match of css.matchAll(/\burl\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]+))\s*\)/giu)) {
    addReference(references, sourcePath, match[1] ?? match[2] ?? match[3], 'css-url');
  }
  for (const match of css.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/giu)) {
    addReference(references, sourcePath, match[1] ?? match[2], 'css-import');
  }
  return references;
}

function extractJavaScriptReferences(sourcePath, source) {
  const references = extractResolvedJavaScriptSinkReferences(sourcePath, source);
  const javascript = stripJavaScriptComments(source);
  const patterns = [
    ['javascript-import', /\bimport\s*\(\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)\s*\)/gu],
    ['javascript-import', /\b(?:import|export)\s+(?:[\s\S]*?\sfrom\s*)?(?:"([^"]*)"|'([^']*)')/gu],
    ['javascript-loader', /\b(?:System\.import|importScripts)\s*\(\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)/gu],
    ['javascript-fetch', /\bfetch\s*\(\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)/gu],
    ['javascript-url', /\bnew\s+(?:SharedWorker|URL|Worker)\s*\(\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)/gu],
    ['javascript-network', /\bnew\s+(?:EventSource|Request|WebSocket)\s*\(\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)/gu],
    ['javascript-network', /\b(?:navigator\.)?sendBeacon\s*\(\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)/gu],
    ['javascript-network', /\b(?:globalThis\.open|location\.(?:assign|replace)|window\.open)\s*\(\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)/gu],
    ['javascript-network', /\b(?:XMLHttpRequest\.prototype\.open|[A-Za-z_$][\w$]*\.open)\s*\(\s*(?:"[^"]*"|'[^']*'|`[^`$]*`)\s*,\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)/gu],
    ['javascript-import', /\(\s*(?:"default"|'default')\s*,\s*(?:"([^"]+\.wasm)"|'([^']+\.wasm)'|`([^`$]+\.wasm)`)\s*\)/gu],
    ['javascript-document-path', /\b(?:assetUrl|href|settingsPath|src|url|wasmPath)\s*[:=]\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)/gu],
  ];
  for (const [kind, pattern] of patterns) {
    for (const match of javascript.matchAll(pattern)) {
      addReference(references, sourcePath, firstCapture(match), kind);
    }
  }
  const systemRegister = javascript.match(/^\s*System\.register\s*\(\s*\[([\s\S]*?)\]\s*,/u);
  if (systemRegister !== null) {
    for (const dependency of systemRegister[1].matchAll(/"([^"]*)"|'([^']*)'/gu)) {
      addReference(references, sourcePath, dependency[1] ?? dependency[2], 'javascript-import');
    }
  }
  return references;
}

function extractResolvedJavaScriptSinkReferences(sourcePath, source) {
  const tokens = tokenizeJavaScript(source);
  const pairs = buildTokenPairs(tokens);
  const loopScopeEvents = buildLoopScopeEvents(tokens, pairs);
  const scopes = [new Map()];
  const references = [];
  const state = { bindings: 0, declarationAssignments: new Set() };

  for (let index = 0; index < tokens.length; index += 1) {
    for (let count = 0; count < (loopScopeEvents.ends.get(index) ?? 0); count += 1) {
      if (scopes.length > 1) {
        scopes.pop();
      }
    }
    for (let count = 0; count < (loopScopeEvents.starts.get(index) ?? 0); count += 1) {
      scopes.push(new Map());
    }
    const token = tokens[index];
    if (token.value === '{') {
      const scope = new Map();
      for (const name of parameterNamesForBody(tokens, index, pairs)) {
        scope.set(name, UNKNOWN_STATIC_VALUE);
      }
      scopes.push(scope);
      continue;
    }
    if (token.value === '}') {
      if (scopes.length > 1) {
        scopes.pop();
      }
      continue;
    }
    if (token.type !== 'identifier') {
      continue;
    }

    if (token.value === 'const' || token.value === 'let' || token.value === 'var') {
      registerStaticDeclarations(tokens, index, scopes, pairs, state);
      continue;
    }

    const call = staticSinkCallAt(tokens, index, pairs);
    if (call !== undefined) {
      for (const argumentIndex of call.argumentIndexes) {
        const range = call.arguments[argumentIndex];
        if (range === undefined) {
          continue;
        }
        const value = resolveStaticExpression(
          tokens,
          range.start,
          range.end,
          scopes,
          pairs,
          0,
        );
        if (typeof value === 'string') {
          addReference(references, sourcePath, value, call.kind);
        }
      }
    }

    if (state.declarationAssignments.has(index)) {
      continue;
    }
    const assignment = staticAssignmentAt(tokens, index, pairs);
    if (assignment === undefined) {
      continue;
    }
    const value = resolveStaticExpression(
      tokens,
      assignment.valueRange.start,
      assignment.valueRange.end,
      scopes,
      pairs,
      0,
    );
    if (assignment.navigation && typeof value === 'string') {
      addReference(references, sourcePath, value, 'javascript-network');
    }
    updateStaticAssignment(scopes, assignment.path, value);
  }

  return references;
}

function tokenizeJavaScript(source) {
  const tokens = [];
  let index = 0;
  let lineBreakBefore = false;
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (/\s/u.test(character)) {
      lineBreakBefore ||= character === '\n' || character === '\r';
      index += 1;
      continue;
    }
    if (character === '/' && next === '/') {
      index += 2;
      while (index < source.length && source[index] !== '\n' && source[index] !== '\r') {
        index += 1;
      }
      continue;
    }
    if (character === '/' && next === '*') {
      const commentStart = index;
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        index += 1;
      }
      lineBreakBefore ||= /[\r\n]/u.test(source.slice(commentStart, index));
      index = Math.min(source.length, index + 2);
      continue;
    }
    if (character === '"' || character === "'") {
      const end = scanQuotedLiteral(source, index);
      const raw = source.slice(index + 1, Math.max(index + 1, end - 1));
      tokens.push({
        lineBreakBefore,
        type: 'string',
        value: end <= source.length && source[end - 1] === character
          ? decodeJavaScriptEscapes(raw)
          : undefined,
      });
      lineBreakBefore = false;
      index = end;
      assertTokenBudget(tokens);
      continue;
    }
    if (character === '`') {
      const end = scanTemplateLiteral(source, index);
      tokens.push({
        lineBreakBefore,
        raw: source.slice(index, end),
        type: 'template',
        value: undefined,
      });
      lineBreakBefore = false;
      index = end;
      assertTokenBudget(tokens);
      continue;
    }
    if (isIdentifierStart(character)) {
      const start = index;
      index += 1;
      while (index < source.length && isIdentifierPart(source[index])) {
        index += 1;
      }
      tokens.push({
        lineBreakBefore,
        type: 'identifier',
        value: source.slice(start, index),
      });
      lineBreakBefore = false;
      assertTokenBudget(tokens);
      continue;
    }
    if (/[0-9]/u.test(character) || (character === '.' && /[0-9]/u.test(next ?? ''))) {
      const start = index;
      index += 1;
      while (index < source.length && /[A-Za-z0-9_.]/u.test(source[index])) {
        index += 1;
      }
      const raw = source.slice(start, index);
      const value = Number(raw.replaceAll('_', ''));
      tokens.push({
        lineBreakBefore,
        type: 'number',
        value: Number.isFinite(value) ? value : undefined,
      });
      lineBreakBefore = false;
      assertTokenBudget(tokens);
      continue;
    }
    if (character === '/' && canStartRegularExpression(tokens)) {
      const end = scanRegularExpression(source, index);
      if (end > index + 1) {
        tokens.push({ lineBreakBefore, type: 'regex', value: undefined });
        lineBreakBefore = false;
        index = end;
        assertTokenBudget(tokens);
        continue;
      }
    }

    const punctuator = longestJavaScriptPunctuator(source, index);
    tokens.push({ lineBreakBefore, type: 'punctuator', value: punctuator });
    lineBreakBefore = false;
    index += punctuator.length;
    assertTokenBudget(tokens);
  }
  return tokens;
}

function assertTokenBudget(tokens) {
  if (tokens.length > STATIC_ANALYSIS_LIMITS.maxTokens) {
    throw new Error(
      `JavaScript static analysis exceeds ${STATIC_ANALYSIS_LIMITS.maxTokens} tokens`,
    );
  }
}

function scanQuotedLiteral(source, start) {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === '\\') {
      index += source[index + 1] === '\r' && source[index + 2] === '\n' ? 3 : 2;
      continue;
    }
    if (source[index] === quote) {
      return index + 1;
    }
    if (source[index] === '\n' || source[index] === '\r') {
      return index;
    }
    index += 1;
  }
  return source.length;
}

function scanTemplateLiteral(source, start) {
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2;
      continue;
    }
    if (source[index] === '`') {
      return index + 1;
    }
    if (source[index] === '$' && source[index + 1] === '{') {
      index = scanTemplateExpression(source, index + 2);
      continue;
    }
    index += 1;
  }
  return source.length;
}

function scanTemplateExpression(source, start) {
  let depth = 1;
  let index = start;
  let canStartRegex = true;
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      index = scanQuotedLiteral(source, index);
      canStartRegex = false;
      continue;
    }
    if (character === '`') {
      index = scanTemplateLiteral(source, index);
      canStartRegex = false;
      continue;
    }
    if (character === '/' && next === '/') {
      index += 2;
      while (index < source.length && source[index] !== '\n' && source[index] !== '\r') {
        index += 1;
      }
      continue;
    }
    if (character === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        index += 1;
      }
      index = Math.min(source.length, index + 2);
      continue;
    }
    if (character === '/' && canStartRegex) {
      const end = scanRegularExpression(source, index);
      if (end > index + 1) {
        index = end;
        canStartRegex = false;
        continue;
      }
    }
    if (character === '{') {
      depth += 1;
      canStartRegex = true;
      index += 1;
      continue;
    }
    if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
      canStartRegex = false;
      index += 1;
      continue;
    }
    if (isIdentifierStart(character)) {
      const identifierStart = index;
      index += 1;
      while (index < source.length && isIdentifierPart(source[index])) {
        index += 1;
      }
      canStartRegex = /^(?:await|case|delete|do|else|in|instanceof|new|of|return|throw|typeof|void|yield)$/u
        .test(source.slice(identifierStart, index));
      continue;
    }
    if (/[0-9]/u.test(character)) {
      index += 1;
      while (index < source.length && /[A-Za-z0-9_.]/u.test(source[index])) {
        index += 1;
      }
      canStartRegex = false;
      continue;
    }
    canStartRegex = !/[)\]]/u.test(character);
    index += 1;
  }
  return source.length;
}

function scanRegularExpression(source, start) {
  let index = start + 1;
  let inCharacterClass = false;
  while (index < source.length) {
    const character = source[index];
    if (character === '\\') {
      index += 2;
      continue;
    }
    if (character === '\n' || character === '\r') {
      return start + 1;
    }
    if (character === '[') {
      inCharacterClass = true;
    } else if (character === ']') {
      inCharacterClass = false;
    } else if (character === '/' && !inCharacterClass) {
      index += 1;
      while (index < source.length && /[A-Za-z]/u.test(source[index])) {
        index += 1;
      }
      return index;
    }
    index += 1;
  }
  return start + 1;
}

function canStartRegularExpression(tokens) {
  const previous = tokens.at(-1);
  if (previous === undefined) {
    return true;
  }
  if (
    previous.type === 'string'
    || previous.type === 'number'
    || previous.type === 'template'
    || previous.type === 'regex'
    || previous.value === ')'
    || previous.value === ']'
    || previous.value === '++'
    || previous.value === '--'
  ) {
    return false;
  }
  if (previous.type !== 'identifier') {
    return true;
  }
  return /^(?:await|case|delete|do|else|in|instanceof|new|of|return|throw|typeof|void|yield)$/u
    .test(previous.value);
}

function longestJavaScriptPunctuator(source, index) {
  for (const punctuator of [
    '>>>=',
    '===',
    '!==',
    '>>>',
    '**=',
    '&&=',
    '||=',
    '??=',
    '=>',
    '==',
    '!=',
    '<=',
    '>=',
    '++',
    '--',
    '&&',
    '||',
    '??',
    '?.',
    '**',
    '<<',
    '>>',
    '+=',
    '-=',
    '*=',
    '/=',
    '%=',
    '&=',
    '|=',
    '^=',
    '...',
  ]) {
    if (source.startsWith(punctuator, index)) {
      return punctuator;
    }
  }
  return source[index];
}

function isIdentifierStart(character) {
  return character !== undefined && /[A-Za-z_$]/u.test(character);
}

function isIdentifierPart(character) {
  return character !== undefined && /[A-Za-z0-9_$]/u.test(character);
}

function buildTokenPairs(tokens) {
  const pairs = new Map();
  const stacks = new Map([
    ['(', []],
    ['[', []],
    ['{', []],
  ]);
  const openForClose = new Map([
    [')', '('],
    [']', '['],
    ['}', '{'],
  ]);
  for (let index = 0; index < tokens.length; index += 1) {
    const value = tokens[index].value;
    if (stacks.has(value)) {
      stacks.get(value).push(index);
      continue;
    }
    const open = openForClose.get(value);
    if (open === undefined) {
      continue;
    }
    const start = stacks.get(open).pop();
    if (start !== undefined) {
      pairs.set(start, index);
      pairs.set(index, start);
    }
  }
  return pairs;
}

function buildLoopScopeEvents(tokens, pairs) {
  const starts = new Map();
  const ends = new Map();
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== 'for') {
      continue;
    }
    const open = tokens[index + 1]?.value === 'await'
      ? index + 2
      : index + 1;
    if (tokens[open]?.value !== '(') {
      continue;
    }
    const close = pairs.get(open);
    if (close === undefined) {
      continue;
    }
    const bodyStart = close + 1;
    let end = bodyStart;
    if (tokens[bodyStart]?.value === '{') {
      const bodyClose = pairs.get(bodyStart);
      end = bodyClose === undefined ? tokens.length : bodyClose + 1;
    } else {
      end = findJavaScriptStatementEnd(tokens, bodyStart, pairs);
    }
    starts.set(open + 1, (starts.get(open + 1) ?? 0) + 1);
    ends.set(end, (ends.get(end) ?? 0) + 1);
  }
  return { ends, starts };
}

function findJavaScriptStatementEnd(tokens, start, pairs) {
  if (start >= tokens.length) {
    return tokens.length;
  }
  if (tokens[start].value === ';') {
    return start + 1;
  }
  if (tokens[start].value === '{') {
    return (pairs.get(start) ?? tokens.length - 1) + 1;
  }
  if (tokens[start].type === 'identifier' && tokens[start + 1]?.value === ':') {
    return findJavaScriptStatementEnd(tokens, start + 2, pairs);
  }

  const keyword = tokens[start].value;
  if (keyword === 'if') {
    const conditionEnd = matchingControlHeaderEnd(tokens, start + 1, pairs);
    let end = findJavaScriptStatementEnd(tokens, conditionEnd, pairs);
    if (tokens[end]?.value === 'else') {
      end = findJavaScriptStatementEnd(tokens, end + 1, pairs);
    }
    return end;
  }
  if (keyword === 'for' || keyword === 'while' || keyword === 'with') {
    const headerStart = keyword === 'for' && tokens[start + 1]?.value === 'await'
      ? start + 2
      : start + 1;
    return findJavaScriptStatementEnd(
      tokens,
      matchingControlHeaderEnd(tokens, headerStart, pairs),
      pairs,
    );
  }
  if (keyword === 'switch') {
    const bodyStart = matchingControlHeaderEnd(tokens, start + 1, pairs);
    return tokens[bodyStart]?.value === '{'
      ? (pairs.get(bodyStart) ?? tokens.length - 1) + 1
      : bodyStart;
  }
  if (keyword === 'do') {
    let end = findJavaScriptStatementEnd(tokens, start + 1, pairs);
    if (tokens[end]?.value === 'while') {
      end = matchingControlHeaderEnd(tokens, end + 1, pairs);
      if (tokens[end]?.value === ';') {
        end += 1;
      }
    }
    return end;
  }
  if (keyword === 'try') {
    let end = findJavaScriptStatementEnd(tokens, start + 1, pairs);
    if (tokens[end]?.value === 'catch') {
      const catchBody = tokens[end + 1]?.value === '('
        ? matchingControlHeaderEnd(tokens, end + 1, pairs)
        : end + 1;
      end = findJavaScriptStatementEnd(tokens, catchBody, pairs);
    }
    if (tokens[end]?.value === 'finally') {
      end = findJavaScriptStatementEnd(tokens, end + 1, pairs);
    }
    return end;
  }

  const end = findStaticExpressionEnd(
    tokens,
    start,
    pairs,
    new Set([';']),
    true,
  );
  return tokens[end]?.value === ';' ? end + 1 : end;
}

function matchingControlHeaderEnd(tokens, start, pairs) {
  if (tokens[start]?.value !== '(') {
    return start;
  }
  const close = pairs.get(start);
  return close === undefined ? tokens.length : close + 1;
}

function parameterNamesForBody(tokens, bodyIndex, pairs) {
  const previous = tokens[bodyIndex - 1];
  if (previous === undefined) {
    return [];
  }
  if (previous.value === '=>') {
    if (tokens[bodyIndex - 2]?.value === ')') {
      const open = pairs.get(bodyIndex - 2);
      return open === undefined ? [] : simpleParameterNames(tokens, open + 1, bodyIndex - 2);
    }
    return tokens[bodyIndex - 2]?.type === 'identifier'
      ? [tokens[bodyIndex - 2].value]
      : [];
  }
  if (previous.value !== ')') {
    return [];
  }
  const open = pairs.get(bodyIndex - 1);
  if (open === undefined) {
    return [];
  }
  const prefix = tokens[open - 1]?.value;
  if (CONTROL_FLOW_PARAMETER_PREFIXES.has(prefix)) {
    return [];
  }
  if (prefix === 'catch') {
    return simpleParameterNames(tokens, open + 1, bodyIndex - 1);
  }
  if (
    prefix === 'function'
    || tokens[open - 2]?.value === 'function'
    || tokens[open - 1]?.type === 'identifier'
  ) {
    return simpleParameterNames(tokens, open + 1, bodyIndex - 1);
  }
  return [];
}

function simpleParameterNames(tokens, start, end) {
  const names = [];
  for (let index = start; index < end; index += 1) {
    if (
      tokens[index].type === 'identifier'
      && tokens[index - 1]?.value !== '.'
      && tokens[index + 1]?.value !== ':'
    ) {
      names.push(tokens[index].value);
    }
  }
  return names;
}

function registerStaticDeclarations(tokens, declarationIndex, scopes, pairs, state) {
  const declarationKind = tokens[declarationIndex].value;
  let index = declarationIndex + 1;
  while (index < tokens.length) {
    if (tokens[index].type !== 'identifier') {
      return;
    }
    const name = tokens[index].value;
    state.declarationAssignments.add(index);
    let value = UNKNOWN_STATIC_VALUE;
    index += 1;
    if (tokens[index]?.value === '=') {
      const end = findStaticExpressionEnd(
        tokens,
        index + 1,
        pairs,
        new Set([',', ';']),
        true,
      );
      if (declarationKind === 'const') {
        value = resolveStaticExpression(tokens, index + 1, end, scopes, pairs, 0);
      }
      index = end;
    }
    scopes.at(-1).set(name, value);
    state.bindings += 1;
    if (state.bindings > STATIC_ANALYSIS_LIMITS.maxBindings) {
      throw new Error(
        `JavaScript static analysis exceeds ${STATIC_ANALYSIS_LIMITS.maxBindings} bindings`,
      );
    }
    if (tokens[index]?.value !== ',') {
      return;
    }
    index += 1;
  }
}

function staticSinkCallAt(tokens, index, pairs) {
  const isNew = tokens[index].value === 'new';
  const path = readMemberPath(tokens, isNew ? index + 1 : index, pairs);
  if (path === undefined || tokens[path.end]?.value !== '(') {
    return undefined;
  }
  const close = pairs.get(path.end);
  if (close === undefined) {
    return undefined;
  }
  const call = classifyStaticSink(path.names, isNew);
  if (call === undefined) {
    return undefined;
  }
  return {
    argumentIndexes: call.argumentIndexes,
    arguments: splitCallArguments(tokens, path.end + 1, close, pairs),
    kind: call.kind,
  };
}

function classifyStaticSink(path, isNew) {
  const name = path.at(-1);
  if (name === 'fetch' && !isNew) {
    return { argumentIndexes: [0], kind: 'javascript-fetch' };
  }
  if (isNew && /^(?:EventSource|Request|WebSocket)$/u.test(name)) {
    return { argumentIndexes: [0], kind: 'javascript-network' };
  }
  if (isNew && /^(?:SharedWorker|URL|Worker)$/u.test(name)) {
    return { argumentIndexes: [0], kind: 'javascript-url' };
  }
  if (name === 'sendBeacon' && !isNew) {
    return { argumentIndexes: [0], kind: 'javascript-network' };
  }
  if (name === 'importScripts' && !isNew) {
    return {
      argumentIndexes: Array.from({ length: 64 }, (_, index) => index),
      kind: 'javascript-loader',
    };
  }
  if (
    !isNew
    && (
      (path.length === 1 && name === 'import')
      || (path.length === 2 && path[0] === 'System' && name === 'import')
    )
  ) {
    return {
      argumentIndexes: [0],
      kind: path.length === 1 ? 'javascript-import' : 'javascript-loader',
    };
  }
  if (
    !isNew
    && /^(?:assign|replace)$/u.test(name)
    && path.includes('location')
  ) {
    return { argumentIndexes: [0], kind: 'javascript-network' };
  }
  if (!isNew && name === 'navigate' && path.includes('navigation')) {
    return { argumentIndexes: [0], kind: 'javascript-network' };
  }
  if (
    !isNew
    && /^(?:pushState|replaceState)$/u.test(name)
    && path.includes('history')
  ) {
    return { argumentIndexes: [2], kind: 'javascript-network' };
  }
  if (name === 'open' && !isNew) {
    const isNavigation = path.length === 1
      || /^(?:globalThis|parent|self|top|window)$/u.test(path[0]);
    return {
      argumentIndexes: [isNavigation ? 0 : 1],
      kind: 'javascript-network',
    };
  }
  return undefined;
}

function splitCallArguments(tokens, start, end, pairs) {
  const argumentsList = [];
  let argumentStart = start;
  let index = start;
  while (index < end) {
    const pair = pairs.get(index);
    if (pair !== undefined && pair > index && pair < end) {
      index = pair + 1;
      continue;
    }
    if (tokens[index].value === ',') {
      argumentsList.push({ end: index, start: argumentStart });
      argumentStart = index + 1;
    }
    index += 1;
  }
  if (argumentStart < end) {
    argumentsList.push({ end, start: argumentStart });
  }
  return argumentsList;
}

function staticAssignmentAt(tokens, index, pairs) {
  const path = readMemberPath(tokens, index, pairs);
  if (path === undefined || tokens[path.end]?.value !== '=') {
    return undefined;
  }
  const valueStart = path.end + 1;
  const valueEnd = findStaticExpressionEnd(
    tokens,
    valueStart,
    pairs,
    new Set([',', ';']),
  );
  return {
    navigation: isNavigationAssignmentPath(path.names),
    path: path.names,
    valueRange: { end: valueEnd, start: valueStart },
  };
}

function isNavigationAssignmentPath(path) {
  if (path.length === 1 && path[0] === 'location') {
    return true;
  }
  if (!path.includes('location')) {
    return false;
  }
  return path.at(-1) === 'href' || path.at(-1) === 'location';
}

function updateStaticAssignment(scopes, path, value) {
  if (path.length === 1) {
    for (let index = scopes.length - 1; index >= 0; index -= 1) {
      if (scopes[index].has(path[0])) {
        scopes[index].set(path[0], UNKNOWN_STATIC_VALUE);
        return;
      }
    }
    return;
  }
  const base = lookupStaticBinding(scopes, path[0]);
  if (!isStaticObject(base)) {
    return;
  }
  let object = base;
  for (let index = 1; index < path.length - 1; index += 1) {
    const child = object.properties.get(path[index]);
    if (!isStaticObject(child)) {
      return;
    }
    object = child;
  }
  object.properties.set(path.at(-1), value);
}

function readMemberPath(tokens, start, pairs) {
  if (tokens[start]?.type !== 'identifier') {
    return undefined;
  }
  const names = [tokens[start].value];
  let index = start + 1;
  while (index < tokens.length) {
    if (
      (tokens[index].value === '.' || tokens[index].value === '?.')
      && tokens[index + 1]?.type === 'identifier'
    ) {
      names.push(tokens[index + 1].value);
      index += 2;
      continue;
    }
    if (tokens[index].value === '[') {
      const close = pairs.get(index);
      if (close === undefined) {
        break;
      }
      const property = tokens[index + 1];
      if (
        close === index + 2
        && (property?.type === 'string' || property?.type === 'number')
        && property.value !== undefined
      ) {
        names.push(String(property.value));
        index = close + 1;
        continue;
      }
    }
    break;
  }
  return { end: index, names };
}

function findStaticExpressionEnd(tokens, start, pairs, delimiters, stopAtLineBreak = false) {
  let index = start;
  while (index < tokens.length) {
    if (
      stopAtLineBreak
      && index > start
      && tokens[index].lineBreakBefore
      && canEndStaticExpression(tokens[index - 1])
      && canStartJavaScriptStatement(tokens[index])
    ) {
      return index;
    }
    const pair = pairs.get(index);
    if (pair !== undefined && pair > index) {
      index = pair + 1;
      continue;
    }
    if (
      delimiters.has(tokens[index].value)
      || tokens[index].value === ')'
      || tokens[index].value === ']'
      || tokens[index].value === '}'
    ) {
      return index;
    }
    index += 1;
  }
  return index;
}

function canEndStaticExpression(token) {
  return token !== undefined && (
    token.type === 'identifier'
    || token.type === 'number'
    || token.type === 'regex'
    || token.type === 'string'
    || token.type === 'template'
    || token.value === ')'
    || token.value === ']'
    || token.value === '}'
    || token.value === '++'
    || token.value === '--'
  );
}

function canStartJavaScriptStatement(token) {
  return token !== undefined && (
    token.type === 'identifier'
    || token.type === 'number'
    || token.type === 'regex'
    || token.type === 'string'
    || token.type === 'template'
    || token.value === '{'
  );
}

function resolveStaticExpression(tokens, start, end, scopes, pairs, depth) {
  if (depth > STATIC_ANALYSIS_LIMITS.maxExpressionDepth || start >= end) {
    return UNKNOWN_STATIC_VALUE;
  }
  const primary = resolveStaticPrimary(tokens, start, end, scopes, pairs, depth + 1);
  if (primary === undefined) {
    return UNKNOWN_STATIC_VALUE;
  }
  let value = primary.value;
  let index = primary.end;
  while (index < end) {
    if (tokens[index].value !== '+') {
      return UNKNOWN_STATIC_VALUE;
    }
    const right = resolveStaticPrimary(tokens, index + 1, end, scopes, pairs, depth + 1);
    if (right === undefined || !isStaticPrimitive(value) || !isStaticPrimitive(right.value)) {
      return UNKNOWN_STATIC_VALUE;
    }
    if (typeof value === 'number' && typeof right.value === 'number') {
      value += right.value;
    } else {
      value = `${value}${right.value}`;
      if (value.length > STATIC_ANALYSIS_LIMITS.maxStringLength) {
        return UNKNOWN_STATIC_VALUE;
      }
    }
    index = right.end;
  }
  return value;
}

function resolveStaticPrimary(tokens, start, end, scopes, pairs, depth) {
  const token = tokens[start];
  if (token === undefined || depth > STATIC_ANALYSIS_LIMITS.maxExpressionDepth) {
    return undefined;
  }
  if (token.type === 'string' || token.type === 'number') {
    return token.value === undefined ? undefined : { end: start + 1, value: token.value };
  }
  if (token.type === 'template') {
    const value = resolveStaticTemplate(token.raw, scopes, depth + 1);
    return value === UNKNOWN_STATIC_VALUE ? undefined : { end: start + 1, value };
  }
  if (token.value === '(') {
    const close = pairs.get(start);
    if (close === undefined || close >= end) {
      return undefined;
    }
    const value = resolveStaticExpression(tokens, start + 1, close, scopes, pairs, depth + 1);
    return value === UNKNOWN_STATIC_VALUE ? undefined : { end: close + 1, value };
  }
  if (token.value === '{') {
    return resolveStaticObject(tokens, start, end, scopes, pairs, depth + 1);
  }
  if (token.type === 'identifier') {
    const path = readMemberPath(tokens, start, pairs);
    let value = lookupStaticBinding(scopes, path.names[0]);
    for (const property of path.names.slice(1)) {
      if (!isStaticObject(value) || !value.properties.has(property)) {
        return undefined;
      }
      value = value.properties.get(property);
    }
    return value === UNKNOWN_STATIC_VALUE ? undefined : { end: path.end, value };
  }
  return undefined;
}

function resolveStaticObject(tokens, start, end, scopes, pairs, depth) {
  const close = pairs.get(start);
  if (close === undefined || close >= end) {
    return undefined;
  }
  const properties = new Map();
  let index = start + 1;
  while (index < close) {
    if (tokens[index].value === ',') {
      index += 1;
      continue;
    }
    if (properties.size >= STATIC_ANALYSIS_LIMITS.maxObjectProperties) {
      return undefined;
    }
    const keyToken = tokens[index];
    if (
      keyToken.type !== 'identifier'
      && keyToken.type !== 'string'
      && keyToken.type !== 'number'
    ) {
      return undefined;
    }
    if (keyToken.value === undefined) {
      return undefined;
    }
    const key = String(keyToken.value);
    index += 1;
    if (tokens[index]?.value === ':') {
      const valueEnd = findStaticExpressionEnd(
        tokens,
        index + 1,
        pairs,
        new Set([',']),
      );
      properties.set(
        key,
        resolveStaticExpression(tokens, index + 1, valueEnd, scopes, pairs, depth + 1),
      );
      index = valueEnd;
    } else {
      properties.set(key, lookupStaticBinding(scopes, key));
    }
    if (tokens[index]?.value === ',') {
      index += 1;
    } else if (index < close) {
      return undefined;
    }
  }
  return {
    end: close + 1,
    value: { kind: 'static-object', properties },
  };
}

function resolveStaticTemplate(raw, scopes, depth) {
  if (
    typeof raw !== 'string'
    || raw[0] !== '`'
    || raw.at(-1) !== '`'
    || depth > STATIC_ANALYSIS_LIMITS.maxExpressionDepth
  ) {
    return UNKNOWN_STATIC_VALUE;
  }
  let value = '';
  let index = 1;
  let chunkStart = index;
  let expressions = 0;
  while (index < raw.length - 1) {
    if (raw[index] === '\\') {
      index += 2;
      continue;
    }
    if (raw[index] !== '$' || raw[index + 1] !== '{') {
      index += 1;
      continue;
    }
    value += decodeJavaScriptEscapes(raw.slice(chunkStart, index));
    expressions += 1;
    if (expressions > STATIC_ANALYSIS_LIMITS.maxTemplateExpressions) {
      return UNKNOWN_STATIC_VALUE;
    }
    const expressionStart = index + 2;
    const expressionEndAfterBrace = scanTemplateExpression(raw, expressionStart);
    if (raw[expressionEndAfterBrace - 1] !== '}') {
      return UNKNOWN_STATIC_VALUE;
    }
    const expressionTokens = tokenizeJavaScript(
      raw.slice(expressionStart, expressionEndAfterBrace - 1),
    );
    const expressionPairs = buildTokenPairs(expressionTokens);
    const expressionValue = resolveStaticExpression(
      expressionTokens,
      0,
      expressionTokens.length,
      scopes,
      expressionPairs,
      depth + 1,
    );
    if (!isStaticPrimitive(expressionValue)) {
      return UNKNOWN_STATIC_VALUE;
    }
    value += String(expressionValue);
    if (value.length > STATIC_ANALYSIS_LIMITS.maxStringLength) {
      return UNKNOWN_STATIC_VALUE;
    }
    index = expressionEndAfterBrace;
    chunkStart = index;
  }
  value += decodeJavaScriptEscapes(raw.slice(chunkStart, -1));
  return value.length <= STATIC_ANALYSIS_LIMITS.maxStringLength
    ? value
    : UNKNOWN_STATIC_VALUE;
}

function decodeJavaScriptEscapes(raw) {
  let value = '';
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] !== '\\') {
      value += raw[index];
      continue;
    }
    const escaped = raw[index + 1];
    if (escaped === undefined) {
      return undefined;
    }
    index += 1;
    if (escaped === '\n') {
      continue;
    }
    if (escaped === '\r') {
      if (raw[index + 1] === '\n') {
        index += 1;
      }
      continue;
    }
    const simple = {
      0: '\0',
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
      v: '\v',
    };
    if (Object.hasOwn(simple, escaped) && !(escaped === '0' && /[0-9]/u.test(raw[index + 1] ?? ''))) {
      value += simple[escaped];
      continue;
    }
    if (escaped === 'x') {
      const digits = raw.slice(index + 1, index + 3);
      if (!/^[0-9A-Fa-f]{2}$/u.test(digits)) {
        return undefined;
      }
      value += String.fromCodePoint(Number.parseInt(digits, 16));
      index += 2;
      continue;
    }
    if (escaped === 'u') {
      if (raw[index + 1] === '{') {
        const close = raw.indexOf('}', index + 2);
        const digits = close < 0 ? '' : raw.slice(index + 2, close);
        const codePoint = /^[0-9A-Fa-f]{1,6}$/u.test(digits)
          ? Number.parseInt(digits, 16)
          : Number.NaN;
        if (!Number.isSafeInteger(codePoint) || codePoint > 0x10ffff) {
          return undefined;
        }
        value += String.fromCodePoint(codePoint);
        index = close;
        continue;
      }
      const digits = raw.slice(index + 1, index + 5);
      if (!/^[0-9A-Fa-f]{4}$/u.test(digits)) {
        return undefined;
      }
      value += String.fromCodePoint(Number.parseInt(digits, 16));
      index += 4;
      continue;
    }
    if (/[1-7]/u.test(escaped)) {
      const octal = `${escaped}${raw.slice(index + 1, index + 3).match(/^[0-7]{0,2}/u)?.[0] ?? ''}`;
      value += String.fromCodePoint(Number.parseInt(octal, 8));
      index += octal.length - 1;
      continue;
    }
    value += escaped;
  }
  return value;
}

function lookupStaticBinding(scopes, name) {
  for (let index = scopes.length - 1; index >= 0; index -= 1) {
    if (scopes[index].has(name)) {
      return scopes[index].get(name);
    }
  }
  return UNKNOWN_STATIC_VALUE;
}

function isStaticObject(value) {
  return value !== null
    && typeof value === 'object'
    && value.kind === 'static-object'
    && value.properties instanceof Map;
}

function isStaticPrimitive(value) {
  return typeof value === 'string' || typeof value === 'number';
}

function extractJsonReferences(sourcePath, source) {
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    return [];
  }
  const references = [];
  visitJsonReferences(value, [], sourcePath, references);
  return references;
}

function visitJsonReferences(value, keyPath, sourcePath, references) {
  if (typeof value === 'string') {
    if (jsonKeyCarriesUrl(keyPath)) {
      addReference(references, sourcePath, value, jsonReferenceKind(sourcePath, keyPath));
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitJsonReferences(item, [...keyPath, String(index)], sourcePath, references));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      visitJsonReferences(child, [...keyPath, key], sourcePath, references);
    }
  }
}

function jsonKeyCarriesUrl(keyPath) {
  const leaf = keyPath.at(-1) ?? '';
  return /(?:file|href|path|script|server|src|uri|url|wasm)$/iu.test(leaf)
    || keyPath.some((key) => /^(?:files|imports|jsList|scopes|scriptPackages|scripts|urls)$/iu.test(key));
}

function jsonReferenceKind(sourcePath, keyPath) {
  if (keyPath.some((key) => /^(?:imports|jsList|scopes|scriptPackages)$/iu.test(key))) {
    return 'json-path';
  }
  return /^src\/settings(?:[.-][A-Za-z0-9_-]+)?\.json$/u.test(sourcePath)
    ? 'json-document-path'
    : 'json-path';
}

function stripJavaScriptComments(source) {
  let output = '';
  let index = 0;
  let quote;
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (quote !== undefined) {
      output += character;
      if (character === '\\') {
        output += next ?? '';
        index += 2;
        continue;
      }
      if (character === quote) {
        quote = undefined;
      }
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      output += character;
      index += 1;
      continue;
    }
    if (character === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') {
        index += 1;
      }
      output += '\n';
      continue;
    }
    if (character === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        output += source[index] === '\n' ? '\n' : ' ';
        index += 1;
      }
      index += 2;
      continue;
    }
    output += character;
    index += 1;
  }
  return output;
}

function looksLikeLocalReference(value, kind) {
  const path = value.split(/[?#]/u, 1)[0];
  if (path.length === 0 || /^(?:cc|cce|db):/iu.test(path)) {
    return false;
  }
  if (
    path.startsWith('./')
    || path.startsWith('../')
    || path.startsWith('/')
    || path.includes('/')
    || contentTypeForWebPath(path) !== undefined
  ) {
    return true;
  }
  return kind.startsWith('markup-') || kind.startsWith('css-');
}

function addReference(references, source, value, kind, metadata = {}) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return;
  }
  references.push({ kind, source, value: value.trim(), ...metadata });
}

function freezeReferences(references) {
  const seen = new Set();
  return Object.freeze(references
    .filter((reference) => {
      const key = [
        reference.kind,
        reference.source,
        reference.value,
        reference.element ?? '',
        reference.attribute ?? '',
        reference.rel ?? '',
      ].join('\0');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((reference) => Object.freeze(reference)));
}

function firstCapture(match) {
  for (let index = 1; index < match.length; index += 1) {
    if (match[index] !== undefined) {
      return match[index];
    }
  }
  return undefined;
}

function decodeHtmlEntities(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function normalizeLimits(overrides = {}) {
  const limits = { ...WEB_BUILD_LIMITS };
  for (const [name, value] of Object.entries(overrides)) {
    if (!(name in WEB_BUILD_LIMITS)) {
      throw new TypeError(`unknown web build limit: ${name}`);
    }
    if (!Number.isSafeInteger(value) || value <= 0 || value > WEB_BUILD_LIMITS[name]) {
      throw new RangeError(`${name} must be a positive integer no greater than ${WEB_BUILD_LIMITS[name]}`);
    }
    limits[name] = value;
  }
  return limits;
}

function validateBuildRoot(buildDirectory) {
  if (typeof buildDirectory !== 'string' || buildDirectory.length === 0) {
    throw new TypeError('web build path must name one directory');
  }
  const root = resolve(buildDirectory);
  if (!existsSync(root)) {
    throw new Error(`web build directory does not exist: ${root}`);
  }
  const rootStat = lstatSync(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error(`web build path must be a real directory: ${root}`);
  }
  return realpathSync(root);
}

function assertContainedPath(root, absolutePath, displayPath) {
  const relativePath = relative(root, absolutePath);
  if (relativePath === '..' || relativePath.startsWith(`..${posix.sep}`) || posix.isAbsolute(relativePath)) {
    throw new Error(`web build entry escapes the audited directory: ${displayPath}`);
  }
}

function isUnsafePathSegment(segment) {
  if (
    segment.length === 0
    || segment === '.'
    || segment === '..'
    || segment.startsWith('.')
    || segment.includes('\\')
    || /[\u0000-\u001f\u007f*?[\]#]/u.test(segment)
  ) {
    return true;
  }
  try {
    const decoded = decodeURIComponent(segment);
    return decoded === '.'
      || decoded === '..'
      || decoded.includes('/')
      || decoded.includes('\\')
      || /[\u0000-\u001f\u007f]/u.test(decoded);
  } catch {
    return true;
  }
}

function isSourceMapJson(extension, source) {
  if (extension !== '.json') {
    return false;
  }
  try {
    const value = JSON.parse(source);
    return value !== null
      && typeof value === 'object'
      && value.version === 3
      && Array.isArray(value.sources)
      && typeof value.mappings === 'string';
  } catch {
    return false;
  }
}

function isValidJson(source) {
  try {
    JSON.parse(source);
    return true;
  } catch {
    return false;
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

function isOtherExecutable(bytes) {
  if (bytes.length < 4) {
    return false;
  }
  const magic = bytes.readUInt32BE(0);
  return (
    (bytes[0] === 0x4d && bytes[1] === 0x5a)
    || bytes.subarray(0, 4).equals(Buffer.from('dex\n'))
    || magic === 0xcafebabe
    || magic === 0xfeedface
    || magic === 0xfeedfacf
    || magic === 0xcefaedfe
    || magic === 0xcffaedfe
  );
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function finding(path, reason) {
  return Object.freeze({ path, reason });
}

function main() {
  if (process.argv.length !== 3) {
    console.error('Usage: node scripts/audit-web-build.mjs <web-build-directory>');
    process.exitCode = 2;
    return;
  }
  try {
    const buildDirectory = process.argv[2];
    const findings = auditWebBuild(buildDirectory);
    if (findings.length === 0) {
      console.log(`PASS: audited static web build ${resolve(buildDirectory)}`);
      return;
    }
    for (const item of findings) {
      console.error(`FAIL: ${item.path}: ${item.reason}`);
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
