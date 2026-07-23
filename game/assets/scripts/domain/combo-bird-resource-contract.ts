import {
  assertGameAssetTree,
  createGameRaster,
  type GameAssetTree,
  type GameFontResource,
  type GameRasterResource,
} from './game-resource-contract';

export interface ComboBirdSupplementalRasterSet {
  readonly freezeClock: GameRasterResource;
  readonly introGo: GameRasterResource;
  readonly introNinety: GameRasterResource;
  readonly justComboInstruction: GameRasterResource;
  readonly noBombInstruction: GameRasterResource;
  readonly noLifeInstruction: GameRasterResource;
  readonly timeUp: GameRasterResource;
}

export const COMBO_BIRD_SUPPLEMENTAL_RASTER_COUNT = 7 as const;

export const COMBO_BIRD_TIME_MANAGER_FONT_RESOURCE: GameFontResource = Object.freeze({
  canonicalPath: 'Fonts/MotorwerkOblique.ttf',
});

export const COMBO_BIRD_SUPPLEMENTAL_RASTERS: Readonly<
  Record<GameAssetTree, ComboBirdSupplementalRasterSet>
> = Object.freeze({
  '480x800': createComboBirdSupplementalRasterSet('480x800'),
  '720x1280': createComboBirdSupplementalRasterSet('720x1280'),
});

export function getComboBirdSupplementalRasterSet(
  assetTree: GameAssetTree,
): ComboBirdSupplementalRasterSet {
  assertGameAssetTree(assetTree);
  return COMBO_BIRD_SUPPLEMENTAL_RASTERS[assetTree];
}

export function listComboBirdSupplementalRasterResources(
  assetTree: GameAssetTree,
): readonly GameRasterResource[] {
  const supplement = getComboBirdSupplementalRasterSet(assetTree);
  const resources = [
    supplement.introGo,
    supplement.introNinety,
    supplement.noBombInstruction,
    supplement.justComboInstruction,
    supplement.noLifeInstruction,
    supplement.timeUp,
    supplement.freezeClock,
  ];
  if (resources.length !== COMBO_BIRD_SUPPLEMENTAL_RASTER_COUNT) {
    throw new Error('Combo Bird supplemental raster contract has an invalid cardinality');
  }
  if (
    new Set(resources.map(({ canonicalPath }) => canonicalPath)).size
    !== resources.length
  ) {
    throw new Error('Combo Bird supplemental raster contract contains duplicate paths');
  }
  return Object.freeze(resources);
}

function createComboBirdSupplementalRasterSet(
  assetTree: GameAssetTree,
): ComboBirdSupplementalRasterSet {
  const compact = assetTree === '480x800';
  return Object.freeze({
    freezeClock: createGameRaster(
      `${assetTree}/Interfaces/object-time-freeze.png`,
      compact ? [148, 85] : [222, 127],
    ),
    introGo: createGameRaster(
      `${assetTree}/Text/text-go.png`,
      compact ? [70, 31] : [106, 47],
    ),
    introNinety: createGameRaster(
      `${assetTree}/Text/text-90s.png`,
      compact ? [169, 33] : [252, 49],
    ),
    justComboInstruction: createGameRaster(
      compact
        ? '480x800/Text/text-juscombo.png'
        : '720x1280/Text/text-justcombo.png',
      compact ? [286, 44] : [404, 51],
    ),
    noBombInstruction: createGameRaster(
      `${assetTree}/Text/text-nobomb.png`,
      compact ? [231, 34] : [347, 51],
    ),
    noLifeInstruction: createGameRaster(
      `${assetTree}/Text/text-nolive.png`,
      compact ? [190, 32] : [285, 47],
    ),
    timeUp: createGameRaster(
      `${assetTree}/Text/text-time-up.png`,
      compact ? [345, 135] : [481, 165],
    ),
  });
}
