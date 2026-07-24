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
  GN_STYLE_CAPTURED_PARENT_BOUNDARY,
  GN_STYLE_INITIAL_TIME_SECONDS,
  GN_STYLE_NOMINAL_TIMELINE_SECONDS,
  GN_STYLE_TIME_UP_PRESENTATION_SECONDS,
  GnStyleSession,
} = await import(
  '../../../game/assets/scripts/domain/gn-style-session.ts'
);
const {
  GN_STYLE_TOSS_CREATION_ORDER,
  GN_STYLE_TOSS_OUTER_STOP_ORDER,
  GN_STYLE_TOSS_START_ORDER,
} = await import(
  '../../../game/assets/scripts/domain/gn-style-toss-config.ts'
);

test('mode 2 entry uses ordinary base gameplay and exact construction/attachment order', () => {
  const session = new GnStyleSession(321);
  assert.deepEqual(session.snapshot(), {
    activity: {
      comboActive: false,
      entitiesActive: false,
      inputActive: false,
      ordinaryBladeActive: false,
      outerTossControllersActive: false,
      physicsActive: false,
      scoreActive: false,
    },
    hasBirdBlade: false,
    hasBomb: false,
    hasBonusToss: false,
    hasDoubleToss: false,
    hasFreezeProducer: false,
    hasLives: false,
    hasTimeManager: true,
    lifecycle: 'constructed',
    mode: 2,
    sceneEntered: false,
    score: {
      authoritativeScore: 0,
      displayedScore: 0,
      displayedScoreScaleActive: false,
      doubleScoreActive: false,
      pendingDoubleScore: 0,
    },
    waveChildAfterTimeUp: 'pre-armed-pause-only',
  });

  const commands = session.enterScene();
  assert.deepEqual(commands.slice(0, 2), [
    { type: 'enter-base-gameplay-layer' },
    { payload: 0, selector: 6, type: 'process-objective' },
  ]);
  assert.deepEqual(commands
    .filter(({ type }) => type === 'construct-controller')
    .map((command) => (
      command.type === 'construct-controller' ? command.controller : null
    )), GN_STYLE_TOSS_CREATION_ORDER);
  assert.deepEqual(commands
    .filter(({ type }) => type === 'attach-controller')
    .map((command) => (
      command.type === 'attach-controller' ? command.controller : null
    )), GN_STYLE_TOSS_CREATION_ORDER);
  assert.deepEqual(commands.find(
    ({ type }) => type === 'construct-time-manager',
  ), {
    callbackOrder: ['time-up', 'time-up-finish'],
    durationSeconds: GN_STYLE_INITIAL_TIME_SECONDS,
    type: 'construct-time-manager',
  });

  const bestIndex = commands.findIndex(({ type }) => type === 'initialize-best-score');
  const firstCardIndex = commands.findIndex(
    ({ type }) => type === 'create-instruction-card',
  );
  assert.equal(bestIndex < firstCardIndex, true);
  assert.deepEqual(commands[bestIndex], {
    key: 'gnstyle_best_1',
    score: 321,
    type: 'initialize-best-score',
  });
  assert.deepEqual(commands
    .filter(({ type }) => type === 'create-instruction-card')
    .map((command) => (
      command.type === 'create-instruction-card' ? command.card : null
    )), ['no-bomb', 'gn-style', 'no-life']);
  assert.deepEqual(commands
    .filter(({ type }) => type === 'attach-instruction-card')
    .map((command) => (
      command.type === 'attach-instruction-card' ? command.card : null
    )), ['gn-style', 'no-bomb', 'no-life']);
  assert.deepEqual(commands
    .filter(({ type }) => type === 'start-instruction-action')
    .map((command) => (
      command.type === 'start-instruction-action'
        ? [command.card, command.ownsContinuation]
        : null
    )), [
    ['no-bomb', false],
    ['gn-style', true],
    ['no-life', false],
  ]);
  assert.equal(
    commands.some(({ type }) => type.includes('bird-blade')),
    false,
  );
  assert.equal(session.snapshot().activity.inputActive, true);
  assert.equal(session.snapshot().activity.outerTossControllersActive, false);
});

