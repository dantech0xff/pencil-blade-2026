#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  lstatSync,
  readFileSync,
} from 'node:fs';
import { createServer, request } from 'node:http';
import { extname, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  contentTypeForWebPath,
  extractStaticWebReferences,
  inspectWebBuildDirectory,
  resolveStaticWebReference,
} from './audit-web-build.mjs';

export const PAGES_PREFIX = '/pencil-blade-2026/';
export const DEFAULT_ENTRY_PATH = 'index.html';

const MAX_CONCURRENT_REQUESTS = 16;
const REFERENCE_TEXT_EXTENSIONS = new Set([
  '.ccon',
  '.css',
  '.htm',
  '.html',
  '.js',
  '.json',
  '.manifest',
  '.mjs',
  '.svg',
  '.xml',
]);

function normalizePagesPrefix(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('pages prefix must be a non-empty absolute URL path');
  }
  const trimmed = value.trim();
  if (
    !trimmed.startsWith('/')
    || trimmed.startsWith('//')
    || trimmed.includes('\\')
    || /[?#]/u.test(trimmed)
    || /%(?:00|2e|2f|5c)/iu.test(trimmed)
  ) {
    throw new Error('pages prefix must be a safe absolute URL path');
  }
  const segments = trimmed.split('/').filter(Boolean);
  if (
    segments.length === 0
    || segments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error('pages prefix must contain a non-root path without traversal');
  }
  return `/${segments.join('/')}/`;
}

function normalizeBuildPath(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty build-relative path`);
  }
  const trimmed = value.trim();
  if (
    trimmed.startsWith('/')
    || trimmed.includes('\\')
    || /[?#]/u.test(trimmed)
    || /%(?:00|2e|2f|5c)/iu.test(trimmed)
  ) {
    throw new Error(`${label} must be a safe build-relative path`);
  }
  const segments = trimmed.split('/');
  if (
    segments.some((segment) => (
      segment.length === 0 || segment === '.' || segment === '..'
    ))
  ) {
    throw new Error(`${label} must not contain empty or traversal segments`);
  }
  return segments.join('/');
}

export function createWebBuildVerificationConfig(options = {}) {
  const pagesPrefix = normalizePagesPrefix(options.pagesPrefix ?? PAGES_PREFIX);
  const entryPath = normalizeBuildPath(options.entryPath ?? DEFAULT_ENTRY_PATH, 'entry path');
  const buildDirectory = options.buildDirectory === undefined
    ? undefined
    : resolve(options.buildDirectory);

  return Object.freeze({
    pagesPrefix,
    entryPath,
    buildDirectory,
  });
}

export async function verifyWebMobileBuild(buildDirectory, options = {}) {
  const config = createWebBuildVerificationConfig({
    ...options,
    buildDirectory,
  });
  const audit = inspectWebBuildDirectory(config.buildDirectory);
  if (audit.findings.length > 0) {
    throw new Error(formatAuditFailure(audit.findings));
  }

  const filesByPath = new Map(audit.files.map((file) => [file.path, file]));
  const references = discoverReferences(audit.files);
  const referencedPaths = references
    .map((reference) => Object.freeze({
      path: resolveStaticWebReference(reference),
      reference,
    }))
    .filter((item) => item.path !== undefined);
  const pathsToCheck = new Set(audit.files.map((file) => file.path));
  for (const item of referencedPaths) {
    pathsToCheck.add(item.path);
  }

  const requests = [];
  const server = createPagesPrefixServer(audit, config, requests);
  try {
    await listenOnLoopback(server);
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Pages-prefix verifier did not receive a loopback TCP address');
    }

    const origin = `http://127.0.0.1:${address.port}`;
    const outboundRequests = [];
    await assertNegativeRoute(origin, '/', 'site root', outboundRequests);
    await assertNegativeRoute(
      origin,
      config.pagesPrefix.slice(0, -1),
      'prefix without trailing slash',
      outboundRequests,
    );
    await assertNegativeRoute(
      origin,
      '/other-project/index.html',
      'unrelated project prefix',
      outboundRequests,
    );
    await assertNegativeRoute(
      origin,
      `${config.pagesPrefix}%2e%2e/${config.entryPath}`,
      'percent-encoded traversal route',
      outboundRequests,
    );

    const rootResponse = await requestLoopback(
      origin,
      config.pagesPrefix,
      'GET',
      outboundRequests,
    );
    assertResponse(
      rootResponse,
      config.entryPath,
      filesByPath.get(config.entryPath),
    );

    const checks = [...pathsToCheck]
      .sort((left, right) => left.localeCompare(right))
      .map((path) => async () => {
        const response = await requestLoopback(
          origin,
          pagesUrlForPath(path, config),
          'HEAD',
          outboundRequests,
        );
        assertResponse(response, path, filesByPath.get(path));
      });
    await runBounded(checks, MAX_CONCURRENT_REQUESTS);

    const allowedNegativePaths = new Set([
      '/',
      config.pagesPrefix.slice(0, -1),
      '/other-project/index.html',
      `${config.pagesPrefix}%2e%2e/${config.entryPath}`,
    ]);
    const unexpectedRequests = requests.filter((entry) => (
      !allowedNegativePaths.has(entry.path)
      && !entry.path.startsWith(config.pagesPrefix)
    ));
    if (unexpectedRequests.length > 0) {
      throw new Error(
        `verifier made a request outside ${config.pagesPrefix}: ${unexpectedRequests[0].path}`,
      );
    }
    const offOriginRequests = outboundRequests.filter((entry) => entry.origin !== origin);
    if (offOriginRequests.length > 0) {
      throw new Error(`verifier made an off-origin request: ${offOriginRequests[0].url}`);
    }

    return Object.freeze({
      checkedFiles: pathsToCheck.size,
      discoveredReferences: Object.freeze(referencedPaths.map((item) => Object.freeze({
        path: item.path,
        source: item.reference.source,
        value: item.reference.value,
      }))),
      offOriginRequests: Object.freeze(offOriginRequests.map((entry) => Object.freeze({ ...entry }))),
      entryPath: config.entryPath,
      prefix: config.pagesPrefix,
      requests: Object.freeze(requests.map((entry) => Object.freeze({ ...entry }))),
    });
  } finally {
    await closeServer(server);
  }
}

