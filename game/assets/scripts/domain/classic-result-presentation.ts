export const CLASSIC_RESULT_AGENCY_FONT_CANONICAL_PATH = 'Fonts/AgencyB.ttf';
export const CLASSIC_RESULT_COINS_FONT_CANONICAL_PATH = 'Fonts/SlabThing.ttf';
export const CLASSIC_RESULT_PANEL_FADE_SECONDS = Math.fround(0.75);
export const CLASSIC_RESULT_SHELL_ACTION_SECONDS = Math.fround(1);
export const CLASSIC_RESULT_TOTAL_COINS_ACTION_SECONDS = Math.fround(1.75);
export const CLASSIC_RESULT_Z_ORDER = 1;
export const CLASSIC_RESULT_PURPLE = Object.freeze({
  b: 145 as const,
  g: 45 as const,
  r: 102 as const,
});
export const CLASSIC_RESULT_WHITE = Object.freeze({
  b: 255 as const,
  g: 255 as const,
  r: 255 as const,
});

const LEGACY_REFERENCE_WIDTH = Math.fround(480);
const CENTER_FACTOR = Math.fround(0.5);
const SCORE_PANEL_CENTER_Y_FACTOR = Math.fround(1.1);
const SCORE_LABEL_X_FACTOR = Math.fround(0.05);
const SCORE_LABEL_Y_FACTOR = Math.fround(0.8);
const HEADER_Y_FACTOR = Math.fround(0.925);
const BUTTON_Y_FACTOR = Math.fround(0.075);
const MEDAL_X_FACTOR = Math.fround(0.8);
const MEDAL_Y_FACTOR = Math.fround(0.75);
const TOTAL_COINS_Y_FACTOR = Math.fround(0.2);
const TOTAL_COINS_X_FACTOR = Math.fround(0.3);
const MAIN_SCORE_BASE_POINT_SIZE = Math.fround(62);
const PANEL_LABEL_BASE_POINT_SIZE = Math.fround(32);
const TOTAL_COINS_BASE_POINT_SIZE = Math.fround(34);

const PANEL_LABEL_FACTORS = Object.freeze([
  Object.freeze({ x: Math.fround(0.55), y: Math.fround(0.55) }),
  Object.freeze({ x: Math.fround(0.225), y: Math.fround(0.3375) }),
  Object.freeze({ x: Math.fround(0.875), y: Math.fround(0.1875) }),
] as const);

