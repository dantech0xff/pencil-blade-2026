import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
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
  loadBundle(_name, callback) { callback(null, loadedBundle); },
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
  readonly assetManager: { setBundle(bundle: object | null): void };
};
const {
  canonicalRasterToSpriteFrameBundlePath,
} = await import(
  '../../../game/assets/scripts/domain/game-resource-contract.ts'
);
const {
  COMBO_BIRD_SUPPLEMENTAL_RASTER_COUNT,
  getComboBirdSupplementalRasterSet,
  listComboBirdSupplementalRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/combo-bird-resource-contract.ts'
);
const {
  createComboBirdTimeManagerResourcePort,
  loadComboBirdResources,
} = await import(
  '../../../game/assets/scripts/creator/combo-bird-resource-loader.ts'
);

test('Combo Bird loader resolves exactly seven rasters and the TimeManager font', async () => {
  const assetTree = '480x800' as const;
  const contracts = listComboBirdSupplementalRasterResources(assetTree);
  const dimensionsByPath = new Map(contracts.map((contract) => [
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
          const dimensions = dimensionsByPath.get(path);
          assert.ok(dimensions, `unexpected Combo Bird raster path ${path}`);
          return new cc.SpriteFrame(dimensions.width, dimensions.height);
        }));
        return;
      }
      requested.push(pathOrPaths);
      callback(null, font);
    },
  });

  const loaded = await loadComboBirdResources(assetTree);
  const timeManagerResources = createComboBirdTimeManagerResourcePort(loaded);
  const supplement = getComboBirdSupplementalRasterSet(assetTree);
  assert.equal(loaded.rasterCount, COMBO_BIRD_SUPPLEMENTAL_RASTER_COUNT);
  assert.equal(loaded.timeManagerFont, font);
  assert.equal(loaded.freezeClock.canonicalPath, supplement.freezeClock.canonicalPath);
  assert.equal(loaded.timeUp.canonicalPath, supplement.timeUp.canonicalPath);
  assert.deepEqual(Object.keys(timeManagerResources), [
    'assetTree',
    'freezeClock',
    'timeManagerFont',
    'timeUp',
  ]);
  assert.equal(timeManagerResources.assetTree, assetTree);
  assert.equal(timeManagerResources.freezeClock, loaded.freezeClock);
  assert.equal(timeManagerResources.timeManagerFont, font);
  assert.equal(timeManagerResources.timeUp, loaded.timeUp);
  assert.equal(Object.isFrozen(timeManagerResources), true);
  assert.equal(requested.length, COMBO_BIRD_SUPPLEMENTAL_RASTER_COUNT + 1);
  for (const contract of contracts) {
    const raster = loaded.raster(contract);
    assert.equal(raster.canonicalPath, contract.canonicalPath);
    assert.deepEqual(raster.dimensions, contract.dimensions);
  }
});

test('Combo Bird loader requests the exact spelling for each resolution tree', async () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    const contracts = listComboBirdSupplementalRasterResources(assetTree);
    const requested: string[] = [];
    cc.assetManager.setBundle(exactBundle(contracts, new cc.Font(), requested));
    await loadComboBirdResources(assetTree);

    assert.equal(
      requested.some((path) => path.includes(
        assetTree === '480x800' ? 'text-juscombo' : 'text-justcombo',
      )),
      true,
    );
    assert.equal(
      requested.some((path) => path.includes(
        assetTree === '480x800' ? 'text-justcombo' : 'text-juscombo',
      )),
      false,
    );
  }
});

test('Combo Bird loader fails closed on omitted and geometry-changed SpriteFrames', async () => {
  const contracts = listComboBirdSupplementalRasterResources('720x1280');
  cc.assetManager.setBundle({
    load(
      pathOrPaths: string | string[],
      _Type: unknown,
      callback: (error: Error | null, value: object | object[]) => void,
    ) {
      if (Array.isArray(pathOrPaths)) {
        callback(null, pathOrPaths.slice(0, -1).map((_, index) => {
          const dimensions = contracts[index]?.dimensions;
          assert.ok(dimensions);
          return new cc.SpriteFrame(dimensions.width, dimensions.height);
        }));
        return;
      }
      callback(null, new cc.Font());
    },
  });
  await assert.rejects(
    () => loadComboBirdResources('720x1280'),
    /Creator omitted SpriteFrame/,
  );

  cc.assetManager.setBundle({
    load(
      pathOrPaths: string | string[],
      _Type: unknown,
      callback: (error: Error | null, value: object | object[]) => void,
    ) {
      if (Array.isArray(pathOrPaths)) {
        callback(null, pathOrPaths.map((_, index) => {
          const dimensions = contracts[index]?.dimensions;
          assert.ok(dimensions);
          return new cc.SpriteFrame(
            dimensions.width + (index === 0 ? 1 : 0),
            dimensions.height,
          );
        }));
        return;
      }
      callback(null, new cc.Font());
    },
  });
  await assert.rejects(
    () => loadComboBirdResources('720x1280'),
    /Creator SpriteFrame geometry mismatch/,
  );
});

test('Combo Bird catalog rejects missing/changed lookups and a missing font', async () => {
  const contracts = listComboBirdSupplementalRasterResources('480x800');
  cc.assetManager.setBundle(exactBundle(contracts, new cc.Font()));
  const loaded = await loadComboBirdResources('480x800');
  assert.throws(
    () => loaded.raster({
      ...contracts[0],
      canonicalPath: '480x800/Text/not-loaded.png',
    }),
    /Combo Bird raster was not loaded/,
  );
  assert.throws(
    () => loaded.raster({
      ...contracts[0],
      dimensions: {
        height: contracts[0].dimensions.height,
        width: contracts[0].dimensions.width + 1,
      },
    }),
    /Combo Bird raster contract changed/,
  );

  cc.assetManager.setBundle(exactBundle(contracts, null));
  await assert.rejects(
    () => loadComboBirdResources('480x800'),
    /Creator returned no Combo Bird TimeManager font/,
  );
});

function exactBundle(
  contracts: ReturnType<typeof listComboBirdSupplementalRasterResources>,
  font: object | null,
  requested: string[] = [],
) {
  const byBundlePath = new Map(contracts.map((contract) => [
    canonicalRasterToSpriteFrameBundlePath(contract.canonicalPath),
    contract,
  ]));
  return {
    load(
      pathOrPaths: string | string[],
      _Type: unknown,
      callback: (error: Error | null, value: object | object[] | null) => void,
    ) {
      if (Array.isArray(pathOrPaths)) {
        requested.push(...pathOrPaths);
        callback(null, pathOrPaths.map((path) => {
          const contract = byBundlePath.get(path);
          assert.ok(contract);
          return new cc.SpriteFrame(
            contract.dimensions.width,
            contract.dimensions.height,
          );
        }));
        return;
      }
      requested.push(pathOrPaths);
      callback(null, font);
    },
  };
}
