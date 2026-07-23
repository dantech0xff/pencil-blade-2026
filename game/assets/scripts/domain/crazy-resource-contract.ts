import {
  assertGameAssetTree,
  createGameRaster,
  type GameAssetTree,
  type GameFontResource,
  type GameRasterResource,
} from './game-resource-contract';

export type CrazySpecialFruitId = 10 | 11 | 12 | 13 | 14;

export type CrazySpecialFruitName =
  | 'bdouble'
  | 'b2toss'
  | 'bfreezy'
  | 'electric-apple'
  | 'magnetstrawberry';

export interface CrazySpecialFruitRasterSet {
  readonly cutBottom: GameRasterResource;
  readonly cutTop: GameRasterResource;
  readonly intact: GameRasterResource;
}

export interface CrazySpecialFruitResourceDefinition {
  readonly fruitId: CrazySpecialFruitId;
  readonly name: CrazySpecialFruitName;
  readonly rasters: Readonly<Record<GameAssetTree, CrazySpecialFruitRasterSet>>;
}

export type CrazyElectricFrameResources = readonly [
  GameRasterResource,
  GameRasterResource,
  GameRasterResource,
  GameRasterResource,
  GameRasterResource,
  GameRasterResource,
  GameRasterResource,
  GameRasterResource,
];

export interface CrazySupplementalRasterSet {
  readonly dragonCutBottomLeft: GameRasterResource;
  readonly dragonCutBottomRight: GameRasterResource;
  readonly dragonCutTopLeft: GameRasterResource;
  readonly dragonCutTopRight: GameRasterResource;
  readonly dragonFruit: GameRasterResource;
  readonly dragonSplash: GameRasterResource;
  readonly electricFrames: CrazyElectricFrameResources;
  readonly electricLeftNode: GameRasterResource;
  readonly electricRightNode: GameRasterResource;
  readonly freezeClock: GameRasterResource;
  readonly introGo: GameRasterResource;
  readonly introSixty: GameRasterResource;
  readonly magnet: GameRasterResource;
  readonly magnetLine: GameRasterResource;
  readonly timeUp: GameRasterResource;
}

const SPECIAL_FRUIT_DEFINITIONS = Object.freeze([
  Object.freeze({ fruitId: 10 as const, name: 'bdouble' as const }),
  Object.freeze({ fruitId: 11 as const, name: 'b2toss' as const }),
  Object.freeze({ fruitId: 12 as const, name: 'bfreezy' as const }),
  Object.freeze({ fruitId: 13 as const, name: 'electric-apple' as const }),
  Object.freeze({ fruitId: 14 as const, name: 'magnetstrawberry' as const }),
]);

const SPECIAL_FRUIT_DIMENSIONS = {
  '480x800': {
    bdouble: [[60, 154], [60, 85], [46, 79]],
    b2toss: [[60, 154], [60, 89], [46, 75]],
    bfreezy: [[60, 154], [60, 88], [47, 80]],
    'electric-apple': [[96, 82], [88, 50], [95, 47]],
    magnetstrawberry: [[83, 64], [83, 39], [79, 44]],
  },
  '720x1280': {
    bdouble: [[90, 231], [91, 128], [68, 119]],
    b2toss: [[89, 231], [90, 132], [68, 111]],
    bfreezy: [[89, 231], [89, 131], [69, 121]],
    'electric-apple': [[143, 122], [130, 74], [142, 69]],
    magnetstrawberry: [[125, 95], [125, 58], [117, 54]],
  },
} as const;

const ELECTRIC_FRAME_DIMENSIONS = {
  '480x800': [
    [447, 57],
    [453, 74],
    [441, 52],
    [459, 73],
    [453, 72],
    [447, 65],
    [453, 65],
    [453, 76],
  ],
  '720x1280': [
    [655, 70],
    [660, 92],
    [649, 64],
    [666, 86],
    [661, 89],
    [655, 80],
    [661, 81],
    [660, 94],
  ],
} as const;

export const CRAZY_TIME_MANAGER_FONT_RESOURCE: GameFontResource = Object.freeze({
  canonicalPath: 'Fonts/MotorwerkOblique.ttf',
});

export const CRAZY_SPECIAL_FRUIT_RESOURCES: readonly CrazySpecialFruitResourceDefinition[]
  = Object.freeze(SPECIAL_FRUIT_DEFINITIONS.map(({ fruitId, name }) => Object.freeze({
    fruitId,
    name,
    rasters: Object.freeze({
      '480x800': createSpecialFruitRasterSet(
        '480x800',
        name,
        SPECIAL_FRUIT_DIMENSIONS['480x800'][name],
      ),
      '720x1280': createSpecialFruitRasterSet(
        '720x1280',
        name,
        SPECIAL_FRUIT_DIMENSIONS['720x1280'][name],
      ),
    }),
  })));

export const CRAZY_SUPPLEMENTAL_RASTERS: Readonly<
  Record<GameAssetTree, CrazySupplementalRasterSet>
> = Object.freeze({
  '480x800': createSupplementalRasterSet('480x800'),
  '720x1280': createSupplementalRasterSet('720x1280'),
});

export const CRAZY_SUPPLEMENTAL_RASTER_COUNT = 37 as const;

