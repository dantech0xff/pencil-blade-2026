import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

import type {
  LeaderboardBoardsInput,
  LeaderboardStateInput,
} from '../../../game/assets/scripts/domain/leaderboard-state.ts';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../'))
      && extname(specifier) === ''
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const {
  LEADERBOARD_INITIAL_CURRENT_INDEX,
  LEADERBOARD_LAST_INDEX,
  LEADERBOARD_MODE_COUNT,
  LEADERBOARD_NATIVE_MODE_ORDER,
  LeaderboardState,
} = await import('../../../game/assets/scripts/domain/leaderboard-state.ts');

const BOARD_FIELDS = Object.freeze([
  'classic',
  'crazy',
  'gnStyle',
  'classicBird',
  'crazyBird',
  'comboBird',
] as const);
const SCORE_FIELDS = Object.freeze(['first', 'second', 'third'] as const);

test('six native boards copy exact helper order into a deeply frozen index mapping', () => {
  const boards = createBoards();
  const state = new LeaderboardState({ boards, logicalWidth: 480 });

  boards.classic.first = -1;
  boards.crazy.second = -2;
  boards.gnStyle.third = -3;
  boards.classicBird.first = 1;
  boards.crazyBird.second = 1;
  boards.comboBird.third = 1;

  assert.equal(LEADERBOARD_MODE_COUNT, 6);
  assert.equal(LEADERBOARD_LAST_INDEX, 5);
  assert.equal(LEADERBOARD_INITIAL_CURRENT_INDEX, 0);
  assert.deepEqual(LEADERBOARD_NATIVE_MODE_ORDER, [
    'classic',
    'crazy',
    'gn-style',
    'classic-bird',
    'crazy-bird',
    'combo-bird',
  ]);
  assert.equal(Object.isFrozen(LEADERBOARD_NATIVE_MODE_ORDER), true);

  assert.deepEqual(state.snapshot.boards, [
    { index: 0, modeId: 'classic', values: [90, 60, 30] },
    { index: 1, modeId: 'crazy', values: [900, 600, 300] },
    { index: 2, modeId: 'gn-style', values: [9000, 6000, 3000] },
    { index: 3, modeId: 'classic-bird', values: [90_000, 60_000, 30_000] },
    { index: 4, modeId: 'crazy-bird', values: [900_000, 600_000, 300_000] },
    {
      index: 5,
      modeId: 'combo-bird',
      values: [0x7fff_ffff, 0, -0x8000_0000],
    },
  ]);
  assert.notEqual(state.snapshot.boards[0].values, boards.classic);
  assertDeepFrozen(state.snapshot);
});

test('initial item centers use exact float32 x(i)=(i+0.5)W for any positive width', () => {
  const compact = createState(480);
  const high = createState(720);
  const noncanonicalWidth = 481.9;
  const noncanonical = createState(noncanonicalWidth);

  assert.deepEqual(compact.snapshot.itemXs, [240, 720, 1200, 1680, 2160, 2640]);
  assert.deepEqual(high.snapshot.itemXs, [360, 1080, 1800, 2520, 3240, 3960]);
  assert.equal(compact.snapshot.currentIndex, 0);
  assert.equal(compact.snapshot.logicalWidth, 480);
  assert.equal(noncanonical.snapshot.logicalWidth, Math.fround(noncanonicalWidth));
  assert.deepEqual(
    noncanonical.snapshot.itemXs,
    Array.from({ length: 6 }, (_, index) => Math.fround(
      Math.fround(index + Math.fround(0.5))
        * Math.fround(noncanonicalWidth),
    )),
  );
  assertDeepFrozen(compact.snapshot);
  assertDeepFrozen(high.snapshot);
  assertDeepFrozen(noncanonical.snapshot);
});

