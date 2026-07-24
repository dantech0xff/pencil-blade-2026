import type { ClassicRasterResource } from './classic-resource-contract';
import type {
  LeaderboardRasterProfile,
  LeaderboardTwoFrameRasterSet,
} from './leaderboard-resource-contract';
import {
  LEADERBOARD_BACK_AUDIO_CANONICAL_PATH,
  LEADERBOARD_PLAYER_FONT_CANONICAL_PATH,
  LEADERBOARD_SCORE_FONT_CANONICAL_PATH,
  getLeaderboardRasterResources,
} from './leaderboard-resource-contract';
import type {
  LeaderboardBoardSnapshot,
  LeaderboardBoardsSnapshot,
  LeaderboardIndex,
  LeaderboardModeId,
  LeaderboardPanelValues,
} from './leaderboard-state';
import {
  LEADERBOARD_MODE_COUNT,
  LEADERBOARD_NATIVE_MODE_ORDER,
} from './leaderboard-state';
import type { ClassicAssetTree } from './resolution-profile-service';

export const LEADERBOARD_ROOT_Z_ORDER = 1 as const;
export const LEADERBOARD_GESTURES_DEFAULT_Z_ORDER = 0 as const;
export const LEADERBOARD_ENTRY_SECONDS = Math.fround(1);
export const LEADERBOARD_BACK_ROTATION_DEGREES = Math.fround(360);
export const LEADERBOARD_SCORE_FORMAT = '%d' as const;

const HALF = Math.fround(0.5);
const ITEM_Y_FACTOR = Math.fround(0.475);
const HEADER_Y_FACTOR = Math.fround(1.085);
const LABEL_X_FACTOR = Math.fround(0.45);
const PLAYER_REFERENCE_WIDTH = Math.fround(480);
const PLAYER_BASE_POINT_SIZE = Math.fround(30);
const SCORE_BASE_POINT_SIZE = Math.fround(40);
const ROW_Y_FACTORS = Object.freeze([
  Math.fround(0.85),
  Math.fround(0.55),
  Math.fround(0.275),
] as const);
const BOARD_KEYS = Object.freeze(['index', 'modeId', 'values'] as const);
const EMPTY_ACTIONS = Object.freeze([] as const);

export type LeaderboardRank = 1 | 2 | 3;

export interface LeaderboardPoint {
  readonly x: number;
  readonly y: number;
}

export interface LeaderboardVisibleRect {
  readonly bottom: LeaderboardPoint;
  readonly center: LeaderboardPoint;
  readonly left: LeaderboardPoint;
  readonly right: LeaderboardPoint;
  readonly top: LeaderboardPoint;
}

export interface LeaderboardViewport {
  /** Raw logical director height H. */
  readonly logicalHeight: number;
  /** Raw logical director width W. */
  readonly logicalWidth: number;
  readonly visibleRect: LeaderboardVisibleRect;
}

export interface LeaderboardAnchor {
  readonly evidence: 'inferred-legacy-default' | 'recovered-setter';
  readonly x: number;
  readonly y: number;
}

export interface LeaderboardRgb {
  readonly b: number;
  readonly g: number;
  readonly r: number;
}

export interface LeaderboardMoveToAction {
  readonly durationSeconds: number;
  readonly easing: null;
  readonly target: LeaderboardPoint;
  readonly type: 'move-to';
}

export interface LeaderboardMoveByAction {
  readonly delta: LeaderboardPoint;
  readonly durationSeconds: number;
  readonly easing: null;
  readonly type: 'move-by';
}

export interface LeaderboardRotateByAction {
  readonly deltaDegrees: number;
  readonly durationSeconds: number;
  readonly easing: null;
  readonly type: 'rotate-by';
}

export interface LeaderboardTitlePresentation {
  readonly actions: readonly [LeaderboardMoveToAction];
  readonly actionsRunConcurrently: false;
  readonly anchor: LeaderboardAnchor;
  readonly attachmentInsertion: 2;
  readonly fadeActionPresent: false;
  readonly finalPosition: LeaderboardPoint;
  readonly initialPosition: LeaderboardPoint;
  readonly resource: ClassicRasterResource;
  readonly rotationActionPresent: false;
  readonly zOrder: 1;
}

