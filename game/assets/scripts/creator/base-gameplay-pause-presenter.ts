import {
  Color,
  Graphics,
  Label,
  Node,
  Sprite,
  UITransform,
  director,
  isValid,
} from 'cc';

import {
  BASE_GAMEPLAY_PAUSE_OVERLAY_OPACITY,
  BASE_GAMEPLAY_PAUSE_Z_ORDER,
  BaseGameplayPauseState,
  type BaseGameplayPauseActionCommand,
  type BaseGameplayPauseLayout,
  type BaseGameplayPauseObjectiveCard,
  type BaseGameplayPauseSnapshot,
} from '../domain/base-gameplay-pause-state';
import {
  BASE_GAMEPLAY_ARIAL_FONT_RESOURCE,
  getBaseGameplayResourceProfile,
} from '../domain/base-gameplay-resource-contract';
import type { GameRasterResource } from '../domain/game-resource-contract';
import type {
  LoadedBaseGameplayResources,
  LoadedBaseGameplayPauseResources,
} from './base-gameplay-resource-loader';
import type { LoadedGameRasterResource } from './game-resource-loader';

const OPAQUE = 255;

export interface BaseGameplayPauseViewport {
  readonly height: number;
  readonly width: number;
}

export interface BaseGameplayPausePresenterInput {
  readonly contentScaleFactor: number;
  readonly initialCard: BaseGameplayPauseObjectiveCard;
  readonly resources: LoadedBaseGameplayResources;
  readonly viewport: BaseGameplayPauseViewport;
}

/**
 * Host-owned effects and navigation intents. The presenter deliberately does not own audio,
 * replay construction, scene replacement, or shell routing.
 */
export interface BaseGameplayPausePresenterIntents {
  readonly onPauseRequested: () => void;
  readonly onQuitRequested: () => void;
  readonly onReplayRequested: () => void;
  readonly onResumeRequested: () => void;
}

export interface PresentedBaseGameplayPauseContainer {
  readonly node: Node;
  readonly transform: UITransform;
}

export interface PresentedBaseGameplayPauseOverlay
  extends PresentedBaseGameplayPauseContainer {
  readonly graphics: Graphics;
  readonly opacity: typeof BASE_GAMEPLAY_PAUSE_OVERLAY_OPACITY;
}

export interface PresentedBaseGameplayPauseSprite {
  readonly node: Node;
  readonly resource: LoadedGameRasterResource;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

export interface PresentedBaseGameplayPauseButton
  extends Omit<PresentedBaseGameplayPauseSprite, 'resource'> {
  readonly normalResource: LoadedGameRasterResource;
  readonly selectedResource: LoadedGameRasterResource;
}

export interface PresentedBaseGameplayPauseLabel {
  readonly label: Label;
  readonly node: Node;
  readonly transform: UITransform;
}

type PauseMenuKind = 'options' | 'pause';

/**
 * Exact shared BaseGameplayLayer pause projection at the Creator boundary.
 *
 * BaseGameplayPauseState remains authoritative for recovered clocks, overlapping actions,
 * enabled/visible flags, and the director-pause ownership lease.
 */
export class BaseGameplayPausePresenter {
  readonly descriptionLabel: PresentedBaseGameplayPauseLabel;
  readonly layout: BaseGameplayPauseLayout;
  readonly objectiveBackground: PresentedBaseGameplayPauseSprite;
  readonly objectiveOverlay: PresentedBaseGameplayPauseOverlay;
  readonly optionsMenu: PresentedBaseGameplayPauseContainer;
  readonly pauseButton: PresentedBaseGameplayPauseButton;
  readonly pauseMenu: PresentedBaseGameplayPauseContainer;
  readonly progressLabel: PresentedBaseGameplayPauseLabel;
  readonly quitButton: PresentedBaseGameplayPauseButton;
  readonly replayButton: PresentedBaseGameplayPauseButton;
  readonly resumeButton: PresentedBaseGameplayPauseButton;
  readonly rewardLabel: PresentedBaseGameplayPauseLabel;

