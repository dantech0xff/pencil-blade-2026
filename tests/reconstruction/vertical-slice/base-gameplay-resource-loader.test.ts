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
  readonly Font: new () => object;
  readonly SpriteFrame: new (width: number, height: number) => object;
  readonly assetManager: {
    reset(): void;
    setBundle(bundle: object | null): void;
    setLoadBundleError(error: Error | null): void;
  };
};
const {
  BASE_GAMEPLAY_ARIAL_FONT_RESOURCE,
  listBaseGameplayRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/base-gameplay-resource-contract.ts'
);
const {
  canonicalRasterToSpriteFrameBundlePath,
  canonicalResourceToBundlePath,
} = await import('../../../game/assets/scripts/domain/game-resource-contract.ts');
const {
  loadBaseGameplayResources,
} = await import(
  '../../../game/assets/scripts/creator/base-gameplay-resource-loader.ts'
);

type AssetTree = '480x800' | '720x1280';

interface RasterContract {
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{ height: number; width: number }>;
}

test('both profiles load and map all 13 exact rasters plus shared Arial', async () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    cc.assetManager.reset();
    const contracts = listBaseGameplayRasterResources(assetTree);
    const requested: string[] = [];
    const font = new cc.Font();
    const framesByPath = new Map<string, object>();
    cc.assetManager.setBundle({
      load(
        pathOrPaths: string | string[],
        _Type: unknown,
        callback: (error: Error | null, value: object | object[]) => void,
      ) {
        if (Array.isArray(pathOrPaths)) {
          requested.push(...pathOrPaths);
          callback(null, pathOrPaths.map((path) => {
            const contract = contracts.find(
              (candidate) => (
                canonicalRasterToSpriteFrameBundlePath(candidate.canonicalPath)
                === path
              ),
            );
            assert.ok(contract, `unexpected base-gameplay raster path ${path}`);
            const frame = new cc.SpriteFrame(
              contract.dimensions.width,
              contract.dimensions.height,
            );
            framesByPath.set(contract.canonicalPath, frame);
            return frame;
          }));
          return;
        }
        requested.push(pathOrPaths);
        callback(null, font);
      },
    });

    const loaded = await loadBaseGameplayResources(assetTree);
    assert.equal(contracts.length, 13);
    assert.equal(loaded.assetTree, assetTree);
    assert.equal(loaded.arialFont.canonicalPath, 'Fonts/Arial.ttf');
    assert.equal(loaded.arialFont.font, font);
    assert.deepEqual(requested, [
      ...contracts.map(({ canonicalPath }) => (
        canonicalRasterToSpriteFrameBundlePath(canonicalPath)
      )),
      canonicalResourceToBundlePath(
        BASE_GAMEPLAY_ARIAL_FONT_RESOURCE.canonicalPath,
      ),
    ]);

    const mapped = [
      loaded.pause.objectiveBackground,
      loaded.pause.pauseNormal,
      loaded.pause.pauseSelected,
      loaded.pause.resumeNormal,
      loaded.pause.resumeSelected,
      loaded.pause.replayNormal,
      loaded.pause.replaySelected,
      loaded.pause.quitNormal,
      loaded.pause.quitSelected,
      loaded.objectiveAchievement.completedMessage,
      loaded.objectiveAchievement.nextMessage,
      loaded.objectiveAchievement.xmasFive,
      loaded.objectiveAchievement.xmasFour,
    ];
    assert.deepEqual(
      mapped.map(({ canonicalPath }) => canonicalPath),
      contracts.map(({ canonicalPath }) => canonicalPath),
    );
    for (const raster of mapped) {
      assert.deepEqual(
        raster.dimensions,
        contracts.find(
          ({ canonicalPath }) => canonicalPath === raster.canonicalPath,
        )?.dimensions,
      );
      assert.equal(
        raster.spriteFrame,
        framesByPath.get(raster.canonicalPath),
      );
    }
  }
});

test('omitted and geometry-changed SpriteFrames reject without a partial catalog', async () => {
  const contracts = listBaseGameplayRasterResources('720x1280');
  cc.assetManager.reset();
  cc.assetManager.setBundle(bundleFor({
    contracts,
    font: new cc.Font(),
    rasterFrames: (pathOrPaths) => (
      pathOrPaths.slice(0, -1).map((_, index) => {
        const dimensions = contracts[index]?.dimensions;
        assert.ok(dimensions);
        return new cc.SpriteFrame(dimensions.width, dimensions.height);
      })
    ),
  }));
  await assert.rejects(
    () => loadBaseGameplayResources('720x1280'),
    /Creator omitted SpriteFrame/,
  );

  cc.assetManager.setBundle(bundleFor({
    contracts,
    font: new cc.Font(),
    rasterFrames: (pathOrPaths) => (
      pathOrPaths.map((_, index) => {
        const dimensions = contracts[index]?.dimensions;
        assert.ok(dimensions);
        return new cc.SpriteFrame(
          dimensions.width + (index === 0 ? 1 : 0),
          dimensions.height,
        );
      })
    ),
  }));
  await assert.rejects(
    () => loadBaseGameplayResources('720x1280'),
    /Creator SpriteFrame geometry mismatch/,
  );
});

test('font, raster batch, and game-bundle failures propagate with exact boundaries', async () => {
  const contracts = listBaseGameplayRasterResources('480x800');
  cc.assetManager.reset();
  cc.assetManager.setBundle(bundleFor({
    contracts,
    font: null,
  }));
  await assert.rejects(
    () => loadBaseGameplayResources('480x800'),
    /Creator returned no recovered Arial font/,
  );

  cc.assetManager.setBundle(bundleFor({
    contracts,
    font: new Error('font bytes unavailable'),
  }));
  await assert.rejects(
    () => loadBaseGameplayResources('480x800'),
    /Failed to load recovered Arial font: font bytes unavailable/,
  );

  cc.assetManager.setBundle(bundleFor({
    contracts,
    font: new cc.Font(),
    rasterError: new Error('raster batch unavailable'),
  }));
  await assert.rejects(
    () => loadBaseGameplayResources('480x800'),
    /Failed to load recovered SpriteFrames: raster batch unavailable/,
  );

  cc.assetManager.reset();
  cc.assetManager.setLoadBundleError(new Error('bundle unavailable'));
  await assert.rejects(
    () => loadBaseGameplayResources('480x800'),
    /Failed to load game bundle: bundle unavailable/,
  );
});

function bundleFor(options: Readonly<{
  readonly contracts: readonly RasterContract[];
  /** An Error injects a font-load callback error; null injects a missing font. */
  readonly font: object | Error | null;
  readonly rasterError?: Error;
  readonly rasterFrames?: (paths: string[]) => object[];
}>) {
  return {
    load(
      pathOrPaths: string | string[],
      _Type: unknown,
      callback: (
        error: Error | null,
        value: object | object[] | null,
      ) => void,
    ) {
      if (Array.isArray(pathOrPaths)) {
        if (options.rasterError !== undefined) {
          callback(options.rasterError, []);
          return;
        }
        const frames = options.rasterFrames?.(pathOrPaths)
          ?? pathOrPaths.map((_, index) => {
            const dimensions = options.contracts[index]?.dimensions;
            assert.ok(dimensions);
            return new cc.SpriteFrame(dimensions.width, dimensions.height);
          });
        callback(null, frames);
        return;
      }
      if (options.font instanceof Error) {
        callback(options.font, null);
        return;
      }
      callback(null, options.font);
    },
  };
}
