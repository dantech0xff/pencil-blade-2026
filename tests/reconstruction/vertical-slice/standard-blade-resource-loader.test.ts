import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const GAME_RESOURCE_LOADER_STUB_URL = moduleUrl(`
export const loadedRasterBatches = [];
export const receivedBundles = [];
let nextCorruption = null;
let nextFailure = null;

export function corruptNextLoad(kind) {
  nextCorruption = kind;
}

export function failNextLoad(message) {
  nextFailure = new Error(message);
}

export async function loadExactGameRasters(contracts, bundle) {
  loadedRasterBatches.push(contracts);
  receivedBundles.push(bundle);
  if (nextFailure !== null) {
    const failure = nextFailure;
    nextFailure = null;
    throw failure;
  }
  let loaded = contracts.map((contract) => Object.freeze({
    ...contract,
    spriteFrame: Object.freeze({ canonicalPath: contract.canonicalPath }),
  }));
  const corruption = nextCorruption;
  nextCorruption = null;
  if (corruption === 'truncate') {
    loaded = loaded.slice(0, -1);
  } else if (corruption === 'extra') {
    loaded = [...loaded, loaded[0]];
  } else if (corruption === 'path') {
    loaded[0] = Object.freeze({
      ...loaded[0],
      canonicalPath: '480x800/Blades/not-a-standard-blade.png',
    });
  } else if (corruption === 'dimensions') {
    loaded[0] = Object.freeze({
      ...loaded[0],
      dimensions: Object.freeze({
        ...loaded[0].dimensions,
        width: loaded[0].dimensions.width + 1,
      }),
    });
  } else if (corruption === 'reorder') {
    [loaded[0], loaded[1]] = [loaded[1], loaded[0]];
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
  corruptNextLoad(kind: 'dimensions' | 'extra' | 'path' | 'reorder' | 'truncate'): void;
  failNextLoad(message: string): void;
  readonly loadedRasterBatches: Array<readonly RasterContract[]>;
  readonly receivedBundles: unknown[];
};
const {
  LoadedStandardBladeResources,
  loadStandardBladeResources,
} = await import(
  '../../../game/assets/scripts/creator/standard-blade-resource-loader.ts'
);
const {
  getStandardBasicBladeResource,
  getStandardBladeParticleResources,
  getStandardBladeRasterResources,
  getStandardCentipedeBladeResources,
  getStandardDragonBladeResources,
} = await import(
  '../../../game/assets/scripts/domain/standard-blade-resource-contract.ts'
);

interface RasterContract {
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{
    readonly height: number;
    readonly width: number;
  }>;
}

interface LoadedRaster extends RasterContract {
  readonly spriteFrame: Readonly<{ readonly canonicalPath: string }>;
}

test('loader requests and exposes the exact 50-raster closure for both asset trees', async () => {
  for (const tree of ['480x800', '720x1280'] as const) {
    const bundle = Object.freeze({ tree });
    const batchIndex = loaderStub.loadedRasterBatches.length;
    const resources = await loadStandardBladeResources(tree, bundle as never);
    const contracts = getStandardBladeRasterResources(tree);

    assert.equal(resources.assetTree, tree);
    assert.equal(loaderStub.receivedBundles[batchIndex], bundle);
    assert.deepEqual(loaderStub.loadedRasterBatches[batchIndex], contracts);
    assert.equal(contracts.length, 50);

    for (let bladeId = 0; bladeId <= 12; bladeId += 1) {
      assertLoadedMatches(
        resources.basic(bladeId as never),
        getStandardBasicBladeResource(bladeId, tree),
      );
      const particles = resources.particles(bladeId as never);
      const particleContracts = getStandardBladeParticleResources(bladeId, tree);
      assert.equal(Object.isFrozen(particles), true);
      assert.equal(particles.length, particleContracts.length);
      particles.forEach((resource: LoadedRaster, index: number) => {
        assertLoadedMatches(resource, particleContracts[index]);
      });
    }

    for (let bladeId = 13; bladeId <= 16; bladeId += 1) {
      assertMultipartMatches(
        resources.dragon(bladeId as never),
        getStandardDragonBladeResources(bladeId, tree),
      );
    }
    assertMultipartMatches(
      resources.centipede(),
      getStandardCentipedeBladeResources(tree),
    );
  }

  const compactBatch = loaderStub.loadedRasterBatches[0];
  assert.equal(
    compactBatch?.[11]?.canonicalPath,
    '480x800/Blades/firebladetexture.png',
  );
  assert.equal(compactBatch?.[12]?.canonicalPath, '480x800/Blades/rainbow.png');
  const compact = await loadStandardBladeResources('480x800', Object.freeze({}) as never);
  assert.equal(
    compact.basic(11).canonicalPath,
    '480x800/Blades/firebladetexture.png',
  );
  assert.equal(compact.basic(12).canonicalPath, '480x800/Blades/rainbow.png');
});

test('loaded closure rejects every incomplete, reordered, or mismatched result', () => {
  const contracts = getStandardBladeRasterResources('720x1280');
  const valid = createLoaded(contracts);
  assert.doesNotThrow(() => new LoadedStandardBladeResources('720x1280', valid));
  assert.throws(
    () => new LoadedStandardBladeResources('720x1280', valid.slice(0, -1)),
    /exactly 50 rasters/,
  );
  assert.throws(
    () => new LoadedStandardBladeResources('720x1280', [...valid, valid[0]]),
    /exactly 50 rasters/,
  );
  const sparse = new Array(valid.length) as LoadedRaster[];
  sparse[1] = valid[1];
  assert.throws(
    () => new LoadedStandardBladeResources('720x1280', sparse),
    /resource 0 does not match its exact contract/,
  );

  const wrongPath = [...valid];
  wrongPath[0] = Object.freeze({
    ...requireLoaded(wrongPath[0]),
    canonicalPath: '720x1280/Blades/not-a-standard-blade.png',
  });
  assert.throws(
    () => new LoadedStandardBladeResources('720x1280', wrongPath),
    /resource 0 does not match its exact contract/,
  );

  const wrongDimensions = [...valid];
  const first = requireLoaded(wrongDimensions[0]);
  wrongDimensions[0] = Object.freeze({
    ...first,
    dimensions: Object.freeze({
      ...first.dimensions,
      height: first.dimensions.height + 1,
    }),
  });
  assert.throws(
    () => new LoadedStandardBladeResources('720x1280', wrongDimensions),
    /resource 0 does not match its exact contract/,
  );

  const reordered = [...valid];
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  assert.throws(
    () => new LoadedStandardBladeResources('720x1280', reordered),
    /resource 0 does not match its exact contract/,
  );
  assert.throws(
    () => new LoadedStandardBladeResources('phone' as never, valid),
    /assetTree must be 480x800 or 720x1280/,
  );

  const mutable = contracts.map((contract: RasterContract) => ({
    canonicalPath: contract.canonicalPath,
    dimensions: {
      height: contract.dimensions.height,
      width: contract.dimensions.width,
    },
    spriteFrame: { canonicalPath: contract.canonicalPath },
  }));
  const catalog = new LoadedStandardBladeResources('720x1280', mutable);
  const retainedBlade = catalog.basic(0);
  requireLoaded(mutable[0]).dimensions.width += 1;
  requireLoaded(mutable[0]).canonicalPath = '720x1280/Blades/mutated.png';
  requireLoaded(mutable[0]).spriteFrame = {
    canonicalPath: '720x1280/Blades/replaced-frame.png',
  };
  assert.equal(catalog.basic(0), retainedBlade);
  assert.equal(retainedBlade.canonicalPath, contracts[0]?.canonicalPath);
  assert.deepEqual(retainedBlade.dimensions, contracts[0]?.dimensions);
  assert.equal(
    (retainedBlade.spriteFrame as unknown as { canonicalPath: string }).canonicalPath,
    contracts[0]?.canonicalPath,
  );
  assert.equal(Object.isFrozen(retainedBlade), true);
  assert.equal(Object.isFrozen(retainedBlade.dimensions), true);

  assert.throws(() => catalog.basic(13 as never), /BasicBlade ID.*0 through 12/);
  assert.throws(() => catalog.particles(13 as never), /BasicBlade ID.*0 through 12/);
  assert.throws(() => catalog.dragon(12 as never), /DragonBlade ID.*13 through 16/);
  assert.throws(() => catalog.dragon(17 as never), /DragonBlade ID.*13 through 16/);
});

test('async load failures and corrupt batches reject without creating a partial catalog', async () => {
  const bundle = Object.freeze({ name: 'standard-blade-test-bundle' });
  loaderStub.failNextLoad('injected standard blade load failure');
  await assert.rejects(
    loadStandardBladeResources('480x800', bundle as never),
    /injected standard blade load failure/,
  );

  for (const corruption of [
    'truncate',
    'extra',
    'path',
    'dimensions',
    'reorder',
  ] as const) {
    loaderStub.corruptNextLoad(corruption);
    await assert.rejects(
      loadStandardBladeResources('480x800', bundle as never),
      /exactly 50 rasters|does not match its exact contract/,
      corruption,
    );
  }

  const batchCount = loaderStub.loadedRasterBatches.length;
  await assert.rejects(
    loadStandardBladeResources('phone' as never, bundle as never),
    /assetTree must be 480x800 or 720x1280/,
  );
  assert.equal(loaderStub.loadedRasterBatches.length, batchCount);

  const recovered = await loadStandardBladeResources('480x800', bundle as never);
  assert.equal(recovered.assetTree, '480x800');
  assert.equal(recovered.basic(0).canonicalPath, '480x800/Blades/blade0.png');
});

test('Classic catalog retains only the full standard-blade owner', () => {
  const source = readFileSync(
    new URL('../../../game/assets/scripts/creator/classic-resource-loader.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /readonly standardBlades: LoadedStandardBladeResources/);
  assert.match(source, /this\.standardBlades = standardBlades/);
  assert.match(source, /loadStandardBladeResources\(assetTree, bundle\)/);
  assert.doesNotMatch(source, /readonly defaultBlade|this\.defaultBlade/);
});

function createLoaded(contracts: readonly RasterContract[]): LoadedRaster[] {
  return contracts.map((contract) => ({
    canonicalPath: contract.canonicalPath,
    dimensions: Object.freeze({ ...contract.dimensions }),
    spriteFrame: Object.freeze({ canonicalPath: contract.canonicalPath }),
  }));
}

function assertLoadedMatches(
  actual: LoadedRaster,
  expected: RasterContract | undefined,
): void {
  assert.ok(expected);
  assert.equal(actual.canonicalPath, expected.canonicalPath);
  assert.deepEqual(actual.dimensions, expected.dimensions);
  assert.equal(actual.spriteFrame.canonicalPath, expected.canonicalPath);
}

function assertMultipartMatches(
  actual: Readonly<{
    readonly body: LoadedRaster;
    readonly bodySegmentCount: number;
    readonly head: LoadedRaster;
    readonly pointCapacity: number;
    readonly tail: LoadedRaster;
  }>,
  expected: Readonly<{
    readonly body: RasterContract;
    readonly bodySegmentCount: number;
    readonly head: RasterContract;
    readonly pointCapacity: number;
    readonly tail: RasterContract;
  }>,
): void {
  assert.equal(Object.isFrozen(actual), true);
  assert.equal(actual.bodySegmentCount, expected.bodySegmentCount);
  assert.equal(actual.pointCapacity, expected.pointCapacity);
  assertLoadedMatches(actual.head, expected.head);
  assertLoadedMatches(actual.body, expected.body);
  assertLoadedMatches(actual.tail, expected.tail);
}

function requireLoaded<T>(value: T | undefined): T {
  assert.ok(value);
  return value;
}

function moduleUrl(source: string): string {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
