import type { ObjectiveDefinition } from './objectives-manager-state';
import {
  OBJECTIVES_COUNT,
  objectiveDefinitionAt,
  objectiveRewardText,
} from './objectives-manager-state';
import type {
  ObjectivesScreenRasterProfile,
  ObjectivesScreenRasterResource,
  ObjectivesScreenTwoFrameRasterSet,
} from './objectives-screen-resource-contract';
import {
  OBJECTIVES_SCREEN_BACK_AUDIO_CANONICAL_PATH,
  OBJECTIVES_SCREEN_FONT_CANONICAL_PATH,
  OBJECTIVES_SCREEN_SKIP_AUDIO_CANONICAL_PATH,
  getObjectivesScreenRasterResources,
} from './objectives-screen-resource-contract';
import type {
  ObjectivesScreenCurrentCardSnapshot,
  ObjectivesScreenListMetrics,
  ObjectivesScreenRowSnapshot,
  ObjectivesScreenStateSnapshot,
  ObjectivesScreenViewedSequencePosition,
} from './objectives-screen-state';
import type { ClassicAssetTree } from './resolution-profile-service';

export const OBJECTIVES_SCREEN_ROOT_Z_ORDER = 1 as const;
export const OBJECTIVES_SCREEN_ITEM_CHILD_Z_ORDER = 1 as const;
export const OBJECTIVES_SCREEN_ENTRY_SECONDS = Math.fround(1);
export const OBJECTIVES_SCREEN_BACK_ROTATION_DEGREES = Math.fround(360);
export const OBJECTIVES_SCREEN_REWARD_FORMAT = 'reward: %d coins' as const;

const HALF = Math.fround(0.5);
const QUARTER = Math.fround(0.25);
const EIGHTH = Math.fround(0.125);
const ROW_SPACING_FACTOR = Math.fround(1.25);
const TOP_HEADER_FACTOR = float32FromBits(0x3f8c_cccd);
const BOTTOM_FOOTER_FACTOR = float32FromBits(0x3f86_6666);
const FIXED_CURRENT_Y_FACTOR = float32FromBits(0x3e19_999a);
const SKIP_Y_FACTOR = float32FromBits(0x3d4c_cccd);
const DESCRIPTION_WIDTH_DIVISOR = Math.fround(3.5);
const FONT_REFERENCE_WIDTH = Math.fround(400);
const DESCRIPTION_BASE_POINT_SIZE = Math.fround(18);
const REWARD_BASE_POINT_SIZE = Math.fround(20);
const BACK_Y_DIVISOR = Math.fround(2.5);
const SKIP_TARGET_HALF_MULTIPLIER = Math.fround(1.5);
const STATE_KEYS = Object.freeze([
  'currentCard',
  'initialBaseY',
  'listMetrics',
  'rows',
  'viewedSequencePosition',
] as const);
const CURRENT_CARD_KEYS = Object.freeze([
  'customBackground',
  'labelsFinishedAtConstruction',
  'objective',
] as const);
const ROW_KEYS = Object.freeze([
  'finished',
  'labelsFinishedAtConstruction',
  'objective',
  'y',
] as const);
const OBJECTIVE_KEYS = Object.freeze([
  'description',
  'id',
  'rewardCoins',
  'sequencePosition',
  'target',
] as const);
const METRICS_KEYS = Object.freeze([
  'bottomBound',
  'logicalHeight',
  'rowSpacing',
  'topBound',
] as const);
const VIEWPORT_KEYS = Object.freeze([
  'logicalHeight',
  'logicalWidth',
  'visibleRect',
] as const);
const VISIBLE_RECT_KEYS = Object.freeze([
  'bottom',
  'center',
  'left',
  'right',
  'top',
] as const);
const POINT_KEYS = Object.freeze(['x', 'y'] as const);
const EMPTY_ACTIONS = Object.freeze([] as const);

export interface ObjectivesScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface ObjectivesScreenVisibleRect {
  readonly bottom: ObjectivesScreenPoint;
  readonly center: ObjectivesScreenPoint;
  readonly left: ObjectivesScreenPoint;
  readonly right: ObjectivesScreenPoint;
  readonly top: ObjectivesScreenPoint;
}

export interface ObjectivesScreenViewport {
  /** Raw logical director height H. */
  readonly logicalHeight: number;
  /** Raw logical director width W. */
  readonly logicalWidth: number;
  readonly visibleRect: ObjectivesScreenVisibleRect;
}

export interface ObjectivesScreenAnchor {
  readonly evidence: 'inferred-legacy-default' | 'recovered-setter';
  readonly x: number;
  readonly y: number;
}

export interface ObjectivesScreenRgb {
  readonly b: number;
  readonly g: number;
  readonly r: number;
}

