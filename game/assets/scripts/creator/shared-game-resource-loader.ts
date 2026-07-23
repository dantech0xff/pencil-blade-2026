import {
  SHARED_BACKGROUND_RESOURCES,
  SHARED_LEAF_RESOURCES,
  SHARED_THEME_RESOURCES,
} from '../domain/shared-game-scene-resources';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import {
  loadExactGameRasters,
  loadGameResourceBundle,
  type LoadedGameRasterResource,
} from './game-resource-loader';

export interface LoadedSharedGameSceneResources {
  readonly assetTree: ClassicAssetTree;
  readonly backgrounds: readonly LoadedGameRasterResource[];
  readonly leaves: readonly LoadedGameRasterResource[];
  readonly themes: readonly LoadedGameRasterResource[];
}

export async function loadSharedGameSceneResources(
  assetTree: ClassicAssetTree,
): Promise<LoadedSharedGameSceneResources> {
  assertAssetTree(assetTree);
  const backgrounds = SHARED_BACKGROUND_RESOURCES[assetTree];
  const leaves = SHARED_LEAF_RESOURCES.map(({ rasters }) => rasters[assetTree]);
  const themes = SHARED_THEME_RESOURCES[assetTree];
  const contracts = Object.freeze([...backgrounds, ...leaves, ...themes]);
  const bundle = await loadGameResourceBundle();
  const loaded = await loadExactGameRasters(contracts, bundle);
  const backgroundEnd = backgrounds.length;
  const leafEnd = backgroundEnd + leaves.length;
  return Object.freeze({
    assetTree,
    backgrounds: freezeLoadedSlice(loaded, 0, backgroundEnd),
    leaves: freezeLoadedSlice(loaded, backgroundEnd, leafEnd),
    themes: freezeLoadedSlice(loaded, leafEnd, loaded.length),
  });
}

function freezeLoadedSlice(
  resources: readonly LoadedGameRasterResource[],
  start: number,
  end: number,
): readonly LoadedGameRasterResource[] {
  return Object.freeze(resources.slice(start, end));
}

function assertAssetTree(assetTree: ClassicAssetTree): void {
  if (assetTree !== '480x800' && assetTree !== '720x1280') {
    throw new RangeError('assetTree must be 480x800 or 720x1280');
  }
}
