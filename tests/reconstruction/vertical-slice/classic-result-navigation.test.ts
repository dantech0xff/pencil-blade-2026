import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

import type {
  ClassicResultNavigationCommand,
} from '../../../game/assets/scripts/domain/classic-result-navigation.ts';

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
  CLASSIC_RESULT_CAPTURED_PARENT_BOUNDARY,
  CLASSIC_RESULT_NAVIGATION_CALLBACK_ABSENCES,
  CLASSIC_RESULT_NAVIGATION_Z_ORDER,
  createClassicResultNavigationCommands,
} = await import('../../../game/assets/scripts/domain/classic-result-navigation.ts');

const MENU_BUTTON_AUDIO = Object.freeze({
  canonicalPath: 'Sounds/menubuttonclick.wav',
  loop: false,
  type: 'request-menu-button-audio',
});
const CAPTURE_PARENT = Object.freeze({
  boundary: 'captured-result-parent',
  type: 'capture-result-parent',
});
const REMOVE_RESULT = Object.freeze({ cleanup: true, type: 'remove-result' });

test('effects-enabled Retry preserves click then same-parent fresh mode-0 replacement order', () => {
  assert.deepEqual(createClassicResultNavigationCommands({
    effectsEnabled: true,
    mode: 0,
    route: 'retry',
  }), [
    MENU_BUTTON_AUDIO,
    CAPTURE_PARENT,
    REMOVE_RESULT,
    { fresh: true, mode: 0, type: 'construct-classic' },
    {
      boundary: 'captured-result-parent',
      type: 'attach-classic-to-captured-parent',
      zOrder: 1,
    },
  ]);
});

test('effects-disabled Retry suppresses only the click request', () => {
  assert.deepEqual(createClassicResultNavigationCommands({
    effectsEnabled: false,
    mode: 0,
    route: 'retry',
  }), [
    CAPTURE_PARENT,
    REMOVE_RESULT,
    { fresh: true, mode: 0, type: 'construct-classic' },
    {
      boundary: 'captured-result-parent',
      type: 'attach-classic-to-captured-parent',
      zOrder: 1,
    },
  ]);
});

test('effects-enabled Main Menu preserves click then same-parent fresh replacement order', () => {
  assert.deepEqual(createClassicResultNavigationCommands({
    effectsEnabled: true,
    mode: 0,
    route: 'main-menu',
  }), [
    MENU_BUTTON_AUDIO,
    CAPTURE_PARENT,
    REMOVE_RESULT,
    { fresh: true, type: 'construct-main-menu' },
    {
      boundary: 'captured-result-parent',
      type: 'attach-main-menu-to-captured-parent',
      zOrder: 1,
    },
  ]);
});

test('effects-disabled Main Menu suppresses only the click request', () => {
  assert.deepEqual(createClassicResultNavigationCommands({
    effectsEnabled: false,
    mode: 0,
    route: 'main-menu',
  }), [
    CAPTURE_PARENT,
    REMOVE_RESULT,
    { fresh: true, type: 'construct-main-menu' },
    {
      boundary: 'captured-result-parent',
      type: 'attach-main-menu-to-captured-parent',
      zOrder: 1,
    },
  ]);
});

test('both callbacks explicitly exclude save, scene, effects-stop, delay, and reset work', () => {
  const absences = {
    delays: false,
    reloadsScene: false,
    replacesScene: false,
    resetsSharedState: false,
    saves: false,
    stopsEffects: false,
  };
  assert.deepEqual(CLASSIC_RESULT_NAVIGATION_CALLBACK_ABSENCES, {
    'main-menu': absences,
    retry: absences,
  });
  assert.equal(Object.isFrozen(CLASSIC_RESULT_NAVIGATION_CALLBACK_ABSENCES), true);
  assert.equal(Object.isFrozen(CLASSIC_RESULT_NAVIGATION_CALLBACK_ABSENCES.retry), true);
});

test('navigation inputs and outputs are immutable while runtime validation fails closed', () => {
  const input = Object.freeze({ effectsEnabled: true, mode: 0 as const, route: 'retry' as const });
  const commands = createClassicResultNavigationCommands(input);

  assert.deepEqual(input, { effectsEnabled: true, mode: 0, route: 'retry' });
  assert.equal(Object.isFrozen(commands), true);
  assert.equal(commands.every(Object.isFrozen), true);
  assert.equal(CLASSIC_RESULT_CAPTURED_PARENT_BOUNDARY, 'captured-result-parent');
  assert.equal(CLASSIC_RESULT_NAVIGATION_Z_ORDER, 1);

  const invalidInputs = [
    null,
    { effectsEnabled: true, mode: 0, route: 'again' },
    { effectsEnabled: true, mode: 1, route: 'retry' },
    { effectsEnabled: 1, mode: 0, route: 'retry' },
  ];
  for (const invalidInput of invalidInputs) {
    let partialOutput: readonly ClassicResultNavigationCommand[] | undefined;
    assert.throws(() => {
      partialOutput = createClassicResultNavigationCommands(invalidInput as never);
    });
    assert.equal(partialOutput, undefined);
  }
});

test('the recovered navigation domain has no Creator dependency', () => {
  const source = readFileSync(new URL(
    '../../../game/assets/scripts/domain/classic-result-navigation.ts',
    import.meta.url,
  ), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]cc['"]/);
});
