import { _decorator, Component } from 'cc';

import type { BladeSegment } from '../domain/blade-tracks';
import {
  GnStyleSession,
  type GnStylePoint,
  type GnStyleSessionCommand,
  type GnStyleSessionSnapshot,
} from '../domain/gn-style-session';
import {
  GnStyleTossCoordinator,
  type GnStyleTossControllerSnapshot,
  type GnStyleTossCoordinatorOptions,
} from '../domain/gn-style-toss-coordinator';
import type {
  GnStyleTossControllerId,
} from '../domain/gn-style-toss-config';
import { BladeInputController } from './blade-input-controller';
import { ClassicPhysicsAdapter } from './classic-physics-adapter';

const { ccclass, requireComponent } = _decorator;

export const GN_STYLE_PHYSICS_STEPPED_EVENT
  = 'gn-style-physics-stepped';
export const GN_STYLE_SESSION_COMMAND_EVENT
  = 'gn-style-session-command';
export const GN_STYLE_SESSION_SNAPSHOT_EVENT
  = 'gn-style-session-snapshot';

export interface GnStylePhysicsSteppedEvent {
  readonly bladeSegments: readonly BladeSegment[];
  readonly deltaSeconds: number;
}

/**
 * Gameplay enlists its provisional Result owner while the recovered Time-Up Finish command
 * batch is being dispatched. Domain and foreground ownership commit together only after the
 * detached Result is attached successfully.
 */
export interface GnStyleTimeUpFinishParticipant {
  prepareCommit(): void;
  commit(): void;
  rollback(): void;
}

export class GnStyleTimeUpDispatchError extends Error {
  readonly cause: unknown;
  readonly errors: readonly unknown[];

  constructor(failures: readonly unknown[]) {
    super(
      `GN Style Time Up dispatch failed: ${
        failures.map(errorMessage).join('; ')
      }`,
    );
    this.name = 'GnStyleTimeUpDispatchError';
    this.cause = failures[0];
    this.errors = Object.freeze([...failures]);
  }
}

export class GnStyleTimeUpFinishRollbackError extends Error {
  readonly cause: unknown;
  readonly rollbackErrors: readonly unknown[];

  constructor(primary: unknown, rollbackErrors: readonly unknown[]) {
    super(
      `GN Style Time-Up Finish rollback failed: ${errorMessage(primary)}`
      + `; rollback: ${rollbackErrors.map(errorMessage).join('; ')}`,
    );
    this.name = 'GnStyleTimeUpFinishRollbackError';
    this.cause = primary;
    this.rollbackErrors = Object.freeze([...rollbackErrors]);
  }
}

/**
 * A lease transition failed and compensation could not restore the prior ownership boundary.
 * The retained run is poisoned and may be touched only by idempotent teardown afterward.
 */
export class GnStyleLifecycleRollbackError extends Error {
  readonly cause: unknown;
  readonly rollbackErrors: readonly unknown[];

  constructor(
    label: string,
    primary: unknown,
    rollbackErrors: readonly unknown[],
  ) {
    super(
      `${label}: ${errorMessage(primary)}`
      + (
        rollbackErrors.length === 0
          ? ''
          : `; rollback: ${rollbackErrors.map(errorMessage).join('; ')}`
      ),
    );
    this.name = 'GnStyleLifecycleRollbackError';
    this.cause = primary;
    this.rollbackErrors = Object.freeze([...rollbackErrors]);
  }
}

export class GnStyleTimeUpFinishCommitError extends Error {
  readonly cause: unknown;
  readonly observerErrors: readonly unknown[];

  constructor(primary: unknown, observerErrors: readonly unknown[]) {
    super(
      `GN Style Time-Up Finish commit failed: ${errorMessage(primary)}`
      + (
        observerErrors.length === 0
          ? ''
          : `; observers: ${observerErrors.map(errorMessage).join('; ')}`
      ),
    );
    this.name = 'GnStyleTimeUpFinishCommitError';
    this.cause = primary;
    this.observerErrors = Object.freeze([...observerErrors]);
  }
}

type TimeManagerTick = (deltaSeconds: number) => void;

