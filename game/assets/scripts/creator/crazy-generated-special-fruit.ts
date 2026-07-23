import {
  CircleCollider2D,
  ERigidBody2DType,
  Node,
  RigidBody2D,
  Sprite,
  UITransform,
  Vec2,
  isValid,
} from 'cc';

import type { BonusTossCommand } from '../domain/bonus-toss-strategy';
import {
  createClassicBoundsCommands,
  type ClassicBoundsCommand,
  type DisposalBoundary,
} from '../domain/classic-bounds';
import type { CutSegment, CuttableSnapshot } from '../domain/classic-cut-query';
import {
  FRUIT_COLLISION_FILTER,
  LEGACY_WORLD_UNITS_PER_METRE,
  createFruitFixtureConfiguration,
  type CollisionFilterData,
  type FruitFixtureConfiguration,
} from '../domain/classic-fixture-rules';
import type { ClassicCreateCommand } from '../domain/classic-spawn-planner';
import {
  getCrazySpecialFruitResources,
  type CrazySpecialFruitId,
  type CrazySpecialFruitRasterSet,
} from '../domain/crazy-resource-contract';
import { positionMetresToCreatorWorldUnits } from '../domain/spawn-kinematics';
import type { LoadedCrazyResources } from './crazy-resource-loader';
import type { LoadedGameRasterResource } from './game-resource-loader';

export type CrazyDownSpecialFruitCreateCommand = Extract<
  ClassicCreateCommand,
  Readonly<{ type: 'create-fruit'; tossType: 3 | 4 }>
>;

export type CrazyBonusSpecialFruitCreateCommand = Extract<
  BonusTossCommand,
  Readonly<{ type: 'create-bonus-fruit' }>
>;

export type CrazySpecialFruitCreateCommand =
  | CrazyBonusSpecialFruitCreateCommand
  | CrazyDownSpecialFruitCreateCommand;

export type CrazySpecialFruitTossType = CrazySpecialFruitCreateCommand['tossType'];

export const CRAZY_GENERATED_SPECIAL_FRUIT_Z_ORDER = 1;
export const TARGET_CRAZY_SPECIAL_FRUIT_COLLIDER_TAG = 0;

export interface LoadedCrazySpecialFruitVisuals {
  readonly cutBottom: LoadedGameRasterResource;
  readonly cutTop: LoadedGameRasterResource;
  readonly intact: LoadedGameRasterResource;
}

export type CrazyGeneratedSpecialFruitDisposalReason =
  | 'cut'
  | 'registry-dispose-all'
  | 'spawn-failed'
  | Readonly<{ type: 'bounds'; boundary: DisposalBoundary }>;

export interface CrazyGeneratedSpecialFruitCutEvent {
  readonly entityOccurrenceId: number;
  readonly fruitId: CrazySpecialFruitId;
  readonly segment: CutSegment;
  readonly sourceAngleRadians: number;
  readonly sourceAngularVelocityRadiansPerSecond: number;
  readonly sourceBodyMass: number;
  readonly targetId: string;
  readonly tossType: CrazySpecialFruitTossType;
  readonly visuals: LoadedCrazySpecialFruitVisuals;
  readonly worldPosition: Readonly<{ x: number; y: number }>;
}

export interface CrazyGeneratedSpecialFruitMissEvent {
  readonly entityOccurrenceId: number;
  readonly fruitId: CrazySpecialFruitId;
  readonly targetId: string;
  readonly tossType: CrazySpecialFruitTossType;
  readonly worldPosition: Readonly<{ x: number; y: number }>;
}

export interface CrazyGeneratedSpecialFruitDisposedEvent {
  readonly collider: CircleCollider2D;
  readonly entityOccurrenceId: number;
  readonly reason: CrazyGeneratedSpecialFruitDisposalReason;
  readonly targetId: string;
}

export interface CrazyGeneratedSpecialFruitLifecycle {
  readonly callAfterStep: (mutation: () => void) => void;
  readonly onCut: (event: CrazyGeneratedSpecialFruitCutEvent) => void;
  readonly onDisposed: (event: CrazyGeneratedSpecialFruitDisposedEvent) => void;
  readonly onMiss: (event: CrazyGeneratedSpecialFruitMissEvent) => void;
}

