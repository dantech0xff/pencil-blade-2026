import {
  Color,
  Font,
  Label,
  Mask,
  Node,
  Sprite,
  UIOpacity,
  UITransform,
  isValid,
} from 'cc';

import {
  classicBestScoreColor,
  createClassicScoreHudLayout,
  formatClassicBestScore,
  formatClassicInitialDisplayedScore,
  formatClassicPendingDoubleScore,
  formatClassicUpdatedDisplayedScore,
  type ClassicScoreHudLabelLayout,
  type ClassicScoreHudLayout,
  type ClassicScoreHudRgb,
  type ClassicScoreHudViewport,
} from '../domain/classic-score-hud-presentation';
import {
  CLASSIC_SCORE_HUD_FONT_RESOURCE,
  getClassicPresentationResources,
  type ClassicPresentationRasterSet,
  type ClassicRasterResource,
} from '../domain/classic-resource-contract';
import { DOUBLE_SCORE_ACTIVE_SECONDS } from '../domain/score-service';
import type {
  LoadedClassicFontResource,
  LoadedClassicRasterResource,
} from './classic-resource-loader';

const CLASSIC_ASSET_TREES = Object.freeze(['480x800', '720x1280'] as const);
const MAX_OPACITY = 255;

export interface ClassicScoreHudPresenterInput {
  readonly bestScoreCupResource: LoadedClassicRasterResource;
  readonly doubleScorePanelResource: LoadedClassicRasterResource;
  readonly fontResource: LoadedClassicFontResource;
  readonly initialBestScore: number;
  readonly scoreIconResource: LoadedClassicRasterResource;
  readonly viewport: ClassicScoreHudViewport;
}

export interface ClassicScoreHudPresenterLifecycle {
  readonly onDoubleScoreActiveDelayComplete: () => void;
  readonly onScoreIconScaleDownComplete: () => void;
  readonly onScoreIconScaleUpComplete: () => void;
}

export interface PresentedClassicScoreHudSprite {
  readonly node: Node;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

export interface PresentedClassicScoreHudFadingSprite extends PresentedClassicScoreHudSprite {
  readonly opacity: UIOpacity;
}

export interface PresentedClassicScoreHudLabel {
  readonly label: Label;
  readonly node: Node;
  readonly transform: UITransform;
}

export interface PresentedClassicScoreHudViewportClip {
  readonly mask: Mask;
  readonly node: Node;
  readonly transform: UITransform;
}

export type ClassicScoreIconScalePhase = 'down' | 'idle' | 'up';
export type ClassicDoubleScorePanelPhase = 'entering' | 'exiting' | 'hidden' | 'shown';

export interface ClassicScoreHudPresenterState {
  readonly attached: boolean;
  readonly bestScore: number;
  readonly bestScoreIsNewBest: boolean;
  readonly displayedScore: number;
  readonly disposed: boolean;
  readonly doubleScorePanelPhase: ClassicDoubleScorePanelPhase;
  readonly entryElapsedActionSeconds: number;
  readonly pendingDoubleScore: number;
  readonly scoreIconScale: number;
  readonly scoreIconScalePhase: ClassicScoreIconScalePhase;
}

interface ActiveScoreIconScale {
  readonly direction: Exclude<ClassicScoreIconScalePhase, 'idle'>;
  readonly durationSeconds: number;
  elapsedSeconds: number;
  readonly startScale: number;
  readonly targetScale: number;
}

interface ActiveDoubleScorePanelMove {
  readonly activeDelaySeconds: number | null;
  readonly direction: 'entering' | 'exiting';
  readonly durationSeconds: number;
  readonly earliestProgressUpdate: number;
  elapsedSeconds: number;
  readonly startX: number;
  readonly targetX: number;
}

interface ActiveDoubleScoreDelay {
  readonly durationSeconds: number;
  readonly earliestProgressUpdate: number;
  elapsedSeconds: number;
}

interface DoubleScoreActionTarget {
  readonly kind: 'delay' | 'panel';
  readonly order: number;
}

/** Exact raster geometry and recovered score-HUD actions at the Creator boundary. */
export class ClassicScoreHudPresenter {
  readonly bestScoreCup: PresentedClassicScoreHudFadingSprite;
  readonly bestScoreLabel: PresentedClassicScoreHudLabel;
  readonly doubleScorePanel: PresentedClassicScoreHudSprite;
  readonly doubleScoreViewportClip: PresentedClassicScoreHudViewportClip;
  readonly layout: ClassicScoreHudLayout;
  readonly liveScoreLabel: PresentedClassicScoreHudLabel;
  readonly pendingDoubleLabel: PresentedClassicScoreHudLabel;
  readonly scoreIcon: PresentedClassicScoreHudFadingSprite;

