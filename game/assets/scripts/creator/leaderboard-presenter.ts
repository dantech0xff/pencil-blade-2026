import {
  Color,
  EventKeyboard,
  Input,
  KeyCode,
  Label,
  Node,
  Sprite,
  UITransform,
  input as cocosInput,
  isValid,
} from 'cc';

import type { Font } from 'cc';

import type { BladeMoveResult } from '../domain/blade-tracks';
import type { ClassicRasterResource } from '../domain/classic-resource-contract';
import {
  LEADERBOARD_BACK_ROTATION_DEGREES,
  LEADERBOARD_ENTRY_SECONDS,
  createLeaderboardPresentation,
  type LeaderboardAnchor,
  type LeaderboardPlayerLabelPresentation,
  type LeaderboardPresentationSnapshot,
  type LeaderboardScoreLabelPresentation,
  type LeaderboardViewport,
} from '../domain/leaderboard-presentation';
import {
  LEADERBOARD_RASTER_RESOURCE_COUNT,
} from '../domain/leaderboard-resource-contract';
import {
  LeaderboardState,
  type LeaderboardBoardsInput,
  type LeaderboardStateSnapshot,
} from '../domain/leaderboard-state';
import {
  CLASSIC_BLADE_BEGAN_EVENT,
  CLASSIC_BLADE_ENDED_EVENT,
  CLASSIC_BLADE_MOVED_EVENT,
  type ClassicBladeBeganEvent,
  type ClassicBladeEndedEvent,
} from './blade-input-controller';
import { createDetachedScreenRoot } from './detached-screen-root';
import type { LoadedGameRasterResource } from './game-resource-loader';
import type { LoadedLeaderboardResources } from './leaderboard-resource-loader';

export interface LeaderboardAudioPort {
  playOneShot(canonicalPath: string): void;
}

export interface LeaderboardBladeInputPort {
  readonly node: Node;
  activateForClassicLayer(): void;
  deactivateForNonClassicScreen(): void;
  setCutEnabled(enabled: boolean): void;
}

export interface LeaderboardSettingsSnapshot extends LeaderboardBoardsInput {
  readonly effectsEnabled: () => boolean;
}

export interface LeaderboardNavigationTransaction {
  readonly destination: 'MainMenuLayer';
  readonly root: Node;
  readonly timing: 'immediate';
  readonly zOrder: 1;
}

export interface LeaderboardPresenterLifecycle {
  readonly onMainMenuRequested: (
    transaction: LeaderboardNavigationTransaction,
  ) => boolean | void;
}

export interface LeaderboardPresenterInput {
  readonly audio: LeaderboardAudioPort;
  readonly bladeInput: LeaderboardBladeInputPort;
  readonly canvas: Node;
  readonly lifecycle: LeaderboardPresenterLifecycle;
  readonly resources: LoadedLeaderboardResources;
  readonly settings: LeaderboardSettingsSnapshot;
  readonly viewport: LeaderboardViewport;
}

export interface LeaderboardGestureSnapshot {
  readonly slot: number;
  readonly touchId: number;
}

export interface LeaderboardPresenterState {
  readonly activated: boolean;
  readonly activeGesture: LeaderboardGestureSnapshot | null;
  readonly disposed: boolean;
  readonly entryElapsedSeconds: number;
  readonly model: LeaderboardStateSnapshot;
  readonly navigationPending: boolean;
  readonly poisoned: boolean;
  readonly suspended: boolean;
}

export class LeaderboardCleanupError extends Error {
  readonly causes: readonly unknown[];

  constructor(message: string, causes: readonly unknown[]) {
    super(message);
    this.name = 'LeaderboardCleanupError';
    this.causes = Object.freeze([...causes]);
  }
}

/** A post-commit effect failed; the already-replaced source screen must stay disposed/inert. */
export class LeaderboardPostCommitAudioError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super(`Leaderboard navigation committed but Back audio failed: ${errorMessage(cause)}`);
    this.name = 'LeaderboardPostCommitAudioError';
    this.cause = cause;
  }
}

/** Dynamic effects policy failed after navigation committed; source ownership stays released. */
export class LeaderboardPostCommitSettingsError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super(`Leaderboard navigation committed but effects settings failed: ${errorMessage(cause)}`);
    this.name = 'LeaderboardPostCommitSettingsError';
    this.cause = cause;
  }
}

interface RuntimeHorizontalGesture {
  lastDeltaX: number;
  lastDeltaY: number;
  readonly slot: number;
  readonly touchId: number;
}

