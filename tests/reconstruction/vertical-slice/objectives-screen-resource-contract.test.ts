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
  OBJECTIVES_SCREEN_BACK_AUDIO_CANONICAL_PATH,
  OBJECTIVES_SCREEN_FONT_CANONICAL_PATH,
  OBJECTIVES_SCREEN_MENU_BUTTON_AUDIO_CANONICAL_PATH,
  OBJECTIVES_SCREEN_RASTER_LOGICAL_PATHS,
  OBJECTIVES_SCREEN_RASTER_RESOURCE_COUNT,
  OBJECTIVES_SCREEN_RASTER_RESOURCES,
  OBJECTIVES_SCREEN_SHARED_RESOURCE_COUNT,
  OBJECTIVES_SCREEN_SHARED_RESOURCES,
  OBJECTIVES_SCREEN_SKIP_AUDIO_CANONICAL_PATH,
  OBJECTIVES_SCREEN_TOTAL_RESOURCE_COUNT,
  OBJECTIVES_SCREEN_UNATTACHED_PROBE_LOGICAL_PATHS,
  collectObjectivesScreenRasterResources,
  getObjectivesScreenRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/objectives-screen-resource-contract.ts'
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
  'Objectives/button-skip-selected.png',
  'Objectives/button-skip.png',
  'Objectives/objectives-active.png',
  'Objectives/objectives-background.png',
  'Objectives/objectives-inactive.png',
  'Objectives/objectives-next-background.png',
  'Objectives/objectives-next.png',
  'Objectives/objectives-objectives-background.png',
  'Buttons/button-blue-back-normal.png',
  'Buttons/button-back-selected.png',
] as const);

test('both profiles expose the exact ten-raster Objectives screen closure', () => {
  assert.equal(OBJECTIVES_SCREEN_RASTER_RESOURCE_COUNT, 10);
  assert.equal(OBJECTIVES_SCREEN_SHARED_RESOURCE_COUNT, 2);
  assert.equal(OBJECTIVES_SCREEN_TOTAL_RESOURCE_COUNT, 12);
  assert.deepEqual(OBJECTIVES_SCREEN_RASTER_LOGICAL_PATHS, EXPECTED_RASTER_PATHS);

  for (const tree of ['480x800', '720x1280'] as const) {
    const resources = collectObjectivesScreenRasterResources(tree);
    assert.equal(resources.length, OBJECTIVES_SCREEN_RASTER_RESOURCE_COUNT);
    assert.deepEqual(
      resources.map(({ canonicalPath }) => stripTree(canonicalPath)),
      EXPECTED_RASTER_PATHS,
    );
    assert.equal(
      new Set(resources.map(({ canonicalPath }) => canonicalPath)).size,
      OBJECTIVES_SCREEN_RASTER_RESOURCE_COUNT,
    );

    for (const resource of resources) {
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
      assert.equal(image.length, resource.bytes, resource.canonicalPath);
      assert.equal(sha256(image), resource.sha256, resource.canonicalPath);

      const staged = STAGED_ENTRIES.get(resource.canonicalPath);
      assert.ok(staged, resource.canonicalPath);
      assert.equal(staged.cocosType, 'cc.ImageAsset');
      assert.equal(staged.targetPath, `game/assets/game/${resource.canonicalPath}`);
      assert.equal(staged.bytes, resource.bytes);
      assert.equal(staged.sha256, resource.sha256);
    }
  }

  const compact = getObjectivesScreenRasterResources('480x800');
  assert.deepEqual(compact.fixedCurrentRow.dimensions, { height: 81, width: 375 });
  assert.deepEqual(compact.header.dimensions, { height: 150, width: 420 });
  assert.deepEqual(compact.footer.dimensions, { height: 240, width: 420 });
  assert.deepEqual(compact.back.normal.dimensions, { height: 124, width: 144 });
  assert.deepEqual(compact.back.selected.dimensions, { height: 124, width: 144 });

  const high = getObjectivesScreenRasterResources('720x1280');
  assert.deepEqual(high.fixedCurrentRow.dimensions, { height: 122, width: 563 });
  assert.deepEqual(high.header.dimensions, { height: 240, width: 672 });
  assert.deepEqual(high.footer.dimensions, { height: 384, width: 672 });
  assert.deepEqual(high.back.normal.dimensions, { height: 150, width: 180 });
  assert.deepEqual(high.back.selected.dimensions, { height: 150, width: 181 });
  assertDeepFrozen(OBJECTIVES_SCREEN_RASTER_RESOURCES);
});

