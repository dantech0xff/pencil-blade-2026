import type { GameplayRandom } from './gameplay-random';
import type { FruitFixtureConfiguration } from './classic-fixture-rules';
import { createFruitFixtureConfiguration } from './classic-fixture-rules';
import type {
  MainMenuFruitButtonPurpose,
  MainMenuFruitButtonRasterSet,
  MainMenuRasterProfile,
} from './main-menu-resource-contract';
import {
  MAIN_MENU_FONT_CANONICAL_PATH,
  MAIN_MENU_FRUIT_BUTTON_PURPOSE_ORDER,
  getMainMenuFruitButtonDefinition,
  getMainMenuRasterResources,
} from './main-menu-resource-contract';
import type { ClassicAssetTree } from './resolution-profile-service';

export const MAIN_MENU_ROOT_Z_ORDER = 1 as const;
export const MAIN_MENU_GESTURES_DEFAULT_Z_ORDER = 0 as const;
export const MAIN_MENU_PHYSICS_WORLD_UNITS_PER_METRE = 32 as const;
export const MAIN_MENU_ENTRY_FADE_SECONDS = Math.fround(1.25);
export const MAIN_MENU_FRUIT_CIRCLE_ROTATION_SECONDS = Math.fround(15);
export const MAIN_MENU_FRUIT_CIRCLE_ROTATION_DEGREES = Math.fround(-360);
export const MAIN_MENU_FRUIT_CIRCLE_CUT_SECONDS = Math.fround(0.75);
export const MAIN_MENU_FRUIT_ANGULAR_VELOCITY_RADIANS_PER_SECOND = Math.fround(2);
export const MAIN_MENU_REVIEW_PULSE_LEG_SECONDS = Math.fround(0.45);
export const MAIN_MENU_REVIEW_PULSE_CYCLE_SECONDS = Math.fround(0.9);
export const MAIN_MENU_REVIEW_PULSE_APEX_SCALE = Math.fround(1.15);
export const MAIN_MENU_TOTAL_COINS_FORMAT = '%d' as const;
export const MAIN_MENU_TOTAL_COINS_REFERENCE_WIDTH = Math.fround(480);
export const MAIN_MENU_TOTAL_COINS_BASE_POINT_SIZE = Math.fround(34);

const HALF = Math.fround(0.5);
const QUARTER = Math.fround(0.25);
const THREE_QUARTERS = Math.fround(0.75);
const ONE_AND_QUARTER = Math.fround(1.25);
const MENU_ROW_Y_FACTOR = Math.fround(0.175);
const ABOUT_Y_FACTOR = Math.fround(0.3);
const COINS_Y_FACTOR = Math.fround(0.05);
const COINS_FINAL_X_FACTOR = Math.fround(0.3);
const EFFECTS_X_FACTOR = float32FromBits(0x3eb3_3333);
const WHEEL_X_FACTOR = float32FromBits(0x3f19_999a);
const COINS_LABEL_X_FACTOR = float32FromBits(0x3e3d_70a4);
const REVIEW_Y_FACTOR = float32FromBits(0x3d38_51ec);
const LEADERBOARD_Y_FACTOR = float32FromBits(0x3f0c_cccd);
const OBJECTIVES_Y_FACTOR = float32FromBits(0x3f22_8f5c);
const INITIAL_BLUR_X_FACTOR = float32FromBits(0x3db8_51ec);
const POST_ENTRY_BLUR_X_FACTOR = float32FromBits(0x3da3_d70a);
const HEART_X_MINIMUM_FACTOR = float32FromBits(0x3f39_9999);
const HEART_X_MAXIMUM_FACTOR = Math.fround(0.8);
const HEART_Y_MINIMUM_FACTOR = Math.fround(0.025);
const HEART_Y_MAXIMUM_FACTOR = Math.fround(0.075);
const HEART_RISE_MINIMUM_FACTOR = Math.fround(0.1);
const HEART_RISE_MAXIMUM_FACTOR = Math.fround(0.25);

export interface MainMenuPoint {
  readonly x: number;
  readonly y: number;
}

export interface MainMenuVisibleRect {
  readonly bottom: MainMenuPoint;
  readonly center: MainMenuPoint;
  readonly left: MainMenuPoint;
  readonly right: MainMenuPoint;
  readonly top: MainMenuPoint;
}

export interface MainMenuViewport {
  /** Raw logical director height H. */
  readonly logicalHeight: number;
  /** Raw logical director width W. */
  readonly logicalWidth: number;
  readonly visibleRect: MainMenuVisibleRect;
}

export interface MainMenuAnchor {
  readonly evidence: 'inferred-legacy-default' | 'recovered-setter';
  readonly x: number;
  readonly y: number;
}

export interface MainMenuMoveToAction {
  readonly durationSeconds: number;
  readonly target: MainMenuPoint;
  readonly type: 'move-to';
}

export interface MainMenuFadeInAction {
  readonly durationSeconds: number;
  readonly type: 'fade-in';
}

export interface MainMenuDelayAction {
  readonly durationSeconds: number;
  readonly type: 'delay';
}

export interface MainMenuScaleToAction {
  readonly durationSeconds: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly type: 'scale-to';
}

