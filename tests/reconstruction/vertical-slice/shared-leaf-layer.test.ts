import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SHARED_LEAF_ASSET_PROFILES,
  SHARED_LEAF_BODY_DEFAULTS,
  SHARED_LEAF_CREATION_ORDER,
  SHARED_LEAF_FIXTURE_DEFAULTS,
  SHARED_LEAF_ROTATION_DEGREES_PER_RADIAN,
  SHARED_LEAF_WORLD_CONFIGURATION,
  SharedLeafLayerModel,
  createSharedLeafVisibleGrid,
  sharedLeafRandomCoordinateToMetres,
  type SharedLeafAssetTree,
  type SharedLeafBodyState,
  type SharedLeafPhysicsBodyResult,
  type SharedLeafPhysicsStepPort,
  type SharedLeafRespawnCommand,
  type SharedLeafWorldStepCommand,
} from '../../../game/assets/scripts/domain/shared-leaf-layer.ts';

interface InclusiveCall {
  readonly maximumInclusive: number;
  readonly minimumInclusive: number;
}

class ScriptedRandom {
  readonly calls: InclusiveCall[] = [];
  private readonly draws: readonly number[];
  private readonly events: string[] | null;
  private offset = 0;

  constructor(draws: readonly number[], events: string[] | null = null) {
    this.draws = draws;
    this.events = events;
  }

  nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number {
    this.calls.push(Object.freeze({ maximumInclusive, minimumInclusive }));
    this.events?.push(`random:${minimumInclusive}:${maximumInclusive}`);
    const draw = this.draws[this.offset];
    if (draw === undefined) {
      throw new Error(`scripted random exhausted at draw ${this.offset}`);
    }
    this.offset += 1;
    return draw;
  }

  get consumedDrawCount(): number {
    return this.offset;
  }
}

const ASSET_ROWS = Object.freeze([
  Object.freeze({
    bytes: 5506,
    hash: '81e0350dbab6ce33a172bdb30549e57f8dec687c432168e97d66ca404f0c1359',
    height: 71,
    id: 7,
    width: 75,
  }),
  Object.freeze({
    bytes: 3515,
    hash: '64a7a8d44208ed22bf14c903b0e1faf8264aec9dfdc1eb8dfc0fa22b001a1bfa',
    height: 79,
    id: 1,
    width: 84,
  }),
  Object.freeze({
    bytes: 4415,
    hash: '994bcebea40a2e375a6d4ba9119c7ab256323041777ce5900b39dd24588edf9e',
    height: 64,
    id: 2,
    width: 69,
  }),
  Object.freeze({
    bytes: 7136,
    hash: 'cfc6f0b49b0461a3cb49fb10e822f909701cc5f282e18d7670f82176ac0c066d',
    height: 91,
    id: 3,
    width: 51,
  }),
  Object.freeze({
    bytes: 3815,
    hash: 'c091aace9ebe3038d51a975584e3845fd65a17d7574e6087b90eadfe8bee2846',
    height: 71,
    id: 4,
    width: 74,
  }),
  Object.freeze({
    bytes: 3992,
    hash: 'afce7fbd41f9be4c06d84244714ce76d474994829aa78d84612156b42184dd34',
    height: 69,
    id: 5,
    width: 79,
  }),
  Object.freeze({
    bytes: 5069,
    hash: 'd51294f17f57343b045d0ee0692c88970c5a26d2b631ccde5101c07c093de1ff',
    height: 70,
    id: 6,
    width: 66,
  }),
]);

