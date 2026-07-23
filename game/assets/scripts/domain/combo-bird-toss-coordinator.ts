import {
  CLASSIC_WAVE_INTERNAL_INTERVAL,
  ClassicConcurrentTossStrategy,
  ClassicFreeTossStrategy,
  ClassicWaveTossStrategy,
  type ClassicSpawnPlannerPort,
  type ClassicTossStrategyCommand,
  type TossStrategyTimerFactory,
  type TossStrategyTimerSnapshot,
} from './classic-toss-strategies';
import {
  COMBO_BIRD_TOSS_CREATION_ORDER,
  COMBO_BIRD_TOSS_OUTER_STOP_ORDER,
  COMBO_BIRD_TOSS_START_ORDER,
  COMBO_BIRD_WAVE_CHILD_INTERVAL,
  getComboBirdTossRow,
  type ComboBirdTossControllerId,
  type ComboBirdTossRow,
} from './combo-bird-toss-config';
import type { GameplayRandom } from './gameplay-random';
import type { LogicalViewport } from './spawn-kinematics';
import { TossTimer } from './toss-timer';

export type ComboBirdTossRuntimeCommand = ClassicTossStrategyCommand;

export interface ComboBirdTossCoordinatorOptions {
  readonly commandSink?: (
    commands: readonly ComboBirdTossRuntimeCommand[],
  ) => void;
  readonly createTimer?: TossStrategyTimerFactory;
  readonly effectsEnabled: () => boolean;
  readonly planner: ClassicSpawnPlannerPort;
  readonly random: GameplayRandom;
  readonly viewport: () => LogicalViewport;
}

export type ComboBirdTossControllerSnapshot =
  | Readonly<{
      readonly controller: 'free' | 'concurrent';
      readonly timer: TossStrategyTimerSnapshot;
    }>
  | Readonly<{
      readonly childTimer: TossStrategyTimerSnapshot;
      readonly controller: 'wave';
      readonly pendingPauseRequestIds: readonly number[];
      readonly timer: TossStrategyTimerSnapshot;
    }>;

export interface ComboBirdTossCoordinatorSnapshot {
  readonly pendingWavePauseCount: number;
}

export type ComboBirdTossControlEvent = Readonly<{
  readonly action: 'start' | 'stop';
  readonly controller: ComboBirdTossControllerId;
  readonly scope: 'outer';
}>;

type ComboBirdRuntimeStrategy =
  | ClassicFreeTossStrategy
  | ClassicConcurrentTossStrategy
  | ClassicWaveTossStrategy;

interface PendingWavePause {
  readonly pauseRequestId: number;
  remainingSeconds: number;
}

/**
 * Pure owner for Combo Bird's three ordinary-fruit controllers.
 *
 * Wave setup samples and pauses its child during construction. `stopAll()` stops only the
 * three outer timers: pending pause callbacks and the Wave child continue to advance.
 */
export class ComboBirdTossCoordinator {
  private readonly commandLogValue: ComboBirdTossRuntimeCommand[] = [];
  private readonly commandSinkValue:
    | ((commands: readonly ComboBirdTossRuntimeCommand[]) => void)
    | null;
  private readonly controlLogValue: ComboBirdTossControlEvent[] = [];
  private readonly controllers =
    new Map<ComboBirdTossControllerId, ComboBirdRuntimeStrategy>();
  private readonly effectsEnabled: () => boolean;
  private readonly pendingWavePauses: PendingWavePause[] = [];
  private readonly planner: ClassicSpawnPlannerPort;
  private readonly random: GameplayRandom;
  private readonly viewport: () => LogicalViewport;

