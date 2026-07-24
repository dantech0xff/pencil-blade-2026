import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
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
  ABOUT_BACK_AUDIO_CANONICAL_PATH,
  ABOUT_EXCLUDED_ANDROID_LOGICAL_PATHS,
  ABOUT_MENU_BUTTON_AUDIO_CANONICAL_PATH,
  ABOUT_RASTER_LOGICAL_PATHS,
  ABOUT_RASTER_RESOURCE_COUNT,
  ABOUT_RASTER_RESOURCES,
  ABOUT_SHARED_RESOURCE_COUNT,
  ABOUT_SHARED_RESOURCES,
  ABOUT_TOTAL_RESOURCE_COUNT,
  collectAboutRasterResources,
  getAboutRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/about-resource-contract.ts'
);

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
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

const EXPECTED_RASTER_PATHS = Object.freeze([
  'Backgrounds/aboutbackground.png',
  'Buttons/button-menu-normal.png',
  'Buttons/button-menu-selected.png',
  'Buttons/button-review-normal.png',
  'Buttons/button-review-selected.png',
  'Buttons/button-email-normal.png',
  'Buttons/button-email-selected.png',
  'Buttons/button-like-normal.png',
  'Buttons/button-like-selected.png',
  'Interfaces/heart.png',
] as const);

const EXPECTED_IDENTITIES = Object.freeze({
  '480x800': Object.freeze([
    [481, 801, 500_401, '584698d06da37717f7273d8a84cb022e991596b086c3e9dda2344cb7894c47b1'],
    [91, 87, 7_747, '243d2e150e62898c09a6ba77c89d61ed3968f9ea54ce90e90f27d04c5c5c6c93'],
    [91, 87, 7_503, 'ea26ea4b7fe9b3aa81724d9e00fd13b9c4b587fc9b61c881ae66d14e77d4a8db'],
    [105, 96, 12_734, 'd78957b90a4f09f2866addaba19a7361d4b225f64c974cef6d4782aa9dc4c7c4'],
    [105, 95, 13_331, 'ad839c70a4887165372824cfbfb2b0880fe1303288fdcde0cbd7cc62b7e3925e'],
    [91, 65, 5_142, 'b753b91e7ffb9f0fb20f34ed1e9ac8bb11b2f39429e22dbdfc47dae999a2e989'],
    [91, 65, 4_471, '53ac04ac61e7c53d0b26c90b1c9eb87c0d7eb74a00600a85914b2b93660d1a05'],
    [134, 133, 4_086, '7ee31e494f5adc6067ab8df6615901f08943a523794b1854e9bfaee359011e32'],
    [134, 133, 3_940, 'f420810263ee555b5ad3b9310c9c280a42d1d73e715206e1f7d5526b63ad4496'],
    [30, 33, 1_450, '0964ff4e27f16bd1563ea8740580e71e27d7cd342eaf3c75e0120594a485731f'],
  ]),
  '720x1280': Object.freeze([
    [721, 1281, 589_728, 'eacf6a7f6ec933d09a7c0ff3afb171b91181e476a6a3cd02d273ff34c776c9ab'],
    [137, 129, 12_700, 'abac9c8686c9ea40064ab07fdbe14caa5b6bcea8bc9146a4c2723a70a7fddf96'],
    [137, 129, 12_383, '6ab583b99d119ad69efb2c2e7d990f154996d3863ba53b8298a1ea1e79793558'],
    [156, 142, 24_496, 'c292b590a6442d86cf452204bb79b490321913a0aa7bbed59b46e3aa7a371704'],
    [156, 141, 25_073, '7127fa1b06e56c973e41dbbd975fc876e9839c1c6495937b2b1728f870d19d11'],
    [135, 97, 7_977, 'd27d3fc3bc97eb6f0175bf97d6b0564f26857cde30c447b2b1e9c2b45f6ae4c8'],
    [136, 97, 7_062, 'dc1b5c6ba627acddbc02a0e79ef4acaf9c534927120be467aaa002ffd3b537ba'],
    [166, 164, 4_990, 'fd63c38bf5afa5165287814646836f5d8d2f922477a4163b3f5c6428fb939dd5'],
    [166, 164, 4_932, 'c6f8f86545317b318593b8150732f5b53edf22e32511a9d7704e83544ce69aa4'],
    [44, 50, 2_108, '3329a1cde82e888e06fbb497579cc7dea391b56d4da322868698291665702254'],
  ]),
});

test('both profiles expose the exact ten-raster Android About closure', () => {
  assert.equal(ABOUT_RASTER_RESOURCE_COUNT, 10);
  assert.equal(ABOUT_SHARED_RESOURCE_COUNT, 1);
  assert.equal(ABOUT_TOTAL_RESOURCE_COUNT, 11);
  assert.deepEqual(ABOUT_RASTER_LOGICAL_PATHS, EXPECTED_RASTER_PATHS);

  for (const tree of ['480x800', '720x1280'] as const) {
    const resources = collectAboutRasterResources(tree);
    assert.equal(resources.length, ABOUT_RASTER_RESOURCE_COUNT);
    assert.equal(
      new Set(resources.map(({ canonicalPath }) => canonicalPath)).size,
      ABOUT_RASTER_RESOURCE_COUNT,
    );
    assert.deepEqual(
      resources.map(({ canonicalPath }) => stripTree(canonicalPath)),
      EXPECTED_RASTER_PATHS,
    );

    resources.forEach((resource, index) => {
      const expected = EXPECTED_IDENTITIES[tree][index];
      assert.ok(expected);
      const [width, height, bytes, digest] = expected;
      assert.deepEqual(resource.dimensions, { height, width });
      assert.equal(resource.bytes, bytes);
      assert.equal(resource.sha256, digest);

      const image = readBinary(`game/assets/game/${resource.canonicalPath}`);
      assert.equal(image.readUInt32BE(16), width, resource.canonicalPath);
      assert.equal(image.readUInt32BE(20), height, resource.canonicalPath);
      assert.equal(image.length, bytes, resource.canonicalPath);
      assert.equal(sha256(image), digest, resource.canonicalPath);

      const staged = STAGED_ENTRIES.get(resource.canonicalPath);
      assert.ok(staged, resource.canonicalPath);
      assert.equal(staged.cocosType, 'cc.ImageAsset');
      assert.equal(staged.targetPath, `game/assets/game/${resource.canonicalPath}`);
      assert.equal(staged.bytes, bytes);
      assert.equal(staged.sha256, digest);
    });
  }

  assertDeepFrozen(ABOUT_RASTER_RESOURCES);
});

