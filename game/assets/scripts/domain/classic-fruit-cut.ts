/** Recovered Classic fruit-effect routing before score submission. */

export const ELECTRIC_FRUIT_ID = 13;
export const MAGNET_FRUIT_ID = 14;
export const NORMAL_FRUIT_SCORE = 1;
export const CRITICAL_FRUIT_SCORE = 10;

export interface ClassicFruitCutPosition {
  readonly x: number;
  readonly y: number;
}

export type ClassicFruitCutCommand =
  | Readonly<{ type: 'start-electric-bomb' }>
  | Readonly<{
      type: 'create-magnet-animation';
      beginCallback: 'magnet-begin';
      endCallback: 'magnet-end';
      zOrder: 1;
    }>
  | Readonly<{ type: 'add-score'; value: number }>;

/** Fruit::GetScore returns exactly one point, or ten for a critical fruit. */
export function getFruitScore(critical: boolean): 1 | 10 {
  if (typeof critical !== 'boolean') {
    throw new TypeError('critical must be a boolean');
  }
  return critical ? CRITICAL_FRUIT_SCORE : NORMAL_FRUIT_SCORE;
}

/**
 * The recovered Classic callback does not use the supplied position itself,
 * but it remains part of the cut-notification contract and is validated here.
 */
export function createClassicFruitCutCommands(
  position: ClassicFruitCutPosition,
  fruitId: number,
  suppliedScore: number,
): readonly ClassicFruitCutCommand[] {
  assertPosition(position);
  assertSafeInteger(fruitId, 'fruitId');
  assertSafeInteger(suppliedScore, 'suppliedScore');

  if (fruitId === ELECTRIC_FRUIT_ID) {
    return Object.freeze([
      Object.freeze({ type: 'start-electric-bomb' }),
      Object.freeze({ type: 'add-score', value: CRITICAL_FRUIT_SCORE }),
    ]);
  }

  if (fruitId === MAGNET_FRUIT_ID) {
    return Object.freeze([
      Object.freeze({
        type: 'create-magnet-animation',
        beginCallback: 'magnet-begin',
        endCallback: 'magnet-end',
        zOrder: 1,
      }),
      Object.freeze({ type: 'add-score', value: CRITICAL_FRUIT_SCORE }),
    ]);
  }

  return Object.freeze([
    Object.freeze({ type: 'add-score', value: suppliedScore }),
  ]);
}

/** Target-only validation rejects malformed adapter input before routing. */
function assertPosition(position: ClassicFruitCutPosition): void {
  if (position === null || typeof position !== 'object') {
    throw new TypeError('position must be an object');
  }
  assertFinite(position.x, 'position.x');
  assertFinite(position.y, 'position.y');
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}
