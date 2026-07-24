import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../'))
      && extname(specifier) === ''
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const {
  STANDARD_ADVANCED_BLADE_POINT_CAPACITY,
  STANDARD_BASIC_BLADE_COUNT,
  STANDARD_BLADE_COMPACT_COMPATIBILITY_ALIASES,
  STANDARD_BLADE_COUNT,
  STANDARD_BLADE_RASTER_RESOURCE_COUNT,
  STANDARD_CENTIPEDE_BLADE_BODY_SEGMENT_COUNT,
  STANDARD_DRAGON_BLADE_BODY_SEGMENT_COUNT,
  assertStandardBasicBladeId,
  assertStandardBladeId,
  getStandardBasicBladeResource,
  getStandardBladeParticleResources,
  getStandardBladeRasterResources,
  getStandardBladeResourceProfile,
  getStandardCentipedeBladeResources,
  getStandardDragonBladeResources,
} = await import(
  '../../../game/assets/scripts/domain/standard-blade-resource-contract.ts'
);

type AssetTree = '480x800' | '720x1280';
type Dimensions = readonly [number, number];
type PairedDimensions = readonly [Dimensions, Dimensions];

interface RasterContract {
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{
    readonly height: number;
    readonly width: number;
  }>;
}

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ASSET_TREES = Object.freeze(['480x800', '720x1280'] as const);
const STAGING_MANIFEST = readJson<{
  readonly entries: readonly {
    readonly bytes: number;
    readonly canonicalPath: string;
    readonly cocosType: string;
    readonly sha256: string;
    readonly targetPath: string;
  }[];
}>('assets/catalog/creator-staging-manifest.json');
const STAGED_ENTRIES = new Map(
  STAGING_MANIFEST.entries.map((entry) => [entry.canonicalPath, entry]),
);

const BASIC_LOGICAL_PATHS = Object.freeze({
  '480x800': Object.freeze([
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
    'Blades/firebladetexture.png',
    'Blades/rainbow.png',
  ]),
  '720x1280': Object.freeze([
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
    'Blades/blade11.png',
    'Blades/blade12.png',
  ]),
} as const);

const DRAGON_DIMENSIONS = Object.freeze({
  body: Object.freeze([
    [[21, 17], [33, 27]],
    [[21, 17], [33, 27]],
    [[21, 17], [33, 27]],
    [[21, 17], [33, 28]],
  ] as const),
  head: Object.freeze([
    [[92, 63], [140, 95]],
    [[92, 63], [139, 95]],
    [[92, 63], [139, 95]],
    [[92, 63], [139, 95]],
  ] as const),
  tail: Object.freeze([
    [[53, 22], [80, 34]],
    [[53, 22], [80, 34]],
    [[53, 22], [80, 34]],
    [[53, 22], [80, 33]],
  ] as const),
});

const CENTIPEDE_DIMENSIONS = Object.freeze({
  body: [[12, 40], [18, 61]],
  head: [[47, 44], [70, 66]],
  tail: [[51, 14], [76, 22]],
} as const);

const PARTICLE_PATHS_BY_ID = Object.freeze([
  Object.freeze({
    bladeId: 7,
    paths: Object.freeze(['Blades/Particles/VN Flag/vnflagstar.png']),
  }),
  Object.freeze({
    bladeId: 8,
    paths: Object.freeze([
      'Blades/Particles/Ice/snowflake.png',
      'Blades/Particles/Ice/star.png',
      'Blades/Particles/Ice/circle.png',
    ]),
  }),
  Object.freeze({
    bladeId: 9,
    paths: Object.freeze([
      'Blades/Particles/X-Mas/xmasfive.png',
      'Blades/Particles/X-Mas/xmasfour.png',
      'Blades/Particles/X-Mas/xmashexa.png',
      'Blades/Particles/X-Mas/xmascircle.png',
    ]),
  }),
  Object.freeze({
    bladeId: 10,
    paths: Object.freeze([
      'Blades/Particles/Butterfly/butterfly0.png',
      'Blades/Particles/Butterfly/butterfly1.png',
      'Blades/Particles/Butterfly/butterfly2.png',
      'Blades/Particles/Butterfly/butterfly3.png',
      'Blades/Particles/Butterfly/butterfly4.png',
      'Blades/Particles/Butterfly/butterfly5.png',
    ]),
  }),
  Object.freeze({
    bladeId: 11,
    paths: Object.freeze([
      'Blades/Particles/Fire/firecircle.png',
      'Blades/Particles/Fire/fireparticle.png',
      'Blades/Particles/Fire/smoke.png',
    ]),
  }),
  Object.freeze({
    bladeId: 12,
    paths: Object.freeze([
      'Blades/Particles/Rainbow/rainbowstar0.png',
      'Blades/Particles/Rainbow/rainbowstar1.png',
      'Blades/Particles/Rainbow/rainbowstar2.png',
      'Blades/Particles/Rainbow/rainbowstar3.png',
      'Blades/Particles/Rainbow/rainbowstar4.png',
    ]),
  }),
] as const);

