import type { ClassicRasterDimensions } from './classic-resource-contract';

export const CLASSIC_SCORE_HUD_ENTRY_ACTION_SECONDS = Math.fround(1);
export const CLASSIC_DOUBLE_SCORE_PANEL_ACTION_SECONDS = Math.fround(1);
export const CLASSIC_SCORE_HUD_FONT_CANONICAL_PATH = 'Fonts/Linds.ttf';
export const CLASSIC_SCORE_HUD_Z_ORDER = 1;
export const CLASSIC_SCORE_ICON_PULSE_ACTION_SECONDS = Math.fround(0.025);
export const CLASSIC_SCORE_ICON_PULSE_SCALE = Math.fround(1.25);
export const CLASSIC_SCORE_HUD_BLACK = Object.freeze({ b: 0 as const, g: 0 as const, r: 0 as const });
export const CLASSIC_SCORE_HUD_NEW_BEST_GREEN = Object.freeze({
  b: 0 as const,
  g: 128 as const,
  r: 0 as const,
});

const LEGACY_REFERENCE_WIDTH = Math.fround(480);
const SCORE_ICON_X_FACTOR = float32FromBits(0x3da3_d70a);
const SCORE_ICON_Y_FACTOR = Math.fround(0.95);
const BEST_CUP_Y_FACTOR = Math.fround(0.875);
const DOUBLE_PANEL_Y_FACTOR = Math.fround(0.75);
const LIVE_LABEL_X_FACTOR = Math.fround(0.085);
const LIVE_LABEL_BASE_POINT_SIZE = Math.fround(32);
const PENDING_LABEL_BASE_POINT_SIZE = Math.fround(28);
const BEST_LABEL_BASE_POINT_SIZE = Math.fround(30);

export interface ClassicScoreHudViewport {
  readonly height: number;
  readonly width: number;
}

export interface ClassicScoreHudRasterDimensions {
  readonly bestScoreCup: ClassicRasterDimensions;
  readonly doubleScorePanel: ClassicRasterDimensions;
  readonly scoreIcon: ClassicRasterDimensions;
}

export interface ClassicScoreHudPoint {
  readonly x: number;
  readonly y: number;
}

export interface ClassicScoreHudSpriteLayout {
  readonly initialOpacity: 0 | 255;
  /** Native lower-left world coordinate; pass directly to Creator setWorldPosition. */
  readonly worldPosition: ClassicScoreHudPoint;
  readonly zOrder: 1;
}

export interface ClassicScoreHudLabelLayout {
  readonly anchor: ClassicScoreHudPoint;
  readonly color: ClassicScoreHudRgb;
  readonly fontCanonicalPath: typeof CLASSIC_SCORE_HUD_FONT_CANONICAL_PATH;
  readonly fontSize: number;
  readonly zOrder: 1;
}

export interface ClassicScoreHudRgb {
  readonly b: number;
  readonly g: number;
  readonly r: number;
}

export interface ClassicScoreHudChildLabelLayout extends ClassicScoreHudLabelLayout {
  /** Raw lower-left content coordinate recovered from the native setter. */
  readonly legacyContentPosition: ClassicScoreHudPoint;
  /** Target position after converting the legacy lower-left content origin to Creator's anchor origin. */
  readonly creatorLocalPosition: ClassicScoreHudPoint;
}

export interface ClassicScoreHudLayout {
  readonly bestScoreCup: ClassicScoreHudSpriteLayout;
  readonly bestScoreLabel: ClassicScoreHudChildLabelLayout & Readonly<{
    readonly valueFormat: ' %d';
  }>;
  readonly doubleScorePanel: Readonly<{
    readonly hiddenWorldPosition: ClassicScoreHudPoint;
    readonly moveActionSeconds: number;
    readonly shownWorldPosition: ClassicScoreHudPoint;
    readonly zOrder: 1;
  }>;
  readonly entryActionSeconds: number;
  readonly liveScoreLabel: ClassicScoreHudLabelLayout & Readonly<{
    readonly initialText: '0';
    readonly updateFormat: ' %d';
    /** Native lower-left world coordinate; pass directly to Creator setWorldPosition. */
    readonly worldPosition: ClassicScoreHudPoint;
  }>;
  readonly pendingDoubleLabel: ClassicScoreHudChildLabelLayout & Readonly<{
    readonly initialText: '0';
    readonly updateFormat: '%d';
  }>;
  readonly scoreIconPulse: Readonly<{
    readonly actionSecondsPerLeg: number;
    readonly apexScale: number;
    readonly restingScale: 1;
  }>;
  readonly scoreIcon: ClassicScoreHudSpriteLayout;
}

