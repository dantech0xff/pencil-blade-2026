import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface SerializedReference {
  readonly __id__: number;
}

interface SerializedObject {
  readonly __type__?: string;
  readonly _components?: readonly SerializedReference[];
  readonly _contentSize?: Readonly<{ height: number; width: number }>;
  readonly _name?: string;
  readonly [key: string]: unknown;
}

test('Editor-authored Classic scene resolves both Canvas script components through their metas', () => {
  const scene = readJson<SerializedObject[]>('game/assets/scenes/classic.scene');
  const bladeMeta = readJson<{ imported: boolean; uuid: string }>(
    'game/assets/scripts/creator/blade-input-controller.ts.meta',
  );
  const sceneControllerMeta = readJson<{ imported: boolean; uuid: string }>(
    'game/assets/scripts/creator/classic-scene-controller.ts.meta',
  );
  const canvas = scene.find((entry) => entry.__type__ === 'cc.Node' && entry._name === 'Canvas');
  assert.ok(canvas?._components);

  const componentTypes = canvas._components.map((reference) => scene[reference.__id__]?.__type__);
  const scriptTypes = componentTypes.filter(
    (type): type is string => typeof type === 'string' && type.length === 23,
  );

  assert.equal(bladeMeta.imported, true);
  assert.equal(sceneControllerMeta.imported, true);
  assert.deepEqual(scriptTypes.map(decodeCreatorUuid), [bladeMeta.uuid, sceneControllerMeta.uuid]);
});

test('Classic project and serialized Canvas start from the canonical high portrait profile', () => {
  const project = readJson<{
    general: { designResolution: { height: number; width: number } };
  }>('game/settings/v2/packages/project.json');
  const scene = readJson<SerializedObject[]>('game/assets/scenes/classic.scene');
  const canvasSize = scene.find((entry) => (
    entry.__type__ === 'cc.UITransform'
    && entry._contentSize?.width === 720
    && entry._contentSize.height === 1280
  ));

  assert.deepEqual(project.general.designResolution, { height: 1280, width: 720 });
  assert.ok(canvasSize);
});

test('Creator bridge holds automatic physics and emits initial state only after onEnable', () => {
  const physicsSource = readText('game/assets/scripts/creator/classic-physics-adapter.ts');
  const sceneSource = readText('game/assets/scripts/creator/classic-scene-controller.ts');
  const onLoad = extractMethod(sceneSource, 'onLoad');
  const start = extractMethod(sceneSource, 'start');

  assert.match(physicsSource, /autoSimulation = false/);
  assert.match(physicsSource, /resetAccumulator\(\)/);
  assert.doesNotMatch(physicsSource, /fixedTimeStep\s*=/);
  assert.doesNotMatch(physicsSource, /\.step\(/);
  assert.doesNotMatch(onLoad, /CLASSIC_RESOLUTION_APPLIED_EVENT|emitSessionSnapshot/);
  assert.match(start, /CLASSIC_RESOLUTION_APPLIED_EVENT/);
  assert.match(start, /emitSessionSnapshot/);
});

function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

function readText(relativePath: string): string {
  return readFileSync(`${REPOSITORY_ROOT}${relativePath}`, 'utf8');
}

function extractMethod(source: string, methodName: string): string {
  const methodStart = source.indexOf(`  ${methodName}(): void {`);
  assert.notEqual(methodStart, -1);
  const nextMethod = source.indexOf('\n  }\n\n  ', methodStart);
  assert.notEqual(nextMethod, -1);
  return source.slice(methodStart, nextMethod + 4);
}

function decodeCreatorUuid(compressed: string): string {
  assert.equal(compressed.length, 23);
  // Serialized component class IDs retain five hex nibbles, then pack three per Base64 pair.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let hex = compressed.slice(0, 5);
  for (let index = 5; index < compressed.length; index += 2) {
    const high = alphabet.indexOf(compressed[index] ?? '');
    const low = alphabet.indexOf(compressed[index + 1] ?? '');
    assert.notEqual(high, -1);
    assert.notEqual(low, -1);
    hex += ((high << 6) | low).toString(16).padStart(3, '0');
  }
  assert.equal(hex.length, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