test('both profiles expose exact byte-identical assets, dimensions, grids, and creation order', () => {
  assert.deepEqual(SHARED_LEAF_CREATION_ORDER, [
    'leave7',
    'leave1',
    'leave2',
    'leave3',
    'leave4',
    'leave5',
    'leave6',
  ]);

  for (const assetTree of ['480x800', '720x1280'] as const) {
    const profile = SHARED_LEAF_ASSET_PROFILES[assetTree];
    assert.deepEqual(
      profile.leaves.map((leaf) => ({
        bytes: leaf.byteLength,
        hash: leaf.sha256,
        height: leaf.heightWorldUnits,
        id: leaf.leafId,
        logicalPath: leaf.logicalPath,
        profilePath: leaf.profilePath,
        slotIndex: leaf.slotIndex,
        width: leaf.widthWorldUnits,
      })),
      ASSET_ROWS.map((row, slotIndex) => ({
        bytes: row.bytes,
        hash: row.hash,
        height: row.height,
        id: row.id,
        logicalPath: `Leaf/leave${row.id}.png`,
        profilePath: `${assetTree}/Leaf/leave${row.id}.png`,
        slotIndex,
        width: row.width,
      })),
    );
    assert.deepEqual(
      profile.leaves.map((leaf) => leaf.fixtureHalfExtentsMetres),
      ASSET_ROWS.map((row) => ({
        x: Math.fround(row.width / 64),
        y: Math.fround(row.height / 64),
      })),
    );
    assert.equal(Object.isFrozen(profile), true);
    assert.equal(Object.isFrozen(profile.leaves), true);
    assert.equal(profile.leaves.every(Object.isFrozen), true);
  }

  assert.deepEqual(SHARED_LEAF_ASSET_PROFILES['480x800'].visibleGrid, {
    bottomYWorldUnits: 0,
    heightWorldUnits: 800,
    randomXMaximumInclusive: 470,
    randomXMinimumInclusive: 10,
    randomYMaximumInclusive: 1600,
    randomYMinimumInclusive: 850,
    respawnBelowWorldY: -100,
    topYWorldUnits: 800,
    widthWorldUnits: 480,
  });
  assert.deepEqual(SHARED_LEAF_ASSET_PROFILES['720x1280'].visibleGrid, {
    bottomYWorldUnits: 0,
    heightWorldUnits: 1280,
    randomXMaximumInclusive: 710,
    randomXMinimumInclusive: 10,
    randomYMaximumInclusive: 2560,
    randomYMinimumInclusive: 1330,
    respawnBelowWorldY: -100,
    topYWorldUnits: 1280,
    widthWorldUnits: 720,
  });
});

test('world, body-definition, and fixture defaults preserve the recovered Leaf values', () => {
  assert.deepEqual(SHARED_LEAF_WORLD_CONFIGURATION, {
    allowSleep: true,
    continuousPhysics: true,
    gravityMetresPerSecondSquared: { x: 0, y: Math.fround(-0.15) },
    positionIterations: 5,
    velocityIterations: 5,
  });
  assert.deepEqual(SHARED_LEAF_BODY_DEFAULTS, {
    active: true,
    allowSleep: true,
    angleRadians: 0,
    angularDamping: 0,
    angularVelocityRadiansPerSecond: 0,
    awake: true,
    bodyType: 'dynamic',
    box2dTypeCode: 2,
    bullet: false,
    fixedRotation: false,
    gravityScale: 1,
    linearDamping: 0,
    linearVelocityMetresPerSecond: { x: 0, y: 0 },
    positionMetres: { x: 0, y: 0 },
  });
  assert.deepEqual(SHARED_LEAF_FIXTURE_DEFAULTS, {
    density: 1,
    filter: { categoryBits: 0, groupIndex: 0, maskBits: 0xffff },
    fixtureUserData: null,
    friction: Math.fround(0.5),
    restitution: 0,
    sensor: false,
    shapeType: 'box',
  });
  assert.equal(Object.isFrozen(SHARED_LEAF_WORLD_CONFIGURATION), true);
  assert.equal(Object.isFrozen(SHARED_LEAF_BODY_DEFAULTS), true);
  assert.equal(Object.isFrozen(SHARED_LEAF_FIXTURE_DEFAULTS), true);
});