export interface LeaderboardBackPresentation {
  readonly actions: readonly [LeaderboardRotateByAction, LeaderboardMoveByAction];
  readonly actionsRunConcurrently: true;
  readonly anchor: LeaderboardAnchor;
  readonly attachmentInsertion: 3;
  readonly backKeyDelegatesToSameCallback: true;
  readonly disabledResource: null;
  readonly fadeActionPresent: false;
  readonly finalPosition: LeaderboardPoint;
  readonly initialPosition: LeaderboardPoint;
  readonly itemCount: 1;
  readonly menuPosition: LeaderboardPoint;
  readonly resources: LeaderboardTwoFrameRasterSet;
  readonly zOrder: 1;
}

export interface LeaderboardSpritePresentation {
  readonly anchor: LeaderboardAnchor;
  readonly attachmentInsertion: 1 | 2;
  readonly entryActions: readonly [];
  readonly localPosition: LeaderboardPoint;
  readonly resource: ClassicRasterResource;
  readonly zOrder: 0;
}

export interface LeaderboardPlayerLabelPresentation {
  readonly anchor: LeaderboardAnchor;
  readonly attachmentInsertion: 1 | 2 | 3;
  readonly colorRgb: LeaderboardRgb;
  readonly entryActions: readonly [];
  readonly fontCanonicalPath: typeof LEADERBOARD_PLAYER_FONT_CANONICAL_PATH;
  readonly fontPointSize: number;
  readonly localPosition: LeaderboardPoint;
  readonly rank: LeaderboardRank;
  readonly text: typeof LEADERBOARD_PLAYER_LABEL_TEXTS[number];
  readonly zOrder: 1;
}

export interface LeaderboardScoreLabelPresentation {
  readonly anchor: LeaderboardAnchor;
  readonly attachmentInsertion: 4 | 5 | 6;
  readonly colorRgb: LeaderboardRgb;
  readonly entryActions: readonly [];
  readonly fontCanonicalPath: typeof LEADERBOARD_SCORE_FONT_CANONICAL_PATH;
  readonly fontPointSize: number;
  readonly format: typeof LEADERBOARD_SCORE_FORMAT;
  readonly localPosition: LeaderboardPoint;
  readonly rank: LeaderboardRank;
  readonly text: string;
  readonly value: number;
  readonly zOrder: 1;
}

export interface LeaderboardTemplatePresentation {
  readonly anchor: LeaderboardAnchor;
  readonly attachmentInsertion: 1;
  readonly childOrder: typeof LEADERBOARD_TEMPLATE_CHILD_ORDER;
  readonly entryActions: readonly [];
  readonly localPosition: LeaderboardPoint;
  readonly playerLabels: readonly LeaderboardPlayerLabelPresentation[];
  readonly resource: ClassicRasterResource;
  readonly scoreLabels: readonly LeaderboardScoreLabelPresentation[];
  readonly zOrder: 0;
}

export interface LeaderboardCardPresentation {
  readonly attachmentInsertion: number;
  readonly header: LeaderboardSpritePresentation;
  readonly index: LeaderboardIndex;
  readonly localChildOrder: typeof LEADERBOARD_CARD_CHILD_ORDER;
  readonly modeId: LeaderboardModeId;
  readonly rootPosition: LeaderboardPoint;
  readonly template: LeaderboardTemplatePresentation;
  readonly values: LeaderboardPanelValues;
  readonly zOrder: 1;
}

export interface LeaderboardPresentationSnapshot {
  readonly assetTree: ClassicAssetTree;
  readonly audio: Readonly<{
    readonly back: Readonly<{
      readonly canonicalPath: typeof LEADERBOARD_BACK_AUDIO_CANONICAL_PATH;
      readonly effectsGated: true;
      readonly loop: false;
      readonly timing: 'after-main-menu-attachment';
    }>;
  }>;
  readonly boards: LeaderboardBoardsSnapshot;
  readonly cardChildOrder: typeof LEADERBOARD_CARD_CHILD_ORDER;
  readonly cards: readonly LeaderboardCardPresentation[];
  readonly ownedRootOrder: typeof LEADERBOARD_ROOT_CHILD_ORDER;
  readonly rootZOrder: 1;
  readonly shell: Readonly<{
    readonly back: LeaderboardBackPresentation;
    readonly title: LeaderboardTitlePresentation;
  }>;
  readonly templateChildOrder: typeof LEADERBOARD_TEMPLATE_CHILD_ORDER;
  readonly viewport: LeaderboardViewport;
}

