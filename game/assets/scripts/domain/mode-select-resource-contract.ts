import type {
  ClassicNormalFruitRasterSet,
  ClassicRasterResource,
} from './classic-resource-contract';
import type {
  ModeSelectDestination,
  ModeSelectIndex,
  ModeSelectLockableIndex,
} from './mode-select-state';
import type { ClassicAssetTree } from './resolution-profile-service';

export type ModeSelectCardPurpose =
  | 'classic'
  | 'crazy'
  | 'gn-style'
  | 'classic-bird'
  | 'crazy-bird'
  | 'combo-bird';

export type ModeSelectFruitId = 0 | 1 | 2 | 6 | 7 | 14;

export type ModeSelectFruitName =
  | 'apple'
  | 'banana'
  | 'strawberry'
  | 'orange'
  | 'magnetstrawberry'
  | 'kiwi';

export interface ModeSelectSharedFileResource {
  readonly bytes: number;
  readonly canonicalPath: string;
  readonly kind: 'audio' | 'font';
  readonly sha256: string;
}

export interface ModeSelectTwoFrameRasterSet {
  readonly normal: ClassicRasterResource;
  readonly selected: ClassicRasterResource;
}

export interface ModeSelectCardCircleRasterSet {
  readonly classic: ClassicRasterResource;
  readonly classicBird: ClassicRasterResource;
  readonly comboBird: ClassicRasterResource;
  readonly crazy: ClassicRasterResource;
  readonly crazyBird: ClassicRasterResource;
  readonly gnStyle: ClassicRasterResource;
}

export interface ModeSelectCardDescriptionRasterSet {
  readonly classic: ClassicRasterResource;
  readonly classicBird: ClassicRasterResource;
  readonly combo: ClassicRasterResource;
  readonly comboBird: ClassicRasterResource;
  readonly crazy: ClassicRasterResource;
  readonly crazyBird: ClassicRasterResource;
}

export interface ModeSelectFruitRasterCatalog {
  readonly apple: ClassicNormalFruitRasterSet;
  readonly banana: ClassicNormalFruitRasterSet;
  readonly kiwi: ClassicNormalFruitRasterSet;
  readonly magnetstrawberry: ClassicNormalFruitRasterSet;
  readonly orange: ClassicNormalFruitRasterSet;
  readonly strawberry: ClassicNormalFruitRasterSet;
}

export interface ModeSelectRasterProfile {
  readonly back: ModeSelectTwoFrameRasterSet;
  readonly cardCircles: ModeSelectCardCircleRasterSet;
  readonly cardDescriptions: ModeSelectCardDescriptionRasterSet;
  readonly descriptionShader: ClassicRasterResource;
  readonly fruitButtonBlur: ClassicRasterResource;
  readonly fruits: ModeSelectFruitRasterCatalog;
  readonly longRope: ClassicRasterResource;
  readonly ropeNode: ClassicRasterResource;
  readonly title: ClassicRasterResource;
  readonly unlock: ModeSelectTwoFrameRasterSet;
  readonly unlockParticle: ClassicRasterResource;
  readonly wheel: ClassicRasterResource;
  readonly wheelConnector: ClassicRasterResource;
}

export interface ModeSelectCardRasterSet {
  readonly circle: ClassicRasterResource;
  readonly cutBottom: ClassicRasterResource;
  readonly cutTop: ClassicRasterResource;
  readonly description: ClassicRasterResource;
  readonly intact: ClassicRasterResource;
}

export type ModeSelectCardUnlockDefinition =
  | Readonly<{
      readonly alwaysUnlocked: true;
      readonly defaultValue: null;
      readonly modeIndex: 0 | 3;
      readonly readsSettings: false;
      readonly storageKey: null;
    }>
  | Readonly<{
      readonly alwaysUnlocked: false;
      readonly defaultValue: false;
      readonly modeIndex: ModeSelectLockableIndex;
      readonly readsSettings: true;
      readonly storageKey: `mode_unlock_${ModeSelectLockableIndex}`;
    }>;

