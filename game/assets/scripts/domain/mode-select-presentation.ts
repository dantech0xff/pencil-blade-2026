import type { FruitFixtureConfiguration } from './classic-fixture-rules';
import { createFruitFixtureConfiguration } from './classic-fixture-rules';
import type { ClassicRasterResource } from './classic-resource-contract';
import { getClassicDefaultBladeResource } from './classic-resource-contract';
import type {
  ModeSelectCardResourceDefinition,
  ModeSelectCardRasterSet,
  ModeSelectRasterProfile,
  ModeSelectTwoFrameRasterSet,
} from './mode-select-resource-contract';
import {
  MODE_SELECT_CARD_DEFINITIONS,
  MODE_SELECT_FONT_CANONICAL_PATH,
  getModeSelectCardDefinition,
  getModeSelectRasterResources,
} from './mode-select-resource-contract';
import type {
  ModeSelectFrameResult,
  ModeSelectIndex,
  ModeSelectPersistedUnlocks,
  ModeSelectStateSnapshot,
  ModeSelectUnlockBurstPlan,
  ModeSelectUnlockParticlePlan,
  ModeSelectUnlockParticleRandom,
} from './mode-select-state';
import {
  MODE_SELECT_CARD_COUNT,
  MODE_SELECT_INITIAL_CURRENT_INDEX,
  MODE_SELECT_INITIAL_DESTINATION_STATE,
  MODE_SELECT_UNLOCK_PARTICLE_COUNT,
  MODE_SELECT_UNLOCK_PRICE,
  ModeSelectState,
  createModeSelectUnlockBurstPlan,
  createModeSelectUnlockParticleBurst,
} from './mode-select-state';
import type { ClassicAssetTree } from './resolution-profile-service';

export const MODE_SELECT_ROOT_Z_ORDER = 1 as const;
export const MODE_SELECT_GESTURES_DEFAULT_Z_ORDER = 0 as const;
export const MODE_SELECT_PHYSICS_WORLD_UNITS_PER_METRE = 32 as const;
export const MODE_SELECT_ROPE_LINK_COUNT = 7 as const;
export const MODE_SELECT_ROPE_JOINT_COUNT = 8 as const;
export const MODE_SELECT_ENTRY_FADE_SECONDS = Math.fround(1.25);
export const MODE_SELECT_FRUIT_CIRCLE_ROTATION_SECONDS = Math.fround(15);
export const MODE_SELECT_FRUIT_CIRCLE_ROTATION_DEGREES = Math.fround(-360);
export const MODE_SELECT_FRUIT_CIRCLE_CUT_SECONDS = Math.fround(0.75);
export const MODE_SELECT_FRUIT_ANGULAR_VELOCITY_RADIANS_PER_SECOND = Math.fround(2);
export const MODE_SELECT_TITLE_MOVE_SECONDS = Math.fround(1);
export const MODE_SELECT_BACK_MOVE_SECONDS = Math.fround(1);
export const MODE_SELECT_BACK_ROTATION_SECONDS = Math.fround(1);
export const MODE_SELECT_BACK_ROTATION_DEGREES = Math.fround(360);
export const MODE_SELECT_LONG_ROPE_FADE_SECONDS = Math.fround(0.5);
export const MODE_SELECT_INSUFFICIENT_COINS_TEXT = 'Not enough coins!' as const;
export const MODE_SELECT_INSUFFICIENT_COINS_REFERENCE_WIDTH = Math.fround(480);
export const MODE_SELECT_INSUFFICIENT_COINS_BASE_POINT_SIZE = Math.fround(32);

const HALF = Math.fround(0.5);
const CARD_Y_FACTOR = Math.fround(0.35);
const ROPE_ANCHOR_Y_FACTOR = Math.fround(0.835);
const LONG_ROPE_Y_FACTOR = Math.fround(0.825);
const BLUR_Y_FACTOR = Math.fround(0.05);
const INITIAL_BLUR_X_FACTOR = float32FromBits(0x3db8_51ec);
const STEADY_BLUR_X_FACTOR = float32FromBits(0x3da3_d70a);
const WHEEL_OFFSET_DIVISOR = Math.fround(1.5);
const WHEEL_ROTATION_DIVISOR = float32FromBits(0x4196_cbe4);
const RADIANS_TO_DEGREES = float32FromBits(0x4265_2ee1);
const NO_ENTRY_ACTIONS = Object.freeze([] as const);

export interface ModeSelectPoint {
  readonly x: number;
  readonly y: number;
}

export interface ModeSelectVisibleRect {
  readonly bottom: ModeSelectPoint;
  readonly center: ModeSelectPoint;
  readonly left: ModeSelectPoint;
  readonly right: ModeSelectPoint;
  readonly top: ModeSelectPoint;
}

export interface ModeSelectViewport {
  /** Raw logical director height H. */
  readonly logicalHeight: number;
  /** Raw logical director width W; distinct from VisibleRect width/right. */
  readonly logicalWidth: number;
  readonly visibleRect: ModeSelectVisibleRect;
}

export interface ModeSelectAnchor {
  readonly evidence: 'inferred-legacy-default';
  readonly x: number;
  readonly y: number;
}

export interface ModeSelectMoveByAction {
  readonly delta: ModeSelectPoint;
  readonly durationSeconds: number;
  readonly easing: null;
  readonly type: 'move-by';
}

export interface ModeSelectRotateByAction {
  readonly deltaDegrees: number;
  readonly durationSeconds: number;
  readonly easing: null;
  readonly type: 'rotate-by';
}

export interface ModeSelectFadeAction {
  readonly durationSeconds: number;
  readonly easing: null;
  readonly type: 'fade-in' | 'fade-out';
}

export interface ModeSelectDelayAction {
  readonly durationSeconds: number;
  readonly type: 'delay';
}

export interface ModeSelectScaleToAction {
  readonly durationSeconds: number;
  readonly easing: null;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly type: 'scale-to';
}

export interface ModeSelectRepeatRotationAction {
  readonly action: ModeSelectRotateByAction;
  readonly type: 'repeat-forever';
}

export interface ModeSelectTitlePresentation {
  readonly actions: readonly [ModeSelectMoveByAction];
  readonly actionsRunConcurrently: false;
  readonly anchor: ModeSelectAnchor;
  readonly fadeActionPresent: false;
  readonly finalPosition: ModeSelectPoint;
  readonly initialPosition: ModeSelectPoint;
  readonly resource: ClassicRasterResource;
  readonly rotationActionPresent: false;
  readonly zOrder: 1;
}

export interface ModeSelectBackPresentation {
  readonly actions: readonly [ModeSelectRotateByAction, ModeSelectMoveByAction];
  readonly actionsRunConcurrently: true;
  readonly anchor: ModeSelectAnchor;
  readonly backKeyDelegatesToSameCallback: true;
  readonly disabledResource: null;
  readonly fadeActionPresent: false;
  readonly finalPosition: ModeSelectPoint;
  readonly initialPosition: ModeSelectPoint;
  readonly itemCount: 1;
  readonly menuPosition: ModeSelectPoint;
  readonly resources: ModeSelectTwoFrameRasterSet;
  readonly zOrder: 1;
}

