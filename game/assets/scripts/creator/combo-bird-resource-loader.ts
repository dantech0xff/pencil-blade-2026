import * as Cocos from 'cc';

import type { AssetManager, Font } from 'cc';

import {
  COMBO_BIRD_SUPPLEMENTAL_RASTER_COUNT,
  COMBO_BIRD_TIME_MANAGER_FONT_RESOURCE,
  getComboBirdSupplementalRasterSet,
  listComboBirdSupplementalRasterResources,
} from '../domain/combo-bird-resource-contract';
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

export interface LoadedComboBirdResources {
  readonly assetTree: GameAssetTree;
  readonly freezeClock: LoadedGameRasterResource;
  readonly rasterCount: typeof COMBO_BIRD_SUPPLEMENTAL_RASTER_COUNT;
  readonly timeManagerFont: Font;
  readonly timeUp: LoadedGameRasterResource;
  raster(resource: GameRasterResource): LoadedGameRasterResource;
}

export function createComboBirdTimeManagerResourcePort(
  resources: LoadedComboBirdResources,
): TimeManagerResourcePort {
  return Object.freeze({
    assetTree: resources.assetTree,
    freezeClock: resources.freezeClock,
    timeManagerFont: resources.timeManagerFont,
    timeUp: resources.timeUp,
  });
}

export async function loadComboBirdResources(
  assetTree: GameAssetTree,
): Promise<LoadedComboBirdResources> {
  const rasterContracts = listComboBirdSupplementalRasterResources(assetTree);
  if (rasterContracts.length !== COMBO_BIRD_SUPPLEMENTAL_RASTER_COUNT) {
    throw new Error(
      `Combo Bird must load exactly ${
        String(COMBO_BIRD_SUPPLEMENTAL_RASTER_COUNT)
      } supplemental rasters`,
    );
  }
  const bundle = await loadGameResourceBundle();
  const [rasters, timeManagerFont] = await Promise.all([
    loadExactGameRasters(rasterContracts, bundle),
    loadComboBirdTimeManagerFont(bundle),
  ]);
  const rastersByPath = new Map<string, LoadedGameRasterResource>();
  for (const raster of rasters) {
    if (rastersByPath.has(raster.canonicalPath)) {
      throw new Error(
        `Creator returned duplicate Combo Bird raster ${raster.canonicalPath}`,
      );
    }
    rastersByPath.set(raster.canonicalPath, raster);
  }
  if (rastersByPath.size !== COMBO_BIRD_SUPPLEMENTAL_RASTER_COUNT) {
    throw new Error('Creator returned an incomplete Combo Bird supplemental raster catalog');
  }

  const supplement = getComboBirdSupplementalRasterSet(assetTree);
  const raster = (resource: GameRasterResource): LoadedGameRasterResource => {
    const loaded = rastersByPath.get(resource.canonicalPath);
    if (loaded === undefined) {
      throw new Error(`Combo Bird raster was not loaded: ${resource.canonicalPath}`);
    }
    if (
      loaded.dimensions.width !== resource.dimensions.width
      || loaded.dimensions.height !== resource.dimensions.height
    ) {
      throw new Error(`Combo Bird raster contract changed: ${resource.canonicalPath}`);
    }
    return loaded;
  };

  return Object.freeze({
    assetTree,
    freezeClock: raster(supplement.freezeClock),
    rasterCount: COMBO_BIRD_SUPPLEMENTAL_RASTER_COUNT,
    timeManagerFont,
    timeUp: raster(supplement.timeUp),
    raster,
  });
}

function loadComboBirdTimeManagerFont(
  bundle: AssetManager.Bundle,
): Promise<Font> {
  const canonicalPath = COMBO_BIRD_TIME_MANAGER_FONT_RESOURCE.canonicalPath;
  const bundlePath = canonicalResourceToBundlePath(canonicalPath);
  return new Promise((resolve, reject) => {
    bundle.load(bundlePath, Cocos.Font, (error, font) => {
      if (error !== null && error !== undefined) {
        reject(new Error(
          `Failed to load Combo Bird TimeManager font: ${error.message}`,
        ));
        return;
      }
      if (font === null || font === undefined) {
        reject(new Error(
          `Creator returned no Combo Bird TimeManager font for ${canonicalPath}`,
        ));
        return;
      }
      resolve(font);
    });
  });
}
