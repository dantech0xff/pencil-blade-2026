import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LOWER_BOUNDS_RATIO,
  UPPER_BOUNDS_RATIO,
  createClassicBoundsCommands,
} from '../../../game/assets/scripts/domain/classic-bounds.ts';
import {
  BOMB_COLLISION_FILTER,
  CLASSIC_CONTACT_PAIR_OUTCOMES,
  ELECTRIC_COLLISION_FILTER,
  ELECTRIC_FIELD_NODE_TAG,
  FRUIT_COLLISION_FILTER,
  createBombFixtureConfiguration,
  createFruitFixtureConfiguration,
  describeElectricFieldCompatibility,
  evaluateClassicContactPair,
  evaluateContactFilter,
} from '../../../game/assets/scripts/domain/classic-fixture-rules.ts';

const DYNAMIC_BODY_AT_FRUIT_FACTORY_POSITION = Object.freeze({
  active: true,
  allowSleep: true,
  angleRadians: 0,
  angularDamping: 0,
  angularVelocityRadiansPerSecond: 0,
  awake: true,
  bodyType: 'dynamic',
  box2dTypeCode: 2,
  bodyUserData: 'owner',
  bullet: false,
  creatorPositionWorldUnits: { x: -480, y: -800 },
  fixedRotation: false,
  gravityScale: 1,
  linearDamping: 0,
  linearVelocityMetresPerSecond: { x: 0, y: 0 },
  positionMetres: { x: -15, y: -25 },
});

const COMMON_FIXTURE = Object.freeze({
  density: 1,
  fixtureUserData: null,
  friction: Math.fround(0.2),
  restitution: 0,
  sensor: false,
});

test('fruit IDs 1 and 2 use recovered box geometry and exact body/material/filter state', () => {
  for (const fruitId of [1, 2]) {
    const configuration = createFruitFixtureConfiguration({
      fruitId,
      spriteHeightWorldUnits: 96,
      spriteWidthWorldUnits: 64,
      viewportHeightWorldUnits: 800,
      viewportWidthWorldUnits: 480,
    });

    assert.deepEqual(configuration, {
      body: DYNAMIC_BODY_AT_FRUIT_FACTORY_POSITION,
      fixture: {
        ...COMMON_FIXTURE,
        filter: FRUIT_COLLISION_FILTER,
        shape: {
          type: 'box',
          centerMetres: { x: 0, y: 0 },
          creatorSizeWorldUnits: { height: 192, width: 128 },
          halfExtentsMetres: { x: 2, y: 3 },
        },
      },
      fruitId,
      kind: 'fruit',
    });
  }
});

test('all other valid fruit IDs use recovered circle geometry and invalid IDs reject', () => {
  for (let fruitId = 0; fruitId <= 14; fruitId += 1) {
    const configuration = createFruitFixtureConfiguration({
      fruitId,
      spriteHeightWorldUnits: 96,
      spriteWidthWorldUnits: 64,
      viewportHeightWorldUnits: 800,
      viewportWidthWorldUnits: 480,
    });
    assert.equal(configuration.fixture.shape.type, fruitId === 1 || fruitId === 2 ? 'box' : 'circle');
    if (fruitId !== 1 && fruitId !== 2) {
      assert.deepEqual(configuration.fixture.shape, {
        type: 'circle',
        centerMetres: { x: 0, y: 0 },
        creatorRadiusWorldUnits: 40,
        radiusMetres: 1.25,
      });
    }
  }

  assert.throws(() => createFruitFixtureConfiguration({
    fruitId: -1,
    spriteHeightWorldUnits: 96,
    spriteWidthWorldUnits: 64,
    viewportHeightWorldUnits: 800,
    viewportWidthWorldUnits: 480,
  }), RangeError);
  assert.throws(() => createFruitFixtureConfiguration({
    fruitId: 15,
    spriteHeightWorldUnits: 96,
    spriteWidthWorldUnits: 64,
    viewportHeightWorldUnits: 800,
    viewportWidthWorldUnits: 480,
  }), RangeError);
});

test('bomb IDs 0 and 1 use width/88 radius with exact initial state and filter', () => {
  for (const bombId of [0, 1]) {
    const configuration = createBombFixtureConfiguration({ bombId, spriteWidthWorldUnits: 88 });
    assert.deepEqual(configuration, {
      body: {
        ...DYNAMIC_BODY_AT_FRUIT_FACTORY_POSITION,
        creatorPositionWorldUnits: { x: 0, y: 0 },
        positionMetres: { x: 0, y: 0 },
      },
      bombId,
      fixture: {
        ...COMMON_FIXTURE,
        filter: BOMB_COLLISION_FILTER,
        shape: {
          type: 'circle',
          centerMetres: { x: 0, y: 0 },
          creatorRadiusWorldUnits: 32,
          radiusMetres: 1,
        },
      },
      kind: 'bomb',
    });
  }
  assert.throws(
    () => createBombFixtureConfiguration({ bombId: 2, spriteWidthWorldUnits: 88 }),
    RangeError,
  );
});