export interface ModeSelectLongRopePresentation {
  readonly action: ModeSelectFadeAction;
  readonly actionStartedBeforeAttachment: true;
  readonly anchor: ModeSelectAnchor;
  readonly fadeSemantics: Readonly<{
    readonly finalOpacity: 255;
    readonly firstManagerStepOpacity: 0;
    readonly firstTickForcesNormalizedTimeZero: true;
    readonly interpolation: 'linear-uint8-trunc-255-times-t';
    readonly preActionOpacitySetterPresent: false;
    readonly preFirstStepOpacity: 'unchanged-inferred-default';
    readonly registeredPausedUntilAttachment: true;
  }>;
  readonly position: ModeSelectPoint;
  readonly resource: ClassicRasterResource;
  readonly zOrder: 1;
}

export interface ModeSelectInsufficientCoinsLabelPresentation {
  readonly addedBeforeHidden: true;
  readonly anchor: ModeSelectAnchor;
  readonly colorRgb: Readonly<{ readonly b: 0; readonly g: 0; readonly r: 250 }>;
  readonly failureActionSequence: readonly [
    ModeSelectFadeAction,
    ModeSelectDelayAction,
    ModeSelectFadeAction,
  ];
  readonly failureInitialOpacity: 0;
  readonly failureSequencesCancelExisting: false;
  readonly failureSequencesMayOverlap: true;
  readonly fontCanonicalPath: typeof MODE_SELECT_FONT_CANONICAL_PATH;
  readonly fontPointSize: number;
  readonly position: ModeSelectPoint;
  readonly text: typeof MODE_SELECT_INSUFFICIENT_COINS_TEXT;
  readonly visibleAfterConstruction: false;
  readonly zOrder: 1;
}

export interface ModeSelectRopeStaticAnchorBody {
  readonly angleRadians: 0;
  readonly bodyType: 'static';
  readonly positionMetres: ModeSelectPoint;
  readonly positionWorldUnits: ModeSelectPoint;
}

export interface ModeSelectRopeLinkPresentation {
  readonly anchor: ModeSelectAnchor;
  readonly bodyType: 'dynamic';
  readonly displayTracksBodyTransform: true;
  readonly displayPositionWorldUnits: ModeSelectPoint;
  readonly entryActions: readonly [];
  readonly index: number;
  readonly positionMetres: ModeSelectPoint;
  readonly resource: ClassicRasterResource;
  readonly zOrder: 1;
}

export interface ModeSelectRopeRevoluteJointPresentation {
  readonly bodyA: 'static-anchor' | `rope-link-${number}`;
  readonly bodyB: 'fruit-body' | `rope-link-${number}`;
  readonly chainIndex: number;
  readonly type: 'revolute';
}

export interface ModeSelectFruitBodyEntryState {
  readonly angleRadians: 0;
  readonly angularVelocityRadiansPerSecond: number;
  readonly awake: true;
  readonly bodyType: 'dynamic';
  readonly gravityScale: 0;
  readonly jointedToLastRopeLink: true;
  readonly positionMetres: ModeSelectPoint;
  readonly positionWorldUnits: ModeSelectPoint;
  readonly worldUnitConversionOwner: 'rope-physics-adapter';
}

export interface ModeSelectLockPresentation {
  readonly currentIndexCoupled: true;
  readonly fruitCutDisabled: true;
  readonly hiddenNotRemovedOnUnlock: true;
  readonly itemAnchor: ModeSelectAnchor;
  readonly itemPosition: ModeSelectPoint;
  readonly menuAnchor: ModeSelectAnchor;
  readonly menuPosition: ModeSelectPoint;
  readonly parent: 'contained-intact-fruit';
  readonly resources: ModeSelectTwoFrameRasterSet;
  readonly senderIdentityUsed: false;
  readonly target: 'mode-select-unlock-current-index-callback';
  readonly zOrder: 1;
}

export interface ModeSelectFruitButtonPresentation {
  readonly audio: Readonly<{
    readonly canonicalPath: string;
    readonly effectsGated: true;
    readonly loop: false;
  }>;
  readonly bodyOnEntry: ModeSelectFruitBodyEntryState;
  readonly blur: Readonly<{
    readonly anchor: ModeSelectAnchor;
    readonly fadeInSeconds: number;
    readonly initialOpacity: 0;
    readonly initialPosition: ModeSelectPoint;
    readonly removedOnCutWithCleanup: true;
    readonly steadyPositionAfterFirstRopeUpdate: ModeSelectPoint;
    readonly zOrder: 1;
  }>;
  readonly circle: Readonly<{
    readonly anchor: ModeSelectAnchor;
    readonly cutScaleAction: ModeSelectScaleToAction;
    readonly entryActions: readonly [ModeSelectFadeAction, ModeSelectRepeatRotationAction];
    readonly entryActionsRunConcurrently: true;
    readonly initialOpacity: 0;
    readonly position: ModeSelectPoint;
    readonly zOrder: 1;
  }>;
  readonly factoryFixture: FruitFixtureConfiguration;
  readonly fruit: Readonly<{
    readonly anchor: ModeSelectAnchor;
    readonly cutEventRegisteredOnEnter: true;
    readonly fadeInSeconds: number;
    readonly initialOpacity: 0;
    readonly position: ModeSelectPoint;
    readonly zOrder: 1;
  }>;
  readonly localChildOrder: typeof MODE_SELECT_FRUIT_BUTTON_CHILD_ORDER;
  readonly lock: ModeSelectLockPresentation | null;
  readonly modeSelectTargetCallbackRegisteredBeforeWrapperCallback: true;
  readonly resources: ModeSelectCardRasterSet;
  readonly wrapperPosition: ModeSelectPoint;
}

export interface ModeSelectRopeSynchronizationPresentation {
  readonly connectorPosition: ModeSelectPoint;
  readonly fruitPosition: ModeSelectPoint;
  readonly fruitYSource: 'retained-requested-point-y';
  readonly lowerWheelPosition: ModeSelectPoint;
  readonly lowerWheelRotationDegrees: number;
  readonly upperWheelPosition: ModeSelectPoint;
  readonly upperWheelRotationDegrees: number;
  readonly wheelRotationFormula: Readonly<{
    readonly radiansToDegrees: number;
    readonly xDivisor: number;
  }>;
}