  private attachedValue = false;
  private readonly intents: BaseGameplayPausePresenterIntents;
  private readonly pauseState: BaseGameplayPauseState;

  private constructor(
    input: BaseGameplayPausePresenterInput,
    intents: BaseGameplayPausePresenterIntents,
  ) {
    this.intents = intents;
    this.pauseState = new BaseGameplayPauseState({
      contentScaleFactor: input.contentScaleFactor,
      objectiveBackgroundHeight:
        input.resources.pause.objectiveBackground.dimensions.height,
      objectiveBackgroundWidth:
        input.resources.pause.objectiveBackground.dimensions.width,
      viewportHeight: input.viewport.height,
      viewportWidth: input.viewport.width,
    }, input.initialCard);
    this.layout = this.pauseState.layout;

    // Preserve InitPauseComponent's visual ownership order. Root visibility is projected only
    // after attach, so an unattached menu cannot receive input through activeInHierarchy.
    this.objectiveOverlay = createOverlay(input.viewport);
    this.objectiveBackground = createSprite(
      'BaseGameplayPauseObjectiveBackground',
      input.resources.pause.objectiveBackground,
    );
    this.objectiveBackground.node.setParent(this.objectiveOverlay.node);
    this.objectiveBackground.node.setSiblingIndex(BASE_GAMEPLAY_PAUSE_Z_ORDER);
    this.objectiveBackground.node.setPosition(
      this.layout.objectiveBackgroundWorldPosition.x,
      this.layout.objectiveBackgroundWorldPosition.y,
      0,
    );

    this.descriptionLabel = createLabel(
      'BaseGameplayPauseDescriptionLabel',
      input,
      Object.freeze({ x: 0.5, y: 0.5 }),
      input.initialCard.description,
    );
    this.progressLabel = createLabel(
      'BaseGameplayPauseProgressLabel',
      input,
      this.layout.progressAnchor,
      input.initialCard.progress,
    );
    this.rewardLabel = createLabel(
      'BaseGameplayPauseRewardLabel',
      input,
      this.layout.rewardAnchor,
      input.initialCard.reward,
    );
    const labels = [
      [this.descriptionLabel, this.layout.descriptionLocalPosition],
      [this.progressLabel, this.layout.progressLocalPosition],
      [this.rewardLabel, this.layout.rewardLocalPosition],
    ] as const;
    for (let index = 0; index < labels.length; index += 1) {
      const [presented, position] = labels[index];
      const creatorPosition = lowerLeftToCenteredLocal(
        position,
        input.resources.pause.objectiveBackground,
      );
      presented.node.setParent(this.objectiveBackground.node);
      presented.node.setSiblingIndex(BASE_GAMEPLAY_PAUSE_Z_ORDER + index);
      presented.node.setPosition(creatorPosition.x, creatorPosition.y, 0);
    }

    this.pauseMenu = createContainer('BaseGameplayPauseMenu', input.viewport);
    this.pauseButton = createButton(
      'BaseGameplayPauseButton',
      input.resources.pause.pauseNormal,
      input.resources.pause.pauseSelected,
    );
    this.pauseButton.node.setParent(this.pauseMenu.node);
    this.pauseButton.node.setPosition(
      this.layout.pauseItemWorldPosition.x,
      this.layout.pauseItemWorldPosition.y,
      0,
    );

    this.optionsMenu = createContainer(
      'BaseGameplayPauseOptionsMenu',
      input.viewport,
    );
    this.resumeButton = createButton(
      'BaseGameplayPauseResumeButton',
      input.resources.pause.resumeNormal,
      input.resources.pause.resumeSelected,
    );
    this.replayButton = createButton(
      'BaseGameplayPauseReplayButton',
      input.resources.pause.replayNormal,
      input.resources.pause.replaySelected,
    );
    this.quitButton = createButton(
      'BaseGameplayPauseQuitButton',
      input.resources.pause.quitNormal,
      input.resources.pause.quitSelected,
    );
    for (const button of [
      this.resumeButton,
      this.replayButton,
      this.quitButton,
    ]) {
      button.node.setParent(this.optionsMenu.node);
    }

    this.projectSnapshot(false);
    this.registerButtonEvents();
  }

