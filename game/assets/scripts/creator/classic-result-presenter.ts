import {
  Color,
  Font,
  Label,
  Node,
  Sprite,
  UIOpacity,
  UITransform,
  isValid,
} from 'cc';

import {
  CLASSIC_RESULT_WHITE,
  createClassicResultLayout,
  formatClassicResultScore,
  type ClassicResultAnimatedNodeLayout,
  type ClassicResultLabelLayout,
  type ClassicResultLayout,
  type ClassicResultRgb,
  type ClassicResultViewport,
} from '../domain/classic-result-presentation';
import type { ClassicResultParticleExplosionRandom } from '../domain/classic-result-particle-explosion';
import {
  CLASSIC_RESULT_FONT_RESOURCES,
  getClassicResultResources,
  type ClassicRasterResource,
  type ClassicResultRasterSet,
} from '../domain/classic-resource-contract';
import type {
  LoadedClassicFontResource,
  LoadedClassicRasterResource,
  LoadedClassicResultFonts,
  LoadedClassicResultResources,
} from './classic-resource-loader';
import { ClassicResultParticleExplosionPresenter } from './classic-result-particle-explosion-presenter';
import { ClassicResultRewardPresenter } from './classic-result-reward-presenter';

const CLASSIC_ASSET_TREES = Object.freeze(['480x800', '720x1280'] as const);
const MAX_OPACITY = 255;

/** Values are already ordered for the three recovered visual slots. */
export type ClassicResultPanelValues = readonly [number, number, number];

export interface ClassicResultPresenterInput {
  readonly completedRunScore: number;
  readonly fonts: LoadedClassicResultFonts;
  /** Visual order is ClassicBest_1, ClassicBest_2, ClassicBest_3. */
  readonly panelValues: ClassicResultPanelValues;
  readonly random: ClassicResultParticleExplosionRandom;
  readonly resources: LoadedClassicResultResources;
  readonly totalCoins: number;
  readonly viewport: ClassicResultViewport;
}

export interface ClassicResultPresenterLifecycle {
  readonly onMenu: () => void;
  readonly onRankPresentationBoundary: () => void;
  readonly onRetry: () => void;
  /** Returns the already-accounted native signed-int32 bonus for the reward label. */
  readonly onTotalCoinsEntranceComplete: () => number;
}

export interface PresentedClassicResultSprite {
  readonly node: Node;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

export interface PresentedClassicResultFadingSprite extends PresentedClassicResultSprite {
  readonly opacity: UIOpacity;
}

export interface PresentedClassicResultButton extends PresentedClassicResultFadingSprite {
  readonly normalResource: LoadedClassicRasterResource;
  readonly selectedResource: LoadedClassicRasterResource;
}

export interface PresentedClassicResultLabel {
  readonly label: Label;
  readonly node: Node;
  readonly transform: UITransform;
}

export type ClassicResultNavigation = 'menu' | 'none' | 'retry';

export interface ClassicResultPresenterState {
  readonly attached: boolean;
  readonly disposed: boolean;
  readonly navigation: ClassicResultNavigation;
  readonly particleBurstStarted: boolean;
  readonly rewardPresented: boolean;
  readonly scorePanelElapsedActionSeconds: number;
  readonly shellElapsedActionSeconds: number;
  readonly totalCoinsElapsedActionSeconds: number;
  readonly totalCoinsEntranceComplete: boolean;
}

type PanelLabelTuple = readonly [
  PresentedClassicResultLabel,
  PresentedClassicResultLabel,
  PresentedClassicResultLabel,
];

/** Exact recovered Classic result-shell visuals and entrance actions at the Creator boundary. */
export class ClassicResultPresenter {
  readonly layout: ClassicResultLayout;
  readonly mainScoreLabel: PresentedClassicResultLabel;
  readonly medalNone: PresentedClassicResultFadingSprite;
  readonly menuButton: PresentedClassicResultButton;
  readonly panelLabels: PanelLabelTuple;
  readonly particleExplosionPresenter: ClassicResultParticleExplosionPresenter;
  readonly resultHeader: PresentedClassicResultFadingSprite;
  readonly retryButton: PresentedClassicResultButton;
  readonly rewardPresenter: ClassicResultRewardPresenter;
  readonly scorePanel: PresentedClassicResultFadingSprite;
  readonly totalCoinsLabel: PresentedClassicResultLabel;
  readonly totalCoinsPanel: PresentedClassicResultFadingSprite;