  private activeScoreIconScale: ActiveScoreIconScale | null = null;
  private readonly activeDoubleScorePanelMoves: ActiveDoubleScorePanelMove[] = [];
  private readonly activeDoubleScoreDelays: ActiveDoubleScoreDelay[] = [];
  private delayActionTarget: DoubleScoreActionTarget | null = null;
  private doubleScoreActionTargetOrder = 0;
  private doubleScoreActionUpdate = 0;
  private panelActionTarget: DoubleScoreActionTarget | null = null;
  private attachedValue = false;
  private bestScoreIsNewBestValue = false;
  private bestScoreValue: number;
  private displayedScoreValue = 0;
  private disposedValue = false;
  private doubleScorePanelPhaseValue: ClassicDoubleScorePanelPhase = 'hidden';
  private entryElapsedActionSecondsValue = 0;
  private readonly lifecycle: ClassicScoreHudPresenterLifecycle;
  private pendingDoubleScoreValue = 0;
  private scoreIconScaleValue = 1;

  private constructor(
    input: ClassicScoreHudPresenterInput,
    lifecycle: ClassicScoreHudPresenterLifecycle,
    presentation: ClassicPresentationRasterSet,
  ) {
    this.lifecycle = lifecycle;
    this.bestScoreValue = input.initialBestScore;
    this.layout = createClassicScoreHudLayout(input.viewport, {
      bestScoreCup: presentation.bestScoreCup.dimensions,
      doubleScorePanel: presentation.doubleScorePanel.dimensions,
      scoreIcon: presentation.scoreIcon.dimensions,
    });

    this.scoreIcon = createFadingSprite(
      'ClassicScoreIcon',
      input.scoreIconResource,
      this.layout.scoreIcon.initialOpacity,
    );
    this.scoreIcon.node.setWorldPosition(
      this.layout.scoreIcon.worldPosition.x,
      this.layout.scoreIcon.worldPosition.y,
      0,
    );

    this.bestScoreCup = createFadingSprite(
      'ClassicBestScoreCup',
      input.bestScoreCupResource,
      this.layout.bestScoreCup.initialOpacity,
    );
    this.bestScoreCup.node.setWorldPosition(
      this.layout.bestScoreCup.worldPosition.x,
      this.layout.bestScoreCup.worldPosition.y,
      0,
    );

    this.doubleScoreViewportClip = createViewportClip(input.viewport);
    this.doubleScorePanel = createSprite(
      'ClassicDoubleScorePanel',
      input.doubleScorePanelResource,
    );
    this.doubleScorePanel.node.setParent(this.doubleScoreViewportClip.node);
    this.doubleScorePanel.node.setWorldPosition(
      this.layout.doubleScorePanel.hiddenWorldPosition.x,
      this.layout.doubleScorePanel.hiddenWorldPosition.y,
      0,
    );

    this.liveScoreLabel = createLabel(
      'ClassicLiveScoreLabel',
      input.fontResource.font,
      this.layout.liveScoreLabel,
      formatClassicInitialDisplayedScore(),
    );
    this.liveScoreLabel.node.setWorldPosition(
      this.layout.liveScoreLabel.worldPosition.x,
      this.layout.liveScoreLabel.worldPosition.y,
      0,
    );

    this.bestScoreLabel = createLabel(
      'ClassicBestScoreLabel',
      input.fontResource.font,
      this.layout.bestScoreLabel,
      formatClassicBestScore(input.initialBestScore),
    );
    this.bestScoreLabel.node.setWorldPosition(
      this.layout.bestScoreCup.worldPosition.x
        + this.layout.bestScoreLabel.creatorLocalPosition.x,
      this.layout.bestScoreCup.worldPosition.y
        + this.layout.bestScoreLabel.creatorLocalPosition.y,
      0,
    );

    this.pendingDoubleLabel = createLabel(
      'ClassicPendingDoubleScoreLabel',
      input.fontResource.font,
      this.layout.pendingDoubleLabel,
      formatClassicPendingDoubleScore(0),
    );
    this.pendingDoubleLabel.node.setParent(this.doubleScorePanel.node);
    this.pendingDoubleLabel.node.setPosition(
      this.layout.pendingDoubleLabel.creatorLocalPosition.x,
      this.layout.pendingDoubleLabel.creatorLocalPosition.y,
      0,
    );
  }

