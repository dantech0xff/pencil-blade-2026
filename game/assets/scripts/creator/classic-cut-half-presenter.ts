import {
  BoxCollider2D,
  ERigidBody2DType,
  Node,
  RigidBody2D,
  Size,
  Sprite,
  UIOpacity,
  UITransform,
  Vec2,
  isValid,
} from 'cc';

import {
  createClassicBoundsCommands,
  type DisposalBoundary,
} from '../domain/classic-bounds';
import {
  CLASSIC_CUT_HALF_FADE_ACTION_SECONDS,
  CLASSIC_CUT_HALF_GRAVITY_SCALE,
  type ClassicCutHalfMotionPair,
  type ClassicCutHalfMotionState,
} from '../domain/classic-cut-half-motion';
import {
  FRUIT_COLLISION_FILTER,
  type CollisionFilterData,
} from '../domain/classic-fixture-rules';
import {
  getClassicNormalFruitResources,
  type ClassicNormalFruitId,
  type ClassicRasterResource,
} from '../domain/classic-resource-contract';
import type {
  LoadedClassicNormalFruitResources,
  LoadedClassicRasterResource,
} from './classic-resource-loader';

export type ClassicCutHalfPart = 'bottom' | 'top';
export type ClassicCutHalfNativePart = 0 | 1;

export interface ClassicCutHalfPresenterInput {
  readonly fruitId: ClassicNormalFruitId;
  /** Output of `createClassicCutHalfMotion` for this fruit and cut occurrence. */
  readonly motion: ClassicCutHalfMotionPair;
  readonly sourceEntityOccurrenceId: number;
  readonly visuals: LoadedClassicNormalFruitResources;
}

export type ClassicCutHalfDisposalReason =
  | 'fade-complete'
  | 'presenter-dispose-all'
  | Readonly<{ type: 'bounds'; boundary: DisposalBoundary }>;

export interface ClassicCutHalfDisposedEvent {
  readonly part: ClassicCutHalfPart;
  readonly reason: ClassicCutHalfDisposalReason;
  readonly sourceEntityOccurrenceId: number;
}

export interface ClassicCutHalfPresenterLifecycle {
  readonly callAfterStep: (mutation: () => void) => void;
  readonly onDisposed: (event: ClassicCutHalfDisposedEvent) => void;
}

export interface ClassicPresentedCutHalf {
  readonly body: RigidBody2D;
  readonly collider: BoxCollider2D;
  readonly collisionFilter: CollisionFilterData;
  readonly direction: Readonly<{ x: number; y: number }>;
  readonly disposalQueued: boolean;
  readonly impulseNewtonSeconds: Readonly<{ x: number; y: number }>;
  readonly nativePart: ClassicCutHalfNativePart;
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly part: ClassicCutHalfPart;
  readonly sourceEntityOccurrenceId: number;
  readonly sprite: Sprite;
}

type CutHalfTuple = readonly [PresentedCutHalf, PresentedCutHalf];

const CLASSIC_ASSET_TREES = Object.freeze(['480x800', '720x1280'] as const);
const CUT_HALF_PARTS = Object.freeze(['bottom', 'top'] as const);
const MAX_OPACITY = 255;
const RADIANS_TO_DEGREES = 180 / Math.PI;
const RECOVERED_FRICTION = Math.fround(0.2);

/**
 * Standalone Creator presenter for the two ordinary-fruit CutFruit bodies.
 *
 * Creation, attachment, and centre-impulse application preserve native bottom(part 1)-then-
 * top(part 0) order. Action-clock fading and physics-clock bounds evaluation are separate so
 * world-speed scaling cannot change the recovered 0.75-second fade. Physics destruction is
 * always routed through the shared post-step boundary.
 */
export class ClassicCutHalfPresenter {
  readonly fadeActionSeconds = CLASSIC_CUT_HALF_FADE_ACTION_SECONDS;
  readonly halves: CutHalfTuple;
  readonly sourceEntityOccurrenceId: number;