  private attachedValue = false;
  private disposedValue = false;
  private readonly lifecycle: ClassicResultPresenterLifecycle;
  private navigationValue: ClassicResultNavigation = 'none';
  private scorePanelElapsedActionSecondsValue = 0;
  private shellElapsedActionSecondsValue = 0;
  private totalCoinsElapsedActionSecondsValue = 0;
  private totalCoinsEntranceCompleteValue = false;

  private constructor(
    input: ClassicResultPresenterInput,
    lifecycle: ClassicResultPresenterLifecycle,
    presentation: ClassicResultRasterSet,
  ) {
    this.lifecycle = lifecycle;
    this.layout = createClassicResultLayout(input.viewport, {
      medalNone: presentation.medalNone.dimensions,
      menuButton: presentation.menuNormal.dimensions,
      resultHeader: presentation.header.dimensions,
      retryButton: presentation.retryNormal.dimensions,
      scorePanel: presentation.background.dimensions,
      totalCoinsPanel: presentation.totalCoins.dimensions,
    });

    // Keep this construction sequence aligned with DisplayScoreLayer::onEnter. All labels
    // remain visual siblings because Creator UIOpacity cascades through descendants.
    this.scorePanel = createFadingSprite(
      'ClassicResultScorePanel',
      input.resources.background,
      this.layout.scorePanel,
    );
    this.mainScoreLabel = createLabel(
      'ClassicResultScoreLabel',
      input.fonts.agencyB.font,
      this.layout.mainScoreLabel,
      formatClassicResultScore(input.completedRunScore),
      this.layout.mainScoreLabel.color,
    );
    this.mainScoreLabel.node.setWorldPosition(
      this.layout.mainScoreLabel.worldPosition.x,
      this.layout.mainScoreLabel.worldPosition.y,
      0,
    );
    this.resultHeader = createFadingSprite(
      'ClassicResultHeader',
      input.resources.header,
      this.layout.resultHeader,
    );
    this.retryButton = createButton(
      'ClassicResultRetryButton',
      input.resources.retryNormal,
      input.resources.retrySelected,
      this.layout.retryButton,
    );
    this.menuButton = createButton(
      'ClassicResultMenuButton',
      input.resources.menuNormal,
      input.resources.menuSelected,
      this.layout.menuButton,
    );
    this.medalNone = createFadingSprite(
      'ClassicResultMedalNone',
      input.resources.medalNone,
      this.layout.medalNone,
    );
    try {
      // Native rank/cup work occurs after the core shell exists and before the remaining
      // labels and coin entrance are constructed. The caller owns that behavior.
      this.lifecycle.onRankPresentationBoundary();
    } catch (error) {
      // Construction never returns a presenter on callback failure. Release the exact partial
      // shell now; later visuals and touch listeners have deliberately not been created yet.
      for (const node of this.coreShellNodes()) {
        if (isValid(node, true)) {
          node.destroy();
        }
      }
      throw error;
    }
    this.panelLabels = Object.freeze(this.layout.panelLabels.map((layout, index) => {
      const label = createLabel(
        `ClassicResultPanelLabel-${index + 1}`,
        input.fonts.agencyB.font,
        layout,
        String(input.panelValues[index]),
        layout.color,
      );
      label.node.setWorldPosition(
        this.layout.scorePanel.initial.worldPosition.x + layout.creatorLocalPosition.x,
        this.layout.scorePanel.initial.worldPosition.y + layout.creatorLocalPosition.y,
        0,
      );
      return label;
    })) as PanelLabelTuple;
    this.totalCoinsPanel = createFadingSprite(
      'ClassicResultTotalCoinsPanel',
      input.resources.totalCoins,
      this.layout.totalCoinsPanel,
    );
    this.particleExplosionPresenter = ClassicResultParticleExplosionPresenter.create({
      random: input.random,
      resource: input.resources.bonusParticle,
      viewport: input.viewport,
    });
    this.totalCoinsLabel = createLabel(
      'ClassicResultTotalCoinsLabel',
      input.fonts.slabThing.font,
      this.layout.totalCoinsLabel,
      String(input.totalCoins),
      CLASSIC_RESULT_WHITE,
    );
    this.positionTotalCoinsLabel();
    this.rewardPresenter = ClassicResultRewardPresenter.create({
      badgeResource: input.resources.bonusCoinsBadge,
      coinResource: input.resources.coin,
      effectResource: input.resources.bonusCoinsEffect,
      fontResource: input.fonts.slabThing,
      viewport: input.viewport,
    }, {
      onAwardCoins: lifecycle.onTotalCoinsEntranceComplete,
    });

    this.registerButtonEvents();
  }

