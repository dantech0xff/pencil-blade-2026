import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLASSIC_SCORE_HUD_ENTRY_ACTION_SECONDS,
  CLASSIC_DOUBLE_SCORE_PANEL_ACTION_SECONDS,
  CLASSIC_SCORE_HUD_FONT_CANONICAL_PATH,
  CLASSIC_SCORE_HUD_BLACK,
  CLASSIC_SCORE_HUD_NEW_BEST_GREEN,
  CLASSIC_SCORE_HUD_Z_ORDER,
  CLASSIC_SCORE_ICON_PULSE_ACTION_SECONDS,
  CLASSIC_SCORE_ICON_PULSE_SCALE,
  classicBestScoreColor,
  createClassicScoreHudLayout,
  formatClassicBestScore,
  formatClassicInitialDisplayedScore,
  formatClassicPendingDoubleScore,
  formatClassicUpdatedDisplayedScore,
} from '../../../game/assets/scripts/domain/classic-score-hud-presentation.ts';

const LOW_DIMENSIONS = Object.freeze({
  bestScoreCup: Object.freeze({ width: 49, height: 52 }),
  doubleScorePanel: Object.freeze({ width: 134, height: 115 }),
  scoreIcon: Object.freeze({ width: 55, height: 55 }),
});

const HIGH_DIMENSIONS = Object.freeze({
  bestScoreCup: Object.freeze({ width: 73, height: 77 }),
  doubleScorePanel: Object.freeze({ width: 200, height: 172 }),
  scoreIcon: Object.freeze({ width: 82, height: 82 }),
});

test('compact HUD preserves recovered world formulas, exact font, anchors, and entry action', () => {
  const layout = createClassicScoreHudLayout({ width: 480, height: 800 }, LOW_DIMENSIONS);

  assert.deepEqual(layout.scoreIcon, {
    initialOpacity: 0,
    worldPosition: { x: Math.fround(38.39999771118164), y: 760 },
    zOrder: 1,
  });
  assert.deepEqual(layout.bestScoreCup, {
    initialOpacity: 0,
    worldPosition: { x: Math.fround(38.39999771118164), y: 700 },
    zOrder: 1,
  });
  assert.deepEqual(layout.doubleScorePanel, {
    hiddenWorldPosition: { x: -67, y: 600 },
    moveActionSeconds: 1,
    shownWorldPosition: { x: 67, y: 600 },
    zOrder: 1,
  });
  assert.deepEqual(layout.liveScoreLabel, {
    anchor: { x: 0, y: 0.5 },
    color: { b: 0, g: 0, r: 0 },
    fontCanonicalPath: 'Fonts/Linds.ttf',
    fontSize: 32,
    initialText: '0',
    updateFormat: ' %d',
    worldPosition: { x: Math.fround(68.30000305175781), y: 760 },
    zOrder: 1,
  });
  assert.deepEqual(layout.bestScoreLabel, {
    anchor: { x: 0, y: Math.fround(-0.15) },
    color: { b: 0, g: 0, r: 0 },
    creatorLocalPosition: { x: 24.5, y: -26 },
    fontCanonicalPath: 'Fonts/Linds.ttf',
    fontSize: 30,
    legacyContentPosition: { x: 49, y: 0 },
    valueFormat: ' %d',
    zOrder: 1,
  });
  assert.deepEqual(layout.pendingDoubleLabel, {
    anchor: { x: 0.5, y: 0.5 },
    color: { b: 0, g: 0, r: 0 },
    creatorLocalPosition: { x: Math.fround(-22.333332061767578), y: 0 },
    fontCanonicalPath: 'Fonts/Linds.ttf',
    fontSize: 28,
    initialText: '0',
    legacyContentPosition: { x: Math.fround(44.66666793823242), y: 57.5 },
    updateFormat: '%d',
    zOrder: 1,
  });
  assert.deepEqual(layout.scoreIconPulse, {
    actionSecondsPerLeg: Math.fround(0.025),
    apexScale: Math.fround(1.25),
    restingScale: 1,
  });
  assert.equal(layout.entryActionSeconds, 1);
  assert.equal(CLASSIC_SCORE_HUD_ENTRY_ACTION_SECONDS, 1);
  assert.equal(CLASSIC_DOUBLE_SCORE_PANEL_ACTION_SECONDS, 1);
  assert.equal(CLASSIC_SCORE_HUD_FONT_CANONICAL_PATH, 'Fonts/Linds.ttf');
  assert.equal(CLASSIC_SCORE_HUD_Z_ORDER, 1);
  assert.equal(CLASSIC_SCORE_ICON_PULSE_ACTION_SECONDS, Math.fround(0.025));
  assert.equal(CLASSIC_SCORE_ICON_PULSE_SCALE, Math.fround(1.25));
});

