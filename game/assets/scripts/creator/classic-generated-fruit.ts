import {
  BoxCollider2D,
  CircleCollider2D,
  Collider2D,
  ERigidBody2DType,
  Node,
  RigidBody2D,
  Size,
  Sprite,
  UITransform,
  Vec2,
  isValid,
} from 'cc';

import {
  createClassicBoundsCommands,
  type ClassicBoundsCommand,
  type DisposalBoundary,
} from '../domain/classic-bounds';
import type { CutSegment, CuttableSnapshot } from '../domain/classic-cut-query';
import {
  LEGACY_WORLD_UNITS_PER_METRE,
  createFruitFixtureConfiguration,
  type FruitFixtureConfiguration,
} from '../domain/classic-fixture-rules';
import { getFruitScore } from '../domain/classic-fruit-cut';
import type { ClassicCreateCommand } from '../domain/classic-spawn-planner';
import type { ClassicNormalFruitId } from '../domain/classic-resource-contract';
import { positionMetresToCreatorWorldUnits } from '../domain/spawn-kinematics';
import type { LoadedClassicNormalFruitResources } from './classic-resource-loader';

export type ClassicNormalFruitCreateCommand = Extract<
  ClassicCreateCommand,
  Readonly<{ type: 'create-fruit'; tossType: 0 }>
>;

export type ClassicGeneratedFruitDisposalReason =
  | 'cut'
  | 'registry-dispose-all'
  | 'spawn-failed'
  | Readonly<{ type: 'bounds'; boundary: DisposalBoundary }>;

export interface ClassicGeneratedFruitCutEvent {
  readonly critical: boolean;
  readonly entityOccurrenceId: number;
  readonly fruitId: ClassicNormalFruitId;
  readonly score: 1 | 10;
  readonly segment: CutSegment;
  readonly sourceAngleRadians: number;
  readonly sourceAngularVelocityRadiansPerSecond: number;
  readonly sourceBodyMass: number;
  readonly targetId: string;
  readonly worldPosition: Readonly<{ x: number; y: number }>;
}

export interface ClassicGeneratedFruitMissEvent {
  readonly entityOccurrenceId: number;
  readonly targetId: string;
  readonly worldPosition: Readonly<{ x: number; y: number }>;
}

export interface ClassicGeneratedFruitDisposedEvent {
  readonly collider: Collider2D;
  readonly entityOccurrenceId: number;
  readonly reason: ClassicGeneratedFruitDisposalReason;
  readonly targetId: string;
}

export interface ClassicGeneratedFruitLifecycle {
  readonly callAfterStep: (mutation: () => void) => void;
  readonly onCut: (event: ClassicGeneratedFruitCutEvent) => void;
  readonly onDisposed: (event: ClassicGeneratedFruitDisposedEvent) => void;
  readonly onMiss: (event: ClassicGeneratedFruitMissEvent) => void;
}

/**
 * Runtime ordinary fruit using the exact staged SpriteFrame selected by resolution profile.
 */
export class ClassicGeneratedFruit {
  readonly body: RigidBody2D;
  readonly collider: Collider2D;
  readonly critical: boolean;
  readonly entityOccurrenceId: number;
  readonly fruitId: ClassicNormalFruitId;
  readonly node: Node;
  readonly sprite: Sprite;
  readonly targetId: string;

  private readonly lifecycle: ClassicGeneratedFruitLifecycle;
  private cutDisabledValue = false;
  private disposalQueued = false;
  private attached = false;

  private constructor(
    command: ClassicNormalFruitCreateCommand,
    fixture: FruitFixtureConfiguration,
    visuals: LoadedClassicNormalFruitResources,
    lifecycle: ClassicGeneratedFruitLifecycle,
  ) {
    this.entityOccurrenceId = command.entityOccurrenceId;
    this.fruitId = command.fruitId as ClassicNormalFruitId;
    this.critical = command.critical;
    this.targetId = `classic-fruit:${command.entityOccurrenceId}`;
    this.lifecycle = lifecycle;

    this.node = new Node(`ClassicGeneratedFruit-${command.entityOccurrenceId}`);
    this.node.active = false;
    const transform = this.node.addComponent(UITransform);
    transform.setContentSize(
      visuals.intact.dimensions.width,
      visuals.intact.dimensions.height,
    );
    transform.setAnchorPoint(0.5, 0.5);
    this.sprite = this.node.addComponent(Sprite);
    this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.sprite.spriteFrame = visuals.intact.spriteFrame;

    this.body = this.node.addComponent(RigidBody2D);
    configureBody(this.body, fixture);
    this.collider = addConfiguredCollider(this.node, fixture);

    this.node.setPosition(
      fixture.body.creatorPositionWorldUnits.x,
      fixture.body.creatorPositionWorldUnits.y,
      0,
    );
    this.node.setRotationFromEuler(0, 0, 0);
  }

