import type {
  ClassicRasterResource,
} from './classic-resource-contract';
import type { ClassicAssetTree } from './resolution-profile-service';

export const SHARED_BACKGROUND_DEFAULT_INDEX = 0;
export const SHARED_THEME_DEFAULT_INDEX = 2;

export type SharedBackgroundIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type SharedThemeIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface SharedLeafResourceDefinition {
  readonly name: 'leave7' | 'leave1' | 'leave2' | 'leave3' | 'leave4' | 'leave5' | 'leave6';
  readonly rasters: Readonly<Record<ClassicAssetTree, ClassicRasterResource>>;
}

const BACKGROUND_DIMENSIONS = Object.freeze({
  '480x800': Object.freeze([
    [480, 800],
    [480, 800],
    [480, 800],
    [480, 802],
    [481, 801],
    [480, 800],
    [480, 800],
    [480, 801],
    [481, 800],
  ] as const),
  '720x1280': Object.freeze([
    [720, 1280],
    [721, 1281],
    [720, 1280],
    [720, 1280],
    [721, 1281],
    [720, 1280],
    [721, 1280],
    [720, 1281],
    [721, 1281],
  ] as const),
});

const THEME_DIMENSIONS = Object.freeze({
  '480x800': Object.freeze([
    [480, 800],
    [482, 802],
    [482, 802],
    [480, 800],
    [480, 800],
    [480, 800],
    [480, 800],
    [480, 800],
    [480, 800],
    [480, 800],
  ] as const),
  '720x1280': Object.freeze([
    [720, 1280],
    [720, 1280],
    [720, 1280],
    [720, 1280],
    [720, 1280],
    [720, 1280],
    [720, 1280],
    [720, 1280],
    [720, 1280],
    [720, 1280],
  ] as const),
});

const LEAF_DEFINITIONS = Object.freeze([
  ['leave7', [75, 71]],
  ['leave1', [84, 79]],
  ['leave2', [69, 64]],
  ['leave3', [51, 91]],
  ['leave4', [74, 71]],
  ['leave5', [79, 69]],
  ['leave6', [66, 70]],
] as const);

export const SHARED_BACKGROUND_RESOURCES: Readonly<
  Record<ClassicAssetTree, readonly ClassicRasterResource[]>
> = Object.freeze({
  '480x800': createIndexedFamily(
    '480x800',
    'Backgrounds/paperbackground',
    BACKGROUND_DIMENSIONS['480x800'],
  ),
  '720x1280': createIndexedFamily(
    '720x1280',
    'Backgrounds/paperbackground',
    BACKGROUND_DIMENSIONS['720x1280'],
  ),
});

export const SHARED_THEME_RESOURCES: Readonly<
  Record<ClassicAssetTree, readonly ClassicRasterResource[]>
> = Object.freeze({
  '480x800': createIndexedFamily(
    '480x800',
    'Themes/theme',
    THEME_DIMENSIONS['480x800'],
  ),
  '720x1280': createIndexedFamily(
    '720x1280',
    'Themes/theme',
    THEME_DIMENSIONS['720x1280'],
  ),
});

export const SHARED_LEAF_RESOURCES: readonly SharedLeafResourceDefinition[] = Object.freeze(
  LEAF_DEFINITIONS.map(([name, dimensions]) => Object.freeze({
    name,
    rasters: Object.freeze({
      '480x800': createRaster(`480x800/Leaf/${name}.png`, dimensions),
      '720x1280': createRaster(`720x1280/Leaf/${name}.png`, dimensions),
    }),
  })),
);

export function getSharedBackgroundResource(
  assetTree: ClassicAssetTree,
  index: number,
): ClassicRasterResource {
  assertAssetTree(assetTree);
  assertIndex(index, 0, 8, 'background index');
  return requireResource(SHARED_BACKGROUND_RESOURCES[assetTree][index], 'background', index);
}

export function getSharedThemeResource(
  assetTree: ClassicAssetTree,
  index: number,
): ClassicRasterResource {
  assertAssetTree(assetTree);
  assertIndex(index, 0, 9, 'theme index');
  return requireResource(SHARED_THEME_RESOURCES[assetTree][index], 'theme', index);
}

export function getSharedLeafResources(
  assetTree: ClassicAssetTree,
): readonly ClassicRasterResource[] {
  assertAssetTree(assetTree);
  return Object.freeze(SHARED_LEAF_RESOURCES.map(({ rasters }) => rasters[assetTree]));
}

function createIndexedFamily(
  assetTree: ClassicAssetTree,
  prefix: string,
  dimensions: readonly (readonly [number, number])[],
): readonly ClassicRasterResource[] {
  return Object.freeze(dimensions.map((size, index) => (
    createRaster(`${assetTree}/${prefix}${index}.png`, size)
  )));
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

function assertAssetTree(assetTree: ClassicAssetTree): void {
  if (assetTree !== '480x800' && assetTree !== '720x1280') {
    throw new RangeError('assetTree must be 480x800 or 720x1280');
  }
}

function assertIndex(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer from ${minimum} through ${maximum}`);
  }
}

function requireResource(
  resource: ClassicRasterResource | undefined,
  family: string,
  index: number,
): ClassicRasterResource {
  if (resource === undefined) {
    throw new Error(`Missing recovered shared ${family} resource ${index}`);
  }
  return resource;
}