  static create(
    input: BaseGameplayPausePresenterInput,
    intents: BaseGameplayPausePresenterIntents,
  ): BaseGameplayPausePresenter {
    assertInput(input);
    assertIntents(intents);
    return new BaseGameplayPausePresenter(input, intents);
  }

  get isAttached(): boolean {
    return this.attachedValue;
  }

  get isDisposed(): boolean {
    return this.pauseState.snapshot.disposed;
  }

  get snapshot(): BaseGameplayPauseSnapshot {
    return this.pauseState.snapshot;
  }

  attach(parent: Node): void {
    if (!isValid(parent, true) || !parent.activeInHierarchy) {
      throw new Error('Base-gameplay pause presenter parent must be valid and active');
    }
    if (this.isDisposed) {
      throw new Error('Disposed base-gameplay pause presenter cannot be attached');
    }
    if (
      this.attachedValue
      || this.rootNodes().some(({ parent: currentParent }) => currentParent !== null)
    ) {
      throw new Error('Base-gameplay pause presenter is already attached');
    }

    const ownedNodes = this.ownedNodes();
    const previousLayers = ownedNodes.map(({ layer }) => layer);
    const roots = this.rootNodes();
    try {
      for (const node of ownedNodes) {
        node.layer = parent.layer;
      }
      for (let index = 0; index < roots.length; index += 1) {
        const node = roots[index];
        // Recovered layout coordinates use the lower-left world origin. Preserve the detached
        // zero-world root beneath a potentially translated Canvas/gameplay node.
        node.setParent(parent, true);
        // Native children all request z=1; Creator preserves their recovered draw order through
        // consecutive sibling insertion while retaining that conceptual equal-z contract.
        node.setSiblingIndex(BASE_GAMEPLAY_PAUSE_Z_ORDER + index);
      }
      this.attachedValue = true;
      this.projectSnapshot(true);
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      this.attachedValue = false;
      for (const node of roots) {
        collectFailure(rollbackFailures, () => {
          node.active = false;
        });
      }
      for (const node of [...roots].reverse()) {
        collectFailure(rollbackFailures, () => {
          if (node.parent !== null) {
            node.setParent(null, true);
          }
        });
      }
      for (let index = 0; index < ownedNodes.length; index += 1) {
        collectFailure(rollbackFailures, () => {
          ownedNodes[index].layer = previousLayers[index];
        });
      }
      if (rollbackFailures.length === 0) {
        throw error;
      }

      // A root that cannot be detached is no longer a retry-safe owner. Dispose the pure lease,
      // remove listeners, and destroy every remaining valid root before surfacing both failures.
      collectFailure(rollbackFailures, () => {
        this.executeCommands(this.pauseState.dispose());
      });
      collectFailure(rollbackFailures, () => this.unregisterButtonEvents());
      for (const node of roots) {
        collectFailure(rollbackFailures, () => {
          if (isValid(node, true)) {
            node.destroy();
          }
        });
      }
      throwWithPrimary(
        'Base-gameplay pause presenter attachment rollback failed',
        error,
        rollbackFailures,
      );
    }
  }

  pauseIngress(refreshedCard: BaseGameplayPauseObjectiveCard): void {
    this.assertAttached('begin pause ingress');
    this.pauseState.pauseIngress(refreshedCard);
    this.projectSnapshot(true);
  }

  resumeEgress(): void {
    this.assertAttached('begin pause egress');
    const commands = this.pauseState.resumeEgress();
    // PauseOutAction resumes the director before exposing its egress visual projection.
    this.executeCommands(commands);
    this.projectSnapshot(true);
  }

  updateAction(deltaSeconds: number): void {
    if (this.isDisposed) {
      this.pauseState.updateAction(deltaSeconds);
      return;
    }
    this.assertAttached('update pause actions');
    const commands = this.pauseState.updateAction(deltaSeconds);
    // The pure state advances MoveTo actions before completing the delayed pause callback.
    this.projectSnapshot(true);
    this.executeCommands(commands);
  }

