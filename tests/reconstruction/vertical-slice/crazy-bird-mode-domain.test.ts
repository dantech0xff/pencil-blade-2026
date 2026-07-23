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
  CRAZY_TOSS_CREATION_ORDER,
  CRAZY_TOSS_START_ORDER,
  CRAZY_TOSS_TIME_UP_STOP_ORDER,
} = await import('../../../game/assets/scripts/domain/crazy-toss-config.ts');
const {
  CRAZY_BIRD_TIMED_PROFILE,
  CRAZY_TIMED_PROFILE,
} = await import('../../../game/assets/scripts/domain/crazy-timed-mode-profile.ts');
const {
  CrazySession,
} = await import('../../../game/assets/scripts/domain/crazy-session.ts');

test('timed-mode profiles are immutable and keep zero-argument Crazy identity unchanged', () => {
  assert.equal(Object.isFrozen(CRAZY_TIMED_PROFILE), true);
  assert.equal(Object.isFrozen(CRAZY_BIRD_TIMED_PROFILE), true);
  assert.deepEqual(CRAZY_TIMED_PROFILE, {
    baseEntryCommand: 'enter-base-gameplay-layer',
    bestScoreKey: 'crazy_best_1',
    captureCommand: 'capture-crazy-parent',
    capturedParentBoundary: 'captured-crazy-parent',
    kind: 'crazy',
    mode: 1,
    noBombObjectiveEventId: 8,
    noDropObjectiveEventId: 4,
    removeCommand: 'remove-crazy',
  });
  assert.deepEqual(CRAZY_BIRD_TIMED_PROFILE, {
    baseEntryCommand: 'enter-base-bird-layer',
    bestScoreKey: 'bird_crazy_best_1',
    captureCommand: 'capture-crazy-bird-parent',
    capturedParentBoundary: 'captured-crazy-bird-parent',
    kind: 'crazy-bird',
    mode: 4,
    noBombObjectiveEventId: 9,
    noDropObjectiveEventId: 5,
    removeCommand: 'remove-crazy-bird',
  });

  const defaultSession = new CrazySession();
  assert.equal(defaultSession.modeProfile, CRAZY_TIMED_PROFILE);
  assert.equal(defaultSession.snapshot().mode, 1);
  assert.equal(defaultSession.bestScoreKey, 'crazy_best_1');
  assert.throws(
    () => new CrazySession(0, Object.freeze({
      ...CRAZY_BIRD_TIMED_PROFILE,
    }) as never),
    /supported immutable Crazy timed-mode profile/,
  );
});

test('mode 4 emits BaseBird identity and candidate Crazy controller construction/start order', () => {
  const session = new CrazySession(321, CRAZY_BIRD_TIMED_PROFILE);
  assert.equal(session.modeProfile, CRAZY_BIRD_TIMED_PROFILE);
  assert.deepEqual(session.snapshot(), {
    cutEnabled: true,
    hasTimeManager: true,
    lifecycle: 'intro',
    mode: 4,
    score: {
      authoritativeScore: 0,
      displayedScore: 0,
      doubleScoreActive: false,
      displayedScoreScaleActive: false,
      pendingDoubleScore: 0,
    },
  });

  const enter = session.enterScene();
  assert.deepEqual(enter.slice(0, 5), [
    { type: 'enter-base-bird-layer' },
    { type: 'reset-bonus-manager' },
    { type: 'process-objective', eventId: 9, state: 0 },
    { type: 'process-objective', eventId: 5, state: 0 },
    { type: 'read-logical-director-size' },
  ]);
  assert.deepEqual(
    enter
      .filter((command) => command.type === 'construct-controller')
      .map((command) => (
        command.type === 'construct-controller' ? command.controller : null
      )),
    CRAZY_TOSS_CREATION_ORDER,
  );
  assert.equal(
    enter.filter((command) => command.type === 'construct-controller').length,
    11,
  );
  assert.deepEqual(enter.at(-1), {
    type: 'initialize-best-score',
    key: 'bird_crazy_best_1',
    score: 321,
  });

  const go = session.completeIntro();
  assert.deepEqual(go.slice(0, 2), [
    { type: 'start-time-manager' },
    { type: 'set-cut-enabled', enabled: true },
  ]);
  assert.deepEqual(
    go
      .filter((command) => command.type === 'start-controller')
      .map((command) => (
        command.type === 'start-controller' ? command.controller : null
      )),
    CRAZY_TOSS_START_ORDER,
  );
  assert.equal(
    go.some((command) => (
      command.type === 'start-controller' && command.controller === 'b4'
    )),
    false,
  );
});

test('mode 4 preserves Crazy timed misses, bomb, Time Up, and distinct Result identity', () => {
  const session = new CrazySession(0, CRAZY_BIRD_TIMED_PROFILE);
  session.enterScene();
  session.completeIntro();

  assert.deepEqual(session.fruitFail({ x: 1, y: 2 }), [
    { type: 'process-objective', eventId: 5, state: 1 },
  ]);
  assert.deepEqual(session.bonusFruitFail({ x: 3, y: 4 }), [
    { type: 'process-objective', eventId: 5, state: 1 },
  ]);
  assert.deepEqual(session.bombHit({ x: 5, y: 6 }).slice(-2), [
    { type: 'stop-controller', controller: 'ae' },
    { type: 'process-objective', eventId: 9, state: 1 },
  ]);
  assert.equal(session.snapshot().lifecycle, 'running');

  const timeUp = session.timeUp();
  assert.deepEqual(
    timeUp
      .filter((command) => command.type === 'stop-controller')
      .map((command) => (
        command.type === 'stop-controller' ? command.controller : null
      )),
    CRAZY_TOSS_TIME_UP_STOP_ORDER,
  );
  assert.deepEqual(timeUp.slice(-2), [
    { type: 'process-objective', eventId: 9, state: 2 },
    { type: 'process-objective', eventId: 5, state: 2 },
  ]);

  const result = session.timeUpFinish();
  assert.deepEqual(result, [
    { type: 'set-cut-enabled', enabled: false },
    { type: 'stop-effects' },
    {
      type: 'capture-crazy-bird-parent',
      boundary: 'captured-crazy-bird-parent',
    },
    { type: 'construct-result' },
    { type: 'set-result-mode', mode: 4 },
    { type: 'set-result-score', score: -10 },
    { type: 'remove-crazy-bird', cleanup: true },
    { type: 'attach-result', zOrder: 1 },
  ]);
  assert.equal(
    result.some((command) => (
      'type' in command
      && [
        'add-fail-marker',
        'create-game-word',
        'create-over-word',
        'schedule-speed-up-callback',
        'set-physics-stopped',
      ].includes(command.type)
    )),
    false,
  );
});
