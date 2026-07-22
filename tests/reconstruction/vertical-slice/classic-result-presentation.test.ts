import assert from 'node:assert/strict';
import test from 'node:test';

import { CLASSIC_RESULT_RESOURCES } from '../../../game/assets/scripts/domain/classic-resource-contract.ts';
import {
  CLASSIC_RESULT_AGENCY_FONT_CANONICAL_PATH,
  CLASSIC_RESULT_COINS_FONT_CANONICAL_PATH,
  CLASSIC_RESULT_PANEL_FADE_SECONDS,
  CLASSIC_RESULT_PURPLE,
  CLASSIC_RESULT_RASTER_DIMENSIONS,
  CLASSIC_RESULT_SHELL_ACTION_SECONDS,
  CLASSIC_RESULT_TOTAL_COINS_ACTION_SECONDS,
  CLASSIC_RESULT_WHITE,
  CLASSIC_RESULT_Z_ORDER,
  createClassicResultLayout,
  formatClassicResultScore,
  getClassicResultRasterDimensions,
} from '../../../game/assets/scripts/domain/classic-result-presentation.ts';

const COMPACT_VISIBLE_RECT = Object.freeze({ height: 800, width: 480, x: 0, y: 0 });
const HIGH_VISIBLE_RECT = Object.freeze({ height: 1280, width: 720, x: 0, y: 0 });

test('result raster sets preserve the exact Classic-reachable low and high geometry', () => {
  assert.deepEqual(CLASSIC_RESULT_RASTER_DIMENSIONS, {
    '480x800': {
      medalNone: { width: 104, height: 209 },
      menuButton: { width: 134, height: 129 },
      resultHeader: { width: 552, height: 118 },
      retryButton: { width: 111, height: 105 },
      scorePanel: { width: 442, height: 407 },
      totalCoinsPanel: { width: 334, height: 131 },
    },
    '720x1280': {
      medalNone: { width: 154, height: 314 },
      menuButton: { width: 201, height: 194 },
      resultHeader: { width: 792, height: 159 },
      retryButton: { width: 167, height: 158 },
      scorePanel: { width: 662, height: 610 },
      totalCoinsPanel: { width: 464, height: 160 },
    },
  });
  assert.equal(
    getClassicResultRasterDimensions('480x800'),
    CLASSIC_RESULT_RASTER_DIMENSIONS['480x800'],
  );
  assert.equal(
    getClassicResultRasterDimensions('720x1280'),
    CLASSIC_RESULT_RASTER_DIMENSIONS['720x1280'],
  );
  assert.throws(() => getClassicResultRasterDimensions('other' as never), /assetTree/);

  for (const tree of ['480x800', '720x1280'] as const) {
    const presentation = CLASSIC_RESULT_RASTER_DIMENSIONS[tree];
    const resources = CLASSIC_RESULT_RESOURCES[tree];
    assert.deepEqual(presentation, {
      medalNone: resources.medalNone.dimensions,
      menuButton: resources.menuNormal.dimensions,
      resultHeader: resources.header.dimensions,
      retryButton: resources.retryNormal.dimensions,
      scorePanel: resources.background.dimensions,
      totalCoinsPanel: resources.totalCoins.dimensions,
    });
  }
});

