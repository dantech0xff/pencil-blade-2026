import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type {
  MainMenuState as MainMenuStateType,
} from '../../../game/assets/scripts/domain/main-menu-state.ts';

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
  MAIN_MENU_CAPTURED_PARENT_BOUNDARY,
  MAIN_MENU_INITIAL_NAVIGATION_STATE,
  MAIN_MENU_NAVIGATION_DELAY_SECONDS,
  MAIN_MENU_REVIEW_REWARD_COINS,
  MainMenuState,
  createMainMenuDelayedNavigationCommands,
  createMainMenuImmediateReplacementCommands,
} = await import('../../../game/assets/scripts/domain/main-menu-state.ts');

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

test('enabled construction sets state/volumes then starts only recovered looping menu music', () => {
  const state = createState({ effectsEnabled: true, musicEnabled: true });
  assert.deepEqual(state.constructionCommands, [
    { type: 'set-navigation-state', value: 0 },
    { type: 'set-background-music-volume', value: 1 },
    { type: 'set-effects-volume', value: 1 },
    {
      canonicalPath: 'Sounds/mainmenumusic.mp3',
      loop: true,
      type: 'request-background-music',
    },
  ]);
  assert.deepEqual(state.snapshot, {
    cuttingDisabled: false,
    effectsEnabled: true,
    effectsToggleIndex: 0,
    musicEnabled: true,
    musicToggleIndex: 0,
    navigationState: 0,
    networkAvailable: true,
    rated: false,
    totalCoins: 100,
  });
  assert.equal(MAIN_MENU_INITIAL_NAVIGATION_STATE, 0);
  assertDeepFrozen(state.constructionCommands);
  assertDeepFrozen(state.snapshot);
});

test('music-false initialization preserves stop, callback flip, click gate, and compensation', () => {
  const effectsOn = createState({ effectsEnabled: true, musicEnabled: false });
  assert.deepEqual(effectsOn.constructionCommands, [
    { type: 'set-navigation-state', value: 0 },
    { type: 'set-background-music-volume', value: 1 },
    { type: 'set-effects-volume', value: 1 },
    { releaseData: false, type: 'stop-background-music' },
    { invokesCallback: true, selectedIndex: 1, toggle: 'music', type: 'activate-toggle' },
    { enabled: true, reason: 'callback-flip', type: 'set-music-enabled' },
    {
      canonicalPath: 'Sounds/menubuttonclick.wav',
      loop: false,
      type: 'request-menu-button-audio',
    },
    { enabled: false, reason: 'initialization-compensation', type: 'set-music-enabled' },
  ]);
  assert.equal(effectsOn.snapshot.musicEnabled, false);
  assert.equal(effectsOn.snapshot.musicToggleIndex, 1);

  const effectsOff = createState({ effectsEnabled: false, musicEnabled: false });
  const musicActivation = effectsOff.constructionCommands.slice(3, 7);
  assert.deepEqual(musicActivation, [
    { releaseData: false, type: 'stop-background-music' },
    { invokesCallback: true, selectedIndex: 1, toggle: 'music', type: 'activate-toggle' },
    { enabled: true, reason: 'callback-flip', type: 'set-music-enabled' },
    { enabled: false, reason: 'initialization-compensation', type: 'set-music-enabled' },
  ]);
  assert.equal(
    musicActivation.some(({ type }) => type === 'request-menu-button-audio'),
    false,
  );
});

test('effects-false initialization activates callback, clicks after enabling, then compensates', () => {
  const musicOn = createState({ effectsEnabled: false, musicEnabled: true });
  assert.deepEqual(musicOn.constructionCommands, [
    { type: 'set-navigation-state', value: 0 },
    { type: 'set-background-music-volume', value: 1 },
    { type: 'set-effects-volume', value: 1 },
    {
      canonicalPath: 'Sounds/mainmenumusic.mp3',
      loop: true,
      type: 'request-background-music',
    },
    { invokesCallback: true, selectedIndex: 1, toggle: 'effects', type: 'activate-toggle' },
    { enabled: true, reason: 'callback-flip', type: 'set-effects-enabled' },
    {
      canonicalPath: 'Sounds/menubuttonclick.wav',
      loop: false,
      type: 'request-menu-button-audio',
    },
    { enabled: false, reason: 'initialization-compensation', type: 'set-effects-enabled' },
  ]);
  assert.equal(musicOn.snapshot.effectsEnabled, false);
  assert.equal(musicOn.snapshot.effectsToggleIndex, 1);

  const bothOff = createState({ effectsEnabled: false, musicEnabled: false });
  assert.deepEqual(bothOff.constructionCommands.slice(7), [
    { invokesCallback: true, selectedIndex: 1, toggle: 'effects', type: 'activate-toggle' },
    { enabled: true, reason: 'callback-flip', type: 'set-effects-enabled' },
    {
      canonicalPath: 'Sounds/menubuttonclick.wav',
      loop: false,
      type: 'request-menu-button-audio',
    },
    { enabled: false, reason: 'initialization-compensation', type: 'set-effects-enabled' },
  ]);
  assert.equal(
    bothOff.constructionCommands.filter(({ type }) => type === 'request-menu-button-audio').length,
    1,
  );
});

