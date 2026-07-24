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
  OPTIONS_BACK_AUDIO_CANONICAL_PATH,
  OPTIONS_BLADE_ROW_AUDIO_CANONICAL_PATH,
  OPTIONS_FONT_CANONICAL_PATH,
  OPTIONS_MENU_BUTTON_AUDIO_CANONICAL_PATH,
  OPTIONS_RASTER_RESOURCE_COUNT,
  OPTIONS_RASTER_RESOURCES,
  OPTIONS_SELECTION_AUDIO_CANONICAL_PATH,
  OPTIONS_SHARED_RESOURCES,
  OPTIONS_THEME_ROW_AUDIO_CANONICAL_PATH,
  getOptionsRasterResources,
} = await import('../../../game/assets/scripts/domain/options-resource-contract.ts');

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
  'Options/options-title.png': [[552, 118], [792, 159]],
  'Options/options-backgrounds.png': [[552, 74], [792, 80]],
  'Options/options-blade.png': [[552, 74], [792, 80]],
  'Options/options-themes.png': [[552, 74], [792, 80]],
  'Icons/icon-image-background.png': [[139, 139], [208, 208]],
  'Icons/icon-button-prev.png': [[173, 141], [223, 175]],
  'Icons/icon-button-prev-selected.png': [[173, 141], [223, 175]],
  'Icons/icon-button-next.png': [[173, 141], [223, 175]],
  'Icons/icon-button-next-selected.png': [[173, 141], [223, 175]],
  'Icons/back-button.png': [[135, 113], [166, 134]],
  'Icons/back-button-selected.png': [[135, 113], [166, 134]],
  'Buttons/button-buyitem-normal.png': [[133, 36], [200, 54]],
  'Buttons/button-buyitem-selected.png': [[133, 36], [200, 54]],
  'Interfaces/total-coins.png': [[334, 131], [464, 160]],
  'Blades/Particles/X-Mas/xmasfive.png': [[46, 44], [66, 64]],
  'Icons/theme-icon-0.png': [[117, 116], [175, 175]],
  'Icons/theme-icon-1.png': [[117, 117], [175, 175]],
  'Icons/theme-icon-2.png': [[117, 117], [175, 175]],
  'Icons/theme-icon-3.png': [[117, 117], [175, 175]],
  'Icons/theme-icon-4.png': [[117, 117], [175, 175]],
  'Icons/theme-icon-5.png': [[116, 117], [175, 175]],
  'Icons/theme-icon-6.png': [[117, 117], [175, 175]],
  'Icons/theme-icon-7.png': [[117, 116], [175, 174]],
  'Icons/theme-icon-8.png': [[116, 116], [175, 174]],
  'Icons/theme-icon-9.png': [[117, 116], [175, 174]],
  'Icons/blade-icon-0.png': [[131, 129], [197, 194]],
  'Icons/blade-icon-1.png': [[131, 129], [197, 194]],
  'Icons/blade-icon-2.png': [[131, 129], [197, 194]],
  'Icons/blade-icon-3.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-4.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-5.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-6.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-7.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-8.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-9.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-10.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-11.png': [[131, 129], [197, 193]],
  'Icons/blade-icon-12.png': [[132, 130], [196, 194]],
  'Icons/blade-icon-13.png': [[131, 130], [197, 193]],
  'Icons/blade-icon-14.png': [[132, 129], [197, 194]],
  'Icons/blade-icon-15.png': [[131, 130], [197, 193]],
  'Icons/blade-icon-16.png': [[132, 129], [197, 193]],
  'Icons/blade-icon-17.png': [[132, 130], [196, 194]],
  'Icons/background-icon-0.png': [[117, 117], [175, 175]],
  'Icons/background-icon-1.png': [[117, 117], [175, 175]],
  'Icons/background-icon-2.png': [[118, 139], [176, 175]],
  'Icons/background-icon-3.png': [[118, 117], [176, 175]],
  'Icons/background-icon-4.png': [[118, 117], [177, 175]],
  'Icons/background-icon-5.png': [[118, 117], [177, 175]],
  'Icons/background-icon-6.png': [[118, 117], [177, 175]],
  'Icons/background-icon-7.png': [[118, 117], [177, 175]],
} as const);

