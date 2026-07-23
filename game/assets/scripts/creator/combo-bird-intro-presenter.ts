import {
  Node,
  Sprite,
  UITransform,
  isValid,
} from 'cc';

import {
  COMBO_BIRD_INSTRUCTION_ATTACHMENT_ORDER,
  COMBO_BIRD_INSTRUCTION_CONSTRUCTION_ORDER,
  COMBO_BIRD_INTRO_SLIDE_SECONDS,
  createComboBirdIntroPresentationPlan,
  type ComboBirdInstructionCard,
  type ComboBirdInstructionSlidePlan,
  type ComboBirdIntroPresentationPlan,
  type ComboBirdIntroSlidePlan,
  type ComboBirdIntroVisibleRect,
} from '../domain/combo-bird-intro-presentation';
import {
  COMBO_BIRD_SUPPLEMENTAL_RASTER_COUNT,
  getComboBirdSupplementalRasterSet,
  type ComboBirdSupplementalRasterSet,
} from '../domain/combo-bird-resource-contract';
import type { LoadedComboBirdResources } from './combo-bird-resource-loader';
import type { LoadedGameRasterResource } from './game-resource-loader';

const EPSILON = 1e-7;
const RECOVERED_Z_ORDER = 1;

export type ComboBirdIntroPhase =
  | 'instructions'
  | 'ninety'
  | 'go'
  | 'complete';

export interface ComboBirdIntroPresenterInput {
  readonly logicalHeight: number;
  readonly resources: LoadedComboBirdResources;
  readonly visibleRect: ComboBirdIntroVisibleRect;
}

export interface ComboBirdIntroPresenterLifecycle {
  readonly onComplete: () => void;
  readonly onGo: () => void;
  readonly onNinety: () => void;
}

export interface ComboBirdIntroPresenterState {
  readonly active: boolean;
  readonly attached: boolean;
  readonly disposed: boolean;
  readonly elapsedActionSeconds: number;
  readonly phase: ComboBirdIntroPhase;
  readonly phaseElapsedActionSeconds: number;
  readonly visibleSlideCount: number;
}

interface PresentedSlide {
  readonly node: Node;
  readonly plan: ComboBirdIntroSlidePlan;
}

/**
 * Manual action-clock presenter for the recovered three-card → 90s → GO sequence.
 *
 * The three instruction nodes are constructed and attached in separate recovered orders.
 * The semantic just-combo slot is resolved only through the selected tree's exact resource
 * contract, preserving the low-resolution `juscombo` spelling.
 */
export class ComboBirdIntroPresenter {
  readonly plan: ComboBirdIntroPresentationPlan;
  readonly root: Node;

  private activeValue = false;
  private attachedValue = false;
  private currentSlide: PresentedSlide | null = null;
  private disposedValue = false;
  private elapsedActionSecondsValue = 0;
  private readonly instructionSlides = new Map<
    ComboBirdInstructionCard,
    PresentedSlide
  >();
  private readonly lifecycle: ComboBirdIntroPresenterLifecycle;
  private phaseElapsedActionSecondsValue = 0;
  private phaseValue: ComboBirdIntroPhase = 'instructions';
  private readonly resources: LoadedComboBirdResources;
  private readonly resourceContracts: ComboBirdSupplementalRasterSet;

  private constructor(
    input: ComboBirdIntroPresenterInput,
    lifecycle: ComboBirdIntroPresenterLifecycle,
  ) {
    this.lifecycle = lifecycle;
    this.resources = input.resources;
    this.resourceContracts = getComboBirdSupplementalRasterSet(
      input.resources.assetTree,
    );
    this.plan = createComboBirdIntroPresentationPlan({
      goSpriteWidth: this.resourceContracts.introGo.dimensions.width,
      justComboSpriteWidth:
        this.resourceContracts.justComboInstruction.dimensions.width,
      logicalHeight: input.logicalHeight,
      ninetySpriteWidth: this.resourceContracts.introNinety.dimensions.width,
      noBombSpriteWidth:
        this.resourceContracts.noBombInstruction.dimensions.width,
      noLifeSpriteWidth:
        this.resourceContracts.noLifeInstruction.dimensions.width,
      visibleRect: input.visibleRect,
    });
    this.root = new Node('ComboBirdIntroRoot');
    this.root.active = false;
  }

  static create(
    input: ComboBirdIntroPresenterInput,
    lifecycle: ComboBirdIntroPresenterLifecycle,
  ): ComboBirdIntroPresenter {
    assertInput(input);
    assertLifecycle(lifecycle);
    return new ComboBirdIntroPresenter(input, lifecycle);
  }

