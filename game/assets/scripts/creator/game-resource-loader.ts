import {
  AssetManager,
  SpriteFrame,
  assetManager,
} from 'cc';

import {
  canonicalRasterToSpriteFrameBundlePath,
  type GameRasterResource,
} from '../domain/game-resource-contract';

export const GAME_RESOURCE_BUNDLE_NAME = 'game';

export interface LoadedGameRasterResource extends GameRasterResource {
  readonly spriteFrame: SpriteFrame;
}

export function loadGameResourceBundle(): Promise<AssetManager.Bundle> {
  const loaded = assetManager.getBundle(GAME_RESOURCE_BUNDLE_NAME);
  if (loaded !== null) {
    return Promise.resolve(loaded);
  }
  return new Promise((resolve, reject) => {
    assetManager.loadBundle(GAME_RESOURCE_BUNDLE_NAME, (error, bundle) => {
      if (error !== null && error !== undefined) {
        reject(new Error(`Failed to load ${GAME_RESOURCE_BUNDLE_NAME} bundle: ${error.message}`));
        return;
      }
      if (bundle === null || bundle === undefined) {
        reject(new Error(`Creator returned no ${GAME_RESOURCE_BUNDLE_NAME} bundle`));
        return;
      }
      resolve(bundle);
    });
  });
}

export async function loadExactGameRasters(
  resources: readonly GameRasterResource[],
  bundle?: AssetManager.Bundle,
): Promise<readonly LoadedGameRasterResource[]> {
  if (!Array.isArray(resources) || resources.length === 0) {
    throw new RangeError('resources must contain at least one recovered raster');
  }
  const uniquePaths = new Set(resources.map(({ canonicalPath }) => canonicalPath));
  if (uniquePaths.size !== resources.length) {
    throw new Error('Recovered raster batch contains duplicate canonical paths');
  }
  const loadedBundle = bundle ?? await loadGameResourceBundle();
  const paths = resources.map(({ canonicalPath }) => (
    canonicalRasterToSpriteFrameBundlePath(canonicalPath)
  ));
  const frames = await loadSpriteFrames(loadedBundle, paths);
  return Object.freeze(resources.map((resource, index) => {
    const spriteFrame = frames[index];
    if (spriteFrame === undefined) {
      throw new Error(`Creator omitted SpriteFrame ${resource.canonicalPath}`);
    }
    assertExactSpriteFrameGeometry(spriteFrame, resource);
    return Object.freeze({ ...resource, spriteFrame });
  }));
}

export function assertExactSpriteFrameGeometry(
  spriteFrame: SpriteFrame,
  resource: GameRasterResource,
): void {
  const original = spriteFrame.originalSize;
  const rect = spriteFrame.rect;
  if (
    original.width !== resource.dimensions.width
    || original.height !== resource.dimensions.height
    || rect.width !== resource.dimensions.width
    || rect.height !== resource.dimensions.height
  ) {
    throw new Error(
      `Creator SpriteFrame geometry mismatch for ${resource.canonicalPath}: `
      + `expected ${resource.dimensions.width}x${resource.dimensions.height}, `
      + `got original ${original.width}x${original.height} and rect ${rect.width}x${rect.height}`,
    );
  }
}

function loadSpriteFrames(
  bundle: AssetManager.Bundle,
  paths: string[],
): Promise<readonly SpriteFrame[]> {
  return new Promise((resolve, reject) => {
    bundle.load(paths, SpriteFrame, (error, spriteFrames) => {
      if (error !== null && error !== undefined) {
        reject(new Error(`Failed to load recovered SpriteFrames: ${error.message}`));
        return;
      }
      if (spriteFrames === null || spriteFrames === undefined) {
        reject(new Error('Creator returned no recovered SpriteFrames'));
        return;
      }
      resolve(Object.freeze([...spriteFrames]));
    });
  });
}
