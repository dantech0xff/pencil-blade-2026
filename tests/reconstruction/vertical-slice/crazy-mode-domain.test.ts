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
  CRAZY_DOUBLE_SCORE_FRUIT_ID,
  CRAZY_DOUBLE_TOSS_FRUIT_ID,
  CRAZY_ELECTRIC_FRUIT_ID,
  CRAZY_FREEZE_FRUIT_ID,
  CRAZY_MAGNET_FRUIT_ID,
  createCrazyFruitCutCommands,
} = await import('../../../game/assets/scripts/domain/crazy-fruit-cut.ts');
const {
  CRAZY_BIRD_MODE_ID,
  CRAZY_MODE_ID,
  CRAZY_TOSS_BOMB_HIT_STOP_ORDER,
  CRAZY_TOSS_CREATION_ORDER,
  CRAZY_TOSS_ROWS,
  CRAZY_TOSS_START_ORDER,
  CRAZY_TOSS_TIME_UP_STOP_ORDER,
} = await import('../../../game/assets/scripts/domain/crazy-toss-config.ts');
const {
  CRAZY_INITIAL_INTRO_SECONDS,
  CRAZY_SETTINGS_BEST_SCORE_KEY,
  CrazySession,
} = await import('../../../game/assets/scripts/domain/crazy-session.ts');

test('Crazy controller table preserves the recovered mode identity, order, and row parameters', () => {
  assert.equal(CRAZY_MODE_ID, 1);
  assert.equal(CRAZY_BIRD_MODE_ID, 4);
  assert.equal(CRAZY_INITIAL_INTRO_SECONDS, 60);
  assert.equal(CRAZY_SETTINGS_BEST_SCORE_KEY, 'crazy_best_1');
  assert.deepEqual(CRAZY_TOSS_CREATION_ORDER, [
    'ab', 'b0', 'b2', 'ac', 'b1', 'b3', 'b4', 'af', 'ae', 'ad', 'b5',
  ]);
  assert.deepEqual(CRAZY_TOSS_START_ORDER, [
    'ab', 'b0', 'b2', 'ac', 'b1', 'b3', 'ad', 'b5', 'ae', 'af',
  ]);
  assert.deepEqual(CRAZY_TOSS_TIME_UP_STOP_ORDER, [
    'ab', 'ad', 'ae', 'af', 'b0', 'b2', 'ac', 'b1', 'b3',
  ]);
  assert.deepEqual(CRAZY_TOSS_BOMB_HIT_STOP_ORDER, ['ae']);

  assert.deepEqual(CRAZY_TOSS_ROWS.map((row) => ({
    controller: row.controller,
    id: row.id,
    slotOffset: row.slotOffset,
    zOrder: row.zOrder,
  })), [
    { controller: 'free', id: 'ab', slotOffset: 0x2ac, zOrder: 1 },
    { controller: 'concurrent', id: 'b0', slotOffset: 0x2c0, zOrder: 1 },
    { controller: 'wave', id: 'b2', slotOffset: 0x2c8, zOrder: 1 },
    { controller: 'free', id: 'ac', slotOffset: 0x2b0, zOrder: 1 },
    { controller: 'concurrent', id: 'b1', slotOffset: 0x2c4, zOrder: 1 },
    { controller: 'wave', id: 'b3', slotOffset: 0x2cc, zOrder: 1 },
    { controller: 'double', id: 'b4', slotOffset: 0x2d0, zOrder: 1 },
    { controller: 'free', id: 'af', slotOffset: 0x2bc, zOrder: 1 },
    { controller: 'free', id: 'ae', slotOffset: 0x2b8, zOrder: 1 },
    { controller: 'free', id: 'ad', slotOffset: 0x2b4, zOrder: 1 },
    { controller: 'bonus', id: 'b5', slotOffset: 0x2d4, zOrder: 1 },
  ]);

  const b0 = CRAZY_TOSS_ROWS[1];
  if (b0.controller !== 'concurrent') {
    throw new Error('expected Crazy b0 row to be concurrent');
  }
  assert.equal(b0.countMin, 1);
  assert.equal(b0.countMax, 3);
  const b1 = CRAZY_TOSS_ROWS[4];
  if (b1.controller !== 'concurrent') {
    throw new Error('expected Crazy b1 row to be concurrent');
  }
  assert.equal(b1.countMin, 1);
  assert.equal(b1.countMax, 2);
  const b4 = CRAZY_TOSS_ROWS[6];
  if (b4.controller !== 'double') {
    throw new Error('expected Crazy b4 row to be double');
  }
  assert.equal(b4.guardedSeconds, 15);
  assert.deepEqual(b4.internalInterval, { lowSeconds: 0.75, highSeconds: 1.5 });
  const b3 = CRAZY_TOSS_ROWS[5];
  if (b3.controller !== 'wave') {
    throw new Error('expected Crazy b3 row to be wave');
  }
  assert.deepEqual(b3.outerInterval, { lowSeconds: 15, highSeconds: 35 });
  const ae = CRAZY_TOSS_ROWS[8];
  if (ae.controller !== 'free') {
    throw new Error('expected Crazy ae row to be free');
  }
  const af = CRAZY_TOSS_ROWS[7];
  const ad = CRAZY_TOSS_ROWS[9];
  if (af.controller !== 'free' || ad.controller !== 'free') {
    throw new Error('expected Crazy af/ad rows to be free');
  }
  assert.equal(af.direction, 1);
  assert.equal(ae.direction, 1);
  assert.equal(ad.direction, 1);
  assert.deepEqual(ae.outerInterval, { lowSeconds: 20, highSeconds: 45 });
  const b5 = CRAZY_TOSS_ROWS[10];
  if (b5.controller !== 'bonus') {
    throw new Error('expected Crazy b5 row to be bonus');
  }
  assert.deepEqual(b5.candidateFruitIds, [12, 10, 11]);
  assert.deepEqual(b5.outerInterval, { lowSeconds: 5, highSeconds: 30 });
});

