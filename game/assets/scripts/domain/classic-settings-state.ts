import {
  CLASSIC_BIRD_BEST_1_STORAGE_KEY,
  CLASSIC_BIRD_BEST_2_STORAGE_KEY,
  CLASSIC_BIRD_BEST_3_STORAGE_KEY,
  CLASSIC_BIRD_INITIAL_LEADERBOARD,
  awardClassicBirdResultCoins,
  insertClassicBirdResultScore,
  type ClassicBirdLeaderboard,
  type ClassicBirdLeaderboardUpdate,
  type ClassicBirdResultCoinAward,
} from './classic-bird-result-ranking';
import {
  CLASSIC_INITIAL_LEADERBOARD,
  CLASSIC_INITIAL_TOTAL_COINS,
  awardClassicResultCoins,
  insertClassicResultScore,
  type ClassicLeaderboard,
  type ClassicLeaderboardUpdate,
  type ClassicResultCoinAward,
} from './classic-result-ranking';
import {
  CRAZY_BEST_1_STORAGE_KEY,
  CRAZY_BEST_2_STORAGE_KEY,
  CRAZY_BEST_3_STORAGE_KEY,
  CRAZY_INITIAL_LEADERBOARD,
  awardCrazyResultCoins,
  insertCrazyResultScore,
  type CrazyLeaderboard,
  type CrazyLeaderboardUpdate,
  type CrazyResultCoinAward,
} from './crazy-result-ranking';
import {
  OBJECTIVES_COUNT,
  OBJECTIVES_CURRENT_STORAGE_KEY,
  OBJECTIVES_FRUITS_CUT_STORAGE_KEY,
} from './objectives-manager-state';

export {
  CLASSIC_BIRD_BEST_1_STORAGE_KEY,
  CLASSIC_BIRD_BEST_2_STORAGE_KEY,
  CLASSIC_BIRD_BEST_3_STORAGE_KEY,
} from './classic-bird-result-ranking';
export {
  CRAZY_BEST_1_STORAGE_KEY,
  CRAZY_BEST_2_STORAGE_KEY,
  CRAZY_BEST_3_STORAGE_KEY,
} from './crazy-result-ranking';
export {
  OBJECTIVES_CURRENT_STORAGE_KEY,
  OBJECTIVES_FRUITS_CUT_STORAGE_KEY,
} from './objectives-manager-state';

export const CLASSIC_TOTAL_COINS_STORAGE_KEY = 'total_coins';
export const CLASSIC_SELECTED_THEME_STORAGE_KEY = 'selected_theme';
export const CLASSIC_SELECTED_BACKGROUND_STORAGE_KEY = 'selected_background';
export const CLASSIC_SELECTED_BLADE_STORAGE_KEY = 'selected_blade';
export const CLASSIC_BEST_1_STORAGE_KEY = 'classic_best_1';
export const CLASSIC_BEST_2_STORAGE_KEY = 'classic_best_2';
export const CLASSIC_BEST_3_STORAGE_KEY = 'classic_best_3';
export const CLASSIC_MUSIC_ENABLED_STORAGE_KEY = 'enable_music';
export const CLASSIC_EFFECTS_ENABLED_STORAGE_KEY = 'enable_effect';
export const CLASSIC_NETWORK_AVAILABLE_STORAGE_KEY = 'network_available';
export const CLASSIC_RATED_STORAGE_KEY = 'rated';

export const CLASSIC_INITIAL_SELECTED_THEME = 2 as const;
export const CLASSIC_INITIAL_SELECTED_BACKGROUND = 0 as const;
export const CLASSIC_INITIAL_SELECTED_BLADE = 0 as const;
export const CLASSIC_MAX_SELECTED_THEME = 9 as const;
export const CLASSIC_MAX_SELECTED_BACKGROUND = 8 as const;
export const CLASSIC_MAX_SELECTED_BLADE = 17 as const;
export const CLASSIC_MODE_UNLOCK_INDICES = Object.freeze([1, 2, 4, 5] as const);

export type ClassicModeUnlockIndex = typeof CLASSIC_MODE_UNLOCK_INDICES[number];

export interface ClassicInt32PreferencePort {
  readInt32(key: string, defaultValue: number): number;
  writeInt32(key: string, value: number): void;
  readBoolean(key: string, defaultValue: boolean): boolean;
  writeBoolean(key: string, value: boolean): void;
}

