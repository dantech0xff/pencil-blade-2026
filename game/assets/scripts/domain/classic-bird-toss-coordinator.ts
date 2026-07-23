import {
  ClassicConcurrentTossStrategy,
  ClassicFreeTossStrategy,
  ClassicWaveTossStrategy,
  type ClassicSpawnPlannerPort,
  type ClassicTossStrategyCommand,
  type TossStrategyTimerFactory,
  type TossStrategyTimerSnapshot,
} from './classic-toss-strategies';
import {
  CLASSIC_BIRD_MAGNET_BOMB_CONTROLLER_ORDER,
  CLASSIC_BIRD_MAGNET_NORMAL_FRUIT_INTERVAL,
  CLASSIC_BIRD_NORMAL_FRUIT_INTERVAL,
  CLASSIC_BIRD_TOSS_CREATION_ORDER,
  CLASSIC_BIRD_TOSS_START_ORDER,
  CLASSIC_BIRD_TOSS_STOP_ORDER,
  getClassicBirdTossRow,
  type ClassicBirdTossControllerId,
  type ClassicBirdTossInterval,
  type ClassicBirdTossRow,
} from './classic-bird-toss-config';
import type { GameplayRandom } from './gameplay-random';
import type { LogicalViewport } from './spawn-kinematics';
import { TossTimer } from './toss-timer';

export type ClassicBirdTossRuntimeCommand = ClassicTossStrategyCommand;

export interface ClassicBirdTossCoordinatorOptions {
  readonly commandSink?: (
    commands: readonly ClassicBirdTossRuntimeCommand[],
  ) => void;
  readonly createTimer?: TossStrategyTimerFactory;
  readonly effectsEnabled: () => boolean;
  readonly planner: ClassicSpawnPlannerPort;
  readonly random: GameplayRandom;
  readonly viewport: () => LogicalViewport;
}

export type ClassicBirdTossControllerSnapshot =
  | Readonly<{
      readonly controller: 'free' | 'concurrent';
      readonly timer: TossStrategyTimerSnapshot;
    }>
  | Readonly<{
      readonly controller: 'wave';
      readonly childTimer: TossStrategyTimerSnapshot;
      readonly pendingPauseRequestIds: readonly number[];
      readonly timer: TossStrategyTimerSnapshot;
    }>;

export interface ClassicBirdTossCoordinatorSnapshot {
  readonly normalFruitInterval: ClassicBirdTossInterval;
  readonly pendingWavePauseCount: number;
}

export type ClassicBirdTossControlEvent = Readonly<{
  readonly action: 'start' | 'stop' | 'pause' | 'resume';
  readonly controller: ClassicBirdTossControllerId;
}>;

type ClassicBirdRuntimeStrategy =
  | ClassicFreeTossStrategy
  | ClassicConcurrentTossStrategy
  | ClassicWaveTossStrategy;

interface PendingWavePause {
  readonly controllerId: ClassicBirdTossControllerId;
  readonly pauseRequestId: number;
  remainingSeconds: number;
}

/**
 * Pure owner for Classic Bird's exact nine-controller graph.
 *
 * The constructor builds rows in native slot order. Wave setup immediately samples and pauses
 * each internal Free child, so normal Wave advances the shared RNG before bomb Wave.
 */
export class ClassicBirdTossCoordinator {
  private readonly commandLogValue: ClassicBirdTossRuntimeCommand[] = [];
  private readonly commandSinkValue:
    | ((commands: readonly ClassicBirdTossRuntimeCommand[]) => void)
    | null;
  private readonly controlLogValue: ClassicBirdTossControlEvent[] = [];
  private readonly controllers =
    new Map<ClassicBirdTossControllerId, ClassicBirdRuntimeStrategy>();
  private readonly effectsEnabled: () => boolean;
  private readonly pendingWavePauses: PendingWavePause[] = [];
  private readonly planner: ClassicSpawnPlannerPort;
  private readonly random: GameplayRandom;
  private readonly viewport: () => LogicalViewport;
  private normalFruitIntervalValue = CLASSIC_BIRD_NORMAL_FRUIT_INTERVAL;

