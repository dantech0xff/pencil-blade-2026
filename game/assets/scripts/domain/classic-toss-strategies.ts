import type { GameplayRandom } from './gameplay-random';
import type {
  ClassicSpawnCommand,
  ClassicSpawnPlan,
  ClassicSpawnRequest,
  ClassicSpawnTossType,
} from './classic-spawn-planner';
import type { ClassicTossDirection, LogicalViewport } from './spawn-kinematics';

export interface TossStrategyInterval {
  readonly lowSeconds: number;
  readonly highSeconds: number;
}

export interface TossStrategyTimerOptions {
  readonly random: GameplayRandom;
  readonly lowSeconds: number;
  readonly highSeconds: number;
  readonly onTossTurn: () => void;
}

/** Structurally implemented by `TossTimer`; runtime construction stays injectable. */
export interface TossStrategyTimer {
  readonly elapsedSeconds: number;
  readonly thresholdSeconds: number | null;
  readonly scheduled: boolean;
  setLimits(lowSeconds: number, highSeconds: number): void;
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  restart(): void;
  tick(deltaSeconds: number): boolean;
}

export type TossStrategyTimerFactory = (
  options: TossStrategyTimerOptions,
) => TossStrategyTimer;

export interface ClassicSpawnPlannerPort {
  readonly random: GameplayRandom;
  planSpawn(request: ClassicSpawnRequest): ClassicSpawnPlan;
}

export interface TossStrategyTimerSnapshot {
  readonly elapsedSeconds: number;
  readonly thresholdSeconds: number | null;
  readonly scheduled: boolean;
}

export const CLASSIC_WAVE_INTERNAL_INTERVAL: TossStrategyInterval = Object.freeze({
  lowSeconds: 0.25,
  highSeconds: 0.75,
});
export const CLASSIC_WAVE_CHILD_Z_ORDER = 1;

export type ClassicWaveCommand =
  | Readonly<{
      type: 'create-wave-child';
      controllerId: string;
      childControllerId: string;
      tossType: ClassicSpawnTossType;
      direction: ClassicTossDirection;
      interval: TossStrategyInterval;
    }>
  | Readonly<{
      type: 'attach-wave-child';
      controllerId: string;
      childControllerId: string;
      zOrder: 1;
    }>
  | Readonly<{
      type: 'start-wave-child';
      controllerId: string;
      childControllerId: string;
    }>
  | Readonly<{
      type: 'pause-wave-child';
      controllerId: string;
      childControllerId: string;
      reason: 'setup';
    }>
  | Readonly<{
      type: 'resume-wave-child';
      controllerId: string;
      childControllerId: string;
    }>
  | Readonly<{
      type: 'schedule-wave-child-pause';
      controllerId: string;
      childControllerId: string;
      pauseRequestId: number;
      delaySeconds: number;
    }>
  | Readonly<{
      type: 'pause-wave-child';
      controllerId: string;
      childControllerId: string;
      reason: 'scheduled';
      pauseRequestId: number;
    }>;

export type ClassicTossStrategyCommand = ClassicSpawnCommand | ClassicWaveCommand;
export type ViewportSource = () => LogicalViewport;
export type EffectsEnabledSource = () => boolean;
export type TossStrategyCommandSink = (
  commands: readonly ClassicTossStrategyCommand[],
) => void;

interface TimedStrategyOptions {
  readonly controllerId: string;
  readonly random: GameplayRandom;
  readonly interval: TossStrategyInterval;
  readonly createTimer: TossStrategyTimerFactory;
  readonly commandSink?: TossStrategyCommandSink;
}

export interface ClassicFreeTossStrategyOptions extends TimedStrategyOptions {
  readonly planner: ClassicSpawnPlannerPort;
  readonly tossType: ClassicSpawnTossType;
  readonly direction: ClassicTossDirection;
  readonly viewport: ViewportSource;
  readonly effectsEnabled: EffectsEnabledSource;
}

