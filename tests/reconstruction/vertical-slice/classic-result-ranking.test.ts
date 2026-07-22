import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLASSIC_INITIAL_LEADERBOARD,
  CLASSIC_INITIAL_TOTAL_COINS,
  CLASSIC_RESULT_COIN_FACTOR,
  calculateClassicResultCoinBonus,
  classicLeaderboardPanelValues,
  insertClassicResultScore,
} from '../../../game/assets/scripts/domain/classic-result-ranking.ts';

test('Classic result inserts first, second, and third place with recovered shifting', () => {
  assert.deepEqual(insertClassicResultScore(120, {
    first: 100,
    second: 80,
    third: 60,
  }), {
    achievedRank: 1,
    leaderboard: { first: 120, second: 100, third: 80 },
  });
  assert.deepEqual(insertClassicResultScore(90, {
    first: 100,
    second: 80,
    third: 60,
  }), {
    achievedRank: 2,
    leaderboard: { first: 100, second: 90, third: 80 },
  });
  assert.deepEqual(insertClassicResultScore(70, {
    first: 100,
    second: 80,
    third: 60,
  }), {
    achievedRank: 3,
    leaderboard: { first: 100, second: 80, third: 70 },
  });
});

test('Classic rank comparisons use >= while scores below third place do not mutate', () => {
  const leaderboard = { first: 100, second: 80, third: 60 };
  assert.deepEqual(insertClassicResultScore(100, leaderboard), {
    achievedRank: 1,
    leaderboard: { first: 100, second: 100, third: 80 },
  });
  assert.deepEqual(insertClassicResultScore(80, leaderboard), {
    achievedRank: 2,
    leaderboard: { first: 100, second: 80, third: 80 },
  });
  assert.deepEqual(insertClassicResultScore(60, leaderboard), {
    achievedRank: 3,
    leaderboard: { first: 100, second: 80, third: 60 },
  });
  assert.deepEqual(insertClassicResultScore(59, leaderboard), {
    achievedRank: null,
    leaderboard,
  });
});

test('first-run zero defaults promote zero and panel values follow Best_1, Best_3, Best_2', () => {
  const result = insertClassicResultScore(0, CLASSIC_INITIAL_LEADERBOARD);
  assert.equal(result.achievedRank, 1);
  assert.deepEqual(result.leaderboard, { first: 0, second: 0, third: 0 });
  assert.deepEqual(classicLeaderboardPanelValues({
    first: 300,
    second: 200,
    third: 100,
  }), [300, 100, 200]);
});

test('Classic leaderboard rejects unsafe or unordered state', () => {
  assert.throws(
    () => insertClassicResultScore(1.5, CLASSIC_INITIAL_LEADERBOARD),
    RangeError,
  );
  assert.throws(
    () => insertClassicResultScore(1, null as never),
    TypeError,
  );
  assert.throws(
    () => insertClassicResultScore(1, { first: 0, second: 1, third: 0 }),
    RangeError,
  );
  assert.throws(
    () => classicLeaderboardPanelValues({ first: 3, second: 2, third: Number.NaN }),
    RangeError,
  );
});

test('Classic result coin callback keeps the recovered default and float32 60% truncation', () => {
  assert.equal(CLASSIC_INITIAL_TOTAL_COINS, 2014);
  assert.equal(CLASSIC_RESULT_COIN_FACTOR, Math.fround(0.6));
  assert.equal(calculateClassicResultCoinBonus(0), 0);
  assert.equal(calculateClassicResultCoinBonus(1), 0);
  assert.equal(calculateClassicResultCoinBonus(5), 3);
  assert.equal(calculateClassicResultCoinBonus(-5), -3);
  assert.throws(() => calculateClassicResultCoinBonus(0x8000_0000), RangeError);
});
