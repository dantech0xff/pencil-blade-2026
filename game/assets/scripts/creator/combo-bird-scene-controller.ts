import { _decorator, Component } from 'cc';

import {
  ComboBirdSession,
  type ComboBirdPoint,
  type ComboBirdSessionCommand,
  type ComboBirdSessionSnapshot,
} from '../domain/combo-bird-session';
import {
  ComboBirdTossCoordinator,
  type ComboBirdTossControllerSnapshot,
  type ComboBirdTossCoordinatorOptions,
} from '../domain/combo-bird-toss-coordinator';
import type {
  ComboBirdTossControllerId,
} from '../domain/combo-bird-toss-config';
import { BirdInputController } from './bird-input-controller';
import { ClassicPhysicsAdapter } from './classic-physics-adapter';

const { ccclass, requireComponent } = _decorator;

export const COMBO_BIRD_PHYSICS_STEPPED_EVENT
  = 'combo-bird-physics-stepped';
export const COMBO_BIRD_SESSION_COMMAND_EVENT
  = 'combo-bird-session-command';
export const COMBO_BIRD_SESSION_SNAPSHOT_EVENT
  = 'combo-bird-session-snapshot';

export interface ComboBirdPhysicsSteppedEvent {
  readonly deltaSeconds: number;
}

/**
 * Gameplay enlists its provisional Result owner while the recovered Time-Up Finish command
 * batch is being dispatched. Domain and foreground ownership commit together only after the
 * detached Result is attached successfully.
 */
export interface ComboBirdTimeUpFinishParticipant {
  prepareCommit(): void;
  commit(): void;
  rollback(): void;
}

export class ComboBirdTimeUpDispatchError extends Error {
  readonly cause: unknown;
  readonly errors: readonly unknown[];

  constructor(failures: readonly unknown[]) {
    super(
      `Combo Bird Time Up dispatch failed: ${
        failures.map(errorMessage).join('; ')
      }`,
    );
    this.name = 'ComboBirdTimeUpDispatchError';
    this.cause = failures[0];
    this.errors = Object.freeze([...failures]);
  }
}

export class ComboBirdTimeUpFinishRollbackError extends Error {
  readonly cause: unknown;
  readonly rollbackErrors: readonly unknown[];

  constructor(primary: unknown, rollbackErrors: readonly unknown[]) {
    super(
      `Combo Bird Time-Up Finish rollback failed: ${errorMessage(primary)}`
      + `; rollback: ${rollbackErrors.map(errorMessage).join('; ')}`,
    );
    this.name = 'ComboBirdTimeUpFinishRollbackError';
    this.cause = primary;
    this.rollbackErrors = Object.freeze([...rollbackErrors]);
  }
}

/**
 * A lease transition failed and compensation could not restore the prior ownership boundary.
 * The retained run is fatal and may be touched only by teardown cleanup afterward.
 */
export class ComboBirdLifecycleRollbackError extends Error {
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
    this.name = 'ComboBirdLifecycleRollbackError';
    this.cause = primary;
    this.rollbackErrors = Object.freeze([...rollbackErrors]);
  }
}

export class ComboBirdTimeUpFinishCommitError extends Error {
  readonly cause: unknown;
  readonly observerErrors: readonly unknown[];

  constructor(primary: unknown, observerErrors: readonly unknown[]) {
    super(
      `Combo Bird Time-Up Finish commit failed: ${errorMessage(primary)}`
      + (
        observerErrors.length === 0
          ? ''
          : `; observers: ${observerErrors.map(errorMessage).join('; ')}`
      ),
    );
    this.name = 'ComboBirdTimeUpFinishCommitError';
    this.cause = primary;
    this.observerErrors = Object.freeze([...observerErrors]);
  }
}

type TimeManagerTick = (deltaSeconds: number) => void;

