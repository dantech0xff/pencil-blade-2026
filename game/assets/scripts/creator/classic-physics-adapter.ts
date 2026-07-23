import {
  Director,
  ERaycast2DType,
  PhysicsSystem2D,
  RigidBody2D,
  System,
  SystemPriority,
  Vec2,
  director,
} from 'cc';

import { ClassicVariableStepRunner } from '../domain/classic-variable-step';
import {
  BOMB_COLLISION_FILTER,
  ELECTRIC_COLLISION_FILTER,
  FRUIT_COLLISION_FILTER,
} from '../domain/classic-fixture-rules';

export const CLASSIC_VARIABLE_PHYSICS_SYSTEM_ID = 'CLASSIC_VARIABLE_PHYSICS';

interface PreviousPhysicsState {
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

export interface ClassicPhysicsTransitionFailure {
  readonly error: unknown;
  readonly operation: string;
}

export class ClassicPhysicsTransitionError extends Error {
  readonly failures: readonly ClassicPhysicsTransitionFailure[];

  constructor(
    message: string,
    failures: readonly ClassicPhysicsTransitionFailure[],
  ) {
    super(`${message}: ${failures.map((failure) => (
      `${failure.operation}: ${errorMessage(failure.error)}`
    )).join('; ')}`);
    this.name = 'ClassicPhysicsTransitionError';
    this.failures = Object.freeze(failures.map((failure) => Object.freeze({
      error: failure.error,
      operation: failure.operation,
    })));
  }
}

type ResolveVariableDelta = (frameDeltaSeconds: number) => number;
type AfterVariableStep = (variableDeltaSeconds: number) => void;

class ClassicVariablePhysicsSystem extends System {
  private readonly runFrame: (frameDeltaSeconds: number) => void;

  constructor(runFrame: (frameDeltaSeconds: number) => void) {
    super();
    this.runFrame = runFrame;
  }

  postUpdate(frameDeltaSeconds: number): void {
    this.runFrame(frameDeltaSeconds);
  }
}

/**
 * Cocos Creator 3.8.8 adapter for the recovered variable-step Physics2D boundary.
 * Project-owned lifecycle mutations must use `callAfterStep`, because Creator's public
 * manual step does not expose its private delayed-event guard.
 */
export class ClassicPhysicsAdapter {
  private readonly physics: PhysicsSystem2D;
  private readonly stepRunner: ClassicVariableStepRunner;
  private configured = false;
  private previousState: PreviousPhysicsState | null = null;
  private variableSystem: ClassicVariablePhysicsSystem | null = null;

  constructor(physics: PhysicsSystem2D = PhysicsSystem2D.instance) {
    this.physics = physics;
    this.stepRunner = new ClassicVariableStepRunner({
      afterStep: () => director.emit(Director.EVENT_AFTER_PHYSICS),
      beforeStep: () => director.emit(Director.EVENT_BEFORE_PHYSICS),
      drawDebug: () => {
        if (this.physics.debugDrawFlags !== 0) {
          this.physics.physicsWorld.drawDebug();
        }
      },
      isEnabled: () => this.physics.enable,
      step: (deltaSeconds) => this.physics.step(deltaSeconds),
      syncPhysicsToScene: () => this.physics.physicsWorld.syncPhysicsToScene(),
      syncSceneToPhysics: () => this.physics.physicsWorld.syncSceneToPhysics(),
    });
  }

  configureResolvedWorldProperties(): void {
    if (this.configured) {
      return;
    }
    if (this.previousState !== null) {
      // A prior configuration rollback could not restore one or more singleton fields.
      // Converge that retained snapshot before taking a fresh lease.
      this.restorePreviousWorldProperties();
    }
    // Creator may deserialize the next scene before destroying the current one. Acquire the
    // singleton snapshot only when onLoad configures this scene, after the old owner restores it.
    this.previousState = capturePreviousPhysicsState(this.physics);
    const previousState = this.previousState;
    try {
      this.physics.autoSimulation = false;
      this.physics.resetAccumulator();
      this.physics.allowSleep = true;
      this.physics.gravity = new Vec2(0, -320);
      this.physics.velocityIterations = 10;
      this.physics.positionIterations = 10;
      this.physics.collisionMatrix[String(FRUIT_COLLISION_FILTER.categoryBits)]
        = FRUIT_COLLISION_FILTER.maskBits;
      this.physics.collisionMatrix[String(BOMB_COLLISION_FILTER.categoryBits)]
        = BOMB_COLLISION_FILTER.maskBits;
      this.physics.collisionMatrix[String(ELECTRIC_COLLISION_FILTER.categoryBits)]
        = ELECTRIC_COLLISION_FILTER.maskBits;
    } catch (error: unknown) {
      const rollbackFailures = restoreCapturedPhysicsState(
        this.physics,
        previousState,
      );
      if (rollbackFailures.length === 0) {
        this.previousState = null;
        throw error;
      }
      throw new ClassicPhysicsTransitionError(
        'Classic physics configuration and rollback failed',
        Object.freeze([
          Object.freeze({
            error,
            operation: 'configure-world-properties',
          }),
          ...rollbackFailures,
        ]),
      );
    }
    this.configured = true;
  }