export interface ModeSelectRopeButtonPresentation {
  readonly card: ModeSelectCardResourceDefinition;
  readonly description: Readonly<{
    readonly anchor: ModeSelectAnchor;
    readonly attachedTo: 'fruit-body';
    readonly entryActions: readonly [];
    readonly resource: ClassicRasterResource;
    readonly zOrder: 1;
  }>;
  readonly fruitButton: ModeSelectFruitButtonPresentation;
  readonly initialLocked: boolean;
  readonly joints: readonly ModeSelectRopeRevoluteJointPresentation[];
  readonly localChildOrder: typeof MODE_SELECT_ROPE_BUTTON_CHILD_ORDER;
  readonly moveContract: Readonly<{
    readonly anglePreservedRadians: 0;
    readonly movesOnlyStaticAnchorBody: true;
    readonly translationInputDivisor: 32;
  }>;
  readonly requestedFruitPoint: ModeSelectPoint;
  readonly ropeLinks: readonly ModeSelectRopeLinkPresentation[];
  readonly scheduledSynchronization: Readonly<{
    readonly enabled: true;
    readonly initial: ModeSelectRopeSynchronizationPresentation;
    readonly operationOrder: typeof MODE_SELECT_ROPE_SYNCHRONIZATION_ORDER;
    readonly runsEveryScheduledFrame: true;
  }>;
  readonly shader: Readonly<{
    readonly anchor: ModeSelectAnchor;
    readonly attachedTo: 'fruit-body';
    readonly entryActions: readonly [];
    readonly resource: ClassicRasterResource;
    readonly zOrder: 1;
  }>;
  readonly staticAnchorBody: ModeSelectRopeStaticAnchorBody;
  readonly wheelAssembly: Readonly<{
    readonly connectorAnchor: ModeSelectAnchor;
    readonly connectorResource: ClassicRasterResource;
    readonly entryActions: readonly [];
    readonly lowerWheelAnchor: ModeSelectAnchor;
    readonly lowerWheelResource: ClassicRasterResource;
    readonly upperWheelAnchor: ModeSelectAnchor;
    readonly upperWheelResource: ClassicRasterResource;
  }>;
  readonly zOrder: 1;
}

export type ModeSelectFruitCutOperation =
  | Readonly<{
      readonly anchor: ModeSelectAnchor;
      readonly canonicalPath: string;
      readonly type: 'attach-cut-bottom-half';
    }>
  | Readonly<{
      readonly anchor: ModeSelectAnchor;
      readonly canonicalPath: string;
      readonly type: 'attach-cut-top-half';
    }>
  | Readonly<{
      readonly canonicalPath: string;
      readonly loop: false;
      readonly type: 'request-fruit-audio';
    }>
  | Readonly<{
      readonly destination: ModeSelectCardResourceDefinition['destination'];
      readonly destinationState: ModeSelectIndex;
      readonly type: 'write-mode-select-destination-state';
    }>
  | Readonly<{ readonly type: 'invoke-mode-selected' }>
  | Readonly<{ readonly type: 'mark-fruit-button-cut' }>
  | Readonly<{ readonly cleanup: true; readonly type: 'remove-fruit-button-blur' }>
  | Readonly<{
      readonly action: ModeSelectScaleToAction;
      readonly type: 'run-fruit-button-circle-action';
    }>
  | Readonly<{ readonly type: 'continue-shared-fruit-notifications' }>;

export interface ModeSelectFruitCutPresentationPlan {
  readonly effectsEnabled: boolean;
  readonly layerWideNavigationGuardPresent: false;
  readonly modeIndex: ModeSelectIndex;
  readonly orderedOperations: readonly ModeSelectFruitCutOperation[];
  readonly selectionDelayMayBeAttachedAgain: true;
  readonly stopsModeSelectActions: false;
}

export interface ModeSelectUnlockParticlePresentation {
  readonly actionPlan: ModeSelectUnlockParticlePlan;
  readonly anchor: ModeSelectAnchor;
  readonly defaultColor: 'white-inferred-legacy-default';
  readonly initialOpacity: 'full-inferred-legacy-default';
  readonly resource: ClassicRasterResource;
  readonly retainedUntilContainerCleanup: true;
  readonly rootZOrder: 1;
  readonly spriteBlend: 'ordinary-inferred-legacy-default';
  readonly spriteChildZOrder: 0;
}

export interface ModeSelectUnlockContainerPresentation {
  readonly anchor: ModeSelectAnchor;
  readonly burstPlan: ModeSelectUnlockBurstPlan;
  readonly childOrder: 'particle-creation-order';
  readonly resource: ClassicRasterResource;
  readonly timeline: readonly [
    ModeSelectDelayAction,
    Readonly<{
      readonly callback: 'create-45-particle-explosion';
      readonly synchronous: true;
      readonly type: 'invoke-callback';
    }>,
    ModeSelectDelayAction,
    Readonly<{ readonly cleanup: true; readonly type: 'remove-container'; }>,
  ];
  readonly zOrder: 1;
}

export interface ModeSelectUnlockBurstPresentation {
  readonly assetTree: ClassicAssetTree;
  readonly container: ModeSelectUnlockContainerPresentation;
  readonly particles: readonly ModeSelectUnlockParticlePresentation[];
  readonly randomDrawCount: 225;
  readonly viewport: ModeSelectViewport;
}

export interface ModeSelectPresentationSnapshot {
  readonly assetTree: ClassicAssetTree;
  readonly bladeDependency: Readonly<{
    readonly resource: ClassicRasterResource;
    readonly scoreManagerRemovedBeforeOwnedRoots: true;
    readonly scoreManagerRemovedWithCleanup: true;
    readonly selectedBladeChildCount: 4;
    readonly selectedBladeChildrenPrecedeOwnedRoots: true;
    readonly selectedBladeId: 0;
    readonly selectedBladeLocalZOrder: 1;
  }>;
  readonly cards: readonly ModeSelectRopeButtonPresentation[];
  readonly gestures: typeof MODE_SELECT_GESTURE_BINDINGS;
  readonly importedCleanSettingsDefaults: typeof MODE_SELECT_IMPORTED_CLEAN_SETTINGS_DEFAULTS;
  readonly initialGameSceneRoots: typeof MODE_SELECT_INITIAL_GAME_SCENE_ROOT_ORDER;
  readonly navigation: Readonly<{
    readonly destinationMapping: typeof MODE_SELECT_DESTINATION_MAPPING;
    readonly destinationPresentationIncluded: false;
    readonly noPlaceholderDestinationNodes: true;
  }>;
  readonly ownedRootOrder: typeof MODE_SELECT_OWNED_ROOT_CHILD_ORDER;
  readonly rail: Readonly<{
    readonly anchorXsAfterFirstUnpressedFrame: readonly number[];
    readonly firstUnpressedFrame: ModeSelectFrameResult;
    readonly firstUnpressedFrameTargetIndex: 0;
    readonly initialState: ModeSelectStateSnapshot;
    readonly initiallyVisuallyCenteredCardIndex: 5;
    readonly logicalWidthNotVisibleRightDefinesRightDragBound: true;
    readonly noDeltaTimeNormalization: true;
    readonly snapThreshold: 2;
  }>;
  readonly shell: Readonly<{
    readonly back: ModeSelectBackPresentation;
    readonly insufficientCoinsLabel: ModeSelectInsufficientCoinsLabelPresentation;
    readonly longRope: ModeSelectLongRopePresentation;
    readonly title: ModeSelectTitlePresentation;
    readonly totalCoinsLabelPresent: false;
  }>;
  readonly survivingSiblingOrder: typeof MODE_SELECT_SURVIVING_SIBLING_ORDER;
  readonly unlock: Readonly<{
    readonly initialTotalCoins: number;
    readonly particleContainer: ModeSelectUnlockContainerPresentation;
    readonly price: 2500;
    readonly successComparison: 'totalCoins > 2499';
    readonly totalCoinsLabelPresent: false;
    readonly totalCoinsPurpose: 'unlock-state-input-only';
  }>;
  readonly viewport: ModeSelectViewport;
}

