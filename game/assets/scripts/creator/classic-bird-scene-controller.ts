import { _decorator, Component } from 'cc';

import {
  ClassicBirdSession,
  type ClassicBirdPoint,
  type ClassicBirdSessionCommand,
  type ClassicBirdSessionSnapshot,
} from '../domain/classic-bird-session';
import { BirdInputController } from './bird-input-controller';
import { ClassicPhysicsAdapter } from './classic-physics-adapter';

const { ccclass, requireComponent } = _decorator;

export const CLASSIC_BIRD_PHYSICS_STEPPED_EVENT
  = 'classic-bird-physics-stepped';
export const CLASSIC_BIRD_SESSION_COMMAND_EVENT
  = 'classic-bird-session-command';
export const CLASSIC_BIRD_SESSION_SNAPSHOT_EVENT
  = 'classic-bird-session-snapshot';

export interface ClassicBirdPhysicsSteppedEvent {
  readonly deltaSeconds: number;
}

/**
 * Result construction joins the scene transaction while the prepared command batch is being
 * dispatched. The domain and Creator owners commit together only after attachment succeeds.
 */
export interface ClassicBirdResultTransitionParticipant {
  prepareCommit(): void;
  commit(): void;
  rollback(): void;
}

export class ClassicBirdResultTransitionRollbackError extends Error {
  readonly cause: unknown;
  readonly rollbackErrors: readonly unknown[];

  constructor(primary: unknown, rollbackErrors: readonly unknown[]) {
    super(
      `Classic Bird result rollback failed: ${errorMessage(primary)}; rollback: `
      + rollbackErrors.map(errorMessage).join('; '),
    );
    this.name = 'ClassicBirdResultTransitionRollbackError';
    this.cause = primary;
    this.rollbackErrors = Object.freeze([...rollbackErrors]);
  }
}

/**
 * A lifecycle operation failed and its compensation could not restore the prior ownership state.
 * Callers must treat the affected scene as fatal and retain it only for teardown cleanup.
 */
export class ClassicBirdLifecycleRollbackError extends Error {
  readonly cause: unknown;
  readonly rollbackErrors: readonly unknown[];

  constructor(label: string, primary: unknown, rollbackErrors: readonly unknown[]) {
    super(
      `${label}: ${errorMessage(primary)}; rollback: `
      + rollbackErrors.map(errorMessage).join('; '),
    );
    this.name = 'ClassicBirdLifecycleRollbackError';
    this.cause = primary;
    this.rollbackErrors = Object.freeze([...rollbackErrors]);
  }
}

export class ClassicBirdResultTransitionCommitError extends Error {
  readonly cause: unknown;
  readonly observerErrors: readonly unknown[];

  constructor(primary: unknown, observerErrors: readonly unknown[]) {
    super(
      `Classic Bird result commit failed: ${errorMessage(primary)}`
      + (
        observerErrors.length === 0
          ? ''
          : `; observers: ${observerErrors.map(errorMessage).join('; ')}`
      ),
    );
    this.name = 'ClassicBirdResultTransitionCommitError';
    this.cause = primary;
    this.observerErrors = Object.freeze([...observerErrors]);
  }
}

/**
 * Passive serialized owner for mode-3 session state, Bird input, and variable Physics2D.
 *
 * Scheduler/action time remains unscaled. Only the Physics2D callback receives
 * `ClassicBirdSession.physicsStepDelta`, preserving the recovered 45-second world-speed rule.
 */
@ccclass('ClassicBirdSceneController')
@requireComponent(BirdInputController)
export class ClassicBirdSceneController extends Component {
  private activeValue = false;
  private birdInput: BirdInputController | null = null;
  private destroyedValue = false;
  private fatalLifecycleValue = false;
  private loadedValue = false;
  private pendingResultParticipant: ClassicBirdResultTransitionParticipant | null = null;
  private readonly physics = new ClassicPhysicsAdapter();
  private physicsLeaseActive = false;
  private physicsRestorePending = false;
  private resultDispatchingValue = false;
  private runGenerationValue = 0;
  private session = new ClassicBirdSession();
  private speedDelayRemainingSeconds: number | null = null;
  private suspendedValue = false;
  private worldStoppedValue = false;

  onLoad(): void {
    const birdInput = this.getComponent(BirdInputController);
    if (birdInput === null) {
      throw new Error('ClassicBirdSceneController requires BirdInputController');
    }
    this.birdInput = birdInput;
    birdInput.deactivateForNonBirdScreen(this);
    this.loadedValue = true;
  }