test('drag applies a whole crossing delta, then guards later events at zero and raw W', () => {
  const left = createState();
  assert.deepEqual(left.drag(-2600), {
    appliedDeltaX: -2600,
    currentIndex: 5,
    moved: true,
  });
  assert.deepEqual(left.snapshot.itemXs, [-2360, -1880, -1400, -920, -440, 40]);
  assert.deepEqual(left.drag(-100), {
    appliedDeltaX: -100,
    currentIndex: 5,
    moved: true,
  });
  assert.equal(left.snapshot.itemXs[5], -60);

  left.flick(1);
  assert.equal(left.snapshot.currentIndex, 4);
  assert.deepEqual(left.drag(-1), {
    appliedDeltaX: 0,
    currentIndex: 5,
    moved: false,
  });
  assert.equal(left.snapshot.itemXs[5], -60);

  const right = createState();
  assert.deepEqual(right.drag(300), {
    appliedDeltaX: 300,
    currentIndex: 0,
    moved: true,
  });
  assert.equal(right.snapshot.itemXs[0], 540);
  right.flick(-1);
  assert.equal(right.snapshot.currentIndex, 1);
  assert.deepEqual(right.drag(1), {
    appliedDeltaX: 0,
    currentIndex: 0,
    moved: false,
  });
  assert.equal(right.snapshot.itemXs[0], 540);
});

test('every drag callback recomputes nearest center and strict ties retain lower index', () => {
  const zero = createState();
  zero.flick(-1);
  assert.equal(zero.snapshot.currentIndex, 1);
  const zeroResult = zero.drag(0);
  assert.deepEqual(zeroResult, {
    appliedDeltaX: 0,
    currentIndex: 0,
    moved: false,
  });

  const tied = createState();
  const before = tied.snapshot.itemXs;
  const tiedResult = tied.drag(-240);
  assert.deepEqual(tiedResult, {
    appliedDeltaX: -240,
    currentIndex: 0,
    moved: true,
  });
  assert.equal(tied.snapshot.itemXs[0], 0);
  assert.equal(tied.snapshot.itemXs[1], 480);
  assert.equal(
    tied.snapshot.itemXs.every((itemX, index) => itemX - before[index] === -240),
    true,
  );
  assertDeepFrozen(zeroResult);
  assertDeepFrozen(tiedResult);
});

test('pathological one-event overshoot retains a valid index for safe snap recovery', () => {
  const state = createState();
  state.flick(-1);
  state.flick(-1);
  assert.equal(state.snapshot.currentIndex, 2);

  const result = state.drag(1_000_000);

  assert.deepEqual(result, {
    appliedDeltaX: 1_000_000,
    currentIndex: 2,
    moved: true,
  });
  assert.equal(state.snapshot.itemXs[0], 1_000_240);
  assert.equal(state.snapshot.itemXs[5], 1_002_640);
  assert.equal(
    state.snapshot.itemXs.every((itemX) => (
      Math.abs(Math.fround(itemX - 240)) >= 480
    )),
    true,
  );

  const error = Math.fround(240 - 1_001_200);
  const expectedRecoveryDelta = Math.fround(
    Math.fround(Math.fround(0.1) * error)
      + Math.fround(Math.abs(error) / error),
  );
  assert.deepEqual(state.updateFrame(false), {
    appliedDeltaX: expectedRecoveryDelta,
    centerError: error,
    pressed: false,
  });
  assert.equal(state.snapshot.currentIndex, 2);
});

test('flick uses sign only, clamps at both endpoints, and never moves the rail', () => {
  const state = createState();
  const initialItemXs = state.snapshot.itemXs;

  assert.deepEqual(state.flick(999_999), {
    changed: false,
    currentIndex: 0,
    previousIndex: 0,
  });
  for (let expected = 1; expected <= LEADERBOARD_LAST_INDEX; expected += 1) {
    assert.deepEqual(state.flick(-0.001), {
      changed: true,
      currentIndex: expected,
      previousIndex: expected - 1,
    });
  }
  assert.deepEqual(state.flick(-999_999), {
    changed: false,
    currentIndex: 5,
    previousIndex: 5,
  });
  assert.deepEqual(state.flick(0), {
    changed: false,
    currentIndex: 5,
    previousIndex: 5,
  });
  assert.deepEqual(state.flick(0.001), {
    changed: true,
    currentIndex: 4,
    previousIndex: 5,
  });
  assert.deepEqual(state.snapshot.itemXs, initialItemXs);
  assertDeepFrozen(state.flick(1));
});

