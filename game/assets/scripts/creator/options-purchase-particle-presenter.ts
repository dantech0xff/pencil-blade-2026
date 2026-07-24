import {
  Node,
  Sprite,
  UITransform,
  isValid,
} from 'cc';

import {
  createOptionsPurchaseBurstPlan,
  createOptionsPurchaseParticles,
  type OptionsPurchaseBurstPlan,
  type OptionsPurchaseBurstViewport,
  type OptionsPurchaseParticlePlan,
  type OptionsPurchaseParticleRandom,
} from '../domain/options-state';
import { getOptionsRasterResources } from '../domain/options-resource-contract';
import type { LoadedGameRasterResource } from './game-resource-loader';

const INITIAL_SCALE = 1;
const FINAL_SCALE = 0;
const NO_PARTICLES: readonly PresentedOptionsPurchaseParticle[] = Object.freeze([]);

export interface OptionsPurchaseParticlePresenterInput {
  readonly random: OptionsPurchaseParticleRandom;
  readonly resource: LoadedGameRasterResource;
  readonly viewport: OptionsPurchaseBurstViewport;
}

export interface PresentedOptionsPurchaseParticle {
  readonly node: Node;
  readonly plan: OptionsPurchaseParticlePlan;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

export interface OptionsPurchaseParticlePresenterState {
  readonly attached: boolean;
  readonly burstStarted: boolean;
  readonly completedParticleCount: number;
  readonly disposed: boolean;
  readonly elapsedActionSeconds: number;
  readonly particleCount: number;
}

interface ActiveParticle {
  elapsedActionSeconds: number;
  readonly presented: PresentedOptionsPurchaseParticle;
}

/** Deterministic Creator presenter for the recovered 45-particle purchase burst. */
export class OptionsPurchaseParticlePresenter {
  readonly plan: OptionsPurchaseBurstPlan;
  readonly root: Node;

  private readonly activeParticles: ActiveParticle[] = [];
  private attachedValue = false;
  private burstStartedValue = false;
  private completedParticleCountValue = 0;
  private disposedValue = false;
  private elapsedActionSecondsValue = 0;
  private readonly random: OptionsPurchaseParticleRandom;
  private readonly resource: LoadedGameRasterResource;

  private constructor(input: OptionsPurchaseParticlePresenterInput) {
    this.random = input.random;
    this.resource = input.resource;
    this.plan = createOptionsPurchaseBurstPlan(input.viewport);
    this.root = new Node('OptionsPurchaseParticleExplosion');
    this.root.active = false;
    this.root.setPosition(
      this.plan.emitterWorldPosition.x,
      this.plan.emitterWorldPosition.y,
      0,
    );
  }

  static create(
    input: OptionsPurchaseParticlePresenterInput,
  ): OptionsPurchaseParticlePresenter {
    assertInput(input);
    return new OptionsPurchaseParticlePresenter(input);
  }

  get particles(): readonly PresentedOptionsPurchaseParticle[] {
    return this.activeParticles.length === 0
      ? NO_PARTICLES
      : Object.freeze(this.activeParticles.map(({ presented }) => presented));
  }

  get state(): OptionsPurchaseParticlePresenterState {
    return Object.freeze({
      attached: this.attachedValue,
      burstStarted: this.burstStartedValue,
      completedParticleCount: this.completedParticleCountValue,
      disposed: this.disposedValue,
      elapsedActionSeconds: this.elapsedActionSecondsValue,
      particleCount: this.activeParticles.length,
    });
  }

  attach(parent: Node): void {
    if (!isValid(parent, true) || !parent.activeInHierarchy) {
      throw new Error('Options purchase-particle parent must be valid and active');
    }
    if (
      this.disposedValue
      || !isValid(this.root, true)
      || this.attachedValue
      || this.root.parent !== null
    ) {
      throw new Error('Options purchase-particle explosion is not attachable');
    }
    this.root.layer = parent.layer;
    this.root.setParent(parent);
    // Native z-order 1 places the burst above the zero-order Options controls.
    this.root.setSiblingIndex(parent.children.length - 1);
    this.root.active = true;
    this.attachedValue = true;
  }

