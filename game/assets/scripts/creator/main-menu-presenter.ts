import {
  Collider2D,
  Label,
  Node,
  Sprite,
  UIOpacity,
  UITransform,
  isValid,
} from 'cc';

import {
  buildBidirectionalRayPlan,
  createCutDispatchCommands,
  type CutQueryHit,
} from '../domain/classic-cut-query';
import type { BladeMoveResult } from '../domain/blade-tracks';
import type { GameplayRandom } from '../domain/gameplay-random';
import type { ClassicRasterResource } from '../domain/classic-resource-contract';
import {
  MAIN_MENU_FRUIT_CIRCLE_ROTATION_DEGREES,
  MAIN_MENU_FRUIT_CIRCLE_ROTATION_SECONDS,
  MAIN_MENU_REVIEW_PULSE_APEX_SCALE,
  MAIN_MENU_REVIEW_PULSE_CYCLE_SECONDS,
  MAIN_MENU_REVIEW_PULSE_LEG_SECONDS,
  createMainMenuHeartEmissionPlan,
  createMainMenuPresentation,
  type MainMenuEntryAction,
  type MainMenuEntryNode,
  type MainMenuHeartEmissionPlan,
  type MainMenuPoint,
  type MainMenuPresentationSnapshot,
  type MainMenuTotalCoinsLabelLayout,
  type MainMenuViewport,
} from '../domain/main-menu-presentation';
import {
  getMainMenuRasterResources,
  type MainMenuFruitButtonPurpose,
  type MainMenuThreeFrameToggleRasterSet,
  type MainMenuTwoFrameRasterSet,
} from '../domain/main-menu-resource-contract';
import {
  MAIN_MENU_NAVIGATION_DELAY_SECONDS,
  MainMenuState,
  type MainMenuAudioCommand,
  type MainMenuDestinationLayer,
  type MainMenuImmediateDestinationLayer,
  type MainMenuStateInput,
  type MainMenuToggleCommand,
} from '../domain/main-menu-state';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import type { ObjectivesManagerState } from '../domain/objectives-manager-state';
import {
  CLASSIC_BLADE_BEGAN_EVENT,
  CLASSIC_BLADE_ENDED_EVENT,
  CLASSIC_BLADE_MOVED_EVENT,
  type ClassicBladeBeganEvent,
  type ClassicBladeEndedEvent,
} from './blade-input-controller';
import { createDetachedScreenRoot } from './detached-screen-root';
import type { LoadedGameRasterResource } from './game-resource-loader';
import type { LoadedStandardBladeResources } from './standard-blade-resource-loader';
import {
  STANDARD_BLADE_SLOT_COUNT,
  StandardBladePresenter,
} from './standard-blade-presenter';
import {
  MainMenuFruitPresenter,
  mainMenuLegacyRotationToCreatorDegrees,
} from './main-menu-fruit-presenter';
import type { LoadedMainMenuResources } from './main-menu-resource-loader';

export interface MainMenuAudioPort {
  playLoopingBackground(canonicalPath: string): void;
  playOneShot(canonicalPath: string): void;
  stopAllEffects(): void;
  stopBackgroundMusic(): void;
}

export interface MainMenuBladeInputPort {
  readonly node: Node;
  activateForClassicLayer(): void;
  deactivateForNonClassicScreen(): void;
  setCutEnabled(enabled: boolean): void;
}

export interface MainMenuRaycastPort {
  callAfterStep(mutation: () => void): void;
  raycastAll(
    startWorld: Readonly<{ readonly x: number; readonly y: number }>,
    endWorld: Readonly<{ readonly x: number; readonly y: number }>,
  ): readonly Readonly<{ readonly collider: Collider2D }>[];
}

export interface MainMenuSettingsStatePort {
  readonly snapshot: MainMenuStateInput;
  addTotalCoins(delta: number): Readonly<{
    readonly delta: number;
    readonly nextTotalCoins: number;
    readonly previousTotalCoins: number;
  }>;
  setEffectsEnabled(enabled: boolean): void;
  setMusicEnabled(enabled: boolean): void;
  setRated(rated: boolean): void;
}

export interface MainMenuSettingsPort {
  readonly state: MainMenuSettingsStatePort;
  persistRatedFlag(): void;
  save(): void;
}

export type MainMenuUnsupportedDestination =
  | Exclude<MainMenuImmediateDestinationLayer, 'OptionsLayer'>
  | Exclude<
      MainMenuDestinationLayer,
      'LeaderboardLayer' | 'ModeSelectLayer' | 'ObjectivesLayer'
    >;

export interface MainMenuNavigationTransaction {
  readonly destination: MainMenuDestinationLayer | MainMenuImmediateDestinationLayer;
  readonly root: Node;
  readonly timing: 'delayed' | 'immediate';
  readonly zOrder: 1;
}

export interface MainMenuPresenterLifecycle {
  /** `false` reports a rolled-back host transaction; `void` means success. */
  readonly onModeSelectRequested: (
    transaction: MainMenuNavigationTransaction,
  ) => boolean | void;
  /** Recovered delayed fruit route using the same source transaction boundary. */
  readonly onLeaderboardRequested: (
    transaction: MainMenuNavigationTransaction,
  ) => boolean | void;
  /** Recovered delayed Objectives fruit route using the same source transaction boundary. */
  readonly onObjectivesRequested: (
    transaction: MainMenuNavigationTransaction,
  ) => boolean | void;
  /** Explicit recovered immediate About route. */
  readonly onAboutRequested: (
    transaction: MainMenuNavigationTransaction,
  ) => boolean | void;
  /** Explicit recovered immediate Options route. */
  readonly onOptionsRequested: (
    transaction: MainMenuNavigationTransaction,
  ) => boolean | void;
  readonly onUnsupportedDestinationRequested: (
    destination: MainMenuUnsupportedDestination,
    transaction: MainMenuNavigationTransaction,
  ) => boolean | void;
  /** Isolated platform boundary. Throw or return false to fail closed without a reward. */
  readonly onPlatformReviewRequested: () => boolean | void;
  readonly onExitRequested: () => void;
}

export interface MainMenuClassicResources {
  readonly assetTree: ClassicAssetTree;
}

export interface MainMenuStandardBladeResources {
  readonly selectedBladeId: number;
  readonly catalog: LoadedStandardBladeResources;
}

export interface MainMenuPresenterInput {
  readonly audio: MainMenuAudioPort;
  readonly bladeInput: MainMenuBladeInputPort;
  readonly canvas: Node;
  readonly classicResources: MainMenuClassicResources;
  readonly lifecycle: MainMenuPresenterLifecycle;
  readonly objectives: Pick<
    ObjectivesManagerState,
    'processFruitTypeCut' | 'processGlobalFruitCut'
  >;
  readonly random: Pick<GameplayRandom, 'nextDecile' | 'nextIntInclusive'>;
  readonly raycast: MainMenuRaycastPort;
  readonly resources: LoadedMainMenuResources;
  readonly settings: MainMenuSettingsPort;
  readonly standardBlades: MainMenuStandardBladeResources;
  readonly viewport: MainMenuViewport;
}

export interface MainMenuPresenterState {
  readonly activated: boolean;
  readonly disposed: boolean;
  readonly navigationPending: boolean;
  readonly poisoned: boolean;
  readonly retainedHeartCount: number;
  readonly suspended: boolean;
}

