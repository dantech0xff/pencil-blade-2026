import {
  Node,
  Rect,
  Size,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec2,
  isValid,
} from 'cc';

import {
  STANDARD_BOMB_SMOKE_ATLAS_HEIGHT,
  STANDARD_BOMB_SMOKE_ATLAS_WIDTH,
  STANDARD_BOMB_SMOKE_FRAME_COUNT,
  STANDARD_BOMB_SMOKE_FRAME_SIZE,
  StandardBombSmokeAnimationState,
  StandardBombSmokeEmitterState,
  frameRectForIndex,
  type StandardBombSmokeRandom,
} from '../domain/standard-bomb-fuse-smoke-state';
import type { LoadedClassicRasterResource } from './classic-resource-loader';

export const STANDARD_BOMB_FUSE_SMOKE_Z_ORDER = 1 as const;

const RADIANS_PER_DEGREE = Math.PI / 180;
const SOURCE_PATH_PATTERN = /^(480x800|720x1280)\/Bomb\/bombsmoke\.png$/;

export interface StandardBombFuseSmokeBombPort {
  readonly node: Node;
}

export interface StandardBombFuseSmokePresenterInput {
  readonly bomb: StandardBombFuseSmokeBombPort;
  readonly random: StandardBombSmokeRandom;
  readonly resource: LoadedClassicRasterResource;
}

export interface StandardBombFuseSmokePresenterSnapshot {
  readonly activeSmokeCount: number;
  readonly disposed: boolean;
  readonly drained: boolean;
  readonly stopped: boolean;
}

interface ActiveSmoke {
  readonly animation: StandardBombSmokeAnimationState;
  readonly node: Node;
  readonly sprite: Sprite;
}

interface BombPresentationSnapshot {
  readonly angleRadians: number;
  readonly parent: Node;
  readonly spriteHeightWorldUnits: number;
  readonly worldPosition: Readonly<{ x: number; y: number; z: number }>;
}

export class StandardBombFuseSmokeCleanupError extends Error {
  readonly causes: readonly unknown[];

  constructor(message: string, causes: readonly unknown[]) {
    super(message);
    this.name = 'StandardBombFuseSmokeCleanupError';
    this.causes = Object.freeze([...causes]);
  }
}

/**
 * Exact intact-fuse smoke adapter for one standard Bomb.
 *
 * Every scheduled update first advances smoke that already exists, then performs the Bomb's
 * single shared-RNG gate. Emitted nodes live beside the Bomb under its world root so they stay
 * at the recovered emission coordinate instead of following the moving Bomb.
 */
export class StandardBombFuseSmokePresenter {
  private readonly activeSmoke = new Set<ActiveSmoke>();
  private disposedValue = false;
  private readonly emitter: StandardBombSmokeEmitterState;
  private readonly frames: readonly SpriteFrame[];
  private readonly input: StandardBombFuseSmokePresenterInput;
  private readonly pendingCleanupNodes = new Set<Node>();
  private smokeSequence = 0;

  private constructor(
    input: StandardBombFuseSmokePresenterInput,
    emitter: StandardBombSmokeEmitterState,
    frames: readonly SpriteFrame[],
  ) {
    this.input = input;
    this.emitter = emitter;
    this.frames = frames;
  }

  static create(
    input: StandardBombFuseSmokePresenterInput,
  ): StandardBombFuseSmokePresenter {
    assertPresenterInput(input);
    const emitter = new StandardBombSmokeEmitterState(input.random);
    const frames = createOwnedFrames(input.resource.spriteFrame);
    return new StandardBombFuseSmokePresenter(input, emitter, frames);
  }

  snapshot(): StandardBombFuseSmokePresenterSnapshot {
    const stopped = this.emitter.snapshot().stopped;
    return Object.freeze({
      activeSmokeCount: this.activeSmoke.size,
      disposed: this.disposedValue,
      drained: (
        stopped
        && this.activeSmoke.size === 0
        && this.pendingCleanupNodes.size === 0
      ),
      stopped,
    });
  }

