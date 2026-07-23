import type { GameplayRandom } from './gameplay-random';

export const STANDARD_BOMB_SMOKE_ATLAS_WIDTH = 1920 as const;
export const STANDARD_BOMB_SMOKE_ATLAS_HEIGHT = 256 as const;
export const STANDARD_BOMB_SMOKE_FRAME_SIZE = 128 as const;
export const STANDARD_BOMB_SMOKE_FRAME_COLUMNS = 15 as const;
export const STANDARD_BOMB_SMOKE_FRAME_COUNT = 30 as const;
export const STANDARD_BOMB_SMOKE_FRAME_SECONDS = Math.fround(0.033333335);
export const STANDARD_BOMB_SMOKE_LIFETIME_SECONDS = Math.fround(1);
export const STANDARD_BOMB_SMOKE_RANDOM_GATE_MAXIMUM = 6 as const;

const STANDARD_BOMB_SMOKE_RANDOM_GATE_SUCCESS = 0;

export interface StandardBombSmokePoint {
  readonly x: number;
  readonly y: number;
}

export interface StandardBombSmokeFrameRect {
  readonly height: typeof STANDARD_BOMB_SMOKE_FRAME_SIZE;
  readonly width: typeof STANDARD_BOMB_SMOKE_FRAME_SIZE;
  readonly x: number;
  readonly y: number;
}

export interface StandardBombSmokeEmissionInput {
  readonly bombAngleRadians: number;
  readonly bombWorldPosition: StandardBombSmokePoint;
  readonly spriteHeightWorldUnits: number;
}

export interface StandardBombSmokeEmission {
  readonly frameIndex: 0;
  readonly position: StandardBombSmokePoint;
}

export interface StandardBombSmokeEmitterSnapshot {
  readonly stopped: boolean;
}

export interface StandardBombSmokeAnimationSnapshot {
  readonly elapsedActionSeconds: number;
  readonly finished: boolean;
  readonly frameIndex: number | null;
  readonly frameRect: StandardBombSmokeFrameRect | null;
}

export interface StandardBombSmokeAnimationUpdate {
  readonly finishedNow: boolean;
  readonly snapshot: StandardBombSmokeAnimationSnapshot;
}

export type StandardBombSmokeRandom = Pick<GameplayRandom, 'nextIntInclusive'>;

/**
 * Per-Bomb intact-fuse gate. The host calls this exactly once for every scheduled Bomb update
 * while the native cut flag is clear; it deliberately shares the process gameplay RNG.
 */
export class StandardBombSmokeEmitterState {
  private readonly random: StandardBombSmokeRandom;
  private stoppedValue = false;

  constructor(random: StandardBombSmokeRandom) {
    if (
      random === null
      || typeof random !== 'object'
      || typeof random.nextIntInclusive !== 'function'
    ) {
      throw new TypeError('random must provide nextIntInclusive()');
    }
    this.random = random;
  }

  snapshot(): StandardBombSmokeEmitterSnapshot {
    return Object.freeze({ stopped: this.stoppedValue });
  }

  stop(): boolean {
    const changed = !this.stoppedValue;
    this.stoppedValue = true;
    return changed;
  }

  updateScheduled(
    input: StandardBombSmokeEmissionInput,
  ): StandardBombSmokeEmission | null {
    assertEmissionInput(input);
    if (this.stoppedValue) {
      return null;
    }
    const gate = drawInclusive(
      this.random,
      STANDARD_BOMB_SMOKE_RANDOM_GATE_SUCCESS,
      STANDARD_BOMB_SMOKE_RANDOM_GATE_MAXIMUM,
    );
    if (gate !== STANDARD_BOMB_SMOKE_RANDOM_GATE_SUCCESS) {
      return null;
    }
    const halfHeight = input.spriteHeightWorldUnits * 0.5;
    const sine = Math.sin(input.bombAngleRadians);
    const cosine = Math.cos(input.bombAngleRadians);
    return Object.freeze({
      frameIndex: 0 as const,
      position: frozenPoint(
        input.bombWorldPosition.x - sine * halfHeight,
        input.bombWorldPosition.y + cosine * halfHeight,
      ),
    });
  }
}

