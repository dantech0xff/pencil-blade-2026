import {
  createBirdBladeParticleUpdateCommands,
  type BirdBladeParticleSpawnCommand,
} from './bird-blade-particle-plan';
import type { GameplayRandom } from './gameplay-random';

/** Default recovered BirdBlade visual type retained for Classic Bird callers. */
export const BIRD_BLADE_TYPE = 1 as const;
export const BIRD_BLADE_IDLE_STATE = 0 as const;
export const BIRD_BLADE_MOVING_STATE = 1 as const;
export const BIRD_BLADE_SETTLE_STATE = 2 as const;
export const BIRD_BLADE_RAY_GATE_MAXIMUM = 3 as const;

export type BirdBladeType = 1 | 2;
export type BirdBladeMotionState =
  | typeof BIRD_BLADE_IDLE_STATE
  | typeof BIRD_BLADE_MOVING_STATE
  | typeof BIRD_BLADE_SETTLE_STATE;

export type BirdBladeDirection = 'left' | 'right';
export type BirdBladeRandom = Pick<GameplayRandom, 'nextIntInclusive'>;

export interface BirdBladePoint {
  readonly x: number;
  readonly y: number;
}

export interface BirdBladeViewport {
  readonly height: number;
  readonly width: number;
}

export interface BirdBladeStateOptions {
  readonly random: BirdBladeRandom;
  readonly type?: BirdBladeType;
  readonly viewport: BirdBladeViewport;
}

export interface BirdBladeRaySegment {
  readonly current: BirdBladePoint;
  readonly previous: BirdBladePoint;
}

export interface BirdBladeStateSnapshot {
  readonly activeDirection: BirdBladeDirection | null;
  readonly currentPosition: BirdBladePoint;
  readonly movementOrigin: BirdBladePoint;
  readonly movementScalar: number;
  readonly rayCached: boolean;
  readonly rotationDegrees: number;
  readonly state: BirdBladeMotionState;
  readonly targetPosition: BirdBladePoint;
  readonly type: BirdBladeType;
}

export interface BirdBladeTouchResult {
  readonly accepted: boolean;
  readonly activeDirection: BirdBladeDirection | null;
  readonly resetTrail: boolean;
  readonly rotationDegrees: number | null;
}

export type BirdBladeUpdateBranch = 'idle' | 'moving' | 'settle';
export type BirdBladeTrailOperation = 'none' | 'push-point' | 'reset-end';

export interface BirdBladeUpdateResult {
  readonly branch: BirdBladeUpdateBranch;
  readonly movementSegment: BirdBladeRaySegment | null;
  readonly overshot: boolean;
  readonly particleCommands: readonly BirdBladeParticleSpawnCommand[];
  readonly snapshot: BirdBladeStateSnapshot;
  readonly stateAfter: BirdBladeMotionState;
  readonly stateBefore: BirdBladeMotionState;
  readonly trailOperation: BirdBladeTrailOperation;
}

const MOVEMENT_WIDTH_MULTIPLIER = Math.fround(1234);
const MOVEMENT_WIDTH_DIVISOR = Math.fround(480);
const HALF = Math.fround(0.5);
const RADIANS_TO_DEGREES = Math.fround(57.295780181884766);
const HALF_PI = Math.fround(Math.PI / 2);
const NEGATIVE_HALF_PI = Math.fround(-Math.PI / 2);
const NEGATIVE_PI = Math.fround(-Math.PI);
const LEFT_ROTATION_OFFSET_DEGREES = Math.fround(180);

const REJECTED_TOUCH: BirdBladeTouchResult = Object.freeze({
  accepted: false,
  activeDirection: null,
  resetTrail: false,
  rotationDegrees: null,
});

/**
 * Pure state and shared-RNG model for the recovered BirdBlade types.
 *
 * A parent adapter may inspect one cached ray, dispatch it, and then explicitly acknowledge
 * it. Cached rays are not a queue: movement extends the one current endpoint until the
 * acknowledgment advances the previous endpoint.
 */
export class BirdBladeStateMachine {
  readonly movementScalar: number;

