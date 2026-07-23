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
  CRAZY_BIRD_BEST_1_STORAGE_KEY,
  CRAZY_BIRD_BEST_2_STORAGE_KEY,
  CRAZY_BIRD_BEST_3_STORAGE_KEY,
  CRAZY_BIRD_INITIAL_LEADERBOARD,
  CRAZY_BIRD_INITIAL_TOTAL_COINS,
  CRAZY_BIRD_RESULT_COIN_FACTOR,
  CRAZY_BIRD_RESULT_MODE_ID,
  awardCrazyBirdResultCoins,
  calculateCrazyBirdResultCoinBonus,
  crazyBirdLeaderboardPanelValues,
  insertCrazyBirdResultScore,
} = await import(
  '../../../game/assets/scripts/domain/crazy-bird-result-ranking.ts'
);

test('Crazy Bird result preserves mode 4 and its distinct Settings keys', () => {
  assert.equal(CRAZY_BIRD_RESULT_MODE_ID, 4);
  assert.equal(CRAZY_BIRD_BEST_1_STORAGE_KEY, 'bird_crazy_best_1');
  assert.equal(CRAZY_BIRD_BEST_2_STORAGE_KEY, 'bird_crazy_best_2');
  assert.equal(CRAZY_BIRD_BEST_3_STORAGE_KEY, 'bird_crazy_best_3');
  assert.deepEqual(
    CRAZY_BIRD_INITIAL_LEADERBOARD,
    { first: 0, second: 0, third: 0 },
  );
  assert.equal(CRAZY_BIRD_INITIAL_TOTAL_COINS, 2014);
});

test('Crazy Bird uses inclusive promotion for all three ranks', () => {
  const leaderboard = { first: 100, second: 80, third: 60 };
  assert.deepEqual(insertCrazyBirdResultScore(100, leaderboard), {
    achievedRank: 1,
    leaderboard: { first: 100, second: 100, third: 80 },
  });
  assert.deepEqual(insertCrazyBirdResultScore(90, leaderboard), {
    achievedRank: 2,
    leaderboard: { first: 100, second: 90, third: 80 },
  });
  assert.deepEqual(insertCrazyBirdResultScore(60, leaderboard), {
    achievedRank: 3,
    leaderboard: { first: 100, second: 80, third: 60 },
  });
  assert.deepEqual(insertCrazyBirdResultScore(59, leaderboard), {
    achievedRank: null,
    leaderboard,
  });
  assert.deepEqual(
    crazyBirdLeaderboardPanelValues({ first: 300, second: 200, third: 100 }),
    [300, 200, 100],
  );
});

test('Crazy Bird reward uses float32 0.8, truncation, and signed ARM addition', () => {
  assert.equal(CRAZY_BIRD_RESULT_COIN_FACTOR, Math.fround(0.8));
  assert.equal(calculateCrazyBirdResultCoinBonus(1), 0);
  assert.equal(calculateCrazyBirdResultCoinBonus(5), 4);
  assert.equal(calculateCrazyBirdResultCoinBonus(-5), -4);
  assert.deepEqual(awardCrazyBirdResultCoins(2014, 5), {
    bonusCoins: 4,
    totalCoins: 2018,
  });
  assert.deepEqual(awardCrazyBirdResultCoins(0x7fff_ffff, 2), {
    bonusCoins: 1,
    totalCoins: -0x8000_0000,
  });
});

test('Crazy Bird ranking rejects malformed state and out-of-range scores', () => {
  assert.throws(
    () => insertCrazyBirdResultScore(1, { first: 0, second: 1, third: 0 }),
    /ordered/,
  );
  assert.throws(
    () => insertCrazyBirdResultScore(1.5, CRAZY_BIRD_INITIAL_LEADERBOARD),
    /signed 32-bit/,
  );
  assert.throws(
    () => calculateCrazyBirdResultCoinBonus(0x8000_0000),
    /signed 32-bit/,
  );
});