export interface MainMenuRotateByAction {
  readonly deltaDegrees: number;
  readonly durationSeconds: number;
  readonly type: 'rotate-by';
}

export interface MainMenuMoveSequenceAction {
  readonly actions: readonly [MainMenuDelayAction, MainMenuMoveToAction];
  readonly type: 'sequence';
}

export interface MainMenuForeverRotationAction {
  readonly action: MainMenuRotateByAction;
  readonly type: 'repeat-forever';
}

export interface MainMenuReviewPulseAction {
  readonly plan: MainMenuReviewPulsePlan;
  readonly type: 'review-pulse';
}

export type MainMenuEntryAction =
  | MainMenuFadeInAction
  | MainMenuForeverRotationAction
  | MainMenuMoveSequenceAction
  | MainMenuMoveToAction
  | MainMenuReviewPulseAction;

export interface MainMenuEntryNode<TResource> {
  readonly actions: readonly MainMenuEntryAction[];
  readonly actionsRunConcurrently: boolean;
  readonly anchor: MainMenuAnchor;
  readonly finalPosition: MainMenuPoint;
  readonly inferredInitialRotationDegrees: 0;
  readonly inferredInitialScale: MainMenuPoint;
  readonly initialPosition: MainMenuPoint;
  readonly resource: TResource;
  readonly zOrder: 1;
}

export interface MainMenuTotalCoinsLabelLayout {
  readonly actions: readonly [MainMenuMoveToAction, MainMenuFadeInAction];
  readonly actionsRunConcurrently: true;
  readonly anchor: MainMenuAnchor;
  readonly fontCanonicalPath: typeof MAIN_MENU_FONT_CANONICAL_PATH;
  readonly fontPointSize: number;
  readonly format: typeof MAIN_MENU_TOTAL_COINS_FORMAT;
  readonly initialPosition: MainMenuPoint;
  readonly finalPosition: MainMenuPoint;
  readonly inferredDefaultColor: 'white';
  readonly settingsReadCountBeforeConstruction: 2;
  readonly secondReadResultUsed: false;
  readonly text: string;
  readonly zOrder: 1;
}

export interface MainMenuReviewPulsePlan {
  readonly cycleDurationSeconds: number;
  readonly firstEmissionAtSeconds: number;
  readonly initialScale: 1;
  readonly initialScaleEvidence: 'inferred-legacy-default';
  readonly repeatForever: true;
  readonly secondEmissionAtSeconds: number;
  readonly sequence: readonly [
    MainMenuScaleToAction,
    Readonly<{ readonly callback: 'add-heart'; readonly type: 'invoke-callback' }>,
    MainMenuScaleToAction,
    Readonly<{ readonly callback: 'add-heart'; readonly type: 'invoke-callback' }>,
  ];
}

export type MainMenuHeartRandom = Pick<
  GameplayRandom,
  'nextDecile' | 'nextIntInclusive'
>;

export interface MainMenuHeartRandomDraw {
  readonly kind: 'inclusive-integer' | 'decile';
  readonly maximumInclusive?: number;
  readonly minimumInclusive?: number;
  readonly name: 'x' | 'y' | 'qScale' | 'qDuration' | 'rise';
  readonly value: number;
}

export interface MainMenuHeartEmissionPlan {
  readonly actions: readonly [
    Readonly<{ readonly durationSeconds: number; readonly type: 'fade-out' }>,
    Readonly<{
      readonly delta: MainMenuPoint;
      readonly durationSeconds: number;
      readonly type: 'move-by';
    }>,
  ];
  readonly actionsRunConcurrently: true;
  readonly actionsStartBeforeRootAttachment: true;
  readonly anchor: MainMenuAnchor;
  readonly durationSeconds: number;
  readonly finalState: 'invisible-retained-child';
  readonly perHeartCleanupAction: false;
  readonly position: MainMenuPoint;
  readonly randomDraws: readonly [
    MainMenuHeartRandomDraw,
    MainMenuHeartRandomDraw,
    MainMenuHeartRandomDraw,
    MainMenuHeartRandomDraw,
    MainMenuHeartRandomDraw,
  ];
  readonly resourceCanonicalPath: string;
  readonly rise: number;
  readonly scale: number;
  readonly seedParityClaimed: false;
  readonly zOrder: 1;
}

export interface MainMenuFruitBodyEntryState {
  readonly angleRadians: 0;
  readonly angularVelocityRadiansPerSecond: number;
  readonly awake: true;
  readonly gravityScale: 0;
  readonly positionMetres: MainMenuPoint;
  readonly positionWorldUnits: MainMenuPoint;
  readonly worldUnitConversionOwner: 'existing-physics-adapter';
}