export interface ObjectivesScreenFadeInAction {
  readonly durationSeconds: number;
  readonly easing: null;
  readonly type: 'fade-in';
}

export interface ObjectivesScreenMoveToAction {
  readonly durationSeconds: number;
  readonly easing: null;
  readonly target: ObjectivesScreenPoint;
  readonly type: 'move-to';
}

export interface ObjectivesScreenMoveByAction {
  readonly delta: ObjectivesScreenPoint;
  readonly durationSeconds: number;
  readonly easing: null;
  readonly type: 'move-by';
}

export interface ObjectivesScreenRotateByAction {
  readonly deltaDegrees: number;
  readonly durationSeconds: number;
  readonly easing: null;
  readonly type: 'rotate-by';
}

export interface ObjectivesScreenFadingSpritePresentation {
  readonly actions: readonly [ObjectivesScreenFadeInAction];
  readonly anchor: ObjectivesScreenAnchor;
  readonly attachmentInsertion: 1 | 54 | 55;
  readonly position: ObjectivesScreenPoint;
  readonly resource: ObjectivesScreenRasterResource;
  readonly zOrder: 1;
}

export interface ObjectivesScreenLabelPresentation {
  readonly anchor: ObjectivesScreenAnchor;
  readonly attachmentInsertion: 2 | 3;
  readonly colorRgb: ObjectivesScreenRgb;
  readonly fontCanonicalPath: typeof OBJECTIVES_SCREEN_FONT_CANONICAL_PATH;
  readonly fontPointSize: number;
  readonly position: ObjectivesScreenPoint;
  readonly text: string;
  readonly zOrder: 1;
}

export interface ObjectivesScreenObjectiveItemPresentation {
  readonly attachmentInsertion: number;
  readonly background: Readonly<{
    readonly anchor: ObjectivesScreenAnchor;
    readonly attachmentInsertion: 1;
    readonly position: ObjectivesScreenPoint;
    readonly resource: ObjectivesScreenRasterResource;
    readonly zOrder: 1;
  }>;
  readonly childOrder: typeof OBJECTIVES_SCREEN_ITEM_CHILD_ORDER;
  readonly description: ObjectivesScreenLabelPresentation;
  readonly entryActions: readonly [];
  readonly finished: boolean;
  readonly labelsFinishedAtConstruction: boolean;
  readonly objective: ObjectiveDefinition;
  readonly reward: ObjectivesScreenLabelPresentation;
  readonly zOrder: 1;
}

export interface ObjectivesScreenFixedCurrentPresentation
  extends ObjectivesScreenObjectiveItemPresentation {
  readonly attachmentInsertion: 56;
  readonly customBackground: true;
}

export interface ObjectivesScreenBackPresentation {
  readonly actions: readonly [
    ObjectivesScreenRotateByAction,
    ObjectivesScreenMoveByAction,
  ];
  readonly actionsRunConcurrently: true;
  readonly finalPosition: ObjectivesScreenPoint;
  readonly initialPosition: ObjectivesScreenPoint;
  readonly layoutUsesNormalFrameSize: true;
  readonly resources: ObjectivesScreenTwoFrameRasterSet;
}

export interface ObjectivesScreenSkipPresentation {
  readonly actions: readonly [ObjectivesScreenMoveToAction];
  readonly actionsRunConcurrently: false;
  readonly finalPosition: ObjectivesScreenPoint;
  readonly initialPosition: ObjectivesScreenPoint;
  readonly resources: ObjectivesScreenTwoFrameRasterSet;
}

export interface ObjectivesScreenMenuPresentation {
  readonly attachmentInsertion: 57;
  readonly back: ObjectivesScreenBackPresentation;
  readonly childOrder: typeof OBJECTIVES_SCREEN_MENU_CHILD_ORDER;
  readonly position: ObjectivesScreenPoint;
  readonly skip: ObjectivesScreenSkipPresentation;
  readonly zOrder: 1;
}

export interface ObjectivesScreenRootOrderEntry {
  readonly child:
    | 'background'
    | 'fixed-current-item'
    | 'footer'
    | 'header'
    | 'menu'
    | `objective-row-${number}`;
  readonly insertion: number;
  readonly zOrder: 1;
}

