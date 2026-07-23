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
let loadBundleError = null;
export const assetManager = {
  getBundle() { return loadedBundle; },
  loadBundle(_name, callback) { callback(loadBundleError, loadedBundle); },
  reset() { loadedBundle = null; loadBundleError = null; },
  setBundle(bundle) { loadedBundle = bundle; },
  setLoadBundleError(error) { loadBundleError = error; },
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
  readonly assetManager: {
    reset(): void;
    setBundle(bundle: object | null): void;
    setLoadBundleError(error: Error | null): void;
  };
};
const {
  BIRD_RASTER_RESOURCE_COUNT,
  getBirdResourceProfile,
  listBirdRasterResources,
} = await import('../../../game/assets/scripts/domain/bird-resource-contract.ts');
const {
  canonicalRasterToSpriteFrameBundlePath,
} = await import('../../../game/assets/scripts/domain/game-resource-contract.ts');
const {
  loadBirdResources,
} = await import('../../../game/assets/scripts/creator/bird-resource-loader.ts');

interface RasterContract {
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{ height: number; width: number }>;
}

test('Bird loader requests all 17 exact extensionless SpriteFrame paths in order', async () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    cc.assetManager.reset();
    const contracts = listBirdRasterResources(assetTree);
    const requested: string[] = [];
    const requestedTypes: unknown[] = [];
    const frameByCanonicalPath = new Map<string, object>();
    cc.assetManager.setBundle({
      load(
        pathOrPaths: string | string[],
        Type: unknown,
        callback: (error: Error | null, value: object[]) => void,
      ) {
        assert.ok(Array.isArray(pathOrPaths));
        requested.push(...pathOrPaths);
        requestedTypes.push(Type);
        callback(null, pathOrPaths.map((path, index) => {
          const contract = contracts[index];
          assert.ok(contract);
          assert.equal(
            path,
            canonicalRasterToSpriteFrameBundlePath(contract.canonicalPath),
          );
          const frame = new cc.SpriteFrame(
            contract.dimensions.width,
            contract.dimensions.height,
          );
          frameByCanonicalPath.set(contract.canonicalPath, frame);
          return frame;
        }));
      },
    });

    const loaded = await loadBirdResources(assetTree);
    assert.equal(loaded.assetTree, assetTree);
    assert.equal(loaded.birdType, 1);
    assert.equal(loaded.profile, getBirdResourceProfile(assetTree));
    assert.equal(Object.isFrozen(loaded.profile), true);
    assert.equal(loaded.rasterCount, BIRD_RASTER_RESOURCE_COUNT);
    assert.deepEqual(
      requested,
      contracts.map(({ canonicalPath }) => (
        canonicalRasterToSpriteFrameBundlePath(canonicalPath)
      )),
    );
    assert.equal(requestedTypes.length, 1);
    assert.equal(requestedTypes[0], cc.SpriteFrame);
    assert.deepEqual(
      loaded.orderedRasters.map(({ canonicalPath }) => canonicalPath),
      contracts.map(({ canonicalPath }) => canonicalPath),
    );
    assert.equal(loaded.blade, loaded.orderedRasters[0]);
    assert.deepEqual(
      loaded.animationFrames,
      loaded.orderedRasters.slice(1, 11),
    );
    assert.equal(loaded.leftDirection, loaded.orderedRasters[11]);
    assert.equal(loaded.rightDirection, loaded.orderedRasters[12]);
    assert.deepEqual(loaded.particles, loaded.orderedRasters.slice(13, 17));

    for (const contract of contracts) {
      const raster = loaded.raster(contract);
      assert.equal(
        raster.spriteFrame,
        frameByCanonicalPath.get(contract.canonicalPath),
      );
      assert.deepEqual(raster.dimensions, contract.dimensions);
    }
  }
});

test('Bird loader selects the exact type-2 profile only when explicitly requested', async () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    const contracts = listBirdRasterResources(assetTree, 2);
    const requested: string[] = [];
    cc.assetManager.reset();
    cc.assetManager.setBundle({
      load(
        pathOrPaths: string[],
        _Type: unknown,
        callback: (error: Error | null, value: object[]) => void,
      ) {
        assert.ok(Array.isArray(pathOrPaths));
        requested.push(...pathOrPaths);
        callback(
          null,
          pathOrPaths.map((_, index) => exactFrame(contracts, index)),
        );
      },
    });

    const loaded = await loadBirdResources(assetTree, 2);
    assert.equal(loaded.assetTree, assetTree);
    assert.equal(loaded.birdType, 2);
    assert.equal(loaded.profile, getBirdResourceProfile(assetTree, 2));
    assert.equal(loaded.profile.birdType, 2);
    assert.equal(loaded.rasterCount, BIRD_RASTER_RESOURCE_COUNT);
    assert.deepEqual(
      requested,
      contracts.map(({ canonicalPath }) => (
        canonicalRasterToSpriteFrameBundlePath(canonicalPath)
      )),
    );
    assert.deepEqual(
      loaded.orderedRasters.map(({ canonicalPath }) => canonicalPath),
      contracts.map(({ canonicalPath }) => canonicalPath),
    );
    assert.match(loaded.animationFrames[0].canonicalPath, /bird-anim-2-0\.png$/);
    assert.match(loaded.leftDirection.canonicalPath, /bird-left-2\.png$/);
    assert.match(loaded.rightDirection.canonicalPath, /bird-right-2\.png$/);
  }
});