test('Crazy fruit IDs 10..14 preserve effect-before-score ordering and strict validation', () => {
  assert.deepEqual(createCrazyFruitCutCommands({ x: 1, y: 2 }, CRAZY_DOUBLE_SCORE_FRUIT_ID, 99), [
    { type: 'enable-double-score' },
  ]);
  assert.deepEqual(createCrazyFruitCutCommands({ x: 1, y: 2 }, CRAZY_DOUBLE_TOSS_FRUIT_ID, 1), [
    { type: 'start-double-toss' },
    { type: 'add-score', value: 10 },
  ]);
  assert.deepEqual(createCrazyFruitCutCommands({ x: 1, y: 2 }, CRAZY_FREEZE_FRUIT_ID, 1), [
    { type: 'freeze-time' },
    { type: 'add-score', value: 10 },
  ]);
  assert.deepEqual(createCrazyFruitCutCommands({ x: 1, y: 2 }, CRAZY_ELECTRIC_FRUIT_ID, 1), [
    { type: 'start-electric-bomb' },
    { type: 'add-score', value: 10 },
  ]);
  assert.deepEqual(createCrazyFruitCutCommands({ x: 1, y: 2 }, CRAZY_MAGNET_FRUIT_ID, 1), [
    {
      type: 'create-magnet-animation',
      beginCallback: 'magnet-begin',
      endCallback: 'magnet-end',
      zOrder: 1,
    },
    { type: 'add-score', value: 10 },
  ]);
  assert.deepEqual(createCrazyFruitCutCommands({ x: 1, y: 2 }, 7, 33), [
    { type: 'add-score', value: 33 },
  ]);
  assert.throws(() => createCrazyFruitCutCommands(null as never, 7, 1), TypeError);
  assert.throws(() => createCrazyFruitCutCommands({ x: Number.NaN, y: 2 }, 7, 1), RangeError);
  assert.throws(() => createCrazyFruitCutCommands({ x: 1, y: 2 }, 7.5, 1), RangeError);
  assert.throws(() => createCrazyFruitCutCommands({ x: 1, y: 2 }, 7, 1.5), RangeError);
});

