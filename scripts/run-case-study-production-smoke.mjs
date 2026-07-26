#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

import {
  assertExactPublicRouteFiles,
  assertExactSitemapRoutes,
  assertNoForbiddenRouteFiles,
  FORBIDDEN_PUBLIC_ROUTES,
  hasExpectedPublicRoutes,
  PUBLIC_ROUTES,
} from './case-study-public-routes.mjs';
import { serveCaseStudyCandidate } from './serve-case-study-candidate.mjs';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const DEFAULT_CONCURRENCY = 12;
const DEFAULT_FETCH_ATTEMPTS = 4;
const DEFAULT_FETCH_RETRY_DELAY_MS = 250;
const TRANSIENT_HTTP_STATUSES = Object.freeze(new Set([429, 502, 503, 504]));
const REQUIRED_ROUTES = Object.freeze(
  PUBLIC_ROUTES.map((route) => route.slice(1)),
);
const MIME_TYPES = Object.freeze({
  '.aac': 'audio/aac',
  '.avif': 'image/avif',
  '.bin': 'application/octet-stream',
  '.ccon': 'application/json',
  '.cconb': 'application/octet-stream',
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.ktx': 'image/ktx',
  '.ktx2': 'image/ktx2',
  '.m4a': 'audio/mp4',
  '.manifest': 'application/manifest+json',
  '.mjs': 'text/javascript',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
});

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function normalizedBaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(
    url.protocol === 'http:'
    && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  )) {
    throw new Error('Production base URL must use HTTPS (or explicit loopback for tests).');
  }
  url.hash = '';
  url.search = '';
  if (!url.pathname.endsWith('/')) {
    url.pathname += '/';
  }
  return url;
}

function safeManifestPath(pathValue) {
  if (
    typeof pathValue !== 'string'
    || pathValue.length === 0
    || pathValue.startsWith('/')
    || pathValue.includes('\\')
    || pathValue.includes('\0')
    || /[?#]/u.test(pathValue)
  ) {
    throw new Error(`Unsafe tree-manifest path: ${String(pathValue)}.`);
  }
  let decoded;
  try {
    decoded = decodeURIComponent(pathValue);
  } catch {
    throw new Error(`Invalid percent encoding in tree-manifest path: ${pathValue}.`);
  }
  if (decoded.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new Error(`Tree-manifest path traverses outside the candidate: ${pathValue}.`);
  }
  return pathValue;
}

function expectedMime(pathValue) {
  if (pathValue.endsWith('/')) return 'text/html';
  return MIME_TYPES[extname(pathValue).toLowerCase()];
}

function contentTypeMatches(pathValue, actual) {
  const expected = expectedMime(pathValue);
  if (!expected || typeof actual !== 'string') return false;
  const normalized = actual.split(';', 1)[0].trim().toLowerCase();
  if (expected === 'text/javascript') {
    return normalized === 'text/javascript' || normalized === 'application/javascript';
  }
  if (expected === 'application/xml') {
    return normalized === 'application/xml' || normalized === 'text/xml';
  }
  if (expected === 'audio/mpeg') {
    return normalized === 'audio/mpeg' || normalized === 'audio/mp3';
  }
  return normalized === expected;
}

function releaseField(releaseRecord, names, label) {
  for (const path of names) {
    const segments = Array.isArray(path) ? path : [path];
    let value = releaseRecord;
    for (const segment of segments) {
      value = value?.[segment];
    }
    if (value !== undefined) return value;
  }
  throw new Error(`Release record is missing ${label}.`);
}

function validateExpectedIdentity(releaseRecord, expected) {
  const observed = {
    commitSha: String(releaseField(
      releaseRecord,
      ['commitSha', 'sourceCommitSha', 'commit'],
      'commit SHA',
    )),
    workflowRunId: String(releaseField(
      releaseRecord,
      [['workflow', 'runId'], 'workflowRunId', 'runId'],
      'workflow run ID',
    )),
    workflowRunAttempt: Number(releaseField(
      releaseRecord,
      [['workflow', 'runAttempt'], 'workflowRunAttempt', 'runAttempt'],
      'workflow run attempt',
    )),
    contentTreeDigestSha256: String(releaseField(
      releaseRecord,
      [['content', 'contentTreeDigest'], 'contentTreeDigestSha256', 'contentTreeDigest'],
      'content-tree digest',
    )),
  };
  if (!COMMIT_PATTERN.test(observed.commitSha)) {
    throw new Error('Release commit SHA is invalid.');
  }
  if (!DIGEST_PATTERN.test(observed.contentTreeDigestSha256)) {
    throw new Error('Release content-tree digest is invalid.');
  }
  if (
    observed.commitSha !== expected.commitSha
    || observed.workflowRunId !== String(expected.workflowRunId)
    || observed.workflowRunAttempt !== Number(expected.workflowRunAttempt)
    || observed.contentTreeDigestSha256 !== expected.contentTreeDigestSha256
  ) {
    throw new Error('Live release identity does not match the approved candidate.');
  }
  return Object.freeze(observed);
}

async function fetchBytes(fetchImpl, url, label, {
  attempts = DEFAULT_FETCH_ATTEMPTS,
  retryDelayMs = DEFAULT_FETCH_RETRY_DELAY_MS,
} = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetchImpl(url, {
      headers: {
        accept: '*/*',
        'cache-control': 'no-cache',
      },
      redirect: 'error',
    });
    if (response?.status === 200) {
      return {
        bytes: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type') ?? '',
        response,
      };
    }
    const status = response?.status;
    const retryable = TRANSIENT_HTTP_STATUSES.has(status);
    if (!retryable || attempt === attempts) {
      throw new Error(`${label} returned HTTP ${status ?? 'no response'}.`);
    }
    await response.arrayBuffer().catch(() => {});
    await new Promise((resolvePromise) => {
      setTimeout(resolvePromise, retryDelayMs * (2 ** (attempt - 1)));
    });
  }
  throw new Error(`${label} exhausted production fetch attempts.`);
}