/**
 * Passive serialized owner for one mode-5 session, its three toss timers, Bird input lease,
 * and variable Physics2D lease.
 *
 * TimeManager presentation stays with the gameplay presenter. Its scheduler enters through
 * `tickCoordinatorBeforeTimeManager`, which fixes the recovered expiry-frame order while still
 * advancing a previously armed Wave child throughout TIME UP.
 */
@ccclass('ComboBirdSceneController')
@requireComponent(BirdInputController)
export class ComboBirdSceneController extends Component {
  private activeValue = false;
  private birdInput: BirdInputController | null = null;
  private coordinator: ComboBirdTossCoordinator | null = null;
  private destroyedValue = false;
  private fatalLifecycleValue = false;
  private loadedValue = false;
  private pendingTimeUpFinishParticipant:
    ComboBirdTimeUpFinishParticipant | null = null;
  private readonly physics = new ClassicPhysicsAdapter();
  private physicsLeaseActive = false;
  private physicsRestorePending = false;
  private session = new ComboBirdSession();
  private suspendedValue = false;
  private timeUpFinishDispatchingValue = false;

  onLoad(): void {
    const birdInput = this.getComponent(BirdInputController);
    if (birdInput === null) {
      throw new Error('ComboBirdSceneController requires BirdInputController');
    }
    this.birdInput = birdInput;
    birdInput.deactivateForNonBirdScreen(this);
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
    this.destroyedValue = true;
    this.activeValue = false;
    this.suspendedValue = false;
    this.loadedValue = false;
    this.pendingTimeUpFinishParticipant = null;
    this.timeUpFinishDispatchingValue = false;

    const failures: unknown[] = [];
    collectFailure(
      failures,
      () => this.birdInput?.deactivateForNonBirdScreen(this),
    );
    collectFailure(failures, () => this.releasePhysicsLease());
    if (failures.length === 0) {
      this.coordinator = null;
      return;
    }
    if (failures.length === 1) {
      throw failures[0];
    }
    throw new ComboBirdLifecycleRollbackError(
      'Combo Bird destruction cleanup failed',
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
      && this.birdInput !== null
    );
  }

  get suspended(): boolean {
    return this.suspendedValue;
  }

  sessionSnapshot(): ComboBirdSessionSnapshot {
    return this.session.snapshot();
  }

  tossControllerSnapshot(
    controllerId: ComboBirdTossControllerId,
  ): ComboBirdTossControllerSnapshot {
    return this.requireCoordinator().controllerSnapshot(controllerId);
  }

  /**
   * Creates fresh one-run session and toss owners, then leases the shared Bird input and
   * Classic-compatible Physics2D substrate. Any failed observer or lease acquisition restores
   * the exact previously retired boundary.
   */
  activateComboBirdLayer(
    initialBestScore: number,
    coordinatorOptions: ComboBirdTossCoordinatorOptions,
  ): void {
    assertSafeInteger(initialBestScore, 'initialBestScore');
    if (this.destroyedValue) {
      throw new Error('Combo Bird layer cannot activate after scene destruction');
    }
    if (!this.loadedValue || this.fatalLifecycleValue) {
      throw new Error(
        'Combo Bird layer cannot activate before load or after a fatal lifecycle failure',
      );
    }
    if (this.activeValue) {
      throw new Error('Combo Bird layer is already active');
    }
    if (this.suspendedValue) {
      throw new Error(
        'Combo Bird layer cannot activate while a suspended run is retained',
      );
    }
    if (
      this.timeUpFinishDispatchingValue
      || this.pendingTimeUpFinishParticipant !== null
    ) {
      throw new Error(
        'Combo Bird layer cannot activate during a Result transaction',
      );
    }
    const lifecycle = this.session.snapshot().lifecycle;
    if (lifecycle !== 'constructed' && lifecycle !== 'result-removed') {
      throw new Error(
        'Combo Bird layer cannot activate from the current lifecycle',
      );
    }

    const previousCoordinator = this.coordinator;
    const previousSession = this.session;
    const freshSession = new ComboBirdSession(initialBestScore);
    this.session = freshSession;
    try {
      this.coordinator = new ComboBirdTossCoordinator(coordinatorOptions);
      this.acquirePhysicsLease();
      this.requireBirdInput().activateForBirdLayer(this);
      this.activeValue = true;
      this.dispatch(freshSession.enterScene());
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      this.activeValue = false;
      collectFailure(
        rollbackErrors,
        () => this.requireBirdInput().deactivateForNonBirdScreen(this),
      );
      collectFailure(rollbackErrors, () => this.releasePhysicsLease());
      this.coordinator = previousCoordinator;
      this.session = previousSession;
      if (rollbackErrors.length > 0) {
        this.enterFatalLifecycleBoundary();
        throw new ComboBirdLifecycleRollbackError(
          'Combo Bird activation rollback failed',
          error,
          rollbackErrors,
        );
      }
      if (error instanceof ComboBirdLifecycleRollbackError) {
        this.enterFatalLifecycleBoundary();
      }
      throw error;
    }
  }

