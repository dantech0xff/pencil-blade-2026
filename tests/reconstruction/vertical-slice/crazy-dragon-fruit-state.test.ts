import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
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
  CRAZY_DRAGON_ACCEPTED_SPLASH_FADE_SECONDS,
  CRAZY_DRAGON_COUNTER_FADE_SECONDS,
  CRAZY_DRAGON_COUNTER_FONT_PATH,
  CRAZY_DRAGON_COUNTER_PULSE_SECONDS,
  CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS,
  CRAZY_DRAGON_TERMINAL_PIECE_FADE_SECONDS,
  CrazyDragonFruitState,
  createCrazyDragonCriticalPieceUpdateCommands,
  createCrazyDragonFixtureConfiguration,
  createCrazyDragonTerminalPiecePlans,
} = await import(
  '../../../game/assets/scripts/domain/crazy-dragon-fruit-state.ts'
);

interface InclusiveCall {
  readonly maximumInclusive: number;
  readonly minimumInclusive: number;
}

class ScriptedRandom {
  readonly calls: InclusiveCall[] = [];
  private readonly draws: readonly number[];
  private nextDraw = 0;

  constructor(draws: readonly number[]) {
    this.draws = draws;
  }

  nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number {
    this.calls.push(Object.freeze({ maximumInclusive, minimumInclusive }));
    const value = this.draws[this.nextDraw];
    if (value === undefined) {
      throw new Error('scripted random exhausted');
    }
    this.nextDraw += 1;
    return value;
  }

  get consumedDrawCount(): number {
    return this.nextDraw;
  }
}

const SEGMENT = Object.freeze({
  end: Object.freeze({ x: 0, y: 0 }),
  start: Object.freeze({ x: 0, y: 10 }),
});

test('type-6 factory starts at exact viewport transform with zero velocity and a 2x box', () => {
  const profiles = [
    {
      dimensions: { height: 101, width: 118 },
      viewport: { height: 800, width: 480 },
    },
    {
      dimensions: { height: 153, width: 177 },
      viewport: { height: 1280, width: 720 },
    },
  ] as const;

  for (const profile of profiles) {
    const fixture = createCrazyDragonFixtureConfiguration(
      profile.viewport,
      profile.dimensions,
    );

    assert.equal(fixture.fruitId, 15);
    assert.equal(fixture.kind, 'dragon-fruit');
    assert.deepEqual(fixture.body.linearVelocityMetresPerSecond, { x: 0, y: 0 });
    assert.equal(fixture.body.angularVelocityRadiansPerSecond, 0);
    assert.equal(fixture.body.gravityScale, 1);
    assert.equal(fixture.body.bodyDefinitionUserData, null);
    assert.equal(fixture.body.bodyUserData, 'owner');
    assert.deepEqual(fixture.body.positionMetres, {
      x: Math.fround(Math.fround(profile.viewport.width * Math.fround(0.5)) / 32),
      y: Math.fround(Math.fround(profile.viewport.height * Math.fround(1.25)) / 32),
    });
    assert.equal(fixture.fixture.fixtureUserData, 'owner');
    assert.equal(fixture.fixture.shape.type, 'box');
    assert.deepEqual(fixture.fixture.shape.halfExtentsMetres, {
      x: Math.fround(profile.dimensions.width / 32),
      y: Math.fround(profile.dimensions.height / 32),
    });
    assert.deepEqual(fixture.fixture.shape.creatorSizeWorldUnits, {
      height: Math.fround(profile.dimensions.height * 2),
      width: Math.fround(profile.dimensions.width * 2),
    });
    assert.deepEqual(fixture.fixture.filter, {
      categoryBits: 1,
      groupIndex: 0,
      maskBits: 0xfffc,
    });
    assert.equal(fixture.fixture.friction, Math.fround(0.2));
    assert.equal(fixture.fixture.density, 1);
  }
});

