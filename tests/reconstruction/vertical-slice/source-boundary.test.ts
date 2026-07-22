import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  auditTrackableGameBoundary,
  inspectProhibitedPath,
  inspectProhibitedSource,
  isIgnoredCreatorCache,
  listTrackableGameFiles,
} from './source-boundary-audit.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

test('trackable game boundary excludes untracked Creator caches', () => {
  const paths = listTrackableGameFiles(REPOSITORY_ROOT);

  assert.ok(paths.some((path) => path.startsWith('game/assets/scripts/domain/')));
  assert.deepEqual(paths.filter(isIgnoredCreatorCache), []);
});

test('path audit recognizes prohibited evidence, runtime, decompiler, and bridge artifacts', () => {
  const prohibited = [
    'game/assets/original.apk',
    'game/assets/libgame.so',
    'game/assets/runtime/classes.dex',
    'game/assets/jadx-output/source.txt',
    'game/assets/cocos2d-x-2.1.4/CCNode.cpp',
    'game/assets/scripts/native-adapter.cpp',
    'game/assets/native-compatibility-bridge/adapter.ts',
    'game/assets/scripts/native-compatibility-bridge.ts',
    'game/assets/emulation-layer/runner.ts',
  ];

  for (const path of prohibited) {
    assert.notEqual(inspectProhibitedPath(path).length, 0, path);
  }
  assert.deepEqual(inspectProhibitedPath('game/assets/scripts/domain/classic-session.ts'), []);
});

test('source audit recognizes prohibited runtime integration signatures', () => {
  const prohibited = [
    'const binary = "libgame.so";',
    'System.loadLibrary("game");',
    'const handle = dlopen(path, flags);',
    'jsb.reflection.callStaticMethod(name);',
    'Copied from JADX decompiler output',
    'Install a native compatibility bridge',
  ];

  for (const source of prohibited) {
    assert.notEqual(inspectProhibitedSource('game/assets/scripts/bad.ts', source).length, 0, source);
  }
  assert.deepEqual(
    inspectProhibitedSource('game/assets/scripts/good.ts', 'export const score = previous + delta;'),
    [],
  );
});

test('actual trackable Creator source boundary contains no prohibited runtime artifacts', () => {
  assert.deepEqual(auditTrackableGameBoundary(REPOSITORY_ROOT), []);
});