  static create(
    input: ClassicResultPresenterInput,
    lifecycle: ClassicResultPresenterLifecycle,
  ): ClassicResultPresenter {
    const presentation = assertInput(input);
    assertLifecycle(lifecycle);
    return new ClassicResultPresenter(input, lifecycle, presentation);
  }

  get isAttached(): boolean {
    return this.attachedValue;
  }

  get isDisposed(): boolean {
    return this.disposedValue;
  }

  get state(): ClassicResultPresenterState {
    return Object.freeze({
      attached: this.attachedValue,
      disposed: this.disposedValue,
      navigation: this.navigationValue,
      particleBurstStarted: this.particleExplosionPresenter.state.burstStarted,
      rewardPresented: this.rewardPresenter.state.presented,
      scorePanelElapsedActionSeconds: this.scorePanelElapsedActionSecondsValue,
      shellElapsedActionSeconds: this.shellElapsedActionSecondsValue,
      totalCoinsElapsedActionSeconds: this.totalCoinsElapsedActionSecondsValue,
      totalCoinsEntranceComplete: this.totalCoinsEntranceCompleteValue,
    });
  }

  /** Reopens navigation only when a Creator adapter reports that its selected route failed. */
  rearmNavigationAfterFailure(
    expectedNavigation: Exclude<ClassicResultNavigation, 'none'>,
  ): boolean {
    if (expectedNavigation !== 'menu' && expectedNavigation !== 'retry') {
      throw new RangeError('Expected failed result navigation must be menu or retry');
    }
    if (
      this.disposedValue
      || !this.attachedValue
      || this.navigationValue !== expectedNavigation
    ) {
      return false;
    }
    this.navigationValue = 'none';
    this.normalizeButtonResources();
    return true;
  }

  attach(parent: Node): void {
    if (!isValid(parent, true) || !parent.activeInHierarchy) {
      throw new Error('Classic result-presenter parent must be valid and active');
    }
    if (this.disposedValue) {
      throw new Error('Disposed Classic result presenter cannot be attached');
    }
    if (this.attachedValue || this.rootNodes().some((node) => node.parent !== null)) {
      throw new Error('Classic result presenter is already attached');
    }

    const roots = this.rootNodes();
    for (let index = 0; index < roots.length; index += 1) {
      const node = roots[index];
      node.layer = parent.layer;
      node.setParent(parent);
      // Native nodes share z=1 and therefore draw by add order. Consecutive requested
      // sibling indices preserve that order even when the target already owns children.
      node.setSiblingIndex(this.layout.scorePanel.zOrder + index);
      node.active = true;
    }
    this.resetWorldPresentation();
    this.particleExplosionPresenter.attachBetween(
      parent,
      this.totalCoinsPanel.node,
      this.totalCoinsLabel.node,
    );
    this.attachedValue = true;
  }

  updateAction(unscaledDeltaSeconds: number): void {
    assertNonNegativeFinite(unscaledDeltaSeconds, 'unscaledDeltaSeconds');
    if (this.disposedValue) {
      return;
    }
    this.assertActive('update actions');

    if (this.totalCoinsEntranceCompleteValue) {
      this.advanceActionSegment(unscaledDeltaSeconds);
      return;
    }

    const secondsUntilReward = Math.max(
      0,
      this.layout.totalCoinsPanel.actionSeconds
        - this.totalCoinsElapsedActionSecondsValue,
    );
    const leadingSeconds = Math.min(unscaledDeltaSeconds, secondsUntilReward);
    this.advanceActionSegment(leadingSeconds);

    if (
      this.totalCoinsElapsedActionSecondsValue
      === this.layout.totalCoinsPanel.actionSeconds
    ) {
      this.presentRewardAtEntranceBoundary();
    }

    const trailingSeconds = unscaledDeltaSeconds - leadingSeconds;
    if (trailingSeconds > 0) {
      this.advanceActionSegment(trailingSeconds);
    }
  }