export interface ObjectivesScreenPresentationSnapshot {
  readonly assetTree: ClassicAssetTree;
  readonly audio: Readonly<{
    readonly hardwareBack: Readonly<{
      readonly audioRequested: false;
      readonly delegatesToVisibleBackNavigation: true;
    }>;
    readonly skip: Readonly<{
      readonly audioRequested: true;
      readonly canonicalPath: typeof OBJECTIVES_SCREEN_SKIP_AUDIO_CANONICAL_PATH;
      readonly effectsGated: true;
      readonly loop: false;
      readonly timing: 'before-manager-skip';
    }>;
    readonly visibleBack: Readonly<{
      readonly audioRequested: true;
      readonly canonicalPath: typeof OBJECTIVES_SCREEN_BACK_AUDIO_CANONICAL_PATH;
      readonly effectsGated: true;
      readonly loop: false;
      readonly timing: 'before-navigation';
    }>;
  }>;
  readonly background: ObjectivesScreenFadingSpritePresentation;
  readonly clipping: Readonly<{
    readonly mask: false;
    readonly scissor: false;
    readonly stencil: false;
  }>;
  readonly fixedCurrent: ObjectivesScreenFixedCurrentPresentation;
  readonly footer: ObjectivesScreenFadingSpritePresentation;
  readonly header: ObjectivesScreenFadingSpritePresentation;
  readonly interaction: Readonly<{
    readonly drag: Readonly<{
      readonly clamp: false;
      readonly inertia: false;
      readonly movementFormula: 'movementY = -deltaY';
      readonly snap: false;
    }>;
    readonly skip: Readonly<{
      readonly preservesLabelColors: true;
      readonly preservesRowPositions: true;
      readonly refreshesFixedCurrentText: true;
      readonly refreshesRowBackgroundCompletion: true;
      readonly target: 'authoritative-active-objective';
    }>;
  }>;
  readonly listMetrics: ObjectivesScreenListMetrics;
  readonly menu: ObjectivesScreenMenuPresentation;
  readonly navigation: Readonly<{
    readonly hardwareBack: typeof OBJECTIVES_SCREEN_BACK_NAVIGATION_STEPS;
    readonly visibleBack: typeof OBJECTIVES_SCREEN_BACK_NAVIGATION_STEPS;
  }>;
  readonly ownedRootOrder: readonly ObjectivesScreenRootOrderEntry[];
  readonly probeReads: typeof OBJECTIVES_SCREEN_PROBE_READS;
  readonly rootZOrder: 1;
  readonly rows: readonly ObjectivesScreenObjectiveItemPresentation[];
  readonly state: ObjectivesScreenStateSnapshot;
  readonly viewport: ObjectivesScreenViewport;
}

export const OBJECTIVES_SCREEN_INFERRED_CENTER_ANCHOR:
ObjectivesScreenAnchor = Object.freeze({
  evidence: 'inferred-legacy-default',
  x: HALF,
  y: HALF,
});

export const OBJECTIVES_SCREEN_LABEL_ANCHOR:
ObjectivesScreenAnchor = Object.freeze({
  evidence: 'recovered-setter',
  x: 0,
  y: HALF,
});

export const OBJECTIVES_SCREEN_FINISHED_DESCRIPTION_COLOR:
ObjectivesScreenRgb = Object.freeze({ b: 226, g: 171, r: 41 });
export const OBJECTIVES_SCREEN_FINISHED_REWARD_COLOR:
ObjectivesScreenRgb = Object.freeze({ b: 33, g: 238, r: 252 });
export const OBJECTIVES_SCREEN_UNFINISHED_DESCRIPTION_COLOR:
ObjectivesScreenRgb = Object.freeze({ b: 179, g: 179, r: 179 });
export const OBJECTIVES_SCREEN_UNFINISHED_REWARD_COLOR:
ObjectivesScreenRgb = Object.freeze({ b: 255, g: 255, r: 255 });

export const OBJECTIVES_SCREEN_ITEM_CHILD_ORDER = deepFreeze([
  { child: 'background' as const, insertion: 1 as const, zOrder: 1 as const },
  { child: 'description' as const, insertion: 2 as const, zOrder: 1 as const },
  { child: 'reward' as const, insertion: 3 as const, zOrder: 1 as const },
]);

export const OBJECTIVES_SCREEN_MENU_CHILD_ORDER = deepFreeze([
  { child: 'back' as const, insertion: 1 as const },
  { child: 'skip' as const, insertion: 2 as const },
]);

export const OBJECTIVES_SCREEN_BACK_NAVIGATION_STEPS = Object.freeze([
  'stop-layer-actions',
  'remove-objectives-layer',
  'create-main-menu-layer',
  'attach-main-menu-layer-z-1',
] as const);

export const OBJECTIVES_SCREEN_PROBE_READS = deepFreeze([
  {
    attachedVisibleInstanceAlsoCreated: true as const,
    resource: 'Objectives/objectives-next.png' as const,
    role: 'row-height-spacing-and-bounds' as const,
    unattachedProbeInstance: true as const,
  },
  {
    attachedVisibleInstanceAlsoCreated: true as const,
    resource: 'Objectives/objectives-objectives-background.png' as const,
    role: 'top-list-bound' as const,
    unattachedProbeInstance: true as const,
  },
  {
    attachedVisibleInstanceAlsoCreated: true as const,
    resource: 'Objectives/objectives-next-background.png' as const,
    role: 'bottom-list-bound' as const,
    unattachedProbeInstance: true as const,
  },
]);

