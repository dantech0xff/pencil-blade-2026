import { _decorator, Component } from 'cc';

import type { BladeSegment } from '../domain/blade-tracks';
import {
  CrazySession,
  type CrazyPoint,
  type CrazySessionCommand,
  type CrazySessionSnapshot,
} from '../domain/crazy-session';
import {
  CRAZY_BIRD_TIMED_PROFILE,
  CRAZY_TIMED_PROFILE,
  type CrazyTimedModeProfile,
} from '../domain/crazy-timed-mode-profile';
import { BladeInputController } from './blade-input-controller';
import { BirdInputController } from './bird-input-controller';
import {
  CrazyPhysicsActivationError,
  CrazyPhysicsAdapter,
} from './crazy-physics-adapter';

const { ccclass, requireComponent } = _decorator;

export const CRAZY_PHYSICS_STEPPED_EVENT = 'crazy-physics-stepped';
export const CRAZY_SESSION_COMMAND_EVENT = 'crazy-session-command';
export const CRAZY_SESSION_SNAPSHOT_EVENT = 'crazy-session-snapshot';
export const CRAZY_BIRD_PHYSICS_STEPPED_EVENT = 'crazy-bird-physics-stepped';
export const CRAZY_BIRD_SESSION_COMMAND_EVENT = 'crazy-bird-session-command';
export const CRAZY_BIRD_SESSION_SNAPSHOT_EVENT = 'crazy-bird-session-snapshot';

export interface CrazyPhysicsSteppedEvent {
  readonly bladeSegments: readonly BladeSegment[];
  readonly deltaSeconds: number;
}

export interface CrazyBirdPhysicsSteppedEvent {
  readonly deltaSeconds: number;
  readonly mode: 4;
}

/**
 * Gameplay enlists its provisional Result owner while the scene is dispatching the recovered
 * Time-Up Finish command batch. Rollback runs before the old input/physics leases are restored;
 * commit runs only after CrazySession reaches its irreversible result-removed boundary.
 */
export interface CrazyTimeUpFinishParticipant {
  prepareCommit(): void;
  commit(): void;
  rollback(): void;
}

export class CrazyTimeUpDispatchError extends Error {
  readonly cause: unknown;
  readonly errors: readonly unknown[];

  constructor(failures: readonly unknown[]) {
    super(`Crazy Time Up dispatch failed: ${failures.map(errorMessage).join('; ')}`);
    this.name = 'CrazyTimeUpDispatchError';
    this.cause = failures[0];
    this.errors = Object.freeze([...failures]);
  }
}

export class CrazyTimeUpFinishRollbackError extends Error {
  readonly cause: unknown;
  readonly rollbackErrors: readonly unknown[];

  constructor(primary: unknown, rollbackFailures: readonly unknown[]) {
    super(
      `Crazy Time-Up Finish rollback failed: ${errorMessage(primary)}; rollback: `
        + rollbackFailures.map(errorMessage).join('; '),
    );
    this.name = 'CrazyTimeUpFinishRollbackError';
    this.cause = primary;
    this.rollbackErrors = Object.freeze([...rollbackFailures]);
  }
}

export class CrazyLifecycleRollbackError extends Error {
  readonly cause: unknown;
  readonly rollbackErrors: readonly unknown[];

  constructor(label: string, primary: unknown, rollbackFailures: readonly unknown[]) {
    super(
      `${label}: ${errorMessage(primary)}`
      + (
        rollbackFailures.length === 0
          ? ''
          : `; rollback: ${rollbackFailures.map(errorMessage).join('; ')}`
      ),
    );
    this.name = 'CrazyLifecycleRollbackError';
    this.cause = primary;
    this.rollbackErrors = Object.freeze([...rollbackFailures]);
  }
}

export class CrazyTimeUpFinishCommitError extends Error {
  readonly cause: unknown;
  readonly observerErrors: readonly unknown[];

  constructor(primary: unknown, observerErrors: readonly unknown[]) {
    super(
      `Crazy Time-Up Finish commit failed: ${errorMessage(primary)}`
      + (
        observerErrors.length === 0
          ? ''
          : `; observers: ${observerErrors.map(errorMessage).join('; ')}`
      ),
    );
    this.name = 'CrazyTimeUpFinishCommitError';
    this.cause = primary;
    this.observerErrors = Object.freeze([...observerErrors]);
  }
}