test('Crazy session enters with the recovered controller graph and timed result flow', () => {
  const session = new CrazySession(30);

  assert.deepEqual(session.snapshot(), {
    cutEnabled: true,
    hasTimeManager: true,
    lifecycle: 'intro',
    mode: 1,
    score: {
      authoritativeScore: 0,
      displayedScore: 0,
      doubleScoreActive: false,
      displayedScoreScaleActive: false,
      pendingDoubleScore: 0,
    },
  });

  const enterScene = session.enterScene();
  assert.throws(() => session.enterScene(), /only once/);
  assert.deepEqual(enterScene.slice(0, 5), [
    { type: 'enter-base-gameplay-layer' },
    { type: 'reset-bonus-manager' },
    { type: 'process-objective', eventId: 8, state: 0 },
    { type: 'process-objective', eventId: 4, state: 0 },
    { type: 'read-logical-director-size' },
  ]);
  assert.equal(enterScene.filter((command) => command.type === 'construct-controller').length, 11);
  assert.deepEqual(
    enterScene.filter((command) => command.type === 'construct-controller').map((command) => {
      if (command.type !== 'construct-controller') {
        throw new Error('expected construct-controller command');
      }
      return command.controller;
    }),
    CRAZY_TOSS_CREATION_ORDER,
  );
  assert.deepEqual(
    enterScene.at(-1),
    { type: 'initialize-best-score', key: 'crazy_best_1', score: 30 },
  );
  assert.deepEqual(
    enterScene.find((command) => command.type === 'construct-time-manager'),
    {
      callbackOrder: ['freeze-start', 'freeze-finish', 'time-up', 'time-up-finish'],
      durationSeconds: 60,
      type: 'construct-time-manager',
    },
  );
  assert.deepEqual(
    enterScene.slice(-5),
    [
      { canonicalPath: 'Text/text-60s.png', type: 'create-intro-sixty', zOrder: 1 },
      { type: 'construct-bomb-electric', zOrder: 1 },
      { type: 'attach-bomb-electric', zOrder: 1 },
      { type: 'initialize-pause-ui' },
      { type: 'initialize-best-score', key: 'crazy_best_1', score: 30 },
    ],
  );

  const intro = session.completeIntro();
  assert.deepEqual(intro[0], { type: 'start-time-manager' });
  assert.deepEqual(intro[1], { type: 'set-cut-enabled', enabled: true });
  assert.deepEqual(
    intro.filter((command) => command.type === 'start-controller').map((command) => {
      if (command.type !== 'start-controller') {
        throw new Error('expected start-controller command');
      }
      return command.controller;
    }),
    CRAZY_TOSS_START_ORDER,
  );

  session.addScore(12);
  session.enableDoubleScore();
  session.addScore(7);
  session.addScore(-2);
  assert.equal(session.snapshot().score.pendingDoubleScore, 5);

  const bombHit = session.bombHit({ x: 4, y: 5 });
  assert.deepEqual(bombHit.slice(0, 3), [
    { type: 'set-cut-enabled', enabled: false },
    { type: 'add-score', value: -10 },
    { type: 'finish-double-score-presentation', exitDurationSeconds: 1 },
  ]);
  assert.equal(
    bombHit.some((command) => command.type === 'set-physics-stopped'),
    false,
  );
  assert.deepEqual(bombHit.slice(-1), [
    { type: 'process-objective', eventId: 8, state: 1 },
  ]);
  assert.deepEqual(
    bombHit.filter((command) => command.type === 'stop-controller'),
    [{ type: 'stop-controller', controller: 'ae' }],
  );
  assert.equal(bombHit.some((command) => command.type === 'stop-electric-bomb'), false);
  assert.deepEqual(session.snapshot().score, {
    authoritativeScore: 2,
    displayedScore: 0,
    doubleScoreActive: false,
    displayedScoreScaleActive: false,
    pendingDoubleScore: 0,
  });

  assert.deepEqual(session.afterBombHit(), [
    { type: 'set-cut-enabled', enabled: true },
  ]);

  const timeUp = session.timeUp();
  assert.equal(session.snapshot().lifecycle, 'time-up');
  assert.throws(() => session.timeUp(), /only while running/);
  assert.deepEqual(timeUp.filter((command) => command.type === 'stop-controller').map((command) => {
    if (command.type !== 'stop-controller') {
      throw new Error('expected stop-controller command');
    }
    return command.controller;
  }), CRAZY_TOSS_TIME_UP_STOP_ORDER);
  assert.equal(timeUp.some((command) => command.type === 'stop-electric-bomb'), true);
  assert.deepEqual(timeUp.slice(-2), [
    { type: 'process-objective', eventId: 8, state: 2 },
    { type: 'process-objective', eventId: 4, state: 2 },
  ]);

  assert.deepEqual(session.timeUpFinish(), [
    { type: 'set-cut-enabled', enabled: false },
    { type: 'stop-effects' },
    { type: 'capture-crazy-parent', boundary: 'captured-crazy-parent' },
    { type: 'construct-result' },
    { type: 'set-result-mode', mode: 1 },
    { type: 'set-result-score', score: 2 },
    { type: 'remove-crazy', cleanup: true },
    { type: 'attach-result', zOrder: 1 },
  ]);
  assert.equal(session.snapshot().lifecycle, 'result-transition');
  assert.throws(() => session.timeUpFinish(), /only after time-up/);
  session.commitTimeUpFinish();
  assert.equal(session.snapshot().lifecycle, 'result-removed');
  assert.throws(() => new CrazySession().completeIntro(), /only once/);
});

