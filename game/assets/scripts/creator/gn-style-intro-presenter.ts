import {
  Node,
  Sprite,
  UITransform,
  isValid,
} from 'cc';

import {
  GN_STYLE_GO_SLIDE_SECONDS,
  GN_STYLE_INSTRUCTION_ATTACHMENT_ORDER,
  GN_STYLE_INSTRUCTION_CONSTRUCTION_ORDER,
  GN_STYLE_INSTRUCTION_SLIDE_SECONDS,
  GN_STYLE_ONE_HUNDRED_FIFTY_SLIDE_SECONDS,
  createGnStyleIntroPresentationPlan,
  type GnStyleInstructionCard,
  type GnStyleInstructionSlidePlan,
  type GnStyleIntroPresentationPlan,
  type GnStyleIntroSlidePlan,
  type GnStyleIntroVisibleRect,
} from '../domain/gn-style-intro-presentation';
import {
  GN_STYLE_SUPPLEMENTAL_RASTER_COUNT,
  getGnStyleSupplementalRasterSet,
  type GnStyleSupplementalRasterSet,
} from '../domain/gn-style-resource-contract';
import type { LoadedGameRasterResource } from './game-resource-loader';
import type { LoadedGnStyleResources } from './gn-style-resource-loader';

const EPSILON = 1e-7;
const RECOVERED_Z_ORDER = 1;

export type GnStyleIntroPhase =
  | 'instructions'
  | 'one-hundred-fifty'
  | 'go'
  | 'complete';

export interface GnStyleIntroPresenterInput {
  readonly logicalHeight: number;
  readonly resources: LoadedGnStyleResources;
  readonly visibleRect: GnStyleIntroVisibleRect;
}

export interface GnStyleIntroPresenterLifecycle {
  readonly onShowOneHundredFifty: () => void;
  readonly onShowGo: () => void;
  readonly onStartGame: () => void;
}

export interface GnStyleIntroPresenterState {
  readonly active: boolean;
  readonly attached: boolean;
  readonly disposed: boolean;
  readonly elapsedActionSeconds: number;
  readonly phase: GnStyleIntroPhase;
  readonly phaseElapsedActionSeconds: number;
  readonly visibleSlideCount: number;
}

interface PresentedSlide {
  readonly node: Node;
  readonly plan: GnStyleIntroSlidePlan;
}

/**
 * Manual action-clock presenter for the recovered GN Style instruction → 150s → GO intro.
 *
 * The three instruction nodes are built under an inactive detached root. Their action clock
 * cannot begin until the caller attaches that root to the current gameplay screen and then
 * explicitly activates the presenter.
 */
export class GnStyleIntroPresenter {
  readonly plan: GnStyleIntroPresentationPlan;
  readonly root: Node;

  private activeValue = false;
  private attachedValue = false;
  private currentSlide: PresentedSlide | null = null;
  private disposedValue = false;
  private elapsedActionSecondsValue = 0;
  private readonly instructionSlides = new Map<
    GnStyleInstructionCard,
    PresentedSlide
  >();
  private readonly lifecycle: GnStyleIntroPresenterLifecycle;
  private phaseElapsedActionSecondsValue = 0;
  private phaseValue: GnStyleIntroPhase = 'instructions';
  private readonly resources: LoadedGnStyleResources;
  private readonly resourceContracts: GnStyleSupplementalRasterSet;

  private constructor(
    input: GnStyleIntroPresenterInput,
    lifecycle: GnStyleIntroPresenterLifecycle,
  ) {
    this.lifecycle = lifecycle;
    this.resources = input.resources;
    this.resourceContracts = getGnStyleSupplementalRasterSet(
      input.resources.assetTree,
    );
    this.plan = createGnStyleIntroPresentationPlan({
      gnStyleSpriteWidth:
        this.resourceContracts.gnStyleInstruction.dimensions.width,
      goSpriteWidth: this.resourceContracts.introGo.dimensions.width,
      logicalHeight: input.logicalHeight,
      noBombSpriteWidth:
        this.resourceContracts.noBombInstruction.dimensions.width,
      noLifeSpriteWidth:
        this.resourceContracts.noLifeInstruction.dimensions.width,
      oneHundredFiftySpriteWidth:
        this.resourceContracts.introOneHundredFifty.dimensions.width,
      visibleRect: input.visibleRect,
    });
    this.root = new Node('GnStyleIntroRoot');
    this.root.active = false;
  }