/**
 * Crazy-only generated fruit for the five recovered special IDs.
 *
 * The entity owns the exact loaded intact/cut raster triple and recovered shared Fruit
 * body/fixture lifecycle. Crazy score, timer, audio, and effect dispatch remain controller
 * responsibilities and are deliberately absent from this boundary.
 */
export class CrazyGeneratedSpecialFruit {
  readonly body: RigidBody2D;
  readonly collider: CircleCollider2D;
  readonly colliderTag = TARGET_CRAZY_SPECIAL_FRUIT_COLLIDER_TAG;
  readonly collisionFilter: CollisionFilterData = FRUIT_COLLISION_FILTER;
  readonly entityOccurrenceId: number;
  readonly fruitId: CrazySpecialFruitId;
  readonly node: Node;
  readonly nodeName: string;
  readonly sprite: Sprite;
  readonly targetId: string;
  readonly tossType: CrazySpecialFruitTossType;
  readonly visuals: LoadedCrazySpecialFruitVisuals;

  private attachedValue = false;
  private cutDisabledValue = false;
  private disposalQueuedValue = false;
  private readonly lifecycle: CrazyGeneratedSpecialFruitLifecycle;

  private constructor(
    command: CrazySpecialFruitCreateCommand,
    fixture: FruitFixtureConfiguration,
    visuals: LoadedCrazySpecialFruitVisuals,
    lifecycle: CrazyGeneratedSpecialFruitLifecycle,
  ) {
    this.entityOccurrenceId = command.entityOccurrenceId;
    this.fruitId = command.fruitId;
    this.tossType = command.tossType;
    const identity = createSpecialFruitIdentity(command);
    this.targetId = identity.targetId;
    this.nodeName = identity.nodeName;
    this.visuals = visuals;
    this.lifecycle = lifecycle;

    this.node = new Node(this.nodeName);
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
    command: CrazySpecialFruitCreateCommand,
    viewport: Readonly<{ width: number; height: number }>,
    resources: LoadedCrazyResources,
    lifecycle: CrazyGeneratedSpecialFruitLifecycle,
  ): CrazyGeneratedSpecialFruit {
    assertCreateCommand(command);
    assertViewport(viewport);
    assertResourceCatalog(resources);
    assertLifecycle(lifecycle);

    // Resolve and validate all three frames before constructing any Creator node so a partial
    // or profile-mismatched catalog cannot leave an untracked physics entity behind.
    const visuals = resolveExactVisuals(command.fruitId, resources);
    const fixture = createFruitFixtureConfiguration({
      fruitId: command.fruitId,
      spriteHeightWorldUnits: visuals.intact.dimensions.height,
      spriteWidthWorldUnits: visuals.intact.dimensions.width,
      viewportHeightWorldUnits: viewport.height,
      viewportWidthWorldUnits: viewport.width,
    });
    return new CrazyGeneratedSpecialFruit(command, fixture, visuals, lifecycle);
  }

  get attached(): boolean {
    return this.attachedValue;
  }

  get cutDisabled(): boolean {
    return this.cutDisabledValue || this.disposalQueuedValue;
  }

  get disposalQueued(): boolean {
    return this.disposalQueuedValue;
  }

  setTransform(
    positionMetres: Readonly<{ x: number; y: number }>,
    angleRadians: number,
  ): void {
    assertFiniteVector(positionMetres, 'positionMetres');
    assertFinite(angleRadians, 'angleRadians');
    this.assertMutableBeforeAttachment('set its spawn transform');
    const worldUnits = positionMetresToCreatorWorldUnits(positionMetres);
    this.node.setPosition(worldUnits.x, worldUnits.y, 0);
    this.node.setRotationFromEuler(0, 0, angleRadians * 180 / Math.PI);
  }

  setLinearVelocity(metresPerSecond: Readonly<{ x: number; y: number }>): void {
    assertFiniteVector(metresPerSecond, 'metresPerSecond');
    this.assertMutableBeforeAttachment('set its spawn velocity');
    this.body.linearVelocity = new Vec2(metresPerSecond.x, metresPerSecond.y);
  }

