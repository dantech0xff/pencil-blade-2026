import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLASSIC_TOSS_CREATION_ORDER,
  CLASSIC_TOSS_ROWS,
  CLASSIC_TOSS_START_ORDER,
  CLASSIC_TOSS_STOP_ORDER,
} from '../../../game/assets/scripts/domain/classic-toss-config.ts';
import {
  ModuloGameplayRandom,
  SeededTargetRawSource,
  type RawNonNegativeIntSource,
} from '../../../game/assets/scripts/domain/gameplay-random.ts';
import {
  CLASSIC_DOWN_VELOCITY_BOUNDARY,
  CLASSIC_TOSS_DIRECTION,
  mapSpawnKinematicsToCreator,
  sampleDownSpawnKinematics,
  sampleLeftSpawnKinematics,
  sampleRightSpawnKinematics,
  sampleSpawnKinematics,
  sampleUpSpawnKinematics,
  type SpawnRandom,
} from '../../../game/assets/scripts/domain/spawn-kinematics.ts';
import {
  TossTimer,
  sampleTossInterval,
  type TossTimerRandom,
} from '../../../game/assets/scripts/domain/toss-timer.ts';

class ScriptedRawSource implements RawNonNegativeIntSource {
  private readonly values: number[];

  constructor(values: readonly number[]) {
    this.values = [...values];
  }

  nextRawNonNegativeInt(): number {
    const value = this.values.shift();
    if (value === undefined) {
      throw new Error('scripted raw RNG exhausted');
    }
    return value;
  }
}

class ScriptedSpawnRandom implements SpawnRandom {
  readonly calls: string[] = [];
  private readonly integers: number[];
  private readonly deciles: number[];

  constructor(integers: readonly number[], deciles: readonly number[]) {
    this.integers = [...integers];
    this.deciles = [...deciles];
  }

  nextIntInclusive(min: number, max: number): number {
    this.calls.push(`int:${min}:${max}`);
    const value = this.integers.shift();
    if (value === undefined) {
      throw new Error('scripted integer RNG exhausted');
    }
    return value;
  }

  nextDecile(): number {
    this.calls.push('decile');
    const value = this.deciles.shift();
    if (value === undefined) {
      throw new Error('scripted decile RNG exhausted');
    }
    return value;
  }
}

test('inclusive random uses raw modulo and can return both endpoints', () => {
  const random = new ModuloGameplayRandom(new ScriptedRawSource([0, 4, 5, 9]));

  assert.equal(random.nextIntInclusive(3, 7), 3);
  assert.equal(random.nextIntInclusive(3, 7), 7);
  assert.equal(random.nextIntInclusive(3, 7), 3);
  assert.equal(random.nextIntInclusive(-2, 2), 2);
});