  static create(
    input: GnStyleIntroPresenterInput,
    lifecycle: GnStyleIntroPresenterLifecycle,
  ): GnStyleIntroPresenter {
    assertInput(input);
    assertLifecycle(lifecycle);
    const presenter = new GnStyleIntroPresenter(input, lifecycle);
    try {
      presenter.constructInstructionSlides();
      return presenter;
    } catch (error) {
      const failures: unknown[] = [];
      collectFailure(failures, () => presenter.destroyInstructionSlides());
      if (isValid(presenter.root, true)) {
        collectFailure(failures, () => presenter.root.destroy());
      }
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'GN Style intro construction rollback failed',
          error,
          failures,
        );
      }
      throw error;
    }
  }

  get state(): GnStyleIntroPresenterState {
    return Object.freeze({
      active: this.activeValue,
      attached: this.attachedValue,
      disposed: this.disposedValue,
      elapsedActionSeconds: this.elapsedActionSecondsValue,
      phase: this.phaseValue,
      phaseElapsedActionSeconds: this.phaseElapsedActionSecondsValue,
      visibleSlideCount: this.activeValue ? this.slideCount() : 0,
    });
  }

  attach(parent: Node): void {
    // Mode presentation is constructed transactionally under a detached, locally
    // active screen root. The root becomes activeInHierarchy only after the app
    // shell commits it as the current screen.
    if (!isValid(parent, true) || !parent.active) {
      throw new Error('GN Style intro parent must be valid and active');
    }
    if (this.disposedValue) {
      throw new Error('Disposed GN Style intro cannot be attached');
    }
    if (this.attachedValue || this.root.parent !== null) {
      throw new Error('GN Style intro is already attached');
    }

    const previousLayer = this.root.layer;
    try {
      this.setPresentationLayer(parent.layer);
      this.root.setParent(parent);
      this.root.setSiblingIndex(RECOVERED_Z_ORDER);
      if (this.root.parent !== parent || !isValid(this.root, true)) {
        throw new Error('GN Style intro root failed to attach');
      }
      this.attachedValue = true;
    } catch (error) {
      const failures: unknown[] = [];
      if (this.root.parent !== null) {
        collectFailure(failures, () => this.root.setParent(null));
      }
      collectFailure(failures, () => this.setPresentationLayer(previousLayer));
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'GN Style intro attach rollback failed',
          error,
          failures,
        );
      }
      throw error;
    }
  }

  activate(): void {
    const parent = this.root.parent;
    if (
      this.disposedValue
      || !this.attachedValue
      || parent === null
      || !isValid(parent, true)
      || !parent.activeInHierarchy
      || !isValid(this.root, true)
    ) {
      throw new Error('GN Style intro must be attached before activation');
    }
    if (
      this.activeValue
      || this.phaseValue !== 'instructions'
      || this.instructionSlides.size
        !== GN_STYLE_INSTRUCTION_CONSTRUCTION_ORDER.length
      || this.currentSlide !== null
    ) {
      throw new Error('GN Style intro can activate only once');
    }

    this.root.active = true;
    this.activeValue = true;
    this.renderInstructions();
  }

  updateAction(unscaledDeltaSeconds: number): void {
    assertNonNegativeFinite(unscaledDeltaSeconds, 'unscaledDeltaSeconds');
    if (
      this.disposedValue
      || !this.activeValue
      || this.phaseValue === 'complete'
    ) {
      return;
    }

    let remaining = unscaledDeltaSeconds;
    do {
      const duration = phaseDuration(this.phaseValue);
      const available = Math.max(
        0,
        duration - this.phaseElapsedActionSecondsValue,
      );
      const consumed = Math.min(remaining, available);
      this.phaseElapsedActionSecondsValue = Math.min(
        duration,
        this.phaseElapsedActionSecondsValue + consumed,
      );
      this.elapsedActionSecondsValue = Math.min(
        this.plan.totalActionSeconds,
        this.elapsedActionSecondsValue + consumed,
      );
      remaining -= consumed;
      this.renderCurrentPhase();

      if (
        this.phaseElapsedActionSecondsValue + EPSILON
        < duration
      ) {
        break;
      }
      this.completeCurrentPhase();
    } while (remaining > 0 && this.activeValue);
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }

    this.activeValue = false;
    this.root.active = false;
    this.destroyInstructionSlides();
    this.destroyCurrentSlide();
    if (isValid(this.root, true)) {
      this.root.destroy();
    }
    this.attachedValue = false;
    this.disposedValue = true;
    return true;
  }

  private completeCurrentPhase(): void {
    switch (this.phaseValue) {
      case 'instructions': {
        const next = this.createSlide(
          'GnStyleIntroOneHundredFifty',
          this.plan.oneHundredFifty,
        );
        try {
          this.destroyInstructionSlides();
        } catch (error) {
          destroyProvisionalSlide(next, error);
        }
        this.currentSlide = next;
        this.phaseElapsedActionSecondsValue = 0;
        this.phaseValue = 'one-hundred-fifty';
        this.renderCurrentSlide();
        this.lifecycle.onShowOneHundredFifty();
        return;
      }
      case 'one-hundred-fifty': {
        const next = this.createSlide('GnStyleIntroGo', this.plan.go);
        try {
          this.destroyCurrentSlide();
        } catch (error) {
          destroyProvisionalSlide(next, error);
        }
        this.currentSlide = next;
        this.phaseElapsedActionSecondsValue = 0;
        this.phaseValue = 'go';
        this.renderCurrentSlide();
        this.lifecycle.onShowGo();
        return;
      }
      case 'go':
        this.destroyCurrentSlide();
        this.phaseElapsedActionSecondsValue = 0;
        this.phaseValue = 'complete';
        this.activeValue = false;
        this.elapsedActionSecondsValue = this.plan.totalActionSeconds;
        this.lifecycle.onStartGame();
        return;
      case 'complete':
        throw new Error('Completed GN Style intro cannot advance');
    }
  }

  private constructInstructionSlides(): void {
    const provisional = new Map<GnStyleInstructionCard, PresentedSlide>();
    try {
      for (const card of GN_STYLE_INSTRUCTION_CONSTRUCTION_ORDER) {
        provisional.set(
          card,
          this.createDetachedInstructionSlide(
            card,
            instructionPlan(this.plan, card),
          ),
        );
      }
      for (const card of GN_STYLE_INSTRUCTION_ATTACHMENT_ORDER) {
        const slide = provisional.get(card);
        if (slide === undefined) {
          throw new Error(`GN Style intro omitted instruction ${card}`);
        }
        slide.node.setParent(this.root);
        slide.node.setSiblingIndex(this.root.children.length - 1);
      }
      for (const [card, slide] of provisional) {
        this.instructionSlides.set(card, slide);
      }
    } catch (error) {
      const failures: unknown[] = [];
      for (const { node } of provisional.values()) {
        if (isValid(node, true)) {
          collectFailure(failures, () => node.destroy());
        }
      }
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'GN Style instruction rollback failed',
          error,
          failures,
        );
      }
      throw error;
    }
  }

  private createDetachedInstructionSlide(
    card: GnStyleInstructionCard,
    plan: GnStyleInstructionSlidePlan,
  ): PresentedSlide {
    return this.createDetachedSlide(
      `GnStyleIntro${instructionNodeSuffix(card)}`,
      plan,
    );
  }

  private createSlide(
    name: string,
    plan: GnStyleIntroSlidePlan,
  ): PresentedSlide {
    const slide = this.createDetachedSlide(name, plan);
    try {
      slide.node.setParent(this.root);
      slide.node.setSiblingIndex(this.root.children.length - 1);
      return slide;
    } catch (error) {
      if (isValid(slide.node, true)) {
        try {
          slide.node.destroy();
        } catch (rollbackError) {
          throw aggregateWithPrimary(
            'GN Style slide attach rollback failed',
            error,
            [rollbackError],
          );
        }
      }
      throw error;
    }
  }

  private createDetachedSlide(
    name: string,
    plan: GnStyleIntroSlidePlan,
  ): PresentedSlide {
    const resource = this.resources.raster(
      resourceContractForPlan(plan, this.resourceContracts),
    );
    const node = createRasterNode(name, resource);
    node.layer = this.root.layer;
    node.setWorldPosition(
      plan.initialWorldPosition.x,
      plan.initialWorldPosition.y,
      0,
    );
    return Object.freeze({ node, plan });
  }

  private renderCurrentPhase(): void {
    if (this.phaseValue === 'instructions') {
      this.renderInstructions();
      return;
    }
    this.renderCurrentSlide();
  }

  private renderInstructions(): void {
    for (const slide of this.instructionSlides.values()) {
      renderSlide(slide, this.phaseElapsedActionSecondsValue);
    }
  }

  private renderCurrentSlide(): void {
    if (this.currentSlide !== null) {
      renderSlide(this.currentSlide, this.phaseElapsedActionSecondsValue);
    }
  }

  private destroyInstructionSlides(): void {
    for (const [card, { node }] of this.instructionSlides) {
      if (isValid(node, true)) {
        node.destroy();
      }
      this.instructionSlides.delete(card);
    }
  }

  private destroyCurrentSlide(): void {
    const slide = this.currentSlide;
    if (slide === null) {
      return;
    }
    if (isValid(slide.node, true)) {
      slide.node.destroy();
    }
    this.currentSlide = null;
  }

  private setPresentationLayer(layer: number): void {
    this.root.layer = layer;
    for (const { node } of this.instructionSlides.values()) {
      node.layer = layer;
    }
    if (this.currentSlide !== null) {
      this.currentSlide.node.layer = layer;
    }
  }

  private slideCount(): number {
    return this.instructionSlides.size + (this.currentSlide === null ? 0 : 1);
  }
}