test('Bird loader fails closed on omitted and geometry-changed SpriteFrames', async () => {
  const contracts = listBirdRasterResources('720x1280');
  cc.assetManager.reset();
  cc.assetManager.setBundle(bundleFor({
    contracts,
    rasterFrames: (paths) => paths.slice(0, -1).map((_, index) => (
      exactFrame(contracts, index)
    )),
  }));
  await assert.rejects(
    () => loadBirdResources('720x1280'),
    /Creator omitted SpriteFrame 720x1280\/Blades\/Particles\/X-Mas\/xmascircle\.png/,
  );

  cc.assetManager.setBundle(bundleFor({
    contracts,
    rasterFrames: (paths) => paths.map((_, index) => {
      const contract = contracts[index];
      assert.ok(contract);
      return new cc.SpriteFrame(
        contract.dimensions.width,
        contract.dimensions.height + (index === 12 ? 1 : 0),
      );
    }),
  }));
  await assert.rejects(
    () => loadBirdResources('720x1280'),
    /Creator SpriteFrame geometry mismatch for 720x1280\/Birds\/bird-right-1\.png/,
  );
});

test('Bird loader propagates raster and bundle failures without fallback art', async () => {
  const contracts = listBirdRasterResources('480x800');
  cc.assetManager.reset();
  cc.assetManager.setBundle(bundleFor({
    contracts,
    rasterError: new Error('Bird bytes unavailable'),
  }));
  await assert.rejects(
    () => loadBirdResources('480x800'),
    /Failed to load recovered SpriteFrames: Bird bytes unavailable/,
  );

  cc.assetManager.setBundle({
    load(
      _paths: string[],
      _Type: unknown,
      callback: (error: Error | null, value: object[] | null) => void,
    ) {
      callback(null, null);
    },
  });
  await assert.rejects(
    () => loadBirdResources('480x800'),
    /Creator returned no recovered SpriteFrames/,
  );

  cc.assetManager.reset();
  cc.assetManager.setLoadBundleError(new Error('game bundle unavailable'));
  await assert.rejects(
    () => loadBirdResources('480x800'),
    /Failed to load game bundle: game bundle unavailable/,
  );
});

test('Bird catalog rejects unknown and changed resource lookups', async () => {
  const contracts = listBirdRasterResources('480x800');
  cc.assetManager.reset();
  cc.assetManager.setBundle(bundleFor({ contracts }));
  const loaded = await loadBirdResources('480x800');

  assert.throws(
    () => loaded.raster({
      ...contracts[0],
      canonicalPath: '480x800/Birds/not-loaded.png',
    }),
    /Bird raster was not loaded: 480x800\/Birds\/not-loaded\.png/,
  );
  assert.throws(
    () => loaded.raster({
      ...contracts[0],
      dimensions: {
        height: contracts[0].dimensions.height,
        width: contracts[0].dimensions.width + 1,
      },
    }),
    /Bird raster contract changed: 480x800\/Blades\/testblade7\.png/,
  );
  assert.throws(
    () => getBirdResourceProfile('phone' as never),
    /assetTree must be 480x800 or 720x1280/,
  );
  await assert.rejects(
    () => loadBirdResources('phone' as never),
    /assetTree must be 480x800 or 720x1280/,
  );
  await assert.rejects(
    () => loadBirdResources('480x800', 3 as never),
    /birdType must be 1 or 2/,
  );
  await assert.rejects(
    () => loadBirdResources('480x800', 1.5 as never),
    /birdType must be a safe integer/,
  );
});

function bundleFor(options: Readonly<{
  readonly contracts: readonly RasterContract[];
  readonly rasterError?: Error;
  readonly rasterFrames?: (paths: string[]) => object[];
}>) {
  return {
    load(
      pathOrPaths: string[],
      _Type: unknown,
      callback: (error: Error | null, value: object[]) => void,
    ) {
      assert.ok(Array.isArray(pathOrPaths));
      if (options.rasterError !== undefined) {
        callback(options.rasterError, []);
        return;
      }
      callback(
        null,
        options.rasterFrames?.(pathOrPaths)
          ?? pathOrPaths.map((_, index) => exactFrame(options.contracts, index)),
      );
    },
  };
}

function exactFrame(
  contracts: readonly RasterContract[],
  index: number,
): object {
  const contract = contracts[index];
  assert.ok(contract);
  return new cc.SpriteFrame(
    contract.dimensions.width,
    contract.dimensions.height,
  );
}
