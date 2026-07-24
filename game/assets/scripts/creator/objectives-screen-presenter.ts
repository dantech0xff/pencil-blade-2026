import {
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

import type { BladeMoveResult } from '../domain/blade-tracks';
import {
  OBJECTIVES_COUNT,
} from '../domain/objectives-manager-state';
import {
  OBJECTIVES_SCREEN_BACK_ROTATION_DEGREES,
  OBJECTIVES_SCREEN_ENTRY_SECONDS,
  createObjectivesScreenListMetrics,
  createObjectivesScreenPresentation,
  type ObjectivesScreenAnchor,
  type ObjectivesScreenFixedCurrentPresentation,
  type ObjectivesScreenObjectiveItemPresentation,
  type ObjectivesScreenPresentationSnapshot,
  type ObjectivesScreenViewport,
} from '../domain/objectives-screen-presentation';
import {
  OBJECTIVES_SCREEN_FONT_CANONICAL_PATH,
  OBJECTIVES_SCREEN_RASTER_RESOURCE_COUNT,
  collectObjectivesScreenRasterResources,
  type ObjectivesScreenRasterResource,
  type ObjectivesScreenTwoFrameRasterSet,
} from '../domain/objectives-screen-resource-contract';
import {
  ObjectivesScreenState,
  type ObjectivesScreenManagerPort,
  type ObjectivesScreenSkipResult,
  type ObjectivesScreenStateSnapshot,
} from '../domain/objectives-screen-state';
import {
  CLASSIC_BLADE_MOVED_EVENT,
} from './blade-input-controller';
import { createDetachedScreenRoot } from './detached-screen-root';
import type { LoadedGameRasterResource } from './game-resource-loader';
import type {
  LoadedObjectivesScreenResources,
} from './objectives-screen-resource-loader';

export interface ObjectivesScreenAudioPort {
  playOneShot(canonicalPath: string): void;
}

export interface ObjectivesScreenBladeInputPort {
  readonly node: Node;
  activateForClassicLayer(): void;
  deactivateForNonClassicScreen(): void;
  setCutEnabled(enabled: boolean): void;
}

export interface ObjectivesScreenSettingsSnapshot {
  readonly effectsEnabled: () => boolean;
}

export interface ObjectivesScreenNavigationTransaction {
  readonly destination: 'MainMenuLayer';
  readonly root: Node;
  readonly timing: 'immediate';
  readonly zOrder: 1;
}

export interface ObjectivesScreenPresenterLifecycle {
  readonly onFatalOwnership: (error: unknown) => void;
  readonly onMainMenuRequested: (
    transaction: ObjectivesScreenNavigationTransaction,
  ) => boolean | void;
}

export interface ObjectivesScreenPresenterInput {
  readonly audio: ObjectivesScreenAudioPort;
  readonly bladeInput: ObjectivesScreenBladeInputPort;
  readonly canvas: Node;
  readonly lifecycle: ObjectivesScreenPresenterLifecycle;
  readonly manager: ObjectivesScreenManagerPort;
  readonly resources: LoadedObjectivesScreenResources;
  readonly settings: ObjectivesScreenSettingsSnapshot;
  readonly viewport: ObjectivesScreenViewport;
}

export interface ObjectivesScreenPresenterState {
  readonly activated: boolean;
  readonly disposed: boolean;
  readonly entryElapsedSeconds: number;
  readonly fatalOwnership: boolean;
  readonly model: ObjectivesScreenStateSnapshot;
  readonly navigationPending: boolean;
  readonly poisoned: boolean;
  readonly skipPending: boolean;
  readonly suspended: boolean;
}

export class ObjectivesScreenCleanupError extends Error {
  readonly causes: readonly unknown[];

  constructor(message: string, causes: readonly unknown[]) {
    super(message);
    this.name = 'ObjectivesScreenCleanupError';
    this.causes = Object.freeze([...causes]);
  }
}

/** Skip may already be durable; this source is deliberately poisoned instead of replaying it. */
export class ObjectivesScreenSkipOwnershipError extends Error {
  readonly cause: unknown;
  readonly cleanupFailures: readonly unknown[];
  readonly commitMayHaveOccurred = true;

  constructor(cause: unknown, cleanupFailures: readonly unknown[]) {
    super(
      `Objectives screen Skip failed after mutation began: ${errorMessage(cause)}`,
    );
    this.name = 'ObjectivesScreenSkipOwnershipError';
    this.cause = cause;
    this.cleanupFailures = Object.freeze([...cleanupFailures]);
  }
}

/** Progression committed but the local targeted refresh failed; never roll the skip back. */
export class ObjectivesScreenPostCommitRefreshError extends Error {
  readonly cause: unknown;
  readonly cleanupFailures: readonly unknown[];

  constructor(cause: unknown, cleanupFailures: readonly unknown[]) {
    super(
      `Objectives screen Skip committed but refresh failed: ${errorMessage(cause)}`,
    );
    this.name = 'ObjectivesScreenPostCommitRefreshError';
    this.cause = cause;
    this.cleanupFailures = Object.freeze([...cleanupFailures]);
  }
}

interface RuntimeSprite {
  readonly node: Node;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

interface RuntimeFadingSprite extends RuntimeSprite {
  readonly opacity: UIOpacity;
}

interface RuntimeObjectiveItem {
  readonly background: RuntimeSprite;
  readonly description: Label;
  readonly descriptionNode: Node;
  readonly reward: Label;
  readonly rewardNode: Node;
  readonly root: Node;
}

interface RuntimeButtonControl {
  readonly node: Node;
  readonly normal: LoadedGameRasterResource;
  readonly selected: LoadedGameRasterResource;
  readonly visual: RuntimeSprite;
}

interface RuntimeGraph {
  readonly back: RuntimeButtonControl;
  readonly background: RuntimeFadingSprite;
  readonly fixedCurrent: RuntimeObjectiveItem;
  readonly footer: RuntimeFadingSprite;
  readonly header: RuntimeFadingSprite;
  readonly menu: Node;
  readonly rows: readonly RuntimeObjectiveItem[];
  readonly skip: RuntimeButtonControl;
}

const MAX_OBJECTIVES_UPDATE_SECONDS = 60;
const OPAQUE_CHANNEL = 255;
const SETTINGS_KEYS = Object.freeze(['effectsEnabled'] as const);

/** Detached, activation-gated Creator runtime for the recovered Objectives screen. */
export class ObjectivesScreenPresenter {
  readonly root: Node;

  private readonly audio: ObjectivesScreenAudioPort;
  private readonly bladeInput: ObjectivesScreenBladeInputPort;
  private readonly graph: RuntimeGraph;
  private readonly lifecycle: ObjectivesScreenPresenterLifecycle;
  private readonly model: ObjectivesScreenState;
  private readonly readEffectsEnabled: () => boolean;
  private readonly resources: LoadedObjectivesScreenResources;
  private readonly viewport: ObjectivesScreenViewport;

  private activatedValue = false;
  private cleanupPoisoned = false;
  private disposedValue = false;
  private entryElapsedSecondsValue = 0;
  private fatalOwnershipNotified = false;
  private fatalOwnershipValue = false;
  private inputLeaseHeld = false;
  private listenersRegistered = false;
  private navigationPendingValue = false;
  private presentationValue: ObjectivesScreenPresentationSnapshot;
  private skipPendingValue = false;
  private suspendedValue = false;

  private constructor(input: ObjectivesScreenPresenterInput) {
    const readEffectsEnabled = copyEffectsReader(input.settings);
    const listMetrics = createObjectivesScreenListMetrics(
      input.resources.assetTree,
      input.viewport,
    );
    this.model = new ObjectivesScreenState({
      listMetrics,
      manager: input.manager,
    });
    this.presentationValue = createObjectivesScreenPresentation(
      input.resources.assetTree,
      input.viewport,
      this.model.snapshot,
    );
    this.audio = input.audio;
    this.bladeInput = input.bladeInput;
    this.lifecycle = input.lifecycle;
    this.readEffectsEnabled = readEffectsEnabled;
    this.resources = input.resources;
    this.viewport = this.presentationValue.viewport;
    this.root = createDetachedScreenRoot('ObjectivesRoot', input.canvas);

    let graph: RuntimeGraph;
    try {
      graph = constructRuntimeGraph(
        this.root,
        this.presentationValue,
        input.resources,
      );
      this.root.active = false;
    } catch (error) {
      const cleanupFailures: unknown[] = [];
      if (isValid(this.root, true)) {
        attemptCleanup(cleanupFailures, () => this.root.destroy());
      }
      if (cleanupFailures.length > 0) {
        throw new ObjectivesScreenCleanupError(
          'Objectives screen construction rollback failed',
          [error, ...cleanupFailures],
        );
      }
      throw error;
    }
    this.graph = graph;
  }

  static create(input: ObjectivesScreenPresenterInput): ObjectivesScreenPresenter {
    assertInput(input);
    return new ObjectivesScreenPresenter(input);
  }

  get presentation(): ObjectivesScreenPresentationSnapshot {
    return this.presentationValue;
  }

  get state(): ObjectivesScreenPresenterState {
    return Object.freeze({
      activated: this.activatedValue,
      disposed: this.disposedValue,
      entryElapsedSeconds: this.entryElapsedSecondsValue,
      fatalOwnership: this.fatalOwnershipValue,
      model: this.model.snapshot,
      navigationPending: this.navigationPendingValue,
      poisoned: this.cleanupPoisoned,
      skipPending: this.skipPendingValue,
      suspended: this.suspendedValue,
    });
  }

  activate(): void {
    if (this.disposedValue || !isValid(this.root, true)) {
      throw new Error('Disposed Objectives screen presenter cannot activate');
    }
    if (this.cleanupPoisoned || this.fatalOwnershipValue) {
      throw new Error('Poisoned Objectives screen presenter cannot activate');
    }
    if (this.activatedValue) {
      throw new Error('Objectives screen presenter can activate only once');
    }
    assertAttachedActiveHost(
      this.root,
      'Objectives screen root must be host-attached before activation',
    );

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
        throw new ObjectivesScreenCleanupError(
          'Objectives screen activation rollback failed',
          [error, ...cleanupFailures],
        );
      }
      throw error;
    }
  }

  update(deltaSeconds: number): void {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (deltaSeconds > MAX_OBJECTIVES_UPDATE_SECONDS) {
      throw new RangeError(
        `deltaSeconds must not exceed ${MAX_OBJECTIVES_UPDATE_SECONDS} seconds`,
      );
    }
    if (!this.activatedValue || this.suspendedValue || this.disposedValue) {
      return;
    }
    this.updateEntry(deltaSeconds);
  }

  /** Releases the one process-wide BladeInput lease before foreground replacement. */
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
    this.skipPendingValue = false;
    this.suspendedValue = true;
    if (failures.length > 0) {
      this.markCleanupPoisoned();
      throw new ObjectivesScreenCleanupError(
        'Objectives screen suspension failed',
        failures,
      );
    }
    return true;
  }

  /** Reacquires the same input lease after a rejected/throwing shell transaction. */
  rearmNavigationAfterFailure(): boolean {
    if (this.cleanupPoisoned || this.fatalOwnershipValue) {
      throw new ObjectivesScreenCleanupError(
        'Poisoned Objectives screen presenter cannot rearm navigation',
        [new Error('A prior cleanup or committed Skip refresh did not complete')],
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
    this.skipPendingValue = false;
    this.root.active = true;
    setButtonFrame(this.graph.back, this.graph.back.normal);
    setButtonFrame(this.graph.skip, this.graph.skip.normal);
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
          throw new ObjectivesScreenCleanupError(
            'Objectives screen navigation rearm rollback failed',
            [error, ...cleanupFailures],
          );
        }
        throw error;
      }
    } else {
      if (!this.inputLeaseHeld) {
        throw new Error(
          'Attached Objectives screen presenter lost its shared BladeInput lease',
        );
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
    this.skipPendingValue = false;

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
      throw new ObjectivesScreenCleanupError(
        'Objectives screen disposal failed',
        failures,
      );
    }
    return true;
  }

  private registerEvents(): void {
    if (this.listenersRegistered) {
      return;
    }
    try {
      this.bladeInput.node.on(
        CLASSIC_BLADE_MOVED_EVENT,
        this.onBladeMoved,
        this,
      );
      this.graph.back.node.on(
        Node.EventType.TOUCH_START,
        this.onBackStart,
        this,
      );
      this.graph.back.node.on(Node.EventType.TOUCH_END, this.onBackEnd, this);
      this.graph.back.node.on(
        Node.EventType.TOUCH_CANCEL,
        this.onBackCancel,
        this,
      );
      this.graph.skip.node.on(
        Node.EventType.TOUCH_START,
        this.onSkipStart,
        this,
      );
      this.graph.skip.node.on(Node.EventType.TOUCH_END, this.onSkipEnd, this);
      this.graph.skip.node.on(
        Node.EventType.TOUCH_CANCEL,
        this.onSkipCancel,
        this,
      );
      cocosInput.on(Input.EventType.KEY_UP, this.onKeyUp, this);
      this.listenersRegistered = true;
    } catch (error) {
      const cleanupFailures = this.unregisterAllEvents();
      if (cleanupFailures.length > 0) {
        this.markCleanupPoisoned();
        throw new ObjectivesScreenCleanupError(
          'Objectives screen listener registration rollback failed',
          [error, ...cleanupFailures],
        );
      }
      throw error;
    }
  }

  private unregisterEvents(): void {
    if (!this.listenersRegistered) {
      return;
    }
    const failures = this.unregisterAllEvents();
    if (failures.length > 0) {
      throw new ObjectivesScreenCleanupError(
        'Objectives screen listener removal failed',
        failures,
      );
    }
  }

  private unregisterAllEvents(): unknown[] {
    const failures: unknown[] = [];
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
      () => this.graph.back.node.off(
        Node.EventType.TOUCH_START,
        this.onBackStart,
        this,
      ),
    );
    attemptCleanup(
      failures,
      () => this.graph.back.node.off(
        Node.EventType.TOUCH_END,
        this.onBackEnd,
        this,
      ),
    );
    attemptCleanup(
      failures,
      () => this.graph.back.node.off(
        Node.EventType.TOUCH_CANCEL,
        this.onBackCancel,
        this,
      ),
    );
    attemptCleanup(
      failures,
      () => this.graph.skip.node.off(
        Node.EventType.TOUCH_START,
        this.onSkipStart,
        this,
      ),
    );
    attemptCleanup(
      failures,
      () => this.graph.skip.node.off(
        Node.EventType.TOUCH_END,
        this.onSkipEnd,
        this,
      ),
    );
    attemptCleanup(
      failures,
      () => this.graph.skip.node.off(
        Node.EventType.TOUCH_CANCEL,
        this.onSkipCancel,
        this,
      ),
    );
    attemptCleanup(
      failures,
      () => cocosInput.off(Input.EventType.KEY_UP, this.onKeyUp, this),
    );
    this.listenersRegistered = failures.length > 0;
    if (failures.length > 0) {
      this.markCleanupPoisoned();
    }
    return failures;
  }

  private readonly onBladeMoved = (event: BladeMoveResult): void => {
    if (!this.canInteract()) {
      return;
    }
    const points = readBladeMovePoints(event);
    if (points === null) {
      return;
    }
    const deltaY = Math.fround(points.current.y - points.previous.y);
    if (!Number.isFinite(deltaY)) {
      return;
    }
    const movement = this.model.drag(deltaY);
    if (movement.appliedMovementY === 0) {
      return;
    }
    try {
      this.moveOrdinaryRows(movement.appliedMovementY);
    } catch (error) {
      const cleanupFailures = this.poisonFatalOwnership(error);
      throw new ObjectivesScreenCleanupError(
        'Objectives screen row projection failed',
        [error, ...cleanupFailures],
      );
    }
  };

  private readonly onBackStart = (): void => {
    if (this.canInteract()) {
      setButtonFrame(this.graph.back, this.graph.back.selected);
    }
  };

  private readonly onBackEnd = (): void => {
    setButtonFrame(this.graph.back, this.graph.back.normal);
    this.requestMainMenu(true);
  };

  private readonly onBackCancel = (): void => {
    setButtonFrame(this.graph.back, this.graph.back.normal);
  };

  private readonly onSkipStart = (): void => {
    if (this.canInteract()) {
      setButtonFrame(this.graph.skip, this.graph.skip.selected);
    }
  };

  private readonly onSkipEnd = (): void => {
    setButtonFrame(this.graph.skip, this.graph.skip.normal);
    this.requestSkip();
  };

  private readonly onSkipCancel = (): void => {
    setButtonFrame(this.graph.skip, this.graph.skip.normal);
  };

  private readonly onKeyUp = (event: EventKeyboard): void => {
    if (event.keyCode === KeyCode.MOBILE_BACK) {
      this.requestMainMenu(false);
    }
  };

  private requestSkip(): void {
    if (!this.canInteract()) {
      return;
    }
    this.skipPendingValue = true;
    try {
      this.preflightSkip();
      this.playMenuClickIfEnabled(
        this.presentationValue.audio.skip.canonicalPath,
      );
    } catch (error) {
      this.skipPendingValue = false;
      throw error;
    }

    let result: ObjectivesScreenSkipResult;
    try {
      result = this.model.skipActiveObjective();
    } catch (error) {
      const cleanupFailures = this.poisonFatalOwnership(error);
      throw new ObjectivesScreenSkipOwnershipError(error, cleanupFailures);
    }

    try {
      this.refreshAfterCommittedSkip(result);
      this.skipPendingValue = false;
    } catch (error) {
      const cleanupFailures = this.poisonFatalOwnership(error);
      throw new ObjectivesScreenPostCommitRefreshError(
        error,
        cleanupFailures,
      );
    }
  }

  private refreshAfterCommittedSkip(result: ObjectivesScreenSkipResult): void {
    const refreshed = createObjectivesScreenPresentation(
      this.resources.assetTree,
      this.viewport,
      this.model.snapshot,
    );
    if (
      refreshed.fixedCurrent.objective.id
        !== result.nextActiveObjective.id
      || refreshed.fixedCurrent.objective.sequencePosition
        !== result.nextActiveObjective.sequencePosition
    ) {
      throw new Error(
        'Objectives screen fixed card does not match authoritative post-Skip state',
      );
    }

    // Native order: fixed current definition/text first, then one ordinary background.
    applyFixedCurrentPresentation(
      this.graph.fixedCurrent,
      refreshed.fixedCurrent,
      this.resources,
    );
    const nextPosition = result.nextActiveObjective.sequencePosition;
    const targetRowIndex = nextPosition === 0 ? 0 : nextPosition - 1;
    const rowPresentation = refreshed.rows[targetRowIndex];
    const row = this.graph.rows[targetRowIndex];
    if (rowPresentation === undefined || row === undefined) {
      throw new Error(
        `Objectives screen targeted row ${targetRowIndex} is unavailable`,
      );
    }
    applyRowBackground(row, rowPresentation, this.resources);
    this.presentationValue = refreshed;
  }

  private preflightSkip(): void {
    assertAttachedActiveHost(
      this.root,
      'Objectives screen Skip requires its active attached root',
    );
    if (!isValid(this.resources.arialFont.font, true)) {
      throw new Error('Objectives screen Arial font became invalid before Skip');
    }
    for (const contract of collectObjectivesScreenRasterResources(
      this.resources.assetTree,
    )) {
      requireRaster(this.resources, contract);
    }
    assertRuntimeGraphIntegrity(this.root, this.graph);
    // Force the authoritative snapshot read before the irreversible manager call.
    const snapshot = this.model.snapshot;
    if (
      snapshot.rows.length !== OBJECTIVES_COUNT
      || snapshot.currentCard.objective.sequencePosition < 0
      || snapshot.currentCard.objective.sequencePosition >= OBJECTIVES_COUNT
    ) {
      throw new Error('Objectives screen state is incomplete before Skip');
    }
  }

  private requestMainMenu(playVisibleBackAudio: boolean): void {
    if (!this.canInteract()) {
      return;
    }
    this.navigationPendingValue = true;
    const previousParent = this.root.parent;
    const previousSiblingIndex = this.root.getSiblingIndex();

    try {
      if (playVisibleBackAudio) {
        this.playMenuClickIfEnabled(
          this.presentationValue.audio.visibleBack.canonicalPath,
        );
      }
    } catch (error) {
      this.navigationPendingValue = false;
      throw error;
    }

    const transaction: ObjectivesScreenNavigationTransaction = Object.freeze({
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
    }
  }

  private playMenuClickIfEnabled(canonicalPath: string): void {
    const effectsEnabled = this.readEffectsEnabled();
    if (typeof effectsEnabled !== 'boolean') {
      throw new TypeError(
        'Objectives screen effectsEnabled() must return a boolean',
      );
    }
    if (effectsEnabled) {
      this.audio.playOneShot(canonicalPath);
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
        throw new Error('Objectives screen navigation source could not be rearmed');
      }
    });
    if (failures.length > 0) {
      throw new ObjectivesScreenCleanupError(
        'Objectives screen rejected-navigation recovery failed',
        primaryError === null ? failures : [primaryError, ...failures],
      );
    }
  }

  private resetEntryState(): void {
    this.entryElapsedSecondsValue = 0;
    this.navigationPendingValue = false;
    this.skipPendingValue = false;
    this.graph.background.opacity.opacity = 0;
    this.graph.header.opacity.opacity = 0;
    this.graph.footer.opacity.opacity = 0;
    this.graph.back.node.setWorldPosition(
      this.presentationValue.menu.back.initialPosition.x,
      this.presentationValue.menu.back.initialPosition.y,
      0,
    );
    this.graph.back.node.setRotationFromEuler(0, 0, 0);
    this.graph.skip.node.setWorldPosition(
      this.presentationValue.menu.skip.initialPosition.x,
      this.presentationValue.menu.skip.initialPosition.y,
      0,
    );
    setButtonFrame(this.graph.back, this.graph.back.normal);
    setButtonFrame(this.graph.skip, this.graph.skip.normal);
  }

  private updateEntry(deltaSeconds: number): void {
    this.entryElapsedSecondsValue = Math.min(
      OBJECTIVES_SCREEN_ENTRY_SECONDS,
      this.entryElapsedSecondsValue + deltaSeconds,
    );
    const progress = OBJECTIVES_SCREEN_ENTRY_SECONDS === 0
      ? 1
      : this.entryElapsedSecondsValue / OBJECTIVES_SCREEN_ENTRY_SECONDS;
    const opacity = Math.fround(OPAQUE_CHANNEL * Math.fround(progress));
    this.graph.background.opacity.opacity = opacity;
    this.graph.header.opacity.opacity = opacity;
    this.graph.footer.opacity.opacity = opacity;

    const back = this.presentationValue.menu.back;
    this.graph.back.node.setWorldPosition(
      interpolateFloat32(
        back.initialPosition.x,
        back.finalPosition.x,
        progress,
      ),
      interpolateFloat32(
        back.initialPosition.y,
        back.finalPosition.y,
        progress,
      ),
      0,
    );
    this.graph.back.node.setRotationFromEuler(
      0,
      0,
      Math.fround(
        OBJECTIVES_SCREEN_BACK_ROTATION_DEGREES * Math.fround(progress),
      ),
    );
    const skip = this.presentationValue.menu.skip;
    this.graph.skip.node.setWorldPosition(
      interpolateFloat32(
        skip.initialPosition.x,
        skip.finalPosition.x,
        progress,
      ),
      interpolateFloat32(
        skip.initialPosition.y,
        skip.finalPosition.y,
        progress,
      ),
      0,
    );
  }

  private moveOrdinaryRows(movementY: number): void {
    if (!Number.isFinite(movementY) || movementY === 0) {
      return;
    }
    if (this.graph.rows.length !== OBJECTIVES_COUNT) {
      throw new Error('Objectives screen lost an ordinary row');
    }
    for (const row of this.graph.rows) {
      if (!isValid(row.root, true) || row.root.parent !== this.root) {
        throw new Error('Objectives screen ordinary row became invalid');
      }
    }
    for (const row of this.graph.rows) {
      const position = row.root.worldPosition;
      row.root.setWorldPosition(
        position.x,
        Math.fround(position.y + movementY),
        position.z,
      );
    }
  }

  private poisonFatalOwnership(error: unknown): unknown[] {
    this.fatalOwnershipValue = true;
    this.cleanupPoisoned = true;
    this.skipPendingValue = false;
    this.navigationPendingValue = false;
    this.suspendedValue = true;
    const failures: unknown[] = [];
    attemptCleanup(failures, () => this.unregisterEvents());
    this.releaseInputLease(failures);
    if (isValid(this.root, true)) {
      this.root.active = false;
    }
    if (!this.fatalOwnershipNotified) {
      this.fatalOwnershipNotified = true;
      attemptCleanup(
        failures,
        () => this.lifecycle.onFatalOwnership(error),
      );
    }
    return failures;
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
    this.skipPendingValue = false;
  }

  private canInteract(): boolean {
    return (
      this.activatedValue
      && !this.suspendedValue
      && !this.cleanupPoisoned
      && !this.fatalOwnershipValue
      && !this.disposedValue
      && !this.navigationPendingValue
      && !this.skipPendingValue
    );
  }
}

