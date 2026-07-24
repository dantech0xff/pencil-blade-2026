import { _decorator, Component } from 'cc';

import {
  ClassicSession,
  type ClassicSessionCommand,
  type ClassicSessionSnapshot,
} from '../domain/classic-session';
import {
  ClassicWorldSpeed,
  type ClassicWorldSpeedCommand,
  type ClassicWorldSpeedSnapshot,
} from '../domain/classic-world-speed';
import type { BladeSegment } from '../domain/blade-tracks';
import { BladeInputController } from './blade-input-controller';
import { ClassicPhysicsAdapter } from './classic-physics-adapter';
import {
  ClassicResolutionAdapter,
  type AppliedClassicResolution,
} from './classic-resolution-adapter';

const { ccclass, requireComponent } = _decorator;

export const CLASSIC_RESOLUTION_APPLIED_EVENT = 'classic-resolution-applied';
export const CLASSIC_PHYSICS_STEPPED_EVENT = 'classic-physics-stepped';
export const CLASSIC_SESSION_COMMAND_EVENT = 'classic-session-command';
export const CLASSIC_SESSION_SNAPSHOT_EVENT = 'classic-session-snapshot';
export const CLASSIC_WORLD_SPEED_COMMAND_EVENT = 'classic-world-speed-command';

export interface ClassicPhysicsSteppedEvent {
  readonly bladeSegments: readonly BladeSegment[];
  readonly deltaSeconds: number;
}

export class ClassicLifecycleRollbackError extends Error {
  readonly cause: unknown;
  readonly rollbackErrors: readonly unknown[];

  constructor(
    label: string,
    primary: unknown,
    rollbackFailures: readonly unknown[],
  ) {
    super(
      `${label}: ${classicLifecycleErrorMessage(primary)}`
      + (
        rollbackFailures.length === 0
          ? ''
          : `; rollback: ${rollbackFailures.map(classicLifecycleErrorMessage).join('; ')}`
      ),
    );
    this.name = 'ClassicLifecycleRollbackError';
    this.cause = primary;
    this.rollbackErrors = Object.freeze([...rollbackFailures]);
  }
}

interface ClassicLayerRestartRollbackState {
  readonly classicLayerActive: boolean;
  readonly classicLayerRemovedForResult: boolean;
  readonly classicLayerSuspended: boolean;
  readonly initialClassicActivated: boolean;
  readonly session: ClassicSession;
  readonly speedDelayRemainingSeconds: number | null;
  readonly worldSpeed: ClassicWorldSpeed;
}

/**
 * Root bridge for explicitly activated Classic session, resolution, and Physics2D behavior.
 * The serialized component is passive until an app-shell prepares resolution and activates
 * the initial Classic layer.
 */
@ccclass('ClassicSceneController')
@requireComponent(BladeInputController)
export class ClassicSceneController extends Component {
  private session = new ClassicSession();
  private readonly physics = new ClassicPhysicsAdapter();
  private readonly resolution = new ClassicResolutionAdapter();
  private worldSpeed = new ClassicWorldSpeed();
  private bladeInput: BladeInputController | null = null;
  private appliedResolution: AppliedClassicResolution | null = null;
  private fatalLifecycleValue = false;
  private initialClassicActivated = false;
  private initialClassicActivationInProgress = false;
  private classicLayerActive = false;
  private classicLayerRemovedForResult = false;
  private classicLayerSuspended = false;
  private pendingLayerRestartRollback: ClassicLayerRestartRollbackState | null = null;
  private physicsLeaseActive = false;
  private physicsRestorePending = false;
  private speedDelayRemainingSeconds: number | null = null;
  private destroyed = false;

  onLoad(): void {
    const bladeInput = this.getComponent(BladeInputController);
    if (bladeInput === null) {
      throw new Error('ClassicSceneController requires BladeInputController');
    }
    this.bladeInput = bladeInput;
    bladeInput.deactivateForNonClassicScreen();
  }

