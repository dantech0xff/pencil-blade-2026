import { _decorator, Component } from 'cc';

import type { BladeSegment } from '../domain/blade-tracks';
import {
  CrazySession,
  type CrazyPoint,
  type CrazySessionCommand,
  type CrazySessionSnapshot,
} from '../domain/crazy-session';
import { BladeInputController } from './blade-input-controller';
import { CrazyPhysicsAdapter } from './crazy-physics-adapter';

const { ccclass, requireComponent } = _decorator;

export const CRAZY_PHYSICS_STEPPED_EVENT = 'crazy-physics-stepped';
export const CRAZY_SESSION_COMMAND_EVENT = 'crazy-session-command';
export const CRAZY_SESSION_SNAPSHOT_EVENT = 'crazy-session-snapshot';

export interface CrazyPhysicsSteppedEvent {
  readonly bladeSegments: readonly BladeSegment[];
  readonly deltaSeconds: number;
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

/**
 * Passive serialized owner for Crazy session, blade lease, and variable Physics2D lease.
 * The app shell activates it only after the Crazy catalog and detached foreground are ready.
 */
@ccclass('CrazySceneController')
@requireComponent(BladeInputController)
export class CrazySceneController extends Component {
  private activeValue = false;
  private bladeInput: BladeInputController | null = null;
  private destroyedValue = false;
  private loadedValue = false;
  private pendingTimeUpFinishParticipant: CrazyTimeUpFinishParticipant | null = null;
  private readonly physics = new CrazyPhysicsAdapter();
  private session = new CrazySession();
  private suspendedValue = false;
  private timeUpFinishDispatchingValue = false;
  private worldFrozenValue = false;

  onLoad(): void {
    const bladeInput = this.getComponent(BladeInputController);
    if (bladeInput === null) {
      throw new Error('CrazySceneController requires BladeInputController');
    }
    this.bladeInput = bladeInput;
    bladeInput.deactivateForNonClassicScreen();
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
    this.worldFrozenValue = false;
    this.bladeInput?.deactivateForNonClassicScreen();
    this.physics.deactivate();
  }

  get active(): boolean {
    return this.activeValue;
  }

  get suspended(): boolean {
    return this.suspendedValue;
  }

  get readyForActivation(): boolean {
    return this.loadedValue && !this.destroyedValue && this.bladeInput !== null;
  }

  sessionSnapshot(): CrazySessionSnapshot {
    return this.session.snapshot();
  }

  /**
   * Creates a fresh mode-1 session and synchronously publishes native onEnter construction
   * commands. Any presenter failure restores the exact inactive boundary.
   */
  activateCrazyLayer(initialBestScore: number): void {
    if (this.destroyedValue) {
      throw new Error('Crazy layer cannot activate after scene destruction');
    }
    if (this.activeValue) {
      throw new Error('Crazy layer is already active');
    }
    if (this.suspendedValue) {
      throw new Error('Crazy layer cannot activate while a suspended run is retained');
    }
    if (
      this.session.snapshot().lifecycle !== 'intro'
      && this.session.snapshot().lifecycle !== 'result-removed'
    ) {
      throw new Error('Crazy layer cannot activate from the current lifecycle');
    }
    const bladeInput = this.requireBladeInput();
    const previousSession = this.session;
    const freshSession = new CrazySession(initialBestScore);
    try {
      this.physics.activate((deltaSeconds) => this.afterPhysicsStep(deltaSeconds));
      bladeInput.activateForClassicLayer();
      this.session = freshSession;
      this.activeValue = true;
      this.worldFrozenValue = false;
      this.dispatch(freshSession.enterScene());
    } catch (error) {
      bladeInput.deactivateForNonClassicScreen();
      this.physics.deactivate();
      this.session = previousSession;
      this.activeValue = false;
      this.worldFrozenValue = false;
      throw error;
    }
  }

