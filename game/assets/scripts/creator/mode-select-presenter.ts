import {
  Collider2D,
  Color,
  EventKeyboard,
  Input,
  KeyCode,
  Label,
  Node,
  Sprite,
  UIOpacity,
  UITransform,
  input as cocosInput,
  isValid,
} from 'cc';

import {
  buildBidirectionalRayPlan,
  createCutDispatchCommands,
  type CutQueryHit,
} from '../domain/classic-cut-query';
import type { BladeMoveResult } from '../domain/blade-tracks';
import type { GameplayRandom } from '../domain/gameplay-random';
import {
  MODE_SELECT_BACK_ROTATION_DEGREES,
  MODE_SELECT_BACK_ROTATION_SECONDS,
  MODE_SELECT_LONG_ROPE_FADE_SECONDS,
  MODE_SELECT_TITLE_MOVE_SECONDS,
  createModeSelectPresentation,
  createModeSelectUnlockBurstPresentation,
  type ModeSelectPoint,
  type ModeSelectPresentationSnapshot,
  type ModeSelectUnlockBurstPresentation,
  type ModeSelectViewport,
} from '../domain/mode-select-presentation';
import type { ModeSelectDestination } from '../domain/mode-select-state';
import {
  MODE_SELECT_CARD_COUNT,
  MODE_SELECT_LOCKABLE_INDICES,
  MODE_SELECT_NAVIGATION_DELAY_SECONDS,
  MODE_SELECT_UNLOCK_PRICE,
  MODE_SELECT_UNLOCK_PARTICLE_REMOVE_AT_SECONDS,
  MODE_SELECT_UNLOCK_PARTICLE_DELAY_SECONDS,
  ModeSelectState,
  createModeSelectBackCommands,
  type ModeSelectIndex,
  type ModeSelectPersistedUnlocks,
  type ModeSelectStateSnapshot,
} from '../domain/mode-select-state';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import {
  CLASSIC_BLADE_BEGAN_EVENT,
  CLASSIC_BLADE_ENDED_EVENT,
  CLASSIC_BLADE_MOVED_EVENT,
  type ClassicBladeBeganEvent,
  type ClassicBladeEndedEvent,
} from './blade-input-controller';
import { ClassicBladePresenter } from './classic-blade-presenter';
import type { LoadedClassicRasterResource } from './classic-resource-loader';
import { createDetachedScreenRoot } from './detached-screen-root';
import type { LoadedGameRasterResource } from './game-resource-loader';
import type { LoadedModeSelectResources } from './mode-select-resource-loader';
import {
  ModeSelectRopeButtonPresenter,
} from './mode-select-rope-button-presenter';

export const MODE_SELECT_HORIZONTAL_DRAG_EVENT = 'mode-select-horizontal-drag';
export const MODE_SELECT_HORIZONTAL_FLICK_EVENT = 'mode-select-horizontal-flick';
export const MODE_SELECT_BACK_KEY_EVENT = 'mode-select-back-key';

export interface ModeSelectAudioPort {
  playOneShot(canonicalPath: string): void;
}

export interface ModeSelectBladeInputPort {
  readonly node: Node;
  activateForClassicLayer(): void;
  deactivateForNonClassicScreen(): void;
  setCutEnabled(enabled: boolean): void;
}

export interface ModeSelectRaycastPort {
  callAfterStep(mutation: () => void): void;
  raycastAll(
    startWorld: Readonly<{ readonly x: number; readonly y: number }>,
    endWorld: Readonly<{ readonly x: number; readonly y: number }>,
  ): readonly Readonly<{ readonly collider: Collider2D }>[];
}

export interface ModeSelectSettingsStatePort {
  readonly snapshot: Readonly<{
    readonly effectsEnabled: boolean;
    readonly totalCoins: number;
  }>;
  addTotalCoins(delta: number): Readonly<{
    readonly delta: number;
    readonly nextTotalCoins: number;
    readonly previousTotalCoins: number;
  }>;
}

export interface ModeSelectSettingsPort {
  readonly state: ModeSelectSettingsStatePort;
  persistModeUnlock(modeIndex: number): void;
  readModeUnlock(modeIndex: number): boolean;
}

export interface ModeSelectClassicResources {
  readonly assetTree: ClassicAssetTree;
  readonly defaultBlade: LoadedClassicRasterResource;
}

export type ModeSelectUnsupportedDestination = Exclude<
  ModeSelectDestination,
  'ClassicModeLayer' | 'CrazyModeLayer' | 'ClassicBirdLayer'
>;

export interface ModeSelectNavigationTransaction {
  readonly destination: ModeSelectDestination | 'MainMenuLayer';
  readonly root: Node;
  readonly timing: 'delayed' | 'immediate';
  readonly zOrder: 1;
}

export interface ModeSelectPresenterLifecycle {
  readonly onClassicRequested: (
    transaction: ModeSelectNavigationTransaction,
  ) => boolean | void;
  readonly onCrazyRequested: (
    transaction: ModeSelectNavigationTransaction,
  ) => boolean | void;
  readonly onClassicBirdRequested: (
    transaction: ModeSelectNavigationTransaction,
  ) => boolean | void;
  readonly onMainMenuRequested: (
    transaction: ModeSelectNavigationTransaction,
  ) => boolean | void;
  readonly onUnsupportedDestinationRequested: (
    destination: ModeSelectUnsupportedDestination,
    transaction: ModeSelectNavigationTransaction,
  ) => boolean | void;
}

export interface ModeSelectPresenterInput {
  readonly audio: ModeSelectAudioPort;
  readonly bladeInput: ModeSelectBladeInputPort;
  readonly canvas: Node;
  readonly classicResources: ModeSelectClassicResources;
  readonly lifecycle: ModeSelectPresenterLifecycle;
  readonly random: Pick<GameplayRandom, 'nextIntInclusive'>;
  readonly raycast: ModeSelectRaycastPort;
  readonly resources: LoadedModeSelectResources;
  readonly settings: ModeSelectSettingsPort;
  readonly viewport: ModeSelectViewport;
}

export interface ModeSelectPresenterState {
  readonly activated: boolean;
  readonly disposed: boolean;
  readonly model: ModeSelectStateSnapshot;
  readonly navigationPendingCount: number;
  readonly suspended: boolean;
  readonly totalCoins: number;
  readonly unlockBurstCount: number;
}

export class ModeSelectCleanupError extends Error {
  readonly causes: readonly unknown[];

  constructor(message: string, causes: readonly unknown[]) {
    super(message);
    this.name = 'ModeSelectCleanupError';
    this.causes = Object.freeze([...causes]);
  }
}

/**
 * The destination failed and one or more source-screen leases could not be restored. The
 * presenter must remain inert; treating this as an ordinary rejected route would reacquire input
 * against an invalid shared Physics2D boundary.
 */
export class ModeSelectFatalNavigationError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(`${message}: ${errorMessage(cause)}`);
    this.name = 'ModeSelectFatalNavigationError';
    this.cause = cause;
  }
}

interface RuntimeShellAnimation {
  readonly kind: 'back' | 'long-rope' | 'title';
  readonly node: Node;
  readonly opacity: UIOpacity | null;
}

interface RuntimeFailureSequence {
  elapsedSeconds: number;
}

interface RuntimeHorizontalGesture {
  lastDeltaX: number;
  lastDeltaY: number;
  readonly slot: number;
  readonly touchId: number;
}

interface RuntimeParticle {
  elapsedSeconds: number;
  readonly node: Node;
  readonly plan: ModeSelectUnlockBurstPresentation['particles'][number];
}

