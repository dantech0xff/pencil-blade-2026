import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CLASSIC_BOMB_RESOURCES,
  CLASSIC_CRITICAL_PARTICLE_RESOURCES,
  CLASSIC_NORMAL_FRUIT_RESOURCES,
  CLASSIC_SCORE_HUD_FONT_RESOURCE,
  canonicalResourceToBundlePath,
  canonicalRasterToSpriteFrameBundlePath,
  getClassicBombResource,
  getClassicCriticalParticleResource,
  getClassicPresentationResources,
  getClassicNormalFruitResources,
} from '../../../game/assets/scripts/domain/classic-resource-contract.ts';
import {
  CLASSIC_SCORE_HUD_FONT_CANONICAL_PATH,
} from '../../../game/assets/scripts/domain/classic-score-hud-presentation.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const STAGING_MANIFEST = readJson<{
  readonly entries: readonly {
    readonly bytes: number;
    readonly canonicalPath: string;
    readonly cocosType: string;
    readonly sha256: string;
    readonly targetPath: string;
  }[];
}>('assets/catalog/creator-staging-manifest.json');
const STAGED_PATHS = new Set(STAGING_MANIFEST.entries.map((entry) => entry.canonicalPath));
const STAGED_ENTRIES = new Map(STAGING_MANIFEST.entries.map((entry) => [entry.canonicalPath, entry]));

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

test('score HUD rasters preserve exact paired paths, dimensions, and SpriteFrame imports', () => {
  const low = getClassicPresentationResources('480x800');
  assert.deepEqual({
    scoreIcon: low.scoreIcon,
    bestScoreCup: low.bestScoreCup,
    doubleScorePanel: low.doubleScorePanel,
  }, {
    scoreIcon: {
      canonicalPath: '480x800/Interfaces/object-score-sprite.png',
      dimensions: { width: 55, height: 55 },
    },
    bestScoreCup: {
      canonicalPath: '480x800/Interfaces/object-score-best-cup.png',
      dimensions: { width: 49, height: 52 },
    },
    doubleScorePanel: {
      canonicalPath: '480x800/Interfaces/object-score-double.png',
      dimensions: { width: 134, height: 115 },
    },
  });

  const high = getClassicPresentationResources('720x1280');
  assert.deepEqual({
    scoreIcon: high.scoreIcon,
    bestScoreCup: high.bestScoreCup,
    doubleScorePanel: high.doubleScorePanel,
  }, {
    scoreIcon: {
      canonicalPath: '720x1280/Interfaces/object-score-sprite.png',
      dimensions: { width: 82, height: 82 },
    },
    bestScoreCup: {
      canonicalPath: '720x1280/Interfaces/object-score-best-cup.png',
      dimensions: { width: 73, height: 77 },
    },
    doubleScorePanel: {
      canonicalPath: '720x1280/Interfaces/object-score-double.png',
      dimensions: { width: 200, height: 172 },
    },
  });

  for (const tree of ['480x800', '720x1280'] as const) {
    const presentation = getClassicPresentationResources(tree);
    for (const resource of [
      presentation.scoreIcon,
      presentation.bestScoreCup,
      presentation.doubleScorePanel,
    ]) {
      assertStagedRasterGeometry(resource);
    }
  }
});

test('score HUD font preserves the exact shared TTF path and Creator importer', () => {
  assert.deepEqual(CLASSIC_SCORE_HUD_FONT_RESOURCE, {
    canonicalPath: 'Fonts/Linds.ttf',
  });
  assert.equal(
    CLASSIC_SCORE_HUD_FONT_RESOURCE.canonicalPath,
    CLASSIC_SCORE_HUD_FONT_CANONICAL_PATH,
  );
  const stagedFont = STAGED_ENTRIES.get(CLASSIC_SCORE_HUD_FONT_RESOURCE.canonicalPath);
  assert.ok(stagedFont);
  assert.deepEqual({
    canonicalPath: stagedFont.canonicalPath,
    targetPath: stagedFont.targetPath,
    bytes: stagedFont.bytes,
    cocosType: stagedFont.cocosType,
    sha256: stagedFont.sha256,
  }, {
    canonicalPath: 'Fonts/Linds.ttf',
    targetPath: 'game/assets/game/Fonts/Linds.ttf',
    bytes: 67068,
    cocosType: 'cc.TTFFont',
    sha256: '1b2b53f71f90afe4465d22ee31537adbd5d30285145419508f6202a2f1797729',
  });

  const font = readBinary(`game/assets/game/${CLASSIC_SCORE_HUD_FONT_RESOURCE.canonicalPath}`);
  assert.equal(font.length, 67068);
  assert.equal(font.readUInt32BE(0), 0x0001_0000);

  const meta = readJson<{
    readonly files: readonly string[];
    readonly imported: boolean;
    readonly importer: string;
    readonly subMetas: Readonly<Record<string, unknown>>;
  }>(`game/assets/game/${CLASSIC_SCORE_HUD_FONT_RESOURCE.canonicalPath}.meta`);
  assert.deepEqual({
    importer: meta.importer,
    imported: meta.imported,
    files: meta.files,
    subMetas: meta.subMetas,
  }, {
    importer: 'ttf-font',
    imported: true,
    files: ['.json', 'Linds.ttf'],
    subMetas: {},
  });
  assert.equal(canonicalResourceToBundlePath(CLASSIC_SCORE_HUD_FONT_RESOURCE.canonicalPath), 'Fonts/Linds');
});

test('Creator loader exposes exact score HUD SpriteFrames and fail-closed Font loading', () => {
  const loaderSource = readText('game/assets/scripts/creator/classic-resource-loader.ts');

  for (const field of ['scoreIcon', 'bestScoreCup', 'doubleScorePanel']) {
    assert.match(
      loaderSource,
      new RegExp(`descriptor\\('presentation\\.${field}', presentation\\.${field}\\)`),
      field,
    );
    assert.match(
      loaderSource,
      new RegExp(`${field}: requireLoaded\\([\\s\\S]*?'presentation\\.${field}'`),
      field,
    );
  }
  assert.match(loaderSource, /import \* as Cocos from 'cc'/);
  assert.match(loaderSource, /type Font,/);
  assert.match(loaderSource, /readonly scoreFont: LoadedClassicFontResource/);
  assert.match(loaderSource, /loadClassicScoreFont\(bundle\)/);
  assert.match(loaderSource, /canonicalResourceToBundlePath\(canonicalPath\)/);
  assert.match(loaderSource, /bundle\.load\(bundlePath, Cocos\.Font, \(error, font\) =>/);
  assert.match(loaderSource, /if \(font === null \|\| font === undefined\)/);
  assert.match(loaderSource, /Creator returned no Classic score font for \$\{canonicalPath\}/);
  assert.match(loaderSource, /\.\.\.CLASSIC_SCORE_HUD_FONT_RESOURCE,[\s\S]*?font,/);
  assert.match(loaderSource, /bombResource,[\s\S]*?scoreFont,[\s\S]*?\);/);
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
  assert.equal(canonicalResourceToBundlePath('Fonts/Linds.ttf'), 'Fonts/Linds');
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
