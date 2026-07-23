import * as Cocos from 'cc';

import type { AssetManager, Font } from 'cc';

import {
  canonicalResourceToBundlePath,
  type ClassicRasterResource,
} from '../domain/classic-resource-contract';
import {
  MODE_SELECT_SHARED_RESOURCES,
  getModeSelectRasterResources,
  type ModeSelectRasterProfile,
} from '../domain/mode-select-resource-contract';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import {
  loadExactGameRasters,
  loadGameResourceBundle,
  type LoadedGameRasterResource,
} from './game-resource-loader';

export const MODE_SELECT_RASTER_RESOURCE_COUNT = 42 as const;

export interface LoadedModeSelectResources {
  readonly assetTree: ClassicAssetTree;
  readonly font: Font;
  readonly rasterCount: typeof MODE_SELECT_RASTER_RESOURCE_COUNT;
  raster(resource: ClassicRasterResource): LoadedGameRasterResource;
}

/** Loads the complete accepted Mode Select raster profile and its exact SlabThing font. */
export async function loadModeSelectResources(
  assetTree: ClassicAssetTree,
): Promise<LoadedModeSelectResources> {
  const profile = getModeSelectRasterResources(assetTree);
  const rasterContracts = collectModeSelectRasterContracts(profile);
  if (rasterContracts.length !== MODE_SELECT_RASTER_RESOURCE_COUNT) {
    throw new Error(
      `Mode Select must load exactly ${MODE_SELECT_RASTER_RESOURCE_COUNT} rasters`,
    );
  }
  const bundle = await loadGameResourceBundle();
  const [rasters, font] = await Promise.all([
    loadExactGameRasters(rasterContracts, bundle),
    loadModeSelectFont(bundle),
  ]);
  const rastersByPath = new Map<string, LoadedGameRasterResource>();
  for (const raster of rasters) {
    rastersByPath.set(raster.canonicalPath, raster);
  }
  if (rastersByPath.size !== MODE_SELECT_RASTER_RESOURCE_COUNT) {
    throw new Error('Creator returned an incomplete Mode Select raster catalog');
  }
  return Object.freeze({
    assetTree,
    font,
    rasterCount: MODE_SELECT_RASTER_RESOURCE_COUNT,
    raster(resource: ClassicRasterResource): LoadedGameRasterResource {
      const loaded = rastersByPath.get(resource.canonicalPath);
      if (loaded === undefined) {
        throw new Error(`Mode Select raster was not loaded: ${resource.canonicalPath}`);
      }
      if (
        loaded.dimensions.width !== resource.dimensions.width
        || loaded.dimensions.height !== resource.dimensions.height
      ) {
        throw new Error(`Mode Select raster contract changed: ${resource.canonicalPath}`);
      }
      return loaded;
    },
  });
}

export function collectModeSelectRasterContracts(
  profile: ModeSelectRasterProfile,
): readonly ClassicRasterResource[] {
  if (profile === null || typeof profile !== 'object') {
    throw new TypeError('Mode Select raster profile must be an object');
  }
  const resources: ClassicRasterResource[] = [];
  const paths = new Set<string>();
  const append = (resource: ClassicRasterResource): void => {
    if (paths.has(resource.canonicalPath)) {
      throw new Error(`Duplicate Mode Select raster contract: ${resource.canonicalPath}`);
    }
    paths.add(resource.canonicalPath);
    resources.push(resource);
  };
  const appendPair = (pair: Readonly<{
    readonly normal: ClassicRasterResource;
    readonly selected: ClassicRasterResource;
  }>): void => {
    append(pair.normal);
    append(pair.selected);
  };
  const appendFruit = (fruit: Readonly<{
    readonly cutBottom: ClassicRasterResource;
    readonly cutTop: ClassicRasterResource;
    readonly intact: ClassicRasterResource;
  }>): void => {
    append(fruit.intact);
    append(fruit.cutBottom);
    append(fruit.cutTop);
  };

  appendPair(profile.back);
  append(profile.cardCircles.classic);
  append(profile.cardCircles.crazy);
  append(profile.cardCircles.gnStyle);
  append(profile.cardCircles.classicBird);
  append(profile.cardCircles.crazyBird);
  append(profile.cardCircles.comboBird);
  append(profile.cardDescriptions.classic);
  append(profile.cardDescriptions.crazy);
  append(profile.cardDescriptions.combo);
  append(profile.cardDescriptions.classicBird);
  append(profile.cardDescriptions.crazyBird);
  append(profile.cardDescriptions.comboBird);
  append(profile.descriptionShader);
  append(profile.fruitButtonBlur);
  appendFruit(profile.fruits.apple);
  appendFruit(profile.fruits.banana);
  appendFruit(profile.fruits.strawberry);
  appendFruit(profile.fruits.orange);
  appendFruit(profile.fruits.magnetstrawberry);
  appendFruit(profile.fruits.kiwi);
  append(profile.longRope);
  append(profile.ropeNode);
  append(profile.title);
  appendPair(profile.unlock);
  append(profile.unlockParticle);
  append(profile.wheel);
  append(profile.wheelConnector);

  if (resources.length !== MODE_SELECT_RASTER_RESOURCE_COUNT) {
    throw new Error('Mode Select raster profile does not contain exactly 42 resources');
  }
  return Object.freeze(resources);
}

function loadModeSelectFont(bundle: AssetManager.Bundle): Promise<Font> {
  const canonicalPath = MODE_SELECT_SHARED_RESOURCES.font.canonicalPath;
  const bundlePath = canonicalResourceToBundlePath(canonicalPath);
  return new Promise((resolve, reject) => {
    bundle.load(bundlePath, Cocos.Font, (error, font) => {
      if (error !== null && error !== undefined) {
        reject(new Error(`Failed to load Mode Select font: ${error.message}`));
        return;
      }
      if (font === null || font === undefined) {
        reject(new Error(`Creator returned no Mode Select font for ${canonicalPath}`));
        return;
      }
      resolve(font);
    });
  });
}
