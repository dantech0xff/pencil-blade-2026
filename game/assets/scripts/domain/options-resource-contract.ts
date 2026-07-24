import type {
  ClassicRasterResource,
} from './classic-resource-contract';
import {
  OPTIONS_BLADE_ROW_AUDIO_PATH,
  OPTIONS_THEME_ROW_AUDIO_PATH,
} from './classic-audio-contract';
import type { ClassicAssetTree } from './resolution-profile-service';

export const OPTIONS_RASTER_RESOURCE_COUNT = 51 as const;

export const OPTIONS_FONT_CANONICAL_PATH = 'Fonts/SlabThing.ttf' as const;
export const OPTIONS_MENU_BUTTON_AUDIO_CANONICAL_PATH
  = 'Sounds/menubuttonclick.wav' as const;
export const OPTIONS_BLADE_ROW_AUDIO_CANONICAL_PATH = OPTIONS_BLADE_ROW_AUDIO_PATH;
export const OPTIONS_THEME_ROW_AUDIO_CANONICAL_PATH = OPTIONS_THEME_ROW_AUDIO_PATH;

/** Semantic aliases used by the Creator callback boundary. */
export const OPTIONS_SELECTION_AUDIO_CANONICAL_PATH
  = OPTIONS_MENU_BUTTON_AUDIO_CANONICAL_PATH;
export const OPTIONS_BACK_AUDIO_CANONICAL_PATH
  = OPTIONS_MENU_BUTTON_AUDIO_CANONICAL_PATH;

export interface OptionsSharedFileResource {
  readonly bytes: number;
  readonly canonicalPath: string;
  readonly kind: 'audio' | 'font';
  readonly sha256: string;
}

export interface OptionsTwoFrameRasterSet {
  readonly normal: ClassicRasterResource;
  readonly selected: ClassicRasterResource;
}

export interface OptionsSectionHeaderRasterSet {
  readonly background: ClassicRasterResource;
  readonly blade: ClassicRasterResource;
  readonly theme: ClassicRasterResource;
}

export interface OptionsRasterProfile {
  readonly back: OptionsTwoFrameRasterSet;
  readonly backgroundIcons: readonly ClassicRasterResource[];
  readonly bladeIcons: readonly ClassicRasterResource[];
  readonly buy: OptionsTwoFrameRasterSet;
  readonly next: OptionsTwoFrameRasterSet;
  readonly previous: OptionsTwoFrameRasterSet;
  readonly purchaseParticle: ClassicRasterResource;
  readonly sectionHeaders: OptionsSectionHeaderRasterSet;
  readonly selectorBackground: ClassicRasterResource;
  readonly themeIcons: readonly ClassicRasterResource[];
  readonly title: ClassicRasterResource;
  readonly totalCoinsPanel: ClassicRasterResource;
}

export const OPTIONS_SHARED_RESOURCES = deepFreeze({
  font: {
    bytes: 161_488,
    canonicalPath: OPTIONS_FONT_CANONICAL_PATH,
    kind: 'font' as const,
    sha256: '9e07461cbe34a525fe36222710f6067712c6a956f732e2a0d963bdb3d7e151a8',
  },
  bladeRow: {
    bytes: 33_162,
    canonicalPath: OPTIONS_BLADE_ROW_AUDIO_CANONICAL_PATH,
    kind: 'audio' as const,
    sha256: '1e54cc21d75c18c8031be601b1d76937ed3693e273ca3819da4aa7bd5e6887d2',
  },
  menuButtonClick: {
    bytes: 32_812,
    canonicalPath: OPTIONS_MENU_BUTTON_AUDIO_CANONICAL_PATH,
    kind: 'audio' as const,
    sha256: '3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e',
  },
  themeRow: {
    bytes: 33_104,
    canonicalPath: OPTIONS_THEME_ROW_AUDIO_CANONICAL_PATH,
    kind: 'audio' as const,
    sha256: 'aac7a424635c6518349f6b65f4ece3cecc06be4181f322303bd6a38f5649d4e4',
  },
}) satisfies Readonly<Record<string, OptionsSharedFileResource>>;

