import type { ClassicAssetTree } from './resolution-profile-service';

export type ClassicNormalFruitId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type ClassicNormalFruitName =
  | 'apple'
  | 'banana'
  | 'strawberry'
  | 'watermelon'
  | 'pineapple'
  | 'mangosteen'
  | 'kiwi'
  | 'orange'
  | 'papaya';

export interface ClassicRasterDimensions {
  readonly height: number;
  readonly width: number;
}

export interface ClassicRasterResource {
  readonly canonicalPath: string;
  readonly dimensions: ClassicRasterDimensions;
}

export interface ClassicFontResource {
  readonly canonicalPath: string;
}

export interface ClassicNormalFruitRasterSet {
  readonly cutBottom: ClassicRasterResource;
  readonly cutTop: ClassicRasterResource;
  readonly intact: ClassicRasterResource;
}

export interface ClassicNormalFruitResourceDefinition {
  readonly fruitId: ClassicNormalFruitId;
  readonly name: ClassicNormalFruitName;
  readonly rasters: Readonly<Record<ClassicAssetTree, ClassicNormalFruitRasterSet>>;
}

/** The only bomb ID scheduled by the recovered Classic runtime. */
export type ClassicBombId = 0;

export interface ClassicPresentationRasterSet {
  readonly background: ClassicRasterResource;
  readonly bestScoreCup: ClassicRasterResource;
  readonly doubleScorePanel: ClassicRasterResource;
  readonly failFilled: ClassicRasterResource;
  readonly failNormal: ClassicRasterResource;
  readonly introGood: ClassicRasterResource;
  readonly introLuck: ClassicRasterResource;
  readonly scoreIcon: ClassicRasterResource;
  readonly terminalGame: ClassicRasterResource;
  readonly terminalOver: ClassicRasterResource;
}

export type ClassicCriticalParticleIndex = 1 | 2 | 3 | 4;

export type ClassicCriticalParticleRasterSet = readonly [
  ClassicRasterResource,
  ClassicRasterResource,
  ClassicRasterResource,
  ClassicRasterResource,
];

const NORMAL_FRUIT_NAMES: readonly ClassicNormalFruitName[] = Object.freeze([
  'apple',
  'banana',
  'strawberry',
  'watermelon',
  'pineapple',
  'mangosteen',
  'kiwi',
  'orange',
  'papaya',
]);

const NORMAL_FRUIT_DIMENSIONS = {
  '480x800': [
    [[96, 82], [87, 50], [95, 47]],
    [[60, 154], [60, 89], [46, 78]],
    [[83, 64], [84, 39], [79, 36]],
    [[109, 144], [107, 87], [77, 77]],
    [[84, 158], [84, 123], [80, 56]],
    [[67, 95], [66, 78], [64, 46]],
    [[63, 81], [63, 58], [63, 54]],
    [[75, 101], [74, 80], [73, 53]],
    [[138, 67], [138, 44], [138, 44]],
  ],
  '720x1280': [
    [[143, 122], [143, 69], [131, 74]],
    [[89, 231], [90, 134], [68, 117]],
    [[125, 96], [125, 58], [118, 54]],
    [[163, 216], [128, 136], [130, 88]],
    [[124, 235], [125, 184], [121, 85]],
    [[98, 142], [97, 115], [95, 67]],
    [[94, 121], [93, 87], [93, 79]],
    [[112, 152], [110, 119], [110, 79]],
    [[206, 100], [206, 65], [207, 65]],
  ],
} as const;

const CRITICAL_PARTICLE_DIMENSIONS = {
  '480x800': [[35, 35], [51, 51], [44, 44], [52, 51]],
  '720x1280': [[52, 52], [77, 76], [65, 66], [77, 76]],
} as const;

export const CLASSIC_SCORE_HUD_FONT_RESOURCE: ClassicFontResource = Object.freeze({
  canonicalPath: 'Fonts/Linds.ttf',
});

