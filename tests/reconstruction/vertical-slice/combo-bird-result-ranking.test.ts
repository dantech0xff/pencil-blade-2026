import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

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
  COMBO_BIRD_BEST_1_STORAGE_KEY,
  COMBO_BIRD_BEST_2_STORAGE_KEY,
  COMBO_BIRD_BEST_3_STORAGE_KEY,
  COMBO_BIRD_INITIAL_LEADERBOARD,
  COMBO_BIRD_INITIAL_TOTAL_COINS,
  COMBO_BIRD_RESULT_COIN_FACTOR,
  COMBO_BIRD_RESULT_MODE_ID,
  awardComboBirdResultCoins,
  calculateComboBirdResultCoinBonus,
  comboBirdLeaderboardPanelValues,
  insertComboBirdResultScore,
} = await import(
  '../../../game/assets/scripts/domain/combo-bird-result-ranking.ts'
);

test('Combo Bird result preserves mode 5 and its distinct Settings keys', () => {
  assert.equal(COMBO_BIRD_RESULT_MODE_ID, 5);
  assert.equal(COMBO_BIRD_BEST_1_STORAGE_KEY, 'bird_combo_best_1');
  assert.equal(COMBO_BIRD_BEST_2_STORAGE_KEY, 'bird_combo_best_2');
  assert.equal(COMBO_BIRD_BEST_3_STORAGE_KEY, 'bird_combo_best_3');
  assert.deepEqual(
    COMBO_BIRD_INITIAL_LEADERBOARD,
    { first: 0, second: 0, third: 0 },
  );
  assert.equal(COMBO_BIRD_INITIAL_TOTAL_COINS, 2014);
});

test('Combo Bird uses inclusive promotion for all three ranks', () => {
  const leaderboard = { first: 100, second: 80, third: 60 };
  assert.deepEqual(insertComboBirdResultScore(100, leaderboard), {
    achievedRank: 1,
    leaderboard: { first: 100, second: 100, third: 80 },
  });
  assert.deepEqual(insertComboBirdResultScore(90, leaderboard), {
    achievedRank: 2,
    leaderboard: { first: 100, second: 90, third: 80 },
  });
  assert.deepEqual(insertComboBirdResultScore(60, leaderboard), {
    achievedRank: 3,
    leaderboard: { first: 100, second: 80, third: 60 },
  });
  assert.deepEqual(insertComboBirdResultScore(59, leaderboard), {
    achievedRank: null,
    leaderboard,
  });
  assert.deepEqual(
    comboBirdLeaderboardPanelValues({ first: 300, second: 200, third: 100 }),
    [300, 200, 100],
  );
});

test('Combo Bird reward uses float32 0.8, truncation, and signed ARM addition', () => {
  assert.equal(COMBO_BIRD_RESULT_COIN_FACTOR, Math.fround(0.8));
  assert.equal(calculateComboBirdResultCoinBonus(1), 0);
  assert.equal(calculateComboBirdResultCoinBonus(5), 4);
  assert.equal(calculateComboBirdResultCoinBonus(-5), -4);
  assert.deepEqual(awardComboBirdResultCoins(2014, 5), {
    bonusCoins: 4,
    totalCoins: 2018,
  });
  assert.deepEqual(awardComboBirdResultCoins(0x7fff_ffff, 2), {
    bonusCoins: 1,
    totalCoins: -0x8000_0000,
  });
});

test('Combo Bird ranking rejects malformed state and out-of-range scores', () => {
  assert.throws(
    () => insertComboBirdResultScore(1, { first: 0, second: 1, third: 0 }),
    /ordered/,
  );
  assert.throws(
    () => insertComboBirdResultScore(1.5, COMBO_BIRD_INITIAL_LEADERBOARD),
    /signed 32-bit/,
  );
  assert.throws(
    () => calculateComboBirdResultCoinBonus(0x8000_0000),
    /signed 32-bit/,
  );
});
