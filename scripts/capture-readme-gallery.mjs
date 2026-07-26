#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectWebBuildDirectory } from './audit-web-build.mjs';
import {
  createPagesPrefixServer,
  PAGES_PREFIX,
} from './verify-web-mobile-build.mjs';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const DECISION_PATH = resolve(
  REPOSITORY_ROOT,
  'reference/case-study-academic-display-decision.json',
);
const VIEWPORT = Object.freeze({
  height: 1280,
  id: 'chrome-720x1280',
  width: 720,
});
const CAPTURE_DEFINITIONS = Object.freeze([
  Object.freeze({
    captureId: 'readme-720-mode-select-settled',
    filename: 'readme-720-mode-select-settled.png',
    state: 'mode-select-settled',
  }),
  Object.freeze({
    captureId: 'readme-720-classic-ready',
    filename: 'readme-720-classic-ready.png',
    state: 'classic-active-ready',
  }),
  Object.freeze({
    captureId: 'readme-720-classic-action',
    filename: 'readme-720-classic-action.png',
    state: 'classic-active-after-cut-input',
  }),
]);
const NEW_GAME_GESTURE = Object.freeze({
  end: Object.freeze({ x: 0.78, y: 0.625 }),
  start: Object.freeze({ x: 0.38, y: 0.625 }),
});
const CLASSIC_CUT_GESTURES = Object.freeze(
  [0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65].map((x) => Object.freeze({
    end: Object.freeze({ x, y: 0.45 }),
    start: Object.freeze({ x, y: 0.85 }),
  })),
);
const GAMEPLAY_GESTURES = Object.freeze([
  Object.freeze({
    end: Object.freeze({ x: 0.78, y: 0.48 }),
    start: Object.freeze({ x: 0.18, y: 0.78 }),
  }),
  Object.freeze({
    end: Object.freeze({ x: 0.24, y: 0.42 }),
    start: Object.freeze({ x: 0.82, y: 0.74 }),
  }),
]);

