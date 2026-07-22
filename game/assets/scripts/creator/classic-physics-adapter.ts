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
import { FRUIT_COLLISION_FILTER } from '../domain/classic-fixture-rules';

export const CLASSIC_VARIABLE_PHYSICS_SYSTEM_ID = 'CLASSIC_VARIABLE_PHYSICS';

interface PreviousPhysicsState {
  readonly allowSleep: boolean;
  readonly autoSimulation: boolean;
  readonly enable: boolean;
  readonly fruitCollisionMask: number;
  readonly gravity: Readonly<{ x: number; y: number }>;
  readonly positionIterations: number;
  readonly velocityIterations: number;
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
    // Creator may deserialize the next scene before destroying the current one. Acquire the
    // singleton snapshot only when onLoad configures this scene, after the old owner restores it.
    this.previousState = capturePreviousPhysicsState(this.physics);
    this.configured = true;
    this.physics.autoSimulation = false;
    this.physics.resetAccumulator();
    this.physics.allowSleep = true;
    this.physics.gravity = new Vec2(0, -320);
    this.physics.velocityIterations = 10;
    this.physics.positionIterations = 10;
    this.physics.collisionMatrix[String(FRUIT_COLLISION_FILTER.categoryBits)]
      = FRUIT_COLLISION_FILTER.maskBits;
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
    this.stopVariableSimulation();
    if (!this.configured) {
      return;
    }
    const previousState = this.previousState;
    if (previousState === null) {
      throw new Error('Classic physics previous state is missing');
    }
    this.physics.resetAccumulator();
    this.physics.allowSleep = previousState.allowSleep;
    this.physics.gravity = new Vec2(
      previousState.gravity.x,
      previousState.gravity.y,
    );
    this.physics.velocityIterations = previousState.velocityIterations;
    this.physics.positionIterations = previousState.positionIterations;
    this.physics.collisionMatrix[String(FRUIT_COLLISION_FILTER.categoryBits)]
      = previousState.fruitCollisionMask;
    this.physics.enable = previousState.enable;
    this.physics.autoSimulation = previousState.autoSimulation;
    this.previousState = null;
    this.configured = false;
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
    enable: physics.enable,
    fruitCollisionMask: physics.collisionMatrix[String(FRUIT_COLLISION_FILTER.categoryBits)],
    gravity: Object.freeze({ x: physics.gravity.x, y: physics.gravity.y }),
    positionIterations: physics.positionIterations,
    velocityIterations: physics.velocityIterations,
  });
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}
