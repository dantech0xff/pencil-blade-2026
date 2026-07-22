import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMBO_WINDOW_SECONDS,
  ComboService,
} from '../../../game/assets/scripts/domain/combo-service.ts';
import {
  createClassicFruitCutCommands,
  getFruitScore,
} from '../../../game/assets/scripts/domain/classic-fruit-cut.ts';
import { FailService } from '../../../game/assets/scripts/domain/fail-service.ts';
import {
  DISPLAY_SCORE_SCALE_SECONDS,
  ScoreService,
} from '../../../game/assets/scripts/domain/score-service.ts';
import {
  CLASSIC_SESSION_TOSS_ORDER,
  ClassicSession,
} from '../../../game/assets/scripts/domain/classic-session.ts';

test('normal and critical fruits expose one and ten point scores', () => {
  assert.equal(getFruitScore(false), 1);
  assert.equal(getFruitScore(true), 10);
});

test('electric and magnet effects precede their fixed ten-point score override', () => {
  assert.deepEqual(createClassicFruitCutCommands({ x: 10, y: 20 }, 13, -99), [
    { type: 'start-electric-bomb' },
    { type: 'add-score', value: 10 },
  ]);
  assert.deepEqual(createClassicFruitCutCommands({ x: 30, y: 40 }, 14, 1), [
    {
      type: 'create-magnet-animation',
      beginCallback: 'magnet-begin',
      endCallback: 'magnet-end',
      zOrder: 1,
    },
    { type: 'add-score', value: 10 },
  ]);
  assert.deepEqual(createClassicFruitCutCommands({ x: 50, y: 60 }, 0, 1), [
    { type: 'add-score', value: 1 },
  ]);
});

test('double score accumulates signed pending values and flushes pending times two', () => {
  const score = new ScoreService(10, 10);

  assert.deepEqual(score.enableDoubleScore(), [{
    type: 'start-double-score-presentation',
    activeDelaySeconds: 15,
    introDurationSeconds: 1,
  }]);
  score.addScore(7);
  score.addScore(-2);
  assert.deepEqual(score.snapshot(), {
    authoritativeScore: 10,
    displayedScore: 10,
    doubleScoreActive: true,
    displayedScoreScaleActive: false,
    pendingDoubleScore: 5,
  });

  assert.deepEqual(score.finishDoubleScore(), [
    { type: 'finish-double-score-presentation', exitDurationSeconds: 1 },
    { type: 'disable-bonus', bonusId: 10 },
  ]);
  assert.deepEqual(score.snapshot(), {
    authoritativeScore: 20,
    displayedScore: 10,
    doubleScoreActive: false,
    displayedScoreScaleActive: false,
    pendingDoubleScore: 0,
  });
  assert.deepEqual(score.finishDoubleScore(), []);
});

test('early double-score disable uses the same flush path and re-enable clears pending', () => {
  const score = new ScoreService();
  score.enableDoubleScore();
  score.addScore(-10);
  assert.deepEqual(score.disableDoubleScore(), [
    { type: 'finish-double-score-presentation', exitDurationSeconds: 1 },
    { type: 'disable-bonus', bonusId: 10 },
  ]);
  assert.equal(score.authoritativeScore, -20);

  score.enableDoubleScore();
  score.addScore(5);
  score.enableDoubleScore();
  assert.equal(score.pendingDoubleScore, 0);
});

test('stale double-score delay callbacks flush unconditionally like the native callback', () => {
  const score = new ScoreService();
  score.enableDoubleScore();
  score.addScore(3);
  score.disableDoubleScore();
  assert.equal(score.authoritativeScore, 6);

  assert.deepEqual(score.completeDoubleScoreDelay(), [
    { type: 'finish-double-score-presentation', exitDurationSeconds: 1 },
    { type: 'disable-bonus', bonusId: 10 },
  ]);
  assert.equal(score.authoritativeScore, 6);

  score.enableDoubleScore();
  score.addScore(4);
  score.completeDoubleScoreDelay();
  assert.equal(score.authoritativeScore, 14);
  assert.equal(score.doubleScoreActive, false);
  assert.deepEqual(score.completeDoubleScoreDelay(), [
    { type: 'finish-double-score-presentation', exitDurationSeconds: 1 },
    { type: 'disable-bonus', bonusId: 10 },
  ]);
  assert.equal(score.authoritativeScore, 14);
});

