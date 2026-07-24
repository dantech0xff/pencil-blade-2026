import type { GameplayRandom } from './gameplay-random';
import {
  getAboutRasterResources,
  type AboutRasterResource,
  type AboutTwoFrameRasterSet,
} from './about-resource-contract';
import type { ClassicAssetTree } from './resolution-profile-service';

export const ABOUT_ROOT_Z_ORDER = 1 as const;
export const ABOUT_GESTURES_DEFAULT_Z_ORDER = 0 as const;
export const ABOUT_REVIEW_PULSE_LEG_SECONDS = Math.fround(0.45);
export const ABOUT_REVIEW_PULSE_CYCLE_SECONDS = Math.fround(0.9);
export const ABOUT_REVIEW_PULSE_APEX_SCALE = Math.fround(1.15);

const HALF = Math.fround(0.5);
const ONE = Math.fround(1);
const MENU_Y_FACTOR = Math.fround(0.1);
const REVIEW_X_FACTOR = Math.fround(0.15);
const EMAIL_X_FACTOR = Math.fround(0.85);
const LIKE_X_FACTOR = Math.fround(0.75);
const LIKE_Y_FACTOR = Math.fround(0.335);
const HEART_X_MINIMUM_FACTOR = Math.fround(0.1);
const HEART_X_MAXIMUM_FACTOR = Math.fround(0.2);
const HEART_Y_MINIMUM_FACTOR = Math.fround(0.05);
const HEART_Y_MAXIMUM_FACTOR = Math.fround(0.15);
const HEART_RISE_MINIMUM_FACTOR = Math.fround(0.1);
const HEART_RISE_MAXIMUM_FACTOR = Math.fround(0.25);
const EMPTY_ACTIONS = Object.freeze([] as const);

export type AboutControlPurpose = 'menu' | 'review' | 'email' | 'like';

export interface AboutPoint {
  readonly x: number;
  readonly y: number;
}

export interface AboutVisibleRect {
  readonly bottom: AboutPoint;
  readonly center: AboutPoint;
  readonly left: AboutPoint;
  readonly right: AboutPoint;
  readonly top: AboutPoint;
}

export interface AboutViewport {
  /** Raw logical director height H. */
  readonly logicalHeight: number;
  /** Raw logical director width W. */
  readonly logicalWidth: number;
  readonly visibleRect: AboutVisibleRect;
}

export interface AboutAnchor {
  readonly evidence: 'inferred-legacy-default';
  readonly x: number;
  readonly y: number;
}

export interface AboutScaleToAction {
  readonly durationSeconds: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly type: 'scale-to';
}

export interface AboutReviewPulsePlan {
  readonly cycleDurationSeconds: number;
  readonly firstEmissionAtSeconds: number;
  readonly initialScale: 1;
  readonly initialScaleEvidence: 'inferred-legacy-default';
  readonly repeatForever: true;
  readonly secondEmissionAtSeconds: number;
  readonly sequence: readonly [
    AboutScaleToAction,
    Readonly<{ readonly callback: 'add-heart'; readonly type: 'invoke-callback' }>,
    AboutScaleToAction,
    Readonly<{ readonly callback: 'add-heart'; readonly type: 'invoke-callback' }>,
  ];
}

export interface AboutLocalReviewEligibilityInput {
  /**
   * Explicit local compatibility input. It is not a live connectivity observation and
   * this module never refreshes it.
   */
  readonly localCompatibilityAvailable: boolean;
  readonly rated: boolean;
}

export interface AboutReviewPulseEligibility {
  readonly eligible: boolean;
  readonly externalActionRequested: false;
  readonly liveConnectivityRequested: false;
  readonly localCompatibilityAvailable: boolean;
  readonly rated: boolean;
  readonly source: 'local-compatibility-snapshot';
}

export interface AboutBackgroundPresentation {
  readonly anchor: AboutAnchor;
  readonly attachmentInsertion: 1;
  readonly entryActions: readonly [];
  readonly position: AboutPoint;
  readonly resource: AboutRasterResource;
  readonly zOrder: 1;
}

export interface AboutButtonPresentation {
  readonly anchor: AboutAnchor;
  readonly entryActions: readonly [];
  /** Zero-based order within the recovered zero-origin menu container. */
  readonly insertionIndex: 0 | 1 | 2 | 3;
  readonly inferredInitialScale: Readonly<{ readonly x: 1; readonly y: 1 }>;
  readonly position: AboutPoint;
  readonly purpose: AboutControlPurpose;
  readonly resources: AboutTwoFrameRasterSet;
}