function constructRuntimeGraph(
  root: Node,
  presentation: ObjectivesScreenPresentationSnapshot,
  resources: LoadedObjectivesScreenResources,
): RuntimeGraph {
  const background = createFadingSprite(
    'background',
    presentation.background,
    resources,
  );
  attachPreservingWorld(
    background.node,
    root,
    presentation.background.attachmentInsertion - 1,
  );

  const rows = Object.freeze(presentation.rows.map((row, sequencePosition) => {
    const item = createObjectiveItem(
      `objective-row-${sequencePosition}`,
      row,
      resources,
    );
    attachPreservingWorld(
      item.root,
      root,
      row.attachmentInsertion - 1,
    );
    return item;
  }));

  const header = createFadingSprite('header', presentation.header, resources);
  attachPreservingWorld(
    header.node,
    root,
    presentation.header.attachmentInsertion - 1,
  );
  const footer = createFadingSprite('footer', presentation.footer, resources);
  attachPreservingWorld(
    footer.node,
    root,
    presentation.footer.attachmentInsertion - 1,
  );
  const fixedCurrent = createObjectiveItem(
    'fixed-current-item',
    presentation.fixedCurrent,
    resources,
  );
  attachPreservingWorld(
    fixedCurrent.root,
    root,
    presentation.fixedCurrent.attachmentInsertion - 1,
  );

  const menu = new Node('menu');
  menu.setWorldPosition(
    presentation.menu.position.x,
    presentation.menu.position.y,
    0,
  );
  attachPreservingWorld(
    menu,
    root,
    presentation.menu.attachmentInsertion - 1,
  );
  const back = createButtonControl(
    'back-item',
    presentation.menu.back.resources,
    resources,
  );
  back.node.setWorldPosition(
    presentation.menu.back.initialPosition.x,
    presentation.menu.back.initialPosition.y,
    0,
  );
  attachPreservingWorld(back.node, menu, 0);
  const skip = createButtonControl(
    'skip-item',
    presentation.menu.skip.resources,
    resources,
  );
  skip.node.setWorldPosition(
    presentation.menu.skip.initialPosition.x,
    presentation.menu.skip.initialPosition.y,
    0,
  );
  attachPreservingWorld(skip.node, menu, 1);

  if (
    rows.length !== OBJECTIVES_COUNT
    || root.children.length !== OBJECTIVES_COUNT + 5
    || menu.children.length !== 2
  ) {
    throw new Error(
      'Objectives screen presenter must construct the exact 57-child root graph',
    );
  }
  return Object.freeze({
    back,
    background,
    fixedCurrent,
    footer,
    header,
    menu,
    rows,
    skip,
  });
}

