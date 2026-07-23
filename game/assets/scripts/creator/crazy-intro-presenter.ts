import {
  Node,
  Sprite,
  UIOpacity,
  UITransform,
  isValid,
} from 'cc';

import {
  CRAZY_INTRO_SLIDE_SECONDS,
  createCrazyIntroPresentationPlan,
  type CrazyIntroPresentationPlan,
  type CrazyIntroSlidePlan,
  type CrazyIntroVisibleRect,
} from '../domain/crazy-intro-presentation';
import {
  CRAZY_SUPPLEMENTAL_RASTER_COUNT,
  getCrazySupplementalRasterSet,
} from '../domain/crazy-resource-contract';
import type { LoadedCrazyResources } from './crazy-resource-loader';
import type { LoadedGameRasterResource } from './game-resource-loader';

const MAX_OPACITY = 255;
const EPSILON = 1e-7;

export type CrazyIntroPhase = 'sixty' | 'go' | 'complete';

export interface CrazyIntroPresenterInput {
  readonly resources: LoadedCrazyResources;
  readonly visibleRect: CrazyIntroVisibleRect;
}

export interface CrazyIntroPresenterLifecycle {
  readonly onComplete: () => void;
}

export interface CrazyIntroPresenterState {
  readonly active: boolean;
  readonly attached: boolean;
  readonly disposed: boolean;
  readonly elapsedActionSeconds: number;
  readonly phase: CrazyIntroPhase;
  readonly slideElapsedActionSeconds: number;
}

interface PresentedSlide {
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly plan: CrazyIntroSlidePlan;
}

/**
 * Exact action-clock presenter for the recovered `60s` then `GO` Crazy intro.
 * Cutting remains owned by the gameplay layer and is intentionally not disabled here.
 */
export class CrazyIntroPresenter {
  readonly plan: CrazyIntroPresentationPlan;
  readonly root: Node;

  private activeValue = false;
  private attachedValue = false;
  private currentSlide: PresentedSlide | null = null;
  private disposedValue = false;
  private elapsedActionSecondsValue = 0;
  private readonly lifecycle: CrazyIntroPresenterLifecycle;
  private phaseValue: CrazyIntroPhase = 'sixty';
  private readonly resources: LoadedCrazyResources;
  private slideElapsedActionSecondsValue = 0;

  private constructor(
    input: CrazyIntroPresenterInput,
    lifecycle: CrazyIntroPresenterLifecycle,
  ) {
    this.resources = input.resources;
    this.lifecycle = lifecycle;
    const contracts = getCrazySupplementalRasterSet(input.resources.assetTree);
    this.plan = createCrazyIntroPresentationPlan({
      goSpriteWidth: contracts.introGo.dimensions.width,
      sixtySpriteWidth: contracts.introSixty.dimensions.width,
      visibleRect: input.visibleRect,
    });
    this.root = new Node('CrazyIntroRoot');
    this.root.active = false;
  }

  static create(
    input: CrazyIntroPresenterInput,
    lifecycle: CrazyIntroPresenterLifecycle,
  ): CrazyIntroPresenter {
    assertInput(input);
    if (
      lifecycle === null
      || typeof lifecycle !== 'object'
      || typeof lifecycle.onComplete !== 'function'
    ) {
      throw new TypeError('Crazy intro lifecycle must provide onComplete()');
    }
    return new CrazyIntroPresenter(input, lifecycle);
  }

  get state(): CrazyIntroPresenterState {
    return Object.freeze({
      active: this.activeValue,
      attached: this.attachedValue,
      disposed: this.disposedValue,
      elapsedActionSeconds: this.elapsedActionSecondsValue,
      phase: this.phaseValue,
      slideElapsedActionSeconds: this.slideElapsedActionSecondsValue,
    });
  }

  attach(parent: Node): void {
    if (!isValid(parent, true) || !parent.active) {
      throw new Error('Crazy intro parent must be valid and active');
    }
    if (this.disposedValue) {
      throw new Error('Disposed Crazy intro cannot be attached');
    }
    if (this.attachedValue || this.root.parent !== null) {
      throw new Error('Crazy intro is already attached');
    }
    this.root.layer = parent.layer;
    this.root.setParent(parent);
    this.root.setSiblingIndex(1);
    this.attachedValue = true;
  }

  activate(): void {
    if (
      this.disposedValue
      || !this.attachedValue
      || this.root.parent === null
      || !isValid(this.root, true)
    ) {
      throw new Error('Crazy intro must be attached before activation');
    }
    if (this.activeValue || this.phaseValue !== 'sixty') {
      throw new Error('Crazy intro can activate only once');
    }
    this.activeValue = true;
    this.root.active = true;
    this.currentSlide = this.createSlide(this.plan.sixty);
    this.renderCurrentSlide();
  }

