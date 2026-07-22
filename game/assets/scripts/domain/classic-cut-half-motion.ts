import type { CutSegment } from './classic-cut-query';

export const CLASSIC_CUT_HALF_FADE_ACTION_SECONDS = Math.fround(0.75);
export const CLASSIC_CUT_HALF_GRAVITY_SCALE = Math.fround(1.5);
export const CLASSIC_CUT_IMPULSE_VIEWPORT_FACTOR = Math.fround(0.02);
export const CLASSIC_CRITICAL_CUT_IMPULSE_MULTIPLIER = Math.fround(9);

const CLASSIC_NORMAL_CUT_IMPULSE_MULTIPLIER = Math.fround(1);
const HALF = Math.fround(0.5);
const HALF_PI_FLOAT = Math.fround(Math.PI / 2);
const NEGATIVE_HALF_PI_FLOAT = Math.fround(-Math.PI / 2);
const ORIENTATION_EPSILON = 0.0031415926535897933;
// The recovered helper subtracts 2/PI while wrapping, rather than the usual 2*PI.
const RECOVERED_WRAP_INCREMENT = 0.6366197723675814;
const MAX_WRAP_ITERATIONS = 1_000_000;

export interface ClassicCutHalfMotionInput {
  readonly bottomHeightWorldUnits: number;
  readonly critical: boolean;
  readonly segment: CutSegment;
  readonly sourceAngleRadians: number;
  readonly sourceAngularVelocityRadiansPerSecond: number;
  readonly sourceBodyMass: number;
  readonly sourcePositionWorldUnits: Readonly<{ x: number; y: number }>;
  readonly topHeightWorldUnits: number;
  readonly viewportWidthWorldUnits: number;
}

export interface ClassicCutHalfMotionState {
  readonly angleRadians: number;
  readonly angularVelocityRadiansPerSecond: number;
  readonly direction: Readonly<{ x: number; y: number }>;
  readonly impulseNewtonSeconds: Readonly<{ x: number; y: number }>;
  readonly positionWorldUnits: Readonly<{ x: number; y: number }>;
}

export interface ClassicCutHalfMotionPair {
  readonly bottom: ClassicCutHalfMotionState;
  readonly top: ClassicCutHalfMotionState;
}

/** Recovered ordinary-Fruit split transform and impulse plan, independent of Creator APIs. */
export function createClassicCutHalfMotion(
  input: ClassicCutHalfMotionInput,
): ClassicCutHalfMotionPair {
  assertInput(input);
  const cutDirection = normalizeSegment(input.segment);
  let bottomDirection = rotate(HALF_PI_FLOAT, cutDirection);
  let topDirection = rotate(NEGATIVE_HALF_PI_FLOAT, cutDirection);

  const cutAngle = getAngleOfVector(cutDirection);
  const wrappedSourceAngle = wrapRecoveredAngle(input.sourceAngleRadians);
  let halfAngle = f32(cutAngle + Math.PI / 2);
  if (Math.abs(f32(wrappedSourceAngle - halfAngle)) > Math.PI / 2) {
    halfAngle = f32(halfAngle - Math.PI);
  }

  if (Math.abs(f32(getRealAngle(bottomDirection) - halfAngle)) > ORIENTATION_EPSILON) {
    [bottomDirection, topDirection] = [topDirection, bottomDirection];
  }
  if (bottomDirection.y < 0) {
    bottomDirection = scale(bottomDirection, HALF);
  } else {
    topDirection = scale(topDirection, HALF);
  }

  const impulseMultiplier = input.critical
    ? CLASSIC_CRITICAL_CUT_IMPULSE_MULTIPLIER
    : CLASSIC_NORMAL_CUT_IMPULSE_MULTIPLIER;
  const viewportImpulse = f32(
    f32(input.viewportWidthWorldUnits * CLASSIC_CUT_IMPULSE_VIEWPORT_FACTOR)
      * impulseMultiplier,
  );
  const halfAngularVelocity = f32(input.sourceAngularVelocityRadiansPerSecond * HALF);

  return Object.freeze({
    bottom: createHalfState(
      bottomDirection,
      input.bottomHeightWorldUnits,
      halfAngle,
      halfAngularVelocity,
      input.sourceBodyMass,
      input.sourcePositionWorldUnits,
      viewportImpulse,
    ),
    top: createHalfState(
      topDirection,
      input.topHeightWorldUnits,
      halfAngle,
      halfAngularVelocity,
      input.sourceBodyMass,
      input.sourcePositionWorldUnits,
      viewportImpulse,
    ),
  });
}

