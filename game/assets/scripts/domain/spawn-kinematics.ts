/** Structural RNG port keeps this recovered domain module independent of engine code. */
export interface SpawnRandom {
  nextIntInclusive(min: number, max: number): number;
  nextDecile(): number;
}

export interface LogicalViewport {
  readonly width: number;
  readonly height: number;
}

export interface ReadonlyVector2 {
  readonly x: number;
  readonly y: number;
}

export const CLASSIC_TOSS_DIRECTION = Object.freeze({
  UP: 0,
  DOWN: 1,
  LEFT: 2,
  RIGHT: 3,
} as const);

export type ClassicTossDirection =
  typeof CLASSIC_TOSS_DIRECTION[keyof typeof CLASSIC_TOSS_DIRECTION];

interface SpawnKinematicsBase {
  readonly direction: ClassicTossDirection;
  readonly positionMetres: ReadonlyVector2;
  readonly angleRadians: 0;
  readonly angularVelocityRadiansPerSecond: number;
}

export interface SpawnKinematicsWithLinearVelocity extends SpawnKinematicsBase {
  readonly direction: 0 | 2 | 3;
  readonly linearVelocityMetresPerSecond: ReadonlyVector2;
}

/** Down has no linear-velocity field because the recovered method emitted no such command. */
export interface DownSpawnKinematics extends SpawnKinematicsBase {
  readonly direction: 1;
}

export type RecoveredSpawnKinematics =
  | SpawnKinematicsWithLinearVelocity
  | DownSpawnKinematics;

interface CreatorSpawnKinematicsBase {
  readonly direction: ClassicTossDirection;
  readonly positionWorldUnits: ReadonlyVector2;
  readonly angleRadians: 0;
  readonly angularVelocityRadiansPerSecond: number;
}

export interface CreatorSpawnKinematicsWithLinearVelocity
  extends CreatorSpawnKinematicsBase {
  readonly direction: 0 | 2 | 3;
  readonly linearVelocityMetresPerSecond: ReadonlyVector2;
}

export interface CreatorDownSpawnKinematics extends CreatorSpawnKinematicsBase {
  readonly direction: 1;
}

export type CreatorSpawnKinematics =
  | CreatorSpawnKinematicsWithLinearVelocity
  | CreatorDownSpawnKinematics;

export const LEGACY_WORLD_UNITS_PER_METRE = 32;

/**
 * Recovered factory/adapter responsibility for Classic Down spawns. Down sampling itself
 * never writes linear velocity. Fresh or pooled Fruit 13/14 bodies must be reset to zero;
 * DragonFruit's pre-Down velocity remains unknown and is not defaulted here.
 */
export const CLASSIC_DOWN_VELOCITY_BOUNDARY = Object.freeze({
  fruitIdsRequiringZeroReset: Object.freeze([13, 14] as const),
  fruitResetMetresPerSecond: Object.freeze({ x: 0, y: 0 }),
  dragonFruitInitialLinearVelocity: 'unknown' as const,
});

const FLOAT_ZERO = Math.fround(0);
const FLOAT_HALF = Math.fround(0.5);
const FLOAT_MIN_X_FRACTION = Math.fround(0.02);
const FLOAT_MAX_X_FRACTION = Math.fround(0.98);
const FLOAT_SIDE_X_FRACTION = Math.fround(0.2);
const FLOAT_RIGHT_X_FRACTION = Math.fround(1.2);
const FLOAT_Y_SIDE_FRACTION = Math.fround(0.65);
const FLOAT_DOWN_Y_FRACTION = Math.fround(1.125);
const FLOAT_UP_Y_FRACTION = Math.fround(0.125);
const FLOAT_BASE_WIDTH = Math.fround(480);
const FLOAT_TWO = Math.fround(2);

function addFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) + Math.fround(right));
}

function subtractFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) - Math.fround(right));
}

function multiplyFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) * Math.fround(right));
}

function divideFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) / Math.fround(right));
}

function vector(x: number, y: number): ReadonlyVector2 {
  return Object.freeze({ x: Math.fround(x), y: Math.fround(y) });
}

function viewportAsFloat32(viewport: LogicalViewport): LogicalViewport {
  if (viewport === null || typeof viewport !== 'object') {
    throw new TypeError('viewport must be an object');
  }
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) {
    throw new TypeError('viewport width and height must be finite');
  }
  if (viewport.width <= 0 || viewport.height <= 0) {
    throw new RangeError('viewport width and height must be positive');
  }

  const width = Math.fround(viewport.width);
  const height = Math.fround(viewport.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new RangeError('viewport width and height must fit in float32');
  }

  return { width, height };
}

function assertRandom(random: SpawnRandom): void {
  if (
    random === null
    || typeof random !== 'object'
    || typeof random.nextIntInclusive !== 'function'
    || typeof random.nextDecile !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive() and nextDecile()');
  }
}