  /** Stops only future intact-fuse gates; already-emitted smoke keeps its one-second action. */
  stopEmitting(): boolean {
    return this.emitter.stop();
  }

  updateAction(deltaSeconds: number): void {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (this.disposedValue) {
      return;
    }

    const failures = this.retryPendingNodeCleanup();
    this.advanceExistingSmoke(deltaSeconds, failures);
    throwCleanupFailures('Standard Bomb fuse-smoke action update', failures);

    // Do not touch the Bomb or the shared RNG once the cut/stop boundary is set.
    if (this.emitter.snapshot().stopped) {
      return;
    }

    const bomb = requireBombPresentation(this.input.bomb);
    const emission = this.emitter.updateScheduled({
      bombAngleRadians: bomb.angleRadians,
      bombWorldPosition: {
        x: bomb.worldPosition.x,
        y: bomb.worldPosition.y,
      },
      spriteHeightWorldUnits: bomb.spriteHeightWorldUnits,
    });
    if (emission === null) {
      return;
    }

    this.emitSmoke(
      bomb.parent,
      emission.position.x,
      emission.position.y,
      bomb.worldPosition.z,
      emission.frameIndex,
    );
  }

  /**
   * Explicit teardown destroys every presenter-owned node and generated SpriteFrame.
   * The loaded atlas SpriteFrame and its shared texture are borrowed and remain untouched.
   */
  dispose(): boolean {
    const firstDisposal = !this.disposedValue;
    this.disposedValue = true;
    this.emitter.stop();

    const failures = this.retryPendingNodeCleanup();
    for (const smoke of [...this.activeSmoke]) {
      this.activeSmoke.delete(smoke);
      this.destroyOrRetainNode(smoke.node, failures);
    }
    failures.push(...this.retryPendingNodeCleanup());

    if (
      this.activeSmoke.size === 0
      && this.pendingCleanupNodes.size === 0
    ) {
      destroyOwnedFrames(this.frames, failures);
    }
    throwCleanupFailures('Standard Bomb fuse-smoke disposal', failures);
    return firstDisposal;
  }

  private advanceExistingSmoke(
    deltaSeconds: number,
    failures: unknown[],
  ): void {
    for (const smoke of [...this.activeSmoke]) {
      const update = smoke.animation.updateAction(deltaSeconds);
      if (update.finishedNow || update.snapshot.finished) {
        this.activeSmoke.delete(smoke);
        this.destroyOrRetainNode(smoke.node, failures);
        continue;
      }

      const frameIndex = update.snapshot.frameIndex;
      if (frameIndex === null) {
        failures.push(new Error('Active standard Bomb smoke lost its animation frame'));
        continue;
      }
      const frame = this.frames[frameIndex];
      if (frame === undefined || !isValid(frame, true)) {
        failures.push(new Error(`Standard Bomb smoke frame ${frameIndex} is unavailable`));
        continue;
      }
      try {
        smoke.sprite.spriteFrame = frame;
      } catch (error) {
        failures.push(error);
      }
    }
  }

