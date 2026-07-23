export type GameAssetTree = '480x800' | '720x1280';

export interface GameRasterDimensions {
  readonly height: number;
  readonly width: number;
}

export interface GameRasterResource {
  readonly canonicalPath: string;
  readonly dimensions: GameRasterDimensions;
}

export interface GameFontResource {
  readonly canonicalPath: string;
}

export function assertGameAssetTree(value: string): asserts value is GameAssetTree {
  if (value !== '480x800' && value !== '720x1280') {
    throw new RangeError('assetTree must be 480x800 or 720x1280');
  }
}

export function createGameRaster(
  canonicalPath: string,
  dimensions: readonly [number, number],
): GameRasterResource {
  assertCanonicalResourcePath(canonicalPath);
  const [width, height] = dimensions;
  if (
    !Number.isSafeInteger(width)
    || width <= 0
    || !Number.isSafeInteger(height)
    || height <= 0
  ) {
    throw new RangeError('raster dimensions must be positive safe integers');
  }
  return Object.freeze({
    canonicalPath,
    dimensions: Object.freeze({ height, width }),
  });
}

export function canonicalResourceToBundlePath(canonicalPath: string): string {
  assertCanonicalResourcePath(canonicalPath);
  const extensionIndex = canonicalPath.lastIndexOf('.');
  if (extensionIndex <= canonicalPath.lastIndexOf('/')) {
    throw new RangeError('canonicalPath must include an asset extension');
  }
  return canonicalPath.slice(0, extensionIndex);
}

export function canonicalRasterToSpriteFrameBundlePath(canonicalPath: string): string {
  return `${canonicalResourceToBundlePath(canonicalPath)}/spriteFrame`;
}

function assertCanonicalResourcePath(canonicalPath: string): void {
  if (typeof canonicalPath !== 'string' || canonicalPath.length === 0) {
    throw new TypeError('canonicalPath must be a non-empty string');
  }
  if (
    canonicalPath.startsWith('/')
    || canonicalPath.includes('\\')
    || canonicalPath.split('/').some((segment) => segment === '..')
  ) {
    throw new RangeError('canonicalPath must remain a normalized bundle-relative path');
  }
}