test('construction consumes exactly x, y, angular draws per slot with profile-specific bounds', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    const grid = SHARED_LEAF_ASSET_PROFILES[assetTree].visibleGrid;
    const draws = Array.from({ length: 7 }, (_, slotIndex) => [
      slotIndex % 2 === 0 ? grid.randomXMinimumInclusive : grid.randomXMaximumInclusive,
      slotIndex % 2 === 0 ? grid.randomYMinimumInclusive : grid.randomYMaximumInclusive,
      slotIndex - 3,
    ]).flat();
    const random = new ScriptedRandom(draws);

    const model = new SharedLeafLayerModel({ assetTree, random });
    const snapshot = model.snapshot();

    assert.equal(random.consumedDrawCount, 21);
    assert.deepEqual(random.calls, Array.from({ length: 7 }, () => [
      {
        maximumInclusive: grid.randomXMaximumInclusive,
        minimumInclusive: grid.randomXMinimumInclusive,
      },
      {
        maximumInclusive: grid.randomYMaximumInclusive,
        minimumInclusive: grid.randomYMinimumInclusive,
      },
      { maximumInclusive: 25, minimumInclusive: -25 },
    ]).flat());
    assert.deepEqual(snapshot.slots.map((slot) => slot.asset.leafId), [7, 1, 2, 3, 4, 5, 6]);
    assert.deepEqual(snapshot.slots.map((slot) => slot.body.positionMetres),
      draws.filter((_, drawIndex) => drawIndex % 3 === 0).map((x, slotIndex) => ({
        x: Math.fround(Math.trunc(x / 32)),
        y: Math.fround(Math.trunc((draws[slotIndex * 3 + 1] as number) / 32)),
      })));
    assert.deepEqual(
      snapshot.slots.map((slot) => slot.body.angularVelocityRadiansPerSecond),
      [-3, -2, -1, 0, 1, 2, 3],
    );
    assert.equal(snapshot.slots.every((slot) => slot.body.awake), true);
    assert.equal(snapshot.slots.every((slot) => slot.body.angleRadians === 0), true);
    assert.equal(snapshot.slots.every((slot) => (
      slot.body.linearVelocityMetresPerSecond.x === 0
      && slot.body.linearVelocityMetresPerSecond.y === 0
    )), true);
    assert.equal(snapshot.slots.every((slot) => (
      slot.display.positionWorldUnits.x === Math.fround(slot.body.positionMetres.x * 32)
      && slot.display.positionWorldUnits.y === Math.fround(slot.body.positionMetres.y * 32)
      && slot.display.rotationDegrees === 0
      && slot.display.opacity === 32
    )), true);
  }
});

test('signed coordinate division truncates toward zero and canonicalizes zero', () => {
  const cases = [
    [-64, -2],
    [-32, -1],
    [-31, 0],
    [-1, 0],
    [0, 0],
    [1, 0],
    [31, 0],
    [32, 1],
    [64, 2],
  ] as const;

  for (const [worldUnits, expectedMetres] of cases) {
    const actual = sharedLeafRandomCoordinateToMetres(worldUnits);
    assert.equal(
      Object.is(actual, expectedMetres),
      true,
      `${worldUnits} world units should map to canonical ${expectedMetres}`,
    );
  }
});

test('custom visible bounds derive W/H/T/B formulas without assuming a zero origin', () => {
  const visibleBounds = {
    bottomYWorldUnits: -300,
    heightWorldUnits: 100,
    topYWorldUnits: -200,
    widthWorldUnits: 100,
  };
  const grid = createSharedLeafVisibleGrid(visibleBounds);
  const random = new ScriptedRandom(Array.from({ length: 7 }, () => [
    90,
    -150,
    0,
  ]).flat());

  const model = new SharedLeafLayerModel({
    assetTree: '480x800',
    random,
    visibleBounds,
  });

  assert.deepEqual(grid, {
    bottomYWorldUnits: -300,
    heightWorldUnits: 100,
    randomXMaximumInclusive: 90,
    randomXMinimumInclusive: 10,
    randomYMaximumInclusive: -100,
    randomYMinimumInclusive: -150,
    respawnBelowWorldY: -400,
    topYWorldUnits: -200,
    widthWorldUnits: 100,
  });
  assert.deepEqual(model.snapshot().visibleGrid, grid);
  assert.deepEqual(model.snapshot().slots[0]?.body.positionMetres, { x: 2, y: -4 });
  assert.deepEqual(random.calls.slice(0, 3), [
    { maximumInclusive: 90, minimumInclusive: 10 },
    { maximumInclusive: -100, minimumInclusive: -150 },
    { maximumInclusive: 25, minimumInclusive: -25 },
  ]);
});