interface RuntimeUnlockBurst {
  readonly container: Node;
  elapsedSeconds: number;
  particles: RuntimeParticle[] | null;
  presentation: ModeSelectUnlockBurstPresentation | null;
}

const MAX_OPACITY = 255;
const MAX_MODE_SELECT_UPDATE_SECONDS = 60;
const MODE_SELECT_BLADE_SLOT_COUNT = 4;
const MODE_SELECT_FLICK_MIN_DISTANCE = 1;
const EPSILON = 1e-7;

/** Detached, activation-gated Creator runtime for the recovered Mode Select foreground. */
export class ModeSelectPresenter {
  readonly blade: ClassicBladePresenter;
  readonly presentation: ModeSelectPresentationSnapshot;
  readonly root: Node;
  readonly ropeButtons: readonly ModeSelectRopeButtonPresenter[];

  private activatedValue = false;
  private readonly activeBladeSlots = new Set<number>();
  private readonly backControl: Readonly<{
    readonly node: Node;
    readonly normal: LoadedGameRasterResource;
    readonly selected: LoadedGameRasterResource;
    readonly sprite: Sprite;
  }>;
  private readonly bladeInput: ModeSelectBladeInputPort;
  private readonly colliderRopeButton = new Map<Collider2D, ModeSelectRopeButtonPresenter>();
  private disposedValue = false;
  private entryElapsedSeconds = 0;
  private readonly failureSequences: RuntimeFailureSequence[] = [];
  private readonly gesturesNode: Node;
  private readonly input: ModeSelectPresenterInput;
  private readonly insufficientLabelNode: Node;
  private readonly insufficientLabelOpacity: UIOpacity;
  private inputLeaseHeld = false;
  private listenersRegistered = false;
  private readonly longRopeOpacity: UIOpacity;
  private model: ModeSelectState;
  private navigationTimers: number[] = [];
  // Full-screen UI touch listeners preempt Creator's global BladeInput dispatcher,
  // so gesture ownership derives from the already-delivered blade event stream.
  private activeHorizontalGesture: RuntimeHorizontalGesture | null = null;
  private readonly persistedUnlocks: ModeSelectPersistedUnlocks;
  private readonly shellAnimations: RuntimeShellAnimation[] = [];
  private suspendedValue = false;
  private readonly unlockBursts: RuntimeUnlockBurst[] = [];

  private constructor(input: ModeSelectPresenterInput) {
    this.input = input;
    this.bladeInput = input.bladeInput;
    this.persistedUnlocks = readPersistedUnlocks(input.settings);
    const settingsSnapshot = copySettingsSnapshot(input.settings.state.snapshot);
    this.presentation = createModeSelectPresentation(
      input.resources.assetTree,
      input.viewport,
      settingsSnapshot.totalCoins,
      this.persistedUnlocks,
    );
    this.model = new ModeSelectState({
      layout: {
        logicalHeight: this.presentation.viewport.logicalHeight,
        logicalWidth: this.presentation.viewport.logicalWidth,
        visibleCenterX: this.presentation.viewport.visibleRect.center.x,
        visibleLeftX: this.presentation.viewport.visibleRect.left.x,
      },
      persistedUnlocks: this.persistedUnlocks,
    });
    this.root = createDetachedScreenRoot('ModeSelectRoot', input.canvas);
    this.root.active = false;
    this.blade = ClassicBladePresenter.create({
      assetTree: input.classicResources.assetTree,
      resource: input.classicResources.defaultBlade,
      selectedBladeId: 0,
      viewportWidth: input.viewport.logicalWidth,
    });

    let ropeButtons: readonly ModeSelectRopeButtonPresenter[] = Object.freeze([]);
    try {
      this.blade.attach(this.root);

      this.gesturesNode = new Node('gestures-layer');
      const gesturesTransform = this.gesturesNode.addComponent(UITransform);
      gesturesTransform.setContentSize(
        this.presentation.viewport.logicalWidth,
        this.presentation.viewport.logicalHeight,
      );
      gesturesTransform.setAnchorPoint(0.5, 0.5);
      this.gesturesNode.setWorldPosition(
        this.presentation.viewport.visibleRect.center.x,
        this.presentation.viewport.visibleRect.center.y,
        0,
      );
      attachPreservingWorld(this.gesturesNode, this.root, 1);

      const title = createSpriteNode(
        'title',
        input.resources.raster(this.presentation.shell.title.resource),
        MAX_OPACITY,
      );
      title.node.setWorldPosition(
        this.presentation.shell.title.initialPosition.x,
        this.presentation.shell.title.initialPosition.y,
        0,
      );
      attachPreservingWorld(title.node, this.root, 2);
      this.shellAnimations.push({ kind: 'title', node: title.node, opacity: null });

      const backMenu = new Node('back-menu');
      backMenu.setWorldPosition(
        this.presentation.shell.back.menuPosition.x,
        this.presentation.shell.back.menuPosition.y,
        0,
      );
      attachPreservingWorld(backMenu, this.root, 3);
      const backNormal = input.resources.raster(this.presentation.shell.back.resources.normal);
      const backSelected = input.resources.raster(
        this.presentation.shell.back.resources.selected,
      );
      const back = createSpriteNode('back-item', backNormal, MAX_OPACITY);
      back.node.setWorldPosition(
        this.presentation.shell.back.initialPosition.x,
        this.presentation.shell.back.initialPosition.y,
        0,
      );
      attachPreservingWorld(back.node, backMenu, 0);
      this.backControl = Object.freeze({
        node: back.node,
        normal: backNormal,
        selected: backSelected,
        sprite: back.sprite,
      });
      this.shellAnimations.push({ kind: 'back', node: back.node, opacity: null });

      const longRope = createSpriteNode(
        'decorative-long-rope',
        input.resources.raster(this.presentation.shell.longRope.resource),
        this.presentation.shell.longRope.fadeSemantics.firstManagerStepOpacity,
      );
      longRope.node.setWorldPosition(
        this.presentation.shell.longRope.position.x,
        this.presentation.shell.longRope.position.y,
        0,
      );
      this.longRopeOpacity = longRope.opacity;
      attachPreservingWorld(longRope.node, this.root, 4);
      this.shellAnimations.push({
        kind: 'long-rope',
        node: longRope.node,
        opacity: longRope.opacity,
      });

      ropeButtons = Object.freeze(this.presentation.cards.map((card, index) => {
        const ropeButton = ModeSelectRopeButtonPresenter.create({
          assetTree: input.resources.assetTree,
          physicsHost: this.gesturesNode,
          presentation: card,
          resources: input.resources,
          viewport: {
            height: input.viewport.logicalHeight,
            width: input.viewport.logicalWidth,
          },
        }, {
          callAfterStep: (mutation) => input.raycast.callAfterStep(mutation),
          onColliderDisposed: (collider) => this.colliderRopeButton.delete(collider),
          onColliderRestored: (collider, presenter) => {
            this.colliderRopeButton.set(collider, presenter);
          },
          onModeSelected: (modeIndex) => this.modeSelected(modeIndex),
          onPlayFruitAudio: (canonicalPath) => input.audio.playOneShot(canonicalPath),
          onUnlockRequested: () => this.unlockCurrentMode(),
        });
        ropeButton.attach(this.root, 5 + index);
        this.colliderRopeButton.set(ropeButton.fruitButton.collider, ropeButton);
        return ropeButton;
      }));

      const labelLayout = this.presentation.shell.insufficientCoinsLabel;
      this.insufficientLabelNode = new Node('insufficient-coins-label');
      const labelTransform = this.insufficientLabelNode.addComponent(UITransform);
      labelTransform.setAnchorPoint(labelLayout.anchor.x, labelLayout.anchor.y);
      this.insufficientLabelOpacity = this.insufficientLabelNode.addComponent(UIOpacity);
      this.insufficientLabelOpacity.opacity = labelLayout.failureInitialOpacity;
      const label = this.insufficientLabelNode.addComponent(Label);
      label.font = input.resources.font;
      label.fontSize = labelLayout.fontPointSize;
      label.string = labelLayout.text;
      label.color = new Color(
        labelLayout.colorRgb.r,
        labelLayout.colorRgb.g,
        labelLayout.colorRgb.b,
        MAX_OPACITY,
      );
      this.insufficientLabelNode.setWorldPosition(
        labelLayout.position.x,
        labelLayout.position.y,
        0,
      );
      attachPreservingWorld(this.insufficientLabelNode, this.root, 11);
      this.insufficientLabelNode.active = labelLayout.visibleAfterConstruction;
    } catch (error) {
      for (const ropeButton of ropeButtons) {
        ropeButton.dispose();
      }
      this.blade.dispose();
      if (isValid(this.root, true)) {
        this.root.destroy();
      }
      throw error;
    }
    this.ropeButtons = ropeButtons;
    if (this.ropeButtons.length !== MODE_SELECT_CARD_COUNT) {
      throw new Error('Mode Select presenter must construct exactly six RopeButtons');
    }
  }