/**
 * Passive serialized owner for one mode-2 session, its toss timers, ordinary blade input, and
 * variable Physics2D lease.
 *
 * TimeManager presentation stays with the gameplay presenter. Its scheduler enters through
 * `tickCoordinatorBeforeTimeManager`, preserving the recovered expiry-frame ordering while an
 * already armed Wave child remains live during TIME UP.
 */
@ccclass('GnStyleSceneController')
@requireComponent(BladeInputController)
export class GnStyleSceneController extends Component {
  private activeValue = false;
  private bladeInput: BladeInputController | null = null;
  private coordinator: GnStyleTossCoordinator | null = null;
  private destroyedValue = false;
  private fatalLifecycleValue = false;
  private inputLeaseActive = false;
  private loadedValue = false;
  private pendingTimeUpFinishParticipant:
    GnStyleTimeUpFinishParticipant | null = null;
  private readonly physics = new ClassicPhysicsAdapter();
  private physicsLeaseActive = false;
  private physicsRestorePending = false;
  private runOwnedValue = false;
  private session = new GnStyleSession();
  private suspendedValue = false;
  private timeUpFinishDispatchingValue = false;

  onLoad(): void {
    if (this.loadedValue) {
      return;
    }
    const bladeInput = this.getComponent(BladeInputController);
    if (bladeInput === null) {
      throw new Error('GnStyleSceneController requires BladeInputController');
    }
    // Passive standby must not deactivate an ordinary-input owner that is still current.
    this.bladeInput = bladeInput;
    this.loadedValue = true;
  }

  start(): void {
    // Intentionally passive. The app shell owns preparation and foreground placement.
  }

  update(deltaSeconds: number): void {
    assertFiniteNonNegative(deltaSeconds, 'deltaSeconds');
    if (!this.activeValue || this.destroyedValue) {
      return;
    }
    const lifecycle = this.session.snapshot().lifecycle;
    if (
      lifecycle === 'running'
      || lifecycle === 'time-up-presentation'
    ) {
      this.dispatch(this.session.updateScorePresentation());
    }
  }