  start(): void {
    // Intentionally passive. The app shell owns resource preparation and foreground placement.
  }

  update(deltaSeconds: number): void {
    assertFiniteNonNegative(deltaSeconds, 'deltaSeconds');
    if (!this.activeValue || this.destroyedValue) {
      return;
    }
    this.advanceSpeedDelay(deltaSeconds);
    this.dispatch(this.session.updateScorePresentation());
  }

  onDestroy(): void {
    this.destroyedValue = true;
    this.activeValue = false;
    this.suspendedValue = false;
    this.loadedValue = false;
    this.pendingResultParticipant = null;
    this.resultDispatchingValue = false;
    this.speedDelayRemainingSeconds = null;
    const failures: unknown[] = [];
    collectFailure(
      failures,
      () => this.birdInput?.deactivateForNonBirdScreen(this),
    );
    collectFailure(failures, () => this.releasePhysicsLease());
    if (failures.length === 1) {
      throw failures[0];
    }
    if (failures.length > 1) {
      throw new ClassicBirdLifecycleRollbackError(
        'Classic Bird destruction cleanup failed',
        failures[0],
        failures.slice(1),
      );
    }
  }

  get active(): boolean {
    return this.activeValue;
  }

  get fatalLifecycle(): boolean {
    return this.fatalLifecycleValue;
  }

  get readyForActivation(): boolean {
    return (
      this.loadedValue
      && !this.destroyedValue
      && !this.fatalLifecycleValue
      && this.birdInput !== null
    );
  }

  get suspended(): boolean {
    return this.suspendedValue;
  }

  get speedDelayRemaining(): number | null {
    return this.speedDelayRemainingSeconds;
  }

  sessionSnapshot(): ClassicBirdSessionSnapshot {
    return this.session.snapshot();
  }

  activateClassicBirdLayer(initialBestScore: number): void {
    assertSafeInteger(initialBestScore, 'initialBestScore');
    if (!this.readyForActivation) {
      throw new Error('Classic Bird layer cannot activate before load or after destruction');
    }
    if (this.activeValue || this.suspendedValue || this.resultDispatchingValue) {
      throw new Error('Classic Bird layer already owns or retains a run');
    }
    const lifecycle = this.session.snapshot().lifecycle;
    if (lifecycle !== 'intro' && lifecycle !== 'result-removed') {
      throw new Error('Classic Bird layer cannot activate from the current lifecycle');
    }

    const previousSession = this.session;
    const previousDelay = this.speedDelayRemainingSeconds;
    const previousRunGeneration = this.runGenerationValue;
    const previousWorldStopped = this.worldStoppedValue;
    const freshSession = new ClassicBirdSession(initialBestScore);
    this.session = freshSession;
    this.runGenerationValue = nextRunGeneration(previousRunGeneration);
    this.speedDelayRemainingSeconds = null;
    this.worldStoppedValue = false;
    try {
      this.acquirePhysicsLease(freshSession);
      this.requireBirdInput().activateForBirdLayer(this);
      this.activeValue = true;
      this.dispatch(freshSession.enterScene());
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      this.activeValue = false;
      collectFailure(
        rollbackFailures,
        () => this.requireBirdInput().deactivateForNonBirdScreen(this),
      );
      collectFailure(rollbackFailures, () => this.releasePhysicsLease());
      this.session = previousSession;
      this.runGenerationValue = previousRunGeneration;
      this.speedDelayRemainingSeconds = previousDelay;
      this.worldStoppedValue = previousWorldStopped;
      if (rollbackFailures.length > 0) {
        this.enterFatalLifecycleBoundary();
        throw new ClassicBirdLifecycleRollbackError(
          'Classic Bird activation rollback failed',
          error,
          rollbackFailures,
        );
      }
      if (error instanceof ClassicBirdLifecycleRollbackError) {
        this.enterFatalLifecycleBoundary();
      }
      throw error;
    }
  }

  suspendClassicBirdLayerForNavigation(): void {
    this.assertActive();
    this.requireBirdInput().deactivateForNonBirdScreen(this);
    try {
      this.releasePhysicsLease();
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      try {
        this.acquirePhysicsLease(this.session);
        this.requireBirdInput().activateForBirdLayer(this);
      } catch (rollbackError) {
        rollbackFailures.push(rollbackError);
      }
      if (rollbackFailures.length > 0) {
        this.enterFatalLifecycleBoundary();
        if (this.physicsLeaseActive) {
          collectFailure(rollbackFailures, () => this.releasePhysicsLease());
        }
        throw new ClassicBirdLifecycleRollbackError(
          'Classic Bird navigation suspension rollback failed',
          error,
          rollbackFailures,
        );
      }
      throw error;
    }
    this.activeValue = false;
    this.suspendedValue = true;
  }

