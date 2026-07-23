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

import {
  createClassicBoundsCommands,
  type ClassicBoundsCommand,
  type DisposalBoundary,
} from '../domain/classic-bounds';
import type { CutSegment, CuttableSnapshot } from '../domain/classic-cut-query';
import {
  BOMB_COLLISION_FILTER,
  LEGACY_WORLD_UNITS_PER_METRE,
  createBombFixtureConfiguration,
  type BombFixtureConfiguration,
  type CollisionFilterData,
} from '../domain/classic-fixture-rules';
import {
  getClassicBombResource,
  type ClassicBombId,
  type ClassicRasterResource,
} from '../domain/classic-resource-contract';
import type { ClassicCreateCommand } from '../domain/classic-spawn-planner';
import { positionMetresToCreatorWorldUnits } from '../domain/spawn-kinematics';
import type { LoadedClassicRasterResource } from './classic-resource-loader';

export type ClassicStandardBombCreateCommand = Extract<
  ClassicCreateCommand,
  Readonly<{ type: 'create-bomb'; tossType: 1; bombId: 0 }>
>;

/** Target adapter tag: non-negative keeps the bomb visible to the recovered blade filter. */
export const TARGET_CLASSIC_BOMB_COLLIDER_TAG = 0;
export const CLASSIC_GENERATED_BOMB_Z_ORDER = 1;

export type ClassicGeneratedBombDisposalReason =
  | 'after-bomb-hit'
  | 'cut-handoff-failed'
  | 'registry-dispose-all'
  | 'spawn-failed'
  | Readonly<{ type: 'bounds'; boundary: DisposalBoundary }>;

export interface ClassicGeneratedBombCutEvent {
  readonly bombId: ClassicBombId;
  readonly entityOccurrenceId: number;
  readonly segment: CutSegment;
  readonly targetId: string;
  readonly worldPosition: Readonly<{ x: number; y: number }>;
}

export interface ClassicGeneratedBombDisposedEvent {
  readonly collider: CircleCollider2D;
  readonly entityOccurrenceId: number;
  readonly reason: ClassicGeneratedBombDisposalReason;
  readonly targetId: string;
}

export interface ClassicGeneratedBombLifecycle {
  readonly callAfterStep: (mutation: () => void) => void;
  /**
   * Stops both retained effect slots for every valid cut report. The historical callback name
   * is retained for adapter compatibility, but this runs before the one-shot cut guard and
   * therefore also runs when no second freeze will occur.
   */
  readonly onBeforeFreeze: (event: ClassicGeneratedBombCutEvent) => void;
  /** Explosion ownership starts once, after the accepted report freezes all body motion. */
  readonly onCut: (event: ClassicGeneratedBombCutEvent) => void;
  readonly onDisposed: (event: ClassicGeneratedBombDisposedEvent) => void;
}

const CLASSIC_ASSET_TREES = Object.freeze(['480x800', '720x1280'] as const);

/**
 * Shared standard Bomb body, intact sprite, and first-cut lifecycle boundary.
 *
 * `onCut` attaches the exact explosion before the mode's BombHit/audio sequence. Once that
 * presenter has detached and synchronously completed AfterBombHit, `finishAfterBombHit()`
 * requests body/node disposal through the shared post-step boundary.
 */
export class ClassicGeneratedBomb {
  readonly body: RigidBody2D;
  readonly bombId: ClassicBombId;
  readonly collider: CircleCollider2D;
  readonly colliderTag = TARGET_CLASSIC_BOMB_COLLIDER_TAG;
  readonly collisionFilter: CollisionFilterData = BOMB_COLLISION_FILTER;
  readonly entityOccurrenceId: number;
  readonly node: Node;
  readonly nodeName: string;
  readonly sprite: Sprite;
  readonly targetId: string;

  private readonly lifecycle: ClassicGeneratedBombLifecycle;
  private attachedValue = false;
  private cutValue = false;
  private disposalQueuedValue = false;

  private constructor(
    command: ClassicStandardBombCreateCommand,
    fixture: BombFixtureConfiguration,
    visual: LoadedClassicRasterResource,
    lifecycle: ClassicGeneratedBombLifecycle,
  ) {
    this.bombId = command.bombId;
    this.entityOccurrenceId = command.entityOccurrenceId;
    this.targetId = `classic-bomb:${command.entityOccurrenceId}`;
    this.nodeName = `ClassicGeneratedBomb-${command.entityOccurrenceId}`;
    this.lifecycle = lifecycle;

    this.node = new Node(this.nodeName);
    this.node.active = false;
    const transform = this.node.addComponent(UITransform);
    transform.setContentSize(visual.dimensions.width, visual.dimensions.height);
    transform.setAnchorPoint(0.5, 0.4);
    this.sprite = this.node.addComponent(Sprite);
    this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.sprite.spriteFrame = visual.spriteFrame;

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
    command: ClassicStandardBombCreateCommand,
    visual: LoadedClassicRasterResource,
    lifecycle: ClassicGeneratedBombLifecycle,
  ): ClassicGeneratedBomb {
    assertCreateCommand(command);
    const expectedVisual = assertLoadedBombVisual(command.bombId, visual);
    assertLifecycle(lifecycle);
    const fixture = createBombFixtureConfiguration({
      bombId: command.bombId,
      spriteWidthWorldUnits: expectedVisual.dimensions.width,
    });
    return new ClassicGeneratedBomb(command, fixture, visual, lifecycle);
  }

