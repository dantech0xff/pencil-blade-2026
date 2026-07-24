import type { GameRasterResource } from './game-resource-contract';
import type { ClassicAssetTree } from './resolution-profile-service';

export const STANDARD_BLADE_COUNT = 18 as const;
export const STANDARD_BASIC_BLADE_COUNT = 13 as const;
export const STANDARD_DRAGON_BLADE_BODY_SEGMENT_COUNT = 15 as const;
export const STANDARD_CENTIPEDE_BLADE_BODY_SEGMENT_COUNT = 20 as const;
export const STANDARD_ADVANCED_BLADE_POINT_CAPACITY = 32 as const;
export const STANDARD_BLADE_RASTER_RESOURCE_COUNT = 50 as const;

export type StandardBladeId =
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17;
export type StandardBasicBladeId =
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type StandardParticleBladeId = 7 | 8 | 9 | 10 | 11 | 12;
export type StandardDragonBladeId = 13 | 14 | 15 | 16;
export type StandardDragonBladeVariant = 0 | 1 | 2 | 3;

export type StandardBladeParticleLogicalPath =
  | 'Blades/Particles/VN Flag/vnflagstar.png'
  | 'Blades/Particles/Ice/snowflake.png'
  | 'Blades/Particles/Ice/star.png'
  | 'Blades/Particles/Ice/circle.png'
  | 'Blades/Particles/X-Mas/xmasfive.png'
  | 'Blades/Particles/X-Mas/xmasfour.png'
  | 'Blades/Particles/X-Mas/xmashexa.png'
  | 'Blades/Particles/X-Mas/xmascircle.png'
  | 'Blades/Particles/Butterfly/butterfly0.png'
  | 'Blades/Particles/Butterfly/butterfly1.png'
  | 'Blades/Particles/Butterfly/butterfly2.png'
  | 'Blades/Particles/Butterfly/butterfly3.png'
  | 'Blades/Particles/Butterfly/butterfly4.png'
  | 'Blades/Particles/Butterfly/butterfly5.png'
  | 'Blades/Particles/Fire/firecircle.png'
  | 'Blades/Particles/Fire/fireparticle.png'
  | 'Blades/Particles/Fire/smoke.png'
  | 'Blades/Particles/Rainbow/rainbowstar0.png'
  | 'Blades/Particles/Rainbow/rainbowstar1.png'
  | 'Blades/Particles/Rainbow/rainbowstar2.png'
  | 'Blades/Particles/Rainbow/rainbowstar3.png'
  | 'Blades/Particles/Rainbow/rainbowstar4.png';

export interface StandardBladeMultipartResources {
  readonly body: GameRasterResource;
  readonly bodySegmentCount: 15 | 20;
  readonly head: GameRasterResource;
  readonly pointCapacity: 32;
  readonly tail: GameRasterResource;
}

export type StandardBladeResourceProfile =
  | Readonly<{
      readonly bladeId: StandardBasicBladeId;
      readonly kind: 'basic';
      readonly particles: readonly GameRasterResource[];
      readonly texture: GameRasterResource;
    }>
  | Readonly<{
      readonly bladeId: StandardDragonBladeId;
      readonly kind: 'dragon';
      readonly particles: readonly [];
      readonly resources: StandardBladeMultipartResources;
      readonly variant: StandardDragonBladeVariant;
    }>
  | Readonly<{
      readonly bladeId: 17;
      readonly kind: 'centipede';
      readonly particles: readonly [];
      readonly resources: StandardBladeMultipartResources;
    }>;

/**
 * The compact package uses different filenames for IDs 11 and 12, but the bytes are identical
 * to the native-path files in the high-resolution tree. The reconstruction keeps the source
 * filenames and records this compatibility mapping instead of silently renaming either asset.
 */
export const STANDARD_BLADE_COMPACT_COMPATIBILITY_ALIASES = deepFreeze({
  11: {
    aliasLogicalPath: 'Blades/firebladetexture.png',
    nativeLogicalPath: 'Blades/blade11.png',
    sha256: '0661deecf72097a81f8d463bb5a568d08592136d78d9a99bf3e5696d99a380c2',
  },
  12: {
    aliasLogicalPath: 'Blades/rainbow.png',
    nativeLogicalPath: 'Blades/blade12.png',
    sha256: '6d91f914f595d766a94afeb8acf8dee00a53365de03b48d76e405b4a65e26d31',
  },
});

