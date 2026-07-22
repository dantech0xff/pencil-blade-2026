import {
  Color,
  Node,
  Sprite,
  UITransform,
  isValid,
} from 'cc';

import {
  CLASSIC_RESULT_PARTICLE_EXPLOSION_Z_ORDER,
  createClassicResultParticleBurst,
  createClassicResultParticleExplosionPlan,
  type ClassicResultParticleExplosionPlan,
  type ClassicResultParticleExplosionRandom,
  type ClassicResultParticleExplosionViewport,
  type ClassicResultParticlePlan,
} from '../domain/classic-result-particle-explosion';
import {
  getClassicResultResources,
  type ClassicRasterResource,
} from '../domain/classic-resource-contract';
import type { LoadedClassicRasterResource } from './classic-resource-loader';

const CLASSIC_ASSET_TREES = Object.freeze(['480x800', '720x1280'] as const);
const INITIAL_SCALE = 1;
const FINAL_SCALE = 0;
const FINAL_ROTATION_DEGREES = 1;
const WHITE_CHANNEL = 255;
const NO_PARTICLES: readonly PresentedClassicResultParticle[] = Object.freeze([]);

export interface ClassicResultParticleExplosionPresenterInput {
  readonly random: ClassicResultParticleExplosionRandom;
  readonly resource: LoadedClassicRasterResource;
  readonly viewport: ClassicResultParticleExplosionViewport;
}

export interface PresentedClassicResultParticle {
  readonly node: Node;
  readonly plan: ClassicResultParticlePlan;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

export interface ClassicResultParticleExplosionPresenterState {
  readonly attached: boolean;
  readonly burstStarted: boolean;
  readonly completedParticleCount: number;
  readonly disposed: boolean;
  readonly elapsedActionSeconds: number;
  readonly particleCount: number;
}

interface ActiveParticle {
  elapsedActionSeconds: number;
  readonly presented: PresentedClassicResultParticle;
}

/**
 * Presents the recovered result ParticleExplosion behind an explicit, deterministic clock.
 *
 * The native texture uses inferred engine defaults: center anchor, opaque white modulation,
 * and ordinary sprite blending. This presenter sets the anchor/color/opacity-equivalent alpha
 * explicitly and leaves the ordinary Sprite material untouched. It adds no fade or audio.
 */
export class ClassicResultParticleExplosionPresenter {
  readonly node: Node;
  readonly plan: ClassicResultParticleExplosionPlan;

  private readonly random: ClassicResultParticleExplosionRandom;
  private readonly resource: LoadedClassicRasterResource;
  private readonly activeParticles: ActiveParticle[] = [];
  private attachedValue = false;
  private burstStartedValue = false;
  private completedParticleCountValue = 0;
  private disposedValue = false;
  private elapsedActionSecondsValue = 0;
  private particleCountValue = 0;

  private constructor(input: ClassicResultParticleExplosionPresenterInput) {
    this.random = input.random;
    this.resource = input.resource;
    this.plan = createClassicResultParticleExplosionPlan(input.viewport);

    this.node = new Node('ClassicResultParticleExplosion');
    this.node.active = false;
    this.node.setPosition(
      this.plan.emitterWorldPosition.x,
      this.plan.emitterWorldPosition.y,
      0,
    );
  }

  static create(
    input: ClassicResultParticleExplosionPresenterInput,
  ): ClassicResultParticleExplosionPresenter {
    assertInput(input);
    return new ClassicResultParticleExplosionPresenter(input);
  }

  get isAttached(): boolean {
    return this.attachedValue;
  }

  get isDisposed(): boolean {
    return this.disposedValue;
  }

  get particles(): readonly PresentedClassicResultParticle[] {
    if (this.activeParticles.length === 0) {
      return NO_PARTICLES;
    }
    return Object.freeze(this.activeParticles.map(({ presented }) => presented));
  }

  get state(): ClassicResultParticleExplosionPresenterState {
    return Object.freeze({
      attached: this.attachedValue,
      burstStarted: this.burstStartedValue,
      completedParticleCount: this.completedParticleCountValue,
      disposed: this.disposedValue,
      elapsedActionSeconds: this.elapsedActionSecondsValue,
      particleCount: this.particleCountValue,
    });
  }