  startVariableSimulation(
    resolveVariableDelta: ResolveVariableDelta,
    afterVariableStep: AfterVariableStep,
  ): void {
    if (!this.configured) {
      throw new Error('Classic physics must be configured before simulation starts');
    }
    if (typeof resolveVariableDelta !== 'function') {
      throw new TypeError('resolveVariableDelta must be a function');
    }
    if (typeof afterVariableStep !== 'function') {
      throw new TypeError('afterVariableStep must be a function');
    }
    if (this.variableSystem !== null || director.getSystem(CLASSIC_VARIABLE_PHYSICS_SYSTEM_ID)) {
      throw new Error('Classic variable physics system is already registered');
    }

    this.variableSystem = new ClassicVariablePhysicsSystem((frameDeltaSeconds) => {
      const variableDeltaSeconds = resolveVariableDelta(frameDeltaSeconds);
      if (this.stepRunner.run(variableDeltaSeconds)) {
        afterVariableStep(variableDeltaSeconds);
      }
    });
    // Built-in PhysicsSystem2D is LOW. Run immediately after it returns in manual mode.
    director.registerSystem(
      CLASSIC_VARIABLE_PHYSICS_SYSTEM_ID,
      this.variableSystem,
      SystemPriority.LOW - 1,
    );
  }

  stopVariableSimulation(): void {
    if (this.variableSystem === null) {
      return;
    }
    director.unregisterSystem(this.variableSystem);
    this.variableSystem = null;
  }

  callAfterStep(mutation: () => void): void {
    this.stepRunner.callAfterStep(mutation);
  }

  restorePreviousWorldProperties(): void {
    const previousState = this.previousState;
    if (previousState !== null) {
      // Snapshot ownership survives a failed restore, but the configured lease does not.
      // This blocks simulation restart and makes configure retry the retained restore first.
      this.configured = false;
    }
    const failures: ClassicPhysicsTransitionFailure[] = [];
    attemptPhysicsTransition(
      failures,
      'stop-variable-simulation',
      () => this.stopVariableSimulation(),
    );
    if (previousState === null) {
      if (this.configured) {
        failures.push(Object.freeze({
          error: new Error('Classic physics previous state is missing'),
          operation: 'read-previous-state',
        }));
      }
      if (failures.length > 0) {
        throw new ClassicPhysicsTransitionError(
          'Classic physics restoration failed',
          failures,
        );
      }
      return;
    }
    failures.push(...restoreCapturedPhysicsState(this.physics, previousState));
    if (failures.length === 0) {
      this.previousState = null;
      return;
    }
    throw new ClassicPhysicsTransitionError(
      'Classic physics restoration failed',
      failures,
    );
  }

  setWorldStopped(stopped: boolean): void {
    this.physics.enable = !stopped;
  }

  setBodyVelocity(
    body: RigidBody2D,
    linearVelocityMetresPerSecond: Readonly<{ x: number; y: number }>,
    angularVelocityRadiansPerSecond: number,
  ): void {
    assertFinite(linearVelocityMetresPerSecond.x, 'linearVelocity.x');
    assertFinite(linearVelocityMetresPerSecond.y, 'linearVelocity.y');
    assertFinite(angularVelocityRadiansPerSecond, 'angularVelocity');
    body.linearVelocity = new Vec2(
      linearVelocityMetresPerSecond.x,
      linearVelocityMetresPerSecond.y,
    );
    body.angularVelocity = angularVelocityRadiansPerSecond;
  }