export function parseArguments(arguments_) {
  const valueOptions = new Map([
    ['--browser-executable', 'browserExecutable'],
    ['--build-dir', 'buildDirectory'],
    ['--display-dir', 'displayDirectory'],
    ['--playwright-module-dir', 'playwrightModuleDirectory'],
    ['--report-dir', 'reportDirectory'],
  ]);
  const parsed = {};
  const seen = new Set();
  for (let index = 0; index < arguments_.length; index += 1) {
    const option = arguments_[index];
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
    const value = arguments_[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`missing value for ${option}`);
    }
    parsed[property] = value;
    index += 1;
  }
  for (const required of [
    'buildDirectory',
    'displayDirectory',
    'playwrightModuleDirectory',
    'reportDirectory',
  ]) {
    if (typeof parsed[required] !== 'string' || parsed[required].length === 0) {
      throw new Error(`missing required ${required}`);
    }
  }
  if (parsed.ci !== true) {
    throw new Error('capture CLI requires --ci and explicit inputs');
  }
  return Object.freeze({
    browserExecutable: parsed.browserExecutable === undefined
      ? undefined
      : resolve(REPOSITORY_ROOT, parsed.browserExecutable),
    buildDirectory: resolve(REPOSITORY_ROOT, parsed.buildDirectory),
    displayDirectory: resolve(REPOSITORY_ROOT, parsed.displayDirectory),
    playwrightModuleDirectory: resolve(
      REPOSITORY_ROOT,
      parsed.playwrightModuleDirectory,
    ),
    reportDirectory: resolve(REPOSITORY_ROOT, parsed.reportDirectory),
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

function repositoryPath(path) {
  const value = relative(REPOSITORY_ROOT, path);
  if (
    value === '..'
    || value.startsWith(`..${sep}`)
    || isAbsolute(value)
  ) {
    throw new Error('capture output must stay inside the repository');
  }
  return value;
}

function isStrictDescendant(root, target) {
  const value = relative(root, target);
  return value.length > 0
    && value !== '..'
    && !value.startsWith(`..${sep}`)
    && !isAbsolute(value);
}

export function assertContainedOutputPath(
  outputPath,
  label = 'capture output',
  repositoryRoot = REPOSITORY_ROOT,
) {
  const trustedRoot = resolve(repositoryRoot);
  const target = resolve(outputPath);
  if (!isStrictDescendant(trustedRoot, target)) {
    throw new Error(`${label} must stay inside the repository`);
  }

  const canonicalRoot = realpathSync(trustedRoot);
  let current = trustedRoot;
  for (const segment of relative(trustedRoot, target).split(sep)) {
    current = join(current, segment);
    if (!existsSync(current)) continue;
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error(`${label} must not traverse a symbolic link`);
    }
    const canonicalCurrent = realpathSync(current);
    if (
      canonicalCurrent !== canonicalRoot
      && !isStrictDescendant(canonicalRoot, canonicalCurrent)
    ) {
      throw new Error(`${label} resolves outside the repository`);
    }
  }
  return target;
}

export function validateCaptureOutputLayout(
  config,
  repositoryRoot = REPOSITORY_ROOT,
) {
  const reportCaptureDirectory = resolve(
    config.reportDirectory,
    'runtime-captures',
  );
  const outputPaths = [
    ['report directory', config.reportDirectory],
    ['report capture directory', reportCaptureDirectory],
    ['display directory', config.displayDirectory],
    [
      'capture manifest',
      resolve(config.reportDirectory, 'readme-gallery-capture-manifest.json'),
    ],
  ];
  for (const definition of CAPTURE_DEFINITIONS) {
    outputPaths.push(
      [
        `${definition.captureId} report`,
        resolve(reportCaptureDirectory, definition.filename),
      ],
      [
        `${definition.captureId} display`,
        resolve(config.displayDirectory, definition.filename),
      ],
    );
  }
  for (const [label, outputPath] of outputPaths) {
    assertContainedOutputPath(outputPath, label, repositoryRoot);
  }
}

export function isAllowedCaptureRequest(requestUrl, captureOrigin) {
  try {
    return new URL(requestUrl).origin === new URL(captureOrigin).origin;
  } catch {
    return false;
  }
}

function networkRequestLabel(requestUrl) {
  try {
    const parsed = new URL(requestUrl);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '<invalid-url>';
  }
}

export async function enforceCaptureHttpRoute(
  route,
  captureOrigin,
  offOriginRequests,
) {
  const requestUrl = route.request().url();
  if (!isAllowedCaptureRequest(requestUrl, captureOrigin)) {
    offOriginRequests.push(networkRequestLabel(requestUrl));
    await route.abort('blockedbyclient');
    return;
  }
  if (new URL(requestUrl).pathname.endsWith('/favicon.ico')) {
    await route.fulfill({ body: '', status: 204 });
    return;
  }
  await route.continue();
}

export function blockCaptureWebSocket(webSocket, offOriginRequests) {
  offOriginRequests.push(networkRequestLabel(webSocket.url()));
  webSocket.close({
    code: 1008,
    reason: 'README captures allow only the local HTTP origin',
  });
}

function assertAuditedBuild(buildDirectory) {
  const audit = inspectWebBuildDirectory(buildDirectory);
  if (audit.findings.length > 0) {
    throw new Error(`H5 build audit failed with ${audit.findings.length} findings`);
  }
  const decision = JSON.parse(readFileSync(DECISION_PATH, 'utf8'));
  const expected = decision.academicDisplayScope?.h5Tree;
  if (!expected) {
    throw new Error('academic display decision has no audited H5 identity');
  }
  const actual = Object.freeze({
    bytes: audit.files.reduce((total, file) => total + file.size, 0),
    files: audit.files.length,
    treeDigestSha256: treeDigest(audit.files),
  });
  if (
    actual.bytes !== expected.bytes
    || actual.files !== expected.files
    || actual.treeDigestSha256 !== expected.treeDigestSha256
  ) {
    throw new Error(
      `audited H5 identity mismatch: expected ${expected.files}/${expected.bytes}/${expected.treeDigestSha256}, got ${actual.files}/${actual.bytes}/${actual.treeDigestSha256}`,
    );
  }
  return Object.freeze({ actual, audit, decision });
}

function loadPlaywright(moduleDirectory) {
  const requireFromBundle = createRequire(join(moduleDirectory, 'package.json'));
  const playwright = requireFromBundle('playwright');
  const packageRecord = requireFromBundle('playwright/package.json');
  return Object.freeze({
    chromium: playwright.chromium,
    packageVersion: packageRecord.version,
  });
}

async function listen(server) {
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
}

async function close(server) {
  if (!server.listening) return;
  await new Promise((accept, reject) => {
    server.close((error) => (error === undefined ? accept() : reject(error)));
  });
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

async function readRuntimeStates(page) {
  return page.evaluate(async () => {
    const cocos = await globalThis.System.import('cc');
    const scene = cocos.director.getScene();
    if (scene === null) return [];
    const states = [];
    const visit = (node) => {
      for (const component of node.getComponents(cocos.Component)) {
        const state = component.state;
        if (typeof state === 'string') {
          states.push({
            className: cocos.js.getClassName(component),
            nodeName: node.name,
            state,
          });
        }
      }
      for (const child of node.children) visit(child);
    };
    visit(scene);
    return states;
  });
}

export function selectRecoveredAppShellController(states) {
  const controllers = states.filter(
    ({ className }) => className === 'RecoveredAppShellController',
  );
  if (controllers.length !== 1) {
    throw new Error(
      `expected exactly one RecoveredAppShellController, found ${controllers.length}`,
    );
  }
  return controllers[0];
}

async function assertRuntimeState(page, expectedState) {
  const states = await readRuntimeStates(page);
  const controller = selectRecoveredAppShellController(states);
  if (controller.state !== expectedState) {
    throw new Error(
      `expected RecoveredAppShellController state "${expectedState}", got "${controller.state}"`,
    );
  }
  return controller;
}

async function waitForRuntimeState(page, expectedState, timeoutMilliseconds = 30_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  let states = [];
  while (Date.now() < deadline) {
    states = await readRuntimeStates(page);
    const controllers = states.filter(
      ({ className }) => className === 'RecoveredAppShellController',
    );
    if (controllers.length > 1) {
      selectRecoveredAppShellController(states);
    }
    if (controllers.length === 1 && controllers[0].state === expectedState) {
      return controllers[0];
    }
    await page.waitForTimeout(250);
  }
  throw new Error(
    `timed out waiting for runtime state "${expectedState}": ${JSON.stringify(states)}`,
  );
}

async function dispatchSwipe(context, page, start, end) {
  const session = await context.newCDPSession(page);
  try {
    const points = 12;
    await session.send('Input.dispatchTouchEvent', {
      touchPoints: [{
        force: 1,
        id: 1,
        radiusX: 5,
        radiusY: 5,
        x: VIEWPORT.width * start.x,
        y: VIEWPORT.height * start.y,
      }],
      type: 'touchStart',
    });
    for (let index = 1; index <= points; index += 1) {
      const progress = index / points;
      await session.send('Input.dispatchTouchEvent', {
        touchPoints: [{
          force: 1,
          id: 1,
          radiusX: 5,
          radiusY: 5,
          x: VIEWPORT.width * (start.x + ((end.x - start.x) * progress)),
          y: VIEWPORT.height * (start.y + ((end.y - start.y) * progress)),
        }],
        type: 'touchMove',
      });
      await page.waitForTimeout(16);
    }
    await session.send('Input.dispatchTouchEvent', {
      touchPoints: [],
      type: 'touchEnd',
    });
  } finally {
    await session.detach();
  }
}

async function dispatchCut(context, page, start, end) {
  const session = await context.newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', {
      touchPoints: [{
        force: 1,
        id: 1,
        radiusX: 5,
        radiusY: 5,
        x: VIEWPORT.width * start.x,
        y: VIEWPORT.height * start.y,
      }],
      type: 'touchStart',
    });
    await page.waitForTimeout(16);
    await session.send('Input.dispatchTouchEvent', {
      touchPoints: [{
        force: 1,
        id: 1,
        radiusX: 5,
        radiusY: 5,
        x: VIEWPORT.width * end.x,
        y: VIEWPORT.height * end.y,
      }],
      type: 'touchMove',
    });
    await page.waitForTimeout(16);
    await session.send('Input.dispatchTouchEvent', {
      touchPoints: [],
      type: 'touchEnd',
    });
  } finally {
    await session.detach();
  }
}

