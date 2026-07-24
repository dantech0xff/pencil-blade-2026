import type { ClassicRasterResource } from './classic-resource-contract';
import type {
  OptionsRasterProfile,
  OptionsTwoFrameRasterSet,
} from './options-resource-contract';
import {
  OPTIONS_BLADE_ROW_AUDIO_CANONICAL_PATH,
  OPTIONS_FONT_CANONICAL_PATH,
  OPTIONS_MENU_BUTTON_AUDIO_CANONICAL_PATH,
  OPTIONS_SELECTION_AUDIO_CANONICAL_PATH,
  OPTIONS_THEME_ROW_AUDIO_CANONICAL_PATH,
  getOptionsRasterResources,
} from './options-resource-contract';
import {
  OPTIONS_BACKGROUND_COUNT,
  OPTIONS_BLADE_COUNT,
  OPTIONS_THEME_COUNT,
} from './options-state';
import type { ClassicAssetTree } from './resolution-profile-service';

export const OPTIONS_ROOT_Z_ORDER = 1 as const;
export const OPTIONS_GESTURES_Z_ORDER = 1 as const;
export const OPTIONS_TITLE_MOVE_SECONDS = Math.fround(1.25);
export const OPTIONS_COIN_ENTRY_SECONDS = Math.fround(0.75);
export const OPTIONS_BACK_ENTRY_SECONDS = Math.fround(0.85);
export const OPTIONS_HEADER_MOVE_SECONDS = Math.fround(0.25);
export const OPTIONS_BACKGROUND_REVEAL_AT_SECONDS = OPTIONS_TITLE_MOVE_SECONDS;
export const OPTIONS_BLADE_REVEAL_AT_SECONDS = Math.fround(
  OPTIONS_BACKGROUND_REVEAL_AT_SECONDS + OPTIONS_HEADER_MOVE_SECONDS,
);
export const OPTIONS_THEME_REVEAL_AT_SECONDS = Math.fround(
  OPTIONS_BLADE_REVEAL_AT_SECONDS + OPTIONS_HEADER_MOVE_SECONDS,
);
export const OPTIONS_TOTAL_COINS_FORMAT = '%d' as const;
export const OPTIONS_TOTAL_COINS_REFERENCE_WIDTH = Math.fround(480);
export const OPTIONS_TOTAL_COINS_BASE_POINT_SIZE = Math.fround(34);
export const OPTIONS_PRICE_REFERENCE_WIDTH = Math.fround(480);
export const OPTIONS_PRICE_BASE_POINT_SIZE = Math.fround(16);

const HALF = Math.fround(0.5);
const TITLE_ANCHOR_Y = 0 as const;
const TITLE_MOVE_DELTA_X = 0 as const;
const COIN_ROW_Y_FACTOR = Math.fround(0.835);
const COIN_PANEL_FINAL_X_FACTOR = Math.fround(0.285);
const COIN_LABEL_FINAL_X_FACTOR = Math.fround(0.185);
const BACK_INITIAL_CENTER_X_FACTOR = Math.fround(2.5);
const BACK_FINAL_X_FACTOR = Math.fround(0.85);
const BACKGROUND_HEADER_Y_FACTOR = Math.fround(0.75);
const BLADE_HEADER_Y_FACTOR = Math.fround(0.475);
const THEME_HEADER_Y_FACTOR = Math.fround(0.2);
const ROW_VERTICAL_SPACING_FACTOR = Math.fround(1.1);
const BLADE_HEADER_INITIAL_CENTER_X_FACTOR = Math.fround(3);
const PRICE_LABEL_LOCAL_X_FACTOR = Math.fround(0.4);

export type OptionsRowKind = 'background' | 'blade' | 'theme';

export interface OptionsPoint {
  readonly x: number;
  readonly y: number;
}

export interface OptionsVisibleRect {
  readonly bottom: OptionsPoint;
  readonly center: OptionsPoint;
  readonly left: OptionsPoint;
  readonly right: OptionsPoint;
  readonly top: OptionsPoint;
}

export interface OptionsViewport {
  /** Raw logical director height H. */
  readonly logicalHeight: number;
  /** Raw logical director width W. */
  readonly logicalWidth: number;
  readonly visibleRect: OptionsVisibleRect;
}