  resumeSuspendedClassicBirdLayer(): void {
    if (
      this.destroyedValue
      || this.activeValue
      || !this.suspendedValue
      || this.resultDispatchingValue
    ) {
      throw new Error('Classic Bird layer can resume only from one suspended run');
    }
    try {
      this.acquirePhysicsLease(this.session);
      this.requireBirdInput().activateForBirdLayer(this);
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      collectFailure(
        rollbackFailures,
        () => this.requireBirdInput().deactivateForNonBirdScreen(this),
      );
      collectFailure(rollbackFailures, () => this.releasePhysicsLease());
      if (rollbackFailures.length > 0) {
        this.enterFatalLifecycleBoundary();
        throw new ClassicBirdLifecycleRollbackError(
          'Classic Bird navigation resume rollback failed',
          error,
          rollbackFailures,
        );
      }
      if (error instanceof ClassicBirdLifecycleRollbackError) {
        this.enterFatalLifecycleBoundary();
      }
      throw error;
    }
    this.activeValue = true;
    this.suspendedValue = false;
  }

  finalizeSuspendedClassicBirdLayerRelease(): void {
    if (this.activeValue || !this.suspendedValue) {
      throw new Error('Classic Bird layer can finalize only from a suspended run');
    }
    this.resetReleasedRun();
  }

  releaseClassicBirdLayerForReplacement(): void {
    this.assertActive();
    this.requireBirdInput().deactivateForNonBirdScreen(this);
    this.releasePhysicsLease();
    this.activeValue = false;
    this.resetReleasedRun();
    this.emitSessionSnapshot();
  }

  raycastAll(
    startWorld: Readonly<{ x: number; y: number }>,
    endWorld: Readonly<{ x: number; y: number }>,
  ) {
    if (!this.physicsLeaseActive) {
      throw new Error('Classic Bird raycast requires the active Physics2D lease');
    }
    return this.physics.raycastAll(startWorld, endWorld);
  }

  callAfterPhysicsStep(mutation: () => void): void {
    if (typeof mutation !== 'function') {
      throw new TypeError('Classic Bird after-step mutation must be a function');
    }
    if (!this.physicsLeaseActive) {
      mutation();
      return;
    }
    this.physics.callAfterStep(mutation);
  }

  completeIntro(): void {
    this.assertActive();
    this.dispatch(this.session.completeIntro());
  }

  checkCombo(position: ClassicBirdPoint): void {
    this.assertActive();
    this.dispatch(this.session.checkCombo(position));
  }

  addScore(value: number): void {
    this.assertActive();
    this.session.addScore(value);
    this.emitSessionSnapshot();
  }

  completeDisplayedScoreScaleUp(): void {
    this.assertActive();
    this.dispatch(this.session.completeDisplayedScoreScaleUp());
  }

  completeDisplayedScoreScaleDown(): void {
    this.assertActive();
    this.session.completeDisplayedScoreScaleDown();
    this.emitSessionSnapshot();
  }

  fruitCut(
    position: ClassicBirdPoint,
    fruitId: number,
    suppliedScore: number,
  ): void {
    this.assertActive();
    this.dispatch(this.session.fruitCut(position, fruitId, suppliedScore));
  }

  fruitFail(position: ClassicBirdPoint): void {
    this.assertActive();
    this.dispatch(this.session.fruitFail(position));
  }

  gameOverFromMiss(): void {
    this.assertActive();
    this.dispatch(this.session.gameOverFromMiss());
  }

  bombHit(): number {
    this.assertActive();
    this.dispatch(this.session.bombHit());
    return this.runGenerationValue;
  }

  /**
   * A standard-bomb presenter may finish after another terminal path removed the run. A matching
   * retired run may still clear its Boolean gate, while an old generation can never mutate a
   * newly activated session or its process-wide Physics2D lease.
   */
  afterBombHit(expectedRunGeneration: number): void {
    assertSafeInteger(expectedRunGeneration, 'expectedRunGeneration');
    if (
      this.destroyedValue
      || !this.loadedValue
      || expectedRunGeneration !== this.runGenerationValue
    ) {
      return;
    }
    this.dispatch(this.session.afterBombHit());
  }

