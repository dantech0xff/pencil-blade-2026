export const GN_STYLE_NO_BOMB_RASTER_PATH
  = 'Text/text-nobomb.png' as const;
export const GN_STYLE_INSTRUCTION_RASTER_PATH
  = 'Text/text-gnstyle.png' as const;
export const GN_STYLE_NO_LIFE_RASTER_PATH
  = 'Text/text-nolive.png' as const;
export const GN_STYLE_ONE_HUNDRED_FIFTY_RASTER_PATH
  = 'Text/text-150s.png' as const;
export const GN_STYLE_GO_RASTER_PATH
  = 'Text/text-go.png' as const;

export const GN_STYLE_INSTRUCTION_MOVE_SECONDS = Math.fround(0.25);
export const GN_STYLE_INSTRUCTION_HOLD_SECONDS = Math.fround(0.25);
export const GN_STYLE_INSTRUCTION_SLIDE_SECONDS = Math.fround(0.75);
export const GN_STYLE_ONE_HUNDRED_FIFTY_MOVE_SECONDS = Math.fround(0.35);
export const GN_STYLE_ONE_HUNDRED_FIFTY_HOLD_SECONDS = Math.fround(0.25);
export const GN_STYLE_ONE_HUNDRED_FIFTY_SLIDE_SECONDS = Math.fround(0.95);
export const GN_STYLE_GO_MOVE_SECONDS = Math.fround(0.325);
export const GN_STYLE_GO_HOLD_SECONDS = Math.fround(0.25);
export const GN_STYLE_GO_SLIDE_SECONDS = Math.fround(0.9);
export const GN_STYLE_INTRO_TOTAL_SECONDS = Math.fround(2.6);
export const GN_STYLE_INTRO_Z_ORDER = 1 as const;

export type GnStyleInstructionCard =
  | 'no-bomb'
  | 'gn-style'
  | 'no-life';

/** Native construction/action order. All three actions start in the same on-enter frame. */
export const GN_STYLE_INSTRUCTION_CONSTRUCTION_ORDER = Object.freeze([
  'no-bomb', 'gn-style', 'no-life',
] as const satisfies readonly GnStyleInstructionCard[]);

/** Native equal-z attachment order. It intentionally differs from construction order. */
export const GN_STYLE_INSTRUCTION_ATTACHMENT_ORDER = Object.freeze([
  'gn-style', 'no-bomb', 'no-life',
] as const satisfies readonly GnStyleInstructionCard[]);

export const GN_STYLE_INTRO_TRANSITION_SECONDS = Object.freeze({
  enterInstructions: Math.fround(0),
  enterOneHundredFifty: Math.fround(0.75),
  enterGo: Math.fround(1.7),
  enterRunning: GN_STYLE_INTRO_TOTAL_SECONDS,
});

export interface GnStyleIntroPoint {
  readonly x: number;
  readonly y: number;
}

export interface GnStyleIntroVisibleRect {
  readonly center: GnStyleIntroPoint;
  readonly leftX: number;
  readonly rightX: number;
}

export interface GnStyleIntroPresentationInput {
  readonly gnStyleSpriteWidth: number;
  readonly goSpriteWidth: number;
  readonly logicalHeight: number;
  readonly noBombSpriteWidth: number;
  readonly noLifeSpriteWidth: number;
  readonly oneHundredFiftySpriteWidth: number;
  readonly visibleRect: GnStyleIntroVisibleRect;
}

export type GnStyleIntroCanonicalPath =
  | typeof GN_STYLE_NO_BOMB_RASTER_PATH
  | typeof GN_STYLE_INSTRUCTION_RASTER_PATH
  | typeof GN_STYLE_NO_LIFE_RASTER_PATH
  | typeof GN_STYLE_ONE_HUNDRED_FIFTY_RASTER_PATH
  | typeof GN_STYLE_GO_RASTER_PATH;

export type GnStyleIntroCompletion =
  | 'show-one-hundred-fifty'
  | 'show-go'
  | 'start-game'
  | null;

export interface GnStyleIntroDurations {
  readonly enterSeconds: number;
  readonly exitSeconds: number;
  readonly holdSeconds: number;
}