test('first rejected Cut freezes, starts the action timer, and creates +0 before rejection', () => {
  const state = new CrazyDragonFruitState({ height: 800, width: 480 });
  const random = new ScriptedRandom([-30, 1]);

  const result = state.cut({
    bodyPositionMetres: { x: 7, y: 20 },
    effectsEnabled: true,
    logicalWidthWorldUnits: 480,
    segment: SEGMENT,
  }, random);

  assert.equal(result.accepted, false);
  assert.equal(result.firstCut, true);
  assert.equal(result.acceptedHitCount, 0);
  assert.deepEqual(random.calls, [
    { minimumInclusive: -30, maximumInclusive: 30 },
    { minimumInclusive: 0, maximumInclusive: 1 },
  ]);
  assert.deepEqual(result.commands.map(({ type }) => type), [
    'play-effect',
    'freeze-body',
    'show-splash',
    'start-hit-finish-delay',
    'create-hit-counter',
  ]);
  const audio = result.commands[0];
  assert.equal(
    audio.type === 'play-effect' ? audio.canonicalPath : null,
    'Sounds/hitmusic.wav',
  );
  const counter = result.commands.at(-1);
  assert.ok(counter?.type === 'create-hit-counter');
  assert.equal(counter.text, '+0\nHITS');
  assert.equal(counter.fontCanonicalPath, CRAZY_DRAGON_COUNTER_FONT_PATH);
  assert.equal(counter.fontSize, Math.fround(Math.fround(480 / 480) * 48));
  assert.equal(counter.rotationDegrees, -30);
  assert.deepEqual(counter.anchor, { x: -0.5, y: 0.5 });
  assert.deepEqual(counter.color, { red: 255, green: 128, blue: 64 });
  assert.equal(state.started, true);
  assert.equal(state.finished, false);
});

test('first accepted Cut consumes all five draws, clamps x only, and resets angle to zero', () => {
  const state = new CrazyDragonFruitState({ height: 800, width: 480 });
  const random = new ScriptedRandom([30, 0, -45, -14, 14]);

  const result = state.cut({
    bodyPositionMetres: { x: 0.1, y: 20 },
    effectsEnabled: true,
    logicalWidthWorldUnits: 480,
    segment: SEGMENT,
  }, random);

  assert.equal(result.accepted, true);
  assert.equal(result.acceptedHitCount, 1);
  assert.deepEqual(random.calls, [
    { minimumInclusive: -30, maximumInclusive: 30 },
    { minimumInclusive: 0, maximumInclusive: 1 },
    { minimumInclusive: -45, maximumInclusive: 45 },
    { minimumInclusive: -14, maximumInclusive: 14 },
    { minimumInclusive: -14, maximumInclusive: 14 },
  ]);
  assert.deepEqual(result.commands.map(({ type }) => type), [
    'play-effect',
    'freeze-body',
    'show-splash',
    'start-hit-finish-delay',
    'create-hit-counter',
    'set-body-transform',
    'play-effect',
    'animate-accepted-splash',
    'animate-hit-counter',
  ]);
  const transform = result.commands.find(
    (command) => command.type === 'set-body-transform',
  );
  assert.ok(transform?.type === 'set-body-transform');
  assert.equal(transform.angleRadians, 0);
  assert.deepEqual(transform.positionMetres, {
    x: 0,
    y: Math.fround(20 + Math.fround(14 / 32)),
  });
  const acceptedAudio = result.commands[6];
  assert.equal(
    acceptedAudio.type === 'play-effect' ? acceptedAudio.canonicalPath : null,
    'Sounds/strawberry.wav',
  );
  const splash = result.commands[7];
  assert.ok(splash.type === 'animate-accepted-splash');
  assert.equal(splash.fadeSeconds, CRAZY_DRAGON_ACCEPTED_SPLASH_FADE_SECONDS);
  assert.equal(Object.is(splash.rotationDegrees, -0), true);
  const counter = result.commands[8];
  assert.ok(counter.type === 'animate-hit-counter');
  assert.equal(counter.text, '+1\nHITS');
  assert.equal(counter.scaleSeconds, CRAZY_DRAGON_COUNTER_PULSE_SECONDS);
});

test('later reject/accept uses branch-only draws and effects gates add no RNG', () => {
  const state = new CrazyDragonFruitState({ height: 800, width: 480 });
  const first = new ScriptedRandom([0, 1]);
  state.cut({
    bodyPositionMetres: { x: 7, y: 20 },
    effectsEnabled: false,
    logicalWidthWorldUnits: 480,
    segment: SEGMENT,
  }, first);

  const rejected = new ScriptedRandom([1]);
  const rejectedResult = state.cut({
    bodyPositionMetres: { x: 7, y: 20 },
    effectsEnabled: false,
    logicalWidthWorldUnits: 480,
    segment: SEGMENT,
  }, rejected);
  assert.equal(rejectedResult.accepted, false);
  assert.deepEqual(rejected.calls, [
    { minimumInclusive: 0, maximumInclusive: 1 },
  ]);
  assert.deepEqual(rejectedResult.commands, []);

  const accepted = new ScriptedRandom([0, 45, 14, -14]);
  const acceptedResult = state.cut({
    bodyPositionMetres: { x: 14.9, y: 20 },
    effectsEnabled: false,
    logicalWidthWorldUnits: 480,
    segment: SEGMENT,
  }, accepted);
  assert.equal(acceptedResult.accepted, true);
  assert.equal(acceptedResult.acceptedHitCount, 1);
  assert.deepEqual(accepted.calls, [
    { minimumInclusive: 0, maximumInclusive: 1 },
    { minimumInclusive: -45, maximumInclusive: 45 },
    { minimumInclusive: -14, maximumInclusive: 14 },
    { minimumInclusive: -14, maximumInclusive: 14 },
  ]);
  assert.deepEqual(acceptedResult.commands.map(({ type }) => type), [
    'set-body-transform',
    'animate-accepted-splash',
    'animate-hit-counter',
  ]);
  const transform = acceptedResult.commands[0];
  assert.ok(transform.type === 'set-body-transform');
  assert.equal(transform.positionMetres.x, 15);
  assert.equal(transform.angleRadians, 0);
});