  private activeDirectionValue: BirdBladeDirection | null = null;
  private currentPositionValue: BirdBladePoint;
  private movementOriginValue: BirdBladePoint;
  private readonly random: BirdBladeRandom;
  private rayCachedValue = false;
  private rayCurrentPositionValue: BirdBladePoint;
  private rayPreviousPositionValue: BirdBladePoint;
  private rotationDegreesValue = 0;
  private stateValue: BirdBladeMotionState = BIRD_BLADE_IDLE_STATE;
  private targetPositionValue: BirdBladePoint;
  private readonly typeValue: BirdBladeType;

  constructor(options: BirdBladeStateOptions) {
    assertOptions(options);
    const viewport = copyViewport(options.viewport);
    this.random = options.random;
    this.typeValue = resolveBirdBladeType(options.type);
    this.movementScalar = getBirdBladeMovementScalar(viewport.width);

    const center = frozenPoint(
      Math.fround(viewport.width * HALF),
      Math.fround(viewport.height * HALF),
    );
    this.currentPositionValue = center;
    this.movementOriginValue = center;
    this.rayCurrentPositionValue = center;
    this.rayPreviousPositionValue = center;
    this.targetPositionValue = center;
  }

  /**
   * Accepts a target only from idle. Busy rejection occurs before point validation and does
   * not mutate any blade field, matching the native first-touch-wins behavior.
   */
  touch(targetPosition: BirdBladePoint): BirdBladeTouchResult {
    if (this.stateValue !== BIRD_BLADE_IDLE_STATE) {
      return REJECTED_TOUCH;
    }

    const target = copyFloat32Point(targetPosition, 'targetPosition');
    const origin = this.currentPositionValue;
    const activeDirection: BirdBladeDirection =
      target.x <= origin.x ? 'left' : 'right';
    const vector = frozenPoint(
      Math.fround(target.x - origin.x),
      Math.fround(target.y - origin.y),
    );
    const baseRotation = Math.fround(
      recoveredVectorAngleRadians(vector) * RADIANS_TO_DEGREES,
    );
    const rotationDegrees = activeDirection === 'left'
      ? Math.fround(baseRotation + LEFT_ROTATION_OFFSET_DEGREES)
      : baseRotation;

    this.stateValue = BIRD_BLADE_MOVING_STATE;
    this.movementOriginValue = origin;
    this.targetPositionValue = target;
    this.rayPreviousPositionValue = origin;
    this.rayCurrentPositionValue = origin;
    this.activeDirectionValue = activeDirection;
    this.rotationDegreesValue = rotationDegrees;

    return Object.freeze({
      accepted: true,
      activeDirection,
      resetTrail: true,
      rotationDegrees,
    });
  }

