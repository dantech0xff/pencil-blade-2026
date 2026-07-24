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
  CLASSIC_BIRD_BEST_1_STORAGE_KEY,
  CLASSIC_BIRD_BEST_2_STORAGE_KEY,
  CLASSIC_BIRD_BEST_3_STORAGE_KEY,
  COMBO_BIRD_BEST_1_STORAGE_KEY,
  COMBO_BIRD_BEST_2_STORAGE_KEY,
  COMBO_BIRD_BEST_3_STORAGE_KEY,
  CRAZY_BIRD_BEST_1_STORAGE_KEY,
  CRAZY_BIRD_BEST_2_STORAGE_KEY,
  CRAZY_BIRD_BEST_3_STORAGE_KEY,
  GN_STYLE_BEST_1_STORAGE_KEY,
  GN_STYLE_BEST_2_STORAGE_KEY,
  GN_STYLE_BEST_3_STORAGE_KEY,
  CLASSIC_EFFECTS_ENABLED_STORAGE_KEY,
  CLASSIC_BACKGROUND_PRICE_COUNT,
  CLASSIC_BLADE_PRICE_COUNT,
  CLASSIC_INITIAL_BACKGROUND_PRICES,
  CLASSIC_INITIAL_BLADE_PRICES,
  CLASSIC_MODE_UNLOCK_INDICES,
  CLASSIC_MUSIC_ENABLED_STORAGE_KEY,
  CLASSIC_NETWORK_AVAILABLE_STORAGE_KEY,
  CLASSIC_RATED_STORAGE_KEY,
  CLASSIC_SELECTED_BACKGROUND_STORAGE_KEY,
  CLASSIC_SELECTED_BLADE_STORAGE_KEY,
  CLASSIC_SELECTED_THEME_STORAGE_KEY,
  CLASSIC_TOTAL_COINS_STORAGE_KEY,
  CRAZY_BEST_1_STORAGE_KEY,
  CRAZY_BEST_2_STORAGE_KEY,
  CRAZY_BEST_3_STORAGE_KEY,
  OBJECTIVES_CURRENT_STORAGE_KEY,
  OBJECTIVES_FRUITS_CUT_STORAGE_KEY,
  ClassicSettingsState,
  classicBackgroundPriceStorageKey,
  classicBladePriceStorageKey,
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

const RESTORATION_READS = [
  [CLASSIC_TOTAL_COINS_STORAGE_KEY, 999_999],
  [CLASSIC_SELECTED_THEME_STORAGE_KEY, 2],
  [CLASSIC_SELECTED_BACKGROUND_STORAGE_KEY, 0],
  [CLASSIC_SELECTED_BLADE_STORAGE_KEY, 0],
  [CLASSIC_BEST_1_STORAGE_KEY, 0],
  [CLASSIC_BEST_2_STORAGE_KEY, 0],
  [CLASSIC_BEST_3_STORAGE_KEY, 0],
  [CRAZY_BEST_1_STORAGE_KEY, 0],
  [CRAZY_BEST_2_STORAGE_KEY, 0],
  [CRAZY_BEST_3_STORAGE_KEY, 0],
  [GN_STYLE_BEST_1_STORAGE_KEY, 0],
  [GN_STYLE_BEST_2_STORAGE_KEY, 0],
  [GN_STYLE_BEST_3_STORAGE_KEY, 0],
  [CLASSIC_BIRD_BEST_1_STORAGE_KEY, 0],
  [CLASSIC_BIRD_BEST_2_STORAGE_KEY, 0],
  [CLASSIC_BIRD_BEST_3_STORAGE_KEY, 0],
  [CRAZY_BIRD_BEST_1_STORAGE_KEY, 0],
  [CRAZY_BIRD_BEST_2_STORAGE_KEY, 0],
  [CRAZY_BIRD_BEST_3_STORAGE_KEY, 0],
  [COMBO_BIRD_BEST_1_STORAGE_KEY, 0],
  [COMBO_BIRD_BEST_2_STORAGE_KEY, 0],
  [COMBO_BIRD_BEST_3_STORAGE_KEY, 0],
  ...CLASSIC_INITIAL_BLADE_PRICES.map((defaultPrice, index) => (
    [classicBladePriceStorageKey(index), defaultPrice] as const
  )),
  ...CLASSIC_INITIAL_BACKGROUND_PRICES.map((defaultPrice, index) => (
    [classicBackgroundPriceStorageKey(index), defaultPrice] as const
  )),
  [OBJECTIVES_CURRENT_STORAGE_KEY, 0],
  [OBJECTIVES_FRUITS_CUT_STORAGE_KEY, 0],
  [CLASSIC_MUSIC_ENABLED_STORAGE_KEY, true],
  [CLASSIC_EFFECTS_ENABLED_STORAGE_KEY, true],
  [CLASSIC_NETWORK_AVAILABLE_STORAGE_KEY, false],
  [CLASSIC_RATED_STORAGE_KEY, false],
] as const;