/** Repeating 30-frame smoke animation with its independent one-second removal clock. */
export class StandardBombSmokeAnimationState {
  private elapsedActionSecondsValue = 0;
  private finishedValue = false;

  snapshot(): StandardBombSmokeAnimationSnapshot {
    if (this.finishedValue) {
      return Object.freeze({
        elapsedActionSeconds: this.elapsedActionSecondsValue,
        finished: true,
        frameIndex: null,
        frameRect: null,
      });
    }
    const frameIndex = Math.floor(
      this.elapsedActionSecondsValue / STANDARD_BOMB_SMOKE_FRAME_SECONDS,
    ) % STANDARD_BOMB_SMOKE_FRAME_COUNT;
    return Object.freeze({
      elapsedActionSeconds: this.elapsedActionSecondsValue,
      finished: false,
      frameIndex,
      frameRect: frameRectForIndex(frameIndex),
    });
  }

  updateAction(deltaSeconds: number): StandardBombSmokeAnimationUpdate {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (this.finishedValue) {
      return Object.freeze({
        finishedNow: false,
        snapshot: this.snapshot(),
      });
    }
    this.elapsedActionSecondsValue = Math.min(
      STANDARD_BOMB_SMOKE_LIFETIME_SECONDS,
      this.elapsedActionSecondsValue + deltaSeconds,
    );
    const finishedNow = (
      this.elapsedActionSecondsValue >= STANDARD_BOMB_SMOKE_LIFETIME_SECONDS
    );
    if (finishedNow) {
      this.finishedValue = true;
    }
    return Object.freeze({
      finishedNow,
      snapshot: this.snapshot(),
    });
  }
}

export function frameRectForIndex(frameIndex: number): StandardBombSmokeFrameRect {
  if (
    !Number.isSafeInteger(frameIndex)
    || frameIndex < 0
    || frameIndex >= STANDARD_BOMB_SMOKE_FRAME_COUNT
  ) {
    throw new RangeError('frameIndex must identify a standard Bomb smoke frame from 0 to 29');
  }
  return Object.freeze({
    height: STANDARD_BOMB_SMOKE_FRAME_SIZE,
    width: STANDARD_BOMB_SMOKE_FRAME_SIZE,
    x: (frameIndex % STANDARD_BOMB_SMOKE_FRAME_COLUMNS) * STANDARD_BOMB_SMOKE_FRAME_SIZE,
    y: Math.floor(frameIndex / STANDARD_BOMB_SMOKE_FRAME_COLUMNS)
      * STANDARD_BOMB_SMOKE_FRAME_SIZE,
  });
}

function assertEmissionInput(input: StandardBombSmokeEmissionInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('input must be an object');
  }
  assertFinitePoint(input.bombWorldPosition, 'bombWorldPosition');
  assertFinite(input.bombAngleRadians, 'bombAngleRadians');
  if (
    !Number.isFinite(input.spriteHeightWorldUnits)
    || input.spriteHeightWorldUnits <= 0
  ) {
    throw new RangeError('spriteHeightWorldUnits must be finite and positive');
  }
}

function assertFinitePoint(point: StandardBombSmokePoint, label: string): void {
  if (
    point === null
    || typeof point !== 'object'
    || !Number.isFinite(point.x)
    || !Number.isFinite(point.y)
  ) {
    throw new RangeError(`${label} must contain finite x/y`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function drawInclusive(
  random: StandardBombSmokeRandom,
  minimum: number,
  maximum: number,
): number {
  const value = random.nextIntInclusive(minimum, maximum);
  if (
    !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    throw new RangeError(
      `random returned ${String(value)} outside inclusive range ${minimum}...${maximum}`,
    );
  }
  return value;
}

function frozenPoint(x: number, y: number): StandardBombSmokePoint {
  return Object.freeze({ x, y });
}