  stopAllActions(): void {
    this.assertAttached('stop pause actions');
    this.pauseState.stopAllActions();
  }

  /** Explicit owner cleanup. Returns false after the first disposal. */
  dispose(): boolean {
    if (this.isDisposed) {
      return false;
    }
    const commands = this.pauseState.dispose();
    this.attachedValue = false;
    const failures: unknown[] = [];
    collectFailure(failures, () => this.executeCommands(commands));
    collectFailure(failures, () => this.unregisterButtonEvents());
    for (const node of this.rootNodes()) {
      collectFailure(failures, () => {
        if (isValid(node, true)) {
          node.destroy();
        }
      });
    }
    throwCollectedFailures(failures);
    return true;
  }

  private readonly onPauseTouchStart = (): void => {
    this.startButtonTouch(this.pauseButton, 'pause');
  };

  private readonly onPauseTouchEnd = (): void => {
    this.finishButtonTouch(
      this.pauseButton,
      'pause',
      this.intents.onPauseRequested,
    );
  };

  private readonly onPauseTouchCancel = (): void => {
    this.cancelButtonTouch(this.pauseButton);
  };

  private readonly onResumeTouchStart = (): void => {
    this.startButtonTouch(this.resumeButton, 'options');
  };

  private readonly onResumeTouchEnd = (): void => {
    this.finishButtonTouch(
      this.resumeButton,
      'options',
      this.intents.onResumeRequested,
    );
  };

  private readonly onResumeTouchCancel = (): void => {
    this.cancelButtonTouch(this.resumeButton);
  };

  private readonly onReplayTouchStart = (): void => {
    this.startButtonTouch(this.replayButton, 'options');
  };

  private readonly onReplayTouchEnd = (): void => {
    this.finishButtonTouch(
      this.replayButton,
      'options',
      this.intents.onReplayRequested,
    );
  };

  private readonly onReplayTouchCancel = (): void => {
    this.cancelButtonTouch(this.replayButton);
  };

  private readonly onQuitTouchStart = (): void => {
    this.startButtonTouch(this.quitButton, 'options');
  };

  private readonly onQuitTouchEnd = (): void => {
    this.finishButtonTouch(
      this.quitButton,
      'options',
      this.intents.onQuitRequested,
    );
  };

  private readonly onQuitTouchCancel = (): void => {
    this.cancelButtonTouch(this.quitButton);
  };

  private startButtonTouch(
    button: PresentedBaseGameplayPauseButton,
    menu: PauseMenuKind,
  ): void {
    if (this.menuAcceptsInput(menu)) {
      applyButtonResource(button, button.selectedResource);
    }
  }

  private finishButtonTouch(
    button: PresentedBaseGameplayPauseButton,
    menu: PauseMenuKind,
    intent: () => void,
  ): void {
    if (!this.menuAcceptsInput(menu)) {
      return;
    }
    applyButtonResource(button, button.normalResource);
    // There is intentionally no debounce or navigation guard. Re-entrant and overlapping
    // callbacks remain host-visible, matching the recovered menu behavior.
    intent();
  }

  private cancelButtonTouch(button: PresentedBaseGameplayPauseButton): void {
    if (!this.isDisposed && isValid(button.node, true)) {
      applyButtonResource(button, button.normalResource);
    }
  }

  private menuAcceptsInput(menu: PauseMenuKind): boolean {
    if (!this.attachedValue || this.isDisposed) {
      return false;
    }
    const snapshot = this.pauseState.snapshot;
    return menu === 'pause'
      ? snapshot.pauseMenuEnabled && snapshot.pauseMenuVisible
      : snapshot.optionsMenuEnabled && snapshot.optionsMenuVisible;
  }

