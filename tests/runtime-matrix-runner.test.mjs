#!/usr/bin/env node

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  assertRuntimeRowPasses,
  createH5RuntimeMatrixConfig,
} from '../scripts/run-h5-runtime-matrix.mjs';
import { runAndroidRuntimeMatrix } from '../scripts/run-android-runtime-matrix.mjs';

await assert.rejects(
  runAndroidRuntimeMatrix({ resetTestApp: false }),
  /Refusing to clear app data/u,
);

const legacy = createH5RuntimeMatrixConfig({
  reportDirectory: join(tmpdir(), 'pencil-blade-runtime-config-fixture'),
});
assert.equal(legacy.pagesPrefix, '/pencil-blade-2026/');
assert.equal(legacy.entryPath, 'index.html');
assert.equal(Object.isFrozen(legacy), true);

assert.throws(
  () => createH5RuntimeMatrixConfig({ ci: true }),
  /CI mode requires explicit/u,
);
assert.throws(
  () => createH5RuntimeMatrixConfig({
    ci: true,
    buildDirectory: 'build',
    pagesPrefix: '/pencil-blade-2026/play/game/',
    entryPath: 'index.html',
    reportDirectory: 'report',
    playwrightModuleDirectory: 'node_modules',
    browserExecutable: '/Users/developer/Chrome',
  }),
  /must not use a workstation path/u,
);

const passingRow = {
  id: 'behavioral-fixture',
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
};
assert.equal(assertRuntimeRowPasses(passingRow), true);

const failures = [
  ['input.newGameGestureChangedFrame', false],
  ['input.classicGestureChangedFrame', false],
  ['audio.backendAvailable', false],
  ['audio.verifiedAfterInput', false],
  ['storage.retainedAcrossLifecycle', false],
  ['storage.probeRemovedAfterTest', false],
  ['lifecycle.backgroundForeground', 'fail'],
  ['lifecycle.canvasVisibleAfterResume', false],
  ['lifecycle.geometryValidAfterResume', false],
  ['fullscreen.entered', false],
  ['fullscreen.exited', false],
  ['fullscreen.canvasVisibleAfterExit', false],
  ['fullscreen.geometryValidAfterExit', false],
  ['orientation.declared', 'landscape'],
  ['orientation.landscapeGeometryValid', false],
  ['orientation.restoredPortraitGeometryValid', false],
  ['offline.postLoadGameplay', 'fail'],
  ['offline.canvasVisible', false],
  ['console.errors', [{ text: 'console failure' }]],
  ['console.pageErrors', ['page failure']],
  ['console.requestFailures', [{ url: 'request failure' }]],
  ['console.badResponses', [{ status: 500 }]],
  ['console.unexpectedRequests', ['https://example.invalid/']],
];
for (const [path, value] of failures) {
  const row = structuredClone(passingRow);
  const segments = path.split('.');
  const key = segments.pop();
  let owner = row;
  for (const segment of segments) {
    owner = owner[segment];
  }
  owner[key] = value;
  assert.throws(
    () => assertRuntimeRowPasses(row),
    /behavioral-fixture failed/u,
    path,
  );
}

process.stdout.write('PASS runtime matrix behavioral contracts\n');