test('music toggle flips first, stops only off, clicks through effects, and never resumes music', () => {
  const state = createState({ effectsEnabled: true, musicEnabled: true });
  assert.deepEqual(state.toggleMusic(), [
    { enabled: false, reason: 'callback-flip', type: 'set-music-enabled' },
    { releaseData: false, type: 'stop-background-music' },
    {
      canonicalPath: 'Sounds/menubuttonclick.wav',
      loop: false,
      type: 'request-menu-button-audio',
    },
  ]);
  const onCommands = state.toggleMusic();
  assert.deepEqual(onCommands, [
    { enabled: true, reason: 'callback-flip', type: 'set-music-enabled' },
    {
      canonicalPath: 'Sounds/menubuttonclick.wav',
      loop: false,
      type: 'request-menu-button-audio',
    },
  ]);
  assert.equal(onCommands.some(({ type }) => type === 'request-background-music'), false);
  assert.equal(state.snapshot.musicEnabled, true);

  state.toggleEffects();
  assert.deepEqual(state.toggleMusic(), [
    { enabled: false, reason: 'callback-flip', type: 'set-music-enabled' },
    { releaseData: false, type: 'stop-background-music' },
  ]);
});

test('effects toggle stops all effects on disable and requests click only after enabling', () => {
  const state = createState({ effectsEnabled: true, musicEnabled: true });
  assert.deepEqual(state.toggleEffects(), [
    { enabled: false, reason: 'callback-flip', type: 'set-effects-enabled' },
    { type: 'stop-all-effects' },
  ]);
  assert.equal(state.snapshot.effectsEnabled, false);
  assert.deepEqual(state.toggleEffects(), [
    { enabled: true, reason: 'callback-flip', type: 'set-effects-enabled' },
    {
      canonicalPath: 'Sounds/menubuttonclick.wav',
      loop: false,
      type: 'request-menu-button-audio',
    },
  ]);
  assert.equal(state.snapshot.effectsEnabled, true);
});

test('about/options immediately replace through captured parent then apply effects-gated click', () => {
  const enabled = createState({ effectsEnabled: true });
  assert.deepEqual(enabled.aboutCommands(), [
    { boundary: 'captured-main-menu-parent', type: 'capture-main-menu-parent' },
    { cleanup: true, type: 'remove-main-menu' },
    { destination: 'AboutLayer', fresh: true, type: 'construct-immediate-destination' },
    {
      boundary: 'captured-main-menu-parent',
      destination: 'AboutLayer',
      type: 'attach-immediate-destination-to-captured-parent',
      zOrder: 1,
    },
    {
      canonicalPath: 'Sounds/menubuttonclick.wav',
      loop: false,
      type: 'request-menu-button-audio',
    },
  ]);
  assert.deepEqual(enabled.optionsCommands().map(({ type }) => type), [
    'capture-main-menu-parent',
    'remove-main-menu',
    'construct-immediate-destination',
    'attach-immediate-destination-to-captured-parent',
    'request-menu-button-audio',
  ]);
  const disabled = createState({ effectsEnabled: false });
  assert.deepEqual(disabled.optionsCommands(), [
    { boundary: 'captured-main-menu-parent', type: 'capture-main-menu-parent' },
    { cleanup: true, type: 'remove-main-menu' },
    { destination: 'OptionsLayer', fresh: true, type: 'construct-immediate-destination' },
    {
      boundary: 'captured-main-menu-parent',
      destination: 'OptionsLayer',
      type: 'attach-immediate-destination-to-captured-parent',
      zOrder: 1,
    },
  ]);
  assert.throws(
    () => createMainMenuImmediateReplacementCommands('StoreLayer' as never, true),
    /AboutLayer or OptionsLayer/,
  );
  assert.throws(
    () => createMainMenuImmediateReplacementCommands('AboutLayer', 1 as never),
    /boolean/,
  );
});