test('compact result shell preserves recovered transforms, timings, score label, and anchors', () => {
  const layout = createClassicResultLayout(
    COMPACT_VISIBLE_RECT,
    CLASSIC_RESULT_RASTER_DIMENSIONS['480x800'],
  );

  assert.deepEqual(layout.scorePanel, {
    actionSeconds: Math.fround(0.75),
    anchor: { x: 0.5, y: 0.5 },
    final: { opacity: 255, scale: 1, worldPosition: { x: 240, y: 440 } },
    initial: { opacity: 0, scale: 1, worldPosition: { x: 240, y: 440 } },
    zOrder: 1,
  });
  assert.deepEqual(layout.mainScoreLabel, {
    anchor: { x: 0, y: 0.5 },
    color: { b: 145, g: 45, r: 102 },
    fontCanonicalPath: 'Fonts/AgencyB.ttf',
    fontSize: 62,
    valueFormat: 'Score: %d',
    worldPosition: { x: 24, y: 640 },
    zOrder: 1,
  });
  assert.deepEqual(layout.resultHeader, {
    actionSeconds: 1,
    anchor: { x: 0.5, y: 0.5 },
    final: { opacity: 255, scale: 1, worldPosition: { x: 240, y: 740 } },
    initial: { opacity: 0, scale: 1, worldPosition: { x: 240, y: 859 } },
    zOrder: 1,
  });
  assert.deepEqual(layout.retryButton, {
    actionSeconds: 1,
    anchor: { x: 0.5, y: 0.5 },
    final: {
      opacity: 255,
      scale: 1,
      worldPosition: { x: 55.5, y: Math.fround(800 * Math.fround(0.075)) },
    },
    initial: {
      opacity: 0,
      scale: 1,
      worldPosition: { x: -55.5, y: Math.fround(800 * Math.fround(0.075)) },
    },
    zOrder: 1,
  });
  assert.deepEqual(layout.menuButton, {
    actionSeconds: 1,
    anchor: { x: 0.5, y: 0.5 },
    final: {
      opacity: 255,
      scale: 1,
      worldPosition: { x: 413, y: Math.fround(800 * Math.fround(0.075)) },
    },
    initial: {
      opacity: 0,
      scale: 1,
      worldPosition: { x: 547, y: Math.fround(800 * Math.fround(0.075)) },
    },
    zOrder: 1,
  });
  assert.deepEqual(layout.medalNone, {
    actionSeconds: 1,
    anchor: { x: 0.5, y: 0.5 },
    final: { opacity: 255, scale: 1, worldPosition: { x: 384, y: 600 } },
    initial: { opacity: 0, scale: 0.5, worldPosition: { x: 384, y: 600 } },
    zOrder: 1,
  });
  assert.deepEqual(layout.totalCoinsPanel, {
    actionSeconds: Math.fround(1.75),
    anchor: { x: 0.5, y: 0.5 },
    final: { opacity: 255, scale: 1, worldPosition: { x: 144, y: 160 } },
    initial: { opacity: 0, scale: 1, worldPosition: { x: -167, y: 160 } },
    invokesCompletionCallback: true,
    zOrder: 1,
  });
});

test('panel label slots preserve recovered anonymous positions and total-coins layout', () => {
  const layout = createClassicResultLayout(
    COMPACT_VISIBLE_RECT,
    CLASSIC_RESULT_RASTER_DIMENSIONS['480x800'],
  );

  assert.deepEqual(layout.panelLabels.map((label) => ({
    anchor: label.anchor,
    color: label.color,
    creator: label.creatorLocalPosition,
    font: label.fontCanonicalPath,
    fontSize: label.fontSize,
    legacy: label.legacyContentPosition,
    zOrder: label.zOrder,
  })), [
    {
      anchor: { x: 0.5, y: 0.5 },
      color: { b: 255, g: 255, r: 255 },
      creator: { x: Math.fround(22.100006103515625), y: Math.fround(20.350006103515625) },
      font: 'Fonts/AgencyB.ttf',
      fontSize: 32,
      legacy: { x: Math.fround(243.10000610351562), y: Math.fround(223.85000610351562) },
      zOrder: 1,
    },
    {
      anchor: { x: 0.5, y: 0.5 },
      color: { b: 255, g: 255, r: 255 },
      creator: { x: Math.fround(-121.55000305175781), y: Math.fround(-66.13749694824219) },
      font: 'Fonts/AgencyB.ttf',
      fontSize: 32,
      legacy: { x: Math.fround(99.44999694824219), y: Math.fround(137.3625030517578) },
      zOrder: 1,
    },
    {
      anchor: { x: 0.5, y: 0.5 },
      color: { b: 255, g: 255, r: 255 },
      creator: { x: 165.75, y: -127.1875 },
      font: 'Fonts/AgencyB.ttf',
      fontSize: 32,
      legacy: { x: 386.75, y: 76.3125 },
      zOrder: 1,
    },
  ]);
  for (const label of layout.panelLabels) {
    assert.equal('text' in label, false);
    assert.equal('value' in label, false);
    assert.equal('meaning' in label, false);
  }
  assert.deepEqual(layout.totalCoinsLabel, {
    anchor: { x: 0, y: Math.fround(0.45) },
    creatorLocalPosition: { x: -41.75, y: 0 },
    fontCanonicalPath: 'Fonts/SlabThing.ttf',
    fontSize: 34,
    legacyContentPosition: { x: 125.25, y: 65.5 },
    zOrder: 1,
  });
});