interface RuntimeAnimatedLayout {
  readonly actions: readonly MainMenuEntryAction[];
  readonly finalPosition: MainMenuPoint;
  readonly initialPosition: MainMenuPoint;
}

interface RuntimeAnimatedNode {
  readonly layout: RuntimeAnimatedLayout;
  readonly node: Node;
  readonly opacity: UIOpacity | null;
}

interface RuntimeHeart {
  elapsedSeconds: number;
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly plan: MainMenuHeartEmissionPlan;
}

interface RuntimeButtonEvents {
  readonly cancel: () => void;
  readonly end: () => void;
  readonly node: Node;
  readonly start: () => void;
}

interface PresentedImageControl {
  readonly node: Node;
  readonly normalResource: LoadedGameRasterResource;
  readonly opacity: UIOpacity;
  readonly selectedResource: LoadedGameRasterResource;
  readonly sprite: Sprite;
}

interface PresentedToggleSubitem {
  readonly baseResource: LoadedGameRasterResource;
  readonly node: Node;
  readonly selectedResource: LoadedGameRasterResource;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

interface PresentedToggleControl {
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly subitems: readonly [PresentedToggleSubitem, PresentedToggleSubitem];
  readonly transform: UITransform;
}

type NavigationStatus = 'completed' | 'idle' | 'pending';

const MAX_OPACITY = 255;
const EPSILON = 1e-7;
const MAX_MAIN_MENU_UPDATE_SECONDS = 60;
const MAX_MAIN_MENU_UPDATE_SEGMENTS = 512;

/** Detached, activation-gated Creator runtime for the recovered Main Menu foreground. */
export class MainMenuPresenter {
  readonly blade: StandardBladePresenter;
  readonly fruitButtons: readonly MainMenuFruitPresenter[];
  readonly presentation: MainMenuPresentationSnapshot;
  readonly root: Node;

  private readonly animatedNodes: RuntimeAnimatedNode[] = [];
  private readonly activeHearts: RuntimeHeart[] = [];
  private readonly audio: MainMenuAudioPort;
  private readonly bladeInput: MainMenuBladeInputPort;
  private readonly buttonEvents: RuntimeButtonEvents[] = [];
  private readonly colliderFruit = new Map<Collider2D, MainMenuFruitPresenter>();
  private readonly controls: Readonly<{
    about: PresentedImageControl;
    effects: PresentedToggleControl;
    exit: PresentedImageControl;
    music: PresentedToggleControl;
    options: PresentedImageControl;
    review: PresentedImageControl;
  }>;
  private cleanupPoisoned = false;
  private disposedValue = false;
  private entryElapsedSeconds = 0;
  private readonly hearts: RuntimeHeart[] = [];
  private readonly input: MainMenuPresenterInput;
  private inputLeaseHeld = false;
  private listenersRegistered = false;
  private model: MainMenuState;
  private musicStartedDuringActivation = false;
  private readonly pendingCutFruits: MainMenuFruitPresenter[] = [];
  private navigationElapsedSeconds = 0;
  private navigationStatus: NavigationStatus = 'idle';
  private readonly originalSettings: MainMenuStateInput;
  private reviewEmissionIndex: 0 | 1 = 0;
  private reviewPhaseSeconds = 0;
  private suspendedValue = false;
  private activatedValue = false;

  private constructor(input: MainMenuPresenterInput) {
    this.input = input;
    this.audio = input.audio;
    this.bladeInput = input.bladeInput;
    this.originalSettings = copySettingsSnapshot(input.settings.state.snapshot);
    this.model = new MainMenuState(this.originalSettings);
    this.presentation = createMainMenuPresentation(
      input.resources.assetTree,
      input.viewport,
      this.originalSettings.totalCoins,
    );
    this.root = createDetachedScreenRoot('MainMenuRoot', input.canvas);
    this.root.active = false;
    this.blade = StandardBladePresenter.create({
      assetTree: input.classicResources.assetTree,
      profile: input.standardBlades.catalog.profile(
        input.standardBlades.selectedBladeId,
      ),
      random: input.random,
      viewportWidth: input.viewport.logicalWidth,
    });

    let fruitButtons: readonly MainMenuFruitPresenter[] = Object.freeze([]);
    let controls: MainMenuPresenter['controls'] | null = null;
    try {
      // The selected standard blade wrapper owns the exact trail/particle presenters.
      this.blade.attach(this.root);

      this.attachAnimatedSprite(
        'pencilbladebk',
        this.presentation.shell.pencilBladeBackground,
        1,
      );
      this.attachAnimatedSprite(
        'pencilblade',
        this.presentation.shell.pencilBlade,
        2,
      );
      this.attachAnimatedSprite(
        'total-coins-panel',
        this.presentation.shell.totalCoinsPanel,
        3,
      );
      this.attachCoinsLabel(this.presentation.shell.totalCoinsLabel, 4);

      const menu = new Node('menu');
      menu.setWorldPosition(
        this.presentation.controls.menuOrigin.x,
        this.presentation.controls.menuOrigin.y,
        0,
      );
      attachPreservingWorld(menu, this.root, 5);
      const about = this.attachImageControl(
        'about',
        this.presentation.controls.about,
        menu,
        0,
      );
      const review = this.attachImageControl(
        'review',
        this.presentation.controls.review,
        menu,
        1,
      );
      const music = this.attachToggleControl(
        'music-toggle',
        this.presentation.controls.musicToggle,
        menu,
        2,
      );
      const effects = this.attachToggleControl(
        'effects-toggle',
        this.presentation.controls.effectsToggle,
        menu,
        3,
      );
      const options = this.attachImageControl(
        'blue-wheel-options',
        this.presentation.controls.blueWheelOptions,
        menu,
        4,
      );
      const exit = this.attachImageControl(
        'exit',
        this.presentation.controls.exit,
        menu,
        5,
      );
      controls = Object.freeze({ about, effects, exit, music, options, review });

      this.attachAnimatedSprite('orange-wheel', this.presentation.wheels.orange, 6);
      this.attachAnimatedSprite('black-wheel', this.presentation.wheels.black, 7);

      fruitButtons = Object.freeze(this.presentation.fruitButtons.map((presentation, index) => {
        const fruit = MainMenuFruitPresenter.create({
          assetTree: input.resources.assetTree,
          presentation,
          resources: input.resources,
          viewport: {
            height: input.viewport.logicalHeight,
            width: input.viewport.logicalWidth,
          },
        }, {
          callAfterStep: (mutation) => input.raycast.callAfterStep(mutation),
          onColliderDisposed: (collider) => this.colliderFruit.delete(collider),
          onGlobalFruitCut: () => input.objectives.processGlobalFruitCut(),
          onNavigation: (purpose) => this.acceptFruitNavigation(purpose),
          onPlayFruitAudio: (canonicalPath) => this.audio.playOneShot(canonicalPath),
          onFruitTypeCut: (fruitId) => input.objectives.processFruitTypeCut(fruitId),
        });
        fruit.attach(this.root, 8 + index);
        this.colliderFruit.set(fruit.collider, fruit);
        return fruit;
      }));

      const gestures = new Node('gestures-layer');
      gestures.setParent(this.root);
      gestures.setSiblingIndex(11);
      this.registerControlDefinitions(controls);
    } catch (error) {
      for (const fruit of fruitButtons) {
        fruit.dispose();
      }
      this.blade.dispose();
      if (isValid(this.root, true)) {
        this.root.destroy();
      }
      throw error;
    }
    if (controls === null) {
      throw new Error('Main Menu controls were not constructed');
    }
    this.controls = controls;
    this.fruitButtons = fruitButtons;
  }

