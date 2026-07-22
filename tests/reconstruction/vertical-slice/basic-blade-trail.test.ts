import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BASIC_BLADE_LEGACY_VERTEX_CAPACITY_BYTES,
  BASIC_BLADE_LEGACY_VERTEX_STRIDE_BYTES,
  BASIC_BLADE_POINT_LIMIT,
  BASIC_BLADE_SLOT_COUNT,
  BasicBladeTrailModel,
  createBasicBladeGeometry,
  getBasicBladeDefaultWidth,
} from '../../../game/assets/scripts/domain/basic-blade-trail.ts';

test('default width uses the recovered float32 slope and slot count stays four', () => {
  assert.equal(BASIC_BLADE_SLOT_COUNT, 4);
  assert.equal(BASIC_BLADE_POINT_LIMIT, 10);
  assert.equal(BASIC_BLADE_LEGACY_VERTEX_STRIDE_BYTES, 20);
  assert.equal(BASIC_BLADE_LEGACY_VERTEX_CAPACITY_BYTES, 500);
  assert.equal(getBasicBladeDefaultWidth(480), 3.5);
  assert.equal(getBasicBladeDefaultWidth(720), 4.099999904632568);
  assert.equal(
    getBasicBladeDefaultWidth(653.1628029005719),
    3.9329071044921875,
  );
});

