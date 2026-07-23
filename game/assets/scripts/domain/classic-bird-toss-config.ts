/** Classic Bird's recovered mode and nine-controller toss graph. */

export const CLASSIC_BIRD_MODE_ID = 3 as const;

export type ClassicBirdTossDirection = 0 | 1;
export type ClassicBirdTossObjectType = 0 | 1 | 3 | 4 | 6;

export type ClassicBirdTossControllerId =
  | 'aa'
  | 'ab'
  | 'ac'
  | 'ad'
  | 'ae'
  | 'af'
  | 'b0'
  | 'b1'
  | 'b2';

export type ClassicBirdTossRole =
  | 'normal-free'
  | 'normal-concurrent'
  | 'normal-wave'
  | 'bomb-free'
  | 'bomb-concurrent'
  | 'bomb-wave'
  | 'dragon-free'
  | 'magnet-free'
  | 'electric-free';

export interface ClassicBirdTossInterval {
  readonly lowSeconds: number;
  readonly highSeconds: number;
}

interface ClassicBirdTossBaseRow {
  readonly id: ClassicBirdTossControllerId;
  readonly role: ClassicBirdTossRole;
  readonly slotOffset: number;
  readonly objectType: ClassicBirdTossObjectType;
  readonly direction: ClassicBirdTossDirection;
  readonly outerInterval: ClassicBirdTossInterval;
  readonly zOrder: 1;
}

export interface ClassicBirdFreeTossRow extends ClassicBirdTossBaseRow {
  readonly controller: 'free';
  readonly fixedFruitId?: 13 | 14;
}

export interface ClassicBirdConcurrentTossRow extends ClassicBirdTossBaseRow {
  readonly controller: 'concurrent';
  /** Constructor arguments recovered from the native graph. */
  readonly countMin: number;
  readonly countMax: number;
  /** The shared inclusive helper is called with `countMax + 1`. */
  readonly actualCountMinInclusive: number;
  readonly actualCountMaxInclusive: number;
}

export interface ClassicBirdWaveTossRow extends ClassicBirdTossBaseRow {
  readonly controller: 'wave';
  readonly internalInterval: ClassicBirdTossInterval;
  readonly activeWindow: ClassicBirdTossInterval;
}

export type ClassicBirdTossRow =
  | ClassicBirdFreeTossRow
  | ClassicBirdConcurrentTossRow
  | ClassicBirdWaveTossRow;

function interval(
  lowSeconds: number,
  highSeconds: number,
): ClassicBirdTossInterval {
  return Object.freeze({ lowSeconds, highSeconds });
}

export const CLASSIC_BIRD_NORMAL_FRUIT_INTERVAL = interval(0.75, 5);
export const CLASSIC_BIRD_MAGNET_NORMAL_FRUIT_INTERVAL = interval(0.5, 1.5);
export const CLASSIC_BIRD_WAVE_CHILD_INTERVAL = interval(0.25, 0.75);

/**
 * Native instance-slot construction order. The normal and bomb Wave children both start,
 * sample this shared RNG, and pause while their outer controller is attached.
 */
export const CLASSIC_BIRD_TOSS_ROWS: readonly ClassicBirdTossRow[] = Object.freeze([
  Object.freeze({
    id: 'aa',
    role: 'normal-free',
    slotOffset: 0x2a8,
    controller: 'free',
    objectType: 0,
    direction: 0,
    outerInterval: CLASSIC_BIRD_NORMAL_FRUIT_INTERVAL,
    zOrder: 1,
  }),
  Object.freeze({
    id: 'ab',
    role: 'normal-concurrent',
    slotOffset: 0x2ac,
    controller: 'concurrent',
    objectType: 0,
    direction: 0,
    outerInterval: interval(15, 25),
    countMin: 2,
    countMax: 4,
    actualCountMinInclusive: 2,
    actualCountMaxInclusive: 5,
    zOrder: 1,
  }),
  Object.freeze({
    id: 'ac',
    role: 'normal-wave',
    slotOffset: 0x2b0,
    controller: 'wave',
    objectType: 0,
    direction: 0,
    outerInterval: interval(7.55, 17),
    internalInterval: CLASSIC_BIRD_WAVE_CHILD_INTERVAL,
    activeWindow: interval(1.5, 3),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'ad',
    role: 'bomb-free',
    slotOffset: 0x2b4,
    controller: 'free',
    objectType: 1,
    direction: 0,
    outerInterval: interval(10, 30),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'ae',
    role: 'bomb-concurrent',
    slotOffset: 0x2b8,
    controller: 'concurrent',
    objectType: 1,
    direction: 0,
    outerInterval: interval(15, 45),
    countMin: 1,
    countMax: 3,
    actualCountMinInclusive: 1,
    actualCountMaxInclusive: 4,
    zOrder: 1,
  }),
  Object.freeze({
    id: 'af',
    role: 'bomb-wave',
    slotOffset: 0x2bc,
    controller: 'wave',
    objectType: 1,
    direction: 0,
    outerInterval: interval(30, 60),
    internalInterval: CLASSIC_BIRD_WAVE_CHILD_INTERVAL,
    activeWindow: interval(1, 2),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'b0',
    role: 'dragon-free',
    slotOffset: 0x2c0,
    controller: 'free',
    objectType: 6,
    direction: 1,
    outerInterval: interval(30, 75),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'b1',
    role: 'magnet-free',
    slotOffset: 0x2c4,
    controller: 'free',
    objectType: 4,
    fixedFruitId: 14,
    direction: 1,
    outerInterval: interval(45, 90),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'b2',
    role: 'electric-free',
    slotOffset: 0x2c8,
    controller: 'free',
    objectType: 3,
    fixedFruitId: 13,
    direction: 1,
    outerInterval: interval(30, 60),
    zOrder: 1,
  }),
]);

/** Recovered `onEnter` construction and equal-z attachment order. */
export const CLASSIC_BIRD_TOSS_CREATION_ORDER:
  readonly ClassicBirdTossControllerId[] = Object.freeze([
  'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'b0', 'b1', 'b2',
]);

/** Recovered `StartGameCallback` order and therefore its nine interval draws. */
export const CLASSIC_BIRD_TOSS_START_ORDER:
  readonly ClassicBirdTossControllerId[] = Object.freeze([
  'aa', 'b0', 'b1', 'b2', 'ab', 'ac', 'ad', 'ae', 'af',
]);

/** Bomb and miss shutdown both stop the same nine controllers in start order. */
export const CLASSIC_BIRD_TOSS_STOP_ORDER:
  readonly ClassicBirdTossControllerId[] = Object.freeze([
  ...CLASSIC_BIRD_TOSS_START_ORDER,
]);

/** Only these three bomb controllers are paused by the mode-specific magnet callback. */
export const CLASSIC_BIRD_MAGNET_BOMB_CONTROLLER_ORDER = Object.freeze([
  'ad', 'ae', 'af',
] as const);

export function getClassicBirdTossRow(
  controllerId: ClassicBirdTossControllerId,
): ClassicBirdTossRow {
  const row = CLASSIC_BIRD_TOSS_ROWS.find(({ id }) => id === controllerId);
  if (row === undefined) {
    throw new RangeError(`unknown Classic Bird controller ${controllerId}`);
  }
  return row;
}