export interface AboutMenuPresentation {
  readonly attachmentInsertion: 2;
  readonly email: AboutButtonPresentation;
  readonly itemOrder: typeof ABOUT_MENU_ITEM_ORDER;
  readonly like: AboutButtonPresentation;
  readonly menu: AboutButtonPresentation;
  readonly position: AboutPoint;
  readonly review: AboutButtonPresentation;
  readonly zOrder: 1;
}

export interface AboutRootOrderEntry {
  readonly attachmentInsertion: 1 | 2 | 3;
  readonly key: 'background' | 'menu' | 'gestures';
  readonly visible: boolean;
  readonly zOrder: 0 | 1;
}

export interface AboutPresentationSnapshot {
  readonly assetTree: ClassicAssetTree;
  readonly background: AboutBackgroundPresentation;
  readonly heartResource: AboutRasterResource;
  readonly menu: AboutMenuPresentation;
  readonly reviewPulseEligibility: AboutReviewPulseEligibility;
  readonly reviewPulsePlan: AboutReviewPulsePlan | null;
  readonly rootOrder: typeof ABOUT_ROOT_ORDER;
  readonly viewport: AboutViewport;
  readonly visibleDrawOrder: typeof ABOUT_VISIBLE_DRAW_ORDER;
}

export type AboutHeartRandom = Pick<
  GameplayRandom,
  'nextDecile' | 'nextIntInclusive'
>;

export interface AboutHeartRandomDraw {
  readonly kind: 'inclusive-integer' | 'decile';
  readonly maximumInclusive?: number;
  readonly minimumInclusive?: number;
  readonly name: 'x' | 'y' | 'qScale' | 'qDuration' | 'rise';
  readonly value: number;
}

export interface AboutHeartEmissionPlan {
  readonly actions: readonly [
    Readonly<{ readonly durationSeconds: number; readonly type: 'fade-out' }>,
    Readonly<{
      readonly delta: AboutPoint;
      readonly durationSeconds: number;
      readonly type: 'move-by';
    }>,
  ];
  readonly actionsRunConcurrently: true;
  readonly actionsStartBeforeRootAttachment: true;
  readonly anchor: AboutAnchor;
  readonly durationSeconds: number;
  readonly finalState: 'invisible-retained-child';
  readonly perHeartCleanupAction: false;
  readonly position: AboutPoint;
  readonly randomDraws: readonly [
    AboutHeartRandomDraw,
    AboutHeartRandomDraw,
    AboutHeartRandomDraw,
    AboutHeartRandomDraw,
    AboutHeartRandomDraw,
  ];
  readonly resourceCanonicalPath: string;
  readonly rise: number;
  readonly scale: number;
  readonly seedParityClaimed: false;
  readonly zOrder: 1;
}

export const ABOUT_INFERRED_CENTER_ANCHOR: AboutAnchor = deepFreeze({
  evidence: 'inferred-legacy-default' as const,
  x: HALF,
  y: HALF,
});

export const ABOUT_MENU_ITEM_ORDER = Object.freeze([
  'menu',
  'review',
  'email',
  'like',
] as const);

/** Synchronous root insertion order; gestures are nonvisual at the default z-order. */
export const ABOUT_ROOT_ORDER = deepFreeze([
  {
    attachmentInsertion: 1 as const,
    key: 'background' as const,
    visible: true,
    zOrder: ABOUT_ROOT_Z_ORDER,
  },
  {
    attachmentInsertion: 2 as const,
    key: 'menu' as const,
    visible: true,
    zOrder: ABOUT_ROOT_Z_ORDER,
  },
  {
    attachmentInsertion: 3 as const,
    key: 'gestures' as const,
    visible: false,
    zOrder: ABOUT_GESTURES_DEFAULT_Z_ORDER,
  },
]) satisfies readonly AboutRootOrderEntry[];

/** Equal-z visible insertion order, including hearts emitted after the initial graph. */
export const ABOUT_VISIBLE_DRAW_ORDER = Object.freeze([
  'background',
  'menu',
  'emitted-heart',
] as const);