interface RuntimeBackControl {
  readonly node: Node;
  readonly normal: LoadedGameRasterResource;
  readonly selected: LoadedGameRasterResource;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

interface RuntimeGraph {
  readonly back: RuntimeBackControl;
  readonly cards: readonly Node[];
  readonly gestures: Node;
  readonly title: Node;
}

const MAX_LEADERBOARD_UPDATE_SECONDS = 60;
const MAX_OPACITY = 255;
const LEADERBOARD_BLADE_SLOT_COUNT = 4;
const LEADERBOARD_FLICK_MIN_DISTANCE = Math.fround(1);
const SETTINGS_KEYS = Object.freeze([
  'effectsEnabled',
  'classic',
  'crazy',
  'gnStyle',
  'classicBird',
  'crazyBird',
  'comboBird',
] as const);

/** Detached, activation-gated Creator runtime for the recovered Leaderboard screen. */
export class LeaderboardPresenter {
  readonly presentation: LeaderboardPresentationSnapshot;
  readonly root: Node;

  private readonly audio: LeaderboardAudioPort;
  private readonly backControl: RuntimeBackControl;
  private readonly bladeInput: LeaderboardBladeInputPort;
  private readonly cardNodes: readonly Node[];
  private readonly gesturesNode: Node;
  private readonly lifecycle: LeaderboardPresenterLifecycle;
  private readonly model: LeaderboardState;
  private readonly readEffectsEnabled: () => boolean;
  private readonly titleNode: Node;

  private activatedValue = false;
  private activeHorizontalGesture: RuntimeHorizontalGesture | null = null;
  private cleanupPoisoned = false;
  private disposedValue = false;
  private entryElapsedSecondsValue = 0;
  private inputLeaseHeld = false;
  private listenersRegistered = false;
  private navigationPendingValue = false;
  private suspendedValue = false;

  private constructor(input: LeaderboardPresenterInput) {
    const settings = copySettingsSnapshot(input.settings);
    this.model = new LeaderboardState({
      boards: settings.boards,
      logicalWidth: input.viewport.logicalWidth,
    });
    this.presentation = createLeaderboardPresentation(
      input.resources.assetTree,
      input.viewport,
      this.model.snapshot.boards,
    );
    this.audio = input.audio;
    this.bladeInput = input.bladeInput;
    this.lifecycle = input.lifecycle;
    this.readEffectsEnabled = settings.readEffectsEnabled;
    this.root = createDetachedScreenRoot('LeaderboardRoot', input.canvas);

    let graph: RuntimeGraph;
    try {
      graph = constructRuntimeGraph(
        this.root,
        this.presentation,
        input.resources,
      );
      this.root.active = false;
    } catch (error) {
      const cleanupFailures: unknown[] = [];
      if (isValid(this.root, true)) {
        attemptCleanup(cleanupFailures, () => this.root.destroy());
      }
      if (cleanupFailures.length > 0) {
        throw new LeaderboardCleanupError(
          'Leaderboard construction rollback failed',
          [error, ...cleanupFailures],
        );
      }
      throw error;
    }

    this.backControl = graph.back;
    this.cardNodes = graph.cards;
    this.gesturesNode = graph.gestures;
    this.titleNode = graph.title;
  }

  static create(input: LeaderboardPresenterInput): LeaderboardPresenter {
    assertInput(input);
    return new LeaderboardPresenter(input);
  }

  get state(): LeaderboardPresenterState {
    const gesture = this.activeHorizontalGesture;
    return Object.freeze({
      activated: this.activatedValue,
      activeGesture: gesture === null
        ? null
        : Object.freeze({ slot: gesture.slot, touchId: gesture.touchId }),
      disposed: this.disposedValue,
      entryElapsedSeconds: this.entryElapsedSecondsValue,
      model: this.model.snapshot,
      navigationPending: this.navigationPendingValue,
      poisoned: this.cleanupPoisoned,
      suspended: this.suspendedValue,
    });
  }

