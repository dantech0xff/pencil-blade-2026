import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLASSIC_RESULT_REWARD_BADGE_CANONICAL_PATH,
  CLASSIC_RESULT_REWARD_CALLBACK_SECONDS,
  CLASSIC_RESULT_REWARD_COIN_CANONICAL_PATH,
  CLASSIC_RESULT_REWARD_EFFECT_CANONICAL_PATH,
  CLASSIC_RESULT_REWARD_FONT_CANONICAL_PATH,
  CLASSIC_RESULT_REWARD_INFERRED_SPRITE_DEFAULTS,
  CLASSIC_RESULT_REWARD_RASTER_DIMENSIONS,
  CLASSIC_RESULT_REWARD_ROTATION_DEGREES,
  CLASSIC_RESULT_REWARD_ROTATION_PLAN,
  CLASSIC_RESULT_REWARD_ROTATION_SECONDS,
  CLASSIC_RESULT_REWARD_Z_ORDER,
  createClassicResultRewardTree,
  formatClassicResultRewardBonus,
  getClassicResultRewardRasterDimensions,
} from '../../../game/assets/scripts/domain/classic-result-reward-presentation.ts';

const COMPACT_VIEWPORT = Object.freeze({ x: 0, y: 0, width: 480, height: 800 });
const HIGH_VIEWPORT = Object.freeze({ x: 0, y: 0, width: 720, height: 1280 });

test('reward raster inputs preserve exact compact and high-tree geometry', () => {
  assert.deepEqual(CLASSIC_RESULT_REWARD_RASTER_DIMENSIONS, {
    '480x800': {
      badge: { width: 130, height: 129 },
      coin: { width: 34, height: 34 },
      effect: { width: 229, height: 229 },
    },
    '720x1280': {
      badge: { width: 159, height: 157 },
      coin: { width: 50, height: 49 },
      effect: { width: 342, height: 342 },
    },
  });
  assert.equal(
    getClassicResultRewardRasterDimensions('480x800'),
    CLASSIC_RESULT_REWARD_RASTER_DIMENSIONS['480x800'],
  );
  assert.equal(
    getClassicResultRewardRasterDimensions('720x1280'),
    CLASSIC_RESULT_REWARD_RASTER_DIMENSIONS['720x1280'],
  );
  assert.equal(Object.isFrozen(CLASSIC_RESULT_REWARD_RASTER_DIMENSIONS), true);
  assert.equal(Object.isFrozen(CLASSIC_RESULT_REWARD_RASTER_DIMENSIONS['480x800']), true);
  assert.equal(Object.isFrozen(CLASSIC_RESULT_REWARD_RASTER_DIMENSIONS['480x800'].badge), true);
  assert.throws(
    () => getClassicResultRewardRasterDimensions('1080x1920' as never),
    /assetTree/,
  );
});

test('compact callback creates effect then coin with badge then decimal label', () => {
  const tree = createClassicResultRewardTree(
    COMPACT_VIEWPORT,
    CLASSIC_RESULT_REWARD_RASTER_DIMENSIONS['480x800'],
    3,
  );
  const [effect, coin] = tree.rootChildren;
  const [badge, label] = coin.children;

  assert.equal(tree.callbackAfterSeconds, Math.fround(1.75));
  assert.deepEqual(tree.rootChildren.map((node) => node.nodeId), [
    'object-bonus-coins-effect',
    'object-coin',
  ]);
  assert.deepEqual(coin.children.map((node) => node.nodeId), [
    'object-bonus-coins',
    'bonus-coins-label',
  ]);
  assert.deepEqual(effect, {
    canonicalPath: 'Interfaces/object-bonus-coins-effect.png',
    inferredDefaults: CLASSIC_RESULT_REWARD_INFERRED_SPRITE_DEFAULTS,
    kind: 'sprite',
    nodeId: 'object-bonus-coins-effect',
    rasterDimensions: { width: 229, height: 229 },
    rotation: CLASSIC_RESULT_REWARD_ROTATION_PLAN,
    worldPosition: { x: 324, y: 160 },
    zOrder: 1,
  });
  assert.deepEqual(coin.worldPosition, { x: 324, y: 160 });
  assert.deepEqual(coin.rasterDimensions, { width: 34, height: 34 });
  assert.equal(coin.canonicalPath, 'Interfaces/object-coin.png');
  assert.equal(coin.inferredDefaults, CLASSIC_RESULT_REWARD_INFERRED_SPRITE_DEFAULTS);
  assert.deepEqual(badge, {
    canonicalPath: 'Interfaces/object-bonus-coins.png',
    creatorLocalPosition: { x: 87, y: Math.fround(86.19999694824219) },
    inferredDefaults: CLASSIC_RESULT_REWARD_INFERRED_SPRITE_DEFAULTS,
    kind: 'sprite',
    legacyContentPosition: { x: 104, y: Math.fround(103.19999694824219) },
    nodeId: 'object-bonus-coins',
    rasterDimensions: { width: 130, height: 129 },
    zOrder: 1,
  });
  assert.deepEqual(label, {
    anchor: { x: 0.5, y: Math.fround(-0.1) },
    creatorLocalPosition: { x: 87, y: -17 },
    fontCanonicalPath: 'Fonts/SlabThing.ttf',
    fontSize: 34,
    kind: 'label',
    legacyContentPosition: { x: 104, y: 0 },
    nodeId: 'bonus-coins-label',
    text: '3',
    valueFormat: '%d',
    zOrder: 1,
  });
});