  setAngularVelocity(radiansPerSecond: number): void {
    assertFinite(radiansPerSecond, 'radiansPerSecond');
    this.assertMutableBeforeAttachment('set its angular velocity');
    this.body.angularVelocity = radiansPerSecond;
  }

  attach(parent: Node, zOrder: 1): void {
    if (!isValid(parent, true)) {
      throw new Error('Crazy special-fruit parent must be valid');
    }
    if (!parent.activeInHierarchy) {
      throw new Error('Crazy special-fruit parent must be active in the scene');
    }
    if (this.disposalQueuedValue) {
      throw new Error('Crazy special fruit cannot attach after disposal is queued');
    }
    if (this.attachedValue || this.node.parent !== null) {
      throw new Error('Crazy special fruit is already attached');
    }
    if (zOrder !== CRAZY_GENERATED_SPECIAL_FRUIT_Z_ORDER) {
      throw new RangeError(
        'Crazy generated special fruit only supports recovered z-order 1',
      );
    }

    this.node.layer = parent.layer;
    this.node.setParent(parent, true);
    this.node.setSiblingIndex(CRAZY_GENERATED_SPECIAL_FRUIT_Z_ORDER);
    this.attachedValue = true;
    this.node.active = true;
  }

  snapshot(): CuttableSnapshot {
    return Object.freeze({
      bodyWorldPosition: this.worldPositionSnapshot(),
      cutDisabled: this.cutDisabled,
      id: this.targetId,
      isFruit: true,
      nodeTag: this.colliderTag,
    });
  }

  cut(segment: CutSegment): boolean {
    if (this.cutDisabled) {
      return false;
    }
    const copiedSegment = copySegment(segment);
    this.cutDisabledValue = true;
    try {
      this.emitCutNotification(copiedSegment);
    } finally {
      this.queueDispose('cut');
    }
    return true;
  }

  /** Recovered Fruit remains cut-enabled until the complete blade query has drained. */
  cutWithinRayQuery(segment: CutSegment): boolean {
    if (this.cutDisabledValue || this.disposalQueuedValue) {
      return false;
    }
    this.emitCutNotification(copySegment(segment));
    return true;
  }

  completeRayQueryCuts(): void {
    if (this.cutDisabledValue || this.disposalQueuedValue) {
      return;
    }
    this.cutDisabledValue = true;
    try {
      this.queueDispose('cut');
    } catch (error) {
      // Scheduling failure leaves the body alive and queueDispose restores its own guard.
      // Restore the cut guard too so a later full ray query can retry the exact lifecycle.
      this.cutDisabledValue = false;
      throw error;
    }
  }