export interface GnStyleIntroSlidePlan {
  readonly actionSequence: readonly [
    Readonly<{
      readonly durationSeconds: number;
      readonly position: GnStyleIntroPoint;
      readonly type: 'move-to';
    }>,
    Readonly<{
      readonly durationSeconds: number;
      readonly type: 'delay';
    }>,
    Readonly<{
      readonly durationSeconds: number;
      readonly position: GnStyleIntroPoint;
      readonly type: 'move-to';
    }>,
  ];
  readonly completion: GnStyleIntroCompletion;
  readonly initialWorldPosition: GnStyleIntroPoint;
  readonly resource: Readonly<{
    readonly canonicalPath: GnStyleIntroCanonicalPath;
    readonly type: 'canonical-path';
  }>;
  readonly zOrder: 1;
}

export interface GnStyleInstructionSlidePlan
  extends GnStyleIntroSlidePlan {
  readonly card: GnStyleInstructionCard;
  readonly startsInOnEnterFrame: true;
}

export interface GnStyleIntroPresentationPlan {
  readonly attachmentOrder:
    typeof GN_STYLE_INSTRUCTION_ATTACHMENT_ORDER;
  readonly constructionAndActionOrder:
    typeof GN_STYLE_INSTRUCTION_CONSTRUCTION_ORDER;
  readonly go: GnStyleIntroSlidePlan;
  readonly instructions: Readonly<{
    readonly gnStyle: GnStyleInstructionSlidePlan;
    readonly noBomb: GnStyleInstructionSlidePlan;
    readonly noLife: GnStyleInstructionSlidePlan;
  }>;
  readonly oneHundredFifty: GnStyleIntroSlidePlan;
  readonly timeline: typeof GN_STYLE_INTRO_TRANSITION_SECONDS;
  readonly totalActionSeconds: number;
}

const INSTRUCTION_DURATIONS: GnStyleIntroDurations = Object.freeze({
  enterSeconds: GN_STYLE_INSTRUCTION_MOVE_SECONDS,
  exitSeconds: GN_STYLE_INSTRUCTION_MOVE_SECONDS,
  holdSeconds: GN_STYLE_INSTRUCTION_HOLD_SECONDS,
});
const ONE_HUNDRED_FIFTY_DURATIONS: GnStyleIntroDurations = Object.freeze({
  enterSeconds: GN_STYLE_ONE_HUNDRED_FIFTY_MOVE_SECONDS,
  exitSeconds: GN_STYLE_ONE_HUNDRED_FIFTY_MOVE_SECONDS,
  holdSeconds: GN_STYLE_ONE_HUNDRED_FIFTY_HOLD_SECONDS,
});
const GO_DURATIONS: GnStyleIntroDurations = Object.freeze({
  enterSeconds: GN_STYLE_GO_MOVE_SECONDS,
  exitSeconds: GN_STYLE_GO_MOVE_SECONDS,
  holdSeconds: GN_STYLE_GO_HOLD_SECONDS,
});

/** Exact three-card -> 150s -> GO presentation in visible-world coordinates. */
export function createGnStyleIntroPresentationPlan(
  input: GnStyleIntroPresentationInput,
): GnStyleIntroPresentationPlan {
  assertInput(input);
  const centerY = input.visibleRect.center.y;
  return Object.freeze({
    attachmentOrder: GN_STYLE_INSTRUCTION_ATTACHMENT_ORDER,
    constructionAndActionOrder: GN_STYLE_INSTRUCTION_CONSTRUCTION_ORDER,
    go: createSlide(
      GN_STYLE_GO_RASTER_PATH,
      input.goSpriteWidth,
      centerY,
      'left-to-right',
      input.visibleRect,
      GO_DURATIONS,
      'start-game',
    ),
    instructions: Object.freeze({
      gnStyle: createInstructionSlide(
        'gn-style',
        GN_STYLE_INSTRUCTION_RASTER_PATH,
        input.gnStyleSpriteWidth,
        centerY,
        'right-to-left',
        input.visibleRect,
        'show-one-hundred-fifty',
      ),
      noBomb: createInstructionSlide(
        'no-bomb',
        GN_STYLE_NO_BOMB_RASTER_PATH,
        input.noBombSpriteWidth,
        Math.fround(input.logicalHeight * Math.fround(0.6)),
        'left-to-right',
        input.visibleRect,
        null,
      ),
      noLife: createInstructionSlide(
        'no-life',
        GN_STYLE_NO_LIFE_RASTER_PATH,
        input.noLifeSpriteWidth,
        Math.fround(input.logicalHeight * Math.fround(0.4)),
        'left-to-right',
        input.visibleRect,
        null,
      ),
    }),
    oneHundredFifty: createSlide(
      GN_STYLE_ONE_HUNDRED_FIFTY_RASTER_PATH,
      input.oneHundredFiftySpriteWidth,
      centerY,
      'left-to-right',
      input.visibleRect,
      ONE_HUNDRED_FIFTY_DURATIONS,
      'show-go',
    ),
    timeline: GN_STYLE_INTRO_TRANSITION_SECONDS,
    totalActionSeconds: GN_STYLE_INTRO_TOTAL_SECONDS,
  });
}