test('normal and selected controls remain exact purpose-local pairs', () => {
  for (const tree of ['480x800', '720x1280'] as const) {
    const profile = getAboutRasterResources(tree);
    assert.deepEqual(
      [profile.menu.normal, profile.menu.selected].map(
        ({ canonicalPath }) => stripTree(canonicalPath),
      ),
      ['Buttons/button-menu-normal.png', 'Buttons/button-menu-selected.png'],
    );
    assert.deepEqual(
      [profile.review.normal, profile.review.selected].map(
        ({ canonicalPath }) => stripTree(canonicalPath),
      ),
      ['Buttons/button-review-normal.png', 'Buttons/button-review-selected.png'],
    );
    assert.deepEqual(
      [profile.email.normal, profile.email.selected].map(
        ({ canonicalPath }) => stripTree(canonicalPath),
      ),
      ['Buttons/button-email-normal.png', 'Buttons/button-email-selected.png'],
    );
    assert.deepEqual(
      [profile.like.normal, profile.like.selected].map(
        ({ canonicalPath }) => stripTree(canonicalPath),
      ),
      ['Buttons/button-like-normal.png', 'Buttons/button-like-selected.png'],
    );
  }
});

test('the Android contract explicitly excludes the staged iOS background', () => {
  assert.deepEqual(
    ABOUT_EXCLUDED_ANDROID_LOGICAL_PATHS,
    ['Backgrounds/aboutbackground-ios.png'],
  );
  const logicalClosure = new Set(ABOUT_RASTER_LOGICAL_PATHS);
  assert.equal(logicalClosure.has('Backgrounds/aboutbackground-ios.png' as never), false);
  for (const tree of ['480x800', '720x1280'] as const) {
    assert.equal(
      collectAboutRasterResources(tree).some(
        ({ canonicalPath }) => canonicalPath.endsWith(
          '/Backgrounds/aboutbackground-ios.png',
        ),
      ),
      false,
    );
  }
});

test('shared return audio keeps its existing exact identity without joining raster load', () => {
  assert.equal(
    ABOUT_MENU_BUTTON_AUDIO_CANONICAL_PATH,
    'Sounds/menubuttonclick.wav',
  );
  assert.equal(ABOUT_BACK_AUDIO_CANONICAL_PATH, ABOUT_MENU_BUTTON_AUDIO_CANONICAL_PATH);
  assert.deepEqual(ABOUT_SHARED_RESOURCES, {
    menuButtonClick: {
      bytes: 32_812,
      canonicalPath: 'Sounds/menubuttonclick.wav',
      kind: 'audio',
      sha256: '3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e',
    },
  });
  const audio = readBinary(
    `game/assets/game/${ABOUT_SHARED_RESOURCES.menuButtonClick.canonicalPath}`,
  );
  assert.equal(audio.length, ABOUT_SHARED_RESOURCES.menuButtonClick.bytes);
  assert.equal(sha256(audio), ABOUT_SHARED_RESOURCES.menuButtonClick.sha256);
  assertDeepFrozen(ABOUT_SHARED_RESOURCES);
});

test('resource getters reject other trees and new metadata is valid', () => {
  assert.throws(
    () => getAboutRasterResources('1080x1920' as never),
    RangeError,
  );
  assert.throws(
    () => collectAboutRasterResources('compact' as never),
    /480x800 or 720x1280/,
  );

  const metadata = [
    'game/assets/scripts/domain/about-resource-contract.ts.meta',
    'game/assets/scripts/domain/about-presentation.ts.meta',
    'game/assets/scripts/creator/about-resource-loader.ts.meta',
  ].map((path) => readJson<{
    readonly files: readonly unknown[];
    readonly imported: boolean;
    readonly importer: string;
    readonly subMetas: Readonly<Record<string, unknown>>;
    readonly userData: Readonly<Record<string, unknown>>;
    readonly uuid: string;
    readonly ver: string;
  }>(path));
  assert.equal(new Set(metadata.map(({ uuid }) => uuid)).size, metadata.length);
  for (const meta of metadata) {
    assert.match(
      meta.uuid,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    assert.deepEqual({
      files: meta.files,
      imported: meta.imported,
      importer: meta.importer,
      subMetas: meta.subMetas,
      userData: meta.userData,
      ver: meta.ver,
    }, {
      files: [],
      imported: true,
      importer: 'typescript',
      subMetas: {},
      userData: {},
      ver: '4.0.24',
    });
  }
});

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

function stripTree(canonicalPath: string): string {
  return canonicalPath.replace(/^(?:480x800|720x1280)\//, '');
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