export const MODE_SELECT_INFERRED_CENTER_ANCHOR: ModeSelectAnchor = Object.freeze({
  evidence: 'inferred-legacy-default',
  x: Math.fround(0.5),
  y: Math.fround(0.5),
});

export const MODE_SELECT_INITIAL_GAME_SCENE_ROOT_ORDER = deepFreeze([
  { child: 'BackgroundLayer' as const, insertion: 1 as const, tag: 0 as const, zOrder: 1 as const },
  { child: 'LeafLayer' as const, insertion: 2 as const, tag: 1 as const, zOrder: 1 as const },
  { child: 'ThemeLayer' as const, insertion: 3 as const, tag: 2 as const, zOrder: 1 as const },
  { child: 'MainMenuLayer' as const, insertion: 4 as const, tag: 3 as const, zOrder: 1 as const },
]);

export const MODE_SELECT_SURVIVING_SIBLING_ORDER = deepFreeze([
  { child: 'BackgroundLayer' as const, originalTag: 0 as const, zOrder: 1 as const },
  { child: 'LeafLayer' as const, originalTag: 1 as const, zOrder: 1 as const },
  { child: 'ThemeLayer' as const, originalTag: 2 as const, zOrder: 1 as const },
  {
    child: 'ModeSelectLayer' as const,
    originalTag: null,
    replacedMainMenuWithCleanup: true as const,
    zOrder: 1 as const,
  },
]);

export const MODE_SELECT_IMPORTED_CLEAN_SETTINGS_DEFAULTS = Object.freeze({
  selectedBackground: 0 as const,
  selectedBlade: 0 as const,
  selectedTheme: 2 as const,
});

export const MODE_SELECT_OWNED_ROOT_CHILD_ORDER = deepFreeze([
  { child: 'gestures-layer' as const, insertion: 1 as const, visible: false as const, zOrder: 0 as const },
  { child: 'title' as const, insertion: 2 as const, visible: true as const, zOrder: 1 as const },
  { child: 'back-menu' as const, insertion: 3 as const, visible: true as const, zOrder: 1 as const },
  { child: 'decorative-long-rope' as const, insertion: 4 as const, visible: true as const, zOrder: 1 as const },
  { child: 'classic-rope-button' as const, insertion: 5 as const, visible: true as const, zOrder: 1 as const },
  { child: 'crazy-rope-button' as const, insertion: 6 as const, visible: true as const, zOrder: 1 as const },
  { child: 'gn-style-rope-button' as const, insertion: 7 as const, visible: true as const, zOrder: 1 as const },
  { child: 'classic-bird-rope-button' as const, insertion: 8 as const, visible: true as const, zOrder: 1 as const },
  { child: 'crazy-bird-rope-button' as const, insertion: 9 as const, visible: true as const, zOrder: 1 as const },
  { child: 'combo-bird-rope-button' as const, insertion: 10 as const, visible: true as const, zOrder: 1 as const },
  { child: 'insufficient-coins-label' as const, insertion: 11 as const, visible: false as const, zOrder: 1 as const },
]);

export const MODE_SELECT_ROPE_BUTTON_CHILD_ORDER = deepFreeze([
  ...Array.from({ length: MODE_SELECT_ROPE_LINK_COUNT }, (_, index) => ({
    child: `rope-link-${index}` as `rope-link-${number}`,
    insertion: index + 1,
    zOrder: MODE_SELECT_ROOT_Z_ORDER,
  })),
  { child: 'description-shader' as const, insertion: 8 as const, zOrder: 1 as const },
  { child: 'description-art' as const, insertion: 9 as const, zOrder: 1 as const },
  { child: 'fruit-button' as const, insertion: 10 as const, zOrder: 1 as const },
  { child: 'upper-wheel' as const, insertion: 11 as const, zOrder: 1 as const },
  { child: 'lower-wheel' as const, insertion: 12 as const, zOrder: 1 as const },
  { child: 'wheel-connector' as const, insertion: 13 as const, zOrder: 1 as const },
]);

export const MODE_SELECT_FRUIT_BUTTON_CHILD_ORDER = Object.freeze([
  'blur',
  'circle-art',
  'intact-fruit',
] as const);

export const MODE_SELECT_FRUIT_CUT_CALLBACK_ORDER = Object.freeze([
  'fruit-cut-halves-and-effects-gated-fruit-audio',
  'mode-select-state-write-and-mode-selected',
  'fruit-button-wrapper-callback',
  'remaining-fruit-notifications',
] as const);

export const MODE_SELECT_ROPE_SYNCHRONIZATION_ORDER = Object.freeze([
  'read-static-anchor-and-convert-by-32',
  'set-fruit-x-and-retain-requested-y',
  'set-upper-wheel-position',
  'set-lower-wheel-position',
  'set-connector-position',
  'set-wheel-rotations-from-current-x',
] as const);

export const MODE_SELECT_GESTURE_BINDINGS = deepFreeze({
  delegates: [
    { event: 'horizontal-drag' as const, target: 'ModeSelectState.drag' as const },
    { event: 'horizontal-flick' as const, target: 'ModeSelectState.flick' as const },
    { event: 'back-key' as const, target: 'same-back-item-callback' as const },
  ],
  directDragDeltaX: true as const,
  visual: false as const,
  zOrder: MODE_SELECT_GESTURES_DEFAULT_Z_ORDER,
});

export const MODE_SELECT_DESTINATION_MAPPING = deepFreeze(
  MODE_SELECT_CARD_DEFINITIONS.map((definition) => ({
    destination: definition.destination,
    destinationState: definition.destinationState,
  })),
);