  enlistResultTransitionParticipant(
    participant: ClassicBirdResultTransitionParticipant,
  ): void {
    assertResultParticipant(participant);
    if (
      !this.resultDispatchingValue
      || this.session.snapshot().lifecycle !== 'result-transition'
    ) {
      throw new Error('Classic Bird Result participant can enlist only during dispatch');
    }
    if (this.pendingResultParticipant !== null) {
      throw new Error('Classic Bird Result accepts exactly one participant');
    }
    this.pendingResultParticipant = participant;
  }

  displayScoreComplete(): void {
    this.assertActive();
    if (this.resultDispatchingValue || this.pendingResultParticipant !== null) {
      throw new Error('Classic Bird Result transaction is already active');
    }
    const commands = this.session.displayScoreComplete();
    this.resultDispatchingValue = true;
    let participant: ClassicBirdResultTransitionParticipant | null = null;
    try {
      this.applyAndEmit(commands);
      participant = this.currentResultParticipant();
      if (participant === null) {
        throw new Error('Classic Bird Result construction did not enlist a participant');
      }
      participant.prepareCommit();
      this.session.commitDisplayScoreComplete();
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      let restorationFailure: unknown = null;
      participant = this.currentResultParticipant();
      this.pendingResultParticipant = null;
      this.resultDispatchingValue = false;
      collectFailure(rollbackFailures, () => this.session.rollbackDisplayScoreComplete());
      if (participant !== null) {
        collectFailure(rollbackFailures, () => participant?.rollback());
      }
      try {
        this.restoreAfterFailedResultTransition();
      } catch (restoreError) {
        restorationFailure = restoreError;
        rollbackFailures.push(restoreError);
      }
      collectFailure(rollbackFailures, () => this.emitSessionSnapshot());
      if (restorationFailure instanceof ClassicBirdLifecycleRollbackError) {
        throw new ClassicBirdLifecycleRollbackError(
          'Classic Bird result rollback failed',
          error,
          rollbackFailures,
        );
      }
      if (rollbackFailures.length > 0) {
        throw new ClassicBirdResultTransitionRollbackError(error, rollbackFailures);
      }
      throw error;
    }

    this.pendingResultParticipant = null;
    this.resultDispatchingValue = false;
    let commitError: unknown = null;
    try {
      participant.commit();
    } catch (error) {
      commitError = error;
    }
    const observerErrors: unknown[] = [];
    try {
      this.emitSessionSnapshot();
    } catch (error) {
      observerErrors.push(error);
    }
    if (commitError !== null) {
      throw new ClassicBirdResultTransitionCommitError(
        commitError,
        observerErrors,
      );
    }
    if (observerErrors.length > 0) {
      // Domain and foreground ownership already committed. Observer failures cannot reopen it.
      console.error(observerErrors[0]);
    }
  }

  private dispatch(commands: readonly ClassicBirdSessionCommand[]): void {
    this.applyAndEmit(commands);
    this.emitSessionSnapshot();
  }

  private applyAndEmit(commands: readonly ClassicBirdSessionCommand[]): void {
    for (const command of commands) {
      this.applyResolvedCommand(command);
      this.node.emit(CLASSIC_BIRD_SESSION_COMMAND_EVENT, command);
    }
  }

  private applyResolvedCommand(command: ClassicBirdSessionCommand): void {
    switch (command.type) {
      case 'schedule-speed-up-callback':
        this.speedDelayRemainingSeconds = command.delaySeconds;
        break;
      case 'set-physics-stopped':
        this.worldStoppedValue = command.stopped;
        if (this.physicsLeaseActive) {
          this.physics.setWorldStopped(command.stopped);
        }
        break;
      case 'remove-classic-bird':
        this.requireBirdInput().deactivateForNonBirdScreen(this);
        this.releasePhysicsLease();
        this.activeValue = false;
        this.suspendedValue = false;
        break;
      default:
        break;
    }
  }

  private advanceSpeedDelay(deltaSeconds: number): void {
    const remaining = this.speedDelayRemainingSeconds;
    if (remaining === null) {
      return;
    }
    const next = remaining - deltaSeconds;
    if (next > 0) {
      this.speedDelayRemainingSeconds = next;
      return;
    }
    this.speedDelayRemainingSeconds = null;
    this.applyAndEmit(this.session.speedUpDelayComplete());
  }

