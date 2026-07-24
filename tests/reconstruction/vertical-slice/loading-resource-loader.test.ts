import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

const GAME_RESOURCE_LOADER_STUB_URL = moduleUrl(`
export const loadedRasterBatches = [];
export const bundle = Object.freeze({ name: 'game' });
let resultMode = 'exact';
export function setResultMode(mode) { resultMode = mode; }
export async function loadGameResourceBundle() { return bundle; }
export async function loadExactGameRasters(contracts, receivedBundle) {
  if (receivedBundle !== bundle) throw new Error('wrong bundle');
  loadedRasterBatches.push(contracts);
  const loaded = contracts.map((contract) => Object.freeze({
    ...contract,
    spriteFrame: Object.freeze({ canonicalPath: contract.canonicalPath }),
  }));
  if (resultMode === 'short') return Object.freeze(loaded.slice(0, -1));
  if (resultMode === 'substituted') {
    loaded[0] = Object.freeze({
      ...loaded[0],
      dimensions: Object.freeze({
        ...loaded[0].dimensions,
        width: loaded[0].dimensions.width + 1,
      }),
    });
  }
  return Object.freeze(loaded);
}
`);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './game-resource-loader') {
      return { shortCircuit: true, url: GAME_RESOURCE_LOADER_STUB_URL };
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

const loaderStub = await import(GAME_RESOURCE_LOADER_STUB_URL) as unknown as {
  readonly loadedRasterBatches: Array<readonly RasterContract[]>;
  setResultMode(mode: 'exact' | 'short' | 'substituted'): void;
};
const {
  loadLoadingResources,
} = await import('../../../game/assets/scripts/creator/loading-resource-loader.ts');
const {
  collectLoadingRasterResources,
  getLoadingRasterResources,
} = await import('../../../game/assets/scripts/domain/loading-resource-contract.ts');

interface RasterContract {
  readonly bytes: number;
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{ readonly height: number; readonly width: number }>;
  readonly sha256: string;
}

test('Loading loader requests and retains the exact selected four-raster profile', async () => {
  loaderStub.setResultMode('exact');
  const contracts = collectLoadingRasterResources('720x1280');
  const resources = await loadLoadingResources('720x1280');
  const profile = getLoadingRasterResources('720x1280');

  assert.equal(resources.assetTree, '720x1280');
  assert.equal(resources.rasterCount, 4);
  assert.deepEqual(
    loaderStub.loadedRasterBatches.at(-1)?.map(({ canonicalPath }) => canonicalPath),
    contracts.map(({ canonicalPath }) => canonicalPath),
  );
  assert.equal(
    resources.raster(profile.progress).canonicalPath,
    '720x1280/Loading/loadprocess.png',
  );
  assert.throws(
    () => resources.raster({
      ...profile.progress,
      sha256: '0'.repeat(64),
    }),
    /contract changed/,
  );
});

test('Loading loader rejects incomplete and dimension-substituted Creator results', async () => {
  loaderStub.setResultMode('short');
  await assert.rejects(
    loadLoadingResources('480x800'),
    /incomplete Loading raster catalog/,
  );

  loaderStub.setResultMode('substituted');
  await assert.rejects(
    loadLoadingResources('480x800'),
    /substituted Loading raster/,
  );
  loaderStub.setResultMode('exact');
});

function moduleUrl(source: string): string {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
