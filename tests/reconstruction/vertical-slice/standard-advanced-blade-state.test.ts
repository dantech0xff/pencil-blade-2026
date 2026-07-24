import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STANDARD_ADVANCED_BLADE_BASE_OVERFLOW_COUNT,
  STANDARD_ADVANCED_BLADE_CONFIGURED_POINT_CAPACITY,
  STANDARD_ADVANCED_BLADE_SLOT_COUNT,
  StandardAdvancedBladeState,
} from '../../../game/assets/scripts/domain/standard-advanced-blade-state.ts';

const SPRITE_WIDTHS = Object.freeze({
  body: 12,
  head: 40,
  tail: 20,
});

test('family metadata and all four initial slots expose the recovered capacities', () => {
  const dragon = new StandardAdvancedBladeState('dragon', SPRITE_WIDTHS);

  assert.equal(STANDARD_ADVANCED_BLADE_SLOT_COUNT, 4);
  assert.equal(STANDARD_ADVANCED_BLADE_CONFIGURED_POINT_CAPACITY, 32);
  assert.equal(STANDARD_ADVANCED_BLADE_BASE_OVERFLOW_COUNT, 11);
  assert.equal(dragon.family, 'dragon');
  assert.equal(dragon.slotCount, 4);
  assert.equal(dragon.configuredPointCapacity, 32);
  assert.equal(dragon.step, 20);
  assert.equal(dragon.wavedPointCapacity, 15);
  assert.deepEqual(dragon.spriteWidths, SPRITE_WIDTHS);
  assert.deepEqual(dragon.snapshot().map((slot) => ({
    basePoints: slot.basePoints,
    claimed: slot.claimed,
    configuredPointCapacity: slot.configuredPointCapacity,
    family: slot.family,
    layout: slot.layout,
    opacity: slot.opacity,
    phase: slot.phase,
    slot: slot.slot,
    state: slot.state,
    wavedPointCapacity: slot.wavedPointCapacity,
    wavedPoints: slot.wavedPoints,
  })), [0, 1, 2, 3].map((slot) => ({
    basePoints: [],
    claimed: false,
    configuredPointCapacity: 32,
    family: 'dragon',
    layout: {
      bodies: [],
      bodyPoolSize: 15,
      head: null,
      tail: null,
      visible: false,
    },
    opacity: 255,
    phase: 0,
    slot,
    state: 0,
    wavedPointCapacity: 15,
    wavedPoints: [],
  })));

  const centipede = new StandardAdvancedBladeState('centipede', SPRITE_WIDTHS);
  assert.equal(centipede.step, 10);
  assert.equal(centipede.wavedPointCapacity, 20);
  assert.equal(centipede.snapshot()[0]?.layout.bodyPoolSize, 20);
});

test('Push keeps residual distance, appends only final straight anchors, and preserves phase', () => {
  const model = new StandardAdvancedBladeState('dragon', SPRITE_WIDTHS);
  model.begin(0);

  assert.equal(model.move(0, point(0)).visible, false);
  model.move(0, point(39));
  assert.equal(model.layout(0).visible, false);
  assert.deepEqual(pathSnapshot(model, 0), {
    base: [[0, 0], [20.000001907348633, 0]],
    phase: 20,
    waved: [[0, 0], [20.000001907348633, 0]],
  });

  model.move(0, point(39));
  assert.deepEqual(pathSnapshot(model, 0), {
    base: [[0, 0], [20.000001907348633, 0]],
    phase: 20,
    waved: [[0, 0], [20.000001907348633, 0]],
  });

  model.move(0, point(61));
  assert.deepEqual(pathSnapshot(model, 0), {
    base: [[0, 0], [20.000001907348633, 0], [60, 0]],
    phase: 60,
    waved: [
      [0, 0],
      [20.000001907348633, 0],
      [40, -7.595484733581543],
      [60, -13.099458694458008],
    ],
  });
  assert.equal(model.snapshot()[0]?.state, 2);
});