  static create(input: MainMenuPresenterInput): MainMenuPresenter {
    assertInput(input);
    return new MainMenuPresenter(input);
  }

  get state(): MainMenuPresenterState {
    return Object.freeze({
      activated: this.activatedValue,
      disposed: this.disposedValue,
      navigationPending: this.navigationStatus === 'pending',
      poisoned: this.cleanupPoisoned,
      retainedHeartCount: this.hearts.length,
      suspended: this.suspendedValue,
    });
  }

  activate(): void {
    if (this.disposedValue || !isValid(this.root, true)) {
      throw new Error('Disposed Main Menu presenter cannot activate');
    }
    if (this.cleanupPoisoned) {
      throw new Error('Poisoned Main Menu presenter cannot activate');
    }
    if (this.activatedValue) {
      throw new Error('Main Menu presenter can activate only once');
    }
    if (
      this.root.parent === null
      || !isValid(this.root.parent, true)
      || !this.root.parent.activeInHierarchy
    ) {
      throw new Error('Main Menu root must be host-attached before activation');
    }

    this.resetActionState();
    this.root.active = true;
    try {
      this.registerBladeEvents();
      this.bladeInput.activateForClassicLayer();
      this.inputLeaseHeld = true;
      this.bladeInput.setCutEnabled(true);
      this.applyConstructionCommands();
      for (const fruit of this.fruitButtons) {
        fruit.activate();
      }
      this.activatedValue = true;
    } catch (error) {
      this.rollbackActivation();
      throw error;
    }
  }

  /** One host-frame boundary; safe no-op before activation and after disposal. */
  update(deltaSeconds: number): void {
    if (!this.activatedValue || this.disposedValue || this.suspendedValue) {
      return;
    }
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (deltaSeconds > MAX_MAIN_MENU_UPDATE_SECONDS) {
      throw new RangeError(
        `deltaSeconds must not exceed ${String(MAX_MAIN_MENU_UPDATE_SECONDS)} seconds`,
      );
    }
    this.blade.update(deltaSeconds);
    let remaining = deltaSeconds;
    let segmentCount = 0;
    while (remaining > 0 && this.activatedValue && !this.disposedValue) {
      segmentCount += 1;
      if (segmentCount > MAX_MAIN_MENU_UPDATE_SEGMENTS) {
        throw new Error('Main Menu action boundary iteration limit exceeded');
      }
      const heartBoundary = this.reviewEmissionIndex === 0
        ? MAIN_MENU_REVIEW_PULSE_LEG_SECONDS
        : MAIN_MENU_REVIEW_PULSE_CYCLE_SECONDS;
      const untilHeart = Math.max(0, heartBoundary - this.reviewPhaseSeconds);
      const untilNavigation = this.navigationStatus === 'pending'
        ? Math.max(0, MAIN_MENU_NAVIGATION_DELAY_SECONDS - this.navigationElapsedSeconds)
        : Number.POSITIVE_INFINITY;
      const segment = Math.min(remaining, untilHeart, untilNavigation);
      if (segment > 0) {
        this.advanceActionSegment(segment);
        remaining -= segment;
      }

      let processedBoundary = false;
      if (
        this.navigationStatus === 'pending'
        && this.navigationElapsedSeconds + EPSILON >= MAIN_MENU_NAVIGATION_DELAY_SECONDS
      ) {
        this.completeDelayedNavigation();
        processedBoundary = true;
      }
      if (
        this.activatedValue
        && !this.disposedValue
        && this.reviewPhaseSeconds + EPSILON >= heartBoundary
      ) {
        this.emitReviewHeart();
        if (this.reviewEmissionIndex === 0) {
          this.reviewEmissionIndex = 1;
        } else {
          this.reviewEmissionIndex = 0;
          this.reviewPhaseSeconds = 0;
          this.controls.review.node.setScale(1, 1, 1);
        }
        processedBoundary = true;
      }
      if (!processedBoundary && segment === 0) {
        break;
      }
    }
  }

  /** Restores the cut gate after a host transaction failed or later rolled back. */
  rearmNavigationAfterFailure(): boolean {
    if (this.cleanupPoisoned) {
      throw new MainMenuCleanupError(
        'Poisoned Main Menu presenter cannot rearm navigation',
        [new Error('A prior listener or input-lease cleanup did not complete')],
      );
    }
    if (
      this.disposedValue
      || !this.activatedValue
      || this.root.parent === null
      || !isValid(this.root.parent, true)
      || !this.root.parent.activeInHierarchy
    ) {
      return false;
    }
    // Screen replacement can fail before the shell asks Main Menu to suspend.
    // In that case SharedGameScene has already restored this still-active source,
    // so rollback is complete without reacquiring an input lease.
    if (this.navigationStatus === 'idle' && !this.suspendedValue) {
      return true;
    }
    if (this.suspendedValue) {
      this.resumeInputAfterTransitionFailure();
    } else {
      this.bladeInput.setCutEnabled(true);
    }
    for (const fruit of this.pendingCutFruits) {
      if (!fruit.rollbackCut()) {
        throw new Error(`Main Menu cannot roll back committed FruitButton ${fruit.targetId}`);
      }
    }
    this.pendingCutFruits.length = 0;
    this.model = new MainMenuState(copySettingsSnapshot(this.input.settings.state.snapshot));
    this.navigationStatus = 'idle';
    this.navigationElapsedSeconds = 0;
    return true;
  }

  /** Releases the shared BladeInput lease while preserving this detached root for rollback. */
  suspendForTransition(): boolean {
    if (
      this.disposedValue
      || !this.activatedValue
      || this.suspendedValue
      || this.cleanupPoisoned
      || !this.inputLeaseHeld
    ) {
      return false;
    }

    const failures: unknown[] = [];
    attemptCleanup(failures, () => this.unregisterBladeEvents());
    attemptCleanup(failures, () => this.bladeInput.setCutEnabled(false));
    attemptCleanup(failures, () => this.releaseClaimedBladeSlots());
    try {
      this.bladeInput.deactivateForNonClassicScreen();
      this.inputLeaseHeld = false;
    } catch (error) {
      failures.push(error);
    }
    this.suspendedValue = true;
    if (failures.length > 0) {
      this.markCleanupPoisoned();
      throw new MainMenuCleanupError('Main Menu suspension failed', failures);
    }
    return true;
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.activatedValue = false;
    const failures: unknown[] = [];
    attemptCleanup(failures, () => this.unregisterBladeEvents());
    attemptCleanup(failures, () => this.unregisterControlEvents());
    if (this.inputLeaseHeld) {
      attemptCleanup(failures, () => this.bladeInput.deactivateForNonClassicScreen());
    }
    this.inputLeaseHeld = false;
    for (const fruit of this.fruitButtons) {
      attemptCleanup(failures, () => fruit.dispose());
    }
    this.colliderFruit.clear();
    this.activeHearts.length = 0;
    this.hearts.length = 0;
    attemptCleanup(failures, () => this.blade.dispose());
    if (isValid(this.root, true)) {
      attemptCleanup(failures, () => this.root.destroy());
    }
    throwCleanupFailures('Main Menu disposal', failures);
    return true;
  }