  static create(
    input: ClassicScoreHudPresenterInput,
    lifecycle: ClassicScoreHudPresenterLifecycle,
  ): ClassicScoreHudPresenter {
    const presentation = assertInput(input);
    assertLifecycle(lifecycle);
    return new ClassicScoreHudPresenter(input, lifecycle, presentation);
  }

  get isAttached(): boolean {
    return this.attachedValue;
  }

  get isDisposed(): boolean {
    return this.disposedValue;
  }

  get state(): ClassicScoreHudPresenterState {
    return Object.freeze({
      attached: this.attachedValue,
      bestScore: this.bestScoreValue,
      bestScoreIsNewBest: this.bestScoreIsNewBestValue,
      displayedScore: this.displayedScoreValue,
      disposed: this.disposedValue,
      doubleScorePanelPhase: this.doubleScorePanelPhaseValue,
      entryElapsedActionSeconds: this.entryElapsedActionSecondsValue,
      pendingDoubleScore: this.pendingDoubleScoreValue,
      scoreIconScale: this.scoreIconScaleValue,
      scoreIconScalePhase: this.activeScoreIconScale?.direction ?? 'idle',
    });
  }

  attach(parent: Node): void {
    if (!isValid(parent, true) || !parent.activeInHierarchy) {
      throw new Error('Classic score-HUD parent must be valid and active');
    }
    if (this.disposedValue) {
      throw new Error('Disposed Classic score HUD cannot be attached');
    }
    if (this.attachedValue || this.rootNodes().some((node) => node.parent !== null)) {
      throw new Error('Classic score HUD is already attached');
    }

    for (const node of this.ownedNodes()) {
      node.layer = parent.layer;
    }
    const roots = this.rootNodes();
    for (let index = 0; index < roots.length; index += 1) {
      const node = roots[index];
      node.setParent(parent);
      // Native equal-z nodes draw by add order. Creator expresses that stable order with
      // consecutive sibling indices; best stays immediately after its fading cup.
      node.setSiblingIndex(this.layout.scoreIcon.zOrder + index);
    }
    this.doubleScoreViewportClip.node.active = true;
    this.doubleScorePanel.node.setSiblingIndex(this.layout.doubleScorePanel.zOrder);
    this.scoreIcon.node.active = true;
    this.bestScoreCup.node.active = true;
    this.liveScoreLabel.node.active = true;
    this.doubleScorePanel.node.active = true;
    this.pendingDoubleLabel.node.setSiblingIndex(this.layout.pendingDoubleLabel.zOrder);
    this.bestScoreLabel.node.active = true;
    this.pendingDoubleLabel.node.active = true;

    // Project Preview showed this active negative-x panel leaking outside the recovered play
    // area on a wide host canvas. Native contains it to the logical viewport while hidden.
    this.doubleScoreViewportClip.node.setWorldPosition(0, 0, 0);

    // The recovered formulas use the native lower-left world origin, not Canvas-local offsets.
    this.scoreIcon.node.setWorldPosition(
      this.layout.scoreIcon.worldPosition.x,
      this.layout.scoreIcon.worldPosition.y,
      0,
    );
    this.bestScoreCup.node.setWorldPosition(
      this.layout.bestScoreCup.worldPosition.x,
      this.layout.bestScoreCup.worldPosition.y,
      0,
    );
    // Creator always cascades UIOpacity to descendants. Keep the label as a visual sibling
    // so the cup's recovered fade does not add an unrecovered label fade.
    this.bestScoreLabel.node.setWorldPosition(
      this.layout.bestScoreCup.worldPosition.x
        + this.layout.bestScoreLabel.creatorLocalPosition.x,
      this.layout.bestScoreCup.worldPosition.y
        + this.layout.bestScoreLabel.creatorLocalPosition.y,
      0,
    );
    this.doubleScorePanel.node.setWorldPosition(
      this.layout.doubleScorePanel.hiddenWorldPosition.x,
      this.layout.doubleScorePanel.hiddenWorldPosition.y,
      0,
    );
    this.liveScoreLabel.node.setWorldPosition(
      this.layout.liveScoreLabel.worldPosition.x,
      this.layout.liveScoreLabel.worldPosition.y,
      0,
    );
    this.attachedValue = true;
  }

