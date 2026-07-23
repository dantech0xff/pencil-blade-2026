import * as Cocos from 'cc';

import {
  type AssetManager,
  type Font,
} from 'cc';

import {
  BASE_GAMEPLAY_ARIAL_FONT_RESOURCE,
  getBaseGameplayResourceProfile,
  listBaseGameplayRasterResources,
} from '../domain/base-gameplay-resource-contract';
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

export interface LoadedBaseGameplayPauseResources {
  readonly objectiveBackground: LoadedGameRasterResource;
  readonly pauseNormal: LoadedGameRasterResource;
  readonly pauseSelected: LoadedGameRasterResource;
  readonly quitNormal: LoadedGameRasterResource;
  readonly quitSelected: LoadedGameRasterResource;
  readonly replayNormal: LoadedGameRasterResource;
  readonly replaySelected: LoadedGameRasterResource;
  readonly resumeNormal: LoadedGameRasterResource;
  readonly resumeSelected: LoadedGameRasterResource;
}

export interface LoadedObjectiveAchievementResources {
  readonly completedMessage: LoadedGameRasterResource;
  readonly nextMessage: LoadedGameRasterResource;
  readonly xmasFive: LoadedGameRasterResource;
  readonly xmasFour: LoadedGameRasterResource;
}

export interface LoadedBaseGameplayResources {
  readonly arialFont: Readonly<{
    readonly canonicalPath: typeof BASE_GAMEPLAY_ARIAL_FONT_RESOURCE.canonicalPath;
    readonly font: Font;
  }>;
  readonly assetTree: GameAssetTree;
  readonly objectiveAchievement: LoadedObjectiveAchievementResources;
  readonly pause: LoadedBaseGameplayPauseResources;
}

export async function loadBaseGameplayResources(
  assetTree: GameAssetTree,
): Promise<LoadedBaseGameplayResources> {
  const profile = getBaseGameplayResourceProfile(assetTree);
  const rasterContracts = listBaseGameplayRasterResources(assetTree);
  const bundle = await loadGameResourceBundle();
  const [rasters, font] = await Promise.all([
    loadExactGameRasters(rasterContracts, bundle),
    loadArialFont(bundle),
  ]);
  const byPath = new Map(
    rasters.map((resource) => [resource.canonicalPath, resource]),
  );

  return Object.freeze({
    arialFont: Object.freeze({
      canonicalPath: BASE_GAMEPLAY_ARIAL_FONT_RESOURCE.canonicalPath,
      font,
    }),
    assetTree,
    objectiveAchievement: Object.freeze({
      completedMessage: requireLoadedRaster(
        profile.objectiveAchievement.completedMessage,
        byPath,
      ),
      nextMessage: requireLoadedRaster(
        profile.objectiveAchievement.nextMessage,
        byPath,
      ),
      xmasFive: requireLoadedRaster(
        profile.objectiveAchievement.xmasFive,
        byPath,
      ),
      xmasFour: requireLoadedRaster(
        profile.objectiveAchievement.xmasFour,
        byPath,
      ),
    }),
    pause: Object.freeze({
      objectiveBackground: requireLoadedRaster(
        profile.pause.objectiveBackground,
        byPath,
      ),
      pauseNormal: requireLoadedRaster(profile.pause.pauseNormal, byPath),
      pauseSelected: requireLoadedRaster(profile.pause.pauseSelected, byPath),
      quitNormal: requireLoadedRaster(profile.pause.quitNormal, byPath),
      quitSelected: requireLoadedRaster(profile.pause.quitSelected, byPath),
      replayNormal: requireLoadedRaster(profile.pause.replayNormal, byPath),
      replaySelected: requireLoadedRaster(profile.pause.replaySelected, byPath),
      resumeNormal: requireLoadedRaster(profile.pause.resumeNormal, byPath),
      resumeSelected: requireLoadedRaster(profile.pause.resumeSelected, byPath),
    }),
  });
}

function loadArialFont(bundle: AssetManager.Bundle): Promise<Font> {
  const bundlePath = canonicalResourceToBundlePath(
    BASE_GAMEPLAY_ARIAL_FONT_RESOURCE.canonicalPath,
  );
  return new Promise((resolve, reject) => {
    bundle.load(bundlePath, Cocos.Font, (error, font) => {
      if (error !== null && error !== undefined) {
        reject(new Error(`Failed to load recovered Arial font: ${error.message}`));
        return;
      }
      if (font === null || font === undefined) {
        reject(new Error('Creator returned no recovered Arial font'));
        return;
      }
      resolve(font);
    });
  });
}

function requireLoadedRaster(
  contract: GameRasterResource,
  loadedByPath: ReadonlyMap<string, LoadedGameRasterResource>,
): LoadedGameRasterResource {
  const loaded = loadedByPath.get(contract.canonicalPath);
  if (loaded === undefined) {
    throw new Error(`Creator omitted base-gameplay raster ${contract.canonicalPath}`);
  }
  return loaded;
}