export interface MainMenuFruitButtonPresentation {
  readonly audio: Readonly<{
    readonly canonicalPath: string;
    readonly effectsGated: true;
    readonly loop: false;
  }>;
  readonly bodyOnEntry: MainMenuFruitBodyEntryState;
  readonly blur: Readonly<{
    readonly anchor: MainMenuAnchor;
    readonly fadeInSeconds: number;
    readonly initialOpacity: 0;
    readonly initialPosition: MainMenuPoint;
    readonly postEntrySetPosition: MainMenuPoint;
    readonly removedOnCutWithCleanup: true;
    readonly zOrder: 1;
  }>;
  readonly circle: Readonly<{
    readonly anchor: MainMenuAnchor;
    readonly cutScaleAction: MainMenuScaleToAction;
    readonly entryActions: readonly [MainMenuFadeInAction, MainMenuForeverRotationAction];
    readonly entryActionsRunConcurrently: true;
    readonly initialOpacity: 0;
    readonly position: MainMenuPoint;
    readonly zOrder: 1;
  }>;
  readonly factoryFixture: FruitFixtureConfiguration;
  readonly fruit: Readonly<{
    readonly anchor: MainMenuAnchor;
    readonly cutEventRegisteredOnEnter: true;
    readonly fadeInSeconds: number;
    readonly initialOpacity: 0;
    readonly position: MainMenuPoint;
    readonly zOrder: 1;
  }>;
  readonly fruitId: 2 | 7 | 13;
  readonly localChildOrder: typeof MAIN_MENU_FRUIT_BUTTON_CHILD_ORDER;
  readonly mainMenuPositionsBeforeAttachment: true;
  readonly purpose: MainMenuFruitButtonPurpose;
  readonly resources: MainMenuFruitButtonRasterSet;
  readonly wrapperPosition: MainMenuPoint;
  readonly wrapperRootZOrder: 1;
}

export interface MainMenuFruitCutPresentationPlan {
  readonly effectsEnabled: boolean;
  readonly fruitId: 2 | 7 | 13;
  readonly menuButtonClickRequested: false;
  readonly orderedOperations: readonly MainMenuFruitCutOperation[];
  readonly purpose: MainMenuFruitButtonPurpose;
}

export type MainMenuFruitCutOperation =
  | Readonly<{ readonly canonicalPath: string; readonly type: 'attach-cut-bottom-half' }>
  | Readonly<{ readonly canonicalPath: string; readonly type: 'attach-cut-top-half' }>
  | Readonly<{ readonly canonicalPath: string; readonly loop: false; readonly type: 'request-fruit-audio' }>
  | Readonly<{ readonly type: 'invoke-main-menu-navigation-callback' }>
  | Readonly<{ readonly type: 'mark-fruit-button-cut' }>
  | Readonly<{ readonly cleanup: true; readonly type: 'remove-fruit-button-blur' }>
  | Readonly<{ readonly action: MainMenuScaleToAction; readonly type: 'run-fruit-button-circle-action' }>
  | Readonly<{ readonly type: 'continue-shared-fruit-notifications' }>;

export interface MainMenuPresentationSnapshot {
  readonly assetTree: ClassicAssetTree;
  readonly bladeDependency: typeof MAIN_MENU_BLADE_DEPENDENCY_ORDER;
  readonly controls: Readonly<{
    readonly about: MainMenuEntryNode<MainMenuRasterProfile['about']>;
    readonly blueWheelOptions: MainMenuEntryNode<MainMenuRasterProfile['blueWheelOptions']>;
    readonly effectsToggle: MainMenuEntryNode<MainMenuRasterProfile['effectsToggle']>;
    readonly exit: MainMenuEntryNode<MainMenuRasterProfile['exit']>;
    readonly menuOrigin: MainMenuPoint;
    readonly musicToggle: MainMenuEntryNode<MainMenuRasterProfile['musicToggle']>;
    readonly review: MainMenuEntryNode<MainMenuRasterProfile['review']>;
  }>;
  readonly fruitButtons: readonly MainMenuFruitButtonPresentation[];
  readonly importedGameSceneRoots: typeof MAIN_MENU_GAME_SCENE_ROOT_ORDER;
  readonly menuItemOrder: typeof MAIN_MENU_MENU_ITEM_ORDER;
  readonly ownedRootOrder: typeof MAIN_MENU_OWNED_ROOT_CHILD_ORDER;
  readonly shell: Readonly<{
    readonly pencilBlade: MainMenuEntryNode<MainMenuRasterProfile['pencilBlade']> & Readonly<{
      readonly directForegroundFadeActionPresent: false;
      readonly titleHeightMultiplierIsVisualScale: false;
    }>;
    readonly pencilBladeBackground: MainMenuEntryNode<MainMenuRasterProfile['pencilBladeBackground']>;
    readonly totalCoinsLabel: MainMenuTotalCoinsLabelLayout;
    readonly totalCoinsPanel: MainMenuEntryNode<MainMenuRasterProfile['totalCoinsPanel']>;
  }>;
  readonly toggleSubitemOrder: typeof MAIN_MENU_TOGGLE_SUBITEM_ORDER;
  readonly viewport: MainMenuViewport;
  readonly wheels: Readonly<{
    readonly black: MainMenuEntryNode<MainMenuRasterProfile['blackWheel']>;
    readonly orange: MainMenuEntryNode<MainMenuRasterProfile['orangeWheel']>;
  }>;
}

export const MAIN_MENU_INFERRED_CENTER_ANCHOR: MainMenuAnchor = Object.freeze({
  evidence: 'inferred-legacy-default',
  x: Math.fround(0.5),
  y: Math.fround(0.5),
});

export const MAIN_MENU_TOTAL_COINS_LABEL_ANCHOR: MainMenuAnchor = Object.freeze({
  evidence: 'recovered-setter',
  x: 0,
  y: Math.fround(0.5),
});