  private emitSmoke(
    parent: Node,
    worldX: number,
    worldY: number,
    worldZ: number,
    frameIndex: number,
  ): void {
    let node: Node | null = null;
    try {
      const initialFrame = this.frames[frameIndex];
      if (initialFrame === undefined || !isValid(initialFrame, true)) {
        throw new Error(`Standard Bomb smoke frame ${frameIndex} is unavailable`);
      }

      this.smokeSequence += 1;
      node = new Node(`StandardBombFuseSmoke-${this.smokeSequence}`);
      node.active = false;
      node.layer = parent.layer;
      node.setWorldPosition(worldX, worldY, worldZ);

      const transform = node.addComponent(UITransform);
      transform.setContentSize(
        STANDARD_BOMB_SMOKE_FRAME_SIZE,
        STANDARD_BOMB_SMOKE_FRAME_SIZE,
      );
      transform.setAnchorPoint(0.5, 0.5);

      const sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.spriteFrame = initialFrame;

      node.setParent(parent, true);
      node.setSiblingIndex(STANDARD_BOMB_FUSE_SMOKE_Z_ORDER);
      node.active = true;
      this.activeSmoke.add(Object.freeze({
        animation: new StandardBombSmokeAnimationState(),
        node,
        sprite,
      }));
    } catch (error) {
      const cleanupFailures: unknown[] = [];
      if (node !== null) {
        this.destroyOrRetainNode(node, cleanupFailures);
      }
      if (cleanupFailures.length > 0) {
        throw new StandardBombFuseSmokeCleanupError(
          'Standard Bomb fuse-smoke emission failed and rollback was incomplete',
          [error, ...cleanupFailures],
        );
      }
      throw error;
    }
  }

  private retryPendingNodeCleanup(): unknown[] {
    const failures: unknown[] = [];
    for (const node of [...this.pendingCleanupNodes]) {
      if (!isValid(node, true)) {
        this.pendingCleanupNodes.delete(node);
        continue;
      }
      this.destroyOrRetainNode(node, failures);
    }
    return failures;
  }

  private destroyOrRetainNode(node: Node, failures: unknown[]): void {
    if (!isValid(node, true)) {
      this.pendingCleanupNodes.delete(node);
      return;
    }

    try {
      node.active = false;
    } catch (error) {
      failures.push(error);
    }
    try {
      node.destroy();
    } catch (error) {
      failures.push(error);
    }

    if (isValid(node, true)) {
      this.pendingCleanupNodes.add(node);
      failures.push(new Error(`${node.name} remained valid after destroy()`));
    } else {
      this.pendingCleanupNodes.delete(node);
    }
  }
}

function assertPresenterInput(input: StandardBombFuseSmokePresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('input must be an object');
  }
  assertBombPort(input.bomb);
  assertSmokeResource(input.resource);
  if (
    input.random === null
    || typeof input.random !== 'object'
    || typeof input.random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive()');
  }
}

function assertBombPort(bomb: StandardBombFuseSmokeBombPort): void {
  if (
    bomb === null
    || typeof bomb !== 'object'
    || !(bomb.node instanceof Node)
    || !isValid(bomb.node, true)
  ) {
    throw new TypeError('bomb must expose a valid Creator Node');
  }
}

function assertSmokeResource(resource: LoadedClassicRasterResource): void {
  if (resource === null || typeof resource !== 'object') {
    throw new TypeError('resource must be a loaded Classic bomb-smoke raster');
  }
  if (!SOURCE_PATH_PATTERN.test(resource.canonicalPath)) {
    throw new Error('resource must be the recovered Classic Bomb/bombsmoke.png atlas');
  }
  if (
    resource.dimensions.width !== STANDARD_BOMB_SMOKE_ATLAS_WIDTH
    || resource.dimensions.height !== STANDARD_BOMB_SMOKE_ATLAS_HEIGHT
  ) {
    throw new Error('standard Bomb smoke atlas contract must be exactly 1920x256');
  }

  const source = resource.spriteFrame;
  if (!(source instanceof SpriteFrame) || !isValid(source, true)) {
    throw new TypeError('resource.spriteFrame must be a valid loaded SpriteFrame');
  }
  if (
    source.rect.width !== STANDARD_BOMB_SMOKE_ATLAS_WIDTH
    || source.rect.height !== STANDARD_BOMB_SMOKE_ATLAS_HEIGHT
    || source.originalSize.width !== STANDARD_BOMB_SMOKE_ATLAS_WIDTH
    || source.originalSize.height !== STANDARD_BOMB_SMOKE_ATLAS_HEIGHT
  ) {
    throw new Error('loaded standard Bomb smoke SpriteFrame must be exactly 1920x256');
  }
  if (
    !isValid(source.texture, true)
    || source.texture.width !== STANDARD_BOMB_SMOKE_ATLAS_WIDTH
    || source.texture.height !== STANDARD_BOMB_SMOKE_ATLAS_HEIGHT
  ) {
    throw new Error('loaded standard Bomb smoke texture must be valid and exactly 1920x256');
  }
}