  static create(input: ModeSelectPresenterInput): ModeSelectPresenter {
    assertInput(input);
    return new ModeSelectPresenter(input);
  }

  get state(): ModeSelectPresenterState {
    return Object.freeze({
      activated: this.activatedValue,
      disposed: this.disposedValue,
      model: this.model.snapshot,
      navigationPendingCount: this.navigationTimers.length,
      suspended: this.suspendedValue,
      totalCoins: copySettingsSnapshot(this.input.settings.state.snapshot).totalCoins,
      unlockBurstCount: this.unlockBursts.length,
    });
  }

  activate(): void {
    if (this.disposedValue || !isValid(this.root, true)) {
      throw new Error('Disposed Mode Select presenter cannot activate');
    }
    if (this.activatedValue) {
      throw new Error('Mode Select presenter can activate only once');
    }
    if (
      this.root.parent === null
      || !isValid(this.root.parent, true)
      || !this.root.parent.activeInHierarchy
    ) {
      throw new Error('Mode Select root must be host-attached before activation');
    }

    this.resetEntryState();
    this.root.active = true;
    const activatedRopeButtons: ModeSelectRopeButtonPresenter[] = [];
    try {
      this.registerEvents();
      this.bladeInput.activateForClassicLayer();
      this.inputLeaseHeld = true;
      this.bladeInput.setCutEnabled(true);
      for (const ropeButton of this.ropeButtons) {
        ropeButton.activate();
        activatedRopeButtons.push(ropeButton);
      }
      this.activatedValue = true;
    } catch (error) {
      this.unregisterEvents();
      for (const ropeButton of activatedRopeButtons.reverse()) {
        ropeButton.deactivateAfterActivationFailure();
      }
      if (this.inputLeaseHeld) {
        try {
          this.bladeInput.deactivateForNonClassicScreen();
        } finally {
          this.inputLeaseHeld = false;
        }
      }
      this.root.active = false;
      throw error;
    }
  }

  /** One host frame. Rail centering remains deliberately frame-based, never dt-normalized. */
  update(deltaSeconds: number): void {
    if (!this.activatedValue || this.suspendedValue || this.disposedValue) {
      return;
    }
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (deltaSeconds > MAX_MODE_SELECT_UPDATE_SECONDS) {
      throw new RangeError(
        `deltaSeconds must not exceed ${String(MAX_MODE_SELECT_UPDATE_SECONDS)} seconds`,
      );
    }
    this.blade.updateFrame();
    const frame = this.model.updateFrame(this.activeBladeSlots.size > 0);
    if (frame.appliedDeltaX !== 0) {
      for (const ropeButton of this.ropeButtons) {
        ropeButton.moveAnchor(frame.appliedDeltaX);
      }
    }
    for (const ropeButton of this.ropeButtons) {
      ropeButton.update(deltaSeconds);
    }
    this.updateShell(deltaSeconds);
    this.updateFailureSequences(deltaSeconds);
    this.updateUnlockBursts(deltaSeconds);
    this.updateNavigation(deltaSeconds);
  }

  /** Surrenders event routing but deliberately leaves the shared BladeInput subscription alive. */
  suspendForTransition(): boolean {
    if (
      this.disposedValue
      || !this.activatedValue
      || this.suspendedValue
      || !this.inputLeaseHeld
    ) {
      return false;
    }
    this.unregisterEvents();
    this.activeBladeSlots.clear();
    try {
      this.bladeInput.setCutEnabled(false);
      this.bladeInput.deactivateForNonClassicScreen();
      this.inputLeaseHeld = false;
      this.suspendedValue = true;
      return true;
    } catch (error) {
      try {
        this.registerEvents();
        this.bladeInput.setCutEnabled(true);
      } catch {
        this.unregisterEvents();
      }
      throw error;
    }
  }

  /** Restores an attached screen and recreates every FruitButton consumed by failed navigation. */
  rearmNavigationAfterFailure(): boolean {
    if (
      this.disposedValue
      || !this.activatedValue
      || this.root.parent === null
      || !isValid(this.root.parent, true)
      || !this.root.parent.activeInHierarchy
    ) {
      return false;
    }
    const locks = this.model.snapshot.cardLocks;
    this.navigationTimers = [];
    for (let index = 0; index < this.ropeButtons.length; index += 1) {
      const ropeButton = this.ropeButtons[index];
      const locked = locks[index];
      if (ropeButton === undefined || locked === undefined) {
        throw new Error('Mode Select failure recovery lost one of six card states');
      }
      if (ropeButton.state.cutAccepted || ropeButton.state.wrapperCut) {
        ropeButton.restoreAfterFailedNavigation(locked);
      }
    }
    if (this.suspendedValue) {
      this.root.active = true;
      try {
        this.bladeInput.activateForClassicLayer();
        this.inputLeaseHeld = true;
        this.bladeInput.setCutEnabled(true);
        this.registerEvents();
        this.suspendedValue = false;
      } catch (error) {
        this.unregisterEvents();
        if (this.inputLeaseHeld) {
          try {
            this.bladeInput.deactivateForNonClassicScreen();
          } finally {
            this.inputLeaseHeld = false;
          }
        }
        this.root.active = false;
        throw error;
      }
    } else if (!this.inputLeaseHeld) {
      throw new Error('Attached Mode Select presenter lost its shared BladeInput lease');
    }
    this.bladeInput.setCutEnabled(true);
    return true;
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.activatedValue = false;
    const failures: unknown[] = [];
    attemptCleanup(failures, () => this.unregisterEvents());
    this.activeBladeSlots.clear();
    if (this.inputLeaseHeld) {
      attemptCleanup(failures, () => this.bladeInput.deactivateForNonClassicScreen());
    }
    this.inputLeaseHeld = false;
    for (const ropeButton of this.ropeButtons) {
      attemptCleanup(failures, () => ropeButton.dispose());
    }
    this.colliderRopeButton.clear();
    for (const burst of this.unlockBursts) {
      if (isValid(burst.container, true)) {
        burst.container.destroy();
      }
    }
    this.unlockBursts.length = 0;
    attemptCleanup(failures, () => this.blade.dispose());
    if (isValid(this.root, true)) {
      attemptCleanup(failures, () => this.root.destroy());
    }
    if (failures.length > 0) {
      throw new ModeSelectCleanupError('Mode Select disposal failed', failures);
    }
    return true;
  }

