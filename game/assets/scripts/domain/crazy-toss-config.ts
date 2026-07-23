/** Crazy-mode controller table recovered from native onEnter/start/time-up ordering. */

export const CRAZY_MODE_ID = 1 as const;
export const CRAZY_BIRD_MODE_ID = 4 as const;

export interface CrazyTossIntervalConfig {
  readonly lowSeconds: number;
  readonly highSeconds: number;
}

export type CrazyTossControllerId =
  | 'ab'
  | 'b0'
  | 'b2'
  | 'ac'
  | 'b1'
  | 'b3'
  | 'b4'
  | 'af'
  | 'ae'
  | 'ad'
  | 'b5';

type CrazyTossControllerKind = 'free' | 'concurrent' | 'wave' | 'double' | 'bonus';

interface CrazyTossBaseRow {
  readonly id: CrazyTossControllerId;
  readonly slotOffset: number;
  readonly controller: CrazyTossControllerKind;
  readonly zOrder: 1;
}

export interface CrazyFreeTossRow extends CrazyTossBaseRow {
  readonly controller: 'free';
  readonly objectType: 0 | 1 | 3 | 4 | 6;
  readonly direction: 0 | 1 | 2 | 3;
  readonly outerInterval: CrazyTossIntervalConfig;
}

export interface CrazyConcurrentTossRow extends CrazyTossBaseRow {
  readonly controller: 'concurrent';
  readonly objectType: 0 | 1;
  readonly direction: 0;
  readonly outerInterval: CrazyTossIntervalConfig;
  readonly countMin: number;
  readonly countMax: number;
}

export interface CrazyWaveTossRow extends CrazyTossBaseRow {
  readonly controller: 'wave';
  readonly objectType: 0 | 1;
  readonly direction: 0;
  readonly outerInterval: CrazyTossIntervalConfig;
  readonly internalInterval: CrazyTossIntervalConfig;
  readonly activeWindow: CrazyTossIntervalConfig;
}

export interface CrazyDoubleTossRow extends CrazyTossBaseRow {
  readonly controller: 'double';
  readonly guardedSeconds: 15;
  readonly internalInterval: CrazyTossIntervalConfig;
  readonly directions: readonly ['left', 'right'];
}

export interface CrazyBonusTossRow extends CrazyTossBaseRow {
  readonly controller: 'bonus';
  readonly objectType: 5;
  readonly outerInterval: CrazyTossIntervalConfig;
  readonly candidateFruitIds: readonly [12, 10, 11];
  readonly directionMode: 'left-right-down';
}

export type CrazyTossRow =
  | CrazyFreeTossRow
  | CrazyConcurrentTossRow
  | CrazyWaveTossRow
  | CrazyDoubleTossRow
  | CrazyBonusTossRow;

function interval(lowSeconds: number, highSeconds: number): CrazyTossIntervalConfig {
  return Object.freeze({ lowSeconds, highSeconds });
}

export const CRAZY_TOSS_ROWS: readonly CrazyTossRow[] = Object.freeze([
  Object.freeze({
    id: 'ab',
    slotOffset: 0x2ac,
    controller: 'free',
    direction: 0,
    objectType: 0,
    outerInterval: interval(0.5, 3),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'b0',
    slotOffset: 0x2c0,
    controller: 'concurrent',
    direction: 0,
    objectType: 0,
    outerInterval: interval(7, 18),
    countMin: 1,
    countMax: 3,
    zOrder: 1,
  }),
  Object.freeze({
    id: 'b2',
    slotOffset: 0x2c8,
    controller: 'wave',
    direction: 0,
    objectType: 0,
    outerInterval: interval(6, 18),
    internalInterval: interval(0.25, 0.75),
    activeWindow: interval(1.5, 3),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'ac',
    slotOffset: 0x2b0,
    controller: 'free',
    direction: 0,
    objectType: 1,
    outerInterval: interval(7, 24),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'b1',
    slotOffset: 0x2c4,
    controller: 'concurrent',
    direction: 0,
    objectType: 1,
    outerInterval: interval(15, 30),
    countMin: 1,
    countMax: 2,
    zOrder: 1,
  }),
  Object.freeze({
    id: 'b3',
    slotOffset: 0x2cc,
    controller: 'wave',
    direction: 0,
    objectType: 1,
    outerInterval: interval(15, 35),
    internalInterval: interval(0.25, 0.75),
    activeWindow: interval(0.75, 1.5),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'b4',
    slotOffset: 0x2d0,
    controller: 'double',
    guardedSeconds: 15,
    directions: Object.freeze(['left', 'right'] as const),
    internalInterval: interval(0.75, 1.5),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'af',
    slotOffset: 0x2bc,
    controller: 'free',
    direction: 1,
    objectType: 3,
    outerInterval: interval(30, 45),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'ae',
    slotOffset: 0x2b8,
    controller: 'free',
    direction: 1,
    objectType: 4,
    outerInterval: interval(20, 45),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'ad',
    slotOffset: 0x2b4,
    controller: 'free',
    direction: 1,
    objectType: 6,
    outerInterval: interval(15, 60),
    zOrder: 1,
  }),
  Object.freeze({
    id: 'b5',
    slotOffset: 0x2d4,
    controller: 'bonus',
    objectType: 5,
    outerInterval: interval(5, 30),
    candidateFruitIds: Object.freeze([12, 10, 11] as const),
    directionMode: 'left-right-down',
    zOrder: 1,
  }),
]);

export const CRAZY_TOSS_CREATION_ORDER: readonly CrazyTossControllerId[] = Object.freeze([
  'ab', 'b0', 'b2', 'ac', 'b1', 'b3', 'b4', 'af', 'ae', 'ad', 'b5',
]);

export const CRAZY_TOSS_START_ORDER: readonly CrazyTossControllerId[] = Object.freeze([
  'ab', 'b0', 'b2', 'ac', 'b1', 'b3', 'ad', 'b5', 'ae', 'af',
]);

export const CRAZY_TOSS_BOMB_HIT_STOP_ORDER: readonly CrazyTossControllerId[] = Object.freeze([
  'ae',
]);

export const CRAZY_TOSS_TIME_UP_STOP_ORDER: readonly CrazyTossControllerId[] = Object.freeze([
  'ab', 'ad', 'ae', 'af', 'b0', 'b2', 'ac', 'b1', 'b3',
]);

export const CRAZY_TOSS_STARTABLE_IDS: readonly CrazyTossControllerId[] = Object.freeze([
  'ab', 'b0', 'b2', 'ac', 'b1', 'b3', 'af', 'ae', 'ad', 'b5',
]);

export const CRAZY_TOSS_STOPPABLE_IDS: readonly CrazyTossControllerId[] = Object.freeze([
  'ab', 'b0', 'b2', 'ac', 'b1', 'b3', 'af', 'ae', 'ad',
]);

export function isCrazyStartableControllerId(
  controllerId: CrazyTossControllerId,
): controllerId is typeof CRAZY_TOSS_STARTABLE_IDS[number] {
  return CRAZY_TOSS_STARTABLE_IDS.some((value) => value === controllerId);
}

export function isCrazyStoppableControllerId(
  controllerId: CrazyTossControllerId,
): controllerId is typeof CRAZY_TOSS_STOPPABLE_IDS[number] {
  return CRAZY_TOSS_STOPPABLE_IDS.some((value) => value === controllerId);
}
