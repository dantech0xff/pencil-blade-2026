import {
  RECOVERED_INITIAL_LEADERBOARD,
  RECOVERED_INITIAL_TOTAL_COINS,
  RECOVERED_RESULT_COIN_FACTOR_HIGH,
  awardRecoveredResultCoins,
  calculateRecoveredResultCoinBonus,
  insertRecoveredResultScore,
  recoveredLeaderboardPanelValues,
  type RecoveredLeaderboard,
  type RecoveredLeaderboardUpdate,
  type RecoveredResultCoinAward,
  type RecoveredResultRank,
} from './recovered-result-ranking';

export const CRAZY_BIRD_RESULT_MODE_ID = 4 as const;
export const CRAZY_BIRD_BEST_1_STORAGE_KEY = 'bird_crazy_best_1' as const;
export const CRAZY_BIRD_BEST_2_STORAGE_KEY = 'bird_crazy_best_2' as const;
export const CRAZY_BIRD_BEST_3_STORAGE_KEY = 'bird_crazy_best_3' as const;

export type CrazyBirdResultRank = RecoveredResultRank;
export type CrazyBirdLeaderboard = RecoveredLeaderboard;
export type CrazyBirdLeaderboardUpdate = RecoveredLeaderboardUpdate;
export type CrazyBirdResultCoinAward = RecoveredResultCoinAward;

export const CRAZY_BIRD_INITIAL_LEADERBOARD: CrazyBirdLeaderboard
  = RECOVERED_INITIAL_LEADERBOARD;
export const CRAZY_BIRD_INITIAL_TOTAL_COINS = RECOVERED_INITIAL_TOTAL_COINS;
export const CRAZY_BIRD_RESULT_COIN_FACTOR = RECOVERED_RESULT_COIN_FACTOR_HIGH;

export function insertCrazyBirdResultScore(
  completedScore: number,
  current: CrazyBirdLeaderboard,
): CrazyBirdLeaderboardUpdate {
  return insertRecoveredResultScore(completedScore, current);
}

export function crazyBirdLeaderboardPanelValues(
  leaderboard: CrazyBirdLeaderboard,
): readonly [number, number, number] {
  return recoveredLeaderboardPanelValues(leaderboard);
}

export function calculateCrazyBirdResultCoinBonus(
  completedScore: number,
): number {
  return calculateRecoveredResultCoinBonus(
    completedScore,
    CRAZY_BIRD_RESULT_COIN_FACTOR,
  );
}

export function awardCrazyBirdResultCoins(
  currentTotalCoins: number,
  completedScore: number,
): CrazyBirdResultCoinAward {
  return awardRecoveredResultCoins(
    currentTotalCoins,
    completedScore,
    CRAZY_BIRD_RESULT_COIN_FACTOR,
  );
}
