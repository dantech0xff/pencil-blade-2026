import assert from 'node:assert/strict';
import test from 'node:test';

import { BladeTracks } from '../../../game/assets/scripts/domain/blade-tracks.ts';
import {
  CLASSIC_BLADE_SLOT_COUNT,
  CLASSIC_EXCLUDED_CUT_NODE_TAG,
  CLASSIC_PHYSICS_CONFIGURATION,
  CLASSIC_RAY_EXTENSION_DIVISOR,
  CLASSIC_SWISH_WIDTH_RATIO,
  LEGACY_WORLD_UNITS_PER_METRE,
  angularVelocityToCreator,
  creatorWorldToMetres,
  linearVelocityToCreator,
  metresToCreatorWorld,
  positionMetresToCreatorWorld,
  rayEndpointToCreator,
} from '../../../game/assets/scripts/domain/classic-physics-rules.ts';

test('four blade slots allocate in order and an ended slot is reusable', () => {
  const tracks = new BladeTracks();

  assert.deepEqual(
    [10, 11, 12, 13].map((touchId) => tracks.begin(touchId, { x: touchId, y: -touchId })),
    [0, 1, 2, 3],
  );
  assert.equal(tracks.begin(14, { x: 14, y: -14 }), null);

  assert.equal(tracks.end(11), 1);
  assert.equal(tracks.begin(14, { x: 20, y: 30 }), 1);
  assert.deepEqual(tracks.snapshot()[1], {
    current: { x: 20, y: 30 },
    previous: { x: 20, y: 30 },
    slot: 1,
    touchId: 14,
  });
});

test('move shifts endpoints and swish uses strict greater-than comparison', () => {
  const viewportWidth = 400;
  const threshold = Math.fround(viewportWidth * CLASSIC_SWISH_WIDTH_RATIO);

  const equality = new BladeTracks();
  equality.begin(1, { x: 0, y: 0 });
  const equalityMove = equality.move(1, { x: threshold, y: 0 }, viewportWidth);
  assert.ok(equalityMove);
  assert.deepEqual(equalityMove.segment, {
    current: { x: threshold, y: 0 },
    previous: { x: 0, y: 0 },
    slot: 0,
    touchId: 1,
  });
  assert.equal(equalityMove.shouldPlaySwish, false);

  const greater = new BladeTracks();
  greater.begin(2, { x: 0, y: 0 });
  assert.equal(
    greater.move(2, { x: threshold + 0.000001, y: 0 }, viewportWidth)?.shouldPlaySwish,
    true,
  );
});

test('end restores touch and point sentinels', () => {
  const tracks = new BladeTracks();
  tracks.begin(7, { x: 1, y: 2 });
  tracks.move(7, { x: 3, y: 4 }, 480);

  assert.equal(tracks.end(7), 0);
  assert.deepEqual(tracks.snapshot()[0], {
    current: { x: 0, y: 0 },
    previous: { x: 0, y: 0 },
    slot: 0,
    touchId: -1,
  });
  assert.equal(tracks.end(7), null);
});

test('post-physics segments include only active non-zero tracks while cutting is enabled', () => {
  const tracks = new BladeTracks();
  tracks.begin(1, { x: 5, y: 5 });
  tracks.begin(2, { x: 8, y: 8 });
  tracks.move(2, { x: 9, y: 10 }, 480);

  assert.deepEqual(tracks.segmentsForPostPhysicsUpdate(false), []);
  assert.deepEqual(tracks.segmentsForPostPhysicsUpdate(true), [{
    current: { x: 9, y: 10 },
    previous: { x: 8, y: 8 },
    slot: 1,
    touchId: 2,
  }]);
});

test('physics constants preserve the recovered Creator boundary', () => {
  assert.equal(LEGACY_WORLD_UNITS_PER_METRE, 32);
  assert.equal(CLASSIC_BLADE_SLOT_COUNT, 4);
  assert.equal(CLASSIC_EXCLUDED_CUT_NODE_TAG, 1437);
  assert.equal(CLASSIC_RAY_EXTENSION_DIVISOR, 16);
  assert.equal(CLASSIC_SWISH_WIDTH_RATIO, Math.fround(0.0825));
  assert.deepEqual(CLASSIC_PHYSICS_CONFIGURATION, {
    allowSleep: true,
    gravityWorldUnitsPerSecondSquared: { x: 0, y: -320 },
    positionIterations: 10,
    timestepPolicy: 'variable-frame-delta-times-world-speed',
    velocityIterations: 10,
  });
});

test('positions scale by 32 while velocity, angular velocity, and ray endpoints do not', () => {
  assert.equal(metresToCreatorWorld(1.25), 40);
  assert.equal(metresToCreatorWorld(-3), -96);
  assert.equal(creatorWorldToMetres(72), 2.25);
  assert.deepEqual(positionMetresToCreatorWorld({ x: 18, y: -3.125 }), { x: 576, y: -100 });
  assert.deepEqual(linearVelocityToCreator({ x: -3.5, y: 8.3 }), { x: -3.5, y: 8.3 });
  assert.equal(angularVelocityToCreator(6), 6);
  assert.deepEqual(rayEndpointToCreator({ x: 480, y: 800 }), { x: 480, y: 800 });
});

test('physics conversion helpers reject non-finite inputs', () => {
  assert.throws(() => metresToCreatorWorld(Number.NaN), RangeError);
  assert.throws(() => creatorWorldToMetres(Number.POSITIVE_INFINITY), RangeError);
  assert.throws(() => positionMetresToCreatorWorld({ x: 0, y: Number.NaN }), RangeError);
  assert.throws(() => linearVelocityToCreator({ x: Number.NEGATIVE_INFINITY, y: 0 }), RangeError);
  assert.throws(() => angularVelocityToCreator(Number.NaN), RangeError);
  assert.throws(() => rayEndpointToCreator({ x: Number.NaN, y: 0 }), RangeError);
});