  private registerEvents(): void {
    if (this.listenersRegistered) {
      return;
    }
    this.bladeInput.node.on(CLASSIC_BLADE_BEGAN_EVENT, this.onBladeBegan, this);
    this.bladeInput.node.on(CLASSIC_BLADE_MOVED_EVENT, this.onBladeMoved, this);
    this.bladeInput.node.on(CLASSIC_BLADE_ENDED_EVENT, this.onBladeEnded, this);
    this.gesturesNode.on(MODE_SELECT_HORIZONTAL_DRAG_EVENT, this.onHorizontalDrag, this);
    this.gesturesNode.on(MODE_SELECT_HORIZONTAL_FLICK_EVENT, this.onHorizontalFlick, this);
    this.gesturesNode.on(MODE_SELECT_BACK_KEY_EVENT, this.onBackRequested, this);
    this.backControl.node.on(Node.EventType.TOUCH_START, this.onBackStart, this);
    this.backControl.node.on(Node.EventType.TOUCH_END, this.onBackEnd, this);
    this.backControl.node.on(Node.EventType.TOUCH_CANCEL, this.onBackCancel, this);
    cocosInput.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    this.listenersRegistered = true;
  }

  private unregisterEvents(): void {
    this.activeHorizontalGesture = null;
    if (!this.listenersRegistered) {
      return;
    }
    this.bladeInput.node.off(CLASSIC_BLADE_BEGAN_EVENT, this.onBladeBegan, this);
    this.bladeInput.node.off(CLASSIC_BLADE_MOVED_EVENT, this.onBladeMoved, this);
    this.bladeInput.node.off(CLASSIC_BLADE_ENDED_EVENT, this.onBladeEnded, this);
    this.gesturesNode.off(MODE_SELECT_HORIZONTAL_DRAG_EVENT, this.onHorizontalDrag, this);
    this.gesturesNode.off(MODE_SELECT_HORIZONTAL_FLICK_EVENT, this.onHorizontalFlick, this);
    this.gesturesNode.off(MODE_SELECT_BACK_KEY_EVENT, this.onBackRequested, this);
    this.backControl.node.off(Node.EventType.TOUCH_START, this.onBackStart, this);
    this.backControl.node.off(Node.EventType.TOUCH_END, this.onBackEnd, this);
    this.backControl.node.off(Node.EventType.TOUCH_CANCEL, this.onBackCancel, this);
    cocosInput.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    this.listenersRegistered = false;
  }

  private readonly onBladeBegan = (event: ClassicBladeBeganEvent): void => {
    if (!this.canInteract() || !hasValidBladeBeganPayload(event)) {
      return;
    }
    this.activeBladeSlots.add(event.slot);
    this.blade.begin(event.slot);
    this.blade.move(event.slot, event.point);
    this.beginHorizontalGesture(event);
  };

  private readonly onBladeMoved = (event: BladeMoveResult): void => {
    if (!this.canInteract() || !hasValidBladeMovePayload(event)) {
      return;
    }
    this.blade.move(event.segment.slot, event.segment.current);
    const plan = buildBidirectionalRayPlan({
      end: event.segment.current,
      start: event.segment.previous,
    }, this.presentation.viewport.logicalWidth);
    if (plan !== null) {
      const forwardHits = this.queryHits(plan.forward.start, plan.forward.end);
      const reverseHits = this.queryHits(plan.reverse.start, plan.reverse.end);
      const effectsEnabled = copySettingsSnapshot(
        this.input.settings.state.snapshot,
      ).effectsEnabled;
      for (const command of createCutDispatchCommands(plan, forwardHits, reverseHits)) {
        if (command.type !== 'cut') {
          continue;
        }
        const ropeButton = this.ropeButtons.find(
          ({ targetId }) => targetId === command.targetId,
        );
        ropeButton?.cut(command.segment, effectsEnabled);
      }
    }
    this.moveHorizontalGesture(event);
  };

  private readonly onBladeEnded = (event: ClassicBladeEndedEvent): void => {
    if (!this.canInteract() || !hasValidBladeEndedPayload(event)) {
      return;
    }
    this.activeBladeSlots.delete(event.slot);
    this.blade.end(event.slot);
    this.finishHorizontalGesture(event);
  };

  private beginHorizontalGesture(event: ClassicBladeBeganEvent): void {
    if (this.activeHorizontalGesture !== null) {
      return;
    }
    const point = readFiniteGesturePoint(event.point);
    if (
      point === null
      || !isGestureTouchId(event.touchId)
      || !isGestureSlot(event.slot)
    ) {
      return;
    }
    this.activeHorizontalGesture = {
      lastDeltaX: 0,
      lastDeltaY: 0,
      slot: event.slot,
      touchId: event.touchId,
    };
  }