  private attachAnimatedSprite(
    name: string,
    layout: MainMenuEntryNode<ClassicRasterResource>,
    siblingIndex: number,
  ): RuntimeAnimatedNode {
    const resource = this.input.resources.raster(layout.resource);
    const presented = createSpriteNode(name, resource, hasFadeAction(layout.actions) ? 0 : 255);
    presented.node.setWorldPosition(layout.initialPosition.x, layout.initialPosition.y, 0);
    attachPreservingWorld(presented.node, this.root, siblingIndex);
    const animation = Object.freeze({
      layout: layout as unknown as RuntimeAnimatedLayout,
      node: presented.node,
      opacity: presented.opacity,
    });
    this.animatedNodes.push(animation);
    return animation;
  }

  private attachCoinsLabel(layout: MainMenuTotalCoinsLabelLayout, siblingIndex: number): void {
    const node = new Node('total-coins-label');
    const transform = node.addComponent(UITransform);
    transform.setAnchorPoint(layout.anchor.x, layout.anchor.y);
    const opacity = node.addComponent(UIOpacity);
    opacity.opacity = 0;
    const label = node.addComponent(Label);
    label.font = this.input.resources.font;
    label.fontSize = layout.fontPointSize;
    label.string = layout.text;
    node.setWorldPosition(layout.initialPosition.x, layout.initialPosition.y, 0);
    attachPreservingWorld(node, this.root, siblingIndex);
    this.animatedNodes.push(Object.freeze({
      layout: layout as unknown as RuntimeAnimatedLayout,
      node,
      opacity,
    }));
  }

  private attachImageControl<TSet extends MainMenuTwoFrameRasterSet>(
    name: string,
    layout: MainMenuEntryNode<TSet>,
    menu: Node,
    siblingIndex: number,
  ): PresentedImageControl {
    const normalResource = this.input.resources.raster(layout.resource.normal);
    const selectedResource = this.input.resources.raster(layout.resource.selected);
    const presented = createSpriteNode(name, normalResource, 0);
    presented.node.setWorldPosition(layout.initialPosition.x, layout.initialPosition.y, 0);
    attachPreservingWorld(presented.node, menu, siblingIndex);
    this.animatedNodes.push(Object.freeze({
      layout: layout as unknown as RuntimeAnimatedLayout,
      node: presented.node,
      opacity: presented.opacity,
    }));
    return Object.freeze({
      node: presented.node,
      normalResource,
      opacity: presented.opacity,
      selectedResource,
      sprite: presented.sprite,
    });
  }

  private attachToggleControl(
    name: string,
    layout: MainMenuEntryNode<MainMenuThreeFrameToggleRasterSet>,
    menu: Node,
    siblingIndex: number,
  ): PresentedToggleControl {
    const node = new Node(name);
    const transform = node.addComponent(UITransform);
    const opacity = node.addComponent(UIOpacity);
    opacity.opacity = 0;
    const selectedResource = this.input.resources.raster(layout.resource.selected);
    const normal = createToggleSubitem(
      'normal-subitem',
      this.input.resources.raster(layout.resource.normal),
      selectedResource,
    );
    const disabled = createToggleSubitem(
      'disabled-subitem',
      this.input.resources.raster(layout.resource.disabled),
      selectedResource,
    );
    normal.node.setParent(node);
    normal.node.setSiblingIndex(0);
    disabled.node.setParent(node);
    disabled.node.setSiblingIndex(1);
    normal.node.active = true;
    disabled.node.active = false;
    transform.setContentSize(
      normal.baseResource.dimensions.width,
      normal.baseResource.dimensions.height,
    );
    transform.setAnchorPoint(0.5, 0.5);
    node.setWorldPosition(layout.initialPosition.x, layout.initialPosition.y, 0);
    attachPreservingWorld(node, menu, siblingIndex);
    this.animatedNodes.push(Object.freeze({
      layout: layout as unknown as RuntimeAnimatedLayout,
      node,
      opacity,
    }));
    return Object.freeze({
      node,
      opacity,
      subitems: Object.freeze([
        normal,
        disabled,
      ] as const),
      transform,
    });
  }

  private registerControlDefinitions(controls: NonNullable<MainMenuPresenter['controls']>): void {
    this.buttonEvents.push(
      imageButtonEvents(controls.about, () => this.navigateImmediate('AboutLayer')),
      imageButtonEvents(controls.review, () => this.requestReview()),
      toggleButtonEvents(controls.music, () => this.toggleMusic()),
      toggleButtonEvents(controls.effects, () => this.toggleEffects()),
      imageButtonEvents(controls.options, () => this.navigateImmediate('OptionsLayer')),
      imageButtonEvents(controls.exit, () => this.requestExit()),
    );
  }

  private registerControlEvents(): void {
    try {
      for (const events of this.buttonEvents) {
        events.node.on(Node.EventType.TOUCH_START, events.start, this);
        events.node.on(Node.EventType.TOUCH_END, events.end, this);
        events.node.on(Node.EventType.TOUCH_CANCEL, events.cancel, this);
      }
    } catch (error) {
      this.unregisterControlEvents();
      throw error;
    }
  }

  private unregisterControlEvents(): void {
    for (const events of this.buttonEvents) {
      events.node.off(Node.EventType.TOUCH_START, events.start, this);
      events.node.off(Node.EventType.TOUCH_END, events.end, this);
      events.node.off(Node.EventType.TOUCH_CANCEL, events.cancel, this);
    }
  }

  private registerBladeEvents(): void {
    if (this.listenersRegistered) {
      return;
    }
    try {
      this.bladeInput.node.on(CLASSIC_BLADE_BEGAN_EVENT, this.onBladeBegan, this);
      this.bladeInput.node.on(CLASSIC_BLADE_MOVED_EVENT, this.onBladeMoved, this);
      this.bladeInput.node.on(CLASSIC_BLADE_ENDED_EVENT, this.onBladeEnded, this);
      this.registerControlEvents();
      this.listenersRegistered = true;
    } catch (error) {
      this.bladeInput.node.off(CLASSIC_BLADE_BEGAN_EVENT, this.onBladeBegan, this);
      this.bladeInput.node.off(CLASSIC_BLADE_MOVED_EVENT, this.onBladeMoved, this);
      this.bladeInput.node.off(CLASSIC_BLADE_ENDED_EVENT, this.onBladeEnded, this);
      this.unregisterControlEvents();
      throw error;
    }
  }

  private releaseClaimedBladeSlots(): void {
    for (let slot = 0; slot < STANDARD_BLADE_SLOT_COUNT; slot += 1) {
      if (this.blade.isClaimed(slot)) {
        this.blade.end(slot);
      }
    }
  }

  private unregisterBladeEvents(): void {
    this.bladeInput.node.off(CLASSIC_BLADE_BEGAN_EVENT, this.onBladeBegan, this);
    this.bladeInput.node.off(CLASSIC_BLADE_MOVED_EVENT, this.onBladeMoved, this);
    this.bladeInput.node.off(CLASSIC_BLADE_ENDED_EVENT, this.onBladeEnded, this);
    this.unregisterControlEvents();
    this.listenersRegistered = false;
  }

