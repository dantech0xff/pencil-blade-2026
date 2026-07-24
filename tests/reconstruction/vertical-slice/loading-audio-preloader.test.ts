import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

const CC_STUB_URL = moduleUrl(`
export class AudioClip {}
`);

const GAME_RESOURCE_LOADER_STUB_URL = moduleUrl(`
export const preloads = [];
export const bundle = {
  preload(path, Type) {
    preloads.push(Object.freeze({ path, Type }));
  },
};
export async function loadGameResourceBundle() { return bundle; }
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

const cc = await import('cc') as unknown as {
  readonly AudioClip: new () => unknown;
};
const loaderStub = await import(GAME_RESOURCE_LOADER_STUB_URL) as unknown as {
  readonly preloads: Array<{
    readonly path: string;
    readonly Type: unknown;
  }>;
};
const {
  LoadingAudioPreloader,
} = await import('../../../game/assets/scripts/creator/loading-audio-preloader.ts');
const {
  LOADING_AUDIO_PRELOAD_STEPS,
} = await import('../../../game/assets/scripts/domain/loading-resource-contract.ts');

test('audio adapter warms all 62 recovered bundle paths with AudioClip in exact order', async () => {
  const preloader = await LoadingAudioPreloader.create();
  for (const step of LOADING_AUDIO_PRELOAD_STEPS) {
    preloader.preload(step);
  }

  assert.equal(loaderStub.preloads.length, 62);
  assert.deepEqual(
    loaderStub.preloads.map(({ path }) => path),
    LOADING_AUDIO_PRELOAD_STEPS.map(({ canonicalPath }) => (
      canonicalPath.slice(0, canonicalPath.lastIndexOf('.'))
    )),
  );
  assert.equal(
    loaderStub.preloads.every(({ Type }) => Type === cc.AudioClip),
    true,
  );
});

test('audio adapter rejects cloned, reordered, or forged preload steps', async () => {
  const preloader = await LoadingAudioPreloader.create();
  const first = LOADING_AUDIO_PRELOAD_STEPS[0];
  const second = LOADING_AUDIO_PRELOAD_STEPS[1];
  assert.ok(first);
  assert.ok(second);

  assert.throws(
    () => preloader.preload({ ...first }),
    /changed from the recovered sequence/,
  );
  assert.throws(
    () => preloader.preload({ ...second, index: 0 }),
    /changed from the recovered sequence/,
  );
});

function moduleUrl(source: string): string {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
