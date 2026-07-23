import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

import type {
  ClassicInt32PreferencePort,
} from '../../../game/assets/scripts/domain/classic-settings-state.ts';

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
  CLASSIC_BEST_1_STORAGE_KEY,
  CLASSIC_BEST_2_STORAGE_KEY,
  CLASSIC_BEST_3_STORAGE_KEY,
  CLASSIC_EFFECTS_ENABLED_STORAGE_KEY,
  CLASSIC_MODE_UNLOCK_INDICES,
  CLASSIC_MUSIC_ENABLED_STORAGE_KEY,
  CLASSIC_NETWORK_AVAILABLE_STORAGE_KEY,
  CLASSIC_RATED_STORAGE_KEY,
  CLASSIC_SELECTED_BACKGROUND_STORAGE_KEY,
  CLASSIC_SELECTED_BLADE_STORAGE_KEY,
  CLASSIC_SELECTED_THEME_STORAGE_KEY,
  CLASSIC_TOTAL_COINS_STORAGE_KEY,
  ClassicSettingsState,
  classicModeUnlockStorageKey,
} = await import('../../../game/assets/scripts/domain/classic-settings-state.ts');

class RecordingPort implements ClassicInt32PreferencePort {
  readonly reads: Array<readonly [string, number | boolean]> = [];
  readonly writes: Array<readonly [string, number | boolean]> = [];
  private readonly values: Readonly<Record<string, number | boolean>>;

  constructor(values: Readonly<Record<string, number | boolean>> = {}) {
    this.values = values;
  }

  readInt32(key: string, defaultValue: number): number {
    this.reads.push([key, defaultValue]);
    const value = this.values[key];
    return typeof value === 'number' ? value : defaultValue;
  }

  writeInt32(key: string, value: number): void {
    this.writes.push([key, value]);
  }

  readBoolean(key: string, defaultValue: boolean): boolean {
    this.reads.push([key, defaultValue]);
    const value = this.values[key];
    return typeof value === 'boolean' ? value : defaultValue;
  }

  writeBoolean(key: string, value: boolean): void {
    this.writes.push([key, value]);
  }
}

const RECOVERED_READS = [
  [CLASSIC_TOTAL_COINS_STORAGE_KEY, 2014],
  [CLASSIC_SELECTED_THEME_STORAGE_KEY, 2],
  [CLASSIC_SELECTED_BACKGROUND_STORAGE_KEY, 0],
  [CLASSIC_SELECTED_BLADE_STORAGE_KEY, 0],
  [CLASSIC_BEST_1_STORAGE_KEY, 0],
  [CLASSIC_BEST_2_STORAGE_KEY, 0],
  [CLASSIC_BEST_3_STORAGE_KEY, 0],
  [CLASSIC_MUSIC_ENABLED_STORAGE_KEY, true],
  [CLASSIC_EFFECTS_ENABLED_STORAGE_KEY, true],
  [CLASSIC_NETWORK_AVAILABLE_STORAGE_KEY, false],
  [CLASSIC_RATED_STORAGE_KEY, false],
] as const;

test('Classic settings load exact keys and defaults in recovered relative order', () => {
  const port = new RecordingPort();
  const state = ClassicSettingsState.load(port);

  assert.equal(CLASSIC_SELECTED_THEME_STORAGE_KEY, 'selected_theme');
  assert.equal(CLASSIC_SELECTED_BACKGROUND_STORAGE_KEY, 'selected_background');
  assert.equal(CLASSIC_SELECTED_BLADE_STORAGE_KEY, 'selected_blade');
  assert.equal(CLASSIC_MUSIC_ENABLED_STORAGE_KEY, 'enable_music');
  assert.equal(CLASSIC_EFFECTS_ENABLED_STORAGE_KEY, 'enable_effect');
  assert.equal(CLASSIC_NETWORK_AVAILABLE_STORAGE_KEY, 'network_available');
  assert.equal(CLASSIC_RATED_STORAGE_KEY, 'rated');
  assert.deepEqual(port.reads, RECOVERED_READS);
  assert.deepEqual(state.snapshot, {
    effectsEnabled: true,
    leaderboard: { first: 0, second: 0, third: 0 },
    musicEnabled: true,
    networkAvailable: false,
    rated: false,
    selectedBackground: 0,
    selectedBlade: 0,
    selectedTheme: 2,
    totalCoins: 2014,
  });
  assert.equal(Object.isFrozen(state.snapshot), true);
  assert.equal(Object.isFrozen(state.snapshot.leaderboard), true);
});