function createFadingSprite(
  name: string,
  presentation: ObjectivesScreenPresentationSnapshot[
    'background' | 'footer' | 'header'
  ],
  resources: LoadedObjectivesScreenResources,
): RuntimeFadingSprite {
  const sprite = createSpriteNode(
    name,
    requireRaster(resources, presentation.resource),
    presentation.anchor,
  );
  sprite.node.setWorldPosition(
    presentation.position.x,
    presentation.position.y,
    0,
  );
  const opacity = sprite.node.addComponent(UIOpacity);
  opacity.opacity = 0;
  return Object.freeze({ ...sprite, opacity });
}

function createObjectiveItem(
  name: string,
  presentation:
    | ObjectivesScreenObjectiveItemPresentation
    | ObjectivesScreenFixedCurrentPresentation,
  resources: LoadedObjectivesScreenResources,
): RuntimeObjectiveItem {
  const root = new Node(name);
  root.setWorldPosition(
    presentation.background.position.x,
    presentation.background.position.y,
    0,
  );
  const background = createSpriteNode(
    'background',
    requireRaster(resources, presentation.background.resource),
    presentation.background.anchor,
  );
  background.node.setPosition(0, 0, 0);
  attachLocal(background.node, root, 0);

  const description = createLabelNode(
    'description',
    presentation.description,
    presentation.background.position,
    resources,
  );
  attachLocal(description.node, root, 1);
  const reward = createLabelNode(
    'reward',
    presentation.reward,
    presentation.background.position,
    resources,
  );
  attachLocal(reward.node, root, 2);
  if (root.children.length !== 3) {
    throw new Error(`${name} must contain background, description, then reward`);
  }
  return Object.freeze({
    background,
    description: description.label,
    descriptionNode: description.node,
    reward: reward.label,
    rewardNode: reward.node,
    root,
  });
}

