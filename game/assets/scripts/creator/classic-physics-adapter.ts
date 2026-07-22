import {
  ERaycast2DType,
  PhysicsSystem2D,
  RigidBody2D,
  Vec2,
} from 'cc';

/**
 * Cocos Creator 3.8.8 adapter for only the recovered, resolved Physics2D boundary.
 * It deliberately does not choose a fixed/manual timestep policy.
 */
export class ClassicPhysicsAdapter {
  private readonly physics: PhysicsSystem2D;

  constructor(physics: PhysicsSystem2D = PhysicsSystem2D.instance) {
    this.physics = physics;
  }

  configureResolvedWorldProperties(): void {
    // Keep simulation inert until the variable-step compatibility policy is reviewed.
    this.physics.autoSimulation = false;
    this.physics.resetAccumulator();
    this.physics.allowSleep = true;
    this.physics.gravity = new Vec2(0, -320);
    this.physics.velocityIterations = 10;
    this.physics.positionIterations = 10;
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
    return this.physics.raycast(startWorld, endWorld, ERaycast2DType.All, mask);
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

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}