async function assertRemovedRoutesUnavailable(
  fetchImpl,
  baseUrl,
  cacheToken,
  fetchOptions,
) {
  for (const route of FORBIDDEN_PUBLIC_ROUTES) {
    const url = cacheBusted(
      baseUrl,
      route.slice(1),
      `${cacheToken}-removed-route`,
    );
    for (let attempt = 1; attempt <= fetchOptions.attempts; attempt += 1) {
      const response = await fetchImpl(url, {
        headers: {
          accept: 'text/html',
          'cache-control': 'no-cache',
        },
        redirect: 'error',
      });
      if (response?.status === 404 || response?.status === 410) {
        await response.arrayBuffer().catch(() => {});
        break;
      }
      if (
        TRANSIENT_HTTP_STATUSES.has(response?.status)
        && attempt < fetchOptions.attempts
      ) {
        await response.arrayBuffer().catch(() => {});
        await new Promise((resolvePromise) => {
          setTimeout(
            resolvePromise,
            fetchOptions.retryDelayMs * (2 ** (attempt - 1)),
          );
        });
        continue;
      }
      throw new Error(
        `Removed production route is still public or returned an unexpected status: ${route} (HTTP ${response?.status ?? 'no response'}).`,
      );
    }
  }
}

function validateFetchRetryOptions(attempts, retryDelayMs) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 8) {
    throw new Error('Production smoke fetch attempts must be between 1 and 8.');
  }
  if (
    !Number.isInteger(retryDelayMs)
    || retryDelayMs < 0
    || retryDelayMs > 5_000
  ) {
    throw new Error('Production smoke fetch retry delay must be between 0 and 5000 ms.');
  }
}