export function createPagesPrefixServer(audit, options = {}, requestLog = []) {
  const legacyRequests = Array.isArray(options) ? options : requestLog;
  const config = createWebBuildVerificationConfig(
    Array.isArray(options) ? {} : options,
  );
  const filesByPath = new Map(audit.files.map((file) => [file.path, file]));
  return createServer((incoming, response) => {
    const method = incoming.method ?? 'GET';
    const rawTarget = incoming.url ?? '/';
    const rawPath = rawTarget.split('?', 1)[0];
    legacyRequests.push({ method, path: rawPath });

    if (method !== 'GET' && method !== 'HEAD') {
      sendEmpty(response, 405);
      return;
    }
    const relativePath = routeToBuildPath(rawPath, config);
    if (relativePath === undefined) {
      sendEmpty(response, 404);
      return;
    }
    const file = filesByPath.get(relativePath);
    const bytes = file === undefined ? undefined : readUnchangedRegularFile(audit.root, file);
    if (file === undefined || bytes === undefined) {
      sendEmpty(response, 404);
      return;
    }
    const contentType = contentTypeForWebPath(relativePath);
    if (contentType === undefined) {
      sendEmpty(response, 415);
      return;
    }

    response.statusCode = 200;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Length', String(file.size));
    response.setHeader('Content-Type', contentType);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (method === 'HEAD') {
      response.end();
      return;
    }
    response.end(bytes);
  });
}