export interface ClassicConcurrentTossStrategyOptions
  extends ClassicFreeTossStrategyOptions {
  readonly countMin: number;
  readonly countMax: number;
}

export interface ClassicWaveTossStrategyOptions extends TimedStrategyOptions {
  readonly planner: ClassicSpawnPlannerPort;
  readonly tossType: ClassicSpawnTossType;
  readonly direction: ClassicTossDirection;
  readonly viewport: ViewportSource;
  readonly effectsEnabled: EffectsEnabledSource;
  readonly activeWindow: TossStrategyInterval;
}

/** Common recovered timer lifecycle plus an immutable-view command journal. */
abstract class TimedClassicTossStrategy {
  readonly controllerId: string;
  readonly random: GameplayRandom;
  private readonly timerValue: TossStrategyTimer;
  private readonly commandSinkValue: TossStrategyCommandSink | null;
  private readonly commandLogValue: ClassicTossStrategyCommand[] = [];

  protected constructor(options: TimedStrategyOptions) {
    validateTimedOptions(options);
    this.controllerId = options.controllerId;
    this.random = options.random;
    this.commandSinkValue = options.commandSink ?? null;
    this.timerValue = options.createTimer({
      random: this.random,
      lowSeconds: options.interval.lowSeconds,
      highSeconds: options.interval.highSeconds,
      onTossTurn: () => {
        this.executeTurn();
      },
    });
    assertTimer(this.timerValue);
  }

  get commandLog(): readonly ClassicTossStrategyCommand[] {
    return Object.freeze([...this.commandLogValue]);
  }

  timerSnapshot(): TossStrategyTimerSnapshot {
    return Object.freeze({
      elapsedSeconds: this.timerValue.elapsedSeconds,
      thresholdSeconds: this.timerValue.thresholdSeconds,
      scheduled: this.timerValue.scheduled,
    });
  }

  /** Changes only future timer samples; the currently armed threshold remains untouched. */
  setLimits(lowSeconds: number, highSeconds: number): void {
    validateInterval({ lowSeconds, highSeconds }, 'interval');
    this.timerValue.setLimits(lowSeconds, highSeconds);
  }

  start(): void {
    this.timerValue.start();
  }

  pause(): void {
    this.timerValue.pause();
  }

  resume(): void {
    this.timerValue.resume();
  }

  stop(): void {
    this.timerValue.stop();
  }

  restart(): void {
    this.timerValue.restart();
  }

  tick(deltaSeconds: number): boolean {
    return this.timerValue.tick(deltaSeconds);
  }

  protected executeTurn(): readonly ClassicTossStrategyCommand[] {
    return this.record(this.buildTurnCommands());
  }

  protected record(
    commands: readonly ClassicTossStrategyCommand[],
  ): readonly ClassicTossStrategyCommand[] {
    const immutableBatch = Object.freeze([...commands]);
    this.commandLogValue.push(...immutableBatch);
    if (this.commandSinkValue !== null) {
      this.commandSinkValue(immutableBatch);
    }
    return immutableBatch;
  }

  protected abstract buildTurnCommands(): readonly ClassicTossStrategyCommand[];
}

/** One complete recovered Free sequence per timer turn. */
export class ClassicFreeTossStrategy extends TimedClassicTossStrategy {
  private readonly planner: ClassicSpawnPlannerPort;
  private readonly tossType: ClassicSpawnTossType;
  private readonly direction: ClassicTossDirection;
  private readonly viewport: ViewportSource;
  private readonly effectsEnabled: EffectsEnabledSource;

  constructor(options: ClassicFreeTossStrategyOptions) {
    validateSpawnStrategyOptions(options);
    super(options);
    this.planner = options.planner;
    this.tossType = options.tossType;
    this.direction = options.direction;
    this.viewport = options.viewport;
    this.effectsEnabled = options.effectsEnabled;
  }