test('Crazy score update promotes a completed run above the saved best before Result', () => {
  const session = new CrazySession(30);
  session.enterScene();
  session.completeIntro();
  session.addScore(45);

  assert.deepEqual(session.updateScorePresentation(), [{
    type: 'start-displayed-score-scale-up',
    durationSeconds: Math.fround(0.025),
    targetScale: 1.25,
  }]);
  session.timeUp();
  assert.deepEqual(
    session.timeUpFinish().find((command) => command.type === 'set-result-score'),
    { type: 'set-result-score', score: 45 },
  );
});

test('Crazy Result uses completed authoritative score below saved best and after final double flush', () => {
  const lowerRun = new CrazySession(100);
  lowerRun.enterScene();
  lowerRun.completeIntro();
  lowerRun.addScore(15);
  lowerRun.updateScorePresentation();
  lowerRun.timeUp();
  assert.deepEqual(
    lowerRun.timeUpFinish().find((command) => command.type === 'set-result-score'),
    { type: 'set-result-score', score: 15 },
  );

  const pendingRun = new CrazySession(100);
  pendingRun.enterScene();
  pendingRun.completeIntro();
  pendingRun.enableDoubleScore();
  pendingRun.addScore(7);
  pendingRun.timeUp();
  assert.deepEqual(
    pendingRun.timeUpFinish().find((command) => command.type === 'set-result-score'),
    { type: 'set-result-score', score: 14 },
  );
});

test('Crazy result transition can roll back to Time Up and retry once', () => {
  const session = new CrazySession();
  session.enterScene();
  session.completeIntro();
  session.timeUp();
  session.timeUpFinish();
  session.rollbackTimeUpFinish();
  assert.equal(session.snapshot().lifecycle, 'time-up');
  assert.equal(session.snapshot().cutEnabled, true);

  session.timeUpFinish();
  session.commitTimeUpFinish();
  assert.equal(session.snapshot().lifecycle, 'result-removed');
  assert.throws(() => session.rollbackTimeUpFinish(), /not pending/);
});
