import type { ClassicAssetTree } from './resolution-profile-service';
import {
  getLoadingRasterResources,
  type LoadingRasterResource,
} from './loading-resource-contract';

export interface LoadingPoint {
  readonly x: number;
  readonly y: number;
}

export interface LoadingViewport {
  readonly logicalHeight: number;
  readonly logicalWidth: number;
  readonly visibleRect: Readonly<{
    readonly center: LoadingPoint;
  }>;
}

export interface LoadingSpritePresentation {
  readonly anchor: LoadingPoint;
  readonly insertionIndex: number;
  readonly position: LoadingPoint;
  readonly resource: LoadingRasterResource;
}

export interface LoadingPresentation {
  readonly assetTree: ClassicAssetTree;
  readonly backgroundLogo: LoadingSpritePresentation;
  readonly barBack: LoadingSpritePresentation;
  readonly barFront: LoadingSpritePresentation;
  readonly progress: LoadingSpritePresentation;
}

const HALF = Math.fround(0.5);
const QUARTER = Math.fround(0.25);

/** Exact four-sprite `LoadingScene::onEnter()` composition in native insertion order. */
export function createLoadingPresentation(
  assetTree: ClassicAssetTree,
  viewport: LoadingViewport,
): LoadingPresentation {
  assertViewport(viewport);
  const resources = getLoadingRasterResources(assetTree);
  const barY = Math.fround(viewport.logicalHeight * QUARTER);
  const centerX = Math.fround(viewport.visibleRect.center.x);
  return deepFreeze({
    assetTree,
    backgroundLogo: sprite(
      resources.backgroundLogo,
      point(HALF, HALF),
      point(centerX, viewport.visibleRect.center.y),
      0,
    ),
    barBack: sprite(
      resources.barBack,
      point(HALF, HALF),
      point(centerX, barY),
      1,
    ),
    progress: sprite(
      resources.progress,
      point(0, HALF),
      point(
        Math.fround(centerX - Math.fround(resources.progress.dimensions.width * HALF)),
        barY,
      ),
      2,
    ),
    barFront: sprite(
      resources.barFront,
      point(HALF, HALF),
      point(centerX, barY),
      3,
    ),
  });
}

function sprite(
  resource: LoadingRasterResource,
  anchor: LoadingPoint,
  position: LoadingPoint,
  insertionIndex: number,
): LoadingSpritePresentation {
  return {
    anchor,
    insertionIndex,
    position,
    resource,
  };
}

function point(x: number, y: number): LoadingPoint {
  return {
    x: finiteFloat32(x, 'point.x'),
    y: finiteFloat32(y, 'point.y'),
  };
}

function assertViewport(viewport: LoadingViewport): void {
  if (viewport === null || typeof viewport !== 'object') {
    throw new TypeError('viewport must be an object');
  }
  if (
    !Number.isFinite(viewport.logicalWidth)
    || viewport.logicalWidth <= 0
    || !Number.isFinite(viewport.logicalHeight)
    || viewport.logicalHeight <= 0
  ) {
    throw new RangeError('viewport logical dimensions must be positive and finite');
  }
  if (
    viewport.visibleRect === null
    || typeof viewport.visibleRect !== 'object'
    || viewport.visibleRect.center === null
    || typeof viewport.visibleRect.center !== 'object'
  ) {
    throw new TypeError('viewport.visibleRect.center must be an object');
  }
  finiteFloat32(viewport.visibleRect.center.x, 'viewport.visibleRect.center.x');
  finiteFloat32(viewport.visibleRect.center.y, 'viewport.visibleRect.center.y');
}

function finiteFloat32(value: number, label: string): number {
  const floatValue = Math.fround(value);
  if (!Number.isFinite(value) || !Number.isFinite(floatValue)) {
    throw new RangeError(`${label} must be finite in float32`);
  }
  return floatValue;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    deepFreeze(record[key]);
  }
  return Object.freeze(value);
}
