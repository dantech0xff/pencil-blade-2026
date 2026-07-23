import {
  BonusTossStrategy,
  type BonusTossCommand,
  type BonusTossStatePort,
} from './bonus-toss-strategy';
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
  CRAZY_TOSS_CREATION_ORDER,
  CRAZY_TOSS_ROWS,
  type CrazyTossControllerId,
  type CrazyTossIntervalConfig,
  type CrazyTossRow,
} from './crazy-toss-config';
import {
  DoubleTossStrategy,
  type DoubleTossCommand,
  type DoubleTossStrategySnapshot,
} from './double-toss-strategy';
import type { GameplayRandom } from './gameplay-random';
import type { LogicalViewport } from './spawn-kinematics';
import { TossTimer } from './toss-timer';

export const CRAZY_MAGNET_NORMAL_FRUIT_INTERVAL: CrazyTossIntervalConfig = Object.freeze({
  lowSeconds: 0.25,
  highSeconds: 0.5,
});
export const CRAZY_NORMAL_FRUIT_INTERVAL: CrazyTossIntervalConfig = Object.freeze({
  lowSeconds: 0.5,
  highSeconds: 3,
});
export const CRAZY_MAGNET_BOMB_CONTROLLER_ORDER = Object.freeze([
  'ac',
  'b1',
  'b3',
] as const);

export type CrazyTossRuntimeCommand =
  | BonusTossCommand
  | ClassicTossStrategyCommand
  | DoubleTossCommand;

export interface CrazyTossCoordinatorOptions {
  readonly bonusState: BonusTossStatePort;
  readonly commandSink?: (commands: readonly CrazyTossRuntimeCommand[]) => void;
  readonly createTimer?: TossStrategyTimerFactory;
  readonly effectsEnabled: () => boolean;
  readonly planner: ClassicSpawnPlannerPort;
  readonly random: GameplayRandom;
  readonly viewport: () => LogicalViewport;
}

export type CrazyTossControllerSnapshot =
  | Readonly<{
      readonly controller: 'free' | 'concurrent';
      readonly timer: TossStrategyTimerSnapshot;
    }>
  | Readonly<{
      readonly controller: 'wave';
      readonly childTimer: TossStrategyTimerSnapshot;
      readonly pendingPauseRequestIds: readonly number[];
      readonly timer: TossStrategyTimerSnapshot;
    }>
  | Readonly<{
      readonly controller: 'double';
      readonly state: DoubleTossStrategySnapshot;
    }>
  | Readonly<{
      readonly controller: 'bonus';
      readonly timer: TossStrategyTimerSnapshot;
    }>;

export interface CrazyTossCoordinatorSnapshot {
  readonly normalFruitInterval: Readonly<{
    readonly highSeconds: number;
    readonly lowSeconds: number;
  }>;
  readonly pendingDoubleStopCount: number;
  readonly pendingWavePauseCount: number;
}

type TimedStrategy =
  | ClassicFreeTossStrategy
  | ClassicConcurrentTossStrategy
  | ClassicWaveTossStrategy;
type CrazyRuntimeStrategy = TimedStrategy | DoubleTossStrategy | BonusTossStrategy;

interface PendingWavePause {
  readonly controllerId: CrazyTossControllerId;
  readonly pauseRequestId: number;
  remainingSeconds: number;
}

interface PendingDoubleStop {
  readonly stopRequestId: number;
  remainingSeconds: number;
}

/**
 * Pure owner for Crazy's eleven recovered toss slots.
 *
 * Construction, start, and per-frame iteration retain native slot order. Delayed Wave and
 * Double callbacks use the ordinary action clock and intentionally survive Pause/Stop.
 */
export class CrazyTossCoordinator {
  private readonly commandLogValue: CrazyTossRuntimeCommand[] = [];
  private readonly commandSinkValue:
    | ((commands: readonly CrazyTossRuntimeCommand[]) => void)
    | null;
  private readonly controllers = new Map<CrazyTossControllerId, CrazyRuntimeStrategy>();
  private readonly effectsEnabled: () => boolean;
  private readonly pendingDoubleStops: PendingDoubleStop[] = [];
  private readonly pendingWavePauses: PendingWavePause[] = [];
  private readonly planner: ClassicSpawnPlannerPort;
  private readonly random: GameplayRandom;
  private readonly viewport: () => LogicalViewport;
  private normalFruitIntervalValue: CrazyTossIntervalConfig = CRAZY_NORMAL_FRUIT_INTERVAL;