/**
 * Passive serialized owner for a Crazy-family timed session, its selected input lease, and
 * variable Physics2D. The app shell activates it only after the matching catalog and detached
 * foreground are ready.
 */
@ccclass('CrazySceneController')
@requireComponent(BladeInputController)
@requireComponent(BirdInputController)
export class CrazySceneController extends Component {
  private activeValue = false;
  private birdInput: BirdInputController | null = null;
  private bladeInput: BladeInputController | null = null;
  private destroyedValue = false;
  private fatalLifecycleValue = false;
  private loadedValue = false;
  private pendingTimeUpFinishParticipant: CrazyTimeUpFinishParticipant | null = null;
  private readonly physics = new CrazyPhysicsAdapter();
  private profileValue: CrazyTimedModeProfile = CRAZY_TIMED_PROFILE;
  private session = new CrazySession();
  private suspendedValue = false;
  private timeUpFinishDispatchingValue = false;
  private worldFrozenValue = false;

  onLoad(): void {
    const bladeInput = this.getComponent(BladeInputController);
    const birdInput = this.getComponent(BirdInputController);
    if (bladeInput === null) {
      throw new Error('CrazySceneController requires BladeInputController');
    }
    if (birdInput === null) {
      throw new Error('CrazySceneController requires BirdInputController');
    }
    this.bladeInput = bladeInput;
    this.birdInput = birdInput;
    bladeInput.deactivateForNonClassicScreen();
    birdInput.deactivateForNonBirdScreen(this);
    this.loadedValue = true;
  }

  start(): void {
    // Intentionally passive. Crazy resources and foreground placement are app-shell owned.
  }

  update(): void {
    if (this.activeValue) {
      this.dispatch(this.session.updateScorePresentation());
    }
  }

  onDestroy(): void {
    this.destroyedValue = true;
    this.activeValue = false;
    this.loadedValue = false;
    this.suspendedValue = false;
    this.pendingTimeUpFinishParticipant = null;
    this.timeUpFinishDispatchingValue = false;
    const failures: unknown[] = [];
    collectFailure(failures, () => this.deactivateModeInput(this.profileValue));
    collectFailure(failures, () => this.physics.deactivate());
    if (failures.length === 1) {
      throw failures[0];
    }
    if (failures.length > 1) {
      throw new CrazyLifecycleRollbackError(
        'Crazy destruction cleanup failed',
        failures[0],
        failures.slice(1),
      );
    }
    this.worldFrozenValue = false;
  }

  get active(): boolean {
    return this.activeValue;
  }

  get fatalLifecycle(): boolean {
    return this.fatalLifecycleValue;
  }

  get suspended(): boolean {
    return this.suspendedValue;
  }

  get readyForActivation(): boolean {
    return (
      this.loadedValue
      && !this.destroyedValue
      && !this.fatalLifecycleValue
      && this.bladeInput !== null
      && this.birdInput !== null
    );
  }

  get timedModeProfile(): CrazyTimedModeProfile {
    return this.profileValue;
  }

  sessionSnapshot(): CrazySessionSnapshot {
    return this.session.snapshot();
  }

  /**
   * Creates a fresh mode-1 session and synchronously publishes native onEnter construction
   * commands. Any presenter failure restores the exact inactive boundary.
   */
  activateCrazyLayer(initialBestScore: number): void {
    this.activateTimedModeLayer(initialBestScore, CRAZY_TIMED_PROFILE);
  }

  /**
   * Creates the mode-4 timed session while leasing the shared owner-bound Bird input.
   */
  activateCrazyBirdLayer(initialBestScore: number): void {
    this.activateTimedModeLayer(initialBestScore, CRAZY_BIRD_TIMED_PROFILE);
  }