const BASIC_LOGICAL_PATHS: Readonly<Record<ClassicAssetTree, readonly string[]>> = deepFreeze({
  '480x800': [
    'Blades/blade0.png',
    'Blades/blade1.png',
    'Blades/blade2.png',
    'Blades/blade3.png',
    'Blades/blade4.png',
    'Blades/blade5.png',
    'Blades/blade6.png',
    'Blades/blade7.png',
    'Blades/blade8.png',
    'Blades/blade9.png',
    'Blades/blade10.png',
    STANDARD_BLADE_COMPACT_COMPATIBILITY_ALIASES[11].aliasLogicalPath,
    STANDARD_BLADE_COMPACT_COMPATIBILITY_ALIASES[12].aliasLogicalPath,
  ],
  '720x1280': Array.from(
    { length: STANDARD_BASIC_BLADE_COUNT },
    (_, index) => `Blades/blade${index}.png`,
  ),
});

const PARTICLE_LOGICAL_PATHS_BY_ID: Readonly<
  Record<StandardParticleBladeId, readonly StandardBladeParticleLogicalPath[]>
> = deepFreeze({
  7: ['Blades/Particles/VN Flag/vnflagstar.png'],
  8: [
    'Blades/Particles/Ice/snowflake.png',
    'Blades/Particles/Ice/star.png',
    'Blades/Particles/Ice/circle.png',
  ],
  9: [
    'Blades/Particles/X-Mas/xmasfive.png',
    'Blades/Particles/X-Mas/xmasfour.png',
    'Blades/Particles/X-Mas/xmashexa.png',
    'Blades/Particles/X-Mas/xmascircle.png',
  ],
  10: Array.from(
    { length: 6 },
    (_, index) => (
      `Blades/Particles/Butterfly/butterfly${index}.png`
    ) as StandardBladeParticleLogicalPath,
  ),
  11: [
    'Blades/Particles/Fire/firecircle.png',
    'Blades/Particles/Fire/fireparticle.png',
    'Blades/Particles/Fire/smoke.png',
  ],
  12: Array.from(
    { length: 5 },
    (_, index) => (
      `Blades/Particles/Rainbow/rainbowstar${index}.png`
    ) as StandardBladeParticleLogicalPath,
  ),
});

const PARTICLE_DIMENSIONS: Readonly<Record<
  StandardBladeParticleLogicalPath,
  Readonly<Record<ClassicAssetTree, readonly [number, number]>>
>> = deepFreeze({
  'Blades/Particles/VN Flag/vnflagstar.png': {
    '480x800': [54, 52],
    '720x1280': [78, 74],
  },
  'Blades/Particles/Ice/snowflake.png': {
    '480x800': [51, 54],
    '720x1280': [76, 82],
  },
  'Blades/Particles/Ice/star.png': {
    '480x800': [50, 51],
    '720x1280': [74, 76],
  },
  'Blades/Particles/Ice/circle.png': {
    '480x800': [36, 36],
    '720x1280': [55, 55],
  },
  'Blades/Particles/X-Mas/xmasfive.png': {
    '480x800': [46, 44],
    '720x1280': [66, 64],
  },
  'Blades/Particles/X-Mas/xmasfour.png': {
    '480x800': [51, 59],
    '720x1280': [70, 83],
  },
  'Blades/Particles/X-Mas/xmashexa.png': {
    '480x800': [32, 36],
    '720x1280': [47, 53],
  },
  'Blades/Particles/X-Mas/xmascircle.png': {
    '480x800': [34, 34],
    '720x1280': [49, 50],
  },
  'Blades/Particles/Butterfly/butterfly0.png': {
    '480x800': [64, 49],
    '720x1280': [86, 66],
  },
  'Blades/Particles/Butterfly/butterfly1.png': {
    '480x800': [64, 49],
    '720x1280': [87, 66],
  },
  'Blades/Particles/Butterfly/butterfly2.png': {
    '480x800': [61, 46],
    '720x1280': [84, 64],
  },
  'Blades/Particles/Butterfly/butterfly3.png': {
    '480x800': [64, 48],
    '720x1280': [86, 63],
  },
  'Blades/Particles/Butterfly/butterfly4.png': {
    '480x800': [66, 50],
    '720x1280': [90, 68],
  },
  'Blades/Particles/Butterfly/butterfly5.png': {
    '480x800': [66, 49],
    '720x1280': [90, 67],
  },
  'Blades/Particles/Fire/firecircle.png': {
    '480x800': [9, 9],
    '720x1280': [15, 15],
  },
  'Blades/Particles/Fire/fireparticle.png': {
    '480x800': [36, 48],
    '720x1280': [53, 68],
  },
  'Blades/Particles/Fire/smoke.png': {
    '480x800': [111, 108],
    '720x1280': [109, 110],
  },
  'Blades/Particles/Rainbow/rainbowstar0.png': {
    '480x800': [32, 32],
    '720x1280': [134, 132],
  },
  'Blades/Particles/Rainbow/rainbowstar1.png': {
    '480x800': [32, 32],
    '720x1280': [134, 132],
  },
  'Blades/Particles/Rainbow/rainbowstar2.png': {
    '480x800': [32, 32],
    '720x1280': [134, 131],
  },
  'Blades/Particles/Rainbow/rainbowstar3.png': {
    '480x800': [32, 32],
    '720x1280': [134, 131],
  },
  'Blades/Particles/Rainbow/rainbowstar4.png': {
    '480x800': [32, 32],
    '720x1280': [135, 131],
  },
});