  constructor(options: CrazyTossCoordinatorOptions) {
    assertOptions(options);
    this.commandSinkValue = options.commandSink ?? null;
    this.effectsEnabled = options.effectsEnabled;
    this.planner = options.planner;
    this.random = options.random;
    this.viewport = options.viewport;
    const createTimer = options.createTimer ?? ((timerOptions) => new TossTimer(timerOptions));

    for (const controllerId of CRAZY_TOSS_CREATION_ORDER) {
      const row = requireRow(controllerId);
      const strategy = this.createStrategy(
        row,
        createTimer,
        options.bonusState,
      );
      this.controllers.set(controllerId, strategy);
      if (strategy instanceof ClassicWaveTossStrategy) {
        strategy.setup();
      } else if (strategy instanceof DoubleTossStrategy) {
        strategy.setup();
      }
    }
  }

  get commandLog(): readonly CrazyTossRuntimeCommand[] {
    return Object.freeze([...this.commandLogValue]);
  }

  get snapshot(): CrazyTossCoordinatorSnapshot {
    return Object.freeze({
      normalFruitInterval: this.normalFruitIntervalValue,
      pendingDoubleStopCount: this.pendingDoubleStops.length,
      pendingWavePauseCount: this.pendingWavePauses.length,
    });
  }

  controllerSnapshot(controllerId: CrazyTossControllerId): CrazyTossControllerSnapshot {
    const strategy = this.requireController(controllerId);
    if (strategy instanceof ClassicWaveTossStrategy) {
      return Object.freeze({
        controller: 'wave',
        childTimer: strategy.childTimerSnapshot(),
        pendingPauseRequestIds: strategy.pendingPauseRequestIds,
        timer: strategy.timerSnapshot(),
      });
    }
    if (strategy instanceof DoubleTossStrategy) {
      return Object.freeze({ controller: 'double', state: strategy.snapshot() });
    }
    if (strategy instanceof BonusTossStrategy) {
      return Object.freeze({ controller: 'bonus', timer: strategy.timerSnapshot() });
    }
    return Object.freeze({
      controller: strategy instanceof ClassicConcurrentTossStrategy
        ? 'concurrent'
        : 'free',
      timer: strategy.timerSnapshot(),
    });
  }

  startController(controllerId: CrazyTossControllerId): void {
    this.requireController(controllerId).start();
  }

  stopController(controllerId: CrazyTossControllerId): void {
    this.requireController(controllerId).stop();
  }

  pauseController(controllerId: CrazyTossControllerId): void {
    this.requireController(controllerId).pause();
  }

  resumeController(controllerId: CrazyTossControllerId): void {
    this.requireController(controllerId).resume();
  }

  magnetBegin(): void {
    const normal = this.requireFreeController('ab');
    normal.setLimits(
      CRAZY_MAGNET_NORMAL_FRUIT_INTERVAL.lowSeconds,
      CRAZY_MAGNET_NORMAL_FRUIT_INTERVAL.highSeconds,
    );
    this.normalFruitIntervalValue = CRAZY_MAGNET_NORMAL_FRUIT_INTERVAL;
    for (const controllerId of CRAZY_MAGNET_BOMB_CONTROLLER_ORDER) {
      this.pauseController(controllerId);
    }
  }

  magnetEnd(): void {
    const normal = this.requireFreeController('ab');
    normal.setLimits(
      CRAZY_NORMAL_FRUIT_INTERVAL.lowSeconds,
      CRAZY_NORMAL_FRUIT_INTERVAL.highSeconds,
    );
    this.normalFruitIntervalValue = CRAZY_NORMAL_FRUIT_INTERVAL;
    for (const controllerId of CRAZY_MAGNET_BOMB_CONTROLLER_ORDER) {
      this.resumeController(controllerId);
    }
  }

  tick(deltaSeconds: number): void {
    assertFiniteNonNegative(deltaSeconds, 'deltaSeconds');
    this.advanceDelayedCallbacks(deltaSeconds);

    for (const controllerId of CRAZY_TOSS_CREATION_ORDER) {
      const strategy = this.requireController(controllerId);
      if (strategy instanceof ClassicWaveTossStrategy) {
        strategy.tick(deltaSeconds);
        strategy.tickChild(deltaSeconds);
      } else if (strategy instanceof DoubleTossStrategy) {
        strategy.tickBase(deltaSeconds);
        strategy.tickChild('left', deltaSeconds);
        strategy.tickChild('right', deltaSeconds);
      } else {
        strategy.tick(deltaSeconds);
      }
    }
  }