  private activateTimedModeLayer(
    initialBestScore: number,
    profile: CrazyTimedModeProfile,
  ): void {
    if (this.destroyedValue) {
      throw new Error('Crazy layer cannot activate after scene destruction');
    }
    if (!this.loadedValue || this.fatalLifecycleValue) {
      throw new Error('Crazy layer cannot activate before load or after a fatal lifecycle failure');
    }
    if (this.activeValue) {
      throw new Error('Crazy layer is already active');
    }
    if (this.suspendedValue) {
      throw new Error('Crazy layer cannot activate while a suspended run is retained');
    }
    if (
      this.timeUpFinishDispatchingValue
      || this.pendingTimeUpFinishParticipant !== null
    ) {
      throw new Error('Crazy layer cannot activate during a Result transaction');
    }
    if (
      this.session.snapshot().lifecycle !== 'intro'
      && this.session.snapshot().lifecycle !== 'result-removed'
    ) {
      throw new Error('Crazy layer cannot activate from the current lifecycle');
    }
    const previousSession = this.session;
    const previousProfile = this.profileValue;
    const previousWorldFrozen = this.worldFrozenValue;
    const freshSession = new CrazySession(initialBestScore, profile);
    this.session = freshSession;
    this.profileValue = profile;
    this.worldFrozenValue = false;
    try {
      this.deactivateAlternateInput(profile);
      this.physics.activate((deltaSeconds) => this.afterPhysicsStep(deltaSeconds));
      this.activateModeInput(profile);
      this.activeValue = true;
      this.dispatch(freshSession.enterScene());
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      this.session = previousSession;
      this.profileValue = previousProfile;
      this.activeValue = false;
      collectFailure(
        rollbackFailures,
        () => this.deactivateModeInput(profile),
      );
      collectFailure(rollbackFailures, () => this.physics.deactivate());
      this.worldFrozenValue = previousWorldFrozen;
      if (rollbackFailures.length > 0) {
        this.enterFatalLifecycleBoundary();
        throw new CrazyLifecycleRollbackError(
          'Crazy activation rollback failed',
          error,
          rollbackFailures,
        );
      }
      if (isPhysicsActivationCleanupFailure(error)) {
        this.enterFatalLifecycleBoundary();
        throw new CrazyLifecycleRollbackError(
          'Crazy activation rollback failed',
          error,
          [],
        );
      }
      throw error;
    }
  }

  /**
   * Reversibly releases the process-wide Physics2D and blade leases while retaining the
   * exact active session. Pause navigation uses this boundary before another screen starts.
   */
  suspendCrazyLayerForNavigation(): void {
    this.assertActive();
    this.releaseModeLeasesWithRollback(
      'Crazy navigation suspension rollback failed',
    );
    this.activeValue = false;
    this.suspendedValue = true;
  }

  /**
   * Reacquires the same leases without re-entering or rebuilding the retained session.
   */
  resumeSuspendedCrazyLayer(): void {
    if (this.destroyedValue) {
      throw new Error('Crazy layer cannot resume after scene destruction');
    }
    if (
      this.fatalLifecycleValue
      || this.activeValue
      || !this.suspendedValue
      || this.timeUpFinishDispatchingValue
    ) {
      throw new Error('Crazy layer can resume only from a suspended run');
    }
    const cutEnabled = this.session.snapshot().cutEnabled;
    try {
      this.physics.activate((deltaSeconds) => this.afterPhysicsStep(deltaSeconds));
      if (this.worldFrozenValue) {
        this.physics.freezeWorld();
      }
      this.activateModeInput(this.profileValue);
      this.applyCutEnabledToInput(cutEnabled);
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      collectFailure(
        rollbackFailures,
        () => this.deactivateModeInput(this.profileValue),
      );
      collectFailure(rollbackFailures, () => this.physics.deactivate());
      if (
        rollbackFailures.length > 0
        || isPhysicsActivationCleanupFailure(error)
      ) {
        this.enterFatalLifecycleBoundary();
        if (rollbackFailures.length > 0) {
          throw new CrazyLifecycleRollbackError(
            'Crazy navigation resume rollback failed',
            error,
            rollbackFailures,
          );
        }
        throw new CrazyLifecycleRollbackError(
          'Crazy navigation resume rollback failed',
          error,
          [],
        );
      }
      throw error;
    }
    this.activeValue = true;
    this.suspendedValue = false;
  }

  /**
   * Irreversibly ends a suspended run after its destination screen has committed.
   */
  finalizeSuspendedCrazyLayerRelease(): void {
    if (this.activeValue || !this.suspendedValue) {
      throw new Error('Crazy layer can finalize only from a suspended run');
    }
    this.resetReleasedRun();
  }

  /**
   * Releases the active timed-mode input/physics lease when Pause Replay or Quit removes the
   * gameplay layer. Result removal reaches the same inactive boundary through its profiled
   * session command; pause navigation has no native session command, so its owner calls this seam.
   */
  releaseCrazyLayerForReplacement(): void {
    this.assertActive();
    this.releaseModeLeasesWithRollback(
      'Crazy replacement release rollback failed',
    );
    this.activeValue = false;
    this.resetReleasedRun();
    this.emitSessionSnapshot();
  }

