import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLASSIC_CRITICAL_CUT_IMPULSE_MULTIPLIER,
  CLASSIC_CUT_HALF_FADE_ACTION_SECONDS,
  CLASSIC_CUT_HALF_GRAVITY_SCALE,
  CLASSIC_CUT_IMPULSE_VIEWPORT_FACTOR,
  createClassicCutHalfMotion,
} from '../../../game/assets/scripts/domain/classic-cut-half-motion.ts';
import {
  CLASSIC_NORMAL_FRUIT_RESOURCES,
  getClassicNormalFruitResources,
} from '../../../game/assets/scripts/domain/classic-resource-contract.ts';

const BASE_INPUT = Object.freeze({
  bottomHeightWorldUnits: 40,
  critical: false,
  segment: Object.freeze({
    start: Object.freeze({ x: 10, y: 20 }),
    end: Object.freeze({ x: 110, y: 20 }),
  }),
  sourceAngleRadians: 0,
  sourceAngularVelocityRadiansPerSecond: -3,
  sourceBodyMass: 2,
  sourcePositionWorldUnits: Object.freeze({ x: 200, y: 300 }),
  topHeightWorldUnits: 60,
  viewportWidthWorldUnits: 480,
});

test('recovered constants preserve cut-half gravity, action fade, and impulse scaling', () => {
  assert.equal(CLASSIC_CUT_HALF_FADE_ACTION_SECONDS, Math.fround(0.75));
  assert.equal(CLASSIC_CUT_HALF_GRAVITY_SCALE, Math.fround(1.5));
  assert.equal(CLASSIC_CUT_IMPULSE_VIEWPORT_FACTOR, Math.fround(0.02));
  assert.equal(CLASSIC_CRITICAL_CUT_IMPULSE_MULTIPLIER, Math.fround(9));
});

test('horizontal cut creates recovered bottom/top offsets, angle, and centre impulses', () => {
  const motion = createClassicCutHalfMotion(BASE_INPUT);

  assert.ok(Math.abs(motion.bottom.angleRadians) <= 1e-6);
  assert.equal(motion.top.angleRadians, motion.bottom.angleRadians);
  assert.equal(motion.bottom.angularVelocityRadiansPerSecond, -1.5);
  assert.equal(motion.top.angularVelocityRadiansPerSecond, -1.5);
  assertPointNear(motion.bottom.direction, { x: 0, y: -0.5 }, 1e-6);
  assertPointNear(motion.top.direction, { x: 0, y: 1 }, 1e-6);
  assertPointNear(motion.bottom.positionWorldUnits, { x: 200, y: 290 }, 1e-4);
  assertPointNear(motion.top.positionWorldUnits, { x: 200, y: 330 }, 1e-4);
  assertPointNear(motion.bottom.impulseNewtonSeconds, { x: 0, y: -9.6 }, 1e-4);
  assertPointNear(motion.top.impulseNewtonSeconds, { x: 0, y: 19.2 }, 1e-4);
  assert.equal(Object.isFrozen(motion), true);
  assert.equal(Object.isFrozen(motion.bottom), true);
  assert.equal(Object.isFrozen(motion.bottom.direction), true);
});

test('critical cut multiplies both recovered impulses by nine without changing transforms', () => {
  const normal = createClassicCutHalfMotion(BASE_INPUT);
  const critical = createClassicCutHalfMotion({ ...BASE_INPUT, critical: true });

  assert.deepEqual(critical.bottom.positionWorldUnits, normal.bottom.positionWorldUnits);
  assert.deepEqual(critical.top.positionWorldUnits, normal.top.positionWorldUnits);
  assertPointNear(
    critical.bottom.impulseNewtonSeconds,
    {
      x: normal.bottom.impulseNewtonSeconds.x * 9,
      y: normal.bottom.impulseNewtonSeconds.y * 9,
    },
    1e-4,
  );
  assertPointNear(
    critical.top.impulseNewtonSeconds,
    {
      x: normal.top.impulseNewtonSeconds.x * 9,
      y: normal.top.impulseNewtonSeconds.y * 9,
    },
    1e-4,
  );
});

test('all 18 exact ordinary-fruit profile pairs produce finite paired motion', () => {
  for (const { fruitId } of CLASSIC_NORMAL_FRUIT_RESOURCES) {
    for (const assetTree of ['480x800', '720x1280'] as const) {
      const resources = getClassicNormalFruitResources(fruitId, assetTree);
      const motion = createClassicCutHalfMotion({
        ...BASE_INPUT,
        bottomHeightWorldUnits: resources.cutBottom.dimensions.height,
        critical: fruitId % 2 === 0,
        segment: {
          start: { x: 11 + fruitId, y: 19 },
          end: { x: 63, y: 101 + fruitId },
        },
        topHeightWorldUnits: resources.cutTop.dimensions.height,
        viewportWidthWorldUnits: assetTree === '480x800' ? 480 : 720,
      });

      for (const half of [motion.bottom, motion.top]) {
        for (const value of [
          half.angleRadians,
          half.angularVelocityRadiansPerSecond,
          half.impulseNewtonSeconds.x,
          half.impulseNewtonSeconds.y,
          half.positionWorldUnits.x,
          half.positionWorldUnits.y,
        ]) {
          assert.equal(Number.isFinite(value), true, `${assetTree} fruit ${fruitId}`);
        }
      }
    }
  }
});

test('raw source angle uses the recovered 2/PI WrapAngle oddity before orientation choice', () => {
  const rawAngle = Math.fround(4);
  const wrappedByRecoveredLoop = Math.fround(
    Math.fround(rawAngle - 0.6366197723675814) - 0.6366197723675814,
  );
  assert.ok(wrappedByRecoveredLoop < Math.PI);

  const fromRaw = createClassicCutHalfMotion({ ...BASE_INPUT, sourceAngleRadians: rawAngle });
  const fromWrapped = createClassicCutHalfMotion({
    ...BASE_INPUT,
    sourceAngleRadians: wrappedByRecoveredLoop,
  });
  assert.deepEqual(fromRaw, fromWrapped);
});

test('invalid or zero-length motion inputs fail before producing a partial pair', () => {
  assert.throws(() => createClassicCutHalfMotion({
    ...BASE_INPUT,
    segment: { start: { x: 1, y: 1 }, end: { x: 1, y: 1 } },
  }), RangeError);
  assert.throws(() => createClassicCutHalfMotion({
    ...BASE_INPUT,
    sourceBodyMass: 0,
  }), RangeError);
  assert.throws(() => createClassicCutHalfMotion({
    ...BASE_INPUT,
    critical: 1 as never,
  }), TypeError);
  assert.throws(() => createClassicCutHalfMotion({
    ...BASE_INPUT,
    sourceAngleRadians: Number.NaN,
  }), RangeError);
});

function assertPointNear(
  actual: Readonly<{ x: number; y: number }>,
  expected: Readonly<{ x: number; y: number }>,
  tolerance: number,
): void {
  assert.ok(Math.abs(actual.x - expected.x) <= tolerance, `${actual.x} != ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) <= tolerance, `${actual.y} != ${expected.y}`);
}