test('displayed score smooths upward by ten-percent chunks or one and downward by one', () => {
  const upward = new ScoreService(100, 0);
  assert.deepEqual(upward.updateDisplayedScore(), [{
    type: 'start-displayed-score-scale-up',
    durationSeconds: DISPLAY_SCORE_SCALE_SECONDS,
    targetScale: 1.25,
  }]);
  assert.deepEqual(upward.completeDisplayedScoreScaleUp(), [{
    type: 'start-displayed-score-scale-down',
    durationSeconds: DISPLAY_SCORE_SCALE_SECONDS,
    targetScale: 1,
  }]);
  assert.equal(upward.displayedScore, 10);
  upward.completeDisplayedScoreScaleDown();

  const exactTen = new ScoreService(10, 0);
  exactTen.updateDisplayedScore();
  exactTen.completeDisplayedScoreScaleUp();
  assert.equal(exactTen.displayedScore, 1);

  const downward = new ScoreService(0, 2);
  assert.deepEqual(downward.updateDisplayedScore(), []);
  assert.equal(downward.displayedScore, 1);
  downward.updateDisplayedScore();
  assert.equal(downward.displayedScore, 0);
});

test('best score follows the authoritative total after smoothing and restores only below baseline', () => {
  const score = new ScoreService(0, 0, 25);

  score.addScore(30);
  assert.deepEqual(score.updateDisplayedScore(), [{
    type: 'start-displayed-score-scale-up',
    durationSeconds: DISPLAY_SCORE_SCALE_SECONDS,
    targetScale: 1.25,
  }]);
  assert.equal(score.displayedScore, 0);
  assert.equal(score.bestScore, 30);
  assert.equal(score.bestScoreIsNew, true);

  score.addScore(-5);
  score.updateDisplayedScore();
  assert.equal(score.bestScore, 30);
  assert.equal(score.bestScoreIsNew, true);

  score.addScore(-1);
  score.updateDisplayedScore();
  assert.equal(score.bestScore, 25);
  assert.equal(score.bestScoreIsNew, false);
  assert.throws(() => new ScoreService(0, 0, 0.5), /initialBestScore/);
});

test('combo remains open at exactly 0.25 and closes only beyond it', () => {
  let randomCalls = 0;
  const combo = new ComboService({
    nextIntInclusive() {
      randomCalls += 1;
      return 2;
    },
  });
  combo.checkCombo({ x: 1, y: 2 });
  combo.checkCombo({ x: 3, y: 4 });
  combo.checkCombo({ x: 5, y: 6 });

  assert.deepEqual(combo.update(COMBO_WINDOW_SECONDS, true), []);
  assert.equal(combo.snapshot().active, true);
  assert.deepEqual(combo.update(0.0001, true), [
    { type: 'process-objective', eventId: 0, count: 3 },
    { type: 'create-combo-item', count: 3, position: { x: 5, y: 6 } },
    { type: 'add-score', value: 3 },
    { type: 'attach-combo-item', zOrder: 1 },
    { type: 'play-combo-sound', soundIndex: 2 },
    { type: 'reset-combo' },
  ]);
  assert.equal(randomCalls, 1);
  assert.deepEqual(combo.snapshot(), {
    active: false,
    count: 0,
    currentClockSeconds: 0,
    latestPosition: { x: 0, y: 0 },
    startClockSeconds: 0,
  });
});

