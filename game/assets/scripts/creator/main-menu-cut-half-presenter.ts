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
import { FRUIT_COLLISION_FILTER } from '../domain/classic-fixture-rules';
import {
  getMainMenuFruitButtonDefinition,
  type MainMenuFruitButtonPurpose,
} from '../domain/main-menu-resource-contract';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import type { LoadedGameRasterResource } from './game-resource-loader';

export type MainMenuCutHalfPart = 'bottom' | 'top';
export type MainMenuCutHalfDisposalReason =
  | 'fade-complete'
  | 'presenter-dispose'
  | Readonly<{ readonly boundary: DisposalBoundary; readonly type: 'bounds' }>;

export interface MainMenuCutHalfResources {
  readonly bottom: LoadedGameRasterResource;
  readonly top: LoadedGameRasterResource;
}

export interface MainMenuCutHalfPresenterInput {
  readonly assetTree: ClassicAssetTree;
  readonly motion: ClassicCutHalfMotionPair;
  readonly purpose: MainMenuFruitButtonPurpose;
  readonly resources: MainMenuCutHalfResources;
}

export interface MainMenuCutHalfPresenterLifecycle {
  readonly callAfterStep: (mutation: () => void) => void;
  readonly onDisposed?: (
    part: MainMenuCutHalfPart,
    reason: MainMenuCutHalfDisposalReason,
  ) => void;
}

export interface PresentedMainMenuCutHalf {
  readonly body: RigidBody2D;
  readonly collider: BoxCollider2D;
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly part: MainMenuCutHalfPart;
  readonly sprite: Sprite;
}

type MainMenuCutHalfTuple = readonly [PresentedCutHalf, PresentedCutHalf];

const MAX_OPACITY = 255;
const RADIANS_TO_DEGREES = 180 / Math.PI;
const RECOVERED_FRICTION = Math.fround(0.2);

/** Actual Creator CutFruit bodies for the three recovered Main Menu FruitButtons. */
export class MainMenuCutHalfPresenter {
  readonly halves: MainMenuCutHalfTuple;

  private attachedValue = false;
  private disposedValue = false;
  private elapsedActionSeconds = 0;
  private readonly lifecycle: MainMenuCutHalfPresenterLifecycle;

  private constructor(
    input: MainMenuCutHalfPresenterInput,
    lifecycle: MainMenuCutHalfPresenterLifecycle,
  ) {
    this.lifecycle = lifecycle;
    this.halves = Object.freeze([
      new PresentedCutHalf('bottom', input.resources.bottom, input.motion.bottom),
      new PresentedCutHalf('top', input.resources.top, input.motion.top),
    ]);
  }

  static create(
    input: MainMenuCutHalfPresenterInput,
    lifecycle: MainMenuCutHalfPresenterLifecycle,
  ): MainMenuCutHalfPresenter {
    assertInput(input);
    assertLifecycle(lifecycle);
    return new MainMenuCutHalfPresenter(input, lifecycle);
  }

  get attached(): boolean {
    return this.attachedValue;
  }

  get disposed(): boolean {
    return this.disposedValue;
  }

  attach(parent: Node, firstSiblingIndex: number): void {
    if (!isValid(parent, true) || !parent.activeInHierarchy) {
      throw new Error('Main Menu cut-half parent must be valid and active');
    }
    if (!Number.isSafeInteger(firstSiblingIndex) || firstSiblingIndex < 0) {
      throw new RangeError('firstSiblingIndex must be a non-negative safe integer');
    }
    if (
      this.disposedValue
      || this.attachedValue
      || this.halves.some(({ node }) => node.parent !== null)
    ) {
      throw new Error('Main Menu cut-half presenter cannot attach from its current state');
    }

    const attached: PresentedCutHalf[] = [];
    try {
      for (let index = 0; index < this.halves.length; index += 1) {
        const half = this.halves[index];
        half.node.layer = parent.layer;
        half.node.setParent(parent, true);
        attached.push(half);
        half.node.setSiblingIndex(firstSiblingIndex + index);
        half.node.active = true;
        half.applyInitialCentreImpulse();
      }
      this.attachedValue = true;
    } catch (error) {
      for (const half of attached.reverse()) {
        if (isValid(half.node, true)) {
          half.node.destroy();
        }
      }
      throw error;
    }
  }