test('zero-width jitter radius still consumes both nextInt(0, 0) calls', () => {
  const state = new CrazyDragonFruitState({ height: 10, width: 1 });
  const random = new ScriptedRandom([0, 0, 17, 0, 0]);

  state.cut({
    bodyPositionMetres: { x: 0.01, y: 0.1 },
    effectsEnabled: false,
    logicalWidthWorldUnits: 1,
    segment: SEGMENT,
  }, random);

  assert.deepEqual(random.calls.slice(-2), [
    { minimumInclusive: 0, maximumInclusive: 0 },
    { minimumInclusive: 0, maximumInclusive: 0 },
  ]);
});

test('2.1 action completion creates four pieces before score/dispose/audio/fade/objective', () => {
  const state = new CrazyDragonFruitState({ height: 800, width: 480 });
  state.cut({
    bodyPositionMetres: { x: 7, y: 20 },
    effectsEnabled: false,
    logicalWidthWorldUnits: 480,
    segment: SEGMENT,
  }, new ScriptedRandom([0, 1]));

  const before = state.advanceAction(2, {
    assetTree: '480x800',
    bodyAngleRadians: 0.5,
    bodyPositionMetres: { x: 7, y: 20 },
    effectsEnabled: true,
  });
  assert.equal(before.completedNow, false);
  assert.deepEqual(before.commands, []);

  const completed = state.advanceAction(0.1, {
    assetTree: '480x800',
    bodyAngleRadians: 0.5,
    bodyPositionMetres: { x: 7, y: 20 },
    effectsEnabled: true,
  });
  assert.equal(completed.completedNow, true);
  assert.equal(state.finished, true);
  assert.equal(CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS, Math.fround(2.1));
  assert.deepEqual(completed.commands.map(({ type }) => type), [
    'create-terminal-piece',
    'create-terminal-piece',
    'create-terminal-piece',
    'create-terminal-piece',
    'notify-dragon-finished',
    'defer-dispose-original',
    'play-effect',
    'start-counter-fade',
    'process-objective',
  ]);
  const pieces = completed.commands.slice(0, 4);
  assert.deepEqual(pieces.map((command) => (
    command.type === 'create-terminal-piece' ? command.piece.kind : null
  )), ['top-left', 'top-right', 'bottom-right', 'bottom-left']);
  const score = completed.commands[4];
  assert.ok(score.type === 'notify-dragon-finished');
  assert.equal(score.acceptedHitCount, 0);
  const finishAudio = completed.commands[6];
  assert.equal(
    finishAudio.type === 'play-effect' ? finishAudio.canonicalPath : null,
    'Sounds/finishhitmusic.wav',
  );
  const fade = completed.commands[7];
  assert.ok(fade.type === 'start-counter-fade');
  assert.equal(fade.fadeSeconds, CRAZY_DRAGON_COUNTER_FADE_SECONDS);
  assert.deepEqual(completed.commands[8], {
    type: 'process-objective',
    eventId: 15,
    amount: 1,
  });

  assert.deepEqual(state.advanceAction(1, {
    assetTree: '480x800',
    bodyAngleRadians: 0,
    bodyPositionMetres: { x: 0, y: 0 },
    effectsEnabled: true,
  }).commands, []);
  const finishedRandom = new ScriptedRandom([]);
  assert.deepEqual(state.cut({
    bodyPositionMetres: { x: 0, y: 0 },
    effectsEnabled: true,
    logicalWidthWorldUnits: 480,
    segment: SEGMENT,
  }, finishedRandom).commands, []);
  assert.equal(finishedRandom.consumedDrawCount, 0);
});