/** Pure snapshot of the exact Mode Select-owned presentation and its imported dependencies. */
export function createModeSelectPresentation(
  assetTree: ClassicAssetTree,
  viewport: ModeSelectViewport,
  totalCoins: number,
  persistedUnlocks: ModeSelectPersistedUnlocks = {},
): ModeSelectPresentationSnapshot {
  const resources = getModeSelectRasterResources(assetTree);
  const copiedViewport = copyViewport(viewport);
  assertSignedInt32(totalCoins, 'totalCoins');

  // ModeSelectState validates the complete persisted-lock input before its first frame mutation.
  const state = new ModeSelectState({
    layout: stateLayout(copiedViewport),
    persistedUnlocks,
  });
  const initialState = state.snapshot;
  assertInitialStateShape(initialState);
  const cards = createRopeButtons(assetTree, resources, copiedViewport, initialState);
  const firstUnpressedFrame = state.updateFrame(false);
  const anchorXsAfterFirstUnpressedFrame = state.snapshot.anchorXs;
  const particleContainer = createUnlockContainer(
    resources.unlockParticle,
    createModeSelectUnlockBurstPlan(stateLayout(copiedViewport)),
  );

  return deepFreeze({
    assetTree,
    bladeDependency: {
      resource: getClassicDefaultBladeResource(0, assetTree),
      scoreManagerRemovedBeforeOwnedRoots: true as const,
      scoreManagerRemovedWithCleanup: true as const,
      selectedBladeChildCount: 4 as const,
      selectedBladeChildrenPrecedeOwnedRoots: true as const,
      selectedBladeId: 0 as const,
      selectedBladeLocalZOrder: MODE_SELECT_ROOT_Z_ORDER,
    },
    cards,
    gestures: MODE_SELECT_GESTURE_BINDINGS,
    importedCleanSettingsDefaults: MODE_SELECT_IMPORTED_CLEAN_SETTINGS_DEFAULTS,
    initialGameSceneRoots: MODE_SELECT_INITIAL_GAME_SCENE_ROOT_ORDER,
    navigation: {
      destinationMapping: MODE_SELECT_DESTINATION_MAPPING,
      destinationPresentationIncluded: false as const,
      noPlaceholderDestinationNodes: true as const,
    },
    ownedRootOrder: MODE_SELECT_OWNED_ROOT_CHILD_ORDER,
    rail: {
      anchorXsAfterFirstUnpressedFrame,
      firstUnpressedFrame,
      firstUnpressedFrameTargetIndex: 0 as const,
      initialState,
      initiallyVisuallyCenteredCardIndex: 5 as const,
      logicalWidthNotVisibleRightDefinesRightDragBound: true as const,
      noDeltaTimeNormalization: true as const,
      snapThreshold: 2 as const,
    },
    shell: createShell(resources, copiedViewport),
    survivingSiblingOrder: MODE_SELECT_SURVIVING_SIBLING_ORDER,
    unlock: {
      initialTotalCoins: totalCoins,
      particleContainer,
      price: MODE_SELECT_UNLOCK_PRICE,
      successComparison: 'totalCoins > 2499' as const,
      totalCoinsLabelPresent: false as const,
      totalCoinsPurpose: 'unlock-state-input-only' as const,
    },
    viewport: copiedViewport,
  });
}

export function createModeSelectFruitCutPresentationPlan(
  modeIndex: number,
  assetTree: ClassicAssetTree,
  effectsEnabled: boolean,
): ModeSelectFruitCutPresentationPlan {
  const resources = getModeSelectRasterResources(assetTree);
  void resources;
  const definition = getModeSelectCardDefinition(modeIndex);
  if (typeof effectsEnabled !== 'boolean') {
    throw new TypeError('effectsEnabled must be a boolean');
  }
  const cardResources = definition.rasters[assetTree];
  const operations: ModeSelectFruitCutOperation[] = [
    deepFreeze({
      anchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
      canonicalPath: cardResources.cutBottom.canonicalPath,
      type: 'attach-cut-bottom-half' as const,
    }),
    deepFreeze({
      anchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
      canonicalPath: cardResources.cutTop.canonicalPath,
      type: 'attach-cut-top-half' as const,
    }),
  ];
  if (effectsEnabled) {
    operations.push(deepFreeze({
      canonicalPath: definition.cutAudioCanonicalPath,
      loop: false as const,
      type: 'request-fruit-audio' as const,
    }));
  }
  operations.push(
    deepFreeze({
      destination: definition.destination,
      destinationState: definition.destinationState,
      type: 'write-mode-select-destination-state' as const,
    }),
    deepFreeze({ type: 'invoke-mode-selected' as const }),
    deepFreeze({ type: 'mark-fruit-button-cut' as const }),
    deepFreeze({ cleanup: true as const, type: 'remove-fruit-button-blur' as const }),
    deepFreeze({
      action: scaleTo(MODE_SELECT_FRUIT_CIRCLE_CUT_SECONDS, 0),
      type: 'run-fruit-button-circle-action' as const,
    }),
    deepFreeze({ type: 'continue-shared-fruit-notifications' as const }),
  );
  return deepFreeze({
    effectsEnabled,
    layerWideNavigationGuardPresent: false as const,
    modeIndex: definition.destinationState,
    orderedOperations: operations,
    selectionDelayMayBeAttachedAgain: true as const,
    stopsModeSelectActions: false as const,
  });
}

/** Validates profile, viewport, and random capability before consuming any RNG draws. */
export function createModeSelectUnlockBurstPresentation(
  assetTree: ClassicAssetTree,
  viewport: ModeSelectViewport,
  random: ModeSelectUnlockParticleRandom,
): ModeSelectUnlockBurstPresentation {
  const resources = getModeSelectRasterResources(assetTree);
  const copiedViewport = copyViewport(viewport);
  assertUnlockParticleRandom(random);
  const burstPlan = createModeSelectUnlockBurstPlan(stateLayout(copiedViewport));
  const actionPlans = createModeSelectUnlockParticleBurst(burstPlan, random);
  if (actionPlans.length !== MODE_SELECT_UNLOCK_PARTICLE_COUNT) {
    throw new Error('Mode Select state must plan exactly 45 unlock particles');
  }
  const particles = actionPlans.map((actionPlan) => deepFreeze({
    actionPlan,
    anchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
    defaultColor: 'white-inferred-legacy-default' as const,
    initialOpacity: 'full-inferred-legacy-default' as const,
    resource: resources.unlockParticle,
    retainedUntilContainerCleanup: true as const,
    rootZOrder: MODE_SELECT_ROOT_Z_ORDER,
    spriteBlend: 'ordinary-inferred-legacy-default' as const,
    spriteChildZOrder: 0 as const,
  }));
  return deepFreeze({
    assetTree,
    container: createUnlockContainer(resources.unlockParticle, burstPlan),
    particles,
    randomDrawCount: 225 as const,
    viewport: copiedViewport,
  });
}

