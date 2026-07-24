import {
  classicBirdLeaderboardPanelValues,
  type ClassicBirdLeaderboard,
} from './classic-bird-result-ranking';
import {
  classicLeaderboardPanelValues,
  type ClassicLeaderboard,
} from './classic-result-ranking';
import {
  comboBirdLeaderboardPanelValues,
  type ComboBirdLeaderboard,
} from './combo-bird-result-ranking';
import {
  crazyBirdLeaderboardPanelValues,
  type CrazyBirdLeaderboard,
} from './crazy-bird-result-ranking';
import {
  crazyLeaderboardPanelValues,
  type CrazyLeaderboard,
} from './crazy-result-ranking';
import {
  gnStyleLeaderboardPanelValues,
  type GnStyleLeaderboard,
} from './gn-style-result-ranking';

export const LEADERBOARD_MODE_COUNT = 6 as const;
export const LEADERBOARD_LAST_INDEX = 5 as const;
export const LEADERBOARD_INITIAL_CURRENT_INDEX = 0 as const;

export const LEADERBOARD_NATIVE_MODE_ORDER = Object.freeze([
  'classic',
  'crazy',
  'gn-style',
  'classic-bird',
  'crazy-bird',
  'combo-bird',
] as const);

const HALF = Math.fround(0.5);
const CENTERING_FACTOR = Math.fround(0.1);
const CENTERING_SNAP_THRESHOLD = Math.fround(2);
const LEADERBOARD_INPUT_KEYS = Object.freeze(['boards', 'logicalWidth'] as const);
const LEADERBOARD_BOARD_KEYS = Object.freeze([
  'classic',
  'crazy',
  'gnStyle',
  'classicBird',
  'crazyBird',
  'comboBird',
] as const);
const LEADERBOARD_SCORE_KEYS = Object.freeze(['first', 'second', 'third'] as const);

export type LeaderboardIndex = 0 | 1 | 2 | 3 | 4 | 5;
export type LeaderboardModeId = typeof LEADERBOARD_NATIVE_MODE_ORDER[number];
export type LeaderboardPanelValues = readonly [number, number, number];

export interface LeaderboardBoardsInput {
  readonly classic: ClassicLeaderboard;
  readonly crazy: CrazyLeaderboard;
  readonly gnStyle: GnStyleLeaderboard;
  readonly classicBird: ClassicBirdLeaderboard;
  readonly crazyBird: CrazyBirdLeaderboard;
  readonly comboBird: ComboBirdLeaderboard;
}

export interface LeaderboardStateInput {
  readonly boards: LeaderboardBoardsInput;
  /** Raw logical director width W. */
  readonly logicalWidth: number;
}

export interface LeaderboardBoardSnapshot {
  readonly index: LeaderboardIndex;
  readonly modeId: LeaderboardModeId;
  readonly values: LeaderboardPanelValues;
}

export type LeaderboardBoardsSnapshot = readonly [
  Readonly<LeaderboardBoardSnapshot & { readonly index: 0; readonly modeId: 'classic' }>,
  Readonly<LeaderboardBoardSnapshot & { readonly index: 1; readonly modeId: 'crazy' }>,
  Readonly<LeaderboardBoardSnapshot & { readonly index: 2; readonly modeId: 'gn-style' }>,
  Readonly<LeaderboardBoardSnapshot & { readonly index: 3; readonly modeId: 'classic-bird' }>,
  Readonly<LeaderboardBoardSnapshot & { readonly index: 4; readonly modeId: 'crazy-bird' }>,
  Readonly<LeaderboardBoardSnapshot & { readonly index: 5; readonly modeId: 'combo-bird' }>,
];

export interface LeaderboardStateSnapshot {
  readonly boards: LeaderboardBoardsSnapshot;
  readonly currentIndex: LeaderboardIndex;
  readonly itemXs: readonly number[];
  readonly logicalWidth: number;
}

export interface LeaderboardDragResult {
  readonly appliedDeltaX: number;
  readonly currentIndex: LeaderboardIndex;
  readonly moved: boolean;
}

export interface LeaderboardFlickResult {
  readonly changed: boolean;
  readonly currentIndex: LeaderboardIndex;
  readonly previousIndex: LeaderboardIndex;
}

export interface LeaderboardFrameResult {
  readonly appliedDeltaX: number;
  readonly centerError: number | null;
  readonly pressed: boolean;
}

/**
 * Pure, snapshot-oriented model of the recovered six-item Leaderboard rail.
 *
 * Boards are copied once at construction. This model owns no persistence,
 * ranking mutation, rendering, input subscription, or clock-based behavior.
 */
