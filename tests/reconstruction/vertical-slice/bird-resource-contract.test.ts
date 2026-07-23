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
  BIRD_ALL_TYPE_RASTER_RESOURCE_COUNT,
  BIRD_ANIMATION_FRAME_COUNT,
  BIRD_COMBINED_RASTER_RESOURCE_COUNT,
  BIRD_PARTICLE_RESOURCE_COUNT,
  BIRD_RASTER_RESOURCE_COUNT,
  BIRD_RESOURCE_PROFILES,
  BIRD_RESOURCE_PROFILES_BY_TYPE,
  BIRD_SHARED_RASTER_RESOURCE_COUNT,
  BIRD_TYPE_SPECIFIC_RASTER_RESOURCE_COUNT,
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

const TYPE_TWO_LOGICAL_RESOURCE_ORDER = Object.freeze([
  'Blades/testblade7.png',
  ...Array.from({ length: 10 }, (_, index) => `Birds/bird-anim-2-${index}.png`),
  'Birds/bird-left-2.png',
  'Birds/bird-right-2.png',
  'Blades/Particles/X-Mas/xmasfive.png',
  'Blades/Particles/X-Mas/xmasfour.png',
  'Blades/Particles/X-Mas/xmashexa.png',
  'Blades/Particles/X-Mas/xmascircle.png',
]);

const TYPE_THREE_LOGICAL_RESOURCE_ORDER = Object.freeze([
  'Blades/testblade7.png',
  ...Array.from({ length: 10 }, (_, index) => `Birds/bird-anim-3-${index}.png`),
  'Birds/bird-left-3.png',
  'Birds/bird-right-3.png',
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

const EXPECTED_TYPE_TWO_DIMENSIONS = Object.freeze({
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
    [110, 101],
    [111, 101],
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
    [129, 115],
    [129, 115],
    [66, 64],
    [70, 83],
    [47, 53],
    [49, 50],
  ]),
});

const EXPECTED_TYPE_THREE_DIMENSIONS = Object.freeze({
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
    [110, 101],
    [110, 101],
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
    [129, 115],
    [129, 115],
    [66, 64],
    [70, 83],
    [47, 53],
    [49, 50],
  ]),
});