  /**
   * Attaches at result z-order 1 by default. During result-shell integration, pass the current
   * old-total-label sibling index to insert this node after the total-coins panel and before
   * that label while preserving their recovered equal-z creation order.
   */
  attach(
    parent: Node,
    siblingIndex: number = CLASSIC_RESULT_PARTICLE_EXPLOSION_Z_ORDER,
  ): void {
    this.assertAttachable(parent);
    assertSiblingIndex(siblingIndex);
    this.attachAt(parent, siblingIndex);
  }

  /** Exact equal-z insertion helper for the later result-shell integration. */
  attachBetween(parent: Node, afterSibling: Node, beforeSibling: Node): void {
    this.assertAttachable(parent);
    if (afterSibling === beforeSibling) {
      throw new Error('Result-particle surrounding siblings must be distinct');
    }
    if (afterSibling.parent !== parent || beforeSibling.parent !== parent) {
      throw new Error('Result-particle surrounding siblings must belong to the parent');
    }
    const afterIndex = parent.children.indexOf(afterSibling);
    const beforeIndex = parent.children.indexOf(beforeSibling);
    if (afterIndex < 0 || beforeIndex < 0 || beforeIndex !== afterIndex + 1) {
      throw new Error('Result-particle siblings must be adjacent and in after/before order');
    }
    this.attachAt(parent, beforeIndex);
  }

  updateAction(unscaledDeltaSeconds: number): void {
    assertNonNegativeFinite(unscaledDeltaSeconds, 'unscaledDeltaSeconds');
    if (this.disposedValue) {
      return;
    }
    if (!this.attachedValue) {
      throw new Error('Classic result-particle explosion must be attached before updating actions');
    }
    if (!isValid(this.node, true)) {
      this.markParentDestroyed();
      return;
    }

    this.elapsedActionSecondsValue = advanceTimelineClock(
      this.elapsedActionSecondsValue,
      unscaledDeltaSeconds,
      this.plan,
    );

    if (
      !this.burstStartedValue
      && this.elapsedActionSecondsValue >= this.plan.startDelaySeconds
    ) {
      const particlePlans = createClassicResultParticleBurst(this.plan, this.random);
      this.createParticles(particlePlans);
      this.burstStartedValue = true;
    }

    if (this.burstStartedValue) {
      const elapsedSinceBurst = Math.max(
        0,
        this.elapsedActionSecondsValue - this.plan.startDelaySeconds,
      );
      this.updateParticles(elapsedSinceBurst);
    }

    if (this.elapsedActionSecondsValue >= this.plan.removeAtSeconds) {
      this.disposeWithCleanup();
    }
  }

  /** Explicit teardown path. Returns false after the first cleanup. */
  dispose(): boolean {
    return this.disposeWithCleanup();
  }

  private assertAttachable(parent: Node): void {
    if (!isValid(parent, true) || !parent.activeInHierarchy) {
      throw new Error('Classic result-particle parent must be valid and active');
    }
    if (this.disposedValue || !isValid(this.node, true)) {
      throw new Error('Disposed Classic result-particle explosion cannot be attached');
    }
    if (this.attachedValue || this.node.parent !== null) {
      throw new Error('Classic result-particle explosion is already attached');
    }
  }

  private attachAt(parent: Node, siblingIndex: number): void {
    this.node.layer = parent.layer;
    this.node.setParent(parent, true);
    this.node.setSiblingIndex(siblingIndex);
    this.node.active = true;
    this.attachedValue = true;
  }

  private createParticles(plans: readonly ClassicResultParticlePlan[]): void {
    for (const plan of plans) {
      const node = new Node(`ClassicResultParticle-${plan.index + 1}`);
      node.active = false;
      node.layer = this.node.layer;
      node.setPosition(0, 0, 0);
      node.setScale(INITIAL_SCALE, INITIAL_SCALE, INITIAL_SCALE);
      node.setRotationFromEuler(0, 0, 0);

      const transform = node.addComponent(UITransform);
      transform.setContentSize(
        this.resource.dimensions.width,
        this.resource.dimensions.height,
      );
      transform.setAnchorPoint(0.5, 0.5);

      const sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.spriteFrame = this.resource.spriteFrame;
      sprite.color = new Color(
        WHITE_CHANNEL,
        WHITE_CHANNEL,
        WHITE_CHANNEL,
        WHITE_CHANNEL,
      );
      // No opacity component, custom material, or blend override: no fade, ordinary blend.

      const presented = Object.freeze({ node, plan, sprite, transform });
      node.setParent(this.node);
      node.setSiblingIndex(plan.index);
      node.active = true;
      this.activeParticles.push({ elapsedActionSeconds: 0, presented });
    }
    this.particleCountValue = plans.length;
  }

