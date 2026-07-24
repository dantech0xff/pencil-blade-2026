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

export const GN_STYLE_RESULT_MODE_ID = 2 as const;
export const GN_STYLE_BEST_1_STORAGE_KEY = 'gnstyle_best_1' as const;
export const GN_STYLE_BEST_2_STORAGE_KEY = 'gnstyle_best_2' as const;
export const GN_STYLE_BEST_3_STORAGE_KEY = 'gnstyle_best_3' as const;

export type GnStyleResultRank = RecoveredResultRank;
export type GnStyleLeaderboard = RecoveredLeaderboard;
export type GnStyleLeaderboardUpdate = RecoveredLeaderboardUpdate;
export type GnStyleResultCoinAward = RecoveredResultCoinAward;

export const GN_STYLE_INITIAL_LEADERBOARD: GnStyleLeaderboard
  = RECOVERED_INITIAL_LEADERBOARD;
export const GN_STYLE_INITIAL_TOTAL_COINS = RECOVERED_INITIAL_TOTAL_COINS;
export const GN_STYLE_RESULT_COIN_FACTOR = RECOVERED_RESULT_COIN_FACTOR_LOW;

export function insertGnStyleResultScore(
  completedScore: number,
  current: GnStyleLeaderboard,
): GnStyleLeaderboardUpdate {
  return insertRecoveredResultScore(completedScore, current);
}

export function gnStyleLeaderboardPanelValues(
  leaderboard: GnStyleLeaderboard,
): readonly [number, number, number] {
  return recoveredLeaderboardPanelValues(leaderboard);
}

export function calculateGnStyleResultCoinBonus(
  completedScore: number,
): number {
  return calculateRecoveredResultCoinBonus(
    completedScore,
    GN_STYLE_RESULT_COIN_FACTOR,
  );
}

export function awardGnStyleResultCoins(
  currentTotalCoins: number,
  completedScore: number,
): GnStyleResultCoinAward {
  return awardRecoveredResultCoins(
    currentTotalCoins,
    completedScore,
    GN_STYLE_RESULT_COIN_FACTOR,
  );
}
