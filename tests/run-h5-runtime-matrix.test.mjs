import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';

import {
  createH5RuntimeMatrixConfig,
  H5_NEW_GAME_GESTURES,
  runViewport,
  runH5RuntimeMatrix,
} from '../scripts/run-h5-runtime-matrix.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runnerScript = join(projectRoot, 'scripts/run-h5-runtime-matrix.mjs');
const historicalReport = join(
  projectRoot,
  'plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/h5-runtime-matrix.json',
);
const testRoot = mkdtempSync(join(tmpdir(), 'pencil-blade-h5-runtime-'));
let fixtureIndex = 0;

after(() => {
  rmSync(testRoot, { force: true, recursive: true });
});

test('runtime matrix publishes one complete atomic report after cleanup', async () => {
  const historicalBefore = readFileSync(historicalReport);
  const reportDirectory = nextReportDirectory('complete');
  const state = {};
  const result = await runH5RuntimeMatrix(
    runtimeOptions(reportDirectory),
    fakeDependencies(state),
  );

  assert.equal(state.browserClosed, true);
  assert.equal(state.serverClosed, true);
  assert.equal(existsSync(result.reportPath), true);
  assert.equal(
    result.reportPath,
    join(reportDirectory, 'case-study-h5-runtime-matrix.json'),
  );
  const published = JSON.parse(readFileSync(result.reportPath, 'utf8'));
  assert.equal(published.schemaVersion, 2);
  assert.equal(published.reportKind, 'case-study-h5-runtime-matrix');
  assert.equal(published.build.pagesPrefix, '/pencil-blade-2026/play/game/');
  assert.equal(published.build.entryPath, 'index.html');
  assert.equal(published.rows.length, 2);
  assert.equal(published.status, 'pass');
  assert.equal('executable' in published.browser, false);
  assert.equal(JSON.stringify(published).includes(testRoot), false);
  assert.equal(JSON.stringify(published).includes('/Users/'), false);
  assert.deepEqual(readFileSync(historicalReport), historicalBefore);
  assert.deepEqual(
    readdirSync(reportDirectory).sort(),
    [
      'case-study-h5-runtime-matrix.json',
      'chrome-480x800.png',
      'chrome-720x1280.png',
    ],
  );
  assert.deepEqual(stagingDirectoriesFor(reportDirectory), []);
});

test('concurrent runtime invocations keep legacy and nested prefixes isolated', async () => {
  const legacyDirectory = nextReportDirectory('legacy-concurrent');
  const nestedDirectory = nextReportDirectory('nested-concurrent');
  const legacyOptions = {
    ...runtimeOptions(legacyDirectory),
    pagesPrefix: '/pencil-blade-2026/',
  };
  const nestedOptions = runtimeOptions(nestedDirectory);
  const [legacy, nested] = await Promise.all([
    runH5RuntimeMatrix(legacyOptions, fakeDependencies({})),
    runH5RuntimeMatrix(nestedOptions, fakeDependencies({})),
  ]);

  assert.equal(legacy.report.build.pagesPrefix, '/pencil-blade-2026/');
  assert.equal(
    nested.report.build.pagesPrefix,
    '/pencil-blade-2026/play/game/',
  );
});

test('every initialization and row failure closes initialized resources and removes staging', async (t) => {
  for (const failureAt of [
    'inspect',
    'create-server',
    'listen',
    'missing-module',
    'bad-executable',
    'browser-launch',
    'viewport',
  ]) {
    await t.test(failureAt, async () => {
      const reportDirectory = nextReportDirectory(failureAt);
      const state = {};
      await assert.rejects(
        runH5RuntimeMatrix(
          runtimeOptions(reportDirectory),
          fakeDependencies(state, { failureAt }),
        ),
        /fixture failure/u,
      );
      assert.equal(existsSync(reportDirectory), false);
      assert.deepEqual(stagingDirectoriesFor(reportDirectory), []);
      if (!['inspect', 'create-server'].includes(failureAt)) {
        assert.equal(state.serverClosed, true);
      }
      if (failureAt === 'viewport') {
        assert.equal(state.browserClosed, true);
      }
    });
  }
});

