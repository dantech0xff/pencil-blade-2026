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
  MODE_SELECT_CARD_DEFINITIONS,
  MODE_SELECT_CARD_PURPOSE_ORDER,
  MODE_SELECT_FRUIT_CUT_AUDIO_BY_ID,
  MODE_SELECT_PROHIBITED_DESCRIPTION_LOGICAL_PATHS,
  MODE_SELECT_RASTER_RESOURCES,
  MODE_SELECT_SHARED_RESOURCES,
  assertModeSelectResourcePathAllowed,
  getModeSelectCardDefinition,
  getModeSelectCardDefinitionByFruitId,
  getModeSelectCardResources,
  getModeSelectRasterResources,
  isModeSelectProhibitedDescriptionPath,
} = await import('../../../game/assets/scripts/domain/mode-select-resource-contract.ts');

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
  'Blades/Particles/X-Mas/xmasfive.png': [[46, 44], [66, 64]],
  'Buttons/button-back-selected.png': [[144, 124], [181, 150]],
  'Buttons/button-blue-back-normal.png': [[144, 124], [180, 150]],
  'Buttons/button-circle-blur.png': [[235, 250], [316, 339]],
  'Buttons/button-unlock-selected.png': [[159, 43], [239, 65]],
  'Buttons/button-unlock.png': [[159, 43], [238, 64]],
  'Fruits/fruit-apple-cut-bottom.png': [[95, 47], [131, 74]],
  'Fruits/fruit-apple-cut-top.png': [[87, 50], [143, 69]],
  'Fruits/fruit-apple.png': [[96, 82], [143, 122]],
  'Fruits/fruit-banana-cut-bottom.png': [[46, 78], [68, 117]],
  'Fruits/fruit-banana-cut-top.png': [[60, 89], [90, 134]],
  'Fruits/fruit-banana.png': [[60, 154], [89, 231]],
  'Fruits/fruit-kiwi-cut-bottom.png': [[63, 54], [93, 79]],
  'Fruits/fruit-kiwi-cut-top.png': [[63, 58], [93, 87]],
  'Fruits/fruit-kiwi.png': [[63, 81], [94, 121]],
  'Fruits/fruit-magnetstrawberry-cut-bottom.png': [[79, 44], [117, 54]],
  'Fruits/fruit-magnetstrawberry-cut-top.png': [[83, 39], [125, 58]],
  'Fruits/fruit-magnetstrawberry.png': [[83, 64], [125, 95]],
  'Fruits/fruit-orange-cut-bottom.png': [[73, 53], [110, 79]],
  'Fruits/fruit-orange-cut-top.png': [[74, 80], [110, 119]],
  'Fruits/fruit-orange.png': [[75, 101], [112, 152]],
  'Fruits/fruit-strawberry-cut-bottom.png': [[79, 36], [118, 54]],
  'Fruits/fruit-strawberry-cut-top.png': [[84, 39], [125, 58]],
  'Fruits/fruit-strawberry.png': [[83, 64], [125, 96]],
  'Interfaces/mode-classic-bird.png': [[254, 263], [345, 358]],
  'Interfaces/mode-classic.png': [[204, 212], [344, 358]],
  'Interfaces/mode-combo-bird.png': [[254, 263], [344, 358]],
  'Interfaces/mode-crazy-bird.png': [[254, 263], [345, 358]],
  'Interfaces/mode-crazy.png': [[205, 206], [344, 351]],
  'Interfaces/mode-gnstyle.png': [[216, 225], [325, 338]],
  'Interfaces/modeselect.png': [[552, 118], [792, 159]],
  'Interfaces/object-classic-bird-des.png': [[149, 202], [223, 301]],
  'Interfaces/object-classic-des.png': [[149, 202], [223, 301]],
  'Interfaces/object-combo-bird-des.png': [[149, 202], [223, 301]],
  'Interfaces/object-combo-des.png': [[149, 202], [223, 301]],
  'Interfaces/object-crazy-bird-des.png': [[149, 202], [223, 301]],
  'Interfaces/object-crazy-des.png': [[149, 202], [223, 301]],
  'Interfaces/object-des-shader.png': [[217, 267], [290, 363]],
  'Interfaces/object-long-rope.png': [[1515, 77], [868, 77]],
  'Interfaces/object-rope-node.png': [[7, 14], [11, 21]],
  'Interfaces/object-wheel-connect.png': [[8, 49], [12, 73]],
  'Interfaces/object-wheel.png': [[30, 30], [45, 44]],
} as const);