export const ABOUT_REVIEW_PULSE_PLAN: AboutReviewPulsePlan = deepFreeze({
  cycleDurationSeconds: ABOUT_REVIEW_PULSE_CYCLE_SECONDS,
  firstEmissionAtSeconds: ABOUT_REVIEW_PULSE_LEG_SECONDS,
  initialScale: 1 as const,
  initialScaleEvidence: 'inferred-legacy-default' as const,
  repeatForever: true as const,
  secondEmissionAtSeconds: ABOUT_REVIEW_PULSE_CYCLE_SECONDS,
  sequence: [
    scaleTo(ABOUT_REVIEW_PULSE_LEG_SECONDS, ABOUT_REVIEW_PULSE_APEX_SCALE),
    { callback: 'add-heart' as const, type: 'invoke-callback' as const },
    scaleTo(ABOUT_REVIEW_PULSE_LEG_SECONDS, ONE),
    { callback: 'add-heart' as const, type: 'invoke-callback' as const },
  ],
});

/** Pure snapshot of the exact static About graph and its local-only pulse eligibility. */
export function createAboutPresentation(
  assetTree: ClassicAssetTree,
  viewport: AboutViewport,
  eligibility: AboutLocalReviewEligibilityInput,
): AboutPresentationSnapshot {
  const resources = getAboutRasterResources(assetTree);
  const copiedViewport = copyViewport(viewport);
  const copiedEligibility = copyEligibility(eligibility);
  const width = copiedViewport.logicalWidth;
  const height = copiedViewport.logicalHeight;
  const menuY = multiplyFloat32(height, MENU_Y_FACTOR);

  const menu = button(
    'menu',
    resources.menu,
    point(multiplyFloat32(width, HALF), menuY),
    0,
  );
  const review = button(
    'review',
    resources.review,
    point(multiplyFloat32(width, REVIEW_X_FACTOR), menuY),
    1,
  );
  const email = button(
    'email',
    resources.email,
    point(multiplyFloat32(width, EMAIL_X_FACTOR), menuY),
    2,
  );
  const like = button(
    'like',
    resources.like,
    point(
      multiplyFloat32(width, LIKE_X_FACTOR),
      multiplyFloat32(height, LIKE_Y_FACTOR),
    ),
    3,
  );
  const reviewPulseEligibility = deepFreeze({
    eligible: (
      copiedEligibility.localCompatibilityAvailable
      && !copiedEligibility.rated
    ),
    externalActionRequested: false as const,
    liveConnectivityRequested: false as const,
    localCompatibilityAvailable: copiedEligibility.localCompatibilityAvailable,
    rated: copiedEligibility.rated,
    source: 'local-compatibility-snapshot' as const,
  });

  return deepFreeze({
    assetTree,
    background: {
      anchor: ABOUT_INFERRED_CENTER_ANCHOR,
      attachmentInsertion: 1 as const,
      entryActions: EMPTY_ACTIONS,
      position: point(
        copiedViewport.visibleRect.center.x,
        copiedViewport.visibleRect.center.y,
      ),
      resource: resources.background,
      zOrder: ABOUT_ROOT_Z_ORDER,
    },
    heartResource: resources.heart,
    menu: {
      attachmentInsertion: 2 as const,
      email,
      itemOrder: ABOUT_MENU_ITEM_ORDER,
      like,
      menu,
      position: point(0, 0),
      review,
      zOrder: ABOUT_ROOT_Z_ORDER,
    },
    reviewPulseEligibility,
    reviewPulsePlan: reviewPulseEligibility.eligible
      ? ABOUT_REVIEW_PULSE_PLAN
      : null,
    rootOrder: ABOUT_ROOT_ORDER,
    viewport: copiedViewport,
    visibleDrawOrder: ABOUT_VISIBLE_DRAW_ORDER,
  });
}