test('RandomPosition changes only one stable slot and adds angular velocity', () => {
  const extraDraws = [330, 1000, 5];
  const random = new ScriptedRandom([...initialDraws('480x800', 2), ...extraDraws]);
  const model = new SharedLeafLayerModel({ assetTree: '480x800', random });
  const before = model.snapshot();

  const after = model.randomPosition(4);

  assert.equal(random.consumedDrawCount, 24);
  for (let slotIndex = 0; slotIndex < 7; slotIndex += 1) {
    if (slotIndex === 4) {
      assert.notEqual(after.slots[slotIndex], before.slots[slotIndex]);
    } else {
      assert.equal(after.slots[slotIndex], before.slots[slotIndex]);
    }
  }
  assert.deepEqual(after.slots[4]?.body, {
    angleRadians: 0,
    angularVelocityRadiansPerSecond: 7,
    awake: true,
    linearVelocityMetresPerSecond: { x: 0, y: 0 },
    positionMetres: { x: 10, y: 31 },
  });
  assert.deepEqual(after.slots[4]?.display.positionWorldUnits, { x: 320, y: 992 });
  assert.notEqual(after.slots[4]?.display, before.slots[4]?.display);
  assert.deepEqual(random.calls.slice(-3), [
    { maximumInclusive: 470, minimumInclusive: 10 },
    { maximumInclusive: 1600, minimumInclusive: 850 },
    { maximumInclusive: 25, minimumInclusive: -25 },
  ]);
});

test('respawn uses a strict lower threshold and is visible in the same rendered frame', () => {
  const events: string[] = [];
  const random = new ScriptedRandom(
    [...initialDraws('480x800', 0), 470, 1600, 0],
    events,
  );
  const model = new SharedLeafLayerModel({ assetTree: '480x800', random });
  events.length = 0;
  let callCount = 0;
  const physics: SharedLeafPhysicsStepPort = {
    applyRespawn: ignoreRespawn,
    step(command) {
      events.push('physics-step');
      const y = callCount === 0 ? Math.fround(-100 / 32) : Math.fround(-101 / 32);
      callCount += 1;
      return mapBodies(command, (body, slotIndex) => slotIndex === 0
        ? withBody(body, { positionMetres: { x: 2, y } })
        : body);
    },
  };

  const atBoundary = model.stepFrame(0, physics);
  assert.deepEqual(atBoundary.respawnedSlotIndices, []);
  assert.equal(atBoundary.snapshot.slots[0]?.display.positionWorldUnits.y, -100);
  assert.equal(random.consumedDrawCount, 21);
  assert.deepEqual(events, ['physics-step']);

  events.length = 0;
  const belowBoundary = model.stepFrame(0, physics);
  assert.deepEqual(belowBoundary.respawnedSlotIndices, [0]);
  assert.deepEqual(events, [
    'physics-step',
    'random:10:470',
    'random:850:1600',
    'random:-25:25',
  ]);
  assert.deepEqual(belowBoundary.snapshot.slots[0]?.display.positionWorldUnits, {
    x: 448,
    y: 1600,
  });
  assert.deepEqual(belowBoundary.snapshot.slots[0]?.body.positionMetres, { x: 14, y: 50 });
});