export interface ModeSelectCardResourceDefinition {
  readonly cutAudioCanonicalPath:
    | typeof MODE_SELECT_APPLE_AUDIO_CANONICAL_PATH
    | typeof MODE_SELECT_BANANA_AUDIO_CANONICAL_PATH
    | typeof MODE_SELECT_STRAWBERRY_AUDIO_CANONICAL_PATH
    | typeof MODE_SELECT_MANGOSTEEN_AUDIO_CANONICAL_PATH;
  readonly destination: ModeSelectDestination;
  readonly destinationState: ModeSelectIndex;
  readonly fruitId: ModeSelectFruitId;
  readonly fruitName: ModeSelectFruitName;
  readonly purpose: ModeSelectCardPurpose;
  readonly rasters: Readonly<Record<ClassicAssetTree, ModeSelectCardRasterSet>>;
  readonly unlock: ModeSelectCardUnlockDefinition;
}

export const MODE_SELECT_FONT_CANONICAL_PATH = 'Fonts/SlabThing.ttf' as const;
export const MODE_SELECT_APPLE_AUDIO_CANONICAL_PATH = 'Sounds/apple.wav' as const;
export const MODE_SELECT_BANANA_AUDIO_CANONICAL_PATH = 'Sounds/banana.wav' as const;
export const MODE_SELECT_STRAWBERRY_AUDIO_CANONICAL_PATH = 'Sounds/strawberry.wav' as const;
export const MODE_SELECT_MANGOSTEEN_AUDIO_CANONICAL_PATH = 'Sounds/mangosteen.wav' as const;
export const MODE_SELECT_GAMEPLAY_SELECTED_AUDIO_CANONICAL_PATH
  = 'Sounds/gameplayselected.wav' as const;
export const MODE_SELECT_MENU_BUTTON_AUDIO_CANONICAL_PATH
  = 'Sounds/menubuttonclick.wav' as const;

export const MODE_SELECT_SHARED_RESOURCES = deepFreeze({
  appleCut: {
    bytes: 10_364,
    canonicalPath: MODE_SELECT_APPLE_AUDIO_CANONICAL_PATH,
    kind: 'audio' as const,
    sha256: '7565f786f0bd0bbda14d646c2c33993941ee7869c588be836c1eaca96ba5cef8',
  },
  bananaCut: {
    bytes: 9_964,
    canonicalPath: MODE_SELECT_BANANA_AUDIO_CANONICAL_PATH,
    kind: 'audio' as const,
    sha256: 'f3ce9f1f6626b7657a7036fd96d8448ec1211ddc5f0102ddef327b66ef931d99',
  },
  font: {
    bytes: 161_488,
    canonicalPath: MODE_SELECT_FONT_CANONICAL_PATH,
    kind: 'font' as const,
    sha256: '9e07461cbe34a525fe36222710f6067712c6a956f732e2a0d963bdb3d7e151a8',
  },
  gameplaySelected: {
    bytes: 132_344,
    canonicalPath: MODE_SELECT_GAMEPLAY_SELECTED_AUDIO_CANONICAL_PATH,
    kind: 'audio' as const,
    sha256: 'b1826f8db97e2517363ce1f7a385181867be33ff55828fe1baca75d1227f9a84',
  },
  mangosteenCut: {
    bytes: 11_052,
    canonicalPath: MODE_SELECT_MANGOSTEEN_AUDIO_CANONICAL_PATH,
    kind: 'audio' as const,
    sha256: '0e93927c2044446d69c8b591818cd54294dbf260454204bda5c32a7ade5128e6',
  },
  menuButtonClick: {
    bytes: 32_812,
    canonicalPath: MODE_SELECT_MENU_BUTTON_AUDIO_CANONICAL_PATH,
    kind: 'audio' as const,
    sha256: '3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e',
  },
  strawberryCut: {
    bytes: 10_284,
    canonicalPath: MODE_SELECT_STRAWBERRY_AUDIO_CANONICAL_PATH,
    kind: 'audio' as const,
    sha256: 'b612419c6046ebe49666788fbc84787494667bbfcc121f21a242d9e13bc69a59',
  },
}) satisfies Readonly<Record<string, ModeSelectSharedFileResource>>;