  raycastAll(
    startWorld: Readonly<{ readonly x: number; readonly y: number }>,
    endWorld: Readonly<{ readonly x: number; readonly y: number }>,
  ) {
    return this.physics.raycastAll(startWorld, endWorld);
  }

  callAfterPhysicsStep(mutation: () => void): void {
    if (typeof mutation !== 'function') {
      throw new TypeError('Crazy after-step mutation must be a function');
    }
    // An inactive world cannot be inside a locked physics step. Teardown that follows the
    // native remove-crazy boundary therefore commits immediately instead of losing its
    // entity owner merely because the variable-step lease has already been released.
    if (!this.physics.state.active) {
      mutation();
      return;
    }
    this.physics.callAfterStep(mutation);
  }

  completeIntro(): void {
    this.assertActive();
    this.dispatch(this.session.completeIntro());
  }

  addScore(value: number): void {
    this.assertActive();
    this.session.addScore(value);
    this.emitSessionSnapshot();
  }

  enableDoubleScore(): void {
    this.assertActive();
    this.dispatch(this.session.enableDoubleScore());
  }

  disableDoubleScore(): void {
    this.assertActive();
    this.dispatch(this.session.disableDoubleScore());
  }

  finishDoubleScore(): void {
    this.assertActive();
    this.dispatch(this.session.finishDoubleScore());
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

  fruitFail(position: CrazyPoint): void {
    this.assertActive();
    this.dispatch(this.session.fruitFail(position));
  }

  bonusFruitFail(position: CrazyPoint): void {
    this.assertActive();
    this.dispatch(this.session.bonusFruitFail(position));
  }

  bombHit(position: CrazyPoint): void {
    this.assertActive();
    this.dispatch(this.session.bombHit(position));
  }

  afterBombHit(): void {
    this.assertActive();
    this.dispatch(this.session.afterBombHit());
  }

  freezeStart(): void {
    this.assertActive();
    this.dispatch(this.session.freezeStart());
  }

  freezeFinish(): void {
    this.assertActive();
    this.dispatch(this.session.freezeFinish());
  }

  timeUp(): void {
    this.assertActive();
    const failures: unknown[] = [];
    for (const command of this.session.timeUp()) {
      try {
        this.applyResolvedCommand(command);
        this.node.emit(this.sessionCommandEvent(), command);
      } catch (error) {
        // The listener may have committed before throwing. Never replay it; continue the
        // recovered ordered suffix once, then surface every original failure together.
        failures.push(error);
      }
    }
    try {
      this.emitSessionSnapshot();
    } catch (error) {
      failures.push(error);
    }
    throwTimeUpDispatchFailures(failures);
  }

  enlistTimeUpFinishParticipant(participant: CrazyTimeUpFinishParticipant): void {
    if (
      participant === null
      || typeof participant !== 'object'
      || typeof participant.prepareCommit !== 'function'
      || typeof participant.commit !== 'function'
      || typeof participant.rollback !== 'function'
    ) {
      throw new TypeError(
        'Crazy Time-Up Finish participant must provide prepareCommit, commit, and rollback',
      );
    }
    if (
      !this.timeUpFinishDispatchingValue
      || this.session.snapshot().lifecycle !== 'result-transition'
    ) {
      throw new Error('Crazy Time-Up Finish participant can enlist only during command dispatch');
    }
    if (this.pendingTimeUpFinishParticipant !== null) {
      throw new Error('Crazy Time-Up Finish accepts exactly one gameplay participant');
    }
    this.pendingTimeUpFinishParticipant = participant;
  }

  timeUpFinish(): void {
    this.assertActive();
    if (
      this.timeUpFinishDispatchingValue
      || this.pendingTimeUpFinishParticipant !== null
    ) {
      throw new Error('Crazy Time-Up Finish transaction is already active');
    }
    const commands = this.session.timeUpFinish();
    this.timeUpFinishDispatchingValue = true;
    let participant: CrazyTimeUpFinishParticipant | null = null;
    try {
      this.applyAndEmit(commands);
      participant = this.currentTimeUpFinishParticipant();
      if (participant === null) {
        throw new Error(
          'Crazy Time-Up Finish requires an enlisted gameplay participant',
        );
      }
      participant.prepareCommit();
      this.session.commitTimeUpFinish();
      this.worldFrozenValue = false;
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      let restorationFailure: unknown = null;
      participant = this.currentTimeUpFinishParticipant();
      this.pendingTimeUpFinishParticipant = null;
      this.timeUpFinishDispatchingValue = false;
      collectFailure(rollbackFailures, () => this.session.rollbackTimeUpFinish());
      if (participant !== null) {
        const rollbackParticipant = participant;
        collectFailure(rollbackFailures, () => rollbackParticipant.rollback());
      }
      if (!this.fatalLifecycleValue) {
        try {
          this.restoreAfterFailedResultTransition();
        } catch (restoreError) {
          restorationFailure = restoreError;
          rollbackFailures.push(restoreError);
        }
      }
      collectFailure(rollbackFailures, () => this.emitSessionSnapshot());
      if (restorationFailure instanceof CrazyLifecycleRollbackError) {
        throw new CrazyLifecycleRollbackError(
          'Crazy Result rollback failed',
          error,
          rollbackFailures,
        );
      }
      if (rollbackFailures.length > 0) {
        throw new CrazyTimeUpFinishRollbackError(error, rollbackFailures);
      }
      throw error;
    }
    this.pendingTimeUpFinishParticipant = null;
    this.timeUpFinishDispatchingValue = false;
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
      throw new CrazyTimeUpFinishCommitError(commitError, observerErrors);
    }
    if (observerErrors.length > 0) {
      // The Result and domain lifecycle are already committed and the old TimeManager owner may
      // be disposed. Report post-commit observer failure without falsely rearming that callback.
      console.error(observerErrors[0]);
    }
  }