export const LEADERBOARD_INFERRED_CENTER_ANCHOR: LeaderboardAnchor = Object.freeze({
  evidence: 'inferred-legacy-default',
  x: HALF,
  y: HALF,
});

export const LEADERBOARD_TITLE_ANCHOR: LeaderboardAnchor = Object.freeze({
  evidence: 'recovered-setter',
  x: HALF,
  y: Math.fround(1),
});

export const LEADERBOARD_SCORE_ANCHOR: LeaderboardAnchor = Object.freeze({
  evidence: 'recovered-setter',
  x: Math.fround(1.25),
  y: Math.fround(-0.75),
});

export const LEADERBOARD_PLAYER_LABEL_TEXTS = Object.freeze([
  'Player 1',
  'Player 2',
  'Player 3',
] as const);

export const LEADERBOARD_PLAYER_COLORS: readonly LeaderboardRgb[] = deepFreeze([
  { b: 0, g: 0, r: 255 },
  { b: 255, g: 128, r: 0 },
  { b: 0, g: 185, r: 0 },
]);

export const LEADERBOARD_SCORE_COLORS: readonly LeaderboardRgb[] = deepFreeze([
  { b: 0, g: 0, r: 128 },
  { b: 128, g: 56, r: 0 },
  { b: 0, g: 28, r: 0 },
]);

export const LEADERBOARD_ROOT_CHILD_ORDER = deepFreeze([
  {
    child: 'gestures-layer' as const,
    insertion: 1 as const,
    visible: false as const,
    zOrder: LEADERBOARD_GESTURES_DEFAULT_Z_ORDER,
  },
  {
    child: 'title' as const,
    insertion: 2 as const,
    visible: true as const,
    zOrder: LEADERBOARD_ROOT_Z_ORDER,
  },
  {
    child: 'back-menu' as const,
    insertion: 3 as const,
    visible: true as const,
    zOrder: LEADERBOARD_ROOT_Z_ORDER,
  },
  {
    child: 'classic-card' as const,
    insertion: 4 as const,
    visible: true as const,
    zOrder: LEADERBOARD_ROOT_Z_ORDER,
  },
  {
    child: 'crazy-card' as const,
    insertion: 5 as const,
    visible: true as const,
    zOrder: LEADERBOARD_ROOT_Z_ORDER,
  },
  {
    child: 'gn-style-card' as const,
    insertion: 6 as const,
    visible: true as const,
    zOrder: LEADERBOARD_ROOT_Z_ORDER,
  },
  {
    child: 'classic-bird-card' as const,
    insertion: 7 as const,
    visible: true as const,
    zOrder: LEADERBOARD_ROOT_Z_ORDER,
  },
  {
    child: 'crazy-bird-card' as const,
    insertion: 8 as const,
    visible: true as const,
    zOrder: LEADERBOARD_ROOT_Z_ORDER,
  },
  {
    child: 'combo-bird-card' as const,
    insertion: 9 as const,
    visible: true as const,
    zOrder: LEADERBOARD_ROOT_Z_ORDER,
  },
]);

export const LEADERBOARD_CARD_CHILD_ORDER = deepFreeze([
  { child: 'template' as const, insertion: 1 as const, zOrder: 0 as const },
  { child: 'header' as const, insertion: 2 as const, zOrder: 0 as const },
]);

export const LEADERBOARD_TEMPLATE_CHILD_ORDER = deepFreeze([
  { child: 'player-1' as const, insertion: 1 as const, zOrder: 1 as const },
  { child: 'player-2' as const, insertion: 2 as const, zOrder: 1 as const },
  { child: 'player-3' as const, insertion: 3 as const, zOrder: 1 as const },
  { child: 'score-1' as const, insertion: 4 as const, zOrder: 1 as const },
  { child: 'score-2' as const, insertion: 5 as const, zOrder: 1 as const },
  { child: 'score-3' as const, insertion: 6 as const, zOrder: 1 as const },
]);