test('cleanup failure blocks report promotion and removes private screenshots', async () => {
  const reportDirectory = nextReportDirectory('cleanup-failure');
  const state = {};
  await assert.rejects(
    runH5RuntimeMatrix(
      runtimeOptions(reportDirectory),
      fakeDependencies(state, { failureAt: 'browser-close' }),
    ),
    /failed before report promotion/u,
  );

  assert.equal(state.serverClosed, true);
  assert.equal(existsSync(reportDirectory), false);
  assert.deepEqual(stagingDirectoriesFor(reportDirectory), []);
});

test('viewport partial context and page initialization always cleans up', async (t) => {
  for (const failureAt of ['route', 'new-page', 'page-init']) {
    await t.test(failureAt, async () => {
      const state = {};
      const page = {
        on() {},
        async addInitScript() {
          if (failureAt === 'page-init') {
            throw new Error('page-init fixture failure');
          }
        },
        async close() {
          state.pageClosed = true;
        },
      };
      const context = {
        async route() {
          if (failureAt === 'route') {
            throw new Error('route fixture failure');
          }
        },
        async newPage() {
          if (failureAt === 'new-page') {
            throw new Error('new-page fixture failure');
          }
          return page;
        },
        async close() {
          state.contextClosed = true;
        },
      };
      const browser = {
        async newContext() {
          return context;
        },
      };

      await assert.rejects(
        runViewport(
          browser,
          'http://127.0.0.1:4173',
          { id: 'partial-init', width: 480, height: 800 },
          testRoot,
          { pagesPrefix: '/pencil-blade-2026/play/game/' },
        ),
        /fixture failure/u,
      );
      assert.equal(state.contextClosed, true);
      assert.equal(state.pageClosed, failureAt === 'page-init' ? true : undefined);
    });
  }
});

test('existing and historical report destinations fail before initialization', async () => {
  const existingDirectory = nextReportDirectory('existing');
  writeFileSync(existingDirectory, 'occupied');
  const state = {};
  await assert.rejects(
    runH5RuntimeMatrix(
      runtimeOptions(existingDirectory),
      fakeDependencies(state),
    ),
    /already exists/u,
  );
  assert.equal(state.serverCreated, undefined);

  assert.throws(
    () => createH5RuntimeMatrixConfig({
      reportDirectory: dirname(historicalReport),
    }),
    /historical H5 runtime evidence is immutable/u,
  );
});

