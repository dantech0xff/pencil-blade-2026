import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { FRUIT_COLLISION_FILTER } from '../../../game/assets/scripts/domain/classic-fixture-rules.ts';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const Director = Object.freeze({ EVENT_AFTER_PHYSICS: 'after-physics' });
export const ERaycast2DType = Object.freeze({ All: 7 });
export class PhysicsSystem2D {}
PhysicsSystem2D.instance = null;
export class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
}
export const director = {
  listeners: [],
  onceCalls: [],
  once(event, mutation) {
    this.onceCalls.push({ event, mutation });
    this.listeners.push({ event, mutation });
  },
  off(event, mutation) {
    this.listeners = this.listeners.filter((entry) => (
      entry.event !== event || entry.mutation !== mutation
    ));
  },
  emit(event) {
    const matching = this.listeners.filter((entry) => entry.event === event);
    this.listeners = this.listeners.filter((entry) => entry.event !== event);
    for (const entry of matching) entry.mutation();
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

const { NonClassicPhysicsAdapter } = await import(
  '../../../game/assets/scripts/creator/non-classic-physics-adapter.ts'
);
const { director } = await import('cc') as {
  director: {
    emit(event: string): void;
    listeners: Array<{ event: string; mutation: () => void }>;
    onceCalls: Array<{ event: string; mutation: () => void }>;
  };
};

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SOURCE = readFileSync(
  `${REPOSITORY_ROOT}/game/assets/scripts/creator/non-classic-physics-adapter.ts`,
  'utf8',
);

test('non-Classic raycasts use the default Creator Physics2D world in All mode', () => {
  assert.match(SOURCE, /PhysicsSystem2D\.instance/);
  assert.match(SOURCE, /this\.physics\.raycast\(/);
  assert.match(SOURCE, /new Vec2\(startWorld\.x, startWorld\.y\)/);
  assert.match(SOURCE, /new Vec2\(endWorld\.x, endWorld\.y\)/);
  assert.match(SOURCE, /ERaycast2DType\.All/);
  assert.doesNotMatch(SOURCE, /ClassicVariableStepRunner|callAfterPhysicsStep/);
});

test('non-Classic mutations wait for the public auto-simulation post-step event', () => {
  assert.match(SOURCE, /!this\.physics\.enable \|\| !this\.physics\.autoSimulation/);
  assert.match(SOURCE, /director\.once\(Director\.EVENT_AFTER_PHYSICS, guardedMutation\)/);
  assert.match(SOURCE, /director\.off\(Director\.EVENT_AFTER_PHYSICS, mutation\)/);
  assert.match(SOURCE, /after-step mutation must be a function/);
});

test('non-Classic screens own and restore the recovered fruit collision mask', () => {
  assert.match(SOURCE, /FRUIT_COLLISION_FILTER/);
  assert.match(SOURCE, /activeCollisionFilterOwner/);
  assert.match(
    SOURCE,
    /this\.previousFruitCollisionMask = previous[\s\S]*?FRUIT_COLLISION_FILTER\.maskBits[\s\S]*?activeCollisionFilterOwner = this/,
  );
  assert.match(
    SOURCE,
    /restorePreviousCollisionFilter[\s\S]*?collisionMatrix\[String\(FRUIT_COLLISION_FILTER\.categoryBits\)\] = previous[\s\S]*?activeCollisionFilterOwner = null/,
  );
  assert.match(SOURCE, /this\.assertActiveCollisionFilter\(\)/);
});

test('collision-filter lease is exclusive, idempotent, and exactly restored', () => {
  const physics = createPhysicsStub();
  const adapter = new NonClassicPhysicsAdapter(physics as never);
  const contender = new NonClassicPhysicsAdapter(physics as never);

  assert.equal(adapter.activateCollisionFilter(), true);
  assert.equal(adapter.collisionFilterActive, true);
  assert.equal(
    physics.collisionMatrix[String(FRUIT_COLLISION_FILTER.categoryBits)],
    FRUIT_COLLISION_FILTER.maskBits,
  );
  assert.equal(adapter.activateCollisionFilter(), false);
  assert.throws(
    () => contender.activateCollisionFilter(),
    /Another non-Classic physics adapter owns/,
  );

  assert.equal(adapter.restorePreviousCollisionFilter(), true);
  assert.equal(adapter.collisionFilterActive, false);
  assert.equal(
    physics.collisionMatrix[String(FRUIT_COLLISION_FILTER.categoryBits)],
    0x1234,
  );
  assert.equal(adapter.restorePreviousCollisionFilter(), false);
});

test('raycast and after-step mutation reject callers without the active lease', () => {
  const physics = createPhysicsStub();
  const adapter = new NonClassicPhysicsAdapter(physics as never);
  let mutationCalls = 0;
  const mutation = () => { mutationCalls += 1; };

  assert.throws(() => adapter.raycastAll({ x: 1, y: 2 }, { x: 3, y: 4 }), /does not own/);
  assert.throws(() => adapter.callAfterStep(mutation), /does not own/);
  adapter.activateCollisionFilter();
  try {
    assert.deepEqual(adapter.raycastAll({ x: 1, y: 2 }, { x: 3, y: 4 }), []);
    adapter.callAfterStep(mutation);
    const queued = director.onceCalls.at(-1);
    assert.equal(queued?.event, 'after-physics');
    assert.equal(typeof queued?.mutation, 'function');
    assert.notEqual(queued?.mutation, mutation);
    director.emit('after-physics');
    assert.equal(mutationCalls, 1);
  } finally {
    adapter.dispose();
  }
});

test('lease release cancels and epoch-guards mutations before Classic can emit after-physics', () => {
  const physics = createPhysicsStub();
  const adapter = new NonClassicPhysicsAdapter(physics as never);
  let mutationCalls = 0;

  adapter.activateCollisionFilter();
  adapter.callAfterStep(() => { mutationCalls += 1; });
  const staleGuard = director.onceCalls.at(-1)?.mutation;
  assert.equal(director.listeners.length > 0, true);
  adapter.restorePreviousCollisionFilter();
  assert.equal(director.listeners.length, 0);
  director.emit('after-physics');
  staleGuard?.();
  assert.equal(mutationCalls, 0);

  adapter.activateCollisionFilter();
  adapter.callAfterStep(() => { mutationCalls += 1; });
  director.emit('after-physics');
  assert.equal(mutationCalls, 1);
  adapter.dispose();
});

function createPhysicsStub() {
  return {
    autoSimulation: true,
    collisionMatrix: {
      [String(FRUIT_COLLISION_FILTER.categoryBits)]: 0x1234,
    } as Record<string, number>,
    enable: true,
    raycast() { return []; },
  };
}
