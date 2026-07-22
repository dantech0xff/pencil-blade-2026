import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CLASSIC_BOMB_RESOURCES,
  CLASSIC_CRITICAL_PARTICLE_RESOURCES,
  CLASSIC_NORMAL_FRUIT_RESOURCES,
  canonicalResourceToBundlePath,
  canonicalRasterToSpriteFrameBundlePath,
  getClassicBombResource,
  getClassicCriticalParticleResource,
  getClassicPresentationResources,
  getClassicNormalFruitResources,
} from '../../../game/assets/scripts/domain/classic-resource-contract.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const STAGING_MANIFEST = readJson<{
  readonly entries: readonly { readonly canonicalPath: string }[];
}>('assets/catalog/creator-staging-manifest.json');
const STAGED_PATHS = new Set(STAGING_MANIFEST.entries.map((entry) => entry.canonicalPath));

test('ordinary fruit IDs map exactly to the recovered names and paired raster trees', () => {
  assert.deepEqual(CLASSIC_NORMAL_FRUIT_RESOURCES.map(({ fruitId, name }) => ({ fruitId, name })), [
    { fruitId: 0, name: 'apple' },
    { fruitId: 1, name: 'banana' },
    { fruitId: 2, name: 'strawberry' },
    { fruitId: 3, name: 'watermelon' },
    { fruitId: 4, name: 'pineapple' },
    { fruitId: 5, name: 'mangosteen' },
    { fruitId: 6, name: 'kiwi' },
    { fruitId: 7, name: 'orange' },
    { fruitId: 8, name: 'papaya' },
  ]);

  const canonicalPaths = new Set<string>();
  for (const definition of CLASSIC_NORMAL_FRUIT_RESOURCES) {
    for (const tree of ['480x800', '720x1280'] as const) {
      const resources = getClassicNormalFruitResources(definition.fruitId, tree);
      for (const resource of [resources.intact, resources.cutTop, resources.cutBottom]) {
        assert.equal(STAGED_PATHS.has(resource.canonicalPath), true, resource.canonicalPath);
        assert.equal(canonicalPaths.has(resource.canonicalPath), false, resource.canonicalPath);
        canonicalPaths.add(resource.canonicalPath);
      }
    }
  }
  assert.equal(canonicalPaths.size, 54);
});

test('standard Classic bomb ID 0 maps only to the recovered bomb_X rasters', () => {
  assert.deepEqual(CLASSIC_BOMB_RESOURCES, {
    '480x800': {
      canonicalPath: '480x800/Bomb/bomb_X.png',
      dimensions: { width: 80, height: 108 },
    },
    '720x1280': {
      canonicalPath: '720x1280/Bomb/bomb_X.png',
      dimensions: { width: 121, height: 161 },
    },
  });

  for (const tree of ['480x800', '720x1280'] as const) {
    const resource = getClassicBombResource(0, tree);
    assert.equal(resource.canonicalPath, `${tree}/Bomb/bomb_X.png`);
    assertStagedRasterGeometry(resource);
  }
});