  start(): void {
    // Intentionally passive. The app-shell owns preparation and Classic activation order.
  }

  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('Classic scene deltaSeconds must be finite and non-negative');
    }
    if (!this.classicLayerActive || this.speedDelayRemainingSeconds === null) {
      return;
    }
    this.speedDelayRemainingSeconds = Math.max(
      0,
      this.speedDelayRemainingSeconds - deltaSeconds,
    );
  }

  onDestroy(): void {
    this.destroyed = true;
    this.classicLayerActive = false;
    this.classicLayerSuspended = false;
    this.unschedule(this.onSpeedUpDelayComplete);
    this.speedDelayRemainingSeconds = null;
    const failures: unknown[] = [];
    collectClassicLifecycleFailure(
      failures,
      () => this.bladeInput?.deactivateForNonClassicScreen(),
    );
    try {
      this.physics.restorePreviousWorldProperties();
      this.physicsLeaseActive = false;
      this.physicsRestorePending = false;
    } catch (error) {
      // The adapter retains its captured singleton snapshot when restoration fails. Preserve
      // that retry ownership instead of falsely publishing a complete Physics2D release.
      this.physicsLeaseActive = false;
      this.physicsRestorePending = true;
      failures.push(error);
    }
    if (failures.length > 0) {
      throw aggregateClassicLifecycleFailure(
        'Classic scene destruction cleanup failed',
        failures[0],
        failures.slice(1),
      );
    }
  }

  get active(): boolean {
    return this.classicLayerActive;
  }

  get fatalLifecycle(): boolean {
    return this.fatalLifecycleValue;
  }

  get suspended(): boolean {
    return this.classicLayerSuspended;
  }

  /** Applies and publishes the scene resolution exactly once for the persistent app-shell. */
  prepareSceneResolution(): AppliedClassicResolution {
    if (this.destroyed) {
      throw new Error('Classic scene resolution cannot be prepared after destruction');
    }
    if (this.appliedResolution !== null) {
      return this.appliedResolution;
    }

    const appliedResolution = this.resolution.apply();
    this.appliedResolution = appliedResolution;
    this.node.emit(CLASSIC_RESOLUTION_APPLIED_EVENT, appliedResolution);
    return appliedResolution;
  }

  /** Creates and activates the first Classic layer after explicit resolution preparation. */
  activateInitialClassicLayer(): void {
    if (this.destroyed || this.fatalLifecycleValue) {
      throw new Error(
        'Initial Classic layer cannot activate after destruction or fatal rollback',
      );
    }
    if (this.initialClassicActivated || this.initialClassicActivationInProgress) {
      throw new Error('Initial Classic layer can activate only once');
    }
    if (this.appliedResolution === null) {
      throw new Error('Classic resolution must be prepared before initial activation');
    }
    if (
      this.classicLayerRemovedForResult
      || this.pendingLayerRestartRollback !== null
      || this.session.snapshot().lifecycle !== 'intro'
    ) {
      throw new Error('Initial Classic layer cannot activate from the current lifecycle');
    }
    const bladeInput = this.bladeInput;
    if (bladeInput === null) {
      throw new Error('Classic blade input must load before initial activation');
    }

    const previousSession = this.session;
    const previousWorldSpeed = this.worldSpeed;
    const freshSession = new ClassicSession();
    const freshWorldSpeed = new ClassicWorldSpeed();
    this.initialClassicActivationInProgress = true;
    this.unschedule(this.onSpeedUpDelayComplete);
    this.speedDelayRemainingSeconds = null;
    try {
      this.physicsRestorePending = true;
      this.physics.configureResolvedWorldProperties();
      this.physics.startVariableSimulation(
        (frameDeltaSeconds) => freshWorldSpeed.physicsStepDelta(frameDeltaSeconds),
        (variableDeltaSeconds) => this.afterPhysicsStep(variableDeltaSeconds),
      );
      this.physicsLeaseActive = true;
      this.session = freshSession;
      this.worldSpeed = freshWorldSpeed;
      bladeInput.activateForClassicLayer();
      this.applyWorldSpeedCommands(freshWorldSpeed.enableClassicSpeedUp());
      this.emitSessionSnapshot();
      this.initialClassicActivated = true;
      this.classicLayerActive = true;
      this.classicLayerSuspended = false;
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      this.unschedule(this.onSpeedUpDelayComplete);
      this.speedDelayRemainingSeconds = null;
      this.session = previousSession;
      this.worldSpeed = previousWorldSpeed;
      collectClassicLifecycleFailure(
        rollbackFailures,
        () => bladeInput.deactivateForNonClassicScreen(),
      );
      collectClassicLifecycleFailure(
        rollbackFailures,
        () => this.releasePhysicsLease(),
      );
      if (rollbackFailures.length > 0 || this.physicsRestorePending) {
        throw this.failClosedAfterLifecycleRollback(
          'Initial Classic activation rollback failed',
          error,
          rollbackFailures,
        );
      }
      throw error;
    } finally {
      this.initialClassicActivationInProgress = false;
    }
  }

  resolutionSnapshot(): AppliedClassicResolution | null {
    return this.appliedResolution;
  }

  sessionSnapshot(): ClassicSessionSnapshot {
    return this.session.snapshot();
  }

  worldSpeedSnapshot(): ClassicWorldSpeedSnapshot {
    return this.worldSpeed.snapshot();
  }

  raycastAll(
    startWorld: Readonly<{ x: number; y: number }>,
    endWorld: Readonly<{ x: number; y: number }>,
  ) {
    return this.physics.raycastAll(startWorld, endWorld);
  }

  callAfterPhysicsStep(mutation: () => void): void {
    this.physics.callAfterStep(mutation);
  }

  completeIntro(): void {
    this.dispatch(this.session.completeIntro());
  }

  gameOverFromMiss(): void {
    this.dispatch(this.session.gameOverFromMiss());
  }

  bombHit(): void {
    this.dispatch(this.session.bombHit());
  }

  afterBombHit(): void {
    this.dispatch(this.session.afterBombHit());
  }

  displayScoreComplete(totalScore: number): void {
    this.dispatch(this.session.displayScoreComplete(totalScore));
  }

  /**
   * Releases the singleton input/physics foreground leases while retaining the exact session
   * and speed-delay identities for a synchronous Pause Replay/Quit rollback.
   */
  suspendClassicLayerForNavigation(): void {
    if (
      this.destroyed
      || this.fatalLifecycleValue
      || !this.classicLayerActive
      || this.classicLayerSuspended
      || this.pendingLayerRestartRollback !== null
    ) {
      throw new Error('Classic layer can suspend only from one active run');
    }
    const bladeInput = this.requireBladeInput();
    const retainedDelay = this.speedDelayRemainingSeconds;
    this.unschedule(this.onSpeedUpDelayComplete);
    try {
      bladeInput.deactivateForNonClassicScreen();
      this.releasePhysicsLease();
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      try {
        if (!this.physicsLeaseActive) {
          this.acquirePhysicsLease(this.session, this.worldSpeed);
        }
        bladeInput.activateForClassicLayer();
        this.restoreSpeedDelay(retainedDelay);
      } catch (rollbackError) {
        rollbackFailures.push(rollbackError);
      }
      if (rollbackFailures.length > 0) {
        throw this.failClosedAfterLifecycleRollback(
          'Classic navigation suspension rollback failed',
          error,
          rollbackFailures,
        );
      }
      throw error;
    }
    this.classicLayerActive = false;
    this.classicLayerSuspended = true;
  }

  /** Restores the exact retained Classic session after a rejected shell transaction. */
  resumeSuspendedClassicLayer(): void {
    if (
      this.destroyed
      || this.fatalLifecycleValue
      || this.classicLayerActive
      || !this.classicLayerSuspended
      || this.pendingLayerRestartRollback !== null
    ) {
      throw new Error('Classic layer can resume only from one suspended run');
    }
    const retainedDelay = this.speedDelayRemainingSeconds;
    const bladeInput = this.requireBladeInput();
    try {
      this.acquirePhysicsLease(this.session, this.worldSpeed);
      bladeInput.activateForClassicLayer();
      this.restoreSpeedDelay(retainedDelay);
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      collectClassicLifecycleFailure(
        rollbackFailures,
        () => bladeInput.deactivateForNonClassicScreen(),
      );
      collectClassicLifecycleFailure(
        rollbackFailures,
        () => this.releasePhysicsLease(),
      );
      if (rollbackFailures.length > 0 || this.physicsRestorePending) {
        throw this.failClosedAfterLifecycleRollback(
          'Classic navigation resume rollback failed',
          error,
          rollbackFailures,
        );
      }
      throw error;
    }
    this.classicLayerActive = true;
    this.classicLayerSuspended = false;
  }

  /**
   * Starts a fresh pause-replay session while retaining the suspended old session as a rollback
   * token until its new presentation has committed to the captured parent.
   */
  restartSuspendedClassicLayer(): void {
    if (
      this.destroyed
      || this.fatalLifecycleValue
      || this.classicLayerActive
      || !this.classicLayerSuspended
      || this.pendingLayerRestartRollback !== null
    ) {
      throw new Error('Classic Pause Replay requires one suspended run');
    }
    const freshSession = new ClassicSession();
    const freshWorldSpeed = new ClassicWorldSpeed();
    this.pendingLayerRestartRollback = Object.freeze({
      classicLayerActive: this.classicLayerActive,
      classicLayerRemovedForResult: this.classicLayerRemovedForResult,
      classicLayerSuspended: this.classicLayerSuspended,
      initialClassicActivated: this.initialClassicActivated,
      session: this.session,
      speedDelayRemainingSeconds: this.speedDelayRemainingSeconds,
      worldSpeed: this.worldSpeed,
    });
    this.unschedule(this.onSpeedUpDelayComplete);
    this.speedDelayRemainingSeconds = null;
    try {
      this.session = freshSession;
      this.worldSpeed = freshWorldSpeed;
      this.classicLayerRemovedForResult = false;
      this.classicLayerSuspended = false;
      this.acquirePhysicsLease(freshSession, freshWorldSpeed);
      this.requireBladeInput().activateForClassicLayer();
      this.applyWorldSpeedCommands(freshWorldSpeed.enableClassicSpeedUp());
      this.classicLayerActive = true;
      this.emitSessionSnapshot();
    } catch (error) {
      try {
        this.restorePendingClassicLayerRestart();
      } catch (rollbackError) {
        throw this.failClosedAfterLifecycleRollback(
          'Classic Pause Replay restoration failed',
          error,
          [rollbackError],
        );
      }
      this.emitSessionSnapshotReportOnly(
        'Classic Pause Replay restored with a snapshot observer failure',
      );
      throw error;
    }
  }

  /** Commits Pause Quit after the shell has attached and activated Main Menu. */
  finalizeSuspendedClassicLayerRelease(): void {
    if (
      this.destroyed
      || this.fatalLifecycleValue
      || this.classicLayerActive
      || !this.classicLayerSuspended
      || this.pendingLayerRestartRollback !== null
    ) {
      throw new Error('Classic Pause Quit can finalize only from one suspended run');
    }
    this.session.retireForPauseQuit();
    this.worldSpeed = new ClassicWorldSpeed();
    this.speedDelayRemainingSeconds = null;
    this.classicLayerRemovedForResult = true;
    this.classicLayerSuspended = false;
    this.emitSessionSnapshotReportOnly(
      'Committed Classic Pause Quit snapshot observer failed',
    );
  }

  /** Reattaches a fresh Classic layer under the existing scene parent after Result removal. */
  restartClassicLayer(): void {
    if (this.destroyed || this.fatalLifecycleValue) {
      throw new Error('Classic layer cannot restart after destruction or fatal rollback');
    }
    if (
      (
        this.session.snapshot().lifecycle !== 'result-removed'
        && this.session.snapshot().lifecycle !== 'navigation-removed'
      )
      || !this.classicLayerRemovedForResult
      || this.pendingLayerRestartRollback !== null
    ) {
      throw new Error('Classic layer can restart only after Result removes the previous layer');
    }
    const bladeInput = this.bladeInput;
    if (bladeInput === null) {
      throw new Error('Classic blade input must be available before layer restart');
    }

    const freshSession = new ClassicSession();
    const freshWorldSpeed = new ClassicWorldSpeed();
    this.pendingLayerRestartRollback = Object.freeze({
      classicLayerActive: this.classicLayerActive,
      classicLayerRemovedForResult: this.classicLayerRemovedForResult,
      classicLayerSuspended: this.classicLayerSuspended,
      initialClassicActivated: this.initialClassicActivated,
      session: this.session,
      speedDelayRemainingSeconds: this.speedDelayRemainingSeconds,
      worldSpeed: this.worldSpeed,
    });
    this.unschedule(this.onSpeedUpDelayComplete);
    this.speedDelayRemainingSeconds = null;
    try {
      this.physicsRestorePending = true;
      this.physics.configureResolvedWorldProperties();
      this.physics.startVariableSimulation(
        (frameDeltaSeconds) => freshWorldSpeed.physicsStepDelta(frameDeltaSeconds),
        (variableDeltaSeconds) => this.afterPhysicsStep(variableDeltaSeconds),
      );
      this.physicsLeaseActive = true;

      this.session = freshSession;
      this.worldSpeed = freshWorldSpeed;
      this.classicLayerRemovedForResult = false;
      this.initialClassicActivated = true;
      bladeInput.activateForClassicLayer();
      this.applyWorldSpeedCommands(freshWorldSpeed.enableClassicSpeedUp());
      this.classicLayerActive = true;
      this.classicLayerSuspended = false;
      this.emitSessionSnapshot();
    } catch (error) {
      try {
        this.restorePendingClassicLayerRestart();
      } catch (rollbackError) {
        throw this.failClosedAfterLifecycleRollback(
          'Classic layer restart restoration failed',
          error,
          [rollbackError],
        );
      }
      this.emitSessionSnapshotReportOnly(
        'Classic layer restart restored with a snapshot observer failure',
      );
      throw error;
    }
  }

  /** Commits only after the staged Classic node has joined the captured native parent. */
  commitClassicLayerRestart(): void {
    if (
      this.pendingLayerRestartRollback === null
      || this.fatalLifecycleValue
      || this.session.snapshot().lifecycle !== 'intro'
      || !this.initialClassicActivated
      || this.classicLayerRemovedForResult
    ) {
      throw new Error('Classic layer restart can commit only after fresh activation');
    }
    this.pendingLayerRestartRollback = null;
  }

  /** Restores the exact post-Result boundary if Creator rejects the final node attachment. */
  rollbackClassicLayerRestart(): void {
    if (this.pendingLayerRestartRollback === null) {
      throw new Error('Classic layer restart has no pending rollback');
    }
    try {
      this.restorePendingClassicLayerRestart();
    } catch (error) {
      throw this.failClosedAfterLifecycleRollback(
        'Classic layer restart rollback failed',
        error,
        [],
      );
    }
    this.emitSessionSnapshotReportOnly(
      'Classic layer restart rollback snapshot observer failed',
    );
  }

  private restorePendingClassicLayerRestart(): void {
    const rollback = this.pendingLayerRestartRollback;
    if (rollback === null) {
      throw new Error('Classic layer restart rollback state is missing');
    }
    const bladeInput = this.bladeInput;
    if (bladeInput === null) {
      throw new Error('Classic blade input must survive layer restart rollback');
    }
    this.unschedule(this.onSpeedUpDelayComplete);
    this.physics.restorePreviousWorldProperties();
    this.physicsLeaseActive = false;
    this.physicsRestorePending = false;
    this.session = rollback.session;
    this.worldSpeed = rollback.worldSpeed;
    this.initialClassicActivated = rollback.initialClassicActivated;
    this.classicLayerRemovedForResult = rollback.classicLayerRemovedForResult;
    bladeInput.deactivateForNonClassicScreen();
    this.classicLayerActive = rollback.classicLayerActive;
    this.classicLayerSuspended = rollback.classicLayerSuspended;
    this.speedDelayRemainingSeconds = rollback.speedDelayRemainingSeconds;
    if (rollback.classicLayerSuspended) {
      this.acquirePhysicsLease(this.session, this.worldSpeed);
      bladeInput.activateForClassicLayer();
      this.restoreSpeedDelay(rollback.speedDelayRemainingSeconds);
      this.classicLayerActive = true;
      this.classicLayerSuspended = false;
    }
    this.pendingLayerRestartRollback = null;
  }

  private dispatch(commands: readonly ClassicSessionCommand[]): void {
    if (this.fatalLifecycleValue) {
      return;
    }
    for (const command of commands) {
      this.applyResolvedCommand(command);
      this.node.emit(CLASSIC_SESSION_COMMAND_EVENT, command);
    }
    this.emitSessionSnapshot();
  }

  private applyResolvedCommand(command: ClassicSessionCommand): void {
    if (command.type === 'set-cut-enabled') {
      this.bladeInput?.setCutEnabled(command.enabled);
    } else if (command.type === 'set-physics-stopped') {
      this.physics.setWorldStopped(command.stopped);
    } else if (command.type === 'remove-classic') {
      // Native removes the PhysicsLayer node and its pending 30-second action callbacks.
      // Restore Creator's singleton immediately so the result layer owns no Classic stepping.
      this.unschedule(this.onSpeedUpDelayComplete);
      this.speedDelayRemainingSeconds = null;
      this.bladeInput?.deactivateForNonClassicScreen();
      this.physics.restorePreviousWorldProperties();
      this.physicsLeaseActive = false;
      this.physicsRestorePending = false;
      this.classicLayerActive = false;
      this.classicLayerSuspended = false;
      this.classicLayerRemovedForResult = true;
    }
  }

  private emitSessionSnapshot(): void {
    this.node.emit(CLASSIC_SESSION_SNAPSHOT_EVENT, this.session.snapshot());
  }

  private emitSessionSnapshotReportOnly(label: string): void {
    try {
      this.emitSessionSnapshot();
    } catch (error) {
      try {
        console.error(new Error(`${label}: ${classicLifecycleErrorMessage(error)}`));
      } catch {
        // A diagnostic observer cannot reopen an already restored or committed lifecycle.
      }
    }
  }

  /**
   * Quiesces every process-wide Classic lease after an incomplete rollback. The returned
   * typed error lets gameplay and the app shell retain a durable fatal boundary.
   */
  failClosedAfterLifecycleRollback(
    label: string,
    primary: unknown,
    priorRollbackFailures: readonly unknown[] = [],
  ): ClassicLifecycleRollbackError {
    const rollbackFailures = [...priorRollbackFailures];
    this.fatalLifecycleValue = true;
    this.classicLayerActive = false;
    this.classicLayerSuspended = false;
    this.pendingLayerRestartRollback = null;
    this.initialClassicActivationInProgress = false;
    this.unschedule(this.onSpeedUpDelayComplete);
    this.speedDelayRemainingSeconds = null;
    collectClassicLifecycleFailure(
      rollbackFailures,
      () => this.bladeInput?.deactivateForNonClassicScreen(),
    );
    collectClassicLifecycleFailure(
      rollbackFailures,
      () => this.releasePhysicsLease(),
    );
    return new ClassicLifecycleRollbackError(
      label,
      primary,
      rollbackFailures,
    );
  }

  /** Retries a retained Physics2D singleton restoration during higher-level teardown. */
  retryPendingPhysicsRestore(): void {
    if (!this.physicsRestorePending) {
      return;
    }
    this.releasePhysicsLease();
  }

  private afterPhysicsStep(deltaSeconds: number): void {
    const bladeSegments = Object.freeze([
      ...(this.bladeInput?.segmentsForPostPhysicsUpdate() ?? []),
    ]);
    const payload: ClassicPhysicsSteppedEvent = Object.freeze({
      bladeSegments,
      deltaSeconds,
    });
    this.node.emit(CLASSIC_PHYSICS_STEPPED_EVENT, payload);
  }

  private applyWorldSpeedCommands(commands: readonly ClassicWorldSpeedCommand[]): void {
    for (const command of commands) {
      if (command.type === 'schedule-speed-up-callback') {
        this.speedDelayRemainingSeconds = command.delaySeconds;
        this.scheduleOnce(this.onSpeedUpDelayComplete, command.delaySeconds);
      }
      this.node.emit(CLASSIC_WORLD_SPEED_COMMAND_EVENT, command);
    }
  }

  private readonly onSpeedUpDelayComplete = (): void => {
    this.speedDelayRemainingSeconds = null;
    this.applyWorldSpeedCommands(this.worldSpeed.speedUpDelayComplete());
  };

  private acquirePhysicsLease(
    session: ClassicSession,
    worldSpeed: ClassicWorldSpeed,
  ): void {
    if (this.physicsLeaseActive) {
      throw new Error('Classic Physics2D lease is already active');
    }
    if (this.physicsRestorePending) {
      this.releasePhysicsLease();
    }
    this.physicsRestorePending = true;
    try {
      this.physics.configureResolvedWorldProperties();
      this.physics.startVariableSimulation(
        (frameDeltaSeconds) => worldSpeed.physicsStepDelta(frameDeltaSeconds),
        (variableDeltaSeconds) => this.afterPhysicsStep(variableDeltaSeconds),
      );
      this.physicsLeaseActive = true;
      this.physics.setWorldStopped(session.snapshot().worldStopped);
    } catch (error) {
      this.physicsLeaseActive = false;
      const rollbackFailures: unknown[] = [];
      collectClassicLifecycleFailure(
        rollbackFailures,
        () => this.releasePhysicsLease(),
      );
      if (rollbackFailures.length > 0) {
        throw aggregateClassicLifecycleFailure(
          'Classic Physics2D acquisition rollback failed',
          error,
          rollbackFailures,
        );
      }
      throw error;
    }
  }

  private releasePhysicsLease(): void {
    if (!this.physicsLeaseActive && !this.physicsRestorePending) {
      return;
    }
    try {
      this.physics.restorePreviousWorldProperties();
      this.physicsLeaseActive = false;
      this.physicsRestorePending = false;
    } catch (error) {
      this.physicsLeaseActive = false;
      this.physicsRestorePending = true;
      throw error;
    }
  }

  private restoreSpeedDelay(remainingSeconds: number | null): void {
    this.speedDelayRemainingSeconds = remainingSeconds;
    if (remainingSeconds !== null) {
      this.scheduleOnce(this.onSpeedUpDelayComplete, remainingSeconds);
    }
  }

  private requireBladeInput(): BladeInputController {
    if (this.bladeInput === null) {
      throw new Error('Classic blade input is unavailable before scene load');
    }
    return this.bladeInput;
  }
}

function collectClassicLifecycleFailure(
  failures: unknown[],
  operation: () => void,
): void {
  try {
    operation();
  } catch (error) {
    failures.push(error);
  }
}

function aggregateClassicLifecycleFailure(
  label: string,
  primary: unknown,
  rollbackFailures: readonly unknown[],
): Error {
  const error = new Error(
    `${label}: ${primary instanceof Error ? primary.message : String(primary)}; rollback: `
    + rollbackFailures
      .map((failure) => failure instanceof Error ? failure.message : String(failure))
      .join('; '),
  );
  Object.defineProperties(error, {
    cause: {
      enumerable: false,
      value: primary,
    },
    rollbackErrors: {
      enumerable: false,
      value: Object.freeze([...rollbackFailures]),
    },
  });
  return error;
}

function classicLifecycleErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
