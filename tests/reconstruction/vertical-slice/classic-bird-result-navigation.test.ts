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
  CLASSIC_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY,
  CLASSIC_BIRD_RESULT_NAVIGATION_CALLBACK_ABSENCES,
  CLASSIC_BIRD_RESULT_NAVIGATION_Z_ORDER,
  createClassicBirdResultNavigationCommands,
} = await import(
  '../../../game/assets/scripts/domain/classic-bird-result-navigation.ts'
);

const CAPTURE = Object.freeze({
  boundary: 'captured-result-parent',
  type: 'capture-result-parent',
});
const REMOVE = Object.freeze({ cleanup: true, type: 'remove-result' });

test('Classic Bird Retry synchronously constructs a fresh mode 3 owner', () => {
  assert.deepEqual(createClassicBirdResultNavigationCommands({
    effectsEnabled: true,
    mode: 3,
    route: 'retry',
  }), [
    {
      canonicalPath: 'Sounds/menubuttonclick.wav',
      loop: false,
      type: 'request-menu-button-audio',
    },
    CAPTURE,
    REMOVE,
    { fresh: true, mode: 3, type: 'construct-classic-bird' },
    {
      boundary: 'captured-result-parent',
      type: 'attach-classic-bird-to-captured-parent',
      zOrder: 1,
    },
  ]);
});

test('Classic Bird retry audio remains effects-gated', () => {
  assert.deepEqual(createClassicBirdResultNavigationCommands({
    effectsEnabled: false,
    mode: 3,
    route: 'retry',
  }), [
    CAPTURE,
    REMOVE,
    { fresh: true, mode: 3, type: 'construct-classic-bird' },
    {
      boundary: 'captured-result-parent',
      type: 'attach-classic-bird-to-captured-parent',
      zOrder: 1,
    },
  ]);
});

test('Classic Bird Main Menu preserves remove, construct, attach order', () => {
  assert.deepEqual(createClassicBirdResultNavigationCommands({
    effectsEnabled: false,
    mode: 3,
    route: 'main-menu',
  }), [
    CAPTURE,
    REMOVE,
    { fresh: true, type: 'construct-main-menu' },
    {
      boundary: 'captured-result-parent',
      type: 'attach-main-menu-to-captured-parent',
      zOrder: 1,
    },
  ]);
});

test('navigation excludes delay, scene reload, reseed, and save work', () => {
  const absences = {
    delays: false,
    reloadsScene: false,
    replacesScene: false,
    reseedsRandom: false,
    saves: false,
  };
  assert.deepEqual(CLASSIC_BIRD_RESULT_NAVIGATION_CALLBACK_ABSENCES, {
    'main-menu': absences,
    retry: absences,
  });
  assert.equal(
    CLASSIC_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY,
    'captured-result-parent',
  );
  assert.equal(CLASSIC_BIRD_RESULT_NAVIGATION_Z_ORDER, 1);
});

test('invalid inputs fail closed and command batches are immutable', () => {
  for (const input of [
    null,
    { effectsEnabled: true, mode: 1, route: 'retry' },
    { effectsEnabled: true, mode: 3, route: 'again' },
    { effectsEnabled: 1, mode: 3, route: 'retry' },
  ]) {
    assert.throws(
      () => createClassicBirdResultNavigationCommands(input as never),
    );
  }
  const commands = createClassicBirdResultNavigationCommands({
    effectsEnabled: true,
    mode: 3,
    route: 'retry',
  });
  assert.equal(Object.isFrozen(commands), true);
  assert.equal(commands.every(Object.isFrozen), true);
});
