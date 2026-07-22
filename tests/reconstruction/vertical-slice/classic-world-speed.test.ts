import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLASSIC_FROZEN_WORLD_SPEED,
  CLASSIC_INITIAL_WORLD_SPEED,
  CLASSIC_SPEED_INCREMENT,
  CLASSIC_SPEED_LIMIT,
  CLASSIC_SPEED_UP_DELAY_SECONDS,
  ClassicWorldSpeed,
} from '../../../game/assets/scripts/domain/classic-world-speed.ts';

test('Classic scene entry arms the first 30-second speed callback at initial speed', () => {
  const speed = new ClassicWorldSpeed();

  assert.deepEqual(speed.snapshot(), {
    speed: CLASSIC_INITIAL_WORLD_SPEED,
    speedUpEnabled: false,
  });
  assert.deepEqual(speed.enableClassicSpeedUp(), [{
    type: 'schedule-speed-up-callback',
    delaySeconds: CLASSIC_SPEED_UP_DELAY_SECONDS,
  }]);
  assert.deepEqual(speed.snapshot(), {
    speed: CLASSIC_INITIAL_WORLD_SPEED,
    speedUpEnabled: true,
  });
});

test('speed callback uses float32 +0.1 and strict pre-add less-than two', () => {
  const speed = new ClassicWorldSpeed();
  speed.enableClassicSpeedUp();
  const observed: number[] = [];
  let expected = CLASSIC_INITIAL_WORLD_SPEED;

  while (expected < CLASSIC_SPEED_LIMIT) {
    expected = Math.fround(expected + CLASSIC_SPEED_INCREMENT);
    assert.deepEqual(speed.speedUpDelayComplete(), [
      { type: 'set-world-speed', value: expected },
      { type: 'schedule-speed-up-callback', delaySeconds: CLASSIC_SPEED_UP_DELAY_SECONDS },
    ]);
    observed.push(expected);
  }

  assert.equal(observed.length, 10);
  assert.equal(observed.at(-1), Math.fround(2.000000238418579));
  // The final successful addition rearmed this callback; only this next callback is a no-op.
  assert.deepEqual(speed.speedUpDelayComplete(), []);
  assert.equal(speed.snapshot().speed, observed.at(-1));
});

test('physics step delta scales only at float32 speeds 0.5, 1, and 2', () => {
  const speed = new ClassicWorldSpeed();
  const frameDelta = 1 / 60;
  const floatDelta = Math.fround(frameDelta);

  assert.equal(
    speed.physicsStepDelta(frameDelta),
    Math.fround(floatDelta * CLASSIC_INITIAL_WORLD_SPEED),
  );

  speed.freeze();
  assert.equal(
    speed.physicsStepDelta(frameDelta),
    Math.fround(floatDelta * CLASSIC_FROZEN_WORLD_SPEED),
  );

  speed.setDirectSpeed(CLASSIC_SPEED_LIMIT);
  assert.equal(
    speed.physicsStepDelta(frameDelta),
    Math.fround(floatDelta * CLASSIC_SPEED_LIMIT),
  );
});

test('freeze writes 0.5 and unfreeze restores exactly 1.0', () => {
  const speed = new ClassicWorldSpeed();
  speed.setDirectSpeed(Math.fround(1.7));

  assert.deepEqual(speed.freeze(), [{
    type: 'set-world-speed',
    value: CLASSIC_FROZEN_WORLD_SPEED,
  }]);
  assert.equal(speed.snapshot().speed, CLASSIC_FROZEN_WORLD_SPEED);

  assert.deepEqual(speed.unfreeze(), [{
    type: 'set-world-speed',
    value: CLASSIC_INITIAL_WORLD_SPEED,
  }]);
  assert.equal(speed.snapshot().speed, CLASSIC_INITIAL_WORLD_SPEED);
});
