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

const NO_COMBO_COMMANDS: readonly ComboCommand[] = Object.freeze([]);
const ZERO_POSITION: ComboPosition = Object.freeze({ x: 0, y: 0 });

export class ComboService {
  private readonly random: ComboRandom;
  private activeValue = false;
  private countValue = 0;
  private currentClockSecondsValue = Math.fround(0);
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
    this.resetData();
    return Object.freeze(commands);
  }

  private resetData(): void {
    this.countValue = 0;
    this.currentClockSecondsValue = Math.fround(0);
    this.startClockSecondsValue = Math.fround(0);
    this.activeValue = false;
    this.latestPositionValue = ZERO_POSITION;
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