  /**
   * Advances one native scheduled update. Movement/ray work is resolved before the mandatory
   * particle gate, preserving one shared inclusive-integer draw stream.
   */
  update(deltaSeconds: number): BirdBladeUpdateResult {
    const delta = toNonNegativeFloat32(deltaSeconds, 'deltaSeconds');
    const stateBefore = this.stateValue;
    let stateAfter = stateBefore;
    let nextCurrent = this.currentPositionValue;
    let nextRayCurrent = this.rayCurrentPositionValue;
    let nextRayCached = this.rayCachedValue;
    let branch: BirdBladeUpdateBranch;
    let trailOperation: BirdBladeTrailOperation = 'none';
    let movementSegment: BirdBladeRaySegment | null = null;
    let overshot = false;

    switch (stateBefore) {
      case BIRD_BLADE_IDLE_STATE:
        branch = 'idle';
        break;
      case BIRD_BLADE_MOVING_STATE: {
        branch = 'moving';
        trailOperation = 'push-point';
        const direction = normalizeLikeRecoveredCocos(
          frozenPoint(
            Math.fround(this.targetPositionValue.x - this.movementOriginValue.x),
            Math.fround(this.targetPositionValue.y - this.movementOriginValue.y),
          ),
        );
        const displacement = frozenPoint(
          Math.fround(
            Math.fround(direction.x * delta) * this.movementScalar,
          ),
          Math.fround(
            Math.fround(direction.y * delta) * this.movementScalar,
          ),
        );
        const proposed = frozenPoint(
          Math.fround(this.currentPositionValue.x + displacement.x),
          Math.fround(this.currentPositionValue.y + displacement.y),
        );
        const stepLength = recoveredLengthBetween(
          this.currentPositionValue,
          proposed,
        );
        const remainingDistance = recoveredLengthBetween(
          this.currentPositionValue,
          this.targetPositionValue,
        );

        if (stepLength > remainingDistance) {
          overshot = true;
          stateAfter = BIRD_BLADE_SETTLE_STATE;
          nextCurrent = this.targetPositionValue;
          nextRayCached = true;
        } else {
          nextCurrent = proposed;
        }

        nextRayCurrent = nextCurrent;
        movementSegment = frozenSegment(
          this.currentPositionValue,
          nextCurrent,
        );

        // Overshoot sets the cache before this check and therefore consumes no 0..3 draw.
        if (
          !nextRayCached
          && drawInclusive(
            this.random,
            0,
            BIRD_BLADE_RAY_GATE_MAXIMUM,
          ) === 0
        ) {
          nextRayCached = true;
        }
        break;
      }
      case BIRD_BLADE_SETTLE_STATE:
        branch = 'settle';
        stateAfter = BIRD_BLADE_IDLE_STATE;
        trailOperation = 'reset-end';
        break;
    }

    const particleCommands = createBirdBladeParticleUpdateCommands(
      nextCurrent,
      this.movementScalar,
      this.random,
    );

    // Commit only after every draw has returned a valid value.
    this.stateValue = stateAfter;
    this.currentPositionValue = nextCurrent;
    this.rayCurrentPositionValue = nextRayCurrent;
    this.rayCachedValue = nextRayCached;
    const snapshot = this.snapshot();

    return Object.freeze({
      branch,
      movementSegment,
      overshot,
      particleCommands,
      snapshot,
      stateAfter,
      stateBefore,
      trailOperation,
    });
  }

  /** Returns the one current cached segment without clearing or advancing it. */
  peekCachedRaySegment(): BirdBladeRaySegment | null {
    if (!this.rayCachedValue) {
      return null;
    }
    return frozenSegment(
      this.rayPreviousPositionValue,
      this.rayCurrentPositionValue,
    );
  }

  /**
   * Mirrors `RayCashDone`: clear the cache and advance the previous endpoint exactly once.
   */
  acknowledgeCachedRay(): boolean {
    if (!this.rayCachedValue) {
      return false;
    }
    this.rayCachedValue = false;
    this.rayPreviousPositionValue = this.rayCurrentPositionValue;
    return true;
  }

  snapshot(): BirdBladeStateSnapshot {
    return Object.freeze({
      activeDirection: this.activeDirectionValue,
      currentPosition: copyPoint(this.currentPositionValue),
      movementOrigin: copyPoint(this.movementOriginValue),
      movementScalar: this.movementScalar,
      rayCached: this.rayCachedValue,
      rotationDegrees: this.rotationDegreesValue,
      state: this.stateValue,
      targetPosition: copyPoint(this.targetPositionValue),
      type: this.typeValue,
    });
  }
}

export function getBirdBladeMovementScalar(viewportWidth: number): number {
  const width = toPositiveFloat32(viewportWidth, 'viewportWidth');
  return Math.fround(
    Math.fround(width * MOVEMENT_WIDTH_MULTIPLIER)
      / MOVEMENT_WIDTH_DIVISOR,
  );
}

function normalizeLikeRecoveredCocos(vector: BirdBladePoint): BirdBladePoint {
  const length = recoveredVectorLength(vector);
  if (length === 0) {
    // The recovered normalization contract returns `(1, 0)` for a zero vector.
    return frozenPoint(1, 0);
  }
  return frozenPoint(
    Math.fround(vector.x / length),
    Math.fround(vector.y / length),
  );
}

