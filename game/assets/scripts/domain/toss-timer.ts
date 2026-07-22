/** Minimal structural random port so this pure module can be loaded in isolation. */
export interface TossTimerRandom {
  nextDecile(): number;
}

export interface TossTimerOptions {
  readonly random: TossTimerRandom;
  readonly lowSeconds: number;
  readonly highSeconds: number;
  readonly onTossTurn: () => void;
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite`);
  }
  if (value < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
}

function validateLimits(lowSeconds: number, highSeconds: number): void {
  assertFiniteNonNegative(lowSeconds, 'lowSeconds');
  assertFiniteNonNegative(highSeconds, 'highSeconds');
  if (lowSeconds > highSeconds) {
    throw new RangeError('lowSeconds must be less than or equal to highSeconds');
  }
}

function recoveredDecileAsFloat32(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError('nextDecile() must return a finite number');
  }

  const decileIndex = Math.round(value * 10);
  const canonicalValue = decileIndex / 10;
  if (
    decileIndex < 0
    || decileIndex > 9
    || Math.abs(value - canonicalValue) > 1e-6
  ) {
    throw new RangeError('nextDecile() must return one of 0.0, 0.1, ..., 0.9');
  }

  return Math.fround(canonicalValue);
}

/**
 * Recovered interval formula. Limits remain JavaScript doubles, the decile crosses the native
 * float boundary, and the returned armed interval is explicitly rounded to float32.
 */
export function sampleTossInterval(
  random: TossTimerRandom,
  lowSeconds: number,
  highSeconds: number,
): number {
  validateLimits(lowSeconds, highSeconds);
  if (
    random === null
    || typeof random !== 'object'
    || typeof random.nextDecile !== 'function'
  ) {
    throw new TypeError('random must provide nextDecile()');
  }

  const decile = recoveredDecileAsFloat32(random.nextDecile());
  return Math.fround(lowSeconds + decile * (highSeconds - lowSeconds));
}

/**
 * Pure TypeScript port of the recovered `TossTurn` scheduler state.
 *
 * Recovered behavior: strict `elapsed > threshold`, discarded overshoot, rearm before the
 * callback, Start resampling without elapsed reset, Pause/Resume/Stop preservation, and a
 * no-op Restart. Input validation and the boolean `tick` result are target-side safeguards.
 */
export class TossTimer {
  private readonly random: TossTimerRandom;
  private readonly onTossTurn: () => void;
  private lowLimitSeconds: number;
  private highLimitSeconds: number;
  private elapsedValueSeconds = Math.fround(0);
  private thresholdValueSeconds: number | null = null;
  private scheduledValue = false;

  constructor(options: TossTimerOptions) {
    if (options === null || typeof options !== 'object') {
      throw new TypeError('options must be an object');
    }
    if (typeof options.onTossTurn !== 'function') {
      throw new TypeError('onTossTurn must be a function');
    }
    if (
      options.random === null
      || typeof options.random !== 'object'
      || typeof options.random.nextDecile !== 'function'
    ) {
      throw new TypeError('random must provide nextDecile()');
    }

    validateLimits(options.lowSeconds, options.highSeconds);
    this.random = options.random;
    this.onTossTurn = options.onTossTurn;
    this.lowLimitSeconds = options.lowSeconds;
    this.highLimitSeconds = options.highSeconds;
  }

  get lowSeconds(): number {
    return this.lowLimitSeconds;
  }

  get highSeconds(): number {
    return this.highLimitSeconds;
  }

  get elapsedSeconds(): number {
    return this.elapsedValueSeconds;
  }

  get thresholdSeconds(): number | null {
    return this.thresholdValueSeconds;
  }

  get scheduled(): boolean {
    return this.scheduledValue;
  }

  /** Changes only the limits used by the next Start or expiry rearm. */
  setLimits(lowSeconds: number, highSeconds: number): void {
    validateLimits(lowSeconds, highSeconds);
    this.lowLimitSeconds = lowSeconds;
    this.highLimitSeconds = highSeconds;
  }

  start(): void {
    this.scheduledValue = true;
    this.thresholdValueSeconds = this.sampleInterval();
  }

  pause(): void {
    this.scheduledValue = false;
  }

  resume(): void {
    this.scheduledValue = true;
  }

  stop(): void {
    this.scheduledValue = false;
  }

  /** Recovered `Restart()` behavior is intentionally empty. */
  restart(): void {
    // No state change and no random draw.
  }

  /**
   * Advances a scheduled timer. Returns true only when this tick fired one turn.
   * The native float `dt` and stored elapsed value are represented with float32 boundaries.
   */
  tick(deltaSeconds: number): boolean {
    assertFiniteNonNegative(deltaSeconds, 'deltaSeconds');
    if (!this.scheduledValue) {
      return false;
    }
    if (this.thresholdValueSeconds === null) {
      throw new Error('timer has no armed threshold; call start() before resume()');
    }

    const floatDelta = Math.fround(deltaSeconds);
    if (!Number.isFinite(floatDelta)) {
      throw new RangeError('deltaSeconds is outside the float32 range');
    }

    this.elapsedValueSeconds = Math.fround(this.elapsedValueSeconds + floatDelta);
    if (this.elapsedValueSeconds <= this.thresholdValueSeconds) {
      return false;
    }

    this.elapsedValueSeconds = Math.fround(0);
    this.thresholdValueSeconds = this.sampleInterval();
    this.onTossTurn();
    return true;
  }

  private sampleInterval(): number {
    return sampleTossInterval(
      this.random,
      this.lowLimitSeconds,
      this.highLimitSeconds,
    );
  }
}
