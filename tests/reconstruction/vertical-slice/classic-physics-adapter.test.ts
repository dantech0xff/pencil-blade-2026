import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

import {
  BOMB_COLLISION_FILTER,
  FRUIT_COLLISION_FILTER,
} from '../../../game/assets/scripts/domain/classic-fixture-rules.ts';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const Director = Object.freeze({
  EVENT_AFTER_PHYSICS: 'after-physics',
  EVENT_BEFORE_PHYSICS: 'before-physics',
});
export const ERaycast2DType = Object.freeze({ All: 0 });
export class PhysicsSystem2D {}
PhysicsSystem2D.instance = null;
export class RigidBody2D {}
export class System {}
export const SystemPriority = Object.freeze({ LOW: 100 });
export class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
}
export const director = {
  registeredId: null,
  system: null,
  unregisterCalls: 0,
  emit() {},
  getSystem() { return this.system; },
  registerSystem(id, system) {
    this.registeredId = id;
    this.system = system;
  },
  unregisterSystem(system) {
    if (this.system === system) {
      this.system = null;
    }
    this.unregisterCalls += 1;
  },
};
`)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') {
      return { shortCircuit: true, url: CC_STUB_URL };
    }
    if (
      (specifier.startsWith('./') || specifier.startsWith('../'))
      && extname(specifier) === ''
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { ClassicPhysicsAdapter } = await import(
  '../../../game/assets/scripts/creator/classic-physics-adapter.ts'
);
const { director } = await import('cc') as {
  director: {
    registeredId: string | null;
    system: unknown;
    unregisterCalls: number;
  };
};

test('physics adapter installs and restores exact fruit and bomb collision-matrix rows', () => {
  const physics = createPhysicsStub();
  const originalFruitMask = physics.collisionMatrix[String(FRUIT_COLLISION_FILTER.categoryBits)];
  const originalBombMask = physics.collisionMatrix[String(BOMB_COLLISION_FILTER.categoryBits)];
  const adapter = new ClassicPhysicsAdapter(physics as never);

  adapter.configureResolvedWorldProperties();
  assert.equal(
    physics.collisionMatrix[String(FRUIT_COLLISION_FILTER.categoryBits)],
    FRUIT_COLLISION_FILTER.maskBits,
  );
  assert.equal(
    physics.collisionMatrix[String(BOMB_COLLISION_FILTER.categoryBits)],
    BOMB_COLLISION_FILTER.maskBits,
  );
  assert.equal(physics.resetAccumulatorCalls, 1);

  adapter.configureResolvedWorldProperties();
  assert.equal(physics.resetAccumulatorCalls, 1);
  adapter.startVariableSimulation((deltaSeconds) => deltaSeconds, () => {});
  assert.equal(director.registeredId, 'CLASSIC_VARIABLE_PHYSICS');
  assert.notEqual(director.system, null);
  adapter.restorePreviousWorldProperties();
  assert.equal(
    physics.collisionMatrix[String(FRUIT_COLLISION_FILTER.categoryBits)],
    originalFruitMask,
  );
  assert.equal(
    physics.collisionMatrix[String(BOMB_COLLISION_FILTER.categoryBits)],
    originalBombMask,
  );
  assert.equal(physics.resetAccumulatorCalls, 2);
  assert.equal(director.system, null);
  assert.equal(director.unregisterCalls, 1);

  adapter.restorePreviousWorldProperties();
  assert.equal(physics.resetAccumulatorCalls, 2);
  assert.equal(director.unregisterCalls, 1);
});

function createPhysicsStub() {
  return {
    allowSleep: false,
    autoSimulation: true,
    collisionMatrix: {
      [String(FRUIT_COLLISION_FILTER.categoryBits)]: 0x1234,
      [String(BOMB_COLLISION_FILTER.categoryBits)]: 0,
    } as Record<string, number>,
    debugDrawFlags: 0,
    enable: true,
    gravity: { x: 9, y: -10 },
    physicsWorld: {
      drawDebug() {},
      syncPhysicsToScene() {},
      syncSceneToPhysics() {},
    },
    positionIterations: 3,
    raycast() { return []; },
    resetAccumulatorCalls: 0,
    resetAccumulator() { this.resetAccumulatorCalls += 1; },
    step() {},
    velocityIterations: 4,
  };
}
