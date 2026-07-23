import { getBaseGameplayResourceProfile } from './base-gameplay-resource-contract';
import type { BirdBladeType } from './bird-blade-state';
import {
  assertGameAssetTree,
  createGameRaster,
  type GameAssetTree,
  type GameRasterResource,
} from './game-resource-contract';

export type BirdAnimationFrameResources = readonly [
  GameRasterResource,
  GameRasterResource,
  GameRasterResource,
  GameRasterResource,
  GameRasterResource,
  GameRasterResource,
  GameRasterResource,
  GameRasterResource,
  GameRasterResource,
  GameRasterResource,
];

/** Indexed by the recovered inclusive particle selection result, 0 through 3. */
export type BirdParticleResources = readonly [
  GameRasterResource,
  GameRasterResource,
  GameRasterResource,
  GameRasterResource,
];

export interface BirdResourceProfile {
  readonly animationFrames: BirdAnimationFrameResources;
  readonly blade: GameRasterResource;
  readonly birdType: BirdBladeType;
  readonly leftDirection: GameRasterResource;
  readonly particles: BirdParticleResources;
  readonly rightDirection: GameRasterResource;
}

export const BIRD_ANIMATION_FRAME_COUNT = 10 as const;
export const BIRD_PARTICLE_RESOURCE_COUNT = 4 as const;
export const BIRD_SHARED_RASTER_RESOURCE_COUNT = 5 as const;
export const BIRD_TYPE_SPECIFIC_RASTER_RESOURCE_COUNT = 12 as const;
export const BIRD_RASTER_RESOURCE_COUNT = 17 as const;
/** Unique union of both 17-raster profiles: five shared plus twelve per type. */
export const BIRD_COMBINED_RASTER_RESOURCE_COUNT = 29 as const;

const BIRD_ANIMATION_FRAME_DIMENSIONS = {
  '480x800': [
    [140, 116],
    [138, 118],
    [138, 122],
    [138, 118],
    [140, 116],
    [139, 111],
    [137, 108],
    [130, 104],
    [137, 108],
    [139, 111],
  ],
  '720x1280': [
    [172, 138],
    [171, 141],
    [171, 146],
    [172, 142],
    [172, 138],
    [172, 130],
    [168, 129],
    [159, 129],
    [168, 129],
    [172, 130],
  ],
} as const satisfies Readonly<
  Record<GameAssetTree, readonly (readonly [number, number])[]>
>;

const BIRD_DIRECTION_DIMENSIONS = {
  '480x800': {
    1: {
      left: [110, 102],
      right: [110, 102],
    },
    2: {
      left: [110, 101],
      right: [111, 101],
    },
  },
  '720x1280': {
    1: {
      left: [129, 116],
      right: [129, 116],
    },
    2: {
      left: [129, 115],
      right: [129, 115],
    },
  },
} as const satisfies Readonly<
  Record<
  GameAssetTree,
  Readonly<
  Record<
  BirdBladeType,
  Readonly<{
    readonly left: readonly [number, number];
    readonly right: readonly [number, number];
  }>
  >
  >
  >
>;

export const BIRD_RESOURCE_PROFILES_BY_TYPE: Readonly<
Record<GameAssetTree, Readonly<Record<BirdBladeType, BirdResourceProfile>>>
> = Object.freeze({
  '480x800': createBirdResourceProfiles('480x800'),
  '720x1280': createBirdResourceProfiles('720x1280'),
});

/**
 * Backward-compatible Classic Bird profile map. Explicit type selection uses
 * BIRD_RESOURCE_PROFILES_BY_TYPE or getBirdResourceProfile's second argument.
 */
export const BIRD_RESOURCE_PROFILES: Readonly<
Record<GameAssetTree, BirdResourceProfile>
> = Object.freeze({
  '480x800': BIRD_RESOURCE_PROFILES_BY_TYPE['480x800'][1],
  '720x1280': BIRD_RESOURCE_PROFILES_BY_TYPE['720x1280'][1],
});

export function getBirdResourceProfile(
  assetTree: GameAssetTree,
  birdType: BirdBladeType = 1,
): BirdResourceProfile {
  assertGameAssetTree(assetTree);
  return BIRD_RESOURCE_PROFILES_BY_TYPE[assetTree][
    resolveBirdBladeType(birdType)
  ];
}

/**
 * Returns the exact load order used by the BirdBlade consumer:
 * blade, animation frames 0-9, left/right direction sprites, then particle
 * selection results 0-3.
 */