test('loaded first place seeds the shared Classic leaderboard baseline', () => {
  const state = ClassicSettingsState.load(new RecordingPort({
    [CLASSIC_TOTAL_COINS_STORAGE_KEY]: 900,
    [CLASSIC_BEST_1_STORAGE_KEY]: 30,
    [CLASSIC_BEST_2_STORAGE_KEY]: 20,
    [CLASSIC_BEST_3_STORAGE_KEY]: 10,
    [CLASSIC_EFFECTS_ENABLED_STORAGE_KEY]: false,
    [CLASSIC_MUSIC_ENABLED_STORAGE_KEY]: false,
    [CLASSIC_NETWORK_AVAILABLE_STORAGE_KEY]: true,
    [CLASSIC_RATED_STORAGE_KEY]: true,
    [CLASSIC_SELECTED_BACKGROUND_STORAGE_KEY]: 8,
    [CLASSIC_SELECTED_BLADE_STORAGE_KEY]: 17,
    [CLASSIC_SELECTED_THEME_STORAGE_KEY]: 9,
  }));

  assert.deepEqual(state.snapshot, {
    effectsEnabled: false,
    leaderboard: { first: 30, second: 20, third: 10 },
    musicEnabled: false,
    networkAvailable: true,
    rated: true,
    selectedBackground: 8,
    selectedBlade: 17,
    selectedTheme: 9,
    totalCoins: 900,
  });
  assert.deepEqual(state.recordClassicResultScore(25), {
    achievedRank: 2,
    leaderboard: { first: 30, second: 25, third: 20 },
  });
});

test('result mutations remain memory-only until explicit save checkpoint', () => {
  const port = new RecordingPort();
  const state = ClassicSettingsState.load(port);

  state.recordClassicResultScore(40);
  assert.deepEqual(state.awardClassicResultCoins(40), {
    bonusCoins: 24,
    totalCoins: 2038,
  });
  assert.deepEqual(port.writes, []);

  state.save(port);
  assert.deepEqual(port.writes, [
    [CLASSIC_TOTAL_COINS_STORAGE_KEY, 2038],
    [CLASSIC_SELECTED_THEME_STORAGE_KEY, 2],
    [CLASSIC_SELECTED_BACKGROUND_STORAGE_KEY, 0],
    [CLASSIC_SELECTED_BLADE_STORAGE_KEY, 0],
    [CLASSIC_BEST_1_STORAGE_KEY, 40],
    [CLASSIC_BEST_2_STORAGE_KEY, 0],
    [CLASSIC_BEST_3_STORAGE_KEY, 0],
    [CLASSIC_MUSIC_ENABLED_STORAGE_KEY, true],
    [CLASSIC_EFFECTS_ENABLED_STORAGE_KEY, true],
    [CLASSIC_NETWORK_AVAILABLE_STORAGE_KEY, false],
    [CLASSIC_RATED_STORAGE_KEY, false],
  ]);
});

