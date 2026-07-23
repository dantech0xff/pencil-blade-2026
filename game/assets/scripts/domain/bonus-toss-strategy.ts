import type { GameplayRandom } from './gameplay-random';
import type {
  TossStrategyInterval,
  TossStrategyTimer,
  TossStrategyTimerFactory,
  TossStrategyTimerSnapshot,
} from './classic-toss-strategies';
import type { ClassicTossDirection } from './spawn-kinematics';

export const BONUS_TOSS_CANDIDATE_FRUIT_IDS = Object.freeze([
  12,
  10,
  11,
] as const);
export const BONUS_TOSS_TYPE = 5 as const;
export const BONUS_TOSS_Z_ORDER = 1 as const;
export const BONUS_TOSS_AUDIO_PATH = 'Sounds/tossfruit.wav' as const;

const NO_COMMANDS: readonly BonusTossCommand[] = Object.freeze([]);

export type BonusTossFruitId = (typeof BONUS_TOSS_CANDIDATE_FRUIT_IDS)[number];
export type BonusTossDirection = Extract<ClassicTossDirection, 1 | 2 | 3>;

export interface BonusTossStatePort {
  isEnabled(bonusId: BonusTossFruitId): boolean;
}

export type BonusTossCommand =
  | Readonly<{
      type: 'create-bonus-fruit';
      controllerId: string;
      entityOccurrenceId: number;
      fruitId: BonusTossFruitId;
      tossType: typeof BONUS_TOSS_TYPE;
    }>
  | Readonly<{
      type: 'randomize-bonus-fruit';
      controllerId: string;
      direction: BonusTossDirection;
      entityOccurrenceId: number;
    }>
  | Readonly<{
      type: 'attach-bonus-fruit';
      controllerId: string;
      entityOccurrenceId: number;
      zOrder: typeof BONUS_TOSS_Z_ORDER;
    }>
  | Readonly<{
      type: 'enable-bonus';
      bonusId: BonusTossFruitId;
      entityOccurrenceId: number;
    }>
  | Readonly<{
      type: 'request-bonus-toss-audio';
      canonicalPath: typeof BONUS_TOSS_AUDIO_PATH;
      entityOccurrenceId: number;
      loop: false;
    }>;

export type BonusTossCommandSink = (
  commands: readonly BonusTossCommand[],
) => void;

export interface BonusTossStrategyOptions {
  readonly bonusState: BonusTossStatePort;
  readonly commandSink?: BonusTossCommandSink;
  readonly controllerId: string;
  readonly createTimer: TossStrategyTimerFactory;
  readonly effectsEnabled: () => boolean;
  readonly firstEntityOccurrenceId?: number;
  readonly interval: TossStrategyInterval;
  readonly random: GameplayRandom;
}

/**
 * Pure command planner for the recovered type-5 BonusToss.
 *
 * Candidate retry and direction draws share the injected gameplay RNG with the timer. The
 * all-enabled path deliberately returns before allocating an occurrence ID or reading RNG.
 */
export class BonusTossStrategy {
  readonly controllerId: string;
  readonly random: GameplayRandom;

  private readonly bonusStateValue: BonusTossStatePort;
  private readonly commandLogValue: BonusTossCommand[] = [];
  private readonly commandSinkValue: BonusTossCommandSink | null;
  private readonly effectsEnabledValue: () => boolean;
  private nextEntityOccurrenceIdValue: number;
  private readonly timerValue: TossStrategyTimer;

  constructor(options: BonusTossStrategyOptions) {
    validateOptions(options);
    this.controllerId = options.controllerId;
    this.random = options.random;
    this.bonusStateValue = options.bonusState;
    this.commandSinkValue = options.commandSink ?? null;
    this.effectsEnabledValue = options.effectsEnabled;
    this.nextEntityOccurrenceIdValue = options.firstEntityOccurrenceId ?? 1;
    this.timerValue = options.createTimer({
      random: this.random,
      lowSeconds: options.interval.lowSeconds,
      highSeconds: options.interval.highSeconds,
      onTossTurn: () => {
        this.performTurn();
      },
    });
    assertTimer(this.timerValue);
  }

  get commandLog(): readonly BonusTossCommand[] {
    return Object.freeze([...this.commandLogValue]);
  }

  get nextEntityOccurrenceId(): number {
    return this.nextEntityOccurrenceIdValue;
  }

  timerSnapshot(): TossStrategyTimerSnapshot {
    return Object.freeze({
      elapsedSeconds: this.timerValue.elapsedSeconds,
      thresholdSeconds: this.timerValue.thresholdSeconds,
      scheduled: this.timerValue.scheduled,
    });
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
    assertFiniteNonNegative(deltaSeconds, 'deltaSeconds');
    return this.timerValue.tick(deltaSeconds);
  }