/** Pure immutable layout for the recovered six-card Leaderboard screen. */
export function createLeaderboardPresentation(
  assetTree: ClassicAssetTree,
  viewport: LeaderboardViewport,
  boards: LeaderboardBoardsSnapshot,
): LeaderboardPresentationSnapshot {
  const resources = getLeaderboardRasterResources(assetTree);
  const copiedViewport = copyViewport(viewport);
  const copiedBoards = copyBoards(boards);
  const title = createTitle(resources, copiedViewport);
  const back = createBack(resources, copiedViewport);
  const cards = copiedBoards.map((board) => createCard(
    board,
    resources,
    copiedViewport,
  ));
  if (cards.length !== LEADERBOARD_MODE_COUNT) {
    throw new Error(`Leaderboard presentation must contain ${LEADERBOARD_MODE_COUNT} cards`);
  }

  return deepFreeze({
    assetTree,
    audio: {
      back: {
        canonicalPath: LEADERBOARD_BACK_AUDIO_CANONICAL_PATH,
        effectsGated: true as const,
        loop: false as const,
        timing: 'after-main-menu-attachment' as const,
      },
    },
    boards: copiedBoards,
    cardChildOrder: LEADERBOARD_CARD_CHILD_ORDER,
    cards,
    ownedRootOrder: LEADERBOARD_ROOT_CHILD_ORDER,
    rootZOrder: LEADERBOARD_ROOT_Z_ORDER,
    shell: { back, title },
    templateChildOrder: LEADERBOARD_TEMPLATE_CHILD_ORDER,
    viewport: copiedViewport,
  });
}

function createTitle(
  resources: LeaderboardRasterProfile,
  viewport: LeaderboardViewport,
): LeaderboardTitlePresentation {
  const finalPosition = point(
    viewport.visibleRect.center.x,
    viewport.visibleRect.top.y,
  );
  const initialPosition = point(
    finalPosition.x,
    addFloat32(finalPosition.y, resources.title.dimensions.height),
  );
  return deepFreeze({
    actions: [moveTo(LEADERBOARD_ENTRY_SECONDS, finalPosition)],
    actionsRunConcurrently: false as const,
    anchor: LEADERBOARD_TITLE_ANCHOR,
    attachmentInsertion: 2 as const,
    fadeActionPresent: false as const,
    finalPosition,
    initialPosition,
    resource: resources.title,
    rotationActionPresent: false as const,
    zOrder: LEADERBOARD_ROOT_Z_ORDER,
  });
}

function createBack(
  resources: LeaderboardRasterProfile,
  viewport: LeaderboardViewport,
): LeaderboardBackPresentation {
  const normalWidth = resources.back.normal.dimensions.width;
  const normalHeight = resources.back.normal.dimensions.height;
  const initialPosition = point(
    subtractFloat32(
      viewport.visibleRect.left.x,
      multiplyFloat32(HALF, normalWidth),
    ),
    addFloat32(
      viewport.visibleRect.bottom.y,
      multiplyFloat32(HALF, normalHeight),
    ),
  );
  const moveDelta = point(normalWidth, 0);
  return deepFreeze({
    actions: [
      rotateBy(LEADERBOARD_ENTRY_SECONDS, LEADERBOARD_BACK_ROTATION_DEGREES),
      moveBy(LEADERBOARD_ENTRY_SECONDS, moveDelta),
    ],
    actionsRunConcurrently: true as const,
    anchor: LEADERBOARD_INFERRED_CENTER_ANCHOR,
    attachmentInsertion: 3 as const,
    backKeyDelegatesToSameCallback: true as const,
    disabledResource: null,
    fadeActionPresent: false as const,
    finalPosition: point(
      addFloat32(initialPosition.x, normalWidth),
      initialPosition.y,
    ),
    initialPosition,
    itemCount: 1 as const,
    menuPosition: point(0, 0),
    resources: resources.back,
    zOrder: LEADERBOARD_ROOT_Z_ORDER,
  });
}