const PARTICLE_DIMENSIONS: Readonly<Record<string, PairedDimensions>> = Object.freeze({
  'Blades/Particles/VN Flag/vnflagstar.png': [[54, 52], [78, 74]],
  'Blades/Particles/Ice/snowflake.png': [[51, 54], [76, 82]],
  'Blades/Particles/Ice/star.png': [[50, 51], [74, 76]],
  'Blades/Particles/Ice/circle.png': [[36, 36], [55, 55]],
  'Blades/Particles/X-Mas/xmasfive.png': [[46, 44], [66, 64]],
  'Blades/Particles/X-Mas/xmasfour.png': [[51, 59], [70, 83]],
  'Blades/Particles/X-Mas/xmashexa.png': [[32, 36], [47, 53]],
  'Blades/Particles/X-Mas/xmascircle.png': [[34, 34], [49, 50]],
  'Blades/Particles/Butterfly/butterfly0.png': [[64, 49], [86, 66]],
  'Blades/Particles/Butterfly/butterfly1.png': [[64, 49], [87, 66]],
  'Blades/Particles/Butterfly/butterfly2.png': [[61, 46], [84, 64]],
  'Blades/Particles/Butterfly/butterfly3.png': [[64, 48], [86, 63]],
  'Blades/Particles/Butterfly/butterfly4.png': [[66, 50], [90, 68]],
  'Blades/Particles/Butterfly/butterfly5.png': [[66, 49], [90, 67]],
  'Blades/Particles/Fire/firecircle.png': [[9, 9], [15, 15]],
  'Blades/Particles/Fire/fireparticle.png': [[36, 48], [53, 68]],
  'Blades/Particles/Fire/smoke.png': [[111, 108], [109, 110]],
  'Blades/Particles/Rainbow/rainbowstar0.png': [[32, 32], [134, 132]],
  'Blades/Particles/Rainbow/rainbowstar1.png': [[32, 32], [134, 132]],
  'Blades/Particles/Rainbow/rainbowstar2.png': [[32, 32], [134, 131]],
  'Blades/Particles/Rainbow/rainbowstar3.png': [[32, 32], [134, 131]],
  'Blades/Particles/Rainbow/rainbowstar4.png': [[32, 32], [135, 131]],
});

test('IDs 0 through 17 expose the exact Basic, Dragon, and Centipede topology', () => {
  assert.equal(STANDARD_BLADE_COUNT, 18);
  assert.equal(STANDARD_BASIC_BLADE_COUNT, 13);
  assert.equal(STANDARD_DRAGON_BLADE_BODY_SEGMENT_COUNT, 15);
  assert.equal(STANDARD_CENTIPEDE_BLADE_BODY_SEGMENT_COUNT, 20);
  assert.equal(STANDARD_ADVANCED_BLADE_POINT_CAPACITY, 32);

  for (const [treeIndex, tree] of ASSET_TREES.entries()) {
    for (let bladeId = 0; bladeId < STANDARD_BLADE_COUNT; bladeId += 1) {
      assert.doesNotThrow(() => assertStandardBladeId(bladeId));
      const profile = getStandardBladeResourceProfile(bladeId, tree);
      assert.equal(profile.bladeId, bladeId);
      assertDeepFrozen(profile);

      if (bladeId <= 12) {
        assert.equal(profile.kind, 'basic');
        assert.equal(
          profile.texture.canonicalPath,
          `${tree}/${BASIC_LOGICAL_PATHS[tree][bladeId]}`,
        );
        assert.deepEqual(profile.texture.dimensions, { height: 256, width: 256 });
        const particleEntry = PARTICLE_PATHS_BY_ID.find(
          (entry) => entry.bladeId === bladeId,
        );
        const expectedParticles = particleEntry?.paths ?? [];
        assert.deepEqual(
          profile.particles.map(({ canonicalPath }: RasterContract) => canonicalPath),
          expectedParticles.map((path) => `${tree}/${path}`),
        );
        assert.deepEqual(
          profile.particles,
          getStandardBladeParticleResources(bladeId, tree),
        );
        continue;
      }

      if (bladeId <= 16) {
        const variant = bladeId - 13;
        assert.equal(profile.kind, 'dragon');
        assert.equal(profile.variant, variant);
        assert.deepEqual(profile.particles, []);
        assert.equal(profile.resources.bodySegmentCount, 15);
        assert.equal(profile.resources.pointCapacity, 32);
        for (const part of ['head', 'body', 'tail'] as const) {
          assert.equal(
            profile.resources[part].canonicalPath,
            `${tree}/Blades/Dragon/dragon-${part}-${variant}.png`,
          );
          assert.deepEqual(
            profile.resources[part].dimensions,
            dimensions(DRAGON_DIMENSIONS[part][variant], treeIndex),
          );
        }
        assert.deepEqual(
          profile.resources,
          getStandardDragonBladeResources(bladeId, tree),
        );
        continue;
      }

      assert.equal(profile.kind, 'centipede');
      assert.deepEqual(profile.particles, []);
      assert.equal(profile.resources.bodySegmentCount, 20);
      assert.equal(profile.resources.pointCapacity, 32);
      for (const part of ['head', 'body', 'tail'] as const) {
        assert.equal(
          profile.resources[part].canonicalPath,
          `${tree}/Blades/Centipede/${part}.png`,
        );
        assert.deepEqual(
          profile.resources[part].dimensions,
          dimensions(CENTIPEDE_DIMENSIONS[part], treeIndex),
        );
      }
      assert.deepEqual(profile.resources, getStandardCentipedeBladeResources(tree));
    }
  }
});