/** Recovered ScoreManager HUD geometry translated to Creator's world/child coordinate boundaries. */
export function createClassicScoreHudLayout(
  viewport: ClassicScoreHudViewport,
  dimensions: ClassicScoreHudRasterDimensions,
): ClassicScoreHudLayout {
  assertViewport(viewport);
  assertDimensions(dimensions.scoreIcon, 'dimensions.scoreIcon');
  assertDimensions(dimensions.bestScoreCup, 'dimensions.bestScoreCup');
  assertDimensions(dimensions.doubleScorePanel, 'dimensions.doubleScorePanel');

  const widthScale = Math.fround(Math.fround(viewport.width) / LEGACY_REFERENCE_WIDTH);
  const scoreIconX = multiplyFloat32(viewport.width, SCORE_ICON_X_FACTOR);
  const scoreIconY = multiplyFloat32(viewport.height, SCORE_ICON_Y_FACTOR);
  const bestCupY = multiplyFloat32(viewport.height, BEST_CUP_Y_FACTOR);
  const panelY = multiplyFloat32(viewport.height, DOUBLE_PANEL_Y_FACTOR);
  const liveLabelX = addFloat32(
    multiplyFloat32(viewport.width, LIVE_LABEL_X_FACTOR),
    multiplyFloat32(dimensions.scoreIcon.width, Math.fround(0.5)),
  );
  const pendingLegacyX = Math.fround(
    Math.fround(dimensions.doubleScorePanel.width) / Math.fround(3),
  );
  const pendingLegacyY = multiplyFloat32(
    dimensions.doubleScorePanel.height,
    Math.fround(0.5),
  );

  return Object.freeze({
    bestScoreCup: Object.freeze({
      initialOpacity: 0,
      worldPosition: point(scoreIconX, bestCupY),
      zOrder: CLASSIC_SCORE_HUD_Z_ORDER,
    }),
    bestScoreLabel: Object.freeze({
      anchor: point(0, Math.fround(-0.15)),
      color: CLASSIC_SCORE_HUD_BLACK,
      creatorLocalPosition: point(
        multiplyFloat32(dimensions.bestScoreCup.width, Math.fround(0.5)),
        multiplyFloat32(dimensions.bestScoreCup.height, Math.fround(-0.5)),
      ),
      fontCanonicalPath: CLASSIC_SCORE_HUD_FONT_CANONICAL_PATH,
      fontSize: multiplyFloat32(widthScale, BEST_LABEL_BASE_POINT_SIZE),
      legacyContentPosition: point(dimensions.bestScoreCup.width, 0),
      valueFormat: ' %d',
      zOrder: CLASSIC_SCORE_HUD_Z_ORDER,
    }),
    doubleScorePanel: Object.freeze({
      hiddenWorldPosition: point(
        multiplyFloat32(dimensions.doubleScorePanel.width, Math.fround(-0.5)),
        panelY,
      ),
      moveActionSeconds: CLASSIC_DOUBLE_SCORE_PANEL_ACTION_SECONDS,
      shownWorldPosition: point(
        multiplyFloat32(dimensions.doubleScorePanel.width, Math.fround(0.5)),
        panelY,
      ),
      zOrder: CLASSIC_SCORE_HUD_Z_ORDER,
    }),
    entryActionSeconds: CLASSIC_SCORE_HUD_ENTRY_ACTION_SECONDS,
    liveScoreLabel: Object.freeze({
      anchor: point(0, Math.fround(0.5)),
      color: CLASSIC_SCORE_HUD_BLACK,
      fontCanonicalPath: CLASSIC_SCORE_HUD_FONT_CANONICAL_PATH,
      fontSize: multiplyFloat32(widthScale, LIVE_LABEL_BASE_POINT_SIZE),
      initialText: '0',
      updateFormat: ' %d',
      worldPosition: point(liveLabelX, scoreIconY),
      zOrder: CLASSIC_SCORE_HUD_Z_ORDER,
    }),
    pendingDoubleLabel: Object.freeze({
      anchor: point(Math.fround(0.5), Math.fround(0.5)),
      creatorLocalPosition: point(
        subtractFloat32(
          pendingLegacyX,
          multiplyFloat32(dimensions.doubleScorePanel.width, Math.fround(0.5)),
        ),
        subtractFloat32(
          pendingLegacyY,
          multiplyFloat32(dimensions.doubleScorePanel.height, Math.fround(0.5)),
        ),
      ),
      color: CLASSIC_SCORE_HUD_BLACK,
      fontCanonicalPath: CLASSIC_SCORE_HUD_FONT_CANONICAL_PATH,
      fontSize: multiplyFloat32(widthScale, PENDING_LABEL_BASE_POINT_SIZE),
      initialText: '0',
      legacyContentPosition: point(pendingLegacyX, pendingLegacyY),
      updateFormat: '%d',
      zOrder: CLASSIC_SCORE_HUD_Z_ORDER,
    }),
    scoreIconPulse: Object.freeze({
      actionSecondsPerLeg: CLASSIC_SCORE_ICON_PULSE_ACTION_SECONDS,
      apexScale: CLASSIC_SCORE_ICON_PULSE_SCALE,
      restingScale: 1,
    }),
    scoreIcon: Object.freeze({
      initialOpacity: 0,
      worldPosition: point(scoreIconX, scoreIconY),
      zOrder: CLASSIC_SCORE_HUD_Z_ORDER,
    }),
  });
}

