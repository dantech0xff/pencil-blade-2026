import type { GameplayRandom } from './gameplay-random';
import type {
  TossStrategyInterval,
  TossStrategyTimer,
  TossStrategyTimerFactory,
  TossStrategyTimerSnapshot,
} from './classic-toss-strategies';
import type { ClassicTossDirection } from './spawn-kinematics';

export const DOUBLE_TOSS_DURATION_SECONDS = Math.fround(15);
export const DOUBLE_TOSS_CHILD_Z_ORDER = 1 as const;
export const DOUBLE_TOSS_NORMAL_FRUIT_TYPE = 0 as const;
export const DOUBLE_TOSS_BONUS_FRUIT_ID = 11 as const;
export const DOUBLE_TOSS_STRUM_AUDIO_PATH = 'Sounds/doubletosstrum.wav' as const;
export const DOUBLE_TOSS_LOOP_AUDIO_PATH = 'Sounds/doubletoss.wav' as const;
export const DOUBLE_TOSS_CHILD_INTERVAL: TossStrategyInterval = Object.freeze({
  lowSeconds: 0.75,
  highSeconds: 1.5,
});

const ZERO_INTERVAL: TossStrategyInterval = Object.freeze({
  lowSeconds: 0,
  highSeconds: 0,
});
const NO_COMMANDS: readonly DoubleTossCommand[] = Object.freeze([]);

export type DoubleTossChildSide = 'left' | 'right';
export type DoubleTossChildDirection = Extract<ClassicTossDirection, 2 | 3>;

export interface DoubleTossChildDefinition {
  readonly childControllerId: string;
  readonly direction: DoubleTossChildDirection;
  readonly interval: TossStrategyInterval;
  readonly side: DoubleTossChildSide;
  readonly tossType: typeof DOUBLE_TOSS_NORMAL_FRUIT_TYPE;
  readonly zOrder: typeof DOUBLE_TOSS_CHILD_Z_ORDER;
}

export type DoubleTossCommand =
  | Readonly<{
      type: 'create-double-free-child';
      controllerId: string;
      child: DoubleTossChildDefinition;
    }>
  | Readonly<{
      type: 'attach-double-free-child';
      controllerId: string;
      childControllerId: string;
      side: DoubleTossChildSide;
      zOrder: typeof DOUBLE_TOSS_CHILD_Z_ORDER;
    }>
  | Readonly<{
      type: 'start-double-base-timer';
      controllerId: string;
    }>
  | Readonly<{
      type: 'pause-double-base-timer';
      controllerId: string;
    }>
  | Readonly<{
      type: 'resume-double-base-timer';
      controllerId: string;
    }>
  | Readonly<{
      type: 'stop-double-base-timer';
      controllerId: string;
    }>
  | Readonly<{
      type: 'start-double-free-child';
      controllerId: string;
      childControllerId: string;
      side: DoubleTossChildSide;
    }>
  | Readonly<{
      type: 'pause-double-free-child';
      controllerId: string;
      childControllerId: string;
      side: DoubleTossChildSide;
    }>
  | Readonly<{
      type: 'resume-double-free-child';
      controllerId: string;
      childControllerId: string;
      side: DoubleTossChildSide;
    }>
  | Readonly<{
      type: 'stop-double-free-child';
      controllerId: string;
      childControllerId: string;
      side: DoubleTossChildSide;
    }>
  | Readonly<{
      type: 'request-double-free-child-turn';
      controllerId: string;
      child: DoubleTossChildDefinition;
    }>
  | Readonly<{
      type: 'request-double-toss-strum-audio';
      canonicalPath: typeof DOUBLE_TOSS_STRUM_AUDIO_PATH;
      loop: false;
    }>
  | Readonly<{
      type: 'request-double-toss-loop-audio';
      canonicalPath: typeof DOUBLE_TOSS_LOOP_AUDIO_PATH;
      loop: true;
    }>
  | Readonly<{
      type: 'stop-double-toss-loop-audio';
      canonicalPath: typeof DOUBLE_TOSS_LOOP_AUDIO_PATH;
    }>
  | Readonly<{
      type: 'schedule-double-toss-stop';
      controllerId: string;
      delaySeconds: typeof DOUBLE_TOSS_DURATION_SECONDS;
      stopRequestId: number;
      uncancelledByPauseOrStop: true;
    }>
  | Readonly<{
      type: 'disable-bonus';
      bonusId: typeof DOUBLE_TOSS_BONUS_FRUIT_ID;
    }>;

export type DoubleTossCommandSink = (
  commands: readonly DoubleTossCommand[],
) => void;

export interface DoubleTossStrategyOptions {
  readonly commandSink?: DoubleTossCommandSink;
  readonly controllerId: string;
  readonly createTimer: TossStrategyTimerFactory;
  readonly effectsEnabled: () => boolean;
  readonly random: GameplayRandom;
}

