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
  MAIN_MENU_FRUIT_BUTTON_DEFINITIONS,
  MAIN_MENU_FRUIT_BUTTON_PURPOSE_ORDER,
  MAIN_MENU_FRUIT_CUT_AUDIO_BY_ID,
  MAIN_MENU_PROHIBITED_REVIEW_LOGICAL_PATHS,
  MAIN_MENU_RASTER_RESOURCES,
  MAIN_MENU_SHARED_RESOURCES,
  assertMainMenuResourcePathAllowed,
  getMainMenuFruitButtonDefinition,
  getMainMenuFruitButtonDefinitionById,
  getMainMenuFruitButtonResources,
  getMainMenuRasterResources,
  isMainMenuProhibitedReviewPath,
} = await import('../../../game/assets/scripts/domain/main-menu-resource-contract.ts');

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

const EXPECTED_RASTER_DIMENSIONS = Object.freeze({
  'Buttons/button-about-normal.png': [[87, 116], [125, 139]],
  'Buttons/button-about-selected.png': [[87, 116], [124, 139]],
  'Buttons/button-black-wheel-normal.png': [[49, 48], [72, 72]],
  'Buttons/button-blue-wheel-normal.png': [[109, 107], [161, 160]],
  'Buttons/button-blue-wheel-selected.png': [[109, 107], [161, 160]],
  'Buttons/button-circle-blur.png': [[235, 250], [316, 339]],
  'Buttons/button-circle-leaderboard.png': [[237, 256], [319, 347]],
  'Buttons/button-circle-newgame.png': [[254, 263], [344, 358]],
  'Buttons/button-circle-objectives.png': [[254, 263], [344, 358]],
  'Buttons/button-effects-disable.png': [[80, 99], [119, 148]],
  'Buttons/button-effects-normal.png': [[80, 100], [119, 149]],
  'Buttons/button-effects-selected.png': [[80, 99], [119, 149]],
  'Buttons/button-exit-normal.png': [[141, 184], [182, 249]],
  'Buttons/button-exit-selected.png': [[141, 184], [182, 249]],
  'Buttons/button-music-disable.png': [[91, 95], [136, 142]],
  'Buttons/button-music-normal.png': [[91, 94], [136, 141]],
  'Buttons/button-music-selected.png': [[91, 95], [136, 141]],
  'Buttons/button-orange-wheel-normal.png': [[71, 70], [105, 104]],
  'Fruits/fruit-electric-apple-cut-bottom.png': [[95, 47], [142, 69]],
  'Fruits/fruit-electric-apple-cut-top.png': [[88, 50], [130, 74]],
  'Fruits/fruit-electric-apple.png': [[96, 82], [143, 122]],
  'Fruits/fruit-orange-cut-bottom.png': [[73, 53], [110, 79]],
  'Fruits/fruit-orange-cut-top.png': [[74, 80], [110, 119]],
  'Fruits/fruit-orange.png': [[75, 101], [112, 152]],
  'Fruits/fruit-strawberry-cut-bottom.png': [[79, 36], [118, 54]],
  'Fruits/fruit-strawberry-cut-top.png': [[84, 39], [125, 58]],
  'Fruits/fruit-strawberry.png': [[83, 64], [125, 96]],
  'Interfaces/heart.png': [[30, 33], [44, 50]],
  'Interfaces/pencilblade.png': [[454, 233], [667, 342]],
  'Interfaces/pencilbladebk.png': [[480, 292], [720, 438]],
  'Interfaces/reviewbutton.png': [[70, 66], [87, 82]],
  'Interfaces/reviewbuttonselected.png': [[70, 66], [87, 82]],
  'Interfaces/total-coins.png': [[334, 131], [464, 160]],
} as const);

test('both profiles expose the exact 33 recovered Main Menu rasters and staged dimensions', () => {
  for (const [treeIndex, tree] of (['480x800', '720x1280'] as const).entries()) {
    const resources = collectRasterResources(getMainMenuRasterResources(tree));
    assert.equal(resources.size, 33);
    assert.deepEqual(
      [...resources.keys()].sort(),
      Object.keys(EXPECTED_RASTER_DIMENSIONS).sort().map((path) => `${tree}/${path}`),
    );

    for (const [logicalPath, pairedDimensions] of Object.entries(EXPECTED_RASTER_DIMENSIONS)) {
      const canonicalPath = `${tree}/${logicalPath}`;
      const resource = resources.get(canonicalPath);
      assert.ok(resource, canonicalPath);
      const [width, height] = pairedDimensions[treeIndex];
      assert.deepEqual(resource.dimensions, { height, width }, canonicalPath);

      const image = readBinary(`game/assets/game/${canonicalPath}`);
      assert.equal(image.readUInt32BE(16), width, `${canonicalPath} PNG width`);
      assert.equal(image.readUInt32BE(20), height, `${canonicalPath} PNG height`);
      const staged = STAGED_ENTRIES.get(canonicalPath);
      assert.ok(staged, canonicalPath);
      assert.equal(staged.targetPath, `game/assets/game/${canonicalPath}`);
      assert.equal(staged.cocosType, 'cc.ImageAsset');
      assert.equal(staged.bytes, image.length);
      assert.equal(staged.sha256, sha256(image));
    }
  }
  assertDeepFrozen(MAIN_MENU_RASTER_RESOURCES);
});

