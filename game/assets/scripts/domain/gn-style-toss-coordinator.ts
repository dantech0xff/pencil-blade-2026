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
import type { GameplayRandom } from './gameplay-random';
import {
  GN_STYLE_TOSS_CREATION_ORDER,
  GN_STYLE_TOSS_OUTER_STOP_ORDER,
  GN_STYLE_TOSS_START_ORDER,
  GN_STYLE_WAVE_CHILD_INTERVAL,
  getGnStyleTossRow,
  type GnStyleTossControllerId,
  type GnStyleTossRow,
} from './gn-style-toss-config';
import type { LogicalViewport } from './spawn-kinematics';
import { TossTimer } from './toss-timer';

export type GnStyleTossRuntimeCommand = ClassicTossStrategyCommand;
export type GnStyleTimeManagerTick = (deltaSeconds: number) => void;

export interface GnStyleTossCoordinatorOptions {
  readonly commandSink?: (
    commands: readonly GnStyleTossRuntimeCommand[],
  ) => void;
  readonly createTimer?: TossStrategyTimerFactory;
  readonly effectsEnabled: () => boolean;
  readonly planner: ClassicSpawnPlannerPort;
  readonly random: GameplayRandom;
  readonly viewport: () => LogicalViewport;
}

export type GnStyleTossControllerSnapshot =
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

export interface GnStyleTossCoordinatorSnapshot {
  readonly pendingWavePauseCount: number;
}

export type GnStyleTossControlEvent = Readonly<{
  readonly action: 'start' | 'stop';
  readonly controller: GnStyleTossControllerId;
  readonly scope: 'outer';
}>;

type GnStyleRuntimeStrategy =
  | ClassicFreeTossStrategy
  | ClassicConcurrentTossStrategy
  | ClassicWaveTossStrategy;

interface PendingWavePause {
  readonly pauseRequestId: number;
  remainingSeconds: number;
}

/**
 * Pure owner for GN Style's three ordinary-fruit controllers.
 *
 * Wave setup samples and pauses its child during construction. `stopAll()` stops only the
 * three outer timers: pending pause callbacks and the Wave child continue to advance.
 */
export class GnStyleTossCoordinator {
  private readonly commandLogValue: GnStyleTossRuntimeCommand[] = [];
  private readonly commandSinkValue:
    | ((commands: readonly GnStyleTossRuntimeCommand[]) => void)
    | null;
  private readonly controlLogValue: GnStyleTossControlEvent[] = [];
  private readonly controllers =
    new Map<GnStyleTossControllerId, GnStyleRuntimeStrategy>();
  private readonly effectsEnabled: () => boolean;
  private readonly pendingWavePauses: PendingWavePause[] = [];
  private readonly planner: ClassicSpawnPlannerPort;
  private readonly random: GameplayRandom;
  private readonly viewport: () => LogicalViewport;

  constructor(options: GnStyleTossCoordinatorOptions) {
    assertOptions(options);
    assertSharedWaveChildInterval();
    this.commandSinkValue = options.commandSink ?? null;
    this.effectsEnabled = options.effectsEnabled;
    this.planner = options.planner;
    this.random = options.random;
    this.viewport = options.viewport;
    const createTimer = options.createTimer
      ?? ((timerOptions) => new TossTimer(timerOptions));

    for (const controllerId of GN_STYLE_TOSS_CREATION_ORDER) {
      const strategy = this.createStrategy(
        getGnStyleTossRow(controllerId),
        createTimer,
      );
      this.controllers.set(controllerId, strategy);
      if (strategy instanceof ClassicWaveTossStrategy) {
        strategy.setup();
      }
    }
  }

  get commandLog(): readonly GnStyleTossRuntimeCommand[] {
    return Object.freeze([...this.commandLogValue]);
  }

  get controlLog(): readonly GnStyleTossControlEvent[] {
    return Object.freeze([...this.controlLogValue]);
  }

  get snapshot(): GnStyleTossCoordinatorSnapshot {
    return Object.freeze({
      pendingWavePauseCount: this.pendingWavePauses.length,
    });
  }

  controllerSnapshot(
    controllerId: GnStyleTossControllerId,
  ): GnStyleTossControllerSnapshot {
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
    for (const controllerId of GN_STYLE_TOSS_START_ORDER) {
      this.startController(controllerId);
    }
  }

  /**
   * Time Up callback order. This deliberately does not pause/stop Wave's internal Free child
   * and does not cancel its already armed pause request.
   */
  stopAll(): void {
    for (const controllerId of GN_STYLE_TOSS_OUTER_STOP_ORDER) {
      this.stopController(controllerId);
    }
  }

  startController(controllerId: GnStyleTossControllerId): void {
    this.requireController(controllerId).start();
    this.recordControl('start', controllerId);
  }

  stopController(controllerId: GnStyleTossControllerId): void {
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

    for (const controllerId of GN_STYLE_TOSS_CREATION_ORDER) {
      const strategy = this.requireController(controllerId);
      strategy.tick(deltaSeconds);
      if (strategy instanceof ClassicWaveTossStrategy) {
        strategy.tickChild(deltaSeconds);
      }
    }
  }

  /**
   * Running-frame seam that locks the recovered coordinator-before-TimeManager order.
   * During TIME UP the host calls `tick()` directly because the timer has already expired.
   */
  tickBeforeTimeManager(
    deltaSeconds: number,
    tickTimeManager: GnStyleTimeManagerTick,
  ): void {
    if (typeof tickTimeManager !== 'function') {
      throw new TypeError('tickTimeManager must be a function');
    }
    this.tick(deltaSeconds);
    tickTimeManager(deltaSeconds);
  }

  private createStrategy(
    row: GnStyleTossRow,
    createTimer: TossStrategyTimerFactory,
  ): GnStyleRuntimeStrategy {
    const shared = {
      commandSink: (commands: readonly GnStyleTossRuntimeCommand[]) => {
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
    commands: readonly GnStyleTossRuntimeCommand[],
  ): void {
    for (const command of commands) {
      if (command.type === 'schedule-wave-child-pause') {
        if (command.controllerId !== 'wave') {
          throw new Error(`unexpected GN Style Wave owner ${command.controllerId}`);
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
        throw new Error('scheduled GN Style Wave callback lost its controller');
      }
      this.pendingWavePauses.splice(this.pendingWavePauses.indexOf(pending), 1);
      strategy.firePauseRequest(pending.pauseRequestId);
    }
  }

  private recordControl(
    action: GnStyleTossControlEvent['action'],
    controller: GnStyleTossControllerId,
  ): void {
    this.controlLogValue.push(Object.freeze({
      action,
      controller,
      scope: 'outer',
    }));
  }

  private requireController(
    controllerId: GnStyleTossControllerId,
  ): GnStyleRuntimeStrategy {
    const strategy = this.controllers.get(controllerId);
    if (strategy === undefined) {
      throw new Error(`GN Style controller ${controllerId} was not constructed`);
    }
    return strategy;
  }
}

function assertSharedWaveChildInterval(): void {
  if (
    GN_STYLE_WAVE_CHILD_INTERVAL.lowSeconds
      !== CLASSIC_WAVE_INTERNAL_INTERVAL.lowSeconds
    || GN_STYLE_WAVE_CHILD_INTERVAL.highSeconds
      !== CLASSIC_WAVE_INTERNAL_INTERVAL.highSeconds
  ) {
    throw new Error('GN Style Wave child interval must match the shared strategy');
  }
}

function assertOptions(options: GnStyleTossCoordinatorOptions): void {
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
  throw new Error(`unsupported GN Style controller row ${JSON.stringify(value)}`);
}
