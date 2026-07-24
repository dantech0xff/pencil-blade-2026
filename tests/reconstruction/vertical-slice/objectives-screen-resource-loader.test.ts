import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

const CC_STUB_URL = moduleUrl(`
export class Font {}
`);

const GAME_RESOURCE_LOADER_STUB_URL = moduleUrl(`
export const state = {
  bundleCalls: 0,
  events: [],
  fontLoads: [],
  mode: 'normal',
  rasterBatches: [],
  reset() {
    this.bundleCalls = 0;
    this.events.length = 0;
    this.fontLoads.length = 0;
    this.mode = 'normal';
    this.rasterBatches.length = 0;
  },
};
export const bundle = {
  load(path, Type, callback) {
    state.fontLoads.push({ path, Type });
    state.events.push('font:' + path + ':start');
    queueMicrotask(() => {
      state.events.push('font:' + path + ':done');
      callback(null, Object.freeze({ kind: 'font', path }));
    });
  },
};
export async function loadGameResourceBundle() {
  state.bundleCalls += 1;
  state.events.push('bundle');
  return bundle;
}
export function loadExactGameRasters(contracts, receivedBundle) {
  if (receivedBundle !== bundle) throw new Error('wrong bundle');
  state.rasterBatches.push(contracts);
  state.events.push('rasters:start');
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
        canonicalPath: '480x800/Objectives/substitute.png',
      });
    }
    if (state.mode === 'mutated-geometry') {
      loaded[2] = Object.freeze({
        ...loaded[2],
        dimensions: Object.freeze({ height: 1, width: 1 }),
      });
    }
    resolve(Object.freeze(loaded));
  }));
}
`);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') {
      return { shortCircuit: true, url: CC_STUB_URL };
    }
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
  readonly consumerClassification: string;
  readonly dimensions: Readonly<{ readonly height: number; readonly width: number }>;
  readonly hasUnattachedProbeInstance: boolean;
  readonly sha256: string;
}

interface LoaderStubState {
  bundleCalls: number;
  readonly events: string[];
  readonly fontLoads: Array<{ readonly path: string; readonly Type: unknown }>;
  mode: 'normal' | 'incomplete' | 'sparse' | 'mutated-path' | 'mutated-geometry';
  readonly rasterBatches: Array<readonly RasterContract[]>;
  reset(): void;
}

const loaderStub = await import(GAME_RESOURCE_LOADER_STUB_URL) as unknown as {
  readonly state: LoaderStubState;
};
const {
  collectObjectivesScreenRasterContracts,
  loadObjectivesScreenResources,
} = await import(
  '../../../game/assets/scripts/creator/objectives-screen-resource-loader.ts'
);
const {
  getObjectivesScreenRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/objectives-screen-resource-contract.ts'
);

test('loader requests one exact bundle batch of ten rasters plus Arial', async () => {
  loaderStub.state.reset();
  const profile = getObjectivesScreenRasterResources('480x800');
  const expected = collectObjectivesScreenRasterContracts(profile);
  const loaded = await loadObjectivesScreenResources('480x800');

  assert.equal(loaderStub.state.bundleCalls, 1);
  assert.equal(loaderStub.state.rasterBatches.length, 1);
  assert.deepEqual(
    loaderStub.state.rasterBatches[0]?.map(({ canonicalPath }) => canonicalPath),
    expected.map(({ canonicalPath }) => canonicalPath),
  );
  assert.deepEqual(
    loaderStub.state.fontLoads.map(({ path }) => path),
    ['Fonts/Arial'],
  );
  assert.deepEqual(loaderStub.state.events.slice(0, 3), [
    'bundle',
    'rasters:start',
    'font:Fonts/Arial:start',
  ]);
  assert.equal(loaded.assetTree, '480x800');
  assert.equal(loaded.rasterCount, 10);
  assert.equal(loaded.arialFont.canonicalPath, 'Fonts/Arial.ttf');
  assert.equal(
    (loaded.arialFont.font as unknown as { readonly path: string }).path,
    'Fonts/Arial',
  );
  assert.equal(Object.isFrozen(loaded), true);
  assert.equal(
    loaded.raster(profile.fixedCurrentRow).canonicalPath,
    '480x800/Objectives/objectives-next.png',
  );
  assert.throws(
    () => loaded.raster({
      ...profile.fixedCurrentRow,
      sha256: '0'.repeat(64),
    }),
    /contract changed/,
  );
  assert.throws(
    () => loaded.raster({
      ...profile.fixedCurrentRow,
      canonicalPath: '480x800/Objectives/objectives-pause-background.png',
    }),
    /was not loaded/,
  );
});