  private advanceActionSegment(unscaledDeltaSeconds: number): void {
    this.particleExplosionPresenter.updateAction(unscaledDeltaSeconds);
    this.rewardPresenter.updateAction(unscaledDeltaSeconds);

    this.scorePanelElapsedActionSecondsValue = advanceAction(
      this.scorePanelElapsedActionSecondsValue,
      unscaledDeltaSeconds,
      this.layout.scorePanel.actionSeconds,
    );
    applyAnimatedSprite(
      this.scorePanel,
      this.layout.scorePanel,
      this.scorePanelElapsedActionSecondsValue,
    );

    this.shellElapsedActionSecondsValue = advanceAction(
      this.shellElapsedActionSecondsValue,
      unscaledDeltaSeconds,
      this.layout.resultHeader.actionSeconds,
    );
    for (const [presented, layout] of [
      [this.resultHeader, this.layout.resultHeader],
      [this.retryButton, this.layout.retryButton],
      [this.menuButton, this.layout.menuButton],
      [this.medalNone, this.layout.medalNone],
    ] as const) {
      applyAnimatedSprite(presented, layout, this.shellElapsedActionSecondsValue);
    }

    this.totalCoinsElapsedActionSecondsValue = advanceAction(
      this.totalCoinsElapsedActionSecondsValue,
      unscaledDeltaSeconds,
      this.layout.totalCoinsPanel.actionSeconds,
    );
    applyAnimatedSprite(
      this.totalCoinsPanel,
      this.layout.totalCoinsPanel,
      this.totalCoinsElapsedActionSecondsValue,
    );
    this.positionTotalCoinsLabel();
  }

  private presentRewardAtEntranceBoundary(): void {
    this.totalCoinsEntranceCompleteValue = true;
    const parent = this.totalCoinsPanel.node.parent;
    if (parent === null || !isValid(parent, true) || !parent.activeInHierarchy) {
      throw new Error('Classic result reward requires the active result parent');
    }
    this.rewardPresenter.present(parent);
  }

  /** Explicit scene-teardown path. Returns false after the first disposal. */
  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.attachedValue = false;
    this.unregisterButtonEvents();
    this.rewardPresenter.dispose();
    this.particleExplosionPresenter.dispose();
    for (const node of this.rootNodes()) {
      if (isValid(node, true)) {
        node.destroy();
      }
    }
    return true;
  }

  private readonly onRetryTouchStart = (): void => {
    if (this.canStartButtonTouch()) {
      applyButtonResource(this.retryButton, this.retryButton.selectedResource);
    }
  };

  private readonly onRetryTouchEnd = (): void => {
    if (!this.canResetButtonTouch()) {
      return;
    }
    applyButtonResource(this.retryButton, this.retryButton.normalResource);
    this.navigate('retry');
  };

  private readonly onRetryTouchCancel = (): void => {
    if (this.canResetButtonTouch()) {
      applyButtonResource(this.retryButton, this.retryButton.normalResource);
    }
  };

  private readonly onMenuTouchStart = (): void => {
    if (this.canStartButtonTouch()) {
      applyButtonResource(this.menuButton, this.menuButton.selectedResource);
    }
  };

  private readonly onMenuTouchEnd = (): void => {
    if (!this.canResetButtonTouch()) {
      return;
    }
    applyButtonResource(this.menuButton, this.menuButton.normalResource);
    this.navigate('menu');
  };

  private readonly onMenuTouchCancel = (): void => {
    if (this.canResetButtonTouch()) {
      applyButtonResource(this.menuButton, this.menuButton.normalResource);
    }
  };

  private registerButtonEvents(): void {
    this.retryButton.node.on(Node.EventType.TOUCH_START, this.onRetryTouchStart, this);
    this.retryButton.node.on(Node.EventType.TOUCH_END, this.onRetryTouchEnd, this);
    this.retryButton.node.on(Node.EventType.TOUCH_CANCEL, this.onRetryTouchCancel, this);
    this.menuButton.node.on(Node.EventType.TOUCH_START, this.onMenuTouchStart, this);
    this.menuButton.node.on(Node.EventType.TOUCH_END, this.onMenuTouchEnd, this);
    this.menuButton.node.on(Node.EventType.TOUCH_CANCEL, this.onMenuTouchCancel, this);
  }

