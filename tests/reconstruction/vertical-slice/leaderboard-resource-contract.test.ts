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
  LEADERBOARD_BACK_AUDIO_CANONICAL_PATH,
  LEADERBOARD_MENU_BUTTON_AUDIO_CANONICAL_PATH,
  LEADERBOARD_PLAYER_FONT_CANONICAL_PATH,
  LEADERBOARD_RASTER_RESOURCE_COUNT,
  LEADERBOARD_RASTER_RESOURCES,
  LEADERBOARD_SCORE_FONT_CANONICAL_PATH,
  LEADERBOARD_SHARED_RESOURCES,
  getLeaderboardRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/leaderboard-resource-contract.ts'
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

const EXPECTED_RASTER_FILES = Object.freeze({
  'Leaderboard/leaderboard_title.png': {
    bytes: [26_737, 50_708],
    dimensions: [[552, 118], [793, 159]],
    sha256: [
      'c7f7af4d248120b5ce6ad46d14001c4654c91cb1cb5d468360d8c0ccd7eb6095',
      '696ee696db62266e7c218d762c32f0fc22694b9551518f43402eb479b84ab104',
    ],
  },
  'Leaderboard/leaderboard_view_templete.png': {
    bytes: [32_237, 51_495],
    dimensions: [[540, 586], [773, 844]],
    sha256: [
      '37ab4c425142a96e8cebd7187cb765dcc8ca72d38f1f573628850cc6f6877311',
      '047b9d88999ec7e6e5c3f335880fa0b807fa02b843aea7a47c62910dace44e5b',
    ],
  },
  'Leaderboard/leaderboard_classic.png': {
    bytes: [7_091, 10_690],
    dimensions: [[466, 115], [663, 137]],
    sha256: [
      '7ad4928c709c28bc59de1d8408411ccd26a939bc43ec27e112032b20c976d7c3',
      '2cf754253fb2c69ceed5c3a62b789af2a463f3fc181ecc6f4b7304966d0ac57a',
    ],
  },
  'Leaderboard/leaderboard_crazy.png': {
    bytes: [6_799, 10_164],
    dimensions: [[466, 115], [663, 137]],
    sha256: [
      '28193c7c454acbe7e806404c324bfc0e70b303193506e7a3ce205a29f5bd3282',
      '15f03045ee90138fc43753990ab1de3a007d61bab6d8af06ce8d3932e896edff',
    ],
  },
  'Leaderboard/leaderboard_gnstyle.png': {
    bytes: [8_073, 12_309],
    dimensions: [[466, 115], [663, 138]],
    sha256: [
      'a8150f9fbca4b3824a684515db8b4e42808e212d4f988151b84e233e2a35a2d0',
      'c0ca921ff65d80d6cc0e6c011614e79cbd7f6b50153a9e7f181fdfa0f919c2a5',
    ],
  },
  'Leaderboard/leaderboard_classic_bird.png': {
    bytes: [7_094, 10_933],
    dimensions: [[466, 115], [663, 137]],
    sha256: [
      'd959dd6755cfd7a666e8c8bd4d600c7e0b035eea9697cfcebc2358b7d077a66b',
      'd1037998bdc06f9aceba578002ee2094d7c67dbb45dc12fde8d372a1409df94f',
    ],
  },
  'Leaderboard/leaderboard_crazy_bird.png': {
    bytes: [7_065, 10_850],
    dimensions: [[466, 115], [663, 138]],
    sha256: [
      '033addf4029874bc31e446fa88deaefa3de02a435639b1fe8be7177e286071bb',
      '432223981f8d3c0c4280a6b7dc59b48a0efdb1f54386bf565774624a43323af1',
    ],
  },
  'Leaderboard/leaderboard_combo_bird.png': {
    bytes: [6_855, 10_356],
    dimensions: [[466, 115], [663, 137]],
    sha256: [
      '18d8815f0e793885a9530fc4c341e6455f4a0a3e698e1fd4ee2828cc3c824a26',
      '4b4ef14177494d438ba89715f42c19e9aaa778b3b55b9f16d8f717756462b04f',
    ],
  },
  'Buttons/button-blue-back-normal.png': {
    bytes: [7_691, 12_033],
    dimensions: [[144, 124], [180, 150]],
    sha256: [
      'a978ec6a5f7ee20f54c077bd13f94177e233dbb9cded18af239896e4a87066ef',
      '451a19fde28ef07ce3df1991ab2adfb24e65a19279c0e59860ec5c6a67a9dbec',
    ],
  },
  'Buttons/button-back-selected.png': {
    bytes: [6_304, 9_445],
    dimensions: [[144, 124], [181, 150]],
    sha256: [
      '15afb10b1f0c49731a30ae9c1e1b1def410c55b4f9101e95b8ff6d4b190a8641',
      '1b2bffab9db409a92ad97b8fae0a9d866fc6baaf49698e3ab97a38d5826d26ab',
    ],
  },
} as const);