  onDestroy(): void {
    if (
      this.destroyedValue
      && !this.inputLeaseActive
      && !this.physicsLeaseActive
      && !this.physicsRestorePending
    ) {
      return;
    }
    this.destroyedValue = true;
    this.activeValue = false;
    this.suspendedValue = false;
    this.loadedValue = false;
    this.pendingTimeUpFinishParticipant = null;
    this.timeUpFinishDispatchingValue = false;

    const failures: unknown[] = [];
    collectFailure(failures, () => this.releaseInputLease());
    collectFailure(failures, () => this.releasePhysicsLease());
    if (failures.length === 0) {
      this.coordinator = null;
      this.runOwnedValue = false;
      return;
    }
    this.enterFatalLifecycleBoundary();
    if (failures.length === 1) {
      throw new GnStyleLifecycleRollbackError(
        'GN Style destruction cleanup failed',
        failures[0],
        [],
      );
    }
    throw new GnStyleLifecycleRollbackError(
      'GN Style destruction cleanup failed',
      failures[0],
      failures.slice(1),
    );
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
      && !this.runOwnedValue
      && !this.inputLeaseActive
      && !this.physicsLeaseActive
      && !this.physicsRestorePending
      && this.bladeInput !== null
    );
  }

  get suspended(): boolean {
    return this.suspendedValue;
  }

  sessionSnapshot(): GnStyleSessionSnapshot {
    return this.session.snapshot();
  }

  tossControllerSnapshot(
    controllerId: GnStyleTossControllerId,
  ): GnStyleTossControllerSnapshot {
    return this.requireCoordinator().controllerSnapshot(controllerId);
  }

  /**
   * Creates a fresh one-run session/coordinator, then leases Physics2D followed by ordinary
   * input. Any failed observer or lease acquisition restores the previous released boundary.
   */
  activateGnStyleLayer(
    initialBestScore: number,
    coordinatorOptions: GnStyleTossCoordinatorOptions,
  ): void {
    assertSafeInteger(initialBestScore, 'initialBestScore');
    if (this.destroyedValue) {
      throw new Error('GN Style layer cannot activate after scene destruction');
    }
    if (!this.loadedValue || this.fatalLifecycleValue) {
      throw new Error(
        'GN Style layer cannot activate before load or after a fatal lifecycle failure',
      );
    }
    if (this.activeValue || this.runOwnedValue) {
      throw new Error('GN Style layer is already active or retained');
    }
    if (
      this.timeUpFinishDispatchingValue
      || this.pendingTimeUpFinishParticipant !== null
    ) {
      throw new Error(
        'GN Style layer cannot activate during a Result transaction',
      );
    }
    const lifecycle = this.session.snapshot().lifecycle;
    if (lifecycle !== 'constructed' && lifecycle !== 'result-removed') {
      throw new Error(
        'GN Style layer cannot activate from the current lifecycle',
      );
    }

    const previousCoordinator = this.coordinator;
    const previousSession = this.session;
    const freshSession = new GnStyleSession(initialBestScore);
    this.session = freshSession;
    try {
      this.coordinator = new GnStyleTossCoordinator(coordinatorOptions);
      this.runOwnedValue = true;
      this.acquirePhysicsLease();
      this.acquireInputLease();
      this.activeValue = true;
      this.dispatch(freshSession.enterScene());
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      this.activeValue = false;
      collectFailure(rollbackErrors, () => this.releaseInputLease());
      collectFailure(rollbackErrors, () => this.releasePhysicsLease());
      this.coordinator = previousCoordinator;
      this.session = previousSession;
      this.runOwnedValue = false;
      if (rollbackErrors.length > 0) {
        this.enterFatalLifecycleBoundary();
        throw new GnStyleLifecycleRollbackError(
          'GN Style activation rollback failed',
          error,
          rollbackErrors,
        );
      }
      if (error instanceof GnStyleLifecycleRollbackError) {
        this.enterFatalLifecycleBoundary();
      }
      throw error;
    }
  }

  suspendGnStyleLayerForNavigation(): void {
    if (this.destroyedValue || this.suspendedValue) {
      return;
    }
    if (this.fatalLifecycleValue) {
      throw new Error('GN Style fatal lifecycle can only be destroyed');
    }
    if (!this.runOwnedValue && !this.activeValue) {
      return;
    }
    this.assertActive();
    this.releaseRunLeasesWithRollback(
      'GN Style navigation suspension rollback failed',
    );
    this.activeValue = false;
    this.suspendedValue = true;
  }

  resumeSuspendedGnStyleLayer(): void {
    if (this.destroyedValue || this.activeValue) {
      return;
    }
    if (
      this.fatalLifecycleValue
      || !this.runOwnedValue
      || !this.suspendedValue
      || this.timeUpFinishDispatchingValue
    ) {
      throw new Error(
        'GN Style layer can resume only from one suspended run',
      );
    }

    try {
      this.acquirePhysicsLease();
      this.acquireInputLease();
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      collectFailure(rollbackErrors, () => this.releaseInputLease());
      collectFailure(rollbackErrors, () => this.releasePhysicsLease());
      if (
        rollbackErrors.length > 0
        || error instanceof GnStyleLifecycleRollbackError
      ) {
        this.enterFatalLifecycleBoundary();
        throw new GnStyleLifecycleRollbackError(
          'GN Style navigation resume rollback failed',
          error,
          rollbackErrors,
        );
      }
      throw error;
    }
    this.activeValue = true;
    this.suspendedValue = false;
  }

  finalizeSuspendedGnStyleLayerRelease(): void {
    if (this.destroyedValue || !this.runOwnedValue) {
      return;
    }
    if (this.activeValue || !this.suspendedValue) {
      throw new Error(
        'GN Style layer can finalize only from a suspended run',
      );
    }
    this.resetReleasedRun();
  }

  releaseGnStyleLayerForReplacement(): void {
    if (this.destroyedValue || !this.runOwnedValue) {
      return;
    }
    if (this.fatalLifecycleValue) {
      throw new Error('GN Style fatal lifecycle can only be destroyed');
    }
    if (this.activeValue) {
      this.releaseRunLeasesWithRollback(
        'GN Style replacement release rollback failed',
      );
    }
    this.resetReleasedRun();
    this.emitSessionSnapshot();
  }

  raycastAll(
    startWorld: Readonly<{ readonly x: number; readonly y: number }>,
    endWorld: Readonly<{ readonly x: number; readonly y: number }>,
  ) {
    if (!this.physicsLeaseActive) {
      throw new Error(
        'GN Style raycast requires the active Physics2D lease',
      );
    }
    return this.physics.raycastAll(startWorld, endWorld);
  }

  callAfterPhysicsStep(mutation: () => void): void {
    if (typeof mutation !== 'function') {
      throw new TypeError(
        'GN Style after-step mutation must be a function',
      );
    }
    if (!this.physicsLeaseActive) {
      mutation();
      return;
    }
    this.physics.callAfterStep(mutation);
  }

  totalTimeCallback(): void {
    this.assertActive();
    this.dispatch(this.session.totalTimeCallback());
  }

  goCallback(): void {
    this.assertActive();
    this.dispatch(this.session.goCallback());
  }

  startGameCallback(): void {
    this.assertActive();
    this.dispatch(this.session.startGameCallback());
  }

  /**
   * Running frames advance GN tosses before TimeManager. During TIME UP only the coordinator
   * advances, allowing a pre-armed Wave child to reach its scheduled pause.
   */
  tickCoordinatorBeforeTimeManager(
    deltaSeconds: number,
    tickTimeManager: TimeManagerTick,
  ): void {
    assertFiniteNonNegative(deltaSeconds, 'deltaSeconds');
    if (typeof tickTimeManager !== 'function') {
      throw new TypeError('tickTimeManager must be a function');
    }
    this.assertActive();

    const lifecycle = this.session.snapshot().lifecycle;
    if (
      lifecycle !== 'running'
      && lifecycle !== 'time-up-presentation'
    ) {
      throw new Error(
        'GN Style timed frame requires running or Time Up presentation',
      );
    }

    const coordinator = this.requireCoordinator();
    if (lifecycle === 'running') {
      coordinator.tickBeforeTimeManager(deltaSeconds, tickTimeManager);
      return;
    }
    coordinator.tick(deltaSeconds);
  }

  checkCombo(position: GnStylePoint): void {
    this.assertActive();
    this.dispatch(this.session.checkCombo(position));
  }

  addScore(value: number): void {
    this.assertActive();
    this.session.addScore(value);
    this.emitSessionSnapshot();
  }

  fruitCut(
    position: GnStylePoint,
    fruitId: number,
    suppliedScore: number,
  ): void {
    this.assertActive();
    this.dispatch(
      this.session.fruitCut(position, fruitId, suppliedScore),
    );
  }

  fruitFail(position: GnStylePoint): void {
    this.assertActive();
    this.dispatch(this.session.fruitFail(position));
  }

  bonusFruitFail(position: GnStylePoint): void {
    this.assertActive();
    this.dispatch(this.session.bonusFruitFail(position));
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

  /**
   * Timer-zero drains all three outer-stop commands and objective completion exactly once even
   * when observers throw. Ordinary input, physics, entities, score, combo, and Wave-child frame
   * advancement remain live.
   */
  timeUp(): void {
    this.assertActive();
    const failures: unknown[] = [];
    for (const command of this.session.timeUp()) {
      try {
        this.applyResolvedCommand(command);
        this.node.emit(GN_STYLE_SESSION_COMMAND_EVENT, command);
      } catch (error) {
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

  enlistTimeUpFinishParticipant(
    participant: GnStyleTimeUpFinishParticipant,
  ): void {
    assertTimeUpFinishParticipant(participant);
    if (
      !this.timeUpFinishDispatchingValue
      || this.session.snapshot().lifecycle !== 'result-transition'
    ) {
      throw new Error(
        'GN Style Time-Up Finish participant can enlist only during command dispatch',
      );
    }
    if (this.pendingTimeUpFinishParticipant !== null) {
      throw new Error(
        'GN Style Time-Up Finish accepts exactly one gameplay participant',
      );
    }
    this.pendingTimeUpFinishParticipant = participant;
  }

  timeUpFinish(): void {
    this.assertActive();
    if (
      this.timeUpFinishDispatchingValue
      || this.pendingTimeUpFinishParticipant !== null
    ) {
      throw new Error(
        'GN Style Time-Up Finish transaction is already active',
      );
    }

    const commands = this.session.timeUpFinish();
    this.timeUpFinishDispatchingValue = true;
    let participant: GnStyleTimeUpFinishParticipant | null = null;
    try {
      this.applyAndEmit(commands);
      participant = this.currentTimeUpFinishParticipant();
      if (participant === null) {
        throw new Error(
          'GN Style Time-Up Finish requires an enlisted gameplay participant',
        );
      }
      participant.prepareCommit();
      this.session.commitTimeUpFinish();
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      let restorationFailure: unknown = null;
      participant = this.currentTimeUpFinishParticipant();
      this.pendingTimeUpFinishParticipant = null;
      this.timeUpFinishDispatchingValue = false;
      collectFailure(
        rollbackErrors,
        () => this.session.rollbackTimeUpFinish(),
      );
      if (participant !== null) {
        const rollbackParticipant = participant;
        collectFailure(
          rollbackErrors,
          () => rollbackParticipant.rollback(),
        );
      }
      if (!this.fatalLifecycleValue) {
        try {
          this.restoreAfterFailedResultTransition();
        } catch (restoreError) {
          restorationFailure = restoreError;
          rollbackErrors.push(restoreError);
        }
      }
      collectFailure(rollbackErrors, () => this.emitSessionSnapshot());
      if (restorationFailure instanceof GnStyleLifecycleRollbackError) {
        throw new GnStyleLifecycleRollbackError(
          'GN Style Result rollback failed',
          error,
          rollbackErrors,
        );
      }
      if (rollbackErrors.length > 0) {
        throw new GnStyleTimeUpFinishRollbackError(
          error,
          rollbackErrors,
        );
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
      throw new GnStyleTimeUpFinishCommitError(
        commitError,
        observerErrors,
      );
    }
    if (observerErrors.length > 0) {
      // Result/domain ownership is already irreversible. An observer cannot reopen the run.
      console.error(observerErrors[0]);
    }
  }

  private dispatch(commands: readonly GnStyleSessionCommand[]): void {
    this.applyAndEmit(commands);
    this.emitSessionSnapshot();
  }

  private applyAndEmit(
    commands: readonly GnStyleSessionCommand[],
  ): void {
    for (const command of commands) {
      this.applyResolvedCommand(command);
      this.node.emit(GN_STYLE_SESSION_COMMAND_EVENT, command);
    }
  }

  private applyResolvedCommand(command: GnStyleSessionCommand): void {
    switch (command.type) {
      case 'start-controller':
        this.requireCoordinator().startController(command.controller);
        break;
      case 'stop-controller':
        this.requireCoordinator().stopController(command.controller);
        break;
      case 'remove-gn-style':
        this.releaseRunLeasesWithRollback(
          'GN Style Result removal rollback failed',
        );
        this.activeValue = false;
        this.suspendedValue = false;
        break;
      default:
        break;
    }
  }

  private acquireInputLease(): void {
    if (this.inputLeaseActive) {
      throw new Error('GN Style ordinary input lease is already active');
    }
    this.requireBladeInput().activateForClassicLayer();
    this.inputLeaseActive = true;
  }

  private releaseInputLease(): void {
    if (!this.inputLeaseActive) {
      return;
    }
    this.requireBladeInput().deactivateForNonClassicScreen();
    this.inputLeaseActive = false;
  }

  private acquirePhysicsLease(): void {
    if (this.physicsLeaseActive) {
      throw new Error('GN Style Physics2D lease is already active');
    }
    if (this.physicsRestorePending) {
      this.releasePhysicsLease();
    }

    this.physicsRestorePending = true;
    try {
      this.physics.configureResolvedWorldProperties();
      this.physics.startVariableSimulation(
        identityPhysicsDelta,
        (deltaSeconds) => this.afterPhysicsStep(deltaSeconds),
      );
      this.physicsLeaseActive = true;
      this.physics.setWorldStopped(false);
    } catch (error) {
      this.physicsLeaseActive = false;
      const rollbackErrors: unknown[] = [];
      collectFailure(rollbackErrors, () => this.releasePhysicsLease());
      if (rollbackErrors.length > 0) {
        throw new GnStyleLifecycleRollbackError(
          'GN Style Physics2D acquisition rollback failed',
          error,
          rollbackErrors,
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

  private releaseRunLeasesWithRollback(label: string): void {
    try {
      this.releaseInputLease();
      this.releasePhysicsLease();
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      try {
        if (!this.physicsLeaseActive) {
          this.acquirePhysicsLease();
        }
        if (!this.inputLeaseActive) {
          this.acquireInputLease();
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
      if (rollbackErrors.length > 0) {
        this.enterFatalLifecycleBoundary();
        collectFailure(rollbackErrors, () => this.releaseInputLease());
        collectFailure(rollbackErrors, () => this.releasePhysicsLease());
        throw new GnStyleLifecycleRollbackError(
          label,
          error,
          rollbackErrors,
        );
      }
      throw error;
    }
  }

  private afterPhysicsStep(deltaSeconds: number): void {
    const bladeSegments = Object.freeze([
      ...(this.inputLeaseActive
        ? this.requireBladeInput().segmentsForPostPhysicsUpdate()
        : []),
    ]);
    const payload: GnStylePhysicsSteppedEvent = Object.freeze({
      bladeSegments,
      deltaSeconds,
    });
    this.node.emit(GN_STYLE_PHYSICS_STEPPED_EVENT, payload);
  }

  private restoreAfterFailedResultTransition(): void {
    try {
      if (!this.physicsLeaseActive) {
        this.acquirePhysicsLease();
      }
      if (!this.inputLeaseActive) {
        this.acquireInputLease();
      }
      this.activeValue = true;
      this.suspendedValue = false;
    } catch (error) {
      const quiesceErrors: unknown[] = [];
      this.enterFatalLifecycleBoundary();
      collectFailure(quiesceErrors, () => this.releaseInputLease());
      collectFailure(quiesceErrors, () => this.releasePhysicsLease());
      throw new GnStyleLifecycleRollbackError(
        'GN Style Result restoration failed',
        error,
        quiesceErrors,
      );
    }
  }

  private resetReleasedRun(): void {
    this.activeValue = false;
    this.coordinator = null;
    this.runOwnedValue = false;
    this.session = new GnStyleSession();
    this.suspendedValue = false;
  }

  private enterFatalLifecycleBoundary(): void {
    this.activeValue = false;
    this.suspendedValue = false;
    this.fatalLifecycleValue = true;
  }

  private emitSessionSnapshot(): void {
    this.node.emit(
      GN_STYLE_SESSION_SNAPSHOT_EVENT,
      this.session.snapshot(),
    );
  }

  private assertActive(): void {
    if (
      !this.activeValue
      || this.destroyedValue
      || this.fatalLifecycleValue
    ) {
      throw new Error('GN Style layer must be active');
    }
  }

  private requireBladeInput(): BladeInputController {
    if (this.bladeInput === null) {
      throw new Error('GN Style input is unavailable before onLoad');
    }
    return this.bladeInput;
  }

  private requireCoordinator(): GnStyleTossCoordinator {
    if (this.coordinator === null) {
      throw new Error('GN Style toss coordinator is unavailable');
    }
    return this.coordinator;
  }

  private currentTimeUpFinishParticipant():
    GnStyleTimeUpFinishParticipant | null {
    return this.pendingTimeUpFinishParticipant;
  }
}

function identityPhysicsDelta(frameDeltaSeconds: number): number {
  assertFiniteNonNegative(frameDeltaSeconds, 'frameDeltaSeconds');
  return Math.fround(frameDeltaSeconds);
}

function assertTimeUpFinishParticipant(
  participant: GnStyleTimeUpFinishParticipant,
): void {
  if (
    participant === null
    || typeof participant !== 'object'
    || typeof participant.prepareCommit !== 'function'
    || typeof participant.commit !== 'function'
    || typeof participant.rollback !== 'function'
  ) {
    throw new TypeError(
      'GN Style Time-Up Finish participant must provide prepareCommit, commit, and rollback',
    );
  }
}

function throwTimeUpDispatchFailures(
  failures: readonly unknown[],
): void {
  if (failures.length === 0) {
    return;
  }
  if (failures.length === 1) {
    throw failures[0];
  }
  throw new GnStyleTimeUpDispatchError(failures);
}

function collectFailure(
  failures: unknown[],
  operation: () => void,
): void {
  try {
    operation();
  } catch (error) {
    failures.push(error);
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