test('shared font and four audio files preserve exact path, byte count, hash, and staging type', () => {
  assert.deepEqual(MAIN_MENU_SHARED_RESOURCES, {
    font: {
      bytes: 161488,
      canonicalPath: 'Fonts/SlabThing.ttf',
      kind: 'font',
      sha256: '9e07461cbe34a525fe36222710f6067712c6a956f732e2a0d963bdb3d7e151a8',
    },
    mainMenuMusic: {
      bytes: 718785,
      canonicalPath: 'Sounds/mainmenumusic.mp3',
      kind: 'audio',
      sha256: '53378d6d153e22fa9b0b5a64c8c130e58f0c3ae649ad3750e921d839c45151a1',
    },
    mangosteenCut: {
      bytes: 11052,
      canonicalPath: 'Sounds/mangosteen.wav',
      kind: 'audio',
      sha256: '0e93927c2044446d69c8b591818cd54294dbf260454204bda5c32a7ade5128e6',
    },
    menuButtonClick: {
      bytes: 32812,
      canonicalPath: 'Sounds/menubuttonclick.wav',
      kind: 'audio',
      sha256: '3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e',
    },
    strawberryCut: {
      bytes: 10284,
      canonicalPath: 'Sounds/strawberry.wav',
      kind: 'audio',
      sha256: 'b612419c6046ebe49666788fbc84787494667bbfcc121f21a242d9e13bc69a59',
    },
  });

  for (const resource of Object.values(MAIN_MENU_SHARED_RESOURCES)) {
    const content = readBinary(`game/assets/game/${resource.canonicalPath}`);
    assert.equal(content.length, resource.bytes, resource.canonicalPath);
    assert.equal(sha256(content), resource.sha256, resource.canonicalPath);
    const staged = STAGED_ENTRIES.get(resource.canonicalPath);
    assert.ok(staged, resource.canonicalPath);
    assert.equal(staged.cocosType, resource.kind === 'font' ? 'cc.TTFFont' : 'cc.AudioClip');
  }
  assertDeepFrozen(MAIN_MENU_SHARED_RESOURCES);
});

test('three FruitButton IDs preserve exact art, circle, purpose, and counterintuitive audio branches', () => {
  assert.deepEqual(MAIN_MENU_FRUIT_BUTTON_PURPOSE_ORDER, [
    'leaderboard',
    'objectives',
    'new-game',
  ]);
  assert.deepEqual(MAIN_MENU_FRUIT_BUTTON_DEFINITIONS.map((definition) => ({
    audio: definition.cutAudioCanonicalPath,
    circle: stripTree(definition.rasters['480x800'].circle.canonicalPath),
    fruitId: definition.fruitId,
    fruitName: definition.fruitName,
    purpose: definition.purpose,
  })), [
    {
      audio: 'Sounds/mangosteen.wav',
      circle: 'Buttons/button-circle-leaderboard.png',
      fruitId: 13,
      fruitName: 'electric-apple',
      purpose: 'leaderboard',
    },
    {
      audio: 'Sounds/strawberry.wav',
      circle: 'Buttons/button-circle-objectives.png',
      fruitId: 7,
      fruitName: 'orange',
      purpose: 'objectives',
    },
    {
      audio: 'Sounds/strawberry.wav',
      circle: 'Buttons/button-circle-newgame.png',
      fruitId: 2,
      fruitName: 'strawberry',
      purpose: 'new-game',
    },
  ]);
  assert.deepEqual(MAIN_MENU_FRUIT_CUT_AUDIO_BY_ID, {
    2: 'Sounds/strawberry.wav',
    7: 'Sounds/strawberry.wav',
    13: 'Sounds/mangosteen.wav',
  });
  assert.equal(getMainMenuFruitButtonDefinition('leaderboard').fruitId, 13);
  assert.equal(getMainMenuFruitButtonDefinitionById(7).purpose, 'objectives');
  assert.equal(
    getMainMenuFruitButtonResources('new-game', '720x1280').intact.canonicalPath,
    '720x1280/Fruits/fruit-strawberry.png',
  );
  assertDeepFrozen(MAIN_MENU_FRUIT_BUTTON_DEFINITIONS);
});