  constructor(options: ComboBirdTossCoordinatorOptions) {
    assertOptions(options);
    assertSharedWaveChildInterval();
    this.commandSinkValue = options.commandSink ?? null;
    this.effectsEnabled = options.effectsEnabled;
    this.planner = options.planner;
    this.random = options.random;
    this.viewport = options.viewport;
    const createTimer = options.createTimer
      ?? ((timerOptions) => new TossTimer(timerOptions));

    for (const controllerId of COMBO_BIRD_TOSS_CREATION_ORDER) {
      const strategy = this.createStrategy(
        getComboBirdTossRow(controllerId),
        createTimer,
      );
      this.controllers.set(controllerId, strategy);
      if (strategy instanceof ClassicWaveTossStrategy) {
        strategy.setup();
      }
    }
  }

  get commandLog(): readonly ComboBirdTossRuntimeCommand[] {
    return Object.freeze([...this.commandLogValue]);
  }

  get controlLog(): readonly ComboBirdTossControlEvent[] {
    return Object.freeze([...this.controlLogValue]);
  }

  get snapshot(): ComboBirdTossCoordinatorSnapshot {
    return Object.freeze({
      pendingWavePauseCount: this.pendingWavePauses.length,
    });
  }

  controllerSnapshot(
    controllerId: ComboBirdTossControllerId,
  ): ComboBirdTossControllerSnapshot {
    const strategy = this.requireController(controllerId);
    if (strategy instanceof ClassicWaveTossStrategy) {
      return Object.freeze({
        childTimer: strategy.childTimerSnapshot(),
        controller: 'wave',
        pendingPauseRequestIds: strategy.pendingPauseRequestIds,
        timer: strategy.timerSnapshot(),
      });
    }
    return Object.freeze({
      controller: strategy instanceof ClassicConcurrentTossStrategy
        ? 'concurrent'
        : 'free',
      timer: strategy.timerSnapshot(),
    });
  }

  /** GO callback order: Free, Wave, Concurrent. Each Start samples immediately. */
  startAll(): void {
    for (const controllerId of COMBO_BIRD_TOSS_START_ORDER) {
      this.startController(controllerId);
    }
  }

  /**
   * Time Up callback order. This deliberately does not pause/stop Wave's internal Free child
   * and does not cancel its already armed pause request.
   */
  stopAll(): void {
    for (const controllerId of COMBO_BIRD_TOSS_OUTER_STOP_ORDER) {
      this.stopController(controllerId);
    }
  }

  startController(controllerId: ComboBirdTossControllerId): void {
    this.requireController(controllerId).start();
    this.recordControl('start', controllerId);
  }

  stopController(controllerId: ComboBirdTossControllerId): void {
    this.requireController(controllerId).stop();
    this.recordControl('stop', controllerId);
  }

  /**
   * Host scheduler order advances pending Wave actions, then Free, Wave (+ child), Concurrent.
   * Stopped outer timers remain inert while an active Wave child can still produce fruit.
   */
  tick(deltaSeconds: number): void {
    assertFiniteNonNegative(deltaSeconds, 'deltaSeconds');
    this.advanceWavePauseCallbacks(deltaSeconds);

    for (const controllerId of COMBO_BIRD_TOSS_CREATION_ORDER) {
      const strategy = this.requireController(controllerId);
      strategy.tick(deltaSeconds);
      if (strategy instanceof ClassicWaveTossStrategy) {
        strategy.tickChild(deltaSeconds);
      }
    }
  }

  private createStrategy(
    row: ComboBirdTossRow,
    createTimer: TossStrategyTimerFactory,
  ): ComboBirdRuntimeStrategy {
    const shared = {
      commandSink: (commands: readonly ComboBirdTossRuntimeCommand[]) => {
        this.acceptCommands(commands);
      },
      controllerId: row.id,
      createTimer,
      effectsEnabled: this.effectsEnabled,
      random: this.random,
    };

    switch (row.controller) {
      case 'free':
        return new ClassicFreeTossStrategy({
          ...shared,
          direction: row.direction,
          interval: row.outerInterval,
          planner: this.planner,
          tossType: row.objectType,
          viewport: this.viewport,
        });
      case 'wave':
        return new ClassicWaveTossStrategy({
          ...shared,
          activeWindow: row.activeWindow,
          direction: row.direction,
          interval: row.outerInterval,
          planner: this.planner,
          tossType: row.objectType,
          viewport: this.viewport,
        });
      case 'concurrent':
        return new ClassicConcurrentTossStrategy({
          ...shared,
          countMax: row.countMax,
          countMin: row.countMin,
          direction: row.direction,
          interval: row.outerInterval,
          planner: this.planner,
          tossType: row.objectType,
          viewport: this.viewport,
        });
      default:
        return assertNever(row);
    }
  }

