export type RecoveredResultRank = 1 | 2 | 3;

export interface RecoveredLeaderboard {
  readonly first: number;
  readonly second: number;
  readonly third: number;
}

export interface RecoveredLeaderboardUpdate {
  readonly achievedRank: RecoveredResultRank | null;
  readonly leaderboard: RecoveredLeaderboard;
}

export interface RecoveredResultCoinAward {
  readonly bonusCoins: number;
  readonly totalCoins: number;
}

export const RECOVERED_INITIAL_LEADERBOARD: RecoveredLeaderboard = Object.freeze({
  first: 0,
  second: 0,
  third: 0,
});
export const RECOVERED_INITIAL_TOTAL_COINS = 2014 as const;
export const RECOVERED_RESULT_COIN_FACTOR_LOW = Math.fround(0.6);
export const RECOVERED_RESULT_COIN_FACTOR_HIGH = Math.fround(0.8);

/** Shared DisplayScore `>=` insertion used by every recovered mode branch. */
export function insertRecoveredResultScore(
  completedScore: number,
  current: RecoveredLeaderboard,
): RecoveredLeaderboardUpdate {
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

export function recoveredLeaderboardPanelValues(
  leaderboard: RecoveredLeaderboard,
): readonly [number, number, number] {
  assertLeaderboard(leaderboard);
  return Object.freeze([
    leaderboard.first,
    leaderboard.second,
    leaderboard.third,
  ]);
}

/** Float32 multiply followed by signed truncation toward zero. */
export function calculateRecoveredResultCoinBonus(
  completedScore: number,
  factor: number,
): number {
  assertSignedInt32(completedScore, 'completedScore');
  const recoveredFactor = assertRecoveredFactor(factor);
  return Math.trunc(Math.fround(
    Math.fround(completedScore) * recoveredFactor,
  ));
}

/** Signed ARM int32 addition used by DisplayScoreLayer::TotalCoinsCallback. */
export function awardRecoveredResultCoins(
  currentTotalCoins: number,
  completedScore: number,
  factor: number,
): RecoveredResultCoinAward {
  assertSignedInt32(currentTotalCoins, 'currentTotalCoins');
  const bonusCoins = calculateRecoveredResultCoinBonus(completedScore, factor);
  return Object.freeze({
    bonusCoins,
    totalCoins: (currentTotalCoins + bonusCoins) | 0,
  });
}

function update(
  achievedRank: RecoveredResultRank,
  first: number,
  second: number,
  third: number,
): RecoveredLeaderboardUpdate {
  return Object.freeze({
    achievedRank,
    leaderboard: freezeLeaderboard(first, second, third),
  });
}

function freezeLeaderboard(
  first: number,
  second: number,
  third: number,
): RecoveredLeaderboard {
  return Object.freeze({ first, second, third });
}

function assertLeaderboard(value: RecoveredLeaderboard): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('current leaderboard must be an object');
  }
  assertSignedInt32(value.first, 'current.first');
  assertSignedInt32(value.second, 'current.second');
  assertSignedInt32(value.third, 'current.third');
  if (value.first < value.second || value.second < value.third) {
    throw new RangeError('current leaderboard must be ordered first >= second >= third');
  }
}

function assertRecoveredFactor(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError('factor must be finite');
  }
  const factor = Math.fround(value);
  if (
    factor !== RECOVERED_RESULT_COIN_FACTOR_LOW
    && factor !== RECOVERED_RESULT_COIN_FACTOR_HIGH
  ) {
    throw new RangeError('factor must be the recovered float32 0.6 or 0.8');
  }
  return factor;
}

function assertSignedInt32(value: number, label: string): void {
  if (
    !Number.isSafeInteger(value)
    || value < -0x8000_0000
    || value > 0x7fff_ffff
  ) {
    throw new RangeError(`${label} must fit a signed 32-bit integer`);
  }
}
