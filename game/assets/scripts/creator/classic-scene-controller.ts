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

interface ClassicLayerRestartRollbackState {
  readonly classicLayerRemovedForResult: boolean;
  readonly initialClassicActivated: boolean;
  readonly session: ClassicSession;
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
  private initialClassicActivated = false;
  private initialClassicActivationInProgress = false;
  private classicLayerRemovedForResult = false;
  private pendingLayerRestartRollback: ClassicLayerRestartRollbackState | null = null;
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

  onDestroy(): void {
    this.destroyed = true;
    this.unschedule(this.onSpeedUpDelayComplete);
    this.bladeInput?.deactivateForNonClassicScreen();
    this.physics.restorePreviousWorldProperties();
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
    if (this.destroyed) {
      throw new Error('Initial Classic layer cannot activate after scene destruction');
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
    try {
      this.physics.configureResolvedWorldProperties();
      this.physics.startVariableSimulation(
        (frameDeltaSeconds) => freshWorldSpeed.physicsStepDelta(frameDeltaSeconds),
        (variableDeltaSeconds) => this.afterPhysicsStep(variableDeltaSeconds),
      );
      this.session = freshSession;
      this.worldSpeed = freshWorldSpeed;
      bladeInput.activateForClassicLayer();
      this.applyWorldSpeedCommands(freshWorldSpeed.enableClassicSpeedUp());
      this.emitSessionSnapshot();
      this.initialClassicActivated = true;
    } catch (error) {
      this.unschedule(this.onSpeedUpDelayComplete);
      bladeInput.deactivateForNonClassicScreen();
      this.physics.restorePreviousWorldProperties();
      this.session = previousSession;
      this.worldSpeed = previousWorldSpeed;
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

  /** Reattaches a fresh Classic layer under the existing scene parent after Result removal. */
  restartClassicLayer(): void {
    if (this.destroyed) {
      throw new Error('Classic layer cannot restart after scene destruction');
    }
    if (
      this.session.snapshot().lifecycle !== 'result-removed'
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
      classicLayerRemovedForResult: this.classicLayerRemovedForResult,
      initialClassicActivated: this.initialClassicActivated,
      session: this.session,
      worldSpeed: this.worldSpeed,
    });
    this.unschedule(this.onSpeedUpDelayComplete);
    try {
      this.physics.configureResolvedWorldProperties();
      this.physics.startVariableSimulation(
        (frameDeltaSeconds) => freshWorldSpeed.physicsStepDelta(frameDeltaSeconds),
        (variableDeltaSeconds) => this.afterPhysicsStep(variableDeltaSeconds),
      );

      this.session = freshSession;
      this.worldSpeed = freshWorldSpeed;
      this.classicLayerRemovedForResult = false;
      this.initialClassicActivated = true;
      bladeInput.activateForClassicLayer();
      this.applyWorldSpeedCommands(freshWorldSpeed.enableClassicSpeedUp());
      this.emitSessionSnapshot();
    } catch (error) {
      this.restorePendingClassicLayerRestart();
      throw error;
    }
  }

  /** Commits only after the staged Classic node has joined the captured native parent. */
  commitClassicLayerRestart(): void {
    if (
      this.pendingLayerRestartRollback === null
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
    this.restorePendingClassicLayerRestart();
    this.emitSessionSnapshot();
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
    this.session = rollback.session;
    this.worldSpeed = rollback.worldSpeed;
    this.initialClassicActivated = rollback.initialClassicActivated;
    this.classicLayerRemovedForResult = rollback.classicLayerRemovedForResult;
    bladeInput.deactivateForNonClassicScreen();
    this.pendingLayerRestartRollback = null;
  }

  private dispatch(commands: readonly ClassicSessionCommand[]): void {
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
      this.bladeInput?.deactivateForNonClassicScreen();
      this.physics.restorePreviousWorldProperties();
      this.classicLayerRemovedForResult = true;
    }
  }

  private emitSessionSnapshot(): void {
    this.node.emit(CLASSIC_SESSION_SNAPSHOT_EVENT, this.session.snapshot());
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
        this.scheduleOnce(this.onSpeedUpDelayComplete, command.delaySeconds);
      }
      this.node.emit(CLASSIC_WORLD_SPEED_COMMAND_EVENT, command);
    }
  }

  private readonly onSpeedUpDelayComplete = (): void => {
    this.applyWorldSpeedCommands(this.worldSpeed.speedUpDelayComplete());
  };
}