  private registerButtonEvents(): void {
    registerButtonEvents(
      this.pauseButton.node,
      this.onPauseTouchStart,
      this.onPauseTouchEnd,
      this.onPauseTouchCancel,
      this,
    );
    registerButtonEvents(
      this.resumeButton.node,
      this.onResumeTouchStart,
      this.onResumeTouchEnd,
      this.onResumeTouchCancel,
      this,
    );
    registerButtonEvents(
      this.replayButton.node,
      this.onReplayTouchStart,
      this.onReplayTouchEnd,
      this.onReplayTouchCancel,
      this,
    );
    registerButtonEvents(
      this.quitButton.node,
      this.onQuitTouchStart,
      this.onQuitTouchEnd,
      this.onQuitTouchCancel,
      this,
    );
  }

  private unregisterButtonEvents(): void {
    unregisterButtonEvents(
      this.pauseButton.node,
      this.onPauseTouchStart,
      this.onPauseTouchEnd,
      this.onPauseTouchCancel,
      this,
    );
    unregisterButtonEvents(
      this.resumeButton.node,
      this.onResumeTouchStart,
      this.onResumeTouchEnd,
      this.onResumeTouchCancel,
      this,
    );
    unregisterButtonEvents(
      this.replayButton.node,
      this.onReplayTouchStart,
      this.onReplayTouchEnd,
      this.onReplayTouchCancel,
      this,
    );
    unregisterButtonEvents(
      this.quitButton.node,
      this.onQuitTouchStart,
      this.onQuitTouchEnd,
      this.onQuitTouchCancel,
      this,
    );
  }

  private projectSnapshot(projectVisibility: boolean): void {
    const snapshot = this.pauseState.snapshot;
    this.descriptionLabel.label.string = snapshot.card.description;
    this.progressLabel.label.string = snapshot.card.progress;
    this.rewardLabel.label.string = snapshot.card.reward;
    this.resumeButton.node.setPosition(
      snapshot.resumePosition.x,
      snapshot.resumePosition.y,
      0,
    );
    this.replayButton.node.setPosition(
      snapshot.replayPosition.x,
      snapshot.replayPosition.y,
      0,
    );
    this.quitButton.node.setPosition(
      snapshot.quitPosition.x,
      snapshot.quitPosition.y,
      0,
    );

    this.objectiveOverlay.node.active = projectVisibility
      && snapshot.objectiveOverlayVisible;
    this.pauseMenu.node.active = projectVisibility && snapshot.pauseMenuVisible;
    this.optionsMenu.node.active = projectVisibility
      && snapshot.optionsMenuVisible;
    if (
      !projectVisibility
      || !snapshot.pauseMenuEnabled
      || !snapshot.pauseMenuVisible
    ) {
      applyButtonResource(this.pauseButton, this.pauseButton.normalResource);
    }
    if (
      !projectVisibility
      || !snapshot.optionsMenuEnabled
      || !snapshot.optionsMenuVisible
    ) {
      for (const button of [
        this.resumeButton,
        this.replayButton,
        this.quitButton,
      ]) {
        applyButtonResource(button, button.normalResource);
      }
    }
  }

  private executeCommands(
    commands: readonly BaseGameplayPauseActionCommand[],
  ): void {
    for (const command of commands) {
      if (command.type === 'pause-director') {
        director.pause();
      } else {
        director.resume();
      }
    }
  }

  private assertAttached(action: string): void {
    if (this.isDisposed) {
      throw new Error(`Disposed base-gameplay pause presenter cannot ${action}`);
    }
    if (!this.attachedValue) {
      throw new Error(
        `Base-gameplay pause presenter must be attached before it can ${action}`,
      );
    }
  }

  private rootNodes(): readonly Node[] {
    return [
      this.objectiveOverlay.node,
      this.pauseMenu.node,
      this.optionsMenu.node,
    ];
  }

