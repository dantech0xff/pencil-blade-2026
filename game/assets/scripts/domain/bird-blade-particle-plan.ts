import type { GameplayRandom } from './gameplay-random';

export const BIRD_BLADE_PARTICLE_GATE_MAXIMUM = 4 as const;
export const BIRD_BLADE_PARTICLE_SELECTION_MAXIMUM = 3 as const;
export const BIRD_BLADE_PARTICLE_Z_ORDER = 1 as const;

export type BirdBladeParticleSelection = 0 | 1 | 2 | 3;

export type BirdBladeParticleLogicalPath =
  | 'Blades/Particles/X-Mas/xmasfive.png'
  | 'Blades/Particles/X-Mas/xmasfour.png'
  | 'Blades/Particles/X-Mas/xmashexa.png'
  | 'Blades/Particles/X-Mas/xmascircle.png';

export type BirdBladeParticleRandom = Pick<GameplayRandom, 'nextIntInclusive'>;

export interface BirdBladeParticlePoint {
  readonly x: number;
  readonly y: number;
}

export interface BirdBladeParticleDefinition {
  readonly lifetimeSeconds: number;
  readonly logicalPath: BirdBladeParticleLogicalPath;
  readonly offsetStrategy: 'independent-axis-ranges' | 'signed-pair';
  readonly selection: BirdBladeParticleSelection;
}

export type BirdBladeParticleSpawnCommand = Readonly<{
  readonly attachmentZOrder: typeof BIRD_BLADE_PARTICLE_Z_ORDER;
  readonly basePosition: BirdBladeParticlePoint;
  readonly fadeOutEnabled: true;
  readonly lifetimeSeconds: number;
  readonly logicalPath: BirdBladeParticleLogicalPath;
  readonly randomOffset: BirdBladeParticlePoint;
  readonly rotationEnabled: true;
  readonly scaleOutEnabled: true;
  readonly selection: BirdBladeParticleSelection;
  readonly type: 'spawn-bird-blade-particle';
}>;

export const BIRD_BLADE_PARTICLE_DEFINITIONS: readonly BirdBladeParticleDefinition[] =
  Object.freeze([
    frozenDefinition(
      0,
      'Blades/Particles/X-Mas/xmasfive.png',
      Math.fround(1.5),
      'independent-axis-ranges',
    ),
    frozenDefinition(
      1,
      'Blades/Particles/X-Mas/xmasfour.png',
      Math.fround(1),
      'independent-axis-ranges',
    ),
    frozenDefinition(
      2,
      'Blades/Particles/X-Mas/xmashexa.png',
      Math.fround(0.75),
      'independent-axis-ranges',
    ),
    frozenDefinition(
      3,
      'Blades/Particles/X-Mas/xmascircle.png',
      Math.fround(0.5),
      'signed-pair',
    ),
  ]);

const NO_COMMANDS: readonly BirdBladeParticleSpawnCommand[] = Object.freeze([]);
const PARTICLE_BASE_Y_SCALAR = Math.fround(0.075);
const AXIS_X_MINIMUM_SCALAR = Math.fround(-0.05);
const AXIS_X_MAXIMUM_SCALAR = Math.fround(0.05);
const AXIS_Y_MINIMUM_SCALAR = Math.fround(-0.3125);
const AXIS_Y_FIVE_FOUR_MAXIMUM_SCALAR = Math.fround(-0.02);
const AXIS_Y_HEXA_MAXIMUM_SCALAR = Math.fround(-0.1);
const SIGNED_PAIR_MINIMUM_DOUBLE = -0.156;
const SIGNED_PAIR_MAXIMUM_SCALAR = Math.fround(-0.1);

/**
 * Plans the recovered always-running BirdBlade particle update.
 *
 * The inclusive 0..4 gate is drawn on every blade update. A successful gate then draws
 * selection 0..3 and the selected offset data. The caller supplies the same process-owned
 * gameplay stream used by movement ray caching so that movement draws occur before this plan.
 */
export function createBirdBladeParticleUpdateCommands(
  currentPosition: BirdBladeParticlePoint,
  movementScalar: number,
  random: BirdBladeParticleRandom,
): readonly BirdBladeParticleSpawnCommand[] {
  const current = copyFloat32Point(currentPosition, 'currentPosition');
  const scalar = toPositiveFloat32(movementScalar, 'movementScalar');
  assertRandom(random);

  const gate = drawInclusive(
    random,
    0,
    BIRD_BLADE_PARTICLE_GATE_MAXIMUM,
  );
  if (gate !== 0) {
    return NO_COMMANDS;
  }

  const basePosition = frozenPoint(
    current.x,
    Math.fround(
      current.y - Math.fround(scalar * PARTICLE_BASE_Y_SCALAR),
    ),
  );
  const selection = drawInclusive(
    random,
    0,
    BIRD_BLADE_PARTICLE_SELECTION_MAXIMUM,
  ) as BirdBladeParticleSelection;
  const definition = requireDefinition(selection);
  const randomOffset = createRandomOffset(selection, scalar, random);

  return Object.freeze([
    Object.freeze({
      attachmentZOrder: BIRD_BLADE_PARTICLE_Z_ORDER,
      basePosition,
      fadeOutEnabled: true,
      lifetimeSeconds: definition.lifetimeSeconds,
      logicalPath: definition.logicalPath,
      randomOffset,
      rotationEnabled: true,
      scaleOutEnabled: true,
      selection,
      type: 'spawn-bird-blade-particle',
    }),
  ]);
}