  private moveHorizontalGesture(event: BladeMoveResult): void {
    const gesture = this.activeHorizontalGesture;
    if (
      gesture === null
      || event.segment.touchId !== gesture.touchId
      || event.segment.slot !== gesture.slot
    ) {
      return;
    }
    const current = readFiniteGesturePoint(event.segment.current);
    const previous = readFiniteGesturePoint(event.segment.previous);
    if (current === null || previous === null) {
      this.activeHorizontalGesture = null;
      return;
    }
    const deltaX = Math.fround(current.x - previous.x);
    const deltaY = Math.fround(current.y - previous.y);
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
      this.activeHorizontalGesture = null;
      return;
    }
    gesture.lastDeltaX = deltaX;
    gesture.lastDeltaY = deltaY;
    if (isHorizontalGestureDelta(deltaX, deltaY)) {
      this.onHorizontalDrag(deltaX);
    }
  }

  private finishHorizontalGesture(event: ClassicBladeEndedEvent): void {
    const gesture = this.activeHorizontalGesture;
    if (
      gesture === null
      || event.touchId !== gesture.touchId
      || event.slot !== gesture.slot
    ) {
      return;
    }
    this.activeHorizontalGesture = null;
    if (event.cancelled) {
      return;
    }
    const { lastDeltaX: deltaX, lastDeltaY: deltaY } = gesture;
    const deltaLength = gestureDeltaLength(deltaX, deltaY);
    if (
      !Number.isFinite(deltaX)
      || !Number.isFinite(deltaY)
      || !Number.isFinite(deltaLength)
      || !isHorizontalGestureDelta(deltaX, deltaY)
      || deltaLength <= MODE_SELECT_FLICK_MIN_DISTANCE
    ) {
      return;
    }
    this.onHorizontalFlick(deltaX);
  }

  private readonly onHorizontalDrag = (payload: unknown): void => {
    if (!this.canInteract()) {
      return;
    }
    const deltaX = readGestureDeltaX(payload, 'horizontal drag');
    const result = this.model.drag(deltaX);
    if (result.appliedDeltaX !== 0) {
      for (const ropeButton of this.ropeButtons) {
        ropeButton.moveAnchor(result.appliedDeltaX);
      }
    }
  };

  private readonly onHorizontalFlick = (payload: unknown): void => {
    if (this.canInteract()) {
      this.model.flick(readGestureDeltaX(payload, 'horizontal flick'));
    }
  };

  private readonly onBackStart = (): void => {
    if (this.canInteract()) {
      this.backControl.sprite.spriteFrame = this.backControl.selected.spriteFrame;
    }
  };

  private readonly onBackEnd = (): void => {
    this.backControl.sprite.spriteFrame = this.backControl.normal.spriteFrame;
    this.requestMainMenu();
  };

  private readonly onBackCancel = (): void => {
    this.backControl.sprite.spriteFrame = this.backControl.normal.spriteFrame;
  };

  private readonly onKeyUp = (event: EventKeyboard): void => {
    if (event.keyCode === KeyCode.MOBILE_BACK) {
      this.requestMainMenu();
    }
  };

  private readonly onBackRequested = (): void => {
    this.requestMainMenu();
  };

  private queryHits(start: ModeSelectPoint, end: ModeSelectPoint): readonly CutQueryHit[] {
    return Object.freeze(this.input.raycast.raycastAll(start, end).map((result) => {
      if (result === null || typeof result !== 'object' || !('collider' in result)) {
        throw new Error('Mode Select raycast returned an invalid hit');
      }
      const ropeButton = this.colliderRopeButton.get(result.collider);
      return Object.freeze({ target: ropeButton?.snapshot() ?? null });
    }));
  }

  private modeSelected(modeIndex: ModeSelectIndex): void {
    const effectsEnabled = copySettingsSnapshot(
      this.input.settings.state.snapshot,
    ).effectsEnabled;
    const previousModel = this.model.snapshot;
    try {
      for (const command of this.model.selectMode(modeIndex, effectsEnabled)) {
        switch (command.type) {
          case 'request-gameplay-selected-audio':
            this.input.audio.playOneShot(command.canonicalPath);
            break;
          case 'schedule-mode-navigation':
            this.navigationTimers.push(0);
            break;
          default:
            assertNever(command);
        }
      }
    } catch (error) {
      this.restoreModelSnapshot(previousModel);
      throw error;
    }
  }

  private updateNavigation(deltaSeconds: number): void {
    if (this.navigationTimers.length === 0) {
      return;
    }
    this.navigationTimers = this.navigationTimers.map((elapsed) => elapsed + deltaSeconds);
    while (
      this.navigationTimers.length > 0
      && (this.navigationTimers[0] ?? 0) + EPSILON >= MODE_SELECT_NAVIGATION_DELAY_SECONDS
    ) {
      this.navigationTimers.shift();
      if (!this.completeDelayedNavigation()) {
        return;
      }
      if (this.disposedValue || this.suspendedValue) {
        return;
      }
    }
  }

  private completeDelayedNavigation(): boolean {
    const commands = this.model.delayedNavigationCommands();
    const destinationCommand = commands.find(
      (command) => command.type === 'attach-mode-destination-to-captured-parent',
    );
    if (
      destinationCommand === undefined
      || destinationCommand.type !== 'attach-mode-destination-to-captured-parent'
    ) {
      return this.failClosedNavigation();
    }
    const parent = this.root.parent;
    const transaction: ModeSelectNavigationTransaction = Object.freeze({
      destination: destinationCommand.destination,
      root: this.root,
      timing: 'delayed',
      zOrder: destinationCommand.zOrder,
    });
    try {
      const result = dispatchModeNavigation(
        this.input.lifecycle,
        destinationCommand.destination,
        transaction,
      );
      if (result === false) {
        restoreRootAfterRejectedTransaction(this.root, parent, transaction.zOrder);
        this.rearmNavigationAfterFailure();
        return false;
      }
      return true;
    } catch (error) {
      restoreRootAfterRejectedTransaction(this.root, parent, transaction.zOrder);
      if (error instanceof ModeSelectFatalNavigationError) {
        this.retainFatalNavigationBoundary();
        throw error;
      }
      this.rearmNavigationAfterFailure();
      throw error;
    }
  }

  private retainFatalNavigationBoundary(): void {
    const cleanupFailures: unknown[] = [];
    this.navigationTimers = [];
    this.activeBladeSlots.clear();
    attemptCleanup(cleanupFailures, () => this.unregisterEvents());
    attemptCleanup(cleanupFailures, () => this.bladeInput.setCutEnabled(false));
    if (this.inputLeaseHeld) {
      attemptCleanup(
        cleanupFailures,
        () => this.bladeInput.deactivateForNonClassicScreen(),
      );
    }
    this.inputLeaseHeld = false;
    this.suspendedValue = true;
    if (cleanupFailures.length > 0) {
      console.error(new ModeSelectCleanupError(
        'Mode Select fatal navigation cleanup failed',
        cleanupFailures,
      ));
    }
  }

  private failClosedNavigation(): false {
    this.rearmNavigationAfterFailure();
    return false;
  }

  private requestMainMenu(): void {
    if (!this.canInteract()) {
      return;
    }
    const effectsEnabled = copySettingsSnapshot(
      this.input.settings.state.snapshot,
    ).effectsEnabled;
    for (const command of createModeSelectBackCommands(effectsEnabled)) {
      if (command.type === 'request-menu-button-audio') {
        this.input.audio.playOneShot(command.canonicalPath);
      }
    }
    const parent = this.root.parent;
    const transaction: ModeSelectNavigationTransaction = Object.freeze({
      destination: 'MainMenuLayer',
      root: this.root,
      timing: 'immediate',
      zOrder: 1,
    });
    try {
      if (this.input.lifecycle.onMainMenuRequested(transaction) === false) {
        restoreRootAfterRejectedTransaction(this.root, parent, transaction.zOrder);
        this.rearmNavigationAfterFailure();
      }
    } catch (error) {
      restoreRootAfterRejectedTransaction(this.root, parent, transaction.zOrder);
      this.rearmNavigationAfterFailure();
      throw error;
    }
  }

  private unlockCurrentMode(): void {
    if (!this.canInteract()) {
      return;
    }
    const totalCoins = copySettingsSnapshot(this.input.settings.state.snapshot).totalCoins;
    if (totalCoins < MODE_SELECT_UNLOCK_PRICE) {
      const outcome = this.model.unlockCurrentMode(totalCoins);
      if (outcome.success) {
        throw new Error('Mode Select state accepted an insufficient unlock balance');
      }
      this.insufficientLabelNode.active = true;
      this.insufficientLabelOpacity.opacity = 0;
      this.failureSequences.push({ elapsedSeconds: 0 });
      return;
    }

    const modeIndex = this.model.snapshot.currentIndex;
    if (modeIndex < 0 || modeIndex >= MODE_SELECT_CARD_COUNT) {
      throw new RangeError('Mode Select unlock requires a selected card');
    }
    const ropeButton = this.ropeButtons[modeIndex];
    if (ropeButton === undefined) {
      throw new Error('Mode Select unlock identified no RopeButton');
    }
    let coinAdjusted = false;
    let unlockPersisted = false;
    try {
      const adjustment = this.input.settings.state.addTotalCoins(-MODE_SELECT_UNLOCK_PRICE);
      coinAdjusted = true;
      if (
        adjustment.previousTotalCoins !== totalCoins
        || adjustment.nextTotalCoins !== totalCoins - MODE_SELECT_UNLOCK_PRICE
      ) {
        throw new Error('Mode Select coin mutation diverged from the recovered price');
      }
      this.input.settings.persistModeUnlock(modeIndex);
      unlockPersisted = true;
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      if (coinAdjusted && !unlockPersisted) {
        attemptCleanup(rollbackFailures, () => {
          const rollback = this.input.settings.state.addTotalCoins(MODE_SELECT_UNLOCK_PRICE);
          if (
            rollback.previousTotalCoins !== totalCoins - MODE_SELECT_UNLOCK_PRICE
            || rollback.nextTotalCoins !== totalCoins
          ) {
            throw new Error('Mode Select coin rollback diverged from the pre-unlock balance');
          }
        });
      }
      if (rollbackFailures.length > 0) {
        throw new ModeSelectCleanupError(
          'Mode Select pre-commit unlock rollback failed',
          [error, ...rollbackFailures],
        );
      }
      throw error;
    }

    // The immediate unlock-key write is the irreversible commit boundary. From here on,
    // runtime state must converge to unlocked even if domain/UI/burst work subsequently fails.
    const beforeDomainUnlock = this.model.snapshot;
    const committedLocks = [...beforeDomainUnlock.cardLocks];
    committedLocks[modeIndex] = false;
    const committedModelSnapshot: ModeSelectStateSnapshot = Object.freeze({
      ...beforeDomainUnlock,
      cardLocks: Object.freeze(committedLocks),
    });
    let pendingBurst: RuntimeUnlockBurst | null = null;
    let burstAttached = false;
    try {
      const outcome = this.model.unlockCurrentMode(totalCoins);
      if (!outcome.success || outcome.modeIndex !== modeIndex) {
        throw new Error('Mode Select state diverged after committed unlock persistence');
      }
      for (const command of outcome.commands) {
        switch (command.type) {
          case 'set-process-total-coins':
            if (
              command.fromRereadValue !== totalCoins
              || command.value !== totalCoins - MODE_SELECT_UNLOCK_PRICE
            ) {
              throw new Error('Mode Select coin mutation diverged from state commands');
            }
            break;
          case 'persist-mode-unlock':
            if (command.modeIndex !== modeIndex) {
              throw new Error('Mode Select persisted a different card than currentIndex');
            }
            break;
          case 'unlock-rope-button': {
            if (command.modeIndex !== modeIndex) {
              throw new Error('Mode Select unlocked a different card than currentIndex');
            }
            ropeButton.unlock();
            break;
          }
          case 'construct-unlock-particle-container':
            if (pendingBurst !== null) {
              throw new Error('Mode Select unlock constructed its particle container twice');
            }
            pendingBurst = this.createUnlockContainer();
            break;
          case 'position-unlock-particle-container': {
            if (pendingBurst === null) {
              throw new Error('Mode Select unlock positioned no particle container');
            }
            pendingBurst.container.setWorldPosition(
              command.worldPosition.x,
              command.worldPosition.y,
              0,
            );
            break;
          }
          case 'configure-unlock-particle-container':
            if (pendingBurst === null) {
              throw new Error('Mode Select unlock configured no particle container');
            }
            break;
          case 'attach-unlock-particle-container': {
            if (pendingBurst === null) {
              throw new Error('Mode Select unlock attached no particle container');
            }
            attachPreservingWorld(
              pendingBurst.container,
              this.root,
              this.root.children.length,
            );
            this.unlockBursts.push(pendingBurst);
            burstAttached = true;
            break;
          }
          case 'show-insufficient-coins-label':
          case 'set-insufficient-coins-label-opacity':
          case 'attach-insufficient-coins-action-sequence':
            throw new Error('Successful Mode Select unlock emitted a failure command');
          default:
            assertNever(command);
        }
      }
      if (!burstAttached) {
        throw new Error('Mode Select unlock did not attach its particle container');
      }
    } catch (error) {
      const convergenceFailures: unknown[] = [];
      attemptCleanup(
        convergenceFailures,
        () => this.restoreModelSnapshot(committedModelSnapshot),
      );
      attemptCleanup(convergenceFailures, () => ropeButton.unlock());
      if (
        pendingBurst !== null
        && !burstAttached
        && isValid(pendingBurst.container, true)
      ) {
        attemptCleanup(convergenceFailures, () => pendingBurst?.container.destroy());
      }
      if (convergenceFailures.length > 0) {
        throw new ModeSelectCleanupError(
          'Mode Select post-commit unlock convergence failed',
          [error, ...convergenceFailures],
        );
      }
      throw error;
    }
  }

  private createUnlockContainer(): RuntimeUnlockBurst {
    const container = new Node('unlock-particle-container');
    const transform = container.addComponent(UITransform);
    transform.setAnchorPoint(
      this.presentation.unlock.particleContainer.anchor.x,
      this.presentation.unlock.particleContainer.anchor.y,
    );
    return {
      container,
      elapsedSeconds: 0,
      particles: null,
      presentation: null,
    };
  }

  private updateShell(deltaSeconds: number): void {
    this.entryElapsedSeconds += deltaSeconds;
    for (const animation of this.shellAnimations) {
      switch (animation.kind) {
        case 'title': {
          const layout = this.presentation.shell.title;
          const progress = Math.min(1, this.entryElapsedSeconds / MODE_SELECT_TITLE_MOVE_SECONDS);
          animation.node.setWorldPosition(
            interpolateFloat32(layout.initialPosition.x, layout.finalPosition.x, progress),
            interpolateFloat32(layout.initialPosition.y, layout.finalPosition.y, progress),
            0,
          );
          break;
        }
        case 'back': {
          const layout = this.presentation.shell.back;
          const progress = Math.min(1, this.entryElapsedSeconds / MODE_SELECT_BACK_ROTATION_SECONDS);
          animation.node.setWorldPosition(
            interpolateFloat32(layout.initialPosition.x, layout.finalPosition.x, progress),
            interpolateFloat32(layout.initialPosition.y, layout.finalPosition.y, progress),
            0,
          );
          animation.node.setRotationFromEuler(
            0,
            0,
            MODE_SELECT_BACK_ROTATION_DEGREES * progress,
          );
          break;
        }
        case 'long-rope': {
          const progress = Math.min(1, this.entryElapsedSeconds / MODE_SELECT_LONG_ROPE_FADE_SECONDS);
          this.longRopeOpacity.opacity = Math.trunc(MAX_OPACITY * progress);
          break;
        }
        default:
          assertNever(animation.kind);
      }
    }
  }

  private updateFailureSequences(deltaSeconds: number): void {
    for (const sequence of this.failureSequences) {
      sequence.elapsedSeconds = Math.min(2, sequence.elapsedSeconds + deltaSeconds);
      const elapsed = sequence.elapsedSeconds;
      if (elapsed <= 0.5) {
        this.insufficientLabelOpacity.opacity = MAX_OPACITY * (elapsed / 0.5);
      } else if (elapsed <= 1.5) {
        this.insufficientLabelOpacity.opacity = MAX_OPACITY;
      } else {
        this.insufficientLabelOpacity.opacity = MAX_OPACITY * (1 - (elapsed - 1.5) / 0.5);
      }
    }
    for (let index = this.failureSequences.length - 1; index >= 0; index -= 1) {
      if ((this.failureSequences[index]?.elapsedSeconds ?? 0) >= 2) {
        this.failureSequences.splice(index, 1);
      }
    }
  }

  private updateUnlockBursts(deltaSeconds: number): void {
    for (let index = this.unlockBursts.length - 1; index >= 0; index -= 1) {
      const burst = this.unlockBursts[index];
      if (burst === undefined) {
        continue;
      }
      const previousElapsed = burst.elapsedSeconds;
      burst.elapsedSeconds = Math.min(
        MODE_SELECT_UNLOCK_PARTICLE_REMOVE_AT_SECONDS,
        burst.elapsedSeconds + deltaSeconds,
      );
      if (
        burst.particles === null
        && previousElapsed < MODE_SELECT_UNLOCK_PARTICLE_DELAY_SECONDS
        && burst.elapsedSeconds + EPSILON >= MODE_SELECT_UNLOCK_PARTICLE_DELAY_SECONDS
      ) {
        burst.presentation = createModeSelectUnlockBurstPresentation(
          this.input.resources.assetTree,
          this.presentation.viewport,
          this.input.random,
        );
        burst.particles = burst.presentation.particles.map((particle) => {
          const root = new Node(`unlock-particle-${particle.actionPlan.index}`);
          root.setPosition(0, 0, 0);
          root.setParent(burst.container);
          root.setSiblingIndex(particle.actionPlan.index);
          const sprite = createSpriteNode(
            'particle-sprite',
            this.input.resources.raster(particle.resource),
            MAX_OPACITY,
          );
          sprite.node.setParent(root);
          sprite.node.setSiblingIndex(0);
          return {
            elapsedSeconds: 0,
            node: root,
            plan: particle,
          };
        });
      }
      if (burst.particles !== null) {
        const actionDelta = previousElapsed < MODE_SELECT_UNLOCK_PARTICLE_DELAY_SECONDS
          ? Math.max(0, burst.elapsedSeconds - MODE_SELECT_UNLOCK_PARTICLE_DELAY_SECONDS)
          : deltaSeconds;
        for (const particle of burst.particles) {
          updateParticle(particle, actionDelta);
        }
      }
      if (burst.elapsedSeconds === MODE_SELECT_UNLOCK_PARTICLE_REMOVE_AT_SECONDS) {
        if (isValid(burst.container, true)) {
          burst.container.destroy();
        }
        this.unlockBursts.splice(index, 1);
      }
    }
  }

  private resetEntryState(): void {
    this.entryElapsedSeconds = 0;
    this.navigationTimers = [];
    this.activeBladeSlots.clear();
    this.failureSequences.length = 0;
    this.insufficientLabelNode.active = false;
    this.insufficientLabelOpacity.opacity = 0;
    const title = this.shellAnimations.find(({ kind }) => kind === 'title');
    const back = this.shellAnimations.find(({ kind }) => kind === 'back');
    title?.node.setWorldPosition(
      this.presentation.shell.title.initialPosition.x,
      this.presentation.shell.title.initialPosition.y,
      0,
    );
    back?.node.setWorldPosition(
      this.presentation.shell.back.initialPosition.x,
      this.presentation.shell.back.initialPosition.y,
      0,
    );
    back?.node.setRotationFromEuler(0, 0, 0);
    this.longRopeOpacity.opacity = 0;
  }

  private restoreModelSnapshot(snapshot: ModeSelectStateSnapshot): void {
    const restoredUnlocks = Object.freeze({
      1: !snapshot.cardLocks[1],
      2: !snapshot.cardLocks[2],
      4: !snapshot.cardLocks[4],
      5: !snapshot.cardLocks[5],
    });
    const restored = new ModeSelectState({
      layout: snapshot.layout,
      persistedUnlocks: restoredUnlocks,
    });
    const initialFirstAnchor = restored.snapshot.anchorXs[0];
    const targetFirstAnchor = snapshot.anchorXs[0];
    if (initialFirstAnchor === undefined || targetFirstAnchor === undefined) {
      throw new Error('Mode Select rollback requires six rail anchors');
    }
    const deltaX = Math.fround(targetFirstAnchor - initialFirstAnchor);
    if (deltaX !== 0) {
      restored.drag(deltaX);
    } else {
      restored.drag(0);
    }
    if (snapshot.currentIndex >= 0) {
      let current = restored.snapshot.currentIndex;
      while (current !== snapshot.currentIndex) {
        if (current < 0) {
          throw new Error('Mode Select rollback cannot restore an unselected rail');
        }
        restored.flick(current < snapshot.currentIndex ? -1 : 1);
        current = restored.snapshot.currentIndex;
      }
    } else if (restored.snapshot.currentIndex !== -1) {
      throw new Error('Mode Select rollback cannot force an unsupported -1 selection');
    }
    if (snapshot.destinationState >= 0) {
      restored.selectMode(snapshot.destinationState, false);
    }
    const restoredSnapshot = restored.snapshot;
    if (
      restoredSnapshot.anchorXs.some((value, index) => value !== snapshot.anchorXs[index])
      || restoredSnapshot.currentIndex !== snapshot.currentIndex
      || restoredSnapshot.destinationState !== snapshot.destinationState
    ) {
      throw new Error('Mode Select rollback could not reproduce the prior model snapshot');
    }
    this.model = restored;
  }

  private canInteract(): boolean {
    return this.activatedValue && !this.suspendedValue && !this.disposedValue;
  }
}