/** Creates one retained About heart using the exact recovered five-draw order. */
export function createAboutHeartEmissionPlan(
  assetTree: ClassicAssetTree,
  viewport: AboutViewport,
  random: AboutHeartRandom,
): AboutHeartEmissionPlan {
  const resources = getAboutRasterResources(assetTree);
  const copiedViewport = copyViewport(viewport);
  assertHeartRandom(random);

  const xMinimum = truncateSignedInt32(
    multiplyFloat32(copiedViewport.logicalWidth, HEART_X_MINIMUM_FACTOR),
    'heart x minimum',
  );
  const xMaximum = truncateSignedInt32(
    multiplyFloat32(copiedViewport.logicalWidth, HEART_X_MAXIMUM_FACTOR),
    'heart x maximum',
  );
  const yMinimum = truncateSignedInt32(
    multiplyFloat32(copiedViewport.logicalHeight, HEART_Y_MINIMUM_FACTOR),
    'heart y minimum',
  );
  const yMaximum = truncateSignedInt32(
    multiplyFloat32(copiedViewport.logicalHeight, HEART_Y_MAXIMUM_FACTOR),
    'heart y maximum',
  );
  const riseMinimum = truncateSignedInt32(
    multiplyFloat32(copiedViewport.logicalHeight, HEART_RISE_MINIMUM_FACTOR),
    'heart rise minimum',
  );
  const riseMaximum = truncateSignedInt32(
    multiplyFloat32(copiedViewport.logicalHeight, HEART_RISE_MAXIMUM_FACTOR),
    'heart rise maximum',
  );
  assertOrderedBounds(xMinimum, xMaximum, 'heart x');
  assertOrderedBounds(yMinimum, yMaximum, 'heart y');
  assertOrderedBounds(riseMinimum, riseMaximum, 'heart rise');

  const x = drawInclusive(random, xMinimum, xMaximum, 'x');
  const y = drawInclusive(random, yMinimum, yMaximum, 'y');
  const qScale = drawDecile(random, 'qScale');
  const qDuration = drawDecile(random, 'qDuration');
  const rise = drawInclusive(random, riseMinimum, riseMaximum, 'rise');
  const durationSeconds = addFloat32(Math.fround(qDuration), ONE);
  const scale = addFloat32(
    multiplyFloat32(Math.fround(qScale), HALF),
    HALF,
  );

  return deepFreeze({
    actions: [
      { durationSeconds, type: 'fade-out' as const },
      {
        delta: point(0, rise),
        durationSeconds,
        type: 'move-by' as const,
      },
    ],
    actionsRunConcurrently: true as const,
    actionsStartBeforeRootAttachment: true as const,
    anchor: ABOUT_INFERRED_CENTER_ANCHOR,
    durationSeconds,
    finalState: 'invisible-retained-child' as const,
    perHeartCleanupAction: false as const,
    position: point(x, y),
    randomDraws: [
      inclusiveDraw('x', xMinimum, xMaximum, x),
      inclusiveDraw('y', yMinimum, yMaximum, y),
      decileDraw('qScale', qScale),
      decileDraw('qDuration', qDuration),
      inclusiveDraw('rise', riseMinimum, riseMaximum, rise),
    ],
    resourceCanonicalPath: resources.heart.canonicalPath,
    rise,
    scale,
    seedParityClaimed: false as const,
    zOrder: ABOUT_ROOT_Z_ORDER,
  });
}

/** Returns nominal callback times for a deterministic number of full pulse cycles. */
export function createAboutReviewHeartEmissionTimes(
  cycleCount: number,
): readonly number[] {
  if (!Number.isSafeInteger(cycleCount) || cycleCount < 0) {
    throw new RangeError('cycleCount must be a non-negative safe integer');
  }
  const times: number[] = [];
  for (let cycle = 0; cycle < cycleCount; cycle += 1) {
    const cycleStart = multiplyFloat32(
      cycle,
      ABOUT_REVIEW_PULSE_CYCLE_SECONDS,
    );
    times.push(
      addFloat32(cycleStart, ABOUT_REVIEW_PULSE_LEG_SECONDS),
      addFloat32(cycleStart, ABOUT_REVIEW_PULSE_CYCLE_SECONDS),
    );
  }
  return Object.freeze(times);
}

function button(
  purpose: AboutControlPurpose,
  resources: AboutTwoFrameRasterSet,
  position: AboutPoint,
  insertionIndex: 0 | 1 | 2 | 3,
): AboutButtonPresentation {
  return deepFreeze({
    anchor: ABOUT_INFERRED_CENTER_ANCHOR,
    entryActions: EMPTY_ACTIONS,
    inferredInitialScale: { x: 1 as const, y: 1 as const },
    insertionIndex,
    position,
    purpose,
    resources,
  });
}

