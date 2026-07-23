import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CLASSIC_BOMB_SMOKE_RESOURCES,
  CLASSIC_BOMB_RESOURCES,
  CLASSIC_COMBO_FONT_RESOURCE,
  CLASSIC_CRITICAL_PARTICLE_RESOURCES,
  CLASSIC_DEFAULT_BLADE_RESOURCES,
  CLASSIC_NORMAL_FRUIT_RESOURCES,
  CLASSIC_RESULT_FONT_RESOURCES,
  CLASSIC_RESULT_RESOURCES,
  CLASSIC_SCORE_HUD_FONT_RESOURCE,
  canonicalResourceToBundlePath,
  canonicalRasterToSpriteFrameBundlePath,
  getClassicBombResource,
  getClassicBombSmokeResource,
  getClassicCriticalParticleResource,
  getClassicDefaultBladeResource,
  getClassicPresentationResources,
  getClassicNormalFruitResources,
  getClassicResultResources,
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

test('standard Bomb intact-fuse smoke uses the exact byte-identical 30-frame atlas', () => {
  assert.deepEqual(CLASSIC_BOMB_SMOKE_RESOURCES, {
    '480x800': {
      canonicalPath: '480x800/Bomb/bombsmoke.png',
      dimensions: { width: 1920, height: 256 },
    },
    '720x1280': {
      canonicalPath: '720x1280/Bomb/bombsmoke.png',
      dimensions: { width: 1920, height: 256 },
    },
  });

  const low = readBinary('game/assets/game/480x800/Bomb/bombsmoke.png');
  const high = readBinary('game/assets/game/720x1280/Bomb/bombsmoke.png');
  assert.equal(low.equals(high), true);
  assert.equal(
    sha256(low),
    '277f464434115cc79048013dc12d956865cf32e09802432ee097a636ccd3d4fe',
  );

  for (const tree of ['480x800', '720x1280'] as const) {
    const resource = getClassicBombSmokeResource(tree);
    assertStagedRasterGeometry(resource);
  }
});