export interface OptionsPresentationState {
  readonly backgroundPrices: readonly number[];
  readonly bladePrices: readonly number[];
  readonly selectedBackground: number;
  readonly selectedBlade: number;
  readonly selectedTheme: number;
}

export interface OptionsAnchor {
  readonly evidence: 'inferred-legacy-default' | 'recovered-setter';
  readonly x: number;
  readonly y: number;
}

export interface OptionsMoveToAction {
  readonly durationSeconds: number;
  readonly target: OptionsPoint;
  readonly type: 'move-to';
}

export interface OptionsMoveByAction {
  readonly delta: OptionsPoint;
  readonly durationSeconds: number;
  readonly type: 'move-by';
}

export interface OptionsFadeInAction {
  readonly durationSeconds: number;
  readonly type: 'fade-in';
}

export interface OptionsTitlePresentation {
  readonly actions: readonly [
    OptionsMoveByAction,
    Readonly<{
      readonly callback: 'reveal-background-row';
      readonly type: 'invoke-callback';
    }>,
  ];
  readonly anchor: OptionsAnchor;
  readonly attachmentInsertion: 1;
  readonly finalPosition: OptionsPoint;
  readonly initialPosition: OptionsPoint;
  readonly resource: ClassicRasterResource;
  readonly zOrder: 1;
}

export interface OptionsCoinPanelPresentation {
  readonly actions: readonly [OptionsMoveToAction, OptionsFadeInAction];
  readonly actionsRunConcurrently: true;
  readonly anchor: OptionsAnchor;
  readonly attachmentInsertion: 2;
  readonly finalPosition: OptionsPoint;
  readonly initialPosition: OptionsPoint;
  readonly resource: ClassicRasterResource;
  readonly zOrder: 1;
}

export interface OptionsCoinLabelPresentation {
  readonly actions: readonly [OptionsMoveToAction, OptionsFadeInAction];
  readonly actionsRunConcurrently: true;
  readonly anchor: OptionsAnchor;
  readonly attachmentInsertion: 3;
  readonly finalPosition: OptionsPoint;
  readonly fontCanonicalPath: typeof OPTIONS_FONT_CANONICAL_PATH;
  readonly fontPointSize: number;
  readonly format: typeof OPTIONS_TOTAL_COINS_FORMAT;
  readonly initialPosition: OptionsPoint;
  readonly inferredDefaultColor: 'white';
  readonly text: string;
  readonly zOrder: 1;
}

export interface OptionsBackPresentation {
  readonly action: OptionsMoveToAction;
  readonly anchor: OptionsAnchor;
  readonly attachmentInsertion: 4;
  readonly finalPosition: OptionsPoint;
  readonly initialPosition: OptionsPoint;
  readonly menuContainerPosition: OptionsPoint;
  readonly resources: OptionsTwoFrameRasterSet;
  readonly zOrder: 1;
}

export type OptionsRowContinuation =
  | 'reveal-blade-row'
  | 'reveal-theme-row'
  | null;

export interface OptionsRowHeaderPresentation {
  readonly action: OptionsMoveToAction;
  readonly anchor: OptionsAnchor;
  readonly attachmentInsertion: number;
  readonly continuation: OptionsRowContinuation;
  readonly continuationAudioCanonicalPath:
    | typeof OPTIONS_BLADE_ROW_AUDIO_CANONICAL_PATH
    | typeof OPTIONS_THEME_ROW_AUDIO_CANONICAL_PATH
    | null;
  readonly finalPosition: OptionsPoint;
  readonly initialPosition: OptionsPoint;
  readonly initialXFormula:
    | 'three-times-visible-center'
    | 'visible-center-minus-zero';
  readonly resource: ClassicRasterResource;
  readonly revealAtSeconds: number;
  readonly zOrder: 1;
}

export interface OptionsSelectorControlGeometry {
  readonly evidence: 'recovered-select-items-on-enter';
  readonly nextLocalPosition: OptionsPoint;
  readonly previousLocalPosition: OptionsPoint;
}

