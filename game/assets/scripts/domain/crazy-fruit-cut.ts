/** Recovered Crazy fruit-effect routing before score submission. */

export const CRAZY_DOUBLE_SCORE_FRUIT_ID = 10;
export const CRAZY_DOUBLE_TOSS_FRUIT_ID = 11;
export const CRAZY_FREEZE_FRUIT_ID = 12;
export const CRAZY_ELECTRIC_FRUIT_ID = 13;
export const CRAZY_MAGNET_FRUIT_ID = 14;
export const CRAZY_CRITICAL_SCORE = 10;

export interface CrazyFruitCutPosition {
  readonly x: number;
  readonly y: number;
}

export type CrazyFruitCutCommand =
  | Readonly<{ type: 'enable-double-score' }>
  | Readonly<{ type: 'start-double-toss' }>
  | Readonly<{ type: 'freeze-time' }>
  | Readonly<{ type: 'start-electric-bomb' }>
  | Readonly<{
      type: 'create-magnet-animation';
      beginCallback: 'magnet-begin';
      endCallback: 'magnet-end';
      zOrder: 1;
    }>
  | Readonly<{ type: 'add-score'; value: number }>;

/**
 * The recovered Crazy callback does not use the supplied position itself, but it remains part
 * of the cut-notification contract and is validated here.
 */
export function createCrazyFruitCutCommands(
  position: CrazyFruitCutPosition,
  fruitId: number,
  suppliedScore: number,
): readonly CrazyFruitCutCommand[] {
  assertPosition(position);
  assertSafeInteger(fruitId, 'fruitId');
  assertSafeInteger(suppliedScore, 'suppliedScore');

  switch (fruitId) {
    case CRAZY_DOUBLE_SCORE_FRUIT_ID:
      return Object.freeze([
        Object.freeze({ type: 'enable-double-score' }),
      ]);
    case CRAZY_DOUBLE_TOSS_FRUIT_ID:
      return Object.freeze([
        Object.freeze({ type: 'start-double-toss' }),
        Object.freeze({ type: 'add-score', value: CRAZY_CRITICAL_SCORE }),
      ]);
    case CRAZY_FREEZE_FRUIT_ID:
      return Object.freeze([
        Object.freeze({ type: 'freeze-time' }),
        Object.freeze({ type: 'add-score', value: CRAZY_CRITICAL_SCORE }),
      ]);
    case CRAZY_ELECTRIC_FRUIT_ID:
      return Object.freeze([
        Object.freeze({ type: 'start-electric-bomb' }),
        Object.freeze({ type: 'add-score', value: CRAZY_CRITICAL_SCORE }),
      ]);
    case CRAZY_MAGNET_FRUIT_ID:
      return Object.freeze([
        Object.freeze({
          type: 'create-magnet-animation',
          beginCallback: 'magnet-begin',
          endCallback: 'magnet-end',
          zOrder: 1,
        }),
        Object.freeze({ type: 'add-score', value: CRAZY_CRITICAL_SCORE }),
      ]);
    default:
      return Object.freeze([
        Object.freeze({ type: 'add-score', value: suppliedScore }),
      ]);
  }
}

function assertPosition(position: CrazyFruitCutPosition): void {
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
