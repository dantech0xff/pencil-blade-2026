export const COMBO_BIRD_NO_BOMB_RASTER_PATH
  = 'Text/text-nobomb.png' as const;
export const COMBO_BIRD_NO_LIFE_RASTER_PATH
  = 'Text/text-nolive.png' as const;
export const COMBO_BIRD_NINETY_RASTER_PATH
  = 'Text/text-90s.png' as const;
export const COMBO_BIRD_GO_RASTER_PATH
  = 'Text/text-go.png' as const;
export const COMBO_BIRD_JUST_COMBO_RESOURCE_FIELD
  = 'justComboInstruction' as const;

export const COMBO_BIRD_INTRO_MOVE_SECONDS = Math.fround(0.5);
export const COMBO_BIRD_INTRO_HOLD_SECONDS = Math.fround(0.25);
export const COMBO_BIRD_INTRO_SLIDE_SECONDS = Math.fround(1.25);
export const COMBO_BIRD_INTRO_TOTAL_SECONDS = Math.fround(3.75);
export const COMBO_BIRD_INTRO_Z_ORDER = 1 as const;

export type ComboBirdInstructionCard =
  | 'no-bomb'
  | 'just-combo'
  | 'no-life';

/** Native construction/action order. All three actions start in the same on-enter frame. */
export const COMBO_BIRD_INSTRUCTION_CONSTRUCTION_ORDER = Object.freeze([
  'no-bomb', 'just-combo', 'no-life',
] as const satisfies readonly ComboBirdInstructionCard[]);

/** Native equal-z attachment order. It intentionally differs from construction order. */
export const COMBO_BIRD_INSTRUCTION_ATTACHMENT_ORDER = Object.freeze([
  'just-combo', 'no-bomb', 'no-life',
] as const satisfies readonly ComboBirdInstructionCard[]);

export const COMBO_BIRD_INTRO_TRANSITION_SECONDS = Object.freeze({
  enterInstructions: Math.fround(0),
  enterNinety: COMBO_BIRD_INTRO_SLIDE_SECONDS,
  enterGo: Math.fround(COMBO_BIRD_INTRO_SLIDE_SECONDS * 2),
  enterRunning: COMBO_BIRD_INTRO_TOTAL_SECONDS,
});

export interface ComboBirdIntroPoint {
  readonly x: number;
  readonly y: number;
}

export interface ComboBirdIntroVisibleRect {
  readonly center: ComboBirdIntroPoint;
  readonly leftX: number;
  readonly rightX: number;
}

export interface ComboBirdIntroPresentationInput {
  readonly goSpriteWidth: number;
  readonly justComboSpriteWidth: number;
  readonly logicalHeight: number;
  readonly ninetySpriteWidth: number;
  readonly noBombSpriteWidth: number;
  readonly noLifeSpriteWidth: number;
  readonly visibleRect: ComboBirdIntroVisibleRect;
}

export type ComboBirdIntroResource =
  | Readonly<{
      readonly canonicalPath:
        | typeof COMBO_BIRD_NO_BOMB_RASTER_PATH
        | typeof COMBO_BIRD_NO_LIFE_RASTER_PATH
        | typeof COMBO_BIRD_NINETY_RASTER_PATH
        | typeof COMBO_BIRD_GO_RASTER_PATH;
      readonly type: 'canonical-path';
    }>
  | Readonly<{
      /**
       * The resource contract resolves this semantic field to the literal per-tree spelling.
       * This pure presentation layer never synthesizes `text-justcombo.png`.
       */
      readonly field: typeof COMBO_BIRD_JUST_COMBO_RESOURCE_FIELD;
      readonly type: 'semantic-resource';
    }>;

export type ComboBirdIntroCompletion =
  | 'show-ninety'
  | 'show-go'
  | 'start-game'
  | null;

export interface ComboBirdIntroSlidePlan {
  readonly actionSequence: readonly [
    Readonly<{
      readonly durationSeconds: number;
      readonly position: ComboBirdIntroPoint;
      readonly type: 'move-to';
    }>,
    Readonly<{
      readonly durationSeconds: number;
      readonly type: 'delay';
    }>,
    Readonly<{
      readonly durationSeconds: number;
      readonly position: ComboBirdIntroPoint;
      readonly type: 'move-to';
    }>,
  ];
  readonly completion: ComboBirdIntroCompletion;
  readonly initialWorldPosition: ComboBirdIntroPoint;
  readonly resource: ComboBirdIntroResource;
  readonly zOrder: 1;
}

export interface ComboBirdInstructionSlidePlan
  extends ComboBirdIntroSlidePlan {
  readonly card: ComboBirdInstructionCard;
  readonly startsInOnEnterFrame: true;
}

export interface ComboBirdIntroPresentationPlan {
  readonly attachmentOrder:
    typeof COMBO_BIRD_INSTRUCTION_ATTACHMENT_ORDER;
  readonly constructionAndActionOrder:
    typeof COMBO_BIRD_INSTRUCTION_CONSTRUCTION_ORDER;
  readonly go: ComboBirdIntroSlidePlan;
  readonly instructions: Readonly<{
    readonly justCombo: ComboBirdInstructionSlidePlan;
    readonly noBomb: ComboBirdInstructionSlidePlan;
    readonly noLife: ComboBirdInstructionSlidePlan;
  }>;
  readonly ninety: ComboBirdIntroSlidePlan;
  readonly timeline: typeof COMBO_BIRD_INTRO_TRANSITION_SECONDS;
  readonly totalActionSeconds: number;
}