export interface OptionsSelectorPresentation {
  readonly action: OptionsMoveToAction;
  readonly anchor: OptionsAnchor;
  readonly attachmentInsertion: number;
  readonly backgroundResource: ClassicRasterResource;
  readonly controlLocalPositions: OptionsSelectorControlGeometry;
  readonly iconResource: ClassicRasterResource;
  /** Native explicitly runs a 0.25-second MoveTo whose initial and final points are equal. */
  readonly initialPosition: OptionsPoint;
  readonly itemCount: 8 | 10 | 18;
  readonly nextResources: OptionsTwoFrameRasterSet;
  readonly position: OptionsPoint;
  readonly previousResources: OptionsTwoFrameRasterSet;
  readonly selectedIndex: number;
  readonly zOrder: 1;
}

export interface OptionsPriceLabelPresentation {
  readonly anchor: OptionsAnchor;
  readonly fontCanonicalPath: typeof OPTIONS_FONT_CANONICAL_PATH;
  readonly fontPointSize: number;
  readonly inferredDefaultColor: 'white';
  readonly localPosition: OptionsPoint;
  readonly text: string;
}

export interface OptionsPurchaseControlPresentation {
  readonly attachmentInsertion: number;
  readonly buyControlVisible: boolean;
  readonly menuState: 'owned' | 'purchasable';
  readonly position: OptionsPoint;
  readonly price: number;
  readonly priceLabel: OptionsPriceLabelPresentation;
  readonly resources: OptionsTwoFrameRasterSet;
  readonly visibilityEvidence: 'inferred-price-gated-native-menu-state';
  readonly zOrder: 1;
}

export interface OptionsRowPresentation {
  readonly header: OptionsRowHeaderPresentation;
  readonly itemCount: 8 | 10 | 18;
  readonly kind: OptionsRowKind;
  readonly purchase: OptionsPurchaseControlPresentation | null;
  readonly selector: OptionsSelectorPresentation;
}

export interface OptionsAttachmentOrderEntry {
  readonly child:
    | 'back-menu'
    | 'background-buy-menu'
    | 'background-header'
    | 'background-selector'
    | 'blade-buy-menu'
    | 'blade-header'
    | 'blade-selector'
    | 'gestures-layer'
    | 'theme-header'
    | 'theme-selector'
    | 'title'
    | 'total-coins-label'
    | 'total-coins-panel';
  readonly insertion: number;
  readonly phase: 'background-callback' | 'blade-callback' | 'on-enter' | 'theme-callback';
  readonly revealAtSeconds: number;
  readonly zOrder: 1;
}

export interface OptionsPresentationSnapshot {
  readonly assetTree: ClassicAssetTree;
  readonly attachmentOrder: typeof OPTIONS_ATTACHMENT_ORDER;
  readonly audio: Readonly<{
    readonly back: Readonly<{
      readonly canonicalPath: typeof OPTIONS_MENU_BUTTON_AUDIO_CANONICAL_PATH;
      readonly effectsGated: true;
      readonly loop: false;
    }>;
    readonly selection: Readonly<{
      readonly canonicalPath: typeof OPTIONS_SELECTION_AUDIO_CANONICAL_PATH;
      readonly effectsGated: true;
      readonly loop: false;
    }>;
    readonly rowReveal: Readonly<{
      readonly background: null;
      readonly blade: Readonly<{
        readonly canonicalPath: typeof OPTIONS_BLADE_ROW_AUDIO_CANONICAL_PATH;
        readonly effectsGated: true;
        readonly loop: false;
      }>;
      readonly theme: Readonly<{
        readonly canonicalPath: typeof OPTIONS_THEME_ROW_AUDIO_CANONICAL_PATH;
        readonly effectsGated: true;
        readonly loop: false;
      }>;
    }>;
  }>;
  readonly back: OptionsBackPresentation;
  readonly coins: Readonly<{
    readonly label: OptionsCoinLabelPresentation;
    readonly panel: OptionsCoinPanelPresentation;
  }>;
  readonly gestures: Readonly<{
    readonly attachmentInsertion: 5;
    readonly zOrder: 1;
  }>;
  readonly offlinePolicy: typeof OPTIONS_OFFLINE_POLICY;
  readonly purchaseParticleResource: ClassicRasterResource;
  readonly rowOrder: typeof OPTIONS_ROW_ORDER;
  readonly rows: Readonly<{
    readonly background: OptionsRowPresentation;
    readonly blade: OptionsRowPresentation;
    readonly theme: OptionsRowPresentation;
  }>;
  readonly title: OptionsTitlePresentation;
  readonly viewport: OptionsViewport;
}

