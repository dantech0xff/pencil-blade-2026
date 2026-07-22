/** Recovered Classic world-speed state; action/toss clocks remain unscaled. */

export const CLASSIC_INITIAL_WORLD_SPEED = Math.fround(1);
export const CLASSIC_FROZEN_WORLD_SPEED = Math.fround(0.5);
export const CLASSIC_SPEED_INCREMENT = Math.fround(0.1);
export const CLASSIC_SPEED_LIMIT = Math.fround(2);
export const CLASSIC_SPEED_UP_DELAY_SECONDS = 30 as const;

export type ClassicWorldSpeedCommand =
  | Readonly<{ type: 'set-world-speed'; value: number }>
  | Readonly<{
      type: 'schedule-speed-up-callback';
      delaySeconds: typeof CLASSIC_SPEED_UP_DELAY_SECONDS;
    }>;

const NO_WORLD_SPEED_COMMANDS: readonly ClassicWorldSpeedCommand[] = Object.freeze([]);

export interface ClassicWorldSpeedSnapshot {
  readonly speed: number;
  readonly speedUpEnabled: boolean;
}

/**
 * Models only the recovered Box2D-step multiplier and its 30-second Classic action.
 * It deliberately does not scale toss timers, actions, combo time, or presentation time.
 */
export class ClassicWorldSpeed {
  private speedValue = CLASSIC_INITIAL_WORLD_SPEED;
  private speedUpEnabledValue = false;

  snapshot(): ClassicWorldSpeedSnapshot {
    return Object.freeze({
      speed: this.speedValue,
      speedUpEnabled: this.speedUpEnabledValue,
    });
  }

  /** Classic arms the first delay at scene entry, before its intro completes. */
  enableClassicSpeedUp(): readonly ClassicWorldSpeedCommand[] {
    this.speedUpEnabledValue = true;
    return Object.freeze([
      Object.freeze({
        type: 'schedule-speed-up-callback',
        delaySeconds: CLASSIC_SPEED_UP_DELAY_SECONDS,
      }),
    ]);
  }

  /**
   * Uses the recovered strict pre-add comparison. Every successful addition rearms once,
   * including the addition that reaches or slightly exceeds 2.0 in float32.
   */
  speedUpDelayComplete(): readonly ClassicWorldSpeedCommand[] {
    if (!this.speedUpEnabledValue || this.speedValue >= CLASSIC_SPEED_LIMIT) {
      return NO_WORLD_SPEED_COMMANDS;
    }

    this.speedValue = Math.fround(this.speedValue + CLASSIC_SPEED_INCREMENT);
    return Object.freeze([
      Object.freeze({ type: 'set-world-speed', value: this.speedValue }),
      Object.freeze({
        type: 'schedule-speed-up-callback',
        delaySeconds: CLASSIC_SPEED_UP_DELAY_SECONDS,
      }),
    ]);
  }

  /** Shared recovered operation; standard Classic activation of freeze remains unknown. */
  freeze(): readonly ClassicWorldSpeedCommand[] {
    return this.setDirectSpeed(CLASSIC_FROZEN_WORLD_SPEED);
  }

  /** Shared recovered operation; restores exactly 1.0 rather than a previous speed. */
  unfreeze(): readonly ClassicWorldSpeedCommand[] {
    return this.setDirectSpeed(CLASSIC_INITIAL_WORLD_SPEED);
  }

  /** The native setter stores one float without a recovered clamp. */
  setDirectSpeed(value: number): readonly ClassicWorldSpeedCommand[] {
    assertFinite(value, 'world speed');
    const floatValue = Math.fround(value);
    assertFinite(floatValue, 'world speed');
    this.speedValue = floatValue;
    return Object.freeze([
      Object.freeze({ type: 'set-world-speed', value: this.speedValue }),
    ]);
  }

  /** Native Step receives float32(frameDelta * worldSpeed). */
  physicsStepDelta(frameDeltaSeconds: number): number {
    assertFiniteNonNegative(frameDeltaSeconds, 'frameDeltaSeconds');
    const delta = Math.fround(frameDeltaSeconds);
    assertFinite(delta, 'frameDeltaSeconds');
    return Math.fround(delta * this.speedValue);
  }
}

function assertFiniteNonNegative(value: number, label: string): void {
  assertFinite(value, label);
  if (value < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}