function createCard(
  board: LeaderboardBoardSnapshot,
  resources: LeaderboardRasterProfile,
  viewport: LeaderboardViewport,
): LeaderboardCardPresentation {
  const templateWidth = resources.template.dimensions.width;
  const templateHeight = resources.template.dimensions.height;
  const localLabelX = multiplyFloat32(LABEL_X_FACTOR, templateWidth);
  const playerPointSize = multiplyFloat32(
    divideFloat32(viewport.logicalWidth, PLAYER_REFERENCE_WIDTH),
    PLAYER_BASE_POINT_SIZE,
  );
  const scorePointSize = multiplyFloat32(
    divideFloat32(viewport.logicalWidth, PLAYER_REFERENCE_WIDTH),
    SCORE_BASE_POINT_SIZE,
  );
  const rowPositions = ROW_Y_FACTORS.map((rowYFactor) => point(
    localLabelX,
    multiplyFloat32(rowYFactor, templateHeight),
  ));
  const playerLabels = board.values.map((_, index) => {
    const rank = (index + 1) as LeaderboardRank;
    return deepFreeze({
      anchor: LEADERBOARD_INFERRED_CENTER_ANCHOR,
      attachmentInsertion: (index + 1) as 1 | 2 | 3,
      colorRgb: requireArrayValue(
        LEADERBOARD_PLAYER_COLORS,
        index,
        'player colors',
      ),
      entryActions: EMPTY_ACTIONS,
      fontCanonicalPath: LEADERBOARD_PLAYER_FONT_CANONICAL_PATH,
      fontPointSize: playerPointSize,
      localPosition: requireArrayValue(rowPositions, index, 'row positions'),
      rank,
      text: requireArrayValue(
        LEADERBOARD_PLAYER_LABEL_TEXTS,
        index,
        'player label texts',
      ),
      zOrder: LEADERBOARD_ROOT_Z_ORDER,
    });
  });
  const scoreLabels = board.values.map((value, index) => {
    const rank = (index + 1) as LeaderboardRank;
    return deepFreeze({
      anchor: LEADERBOARD_SCORE_ANCHOR,
      attachmentInsertion: (index + 4) as 4 | 5 | 6,
      colorRgb: requireArrayValue(
        LEADERBOARD_SCORE_COLORS,
        index,
        'score colors',
      ),
      entryActions: EMPTY_ACTIONS,
      fontCanonicalPath: LEADERBOARD_SCORE_FONT_CANONICAL_PATH,
      fontPointSize: scorePointSize,
      format: LEADERBOARD_SCORE_FORMAT,
      localPosition: requireArrayValue(rowPositions, index, 'row positions'),
      rank,
      text: formatSignedInt32(value),
      value,
      zOrder: LEADERBOARD_ROOT_Z_ORDER,
    });
  });

  return deepFreeze({
    attachmentInsertion: board.index + 4,
    header: {
      anchor: LEADERBOARD_INFERRED_CENTER_ANCHOR,
      attachmentInsertion: 2 as const,
      entryActions: EMPTY_ACTIONS,
      localPosition: point(
        0,
        multiplyFloat32(
          multiplyFloat32(templateHeight, HEADER_Y_FACTOR),
          HALF,
        ),
      ),
      resource: headerForMode(resources, board.modeId),
      zOrder: 0 as const,
    },
    index: board.index,
    localChildOrder: LEADERBOARD_CARD_CHILD_ORDER,
    modeId: board.modeId,
    rootPosition: point(
      multiplyFloat32(
        Math.fround(board.index + HALF),
        viewport.logicalWidth,
      ),
      multiplyFloat32(ITEM_Y_FACTOR, viewport.logicalHeight),
    ),
    template: {
      anchor: LEADERBOARD_INFERRED_CENTER_ANCHOR,
      attachmentInsertion: 1 as const,
      childOrder: LEADERBOARD_TEMPLATE_CHILD_ORDER,
      entryActions: EMPTY_ACTIONS,
      localPosition: point(0, 0),
      playerLabels,
      resource: resources.template,
      scoreLabels,
      zOrder: 0 as const,
    },
    values: board.values,
    zOrder: LEADERBOARD_ROOT_Z_ORDER,
  });
}