function createShell(
  resources: ModeSelectRasterProfile,
  viewport: ModeSelectViewport,
): ModeSelectPresentationSnapshot['shell'] {
  const { visibleRect } = viewport;
  const titleHalfHeight = multiplyFloat32(HALF, resources.title.dimensions.height);
  const titleInitial = point(
    visibleRect.top.x,
    addFloat32(visibleRect.top.y, titleHalfHeight),
  );
  const titleFinal = point(
    visibleRect.top.x,
    subtractFloat32(visibleRect.top.y, titleHalfHeight),
  );
  const backHalfWidth = multiplyFloat32(HALF, resources.back.normal.dimensions.width);
  const backHalfHeight = multiplyFloat32(HALF, resources.back.normal.dimensions.height);
  const backInitial = point(
    subtractFloat32(visibleRect.left.x, backHalfWidth),
    addFloat32(visibleRect.bottom.y, backHalfHeight),
  );
  const backFinal = point(
    addFloat32(visibleRect.left.x, backHalfWidth),
    addFloat32(visibleRect.bottom.y, backHalfHeight),
  );
  const labelPosition = point(
    visibleRect.center.x,
    multiplyFloat32(viewport.logicalHeight, CARD_Y_FACTOR),
  );

  return deepFreeze({
    back: {
      actions: [
        rotateBy(MODE_SELECT_BACK_ROTATION_SECONDS, MODE_SELECT_BACK_ROTATION_DEGREES),
        moveBy(
          MODE_SELECT_BACK_MOVE_SECONDS,
          point(resources.back.normal.dimensions.width, 0),
        ),
      ],
      actionsRunConcurrently: true as const,
      anchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
      backKeyDelegatesToSameCallback: true as const,
      disabledResource: null,
      fadeActionPresent: false as const,
      finalPosition: backFinal,
      initialPosition: backInitial,
      itemCount: 1 as const,
      menuPosition: point(0, 0),
      resources: resources.back,
      zOrder: MODE_SELECT_ROOT_Z_ORDER,
    },
    insufficientCoinsLabel: {
      addedBeforeHidden: true as const,
      anchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
      colorRgb: { b: 0 as const, g: 0 as const, r: 250 as const },
      failureActionSequence: [
        fade(Math.fround(0.5), 'fade-in'),
        delay(Math.fround(1)),
        fade(Math.fround(0.5), 'fade-out'),
      ],
      failureInitialOpacity: 0 as const,
      failureSequencesCancelExisting: false as const,
      failureSequencesMayOverlap: true as const,
      fontCanonicalPath: MODE_SELECT_FONT_CANONICAL_PATH,
      fontPointSize: multiplyFloat32(
        divideFloat32(
          viewport.logicalWidth,
          MODE_SELECT_INSUFFICIENT_COINS_REFERENCE_WIDTH,
        ),
        MODE_SELECT_INSUFFICIENT_COINS_BASE_POINT_SIZE,
      ),
      position: labelPosition,
      text: MODE_SELECT_INSUFFICIENT_COINS_TEXT,
      visibleAfterConstruction: false as const,
      zOrder: MODE_SELECT_ROOT_Z_ORDER,
    },
    longRope: {
      action: fade(MODE_SELECT_LONG_ROPE_FADE_SECONDS, 'fade-in'),
      actionStartedBeforeAttachment: true as const,
      anchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
      fadeSemantics: {
        finalOpacity: 255 as const,
        firstManagerStepOpacity: 0 as const,
        firstTickForcesNormalizedTimeZero: true as const,
        interpolation: 'linear-uint8-trunc-255-times-t' as const,
        preActionOpacitySetterPresent: false as const,
        preFirstStepOpacity: 'unchanged-inferred-default' as const,
        registeredPausedUntilAttachment: true as const,
      },
      position: point(
        visibleRect.center.x,
        multiplyFloat32(viewport.logicalHeight, LONG_ROPE_Y_FACTOR),
      ),
      resource: resources.longRope,
      zOrder: MODE_SELECT_ROOT_Z_ORDER,
    },
    title: {
      actions: [
        moveBy(
          MODE_SELECT_TITLE_MOVE_SECONDS,
          point(0, Math.fround(-resources.title.dimensions.height)),
        ),
      ],
      actionsRunConcurrently: false as const,
      anchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
      fadeActionPresent: false as const,
      finalPosition: titleFinal,
      initialPosition: titleInitial,
      resource: resources.title,
      rotationActionPresent: false as const,
      zOrder: MODE_SELECT_ROOT_Z_ORDER,
    },
    totalCoinsLabelPresent: false as const,
  });
}

function createRopeButtons(
  assetTree: ClassicAssetTree,
  resources: ModeSelectRasterProfile,
  viewport: ModeSelectViewport,
  initialState: ModeSelectStateSnapshot,
): readonly ModeSelectRopeButtonPresentation[] {
  if (
    initialState.anchorXs.length !== MODE_SELECT_CARD_COUNT
    || initialState.cardLocks.length !== MODE_SELECT_CARD_COUNT
  ) {
    throw new Error('Mode Select state must expose six anchors and six lock flags');
  }
  return deepFreeze(MODE_SELECT_CARD_DEFINITIONS.map((definition) => (
    createRopeButton(assetTree, resources, viewport, initialState, definition)
  )));
}

function createRopeButton(
  assetTree: ClassicAssetTree,
  resources: ModeSelectRasterProfile,
  viewport: ModeSelectViewport,
  initialState: ModeSelectStateSnapshot,
  definition: ModeSelectCardResourceDefinition,
): ModeSelectRopeButtonPresentation {
  const modeIndex = definition.destinationState;
  const anchorX = requireArrayValue(initialState.anchorXs, modeIndex, 'anchorXs');
  const initialLocked = requireArrayValue(initialState.cardLocks, modeIndex, 'cardLocks');
  const requestedFruitPoint = point(
    anchorX,
    multiplyFloat32(viewport.logicalHeight, CARD_Y_FACTOR),
  );
  const staticAnchorPoint = point(
    anchorX,
    multiplyFloat32(viewport.logicalHeight, ROPE_ANCHOR_Y_FACTOR),
  );
  const cardResources = definition.rasters[assetTree];
  const fruitButton = createFruitButton(
    resources,
    viewport,
    definition,
    cardResources,
    requestedFruitPoint,
    initialLocked,
  );
  const ropeLinks = Array.from({ length: MODE_SELECT_ROPE_LINK_COUNT }, (_, index) => {
    const displayPosition = point(
      anchorX,
      subtractFloat32(
        subtractFloat32(
          staticAnchorPoint.y,
          multiplyFloat32(HALF, resources.ropeNode.dimensions.height),
        ),
        multiplyFloat32(index, resources.ropeNode.dimensions.height),
      ),
    );
    return deepFreeze({
      anchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
      bodyType: 'dynamic' as const,
      displayTracksBodyTransform: true as const,
      displayPositionWorldUnits: displayPosition,
      entryActions: NO_ENTRY_ACTIONS,
      index,
      positionMetres: worldToMetres(displayPosition),
      resource: resources.ropeNode,
      zOrder: MODE_SELECT_ROOT_Z_ORDER,
    });
  });
  const joints = createRopeJoints();

  return deepFreeze({
    card: definition,
    description: {
      anchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
      attachedTo: 'fruit-body' as const,
      entryActions: NO_ENTRY_ACTIONS,
      resource: cardResources.description,
      zOrder: MODE_SELECT_ROOT_Z_ORDER,
    },
    fruitButton,
    initialLocked,
    joints,
    localChildOrder: MODE_SELECT_ROPE_BUTTON_CHILD_ORDER,
    moveContract: {
      anglePreservedRadians: 0 as const,
      movesOnlyStaticAnchorBody: true as const,
      translationInputDivisor: MODE_SELECT_PHYSICS_WORLD_UNITS_PER_METRE,
    },
    requestedFruitPoint,
    ropeLinks,
    scheduledSynchronization: {
      enabled: true as const,
      initial: createRopeSynchronization(
        resources,
        staticAnchorPoint,
        requestedFruitPoint.y,
      ),
      operationOrder: MODE_SELECT_ROPE_SYNCHRONIZATION_ORDER,
      runsEveryScheduledFrame: true as const,
    },
    shader: {
      anchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
      attachedTo: 'fruit-body' as const,
      entryActions: NO_ENTRY_ACTIONS,
      resource: resources.descriptionShader,
      zOrder: MODE_SELECT_ROOT_Z_ORDER,
    },
    staticAnchorBody: {
      angleRadians: 0 as const,
      bodyType: 'static' as const,
      positionMetres: worldToMetres(staticAnchorPoint),
      positionWorldUnits: staticAnchorPoint,
    },
    wheelAssembly: {
      connectorAnchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
      connectorResource: resources.wheelConnector,
      entryActions: NO_ENTRY_ACTIONS,
      lowerWheelAnchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
      lowerWheelResource: resources.wheel,
      upperWheelAnchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
      upperWheelResource: resources.wheel,
    },
    zOrder: MODE_SELECT_ROOT_Z_ORDER,
  });
}

