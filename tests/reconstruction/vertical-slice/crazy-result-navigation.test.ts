import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CRAZY_RESULT_CAPTURED_PARENT_BOUNDARY,
  CRAZY_RESULT_MENU_BUTTON_AUDIO_PATH,
  CRAZY_RESULT_MODE_ID,
  CRAZY_RESULT_NAVIGATION_CALLBACK_ABSENCES,
  CRAZY_RESULT_NAVIGATION_Z_ORDER,
  createCrazyResultNavigationCommands,
} from '../../../game/assets/scripts/domain/crazy-result-navigation.ts';

const CAPTURE = Object.freeze({
  boundary: 'captured-result-parent',
  type: 'capture-result-parent',
});
const REMOVE = Object.freeze({ cleanup: true, type: 'remove-result' });

test('Crazy Retry is effects-gated and constructs fresh mode 1 under the captured parent', () => {
  assert.deepEqual(createCrazyResultNavigationCommands({
    effectsEnabled: true,
    mode: 1,
    route: 'retry',
  }), [
    {
      canonicalPath: 'Sounds/menubuttonclick.wav',
      loop: false,
      type: 'request-menu-button-audio',
    },
    CAPTURE,
    REMOVE,
    { fresh: true, mode: 1, type: 'construct-crazy' },
    {
      boundary: 'captured-result-parent',
      type: 'attach-crazy-to-captured-parent',
      zOrder: 1,
    },
  ]);
  assert.deepEqual(createCrazyResultNavigationCommands({
    effectsEnabled: false,
    mode: 1,
    route: 'retry',
  }), [
    CAPTURE,
    REMOVE,
    { fresh: true, mode: 1, type: 'construct-crazy' },
    {
      boundary: 'captured-result-parent',
      type: 'attach-crazy-to-captured-parent',
      zOrder: 1,
    },
  ]);
});

test('Crazy Main Menu route preserves synchronous remove, construct, and attach order', () => {
  assert.deepEqual(createCrazyResultNavigationCommands({
    effectsEnabled: false,
    mode: 1,
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

test('navigation explicitly excludes save, delay, reset, effects-stop, and scene work', () => {
  const absences = {
    delays: false,
    reloadsScene: false,
    replacesScene: false,
    resetsSharedState: false,
    saves: false,
    stopsEffects: false,
  };
  assert.deepEqual(CRAZY_RESULT_NAVIGATION_CALLBACK_ABSENCES, {
    'main-menu': absences,
    retry: absences,
  });
  assert.equal(CRAZY_RESULT_MODE_ID, 1);
  assert.equal(CRAZY_RESULT_MENU_BUTTON_AUDIO_PATH, 'Sounds/menubuttonclick.wav');
  assert.equal(CRAZY_RESULT_CAPTURED_PARENT_BOUNDARY, 'captured-result-parent');
  assert.equal(CRAZY_RESULT_NAVIGATION_Z_ORDER, 1);
});

test('invalid inputs fail closed and command batches are deeply immutable', () => {
  for (const input of [
    null,
    { effectsEnabled: true, mode: 0, route: 'retry' },
    { effectsEnabled: true, mode: 1, route: 'again' },
    { effectsEnabled: 1, mode: 1, route: 'retry' },
  ]) {
    assert.throws(() => createCrazyResultNavigationCommands(input as never));
  }
  const commands = createCrazyResultNavigationCommands({
    effectsEnabled: true,
    mode: 1,
    route: 'retry',
  });
  assert.equal(Object.isFrozen(commands), true);
  assert.equal(commands.every(Object.isFrozen), true);
});

test('Crazy navigation domain has no Creator dependency', () => {
  const source = readFileSync(new URL(
    '../../../game/assets/scripts/domain/crazy-result-navigation.ts',
    import.meta.url,
  ), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]cc['"]/);
});