test('post-step respawn callbacks expose frozen operation order in child creation order', () => {
  const events: string[] = [];
  const random = new ScriptedRandom([
    ...initialDraws('480x800', 0),
    10, 850, 1,
    470, 1600, 4,
  ], events);
  const model = new SharedLeafLayerModel({ assetTree: '480x800', random });
  const beforeFrame = model.snapshot();
  const physicsBodies: SharedLeafBodyState[] = [];
  events.length = 0;
  const physics: SharedLeafPhysicsStepPort = {
    applyRespawn(command) {
      events.push(`respawn:${command.slotIndex}`);
      assert.equal(model.snapshot().slots, beforeFrame.slots);
      assert.equal(Object.isFrozen(command), true);
      assert.equal(Object.isFrozen(command.operations), true);
      assert.equal(command.operations.every(Object.isFrozen), true);
      assert.equal(Object.isFrozen(command.operations[2].positionMetres), true);
      assert.equal(Object.isFrozen(command.operations[3].velocityMetresPerSecond), true);
      let physicsBody = physicsBodies[command.slotIndex];
      assert.ok(physicsBody);
      for (const operation of command.operations) {
        events.push(`operation:${command.slotIndex}:${operation.type}`);
        switch (operation.type) {
          case 'wake-if-sleeping':
            if (!physicsBody.awake) {
              physicsBody = withBody(physicsBody, { awake: true });
            }
            break;
          case 'add-angular-velocity':
            physicsBody = withBody(physicsBody, {
              angularVelocityRadiansPerSecond: addFloat32(
                physicsBody.angularVelocityRadiansPerSecond,
                operation.deltaRadiansPerSecond,
              ),
            });
            break;
          case 'set-transform':
            physicsBody = withBody(physicsBody, {
              angleRadians: operation.angleRadians,
              positionMetres: operation.positionMetres,
            });
            break;
          case 'set-linear-velocity':
            physicsBody = withBody(physicsBody, {
              linearVelocityMetresPerSecond: operation.velocityMetresPerSecond,
            });
            break;
        }
      }
      physicsBodies[command.slotIndex] = physicsBody;
    },
    step(command) {
      events.push('physics-step');
      const results = mapBodies(command, (body, slotIndex) => (
        slotIndex === 4 || slotIndex === 1
          ? withBody(body, {
              awake: slotIndex !== 1,
              linearVelocityMetresPerSecond: { x: 3, y: -4 },
              positionMetres: { x: slotIndex, y: -4 },
            })
          : body
      ));
      physicsBodies.push(...results.map(({ body }) => body));
      return results;
    },
  };

  const result = model.stepFrame(0.25, physics);

  assert.deepEqual(result.respawnedSlotIndices, [1, 4]);
  assert.deepEqual(result.respawnCommands.map(({ slotIndex }) => slotIndex), [1, 4]);
  assert.equal(Object.isFrozen(result.respawnCommands), true);
  assert.deepEqual(events, [
    'physics-step',
    'random:10:470',
    'random:850:1600',
    'random:-25:25',
    'respawn:1',
    'operation:1:wake-if-sleeping',
    'operation:1:add-angular-velocity',
    'operation:1:set-transform',
    'operation:1:set-linear-velocity',
    'random:10:470',
    'random:850:1600',
    'random:-25:25',
    'respawn:4',
    'operation:4:wake-if-sleeping',
    'operation:4:add-angular-velocity',
    'operation:4:set-transform',
    'operation:4:set-linear-velocity',
  ]);
  assert.deepEqual(result.respawnCommands[0], {
    operations: [
      { type: 'wake-if-sleeping' },
      { deltaRadiansPerSecond: 1, type: 'add-angular-velocity' },
      { angleRadians: 0, positionMetres: { x: 0, y: 26 }, type: 'set-transform' },
      {
        type: 'set-linear-velocity',
        velocityMetresPerSecond: { x: 0, y: 0 },
      },
    ],
    slotIndex: 1,
    type: 'respawn-shared-leaf-body',
  });
  assert.deepEqual(result.snapshot.slots[1]?.body.positionMetres, { x: 0, y: 26 });
  assert.equal(result.snapshot.slots[1]?.body.angularVelocityRadiansPerSecond, 1);
  assert.deepEqual(result.snapshot.slots[4]?.body.positionMetres, { x: 14, y: 50 });
  assert.equal(result.snapshot.slots[4]?.body.angularVelocityRadiansPerSecond, 4);
  assert.deepEqual(physicsBodies[1], result.snapshot.slots[1]?.body);
  assert.deepEqual(physicsBodies[4], result.snapshot.slots[4]?.body);
});