/**
 * Computes the probe-derived list metrics needed by ObjectivesScreenState.
 * Callers pass the returned immutable object directly into that state model.
 */
export function createObjectivesScreenListMetrics(
  assetTree: ClassicAssetTree,
  viewport: ObjectivesScreenViewport,
): ObjectivesScreenListMetrics {
  const resources = getObjectivesScreenRasterResources(assetTree);
  const copiedViewport = copyViewport(viewport);
  return createListMetrics(resources, copiedViewport);
}

/** Pure immutable layout contract for the recovered Objectives screen. */
export function createObjectivesScreenPresentation(
  assetTree: ClassicAssetTree,
  viewport: ObjectivesScreenViewport,
  state: ObjectivesScreenStateSnapshot,
): ObjectivesScreenPresentationSnapshot {
  const resources = getObjectivesScreenRasterResources(assetTree);
  const copiedViewport = copyViewport(viewport);
  const listMetrics = createListMetrics(resources, copiedViewport);
  const copiedState = copyState(state, listMetrics);
  const rows = copiedState.rows.map((row, sequencePosition) => createObjectiveItem(
    row,
    sequencePosition + 2,
    copiedViewport.visibleRect.center.x,
    resources.ordinaryRows[row.finished ? 'finished' : 'unfinished'],
    copiedViewport.logicalWidth,
  ));
  if (rows.length !== OBJECTIVES_COUNT) {
    throw new Error(`Objectives presentation must contain ${OBJECTIVES_COUNT} rows`);
  }
  const background = fadingSprite(
    1,
    copiedViewport.visibleRect.center,
    resources.background,
  );
  const header = fadingSprite(
    54,
    point(
      copiedViewport.visibleRect.center.x,
      subtractFloat32(
        copiedViewport.visibleRect.top.y,
        multiplyFloat32(HALF, resources.header.dimensions.height),
      ),
    ),
    resources.header,
  );
  const footer = fadingSprite(
    55,
    point(
      copiedViewport.visibleRect.center.x,
      addFloat32(
        copiedViewport.visibleRect.bottom.y,
        multiplyFloat32(HALF, resources.footer.dimensions.height),
      ),
    ),
    resources.footer,
  );
  const fixedPosition = point(
    multiplyFloat32(HALF, copiedViewport.logicalWidth),
    multiplyFloat32(FIXED_CURRENT_Y_FACTOR, copiedViewport.logicalHeight),
  );
  const fixedCurrent = createFixedCurrentItem(
    copiedState.currentCard,
    fixedPosition,
    resources.fixedCurrentRow,
    copiedViewport.logicalWidth,
  );
  const menu = createMenu(resources, copiedViewport);
  const ownedRootOrder = createRootOrder();

  return deepFreeze({
    assetTree,
    audio: {
      hardwareBack: {
        audioRequested: false as const,
        delegatesToVisibleBackNavigation: true as const,
      },
      skip: {
        audioRequested: true as const,
        canonicalPath: OBJECTIVES_SCREEN_SKIP_AUDIO_CANONICAL_PATH,
        effectsGated: true as const,
        loop: false as const,
        timing: 'before-manager-skip' as const,
      },
      visibleBack: {
        audioRequested: true as const,
        canonicalPath: OBJECTIVES_SCREEN_BACK_AUDIO_CANONICAL_PATH,
        effectsGated: true as const,
        loop: false as const,
        timing: 'before-navigation' as const,
      },
    },
    background,
    clipping: {
      mask: false as const,
      scissor: false as const,
      stencil: false as const,
    },
    fixedCurrent,
    footer,
    header,
    interaction: {
      drag: {
        clamp: false as const,
        inertia: false as const,
        movementFormula: 'movementY = -deltaY' as const,
        snap: false as const,
      },
      skip: {
        preservesLabelColors: true as const,
        preservesRowPositions: true as const,
        refreshesFixedCurrentText: true as const,
        refreshesRowBackgroundCompletion: true as const,
        target: 'authoritative-active-objective' as const,
      },
    },
    listMetrics,
    menu,
    navigation: {
      hardwareBack: OBJECTIVES_SCREEN_BACK_NAVIGATION_STEPS,
      visibleBack: OBJECTIVES_SCREEN_BACK_NAVIGATION_STEPS,
    },
    ownedRootOrder,
    probeReads: OBJECTIVES_SCREEN_PROBE_READS,
    rootZOrder: OBJECTIVES_SCREEN_ROOT_Z_ORDER,
    rows,
    state: copiedState,
    viewport: copiedViewport,
  });
}