  updateAction(deltaSeconds: number): void {
    if (!this.attachedValue || this.disposedValue) {
      return;
    }
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    this.elapsedActionSeconds = Math.min(
      CLASSIC_CUT_HALF_FADE_ACTION_SECONDS,
      this.elapsedActionSeconds + deltaSeconds,
    );
    const opacity = MAX_OPACITY * (
      1 - this.elapsedActionSeconds / CLASSIC_CUT_HALF_FADE_ACTION_SECONDS
    );
    for (const half of this.halves) {
      if (!half.disposalQueued) {
        half.opacity.opacity = opacity;
      }
    }
    if (this.elapsedActionSeconds === CLASSIC_CUT_HALF_FADE_ACTION_SECONDS) {
      this.queueAll('fade-complete');
    }
  }

  evaluateBounds(viewport: Readonly<{ readonly height: number; readonly width: number }>): void {
    if (!this.attachedValue || this.disposedValue) {
      return;
    }
    assertPositiveFinite(viewport.width, 'viewport.width');
    assertPositiveFinite(viewport.height, 'viewport.height');
    for (const half of this.halves) {
      if (half.disposalQueued || !isValid(half.node, true)) {
        continue;
      }
      const position = half.node.worldPosition;
      const velocity = half.body.linearVelocity;
      const disposal = createClassicBoundsCommands({
        linearVelocityMetresPerSecond: { x: velocity.x, y: velocity.y },
        positionWorldUnits: { x: position.x, y: position.y },
        viewportHeightWorldUnits: viewport.height,
        viewportWidthWorldUnits: viewport.width,
      }).find((command) => command.type === 'defer-dispose');
      if (disposal !== undefined && disposal.type === 'defer-dispose') {
        this.queueHalf(half, Object.freeze({
          boundary: disposal.boundary,
          type: 'bounds' as const,
        }));
      }
    }
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.attachedValue = false;
    for (const half of this.halves) {
      half.markDisposalQueued();
      if (isValid(half.node, true)) {
        half.node.destroy();
      }
    }
    return true;
  }

  private queueAll(reason: MainMenuCutHalfDisposalReason): void {
    for (const half of this.halves) {
      this.queueHalf(half, reason);
    }
  }

  private queueHalf(
    half: PresentedCutHalf,
    reason: MainMenuCutHalfDisposalReason,
  ): void {
    if (!half.markDisposalQueued()) {
      return;
    }
    try {
      this.lifecycle.callAfterStep(() => {
        if (isValid(half.node, true)) {
          half.node.destroy();
        }
        this.lifecycle.onDisposed?.(half.part, reason);
      });
    } catch (error) {
      half.clearDisposalQueued();
      throw error;
    }
  }
}

class PresentedCutHalf implements PresentedMainMenuCutHalf {
  readonly body: RigidBody2D;
  readonly collider: BoxCollider2D;
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly part: MainMenuCutHalfPart;
  readonly sprite: Sprite;

  private disposalQueuedValue = false;
  private impulseApplied = false;
  private readonly impulse: Readonly<{ readonly x: number; readonly y: number }>;

  constructor(
    part: MainMenuCutHalfPart,
    resource: LoadedGameRasterResource,
    motion: ClassicCutHalfMotionState,
  ) {
    this.part = part;
    this.impulse = motion.impulseNewtonSeconds;
    this.node = new Node(`MainMenuCutHalf-${part}`);
    this.node.active = false;
    const transform = this.node.addComponent(UITransform);
    transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
    transform.setAnchorPoint(0.5, 0.5);
    this.opacity = this.node.addComponent(UIOpacity);
    this.opacity.opacity = MAX_OPACITY;
    this.sprite = this.node.addComponent(Sprite);
    this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.sprite.spriteFrame = resource.spriteFrame;
    this.body = this.node.addComponent(RigidBody2D);
    configureBody(this.body, motion);
    this.collider = this.node.addComponent(BoxCollider2D);
    configureCollider(this.collider, resource);
    this.node.setWorldPosition(
      motion.positionWorldUnits.x,
      motion.positionWorldUnits.y,
      0,
    );
    this.node.setRotationFromEuler(0, 0, motion.angleRadians * RADIANS_TO_DEGREES);
  }

