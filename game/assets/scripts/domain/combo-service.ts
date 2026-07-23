/** Recovered rolling combo state and ordered application commands. */

export const COMBO_WINDOW_SECONDS = Math.fround(0.25);
export const COMBO_OBJECTIVE_EVENT_ID = 0;

export interface ComboPosition {
  readonly x: number;
  readonly y: number;
}

/** A GameplayRandom instance satisfies this structural, shared-stream seam. */
export interface ComboRandom {
  nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number;
}

export type ComboSoundIndex = 1 | 2 | 3;

export type ComboCommand =
  | Readonly<{ type: 'process-objective'; eventId: 0; count: number }>
  | Readonly<{ type: 'create-combo-item'; count: number; position: ComboPosition }>
  | Readonly<{ type: 'add-score'; value: number }>
  | Readonly<{ type: 'attach-combo-item'; zOrder: 1 }>
  | Readonly<{ type: 'play-combo-sound'; soundIndex: ComboSoundIndex }>
  | Readonly<{ type: 'reset-combo' }>;

export interface ComboSnapshot {
  readonly active: boolean;
  readonly count: number;
  readonly currentClockSeconds: number;
  readonly latestPosition: ComboPosition;
  readonly startClockSeconds: number;
}

export type ComboCommandBatchFailurePhase = 'apply' | 'finalize' | 'publish';

export interface ComboCommandBatchFailure {
  readonly command: ComboCommand | null;
  readonly error: unknown;
  readonly phase: ComboCommandBatchFailurePhase;
}

export interface ComboCommandBatchPort {
  readonly apply: (command: ComboCommand) => void;
  readonly finalize: () => void;
  readonly publish: (command: ComboCommand) => void;
}

export class ComboCommandBatchError extends Error {
  readonly failures: readonly ComboCommandBatchFailure[];

  constructor(failures: readonly ComboCommandBatchFailure[]) {
    super(
      `Combo command batch failed at ${failures.length} boundary/boundaries: `
        + failures.map(({ error, phase }) => `${phase}: ${errorMessage(error)}`).join('; '),
    );
    this.name = 'ComboCommandBatchError';
    this.failures = Object.freeze(failures.map((failure) => Object.freeze({
      ...failure,
    })));
  }
}

const NO_COMBO_COMMANDS: readonly ComboCommand[] = Object.freeze([]);
const ZERO_POSITION: ComboPosition = Object.freeze({ x: 0, y: 0 });

export class ComboService {
  private readonly random: ComboRandom;
  private activeValue = false;
  private countValue = 0;
  private currentClockSecondsValue = Math.fround(0);
  private pendingCommandsValue: readonly ComboCommand[] | null = null;
  private startClockSecondsValue = Math.fround(0);
  private latestPositionValue: ComboPosition = ZERO_POSITION;

  constructor(random: ComboRandom) {
    if (random === null || typeof random !== 'object' || typeof random.nextIntInclusive !== 'function') {
      throw new TypeError('random must provide nextIntInclusive(minimum, maximum)');
    }
    this.random = random;
  }

  snapshot(): ComboSnapshot {
    return Object.freeze({
      active: this.activeValue,
      count: this.countValue,
      currentClockSeconds: this.currentClockSecondsValue,
      latestPosition: copyPosition(this.latestPositionValue),
      startClockSeconds: this.startClockSecondsValue,
    });
  }

  checkCombo(position: ComboPosition): void {
    const nextPosition = copyPosition(position);
    this.countValue = checkedIncrement(this.countValue, 'combo count');
    this.latestPositionValue = nextPosition;
    this.startClockSecondsValue = this.currentClockSecondsValue;
    this.activeValue = true;
  }

  /**
   * The native API receives float delta, accumulates float32, and closes only
   * when the float32 clock difference is strictly greater than 0.25 seconds.
   */
  update(deltaSeconds: number, effectsEnabled: boolean): readonly ComboCommand[] {
    const delta = toNonNegativeFloat32(deltaSeconds, 'deltaSeconds');
    assertBoolean(effectsEnabled, 'effectsEnabled');

    if (this.pendingCommandsValue !== null) {
      return this.pendingCommandsValue;
    }
    if (!this.activeValue) {
      // Recovered inactive updates keep the start clock aligned to the current clock.
      this.startClockSecondsValue = this.currentClockSecondsValue;
      return NO_COMBO_COMMANDS;
    }

    const nextClock = Math.fround(this.currentClockSecondsValue + delta);
    assertFinite(nextClock, 'combo clock');
    this.currentClockSecondsValue = nextClock;
    const elapsed = Math.fround(
      this.currentClockSecondsValue - this.startClockSecondsValue,
    );
    if (elapsed <= COMBO_WINDOW_SECONDS) {
      return NO_COMBO_COMMANDS;
    }

    const commands: ComboCommand[] = [];
    if (this.countValue >= 3) {
      const count = this.countValue;
      commands.push(Object.freeze({
        type: 'process-objective',
        eventId: COMBO_OBJECTIVE_EVENT_ID,
        count,
      }));
      commands.push(Object.freeze({
        type: 'create-combo-item',
        count,
        position: copyPosition(this.latestPositionValue),
      }));
      commands.push(Object.freeze({ type: 'add-score', value: count }));
      commands.push(Object.freeze({ type: 'attach-combo-item', zOrder: 1 }));

      if (effectsEnabled) {
        // This draw intentionally follows score and attachment in the shared RNG stream.
        const soundIndex = this.random.nextIntInclusive(1, 3);
        assertComboSoundIndex(soundIndex);
        commands.push(Object.freeze({ type: 'play-combo-sound', soundIndex }));
      }
    }

    commands.push(Object.freeze({ type: 'reset-combo' }));
    // Rotate immediately so a synchronous command/event listener can record a new cut without
    // that new accumulator being erased when the closing batch is acknowledged.
    this.resetData();
    this.pendingCommandsValue = Object.freeze(commands);
    return this.pendingCommandsValue;
  }