export function getCrazySpecialFruitResources(
  fruitId: number,
  assetTree: GameAssetTree,
): CrazySpecialFruitRasterSet {
  assertGameAssetTree(assetTree);
  if (!Number.isSafeInteger(fruitId) || fruitId < 10 || fruitId > 14) {
    throw new RangeError('fruitId must identify a Crazy special fruit from 10 through 14');
  }
  const definition = CRAZY_SPECIAL_FRUIT_RESOURCES[fruitId - 10];
  if (definition === undefined || definition.fruitId !== fruitId) {
    throw new Error(`Crazy special-fruit contract is incomplete for ID ${fruitId}`);
  }
  return definition.rasters[assetTree];
}

export function getCrazySupplementalRasterSet(
  assetTree: GameAssetTree,
): CrazySupplementalRasterSet {
  assertGameAssetTree(assetTree);
  return CRAZY_SUPPLEMENTAL_RASTERS[assetTree];
}

export function getCrazySupplementalRasterResources(
  assetTree: GameAssetTree,
): readonly GameRasterResource[] {
  const supplement = getCrazySupplementalRasterSet(assetTree);
  const resources: GameRasterResource[] = [];
  for (const definition of CRAZY_SPECIAL_FRUIT_RESOURCES) {
    const rasters = definition.rasters[assetTree];
    resources.push(rasters.intact, rasters.cutTop, rasters.cutBottom);
  }
  resources.push(
    supplement.dragonFruit,
    supplement.dragonSplash,
    supplement.dragonCutTopLeft,
    supplement.dragonCutTopRight,
    supplement.dragonCutBottomRight,
    supplement.dragonCutBottomLeft,
    supplement.introSixty,
    supplement.introGo,
    supplement.freezeClock,
    supplement.timeUp,
    ...supplement.electricFrames,
    supplement.electricLeftNode,
    supplement.electricRightNode,
    supplement.magnet,
    supplement.magnetLine,
  );
  if (resources.length !== CRAZY_SUPPLEMENTAL_RASTER_COUNT) {
    throw new Error('Crazy supplemental raster contract has an invalid cardinality');
  }
  return Object.freeze(resources);
}

function createSpecialFruitRasterSet(
  tree: GameAssetTree,
  name: CrazySpecialFruitName,
  dimensions: readonly [
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
  ],
): CrazySpecialFruitRasterSet {
  const prefix = `${tree}/Fruits/fruit-${name}`;
  return Object.freeze({
    intact: createGameRaster(`${prefix}.png`, dimensions[0]),
    cutTop: createGameRaster(`${prefix}-cut-top.png`, dimensions[1]),
    cutBottom: createGameRaster(`${prefix}-cut-bottom.png`, dimensions[2]),
  });
}

function createSupplementalRasterSet(tree: GameAssetTree): CrazySupplementalRasterSet {
  const dimensions = ELECTRIC_FRAME_DIMENSIONS[tree];
  const electricFrames = Object.freeze(dimensions.map((size, index) => (
    createGameRaster(`${tree}/Electric/electric${index}.png`, size)
  ))) as CrazyElectricFrameResources;

  return Object.freeze({
    dragonCutBottomLeft: createGameRaster(
      `${tree}/Fruits/dragon-fruit-bottomleft.png`,
      tree === '480x800' ? [60, 45] : [91, 68],
    ),
    dragonCutBottomRight: createGameRaster(
      `${tree}/Fruits/dragon-fruit-bottomright.png`,
      tree === '480x800' ? [59, 55] : [89, 84],
    ),
    dragonCutTopLeft: createGameRaster(
      `${tree}/Fruits/dragon-fruit-topleft.png`,
      tree === '480x800' ? [48, 43] : [73, 66],
    ),
    dragonCutTopRight: createGameRaster(
      `${tree}/Fruits/dragon-fruit-topright.png`,
      tree === '480x800' ? [68, 48] : [103, 73],
    ),
    dragonFruit: createGameRaster(
      `${tree}/Fruits/dragon-fruit.png`,
      tree === '480x800' ? [118, 101] : [177, 153],
    ),
    dragonSplash: createGameRaster(
      `${tree}/Fruits/dragon-splash.png`,
      tree === '480x800' ? [13, 401] : [21, 601],
    ),
    electricFrames,
    electricLeftNode: createGameRaster(
      `${tree}/Electric/left-electric-node.png`,
      tree === '480x800' ? [38, 30] : [57, 45],
    ),
    electricRightNode: createGameRaster(
      `${tree}/Electric/right-electric-node.png`,
      tree === '480x800' ? [39, 31] : [58, 46],
    ),
    freezeClock: createGameRaster(
      `${tree}/Interfaces/object-time-freeze.png`,
      tree === '480x800' ? [148, 85] : [222, 127],
    ),
    introGo: createGameRaster(
      `${tree}/Text/text-go.png`,
      tree === '480x800' ? [70, 31] : [106, 47],
    ),
    introSixty: createGameRaster(
      `${tree}/Text/text-60s.png`,
      tree === '480x800' ? [167, 35] : [249, 51],
    ),
    magnet: createGameRaster(
      `${tree}/Interfaces/magnet.png`,
      tree === '480x800' ? [139, 142] : [170, 175],
    ),
    magnetLine: createGameRaster(
      `${tree}/Interfaces/magnet-line.png`,
      tree === '480x800' ? [105, 34] : [157, 51],
    ),
    timeUp: createGameRaster(
      `${tree}/Text/text-time-up.png`,
      tree === '480x800' ? [345, 135] : [481, 165],
    ),
  });
}