  updateAction(unscaledDeltaSeconds: number): void {
    assertNonNegativeFinite(unscaledDeltaSeconds, 'unscaledDeltaSeconds');
    if (this.disposedValue) {
      return;
    }
    this.assertActive('update actions');
    this.updateEntry(unscaledDeltaSeconds);
    this.updateDoubleScoreActions(unscaledDeltaSeconds);
    this.updateScoreIconScale(unscaledDeltaSeconds);
  }

  startDoubleScorePanelIntro(durationSeconds: number, activeDelaySeconds: number): void {
    this.assertActive('start double-score panel intro');
    assertExactActionValue(
      durationSeconds,
      this.layout.doubleScorePanel.moveActionSeconds,
      'durationSeconds',
    );
    assertExactActionValue(
      activeDelaySeconds,
      DOUBLE_SCORE_ACTIVE_SECONDS,
      'activeDelaySeconds',
    );
    const currentX = this.doubleScorePanel.node.worldPosition.x;
    this.doubleScorePanel.node.setWorldPosition(
      currentX,
      this.layout.doubleScorePanel.hiddenWorldPosition.y,
      0,
    );
    this.doubleScorePanel.node.active = true;
    this.pendingDoubleLabel.node.active = true;
    this.doubleScorePanelPhaseValue = 'entering';
    this.ensureDoubleScoreActionTarget('panel');
    this.activeDoubleScorePanelMoves.push({
      activeDelaySeconds,
      direction: 'entering',
      durationSeconds,
      earliestProgressUpdate: this.doubleScoreActionUpdate + 1,
      elapsedSeconds: 0,
      startX: currentX,
      targetX: this.layout.doubleScorePanel.shownWorldPosition.x,
    });
  }

  startDoubleScorePanelExit(durationSeconds: number): void {
    this.assertActive('start double-score panel exit');
    assertExactActionValue(
      durationSeconds,
      this.layout.doubleScorePanel.moveActionSeconds,
      'durationSeconds',
    );
    const currentX = this.doubleScorePanel.node.worldPosition.x;
    this.doubleScorePanelPhaseValue = 'exiting';
    this.ensureDoubleScoreActionTarget('panel');
    this.activeDoubleScorePanelMoves.push({
      activeDelaySeconds: null,
      direction: 'exiting',
      durationSeconds,
      earliestProgressUpdate: this.doubleScoreActionUpdate + 1,
      elapsedSeconds: 0,
      startX: currentX,
      targetX: this.layout.doubleScorePanel.hiddenWorldPosition.x,
    });
  }

  startScoreIconScaleUp(durationSeconds: number, targetScale: number): void {
    this.assertActive('start score-icon scale-up');
    this.assertNoActiveScoreIconScale();
    assertExactActionValue(
      durationSeconds,
      this.layout.scoreIconPulse.actionSecondsPerLeg,
      'durationSeconds',
    );
    assertExactActionValue(
      targetScale,
      this.layout.scoreIconPulse.apexScale,
      'targetScale',
    );
    if (this.scoreIconScaleValue !== this.layout.scoreIconPulse.restingScale) {
      throw new Error('Classic score-icon scale-up must start at the recovered resting scale');
    }
    this.activeScoreIconScale = {
      direction: 'up',
      durationSeconds,
      elapsedSeconds: 0,
      startScale: this.scoreIconScaleValue,
      targetScale,
    };
  }