const DRAGON_DIMENSIONS = deepFreeze({
  '480x800': {
    body: [[21, 17], [21, 17], [21, 17], [21, 17]],
    head: [[92, 63], [92, 63], [92, 63], [92, 63]],
    tail: [[53, 22], [53, 22], [53, 22], [53, 22]],
  },
  '720x1280': {
    body: [[33, 27], [33, 27], [33, 27], [33, 28]],
    head: [[140, 95], [139, 95], [139, 95], [139, 95]],
    tail: [[80, 34], [80, 34], [80, 34], [80, 33]],
  },
} as const);

const CENTIPEDE_DIMENSIONS = deepFreeze({
  '480x800': {
    body: [12, 40],
    head: [47, 44],
    tail: [51, 14],
  },
  '720x1280': {
    body: [18, 61],
    head: [70, 66],
    tail: [76, 22],
  },
} as const);

export function getStandardBladeResourceProfile(
  bladeId: number,
  assetTree: ClassicAssetTree,
): StandardBladeResourceProfile {
  assertStandardBladeId(bladeId);
  assertAssetTree(assetTree);
  if (bladeId <= 12) {
    const basicId = bladeId as StandardBasicBladeId;
    return deepFreeze({
      bladeId: basicId,
      kind: 'basic' as const,
      particles: getStandardBladeParticleResources(basicId, assetTree),
      texture: getStandardBasicBladeResource(basicId, assetTree),
    });
  }
  if (bladeId <= 16) {
    const dragonId = bladeId as StandardDragonBladeId;
    const variant = (dragonId - 13) as StandardDragonBladeVariant;
    return deepFreeze({
      bladeId: dragonId,
      kind: 'dragon' as const,
      particles: [] as const,
      resources: getStandardDragonBladeResources(dragonId, assetTree),
      variant,
    });
  }
  return deepFreeze({
    bladeId: 17 as const,
    kind: 'centipede' as const,
    particles: [] as const,
    resources: getStandardCentipedeBladeResources(assetTree),
  });
}

export function getStandardBasicBladeResource(
  bladeId: number,
  assetTree: ClassicAssetTree,
): GameRasterResource {
  assertStandardBasicBladeId(bladeId);
  assertAssetTree(assetTree);
  const logicalPath = BASIC_LOGICAL_PATHS[assetTree][bladeId];
  if (logicalPath === undefined) {
    throw new Error(`Standard BasicBlade ${bladeId} has no ${assetTree} resource`);
  }
  return raster(assetTree, logicalPath, [256, 256]);
}

export function getStandardDragonBladeResources(
  bladeId: number,
  assetTree: ClassicAssetTree,
): StandardBladeMultipartResources {
  assertStandardDragonBladeId(bladeId);
  assertAssetTree(assetTree);
  const variant = (bladeId - 13) as StandardDragonBladeVariant;
  const dimensions = DRAGON_DIMENSIONS[assetTree];
  return deepFreeze({
    body: raster(
      assetTree,
      `Blades/Dragon/dragon-body-${variant}.png`,
      requireDimensions(dimensions.body[variant], 'Dragon body'),
    ),
    bodySegmentCount: STANDARD_DRAGON_BLADE_BODY_SEGMENT_COUNT,
    head: raster(
      assetTree,
      `Blades/Dragon/dragon-head-${variant}.png`,
      requireDimensions(dimensions.head[variant], 'Dragon head'),
    ),
    pointCapacity: STANDARD_ADVANCED_BLADE_POINT_CAPACITY,
    tail: raster(
      assetTree,
      `Blades/Dragon/dragon-tail-${variant}.png`,
      requireDimensions(dimensions.tail[variant], 'Dragon tail'),
    ),
  });
}

