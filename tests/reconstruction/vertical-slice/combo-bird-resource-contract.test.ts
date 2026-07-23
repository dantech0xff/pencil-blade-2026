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
  COMBO_BIRD_SUPPLEMENTAL_RASTER_COUNT,
  COMBO_BIRD_TIME_MANAGER_FONT_RESOURCE,
  getComboBirdSupplementalRasterSet,
  listComboBirdSupplementalRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/combo-bird-resource-contract.ts'
);

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const manifest = JSON.parse(readFileSync(
  resolve(repositoryRoot, 'assets/catalog/creator-staging-manifest.json'),
  'utf8',
)) as {
  readonly entries: readonly {
    readonly bytes: number;
    readonly canonicalPath: string;
    readonly sha256: string;
    readonly targetPath: string;
  }[];
};
const manifestByPath = new Map(
  manifest.entries.map((entry) => [entry.canonicalPath, entry]),
);

test('Combo Bird owns exactly seven intro and TimeManager rasters per tree', () => {
  for (const tree of ['480x800', '720x1280'] as const) {
    const resources = listComboBirdSupplementalRasterResources(tree);
    assert.equal(resources.length, COMBO_BIRD_SUPPLEMENTAL_RASTER_COUNT);
    assert.equal(
      new Set(resources.map(({ canonicalPath }) => canonicalPath)).size,
      COMBO_BIRD_SUPPLEMENTAL_RASTER_COUNT,
    );
    assert.equal(
      resources.some(({ canonicalPath }) => canonicalPath.includes('leaderboard')),
      false,
    );
    assert.equal(
      resources.some(({ canonicalPath }) => canonicalPath.includes('text-60s')),
      false,
    );
    assert.equal(
      resources.some(({ canonicalPath }) => canonicalPath.includes('Electric/')),
      false,
    );
  }
  assert.equal(
    COMBO_BIRD_TIME_MANAGER_FONT_RESOURCE.canonicalPath,
    'Fonts/MotorwerkOblique.ttf',
  );
});

test('just-combo instruction preserves the literal resolution-specific spelling', () => {
  const compact = getComboBirdSupplementalRasterSet('480x800');
  const large = getComboBirdSupplementalRasterSet('720x1280');

  assert.deepEqual(compact.justComboInstruction, {
    canonicalPath: '480x800/Text/text-juscombo.png',
    dimensions: { height: 44, width: 286 },
  });
  assert.deepEqual(large.justComboInstruction, {
    canonicalPath: '720x1280/Text/text-justcombo.png',
    dimensions: { height: 51, width: 404 },
  });
  assert.equal(
    manifestByPath.has('480x800/Text/text-justcombo.png'),
    false,
  );
  assert.equal(
    manifestByPath.has('720x1280/Text/text-juscombo.png'),
    false,
  );
});

test('every Combo Bird supplemental resource matches staged bytes, hash, and geometry', () => {
  for (const tree of ['480x800', '720x1280'] as const) {
    for (const resource of listComboBirdSupplementalRasterResources(tree)) {
      const entry = manifestByPath.get(resource.canonicalPath);
      assert.ok(entry, `missing manifest row ${resource.canonicalPath}`);
      const bytes = readFileSync(resolve(repositoryRoot, entry.targetPath));
      assert.equal(bytes.byteLength, entry.bytes, resource.canonicalPath);
      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        entry.sha256,
        resource.canonicalPath,
      );
      assert.deepEqual(
        readPngDimensions(bytes),
        resource.dimensions,
        resource.canonicalPath,
      );
    }
  }

  const fontEntry = manifestByPath.get(
    COMBO_BIRD_TIME_MANAGER_FONT_RESOURCE.canonicalPath,
  );
  assert.ok(fontEntry);
  const fontBytes = readFileSync(resolve(repositoryRoot, fontEntry.targetPath));
  assert.equal(fontBytes.byteLength, 21_908);
  assert.equal(
    createHash('sha256').update(fontBytes).digest('hex'),
    '79e1421be053bcbdcbb729f1757c68e063da4790fe4bd2862db3b7cdad348a34',
  );
});

test('Combo Bird resource lookup rejects invalid trees', () => {
  assert.throws(
    () => getComboBirdSupplementalRasterSet('phone' as never),
    RangeError,
  );
  assert.throws(
    () => listComboBirdSupplementalRasterResources('tablet' as never),
    RangeError,
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