function scaleTo(
  durationSeconds: number,
  scale: number,
): AboutScaleToAction {
  return Object.freeze({
    durationSeconds,
    scaleX: scale,
    scaleY: scale,
    type: 'scale-to' as const,
  });
}

function inclusiveDraw(
  name: 'x' | 'y' | 'rise',
  minimumInclusive: number,
  maximumInclusive: number,
  value: number,
): AboutHeartRandomDraw {
  return Object.freeze({
    kind: 'inclusive-integer',
    maximumInclusive,
    minimumInclusive,
    name,
    value,
  });
}

function decileDraw(
  name: 'qScale' | 'qDuration',
  value: number,
): AboutHeartRandomDraw {
  return Object.freeze({ kind: 'decile', name, value });
}

function drawInclusive(
  random: AboutHeartRandom,
  minimumInclusive: number,
  maximumInclusive: number,
  name: 'x' | 'y' | 'rise',
): number {
  const value = random.nextIntInclusive(minimumInclusive, maximumInclusive);
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${name} draw must return a safe integer`);
  }
  if (value < minimumInclusive || value > maximumInclusive) {
    throw new RangeError(`${name} draw returned a value outside its inclusive range`);
  }
  return value;
}

function drawDecile(
  random: AboutHeartRandom,
  name: 'qScale' | 'qDuration',
): number {
  const value = random.nextDecile();
  if (!Number.isFinite(value) || !isRecoveredDecile(value)) {
    throw new RangeError(`${name} draw must be one of 0.0 through 0.9 in tenths`);
  }
  return value;
}

function isRecoveredDecile(value: number): boolean {
  return value === 0
    || value === 0.1
    || value === 0.2
    || value === 0.3
    || value === 0.4
    || value === 0.5
    || value === 0.6
    || value === 0.7
    || value === 0.8
    || value === 0.9;
}

function assertHeartRandom(random: AboutHeartRandom): void {
  if (
    random === null
    || typeof random !== 'object'
    || typeof random.nextIntInclusive !== 'function'
    || typeof random.nextDecile !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive() and nextDecile()');
  }
}

function copyEligibility(
  eligibility: AboutLocalReviewEligibilityInput,
): AboutLocalReviewEligibilityInput {
  if (
    eligibility === null
    || typeof eligibility !== 'object'
    || Array.isArray(eligibility)
  ) {
    throw new TypeError('eligibility must be an object');
  }
  if (
    typeof eligibility.localCompatibilityAvailable !== 'boolean'
    || typeof eligibility.rated !== 'boolean'
  ) {
    throw new TypeError(
      'eligibility must provide boolean localCompatibilityAvailable and rated values',
    );
  }
  return Object.freeze({
    localCompatibilityAvailable: eligibility.localCompatibilityAvailable,
    rated: eligibility.rated,
  });
}

function copyViewport(viewport: AboutViewport): AboutViewport {
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

function copyPoint(candidate: AboutPoint, label: string): AboutPoint {
  if (
    candidate === null
    || typeof candidate !== 'object'
    || Array.isArray(candidate)
  ) {
    throw new TypeError(`${label} must be an object`);
  }
  return point(
    finiteFloat32(candidate.x, `${label}.x`),
    finiteFloat32(candidate.y, `${label}.y`),
  );
}

function point(x: number, y: number): AboutPoint {
  return Object.freeze({ x: Math.fround(x), y: Math.fround(y) });
}

function assertOrderedBounds(
  minimum: number,
  maximum: number,
  label: string,
): void {
  if (minimum > maximum) {
    throw new RangeError(`${label} minimum must not exceed its maximum`);
  }
}

function truncateSignedInt32(value: number, label: string): number {
  const truncated = Math.trunc(value);
  if (
    !Number.isSafeInteger(truncated)
    || truncated < -2_147_483_648
    || truncated > 2_147_483_647
  ) {
    throw new RangeError(`${label} must fit in a signed 32-bit integer`);
  }
  return truncated;
}

function positiveFiniteFloat32(value: number, label: string): number {
  const float32 = finiteFloat32(value, label);
  if (float32 <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
  return float32;
}

function finiteFloat32(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
  const float32 = Math.fround(value);
  if (!Number.isFinite(float32)) {
    throw new RangeError(`${label} must fit in float32`);
  }
  return float32;
}

function addFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) + Math.fround(right));
}

function multiplyFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) * Math.fround(right));
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