  private readonly onBladeBegan = (event: ClassicBladeBeganEvent): void => {
    if (this.activatedValue && !this.disposedValue && !this.suspendedValue) {
      this.blade.begin(event.slot);
      this.blade.move(event.slot, event.point);
    }
  };

  private readonly onBladeMoved = (event: BladeMoveResult): void => {
    if (!this.activatedValue || this.disposedValue || this.suspendedValue) {
      return;
    }
    this.blade.move(event.segment.slot, event.segment.current);
    this.blade.presentMovedSegment(event.segment);
    if (this.model.snapshot.cuttingDisabled || this.colliderFruit.size === 0) {
      return;
    }
    const plan = buildBidirectionalRayPlan({
      end: event.segment.current,
      start: event.segment.previous,
    }, this.input.viewport.logicalWidth);
    if (plan === null) {
      return;
    }
    const forwardHits = this.queryHits(plan.forward.start, plan.forward.end);
    const reverseHits = this.queryHits(plan.reverse.start, plan.reverse.end);
    for (const command of createCutDispatchCommands(plan, forwardHits, reverseHits)) {
      if (command.type !== 'cut') {
        continue;
      }
      const fruit = this.fruitButtons.find(({ targetId }) => targetId === command.targetId);
      fruit?.cut(command.segment, this.model.snapshot.effectsEnabled);
    }
  };

  private readonly onBladeEnded = (event: ClassicBladeEndedEvent): void => {
    if (this.activatedValue && !this.disposedValue && !this.suspendedValue) {
      this.blade.end(event.slot);
    }
  };

  private queryHits(start: MainMenuPoint, end: MainMenuPoint): readonly CutQueryHit[] {
    return Object.freeze(this.input.raycast.raycastAll(start, end).map((result) => {
      if (result === null || typeof result !== 'object' || !('collider' in result)) {
        throw new Error('Main Menu raycast returned an invalid hit');
      }
      const fruit = this.colliderFruit.get(result.collider);
      return Object.freeze({ target: fruit?.snapshot() ?? null });
    }));
  }

  private applyConstructionCommands(): void {
    for (const command of this.model.constructionCommands) {
      switch (command.type) {
        case 'set-navigation-state':
        case 'set-background-music-volume':
        case 'set-effects-volume':
          // ClassicAudioPresenter establishes both unity volumes at its shared load boundary.
          break;
        case 'request-background-music':
          this.audio.playLoopingBackground(command.canonicalPath);
          this.musicStartedDuringActivation = true;
          break;
        case 'stop-background-music':
          this.audio.stopBackgroundMusic();
          break;
        case 'stop-all-effects':
          this.audio.stopAllEffects();
          break;
        case 'request-menu-button-audio':
          this.audio.playOneShot(command.canonicalPath);
          break;
        case 'activate-toggle':
          setToggleIndex(
            command.toggle === 'music' ? this.controls.music : this.controls.effects,
            command.selectedIndex,
          );
          break;
        case 'set-music-enabled':
          this.input.settings.state.setMusicEnabled(command.enabled);
          break;
        case 'set-effects-enabled':
          this.input.settings.state.setEffectsEnabled(command.enabled);
          break;
        default:
          assertNever(command);
      }
    }
  }

  private toggleMusic(): void {
    if (!this.canInteract()) {
      return;
    }
    toggleIndex(this.controls.music);
    this.applyToggleCommands(this.model.toggleMusic());
  }

  private toggleEffects(): void {
    if (!this.canInteract()) {
      return;
    }
    toggleIndex(this.controls.effects);
    this.applyToggleCommands(this.model.toggleEffects());
  }

  private applyToggleCommands(commands: readonly MainMenuToggleCommand[]): void {
    for (const command of commands) {
      switch (command.type) {
        case 'set-music-enabled':
          this.input.settings.state.setMusicEnabled(command.enabled);
          break;
        case 'set-effects-enabled':
          this.input.settings.state.setEffectsEnabled(command.enabled);
          break;
        default:
          this.applyAudioCommand(command);
      }
    }
  }

  private applyAudioCommand(command: MainMenuAudioCommand): void {
    switch (command.type) {
      case 'request-menu-button-audio':
        this.audio.playOneShot(command.canonicalPath);
        break;
      case 'request-background-music':
        this.audio.playLoopingBackground(command.canonicalPath);
        break;
      case 'stop-background-music':
        this.audio.stopBackgroundMusic();
        break;
      case 'stop-all-effects':
        this.audio.stopAllEffects();
        break;
      case 'set-background-music-volume':
      case 'set-effects-volume':
        break;
      default:
        assertNever(command);
    }
  }

  private navigateImmediate(destination: MainMenuImmediateDestinationLayer): void {
    if (!this.canInteract()) {
      return;
    }
    const commands = destination === 'AboutLayer'
      ? this.model.aboutCommands()
      : this.model.optionsCommands();
    for (const command of commands) {
      if (command.type === 'attach-immediate-destination-to-captured-parent') {
        let succeeded: boolean | void;
        try {
          const transaction = Object.freeze({
            destination: command.destination,
            root: this.root,
            timing: 'immediate' as const,
            zOrder: command.zOrder,
          });
          succeeded = command.destination === 'AboutLayer'
            ? this.input.lifecycle.onAboutRequested(transaction)
            : this.input.lifecycle.onOptionsRequested(transaction);
        } catch (error) {
          try {
            this.rearmNavigationAfterFailure();
          } catch (rearmError) {
            throw new MainMenuCleanupError(
              'Main Menu immediate destination transaction and rollback failed',
              [error, rearmError],
            );
          }
          throw error;
        }
        if (succeeded === false) {
          this.rearmNavigationAfterFailure();
          return;
        }
      } else if (command.type === 'request-menu-button-audio') {
        this.audio.playOneShot(command.canonicalPath);
      }
    }
  }

  private requestReview(): void {
    if (!this.canInteract()) {
      return;
    }
    try {
      if (this.input.lifecycle.onPlatformReviewRequested() === false) {
        return;
      }
    } catch {
      return;
    }

    const commands = this.model.reviewCommands();
    try {
      for (const command of commands) {
        switch (command.type) {
          case 'request-platform-review':
            // Already invoked above so platform failure cannot mutate reward state.
            break;
          case 'persist-rated-flag':
            this.input.settings.persistRatedFlag();
            break;
          case 'set-rated-in-memory':
            this.input.settings.state.setRated(command.value);
            break;
          case 'add-total-coins': {
            const adjustment = this.input.settings.state.addTotalCoins(command.delta);
            if (
              adjustment.previousTotalCoins !== command.previousTotalCoins
              || adjustment.nextTotalCoins !== command.nextTotalCoins
            ) {
              throw new Error('Main Menu review coin adjustment diverged from state commands');
            }
            break;
          }
          default:
            assertNever(command);
        }
      }
    } catch (error) {
      this.model = new MainMenuState(copySettingsSnapshot(this.input.settings.state.snapshot));
      throw error;
    }
  }

