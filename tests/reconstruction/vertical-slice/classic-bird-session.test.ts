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
  CLASSIC_BIRD_BLADE_ASSET,
  CLASSIC_BIRD_BLADE_TYPE,
  CLASSIC_BIRD_BOMB_DELAY_SECONDS,
  CLASSIC_BIRD_GAME_OVER_PRESENTATION,
  CLASSIC_BIRD_GAME_OVER_SECONDS,
  CLASSIC_BIRD_INITIAL_WORLD_SPEED,
  CLASSIC_BIRD_INTRO_PRESENTATION,
  CLASSIC_BIRD_SAFE_CLEANUP_DIVERGENCE,
  CLASSIC_BIRD_SETTINGS_BEST_SCORE_KEY,
  CLASSIC_BIRD_SPEED_INCREMENT,
  CLASSIC_BIRD_SPEED_LIMIT,
  CLASSIC_BIRD_SPEED_UP_DELAY_SECONDS,
  ClassicBirdSession,
  ClassicBirdWorldSpeed,
} = await import('../../../game/assets/scripts/domain/classic-bird-session.ts');
const {
  CLASSIC_BIRD_MODE_ID,
  CLASSIC_BIRD_TOSS_CREATION_ORDER,
  CLASSIC_BIRD_TOSS_START_ORDER,
  CLASSIC_BIRD_TOSS_STOP_ORDER,
} = await import(
  '../../../game/assets/scripts/domain/classic-bird-toss-config.ts'
);
const {
  STANDARD_BOMB_EXPLOSION_FINISH_SECONDS,
} = await import(
  '../../../game/assets/scripts/domain/standard-bomb-explosion-state.ts'
);

test('scene entry constructs the exact untimed Bird graph and arms speed at entry', () => {
  const session = new ClassicBirdSession(77);
  assert.deepEqual(session.snapshot(), {
    cutEnabled: true,
    hasBonusToss: false,
    hasDoubleToss: false,
    hasTimeManager: false,
    lifecycle: 'intro',
    mode: CLASSIC_BIRD_MODE_ID,
    sceneEntered: false,
    score: {
      authoritativeScore: 0,
      displayedScore: 0,
      doubleScoreActive: false,
      displayedScoreScaleActive: false,
      pendingDoubleScore: 0,
    },
    terminalPresentationGuard: false,
    worldSpeed: {
      callbackArmed: false,
      speed: CLASSIC_BIRD_INITIAL_WORLD_SPEED,
    },
    worldStopped: false,
  });

  const commands = session.enterScene();
  assert.deepEqual(commands.slice(0, 2).map(({ type }) => type), [
    'enter-base-bird-layer',
    'read-logical-size-and-physics-world',
  ]);
  assert.deepEqual(
    commands.filter(({ type }) => type === 'construct-controller')
      .map((command) => (
        command.type === 'construct-controller' ? command.controller : fail()
      )),
    CLASSIC_BIRD_TOSS_CREATION_ORDER,
  );
  assert.deepEqual(
    commands.filter(({ type }) => type === 'attach-controller')
      .map((command) => (
        command.type === 'attach-controller' ? command.controller : fail()
      )),
    CLASSIC_BIRD_TOSS_CREATION_ORDER,
  );

  const suffix = commands.slice(20);
  assert.deepEqual(suffix.map(({ type }) => type), [
    'construct-fruit-fail-manager',
    'register-fruit-fail-game-over-callback',
    'attach-fruit-fail-manager',
    'create-intro-word',
    'create-intro-word',
    'construct-bomb-electric',
    'attach-bomb-electric',
    'create-bird-blade',
    'focus-combo-on-score-manager',
    'initialize-pause-ui',
    'initialize-best-score',
    'schedule-speed-up-callback',
  ]);
  assert.deepEqual(suffix[3], {
    type: 'create-intro-word',
    word: 'good',
    plan: CLASSIC_BIRD_INTRO_PRESENTATION.good,
    zOrder: 1,
  });
  assert.deepEqual(suffix[4], {
    type: 'create-intro-word',
    word: 'luck',
    plan: CLASSIC_BIRD_INTRO_PRESENTATION.luck,
    zOrder: 1,
  });
  assert.deepEqual(suffix[7], {
    type: 'create-bird-blade',
    canonicalPath: CLASSIC_BIRD_BLADE_ASSET,
    bladeType: CLASSIC_BIRD_BLADE_TYPE,
    zOrder: 1,
  });
  assert.deepEqual(suffix[10], {
    type: 'initialize-best-score',
    key: CLASSIC_BIRD_SETTINGS_BEST_SCORE_KEY,
    score: 77,
  });
  assert.deepEqual(suffix[11], {
    type: 'schedule-speed-up-callback',
    delaySeconds: CLASSIC_BIRD_SPEED_UP_DELAY_SECONDS,
  });

  const serialized = JSON.stringify(commands).toLowerCase();
  assert.doesNotMatch(serialized, /time-manager|double-toss|bonus-toss|background-music/);
  assert.equal(session.snapshot().worldSpeed.callbackArmed, true);
  assert.throws(() => session.enterScene(), /only once/);
});