/** The tempting semantic normalization is not a recovered Mode Select consumer. */
export const MODE_SELECT_PROHIBITED_DESCRIPTION_LOGICAL_PATHS = Object.freeze([
  'Interfaces/object-gnstyle-des.png',
] as const);

type RasterSize = readonly [number, number];
type TwoRasterSizes = readonly [RasterSize, RasterSize];
type ThreeRasterSizes = readonly [RasterSize, RasterSize, RasterSize];
type SixRasterSizes = readonly [
  RasterSize,
  RasterSize,
  RasterSize,
  RasterSize,
  RasterSize,
  RasterSize,
];

interface ModeSelectRasterProfileDimensions {
  readonly back: TwoRasterSizes;
  readonly cardCircles: SixRasterSizes;
  readonly cardDescriptions: SixRasterSizes;
  readonly descriptionShader: RasterSize;
  readonly fruitButtonBlur: RasterSize;
  /** Each entry is intact, cut-bottom, cut-top. */
  readonly fruits: readonly [
    ThreeRasterSizes,
    ThreeRasterSizes,
    ThreeRasterSizes,
    ThreeRasterSizes,
    ThreeRasterSizes,
    ThreeRasterSizes,
  ];
  readonly longRope: RasterSize;
  readonly ropeNode: RasterSize;
  readonly title: RasterSize;
  readonly unlock: TwoRasterSizes;
  readonly unlockParticle: RasterSize;
  readonly wheel: RasterSize;
  readonly wheelConnector: RasterSize;
}

export const MODE_SELECT_RASTER_RESOURCES: Readonly<
  Record<ClassicAssetTree, ModeSelectRasterProfile>
> = deepFreeze({
  '480x800': createRasterProfile('480x800', {
    back: [[144, 124], [144, 124]],
    cardCircles: [
      [204, 212],
      [205, 206],
      [216, 225],
      [254, 263],
      [254, 263],
      [254, 263],
    ],
    cardDescriptions: [
      [149, 202],
      [149, 202],
      [149, 202],
      [149, 202],
      [149, 202],
      [149, 202],
    ],
    descriptionShader: [217, 267],
    fruitButtonBlur: [235, 250],
    fruits: [
      [[96, 82], [95, 47], [87, 50]],
      [[60, 154], [46, 78], [60, 89]],
      [[83, 64], [79, 36], [84, 39]],
      [[75, 101], [73, 53], [74, 80]],
      [[83, 64], [79, 44], [83, 39]],
      [[63, 81], [63, 54], [63, 58]],
    ],
    longRope: [1515, 77],
    ropeNode: [7, 14],
    title: [552, 118],
    unlock: [[159, 43], [159, 43]],
    unlockParticle: [46, 44],
    wheel: [30, 30],
    wheelConnector: [8, 49],
  }),
  '720x1280': createRasterProfile('720x1280', {
    back: [[180, 150], [181, 150]],
    cardCircles: [
      [344, 358],
      [344, 351],
      [325, 338],
      [345, 358],
      [345, 358],
      [344, 358],
    ],
    cardDescriptions: [
      [223, 301],
      [223, 301],
      [223, 301],
      [223, 301],
      [223, 301],
      [223, 301],
    ],
    descriptionShader: [290, 363],
    fruitButtonBlur: [316, 339],
    fruits: [
      [[143, 122], [131, 74], [143, 69]],
      [[89, 231], [68, 117], [90, 134]],
      [[125, 96], [118, 54], [125, 58]],
      [[112, 152], [110, 79], [110, 119]],
      [[125, 95], [117, 54], [125, 58]],
      [[94, 121], [93, 79], [93, 87]],
    ],
    longRope: [868, 77],
    ropeNode: [11, 21],
    title: [792, 159],
    unlock: [[238, 64], [239, 65]],
    unlockParticle: [66, 64],
    wheel: [45, 44],
    wheelConnector: [12, 73],
  }),
});

export const MODE_SELECT_CARD_PURPOSE_ORDER: readonly ModeSelectCardPurpose[] = Object.freeze([
  'classic',
  'crazy',
  'gn-style',
  'classic-bird',
  'crazy-bird',
  'combo-bird',
]);

