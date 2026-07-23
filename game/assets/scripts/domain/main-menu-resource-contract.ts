import type {
  ClassicNormalFruitRasterSet,
  ClassicRasterResource,
} from './classic-resource-contract';
import {
  getClassicNormalFruitResources,
} from './classic-resource-contract';
import type { ClassicAssetTree } from './resolution-profile-service';

export type MainMenuFruitButtonPurpose = 'leaderboard' | 'objectives' | 'new-game';
export type MainMenuFruitId = 2 | 7 | 13;
export type MainMenuFruitName = 'strawberry' | 'orange' | 'electric-apple';

export interface MainMenuSharedFileResource {
  readonly bytes: number;
  readonly canonicalPath: string;
  readonly kind: 'audio' | 'font';
  readonly sha256: string;
}

export interface MainMenuThreeFrameToggleRasterSet {
  readonly disabled: ClassicRasterResource;
  readonly normal: ClassicRasterResource;
  readonly selected: ClassicRasterResource;
}

export interface MainMenuTwoFrameRasterSet {
  readonly normal: ClassicRasterResource;
  readonly selected: ClassicRasterResource;
}

export interface MainMenuCircleRasterSet {
  readonly blur: ClassicRasterResource;
  readonly leaderboard: ClassicRasterResource;
  readonly newGame: ClassicRasterResource;
  readonly objectives: ClassicRasterResource;
}

export interface MainMenuFruitRasterCatalog {
  readonly electricApple: ClassicNormalFruitRasterSet;
  readonly orange: ClassicNormalFruitRasterSet;
  readonly strawberry: ClassicNormalFruitRasterSet;
}

export interface MainMenuRasterProfile {
  readonly about: MainMenuTwoFrameRasterSet;
  readonly blackWheel: ClassicRasterResource;
  readonly blueWheelOptions: MainMenuTwoFrameRasterSet;
  readonly circles: MainMenuCircleRasterSet;
  readonly effectsToggle: MainMenuThreeFrameToggleRasterSet;
  readonly exit: MainMenuTwoFrameRasterSet;
  readonly fruits: MainMenuFruitRasterCatalog;
  readonly heart: ClassicRasterResource;
  readonly musicToggle: MainMenuThreeFrameToggleRasterSet;
  readonly orangeWheel: ClassicRasterResource;
  readonly pencilBlade: ClassicRasterResource;
  readonly pencilBladeBackground: ClassicRasterResource;
  readonly review: MainMenuTwoFrameRasterSet;
  readonly totalCoinsPanel: ClassicRasterResource;
}

export interface MainMenuFruitButtonRasterSet {
  readonly blur: ClassicRasterResource;
  readonly circle: ClassicRasterResource;
  readonly cutBottom: ClassicRasterResource;
  readonly cutTop: ClassicRasterResource;
  readonly intact: ClassicRasterResource;
}

export interface MainMenuFruitButtonResourceDefinition {
  readonly cutAudioCanonicalPath:
    | typeof MAIN_MENU_STRAWBERRY_AUDIO_CANONICAL_PATH
    | typeof MAIN_MENU_MANGOSTEEN_AUDIO_CANONICAL_PATH;
  readonly fruitId: MainMenuFruitId;
  readonly fruitName: MainMenuFruitName;
  readonly purpose: MainMenuFruitButtonPurpose;
  readonly rasters: Readonly<Record<ClassicAssetTree, MainMenuFruitButtonRasterSet>>;
}

export const MAIN_MENU_FONT_CANONICAL_PATH = 'Fonts/SlabThing.ttf' as const;
export const MAIN_MENU_MUSIC_AUDIO_CANONICAL_PATH = 'Sounds/mainmenumusic.mp3' as const;
export const MAIN_MENU_BUTTON_AUDIO_CANONICAL_PATH = 'Sounds/menubuttonclick.wav' as const;
export const MAIN_MENU_STRAWBERRY_AUDIO_CANONICAL_PATH = 'Sounds/strawberry.wav' as const;
export const MAIN_MENU_MANGOSTEEN_AUDIO_CANONICAL_PATH = 'Sounds/mangosteen.wav' as const;