function createSpriteNode(
  name: string,
  resource: LoadedGameRasterResource,
  anchor: ObjectivesScreenAnchor,
): RuntimeSprite {
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
  presentation: ObjectivesScreenObjectiveItemPresentation[
    'description' | 'reward'
  ],
  itemPosition: Readonly<{ readonly x: number; readonly y: number }>,
  resources: LoadedObjectivesScreenResources,
): Readonly<{ readonly label: Label; readonly node: Node }> {
  if (presentation.fontCanonicalPath !== resources.arialFont.canonicalPath) {
    throw new Error('Objectives screen label font contract changed');
  }
  const node = new Node(name);
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(presentation.anchor.x, presentation.anchor.y);
  const label = node.addComponent(Label);
  label.font = resources.arialFont.font;
  label.fontSize = presentation.fontPointSize;
  label.lineHeight = presentation.fontPointSize;
  label.string = presentation.text;
  label.color = new Color(
    presentation.colorRgb.r,
    presentation.colorRgb.g,
    presentation.colorRgb.b,
    OPAQUE_CHANNEL,
  );
  node.setPosition(
    Math.fround(presentation.position.x - itemPosition.x),
    Math.fround(presentation.position.y - itemPosition.y),
    0,
  );
  return Object.freeze({ label, node });
}