export const CLASSIC_NORMAL_FRUIT_RESOURCES: readonly ClassicNormalFruitResourceDefinition[]
  = Object.freeze(NORMAL_FRUIT_NAMES.map((name, fruitId) => Object.freeze({
    fruitId: fruitId as ClassicNormalFruitId,
    name,
    rasters: Object.freeze({
      '480x800': createRasterSet(
        '480x800',
        name,
        NORMAL_FRUIT_DIMENSIONS['480x800'][fruitId],
      ),
      '720x1280': createRasterSet(
        '720x1280',
        name,
        NORMAL_FRUIT_DIMENSIONS['720x1280'][fruitId],
      ),
    }),
  })));

export const CLASSIC_PRESENTATION_RESOURCES: Readonly<Record<ClassicAssetTree, ClassicPresentationRasterSet>>
  = Object.freeze({
    '480x800': Object.freeze({
      background: createRaster('480x800/Backgrounds/paperbackground0.png', [480, 800]),
      bestScoreCup: createRaster('480x800/Interfaces/object-score-best-cup.png', [49, 52]),
      doubleScorePanel: createRaster('480x800/Interfaces/object-score-double.png', [134, 115]),
      failFilled: createRaster('480x800/Interfaces/object-x-filled.png', [49, 48]),
      failNormal: createRaster('480x800/Interfaces/object-x-normal.png', [49, 48]),
      introGood: createRaster('480x800/Text/text-good.png', [112, 25]),
      introLuck: createRaster('480x800/Text/text-luck.png', [112, 33]),
      scoreIcon: createRaster('480x800/Interfaces/object-score-sprite.png', [55, 55]),
      terminalGame: createRaster('480x800/Text/text-game.png', [269, 51]),
      terminalOver: createRaster('480x800/Text/text-over.png', [216, 85]),
    }),
    '720x1280': Object.freeze({
      background: createRaster('720x1280/Backgrounds/paperbackground0.png', [720, 1280]),
      bestScoreCup: createRaster('720x1280/Interfaces/object-score-best-cup.png', [73, 77]),
      doubleScorePanel: createRaster('720x1280/Interfaces/object-score-double.png', [200, 172]),
      failFilled: createRaster('720x1280/Interfaces/object-x-filled.png', [73, 73]),
      failNormal: createRaster('720x1280/Interfaces/object-x-normal.png', [72, 71]),
      introGood: createRaster('720x1280/Text/text-good.png', [168, 37]),
      introLuck: createRaster('720x1280/Text/text-luck.png', [168, 50]),
      scoreIcon: createRaster('720x1280/Interfaces/object-score-sprite.png', [82, 82]),
      terminalGame: createRaster('720x1280/Text/text-game.png', [404, 76]),
      terminalOver: createRaster('720x1280/Text/text-over.png', [324, 126]),
    }),
  });

export const CLASSIC_BOMB_RESOURCES: Readonly<Record<ClassicAssetTree, ClassicRasterResource>>
  = Object.freeze({
    '480x800': createRaster('480x800/Bomb/bomb_X.png', [80, 108]),
    '720x1280': createRaster('720x1280/Bomb/bomb_X.png', [121, 161]),
  });

export const CLASSIC_CRITICAL_PARTICLE_RESOURCES: Readonly<
  Record<ClassicAssetTree, ClassicCriticalParticleRasterSet>
> = Object.freeze({
  '480x800': createCriticalParticleRasterSet(
    '480x800',
    CRITICAL_PARTICLE_DIMENSIONS['480x800'],
  ),
  '720x1280': createCriticalParticleRasterSet(
    '720x1280',
    CRITICAL_PARTICLE_DIMENSIONS['720x1280'],
  ),
});