test('Creator loader includes one bomb descriptor and a runtime-validating catalog getter', () => {
  const loaderSource = readText('game/assets/scripts/creator/classic-resource-loader.ts');

  assert.match(
    loaderSource,
    /descriptor\(bombKey\(0\), getClassicBombResource\(0, assetTree\)\)/,
  );
  assert.match(loaderSource, /const bombResource = requireLoadedBomb\(assetTree, loadedByKey\)/);
  assert.match(loaderSource, /bomb\(bombId: number\): LoadedClassicRasterResource/);
  assert.match(loaderSource, /getClassicBombResource\(bombId, this\.assetTree\)/);
  assert.match(loaderSource, /function bombKey\(bombId: ClassicBombId\): string/);
  assert.doesNotMatch(loaderSource, /getClassicBombResource\(1,/);
});

test('contract dimensions match every staged PNG IHDR and untrimmed SpriteFrame', () => {
  for (const definition of CLASSIC_NORMAL_FRUIT_RESOURCES) {
    for (const tree of ['480x800', '720x1280'] as const) {
      const resources = getClassicNormalFruitResources(definition.fruitId, tree);
      for (const resource of [resources.intact, resources.cutTop, resources.cutBottom]) {
        const image = readBinary(`game/assets/game/${resource.canonicalPath}`);
        assert.equal(image.readUInt32BE(16), resource.dimensions.width, resource.canonicalPath);
        assert.equal(image.readUInt32BE(20), resource.dimensions.height, resource.canonicalPath);

        const meta = readJson<{
          readonly subMetas: Readonly<Record<string, {
            readonly importer: string;
            readonly userData: {
              readonly height: number;
              readonly rawHeight: number;
              readonly rawWidth: number;
              readonly trimType: string;
              readonly width: number;
            };
          }>>;
        }>(`game/assets/game/${resource.canonicalPath}.meta`);
        const spriteFrame = Object.values(meta.subMetas).find((entry) => entry.importer === 'sprite-frame');
        assert.ok(spriteFrame, resource.canonicalPath);
        assert.deepEqual({
          width: spriteFrame.userData.width,
          height: spriteFrame.userData.height,
          rawWidth: spriteFrame.userData.rawWidth,
          rawHeight: spriteFrame.userData.rawHeight,
          trimType: spriteFrame.userData.trimType,
        }, {
          width: resource.dimensions.width,
          height: resource.dimensions.height,
          rawWidth: resource.dimensions.width,
          rawHeight: resource.dimensions.height,
          trimType: 'none',
        }, resource.canonicalPath);
      }
    }
  }
});

test('background and GOOD/LUCK intro resources are exact for both resolution trees', () => {
  for (const tree of ['480x800', '720x1280'] as const) {
    const presentation = getClassicPresentationResources(tree);
    for (const resource of [
      presentation.background,
      presentation.failFilled,
      presentation.failNormal,
      presentation.introGood,
      presentation.introLuck,
      presentation.terminalGame,
      presentation.terminalOver,
    ]) {
      assert.equal(STAGED_PATHS.has(resource.canonicalPath), true, resource.canonicalPath);
      const image = readBinary(`game/assets/game/${resource.canonicalPath}`);
      assert.equal(image.readUInt32BE(16), resource.dimensions.width, resource.canonicalPath);
      assert.equal(image.readUInt32BE(20), resource.dimensions.height, resource.canonicalPath);
    }
  }
  assert.deepEqual(getClassicPresentationResources('480x800').background.dimensions, {
    width: 480,
    height: 800,
  });
  assert.deepEqual(getClassicPresentationResources('720x1280').introLuck.dimensions, {
    width: 168,
    height: 50,
  });
  assert.deepEqual(getClassicPresentationResources('480x800').failNormal.dimensions, {
    width: 49,
    height: 48,
  });
  assert.deepEqual(getClassicPresentationResources('720x1280').failFilled.dimensions, {
    width: 73,
    height: 73,
  });
});

test('all eight critical particle rasters preserve recovered Criticles paths and geometry', () => {
  assert.deepEqual(
    CLASSIC_CRITICAL_PARTICLE_RESOURCES['480x800'].map(({ dimensions }) => dimensions),
    [
      { width: 35, height: 35 },
      { width: 51, height: 51 },
      { width: 44, height: 44 },
      { width: 52, height: 51 },
    ],
  );
  assert.deepEqual(
    CLASSIC_CRITICAL_PARTICLE_RESOURCES['720x1280'].map(({ dimensions }) => dimensions),
    [
      { width: 52, height: 52 },
      { width: 77, height: 76 },
      { width: 65, height: 66 },
      { width: 77, height: 76 },
    ],
  );

  for (const tree of ['480x800', '720x1280'] as const) {
    for (const index of [1, 2, 3, 4] as const) {
      const resource = getClassicCriticalParticleResource(index, tree);
      assert.equal(resource.canonicalPath, `${tree}/Criticles/criticle${index}.png`);
      assert.equal(STAGED_PATHS.has(resource.canonicalPath), true, resource.canonicalPath);
      const image = readBinary(`game/assets/game/${resource.canonicalPath}`);
      assert.equal(image.readUInt32BE(16), resource.dimensions.width, resource.canonicalPath);
      assert.equal(image.readUInt32BE(20), resource.dimensions.height, resource.canonicalPath);
    }
  }
});

test('bundle paths preserve directories and remove exactly one extension', () => {
  assert.equal(
    canonicalResourceToBundlePath('720x1280/Fruits/fruit-apple-cut-top.png'),
    '720x1280/Fruits/fruit-apple-cut-top',
  );
  assert.equal(canonicalResourceToBundlePath('Sounds/tossfruit.wav'), 'Sounds/tossfruit');
  assert.equal(
    canonicalRasterToSpriteFrameBundlePath('720x1280/Fruits/fruit-apple-cut-top.png'),
    '720x1280/Fruits/fruit-apple-cut-top/spriteFrame',
  );
  assert.throws(() => canonicalResourceToBundlePath('../fruit.png'), RangeError);
  assert.throws(() => canonicalResourceToBundlePath('/fruit.png'), RangeError);
  assert.throws(() => canonicalResourceToBundlePath('fruit'), RangeError);
});

test('resource lookup rejects IDs and trees outside the recovered contract', () => {
  assert.throws(() => getClassicNormalFruitResources(-1, '480x800'), RangeError);
  assert.throws(() => getClassicNormalFruitResources(9, '720x1280'), RangeError);
  assert.throws(
    () => getClassicNormalFruitResources(0, '1080x1920' as never),
    RangeError,
  );
  assert.throws(() => getClassicCriticalParticleResource(0 as never, '480x800'), RangeError);
  assert.throws(() => getClassicCriticalParticleResource(5 as never, '720x1280'), RangeError);
  assert.throws(
    () => getClassicCriticalParticleResource(1, '1080x1920' as never),
    RangeError,
  );
  assert.throws(() => getClassicBombResource(-1, '480x800'), RangeError);
  assert.throws(() => getClassicBombResource(1, '720x1280'), RangeError);
  assert.throws(() => getClassicBombResource(Number.NaN, '480x800'), RangeError);
  assert.throws(
    () => getClassicBombResource(0, '1080x1920' as never),
    RangeError,
  );
});

function assertStagedRasterGeometry(resource: {
  readonly canonicalPath: string;
  readonly dimensions: { readonly height: number; readonly width: number };
}): void {
  assert.equal(STAGED_PATHS.has(resource.canonicalPath), true, resource.canonicalPath);

  const image = readBinary(`game/assets/game/${resource.canonicalPath}`);
  assert.equal(image.readUInt32BE(16), resource.dimensions.width, resource.canonicalPath);
  assert.equal(image.readUInt32BE(20), resource.dimensions.height, resource.canonicalPath);

  const meta = readJson<{
    readonly subMetas: Readonly<Record<string, {
      readonly importer: string;
      readonly userData: {
        readonly height: number;
        readonly rawHeight: number;
        readonly rawWidth: number;
        readonly trimType: string;
        readonly width: number;
      };
    }>>;
  }>(`game/assets/game/${resource.canonicalPath}.meta`);
  const spriteFrame = Object.values(meta.subMetas).find((entry) => entry.importer === 'sprite-frame');
  assert.ok(spriteFrame, resource.canonicalPath);
  assert.deepEqual({
    width: spriteFrame.userData.width,
    height: spriteFrame.userData.height,
    rawWidth: spriteFrame.userData.rawWidth,
    rawHeight: spriteFrame.userData.rawHeight,
    trimType: spriteFrame.userData.trimType,
  }, {
    width: resource.dimensions.width,
    height: resource.dimensions.height,
    rawWidth: resource.dimensions.width,
    rawHeight: resource.dimensions.height,
    trimType: 'none',
  }, resource.canonicalPath);
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

function readBinary(relativePath: string): Buffer {
  return readFileSync(`${REPOSITORY_ROOT}${relativePath}`);
}

function readText(relativePath: string): string {
  return readFileSync(`${REPOSITORY_ROOT}${relativePath}`, 'utf8');
}
