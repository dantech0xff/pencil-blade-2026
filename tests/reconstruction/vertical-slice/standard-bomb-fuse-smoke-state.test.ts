import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STANDARD_BOMB_SMOKE_FRAME_COUNT,
  STANDARD_BOMB_SMOKE_FRAME_SECONDS,
  StandardBombSmokeAnimationState,
  StandardBombSmokeEmitterState,
  frameRectForIndex,
} from '../../../game/assets/scripts/domain/standard-bomb-fuse-smoke-state.ts';

class ScriptedRandom {
  readonly calls: Readonly<{ maximum: number; minimum: number }>[] = [];
  private readonly values: number[];

  constructor(values: readonly number[]) {
    this.values = [...values];
  }

  nextIntInclusive(minimum: number, maximum: number): number {
    (this.calls as { maximum: number; minimum: number }[]).push({ maximum, minimum });
    const value = this.values.shift();
    if (value === undefined) {
      throw new Error('scripted random exhausted');
    }
    return value;
  }
}

test('intact fuse consumes one inclusive 0...6 draw and emits only on zero', () => {
  const random = new ScriptedRandom([6, 0]);
  const emitter = new StandardBombSmokeEmitterState(random);
  const input = {
    bombAngleRadians: 0,
    bombWorldPosition: { x: 120, y: 300 },
    spriteHeightWorldUnits: 160,
  };

  assert.equal(emitter.updateScheduled(input), null);
  assert.deepEqual(emitter.updateScheduled(input), {
    frameIndex: 0,
    position: { x: 120, y: 380 },
  });
  assert.deepEqual(random.calls, [
    { minimum: 0, maximum: 6 },
    { minimum: 0, maximum: 6 },
  ]);
});

test('emission rotates the half-height fuse offset around the Bomb body', () => {
  const random = new ScriptedRandom([0, 0]);
  const emitter = new StandardBombSmokeEmitterState(random);

  const quarterTurn = emitter.updateScheduled({
    bombAngleRadians: Math.PI / 2,
    bombWorldPosition: { x: 10, y: 20 },
    spriteHeightWorldUnits: 100,
  });
  assert.ok(quarterTurn);
  assert.ok(Math.abs(quarterTurn.position.x - -40) < 1e-10);
  assert.ok(Math.abs(quarterTurn.position.y - 20) < 1e-10);

  const halfTurn = emitter.updateScheduled({
    bombAngleRadians: Math.PI,
    bombWorldPosition: { x: 10, y: 20 },
    spriteHeightWorldUnits: 100,
  });
  assert.ok(halfTurn);
  assert.ok(Math.abs(halfTurn.position.x - 10) < 1e-10);
  assert.ok(Math.abs(halfTurn.position.y - -30) < 1e-10);
});

test('cut stop is idempotent and prevents every later RNG draw', () => {
  const random = new ScriptedRandom([0]);
  const emitter = new StandardBombSmokeEmitterState(random);

  assert.equal(emitter.stop(), true);
  assert.equal(emitter.stop(), false);
  assert.equal(emitter.updateScheduled({
    bombAngleRadians: 0,
    bombWorldPosition: { x: 0, y: 0 },
    spriteHeightWorldUnits: 100,
  }), null);
  assert.deepEqual(random.calls, []);
});

test('atlas frames are row-major 15 plus 15 with exact 128-pixel rects', () => {
  assert.equal(STANDARD_BOMB_SMOKE_FRAME_COUNT, 30);
  assert.deepEqual(frameRectForIndex(0), { x: 0, y: 0, width: 128, height: 128 });
  assert.deepEqual(frameRectForIndex(14), {
    x: 1792,
    y: 0,
    width: 128,
    height: 128,
  });
  assert.deepEqual(frameRectForIndex(15), {
    x: 0,
    y: 128,
    width: 128,
    height: 128,
  });
  assert.deepEqual(frameRectForIndex(29), {
    x: 1792,
    y: 128,
    width: 128,
    height: 128,
  });
});

test('smoke advances through the recovered cycle and independently removes at one second', () => {
  const smoke = new StandardBombSmokeAnimationState();
  assert.equal(smoke.snapshot().frameIndex, 0);

  const frameOne = smoke.updateAction(STANDARD_BOMB_SMOKE_FRAME_SECONDS);
  assert.equal(frameOne.finishedNow, false);
  assert.equal(frameOne.snapshot.frameIndex, 1);

  const nearEnd = smoke.updateAction(
    STANDARD_BOMB_SMOKE_FRAME_SECONDS * (STANDARD_BOMB_SMOKE_FRAME_COUNT - 2),
  );
  assert.equal(nearEnd.finishedNow, false);
  assert.equal(nearEnd.snapshot.frameIndex, 29);

  const finished = smoke.updateAction(1);
  assert.equal(finished.finishedNow, true);
  assert.deepEqual(finished.snapshot, {
    elapsedActionSeconds: 1,
    finished: true,
    frameIndex: null,
    frameRect: null,
  });
  assert.equal(smoke.updateAction(1).finishedNow, false);
});

test('invalid geometry, clocks, frames, and random results fail closed', () => {
  const emitter = new StandardBombSmokeEmitterState(new ScriptedRandom([7]));
  assert.throws(() => emitter.updateScheduled({
    bombAngleRadians: 0,
    bombWorldPosition: { x: 0, y: 0 },
    spriteHeightWorldUnits: 100,
  }), RangeError);
  assert.throws(() => frameRectForIndex(-1), RangeError);
  assert.throws(() => frameRectForIndex(30), RangeError);
  assert.throws(
    () => new StandardBombSmokeAnimationState().updateAction(Number.NaN),
    RangeError,
  );
});