export function getClassicNormalFruitResources(
  fruitId: number,
  assetTree: ClassicAssetTree,
): ClassicNormalFruitRasterSet {
  if (!Number.isSafeInteger(fruitId) || fruitId < 0 || fruitId >= CLASSIC_NORMAL_FRUIT_RESOURCES.length) {
    throw new RangeError('fruitId must identify an ordinary Classic fruit from 0 through 8');
  }
  if (assetTree !== '480x800' && assetTree !== '720x1280') {
    throw new RangeError('assetTree must be 480x800 or 720x1280');
  }
  return CLASSIC_NORMAL_FRUIT_RESOURCES[fruitId].rasters[assetTree];
}

export function getClassicPresentationResources(
  assetTree: ClassicAssetTree,
): ClassicPresentationRasterSet {
  if (assetTree !== '480x800' && assetTree !== '720x1280') {
    throw new RangeError('assetTree must be 480x800 or 720x1280');
  }
  return CLASSIC_PRESENTATION_RESOURCES[assetTree];
}

export function getClassicBombResource(
  bombId: number,
  assetTree: ClassicAssetTree,
): ClassicRasterResource {
  if (!Number.isSafeInteger(bombId) || bombId !== 0) {
    throw new RangeError('bombId must identify the standard Classic bomb with ID 0');
  }
  if (assetTree !== '480x800' && assetTree !== '720x1280') {
    throw new RangeError('assetTree must be 480x800 or 720x1280');
  }
  return CLASSIC_BOMB_RESOURCES[assetTree];
}

export function getClassicCriticalParticleResource(
  index: ClassicCriticalParticleIndex,
  assetTree: ClassicAssetTree,
): ClassicRasterResource {
  if (!Number.isSafeInteger(index) || index < 1 || index > 4) {
    throw new RangeError('index must identify a recovered critical particle from 1 through 4');
  }
  if (assetTree !== '480x800' && assetTree !== '720x1280') {
    throw new RangeError('assetTree must be 480x800 or 720x1280');
  }
  return CLASSIC_CRITICAL_PARTICLE_RESOURCES[assetTree][index - 1];
}

export function canonicalResourceToBundlePath(canonicalPath: string): string {
  if (typeof canonicalPath !== 'string' || canonicalPath.length === 0) {
    throw new TypeError('canonicalPath must be a non-empty string');
  }
  if (canonicalPath.startsWith('/') || canonicalPath.includes('\\') || canonicalPath.includes('..')) {
    throw new RangeError('canonicalPath must remain a normalized bundle-relative path');
  }
  const extensionIndex = canonicalPath.lastIndexOf('.');
  if (extensionIndex <= canonicalPath.lastIndexOf('/')) {
    throw new RangeError('canonicalPath must include an asset extension');
  }
  return canonicalPath.slice(0, extensionIndex);
}

export function canonicalRasterToSpriteFrameBundlePath(canonicalPath: string): string {
  return `${canonicalResourceToBundlePath(canonicalPath)}/spriteFrame`;
}

function createRasterSet(
  tree: ClassicAssetTree,
  name: ClassicNormalFruitName,
  dimensions: readonly [
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
  ],
): ClassicNormalFruitRasterSet {
  const prefix = `${tree}/Fruits/fruit-${name}`;
  return Object.freeze({
    intact: createRaster(`${prefix}.png`, dimensions[0]),
    cutTop: createRaster(`${prefix}-cut-top.png`, dimensions[1]),
    cutBottom: createRaster(`${prefix}-cut-bottom.png`, dimensions[2]),
  });
}

function createCriticalParticleRasterSet(
  tree: ClassicAssetTree,
  dimensions: readonly [
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
  ],
): ClassicCriticalParticleRasterSet {
  return Object.freeze(dimensions.map((size, offset) => (
    createRaster(`${tree}/Criticles/criticle${offset + 1}.png`, size)
  ))) as ClassicCriticalParticleRasterSet;
}

function createRaster(
  canonicalPath: string,
  dimensions: readonly [number, number],
): ClassicRasterResource {
  return Object.freeze({
    canonicalPath,
    dimensions: Object.freeze({ width: dimensions[0], height: dimensions[1] }),
  });
}