  private unregisterButtonEvents(): void {
    if (isValid(this.retryButton.node, true)) {
      this.retryButton.node.off(Node.EventType.TOUCH_START, this.onRetryTouchStart, this);
      this.retryButton.node.off(Node.EventType.TOUCH_END, this.onRetryTouchEnd, this);
      this.retryButton.node.off(Node.EventType.TOUCH_CANCEL, this.onRetryTouchCancel, this);
    }
    if (isValid(this.menuButton.node, true)) {
      this.menuButton.node.off(Node.EventType.TOUCH_START, this.onMenuTouchStart, this);
      this.menuButton.node.off(Node.EventType.TOUCH_END, this.onMenuTouchEnd, this);
      this.menuButton.node.off(Node.EventType.TOUCH_CANCEL, this.onMenuTouchCancel, this);
    }
  }

  private canStartButtonTouch(): boolean {
    return this.attachedValue && !this.disposedValue && this.navigationValue === 'none';
  }

  private canResetButtonTouch(): boolean {
    return this.attachedValue && !this.disposedValue;
  }

  private navigate(destination: Exclude<ClassicResultNavigation, 'none'>): void {
    if (!this.canStartButtonTouch()) {
      return;
    }
    // Set the shared guard before invoking external lifecycle code, including re-entrant code.
    this.navigationValue = destination;
    // Two touch IDs can press both menu items before either ends. Normalize both visuals so
    // the non-winning item cannot remain selected when menu navigation keeps this screen alive.
    this.normalizeButtonResources();
    if (destination === 'retry') {
      this.lifecycle.onRetry();
    } else {
      this.lifecycle.onMenu();
    }
  }

  private positionTotalCoinsLabel(): void {
    this.totalCoinsLabel.node.setWorldPosition(
      this.totalCoinsPanel.node.worldPosition.x
        + this.layout.totalCoinsLabel.creatorLocalPosition.x,
      this.totalCoinsPanel.node.worldPosition.y
        + this.layout.totalCoinsLabel.creatorLocalPosition.y,
      0,
    );
  }

  private normalizeButtonResources(): void {
    applyButtonResource(this.retryButton, this.retryButton.normalResource);
    applyButtonResource(this.menuButton, this.menuButton.normalResource);
  }

  private resetWorldPresentation(): void {
    for (const [presented, layout] of [
      [this.scorePanel, this.layout.scorePanel],
      [this.resultHeader, this.layout.resultHeader],
      [this.retryButton, this.layout.retryButton],
      [this.menuButton, this.layout.menuButton],
      [this.medalNone, this.layout.medalNone],
      [this.totalCoinsPanel, this.layout.totalCoinsPanel],
    ] as const) {
      applyAnimatedSprite(presented, layout, 0);
    }
    this.mainScoreLabel.node.setWorldPosition(
      this.layout.mainScoreLabel.worldPosition.x,
      this.layout.mainScoreLabel.worldPosition.y,
      0,
    );
    for (let index = 0; index < this.panelLabels.length; index += 1) {
      const layout = this.layout.panelLabels[index];
      this.panelLabels[index].node.setWorldPosition(
        this.layout.scorePanel.initial.worldPosition.x + layout.creatorLocalPosition.x,
        this.layout.scorePanel.initial.worldPosition.y + layout.creatorLocalPosition.y,
        0,
      );
    }
    this.positionTotalCoinsLabel();
  }

  private assertActive(action: string): void {
    if (this.disposedValue) {
      throw new Error(`Disposed Classic result presenter cannot ${action}`);
    }
    if (!this.attachedValue) {
      throw new Error(`Classic result presenter must be attached before it can ${action}`);
    }
  }

  private coreShellNodes(): readonly Node[] {
    return [
      this.scorePanel.node,
      this.mainScoreLabel.node,
      this.resultHeader.node,
      this.retryButton.node,
      this.menuButton.node,
      this.medalNone.node,
    ];
  }

  private rootNodes(): readonly Node[] {
    return [
      ...this.coreShellNodes(),
      ...this.panelLabels.map(({ node }) => node),
      this.totalCoinsPanel.node,
      this.totalCoinsLabel.node,
    ];
  }
}