export const MAIN_MENU_INFERRED_UNIT_SCALE = Object.freeze({ x: 1, y: 1 });

export const MAIN_MENU_GAME_SCENE_ROOT_ORDER = deepFreeze([
  { child: 'BackgroundLayer' as const, insertion: 1 as const, tag: 0 as const, zOrder: 1 as const },
  { child: 'LeafLayer' as const, insertion: 2 as const, tag: 1 as const, zOrder: 1 as const },
  { child: 'ThemeLayer' as const, insertion: 3 as const, tag: 2 as const, zOrder: 1 as const },
  { child: 'MainMenuLayer' as const, insertion: 4 as const, tag: 3 as const, zOrder: 1 as const },
]);

export const MAIN_MENU_IMPORTED_CLEAN_SETTINGS_DEFAULTS = Object.freeze({
  selectedBackground: 0 as const,
  selectedTheme: 2 as const,
});

export const MAIN_MENU_IMPORTED_CLEAN_COMPOSITE_ORDER = Object.freeze([
  'paperbackground0',
  'seven-independent-leaves',
  'theme2',
  'main-menu-foreground',
] as const);

export const MAIN_MENU_BLADE_DEPENDENCY_ORDER = Object.freeze({
  selectedBladeChildCount: 4 as const,
  selectedBladeChildrenPrecedeOwnedRoots: true as const,
});

export const MAIN_MENU_VISIBLE_ROOT_Z1_ORDER = Object.freeze([
  'pencilbladebk',
  'pencilblade',
  'total-coins-panel',
  'total-coins-label',
  'menu',
  'orange-wheel',
  'black-wheel',
  'leaderboard-fruit-button',
  'objectives-fruit-button',
  'new-game-fruit-button',
] as const);

export const MAIN_MENU_OWNED_ROOT_CHILD_ORDER = deepFreeze([
  ...MAIN_MENU_VISIBLE_ROOT_Z1_ORDER.map((child, offset) => ({
    child,
    insertion: offset + 1,
    visible: true as const,
    zOrder: MAIN_MENU_ROOT_Z_ORDER,
  })),
  {
    child: 'gestures-layer' as const,
    insertion: 11,
    visible: false as const,
    zOrder: MAIN_MENU_GESTURES_DEFAULT_Z_ORDER,
  },
]);

export const MAIN_MENU_MENU_ITEM_ORDER = Object.freeze([
  'about',
  'review',
  'music-toggle',
  'effects-toggle',
  'blue-wheel-options',
  'exit',
] as const);

/** Both toggles start at index 0; index 1 reuses the same selected frame. */
export const MAIN_MENU_TOGGLE_SUBITEM_ORDER = deepFreeze([
  {
    initialSelectedIndex: 0 as const,
    normalFrameRole: 'normal' as const,
    selectedFrameRole: 'selected' as const,
    subitemIndex: 0 as const,
  },
  {
    initialSelectedIndex: 0 as const,
    normalFrameRole: 'disabled' as const,
    selectedFrameRole: 'selected' as const,
    subitemIndex: 1 as const,
  },
]);

export const MAIN_MENU_FRUIT_BUTTON_CHILD_ORDER = Object.freeze([
  'blur',
  'circle-art',
  'intact-fruit',
] as const);

export const MAIN_MENU_FRUIT_CUT_CALLBACK_ORDER = Object.freeze([
  'fruit-cut-and-audio',
  'main-menu-navigation-callback',
  'fruit-button-wrapper-callback',
  'remaining-fruit-notifications',
] as const);

export const MAIN_MENU_REVIEW_PULSE_PLAN: MainMenuReviewPulsePlan = deepFreeze({
  cycleDurationSeconds: MAIN_MENU_REVIEW_PULSE_CYCLE_SECONDS,
  firstEmissionAtSeconds: MAIN_MENU_REVIEW_PULSE_LEG_SECONDS,
  initialScale: 1 as const,
  initialScaleEvidence: 'inferred-legacy-default' as const,
  repeatForever: true as const,
  secondEmissionAtSeconds: MAIN_MENU_REVIEW_PULSE_CYCLE_SECONDS,
  sequence: [
    scaleTo(MAIN_MENU_REVIEW_PULSE_LEG_SECONDS, MAIN_MENU_REVIEW_PULSE_APEX_SCALE),
    { callback: 'add-heart' as const, type: 'invoke-callback' as const },
    scaleTo(MAIN_MENU_REVIEW_PULSE_LEG_SECONDS, 1),
    { callback: 'add-heart' as const, type: 'invoke-callback' as const },
  ],
});