  constructor(options: ClassicBirdTossCoordinatorOptions) {
    assertOptions(options);
    this.commandSinkValue = options.commandSink ?? null;
    this.effectsEnabled = options.effectsEnabled;
    this.planner = options.planner;
    this.random = options.random;
    this.viewport = options.viewport;
    const createTimer = options.createTimer
      ?? ((timerOptions) => new TossTimer(timerOptions));

    for (const controllerId of CLASSIC_BIRD_TOSS_CREATION_ORDER) {
      const row = getClassicBirdTossRow(controllerId);
      const strategy = this.createStrategy(row, createTimer);
      this.controllers.set(controllerId, strategy);
      if (strategy instanceof ClassicWaveTossStrategy) {
        strategy.setup();
      }
    }
  }

  get commandLog(): readonly ClassicBirdTossRuntimeCommand[] {
    return Object.freeze([...this.commandLogValue]);
  }

  get controlLog(): readonly ClassicBirdTossControlEvent[] {
    return Object.freeze([...this.controlLogValue]);
  }

  get snapshot(): ClassicBirdTossCoordinatorSnapshot {
    return Object.freeze({
      normalFruitInterval: this.normalFruitIntervalValue,
      pendingWavePauseCount: this.pendingWavePauses.length,
    });
  }

  controllerSnapshot(
    controllerId: ClassicBirdTossControllerId,
  ): ClassicBirdTossControllerSnapshot {
    const strategy = this.requireController(controllerId);
    if (strategy instanceof ClassicWaveTossStrategy) {
      return Object.freeze({
        controller: 'wave',
        childTimer: strategy.childTimerSnapshot(),
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

  /** Starts all nine timers in the recovered RNG-visible callback order. */
  startAll(): void {
    for (const controllerId of CLASSIC_BIRD_TOSS_START_ORDER) {
      this.startController(controllerId);
    }
  }

  /** Bomb and miss paths share this exact stop sequence. */
  stopAll(): void {
    for (const controllerId of CLASSIC_BIRD_TOSS_STOP_ORDER) {
      this.stopController(controllerId);
    }
  }

  startController(controllerId: ClassicBirdTossControllerId): void {
    this.requireController(controllerId).start();
    this.recordControl('start', controllerId);
  }

  stopController(controllerId: ClassicBirdTossControllerId): void {
    this.requireController(controllerId).stop();
    this.recordControl('stop', controllerId);
  }

  pauseController(controllerId: ClassicBirdTossControllerId): void {
    this.requireController(controllerId).pause();
    this.recordControl('pause', controllerId);
  }

  resumeController(controllerId: ClassicBirdTossControllerId): void {
    this.requireController(controllerId).resume();
    this.recordControl('resume', controllerId);
  }

  /**
   * Bounds mutate without touching the currently armed threshold. Only the bomb Free,
   * Concurrent, and Wave outer controllers pause.
   */
  magnetBegin(): void {
    const normal = this.requireNormalFreeController();
    normal.setLimits(
      CLASSIC_BIRD_MAGNET_NORMAL_FRUIT_INTERVAL.lowSeconds,
      CLASSIC_BIRD_MAGNET_NORMAL_FRUIT_INTERVAL.highSeconds,
    );
    this.normalFruitIntervalValue = CLASSIC_BIRD_MAGNET_NORMAL_FRUIT_INTERVAL;
    for (const controllerId of CLASSIC_BIRD_MAGNET_BOMB_CONTROLLER_ORDER) {
      this.pauseController(controllerId);
    }
  }

  /** Resume does not sample; all paused elapsed/threshold state remains intact. */
  magnetEnd(): void {
    const normal = this.requireNormalFreeController();
    normal.setLimits(
      CLASSIC_BIRD_NORMAL_FRUIT_INTERVAL.lowSeconds,
      CLASSIC_BIRD_NORMAL_FRUIT_INTERVAL.highSeconds,
    );
    this.normalFruitIntervalValue = CLASSIC_BIRD_NORMAL_FRUIT_INTERVAL;
    for (const controllerId of CLASSIC_BIRD_MAGNET_BOMB_CONTROLLER_ORDER) {
      this.resumeController(controllerId);
    }
  }

  /**
   * Target-only teardown divergence: restore future normal bounds without using `magnetEnd`,
   * because that native callback would resume the three bomb controllers after shutdown.
   */
  restoreNormalFruitIntervalForCleanup(): void {
    const normal = this.requireNormalFreeController();
    normal.setLimits(
      CLASSIC_BIRD_NORMAL_FRUIT_INTERVAL.lowSeconds,
      CLASSIC_BIRD_NORMAL_FRUIT_INTERVAL.highSeconds,
    );
    this.normalFruitIntervalValue = CLASSIC_BIRD_NORMAL_FRUIT_INTERVAL;
  }

  /** Scheduler delta advances toss/action state without applying world-speed scaling. */
  tick(deltaSeconds: number): void {
    assertFiniteNonNegative(deltaSeconds, 'deltaSeconds');
    this.advanceWavePauseCallbacks(deltaSeconds);

    for (const controllerId of CLASSIC_BIRD_TOSS_CREATION_ORDER) {
      const strategy = this.requireController(controllerId);
      strategy.tick(deltaSeconds);
      if (strategy instanceof ClassicWaveTossStrategy) {
        strategy.tickChild(deltaSeconds);
      }
    }
  }

  private createStrategy(
    row: ClassicBirdTossRow,
    createTimer: TossStrategyTimerFactory,
  ): ClassicBirdRuntimeStrategy {
    const shared = {
      commandSink: (commands: readonly ClassicBirdTossRuntimeCommand[]) => {
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
      default:
        return assertNever(row);
    }
  }

  private acceptCommands(
    commands: readonly ClassicBirdTossRuntimeCommand[],
  ): void {
    for (const command of commands) {
      if (command.type === 'schedule-wave-child-pause') {
        this.pendingWavePauses.push({
          controllerId: requireControllerId(command.controllerId),
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

      const strategy = this.requireController(pending.controllerId);
      if (!(strategy instanceof ClassicWaveTossStrategy)) {
        throw new Error('scheduled Classic Bird Wave callback lost its controller');
      }
      strategy.firePauseRequest(pending.pauseRequestId);
      this.pendingWavePauses.splice(this.pendingWavePauses.indexOf(pending), 1);
    }
  }

  private recordControl(
    action: ClassicBirdTossControlEvent['action'],
    controller: ClassicBirdTossControllerId,
  ): void {
    this.controlLogValue.push(Object.freeze({ action, controller }));
  }

  private requireController(
    controllerId: ClassicBirdTossControllerId,
  ): ClassicBirdRuntimeStrategy {
    const strategy = this.controllers.get(controllerId);
    if (strategy === undefined) {
      throw new Error(`Classic Bird controller ${controllerId} was not constructed`);
    }
    return strategy;
  }

  private requireNormalFreeController(): ClassicFreeTossStrategy {
    const strategy = this.requireController('aa');
    if (!(strategy instanceof ClassicFreeTossStrategy)) {
      throw new Error('Classic Bird normal controller is not FreeToss');
    }
    return strategy;
  }
}

function requireControllerId(value: string): ClassicBirdTossControllerId {
  if (!CLASSIC_BIRD_TOSS_CREATION_ORDER.some((controllerId) => controllerId === value)) {
    throw new RangeError(`unknown Classic Bird controller ${value}`);
  }
  return value as ClassicBirdTossControllerId;
}

function assertOptions(options: ClassicBirdTossCoordinatorOptions): void {
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
  if (options.createTimer !== undefined && typeof options.createTimer !== 'function') {
    throw new TypeError('createTimer must be a function when provided');
  }
  if (options.commandSink !== undefined && typeof options.commandSink !== 'function') {
    throw new TypeError('commandSink must be a function when provided');
  }
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function assertNever(value: never): never {
  throw new Error(`unsupported Classic Bird controller row ${JSON.stringify(value)}`);
}