export class LeaderboardState {
  private readonly boardsValue: LeaderboardBoardsSnapshot;
  private readonly logicalWidthValue: number;
  private itemXsValue: number[];
  private currentIndexValue: LeaderboardIndex = LEADERBOARD_INITIAL_CURRENT_INDEX;

  constructor(input: LeaderboardStateInput) {
    assertExactObject(input, LEADERBOARD_INPUT_KEYS, 'input');
    this.logicalWidthValue = positiveFiniteFloat32(
      input.logicalWidth,
      'input.logicalWidth',
    );
    this.boardsValue = copyBoards(input.boards);
    this.itemXsValue = createInitialItemXs(this.logicalWidthValue);
  }

  get snapshot(): LeaderboardStateSnapshot {
    return Object.freeze({
      boards: this.boardsValue,
      currentIndex: this.currentIndexValue,
      itemXs: Object.freeze([...this.itemXsValue]),
      logicalWidth: this.logicalWidthValue,
    });
  }

  /**
   * Applies the complete native gesture delta after pre-move edge guards.
   * Nearest-index recomputation runs for accepted, rejected, and zero deltas.
   */
  drag(deltaX: number): LeaderboardDragResult {
    const floatDeltaX = finiteFloat32(deltaX, 'deltaX');
    const firstItemX = requireItemX(this.itemXsValue, 0);
    const lastItemX = requireItemX(this.itemXsValue, LEADERBOARD_LAST_INDEX);
    const canMove = (
      floatDeltaX < 0
      && lastItemX >= 0
    ) || (
      floatDeltaX > 0
      && firstItemX <= this.logicalWidthValue
    );
    const nextItemXs = canMove
      ? shiftedItemXs(this.itemXsValue, floatDeltaX)
      : this.itemXsValue;
    const nextCurrentIndex = nearestIndex(
      nextItemXs,
      this.logicalWidthValue,
      this.currentIndexValue,
    );

    if (canMove) {
      this.itemXsValue = nextItemXs;
    }
    this.currentIndexValue = nextCurrentIndex;
    return Object.freeze({
      appliedDeltaX: canMove ? floatDeltaX : 0,
      currentIndex: nextCurrentIndex,
      moved: canMove,
    });
  }

  /** Changes only the selected index; item positions move on a later frame. */
  flick(deltaX: number): LeaderboardFlickResult {
    const floatDeltaX = finiteFloat32(deltaX, 'deltaX');
    const previousIndex = this.currentIndexValue;
    let nextIndex = previousIndex;
    if (floatDeltaX > 0 && previousIndex > 0) {
      nextIndex = (previousIndex - 1) as LeaderboardIndex;
    } else if (floatDeltaX < 0 && previousIndex < LEADERBOARD_LAST_INDEX) {
      nextIndex = (previousIndex + 1) as LeaderboardIndex;
    }
    this.currentIndexValue = nextIndex;
    return Object.freeze({
      changed: nextIndex !== previousIndex,
      currentIndex: nextIndex,
      previousIndex,
    });
  }

  /** Advances one scheduled frame; no timing input is accepted. */
  updateFrame(pressed: boolean): LeaderboardFrameResult {
    if (typeof pressed !== 'boolean') {
      throw new TypeError('pressed must be a boolean');
    }
    if (pressed) {
      return Object.freeze({
        appliedDeltaX: 0,
        centerError: null,
        pressed: true,
      });
    }

    const currentItemX = requireItemX(this.itemXsValue, this.currentIndexValue);
    const targetX = multiplyFloat32(HALF, this.logicalWidthValue);
    const centerError = subtractFloat32(targetX, currentItemX);
    let deltaX = centerError;
    if (centerError === 0) {
      deltaX = 0;
    } else if (Math.abs(centerError) > CENTERING_SNAP_THRESHOLD) {
      deltaX = addFloat32(
        multiplyFloat32(CENTERING_FACTOR, centerError),
        divideFloat32(Math.abs(centerError), centerError),
      );
    }

    if (deltaX !== 0) {
      this.itemXsValue = shiftedItemXs(this.itemXsValue, deltaX);
    }
    return Object.freeze({
      appliedDeltaX: deltaX,
      centerError,
      pressed: false,
    });
  }
}