/** Pure snapshot of the exact owned Main Menu layout and independent entry actions. */
export function createMainMenuPresentation(
  assetTree: ClassicAssetTree,
  viewport: MainMenuViewport,
  totalCoins: number,
): MainMenuPresentationSnapshot {
  const copiedViewport = copyViewport(viewport);
  assertSignedInt32(totalCoins, 'totalCoins');
  const resources = getMainMenuRasterResources(assetTree);
  const width = copiedViewport.logicalWidth;
  const height = copiedViewport.logicalHeight;
  const { visibleRect } = copiedViewport;
  const menuY = multiplyFloat32(height, MENU_ROW_Y_FACTOR);
  const coinsY = addFloat32(
    visibleRect.bottom.y,
    multiplyFloat32(height, COINS_Y_FACTOR),
  );
  const wheelX = multiplyFloat32(width, WHEEL_X_FACTOR);

  const backgroundFinal = point(
    visibleRect.center.x,
    subtractFloat32(
      visibleRect.top.y,
      multiplyFloat32(HALF, resources.pencilBladeBackground.dimensions.height),
    ),
  );
  const background = entryNode(
    resources.pencilBladeBackground,
    point(
      visibleRect.center.x,
      addFloat32(
        visibleRect.top.y,
        multiplyFloat32(HALF, resources.pencilBladeBackground.dimensions.height),
      ),
    ),
    backgroundFinal,
    [
      moveTo(Math.fround(0.5), backgroundFinal),
      fadeIn(Math.fround(0.5)),
      fadeIn(Math.fround(0.75)),
    ],
    true,
  );

  const titleVerticalOffset = multiplyFloat32(
    HALF,
    multiplyFloat32(ONE_AND_QUARTER, resources.pencilBlade.dimensions.height),
  );
  const titleY = subtractFloat32(visibleRect.top.y, titleVerticalOffset);
  const titleFinal = point(visibleRect.center.x, titleY);
  const title = deepFreeze({
    ...entryNode(
      resources.pencilBlade,
      point(
        subtractFloat32(
          visibleRect.left.x,
          multiplyFloat32(HALF, resources.pencilBlade.dimensions.width),
        ),
        titleY,
      ),
      titleFinal,
      [delayedMove(Math.fround(0.25), Math.fround(0.5), titleFinal)],
      false,
    ),
    directForegroundFadeActionPresent: false as const,
    titleHeightMultiplierIsVisualScale: false as const,
  });

  const coinsPanelFinal = point(
    addFloat32(visibleRect.left.x, multiplyFloat32(width, COINS_FINAL_X_FACTOR)),
    coinsY,
  );
  const coinsPanel = entryNode(
    resources.totalCoinsPanel,
    point(
      subtractFloat32(
        visibleRect.left.x,
        multiplyFloat32(HALF, resources.totalCoinsPanel.dimensions.width),
      ),
      coinsY,
    ),
    coinsPanelFinal,
    [moveTo(Math.fround(1.75), coinsPanelFinal), fadeIn(Math.fround(1.75))],
    true,
  );
  const coinsLabelFinal = point(
    addFloat32(visibleRect.left.x, multiplyFloat32(width, COINS_LABEL_X_FACTOR)),
    coinsY,
  );
  const coinsLabel: MainMenuTotalCoinsLabelLayout = deepFreeze({
    actions: [moveTo(Math.fround(1.75), coinsLabelFinal), fadeIn(Math.fround(1.75))],
    actionsRunConcurrently: true as const,
    anchor: MAIN_MENU_TOTAL_COINS_LABEL_ANCHOR,
    finalPosition: coinsLabelFinal,
    fontCanonicalPath: MAIN_MENU_FONT_CANONICAL_PATH,
    fontPointSize: multiplyFloat32(
      divideFloat32(width, MAIN_MENU_TOTAL_COINS_REFERENCE_WIDTH),
      MAIN_MENU_TOTAL_COINS_BASE_POINT_SIZE,
    ),
    format: MAIN_MENU_TOTAL_COINS_FORMAT,
    inferredDefaultColor: 'white' as const,
    initialPosition: point(
      subtractFloat32(
        visibleRect.left.x,
        multiplyFloat32(HALF, resources.totalCoinsPanel.dimensions.width),
      ),
      coinsY,
    ),
    secondReadResultUsed: false as const,
    settingsReadCountBeforeConstruction: 2 as const,
    text: formatMainMenuTotalCoins(totalCoins),
    zOrder: MAIN_MENU_ROOT_Z_ORDER,
  });

  const musicFinal = point(multiplyFloat32(width, Math.fround(0.125)), menuY);
  const music = entryNode(
    resources.musicToggle,
    point(
      subtractFloat32(
        visibleRect.left.x,
        multiplyFloat32(HALF, resources.musicToggle.normal.dimensions.width),
      ),
      menuY,
    ),
    musicFinal,
    [moveTo(Math.fround(1.5), musicFinal), fadeIn(Math.fround(1.25))],
    true,
  );

  const effectsFinal = point(multiplyFloat32(width, EFFECTS_X_FACTOR), menuY);
  const effects = entryNode(
    resources.effectsToggle,
    point(
      subtractFloat32(
        visibleRect.left.x,
        multiplyFloat32(HALF, resources.effectsToggle.normal.dimensions.width),
      ),
      menuY,
    ),
    effectsFinal,
    [moveTo(Math.fround(1), effectsFinal), fadeIn(Math.fround(1.5))],
    true,
  );

  const aboutFinal = point(
    multiplyFloat32(width, Math.fround(0.125)),
    multiplyFloat32(height, ABOUT_Y_FACTOR),
  );
  const about = entryNode(
    resources.about,
    point(
      subtractFloat32(
        visibleRect.left.x,
        multiplyFloat32(HALF, resources.about.normal.dimensions.width),
      ),
      aboutFinal.y,
    ),
    aboutFinal,
    [moveTo(Math.fround(1), aboutFinal), fadeIn(Math.fround(1))],
    true,
  );

  const blueWheelFinal = point(wheelX, menuY);
  const blueWheel = entryNode(
    resources.blueWheelOptions,
    point(wheelX, subtractFloat32(menuY, Math.fround(300))),
    blueWheelFinal,
    [
      moveTo(Math.fround(1.25), blueWheelFinal),
      fadeIn(Math.fround(1.25)),
      repeatRotation(Math.fround(12.5), Math.fround(360)),
    ],
    true,
  );

  const orangeWheelX = addFloat32(wheelX, Math.fround(35));
  const orangeWheelFinal = point(
    orangeWheelX,
    subtractFloat32(menuY, Math.fround(35)),
  );
  const orangeWheel = entryNode(
    resources.orangeWheel,
    point(orangeWheelX, subtractFloat32(menuY, Math.fround(335))),
    orangeWheelFinal,
    [
      moveTo(Math.fround(1.25), orangeWheelFinal),
      fadeIn(Math.fround(1.25)),
      repeatRotation(Math.fround(12.5), Math.fround(-360)),
    ],
    true,
  );

  const blackWheelX = subtractFloat32(wheelX, Math.fround(6));
  const blackWheelFinal = point(blackWheelX, addFloat32(menuY, Math.fround(6)));
  const blackWheel = entryNode(
    resources.blackWheel,
    point(blackWheelX, subtractFloat32(menuY, Math.fround(294))),
    blackWheelFinal,
    [
      moveTo(Math.fround(1.25), blackWheelFinal),
      fadeIn(Math.fround(1.25)),
      repeatRotation(Math.fround(10.5), Math.fround(360)),
    ],
    true,
  );

  const exitFinal = point(
    subtractFloat32(
      visibleRect.right.x,
      multiplyFloat32(HALF, resources.exit.normal.dimensions.width),
    ),
    menuY,
  );
  const exit = entryNode(
    resources.exit,
    point(
      addFloat32(
        visibleRect.right.x,
        multiplyFloat32(HALF, resources.exit.normal.dimensions.width),
      ),
      menuY,
    ),
    exitFinal,
    [moveTo(Math.fround(1), exitFinal), fadeIn(Math.fround(1))],
    true,
  );

  const reviewFinal = point(
    multiplyFloat32(width, THREE_QUARTERS),
    multiplyFloat32(height, REVIEW_Y_FACTOR),
  );
  const review = entryNode(
    resources.review,
    point(reviewFinal.x, Math.fround(-resources.review.normal.dimensions.height)),
    reviewFinal,
    [
      moveTo(Math.fround(1.25), reviewFinal),
      fadeIn(Math.fround(1)),
      deepFreeze({ plan: MAIN_MENU_REVIEW_PULSE_PLAN, type: 'review-pulse' as const }),
    ],
    true,
  );

  return deepFreeze({
    assetTree,
    bladeDependency: MAIN_MENU_BLADE_DEPENDENCY_ORDER,
    controls: {
      about,
      blueWheelOptions: blueWheel,
      effectsToggle: effects,
      exit,
      menuOrigin: point(0, 0),
      musicToggle: music,
      review,
    },
    fruitButtons: createMainMenuFruitButtonPresentations(assetTree, copiedViewport),
    importedGameSceneRoots: MAIN_MENU_GAME_SCENE_ROOT_ORDER,
    menuItemOrder: MAIN_MENU_MENU_ITEM_ORDER,
    ownedRootOrder: MAIN_MENU_OWNED_ROOT_CHILD_ORDER,
    shell: {
      pencilBlade: title,
      pencilBladeBackground: background,
      totalCoinsLabel: coinsLabel,
      totalCoinsPanel: coinsPanel,
    },
    toggleSubitemOrder: MAIN_MENU_TOGGLE_SUBITEM_ORDER,
    viewport: copiedViewport,
    wheels: { black: blackWheel, orange: orangeWheel },
  });
}

