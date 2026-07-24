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
      ...contract,
      spriteFrame: Object.freeze({ canonicalPath: contract.canonicalPath }),
    }));
    if (state.mode === 'incomplete') loaded.pop();
    if (state.mode === 'sparse') delete loaded[4];
    if (state.mode === 'mutated-path') {
      loaded[2] = Object.freeze({
        ...loaded[2],
        canonicalPath: '480x800/Leaderboard/substitute.png',
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
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{ readonly height: number; readonly width: number }>;
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
  collectLeaderboardRasterContracts,
  loadLeaderboardResources,
} = await import(
  '../../../game/assets/scripts/creator/leaderboard-resource-loader.ts'
);
const {
  getLeaderboardRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/leaderboard-resource-contract.ts'
);

test('loader uses one bundle and concurrently requests ten rasters plus both exact fonts', async () => {
  loaderStub.state.reset();
  const profile = getLeaderboardRasterResources('480x800');
  const expectedContracts = collectLeaderboardRasterContracts(profile);
  const resources = await loadLeaderboardResources('480x800');

  assert.equal(loaderStub.state.bundleCalls, 1);
  assert.equal(loaderStub.state.rasterBatches.length, 1);
  assert.deepEqual(
    loaderStub.state.rasterBatches[0]?.map(({ canonicalPath }) => canonicalPath),
    expectedContracts.map(({ canonicalPath }) => canonicalPath),
  );
  assert.deepEqual(
    loaderStub.state.fontLoads.map(({ path }) => path),
    ['Fonts/Andyb', 'Fonts/Century'],
  );
  assert.deepEqual(loaderStub.state.events.slice(0, 4), [
    'bundle',
    'rasters:start',
    'font:Fonts/Andyb:start',
    'font:Fonts/Century:start',
  ]);

  assert.equal(resources.assetTree, '480x800');
  assert.equal(resources.rasterCount, 10);
  assert.equal((resources.playerFont as unknown as { readonly path: string }).path, 'Fonts/Andyb');
  assert.equal((resources.scoreFont as unknown as { readonly path: string }).path, 'Fonts/Century');
  assert.equal(Object.isFrozen(resources), true);
  assert.equal(
    resources.raster(profile.headers.crazyBird).canonicalPath,
    '480x800/Leaderboard/leaderboard_crazy_bird.png',
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
      canonicalPath: '480x800/Leaderboard/not-native.png',
      dimensions: { height: 1, width: 1 },
    }),
    /was not loaded/,
  );
});

test('collector preserves semantic order as a frozen defensive snapshot', () => {
  const profile = cloneProfile(getLeaderboardRasterResources('720x1280'));
  const contracts = collectLeaderboardRasterContracts(profile);
  assert.deepEqual(
    contracts.map(({ canonicalPath }) => canonicalPath),
    [
      '720x1280/Leaderboard/leaderboard_title.png',
      '720x1280/Leaderboard/leaderboard_view_templete.png',
      '720x1280/Leaderboard/leaderboard_classic.png',
      '720x1280/Leaderboard/leaderboard_crazy.png',
      '720x1280/Leaderboard/leaderboard_gnstyle.png',
      '720x1280/Leaderboard/leaderboard_classic_bird.png',
      '720x1280/Leaderboard/leaderboard_crazy_bird.png',
      '720x1280/Leaderboard/leaderboard_combo_bird.png',
      '720x1280/Buttons/button-blue-back-normal.png',
      '720x1280/Buttons/button-back-selected.png',
    ],
  );
  assertDeepFrozen(contracts);

  profile.title.canonicalPath = 'mutated-after-collection.png';
  profile.title.dimensions.width = 1;
  assert.equal(
    contracts[0]?.canonicalPath,
    '720x1280/Leaderboard/leaderboard_title.png',
  );
  assert.deepEqual(contracts[0]?.dimensions, { height: 159, width: 793 });
});

test('collector rejects duplicate, missing, sparse, extra, and mutated profiles', () => {
  const profile = getLeaderboardRasterResources('720x1280');
  assert.throws(
    () => collectLeaderboardRasterContracts({
      ...profile,
      template: profile.title,
    }),
    /Duplicate Leaderboard raster/,
  );

  const {
    comboBird: _missingComboBird,
    ...missingHeader
  } = profile.headers;
  assert.throws(
    () => collectLeaderboardRasterContracts({
      ...profile,
      headers: missingHeader,
    } as never),
    /must expose exactly/,
  );
  assert.throws(
    () => collectLeaderboardRasterContracts({
      ...profile,
      headers: new Array(6),
    } as never),
    /must be an object/,
  );
  assert.throws(
    () => collectLeaderboardRasterContracts({
      ...profile,
      fallback: profile.title,
    } as never),
    /must expose exactly/,
  );
  assert.throws(
    () => collectLeaderboardRasterContracts({
      ...profile,
      back: {
        ...profile.back,
        normal: {
          ...profile.back.normal,
          canonicalPath: '720x1280/Icons/back-button.png',
        },
      },
    }),
    /contract changed/,
  );
  assert.throws(
    () => collectLeaderboardRasterContracts({
      ...profile,
      headers: {
        ...profile.headers,
        gnStyle: {
          ...profile.headers.gnStyle,
          dimensions: { height: 137, width: 663 },
        },
      },
    }),
    /contract changed/,
  );
  assert.throws(
    () => collectLeaderboardRasterContracts(null as never),
    /must be an object/,
  );
});

test('loader rejects incomplete, sparse, substituted, or geometry-mutated Creator results', async () => {
  for (const [mode, pattern] of [
    ['incomplete', /incomplete Leaderboard raster catalog/],
    ['sparse', /sparse Leaderboard raster catalog/],
    ['mutated-path', /substituted Leaderboard raster/],
    ['mutated-geometry', /changed Leaderboard raster geometry/],
  ] as const) {
    loaderStub.state.reset();
    loaderStub.state.mode = mode;
    await assert.rejects(loadLeaderboardResources('480x800'), pattern);
  }
});

interface MutableRasterContract {
  canonicalPath: string;
  dimensions: { height: number; width: number };
}

interface MutableLeaderboardProfile {
  back: {
    normal: MutableRasterContract;
    selected: MutableRasterContract;
  };
  headers: {
    classic: MutableRasterContract;
    classicBird: MutableRasterContract;
    comboBird: MutableRasterContract;
    crazy: MutableRasterContract;
    crazyBird: MutableRasterContract;
    gnStyle: MutableRasterContract;
  };
  template: MutableRasterContract;
  title: MutableRasterContract;
}

function cloneProfile(profile: unknown): MutableLeaderboardProfile {
  return JSON.parse(JSON.stringify(profile)) as MutableLeaderboardProfile;
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