const EXPECTED_TYPE_THREE_STAGED_FILES = Object.freeze({
  '480x800': Object.freeze([
    [2122, '2da2bf2b18fa27a049189003d03de4756424d664a41ef94869485ee998fc976f'],
    [6948, '84f4cfed54fa8bbe281e7696c125adfd236d953dbddd1c983952003198131469'],
    [7010, '78e20af57ae170c76c69c597909d4a20b2cb1f8440e9cabc9134aab220408bf3'],
    [7324, '908678c95e5d2cf1238ce2e362be0fd71aa3850b8b0635a8b4aeee96ce07edda'],
    [6952, '32d516672f155605ff95197ed9823eba0e7b037f59a3ca8ef7d3c47a8e5f4b36'],
    [6928, 'd76c56ff64f10e983d1c9766f4f0fe6c9310dbeeade3dfd86ffe711a4a0e897e'],
    [6588, '9b39285134175bc146fee8db6d599858ac177769a8b1dbb50768db6d2a3d7356'],
    [6434, '46b20d80f5bc1a855930cd2e12c6ee5ad4c58d3af027350b4d3e63d61d2e80ae'],
    [5918, 'ea9fbbed8b3ac05e3972868e2b26342bf3ac9da08f41097c27e9f3696c656fe2'],
    [6442, '5881d5df17cac5784b20c6328d5d08dbd4471ed15ec64d536c164a3e0c44276e'],
    [6565, '78553602b0777904a3306edb8d12da633b2cbe905753cd0bc122126b9a43c52f'],
    [4394, '499351b465fe18f405225eb118bbce5fa25372d2ffeb6be30c14ea92ee2bcccc'],
    [4395, 'c6db8bbde60fe6207c701343e15ff787346751636ab9e22172397c7a0b13c427'],
    [1029, '2116d7623e8fe6449665823f2e2ffc0c183de54595edb87f4c07850f941d48b2'],
    [914, '5a4c2555892d71a528e0c5ba335795ae5540b92e7d513a693e92b8b28b7b6385'],
    [800, '36f8ce97327c768fe14e1169672bf5a53147fdb314b086d9559a38631710bef9'],
    [869, '97f32efcd79fd577a2a23bede4724f8df0e6ccf4a331fdb481b9bad8622525c8'],
  ]),
  '720x1280': Object.freeze([
    [2122, '2da2bf2b18fa27a049189003d03de4756424d664a41ef94869485ee998fc976f'],
    [11566, '47208e7d85ac674a0eb077736747c9d7922bcbdf7f2c527b07bff042a793101b'],
    [11559, 'b7d3695dcb6fd72a026e50fb48515df56684c93be0d8fc04b58df6c4a11e173e'],
    [12028, '64f928e4529f7dd7e8335ee06a181f2308bc989dcdfa4d4a54d2123e6ce2e7a0'],
    [11498, '04618bba4665fc7f1490ba751ff890297ca05bd6f14c170a3fe0aa41ced0433f'],
    [11332, '751e4e6236efdb131f5a59c94b778b334fb389c074a54a1931615fdf41370c7e'],
    [10956, '6394bb0f5ba399b7b5727f5ea3a57aee720b8953a4600feb070c89cc9dc19efa'],
    [10693, 'a6802b57e3b2a4acfb59e1aadfc81754a4d05a0c023ca7884f74cd5118d2032b'],
    [10059, 'f0ee2e8b1b433a3861c8ef9066690a6bc2e927a08d92185a838c2a51b1488e63'],
    [10652, '4c7be27fca727fbf5107684efb6e97e38149553bc5d731e3480bc929d9520b2a'],
    [10865, 'd393db02b12d062f2032e88387a90601fc238e24c5dc1333814fdd6e8cf6bb50'],
    [6616, 'b2cad209b1beaa9dea1545e6c3e515d2bde3ecbdaa9fdcaf370e73790675cb15'],
    [6490, '81253c4ec11d4cbc3164b38cfbc6831fb391f3af1c2c433391038adeb8c57a00'],
    [1408, 'a22ab1d4c49336316860db10587696fe7d5f5190d7ee762839f8909e1b13a9b3'],
    [1216, '7f38b7d318bce450472ecc579a4a9a1a840c7b09d610830339bdcc51ed824a39'],
    [957, 'cc4217637576b6c7bb0c92d400905058e952c8bcded9fa90ea4423637d5a89ab'],
    [1196, 'a5f33bf414f4e4c31fe2bea1ea66fbc6f52a8f495ac1436fb0e6a237b515719e'],
  ]),
});