  get disposalQueued(): boolean {
    return this.disposalQueuedValue;
  }

  applyInitialCentreImpulse(): void {
    if (this.impulseApplied) {
      throw new Error(`Main Menu ${this.part} cut-half impulse was already applied`);
    }
    this.body.applyLinearImpulseToCenter(new Vec2(this.impulse.x, this.impulse.y), true);
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

function configureBody(body: RigidBody2D, motion: ClassicCutHalfMotionState): void {
  body.type = ERigidBody2DType.Dynamic;
  body.allowSleep = true;
  body.awakeOnLoad = true;
  body.bullet = false;
  body.fixedRotation = false;
  body.gravityScale = CLASSIC_CUT_HALF_GRAVITY_SCALE;
  body.linearDamping = 0;
  body.angularDamping = 0;
  body.linearVelocity = new Vec2(0, 0);
  body.angularVelocity = motion.angularVelocityRadiansPerSecond;
  body.group = FRUIT_COLLISION_FILTER.categoryBits;
}

function configureCollider(
  collider: BoxCollider2D,
  resource: LoadedGameRasterResource,
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
  collider.group = FRUIT_COLLISION_FILTER.categoryBits;
  collider.tag = 0;
}

function assertInput(input: MainMenuCutHalfPresenterInput): void {
  assertObject(input, 'input');
  const definition = getMainMenuFruitButtonDefinition(input.purpose);
  const expected = definition.rasters[input.assetTree];
  assertLoadedRaster(input.resources.bottom, expected.cutBottom, 'resources.bottom');
  assertLoadedRaster(input.resources.top, expected.cutTop, 'resources.top');
  assertMotion(input.motion);
}

function assertLoadedRaster(
  loaded: LoadedGameRasterResource,
  expected: Readonly<{
    readonly canonicalPath: string;
    readonly dimensions: Readonly<{ readonly height: number; readonly width: number }>;
  }>,
  label: string,
): void {
  assertObject(loaded, label);
  if (
    loaded.canonicalPath !== expected.canonicalPath
    || loaded.dimensions.width !== expected.dimensions.width
    || loaded.dimensions.height !== expected.dimensions.height
    || !isValid(loaded.spriteFrame, true)
  ) {
    throw new Error(`${label} must match the exact loaded Main Menu cut-half resource`);
  }
}

function assertMotion(motion: ClassicCutHalfMotionPair): void {
  assertObject(motion, 'motion');
  for (const [label, value] of [
    ['motion.bottom', motion.bottom],
    ['motion.top', motion.top],
  ] as const) {
    assertObject(value, label);
    assertFinite(value.angleRadians, `${label}.angleRadians`);
    assertFinite(
      value.angularVelocityRadiansPerSecond,
      `${label}.angularVelocityRadiansPerSecond`,
    );
    assertFinite(value.positionWorldUnits.x, `${label}.positionWorldUnits.x`);
    assertFinite(value.positionWorldUnits.y, `${label}.positionWorldUnits.y`);
    assertFinite(value.impulseNewtonSeconds.x, `${label}.impulseNewtonSeconds.x`);
    assertFinite(value.impulseNewtonSeconds.y, `${label}.impulseNewtonSeconds.y`);
  }
}

function assertLifecycle(lifecycle: MainMenuCutHalfPresenterLifecycle): void {
  assertObject(lifecycle, 'lifecycle');
  if (typeof lifecycle.callAfterStep !== 'function') {
    throw new TypeError('Main Menu cut-half lifecycle requires callAfterStep()');
  }
  if (lifecycle.onDisposed !== undefined && typeof lifecycle.onDisposed !== 'function') {
    throw new TypeError('Main Menu cut-half onDisposed must be a function when provided');
  }
}

function assertObject(value: unknown, label: string): asserts value is object {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
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