  private acquirePhysicsLease(session: ClassicBirdSession): void {
    if (this.physicsLeaseActive) {
      throw new Error('Classic Bird Physics2D lease is already active');
    }
    if (this.physicsRestorePending) {
      this.releasePhysicsLease();
    }
    // From this point the adapter may own a retained singleton snapshot even when configuration
    // or variable-system startup fails. Keep that ownership explicit until restoration succeeds.
    this.physicsRestorePending = true;
    try {
      this.physics.configureResolvedWorldProperties();
      this.physics.startVariableSimulation(
        (frameDeltaSeconds) => session.physicsStepDelta(frameDeltaSeconds),
        (variableDeltaSeconds) => this.afterPhysicsStep(variableDeltaSeconds),
      );
      this.physicsLeaseActive = true;
      this.physics.setWorldStopped(this.worldStoppedValue);
    } catch (error) {
      this.physicsLeaseActive = false;
      const rollbackFailures: unknown[] = [];
      collectFailure(rollbackFailures, () => this.releasePhysicsLease());
      if (rollbackFailures.length > 0) {
        throw new ClassicBirdLifecycleRollbackError(
          'Classic Bird Physics2D acquisition rollback failed',
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
      // The adapter retains its snapshot after a partial restore so a later cleanup boundary can
      // retry. Simulation itself is no longer considered active after restoration was attempted.
      this.physicsLeaseActive = false;
      this.physicsRestorePending = true;
      throw error;
    }
  }

  private afterPhysicsStep(deltaSeconds: number): void {
    const payload: ClassicBirdPhysicsSteppedEvent = Object.freeze({
      deltaSeconds,
    });
    this.node.emit(CLASSIC_BIRD_PHYSICS_STEPPED_EVENT, payload);
  }

  private restoreAfterFailedResultTransition(): void {
    try {
      if (!this.physicsLeaseActive) {
        this.acquirePhysicsLease(this.session);
      }
      this.requireBirdInput().activateForBirdLayer(this);
      this.activeValue = true;
      this.suspendedValue = false;
    } catch (error) {
      this.enterFatalLifecycleBoundary();
      const quiesceFailures: unknown[] = [];
      collectFailure(
        quiesceFailures,
        () => this.requireBirdInput().deactivateForNonBirdScreen(this),
      );
      collectFailure(quiesceFailures, () => this.releasePhysicsLease());
      throw new ClassicBirdLifecycleRollbackError(
        'Classic Bird Result restoration failed',
        error,
        quiesceFailures,
      );
    }
  }

  private resetReleasedRun(): void {
    this.session = new ClassicBirdSession();
    this.runGenerationValue = nextRunGeneration(this.runGenerationValue);
    this.speedDelayRemainingSeconds = null;
    this.suspendedValue = false;
    this.worldStoppedValue = false;
  }

  private enterFatalLifecycleBoundary(): void {
    this.activeValue = false;
    this.suspendedValue = false;
    this.fatalLifecycleValue = true;
  }

  private emitSessionSnapshot(): void {
    this.node.emit(CLASSIC_BIRD_SESSION_SNAPSHOT_EVENT, this.session.snapshot());
  }

  private currentResultParticipant(): ClassicBirdResultTransitionParticipant | null {
    return this.pendingResultParticipant;
  }

  private assertActive(): void {
    if (!this.activeValue || this.destroyedValue) {
      throw new Error('Classic Bird layer must be active');
    }
  }

  private requireBirdInput(): BirdInputController {
    if (this.birdInput === null) {
      throw new Error('Classic Bird input is unavailable before onLoad');
    }
    return this.birdInput;
  }
}

function assertResultParticipant(
  participant: ClassicBirdResultTransitionParticipant,
): void {
  if (
    participant === null
    || typeof participant !== 'object'
    || typeof participant.prepareCommit !== 'function'
    || typeof participant.commit !== 'function'
    || typeof participant.rollback !== 'function'
  ) {
    throw new TypeError(
      'Classic Bird Result participant must provide prepareCommit, commit, and rollback',
    );
  }
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}

function nextRunGeneration(current: number): number {
  assertSafeInteger(current, 'currentRunGeneration');
  if (current >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Classic Bird run generation exhausted');
  }
  return current + 1;
}

function collectFailure(failures: unknown[], operation: () => void): void {
  try {
    operation();
  } catch (error) {
    failures.push(error);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
