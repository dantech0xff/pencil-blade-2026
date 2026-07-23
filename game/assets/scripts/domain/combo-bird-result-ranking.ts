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

export const COMBO_BIRD_RESULT_MODE_ID = 5 as const;
export const COMBO_BIRD_BEST_1_STORAGE_KEY = 'bird_combo_best_1' as const;
export const COMBO_BIRD_BEST_2_STORAGE_KEY = 'bird_combo_best_2' as const;
export const COMBO_BIRD_BEST_3_STORAGE_KEY = 'bird_combo_best_3' as const;

export type ComboBirdResultRank = RecoveredResultRank;
export type ComboBirdLeaderboard = RecoveredLeaderboard;
export type ComboBirdLeaderboardUpdate = RecoveredLeaderboardUpdate;
export type ComboBirdResultCoinAward = RecoveredResultCoinAward;

export const COMBO_BIRD_INITIAL_LEADERBOARD: ComboBirdLeaderboard
  = RECOVERED_INITIAL_LEADERBOARD;
export const COMBO_BIRD_INITIAL_TOTAL_COINS = RECOVERED_INITIAL_TOTAL_COINS;
export const COMBO_BIRD_RESULT_COIN_FACTOR = RECOVERED_RESULT_COIN_FACTOR_HIGH;

export function insertComboBirdResultScore(
  completedScore: number,
  current: ComboBirdLeaderboard,
): ComboBirdLeaderboardUpdate {
  return insertRecoveredResultScore(completedScore, current);
}

export function comboBirdLeaderboardPanelValues(
  leaderboard: ComboBirdLeaderboard,
): readonly [number, number, number] {
  return recoveredLeaderboardPanelValues(leaderboard);
}

export function calculateComboBirdResultCoinBonus(
  completedScore: number,
): number {
  return calculateRecoveredResultCoinBonus(
    completedScore,
    COMBO_BIRD_RESULT_COIN_FACTOR,
  );
}

export function awardComboBirdResultCoins(
  currentTotalCoins: number,
  completedScore: number,
): ComboBirdResultCoinAward {
  return awardRecoveredResultCoins(
    currentTotalCoins,
    completedScore,
    COMBO_BIRD_RESULT_COIN_FACTOR,
  );
}