test('review always requests isolated port and conditionally rewards exactly once in recovered order', () => {
  const eligible = createState({ networkAvailable: true, rated: false, totalCoins: 100 });
  assert.deepEqual(eligible.reviewCommands(), [
    { boundary: 'isolated-platform-review-port', type: 'request-platform-review' },
    { type: 'persist-rated-flag', value: true },
    { type: 'set-rated-in-memory', value: true },
    {
      delta: 500,
      nextTotalCoins: 600,
      previousTotalCoins: 100,
      type: 'add-total-coins',
      updatesExistingLabel: false,
    },
  ]);
  assert.equal(MAIN_MENU_REVIEW_REWARD_COINS, 500);
  assert.equal(eligible.snapshot.rated, true);
  assert.equal(eligible.snapshot.totalCoins, 600);
  assert.deepEqual(eligible.reviewCommands(), [
    { boundary: 'isolated-platform-review-port', type: 'request-platform-review' },
  ]);
  assert.equal(eligible.snapshot.totalCoins, 600);

  for (const input of [
    { networkAvailable: false, rated: false },
    { networkAvailable: true, rated: true },
    { networkAvailable: false, rated: true },
  ]) {
    const state = createState(input);
    assert.deepEqual(state.reviewCommands(), [
      { boundary: 'isolated-platform-review-port', type: 'request-platform-review' },
    ]);
    assert.equal(state.snapshot.totalCoins, 100);
  }
});

test('review overflow fails before state mutation', () => {
  const state = createState({ totalCoins: 0x7fff_ffff });
  const before = state.snapshot;
  assert.throws(() => state.reviewCommands(), /signed 32-bit/);
  assert.deepEqual(state.snapshot, before);
});

test('exit preserves click then director end then save, with only click effects-gated', () => {
  assert.deepEqual(createState({ effectsEnabled: true }).exitCommands(), [
    {
      canonicalPath: 'Sounds/menubuttonclick.wav',
      loop: false,
      type: 'request-menu-button-audio',
    },
    { type: 'end-director' },
    { type: 'save-settings-data' },
  ]);
  assert.deepEqual(createState({ effectsEnabled: false }).exitCommands(), [
    { type: 'end-director' },
    { type: 'save-settings-data' },
  ]);
});

test('only first Fruit callback is accepted with disable, delay, then state-store order', () => {
  const state = createState({ musicEnabled: true });
  const first = state.acceptFruitNavigation('leaderboard');
  assert.deepEqual(first, {
    accepted: true,
    commands: [
      { disabled: true, type: 'set-cutting-disabled' },
      {
        actions: [
          { durationSeconds: Math.fround(0.75), type: 'delay' },
          { callback: 'delayed-navigation', type: 'invoke-callback' },
        ],
        destinationReadAtExecution: true,
        type: 'schedule-main-menu-navigation',
      },
      { type: 'set-navigation-state', value: 2 },
    ],
    destinationState: 2,
    fruitId: 13,
    purpose: 'leaderboard',
  });
  assert.equal(MAIN_MENU_NAVIGATION_DELAY_SECONDS, Math.fround(0.75));
  assert.equal(state.snapshot.cuttingDisabled, true);
  assert.equal(state.snapshot.navigationState, 2);

  const later = state.acceptFruitNavigation('new-game');
  assert.deepEqual(later, {
    accepted: false,
    commands: [],
    destinationState: 1,
    fruitId: 2,
    purpose: 'new-game',
  });
  assert.equal(state.snapshot.navigationState, 2);
  assertDeepFrozen(first);
  assertDeepFrozen(later);
});

test('all Fruit IDs map to exact state/destination and delayed same-parent replacement order', () => {
  const fixtures = [
    { destination: 'ModeSelectLayer', fruitId: 2, purpose: 'new-game', state: 1 },
    { destination: 'LeaderboardLayer', fruitId: 13, purpose: 'leaderboard', state: 2 },
    { destination: 'ObjectivesLayer', fruitId: 7, purpose: 'objectives', state: 3 },
  ] as const;
  for (const fixture of fixtures) {
    const state = createState({ musicEnabled: true });
    const accepted = state.acceptFruitNavigationById(fixture.fruitId);
    assert.equal(accepted.purpose, fixture.purpose);
    assert.equal(accepted.destinationState, fixture.state);
    assert.deepEqual(state.delayedNavigationCommands(), [
      { boundary: 'captured-main-menu-parent', type: 'capture-main-menu-parent' },
      { cleanup: true, type: 'remove-main-menu' },
      {
        destination: fixture.destination,
        destinationState: fixture.state,
        fresh: true,
        type: 'construct-delayed-destination',
      },
      {
        boundary: 'captured-main-menu-parent',
        destination: fixture.destination,
        destinationState: fixture.state,
        type: 'attach-delayed-destination-to-captured-parent',
        zOrder: 1,
      },
      { releaseData: false, type: 'stop-background-music' },
    ]);
    const delayedTypes = state.delayedNavigationCommands().map(({ type }) => type);
    assert.ok(
      delayedTypes.indexOf('stop-background-music')
        > delayedTypes.indexOf('attach-delayed-destination-to-captured-parent'),
    );
    assert.equal(
      state.delayedNavigationCommands().some(({ type }) => type === 'request-menu-button-audio'),
      false,
    );
  }
  assert.equal(MAIN_MENU_CAPTURED_PARENT_BOUNDARY, 'captured-main-menu-parent');
});