function drawInclusive(random: SpawnRandom, min: number, max: number): number {
  const value = random.nextIntInclusive(min, max);
  if (!Number.isSafeInteger(value)) {
    throw new TypeError('nextIntInclusive() must return a safe integer');
  }
  if (value < min || value > max) {
    throw new RangeError(`nextIntInclusive() returned ${value} outside [${min}, ${max}]`);
  }
  return value;
}

function drawDecileFloat32(random: SpawnRandom): number {
  const value = random.nextDecile();
  if (!Number.isFinite(value)) {
    throw new TypeError('nextDecile() must return a finite number');
  }

  const index = Math.round(value * 10);
  if (index < 0 || index > 9 || Math.abs(value - index / 10) > 1e-6) {
    throw new RangeError('nextDecile() must return one of 0.0, 0.1, ..., 0.9');
  }
  return Math.fround(index / 10);
}

function horizontalIntegerBounds(width: number): readonly [number, number] {
  return Object.freeze([
    Math.trunc(multiplyFloat32(FLOAT_MIN_X_FRACTION, width)),
    Math.trunc(multiplyFloat32(FLOAT_MAX_X_FRACTION, width)),
  ]);
}

function sideWidthCorrection(width: number): number {
  return divideFloat32(subtractFloat32(width, FLOAT_BASE_WIDTH), 100);
}

function upWidthCorrection(width: number): number {
  return divideFloat32(subtractFloat32(width, FLOAT_BASE_WIDTH), 37);
}

/** Recovered Right order: q1, q2, angular. */
export function sampleRightSpawnKinematics(
  viewport: LogicalViewport,
  random: SpawnRandom,
): SpawnKinematicsWithLinearVelocity {
  const dimensions = viewportAsFloat32(viewport);
  assertRandom(random);
  const q1 = drawDecileFloat32(random);
  const q2 = drawDecileFloat32(random);
  const angularVelocity = drawInclusive(random, 3, 6);
  const correction = sideWidthCorrection(dimensions.width);

  return Object.freeze({
    direction: CLASSIC_TOSS_DIRECTION.RIGHT,
    positionMetres: vector(
      divideFloat32(
        multiplyFloat32(FLOAT_RIGHT_X_FRACTION, dimensions.width),
        LEGACY_WORLD_UNITS_PER_METRE,
      ),
      divideFloat32(
        multiplyFloat32(FLOAT_Y_SIDE_FRACTION, dimensions.height),
        LEGACY_WORLD_UNITS_PER_METRE,
      ),
    ),
    angleRadians: 0,
    linearVelocityMetresPerSecond: vector(
      subtractFloat32(
        subtractFloat32(-3.5, multiplyFloat32(FLOAT_TWO, q1)),
        correction,
      ),
      addFloat32(
        addFloat32(6.5, multiplyFloat32(FLOAT_TWO, q2)),
        correction,
      ),
    ),
    angularVelocityRadiansPerSecond: angularVelocity,
  });
}

/** Recovered Left order: q1, q2, angular. */
export function sampleLeftSpawnKinematics(
  viewport: LogicalViewport,
  random: SpawnRandom,
): SpawnKinematicsWithLinearVelocity {
  const dimensions = viewportAsFloat32(viewport);
  assertRandom(random);
  const q1 = drawDecileFloat32(random);
  const q2 = drawDecileFloat32(random);
  const angularVelocity = drawInclusive(random, 3, 6);
  const correction = sideWidthCorrection(dimensions.width);

  return Object.freeze({
    direction: CLASSIC_TOSS_DIRECTION.LEFT,
    positionMetres: vector(
      divideFloat32(
        multiplyFloat32(-FLOAT_SIDE_X_FRACTION, dimensions.width),
        LEGACY_WORLD_UNITS_PER_METRE,
      ),
      divideFloat32(
        multiplyFloat32(FLOAT_Y_SIDE_FRACTION, dimensions.height),
        LEGACY_WORLD_UNITS_PER_METRE,
      ),
    ),
    angleRadians: 0,
    linearVelocityMetresPerSecond: vector(
      addFloat32(
        addFloat32(3.5, multiplyFloat32(FLOAT_TWO, q1)),
        correction,
      ),
      addFloat32(
        addFloat32(6.5, multiplyFloat32(FLOAT_TWO, q2)),
        correction,
      ),
    ),
    angularVelocityRadiansPerSecond: angularVelocity,
  });
}