test('high callback keeps exact raster inputs and float32 child/font arithmetic', () => {
  const tree = createClassicResultRewardTree(
    HIGH_VIEWPORT,
    CLASSIC_RESULT_REWARD_RASTER_DIMENSIONS['720x1280'],
    -3,
  );
  const [effect, coin] = tree.rootChildren;
  const [badge, label] = coin.children;

  assert.deepEqual(effect.rasterDimensions, { width: 342, height: 342 });
  assert.deepEqual(effect.worldPosition, { x: 486, y: 256 });
  assert.deepEqual(coin.rasterDimensions, { width: 50, height: 49 });
  assert.deepEqual(coin.worldPosition, { x: 486, y: 256 });
  assert.deepEqual(badge.rasterDimensions, { width: 159, height: 157 });
  assert.deepEqual(badge.legacyContentPosition, {
    x: Math.fround(127.19999694824219),
    y: Math.fround(125.5999984741211),
  });
  assert.deepEqual(badge.creatorLocalPosition, {
    x: Math.fround(102.19999694824219),
    y: Math.fround(101.0999984741211),
  });
  assert.deepEqual(label.creatorLocalPosition, {
    x: Math.fround(102.19999694824219),
    y: -24.5,
  });
  assert.equal(label.fontSize, 51);
  assert.equal(label.text, '-3');
});

test('reward world formulas intentionally do not add a non-zero visible origin', () => {
  const tree = createClassicResultRewardTree(
    { x: -20, y: 30, width: 520, height: 800 },
    CLASSIC_RESULT_REWARD_RASTER_DIMENSIONS['480x800'],
    0,
  );
  const [effect, coin] = tree.rootChildren;
  const [, label] = coin.children;

  assert.deepEqual(effect.worldPosition, { x: 351, y: 160 });
  assert.deepEqual(coin.worldPosition, { x: 351, y: 160 });
  assert.equal(label.fontSize, Math.fround(36.833335876464844));
});

test('rotation and inferred defaults preserve only recovered/default semantics', () => {
  assert.equal(CLASSIC_RESULT_REWARD_CALLBACK_SECONDS, Math.fround(1.75));
  assert.equal(CLASSIC_RESULT_REWARD_ROTATION_SECONDS, Math.fround(2.5));
  assert.equal(CLASSIC_RESULT_REWARD_ROTATION_DEGREES, Math.fround(360));
  assert.equal(CLASSIC_RESULT_REWARD_Z_ORDER, 1);
  assert.deepEqual(CLASSIC_RESULT_REWARD_ROTATION_PLAN, {
    action: {
      degrees: Math.fround(360),
      seconds: Math.fround(2.5),
      type: 'rotate-by',
    },
    type: 'repeat-forever',
  });
  assert.deepEqual(CLASSIC_RESULT_REWARD_INFERRED_SPRITE_DEFAULTS, {
    anchor: { x: 0.5, y: 0.5 },
    opacity: 255,
    rotationDegrees: 0,
    scale: 1,
    source: 'inferred-legacy-sprite-defaults',
  });
  assert.equal(Object.isFrozen(CLASSIC_RESULT_REWARD_ROTATION_PLAN), true);
  assert.equal(Object.isFrozen(CLASSIC_RESULT_REWARD_ROTATION_PLAN.action), true);
  assert.equal(Object.isFrozen(CLASSIC_RESULT_REWARD_INFERRED_SPRITE_DEFAULTS), true);
  assert.equal(Object.isFrozen(CLASSIC_RESULT_REWARD_INFERRED_SPRITE_DEFAULTS.anchor), true);

  const tree = createClassicResultRewardTree(
    COMPACT_VIEWPORT,
    CLASSIC_RESULT_REWARD_RASTER_DIMENSIONS['480x800'],
    1,
  );
  const serialized = JSON.stringify(tree);
  for (const unsupported of ['audio', 'random', 'fade', 'move', 'expiry', 'removal']) {
    assert.equal(serialized.includes(unsupported), false);
  }
});