function headerForMode(
  resources: LeaderboardRasterProfile,
  modeId: LeaderboardModeId,
): ClassicRasterResource {
  switch (modeId) {
    case 'classic':
      return resources.headers.classic;
    case 'crazy':
      return resources.headers.crazy;
    case 'gn-style':
      return resources.headers.gnStyle;
    case 'classic-bird':
      return resources.headers.classicBird;
    case 'crazy-bird':
      return resources.headers.crazyBird;
    case 'combo-bird':
      return resources.headers.comboBird;
  }
}

function copyBoards(boards: LeaderboardBoardsSnapshot): LeaderboardBoardsSnapshot {
  if (!Array.isArray(boards) || boards.length !== LEADERBOARD_MODE_COUNT) {
    throw new RangeError(
      `boards must contain exactly ${LEADERBOARD_MODE_COUNT} entries`,
    );
  }
  const keys = Object.keys(boards);
  if (
    keys.length !== LEADERBOARD_MODE_COUNT
    || LEADERBOARD_NATIVE_MODE_ORDER.some((_, index) => keys.indexOf(`${index}`) < 0)
  ) {
    throw new RangeError('boards must be a dense six-entry array without extra fields');
  }
  return Object.freeze([
    copyBoard(boards[0], 0, 'classic'),
    copyBoard(boards[1], 1, 'crazy'),
    copyBoard(boards[2], 2, 'gn-style'),
    copyBoard(boards[3], 3, 'classic-bird'),
    copyBoard(boards[4], 4, 'crazy-bird'),
    copyBoard(boards[5], 5, 'combo-bird'),
  ]);
}

function copyBoard<
  Index extends LeaderboardIndex,
  ModeId extends LeaderboardModeId,
>(
  candidate: unknown,
  expectedIndex: Index,
  expectedModeId: ModeId,
): Readonly<LeaderboardBoardSnapshot & {
  readonly index: Index;
  readonly modeId: ModeId;
}> {
  assertExactObject(candidate, BOARD_KEYS, `boards[${expectedIndex}]`);
  if (candidate.index !== expectedIndex || candidate.modeId !== expectedModeId) {
    throw new RangeError(
      `boards[${expectedIndex}] must map index ${expectedIndex} to ${expectedModeId}`,
    );
  }
  const values = copyPanelValues(
    candidate.values,
    `boards[${expectedIndex}].values`,
  );
  return Object.freeze({
    index: expectedIndex,
    modeId: expectedModeId,
    values,
  });
}

function copyPanelValues(candidate: unknown, label: string): LeaderboardPanelValues {
  if (!Array.isArray(candidate) || candidate.length !== 3) {
    throw new RangeError(`${label} must contain exactly three scores`);
  }
  const keys = Object.keys(candidate);
  if (
    keys.length !== 3
    || keys.indexOf('0') < 0
    || keys.indexOf('1') < 0
    || keys.indexOf('2') < 0
  ) {
    throw new RangeError(`${label} must be a dense three-score array`);
  }
  const first = candidate[0];
  const second = candidate[1];
  const third = candidate[2];
  assertSignedInt32(first, `${label}[0]`);
  assertSignedInt32(second, `${label}[1]`);
  assertSignedInt32(third, `${label}[2]`);
  if (first < second || second < third) {
    throw new RangeError(`${label} must be ordered from highest to lowest`);
  }
  return Object.freeze([first, second, third]);
}