async function capturePage(page, definition, reportDirectory, displayDirectory) {
  const reportPath = resolve(reportDirectory, 'runtime-captures', definition.filename);
  const displayPath = resolve(displayDirectory, definition.filename);
  await page.screenshot({ fullPage: false, path: reportPath });
  copyFileSync(reportPath, displayPath);
  const reportBytes = readFileSync(reportPath);
  const displayBytes = readFileSync(displayPath);
  const digest = sha256(reportBytes);
  if (sha256(displayBytes) !== digest) {
    throw new Error(`${definition.captureId} display copy is not exact-byte`);
  }
  return Object.freeze({
    captureId: definition.captureId,
    displayPath: repositoryPath(displayPath),
    entryPath: [],
    height: VIEWPORT.height,
    pixelTransformation: 'none',
    reportPath: repositoryPath(reportPath),
    sha256: digest,
    state: definition.state,
    width: VIEWPORT.width,
  });
}

async function runCapture(config) {
  validateCaptureOutputLayout(config);
  const { actual, audit, decision } = assertAuditedBuild(config.buildDirectory);
  mkdirSync(resolve(config.reportDirectory, 'runtime-captures'), { recursive: true });
  mkdirSync(config.displayDirectory, { recursive: true });

  const requests = [];
  const server = createPagesPrefixServer(
    audit,
    {
      buildDirectory: config.buildDirectory,
      entryPath: 'index.html',
      pagesPrefix: PAGES_PREFIX,
    },
    requests,
  );
  const playwright = loadPlaywright(config.playwrightModuleDirectory);
  let browser;
  let captureError;
  let context;
  try {
    await listen(server);
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('capture server did not receive a loopback address');
    }
    browser = await playwright.chromium.launch({
      executablePath: config.browserExecutable,
      headless: true,
    });
    context = await browser.newContext({
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true,
      locale: 'en-US',
      serviceWorkers: 'block',
      viewport: {
        height: VIEWPORT.height,
        width: VIEWPORT.width,
      },
    });
    const captureOrigin = `http://127.0.0.1:${address.port}`;
    const offOriginRequests = [];
    await context.route(
      '**/*',
      (route) => enforceCaptureHttpRoute(
        route,
        captureOrigin,
        offOriginRequests,
      ),
    );
    await context.routeWebSocket(
      /.*/u,
      (webSocket) => blockCaptureWebSocket(
        webSocket,
        offOriginRequests,
      ),
    );
    const page = await context.newPage();
    const consoleErrors = [];
    const badResponses = [];
    const pageErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) {
        badResponses.push({
          status: response.status(),
          url: response.url(),
        });
      }
    });
    await page.goto(`http://127.0.0.1:${address.port}${PAGES_PREFIX}`, {
      timeout: 30_000,
      waitUntil: 'domcontentloaded',
    });
    await waitForCanvas(page);
    await waitForRuntimeState(page, 'main-menu');

    await dispatchSwipe(
      context,
      page,
      NEW_GAME_GESTURE.start,
      NEW_GAME_GESTURE.end,
    );
    await waitForRuntimeState(page, 'mode-select');
    await page.waitForTimeout(3_000);
    await assertRuntimeState(page, 'mode-select');
    const modeSelect = await capturePage(
      page,
      CAPTURE_DEFINITIONS[0],
      config.reportDirectory,
      config.displayDirectory,
    );

    for (const gesture of CLASSIC_CUT_GESTURES) {
      await dispatchCut(context, page, gesture.start, gesture.end);
      await page.waitForTimeout(120);
    }
    await waitForRuntimeState(page, 'classic');
    await page.waitForTimeout(4_000);
    await assertRuntimeState(page, 'classic');
    const classicReady = await capturePage(
      page,
      CAPTURE_DEFINITIONS[1],
      config.reportDirectory,
      config.displayDirectory,
    );

    for (const gesture of GAMEPLAY_GESTURES) {
      await dispatchSwipe(context, page, gesture.start, gesture.end);
      await page.waitForTimeout(900);
    }
    await assertRuntimeState(page, 'classic');
    const classicAction = await capturePage(
      page,
      CAPTURE_DEFINITIONS[2],
      config.reportDirectory,
      config.displayDirectory,
    );

    const captures = [
      {
        ...modeSelect,
        entryPath: [
          'main-menu-state',
          'new-game-swipe',
          'mode-select-state',
          '3-second-visual-settle',
        ],
      },
      {
        ...classicReady,
        entryPath: [
          'main-menu-state',
          'new-game-swipe',
          'mode-select-state',
          'vertical-cut-probes',
          'classic-state',
          '4-second-gameplay-settle',
        ],
      },
      {
        ...classicAction,
        entryPath: [
          'main-menu-state',
          'new-game-swipe',
          'mode-select-state',
          'vertical-cut-probes',
          'classic-state',
          'gameplay-settle',
          'two-cut-swipes',
        ],
      },
    ];
    if (new Set(captures.map((capture) => capture.sha256)).size !== captures.length) {
      throw new Error('README captures must contain three distinct frames');
    }
    if (
      consoleErrors.length > 0
      || pageErrors.length > 0
      || badResponses.length > 0
      || offOriginRequests.length > 0
    ) {
      throw new Error(
        `capture runtime errors: ${JSON.stringify({
          badResponses,
          consoleErrors,
          offOriginRequests,
          pageErrors,
        })}`,
      );
    }

    const manifest = {
      schemaVersion: 1,
      reportKind: 'readme-runtime-captures',
      generatedAt: new Date().toISOString(),
      academicDisplayDecision: {
        decisionActorRoleId: 'project-owner',
        decisionDate: '2026-07-26',
        decisionId: decision.decisionId,
        scopeExpansion: 'README runtime gallery',
      },
      captures,
      runtime: {
        browserVersion: browser.version(),
        devicePixelRatio: 1,
        playwrightVersion: playwright.packageVersion,
        viewport: VIEWPORT,
      },
      sourceBuild: {
        buildPath: repositoryPath(config.buildDirectory),
        bytes: actual.bytes,
        files: actual.files,
        pagesPrefix: PAGES_PREFIX,
        treeDigestSha256: actual.treeDigestSha256,
      },
      transformationPolicy: 'No pixel modification, crop, resize, re-encode, or color change.',
    };
    const manifestPath = resolve(
      config.reportDirectory,
      'readme-gallery-capture-manifest.json',
    );
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    return Object.freeze({
      captures: captures.length,
      manifestPath: repositoryPath(manifestPath),
      requests: requests.length,
    });
  } catch (error) {
    captureError = error;
    throw error;
  } finally {
    const cleanupFailures = [];
    for (const [label, cleanup] of [
      ['browser context', () => context?.close()],
      ['browser', () => browser?.close()],
      ['capture server', () => close(server)],
    ]) {
      try {
        await cleanup();
      } catch (error) {
        cleanupFailures.push({
          label,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (cleanupFailures.length > 0 && captureError === undefined) {
      throw new Error(`capture cleanup failed: ${JSON.stringify(cleanupFailures)}`);
    }
  }
}

function publicErrorMessage(error) {
  let message = error instanceof Error ? error.message : String(error);
  for (const privateRoot of [REPOSITORY_ROOT, homedir()]) {
    if (privateRoot.length > 1) {
      message = message.split(privateRoot).join('<path>');
    }
  }
  return message;
}

async function main() {
  try {
    const config = parseArguments(process.argv.slice(2));
    const result = await runCapture(config);
    console.log(
      `PASS: ${result.captures} README captures; manifest ${result.manifestPath}; ${result.requests} local requests`,
    );
  } catch (error) {
    console.error(`ERROR: ${publicErrorMessage(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