  get state(): ComboBirdIntroPresenterState {
    return Object.freeze({
      active: this.activeValue,
      attached: this.attachedValue,
      disposed: this.disposedValue,
      elapsedActionSeconds: this.elapsedActionSecondsValue,
      phase: this.phaseValue,
      phaseElapsedActionSeconds: this.phaseElapsedActionSecondsValue,
      visibleSlideCount: this.visibleSlideCount(),
    });
  }

  attach(parent: Node): void {
    if (!isValid(parent, true) || !parent.active) {
      throw new Error('Combo Bird intro parent must be valid and active');
    }
    if (this.disposedValue) {
      throw new Error('Disposed Combo Bird intro cannot be attached');
    }
    if (this.attachedValue || this.root.parent !== null) {
      throw new Error('Combo Bird intro is already attached');
    }
    this.root.layer = parent.layer;
    this.root.setParent(parent);
    this.root.setSiblingIndex(RECOVERED_Z_ORDER);
    this.attachedValue = true;
  }

  activate(): void {
    if (
      this.disposedValue
      || !this.attachedValue
      || this.root.parent === null
      || !isValid(this.root, true)
    ) {
      throw new Error('Combo Bird intro must be attached before activation');
    }
    if (
      this.activeValue
      || this.phaseValue !== 'instructions'
      || this.visibleSlideCount() !== 0
    ) {
      throw new Error('Combo Bird intro can activate only once');
    }

    this.constructInstructionSlides();
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
      const available = Math.max(
        0,
        COMBO_BIRD_INTRO_SLIDE_SECONDS
          - this.phaseElapsedActionSecondsValue,
      );
      const consumed = Math.min(remaining, available);
      this.phaseElapsedActionSecondsValue = Math.min(
        COMBO_BIRD_INTRO_SLIDE_SECONDS,
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
        < COMBO_BIRD_INTRO_SLIDE_SECONDS
      ) {
        break;
      }
      this.completeCurrentPhase();
    } while (
      remaining > 0
      && this.activeValue
    );
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.activeValue = false;
    this.attachedValue = false;
    this.destroyInstructionSlides();
    this.destroyCurrentSlide();
    if (isValid(this.root, true)) {
      this.root.destroy();
    }
    return true;
  }

  private completeCurrentPhase(): void {
    switch (this.phaseValue) {
      case 'instructions': {
        const next = this.createSlide('ComboBirdIntroNinety', this.plan.ninety);
        this.phaseElapsedActionSecondsValue = 0;
        this.destroyInstructionSlides();
        this.currentSlide = next;
        this.phaseValue = 'ninety';
        this.renderCurrentSlide();
        this.lifecycle.onNinety();
        return;
      }
      case 'ninety': {
        const next = this.createSlide('ComboBirdIntroGo', this.plan.go);
        this.phaseElapsedActionSecondsValue = 0;
        this.destroyCurrentSlide();
        this.currentSlide = next;
        this.phaseValue = 'go';
        this.renderCurrentSlide();
        this.lifecycle.onGo();
        return;
      }
      case 'go':
        this.phaseElapsedActionSecondsValue = 0;
        this.destroyCurrentSlide();
        this.phaseValue = 'complete';
        this.activeValue = false;
        this.elapsedActionSecondsValue = this.plan.totalActionSeconds;
        this.lifecycle.onComplete();
        return;
      case 'complete':
        throw new Error('Completed Combo Bird intro cannot advance');
    }
  }

  private constructInstructionSlides(): void {
    const provisional = new Map<ComboBirdInstructionCard, PresentedSlide>();
    try {
      for (const card of COMBO_BIRD_INSTRUCTION_CONSTRUCTION_ORDER) {
        provisional.set(
          card,
          this.createDetachedInstructionSlide(
            card,
            instructionPlan(this.plan, card),
          ),
        );
      }
      for (const card of COMBO_BIRD_INSTRUCTION_ATTACHMENT_ORDER) {
        const slide = provisional.get(card);
        if (slide === undefined) {
          throw new Error(`Combo Bird intro omitted instruction ${card}`);
        }
        slide.node.setParent(this.root);
        slide.node.setSiblingIndex(this.root.children.length - 1);
      }
      for (const [card, slide] of provisional) {
        this.instructionSlides.set(card, slide);
      }
    } catch (error) {
      for (const { node } of provisional.values()) {
        if (isValid(node, true)) {
          node.destroy();
        }
      }
      throw error;
    }
  }

  private createDetachedInstructionSlide(
    card: ComboBirdInstructionCard,
    plan: ComboBirdInstructionSlidePlan,
  ): PresentedSlide {
    return this.createDetachedSlide(
      `ComboBirdIntro${instructionNodeSuffix(card)}`,
      plan,
    );
  }

  private createSlide(
    name: string,
    plan: ComboBirdIntroSlidePlan,
  ): PresentedSlide {
    const slide = this.createDetachedSlide(name, plan);
    try {
      slide.node.setParent(this.root);
      slide.node.setSiblingIndex(this.root.children.length - 1);
      return slide;
    } catch (error) {
      if (isValid(slide.node, true)) {
        slide.node.destroy();
      }
      throw error;
    }
  }

  private createDetachedSlide(
    name: string,
    plan: ComboBirdIntroSlidePlan,
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
    for (const { node } of this.instructionSlides.values()) {
      if (isValid(node, true)) {
        node.destroy();
      }
    }
    this.instructionSlides.clear();
  }

  private destroyCurrentSlide(): void {
    if (this.currentSlide !== null && isValid(this.currentSlide.node, true)) {
      this.currentSlide.node.destroy();
    }
    this.currentSlide = null;
  }

  private visibleSlideCount(): number {
    return this.instructionSlides.size + (this.currentSlide === null ? 0 : 1);
  }
}

