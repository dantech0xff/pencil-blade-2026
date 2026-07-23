import * as Cocos from 'cc';

import type { AssetManager, Font } from 'cc';

import {
  canonicalResourceToBundlePath,
  type ClassicRasterResource,
} from '../domain/classic-resource-contract';
import {
  MAIN_MENU_SHARED_RESOURCES,
  getMainMenuRasterResources,
} from '../domain/main-menu-resource-contract';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import {
  loadExactGameRasters,
  loadGameResourceBundle,
  type LoadedGameRasterResource,
} from './game-resource-loader';

export interface LoadedMainMenuResources {
  readonly assetTree: ClassicAssetTree;
  readonly font: Font;
  raster(resource: ClassicRasterResource): LoadedGameRasterResource;
}

/** Loads every statically accepted Main Menu raster plus its exact SlabThing font. */
export async function loadMainMenuResources(
  assetTree: ClassicAssetTree,
): Promise<LoadedMainMenuResources> {
  const profile = getMainMenuRasterResources(assetTree);
  const rasterContracts = collectMainMenuRasterContracts(profile);
  const bundle = await loadGameResourceBundle();
  const [rasters, font] = await Promise.all([
    loadExactGameRasters(rasterContracts, bundle),
    loadMainMenuFont(bundle),
  ]);
  const rastersByPath = new Map<string, LoadedGameRasterResource>();
  for (const raster of rasters) {
    rastersByPath.set(raster.canonicalPath, raster);
  }
  return Object.freeze({
    assetTree,
    font,
    raster(resource: ClassicRasterResource): LoadedGameRasterResource {
      const loaded = rastersByPath.get(resource.canonicalPath);
      if (loaded === undefined) {
        throw new Error(`Main Menu raster was not loaded: ${resource.canonicalPath}`);
      }
      if (
        loaded.dimensions.width !== resource.dimensions.width
        || loaded.dimensions.height !== resource.dimensions.height
      ) {
        throw new Error(`Main Menu raster contract changed: ${resource.canonicalPath}`);
      }
      return loaded;
    },
  });
}

function collectMainMenuRasterContracts(
  profile: ReturnType<typeof getMainMenuRasterResources>,
): readonly ClassicRasterResource[] {
  const resources: ClassicRasterResource[] = [];
  const paths = new Set<string>();
  const append = (resource: ClassicRasterResource): void => {
    if (paths.has(resource.canonicalPath)) {
      throw new Error(`Duplicate Main Menu raster contract: ${resource.canonicalPath}`);
    }
    paths.add(resource.canonicalPath);
    resources.push(resource);
  };
  const appendPair = (pair: {
    readonly normal: ClassicRasterResource;
    readonly selected: ClassicRasterResource;
  }): void => {
    append(pair.normal);
    append(pair.selected);
  };
  const appendToggle = (toggle: {
    readonly disabled: ClassicRasterResource;
    readonly normal: ClassicRasterResource;
    readonly selected: ClassicRasterResource;
  }): void => {
    append(toggle.normal);
    append(toggle.selected);
    append(toggle.disabled);
  };
  const appendFruit = (fruit: {
    readonly cutBottom: ClassicRasterResource;
    readonly cutTop: ClassicRasterResource;
    readonly intact: ClassicRasterResource;
  }): void => {
    append(fruit.intact);
    append(fruit.cutBottom);
    append(fruit.cutTop);
  };

  append(profile.pencilBladeBackground);
  append(profile.pencilBlade);
  append(profile.totalCoinsPanel);
  appendPair(profile.about);
  appendPair(profile.review);
  appendToggle(profile.musicToggle);
  appendToggle(profile.effectsToggle);
  appendPair(profile.blueWheelOptions);
  appendPair(profile.exit);
  append(profile.orangeWheel);
  append(profile.blackWheel);
  append(profile.circles.blur);
  append(profile.circles.leaderboard);
  append(profile.circles.objectives);
  append(profile.circles.newGame);
  appendFruit(profile.fruits.electricApple);
  appendFruit(profile.fruits.orange);
  appendFruit(profile.fruits.strawberry);
  append(profile.heart);
  return Object.freeze(resources);
}

function loadMainMenuFont(bundle: AssetManager.Bundle): Promise<Font> {
  const canonicalPath = MAIN_MENU_SHARED_RESOURCES.font.canonicalPath;
  const bundlePath = canonicalResourceToBundlePath(canonicalPath);
  return new Promise((resolve, reject) => {
    bundle.load(bundlePath, Cocos.Font, (error, font) => {
      if (error !== null && error !== undefined) {
        reject(new Error(`Failed to load Main Menu font: ${error.message}`));
        return;
      }
      if (font === null || font === undefined) {
        reject(new Error(`Creator returned no Main Menu font for ${canonicalPath}`));
        return;
      }
      resolve(font);
    });
  });
}