export interface ClassicSettingsSnapshot {
  readonly crazyLeaderboard: CrazyLeaderboard;
  readonly currentObjective: number;
  readonly effectsEnabled: boolean;
  readonly fruitsCut: number;
  /** Compatibility alias for the mode-0 leaderboard. */
  readonly leaderboard: ClassicLeaderboard;
  readonly musicEnabled: boolean;
  readonly networkAvailable: boolean;
  readonly rated: boolean;
  readonly selectedBackground: number;
  readonly selectedBlade: number;
  readonly selectedTheme: number;
  readonly totalCoins: number;
}

export interface ClassicTotalCoinsAdjustment {
  readonly delta: number;
  readonly nextTotalCoins: number;
  readonly previousTotalCoins: number;
}

/**
 * Process-lifetime implemented subset of native Settings shared by shell, menus, and gameplay.
 * This is intentionally not the complete recovered 50-integer Settings schema.
 */
export class ClassicSettingsState {
  private birdClassicLeaderboardValue: ClassicBirdLeaderboard;
  private crazyLeaderboardValue: CrazyLeaderboard;
  private currentObjectiveValue: number;
  private effectsEnabledValue: boolean;
  private fruitsCutValue: number;
  private leaderboardValue: ClassicLeaderboard;
  private musicEnabledValue: boolean;
  private readonly networkAvailableValue: boolean;
  private ratedValue: boolean;
  private selectedBackgroundValue: number;
  private selectedBladeValue: number;
  private selectedThemeValue: number;
  private totalCoinsValue: number;

  private constructor(
    snapshot: ClassicSettingsSnapshot,
    birdClassicLeaderboard: ClassicBirdLeaderboard,
  ) {
    assertSnapshot(snapshot);
    assertOrderedLeaderboard(birdClassicLeaderboard, 'birdClassicLeaderboard');
    this.birdClassicLeaderboardValue = freezeLeaderboard(birdClassicLeaderboard);
    this.crazyLeaderboardValue = freezeLeaderboard(snapshot.crazyLeaderboard);
    this.currentObjectiveValue = snapshot.currentObjective;
    this.effectsEnabledValue = snapshot.effectsEnabled;
    this.fruitsCutValue = snapshot.fruitsCut;
    this.leaderboardValue = freezeLeaderboard(snapshot.leaderboard);
    this.musicEnabledValue = snapshot.musicEnabled;
    this.networkAvailableValue = snapshot.networkAvailable;
    this.ratedValue = snapshot.rated;
    this.selectedBackgroundValue = snapshot.selectedBackground;
    this.selectedBladeValue = snapshot.selectedBlade;
    this.selectedThemeValue = snapshot.selectedTheme;
    this.totalCoinsValue = snapshot.totalCoins;
  }

  static defaults(): ClassicSettingsState {
    return new ClassicSettingsState(
      Object.freeze({
        crazyLeaderboard: CRAZY_INITIAL_LEADERBOARD,
        currentObjective: 0,
        effectsEnabled: true,
        fruitsCut: 0,
        leaderboard: CLASSIC_INITIAL_LEADERBOARD,
        musicEnabled: true,
        networkAvailable: false,
        rated: false,
        selectedBackground: CLASSIC_INITIAL_SELECTED_BACKGROUND,
        selectedBlade: CLASSIC_INITIAL_SELECTED_BLADE,
        selectedTheme: CLASSIC_INITIAL_SELECTED_THEME,
        totalCoins: CLASSIC_INITIAL_TOTAL_COINS,
      }),
      CLASSIC_BIRD_INITIAL_LEADERBOARD,
    );
  }