function createButtonControl(
  name: string,
  contracts: ObjectivesScreenTwoFrameRasterSet,
  resources: LoadedObjectivesScreenResources,
): RuntimeButtonControl {
  const normal = requireRaster(resources, contracts.normal);
  const selected = requireRaster(resources, contracts.selected);
  const node = new Node(name);
  const hitTransform = node.addComponent(UITransform);
  hitTransform.setAnchorPoint(0.5, 0.5);
  hitTransform.setContentSize(normal.dimensions.width, normal.dimensions.height);
  const visual = createSpriteNode(
    'visual',
    normal,
    Object.freeze({
      evidence: 'inferred-legacy-default',
      x: 0.5,
      y: 0.5,
    }),
  );
  visual.node.setPosition(0, 0, 0);
  attachLocal(visual.node, node, 0);
  return Object.freeze({ node, normal, selected, visual });
}

function applyFixedCurrentPresentation(
  item: RuntimeObjectiveItem,
  presentation: ObjectivesScreenFixedCurrentPresentation,
  resources: LoadedObjectivesScreenResources,
): void {
  const loaded = requireRaster(resources, presentation.background.resource);
  item.background.sprite.spriteFrame = loaded.spriteFrame;
  item.background.transform.setContentSize(
    loaded.dimensions.width,
    loaded.dimensions.height,
  );
  item.description.string = presentation.description.text;
  item.reward.string = presentation.reward.text;
}