export function createMainMenuFruitButtonPresentations(
  assetTree: ClassicAssetTree,
  viewport: MainMenuViewport,
): readonly MainMenuFruitButtonPresentation[] {
  const copiedViewport = copyViewport(viewport);
  getMainMenuRasterResources(assetTree);
  return deepFreeze(MAIN_MENU_FRUIT_BUTTON_PURPOSE_ORDER.map((purpose) => (
    createFruitButtonPresentation(purpose, assetTree, copiedViewport)
  )));
}

export function createMainMenuFruitCutPresentationPlan(
  purpose: MainMenuFruitButtonPurpose,
  assetTree: ClassicAssetTree,
  effectsEnabled: boolean,
): MainMenuFruitCutPresentationPlan {
  if (typeof effectsEnabled !== 'boolean') {
    throw new TypeError('effectsEnabled must be a boolean');
  }
  getMainMenuRasterResources(assetTree);
  const definition = getMainMenuFruitButtonDefinition(purpose);
  const rasters = definition.rasters[assetTree];
  const circleScale = scaleTo(MAIN_MENU_FRUIT_CIRCLE_CUT_SECONDS, 0);
  const operations: MainMenuFruitCutOperation[] = [
    deepFreeze({
      canonicalPath: rasters.cutBottom.canonicalPath,
      type: 'attach-cut-bottom-half' as const,
    }),
    deepFreeze({
      canonicalPath: rasters.cutTop.canonicalPath,
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
    deepFreeze({ type: 'invoke-main-menu-navigation-callback' as const }),
    deepFreeze({ type: 'mark-fruit-button-cut' as const }),
    deepFreeze({ cleanup: true as const, type: 'remove-fruit-button-blur' as const }),
    deepFreeze({ action: circleScale, type: 'run-fruit-button-circle-action' as const }),
    deepFreeze({ type: 'continue-shared-fruit-notifications' as const }),
  );
  return deepFreeze({
    effectsEnabled,
    fruitId: definition.fruitId,
    menuButtonClickRequested: false as const,
    orderedOperations: operations,
    purpose,
  });
}

/** Creates one retained heart and consumes exactly five recovered shared-stream draws. */
export function createMainMenuHeartEmissionPlan(
  assetTree: ClassicAssetTree,
  viewport: MainMenuViewport,
  random: MainMenuHeartRandom,
): MainMenuHeartEmissionPlan {
  const copiedViewport = copyViewport(viewport);
  const resources = getMainMenuRasterResources(assetTree);
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
  const durationSeconds = addFloat32(Math.fround(qDuration), Math.fround(1));
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
    anchor: MAIN_MENU_INFERRED_CENTER_ANCHOR,
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
    zOrder: MAIN_MENU_ROOT_Z_ORDER,
  });
}