  static create(
    command: ClassicNormalFruitCreateCommand,
    viewport: Readonly<{ width: number; height: number }>,
    visuals: LoadedClassicNormalFruitResources,
    lifecycle: ClassicGeneratedFruitLifecycle,
  ): ClassicGeneratedFruit {
    assertNormalCreateCommand(command);
    assertViewport(viewport);
    assertLifecycle(lifecycle);
    const fixture = createFruitFixtureConfiguration({
      fruitId: command.fruitId,
      spriteHeightWorldUnits: visuals.intact.dimensions.height,
      spriteWidthWorldUnits: visuals.intact.dimensions.width,
      viewportHeightWorldUnits: viewport.height,
      viewportWidthWorldUnits: viewport.width,
    });
    return new ClassicGeneratedFruit(command, fixture, visuals, lifecycle);
  }

  get cutDisabled(): boolean {
    return this.cutDisabledValue || this.disposalQueued;
  }

  setTransform(
    positionMetres: Readonly<{ x: number; y: number }>,
    angleRadians: number,
  ): void {
    assertFiniteVector(positionMetres, 'positionMetres');
    assertFinite(angleRadians, 'angleRadians');
    if (this.attached) {
      throw new Error('Classic fruit spawn transform must be set before attachment');
    }
    const worldUnits = positionMetresToCreatorWorldUnits(positionMetres);
    this.node.setPosition(worldUnits.x, worldUnits.y, 0);
    this.node.setRotationFromEuler(0, 0, angleRadians * 180 / Math.PI);
  }

  setLinearVelocity(metresPerSecond: Readonly<{ x: number; y: number }>): void {
    assertFiniteVector(metresPerSecond, 'metresPerSecond');
    if (this.attached) {
      throw new Error('Classic fruit spawn velocity must be set before attachment');
    }
    this.body.linearVelocity = new Vec2(metresPerSecond.x, metresPerSecond.y);
  }

  setAngularVelocity(radiansPerSecond: number): void {
    assertFinite(radiansPerSecond, 'radiansPerSecond');
    if (this.attached) {
      throw new Error('Classic fruit angular velocity must be set before attachment');
    }
    this.body.angularVelocity = radiansPerSecond;
  }

  attach(parent: Node, zOrder: 1): void {
    if (!isValid(parent, true)) {
      throw new Error('Classic fruit parent must be valid');
    }
    if (!parent.activeInHierarchy) {
      throw new Error('Classic fruit parent must be active in the scene');
    }
    if (this.attached || this.node.parent !== null) {
      throw new Error('Classic fruit is already attached');
    }
    if (zOrder !== 1) {
      throw new RangeError('Classic generated fruit only supports recovered z-order 1');
    }

    this.node.layer = parent.layer;
    this.node.setParent(parent, true);
    this.node.setSiblingIndex(zOrder);
    this.attached = true;
    this.node.active = true;
  }

  snapshot(): CuttableSnapshot {
    const worldPosition = this.worldPositionSnapshot();
    return Object.freeze({
      bodyWorldPosition: worldPosition,
      cutDisabled: this.cutDisabled,
      id: this.targetId,
      isFruit: true,
      nodeTag: this.collider.tag,
    });
  }

  cut(segment: CutSegment): boolean {
    if (this.cutDisabled) {
      return false;
    }
    this.cutDisabledValue = true;
    try {
      this.emitCutNotification(segment);
    } finally {
      this.queueDispose('cut');
    }
    return true;
  }

  /** Native Fruit stays cut-enabled until the complete blade query has drained. */
  cutWithinRayQuery(segment: CutSegment): boolean {
    if (this.cutDisabledValue || this.disposalQueued) {
      return false;
    }
    this.emitCutNotification(segment);
    return true;
  }

  completeRayQueryCuts(): void {
    if (this.cutDisabledValue || this.disposalQueued) {
      return;
    }
    this.cutDisabledValue = true;
    this.queueDispose('cut');
  }