  private readonly lifecycle: ClassicCutHalfPresenterLifecycle;
  private attached = false;
  private elapsedActionSeconds = 0;

  private constructor(
    input: ClassicCutHalfPresenterInput,
    lifecycle: ClassicCutHalfPresenterLifecycle,
  ) {
    this.sourceEntityOccurrenceId = input.sourceEntityOccurrenceId;
    this.lifecycle = lifecycle;

    const bottom = new PresentedCutHalf({
      motion: input.motion.bottom,
      nativePart: 1,
      part: 'bottom',
      resource: input.visuals.cutBottom,
      sourceEntityOccurrenceId: input.sourceEntityOccurrenceId,
    });
    const top = new PresentedCutHalf({
      motion: input.motion.top,
      nativePart: 0,
      part: 'top',
      resource: input.visuals.cutTop,
      sourceEntityOccurrenceId: input.sourceEntityOccurrenceId,
    });
    this.halves = Object.freeze([bottom, top]);
  }

  static create(
    input: ClassicCutHalfPresenterInput,
    lifecycle: ClassicCutHalfPresenterLifecycle,
  ): ClassicCutHalfPresenter {
    assertPresenterInput(input);
    assertLifecycle(lifecycle);
    return new ClassicCutHalfPresenter(input, lifecycle);
  }

  get activeHalfCount(): number {
    return this.halves.reduce(
      (count, half) => count + (half.disposalQueued ? 0 : 1),
      0,
    );
  }

  get isAttached(): boolean {
    return this.attached;
  }

  attach(parent: Node, firstSiblingIndex = 1): void {
    if (!isValid(parent, true)) {
      throw new Error('Classic cut-half parent must be valid');
    }
    if (!parent.activeInHierarchy) {
      throw new Error('Classic cut-half parent must be active in the scene');
    }
    if (!Number.isSafeInteger(firstSiblingIndex) || firstSiblingIndex < 0) {
      throw new RangeError('firstSiblingIndex must be a non-negative safe integer');
    }
    if (this.activeHalfCount !== this.halves.length) {
      throw new Error('Classic cut-half presenter cannot attach after disposal');
    }
    if (this.attached || this.halves.some((half) => half.node.parent !== null)) {
      throw new Error('Classic cut-half presenter is already attached');
    }

    for (let index = 0; index < this.halves.length; index += 1) {
      const half = this.halves[index];
      half.node.layer = parent.layer;
      half.node.setParent(parent, true);
      half.node.setSiblingIndex(firstSiblingIndex + index);
      half.node.active = true;
      // Creator has no backend body while the node is detached, so the recovered impulse must
      // be applied only after activation in the live scene.
      half.applyInitialCentreImpulse();
    }
    this.attached = true;
  }

  /** Advances only the unscaled Creator action clock used by the recovered CCFadeOut. */
  updateAction(unscaledDeltaSeconds: number): void {
    this.assertAttached('update actions');
    assertNonNegativeFinite(unscaledDeltaSeconds, 'unscaledDeltaSeconds');
    if (this.activeHalfCount === 0) {
      return;
    }

    this.elapsedActionSeconds = Math.min(
      this.elapsedActionSeconds + unscaledDeltaSeconds,
      CLASSIC_CUT_HALF_FADE_ACTION_SECONDS,
    );
    const opacity = MAX_OPACITY * (
      1 - this.elapsedActionSeconds / CLASSIC_CUT_HALF_FADE_ACTION_SECONDS
    );
    for (const half of this.halves) {
      if (!half.disposalQueued) {
        half.opacity.opacity = opacity;
      }
    }

    if (this.elapsedActionSeconds >= CLASSIC_CUT_HALF_FADE_ACTION_SECONDS) {
      this.queueAll('fade-complete');
    }
  }