test('Bird profiles preserve exact path order and cardinality in both trees', () => {
  assert.equal(BIRD_ANIMATION_FRAME_COUNT, 10);
  assert.equal(BIRD_PARTICLE_RESOURCE_COUNT, 4);
  assert.equal(BIRD_SHARED_RASTER_RESOURCE_COUNT, 5);
  assert.equal(BIRD_TYPE_SPECIFIC_RASTER_RESOURCE_COUNT, 12);
  assert.equal(BIRD_RASTER_RESOURCE_COUNT, 17);
  assert.equal(BIRD_ALL_TYPE_RASTER_RESOURCE_COUNT, 41);
  assert.equal(BIRD_COMBINED_RASTER_RESOURCE_COUNT, 41);
  assert.equal(LOGICAL_RESOURCE_ORDER.length, 17);

  for (const assetTree of ['480x800', '720x1280'] as const) {
    const profile = getBirdResourceProfile(assetTree);
    assert.equal(profile, BIRD_RESOURCE_PROFILES[assetTree]);
    assert.equal(profile, BIRD_RESOURCE_PROFILES_BY_TYPE[assetTree][1]);
    assert.equal(profile.birdType, 1);
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

test('Crazy Bird type 2 preserves its exact geometry and 29-raster two-type closure', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    const classic = getBirdResourceProfile(assetTree);
    const crazy = getBirdResourceProfile(assetTree, 2);
    assert.equal(crazy, BIRD_RESOURCE_PROFILES_BY_TYPE[assetTree][2]);
    assert.equal(crazy.birdType, 2);
    assert.equal(crazy.animationFrames.length, 10);
    assert.equal(crazy.particles.length, 4);

    const resources = listBirdRasterResources(assetTree, 2);
    assert.equal(resources.length, BIRD_RASTER_RESOURCE_COUNT);
    assert.deepEqual(
      resources.map(({ canonicalPath }) => canonicalPath),
      TYPE_TWO_LOGICAL_RESOURCE_ORDER.map(
        (logicalPath) => `${assetTree}/${logicalPath}`,
      ),
    );
    assert.deepEqual(
      resources.map(({ dimensions }) => [dimensions.width, dimensions.height]),
      EXPECTED_TYPE_TWO_DIMENSIONS[assetTree],
    );

    const combinedPaths = new Set([
      ...listBirdRasterResources(assetTree),
      ...resources,
    ].map(({ canonicalPath }) => canonicalPath));
    assert.equal(
      combinedPaths.size,
      BIRD_SHARED_RASTER_RESOURCE_COUNT
        + BIRD_TYPE_SPECIFIC_RASTER_RESOURCE_COUNT * 2,
    );
    assert.equal(
      [...combinedPaths].filter((path) => path.includes('/Birds/')).length,
      BIRD_TYPE_SPECIFIC_RASTER_RESOURCE_COUNT * 2,
    );

    assert.equal(classic.blade, crazy.blade);
    assert.equal(classic.particles, crazy.particles);
    assert.notEqual(classic.animationFrames[0], crazy.animationFrames[0]);
    assert.notEqual(classic.leftDirection, crazy.leftDirection);
    assert.notEqual(classic.rightDirection, crazy.rightDirection);
  }
});

test('Combo Bird type 3 has its exact profile and a 41-raster all-type closure', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    const classic = getBirdResourceProfile(assetTree);
    const combo = getBirdResourceProfile(assetTree, 3);
    assert.equal(combo, BIRD_RESOURCE_PROFILES_BY_TYPE[assetTree][3]);
    assert.equal(combo.birdType, 3);
    assert.equal(combo.animationFrames.length, 10);
    assert.equal(combo.particles.length, 4);

    const resources = listBirdRasterResources(assetTree, 3);
    assert.equal(resources.length, BIRD_RASTER_RESOURCE_COUNT);
    assert.deepEqual(
      resources.map(({ canonicalPath }) => canonicalPath),
      TYPE_THREE_LOGICAL_RESOURCE_ORDER.map(
        (logicalPath) => `${assetTree}/${logicalPath}`,
      ),
    );
    assert.deepEqual(
      resources.map(({ dimensions }) => [dimensions.width, dimensions.height]),
      EXPECTED_TYPE_THREE_DIMENSIONS[assetTree],
    );

    const allTypePaths = new Set(
      ([1, 2, 3] as const).flatMap((birdType) => (
        listBirdRasterResources(assetTree, birdType)
      )).map(({ canonicalPath }) => canonicalPath),
    );
    assert.equal(allTypePaths.size, BIRD_ALL_TYPE_RASTER_RESOURCE_COUNT);
    assert.equal(allTypePaths.size, BIRD_COMBINED_RASTER_RESOURCE_COUNT);
    assert.equal(
      [...allTypePaths].filter((path) => path.includes('/Birds/')).length,
      BIRD_TYPE_SPECIFIC_RASTER_RESOURCE_COUNT * 3,
    );

    assert.equal(classic.blade, combo.blade);
    assert.equal(classic.particles, combo.particles);
    assert.notEqual(classic.animationFrames[0], combo.animationFrames[0]);
    assert.notEqual(classic.leftDirection, combo.leftDirection);
    assert.notEqual(classic.rightDirection, combo.rightDirection);
  }
});

