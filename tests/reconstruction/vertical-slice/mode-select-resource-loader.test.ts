import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export class AssetManager {}
export class Font {}
export class SpriteFrame {
  constructor(width = 0, height = 0) {
    this.originalSize = { width, height };
    this.rect = { width, height };
  }
}
let loadedBundle = null;
export const assetManager = {
  getBundle() { return loadedBundle; },
  loadBundle(name, callback) { callback(null, loadedBundle); },
  setBundle(bundle) { loadedBundle = bundle; },
};
`)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') {
      return { shortCircuit: true, url: CC_STUB_URL };
    }
    if (
      (specifier.startsWith('./') || specifier.startsWith('../'))
      && extname(specifier) === ''
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const cc = await import('cc') as unknown as {
  readonly Font: new () => object;
  readonly SpriteFrame: new (width: number, height: number) => object;
  readonly assetManager: { setBundle(bundle: object): void };
};
const {
  canonicalResourceToBundlePath,
  canonicalRasterToSpriteFrameBundlePath,
} = await import('../../../game/assets/scripts/domain/classic-resource-contract.ts');
const {
  MODE_SELECT_SHARED_RESOURCES,
  getModeSelectRasterResources,
} = await import('../../../game/assets/scripts/domain/mode-select-resource-contract.ts');
const {
  MODE_SELECT_RASTER_RESOURCE_COUNT,
  collectModeSelectRasterContracts,
  loadModeSelectResources,
} = await import('../../../game/assets/scripts/creator/mode-select-resource-loader.ts');

test('Mode Select loader enumerates exactly 42 unique accepted rasters', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    const profile = getModeSelectRasterResources(assetTree);
    const contracts = collectModeSelectRasterContracts(profile);
    assert.equal(MODE_SELECT_RASTER_RESOURCE_COUNT, 42);
    assert.equal(contracts.length, 42);
    assert.equal(new Set(contracts.map(({ canonicalPath }) => canonicalPath)).size, 42);
    assert.equal(Object.isFrozen(contracts), true);

    const malformed = {
      ...profile,
      back: {
        normal: profile.back.normal,
        selected: profile.back.normal,
      },
    };
    assert.throws(
      () => collectModeSelectRasterContracts(malformed),
      /Duplicate Mode Select raster contract/,
    );
  }
});

test('Mode Select loader resolves exact geometry and SlabThing font through the game bundle', async () => {
  const assetTree = '480x800' as const;
  const contracts = collectModeSelectRasterContracts(getModeSelectRasterResources(assetTree));
  const dimensionsByBundlePath = new Map(contracts.map((contract) => [
    canonicalRasterToSpriteFrameBundlePath(contract.canonicalPath),
    contract.dimensions,
  ]));
  const requested: string[] = [];
  const font = new cc.Font();
  cc.assetManager.setBundle({
    load(
      pathOrPaths: string | string[],
      _Type: unknown,
      callback: (error: Error | null, value: object | object[]) => void,
    ) {
      if (Array.isArray(pathOrPaths)) {
        requested.push(...pathOrPaths);
        callback(null, pathOrPaths.map((path) => {
          const dimensions = dimensionsByBundlePath.get(path);
          assert.ok(dimensions, `unexpected bundle raster path ${path}`);
          return new cc.SpriteFrame(dimensions.width, dimensions.height);
        }));
        return;
      }
      requested.push(pathOrPaths);
      callback(null, font);
    },
  });

  const loaded = await loadModeSelectResources(assetTree);
  assert.equal(loaded.assetTree, assetTree);
  assert.equal(loaded.font, font);
  assert.equal(loaded.rasterCount, 42);
  assert.equal(requested.length, 43);
  assert.equal(
    requested.includes(canonicalResourceToBundlePath(
      MODE_SELECT_SHARED_RESOURCES.font.canonicalPath,
    )),
    true,
  );
  for (const contract of contracts) {
    const raster = loaded.raster(contract);
    assert.equal(raster.canonicalPath, contract.canonicalPath);
    assert.deepEqual(raster.dimensions, contract.dimensions);
  }

  assert.throws(
    () => loaded.raster({
      ...contracts[0],
      dimensions: { height: contracts[0].dimensions.height + 1, width: 1 },
    }),
    /Mode Select raster contract changed/,
  );
  assert.throws(
    () => loaded.raster({
      ...contracts[0],
      canonicalPath: 'Interfaces/not-loaded.png',
    }),
    /Mode Select raster was not loaded/,
  );
});
