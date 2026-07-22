import {
  Node,
  Sprite,
  UITransform,
  isValid,
} from 'cc';

import {
  CLASSIC_CRITICAL_PARTICLE_SCALE_OUT_ACTION_SECONDS,
  type ClassicCriticalParticleLogicalPath,
  type ClassicCriticalParticleSpawnCommand,
} from '../domain/classic-critical-particle-plan';
import {
  getClassicCriticalParticleResource,
  type ClassicCriticalParticleIndex,
  type ClassicRasterResource,
} from '../domain/classic-resource-contract';
import type { LoadedClassicRasterResource } from './classic-resource-loader';

export const CLASSIC_CRITICAL_PARTICLE_Z_ORDER = 1;

export interface ClassicCriticalParticlePresenterInput {
  readonly command: ClassicCriticalParticleSpawnCommand;
  readonly positionWorldUnits: Readonly<{ x: number; y: number }>;
  readonly resource: LoadedClassicRasterResource;
}

export type ClassicCriticalParticleDisposalReason = 'scale-complete' | 'explicit-dispose';

export interface ClassicCriticalParticleDisposedEvent {
  readonly logicalPath: ClassicCriticalParticleLogicalPath;
  readonly reason: ClassicCriticalParticleDisposalReason;
  readonly resourceIndex: ClassicCriticalParticleIndex;
}

export interface ClassicCriticalParticlePresenterLifecycle {
  readonly onDisposed: (event: ClassicCriticalParticleDisposedEvent) => void;
}

export interface ClassicCriticalParticlePresenterState {
  readonly attached: boolean;
  readonly disposed: boolean;
  readonly elapsedActionSeconds: number;
  readonly logicalPath: ClassicCriticalParticleLogicalPath;
  readonly positionWorldUnits: Readonly<{ x: number; y: number }>;
  readonly resourceIndex: ClassicCriticalParticleIndex;
  readonly scale: number;
}

const CLASSIC_ASSET_TREES = Object.freeze(['480x800', '720x1280'] as const);
const INITIAL_SCALE = 1;
const ZERO_SCALE = 0;

/** Presents one recovered critical particle without inventing physics, rotation, or fading. */
export class ClassicCriticalParticlePresenter {
  readonly command: ClassicCriticalParticleSpawnCommand;
  readonly node: Node;
  readonly sprite: Sprite;
  readonly transform: UITransform;

  private readonly lifecycle: ClassicCriticalParticlePresenterLifecycle;
  private readonly positionWorldUnits: Readonly<{ x: number; y: number }>;
  private attachedValue = false;
  private disposedValue = false;
  private elapsedActionSecondsValue = 0;
  private scaleValue = INITIAL_SCALE;

  private constructor(
    input: ClassicCriticalParticlePresenterInput,
    lifecycle: ClassicCriticalParticlePresenterLifecycle,
  ) {
    this.command = Object.freeze({ ...input.command });
    this.lifecycle = lifecycle;
    this.positionWorldUnits = frozenPoint(input.positionWorldUnits);

    this.node = new Node(`ClassicCriticalParticle-${this.command.resourceIndex}`);
    this.node.active = false;
    this.node.setPosition(
      this.positionWorldUnits.x,
      this.positionWorldUnits.y,
      0,
    );
    this.node.setScale(INITIAL_SCALE, INITIAL_SCALE, INITIAL_SCALE);

    this.transform = this.node.addComponent(UITransform);
    this.transform.setContentSize(
      input.resource.dimensions.width,
      input.resource.dimensions.height,
    );
    this.transform.setAnchorPoint(0.5, 0.5);

    this.sprite = this.node.addComponent(Sprite);
    this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.sprite.spriteFrame = input.resource.spriteFrame;
  }

  static create(
    input: ClassicCriticalParticlePresenterInput,
    lifecycle: ClassicCriticalParticlePresenterLifecycle,
  ): ClassicCriticalParticlePresenter {
    assertPresenterInput(input);
    assertLifecycle(lifecycle);
    return new ClassicCriticalParticlePresenter(input, lifecycle);
  }

  get isAttached(): boolean {
    return this.attachedValue;
  }

  get isDisposed(): boolean {
    return this.disposedValue;
  }

  get state(): ClassicCriticalParticlePresenterState {
    return Object.freeze({
      attached: this.attachedValue,
      disposed: this.disposedValue,
      elapsedActionSeconds: this.elapsedActionSecondsValue,
      logicalPath: this.command.logicalPath,
      positionWorldUnits: this.positionWorldUnits,
      resourceIndex: this.command.resourceIndex,
      scale: this.scaleValue,
    });
  }

  attach(parent: Node): void {
    if (!isValid(parent, true)) {
      throw new Error('Classic critical-particle parent must be valid');
    }
    if (!parent.activeInHierarchy) {
      throw new Error('Classic critical-particle parent must be active in the scene');
    }
    if (this.disposedValue || !isValid(this.node, true)) {
      throw new Error('Disposed Classic critical particle cannot be attached');
    }
    if (this.attachedValue || this.node.parent !== null) {
      throw new Error('Classic critical particle is already attached');
    }

    this.node.layer = parent.layer;
    this.node.setParent(parent, true);
    this.node.setSiblingIndex(CLASSIC_CRITICAL_PARTICLE_Z_ORDER);
    this.node.active = true;
    this.attachedValue = true;
  }