  /** Applies moving-body thresholds without advancing the unscaled fade action. */
  evaluateBounds(viewport: Readonly<{ width: number; height: number }>): void {
    this.assertAttached('evaluate bounds');
    assertViewport(viewport);
    if (this.activeHalfCount === 0) {
      return;
    }

    for (const half of this.halves) {
      if (half.disposalQueued) {
        continue;
      }
      const position = half.node.worldPosition;
      const velocity = half.body.linearVelocity;
      const commands = createClassicBoundsCommands({
        linearVelocityMetresPerSecond: { x: velocity.x, y: velocity.y },
        positionWorldUnits: { x: position.x, y: position.y },
        viewportHeightWorldUnits: viewport.height,
        viewportWidthWorldUnits: viewport.width,
      });
      const disposal = commands.find((command) => command.type === 'defer-dispose');
      if (disposal !== undefined && disposal.type === 'defer-dispose') {
        this.queueHalf(half, Object.freeze({
          type: 'bounds',
          boundary: disposal.boundary,
        }));
      }
    }
  }

  disposeAll(): boolean {
    return this.queueAll('presenter-dispose-all');
  }

  private assertAttached(action: string): void {
    if (!this.attached) {
      throw new Error(`Classic cut-half presenter must be attached before ${action}`);
    }
  }

  private queueAll(reason: ClassicCutHalfDisposalReason): boolean {
    let queued = false;
    for (const half of this.halves) {
      queued = this.queueHalf(half, reason) || queued;
    }
    return queued;
  }

  private queueHalf(
    half: PresentedCutHalf,
    reason: ClassicCutHalfDisposalReason,
  ): boolean {
    if (!half.markDisposalQueued()) {
      return false;
    }
    const event: ClassicCutHalfDisposedEvent = Object.freeze({
      part: half.part,
      reason,
      sourceEntityOccurrenceId: this.sourceEntityOccurrenceId,
    });

    try {
      this.lifecycle.callAfterStep(() => {
        try {
          if (isValid(half.node, true)) {
            half.node.destroy();
          }
        } finally {
          this.lifecycle.onDisposed(event);
        }
      });
    } catch (error) {
      if (isValid(half.node, true)) {
        half.clearDisposalQueued();
      }
      throw error;
    }
    return true;
  }
}

interface PresentedCutHalfInput {
  readonly motion: ClassicCutHalfMotionState;
  readonly nativePart: ClassicCutHalfNativePart;
  readonly part: ClassicCutHalfPart;
  readonly resource: LoadedClassicRasterResource;
  readonly sourceEntityOccurrenceId: number;
}

class PresentedCutHalf implements ClassicPresentedCutHalf {
  readonly body: RigidBody2D;
  readonly collider: BoxCollider2D;
  readonly collisionFilter = FRUIT_COLLISION_FILTER;
  readonly direction: Readonly<{ x: number; y: number }>;
  readonly impulseNewtonSeconds: Readonly<{ x: number; y: number }>;
  readonly nativePart: ClassicCutHalfNativePart;
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly part: ClassicCutHalfPart;
  readonly sourceEntityOccurrenceId: number;
  readonly sprite: Sprite;

  private disposalQueuedValue = false;
  private impulseApplied = false;

  constructor(input: PresentedCutHalfInput) {
    this.part = input.part;
    this.nativePart = input.nativePart;
    this.sourceEntityOccurrenceId = input.sourceEntityOccurrenceId;
    this.direction = frozenPoint(input.motion.direction);
    this.impulseNewtonSeconds = frozenPoint(input.motion.impulseNewtonSeconds);
    this.node = new Node(
      `ClassicCutHalf-${input.sourceEntityOccurrenceId}-${input.part}`,
    );
    this.node.active = false;

    const transform = this.node.addComponent(UITransform);
    transform.setContentSize(
      input.resource.dimensions.width,
      input.resource.dimensions.height,
    );
    transform.setAnchorPoint(0.5, 0.5);

    this.opacity = this.node.addComponent(UIOpacity);
    this.opacity.opacity = MAX_OPACITY;

    this.sprite = this.node.addComponent(Sprite);
    this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.sprite.spriteFrame = input.resource.spriteFrame;

    this.body = this.node.addComponent(RigidBody2D);
    configureBody(this.body, input.motion);
    this.collider = this.node.addComponent(BoxCollider2D);
    configureCollider(this.collider, input.resource);

    this.node.setPosition(
      input.motion.positionWorldUnits.x,
      input.motion.positionWorldUnits.y,
      0,
    );
    this.node.setRotationFromEuler(
      0,
      0,
      input.motion.angleRadians * RADIANS_TO_DEGREES,
    );
  }

