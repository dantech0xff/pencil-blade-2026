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
  CRAZY_SPECIAL_FRUIT_RESOURCES,
  CRAZY_SUPPLEMENTAL_RASTER_COUNT,
  CRAZY_TIME_MANAGER_FONT_RESOURCE,
  getCrazySpecialFruitResources,
  getCrazySupplementalRasterResources,
  getCrazySupplementalRasterSet,
} = await import('../../../game/assets/scripts/domain/crazy-resource-contract.ts');

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
const manifestByPath = new Map(manifest.entries.map((entry) => [entry.canonicalPath, entry]));

test('Crazy owns the exact five special-fruit triples for both recovered asset trees', () => {
  assert.deepEqual(
    CRAZY_SPECIAL_FRUIT_RESOURCES.map(({ fruitId, name }) => ({ fruitId, name })),
    [
      { fruitId: 10, name: 'bdouble' },
      { fruitId: 11, name: 'b2toss' },
      { fruitId: 12, name: 'bfreezy' },
      { fruitId: 13, name: 'electric-apple' },
      { fruitId: 14, name: 'magnetstrawberry' },
    ],
  );
  for (const tree of ['480x800', '720x1280'] as const) {
    for (let fruitId = 10; fruitId <= 14; fruitId += 1) {
      const set = getCrazySpecialFruitResources(fruitId, tree);
      assert.equal(set.intact.canonicalPath.endsWith('.png'), true);
      assert.equal(set.cutTop.canonicalPath.endsWith('-cut-top.png'), true);
      assert.equal(set.cutBottom.canonicalPath.endsWith('-cut-bottom.png'), true);
    }
  }
});

test('Crazy supplemental catalog contains only the reviewed 37 per-tree rasters', () => {
  for (const tree of ['480x800', '720x1280'] as const) {
    const resources = getCrazySupplementalRasterResources(tree);
    assert.equal(resources.length, CRAZY_SUPPLEMENTAL_RASTER_COUNT);
    assert.equal(new Set(resources.map(({ canonicalPath }) => canonicalPath)).size, 37);
    assert.equal(resources.some(({ canonicalPath }) => canonicalPath.includes('text-good')), false);
    assert.equal(resources.some(({ canonicalPath }) => canonicalPath.includes('text-luck')), false);
    assert.equal(resources.some(({ canonicalPath }) => canonicalPath.includes('text-game')), false);
    assert.equal(resources.some(({ canonicalPath }) => canonicalPath.includes('text-over')), false);
    assert.equal(resources.some(({ canonicalPath }) => canonicalPath.includes('object-x-')), false);
    assert.equal(resources.some(({ canonicalPath }) => canonicalPath.includes('text-nobomb')), false);
    assert.equal(resources.some(({ canonicalPath }) => canonicalPath.includes('leaderboard')), false);
  }
  assert.equal(CRAZY_TIME_MANAGER_FONT_RESOURCE.canonicalPath, 'Fonts/MotorwerkOblique.ttf');
});

test('every Crazy supplemental raster matches the immutable staged bytes, hash, and PNG geometry', () => {
  for (const tree of ['480x800', '720x1280'] as const) {
    for (const resource of getCrazySupplementalRasterResources(tree)) {
      const entry = manifestByPath.get(resource.canonicalPath);
      assert.ok(entry, `missing manifest row ${resource.canonicalPath}`);
      const bytes = readFileSync(resolve(repositoryRoot, entry.targetPath));
      assert.equal(bytes.byteLength, entry.bytes, resource.canonicalPath);
      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        entry.sha256,
        resource.canonicalPath,
      );
      assert.deepEqual(readPngDimensions(bytes), resource.dimensions, resource.canonicalPath);
    }
  }
  const fontEntry = manifestByPath.get(CRAZY_TIME_MANAGER_FONT_RESOURCE.canonicalPath);
  assert.ok(fontEntry);
  const fontBytes = readFileSync(resolve(repositoryRoot, fontEntry.targetPath));
  assert.equal(fontBytes.byteLength, fontEntry.bytes);
  assert.equal(createHash('sha256').update(fontBytes).digest('hex'), fontEntry.sha256);
});

test('DragonFruit, electric, and magnet effects expose all exact animation resources', () => {
  const compact = getCrazySupplementalRasterSet('480x800');
  const large = getCrazySupplementalRasterSet('720x1280');
  assert.equal(compact.electricFrames.length, 8);
  assert.equal(large.electricFrames.length, 8);
  assert.deepEqual(
    compact.electricFrames.map(({ canonicalPath }) => canonicalPath),
    Array.from({ length: 8 }, (_, index) => `480x800/Electric/electric${index}.png`),
  );
  assert.equal(compact.electricLeftNode.canonicalPath, '480x800/Electric/left-electric-node.png');
  assert.equal(compact.electricRightNode.canonicalPath, '480x800/Electric/right-electric-node.png');
  assert.equal(compact.magnet.canonicalPath, '480x800/Interfaces/magnet.png');
  assert.equal(compact.magnetLine.canonicalPath, '480x800/Interfaces/magnet-line.png');
  assert.equal(compact.dragonFruit.canonicalPath, '480x800/Fruits/dragon-fruit.png');
  assert.equal(compact.dragonSplash.canonicalPath, '480x800/Fruits/dragon-splash.png');
  assert.deepEqual([
    compact.dragonCutTopLeft.canonicalPath,
    compact.dragonCutTopRight.canonicalPath,
    compact.dragonCutBottomRight.canonicalPath,
    compact.dragonCutBottomLeft.canonicalPath,
  ], [
    '480x800/Fruits/dragon-fruit-topleft.png',
    '480x800/Fruits/dragon-fruit-topright.png',
    '480x800/Fruits/dragon-fruit-bottomright.png',
    '480x800/Fruits/dragon-fruit-bottomleft.png',
  ]);
});

test('Crazy resource lookups reject invalid trees and fruit IDs', () => {
  assert.throws(() => getCrazySpecialFruitResources(9, '480x800'), RangeError);
  assert.throws(() => getCrazySpecialFruitResources(15, '720x1280'), RangeError);
  assert.throws(() => getCrazySpecialFruitResources(10.5, '480x800'), RangeError);
  assert.throws(() => getCrazySupplementalRasterSet('phone' as never), RangeError);
});

function readPngDimensions(bytes: Buffer): Readonly<{ readonly height: number; readonly width: number }> {
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR');
  return Object.freeze({
    height: bytes.readUInt32BE(20),
    width: bytes.readUInt32BE(16),
  });
}