export function getStandardCentipedeBladeResources(
  assetTree: ClassicAssetTree,
): StandardBladeMultipartResources {
  assertAssetTree(assetTree);
  const dimensions = CENTIPEDE_DIMENSIONS[assetTree];
  return deepFreeze({
    body: raster(assetTree, 'Blades/Centipede/body.png', dimensions.body),
    bodySegmentCount: STANDARD_CENTIPEDE_BLADE_BODY_SEGMENT_COUNT,
    head: raster(assetTree, 'Blades/Centipede/head.png', dimensions.head),
    pointCapacity: STANDARD_ADVANCED_BLADE_POINT_CAPACITY,
    tail: raster(assetTree, 'Blades/Centipede/tail.png', dimensions.tail),
  });
}

export function getStandardBladeParticleResources(
  bladeId: number,
  assetTree: ClassicAssetTree,
): readonly GameRasterResource[] {
  assertStandardBasicBladeId(bladeId);
  assertAssetTree(assetTree);
  if (bladeId < 7) {
    return Object.freeze([]);
  }
  const paths = PARTICLE_LOGICAL_PATHS_BY_ID[bladeId as StandardParticleBladeId];
  return Object.freeze(paths.map((logicalPath) => raster(
    assetTree,
    logicalPath,
    PARTICLE_DIMENSIONS[logicalPath][assetTree],
  )));
}

export function getStandardBladeRasterResources(
  assetTree: ClassicAssetTree,
): readonly GameRasterResource[] {
  assertAssetTree(assetTree);
  const resources: GameRasterResource[] = [];
  for (let bladeId = 0; bladeId < STANDARD_BASIC_BLADE_COUNT; bladeId += 1) {
    resources.push(getStandardBasicBladeResource(bladeId, assetTree));
  }
  for (let bladeId = 13; bladeId <= 16; bladeId += 1) {
    const multipart = getStandardDragonBladeResources(bladeId, assetTree);
    resources.push(multipart.head, multipart.body, multipart.tail);
  }
  const centipede = getStandardCentipedeBladeResources(assetTree);
  resources.push(centipede.head, centipede.body, centipede.tail);
  for (let bladeId = 7; bladeId <= 12; bladeId += 1) {
    resources.push(...getStandardBladeParticleResources(bladeId, assetTree));
  }
  if (resources.length !== STANDARD_BLADE_RASTER_RESOURCE_COUNT) {
    throw new Error('Standard blade resource closure must contain exactly 50 rasters');
  }
  const unique = new Set(resources.map(({ canonicalPath }) => canonicalPath));
  if (unique.size !== resources.length) {
    throw new Error('Standard blade resource closure contains duplicate canonical paths');
  }
  return Object.freeze(resources);
}

export function assertStandardBladeId(value: number): asserts value is StandardBladeId {
  if (!Number.isSafeInteger(value) || value < 0 || value >= STANDARD_BLADE_COUNT) {
    throw new RangeError('standard blade ID must be from 0 through 17');
  }
}

export function assertStandardBasicBladeId(
  value: number,
): asserts value is StandardBasicBladeId {
  if (!Number.isSafeInteger(value) || value < 0 || value >= STANDARD_BASIC_BLADE_COUNT) {
    throw new RangeError('standard BasicBlade ID must be from 0 through 12');
  }
}

function assertStandardDragonBladeId(
  value: number,
): asserts value is StandardDragonBladeId {
  if (!Number.isSafeInteger(value) || value < 13 || value > 16) {
    throw new RangeError('standard DragonBlade ID must be from 13 through 16');
  }
}

function assertAssetTree(value: string): asserts value is ClassicAssetTree {
  if (value !== '480x800' && value !== '720x1280') {
    throw new RangeError('assetTree must be 480x800 or 720x1280');
  }
}

function raster(
  tree: ClassicAssetTree,
  logicalPath: string,
  dimensions: readonly [number, number],
): GameRasterResource {
  return deepFreeze({
    canonicalPath: `${tree}/${logicalPath}`,
    dimensions: {
      height: dimensions[1],
      width: dimensions[0],
    },
  });
}

function requireDimensions(
  value: readonly [number, number] | undefined,
  label: string,
): readonly [number, number] {
  if (value === undefined) {
    throw new Error(`${label} dimensions are unavailable`);
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      deepFreeze(record[key]);
    }
    Object.freeze(value);
  }
  return value;
}
