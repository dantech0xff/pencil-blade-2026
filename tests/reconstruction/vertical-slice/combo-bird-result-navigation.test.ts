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
  COMBO_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY,
  COMBO_BIRD_RESULT_MENU_BUTTON_AUDIO_PATH,
  COMBO_BIRD_RESULT_NAVIGATION_CALLBACK_ABSENCES,
  COMBO_BIRD_RESULT_NAVIGATION_Z_ORDER,
  createComboBirdResultNavigationCommands,
} = await import(
  '../../../game/assets/scripts/domain/combo-bird-result-navigation.ts'
);

const CAPTURE = Object.freeze({
  boundary: 'captured-result-parent',
  type: 'capture-result-parent',
});
const REMOVE = Object.freeze({ cleanup: true, type: 'remove-result' });

test('Combo Bird Retry constructs a fresh mode 5 owner under the captured parent', () => {
  assert.deepEqual(createComboBirdResultNavigationCommands({
    effectsEnabled: true,
    mode: 5,
    route: 'retry',
  }), [
    {
      canonicalPath: 'Sounds/menubuttonclick.wav',
      loop: false,
      type: 'request-menu-button-audio',
    },
    CAPTURE,
    REMOVE,
    { fresh: true, mode: 5, type: 'construct-combo-bird' },
    {
      boundary: 'captured-result-parent',
      type: 'attach-combo-bird-to-captured-parent',
      zOrder: 1,
    },
  ]);
});

test('Combo Bird Retry audio remains effects-gated', () => {
  assert.deepEqual(createComboBirdResultNavigationCommands({
    effectsEnabled: false,
    mode: 5,
    route: 'retry',
  }), [
    CAPTURE,
    REMOVE,
    { fresh: true, mode: 5, type: 'construct-combo-bird' },
    {
      boundary: 'captured-result-parent',
      type: 'attach-combo-bird-to-captured-parent',
      zOrder: 1,
    },
  ]);
});

test('Combo Bird Main Menu preserves remove, construct, attach order', () => {
  assert.deepEqual(createComboBirdResultNavigationCommands({
    effectsEnabled: false,
    mode: 5,
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
    reseedsRandom: false,
    resetsSharedState: false,
    saves: false,
    stopsEffects: false,
  };
  assert.deepEqual(COMBO_BIRD_RESULT_NAVIGATION_CALLBACK_ABSENCES, {
    'main-menu': absences,
    retry: absences,
  });
  assert.equal(
    COMBO_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY,
    'captured-result-parent',
  );
  assert.equal(COMBO_BIRD_RESULT_MENU_BUTTON_AUDIO_PATH, 'Sounds/menubuttonclick.wav');
  assert.equal(COMBO_BIRD_RESULT_NAVIGATION_Z_ORDER, 1);
});

test('invalid inputs fail closed and command batches are deeply immutable', () => {
  for (const input of [
    null,
    { effectsEnabled: true, mode: 4, route: 'retry' },
    { effectsEnabled: true, mode: 5, route: 'again' },
    { effectsEnabled: 1, mode: 5, route: 'retry' },
  ]) {
    assert.throws(
      () => createComboBirdResultNavigationCommands(input as never),
    );
  }
  const commands = createComboBirdResultNavigationCommands({
    effectsEnabled: true,
    mode: 5,
    route: 'retry',
  });
  assert.equal(Object.isFrozen(commands), true);
  assert.equal(commands.every(Object.isFrozen), true);
});