export const OPTIONS_INFERRED_CENTER_ANCHOR: OptionsAnchor = Object.freeze({
  evidence: 'inferred-legacy-default',
  x: HALF,
  y: HALF,
});

export const OPTIONS_TITLE_ANCHOR: OptionsAnchor = Object.freeze({
  evidence: 'recovered-setter',
  x: HALF,
  y: TITLE_ANCHOR_Y,
});

export const OPTIONS_LABEL_ANCHOR: OptionsAnchor = Object.freeze({
  evidence: 'recovered-setter',
  x: 0,
  y: HALF,
});

export const OPTIONS_ROW_ORDER = Object.freeze([
  'background',
  'blade',
  'theme',
] as const);

export const OPTIONS_ROW_REVEAL_BOUNDARIES = deepFreeze({
  background: OPTIONS_BACKGROUND_REVEAL_AT_SECONDS,
  blade: OPTIONS_BLADE_REVEAL_AT_SECONDS,
  theme: OPTIONS_THEME_REVEAL_AT_SECONDS,
});

export const OPTIONS_ATTACHMENT_ORDER: readonly OptionsAttachmentOrderEntry[] = deepFreeze([
  attachment('title', 1, 'on-enter', 0),
  attachment('total-coins-panel', 2, 'on-enter', 0),
  attachment('total-coins-label', 3, 'on-enter', 0),
  attachment('back-menu', 4, 'on-enter', 0),
  attachment('gestures-layer', 5, 'on-enter', 0),
  attachment(
    'background-header',
    6,
    'background-callback',
    OPTIONS_BACKGROUND_REVEAL_AT_SECONDS,
  ),
  attachment(
    'background-selector',
    7,
    'background-callback',
    OPTIONS_BACKGROUND_REVEAL_AT_SECONDS,
  ),
  attachment(
    'background-buy-menu',
    8,
    'background-callback',
    OPTIONS_BACKGROUND_REVEAL_AT_SECONDS,
  ),
  attachment('blade-header', 9, 'blade-callback', OPTIONS_BLADE_REVEAL_AT_SECONDS),
  attachment('blade-selector', 10, 'blade-callback', OPTIONS_BLADE_REVEAL_AT_SECONDS),
  attachment('blade-buy-menu', 11, 'blade-callback', OPTIONS_BLADE_REVEAL_AT_SECONDS),
  attachment('theme-header', 12, 'theme-callback', OPTIONS_THEME_REVEAL_AT_SECONDS),
  attachment('theme-selector', 13, 'theme-callback', OPTIONS_THEME_REVEAL_AT_SECONDS),
]);

export const OPTIONS_OFFLINE_POLICY = Object.freeze({
  adBridgeExcluded: true as const,
  randomizedShowAdsScheduleExcluded: true as const,
  rowChainSource: 'title-moveby-callback' as const,
});