function applyRowBackground(
  item: RuntimeObjectiveItem,
  presentation: ObjectivesScreenObjectiveItemPresentation,
  resources: LoadedObjectivesScreenResources,
): void {
  const loaded = requireRaster(resources, presentation.background.resource);
  item.background.sprite.spriteFrame = loaded.spriteFrame;
  item.background.transform.setContentSize(
    loaded.dimensions.width,
    loaded.dimensions.height,
  );
}

function requireRaster(
  resources: LoadedObjectivesScreenResources,
  expected: ObjectivesScreenRasterResource,
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
    throw new Error(
      `Objectives screen raster contract changed: ${expected.canonicalPath}`,
    );
  }
  return loaded;
}

function setButtonFrame(
  control: RuntimeButtonControl,
  resource: LoadedGameRasterResource,
): void {
  control.visual.sprite.spriteFrame = resource.spriteFrame;
  // The menu-item hit/layout size stays bound to normal; the selected visual may be wider.
  control.visual.transform.setContentSize(
    resource.dimensions.width,
    resource.dimensions.height,
  );
}

function assertRuntimeGraphIntegrity(root: Node, graph: RuntimeGraph): void {
  if (
    !isValid(root, true)
    || graph.rows.length !== OBJECTIVES_COUNT
    || root.children.length !== OBJECTIVES_COUNT + 5
    || graph.menu.children.length !== 2
  ) {
    throw new Error('Objectives screen runtime graph is incomplete');
  }
  const orderedRoots: Node[] = [
    graph.background.node,
    ...graph.rows.map(({ root: rowRoot }) => rowRoot),
    graph.header.node,
    graph.footer.node,
    graph.fixedCurrent.root,
    graph.menu,
  ];
  for (let index = 0; index < orderedRoots.length; index += 1) {
    const node = orderedRoots[index];
    if (
      !isValid(node, true)
      || node.parent !== root
      || node.getSiblingIndex() !== index
    ) {
      throw new Error(`Objectives screen root child ${index} is invalid`);
    }
  }
  for (const item of [...graph.rows, graph.fixedCurrent]) {
    if (
      item.root.children.length !== 3
      || !isValid(item.background.node, true)
      || !isValid(item.background.sprite, true)
      || !isValid(item.descriptionNode, true)
      || !isValid(item.description, true)
      || !isValid(item.rewardNode, true)
      || !isValid(item.reward, true)
    ) {
      throw new Error(`Objectives screen item ${item.root.name} is invalid`);
    }
  }
  for (const control of [graph.back, graph.skip]) {
    if (
      !isValid(control.node, true)
      || !isValid(control.visual.node, true)
      || !isValid(control.visual.sprite, true)
      || !isValid(control.normal.spriteFrame, true)
      || !isValid(control.selected.spriteFrame, true)
    ) {
      throw new Error(`Objectives screen control ${control.node.name} is invalid`);
    }
  }
}

