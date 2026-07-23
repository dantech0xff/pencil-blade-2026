import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

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
  STANDARD_BOMB_EXPLOSION_FINISH_SECONDS,
  STANDARD_BOMB_EXPLOSION_MAX_TRIANGLES,
  STANDARD_BOMB_EXPLOSION_TRIANGLE_START_SECONDS,
  StandardBombExplosionState,
} = await import(
  '../../../game/assets/scripts/domain/standard-bomb-explosion-state.ts'
);

interface InclusiveCall {
  readonly maximumInclusive: number;
  readonly minimumInclusive: number;
}

class ScriptedRandom {
  readonly calls: InclusiveCall[] = [];
  private readonly draws: readonly number[];
  private nextDrawIndex = 0;

  constructor(draws: readonly number[]) {
    this.draws = draws;
  }

  nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number {
    this.calls.push(Object.freeze({ maximumInclusive, minimumInclusive }));
    const value = this.draws[this.nextDrawIndex];
    if (value === undefined) {
      throw new Error('scripted random exhausted');
    }
    this.nextDrawIndex += 1;
    return value;
  }
}

class MinimumRandom {
  readonly calls: InclusiveCall[] = [];

  nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number {
    this.calls.push(Object.freeze({ maximumInclusive, minimumInclusive }));
    return minimumInclusive;
  }
}

test('both profiles and an offset visible rect use exact blank, flash, triangle, and finish boundaries', () => {
  const profiles = [
    {
      bombWorldPosition: { x: 240, y: 320 },
      visibleRect: { bottom: 0, left: 0, right: 480, top: 800 },
    },
    {
      bombWorldPosition: { x: 310, y: 600 },
      visibleRect: { bottom: -32, left: -120, right: 600, top: 1248 },
    },
  ] as const;

  for (const profile of profiles) {
    const random = new ScriptedRandom([1]);
    const state = new StandardBombExplosionState({ ...profile, random });

    assert.deepEqual(state.snapshot(), {
      bombWorldPosition: profile.bombWorldPosition,
      edgeCursor: 1,
      elapsedActionSeconds: 0,
      finished: false,
      phase: 'blank',
      triangles: [],
      visibleRect: profile.visibleRect,
      visualState: 0,
    });

    assert.deepEqual(state.updateAction(0.25), {
      finishedNow: false,
      generatedTriangleNow: false,
      phase: 'flash',
    });
    assert.equal(state.snapshot().visualState, 2);
    assert.equal(random.calls.length, 0);

    assert.deepEqual(state.updateAction(1), {
      finishedNow: false,
      generatedTriangleNow: false,
      phase: 'triangles',
    });
    assert.equal(state.snapshot().elapsedActionSeconds, 1.25);
    assert.equal(state.snapshot().visualState, 1);
    assert.deepEqual(random.calls, [
      { minimumInclusive: 0, maximumInclusive: 6 },
    ]);

    assert.deepEqual(state.updateAction(1.25), {
      finishedNow: true,
      generatedTriangleNow: false,
      phase: 'finished',
    });
    assert.equal(state.snapshot().elapsedActionSeconds, 2.5);
    assert.equal(state.snapshot().visualState, null);
    assert.equal(state.snapshot().finished, true);
    assert.equal(random.calls.length, 1);
    assert.deepEqual(state.updateAction(10), {
      finishedNow: false,
      generatedTriangleNow: false,
      phase: 'finished',
    });
  }
});

test('oversized action deltas cross phases deterministically without synthesizing frame draws', () => {
  const crossingRandom = new ScriptedRandom([1]);
  const crossing = new StandardBombExplosionState({
    bombWorldPosition: { x: 10, y: 20 },
    random: crossingRandom,
    visibleRect: { bottom: 0, left: 0, right: 480, top: 800 },
  });

  crossing.updateAction(1.5);
  assert.equal(crossing.snapshot().phase, 'triangles');
  assert.equal(crossing.snapshot().elapsedActionSeconds, 1.5);
  assert.equal(crossingRandom.calls.length, 1);
  crossing.updateAction(100);
  assert.equal(crossing.snapshot().phase, 'finished');
  assert.equal(crossing.snapshot().elapsedActionSeconds, 2.5);
  assert.equal(crossingRandom.calls.length, 1);

  const directRandom = new ScriptedRandom([]);
  const directFinish = new StandardBombExplosionState({
    bombWorldPosition: { x: 10, y: 20 },
    random: directRandom,
    visibleRect: { bottom: 0, left: 0, right: 480, top: 800 },
  });
  directFinish.updateAction(STANDARD_BOMB_EXPLOSION_FINISH_SECONDS);
  assert.equal(directFinish.snapshot().phase, 'finished');
  assert.equal(directRandom.calls.length, 0);
});