function createListMetrics(
  resources: ObjectivesScreenRasterProfile,
  viewport: ObjectivesScreenViewport,
): ObjectivesScreenListMetrics {
  const rowHeight = resources.fixedCurrentRow.dimensions.height;
  const topBound = subtractFloat32(
    subtractFloat32(
      viewport.visibleRect.top.y,
      multiplyFloat32(TOP_HEADER_FACTOR, resources.header.dimensions.height),
    ),
    multiplyFloat32(HALF, rowHeight),
  );
  const bottomBound = addFloat32(
    addFloat32(
      viewport.visibleRect.bottom.y,
      multiplyFloat32(BOTTOM_FOOTER_FACTOR, resources.footer.dimensions.height),
    ),
    multiplyFloat32(HALF, rowHeight),
  );
  if (bottomBound >= topBound) {
    throw new RangeError('probe-derived bottomBound must be below topBound');
  }
  return Object.freeze({
    bottomBound,
    logicalHeight: viewport.logicalHeight,
    rowSpacing: multiplyFloat32(ROW_SPACING_FACTOR, rowHeight),
    topBound,
  });
}

function createObjectiveItem(
  row: ObjectivesScreenRowSnapshot,
  attachmentInsertion: number,
  x: number,
  backgroundResource: ObjectivesScreenRasterResource,
  logicalWidth: number,
): ObjectivesScreenObjectiveItemPresentation {
  return objectiveItem(
    row.objective,
    row.finished,
    row.labelsFinishedAtConstruction,
    attachmentInsertion,
    point(x, row.y),
    backgroundResource,
    logicalWidth,
  );
}

function createFixedCurrentItem(
  currentCard: ObjectivesScreenCurrentCardSnapshot,
  position: ObjectivesScreenPoint,
  backgroundResource: ObjectivesScreenRasterResource,
  logicalWidth: number,
): ObjectivesScreenFixedCurrentPresentation {
  return deepFreeze({
    ...objectiveItem(
      currentCard.objective,
      false,
      currentCard.labelsFinishedAtConstruction,
      56,
      position,
      backgroundResource,
      logicalWidth,
    ),
    attachmentInsertion: 56 as const,
    customBackground: true as const,
  });
}

function objectiveItem(
  objective: ObjectiveDefinition,
  finished: boolean,
  labelsFinishedAtConstruction: boolean,
  attachmentInsertion: number,
  position: ObjectivesScreenPoint,
  backgroundResource: ObjectivesScreenRasterResource,
  logicalWidth: number,
): ObjectivesScreenObjectiveItemPresentation {
  const backgroundWidth = backgroundResource.dimensions.width;
  const backgroundHeight = backgroundResource.dimensions.height;
  const descriptionPosition = point(
    subtractFloat32(
      position.x,
      divideFloat32(backgroundWidth, DESCRIPTION_WIDTH_DIVISOR),
    ),
    addFloat32(
      position.y,
      multiplyFloat32(QUARTER, backgroundHeight),
    ),
  );
  const rewardPosition = point(
    subtractFloat32(
      position.x,
      multiplyFloat32(EIGHTH, backgroundWidth),
    ),
    subtractFloat32(
      position.y,
      multiplyFloat32(QUARTER, backgroundHeight),
    ),
  );
  return deepFreeze({
    attachmentInsertion,
    background: {
      anchor: OBJECTIVES_SCREEN_INFERRED_CENTER_ANCHOR,
      attachmentInsertion: 1 as const,
      position,
      resource: backgroundResource,
      zOrder: OBJECTIVES_SCREEN_ITEM_CHILD_Z_ORDER,
    },
    childOrder: OBJECTIVES_SCREEN_ITEM_CHILD_ORDER,
    description: {
      anchor: OBJECTIVES_SCREEN_LABEL_ANCHOR,
      attachmentInsertion: 2 as const,
      colorRgb: labelsFinishedAtConstruction
        ? OBJECTIVES_SCREEN_FINISHED_DESCRIPTION_COLOR
        : OBJECTIVES_SCREEN_UNFINISHED_DESCRIPTION_COLOR,
      fontCanonicalPath: OBJECTIVES_SCREEN_FONT_CANONICAL_PATH,
      fontPointSize: divideFloat32(
        multiplyFloat32(DESCRIPTION_BASE_POINT_SIZE, logicalWidth),
        FONT_REFERENCE_WIDTH,
      ),
      position: descriptionPosition,
      text: objective.description,
      zOrder: OBJECTIVES_SCREEN_ITEM_CHILD_Z_ORDER,
    },
    entryActions: EMPTY_ACTIONS,
    finished,
    labelsFinishedAtConstruction,
    objective,
    reward: {
      anchor: OBJECTIVES_SCREEN_LABEL_ANCHOR,
      attachmentInsertion: 3 as const,
      colorRgb: labelsFinishedAtConstruction
        ? OBJECTIVES_SCREEN_FINISHED_REWARD_COLOR
        : OBJECTIVES_SCREEN_UNFINISHED_REWARD_COLOR,
      fontCanonicalPath: OBJECTIVES_SCREEN_FONT_CANONICAL_PATH,
      fontPointSize: divideFloat32(
        multiplyFloat32(REWARD_BASE_POINT_SIZE, logicalWidth),
        FONT_REFERENCE_WIDTH,
      ),
      position: rewardPosition,
      text: objectiveRewardText(objective.rewardCoins),
      zOrder: OBJECTIVES_SCREEN_ITEM_CHILD_Z_ORDER,
    },
    zOrder: OBJECTIVES_SCREEN_ROOT_Z_ORDER,
  });
}