test('contact filters apply shared-group precedence before bilateral masks', () => {
  const positiveGroup = { categoryBits: 0, groupIndex: 2, maskBits: 0 };
  const negativeGroup = { categoryBits: 0, groupIndex: -2, maskBits: 0xffff };
  assert.deepEqual(evaluateContactFilter(positiveGroup, positiveGroup), {
    collides: true,
    rule: 'shared-group',
    sharedGroupIndex: 2,
  });
  assert.deepEqual(evaluateContactFilter(negativeGroup, negativeGroup), {
    collides: false,
    rule: 'shared-group',
    sharedGroupIndex: -2,
  });
  assert.deepEqual(evaluateContactFilter(
    { categoryBits: 0x0001, groupIndex: 0, maskBits: 0x0002 },
    { categoryBits: 0x0002, groupIndex: 0, maskBits: 0x0000 },
  ), {
    aAcceptsB: true,
    bAcceptsA: false,
    collides: false,
    rule: 'bilateral-masks',
  });
});

test('Classic fruit, bomb, and electric contact matrix matches bilateral filters', () => {
  const outcomes = {
    bombBomb: evaluateClassicContactPair('bomb', 'bomb').collides,
    bombElectric: evaluateClassicContactPair('bomb', 'electric').collides,
    electricElectric: evaluateClassicContactPair('electric', 'electric').collides,
    fruitBomb: evaluateClassicContactPair('fruit', 'bomb').collides,
    fruitElectric: evaluateClassicContactPair('fruit', 'electric').collides,
    fruitFruit: evaluateClassicContactPair('fruit', 'fruit').collides,
  };

  assert.deepEqual(outcomes, CLASSIC_CONTACT_PAIR_OUTCOMES);
  assert.deepEqual(FRUIT_COLLISION_FILTER, { categoryBits: 0x0001, groupIndex: 0, maskBits: 0xfffc });
  assert.deepEqual(BOMB_COLLISION_FILTER, { categoryBits: 0x0002, groupIndex: 0, maskBits: 0x0001 });
  assert.deepEqual(ELECTRIC_COLLISION_FILTER, { categoryBits: 0x0003, groupIndex: 0, maskBits: 0x0002 });
});

test('electric field remains non-instantiable with both compatibility issues explicit', () => {
  assert.deepEqual(describeElectricFieldCompatibility({
    viewportHeightWorldUnits: 800,
    viewportWidthWorldUnits: 480,
  }), {
    body: {
      active: false,
      bodyType: 'static',
      box2dTypeCode: 0,
      bodyUserData: 'owner',
      creatorPositionWorldUnits: { x: 240, y: 200 },
      positionMetres: { x: 7.5, y: 6.25 },
    },
    compatibilityStatus: 'unresolved',
    instantiable: false,
    kind: 'electric-field',
    nodeTag: ELECTRIC_FIELD_NODE_TAG,
    nominalFixture: {
      ...COMMON_FIXTURE,
      filter: ELECTRIC_COLLISION_FILTER,
      shape: {
        type: 'box',
        centerMetres: { x: 0, y: 0 },
        creatorSizeWorldUnits: { height: 0, width: 1920 },
        halfExtentsMetres: { x: 30, y: 0 },
      },
    },
    unresolvedReasons: [
      'degenerate-zero-height-shape',
      'unsafe-native-contact-layout',
    ],
  });
});

test('bounds are strict and stationary bodies skip all disposal checks', () => {
  const viewportWidth = 480;
  const viewportHeight = 800;
  const minimumX = Math.fround(-viewportWidth * LOWER_BOUNDS_RATIO);
  const minimumY = Math.fround(-viewportHeight * LOWER_BOUNDS_RATIO);
  const maximumX = Math.fround(viewportWidth * UPPER_BOUNDS_RATIO);
  const maximumY = Math.fround(viewportHeight * UPPER_BOUNDS_RATIO);
  const moving = { x: 1, y: 0 };
  const commandsAt = (x: number, y: number, velocity = moving) => createClassicBoundsCommands({
    linearVelocityMetresPerSecond: velocity,
    positionWorldUnits: { x, y },
    viewportHeightWorldUnits: viewportHeight,
    viewportWidthWorldUnits: viewportWidth,
  });

  assert.deepEqual(commandsAt(0, minimumY), []);
  assert.deepEqual(commandsAt(0, maximumY), []);
  assert.deepEqual(commandsAt(minimumX, 0), []);
  assert.deepEqual(commandsAt(maximumX, 0), []);
  assert.deepEqual(commandsAt(maximumX + 100, maximumY + 100, { x: 0, y: 0 }), []);
});

test('below fails before deferred disposal; other bounds only defer disposal', () => {
  const input = {
    linearVelocityMetresPerSecond: { x: 1, y: 1 },
    viewportHeightWorldUnits: 800,
    viewportWidthWorldUnits: 480,
  };

  assert.deepEqual(createClassicBoundsCommands({ ...input, positionWorldUnits: { x: -999, y: -999 } }), [
    { type: 'fail', positionWorldUnits: { x: -999, y: -999 } },
    { type: 'defer-dispose', boundary: 'below' },
  ]);
  assert.deepEqual(createClassicBoundsCommands({ ...input, positionWorldUnits: { x: 0, y: 999 } }), [
    { type: 'defer-dispose', boundary: 'above' },
  ]);
  assert.deepEqual(createClassicBoundsCommands({ ...input, positionWorldUnits: { x: -999, y: 0 } }), [
    { type: 'defer-dispose', boundary: 'left' },
  ]);
  assert.deepEqual(createClassicBoundsCommands({ ...input, positionWorldUnits: { x: 999, y: 0 } }), [
    { type: 'defer-dispose', boundary: 'right' },
  ]);
});
