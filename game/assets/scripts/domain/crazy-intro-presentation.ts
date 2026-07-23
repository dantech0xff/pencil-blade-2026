export const CRAZY_INTRO_SIXTY_RASTER_PATH = 'Text/text-60s.png' as const;
export const CRAZY_INTRO_GO_RASTER_PATH = 'Text/text-go.png' as const;
export const CRAZY_INTRO_MOVE_SECONDS = Math.fround(0.25);
export const CRAZY_INTRO_DELAY_SECONDS = Math.fround(0.5);
export const CRAZY_INTRO_FADE_SECONDS = Math.fround(0.25);
export const CRAZY_INTRO_SLIDE_SECONDS = Math.fround(1);
export const CRAZY_INTRO_TOTAL_SECONDS = Math.fround(2);
export const CRAZY_INTRO_Z_ORDER = 1 as const;

export interface CrazyIntroPoint {
  readonly x: number;
  readonly y: number;
}

export interface CrazyIntroVisibleRect {
  readonly center: CrazyIntroPoint;
  readonly leftX: number;
  readonly rightX: number;
}

export interface CrazyIntroPresentationInput {
  readonly goSpriteWidth: number;
  readonly sixtySpriteWidth: number;
  readonly visibleRect: CrazyIntroVisibleRect;
}

export type CrazyIntroRasterPath =
  | typeof CRAZY_INTRO_SIXTY_RASTER_PATH
  | typeof CRAZY_INTRO_GO_RASTER_PATH;

export type CrazyIntroCompletion = 'replace-with-go' | 'start-crazy';

export interface CrazyIntroSlidePlan {
  readonly completion: CrazyIntroCompletion;
  readonly fadeSequence: readonly [
    Readonly<{ readonly durationSeconds: number; readonly type: 'fade-in' }>,
    Readonly<{ readonly durationSeconds: number; readonly type: 'delay' }>,
    Readonly<{ readonly durationSeconds: number; readonly type: 'fade-out' }>,
    Readonly<{
      readonly cleanupCurrent: true;
      readonly type: 'invoke-completion';
      readonly value: CrazyIntroCompletion;
    }>,
  ];
  readonly initialWorldPosition: CrazyIntroPoint;
  readonly moveSequence: readonly [
    Readonly<{
      readonly durationSeconds: number;
      readonly position: CrazyIntroPoint;
      readonly type: 'move-to';
    }>,
    Readonly<{ readonly durationSeconds: number; readonly type: 'delay' }>,
    Readonly<{
      readonly durationSeconds: number;
      readonly position: CrazyIntroPoint;
      readonly type: 'move-to';
    }>,
  ];
  readonly rasterPath: CrazyIntroRasterPath;
  readonly tracksRunConcurrently: true;
  readonly zOrder: 1;
}

export interface CrazyIntroPresentationPlan {
  readonly cutDisabledDuringIntro: false;
  readonly go: CrazyIntroSlidePlan;
  readonly sixty: CrazyIntroSlidePlan;
  readonly totalActionSeconds: number;
}

/** Exact recovered `60s` -> `GO` two-slide presentation in visible-world coordinates. */
export function createCrazyIntroPresentationPlan(
  input: CrazyIntroPresentationInput,
): CrazyIntroPresentationPlan {
  assertInput(input);
  return Object.freeze({
    cutDisabledDuringIntro: false,
    go: createSlide(
      CRAZY_INTRO_GO_RASTER_PATH,
      input.goSpriteWidth,
      input.visibleRect,
      'start-crazy',
    ),
    sixty: createSlide(
      CRAZY_INTRO_SIXTY_RASTER_PATH,
      input.sixtySpriteWidth,
      input.visibleRect,
      'replace-with-go',
    ),
    totalActionSeconds: CRAZY_INTRO_TOTAL_SECONDS,
  });
}

function createSlide(
  rasterPath: CrazyIntroRasterPath,
  spriteWidth: number,
  visibleRect: CrazyIntroVisibleRect,
  completion: CrazyIntroCompletion,
): CrazyIntroSlidePlan {
  const y = Math.fround(visibleRect.center.y);
  const center = frozenPoint(visibleRect.center.x, y);
  const halfWidth = Math.fround(spriteWidth * Math.fround(0.5));
  const exit = frozenPoint(visibleRect.rightX + halfWidth, y);

  return Object.freeze({
    completion,
    fadeSequence: Object.freeze([
      Object.freeze({ durationSeconds: CRAZY_INTRO_FADE_SECONDS, type: 'fade-in' }),
      Object.freeze({ durationSeconds: CRAZY_INTRO_DELAY_SECONDS, type: 'delay' }),
      Object.freeze({ durationSeconds: CRAZY_INTRO_FADE_SECONDS, type: 'fade-out' }),
      Object.freeze({
        cleanupCurrent: true,
        type: 'invoke-completion',
        value: completion,
      }),
    ] as const),
    initialWorldPosition: frozenPoint(visibleRect.leftX - halfWidth, y),
    moveSequence: Object.freeze([
      Object.freeze({
        durationSeconds: CRAZY_INTRO_MOVE_SECONDS,
        position: center,
        type: 'move-to',
      }),
      Object.freeze({ durationSeconds: CRAZY_INTRO_DELAY_SECONDS, type: 'delay' }),
      Object.freeze({
        durationSeconds: CRAZY_INTRO_MOVE_SECONDS,
        position: exit,
        type: 'move-to',
      }),
    ] as const),
    rasterPath,
    tracksRunConcurrently: true,
    zOrder: CRAZY_INTRO_Z_ORDER,
  });
}

function assertInput(input: CrazyIntroPresentationInput): void {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('input must be an object');
  }
  assertPositiveFinite(input.sixtySpriteWidth, 'sixtySpriteWidth');
  assertPositiveFinite(input.goSpriteWidth, 'goSpriteWidth');
  const rect = input.visibleRect;
  if (rect === null || typeof rect !== 'object' || Array.isArray(rect)) {
    throw new TypeError('visibleRect must be an object');
  }
  assertFinite(rect.leftX, 'visibleRect.leftX');
  assertFinite(rect.rightX, 'visibleRect.rightX');
  if (rect.rightX <= rect.leftX) {
    throw new RangeError('visibleRect.rightX must be greater than leftX');
  }
  if (
    rect.center === null
    || typeof rect.center !== 'object'
    || Array.isArray(rect.center)
  ) {
    throw new TypeError('visibleRect.center must be an object');
  }
  assertFinite(rect.center.x, 'visibleRect.center.x');
  assertFinite(rect.center.y, 'visibleRect.center.y');
}

function assertPositiveFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite`);
  }
}

function frozenPoint(x: number, y: number): CrazyIntroPoint {
  return Object.freeze({ x: Math.fround(x), y: Math.fround(y) });
}