function createFadingSprite(
  name: string,
  resource: LoadedClassicRasterResource,
  layout: ClassicResultAnimatedNodeLayout,
): PresentedClassicResultFadingSprite {
  const node = new Node(name);
  node.active = false;
  const transform = node.addComponent(UITransform);
  transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
  transform.setAnchorPoint(layout.anchor.x, layout.anchor.y);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  const opacity = node.addComponent(UIOpacity);
  const presented = Object.freeze({ node, opacity, sprite, transform });
  applyAnimatedSprite(presented, layout, 0);
  return presented;
}

function createButton(
  name: string,
  normalResource: LoadedClassicRasterResource,
  selectedResource: LoadedClassicRasterResource,
  layout: ClassicResultAnimatedNodeLayout,
): PresentedClassicResultButton {
  return Object.freeze({
    ...createFadingSprite(name, normalResource, layout),
    normalResource,
    selectedResource,
  });
}

function createLabel(
  name: string,
  font: Font,
  layout: Pick<ClassicResultLabelLayout, 'anchor' | 'fontSize'>,
  text: string,
  color: ClassicResultRgb,
): PresentedClassicResultLabel {
  const node = new Node(name);
  node.active = false;
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(layout.anchor.x, layout.anchor.y);
  const label = node.addComponent(Label);
  label.font = font;
  label.fontSize = layout.fontSize;
  label.lineHeight = layout.fontSize;
  label.string = text;
  label.color = creatorColor(color);
  return Object.freeze({ label, node, transform });
}

function applyAnimatedSprite(
  presented: PresentedClassicResultFadingSprite,
  layout: ClassicResultAnimatedNodeLayout,
  elapsedSeconds: number,
): void {
  const progress = elapsedSeconds / layout.actionSeconds;
  presented.node.setWorldPosition(
    lerp(layout.initial.worldPosition.x, layout.final.worldPosition.x, progress),
    lerp(layout.initial.worldPosition.y, layout.final.worldPosition.y, progress),
    0,
  );
  const scale = lerp(layout.initial.scale, layout.final.scale, progress);
  presented.node.setScale(scale, scale, 1);
  presented.opacity.opacity = lerp(
    layout.initial.opacity,
    layout.final.opacity,
    progress,
  );
}

function applyButtonResource(
  button: PresentedClassicResultButton,
  resource: LoadedClassicRasterResource,
): void {
  button.sprite.spriteFrame = resource.spriteFrame;
  button.transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
}

function assertInput(input: ClassicResultPresenterInput): ClassicResultRasterSet {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('input must be an object');
  }
  formatClassicResultScore(input.completedRunScore);
  assertPanelValues(input.panelValues);
  assertSignedInt32(input.completedRunScore, 'completedRunScore');
  assertSignedInt32(input.totalCoins, 'totalCoins');
  if (
    input.random === null
    || typeof input.random !== 'object'
    || typeof input.random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive(minimum, maximum)');
  }
  const presentation = assertResources(input.resources);
  assertFonts(input.fonts);
  createClassicResultLayout(input.viewport, {
    medalNone: presentation.medalNone.dimensions,
    menuButton: presentation.menuNormal.dimensions,
    resultHeader: presentation.header.dimensions,
    retryButton: presentation.retryNormal.dimensions,
    scorePanel: presentation.background.dimensions,
    totalCoinsPanel: presentation.totalCoins.dimensions,
  });
  return presentation;
}

function assertResources(resources: LoadedClassicResultResources): ClassicResultRasterSet {
  if (resources === null || typeof resources !== 'object') {
    throw new TypeError('resources must be an object');
  }
  const presentation = CLASSIC_ASSET_TREES
    .map((assetTree) => getClassicResultResources(assetTree))
    .find((candidate) => resourcesMatch(resources, candidate));
  if (presentation === undefined) {
    throw new RangeError('Result resources must be the exact raster set from one asset tree');
  }
  for (const key of [
    'background',
    'bonusCoinsBadge',
    'bonusCoinsEffect',
    'bonusParticle',
    'coin',
    'header',
    'medalNone',
    'menuNormal',
    'menuSelected',
    'retryNormal',
    'retrySelected',
    'totalCoins',
  ] as const) {
    assertResource(resources[key], presentation[key], `resources.${key}`);
  }
  return presentation;
}

