#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, platform } from 'node:os';
import {
  basename,
  dirname,
  join,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  inspectWebBuildDirectory,
} from './audit-web-build.mjs';
import {
  createWebBuildVerificationConfig,
  createPagesPrefixServer,
  PAGES_PREFIX,
} from './verify-web-mobile-build.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_BUILD_DIR = 'game/build/web-mobile-pages';
const HISTORICAL_REPORT_DIR =
  'plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix';
const DEFAULT_REPORT_DIR =
  'plans/260725-2334-pencil-blade-interactive-case-study/reports/runtime-matrix/h5-local';
const REPORT_FILENAME = 'case-study-h5-runtime-matrix.json';
export const H5_RUNTIME_MATRIX_VIEWPORTS = Object.freeze([
  Object.freeze({ id: 'chrome-480x800', width: 480, height: 800 }),
  Object.freeze({ id: 'chrome-720x1280', width: 720, height: 1280 }),
]);

export function createH5RuntimeMatrixConfig(options = {}) {
  const ci = options.ci === true;
  if (ci) {
    const required = [
      ['buildDirectory', options.buildDirectory],
      ['pagesPrefix', options.pagesPrefix],
      ['entryPath', options.entryPath],
      ['reportDirectory', options.reportDirectory ?? options.outputDirectory],
      ['playwrightModuleDirectory', options.playwrightModuleDirectory],
    ];
    const missing = required
      .filter(([, value]) => typeof value !== 'string' || value.length === 0)
      .map(([name]) => name);
    if (missing.length > 0) {
      throw new Error(`CI mode requires explicit ${missing.join(', ')}`);
    }
  }

  const buildDirectory = resolve(ROOT, options.buildDirectory ?? DEFAULT_BUILD_DIR);
  const reportDirectory = resolve(
    ROOT,
    options.reportDirectory ?? options.outputDirectory ?? DEFAULT_REPORT_DIR,
  );
  const historicalReportDirectory = resolve(ROOT, HISTORICAL_REPORT_DIR);
  if (reportDirectory === historicalReportDirectory) {
    throw new Error('historical H5 runtime evidence is immutable; choose a new report directory');
  }
  const verification = createWebBuildVerificationConfig({
    buildDirectory,
    pagesPrefix: options.pagesPrefix ?? PAGES_PREFIX,
    entryPath: options.entryPath ?? 'index.html',
  });
  const playwrightModuleDirectory =
    options.playwrightModuleDirectory
    ?? (ci ? undefined : process.env.PLAYWRIGHT_MODULE_DIR);
  const browserExecutable =
    options.browserExecutable
    ?? options.chromeExecutable
    ?? (ci ? undefined : process.env.CHROME_EXECUTABLE);
  const explicitCiPaths = [
    options.buildDirectory,
    options.reportDirectory ?? options.outputDirectory,
    options.playwrightModuleDirectory,
    options.browserExecutable ?? options.chromeExecutable,
  ].filter((value) => typeof value === 'string');
  if (ci && explicitCiPaths.some((value) => (
    value.startsWith('/Users/')
    || value === homedir()
    || value.startsWith(`${homedir()}/`)
  ))) {
    throw new Error('CI inputs must not use a workstation path');
  }

  return Object.freeze({
    browserExecutable:
      browserExecutable === undefined ? undefined : resolve(browserExecutable),
    buildDirectory: verification.buildDirectory,
    ci,
    entryPath: verification.entryPath,
    pagesPrefix: verification.pagesPrefix,
    playwrightModuleDirectory:
      playwrightModuleDirectory === undefined
        ? undefined
        : resolve(playwrightModuleDirectory),
    reportDirectory,
  });
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function treeDigest(files) {
  return sha256(
    files
      .map((file) => `${file.path}\0${file.size}\0${file.sha256}\n`)
      .sort()
      .join(''),
  );
}

async function listen(server) {
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
}

async function close(server) {
  if (server === null || server === undefined || server.listening === false) {
    return;
  }
  await new Promise((accept, reject) => {
    server.close((error) => (error === undefined ? accept() : reject(error)));
  });
}

function loadPlaywright(moduleDirectory) {
  if (moduleDirectory === undefined) {
    throw new Error('Playwright module directory is required');
  }
  const requireFromBundle = createRequire(join(moduleDirectory, 'package.json'));
  const playwright = requireFromBundle('playwright');
  const packageRecord = requireFromBundle('playwright/package.json');
  const playwrightCoreDirectory = dirname(
    requireFromBundle.resolve('playwright-core/package.json'),
  );
  const browsersRecord = JSON.parse(
    readFileSync(join(playwrightCoreDirectory, 'browsers.json'), 'utf8'),
  );
  const chromiumRecord = browsersRecord.browsers.find(
    (record) => record.name === 'chromium',
  );
  if (
    typeof packageRecord.version !== 'string'
    || chromiumRecord === undefined
    || typeof chromiumRecord.revision !== 'string'
  ) {
    throw new Error('Playwright Chromium identity metadata is incomplete');
  }
  return Object.freeze({
    chromium: playwright.chromium,
    identity: Object.freeze({
      package: 'playwright',
      packageVersion: packageRecord.version,
      product: 'Chromium',
      revision: chromiumRecord.revision,
    }),
  });
}

async function dispatchSwipe(context, page, viewport, start, end) {
  const session = await context.newCDPSession(page);
  const points = 12;
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{
      x: viewport.width * start.x,
      y: viewport.height * start.y,
      radiusX: 5,
      radiusY: 5,
      force: 1,
      id: 1,
    }],
  });
  for (let index = 1; index <= points; index += 1) {
    const progress = index / points;
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{
        x: viewport.width * (start.x + ((end.x - start.x) * progress)),
        y: viewport.height * (start.y + ((end.y - start.y) * progress)),
        radiusX: 5,
        radiusY: 5,
        force: 1,
        id: 1,
      }],
    });
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await session.detach();
}