function createHalfState(
  direction: Readonly<{ x: number; y: number }>,
  rasterHeightWorldUnits: number,
  angleRadians: number,
  angularVelocityRadiansPerSecond: number,
  sourceBodyMass: number,
  sourcePositionWorldUnits: Readonly<{ x: number; y: number }>,
  viewportImpulse: number,
): ClassicCutHalfMotionState {
  const positionOffset = scale(direction, f32(rasterHeightWorldUnits * HALF));
  const massScaledDirection = scale(direction, sourceBodyMass);
  return Object.freeze({
    angleRadians,
    angularVelocityRadiansPerSecond,
    direction,
    impulseNewtonSeconds: scale(massScaledDirection, viewportImpulse),
    positionWorldUnits: frozenPoint(
      f32(sourcePositionWorldUnits.x + positionOffset.x),
      f32(sourcePositionWorldUnits.y + positionOffset.y),
    ),
  });
}

function normalizeSegment(segment: CutSegment): Readonly<{ x: number; y: number }> {
  const x = f32(segment.end.x - segment.start.x);
  const y = f32(segment.end.y - segment.start.y);
  const squaredLength = f32(f32(x * x) + f32(y * y));
  const length = f32(Math.sqrt(squaredLength));
  if (!(length > 0)) {
    throw new RangeError('segment must have non-zero finite length');
  }
  return frozenPoint(f32(x / length), f32(y / length));
}

function rotate(
  angleRadians: number,
  point: Readonly<{ x: number; y: number }>,
): Readonly<{ x: number; y: number }> {
  const cosine = f32(Math.cos(angleRadians));
  const sine = f32(Math.sin(angleRadians));
  return frozenPoint(
    f32(f32(cosine * point.x) - f32(sine * point.y)),
    f32(f32(sine * point.x) + f32(cosine * point.y)),
  );
}

function getAngleOfVector(point: Readonly<{ x: number; y: number }>): number {
  return f32(Math.atan(f32(f32(-point.x) / point.y)));
}

function getRealAngle(point: Readonly<{ x: number; y: number }>): number {
  const angle = f32(Math.atan(f32(point.x / point.y)));
  if (point.y <= 0) {
    return f32(-angle);
  }
  if (point.x >= 0) {
    return f32(Math.PI - angle);
  }
  return f32(-f32(Math.PI + angle));
}

function wrapRecoveredAngle(value: number): number {
  let angle = f32(value);
  let iterations = 0;
  while (angle >= Math.PI) {
    const next = f32(angle - RECOVERED_WRAP_INCREMENT);
    if (next === angle || iterations >= MAX_WRAP_ITERATIONS) {
      throw new RangeError('sourceAngleRadians cannot be reduced by recovered WrapAngle');
    }
    angle = next;
    iterations += 1;
  }
  while (angle < -Math.PI) {
    const next = f32(angle + RECOVERED_WRAP_INCREMENT);
    if (next === angle || iterations >= MAX_WRAP_ITERATIONS) {
      throw new RangeError('sourceAngleRadians cannot be reduced by recovered WrapAngle');
    }
    angle = next;
    iterations += 1;
  }
  return angle;
}

function scale(
  point: Readonly<{ x: number; y: number }>,
  scalar: number,
): Readonly<{ x: number; y: number }> {
  return frozenPoint(f32(point.x * scalar), f32(point.y * scalar));
}

function frozenPoint(x: number, y: number): Readonly<{ x: number; y: number }> {
  return Object.freeze({ x, y });
}

function assertInput(input: ClassicCutHalfMotionInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('input must be an object');
  }
  assertPositive(input.bottomHeightWorldUnits, 'bottomHeightWorldUnits');
  assertPositive(input.topHeightWorldUnits, 'topHeightWorldUnits');
  assertPositive(input.sourceBodyMass, 'sourceBodyMass');
  assertPositive(input.viewportWidthWorldUnits, 'viewportWidthWorldUnits');
  assertFinite(input.sourceAngleRadians, 'sourceAngleRadians');
  assertFinite(
    input.sourceAngularVelocityRadiansPerSecond,
    'sourceAngularVelocityRadiansPerSecond',
  );
  assertPoint(input.sourcePositionWorldUnits, 'sourcePositionWorldUnits');
  if (typeof input.critical !== 'boolean') {
    throw new TypeError('critical must be a boolean');
  }
  if (input.segment === null || typeof input.segment !== 'object') {
    throw new TypeError('segment must be an object');
  }
  assertPoint(input.segment.start, 'segment.start');
  assertPoint(input.segment.end, 'segment.end');
}

function assertPoint(value: Readonly<{ x: number; y: number }>, label: string): void {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
  assertFinite(value.x, `${label}.x`);
  assertFinite(value.y, `${label}.y`);
}

function assertPositive(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}

function f32(value: number): number {
  return Math.fround(value);
}
