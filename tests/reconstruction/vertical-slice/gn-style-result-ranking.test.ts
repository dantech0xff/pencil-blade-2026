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
  GN_STYLE_BEST_1_STORAGE_KEY,
  GN_STYLE_BEST_2_STORAGE_KEY,
  GN_STYLE_BEST_3_STORAGE_KEY,
  GN_STYLE_INITIAL_LEADERBOARD,
  GN_STYLE_RESULT_COIN_FACTOR,
  GN_STYLE_RESULT_MODE_ID,
  awardGnStyleResultCoins,
  calculateGnStyleResultCoinBonus,
  gnStyleLeaderboardPanelValues,
  insertGnStyleResultScore,
} = await import(
  '../../../game/assets/scripts/domain/gn-style-result-ranking.ts'
);

test('GN Style result preserves mode 2, exact keys, and zero defaults', () => {
  assert.equal(GN_STYLE_RESULT_MODE_ID, 2);
  assert.equal(GN_STYLE_BEST_1_STORAGE_KEY, 'gnstyle_best_1');
  assert.equal(GN_STYLE_BEST_2_STORAGE_KEY, 'gnstyle_best_2');
  assert.equal(GN_STYLE_BEST_3_STORAGE_KEY, 'gnstyle_best_3');
  assert.deepEqual(
    GN_STYLE_INITIAL_LEADERBOARD,
    { first: 0, second: 0, third: 0 },
  );
});

test('GN Style uses inclusive promotion for all three ranks', () => {
  const leaderboard = { first: 100, second: 80, third: 60 };
  assert.deepEqual(insertGnStyleResultScore(100, leaderboard), {
    achievedRank: 1,
    leaderboard: { first: 100, second: 100, third: 80 },
  });
  assert.deepEqual(insertGnStyleResultScore(90, leaderboard), {
    achievedRank: 2,
    leaderboard: { first: 100, second: 90, third: 80 },
  });
  assert.deepEqual(insertGnStyleResultScore(60, leaderboard), {
    achievedRank: 3,
    leaderboard: { first: 100, second: 80, third: 60 },
  });
  assert.deepEqual(insertGnStyleResultScore(59, leaderboard), {
    achievedRank: null,
    leaderboard,
  });
  assert.deepEqual(
    gnStyleLeaderboardPanelValues({ first: 300, second: 200, third: 100 }),
    [300, 200, 100],
  );
});

test('GN Style reward uses float32 0.6, truncation, and signed ARM addition', () => {
  assert.equal(GN_STYLE_RESULT_COIN_FACTOR, Math.fround(0.6));
  assert.equal(calculateGnStyleResultCoinBonus(1), 0);
  assert.equal(calculateGnStyleResultCoinBonus(5), 3);
  assert.equal(calculateGnStyleResultCoinBonus(-5), -3);
  assert.deepEqual(awardGnStyleResultCoins(999_999, 5), {
    bonusCoins: 3,
    totalCoins: 1_000_002,
  });
  assert.deepEqual(awardGnStyleResultCoins(0x7fff_ffff, 2), {
    bonusCoins: 1,
    totalCoins: -0x8000_0000,
  });
});

test('GN Style ranking rejects malformed state and out-of-range scores', () => {
  assert.throws(
    () => insertGnStyleResultScore(1, { first: 0, second: 1, third: 0 }),
    /ordered/,
  );
  assert.throws(
    () => insertGnStyleResultScore(1.5, GN_STYLE_INITIAL_LEADERBOARD),
    /signed 32-bit/,
  );
  assert.throws(
    () => calculateGnStyleResultCoinBonus(0x8000_0000),
    /signed 32-bit/,
  );
});