test('both profiles expose exactly ten native Leaderboard rasters with recovered bytes', () => {
  assert.equal(LEADERBOARD_RASTER_RESOURCE_COUNT, 10);
  assert.equal(Object.keys(EXPECTED_RASTER_FILES).length, 10);

  for (const [treeIndex, tree] of (['480x800', '720x1280'] as const).entries()) {
    const resources = collectProfileRasters(getLeaderboardRasterResources(tree));
    assert.equal(resources.length, LEADERBOARD_RASTER_RESOURCE_COUNT);
    assert.equal(
      new Set(resources.map(({ canonicalPath }) => canonicalPath)).size,
      LEADERBOARD_RASTER_RESOURCE_COUNT,
    );
    assert.deepEqual(
      resources.map(({ canonicalPath }) => canonicalPath),
      Object.keys(EXPECTED_RASTER_FILES).map((path) => `${tree}/${path}`),
    );

    for (const resource of resources) {
      const logicalPath = stripTree(resource.canonicalPath);
      const expected = EXPECTED_RASTER_FILES[
        logicalPath as keyof typeof EXPECTED_RASTER_FILES
      ];
      assert.ok(expected, resource.canonicalPath);
      const [width, height] = expected.dimensions[treeIndex];
      assert.deepEqual(resource.dimensions, { height, width }, resource.canonicalPath);

      const image = readBinary(`game/assets/game/${resource.canonicalPath}`);
      assert.equal(image.readUInt32BE(16), width, `${resource.canonicalPath} PNG width`);
      assert.equal(image.readUInt32BE(20), height, `${resource.canonicalPath} PNG height`);
      assert.equal(image.length, expected.bytes[treeIndex], resource.canonicalPath);
      assert.equal(sha256(image), expected.sha256[treeIndex], resource.canonicalPath);

      const staged = STAGED_ENTRIES.get(resource.canonicalPath);
      assert.ok(staged, resource.canonicalPath);
      assert.equal(staged.targetPath, `game/assets/game/${resource.canonicalPath}`);
      assert.equal(staged.cocosType, 'cc.ImageAsset');
      assert.equal(staged.bytes, expected.bytes[treeIndex]);
      assert.equal(staged.sha256, expected.sha256[treeIndex]);
    }
  }
  assertDeepFrozen(LEADERBOARD_RASTER_RESOURCES);
});

test('semantic fields preserve native mode order and the asymmetric Button Back pair', () => {
  const low = getLeaderboardRasterResources('480x800');
  assert.deepEqual(
    collectProfileRasters(low).map(({ canonicalPath }) => stripTree(canonicalPath)),
    Object.keys(EXPECTED_RASTER_FILES),
  );
  assert.equal(
    low.back.normal.canonicalPath,
    '480x800/Buttons/button-blue-back-normal.png',
  );
  assert.equal(
    low.back.selected.canonicalPath,
    '480x800/Buttons/button-back-selected.png',
  );

  const high = getLeaderboardRasterResources('720x1280');
  assert.deepEqual(high.headers.classic.dimensions, { height: 137, width: 663 });
  assert.deepEqual(high.headers.crazy.dimensions, { height: 137, width: 663 });
  assert.deepEqual(high.headers.gnStyle.dimensions, { height: 138, width: 663 });
  assert.deepEqual(high.headers.classicBird.dimensions, { height: 137, width: 663 });
  assert.deepEqual(high.headers.crazyBird.dimensions, { height: 138, width: 663 });
  assert.deepEqual(high.headers.comboBird.dimensions, { height: 137, width: 663 });
  assert.deepEqual(high.back.normal.dimensions, { height: 150, width: 180 });
  assert.deepEqual(high.back.selected.dimensions, { height: 150, width: 181 });
  assert.equal(
    collectProfileRasters(high).some(({ canonicalPath }) => (
      canonicalPath.includes('/Icons/back-button')
    )),
    false,
  );
});