test('GOOD/LUCK timing and LUCK-only completion start all nine controllers', () => {
  assert.equal(CLASSIC_BIRD_INTRO_PRESENTATION.durationSeconds, 1.5);
  assert.deepEqual(CLASSIC_BIRD_INTRO_PRESENTATION.good, {
    canonicalPath: 'Text/text-good.png',
    start: { xViewportWidths: -0.25, yHeightRatio: 0.525 },
    centre: { xViewportWidths: 0.5, yHeightRatio: 0.525 },
    end: { xViewportWidths: 1.25, yHeightRatio: 0.525 },
    moveInSeconds: 0.5,
    holdSeconds: 0.5,
    moveOutSeconds: 0.5,
    callsStartGame: false,
  });
  assert.deepEqual(CLASSIC_BIRD_INTRO_PRESENTATION.luck, {
    canonicalPath: 'Text/text-luck.png',
    start: { xViewportWidths: 1.25, yHeightRatio: 0.475 },
    centre: { xViewportWidths: 0.5, yHeightRatio: 0.475 },
    end: { xViewportWidths: -0.25, yHeightRatio: 0.475 },
    moveInSeconds: 0.5,
    holdSeconds: 0.5,
    moveOutSeconds: 0.5,
    callsStartGame: true,
  });

  const session = new ClassicBirdSession();
  assert.throws(() => session.completeIntro(), /enter|only once/);
  session.enterScene();
  assert.deepEqual(session.completeIntro(), [
    { type: 'set-cut-enabled', enabled: true },
    ...CLASSIC_BIRD_TOSS_START_ORDER.map((controller) => ({
      type: 'toss-controller' as const,
      action: 'start' as const,
      controller,
    })),
  ]);
  assert.equal(session.snapshot().lifecycle, 'running');
  assert.throws(() => session.completeIntro(), /only once/);
});

test('score and combo hooks retain special-cut effect-before-score sequencing', () => {
  const session = runningSession();

  assert.deepEqual(session.checkCombo({ x: 1, y: 2 }), [
    { type: 'check-combo', position: { x: 1, y: 2 } },
  ]);
  assert.deepEqual(session.fruitCut({ x: 3, y: 4 }, 13, -99), [
    { type: 'start-electric-bomb' },
    { type: 'add-score', value: 10, application: 'already-applied' },
  ]);
  assert.equal(session.snapshot().score.authoritativeScore, 10);

  assert.deepEqual(session.fruitCut({ x: 5, y: 6 }, 14, 1), [
    {
      type: 'create-magnet-animation',
      beginCallback: 'classic-bird-magnet-begin',
      endCallback: 'classic-bird-magnet-end',
      zOrder: 1,
    },
    { type: 'add-score', value: 10, application: 'already-applied' },
  ]);
  assert.equal(session.snapshot().score.authoritativeScore, 20);

  assert.deepEqual(session.fruitCut({ x: 7, y: 8 }, 8, 7), [
    { type: 'add-score', value: 7, application: 'already-applied' },
  ]);
  session.addScore(3);
  assert.equal(session.snapshot().score.authoritativeScore, 30);
  assert.throws(
    () => session.fruitCut({ x: 0, y: 0 }, 0, 0.5),
    /safe integer/,
  );
});

test('fruit misses delegate positions and never mutate score', () => {
  const session = runningSession();
  session.addScore(12);

  assert.deepEqual(session.fruitFail({ x: 12, y: 34 }), [
    { type: 'register-fruit-fail', position: { x: 12, y: 34 } },
  ]);
  assert.equal(session.snapshot().score.authoritativeScore, 12);
});

