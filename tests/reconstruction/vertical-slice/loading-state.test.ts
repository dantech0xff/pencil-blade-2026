import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../'))
      && extname(specifier) === ''
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const {
  LOADING_FINISH_DELAY_SECONDS,
  LOADING_PROGRESS_DENOMINATOR,
  LoadingState,
} = await import('../../../game/assets/scripts/domain/loading-state.ts');

test('Loading advances exactly one recovered audio preload per rendered update', () => {
  const state = new LoadingState();
  const frames = Array.from({ length: 62 }, () => state.update(1 / 60));

  assert.equal(LOADING_PROGRESS_DENOMINATOR, 61);
  assert.deepEqual(
    frames.map(({ preload }) => preload?.index),
    Array.from({ length: 62 }, (_, index) => index),
  );
  assert.equal(frames[0]?.progress, Math.fround(1 / 61));
  assert.equal(frames[59]?.progress, Math.fround(60 / 61));
  assert.equal(frames[60]?.progress, 1);
  assert.equal(frames[61]?.progress, 1);
  assert.equal(frames[61]?.preloadCount, 62);
  assert.equal(frames.every(({ phase }) => phase === 'preloading'), true);
});

test('the next update starts delay and exactly half a second later finishes once', () => {
  const state = new LoadingState();
  for (let index = 0; index < 62; index += 1) {
    state.update(index / 1000);
  }
  const delayStart = state.update(100);
  assert.deepEqual(delayStart, {
    finishedThisFrame: false,
    phase: 'delay',
    preload: null,
    progress: 1,
    preloadCount: 62,
  });

  assert.equal(LOADING_FINISH_DELAY_SECONDS, Math.fround(0.5));
  const before = state.update(0.49);
  assert.equal(before.phase, 'delay');
  assert.equal(before.finishedThisFrame, false);
  const finished = state.update(0.01);
  assert.equal(finished.phase, 'finished');
  assert.equal(finished.finishedThisFrame, true);
  assert.equal(state.update(1).finishedThisFrame, false);
  assert.equal(state.snapshot.phase, 'finished');
});

test('preload phase ignores delta magnitude but rejects invalid frame deltas', () => {
  const state = new LoadingState();
  assert.equal(state.update(60).preload?.index, 0);
  assert.equal(state.update(0).preload?.index, 1);
  assert.throws(() => state.update(-1), RangeError);
  assert.throws(() => state.update(Number.NaN), RangeError);
  assert.throws(() => state.update(Number.POSITIVE_INFINITY), RangeError);
});
