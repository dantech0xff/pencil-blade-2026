#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  assertContainedOutputPath,
  blockCaptureWebSocket,
  enforceCaptureHttpRoute,
  isAllowedCaptureRequest,
  selectRecoveredAppShellController,
  validateCaptureOutputLayout,
} from '../scripts/capture-readme-gallery.mjs';

test('capture outputs reject traversal and symbolic-link escapes before writes', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'pencil-blade-readme-capture-'));
  const repositoryRoot = join(sandbox, 'repository');
  const outside = join(sandbox, 'outside');
  mkdirSync(repositoryRoot);
  mkdirSync(outside);
  try {
    const safePath = join(repositoryRoot, 'plans', 'reports', 'capture.png');
    assert.equal(
      assertContainedOutputPath(safePath, 'test output', repositoryRoot),
      safePath,
    );
    assert.throws(
      () => assertContainedOutputPath(outside, 'test output', repositoryRoot),
      /must stay inside the repository/u,
    );

    const linkedDirectory = join(repositoryRoot, 'linked-output');
    symlinkSync(outside, linkedDirectory, 'dir');
    assert.throws(
      () => assertContainedOutputPath(
        join(linkedDirectory, 'capture.png'),
        'test output',
        repositoryRoot,
      ),
      /must not traverse a symbolic link/u,
    );
  } finally {
    rmSync(sandbox, { force: true, recursive: true });
  }
});

test('capture layout validates every report and display target', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'pencil-blade-readme-layout-'));
  const repositoryRoot = join(sandbox, 'repository');
  mkdirSync(repositoryRoot);
  try {
    const valid = {
      displayDirectory: join(repositoryRoot, 'site', 'runtime'),
      reportDirectory: join(repositoryRoot, 'plans', 'reports'),
    };
    assert.doesNotThrow(
      () => validateCaptureOutputLayout(valid, repositoryRoot),
    );
    assert.throws(
      () => validateCaptureOutputLayout(
        {
          ...valid,
          displayDirectory: join(repositoryRoot, '..', 'outside'),
        },
        repositoryRoot,
      ),
      /must stay inside the repository/u,
    );
  } finally {
    rmSync(sandbox, { force: true, recursive: true });
  }
});

test('capture request policy permits only the exact local HTTP origin', () => {
  const captureOrigin = 'http://127.0.0.1:43123';
  assert.equal(
    isAllowedCaptureRequest(
      'http://127.0.0.1:43123/pencil-blade-2026/src/index.js',
      captureOrigin,
    ),
    true,
  );
  assert.equal(
    isAllowedCaptureRequest('http://127.0.0.1:43124/asset.png', captureOrigin),
    false,
  );
  assert.equal(
    isAllowedCaptureRequest('https://example.com/asset.png', captureOrigin),
    false,
  );
  assert.equal(
    isAllowedCaptureRequest('data:text/plain,external', captureOrigin),
    false,
  );
});

test('HTTP route enforcement aborts external requests and serves only local traffic', async () => {
  const captureOrigin = 'http://127.0.0.1:43123';
  const actions = [];
  const createRoute = (requestUrl) => ({
    abort: async (reason) => actions.push(['abort', reason]),
    continue: async () => actions.push(['continue']),
    fulfill: async (response) => actions.push(['fulfill', response.status]),
    request: () => ({ url: () => requestUrl }),
  });
  const offOriginRequests = [];

  await enforceCaptureHttpRoute(
    createRoute(`${captureOrigin}/pencil-blade-2026/index.js`),
    captureOrigin,
    offOriginRequests,
  );
  await enforceCaptureHttpRoute(
    createRoute(`${captureOrigin}/favicon.ico`),
    captureOrigin,
    offOriginRequests,
  );
  await enforceCaptureHttpRoute(
    createRoute('https://example.com/asset.png?private=value'),
    captureOrigin,
    offOriginRequests,
  );

  assert.deepEqual(actions, [
    ['continue'],
    ['fulfill', 204],
    ['abort', 'blockedbyclient'],
  ]);
  assert.deepEqual(offOriginRequests, ['https://example.com/asset.png']);
});

test('WebSocket enforcement blocks the connection without exposing its query', () => {
  const closeCalls = [];
  const offOriginRequests = [];
  blockCaptureWebSocket(
    {
      close: (options) => closeCalls.push(options),
      url: () => 'wss://example.com/socket?query=private-value',
    },
    offOriginRequests,
  );
  assert.deepEqual(offOriginRequests, ['wss://example.com/socket']);
  assert.deepEqual(closeCalls, [{
    code: 1008,
    reason: 'README captures allow only the local HTTP origin',
  }]);
});

test('state proof requires exactly one RecoveredAppShellController', () => {
  const expected = {
    className: 'RecoveredAppShellController',
    nodeName: 'RecoveredAppShell',
    state: 'classic',
  };
  assert.deepEqual(
    selectRecoveredAppShellController([
      {
        className: 'UnrelatedController',
        nodeName: 'Other',
        state: 'classic',
      },
      expected,
    ]),
    expected,
  );
  assert.throws(
    () => selectRecoveredAppShellController([]),
    /expected exactly one RecoveredAppShellController, found 0/u,
  );
  assert.throws(
    () => selectRecoveredAppShellController([expected, { ...expected }]),
    /expected exactly one RecoveredAppShellController, found 2/u,
  );
});