function createFruitButton(
  profile: ModeSelectRasterProfile,
  viewport: ModeSelectViewport,
  definition: ModeSelectCardResourceDefinition,
  resources: ModeSelectCardRasterSet,
  wrapperPosition: ModeSelectPoint,
  initialLocked: boolean,
): ModeSelectFruitButtonPresentation {
  const blurYOffset = multiplyFloat32(BLUR_Y_FACTOR, profile.fruitButtonBlur.dimensions.height);
  const initialBlurPosition = point(
    subtractFloat32(
      wrapperPosition.x,
      multiplyFloat32(INITIAL_BLUR_X_FACTOR, profile.fruitButtonBlur.dimensions.width),
    ),
    subtractFloat32(wrapperPosition.y, blurYOffset),
  );
  const steadyBlurPosition = point(
    subtractFloat32(
      wrapperPosition.x,
      multiplyFloat32(STEADY_BLUR_X_FACTOR, profile.fruitButtonBlur.dimensions.width),
    ),
    subtractFloat32(wrapperPosition.y, blurYOffset),
  );
  const factoryFixture = createFruitFixtureConfiguration({
    fruitId: definition.fruitId,
    spriteHeightWorldUnits: resources.intact.dimensions.height,
    spriteWidthWorldUnits: resources.intact.dimensions.width,
    viewportHeightWorldUnits: viewport.logicalHeight,
    viewportWidthWorldUnits: viewport.logicalWidth,
  });

  return deepFreeze({
    audio: {
      canonicalPath: definition.cutAudioCanonicalPath,
      effectsGated: true as const,
      loop: false as const,
    },
    bodyOnEntry: {
      angleRadians: 0 as const,
      angularVelocityRadiansPerSecond:
        MODE_SELECT_FRUIT_ANGULAR_VELOCITY_RADIANS_PER_SECOND,
      awake: true as const,
      bodyType: 'dynamic' as const,
      gravityScale: 0 as const,
      jointedToLastRopeLink: true as const,
      positionMetres: worldToMetres(wrapperPosition),
      positionWorldUnits: wrapperPosition,
      worldUnitConversionOwner: 'rope-physics-adapter' as const,
    },
    blur: {
      anchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
      fadeInSeconds: MODE_SELECT_ENTRY_FADE_SECONDS,
      initialOpacity: 0 as const,
      initialPosition: initialBlurPosition,
      removedOnCutWithCleanup: true as const,
      steadyPositionAfterFirstRopeUpdate: steadyBlurPosition,
      zOrder: MODE_SELECT_ROOT_Z_ORDER,
    },
    circle: {
      anchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
      cutScaleAction: scaleTo(MODE_SELECT_FRUIT_CIRCLE_CUT_SECONDS, 0),
      entryActions: [
        fade(MODE_SELECT_ENTRY_FADE_SECONDS, 'fade-in'),
        repeatRotation(
          MODE_SELECT_FRUIT_CIRCLE_ROTATION_SECONDS,
          MODE_SELECT_FRUIT_CIRCLE_ROTATION_DEGREES,
        ),
      ],
      entryActionsRunConcurrently: true as const,
      initialOpacity: 0 as const,
      position: wrapperPosition,
      zOrder: MODE_SELECT_ROOT_Z_ORDER,
    },
    factoryFixture,
    fruit: {
      anchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
      cutEventRegisteredOnEnter: true as const,
      fadeInSeconds: MODE_SELECT_ENTRY_FADE_SECONDS,
      initialOpacity: 0 as const,
      position: wrapperPosition,
      zOrder: MODE_SELECT_ROOT_Z_ORDER,
    },
    localChildOrder: MODE_SELECT_FRUIT_BUTTON_CHILD_ORDER,
    lock: initialLocked
      ? createLockPresentation(profile.unlock, wrapperPosition)
      : null,
    modeSelectTargetCallbackRegisteredBeforeWrapperCallback: true as const,
    resources,
    wrapperPosition,
  });
}

function createLockPresentation(
  resources: ModeSelectTwoFrameRasterSet,
  cardPoint: ModeSelectPoint,
): ModeSelectLockPresentation {
  return deepFreeze({
    currentIndexCoupled: true as const,
    fruitCutDisabled: true as const,
    hiddenNotRemovedOnUnlock: true as const,
    itemAnchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
    itemPosition: point(cardPoint.x, multiplyFloat32(HALF, cardPoint.y)),
    menuAnchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
    menuPosition: point(0, 0),
    parent: 'contained-intact-fruit' as const,
    resources,
    senderIdentityUsed: false as const,
    target: 'mode-select-unlock-current-index-callback' as const,
    zOrder: MODE_SELECT_ROOT_Z_ORDER,
  });
}

function createRopeJoints(): readonly ModeSelectRopeRevoluteJointPresentation[] {
  const joints: ModeSelectRopeRevoluteJointPresentation[] = [];
  for (let index = 0; index < MODE_SELECT_ROPE_LINK_COUNT; index += 1) {
    joints.push(Object.freeze({
      bodyA: index === 0 ? 'static-anchor' as const : `rope-link-${index - 1}`,
      bodyB: `rope-link-${index}`,
      chainIndex: index,
      type: 'revolute' as const,
    }));
  }
  joints.push(Object.freeze({
    bodyA: `rope-link-${MODE_SELECT_ROPE_LINK_COUNT - 1}`,
    bodyB: 'fruit-body' as const,
    chainIndex: MODE_SELECT_ROPE_LINK_COUNT,
    type: 'revolute' as const,
  }));
  return Object.freeze(joints);
}

