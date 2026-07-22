export const CLASSIC_RESULT_REWARD_CALLBACK_SECONDS = Math.fround(1.75);
export const CLASSIC_RESULT_REWARD_ROTATION_SECONDS = Math.fround(2.5);
export const CLASSIC_RESULT_REWARD_ROTATION_DEGREES = Math.fround(360);
export const CLASSIC_RESULT_REWARD_FONT_CANONICAL_PATH = 'Fonts/SlabThing.ttf';
export const CLASSIC_RESULT_REWARD_EFFECT_CANONICAL_PATH
  = 'Interfaces/object-bonus-coins-effect.png';
export const CLASSIC_RESULT_REWARD_COIN_CANONICAL_PATH = 'Interfaces/object-coin.png';
export const CLASSIC_RESULT_REWARD_BADGE_CANONICAL_PATH
  = 'Interfaces/object-bonus-coins.png';
export const CLASSIC_RESULT_REWARD_Z_ORDER = 1;

const LEGACY_REFERENCE_WIDTH = Math.fround(480);
const CENTER_FACTOR = Math.fround(0.5);
const REWARD_X_FACTOR = Math.fround(0.675);
const REWARD_Y_FACTOR = Math.fround(0.2);
const BADGE_POSITION_DIVISOR = Math.fround(1.25);
const BONUS_LABEL_BASE_POINT_SIZE = Math.fround(34);

export interface ClassicResultRewardPoint {
  readonly x: number;
  readonly y: number;
}