test('both trees contain exactly 50 unique staged rasters with exact PNG dimensions', () => {
  assert.equal(STANDARD_BLADE_RASTER_RESOURCE_COUNT, 50);

  for (const [treeIndex, tree] of ASSET_TREES.entries()) {
    const expected = expectedRasterContracts(tree, treeIndex);
    const resources = getStandardBladeRasterResources(tree);
    assert.equal(expected.length, 50);
    assert.equal(resources.length, 50);
    assert.equal(
      new Set(resources.map(({ canonicalPath }: RasterContract) => canonicalPath)).size,
      50,
    );
    assert.deepEqual(resources, expected);
    assertDeepFrozen(resources);

    for (const resource of resources as readonly RasterContract[]) {
      const image = readBinary(`game/assets/game/${resource.canonicalPath}`);
      assert.equal(
        image.readUInt32BE(16),
        resource.dimensions.width,
        `${resource.canonicalPath} PNG width`,
      );
      assert.equal(
        image.readUInt32BE(20),
        resource.dimensions.height,
        `${resource.canonicalPath} PNG height`,
      );
      const staged = STAGED_ENTRIES.get(resource.canonicalPath);
      assert.ok(staged, resource.canonicalPath);
      assert.equal(staged.targetPath, `game/assets/game/${resource.canonicalPath}`);
      assert.equal(staged.cocosType, 'cc.ImageAsset');
      assert.equal(staged.bytes, image.length, `${resource.canonicalPath} staged bytes`);
      assert.equal(staged.sha256, sha256(image), `${resource.canonicalPath} staged hash`);
    }
  }
});