test('one final segment can apply drag and then an independent sign-directed flick', () => {
  const state = createState();

  assert.deepEqual(state.drag(-480), {
    appliedDeltaX: -480,
    currentIndex: 1,
    moved: true,
  });
  const afterDrag = state.snapshot.itemXs;
  assert.deepEqual(state.flick(-480), {
    changed: true,
    currentIndex: 2,
    previousIndex: 1,
  });
  assert.deepEqual(state.snapshot.itemXs, afterDrag);
});

test('pressed frames are inert and unpressed easing preserves exact float32 formula', () => {
  const pressed = createState();
  pressed.drag(-100);
  const beforePressed = pressed.snapshot;
  assert.deepEqual(pressed.updateFrame(true), {
    appliedDeltaX: 0,
    centerError: null,
    pressed: true,
  });
  assert.deepEqual(pressed.snapshot, beforePressed);

  const positive = createState();
  positive.drag(-100);
  assert.deepEqual(positive.updateFrame(false), {
    appliedDeltaX: 11,
    centerError: 100,
    pressed: false,
  });
  assert.equal(positive.snapshot.itemXs[0], 151);

  const negative = createState();
  negative.drag(100);
  assert.deepEqual(negative.updateFrame(false), {
    appliedDeltaX: -11,
    centerError: -100,
    pressed: false,
  });
  assert.equal(negative.snapshot.itemXs[0], 329);

  const centered = createState();
  assert.deepEqual(centered.updateFrame(false), {
    appliedDeltaX: 0,
    centerError: 0,
    pressed: false,
  });
});

test('strict |error| > 2 eases while residual magnitudes at most 2 land exactly', () => {
  const positiveResidual = createState();
  positiveResidual.drag(-2);
  assert.deepEqual(positiveResidual.updateFrame(false), {
    appliedDeltaX: 2,
    centerError: 2,
    pressed: false,
  });
  assert.equal(positiveResidual.snapshot.itemXs[0], 240);

  const negativeResidual = createState();
  negativeResidual.drag(2);
  assert.deepEqual(negativeResidual.updateFrame(false), {
    appliedDeltaX: -2,
    centerError: -2,
    pressed: false,
  });
  assert.equal(negativeResidual.snapshot.itemXs[0], 240);

  const eased = createState();
  eased.drag(-2.5);
  assert.deepEqual(eased.updateFrame(false), {
    appliedDeltaX: 1.25,
    centerError: 2.5,
    pressed: false,
  });
  assert.equal(eased.snapshot.itemXs[0], 238.75);
  assertDeepFrozen(eased.updateFrame(false));
});

test('constructor rejects malformed width, board closure, score shape, and ordering', () => {
  for (const input of [
    null,
    [],
    { boards: createBoards() },
    { boards: createBoards(), extra: true, logicalWidth: 480 },
    { boards: createBoards(), logicalWidth: 0 },
    { boards: createBoards(), logicalWidth: -1 },
    { boards: createBoards(), logicalWidth: Number.MIN_VALUE },
    { boards: createBoards(), logicalWidth: Number.NaN },
    { boards: createBoards(), logicalWidth: Number.POSITIVE_INFINITY },
    { boards: createBoards(), logicalWidth: Number.MAX_VALUE },
    { boards: createBoards(), logicalWidth: 3.4028234663852886e38 },
    { boards: null, logicalWidth: 480 },
    { boards: [], logicalWidth: 480 },
    {
      boards: { ...createBoards(), extra: { first: 3, second: 2, third: 1 } },
      logicalWidth: 480,
    },
  ]) {
    assert.throws(() => new LeaderboardState(input as never));
  }

  const missingBoard = createBoards() as Record<string, unknown>;
  delete missingBoard.comboBird;
  assert.throws(() => new LeaderboardState({
    boards: missingBoard,
    logicalWidth: 480,
  } as never));

  for (const boardField of BOARD_FIELDS) {
    for (const malformedBoard of [
      null,
      [],
      { first: 3, second: 2 },
      { extra: 0, first: 3, second: 2, third: 1 },
    ]) {
      assert.throws(() => new LeaderboardState(withBoard(
        boardField,
        malformedBoard,
      )));
    }

    for (const scoreField of SCORE_FIELDS) {
      for (const invalidScore of [
        Number.NaN,
        Number.NEGATIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        -0x8000_0001,
        0x8000_0000,
        1.5,
      ]) {
        const board = { first: 3, second: 2, third: 1 };
        board[scoreField] = invalidScore;
        assert.throws(() => new LeaderboardState(withBoard(boardField, board)));
      }
    }

    for (const unordered of [
      { first: 1, second: 2, third: 0 },
      { first: 2, second: 0, third: 1 },
    ]) {
      assert.throws(() => new LeaderboardState(withBoard(boardField, unordered)));
    }
  }
});