  static load(port: ClassicInt32PreferencePort): ClassicSettingsState {
    assertPort(port);
    // Recovered relative order of this implemented subset; omitted Settings fields stay omitted.
    const totalCoins = port.readInt32(
      CLASSIC_TOTAL_COINS_STORAGE_KEY,
      CLASSIC_INITIAL_TOTAL_COINS,
    );
    const selectedTheme = port.readInt32(
      CLASSIC_SELECTED_THEME_STORAGE_KEY,
      CLASSIC_INITIAL_SELECTED_THEME,
    );
    const selectedBackground = port.readInt32(
      CLASSIC_SELECTED_BACKGROUND_STORAGE_KEY,
      CLASSIC_INITIAL_SELECTED_BACKGROUND,
    );
    const selectedBlade = port.readInt32(
      CLASSIC_SELECTED_BLADE_STORAGE_KEY,
      CLASSIC_INITIAL_SELECTED_BLADE,
    );
    const first = port.readInt32(CLASSIC_BEST_1_STORAGE_KEY, 0);
    const second = port.readInt32(CLASSIC_BEST_2_STORAGE_KEY, 0);
    const third = port.readInt32(CLASSIC_BEST_3_STORAGE_KEY, 0);
    const crazyFirst = port.readInt32(CRAZY_BEST_1_STORAGE_KEY, 0);
    const crazySecond = port.readInt32(CRAZY_BEST_2_STORAGE_KEY, 0);
    const crazyThird = port.readInt32(CRAZY_BEST_3_STORAGE_KEY, 0);
    const birdClassicFirst = port.readInt32(CLASSIC_BIRD_BEST_1_STORAGE_KEY, 0);
    const birdClassicSecond = port.readInt32(CLASSIC_BIRD_BEST_2_STORAGE_KEY, 0);
    const birdClassicThird = port.readInt32(CLASSIC_BIRD_BEST_3_STORAGE_KEY, 0);
    const currentObjective = port.readInt32(OBJECTIVES_CURRENT_STORAGE_KEY, 0);
    const fruitsCut = port.readInt32(OBJECTIVES_FRUITS_CUT_STORAGE_KEY, 0);
    const musicEnabled = port.readBoolean(CLASSIC_MUSIC_ENABLED_STORAGE_KEY, true);
    const effectsEnabled = port.readBoolean(CLASSIC_EFFECTS_ENABLED_STORAGE_KEY, true);
    const networkAvailable = port.readBoolean(CLASSIC_NETWORK_AVAILABLE_STORAGE_KEY, false);
    const rated = port.readBoolean(CLASSIC_RATED_STORAGE_KEY, false);
    return new ClassicSettingsState(
      Object.freeze({
        crazyLeaderboard: Object.freeze({
          first: crazyFirst,
          second: crazySecond,
          third: crazyThird,
        }),
        currentObjective,
        effectsEnabled,
        fruitsCut,
        leaderboard: Object.freeze({ first, second, third }),
        musicEnabled,
        networkAvailable,
        rated,
        selectedBackground,
        selectedBlade,
        selectedTheme,
        totalCoins,
      }),
      Object.freeze({
        first: birdClassicFirst,
        second: birdClassicSecond,
        third: birdClassicThird,
      }),
    );
  }

  get birdClassicLeaderboard(): ClassicBirdLeaderboard {
    return freezeLeaderboard(this.birdClassicLeaderboardValue);
  }

  get snapshot(): ClassicSettingsSnapshot {
    return Object.freeze({
      crazyLeaderboard: freezeLeaderboard(this.crazyLeaderboardValue),
      currentObjective: this.currentObjectiveValue,
      effectsEnabled: this.effectsEnabledValue,
      fruitsCut: this.fruitsCutValue,
      leaderboard: freezeLeaderboard(this.leaderboardValue),
      musicEnabled: this.musicEnabledValue,
      networkAvailable: this.networkAvailableValue,
      rated: this.ratedValue,
      selectedBackground: this.selectedBackgroundValue,
      selectedBlade: this.selectedBladeValue,
      selectedTheme: this.selectedThemeValue,
      totalCoins: this.totalCoinsValue,
    });
  }

  setMusicEnabled(enabled: boolean): void {
    assertBoolean(enabled, 'musicEnabled');
    this.musicEnabledValue = enabled;
  }

  setEffectsEnabled(enabled: boolean): void {
    assertBoolean(enabled, 'effectsEnabled');
    this.effectsEnabledValue = enabled;
  }

  setRated(rated: boolean): void {
    assertBoolean(rated, 'rated');
    this.ratedValue = rated;
  }

  setSelectedTheme(selectedTheme: number): void {
    assertSelectionIndex(selectedTheme, CLASSIC_MAX_SELECTED_THEME, 'selectedTheme');
    this.selectedThemeValue = selectedTheme;
  }

  setSelectedBackground(selectedBackground: number): void {
    assertSelectionIndex(
      selectedBackground,
      CLASSIC_MAX_SELECTED_BACKGROUND,
      'selectedBackground',
    );
    this.selectedBackgroundValue = selectedBackground;
  }

  setSelectedBlade(selectedBlade: number): void {
    assertSelectionIndex(selectedBlade, CLASSIC_MAX_SELECTED_BLADE, 'selectedBlade');
    this.selectedBladeValue = selectedBlade;
  }

  /** Adds a signed delta in memory and rejects overflow before mutating state. */
  addTotalCoins(delta: number): ClassicTotalCoinsAdjustment {
    assertSignedInt32(delta, 'totalCoins delta');
    const previousTotalCoins = this.totalCoinsValue;
    const nextTotalCoins = previousTotalCoins + delta;
    assertSignedInt32(nextTotalCoins, 'nextTotalCoins');
    const adjustment = Object.freeze({
      delta,
      nextTotalCoins,
      previousTotalCoins,
    });
    this.totalCoinsValue = nextTotalCoins;
    return adjustment;
  }