  startScoreIconScaleDown(durationSeconds: number, targetScale: number): void {
    this.assertActive('start score-icon scale-down');
    this.assertNoActiveScoreIconScale();
    assertExactActionValue(
      durationSeconds,
      this.layout.scoreIconPulse.actionSecondsPerLeg,
      'durationSeconds',
    );
    assertExactActionValue(
      targetScale,
      this.layout.scoreIconPulse.restingScale,
      'targetScale',
    );
    if (this.scoreIconScaleValue !== this.layout.scoreIconPulse.apexScale) {
      throw new Error('Classic score-icon scale-down must start at the recovered apex scale');
    }
    this.activeScoreIconScale = {
      direction: 'down',
      durationSeconds,
      elapsedSeconds: 0,
      startScale: this.scoreIconScaleValue,
      targetScale,
    };
  }

  setDisplayedScore(value: number): void {
    this.assertActive('update the displayed score');
    const text = formatClassicUpdatedDisplayedScore(value);
    if (value === this.displayedScoreValue) {
      return;
    }
    this.liveScoreLabel.label.string = text;
    this.displayedScoreValue = value;
  }

  setBestScore(value: number, isNewBest: boolean): void {
    this.assertActive('update the best score');
    const color = classicBestScoreColor(isNewBest);
    this.bestScoreLabel.label.string = formatClassicBestScore(value);
    this.bestScoreLabel.label.color = creatorColor(color);
    this.bestScoreValue = value;
    this.bestScoreIsNewBestValue = isNewBest;
  }

  setPendingDoubleScore(value: number): void {
    this.assertActive('update the pending double score');
    this.pendingDoubleLabel.label.string = formatClassicPendingDoubleScore(value);
    this.pendingDoubleScoreValue = value;
  }

  /** Explicit scene-teardown path. Returns false after the first disposal. */
  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.attachedValue = false;
    this.activeDoubleScoreDelays.length = 0;
    this.activeDoubleScorePanelMoves.length = 0;
    this.delayActionTarget = null;
    this.panelActionTarget = null;
    this.activeScoreIconScale = null;
    for (const node of this.ownedNodes()) {
      if (isValid(node, true)) {
        node.destroy();
      }
    }
    return true;
  }

  private updateEntry(deltaSeconds: number): void {
    if (this.entryElapsedActionSecondsValue >= this.layout.entryActionSeconds) {
      return;
    }
    this.entryElapsedActionSecondsValue = Math.min(
      this.entryElapsedActionSecondsValue + deltaSeconds,
      this.layout.entryActionSeconds,
    );
    const progress = this.entryElapsedActionSecondsValue / this.layout.entryActionSeconds;
    const opacity = MAX_OPACITY * progress;
    this.scoreIcon.opacity.opacity = opacity;
    this.bestScoreCup.opacity.opacity = opacity;
  }

  private updateScoreIconScale(deltaSeconds: number): void {
    const action = this.activeScoreIconScale;
    if (action === null) {
      return;
    }

    action.elapsedSeconds = Math.min(
      action.elapsedSeconds + deltaSeconds,
      action.durationSeconds,
    );
    const progress = action.elapsedSeconds / action.durationSeconds;
    this.scoreIconScaleValue = lerp(action.startScale, action.targetScale, progress);
    this.scoreIcon.node.setScale(
      this.scoreIconScaleValue,
      this.scoreIconScaleValue,
      1,
    );

    if (action.elapsedSeconds < action.durationSeconds) {
      return;
    }

    // Clear before the callback so the scale-up callback can synchronously start scale-down.
    // Deliberately do not feed this tick's overshoot into that newly started phase.
    this.activeScoreIconScale = null;
    if (action.direction === 'up') {
      this.lifecycle.onScoreIconScaleUpComplete();
    } else {
      this.lifecycle.onScoreIconScaleDownComplete();
    }
  }

