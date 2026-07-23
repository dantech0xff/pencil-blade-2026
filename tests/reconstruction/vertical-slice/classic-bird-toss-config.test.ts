import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLASSIC_BIRD_MAGNET_BOMB_CONTROLLER_ORDER,
  CLASSIC_BIRD_MAGNET_NORMAL_FRUIT_INTERVAL,
  CLASSIC_BIRD_NORMAL_FRUIT_INTERVAL,
  CLASSIC_BIRD_TOSS_CREATION_ORDER,
  CLASSIC_BIRD_TOSS_ROWS,
  CLASSIC_BIRD_TOSS_START_ORDER,
  CLASSIC_BIRD_TOSS_STOP_ORDER,
  CLASSIC_BIRD_WAVE_CHILD_INTERVAL,
} from '../../../game/assets/scripts/domain/classic-bird-toss-config.ts';
import { sampleTossInterval } from '../../../game/assets/scripts/domain/toss-timer.ts';

test('Classic Bird fixes all nine native slots, construction order, and start/stop order', () => {
  assert.deepEqual(CLASSIC_BIRD_TOSS_CREATION_ORDER, [
    'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'b0', 'b1', 'b2',
  ]);
  assert.deepEqual(CLASSIC_BIRD_TOSS_START_ORDER, [
    'aa', 'b0', 'b1', 'b2', 'ab', 'ac', 'ad', 'ae', 'af',
  ]);
  assert.deepEqual(CLASSIC_BIRD_TOSS_STOP_ORDER, CLASSIC_BIRD_TOSS_START_ORDER);
  assert.deepEqual(CLASSIC_BIRD_TOSS_ROWS.map((row) => ({
    controller: row.controller,
    direction: row.direction,
    fixedFruitId: row.controller === 'free' ? row.fixedFruitId : undefined,
    id: row.id,
    objectType: row.objectType,
    role: row.role,
    slotOffset: row.slotOffset,
    zOrder: row.zOrder,
  })), [
    {
      controller: 'free',
      direction: 0,
      fixedFruitId: undefined,
      id: 'aa',
      objectType: 0,
      role: 'normal-free',
      slotOffset: 0x2a8,
      zOrder: 1,
    },
    {
      controller: 'concurrent',
      direction: 0,
      fixedFruitId: undefined,
      id: 'ab',
      objectType: 0,
      role: 'normal-concurrent',
      slotOffset: 0x2ac,
      zOrder: 1,
    },
    {
      controller: 'wave',
      direction: 0,
      fixedFruitId: undefined,
      id: 'ac',
      objectType: 0,
      role: 'normal-wave',
      slotOffset: 0x2b0,
      zOrder: 1,
    },
    {
      controller: 'free',
      direction: 0,
      fixedFruitId: undefined,
      id: 'ad',
      objectType: 1,
      role: 'bomb-free',
      slotOffset: 0x2b4,
      zOrder: 1,
    },
    {
      controller: 'concurrent',
      direction: 0,
      fixedFruitId: undefined,
      id: 'ae',
      objectType: 1,
      role: 'bomb-concurrent',
      slotOffset: 0x2b8,
      zOrder: 1,
    },
    {
      controller: 'wave',
      direction: 0,
      fixedFruitId: undefined,
      id: 'af',
      objectType: 1,
      role: 'bomb-wave',
      slotOffset: 0x2bc,
      zOrder: 1,
    },
    {
      controller: 'free',
      direction: 1,
      fixedFruitId: undefined,
      id: 'b0',
      objectType: 6,
      role: 'dragon-free',
      slotOffset: 0x2c0,
      zOrder: 1,
    },
    {
      controller: 'free',
      direction: 1,
      fixedFruitId: 14,
      id: 'b1',
      objectType: 4,
      role: 'magnet-free',
      slotOffset: 0x2c4,
      zOrder: 1,
    },
    {
      controller: 'free',
      direction: 1,
      fixedFruitId: 13,
      id: 'b2',
      objectType: 3,
      role: 'electric-free',
      slotOffset: 0x2c8,
      zOrder: 1,
    },
  ]);
  assert.equal(
    CLASSIC_BIRD_TOSS_ROWS.some(({ controller }) => controller === ('double' as never)),
    false,
  );
  assert.equal(
    CLASSIC_BIRD_TOSS_ROWS.some(({ controller }) => controller === ('bonus' as never)),
    false,
  );
});