test('Dragon float and Centipede double trig boundaries remain observably distinct', () => {
  const dragon = new StandardAdvancedBladeState('dragon', SPRITE_WIDTHS);
  dragon.begin(0);
  dragon.move(0, point(0));
  dragon.move(0, point(60));

  const centipede = new StandardAdvancedBladeState('centipede', SPRITE_WIDTHS);
  centipede.begin(0);
  centipede.move(0, point(0));
  centipede.move(0, point(50));

  const dragonWaveAtPhase40 = dragon.snapshot()[0]?.wavedPoints.at(-1)?.y;
  const centipedeWaveAtPhase40 = centipede.snapshot()[0]?.wavedPoints.at(-1)?.y;
  assert.equal(dragonWaveAtPhase40, -13.099458694458008);
  assert.equal(centipedeWaveAtPhase40, -13.099459648132324);
  assert.notEqual(dragonWaveAtPhase40, centipedeWaveAtPhase40);

  const dragonAngle = new StandardAdvancedBladeState('dragon', SPRITE_WIDTHS);
  dragonAngle.begin(0);
  dragonAngle.move(0, point(0));
  dragonAngle.move(0, point(40, -199.9117660522461));

  const centipedeAngle = new StandardAdvancedBladeState('centipede', SPRITE_WIDTHS);
  centipedeAngle.begin(0);
  centipedeAngle.move(0, point(0));
  centipedeAngle.move(0, point(20, -99.95588302612305));

  const dragonRotation = dragonAngle.layout(0).bodies
    .find(({ bodyIndex }) => bodyIndex === 1)?.rotationDegrees;
  const centipedeRotation = centipedeAngle.layout(0).bodies
    .find(({ bodyIndex }) => bodyIndex === 1)?.rotationDegrees;
  assert.equal(dragonRotation, 258.6852111816406);
  assert.equal(centipedeRotation, 258.6851806640625);
  assert.notEqual(dragonRotation, centipedeRotation);
});

for (const contract of [
  { family: 'dragon', cap: 15, step: 20 },
  { family: 'centipede', cap: 20, step: 10 },
] as const) {
  test(`${contract.family} caps Q synchronously while scheduled updates pop only one old B`, () => {
    const model = new StandardAdvancedBladeState(contract.family, SPRITE_WIDTHS);
    model.begin(0);
    model.move(0, point(0));
    for (let index = 1; index <= 25; index += 1) {
      model.move(0, point(index * contract.step));
    }

    assert.equal(model.snapshot()[0]?.basePoints.length, 26);
    assert.equal(model.snapshot()[0]?.wavedPoints.length, contract.cap);
    assert.equal(model.layout(0).bodies.length, contract.cap - 1);

    for (let expectedCount = 25; expectedCount >= 10; expectedCount -= 1) {
      assert.deepEqual(model.updateFrame(), [0]);
      assert.equal(model.snapshot()[0]?.basePoints.length, expectedCount);
      assert.equal(model.snapshot()[0]?.wavedPoints.length, contract.cap);
    }
    assert.deepEqual(model.updateFrame(), []);
    assert.equal(model.snapshot()[0]?.basePoints.length, 10);
  });
}

test('Dragon emits exact visible head, body, and tail transforms from Q rather than B', () => {
  const model = new StandardAdvancedBladeState('dragon', SPRITE_WIDTHS);
  model.begin(0);
  model.move(0, point(0));
  model.move(0, point(40));

  assert.deepEqual(model.layout(0), {
    bodies: [
      {
        bodyIndex: 2,
        opacity: 255,
        position: { x: 30, y: -3.7977423667907715 },
        rotationDegrees: 200.7954864501953,
        scale: 1,
        visible: true,
      },
      {
        bodyIndex: 1,
        opacity: 255,
        position: { x: 10, y: 0 },
        rotationDegrees: -180,
        scale: 0.6666666865348816,
        visible: true,
      },
    ],
    bodyPoolSize: 15,
    head: {
      opacity: 255,
      position: { x: 49.663299560546875, y: -11.265357971191406 },
      rotationDegrees: 200.7954864501953,
      scale: 1,
      visible: true,
    },
    tail: {
      opacity: 255,
      position: { x: -10, y: 0 },
      rotationDegrees: -180,
      scale: 1,
      visible: true,
    },
    visible: true,
  });
});