test('collector preserves domain order as a deep-frozen defensive snapshot', () => {
  const profile = cloneProfile(getObjectivesScreenRasterResources('720x1280'));
  const contracts = collectObjectivesScreenRasterContracts(profile);
  assert.deepEqual(
    contracts.map(({ canonicalPath }) => canonicalPath),
    [
      '720x1280/Objectives/button-skip-selected.png',
      '720x1280/Objectives/button-skip.png',
      '720x1280/Objectives/objectives-active.png',
      '720x1280/Objectives/objectives-background.png',
      '720x1280/Objectives/objectives-inactive.png',
      '720x1280/Objectives/objectives-next-background.png',
      '720x1280/Objectives/objectives-next.png',
      '720x1280/Objectives/objectives-objectives-background.png',
      '720x1280/Buttons/button-blue-back-normal.png',
      '720x1280/Buttons/button-back-selected.png',
    ],
  );
  assertDeepFrozen(contracts);
  profile.skip.selected.canonicalPath = 'mutated-after-collection.png';
  profile.skip.selected.dimensions.width = 1;
  assert.equal(
    contracts[0]?.canonicalPath,
    '720x1280/Objectives/button-skip-selected.png',
  );
  assert.deepEqual(contracts[0]?.dimensions, { height: 129, width: 189 });
});

test('collector rejects fallback paths and every mutated identity field', () => {
  const profile = cloneProfile(getObjectivesScreenRasterResources('720x1280'));
  profile.back.normal.canonicalPath = '720x1280/Icons/back-button.png';
  assert.throws(
    () => collectObjectivesScreenRasterContracts(profile),
    /contract changed/,
  );

  for (const mutate of [
    (candidate: MutableProfile) => { candidate.header.dimensions.width = 1; },
    (candidate: MutableProfile) => { candidate.footer.bytes = 1; },
    (candidate: MutableProfile) => { candidate.fixedCurrentRow.sha256 = '0'.repeat(64); },
    (candidate: MutableProfile) => {
      candidate.fixedCurrentRow.hasUnattachedProbeInstance = false;
    },
  ]) {
    const candidate = cloneProfile(getObjectivesScreenRasterResources('480x800'));
    mutate(candidate);
    assert.throws(
      () => collectObjectivesScreenRasterContracts(candidate),
      /contract changed|probe classification/,
    );
  }

  const extra = cloneProfile(getObjectivesScreenRasterResources('480x800')) as
    MutableProfile & { fallback?: RasterContract };
  extra.fallback = extra.background;
  assert.throws(
    () => collectObjectivesScreenRasterContracts(extra),
    /must expose exactly/,
  );
});

test('loader rejects incomplete, sparse, substituted, or geometry-mutated results', async () => {
  for (const [mode, pattern] of [
    ['incomplete', /incomplete Objectives screen raster catalog/],
    ['sparse', /sparse Objectives screen raster catalog/],
    ['mutated-path', /substituted Objectives screen raster/],
    ['mutated-geometry', /changed Objectives screen raster geometry/],
  ] as const) {
    loaderStub.state.reset();
    loaderStub.state.mode = mode;
    await assert.rejects(loadObjectivesScreenResources('480x800'), pattern);
  }
});

interface MutableRasterContract {
  bytes: number;
  canonicalPath: string;
  consumerClassification: 'attached-visible' | 'unattached-probe-and-attached-visible';
  dimensions: { height: number; width: number };
  hasUnattachedProbeInstance: boolean;
  sha256: string;
}

interface MutableProfile {
  back: { normal: MutableRasterContract; selected: MutableRasterContract };
  background: MutableRasterContract;
  fixedCurrentRow: MutableRasterContract;
  footer: MutableRasterContract;
  header: MutableRasterContract;
  ordinaryRows: {
    finished: MutableRasterContract;
    unfinished: MutableRasterContract;
  };
  skip: { normal: MutableRasterContract; selected: MutableRasterContract };
}

function cloneProfile(profile: unknown): MutableProfile {
  return JSON.parse(JSON.stringify(profile)) as MutableProfile;
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