  /** Applies the native signed-int32 reward addition used by ObjectivesManager. */
  addObjectiveRewardCoins(rewardCoins: number): ClassicTotalCoinsAdjustment {
    assertSignedInt32(rewardCoins, 'objective reward coins');
    const previousTotalCoins = this.totalCoinsValue;
    const nextTotalCoins = (previousTotalCoins + rewardCoins) | 0;
    const adjustment = Object.freeze({
      delta: rewardCoins,
      nextTotalCoins,
      previousTotalCoins,
    });
    this.totalCoinsValue = nextTotalCoins;
    return adjustment;
  }

  setCurrentObjective(currentObjective: number): void {
    assertCurrentObjective(currentObjective, true);
    this.currentObjectiveValue = currentObjective;
  }

  setFruitsCut(fruitsCut: number): void {
    assertSignedInt32(fruitsCut, 'fruitsCut');
    this.fruitsCutValue = fruitsCut;
  }

  recordClassicResultScore(completedScore: number): ClassicLeaderboardUpdate {
    const update = insertClassicResultScore(completedScore, this.leaderboardValue);
    this.leaderboardValue = update.leaderboard;
    return update;
  }

  recordCrazyResultScore(completedScore: number): CrazyLeaderboardUpdate {
    const update = insertCrazyResultScore(completedScore, this.crazyLeaderboardValue);
    this.crazyLeaderboardValue = update.leaderboard;
    return update;
  }

  recordClassicBirdResultScore(
    completedScore: number,
  ): ClassicBirdLeaderboardUpdate {
    const update = insertClassicBirdResultScore(
      completedScore,
      this.birdClassicLeaderboardValue,
    );
    this.birdClassicLeaderboardValue = update.leaderboard;
    return update;
  }

  awardClassicResultCoins(completedScore: number): ClassicResultCoinAward {
    const award = awardClassicResultCoins(this.totalCoinsValue, completedScore);
    this.totalCoinsValue = award.totalCoins;
    return award;
  }

  awardCrazyResultCoins(completedScore: number): CrazyResultCoinAward {
    const award = awardCrazyResultCoins(this.totalCoinsValue, completedScore);
    this.totalCoinsValue = award.totalCoins;
    return award;
  }

  awardClassicBirdResultCoins(
    completedScore: number,
  ): ClassicBirdResultCoinAward {
    const award = awardClassicBirdResultCoins(this.totalCoinsValue, completedScore);
    this.totalCoinsValue = award.totalCoins;
    return award;
  }

  /** Persists only the implemented subset in recovered relative SaveData order. */
  save(port: ClassicInt32PreferencePort): void {
    assertPort(port);
    port.writeInt32(CLASSIC_TOTAL_COINS_STORAGE_KEY, this.totalCoinsValue);
    port.writeInt32(CLASSIC_SELECTED_THEME_STORAGE_KEY, this.selectedThemeValue);
    port.writeInt32(CLASSIC_SELECTED_BACKGROUND_STORAGE_KEY, this.selectedBackgroundValue);
    port.writeInt32(CLASSIC_SELECTED_BLADE_STORAGE_KEY, this.selectedBladeValue);
    port.writeInt32(CLASSIC_BEST_1_STORAGE_KEY, this.leaderboardValue.first);
    port.writeInt32(CLASSIC_BEST_2_STORAGE_KEY, this.leaderboardValue.second);
    port.writeInt32(CLASSIC_BEST_3_STORAGE_KEY, this.leaderboardValue.third);
    port.writeInt32(CRAZY_BEST_1_STORAGE_KEY, this.crazyLeaderboardValue.first);
    port.writeInt32(CRAZY_BEST_2_STORAGE_KEY, this.crazyLeaderboardValue.second);
    port.writeInt32(CRAZY_BEST_3_STORAGE_KEY, this.crazyLeaderboardValue.third);
    port.writeInt32(
      CLASSIC_BIRD_BEST_1_STORAGE_KEY,
      this.birdClassicLeaderboardValue.first,
    );
    port.writeInt32(
      CLASSIC_BIRD_BEST_2_STORAGE_KEY,
      this.birdClassicLeaderboardValue.second,
    );
    port.writeInt32(
      CLASSIC_BIRD_BEST_3_STORAGE_KEY,
      this.birdClassicLeaderboardValue.third,
    );
    port.writeInt32(OBJECTIVES_CURRENT_STORAGE_KEY, this.currentObjectiveValue);
    port.writeInt32(OBJECTIVES_FRUITS_CUT_STORAGE_KEY, this.fruitsCutValue);
    port.writeBoolean(CLASSIC_MUSIC_ENABLED_STORAGE_KEY, this.musicEnabledValue);
    port.writeBoolean(CLASSIC_EFFECTS_ENABLED_STORAGE_KEY, this.effectsEnabledValue);
    // SaveData writes the network launch sentinel false, not the in-memory launch value.
    port.writeBoolean(CLASSIC_NETWORK_AVAILABLE_STORAGE_KEY, false);
    port.writeBoolean(CLASSIC_RATED_STORAGE_KEY, this.ratedValue);
  }
}

