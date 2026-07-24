import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GN_STYLE_CONCURRENT_OUTER_INTERVAL,
  GN_STYLE_FREE_OUTER_INTERVAL,
  GN_STYLE_MODE_ID,
  GN_STYLE_TOSS_CREATION_ORDER,
  GN_STYLE_TOSS_OUTER_STOP_ORDER,
  GN_STYLE_TOSS_ROWS,
  GN_STYLE_TOSS_START_ORDER,
  GN_STYLE_WAVE_ACTIVE_WINDOW,
  GN_STYLE_WAVE_ACTIVE_WINDOW_MAX_SAMPLE_SECONDS,
  GN_STYLE_WAVE_CHILD_INTERVAL,
  GN_STYLE_WAVE_OUTER_INTERVAL,
  getGnStyleTossRow,
} from '../../../game/assets/scripts/domain/gn-style-toss-config.ts';
import {
  sampleTossInterval,
} from '../../../game/assets/scripts/domain/toss-timer.ts';

test('GN Style fixes mode 2 and the exact three ordinary outer slots', () => {
  assert.equal(GN_STYLE_MODE_ID, 2);
  assert.deepEqual(GN_STYLE_TOSS_CREATION_ORDER, [
    'free', 'wave', 'concurrent',
  ]);
  assert.equal(GN_STYLE_TOSS_START_ORDER, GN_STYLE_TOSS_CREATION_ORDER);
  assert.equal(GN_STYLE_TOSS_OUTER_STOP_ORDER, GN_STYLE_TOSS_CREATION_ORDER);
  assert.deepEqual(GN_STYLE_TOSS_ROWS.map((row) => ({
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
      slotOffset: 0x2ac,
      zOrder: 1,
    },
    {
      controller: 'wave',
      direction: 0,
      id: 'wave',
      objectType: 0,
      slotOffset: 0x2b0,
      zOrder: 1,
    },
    {
      controller: 'concurrent',
      direction: 0,
      id: 'concurrent',
      objectType: 0,
      slotOffset: 0x2b4,
      zOrder: 1,
    },
  ]);
  assert.deepEqual(getGnStyleTossRow('free').outerInterval, {
    highSeconds: 3,
    lowSeconds: 0.5,
  });
  assert.deepEqual(getGnStyleTossRow('wave').outerInterval, {
    highSeconds: 8,
    lowSeconds: 3.5,
  });
  assert.deepEqual(getGnStyleTossRow('concurrent').outerInterval, {
    highSeconds: 9,
    lowSeconds: 3,
  });
  assert.throws(
    () => getGnStyleTossRow('bomb' as never),
    /unknown GN Style controller/,
  );
});

test('Concurrent keeps constructor bounds 3..6 separate from actual 3..7 output', () => {
  const row = getGnStyleTossRow('concurrent');
  if (row.controller !== 'concurrent') {
    throw new Error('expected concurrent row');
  }
  assert.deepEqual({
    actualCountMaxInclusive: row.actualCountMaxInclusive,
    actualCountMinInclusive: row.actualCountMinInclusive,
    countMax: row.countMax,
    countMin: row.countMin,
  }, {
    actualCountMaxInclusive: 7,
    actualCountMinInclusive: 3,
    countMax: 6,
    countMin: 3,
  });
});

test('all recovered decile grids preserve float32 sampling and the 5.55s Wave maximum', () => {
  assert.deepEqual(sampleGrid(GN_STYLE_FREE_OUTER_INTERVAL), [
    0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75,
  ]);
  assert.deepEqual(sampleGrid(GN_STYLE_WAVE_OUTER_INTERVAL), [
    3.5, 3.95, 4.4, 4.85, 5.3, 5.75, 6.2, 6.65, 7.1, 7.55,
  ]);
  assert.deepEqual(sampleGrid(GN_STYLE_CONCURRENT_OUTER_INTERVAL), [
    3, 3.6, 4.2, 4.8, 5.4, 6, 6.6, 7.2, 7.8, 8.4,
  ]);
  assert.deepEqual(sampleGrid(GN_STYLE_WAVE_CHILD_INTERVAL), [
    0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7,
  ]);
  assert.deepEqual(sampleGrid(GN_STYLE_WAVE_ACTIVE_WINDOW), [
    1.5, 1.95, 2.4, 2.85, 3.3, 3.75, 4.2, 4.65, 5.1, 5.55,
  ]);
  assert.equal(
    GN_STYLE_WAVE_ACTIVE_WINDOW_MAX_SAMPLE_SECONDS,
    sampleTossInterval(
      scriptedDecile(0.9),
      GN_STYLE_WAVE_ACTIVE_WINDOW.lowSeconds,
      GN_STYLE_WAVE_ACTIVE_WINDOW.highSeconds,
    ),
  );
  assert.equal(
    GN_STYLE_WAVE_ACTIVE_WINDOW_MAX_SAMPLE_SECONDS
      < GN_STYLE_WAVE_ACTIVE_WINDOW.highSeconds,
    true,
  );
});

test('config rows and nested intervals are immutable', () => {
  assert.equal(Object.isFrozen(GN_STYLE_TOSS_ROWS), true);
  assert.equal(GN_STYLE_TOSS_ROWS.every(Object.isFrozen), true);
  assert.equal(Object.isFrozen(GN_STYLE_FREE_OUTER_INTERVAL), true);
  assert.equal(Object.isFrozen(GN_STYLE_WAVE_CHILD_INTERVAL), true);
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
