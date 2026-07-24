import * as Cocos from 'cc';

import type { AssetManager, Font } from 'cc';

import {
  canonicalResourceToBundlePath,
  type ClassicRasterResource,
} from '../domain/classic-resource-contract';
import {
  OPTIONS_FONT_CANONICAL_PATH,
  OPTIONS_RASTER_RESOURCE_COUNT,
  getOptionsRasterResources,
  type OptionsRasterProfile,
} from '../domain/options-resource-contract';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import {
  loadExactGameRasters,
  loadGameResourceBundle,
  type LoadedGameRasterResource,
} from './game-resource-loader';

export interface LoadedOptionsResources {
  readonly assetTree: ClassicAssetTree;
  readonly font: Font;
  readonly rasterCount: typeof OPTIONS_RASTER_RESOURCE_COUNT;
  raster(resource: ClassicRasterResource): LoadedGameRasterResource;
}

/** Loads the complete recovered Options surface before its route can be opened. */
export async function loadOptionsResources(
  assetTree: ClassicAssetTree,
): Promise<LoadedOptionsResources> {
  const profile = getOptionsRasterResources(assetTree);
  const rasterContracts = collectOptionsRasterContracts(profile);
  if (rasterContracts.length !== OPTIONS_RASTER_RESOURCE_COUNT) {
    throw new Error(
      `Options must load exactly ${OPTIONS_RASTER_RESOURCE_COUNT} recovered rasters`,
    );
  }
  const bundle = await loadGameResourceBundle();
  const [rasters, font] = await Promise.all([
    loadExactGameRasters(rasterContracts, bundle),
    loadOptionsFont(bundle),
  ]);
  const rastersByPath = new Map<string, LoadedGameRasterResource>();
  for (const raster of rasters) {
    rastersByPath.set(raster.canonicalPath, raster);
  }
  if (rastersByPath.size !== OPTIONS_RASTER_RESOURCE_COUNT) {
    throw new Error('Creator returned an incomplete Options raster catalog');
  }
  return Object.freeze({
    assetTree,
    font,
    rasterCount: OPTIONS_RASTER_RESOURCE_COUNT,
    raster(resource: ClassicRasterResource): LoadedGameRasterResource {
      const loaded = rastersByPath.get(resource.canonicalPath);
      if (loaded === undefined) {
        throw new Error(`Options raster was not loaded: ${resource.canonicalPath}`);
      }
      if (
        loaded.dimensions.width !== resource.dimensions.width
        || loaded.dimensions.height !== resource.dimensions.height
      ) {
        throw new Error(`Options raster contract changed: ${resource.canonicalPath}`);
      }
      return loaded;
    },
  });
}

export function collectOptionsRasterContracts(
  profile: OptionsRasterProfile,
): readonly ClassicRasterResource[] {
  if (profile === null || typeof profile !== 'object') {
    throw new TypeError('Options raster profile must be an object');
  }
  const resources: ClassicRasterResource[] = [];
  const paths = new Set<string>();
  const append = (resource: ClassicRasterResource): void => {
    if (paths.has(resource.canonicalPath)) {
      throw new Error(`Duplicate Options raster contract: ${resource.canonicalPath}`);
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

  append(profile.title);
  append(profile.sectionHeaders.background);
  append(profile.sectionHeaders.blade);
  append(profile.sectionHeaders.theme);
  append(profile.selectorBackground);
  appendPair(profile.previous);
  appendPair(profile.next);
  appendPair(profile.back);
  appendPair(profile.buy);
  append(profile.totalCoinsPanel);
  append(profile.purchaseParticle);
  for (const resource of profile.themeIcons) {
    append(resource);
  }
  for (const resource of profile.bladeIcons) {
    append(resource);
  }
  for (const resource of profile.backgroundIcons) {
    append(resource);
  }

  if (resources.length !== OPTIONS_RASTER_RESOURCE_COUNT) {
    throw new Error('Options raster profile does not contain exactly 51 resources');
  }
  return Object.freeze(resources);
}

function loadOptionsFont(bundle: AssetManager.Bundle): Promise<Font> {
  const bundlePath = canonicalResourceToBundlePath(OPTIONS_FONT_CANONICAL_PATH);
  return new Promise((resolve, reject) => {
    bundle.load(bundlePath, Cocos.Font, (error, font) => {
      if (error !== null && error !== undefined) {
        reject(new Error(`Failed to load Options font: ${error.message}`));
        return;
      }
      if (font === null || font === undefined) {
        reject(new Error(`Creator returned no Options font for ${OPTIONS_FONT_CANONICAL_PATH}`));
        return;
      }
      resolve(font);
    });
  });
}
