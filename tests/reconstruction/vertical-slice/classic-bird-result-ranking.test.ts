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
  CLASSIC_BIRD_BEST_1_STORAGE_KEY,
  CLASSIC_BIRD_BEST_2_STORAGE_KEY,
  CLASSIC_BIRD_BEST_3_STORAGE_KEY,
  CLASSIC_BIRD_INITIAL_LEADERBOARD,
  CLASSIC_BIRD_INITIAL_TOTAL_COINS,
  CLASSIC_BIRD_RESULT_COIN_FACTOR,
  CLASSIC_BIRD_RESULT_MODE_ID,
  awardClassicBirdResultCoins,
  calculateClassicBirdResultCoinBonus,
  classicBirdLeaderboardPanelValues,
  insertClassicBirdResultScore,
} = await import(
  '../../../game/assets/scripts/domain/classic-bird-result-ranking.ts'
);

test('Classic Bird result preserves mode 3 and its distinct Settings keys', () => {
  assert.equal(CLASSIC_BIRD_RESULT_MODE_ID, 3);
  assert.equal(CLASSIC_BIRD_BEST_1_STORAGE_KEY, 'bird_classic_best_1');
  assert.equal(CLASSIC_BIRD_BEST_2_STORAGE_KEY, 'bird_classic_best_2');
  assert.equal(CLASSIC_BIRD_BEST_3_STORAGE_KEY, 'bird_classic_best_3');
  assert.deepEqual(
    CLASSIC_BIRD_INITIAL_LEADERBOARD,
    { first: 0, second: 0, third: 0 },
  );
  assert.equal(CLASSIC_BIRD_INITIAL_TOTAL_COINS, 2014);
});

test('Classic Bird uses inclusive promotion for all three ranks', () => {
  const leaderboard = { first: 100, second: 80, third: 60 };
  assert.deepEqual(insertClassicBirdResultScore(100, leaderboard), {
    achievedRank: 1,
    leaderboard: { first: 100, second: 100, third: 80 },
  });
  assert.deepEqual(insertClassicBirdResultScore(90, leaderboard), {
    achievedRank: 2,
    leaderboard: { first: 100, second: 90, third: 80 },
  });
  assert.deepEqual(insertClassicBirdResultScore(60, leaderboard), {
    achievedRank: 3,
    leaderboard: { first: 100, second: 80, third: 60 },
  });
  assert.deepEqual(insertClassicBirdResultScore(59, leaderboard), {
    achievedRank: null,
    leaderboard,
  });
  assert.deepEqual(
    classicBirdLeaderboardPanelValues({ first: 300, second: 200, third: 100 }),
    [300, 200, 100],
  );
});

test('Classic Bird reward uses float32 0.8, truncation, and signed ARM addition', () => {
  assert.equal(CLASSIC_BIRD_RESULT_COIN_FACTOR, Math.fround(0.8));
  assert.equal(calculateClassicBirdResultCoinBonus(1), 0);
  assert.equal(calculateClassicBirdResultCoinBonus(5), 4);
  assert.equal(calculateClassicBirdResultCoinBonus(-5), -4);
  assert.deepEqual(awardClassicBirdResultCoins(2014, 5), {
    bonusCoins: 4,
    totalCoins: 2018,
  });
  assert.deepEqual(awardClassicBirdResultCoins(0x7fff_ffff, 2), {
    bonusCoins: 1,
    totalCoins: -0x8000_0000,
  });
});

test('Classic Bird ranking rejects malformed state and out-of-range scores', () => {
  assert.throws(
    () => insertClassicBirdResultScore(1, { first: 0, second: 1, third: 0 }),
    /ordered/,
  );
  assert.throws(
    () => insertClassicBirdResultScore(1.5, CLASSIC_BIRD_INITIAL_LEADERBOARD),
    /signed 32-bit/,
  );
  assert.throws(
    () => calculateClassicBirdResultCoinBonus(0x8000_0000),
    /signed 32-bit/,
  );
});
