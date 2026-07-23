import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname, resolve } from 'node:path';
import test from 'node:test';

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
  BIRD_ANIMATION_FRAME_COUNT,
  BIRD_PARTICLE_RESOURCE_COUNT,
  BIRD_RASTER_RESOURCE_COUNT,
  BIRD_RESOURCE_PROFILES,
  getBirdAnimationFrameResource,
  getBirdParticleResource,
  getBirdResourceProfile,
  listBirdRasterResources,
} = await import('../../../game/assets/scripts/domain/bird-resource-contract.ts');
const {
  getBaseGameplayResourceProfile,
} = await import(
  '../../../game/assets/scripts/domain/base-gameplay-resource-contract.ts'
);

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../../..');
const STAGING_MANIFEST = JSON.parse(readFileSync(
  resolve(REPOSITORY_ROOT, 'assets/catalog/creator-staging-manifest.json'),
  'utf8',
)) as {
  readonly entries: readonly {
    readonly bytes: number;
    readonly canonicalPath: string;
    readonly cocosType: string;
    readonly sha256: string;
    readonly targetPath: string;
  }[];
};
const STAGED_BY_PATH = new Map(
  STAGING_MANIFEST.entries.map((entry) => [entry.canonicalPath, entry]),
);

const LOGICAL_RESOURCE_ORDER = Object.freeze([
  'Blades/testblade7.png',
  ...Array.from({ length: 10 }, (_, index) => `Birds/bird-anim-1-${index}.png`),
  'Birds/bird-left-1.png',
  'Birds/bird-right-1.png',
  'Blades/Particles/X-Mas/xmasfive.png',
  'Blades/Particles/X-Mas/xmasfour.png',
  'Blades/Particles/X-Mas/xmashexa.png',
  'Blades/Particles/X-Mas/xmascircle.png',
]);

const EXPECTED_DIMENSIONS = Object.freeze({
  '480x800': Object.freeze([
    [64, 65],
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
    [110, 102],
    [110, 102],
    [46, 44],
    [51, 59],
    [32, 36],
    [34, 34],
  ]),
  '720x1280': Object.freeze([
    [64, 65],
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
    [129, 116],
    [129, 116],
    [66, 64],
    [70, 83],
    [47, 53],
    [49, 50],
  ]),
});

test('Bird profiles preserve exact path order and cardinality in both trees', () => {
  assert.equal(BIRD_ANIMATION_FRAME_COUNT, 10);
  assert.equal(BIRD_PARTICLE_RESOURCE_COUNT, 4);
  assert.equal(BIRD_RASTER_RESOURCE_COUNT, 17);
  assert.equal(LOGICAL_RESOURCE_ORDER.length, 17);

  for (const assetTree of ['480x800', '720x1280'] as const) {
    const profile = getBirdResourceProfile(assetTree);
    assert.equal(profile, BIRD_RESOURCE_PROFILES[assetTree]);
    assert.equal(profile.animationFrames.length, 10);
    assert.equal(profile.particles.length, 4);

    const resources = listBirdRasterResources(assetTree);
    assert.equal(resources.length, 17);
    assert.equal(new Set(resources.map(({ canonicalPath }) => canonicalPath)).size, 17);
    assert.deepEqual(
      resources.map(({ canonicalPath }) => canonicalPath),
      LOGICAL_RESOURCE_ORDER.map((logicalPath) => `${assetTree}/${logicalPath}`),
    );
    assert.deepEqual(
      resources.map(({ dimensions }) => [dimensions.width, dimensions.height]),
      EXPECTED_DIMENSIONS[assetTree],
    );
    assert.deepEqual(
      profile.animationFrames.map(({ canonicalPath }) => canonicalPath),
      Array.from(
        { length: 10 },
        (_, index) => `${assetTree}/Birds/bird-anim-1-${index}.png`,
      ),
    );
    assert.deepEqual(
      profile.particles.map(({ canonicalPath }) => canonicalPath),
      [
        `${assetTree}/Blades/Particles/X-Mas/xmasfive.png`,
        `${assetTree}/Blades/Particles/X-Mas/xmasfour.png`,
        `${assetTree}/Blades/Particles/X-Mas/xmashexa.png`,
        `${assetTree}/Blades/Particles/X-Mas/xmascircle.png`,
      ],
    );
  }
});

test('Bird reuses shared five/four particle contracts and excludes unrelated catalogs', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    const profile = getBirdResourceProfile(assetTree);
    const shared = getBaseGameplayResourceProfile(assetTree).objectiveAchievement;
    assert.equal(profile.particles[0], shared.xmasFive);
    assert.equal(profile.particles[1], shared.xmasFour);

    const paths = listBirdRasterResources(assetTree).map(
      ({ canonicalPath }) => canonicalPath,
    );
    for (const prohibitedFragment of [
      '/Text/',
      '/Fruits/',
      '/Bombs/',
      '/Backgrounds/',
      '/Themes/',
      '/Interfaces/',
      '/Leaderboard/',
      '/Blades/blade0.png',
    ]) {
      assert.equal(
        paths.some((path) => path.includes(prohibitedFragment)),
        false,
        prohibitedFragment,
      );
    }
  }
});

test('every Bird raster matches immutable staged bytes, hash, and PNG geometry', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    for (const resource of listBirdRasterResources(assetTree)) {
      const staged = STAGED_BY_PATH.get(resource.canonicalPath);
      assert.ok(staged, `missing manifest row ${resource.canonicalPath}`);
      assert.equal(staged.cocosType, 'cc.ImageAsset');
      assert.equal(
        staged.targetPath,
        `game/assets/game/${resource.canonicalPath}`,
      );
      const bytes = readFileSync(resolve(REPOSITORY_ROOT, staged.targetPath));
      assert.equal(bytes.byteLength, staged.bytes, resource.canonicalPath);
      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        staged.sha256,
        resource.canonicalPath,
      );
      assert.deepEqual(
        readPngDimensions(bytes),
        resource.dimensions,
        resource.canonicalPath,
      );
    }
  }
});

test('Bird indexed lookups preserve order and reject invalid input', () => {
  for (let frameIndex = 0; frameIndex < 10; frameIndex += 1) {
    assert.equal(
      getBirdAnimationFrameResource(frameIndex, '480x800'),
      getBirdResourceProfile('480x800').animationFrames[frameIndex],
    );
  }
  for (let selection = 0; selection < 4; selection += 1) {
    assert.equal(
      getBirdParticleResource(selection, '720x1280'),
      getBirdResourceProfile('720x1280').particles[selection],
    );
  }
  assert.throws(
    () => getBirdAnimationFrameResource(-1, '480x800'),
    /frameIndex must identify a Bird animation frame/,
  );
  assert.throws(
    () => getBirdAnimationFrameResource(10, '720x1280'),
    /frameIndex must identify a Bird animation frame/,
  );
  assert.throws(
    () => getBirdAnimationFrameResource(1.5, '480x800'),
    /frameIndex must identify a Bird animation frame/,
  );
  assert.throws(
    () => getBirdParticleResource(4, '720x1280'),
    /selection must identify a Bird particle/,
  );
  assert.throws(
    () => getBirdResourceProfile('phone' as never),
    /assetTree must be 480x800 or 720x1280/,
  );
  assert.throws(
    () => listBirdRasterResources('' as never),
    /assetTree must be 480x800 or 720x1280/,
  );
});

function readPngDimensions(
  bytes: Buffer,
): Readonly<{ readonly height: number; readonly width: number }> {
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR');
  return Object.freeze({
    height: bytes.readUInt32BE(20),
    width: bytes.readUInt32BE(16),
  });
}
