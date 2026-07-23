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
  CRAZY_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY,
  CRAZY_BIRD_RESULT_MENU_BUTTON_AUDIO_PATH,
  CRAZY_BIRD_RESULT_NAVIGATION_CALLBACK_ABSENCES,
  CRAZY_BIRD_RESULT_NAVIGATION_Z_ORDER,
  createCrazyBirdResultNavigationCommands,
} = await import(
  '../../../game/assets/scripts/domain/crazy-bird-result-navigation.ts'
);

const CAPTURE = Object.freeze({
  boundary: 'captured-result-parent',
  type: 'capture-result-parent',
});
const REMOVE = Object.freeze({ cleanup: true, type: 'remove-result' });

test('Crazy Bird Retry constructs a fresh mode 4 owner under the captured parent', () => {
  assert.deepEqual(createCrazyBirdResultNavigationCommands({
    effectsEnabled: true,
    mode: 4,
    route: 'retry',
  }), [
    {
      canonicalPath: 'Sounds/menubuttonclick.wav',
      loop: false,
      type: 'request-menu-button-audio',
    },
    CAPTURE,
    REMOVE,
    { fresh: true, mode: 4, type: 'construct-crazy-bird' },
    {
      boundary: 'captured-result-parent',
      type: 'attach-crazy-bird-to-captured-parent',
      zOrder: 1,
    },
  ]);
});

test('Crazy Bird Retry audio remains effects-gated', () => {
  assert.deepEqual(createCrazyBirdResultNavigationCommands({
    effectsEnabled: false,
    mode: 4,
    route: 'retry',
  }), [
    CAPTURE,
    REMOVE,
    { fresh: true, mode: 4, type: 'construct-crazy-bird' },
    {
      boundary: 'captured-result-parent',
      type: 'attach-crazy-bird-to-captured-parent',
      zOrder: 1,
    },
  ]);
});

test('Crazy Bird Main Menu preserves remove, construct, attach order', () => {
  assert.deepEqual(createCrazyBirdResultNavigationCommands({
    effectsEnabled: false,
    mode: 4,
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

test('navigation excludes delay, save, shared reset, effects stop, and scene work', () => {
  const absences = {
    delays: false,
    reloadsScene: false,
    replacesScene: false,
    resetsSharedState: false,
    saves: false,
    stopsEffects: false,
  };
  assert.deepEqual(CRAZY_BIRD_RESULT_NAVIGATION_CALLBACK_ABSENCES, {
    'main-menu': absences,
    retry: absences,
  });
  assert.equal(
    CRAZY_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY,
    'captured-result-parent',
  );
  assert.equal(CRAZY_BIRD_RESULT_MENU_BUTTON_AUDIO_PATH, 'Sounds/menubuttonclick.wav');
  assert.equal(CRAZY_BIRD_RESULT_NAVIGATION_Z_ORDER, 1);
});

test('invalid inputs fail closed and command batches are deeply immutable', () => {
  for (const input of [
    null,
    { effectsEnabled: true, mode: 1, route: 'retry' },
    { effectsEnabled: true, mode: 4, route: 'again' },
    { effectsEnabled: 1, mode: 4, route: 'retry' },
  ]) {
    assert.throws(
      () => createCrazyBirdResultNavigationCommands(input as never),
    );
  }
  const commands = createCrazyBirdResultNavigationCommands({
    effectsEnabled: true,
    mode: 4,
    route: 'retry',
  });
  assert.equal(Object.isFrozen(commands), true);
  assert.equal(commands.every(Object.isFrozen), true);
});