test('Classic settings load exact keys and restoration defaults in recovered relative order', () => {
  const port = new RecordingPort();
  const state = ClassicSettingsState.load(port);

  assert.equal(ClassicSettingsState.defaults().snapshot.totalCoins, 999_999);
  assert.equal(CLASSIC_SELECTED_THEME_STORAGE_KEY, 'selected_theme');
  assert.equal(CLASSIC_SELECTED_BACKGROUND_STORAGE_KEY, 'selected_background');
  assert.equal(CLASSIC_SELECTED_BLADE_STORAGE_KEY, 'selected_blade');
  assert.equal(CLASSIC_MUSIC_ENABLED_STORAGE_KEY, 'enable_music');
  assert.equal(CLASSIC_EFFECTS_ENABLED_STORAGE_KEY, 'enable_effect');
  assert.equal(CLASSIC_NETWORK_AVAILABLE_STORAGE_KEY, 'network_available');
  assert.equal(CLASSIC_RATED_STORAGE_KEY, 'rated');
  assert.equal(OBJECTIVES_CURRENT_STORAGE_KEY, 'current_objective');
  assert.equal(OBJECTIVES_FRUITS_CUT_STORAGE_KEY, 'fruits_cut');
  assert.equal(CLASSIC_BIRD_BEST_1_STORAGE_KEY, 'bird_classic_best_1');
  assert.equal(CLASSIC_BIRD_BEST_2_STORAGE_KEY, 'bird_classic_best_2');
  assert.equal(CLASSIC_BIRD_BEST_3_STORAGE_KEY, 'bird_classic_best_3');
  assert.equal(CRAZY_BIRD_BEST_1_STORAGE_KEY, 'bird_crazy_best_1');
  assert.equal(CRAZY_BIRD_BEST_2_STORAGE_KEY, 'bird_crazy_best_2');
  assert.equal(CRAZY_BIRD_BEST_3_STORAGE_KEY, 'bird_crazy_best_3');
  assert.equal(COMBO_BIRD_BEST_1_STORAGE_KEY, 'bird_combo_best_1');
  assert.equal(COMBO_BIRD_BEST_2_STORAGE_KEY, 'bird_combo_best_2');
  assert.equal(COMBO_BIRD_BEST_3_STORAGE_KEY, 'bird_combo_best_3');
  assert.equal(GN_STYLE_BEST_1_STORAGE_KEY, 'gnstyle_best_1');
  assert.equal(GN_STYLE_BEST_2_STORAGE_KEY, 'gnstyle_best_2');
  assert.equal(GN_STYLE_BEST_3_STORAGE_KEY, 'gnstyle_best_3');
  assert.equal(CLASSIC_BLADE_PRICE_COUNT, 18);
  assert.equal(CLASSIC_BACKGROUND_PRICE_COUNT, 8);
  assert.deepEqual(CLASSIC_INITIAL_BLADE_PRICES, [
    0, 100, 200, 300, 400, 500, 600, 700, 800,
    900, 1000, 1500, 2000, 2500, 2500, 2500, 2500, 5000,
  ]);
  assert.deepEqual(CLASSIC_INITIAL_BACKGROUND_PRICES, [
    0, 500, 1000, 1000, 2000, 2000, 2500, 4500,
  ]);
  assert.equal(Object.isFrozen(CLASSIC_INITIAL_BLADE_PRICES), true);
  assert.equal(Object.isFrozen(CLASSIC_INITIAL_BACKGROUND_PRICES), true);
  assert.deepEqual(port.reads, RESTORATION_READS);
  assert.equal(port.reads.filter(([, defaultValue]) => typeof defaultValue === 'number').length, 50);
  assert.equal(port.reads.filter(([, defaultValue]) => typeof defaultValue === 'boolean').length, 4);
  assert.deepEqual(state.snapshot, {
    crazyLeaderboard: { first: 0, second: 0, third: 0 },
    currentObjective: 0,
    effectsEnabled: true,
    fruitsCut: 0,
    leaderboard: { first: 0, second: 0, third: 0 },
    musicEnabled: true,
    networkAvailable: false,
    rated: false,
    selectedBackground: 0,
    selectedBlade: 0,
    selectedTheme: 2,
    totalCoins: 999_999,
  });
  assert.equal(Object.isFrozen(state.snapshot), true);
  assert.equal(Object.isFrozen(state.snapshot.crazyLeaderboard), true);
  assert.equal(Object.isFrozen(state.snapshot.leaderboard), true);
  assert.deepEqual(state.bladePrices, CLASSIC_INITIAL_BLADE_PRICES);
  assert.deepEqual(state.backgroundPrices, CLASSIC_INITIAL_BACKGROUND_PRICES);
  assert.equal(Object.isFrozen(state.bladePrices), true);
  assert.equal(Object.isFrozen(state.backgroundPrices), true);
  assert.deepEqual(state.birdClassicLeaderboard, {
    first: 0,
    second: 0,
    third: 0,
  });
  assert.equal(Object.isFrozen(state.birdClassicLeaderboard), true);
  assert.deepEqual(state.birdCrazyLeaderboard, {
    first: 0,
    second: 0,
    third: 0,
  });
  assert.equal(Object.isFrozen(state.birdCrazyLeaderboard), true);
  assert.deepEqual(state.birdComboLeaderboard, {
    first: 0,
    second: 0,
    third: 0,
  });
  assert.equal(Object.isFrozen(state.birdComboLeaderboard), true);
  assert.deepEqual(state.gnStyleLeaderboard, {
    first: 0,
    second: 0,
    third: 0,
  });
  assert.equal(Object.isFrozen(state.gnStyleLeaderboard), true);
});