const OPTIONS_RASTER_DIMENSIONS = {
  'Options/options-title.png': [[552, 118], [792, 159]],
  'Options/options-backgrounds.png': [[552, 74], [792, 80]],
  'Options/options-blade.png': [[552, 74], [792, 80]],
  'Options/options-themes.png': [[552, 74], [792, 80]],
  'Icons/icon-image-background.png': [[139, 139], [208, 208]],
  'Icons/icon-button-prev.png': [[173, 141], [223, 175]],
  'Icons/icon-button-prev-selected.png': [[173, 141], [223, 175]],
  'Icons/icon-button-next.png': [[173, 141], [223, 175]],
  'Icons/icon-button-next-selected.png': [[173, 141], [223, 175]],
  'Icons/back-button.png': [[135, 113], [166, 134]],
  'Icons/back-button-selected.png': [[135, 113], [166, 134]],
  'Buttons/button-buyitem-normal.png': [[133, 36], [200, 54]],
  'Buttons/button-buyitem-selected.png': [[133, 36], [200, 54]],
  'Interfaces/total-coins.png': [[334, 131], [464, 160]],
  'Blades/Particles/X-Mas/xmasfive.png': [[46, 44], [66, 64]],
  'Icons/theme-icon-0.png': [[117, 116], [175, 175]],
  'Icons/theme-icon-1.png': [[117, 117], [175, 175]],
  'Icons/theme-icon-2.png': [[117, 117], [175, 175]],
  'Icons/theme-icon-3.png': [[117, 117], [175, 175]],
  'Icons/theme-icon-4.png': [[117, 117], [175, 175]],
  'Icons/theme-icon-5.png': [[116, 117], [175, 175]],
  'Icons/theme-icon-6.png': [[117, 117], [175, 175]],
  'Icons/theme-icon-7.png': [[117, 116], [175, 174]],
  'Icons/theme-icon-8.png': [[116, 116], [175, 174]],
  'Icons/theme-icon-9.png': [[117, 116], [175, 174]],
  'Icons/blade-icon-0.png': [[131, 129], [197, 194]],
  'Icons/blade-icon-1.png': [[131, 129], [197, 194]],
  'Icons/blade-icon-2.png': [[131, 129], [197, 194]],
  'Icons/blade-icon-3.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-4.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-5.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-6.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-7.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-8.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-9.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-10.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-11.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-12.png': [[132, 130], [196, 194]],
  'Icons/blade-icon-13.png': [[131, 130], [197, 193]],
  'Icons/blade-icon-14.png': [[132, 129], [197, 194]],
  'Icons/blade-icon-15.png': [[131, 130], [197, 193]],
  'Icons/blade-icon-16.png': [[132, 129], [197, 193]],
  'Icons/blade-icon-17.png': [[132, 130], [196, 194]],
  'Icons/background-icon-0.png': [[117, 117], [175, 175]],
  'Icons/background-icon-1.png': [[117, 117], [175, 175]],
  'Icons/background-icon-2.png': [[118, 139], [176, 175]],
  'Icons/background-icon-3.png': [[118, 117], [176, 175]],
  'Icons/background-icon-4.png': [[118, 117], [177, 175]],
  'Icons/background-icon-5.png': [[118, 117], [177, 175]],
  'Icons/background-icon-6.png': [[118, 117], [177, 175]],
  'Icons/background-icon-7.png': [[118, 117], [177, 175]],
} as const;

type OptionsRasterLogicalPath = keyof typeof OPTIONS_RASTER_DIMENSIONS;

export const OPTIONS_RASTER_RESOURCES: Readonly<Record<ClassicAssetTree, OptionsRasterProfile>>
  = deepFreeze({
    '480x800': createRasterProfile('480x800'),
    '720x1280': createRasterProfile('720x1280'),
  });

export function getOptionsRasterResources(assetTree: ClassicAssetTree): OptionsRasterProfile {
  assertAssetTree(assetTree);
  return OPTIONS_RASTER_RESOURCES[assetTree];
}

function createRasterProfile(tree: ClassicAssetTree): OptionsRasterProfile {
  return {
    back: twoFrame(
      raster(tree, 'Icons/back-button.png'),
      raster(tree, 'Icons/back-button-selected.png'),
    ),
    backgroundIcons: iconFamily(tree, 'background', 8),
    bladeIcons: iconFamily(tree, 'blade', 18),
    buy: twoFrame(
      raster(tree, 'Buttons/button-buyitem-normal.png'),
      raster(tree, 'Buttons/button-buyitem-selected.png'),
    ),
    next: twoFrame(
      raster(tree, 'Icons/icon-button-next.png'),
      raster(tree, 'Icons/icon-button-next-selected.png'),
    ),
    previous: twoFrame(
      raster(tree, 'Icons/icon-button-prev.png'),
      raster(tree, 'Icons/icon-button-prev-selected.png'),
    ),
    purchaseParticle: raster(tree, 'Blades/Particles/X-Mas/xmasfive.png'),
    sectionHeaders: {
      background: raster(tree, 'Options/options-backgrounds.png'),
      blade: raster(tree, 'Options/options-blade.png'),
      theme: raster(tree, 'Options/options-themes.png'),
    },
    selectorBackground: raster(tree, 'Icons/icon-image-background.png'),
    themeIcons: iconFamily(tree, 'theme', 10),
    title: raster(tree, 'Options/options-title.png'),
    totalCoinsPanel: raster(tree, 'Interfaces/total-coins.png'),
  };
}

function iconFamily(
  tree: ClassicAssetTree,
  family: 'background' | 'blade' | 'theme',
  count: number,
): readonly ClassicRasterResource[] {
  return Array.from({ length: count }, (_, index) => raster(
    tree,
    `Icons/${family}-icon-${index}.png` as OptionsRasterLogicalPath,
  ));
}

function twoFrame(
  normal: ClassicRasterResource,
  selected: ClassicRasterResource,
): OptionsTwoFrameRasterSet {
  return { normal, selected };
}

function raster(
  tree: ClassicAssetTree,
  logicalPath: OptionsRasterLogicalPath,
): ClassicRasterResource {
  const treeIndex = tree === '480x800' ? 0 : 1;
  const [width, height] = OPTIONS_RASTER_DIMENSIONS[logicalPath][treeIndex];
  return {
    canonicalPath: `${tree}/${logicalPath}`,
    dimensions: { height, width },
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