  private updateDoubleScoreActions(deltaSeconds: number): void {
    this.doubleScoreActionUpdate += 1;
    const processedTargetOrders = new Set<number>();
    while (true) {
      const nextTarget = [this.panelActionTarget, this.delayActionTarget]
        .filter((target): target is DoubleScoreActionTarget => (
          target !== null && !processedTargetOrders.has(target.order)
        ))
        .sort((left, right) => left.order - right.order)[0];
      if (nextTarget === undefined) {
        return;
      }
      processedTargetOrders.add(nextTarget.order);
      if (nextTarget.kind === 'panel') {
        this.updateDoubleScorePanelTarget(deltaSeconds, nextTarget.order);
      } else {
        this.updateDoubleScoreDelayTarget(deltaSeconds, nextTarget.order);
      }
    }
  }

  private updateDoubleScorePanelTarget(deltaSeconds: number, targetOrder: number): void {
    const completedIndices: number[] = [];
    const completedIntroDelays: number[] = [];
    for (let index = 0; index < this.activeDoubleScorePanelMoves.length; index += 1) {
      const action = this.activeDoubleScorePanelMoves[index];
      if (action.earliestProgressUpdate > this.doubleScoreActionUpdate) {
        this.doubleScorePanel.node.setWorldPosition(
          action.startX,
          this.layout.doubleScorePanel.hiddenWorldPosition.y,
          0,
        );
        continue;
      }
      action.elapsedSeconds = Math.min(
        action.elapsedSeconds + deltaSeconds,
        action.durationSeconds,
      );
      const progress = action.elapsedSeconds / action.durationSeconds;
      // Native ActionManager visits same-target actions by order of arrival; the newest
      // concurrent move therefore makes the final position write for this update.
      this.doubleScorePanel.node.setWorldPosition(
        lerp(action.startX, action.targetX, progress),
        this.layout.doubleScorePanel.hiddenWorldPosition.y,
        0,
      );
      if (action.elapsedSeconds === action.durationSeconds) {
        completedIndices.push(index);
        if (action.activeDelaySeconds !== null) {
          completedIntroDelays.push(action.activeDelaySeconds);
        }
      }
    }
    for (let index = completedIndices.length - 1; index >= 0; index -= 1) {
      this.activeDoubleScorePanelMoves.splice(completedIndices[index], 1);
    }
    for (const durationSeconds of completedIntroDelays) {
      this.ensureDoubleScoreActionTarget('delay');
      this.activeDoubleScoreDelays.push({
        durationSeconds,
        earliestProgressUpdate: this.doubleScoreActionUpdate + 1,
        elapsedSeconds: 0,
      });
    }
    if (
      this.activeDoubleScorePanelMoves.length === 0
      && this.panelActionTarget?.order === targetOrder
    ) {
      this.panelActionTarget = null;
    }
    this.refreshDoubleScorePanelPhase();
  }

  private updateDoubleScoreDelayTarget(deltaSeconds: number, targetOrder: number): void {
    const completedIndices: number[] = [];
    for (let index = 0; index < this.activeDoubleScoreDelays.length; index += 1) {
      const delay = this.activeDoubleScoreDelays[index];
      if (delay.earliestProgressUpdate > this.doubleScoreActionUpdate) {
        continue;
      }
      delay.elapsedSeconds = Math.min(
        delay.elapsedSeconds + deltaSeconds,
        delay.durationSeconds,
      );
      if (delay.elapsedSeconds === delay.durationSeconds) {
        completedIndices.push(index);
      }
    }
    for (let index = completedIndices.length - 1; index >= 0; index -= 1) {
      this.activeDoubleScoreDelays.splice(completedIndices[index], 1);
    }
    if (
      this.activeDoubleScoreDelays.length === 0
      && this.delayActionTarget?.order === targetOrder
    ) {
      this.delayActionTarget = null;
    }
    for (let index = 0; index < completedIndices.length; index += 1) {
      this.lifecycle.onDoubleScoreActiveDelayComplete();
    }
  }