  private createStrategy(
    row: CrazyTossRow,
    createTimer: TossStrategyTimerFactory,
    bonusState: BonusTossStatePort,
  ): CrazyRuntimeStrategy {
    const shared = {
      commandSink: (commands: readonly CrazyTossRuntimeCommand[]) => {
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
      case 'double':
        return new DoubleTossStrategy(shared);
      case 'bonus':
        return new BonusTossStrategy({
          ...shared,
          bonusState,
          interval: row.outerInterval,
        });
      default:
        return assertNever(row);
    }
  }

  private acceptCommands(commands: readonly CrazyTossRuntimeCommand[]): void {
    const expanded: CrazyTossRuntimeCommand[] = [];
    for (const command of commands) {
      expanded.push(command);
      if (command.type === 'schedule-wave-child-pause') {
        this.pendingWavePauses.push({
          controllerId: requireControllerId(command.controllerId),
          pauseRequestId: command.pauseRequestId,
          remainingSeconds: command.delaySeconds,
        });
      } else if (command.type === 'schedule-double-toss-stop') {
        this.pendingDoubleStops.push({
          remainingSeconds: command.delaySeconds,
          stopRequestId: command.stopRequestId,
        });
      } else if (command.type === 'request-double-free-child-turn') {
        const plan = this.planner.planSpawn({
          direction: command.child.direction,
          effectsEnabled: readEffectsEnabled(this.effectsEnabled),
          tossType: command.child.tossType,
          viewport: readViewport(this.viewport),
        });
        expanded.push(...plan.commands);
      }
    }
    const immutable = Object.freeze([...expanded]);
    this.commandLogValue.push(...immutable);
    this.commandSinkValue?.(immutable);
  }

  private advanceDelayedCallbacks(deltaSeconds: number): void {
    const waveCallbacks = [...this.pendingWavePauses];
    for (const pending of waveCallbacks) {
      pending.remainingSeconds = Math.fround(pending.remainingSeconds - deltaSeconds);
      if (pending.remainingSeconds <= 0) {
        const strategy = this.requireController(pending.controllerId);
        if (!(strategy instanceof ClassicWaveTossStrategy)) {
          throw new Error('scheduled Crazy Wave callback lost its controller');
        }
        strategy.firePauseRequest(pending.pauseRequestId);
        this.pendingWavePauses.splice(this.pendingWavePauses.indexOf(pending), 1);
      }
    }

    const doubleCallbacks = [...this.pendingDoubleStops];
    for (const pending of doubleCallbacks) {
      pending.remainingSeconds = Math.fround(pending.remainingSeconds - deltaSeconds);
      if (pending.remainingSeconds <= 0) {
        const strategy = this.requireController('b4');
        if (!(strategy instanceof DoubleTossStrategy)) {
          throw new Error('scheduled Crazy Double callback lost its controller');
        }
        strategy.fireStopRequest(pending.stopRequestId);
        this.pendingDoubleStops.splice(this.pendingDoubleStops.indexOf(pending), 1);
      }
    }
  }

  private requireController(controllerId: CrazyTossControllerId): CrazyRuntimeStrategy {
    const strategy = this.controllers.get(controllerId);
    if (strategy === undefined) {
      throw new Error(`Crazy controller ${controllerId} was not constructed`);
    }
    return strategy;
  }

  private requireFreeController(controllerId: 'ab'): ClassicFreeTossStrategy {
    const strategy = this.requireController(controllerId);
    if (!(strategy instanceof ClassicFreeTossStrategy)) {
      throw new Error(`Crazy controller ${controllerId} is not FreeToss`);
    }
    return strategy;
  }
}

function requireRow(controllerId: CrazyTossControllerId): CrazyTossRow {
  const row = CRAZY_TOSS_ROWS.find((candidate) => candidate.id === controllerId);
  if (row === undefined) {
    throw new Error(`Crazy row ${controllerId} is missing`);
  }
  return row;
}

function requireControllerId(value: string): CrazyTossControllerId {
  if (!CRAZY_TOSS_CREATION_ORDER.some((controllerId) => controllerId === value)) {
    throw new RangeError(`unknown Crazy controller ${value}`);
  }
  return value as CrazyTossControllerId;
}

function readEffectsEnabled(source: () => boolean): boolean {
  const value = source();
  if (typeof value !== 'boolean') {
    throw new TypeError('effectsEnabled() must return a boolean');
  }
  return value;
}

function readViewport(source: () => LogicalViewport): LogicalViewport {
  const viewport = source();
  if (
    viewport === null
    || typeof viewport !== 'object'
    || !Number.isFinite(viewport.width)
    || !Number.isFinite(viewport.height)
    || viewport.width <= 0
    || viewport.height <= 0
  ) {
    throw new RangeError('viewport() must return positive finite dimensions');
  }
  return viewport;
}

function assertOptions(options: CrazyTossCoordinatorOptions): void {
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
    options.bonusState === null
    || typeof options.bonusState !== 'object'
    || typeof options.bonusState.isEnabled !== 'function'
  ) {
    throw new TypeError('bonusState must provide isEnabled()');
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
  throw new Error(`unsupported Crazy controller row ${JSON.stringify(value)}`);
}