export interface DoubleTossStrategySnapshot {
  readonly active: boolean;
  readonly baseTimer: TossStrategyTimerSnapshot;
  readonly leftChildTimer: TossStrategyTimerSnapshot | null;
  readonly pendingStopRequestIds: readonly number[];
  readonly rightChildTimer: TossStrategyTimerSnapshot | null;
  readonly setupComplete: boolean;
}

interface DoubleTossChildRuntime {
  readonly definition: DoubleTossChildDefinition;
  readonly timer: TossStrategyTimer;
}

/**
 * Pure command/state model of the recovered DoubleToss composite.
 *
 * The zero-limit base timer is retained so Start and every positive scheduled tick consume
 * their recovered decile draw even though the base turn produces no command.
 */
export class DoubleTossStrategy {
  readonly controllerId: string;
  readonly random: GameplayRandom;

  private activeValue = false;
  private readonly baseTimer: TossStrategyTimer;
  private readonly commandLogValue: DoubleTossCommand[] = [];
  private readonly commandSinkValue: DoubleTossCommandSink | null;
  private readonly createTimerValue: TossStrategyTimerFactory;
  private readonly effectsEnabledValue: () => boolean;
  private leftChild: DoubleTossChildRuntime | null = null;
  private nextStopRequestId = 1;
  private readonly pendingStopRequests = new Set<number>();
  private rightChild: DoubleTossChildRuntime | null = null;

  constructor(options: DoubleTossStrategyOptions) {
    validateOptions(options);
    this.controllerId = options.controllerId;
    this.random = options.random;
    this.commandSinkValue = options.commandSink ?? null;
    this.createTimerValue = options.createTimer;
    this.effectsEnabledValue = options.effectsEnabled;
    this.baseTimer = this.createTimerValue({
      random: this.random,
      lowSeconds: ZERO_INTERVAL.lowSeconds,
      highSeconds: ZERO_INTERVAL.highSeconds,
      onTossTurn() {
        // The recovered inherited DoubleToss turn is empty.
      },
    });
    assertTimer(this.baseTimer);
  }

  get active(): boolean {
    return this.activeValue;
  }

  get commandLog(): readonly DoubleTossCommand[] {
    return Object.freeze([...this.commandLogValue]);
  }

  get pendingStopRequestIds(): readonly number[] {
    return Object.freeze([...this.pendingStopRequests]);
  }

  snapshot(): DoubleTossStrategySnapshot {
    return Object.freeze({
      active: this.activeValue,
      baseTimer: timerSnapshot(this.baseTimer),
      leftChildTimer: this.leftChild === null
        ? null
        : timerSnapshot(this.leftChild.timer),
      pendingStopRequestIds: this.pendingStopRequestIds,
      rightChildTimer: this.rightChild === null
        ? null
        : timerSnapshot(this.rightChild.timer),
      setupComplete: this.leftChild !== null && this.rightChild !== null,
    });
  }

  /** Creates and attaches the Left child before the Right child, both at recovered z-order 1. */
  setup(): readonly DoubleTossCommand[] {
    if (this.leftChild !== null || this.rightChild !== null) {
      throw new Error('DoubleToss children are already set up');
    }

    const leftDefinition = createChildDefinition(this.controllerId, 'left', 2);
    const rightDefinition = createChildDefinition(this.controllerId, 'right', 3);
    const leftTimer = this.createChildTimer(leftDefinition);
    const rightTimer = this.createChildTimer(rightDefinition);
    this.leftChild = Object.freeze({ definition: leftDefinition, timer: leftTimer });
    this.rightChild = Object.freeze({ definition: rightDefinition, timer: rightTimer });

    return this.record([
      Object.freeze({
        type: 'create-double-free-child',
        controllerId: this.controllerId,
        child: leftDefinition,
      }),
      Object.freeze({
        type: 'attach-double-free-child',
        controllerId: this.controllerId,
        childControllerId: leftDefinition.childControllerId,
        side: leftDefinition.side,
        zOrder: DOUBLE_TOSS_CHILD_Z_ORDER,
      }),
      Object.freeze({
        type: 'create-double-free-child',
        controllerId: this.controllerId,
        child: rightDefinition,
      }),
      Object.freeze({
        type: 'attach-double-free-child',
        controllerId: this.controllerId,
        childControllerId: rightDefinition.childControllerId,
        side: rightDefinition.side,
        zOrder: DOUBLE_TOSS_CHILD_Z_ORDER,
      }),
    ]);
  }