function updateParticle(particle: RuntimeParticle, deltaSeconds: number): void {
  const duration = particle.plan.actionPlan.durationSeconds;
  particle.elapsedSeconds = Math.min(duration, particle.elapsedSeconds + deltaSeconds);
  const progress = duration === 0 ? 1 : particle.elapsedSeconds / duration;
  const delta = particle.plan.actionPlan.deltaLocal;
  particle.node.setPosition(
    interpolateFloat32(0, delta.x, progress),
    interpolateFloat32(0, delta.y, progress),
    0,
  );
  const scale = interpolateFloat32(1, 0, progress);
  particle.node.setScale(scale, scale, 1);
  particle.node.setRotationFromEuler(progress, progress, 0);
}

function createSpriteNode(
  name: string,
  resource: LoadedGameRasterResource,
  initialOpacity: number,
): Readonly<{ readonly node: Node; readonly opacity: UIOpacity; readonly sprite: Sprite }> {
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

function attachPreservingWorld(node: Node, parent: Node, siblingIndex: number): void {
  node.layer = parent.layer;
  applyLayerRecursively(node, parent.layer);
  node.setParent(parent, true);
  node.setSiblingIndex(siblingIndex);
}

function applyLayerRecursively(root: Node, layer: number): void {
  root.layer = layer;
  for (const child of root.children) {
    applyLayerRecursively(child, layer);
  }
}

function readPersistedUnlocks(settings: ModeSelectSettingsPort): ModeSelectPersistedUnlocks {
  const unlocks: Partial<Record<1 | 2 | 4 | 5, boolean>> = {};
  for (const modeIndex of MODE_SELECT_LOCKABLE_INDICES) {
    const unlocked = settings.readModeUnlock(modeIndex);
    if (typeof unlocked !== 'boolean') {
      throw new TypeError(`Mode Select persisted unlock ${modeIndex} must be a boolean`);
    }
    unlocks[modeIndex] = unlocked;
  }
  return Object.freeze(unlocks);
}

function copySettingsSnapshot(snapshot: ModeSelectSettingsStatePort['snapshot']): Readonly<{
  readonly effectsEnabled: boolean;
  readonly totalCoins: number;
}> {
  if (snapshot === null || typeof snapshot !== 'object') {
    throw new TypeError('Mode Select settings snapshot must be an object');
  }
  if (typeof snapshot.effectsEnabled !== 'boolean') {
    throw new TypeError('Mode Select effectsEnabled must be a boolean');
  }
  assertSignedInt32(snapshot.totalCoins, 'Mode Select totalCoins');
  return Object.freeze({
    effectsEnabled: snapshot.effectsEnabled,
    totalCoins: snapshot.totalCoins,
  });
}

function restoreRootAfterRejectedTransaction(
  root: Node,
  previousParent: Node | null,
  siblingIndex: number,
): void {
  if (
    root.parent === null
    && previousParent !== null
    && isValid(root, true)
    && isValid(previousParent, true)
    && previousParent.activeInHierarchy
  ) {
    root.setParent(previousParent, true);
    root.setSiblingIndex(siblingIndex);
  }
  if (root.parent !== null && isValid(root, true)) {
    root.active = true;
  }
}

function readGestureDeltaX(payload: unknown, label: string): number {
  const deltaX = typeof payload === 'number'
    ? payload
    : payload !== null && typeof payload === 'object' && 'deltaX' in payload
      ? (payload as Readonly<{ readonly deltaX: unknown }>).deltaX
      : Number.NaN;
  if (typeof deltaX !== 'number' || !Number.isFinite(deltaX)) {
    throw new RangeError(`Mode Select ${label} requires a finite deltaX`);
  }
  return deltaX;
}

function readFiniteGesturePoint(point: unknown): ModeSelectPoint | null {
  if (
    point === null
    || typeof point !== 'object'
    || !('x' in point)
    || !('y' in point)
  ) {
    return null;
  }
  const { x, y } = point as Readonly<{ readonly x: unknown; readonly y: unknown }>;
  if (
    typeof x !== 'number'
    || !Number.isFinite(x)
    || typeof y !== 'number'
    || !Number.isFinite(y)
  ) {
    return null;
  }
  return Object.freeze({ x, y });
}

function hasValidBladeBeganPayload(event: unknown): event is ClassicBladeBeganEvent {
  if (event === null || typeof event !== 'object') {
    return false;
  }
  const candidate = event as Readonly<{
    readonly point?: unknown;
    readonly slot?: unknown;
    readonly touchId?: unknown;
  }>;
  return (
    typeof candidate.touchId === 'number'
    && isGestureTouchId(candidate.touchId)
    && typeof candidate.slot === 'number'
    && isGestureSlot(candidate.slot)
    && readFiniteGesturePoint(candidate.point) !== null
  );
}

function hasValidBladeMovePayload(event: unknown): event is BladeMoveResult {
  if (
    event === null
    || typeof event !== 'object'
    || !('segment' in event)
    || event.segment === null
    || typeof event.segment !== 'object'
  ) {
    return false;
  }
  const segment = event.segment as Readonly<{
    readonly current?: unknown;
    readonly previous?: unknown;
    readonly slot?: unknown;
    readonly touchId?: unknown;
  }>;
  const current = readFiniteGesturePoint(segment.current);
  const previous = readFiniteGesturePoint(segment.previous);
  if (
    current === null
    || previous === null
    || typeof segment.touchId !== 'number'
    || !isGestureTouchId(segment.touchId)
    || typeof segment.slot !== 'number'
    || !isGestureSlot(segment.slot)
  ) {
    return false;
  }
  return (
    Number.isFinite(Math.fround(current.x - previous.x))
    && Number.isFinite(Math.fround(current.y - previous.y))
  );
}

function hasValidBladeEndedPayload(event: unknown): event is ClassicBladeEndedEvent {
  if (event === null || typeof event !== 'object') {
    return false;
  }
  const candidate = event as Readonly<{
    readonly cancelled?: unknown;
    readonly slot?: unknown;
    readonly touchId?: unknown;
  }>;
  return (
    typeof candidate.cancelled === 'boolean'
    && typeof candidate.touchId === 'number'
    && isGestureTouchId(candidate.touchId)
    && typeof candidate.slot === 'number'
    && isGestureSlot(candidate.slot)
  );
}

function isGestureTouchId(touchId: number): boolean {
  return Number.isSafeInteger(touchId) && touchId !== -1;
}

function isGestureSlot(slot: number): boolean {
  return Number.isSafeInteger(slot) && slot >= 0 && slot < MODE_SELECT_BLADE_SLOT_COUNT;
}

function isHorizontalGestureDelta(deltaX: number, deltaY: number): boolean {
  return Math.abs(deltaX) > Math.abs(deltaY);
}

function gestureDeltaLength(deltaX: number, deltaY: number): number {
  const squaredLength = Math.fround(
    Math.fround(deltaX * deltaX) + Math.fround(deltaY * deltaY),
  );
  return Math.fround(Math.sqrt(squaredLength));
}

function interpolateFloat32(start: number, end: number, progress: number): number {
  return Math.fround(Math.fround(start) + Math.fround(
    Math.fround(end - start) * Math.fround(progress),
  ));
}

function assertInput(input: ModeSelectPresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Mode Select presenter input must be an object');
  }
  if (input.resources.assetTree !== input.classicResources.assetTree) {
    throw new Error('Mode Select and Classic blade resource profiles must match');
  }
  if (input.resources.rasterCount !== 42) {
    throw new Error('Mode Select presenter requires the complete 42-raster catalog');
  }
  if (!isValid(input.resources.font, true)) {
    throw new Error('Mode Select requires its exact loaded SlabThing font');
  }
  assertFunctions(input.audio, ['playOneShot'], 'audio');
  assertFunctions(input.bladeInput, [
    'activateForClassicLayer',
    'deactivateForNonClassicScreen',
    'setCutEnabled',
  ], 'bladeInput');
  if (!isValid(input.bladeInput.node, true)) {
    throw new Error('Mode Select blade event owner must be a valid Creator node');
  }
  assertFunctions(input.raycast, ['callAfterStep', 'raycastAll'], 'raycast');
  assertFunctions(input.settings, ['persistModeUnlock', 'readModeUnlock'], 'settings');
  assertFunctions(input.settings.state, ['addTotalCoins'], 'settings.state');
  assertFunctions(input.lifecycle, [
    'onClassicRequested',
    'onCrazyRequested',
    'onClassicBirdRequested',
    'onMainMenuRequested',
    'onUnsupportedDestinationRequested',
  ], 'lifecycle');
  assertFunctions(input.random, ['nextIntInclusive'], 'random');
  copySettingsSnapshot(input.settings.state.snapshot);
  if (!isValid(input.canvas, true) || !input.canvas.activeInHierarchy) {
    throw new Error('Mode Select canvas must be valid and active');
  }
}