test('terminal plans preserve exact order, profile geometry, float32 cancellation, and 0.75 fade', () => {
  const zeroAngle = createCrazyDragonTerminalPiecePlans({
    assetTree: '480x800',
    bodyAngleRadians: 0,
    bodyPositionMetres: { x: 7, y: 20 },
    effectsEnabled: false,
  });
  assert.deepEqual(zeroAngle.map(({ kind }) => kind), [
    'top-left',
    'top-right',
    'bottom-right',
    'bottom-left',
  ]);
  assert.deepEqual(zeroAngle.map(({ raster }) => raster.dimensions), [
    { width: 48, height: 43 },
    { width: 68, height: 48 },
    { width: 59, height: 55 },
    { width: 60, height: 45 },
  ]);
  assert.deepEqual(zeroAngle[0].positionMetres, {
    x: Math.fround(7 - 0.75),
    y: Math.fround(20 + 0.671875),
  });
  assert.deepEqual(zeroAngle[0].linearVelocityMetresPerSecond, {
    x: Math.fround(35 * Math.fround(Math.fround(7 - 0.75) - 7)),
    y: Math.fround(35 * Math.fround(Math.fround(20 + 0.671875) - 20)),
  });
  for (const piece of zeroAngle) {
    assert.equal(piece.critical, true);
    assert.equal(piece.fadeActionSeconds, CRAZY_DRAGON_TERMINAL_PIECE_FADE_SECONDS);
    assert.equal(piece.fixture.shape.creatorSizeWorldUnits.width, piece.raster.dimensions.width * 2);
    assert.equal(piece.fixture.shape.creatorSizeWorldUnits.height, piece.raster.dimensions.height * 2);
  }

  const nonzeroAngle = createCrazyDragonTerminalPiecePlans({
    assetTree: '720x1280',
    bodyAngleRadians: Math.fround(Math.PI / 3),
    bodyPositionMetres: { x: 1234.5, y: -456.25 },
    effectsEnabled: false,
  });
  assert.deepEqual(nonzeroAngle.map(({ raster }) => raster.dimensions), [
    { width: 73, height: 66 },
    { width: 103, height: 73 },
    { width: 89, height: 84 },
    { width: 91, height: 68 },
  ]);
  for (const piece of nonzeroAngle) {
    assert.equal(Number.isFinite(piece.positionMetres.x), true);
    assert.equal(Number.isFinite(piece.positionMetres.y), true);
    assert.equal(piece.angleRadians, Math.fround(Math.PI / 3));
  }
});

test('critical piece updates consume one draw or gate/frame/dead-rotation without a gate setting', () => {
  for (const gate of [1, 2, 3]) {
    const random = new ScriptedRandom([gate]);
    assert.deepEqual(
      createCrazyDragonCriticalPieceUpdateCommands({ x: 10, y: 20 }, random),
      [],
    );
    assert.deepEqual(random.calls, [
      { minimumInclusive: 0, maximumInclusive: 3 },
    ]);
  }

  const emitted = new ScriptedRandom([0, 4, -10]);
  assert.deepEqual(
    createCrazyDragonCriticalPieceUpdateCommands({ x: 10, y: 20 }, emitted),
    [{
      type: 'spawn-critical-particle',
      logicalPath: 'Criticles/criticle4.png',
      resourceIndex: 4,
      scaleOutActionSeconds: Math.fround(1.5),
    }],
  );
  assert.deepEqual(emitted.calls, [
    { minimumInclusive: 0, maximumInclusive: 3 },
    { minimumInclusive: 1, maximumInclusive: 4 },
    { minimumInclusive: -10, maximumInclusive: 10 },
  ]);
});

test('state rejects malformed clocks, viewports, segments, and out-of-range RNG returns', () => {
  assert.throws(
    () => new CrazyDragonFruitState({ width: 0, height: 800 }),
    RangeError,
  );
  assert.throws(
    () => createCrazyDragonFixtureConfiguration(
      { width: 480, height: 800 },
      { width: 0, height: 101 },
    ),
    RangeError,
  );

  const state = new CrazyDragonFruitState({ width: 480, height: 800 });
  assert.throws(() => state.advanceAction(-0.1, {
    assetTree: '480x800',
    bodyAngleRadians: 0,
    bodyPositionMetres: { x: 0, y: 0 },
    effectsEnabled: false,
  }), RangeError);
  assert.throws(() => state.cut({
    bodyPositionMetres: { x: 0, y: 0 },
    effectsEnabled: false,
    logicalWidthWorldUnits: 480,
    segment: {
      start: { x: 1, y: 1 },
      end: { x: 1, y: 1 },
    },
  }, new ScriptedRandom([0, 0, 0, 0, 0])), RangeError);

  const invalidRandom = new CrazyDragonFruitState({ width: 480, height: 800 });
  assert.throws(() => invalidRandom.cut({
    bodyPositionMetres: { x: 1, y: 1 },
    effectsEnabled: false,
    logicalWidthWorldUnits: 480,
    segment: SEGMENT,
  }, new ScriptedRandom([31])), RangeError);
});
