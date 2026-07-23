import {
  RECOVERED_INITIAL_LEADERBOARD,
  RECOVERED_INITIAL_TOTAL_COINS,
  RECOVERED_RESULT_COIN_FACTOR_LOW,
  awardRecoveredResultCoins,
  calculateRecoveredResultCoinBonus,
  insertRecoveredResultScore,
  recoveredLeaderboardPanelValues,
  type RecoveredLeaderboard,
  type RecoveredLeaderboardUpdate,
  type RecoveredResultCoinAward,
  type RecoveredResultRank,
} from './recovered-result-ranking';

export const CRAZY_RESULT_MODE_ID = 1 as const;
export const CRAZY_BEST_1_STORAGE_KEY = 'crazy_best_1' as const;
export const CRAZY_BEST_2_STORAGE_KEY = 'crazy_best_2' as const;
export const CRAZY_BEST_3_STORAGE_KEY = 'crazy_best_3' as const;

export type CrazyResultRank = RecoveredResultRank;
export type CrazyLeaderboard = RecoveredLeaderboard;
export type CrazyLeaderboardUpdate = RecoveredLeaderboardUpdate;
export type CrazyResultCoinAward = RecoveredResultCoinAward;

export const CRAZY_INITIAL_LEADERBOARD: CrazyLeaderboard
  = RECOVERED_INITIAL_LEADERBOARD;
export const CRAZY_INITIAL_TOTAL_COINS = RECOVERED_INITIAL_TOTAL_COINS;
export const CRAZY_RESULT_COIN_FACTOR = RECOVERED_RESULT_COIN_FACTOR_LOW;

export function insertCrazyResultScore(
  completedScore: number,
  current: CrazyLeaderboard,
): CrazyLeaderboardUpdate {
  return insertRecoveredResultScore(completedScore, current);
}

export function crazyLeaderboardPanelValues(
  leaderboard: CrazyLeaderboard,
): readonly [number, number, number] {
  return recoveredLeaderboardPanelValues(leaderboard);
}

export function calculateCrazyResultCoinBonus(completedScore: number): number {
  return calculateRecoveredResultCoinBonus(
    completedScore,
    CRAZY_RESULT_COIN_FACTOR,
  );
}

export function awardCrazyResultCoins(
  currentTotalCoins: number,
  completedScore: number,
): CrazyResultCoinAward {
  return awardRecoveredResultCoins(
    currentTotalCoins,
    completedScore,
    CRAZY_RESULT_COIN_FACTOR,
  );
}