function resourceContractForPlan(
  plan: ComboBirdIntroSlidePlan,
  resources: ComboBirdSupplementalRasterSet,
) {
  if (plan.resource.type === 'semantic-resource') {
    return resources.justComboInstruction;
  }
  switch (plan.resource.canonicalPath) {
    case 'Text/text-nobomb.png':
      return resources.noBombInstruction;
    case 'Text/text-nolive.png':
      return resources.noLifeInstruction;
    case 'Text/text-90s.png':
      return resources.introNinety;
    case 'Text/text-go.png':
      return resources.introGo;
  }
}

function instructionPlan(
  plan: ComboBirdIntroPresentationPlan,
  card: ComboBirdInstructionCard,
): ComboBirdInstructionSlidePlan {
  switch (card) {
    case 'no-bomb':
      return plan.instructions.noBomb;
    case 'just-combo':
      return plan.instructions.justCombo;
    case 'no-life':
      return plan.instructions.noLife;
  }
}

function instructionNodeSuffix(card: ComboBirdInstructionCard): string {
  switch (card) {
    case 'no-bomb':
      return 'NoBomb';
    case 'just-combo':
      return 'JustCombo';
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
      node.destroy();
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

function assertInput(input: ComboBirdIntroPresenterInput): void {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('input must be an object');
  }
  assertPositiveFinite(input.logicalHeight, 'logicalHeight');
  if (
    input.resources === null
    || typeof input.resources !== 'object'
    || Array.isArray(input.resources)
  ) {
    throw new TypeError('resources must be loaded Combo Bird resources');
  }
  if (
    input.resources.rasterCount !== COMBO_BIRD_SUPPLEMENTAL_RASTER_COUNT
  ) {
    throw new RangeError(
      `Combo Bird resources must contain ${
        String(COMBO_BIRD_SUPPLEMENTAL_RASTER_COUNT)
      } rasters`,
    );
  }
  if (typeof input.resources.raster !== 'function') {
    throw new TypeError('resources.raster must be a function');
  }
  getComboBirdSupplementalRasterSet(input.resources.assetTree);
  const rect = input.visibleRect;
  if (rect === null || typeof rect !== 'object' || Array.isArray(rect)) {
    throw new TypeError('visibleRect must be an object');
  }
  assertFinite(rect.leftX, 'visibleRect.leftX');
  assertFinite(rect.rightX, 'visibleRect.rightX');
  if (rect.rightX <= rect.leftX) {
    throw new RangeError('visibleRect.rightX must be greater than leftX');
  }
  if (
    rect.center === null
    || typeof rect.center !== 'object'
    || Array.isArray(rect.center)
  ) {
    throw new TypeError('visibleRect.center must be an object');
  }
  assertFinite(rect.center.x, 'visibleRect.center.x');
  assertFinite(rect.center.y, 'visibleRect.center.y');
}

function assertLifecycle(lifecycle: ComboBirdIntroPresenterLifecycle): void {
  if (
    lifecycle === null
    || typeof lifecycle !== 'object'
    || Array.isArray(lifecycle)
  ) {
    throw new TypeError('lifecycle must be an object');
  }
  for (const [name, callback] of [
    ['onComplete', lifecycle.onComplete],
    ['onGo', lifecycle.onGo],
    ['onNinety', lifecycle.onNinety],
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