  private ensureDoubleScoreActionTarget(kind: DoubleScoreActionTarget['kind']): void {
    const current = kind === 'panel' ? this.panelActionTarget : this.delayActionTarget;
    if (current !== null) {
      return;
    }
    const target: DoubleScoreActionTarget = {
      kind,
      order: this.doubleScoreActionTargetOrder,
    };
    this.doubleScoreActionTargetOrder += 1;
    if (kind === 'panel') {
      this.panelActionTarget = target;
    } else {
      this.delayActionTarget = target;
    }
  }

  private refreshDoubleScorePanelPhase(): void {
    const latestMove = this.activeDoubleScorePanelMoves[
      this.activeDoubleScorePanelMoves.length - 1
    ];
    if (latestMove !== undefined) {
      this.doubleScorePanelPhaseValue = latestMove.direction;
      return;
    }
    this.doubleScorePanelPhaseValue = (
      this.doubleScorePanel.node.worldPosition.x
        === this.layout.doubleScorePanel.hiddenWorldPosition.x
    ) ? 'hidden' : 'shown';
  }

  private assertNoActiveScoreIconScale(): void {
    if (this.activeScoreIconScale !== null) {
      throw new Error('Classic score-icon scale action is already active');
    }
  }

  private assertActive(action: string): void {
    if (this.disposedValue) {
      throw new Error(`Disposed Classic score HUD cannot ${action}`);
    }
    if (!this.attachedValue) {
      throw new Error(`Classic score HUD must be attached before it can ${action}`);
    }
  }

  private rootNodes(): readonly Node[] {
    return [
      this.scoreIcon.node,
      this.bestScoreCup.node,
      this.bestScoreLabel.node,
      this.doubleScoreViewportClip.node,
      this.liveScoreLabel.node,
    ];
  }

  private ownedNodes(): readonly Node[] {
    // Children precede their owning sprite so stubbed and Creator destruction both stay explicit.
    return [
      this.bestScoreLabel.node,
      this.pendingDoubleLabel.node,
      this.liveScoreLabel.node,
      this.scoreIcon.node,
      this.bestScoreCup.node,
      this.doubleScorePanel.node,
      this.doubleScoreViewportClip.node,
    ];
  }
}

function createViewportClip(
  viewport: ClassicScoreHudViewport,
): PresentedClassicScoreHudViewportClip {
  const node = new Node('ClassicDoubleScoreViewportClip');
  node.active = false;
  const transform = node.addComponent(UITransform);
  transform.setContentSize(viewport.width, viewport.height);
  transform.setAnchorPoint(0, 0);
  const mask = node.addComponent(Mask);
  // Cocos 3.8 initializes Mask as a non-inverted GRAPHICS_RECT on first activation.
  // Do not invoke Mask setters while this containment node is intentionally inactive.
  return Object.freeze({ mask, node, transform });
}

function createSprite(
  name: string,
  resource: LoadedClassicRasterResource,
): PresentedClassicScoreHudSprite {
  const node = new Node(name);
  node.active = false;
  const transform = node.addComponent(UITransform);
  transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
  transform.setAnchorPoint(0.5, 0.5);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  return Object.freeze({ node, sprite, transform });
}

function createFadingSprite(
  name: string,
  resource: LoadedClassicRasterResource,
  initialOpacity: 0 | 255,
): PresentedClassicScoreHudFadingSprite {
  const presented = createSprite(name, resource);
  const opacity = presented.node.addComponent(UIOpacity);
  opacity.opacity = initialOpacity;
  return Object.freeze({ ...presented, opacity });
}

function createLabel(
  name: string,
  font: Font,
  layout: ClassicScoreHudLabelLayout,
  text: string,
): PresentedClassicScoreHudLabel {
  const node = new Node(name);
  node.active = false;
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(layout.anchor.x, layout.anchor.y);
  const label = node.addComponent(Label);
  label.font = font;
  label.fontSize = layout.fontSize;
  // Creator's lineHeight does not follow fontSize automatically. Native CCLabelTTF's
  // unconstrained single-line height follows the requested point size.
  label.lineHeight = layout.fontSize;
  label.string = text;
  label.color = creatorColor(layout.color);
  return Object.freeze({ label, node, transform });
}