  /**
   * First Start while inactive consumes base, Left, then Right timer draws and arms an
   * independent 15-second callback. A repeated Start while active is a true no-op.
   */
  start(): readonly DoubleTossCommand[] {
    if (this.activeValue) {
      return NO_COMMANDS;
    }
    const left = this.requireChild('left');
    const right = this.requireChild('right');
    if (this.nextStopRequestId >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('DoubleToss stop request ID space is exhausted');
    }

    // The injected settings port is a target boundary. Validate it before the first timer,
    // active flag, or pending callback is mutated so a broken port cannot wedge DoubleToss.
    const effectsEnabled = readEffectsEnabled(this.effectsEnabledValue);
    this.activeValue = true;
    this.baseTimer.start();
    const commands: DoubleTossCommand[] = [
      Object.freeze({
        type: 'start-double-base-timer',
        controllerId: this.controllerId,
      }),
    ];
    if (effectsEnabled) {
      commands.push(
        Object.freeze({
          type: 'request-double-toss-strum-audio',
          canonicalPath: DOUBLE_TOSS_STRUM_AUDIO_PATH,
          loop: false,
        }),
        Object.freeze({
          type: 'request-double-toss-loop-audio',
          canonicalPath: DOUBLE_TOSS_LOOP_AUDIO_PATH,
          loop: true,
        }),
      );
    }

    left.timer.start();
    commands.push(childLifecycleCommand('start', this.controllerId, left.definition));
    right.timer.start();
    commands.push(childLifecycleCommand('start', this.controllerId, right.definition));

    const stopRequestId = this.nextStopRequestId;
    this.nextStopRequestId += 1;
    this.pendingStopRequests.add(stopRequestId);
    commands.push(Object.freeze({
      type: 'schedule-double-toss-stop',
      controllerId: this.controllerId,
      delaySeconds: DOUBLE_TOSS_DURATION_SECONDS,
      stopRequestId,
      uncancelledByPauseOrStop: true,
    }));
    return this.record(commands);
  }

  pause(): readonly DoubleTossCommand[] {
    const left = this.requireChild('left');
    const right = this.requireChild('right');
    this.baseTimer.pause();
    left.timer.pause();
    right.timer.pause();
    return this.record([
      Object.freeze({
        type: 'pause-double-base-timer',
        controllerId: this.controllerId,
      }),
      childLifecycleCommand('pause', this.controllerId, left.definition),
      childLifecycleCommand('pause', this.controllerId, right.definition),
    ]);
  }

  resume(): readonly DoubleTossCommand[] {
    const left = this.requireChild('left');
    const right = this.requireChild('right');
    this.baseTimer.resume();
    left.timer.resume();
    right.timer.resume();
    return this.record([
      Object.freeze({
        type: 'resume-double-base-timer',
        controllerId: this.controllerId,
      }),
      childLifecycleCommand('resume', this.controllerId, left.definition),
      childLifecycleCommand('resume', this.controllerId, right.definition),
    ]);
  }

  /**
   * Stop never cancels an older 15-second callback. It always forwards base/Left/Right,
   * stops the loop, conditionally requests the exit strum, and disables bonus fruit 11.
   */
  stop(): readonly DoubleTossCommand[] {
    const left = this.requireChild('left');
    const right = this.requireChild('right');
    const effectsEnabled = readEffectsEnabled(this.effectsEnabledValue);
    this.activeValue = false;
    this.baseTimer.stop();
    left.timer.stop();
    right.timer.stop();

    const commands: DoubleTossCommand[] = [
      Object.freeze({
        type: 'stop-double-base-timer',
        controllerId: this.controllerId,
      }),
      childLifecycleCommand('stop', this.controllerId, left.definition),
      childLifecycleCommand('stop', this.controllerId, right.definition),
      Object.freeze({
        type: 'stop-double-toss-loop-audio',
        canonicalPath: DOUBLE_TOSS_LOOP_AUDIO_PATH,
      }),
    ];
    if (effectsEnabled) {
      commands.push(Object.freeze({
        type: 'request-double-toss-strum-audio',
        canonicalPath: DOUBLE_TOSS_STRUM_AUDIO_PATH,
        loop: false,
      }));
    }
    commands.push(Object.freeze({
      type: 'disable-bonus',
      bonusId: DOUBLE_TOSS_BONUS_FRUIT_ID,
    }));
    return this.record(commands);
  }

  /** Fires one scheduled callback; other pending callbacks remain armed. */
  fireStopRequest(stopRequestId: number): readonly DoubleTossCommand[] {
    assertPositiveSafeInteger(stopRequestId, 'stopRequestId');
    if (!this.pendingStopRequests.has(stopRequestId)) {
      throw new Error(`unknown or already-fired DoubleToss stop request: ${stopRequestId}`);
    }
    const commands = this.stop();
    this.pendingStopRequests.delete(stopRequestId);
    return commands;
  }

  tickBase(deltaSeconds: number): boolean {
    assertFiniteNonNegative(deltaSeconds, 'deltaSeconds');
    return this.baseTimer.tick(deltaSeconds);
  }