test('wrong review art is explicitly prohibited and absent from the catalog', () => {
  assert.deepEqual(MAIN_MENU_PROHIBITED_REVIEW_LOGICAL_PATHS, [
    'Buttons/button-review-normal.png',
    'Buttons/button-review-selected.png',
  ]);
  assert.equal(isMainMenuProhibitedReviewPath('Buttons/button-review-normal.png'), true);
  assert.equal(
    isMainMenuProhibitedReviewPath('720x1280/Buttons/button-review-selected.png'),
    true,
  );
  assert.equal(isMainMenuProhibitedReviewPath('480x800/Interfaces/reviewbutton.png'), false);
  assert.throws(
    () => assertMainMenuResourcePathAllowed('480x800/Buttons/button-review-normal.png'),
    /Interfaces\/reviewbutton/,
  );

  const allPaths = new Set([
    ...collectRasterResources(MAIN_MENU_RASTER_RESOURCES['480x800']).keys(),
    ...collectRasterResources(MAIN_MENU_RASTER_RESOURCES['720x1280']).keys(),
  ]);
  for (const path of allPaths) {
    assert.equal(isMainMenuProhibitedReviewPath(path), false, path);
    assert.doesNotMatch(path, /placeholder|button-review-/i);
  }
  assert.equal(
    MAIN_MENU_RASTER_RESOURCES['480x800'].review.normal.canonicalPath,
    '480x800/Interfaces/reviewbutton.png',
  );
  assert.equal(
    MAIN_MENU_RASTER_RESOURCES['720x1280'].review.selected.canonicalPath,
    '720x1280/Interfaces/reviewbuttonselected.png',
  );
});

test('resource getters reject invalid identifiers and trees', () => {
  assert.throws(() => getMainMenuRasterResources('1080x1920' as never), RangeError);
  assert.throws(() => getMainMenuFruitButtonDefinition('arcade' as never), RangeError);
  assert.throws(() => getMainMenuFruitButtonDefinitionById(Number.NaN), TypeError);
  assert.throws(() => getMainMenuFruitButtonDefinitionById(8), RangeError);
  assert.throws(
    () => getMainMenuFruitButtonResources('leaderboard', 'invalid' as never),
    RangeError,
  );
  assert.throws(() => isMainMenuProhibitedReviewPath(''), TypeError);
});

test('new Creator TypeScript metadata uses valid distinct UUIDs', () => {
  const paths = [
    'game/assets/scripts/domain/main-menu-resource-contract.ts.meta',
    'game/assets/scripts/domain/main-menu-presentation.ts.meta',
    'game/assets/scripts/domain/main-menu-state.ts.meta',
  ];
  const metadata = paths.map((path) => readJson<{
    readonly files: readonly unknown[];
    readonly imported: boolean;
    readonly importer: string;
    readonly subMetas: Readonly<Record<string, unknown>>;
    readonly userData: Readonly<Record<string, unknown>>;
    readonly uuid: string;
    readonly ver: string;
  }>(path));
  assert.equal(new Set(metadata.map(({ uuid }) => uuid)).size, 3);
  for (const meta of metadata) {
    assert.match(meta.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
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

function collectRasterResources(value: unknown): Map<string, {
  readonly canonicalPath: string;
  readonly dimensions: { readonly height: number; readonly width: number };
}> {
  const resources = new Map<string, {
    readonly canonicalPath: string;
    readonly dimensions: { readonly height: number; readonly width: number };
  }>();
  visit(value);
  return resources;

  function visit(candidate: unknown): void {
    if (candidate === null || typeof candidate !== 'object') {
      return;
    }
    if (
      'canonicalPath' in candidate
      && 'dimensions' in candidate
      && typeof candidate.canonicalPath === 'string'
      && candidate.dimensions !== null
      && typeof candidate.dimensions === 'object'
      && 'width' in candidate.dimensions
      && 'height' in candidate.dimensions
    ) {
      resources.set(candidate.canonicalPath, candidate as {
        readonly canonicalPath: string;
        readonly dimensions: { readonly height: number; readonly width: number };
      });
      return;
    }
    for (const child of Object.values(candidate)) {
      visit(child);
    }
  }
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
