import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLASSIC_FAIL_ACTIVATION_ACTION_SECONDS,
  CLASSIC_FAIL_ENTRY_ACTION_SECONDS,
  CLASSIC_FAIL_MARKER_Z_ORDER,
  CLASSIC_FAIL_TRANSIENT_ACTION_SECONDS,
  createClassicFailActivationPlan,
  createClassicFailMarkerLayouts,
} from '../../../game/assets/scripts/domain/classic-fail-presentation.ts';

test('persistent fail-marker layout preserves all recovered positions, scales, and timings', () => {
  assert.deepEqual(createClassicFailMarkerLayouts({ width: 480, height: 800 }), [
    {
      initialWorldPosition: { x: Math.fround(480 * 0.675), y: 900 },
      scale: Math.fround(0.64),
      strike: 1,
      targetWorldPosition: { x: Math.fround(480 * 0.675), y: 764 },
    },
    {
      initialWorldPosition: { x: 372, y: 900 },
      scale: Math.fround(0.8),
      strike: 2,
      targetWorldPosition: { x: 372, y: 764 },
    },
    {
      initialWorldPosition: { x: 432, y: 900 },
      scale: 1,
      strike: 3,
      targetWorldPosition: { x: 432, y: 764 },
    },
  ]);
  assert.deepEqual(
    createClassicFailMarkerLayouts({ width: 720, height: 1280 }).map((layout) => ({
      initial: layout.initialWorldPosition,
      target: layout.targetWorldPosition,
    })),
    [
      {
        initial: { x: Math.fround(720 * 0.675), y: 1440 },
        target: { x: Math.fround(720 * 0.675), y: Math.fround(1280 * 0.955) },
      },
      {
        initial: { x: 558, y: 1440 },
        target: { x: 558, y: Math.fround(1280 * 0.955) },
      },
      {
        initial: { x: 648, y: 1440 },
        target: { x: 648, y: Math.fround(1280 * 0.955) },
      },
    ],
  );
  assert.equal(CLASSIC_FAIL_ENTRY_ACTION_SECONDS, Math.fround(1));
  assert.equal(CLASSIC_FAIL_ACTIVATION_ACTION_SECONDS, Math.fround(0.25));
  assert.equal(CLASSIC_FAIL_TRANSIENT_ACTION_SECONDS, Math.fround(1));
  assert.equal(CLASSIC_FAIL_MARKER_Z_ORDER, 1);
});

test('miss activation keeps the recovered x and fixes transient y to 0.075H', () => {
  assert.deepEqual(createClassicFailActivationPlan(
    2,
    { x: 137.5, y: -999 },
    { width: 480, height: 800 },
  ), {
    activationActionSeconds: Math.fround(0.25),
    initialOpacity: 0,
    initialScaleMultiplier: 5,
    strike: 2,
    targetOpacity: 255,
    targetScaleMultiplier: 1,
    transientActionSeconds: Math.fround(1),
    transientWorldPosition: { x: 137.5, y: 60 },
    zOrder: 1,
  });
});

test('fail presentation rejects invalid strikes, positions, and viewports', () => {
  assert.throws(
    () => createClassicFailMarkerLayouts({ width: 0, height: 800 }),
    /positive/,
  );
  assert.throws(
    () => createClassicFailMarkerLayouts({ width: 480, height: Number.NaN }),
    /finite/,
  );
  assert.throws(
    () => createClassicFailActivationPlan(0 as never, { x: 1, y: 2 }, { width: 1, height: 1 }),
    /strike/,
  );
  assert.throws(
    () => createClassicFailActivationPlan(1, { x: Number.POSITIVE_INFINITY, y: 2 }, { width: 1, height: 1 }),
    /missPosition.x/,
  );
});