test('successes consume gate, width gap, and edge coordinate draws in exact cycling order', () => {
  const random = new ScriptedRandom([
    0, 96, 780,
    0, 96, 440,
    0, 48, -20,
    0, 48, 440,
  ]);
  const state = new StandardBombExplosionState({
    bombWorldPosition: { x: 224, y: 288 },
    random,
    visibleRect: { bottom: -20, left: -40, right: 440, top: 780 },
  });

  state.updateAction(STANDARD_BOMB_EXPLOSION_TRIANGLE_START_SECONDS);
  state.updateAction(0);
  state.updateAction(0);
  state.updateAction(0);

  assert.deepEqual(random.calls, [
    { minimumInclusive: 0, maximumInclusive: 6 },
    { minimumInclusive: 48, maximumInclusive: 96 },
    { minimumInclusive: -20, maximumInclusive: 780 },
    { minimumInclusive: 0, maximumInclusive: 6 },
    { minimumInclusive: 48, maximumInclusive: 96 },
    { minimumInclusive: -40, maximumInclusive: 440 },
    { minimumInclusive: 0, maximumInclusive: 6 },
    { minimumInclusive: 48, maximumInclusive: 96 },
    { minimumInclusive: -20, maximumInclusive: 780 },
    { minimumInclusive: 0, maximumInclusive: 6 },
    { minimumInclusive: 48, maximumInclusive: 96 },
    { minimumInclusive: -40, maximumInclusive: 440 },
  ]);
  assert.deepEqual(state.snapshot().triangles, [
    {
      edge: 'right',
      firstEdgePoint: { x: 440, y: 780 },
      secondEdgePoint: { x: 440, y: 876 },
    },
    {
      edge: 'bottom',
      firstEdgePoint: { x: 440, y: -20 },
      secondEdgePoint: { x: 536, y: -20 },
    },
    {
      edge: 'left',
      firstEdgePoint: { x: -40, y: -20 },
      secondEdgePoint: { x: -40, y: 28 },
    },
    {
      edge: 'top',
      firstEdgePoint: { x: 440, y: 780 },
      secondEdgePoint: { x: 488, y: 780 },
    },
  ]);
  assert.equal(state.snapshot().edgeCursor, 1);
});

test('triangle accumulation caps at 100 pairs before any further random draw', () => {
  const random = new MinimumRandom();
  const state = new StandardBombExplosionState({
    bombWorldPosition: { x: 0, y: 0 },
    random,
    visibleRect: { bottom: 0, left: 0, right: 720, top: 1280 },
  });

  state.updateAction(STANDARD_BOMB_EXPLOSION_TRIANGLE_START_SECONDS);
  for (let index = 1; index < STANDARD_BOMB_EXPLOSION_MAX_TRIANGLES; index += 1) {
    state.updateAction(0);
  }
  assert.equal(state.snapshot().triangles.length, 100);
  assert.equal(random.calls.length, 300);

  state.updateAction(0);
  assert.equal(state.snapshot().triangles.length, 100);
  assert.equal(random.calls.length, 300);
});

test('invalid clocks, geometry, and random return values fail explicitly', () => {
  const validInput = {
    bombWorldPosition: { x: 0, y: 0 },
    random: new ScriptedRandom([]),
    visibleRect: { bottom: 0, left: 0, right: 480, top: 800 },
  };
  const state = new StandardBombExplosionState(validInput);
  assert.throws(() => state.updateAction(-1), RangeError);
  assert.throws(() => state.updateAction(Number.NaN), RangeError);
  assert.throws(
    () => new StandardBombExplosionState({
      ...validInput,
      visibleRect: { bottom: 0, left: 10, right: 10, top: 20 },
    }),
    /right must be greater/,
  );
  assert.throws(
    () => new StandardBombExplosionState({
      ...validInput,
      random: null as never,
    }),
    /nextIntInclusive/,
  );

  const invalidDraw = new StandardBombExplosionState({
    ...validInput,
    random: { nextIntInclusive: () => 7 },
  });
  assert.throws(
    () => invalidDraw.updateAction(STANDARD_BOMB_EXPLOSION_TRIANGLE_START_SECONDS),
    /outside the inclusive range/,
  );
});