  evaluateBounds(
    viewport: Readonly<{ width: number; height: number }>,
  ): readonly ClassicBoundsCommand[] {
    assertViewport(viewport);
    if (this.disposalQueuedValue) {
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
      const event: CrazyGeneratedSpecialFruitMissEvent = Object.freeze({
        entityOccurrenceId: this.entityOccurrenceId,
        fruitId: this.fruitId,
        targetId: this.targetId,
        tossType: this.tossType,
        worldPosition: missPosition,
      });
      try {
        this.lifecycle.onMiss(event);
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

  queueDispose(reason: CrazyGeneratedSpecialFruitDisposalReason): boolean {
    assertDisposalReason(reason);
    if (this.disposalQueuedValue) {
      return false;
    }
    this.disposalQueuedValue = true;
    const event: CrazyGeneratedSpecialFruitDisposedEvent = Object.freeze({
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
          this.attachedValue = false;
          this.lifecycle.onDisposed(event);
        }
      });
    } catch (error) {
      if (!mutationStarted) {
        this.disposalQueuedValue = false;
      }
      throw error;
    }
    return true;
  }

  private assertMutableBeforeAttachment(action: string): void {
    if (this.disposalQueuedValue) {
      throw new Error(
        `Crazy special fruit cannot ${action} after disposal is queued`,
      );
    }
    if (this.attachedValue) {
      throw new Error(
        `Crazy special fruit must ${action} before attachment`,
      );
    }
  }

  private bodyAngleRadiansSnapshot(): number {
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

    const fallback = this.node.eulerAngles.z * Math.PI / 180;
    assertFinite(fallback, 'sourceAngleRadians');
    return fallback;
  }

  private emitCutNotification(segment: CutSegment): void {
    const sourceBodyMass = this.body.getMass();
    assertPositive(sourceBodyMass, 'sourceBodyMass');
    const event: CrazyGeneratedSpecialFruitCutEvent = Object.freeze({
      entityOccurrenceId: this.entityOccurrenceId,
      fruitId: this.fruitId,
      segment,
      sourceAngleRadians: this.bodyAngleRadiansSnapshot(),
      sourceAngularVelocityRadiansPerSecond: this.body.angularVelocity,
      sourceBodyMass,
      targetId: this.targetId,
      tossType: this.tossType,
      visuals: this.visuals,
      worldPosition: this.worldPositionSnapshot(),
    });
    this.lifecycle.onCut(event);
  }

  private worldPositionSnapshot(): Readonly<{ x: number; y: number }> {
    const position = this.node.worldPosition;
    return Object.freeze({ x: position.x, y: position.y });
  }
}

function createSpecialFruitIdentity(
  command: CrazySpecialFruitCreateCommand,
): Readonly<{ nodeName: string; targetId: string }> {
  // BonusToss owns an occurrence counter independent from the shared spawn planner. Preserve
  // both recovered counters and namespace their target-only identities instead of pretending
  // the numeric values belong to one global sequence.
  if (command.type === 'create-bonus-fruit') {
    return Object.freeze({
      nodeName: `CrazyGeneratedSpecialFruit-bonus-${command.controllerId}`
        + `-${command.entityOccurrenceId}`,
      targetId: `crazy-special-fruit:bonus:${command.controllerId}`
        + `:${command.entityOccurrenceId}`,
    });
  }
  return Object.freeze({
    nodeName: `CrazyGeneratedSpecialFruit-shared-planner-${command.entityOccurrenceId}`,
    targetId: `crazy-special-fruit:shared-planner:${command.entityOccurrenceId}`,
  });
}

function resolveExactVisuals(
  fruitId: CrazySpecialFruitId,
  resources: LoadedCrazyResources,
): LoadedCrazySpecialFruitVisuals {
  const expected = getCrazySpecialFruitResources(fruitId, resources.assetTree);
  const visuals = Object.freeze({
    cutBottom: resources.raster(expected.cutBottom),
    cutTop: resources.raster(expected.cutTop),
    intact: resources.raster(expected.intact),
  });
  assertExactLoadedRaster(visuals.intact, expected.intact, 'intact');
  assertExactLoadedRaster(visuals.cutTop, expected.cutTop, 'cutTop');
  assertExactLoadedRaster(visuals.cutBottom, expected.cutBottom, 'cutBottom');
  return visuals;
}

function configureBody(
  body: RigidBody2D,
  fixture: FruitFixtureConfiguration,
): void {
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
): CircleCollider2D {
  const definition = fixture.fixture;
  if (definition.shape.type !== 'circle') {
    throw new Error('Recovered Crazy special-fruit fixture must be circular');
  }
  const collider = node.addComponent(CircleCollider2D);
  collider.radius = definition.shape.creatorRadiusWorldUnits;
  collider.offset = new Vec2(
    definition.shape.centerMetres.x * LEGACY_WORLD_UNITS_PER_METRE,
    definition.shape.centerMetres.y * LEGACY_WORLD_UNITS_PER_METRE,
  );
  collider.density = definition.density;
  collider.friction = definition.friction;
  collider.restitution = definition.restitution;
  collider.sensor = definition.sensor;
  collider.group = definition.filter.categoryBits;
  collider.tag = TARGET_CRAZY_SPECIAL_FRUIT_COLLIDER_TAG;
  return collider;
}

function assertCreateCommand(
  command: CrazySpecialFruitCreateCommand,
): void {
  if (command === null || typeof command !== 'object') {
    throw new TypeError('command must be an object');
  }
  if (!Number.isSafeInteger(command.entityOccurrenceId) || command.entityOccurrenceId <= 0) {
    throw new RangeError('entityOccurrenceId must be a positive safe integer');
  }

  if (command.type === 'create-bonus-fruit') {
    if (
      command.tossType !== 5
      || (command.fruitId !== 10 && command.fruitId !== 11 && command.fruitId !== 12)
    ) {
      throw new RangeError(
        'Crazy bonus-fruit commands require tossType 5 and fruit ID 10, 11, or 12',
      );
    }
    if (typeof command.controllerId !== 'string' || command.controllerId.length === 0) {
      throw new TypeError('Crazy bonus-fruit controllerId must be a non-empty string');
    }
    return;
  }

  if (
    command.type !== 'create-fruit'
    || (
      (command.tossType !== 3 || command.fruitId !== 13)
      && (command.tossType !== 4 || command.fruitId !== 14)
    )
  ) {
    throw new RangeError(
      'Crazy Down special-fruit commands require tossType 3/ID 13 or tossType 4/ID 14',
    );
  }
}

function assertResourceCatalog(resources: LoadedCrazyResources): void {
  if (resources === null || typeof resources !== 'object') {
    throw new TypeError('resources must be a loaded Crazy resource catalog');
  }
  if (resources.assetTree !== '480x800' && resources.assetTree !== '720x1280') {
    throw new RangeError('resources.assetTree must be a recovered game asset tree');
  }
  if (typeof resources.raster !== 'function') {
    throw new TypeError('resources must provide raster()');
  }
}

function assertExactLoadedRaster(
  loaded: LoadedGameRasterResource,
  expected: CrazySpecialFruitRasterSet[keyof CrazySpecialFruitRasterSet],
  label: string,
): void {
  if (loaded === null || typeof loaded !== 'object') {
    throw new TypeError(`${label} visual must be a loaded raster`);
  }
  if (loaded.canonicalPath !== expected.canonicalPath) {
    throw new RangeError(
      `${label} visual must use exact raster ${expected.canonicalPath}`,
    );
  }
  if (
    loaded.dimensions?.width !== expected.dimensions.width
    || loaded.dimensions.height !== expected.dimensions.height
  ) {
    throw new RangeError(
      `${label} visual dimensions must match exact recovered raster geometry`,
    );
  }
  if (!isValid(loaded.spriteFrame, true)) {
    throw new Error(`${label} visual must provide a valid loaded Creator SpriteFrame`);
  }
  const original = loaded.spriteFrame.originalSize;
  const rect = loaded.spriteFrame.rect;
  if (
    original.width !== expected.dimensions.width
    || original.height !== expected.dimensions.height
    || rect.width !== expected.dimensions.width
    || rect.height !== expected.dimensions.height
  ) {
    throw new RangeError(
      `${label} SpriteFrame must preserve exact untrimmed recovered geometry`,
    );
  }
}

function assertLifecycle(lifecycle: CrazyGeneratedSpecialFruitLifecycle): void {
  if (lifecycle === null || typeof lifecycle !== 'object') {
    throw new TypeError('lifecycle must be an object');
  }
  if (
    typeof lifecycle.callAfterStep !== 'function'
    || typeof lifecycle.onCut !== 'function'
    || typeof lifecycle.onDisposed !== 'function'
    || typeof lifecycle.onMiss !== 'function'
  ) {
    throw new TypeError(
      'Crazy generated special-fruit lifecycle callbacks must be functions',
    );
  }
}

function assertDisposalReason(
  reason: CrazyGeneratedSpecialFruitDisposalReason,
): void {
  if (
    reason === 'cut'
    || reason === 'registry-dispose-all'
    || reason === 'spawn-failed'
  ) {
    return;
  }
  if (
    reason === null
    || typeof reason !== 'object'
    || reason.type !== 'bounds'
    || (
      reason.boundary !== 'below'
      && reason.boundary !== 'above'
      && reason.boundary !== 'left'
      && reason.boundary !== 'right'
    )
  ) {
    throw new RangeError('Unsupported Crazy generated special-fruit disposal reason');
  }
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