  private requestExit(): void {
    if (!this.canInteract()) {
      return;
    }
    for (const command of this.model.exitCommands()) {
      switch (command.type) {
        case 'request-menu-button-audio':
          this.audio.playOneShot(command.canonicalPath);
          break;
        case 'end-director':
          this.input.lifecycle.onExitRequested();
          break;
        case 'save-settings-data':
          this.input.settings.save();
          break;
        default:
          assertNever(command);
      }
    }
  }

  private acceptFruitNavigation(purpose: MainMenuFruitButtonPurpose): () => void {
    const outcome = this.model.acceptFruitNavigation(purpose);
    if (!outcome.accepted) {
      this.trackPendingCutFruit(purpose);
      return () => this.untrackPendingCutFruit(purpose);
    }
    try {
      for (const command of outcome.commands) {
        switch (command.type) {
          case 'set-cutting-disabled':
            this.bladeInput.setCutEnabled(false);
            break;
          case 'schedule-main-menu-navigation':
            this.navigationStatus = 'pending';
            this.navigationElapsedSeconds = 0;
            break;
          case 'set-navigation-state':
            break;
          default:
            assertNever(command);
        }
      }
      this.trackPendingCutFruit(purpose);
      return () => this.cancelFruitNavigation(purpose);
    } catch (error) {
      this.navigationStatus = 'idle';
      this.navigationElapsedSeconds = 0;
      this.model = new MainMenuState(copySettingsSnapshot(this.input.settings.state.snapshot));
      try {
        this.bladeInput.setCutEnabled(true);
      } catch {
        // Preserve the original port failure; the host still owns the active input lease.
      }
      throw error;
    }
  }

  /**
   * Cancels the route that was scheduled before a later objective callback failed.
   * The FruitButton itself restores its visual/collider state in the same catch boundary.
   */
  private cancelFruitNavigation(purpose: MainMenuFruitButtonPurpose): void {
    this.untrackPendingCutFruit(purpose);
    if (this.navigationStatus !== 'pending') {
      return;
    }
    this.navigationStatus = 'idle';
    this.navigationElapsedSeconds = 0;
    this.model = new MainMenuState(copySettingsSnapshot(this.input.settings.state.snapshot));
    try {
      this.bladeInput.setCutEnabled(true);
    } catch (error) {
      this.markCleanupPoisoned();
      throw new MainMenuCleanupError(
        'Main Menu objective rollback could not restore the cut lease',
        [error],
      );
    }
  }

  private completeDelayedNavigation(): void {
    const commands = this.model.delayedNavigationCommands();
    const attach = commands.find((command) => (
      command.type === 'attach-delayed-destination-to-captured-parent'
    ));
    if (attach === undefined || attach.type !== 'attach-delayed-destination-to-captured-parent') {
      throw new Error('Main Menu delayed navigation requires one destination transaction');
    }
    const transaction = Object.freeze({
      destination: attach.destination,
      root: this.root,
      timing: 'delayed' as const,
      zOrder: attach.zOrder,
    });
    let transactionSucceeded: boolean;
    try {
      if (attach.destination === 'ModeSelectLayer') {
        transactionSucceeded = (
          this.input.lifecycle.onModeSelectRequested(transaction) !== false
        );
      } else if (attach.destination === 'LeaderboardLayer') {
        transactionSucceeded = (
          this.input.lifecycle.onLeaderboardRequested(transaction) !== false
        );
      } else if (attach.destination === 'ObjectivesLayer') {
        transactionSucceeded = (
          this.input.lifecycle.onObjectivesRequested(transaction) !== false
        );
      } else {
        transactionSucceeded = this.input.lifecycle.onUnsupportedDestinationRequested(
          attach.destination,
          transaction,
        ) !== false;
      }
    } catch (error) {
      this.navigationStatus = 'completed';
      try {
        this.rearmNavigationAfterFailure();
      } catch (rearmError) {
        throw new MainMenuCleanupError(
          'Main Menu destination transaction and rollback failed',
          [error, rearmError],
        );
      }
      throw error;
    }
    if (!transactionSucceeded) {
      this.navigationStatus = 'completed';
      this.rearmNavigationAfterFailure();
      return;
    }
    // A successful host callback is the irreversible commit boundary.
    this.navigationStatus = 'completed';
    this.navigationElapsedSeconds = MAIN_MENU_NAVIGATION_DELAY_SECONDS;
    const postCommitFailures: unknown[] = [];
    for (const command of commands) {
      if (command.type === 'stop-background-music') {
        attemptCleanup(postCommitFailures, () => this.audio.stopBackgroundMusic());
      }
    }
    if (!this.disposedValue) {
      for (const fruit of this.pendingCutFruits) {
        attemptCleanup(postCommitFailures, () => {
          if (!fruit.commitCut()) {
            throw new Error(`Main Menu cannot commit FruitButton ${fruit.targetId}`);
          }
        });
      }
    }
    this.pendingCutFruits.length = 0;
    throwCleanupFailures('Main Menu post-commit cleanup', postCommitFailures);
  }

  private advanceActionSegment(deltaSeconds: number): void {
    this.entryElapsedSeconds += deltaSeconds;
    for (const animated of this.animatedNodes) {
      applyAnimatedNode(animated, this.entryElapsedSeconds);
    }
    for (const fruit of this.fruitButtons) {
      fruit.updateAction(deltaSeconds);
    }
    for (let index = this.activeHearts.length - 1; index >= 0; index -= 1) {
      if (!updateHeart(this.activeHearts[index], deltaSeconds)) {
        this.activeHearts.splice(index, 1);
      }
    }
    this.reviewPhaseSeconds += deltaSeconds;
    applyReviewPulseScale(this.controls.review.node, this.reviewPhaseSeconds);
    if (this.navigationStatus === 'pending') {
      this.navigationElapsedSeconds += deltaSeconds;
    }
  }

  private emitReviewHeart(): void {
    const plan = createMainMenuHeartEmissionPlan(
      this.input.resources.assetTree,
      this.input.viewport,
      this.input.random,
    );
    const resource = this.input.resources.raster(
      getMainMenuRasterResources(this.input.resources.assetTree).heart,
    );
    const presented = createSpriteNode('review-heart', resource, MAX_OPACITY);
    presented.node.setWorldPosition(plan.position.x, plan.position.y, 0);
    presented.node.setScale(plan.scale, plan.scale, 1);
    const heart: RuntimeHeart = {
      elapsedSeconds: 0,
      node: presented.node,
      opacity: presented.opacity,
      plan,
    };
    // The recovered action pair starts before the heart enters Main Menu's root.
    this.startHeartActions(heart);
    try {
      attachPreservingWorld(presented.node, this.root, this.root.children.length);
    } catch (error) {
      const index = this.hearts.indexOf(heart);
      if (index >= 0) {
        this.hearts.splice(index, 1);
      }
      const activeIndex = this.activeHearts.indexOf(heart);
      if (activeIndex >= 0) {
        this.activeHearts.splice(activeIndex, 1);
      }
      presented.node.destroy();
      throw error;
    }
  }

  private startHeartActions(heart: RuntimeHeart): void {
    this.hearts.push(heart);
    this.activeHearts.push(heart);
  }

