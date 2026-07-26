#!/usr/bin/env node

import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contentTypeForWebPath } from './audit-web-build.mjs';
import {
  collectCandidateFiles,
  sha256,
  verifyCaseStudyReleaseManifest,
} from './generate-case-study-release-manifest.mjs';

export const DEFAULT_CANDIDATE_PREFIX = '/pencil-blade-2026/';

function normalizePagesPrefix(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('pagesPrefix must be a non-empty absolute URL path');
  }
  const trimmed = value.trim();
  if (
    !trimmed.startsWith('/')
    || trimmed.startsWith('//')
    || trimmed.includes('\\')
    || /[?#]/u.test(trimmed)
    || /%(?:00|2e|2f|5c)/iu.test(trimmed)
  ) {
    throw new Error('pagesPrefix must be a safe absolute URL path');
  }
  const segments = trimmed.split('/').filter(Boolean);
  if (
    segments.length === 0
    || segments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error('pagesPrefix must contain a non-root path without traversal');
  }
  return `/${segments.join('/')}/`;
}

function routeToCandidatePath(rawTarget, pagesPrefix) {
  const rawPath = rawTarget.split('?', 1)[0];
  if (!rawPath.startsWith(pagesPrefix)) {
    return undefined;
  }
  const rawRelative = rawPath.slice(pagesPrefix.length);
  if (/%(?:00|2e|2f|5c)/iu.test(rawRelative)) {
    return undefined;
  }
  let decoded;
  try {
    decoded = decodeURIComponent(rawRelative);
  } catch {
    return undefined;
  }
  if (
    decoded.includes('\\')
    || decoded.startsWith('/')
    || decoded.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    return undefined;
  }
  const normalized = posix.normalize(decoded);
  if (
    normalized === '..'
    || normalized.startsWith('../')
    || posix.isAbsolute(normalized)
  ) {
    return undefined;
  }
  if (normalized === '.' || normalized.length === 0) {
    return 'index.html';
  }
  return decoded.endsWith('/')
    ? `${normalized.replace(/\/$/u, '')}/index.html`
    : normalized;
}

function unchangedFile(root, file) {
  try {
    const metadata = lstatSync(file.absolutePath);
    const fromRoot = relative(root, file.absolutePath);
    if (
      !metadata.isFile()
      || metadata.isSymbolicLink()
      || metadata.size !== file.bytes
      || fromRoot === '..'
      || fromRoot.startsWith(`..${sep}`)
      || isAbsolute(fromRoot)
    ) {
      return undefined;
    }
    const bytes = readFileSync(file.absolutePath);
    return bytes.length === file.bytes && sha256(bytes) === file.sha256
      ? bytes
      : undefined;
  } catch {
    return undefined;
  }
}

function sendEmpty(response, statusCode) {
  response.statusCode = statusCode;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Length', '0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end();
}

export function createCaseStudyCandidateServer(candidateDirectory, options = {}) {
  const candidateDir = realpathSync(resolve(candidateDirectory));
  const pagesPrefix = normalizePagesPrefix(
    options.pagesPrefix ?? DEFAULT_CANDIDATE_PREFIX,
  );
  if (pagesPrefix !== DEFAULT_CANDIDATE_PREFIX) {
    throw new Error(
      `candidate server requires exact Pages prefix ${DEFAULT_CANDIDATE_PREFIX}`,
    );
  }
  const provenance = verifyCaseStudyReleaseManifest(candidateDir);
  const files = collectCandidateFiles(candidateDir, { label: 'candidate directory' });
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const server = createServer((request, response) => {
    const method = request.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      sendEmpty(response, 405);
      return;
    }
    const path = routeToCandidatePath(request.url ?? '/', pagesPrefix);
    const file = path === undefined ? undefined : filesByPath.get(path);
    const bytes = file === undefined ? undefined : unchangedFile(candidateDir, file);
    if (!file || !bytes) {
      sendEmpty(response, 404);
      return;
    }
    const contentType = contentTypeForWebPath(path);
    if (!contentType) {
      sendEmpty(response, 415);
      return;
    }
    response.statusCode = 200;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Length', String(file.bytes));
    response.setHeader('Content-Type', contentType);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (method === 'HEAD') {
      response.end();
      return;
    }
    response.end(bytes);
  });
  return Object.freeze({
    candidateDir,
    pagesPrefix,
    provenance,
    server,
  });
}

function listen(server, host, port) {
  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, host, () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });
}

function close(server) {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) rejectClose(error);
      else resolveClose();
    });
  });
}

export async function serveCaseStudyCandidate(candidateDirectory, options = {}) {
  const host = options.host ?? '127.0.0.1';
  if (host !== '127.0.0.1' && host !== '::1' && host !== 'localhost') {
    throw new Error('candidate server host must be loopback-only');
  }
  const port = options.port ?? 0;
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new Error('candidate server port must be an integer from 0 through 65535');
  }
  const candidate = createCaseStudyCandidateServer(candidateDirectory, options);
  await listen(candidate.server, host, port);
  const address = candidate.server.address();
  if (address === null || typeof address === 'string') {
    await close(candidate.server);
    throw new Error('candidate server did not receive a TCP address');
  }
  const displayHost = host === '::1' ? '[::1]' : host;
  return Object.freeze({
    ...candidate,
    close: () => close(candidate.server),
    origin: `http://${displayHost}:${address.port}`,
    port: address.port,
    url: `http://${displayHost}:${address.port}${candidate.pagesPrefix}`,
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
    else if (argument === '--pages-prefix') options.pagesPrefix = value;
    else if (argument === '--host') options.host = value;
    else if (argument === '--port') options.port = Number(value);
    else throw new Error(`unknown option: ${argument}`);
  }
  options.candidateDir ??= positional[0];
  options.pagesPrefix ??= positional[1];
  if (positional.length > 2) throw new Error('too many positional arguments');
  return options;
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const running = await serveCaseStudyCandidate(options.candidateDir, options);
    process.stdout.write(
      `PASS candidate ${running.url}\n`
      + `contentTreeDigest=${running.provenance.contentTreeDigest}\n`
      + `treeManifestSha256=${running.provenance.treeManifestSha256}\n`,
    );
    const stop = async () => {
      await running.close();
      process.exit(0);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    process.stderr.write(`ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
