import {
  Director,
  ERaycast2DType,
  PhysicsSystem2D,
  Vec2,
  director,
} from 'cc';

import { FRUIT_COLLISION_FILTER } from '../domain/classic-fixture-rules';

let activeCollisionFilterOwner: NonClassicPhysicsAdapter | null = null;

/**
 * Physics2D boundary for Main Menu and other auto-simulated screens.
 * Classic owns a separate manual-step queue, so non-Classic mutations wait for the public
 * default-world after-physics event instead of entering that inactive queue.
 */
export class NonClassicPhysicsAdapter {
  private leaseGeneration = 0;
  private readonly pendingAfterStepMutations = new Set<() => void>();
  private readonly physics: PhysicsSystem2D;
  private previousFruitCollisionMask: number | null = null;

  constructor(physics: PhysicsSystem2D = PhysicsSystem2D.instance) {
    this.physics = physics;
  }

  get collisionFilterActive(): boolean {
    return activeCollisionFilterOwner === this;
  }

  /** Installs the recovered fruit mask while Main Menu or Mode Select owns Physics2D. */
  activateCollisionFilter(): boolean {
    if (activeCollisionFilterOwner === this) {
      this.assertAutoSimulatedPhysics();
      this.ensureRecoveredFruitMask();
      return false;
    }
    if (activeCollisionFilterOwner !== null) {
      throw new Error('Another non-Classic physics adapter owns the collision filter');
    }
    this.assertAutoSimulatedPhysics();
    const key = String(FRUIT_COLLISION_FILTER.categoryBits);
    const previous = this.physics.collisionMatrix[key];
    if (!Number.isSafeInteger(previous)) {
      throw new Error('Physics2D fruit collision mask is unavailable');
    }
    this.previousFruitCollisionMask = previous;
    this.ensureRecoveredFruitMask();
    this.leaseGeneration += 1;
    activeCollisionFilterOwner = this;
    return true;
  }

  /** Restores the singleton before Classic captures and configures its own world contract. */
  restorePreviousCollisionFilter(): boolean {
    if (activeCollisionFilterOwner !== this) {
      if (this.previousFruitCollisionMask !== null) {
        throw new Error('Non-Classic collision filter ownership was lost');
      }
      return false;
    }
    const previous = this.previousFruitCollisionMask;
    if (previous === null) {
      throw new Error('Non-Classic previous fruit collision mask is missing');
    }
    this.cancelPendingAfterStepMutations();
    this.leaseGeneration += 1;
    this.physics.collisionMatrix[String(FRUIT_COLLISION_FILTER.categoryBits)] = previous;
    this.previousFruitCollisionMask = null;
    activeCollisionFilterOwner = null;
    return true;
  }

  dispose(): boolean {
    return this.restorePreviousCollisionFilter();
  }

  raycastAll(
    startWorld: Readonly<{ x: number; y: number }>,
    endWorld: Readonly<{ x: number; y: number }>,
  ) {
    this.assertActiveCollisionFilter();
    assertFinitePoint(startWorld, 'startWorld');
    assertFinitePoint(endWorld, 'endWorld');
    return this.physics.raycast(
      new Vec2(startWorld.x, startWorld.y),
      new Vec2(endWorld.x, endWorld.y),
      ERaycast2DType.All,
    );
  }

  callAfterStep(mutation: () => void): void {
    if (typeof mutation !== 'function') {
      throw new TypeError('Non-Classic after-step mutation must be a function');
    }
    if (!this.physics.enable || !this.physics.autoSimulation) {
      throw new Error('Non-Classic after-step mutation requires auto-simulated Physics2D');
    }
    this.assertActiveCollisionFilter();
    const scheduledGeneration = this.leaseGeneration;
    const guardedMutation = (): void => {
      this.pendingAfterStepMutations.delete(guardedMutation);
      if (
        activeCollisionFilterOwner !== this
        || this.leaseGeneration !== scheduledGeneration
      ) {
        return;
      }
      mutation();
    };
    this.pendingAfterStepMutations.add(guardedMutation);
    try {
      director.once(Director.EVENT_AFTER_PHYSICS, guardedMutation);
    } catch (error) {
      this.pendingAfterStepMutations.delete(guardedMutation);
      throw error;
    }
  }

  private assertActiveCollisionFilter(): void {
    if (activeCollisionFilterOwner !== this) {
      throw new Error('Non-Classic physics adapter does not own the collision filter');
    }
  }

  private assertAutoSimulatedPhysics(): void {
    if (!this.physics.enable || !this.physics.autoSimulation) {
      throw new Error('Non-Classic collision filter requires auto-simulated Physics2D');
    }
  }

  private ensureRecoveredFruitMask(): void {
    const key = String(FRUIT_COLLISION_FILTER.categoryBits);
    const current = this.physics.collisionMatrix[key];
    if (!Number.isSafeInteger(current)) {
      throw new Error('Physics2D fruit collision mask is unavailable');
    }
    if (current !== FRUIT_COLLISION_FILTER.maskBits) {
      this.physics.collisionMatrix[key] = FRUIT_COLLISION_FILTER.maskBits;
    }
  }

  private cancelPendingAfterStepMutations(): void {
    for (const mutation of this.pendingAfterStepMutations) {
      director.off(Director.EVENT_AFTER_PHYSICS, mutation);
    }
    this.pendingAfterStepMutations.clear();
  }
}

function assertFinitePoint(
  point: Readonly<{ x: number; y: number }>,
  label: string,
): void {
  if (
    point === null
    || typeof point !== 'object'
    || !Number.isFinite(point.x)
    || !Number.isFinite(point.y)
  ) {
    throw new RangeError(`${label} must contain finite x and y coordinates`);
  }
}