  get attached(): boolean {
    return this.attachedValue;
  }

  get cutDisabled(): boolean {
    return this.cutValue || this.disposalQueuedValue;
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
      throw new Error('Classic bomb parent must be valid');
    }
    if (!parent.activeInHierarchy) {
      throw new Error('Classic bomb parent must be active in the scene');
    }
    if (this.disposalQueuedValue) {
      throw new Error('Classic bomb cannot attach after disposal is queued');
    }
    if (this.attachedValue || this.node.parent !== null) {
      throw new Error('Classic bomb is already attached');
    }
    if (zOrder !== CLASSIC_GENERATED_BOMB_Z_ORDER) {
      throw new RangeError('Classic generated bomb only supports recovered z-order 1');
    }

    this.node.layer = parent.layer;
    this.node.setParent(parent, true);
    this.node.setSiblingIndex(CLASSIC_GENERATED_BOMB_Z_ORDER);
    this.attachedValue = true;
    this.node.active = true;
  }

  snapshot(): CuttableSnapshot {
    return Object.freeze({
      bodyWorldPosition: this.worldPositionSnapshot(),
      cutDisabled: this.cutDisabled,
      id: this.targetId,
      isFruit: false,
      nodeTag: this.colliderTag,
    });
  }

  /**
   * Every valid report repeats the recovered pre-guard effect stops. The first accepted report
   * alone freezes the body and emits the synchronous explosion handoff.
   */
  cut(segment: CutSegment): boolean {
    const copiedSegment = copySegment(segment);
    const event: ClassicGeneratedBombCutEvent = Object.freeze({
      bombId: this.bombId,
      entityOccurrenceId: this.entityOccurrenceId,
      segment: copiedSegment,
      targetId: this.targetId,
      worldPosition: this.worldPositionSnapshot(),
    });

    // Native repeats both retained-slot stops before it reads the one-shot cut flag.
    let preGuardFailure: Readonly<{ readonly error: unknown }> | null = null;
    try {
      this.lifecycle.onBeforeFreeze(event);
    } catch (error) {
      preGuardFailure = Object.freeze({ error });
    }
    if (this.cutDisabled) {
      if (preGuardFailure !== null) {
        throw preGuardFailure.error;
      }
      return false;
    }

    this.cutValue = true;
    if (preGuardFailure !== null) {
      this.freezeMotion();
      this.queueDispose('cut-handoff-failed');
      throw preGuardFailure.error;
    }

    try {
      this.freezeMotion();
      this.lifecycle.onCut(event);
    } catch (error) {
      // The guard must stay set, but a failed synchronous explosion/session handoff cannot
      // leave a stationary bomb alive forever. Defer cleanup through the same physics seam.
      this.freezeMotion();
      this.queueDispose('cut-handoff-failed');
      throw error;
    }
    return true;
  }

  /** Called only after the exact explosion has detached and completed `AfterBombHit`. */
  finishAfterBombHit(): boolean {
    if (!this.cutValue) {
      throw new Error('Classic bomb cannot finish before its first cut');
    }
    return this.queueDispose('after-bomb-hit');
  }

  /**
   * Evaluates moving-body bounds without routing Bomb through Fruit's miss lifecycle.
   * Only the recovered deferred-disposal instruction is returned here. Whether native Bomb
   * had a separate lower-bound side effect remains unresolved for the future integration.
   */
  evaluateBounds(
    viewport: Readonly<{ width: number; height: number }>,
  ): readonly ClassicBoundsCommand[] {
    assertViewport(viewport);
    if (this.disposalQueuedValue) {
      return Object.freeze([]);
    }

    const velocity = this.body.linearVelocity;
    const commands = createClassicBoundsCommands({
      linearVelocityMetresPerSecond: { x: velocity.x, y: velocity.y },
      positionWorldUnits: this.worldPositionSnapshot(),
      viewportHeightWorldUnits: viewport.height,
      viewportWidthWorldUnits: viewport.width,
    });
    const disposal = commands.find(
      (command): command is Extract<ClassicBoundsCommand, Readonly<{ type: 'defer-dispose' }>> => (
        command.type === 'defer-dispose'
      ),
    );
    if (disposal === undefined) {
      return Object.freeze([]);
    }

    this.queueDispose(Object.freeze({
      type: 'bounds',
      boundary: disposal.boundary,
    }));
    return Object.freeze([disposal]);
  }

  queueDispose(reason: ClassicGeneratedBombDisposalReason): boolean {
    assertDisposalReason(reason);
    if (this.disposalQueuedValue) {
      return false;
    }
    this.disposalQueuedValue = true;
    const event: ClassicGeneratedBombDisposedEvent = Object.freeze({
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
      // A synchronous after-step port can execute the mutation and then surface an observer
      // failure. In that case the node may already be destroyed and must never be re-queued.
      if (!mutationStarted) {
        this.disposalQueuedValue = false;
      }
      throw error;
    }
    return true;
  }

  private assertMutableBeforeAttachment(action: string): void {
    if (this.disposalQueuedValue) {
      throw new Error(`Classic bomb cannot ${action} after disposal is queued`);
    }
    if (this.attachedValue) {
      throw new Error(`Classic bomb must ${action} before attachment`);
    }
  }

  private freezeMotion(): void {
    this.body.linearVelocity = new Vec2(0, 0);
    this.body.angularVelocity = 0;
    this.body.gravityScale = 0;
  }

  private worldPositionSnapshot(): Readonly<{ x: number; y: number }> {
    const position = this.node.worldPosition;
    return Object.freeze({ x: position.x, y: position.y });
  }
}