export interface ClassicResultViewport {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface ClassicResultPoint {
  readonly x: number;
  readonly y: number;
}

export interface ClassicResultRgb {
  readonly b: number;
  readonly g: number;
  readonly r: number;
}

export interface ClassicResultRasterSize {
  readonly height: number;
  readonly width: number;
}

export interface ClassicResultRasterDimensions {
  readonly medalNone: ClassicResultRasterSize;
  readonly menuButton: ClassicResultRasterSize;
  readonly resultHeader: ClassicResultRasterSize;
  readonly retryButton: ClassicResultRasterSize;
  readonly scorePanel: ClassicResultRasterSize;
  readonly totalCoinsPanel: ClassicResultRasterSize;
}

export interface ClassicResultTransformState {
  readonly opacity: 0 | 255;
  readonly scale: number;
  readonly worldPosition: ClassicResultPoint;
}

export interface ClassicResultAnimatedNodeLayout {
  readonly actionSeconds: number;
  readonly anchor: ClassicResultPoint;
  readonly final: ClassicResultTransformState;
  readonly initial: ClassicResultTransformState;
  readonly zOrder: 1;
}

export interface ClassicResultLabelLayout {
  readonly anchor: ClassicResultPoint;
  readonly color: ClassicResultRgb;
  readonly fontCanonicalPath: string;
  readonly fontSize: number;
  readonly zOrder: 1;
}

export interface ClassicResultChildLabelLayout extends ClassicResultLabelLayout {
  /** Raw lower-left content coordinate recovered from the native setter. */
  readonly legacyContentPosition: ClassicResultPoint;
  /** Target position after converting the parent's center anchor to Creator-local coordinates. */
  readonly creatorLocalPosition: ClassicResultPoint;
}

export interface ClassicResultLayout {
  readonly mainScoreLabel: ClassicResultLabelLayout & Readonly<{
    readonly valueFormat: 'Score: %d';
    readonly worldPosition: ClassicResultPoint;
  }>;
  readonly medalNone: ClassicResultAnimatedNodeLayout;
  readonly menuButton: ClassicResultAnimatedNodeLayout;
  /** Anonymous slots: their meanings and values are supplied by the selected mode. */
  readonly panelLabels: readonly [
    ClassicResultChildLabelLayout,
    ClassicResultChildLabelLayout,
    ClassicResultChildLabelLayout,
  ];
  readonly resultHeader: ClassicResultAnimatedNodeLayout;
  readonly retryButton: ClassicResultAnimatedNodeLayout;
  readonly scorePanel: ClassicResultAnimatedNodeLayout;
  readonly totalCoinsLabel: Omit<ClassicResultChildLabelLayout, 'color'>;
  readonly totalCoinsPanel: ClassicResultAnimatedNodeLayout & Readonly<{
    readonly invokesCompletionCallback: true;
  }>;
}

/** Exact raster geometry reached by the recovered Classic result shell. */
export const CLASSIC_RESULT_RASTER_DIMENSIONS: Readonly<
  Record<'480x800' | '720x1280', ClassicResultRasterDimensions>
> = Object.freeze({
  '480x800': resultDimensions({
    medalNone: [104, 209],
    menuButton: [134, 129],
    resultHeader: [552, 118],
    retryButton: [111, 105],
    scorePanel: [442, 407],
    totalCoinsPanel: [334, 131],
  }),
  '720x1280': resultDimensions({
    medalNone: [154, 314],
    menuButton: [201, 194],
    resultHeader: [792, 159],
    retryButton: [167, 158],
    scorePanel: [662, 610],
    totalCoinsPanel: [464, 160],
  }),
});

export function getClassicResultRasterDimensions(
  assetTree: '480x800' | '720x1280',
): ClassicResultRasterDimensions {
  if (assetTree !== '480x800' && assetTree !== '720x1280') {
    throw new RangeError('assetTree must be 480x800 or 720x1280');
  }
  return CLASSIC_RESULT_RASTER_DIMENSIONS[assetTree];
}

/** Recovered result-shell geometry translated to immutable Creator presentation inputs. */
export function createClassicResultLayout(
  viewport: ClassicResultViewport,
  dimensions: ClassicResultRasterDimensions,
): ClassicResultLayout {
  assertViewport(viewport);
  assertResultDimensions(dimensions);

  const leftX = Math.fround(viewport.x);
  const bottomY = Math.fround(viewport.y);
  const rightX = addFloat32(leftX, viewport.width);
  const topY = addFloat32(bottomY, viewport.height);
  const centerX = addFloat32(leftX, multiplyFloat32(viewport.width, CENTER_FACTOR));
  const centerY = addFloat32(bottomY, multiplyFloat32(viewport.height, CENTER_FACTOR));
  const widthScale = Math.fround(Math.fround(viewport.width) / LEGACY_REFERENCE_WIDTH);
  const scorePanelPosition = point(
    centerX,
    multiplyFloat32(centerY, SCORE_PANEL_CENTER_Y_FACTOR),
  );
  const buttonY = multiplyFloat32(viewport.height, BUTTON_Y_FACTOR);
  const totalCoinsY = addFloat32(
    bottomY,
    multiplyFloat32(viewport.height, TOTAL_COINS_Y_FACTOR),
  );

  return Object.freeze({
    mainScoreLabel: Object.freeze({
      anchor: point(0, CENTER_FACTOR),
      color: CLASSIC_RESULT_PURPLE,
      fontCanonicalPath: CLASSIC_RESULT_AGENCY_FONT_CANONICAL_PATH,
      fontSize: multiplyFloat32(widthScale, MAIN_SCORE_BASE_POINT_SIZE),
      valueFormat: 'Score: %d',
      worldPosition: point(
        multiplyFloat32(viewport.width, SCORE_LABEL_X_FACTOR),
        multiplyFloat32(viewport.height, SCORE_LABEL_Y_FACTOR),
      ),
      zOrder: CLASSIC_RESULT_Z_ORDER,
    }),
    medalNone: animatedNode(
      point(
        multiplyFloat32(viewport.width, MEDAL_X_FACTOR),
        multiplyFloat32(viewport.height, MEDAL_Y_FACTOR),
      ),
      point(
        multiplyFloat32(viewport.width, MEDAL_X_FACTOR),
        multiplyFloat32(viewport.height, MEDAL_Y_FACTOR),
      ),
      CLASSIC_RESULT_SHELL_ACTION_SECONDS,
      0,
      255,
      Math.fround(0.5),
      1,
    ),
    menuButton: animatedNode(
      point(
        addFloat32(rightX, multiplyFloat32(dimensions.menuButton.width, CENTER_FACTOR)),
        buttonY,
      ),
      point(
        subtractFloat32(rightX, multiplyFloat32(dimensions.menuButton.width, CENTER_FACTOR)),
        buttonY,
      ),
      CLASSIC_RESULT_SHELL_ACTION_SECONDS,
      0,
      255,
    ),
    panelLabels: createPanelLabels(widthScale, dimensions.scorePanel),
    resultHeader: animatedNode(
      point(
        centerX,
        addFloat32(
          topY,
          multiplyFloat32(dimensions.resultHeader.height, CENTER_FACTOR),
        ),
      ),
      point(centerX, multiplyFloat32(viewport.height, HEADER_Y_FACTOR)),
      CLASSIC_RESULT_SHELL_ACTION_SECONDS,
      0,
      255,
    ),
    retryButton: animatedNode(
      point(
        addFloat32(
          leftX,
          multiplyFloat32(dimensions.retryButton.width, Math.fround(-0.5)),
        ),
        buttonY,
      ),
      point(
        addFloat32(leftX, multiplyFloat32(dimensions.retryButton.width, CENTER_FACTOR)),
        buttonY,
      ),
      CLASSIC_RESULT_SHELL_ACTION_SECONDS,
      0,
      255,
    ),
    scorePanel: animatedNode(
      scorePanelPosition,
      scorePanelPosition,
      CLASSIC_RESULT_PANEL_FADE_SECONDS,
      0,
      255,
    ),
    totalCoinsLabel: createTotalCoinsLabel(widthScale, dimensions.totalCoinsPanel),
    totalCoinsPanel: Object.freeze({
      ...animatedNode(
        point(
          addFloat32(
            leftX,
            multiplyFloat32(dimensions.totalCoinsPanel.width, Math.fround(-0.5)),
          ),
          totalCoinsY,
        ),
        point(
          addFloat32(leftX, multiplyFloat32(viewport.width, TOTAL_COINS_X_FACTOR)),
          totalCoinsY,
        ),
        CLASSIC_RESULT_TOTAL_COINS_ACTION_SECONDS,
        0,
        255,
      ),
      invokesCompletionCallback: true,
    }),
  });
}

/** Formats the completed run score supplied by the recovered DisplayScore callback. */
export function formatClassicResultScore(value: number): string {
  assertSafeInteger(value, 'completed score');
  return `Score: ${value}`;
}

function createPanelLabels(
  widthScale: number,
  panelDimensions: ClassicResultRasterSize,
): ClassicResultLayout['panelLabels'] {
  return Object.freeze(PANEL_LABEL_FACTORS.map((factors) => childLabel(
    panelDimensions,
    factors,
    CLASSIC_RESULT_AGENCY_FONT_CANONICAL_PATH,
    multiplyFloat32(widthScale, PANEL_LABEL_BASE_POINT_SIZE),
    CLASSIC_RESULT_WHITE,
    point(CENTER_FACTOR, CENTER_FACTOR),
  ))) as ClassicResultLayout['panelLabels'];
}

function createTotalCoinsLabel(
  widthScale: number,
  panelDimensions: ClassicResultRasterSize,
): ClassicResultLayout['totalCoinsLabel'] {
  const legacyContentPosition = point(
    multiplyFloat32(panelDimensions.width, Math.fround(0.375)),
    multiplyFloat32(panelDimensions.height, CENTER_FACTOR),
  );
  return Object.freeze({
    anchor: point(0, Math.fround(0.45)),
    creatorLocalPosition: contentToCreatorLocal(legacyContentPosition, panelDimensions),
    fontCanonicalPath: CLASSIC_RESULT_COINS_FONT_CANONICAL_PATH,
    fontSize: multiplyFloat32(widthScale, TOTAL_COINS_BASE_POINT_SIZE),
    legacyContentPosition,
    zOrder: CLASSIC_RESULT_Z_ORDER,
  });
}

function childLabel(
  panelDimensions: ClassicResultRasterSize,
  factors: ClassicResultPoint,
  fontCanonicalPath: string,
  fontSize: number,
  color: ClassicResultRgb,
  anchor: ClassicResultPoint,
): ClassicResultChildLabelLayout {
  const legacyContentPosition = point(
    multiplyFloat32(panelDimensions.width, factors.x),
    multiplyFloat32(panelDimensions.height, factors.y),
  );
  return Object.freeze({
    anchor,
    color,
    creatorLocalPosition: contentToCreatorLocal(legacyContentPosition, panelDimensions),
    fontCanonicalPath,
    fontSize,
    legacyContentPosition,
    zOrder: CLASSIC_RESULT_Z_ORDER,
  });
}

function animatedNode(
  initialWorldPosition: ClassicResultPoint,
  finalWorldPosition: ClassicResultPoint,
  actionSeconds: number,
  initialOpacity: 0 | 255,
  finalOpacity: 0 | 255,
  initialScale = 1,
  finalScale = 1,
): ClassicResultAnimatedNodeLayout {
  return Object.freeze({
    actionSeconds,
    anchor: point(CENTER_FACTOR, CENTER_FACTOR),
    final: Object.freeze({
      opacity: finalOpacity,
      scale: Math.fround(finalScale),
      worldPosition: finalWorldPosition,
    }),
    initial: Object.freeze({
      opacity: initialOpacity,
      scale: Math.fround(initialScale),
      worldPosition: initialWorldPosition,
    }),
    zOrder: CLASSIC_RESULT_Z_ORDER,
  });
}

function contentToCreatorLocal(
  legacyPosition: ClassicResultPoint,
  parentDimensions: ClassicResultRasterSize,
): ClassicResultPoint {
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

function resultDimensions(
  values: Readonly<Record<keyof ClassicResultRasterDimensions, readonly [number, number]>>,
): ClassicResultRasterDimensions {
  return Object.freeze({
    medalNone: dimensions(values.medalNone),
    menuButton: dimensions(values.menuButton),
    resultHeader: dimensions(values.resultHeader),
    retryButton: dimensions(values.retryButton),
    scorePanel: dimensions(values.scorePanel),
    totalCoinsPanel: dimensions(values.totalCoinsPanel),
  });
}

function dimensions(value: readonly [number, number]): ClassicResultRasterSize {
  return Object.freeze({ width: value[0], height: value[1] });
}

function assertViewport(viewport: ClassicResultViewport): void {
  if (viewport === null || typeof viewport !== 'object') {
    throw new TypeError('viewport must be an object');
  }
  assertFiniteFloat32(viewport.x, 'viewport.x');
  assertFiniteFloat32(viewport.y, 'viewport.y');
  assertPositiveFinite(viewport.width, 'viewport.width');
  assertPositiveFinite(viewport.height, 'viewport.height');
}

function assertResultDimensions(dimensionsValue: ClassicResultRasterDimensions): void {
  if (dimensionsValue === null || typeof dimensionsValue !== 'object') {
    throw new TypeError('dimensions must be an object');
  }
  for (const name of [
    'medalNone',
    'menuButton',
    'resultHeader',
    'retryButton',
    'scorePanel',
    'totalCoinsPanel',
  ] as const) {
    assertDimensions(dimensionsValue[name], `dimensions.${name}`);
  }
}

function assertDimensions(value: ClassicResultRasterSize, label: string): void {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
  assertPositiveFinite(value.width, `${label}.width`);
  assertPositiveFinite(value.height, `${label}.height`);
}

function assertPositiveFinite(value: number, label: string): void {
  const float32Value = Math.fround(value);
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(float32Value) || float32Value <= 0) {
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

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}

function multiplyFloat32(left: number, right: number): number {
  return finiteFloat32Result(Math.fround(left) * Math.fround(right));
}

function addFloat32(left: number, right: number): number {
  return finiteFloat32Result(Math.fround(left) + Math.fround(right));
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

function point(x: number, y: number): ClassicResultPoint {
  return Object.freeze({ x: Math.fround(x), y: Math.fround(y) });
}