test('decile random returns exactly the modulo grid 0.0 through 0.9 and wraps at ten', () => {
  const random = new ModuloGameplayRandom(
    new ScriptedRawSource([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  );

  assert.deepEqual(
    Array.from({ length: 11 }, () => random.nextDecile()),
    [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0],
  );
});

test('target seeded raw source is deterministic without claiming native sequence parity', () => {
  const left = new SeededTargetRawSource(0x1234_5678);
  const right = new SeededTargetRawSource(0x1234_5678);

  assert.deepEqual(
    Array.from({ length: 8 }, () => left.nextRawNonNegativeInt()),
    Array.from({ length: 8 }, () => right.nextRawNonNegativeInt()),
  );
  assert.equal(left.initialSeed, 0x1234_5678);
  assert.equal(left.getState(), right.getState());
});

test('interval sampling uses only ten deciles and does not reach a distinct high endpoint', () => {
  const values = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const random: TossTimerRandom = {
    nextDecile() {
      const value = values.shift();
      if (value === undefined) {
        throw new Error('deciles exhausted');
      }
      return value;
    },
  };

  assert.deepEqual(
    Array.from({ length: 10 }, () => sampleTossInterval(random, 0.5, 3)),
    [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75],
  );
});

test('timer is strict greater-than, discards overshoot, and rearms before callback RNG', () => {
  const events: string[] = [];
  const deciles = [0, 0.5, 0.9];
  const random: TossTimerRandom = {
    nextDecile() {
      const value = deciles.shift();
      if (value === undefined) {
        throw new Error('deciles exhausted');
      }
      events.push(`rng:${value}`);
      return value;
    },
  };
  const timer = new TossTimer({
    random,
    lowSeconds: 1,
    highSeconds: 2,
    onTossTurn() {
      events.push('callback');
      random.nextDecile();
    },
  });

  timer.start();
  assert.equal(timer.thresholdSeconds, 1);
  assert.equal(timer.tick(1), false);
  assert.equal(timer.elapsedSeconds, 1);
  assert.equal(timer.tick(0.25), true);
  assert.equal(timer.elapsedSeconds, 0);
  assert.equal(timer.thresholdSeconds, Math.fround(1.5));
  assert.deepEqual(events, ['rng:0', 'rng:0.5', 'callback', 'rng:0.9']);

  // If the 0.25-second overshoot had carried, this tick would exceed 1.5.
  assert.equal(timer.tick(1.4), false);
  assert.equal(timer.elapsedSeconds, Math.fround(1.4));
});

test('pause, resume, stop, and restart preserve timer state while Start only resamples', () => {
  const deciles = [0, 0.5];
  const random = {
    nextDecile() {
      const value = deciles.shift();
      if (value === undefined) {
        throw new Error('deciles exhausted');
      }
      return value;
    },
  };
  const timer = new TossTimer({ random, lowSeconds: 2, highSeconds: 4, onTossTurn() {} });

  timer.start();
  timer.tick(1);
  timer.pause();
  const paused = {
    elapsed: timer.elapsedSeconds,
    threshold: timer.thresholdSeconds,
  };
  assert.equal(timer.tick(10), false);
  timer.resume();
  assert.deepEqual(
    { elapsed: timer.elapsedSeconds, threshold: timer.thresholdSeconds },
    paused,
  );

  timer.stop();
  timer.restart();
  assert.equal(timer.scheduled, false);
  assert.deepEqual(
    { elapsed: timer.elapsedSeconds, threshold: timer.thresholdSeconds },
    paused,
  );

  timer.setLimits(4, 6);
  assert.equal(timer.thresholdSeconds, paused.threshold);
  timer.start();
  assert.equal(timer.elapsedSeconds, paused.elapsed);
  assert.equal(timer.thresholdSeconds, 5);
});

test('Classic controller table fixes creation, start/stop, type, direction, and z-order', () => {
  assert.deepEqual(CLASSIC_TOSS_CREATION_ORDER, ['a9', 'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'b0', 'b1']);
  assert.deepEqual(CLASSIC_TOSS_START_ORDER, ['a9', 'af', 'b0', 'b1', 'aa', 'ab', 'ac', 'ad', 'ae']);
  assert.deepEqual(CLASSIC_TOSS_STOP_ORDER, CLASSIC_TOSS_START_ORDER);
  assert.deepEqual(CLASSIC_TOSS_ROWS.map((row) => ({
    controller: row.controller,
    direction: row.direction,
    id: row.id,
    objectType: row.objectType,
    zOrder: row.zOrder,
  })), [
    { controller: 'free', direction: 0, id: 'a9', objectType: 0, zOrder: 1 },
    { controller: 'concurrent', direction: 0, id: 'aa', objectType: 0, zOrder: 1 },
    { controller: 'wave', direction: 0, id: 'ab', objectType: 0, zOrder: 1 },
    { controller: 'free', direction: 0, id: 'ac', objectType: 1, zOrder: 1 },
    { controller: 'concurrent', direction: 0, id: 'ad', objectType: 1, zOrder: 1 },
    { controller: 'wave', direction: 0, id: 'ae', objectType: 1, zOrder: 1 },
    { controller: 'free', direction: 1, id: 'af', objectType: 6, zOrder: 1 },
    { controller: 'free', direction: 1, id: 'b0', objectType: 4, zOrder: 1 },
    { controller: 'free', direction: 1, id: 'b1', objectType: 3, zOrder: 1 },
  ]);
  assert.equal(CLASSIC_TOSS_ROWS.some((row) => row.controller === ('double' as never)), false);
  assert.equal(CLASSIC_TOSS_ROWS.some((row) => row.controller === ('bonus' as never)), false);
});

test('right and left kinematics preserve draw order and recovered 480x800 values', () => {
  const rightRandom = new ScriptedSpawnRandom([3], [0, 0.9]);
  const right = sampleRightSpawnKinematics({ width: 480, height: 800 }, rightRandom);
  assert.deepEqual(right, {
    direction: CLASSIC_TOSS_DIRECTION.RIGHT,
    positionMetres: { x: 18, y: 16.25 },
    angleRadians: 0,
    linearVelocityMetresPerSecond: { x: -3.5, y: Math.fround(8.3) },
    angularVelocityRadiansPerSecond: 3,
  });
  assert.deepEqual(rightRandom.calls, ['decile', 'decile', 'int:3:6']);

  const leftRandom = new ScriptedSpawnRandom([6], [0, 0.9]);
  const left = sampleLeftSpawnKinematics({ width: 480, height: 800 }, leftRandom);
  assert.deepEqual(left, {
    direction: CLASSIC_TOSS_DIRECTION.LEFT,
    positionMetres: { x: -3, y: 16.25 },
    angleRadians: 0,
    linearVelocityMetresPerSecond: { x: 3.5, y: Math.fround(8.3) },
    angularVelocityRadiansPerSecond: 6,
  });
  assert.deepEqual(leftRandom.calls, ['decile', 'decile', 'int:3:6']);
});

test('side and up formulas retain their distinct non-480 width corrections', () => {
  const right = sampleRightSpawnKinematics(
    { width: 720, height: 1280 },
    new ScriptedSpawnRandom([3], [0, 0]),
  );
  assert.ok(Math.abs(right.linearVelocityMetresPerSecond.x - (-5.9)) < 0.00001);
  assert.ok(Math.abs(right.linearVelocityMetresPerSecond.y - 8.9) < 0.00001);

  const up = sampleUpSpawnKinematics(
    { width: 720, height: 1280 },
    new ScriptedSpawnRandom([14, 3], [0, 0]),
  );
  assert.ok(Math.abs(up.linearVelocityMetresPerSecond.y - (18.75 + 240 / 37)) < 0.00001);
});

test('down emits no velocity write and up flips horizontal velocity around centre', () => {
  const downRandom = new ScriptedSpawnRandom([9, 7], []);
  const down = sampleDownSpawnKinematics({ width: 480, height: 800 }, downRandom);
  assert.deepEqual(down, {
    direction: CLASSIC_TOSS_DIRECTION.DOWN,
    positionMetres: { x: 0.28125, y: 28.125 },
    angleRadians: 0,
    angularVelocityRadiansPerSecond: 7,
  });
  assert.equal('linearVelocityMetresPerSecond' in down, false);
  assert.deepEqual(downRandom.calls, ['int:9:470', 'int:3:7']);
  assert.deepEqual(CLASSIC_DOWN_VELOCITY_BOUNDARY, {
    fruitIdsRequiringZeroReset: [13, 14],
    fruitResetMetresPerSecond: { x: 0, y: 0 },
    dragonFruitInitialLinearVelocity: 'unknown',
  });

  const leftOfCentre = sampleUpSpawnKinematics(
    { width: 480, height: 800 },
    new ScriptedSpawnRandom([9, 10], [0.4, 0.9]),
  );
  assert.deepEqual(leftOfCentre, {
    direction: CLASSIC_TOSS_DIRECTION.UP,
    positionMetres: { x: 0.28125, y: -3.125 },
    angleRadians: 0,
    linearVelocityMetresPerSecond: { x: Math.fround(0.8), y: Math.fround(20.55) },
    angularVelocityRadiansPerSecond: 10,
  });

  const rightOfCentre = sampleUpSpawnKinematics(
    { width: 480, height: 800 },
    new ScriptedSpawnRandom([470, 3], [0.4, 0.9]),
  );
  assert.equal(rightOfCentre.linearVelocityMetresPerSecond.x, Math.fround(-0.8));
});

test('generic direction dispatch and Creator mapping convert positions exactly once', () => {
  const sampled = sampleSpawnKinematics(
    CLASSIC_TOSS_DIRECTION.RIGHT,
    { width: 480, height: 800 },
    new ScriptedSpawnRandom([5], [0, 0]),
  );

  assert.deepEqual(mapSpawnKinematicsToCreator(sampled), {
    direction: CLASSIC_TOSS_DIRECTION.RIGHT,
    positionWorldUnits: { x: 576, y: 520 },
    angleRadians: 0,
    linearVelocityMetresPerSecond: { x: -3.5, y: 6.5 },
    angularVelocityRadiansPerSecond: 5,
  });
  assert.throws(
    () => sampleSpawnKinematics(9 as never, { width: 480, height: 800 }, new ScriptedSpawnRandom([], [])),
    /unsupported toss direction/,
  );
});
