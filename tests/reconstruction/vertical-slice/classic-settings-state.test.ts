import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

import type {
  ClassicInt32PreferencePort,
} from '../../../game/assets/scripts/domain/classic-settings-state.ts';

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
  CLASSIC_BEST_1_STORAGE_KEY,
  CLASSIC_BEST_2_STORAGE_KEY,
  CLASSIC_BEST_3_STORAGE_KEY,
  CLASSIC_TOTAL_COINS_STORAGE_KEY,
  ClassicSettingsState,
} = await import('../../../game/assets/scripts/domain/classic-settings-state.ts');

class RecordingPort implements ClassicInt32PreferencePort {
  readonly reads: Array<readonly [string, number]> = [];
  readonly writes: Array<readonly [string, number]> = [];
  private readonly values: Readonly<Record<string, number>>;

  constructor(values: Readonly<Record<string, number>> = {}) {
    this.values = values;
  }

  readInt32(key: string, defaultValue: number): number {
    this.reads.push([key, defaultValue]);
    return this.values[key] ?? defaultValue;
  }

  writeInt32(key: string, value: number): void {
    this.writes.push([key, value]);
  }
}

const RECOVERED_READS = [
  [CLASSIC_TOTAL_COINS_STORAGE_KEY, 2014],
  [CLASSIC_BEST_1_STORAGE_KEY, 0],
  [CLASSIC_BEST_2_STORAGE_KEY, 0],
  [CLASSIC_BEST_3_STORAGE_KEY, 0],
] as const;

test('Classic settings load exact keys and defaults in recovered relative order', () => {
  const port = new RecordingPort();
  const state = ClassicSettingsState.load(port);

  assert.deepEqual(port.reads, RECOVERED_READS);
  assert.deepEqual(state.snapshot, {
    leaderboard: { first: 0, second: 0, third: 0 },
    totalCoins: 2014,
  });
  assert.equal(Object.isFrozen(state.snapshot), true);
  assert.equal(Object.isFrozen(state.snapshot.leaderboard), true);
});

test('loaded first place seeds the shared Classic leaderboard baseline', () => {
  const state = ClassicSettingsState.load(new RecordingPort({
    [CLASSIC_TOTAL_COINS_STORAGE_KEY]: 900,
    [CLASSIC_BEST_1_STORAGE_KEY]: 30,
    [CLASSIC_BEST_2_STORAGE_KEY]: 20,
    [CLASSIC_BEST_3_STORAGE_KEY]: 10,
  }));

  assert.deepEqual(state.snapshot, {
    leaderboard: { first: 30, second: 20, third: 10 },
    totalCoins: 900,
  });
  assert.deepEqual(state.recordClassicResultScore(25), {
    achievedRank: 2,
    leaderboard: { first: 30, second: 25, third: 20 },
  });
});

test('result mutations remain memory-only until explicit save checkpoint', () => {
  const port = new RecordingPort();
  const state = ClassicSettingsState.load(port);

  state.recordClassicResultScore(40);
  assert.deepEqual(state.awardClassicResultCoins(40), {
    bonusCoins: 24,
    totalCoins: 2038,
  });
  assert.deepEqual(port.writes, []);

  state.save(port);
  assert.deepEqual(port.writes, [
    [CLASSIC_TOTAL_COINS_STORAGE_KEY, 2038],
    [CLASSIC_BEST_1_STORAGE_KEY, 40],
    [CLASSIC_BEST_2_STORAGE_KEY, 0],
    [CLASSIC_BEST_3_STORAGE_KEY, 0],
  ]);
});

test('coin award preserves native signed-int32 wrapping', () => {
  const state = ClassicSettingsState.load(new RecordingPort({
    [CLASSIC_TOTAL_COINS_STORAGE_KEY]: 0x7fff_ffff,
  }));

  assert.deepEqual(state.awardClassicResultCoins(2), {
    bonusCoins: 1,
    totalCoins: -0x8000_0000,
  });
});

test('settings reject invalid ports, values, and unordered persisted rankings', () => {
  assert.throws(
    () => ClassicSettingsState.load(null as never),
    /must provide int32 read and write operations/,
  );
  assert.throws(
    () => ClassicSettingsState.load(new RecordingPort({
      [CLASSIC_TOTAL_COINS_STORAGE_KEY]: 0x8000_0000,
    })),
    /totalCoins must be a signed 32-bit integer/,
  );
  assert.throws(
    () => ClassicSettingsState.load(new RecordingPort({
      [CLASSIC_BEST_1_STORAGE_KEY]: 1,
      [CLASSIC_BEST_2_STORAGE_KEY]: 3,
      [CLASSIC_BEST_3_STORAGE_KEY]: 2,
    })),
    /leaderboard must remain ordered/,
  );
});