function requireBombPresentation(
  bomb: StandardBombFuseSmokeBombPort,
): BombPresentationSnapshot {
  const node = bomb.node;
  if (!isValid(node, true) || !node.activeInHierarchy) {
    throw new Error('Standard Bomb must be valid and active while emitting fuse smoke');
  }
  const parent = node.parent;
  if (
    parent === null
    || !isValid(parent, true)
    || !parent.activeInHierarchy
  ) {
    throw new Error('Standard Bomb must have a valid active world parent while emitting smoke');
  }
  const transform = node.getComponent(UITransform);
  if (transform === null) {
    throw new Error('Standard Bomb is missing its UITransform');
  }

  const worldPosition = node.worldPosition;
  const angleDegrees = node.eulerAngles.z;
  const spriteHeightWorldUnits = transform.contentSize.height;
  assertFinite(worldPosition.x, 'bomb world x');
  assertFinite(worldPosition.y, 'bomb world y');
  assertFinite(worldPosition.z, 'bomb world z');
  assertFinite(angleDegrees, 'bomb angle');
  if (
    !Number.isFinite(spriteHeightWorldUnits)
    || spriteHeightWorldUnits <= 0
  ) {
    throw new RangeError('Standard Bomb sprite height must be finite and positive');
  }

  return Object.freeze({
    angleRadians: angleDegrees * RADIANS_PER_DEGREE,
    parent,
    spriteHeightWorldUnits,
    worldPosition: Object.freeze({
      x: worldPosition.x,
      y: worldPosition.y,
      z: worldPosition.z,
    }),
  });
}

function createOwnedFrames(source: SpriteFrame): readonly SpriteFrame[] {
  const frames: SpriteFrame[] = [];
  try {
    for (let frameIndex = 0; frameIndex < STANDARD_BOMB_SMOKE_FRAME_COUNT; frameIndex += 1) {
      const frameRect = frameRectForIndex(frameIndex);
      const frame = new SpriteFrame(`StandardBombFuseSmokeFrame-${frameIndex}`);
      frames.push(frame);
      frame.reset({
        isRotate: false,
        offset: new Vec2(0, 0),
        originalSize: new Size(
          STANDARD_BOMB_SMOKE_FRAME_SIZE,
          STANDARD_BOMB_SMOKE_FRAME_SIZE,
        ),
        rect: new Rect(
          frameRect.x,
          frameRect.y,
          frameRect.width,
          frameRect.height,
        ),
        texture: source.texture,
      }, true);
    }
  } catch (error) {
    const cleanupFailures: unknown[] = [];
    destroyOwnedFrames(frames, cleanupFailures);
    if (cleanupFailures.length > 0) {
      throw new StandardBombFuseSmokeCleanupError(
        'Standard Bomb smoke frame slicing failed and rollback was incomplete',
        [error, ...cleanupFailures],
      );
    }
    throw error;
  }
  return Object.freeze(frames);
}

function destroyOwnedFrames(
  frames: readonly SpriteFrame[],
  failures: unknown[],
): void {
  for (const frame of frames) {
    if (!isValid(frame, true)) {
      continue;
    }
    try {
      frame.destroy();
    } catch (error) {
      failures.push(error);
    }
    if (isValid(frame, true)) {
      failures.push(new Error(`${frame.name} remained valid after destroy()`));
    }
  }
}

function throwCleanupFailures(message: string, failures: readonly unknown[]): void {
  if (failures.length > 0) {
    throw new StandardBombFuseSmokeCleanupError(message, failures);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}