export const MODE_SELECT_CARD_DEFINITIONS: readonly ModeSelectCardResourceDefinition[]
  = deepFreeze([
    createCardDefinition(
      0,
      'classic',
      0,
      'apple',
      'ClassicModeLayer',
      MODE_SELECT_APPLE_AUDIO_CANONICAL_PATH,
      'classic',
      'classic',
      alwaysUnlocked(0),
    ),
    createCardDefinition(
      1,
      'crazy',
      1,
      'banana',
      'CrazyModeLayer',
      MODE_SELECT_BANANA_AUDIO_CANONICAL_PATH,
      'crazy',
      'crazy',
      persistedUnlock(1),
    ),
    createCardDefinition(
      2,
      'gn-style',
      2,
      'strawberry',
      'GNStyleLayer',
      MODE_SELECT_STRAWBERRY_AUDIO_CANONICAL_PATH,
      'gnStyle',
      'combo',
      persistedUnlock(2),
    ),
    createCardDefinition(
      3,
      'classic-bird',
      7,
      'orange',
      'ClassicBirdLayer',
      MODE_SELECT_STRAWBERRY_AUDIO_CANONICAL_PATH,
      'classicBird',
      'classicBird',
      alwaysUnlocked(3),
    ),
    createCardDefinition(
      4,
      'crazy-bird',
      14,
      'magnetstrawberry',
      'CrazyBirdLayer',
      MODE_SELECT_MANGOSTEEN_AUDIO_CANONICAL_PATH,
      'crazyBird',
      'crazyBird',
      persistedUnlock(4),
    ),
    createCardDefinition(
      5,
      'combo-bird',
      6,
      'kiwi',
      'ComboBirdLayer',
      MODE_SELECT_APPLE_AUDIO_CANONICAL_PATH,
      'comboBird',
      'comboBird',
      persistedUnlock(5),
    ),
  ]);

export const MODE_SELECT_FRUIT_CUT_AUDIO_BY_ID: Readonly<Record<ModeSelectFruitId, string>>
  = deepFreeze({
    0: MODE_SELECT_APPLE_AUDIO_CANONICAL_PATH,
    1: MODE_SELECT_BANANA_AUDIO_CANONICAL_PATH,
    2: MODE_SELECT_STRAWBERRY_AUDIO_CANONICAL_PATH,
    6: MODE_SELECT_APPLE_AUDIO_CANONICAL_PATH,
    7: MODE_SELECT_STRAWBERRY_AUDIO_CANONICAL_PATH,
    14: MODE_SELECT_MANGOSTEEN_AUDIO_CANONICAL_PATH,
  });

export function getModeSelectRasterResources(
  assetTree: ClassicAssetTree,
): ModeSelectRasterProfile {
  assertAssetTree(assetTree);
  return MODE_SELECT_RASTER_RESOURCES[assetTree];
}

export function getModeSelectCardDefinition(
  modeIndex: number,
): ModeSelectCardResourceDefinition {
  const validatedIndex = requireModeIndex(modeIndex);
  const definition = MODE_SELECT_CARD_DEFINITIONS[validatedIndex];
  if (definition === undefined) {
    throw new Error(`Mode Select card definition ${validatedIndex} is unavailable`);
  }
  return definition;
}

export function getModeSelectCardDefinitionByFruitId(
  fruitId: number,
): ModeSelectCardResourceDefinition {
  if (!Number.isSafeInteger(fruitId)) {
    throw new TypeError('fruitId must be a safe integer');
  }
  const definition = MODE_SELECT_CARD_DEFINITIONS.find((entry) => entry.fruitId === fruitId);
  if (definition === undefined) {
    throw new RangeError('fruitId must identify one of the six Mode Select fruits');
  }
  return definition;
}

export function getModeSelectCardResources(
  modeIndex: number,
  assetTree: ClassicAssetTree,
): ModeSelectCardRasterSet {
  assertAssetTree(assetTree);
  return getModeSelectCardDefinition(modeIndex).rasters[assetTree];
}