test('bomb shutdown freezes with zero penalty while the explosion owns the sole clock', () => {
  const session = runningSession();
  session.addScore(25);

  const commands = session.bombHit();
  assert.deepEqual(commands, [
    ...shutdownCommands(),
    { type: 'set-physics-stopped', stopped: true },
  ]);
  assert.equal(commands.some(({ type }) => type === 'add-score'), false);
  assert.equal(
    commands.some(({ type }) => type === 'schedule-after-bomb-hit'),
    false,
  );
  assert.equal(
    CLASSIC_BIRD_BOMB_DELAY_SECONDS,
    STANDARD_BOMB_EXPLOSION_FINISH_SECONDS,
  );
  assert.equal(session.snapshot().score.authoritativeScore, 25);
  assert.equal(session.snapshot().worldStopped, true);

  assert.deepEqual(session.afterBombHit(), [
    {
      type: 'show-game-over',
      presentation: CLASSIC_BIRD_GAME_OVER_PRESENTATION,
    },
    { type: 'set-physics-stopped', stopped: false },
  ]);
  assert.equal(session.snapshot().worldStopped, false);
});

test('miss shutdown does not freeze physics and repeated callbacks arm GAME/OVER once', () => {
  const session = runningSession();
  const first = session.gameOverFromMiss();
  const second = session.gameOverFromMiss();

  assert.deepEqual(first, [
    ...shutdownCommands(),
    {
      type: 'show-game-over',
      presentation: CLASSIC_BIRD_GAME_OVER_PRESENTATION,
    },
  ]);
  assert.deepEqual(second, shutdownCommands());
  assert.equal(
    first.some(({ type }) => type === 'set-physics-stopped'),
    false,
  );
  assert.equal(session.snapshot().terminalPresentationGuard, true);
  assert.equal(session.snapshot().lifecycle, 'game-over');
});

test('overlapping bomb/miss and multiple bombs preserve one terminal flow and Boolean gate', () => {
  const overlap = runningSession();
  overlap.bombHit();
  assert.equal(
    overlap.gameOverFromMiss().at(-1)?.type,
    'show-game-over',
  );
  assert.deepEqual(overlap.afterBombHit(), [
    { type: 'set-physics-stopped', stopped: false },
  ]);

  const multiple = runningSession();
  multiple.bombHit();
  multiple.bombHit();
  assert.equal(multiple.snapshot().worldStopped, true);
  assert.equal(
    multiple.afterBombHit().filter(({ type }) => type === 'show-game-over').length,
    1,
  );
  assert.equal(multiple.snapshot().worldStopped, false);
  assert.deepEqual(multiple.afterBombHit(), [
    { type: 'set-physics-stopped', stopped: false },
  ]);
});

test('GAME/OVER lasts 2.5 seconds and isolated bomb reaches result at nominal five', () => {
  assert.equal(CLASSIC_BIRD_GAME_OVER_SECONDS, 2.5);
  assert.equal(CLASSIC_BIRD_GAME_OVER_PRESENTATION.durationSeconds, 2.5);
  assert.deepEqual(CLASSIC_BIRD_GAME_OVER_PRESENTATION.game, {
    canonicalPath: 'Text/text-game.png',
    start: {
      xViewportWidths: 0.5,
      yHeightRatio: 'top-plus-half-sprite',
    },
    centre: { xViewportWidths: 0.5, yHeightRatio: 0.575 },
    end: { xViewportWidths: -0.5, yHeightRatio: 0.575 },
    moveInSeconds: 0.75,
    holdSeconds: 1,
    moveOutSeconds: 0.75,
    callsDisplayScore: true,
  });
  assert.deepEqual(CLASSIC_BIRD_GAME_OVER_PRESENTATION.over, {
    canonicalPath: 'Text/text-over.png',
    start: {
      xViewportWidths: 0.5,
      yHeightRatio: 'bottom-minus-half-sprite',
    },
    centre: { xViewportWidths: 0.5, yHeightRatio: 0.425 },
    end: { xViewportWidths: 1.5, yHeightRatio: 0.425 },
    moveInSeconds: 0.75,
    holdSeconds: 1,
    moveOutSeconds: 0.75,
    callsDisplayScore: false,
  });
  assert.equal(
    CLASSIC_BIRD_BOMB_DELAY_SECONDS
      + CLASSIC_BIRD_GAME_OVER_PRESENTATION.durationSeconds,
    5,
  );
});

