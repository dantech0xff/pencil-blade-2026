import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export class AssetManager {}
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
  readonly SpriteFrame: new (width: number, height: number) => object;
  readonly assetManager: { setBundle(bundle: object | null): void };
};
const {
  canonicalRasterToSpriteFrameBundlePath,
} = await import(
  '../../../game/assets/scripts/domain/game-resource-contract.ts'
);
const {
  GN_STYLE_SUPPLEMENTAL_RASTER_COUNT,
  listGnStyleSupplementalRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/gn-style-resource-contract.ts'
);
const {
  loadGnStyleResources,
} = await import(
  '../../../game/assets/scripts/creator/gn-style-resource-loader.ts'
);

test('GN Style loader resolves only the exact 11-raster supplement', async () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    const contracts = listGnStyleSupplementalRasterResources(assetTree);
    const requested: string[] = [];
    cc.assetManager.setBundle(exactBundle(contracts, requested));

    const loaded = await loadGnStyleResources(assetTree);
    assert.equal(Object.isFrozen(loaded), true);
    assert.equal(loaded.assetTree, assetTree);
    assert.equal(loaded.rasterCount, GN_STYLE_SUPPLEMENTAL_RASTER_COUNT);
    assert.equal(requested.length, GN_STYLE_SUPPLEMENTAL_RASTER_COUNT);
    assert.equal(
      requested.some((path) => path.includes('text-time-up')),
      false,
    );
    assert.equal(
      requested.some((path) => path.includes('object-time-freeze')),
      false,
    );
    assert.equal(
      requested.some((path) => path.includes('MotorwerkOblique')),
      false,
    );
    for (const contract of contracts) {
      const raster = loaded.raster(contract);
      assert.equal(raster.canonicalPath, contract.canonicalPath);
      assert.deepEqual(raster.dimensions, contract.dimensions);
    }
  }
});

test('GN Style loader fails closed on omitted and geometry-changed SpriteFrames', async () => {
  const contracts = listGnStyleSupplementalRasterResources('720x1280');
  cc.assetManager.setBundle({
    load(
      pathOrPaths: string | string[],
      _Type: unknown,
      callback: (error: Error | null, value: object[]) => void,
    ) {
      assert.equal(Array.isArray(pathOrPaths), true);
      callback(null, (pathOrPaths as string[]).slice(0, -1).map((_, index) => {
        const dimensions = contracts[index]?.dimensions;
        assert.ok(dimensions);
        return new cc.SpriteFrame(dimensions.width, dimensions.height);
      }));
    },
  });
  await assert.rejects(
    () => loadGnStyleResources('720x1280'),
    /Creator omitted SpriteFrame/,
  );

  cc.assetManager.setBundle({
    load(
      pathOrPaths: string | string[],
      _Type: unknown,
      callback: (error: Error | null, value: object[]) => void,
    ) {
      assert.equal(Array.isArray(pathOrPaths), true);
      callback(null, (pathOrPaths as string[]).map((_, index) => {
        const dimensions = contracts[index]?.dimensions;
        assert.ok(dimensions);
        return new cc.SpriteFrame(
          dimensions.width + (index === 0 ? 1 : 0),
          dimensions.height,
        );
      }));
    },
  });
  await assert.rejects(
    () => loadGnStyleResources('720x1280'),
    /Creator SpriteFrame geometry mismatch/,
  );
});

test('GN Style catalog rejects missing and changed lookups', async () => {
  const contracts = listGnStyleSupplementalRasterResources('480x800');
  cc.assetManager.setBundle(exactBundle(contracts));
  const loaded = await loadGnStyleResources('480x800');
  assert.throws(
    () => loaded.raster({
      ...contracts[0],
      canonicalPath: '480x800/Text/not-loaded.png',
    }),
    /GN Style raster was not loaded/,
  );
  assert.throws(
    () => loaded.raster({
      ...contracts[0],
      dimensions: {
        height: contracts[0].dimensions.height,
        width: contracts[0].dimensions.width + 1,
      },
    }),
    /GN Style raster contract changed/,
  );
});

function exactBundle(
  contracts: ReturnType<typeof listGnStyleSupplementalRasterResources>,
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
      callback: (error: Error | null, value: object[]) => void,
    ) {
      assert.equal(Array.isArray(pathOrPaths), true);
      requested.push(...pathOrPaths as string[]);
      callback(null, (pathOrPaths as string[]).map((path) => {
        const contract = byBundlePath.get(path);
        assert.ok(contract, `unexpected GN Style raster path ${path}`);
        return new cc.SpriteFrame(
          contract.dimensions.width,
          contract.dimensions.height,
        );
      }));
    },
  };
}