test('score strings and best-score colors preserve recovered update formats', () => {
  assert.equal(formatClassicInitialDisplayedScore(), '0');
  assert.equal(formatClassicUpdatedDisplayedScore(0), ' 0');
  assert.equal(formatClassicUpdatedDisplayedScore(42), ' 42');
  assert.equal(formatClassicUpdatedDisplayedScore(-10), ' -10');
  assert.equal(formatClassicBestScore(123), ' 123');
  assert.equal(formatClassicPendingDoubleScore(123), '123');
  assert.deepEqual(classicBestScoreColor(false), { b: 0, g: 0, r: 0 });
  assert.deepEqual(classicBestScoreColor(true), { b: 0, g: 128, r: 0 });
  assert.equal(classicBestScoreColor(false), CLASSIC_SCORE_HUD_BLACK);
  assert.equal(classicBestScoreColor(true), CLASSIC_SCORE_HUD_NEW_BEST_GREEN);
  assert.throws(() => formatClassicUpdatedDisplayedScore(0.5), /safe integer/);
  assert.throws(() => formatClassicBestScore(Number.NaN), /safe integer/);
  assert.throws(() => formatClassicPendingDoubleScore(Number.MAX_SAFE_INTEGER + 1), /safe integer/);
  assert.throws(() => classicBestScoreColor('yes' as never), /boolean/);
});

test('high HUD scales only font point sizes while using exact high-tree raster geometry', () => {
  const layout = createClassicScoreHudLayout({ width: 720, height: 1280 }, HIGH_DIMENSIONS);

  assert.deepEqual(layout.scoreIcon.worldPosition, {
    x: Math.fround(57.599998474121094),
    y: 1216,
  });
  assert.deepEqual(layout.bestScoreCup.worldPosition, {
    x: Math.fround(57.599998474121094),
    y: 1120,
  });
  assert.deepEqual(layout.liveScoreLabel.worldPosition, {
    x: Math.fround(102.19999694824219),
    y: 1216,
  });
  assert.equal(layout.liveScoreLabel.fontSize, 48);
  assert.equal(layout.bestScoreLabel.fontSize, 45);
  assert.equal(layout.pendingDoubleLabel.fontSize, 42);
  assert.deepEqual(layout.doubleScorePanel, {
    hiddenWorldPosition: { x: -100, y: 960 },
    moveActionSeconds: 1,
    shownWorldPosition: { x: 100, y: 960 },
    zOrder: 1,
  });
  assert.deepEqual(layout.bestScoreLabel.creatorLocalPosition, { x: 36.5, y: -38.5 });
  assert.deepEqual(layout.pendingDoubleLabel.creatorLocalPosition, {
    x: Math.fround(-33.333335876464844),
    y: 0,
  });
});

test('HUD layout rejects invalid viewports and incomplete raster geometry', () => {
  assert.throws(
    () => createClassicScoreHudLayout({ width: 0, height: 800 }, LOW_DIMENSIONS),
    /viewport.width/,
  );
  assert.throws(
    () => createClassicScoreHudLayout({ width: 480, height: Number.NaN }, LOW_DIMENSIONS),
    /viewport.height/,
  );
  assert.throws(
    () => createClassicScoreHudLayout(
      { width: 480, height: 800 },
      { ...LOW_DIMENSIONS, scoreIcon: { width: -1, height: 55 } },
    ),
    /dimensions.scoreIcon.width/,
  );
});