test('result prepare can roll back, then commit once with safe cleanup divergence', () => {
  const session = runningSession();
  session.addScore(123);
  session.gameOverFromMiss();

  const expected = [
    { type: 'stop-effects' },
    {
      type: 'capture-classic-bird-parent',
      boundary: 'captured-classic-bird-parent',
    },
    { type: 'construct-result' },
    { type: 'set-result-mode', mode: CLASSIC_BIRD_MODE_ID },
    { type: 'set-result-score', score: 123 },
    {
      type: 'remove-classic-bird',
      cleanup: true,
      cleanupPolicy: CLASSIC_BIRD_SAFE_CLEANUP_DIVERGENCE,
    },
    { type: 'attach-result', zOrder: 1 },
  ];
  assert.deepEqual(session.displayScoreComplete(), expected);
  assert.equal(session.snapshot().lifecycle, 'result-transition');
  assert.throws(
    () => session.displayScoreComplete(),
    /already pending/,
  );

  session.rollbackDisplayScoreComplete();
  assert.equal(session.snapshot().lifecycle, 'game-over');
  assert.deepEqual(session.displayScoreComplete(), expected);
  session.commitDisplayScoreComplete();
  assert.equal(session.snapshot().lifecycle, 'result-removed');
  assert.deepEqual(session.displayScoreComplete(), []);
  assert.deepEqual(session.gameOverFromMiss(), []);
  assert.deepEqual(session.bombHit(), []);
  assert.throws(
    () => session.rollbackDisplayScoreComplete(),
    /not pending/,
  );
});

test('miss then bomb cannot leave physics stopped after result removal', () => {
  const session = runningSession();
  session.gameOverFromMiss();
  session.bombHit();
  assert.equal(session.snapshot().worldStopped, true);

  session.displayScoreComplete();
  session.commitDisplayScoreComplete();
  assert.deepEqual(session.afterBombHit(), [
    { type: 'set-physics-stopped', stopped: false },
  ]);
  assert.equal(session.snapshot().worldStopped, false);
});

test('world speed uses 45 seconds, float32 +0.1, and one final armed no-op', () => {
  const speed = new ClassicBirdWorldSpeed();
  assert.deepEqual(speed.enableAtSceneEntry(), [{
    type: 'schedule-speed-up-callback',
    delaySeconds: CLASSIC_BIRD_SPEED_UP_DELAY_SECONDS,
  }]);

  const observed: number[] = [];
  let expected = CLASSIC_BIRD_INITIAL_WORLD_SPEED;
  for (let index = 0; index < 10; index += 1) {
    expected = Math.fround(expected + CLASSIC_BIRD_SPEED_INCREMENT);
    assert.deepEqual(speed.speedUpDelayComplete(), [
      { type: 'set-world-speed', value: expected },
      {
        type: 'schedule-speed-up-callback',
        delaySeconds: CLASSIC_BIRD_SPEED_UP_DELAY_SECONDS,
      },
    ]);
    observed.push(expected);
  }

  assert.equal(observed.at(-1), Math.fround(2.000000238418579));
  assert.equal(observed.at(-1)! > CLASSIC_BIRD_SPEED_LIMIT, true);
  assert.deepEqual(speed.snapshot(), {
    callbackArmed: true,
    speed: observed.at(-1),
  });
  assert.deepEqual(speed.speedUpDelayComplete(), []);
  assert.deepEqual(speed.snapshot(), {
    callbackArmed: false,
    speed: observed.at(-1),
  });
  assert.deepEqual(speed.speedUpDelayComplete(), []);
});

test('world speed scales only the float32 physics delta', () => {
  const session = new ClassicBirdSession();
  session.enterScene();
  const schedulerDelta = 1 / 60;
  const initialPhysics = session.physicsStepDelta(schedulerDelta);
  assert.equal(
    initialPhysics,
    Math.fround(Math.fround(schedulerDelta) * CLASSIC_BIRD_INITIAL_WORLD_SPEED),
  );

  session.speedUpDelayComplete();
  assert.equal(
    session.physicsStepDelta(schedulerDelta),
    Math.fround(
      Math.fround(schedulerDelta)
      * Math.fround(CLASSIC_BIRD_INITIAL_WORLD_SPEED + CLASSIC_BIRD_SPEED_INCREMENT),
    ),
  );
  assert.equal(schedulerDelta, 1 / 60);
});

function runningSession() {
  const session = new ClassicBirdSession();
  session.enterScene();
  session.completeIntro();
  return session;
}

function shutdownCommands() {
  return [
    { type: 'set-cut-enabled' as const, enabled: false },
    ...CLASSIC_BIRD_TOSS_STOP_ORDER.map((controller) => ({
      type: 'toss-controller' as const,
      action: 'stop' as const,
      controller,
    })),
    { type: 'stop-electric-bomb' as const },
  ];
}

function fail(): never {
  throw new Error('unexpected command type');
}