function fadingSprite(
  attachmentInsertion: 1 | 54 | 55,
  position: ObjectivesScreenPoint,
  resource: ObjectivesScreenRasterResource,
): ObjectivesScreenFadingSpritePresentation {
  return deepFreeze({
    actions: [fadeIn(OBJECTIVES_SCREEN_ENTRY_SECONDS)],
    anchor: OBJECTIVES_SCREEN_INFERRED_CENTER_ANCHOR,
    attachmentInsertion,
    position,
    resource,
    zOrder: OBJECTIVES_SCREEN_ROOT_Z_ORDER,
  });
}

function createMenu(
  resources: ObjectivesScreenRasterProfile,
  viewport: ObjectivesScreenViewport,
): ObjectivesScreenMenuPresentation {
  const backWidth = resources.back.normal.dimensions.width;
  const backHeight = resources.back.normal.dimensions.height;
  const backInitial = point(
    subtractFloat32(
      viewport.visibleRect.left.x,
      multiplyFloat32(HALF, backWidth),
    ),
    addFloat32(
      viewport.visibleRect.bottom.y,
      divideFloat32(backHeight, BACK_Y_DIVISOR),
    ),
  );
  const backMoveDelta = point(
    multiplyFloat32(BOTTOM_FOOTER_FACTOR, backWidth),
    0,
  );
  const skipWidth = resources.skip.normal.dimensions.width;
  const skipInitial = point(
    addFloat32(
      viewport.visibleRect.right.x,
      multiplyFloat32(HALF, skipWidth),
    ),
    multiplyFloat32(SKIP_Y_FACTOR, viewport.logicalHeight),
  );
  const skipFinal = point(
    subtractFloat32(
      viewport.visibleRect.right.x,
      multiplyFloat32(
        SKIP_TARGET_HALF_MULTIPLIER,
        multiplyFloat32(HALF, skipWidth),
      ),
    ),
    skipInitial.y,
  );
  return deepFreeze({
    attachmentInsertion: 57 as const,
    back: {
      actions: [
        rotateBy(
          OBJECTIVES_SCREEN_ENTRY_SECONDS,
          OBJECTIVES_SCREEN_BACK_ROTATION_DEGREES,
        ),
        moveBy(OBJECTIVES_SCREEN_ENTRY_SECONDS, backMoveDelta),
      ],
      actionsRunConcurrently: true as const,
      finalPosition: point(
        addFloat32(backInitial.x, backMoveDelta.x),
        backInitial.y,
      ),
      initialPosition: backInitial,
      layoutUsesNormalFrameSize: true as const,
      resources: resources.back,
    },
    childOrder: OBJECTIVES_SCREEN_MENU_CHILD_ORDER,
    position: point(0, 0),
    skip: {
      actions: [moveTo(OBJECTIVES_SCREEN_ENTRY_SECONDS, skipFinal)],
      actionsRunConcurrently: false as const,
      finalPosition: skipFinal,
      initialPosition: skipInitial,
      resources: resources.skip,
    },
    zOrder: OBJECTIVES_SCREEN_ROOT_Z_ORDER,
  });
}

function createRootOrder(): readonly ObjectivesScreenRootOrderEntry[] {
  return deepFreeze([
    {
      child: 'background' as const,
      insertion: 1,
      zOrder: OBJECTIVES_SCREEN_ROOT_Z_ORDER,
    },
    ...Array.from({ length: OBJECTIVES_COUNT }, (_, sequencePosition) => ({
      child: `objective-row-${sequencePosition}` as const,
      insertion: sequencePosition + 2,
      zOrder: OBJECTIVES_SCREEN_ROOT_Z_ORDER,
    })),
    {
      child: 'header' as const,
      insertion: 54,
      zOrder: OBJECTIVES_SCREEN_ROOT_Z_ORDER,
    },
    {
      child: 'footer' as const,
      insertion: 55,
      zOrder: OBJECTIVES_SCREEN_ROOT_Z_ORDER,
    },
    {
      child: 'fixed-current-item' as const,
      insertion: 56,
      zOrder: OBJECTIVES_SCREEN_ROOT_Z_ORDER,
    },
    {
      child: 'menu' as const,
      insertion: 57,
      zOrder: OBJECTIVES_SCREEN_ROOT_Z_ORDER,
    },
  ]);
}