/** Native first render is the sole live-score string without a leading space. */
export function formatClassicInitialDisplayedScore(): '0' {
  return '0';
}

/** Every native UpdateDisplayScore formatting call uses the exact leading-space format. */
export function formatClassicUpdatedDisplayedScore(value: number): string {
  assertSafeInteger(value, 'displayed score');
  return ` ${value}`;
}

export function formatClassicBestScore(value: number): string {
  assertSafeInteger(value, 'best score');
  return ` ${value}`;
}

export function formatClassicPendingDoubleScore(value: number): string {
  assertSafeInteger(value, 'pending double score');
  return `${value}`;
}

export function classicBestScoreColor(isNewBest: boolean): ClassicScoreHudRgb {
  if (typeof isNewBest !== 'boolean') {
    throw new TypeError('isNewBest must be boolean');
  }
  return isNewBest ? CLASSIC_SCORE_HUD_NEW_BEST_GREEN : CLASSIC_SCORE_HUD_BLACK;
}

function assertViewport(viewport: ClassicScoreHudViewport): void {
  if (viewport === null || typeof viewport !== 'object') {
    throw new TypeError('viewport must be an object');
  }
  assertPositiveFinite(viewport.width, 'viewport.width');
  assertPositiveFinite(viewport.height, 'viewport.height');
}

function assertDimensions(dimensions: ClassicRasterDimensions, label: string): void {
  if (dimensions === null || typeof dimensions !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
  assertPositiveFinite(dimensions.width, `${label}.width`);
  assertPositiveFinite(dimensions.height, `${label}.height`);
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be positive and finite`);
  }
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}

function multiplyFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) * Math.fround(right));
}

function addFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) + Math.fround(right));
}

function subtractFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) - Math.fround(right));
}

function point(x: number, y: number): ClassicScoreHudPoint {
  return Object.freeze({ x: Math.fround(x), y: Math.fround(y) });
}

function float32FromBits(bits: number): number {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, bits, false);
  return new DataView(bytes.buffer).getFloat32(0, false);
}