export const MAIN_MENU_SHARED_RESOURCES = deepFreeze({
  font: {
    bytes: 161_488,
    canonicalPath: MAIN_MENU_FONT_CANONICAL_PATH,
    kind: 'font' as const,
    sha256: '9e07461cbe34a525fe36222710f6067712c6a956f732e2a0d963bdb3d7e151a8',
  },
  mainMenuMusic: {
    bytes: 718_785,
    canonicalPath: MAIN_MENU_MUSIC_AUDIO_CANONICAL_PATH,
    kind: 'audio' as const,
    sha256: '53378d6d153e22fa9b0b5a64c8c130e58f0c3ae649ad3750e921d839c45151a1',
  },
  mangosteenCut: {
    bytes: 11_052,
    canonicalPath: MAIN_MENU_MANGOSTEEN_AUDIO_CANONICAL_PATH,
    kind: 'audio' as const,
    sha256: '0e93927c2044446d69c8b591818cd54294dbf260454204bda5c32a7ade5128e6',
  },
  menuButtonClick: {
    bytes: 32_812,
    canonicalPath: MAIN_MENU_BUTTON_AUDIO_CANONICAL_PATH,
    kind: 'audio' as const,
    sha256: '3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e',
  },
  strawberryCut: {
    bytes: 10_284,
    canonicalPath: MAIN_MENU_STRAWBERRY_AUDIO_CANONICAL_PATH,
    kind: 'audio' as const,
    sha256: 'b612419c6046ebe49666788fbc84787494667bbfcc121f21a242d9e13bc69a59',
  },
}) satisfies Readonly<Record<string, MainMenuSharedFileResource>>;

/** Existing files that are explicitly not consumed by Main Menu. */
export const MAIN_MENU_PROHIBITED_REVIEW_LOGICAL_PATHS = Object.freeze([
  'Buttons/button-review-normal.png',
  'Buttons/button-review-selected.png',
] as const);

export const MAIN_MENU_RASTER_RESOURCES: Readonly<Record<ClassicAssetTree, MainMenuRasterProfile>>
  = deepFreeze({
    '480x800': createRasterProfile('480x800', {
      about: [[87, 116], [87, 116]],
      blackWheel: [49, 48],
      blueWheel: [[109, 107], [109, 107]],
      circles: [[235, 250], [237, 256], [254, 263], [254, 263]],
      effects: [[80, 100], [80, 99], [80, 99]],
      electricApple: [[96, 82], [95, 47], [88, 50]],
      exit: [[141, 184], [141, 184]],
      heart: [30, 33],
      music: [[91, 94], [91, 95], [91, 95]],
      orangeWheel: [71, 70],
      pencilBlade: [454, 233],
      pencilBladeBackground: [480, 292],
      review: [[70, 66], [70, 66]],
      totalCoinsPanel: [334, 131],
    }),
    '720x1280': createRasterProfile('720x1280', {
      about: [[125, 139], [124, 139]],
      blackWheel: [72, 72],
      blueWheel: [[161, 160], [161, 160]],
      circles: [[316, 339], [319, 347], [344, 358], [344, 358]],
      effects: [[119, 149], [119, 149], [119, 148]],
      electricApple: [[143, 122], [142, 69], [130, 74]],
      exit: [[182, 249], [182, 249]],
      heart: [44, 50],
      music: [[136, 141], [136, 141], [136, 142]],
      orangeWheel: [105, 104],
      pencilBlade: [667, 342],
      pencilBladeBackground: [720, 438],
      review: [[87, 82], [87, 82]],
      totalCoinsPanel: [464, 160],
    }),
  });

export const MAIN_MENU_FRUIT_BUTTON_PURPOSE_ORDER: readonly MainMenuFruitButtonPurpose[]
  = Object.freeze(['leaderboard', 'objectives', 'new-game']);

export const MAIN_MENU_FRUIT_BUTTON_DEFINITIONS:
readonly MainMenuFruitButtonResourceDefinition[] = deepFreeze([
  createFruitButtonDefinition(
    'leaderboard',
    13,
    'electric-apple',
    MAIN_MENU_MANGOSTEEN_AUDIO_CANONICAL_PATH,
    'leaderboard',
    'electricApple',
  ),
  createFruitButtonDefinition(
    'objectives',
    7,
    'orange',
    MAIN_MENU_STRAWBERRY_AUDIO_CANONICAL_PATH,
    'objectives',
    'orange',
  ),
  createFruitButtonDefinition(
    'new-game',
    2,
    'strawberry',
    MAIN_MENU_STRAWBERRY_AUDIO_CANONICAL_PATH,
    'newGame',
    'strawberry',
  ),
]);

export const MAIN_MENU_FRUIT_CUT_AUDIO_BY_ID: Readonly<Record<MainMenuFruitId, string>>
  = deepFreeze({
    2: MAIN_MENU_STRAWBERRY_AUDIO_CANONICAL_PATH,
    7: MAIN_MENU_STRAWBERRY_AUDIO_CANONICAL_PATH,
    13: MAIN_MENU_MANGOSTEEN_AUDIO_CANONICAL_PATH,
  });

