import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

const GAME_RESOURCE_LOADER_STUB_URL = moduleUrl(`
export const state = {
  bundleCalls: 0,
  events: [],
  mode: 'normal',
  rasterBatches: [],
  reset() {
    this.bundleCalls = 0;
    this.events.length = 0;
    this.mode = 'normal';
    this.rasterBatches.length = 0;
  },
};
export const bundle = Object.freeze({ kind: 'bundle' });
export async function loadGameResourceBundle() {
  state.bundleCalls += 1;
  state.events.push('bundle');
  return bundle;
}
export function loadExactGameRasters(contracts, receivedBundle) {
  if (receivedBundle !== bundle) throw new Error('wrong bundle');
  state.rasterBatches.push(contracts);
  state.events.push('rasters:start');
  if (state.mode === 'load-failed') {
    return Promise.reject(new Error('synthetic raster load failure'));
  }
  return new Promise((resolve) => queueMicrotask(() => {
    state.events.push('rasters:done');
    const loaded = contracts.map((contract) => Object.freeze({
      canonicalPath: contract.canonicalPath,
      dimensions: contract.dimensions,
      spriteFrame: Object.freeze({ canonicalPath: contract.canonicalPath }),
    }));
    if (state.mode === 'incomplete') loaded.pop();
    if (state.mode === 'sparse') delete loaded[4];
    if (state.mode === 'mutated-path') {
      loaded[2] = Object.freeze({
        ...loaded[2],
        canonicalPath: '480x800/Buttons/substitute.png',
      });
    }
    if (state.mode === 'mutated-geometry') {
      loaded[2] = Object.freeze({
        ...loaded[2],
        dimensions: Object.freeze({ height: 1, width: 1 }),
      });
    }
    if (state.mode === 'duplicate') {
      loaded[9] = Object.freeze({
        ...loaded[9],
        canonicalPath: loaded[8].canonicalPath,
      });
    }
    resolve(Object.freeze(loaded));
  }));
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

interface RasterContract {
  readonly bytes: number;
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{ readonly height: number; readonly width: number }>;
  readonly sha256: string;
}

interface LoaderStubState {
  bundleCalls: number;
  readonly events: string[];
  mode:
    | 'normal'
    | 'load-failed'
    | 'incomplete'
    | 'sparse'
    | 'mutated-path'
    | 'mutated-geometry'
    | 'duplicate';
  readonly rasterBatches: Array<readonly RasterContract[]>;
  reset(): void;
}

const loaderStub = await import(GAME_RESOURCE_LOADER_STUB_URL) as unknown as {
  readonly state: LoaderStubState;
};
const {
  AboutResourceLoaderError,
  collectAboutRasterContracts,
  loadAboutResources,
} = await import(
  '../../../game/assets/scripts/creator/about-resource-loader.ts'
);
const {
  getAboutRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/about-resource-contract.ts'
);

test('loader submits one exact ordered batch and exposes identity-checked lookup', async () => {
  loaderStub.state.reset();
  const profile = getAboutRasterResources('480x800');
  const expected = collectAboutRasterContracts(profile);
  const loaded = await loadAboutResources('480x800');

  assert.equal(loaderStub.state.bundleCalls, 1);
  assert.equal(loaderStub.state.rasterBatches.length, 1);
  assert.deepEqual(loaderStub.state.events, [
    'bundle',
    'rasters:start',
    'rasters:done',
  ]);
  assert.deepEqual(
    loaderStub.state.rasterBatches[0]?.map(({ canonicalPath }) => canonicalPath),
    expected.map(({ canonicalPath }) => canonicalPath),
  );
  assert.equal(loaded.assetTree, '480x800');
  assert.equal(loaded.rasterCount, 10);
  assert.equal(Object.isFrozen(loaded), true);
  assert.equal(
    loaded.raster(profile.heart).canonicalPath,
    '480x800/Interfaces/heart.png',
  );

  assert.throws(
    () => loaded.raster({
      ...profile.heart,
      sha256: '0'.repeat(64),
    }),
    (error: unknown) => (
      error instanceof AboutResourceLoaderError
      && error.code === 'raster-contract-changed'
      && error.canonicalPath === '480x800/Interfaces/heart.png'
    ),
  );
  assert.throws(
    () => loaded.raster({
      ...profile.heart,
      canonicalPath: '480x800/Interfaces/other-heart.png',
    }),
    (error: unknown) => (
      error instanceof AboutResourceLoaderError
      && error.code === 'raster-not-loaded'
    ),
  );
});

test('collector returns a deep-frozen defensive canonical-order snapshot', () => {
  const profile = cloneProfile(getAboutRasterResources('720x1280'));
  const contracts = collectAboutRasterContracts(profile);
  assert.deepEqual(
    contracts.map(({ canonicalPath }) => canonicalPath),
    [
      '720x1280/Backgrounds/aboutbackground.png',
      '720x1280/Buttons/button-menu-normal.png',
      '720x1280/Buttons/button-menu-selected.png',
      '720x1280/Buttons/button-review-normal.png',
      '720x1280/Buttons/button-review-selected.png',
      '720x1280/Buttons/button-email-normal.png',
      '720x1280/Buttons/button-email-selected.png',
      '720x1280/Buttons/button-like-normal.png',
      '720x1280/Buttons/button-like-selected.png',
      '720x1280/Interfaces/heart.png',
    ],
  );
  assertDeepFrozen(contracts);

  profile.review.normal.canonicalPath = 'mutated-after-collection.png';
  profile.review.normal.dimensions.width = 1;
  assert.equal(
    contracts[3]?.canonicalPath,
    '720x1280/Buttons/button-review-normal.png',
  );
  assert.deepEqual(contracts[3]?.dimensions, { height: 142, width: 156 });
});

test('collector rejects swapped pairs, duplicate paths, extras, and identity mutation', () => {
  const swapped = cloneProfile(getAboutRasterResources('480x800'));
  [swapped.review.normal, swapped.review.selected] = [
    swapped.review.selected,
    swapped.review.normal,
  ];
  assertLoaderThrow(
    () => collectAboutRasterContracts(swapped),
    'invalid-contract',
  );

  const duplicate = cloneProfile(getAboutRasterResources('480x800'));
  duplicate.like.selected = {
    ...duplicate.like.normal,
    dimensions: { ...duplicate.like.normal.dimensions },
  };
  assertLoaderThrow(
    () => collectAboutRasterContracts(duplicate),
    'invalid-contract',
  );

  const extra = cloneProfile(getAboutRasterResources('480x800')) as
    MutableProfile & { fallback?: MutableRasterContract };
  extra.fallback = { ...extra.background };
  assertLoaderThrow(
    () => collectAboutRasterContracts(extra),
    'invalid-contract',
  );

  for (const mutate of [
    (candidate: MutableProfile) => { candidate.background.bytes = 1; },
    (candidate: MutableProfile) => { candidate.email.normal.dimensions.width = 1; },
    (candidate: MutableProfile) => { candidate.heart.sha256 = '0'.repeat(64); },
    (candidate: MutableProfile) => {
      candidate.menu.normal.canonicalPath = '480x800/Buttons/fallback.png';
    },
  ]) {
    const candidate = cloneProfile(getAboutRasterResources('480x800'));
    mutate(candidate);
    assertLoaderThrow(
      () => collectAboutRasterContracts(candidate),
      'invalid-contract',
    );
  }
});

test('loader reports typed failures for load and every malformed Creator catalog', async () => {
  for (const [mode, code] of [
    ['load-failed', 'resource-load-failed'],
    ['incomplete', 'catalog-incomplete'],
    ['sparse', 'catalog-sparse'],
    ['mutated-path', 'catalog-substituted'],
    ['mutated-geometry', 'catalog-geometry-mismatch'],
    ['duplicate', 'catalog-duplicate'],
  ] as const) {
    loaderStub.state.reset();
    loaderStub.state.mode = mode;
    await assert.rejects(
      loadAboutResources('480x800'),
      (error: unknown) => (
        error instanceof AboutResourceLoaderError
        && error.code === code
        && (
          code !== 'resource-load-failed'
          || error.cause instanceof Error
        )
      ),
    );
  }
});

test('loader wraps a noncanonical selected tree as an invalid contract', async () => {
  loaderStub.state.reset();
  await assert.rejects(
    loadAboutResources('compact' as never),
    (error: unknown) => (
      error instanceof AboutResourceLoaderError
      && error.code === 'invalid-contract'
      && error.cause instanceof RangeError
    ),
  );
  assert.equal(loaderStub.state.bundleCalls, 0);
});

interface MutableRasterContract {
  bytes: number;
  canonicalPath: string;
  dimensions: { height: number; width: number };
  sha256: string;
}

interface MutableProfile {
  background: MutableRasterContract;
  menu: { normal: MutableRasterContract; selected: MutableRasterContract };
  review: { normal: MutableRasterContract; selected: MutableRasterContract };
  email: { normal: MutableRasterContract; selected: MutableRasterContract };
  like: { normal: MutableRasterContract; selected: MutableRasterContract };
  heart: MutableRasterContract;
}

function cloneProfile(profile: unknown): MutableProfile {
  return JSON.parse(JSON.stringify(profile)) as MutableProfile;
}

function assertLoaderThrow(
  callback: () => unknown,
  code: string,
): void {
  assert.throws(
    callback,
    (error: unknown) => (
      error instanceof AboutResourceLoaderError
      && error.code === code
    ),
  );
}

function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return;
  }
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) {
    assertDeepFrozen(child, seen);
  }
}

function moduleUrl(source: string): string {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