function phaseDuration(phase: Exclude<GnStyleIntroPhase, 'complete'>): number {
  switch (phase) {
    case 'instructions':
      return GN_STYLE_INSTRUCTION_SLIDE_SECONDS;
    case 'one-hundred-fifty':
      return GN_STYLE_ONE_HUNDRED_FIFTY_SLIDE_SECONDS;
    case 'go':
      return GN_STYLE_GO_SLIDE_SECONDS;
  }
}

function resourceContractForPlan(
  plan: GnStyleIntroSlidePlan,
  resources: GnStyleSupplementalRasterSet,
): GnStyleSupplementalRasterSet[keyof GnStyleSupplementalRasterSet] {
  switch (plan.resource.canonicalPath) {
    case 'Text/text-nobomb.png':
      return resources.noBombInstruction;
    case 'Text/text-gnstyle.png':
      return resources.gnStyleInstruction;
    case 'Text/text-nolive.png':
      return resources.noLifeInstruction;
    case 'Text/text-150s.png':
      return resources.introOneHundredFifty;
    case 'Text/text-go.png':
      return resources.introGo;
  }
}

function instructionPlan(
  plan: GnStyleIntroPresentationPlan,
  card: GnStyleInstructionCard,
): GnStyleInstructionSlidePlan {
  switch (card) {
    case 'no-bomb':
      return plan.instructions.noBomb;
    case 'gn-style':
      return plan.instructions.gnStyle;
    case 'no-life':
      return plan.instructions.noLife;
  }
}