/** Exact three-card -> 90s -> GO presentation in visible-world coordinates. */
export function createComboBirdIntroPresentationPlan(
  input: ComboBirdIntroPresentationInput,
): ComboBirdIntroPresentationPlan {
  assertInput(input);
  const centerY = input.visibleRect.center.y;
  return Object.freeze({
    attachmentOrder: COMBO_BIRD_INSTRUCTION_ATTACHMENT_ORDER,
    constructionAndActionOrder: COMBO_BIRD_INSTRUCTION_CONSTRUCTION_ORDER,
    go: createCanonicalSlide(
      COMBO_BIRD_GO_RASTER_PATH,
      input.goSpriteWidth,
      centerY,
      'left-to-right',
      input.visibleRect,
      'start-game',
    ),
    instructions: Object.freeze({
      justCombo: createInstructionSlide(
        'just-combo',
        semanticJustComboResource(),
        input.justComboSpriteWidth,
        centerY,
        'right-to-left',
        input.visibleRect,
        'show-ninety',
      ),
      noBomb: createInstructionSlide(
        'no-bomb',
        canonicalResource(COMBO_BIRD_NO_BOMB_RASTER_PATH),
        input.noBombSpriteWidth,
        Math.fround(input.logicalHeight * Math.fround(0.6)),
        'left-to-right',
        input.visibleRect,
        null,
      ),
      noLife: createInstructionSlide(
        'no-life',
        canonicalResource(COMBO_BIRD_NO_LIFE_RASTER_PATH),
        input.noLifeSpriteWidth,
        Math.fround(input.logicalHeight * Math.fround(0.4)),
        'left-to-right',
        input.visibleRect,
        null,
      ),
    }),
    ninety: createCanonicalSlide(
      COMBO_BIRD_NINETY_RASTER_PATH,
      input.ninetySpriteWidth,
      centerY,
      'left-to-right',
      input.visibleRect,
      'show-go',
    ),
    timeline: COMBO_BIRD_INTRO_TRANSITION_SECONDS,
    totalActionSeconds: COMBO_BIRD_INTRO_TOTAL_SECONDS,
  });
}

type SlideDirection = 'left-to-right' | 'right-to-left';

function createInstructionSlide(
  card: ComboBirdInstructionCard,
  resource: ComboBirdIntroResource,
  spriteWidth: number,
  y: number,
  direction: SlideDirection,
  visibleRect: ComboBirdIntroVisibleRect,
  completion: ComboBirdIntroCompletion,
): ComboBirdInstructionSlidePlan {
  return Object.freeze({
    ...createSlide(
      resource,
      spriteWidth,
      y,
      direction,
      visibleRect,
      completion,
    ),
    card,
    startsInOnEnterFrame: true,
  });
}

function createCanonicalSlide(
  canonicalPath:
    | typeof COMBO_BIRD_NINETY_RASTER_PATH
    | typeof COMBO_BIRD_GO_RASTER_PATH,
  spriteWidth: number,
  y: number,
  direction: SlideDirection,
  visibleRect: ComboBirdIntroVisibleRect,
  completion: Exclude<ComboBirdIntroCompletion, null | 'show-ninety'>,
): ComboBirdIntroSlidePlan {
  return createSlide(
    canonicalResource(canonicalPath),
    spriteWidth,
    y,
    direction,
    visibleRect,
    completion,
  );
}

function createSlide(
  resource: ComboBirdIntroResource,
  spriteWidth: number,
  y: number,
  direction: SlideDirection,
  visibleRect: ComboBirdIntroVisibleRect,
  completion: ComboBirdIntroCompletion,
): ComboBirdIntroSlidePlan {
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
        durationSeconds: COMBO_BIRD_INTRO_MOVE_SECONDS,
        position: frozenPoint(visibleRect.center.x, y),
        type: 'move-to',
      }),
      Object.freeze({
        durationSeconds: COMBO_BIRD_INTRO_HOLD_SECONDS,
        type: 'delay',
      }),
      Object.freeze({
        durationSeconds: COMBO_BIRD_INTRO_MOVE_SECONDS,
        position: frozenPoint(endX, y),
        type: 'move-to',
      }),
    ] as const),
    completion,
    initialWorldPosition: frozenPoint(startX, y),
    resource,
    zOrder: COMBO_BIRD_INTRO_Z_ORDER,
  });
}

function canonicalResource(
  canonicalPath:
    | typeof COMBO_BIRD_NO_BOMB_RASTER_PATH
    | typeof COMBO_BIRD_NO_LIFE_RASTER_PATH
    | typeof COMBO_BIRD_NINETY_RASTER_PATH
    | typeof COMBO_BIRD_GO_RASTER_PATH,
): ComboBirdIntroResource {
  return Object.freeze({ canonicalPath, type: 'canonical-path' });
}

function semanticJustComboResource(): ComboBirdIntroResource {
  return Object.freeze({
    field: COMBO_BIRD_JUST_COMBO_RESOURCE_FIELD,
    type: 'semantic-resource',
  });
}

function assertInput(input: ComboBirdIntroPresentationInput): void {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('input must be an object');
  }
  assertPositiveFinite(input.goSpriteWidth, 'goSpriteWidth');
  assertPositiveFinite(input.justComboSpriteWidth, 'justComboSpriteWidth');
  assertPositiveFinite(input.logicalHeight, 'logicalHeight');
  assertPositiveFinite(input.ninetySpriteWidth, 'ninetySpriteWidth');
  assertPositiveFinite(input.noBombSpriteWidth, 'noBombSpriteWidth');
  assertPositiveFinite(input.noLifeSpriteWidth, 'noLifeSpriteWidth');
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

function frozenPoint(x: number, y: number): ComboBirdIntroPoint {
  return Object.freeze({ x: Math.fround(x), y: Math.fround(y) });
}