export function isModeSelectProhibitedDescriptionPath(canonicalPath: string): boolean {
  if (typeof canonicalPath !== 'string' || canonicalPath.length === 0) {
    throw new TypeError('canonicalPath must be a non-empty string');
  }
  return MODE_SELECT_PROHIBITED_DESCRIPTION_LOGICAL_PATHS.some((logicalPath) => (
    canonicalPath === logicalPath || canonicalPath.endsWith(`/${logicalPath}`)
  ));
}

export function assertModeSelectResourcePathAllowed(canonicalPath: string): void {
  if (isModeSelectProhibitedDescriptionPath(canonicalPath)) {
    throw new RangeError(
      'GN Style must preserve the recovered Interfaces/object-combo-des.png mapping',
    );
  }
}

function createRasterProfile(
  tree: ClassicAssetTree,
  dimensions: ModeSelectRasterProfileDimensions,
): ModeSelectRasterProfile {
  const descriptionPaths = [
    'Interfaces/object-classic-des.png',
    'Interfaces/object-crazy-des.png',
    'Interfaces/object-combo-des.png',
    'Interfaces/object-classic-bird-des.png',
    'Interfaces/object-crazy-bird-des.png',
    'Interfaces/object-combo-bird-des.png',
  ] as const;
  const circlePaths = [
    'Interfaces/mode-classic.png',
    'Interfaces/mode-crazy.png',
    'Interfaces/mode-gnstyle.png',
    'Interfaces/mode-classic-bird.png',
    'Interfaces/mode-crazy-bird.png',
    'Interfaces/mode-combo-bird.png',
  ] as const;
  const fruitNames = [
    'apple',
    'banana',
    'strawberry',
    'orange',
    'magnetstrawberry',
    'kiwi',
  ] as const;

  return {
    back: twoFrame(
      raster(tree, 'Buttons/button-blue-back-normal.png', dimensions.back[0]),
      raster(tree, 'Buttons/button-back-selected.png', dimensions.back[1]),
    ),
    cardCircles: {
      classic: raster(tree, circlePaths[0], dimensions.cardCircles[0]),
      crazy: raster(tree, circlePaths[1], dimensions.cardCircles[1]),
      gnStyle: raster(tree, circlePaths[2], dimensions.cardCircles[2]),
      classicBird: raster(tree, circlePaths[3], dimensions.cardCircles[3]),
      crazyBird: raster(tree, circlePaths[4], dimensions.cardCircles[4]),
      comboBird: raster(tree, circlePaths[5], dimensions.cardCircles[5]),
    },
    cardDescriptions: {
      classic: raster(tree, descriptionPaths[0], dimensions.cardDescriptions[0]),
      crazy: raster(tree, descriptionPaths[1], dimensions.cardDescriptions[1]),
      combo: raster(tree, descriptionPaths[2], dimensions.cardDescriptions[2]),
      classicBird: raster(tree, descriptionPaths[3], dimensions.cardDescriptions[3]),
      crazyBird: raster(tree, descriptionPaths[4], dimensions.cardDescriptions[4]),
      comboBird: raster(tree, descriptionPaths[5], dimensions.cardDescriptions[5]),
    },
    descriptionShader: raster(
      tree,
      'Interfaces/object-des-shader.png',
      dimensions.descriptionShader,
    ),
    fruitButtonBlur: raster(
      tree,
      'Buttons/button-circle-blur.png',
      dimensions.fruitButtonBlur,
    ),
    fruits: {
      apple: fruitRasterSet(tree, fruitNames[0], dimensions.fruits[0]),
      banana: fruitRasterSet(tree, fruitNames[1], dimensions.fruits[1]),
      strawberry: fruitRasterSet(tree, fruitNames[2], dimensions.fruits[2]),
      orange: fruitRasterSet(tree, fruitNames[3], dimensions.fruits[3]),
      magnetstrawberry: fruitRasterSet(tree, fruitNames[4], dimensions.fruits[4]),
      kiwi: fruitRasterSet(tree, fruitNames[5], dimensions.fruits[5]),
    },
    longRope: raster(tree, 'Interfaces/object-long-rope.png', dimensions.longRope),
    ropeNode: raster(tree, 'Interfaces/object-rope-node.png', dimensions.ropeNode),
    title: raster(tree, 'Interfaces/modeselect.png', dimensions.title),
    unlock: twoFrame(
      raster(tree, 'Buttons/button-unlock.png', dimensions.unlock[0]),
      raster(tree, 'Buttons/button-unlock-selected.png', dimensions.unlock[1]),
    ),
    unlockParticle: raster(
      tree,
      'Blades/Particles/X-Mas/xmasfive.png',
      dimensions.unlockParticle,
    ),
    wheel: raster(tree, 'Interfaces/object-wheel.png', dimensions.wheel),
    wheelConnector: raster(
      tree,
      'Interfaces/object-wheel-connect.png',
      dimensions.wheelConnector,
    ),
  };
}