  private ownedNodes(): readonly Node[] {
    return [
      this.objectiveOverlay.node,
      this.objectiveBackground.node,
      this.descriptionLabel.node,
      this.progressLabel.node,
      this.rewardLabel.node,
      this.pauseMenu.node,
      this.pauseButton.node,
      this.optionsMenu.node,
      this.resumeButton.node,
      this.replayButton.node,
      this.quitButton.node,
    ];
  }
}

function createOverlay(
  viewport: BaseGameplayPauseViewport,
): PresentedBaseGameplayPauseOverlay {
  const node = new Node('BaseGameplayPauseOverlay');
  node.active = false;
  node.setPosition(0, 0, 0);
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(0, 0);
  transform.setContentSize(viewport.width, viewport.height);
  const graphics = node.addComponent(Graphics);
  // Graphics alpha projects CCLayerColor's opacity without Creator UIOpacity cascading the
  // dim value into the full-opacity objective background and labels.
  graphics.fillColor = new Color(
    0,
    0,
    0,
    BASE_GAMEPLAY_PAUSE_OVERLAY_OPACITY,
  );
  graphics.rect(0, 0, viewport.width, viewport.height);
  graphics.fill();
  const opacity = BASE_GAMEPLAY_PAUSE_OVERLAY_OPACITY;
  return Object.freeze({ graphics, node, opacity, transform });
}

function createContainer(
  name: string,
  viewport: BaseGameplayPauseViewport,
): PresentedBaseGameplayPauseContainer {
  const node = new Node(name);
  node.active = false;
  node.setPosition(0, 0, 0);
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(0, 0);
  transform.setContentSize(viewport.width, viewport.height);
  return Object.freeze({ node, transform });
}

function createSprite(
  name: string,
  resource: LoadedGameRasterResource,
): PresentedBaseGameplayPauseSprite {
  const node = new Node(name);
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(0.5, 0.5);
  transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  return Object.freeze({ node, resource, sprite, transform });
}

function createButton(
  name: string,
  normalResource: LoadedGameRasterResource,
  selectedResource: LoadedGameRasterResource,
): PresentedBaseGameplayPauseButton {
  const presented = createSprite(name, normalResource);
  return Object.freeze({
    node: presented.node,
    normalResource,
    selectedResource,
    sprite: presented.sprite,
    transform: presented.transform,
  });
}

function createLabel(
  name: string,
  input: BaseGameplayPausePresenterInput,
  anchor: Readonly<{ readonly x: number; readonly y: number }>,
  text: string,
): PresentedBaseGameplayPauseLabel {
  const node = new Node(name);
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(anchor.x, anchor.y);
  const label = node.addComponent(Label);
  label.font = input.resources.arialFont.font;
  label.fontSize = 24 * input.viewport.width / 400;
  label.lineHeight = label.fontSize;
  label.string = text;
  label.color = new Color(OPAQUE, OPAQUE, OPAQUE, OPAQUE);
  return Object.freeze({ label, node, transform });
}

function applyButtonResource(
  button: PresentedBaseGameplayPauseButton,
  resource: LoadedGameRasterResource,
): void {
  button.sprite.spriteFrame = resource.spriteFrame;
  button.transform.setContentSize(
    resource.dimensions.width,
    resource.dimensions.height,
  );
}

function lowerLeftToCenteredLocal(
  position: Readonly<{ readonly x: number; readonly y: number }>,
  parentResource: LoadedGameRasterResource,
): Readonly<{ readonly x: number; readonly y: number }> {
  // Native sprite child coordinates begin at the lower-left content corner. Creator child
  // positions begin at this center-anchored Sprite node's transform origin.
  return Object.freeze({
    x: position.x - parentResource.dimensions.width * 0.5,
    y: position.y - parentResource.dimensions.height * 0.5,
  });
}

function registerButtonEvents(
  node: Node,
  start: () => void,
  end: () => void,
  cancel: () => void,
  target: object,
): void {
  node.on(Node.EventType.TOUCH_START, start, target);
  node.on(Node.EventType.TOUCH_END, end, target);
  node.on(Node.EventType.TOUCH_CANCEL, cancel, target);
}

function unregisterButtonEvents(
  node: Node,
  start: () => void,
  end: () => void,
  cancel: () => void,
  target: object,
): void {
  if (!isValid(node, true)) {
    return;
  }
  node.off(Node.EventType.TOUCH_START, start, target);
  node.off(Node.EventType.TOUCH_END, end, target);
  node.off(Node.EventType.TOUCH_CANCEL, cancel, target);
}

function assertInput(input: BaseGameplayPausePresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('input must be an object');
  }
  if (input.viewport === null || typeof input.viewport !== 'object') {
    throw new TypeError('viewport must be an object');
  }
  assertPositiveFinite(input.viewport.width, 'viewport.width');
  assertPositiveFinite(input.viewport.height, 'viewport.height');
  assertPositiveFinite(input.contentScaleFactor, 'contentScaleFactor');
  assertResources(input.resources);
  // Validate the objective card and the complete layout before allocating Creator nodes.
  new BaseGameplayPauseState({
    contentScaleFactor: input.contentScaleFactor,
    objectiveBackgroundHeight:
      input.resources.pause.objectiveBackground.dimensions.height,
    objectiveBackgroundWidth:
      input.resources.pause.objectiveBackground.dimensions.width,
    viewportHeight: input.viewport.height,
    viewportWidth: input.viewport.width,
  }, input.initialCard);
}