/** Pure snapshot of the recovered one-screen chained Options presentation. */
export function createOptionsPresentation(
  assetTree: ClassicAssetTree,
  viewport: OptionsViewport,
  totalCoins: number,
  state: OptionsPresentationState,
): OptionsPresentationSnapshot {
  const copiedViewport = copyViewport(viewport);
  assertSignedInt32(totalCoins, 'totalCoins');
  const copiedState = copyPresentationState(state);
  const resources = getOptionsRasterResources(assetTree);
  const width = copiedViewport.logicalWidth;
  const height = copiedViewport.logicalHeight;
  const { visibleRect } = copiedViewport;

  const titleInitial = point(visibleRect.center.x, visibleRect.top.y);
  const titleDelta = point(TITLE_MOVE_DELTA_X, -resources.title.dimensions.height);
  const titleFinal = point(
    titleInitial.x,
    addFloat32(titleInitial.y, titleDelta.y),
  );
  const title: OptionsTitlePresentation = deepFreeze({
    actions: [
      moveBy(OPTIONS_TITLE_MOVE_SECONDS, titleDelta),
      {
        callback: 'reveal-background-row' as const,
        type: 'invoke-callback' as const,
      },
    ],
    anchor: OPTIONS_TITLE_ANCHOR,
    attachmentInsertion: 1 as const,
    finalPosition: titleFinal,
    initialPosition: titleInitial,
    resource: resources.title,
    zOrder: OPTIONS_ROOT_Z_ORDER,
  });

  const coinY = addFloat32(
    visibleRect.bottom.y,
    multiplyFloat32(height, COIN_ROW_Y_FACTOR),
  );
  const coinPanelInitial = point(
    subtractFloat32(
      visibleRect.left.x,
      multiplyFloat32(HALF, resources.totalCoinsPanel.dimensions.width),
    ),
    coinY,
  );
  const coinPanelFinal = point(
    addFloat32(
      visibleRect.left.x,
      multiplyFloat32(width, COIN_PANEL_FINAL_X_FACTOR),
    ),
    coinY,
  );
  const coinPanel: OptionsCoinPanelPresentation = deepFreeze({
    actions: [
      moveTo(OPTIONS_COIN_ENTRY_SECONDS, coinPanelFinal),
      fadeIn(OPTIONS_COIN_ENTRY_SECONDS),
    ],
    actionsRunConcurrently: true as const,
    anchor: OPTIONS_INFERRED_CENTER_ANCHOR,
    attachmentInsertion: 2 as const,
    finalPosition: coinPanelFinal,
    initialPosition: coinPanelInitial,
    resource: resources.totalCoinsPanel,
    zOrder: OPTIONS_ROOT_Z_ORDER,
  });

  const coinLabelFinal = point(
    addFloat32(
      visibleRect.left.x,
      multiplyFloat32(width, COIN_LABEL_FINAL_X_FACTOR),
    ),
    coinY,
  );
  const coinLabel: OptionsCoinLabelPresentation = deepFreeze({
    actions: [
      moveTo(OPTIONS_COIN_ENTRY_SECONDS, coinLabelFinal),
      fadeIn(OPTIONS_COIN_ENTRY_SECONDS),
    ],
    actionsRunConcurrently: true as const,
    anchor: OPTIONS_LABEL_ANCHOR,
    attachmentInsertion: 3 as const,
    finalPosition: coinLabelFinal,
    fontCanonicalPath: OPTIONS_FONT_CANONICAL_PATH,
    fontPointSize: multiplyFloat32(
      divideFloat32(width, OPTIONS_TOTAL_COINS_REFERENCE_WIDTH),
      OPTIONS_TOTAL_COINS_BASE_POINT_SIZE,
    ),
    format: OPTIONS_TOTAL_COINS_FORMAT,
    inferredDefaultColor: 'white' as const,
    initialPosition: coinPanelInitial,
    text: formatSignedInt32(totalCoins),
    zOrder: OPTIONS_ROOT_Z_ORDER,
  });

  const backY = multiplyFloat32(height, COIN_ROW_Y_FACTOR);
  const backFinal = point(multiplyFloat32(width, BACK_FINAL_X_FACTOR), backY);
  const back: OptionsBackPresentation = deepFreeze({
    action: moveTo(OPTIONS_BACK_ENTRY_SECONDS, backFinal),
    anchor: OPTIONS_INFERRED_CENTER_ANCHOR,
    attachmentInsertion: 4 as const,
    finalPosition: backFinal,
    initialPosition: point(
      multiplyFloat32(visibleRect.center.x, BACK_INITIAL_CENTER_X_FACTOR),
      backY,
    ),
    menuContainerPosition: point(0, 0),
    resources: resources.back,
    zOrder: OPTIONS_ROOT_Z_ORDER,
  });

  const background = createRow({
    attachmentBase: 6,
    continuation: 'reveal-blade-row',
    continuationAudioCanonicalPath: OPTIONS_BLADE_ROW_AUDIO_CANONICAL_PATH,
    headerResource: resources.sectionHeaders.background,
    headerYFactor: BACKGROUND_HEADER_Y_FACTOR,
    icons: resources.backgroundIcons,
    initialXFormula: 'visible-center-minus-zero',
    itemCount: OPTIONS_BACKGROUND_COUNT,
    kind: 'background',
    price: copiedState.backgroundPrices[copiedState.selectedBackground],
    resources,
    revealAtSeconds: OPTIONS_BACKGROUND_REVEAL_AT_SECONDS,
    selectedIndex: copiedState.selectedBackground,
    viewport: copiedViewport,
  });
  const blade = createRow({
    attachmentBase: 9,
    continuation: 'reveal-theme-row',
    continuationAudioCanonicalPath: OPTIONS_THEME_ROW_AUDIO_CANONICAL_PATH,
    headerResource: resources.sectionHeaders.blade,
    headerYFactor: BLADE_HEADER_Y_FACTOR,
    icons: resources.bladeIcons,
    initialXFormula: 'three-times-visible-center',
    itemCount: OPTIONS_BLADE_COUNT,
    kind: 'blade',
    price: copiedState.bladePrices[copiedState.selectedBlade],
    resources,
    revealAtSeconds: OPTIONS_BLADE_REVEAL_AT_SECONDS,
    selectedIndex: copiedState.selectedBlade,
    viewport: copiedViewport,
  });
  const theme = createRow({
    attachmentBase: 12,
    continuation: null,
    continuationAudioCanonicalPath: null,
    headerResource: resources.sectionHeaders.theme,
    headerYFactor: THEME_HEADER_Y_FACTOR,
    icons: resources.themeIcons,
    initialXFormula: 'visible-center-minus-zero',
    itemCount: OPTIONS_THEME_COUNT,
    kind: 'theme',
    price: null,
    resources,
    revealAtSeconds: OPTIONS_THEME_REVEAL_AT_SECONDS,
    selectedIndex: copiedState.selectedTheme,
    viewport: copiedViewport,
  });

  return deepFreeze({
    assetTree,
    attachmentOrder: OPTIONS_ATTACHMENT_ORDER,
    audio: {
      back: {
        canonicalPath: OPTIONS_MENU_BUTTON_AUDIO_CANONICAL_PATH,
        effectsGated: true as const,
        loop: false as const,
      },
      selection: {
        canonicalPath: OPTIONS_SELECTION_AUDIO_CANONICAL_PATH,
        effectsGated: true as const,
        loop: false as const,
      },
      rowReveal: {
        background: null,
        blade: {
          canonicalPath: OPTIONS_BLADE_ROW_AUDIO_CANONICAL_PATH,
          effectsGated: true as const,
          loop: false as const,
        },
        theme: {
          canonicalPath: OPTIONS_THEME_ROW_AUDIO_CANONICAL_PATH,
          effectsGated: true as const,
          loop: false as const,
        },
      },
    },
    back,
    coins: { label: coinLabel, panel: coinPanel },
    gestures: {
      attachmentInsertion: 5 as const,
      zOrder: OPTIONS_GESTURES_Z_ORDER,
    },
    offlinePolicy: OPTIONS_OFFLINE_POLICY,
    purchaseParticleResource: resources.purchaseParticle,
    rowOrder: OPTIONS_ROW_ORDER,
    rows: { background, blade, theme },
    title,
    viewport: copiedViewport,
  });
}