test('reward paths, label formatting, and deep immutability are explicit', () => {
  assert.equal(
    CLASSIC_RESULT_REWARD_EFFECT_CANONICAL_PATH,
    'Interfaces/object-bonus-coins-effect.png',
  );
  assert.equal(CLASSIC_RESULT_REWARD_COIN_CANONICAL_PATH, 'Interfaces/object-coin.png');
  assert.equal(
    CLASSIC_RESULT_REWARD_BADGE_CANONICAL_PATH,
    'Interfaces/object-bonus-coins.png',
  );
  assert.equal(CLASSIC_RESULT_REWARD_FONT_CANONICAL_PATH, 'Fonts/SlabThing.ttf');
  assert.equal(formatClassicResultRewardBonus(0), '0');
  assert.equal(formatClassicResultRewardBonus(0x7fff_ffff), '2147483647');
  assert.equal(formatClassicResultRewardBonus(-0x8000_0000), '-2147483648');

  const mutableDimensions = {
    badge: { width: 130, height: 129 },
    coin: { width: 34, height: 34 },
    effect: { width: 229, height: 229 },
  };
  const tree = createClassicResultRewardTree(COMPACT_VIEWPORT, mutableDimensions, 3);
  mutableDimensions.badge.width = 999;

  assert.equal(tree.rootChildren[1].children[0].rasterDimensions.width, 130);
  assert.equal(Object.isFrozen(tree), true);
  assert.equal(Object.isFrozen(tree.rootChildren), true);
  assert.equal(Object.isFrozen(tree.rootChildren[0]), true);
  assert.equal(Object.isFrozen(tree.rootChildren[0].rasterDimensions), true);
  assert.equal(Object.isFrozen(tree.rootChildren[1].children), true);
  assert.equal(Object.isFrozen(tree.rootChildren[1].children[0]), true);
  assert.equal(Object.isFrozen(tree.rootChildren[1].children[1]), true);
});

test('reward tree fails closed on malformed viewport, geometry, and bonus inputs', () => {
  const dimensions = CLASSIC_RESULT_REWARD_RASTER_DIMENSIONS['480x800'];

  assert.throws(
    () => createClassicResultRewardTree(null as never, dimensions, 0),
    /viewport/,
  );
  assert.throws(
    () => createClassicResultRewardTree({ ...COMPACT_VIEWPORT, width: 0 }, dimensions, 0),
    /viewport.width/,
  );
  assert.throws(
    () => createClassicResultRewardTree(
      { ...COMPACT_VIEWPORT, height: Number.MAX_VALUE },
      dimensions,
      0,
    ),
    /viewport.height/,
  );
  assert.throws(
    () => createClassicResultRewardTree(
      { ...COMPACT_VIEWPORT, x: Number.MIN_VALUE },
      dimensions,
      0,
    ),
    /viewport.x/,
  );
  assert.throws(
    () => createClassicResultRewardTree(
      { ...COMPACT_VIEWPORT, y: Number.NaN },
      dimensions,
      0,
    ),
    /viewport.y/,
  );
  assert.throws(
    () => createClassicResultRewardTree(COMPACT_VIEWPORT, null as never, 0),
    /dimensions/,
  );
  assert.throws(
    () => createClassicResultRewardTree(
      COMPACT_VIEWPORT,
      { ...dimensions, badge: null as never },
      0,
    ),
    /dimensions.badge/,
  );
  assert.throws(
    () => createClassicResultRewardTree(
      COMPACT_VIEWPORT,
      { ...dimensions, coin: { width: 0, height: 34 } },
      0,
    ),
    /dimensions.coin.width/,
  );
  assert.throws(
    () => createClassicResultRewardTree(
      COMPACT_VIEWPORT,
      { ...dimensions, effect: { width: 229, height: Number.MAX_VALUE } },
      0,
    ),
    /dimensions.effect.height/,
  );
  assert.throws(
    () => createClassicResultRewardTree(COMPACT_VIEWPORT, dimensions, 0.5),
    /signed 32-bit integer/,
  );
  assert.throws(
    () => createClassicResultRewardTree(COMPACT_VIEWPORT, dimensions, Number.NaN),
    /signed 32-bit integer/,
  );
  assert.throws(
    () => createClassicResultRewardTree(COMPACT_VIEWPORT, dimensions, 0x8000_0000),
    /signed 32-bit integer/,
  );
  assert.throws(
    () => formatClassicResultRewardBonus(-0x8000_0001),
    /signed 32-bit integer/,
  );
});