test('compact IDs 11 and 12 use explicit byte-identical native-path aliases', () => {
  assert.deepEqual(STANDARD_BLADE_COMPACT_COMPATIBILITY_ALIASES, {
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
  assertDeepFrozen(STANDARD_BLADE_COMPACT_COMPATIBILITY_ALIASES);

  for (const bladeId of [11, 12] as const) {
    const alias = STANDARD_BLADE_COMPACT_COMPATIBILITY_ALIASES[bladeId];
    const compact = getStandardBasicBladeResource(bladeId, '480x800');
    const high = getStandardBasicBladeResource(bladeId, '720x1280');
    assert.equal(compact.canonicalPath, `480x800/${alias.aliasLogicalPath}`);
    assert.equal(high.canonicalPath, `720x1280/${alias.nativeLogicalPath}`);
    const compactBytes = readBinary(`game/assets/game/${compact.canonicalPath}`);
    const highBytes = readBinary(`game/assets/game/${high.canonicalPath}`);
    assert.equal(sha256(compactBytes), alias.sha256);
    assert.equal(sha256(highBytes), alias.sha256);
    assert.equal(compactBytes.equals(highBytes), true);
  }
});

test('all invalid IDs and asset trees fail closed before producing a resource', () => {
  for (const bladeId of [-1, 18, 1.5, Number.NaN, Infinity, -Infinity]) {
    assert.throws(
      () => assertStandardBladeId(bladeId),
      /standard blade ID must be from 0 through 17/,
    );
    assert.throws(
      () => getStandardBladeResourceProfile(bladeId, '480x800'),
      /standard blade ID must be from 0 through 17/,
    );
  }
  for (const bladeId of [-1, 13, 0.5, Number.NaN, Infinity]) {
    assert.throws(
      () => assertStandardBasicBladeId(bladeId),
      /standard BasicBlade ID must be from 0 through 12/,
    );
    assert.throws(
      () => getStandardBasicBladeResource(bladeId, '480x800'),
      /standard BasicBlade ID must be from 0 through 12/,
    );
    assert.throws(
      () => getStandardBladeParticleResources(bladeId, '480x800'),
      /standard BasicBlade ID must be from 0 through 12/,
    );
  }
  for (const bladeId of [12, 17, 13.5, Number.NaN, Infinity]) {
    assert.throws(
      () => getStandardDragonBladeResources(bladeId, '720x1280'),
      /standard DragonBlade ID must be from 13 through 16/,
    );
  }

  for (const invalidTree of ['phone', '1080x1920', '', null, undefined]) {
    assert.throws(
      () => getStandardBladeResourceProfile(0, invalidTree as never),
      /assetTree must be 480x800 or 720x1280/,
    );
    assert.throws(
      () => getStandardBasicBladeResource(0, invalidTree as never),
      /assetTree must be 480x800 or 720x1280/,
    );
    assert.throws(
      () => getStandardDragonBladeResources(13, invalidTree as never),
      /assetTree must be 480x800 or 720x1280/,
    );
    assert.throws(
      () => getStandardCentipedeBladeResources(invalidTree as never),
      /assetTree must be 480x800 or 720x1280/,
    );
    assert.throws(
      () => getStandardBladeParticleResources(7, invalidTree as never),
      /assetTree must be 480x800 or 720x1280/,
    );
    assert.throws(
      () => getStandardBladeRasterResources(invalidTree as never),
      /assetTree must be 480x800 or 720x1280/,
    );
  }
});

function expectedRasterContracts(
  tree: AssetTree,
  treeIndex: number,
): readonly RasterContract[] {
  const resources: RasterContract[] = BASIC_LOGICAL_PATHS[tree].map((logicalPath) => (
    raster(tree, logicalPath, [256, 256])
  ));
  for (let variant = 0; variant < 4; variant += 1) {
    for (const part of ['head', 'body', 'tail'] as const) {
      resources.push(raster(
        tree,
        `Blades/Dragon/dragon-${part}-${variant}.png`,
        requirePairedDimensions(DRAGON_DIMENSIONS[part][variant], treeIndex),
      ));
    }
  }
  for (const part of ['head', 'body', 'tail'] as const) {
    resources.push(raster(
      tree,
      `Blades/Centipede/${part}.png`,
      requirePairedDimensions(CENTIPEDE_DIMENSIONS[part], treeIndex),
    ));
  }
  for (const { paths } of PARTICLE_PATHS_BY_ID) {
    for (const logicalPath of paths) {
      resources.push(raster(
        tree,
        logicalPath,
        requirePairedDimensions(PARTICLE_DIMENSIONS[logicalPath], treeIndex),
      ));
    }
  }
  return Object.freeze(resources);
}

function raster(
  tree: AssetTree,
  logicalPath: string,
  size: Dimensions,
): RasterContract {
  return Object.freeze({
    canonicalPath: `${tree}/${logicalPath}`,
    dimensions: Object.freeze({ height: size[1], width: size[0] }),
  });
}

function dimensions(
  paired: PairedDimensions,
  treeIndex: number,
): Readonly<{ readonly height: number; readonly width: number }> {
  const [width, height] = requirePairedDimensions(paired, treeIndex);
  return { height, width };
}

function requirePairedDimensions(
  paired: PairedDimensions | undefined,
  treeIndex: number,
): Dimensions {
  const value = paired?.[treeIndex];
  assert.ok(value, 'expected paired blade dimensions');
  return value;
}

function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return;
  }
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) {
    assertDeepFrozen(child, seen);
  }
}

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(`${REPOSITORY_ROOT}${relativePath}`, 'utf8')) as T;
}

function readBinary(relativePath: string): Buffer {
  return readFileSync(`${REPOSITORY_ROOT}${relativePath}`);
}