interface CreateRowInput {
  readonly attachmentBase: number;
  readonly continuation: OptionsRowContinuation;
  readonly continuationAudioCanonicalPath:
    | typeof OPTIONS_BLADE_ROW_AUDIO_CANONICAL_PATH
    | typeof OPTIONS_THEME_ROW_AUDIO_CANONICAL_PATH
    | null;
  readonly headerResource: ClassicRasterResource;
  readonly headerYFactor: number;
  readonly icons: readonly ClassicRasterResource[];
  readonly initialXFormula: OptionsRowHeaderPresentation['initialXFormula'];
  readonly itemCount: 8 | 10 | 18;
  readonly kind: OptionsRowKind;
  readonly price: number | null;
  readonly resources: OptionsRasterProfile;
  readonly revealAtSeconds: number;
  readonly selectedIndex: number;
  readonly viewport: OptionsViewport;
}

function createRow(input: CreateRowInput): OptionsRowPresentation {
  const { viewport, resources } = input;
  const headerY = multiplyFloat32(viewport.logicalHeight, input.headerYFactor);
  const headerFinal = point(viewport.visibleRect.center.x, headerY);
  const initialX = input.initialXFormula === 'three-times-visible-center'
    ? multiplyFloat32(
      viewport.visibleRect.center.x,
      BLADE_HEADER_INITIAL_CENTER_X_FACTOR,
    )
    : subtractFloat32(viewport.visibleRect.center.x, 0);
  const selectorY = subtractFloat32(
    headerY,
    multiplyFloat32(
      multiplyFloat32(
        input.headerResource.dimensions.height,
        ROW_VERTICAL_SPACING_FACTOR,
      ),
      HALF,
    ),
  );
  const selectorPosition = point(viewport.visibleRect.center.x, selectorY);
  const iconResource = input.icons[input.selectedIndex];
  if (iconResource === undefined) {
    throw new Error(`${input.kind} icon ${input.selectedIndex} is unavailable`);
  }
  const header: OptionsRowHeaderPresentation = deepFreeze({
    action: moveTo(OPTIONS_HEADER_MOVE_SECONDS, headerFinal),
    anchor: OPTIONS_INFERRED_CENTER_ANCHOR,
    attachmentInsertion: input.attachmentBase,
    continuation: input.continuation,
    continuationAudioCanonicalPath: input.continuationAudioCanonicalPath,
    finalPosition: headerFinal,
    initialPosition: point(initialX, headerY),
    initialXFormula: input.initialXFormula,
    resource: input.headerResource,
    revealAtSeconds: input.revealAtSeconds,
    zOrder: OPTIONS_ROOT_Z_ORDER,
  });
  const selector: OptionsSelectorPresentation = deepFreeze({
    action: moveTo(OPTIONS_HEADER_MOVE_SECONDS, selectorPosition),
    anchor: OPTIONS_INFERRED_CENTER_ANCHOR,
    attachmentInsertion: input.attachmentBase + 1,
    backgroundResource: resources.selectorBackground,
    controlLocalPositions: {
      evidence: 'recovered-select-items-on-enter' as const,
      nextLocalPosition: point(resources.selectorBackground.dimensions.width, 0),
      previousLocalPosition: point(-resources.selectorBackground.dimensions.width, 0),
    },
    iconResource,
    initialPosition: selectorPosition,
    itemCount: input.itemCount,
    nextResources: resources.next,
    position: selectorPosition,
    previousResources: resources.previous,
    selectedIndex: input.selectedIndex,
    zOrder: OPTIONS_ROOT_Z_ORDER,
  });

  return deepFreeze({
    header,
    itemCount: input.itemCount,
    kind: input.kind,
    purchase: input.price === null
      ? null
      : createPurchaseControl(
        input.attachmentBase + 2,
        input.price,
        selectorY,
        viewport,
        resources,
      ),
    selector,
  });
}