test('probe dimensions remain classified while their independent visible uses stay attached', () => {
  assert.deepEqual(OBJECTIVES_SCREEN_UNATTACHED_PROBE_LOGICAL_PATHS, [
    'Objectives/objectives-next-background.png',
    'Objectives/objectives-next.png',
    'Objectives/objectives-objectives-background.png',
  ]);

  for (const tree of ['480x800', '720x1280'] as const) {
    const resources = collectObjectivesScreenRasterResources(tree);
    const probes = resources.filter(({ hasUnattachedProbeInstance }) => (
      hasUnattachedProbeInstance
    ));
    assert.deepEqual(
      probes.map(({ canonicalPath }) => stripTree(canonicalPath)),
      OBJECTIVES_SCREEN_UNATTACHED_PROBE_LOGICAL_PATHS,
    );
    for (const probe of probes) {
      assert.equal(
        probe.consumerClassification,
        'unattached-probe-and-attached-visible',
      );
    }
    for (const attachedOnly of resources.filter(
      ({ hasUnattachedProbeInstance }) => !hasUnattachedProbeInstance,
    )) {
      assert.equal(attachedOnly.consumerClassification, 'attached-visible');
    }
  }
});

test('screen closure excludes the three popup/pause Objectives rasters', () => {
  const closure = new Set(OBJECTIVES_SCREEN_RASTER_LOGICAL_PATHS);
  for (const separateConsumer of [
    'Objectives/objectives_message.png',
    'Objectives/next_objectives_message.png',
    'Objectives/objectives-pause-background.png',
  ]) {
    assert.equal(closure.has(separateConsumer as never), false);
  }
});

test('Arial and the shared menu click preserve exact staged file identities', () => {
  assert.equal(OBJECTIVES_SCREEN_FONT_CANONICAL_PATH, 'Fonts/Arial.ttf');
  assert.equal(
    OBJECTIVES_SCREEN_MENU_BUTTON_AUDIO_CANONICAL_PATH,
    'Sounds/menubuttonclick.wav',
  );
  assert.equal(
    OBJECTIVES_SCREEN_BACK_AUDIO_CANONICAL_PATH,
    'Sounds/menubuttonclick.wav',
  );
  assert.equal(
    OBJECTIVES_SCREEN_SKIP_AUDIO_CANONICAL_PATH,
    'Sounds/menubuttonclick.wav',
  );
  assert.deepEqual(OBJECTIVES_SCREEN_SHARED_RESOURCES, {
    font: {
      bytes: 755_624,
      canonicalPath: 'Fonts/Arial.ttf',
      kind: 'font',
      sha256: 'b97a1e2bb9fedbf9aa99f6b14ef5a7f057c6611dd71698381cc44f77797a4223',
    },
    menuButtonClick: {
      bytes: 32_812,
      canonicalPath: 'Sounds/menubuttonclick.wav',
      kind: 'audio',
      sha256: '3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e',
    },
  });

  for (const resource of Object.values(OBJECTIVES_SCREEN_SHARED_RESOURCES)) {
    const content = readBinary(`game/assets/game/${resource.canonicalPath}`);
    assert.equal(content.length, resource.bytes, resource.canonicalPath);
    assert.equal(sha256(content), resource.sha256, resource.canonicalPath);
    const staged = STAGED_ENTRIES.get(resource.canonicalPath);
    assert.ok(staged, resource.canonicalPath);
    assert.equal(staged.targetPath, `game/assets/game/${resource.canonicalPath}`);
    assert.equal(staged.bytes, resource.bytes);
    assert.equal(staged.sha256, resource.sha256);
    assert.equal(
      staged.cocosType,
      resource.kind === 'font' ? 'cc.TTFFont' : 'cc.AudioClip',
    );
  }
  assertDeepFrozen(OBJECTIVES_SCREEN_SHARED_RESOURCES);
});

test('resource getter rejects noncanonical trees and all new metadata UUIDs are valid', () => {
  assert.throws(
    () => getObjectivesScreenRasterResources('1080x1920' as never),
    /480x800 or 720x1280/,
  );
  assert.throws(
    () => collectObjectivesScreenRasterResources('compact' as never),
    RangeError,
  );

  const metadata = [
    'game/assets/scripts/domain/objectives-screen-state.ts.meta',
    'game/assets/scripts/domain/objectives-screen-presentation.ts.meta',
    'game/assets/scripts/domain/objectives-screen-resource-contract.ts.meta',
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

function assertDeepFrozen(
  value: unknown,
  seen: Set<object> = new Set(),
): void {
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