async function audioSnapshot(page) {
  return page.evaluate(() => ({
    trackedContextStates: (globalThis.__pencilBladeAudioContexts ?? [])
      .map((context) => context.state),
    htmlAudioElements: [...document.querySelectorAll('audio')].map((audio) => ({
      currentTime: audio.currentTime,
      ended: audio.ended,
      paused: audio.paused,
      readyState: audio.readyState,
    })),
  }));
}

function audioIsVerified(snapshot) {
  return snapshot.trackedContextStates.includes('running')
    || snapshot.htmlAudioElements.some((audio) => (
      !audio.paused && !audio.ended && audio.readyState >= 2
    ));
}

async function waitForCanvas(page) {
  await page.waitForSelector('canvas', { state: 'visible', timeout: 30_000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas');
    return canvas instanceof HTMLCanvasElement
      && canvas.width > 0
      && canvas.height > 0;
  }, { timeout: 30_000 });
  await page.waitForTimeout(4_000);
}

async function canvasGeometry(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Cocos canvas is missing');
    }
    const rect = canvas.getBoundingClientRect();
    return {
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      clientWidth: rect.width,
      clientHeight: rect.height,
      left: rect.left,
      top: rect.top,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      bodyScrollWidth: document.body.scrollWidth,
      bodyScrollHeight: document.body.scrollHeight,
      devicePixelRatio,
    };
  });
}

function assertGeometry(geometry, viewport) {
  if (
    geometry.viewportWidth !== viewport.width
    || geometry.viewportHeight !== viewport.height
    || geometry.bodyScrollWidth > viewport.width
    || geometry.bodyScrollHeight > viewport.height
    || geometry.clientWidth <= 0
    || geometry.clientHeight <= 0
  ) {
    throw new Error(`Invalid ${viewport.id} canvas geometry: ${JSON.stringify(geometry)}`);
  }
}

