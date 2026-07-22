import {
  CLASSIC_INITIAL_LEADERBOARD,
  CLASSIC_INITIAL_TOTAL_COINS,
  awardClassicResultCoins,
  insertClassicResultScore,
  type ClassicLeaderboard,
  type ClassicLeaderboardUpdate,
  type ClassicResultCoinAward,
} from './classic-result-ranking';

export const CLASSIC_TOTAL_COINS_STORAGE_KEY = 'total_coins';
export const CLASSIC_BEST_1_STORAGE_KEY = 'classic_best_1';
export const CLASSIC_BEST_2_STORAGE_KEY = 'classic_best_2';
export const CLASSIC_BEST_3_STORAGE_KEY = 'classic_best_3';
export const CLASSIC_EFFECTS_ENABLED_STORAGE_KEY = 'enable_effect';

export interface ClassicInt32PreferencePort {
  readInt32(key: string, defaultValue: number): number;
  writeInt32(key: string, value: number): void;
  readBoolean(key: string, defaultValue: boolean): boolean;
  writeBoolean(key: string, value: boolean): void;
}

export interface ClassicSettingsSnapshot {
  readonly effectsEnabled: boolean;
  readonly leaderboard: ClassicLeaderboard;
  readonly totalCoins: number;
}

/**
 * Process-lifetime subset of native Settings used by Classic and DisplayScoreLayer.
 * Result mutations stay in memory until an explicit lifecycle save checkpoint.
 */
export class ClassicSettingsState {
  private readonly effectsEnabledValue: boolean;
  private leaderboardValue: ClassicLeaderboard;
  private totalCoinsValue: number;

  private constructor(snapshot: ClassicSettingsSnapshot) {
    assertSnapshot(snapshot);
    this.effectsEnabledValue = snapshot.effectsEnabled;
    this.leaderboardValue = freezeLeaderboard(snapshot.leaderboard);
    this.totalCoinsValue = snapshot.totalCoins;
  }

  static defaults(): ClassicSettingsState {
    return new ClassicSettingsState(Object.freeze({
      effectsEnabled: true,
      leaderboard: CLASSIC_INITIAL_LEADERBOARD,
      totalCoins: CLASSIC_INITIAL_TOTAL_COINS,
    }));
  }

  static load(port: ClassicInt32PreferencePort): ClassicSettingsState {
    assertPort(port);
    // This is the recovered relative order of the implemented Classic Settings subset.
    const totalCoins = port.readInt32(
      CLASSIC_TOTAL_COINS_STORAGE_KEY,
      CLASSIC_INITIAL_TOTAL_COINS,
    );
    const first = port.readInt32(CLASSIC_BEST_1_STORAGE_KEY, 0);
    const second = port.readInt32(CLASSIC_BEST_2_STORAGE_KEY, 0);
    const third = port.readInt32(CLASSIC_BEST_3_STORAGE_KEY, 0);
    const effectsEnabled = port.readBoolean(CLASSIC_EFFECTS_ENABLED_STORAGE_KEY, true);
    return new ClassicSettingsState(Object.freeze({
      effectsEnabled,
      leaderboard: Object.freeze({ first, second, third }),
      totalCoins,
    }));
  }

  get snapshot(): ClassicSettingsSnapshot {
    return Object.freeze({
      effectsEnabled: this.effectsEnabledValue,
      leaderboard: freezeLeaderboard(this.leaderboardValue),
      totalCoins: this.totalCoinsValue,
    });
  }

  recordClassicResultScore(completedScore: number): ClassicLeaderboardUpdate {
    const update = insertClassicResultScore(completedScore, this.leaderboardValue);
    this.leaderboardValue = update.leaderboard;
    return update;
  }

  awardClassicResultCoins(completedScore: number): ClassicResultCoinAward {
    const award = awardClassicResultCoins(this.totalCoinsValue, completedScore);
    this.totalCoinsValue = award.totalCoins;
    return award;
  }

  /** Persists the Classic-relevant subset in recovered relative SaveData order. */
  save(port: ClassicInt32PreferencePort): void {
    assertPort(port);
    port.writeInt32(CLASSIC_TOTAL_COINS_STORAGE_KEY, this.totalCoinsValue);
    port.writeInt32(CLASSIC_BEST_1_STORAGE_KEY, this.leaderboardValue.first);
    port.writeInt32(CLASSIC_BEST_2_STORAGE_KEY, this.leaderboardValue.second);
    port.writeInt32(CLASSIC_BEST_3_STORAGE_KEY, this.leaderboardValue.third);
    port.writeBoolean(CLASSIC_EFFECTS_ENABLED_STORAGE_KEY, this.effectsEnabledValue);
  }
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
  assertSignedInt32(snapshot.totalCoins, 'totalCoins');
  const leaderboard = snapshot.leaderboard;
  if (leaderboard === null || typeof leaderboard !== 'object') {
    throw new TypeError('Classic settings leaderboard must be an object');
  }
  assertSignedInt32(leaderboard.first, 'leaderboard.first');
  assertSignedInt32(leaderboard.second, 'leaderboard.second');
  assertSignedInt32(leaderboard.third, 'leaderboard.third');
  if (leaderboard.first < leaderboard.second || leaderboard.second < leaderboard.third) {
    throw new RangeError('Classic settings leaderboard must remain ordered');
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

function freezeLeaderboard(value: ClassicLeaderboard): ClassicLeaderboard {
  return Object.freeze({
    first: value.first,
    second: value.second,
    third: value.third,
  });
}