  activate(): void {
    if (this.disposedValue || !isValid(this.root, true)) {
      throw new Error('Disposed Leaderboard presenter cannot activate');
    }
    if (this.cleanupPoisoned) {
      throw new Error('Poisoned Leaderboard presenter cannot activate');
    }
    if (this.activatedValue) {
      throw new Error('Leaderboard presenter can activate only once');
    }
    assertAttachedActiveHost(this.root, 'Leaderboard root must be host-attached before activation');

    this.resetEntryState();
    this.root.active = true;
    try {
      this.bladeInput.activateForClassicLayer();
      this.inputLeaseHeld = true;
      this.bladeInput.setCutEnabled(false);
      this.registerEvents();
      this.activatedValue = true;
    } catch (error) {
      const cleanupFailures: unknown[] = [];
      attemptCleanup(cleanupFailures, () => this.unregisterEvents());
      this.releaseInputLease(cleanupFailures);
      this.root.active = false;
      if (cleanupFailures.length > 0) {
        this.markCleanupPoisoned();
        throw new LeaderboardCleanupError(
          'Leaderboard activation rollback failed',
          [error, ...cleanupFailures],
        );
      }
      throw error;
    }
  }

  /** One host frame. Rail centering remains deliberately frame-based. */
  update(deltaSeconds: number): void {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (deltaSeconds > MAX_LEADERBOARD_UPDATE_SECONDS) {
      throw new RangeError(
        `deltaSeconds must not exceed ${String(MAX_LEADERBOARD_UPDATE_SECONDS)} seconds`,
      );
    }
    if (!this.activatedValue || this.suspendedValue || this.disposedValue) {
      return;
    }

    this.updateEntry(deltaSeconds);
    const frame = this.model.updateFrame(this.activeHorizontalGesture !== null);
    this.moveCards(frame.appliedDeltaX);
  }

  /** Releases the shared input lease before the host replaces this screen. */
  suspendForTransition(): boolean {
    if (
      this.disposedValue
      || !this.activatedValue
      || this.suspendedValue
      || !this.inputLeaseHeld
    ) {
      return false;
    }

    const failures: unknown[] = [];
    attemptCleanup(failures, () => this.unregisterEvents());
    this.releaseInputLease(failures);
    this.activeHorizontalGesture = null;
    this.suspendedValue = true;
    if (failures.length > 0) {
      this.markCleanupPoisoned();
      throw new LeaderboardCleanupError('Leaderboard suspension failed', failures);
    }
    return true;
  }