test('recovering load retains valid fields and defaults only invalid ordered values', () => {
  const recovery = ClassicSettingsState.loadRecovering(new RecordingPort({
    [CLASSIC_TOTAL_COINS_STORAGE_KEY]: 0,
    [CLASSIC_BEST_1_STORAGE_KEY]: 10,
    [CLASSIC_BEST_2_STORAGE_KEY]: 30,
    [CLASSIC_BEST_3_STORAGE_KEY]: 20,
    [classicBladePriceStorageKey(10)]: -1,
    [classicBackgroundPriceStorageKey(7)]: 0,
  }));

  assert.equal(Object.isFrozen(recovery), true);
  assert.match(recovery.failure?.message ?? '', /leaderboard must remain ordered/);
  assert.equal(recovery.state.snapshot.totalCoins, 0);
  assert.deepEqual(recovery.state.snapshot.leaderboard, {
    first: 10,
    second: 0,
    third: 0,
  });
  assert.equal(recovery.state.bladePriceAt(10), 1000);
  assert.equal(recovery.state.backgroundPriceAt(7), 0);
});

test('recovering load preserves ordered signed-int32 leaderboards', () => {
  const recovery = ClassicSettingsState.loadRecovering(new RecordingPort({
    [CLASSIC_TOTAL_COINS_STORAGE_KEY]: 0,
    [CRAZY_BEST_1_STORAGE_KEY]: -1,
    [CRAZY_BEST_2_STORAGE_KEY]: -2,
    [CRAZY_BEST_3_STORAGE_KEY]: -3,
  }));

  assert.equal(recovery.failure, null);
  assert.equal(recovery.state.snapshot.totalCoins, 0);
  assert.deepEqual(recovery.state.snapshot.crazyLeaderboard, {
    first: -1,
    second: -2,
    third: -3,
  });
});