type SlideDirection = 'left-to-right' | 'right-to-left';

function createInstructionSlide(
  card: GnStyleInstructionCard,
  canonicalPath:
    | typeof GN_STYLE_NO_BOMB_RASTER_PATH
    | typeof GN_STYLE_INSTRUCTION_RASTER_PATH
    | typeof GN_STYLE_NO_LIFE_RASTER_PATH,
  spriteWidth: number,
  y: number,
  direction: SlideDirection,
  visibleRect: GnStyleIntroVisibleRect,
  completion: GnStyleIntroCompletion,
): GnStyleInstructionSlidePlan {
  return Object.freeze({
    ...createSlide(
      canonicalPath,
      spriteWidth,
      y,
      direction,
      visibleRect,
      INSTRUCTION_DURATIONS,
      completion,
    ),
    card,
    startsInOnEnterFrame: true,
  });
}

function createSlide(
  canonicalPath: GnStyleIntroCanonicalPath,
  spriteWidth: number,
  y: number,
  direction: SlideDirection,
  visibleRect: GnStyleIntroVisibleRect,
  durations: GnStyleIntroDurations,
  completion: GnStyleIntroCompletion,
): GnStyleIntroSlidePlan {
  const halfWidth = Math.fround(spriteWidth * Math.fround(0.5));
  const startX = direction === 'left-to-right'
    ? Math.fround(visibleRect.leftX - halfWidth)
    : Math.fround(visibleRect.rightX + halfWidth);
  const endX = direction === 'left-to-right'
    ? Math.fround(visibleRect.rightX + halfWidth)
    : Math.fround(visibleRect.leftX - halfWidth);

  return Object.freeze({
    actionSequence: Object.freeze([
      Object.freeze({
        durationSeconds: durations.enterSeconds,
        position: frozenPoint(visibleRect.center.x, y),
        type: 'move-to',
      }),
      Object.freeze({
        durationSeconds: durations.holdSeconds,
        type: 'delay',
      }),
      Object.freeze({
        durationSeconds: durations.exitSeconds,
        position: frozenPoint(endX, y),
        type: 'move-to',
      }),
    ] as const),
    completion,
    initialWorldPosition: frozenPoint(startX, y),
    resource: Object.freeze({ canonicalPath, type: 'canonical-path' }),
    zOrder: GN_STYLE_INTRO_Z_ORDER,
  });
}

function assertInput(input: GnStyleIntroPresentationInput): void {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('input must be an object');
  }
  assertPositiveFinite(input.gnStyleSpriteWidth, 'gnStyleSpriteWidth');
  assertPositiveFinite(input.goSpriteWidth, 'goSpriteWidth');
  assertPositiveFinite(input.logicalHeight, 'logicalHeight');
  assertPositiveFinite(input.noBombSpriteWidth, 'noBombSpriteWidth');
  assertPositiveFinite(input.noLifeSpriteWidth, 'noLifeSpriteWidth');
  assertPositiveFinite(
    input.oneHundredFiftySpriteWidth,
    'oneHundredFiftySpriteWidth',
  );
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

function frozenPoint(x: number, y: number): GnStyleIntroPoint {
  return Object.freeze({ x: Math.fround(x), y: Math.fround(y) });
}