  private updateParticles(elapsedSinceBurst: number): void {
    let completedParticleCount = 0;
    for (const particle of this.activeParticles) {
      const durationSeconds = particle.presented.plan.durationSeconds;
      particle.elapsedActionSeconds = Math.min(elapsedSinceBurst, durationSeconds);
      const progress = particle.elapsedActionSeconds / durationSeconds;
      particle.presented.node.setPosition(
        progress === 0 ? 0 : particle.presented.plan.deltaLocal.x * progress,
        progress === 0 ? 0 : particle.presented.plan.deltaLocal.y * progress,
        0,
      );
      const scale = INITIAL_SCALE + (FINAL_SCALE - INITIAL_SCALE) * progress;
      particle.presented.node.setScale(scale, scale, INITIAL_SCALE);
      particle.presented.node.setRotationFromEuler(
        0,
        0,
        FINAL_ROTATION_DEGREES * progress,
      );
      if (particle.elapsedActionSeconds >= durationSeconds) {
        completedParticleCount += 1;
      }
      // autoDeleteParticles is recovered false: completed scale-zero nodes remain attached.
    }
    this.completedParticleCountValue = completedParticleCount;
  }

  private disposeWithCleanup(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.attachedValue = false;
    for (const particle of this.activeParticles) {
      if (isValid(particle.presented.node, true)) {
        particle.presented.node.destroy();
      }
    }
    this.activeParticles.length = 0;
    if (isValid(this.node, true)) {
      this.node.destroy();
    }
    return true;
  }

  private markParentDestroyed(): void {
    this.disposedValue = true;
    this.attachedValue = false;
    this.activeParticles.length = 0;
  }
}

function assertInput(input: ClassicResultParticleExplosionPresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('input must be an object');
  }
  if (
    input.random === null
    || typeof input.random !== 'object'
    || typeof input.random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive(minimum, maximum)');
  }
  // Validate viewport before touching Creator objects; this function performs no random draw.
  createClassicResultParticleExplosionPlan(input.viewport);
  assertResource(input.resource);
}

function assertResource(resource: LoadedClassicRasterResource): void {
  if (resource === null || typeof resource !== 'object') {
    throw new TypeError('resource must be an object');
  }
  const expected = CLASSIC_ASSET_TREES
    .map((assetTree) => getClassicResultResources(assetTree).bonusParticle)
    .find((candidate) => candidate.canonicalPath === resource.canonicalPath);
  if (expected === undefined) {
    throw new RangeError('resource must use the exact recovered result-particle path');
  }
  assertLoadedRasterGeometry(resource, expected);
}

function assertLoadedRasterGeometry(
  loaded: LoadedClassicRasterResource,
  expected: ClassicRasterResource,
): void {
  if (
    loaded.dimensions === null
    || typeof loaded.dimensions !== 'object'
    || loaded.dimensions.width !== expected.dimensions.width
    || loaded.dimensions.height !== expected.dimensions.height
  ) {
    throw new RangeError('resource dimensions must match the exact recovered result-particle raster');
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

function assertSiblingIndex(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError('siblingIndex must be a safe integer');
  }
  if (value < 0) {
    throw new RangeError('siblingIndex must be non-negative');
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function advanceTimelineClock(
  elapsedSeconds: number,
  deltaSeconds: number,
  plan: ClassicResultParticleExplosionPlan,
): number {
  const advanced = Math.min(elapsedSeconds + deltaSeconds, plan.removeAtSeconds);
  for (const boundary of [plan.startDelaySeconds, plan.removeAtSeconds]) {
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(boundary)) * 4;
    if (Math.abs(advanced - boundary) <= tolerance) {
      return boundary;
    }
  }
  return advanced;
}