test('callbacks fix exact intro chain and controller-before-timer start', () => {
  const session = new GnStyleSession();
  session.enterScene();
  assert.deepEqual(GN_STYLE_NOMINAL_TIMELINE_SECONDS, {
    enterGo: Math.fround(1.7),
    enterInstructions: 0,
    enterOneHundredFifty: 0.75,
    enterResult: Math.fround(Math.fround(2.6) + 153),
    enterRunning: Math.fround(2.6),
    enterTimeUp: Math.fround(Math.fround(2.6) + 150),
  });
  assert.equal(GN_STYLE_TIME_UP_PRESENTATION_SECONDS, 3);

  assert.deepEqual(session.totalTimeCallback(), [{
    canonicalPath: 'Text/text-150s.png',
    durationSeconds: Math.fround(0.95),
    type: 'create-one-hundred-fifty-intro',
    zOrder: 1,
  }]);
  assert.equal(session.snapshot().lifecycle, 'intro-150');
  assert.deepEqual(session.goCallback(), [{
    canonicalPath: 'Text/text-go.png',
    durationSeconds: Math.fround(0.9),
    type: 'create-go-intro',
    zOrder: 1,
  }]);
  assert.equal(session.snapshot().lifecycle, 'intro-go');

  const start = session.startGameCallback();
  assert.deepEqual(start.slice(0, 3), GN_STYLE_TOSS_START_ORDER.map(
    (controller) => ({ controller, scope: 'outer', type: 'start-controller' }),
  ));
  assert.deepEqual(start.at(-1), { type: 'start-time-manager' });
  assert.equal(session.snapshot().lifecycle, 'running');
  assert.equal(session.snapshot().activity.outerTossControllersActive, true);
});

test('TIME UP stops only outers and keeps late input, physics, entities, score, and combo live', () => {
  const session = runningSession();
  session.fruitCut({ x: 1, y: 2 }, 0, 1);

  const timeUp = session.timeUp();

  assert.deepEqual(timeUp.slice(0, 3), GN_STYLE_TOSS_OUTER_STOP_ORDER.map(
    (controller) => ({
      controller,
      preservesActiveWaveChild: controller === 'wave',
      scope: 'outer',
      type: 'stop-controller',
    }),
  ));
  assert.deepEqual(timeUp.at(-1), {
    payload: 2,
    selector: 6,
    type: 'process-objective',
  });
  assert.equal(timeUp.some(({ type }) => type === 'set-result-score'), false);
  assert.deepEqual(session.snapshot().activity, {
    comboActive: true,
    entitiesActive: true,
    inputActive: true,
    ordinaryBladeActive: true,
    outerTossControllersActive: false,
    physicsActive: true,
    scoreActive: true,
  });

  assert.deepEqual(session.checkCombo({ x: 3, y: 4 }), [{
    position: { x: 3, y: 4 },
    type: 'check-combo',
  }]);
  assert.deepEqual(session.fruitCut({ x: 5, y: 6 }, 8, 10), [{
    application: 'already-applied',
    type: 'add-score',
    value: 10,
  }]);
  session.addScore(3);
  assert.deepEqual(session.fruitFail({ x: 7, y: 8 }), [{
    payload: 1,
    selector: 6,
    type: 'process-objective',
  }]);
  assert.deepEqual(session.bonusFruitFail({ x: 9, y: 10 }), [{
    payload: 1,
    selector: 6,
    type: 'process-objective',
  }]);
  assert.equal(session.snapshot().score.authoritativeScore, 14);

  const result = session.timeUpFinish();
  assert.deepEqual(result, [
    { type: 'stop-effects' },
    {
      boundary: GN_STYLE_CAPTURED_PARENT_BOUNDARY,
      type: 'capture-gn-style-parent',
    },
    { type: 'construct-result' },
    { mode: 2, type: 'set-result-mode' },
    { score: 14, type: 'set-result-score' },
    { cleanup: true, type: 'remove-gn-style' },
    { type: 'attach-result', zOrder: 1 },
  ]);
  assert.equal(
    result.some((command) => (
      command.type === 'process-objective'
    )),
    false,
  );
});

test('Result resamples authoritative score after rollback instead of freezing at timer zero', () => {
  const session = runningSession();
  session.fruitCut({ x: 0, y: 0 }, 0, 5);
  session.timeUp();
  const first = session.timeUpFinish();
  assert.deepEqual(first.find(({ type }) => type === 'set-result-score'), {
    score: 5,
    type: 'set-result-score',
  });

  session.rollbackTimeUpFinish();
  session.fruitCut({ x: 0, y: 0 }, 0, 7);
  const retried = session.timeUpFinish();
  assert.deepEqual(retried.find(({ type }) => type === 'set-result-score'), {
    score: 12,
    type: 'set-result-score',
  });
  session.commitTimeUpFinish();
  assert.equal(session.snapshot().lifecycle, 'result-removed');
  assert.equal(session.snapshot().activity.inputActive, false);
});

test('rejected transitions throw before lifecycle mutation', () => {
  const session = new GnStyleSession();
  session.enterScene();
  assert.throws(
    () => session.goCallback(),
    /requires the 150s callback/,
  );
  assert.equal(session.snapshot().lifecycle, 'intro-instructions');
  assert.throws(
    () => session.timeUp(),
    /only while running/,
  );
  assert.throws(
    () => session.fruitCut({ x: 0, y: 0 }, 0, 1),
    /gameplay callbacks require/,
  );
});

function runningSession(): InstanceType<typeof GnStyleSession> {
  const session = new GnStyleSession();
  session.enterScene();
  session.totalTimeCallback();
  session.goCallback();
  session.startGameCallback();
  return session;
}