  suspendComboBirdLayerForNavigation(): void {
    this.assertActive();
    this.releaseRunLeasesWithRollback(
      'Combo Bird navigation suspension rollback failed',
    );
    this.activeValue = false;
    this.suspendedValue = true;
  }

  resumeSuspendedComboBirdLayer(): void {
    if (this.destroyedValue) {
      throw new Error('Combo Bird layer cannot resume after scene destruction');
    }
    if (
      this.fatalLifecycleValue
      || this.activeValue
      || !this.suspendedValue
      || this.timeUpFinishDispatchingValue
    ) {
      throw new Error(
        'Combo Bird layer can resume only from one suspended run',
      );
    }

    try {
      this.acquirePhysicsLease();
      this.requireBirdInput().activateForBirdLayer(this);
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      collectFailure(
        rollbackErrors,
        () => this.requireBirdInput().deactivateForNonBirdScreen(this),
      );
      collectFailure(rollbackErrors, () => this.releasePhysicsLease());
      if (
        rollbackErrors.length > 0
        || error instanceof ComboBirdLifecycleRollbackError
      ) {
        this.enterFatalLifecycleBoundary();
        throw new ComboBirdLifecycleRollbackError(
          'Combo Bird navigation resume rollback failed',
          error,
          rollbackErrors,
        );
      }
      throw error;
    }
    this.activeValue = true;
    this.suspendedValue = false;
  }

  finalizeSuspendedComboBirdLayerRelease(): void {
    if (this.activeValue || !this.suspendedValue) {
      throw new Error(
        'Combo Bird layer can finalize only from a suspended run',
      );
    }
    this.resetReleasedRun();
  }

  releaseComboBirdLayerForReplacement(): void {
    this.assertActive();
    this.releaseRunLeasesWithRollback(
      'Combo Bird replacement release rollback failed',
    );
    this.activeValue = false;
    this.resetReleasedRun();
    this.emitSessionSnapshot();
  }

  raycastAll(
    startWorld: Readonly<{ readonly x: number; readonly y: number }>,
    endWorld: Readonly<{ readonly x: number; readonly y: number }>,
  ) {
    if (!this.physicsLeaseActive) {
      throw new Error(
        'Combo Bird raycast requires the active Physics2D lease',
      );
    }
    return this.physics.raycastAll(startWorld, endWorld);
  }

  callAfterPhysicsStep(mutation: () => void): void {
    if (typeof mutation !== 'function') {
      throw new TypeError(
        'Combo Bird after-step mutation must be a function',
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
   * Running frames advance Free, Wave (+ child), and Concurrent before TimeManager. During
   * TIME UP only the coordinator advances, allowing a pre-armed Wave child to reach its already
   * scheduled pause while the stopped outer timers remain inert.
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
        'Combo Bird timed frame requires running or Time Up presentation',
      );
    }

    this.requireCoordinator().tick(deltaSeconds);
    if (lifecycle === 'running') {
      tickTimeManager(deltaSeconds);
    }
  }