  /** Direct `OnTossTurn` seam; a timer-driven turn has already rearmed before reaching it. */
  performTurn(): readonly BonusTossCommand[] {
    const allEnabled = BONUS_TOSS_CANDIDATE_FRUIT_IDS.every((bonusId) => (
      readBonusEnabled(this.bonusStateValue, bonusId)
    ));
    if (allEnabled) {
      return NO_COMMANDS;
    }
    if (this.nextEntityOccurrenceIdValue >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('entity occurrence ID space is exhausted');
    }

    let bonusId: BonusTossFruitId;
    do {
      const candidateIndex = drawInclusive(
        this.random,
        0,
        BONUS_TOSS_CANDIDATE_FRUIT_IDS.length - 1,
      );
      bonusId = BONUS_TOSS_CANDIDATE_FRUIT_IDS[candidateIndex];
    } while (readBonusEnabled(this.bonusStateValue, bonusId));

    const directionDraw = drawInclusive(this.random, 0, 3);
    const direction = directionForDraw(directionDraw);
    const effectsEnabled = readEffectsEnabled(this.effectsEnabledValue);
    const entityOccurrenceId = this.nextEntityOccurrenceIdValue;

    const commands: BonusTossCommand[] = [
      Object.freeze({
        type: 'create-bonus-fruit',
        controllerId: this.controllerId,
        entityOccurrenceId,
        fruitId: bonusId,
        tossType: BONUS_TOSS_TYPE,
      }),
      Object.freeze({
        type: 'randomize-bonus-fruit',
        controllerId: this.controllerId,
        direction,
        entityOccurrenceId,
      }),
      Object.freeze({
        type: 'attach-bonus-fruit',
        controllerId: this.controllerId,
        entityOccurrenceId,
        zOrder: BONUS_TOSS_Z_ORDER,
      }),
      Object.freeze({
        type: 'enable-bonus',
        bonusId,
        entityOccurrenceId,
      }),
    ];
    if (effectsEnabled) {
      commands.push(Object.freeze({
        type: 'request-bonus-toss-audio',
        canonicalPath: BONUS_TOSS_AUDIO_PATH,
        entityOccurrenceId,
        loop: false,
      }));
    }

    this.nextEntityOccurrenceIdValue += 1;
    return this.record(commands);
  }

  private record(
    commands: readonly BonusTossCommand[],
  ): readonly BonusTossCommand[] {
    const immutableBatch = Object.freeze([...commands]);
    this.commandLogValue.push(...immutableBatch);
    this.commandSinkValue?.(immutableBatch);
    return immutableBatch;
  }
}

function directionForDraw(draw: number): BonusTossDirection {
  switch (draw) {
    case 0:
      return 2;
    case 1:
      return 3;
    case 2:
    case 3:
      return 1;
    default:
      throw new RangeError('bonus direction draw must be 0, 1, 2, or 3');
  }
}

function validateOptions(options: BonusTossStrategyOptions): void {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('options must be an object');
  }
  if (typeof options.controllerId !== 'string' || options.controllerId.length === 0) {
    throw new TypeError('controllerId must be a non-empty string');
  }
  assertGameplayRandom(options.random);
  validateInterval(options.interval);
  if (typeof options.createTimer !== 'function') {
    throw new TypeError('createTimer must be a function');
  }
  if (typeof options.effectsEnabled !== 'function') {
    throw new TypeError('effectsEnabled must be a function');
  }
  if (
    options.bonusState === null
    || typeof options.bonusState !== 'object'
    || typeof options.bonusState.isEnabled !== 'function'
  ) {
    throw new TypeError('bonusState must provide isEnabled()');
  }
  if (options.commandSink !== undefined && typeof options.commandSink !== 'function') {
    throw new TypeError('commandSink must be a function when provided');
  }
  assertPositiveSafeInteger(
    options.firstEntityOccurrenceId ?? 1,
    'firstEntityOccurrenceId',
  );
}

function validateInterval(interval: TossStrategyInterval): void {
  if (interval === null || typeof interval !== 'object') {
    throw new TypeError('interval must be an object');
  }
  if (!Number.isFinite(interval.lowSeconds) || !Number.isFinite(interval.highSeconds)) {
    throw new TypeError('interval limits must be finite');
  }
  if (interval.lowSeconds < 0 || interval.lowSeconds > interval.highSeconds) {
    throw new RangeError('interval must satisfy 0 <= lowSeconds <= highSeconds');
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

function readBonusEnabled(
  bonusState: BonusTossStatePort,
  bonusId: BonusTossFruitId,
): boolean {
  const enabled = bonusState.isEnabled(bonusId);
  if (typeof enabled !== 'boolean') {
    throw new TypeError('bonusState.isEnabled() must return a boolean');
  }
  return enabled;
}

function readEffectsEnabled(source: () => boolean): boolean {
  const enabled = source();
  if (typeof enabled !== 'boolean') {
    throw new TypeError('effectsEnabled() must return a boolean');
  }
  return enabled;
}

function drawInclusive(
  random: GameplayRandom,
  min: number,
  max: number,
): number {
  const value = random.nextIntInclusive(min, max);
  if (!Number.isSafeInteger(value)) {
    throw new TypeError('nextIntInclusive() must return a safe integer');
  }
  if (value < min || value > max) {
    throw new RangeError(`nextIntInclusive() returned ${value} outside [${min}, ${max}]`);
  }
  return value;
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