function createPurchaseControl(
  attachmentInsertion: number,
  price: number,
  selectorY: number,
  viewport: OptionsViewport,
  resources: OptionsRasterProfile,
): OptionsPurchaseControlPresentation {
  const buyY = subtractFloat32(
    selectorY,
    multiplyFloat32(
      multiplyFloat32(
        resources.selectorBackground.dimensions.height,
        ROW_VERTICAL_SPACING_FACTOR,
      ),
      HALF,
    ),
  );
  const buyWidth = resources.buy.normal.dimensions.width;
  const buyHeight = resources.buy.normal.dimensions.height;
  return deepFreeze({
    attachmentInsertion,
    buyControlVisible: price > 0,
    menuState: price === 0 ? 'owned' as const : 'purchasable' as const,
    position: point(viewport.visibleRect.center.x, buyY),
    price,
    priceLabel: {
      anchor: OPTIONS_INFERRED_CENTER_ANCHOR,
      fontCanonicalPath: OPTIONS_FONT_CANONICAL_PATH,
      fontPointSize: multiplyFloat32(
        divideFloat32(viewport.logicalWidth, OPTIONS_PRICE_REFERENCE_WIDTH),
        OPTIONS_PRICE_BASE_POINT_SIZE,
      ),
      inferredDefaultColor: 'white' as const,
      localPosition: point(
        multiplyFloat32(buyWidth, PRICE_LABEL_LOCAL_X_FACTOR),
        multiplyFloat32(buyHeight, HALF),
      ),
      text: `${price}`,
    },
    resources: resources.buy,
    visibilityEvidence: 'inferred-price-gated-native-menu-state' as const,
    zOrder: OPTIONS_ROOT_Z_ORDER,
  });
}