  updateAction(unscaledDeltaSeconds: number): void {
    assertNonNegativeFinite(unscaledDeltaSeconds, 'unscaledDeltaSeconds');
    if (this.disposedValue) {
      return;
    }
    if (!this.attachedValue) {
      throw new Error('Classic critical particle must be attached before updating actions');
    }

    this.elapsedActionSecondsValue = Math.min(
      this.elapsedActionSecondsValue + unscaledDeltaSeconds,
      this.command.scaleOutActionSeconds,
    );
    this.scaleValue = Math.max(
      ZERO_SCALE,
      INITIAL_SCALE - this.elapsedActionSecondsValue / this.command.scaleOutActionSeconds,
    );
    this.node.setScale(this.scaleValue, this.scaleValue, INITIAL_SCALE);

    if (this.elapsedActionSecondsValue >= this.command.scaleOutActionSeconds) {
      this.disposeWithReason('scale-complete');
    }
  }

  /** Explicit scene-teardown path. Returns false after the first disposal. */
  dispose(): boolean {
    return this.disposeWithReason('explicit-dispose');
  }

  private disposeWithReason(reason: ClassicCriticalParticleDisposalReason): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.attachedValue = false;
    if (isValid(this.node, true)) {
      this.node.destroy();
    }
    this.lifecycle.onDisposed(Object.freeze({
      logicalPath: this.command.logicalPath,
      reason,
      resourceIndex: this.command.resourceIndex,
    }));
    return true;
  }
}

function assertPresenterInput(input: ClassicCriticalParticlePresenterInput): void {
  assertObject(input, 'input');
  assertCommand(input.command);
  assertPoint(input.positionWorldUnits, 'positionWorldUnits');
  assertResource(input.resource, input.command);
}

function assertCommand(command: ClassicCriticalParticleSpawnCommand): void {
  assertObject(command, 'command');
  if (command.type !== 'spawn-critical-particle') {
    throw new RangeError('command.type must be spawn-critical-particle');
  }
  if (
    !Number.isSafeInteger(command.resourceIndex)
    || command.resourceIndex < 1
    || command.resourceIndex > 4
  ) {
    throw new RangeError('command.resourceIndex must be an integer from 1 through 4');
  }
  const expectedLogicalPath = `Criticles/criticle${command.resourceIndex}.png`;
  if (command.logicalPath !== expectedLogicalPath) {
    throw new RangeError('command.logicalPath must match command.resourceIndex exactly');
  }
  if (
    command.scaleOutActionSeconds
    !== CLASSIC_CRITICAL_PARTICLE_SCALE_OUT_ACTION_SECONDS
  ) {
    throw new RangeError('command must use the recovered critical-particle scale duration');
  }
}

function assertResource(
  resource: LoadedClassicRasterResource,
  command: ClassicCriticalParticleSpawnCommand,
): void {
  assertObject(resource, 'resource');
  assertObject(resource.dimensions, 'resource.dimensions');
  const expected = CLASSIC_ASSET_TREES
    .map((assetTree) => getClassicCriticalParticleResource(command.resourceIndex, assetTree))
    .find((candidate) => candidate.canonicalPath === resource.canonicalPath);
  if (expected === undefined) {
    throw new RangeError('resource must match the selected critical-particle index');
  }
  assertLoadedRasterGeometry(resource, expected);
}

function assertLoadedRasterGeometry(
  loaded: LoadedClassicRasterResource,
  expected: ClassicRasterResource,
): void {
  if (
    loaded.dimensions.width !== expected.dimensions.width
    || loaded.dimensions.height !== expected.dimensions.height
  ) {
    throw new RangeError('resource dimensions must match the exact recovered raster');
  }
  if (!isValid(loaded.spriteFrame, true)) {
    throw new Error('resource.spriteFrame must be a valid loaded Creator SpriteFrame');
  }
  const original = loaded.spriteFrame.originalSize;
  const rect = loaded.spriteFrame.rect;
  if (
    original.width !== expected.dimensions.width
    || original.height !== expected.dimensions.height
    || rect.width !== expected.dimensions.width
    || rect.height !== expected.dimensions.height
  ) {
    throw new RangeError('resource.spriteFrame must preserve exact untrimmed raster geometry');
  }
}

function assertLifecycle(lifecycle: ClassicCriticalParticlePresenterLifecycle): void {
  assertObject(lifecycle, 'lifecycle');
  if (typeof lifecycle.onDisposed !== 'function') {
    throw new TypeError('Classic critical-particle onDisposed callback must be a function');
  }
}

function assertPoint(value: Readonly<{ x: number; y: number }>, label: string): void {
  assertObject(value, label);
  assertFinite(value.x, `${label}.x`);
  assertFinite(value.y, `${label}.y`);
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
  point: Readonly<{ x: number; y: number }>,
): Readonly<{ x: number; y: number }> {
  return Object.freeze({ x: point.x, y: point.y });
}
