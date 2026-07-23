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

export const CLASSIC_BIRD_RESULT_MODE_ID = 3 as const;
export const CLASSIC_BIRD_BEST_1_STORAGE_KEY = 'bird_classic_best_1' as const;
export const CLASSIC_BIRD_BEST_2_STORAGE_KEY = 'bird_classic_best_2' as const;
export const CLASSIC_BIRD_BEST_3_STORAGE_KEY = 'bird_classic_best_3' as const;

export type ClassicBirdResultRank = RecoveredResultRank;
export type ClassicBirdLeaderboard = RecoveredLeaderboard;
export type ClassicBirdLeaderboardUpdate = RecoveredLeaderboardUpdate;
export type ClassicBirdResultCoinAward = RecoveredResultCoinAward;

export const CLASSIC_BIRD_INITIAL_LEADERBOARD: ClassicBirdLeaderboard
  = RECOVERED_INITIAL_LEADERBOARD;
export const CLASSIC_BIRD_INITIAL_TOTAL_COINS = RECOVERED_INITIAL_TOTAL_COINS;
export const CLASSIC_BIRD_RESULT_COIN_FACTOR = RECOVERED_RESULT_COIN_FACTOR_HIGH;

export function insertClassicBirdResultScore(
  completedScore: number,
  current: ClassicBirdLeaderboard,
): ClassicBirdLeaderboardUpdate {
  return insertRecoveredResultScore(completedScore, current);
}

export function classicBirdLeaderboardPanelValues(
  leaderboard: ClassicBirdLeaderboard,
): readonly [number, number, number] {
  return recoveredLeaderboardPanelValues(leaderboard);
}

export function calculateClassicBirdResultCoinBonus(
  completedScore: number,
): number {
  return calculateRecoveredResultCoinBonus(
    completedScore,
    CLASSIC_BIRD_RESULT_COIN_FACTOR,
  );
}

export function awardClassicBirdResultCoins(
  currentTotalCoins: number,
  completedScore: number,
): ClassicBirdResultCoinAward {
  return awardRecoveredResultCoins(
    currentTotalCoins,
    completedScore,
    CLASSIC_BIRD_RESULT_COIN_FACTOR,
  );
}