test('delayed callback gates only destination construction and final music stop', () => {
  assert.deepEqual(createMainMenuDelayedNavigationCommands(3, false), [
    { boundary: 'captured-main-menu-parent', type: 'capture-main-menu-parent' },
    { cleanup: true, type: 'remove-main-menu' },
    {
      destination: 'ObjectivesLayer',
      destinationState: 3,
      fresh: true,
      type: 'construct-delayed-destination',
    },
    {
      boundary: 'captured-main-menu-parent',
      destination: 'ObjectivesLayer',
      destinationState: 3,
      type: 'attach-delayed-destination-to-captured-parent',
      zOrder: 1,
    },
  ]);
  assert.deepEqual(createMainMenuDelayedNavigationCommands(99, true), [
    { boundary: 'captured-main-menu-parent', type: 'capture-main-menu-parent' },
    { cleanup: true, type: 'remove-main-menu' },
    { releaseData: false, type: 'stop-background-music' },
  ]);
  assert.throws(
    () => createMainMenuDelayedNavigationCommands(Number.NaN, true),
    /signed 32-bit/,
  );
  assert.throws(
    () => createMainMenuDelayedNavigationCommands(1, 'yes' as never),
    /boolean/,
  );
});

test('state validates complete construction input and exposes no JNI, store URL, or destination art', () => {
  assert.throws(() => new MainMenuState(null as never), /state object/);
  assert.throws(
    () => createState({ effectsEnabled: 1 as never }),
    /effectsEnabled.*boolean/,
  );
  assert.throws(
    () => new MainMenuState({
      effectsEnabled: true,
      musicEnabled: undefined as never,
      networkAvailable: true,
      rated: false,
      totalCoins: 100,
    }),
    /musicEnabled.*boolean/,
  );
  assert.throws(
    () => createState({ networkAvailable: 'yes' as never }),
    /networkAvailable.*boolean/,
  );
  assert.throws(() => createState({ rated: 0 as never }), /rated.*boolean/);
  assert.throws(() => createState({ totalCoins: 1.5 }), /signed 32-bit/);
  assert.throws(() => createState({ totalCoins: 0x8000_0000 }), /signed 32-bit/);
  assert.throws(() => createState().acceptFruitNavigation('credits' as never), /purpose/);
  assert.throws(() => createState().acceptFruitNavigationById(8), /fruitId/);

  const productionSources = [
    'game/assets/scripts/domain/main-menu-resource-contract.ts',
    'game/assets/scripts/domain/main-menu-presentation.ts',
    'game/assets/scripts/domain/main-menu-state.ts',
  ].map(readText).join('\n');
  assert.doesNotMatch(productionSources, /showReviewTaskJNI|https?:\/\/|libgame\.so/);
  assert.doesNotMatch(productionSources, /placeholder/i);
  const consumerSources = [
    'game/assets/scripts/domain/main-menu-presentation.ts',
    'game/assets/scripts/domain/main-menu-state.ts',
  ].map(readText).join('\n');
  assert.doesNotMatch(consumerSources, /Buttons\/button-review-(?:normal|selected)\.png/);
});

function createState(overrides: Partial<{
  effectsEnabled: boolean;
  musicEnabled: boolean;
  networkAvailable: boolean;
  rated: boolean;
  totalCoins: number;
}> = {}): MainMenuStateType {
  return new MainMenuState({
    effectsEnabled: overrides.effectsEnabled ?? true,
    musicEnabled: overrides.musicEnabled ?? true,
    networkAvailable: overrides.networkAvailable ?? true,
    rated: overrides.rated ?? false,
    totalCoins: overrides.totalCoins ?? 100,
  });
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

function readText(relativePath: string): string {
  return readFileSync(`${REPOSITORY_ROOT}${relativePath}`, 'utf8');
}