export function getMainMenuRasterResources(assetTree: ClassicAssetTree): MainMenuRasterProfile {
  assertAssetTree(assetTree);
  return MAIN_MENU_RASTER_RESOURCES[assetTree];
}

export function getMainMenuFruitButtonDefinition(
  purpose: MainMenuFruitButtonPurpose,
): MainMenuFruitButtonResourceDefinition {
  const definition = MAIN_MENU_FRUIT_BUTTON_DEFINITIONS.find((entry) => entry.purpose === purpose);
  if (definition === undefined) {
    throw new RangeError('purpose must be leaderboard, objectives, or new-game');
  }
  return definition;
}

export function getMainMenuFruitButtonDefinitionById(
  fruitId: number,
): MainMenuFruitButtonResourceDefinition {
  if (!Number.isSafeInteger(fruitId)) {
    throw new TypeError('fruitId must be a safe integer');
  }
  const definition = MAIN_MENU_FRUIT_BUTTON_DEFINITIONS.find((entry) => (
    entry.fruitId === fruitId
  ));
  if (definition === undefined) {
    throw new RangeError('fruitId must identify Main Menu fruit 2, 7, or 13');
  }
  return definition;
}

export function getMainMenuFruitButtonResources(
  purpose: MainMenuFruitButtonPurpose,
  assetTree: ClassicAssetTree,
): MainMenuFruitButtonRasterSet {
  assertAssetTree(assetTree);
  return getMainMenuFruitButtonDefinition(purpose).rasters[assetTree];
}

export function isMainMenuProhibitedReviewPath(canonicalPath: string): boolean {
  if (typeof canonicalPath !== 'string' || canonicalPath.length === 0) {
    throw new TypeError('canonicalPath must be a non-empty string');
  }
  return MAIN_MENU_PROHIBITED_REVIEW_LOGICAL_PATHS.some((logicalPath) => (
    canonicalPath === logicalPath || canonicalPath.endsWith(`/${logicalPath}`)
  ));
}

export function assertMainMenuResourcePathAllowed(canonicalPath: string): void {
  if (isMainMenuProhibitedReviewPath(canonicalPath)) {
    throw new RangeError('Main Menu must use Interfaces/reviewbutton*.png, not button-review art');
  }
}

type RasterSize = readonly [number, number];
type TwoRasterSizes = readonly [RasterSize, RasterSize];
type ThreeRasterSizes = readonly [RasterSize, RasterSize, RasterSize];
type FourRasterSizes = readonly [RasterSize, RasterSize, RasterSize, RasterSize];

interface MainMenuRasterProfileDimensions {
  readonly about: TwoRasterSizes;
  readonly blackWheel: RasterSize;
  readonly blueWheel: TwoRasterSizes;
  readonly circles: FourRasterSizes;
  readonly effects: ThreeRasterSizes;
  /** Intact, cut-bottom, cut-top. */
  readonly electricApple: ThreeRasterSizes;
  readonly exit: TwoRasterSizes;
  readonly heart: RasterSize;
  readonly music: ThreeRasterSizes;
  readonly orangeWheel: RasterSize;
  readonly pencilBlade: RasterSize;
  readonly pencilBladeBackground: RasterSize;
  readonly review: TwoRasterSizes;
  readonly totalCoinsPanel: RasterSize;
}

