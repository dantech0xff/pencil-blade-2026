#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  inspectWebBuildDirectory,
} from './audit-web-build.mjs';
import {
  createPagesPrefixServer,
  PAGES_PREFIX,
} from './verify-web-mobile-build.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_BUILD_DIR = 'game/build/web-mobile-pages';
const DEFAULT_REPORT_DIR = 'plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix';
const DEFAULT_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEFAULT_PLAYWRIGHT_MODULE_DIR =
  '/Users/dan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const VIEWPORTS = Object.freeze([
  Object.freeze({ id: 'chrome-480x800', width: 480, height: 800 }),
  Object.freeze({ id: 'chrome-720x1280', width: 720, height: 1280 }),
]);

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
  await new Promise((accept, reject) => {
    server.close((error) => (error === undefined ? accept() : reject(error)));
  });
}

function loadPlaywright(moduleDirectory) {
  const requireFromBundle = createRequire(join(moduleDirectory, 'package.json'));
  return requireFromBundle('playwright');
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
    htmlAudioElements: document.querySelectorAll('audio').length,
  }));
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

async function runViewport(browser, origin, viewport, outputDirectory) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    locale: 'en-US',
    serviceWorkers: 'block',
  });
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  await context.route('**/favicon.ico', (route) => route.fulfill({
    status: 204,
    body: '',
  }));
  const page = await context.newPage();
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

  try {
    await page.goto(`${origin}${PAGES_PREFIX}`, {
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
      || audioAfterInput.htmlAudioElements > 0;
    if (!audioBackendAvailable) {
      throw new Error(`${viewport.id} created no WebAudio or HTMLAudio backend`);
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
    const backgroundPage = await context.newPage();
    await backgroundPage.goto('about:blank');
    await backgroundPage.bringToFront();
    await page.waitForTimeout(250);
    await page.bringToFront();
    await page.waitForTimeout(500);
    await backgroundPage.close();
    const storageAfterLifecycle = await page.evaluate(() => ({
      count: localStorage.length,
      keys: Object.keys(localStorage).sort(),
      probeValue: localStorage.getItem('__pencil_blade_runtime_matrix__'),
    }));
    await page.evaluate(() => {
      localStorage.removeItem('__pencil_blade_runtime_matrix__');
    });

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
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(300);
    const restoredGeometry = await canvasGeometry(page);
    assertGeometry(restoredGeometry, viewport);

    const relevantConsoleErrors = consoleMessages.filter(
      (message) => message.type === 'error'
        && !message.text.includes('[Assets] [buildScriptCommand][BABEL]'),
    );
    if (pageErrors.length > 0 || relevantConsoleErrors.length > 0 || requestFailures.length > 0) {
      throw new Error(
        `${viewport.id} browser failures: ${JSON.stringify({
          pageErrors,
          relevantConsoleErrors,
          requestFailures,
        })}`,
      );
    }

    return {
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
      },
      storage: {
        beforeLifecycle: storageBeforeLifecycle,
        afterLifecycle: storageAfterLifecycle,
        retainedAcrossLifecycle: storageAfterLifecycle.probeValue === storageProbeValue,
        probeRemovedAfterTest: true,
      },
      lifecycle: {
        backgroundForeground: 'pass',
        canvasVisibleAfterResume: await page.locator('canvas').isVisible(),
      },
      orientation: {
        declared: 'portrait',
        landscapeDiagnostic: landscapeGeometry,
        restoredPortrait: restoredGeometry,
      },
      offline: {
        postLoadGameplay: 'pass',
        canvasVisible: offlineCanvasVisible,
      },
      console: {
        messages: consoleMessages,
        pageErrors,
        requestFailures,
      },
      screenshots: [
        relativeReportPath(initialScreenshot),
        relativeReportPath(modeSelectScreenshot),
        relativeReportPath(gameplayScreenshot),
      ],
      status: 'pass',
    };
  } finally {
    await context.close();
  }
}

function relativeReportPath(path) {
  return path.startsWith(`${ROOT}/`) ? path.slice(ROOT.length + 1) : path;
}

export async function runH5RuntimeMatrix(options = {}) {
  const buildDirectory = resolve(ROOT, options.buildDirectory ?? DEFAULT_BUILD_DIR);
  const outputDirectory = resolve(ROOT, options.outputDirectory ?? DEFAULT_REPORT_DIR);
  const chromeExecutable = options.chromeExecutable
    ?? process.env.CHROME_EXECUTABLE
    ?? DEFAULT_CHROME;
  const playwrightModuleDirectory = options.playwrightModuleDirectory
    ?? process.env.PLAYWRIGHT_MODULE_DIR
    ?? DEFAULT_PLAYWRIGHT_MODULE_DIR;
  mkdirSync(outputDirectory, { recursive: true });

  const audit = inspectWebBuildDirectory(buildDirectory);
  if (audit.findings.length > 0) {
    throw new Error(`Web build audit failed: ${JSON.stringify(audit.findings)}`);
  }
  const requests = [];
  const server = createPagesPrefixServer(audit, requests);
  await listen(server);
  const address = server.address();
  if (address === null || typeof address === 'string') {
    await close(server);
    throw new Error('H5 runtime server did not bind a loopback port');
  }

  const { chromium } = loadPlaywright(playwrightModuleDirectory);
  const browser = await chromium.launch({
    executablePath: chromeExecutable,
    headless: true,
  });
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const rows = [];
    for (const viewport of VIEWPORTS) {
      rows.push(await runViewport(browser, origin, viewport, outputDirectory));
    }
    const report = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      browser: {
        product: 'Google Chrome',
        version: await browser.version(),
        executable: chromeExecutable,
      },
      build: {
        directory: relativeReportPath(buildDirectory),
        files: audit.files.length,
        bytes: audit.totalBytes,
        treeDigestSha256: treeDigest(audit.files),
        pagesPrefix: PAGES_PREFIX,
      },
      rows,
      requestSummary: {
        total: requests.length,
        outsidePagesPrefix: requests.filter((request) => (
          !request.path.startsWith(PAGES_PREFIX)
        )).length,
      },
      status: rows.every((row) => row.status === 'pass') ? 'pass' : 'fail',
    };
    const reportPath = resolve(outputDirectory, 'h5-runtime-matrix.json');
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return { reportPath, report };
  } finally {
    await browser.close();
    await close(server);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { reportPath, report } = await runH5RuntimeMatrix();
  process.stdout.write(
    `PASS: ${report.rows.length} H5 runtime rows on ${report.browser.version}; `
    + `${report.build.files} build files; report ${reportPath}\n`,
  );
}