function recoveredLengthBetween(
  first: BirdBladePoint,
  second: BirdBladePoint,
): number {
  return recoveredVectorLength(frozenPoint(
    Math.fround(second.x - first.x),
    Math.fround(second.y - first.y),
  ));
}

function recoveredVectorLength(vector: BirdBladePoint): number {
  const xSquared = Math.fround(vector.x * vector.x);
  const ySquared = Math.fround(vector.y * vector.y);
  return Math.fround(Math.sqrt(Math.fround(xSquared + ySquared)));
}

function recoveredVectorAngleRadians(vector: BirdBladePoint): number {
  if (vector.x === 0) {
    if (vector.y === 0) {
      return 0;
    }
    return vector.y > 0 ? HALF_PI : NEGATIVE_HALF_PI;
  }
  if (vector.y === 0 && vector.x < 0) {
    return NEGATIVE_PI;
  }

  const ratio = Math.fround(vector.y / vector.x);
  let angle = Math.fround(-Math.fround(Math.atan(ratio)));
  if (vector.x < 0) {
    // The float angle is promoted before adding the native double pi literal.
    angle = Math.fround(angle + Math.PI);
  }
  return angle;
}

function frozenSegment(
  previous: BirdBladePoint,
  current: BirdBladePoint,
): BirdBladeRaySegment {
  return Object.freeze({
    current: copyPoint(current),
    previous: copyPoint(previous),
  });
}

function copyViewport(viewport: BirdBladeViewport): BirdBladeViewport {
  if (viewport === null || typeof viewport !== 'object') {
    throw new TypeError('viewport must provide width and height');
  }
  return Object.freeze({
    height: toPositiveFloat32(viewport.height, 'viewport.height'),
    width: toPositiveFloat32(viewport.width, 'viewport.width'),
  });
}

function copyFloat32Point(point: BirdBladePoint, label: string): BirdBladePoint {
  if (point === null || typeof point !== 'object') {
    throw new TypeError(`${label} must be a point`);
  }
  return frozenPoint(
    toFiniteFloat32(point.x, `${label}.x`),
    toFiniteFloat32(point.y, `${label}.y`),
  );
}

function copyPoint(point: BirdBladePoint): BirdBladePoint {
  return frozenPoint(point.x, point.y);
}

function frozenPoint(x: number, y: number): BirdBladePoint {
  return Object.freeze({ x, y });
}

function drawInclusive(
  random: BirdBladeRandom,
  minimumInclusive: number,
  maximumInclusive: number,
): number {
  const value = random.nextIntInclusive(minimumInclusive, maximumInclusive);
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(
      `nextIntInclusive(${minimumInclusive}, ${maximumInclusive}) must return a safe integer`,
    );
  }
  if (value < minimumInclusive || value > maximumInclusive) {
    throw new RangeError(
      `nextIntInclusive(${minimumInclusive}, ${maximumInclusive}) returned ${value} outside the inclusive range`,
    );
  }
  return value;
}

function assertOptions(options: BirdBladeStateOptions): void {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('options must provide viewport and random');
  }
  const random = options.random;
  if (
    random === null
    || typeof random !== 'object'
    || typeof random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive(minimum, maximum)');
  }
}

function resolveBirdBladeType(type: BirdBladeType | undefined): BirdBladeType {
  if (type === undefined) {
    return BIRD_BLADE_TYPE;
  }
  if (!Number.isSafeInteger(type)) {
    throw new TypeError('type must be a safe integer');
  }
  if (type !== 1 && type !== 2) {
    throw new RangeError('type must be 1 or 2');
  }
  return type;
}

function toNonNegativeFloat32(value: number, label: string): number {
  const converted = toFiniteFloat32(value, label);
  if (converted < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
  return converted;
}

function toPositiveFloat32(value: number, label: string): number {
  const converted = toFiniteFloat32(value, label);
  if (converted <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
  return converted;
}

function toFiniteFloat32(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
  const converted = Math.fround(value);
  if (!Number.isFinite(converted)) {
    throw new RangeError(`${label} must fit in a finite float32`);
  }
  return converted;
}