function resourcesMatch(
  resources: LoadedClassicResultResources,
  expected: ClassicResultRasterSet,
): boolean {
  return resources.background?.canonicalPath === expected.background.canonicalPath
    && resources.bonusCoinsBadge?.canonicalPath === expected.bonusCoinsBadge.canonicalPath
    && resources.bonusCoinsEffect?.canonicalPath === expected.bonusCoinsEffect.canonicalPath
    && resources.bonusParticle?.canonicalPath === expected.bonusParticle.canonicalPath
    && resources.coin?.canonicalPath === expected.coin.canonicalPath
    && resources.header?.canonicalPath === expected.header.canonicalPath
    && resources.medalNone?.canonicalPath === expected.medalNone.canonicalPath
    && resources.menuNormal?.canonicalPath === expected.menuNormal.canonicalPath
    && resources.menuSelected?.canonicalPath === expected.menuSelected.canonicalPath
    && resources.retryNormal?.canonicalPath === expected.retryNormal.canonicalPath
    && resources.retrySelected?.canonicalPath === expected.retrySelected.canonicalPath
    && resources.totalCoins?.canonicalPath === expected.totalCoins.canonicalPath;
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
    resource.dimensions?.width !== expected.dimensions.width
    || resource.dimensions?.height !== expected.dimensions.height
  ) {
    throw new RangeError(`${label} dimensions must match the exact recovered raster`);
  }
  if (!isValid(resource.spriteFrame, true)) {
    throw new Error(`${label}.spriteFrame must be a valid loaded Creator SpriteFrame`);
  }
  const original = resource.spriteFrame.originalSize;
  const rect = resource.spriteFrame.rect;
  if (
    original?.width !== expected.dimensions.width
    || original?.height !== expected.dimensions.height
    || rect?.width !== expected.dimensions.width
    || rect?.height !== expected.dimensions.height
  ) {
    throw new RangeError(`${label}.spriteFrame must preserve exact untrimmed raster geometry`);
  }
}

function assertFonts(fonts: LoadedClassicResultFonts): void {
  if (fonts === null || typeof fonts !== 'object') {
    throw new TypeError('fonts must be an object');
  }
  assertFont(fonts.agencyB, CLASSIC_RESULT_FONT_RESOURCES.agencyB.canonicalPath, 'fonts.agencyB');
  assertFont(
    fonts.slabThing,
    CLASSIC_RESULT_FONT_RESOURCES.slabThing.canonicalPath,
    'fonts.slabThing',
  );
}

function assertFont(
  resource: LoadedClassicFontResource,
  expectedCanonicalPath: string,
  label: string,
): void {
  if (resource === null || typeof resource !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
  if (resource.canonicalPath !== expectedCanonicalPath) {
    throw new RangeError(`${label} must be the exact recovered Classic result font`);
  }
  if (!isValid(resource.font, true)) {
    throw new Error(`${label}.font must be a valid loaded Creator Font`);
  }
}

function assertPanelValues(values: ClassicResultPanelValues): void {
  if (!Array.isArray(values) || values.length !== 3) {
    throw new TypeError('panelValues must contain exactly three values in visual order');
  }
  for (let index = 0; index < values.length; index += 1) {
    assertSignedInt32(values[index], `panelValues[${index}]`);
  }
}

function assertLifecycle(lifecycle: ClassicResultPresenterLifecycle): void {
  if (lifecycle === null || typeof lifecycle !== 'object') {
    throw new TypeError('lifecycle must be an object');
  }
  if (typeof lifecycle.onRetry !== 'function') {
    throw new TypeError('onRetry must be a function');
  }
  if (typeof lifecycle.onMenu !== 'function') {
    throw new TypeError('onMenu must be a function');
  }
  if (typeof lifecycle.onRankPresentationBoundary !== 'function') {
    throw new TypeError('onRankPresentationBoundary must be a function');
  }
  if (typeof lifecycle.onTotalCoinsEntranceComplete !== 'function') {
    throw new TypeError('onTotalCoinsEntranceComplete must be a function');
  }
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}

function assertSignedInt32(value: number, label: string): void {
  assertSafeInteger(value, label);
  if (value < -0x8000_0000 || value > 0x7fff_ffff) {
    throw new RangeError(`${label} must fit a signed 32-bit integer`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function advanceAction(current: number, delta: number, duration: number): number {
  return Math.min(current + delta, duration);
}

function creatorColor(color: ClassicResultRgb): Color {
  return new Color(color.r, color.g, color.b, MAX_OPACITY);
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