/** Returns the nominal callback times for a deterministic number of full pulse cycles. */
export function createMainMenuReviewHeartEmissionTimes(
  cycleCount: number,
): readonly number[] {
  if (!Number.isSafeInteger(cycleCount) || cycleCount < 0) {
    throw new RangeError('cycleCount must be a non-negative safe integer');
  }
  const times: number[] = [];
  for (let cycle = 0; cycle < cycleCount; cycle += 1) {
    const cycleStart = multiplyFloat32(cycle, MAIN_MENU_REVIEW_PULSE_CYCLE_SECONDS);
    times.push(
      addFloat32(cycleStart, MAIN_MENU_REVIEW_PULSE_LEG_SECONDS),
      addFloat32(cycleStart, MAIN_MENU_REVIEW_PULSE_CYCLE_SECONDS),
    );
  }
  return Object.freeze(times);
}

export function formatMainMenuTotalCoins(totalCoins: number): string {
  assertSignedInt32(totalCoins, 'totalCoins');
  return `${totalCoins}`;
}

function createFruitButtonPresentation(
  purpose: MainMenuFruitButtonPurpose,
  assetTree: ClassicAssetTree,
  viewport: MainMenuViewport,
): MainMenuFruitButtonPresentation {
  const definition = getMainMenuFruitButtonDefinition(purpose);
  const resources = definition.rasters[assetTree];
  const wrapperPosition = fruitButtonPosition(purpose, viewport);
  const blurHeightOffset = multiplyFloat32(
    resources.blur.dimensions.height,
    Math.fround(0.05),
  );
  const initialBlurPosition = point(
    subtractFloat32(
      wrapperPosition.x,
      multiplyFloat32(INITIAL_BLUR_X_FACTOR, resources.blur.dimensions.width),
    ),
    subtractFloat32(wrapperPosition.y, blurHeightOffset),
  );
  const postEntryBlurPosition = point(
    subtractFloat32(
      wrapperPosition.x,
      multiplyFloat32(POST_ENTRY_BLUR_X_FACTOR, resources.blur.dimensions.width),
    ),
    subtractFloat32(wrapperPosition.y, blurHeightOffset),
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
        MAIN_MENU_FRUIT_ANGULAR_VELOCITY_RADIANS_PER_SECOND,
      awake: true as const,
      gravityScale: 0 as const,
      positionMetres: point(
        divideFloat32(wrapperPosition.x, MAIN_MENU_PHYSICS_WORLD_UNITS_PER_METRE),
        divideFloat32(wrapperPosition.y, MAIN_MENU_PHYSICS_WORLD_UNITS_PER_METRE),
      ),
      positionWorldUnits: wrapperPosition,
      worldUnitConversionOwner: 'existing-physics-adapter' as const,
    },
    blur: {
      anchor: MAIN_MENU_INFERRED_CENTER_ANCHOR,
      fadeInSeconds: MAIN_MENU_ENTRY_FADE_SECONDS,
      initialOpacity: 0 as const,
      initialPosition: initialBlurPosition,
      postEntrySetPosition: postEntryBlurPosition,
      removedOnCutWithCleanup: true as const,
      zOrder: MAIN_MENU_ROOT_Z_ORDER,
    },
    circle: {
      anchor: MAIN_MENU_INFERRED_CENTER_ANCHOR,
      cutScaleAction: scaleTo(MAIN_MENU_FRUIT_CIRCLE_CUT_SECONDS, 0),
      entryActions: [
        fadeIn(MAIN_MENU_ENTRY_FADE_SECONDS),
        repeatRotation(
          MAIN_MENU_FRUIT_CIRCLE_ROTATION_SECONDS,
          MAIN_MENU_FRUIT_CIRCLE_ROTATION_DEGREES,
        ),
      ],
      entryActionsRunConcurrently: true as const,
      initialOpacity: 0 as const,
      position: wrapperPosition,
      zOrder: MAIN_MENU_ROOT_Z_ORDER,
    },
    factoryFixture,
    fruit: {
      anchor: MAIN_MENU_INFERRED_CENTER_ANCHOR,
      cutEventRegisteredOnEnter: true as const,
      fadeInSeconds: MAIN_MENU_ENTRY_FADE_SECONDS,
      initialOpacity: 0 as const,
      position: wrapperPosition,
      zOrder: MAIN_MENU_ROOT_Z_ORDER,
    },
    fruitId: definition.fruitId,
    localChildOrder: MAIN_MENU_FRUIT_BUTTON_CHILD_ORDER,
    mainMenuPositionsBeforeAttachment: true as const,
    purpose,
    resources,
    wrapperPosition,
    wrapperRootZOrder: MAIN_MENU_ROOT_Z_ORDER,
  });
}