  get disposalQueued(): boolean {
    return this.disposalQueuedValue;
  }

  applyInitialCentreImpulse(): void {
    if (this.impulseApplied) {
      throw new Error(`Classic ${this.part} cut-half impulse was already applied`);
    }
    this.body.applyLinearImpulseToCenter(
      new Vec2(this.impulseNewtonSeconds.x, this.impulseNewtonSeconds.y),
      true,
    );
    this.impulseApplied = true;
  }

  markDisposalQueued(): boolean {
    if (this.disposalQueuedValue) {
      return false;
    }
    this.disposalQueuedValue = true;
    return true;
  }

  clearDisposalQueued(): void {
    this.disposalQueuedValue = false;
  }
}

function configureBody(
  body: RigidBody2D,
  motion: ClassicCutHalfMotionState,
): void {
  body.type = ERigidBody2DType.Dynamic;
  body.allowSleep = true;
  body.awakeOnLoad = true;
  body.bullet = false;
  body.fixedRotation = false;
  body.gravityScale = CLASSIC_CUT_HALF_GRAVITY_SCALE;
  body.linearDamping = 0;
  body.angularDamping = 0;
  // Native creates each body at rest, then applies the recovered centre impulse after attach.
  body.linearVelocity = new Vec2(0, 0);
  body.angularVelocity = motion.angularVelocityRadiansPerSecond;
  body.group = FRUIT_COLLISION_FILTER.categoryBits;
}

function configureCollider(
  collider: BoxCollider2D,
  resource: LoadedClassicRasterResource,
): void {
  collider.size = new Size(
    2 * resource.dimensions.width,
    2 * resource.dimensions.height,
  );
  collider.offset = new Vec2(0, 0);
  collider.density = 1;
  collider.friction = RECOVERED_FRICTION;
  collider.restitution = 0;
  collider.sensor = false;
  // Creator obtains maskBits from the collision matrix for this category. The shared Classic
  // physics adapter installs FRUIT_COLLISION_FILTER.maskBits for the same categoryBits value.
  collider.group = FRUIT_COLLISION_FILTER.categoryBits;
  collider.tag = 0;
}

function assertPresenterInput(input: ClassicCutHalfPresenterInput): void {
  assertObject(input, 'input');
  if (!Number.isSafeInteger(input.sourceEntityOccurrenceId) || input.sourceEntityOccurrenceId <= 0) {
    throw new RangeError('sourceEntityOccurrenceId must be a positive safe integer');
  }
  if (!Number.isSafeInteger(input.fruitId) || input.fruitId < 0 || input.fruitId > 8) {
    throw new RangeError('fruitId must identify an ordinary Classic fruit from 0 through 8');
  }
  assertMotionPair(input.motion);
  assertVisualPair(input.fruitId, input.visuals);
}

function assertMotionPair(motion: ClassicCutHalfMotionPair): void {
  assertObject(motion, 'motion');
  for (const part of CUT_HALF_PARTS) {
    assertMotionState(motion[part], `motion.${part}`);
  }
  if (motion.bottom.angleRadians !== motion.top.angleRadians) {
    throw new RangeError('motion halves must share the recovered split angle');
  }
  if (
    motion.bottom.angularVelocityRadiansPerSecond
    !== motion.top.angularVelocityRadiansPerSecond
  ) {
    throw new RangeError('motion halves must share the recovered angular velocity');
  }
}