export function listBirdRasterResources(
  assetTree: GameAssetTree,
  birdType: BirdBladeType = 1,
): readonly GameRasterResource[] {
  const profile = getBirdResourceProfile(assetTree, birdType);
  const resources = [
    profile.blade,
    ...profile.animationFrames,
    profile.leftDirection,
    profile.rightDirection,
    ...profile.particles,
  ];
  if (resources.length !== BIRD_RASTER_RESOURCE_COUNT) {
    throw new Error('Bird raster contract has an invalid cardinality');
  }
  if (new Set(resources.map(({ canonicalPath }) => canonicalPath)).size !== resources.length) {
    throw new Error('Bird raster contract contains duplicate canonical paths');
  }
  return Object.freeze(resources);
}

export function getBirdAnimationFrameResource(
  frameIndex: number,
  assetTree: GameAssetTree,
  birdType: BirdBladeType = 1,
): GameRasterResource {
  const profile = getBirdResourceProfile(assetTree, birdType);
  if (
    !Number.isSafeInteger(frameIndex)
    || frameIndex < 0
    || frameIndex >= BIRD_ANIMATION_FRAME_COUNT
  ) {
    throw new RangeError('frameIndex must identify a Bird animation frame from 0 through 9');
  }
  const resource = profile.animationFrames[frameIndex];
  if (resource === undefined) {
    throw new Error(`Bird animation-frame contract is incomplete for index ${frameIndex}`);
  }
  return resource;
}

export function getBirdParticleResource(
  selection: number,
  assetTree: GameAssetTree,
  birdType: BirdBladeType = 1,
): GameRasterResource {
  const profile = getBirdResourceProfile(assetTree, birdType);
  if (
    !Number.isSafeInteger(selection)
    || selection < 0
    || selection >= BIRD_PARTICLE_RESOURCE_COUNT
  ) {
    throw new RangeError('selection must identify a Bird particle from 0 through 3');
  }
  const resource = profile.particles[selection];
  if (resource === undefined) {
    throw new Error(`Bird particle contract is incomplete for selection ${selection}`);
  }
  return resource;
}

interface BirdSharedRasterResources {
  readonly blade: GameRasterResource;
  readonly particles: BirdParticleResources;
}

function createBirdResourceProfiles(
  assetTree: GameAssetTree,
): Readonly<Record<BirdBladeType, BirdResourceProfile>> {
  const shared = createBirdSharedRasterResources(assetTree);
  return Object.freeze({
    1: createBirdResourceProfile(assetTree, 1, shared),
    2: createBirdResourceProfile(assetTree, 2, shared),
  });
}

function createBirdResourceProfile(
  assetTree: GameAssetTree,
  birdType: BirdBladeType,
  shared: BirdSharedRasterResources,
): BirdResourceProfile {
  const animationFrames = Object.freeze(
    BIRD_ANIMATION_FRAME_DIMENSIONS[assetTree].map((dimensions, frameIndex) => (
      createGameRaster(
        `${assetTree}/Birds/bird-anim-${birdType}-${frameIndex}.png`,
        dimensions,
      )
    )),
  ) as BirdAnimationFrameResources;
  const directionDimensions = BIRD_DIRECTION_DIMENSIONS[assetTree][birdType];

  return Object.freeze({
    animationFrames,
    blade: shared.blade,
    birdType,
    leftDirection: createGameRaster(
      `${assetTree}/Birds/bird-left-${birdType}.png`,
      directionDimensions.left,
    ),
    particles: shared.particles,
    rightDirection: createGameRaster(
      `${assetTree}/Birds/bird-right-${birdType}.png`,
      directionDimensions.right,
    ),
  });
}

function createBirdSharedRasterResources(
  assetTree: GameAssetTree,
): BirdSharedRasterResources {
  const sharedAchievement = getBaseGameplayResourceProfile(
    assetTree,
  ).objectiveAchievement;
  const particles = Object.freeze([
    sharedAchievement.xmasFive,
    sharedAchievement.xmasFour,
    createGameRaster(
      `${assetTree}/Blades/Particles/X-Mas/xmashexa.png`,
      assetTree === '480x800' ? [32, 36] : [47, 53],
    ),
    createGameRaster(
      `${assetTree}/Blades/Particles/X-Mas/xmascircle.png`,
      assetTree === '480x800' ? [34, 34] : [49, 50],
    ),
  ]) as BirdParticleResources;

  return Object.freeze({
    blade: createGameRaster(
      `${assetTree}/Blades/testblade7.png`,
      [64, 65],
    ),
    particles,
  });
}

function resolveBirdBladeType(birdType: BirdBladeType): BirdBladeType {
  if (!Number.isSafeInteger(birdType)) {
    throw new TypeError('birdType must be a safe integer');
  }
  if (birdType !== 1 && birdType !== 2) {
    throw new RangeError('birdType must be 1 or 2');
  }
  return birdType;
}