  private dispatch(commands: readonly CrazySessionCommand[]): void {
    this.applyAndEmit(commands);
    this.emitSessionSnapshot();
  }

  private applyAndEmit(commands: readonly CrazySessionCommand[]): void {
    for (const command of commands) {
      this.applyResolvedCommand(command);
      this.node.emit(this.sessionCommandEvent(), command);
    }
  }

  private applyResolvedCommand(command: CrazySessionCommand): void {
    switch (command.type) {
      case 'set-cut-enabled':
        this.applyCutEnabledToInput(command.enabled);
        break;
      case 'freeze-world':
        this.physics.freezeWorld();
        this.worldFrozenValue = true;
        break;
      case 'unfreeze-world':
        this.physics.unfreezeWorld();
        this.worldFrozenValue = false;
        break;
      case 'remove-crazy':
      case 'remove-crazy-bird':
        this.releaseModeLeasesWithRollback(
          'Crazy Result removal rollback failed',
        );
        this.activeValue = false;
        this.suspendedValue = false;
        break;
      default:
        break;
    }
  }

  private afterPhysicsStep(deltaSeconds: number): void {
    if (this.profileValue.kind === 'crazy-bird') {
      const payload: CrazyBirdPhysicsSteppedEvent = Object.freeze({
        deltaSeconds,
        mode: 4,
      });
      this.node.emit(CRAZY_BIRD_PHYSICS_STEPPED_EVENT, payload);
      return;
    }
    const payload: CrazyPhysicsSteppedEvent = Object.freeze({
      bladeSegments: Object.freeze([
        ...(this.bladeInput?.segmentsForPostPhysicsUpdate() ?? []),
      ]),
      deltaSeconds,
    });
    this.node.emit(CRAZY_PHYSICS_STEPPED_EVENT, payload);
  }

  private restoreAfterFailedResultTransition(): void {
    try {
      if (!this.physics.state.active) {
        this.physics.activate((deltaSeconds) => this.afterPhysicsStep(deltaSeconds));
        if (this.worldFrozenValue) {
          this.physics.freezeWorld();
        }
      }
      this.activateModeInput(this.profileValue);
      this.applyCutEnabledToInput(true);
      this.activeValue = true;
      this.suspendedValue = false;
    } catch (error) {
      const quiesceFailures: unknown[] = [];
      this.enterFatalLifecycleBoundary();
      collectFailure(
        quiesceFailures,
        () => this.deactivateModeInput(this.profileValue),
      );
      collectFailure(quiesceFailures, () => this.physics.deactivate());
      throw new CrazyLifecycleRollbackError(
        'Crazy Result restoration failed',
        error,
        quiesceFailures,
      );
    }
  }

  private emitSessionSnapshot(): void {
    this.node.emit(this.sessionSnapshotEvent(), this.session.snapshot());
  }