function assertResources(resources: LoadedBaseGameplayResources): void {
  if (resources === null || typeof resources !== 'object') {
    throw new TypeError('resources must be an object');
  }
  const expected = getBaseGameplayResourceProfile(resources.assetTree);
  if (
    resources.arialFont === null
    || typeof resources.arialFont !== 'object'
    || resources.arialFont.canonicalPath
      !== BASE_GAMEPLAY_ARIAL_FONT_RESOURCE.canonicalPath
  ) {
    throw new RangeError('resources.arialFont must be the exact recovered Arial font');
  }
  if (!isValid(resources.arialFont.font, true)) {
    throw new Error('resources.arialFont.font must be a valid loaded Creator Font');
  }
  if (resources.pause === null || typeof resources.pause !== 'object') {
    throw new TypeError('resources.pause must be an object');
  }
  for (const key of [
    'objectiveBackground',
    'pauseNormal',
    'pauseSelected',
    'quitNormal',
    'quitSelected',
    'replayNormal',
    'replaySelected',
    'resumeNormal',
    'resumeSelected',
  ] as const satisfies readonly (keyof LoadedBaseGameplayPauseResources)[]) {
    assertRaster(resources.pause[key], expected.pause[key], `resources.pause.${key}`);
  }
}

function assertRaster(
  resource: LoadedGameRasterResource,
  expected: GameRasterResource,
  label: string,
): void {
  if (resource === null || typeof resource !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
  if (resource.canonicalPath !== expected.canonicalPath) {
    throw new RangeError(`${label} must be the exact recovered pause raster`);
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
    throw new RangeError(
      `${label}.spriteFrame must preserve exact untrimmed raster geometry`,
    );
  }
}

function assertIntents(intents: BaseGameplayPausePresenterIntents): void {
  if (intents === null || typeof intents !== 'object') {
    throw new TypeError('intents must be an object');
  }
  for (const key of [
    'onPauseRequested',
    'onQuitRequested',
    'onReplayRequested',
    'onResumeRequested',
  ] as const) {
    if (typeof intents[key] !== 'function') {
      throw new TypeError(`${key} must be a function`);
    }
  }
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be finite and positive`);
  }
}

function collectFailure(failures: unknown[], action: () => void): void {
  try {
    action();
  } catch (error) {
    failures.push(error);
  }
}

function throwCollectedFailures(failures: readonly unknown[]): void {
  if (failures.length === 0) {
    return;
  }
  if (failures.length === 1) {
    throw failures[0];
  }
  const error = new Error(
    `Base-gameplay pause presenter cleanup failed ${failures.length} times`,
  );
  Object.defineProperty(error, 'failures', {
    enumerable: false,
    value: Object.freeze([...failures]),
  });
  throw error;
}

function throwWithPrimary(
  label: string,
  primary: unknown,
  rollbackFailures: readonly unknown[],
): never {
  const error = new Error(
    `${label} ${rollbackFailures.length} times`,
  );
  Object.defineProperties(error, {
    cause: {
      enumerable: false,
      value: primary,
    },
    failures: {
      enumerable: false,
      value: Object.freeze([...rollbackFailures]),
    },
  });
  throw error;
}