test('respawn wakes a sleeping dynamic body even for zero increment and preserves angle', () => {
  const random = new ScriptedRandom([
    ...initialDraws('480x800', 0),
    100, 900, 0,
  ]);
  const model = new SharedLeafLayerModel({ assetTree: '480x800', random });
  const physics: SharedLeafPhysicsStepPort = {
    applyRespawn: ignoreRespawn,
    step(command) {
      return mapBodies(command, (body, slotIndex) => slotIndex === 3
        ? Object.freeze({
            angleRadians: Math.fround(1.25),
            angularVelocityRadiansPerSecond: Math.fround(7.5),
            awake: false,
            linearVelocityMetresPerSecond: Object.freeze({ x: 3, y: -4 }),
            positionMetres: Object.freeze({ x: 2, y: -4 }),
          })
        : body);
    },
  };

  const result = model.stepFrame(1 / 60, physics);
  const slot = result.snapshot.slots[3];

  assert.deepEqual(result.respawnedSlotIndices, [3]);
  assert.deepEqual(result.respawnCommands.map(({ slotIndex }) => slotIndex), [3]);
  assert.deepEqual(slot?.body, {
    angleRadians: Math.fround(1.25),
    angularVelocityRadiansPerSecond: Math.fround(7.5),
    awake: true,
    linearVelocityMetresPerSecond: { x: 0, y: 0 },
    positionMetres: { x: 3, y: 28 },
  });
  assert.deepEqual(slot?.display.positionWorldUnits, { x: 96, y: 896 });
  assert.equal(
    slot?.display.rotationDegrees,
    Math.fround(-Math.fround(Math.fround(1.25) * SHARED_LEAF_ROTATION_DEGREES_PER_RADIAN)),
  );
});

test('the physics port receives float32 dt/config and can drive float32 semi-implicit display data', () => {
  const random = new ScriptedRandom(initialDraws('720x1280', 3));
  const model = new SharedLeafLayerModel({ assetTree: '720x1280', random });
  const port = new ContactFreeFloat32TestPort();

  const result = model.stepFrame(1 / 60, port);
  const commandBody = result.stepCommand.bodies[0]?.body;
  const slot = result.snapshot.slots[0];
  assert.ok(commandBody);
  assert.ok(slot);

  const dt = Math.fround(1 / 60);
  const velocityY = addFloat32(
    commandBody.linearVelocityMetresPerSecond.y,
    multiplyFloat32(dt, Math.fround(-0.15)),
  );
  const expectedY = addFloat32(
    commandBody.positionMetres.y,
    multiplyFloat32(dt, velocityY),
  );
  const expectedAngle = addFloat32(
    commandBody.angleRadians,
    multiplyFloat32(dt, commandBody.angularVelocityRadiansPerSecond),
  );

  assert.equal(result.stepCommand.deltaSeconds, dt);
  assert.equal(result.stepCommand.type, 'step-shared-leaf-world');
  assert.equal(result.stepCommand.world, SHARED_LEAF_WORLD_CONFIGURATION);
  assert.equal(result.stepCommand.world.velocityIterations, 5);
  assert.equal(result.stepCommand.world.positionIterations, 5);
  assert.deepEqual(result.respawnCommands, []);
  assert.deepEqual(result.respawnedSlotIndices, []);
  assert.equal(slot.body.linearVelocityMetresPerSecond.y, velocityY);
  assert.equal(slot.body.positionMetres.y, expectedY);
  assert.equal(slot.body.angleRadians, expectedAngle);
  assert.equal(slot.display.positionWorldUnits.y, multiplyFloat32(expectedY, 32));
  assert.equal(
    slot.display.rotationDegrees,
    Math.fround(-multiplyFloat32(expectedAngle, SHARED_LEAF_ROTATION_DEGREES_PER_RADIAN)),
  );
  assert.equal(Object.isFrozen(result.stepCommand), true);
  assert.equal(Object.isFrozen(result.stepCommand.bodies), true);
  assert.equal(result.stepCommand.bodies.every(({ body }) => (
    Object.isFrozen(body)
    && Object.isFrozen(body.positionMetres)
    && Object.isFrozen(body.linearVelocityMetresPerSecond)
  )), true);
});