  /** Reacquires the same BladeInput instance after a rejected/throwing host replacement. */
  rearmNavigationAfterFailure(): boolean {
    if (this.cleanupPoisoned) {
      throw new LeaderboardCleanupError(
        'Poisoned Leaderboard presenter cannot rearm navigation',
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

    this.navigationPendingValue = false;
    this.activeHorizontalGesture = null;
    this.root.active = true;
    if (this.suspendedValue) {
      try {
        this.bladeInput.activateForClassicLayer();
        this.inputLeaseHeld = true;
        this.bladeInput.setCutEnabled(false);
        this.registerEvents();
        this.suspendedValue = false;
      } catch (error) {
        const cleanupFailures: unknown[] = [];
        attemptCleanup(cleanupFailures, () => this.unregisterEvents());
        this.releaseInputLease(cleanupFailures);
        this.root.active = false;
        if (cleanupFailures.length > 0) {
          this.markCleanupPoisoned();
          throw new LeaderboardCleanupError(
            'Leaderboard navigation rearm rollback failed',
            [error, ...cleanupFailures],
          );
        }
        throw error;
      }
    } else {
      if (!this.inputLeaseHeld) {
        throw new Error('Attached Leaderboard presenter lost its shared BladeInput lease');
      }
      this.bladeInput.setCutEnabled(false);
      this.registerEvents();
    }
    return true;
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.activatedValue = false;
    this.navigationPendingValue = false;
    this.activeHorizontalGesture = null;

    const failures: unknown[] = [];
    attemptCleanup(failures, () => this.unregisterEvents());
    if (this.listenersRegistered) {
      attemptCleanup(failures, () => this.unregisterEvents());
    }
    this.releaseInputLease(failures);
    if (this.inputLeaseHeld) {
      this.releaseInputLease(failures);
    }
    if (isValid(this.root, true)) {
      attemptCleanup(failures, () => this.root.destroy());
    }
    if (failures.length > 0) {
      throw new LeaderboardCleanupError('Leaderboard disposal failed', failures);
    }
    return true;
  }

  private registerEvents(): void {
    if (this.listenersRegistered) {
      return;
    }
    try {
      this.bladeInput.node.on(CLASSIC_BLADE_BEGAN_EVENT, this.onBladeBegan, this);
      this.bladeInput.node.on(CLASSIC_BLADE_MOVED_EVENT, this.onBladeMoved, this);
      this.bladeInput.node.on(CLASSIC_BLADE_ENDED_EVENT, this.onBladeEnded, this);
      this.backControl.node.on(Node.EventType.TOUCH_START, this.onBackStart, this);
      this.backControl.node.on(Node.EventType.TOUCH_END, this.onBackEnd, this);
      this.backControl.node.on(Node.EventType.TOUCH_CANCEL, this.onBackCancel, this);
      cocosInput.on(Input.EventType.KEY_UP, this.onKeyUp, this);
      this.listenersRegistered = true;
    } catch (error) {
      const cleanupFailures = this.unregisterAllEvents();
      if (cleanupFailures.length > 0) {
        this.markCleanupPoisoned();
        throw new LeaderboardCleanupError(
          'Leaderboard listener registration rollback failed',
          [error, ...cleanupFailures],
        );
      }
      throw error;
    }
  }

  private unregisterEvents(): void {
    if (!this.listenersRegistered) {
      this.activeHorizontalGesture = null;
      return;
    }
    const failures = this.unregisterAllEvents();
    if (failures.length > 0) {
      throw new LeaderboardCleanupError(
        'Leaderboard listener removal failed',
        failures,
      );
    }
  }

  private unregisterAllEvents(): unknown[] {
    const failures: unknown[] = [];
    attemptCleanup(
      failures,
      () => this.bladeInput.node.off(
        CLASSIC_BLADE_BEGAN_EVENT,
        this.onBladeBegan,
        this,
      ),
    );
    attemptCleanup(
      failures,
      () => this.bladeInput.node.off(
        CLASSIC_BLADE_MOVED_EVENT,
        this.onBladeMoved,
        this,
      ),
    );
    attemptCleanup(
      failures,
      () => this.bladeInput.node.off(
        CLASSIC_BLADE_ENDED_EVENT,
        this.onBladeEnded,
        this,
      ),
    );
    attemptCleanup(
      failures,
      () => this.backControl.node.off(Node.EventType.TOUCH_START, this.onBackStart, this),
    );
    attemptCleanup(
      failures,
      () => this.backControl.node.off(Node.EventType.TOUCH_END, this.onBackEnd, this),
    );
    attemptCleanup(
      failures,
      () => this.backControl.node.off(
        Node.EventType.TOUCH_CANCEL,
        this.onBackCancel,
        this,
      ),
    );
    attemptCleanup(
      failures,
      () => cocosInput.off(Input.EventType.KEY_UP, this.onKeyUp, this),
    );
    this.listenersRegistered = failures.length > 0;
    this.activeHorizontalGesture = null;
    if (failures.length > 0) {
      this.markCleanupPoisoned();
    }
    return failures;
  }

  private readonly onBladeBegan = (event: ClassicBladeBeganEvent): void => {
    if (
      !this.canInteract()
      || this.activeHorizontalGesture !== null
      || !hasValidBladeBeganPayload(event)
    ) {
      return;
    }
    this.activeHorizontalGesture = {
      lastDeltaX: 0,
      lastDeltaY: 0,
      slot: event.slot,
      touchId: event.touchId,
    };
  };

  private readonly onBladeMoved = (event: BladeMoveResult): void => {
    if (!this.canInteract()) {
      return;
    }
    const gesture = this.activeHorizontalGesture;
    if (
      gesture === null
      || !hasGestureIdentity(event)
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
      this.moveCards(this.model.drag(deltaX).appliedDeltaX);
    }
  };

  private readonly onBladeEnded = (event: ClassicBladeEndedEvent): void => {
    if (!this.canInteract() || !hasValidBladeEndedPayload(event)) {
      return;
    }
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
    const length = gestureDeltaLength(deltaX, deltaY);
    if (
      Number.isFinite(length)
      && length > LEADERBOARD_FLICK_MIN_DISTANCE
      && isHorizontalGestureDelta(deltaX, deltaY)
    ) {
      this.model.flick(deltaX);
    }
  };

  private readonly onBackStart = (): void => {
    if (this.canInteract()) {
      setBackFrame(this.backControl, this.backControl.selected);
    }
  };

  private readonly onBackEnd = (): void => {
    setBackFrame(this.backControl, this.backControl.normal);
    this.requestMainMenu();
  };

  private readonly onBackCancel = (): void => {
    setBackFrame(this.backControl, this.backControl.normal);
  };

  private readonly onKeyUp = (event: EventKeyboard): void => {
    if (event.keyCode === KeyCode.MOBILE_BACK) {
      this.requestMainMenu();
    }
  };

  private requestMainMenu(): void {
    if (!this.canInteract()) {
      return;
    }
    this.navigationPendingValue = true;
    const previousParent = this.root.parent;
    const previousSiblingIndex = this.root.getSiblingIndex();
    const transaction: LeaderboardNavigationTransaction = Object.freeze({
      destination: 'MainMenuLayer',
      root: this.root,
      timing: 'immediate',
      zOrder: 1,
    });

    let committed = false;
    try {
      committed = this.lifecycle.onMainMenuRequested(transaction) !== false;
    } catch (error) {
      this.navigationPendingValue = false;
      this.recoverRejectedNavigation(
        previousParent,
        previousSiblingIndex,
        error,
      );
      throw error;
    }
    if (!committed) {
      this.navigationPendingValue = false;
      this.recoverRejectedNavigation(
        previousParent,
        previousSiblingIndex,
        null,
      );
      return;
    }

    let effectsEnabled: boolean;
    try {
      effectsEnabled = this.readEffectsEnabled();
      if (typeof effectsEnabled !== 'boolean') {
        throw new TypeError('Leaderboard effectsEnabled() must return a boolean');
      }
    } catch (error) {
      throw new LeaderboardPostCommitSettingsError(error);
    }
    if (effectsEnabled) {
      try {
        this.audio.playOneShot(this.presentation.audio.back.canonicalPath);
      } catch (error) {
        throw new LeaderboardPostCommitAudioError(error);
      }
    }
  }

  private recoverRejectedNavigation(
    previousParent: Node | null,
    previousSiblingIndex: number,
    primaryError: unknown,
  ): void {
    const failures: unknown[] = [];
    attemptCleanup(
      failures,
      () => restoreRootAfterRejectedTransaction(
        this.root,
        previousParent,
        previousSiblingIndex,
      ),
    );
    attemptCleanup(failures, () => {
      if (!this.rearmNavigationAfterFailure()) {
        throw new Error('Leaderboard navigation source could not be rearmed');
      }
    });
    if (failures.length > 0) {
      const causes = primaryError === null
        ? failures
        : [primaryError, ...failures];
      throw new LeaderboardCleanupError(
        'Leaderboard rejected-navigation recovery failed',
        causes,
      );
    }
  }

  private resetEntryState(): void {
    this.entryElapsedSecondsValue = 0;
    this.navigationPendingValue = false;
    this.activeHorizontalGesture = null;
    this.titleNode.setWorldPosition(
      this.presentation.shell.title.initialPosition.x,
      this.presentation.shell.title.initialPosition.y,
      0,
    );
    this.backControl.node.setWorldPosition(
      this.presentation.shell.back.initialPosition.x,
      this.presentation.shell.back.initialPosition.y,
      0,
    );
    this.backControl.node.setRotationFromEuler(0, 0, 0);
    setBackFrame(this.backControl, this.backControl.normal);
  }

  private updateEntry(deltaSeconds: number): void {
    this.entryElapsedSecondsValue = Math.min(
      LEADERBOARD_ENTRY_SECONDS,
      this.entryElapsedSecondsValue + deltaSeconds,
    );
    const progress = LEADERBOARD_ENTRY_SECONDS === 0
      ? 1
      : this.entryElapsedSecondsValue / LEADERBOARD_ENTRY_SECONDS;
    const title = this.presentation.shell.title;
    this.titleNode.setWorldPosition(
      interpolateFloat32(title.initialPosition.x, title.finalPosition.x, progress),
      interpolateFloat32(title.initialPosition.y, title.finalPosition.y, progress),
      0,
    );
    const back = this.presentation.shell.back;
    this.backControl.node.setWorldPosition(
      interpolateFloat32(back.initialPosition.x, back.finalPosition.x, progress),
      interpolateFloat32(back.initialPosition.y, back.finalPosition.y, progress),
      0,
    );
    this.backControl.node.setRotationFromEuler(
      0,
      0,
      Math.fround(LEADERBOARD_BACK_ROTATION_DEGREES * Math.fround(progress)),
    );
  }

  private moveCards(deltaX: number): void {
    if (deltaX === 0) {
      return;
    }
    for (const card of this.cardNodes) {
      const worldPosition = card.worldPosition;
      card.setWorldPosition(
        Math.fround(worldPosition.x + deltaX),
        worldPosition.y,
        worldPosition.z,
      );
    }
  }

  private releaseInputLease(failures: unknown[]): void {
    if (!this.inputLeaseHeld) {
      return;
    }
    const failureCountBeforeRelease = failures.length;
    attemptCleanup(failures, () => this.bladeInput.setCutEnabled(false));
    try {
      this.bladeInput.deactivateForNonClassicScreen();
      this.inputLeaseHeld = false;
    } catch (error) {
      failures.push(error);
    }
    if (failures.length > failureCountBeforeRelease) {
      this.markCleanupPoisoned();
    }
  }

  private markCleanupPoisoned(): void {
    this.cleanupPoisoned = true;
    this.suspendedValue = true;
    this.activeHorizontalGesture = null;
  }

  private canInteract(): boolean {
    return (
      this.activatedValue
      && !this.suspendedValue
      && !this.cleanupPoisoned
      && !this.disposedValue
      && !this.navigationPendingValue
    );
  }
}

function constructRuntimeGraph(
  root: Node,
  presentation: LeaderboardPresentationSnapshot,
  resources: LoadedLeaderboardResources,
): RuntimeGraph {
  const gestures = new Node('gestures-layer');
  const gesturesTransform = gestures.addComponent(UITransform);
  gesturesTransform.setAnchorPoint(0.5, 0.5);
  gesturesTransform.setContentSize(
    presentation.viewport.logicalWidth,
    presentation.viewport.logicalHeight,
  );
  gestures.setWorldPosition(
    presentation.viewport.visibleRect.center.x,
    presentation.viewport.visibleRect.center.y,
    0,
  );
  attachPreservingWorld(gestures, root, 0);

  const title = createSpriteNode(
    'title',
    requireRaster(resources, presentation.shell.title.resource),
    presentation.shell.title.anchor,
  );
  title.node.setWorldPosition(
    presentation.shell.title.initialPosition.x,
    presentation.shell.title.initialPosition.y,
    0,
  );
  attachPreservingWorld(title.node, root, 1);

  const backMenu = new Node('back-menu');
  backMenu.setWorldPosition(
    presentation.shell.back.menuPosition.x,
    presentation.shell.back.menuPosition.y,
    0,
  );
  attachPreservingWorld(backMenu, root, 2);
  const backNormal = requireRaster(
    resources,
    presentation.shell.back.resources.normal,
  );
  const backSelected = requireRaster(
    resources,
    presentation.shell.back.resources.selected,
  );
  const backSprite = createSpriteNode(
    'back-item',
    backNormal,
    presentation.shell.back.anchor,
  );
  backSprite.node.setWorldPosition(
    presentation.shell.back.initialPosition.x,
    presentation.shell.back.initialPosition.y,
    0,
  );
  attachPreservingWorld(backSprite.node, backMenu, 0);
  const back = Object.freeze({
    node: backSprite.node,
    normal: backNormal,
    selected: backSelected,
    sprite: backSprite.sprite,
    transform: backSprite.transform,
  });

  const cards = Object.freeze(presentation.cards.map((card) => {
    const cardRoot = new Node(`${card.modeId}-card`);
    cardRoot.setWorldPosition(card.rootPosition.x, card.rootPosition.y, 0);
    attachPreservingWorld(cardRoot, root, card.attachmentInsertion - 1);

    const templateResource = requireRaster(resources, card.template.resource);
    const template = createSpriteNode(
      'template',
      templateResource,
      card.template.anchor,
    );
    template.node.setPosition(
      card.template.localPosition.x,
      card.template.localPosition.y,
      0,
    );
    attachLocal(template.node, cardRoot, card.template.attachmentInsertion - 1);

    for (const player of card.template.playerLabels) {
      const label = createLabelNode(
        `player-${String(player.rank)}`,
        resources.playerFont,
        player,
        templateResource,
        card.template.anchor,
      );
      attachLocal(label, template.node, player.attachmentInsertion - 1);
    }
    for (const score of card.template.scoreLabels) {
      const label = createLabelNode(
        `score-${String(score.rank)}`,
        resources.scoreFont,
        score,
        templateResource,
        card.template.anchor,
      );
      attachLocal(label, template.node, score.attachmentInsertion - 1);
    }

    const header = createSpriteNode(
      'header',
      requireRaster(resources, card.header.resource),
      card.header.anchor,
    );
    header.node.setPosition(
      card.header.localPosition.x,
      card.header.localPosition.y,
      0,
    );
    attachLocal(header.node, cardRoot, card.header.attachmentInsertion - 1);
    return cardRoot;
  }));

  if (cards.length !== 6 || root.children.length !== 9) {
    throw new Error('Leaderboard presenter must construct exactly six card roots');
  }
  return Object.freeze({
    back,
    cards,
    gestures,
    title: title.node,
  });
}

function createSpriteNode(
  name: string,
  resource: LoadedGameRasterResource,
  anchor: LeaderboardAnchor,
): Readonly<{
  readonly node: Node;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}> {
  const node = new Node(name);
  const transform = node.addComponent(UITransform);
  transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
  transform.setAnchorPoint(anchor.x, anchor.y);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  return Object.freeze({ node, sprite, transform });
}

function createLabelNode(
  name: string,
  font: Font,
  presentation:
    | LeaderboardPlayerLabelPresentation
    | LeaderboardScoreLabelPresentation,
  parentResource: LoadedGameRasterResource,
  parentAnchor: LeaderboardAnchor,
): Node {
  const node = new Node(name);
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(presentation.anchor.x, presentation.anchor.y);
  const label = node.addComponent(Label);
  label.font = font;
  label.fontSize = presentation.fontPointSize;
  label.lineHeight = presentation.fontPointSize;
  label.string = presentation.text;
  label.color = new Color(
    presentation.colorRgb.r,
    presentation.colorRgb.g,
    presentation.colorRgb.b,
    MAX_OPACITY,
  );
  node.setPosition(
    Math.fround(
      presentation.localPosition.x
      - Math.fround(parentResource.dimensions.width * parentAnchor.x),
    ),
    Math.fround(
      presentation.localPosition.y
      - Math.fround(parentResource.dimensions.height * parentAnchor.y),
    ),
    0,
  );
  return node;
}

function requireRaster(
  resources: LoadedLeaderboardResources,
  expected: ClassicRasterResource,
): LoadedGameRasterResource {
  const loaded = resources.raster(expected);
  if (
    loaded === null
    || typeof loaded !== 'object'
    || loaded.canonicalPath !== expected.canonicalPath
    || loaded.dimensions.width !== expected.dimensions.width
    || loaded.dimensions.height !== expected.dimensions.height
    || !isValid(loaded.spriteFrame, true)
  ) {
    throw new Error(`Leaderboard raster contract changed: ${expected.canonicalPath}`);
  }
  return loaded;
}

function setBackFrame(
  control: RuntimeBackControl,
  resource: LoadedGameRasterResource,
): void {
  control.sprite.spriteFrame = resource.spriteFrame;
  control.transform.setContentSize(
    resource.dimensions.width,
    resource.dimensions.height,
  );
}

function attachPreservingWorld(node: Node, parent: Node, siblingIndex: number): void {
  applyLayerRecursively(node, parent.layer);
  node.setParent(parent, true);
  node.setSiblingIndex(siblingIndex);
}

function attachLocal(node: Node, parent: Node, siblingIndex: number): void {
  applyLayerRecursively(node, parent.layer);
  node.setParent(parent);
  node.setSiblingIndex(siblingIndex);
}

function applyLayerRecursively(root: Node, layer: number): void {
  root.layer = layer;
  for (const child of root.children) {
    applyLayerRecursively(child, layer);
  }
}

function copySettingsSnapshot(
  settings: LeaderboardSettingsSnapshot,
): Readonly<{
  readonly boards: LeaderboardBoardsInput;
  readonly readEffectsEnabled: () => boolean;
}> {
  assertExactObject(settings, SETTINGS_KEYS, 'Leaderboard settings snapshot');
  const readEffectsEnabled = settings.effectsEnabled;
  if (typeof readEffectsEnabled !== 'function') {
    throw new TypeError('Leaderboard effectsEnabled must be a function');
  }
  return Object.freeze({
    boards: Object.freeze({
      classic: settings.classic,
      crazy: settings.crazy,
      gnStyle: settings.gnStyle,
      classicBird: settings.classicBird,
      crazyBird: settings.crazyBird,
      comboBird: settings.comboBird,
    }),
    readEffectsEnabled: readEffectsEnabled.bind(settings),
  });
}

function restoreRootAfterRejectedTransaction(
  root: Node,
  previousParent: Node | null,
  siblingIndex: number,
): void {
  if (!isValid(root, true)) {
    throw new Error('Leaderboard root was destroyed during a rejected transaction');
  }
  if (
    previousParent === null
    || !isValid(previousParent, true)
    || !previousParent.activeInHierarchy
  ) {
    throw new Error('Leaderboard transaction lost its active source host');
  }
  if (root.parent !== previousParent) {
    root.setParent(previousParent, true);
  }
  root.setSiblingIndex(siblingIndex);
  if (root.getSiblingIndex() !== siblingIndex) {
    throw new Error('Leaderboard transaction could not restore its source sibling index');
  }
  root.active = true;
}

function readFiniteGesturePoint(
  point: unknown,
): Readonly<{ readonly x: number; readonly y: number }> | null {
  if (
    point === null
    || typeof point !== 'object'
    || !('x' in point)
    || !('y' in point)
  ) {
    return null;
  }
  const candidate = point as Readonly<{
    readonly x: unknown;
    readonly y: unknown;
  }>;
  if (
    typeof candidate.x !== 'number'
    || !Number.isFinite(candidate.x)
    || typeof candidate.y !== 'number'
    || !Number.isFinite(candidate.y)
  ) {
    return null;
  }
  return Object.freeze({ x: candidate.x, y: candidate.y });
}

function hasValidBladeBeganPayload(
  event: unknown,
): event is ClassicBladeBeganEvent {
  if (event === null || typeof event !== 'object') {
    return false;
  }
  const candidate = event as Readonly<{
    readonly point?: unknown;
    readonly slot?: unknown;
    readonly touchId?: unknown;
  }>;
  return (
    isGestureTouchId(candidate.touchId)
    && isGestureSlot(candidate.slot)
    && readFiniteGesturePoint(candidate.point) !== null
  );
}

function hasGestureIdentity(event: unknown): event is BladeMoveResult {
  if (
    event === null
    || typeof event !== 'object'
    || !('segment' in event)
  ) {
    return false;
  }
  const segment = (event as Readonly<{ readonly segment?: unknown }>).segment;
  if (segment === null || typeof segment !== 'object') {
    return false;
  }
  const candidate = segment as Readonly<{
    readonly slot?: unknown;
    readonly touchId?: unknown;
  }>;
  return isGestureTouchId(candidate.touchId) && isGestureSlot(candidate.slot);
}

function hasValidBladeEndedPayload(
  event: unknown,
): event is ClassicBladeEndedEvent {
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
    && isGestureTouchId(candidate.touchId)
    && isGestureSlot(candidate.slot)
  );
}

function isGestureTouchId(touchId: unknown): touchId is number {
  return (
    typeof touchId === 'number'
    && Number.isSafeInteger(touchId)
    && touchId !== -1
  );
}

function isGestureSlot(slot: unknown): slot is number {
  return (
    typeof slot === 'number'
    && Number.isSafeInteger(slot)
    && slot >= 0
    && slot < LEADERBOARD_BLADE_SLOT_COUNT
  );
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

function assertInput(input: LeaderboardPresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Leaderboard presenter input must be an object');
  }
  if (input.resources === null || typeof input.resources !== 'object') {
    throw new TypeError('Leaderboard resources must be an object');
  }
  if (input.resources.rasterCount !== LEADERBOARD_RASTER_RESOURCE_COUNT) {
    throw new Error('Leaderboard presenter requires the complete 10-raster catalog');
  }
  if (
    !isValid(input.resources.playerFont, true)
    || !isValid(input.resources.scoreFont, true)
  ) {
    throw new Error('Leaderboard requires its exact loaded Andyb and Century fonts');
  }
  assertFunctions(input.resources, ['raster'], 'resources');
  assertFunctions(input.audio, ['playOneShot'], 'audio');
  assertFunctions(input.bladeInput, [
    'activateForClassicLayer',
    'deactivateForNonClassicScreen',
    'setCutEnabled',
  ], 'bladeInput');
  if (!isValid(input.bladeInput.node, true)) {
    throw new Error('Leaderboard blade event owner must be a valid Creator node');
  }
  assertFunctions(input.lifecycle, ['onMainMenuRequested'], 'lifecycle');
  if (!isValid(input.canvas, true) || !input.canvas.activeInHierarchy) {
    throw new Error('Leaderboard canvas must be valid and active');
  }
}

function assertFunctions(
  value: unknown,
  names: readonly string[],
  label: string,
): void {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`Leaderboard ${label} port must be an object`);
  }
  for (const name of names) {
    if (
      !(name in value)
      || typeof (value as Record<string, unknown>)[name] !== 'function'
    ) {
      throw new TypeError(`Leaderboard ${label} port requires ${name}()`);
    }
  }
}

function assertExactObject(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== expectedKeys.length
    || expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(value, key))
  ) {
    throw new RangeError(`${label} must contain exactly ${expectedKeys.join(', ')}`);
  }
}

function assertAttachedActiveHost(root: Node, message: string): void {
  if (
    root.parent === null
    || !isValid(root.parent, true)
    || !root.parent.activeInHierarchy
  ) {
    throw new Error(message);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number`);
  }
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