test('combo command and shared-RNG/reset order changes only with effects enabled', () => {
  const rngObservations: unknown[] = [];
  let enabledCombo: ComboService;
  enabledCombo = new ComboService({
    nextIntInclusive(min, max) {
      rngObservations.push({ min, max, snapshot: enabledCombo.snapshot() });
      return 3;
    },
  });
  enabledCombo.checkCombo({ x: 1, y: 1 });
  enabledCombo.checkCombo({ x: 2, y: 2 });
  enabledCombo.checkCombo({ x: 3, y: 3 });
  const enabledCommands = enabledCombo.update(Math.fround(0.2501), true);

  assert.deepEqual(enabledCommands.map((command) => command.type), [
    'process-objective',
    'create-combo-item',
    'add-score',
    'attach-combo-item',
    'play-combo-sound',
    'reset-combo',
  ]);
  assert.deepEqual(rngObservations, [{
    min: 1,
    max: 3,
    snapshot: {
      active: true,
      count: 3,
      currentClockSeconds: Math.fround(0.2501),
      latestPosition: { x: 3, y: 3 },
      startClockSeconds: 0,
    },
  }]);

  let disabledRandomCalls = 0;
  const disabledCombo = new ComboService({
    nextIntInclusive() {
      disabledRandomCalls += 1;
      return 1;
    },
  });
  disabledCombo.checkCombo({ x: 1, y: 1 });
  disabledCombo.checkCombo({ x: 2, y: 2 });
  disabledCombo.checkCombo({ x: 3, y: 3 });
  assert.deepEqual(disabledCombo.update(Math.fround(0.2501), false).map((command) => command.type), [
    'process-objective',
    'create-combo-item',
    'add-score',
    'attach-combo-item',
    'reset-combo',
  ]);
  assert.equal(disabledRandomCalls, 0);
});

test('each accepted combo cut restarts the rolling window at the current clock', () => {
  const combo = new ComboService({ nextIntInclusive: () => 1 });
  combo.checkCombo({ x: 1, y: 1 });
  combo.update(0.2, false);
  combo.checkCombo({ x: 2, y: 2 });

  assert.deepEqual(combo.update(0.25, false), []);
  assert.equal(combo.snapshot().active, true);
  assert.deepEqual(combo.update(0.0001, false), [{ type: 'reset-combo' }]);
});

test('miss indicators queue before increment and every pending callback may repeat at count three', () => {
  const fail = new FailService();

  for (const strike of [1, 2, 3] as const) {
    assert.deepEqual(fail.registerMiss({ x: strike * 10, y: strike * 20 }), [
      {
        type: 'queue-fail-indicator',
        missPosition: { x: strike * 10, y: strike * 20 },
        strike,
      },
      { type: 'increment-fail-count', count: strike },
    ]);
  }
  assert.deepEqual(fail.registerMiss({ x: 99, y: 99 }), []);
  assert.deepEqual(fail.completeIndicator(), [{ type: 'game-over-callback' }]);
  assert.deepEqual(fail.completeIndicator(), [{ type: 'game-over-callback' }]);
  assert.deepEqual(fail.completeIndicator(), [{ type: 'game-over-callback' }]);

  fail.restart();
  assert.deepEqual(fail.snapshot(), { count: 0 });
  assert.deepEqual(fail.completeIndicator(), []);
});

test('repeated fail callbacks integrate with repeatable shutdown and one terminal guard', () => {
  const fail = new FailService();
  const session = new ClassicSession();
  session.completeIntro();
  fail.registerMiss({ x: 1, y: 1 });
  fail.registerMiss({ x: 2, y: 2 });
  fail.registerMiss({ x: 3, y: 3 });

  const commands = Array.from({ length: 3 }, () => {
    assert.deepEqual(fail.completeIndicator(), [{ type: 'game-over-callback' }]);
    return session.gameOverFromMiss();
  }).flat();

  assert.equal(commands.filter((command) => command.type === 'show-game-over').length, 1);
  assert.equal(commands.filter((command) => command.type === 'set-cut-enabled').length, 3);
  assert.equal(commands.filter((command) => command.type === 'stop-electric-bomb').length, 3);
  assert.equal(
    commands.filter((command) => command.type === 'toss-controller').length,
    3 * CLASSIC_SESSION_TOSS_ORDER.length,
  );
});
