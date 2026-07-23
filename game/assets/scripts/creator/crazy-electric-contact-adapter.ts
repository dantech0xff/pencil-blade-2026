import {
  BoxCollider2D,
  Collider2D,
  Contact2DType,
  ERigidBody2DType,
  Node,
  RigidBody2D,
  Size,
  isValid,
  type IPhysics2DContact,
} from 'cc';

import {
  ELECTRIC_COLLISION_FILTER,
  ELECTRIC_FIELD_NODE_TAG,
  describeElectricFieldCompatibility,
} from '../domain/classic-fixture-rules';
import type { CrazyBombElectricSensorPort } from './crazy-bomb-electric-presenter';

/**
 * Creator cannot instantiate the native zero-height Box2D polygon. One world-unit thickness
 * is the smallest stable Creator shape and is the reconstruction's explicit safety adaptation.
 */
export const CRAZY_ELECTRIC_SAFE_SENSOR_HEIGHT = Math.fround(1);

export interface CrazyElectricBombContactTarget {
  readonly targetId: string;
}

export interface CrazyElectricContactAdapterInput {
  readonly logicalHeight: number;
  readonly logicalWidth: number;
  readonly parent: Node;
}

export interface CrazyElectricContactAdapterLifecycle<
  Target extends CrazyElectricBombContactTarget,
> {
  readonly callAfterStep: (mutation: () => void) => void;
  readonly onBombContact: (target: Target) => void;
  readonly resolveBomb: (collider: Collider2D) => Target | null;
}

/**
 * Type-safe Creator replacement for the native listener's incompatible fixture/user-data cast.
 *
 * The recovered four-window-wide horizontal line, position, tag, and collision category remain
 * intact. Only the invalid zero height becomes a one-unit sensor; contacts are accepted solely
 * when the runtime entity registry proves the other collider belongs to a standard bomb.
 */
export class CrazyElectricContactAdapter<
  Target extends CrazyElectricBombContactTarget = CrazyElectricBombContactTarget,
> implements CrazyBombElectricSensorPort {
  readonly body: RigidBody2D;
  readonly collider: BoxCollider2D;
  readonly node: Node;

  private activeValue = false;
  private disposedValue = false;
  private readonly lifecycle: CrazyElectricContactAdapterLifecycle<Target>;

  private constructor(
    input: CrazyElectricContactAdapterInput,
    lifecycle: CrazyElectricContactAdapterLifecycle<Target>,
  ) {
    this.lifecycle = lifecycle;
    const descriptor = describeElectricFieldCompatibility({
      viewportHeightWorldUnits: input.logicalHeight,
      viewportWidthWorldUnits: input.logicalWidth,
    });

    const node = new Node('CrazyElectricContactSensor');
    node.active = false;
    node.layer = input.parent.layer;
    node.setParent(input.parent);
    node.setPosition(
      descriptor.body.creatorPositionWorldUnits.x,
      descriptor.body.creatorPositionWorldUnits.y,
      0,
    );

    const body = node.addComponent(RigidBody2D);
    body.type = ERigidBody2DType.Static;
    body.enabledContactListener = true;
    body.group = ELECTRIC_COLLISION_FILTER.categoryBits;

    const collider = node.addComponent(BoxCollider2D);
    collider.size = new Size(
      descriptor.nominalFixture.shape.type === 'box'
        ? descriptor.nominalFixture.shape.creatorSizeWorldUnits.width
        : failMissingElectricBox(),
      CRAZY_ELECTRIC_SAFE_SENSOR_HEIGHT,
    );
    collider.sensor = true;
    collider.density = descriptor.nominalFixture.density;
    collider.friction = descriptor.nominalFixture.friction;
    collider.restitution = descriptor.nominalFixture.restitution;
    collider.group = ELECTRIC_COLLISION_FILTER.categoryBits;
    collider.tag = ELECTRIC_FIELD_NODE_TAG;
    collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);

    this.node = node;
    this.body = body;
    this.collider = collider;
  }

  static create<Target extends CrazyElectricBombContactTarget>(
    input: CrazyElectricContactAdapterInput,
    lifecycle: CrazyElectricContactAdapterLifecycle<Target>,
  ): CrazyElectricContactAdapter<Target> {
    assertInput(input);
    assertLifecycle(lifecycle);
    return new CrazyElectricContactAdapter(input, lifecycle);
  }

  get active(): boolean {
    return this.activeValue;
  }

  get disposed(): boolean {
    return this.disposedValue;
  }

  setActive(active: boolean): void {
    if (typeof active !== 'boolean') {
      throw new TypeError('Crazy electric sensor active state must be a boolean');
    }
    if (this.disposedValue) {
      if (!active) {
        return;
      }
      throw new Error('Disposed Crazy electric sensor cannot reactivate');
    }
    if (this.activeValue === active) {
      return;
    }
    if (
      active
      && (
        !isValid(this.node, true)
        || this.node.parent === null
        || !isValid(this.node.parent, true)
        || !this.node.parent.activeInHierarchy
      )
    ) {
      throw new Error(
        'Crazy electric sensor must be hierarchy-attached before activation',
      );
    }
    this.activeValue = active;
    this.node.active = active;
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.activeValue = false;
    this.node.active = false;
    this.collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
    if (isValid(this.node, true)) {
      this.node.destroy();
    }
    return true;
  }

  private readonly onBeginContact = (
    selfCollider: Collider2D,
    otherCollider: Collider2D,
    contact: IPhysics2DContact | null,
  ): void => {
    if (!this.activeValue || this.disposedValue) {
      return;
    }
    const bombCollider = resolveOtherCollider(
      this.collider,
      selfCollider,
      otherCollider,
      contact,
    );
    if (bombCollider === null) {
      return;
    }
    const target = this.lifecycle.resolveBomb(bombCollider);
    if (target !== null) {
      // BEGIN_CONTACT runs while Box2D is locked. Route every project-owned gameplay
      // mutation through the shared post-step drain so one throwing contact cannot make the
      // variable-step runner discard unrelated queued physics cleanup.
      this.lifecycle.callAfterStep(() => {
        if (!this.disposedValue) {
          this.lifecycle.onBombContact(target);
        }
      });
    }
  };
}

