import {
  BIRD_RASTER_RESOURCE_COUNT,
  getBirdResourceProfile,
  listBirdRasterResources,
  type BirdAnimationFrameResources,
  type BirdParticleResources,
} from '../domain/bird-resource-contract';
import type {
  GameAssetTree,
  GameRasterResource,
} from '../domain/game-resource-contract';
import {
  loadExactGameRasters,
  loadGameResourceBundle,
  type LoadedGameRasterResource,
} from './game-resource-loader';

export type LoadedBirdAnimationFrameResources = {
  readonly [Index in keyof BirdAnimationFrameResources]:
  BirdAnimationFrameResources[Index] extends GameRasterResource
    ? LoadedGameRasterResource
    : BirdAnimationFrameResources[Index];
};

export type LoadedBirdParticleResources = {
  readonly [Index in keyof BirdParticleResources]:
  BirdParticleResources[Index] extends GameRasterResource
    ? LoadedGameRasterResource
    : BirdParticleResources[Index];
};

export interface LoadedBirdResources {
  readonly animationFrames: LoadedBirdAnimationFrameResources;
  readonly assetTree: GameAssetTree;
  readonly blade: LoadedGameRasterResource;
  readonly leftDirection: LoadedGameRasterResource;
  readonly orderedRasters: readonly LoadedGameRasterResource[];
  readonly particles: LoadedBirdParticleResources;
  readonly rasterCount: typeof BIRD_RASTER_RESOURCE_COUNT;
  readonly rightDirection: LoadedGameRasterResource;
  raster(resource: GameRasterResource): LoadedGameRasterResource;
}

/**
 * Loads only the dedicated BirdBlade gameplay closure. GOOD/LUCK, GAME/OVER,
 * fruit, bomb, background/theme, and Mode Select art stay with their existing
 * shared catalogs.
 */
export async function loadBirdResources(
  assetTree: GameAssetTree,
): Promise<LoadedBirdResources> {
  const profile = getBirdResourceProfile(assetTree);
  const rasterContracts = listBirdRasterResources(assetTree);
  if (rasterContracts.length !== BIRD_RASTER_RESOURCE_COUNT) {
    throw new Error(
      `Bird must load exactly ${BIRD_RASTER_RESOURCE_COUNT} dedicated rasters`,
    );
  }

  const bundle = await loadGameResourceBundle();
  const rasters = await loadExactGameRasters(rasterContracts, bundle);
  const loadedByPath = new Map<string, LoadedGameRasterResource>();
  for (const raster of rasters) {
    if (loadedByPath.has(raster.canonicalPath)) {
      throw new Error(`Creator returned duplicate Bird raster ${raster.canonicalPath}`);
    }
    loadedByPath.set(raster.canonicalPath, raster);
  }
  if (loadedByPath.size !== BIRD_RASTER_RESOURCE_COUNT) {
    throw new Error('Creator returned an incomplete Bird raster catalog');
  }

  const animationFrames = Object.freeze(profile.animationFrames.map((resource) => (
    requireLoadedBirdRaster(resource, loadedByPath)
  ))) as unknown as LoadedBirdAnimationFrameResources;
  const particles = Object.freeze(profile.particles.map((resource) => (
    requireLoadedBirdRaster(resource, loadedByPath)
  ))) as unknown as LoadedBirdParticleResources;
  const orderedRasters = Object.freeze(rasterContracts.map((resource) => (
    requireLoadedBirdRaster(resource, loadedByPath)
  )));

  return Object.freeze({
    animationFrames,
    assetTree,
    blade: requireLoadedBirdRaster(profile.blade, loadedByPath),
    leftDirection: requireLoadedBirdRaster(profile.leftDirection, loadedByPath),
    orderedRasters,
    particles,
    rasterCount: BIRD_RASTER_RESOURCE_COUNT,
    rightDirection: requireLoadedBirdRaster(profile.rightDirection, loadedByPath),
    raster(resource: GameRasterResource): LoadedGameRasterResource {
      const loaded = loadedByPath.get(resource.canonicalPath);
      if (loaded === undefined) {
        throw new Error(`Bird raster was not loaded: ${resource.canonicalPath}`);
      }
      if (
        loaded.dimensions.width !== resource.dimensions.width
        || loaded.dimensions.height !== resource.dimensions.height
      ) {
        throw new Error(`Bird raster contract changed: ${resource.canonicalPath}`);
      }
      return loaded;
    },
  });
}

function requireLoadedBirdRaster(
  resource: GameRasterResource,
  loadedByPath: ReadonlyMap<string, LoadedGameRasterResource>,
): LoadedGameRasterResource {
  const loaded = loadedByPath.get(resource.canonicalPath);
  if (loaded === undefined) {
    throw new Error(`Creator omitted Bird raster ${resource.canonicalPath}`);
  }
  return loaded;
}