function readBladeMovePoints(
  event: unknown,
): Readonly<{
  readonly current: Readonly<{ readonly x: number; readonly y: number }>;
  readonly previous: Readonly<{ readonly x: number; readonly y: number }>;
}> | null {
  if (event === null || typeof event !== 'object' || !('segment' in event)) {
    return null;
  }
  const segment = (event as Readonly<{ readonly segment?: unknown }>).segment;
  if (segment === null || typeof segment !== 'object') {
    return null;
  }
  const candidate = segment as Readonly<{
    readonly current?: unknown;
    readonly previous?: unknown;
  }>;
  const current = readFinitePoint(candidate.current);
  const previous = readFinitePoint(candidate.previous);
  return current === null || previous === null
    ? null
    : Object.freeze({ current, previous });
}

function readFinitePoint(
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
  return (
    typeof candidate.x === 'number'
    && Number.isFinite(candidate.x)
    && typeof candidate.y === 'number'
    && Number.isFinite(candidate.y)
  ) ? Object.freeze({ x: candidate.x, y: candidate.y }) : null;
}

function copyEffectsReader(
  settings: ObjectivesScreenSettingsSnapshot,
): () => boolean {
  assertExactObject(settings, SETTINGS_KEYS, 'Objectives screen settings snapshot');
  if (typeof settings.effectsEnabled !== 'function') {
    throw new TypeError('Objectives screen effectsEnabled must be a function');
  }
  return settings.effectsEnabled.bind(settings);
}