export async function fetchBrowserRouteWithRetries(route, {
  attempts = DEFAULT_FETCH_ATTEMPTS,
  retryDelayMs = DEFAULT_FETCH_RETRY_DELAY_MS,
  delayImpl = (delayMs) => new Promise((resolvePromise) => {
    setTimeout(resolvePromise, delayMs);
  }),
} = {}) {
  validateFetchRetryOptions(attempts, retryDelayMs);
  if (typeof route?.fetch !== 'function') {
    throw new Error('Production browser retry requires a Playwright route.');
  }
  if (typeof delayImpl !== 'function') {
    throw new Error('Production browser retry requires a delay implementation.');
  }
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await route.fetch();
    const status = response.status();
    if (!TRANSIENT_HTTP_STATUSES.has(status) || attempt === attempts) {
      return response;
    }
    if (typeof response.dispose === 'function') {
      await response.dispose().catch(() => {});
    } else if (typeof response.body === 'function') {
      await response.body().catch(() => {});
    }
    await delayImpl(retryDelayMs * (2 ** (attempt - 1)));
  }
  throw new Error('Production browser route exhausted fetch attempts.');
}

async function installBrowserTransientRetries(page, baseUrl, retryOptions, onPersistentFailure) {
  const releaseBase = normalizedBaseUrl(baseUrl);
  await page.route(
    (url) =>
      url.origin === releaseBase.origin
      && url.pathname.startsWith(releaseBase.pathname),
    async (route) => {
      const response = await fetchBrowserRouteWithRetries(route, retryOptions);
      if (TRANSIENT_HTTP_STATUSES.has(response.status())) {
        onPersistentFailure?.(response);
      }
      await route.fulfill({ response });
    },
  );
}

function cacheBusted(baseUrl, pathValue, token) {
  const url = new URL(pathValue, baseUrl);
  if (url.origin !== baseUrl.origin || !url.pathname.startsWith(baseUrl.pathname)) {
    throw new Error(`Production path escapes the release base: ${pathValue}.`);
  }
  url.searchParams.set('case-study-smoke', token);
  return url;
}

function normalizeManifestFiles(treeManifest) {
  const records = treeManifest?.files ?? treeManifest?.entries;
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('Tree manifest must contain a non-empty files array.');
  }
  const seen = new Set();
  return records.map((record, index) => {
    const path = safeManifestPath(
      typeof record === 'string' ? record : record?.path,
    );
    if (path === 'case-study-tree-manifest.json') {
      throw new Error('Tree manifest cannot list itself.');
    }
    if (seen.has(path)) {
      throw new Error(`Duplicate tree-manifest path ${path}.`);
    }
    seen.add(path);
    const sha256Value = typeof record === 'string' ? undefined : record.sha256;
    const bytes = typeof record === 'string'
      ? undefined
      : record.bytes ?? record.size;
    if (!DIGEST_PATTERN.test(sha256Value ?? '')) {
      throw new Error(`Tree-manifest file ${path} has an invalid SHA-256.`);
    }
    if (!Number.isInteger(bytes) || bytes < 0) {
      throw new Error(`Tree-manifest file ${path} has an invalid byte size.`);
    }
    return Object.freeze({ index, path, sha256: sha256Value, bytes });
  });
}