  private assertActive(): void {
    if (!this.activeValue || this.destroyedValue || this.fatalLifecycleValue) {
      throw new Error('Crazy layer must be active');
    }
  }

  private activateModeInput(profile: CrazyTimedModeProfile): void {
    if (profile.kind === 'crazy-bird') {
      this.requireBirdInput().activateForBirdLayer(this);
      return;
    }
    this.requireBladeInput().activateForClassicLayer();
  }

  private deactivateModeInput(profile: CrazyTimedModeProfile): void {
    if (profile.kind === 'crazy-bird') {
      this.requireBirdInput().deactivateForNonBirdScreen(this);
      return;
    }
    this.requireBladeInput().deactivateForNonClassicScreen();
  }

  private deactivateAlternateInput(profile: CrazyTimedModeProfile): void {
    if (profile.kind === 'crazy-bird') {
      this.requireBladeInput().deactivateForNonClassicScreen();
      return;
    }
    this.requireBirdInput().deactivateForNonBirdScreen(this);
  }

  private applyCutEnabledToInput(enabled: boolean): void {
    if (this.profileValue.kind === 'crazy') {
      this.requireBladeInput().setCutEnabled(enabled);
    }
  }

  private releaseModeLeasesWithRollback(label: string): void {
    const profile = this.profileValue;
    const cutEnabled = this.session.snapshot().cutEnabled;
    let physicsReleaseAttempted = false;
    try {
      this.deactivateModeInput(profile);
      physicsReleaseAttempted = true;
      this.physics.deactivate();
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      try {
        if (physicsReleaseAttempted && this.physics.state.active) {
          this.physics.deactivate();
        }
        if (!this.physics.state.active) {
          this.physics.activate((deltaSeconds) => this.afterPhysicsStep(deltaSeconds));
          if (this.worldFrozenValue) {
            this.physics.freezeWorld();
          }
        }
        this.activateModeInput(profile);
        this.applyCutEnabledToInput(cutEnabled);
      } catch (rollbackError) {
        rollbackFailures.push(rollbackError);
      }
      if (rollbackFailures.length > 0) {
        this.enterFatalLifecycleBoundary();
        collectFailure(
          rollbackFailures,
          () => this.deactivateModeInput(profile),
        );
        collectFailure(rollbackFailures, () => this.physics.deactivate());
        throw new CrazyLifecycleRollbackError(label, error, rollbackFailures);
      }
      throw error;
    }
  }

  private resetReleasedRun(): void {
    this.session = new CrazySession(0, this.profileValue);
    this.suspendedValue = false;
    this.worldFrozenValue = false;
  }

  private enterFatalLifecycleBoundary(): void {
    this.activeValue = false;
    this.suspendedValue = false;
    this.fatalLifecycleValue = true;
  }

  private sessionCommandEvent(): string {
    return this.profileValue.kind === 'crazy-bird'
      ? CRAZY_BIRD_SESSION_COMMAND_EVENT
      : CRAZY_SESSION_COMMAND_EVENT;
  }

  private sessionSnapshotEvent(): string {
    return this.profileValue.kind === 'crazy-bird'
      ? CRAZY_BIRD_SESSION_SNAPSHOT_EVENT
      : CRAZY_SESSION_SNAPSHOT_EVENT;
  }

  private requireBirdInput(): BirdInputController {
    if (this.birdInput === null) {
      throw new Error('Crazy Bird input is unavailable before onLoad');
    }
    return this.birdInput;
  }

  private requireBladeInput(): BladeInputController {
    if (this.bladeInput === null) {
      throw new Error('Crazy blade input is unavailable before onLoad');
    }
    return this.bladeInput;
  }

  private currentTimeUpFinishParticipant(): CrazyTimeUpFinishParticipant | null {
    return this.pendingTimeUpFinishParticipant;
  }
}

function collectFailure(failures: unknown[], action: () => void): void {
  try {
    action();
  } catch (error) {
    failures.push(error);
  }
}

function throwTimeUpDispatchFailures(failures: readonly unknown[]): void {
  if (failures.length === 0) {
    return;
  }
  if (failures.length === 1) {
    throw failures[0];
  }
  throw new CrazyTimeUpDispatchError(failures);
}

function isPhysicsActivationCleanupFailure(error: unknown): boolean {
  return error instanceof CrazyPhysicsActivationError;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