export function pagesUrlForPath(relativePath, options = {}) {
  const config = createWebBuildVerificationConfig(options);
  const normalizedPath = normalizeBuildPath(relativePath, 'build path');
  return `${config.pagesPrefix}${normalizedPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

function discoverReferences(files) {
  const references = [];
  for (const file of files) {
    if (!REFERENCE_TEXT_EXTENSIONS.has(extname(file.path).toLowerCase())) {
      continue;
    }
    const source = readFileSync(file.absolutePath, 'utf8');
    references.push(...extractStaticWebReferences(file.path, source));
  }
  return references;
}

function routeToBuildPath(rawPath, config) {
  if (rawPath === config.pagesPrefix) {
    return config.entryPath;
  }
  if (!rawPath.startsWith(config.pagesPrefix)) {
    return undefined;
  }
  const rawRelativePath = rawPath.slice(config.pagesPrefix.length);
  if (
    rawRelativePath.length === 0
    || /%(?:00|2e|2f|5c)/iu.test(rawRelativePath)
  ) {
    return undefined;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawRelativePath);
  } catch {
    return undefined;
  }
  if (
    decodedPath.startsWith('/')
    || decodedPath.includes('\\')
    || decodedPath.split('/').some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    return undefined;
  }
  const normalizedPath = posix.normalize(decodedPath);
  if (normalizedPath === '..' || normalizedPath.startsWith('../') || posix.isAbsolute(normalizedPath)) {
    return undefined;
  }
  return normalizedPath;
}

function readUnchangedRegularFile(root, file) {
  try {
    const stat = lstatSync(file.absolutePath);
    const relativePath = relative(root, file.absolutePath);
    const isExpectedFile = stat.isFile()
      && !stat.isSymbolicLink()
      && stat.size === file.size
      && relativePath !== '..'
      && !relativePath.startsWith(`..${posix.sep}`)
      && !posix.isAbsolute(relativePath);
    if (!isExpectedFile) {
      return undefined;
    }
    const bytes = readFileSync(file.absolutePath);
    return bytes.length === file.size && sha256(bytes) === file.sha256
      ? bytes
      : undefined;
  } catch {
    return undefined;
  }
}

async function assertNegativeRoute(origin, path, label, outboundRequests) {
  const response = await requestLoopback(origin, path, 'HEAD', outboundRequests);
  if (response.statusCode !== 404) {
    throw new Error(`${label} must return 404, received ${response.statusCode}`);
  }
}

function assertResponse(response, path, file) {
  if (response.statusCode !== 200) {
    throw new Error(`${path} returned HTTP ${response.statusCode}`);
  }
  if (file === undefined) {
    throw new Error(`${path} is referenced but missing from the audited build`);
  }

  const expectedType = contentTypeForWebPath(path);
  const actualType = response.headers['content-type'];
  if (expectedType === undefined || typeof actualType !== 'string') {
    throw new Error(`${path} did not return a verifiable Content-Type`);
  }
  if (mediaType(actualType) !== mediaType(expectedType)) {
    throw new Error(`${path} returned ${actualType}, expected ${expectedType}`);
  }
  const contentLength = response.headers['content-length'];
  if (contentLength !== String(file.size)) {
    throw new Error(`${path} returned Content-Length ${contentLength ?? '<missing>'}, expected ${file.size}`);
  }
}

function requestLoopback(origin, path, method, outboundRequests) {
  const originUrl = new URL(origin);
  const requestUrl = new URL(path, originUrl);
  outboundRequests.push({
    method,
    origin: requestUrl.origin,
    url: requestUrl.href,
  });
  return new Promise((resolveRequest, rejectRequest) => {
    const outgoing = request({
      agent: false,
      headers: {
        Accept: '*/*',
        Connection: 'close',
      },
      host: '127.0.0.1',
      method,
      path,
      port: Number(originUrl.port),
      protocol: 'http:',
    }, (incoming) => {
      incoming.resume();
      incoming.on('end', () => {
        resolveRequest({
          headers: incoming.headers,
          statusCode: incoming.statusCode ?? 0,
        });
      });
    });
    outgoing.setTimeout(5_000, () => {
      outgoing.destroy(new Error(`timed out checking ${path}`));
    });
    outgoing.on('error', rejectRequest);
    outgoing.end();
  });
}

function listenOnLoopback(server) {
  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });
}

function closeServer(server) {
  return new Promise((resolveClose, rejectClose) => {
    if (!server.listening) {
      resolveClose();
      return;
    }
    server.close((error) => {
      if (error !== undefined) {
        rejectClose(error);
        return;
      }
      resolveClose();
    });
  });
}

async function runBounded(tasks, concurrency) {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    async () => {
      while (next < tasks.length) {
        const index = next;
        next += 1;
        await tasks[index]();
      }
    },
  );
  await Promise.all(workers);
}

function sendEmpty(response, statusCode) {
  response.statusCode = statusCode;
  response.setHeader('Content-Length', '0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end();
}

function mediaType(value) {
  return value.split(';', 1)[0].trim().toLowerCase();
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function formatAuditFailure(findings) {
  const lines = findings.map((item) => `${item.path}: ${item.reason}`);
  return `web build audit failed:\n${lines.join('\n')}`;
}

async function main() {
  let cli;
  try {
    cli = parseCliArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    console.error(verificationUsage());
    process.exitCode = 2;
    return;
  }
  if (cli.help) {
    console.log(verificationUsage());
    return;
  }
  try {
    const result = await verifyWebMobileBuild(cli.buildDirectory, {
      pagesPrefix: cli.pagesPrefix,
      entryPath: cli.entryPath,
    });
    console.log(
      `PASS: ${result.checkedFiles} files verified at exact Pages prefix ${result.prefix}`,
    );
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

function parseCliArguments(args) {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    return Object.freeze({ help: true });
  }
  if (args.length === 0 || args[0].startsWith('-')) {
    throw new Error('missing required <build-dir>');
  }
  const result = {
    buildDirectory: args[0],
    pagesPrefix: PAGES_PREFIX,
    entryPath: DEFAULT_ENTRY_PATH,
  };
  const seen = new Set();
  for (let index = 1; index < args.length; index += 1) {
    const option = args[index];
    if (option !== '--pages-prefix' && option !== '--entry-path') {
      throw new Error(`unknown option "${option}"`);
    }
    if (seen.has(option)) {
      throw new Error(`duplicate option "${option}"`);
    }
    seen.add(option);
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`missing value for ${option}`);
    }
    index += 1;
    if (option === '--pages-prefix') {
      result.pagesPrefix = value;
    } else {
      result.entryPath = value;
    }
  }
  createWebBuildVerificationConfig(result);
  return Object.freeze(result);
}

function verificationUsage() {
  return [
    'Usage: node scripts/verify-web-mobile-build.mjs <build-dir>',
    '       [--pages-prefix <prefix>] [--entry-path <path>]',
  ].join(' ');
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