  /** Direct `OnTossTurn` seam; timer-driven calls still rearm before reaching this method. */
  performTurn(): readonly ClassicTossStrategyCommand[] {
    return this.executeTurn();
  }

  protected buildTurnCommands(): readonly ClassicTossStrategyCommand[] {
    const plan = this.planner.planSpawn(readSpawnRequest(
      this.tossType,
      this.direction,
      this.viewport,
      this.effectsEnabled,
    ));
    return plan.commands;
  }
}

/** Recovered inclusive `countMax + 1` quirk with whole spawns kept contiguous. */
export class ClassicConcurrentTossStrategy extends TimedClassicTossStrategy {
  private readonly planner: ClassicSpawnPlannerPort;
  private readonly tossType: ClassicSpawnTossType;
  private readonly direction: ClassicTossDirection;
  private readonly viewport: ViewportSource;
  private readonly effectsEnabled: EffectsEnabledSource;
  private readonly countMin: number;
  private readonly countMax: number;

  constructor(options: ClassicConcurrentTossStrategyOptions) {
    validateSpawnStrategyOptions(options);
    assertSafeInteger(options.countMin, 'countMin');
    assertSafeInteger(options.countMax, 'countMax');
    if (options.countMin < 0 || options.countMin > options.countMax) {
      throw new RangeError('counts must satisfy 0 <= countMin <= countMax');
    }
    if (options.countMax >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('countMax + 1 must be a safe integer');
    }

    super(options);
    this.planner = options.planner;
    this.tossType = options.tossType;
    this.direction = options.direction;
    this.viewport = options.viewport;
    this.effectsEnabled = options.effectsEnabled;
    this.countMin = options.countMin;
    this.countMax = options.countMax;
  }

  performTurn(): readonly ClassicTossStrategyCommand[] {
    return this.executeTurn();
  }

  protected buildTurnCommands(): readonly ClassicTossStrategyCommand[] {
    const sampledMaxInclusive = this.countMax + 1;
    const count = this.random.nextIntInclusive(this.countMin, sampledMaxInclusive);
    if (!Number.isSafeInteger(count) || count < this.countMin || count > sampledMaxInclusive) {
      throw new RangeError(
        `nextIntInclusive() must return an integer in [${this.countMin}, ${sampledMaxInclusive}]`,
      );
    }

    const commands: ClassicTossStrategyCommand[] = [];
    for (let index = 0; index < count; index += 1) {
      const plan = this.planner.planSpawn(readSpawnRequest(
        this.tossType,
        this.direction,
        this.viewport,
        this.effectsEnabled,
      ));
      commands.push(...plan.commands);
    }
    return Object.freeze(commands);
  }
}

/**
 * Classic Wave gate. Setup starts/samples then pauses its internal Free timer. Every outer
 * expiry is delivered only after the injected TossTimer has rearmed, then resumes the child,
 * draws the active window, and records a distinct pause request without cancellation.
 */
export class ClassicWaveTossStrategy extends TimedClassicTossStrategy {
  private readonly planner: ClassicSpawnPlannerPort;
  private readonly tossType: ClassicSpawnTossType;
  private readonly direction: ClassicTossDirection;
  private readonly viewport: ViewportSource;
  private readonly effectsEnabled: EffectsEnabledSource;
  private readonly activeWindow: TossStrategyInterval;
  private readonly createTimerValue: TossStrategyTimerFactory;
  private readonly childControllerId: string;
  private readonly pendingPauseRequests = new Set<number>();
  private child: ClassicFreeTossStrategy | null = null;
  private nextPauseRequestId = 1;

  constructor(options: ClassicWaveTossStrategyOptions) {
    validateSpawnStrategyOptions(options);
    validateInterval(options.activeWindow, 'activeWindow');
    super(options);
    this.planner = options.planner;
    this.tossType = options.tossType;
    this.direction = options.direction;
    this.viewport = options.viewport;
    this.effectsEnabled = options.effectsEnabled;
    this.activeWindow = Object.freeze({ ...options.activeWindow });
    this.createTimerValue = options.createTimer;
    this.childControllerId = `${options.controllerId}:internal-free`;
  }