function attachment(
  child: OptionsAttachmentOrderEntry['child'],
  insertion: number,
  phase: OptionsAttachmentOrderEntry['phase'],
  revealAtSeconds: number,
): OptionsAttachmentOrderEntry {
  return {
    child,
    insertion,
    phase,
    revealAtSeconds,
    zOrder: OPTIONS_ROOT_Z_ORDER,
  };
}

function copyPresentationState(state: OptionsPresentationState): OptionsPresentationState {
  if (state === null || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('Options presentation state must be an object');
  }
  assertPriceTable(state.backgroundPrices, OPTIONS_BACKGROUND_COUNT, 'backgroundPrices');
  assertPriceTable(state.bladePrices, OPTIONS_BLADE_COUNT, 'bladePrices');
  assertIndex(state.selectedBackground, OPTIONS_BACKGROUND_COUNT, 'selectedBackground');
  assertIndex(state.selectedBlade, OPTIONS_BLADE_COUNT, 'selectedBlade');
  assertIndex(state.selectedTheme, OPTIONS_THEME_COUNT, 'selectedTheme');
  return deepFreeze({
    backgroundPrices: [...state.backgroundPrices],
    bladePrices: [...state.bladePrices],
    selectedBackground: state.selectedBackground,
    selectedBlade: state.selectedBlade,
    selectedTheme: state.selectedTheme,
  });
}

function copyViewport(viewport: OptionsViewport): OptionsViewport {
  if (viewport === null || typeof viewport !== 'object' || Array.isArray(viewport)) {
    throw new TypeError('viewport must be an object');
  }
  const logicalWidth = positiveFiniteFloat32(viewport.logicalWidth, 'viewport.logicalWidth');
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

function copyPoint(value: OptionsPoint, label: string): OptionsPoint {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return point(
    finiteFloat32(value.x, `${label}.x`),
    finiteFloat32(value.y, `${label}.y`),
  );
}

function assertPriceTable(
  prices: readonly number[],
  count: number,
  label: string,
): void {
  if (!Array.isArray(prices) || prices.length !== count) {
    throw new RangeError(`${label} must contain exactly ${count} prices`);
  }
  for (const price of prices) {
    assertSignedInt32(price, `${label} price`);
    if (price < 0) {
      throw new RangeError(`${label} prices must be non-negative`);
    }
  }
}

function assertIndex(index: number, count: number, label: string): void {
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError(`${label} must be an integer index from 0 through ${count - 1}`);
  }
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

function formatSignedInt32(value: number): string {
  assertSignedInt32(value, 'value');
  return `${value}`;
}

function moveTo(durationSeconds: number, target: OptionsPoint): OptionsMoveToAction {
  return deepFreeze({ durationSeconds, target, type: 'move-to' as const });
}

function moveBy(durationSeconds: number, delta: OptionsPoint): OptionsMoveByAction {
  return deepFreeze({ delta, durationSeconds, type: 'move-by' as const });
}

function fadeIn(durationSeconds: number): OptionsFadeInAction {
  return Object.freeze({ durationSeconds, type: 'fade-in' });
}

function point(x: number, y: number): OptionsPoint {
  return Object.freeze({
    x: finiteFloat32(x, 'point.x'),
    y: finiteFloat32(y, 'point.y'),
  });
}

function positiveFiniteFloat32(value: number, label: string): number {
  const result = finiteFloat32(value, label);
  if (result <= 0) {
    throw new RangeError(`${label} must be positive in float32`);
  }
  return result;
}

function finiteFloat32(value: number, label: string): number {
  const result = Math.fround(value);
  if (!Number.isFinite(value) || !Number.isFinite(result)) {
    throw new RangeError(`${label} must be finite in float32`);
  }
  return result;
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