function fruitButtonPosition(
  purpose: MainMenuFruitButtonPurpose,
  viewport: MainMenuViewport,
): MainMenuPoint {
  switch (purpose) {
    case 'leaderboard':
      return point(
        multiplyFloat32(viewport.logicalWidth, QUARTER),
        multiplyFloat32(viewport.logicalHeight, LEADERBOARD_Y_FACTOR),
      );
    case 'objectives':
      return point(
        multiplyFloat32(viewport.logicalWidth, THREE_QUARTERS),
        multiplyFloat32(viewport.logicalHeight, OBJECTIVES_Y_FACTOR),
      );
    case 'new-game':
      return point(
        multiplyFloat32(viewport.logicalWidth, WHEEL_X_FACTOR),
        multiplyFloat32(viewport.logicalHeight, Math.fround(0.375)),
      );
    default:
      return assertNever(purpose);
  }
}

function entryNode<TResource>(
  resource: TResource,
  initialPosition: MainMenuPoint,
  finalPosition: MainMenuPoint,
  actions: readonly MainMenuEntryAction[],
  actionsRunConcurrently: boolean,
): MainMenuEntryNode<TResource> {
  return deepFreeze({
    actions: [...actions],
    actionsRunConcurrently,
    anchor: MAIN_MENU_INFERRED_CENTER_ANCHOR,
    finalPosition,
    inferredInitialRotationDegrees: 0 as const,
    inferredInitialScale: MAIN_MENU_INFERRED_UNIT_SCALE,
    initialPosition,
    resource,
    zOrder: MAIN_MENU_ROOT_Z_ORDER,
  });
}

function moveTo(durationSeconds: number, target: MainMenuPoint): MainMenuMoveToAction {
  return deepFreeze({ durationSeconds, target, type: 'move-to' as const });
}

function fadeIn(durationSeconds: number): MainMenuFadeInAction {
  return Object.freeze({ durationSeconds, type: 'fade-in' });
}

function delayedMove(
  delaySeconds: number,
  moveSeconds: number,
  target: MainMenuPoint,
): MainMenuMoveSequenceAction {
  return deepFreeze({
    actions: [
      { durationSeconds: delaySeconds, type: 'delay' as const },
      moveTo(moveSeconds, target),
    ],
    type: 'sequence' as const,
  });
}

function repeatRotation(
  durationSeconds: number,
  deltaDegrees: number,
): MainMenuForeverRotationAction {
  return deepFreeze({
    action: { deltaDegrees, durationSeconds, type: 'rotate-by' as const },
    type: 'repeat-forever' as const,
  });
}

function scaleTo(durationSeconds: number, scale: number): MainMenuScaleToAction {
  return Object.freeze({
    durationSeconds,
    scaleX: Math.fround(scale),
    scaleY: Math.fround(scale),
    type: 'scale-to',
  });
}

function inclusiveDraw(
  name: 'x' | 'y' | 'rise',
  minimumInclusive: number,
  maximumInclusive: number,
  value: number,
): MainMenuHeartRandomDraw {
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
): MainMenuHeartRandomDraw {
  return Object.freeze({ kind: 'decile', name, value });
}

function drawInclusive(
  random: MainMenuHeartRandom,
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
  random: MainMenuHeartRandom,
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

function assertHeartRandom(random: MainMenuHeartRandom): void {
  if (
    random === null
    || typeof random !== 'object'
    || typeof random.nextIntInclusive !== 'function'
    || typeof random.nextDecile !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive() and nextDecile()');
  }
}

function copyViewport(viewport: MainMenuViewport): MainMenuViewport {
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

function copyPoint(value: MainMenuPoint, label: string): MainMenuPoint {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return point(
    finiteFloat32(value.x, `${label}.x`),
    finiteFloat32(value.y, `${label}.y`),
  );
}

function point(x: number, y: number): MainMenuPoint {
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

function truncateSignedInt32(value: number, label: string): number {
  const truncated = Math.trunc(finiteFloat32(value, label));
  assertSignedInt32(truncated, label);
  return truncated;
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

function assertOrderedBounds(minimum: number, maximum: number, label: string): void {
  if (minimum > maximum) {
    throw new RangeError(`${label} inclusive bounds must be ordered`);
  }
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

function assertNever(value: never): never {
  throw new RangeError(`unsupported Main Menu FruitButton purpose: ${String(value)}`);
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