function createRasterProfile(
  tree: ClassicAssetTree,
  dimensions: MainMenuRasterProfileDimensions,
): MainMenuRasterProfile {
  const normalFruits = {
    orange: getClassicNormalFruitResources(7, tree),
    strawberry: getClassicNormalFruitResources(2, tree),
  };
  return {
    about: twoFrame(
      raster(tree, 'Buttons/button-about-normal.png', dimensions.about[0]),
      raster(tree, 'Buttons/button-about-selected.png', dimensions.about[1]),
    ),
    blackWheel: raster(tree, 'Buttons/button-black-wheel-normal.png', dimensions.blackWheel),
    blueWheelOptions: twoFrame(
      raster(tree, 'Buttons/button-blue-wheel-normal.png', dimensions.blueWheel[0]),
      raster(tree, 'Buttons/button-blue-wheel-selected.png', dimensions.blueWheel[1]),
    ),
    circles: {
      blur: raster(tree, 'Buttons/button-circle-blur.png', dimensions.circles[0]),
      leaderboard: raster(
        tree,
        'Buttons/button-circle-leaderboard.png',
        dimensions.circles[1],
      ),
      objectives: raster(
        tree,
        'Buttons/button-circle-objectives.png',
        dimensions.circles[2],
      ),
      newGame: raster(tree, 'Buttons/button-circle-newgame.png', dimensions.circles[3]),
    },
    effectsToggle: threeFrame(
      raster(tree, 'Buttons/button-effects-normal.png', dimensions.effects[0]),
      raster(tree, 'Buttons/button-effects-selected.png', dimensions.effects[1]),
      raster(tree, 'Buttons/button-effects-disable.png', dimensions.effects[2]),
    ),
    exit: twoFrame(
      raster(tree, 'Buttons/button-exit-normal.png', dimensions.exit[0]),
      raster(tree, 'Buttons/button-exit-selected.png', dimensions.exit[1]),
    ),
    fruits: {
      electricApple: fruitRasterSet(tree, 'electric-apple', dimensions.electricApple),
      orange: normalFruits.orange,
      strawberry: normalFruits.strawberry,
    },
    heart: raster(tree, 'Interfaces/heart.png', dimensions.heart),
    musicToggle: threeFrame(
      raster(tree, 'Buttons/button-music-normal.png', dimensions.music[0]),
      raster(tree, 'Buttons/button-music-selected.png', dimensions.music[1]),
      raster(tree, 'Buttons/button-music-disable.png', dimensions.music[2]),
    ),
    orangeWheel: raster(
      tree,
      'Buttons/button-orange-wheel-normal.png',
      dimensions.orangeWheel,
    ),
    pencilBlade: raster(tree, 'Interfaces/pencilblade.png', dimensions.pencilBlade),
    pencilBladeBackground: raster(
      tree,
      'Interfaces/pencilbladebk.png',
      dimensions.pencilBladeBackground,
    ),
    review: twoFrame(
      raster(tree, 'Interfaces/reviewbutton.png', dimensions.review[0]),
      raster(tree, 'Interfaces/reviewbuttonselected.png', dimensions.review[1]),
    ),
    totalCoinsPanel: raster(
      tree,
      'Interfaces/total-coins.png',
      dimensions.totalCoinsPanel,
    ),
  };
}

function createFruitButtonDefinition(
  purpose: MainMenuFruitButtonPurpose,
  fruitId: MainMenuFruitId,
  fruitName: MainMenuFruitName,
  cutAudioCanonicalPath: MainMenuFruitButtonResourceDefinition['cutAudioCanonicalPath'],
  circleKey: Exclude<keyof MainMenuCircleRasterSet, 'blur'>,
  fruitKey: keyof MainMenuFruitRasterCatalog,
): MainMenuFruitButtonResourceDefinition {
  const rasters = {} as Record<ClassicAssetTree, MainMenuFruitButtonRasterSet>;
  for (const tree of ['480x800', '720x1280'] as const) {
    const profile = MAIN_MENU_RASTER_RESOURCES[tree];
    const fruit = profile.fruits[fruitKey];
    rasters[tree] = {
      blur: profile.circles.blur,
      circle: profile.circles[circleKey],
      cutBottom: fruit.cutBottom,
      cutTop: fruit.cutTop,
      intact: fruit.intact,
    };
  }
  return {
    cutAudioCanonicalPath,
    fruitId,
    fruitName,
    purpose,
    rasters,
  };
}

function fruitRasterSet(
  tree: ClassicAssetTree,
  fruitName: 'electric-apple',
  dimensions: ThreeRasterSizes,
): ClassicNormalFruitRasterSet {
  const prefix = `Fruits/fruit-${fruitName}`;
  return {
    intact: raster(tree, `${prefix}.png`, dimensions[0]),
    cutBottom: raster(tree, `${prefix}-cut-bottom.png`, dimensions[1]),
    cutTop: raster(tree, `${prefix}-cut-top.png`, dimensions[2]),
  };
}

function twoFrame(
  normal: ClassicRasterResource,
  selected: ClassicRasterResource,
): MainMenuTwoFrameRasterSet {
  return { normal, selected };
}

function threeFrame(
  normal: ClassicRasterResource,
  selected: ClassicRasterResource,
  disabled: ClassicRasterResource,
): MainMenuThreeFrameToggleRasterSet {
  return { disabled, normal, selected };
}

function raster(
  tree: ClassicAssetTree,
  logicalPath: string,
  dimensions: RasterSize,
): ClassicRasterResource {
  const canonicalPath = `${tree}/${logicalPath}`;
  assertMainMenuResourcePathAllowed(canonicalPath);
  return {
    canonicalPath,
    dimensions: { height: dimensions[1], width: dimensions[0] },
  };
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