  /** Recovered Wave on-enter sequence: create, attach, Start/sample, then Pause. */
  setup(): readonly ClassicTossStrategyCommand[] {
    if (this.child !== null) {
      throw new Error('Wave child is already set up');
    }

    const child = new ClassicFreeTossStrategy({
      controllerId: this.childControllerId,
      random: this.random,
      interval: CLASSIC_WAVE_INTERNAL_INTERVAL,
      createTimer: this.createTimerValue,
      planner: this.planner,
      tossType: this.tossType,
      direction: this.direction,
      viewport: this.viewport,
      effectsEnabled: this.effectsEnabled,
      commandSink: (commands) => {
        this.record(commands);
      },
    });
    this.child = child;

    const commands: ClassicTossStrategyCommand[] = [
      Object.freeze({
        type: 'create-wave-child',
        controllerId: this.controllerId,
        childControllerId: this.childControllerId,
        tossType: this.tossType,
        direction: this.direction,
        interval: CLASSIC_WAVE_INTERNAL_INTERVAL,
      }),
      Object.freeze({
        type: 'attach-wave-child',
        controllerId: this.controllerId,
        childControllerId: this.childControllerId,
        zOrder: CLASSIC_WAVE_CHILD_Z_ORDER,
      }),
    ];

    child.start();
    commands.push(Object.freeze({
      type: 'start-wave-child',
      controllerId: this.controllerId,
      childControllerId: this.childControllerId,
    }));
    child.pause();
    commands.push(Object.freeze({
      type: 'pause-wave-child',
      controllerId: this.controllerId,
      childControllerId: this.childControllerId,
      reason: 'setup',
    }));
    return this.record(commands);
  }

  override start(): void {
    this.requireChild();
    super.start();
  }

  override resume(): void {
    this.requireChild();
    super.resume();
  }

  tickChild(deltaSeconds: number): boolean {
    return this.requireChild().tick(deltaSeconds);
  }

  childTimerSnapshot(): TossStrategyTimerSnapshot {
    return this.requireChild().timerSnapshot();
  }

  get pendingPauseRequestIds(): readonly number[] {
    return Object.freeze(Array.from(this.pendingPauseRequests));
  }

  /** Executes one independently scheduled callback; other pending callbacks remain armed. */
  firePauseRequest(pauseRequestId: number): readonly ClassicTossStrategyCommand[] {
    assertSafeInteger(pauseRequestId, 'pauseRequestId');
    if (!this.pendingPauseRequests.has(pauseRequestId)) {
      throw new Error(`unknown or already-fired pause request: ${pauseRequestId}`);
    }

    this.pendingPauseRequests.delete(pauseRequestId);
    this.requireChild().pause();
    return this.record([
      Object.freeze({
        type: 'pause-wave-child',
        controllerId: this.controllerId,
        childControllerId: this.childControllerId,
        reason: 'scheduled',
        pauseRequestId,
      }),
    ]);
  }

  protected buildTurnCommands(): readonly ClassicTossStrategyCommand[] {
    const child = this.requireChild();
    child.resume();

    if (this.nextPauseRequestId >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('Wave pause request ID space is exhausted');
    }
    const delaySeconds = sampleDecileInterval(this.random, this.activeWindow);
    const pauseRequestId = this.nextPauseRequestId;
    this.nextPauseRequestId += 1;
    this.pendingPauseRequests.add(pauseRequestId);

    return Object.freeze([
      Object.freeze({
        type: 'resume-wave-child',
        controllerId: this.controllerId,
        childControllerId: this.childControllerId,
      }),
      Object.freeze({
        type: 'schedule-wave-child-pause',
        controllerId: this.controllerId,
        childControllerId: this.childControllerId,
        pauseRequestId,
        delaySeconds,
      }),
    ]);
  }