test('both trees expose exactly 51 Options rasters with exact dimensions, bytes, hashes, and staging', () => {
  assert.equal(OPTIONS_RASTER_RESOURCE_COUNT, 51);
  assert.equal(Object.keys(EXPECTED_RASTER_DIMENSIONS).length, 51);

  for (const [treeIndex, tree] of (['480x800', '720x1280'] as const).entries()) {
    const resources = collectRasterResources(getOptionsRasterResources(tree));
    assert.equal(resources.size, OPTIONS_RASTER_RESOURCE_COUNT);
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
  assertDeepFrozen(OPTIONS_RASTER_RESOURCES);
});

test('SlabThing and exact selector/back plus row-creation sounds preserve staged contracts', () => {
  assert.equal(OPTIONS_FONT_CANONICAL_PATH, 'Fonts/SlabThing.ttf');
  assert.equal(OPTIONS_SELECTION_AUDIO_CANONICAL_PATH, 'Sounds/menubuttonclick.wav');
  assert.equal(OPTIONS_MENU_BUTTON_AUDIO_CANONICAL_PATH, 'Sounds/menubuttonclick.wav');
  assert.equal(OPTIONS_BACK_AUDIO_CANONICAL_PATH, 'Sounds/menubuttonclick.wav');
  assert.equal(OPTIONS_BLADE_ROW_AUDIO_CANONICAL_PATH, 'Sounds/mono1.wav');
  assert.equal(OPTIONS_THEME_ROW_AUDIO_CANONICAL_PATH, 'Sounds/mono2.wav');
  assert.deepEqual(OPTIONS_SHARED_RESOURCES, {
    font: {
      bytes: 161488,
      canonicalPath: 'Fonts/SlabThing.ttf',
      kind: 'font',
      sha256: '9e07461cbe34a525fe36222710f6067712c6a956f732e2a0d963bdb3d7e151a8',
    },
    bladeRow: {
      bytes: 33162,
      canonicalPath: 'Sounds/mono1.wav',
      kind: 'audio',
      sha256: '1e54cc21d75c18c8031be601b1d76937ed3693e273ca3819da4aa7bd5e6887d2',
    },
    menuButtonClick: {
      bytes: 32812,
      canonicalPath: 'Sounds/menubuttonclick.wav',
      kind: 'audio',
      sha256: '3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e',
    },
    themeRow: {
      bytes: 33104,
      canonicalPath: 'Sounds/mono2.wav',
      kind: 'audio',
      sha256: 'aac7a424635c6518349f6b65f4ece3cecc06be4181f322303bd6a38f5649d4e4',
    },
  });

  for (const resource of Object.values(OPTIONS_SHARED_RESOURCES)) {
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
  assertDeepFrozen(OPTIONS_SHARED_RESOURCES);
});

test('profile fields preserve exact title, row, control, and ordered icon-family semantics', () => {
  const compact = getOptionsRasterResources('480x800');
  assert.equal(compact.title.canonicalPath, '480x800/Options/options-title.png');
  assert.deepEqual(
    Object.values(compact.sectionHeaders).map(({ canonicalPath }) => stripTree(canonicalPath)),
    [
      'Options/options-backgrounds.png',
      'Options/options-blade.png',
      'Options/options-themes.png',
    ],
  );
  assert.equal(
    compact.selectorBackground.canonicalPath,
    '480x800/Icons/icon-image-background.png',
  );
  assert.deepEqual(framePaths(compact.previous), [
    'Icons/icon-button-prev.png',
    'Icons/icon-button-prev-selected.png',
  ]);
  assert.deepEqual(framePaths(compact.next), [
    'Icons/icon-button-next.png',
    'Icons/icon-button-next-selected.png',
  ]);
  assert.deepEqual(framePaths(compact.back), [
    'Icons/back-button.png',
    'Icons/back-button-selected.png',
  ]);
  assert.deepEqual(framePaths(compact.buy), [
    'Buttons/button-buyitem-normal.png',
    'Buttons/button-buyitem-selected.png',
  ]);
  assert.equal(compact.totalCoinsPanel.canonicalPath, '480x800/Interfaces/total-coins.png');
  assert.equal(
    compact.purchaseParticle.canonicalPath,
    '480x800/Blades/Particles/X-Mas/xmasfive.png',
  );
  assert.deepEqual(
    compact.backgroundIcons.map(({ canonicalPath }) => stripTree(canonicalPath)),
    Array.from({ length: 8 }, (_, index) => `Icons/background-icon-${index}.png`),
  );
  assert.deepEqual(
    compact.bladeIcons.map(({ canonicalPath }) => stripTree(canonicalPath)),
    Array.from({ length: 18 }, (_, index) => `Icons/blade-icon-${index}.png`),
  );
  assert.deepEqual(
    compact.themeIcons.map(({ canonicalPath }) => stripTree(canonicalPath)),
    Array.from({ length: 10 }, (_, index) => `Icons/theme-icon-${index}.png`),
  );
});

test('resource getter rejects every noncanonical asset tree', () => {
  assert.throws(() => getOptionsRasterResources('1080x1920' as never), RangeError);
  assert.throws(() => getOptionsRasterResources('phone' as never), /480x800 or 720x1280/);
});

function framePaths(value: {
  readonly normal: { readonly canonicalPath: string };
  readonly selected: { readonly canonicalPath: string };
}): readonly string[] {
  return [stripTree(value.normal.canonicalPath), stripTree(value.selected.canonicalPath)];
}

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