function createRopeSynchronization(
  resources: ModeSelectRasterProfile,
  anchorPoint: ModeSelectPoint,
  retainedFruitY: number,
): ModeSelectRopeSynchronizationPresentation {
  const wheelOffset = divideFloat32(
    resources.wheel.dimensions.height,
    WHEEL_OFFSET_DIVISOR,
  );
  const wheelRotation = multiplyFloat32(
    divideFloat32(anchorPoint.x, WHEEL_ROTATION_DIVISOR),
    RADIANS_TO_DEGREES,
  );
  return deepFreeze({
    connectorPosition: anchorPoint,
    fruitPosition: point(anchorPoint.x, retainedFruitY),
    fruitYSource: 'retained-requested-point-y' as const,
    lowerWheelPosition: point(anchorPoint.x, subtractFloat32(anchorPoint.y, wheelOffset)),
    lowerWheelRotationDegrees: wheelRotation,
    upperWheelPosition: point(anchorPoint.x, addFloat32(anchorPoint.y, wheelOffset)),
    upperWheelRotationDegrees: wheelRotation,
    wheelRotationFormula: {
      radiansToDegrees: RADIANS_TO_DEGREES,
      xDivisor: WHEEL_ROTATION_DIVISOR,
    },
  });
}

function createUnlockContainer(
  resource: ClassicRasterResource,
  burstPlan: ModeSelectUnlockBurstPlan,
): ModeSelectUnlockContainerPresentation {
  return deepFreeze({
    anchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
    burstPlan,
    childOrder: 'particle-creation-order' as const,
    resource,
    timeline: [
      delay(burstPlan.startDelaySeconds),
      {
        callback: 'create-45-particle-explosion' as const,
        synchronous: true as const,
        type: 'invoke-callback' as const,
      },
      delay(burstPlan.cleanupDelaySeconds),
      { cleanup: true as const, type: 'remove-container' as const },
    ],
    zOrder: MODE_SELECT_ROOT_Z_ORDER,
  });
}

function stateLayout(viewport: ModeSelectViewport): Readonly<{
  readonly logicalHeight: number;
  readonly logicalWidth: number;
  readonly visibleCenterX: number;
  readonly visibleLeftX: number;
}> {
  return Object.freeze({
    logicalHeight: viewport.logicalHeight,
    logicalWidth: viewport.logicalWidth,
    visibleCenterX: viewport.visibleRect.center.x,
    visibleLeftX: viewport.visibleRect.left.x,
  });
}

function assertInitialStateShape(initialState: ModeSelectStateSnapshot): void {
  if (
    initialState.currentIndex !== MODE_SELECT_INITIAL_CURRENT_INDEX
    || initialState.destinationState !== MODE_SELECT_INITIAL_DESTINATION_STATE
  ) {
    throw new Error('Mode Select state must preserve recovered constructor indices');
  }
  if (initialState.anchorXs[5] !== initialState.layout.visibleCenterX) {
    throw new Error('Mode Select construction must initially center Combo Bird');
  }
}

function copyViewport(viewport: ModeSelectViewport): ModeSelectViewport {
  if (viewport === null || typeof viewport !== 'object' || Array.isArray(viewport)) {
    throw new TypeError('viewport must be an object');
  }
  const logicalWidth = positiveFiniteFloat32(viewport.logicalWidth, 'viewport.logicalWidth');
  const logicalHeight = positiveFiniteFloat32(viewport.logicalHeight, 'viewport.logicalHeight');
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

function copyPoint(value: ModeSelectPoint, label: string): ModeSelectPoint {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return point(
    finiteFloat32(value.x, `${label}.x`),
    finiteFloat32(value.y, `${label}.y`),
  );
}

function moveBy(durationSeconds: number, deltaValue: ModeSelectPoint): ModeSelectMoveByAction {
  return deepFreeze({
    delta: deltaValue,
    durationSeconds: finiteFloat32(durationSeconds, 'move durationSeconds'),
    easing: null,
    type: 'move-by' as const,
  });
}

function rotateBy(
  durationSeconds: number,
  deltaDegrees: number,
): ModeSelectRotateByAction {
  return Object.freeze({
    deltaDegrees: finiteFloat32(deltaDegrees, 'rotation deltaDegrees'),
    durationSeconds: finiteFloat32(durationSeconds, 'rotation durationSeconds'),
    easing: null,
    type: 'rotate-by',
  });
}

function repeatRotation(
  durationSeconds: number,
  deltaDegrees: number,
): ModeSelectRepeatRotationAction {
  return deepFreeze({
    action: rotateBy(durationSeconds, deltaDegrees),
    type: 'repeat-forever' as const,
  });
}

function fade(
  durationSeconds: number,
  type: 'fade-in' | 'fade-out',
): ModeSelectFadeAction {
  return Object.freeze({
    durationSeconds: finiteFloat32(durationSeconds, 'fade durationSeconds'),
    easing: null,
    type,
  });
}

function delay(durationSeconds: number): ModeSelectDelayAction {
  return Object.freeze({
    durationSeconds: finiteFloat32(durationSeconds, 'delay durationSeconds'),
    type: 'delay',
  });
}

function scaleTo(durationSeconds: number, scale: number): ModeSelectScaleToAction {
  return Object.freeze({
    durationSeconds: finiteFloat32(durationSeconds, 'scale durationSeconds'),
    easing: null,
    scaleX: finiteFloat32(scale, 'scaleX'),
    scaleY: finiteFloat32(scale, 'scaleY'),
    type: 'scale-to',
  });
}

function worldToMetres(worldPoint: ModeSelectPoint): ModeSelectPoint {
  return point(
    divideFloat32(worldPoint.x, MODE_SELECT_PHYSICS_WORLD_UNITS_PER_METRE),
    divideFloat32(worldPoint.y, MODE_SELECT_PHYSICS_WORLD_UNITS_PER_METRE),
  );
}

function point(x: number, y: number): ModeSelectPoint {
  return Object.freeze({
    x: finiteFloat32(x, 'point.x'),
    y: finiteFloat32(y, 'point.y'),
  });
}

function positiveFiniteFloat32(value: number, label: string): number {
  const floatValue = finiteFloat32(value, label);
  if (floatValue <= 0) {
    throw new RangeError(`${label} must be positive in float32`);
  }
  return floatValue;
}

function finiteFloat32(value: number, label: string): number {
  const floatValue = Math.fround(value);
  if (!Number.isFinite(value) || !Number.isFinite(floatValue)) {
    throw new RangeError(`${label} must be finite in float32`);
  }
  return floatValue;
}

function assertSignedInt32(value: number, label: string): void {
  if (
    !Number.isSafeInteger(value)
    || value < -0x8000_0000
    || value > 0x7fff_ffff
  ) {
    throw new RangeError(`${label} must be a signed 32-bit integer`);
  }
}

function assertUnlockParticleRandom(random: ModeSelectUnlockParticleRandom): void {
  if (
    random === null
    || typeof random !== 'object'
    || typeof random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive(minimum, maximum)');
  }
}

function requireArrayValue<T>(values: readonly T[], index: number, label: string): T {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`${label}[${index}] is unavailable`);
  }
  return value;
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
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, bits, false);
  return view.getFloat32(0, false);
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