test('invalid transitions fail before mutation and finite float32 overflow cannot escape', () => {
  const state = createState();
  const initial = state.snapshot;
  for (const operation of [
    () => state.drag(Number.NaN),
    () => state.drag(Number.POSITIVE_INFINITY),
    () => state.drag(Number.MAX_VALUE),
    () => state.flick(Number.NaN),
    () => state.flick(Number.NEGATIVE_INFINITY),
    () => state.flick(Number.MAX_VALUE),
    () => state.updateFrame(0 as never),
    () => state.updateFrame('false' as never),
    () => state.updateFrame(null as never),
  ]) {
    assert.throws(operation);
    assert.deepEqual(state.snapshot, initial);
  }

  const large = createState(1e37);
  const beforeOverflow = large.snapshot;
  assert.throws(() => large.drag(3e38), /after move must be finite/);
  assert.deepEqual(large.snapshot, beforeOverflow);
});

test('Leaderboard domain remains Creator-free, read-only, and frame-based', () => {
  const source = readFileSync(new URL(
    '../../../game/assets/scripts/domain/leaderboard-state.ts',
    import.meta.url,
  ), 'utf8');

  assert.doesNotMatch(source, /from\s+['"]cc['"]/);
  assert.doesNotMatch(source, /deltaSeconds|deltaTime|elapsedTime/);
  assert.doesNotMatch(source, /\b(save|writeInt32|record[A-Z]\\w*Score|award[A-Z]\\w*Coins)\s*\(/);
  assert.doesNotMatch(source, /audio|particle|resource|presenter/i);
});

function createState(logicalWidth = 480): InstanceType<typeof LeaderboardState> {
  return new LeaderboardState({
    boards: createBoards(),
    logicalWidth,
  });
}

function createBoards(): {
  classic: { first: number; second: number; third: number };
  crazy: { first: number; second: number; third: number };
  gnStyle: { first: number; second: number; third: number };
  classicBird: { first: number; second: number; third: number };
  crazyBird: { first: number; second: number; third: number };
  comboBird: { first: number; second: number; third: number };
} {
  return {
    classic: { first: 90, second: 60, third: 30 },
    crazy: { first: 900, second: 600, third: 300 },
    gnStyle: { first: 9000, second: 6000, third: 3000 },
    classicBird: { first: 90_000, second: 60_000, third: 30_000 },
    crazyBird: { first: 900_000, second: 600_000, third: 300_000 },
    comboBird: { first: 0x7fff_ffff, second: 0, third: -0x8000_0000 },
  };
}

function withBoard(
  boardField: typeof BOARD_FIELDS[number],
  board: unknown,
): LeaderboardStateInput {
  return {
    boards: {
      ...createBoards(),
      [boardField]: board,
    } as LeaderboardBoardsInput,
    logicalWidth: 480,
  };
}

function assertDeepFrozen(
  value: unknown,
  visited: Set<object> = new Set(),
): void {
  if (value === null || typeof value !== 'object' || visited.has(value)) {
    return;
  }
  visited.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) {
    assertDeepFrozen(child, visited);
  }
}