function restoreRootAfterRejectedTransaction(
  root: Node,
  previousParent: Node | null,
  siblingIndex: number,
): void {
  if (!isValid(root, true)) {
    throw new Error(
      'Objectives screen root was destroyed during a rejected transaction',
    );
  }
  if (
    previousParent === null
    || !isValid(previousParent, true)
    || !previousParent.activeInHierarchy
  ) {
    throw new Error('Objectives screen transaction lost its active source host');
  }
  if (root.parent !== previousParent) {
    root.setParent(previousParent, true);
  }
  root.setSiblingIndex(siblingIndex);
  if (root.getSiblingIndex() !== siblingIndex) {
    throw new Error(
      'Objectives screen transaction could not restore its source sibling index',
    );
  }
  root.active = true;
}

function attachPreservingWorld(
  node: Node,
  parent: Node,
  siblingIndex: number,
): void {
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

function assertInput(input: ObjectivesScreenPresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Objectives screen presenter input must be an object');
  }
  if (input.resources === null || typeof input.resources !== 'object') {
    throw new TypeError('Objectives screen resources must be an object');
  }
  if (
    input.resources.rasterCount !== OBJECTIVES_SCREEN_RASTER_RESOURCE_COUNT
  ) {
    throw new Error(
      'Objectives screen presenter requires the complete 10-raster catalog',
    );
  }
  if (
    input.resources.arialFont === null
    || typeof input.resources.arialFont !== 'object'
    || input.resources.arialFont.canonicalPath
      !== OBJECTIVES_SCREEN_FONT_CANONICAL_PATH
    || !isValid(input.resources.arialFont.font, true)
  ) {
    throw new Error('Objectives screen requires the exact loaded Arial font');
  }
  assertFunctions(input.resources, ['raster'], 'resources');
  assertFunctions(input.audio, ['playOneShot'], 'audio');
  assertFunctions(
    input.bladeInput,
    [
      'activateForClassicLayer',
      'deactivateForNonClassicScreen',
      'setCutEnabled',
    ],
    'bladeInput',
  );
  if (!isValid(input.bladeInput.node, true)) {
    throw new Error('Objectives screen blade event owner must be a valid node');
  }
  assertFunctions(
    input.lifecycle,
    ['onFatalOwnership', 'onMainMenuRequested'],
    'lifecycle',
  );
  assertFunctions(
    input.manager,
    ['activeObjective', 'isFinished', 'skip'],
    'manager',
  );
  if (!isValid(input.canvas, true) || !input.canvas.activeInHierarchy) {
    throw new Error('Objectives screen canvas must be valid and active');
  }
}

function assertFunctions(
  value: unknown,
  names: readonly string[],
  label: string,
): void {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`Objectives screen ${label} port must be an object`);
  }
  for (const name of names) {
    if (
      !(name in value)
      || typeof (value as Record<string, unknown>)[name] !== 'function'
    ) {
      throw new TypeError(
        `Objectives screen ${label} port requires ${name}()`,
      );
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

function interpolateFloat32(
  start: number,
  end: number,
  progress: number,
): number {
  return Math.fround(
    Math.fround(start)
    + Math.fround(Math.fround(end - start) * Math.fround(progress)),
  );
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