  private resetActionState(): void {
    this.entryElapsedSeconds = 0;
    this.navigationElapsedSeconds = 0;
    this.navigationStatus = 'idle';
    this.pendingCutFruits.length = 0;
    this.reviewEmissionIndex = 0;
    this.reviewPhaseSeconds = 0;
    for (const animated of this.animatedNodes) {
      animated.node.setWorldPosition(
        animated.layout.initialPosition.x,
        animated.layout.initialPosition.y,
        0,
      );
      if (animated.opacity !== null) {
        animated.opacity.opacity = hasFadeAction(animated.layout.actions) ? 0 : MAX_OPACITY;
      }
      animated.node.setRotationFromEuler(0, 0, 0);
      animated.node.setScale(1, 1, 1);
    }
    setToggleIndex(this.controls.music, 0);
    setToggleIndex(this.controls.effects, 0);
    this.controls.review.node.setScale(1, 1, 1);
  }

  private rollbackActivation(): void {
    this.unregisterBladeEvents();
    try {
      if (this.inputLeaseHeld) {
        this.bladeInput.deactivateForNonClassicScreen();
      }
    } finally {
      this.inputLeaseHeld = false;
      for (const fruit of this.fruitButtons) {
        fruit.deactivateAfterActivationFailure();
      }
      this.input.settings.state.setMusicEnabled(this.originalSettings.musicEnabled);
      this.input.settings.state.setEffectsEnabled(this.originalSettings.effectsEnabled);
      if (this.musicStartedDuringActivation) {
        this.audio.stopBackgroundMusic();
      }
      this.musicStartedDuringActivation = false;
      this.root.active = false;
      this.model = new MainMenuState(this.originalSettings);
      this.resetActionState();
    }
  }

  private canInteract(): boolean {
    return this.activatedValue
      && !this.disposedValue
      && !this.cleanupPoisoned
      && !this.suspendedValue
      && this.navigationStatus === 'idle';
  }

  private findFruit(purpose: MainMenuFruitButtonPurpose): MainMenuFruitPresenter {
    const fruit = this.fruitButtons.find((candidate) => (
      candidate.presentation.purpose === purpose
    ));
    if (fruit === undefined) {
      throw new Error(`Main Menu is missing FruitButton ${purpose}`);
    }
    return fruit;
  }

  private trackPendingCutFruit(purpose: MainMenuFruitButtonPurpose): void {
    const fruit = this.findFruit(purpose);
    if (this.pendingCutFruits.indexOf(fruit) < 0) {
      this.pendingCutFruits.push(fruit);
    }
  }

  private untrackPendingCutFruit(purpose: MainMenuFruitButtonPurpose): void {
    const fruit = this.findFruit(purpose);
    const pendingIndex = this.pendingCutFruits.indexOf(fruit);
    if (pendingIndex >= 0) {
      this.pendingCutFruits.splice(pendingIndex, 1);
    }
  }

  private resumeInputAfterTransitionFailure(): void {
    try {
      this.bladeInput.activateForClassicLayer();
      this.inputLeaseHeld = true;
      this.bladeInput.setCutEnabled(true);
      this.registerBladeEvents();
      this.suspendedValue = false;
    } catch (error) {
      const cleanupFailures: unknown[] = [];
      attemptCleanup(cleanupFailures, () => this.unregisterBladeEvents());
      if (this.inputLeaseHeld) {
        try {
          this.bladeInput.deactivateForNonClassicScreen();
          this.inputLeaseHeld = false;
        } catch (cleanupError) {
          cleanupFailures.push(cleanupError);
        }
      }
      this.suspendedValue = true;
      if (cleanupFailures.length > 0) {
        this.markCleanupPoisoned();
        throw new MainMenuCleanupError(
          'Main Menu navigation rearm rollback failed',
          [error, ...cleanupFailures],
        );
      }
      throw error;
    }
  }

