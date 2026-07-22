/** Numeric ABI recovered for the four toss directions. */
export type ClassicTossDirection = 0 | 1 | 2 | 3;

/** Numeric toss types used by the fixed Classic table. */
export type ClassicTossObjectType = 0 | 1 | 3 | 4 | 6;

export type ClassicTossControllerId =
  | 'a9'
  | 'aa'
  | 'ab'
  | 'ac'
  | 'ad'
  | 'ae'
  | 'af'
  | 'b0'
  | 'b1';

export interface TossIntervalConfig {
  readonly lowSeconds: number;
  readonly highSeconds: number;
}

interface ClassicTossBaseRow {
  readonly id: ClassicTossControllerId;
  readonly slotOffset: number;
  readonly objectType: ClassicTossObjectType;
  readonly direction: ClassicTossDirection;
  readonly outerInterval: TossIntervalConfig;
  readonly zOrder: 1;
}

export interface ClassicFreeTossRow extends ClassicTossBaseRow {
  readonly controller: 'free';
}

export interface ClassicConcurrentTossRow extends ClassicTossBaseRow {
  readonly controller: 'concurrent';
  readonly countMin: number;
  readonly countMax: number;
}

export interface ClassicWaveTossRow extends ClassicTossBaseRow {
  readonly controller: 'wave';
  readonly internalInterval: TossIntervalConfig;
  readonly activeWindow: TossIntervalConfig;
}

export type ClassicTossRow =
  | ClassicFreeTossRow
  | ClassicConcurrentTossRow
  | ClassicWaveTossRow;

function interval(lowSeconds: number, highSeconds: number): TossIntervalConfig {
  return Object.freeze({ lowSeconds, highSeconds });
}

/**
 * Recovered construction rows in native slot order. Objects and nested intervals are frozen;
 * the table intentionally contains no DoubleToss or BonusToss entry.
 */
export const CLASSIC_TOSS_ROWS: readonly ClassicTossRow[] = Object.freeze([
  Object.freeze({
    id: 'a9',
    slotOffset: 0x2a4,
    controller: 'free',
    objectType: 0,
    direction: 0,
    outerInterval: interval(0.5, 3),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'aa',
    slotOffset: 0x2a8,
    controller: 'concurrent',
    objectType: 0,
    direction: 0,
    outerInterval: interval(7, 17),
    countMin: 2,
    countMax: 4,
    zOrder: 1,
  }),
  Object.freeze({
    id: 'ab',
    slotOffset: 0x2ac,
    controller: 'wave',
    objectType: 0,
    direction: 0,
    outerInterval: interval(5, 15),
    internalInterval: interval(0.25, 0.75),
    activeWindow: interval(1.5, 3),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'ac',
    slotOffset: 0x2b0,
    controller: 'free',
    objectType: 1,
    direction: 0,
    outerInterval: interval(7, 24),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'ad',
    slotOffset: 0x2b4,
    controller: 'concurrent',
    objectType: 1,
    direction: 0,
    outerInterval: interval(25, 50),
    countMin: 1,
    countMax: 2,
    zOrder: 1,
  }),
  Object.freeze({
    id: 'ae',
    slotOffset: 0x2b8,
    controller: 'wave',
    objectType: 1,
    direction: 0,
    outerInterval: interval(30, 60),
    internalInterval: interval(0.25, 0.75),
    activeWindow: interval(0.5, 1.5),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'af',
    slotOffset: 0x2bc,
    controller: 'free',
    objectType: 6,
    direction: 1,
    outerInterval: interval(30, 75),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'b0',
    slotOffset: 0x2c0,
    controller: 'free',
    objectType: 4,
    direction: 1,
    outerInterval: interval(45, 90),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'b1',
    slotOffset: 0x2c4,
    controller: 'free',
    objectType: 3,
    direction: 1,
    outerInterval: interval(45, 80),
    zOrder: 1,
  }),
]);

/** Recovered `onEnter` creation/add-child order. */
export const CLASSIC_TOSS_CREATION_ORDER: readonly ClassicTossControllerId[] = Object.freeze([
  'a9', 'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'b0', 'b1',
]);

/** Recovered `StartGameCallback` order; it determines initial interval draw order. */
export const CLASSIC_TOSS_START_ORDER: readonly ClassicTossControllerId[] = Object.freeze([
  'a9', 'af', 'b0', 'b1', 'aa', 'ab', 'ac', 'ad', 'ae',
]);

/** Recovered BombHit/GameOver stop order. Kept as a distinct immutable sequence. */
export const CLASSIC_TOSS_STOP_ORDER: readonly ClassicTossControllerId[] = Object.freeze([
  'a9', 'af', 'b0', 'b1', 'aa', 'ab', 'ac', 'ad', 'ae',
]);