function assertInput(input: ClassicScoreHudPresenterInput): ClassicPresentationRasterSet {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('input must be an object');
  }
  formatClassicBestScore(input.initialBestScore);
  if (input.fontResource === null || typeof input.fontResource !== 'object') {
    throw new TypeError('fontResource must be an object');
  }
  if (input.fontResource.canonicalPath !== CLASSIC_SCORE_HUD_FONT_RESOURCE.canonicalPath) {
    throw new RangeError('fontResource must be the exact recovered Classic score font');
  }
  if (!isValid(input.fontResource.font, true)) {
    throw new Error('fontResource.font must be a valid loaded Creator Font');
  }
  const presentation = CLASSIC_ASSET_TREES
    .map((assetTree) => getClassicPresentationResources(assetTree))
    .find((candidate) => resourcesMatch(input, candidate));
  if (presentation === undefined) {
    throw new RangeError('Score-HUD resources must be the exact raster trio from one asset tree');
  }
  assertResource(input.scoreIconResource, presentation.scoreIcon, 'scoreIconResource');
  assertResource(
    input.bestScoreCupResource,
    presentation.bestScoreCup,
    'bestScoreCupResource',
  );
  assertResource(
    input.doubleScorePanelResource,
    presentation.doubleScorePanel,
    'doubleScorePanelResource',
  );
  createClassicScoreHudLayout(input.viewport, {
    bestScoreCup: presentation.bestScoreCup.dimensions,
    doubleScorePanel: presentation.doubleScorePanel.dimensions,
    scoreIcon: presentation.scoreIcon.dimensions,
  });
  return presentation;
}

function resourcesMatch(
  input: ClassicScoreHudPresenterInput,
  presentation: ClassicPresentationRasterSet,
): boolean {
  return input.scoreIconResource?.canonicalPath === presentation.scoreIcon.canonicalPath
    && input.bestScoreCupResource?.canonicalPath === presentation.bestScoreCup.canonicalPath
    && input.doubleScorePanelResource?.canonicalPath === presentation.doubleScorePanel.canonicalPath;
}

function assertResource(
  resource: LoadedClassicRasterResource,
  expected: ClassicRasterResource,
  label: string,
): void {
  if (resource === null || typeof resource !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
  if (
    resource.dimensions.width !== expected.dimensions.width
    || resource.dimensions.height !== expected.dimensions.height
  ) {
    throw new RangeError(`${label} dimensions must match the exact recovered raster`);
  }
  if (!isValid(resource.spriteFrame, true)) {
    throw new Error(`${label}.spriteFrame must be a valid loaded Creator SpriteFrame`);
  }
  const original = resource.spriteFrame.originalSize;
  const rect = resource.spriteFrame.rect;
  if (
    original.width !== expected.dimensions.width
    || original.height !== expected.dimensions.height
    || rect.width !== expected.dimensions.width
    || rect.height !== expected.dimensions.height
  ) {
    throw new RangeError(`${label}.spriteFrame must preserve exact untrimmed raster geometry`);
  }
}

function assertLifecycle(lifecycle: ClassicScoreHudPresenterLifecycle): void {
  if (lifecycle === null || typeof lifecycle !== 'object') {
    throw new TypeError('lifecycle must be an object');
  }
  if (typeof lifecycle.onDoubleScoreActiveDelayComplete !== 'function') {
    throw new TypeError('onDoubleScoreActiveDelayComplete must be a function');
  }
  if (typeof lifecycle.onScoreIconScaleUpComplete !== 'function') {
    throw new TypeError('onScoreIconScaleUpComplete must be a function');
  }
  if (typeof lifecycle.onScoreIconScaleDownComplete !== 'function') {
    throw new TypeError('onScoreIconScaleDownComplete must be a function');
  }
}

function assertExactActionValue(value: number, expected: number, label: string): void {
  if (!Number.isFinite(value) || value !== expected) {
    throw new RangeError(`${label} must match the recovered score-icon action`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function creatorColor(color: ClassicScoreHudRgb): Color {
  return new Color(color.r, color.g, color.b, MAX_OPACITY);
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
