import * as Cocos from 'cc';

import type { AssetManager, Font } from 'cc';

import {
  CRAZY_SUPPLEMENTAL_RASTER_COUNT,
  CRAZY_TIME_MANAGER_FONT_RESOURCE,
  getCrazySupplementalRasterSet,
  getCrazySupplementalRasterResources,
} from '../domain/crazy-resource-contract';
import {
  canonicalResourceToBundlePath,
  type GameAssetTree,
  type GameRasterResource,
} from '../domain/game-resource-contract';
import {
  loadExactGameRasters,
  loadGameResourceBundle,
  type LoadedGameRasterResource,
} from './game-resource-loader';
import type { TimeManagerResourcePort } from './time-manager-presenter';

export interface LoadedCrazyResources {
  readonly assetTree: GameAssetTree;
  readonly rasterCount: typeof CRAZY_SUPPLEMENTAL_RASTER_COUNT;
  readonly timeManagerFont: Font;
  raster(resource: GameRasterResource): LoadedGameRasterResource;
}

export function createCrazyTimeManagerResourcePort(
  resources: LoadedCrazyResources,
): TimeManagerResourcePort {
  const supplement = getCrazySupplementalRasterSet(resources.assetTree);
  return Object.freeze({
    assetTree: resources.assetTree,
    freezeClock: resources.raster(supplement.freezeClock),
    timeManagerFont: resources.timeManagerFont,
    timeUp: resources.raster(supplement.timeUp),
  });
}

/**
 * Loads the reviewed Crazy-only supplement. Shared fruit, blade, bomb, HUD, and Result
 * resources remain owned by the already prepared Classic-compatible process catalog.
 */
export async function loadCrazyResources(
  assetTree: GameAssetTree,
): Promise<LoadedCrazyResources> {
  const rasterContracts = getCrazySupplementalRasterResources(assetTree);
  if (rasterContracts.length !== CRAZY_SUPPLEMENTAL_RASTER_COUNT) {
    throw new Error(
      `Crazy must load exactly ${CRAZY_SUPPLEMENTAL_RASTER_COUNT} supplemental rasters`,
    );
  }
  const bundle = await loadGameResourceBundle();
  const [rasters, timeManagerFont] = await Promise.all([
    loadExactGameRasters(rasterContracts, bundle),
    loadCrazyTimeManagerFont(bundle),
  ]);
  const rastersByPath = new Map<string, LoadedGameRasterResource>();
  for (const raster of rasters) {
    if (rastersByPath.has(raster.canonicalPath)) {
      throw new Error(`Creator returned duplicate Crazy raster ${raster.canonicalPath}`);
    }
    rastersByPath.set(raster.canonicalPath, raster);
  }
  if (rastersByPath.size !== CRAZY_SUPPLEMENTAL_RASTER_COUNT) {
    throw new Error('Creator returned an incomplete Crazy supplemental raster catalog');
  }

  return Object.freeze({
    assetTree,
    rasterCount: CRAZY_SUPPLEMENTAL_RASTER_COUNT,
    timeManagerFont,
    raster(resource: GameRasterResource): LoadedGameRasterResource {
      const loaded = rastersByPath.get(resource.canonicalPath);
      if (loaded === undefined) {
        throw new Error(`Crazy raster was not loaded: ${resource.canonicalPath}`);
      }
      if (
        loaded.dimensions.width !== resource.dimensions.width
        || loaded.dimensions.height !== resource.dimensions.height
      ) {
        throw new Error(`Crazy raster contract changed: ${resource.canonicalPath}`);
      }
      return loaded;
    },
  });
}

function loadCrazyTimeManagerFont(bundle: AssetManager.Bundle): Promise<Font> {
  const canonicalPath = CRAZY_TIME_MANAGER_FONT_RESOURCE.canonicalPath;
  const bundlePath = canonicalResourceToBundlePath(canonicalPath);
  return new Promise((resolve, reject) => {
    bundle.load(bundlePath, Cocos.Font, (error, font) => {
      if (error !== null && error !== undefined) {
        reject(new Error(`Failed to load Crazy TimeManager font: ${error.message}`));
        return;
      }
      if (font === null || font === undefined) {
        reject(new Error(`Creator returned no Crazy TimeManager font for ${canonicalPath}`));
        return;
      }
      resolve(font);
    });
  });
}