test('external physics steps cannot synchronously re-enter model mutation', () => {
  const random = new ScriptedRandom([
    ...initialDraws('480x800', 0),
    330, 1000, 5,
  ]);
  const model = new SharedLeafLayerModel({ assetTree: '480x800', random });
  const beforeStep = model.snapshot();
  let physics: SharedLeafPhysicsStepPort;
  physics = {
    applyRespawn: ignoreRespawn,
    step(command) {
      assert.throws(
        () => model.randomPosition(0),
        /mutation cannot be re-entered during stepFrame/,
      );
      assert.throws(
        () => model.stepFrame(0, physics),
        /mutation cannot be re-entered during stepFrame/,
      );
      assert.equal(model.snapshot().slots, beforeStep.slots);
      return command.bodies;
    },
  };

  const result = model.stepFrame(0, physics);

  assert.deepEqual(result.respawnCommands, []);
  assert.equal(random.consumedDrawCount, 21);
  assert.doesNotThrow(() => model.randomPosition(0));
  assert.equal(random.consumedDrawCount, 24);
});

test('malformed random, delta, port, and post-step data never partially mutate slots', () => {
  const random = new ScriptedRandom([...initialDraws('480x800', 0), Number.NaN]);
  const model = new SharedLeafLayerModel({ assetTree: '480x800', random });
  const initial = model.snapshot();

  assert.throws(() => model.randomPosition(2), TypeError);
  assert.equal(model.snapshot().slots, initial.slots);
  assert.throws(() => model.randomPosition(-1), RangeError);
  assert.equal(model.snapshot().slots, initial.slots);

  let stepCalls = 0;
  const countingPort: SharedLeafPhysicsStepPort = {
    applyRespawn: ignoreRespawn,
    step(command) {
      stepCalls += 1;
      return command.bodies;
    },
  };
  assert.throws(() => model.stepFrame(Number.NaN, countingPort), RangeError);
  assert.throws(() => model.stepFrame(-0.001, countingPort), RangeError);
  assert.throws(() => model.stepFrame(0, null as never), TypeError);
  assert.throws(() => model.stepFrame(0, {
    step(command) {
      return command.bodies;
    },
  } as never), /applyRespawn/);
  assert.equal(stepCalls, 0);
  assert.equal(model.snapshot().slots, initial.slots);

  assert.throws(() => model.stepFrame(0, {
    applyRespawn: ignoreRespawn,
    step(command) {
      return command.bodies.slice(0, 6);
    },
  }), /exactly 7/);
  assert.equal(model.snapshot().slots, initial.slots);

  assert.throws(() => model.stepFrame(0, {
    applyRespawn: ignoreRespawn,
    step(command) {
      return mapBodies(command, (body, slotIndex) => slotIndex === 6
        ? withBody(body, { angleRadians: Number.NaN })
        : body);
    },
  }), /angleRadians must be finite/);
  assert.equal(model.snapshot().slots, initial.slots);

  assert.throws(() => model.stepFrame(0, {
    applyRespawn: ignoreRespawn,
    step(command) {
      const results = mapBodies(command, (body) => body);
      return [results[1], results[0], ...results.slice(2)] as SharedLeafPhysicsBodyResult[];
    },
  }), /creation-order slot indices/);
  assert.equal(model.snapshot().slots, initial.slots);

  const failingFrameRandom = new ScriptedRandom([
    ...initialDraws('480x800', 0),
    10, 850, 1,
    Number.NaN,
  ]);
  const failingFrameModel = new SharedLeafLayerModel({
    assetTree: '480x800',
    random: failingFrameRandom,
  });
  const beforeFailedFrame = failingFrameModel.snapshot();
  assert.throws(() => failingFrameModel.stepFrame(0, {
    applyRespawn: ignoreRespawn,
    step(command) {
      return mapBodies(command, (body, slotIndex) => slotIndex < 2
        ? withBody(body, { positionMetres: { x: slotIndex, y: -4 } })
        : body);
    },
  }), TypeError);
  assert.equal(failingFrameRandom.consumedDrawCount, 25);
  assert.equal(failingFrameModel.snapshot().slots, beforeFailedFrame.slots);

  assert.throws(
    () => new SharedLeafLayerModel({ assetTree: 'wrong' as never, random }),
    /assetTree/,
  );
  assert.throws(
    () => new SharedLeafLayerModel({ assetTree: '480x800', random: null as never }),
    /random must provide/,
  );
  const untouchedRandom = new ScriptedRandom(initialDraws('480x800', 0));
  assert.throws(
    () => new SharedLeafLayerModel({
      assetTree: '480x800',
      random: untouchedRandom,
      visibleBounds: {
        bottomYWorldUnits: 0,
        heightWorldUnits: 40,
        topYWorldUnits: 0,
        widthWorldUnits: 19,
      },
    }),
    /random X minimum/,
  );
  assert.equal(untouchedRandom.consumedDrawCount, 0);
  assert.throws(() => sharedLeafRandomCoordinateToMetres(1.5), TypeError);
});