async function performFullscreenRoundTrip(page, viewport) {
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    globalThis.__pencilBladeFullscreenProbe = {
      complete: false,
      entered: false,
      exited: false,
      reason: null,
    };
    if (
      !(canvas instanceof HTMLCanvasElement)
      || typeof canvas.requestFullscreen !== 'function'
      || typeof document.exitFullscreen !== 'function'
    ) {
      globalThis.__pencilBladeFullscreenProbe.complete = true;
      globalThis.__pencilBladeFullscreenProbe.reason = 'Fullscreen API unavailable';
      return;
    }
    canvas.addEventListener('pointerdown', () => {
      canvas.requestFullscreen()
        .then(async () => {
          globalThis.__pencilBladeFullscreenProbe.entered =
            document.fullscreenElement === canvas;
          if (document.fullscreenElement !== null) {
            await document.exitFullscreen();
          }
          globalThis.__pencilBladeFullscreenProbe.exited =
            document.fullscreenElement === null;
        })
        .catch((error) => {
          globalThis.__pencilBladeFullscreenProbe.reason =
            error instanceof Error ? error.name : 'Fullscreen request failed';
        })
        .finally(() => {
          globalThis.__pencilBladeFullscreenProbe.complete = true;
        });
    }, { once: true });
  });
  await page.locator('canvas').click({
    position: {
      x: Math.max(1, Math.floor(viewport.width / 2)),
      y: Math.max(1, Math.floor(viewport.height / 2)),
    },
  });
  await page.waitForFunction(
    () => globalThis.__pencilBladeFullscreenProbe?.complete === true,
    undefined,
    { timeout: 10_000 },
  );
  const state = await page.evaluate(() => {
    const result = globalThis.__pencilBladeFullscreenProbe;
    delete globalThis.__pencilBladeFullscreenProbe;
    return {
      entered: result?.entered === true,
      exited: result?.exited === true,
      reason: result?.reason ?? null,
    };
  });
  await page.waitForTimeout(250);
  const geometry = await canvasGeometry(page);
  let geometryValidAfterExit = true;
  try {
    assertGeometry(geometry, viewport);
  } catch {
    geometryValidAfterExit = false;
  }
  return {
    ...state,
    canvasVisibleAfterExit: await page.locator('canvas').isVisible(),
    geometryAfterExit: geometry,
    geometryValidAfterExit,
  };
}

export function assertRuntimeRowPasses(row) {
  const failures = [];
  const requirePredicate = (condition, label) => {
    if (!condition) {
      failures.push(label);
    }
  };

  requirePredicate(row.input?.newGameGestureChangedFrame === true, 'new-game input');
  requirePredicate(row.input?.classicGestureChangedFrame === true, 'classic input');
  requirePredicate(row.audio?.backendAvailable === true, 'audio backend');
  requirePredicate(row.audio?.verifiedAfterInput === true, 'post-input audio');
  requirePredicate(row.storage?.retainedAcrossLifecycle === true, 'storage persistence');
  requirePredicate(row.storage?.probeRemovedAfterTest === true, 'storage probe cleanup');
  requirePredicate(row.lifecycle?.backgroundForeground === 'pass', 'resume lifecycle');
  requirePredicate(row.lifecycle?.canvasVisibleAfterResume === true, 'resume canvas visibility');
  requirePredicate(row.lifecycle?.geometryValidAfterResume === true, 'resume geometry');
  requirePredicate(row.fullscreen?.entered === true, 'fullscreen enter');
  requirePredicate(row.fullscreen?.exited === true, 'fullscreen exit');
  requirePredicate(row.fullscreen?.canvasVisibleAfterExit === true, 'fullscreen canvas return');
  requirePredicate(row.fullscreen?.geometryValidAfterExit === true, 'fullscreen return geometry');
  requirePredicate(row.orientation?.declared === 'portrait', 'orientation declaration');
  requirePredicate(row.orientation?.landscapeGeometryValid === true, 'landscape geometry');
  requirePredicate(
    row.orientation?.restoredPortraitGeometryValid === true,
    'portrait restoration geometry',
  );
  requirePredicate(row.offline?.postLoadGameplay === 'pass', 'offline gameplay');
  requirePredicate(row.offline?.canvasVisible === true, 'offline canvas visibility');
  requirePredicate((row.console?.errors ?? []).length === 0, 'console errors');
  requirePredicate((row.console?.pageErrors ?? []).length === 0, 'page errors');
  requirePredicate((row.console?.requestFailures ?? []).length === 0, 'request failures');
  requirePredicate((row.console?.badResponses ?? []).length === 0, 'bad responses');
  requirePredicate((row.console?.unexpectedRequests ?? []).length === 0, 'unexpected requests');

  if (failures.length > 0) {
    throw new Error(`${row.id ?? 'runtime row'} failed: ${failures.join(', ')}`);
  }
  return true;
}