function instructionNodeSuffix(card: GnStyleInstructionCard): string {
  switch (card) {
    case 'no-bomb':
      return 'NoBomb';
    case 'gn-style':
      return 'GnStyle';
    case 'no-life':
      return 'NoLife';
  }
}

function createRasterNode(
  name: string,
  resource: LoadedGameRasterResource,
): Node {
  const node = new Node(name);
  try {
    const transform = node.addComponent(UITransform);
    transform.setAnchorPoint(0.5, 0.5);
    transform.setContentSize(
      resource.dimensions.width,
      resource.dimensions.height,
    );
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = resource.spriteFrame;
    return node;
  } catch (error) {
    if (isValid(node, true)) {
      try {
        node.destroy();
      } catch (rollbackError) {
        throw aggregateWithPrimary(
          'GN Style raster-node construction rollback failed',
          error,
          [rollbackError],
        );
      }
    }
    throw error;
  }
}

function renderSlide(
  slide: PresentedSlide,
  elapsedActionSeconds: number,
): void {
  const [moveIn, hold, moveOut] = slide.plan.actionSequence;
  const moveInEnd = moveIn.durationSeconds;
  const holdEnd = moveInEnd + hold.durationSeconds;
  if (elapsedActionSeconds <= moveInEnd) {
    const progress = moveInEnd === 0 ? 1 : elapsedActionSeconds / moveInEnd;
    setWorldPoint(
      slide.node,
      lerpPoint(slide.plan.initialWorldPosition, moveIn.position, progress),
    );
    return;
  }
  if (elapsedActionSeconds <= holdEnd) {
    setWorldPoint(slide.node, moveIn.position);
    return;
  }
  const progress = moveOut.durationSeconds === 0
    ? 1
    : Math.min(
      1,
      (elapsedActionSeconds - holdEnd) / moveOut.durationSeconds,
    );
  setWorldPoint(slide.node, lerpPoint(moveIn.position, moveOut.position, progress));
}