  checkCombo(position: ComboBirdPoint): void {
    this.assertActive();
    this.dispatch(this.session.checkCombo(position));
  }

  addScore(value: number): void {
    this.assertActive();
    this.session.addScore(value);
    this.emitSessionSnapshot();
  }

  fruitCut(
    position: ComboBirdPoint,
    fruitId: number,
    suppliedScore: number,
  ): void {
    this.assertActive();
    this.dispatch(
      this.session.fruitCut(position, fruitId, suppliedScore),
    );
  }

  fruitFail(position: ComboBirdPoint): void {
    this.assertActive();
    this.dispatch(this.session.fruitFail(position));
  }

  bonusFruitFail(position: ComboBirdPoint): void {
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
   * when command observers throw. Input, physics, entities, score, combo, and Wave-child frame
   * advancement remain live.
   */
  timeUp(): void {
    this.assertActive();
    const failures: unknown[] = [];
    for (const command of this.session.timeUp()) {
      try {
        this.applyResolvedCommand(command);
        this.node.emit(COMBO_BIRD_SESSION_COMMAND_EVENT, command);
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
    participant: ComboBirdTimeUpFinishParticipant,
  ): void {
    assertTimeUpFinishParticipant(participant);
    if (
      !this.timeUpFinishDispatchingValue
      || this.session.snapshot().lifecycle !== 'result-transition'
    ) {
      throw new Error(
        'Combo Bird Time-Up Finish participant can enlist only during command dispatch',
      );
    }
    if (this.pendingTimeUpFinishParticipant !== null) {
      throw new Error(
        'Combo Bird Time-Up Finish accepts exactly one gameplay participant',
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
        'Combo Bird Time-Up Finish transaction is already active',
      );
    }

    const commands = this.session.timeUpFinish();
    this.timeUpFinishDispatchingValue = true;
    let participant: ComboBirdTimeUpFinishParticipant | null = null;
    try {
      this.applyAndEmit(commands);
      participant = this.currentTimeUpFinishParticipant();
      if (participant === null) {
        throw new Error(
          'Combo Bird Time-Up Finish requires an enlisted gameplay participant',
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
      if (
        restorationFailure instanceof ComboBirdLifecycleRollbackError
      ) {
        throw new ComboBirdLifecycleRollbackError(
          'Combo Bird Result rollback failed',
          error,
          rollbackErrors,
        );
      }
      if (rollbackErrors.length > 0) {
        throw new ComboBirdTimeUpFinishRollbackError(
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
      throw new ComboBirdTimeUpFinishCommitError(
        commitError,
        observerErrors,
      );
    }
    if (observerErrors.length > 0) {
      // Result/domain ownership is already irreversible. An observer cannot reopen the run.
      console.error(observerErrors[0]);
    }
  }

  private dispatch(commands: readonly ComboBirdSessionCommand[]): void {
    this.applyAndEmit(commands);
    this.emitSessionSnapshot();
  }

  private applyAndEmit(
    commands: readonly ComboBirdSessionCommand[],
  ): void {
    for (const command of commands) {
      this.applyResolvedCommand(command);
      this.node.emit(COMBO_BIRD_SESSION_COMMAND_EVENT, command);
    }
  }

  private applyResolvedCommand(command: ComboBirdSessionCommand): void {
    switch (command.type) {
      case 'start-controller':
        this.requireCoordinator().startController(command.controller);
        break;
      case 'stop-controller':
        this.requireCoordinator().stopController(command.controller);
        break;
      case 'remove-combo-bird':
        this.releaseRunLeasesWithRollback(
          'Combo Bird Result removal rollback failed',
        );
        this.activeValue = false;
        this.suspendedValue = false;
        break;
      default:
        break;
    }
  }

  private acquirePhysicsLease(): void {
    if (this.physicsLeaseActive) {
      throw new Error('Combo Bird Physics2D lease is already active');
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
        throw new ComboBirdLifecycleRollbackError(
          'Combo Bird Physics2D acquisition rollback failed',
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
      this.requireBirdInput().deactivateForNonBirdScreen(this);
      this.releasePhysicsLease();
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      try {
        if (!this.physicsLeaseActive) {
          this.acquirePhysicsLease();
        }
        this.requireBirdInput().activateForBirdLayer(this);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
      if (rollbackErrors.length > 0) {
        this.enterFatalLifecycleBoundary();
        collectFailure(
          rollbackErrors,
          () => this.requireBirdInput().deactivateForNonBirdScreen(this),
        );
        collectFailure(rollbackErrors, () => this.releasePhysicsLease());
        throw new ComboBirdLifecycleRollbackError(
          label,
          error,
          rollbackErrors,
        );
      }
      throw error;
    }
  }

  private afterPhysicsStep(deltaSeconds: number): void {
    const payload: ComboBirdPhysicsSteppedEvent = Object.freeze({
      deltaSeconds,
    });
    this.node.emit(COMBO_BIRD_PHYSICS_STEPPED_EVENT, payload);
  }

  private restoreAfterFailedResultTransition(): void {
    try {
      if (!this.physicsLeaseActive) {
        this.acquirePhysicsLease();
      }
      this.requireBirdInput().activateForBirdLayer(this);
      this.activeValue = true;
      this.suspendedValue = false;
    } catch (error) {
      const quiesceErrors: unknown[] = [];
      this.enterFatalLifecycleBoundary();
      collectFailure(
        quiesceErrors,
        () => this.requireBirdInput().deactivateForNonBirdScreen(this),
      );
      collectFailure(quiesceErrors, () => this.releasePhysicsLease());
      throw new ComboBirdLifecycleRollbackError(
        'Combo Bird Result restoration failed',
        error,
        quiesceErrors,
      );
    }
  }

  private resetReleasedRun(): void {
    this.coordinator = null;
    this.session = new ComboBirdSession();
    this.suspendedValue = false;
  }

  private enterFatalLifecycleBoundary(): void {
    this.activeValue = false;
    this.suspendedValue = false;
    this.fatalLifecycleValue = true;
  }

  private emitSessionSnapshot(): void {
    this.node.emit(
      COMBO_BIRD_SESSION_SNAPSHOT_EVENT,
      this.session.snapshot(),
    );
  }

  private assertActive(): void {
    if (
      !this.activeValue
      || this.destroyedValue
      || this.fatalLifecycleValue
    ) {
      throw new Error('Combo Bird layer must be active');
    }
  }

  private requireBirdInput(): BirdInputController {
    if (this.birdInput === null) {
      throw new Error('Combo Bird input is unavailable before onLoad');
    }
    return this.birdInput;
  }

  private requireCoordinator(): ComboBirdTossCoordinator {
    if (this.coordinator === null) {
      throw new Error('Combo Bird toss coordinator is unavailable');
    }
    return this.coordinator;
  }

  private currentTimeUpFinishParticipant():
    ComboBirdTimeUpFinishParticipant | null {
    return this.pendingTimeUpFinishParticipant;
  }
}

function identityPhysicsDelta(frameDeltaSeconds: number): number {
  assertFiniteNonNegative(frameDeltaSeconds, 'frameDeltaSeconds');
  return Math.fround(frameDeltaSeconds);
}

function assertTimeUpFinishParticipant(
  participant: ComboBirdTimeUpFinishParticipant,
): void {
  if (
    participant === null
    || typeof participant !== 'object'
    || typeof participant.prepareCommit !== 'function'
    || typeof participant.commit !== 'function'
    || typeof participant.rollback !== 'function'
  ) {
    throw new TypeError(
      'Combo Bird Time-Up Finish participant must provide prepareCommit, commit, and rollback',
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
  throw new ComboBirdTimeUpDispatchError(failures);
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