/** Recovered Down order: horizontal position, angular; no linear-velocity command. */
export function sampleDownSpawnKinematics(
  viewport: LogicalViewport,
  random: SpawnRandom,
): DownSpawnKinematics {
  const dimensions = viewportAsFloat32(viewport);
  assertRandom(random);
  const [minX, maxX] = horizontalIntegerBounds(dimensions.width);
  const x = drawInclusive(random, minX, maxX);
  const angularVelocity = drawInclusive(random, 3, 7);

  return Object.freeze({
    direction: CLASSIC_TOSS_DIRECTION.DOWN,
    positionMetres: vector(
      divideFloat32(x, LEGACY_WORLD_UNITS_PER_METRE),
      divideFloat32(
        multiplyFloat32(FLOAT_DOWN_Y_FRACTION, dimensions.height),
        LEGACY_WORLD_UNITS_PER_METRE,
      ),
    ),
    angleRadians: 0,
    angularVelocityRadiansPerSecond: angularVelocity,
  });
}

/** Recovered Up order: horizontal position, q1, q2, angular. */
export function sampleUpSpawnKinematics(
  viewport: LogicalViewport,
  random: SpawnRandom,
): SpawnKinematicsWithLinearVelocity {
  const dimensions = viewportAsFloat32(viewport);
  assertRandom(random);
  const [minX, maxX] = horizontalIntegerBounds(dimensions.width);
  const x = drawInclusive(random, minX, maxX);
  const q1 = drawDecileFloat32(random);
  const q2 = drawDecileFloat32(random);
  const angularVelocity = drawInclusive(random, 3, 10);
  const signedDistanceFromX = subtractFloat32(
    multiplyFloat32(FLOAT_HALF, dimensions.width),
    x,
  );
  const horizontalSign = Math.trunc(signedDistanceFromX) < 0 ? -1 : 1;

  return Object.freeze({
    direction: CLASSIC_TOSS_DIRECTION.UP,
    positionMetres: vector(
      divideFloat32(x, LEGACY_WORLD_UNITS_PER_METRE),
      divideFloat32(
        multiplyFloat32(-FLOAT_UP_Y_FRACTION, dimensions.height),
        LEGACY_WORLD_UNITS_PER_METRE,
      ),
    ),
    angleRadians: 0,
    linearVelocityMetresPerSecond: vector(
      multiplyFloat32(multiplyFloat32(FLOAT_TWO, horizontalSign), q1),
      addFloat32(
        addFloat32(18.75, multiplyFloat32(FLOAT_TWO, q2)),
        upWidthCorrection(dimensions.width),
      ),
    ),
    angularVelocityRadiansPerSecond: angularVelocity,
  });
}

/** Samples one of the four recovered direction formulas without importing Creator. */
export function sampleSpawnKinematics(
  direction: ClassicTossDirection,
  viewport: LogicalViewport,
  random: SpawnRandom,
): RecoveredSpawnKinematics {
  switch (direction) {
    case CLASSIC_TOSS_DIRECTION.UP:
      return sampleUpSpawnKinematics(viewport, random);
    case CLASSIC_TOSS_DIRECTION.DOWN:
      return sampleDownSpawnKinematics(viewport, random);
    case CLASSIC_TOSS_DIRECTION.LEFT:
      return sampleLeftSpawnKinematics(viewport, random);
    case CLASSIC_TOSS_DIRECTION.RIGHT:
      return sampleRightSpawnKinematics(viewport, random);
    default:
      throw new RangeError(`unsupported toss direction: ${String(direction)}`);
  }
}

/** Recovered position conversion at the Creator boundary. */
export function positionMetresToCreatorWorldUnits(
  positionMetres: ReadonlyVector2,
): ReadonlyVector2 {
  return vector(
    multiplyFloat32(positionMetres.x, LEGACY_WORLD_UNITS_PER_METRE),
    multiplyFloat32(positionMetres.y, LEGACY_WORLD_UNITS_PER_METRE),
  );
}

/**
 * Target adapter mapping: position is converted to Creator world units exactly once;
 * linear velocity (m/s) and angular velocity (rad/s) pass through numerically unchanged.
 */
export function mapSpawnKinematicsToCreator(
  kinematics: RecoveredSpawnKinematics,
): CreatorSpawnKinematics {
  const base = {
    direction: kinematics.direction,
    positionWorldUnits: positionMetresToCreatorWorldUnits(kinematics.positionMetres),
    angleRadians: kinematics.angleRadians,
    angularVelocityRadiansPerSecond: kinematics.angularVelocityRadiansPerSecond,
  };

  if ('linearVelocityMetresPerSecond' in kinematics) {
    return Object.freeze({
      ...base,
      direction: kinematics.direction,
      linearVelocityMetresPerSecond: vector(
        kinematics.linearVelocityMetresPerSecond.x,
        kinematics.linearVelocityMetresPerSecond.y,
      ),
    });
  }

  return Object.freeze({
    ...base,
    direction: CLASSIC_TOSS_DIRECTION.DOWN,
  });
}