  private markCleanupPoisoned(): void {
    this.cleanupPoisoned = true;
    this.suspendedValue = true;
  }
}

function createSpriteNode(
  name: string,
  resource: LoadedGameRasterResource,
  initialOpacity: number,
): Readonly<{
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly sprite: Sprite;
}> {
  const node = new Node(name);
  const transform = node.addComponent(UITransform);
  transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
  transform.setAnchorPoint(0.5, 0.5);
  const opacity = node.addComponent(UIOpacity);
  opacity.opacity = initialOpacity;
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  return Object.freeze({ node, opacity, sprite });
}

function createToggleSubitem(
  name: string,
  baseResource: LoadedGameRasterResource,
  selectedResource: LoadedGameRasterResource,
): PresentedToggleSubitem {
  const presented = createSpriteNode(name, baseResource, MAX_OPACITY);
  return Object.freeze({
    baseResource,
    node: presented.node,
    selectedResource,
    sprite: presented.sprite,
    transform: presented.node.getComponent(UITransform)!,
  });
}

function imageButtonEvents(
  control: PresentedImageControl,
  callback: () => void,
): RuntimeButtonEvents {
  return Object.freeze({
    cancel: () => {
      control.sprite.spriteFrame = control.normalResource.spriteFrame;
    },
    end: () => {
      control.sprite.spriteFrame = control.normalResource.spriteFrame;
      callback();
    },
    node: control.node,
    start: () => {
      control.sprite.spriteFrame = control.selectedResource.spriteFrame;
    },
  });
}

function toggleButtonEvents(
  control: PresentedToggleControl,
  callback: () => void,
): RuntimeButtonEvents {
  return Object.freeze({
    cancel: () => setTogglePressed(control, false),
    end: () => {
      setTogglePressed(control, false);
      callback();
    },
    node: control.node,
    start: () => setTogglePressed(control, true),
  });
}

function setTogglePressed(control: PresentedToggleControl, pressed: boolean): void {
  const active = control.subitems.find(({ node }) => node.active);
  if (active !== undefined) {
    active.sprite.spriteFrame = pressed
      ? active.selectedResource.spriteFrame
      : active.baseResource.spriteFrame;
  }
}

function toggleIndex(control: PresentedToggleControl): void {
  setToggleIndex(control, control.subitems[0].node.active ? 1 : 0);
}

function setToggleIndex(control: PresentedToggleControl, selectedIndex: 0 | 1): void {
  const selected = control.subitems[selectedIndex];
  if (selected === undefined) {
    throw new RangeError('Main Menu toggle selected index must be 0 or 1');
  }
  control.subitems[0].node.active = selectedIndex === 0;
  control.subitems[1].node.active = selectedIndex === 1;
  for (const subitem of control.subitems) {
    subitem.sprite.spriteFrame = subitem.baseResource.spriteFrame;
  }
  control.transform.setContentSize(
    selected.baseResource.dimensions.width,
    selected.baseResource.dimensions.height,
  );
}

function attachPreservingWorld(node: Node, parent: Node, siblingIndex: number): void {
  applyLayerRecursively(node, parent.layer);
  node.setParent(parent, true);
  node.setSiblingIndex(siblingIndex);
}

function applyLayerRecursively(node: Node, layer: number): void {
  node.layer = layer;
  for (const child of node.children) {
    applyLayerRecursively(child, layer);
  }
}

function applyAnimatedNode(animated: RuntimeAnimatedNode, elapsedSeconds: number): void {
  const move = resolveMove(animated.layout.actions);
  if (move !== null) {
    const elapsedAfterDelay = Math.max(0, elapsedSeconds - move.delaySeconds);
    const progress = move.durationSeconds === 0
      ? 1
      : Math.min(1, elapsedAfterDelay / move.durationSeconds);
    animated.node.setWorldPosition(
      interpolateFloat32(
        animated.layout.initialPosition.x,
        animated.layout.finalPosition.x,
        progress,
      ),
      interpolateFloat32(
        animated.layout.initialPosition.y,
        animated.layout.finalPosition.y,
        progress,
      ),
      0,
    );
  }
  const fadeSeconds = longestFadeSeconds(animated.layout.actions);
  if (animated.opacity !== null && fadeSeconds !== null) {
    animated.opacity.opacity = MAX_OPACITY * Math.min(1, elapsedSeconds / fadeSeconds);
  }
  const rotation = animated.layout.actions.find((action) => action.type === 'repeat-forever');
  if (rotation !== undefined && rotation.type === 'repeat-forever') {
    const phase = elapsedSeconds % rotation.action.durationSeconds;
    const delta = mainMenuLegacyRotationToCreatorDegrees(rotation.action.deltaDegrees);
    animated.node.setRotationFromEuler(
      0,
      0,
      delta * phase / rotation.action.durationSeconds,
    );
  }
}

function resolveMove(actions: readonly MainMenuEntryAction[]): Readonly<{
  readonly delaySeconds: number;
  readonly durationSeconds: number;
}> | null {
  for (const action of actions) {
    if (action.type === 'move-to') {
      return Object.freeze({ delaySeconds: 0, durationSeconds: action.durationSeconds });
    }
    if (action.type === 'sequence') {
      return Object.freeze({
        delaySeconds: action.actions[0].durationSeconds,
        durationSeconds: action.actions[1].durationSeconds,
      });
    }
  }
  return null;
}

function hasFadeAction(actions: readonly MainMenuEntryAction[]): boolean {
  return actions.some((action) => action.type === 'fade-in');
}

function longestFadeSeconds(actions: readonly MainMenuEntryAction[]): number | null {
  let duration: number | null = null;
  for (const action of actions) {
    if (action.type === 'fade-in') {
      duration = duration === null
        ? action.durationSeconds
        : Math.max(duration, action.durationSeconds);
    }
  }
  return duration;
}

function applyReviewPulseScale(node: Node, phaseSeconds: number): void {
  const firstLeg = phaseSeconds <= MAIN_MENU_REVIEW_PULSE_LEG_SECONDS;
  const legElapsed = firstLeg
    ? phaseSeconds
    : phaseSeconds - MAIN_MENU_REVIEW_PULSE_LEG_SECONDS;
  const progress = Math.min(1, legElapsed / MAIN_MENU_REVIEW_PULSE_LEG_SECONDS);
  const start = firstLeg ? 1 : MAIN_MENU_REVIEW_PULSE_APEX_SCALE;
  const end = firstLeg ? MAIN_MENU_REVIEW_PULSE_APEX_SCALE : 1;
  const scale = interpolateFloat32(start, end, progress);
  node.setScale(scale, scale, 1);
}

function updateHeart(heart: RuntimeHeart, deltaSeconds: number): boolean {
  if (heart.elapsedSeconds >= heart.plan.durationSeconds) {
    return false;
  }
  heart.elapsedSeconds = Math.min(
    heart.plan.durationSeconds,
    heart.elapsedSeconds + deltaSeconds,
  );
  const progress = heart.elapsedSeconds / heart.plan.durationSeconds;
  heart.opacity.opacity = MAX_OPACITY * (1 - progress);
  heart.node.setWorldPosition(
    heart.plan.position.x,
    interpolateFloat32(
      heart.plan.position.y,
      heart.plan.position.y + heart.plan.rise,
      progress,
    ),
    0,
  );
  return heart.elapsedSeconds < heart.plan.durationSeconds;
}

function copySettingsSnapshot(snapshot: MainMenuStateInput): MainMenuStateInput {
  if (snapshot === null || typeof snapshot !== 'object') {
    throw new TypeError('Main Menu settings snapshot must be an object');
  }
  return Object.freeze({
    effectsEnabled: snapshot.effectsEnabled,
    musicEnabled: snapshot.musicEnabled,
    networkAvailable: snapshot.networkAvailable,
    rated: snapshot.rated,
    totalCoins: snapshot.totalCoins,
  });
}

function assertInput(input: MainMenuPresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Main Menu presenter input must be an object');
  }
  if (input.resources.assetTree !== input.classicResources.assetTree) {
    throw new Error('Main Menu and Classic blade resource profiles must match');
  }
  if (!isValid(input.resources.font, true)) {
    throw new Error('Main Menu requires its exact loaded SlabThing font');
  }
  assertFunctions(input.audio, [
    'playLoopingBackground',
    'playOneShot',
    'stopAllEffects',
    'stopBackgroundMusic',
  ], 'audio');
  assertFunctions(input.bladeInput, [
    'activateForClassicLayer',
    'deactivateForNonClassicScreen',
    'setCutEnabled',
  ], 'bladeInput');
  if (!isValid(input.bladeInput.node, true)) {
    throw new Error('Main Menu blade event owner must be a valid Creator node');
  }
  assertFunctions(input.raycast, ['callAfterStep', 'raycastAll'], 'raycast');
  assertFunctions(
    input.objectives,
    ['processFruitTypeCut', 'processGlobalFruitCut'],
    'objectives',
  );
  assertFunctions(input.settings, ['persistRatedFlag', 'save'], 'settings');
  assertFunctions(input.settings.state, [
    'addTotalCoins',
    'setEffectsEnabled',
    'setMusicEnabled',
    'setRated',
  ], 'settings.state');
  assertFunctions(input.lifecycle, [
    'onAboutRequested',
    'onExitRequested',
    'onLeaderboardRequested',
    'onModeSelectRequested',
    'onObjectivesRequested',
    'onOptionsRequested',
    'onPlatformReviewRequested',
    'onUnsupportedDestinationRequested',
  ], 'lifecycle');
  assertFunctions(input.random, ['nextDecile', 'nextIntInclusive'], 'random');
  copySettingsSnapshot(input.settings.state.snapshot);
}

function assertFunctions(
  value: unknown,
  names: readonly string[],
  label: string,
): void {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`Main Menu ${label} port must be an object`);
  }
  for (const name of names) {
    if (!(name in value) || typeof (value as Record<string, unknown>)[name] !== 'function') {
      throw new TypeError(`Main Menu ${label} port requires ${name}()`);
    }
  }
}

function interpolateFloat32(start: number, end: number, progress: number): number {
  return Math.fround(Math.fround(start) + Math.fround(
    Math.fround(end - start) * Math.fround(progress),
  ));
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number`);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported Main Menu command: ${String(value)}`);
}

class MainMenuCleanupError extends Error {
  readonly failures: readonly unknown[];

  constructor(message: string, failures: readonly unknown[]) {
    super(`${message}: ${String(failures.length)} failure(s)`);
    this.name = 'MainMenuCleanupError';
    this.failures = Object.freeze([...failures]);
  }
}

function attemptCleanup(failures: unknown[], cleanup: () => unknown): void {
  try {
    cleanup();
  } catch (error) {
    failures.push(error);
  }
}

function throwCleanupFailures(message: string, failures: readonly unknown[]): void {
  if (failures.length > 0) {
    throw new MainMenuCleanupError(message, failures);
  }
}
