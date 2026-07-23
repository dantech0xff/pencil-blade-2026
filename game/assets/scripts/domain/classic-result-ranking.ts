/** Recovered mode-0 leaderboard insertion used by DisplayScoreLayer. */

export type ClassicResultRank = 1 | 2 | 3;

export interface ClassicLeaderboard {
  readonly first: number;
  readonly second: number;
  readonly third: number;
}

export interface ClassicLeaderboardUpdate {
  readonly achievedRank: ClassicResultRank | null;
  readonly leaderboard: ClassicLeaderboard;
}

export const CLASSIC_INITIAL_LEADERBOARD: ClassicLeaderboard = Object.freeze({
  first: 0,
  second: 0,
  third: 0,
});

/** Restoration fallback for missing or failed saves; persisted balances override it. */
export const CLASSIC_INITIAL_TOTAL_COINS = 999_999;
export const CLASSIC_RESULT_COIN_FACTOR = Math.fround(0.6);

export interface ClassicResultCoinAward {
  readonly bonusCoins: number;
  readonly totalCoins: number;
}

/**
 * Inserts a completed Classic score using the native >= comparisons.
 * Equal scores therefore promote through the matching rank tier.
 */
export function insertClassicResultScore(
  completedScore: number,
  current: ClassicLeaderboard,
): ClassicLeaderboardUpdate {
  assertSignedInt32(completedScore, 'completedScore');
  assertLeaderboard(current);

  if (completedScore >= current.first) {
    return update(1, completedScore, current.first, current.second);
  }
  if (completedScore >= current.second) {
    return update(2, current.first, completedScore, current.second);
  }
  if (completedScore >= current.third) {
    return update(3, current.first, current.second, completedScore);
  }
  return Object.freeze({
    achievedRank: null,
    leaderboard: freezeLeaderboard(current.first, current.second, current.third),
  });
}

/** Native podium labels are populated in Best_1, Best_2, Best_3 order. */
export function classicLeaderboardPanelValues(
  leaderboard: ClassicLeaderboard,
): readonly [number, number, number] {
  assertLeaderboard(leaderboard);
  return Object.freeze([
    leaderboard.first,
    leaderboard.second,
    leaderboard.third,
  ]);
}

/** Mode 0 uses float32 score * 0.6 followed by signed truncation toward zero. */
export function calculateClassicResultCoinBonus(completedScore: number): number {
  assertSignedInt32(completedScore, 'completedScore');
  return Math.trunc(Math.fround(
    Math.fround(completedScore) * CLASSIC_RESULT_COIN_FACTOR,
  ));
}

/** Applies the native signed 32-bit ARM addition used by TotalCoinsCallback. */
export function awardClassicResultCoins(
  currentTotalCoins: number,
  completedScore: number,
): ClassicResultCoinAward {
  assertSignedInt32(currentTotalCoins, 'currentTotalCoins');
  const bonusCoins = calculateClassicResultCoinBonus(completedScore);
  return Object.freeze({
    bonusCoins,
    totalCoins: (currentTotalCoins + bonusCoins) | 0,
  });
}

function update(
  achievedRank: ClassicResultRank,
  first: number,
  second: number,
  third: number,
): ClassicLeaderboardUpdate {
  return Object.freeze({
    achievedRank,
    leaderboard: freezeLeaderboard(first, second, third),
  });
}

function freezeLeaderboard(first: number, second: number, third: number): ClassicLeaderboard {
  return Object.freeze({ first, second, third });
}

function assertLeaderboard(value: ClassicLeaderboard): void {
  if (value === null || typeof value !== 'object') {
    throw new TypeError('current leaderboard must be an object');
  }
  assertSignedInt32(value.first, 'current.first');
  assertSignedInt32(value.second, 'current.second');
  assertSignedInt32(value.third, 'current.third');
  if (value.first < value.second || value.second < value.third) {
    throw new RangeError('current leaderboard must be ordered first >= second >= third');
  }
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}

function assertSignedInt32(value: number, label: string): void {
  assertSafeInteger(value, label);
  if (value < -0x8000_0000 || value > 0x7fff_ffff) {
    throw new RangeError(`${label} must fit a signed 32-bit integer`);
  }
}