  tickChild(side: DoubleTossChildSide, deltaSeconds: number): boolean {
    assertChildSide(side);
    assertFiniteNonNegative(deltaSeconds, 'deltaSeconds');
    return this.requireChild(side).timer.tick(deltaSeconds);
  }

  childTimerSnapshot(side: DoubleTossChildSide): TossStrategyTimerSnapshot {
    assertChildSide(side);
    return timerSnapshot(this.requireChild(side).timer);
  }

  private createChildTimer(definition: DoubleTossChildDefinition): TossStrategyTimer {
    const timer = this.createTimerValue({
      random: this.random,
      lowSeconds: definition.interval.lowSeconds,
      highSeconds: definition.interval.highSeconds,
      onTossTurn: () => {
        this.record([
          Object.freeze({
            type: 'request-double-free-child-turn',
            controllerId: this.controllerId,
            child: definition,
          }),
        ]);
      },
    });
    assertTimer(timer);
    return timer;
  }

  private record(
    commands: readonly DoubleTossCommand[],
  ): readonly DoubleTossCommand[] {
    const immutableBatch = Object.freeze([...commands]);
    this.commandLogValue.push(...immutableBatch);
    this.commandSinkValue?.(immutableBatch);
    return immutableBatch;
  }

  private requireChild(side: DoubleTossChildSide): DoubleTossChildRuntime {
    const child = side === 'left' ? this.leftChild : this.rightChild;
    if (child === null) {
      throw new Error('call setup() before using DoubleToss children');
    }
    return child;
  }
}

function createChildDefinition(
  controllerId: string,
  side: DoubleTossChildSide,
  direction: DoubleTossChildDirection,
): DoubleTossChildDefinition {
  return Object.freeze({
    childControllerId: `${controllerId}:${side}-free`,
    direction,
    interval: DOUBLE_TOSS_CHILD_INTERVAL,
    side,
    tossType: DOUBLE_TOSS_NORMAL_FRUIT_TYPE,
    zOrder: DOUBLE_TOSS_CHILD_Z_ORDER,
  });
}

function childLifecycleCommand(
  action: 'start' | 'pause' | 'resume' | 'stop',
  controllerId: string,
  child: DoubleTossChildDefinition,
): DoubleTossCommand {
  return Object.freeze({
    type: `${action}-double-free-child`,
    controllerId,
    childControllerId: child.childControllerId,
    side: child.side,
  }) as DoubleTossCommand;
}

function timerSnapshot(timer: TossStrategyTimer): TossStrategyTimerSnapshot {
  return Object.freeze({
    elapsedSeconds: timer.elapsedSeconds,
    thresholdSeconds: timer.thresholdSeconds,
    scheduled: timer.scheduled,
  });
}

function validateOptions(options: DoubleTossStrategyOptions): void {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('options must be an object');
  }
  if (typeof options.controllerId !== 'string' || options.controllerId.length === 0) {
    throw new TypeError('controllerId must be a non-empty string');
  }
  assertGameplayRandom(options.random);
  if (typeof options.createTimer !== 'function') {
    throw new TypeError('createTimer must be a function');
  }
  if (typeof options.effectsEnabled !== 'function') {
    throw new TypeError('effectsEnabled must be a function');
  }
  if (options.commandSink !== undefined && typeof options.commandSink !== 'function') {
    throw new TypeError('commandSink must be a function when provided');
  }
}

function assertGameplayRandom(random: GameplayRandom): void {
  if (
    random === null
    || typeof random !== 'object'
    || typeof random.nextRawNonNegativeInt !== 'function'
    || typeof random.nextIntInclusive !== 'function'
    || typeof random.nextDecile !== 'function'
  ) {
    throw new TypeError('random must implement GameplayRandom');
  }
}

function assertTimer(timer: TossStrategyTimer): void {
  if (
    timer === null
    || typeof timer !== 'object'
    || typeof timer.start !== 'function'
    || typeof timer.pause !== 'function'
    || typeof timer.resume !== 'function'
    || typeof timer.stop !== 'function'
    || typeof timer.restart !== 'function'
    || typeof timer.setLimits !== 'function'
    || typeof timer.tick !== 'function'
  ) {
    throw new TypeError('createTimer() must return a TossTimer-compatible object');
  }
}

function readEffectsEnabled(source: () => boolean): boolean {
  const enabled = source();
  if (typeof enabled !== 'boolean') {
    throw new TypeError('effectsEnabled() must return a boolean');
  }
  return enabled;
}

function assertChildSide(value: string): asserts value is DoubleTossChildSide {
  if (value !== 'left' && value !== 'right') {
    throw new RangeError('side must be left or right');
  }
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite`);
  }
  if (value < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
}