test('Centipede uses unit body scale and its exact width-dependent terminal transforms', () => {
  const model = new StandardAdvancedBladeState('centipede', SPRITE_WIDTHS);
  model.begin(0);
  model.move(0, point(0));
  model.move(0, point(20));

  assert.deepEqual(model.layout(0), {
    bodies: [
      {
        bodyIndex: 2,
        opacity: 255,
        position: { x: 15, y: -1.9678113460540771 },
        rotationDegrees: 201.48272705078125,
        scale: 1,
        visible: true,
      },
      {
        bodyIndex: 1,
        opacity: 255,
        position: { x: 5, y: 0 },
        rotationDegrees: -180,
        scale: 1,
        visible: true,
      },
    ],
    bodyPoolSize: 20,
    head: {
      opacity: 255,
      position: { x: 26.50478744506836, y: -6.495661735534668 },
      rotationDegrees: 201.48272705078125,
      scale: 1,
      visible: true,
    },
    tail: {
      opacity: 255,
      position: { x: -6.6666669845581055, y: 0 },
      rotationDegrees: -180,
      scale: 1,
      visible: true,
    },
    visible: true,
  });
});

for (const contract of [
  { family: 'dragon', disposalOpacity: 239, step: 20 },
  { family: 'centipede', disposalOpacity: 244, step: 10 },
] as const) {
  test(`${contract.family} disposal clears Q, remains state 4, and resets on the next valid Push`, () => {
    const model = new StandardAdvancedBladeState(contract.family, SPRITE_WIDTHS);
    model.begin(0);
    model.move(0, point(0));
    model.move(0, point(contract.step));
    model.end(0);

    assert.equal(model.isClaimed(0), false);
    assert.deepEqual(model.updateFrame(), [0]);
    assert.deepEqual(disposalSnapshot(model, 0), {
      baseCount: 2,
      claimed: false,
      opacity: contract.disposalOpacity,
      state: 4,
      visible: false,
      wavedCount: 0,
    });
    assert.deepEqual(model.updateFrame(), [0]);
    assert.deepEqual(disposalSnapshot(model, 0), {
      baseCount: 2,
      claimed: false,
      opacity: contract.disposalOpacity,
      state: 4,
      visible: false,
      wavedCount: 0,
    });

    model.begin(0);
    const beforeInvalidPush = model.snapshot()[0];
    assert.throws(() => model.move(0, point(Number.NaN)), /point\.x must be finite/);
    assert.deepEqual(model.snapshot()[0], beforeInvalidPush);

    model.move(0, point(999, 9));
    assert.deepEqual(pathSnapshot(model, 0), {
      base: [[999, 9]],
      phase: 0,
      waved: [[999, 9]],
    });
    assert.equal(model.snapshot()[0]?.opacity, 255);
    assert.equal(model.snapshot()[0]?.state, 2);
    assert.equal(model.isClaimed(0), true);
  });
}

test('disposing a one-anchor gesture performs the full SetNew reset', () => {
  const model = new StandardAdvancedBladeState('dragon', SPRITE_WIDTHS);
  model.begin(1);
  model.move(1, point(7, 8));
  model.end(1);

  assert.deepEqual(model.updateFrame(), [1]);
  assert.deepEqual(disposalSnapshot(model, 1), {
    baseCount: 0,
    claimed: false,
    opacity: 255,
    state: 0,
    visible: false,
    wavedCount: 0,
  });
});