  private emitCutNotification(segment: CutSegment): void {
    const copiedSegment = copySegment(segment);
    const sourceBodyMass = this.body.getMass();
    assertPositive(sourceBodyMass, 'sourceBodyMass');
    const event: ClassicGeneratedFruitCutEvent = Object.freeze({
      critical: this.critical,
      entityOccurrenceId: this.entityOccurrenceId,
      fruitId: this.fruitId,
      score: getFruitScore(this.critical),
      segment: copiedSegment,
      sourceAngleRadians: this.bodyAngleRadiansSnapshot(),
      sourceAngularVelocityRadiansPerSecond: this.body.angularVelocity,
      sourceBodyMass,
      targetId: this.targetId,
      worldPosition: this.worldPositionSnapshot(),
    });
    this.lifecycle.onCut(event);
  }

  private bodyAngleRadiansSnapshot(): number {
    // The public Creator component omits an angle getter, while its pinned IRigidBody2D
    // adapter exposes the active Box2D body through `impl`. Reading GetAngle preserves the
    // unwrapped body angle required by the recovered Fruit::Cut orientation rule.
    const rawBody: unknown = this.body.impl?.impl;
    if (
      rawBody !== null
      && typeof rawBody === 'object'
      && 'GetAngle' in rawBody
      && typeof rawBody.GetAngle === 'function'
    ) {
      const angle = rawBody.GetAngle.call(rawBody) as unknown;
      if (typeof angle === 'number' && Number.isFinite(angle)) {
        return angle;
      }
    }

    // Defensive backend fallback. The pinned Box2D and Box2D-WASM adapters both expose
    // GetAngle; this normalized node value is not counted as exact raw-angle parity.
    const fallback = this.node.eulerAngles.z * Math.PI / 180;
    assertFinite(fallback, 'sourceAngleRadians');
    return fallback;
  }

  evaluateBounds(
    viewport: Readonly<{ width: number; height: number }>,
  ): readonly ClassicBoundsCommand[] {
    assertViewport(viewport);
    if (this.disposalQueued) {
      return Object.freeze([]);
    }

    const worldPosition = this.worldPositionSnapshot();
    const linearVelocity = this.body.linearVelocity;
    const commands = createClassicBoundsCommands({
      linearVelocityMetresPerSecond: {
        x: linearVelocity.x,
        y: linearVelocity.y,
      },
      positionWorldUnits: worldPosition,
      viewportHeightWorldUnits: viewport.height,
      viewportWidthWorldUnits: viewport.width,
    });

    let disposalBoundary: DisposalBoundary | null = null;
    let missPosition: Readonly<{ x: number; y: number }> | null = null;
    for (const command of commands) {
      if (command.type === 'fail') {
        missPosition = command.positionWorldUnits;
      } else {
        disposalBoundary = command.boundary;
      }
    }

    if (missPosition !== null) {
      const missEvent: ClassicGeneratedFruitMissEvent = Object.freeze({
        entityOccurrenceId: this.entityOccurrenceId,
        targetId: this.targetId,
        worldPosition: missPosition,
      });
      try {
        this.lifecycle.onMiss(missEvent);
      } finally {
        if (disposalBoundary !== null) {
          this.queueDispose(Object.freeze({
            type: 'bounds',
            boundary: disposalBoundary,
          }));
        }
      }
    } else if (disposalBoundary !== null) {
      this.queueDispose(Object.freeze({
        type: 'bounds',
        boundary: disposalBoundary,
      }));
    }

    return commands;
  }

  queueDispose(reason: ClassicGeneratedFruitDisposalReason): boolean {
    if (this.disposalQueued) {
      return false;
    }
    this.disposalQueued = true;
    const event: ClassicGeneratedFruitDisposedEvent = Object.freeze({
      collider: this.collider,
      entityOccurrenceId: this.entityOccurrenceId,
      reason,
      targetId: this.targetId,
    });

    let mutationStarted = false;
    try {
      this.lifecycle.callAfterStep(() => {
        mutationStarted = true;
        try {
          if (isValid(this.node, true)) {
            this.node.destroy();
          }
        } finally {
          this.lifecycle.onDisposed(event);
        }
      });
    } catch (error) {
      if (!mutationStarted) {
        this.disposalQueued = false;
      }
      throw error;
    }
    return true;
  }

