import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  CRAZY_BEST_1_STORAGE_KEY,
  CRAZY_BEST_2_STORAGE_KEY,
  CRAZY_BEST_3_STORAGE_KEY,
  CRAZY_INITIAL_LEADERBOARD,
  CRAZY_INITIAL_TOTAL_COINS,
  CRAZY_RESULT_COIN_FACTOR,
  CRAZY_RESULT_MODE_ID,
  awardCrazyResultCoins,
  calculateCrazyResultCoinBonus,
  crazyLeaderboardPanelValues,
  insertCrazyResultScore,
} = await import('../../../game/assets/scripts/domain/crazy-result-ranking.ts');
const {
  RECOVERED_RESULT_COIN_FACTOR_HIGH,
  awardRecoveredResultCoins,
  calculateRecoveredResultCoinBonus,
} = await import('../../../game/assets/scripts/domain/recovered-result-ranking.ts');

test('Crazy result is mode 1 with distinct recovered best-score keys', () => {
  assert.equal(CRAZY_RESULT_MODE_ID, 1);
  assert.equal(CRAZY_BEST_1_STORAGE_KEY, 'crazy_best_1');
  assert.equal(CRAZY_BEST_2_STORAGE_KEY, 'crazy_best_2');
  assert.equal(CRAZY_BEST_3_STORAGE_KEY, 'crazy_best_3');
  assert.deepEqual(CRAZY_INITIAL_LEADERBOARD, { first: 0, second: 0, third: 0 });
  assert.equal(CRAZY_INITIAL_TOTAL_COINS, 2014);
});

test('Crazy preserves the recovered >= first, second, and third insertion branches', () => {
  const leaderboard = { first: 100, second: 80, third: 60 };
  assert.deepEqual(insertCrazyResultScore(100, leaderboard), {
    achievedRank: 1,
    leaderboard: { first: 100, second: 100, third: 80 },
  });
  assert.deepEqual(insertCrazyResultScore(90, leaderboard), {
    achievedRank: 2,
    leaderboard: { first: 100, second: 90, third: 80 },
  });
  assert.deepEqual(insertCrazyResultScore(60, leaderboard), {
    achievedRank: 3,
    leaderboard: { first: 100, second: 80, third: 60 },
  });
  assert.deepEqual(insertCrazyResultScore(59, leaderboard), {
    achievedRank: null,
    leaderboard,
  });
  assert.deepEqual(
    crazyLeaderboardPanelValues({ first: 300, second: 200, third: 100 }),
    [300, 200, 100],
  );
});

test('Crazy mode uses float32 0.6 reward and signed int32 addition', () => {
  assert.equal(CRAZY_RESULT_COIN_FACTOR, Math.fround(0.6));
  assert.equal(calculateCrazyResultCoinBonus(1), 0);
  assert.equal(calculateCrazyResultCoinBonus(5), 3);
  assert.equal(calculateCrazyResultCoinBonus(-5), -3);
  assert.deepEqual(awardCrazyResultCoins(2014, 5), {
    bonusCoins: 3,
    totalCoins: 2017,
  });
  assert.deepEqual(awardCrazyResultCoins(0x7fff_ffff, 2), {
    bonusCoins: 1,
    totalCoins: -0x8000_0000,
  });
});

test('shared reward primitive retains the separate 0.8 branches for modes 3 through 5', () => {
  assert.equal(RECOVERED_RESULT_COIN_FACTOR_HIGH, Math.fround(0.8));
  assert.equal(
    calculateRecoveredResultCoinBonus(5, RECOVERED_RESULT_COIN_FACTOR_HIGH),
    4,
  );
  assert.deepEqual(
    awardRecoveredResultCoins(2014, 5, RECOVERED_RESULT_COIN_FACTOR_HIGH),
    { bonusCoins: 4, totalCoins: 2018 },
  );
  assert.throws(
    () => calculateRecoveredResultCoinBonus(5, 0.7),
    /0\.6 or 0\.8/,
  );
});

test('ranking and reward reject malformed or out-of-range state without mutation', () => {
  assert.throws(
    () => insertCrazyResultScore(1, { first: 0, second: 1, third: 0 }),
    /ordered/,
  );
  assert.throws(
    () => insertCrazyResultScore(1.5, CRAZY_INITIAL_LEADERBOARD),
    /signed 32-bit/,
  );
  assert.throws(
    () => calculateCrazyResultCoinBonus(0x8000_0000),
    /signed 32-bit/,
  );
});

test('Crazy ranking modules have no Creator dependency', () => {
  for (const path of [
    '../../../game/assets/scripts/domain/crazy-result-ranking.ts',
    '../../../game/assets/scripts/domain/recovered-result-ranking.ts',
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /from\s+['"]cc['"]/);
  }
});