function copyBoards(boards: LeaderboardBoardsInput): LeaderboardBoardsSnapshot {
  assertExactObject(boards, LEADERBOARD_BOARD_KEYS, 'input.boards');
  assertScoreBoard(boards.classic, 'input.boards.classic');
  assertScoreBoard(boards.crazy, 'input.boards.crazy');
  assertScoreBoard(boards.gnStyle, 'input.boards.gnStyle');
  assertScoreBoard(boards.classicBird, 'input.boards.classicBird');
  assertScoreBoard(boards.crazyBird, 'input.boards.crazyBird');
  assertScoreBoard(boards.comboBird, 'input.boards.comboBird');

  return Object.freeze([
    freezeBoardSnapshot(
      0,
      'classic',
      classicLeaderboardPanelValues(boards.classic),
    ),
    freezeBoardSnapshot(
      1,
      'crazy',
      crazyLeaderboardPanelValues(boards.crazy),
    ),
    freezeBoardSnapshot(
      2,
      'gn-style',
      gnStyleLeaderboardPanelValues(boards.gnStyle),
    ),
    freezeBoardSnapshot(
      3,
      'classic-bird',
      classicBirdLeaderboardPanelValues(boards.classicBird),
    ),
    freezeBoardSnapshot(
      4,
      'crazy-bird',
      crazyBirdLeaderboardPanelValues(boards.crazyBird),
    ),
    freezeBoardSnapshot(
      5,
      'combo-bird',
      comboBirdLeaderboardPanelValues(boards.comboBird),
    ),
  ]);
}

function freezeBoardSnapshot<
  Index extends LeaderboardIndex,
  ModeId extends LeaderboardModeId,
>(
  index: Index,
  modeId: ModeId,
  values: LeaderboardPanelValues,
): Readonly<LeaderboardBoardSnapshot & {
  readonly index: Index;
  readonly modeId: ModeId;
}> {
  return Object.freeze({
    index,
    modeId,
    values: Object.freeze([values[0], values[1], values[2]] as const),
  });
}

function createInitialItemXs(logicalWidth: number): number[] {
  return Array.from({ length: LEADERBOARD_MODE_COUNT }, (_, index) => (
    finiteFloat32(
      multiplyFloat32(Math.fround(index + HALF), logicalWidth),
      `initial itemXs[${index}]`,
    )
  ));
}

function nearestIndex(
  itemXs: readonly number[],
  logicalWidth: number,
  previousIndex: LeaderboardIndex,
): LeaderboardIndex {
  const targetX = multiplyFloat32(HALF, logicalWidth);
  let bestDistance = logicalWidth;
  let nextIndex: LeaderboardIndex | null = null;
  for (let index = 0; index < LEADERBOARD_MODE_COUNT; index += 1) {
    const distance = Math.abs(subtractFloat32(
      requireItemX(itemXs, index),
      targetX,
    ));
    if (distance < bestDistance) {
      bestDistance = distance;
      nextIndex = index as LeaderboardIndex;
    }
  }

  // A pathological one-event overshoot can put every item at least W from
  // center. Retaining the prior valid index keeps later snap recovery defined.
  return nextIndex ?? previousIndex;
}

function shiftedItemXs(itemXs: readonly number[], deltaX: number): number[] {
  return itemXs.map((itemX, index) => finiteFloat32(
    addFloat32(itemX, deltaX),
    `itemXs[${index}] after move`,
  ));
}

function requireItemX(itemXs: readonly number[], index: number): number {
  const itemX = itemXs[index];
  if (itemX === undefined) {
    throw new Error(`Leaderboard item ${index} is unavailable`);
  }
  return itemX;
}

function assertScoreBoard(
  value: Readonly<{ readonly first: number; readonly second: number; readonly third: number }>,
  label: string,
): void {
  assertExactObject(value, LEADERBOARD_SCORE_KEYS, label);
}

function assertExactObject(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== expectedKeys.length
    || expectedKeys.some((key) => (
      !Object.prototype.hasOwnProperty.call(value, key)
    ))
  ) {
    throw new RangeError(`${label} must contain exactly ${expectedKeys.join(', ')}`);
  }
}

function positiveFiniteFloat32(value: number, label: string): number {
  const floatValue = finiteFloat32(value, label);
  if (floatValue <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
  return floatValue;
}

function finiteFloat32(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite`);
  }
  const floatValue = Math.fround(value);
  if (!Number.isFinite(floatValue)) {
    throw new RangeError(`${label} must fit a finite float32`);
  }
  return floatValue;
}

function addFloat32(left: number, right: number): number {
  return Math.fround(left + right);
}

function subtractFloat32(left: number, right: number): number {
  return Math.fround(left - right);
}

function multiplyFloat32(left: number, right: number): number {
  return Math.fround(left * right);
}

function divideFloat32(numerator: number, denominator: number): number {
  return Math.fround(numerator / denominator);
}