test('both profiles expose exactly 42 direct rasters with exact staged bytes, hashes, and dimensions', () => {
  for (const [treeIndex, tree] of (['480x800', '720x1280'] as const).entries()) {
    const resources = collectRasterResources(getModeSelectRasterResources(tree));
    assert.equal(resources.size, 42);
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
      assert.equal(staged.bytes, image.length, `${canonicalPath} staged bytes`);
      assert.equal(staged.sha256, sha256(image), `${canonicalPath} staged SHA-256`);
    }
  }
  assertDeepFrozen(MODE_SELECT_RASTER_RESOURCES);
});

test('shared font and six audio consumers preserve exact path, bytes, hash, and staging type', () => {
  assert.deepEqual(MODE_SELECT_SHARED_RESOURCES, {
    appleCut: {
      bytes: 10364,
      canonicalPath: 'Sounds/apple.wav',
      kind: 'audio',
      sha256: '7565f786f0bd0bbda14d646c2c33993941ee7869c588be836c1eaca96ba5cef8',
    },
    bananaCut: {
      bytes: 9964,
      canonicalPath: 'Sounds/banana.wav',
      kind: 'audio',
      sha256: 'f3ce9f1f6626b7657a7036fd96d8448ec1211ddc5f0102ddef327b66ef931d99',
    },
    font: {
      bytes: 161488,
      canonicalPath: 'Fonts/SlabThing.ttf',
      kind: 'font',
      sha256: '9e07461cbe34a525fe36222710f6067712c6a956f732e2a0d963bdb3d7e151a8',
    },
    gameplaySelected: {
      bytes: 132344,
      canonicalPath: 'Sounds/gameplayselected.wav',
      kind: 'audio',
      sha256: 'b1826f8db97e2517363ce1f7a385181867be33ff55828fe1baca75d1227f9a84',
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

  for (const resource of Object.values(MODE_SELECT_SHARED_RESOURCES)) {
    const content = readBinary(`game/assets/game/${resource.canonicalPath}`);
    assert.equal(content.length, resource.bytes, resource.canonicalPath);
    assert.equal(sha256(content), resource.sha256, resource.canonicalPath);
    const staged = STAGED_ENTRIES.get(resource.canonicalPath);
    assert.ok(staged, resource.canonicalPath);
    assert.equal(staged.bytes, resource.bytes);
    assert.equal(staged.sha256, resource.sha256);
    assert.equal(staged.cocosType, resource.kind === 'font' ? 'cc.TTFFont' : 'cc.AudioClip');
  }
  assertDeepFrozen(MODE_SELECT_SHARED_RESOURCES);
});

test('all six cards preserve destination, Fruit, audio, description, and Settings-lock mapping', () => {
  assert.deepEqual(MODE_SELECT_CARD_PURPOSE_ORDER, [
    'classic',
    'crazy',
    'gn-style',
    'classic-bird',
    'crazy-bird',
    'combo-bird',
  ]);
  assert.deepEqual(MODE_SELECT_CARD_DEFINITIONS.map((definition) => ({
    audio: definition.cutAudioCanonicalPath,
    description: stripTree(definition.rasters['480x800'].description.canonicalPath),
    destination: definition.destination,
    destinationState: definition.destinationState,
    fruitId: definition.fruitId,
    fruitName: definition.fruitName,
    purpose: definition.purpose,
    unlock: definition.unlock,
  })), [
    {
      audio: 'Sounds/apple.wav',
      description: 'Interfaces/object-classic-des.png',
      destination: 'ClassicModeLayer',
      destinationState: 0,
      fruitId: 0,
      fruitName: 'apple',
      purpose: 'classic',
      unlock: {
        alwaysUnlocked: true,
        defaultValue: null,
        modeIndex: 0,
        readsSettings: false,
        storageKey: null,
      },
    },
    {
      audio: 'Sounds/banana.wav',
      description: 'Interfaces/object-crazy-des.png',
      destination: 'CrazyModeLayer',
      destinationState: 1,
      fruitId: 1,
      fruitName: 'banana',
      purpose: 'crazy',
      unlock: {
        alwaysUnlocked: false,
        defaultValue: false,
        modeIndex: 1,
        readsSettings: true,
        storageKey: 'mode_unlock_1',
      },
    },
    {
      audio: 'Sounds/strawberry.wav',
      description: 'Interfaces/object-combo-des.png',
      destination: 'GNStyleLayer',
      destinationState: 2,
      fruitId: 2,
      fruitName: 'strawberry',
      purpose: 'gn-style',
      unlock: {
        alwaysUnlocked: false,
        defaultValue: false,
        modeIndex: 2,
        readsSettings: true,
        storageKey: 'mode_unlock_2',
      },
    },
    {
      audio: 'Sounds/strawberry.wav',
      description: 'Interfaces/object-classic-bird-des.png',
      destination: 'ClassicBirdLayer',
      destinationState: 3,
      fruitId: 7,
      fruitName: 'orange',
      purpose: 'classic-bird',
      unlock: {
        alwaysUnlocked: true,
        defaultValue: null,
        modeIndex: 3,
        readsSettings: false,
        storageKey: null,
      },
    },
    {
      audio: 'Sounds/mangosteen.wav',
      description: 'Interfaces/object-crazy-bird-des.png',
      destination: 'CrazyBirdLayer',
      destinationState: 4,
      fruitId: 14,
      fruitName: 'magnetstrawberry',
      purpose: 'crazy-bird',
      unlock: {
        alwaysUnlocked: false,
        defaultValue: false,
        modeIndex: 4,
        readsSettings: true,
        storageKey: 'mode_unlock_4',
      },
    },
    {
      audio: 'Sounds/apple.wav',
      description: 'Interfaces/object-combo-bird-des.png',
      destination: 'ComboBirdLayer',
      destinationState: 5,
      fruitId: 6,
      fruitName: 'kiwi',
      purpose: 'combo-bird',
      unlock: {
        alwaysUnlocked: false,
        defaultValue: false,
        modeIndex: 5,
        readsSettings: true,
        storageKey: 'mode_unlock_5',
      },
    },
  ]);
  assert.deepEqual(MODE_SELECT_FRUIT_CUT_AUDIO_BY_ID, {
    0: 'Sounds/apple.wav',
    1: 'Sounds/banana.wav',
    2: 'Sounds/strawberry.wav',
    6: 'Sounds/apple.wav',
    7: 'Sounds/strawberry.wav',
    14: 'Sounds/mangosteen.wav',
  });
  assert.equal(getModeSelectCardDefinition(3).destination, 'ClassicBirdLayer');
  assert.equal(getModeSelectCardDefinitionByFruitId(14).destinationState, 4);
  assert.equal(
    getModeSelectCardResources(2, '720x1280').description.canonicalPath,
    '720x1280/Interfaces/object-combo-des.png',
  );
  assertDeepFrozen(MODE_SELECT_CARD_DEFINITIONS);
});

test('GN Style semantic normalization and placeholder substitutions are prohibited', () => {
  assert.deepEqual(MODE_SELECT_PROHIBITED_DESCRIPTION_LOGICAL_PATHS, [
    'Interfaces/object-gnstyle-des.png',
  ]);
  assert.equal(
    isModeSelectProhibitedDescriptionPath('Interfaces/object-gnstyle-des.png'),
    true,
  );
  assert.equal(
    isModeSelectProhibitedDescriptionPath('720x1280/Interfaces/object-gnstyle-des.png'),
    true,
  );
  assert.equal(
    isModeSelectProhibitedDescriptionPath('480x800/Interfaces/object-combo-des.png'),
    false,
  );
  assert.throws(
    () => assertModeSelectResourcePathAllowed(
      '480x800/Interfaces/object-gnstyle-des.png',
    ),
    /object-combo-des/,
  );

  for (const tree of ['480x800', '720x1280'] as const) {
    const paths = collectRasterResources(MODE_SELECT_RASTER_RESOURCES[tree]).keys();
    for (const path of paths) {
      assert.equal(isModeSelectProhibitedDescriptionPath(path), false, path);
      assert.doesNotMatch(path, /placeholder|object-gnstyle-des/i);
    }
  }
});

test('resource getters reject invalid trees, card IDs, fruit IDs, and empty paths', () => {
  assert.throws(() => getModeSelectRasterResources('1080x1920' as never), RangeError);
  assert.throws(() => getModeSelectCardDefinition(-1), RangeError);
  assert.throws(() => getModeSelectCardDefinition(6), RangeError);
  assert.throws(() => getModeSelectCardDefinitionByFruitId(Number.NaN), TypeError);
  assert.throws(() => getModeSelectCardDefinitionByFruitId(8), RangeError);
  assert.throws(() => getModeSelectCardResources(0, 'invalid' as never), RangeError);
  assert.throws(() => isModeSelectProhibitedDescriptionPath(''), TypeError);
});

test('Mode Select TypeScript metadata uses valid distinct Creator UUIDs', () => {
  const paths = [
    'game/assets/scripts/domain/mode-select-resource-contract.ts.meta',
    'game/assets/scripts/domain/mode-select-presentation.ts.meta',
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
  assert.equal(new Set(metadata.map(({ uuid }) => uuid)).size, 2);
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