test('high result shell scales fonts and uses the exact high-tree transforms', () => {
  const layout = createClassicResultLayout(
    HIGH_VISIBLE_RECT,
    CLASSIC_RESULT_RASTER_DIMENSIONS['720x1280'],
  );

  assert.equal(layout.mainScoreLabel.fontSize, 93);
  assert.equal(layout.panelLabels[0].fontSize, 48);
  assert.equal(layout.totalCoinsLabel.fontSize, 51);
  assert.deepEqual(layout.scorePanel.initial.worldPosition, { x: 360, y: 704 });
  assert.deepEqual(layout.resultHeader, {
    actionSeconds: 1,
    anchor: { x: 0.5, y: 0.5 },
    final: { opacity: 255, scale: 1, worldPosition: { x: 360, y: 1184 } },
    initial: { opacity: 0, scale: 1, worldPosition: { x: 360, y: 1359.5 } },
    zOrder: 1,
  });
  assert.deepEqual(layout.retryButton.initial.worldPosition, { x: -83.5, y: 96 });
  assert.deepEqual(layout.retryButton.final.worldPosition, { x: 83.5, y: 96 });
  assert.deepEqual(layout.menuButton.initial.worldPosition, { x: 820.5, y: 96 });
  assert.deepEqual(layout.menuButton.final.worldPosition, { x: 619.5, y: 96 });
  assert.deepEqual(layout.medalNone.initial, {
    opacity: 0,
    scale: 0.5,
    worldPosition: { x: 576, y: 960 },
  });
  assert.deepEqual(layout.totalCoinsPanel.initial.worldPosition, { x: -232, y: 256 });
  assert.deepEqual(layout.totalCoinsPanel.final.worldPosition, {
    x: Math.fround(720 * Math.fround(0.3)),
    y: 256,
  });
  assert.deepEqual(layout.totalCoinsLabel.creatorLocalPosition, { x: -58, y: 0 });
});

test('visible-rect edges and center remain explicit for a non-zero origin', () => {
  const layout = createClassicResultLayout(
    { height: 800, width: 520, x: -20, y: 30 },
    CLASSIC_RESULT_RASTER_DIMENSIONS['480x800'],
  );
  const buttonY = Math.fround(Math.fround(800) * Math.fround(0.075));

  assert.deepEqual(layout.scorePanel.initial.worldPosition, {
    x: 240,
    y: Math.fround(Math.fround(430) * Math.fround(1.1)),
  });
  assert.deepEqual(layout.resultHeader.initial.worldPosition, { x: 240, y: 889 });
  assert.deepEqual(layout.resultHeader.final.worldPosition, { x: 240, y: 740 });
  assert.deepEqual(layout.retryButton.initial.worldPosition, { x: -75.5, y: buttonY });
  assert.deepEqual(layout.retryButton.final.worldPosition, { x: 35.5, y: buttonY });
  assert.deepEqual(layout.menuButton.initial.worldPosition, { x: 567, y: buttonY });
  assert.deepEqual(layout.menuButton.final.worldPosition, { x: 433, y: buttonY });
  assert.deepEqual(layout.totalCoinsPanel.initial.worldPosition, { x: -187, y: 190 });
  assert.deepEqual(layout.totalCoinsPanel.final.worldPosition, { x: 136, y: 190 });
  assert.deepEqual(layout.mainScoreLabel.worldPosition, { x: 26, y: 640 });
  assert.deepEqual(layout.medalNone.initial.worldPosition, { x: 416, y: 600 });
});