export interface ClassicResultRewardViewport {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface ClassicResultRewardRasterSize {
  readonly height: number;
  readonly width: number;
}

export interface ClassicResultRewardRasterDimensions {
  readonly badge: ClassicResultRewardRasterSize;
  readonly coin: ClassicResultRewardRasterSize;
  readonly effect: ClassicResultRewardRasterSize;
}

export interface ClassicResultRewardInferredSpriteDefaults {
  /** No setters were recovered; these values make the legacy sprite defaults explicit. */
  readonly source: 'inferred-legacy-sprite-defaults';
  readonly anchor: ClassicResultRewardPoint;
  readonly opacity: 255;
  readonly rotationDegrees: 0;
  readonly scale: 1;
}

export interface ClassicResultRewardRotationPlan {
  readonly type: 'repeat-forever';
  readonly action: Readonly<{
    readonly type: 'rotate-by';
    readonly degrees: number;
    readonly seconds: number;
  }>;
}

export interface ClassicResultRewardEffectNode {
  readonly canonicalPath: typeof CLASSIC_RESULT_REWARD_EFFECT_CANONICAL_PATH;
  readonly inferredDefaults: ClassicResultRewardInferredSpriteDefaults;
  readonly kind: 'sprite';
  readonly nodeId: 'object-bonus-coins-effect';
  readonly rasterDimensions: ClassicResultRewardRasterSize;
  readonly rotation: ClassicResultRewardRotationPlan;
  readonly worldPosition: ClassicResultRewardPoint;
  readonly zOrder: 1;
}

export interface ClassicResultRewardBadgeNode {
  readonly canonicalPath: typeof CLASSIC_RESULT_REWARD_BADGE_CANONICAL_PATH;
  /** Target position after converting the coin's center anchor to Creator-local coordinates. */
  readonly creatorLocalPosition: ClassicResultRewardPoint;
  readonly inferredDefaults: ClassicResultRewardInferredSpriteDefaults;
  readonly kind: 'sprite';
  /** Raw lower-left content coordinate recovered from the native setter. */
  readonly legacyContentPosition: ClassicResultRewardPoint;
  readonly nodeId: 'object-bonus-coins';
  readonly rasterDimensions: ClassicResultRewardRasterSize;
  readonly zOrder: 1;
}

export interface ClassicResultRewardBonusLabelNode {
  readonly anchor: ClassicResultRewardPoint;
  /** Target position after converting the coin's center anchor to Creator-local coordinates. */
  readonly creatorLocalPosition: ClassicResultRewardPoint;
  readonly fontCanonicalPath: typeof CLASSIC_RESULT_REWARD_FONT_CANONICAL_PATH;
  readonly fontSize: number;
  readonly kind: 'label';
  /** Raw lower-left content coordinate recovered from the native setter. */
  readonly legacyContentPosition: ClassicResultRewardPoint;
  readonly nodeId: 'bonus-coins-label';
  readonly text: string;
  readonly valueFormat: '%d';
  readonly zOrder: 1;
}

export interface ClassicResultRewardCoinNode {
  readonly canonicalPath: typeof CLASSIC_RESULT_REWARD_COIN_CANONICAL_PATH;
  /** Recovered equal-z child insertion order: badge, then decimal bonus label. */
  readonly children: readonly [
    ClassicResultRewardBadgeNode,
    ClassicResultRewardBonusLabelNode,
  ];
  readonly inferredDefaults: ClassicResultRewardInferredSpriteDefaults;
  readonly kind: 'sprite';
  readonly nodeId: 'object-coin';
  readonly rasterDimensions: ClassicResultRewardRasterSize;
  readonly worldPosition: ClassicResultRewardPoint;
  readonly zOrder: 1;
}

export interface ClassicResultRewardTree {
  /** The existing total-coins entrance invokes this creation boundary after 1.75 seconds. */
  readonly callbackAfterSeconds: number;
  /** Recovered equal-z insertion order: rotating effect, then the coin subtree. */
  readonly rootChildren: readonly [
    ClassicResultRewardEffectNode,
    ClassicResultRewardCoinNode,
  ];
}

/**
 * Legacy CCSprite defaults inferred where the callback contains no corresponding setters.
 * Keeping the inference named prevents these deterministic Creator inputs being mistaken for
 * recovered anchor, opacity, scale, or initial-rotation calls.
 */
export const CLASSIC_RESULT_REWARD_INFERRED_SPRITE_DEFAULTS:
  ClassicResultRewardInferredSpriteDefaults = Object.freeze({
  anchor: point(CENTER_FACTOR, CENTER_FACTOR),
  opacity: 255,
  rotationDegrees: 0,
  scale: 1,
  source: 'inferred-legacy-sprite-defaults',
});

/** Exact RepeatForever(RotateBy(2.5, +360)) semantics recovered for the effect sprite. */
export const CLASSIC_RESULT_REWARD_ROTATION_PLAN: ClassicResultRewardRotationPlan
  = Object.freeze({
    action: Object.freeze({
      degrees: CLASSIC_RESULT_REWARD_ROTATION_DEGREES,
      seconds: CLASSIC_RESULT_REWARD_ROTATION_SECONDS,
      type: 'rotate-by',
    }),
    type: 'repeat-forever',
  });

/** Exact raster geometry for the three callback-created sprites in each recovered asset tree. */
export const CLASSIC_RESULT_REWARD_RASTER_DIMENSIONS: Readonly<
  Record<'480x800' | '720x1280', ClassicResultRewardRasterDimensions>
> = Object.freeze({
  '480x800': rewardDimensions({
    badge: [130, 129],
    coin: [34, 34],
    effect: [229, 229],
  }),
  '720x1280': rewardDimensions({
    badge: [159, 157],
    coin: [50, 49],
    effect: [342, 342],
  }),
});

export function getClassicResultRewardRasterDimensions(
  assetTree: '480x800' | '720x1280',
): ClassicResultRewardRasterDimensions {
  if (assetTree !== '480x800' && assetTree !== '720x1280') {
    throw new RangeError('assetTree must be 480x800 or 720x1280');
  }
  return CLASSIC_RESULT_REWARD_RASTER_DIMENSIONS[assetTree];
}

/**
 * Builds only the reward subtree created by DisplayScoreLayer::TotalCoinsCallback.
 * The caller supplies the already calculated Classic bonus; ranking/bonus math stays outside
 * this presentation boundary. Native positions are direct W/H products, so a visible-rect
 * origin is validated but intentionally not added to either recovered world coordinate.
 */
export function createClassicResultRewardTree(
  viewport: ClassicResultRewardViewport,
  dimensions: ClassicResultRewardRasterDimensions,
  bonus: number,
): ClassicResultRewardTree {
  assertViewport(viewport);
  assertRewardDimensions(dimensions);
  const bonusText = formatClassicResultRewardBonus(bonus);

  const rewardWorldPosition = point(
    multiplyFloat32(viewport.width, REWARD_X_FACTOR),
    multiplyFloat32(viewport.height, REWARD_Y_FACTOR),
  );
  const badgeLegacyPosition = point(
    divideFloat32(dimensions.badge.width, BADGE_POSITION_DIVISOR),
    divideFloat32(dimensions.badge.height, BADGE_POSITION_DIVISOR),
  );
  const labelLegacyPosition = point(badgeLegacyPosition.x, 0);
  const widthScale = divideFloat32(viewport.width, LEGACY_REFERENCE_WIDTH);

  const effect: ClassicResultRewardEffectNode = Object.freeze({
    canonicalPath: CLASSIC_RESULT_REWARD_EFFECT_CANONICAL_PATH,
    inferredDefaults: CLASSIC_RESULT_REWARD_INFERRED_SPRITE_DEFAULTS,
    kind: 'sprite',
    nodeId: 'object-bonus-coins-effect',
    rasterDimensions: rasterSize(dimensions.effect.width, dimensions.effect.height),
    rotation: CLASSIC_RESULT_REWARD_ROTATION_PLAN,
    worldPosition: rewardWorldPosition,
    zOrder: CLASSIC_RESULT_REWARD_Z_ORDER,
  });
  const badge: ClassicResultRewardBadgeNode = Object.freeze({
    canonicalPath: CLASSIC_RESULT_REWARD_BADGE_CANONICAL_PATH,
    creatorLocalPosition: contentToCreatorLocal(badgeLegacyPosition, dimensions.coin),
    inferredDefaults: CLASSIC_RESULT_REWARD_INFERRED_SPRITE_DEFAULTS,
    kind: 'sprite',
    legacyContentPosition: badgeLegacyPosition,
    nodeId: 'object-bonus-coins',
    rasterDimensions: rasterSize(dimensions.badge.width, dimensions.badge.height),
    zOrder: CLASSIC_RESULT_REWARD_Z_ORDER,
  });
  const label: ClassicResultRewardBonusLabelNode = Object.freeze({
    anchor: point(CENTER_FACTOR, Math.fround(-0.1)),
    creatorLocalPosition: contentToCreatorLocal(labelLegacyPosition, dimensions.coin),
    fontCanonicalPath: CLASSIC_RESULT_REWARD_FONT_CANONICAL_PATH,
    fontSize: multiplyFloat32(widthScale, BONUS_LABEL_BASE_POINT_SIZE),
    kind: 'label',
    legacyContentPosition: labelLegacyPosition,
    nodeId: 'bonus-coins-label',
    text: bonusText,
    valueFormat: '%d',
    zOrder: CLASSIC_RESULT_REWARD_Z_ORDER,
  });
  const coin: ClassicResultRewardCoinNode = Object.freeze({
    canonicalPath: CLASSIC_RESULT_REWARD_COIN_CANONICAL_PATH,
    children: Object.freeze([badge, label] as const),
    inferredDefaults: CLASSIC_RESULT_REWARD_INFERRED_SPRITE_DEFAULTS,
    kind: 'sprite',
    nodeId: 'object-coin',
    rasterDimensions: rasterSize(dimensions.coin.width, dimensions.coin.height),
    worldPosition: rewardWorldPosition,
    zOrder: CLASSIC_RESULT_REWARD_Z_ORDER,
  });

  return Object.freeze({
    callbackAfterSeconds: CLASSIC_RESULT_REWARD_CALLBACK_SECONDS,
    rootChildren: Object.freeze([effect, coin] as const),
  });
}

/** Formats only a validated, precomputed reward bonus; this function performs no bonus math. */
export function formatClassicResultRewardBonus(bonus: number): string {
  assertSignedInt32(bonus, 'bonus');
  return `${bonus}`;
}

function contentToCreatorLocal(
  legacyPosition: ClassicResultRewardPoint,
  parentDimensions: ClassicResultRewardRasterSize,
): ClassicResultRewardPoint {
  return point(
    subtractFloat32(
      legacyPosition.x,
      multiplyFloat32(parentDimensions.width, CENTER_FACTOR),
    ),
    subtractFloat32(
      legacyPosition.y,
      multiplyFloat32(parentDimensions.height, CENTER_FACTOR),
    ),
  );
}

function rewardDimensions(
  values: Readonly<Record<
    keyof ClassicResultRewardRasterDimensions,
    readonly [number, number]
  >>,
): ClassicResultRewardRasterDimensions {
  return Object.freeze({
    badge: rasterSize(...values.badge),
    coin: rasterSize(...values.coin),
    effect: rasterSize(...values.effect),
  });
}

function rasterSize(width: number, height: number): ClassicResultRewardRasterSize {
  return Object.freeze({ width: Math.fround(width), height: Math.fround(height) });
}

function assertViewport(viewport: ClassicResultRewardViewport): void {
  if (viewport === null || typeof viewport !== 'object') {
    throw new TypeError('viewport must be an object');
  }
  assertFiniteFloat32(viewport.x, 'viewport.x');
  assertFiniteFloat32(viewport.y, 'viewport.y');
  assertPositiveFiniteFloat32(viewport.width, 'viewport.width');
  assertPositiveFiniteFloat32(viewport.height, 'viewport.height');
}

function assertRewardDimensions(dimensions: ClassicResultRewardRasterDimensions): void {
  if (dimensions === null || typeof dimensions !== 'object') {
    throw new TypeError('dimensions must be an object');
  }
  for (const name of ['badge', 'coin', 'effect'] as const) {
    const size = dimensions[name];
    if (size === null || typeof size !== 'object') {
      throw new TypeError(`dimensions.${name} must be an object`);
    }
    assertPositiveFiniteFloat32(size.width, `dimensions.${name}.width`);
    assertPositiveFiniteFloat32(size.height, `dimensions.${name}.height`);
  }
}

function assertPositiveFiniteFloat32(value: number, label: string): void {
  const float32Value = Math.fround(value);
  if (
    !Number.isFinite(value)
    || value <= 0
    || !Number.isFinite(float32Value)
    || float32Value <= 0
  ) {
    throw new RangeError(`${label} must be positive and finite in float32`);
  }
}

function assertFiniteFloat32(value: number, label: string): void {
  const float32Value = Math.fround(value);
  if (
    !Number.isFinite(value)
    || !Number.isFinite(float32Value)
    || (value !== 0 && float32Value === 0)
  ) {
    throw new RangeError(`${label} must be finite and representable in float32`);
  }
}

function assertSignedInt32(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < -0x8000_0000 || value > 0x7fff_ffff) {
    throw new RangeError(`${label} must be a signed 32-bit integer`);
  }
}

function multiplyFloat32(left: number, right: number): number {
  return finiteFloat32Result(Math.fround(left) * Math.fround(right));
}

function divideFloat32(dividend: number, divisor: number): number {
  return finiteFloat32Result(Math.fround(dividend) / Math.fround(divisor));
}

function subtractFloat32(left: number, right: number): number {
  return finiteFloat32Result(Math.fround(left) - Math.fround(right));
}

function finiteFloat32Result(value: number): number {
  const result = Math.fround(value);
  if (!Number.isFinite(result)) {
    throw new RangeError('layout arithmetic must remain finite in float32');
  }
  return result;
}

function point(x: number, y: number): ClassicResultRewardPoint {
  return Object.freeze({ x: Math.fround(x), y: Math.fround(y) });
}