  /**
   * Acknowledges the exact rotated batch returned by update(). The live accumulator was already
   * replaced atomically, so this must never reset cuts accepted by synchronous command listeners.
   */
  commitPendingUpdate(commands: readonly ComboCommand[]): void {
    this.assertPendingUpdate(commands);
    this.pendingCommandsValue = null;
  }

  /** Preflight used before any adapter side effect so an identity mismatch is never replayable. */
  assertPendingUpdate(commands: readonly ComboCommand[]): void {
    if (this.pendingCommandsValue === null) {
      throw new Error('Combo has no pending update to commit');
    }
    if (commands !== this.pendingCommandsValue) {
      throw new Error('Combo can commit only the exact pending update batch');
    }
  }

  private resetData(): void {
    this.countValue = 0;
    this.currentClockSecondsValue = Math.fround(0);
    this.startClockSecondsValue = Math.fround(0);
    this.activeValue = false;
    this.latestPositionValue = ZERO_POSITION;
  }
}

/**
 * Applies every native command once, finalizes transient presentation ownership, then publishes
 * the complete ordered trace. A post-commit observer or optional presentation/audio failure
 * cannot skip the authoritative score/objective suffix or make the batch replay next frame.
 */
export function applyComboCommandBatch(
  commands: readonly ComboCommand[],
  port: ComboCommandBatchPort,
): void {
  assertComboCommandBatchPort(port);
  if (commands.length === 0) {
    return;
  }
  assertComboCommandBatchShape(commands);

  const failures: ComboCommandBatchFailure[] = [];
  let acknowledgementFailed = false;
  for (const command of commands) {
    const failureCountBefore = failures.length;
    collectComboCommandFailure(failures, command, 'apply', () => port.apply(command));
    if (command.type === 'reset-combo' && failures.length > failureCountBefore) {
      acknowledgementFailed = true;
    }
  }
  collectComboCommandFailure(failures, null, 'finalize', () => port.finalize());
  if (acknowledgementFailed) {
    throw new ComboCommandBatchError(failures);
  }
  for (const command of commands) {
    collectComboCommandFailure(failures, command, 'publish', () => port.publish(command));
  }
  if (failures.length > 0) {
    throw new ComboCommandBatchError(failures);
  }
}

function copyPosition(position: ComboPosition): ComboPosition {
  if (position === null || typeof position !== 'object') {
    throw new TypeError('position must be an object');
  }
  const x = toFloat32(position.x, 'position.x');
  const y = toFloat32(position.y, 'position.y');
  return Object.freeze({ x, y });
}

/** Target-only validation rejects malformed adapter input before state is changed. */
function toFloat32(value: number, label: string): number {
  assertFinite(value, label);
  const floatValue = Math.fround(value);
  assertFinite(floatValue, label);
  return floatValue;
}

function toNonNegativeFloat32(value: number, label: string): number {
  assertFinite(value, label);
  if (value < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
  const floatValue = toFloat32(value, label);
  return floatValue;
}

function checkedIncrement(value: number, label: string): number {
  const result = value + 1;
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${label} exceeds the safe integer range`);
  }
  return result;
}

function assertComboSoundIndex(value: number): asserts value is ComboSoundIndex {
  if (!Number.isInteger(value) || value < 1 || value > 3) {
    throw new RangeError('nextIntInclusive(1, 3) must return an integer from 1 through 3');
  }
}

function assertBoolean(value: boolean, label: string): void {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be a boolean`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}

function assertComboCommandBatchPort(port: ComboCommandBatchPort): void {
  if (
    port === null
    || typeof port !== 'object'
    || typeof port.apply !== 'function'
    || typeof port.finalize !== 'function'
    || typeof port.publish !== 'function'
  ) {
    throw new TypeError(
      'Combo command batch port must provide apply(), finalize(), and publish()',
    );
  }
}

function assertComboCommandBatchShape(commands: readonly ComboCommand[]): void {
  const types = commands.map(({ type }) => type);
  const valid = (
    (types.length === 1 && types[0] === 'reset-combo')
    || (
      (types.length === 5 || types.length === 6)
      && types[0] === 'process-objective'
      && types[1] === 'create-combo-item'
      && types[2] === 'add-score'
      && types[3] === 'attach-combo-item'
      && (
        (types.length === 5 && types[4] === 'reset-combo')
        || (
          types.length === 6
          && types[4] === 'play-combo-sound'
          && types[5] === 'reset-combo'
        )
      )
    )
  );
  if (!valid) {
    throw new Error(`Invalid Combo command batch shape: ${types.join(', ')}`);
  }
}

function collectComboCommandFailure(
  failures: ComboCommandBatchFailure[],
  command: ComboCommand | null,
  phase: ComboCommandBatchFailurePhase,
  operation: () => void,
): void {
  try {
    operation();
  } catch (error) {
    failures.push(Object.freeze({ command, error, phase }));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