  /**
   * Reversibly releases the process-wide Physics2D and blade leases while retaining the
   * exact active session. Pause navigation uses this boundary before another screen starts.
   */
  suspendCrazyLayerForNavigation(): void {
    this.assertActive();
    const bladeInput = this.requireBladeInput();
    const cutEnabled = this.session.snapshot().cutEnabled;
    try {
      bladeInput.deactivateForNonClassicScreen();
      this.physics.deactivate();
    } catch (error) {
      try {
        if (!this.physics.state.active) {
          this.physics.activate((deltaSeconds) => this.afterPhysicsStep(deltaSeconds));
          if (this.worldFrozenValue) {
            this.physics.freezeWorld();
          }
        }
        bladeInput.activateForClassicLayer();
        bladeInput.setCutEnabled(cutEnabled);
      } catch (rollbackError) {
        console.error(rollbackError);
      }
      throw error;
    }
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
    if (this.activeValue || !this.suspendedValue) {
      throw new Error('Crazy layer can resume only from a suspended run');
    }
    const bladeInput = this.requireBladeInput();
    const cutEnabled = this.session.snapshot().cutEnabled;
    try {
      this.physics.activate((deltaSeconds) => this.afterPhysicsStep(deltaSeconds));
      if (this.worldFrozenValue) {
        this.physics.freezeWorld();
      }
      bladeInput.activateForClassicLayer();
      bladeInput.setCutEnabled(cutEnabled);
    } catch (error) {
      bladeInput.deactivateForNonClassicScreen();
      this.physics.deactivate();
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
    this.session = new CrazySession();
    this.suspendedValue = false;
    this.worldFrozenValue = false;
  }

  /**
   * Releases the active mode-1 input/physics lease when Pause Replay or Quit removes the
   * gameplay layer. Result removal reaches the same inactive boundary through its session
   * command; pause navigation has no native session command, so its owner calls this seam.
   */
  releaseCrazyLayerForReplacement(): void {
    this.assertActive();
    this.requireBladeInput().deactivateForNonClassicScreen();
    this.physics.deactivate();
    this.activeValue = false;
    this.suspendedValue = false;
    this.worldFrozenValue = false;
    // A later entry always constructs a fresh session, matching GetReplayInstance and
    // re-entry from Mode Select. Keeping an intro sentinel also preserves activate's gate.
    this.session = new CrazySession();
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
        this.node.emit(CRAZY_SESSION_COMMAND_EVENT, command);
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
      participant?.prepareCommit();
      this.session.commitTimeUpFinish();
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      participant = this.currentTimeUpFinishParticipant();
      this.pendingTimeUpFinishParticipant = null;
      this.timeUpFinishDispatchingValue = false;
      collectFailure(rollbackFailures, () => this.session.rollbackTimeUpFinish());
      if (participant !== null) {
        const rollbackParticipant = participant;
        collectFailure(rollbackFailures, () => rollbackParticipant.rollback());
      }
      collectFailure(
        rollbackFailures,
        () => this.restoreAfterFailedResultTransition(),
      );
      collectFailure(rollbackFailures, () => this.emitSessionSnapshot());
      if (rollbackFailures.length > 0) {
        throw new CrazyTimeUpFinishRollbackError(error, rollbackFailures);
      }
      throw error;
    }
    this.pendingTimeUpFinishParticipant = null;
    this.timeUpFinishDispatchingValue = false;
    participant?.commit();
    try {
      this.emitSessionSnapshot();
    } catch (error) {
      // The Result and domain lifecycle are already committed and the old TimeManager owner may
      // be disposed. Report post-commit observer failure without falsely rearming that callback.
      console.error(error);
    }
  }

  private dispatch(commands: readonly CrazySessionCommand[]): void {
    this.applyAndEmit(commands);
    this.emitSessionSnapshot();
  }

  private applyAndEmit(commands: readonly CrazySessionCommand[]): void {
    for (const command of commands) {
      this.applyResolvedCommand(command);
      this.node.emit(CRAZY_SESSION_COMMAND_EVENT, command);
    }
  }

  private applyResolvedCommand(command: CrazySessionCommand): void {
    switch (command.type) {
      case 'set-cut-enabled':
        this.bladeInput?.setCutEnabled(command.enabled);
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
        this.requireBladeInput().deactivateForNonClassicScreen();
        this.physics.deactivate();
        this.activeValue = false;
        this.suspendedValue = false;
        this.worldFrozenValue = false;
        break;
      default:
        break;
    }
  }

  private afterPhysicsStep(deltaSeconds: number): void {
    const payload: CrazyPhysicsSteppedEvent = Object.freeze({
      bladeSegments: Object.freeze([
        ...(this.bladeInput?.segmentsForPostPhysicsUpdate() ?? []),
      ]),
      deltaSeconds,
    });
    this.node.emit(CRAZY_PHYSICS_STEPPED_EVENT, payload);
  }

  private restoreAfterFailedResultTransition(): void {
    const bladeInput = this.requireBladeInput();
    if (!this.physics.state.active) {
      this.physics.activate((deltaSeconds) => this.afterPhysicsStep(deltaSeconds));
    }
    bladeInput.activateForClassicLayer();
    bladeInput.setCutEnabled(true);
    this.activeValue = true;
    this.suspendedValue = false;
    this.worldFrozenValue = false;
  }

  private emitSessionSnapshot(): void {
    this.node.emit(CRAZY_SESSION_SNAPSHOT_EVENT, this.session.snapshot());
  }

  private assertActive(): void {
    if (!this.activeValue) {
      throw new Error('Crazy layer must be active');
    }
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