function assertMotionState(value: ClassicCutHalfMotionState, label: string): void {
  assertObject(value, label);
  assertFiniteVector(value.direction, `${label}.direction`);
  if (!(value.direction.x * value.direction.x + value.direction.y * value.direction.y > 0)) {
    throw new RangeError(`${label}.direction must be non-zero`);
  }
  assertFiniteVector(value.impulseNewtonSeconds, `${label}.impulseNewtonSeconds`);
  assertFiniteVector(value.positionWorldUnits, `${label}.positionWorldUnits`);
  assertFinite(value.angleRadians, `${label}.angleRadians`);
  assertFinite(
    value.angularVelocityRadiansPerSecond,
    `${label}.angularVelocityRadiansPerSecond`,
  );
}

function assertVisualPair(
  fruitId: ClassicNormalFruitId,
  visuals: LoadedClassicNormalFruitResources,
): void {
  assertObject(visuals, 'visuals');
  const matchingPair = CLASSIC_ASSET_TREES
    .map((assetTree) => getClassicNormalFruitResources(fruitId, assetTree))
    .find((resources) => (
      visuals.cutBottom?.canonicalPath === resources.cutBottom.canonicalPath
      && visuals.cutTop?.canonicalPath === resources.cutTop.canonicalPath
    ));
  if (matchingPair === undefined) {
    throw new RangeError('visuals must contain the matching cutBottom/cutTop pair for fruitId');
  }
  assertLoadedRaster(visuals.cutBottom, matchingPair.cutBottom, 'visuals.cutBottom');
  assertLoadedRaster(visuals.cutTop, matchingPair.cutTop, 'visuals.cutTop');
}

function assertLoadedRaster(
  loaded: LoadedClassicRasterResource,
  expected: ClassicRasterResource,
  label: string,
): void {
  assertObject(loaded, label);
  assertObject(loaded.dimensions, `${label}.dimensions`);
  if (
    loaded.canonicalPath !== expected.canonicalPath
    || loaded.dimensions.width !== expected.dimensions.width
    || loaded.dimensions.height !== expected.dimensions.height
  ) {
    throw new RangeError(`${label} must match the exact recovered raster contract`);
  }
  if (!isValid(loaded.spriteFrame, true)) {
    throw new Error(`${label}.spriteFrame must be a valid loaded Creator SpriteFrame`);
  }
  const original = loaded.spriteFrame.originalSize;
  const rect = loaded.spriteFrame.rect;
  if (
    original.width !== expected.dimensions.width
    || original.height !== expected.dimensions.height
    || rect.width !== expected.dimensions.width
    || rect.height !== expected.dimensions.height
  ) {
    throw new RangeError(`${label}.spriteFrame must preserve the exact untrimmed raster geometry`);
  }
}

function assertLifecycle(lifecycle: ClassicCutHalfPresenterLifecycle): void {
  assertObject(lifecycle, 'lifecycle');
  if (
    typeof lifecycle.callAfterStep !== 'function'
    || typeof lifecycle.onDisposed !== 'function'
  ) {
    throw new TypeError('Classic cut-half lifecycle callbacks must be functions');
  }
}

function assertViewport(viewport: Readonly<{ width: number; height: number }>): void {
  assertObject(viewport, 'viewport');
  assertPositiveFinite(viewport.width, 'viewport.width');
  assertPositiveFinite(viewport.height, 'viewport.height');
}

function assertFiniteVector(
  value: Readonly<{ x: number; y: number }>,
  label: string,
): void {
  assertObject(value, label);
  assertFinite(value.x, `${label}.x`);
  assertFinite(value.y, `${label}.y`);
}

function assertPositiveFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}

function assertObject(value: unknown, label: string): asserts value is object {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
}

function frozenPoint(
  value: Readonly<{ x: number; y: number }>,
): Readonly<{ x: number; y: number }> {
  return Object.freeze({ x: value.x, y: value.y });
}