export async function runViewport(
  browser,
  origin,
  viewport,
  outputDirectory,
  config,
) {
  let context = null;
  let page = null;
  let backgroundPage = null;
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const badResponses = [];
  const runtimeRequests = [];
  try {
    context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true,
      locale: 'en-US',
      serviceWorkers: 'block',
    });
    await context.route('**/favicon.ico', (route) => route.fulfill({
      status: 204,
      body: '',
    }));
    page = await context.newPage();
    page.on('console', (message) => {
      consoleMessages.push({ type: message.type(), text: message.text() });
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });
    page.on('requestfailed', (request) => {
      requestFailures.push({
        url: request.url(),
        errorText: request.failure()?.errorText ?? 'unknown',
      });
    });
    page.on('request', (request) => {
      runtimeRequests.push(request.url());
    });
    page.on('response', (response) => {
      if (response.status() >= 400) {
        badResponses.push({
          status: response.status(),
          url: response.url(),
        });
      }
    });
    await page.addInitScript(() => {
      globalThis.__pencilBladeAudioContexts = [];
      for (const name of ['AudioContext', 'webkitAudioContext']) {
        const NativeAudioContext = globalThis[name];
        if (typeof NativeAudioContext !== 'function') {
          continue;
        }
        function TrackedAudioContext(...args) {
          const instance = new NativeAudioContext(...args);
          globalThis.__pencilBladeAudioContexts.push(instance);
          return instance;
        }
        TrackedAudioContext.prototype = NativeAudioContext.prototype;
        Object.setPrototypeOf(TrackedAudioContext, NativeAudioContext);
        globalThis[name] = TrackedAudioContext;
      }
    });
    await page.goto(`${origin}${config.pagesPrefix}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForCanvas(page);
    const initialGeometry = await canvasGeometry(page);
    assertGeometry(initialGeometry, viewport);
    const initialScreenshot = resolve(outputDirectory, `${viewport.id}-main-menu.png`);
    await page.screenshot({ path: initialScreenshot, fullPage: false });
    const initialSha256 = sha256(readFileSync(initialScreenshot));
    const audioBeforeInput = await audioSnapshot(page);

    await dispatchSwipe(
      context,
      page,
      viewport,
      { x: 0.38, y: 0.64 },
      { x: 0.78, y: 0.64 },
    );
    await page.waitForTimeout(2_000);
    const modeSelectScreenshot = resolve(outputDirectory, `${viewport.id}-mode-select.png`);
    await page.screenshot({ path: modeSelectScreenshot, fullPage: false });
    const modeSelectSha256 = sha256(readFileSync(modeSelectScreenshot));
    if (modeSelectSha256 === initialSha256) {
      throw new Error(`${viewport.id} New Game touch gesture did not change the rendered frame`);
    }

    await dispatchSwipe(
      context,
      page,
      viewport,
      { x: 0.30, y: 0.58 },
      { x: 0.72, y: 0.58 },
    );
    await page.waitForTimeout(3_000);
    const gameplayScreenshot = resolve(outputDirectory, `${viewport.id}-classic.png`);
    await page.screenshot({ path: gameplayScreenshot, fullPage: false });
    const gameplaySha256 = sha256(readFileSync(gameplayScreenshot));
    if (gameplaySha256 === modeSelectSha256) {
      throw new Error(`${viewport.id} Classic touch gesture did not change the rendered frame`);
    }

    const audioAfterInput = await audioSnapshot(page);
    const audioBackendAvailable = audioAfterInput.trackedContextStates.length > 0
      || audioAfterInput.htmlAudioElements.length > 0;
    const verifiedAfterInput = audioIsVerified(audioAfterInput);
    if (!audioBackendAvailable) {
      throw new Error(`${viewport.id} created no WebAudio or HTMLAudio backend`);
    }
    if (!verifiedAfterInput) {
      throw new Error(`${viewport.id} audio was not running after explicit input`);
    }

    const storageProbeValue = `${viewport.id}:pencil-blade-runtime-matrix`;
    const storageBeforeLifecycle = await page.evaluate((value) => {
      localStorage.setItem('__pencil_blade_runtime_matrix__', value);
      return {
        count: localStorage.length,
        keys: Object.keys(localStorage).sort(),
        probeValue: localStorage.getItem('__pencil_blade_runtime_matrix__'),
      };
    }, storageProbeValue);
    backgroundPage = await context.newPage();
    await backgroundPage.goto('about:blank');
    await backgroundPage.bringToFront();
    await page.waitForTimeout(250);
    await page.bringToFront();
    await page.waitForTimeout(500);
    await backgroundPage.close();
    backgroundPage = null;
    const storageAfterLifecycle = await page.evaluate(() => ({
      count: localStorage.length,
      keys: Object.keys(localStorage).sort(),
      probeValue: localStorage.getItem('__pencil_blade_runtime_matrix__'),
    }));
    const retainedAcrossLifecycle =
      storageAfterLifecycle.probeValue === storageProbeValue;
    if (!retainedAcrossLifecycle) {
      throw new Error(`${viewport.id} storage sentinel was lost across lifecycle`);
    }
    const probeRemovedAfterTest = await page.evaluate(() => {
      localStorage.removeItem('__pencil_blade_runtime_matrix__');
      return localStorage.getItem('__pencil_blade_runtime_matrix__') === null;
    });
    if (!probeRemovedAfterTest) {
      throw new Error(`${viewport.id} storage sentinel cleanup failed`);
    }

    const canvasVisibleAfterResume = await page.locator('canvas').isVisible();
    const resumedGeometry = await canvasGeometry(page);
    let geometryValidAfterResume = true;
    try {
      assertGeometry(resumedGeometry, viewport);
    } catch {
      geometryValidAfterResume = false;
    }
    if (!canvasVisibleAfterResume || !geometryValidAfterResume) {
      throw new Error(`${viewport.id} did not restore visible canvas geometry after resume`);
    }

    await context.setOffline(true);
    await dispatchSwipe(
      context,
      page,
      viewport,
      { x: 0.20, y: 0.72 },
      { x: 0.80, y: 0.45 },
    );
    await page.waitForTimeout(500);
    const offlineCanvasVisible = await page.locator('canvas').isVisible();
    await context.setOffline(false);
    if (!offlineCanvasVisible) {
      throw new Error(`${viewport.id} canvas disappeared during offline gameplay`);
    }

    await page.setViewportSize({ width: viewport.height, height: viewport.width });
    await page.waitForTimeout(300);
    const landscapeGeometry = await canvasGeometry(page);
    let landscapeGeometryValid = true;
    try {
      assertGeometry(landscapeGeometry, {
        id: `${viewport.id}-landscape`,
        width: viewport.height,
        height: viewport.width,
      });
    } catch {
      landscapeGeometryValid = false;
    }
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(300);
    const restoredGeometry = await canvasGeometry(page);
    let restoredPortraitGeometryValid = true;
    try {
      assertGeometry(restoredGeometry, viewport);
    } catch {
      restoredPortraitGeometryValid = false;
    }
    if (!landscapeGeometryValid || !restoredPortraitGeometryValid) {
      throw new Error(`${viewport.id} viewport/orientation geometry did not restore`);
    }

    const fullscreen = await performFullscreenRoundTrip(page, viewport);
    if (
      !fullscreen.entered
      || !fullscreen.exited
      || !fullscreen.canvasVisibleAfterExit
      || !fullscreen.geometryValidAfterExit
    ) {
      throw new Error(`${viewport.id} fullscreen round trip failed`);
    }

    const relevantConsoleErrors = consoleMessages.filter(
      (message) => message.type === 'error'
        && !message.text.includes('[Assets] [buildScriptCommand][BABEL]'),
    );
    const unexpectedRequests = runtimeRequests
      .filter((url) => /^https?:/u.test(url))
      .filter((url) => {
        const parsed = new URL(url);
        return parsed.origin !== origin
          || !parsed.pathname.startsWith(config.pagesPrefix);
      });
    if (
      pageErrors.length > 0
      || relevantConsoleErrors.length > 0
      || requestFailures.length > 0
      || badResponses.length > 0
      || unexpectedRequests.length > 0
    ) {
      throw new Error(
        `${viewport.id} browser failures: ${JSON.stringify({
          badResponses,
          pageErrors,
          relevantConsoleErrors,
          requestFailures,
          unexpectedRequests,
        })}`,
      );
    }

    const row = {
      id: viewport.id,
      viewport: { width: viewport.width, height: viewport.height, devicePixelRatio: 1 },
      input: {
        newGameGestureChangedFrame: true,
        classicGestureChangedFrame: true,
        mainMenuSha256: initialSha256,
        modeSelectSha256,
        gameplaySha256,
      },
      audio: {
        beforeInput: audioBeforeInput,
        afterInput: audioAfterInput,
        backendAvailable: audioBackendAvailable,
        verifiedAfterInput,
      },
      storage: {
        beforeLifecycle: storageBeforeLifecycle,
        afterLifecycle: storageAfterLifecycle,
        retainedAcrossLifecycle,
        probeRemovedAfterTest,
      },
      lifecycle: {
        backgroundForeground: 'pass',
        canvasVisibleAfterResume,
        geometryAfterResume: resumedGeometry,
        geometryValidAfterResume,
      },
      fullscreen,
      orientation: {
        declared: 'portrait',
        landscapeDiagnostic: landscapeGeometry,
        landscapeGeometryValid,
        restoredPortrait: restoredGeometry,
        restoredPortraitGeometryValid,
      },
      offline: {
        postLoadGameplay: 'pass',
        canvasVisible: offlineCanvasVisible,
      },
      console: {
        messages: consoleMessages,
        errors: relevantConsoleErrors,
        pageErrors,
        requestFailures,
        badResponses,
        unexpectedRequests,
      },
      screenshots: [
        { path: basename(initialScreenshot), sha256: initialSha256 },
        { path: basename(modeSelectScreenshot), sha256: modeSelectSha256 },
        { path: basename(gameplayScreenshot), sha256: gameplaySha256 },
      ],
    };
    assertRuntimeRowPasses(row);
    return { ...row, status: 'pass' };
  } finally {
    const cleanupErrors = [];
    for (const resource of [backgroundPage, page, context]) {
      if (resource === null) {
        continue;
      }
      try {
        await resource.close();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        cleanupErrors,
        `${viewport.id} browser resource cleanup failed`,
      );
    }
  }
}

function writeJsonAtomically(directory, filename, value) {
  const finalPath = resolve(directory, filename);
  const temporaryPath = resolve(
    directory,
    `.${filename}.tmp-${process.pid}-${Date.now()}`,
  );
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    flag: 'wx',
  });
  renameSync(temporaryPath, finalPath);
  return finalPath;
}

function removeStagingDirectory(directory) {
  if (directory !== undefined && existsSync(directory)) {
    rmSync(directory, { force: true, recursive: true });
  }
}

function defaultRuntimeDependencies() {
  return {
    closeServer: close,
    createServer: (audit, config, requests) => (
      createPagesPrefixServer(audit, config, requests)
    ),
    inspectBuild: inspectWebBuildDirectory,
    listenServer: listen,
    loadPlaywright,
    now: () => new Date().toISOString(),
    platform: () => Object.freeze({
      architecture: process.arch,
      operatingSystem: platform(),
    }),
    runViewport,
  };
}

export async function runH5RuntimeMatrix(options = {}, dependencyOverrides = {}) {
  const config = createH5RuntimeMatrixConfig(options);
  const dependencies = {
    ...defaultRuntimeDependencies(),
    ...dependencyOverrides,
  };
  if (existsSync(config.reportDirectory)) {
    throw new Error('report directory already exists; select a fresh destination');
  }

  const reportParent = dirname(config.reportDirectory);
  mkdirSync(reportParent, { recursive: true });
  const stagingDirectory = mkdtempSync(
    join(reportParent, `.${basename(config.reportDirectory)}-staging-`),
  );
  let server = null;
  let browser = null;
  let report;
  let primaryError;
  const cleanupErrors = [];

  try {
    const audit = dependencies.inspectBuild(config.buildDirectory);
    if (audit.findings.length > 0) {
      throw new Error(`Web build audit failed: ${JSON.stringify(audit.findings)}`);
    }

    const requests = [];
    server = dependencies.createServer(audit, config, requests);
    await dependencies.listenServer(server);
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('H5 runtime server did not bind a loopback port');
    }

    const playwrightBundle = dependencies.loadPlaywright(
      config.playwrightModuleDirectory,
    );
    const privateBrowserExecutable =
      config.browserExecutable ?? playwrightBundle.chromium.executablePath();
    if (
      typeof privateBrowserExecutable !== 'string'
      || privateBrowserExecutable.length === 0
    ) {
      throw new Error('Playwright did not provide a Chromium executable');
    }
    browser = await playwrightBundle.chromium.launch({
      executablePath: privateBrowserExecutable,
      headless: true,
    });

    const origin = `http://127.0.0.1:${address.port}`;
    const rows = [];
    for (const viewport of H5_RUNTIME_MATRIX_VIEWPORTS) {
      const row = await dependencies.runViewport(
        browser,
        origin,
        viewport,
        stagingDirectory,
        config,
      );
      assertRuntimeRowPasses(row);
      rows.push(Object.freeze({ ...row, status: 'pass' }));
    }
    const outsidePagesPrefix = requests.filter((requestRecord) => (
      !requestRecord.path.startsWith(config.pagesPrefix)
    )).length;
    if (outsidePagesPrefix > 0) {
      throw new Error('runtime server received a request outside the configured Pages prefix');
    }

    report = Object.freeze({
      schemaVersion: 2,
      reportKind: 'case-study-h5-runtime-matrix',
      capturedAt: dependencies.now(),
      browser: Object.freeze({
        ...playwrightBundle.identity,
        version: await browser.version(),
        platform: dependencies.platform(),
      }),
      build: Object.freeze({
        files: audit.files.length,
        bytes: audit.totalBytes,
        treeDigestSha256: treeDigest(audit.files),
        pagesPrefix: config.pagesPrefix,
        entryPath: config.entryPath,
      }),
      rows: Object.freeze(rows),
      requestSummary: Object.freeze({
        total: requests.length,
        outsidePagesPrefix,
      }),
      status: 'pass',
    });
  } catch (error) {
    primaryError = error;
  } finally {
    if (browser !== null) {
      try {
        await browser.close();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (server !== null) {
      try {
        await dependencies.closeServer(server);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }

  if (primaryError !== undefined || cleanupErrors.length > 0 || report === undefined) {
    removeStagingDirectory(stagingDirectory);
    if (primaryError !== undefined && cleanupErrors.length === 0) {
      throw primaryError;
    }
    throw new AggregateError(
      [
        ...(primaryError === undefined ? [] : [primaryError]),
        ...cleanupErrors,
      ],
      'H5 runtime matrix failed before report promotion',
    );
  }

  try {
    writeJsonAtomically(stagingDirectory, REPORT_FILENAME, report);
    renameSync(stagingDirectory, config.reportDirectory);
  } catch (error) {
    removeStagingDirectory(stagingDirectory);
    throw error;
  }

  return Object.freeze({
    reportPath: resolve(config.reportDirectory, REPORT_FILENAME),
    report,
  });
}

function parseRuntimeCliArguments(args) {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    return Object.freeze({ help: true });
  }
  const valueOptions = new Map([
    ['--build-dir', 'buildDirectory'],
    ['--pages-prefix', 'pagesPrefix'],
    ['--entry-path', 'entryPath'],
    ['--report-dir', 'reportDirectory'],
    ['--playwright-module-dir', 'playwrightModuleDirectory'],
    ['--browser-executable', 'browserExecutable'],
  ]);
  const parsed = {};
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === '--ci') {
      if (seen.has(option)) {
        throw new Error('duplicate option "--ci"');
      }
      seen.add(option);
      parsed.ci = true;
      continue;
    }
    const property = valueOptions.get(option);
    if (property === undefined) {
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
    parsed[property] = value;
    index += 1;
  }
  if (parsed.ci !== true) {
    throw new Error('the runtime CLI requires --ci and explicit inputs');
  }
  createH5RuntimeMatrixConfig(parsed);
  return Object.freeze(parsed);
}

function runtimeUsage() {
  return [
    'Usage: node scripts/run-h5-runtime-matrix.mjs',
    '--build-dir <dir> --pages-prefix <prefix> --entry-path <path>',
    '--report-dir <dir> --playwright-module-dir <dir>',
    '[--browser-executable <path>] --ci',
  ].join(' ');
}

function publicErrorMessage(error) {
  let message = error instanceof Error ? error.message : String(error);
  for (const privateRoot of [ROOT, homedir()]) {
    if (privateRoot.length > 1) {
      message = message.split(privateRoot).join('<path>');
    }
  }
  return message
    .replace(/\/Users\/[^/\s]+(?:\/[^\s,;:]*)?/gu, '<path>')
    .replace(/\/home\/[^/\s]+(?:\/[^\s,;:]*)?/gu, '<path>')
    .replace(/(?:\/[A-Za-z0-9._@+-]+){2,}/gu, '<path>')
    .replace(/\b[A-Za-z]:\\(?:[^\\\s]+\\)+[^\\\s]*/gu, '<path>');
}

async function main() {
  let options;
  try {
    options = parseRuntimeCliArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`ERROR: ${publicErrorMessage(error)}`);
    console.error(runtimeUsage());
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(runtimeUsage());
    return;
  }

  try {
    const { report } = await runH5RuntimeMatrix(options);
    process.stdout.write(
      `PASS: ${report.rows.length} H5 runtime rows on ${report.browser.version}; `
      + `${report.build.files} build files; report ${REPORT_FILENAME}\n`,
    );
  } catch (error) {
    console.error(`ERROR: ${publicErrorMessage(error)}`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