function resolveOtherCollider(
  sensor: Collider2D,
  selfCollider: Collider2D,
  otherCollider: Collider2D,
  contact: IPhysics2DContact | null,
): Collider2D | null {
  if (selfCollider === sensor && otherCollider !== sensor) {
    return otherCollider;
  }
  if (otherCollider === sensor && selfCollider !== sensor) {
    return selfCollider;
  }
  const colliderA = contact?.colliderA ?? null;
  const colliderB = contact?.colliderB ?? null;
  if (colliderA === sensor && colliderB !== null && colliderB !== sensor) {
    return colliderB;
  }
  if (colliderB === sensor && colliderA !== null && colliderA !== sensor) {
    return colliderA;
  }
  return null;
}

function assertInput(input: CrazyElectricContactAdapterInput): void {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Crazy electric contact input must be an object');
  }
  // Crazy assembles its complete mode tree before the screen owner attaches that tree to the
  // running scene. Validate local participation here; hierarchy activity belongs to setActive().
  if (!isValid(input.parent, true) || !input.parent.active) {
    throw new Error('Crazy electric contact parent must be valid and active');
  }
  assertPositiveFloat32(input.logicalWidth, 'logicalWidth');
  assertPositiveFloat32(input.logicalHeight, 'logicalHeight');
}

function assertLifecycle<Target extends CrazyElectricBombContactTarget>(
  lifecycle: CrazyElectricContactAdapterLifecycle<Target>,
): void {
  if (
    lifecycle === null
    || typeof lifecycle !== 'object'
    || typeof lifecycle.callAfterStep !== 'function'
    || typeof lifecycle.resolveBomb !== 'function'
    || typeof lifecycle.onBombContact !== 'function'
  ) {
    throw new TypeError('Crazy electric contact lifecycle is incomplete');
  }
}

function assertPositiveFloat32(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(Math.fround(value))) {
    throw new RangeError(`${label} must be a positive finite float32 value`);
  }
}

function failMissingElectricBox(): never {
  throw new Error('Recovered electric field fixture must be a box');
}