test('Andyb, Century, and menu-button click preserve exact shared file contracts', () => {
  assert.equal(LEADERBOARD_PLAYER_FONT_CANONICAL_PATH, 'Fonts/Andyb.ttf');
  assert.equal(LEADERBOARD_SCORE_FONT_CANONICAL_PATH, 'Fonts/Century.ttf');
  assert.equal(LEADERBOARD_MENU_BUTTON_AUDIO_CANONICAL_PATH, 'Sounds/menubuttonclick.wav');
  assert.equal(LEADERBOARD_BACK_AUDIO_CANONICAL_PATH, 'Sounds/menubuttonclick.wav');
  assert.deepEqual(LEADERBOARD_SHARED_RESOURCES, {
    playerFont: {
      bytes: 42_432,
      canonicalPath: 'Fonts/Andyb.ttf',
      kind: 'font',
      sha256: '13cb6762ba5a38853bc338367178b1c7647ad3d2fc407e8953afdc42b1af12d6',
    },
    scoreFont: {
      bytes: 165_248,
      canonicalPath: 'Fonts/Century.ttf',
      kind: 'font',
      sha256: '21be61ff5289c2125dbb48e2a739fd4dd98c3e58b37abfc22cc0412dd8376d95',
    },
    menuButtonClick: {
      bytes: 32_812,
      canonicalPath: 'Sounds/menubuttonclick.wav',
      kind: 'audio',
      sha256: '3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e',
    },
  });

  for (const resource of Object.values(LEADERBOARD_SHARED_RESOURCES)) {
    const content = readBinary(`game/assets/game/${resource.canonicalPath}`);
    assert.equal(content.length, resource.bytes, resource.canonicalPath);
    assert.equal(sha256(content), resource.sha256, resource.canonicalPath);
    const staged = STAGED_ENTRIES.get(resource.canonicalPath);
    assert.ok(staged, resource.canonicalPath);
    assert.equal(staged.targetPath, `game/assets/game/${resource.canonicalPath}`);
    assert.equal(staged.bytes, resource.bytes);
    assert.equal(staged.sha256, resource.sha256);
    assert.equal(staged.cocosType, resource.kind === 'font' ? 'cc.TTFFont' : 'cc.AudioClip');
  }
  assertDeepFrozen(LEADERBOARD_SHARED_RESOURCES);
});

test('resource getter rejects every noncanonical asset tree without fallback', () => {
  assert.throws(() => getLeaderboardRasterResources('1080x1920' as never), RangeError);
  assert.throws(
    () => getLeaderboardRasterResources('phone' as never),
    /480x800 or 720x1280/,
  );
});

test('Leaderboard contract and loader metadata use valid distinct Creator UUIDs', () => {
  const metadata = [
    'game/assets/scripts/domain/leaderboard-resource-contract.ts.meta',
    'game/assets/scripts/creator/leaderboard-resource-loader.ts.meta',
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

interface RasterResource {
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{ readonly height: number; readonly width: number }>;
}

function collectProfileRasters(profile: {
  readonly back: {
    readonly normal: RasterResource;
    readonly selected: RasterResource;
  };
  readonly headers: {
    readonly classic: RasterResource;
    readonly classicBird: RasterResource;
    readonly comboBird: RasterResource;
    readonly crazy: RasterResource;
    readonly crazyBird: RasterResource;
    readonly gnStyle: RasterResource;
  };
  readonly template: RasterResource;
  readonly title: RasterResource;
}): readonly RasterResource[] {
  return [
    profile.title,
    profile.template,
    profile.headers.classic,
    profile.headers.crazy,
    profile.headers.gnStyle,
    profile.headers.classicBird,
    profile.headers.crazyBird,
    profile.headers.comboBird,
    profile.back.normal,
    profile.back.selected,
  ];
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

function stripTree(canonicalPath: string): string {
  return canonicalPath.replace(/^(?:480x800|720x1280)\//, '');
}

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

function readBinary(relativePath: string): Buffer {
  return readFileSync(`${REPOSITORY_ROOT}${relativePath}`);
}

function readText(relativePath: string): string {
  return readFileSync(`${REPOSITORY_ROOT}${relativePath}`, 'utf8');
}