test('runtime CLI requires explicit CI inputs and does not print workstation paths', () => {
  const missing = spawnSync(process.execPath, [runnerScript], {
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /requires --ci/u);
  assert.match(missing.stderr, /--build-dir <dir>/u);

  const workstationBrowser = '/Users/private-developer/Chrome';
  const unsafe = spawnSync(process.execPath, [
    runnerScript,
    '--build-dir',
    'build',
    '--pages-prefix',
    '/pencil-blade-2026/play/game/',
    '--entry-path',
    'index.html',
    '--report-dir',
    'report',
    '--playwright-module-dir',
    'node_modules',
    '--browser-executable',
    workstationBrowser,
    '--ci',
  ], {
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.equal(unsafe.status, 2);
  assert.match(unsafe.stderr, /must not use a workstation path/u);
  assert.doesNotMatch(unsafe.stderr, /private-developer/u);
});

test('CI accepts GitHub runner temp paths nested under the runner home', () => {
  const previousRunnerTemp = process.env.RUNNER_TEMP;
  const runnerTemp = join(homedir(), 'work', '_temp');
  process.env.RUNNER_TEMP = runnerTemp;
  try {
    assert.doesNotThrow(() => createH5RuntimeMatrixConfig({
      buildDirectory: join(runnerTemp, 'game-dist'),
      pagesPrefix: '/pencil-blade-2026/play/game/',
      entryPath: 'index.html',
      reportDirectory: join(runnerTemp, 'case-study-work', 'runtime-nested'),
      playwrightModuleDirectory: 'site/node_modules/playwright',
      ci: true,
    }));
  } finally {
    if (previousRunnerTemp === undefined) {
      delete process.env.RUNNER_TEMP;
    } else {
      process.env.RUNNER_TEMP = previousRunnerTemp;
    }
  }
});

test('New Game runtime gestures cross the reconstructed target with bounded fallbacks', () => {
  assert.deepEqual(H5_NEW_GAME_GESTURES, [
    { start: { x: 0.38, y: 0.625 }, end: { x: 0.78, y: 0.625 } },
    { start: { x: 0.38, y: 0.60 }, end: { x: 0.78, y: 0.60 } },
    { start: { x: 0.38, y: 0.65 }, end: { x: 0.78, y: 0.65 } },
  ]);
  assert.ok(H5_NEW_GAME_GESTURES.every((gesture) => (
    gesture.start.x < 0.60
    && gesture.end.x > 0.60
    && Math.abs(gesture.start.y - 0.625) <= 0.026
    && gesture.start.y === gesture.end.y
  )));
});

function runtimeOptions(reportDirectory) {
  return {
    buildDirectory: join(testRoot, 'build-fixture'),
    pagesPrefix: '/pencil-blade-2026/play/game/',
    entryPath: 'index.html',
    reportDirectory,
    playwrightModuleDirectory: join(testRoot, 'playwright-modules'),
    ci: true,
  };
}

function fakeDependencies(state, options = {}) {
  const fail = (point) => {
    if (options.failureAt === point) {
      throw new Error(`${point} fixture failure`);
    }
  };
  return {
    inspectBuild() {
      fail('inspect');
      return {
        findings: [],
        files: [{
          path: 'index.html',
          size: 5,
          sha256: '0'.repeat(64),
        }],
        totalBytes: 5,
      };
    },
    createServer() {
      fail('create-server');
      state.serverCreated = true;
      return {
        listening: false,
        address() {
          return this.listening ? { address: '127.0.0.1', port: 4173 } : null;
        },
      };
    },
    async listenServer(server) {
      server.listening = true;
      fail('listen');
    },
    async closeServer(server) {
      server.listening = false;
      state.serverClosed = true;
    },
    loadPlaywright() {
      fail('missing-module');
      return {
        chromium: {
          executablePath: () => '/playwright-managed/chromium',
          async launch() {
            fail('bad-executable');
            fail('browser-launch');
            return {
              async close() {
                if (options.failureAt === 'browser-close') {
                  throw new Error('browser-close fixture failure');
                }
                state.browserClosed = true;
              },
              async version() {
                return 'fixture-chromium';
              },
            };
          },
        },
        identity: {
          package: 'playwright',
          packageVersion: 'fixture',
          product: 'Chromium',
          revision: 'fixture-revision',
        },
      };
    },
    now: () => '2026-07-26T00:00:00.000Z',
    platform: () => ({
      architecture: 'fixture-arch',
      operatingSystem: 'fixture-os',
    }),
    async runViewport(_browser, _origin, viewport, outputDirectory) {
      writeFileSync(join(outputDirectory, `${viewport.id}.png`), viewport.id);
      fail('viewport');
      return passingRow(viewport);
    },
  };
}

function passingRow(viewport) {
  return {
    id: viewport.id,
    input: {
      newGameGestureChangedFrame: true,
      classicGestureChangedFrame: true,
    },
    audio: {
      backendAvailable: true,
      verifiedAfterInput: true,
    },
    storage: {
      retainedAcrossLifecycle: true,
      probeRemovedAfterTest: true,
    },
    lifecycle: {
      backgroundForeground: 'pass',
      canvasVisibleAfterResume: true,
      geometryValidAfterResume: true,
    },
    fullscreen: {
      entered: true,
      exited: true,
      canvasVisibleAfterExit: true,
      geometryValidAfterExit: true,
    },
    orientation: {
      declared: 'portrait',
      landscapeGeometryValid: true,
      restoredPortraitGeometryValid: true,
    },
    offline: {
      postLoadGameplay: 'pass',
      canvasVisible: true,
    },
    console: {
      errors: [],
      pageErrors: [],
      requestFailures: [],
      badResponses: [],
      unexpectedRequests: [],
    },
    screenshots: [{
      path: `${viewport.id}.png`,
      sha256: '0'.repeat(64),
    }],
  };
}

function nextReportDirectory(label) {
  fixtureIndex += 1;
  return join(testRoot, `${fixtureIndex}-${label}`);
}

function stagingDirectoriesFor(reportDirectory) {
  const parent = dirname(reportDirectory);
  const prefix = `.${reportDirectory.split('/').at(-1)}-staging-`;
  return readdirSync(parent).filter((entry) => entry.startsWith(prefix));
}