function dispatchModeNavigation(
  lifecycle: ModeSelectPresenterLifecycle,
  destination: ModeSelectDestination,
  transaction: ModeSelectNavigationTransaction,
): boolean | void {
  if (destination === 'ClassicModeLayer') {
    return lifecycle.onClassicRequested(transaction);
  }
  if (destination === 'CrazyModeLayer') {
    return lifecycle.onCrazyRequested(transaction);
  }
  if (destination === 'ClassicBirdLayer') {
    return lifecycle.onClassicBirdRequested(transaction);
  }
  return lifecycle.onUnsupportedDestinationRequested(destination, transaction);
}

function assertFunctions(
  value: unknown,
  names: readonly string[],
  label: string,
): void {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`Mode Select ${label} port must be an object`);
  }
  for (const name of names) {
    if (!(name in value) || typeof (value as Record<string, unknown>)[name] !== 'function') {
      throw new TypeError(`Mode Select ${label} port requires ${name}()`);
    }
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number`);
  }
}

function assertSignedInt32(value: number, label: string): void {
  if (
    !Number.isSafeInteger(value)
    || value < -0x8000_0000
    || value > 0x7fff_ffff
  ) {
    throw new RangeError(`${label} must be a signed 32-bit integer`);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported Mode Select value: ${String(value)}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function attemptCleanup(failures: unknown[], cleanup: () => unknown): void {
  try {
    cleanup();
  } catch (error) {
    failures.push(error);
  }
}
