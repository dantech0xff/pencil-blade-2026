/** Combo Bird's recovered mode identity and ordinary-fruit-only toss graph. */

export const COMBO_BIRD_MODE_ID = 5 as const;

export type ComboBirdTossControllerId = 'free' | 'wave' | 'concurrent';
export type ComboBirdTossControllerKind = ComboBirdTossControllerId;
export type ComboBirdTossDirection = 0;
export type ComboBirdTossObjectType = 0;

export interface ComboBirdTossInterval {
  readonly lowSeconds: number;
  readonly highSeconds: number;
}

interface ComboBirdTossBaseRow {
  readonly controller: ComboBirdTossControllerKind;
  readonly direction: ComboBirdTossDirection;
  readonly id: ComboBirdTossControllerId;
  readonly objectType: ComboBirdTossObjectType;
  readonly outerInterval: ComboBirdTossInterval;
  readonly slotOffset: number;
  readonly zOrder: 1;
}

export interface ComboBirdFreeTossRow extends ComboBirdTossBaseRow {
  readonly controller: 'free';
  readonly id: 'free';
}

export interface ComboBirdWaveTossRow extends ComboBirdTossBaseRow {
  readonly activeWindow: ComboBirdTossInterval;
  readonly controller: 'wave';
  readonly id: 'wave';
  readonly internalInterval: ComboBirdTossInterval;
}

export interface ComboBirdConcurrentTossRow extends ComboBirdTossBaseRow {
  /** Constructor arguments recovered from the native graph. */
  readonly countMax: 3;
  readonly countMin: 1;
  readonly controller: 'concurrent';
  readonly id: 'concurrent';
  /** The shared inclusive helper is called with `countMax + 1`. */
  readonly actualCountMaxInclusive: 4;
  readonly actualCountMinInclusive: 1;
}

export type ComboBirdTossRow =
  | ComboBirdFreeTossRow
  | ComboBirdWaveTossRow
  | ComboBirdConcurrentTossRow;

function interval(
  lowSeconds: number,
  highSeconds: number,
): ComboBirdTossInterval {
  return Object.freeze({ highSeconds, lowSeconds });
}

export const COMBO_BIRD_FREE_OUTER_INTERVAL = interval(0.75, 5);
export const COMBO_BIRD_WAVE_OUTER_INTERVAL = interval(7.5, 20);
export const COMBO_BIRD_CONCURRENT_OUTER_INTERVAL = interval(10, 25);
export const COMBO_BIRD_WAVE_CHILD_INTERVAL = interval(0.25, 0.75);
export const COMBO_BIRD_WAVE_ACTIVE_WINDOW = interval(1.5, 3);

/** Maximum produced by the recovered decile sampler (`q = 0.9`), not the high limit. */
export const COMBO_BIRD_WAVE_ACTIVE_WINDOW_MAX_SAMPLE_SECONDS
  = Math.fround(2.85);

export const COMBO_BIRD_TOSS_ROWS: readonly ComboBirdTossRow[] = Object.freeze([
  Object.freeze({
    controller: 'free',
    direction: 0,
    id: 'free',
    objectType: 0,
    outerInterval: COMBO_BIRD_FREE_OUTER_INTERVAL,
    slotOffset: 0x2a8,
    zOrder: 1,
  }),
  Object.freeze({
    activeWindow: COMBO_BIRD_WAVE_ACTIVE_WINDOW,
    controller: 'wave',
    direction: 0,
    id: 'wave',
    internalInterval: COMBO_BIRD_WAVE_CHILD_INTERVAL,
    objectType: 0,
    outerInterval: COMBO_BIRD_WAVE_OUTER_INTERVAL,
    slotOffset: 0x2ac,
    zOrder: 1,
  }),
  Object.freeze({
    actualCountMaxInclusive: 4,
    actualCountMinInclusive: 1,
    controller: 'concurrent',
    countMax: 3,
    countMin: 1,
    direction: 0,
    id: 'concurrent',
    objectType: 0,
    outerInterval: COMBO_BIRD_CONCURRENT_OUTER_INTERVAL,
    slotOffset: 0x2b0,
    zOrder: 1,
  }),
]);

/** Creation, equal-z attachment, GO start, and Time Up outer-stop share this order. */
export const COMBO_BIRD_TOSS_CREATION_ORDER = Object.freeze([
  'free', 'wave', 'concurrent',
] as const satisfies readonly ComboBirdTossControllerId[]);

export const COMBO_BIRD_TOSS_START_ORDER = COMBO_BIRD_TOSS_CREATION_ORDER;
export const COMBO_BIRD_TOSS_OUTER_STOP_ORDER = COMBO_BIRD_TOSS_CREATION_ORDER;

export function getComboBirdTossRow(
  controllerId: ComboBirdTossControllerId,
): ComboBirdTossRow {
  const row = COMBO_BIRD_TOSS_ROWS.find(({ id }) => id === controllerId);
  if (row === undefined) {
    throw new RangeError(`unknown Combo Bird controller ${controllerId}`);
  }
  return row;
}