  private requireChild(): ClassicFreeTossStrategy {
    if (this.child === null) {
      throw new Error('call setup() before using the Wave child');
    }
    return this.child;
  }
}

function readSpawnRequest(
  tossType: ClassicSpawnTossType,
  direction: ClassicTossDirection,
  viewport: ViewportSource,
  effectsEnabled: EffectsEnabledSource,
): ClassicSpawnRequest {
  const dimensions = viewport();
  if (dimensions === null || typeof dimensions !== 'object') {
    throw new TypeError('viewport() must return an object');
  }
  const effects = effectsEnabled();
  if (typeof effects !== 'boolean') {
    throw new TypeError('effectsEnabled() must return a boolean');
  }
  return Object.freeze({ tossType, direction, viewport: dimensions, effectsEnabled: effects });
}

function sampleDecileInterval(
  random: GameplayRandom,
  interval: TossStrategyInterval,
): number {
  const decile = random.nextDecile();
  if (!Number.isFinite(decile)) {
    throw new TypeError('nextDecile() must return a finite number');
  }
  const index = Math.round(decile * 10);
  if (index < 0 || index > 9 || Math.abs(decile - index / 10) > 1e-6) {
    throw new RangeError('nextDecile() must return one of 0.0, 0.1, ..., 0.9');
  }
  const floatDecile = Math.fround(index / 10);
  return Math.fround(
    interval.lowSeconds
    + floatDecile * (interval.highSeconds - interval.lowSeconds),
  );
}

function validateTimedOptions(options: TimedStrategyOptions): void {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('options must be an object');
  }
  if (typeof options.controllerId !== 'string' || options.controllerId.length === 0) {
    throw new TypeError('controllerId must be a non-empty string');
  }
  assertGameplayRandom(options.random);
  validateInterval(options.interval, 'interval');
  if (typeof options.createTimer !== 'function') {
    throw new TypeError('createTimer must be a function');
  }
  if (options.commandSink !== undefined && typeof options.commandSink !== 'function') {
    throw new TypeError('commandSink must be a function when provided');
  }
}

function validateSpawnStrategyOptions(options: ClassicFreeTossStrategyOptions): void {
  validateTimedOptions(options);
  if (options.planner === null || typeof options.planner !== 'object') {
    throw new TypeError('planner must be an object');
  }
  if (typeof options.planner.planSpawn !== 'function') {
    throw new TypeError('planner must provide planSpawn()');
  }
  if (options.planner.random !== options.random) {
    throw new Error('planner and strategy must share the same GameplayRandom instance');
  }
  assertClassicTossType(options.tossType);
  assertDirection(options.direction);
  if (typeof options.viewport !== 'function') {
    throw new TypeError('viewport must be a function');
  }
  if (typeof options.effectsEnabled !== 'function') {
    throw new TypeError('effectsEnabled must be a function');
  }
}

function validateInterval(interval: TossStrategyInterval, label: string): void {
  if (interval === null || typeof interval !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
  if (!Number.isFinite(interval.lowSeconds) || !Number.isFinite(interval.highSeconds)) {
    throw new TypeError(`${label} limits must be finite`);
  }
  if (interval.lowSeconds < 0 || interval.lowSeconds > interval.highSeconds) {
    throw new RangeError(`${label} must satisfy 0 <= lowSeconds <= highSeconds`);
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

function assertClassicTossType(value: number): asserts value is ClassicSpawnTossType {
  if (value !== 0 && value !== 1 && value !== 3 && value !== 4 && value !== 6) {
    throw new RangeError('Classic toss type must be 0, 1, 3, 4, or 6');
  }
}

function assertDirection(value: number): asserts value is ClassicTossDirection {
  if (value !== 0 && value !== 1 && value !== 2 && value !== 3) {
    throw new RangeError('direction must be 0, 1, 2, or 3');
  }
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}