test('all Bird types reuse the exact five shared rasters and exclude unrelated catalogs', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    const classic = getBirdResourceProfile(assetTree);
    const shared = getBaseGameplayResourceProfile(assetTree).objectiveAchievement;
    for (const birdType of [1, 2, 3] as const) {
      const profile = getBirdResourceProfile(assetTree, birdType);
      assert.equal(profile.particles[0], shared.xmasFive);
      assert.equal(profile.particles[1], shared.xmasFour);
      assert.equal(profile.blade, classic.blade);
      for (let index = 0; index < profile.particles.length; index += 1) {
        assert.equal(profile.particles[index], classic.particles[index]);
      }

      const paths = listBirdRasterResources(assetTree, birdType).map(
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
  }
});

test('every type-1, type-2, and type-3 raster matches staged bytes, hash, and PNG geometry', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    for (const birdType of [1, 2, 3] as const) {
      for (const resource of listBirdRasterResources(assetTree, birdType)) {
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
  }
});

test('type-3 staged files match every recovered byte count and SHA-256', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    const resources = listBirdRasterResources(assetTree, 3);
    const expectedFiles = EXPECTED_TYPE_THREE_STAGED_FILES[assetTree];
    assert.equal(expectedFiles.length, BIRD_RASTER_RESOURCE_COUNT);

    resources.forEach((resource, index) => {
      const expected = expectedFiles[index];
      assert.ok(expected, resource.canonicalPath);
      const [expectedBytes, expectedSha256] = expected;
      const staged = STAGED_BY_PATH.get(resource.canonicalPath);
      assert.ok(staged, `missing manifest row ${resource.canonicalPath}`);
      assert.equal(staged.bytes, expectedBytes, resource.canonicalPath);
      assert.equal(staged.sha256, expectedSha256, resource.canonicalPath);

      const bytes = readFileSync(resolve(REPOSITORY_ROOT, staged.targetPath));
      assert.equal(bytes.byteLength, expectedBytes, resource.canonicalPath);
      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        expectedSha256,
        resource.canonicalPath,
      );
    });
  }
});

test('Bird indexed lookups preserve order and reject invalid input', () => {
  for (let frameIndex = 0; frameIndex < 10; frameIndex += 1) {
    assert.equal(
      getBirdAnimationFrameResource(frameIndex, '480x800'),
      getBirdResourceProfile('480x800').animationFrames[frameIndex],
    );
    assert.equal(
      getBirdAnimationFrameResource(frameIndex, '480x800', 2),
      getBirdResourceProfile('480x800', 2).animationFrames[frameIndex],
    );
    assert.equal(
      getBirdAnimationFrameResource(frameIndex, '480x800', 3),
      getBirdResourceProfile('480x800', 3).animationFrames[frameIndex],
    );
  }
  for (let selection = 0; selection < 4; selection += 1) {
    assert.equal(
      getBirdParticleResource(selection, '720x1280'),
      getBirdResourceProfile('720x1280').particles[selection],
    );
    assert.equal(
      getBirdParticleResource(selection, '720x1280', 2),
      getBirdResourceProfile('720x1280', 2).particles[selection],
    );
    assert.equal(
      getBirdParticleResource(selection, '720x1280', 3),
      getBirdResourceProfile('720x1280', 3).particles[selection],
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
  assert.throws(
    () => getBirdResourceProfile('480x800', 4 as never),
    /birdType must be 1, 2, or 3/,
  );
  assert.throws(
    () => listBirdRasterResources('720x1280', 1.5 as never),
    /birdType must be a safe integer/,
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