async function mapBounded(values, concurrency, operation) {
  const results = new Array(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await operation(values[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export async function runProductionBrowserJourneys({
  baseUrl,
  playwrightModuleDir,
  browserExecutable,
  timeoutMs = 90_000,
  fetchAttempts = DEFAULT_FETCH_ATTEMPTS,
  fetchRetryDelayMs = DEFAULT_FETCH_RETRY_DELAY_MS,
}) {
  if (typeof playwrightModuleDir !== 'string' || playwrightModuleDir.length === 0) {
    throw new Error('Production browser journeys require an explicit Playwright module directory.');
  }
  validateFetchRetryOptions(fetchAttempts, fetchRetryDelayMs);
  const fetchRetryOptions = {
    attempts: fetchAttempts,
    retryDelayMs: fetchRetryDelayMs,
  };
  const modulePath = resolve(playwrightModuleDir, 'index.mjs');
  const { chromium } = await import(pathToFileURL(modulePath).href);
  let browser;
  const supportedViewports = Object.freeze([
    Object.freeze({ id: '480x800', width: 480, height: 800 }),
    Object.freeze({ id: '720x1280', width: 720, height: 1280 }),
  ]);
  try {
    browser = await chromium.launch({
      headless: true,
      ...(browserExecutable ? { executablePath: browserExecutable } : {}),
    });
    const embeddedGameViewports = [];
    for (const viewport of supportedViewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        hasTouch: true,
        isMobile: true,
        serviceWorkers: 'block',
      });
      const launcherPage = await context.newPage();
      const failures = [];
      const gameRequests = [];
      let expectedNavigationAbort = false;
      await installBrowserTransientRetries(
        launcherPage,
        baseUrl,
        fetchRetryOptions,
        (response) => failures.push(`http ${response.status()}: ${response.url()}`),
      );
      launcherPage.on('console', (message) => {
        if (
          message.type() === 'error'
          && !message.text().includes('[Assets] [buildScriptCommand][BABEL]')
        ) {
          failures.push(`console: ${message.text()}`);
        }
      });
      launcherPage.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
      launcherPage.on('requestfailed', (request) => {
        const errorText = request.failure()?.errorText ?? '';
        if (
          expectedNavigationAbort
          && errorText === 'net::ERR_ABORTED'
          && new URL(request.url()).pathname.includes('/play/game/')
        ) {
          return;
        }
        failures.push(`requestfailed: ${request.url()} ${errorText}`);
      });
      launcherPage.on('response', (response) => {
        if (
          response.status() >= 400
          && !TRANSIENT_HTTP_STATUSES.has(response.status())
        ) {
          failures.push(`http ${response.status()}: ${response.url()}`);
        }
      });
      launcherPage.on('request', (request) => {
        if (new URL(request.url()).pathname.includes('/play/game/')) {
          gameRequests.push(request.url());
        }
      });
      try {
        const launcherUrl = new URL('play/', baseUrl).href;
        await launcherPage.goto(launcherUrl, {
          waitUntil: 'domcontentloaded',
          timeout: timeoutMs,
        });
        if (gameRequests.length !== 0) {
          throw new Error('Play launcher requested the game before explicit activation.');
        }
        const probeValue = `parent-${viewport.id}-${Date.now()}`;
        const parentBefore = await launcherPage.evaluate((value) => {
          localStorage.setItem('__pencil_blade_parent_runtime_probe__', value);
          document.documentElement.dataset.pencilBladeParentRuntimeProbe = value;
          return {
            url: location.href,
            heading: document.querySelector('main h1')?.textContent?.trim() ?? '',
            storage: localStorage.getItem('__pencil_blade_parent_runtime_probe__'),
          };
        }, probeValue);
        if (
          parentBefore.url !== launcherUrl
          || parentBefore.heading.length === 0
          || parentBefore.storage !== probeValue
        ) {
          throw new Error(`Launcher parent probe could not be established at ${viewport.id}.`);
        }

        const launcher = launcherPage.locator('[data-play-load]');
        if (await launcher.count() !== 1) {
          throw new Error('Play launcher activation control is missing.');
        }
        await launcher.click();
        const frameLocator = launcherPage.locator('[data-play-launcher] iframe');
        await frameLocator.waitFor({ state: 'attached', timeout: timeoutMs });
        const frameSource = await frameLocator.getAttribute('src');
        if (
          frameSource !== new URL('play/game/', baseUrl).pathname
          && frameSource !== new URL('play/game/index.html', baseUrl).pathname
        ) {
          throw new Error(`Launcher iframe source drifted: ${String(frameSource)}.`);
        }
        if (gameRequests.length === 0) {
          throw new Error('Explicit activation did not request the game subtree.');
        }
        const frameHandle = await frameLocator.elementHandle();
        const gameFrame = await frameHandle?.contentFrame();
        if (!gameFrame) {
          throw new Error(`Launcher iframe has no accessible game frame at ${viewport.id}.`);
        }
        await gameFrame.waitForSelector('canvas', { state: 'visible', timeout: timeoutMs });
        await gameFrame.waitForFunction(() => {
          const canvas = document.querySelector('canvas');
          return canvas instanceof HTMLCanvasElement
            && canvas.width > 0
            && canvas.height > 0;
        }, undefined, { timeout: timeoutMs });
        await launcherPage.waitForTimeout(4_000);

        const inspectEmbeddedRuntime = () => gameFrame.evaluate(
          ({ expectedParentUrl, expectedProbe }) => {
            const canvas = document.querySelector('canvas');
            const bounds = canvas?.getBoundingClientRect();
            return {
              canvasVisible:
                canvas instanceof HTMLCanvasElement
                && (bounds?.width ?? 0) > 0
                && (bounds?.height ?? 0) > 0,
              embedded: self !== top,
              openerIsNull: opener === null,
              parentUrl: parent.location.href,
              parentHeading: parent.document.querySelector('main h1')?.textContent?.trim() ?? '',
              parentMarker:
                parent.document.documentElement.dataset.pencilBladeParentRuntimeProbe,
              parentStorage:
                parent.localStorage.getItem('__pencil_blade_parent_runtime_probe__'),
              sharedStorageProbe:
                localStorage.getItem('__pencil_blade_parent_runtime_probe__'),
              expectedParentUrl,
              expectedProbe,
            };
          },
          { expectedParentUrl: launcherUrl, expectedProbe: probeValue },
        );
        const assertEmbeddedRuntime = (snapshot, stage) => {
          if (
            snapshot.canvasVisible !== true
            || snapshot.embedded !== true
            || snapshot.openerIsNull !== true
            || snapshot.parentUrl !== snapshot.expectedParentUrl
            || snapshot.parentHeading !== parentBefore.heading
            || snapshot.parentMarker !== snapshot.expectedProbe
            || snapshot.parentStorage !== snapshot.expectedProbe
            || snapshot.sharedStorageProbe !== snapshot.expectedProbe
          ) {
            throw new Error(
              `Embedded H5 ${stage} violated parent/navigation/storage contracts at `
              + `${viewport.id}: ${JSON.stringify(snapshot)}`,
            );
          }
        };
        assertEmbeddedRuntime(await inspectEmbeddedRuntime(), 'load');
        if (failures.length > 0) {
          throw new Error(`Embedded H5 load failures: ${failures.join('; ')}`);
        }

        expectedNavigationAbort = true;
        try {
          await gameFrame.goto(new URL('play/game/', baseUrl).href, {
            waitUntil: 'domcontentloaded',
            timeout: timeoutMs,
          });
        } finally {
          expectedNavigationAbort = false;
        }
        await gameFrame.waitForSelector('canvas', { state: 'visible', timeout: timeoutMs });
        await launcherPage.waitForTimeout(4_000);
        assertEmbeddedRuntime(await inspectEmbeddedRuntime(), 'reload');
        if (failures.length > 0) {
          throw new Error(`Embedded H5 reload failures: ${failures.join('; ')}`);
        }

        expectedNavigationAbort = true;
        await frameLocator.evaluate((frame) => frame.remove());
        if (await launcherPage.locator('[data-play-launcher] iframe').count() !== 0) {
          throw new Error(`Launcher iframe removal failed at ${viewport.id}.`);
        }
        const parentAfterRemoval = await launcherPage.evaluate(() => ({
          url: location.href,
          heading: document.querySelector('main h1')?.textContent?.trim() ?? '',
          marker: document.documentElement.dataset.pencilBladeParentRuntimeProbe,
          storage: localStorage.getItem('__pencil_blade_parent_runtime_probe__'),
        }));
        if (
          parentAfterRemoval.url !== launcherUrl
          || parentAfterRemoval.heading !== parentBefore.heading
          || parentAfterRemoval.marker !== probeValue
          || parentAfterRemoval.storage !== probeValue
        ) {
          throw new Error(
            `Launcher parent changed after iframe removal at ${viewport.id}.`,
          );
        }
        await launcherPage.evaluate(() => {
          localStorage.removeItem('__pencil_blade_parent_runtime_probe__');
          delete document.documentElement.dataset.pencilBladeParentRuntimeProbe;
        });
        if (failures.length > 0) {
          throw new Error(`Embedded H5 browser failures: ${failures.join('; ')}`);
        }
        embeddedGameViewports.push(viewport.id);
      } finally {
        await launcherPage.unrouteAll({ behavior: 'ignoreErrors' });
        await context.close();
      }
    }

    const directGameViewports = [];
    for (const viewport of supportedViewports) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const failures = [];
      await installBrowserTransientRetries(
        page,
        baseUrl,
        fetchRetryOptions,
        (response) => failures.push(`http ${response.status()}: ${response.url()}`),
      );
      page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
      page.on('requestfailed', (request) =>
        failures.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ''}`));
      page.on('response', (response) => {
        if (
          response.status() >= 400
          && !TRANSIENT_HTTP_STATUSES.has(response.status())
        ) {
          failures.push(`http ${response.status()}: ${response.url()}`);
        }
      });
      try {
        await page.goto(new URL('play/game/', baseUrl).href, {
          waitUntil: 'domcontentloaded',
          timeout: timeoutMs,
        });
        await page.locator('canvas').first().waitFor({ state: 'visible', timeout: timeoutMs });
        const bounds = await page.locator('canvas').first().boundingBox();
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
          throw new Error(
            `Direct H5 canvas has invalid geometry at ${viewport.id}.`,
          );
        }
        if (failures.length > 0) {
          throw new Error(`Direct H5 browser failures: ${failures.join('; ')}`);
        }
        directGameViewports.push(viewport.id);
      } finally {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await page.close();
      }
    }
    return Object.freeze({
      status: 'pass',
      launcherNoPreload: true,
      launcherActivation: true,
      launcherParentIntegrity: true,
      launcherStoragePreserved: true,
      launcherIframeReload: true,
      launcherIframeRemoval: true,
      embeddedGameViewports: Object.freeze(embeddedGameViewports),
      directGameViewports: Object.freeze(directGameViewports),
    });
  } finally {
    await browser?.close();
  }
}

export async function smokeProductionPages({
  baseUrl,
  expectedCommit,
  expectedRunId,
  expectedRunAttempt,
  expectedContentDigest,
  expectedTreeManifestDigest,
  fetchImpl = globalThis.fetch,
  concurrency = DEFAULT_CONCURRENCY,
  fetchAttempts = DEFAULT_FETCH_ATTEMPTS,
  fetchRetryDelayMs = DEFAULT_FETCH_RETRY_DELAY_MS,
  cacheToken = `${expectedRunId}-${expectedRunAttempt}`,
  journeyRunner,
  filesOnly = false,
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required.');
  }
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
    throw new Error('Production smoke concurrency must be between 1 and 32.');
  }
  validateFetchRetryOptions(fetchAttempts, fetchRetryDelayMs);
  const fetchOptions = {
    attempts: fetchAttempts,
    retryDelayMs: fetchRetryDelayMs,
  };
  if (!DIGEST_PATTERN.test(expectedTreeManifestDigest ?? '')) {
    throw new Error('Expected tree-manifest digest must be a SHA-256.');
  }
  const normalizedBase = normalizedBaseUrl(baseUrl);
  const treeResponse = await fetchBytes(
    fetchImpl,
    cacheBusted(normalizedBase, 'case-study-tree-manifest.json', cacheToken),
    'case-study-tree-manifest.json',
    fetchOptions,
  );
  if (!contentTypeMatches('case-study-tree-manifest.json', treeResponse.contentType)) {
    throw new Error('Tree manifest has an unacceptable live MIME type.');
  }
  if (sha256(treeResponse.bytes) !== expectedTreeManifestDigest) {
    throw new Error('Live tree-manifest bytes do not match the approved digest.');
  }
  const treeManifest = JSON.parse(treeResponse.bytes.toString('utf8'));
  const files = normalizeManifestFiles(treeManifest);
  assertNoForbiddenRouteFiles(
    files.map((file) => file.path),
    'production tree manifest',
  );
  assertExactPublicRouteFiles(
    files.map((file) => file.path),
    'production tree manifest',
  );
  const releaseFile = files.find((file) => file.path === 'case-study-release.json');
  if (!releaseFile) {
    throw new Error('Tree manifest does not list case-study-release.json.');
  }

  const observations = await mapBounded(
    files,
    concurrency,
    async (file) => {
      const result = await fetchBytes(
        fetchImpl,
        cacheBusted(normalizedBase, file.path, cacheToken),
        file.path,
        fetchOptions,
      );
      if (result.bytes.length !== file.bytes) {
        throw new Error(`${file.path} live byte size does not match the tree manifest.`);
      }
      const digest = sha256(result.bytes);
      if (digest !== file.sha256) {
        throw new Error(`${file.path} live SHA-256 does not match the tree manifest.`);
      }
      if (!contentTypeMatches(file.path, result.contentType)) {
        throw new Error(`${file.path} has unacceptable live MIME ${result.contentType}.`);
      }
      return Object.freeze({
        path: file.path,
        bytes: file.bytes,
        sha256: digest,
        contentType: result.contentType,
        sitemapSource: /(?:^|\/)sitemap[^/]*\.xml$/u.test(file.path)
          ? result.bytes.toString('utf8')
          : undefined,
      });
    },
  );
  const sitemapSources = observations
    .map((record) => record.sitemapSource)
    .filter((source) => source !== undefined);
  assertExactSitemapRoutes(
    sitemapSources,
    new URL(normalizedBase).pathname,
    'production sitemap',
  );

  const releaseObservation = observations.find((record) =>
    record.path === 'case-study-release.json');
  if (releaseObservation.sha256 !== releaseFile.sha256) {
    throw new Error('Release record hash does not match its tree-manifest entry.');
  }
  const releaseResponse = await fetchBytes(
    fetchImpl,
    cacheBusted(normalizedBase, 'case-study-release.json', `${cacheToken}-identity`),
    'case-study-release.json identity recheck',
    fetchOptions,
  );
  if (sha256(releaseResponse.bytes) !== releaseFile.sha256) {
    throw new Error('Release record changed between manifest-wide fetch and identity recheck.');
  }
  const releaseRecord = JSON.parse(releaseResponse.bytes.toString('utf8'));
  if (
    !hasExpectedPublicRoutes(releaseRecord.publication?.routes)
  ) {
    throw new Error('Live release record has an unexpected public route set.');
  }
  const identity = validateExpectedIdentity(releaseRecord, {
    commitSha: expectedCommit,
    workflowRunId: expectedRunId,
    workflowRunAttempt: expectedRunAttempt,
    contentTreeDigestSha256: expectedContentDigest,
  });

  const filePaths = new Set(files.map((file) => file.path));
  for (const route of REQUIRED_ROUTES) {
    const expectedPath = route === ''
      ? 'index.html'
      : route.endsWith('/')
        ? `${route}index.html`
        : route;
    if (!filePaths.has(expectedPath)) {
      throw new Error(`Required production route is absent from the tree manifest: ${route || '/'}.`);
    }
  }
  await assertRemovedRoutesUnavailable(
    fetchImpl,
    normalizedBase,
    cacheToken,
    fetchOptions,
  );

  let journeys = Object.freeze({ status: 'not-run-files-only' });
  if (!filesOnly) {
    if (typeof journeyRunner !== 'function') {
      throw new Error('Production smoke requires explicit browser journeys unless filesOnly is set.');
    }
    journeys = await journeyRunner({
      baseUrl: normalizedBase,
      releaseRecord,
      treeManifest,
    });
    if (
      journeys?.status !== 'pass'
      || journeys.launcherNoPreload !== true
      || journeys.launcherActivation !== true
      || journeys.launcherParentIntegrity !== true
      || journeys.launcherStoragePreserved !== true
      || journeys.launcherIframeReload !== true
      || journeys.launcherIframeRemoval !== true
      || JSON.stringify(journeys.embeddedGameViewports)
        !== JSON.stringify(['480x800', '720x1280'])
      || JSON.stringify(journeys.directGameViewports) !== JSON.stringify(['480x800', '720x1280'])
    ) {
      throw new Error('Production browser journey contract did not pass completely.');
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    reportType: 'case-study-production-smoke',
    status: 'pass',
    baseUrl: normalizedBase.href,
    identity,
    treeManifestDigestSha256: expectedTreeManifestDigest,
    filesVerified: observations.length,
    bytesVerified: observations.reduce((total, record) => total + record.bytes, 0),
    requiredRoutes: REQUIRED_ROUTES,
    journeys,
  });
}

function parseArguments(arguments_) {
  const options = { ci: false, files_only: false };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--ci') {
      options.ci = true;
      continue;
    }
    if (argument === '--files-only') {
      options.files_only = true;
      continue;
    }
    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected argument ${argument}.`);
    }
    const value = arguments_[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${argument} requires a value.`);
    }
    options[argument.slice(2).replaceAll('-', '_')] = value;
    index += 1;
  }
  return options;
}

export function safeReportDirectory(pathValue) {
  if (
    typeof pathValue !== 'string'
    || pathValue.length === 0
    || pathValue.includes('\0')
  ) {
    throw new Error('Report directory must be an explicit filesystem path.');
  }
  const absolute = resolve(pathValue);
  if (
    basename(absolute).length === 0
    || dirname(absolute) === absolute
  ) {
    throw new Error('Report directory cannot be a filesystem root.');
  }
  if (existsSync(absolute)) {
    throw new Error('Production smoke report directory must not already exist.');
  }
  return absolute;
}

export async function runCli(arguments_ = process.argv.slice(2)) {
  let stagingDirectory;
  let candidateServer;
  try {
    const options = parseArguments(arguments_);
    if (!options.ci) {
      throw new Error('Production smoke CLI requires --ci and explicit release identity.');
    }
    const hasBaseUrl = typeof options.base_url === 'string' && options.base_url.length > 0;
    const hasCandidateDirectory =
      typeof options.candidate_dir === 'string' && options.candidate_dir.length > 0;
    if (hasBaseUrl === hasCandidateDirectory) {
      throw new Error(
        'Production smoke requires exactly one of --base-url or --candidate-dir.',
      );
    }
    const reportDirectory = safeReportDirectory(options.report_dir);
    stagingDirectory = `${reportDirectory}.staging-${process.pid}`;
    if (existsSync(stagingDirectory)) {
      throw new Error('Production smoke staging directory already exists.');
    }
    mkdirSync(stagingDirectory, { recursive: false });
    const journeyRunner = options.files_only
      ? undefined
      : ({ baseUrl }) => runProductionBrowserJourneys({
        baseUrl,
        playwrightModuleDir: resolve(REPOSITORY_ROOT, options.playwright_module_dir),
        browserExecutable: options.browser_executable,
      });
    if (hasCandidateDirectory) {
      candidateServer = await serveCaseStudyCandidate(
        resolve(REPOSITORY_ROOT, options.candidate_dir),
      );
    }
    const report = await smokeProductionPages({
      baseUrl: candidateServer?.url ?? options.base_url,
      expectedCommit: options.expected_commit,
      expectedRunId: options.expected_run_id,
      expectedRunAttempt: options.expected_run_attempt,
      expectedContentDigest: options.expected_content_digest,
      expectedTreeManifestDigest: options.expected_tree_manifest_digest,
      concurrency: options.concurrency
        ? Number(options.concurrency)
        : DEFAULT_CONCURRENCY,
      journeyRunner,
      filesOnly: options.files_only,
    });
    if (candidateServer) {
      await candidateServer.close();
      candidateServer = undefined;
    }
    const reportPath = resolve(stagingDirectory, 'case-study-production-smoke.json');
    writeFileSync(reportPath, `${JSON.stringify({
      ...report,
      observedAt: new Date().toISOString(),
    }, null, 2)}\n`, { flag: 'wx' });
    renameSync(stagingDirectory, reportDirectory);
    stagingDirectory = undefined;
    process.stdout.write(
      `Production smoke passed: ${report.filesVerified} files, ${report.bytesVerified} bytes.\n`,
    );
    return 0;
  } catch (caught) {
    let error = caught;
    if (candidateServer) {
      try {
        await candidateServer.close();
      } catch (closeError) {
        error = new AggregateError(
          [caught, closeError],
          'Candidate smoke failed and its server did not close cleanly.',
        );
      }
    }
    if (stagingDirectory && existsSync(stagingDirectory)) {
      rmSync(stagingDirectory, { recursive: true, force: true });
    }
    process.stderr.write(`CASE_STUDY_PRODUCTION_SMOKE_ERROR: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runCli();
}