function createCardDefinition(
  destinationState: ModeSelectIndex,
  purpose: ModeSelectCardPurpose,
  fruitId: ModeSelectFruitId,
  fruitName: ModeSelectFruitName,
  destination: ModeSelectDestination,
  cutAudioCanonicalPath: ModeSelectCardResourceDefinition['cutAudioCanonicalPath'],
  circleKey: keyof ModeSelectCardCircleRasterSet,
  descriptionKey: keyof ModeSelectCardDescriptionRasterSet,
  unlock: ModeSelectCardUnlockDefinition,
): ModeSelectCardResourceDefinition {
  const rasters = {} as Record<ClassicAssetTree, ModeSelectCardRasterSet>;
  for (const tree of ['480x800', '720x1280'] as const) {
    const profile = MODE_SELECT_RASTER_RESOURCES[tree];
    const fruit = profile.fruits[fruitName];
    rasters[tree] = {
      circle: profile.cardCircles[circleKey],
      cutBottom: fruit.cutBottom,
      cutTop: fruit.cutTop,
      description: profile.cardDescriptions[descriptionKey],
      intact: fruit.intact,
    };
  }
  return {
    cutAudioCanonicalPath,
    destination,
    destinationState,
    fruitId,
    fruitName,
    purpose,
    rasters,
    unlock,
  };
}

function alwaysUnlocked(modeIndex: 0 | 3): ModeSelectCardUnlockDefinition {
  return {
    alwaysUnlocked: true,
    defaultValue: null,
    modeIndex,
    readsSettings: false,
    storageKey: null,
  };
}

function persistedUnlock(
  modeIndex: ModeSelectLockableIndex,
): ModeSelectCardUnlockDefinition {
  return {
    alwaysUnlocked: false,
    defaultValue: false,
    modeIndex,
    readsSettings: true,
    storageKey: `mode_unlock_${modeIndex}`,
  };
}

function fruitRasterSet(
  tree: ClassicAssetTree,
  fruitName: ModeSelectFruitName,
  dimensions: ThreeRasterSizes,
): ClassicNormalFruitRasterSet {
  const prefix = `Fruits/fruit-${fruitName}`;
  return {
    cutBottom: raster(tree, `${prefix}-cut-bottom.png`, dimensions[1]),
    cutTop: raster(tree, `${prefix}-cut-top.png`, dimensions[2]),
    intact: raster(tree, `${prefix}.png`, dimensions[0]),
  };
}

function twoFrame(
  normal: ClassicRasterResource,
  selected: ClassicRasterResource,
): ModeSelectTwoFrameRasterSet {
  return { normal, selected };
}

function raster(
  tree: ClassicAssetTree,
  logicalPath: string,
  dimensions: RasterSize,
): ClassicRasterResource {
  const canonicalPath = `${tree}/${logicalPath}`;
  assertModeSelectResourcePathAllowed(canonicalPath);
  return {
    canonicalPath,
    dimensions: { height: dimensions[1], width: dimensions[0] },
  };
}

function requireModeIndex(value: number): ModeSelectIndex {
  if (!Number.isSafeInteger(value) || value < 0 || value > 5) {
    throw new RangeError('modeIndex must identify one of the six Mode Select cards');
  }
  return value as ModeSelectIndex;
}

function assertAssetTree(assetTree: string): asserts assetTree is ClassicAssetTree {
  if (assetTree !== '480x800' && assetTree !== '720x1280') {
    throw new RangeError('assetTree must be 480x800 or 720x1280');
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      deepFreeze(record[key]);
    }
    Object.freeze(value);
  }
  return value;
}