  updateAction(unscaledDeltaSeconds: number): void {
    assertNonNegativeFinite(unscaledDeltaSeconds, 'unscaledDeltaSeconds');
    if (this.disposedValue || !this.activeValue || this.phaseValue === 'complete') {
      return;
    }

    let remaining = unscaledDeltaSeconds;
    do {
      const available = Math.max(
        0,
        CRAZY_INTRO_SLIDE_SECONDS - this.slideElapsedActionSecondsValue,
      );
      const consumed = Math.min(remaining, available);
      this.slideElapsedActionSecondsValue = Math.min(
        CRAZY_INTRO_SLIDE_SECONDS,
        this.slideElapsedActionSecondsValue + consumed,
      );
      this.elapsedActionSecondsValue = Math.min(
        this.plan.totalActionSeconds,
        this.elapsedActionSecondsValue + consumed,
      );
      remaining -= consumed;
      this.renderCurrentSlide();

      if (
        this.slideElapsedActionSecondsValue + EPSILON
        < CRAZY_INTRO_SLIDE_SECONDS
      ) {
        break;
      }
      this.completeCurrentSlide();
    } while (remaining > 0 && this.currentSlide !== null);
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.activeValue = false;
    this.attachedValue = false;
    this.destroyCurrentSlide();
    if (isValid(this.root, true)) {
      this.root.destroy();
    }
    return true;
  }

  private completeCurrentSlide(): void {
    this.destroyCurrentSlide();
    this.slideElapsedActionSecondsValue = 0;
    if (this.phaseValue === 'sixty') {
      this.phaseValue = 'go';
      this.currentSlide = this.createSlide(this.plan.go);
      this.renderCurrentSlide();
      return;
    }
    if (this.phaseValue !== 'go') {
      throw new Error('Crazy intro completed an unexpected phase');
    }
    this.phaseValue = 'complete';
    this.activeValue = false;
    this.elapsedActionSecondsValue = this.plan.totalActionSeconds;
    this.lifecycle.onComplete();
  }

  private createSlide(plan: CrazyIntroSlidePlan): PresentedSlide {
    const contracts = getCrazySupplementalRasterSet(this.resources.assetTree);
    const contract = plan.rasterPath === this.plan.sixty.rasterPath
      ? contracts.introSixty
      : contracts.introGo;
    const loaded = this.resources.raster(contract);
    const node = createRasterNode(
      plan.rasterPath === this.plan.sixty.rasterPath
        ? 'CrazyIntroSixty'
        : 'CrazyIntroGo',
      loaded,
    );
    node.node.layer = this.root.layer;
    node.node.setParent(this.root);
    node.node.setSiblingIndex(plan.zOrder);
    node.node.setWorldPosition(
      plan.initialWorldPosition.x,
      plan.initialWorldPosition.y,
      0,
    );
    node.opacity.opacity = 0;
    return Object.freeze({
      node: node.node,
      opacity: node.opacity,
      plan,
    });
  }

  private renderCurrentSlide(): void {
    const slide = this.currentSlide;
    if (slide === null) {
      return;
    }
    const elapsed = this.slideElapsedActionSecondsValue;
    const moveInEnd = slide.plan.moveSequence[0].durationSeconds;
    const holdEnd = moveInEnd + slide.plan.moveSequence[1].durationSeconds;
    const start = slide.plan.initialWorldPosition;
    const center = slide.plan.moveSequence[0].position;
    const exit = slide.plan.moveSequence[2].position;

    if (elapsed <= moveInEnd) {
      const progress = moveInEnd === 0 ? 1 : elapsed / moveInEnd;
      slide.node.setWorldPosition(
        lerp(start.x, center.x, progress),
        lerp(start.y, center.y, progress),
        0,
      );
      slide.opacity.opacity = MAX_OPACITY * progress;
      return;
    }
    if (elapsed <= holdEnd) {
      slide.node.setWorldPosition(center.x, center.y, 0);
      slide.opacity.opacity = MAX_OPACITY;
      return;
    }
    const moveOutSeconds = slide.plan.moveSequence[2].durationSeconds;
    const progress = moveOutSeconds === 0
      ? 1
      : Math.min(1, (elapsed - holdEnd) / moveOutSeconds);
    slide.node.setWorldPosition(
      lerp(center.x, exit.x, progress),
      lerp(center.y, exit.y, progress),
      0,
    );
    slide.opacity.opacity = MAX_OPACITY * (1 - progress);
  }

  private destroyCurrentSlide(): void {
    if (this.currentSlide !== null && isValid(this.currentSlide.node, true)) {
      this.currentSlide.node.destroy();
    }
    this.currentSlide = null;
  }
}

function createRasterNode(
  name: string,
  resource: LoadedGameRasterResource,
): Readonly<{ readonly node: Node; readonly opacity: UIOpacity }> {
  const node = new Node(name);
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(0.5, 0.5);
  transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  const opacity = node.addComponent(UIOpacity);
  return Object.freeze({ node, opacity });
}

function assertInput(input: CrazyIntroPresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Crazy intro input must be an object');
  }
  if (
    input.resources === null
    || typeof input.resources !== 'object'
    || input.resources.rasterCount !== CRAZY_SUPPLEMENTAL_RASTER_COUNT
    || typeof input.resources.raster !== 'function'
  ) {
    throw new Error('Crazy intro requires the complete Crazy resource catalog');
  }
  createCrazyIntroPresentationPlan({
    goSpriteWidth: 1,
    sixtySpriteWidth: 1,
    visibleRect: input.visibleRect,
  });
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