function copyViewport(viewport: LeaderboardViewport): LeaderboardViewport {
  if (viewport === null || typeof viewport !== 'object' || Array.isArray(viewport)) {
    throw new TypeError('viewport must be an object');
  }
  const logicalWidth = positiveFiniteFloat32(
    viewport.logicalWidth,
    'viewport.logicalWidth',
  );
  const logicalHeight = positiveFiniteFloat32(
    viewport.logicalHeight,
    'viewport.logicalHeight',
  );
  if (
    viewport.visibleRect === null
    || typeof viewport.visibleRect !== 'object'
    || Array.isArray(viewport.visibleRect)
  ) {
    throw new TypeError('viewport.visibleRect must be an object');
  }
  return deepFreeze({
    logicalHeight,
    logicalWidth,
    visibleRect: {
      bottom: copyPoint(viewport.visibleRect.bottom, 'viewport.visibleRect.bottom'),
      center: copyPoint(viewport.visibleRect.center, 'viewport.visibleRect.center'),
      left: copyPoint(viewport.visibleRect.left, 'viewport.visibleRect.left'),
      right: copyPoint(viewport.visibleRect.right, 'viewport.visibleRect.right'),
      top: copyPoint(viewport.visibleRect.top, 'viewport.visibleRect.top'),
    },
  });
}

function copyPoint(candidate: unknown, label: string): LeaderboardPoint {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new TypeError(`${label} must be an object`);
  }
  const pointValue = candidate as Readonly<{ readonly x?: unknown; readonly y?: unknown }>;
  return point(
    finiteFloat32(pointValue.x, `${label}.x`),
    finiteFloat32(pointValue.y, `${label}.y`),
  );
}

function moveTo(
  durationSeconds: number,
  target: LeaderboardPoint,
): LeaderboardMoveToAction {
  return deepFreeze({
    durationSeconds: finiteFloat32(durationSeconds, 'move durationSeconds'),
    easing: null,
    target,
    type: 'move-to' as const,
  });
}

function moveBy(
  durationSeconds: number,
  delta: LeaderboardPoint,
): LeaderboardMoveByAction {
  return deepFreeze({
    delta,
    durationSeconds: finiteFloat32(durationSeconds, 'move durationSeconds'),
    easing: null,
    type: 'move-by' as const,
  });
}

function rotateBy(
  durationSeconds: number,
  deltaDegrees: number,
): LeaderboardRotateByAction {
  return Object.freeze({
    deltaDegrees: finiteFloat32(deltaDegrees, 'rotation deltaDegrees'),
    durationSeconds: finiteFloat32(durationSeconds, 'rotation durationSeconds'),
    easing: null,
    type: 'rotate-by',
  });
}

function point(x: number, y: number): LeaderboardPoint {
  return Object.freeze({
    x: finiteFloat32(x, 'point.x'),
    y: finiteFloat32(y, 'point.y'),
  });
}

function assertExactObject(
  candidate: unknown,
  expectedKeys: readonly string[],
  label: string,
): asserts candidate is Record<string, unknown> {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new TypeError(`${label} must be an object`);
  }
  const keys = Object.keys(candidate);
  if (
    keys.length !== expectedKeys.length
    || expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(candidate, key))
  ) {
    throw new RangeError(`${label} must contain exactly ${expectedKeys.join(', ')}`);
  }
}

function formatSignedInt32(value: number): string {
  assertSignedInt32(value, 'score');
  return `${value}`;
}

function assertSignedInt32(value: unknown, label: string): asserts value is number {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < -0x8000_0000
    || value > 0x7fff_ffff
  ) {
    throw new RangeError(`${label} must be a signed 32-bit integer`);
  }
}

function requireArrayValue<T>(
  values: readonly T[],
  index: number,
  label: string,
): T {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`${label}[${index}] is unavailable`);
  }
  return value;
}

function positiveFiniteFloat32(value: unknown, label: string): number {
  const floatValue = finiteFloat32(value, label);
  if (floatValue <= 0) {
    throw new RangeError(`${label} must be positive in float32`);
  }
  return floatValue;
}

function finiteFloat32(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite in float32`);
  }
  const floatValue = Math.fround(value);
  if (!Number.isFinite(floatValue)) {
    throw new RangeError(`${label} must be finite in float32`);
  }
  return floatValue;
}

function addFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) + Math.fround(right));
}

function subtractFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) - Math.fround(right));
}

function multiplyFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) * Math.fround(right));
}

function divideFloat32(numerator: number, denominator: number): number {
  return Math.fround(Math.fround(numerator) / Math.fround(denominator));
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      deepFreeze(record[key]);
    }
    Object.freeze(value);
  }
  return value;
}