  update(unscaledDeltaSeconds: number): void {
    assertNonNegativeFinite(unscaledDeltaSeconds, 'unscaledDeltaSeconds');
    if (this.disposedValue) {
      return;
    }
    if (!this.attachedValue) {
      throw new Error('Options purchase-particle explosion must be attached before update');
    }
    if (!isValid(this.root, true)) {
      this.markParentDestroyed();
      return;
    }

    this.elapsedActionSecondsValue = Math.min(
      this.elapsedActionSecondsValue + unscaledDeltaSeconds,
      this.plan.removeAtSeconds,
    );
    if (
      !this.burstStartedValue
      && this.elapsedActionSecondsValue >= this.plan.startDelaySeconds
    ) {
      this.createParticles(createOptionsPurchaseParticles(this.plan, this.random));
      this.burstStartedValue = true;
    }
    if (this.burstStartedValue) {
      this.updateParticles(Math.max(
        0,
        this.elapsedActionSecondsValue - this.plan.startDelaySeconds,
      ));
    }
    if (this.elapsedActionSecondsValue >= this.plan.removeAtSeconds) {
      this.dispose();
    }
  }

  dispose(): boolean {
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
    if (isValid(this.root, true)) {
      this.root.destroy();
    }
    return true;
  }

  private createParticles(plans: readonly OptionsPurchaseParticlePlan[]): void {
    for (const plan of plans) {
      const node = new Node(`OptionsPurchaseParticle-${plan.index + 1}`);
      node.active = false;
      node.layer = this.root.layer;
      node.setPosition(0, 0, 0);
      node.setScale(INITIAL_SCALE, INITIAL_SCALE, INITIAL_SCALE);
      node.setRotationFromEuler(0, 0, 0);

      const transform = node.addComponent(UITransform);
      transform.setAnchorPoint(0.5, 0.5);
      transform.setContentSize(
        this.resource.dimensions.width,
        this.resource.dimensions.height,
      );
      const sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.spriteFrame = this.resource.spriteFrame;

      const presented = Object.freeze({ node, plan, sprite, transform });
      node.setParent(this.root);
      node.setSiblingIndex(plan.spriteChildZOrder + plan.index);
      node.active = true;
      this.activeParticles.push({ elapsedActionSeconds: 0, presented });
    }
  }

  private updateParticles(elapsedSinceBurst: number): void {
    let completed = 0;
    for (const particle of this.activeParticles) {
      const duration = particle.presented.plan.durationSeconds;
      particle.elapsedActionSeconds = Math.min(elapsedSinceBurst, duration);
      const progress = particle.elapsedActionSeconds / duration;
      const { node, plan } = particle.presented;
      node.setPosition(
        progress === 0 ? 0 : plan.deltaLocal.x * progress,
        progress === 0 ? 0 : plan.deltaLocal.y * progress,
        0,
      );
      const scale = INITIAL_SCALE + (FINAL_SCALE - INITIAL_SCALE) * progress;
      node.setScale(scale, scale, INITIAL_SCALE);
      node.setRotationFromEuler(
        plan.rotateAction.deltaX * progress,
        plan.rotateAction.deltaY * progress,
        0,
      );
      if (particle.elapsedActionSeconds >= duration) {
        completed += 1;
      }
    }
    this.completedParticleCountValue = completed;
  }

  private markParentDestroyed(): void {
    this.disposedValue = true;
    this.attachedValue = false;
    this.activeParticles.length = 0;
  }
}

function assertInput(input: OptionsPurchaseParticlePresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Options purchase-particle input must be an object');
  }
  if (
    input.random === null
    || typeof input.random !== 'object'
    || typeof input.random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('Options purchase-particle random must provide nextIntInclusive()');
  }
  createOptionsPurchaseBurstPlan(input.viewport);
  const expected = (['480x800', '720x1280'] as const)
    .map((tree) => getOptionsRasterResources(tree).purchaseParticle)
    .find(({ canonicalPath }) => canonicalPath === input.resource?.canonicalPath);
  if (
    expected === undefined
    || input.resource.dimensions.width !== expected.dimensions.width
    || input.resource.dimensions.height !== expected.dimensions.height
    || !isValid(input.resource.spriteFrame, true)
  ) {
    throw new Error('Options purchase particle must use the exact loaded xmasfive raster');
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}
