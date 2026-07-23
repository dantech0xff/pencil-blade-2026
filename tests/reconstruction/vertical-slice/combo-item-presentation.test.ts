import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMBO_ITEM_HOLD_SECONDS,
  COMBO_ITEM_OVERSHOOT_SECONDS,
  COMBO_ITEM_OVERSHOOT_SCALE,
  COMBO_ITEM_SCALE_IN_SECONDS,
  COMBO_ITEM_SCALE_OUT_SECONDS,
  COMBO_ITEM_TOTAL_SECONDS,
  ComboItemPresentationState,
  comboItemScaleAt,
  createComboItemPresentationPlan,
} from '../../../game/assets/scripts/domain/combo-item-presentation.ts';

test('ComboItem plans preserve recovered text, position, scaled font size, and colors', () => {
  const expectedColors = new Map<number, Readonly<{ r: number; g: number; b: number }>>([
    [3, { r: 255, g: 153, b: 0 }],
    [4, { r: 152, g: 204, b: 0 }],
    [5, { r: 147, g: 39, b: 143 }],
    [6, { r: 255, g: 0, b: 255 }],
    [7, { r: 255, g: 102, b: 0 }],
    [8, { r: 147, g: 39, b: 143 }],
    [9, { r: 0, g: 51, b: 0 }],
    [10, { r: 0, g: 0, b: 255 }],
  ]);

  for (const [count, color] of expectedColors) {
    const low = createComboItemPresentationPlan(count, { x: 12.25, y: -4.5 }, 480);
    const high = createComboItemPresentationPlan(count, { x: 12.25, y: -4.5 }, 720);
    assert.equal(low.text, `+${count} Fruits\nCombo`);
    assert.deepEqual(low.position, { x: 12.25, y: -4.5 });
    assert.deepEqual(low.color, color);
    assert.equal(low.fontSize, 32);
    assert.equal(high.fontSize, 48);
    assert.equal(low.zOrder, 1);
    assert.equal(Object.isFrozen(low), true);
    assert.equal(Object.isFrozen(low.color), true);
    assert.equal(Object.isFrozen(low.position), true);
  }
});

test('action sequence scales in, holds, overshoots, scales out, and completes once', () => {
  const state = new ComboItemPresentationState(
    createComboItemPresentationPlan(3, { x: 0, y: 0 }, 480),
  );
  assert.deepEqual(state.snapshot, {
    complete: false,
    disposed: false,
    elapsedActionSeconds: 0,
    scale: 0,
  });

  let update = state.updateAction(COMBO_ITEM_SCALE_IN_SECONDS / 2);
  assert.equal(update.completedNow, false);
  assert.ok(Math.abs(update.snapshot.scale - 0.5) < 1e-6);

  update = state.updateAction(COMBO_ITEM_SCALE_IN_SECONDS / 2);
  assert.equal(update.snapshot.scale, 1);

  update = state.updateAction(COMBO_ITEM_HOLD_SECONDS);
  assert.equal(update.snapshot.scale, 1);

  update = state.updateAction(COMBO_ITEM_OVERSHOOT_SECONDS);
  assert.ok(Math.abs(update.snapshot.scale - COMBO_ITEM_OVERSHOOT_SCALE) < 1e-6);

  update = state.updateAction(COMBO_ITEM_SCALE_OUT_SECONDS);
  assert.equal(update.completedNow, true);
  assert.equal(update.snapshot.complete, true);
  assert.equal(update.snapshot.scale, 0);
  assert.ok(Math.abs(update.snapshot.elapsedActionSeconds - COMBO_ITEM_TOTAL_SECONDS) < 1e-6);

  assert.equal(state.updateAction(10).completedNow, false);
  assert.equal(state.dispose(), true);
  assert.equal(state.dispose(), false);
  assert.equal(state.snapshot.disposed, true);
});

test('scale projection supports partial phases and oversized completion deltas', () => {
  const scaleInHalf = comboItemScaleAt(COMBO_ITEM_SCALE_IN_SECONDS / 2);
  assert.ok(Math.abs(scaleInHalf - 0.5) < 1e-6);

  const overshootHalf = comboItemScaleAt(
    COMBO_ITEM_SCALE_IN_SECONDS
      + COMBO_ITEM_HOLD_SECONDS
      + COMBO_ITEM_OVERSHOOT_SECONDS / 2,
  );
  assert.ok(Math.abs(overshootHalf - 1.075) < 1e-5);

  const scaleOutHalf = comboItemScaleAt(
    COMBO_ITEM_SCALE_IN_SECONDS
      + COMBO_ITEM_HOLD_SECONDS
      + COMBO_ITEM_OVERSHOOT_SECONDS
      + COMBO_ITEM_SCALE_OUT_SECONDS / 2,
  );
  assert.ok(Math.abs(scaleOutHalf - COMBO_ITEM_OVERSHOOT_SCALE / 2) < 1e-5);

  const state = new ComboItemPresentationState(
    createComboItemPresentationPlan(12, { x: 1, y: 2 }, 720),
  );
  const update = state.updateAction(60);
  assert.equal(update.completedNow, true);
  assert.equal(update.snapshot.elapsedActionSeconds, COMBO_ITEM_TOTAL_SECONDS);
  assert.equal(update.snapshot.scale, 0);
});

test('invalid combo plans and action deltas fail before mutation', () => {
  assert.throws(
    () => createComboItemPresentationPlan(2, { x: 0, y: 0 }, 480),
    /at least 3/,
  );
  assert.throws(
    () => createComboItemPresentationPlan(3, { x: Number.NaN, y: 0 }, 480),
    /position\.x must be finite/,
  );
  assert.throws(
    () => createComboItemPresentationPlan(3, { x: 0, y: 0 }, 0),
    /viewportWidth must be positive/,
  );

  const state = new ComboItemPresentationState(
    createComboItemPresentationPlan(3, { x: 0, y: 0 }, 480),
  );
  assert.throws(() => state.updateAction(-1), /non-negative/);
  assert.deepEqual(state.snapshot, {
    complete: false,
    disposed: false,
    elapsedActionSeconds: 0,
    scale: 0,
  });
});