  private worldPositionSnapshot(): Readonly<{ x: number; y: number }> {
    const position = this.node.worldPosition;
    return Object.freeze({ x: position.x, y: position.y });
  }

}

function configureBody(body: RigidBody2D, fixture: FruitFixtureConfiguration): void {
  const definition = fixture.body;
  body.type = ERigidBody2DType.Dynamic;
  body.allowSleep = definition.allowSleep;
  body.awakeOnLoad = definition.awake;
  body.bullet = definition.bullet;
  body.fixedRotation = definition.fixedRotation;
  body.gravityScale = definition.gravityScale;
  body.linearDamping = definition.linearDamping;
  body.angularDamping = definition.angularDamping;
  body.linearVelocity = new Vec2(
    definition.linearVelocityMetresPerSecond.x,
    definition.linearVelocityMetresPerSecond.y,
  );
  body.angularVelocity = definition.angularVelocityRadiansPerSecond;
  body.group = fixture.fixture.filter.categoryBits;
}

function addConfiguredCollider(
  node: Node,
  fixture: FruitFixtureConfiguration,
): Collider2D {
  const definition = fixture.fixture;
  const shape = definition.shape;
  let collider: Collider2D;
  if (shape.type === 'circle') {
    const circle = node.addComponent(CircleCollider2D);
    circle.radius = shape.creatorRadiusWorldUnits;
    circle.offset = new Vec2(
      shape.centerMetres.x * LEGACY_WORLD_UNITS_PER_METRE,
      shape.centerMetres.y * LEGACY_WORLD_UNITS_PER_METRE,
    );
    collider = circle;
  } else {
    const box = node.addComponent(BoxCollider2D);
    box.size = new Size(
      shape.creatorSizeWorldUnits.width,
      shape.creatorSizeWorldUnits.height,
    );
    box.offset = new Vec2(
      shape.centerMetres.x * LEGACY_WORLD_UNITS_PER_METRE,
      shape.centerMetres.y * LEGACY_WORLD_UNITS_PER_METRE,
    );
    collider = box;
  }

  collider.density = definition.density;
  collider.friction = definition.friction;
  collider.restitution = definition.restitution;
  collider.sensor = definition.sensor;
  collider.group = definition.filter.categoryBits;
  collider.tag = 0;
  return collider;
}

function copySegment(segment: CutSegment): CutSegment {
  if (segment === null || typeof segment !== 'object') {
    throw new TypeError('segment must be an object');
  }
  assertFiniteVector(segment.start, 'segment.start');
  assertFiniteVector(segment.end, 'segment.end');
  return Object.freeze({
    start: Object.freeze({ x: segment.start.x, y: segment.start.y }),
    end: Object.freeze({ x: segment.end.x, y: segment.end.y }),
  });
}

function assertNormalCreateCommand(
  command: ClassicNormalFruitCreateCommand,
): void {
  if (command === null || typeof command !== 'object') {
    throw new TypeError('command must be an object');
  }
  if (command.type !== 'create-fruit' || command.tossType !== 0) {
    throw new RangeError('Classic generated fruit only supports create-fruit tossType 0');
  }
  if (!Number.isSafeInteger(command.entityOccurrenceId) || command.entityOccurrenceId <= 0) {
    throw new RangeError('entityOccurrenceId must be a positive safe integer');
  }
  if (typeof command.critical !== 'boolean') {
    throw new TypeError('critical must be a boolean');
  }
}

function assertLifecycle(lifecycle: ClassicGeneratedFruitLifecycle): void {
  if (lifecycle === null || typeof lifecycle !== 'object') {
    throw new TypeError('lifecycle must be an object');
  }
  for (const callback of [
    lifecycle.callAfterStep,
    lifecycle.onCut,
    lifecycle.onDisposed,
    lifecycle.onMiss,
  ]) {
    if (typeof callback !== 'function') {
      throw new TypeError('Classic generated fruit lifecycle callbacks must be functions');
    }
  }
}

function assertViewport(viewport: Readonly<{ width: number; height: number }>): void {
  if (viewport === null || typeof viewport !== 'object') {
    throw new TypeError('viewport must be an object');
  }
  assertPositive(viewport.width, 'viewport.width');
  assertPositive(viewport.height, 'viewport.height');
}

function assertFiniteVector(
  value: Readonly<{ x: number; y: number }>,
  label: string,
): void {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
  assertFinite(value.x, `${label}.x`);
  assertFinite(value.y, `${label}.y`);
}

function assertPositive(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}
