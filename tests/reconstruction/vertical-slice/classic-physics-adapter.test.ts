import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

import {
  BOMB_COLLISION_FILTER,
  ELECTRIC_COLLISION_FILTER,
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

test('physics adapter installs and restores exact fruit, bomb, and electric collision rows', () => {
  const physics = createPhysicsStub();
  const originalFruitMask = physics.collisionMatrix[String(FRUIT_COLLISION_FILTER.categoryBits)];
  const originalBombMask = physics.collisionMatrix[String(BOMB_COLLISION_FILTER.categoryBits)];
  const originalElectricMask = physics
    .collisionMatrix[String(ELECTRIC_COLLISION_FILTER.categoryBits)];
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
  assert.equal(
    physics.collisionMatrix[String(ELECTRIC_COLLISION_FILTER.categoryBits)],
    ELECTRIC_COLLISION_FILTER.maskBits,
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
  assert.equal(
    physics.collisionMatrix[String(ELECTRIC_COLLISION_FILTER.categoryBits)],
    originalElectricMask,
  );
  assert.equal(physics.resetAccumulatorCalls, 2);
  assert.equal(director.system, null);
  assert.equal(director.unregisterCalls, 1);

  adapter.restorePreviousWorldProperties();
  assert.equal(physics.resetAccumulatorCalls, 2);
  assert.equal(director.unregisterCalls, 1);
});

for (const fault of [
  Object.freeze({
    label: 'resetAccumulator before it mutates the accumulator',
    schedule(physics: PhysicsStub) {
      physics.failNext('resetAccumulator', 'before', 'injected configure reset failure');
    },
  }),
  Object.freeze({
    label: 'gravity after its setter mutates the property',
    schedule(physics: PhysicsStub) {
      physics.failNext('gravity', 'after', 'injected configure gravity failure');
    },
  }),
  Object.freeze({
    label: 'the bomb collision row after its write',
    schedule(physics: PhysicsStub) {
      physics.failNext(
        collisionOperation(BOMB_COLLISION_FILTER.categoryBits),
        'after',
        'injected configure bomb row failure',
      );
    },
  }),
] as const) {
  test(`configure rolls back every captured field when ${fault.label} fails`, () => {
    const physics = createPhysicsStub();
    const originalState = captureStubState(physics);
    const adapter = new ClassicPhysicsAdapter(physics as never);
    fault.schedule(physics);

    assert.throws(
      () => adapter.configureResolvedWorldProperties(),
      /injected configure/,
    );
    assert.deepEqual(captureStubState(physics), originalState);

    adapter.configureResolvedWorldProperties();
    assertConfiguredState(physics);
    adapter.restorePreviousWorldProperties();
    assert.deepEqual(captureStubState(physics), originalState);
  });
}

test('configure preserves its original snapshot when rollback itself needs a retry', () => {
  const physics = createPhysicsStub();
  const originalState = captureStubState(physics);
  const adapter = new ClassicPhysicsAdapter(physics as never);
  physics.failNext(
    collisionOperation(ELECTRIC_COLLISION_FILTER.categoryBits),
    'after',
    'injected configure electric row failure',
  );
  physics.failAfter(
    'autoSimulation',
    1,
    'before',
    'injected configure rollback failure',
  );

  assert.throws(
    () => adapter.configureResolvedWorldProperties(),
    (error: unknown) => {
      assertPhysicsTransitionFailures(error, [
        'configure-world-properties',
        'restore-auto-simulation',
      ]);
      return true;
    },
  );
  assert.equal(physics.autoSimulation, false);

  adapter.configureResolvedWorldProperties();
  assertConfiguredState(physics);
  adapter.restorePreviousWorldProperties();
  assert.deepEqual(captureStubState(physics), originalState);
});

test('restore drains all fields, aggregates failures, and retains ownership until a clean retry', () => {
  const physics = createPhysicsStub();
  const originalState = captureStubState(physics);
  const adapter = new ClassicPhysicsAdapter(physics as never);
  adapter.configureResolvedWorldProperties();
  physics.operationAttempts.length = 0;
  physics.failNext('resetAccumulator', 'before', 'injected restore reset failure');
  physics.failNext('gravity', 'before', 'injected restore gravity failure');
  physics.failNext(
    collisionOperation(FRUIT_COLLISION_FILTER.categoryBits),
    'before',
    'injected restore fruit row failure',
  );
  physics.failNext(
    'autoSimulation',
    'before',
    'injected restore auto-simulation failure',
  );

  assert.throws(
    () => adapter.restorePreviousWorldProperties(),
    (error: unknown) => {
      assertPhysicsTransitionFailures(error, [
        'reset-accumulator',
        'restore-gravity',
        'restore-fruit-collision-mask',
        'restore-auto-simulation',
      ]);
      return true;
    },
  );
  assert.deepEqual(physics.operationAttempts, [
    'resetAccumulator',
    'allowSleep',
    'gravity',
    'velocityIterations',
    'positionIterations',
    collisionOperation(FRUIT_COLLISION_FILTER.categoryBits),
    collisionOperation(BOMB_COLLISION_FILTER.categoryBits),
    collisionOperation(ELECTRIC_COLLISION_FILTER.categoryBits),
    'enable',
    'autoSimulation',
  ]);
  assert.equal(physics.allowSleep, originalState.allowSleep);
  assert.deepEqual(
    { x: physics.gravity.x, y: physics.gravity.y },
    { x: 0, y: -320 },
  );
  assert.equal(physics.velocityIterations, originalState.velocityIterations);
  assert.equal(physics.positionIterations, originalState.positionIterations);
  assert.equal(
    physics.collisionMatrix[String(FRUIT_COLLISION_FILTER.categoryBits)],
    FRUIT_COLLISION_FILTER.maskBits,
  );
  assert.equal(
    physics.collisionMatrix[String(BOMB_COLLISION_FILTER.categoryBits)],
    originalState.bombCollisionMask,
  );
  assert.equal(
    physics.collisionMatrix[String(ELECTRIC_COLLISION_FILTER.categoryBits)],
    originalState.electricCollisionMask,
  );
  assert.equal(physics.enable, originalState.enable);
  assert.equal(physics.autoSimulation, false);
  assert.throws(
    () => adapter.startVariableSimulation((deltaSeconds) => deltaSeconds, () => {}),
    /must be configured/,
  );

  physics.operationAttempts.length = 0;
  adapter.restorePreviousWorldProperties();
  assert.deepEqual(captureStubState(physics), originalState);
  assert.equal(physics.operationAttempts.length, 10);

  physics.operationAttempts.length = 0;
  adapter.restorePreviousWorldProperties();
  assert.deepEqual(physics.operationAttempts, []);
});

interface PhysicsStubState {
  readonly allowSleep: boolean;
  readonly autoSimulation: boolean;
  readonly bombCollisionMask: number;
  readonly electricCollisionMask: number;
  readonly enable: boolean;
  readonly fruitCollisionMask: number;
  readonly gravity: Readonly<{ x: number; y: number }>;
  readonly positionIterations: number;
  readonly velocityIterations: number;
}

type FaultTiming = 'after' | 'before';

interface ScheduledFault {
  readonly error: Error;
  readonly occurrence: number;
  readonly operation: string;
  readonly timing: FaultTiming;
}

class PhysicsStub {
  private allowSleepValue = false;
  private autoSimulationValue = true;
  private readonly collisionValues = {
      [String(FRUIT_COLLISION_FILTER.categoryBits)]: 0x1234,
      [String(BOMB_COLLISION_FILTER.categoryBits)]: 0,
      [String(ELECTRIC_COLLISION_FILTER.categoryBits)]: 0xabcd,
  } as Record<string, number>;
  readonly collisionMatrix: Record<string, number>;
  readonly debugDrawFlags = 0;
  private enableValue = true;
  private readonly faults: ScheduledFault[] = [];
  private gravityValue = { x: 9, y: -10 };
  private readonly operationCounts = new Map<string, number>();
  readonly operationAttempts: string[] = [];
  readonly physicsWorld = {
    drawDebug() {},
    syncPhysicsToScene() {},
    syncSceneToPhysics() {},
  };
  private positionIterationsValue = 3;
  resetAccumulatorCalls = 0;
  private velocityIterationsValue = 4;

  constructor() {
    this.collisionMatrix = new Proxy(this.collisionValues, {
      set: (target, property, value) => {
        this.mutate(collisionOperation(property), () => {
          Reflect.set(target, property, value);
        });
        return true;
      },
    });
  }

  get allowSleep(): boolean {
    return this.allowSleepValue;
  }

  set allowSleep(value: boolean) {
    this.mutate('allowSleep', () => {
      this.allowSleepValue = value;
    });
  }

  get autoSimulation(): boolean {
    return this.autoSimulationValue;
  }

  set autoSimulation(value: boolean) {
    this.mutate('autoSimulation', () => {
      this.autoSimulationValue = value;
    });
  }

  get enable(): boolean {
    return this.enableValue;
  }

  set enable(value: boolean) {
    this.mutate('enable', () => {
      this.enableValue = value;
    });
  }

  get gravity(): Readonly<{ x: number; y: number }> {
    return this.gravityValue;
  }

  set gravity(value: Readonly<{ x: number; y: number }>) {
    this.mutate('gravity', () => {
      this.gravityValue = value;
    });
  }

  get positionIterations(): number {
    return this.positionIterationsValue;
  }

  set positionIterations(value: number) {
    this.mutate('positionIterations', () => {
      this.positionIterationsValue = value;
    });
  }

  get velocityIterations(): number {
    return this.velocityIterationsValue;
  }

  set velocityIterations(value: number) {
    this.mutate('velocityIterations', () => {
      this.velocityIterationsValue = value;
    });
  }

  failAfter(
    operation: string,
    successfulAttemptsBeforeFailure: number,
    timing: FaultTiming,
    message: string,
  ): void {
    const occurrence = (this.operationCounts.get(operation) ?? 0)
      + successfulAttemptsBeforeFailure
      + 1;
    this.faults.push(Object.freeze({
      error: new Error(message),
      occurrence,
      operation,
      timing,
    }));
  }

  failNext(operation: string, timing: FaultTiming, message: string): void {
    this.failAfter(operation, 0, timing, message);
  }

  raycast(): readonly unknown[] {
    return [];
  }

  resetAccumulator(): void {
    this.mutate('resetAccumulator', () => {
      this.resetAccumulatorCalls += 1;
    });
  }

  step(): void {}

  private mutate(operation: string, mutation: () => void): void {
    const occurrence = (this.operationCounts.get(operation) ?? 0) + 1;
    this.operationCounts.set(operation, occurrence);
    this.operationAttempts.push(operation);
    this.throwScheduledFault(operation, occurrence, 'before');
    mutation();
    this.throwScheduledFault(operation, occurrence, 'after');
  }

  private throwScheduledFault(
    operation: string,
    occurrence: number,
    timing: FaultTiming,
  ): void {
    const index = this.faults.findIndex((fault) => (
      fault.operation === operation
      && fault.occurrence === occurrence
      && fault.timing === timing
    ));
    if (index < 0) {
      return;
    }
    const [fault] = this.faults.splice(index, 1);
    throw fault?.error ?? new Error(`Missing scheduled ${operation} fault`);
  }
}

function createPhysicsStub(): PhysicsStub {
  return new PhysicsStub();
}

function captureStubState(physics: PhysicsStub): PhysicsStubState {
  return Object.freeze({
    allowSleep: physics.allowSleep,
    autoSimulation: physics.autoSimulation,
    bombCollisionMask:
      physics.collisionMatrix[String(BOMB_COLLISION_FILTER.categoryBits)],
    electricCollisionMask:
      physics.collisionMatrix[String(ELECTRIC_COLLISION_FILTER.categoryBits)],
    enable: physics.enable,
    fruitCollisionMask:
      physics.collisionMatrix[String(FRUIT_COLLISION_FILTER.categoryBits)],
    gravity: Object.freeze({ x: physics.gravity.x, y: physics.gravity.y }),
    positionIterations: physics.positionIterations,
    velocityIterations: physics.velocityIterations,
  });
}

function assertConfiguredState(physics: PhysicsStub): void {
  assert.deepEqual(captureStubState(physics), {
    allowSleep: true,
    autoSimulation: false,
    bombCollisionMask: BOMB_COLLISION_FILTER.maskBits,
    electricCollisionMask: ELECTRIC_COLLISION_FILTER.maskBits,
    enable: true,
    fruitCollisionMask: FRUIT_COLLISION_FILTER.maskBits,
    gravity: { x: 0, y: -320 },
    positionIterations: 10,
    velocityIterations: 10,
  });
}

function assertPhysicsTransitionFailures(
  error: unknown,
  expectedOperations: readonly string[],
): void {
  assert.ok(error instanceof Error);
  assert.equal(error.name, 'ClassicPhysicsTransitionError');
  assert.deepEqual(
    (error as {
      readonly failures: readonly Readonly<{ readonly operation: string }>[];
    }).failures.map((failure) => failure.operation),
    expectedOperations,
  );
}

function collisionOperation(categoryBits: number | PropertyKey): string {
  return `collision:${String(categoryBits)}`;
}
