import { getBaseGameplayResourceProfile } from './base-gameplay-resource-contract';
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
  readonly leftDirection: GameRasterResource;
  readonly particles: BirdParticleResources;
  readonly rightDirection: GameRasterResource;
}

export const BIRD_ANIMATION_FRAME_COUNT = 10 as const;
export const BIRD_PARTICLE_RESOURCE_COUNT = 4 as const;
export const BIRD_RASTER_RESOURCE_COUNT = 17 as const;

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

export const BIRD_RESOURCE_PROFILES: Readonly<
Record<GameAssetTree, BirdResourceProfile>
> = Object.freeze({
  '480x800': createBirdResourceProfile('480x800'),
  '720x1280': createBirdResourceProfile('720x1280'),
});

export function getBirdResourceProfile(
  assetTree: GameAssetTree,
): BirdResourceProfile {
  assertGameAssetTree(assetTree);
  return BIRD_RESOURCE_PROFILES[assetTree];
}

/**
 * Returns the exact load order used by the BirdBlade consumer:
 * blade, animation frames 0-9, left/right direction sprites, then particle
 * selection results 0-3.
 */
export function listBirdRasterResources(
  assetTree: GameAssetTree,
): readonly GameRasterResource[] {
  const profile = getBirdResourceProfile(assetTree);
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
): GameRasterResource {
  const profile = getBirdResourceProfile(assetTree);
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
): GameRasterResource {
  const profile = getBirdResourceProfile(assetTree);
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

function createBirdResourceProfile(assetTree: GameAssetTree): BirdResourceProfile {
  const animationFrames = Object.freeze(
    BIRD_ANIMATION_FRAME_DIMENSIONS[assetTree].map((dimensions, frameIndex) => (
      createGameRaster(
        `${assetTree}/Birds/bird-anim-1-${frameIndex}.png`,
        dimensions,
      )
    )),
  ) as BirdAnimationFrameResources;
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
    animationFrames,
    blade: createGameRaster(
      `${assetTree}/Blades/testblade7.png`,
      [64, 65],
    ),
    leftDirection: createGameRaster(
      `${assetTree}/Birds/bird-left-1.png`,
      assetTree === '480x800' ? [110, 102] : [129, 116],
    ),
    particles,
    rightDirection: createGameRaster(
      `${assetTree}/Birds/bird-right-1.png`,
      assetTree === '480x800' ? [110, 102] : [129, 116],
    ),
  });
}
