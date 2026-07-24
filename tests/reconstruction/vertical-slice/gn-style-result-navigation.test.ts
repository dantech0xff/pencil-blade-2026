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
  GN_STYLE_RESULT_CAPTURED_PARENT_BOUNDARY,
  GN_STYLE_RESULT_MENU_BUTTON_AUDIO_PATH,
  GN_STYLE_RESULT_NAVIGATION_CALLBACK_ABSENCES,
  GN_STYLE_RESULT_NAVIGATION_Z_ORDER,
  createGnStyleResultNavigationCommands,
} = await import(
  '../../../game/assets/scripts/domain/gn-style-result-navigation.ts'
);

const CAPTURE = Object.freeze({
  boundary: 'captured-result-parent',
  type: 'capture-result-parent',
});
const REMOVE = Object.freeze({ cleanup: true, type: 'remove-result' });

test('GN Style Retry constructs a fresh mode 2 owner under the captured parent', () => {
  assert.deepEqual(createGnStyleResultNavigationCommands({
    effectsEnabled: true,
    mode: 2,
    route: 'retry',
  }), [
    {
      canonicalPath: 'Sounds/menubuttonclick.wav',
      loop: false,
      type: 'request-menu-button-audio',
    },
    CAPTURE,
    REMOVE,
    { fresh: true, mode: 2, type: 'construct-gn-style' },
    {
      boundary: 'captured-result-parent',
      type: 'attach-gn-style-to-captured-parent',
      zOrder: 1,
    },
  ]);
});

test('GN Style Retry audio remains effects-gated', () => {
  assert.deepEqual(createGnStyleResultNavigationCommands({
    effectsEnabled: false,
    mode: 2,
    route: 'retry',
  }), [
    CAPTURE,
    REMOVE,
    { fresh: true, mode: 2, type: 'construct-gn-style' },
    {
      boundary: 'captured-result-parent',
      type: 'attach-gn-style-to-captured-parent',
      zOrder: 1,
    },
  ]);
});

test('GN Style Main Menu preserves remove, construct, attach order', () => {
  assert.deepEqual(createGnStyleResultNavigationCommands({
    effectsEnabled: false,
    mode: 2,
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
  assert.deepEqual(GN_STYLE_RESULT_NAVIGATION_CALLBACK_ABSENCES, {
    'main-menu': absences,
    retry: absences,
  });
  assert.equal(
    GN_STYLE_RESULT_CAPTURED_PARENT_BOUNDARY,
    'captured-result-parent',
  );
  assert.equal(GN_STYLE_RESULT_MENU_BUTTON_AUDIO_PATH, 'Sounds/menubuttonclick.wav');
  assert.equal(GN_STYLE_RESULT_NAVIGATION_Z_ORDER, 1);
});

test('invalid inputs fail closed and command batches are deeply immutable', () => {
  for (const input of [
    null,
    { effectsEnabled: true, mode: 5, route: 'retry' },
    { effectsEnabled: true, mode: 2, route: 'again' },
    { effectsEnabled: 1, mode: 2, route: 'retry' },
  ]) {
    assert.throws(
      () => createGnStyleResultNavigationCommands(input as never),
    );
  }
  const commands = createGnStyleResultNavigationCommands({
    effectsEnabled: true,
    mode: 2,
    route: 'retry',
  });
  assert.equal(Object.isFrozen(commands), true);
  assert.equal(commands.every(Object.isFrozen), true);
});