  private acceptCommands(
    commands: readonly ComboBirdTossRuntimeCommand[],
  ): void {
    for (const command of commands) {
      if (command.type === 'schedule-wave-child-pause') {
        if (command.controllerId !== 'wave') {
          throw new Error(`unexpected Combo Bird Wave owner ${command.controllerId}`);
        }
        this.pendingWavePauses.push({
          pauseRequestId: command.pauseRequestId,
          remainingSeconds: command.delaySeconds,
        });
      }
    }

    const immutable = Object.freeze([...commands]);
    this.commandLogValue.push(...immutable);
    this.commandSinkValue?.(immutable);
  }

  private advanceWavePauseCallbacks(deltaSeconds: number): void {
    for (const pending of [...this.pendingWavePauses]) {
      pending.remainingSeconds = Math.fround(
        pending.remainingSeconds - deltaSeconds,
      );
      if (pending.remainingSeconds > 0) {
        continue;
      }

      const strategy = this.requireController('wave');
      if (!(strategy instanceof ClassicWaveTossStrategy)) {
        throw new Error('scheduled Combo Bird Wave callback lost its controller');
      }
      strategy.firePauseRequest(pending.pauseRequestId);
      this.pendingWavePauses.splice(this.pendingWavePauses.indexOf(pending), 1);
    }
  }

  private recordControl(
    action: ComboBirdTossControlEvent['action'],
    controller: ComboBirdTossControllerId,
  ): void {
    this.controlLogValue.push(Object.freeze({
      action,
      controller,
      scope: 'outer',
    }));
  }

  private requireController(
    controllerId: ComboBirdTossControllerId,
  ): ComboBirdRuntimeStrategy {
    const strategy = this.controllers.get(controllerId);
    if (strategy === undefined) {
      throw new Error(`Combo Bird controller ${controllerId} was not constructed`);
    }
    return strategy;
  }
}

function assertSharedWaveChildInterval(): void {
  if (
    COMBO_BIRD_WAVE_CHILD_INTERVAL.lowSeconds
      !== CLASSIC_WAVE_INTERNAL_INTERVAL.lowSeconds
    || COMBO_BIRD_WAVE_CHILD_INTERVAL.highSeconds
      !== CLASSIC_WAVE_INTERNAL_INTERVAL.highSeconds
  ) {
    throw new Error('Combo Bird Wave child interval must match the shared strategy');
  }
}

function assertOptions(options: ComboBirdTossCoordinatorOptions): void {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('options must be an object');
  }
  if (options.planner === null || typeof options.planner !== 'object') {
    throw new TypeError('planner must be an object');
  }
  if (options.planner.random !== options.random) {
    throw new Error('planner and coordinator must share the same GameplayRandom');
  }
  if (typeof options.effectsEnabled !== 'function') {
    throw new TypeError('effectsEnabled must be a function');
  }
  if (typeof options.viewport !== 'function') {
    throw new TypeError('viewport must be a function');
  }
  if (
    options.createTimer !== undefined
    && typeof options.createTimer !== 'function'
  ) {
    throw new TypeError('createTimer must be a function when provided');
  }
  if (
    options.commandSink !== undefined
    && typeof options.commandSink !== 'function'
  ) {
    throw new TypeError('commandSink must be a function when provided');
  }
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function assertNever(value: never): never {
  throw new Error(`unsupported Combo Bird controller row ${JSON.stringify(value)}`);
}