/**
 * Test-only compatibility port. It deliberately does not claim the bundled Box2D solver's
 * uncurated clamp/damping instruction order; it verifies the model faithfully transports
 * float32 contact-free post-step values into child display synchronization.
 */
class ContactFreeFloat32TestPort implements SharedLeafPhysicsStepPort {
  applyRespawn(command: SharedLeafRespawnCommand): void {
    throw new Error(`unexpected respawn for slot ${command.slotIndex}`);
  }

  step(command: SharedLeafWorldStepCommand): readonly SharedLeafPhysicsBodyResult[] {
    return mapBodies(command, (body) => {
      const velocityX = addFloat32(
        body.linearVelocityMetresPerSecond.x,
        multiplyFloat32(
          command.deltaSeconds,
          command.world.gravityMetresPerSecondSquared.x,
        ),
      );
      const velocityY = addFloat32(
        body.linearVelocityMetresPerSecond.y,
        multiplyFloat32(
          command.deltaSeconds,
          command.world.gravityMetresPerSecondSquared.y,
        ),
      );
      return Object.freeze({
        angleRadians: addFloat32(
          body.angleRadians,
          multiplyFloat32(command.deltaSeconds, body.angularVelocityRadiansPerSecond),
        ),
        angularVelocityRadiansPerSecond: body.angularVelocityRadiansPerSecond,
        awake: body.awake,
        linearVelocityMetresPerSecond: Object.freeze({ x: velocityX, y: velocityY }),
        positionMetres: Object.freeze({
          x: addFloat32(
            body.positionMetres.x,
            multiplyFloat32(command.deltaSeconds, velocityX),
          ),
          y: addFloat32(
            body.positionMetres.y,
            multiplyFloat32(command.deltaSeconds, velocityY),
          ),
        }),
      });
    });
  }
}

function initialDraws(assetTree: SharedLeafAssetTree, angularIncrement: number): number[] {
  const grid = SHARED_LEAF_ASSET_PROFILES[assetTree].visibleGrid;
  return Array.from({ length: 7 }, (_, slotIndex) => [
    grid.randomXMinimumInclusive + slotIndex * 32,
    grid.randomYMinimumInclusive + slotIndex * 32,
    angularIncrement,
  ]).flat();
}

function mapBodies(
  command: SharedLeafWorldStepCommand,
  transform: (body: SharedLeafBodyState, slotIndex: number) => SharedLeafBodyState,
): readonly SharedLeafPhysicsBodyResult[] {
  return Object.freeze(command.bodies.map(({ body, slotIndex }) => Object.freeze({
    body: transform(body, slotIndex),
    slotIndex,
  })));
}

function withBody(
  body: SharedLeafBodyState,
  overrides: Partial<SharedLeafBodyState>,
): SharedLeafBodyState {
  return Object.freeze({
    angleRadians: overrides.angleRadians ?? body.angleRadians,
    angularVelocityRadiansPerSecond:
      overrides.angularVelocityRadiansPerSecond ?? body.angularVelocityRadiansPerSecond,
    awake: overrides.awake ?? body.awake,
    linearVelocityMetresPerSecond:
      overrides.linearVelocityMetresPerSecond ?? body.linearVelocityMetresPerSecond,
    positionMetres: overrides.positionMetres ?? body.positionMetres,
  });
}

function ignoreRespawn(_command: SharedLeafRespawnCommand): void {}

function addFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) + Math.fround(right));
}

function multiplyFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) * Math.fround(right));
}