test('slots stay isolated, public input fails closed, and snapshots are deeply immutable', () => {
  const model = new StandardAdvancedBladeState('dragon', SPRITE_WIDTHS);
  model.begin(0);
  model.begin(3);
  model.move(0, point(1, 2));
  model.move(3, point(301, 302));

  assert.deepEqual(model.snapshot().map((slot) => slot.basePoints), [
    [point(1, 2)],
    [],
    [],
    [point(301, 302)],
  ]);
  assert.throws(() => model.begin(0), /already claimed/);
  assert.throws(() => model.move(1, point(0)), /must be claimed before move/);
  assert.throws(() => model.end(2), /must be claimed before end/);
  assert.throws(() => model.begin(-1), /four advanced blade slots/);
  assert.throws(() => model.begin(4), /four advanced blade slots/);
  assert.throws(() => model.begin(1.5), /four advanced blade slots/);

  const beforeInvalidInputs = model.snapshot();
  assert.throws(() => model.move(0, null as never), /point must be an object/);
  assert.throws(() => model.move(0, point(Infinity)), /point\.x must be finite/);
  assert.throws(() => model.move(0, point(1e40)), /fit finite float32/);
  assert.throws(
    () => model.move(0, point(-1e19)),
    /move segment count must be a safe integer/,
  );
  assert.deepEqual(model.snapshot(), beforeInvalidInputs);

  assert.throws(
    () => new StandardAdvancedBladeState('other' as never, SPRITE_WIDTHS),
    /family must be either dragon or centipede/,
  );
  assert.throws(
    () => new StandardAdvancedBladeState('dragon', null as never),
    /spriteWidths must be an object/,
  );
  assert.throws(
    () => new StandardAdvancedBladeState('dragon', {
      ...SPRITE_WIDTHS,
      head: 0,
    }),
    /spriteWidths\.head must be a positive finite float32 value/,
  );
  assert.throws(
    () => new StandardAdvancedBladeState('dragon', {
      ...SPRITE_WIDTHS,
      tail: Infinity,
    }),
    /spriteWidths\.tail must be finite/,
  );

  const snapshots = model.snapshot();
  const first = snapshots[0];
  assert.ok(first);
  assert.equal(Object.isFrozen(snapshots), true);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.basePoints), true);
  assert.equal(Object.isFrozen(first.basePoints[0]), true);
  assert.equal(Object.isFrozen(first.layout), true);
  assert.equal(Object.isFrozen(first.layout.bodies), true);
  assert.throws(() => {
    (snapshots as unknown as unknown[]).push(null);
  }, TypeError);
  assert.throws(() => {
    (first.basePoints[0] as { x: number }).x = 999;
  }, TypeError);
  assert.deepEqual(model.snapshot()[0]?.basePoints, [point(1, 2)]);

  const visibleModel = new StandardAdvancedBladeState('dragon', SPRITE_WIDTHS);
  visibleModel.begin(0);
  visibleModel.move(0, point(0));
  const visibleLayout = visibleModel.move(0, point(40));
  assert.equal(Object.isFrozen(visibleLayout.head), true);
  assert.equal(Object.isFrozen(visibleLayout.tail), true);
  assert.equal(Object.isFrozen(visibleLayout.bodies[0]), true);
  assert.equal(Object.isFrozen(visibleLayout.bodies[0]?.position), true);
  assert.throws(() => {
    (visibleLayout.head?.position as { x: number }).x = 999;
  }, TypeError);
});

function point(x: number, y = 0) {
  return Object.freeze({ x, y });
}

function pathSnapshot(
  model: StandardAdvancedBladeState,
  slotIndex: number,
) {
  const slot = model.snapshot()[slotIndex];
  assert.ok(slot);
  return {
    base: slot.basePoints.map(({ x, y }) => [x, y]),
    phase: slot.phase,
    waved: slot.wavedPoints.map(({ x, y }) => [x, y]),
  };
}

function disposalSnapshot(
  model: StandardAdvancedBladeState,
  slotIndex: number,
) {
  const slot = model.snapshot()[slotIndex];
  assert.ok(slot);
  return {
    baseCount: slot.basePoints.length,
    claimed: slot.claimed,
    opacity: slot.opacity,
    state: slot.state,
    visible: slot.layout.visible,
    wavedCount: slot.wavedPoints.length,
  };
}