export function classicModeUnlockStorageKey(modeIndex: number): string {
  if (!CLASSIC_MODE_UNLOCK_INDICES.some((persistedIndex) => persistedIndex === modeIndex)) {
    throw new RangeError('modeIndex must be one of the persisted indices 1, 2, 4, or 5');
  }
  return `mode_unlock_${modeIndex}`;
}

function assertPort(port: ClassicInt32PreferencePort): void {
  if (
    port === null
    || typeof port !== 'object'
    || typeof port.readInt32 !== 'function'
    || typeof port.writeInt32 !== 'function'
    || typeof port.readBoolean !== 'function'
    || typeof port.writeBoolean !== 'function'
  ) {
    throw new TypeError(
      'Classic settings port must provide int32 read and write operations plus boolean read and write operations',
    );
  }
}

function assertSnapshot(snapshot: ClassicSettingsSnapshot): void {
  if (snapshot === null || typeof snapshot !== 'object') {
    throw new TypeError('Classic settings snapshot must be an object');
  }
  if (typeof snapshot.effectsEnabled !== 'boolean') {
    throw new TypeError('effectsEnabled must be a boolean');
  }
  assertCurrentObjective(snapshot.currentObjective, false);
  assertSignedInt32(snapshot.fruitsCut, 'fruitsCut');
  if (typeof snapshot.musicEnabled !== 'boolean') {
    throw new TypeError('musicEnabled must be a boolean');
  }
  if (typeof snapshot.networkAvailable !== 'boolean') {
    throw new TypeError('networkAvailable must be a boolean');
  }
  if (typeof snapshot.rated !== 'boolean') {
    throw new TypeError('rated must be a boolean');
  }
  assertSelectionIndex(
    snapshot.selectedTheme,
    CLASSIC_MAX_SELECTED_THEME,
    'selectedTheme',
  );
  assertSelectionIndex(
    snapshot.selectedBackground,
    CLASSIC_MAX_SELECTED_BACKGROUND,
    'selectedBackground',
  );
  assertSelectionIndex(
    snapshot.selectedBlade,
    CLASSIC_MAX_SELECTED_BLADE,
    'selectedBlade',
  );
  assertSignedInt32(snapshot.totalCoins, 'totalCoins');
  const leaderboard = snapshot.leaderboard;
  assertOrderedLeaderboard(leaderboard, 'leaderboard');
  assertOrderedLeaderboard(snapshot.crazyLeaderboard, 'crazyLeaderboard');
}

function assertBoolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be a boolean`);
  }
}

function assertSelectionIndex(value: number, maximum: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new RangeError(`${label} must be an integer index from 0 through ${maximum}`);
  }
}

function assertCurrentObjective(value: number, allowTransientResetPosition: boolean): void {
  const maximum = allowTransientResetPosition ? OBJECTIVES_COUNT : OBJECTIVES_COUNT - 1;
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new RangeError(`currentObjective must be an integer index from 0 through ${maximum}`);
  }
}

function assertSignedInt32(value: number, label: string): void {
  if (
    !Number.isSafeInteger(value)
    || value < -0x8000_0000
    || value > 0x7fff_ffff
  ) {
    throw new RangeError(`${label} must be a signed 32-bit integer`);
  }
}

function freezeLeaderboard<T extends ClassicLeaderboard>(value: T): T {
  return Object.freeze({
    first: value.first,
    second: value.second,
    third: value.third,
  }) as T;
}

function assertOrderedLeaderboard(
  value: ClassicBirdLeaderboard | ClassicLeaderboard | CrazyLeaderboard,
  label: string,
): void {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`Classic settings ${label} must be an object`);
  }
  assertSignedInt32(value.first, `${label}.first`);
  assertSignedInt32(value.second, `${label}.second`);
  assertSignedInt32(value.third, `${label}.third`);
  if (value.first < value.second || value.second < value.third) {
    throw new RangeError(`Classic settings ${label} must remain ordered`);
  }
}