function createRandomOffset(
  selection: BirdBladeParticleSelection,
  scalar: number,
  random: BirdBladeParticleRandom,
): BirdBladeParticlePoint {
  if (selection === 3) {
    return createSignedPairOffset(scalar, random);
  }

  const xMinimum = scaledFloat32Integer(scalar, AXIS_X_MINIMUM_SCALAR);
  const xMaximum = scaledFloat32Integer(scalar, AXIS_X_MAXIMUM_SCALAR);
  const yMinimum = scaledFloat32Integer(scalar, AXIS_Y_MINIMUM_SCALAR);
  const yMaximum = scaledFloat32Integer(
    scalar,
    selection === 2
      ? AXIS_Y_HEXA_MAXIMUM_SCALAR
      : AXIS_Y_FIVE_FOUR_MAXIMUM_SCALAR,
  );

  return frozenPoint(
    drawInclusive(random, xMinimum, xMaximum),
    drawInclusive(random, yMinimum, yMaximum),
  );
}

function createSignedPairOffset(
  scalar: number,
  random: BirdBladeParticleRandom,
): BirdBladeParticlePoint {
  // The native minimum is a promoted float multiplied by the double literal -0.156.
  const magnitudeMinimum = truncatedSafeInteger(
    scalar * SIGNED_PAIR_MINIMUM_DOUBLE,
    'signed-pair minimum',
  );
  const magnitudeMaximum = scaledFloat32Integer(
    scalar,
    SIGNED_PAIR_MAXIMUM_SCALAR,
  );
  const xSign = drawInclusive(random, -1, 1);
  const xMagnitude = drawInclusive(random, magnitudeMinimum, magnitudeMaximum);
  const ySign = drawInclusive(random, -1, 1);
  const yMagnitude = drawInclusive(random, magnitudeMinimum, magnitudeMaximum);

  return frozenPoint(
    xSign * xMagnitude,
    ySign * yMagnitude,
  );
}

function scaledFloat32Integer(scalar: number, multiplier: number): number {
  return truncatedSafeInteger(
    Math.fround(scalar * multiplier),
    'scaled particle bound',
  );
}

function truncatedSafeInteger(value: number, label: string): number {
  const truncated = Math.trunc(value);
  if (!Number.isSafeInteger(truncated)) {
    throw new RangeError(`${label} must fit in a safe integer`);
  }
  return truncated;
}

function requireDefinition(
  selection: BirdBladeParticleSelection,
): BirdBladeParticleDefinition {
  const definition = BIRD_BLADE_PARTICLE_DEFINITIONS[selection];
  if (definition === undefined) {
    throw new Error(`Bird blade particle selection ${selection} is unavailable`);
  }
  return definition;
}

function frozenDefinition(
  selection: BirdBladeParticleSelection,
  logicalPath: BirdBladeParticleLogicalPath,
  lifetimeSeconds: number,
  offsetStrategy: BirdBladeParticleDefinition['offsetStrategy'],
): BirdBladeParticleDefinition {
  return Object.freeze({
    lifetimeSeconds,
    logicalPath,
    offsetStrategy,
    selection,
  });
}

function drawInclusive(
  random: BirdBladeParticleRandom,
  minimumInclusive: number,
  maximumInclusive: number,
): number {
  if (
    !Number.isSafeInteger(minimumInclusive)
    || !Number.isSafeInteger(maximumInclusive)
    || minimumInclusive > maximumInclusive
  ) {
    throw new RangeError('particle draw bounds must be an ordered safe-integer range');
  }

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

function assertRandom(random: BirdBladeParticleRandom): void {
  if (
    random === null
    || typeof random !== 'object'
    || typeof random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive(minimum, maximum)');
  }
}

function copyFloat32Point(
  point: BirdBladeParticlePoint,
  label: string,
): BirdBladeParticlePoint {
  if (point === null || typeof point !== 'object') {
    throw new TypeError(`${label} must be a point`);
  }
  return frozenPoint(
    toFiniteFloat32(point.x, `${label}.x`),
    toFiniteFloat32(point.y, `${label}.y`),
  );
}

function frozenPoint(x: number, y: number): BirdBladeParticlePoint {
  return Object.freeze({ x, y });
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