test('menu mutations and mode spend stay validated and memory-only until bulk save', () => {
  const port = new RecordingPort({
    [CLASSIC_NETWORK_AVAILABLE_STORAGE_KEY]: true,
    [CLASSIC_TOTAL_COINS_STORAGE_KEY]: 3000,
  });
  const state = ClassicSettingsState.load(port);

  state.setMusicEnabled(false);
  state.setEffectsEnabled(false);
  state.setRated(true);
  state.setSelectedTheme(9);
  state.setSelectedBackground(8);
  state.setSelectedBlade(17);
  const reviewReward = state.addTotalCoins(500);
  assert.deepEqual(reviewReward, {
    delta: 500,
    nextTotalCoins: 3500,
    previousTotalCoins: 3000,
  });
  assert.equal(Object.isFrozen(reviewReward), true);
  assert.deepEqual(state.addTotalCoins(-2500), {
    delta: -2500,
    nextTotalCoins: 1000,
    previousTotalCoins: 3500,
  });
  assert.deepEqual(port.writes, []);
  assert.deepEqual(state.snapshot, {
    effectsEnabled: false,
    leaderboard: { first: 0, second: 0, third: 0 },
    musicEnabled: false,
    networkAvailable: true,
    rated: true,
    selectedBackground: 8,
    selectedBlade: 17,
    selectedTheme: 9,
    totalCoins: 1000,
  });
});

test('coin award preserves native signed-int32 wrapping', () => {
  const state = ClassicSettingsState.load(new RecordingPort({
    [CLASSIC_TOTAL_COINS_STORAGE_KEY]: 0x7fff_ffff,
  }));

  assert.deepEqual(state.awardClassicResultCoins(2), {
    bonusCoins: 1,
    totalCoins: -0x8000_0000,
  });
});

test('settings reject invalid ports, values, and unordered persisted rankings', () => {
  assert.throws(
    () => ClassicSettingsState.load(null as never),
    /must provide int32 read and write operations/,
  );
  assert.throws(
    () => ClassicSettingsState.load(new RecordingPort({
      [CLASSIC_TOTAL_COINS_STORAGE_KEY]: 0x8000_0000,
    })),
    /totalCoins must be a signed 32-bit integer/,
  );
  assert.throws(
    () => ClassicSettingsState.load(new RecordingPort({
      [CLASSIC_BEST_1_STORAGE_KEY]: 1,
      [CLASSIC_BEST_2_STORAGE_KEY]: 3,
      [CLASSIC_BEST_3_STORAGE_KEY]: 2,
    })),
    /leaderboard must remain ordered/,
  );
  for (const [key, invalid, message] of [
    [CLASSIC_SELECTED_THEME_STORAGE_KEY, 10, /selectedTheme/],
    [CLASSIC_SELECTED_BACKGROUND_STORAGE_KEY, -1, /selectedBackground/],
    [CLASSIC_SELECTED_BLADE_STORAGE_KEY, 18, /selectedBlade/],
  ] as const) {
    assert.throws(
      () => ClassicSettingsState.load(new RecordingPort({ [key]: invalid })),
      message,
    );
  }

  const state = ClassicSettingsState.defaults();
  const before = state.snapshot;
  assert.throws(() => state.setMusicEnabled(1 as never), /musicEnabled must be a boolean/);
  assert.throws(() => state.setEffectsEnabled('false' as never), /effectsEnabled must be a boolean/);
  assert.throws(() => state.setRated(null as never), /rated must be a boolean/);
  assert.throws(() => state.setSelectedTheme(10), /selectedTheme/);
  assert.throws(() => state.setSelectedBackground(1.5), /selectedBackground/);
  assert.throws(() => state.setSelectedBlade(-1), /selectedBlade/);
  assert.throws(() => state.addTotalCoins(0x7fff_ffff), /nextTotalCoins/);
  assert.deepEqual(state.snapshot, before);
});

test('mode unlock keys are restricted to the four recovered persisted indices', () => {
  assert.deepEqual(CLASSIC_MODE_UNLOCK_INDICES, [1, 2, 4, 5]);
  assert.equal(Object.isFrozen(CLASSIC_MODE_UNLOCK_INDICES), true);
  for (const modeIndex of CLASSIC_MODE_UNLOCK_INDICES) {
    assert.equal(classicModeUnlockStorageKey(modeIndex), `mode_unlock_${modeIndex}`);
  }
  for (const invalid of [-1, 0, 3, 6, 1.5, Number.NaN]) {
    assert.throws(() => classicModeUnlockStorageKey(invalid), /1, 2, 4, or 5/);
  }
});