  raycastAll(
    startWorld: Readonly<{ x: number; y: number }>,
    endWorld: Readonly<{ x: number; y: number }>,
    mask = 0xffffffff,
  ) {
    assertFinite(startWorld.x, 'startWorld.x');
    assertFinite(startWorld.y, 'startWorld.y');
    assertFinite(endWorld.x, 'endWorld.x');
    assertFinite(endWorld.y, 'endWorld.y');
    return this.physics.raycast(
      new Vec2(startWorld.x, startWorld.y),
      new Vec2(endWorld.x, endWorld.y),
      ERaycast2DType.All,
      mask,
    );
  }

  raycastForwardThenReverse(
    startWorld: Readonly<{ x: number; y: number }>,
    endWorld: Readonly<{ x: number; y: number }>,
    mask = 0xffffffff,
  ) {
    const forward = this.raycastAll(startWorld, endWorld, mask);
    const reverse = this.raycastAll(endWorld, startWorld, mask);
    return Object.freeze([...forward, ...reverse]);
  }
}

function capturePreviousPhysicsState(physics: PhysicsSystem2D): PreviousPhysicsState {
  return Object.freeze({
    allowSleep: physics.allowSleep,
    autoSimulation: physics.autoSimulation,
    bombCollisionMask: physics.collisionMatrix[String(BOMB_COLLISION_FILTER.categoryBits)],
    electricCollisionMask:
      physics.collisionMatrix[String(ELECTRIC_COLLISION_FILTER.categoryBits)],
    enable: physics.enable,
    fruitCollisionMask: physics.collisionMatrix[String(FRUIT_COLLISION_FILTER.categoryBits)],
    gravity: Object.freeze({ x: physics.gravity.x, y: physics.gravity.y }),
    positionIterations: physics.positionIterations,
    velocityIterations: physics.velocityIterations,
  });
}

function restoreCapturedPhysicsState(
  physics: PhysicsSystem2D,
  previousState: PreviousPhysicsState,
): readonly ClassicPhysicsTransitionFailure[] {
  const failures: ClassicPhysicsTransitionFailure[] = [];
  attemptPhysicsTransition(
    failures,
    'reset-accumulator',
    () => physics.resetAccumulator(),
  );
  attemptPhysicsTransition(
    failures,
    'restore-allow-sleep',
    () => {
      physics.allowSleep = previousState.allowSleep;
    },
  );
  attemptPhysicsTransition(
    failures,
    'restore-gravity',
    () => {
      physics.gravity = new Vec2(
        previousState.gravity.x,
        previousState.gravity.y,
      );
    },
  );
  attemptPhysicsTransition(
    failures,
    'restore-velocity-iterations',
    () => {
      physics.velocityIterations = previousState.velocityIterations;
    },
  );
  attemptPhysicsTransition(
    failures,
    'restore-position-iterations',
    () => {
      physics.positionIterations = previousState.positionIterations;
    },
  );
  attemptPhysicsTransition(
    failures,
    'restore-fruit-collision-mask',
    () => {
      physics.collisionMatrix[String(FRUIT_COLLISION_FILTER.categoryBits)]
        = previousState.fruitCollisionMask;
    },
  );
  attemptPhysicsTransition(
    failures,
    'restore-bomb-collision-mask',
    () => {
      physics.collisionMatrix[String(BOMB_COLLISION_FILTER.categoryBits)]
        = previousState.bombCollisionMask;
    },
  );
  attemptPhysicsTransition(
    failures,
    'restore-electric-collision-mask',
    () => {
      physics.collisionMatrix[String(ELECTRIC_COLLISION_FILTER.categoryBits)]
        = previousState.electricCollisionMask;
    },
  );
  attemptPhysicsTransition(
    failures,
    'restore-enable',
    () => {
      physics.enable = previousState.enable;
    },
  );
  attemptPhysicsTransition(
    failures,
    'restore-auto-simulation',
    () => {
      physics.autoSimulation = previousState.autoSimulation;
    },
  );
  return Object.freeze(failures);
}

function attemptPhysicsTransition(
  failures: ClassicPhysicsTransitionFailure[],
  operation: string,
  transition: () => void,
): void {
  try {
    transition();
  } catch (error: unknown) {
    failures.push(Object.freeze({ error, operation }));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}