function copyState(
  state: unknown,
  expectedMetrics: ObjectivesScreenListMetrics,
): ObjectivesScreenStateSnapshot {
  assertExactObject(state, STATE_KEYS, 'state');
  const listMetrics = copyMetrics(state.listMetrics, 'state.listMetrics');
  if (
    listMetrics.bottomBound !== expectedMetrics.bottomBound
    || listMetrics.logicalHeight !== expectedMetrics.logicalHeight
    || listMetrics.rowSpacing !== expectedMetrics.rowSpacing
    || listMetrics.topBound !== expectedMetrics.topBound
  ) {
    throw new RangeError(
      'state.listMetrics must match the selected resource profile and viewport',
    );
  }
  const initialBaseY = finiteFloat32(state.initialBaseY, 'state.initialBaseY');
  const viewedSequencePosition = copyViewedSequencePosition(
    state.viewedSequencePosition,
  );
  if (!Array.isArray(state.rows) || state.rows.length !== OBJECTIVES_COUNT) {
    throw new RangeError(`state.rows must contain exactly ${OBJECTIVES_COUNT} entries`);
  }
  assertDenseArray(state.rows, OBJECTIVES_COUNT, 'state.rows');
  const rows = Object.freeze(state.rows.map((candidate, sequencePosition) => (
    copyRow(candidate, sequencePosition)
  )));
  const currentCard = copyCurrentCard(state.currentCard);
  return deepFreeze({
    currentCard,
    initialBaseY,
    listMetrics,
    rows,
    viewedSequencePosition,
  });
}

function copyRow(
  candidate: unknown,
  expectedSequencePosition: number,
): ObjectivesScreenRowSnapshot {
  assertExactObject(
    candidate,
    ROW_KEYS,
    `state.rows[${expectedSequencePosition}]`,
  );
  if (
    typeof candidate.finished !== 'boolean'
    || typeof candidate.labelsFinishedAtConstruction !== 'boolean'
  ) {
    throw new TypeError(
      `state.rows[${expectedSequencePosition}] completion fields must be boolean`,
    );
  }
  return Object.freeze({
    finished: candidate.finished,
    labelsFinishedAtConstruction: candidate.labelsFinishedAtConstruction,
    objective: copyObjective(
      candidate.objective,
      expectedSequencePosition,
      `state.rows[${expectedSequencePosition}].objective`,
    ),
    y: finiteFloat32(candidate.y, `state.rows[${expectedSequencePosition}].y`),
  });
}

function copyCurrentCard(candidate: unknown): ObjectivesScreenCurrentCardSnapshot {
  assertExactObject(candidate, CURRENT_CARD_KEYS, 'state.currentCard');
  if (candidate.customBackground !== true) {
    throw new RangeError('state.currentCard.customBackground must be true');
  }
  if (typeof candidate.labelsFinishedAtConstruction !== 'boolean') {
    throw new TypeError(
      'state.currentCard.labelsFinishedAtConstruction must be boolean',
    );
  }
  const objectiveCandidate = candidate.objective;
  assertExactObject(objectiveCandidate, OBJECTIVE_KEYS, 'state.currentCard.objective');
  const sequencePosition = objectiveCandidate.sequencePosition;
  if (
    typeof sequencePosition !== 'number'
    || !Number.isInteger(sequencePosition)
    || sequencePosition < 0
    || sequencePosition >= OBJECTIVES_COUNT
  ) {
    throw new RangeError(
      'state.currentCard.objective.sequencePosition must be from 0 through 51',
    );
  }
  return Object.freeze({
    customBackground: true,
    labelsFinishedAtConstruction: candidate.labelsFinishedAtConstruction,
    objective: copyObjective(
      objectiveCandidate,
      sequencePosition,
      'state.currentCard.objective',
    ),
  });
}

function copyObjective(
  candidate: unknown,
  expectedSequencePosition: number,
  label: string,
): ObjectiveDefinition {
  assertExactObject(candidate, OBJECTIVE_KEYS, label);
  const canonical = objectiveDefinitionAt(expectedSequencePosition);
  if (canonical === null) {
    throw new RangeError(`${label} has no recovered definition`);
  }
  if (
    candidate.description !== canonical.description
    || candidate.id !== canonical.id
    || candidate.rewardCoins !== canonical.rewardCoins
    || candidate.sequencePosition !== canonical.sequencePosition
    || candidate.target !== canonical.target
  ) {
    throw new RangeError(`${label} must match recovered sequence position ${
      expectedSequencePosition
    }`);
  }
  return canonical;
}