test('result constants, score formatting, immutability, and fail-closed validation are explicit', () => {
  assert.equal(CLASSIC_RESULT_AGENCY_FONT_CANONICAL_PATH, 'Fonts/AgencyB.ttf');
  assert.equal(CLASSIC_RESULT_COINS_FONT_CANONICAL_PATH, 'Fonts/SlabThing.ttf');
  assert.equal(CLASSIC_RESULT_PANEL_FADE_SECONDS, Math.fround(0.75));
  assert.equal(CLASSIC_RESULT_SHELL_ACTION_SECONDS, Math.fround(1));
  assert.equal(CLASSIC_RESULT_TOTAL_COINS_ACTION_SECONDS, Math.fround(1.75));
  assert.equal(CLASSIC_RESULT_Z_ORDER, 1);
  assert.deepEqual(CLASSIC_RESULT_PURPLE, { b: 145, g: 45, r: 102 });
  assert.deepEqual(CLASSIC_RESULT_WHITE, { b: 255, g: 255, r: 255 });
  assert.equal(formatClassicResultScore(0), 'Score: 0');
  assert.equal(formatClassicResultScore(123), 'Score: 123');
  assert.equal(formatClassicResultScore(-10), 'Score: -10');
  assert.throws(() => formatClassicResultScore(0.5), /safe integer/);
  assert.throws(() => formatClassicResultScore(Number.NaN), /safe integer/);

  const dimensions = CLASSIC_RESULT_RASTER_DIMENSIONS['480x800'];
  const layout = createClassicResultLayout(COMPACT_VISIBLE_RECT, dimensions);
  assert.equal(Object.isFrozen(layout), true);
  assert.equal(Object.isFrozen(layout.panelLabels), true);
  assert.equal(Object.isFrozen(layout.panelLabels[0]), true);
  assert.equal(Object.isFrozen(layout.scorePanel.initial), true);
  assert.equal(Object.isFrozen(dimensions), true);
  assert.equal(Object.isFrozen(dimensions.scorePanel), true);

  assert.throws(
    () => createClassicResultLayout({ ...COMPACT_VISIBLE_RECT, width: 0 }, dimensions),
    /viewport.width/,
  );
  assert.throws(
    () => createClassicResultLayout({ ...COMPACT_VISIBLE_RECT, height: Number.NaN }, dimensions),
    /viewport.height/,
  );
  assert.throws(
    () => createClassicResultLayout({ ...COMPACT_VISIBLE_RECT, width: Number.MAX_VALUE }, dimensions),
    /viewport.width/,
  );
  assert.throws(
    () => createClassicResultLayout({ ...COMPACT_VISIBLE_RECT, x: Number.NaN }, dimensions),
    /viewport.x/,
  );
  assert.throws(
    () => createClassicResultLayout({ ...COMPACT_VISIBLE_RECT, y: Number.MIN_VALUE }, dimensions),
    /viewport.y/,
  );
  assert.throws(
    () => createClassicResultLayout(
      COMPACT_VISIBLE_RECT,
      { ...dimensions, resultHeader: { width: 552, height: 0 } },
    ),
    /dimensions.resultHeader.height/,
  );
  assert.throws(
    () => createClassicResultLayout(
      COMPACT_VISIBLE_RECT,
      { ...dimensions, totalCoinsPanel: null as never },
    ),
    /dimensions.totalCoinsPanel/,
  );
  assert.throws(
    () => createClassicResultLayout(
      COMPACT_VISIBLE_RECT,
      { ...dimensions, scorePanel: { width: Number.MAX_VALUE, height: 407 } },
    ),
    /dimensions.scorePanel.width/,
  );
  assert.throws(
    () => createClassicResultLayout(
      { ...COMPACT_VISIBLE_RECT, x: Math.fround(3e38), width: Math.fround(3e38) },
      dimensions,
    ),
    /layout arithmetic/,
  );
  assert.throws(
    () => createClassicResultLayout(
      COMPACT_VISIBLE_RECT,
      { ...dimensions, scorePanel: { width: Number.MIN_VALUE, height: 407 } },
    ),
    /dimensions.scorePanel.width/,
  );
});