test('persisted total coins and rankings override the restoration defaults', () => {
  const state = ClassicSettingsState.load(new RecordingPort({
    [CLASSIC_TOTAL_COINS_STORAGE_KEY]: 900,
    [CLASSIC_BEST_1_STORAGE_KEY]: 30,
    [CLASSIC_BEST_2_STORAGE_KEY]: 20,
    [CLASSIC_BEST_3_STORAGE_KEY]: 10,
    [CRAZY_BEST_1_STORAGE_KEY]: 300,
    [CRAZY_BEST_2_STORAGE_KEY]: 200,
    [CRAZY_BEST_3_STORAGE_KEY]: 100,
    [GN_STYLE_BEST_1_STORAGE_KEY]: 3000,
    [GN_STYLE_BEST_2_STORAGE_KEY]: 2000,
    [GN_STYLE_BEST_3_STORAGE_KEY]: 1000,
    [CLASSIC_BIRD_BEST_1_STORAGE_KEY]: 30_000,
    [CLASSIC_BIRD_BEST_2_STORAGE_KEY]: 20_000,
    [CLASSIC_BIRD_BEST_3_STORAGE_KEY]: 10_000,
    [CRAZY_BIRD_BEST_1_STORAGE_KEY]: 300_000,
    [CRAZY_BIRD_BEST_2_STORAGE_KEY]: 200_000,
    [CRAZY_BIRD_BEST_3_STORAGE_KEY]: 100_000,
    [COMBO_BIRD_BEST_1_STORAGE_KEY]: 3_000_000,
    [COMBO_BIRD_BEST_2_STORAGE_KEY]: 2_000_000,
    [COMBO_BIRD_BEST_3_STORAGE_KEY]: 1_000_000,
    [classicBladePriceStorageKey(1)]: 0,
    [classicBladePriceStorageKey(17)]: 4321,
    [classicBackgroundPriceStorageKey(1)]: 0,
    [classicBackgroundPriceStorageKey(7)]: 3210,
    [OBJECTIVES_CURRENT_STORAGE_KEY]: 13,
    [OBJECTIVES_FRUITS_CUT_STORAGE_KEY]: 2468,
    [CLASSIC_EFFECTS_ENABLED_STORAGE_KEY]: false,
    [CLASSIC_MUSIC_ENABLED_STORAGE_KEY]: false,
    [CLASSIC_NETWORK_AVAILABLE_STORAGE_KEY]: true,
    [CLASSIC_RATED_STORAGE_KEY]: true,
    [CLASSIC_SELECTED_BACKGROUND_STORAGE_KEY]: 8,
    [CLASSIC_SELECTED_BLADE_STORAGE_KEY]: 17,
    [CLASSIC_SELECTED_THEME_STORAGE_KEY]: 9,
  }));

  assert.deepEqual(state.snapshot, {
    crazyLeaderboard: { first: 300, second: 200, third: 100 },
    currentObjective: 13,
    effectsEnabled: false,
    fruitsCut: 2468,
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
  assert.deepEqual(state.recordCrazyResultScore(250), {
    achievedRank: 2,
    leaderboard: { first: 300, second: 250, third: 200 },
  });
  assert.deepEqual(state.recordGnStyleResultScore(2500), {
    achievedRank: 2,
    leaderboard: { first: 3000, second: 2500, third: 2000 },
  });
  assert.deepEqual(state.recordClassicBirdResultScore(25_000), {
    achievedRank: 2,
    leaderboard: { first: 30_000, second: 25_000, third: 20_000 },
  });
  assert.deepEqual(state.recordCrazyBirdResultScore(250_000), {
    achievedRank: 2,
    leaderboard: { first: 300_000, second: 250_000, third: 200_000 },
  });
  assert.deepEqual(state.recordComboBirdResultScore(2_500_000), {
    achievedRank: 2,
    leaderboard: { first: 3_000_000, second: 2_500_000, third: 2_000_000 },
  });
  assert.equal(state.bladePriceAt(1), 0);
  assert.equal(state.bladePriceAt(17), 4321);
  assert.equal(state.backgroundPriceAt(1), 0);
  assert.equal(state.backgroundPriceAt(7), 3210);
});

test('result mutations remain memory-only until explicit save checkpoint', () => {
  const port = new RecordingPort();
  const state = ClassicSettingsState.load(port);

  state.recordClassicResultScore(40);
  assert.deepEqual(state.awardClassicResultCoins(40), {
    bonusCoins: 24,
    totalCoins: 1_000_023,
  });
  assert.deepEqual(port.writes, []);

  state.save(port);
  assert.deepEqual(port.writes, [
    [CLASSIC_TOTAL_COINS_STORAGE_KEY, 1_000_023],
    [CLASSIC_SELECTED_THEME_STORAGE_KEY, 2],
    [CLASSIC_SELECTED_BACKGROUND_STORAGE_KEY, 0],
    [CLASSIC_SELECTED_BLADE_STORAGE_KEY, 0],
    [CLASSIC_BEST_1_STORAGE_KEY, 40],
    [CLASSIC_BEST_2_STORAGE_KEY, 0],
    [CLASSIC_BEST_3_STORAGE_KEY, 0],
    [CRAZY_BEST_1_STORAGE_KEY, 0],
    [CRAZY_BEST_2_STORAGE_KEY, 0],
    [CRAZY_BEST_3_STORAGE_KEY, 0],
    [GN_STYLE_BEST_1_STORAGE_KEY, 0],
    [GN_STYLE_BEST_2_STORAGE_KEY, 0],
    [GN_STYLE_BEST_3_STORAGE_KEY, 0],
    [CLASSIC_BIRD_BEST_1_STORAGE_KEY, 0],
    [CLASSIC_BIRD_BEST_2_STORAGE_KEY, 0],
    [CLASSIC_BIRD_BEST_3_STORAGE_KEY, 0],
    [CRAZY_BIRD_BEST_1_STORAGE_KEY, 0],
    [CRAZY_BIRD_BEST_2_STORAGE_KEY, 0],
    [CRAZY_BIRD_BEST_3_STORAGE_KEY, 0],
    [COMBO_BIRD_BEST_1_STORAGE_KEY, 0],
    [COMBO_BIRD_BEST_2_STORAGE_KEY, 0],
    [COMBO_BIRD_BEST_3_STORAGE_KEY, 0],
    ...CLASSIC_INITIAL_BLADE_PRICES.map((price, index) => (
      [classicBladePriceStorageKey(index), price] as const
    )),
    ...CLASSIC_INITIAL_BACKGROUND_PRICES.map((price, index) => (
      [classicBackgroundPriceStorageKey(index), price] as const
    )),
    [OBJECTIVES_CURRENT_STORAGE_KEY, 0],
    [OBJECTIVES_FRUITS_CUT_STORAGE_KEY, 0],
    [CLASSIC_MUSIC_ENABLED_STORAGE_KEY, true],
    [CLASSIC_EFFECTS_ENABLED_STORAGE_KEY, true],
    [CLASSIC_NETWORK_AVAILABLE_STORAGE_KEY, false],
    [CLASSIC_RATED_STORAGE_KEY, false],
  ]);
});

test('cosmetic price keys, purchases, and outward tables are exact and bounded', () => {
  assert.equal(classicBladePriceStorageKey(0), 'blade_price_0');
  assert.equal(classicBladePriceStorageKey(17), 'blade_price_17');
  assert.equal(classicBackgroundPriceStorageKey(0), 'background_price_0');
  assert.equal(classicBackgroundPriceStorageKey(7), 'background_price_7');

  for (const invalid of [-1, 18, 1.5, Number.NaN]) {
    assert.throws(() => classicBladePriceStorageKey(invalid), /blade price index/);
  }
  for (const invalid of [-1, 8, 1.5, Number.NaN]) {
    assert.throws(() => classicBackgroundPriceStorageKey(invalid), /background price index/);
  }

  const state = ClassicSettingsState.defaults();
  const untouchedBackgrounds = state.backgroundPrices;
  const untouchedBlades = state.bladePrices;
  assert.deepEqual(state.markBladePurchased(10), {
    changed: true,
    index: 10,
    nextPrice: 0,
    previousPrice: 1000,
  });
  assert.equal(state.bladePriceAt(10), 0);
  assert.equal(untouchedBlades[10], 1000);
  assert.deepEqual(state.markBladePurchased(10), {
    changed: false,
    index: 10,
    nextPrice: 0,
    previousPrice: 0,
  });
  assert.deepEqual(state.markBackgroundPurchased(7), {
    changed: true,
    index: 7,
    nextPrice: 0,
    previousPrice: 4500,
  });
  assert.equal(state.backgroundPriceAt(7), 0);
  assert.equal(untouchedBackgrounds[7], 4500);

  const beforeInvalid = {
    backgrounds: state.backgroundPrices,
    blades: state.bladePrices,
  };
  assert.throws(() => state.markBladePurchased(18), /blade price index/);
  assert.throws(() => state.markBackgroundPurchased(8), /background price index/);
  assert.deepEqual(state.backgroundPrices, beforeInvalid.backgrounds);
  assert.deepEqual(state.bladePrices, beforeInvalid.blades);
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
    crazyLeaderboard: { first: 0, second: 0, third: 0 },
    currentObjective: 0,
    effectsEnabled: false,
    fruitsCut: 0,
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

test('objective progression state is memory-only and reward addition wraps signed int32', () => {
  const port = new RecordingPort({
    [CLASSIC_TOTAL_COINS_STORAGE_KEY]: 0x7fff_ffff,
  });
  const state = ClassicSettingsState.load(port);

  state.setCurrentObjective(52);
  state.setFruitsCut(70_000);
  assert.deepEqual(state.addObjectiveRewardCoins(1), {
    delta: 1,
    nextTotalCoins: -0x8000_0000,
    previousTotalCoins: 0x7fff_ffff,
  });
  assert.deepEqual(port.writes, []);
  assert.equal(state.snapshot.currentObjective, 52);
  assert.equal(state.snapshot.fruitsCut, 70_000);

  state.setCurrentObjective(0);
  state.save(port);
  assert.deepEqual(port.writes.slice(-6), [
    [OBJECTIVES_CURRENT_STORAGE_KEY, 0],
    [OBJECTIVES_FRUITS_CUT_STORAGE_KEY, 70_000],
    [CLASSIC_MUSIC_ENABLED_STORAGE_KEY, true],
    [CLASSIC_EFFECTS_ENABLED_STORAGE_KEY, true],
    [CLASSIC_NETWORK_AVAILABLE_STORAGE_KEY, false],
    [CLASSIC_RATED_STORAGE_KEY, false],
  ]);
});

test('Crazy result uses a distinct leaderboard and the shared recovered coin balance', () => {
  const port = new RecordingPort({
    [CLASSIC_BEST_1_STORAGE_KEY]: 30,
    [CLASSIC_BEST_2_STORAGE_KEY]: 20,
    [CLASSIC_BEST_3_STORAGE_KEY]: 10,
    [CRAZY_BEST_1_STORAGE_KEY]: 300,
    [CRAZY_BEST_2_STORAGE_KEY]: 200,
    [CRAZY_BEST_3_STORAGE_KEY]: 100,
  });
  const state = ClassicSettingsState.load(port);

  assert.deepEqual(state.recordCrazyResultScore(250), {
    achievedRank: 2,
    leaderboard: { first: 300, second: 250, third: 200 },
  });
  assert.deepEqual(state.snapshot.leaderboard, { first: 30, second: 20, third: 10 });
  assert.deepEqual(state.awardCrazyResultCoins(25), {
    bonusCoins: 15,
    totalCoins: 1_000_014,
  });
  state.save(port);
  assert.deepEqual(port.writes.slice(7, 10), [
    [CRAZY_BEST_1_STORAGE_KEY, 300],
    [CRAZY_BEST_2_STORAGE_KEY, 250],
    [CRAZY_BEST_3_STORAGE_KEY, 200],
  ]);
});

test('GN Style result uses its own ranking and float32 0.6 coin balance', () => {
  const port = new RecordingPort({
    [GN_STYLE_BEST_1_STORAGE_KEY]: 300,
    [GN_STYLE_BEST_2_STORAGE_KEY]: 200,
    [GN_STYLE_BEST_3_STORAGE_KEY]: 100,
  });
  const state = ClassicSettingsState.load(port);

  assert.deepEqual(state.recordGnStyleResultScore(250), {
    achievedRank: 2,
    leaderboard: { first: 300, second: 250, third: 200 },
  });
  assert.deepEqual(state.gnStyleLeaderboard, {
    first: 300,
    second: 250,
    third: 200,
  });
  assert.deepEqual(state.awardGnStyleResultCoins(25), {
    bonusCoins: 15,
    totalCoins: 1_000_014,
  });
  state.save(port);
  assert.deepEqual(port.writes.slice(10, 13), [
    [GN_STYLE_BEST_1_STORAGE_KEY, 300],
    [GN_STYLE_BEST_2_STORAGE_KEY, 250],
    [GN_STYLE_BEST_3_STORAGE_KEY, 200],
  ]);
});

test('Classic Bird result uses its own ranking and float32 0.8 coin balance', () => {
  const port = new RecordingPort({
    [CLASSIC_BIRD_BEST_1_STORAGE_KEY]: 300,
    [CLASSIC_BIRD_BEST_2_STORAGE_KEY]: 200,
    [CLASSIC_BIRD_BEST_3_STORAGE_KEY]: 100,
  });
  const state = ClassicSettingsState.load(port);

  assert.deepEqual(state.recordClassicBirdResultScore(250), {
    achievedRank: 2,
    leaderboard: { first: 300, second: 250, third: 200 },
  });
  assert.deepEqual(state.birdClassicLeaderboard, {
    first: 300,
    second: 250,
    third: 200,
  });
  assert.deepEqual(state.awardClassicBirdResultCoins(25), {
    bonusCoins: 20,
    totalCoins: 1_000_019,
  });
  state.save(port);
  assert.deepEqual(port.writes.slice(13, 16), [
    [CLASSIC_BIRD_BEST_1_STORAGE_KEY, 300],
    [CLASSIC_BIRD_BEST_2_STORAGE_KEY, 250],
    [CLASSIC_BIRD_BEST_3_STORAGE_KEY, 200],
  ]);
});

test('Crazy Bird result uses its own ranking and float32 0.8 coin balance', () => {
  const port = new RecordingPort({
    [CRAZY_BIRD_BEST_1_STORAGE_KEY]: 300,
    [CRAZY_BIRD_BEST_2_STORAGE_KEY]: 200,
    [CRAZY_BIRD_BEST_3_STORAGE_KEY]: 100,
  });
  const state = ClassicSettingsState.load(port);

  assert.deepEqual(state.recordCrazyBirdResultScore(250), {
    achievedRank: 2,
    leaderboard: { first: 300, second: 250, third: 200 },
  });
  assert.deepEqual(state.birdCrazyLeaderboard, {
    first: 300,
    second: 250,
    third: 200,
  });
  assert.deepEqual(state.awardCrazyBirdResultCoins(25), {
    bonusCoins: 20,
    totalCoins: 1_000_019,
  });
  state.save(port);
  assert.deepEqual(port.writes.slice(16, 19), [
    [CRAZY_BIRD_BEST_1_STORAGE_KEY, 300],
    [CRAZY_BIRD_BEST_2_STORAGE_KEY, 250],
    [CRAZY_BIRD_BEST_3_STORAGE_KEY, 200],
  ]);
});

test('Combo Bird result uses its own ranking and float32 0.8 coin balance', () => {
  const port = new RecordingPort({
    [COMBO_BIRD_BEST_1_STORAGE_KEY]: 300,
    [COMBO_BIRD_BEST_2_STORAGE_KEY]: 200,
    [COMBO_BIRD_BEST_3_STORAGE_KEY]: 100,
  });
  const state = ClassicSettingsState.load(port);

  assert.deepEqual(state.recordComboBirdResultScore(250), {
    achievedRank: 2,
    leaderboard: { first: 300, second: 250, third: 200 },
  });
  assert.deepEqual(state.birdComboLeaderboard, {
    first: 300,
    second: 250,
    third: 200,
  });
  assert.deepEqual(state.awardComboBirdResultCoins(25), {
    bonusCoins: 20,
    totalCoins: 1_000_019,
  });
  state.save(port);
  assert.deepEqual(port.writes.slice(19, 22), [
    [COMBO_BIRD_BEST_1_STORAGE_KEY, 300],
    [COMBO_BIRD_BEST_2_STORAGE_KEY, 250],
    [COMBO_BIRD_BEST_3_STORAGE_KEY, 200],
  ]);
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
  assert.throws(
    () => ClassicSettingsState.load(new RecordingPort({
      [CRAZY_BEST_1_STORAGE_KEY]: 1,
      [CRAZY_BEST_2_STORAGE_KEY]: 3,
      [CRAZY_BEST_3_STORAGE_KEY]: 2,
    })),
    /crazyLeaderboard must remain ordered/,
  );
  assert.throws(
    () => ClassicSettingsState.load(new RecordingPort({
      [GN_STYLE_BEST_1_STORAGE_KEY]: 1,
      [GN_STYLE_BEST_2_STORAGE_KEY]: 3,
      [GN_STYLE_BEST_3_STORAGE_KEY]: 2,
    })),
    /gnStyleLeaderboard must remain ordered/,
  );
  assert.throws(
    () => ClassicSettingsState.load(new RecordingPort({
      [CLASSIC_BIRD_BEST_1_STORAGE_KEY]: 1,
      [CLASSIC_BIRD_BEST_2_STORAGE_KEY]: 3,
      [CLASSIC_BIRD_BEST_3_STORAGE_KEY]: 2,
    })),
    /birdClassicLeaderboard must remain ordered/,
  );
  assert.throws(
    () => ClassicSettingsState.load(new RecordingPort({
      [CRAZY_BIRD_BEST_1_STORAGE_KEY]: 1,
      [CRAZY_BIRD_BEST_2_STORAGE_KEY]: 3,
      [CRAZY_BIRD_BEST_3_STORAGE_KEY]: 2,
    })),
    /birdCrazyLeaderboard must remain ordered/,
  );
  assert.throws(
    () => ClassicSettingsState.load(new RecordingPort({
      [COMBO_BIRD_BEST_1_STORAGE_KEY]: 1,
      [COMBO_BIRD_BEST_2_STORAGE_KEY]: 3,
      [COMBO_BIRD_BEST_3_STORAGE_KEY]: 2,
    })),
    /birdComboLeaderboard must remain ordered/,
  );
  assert.throws(
    () => ClassicSettingsState.load(new RecordingPort({
      [OBJECTIVES_CURRENT_STORAGE_KEY]: 52,
    })),
    /currentObjective/,
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
  assert.throws(
    () => ClassicSettingsState.load(new RecordingPort({
      [classicBladePriceStorageKey(1)]: -1,
    })),
    /bladePrices prices must be non-negative/,
  );
  assert.throws(
    () => ClassicSettingsState.load(new RecordingPort({
      [classicBackgroundPriceStorageKey(1)]: 0x8000_0000,
    })),
    /backgroundPrices price must be a signed 32-bit integer/,
  );

  const state = ClassicSettingsState.defaults();
  const before = state.snapshot;
  assert.throws(() => state.setMusicEnabled(1 as never), /musicEnabled must be a boolean/);
  assert.throws(() => state.setEffectsEnabled('false' as never), /effectsEnabled must be a boolean/);
  assert.throws(() => state.setRated(null as never), /rated must be a boolean/);
  assert.throws(() => state.setSelectedTheme(10), /selectedTheme/);
  assert.throws(() => state.setSelectedBackground(1.5), /selectedBackground/);
  assert.throws(() => state.setSelectedBlade(-1), /selectedBlade/);
  assert.throws(() => state.setCurrentObjective(53), /currentObjective/);
  assert.throws(() => state.setFruitsCut(0x8000_0000), /fruitsCut/);
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