test('basic trail slots begin empty, accept repeats, retain the newest nine points, and dispose by frame', () => {
  const model = new BasicBladeTrailModel(480);

  assert.equal(model.baseWidth, 3.5);
  assert.equal(model.snapshot().length, 4);
  assert.deepEqual(model.snapshot().map((slot) => ({
    claimed: slot.claimed,
    currentWidth: slot.currentWidth,
    geometry: slot.geometry,
    points: slot.points.length,
    slot: slot.slot,
    state: slot.state,
  })), [
    { claimed: false, currentWidth: 3.5, geometry: null, points: 0, slot: 0, state: 0 },
    { claimed: false, currentWidth: 3.5, geometry: null, points: 0, slot: 1, state: 0 },
    { claimed: false, currentWidth: 3.5, geometry: null, points: 0, slot: 2, state: 0 },
    { claimed: false, currentWidth: 3.5, geometry: null, points: 0, slot: 3, state: 0 },
  ]);

  model.begin(0);
  assert.equal(model.snapshot()[0]?.claimed, true);
  assert.equal(model.snapshot()[0]?.points.length, 0);
  assert.throws(() => model.begin(0), /already claimed/);

  model.move(0, point(0));
  model.move(0, point(0));
  for (let x = 2; x <= 10; x += 1) {
    model.move(0, point(x));
  }

  const active = model.snapshot()[0];
  assert.equal(active.points.length, 9);
  assert.deepEqual(active.points.map(({ x }) => x), [2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(active.geometry?.vertices.length, 16);

  model.end(0);
  assert.equal(model.snapshot()[0]?.state, 4);
  assert.equal(model.snapshot()[0]?.claimed, false);

  let expectedWidth = 3.5;
  const firstFrame = model.updateFrame();
  assert.deepEqual(firstFrame, [0]);
  expectedWidth = reducedWidth(expectedWidth);
  assert.equal(model.snapshot()[0]?.currentWidth, expectedWidth);
  assert.equal(model.snapshot()[0]?.points.length, 8);
  assert.equal(model.geometry(0)?.geometryWidth, 3.5);

  for (let frame = 2; frame <= 8; frame += 1) {
    const changed = model.updateFrame();
    assert.deepEqual(changed, [0]);
    expectedWidth = reducedWidth(expectedWidth);
    assert.equal(model.snapshot()[0]?.currentWidth, expectedWidth);
  }

  assert.equal(model.snapshot()[0]?.points.length, 1);
  assert.equal(model.geometry(0), null);

  const reset = model.updateFrame();
  assert.deepEqual(reset, [0]);
  assert.deepEqual(model.snapshot()[0], {
    claimed: false,
    currentWidth: 3.5,
    geometry: null,
    points: [],
    slot: 0,
    state: 0,
  });
});

test('four slots stay isolated and a freed disposing slot is reclaimed only on its first valid move', () => {
  const model = new BasicBladeTrailModel(720);

  for (let slot = 0; slot < BASIC_BLADE_SLOT_COUNT; slot += 1) {
    model.begin(slot);
    model.move(slot, point(slot * 100 + 1, slot));
    model.move(slot, point(slot * 100 + 2, slot));
    model.move(slot, point(slot * 100 + 3, slot));
  }

  assert.deepEqual(
    model.snapshot().map((slot) => slot.points.map(({ x }) => x)),
    [[1, 2, 3], [101, 102, 103], [201, 202, 203], [301, 302, 303]],
  );
  assert.throws(() => model.begin(1), /already claimed/);

  model.end(2);
  model.begin(2);
  assert.deepEqual(model.snapshot()[2], {
    claimed: true,
    currentWidth: 4.099999904632568,
    geometry: model.geometry(2),
    points: [point(201, 2), point(202, 2), point(203, 2)],
    slot: 2,
    state: 4,
  });

  const beforeInvalidMove = model.snapshot()[2];
  assert.throws(() => model.move(2, point(Number.NaN, 2)), /point\.x must be finite/);
  assert.deepEqual(model.snapshot()[2], beforeInvalidMove);

  model.move(2, point(999, 9));
  assert.deepEqual(model.snapshot()[2], {
    claimed: true,
    currentWidth: 4.099999904632568,
    geometry: null,
    points: [point(999, 9)],
    slot: 2,
    state: 0,
  });
  assert.deepEqual(
    model.snapshot().map((slot) => slot.points.map(({ x }) => x)),
    [[1, 2, 3], [101, 102, 103], [999], [301, 302, 303]],
  );
});

test('degenerate three-point trails still emit four vertices, and four-point trails preserve horizontal, vertical, and zero-length cross-sections', () => {
  const degenerate = createBasicBladeGeometry([
    point(0),
    point(10),
    point(20),
  ], 4);

  assert.ok(degenerate);
  assert.equal(degenerate.geometryWidth, 4);
  assert.equal(degenerate.legacyVertexStrideBytes, 20);
  assert.equal(degenerate.primitive, 'triangle-strip');
  assert.equal(degenerate.vertices.length, 4);
  assert.deepEqual(snapshotPositions(degenerate), [
    [0, 0],
    [10, 0],
    [10, 0],
    [20, 0],
  ]);
  assert.deepEqual(snapshotUvs(degenerate), [
    [0.5, 0.5],
    [0.25, 1],
    [0.25, 0],
    [1, 0.5],
  ]);

  const horizontal = createBasicBladeGeometry([
    point(0),
    point(10),
    point(20),
    point(30),
  ], 4);
  assert.ok(horizontal);
  assert.equal(horizontal.vertices.length, 6);
  assert.deepEqual(snapshotPositions(horizontal), [
    [0, 0],
    [10, 0],
    [10, 0],
    [20, 8],
    [20, -8],
    [30, 0],
  ]);
  assert.deepEqual(snapshotUvs(horizontal), [
    [0.5, 0.5],
    [0.25, 1],
    [0.25, 0],
    [0.25, 1],
    [0.25, 0],
    [1, 0.5],
  ]);

  const vertical = createBasicBladeGeometry([
    point(0),
    point(10),
    point(10, 10),
    point(10, 20),
  ], 4);
  assert.ok(vertical);
  assert.deepEqual(snapshotPositions(vertical), [
    [0, 0],
    [10, 0],
    [10, 0],
    [2, 10],
    [18, 10],
    [10, 20],
  ]);
  assert.deepEqual(snapshotUvs(vertical), [
    [0.5, 0.5],
    [0.25, 1],
    [0.25, 0],
    [0.25, 1],
    [0.25, 0],
    [1, 0.5],
  ]);

  const zeroLength = createBasicBladeGeometry([
    point(0),
    point(10),
    point(10),
    point(20),
  ], 4);
  assert.ok(zeroLength);
  assert.deepEqual(snapshotPositions(zeroLength), [
    [0, 0],
    [10, 0],
    [10, 0],
    [10, 8],
    [10, -8],
    [20, 0],
  ]);
  assert.deepEqual(snapshotUvs(zeroLength), [
    [0.5, 0.5],
    [0.25, 1],
    [0.25, 0],
    [0.25, 1],
    [0.25, 0],
    [1, 0.5],
  ]);

  const fivePoint = createBasicBladeGeometry([
    point(0),
    point(10),
    point(20),
    point(30),
    point(40),
  ], 4);
  assert.ok(fivePoint);
  assert.deepEqual(snapshotUvs(fivePoint), [
    [0.5, 0.5],
    [0.25, 1],
    [0.25, 0],
    [0.20000000298023224, 1],
    [0.20000000298023224, 0],
    [0.30000001192092896, 1],
    [0.30000001192092896, 0],
    [1, 0.5],
  ]);
});

function point(x: number, y = 0) {
  return Object.freeze({ x, y });
}

function snapshotPositions(
  geometry: NonNullable<ReturnType<typeof createBasicBladeGeometry>>,
): readonly [number, number][] {
  return geometry.vertices.map(({ position }) => [position.x, position.y]);
}

function snapshotUvs(
  geometry: NonNullable<ReturnType<typeof createBasicBladeGeometry>>,
): readonly [number, number][] {
  return geometry.vertices.map(({ alphaUv }) => [alphaUv.u, alphaUv.v]);
}

function reducedWidth(width: number): number {
  return Math.fround(width / Math.fround(1.1));
}