function setWorldPoint(
  node: Node,
  point: Readonly<{ readonly x: number; readonly y: number }>,
): void {
  node.setWorldPosition(point.x, point.y, 0);
}

function lerpPoint(
  from: Readonly<{ readonly x: number; readonly y: number }>,
  to: Readonly<{ readonly x: number; readonly y: number }>,
  progress: number,
): Readonly<{ readonly x: number; readonly y: number }> {
  return Object.freeze({
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  });
}

function destroyProvisionalSlide(
  slide: PresentedSlide,
  primary: unknown,
): never {
  if (isValid(slide.node, true)) {
    try {
      slide.node.destroy();
    } catch (rollbackError) {
      throw aggregateWithPrimary(
        'GN Style phase rollback failed',
        primary,
        [rollbackError],
      );
    }
  }
  throw primary;
}

function assertInput(input: GnStyleIntroPresenterInput): void {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('input must be an object');
  }
  assertPositiveFinite(input.logicalHeight, 'logicalHeight');
  if (
    input.resources === null
    || typeof input.resources !== 'object'
    || Array.isArray(input.resources)
  ) {
    throw new TypeError('resources must be loaded GN Style resources');
  }
  if (
    input.resources.rasterCount !== GN_STYLE_SUPPLEMENTAL_RASTER_COUNT
  ) {
    throw new RangeError(
      `GN Style resources must contain ${
        String(GN_STYLE_SUPPLEMENTAL_RASTER_COUNT)
      } rasters`,
    );
  }
  if (typeof input.resources.raster !== 'function') {
    throw new TypeError('resources.raster must be a function');
  }
  const contracts = getGnStyleSupplementalRasterSet(input.resources.assetTree);
  createGnStyleIntroPresentationPlan({
    gnStyleSpriteWidth: contracts.gnStyleInstruction.dimensions.width,
    goSpriteWidth: contracts.introGo.dimensions.width,
    logicalHeight: input.logicalHeight,
    noBombSpriteWidth: contracts.noBombInstruction.dimensions.width,
    noLifeSpriteWidth: contracts.noLifeInstruction.dimensions.width,
    oneHundredFiftySpriteWidth:
      contracts.introOneHundredFifty.dimensions.width,
    visibleRect: input.visibleRect,
  });
}

function assertLifecycle(lifecycle: GnStyleIntroPresenterLifecycle): void {
  if (
    lifecycle === null
    || typeof lifecycle !== 'object'
    || Array.isArray(lifecycle)
  ) {
    throw new TypeError('lifecycle must be an object');
  }
  for (const [name, callback] of [
    ['onShowOneHundredFifty', lifecycle.onShowOneHundredFifty],
    ['onShowGo', lifecycle.onShowGo],
    ['onStartGame', lifecycle.onStartGame],
  ] as const) {
    if (typeof callback !== 'function') {
      throw new TypeError(`lifecycle.${name} must be a function`);
    }
  }
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be positive and finite`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function collectFailure(
  failures: unknown[],
  action: () => void,
): void {
  try {
    action();
  } catch (error) {
    failures.push(error);
  }
}

function aggregateWithPrimary(
  label: string,
  primary: unknown,
  failures: readonly unknown[],
): Error {
  return new Error(
    `${label}: ${errorMessage(primary)}; ${failures.map(errorMessage).join('; ')}`,
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
