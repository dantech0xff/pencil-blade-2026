/** Recovered moving-body bounds checks with deferred disposal commands. */

export const LOWER_BOUNDS_RATIO = Math.fround(0.2);
export const UPPER_BOUNDS_RATIO = Math.fround(1.2);

export interface BoundsVector2 {
  readonly x: number;
  readonly y: number;
}

export interface ClassicBoundsInput {
  readonly linearVelocityMetresPerSecond: BoundsVector2;
  readonly positionWorldUnits: BoundsVector2;
  readonly viewportHeightWorldUnits: number;
  readonly viewportWidthWorldUnits: number;
}

export type DisposalBoundary = 'below' | 'above' | 'left' | 'right';

export type ClassicBoundsCommand =
  | Readonly<{ type: 'fail'; positionWorldUnits: BoundsVector2 }>
  | Readonly<{ type: 'defer-dispose'; boundary: DisposalBoundary }>;

const NO_BOUNDS_COMMANDS: readonly ClassicBoundsCommand[] = Object.freeze([]);

/**
 * Returned disposal commands must be flushed only after the physics step or
 * callback boundary. This function never destroys a body, component, or node.
 */
export function createClassicBoundsCommands(
  input: ClassicBoundsInput,
): readonly ClassicBoundsCommand[] {
  assertObject(input, 'input');
  const position = copyFloat32Vector(input.positionWorldUnits, 'positionWorldUnits');
  const velocity = copyFloat32Vector(
    input.linearVelocityMetresPerSecond,
    'linearVelocityMetresPerSecond',
  );
  const viewportWidth = toPositiveFloat32(
    input.viewportWidthWorldUnits,
    'viewportWidthWorldUnits',
  );
  const viewportHeight = toPositiveFloat32(
    input.viewportHeightWorldUnits,
    'viewportHeightWorldUnits',
  );

  if (velocity.x === 0 && velocity.y === 0) {
    return NO_BOUNDS_COMMANDS;
  }

  const minimumX = Math.fround(-viewportWidth * LOWER_BOUNDS_RATIO);
  const minimumY = Math.fround(-viewportHeight * LOWER_BOUNDS_RATIO);
  const maximumX = Math.fround(viewportWidth * UPPER_BOUNDS_RATIO);
  const maximumY = Math.fround(viewportHeight * UPPER_BOUNDS_RATIO);

  if (position.y < minimumY) {
    return Object.freeze([
      Object.freeze({ type: 'fail', positionWorldUnits: position }),
      Object.freeze({ type: 'defer-dispose', boundary: 'below' }),
    ]);
  }
  if (position.y > maximumY) {
    return disposeAt('above');
  }
  if (position.x < minimumX) {
    return disposeAt('left');
  }
  if (position.x > maximumX) {
    return disposeAt('right');
  }
  return NO_BOUNDS_COMMANDS;
}

function disposeAt(boundary: DisposalBoundary): readonly ClassicBoundsCommand[] {
  return Object.freeze([
    Object.freeze({ type: 'defer-dispose', boundary }),
  ]);
}

function copyFloat32Vector(value: BoundsVector2, label: string): BoundsVector2 {
  assertObject(value, label);
  return Object.freeze({
    x: toFloat32(value.x, `${label}.x`),
    y: toFloat32(value.y, `${label}.y`),
  });
}

/** Target-only validation rejects malformed adapter values before evaluation. */
function toFloat32(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
  const floatValue = Math.fround(value);
  if (!Number.isFinite(floatValue)) {
    throw new RangeError(`${label} must fit a finite float32 value`);
  }
  return floatValue;
}

function toPositiveFloat32(value: number, label: string): number {
  const floatValue = toFloat32(value, label);
  if (floatValue <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
  return floatValue;
}

function assertObject(value: object, label: string): void {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
}