test('default BasicBlade ID 0 uses the exact byte-identical RGB texture in both trees', () => {
  assert.deepEqual(CLASSIC_DEFAULT_BLADE_RESOURCES, {
    '480x800': {
      canonicalPath: '480x800/Blades/blade0.png',
      dimensions: { width: 256, height: 256 },
    },
    '720x1280': {
      canonicalPath: '720x1280/Blades/blade0.png',
      dimensions: { width: 256, height: 256 },
    },
  });

  const low = readBinary('game/assets/game/480x800/Blades/blade0.png');
  const high = readBinary('game/assets/game/720x1280/Blades/blade0.png');
  assert.equal(low.equals(high), true);

  for (const tree of ['480x800', '720x1280'] as const) {
    const resource = getClassicDefaultBladeResource(0, tree);
    const image = readBinary(`game/assets/game/${resource.canonicalPath}`);
    assertStagedRasterGeometry(resource);
    assert.equal(image.length, 634);
    assert.equal(image[24], 8, `${resource.canonicalPath} bit depth`);
    assert.equal(image[25], 2, `${resource.canonicalPath} PNG color type`);
    assert.equal(
      sha256(image),
      '32713af6c40cf4e9a0b48e87fed53c37cb32818b14143020db22787c336559d8',
    );
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

test('Creator loader exposes the exact standard-Bomb smoke atlas to shared modes', () => {
  const loaderSource = readText('game/assets/scripts/creator/classic-resource-loader.ts');

  assert.match(
    loaderSource,
    /descriptor\(bombSmokeKey\(\), getClassicBombSmokeResource\(assetTree\)\)/,
  );
  assert.match(
    loaderSource,
    /const bombSmoke = requireLoadedBombSmoke\(assetTree, loadedByKey\)/,
  );
  assert.match(loaderSource, /readonly bombSmoke: LoadedClassicRasterResource/);
  assert.match(loaderSource, /this\.bombSmoke = bombSmoke/);
});

test('Creator loader exposes the exact default BasicBlade SpriteFrame', () => {
  const loaderSource = readText('game/assets/scripts/creator/classic-resource-loader.ts');

  assert.match(
    loaderSource,
    /descriptor\(defaultBladeKey\(0\), getClassicDefaultBladeResource\(0, assetTree\)\)/,
  );
  assert.match(
    loaderSource,
    /const defaultBlade = requireLoadedDefaultBlade\(assetTree, loadedByKey\)/,
  );
  assert.match(loaderSource, /readonly defaultBlade: LoadedClassicRasterResource/);
  assert.match(loaderSource, /function defaultBladeKey\(selectedBladeId: 0\): string/);
  assert.match(
    loaderSource,
    /getClassicDefaultBladeResource\(selectedBladeId, assetTree\)/,
  );
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

test('shared ComboItem font preserves GroBold bytes and fail-closed catalog loading', () => {
  assert.deepEqual(CLASSIC_COMBO_FONT_RESOURCE, {
    canonicalPath: 'Fonts/GroBold.ttf',
  });
  assertStagedFontProvenance(CLASSIC_COMBO_FONT_RESOURCE, {
    bytes: 25388,
    fileName: 'GroBold.ttf',
    sha256: '98e9c349709da1cd410d65b2954d30e355c154a8ea52004ecbe6eb0d8205d040',
  });
  assert.equal(
    canonicalResourceToBundlePath(CLASSIC_COMBO_FONT_RESOURCE.canonicalPath),
    'Fonts/GroBold',
  );

  const loaderSource = readText('game/assets/scripts/creator/classic-resource-loader.ts');
  assert.match(loaderSource, /readonly comboFont: LoadedClassicFontResource/);
  assert.match(loaderSource, /loadClassicComboFont\(bundle\)/);
  assert.match(
    loaderSource,
    /const canonicalPath = CLASSIC_COMBO_FONT_RESOURCE\.canonicalPath/,
  );
  assert.match(loaderSource, /Failed to load Classic combo font/);
  assert.match(loaderSource, /Creator returned no Classic combo font/);
  assert.match(
    loaderSource,
    /scoreFont,[\s\S]*?comboFont,[\s\S]*?result,[\s\S]*?resultFonts/,
  );
});

test('Classic result rasters preserve exact canonical paths and paired dimensions', () => {
  assert.deepEqual(CLASSIC_RESULT_RESOURCES, {
    '480x800': {
      background: {
        canonicalPath: '480x800/Interfaces/object-display-score-background.png',
        dimensions: { width: 442, height: 407 },
      },
      bonusCoinsBadge: {
        canonicalPath: '480x800/Interfaces/object-bonus-coins.png',
        dimensions: { width: 130, height: 129 },
      },
      bonusCoinsEffect: {
        canonicalPath: '480x800/Interfaces/object-bonus-coins-effect.png',
        dimensions: { width: 229, height: 229 },
      },
      bonusParticle: {
        canonicalPath: '480x800/Interfaces/object-bonus-particle.png',
        dimensions: { width: 48, height: 46 },
      },
      coin: {
        canonicalPath: '480x800/Interfaces/object-coin.png',
        dimensions: { width: 34, height: 34 },
      },
      header: {
        canonicalPath: '480x800/Interfaces/object-mode-results.png',
        dimensions: { width: 552, height: 118 },
      },
      medalNone: {
        canonicalPath: '480x800/Interfaces/object-medal-none.png',
        dimensions: { width: 104, height: 209 },
      },
      menuNormal: {
        canonicalPath: '480x800/Buttons/button-menu-score-normal.png',
        dimensions: { width: 134, height: 129 },
      },
      menuSelected: {
        canonicalPath: '480x800/Buttons/button-menu-score-selected.png',
        dimensions: { width: 134, height: 129 },
      },
      retryNormal: {
        canonicalPath: '480x800/Buttons/button-retry-normal.png',
        dimensions: { width: 111, height: 105 },
      },
      retrySelected: {
        canonicalPath: '480x800/Buttons/button-retry-selected.png',
        dimensions: { width: 112, height: 105 },
      },
      totalCoins: {
        canonicalPath: '480x800/Interfaces/total-coins.png',
        dimensions: { width: 334, height: 131 },
      },
    },
    '720x1280': {
      background: {
        canonicalPath: '720x1280/Interfaces/object-display-score-background.png',
        dimensions: { width: 662, height: 610 },
      },
      bonusCoinsBadge: {
        canonicalPath: '720x1280/Interfaces/object-bonus-coins.png',
        dimensions: { width: 159, height: 157 },
      },
      bonusCoinsEffect: {
        canonicalPath: '720x1280/Interfaces/object-bonus-coins-effect.png',
        dimensions: { width: 342, height: 342 },
      },
      bonusParticle: {
        canonicalPath: '720x1280/Interfaces/object-bonus-particle.png',
        dimensions: { width: 71, height: 68 },
      },
      coin: {
        canonicalPath: '720x1280/Interfaces/object-coin.png',
        dimensions: { width: 50, height: 49 },
      },
      header: {
        canonicalPath: '720x1280/Interfaces/object-mode-results.png',
        dimensions: { width: 792, height: 159 },
      },
      medalNone: {
        canonicalPath: '720x1280/Interfaces/object-medal-none.png',
        dimensions: { width: 154, height: 314 },
      },
      menuNormal: {
        canonicalPath: '720x1280/Buttons/button-menu-score-normal.png',
        dimensions: { width: 201, height: 194 },
      },
      menuSelected: {
        canonicalPath: '720x1280/Buttons/button-menu-score-selected.png',
        dimensions: { width: 200, height: 193 },
      },
      retryNormal: {
        canonicalPath: '720x1280/Buttons/button-retry-normal.png',
        dimensions: { width: 167, height: 158 },
      },
      retrySelected: {
        canonicalPath: '720x1280/Buttons/button-retry-selected.png',
        dimensions: { width: 167, height: 158 },
      },
      totalCoins: {
        canonicalPath: '720x1280/Interfaces/total-coins.png',
        dimensions: { width: 464, height: 160 },
      },
    },
  });

  for (const tree of ['480x800', '720x1280'] as const) {
    const result = getClassicResultResources(tree);
    assert.equal(result, CLASSIC_RESULT_RESOURCES[tree]);
    for (const resource of Object.values(result)) {
      assertStagedRasterGeometry(resource);
    }
  }
});

test('Classic result fonts preserve exact TTF paths, bytes, hashes, and Creator imports', () => {
  assert.deepEqual(CLASSIC_RESULT_FONT_RESOURCES, {
    agencyB: { canonicalPath: 'Fonts/AgencyB.ttf' },
    slabThing: { canonicalPath: 'Fonts/SlabThing.ttf' },
  });

  assertStagedFontProvenance(CLASSIC_RESULT_FONT_RESOURCES.agencyB, {
    bytes: 60656,
    fileName: 'AgencyB.ttf',
    sha256: '4fde694cc486b55266f7561c685fbd9153ea0003f0c0c39fc744b132051d40c5',
  });
  assertStagedFontProvenance(CLASSIC_RESULT_FONT_RESOURCES.slabThing, {
    bytes: 161488,
    fileName: 'SlabThing.ttf',
    sha256: '9e07461cbe34a525fe36222710f6067712c6a956f732e2a0d963bdb3d7e151a8',
  });

  assert.equal(
    canonicalResourceToBundlePath(CLASSIC_RESULT_FONT_RESOURCES.agencyB.canonicalPath),
    'Fonts/AgencyB',
  );
  assert.equal(
    canonicalResourceToBundlePath(CLASSIC_RESULT_FONT_RESOURCES.slabThing.canonicalPath),
    'Fonts/SlabThing',
  );
});

test('Creator loader includes the exact result SpriteFrames and fail-closed result fonts', () => {
  const loaderSource = readText('game/assets/scripts/creator/classic-resource-loader.ts');
  const resultFields = [
    'background',
    'bonusCoinsBadge',
    'bonusCoinsEffect',
    'bonusParticle',
    'coin',
    'header',
    'medalNone',
    'menuNormal',
    'menuSelected',
    'retryNormal',
    'retrySelected',
    'totalCoins',
  ];

  for (const field of resultFields) {
    assert.match(
      loaderSource,
      new RegExp(`descriptor\\('result\\.${field}', result\\.${field}\\)`),
      field,
    );
    assert.match(
      loaderSource,
      new RegExp(`${field}: requireLoaded\\([\\s\\S]*?'result\\.${field}'`),
      field,
    );
  }

  assert.match(loaderSource, /readonly result: LoadedClassicResultResources/);
  assert.match(loaderSource, /readonly resultFonts: LoadedClassicResultFonts/);
  assert.match(loaderSource, /const result = requireLoadedResult\(assetTree, loadedByKey\)/);
  assert.match(loaderSource, /loadClassicResultFonts\(bundle\)/);
  assert.match(
    loaderSource,
    /loadClassicResultFont\(bundle, 'agencyB', CLASSIC_RESULT_FONT_RESOURCES\.agencyB\)/,
  );
  assert.match(
    loaderSource,
    /loadClassicResultFont\(bundle, 'slabThing', CLASSIC_RESULT_FONT_RESOURCES\.slabThing\)/,
  );
  assert.match(loaderSource, /canonicalResourceToBundlePath\(resource\.canonicalPath\)/);
  assert.match(loaderSource, /bundle\.load\(bundlePath, Cocos\.Font, \(error, font\) =>/);
  assert.match(loaderSource, /if \(font === null \|\| font === undefined\)/);
  assert.match(loaderSource, /Creator returned no Classic result font for \$\{resource\.canonicalPath\}/);
  assert.match(
    loaderSource,
    /scoreFont,[\s\S]*?result,[\s\S]*?resultFonts,[\s\S]*?\);/,
  );
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
  assert.throws(() => getClassicResultResources('1080x1920' as never), RangeError);
  assert.throws(() => getClassicBombResource(-1, '480x800'), RangeError);
  assert.throws(() => getClassicBombResource(1, '720x1280'), RangeError);
  assert.throws(() => getClassicBombResource(Number.NaN, '480x800'), RangeError);
  assert.throws(
    () => getClassicBombResource(0, '1080x1920' as never),
    RangeError,
  );
  assert.throws(
    () => getClassicBombSmokeResource('1080x1920' as never),
    RangeError,
  );
  assert.throws(() => getClassicDefaultBladeResource(-1, '480x800'), RangeError);
  assert.throws(() => getClassicDefaultBladeResource(1, '720x1280'), RangeError);
  assert.throws(() => getClassicDefaultBladeResource(Number.NaN, '480x800'), RangeError);
  assert.throws(
    () => getClassicDefaultBladeResource(0, '1080x1920' as never),
    RangeError,
  );
});

function assertStagedRasterGeometry(resource: {
  readonly canonicalPath: string;
  readonly dimensions: { readonly height: number; readonly width: number };
}): void {
  assert.equal(STAGED_PATHS.has(resource.canonicalPath), true, resource.canonicalPath);

  const image = readBinary(`game/assets/game/${resource.canonicalPath}`);
  const staged = STAGED_ENTRIES.get(resource.canonicalPath);
  assert.ok(staged, resource.canonicalPath);
  assert.equal(staged.targetPath, `game/assets/game/${resource.canonicalPath}`);
  assert.equal(staged.cocosType, 'cc.ImageAsset');
  assert.equal(staged.bytes, image.length);
  assert.equal(staged.sha256, sha256(image));
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

function assertStagedFontProvenance(
  resource: { readonly canonicalPath: string },
  expected: {
    readonly bytes: number;
    readonly fileName: string;
    readonly sha256: string;
  },
): void {
  const staged = STAGED_ENTRIES.get(resource.canonicalPath);
  assert.ok(staged, resource.canonicalPath);
  assert.deepEqual({
    bytes: staged.bytes,
    canonicalPath: staged.canonicalPath,
    cocosType: staged.cocosType,
    sha256: staged.sha256,
    targetPath: staged.targetPath,
  }, {
    bytes: expected.bytes,
    canonicalPath: resource.canonicalPath,
    cocosType: 'cc.TTFFont',
    sha256: expected.sha256,
    targetPath: `game/assets/game/${resource.canonicalPath}`,
  });

  const font = readBinary(`game/assets/game/${resource.canonicalPath}`);
  assert.equal(font.length, expected.bytes);
  assert.equal(font.readUInt32BE(0), 0x0001_0000);
  assert.equal(sha256(font), expected.sha256);

  const meta = readJson<{
    readonly files: readonly string[];
    readonly imported: boolean;
    readonly importer: string;
    readonly subMetas: Readonly<Record<string, unknown>>;
  }>(`game/assets/game/${resource.canonicalPath}.meta`);
  assert.deepEqual({
    files: meta.files,
    imported: meta.imported,
    importer: meta.importer,
    subMetas: meta.subMetas,
  }, {
    files: ['.json', expected.fileName],
    imported: true,
    importer: 'ttf-font',
    subMetas: {},
  });
}

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
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
