import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMBO_BIRD_CONCURRENT_OUTER_INTERVAL,
  COMBO_BIRD_FREE_OUTER_INTERVAL,
  COMBO_BIRD_MODE_ID,
  COMBO_BIRD_TOSS_CREATION_ORDER,
  COMBO_BIRD_TOSS_OUTER_STOP_ORDER,
  COMBO_BIRD_TOSS_ROWS,
  COMBO_BIRD_TOSS_START_ORDER,
  COMBO_BIRD_WAVE_ACTIVE_WINDOW,
  COMBO_BIRD_WAVE_ACTIVE_WINDOW_MAX_SAMPLE_SECONDS,
  COMBO_BIRD_WAVE_CHILD_INTERVAL,
  COMBO_BIRD_WAVE_OUTER_INTERVAL,
  getComboBirdTossRow,
} from '../../../game/assets/scripts/domain/combo-bird-toss-config.ts';
import {
  sampleTossInterval,
} from '../../../game/assets/scripts/domain/toss-timer.ts';

test('Combo Bird fixes mode 5 and the exact three ordinary outer slots', () => {
  assert.equal(COMBO_BIRD_MODE_ID, 5);
  assert.deepEqual(COMBO_BIRD_TOSS_CREATION_ORDER, [
    'free', 'wave', 'concurrent',
  ]);
  assert.equal(
    COMBO_BIRD_TOSS_START_ORDER,
    COMBO_BIRD_TOSS_CREATION_ORDER,
  );
  assert.equal(
    COMBO_BIRD_TOSS_OUTER_STOP_ORDER,
    COMBO_BIRD_TOSS_CREATION_ORDER,
  );
  assert.deepEqual(COMBO_BIRD_TOSS_ROWS.map((row) => ({
    controller: row.controller,
    direction: row.direction,
    id: row.id,
    objectType: row.objectType,
    slotOffset: row.slotOffset,
    zOrder: row.zOrder,
  })), [
    {
      controller: 'free',
      direction: 0,
      id: 'free',
      objectType: 0,
      slotOffset: 0x2a8,
      zOrder: 1,
    },
    {
      controller: 'wave',
      direction: 0,
      id: 'wave',
      objectType: 0,
      slotOffset: 0x2ac,
      zOrder: 1,
    },
    {
      controller: 'concurrent',
      direction: 0,
      id: 'concurrent',
      objectType: 0,
      slotOffset: 0x2b0,
      zOrder: 1,
    },
  ]);
  assert.deepEqual(getComboBirdTossRow('free').outerInterval, {
    highSeconds: 5,
    lowSeconds: 0.75,
  });
  assert.deepEqual(getComboBirdTossRow('wave').outerInterval, {
    highSeconds: 20,
    lowSeconds: 7.5,
  });
  assert.deepEqual(getComboBirdTossRow('concurrent').outerInterval, {
    highSeconds: 25,
    lowSeconds: 10,
  });
  assert.throws(
    () => getComboBirdTossRow('bomb' as never),
    /unknown Combo Bird controller/,
  );
});

test('Concurrent keeps constructor bounds 1..3 separate from actual 1..4 output', () => {
  const row = getComboBirdTossRow('concurrent');
  if (row.controller !== 'concurrent') {
    throw new Error('expected concurrent row');
  }
  assert.deepEqual({
    actualCountMaxInclusive: row.actualCountMaxInclusive,
    actualCountMinInclusive: row.actualCountMinInclusive,
    countMax: row.countMax,
    countMin: row.countMin,
  }, {
    actualCountMaxInclusive: 4,
    actualCountMinInclusive: 1,
    countMax: 3,
    countMin: 1,
  });
});

test('all recovered decile grids preserve float32 sampling and the 2.85s Wave maximum', () => {
  assert.deepEqual(sampleGrid(COMBO_BIRD_FREE_OUTER_INTERVAL), [
    0.75, 1.175, 1.6, 2.025, 2.45, 2.875, 3.3, 3.725, 4.15, 4.575,
  ]);
  assert.deepEqual(sampleGrid(COMBO_BIRD_WAVE_OUTER_INTERVAL), [
    7.5, 8.75, 10, 11.25, 12.5, 13.75, 15, 16.25, 17.5, 18.75,
  ]);
  assert.deepEqual(sampleGrid(COMBO_BIRD_CONCURRENT_OUTER_INTERVAL), [
    10, 11.5, 13, 14.5, 16, 17.5, 19, 20.5, 22, 23.5,
  ]);
  assert.deepEqual(sampleGrid(COMBO_BIRD_WAVE_CHILD_INTERVAL), [
    0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7,
  ]);
  assert.deepEqual(sampleGrid(COMBO_BIRD_WAVE_ACTIVE_WINDOW), [
    1.5, 1.65, 1.8, 1.95, 2.1, 2.25, 2.4, 2.55, 2.7, 2.85,
  ]);
  assert.equal(
    COMBO_BIRD_WAVE_ACTIVE_WINDOW_MAX_SAMPLE_SECONDS,
    sampleTossInterval(
      scriptedDecile(0.9),
      COMBO_BIRD_WAVE_ACTIVE_WINDOW.lowSeconds,
      COMBO_BIRD_WAVE_ACTIVE_WINDOW.highSeconds,
    ),
  );
  assert.equal(
    COMBO_BIRD_WAVE_ACTIVE_WINDOW_MAX_SAMPLE_SECONDS
      < COMBO_BIRD_WAVE_ACTIVE_WINDOW.highSeconds,
    true,
  );
});

test('config rows and nested intervals are immutable', () => {
  assert.equal(Object.isFrozen(COMBO_BIRD_TOSS_ROWS), true);
  assert.equal(COMBO_BIRD_TOSS_ROWS.every(Object.isFrozen), true);
  assert.equal(Object.isFrozen(COMBO_BIRD_FREE_OUTER_INTERVAL), true);
  assert.equal(Object.isFrozen(COMBO_BIRD_WAVE_CHILD_INTERVAL), true);
});

function sampleGrid(interval: {
  readonly highSeconds: number;
  readonly lowSeconds: number;
}): readonly number[] {
  return Object.freeze(Array.from({ length: 10 }, (_, index) => {
    const value = sampleTossInterval(
      scriptedDecile(index / 10),
      interval.lowSeconds,
      interval.highSeconds,
    );
    return Number(value.toFixed(3));
  }));
}

function scriptedDecile(value: number): { nextDecile(): number } {
  return { nextDecile: () => value };
}