test('outer, active, and child interval bounds match every recovered row', () => {
  assert.deepEqual(CLASSIC_BIRD_TOSS_ROWS.map((row) => ({
    activeWindow: row.controller === 'wave' ? row.activeWindow : undefined,
    id: row.id,
    internalInterval: row.controller === 'wave'
      ? row.internalInterval
      : undefined,
    outerInterval: row.outerInterval,
  })), [
    {
      activeWindow: undefined,
      id: 'aa',
      internalInterval: undefined,
      outerInterval: { lowSeconds: 0.75, highSeconds: 5 },
    },
    {
      activeWindow: undefined,
      id: 'ab',
      internalInterval: undefined,
      outerInterval: { lowSeconds: 15, highSeconds: 25 },
    },
    {
      activeWindow: { lowSeconds: 1.5, highSeconds: 3 },
      id: 'ac',
      internalInterval: { lowSeconds: 0.25, highSeconds: 0.75 },
      outerInterval: { lowSeconds: 7.55, highSeconds: 17 },
    },
    {
      activeWindow: undefined,
      id: 'ad',
      internalInterval: undefined,
      outerInterval: { lowSeconds: 10, highSeconds: 30 },
    },
    {
      activeWindow: undefined,
      id: 'ae',
      internalInterval: undefined,
      outerInterval: { lowSeconds: 15, highSeconds: 45 },
    },
    {
      activeWindow: { lowSeconds: 1, highSeconds: 2 },
      id: 'af',
      internalInterval: { lowSeconds: 0.25, highSeconds: 0.75 },
      outerInterval: { lowSeconds: 30, highSeconds: 60 },
    },
    {
      activeWindow: undefined,
      id: 'b0',
      internalInterval: undefined,
      outerInterval: { lowSeconds: 30, highSeconds: 75 },
    },
    {
      activeWindow: undefined,
      id: 'b1',
      internalInterval: undefined,
      outerInterval: { lowSeconds: 45, highSeconds: 90 },
    },
    {
      activeWindow: undefined,
      id: 'b2',
      internalInterval: undefined,
      outerInterval: { lowSeconds: 30, highSeconds: 60 },
    },
  ]);
  assert.deepEqual(CLASSIC_BIRD_NORMAL_FRUIT_INTERVAL, {
    lowSeconds: 0.75,
    highSeconds: 5,
  });
  assert.deepEqual(CLASSIC_BIRD_MAGNET_NORMAL_FRUIT_INTERVAL, {
    lowSeconds: 0.5,
    highSeconds: 1.5,
  });
  assert.deepEqual(CLASSIC_BIRD_WAVE_CHILD_INTERVAL, {
    lowSeconds: 0.25,
    highSeconds: 0.75,
  });
});

test('Concurrent rows expose constructor bounds and the inclusive-plus-one actual range', () => {
  const rows = CLASSIC_BIRD_TOSS_ROWS.filter(
    (row) => row.controller === 'concurrent',
  );
  assert.deepEqual(rows.map((row) => ({
    actual: [row.actualCountMinInclusive, row.actualCountMaxInclusive],
    constructor: [row.countMin, row.countMax],
    id: row.id,
  })), [
    { actual: [2, 5], constructor: [2, 4], id: 'ab' },
    { actual: [1, 4], constructor: [1, 3], id: 'ae' },
  ]);
});

test('every interval samples its ten-point float32 grid and never reaches high', () => {
  const intervals = CLASSIC_BIRD_TOSS_ROWS.flatMap((row) => [
    row.outerInterval,
    ...(row.controller === 'wave'
      ? [row.activeWindow, row.internalInterval]
      : []),
  ]);
  intervals.push(CLASSIC_BIRD_MAGNET_NORMAL_FRUIT_INTERVAL);

  for (const interval of intervals) {
    const scriptedDeciles = Array.from(
      { length: 10 },
      (_, index) => index / 10,
    );
    const samples = Array.from({ length: 10 }, () => sampleTossInterval(
      {
        nextDecile: () => (
          scriptedDeciles.shift() ?? fail('deciles exhausted')
        ),
      },
      interval.lowSeconds,
      interval.highSeconds,
    ));
    assert.equal(samples[0], Math.fround(interval.lowSeconds));
    assert.equal(samples[9], Math.fround(
      interval.lowSeconds
      + Math.fround(0.9) * (interval.highSeconds - interval.lowSeconds),
    ));
    assert.equal(samples.every((sample) => sample < interval.highSeconds), true);
  }
});

test('magnet pauses exactly the three bomb controller kinds', () => {
  assert.deepEqual(CLASSIC_BIRD_MAGNET_BOMB_CONTROLLER_ORDER, [
    'ad', 'ae', 'af',
  ]);
});

function fail(message: string): never {
  throw new Error(message);
}
