import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const CC_STUB_URL = moduleUrl(`
export class Font {}
`);

const GAME_RESOURCE_LOADER_STUB_URL = moduleUrl(`
export const loadedFontPaths = [];
export const loadedRasterBatches = [];
export const bundle = {
  load(path, Type, callback) {
    loadedFontPaths.push({ path, Type });
    callback(null, Object.freeze({ kind: 'font', path }));
  },
};
export async function loadGameResourceBundle() { return bundle; }
export async function loadExactGameRasters(contracts, receivedBundle) {
  if (receivedBundle !== bundle) throw new Error('wrong bundle');
  loadedRasterBatches.push(contracts);
  return Object.freeze(contracts.map((contract) => Object.freeze({
    ...contract,
    spriteFrame: Object.freeze({ canonicalPath: contract.canonicalPath }),
  })));
}
`);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') return { shortCircuit: true, url: CC_STUB_URL };
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
  readonly loadedFontPaths: Array<{ readonly path: string; readonly Type: unknown }>;
  readonly loadedRasterBatches: Array<readonly RasterContract[]>;
};
const {
  collectOptionsRasterContracts,
  loadOptionsResources,
} = await import('../../../game/assets/scripts/creator/options-resource-loader.ts');
const {
  getOptionsRasterResources,
} = await import('../../../game/assets/scripts/domain/options-resource-contract.ts');

interface RasterContract {
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{ readonly height: number; readonly width: number }>;
}

test('loader requests the exact 51-raster profile and SlabThing font once', async () => {
  const profile = getOptionsRasterResources('480x800');
  const contracts = collectOptionsRasterContracts(profile);
  assert.equal(contracts.length, 51);
  assert.equal(new Set(contracts.map(({ canonicalPath }) => canonicalPath)).size, 51);
  assert.equal(contracts[0]?.canonicalPath, '480x800/Options/options-title.png');
  assert.equal(
    contracts.at(-1)?.canonicalPath,
    '480x800/Icons/background-icon-7.png',
  );

  const resources = await loadOptionsResources('480x800');

  assert.equal(resources.assetTree, '480x800');
  assert.equal(resources.rasterCount, 51);
  assert.equal(loaderStub.loadedRasterBatches.length, 1);
  assert.deepEqual(
    loaderStub.loadedRasterBatches[0]?.map(({ canonicalPath }) => canonicalPath),
    contracts.map(({ canonicalPath }) => canonicalPath),
  );
  assert.equal(loaderStub.loadedFontPaths.length, 1);
  assert.equal(loaderStub.loadedFontPaths[0]?.path, 'Fonts/SlabThing');
  assert.equal(
    resources.raster(profile.bladeIcons[17] as RasterContract).canonicalPath,
    '480x800/Icons/blade-icon-17.png',
  );
  assert.throws(
    () => resources.raster({
      canonicalPath: profile.title.canonicalPath,
      dimensions: { height: 1, width: 1 },
    }),
    /contract changed/,
  );
  assert.throws(
    () => resources.raster({
      canonicalPath: '480x800/not-options.png',
      dimensions: { height: 1, width: 1 },
    }),
    /was not loaded/,
  );
});

test('collector rejects duplicate or incomplete profiles before loading Creator assets', () => {
  const profile = getOptionsRasterResources('720x1280');
  assert.throws(
    () => collectOptionsRasterContracts({
      ...profile,
      title: profile.sectionHeaders.background,
    }),
    /Duplicate Options raster/,
  );
  assert.throws(
    () => collectOptionsRasterContracts({
      ...profile,
      backgroundIcons: profile.backgroundIcons.slice(0, 7),
    }),
    /exactly 51/,
  );
  assert.throws(() => collectOptionsRasterContracts(null as never), /must be an object/);
});

function moduleUrl(source: string): string {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
