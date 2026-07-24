import {
  assertGameAssetTree,
  createGameRaster,
  type GameAssetTree,
  type GameRasterResource,
} from './game-resource-contract';

export const GN_STYLE_BACKGROUND_MUSIC_PATH
  = 'Sounds/GangnamStyle.mp3' as const;

export interface GnStyleSupplementalRasterSet {
  readonly gnStyleInstruction: GameRasterResource;
  readonly introGo: GameRasterResource;
  readonly introOneHundredFifty: GameRasterResource;
  readonly noBombInstruction: GameRasterResource;
  readonly noLifeInstruction: GameRasterResource;
  readonly particleStars: GameRasterResource;
  readonly particleVnFlagStar: GameRasterResource;
  readonly particleXmasCircle: GameRasterResource;
  readonly particleXmasFive: GameRasterResource;
  readonly particleXmasFour: GameRasterResource;
  readonly particleXmasHexa: GameRasterResource;
}

export const GN_STYLE_INTRO_RASTER_COUNT = 5 as const;
export const GN_STYLE_PARTICLE_FAMILY_RASTER_COUNT = 6 as const;
export const GN_STYLE_SUPPLEMENTAL_RASTER_COUNT = 11 as const;

export const GN_STYLE_SUPPLEMENTAL_RASTERS: Readonly<
  Record<GameAssetTree, GnStyleSupplementalRasterSet>
> = Object.freeze({
  '480x800': createGnStyleSupplementalRasterSet('480x800'),
  '720x1280': createGnStyleSupplementalRasterSet('720x1280'),
});

export function getGnStyleSupplementalRasterSet(
  assetTree: GameAssetTree,
): GnStyleSupplementalRasterSet {
  assertGameAssetTree(assetTree);
  return GN_STYLE_SUPPLEMENTAL_RASTERS[assetTree];
}

export function listGnStyleIntroRasterResources(
  assetTree: GameAssetTree,
): readonly GameRasterResource[] {
  const supplement = getGnStyleSupplementalRasterSet(assetTree);
  return assertUniqueCardinality(Object.freeze([
    supplement.noBombInstruction,
    supplement.gnStyleInstruction,
    supplement.noLifeInstruction,
    supplement.introOneHundredFifty,
    supplement.introGo,
  ]), GN_STYLE_INTRO_RASTER_COUNT, 'intro');
}

export function listGnStyleParticleFamilyRasterResources(
  assetTree: GameAssetTree,
): readonly GameRasterResource[] {
  const supplement = getGnStyleSupplementalRasterSet(assetTree);
  return assertUniqueCardinality(Object.freeze([
    supplement.particleXmasFive,
    supplement.particleXmasFour,
    supplement.particleXmasHexa,
    supplement.particleXmasCircle,
    supplement.particleStars,
    supplement.particleVnFlagStar,
  ]), GN_STYLE_PARTICLE_FAMILY_RASTER_COUNT, 'particle-family');
}

export function listGnStyleSupplementalRasterResources(
  assetTree: GameAssetTree,
): readonly GameRasterResource[] {
  return assertUniqueCardinality(Object.freeze([
    ...listGnStyleIntroRasterResources(assetTree),
    ...listGnStyleParticleFamilyRasterResources(assetTree),
  ]), GN_STYLE_SUPPLEMENTAL_RASTER_COUNT, 'supplemental');
}

function createGnStyleSupplementalRasterSet(
  assetTree: GameAssetTree,
): GnStyleSupplementalRasterSet {
  const compact = assetTree === '480x800';
  return Object.freeze({
    gnStyleInstruction: createGameRaster(
      `${assetTree}/Text/text-gnstyle.png`,
      compact ? [342, 43] : [512, 64],
    ),
    introGo: createGameRaster(
      `${assetTree}/Text/text-go.png`,
      compact ? [70, 31] : [106, 47],
    ),
    introOneHundredFifty: createGameRaster(
      `${assetTree}/Text/text-150s.png`,
      compact ? [192, 34] : [288, 51],
    ),
    noBombInstruction: createGameRaster(
      `${assetTree}/Text/text-nobomb.png`,
      compact ? [231, 34] : [347, 51],
    ),
    noLifeInstruction: createGameRaster(
      `${assetTree}/Text/text-nolive.png`,
      compact ? [190, 32] : [285, 47],
    ),
    particleStars: createGameRaster(
      `${assetTree}/Blades/Particles/stars.png`,
      compact ? [32, 32] : [48, 48],
    ),
    particleVnFlagStar: createGameRaster(
      `${assetTree}/Blades/Particles/VN Flag/vnflagstar.png`,
      compact ? [54, 52] : [78, 74],
    ),
    particleXmasCircle: createGameRaster(
      `${assetTree}/Blades/Particles/X-Mas/xmascircle.png`,
      compact ? [34, 34] : [49, 50],
    ),
    particleXmasFive: createGameRaster(
      `${assetTree}/Blades/Particles/X-Mas/xmasfive.png`,
      compact ? [46, 44] : [66, 64],
    ),
    particleXmasFour: createGameRaster(
      `${assetTree}/Blades/Particles/X-Mas/xmasfour.png`,
      compact ? [51, 59] : [70, 83],
    ),
    particleXmasHexa: createGameRaster(
      `${assetTree}/Blades/Particles/X-Mas/xmashexa.png`,
      compact ? [32, 36] : [47, 53],
    ),
  });
}

function assertUniqueCardinality<
  ExpectedCount extends number,
>(
  resources: readonly GameRasterResource[],
  expectedCount: ExpectedCount,
  label: string,
): readonly GameRasterResource[] {
  if (resources.length !== expectedCount) {
    throw new Error(
      `GN Style ${label} raster contract has an invalid cardinality`,
    );
  }
  if (
    new Set(resources.map(({ canonicalPath }) => canonicalPath)).size
      !== resources.length
  ) {
    throw new Error(`GN Style ${label} raster contract contains duplicate paths`);
  }
  return resources;
}