function configureBody(body: RigidBody2D, fixture: BombFixtureConfiguration): void {
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
  fixture: BombFixtureConfiguration,
): CircleCollider2D {
  const definition = fixture.fixture;
  if (definition.shape.type !== 'circle') {
    throw new Error('Recovered Classic bomb fixture must be circular');
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
  collider.tag = TARGET_CLASSIC_BOMB_COLLIDER_TAG;
  return collider;
}

function assertCreateCommand(command: ClassicStandardBombCreateCommand): void {
  if (command === null || typeof command !== 'object') {
    throw new TypeError('command must be an object');
  }
  if (command.type !== 'create-bomb' || command.tossType !== 1 || command.bombId !== 0) {
    throw new RangeError('Classic generated bomb only supports standard create-bomb ID 0');
  }
  if (!Number.isSafeInteger(command.entityOccurrenceId) || command.entityOccurrenceId <= 0) {
    throw new RangeError('entityOccurrenceId must be a positive safe integer');
  }
}

function assertLoadedBombVisual(
  bombId: ClassicBombId,
  visual: LoadedClassicRasterResource,
): ClassicRasterResource {
  if (visual === null || typeof visual !== 'object') {
    throw new TypeError('visual must be an object');
  }
  const expected = CLASSIC_ASSET_TREES
    .map((assetTree) => getClassicBombResource(bombId, assetTree))
    .find((resource) => resource.canonicalPath === visual.canonicalPath);
  if (expected === undefined) {
    throw new RangeError('visual must be the exact Bomb/bomb_X.png raster from one asset tree');
  }
  if (
    visual.dimensions?.width !== expected.dimensions.width
    || visual.dimensions.height !== expected.dimensions.height
  ) {
    throw new RangeError('visual dimensions must match the exact recovered bomb raster');
  }
  if (!isValid(visual.spriteFrame, true)) {
    throw new Error('visual.spriteFrame must be a valid loaded Creator SpriteFrame');
  }
  const original = visual.spriteFrame.originalSize;
  const rect = visual.spriteFrame.rect;
  if (
    original.width !== expected.dimensions.width
    || original.height !== expected.dimensions.height
    || rect.width !== expected.dimensions.width
    || rect.height !== expected.dimensions.height
  ) {
    throw new RangeError('visual.spriteFrame must preserve the exact untrimmed bomb geometry');
  }
  return expected;
}

function assertLifecycle(lifecycle: ClassicGeneratedBombLifecycle): void {
  if (lifecycle === null || typeof lifecycle !== 'object') {
    throw new TypeError('lifecycle must be an object');
  }
  if (
    typeof lifecycle.callAfterStep !== 'function'
    || typeof lifecycle.onBeforeFreeze !== 'function'
    || typeof lifecycle.onCut !== 'function'
    || typeof lifecycle.onDisposed !== 'function'
  ) {
    throw new TypeError('Classic generated bomb lifecycle callbacks must be functions');
  }
}

function assertDisposalReason(reason: ClassicGeneratedBombDisposalReason): void {
  if (
    reason === 'after-bomb-hit'
    || reason === 'cut-handoff-failed'
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
    throw new RangeError('Unsupported Classic generated bomb disposal reason');
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