function copyViewedSequencePosition(
  candidate: unknown,
): ObjectivesScreenViewedSequencePosition {
  if (
    typeof candidate !== 'number'
    || !Number.isInteger(candidate)
    || candidate < -1
    || candidate >= OBJECTIVES_COUNT
  ) {
    throw new RangeError('state.viewedSequencePosition must be -1 or 0 through 51');
  }
  return candidate;
}

function copyMetrics(candidate: unknown, label: string): ObjectivesScreenListMetrics {
  assertExactObject(candidate, METRICS_KEYS, label);
  const bottomBound = finiteFloat32(candidate.bottomBound, `${label}.bottomBound`);
  const logicalHeight = positiveFiniteFloat32(
    candidate.logicalHeight,
    `${label}.logicalHeight`,
  );
  const rowSpacing = positiveFiniteFloat32(
    candidate.rowSpacing,
    `${label}.rowSpacing`,
  );
  const topBound = finiteFloat32(candidate.topBound, `${label}.topBound`);
  if (bottomBound >= topBound) {
    throw new RangeError(`${label}.bottomBound must be below topBound`);
  }
  return Object.freeze({ bottomBound, logicalHeight, rowSpacing, topBound });
}

function copyViewport(candidate: unknown): ObjectivesScreenViewport {
  assertExactObject(candidate, VIEWPORT_KEYS, 'viewport');
  const logicalHeight = positiveFiniteFloat32(
    candidate.logicalHeight,
    'viewport.logicalHeight',
  );
  const logicalWidth = positiveFiniteFloat32(
    candidate.logicalWidth,
    'viewport.logicalWidth',
  );
  assertExactObject(candidate.visibleRect, VISIBLE_RECT_KEYS, 'viewport.visibleRect');
  const visibleRect = deepFreeze({
    bottom: copyPoint(candidate.visibleRect.bottom, 'viewport.visibleRect.bottom'),
    center: copyPoint(candidate.visibleRect.center, 'viewport.visibleRect.center'),
    left: copyPoint(candidate.visibleRect.left, 'viewport.visibleRect.left'),
    right: copyPoint(candidate.visibleRect.right, 'viewport.visibleRect.right'),
    top: copyPoint(candidate.visibleRect.top, 'viewport.visibleRect.top'),
  });
  if (
    visibleRect.bottom.y >= visibleRect.top.y
    || visibleRect.left.x >= visibleRect.right.x
  ) {
    throw new RangeError('viewport.visibleRect must have positive width and height');
  }
  return deepFreeze({ logicalHeight, logicalWidth, visibleRect });
}

function copyPoint(candidate: unknown, label: string): ObjectivesScreenPoint {
  assertExactObject(candidate, POINT_KEYS, label);
  return point(
    finiteFloat32(candidate.x, `${label}.x`),
    finiteFloat32(candidate.y, `${label}.y`),
  );
}

function assertDenseArray(
  candidate: readonly unknown[],
  expectedLength: number,
  label: string,
): void {
  const keys = Object.keys(candidate);
  if (
    keys.length !== expectedLength
    || Array.from({ length: expectedLength }, (_, index) => `${index}`)
      .some((key) => keys.indexOf(key) < 0)
  ) {
    throw new RangeError(`${label} must be dense without extra fields`);
  }
}

function fadeIn(durationSeconds: number): ObjectivesScreenFadeInAction {
  return Object.freeze({
    durationSeconds: finiteFloat32(durationSeconds, 'fade durationSeconds'),
    easing: null,
    type: 'fade-in',
  });
}

function moveTo(
  durationSeconds: number,
  target: ObjectivesScreenPoint,
): ObjectivesScreenMoveToAction {
  return Object.freeze({
    durationSeconds: finiteFloat32(durationSeconds, 'move durationSeconds'),
    easing: null,
    target,
    type: 'move-to',
  });
}

function moveBy(
  durationSeconds: number,
  delta: ObjectivesScreenPoint,
): ObjectivesScreenMoveByAction {
  return Object.freeze({
    delta,
    durationSeconds: finiteFloat32(durationSeconds, 'move durationSeconds'),
    easing: null,
    type: 'move-by',
  });
}

function rotateBy(
  durationSeconds: number,
  deltaDegrees: number,
): ObjectivesScreenRotateByAction {
  return Object.freeze({
    deltaDegrees: finiteFloat32(deltaDegrees, 'rotation deltaDegrees'),
    durationSeconds: finiteFloat32(durationSeconds, 'rotation durationSeconds'),
    easing: null,
    type: 'rotate-by',
  });
}

function point(x: number, y: number): ObjectivesScreenPoint {
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

function float32FromBits(bits: number): number {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, bits, true);
  return new DataView(buffer).getFloat32(0, true);
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
