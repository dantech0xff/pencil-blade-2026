import type { GameplayRandom } from './gameplay-random';

export const MODE_SELECT_CARD_COUNT = 6 as const;
export const MODE_SELECT_INITIAL_CURRENT_INDEX = 0 as const;
export const MODE_SELECT_INITIAL_DESTINATION_STATE = -1 as const;
export const MODE_SELECT_LAST_CARD_INDEX = 5 as const;
export const MODE_SELECT_NAVIGATION_DELAY_SECONDS = Math.fround(0.75);
export const MODE_SELECT_NAVIGATION_Z_ORDER = 1 as const;
export const MODE_SELECT_CAPTURED_PARENT_BOUNDARY = 'captured-mode-select-parent' as const;
export const MODE_SELECT_GAMEPLAY_SELECTED_AUDIO_PATH
  = 'Sounds/gameplayselected.wav' as const;
export const MODE_SELECT_MENU_BUTTON_AUDIO_PATH = 'Sounds/menubuttonclick.wav' as const;

export const MODE_SELECT_UNLOCK_PRICE = 2500 as const;
export const MODE_SELECT_TOTAL_COINS_STORAGE_KEY = 'total_coins' as const;
export const MODE_SELECT_UNLOCK_PARTICLE_TEXTURE_PATH
  = 'Blades/Particles/X-Mas/xmasfive.png' as const;
export const MODE_SELECT_UNLOCK_PARTICLE_COUNT = 45 as const;
export const MODE_SELECT_UNLOCK_PARTICLE_DELAY_SECONDS = Math.fround(0.05);
export const MODE_SELECT_UNLOCK_PARTICLE_CLEANUP_DELAY_SECONDS = Math.fround(1.4);
export const MODE_SELECT_UNLOCK_PARTICLE_REMOVE_AT_SECONDS = Math.fround(
  MODE_SELECT_UNLOCK_PARTICLE_DELAY_SECONDS
    + MODE_SELECT_UNLOCK_PARTICLE_CLEANUP_DELAY_SECONDS,
);
export const MODE_SELECT_UNLOCK_PARTICLE_DURATION_MINIMUM_HUNDREDTHS = 35 as const;
export const MODE_SELECT_UNLOCK_PARTICLE_DURATION_MAXIMUM_HUNDREDTHS = 70 as const;
export const MODE_SELECT_UNLOCK_PARTICLE_Z_ORDER = 1 as const;
export const MODE_SELECT_UNLOCK_PARTICLE_SPRITE_Z_ORDER = 0 as const;

const HALF = Math.fround(0.5);
const CENTERING_FACTOR = Math.fround(0.1);
const CENTERING_SNAP_THRESHOLD = Math.fround(2);
const UNLOCK_DISTANCE_REFERENCE_WIDTH = Math.fround(480);
const UNLOCK_MINIMUM_DISTANCE_FACTOR = Math.fround(50);
const UNLOCK_MAXIMUM_DISTANCE_FACTOR = Math.fround(150);
const UNLOCK_EMITTER_Y_FACTOR = Math.fround(0.25);
const HUNDREDTHS_PER_SECOND = Math.fround(100);

export type ModeSelectIndex = 0 | 1 | 2 | 3 | 4 | 5;
export type ModeSelectCurrentIndex = -1 | ModeSelectIndex;
export type ModeSelectDestinationState = -1 | ModeSelectIndex;
export type ModeSelectLockableIndex = 1 | 2 | 4 | 5;
export type ModeSelectDestination =
  | 'ClassicModeLayer'
  | 'CrazyModeLayer'
  | 'GNStyleLayer'
  | 'ClassicBirdLayer'
  | 'CrazyBirdLayer'
  | 'ComboBirdLayer';

export interface ModeSelectLayoutInput {
  /** Raw logical director width W; this is intentionally distinct from VisibleRect width. */
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly visibleCenterX: number;
  readonly visibleLeftX: number;
}

export interface ModeSelectPersistedUnlocks {
  readonly 1?: boolean;
  readonly 2?: boolean;
  readonly 4?: boolean;
  readonly 5?: boolean;
}

export interface ModeSelectStateInput {
  readonly layout: ModeSelectLayoutInput;
  readonly persistedUnlocks?: ModeSelectPersistedUnlocks;
}

export interface ModeSelectStateSnapshot {
  readonly anchorXs: readonly number[];
  readonly cardLocks: readonly boolean[];
  readonly currentIndex: ModeSelectCurrentIndex;
  readonly destinationState: ModeSelectDestinationState;
  readonly layout: ModeSelectLayoutInput;
}

export interface ModeSelectDragResult {
  readonly appliedDeltaX: number;
  readonly currentIndex: ModeSelectCurrentIndex;
  readonly moved: boolean;
}

export interface ModeSelectFlickResult {
  readonly changed: boolean;
  readonly currentIndex: ModeSelectCurrentIndex;
  readonly previousIndex: ModeSelectCurrentIndex;
}

export interface ModeSelectFrameResult {
  readonly appliedDeltaX: number;
  readonly centerDifference: number | null;
  readonly pressed: boolean;
}

export type ModeSelectSelectionCommand =
  | Readonly<{
      type: 'request-gameplay-selected-audio';
      canonicalPath: typeof MODE_SELECT_GAMEPLAY_SELECTED_AUDIO_PATH;
      loop: false;
    }>
  | Readonly<{
      type: 'schedule-mode-navigation';
      delaySeconds: number;
      readsDestinationAtExecution: true;
      repeatable: true;
    }>;

export type ModeSelectDelayedNavigationCommand =
  | Readonly<{
      type: 'capture-mode-select-parent';
      boundary: typeof MODE_SELECT_CAPTURED_PARENT_BOUNDARY;
    }>
  | Readonly<{
      type: 'remove-mode-select';
      cleanup: true;
    }>
  | Readonly<{
      type: 'construct-mode-destination';
      destination: ModeSelectDestination;
      destinationState: ModeSelectIndex;
      fresh: true;
    }>
  | Readonly<{
      type: 'attach-mode-destination-to-captured-parent';
      boundary: typeof MODE_SELECT_CAPTURED_PARENT_BOUNDARY;
      destination: ModeSelectDestination;
      destinationState: ModeSelectIndex;
      zOrder: 1;
    }>;

export type ModeSelectBackCommand =
  | Readonly<{
      type: 'request-menu-button-audio';
      canonicalPath: typeof MODE_SELECT_MENU_BUTTON_AUDIO_PATH;
      loop: false;
    }>
  | Readonly<{ type: 'stop-all-mode-select-actions' }>
  | Readonly<{
      type: 'capture-mode-select-parent';
      boundary: typeof MODE_SELECT_CAPTURED_PARENT_BOUNDARY;
    }>
  | Readonly<{
      type: 'remove-mode-select';
      cleanup: true;
    }>
  | Readonly<{
      type: 'construct-main-menu';
      fresh: true;
    }>
  | Readonly<{
      type: 'attach-main-menu-to-captured-parent';
      boundary: typeof MODE_SELECT_CAPTURED_PARENT_BOUNDARY;
      zOrder: 1;
    }>;

export interface ModeSelectLockLoadCommand {
  readonly defaultValue: false;
  readonly modeIndex: ModeSelectLockableIndex;
  readonly storageKey: string;
  readonly type: 'read-mode-unlock';
}

export interface ModeSelectPoint {
  readonly x: number;
  readonly y: number;
}

export interface ModeSelectUnlockBurstPlan {
  readonly autoDeleteParticles: false;
  readonly cleanupDelaySeconds: number;
  /** Recovered constructor/Create flags. Their native semantic names are unavailable. */
  readonly colorFlags: readonly [false, false];
  readonly emitterWorldPosition: ModeSelectPoint;
  readonly fadeOutParticles: false;
  readonly maximumTravelMagnitude: number;
  readonly minimumTravelMagnitude: number;
  readonly particleCount: 45;
  readonly particleRootZOrder: 1;
  readonly removeAtSeconds: number;
  readonly spriteChildZOrder: 0;
  readonly startDelaySeconds: number;
  readonly textureLogicalPath: typeof MODE_SELECT_UNLOCK_PARTICLE_TEXTURE_PATH;
}

export type ModeSelectUnlockParticleRandom = Pick<GameplayRandom, 'nextIntInclusive'>;

export type ModeSelectUnlockParticleSign = -1 | 0 | 1;

export interface ModeSelectUnlockParticlePlan {
  readonly actionsRunConcurrently: true;
  readonly appliesColor: false;
  readonly autoDelete: false;
  readonly deltaLocal: ModeSelectPoint;
  readonly durationHundredths: number;
  readonly durationSeconds: number;
  readonly fadeOut: false;
  readonly horizontalMagnitude: number;
  readonly horizontalSign: ModeSelectUnlockParticleSign;
  readonly index: number;
  readonly moveActionSequence: readonly [
    Readonly<{
      readonly deltaLocal: ModeSelectPoint;
      readonly durationSeconds: number;
      readonly type: 'move-by';
    }>,
    Readonly<{
      readonly type: 'invoke-finished-callback';
    }>,
  ];
  readonly particleRootZOrder: 1;
  readonly rotateAction: Readonly<{
    readonly deltaX: 1;
    readonly deltaY: 1;
    readonly durationSeconds: number;
    readonly overload: 'three-argument';
    readonly type: 'rotate-by';
  }>;
  readonly scaleAction: Readonly<{
    readonly durationSeconds: number;
    readonly scaleX: 0;
    readonly scaleY: 0;
    readonly type: 'scale-to';
  }>;
  readonly spriteChildZOrder: 0;
  readonly verticalMagnitude: number;
  readonly verticalSign: ModeSelectUnlockParticleSign;
}

export type ModeSelectUnlockCommand =
  | Readonly<{
      type: 'set-process-total-coins';
      flushCalled: true;
      fromRereadValue: number;
      persistence: 'process-memory-until-save-data';
      storageKey: typeof MODE_SELECT_TOTAL_COINS_STORAGE_KEY;
      value: number;
      writesStorageKey: false;
    }>
  | Readonly<{
      type: 'persist-mode-unlock';
      flushImmediately: true;
      modeIndex: ModeSelectIndex;
      storageKey: string;
      value: true;
    }>
  | Readonly<{
      type: 'unlock-rope-button';
      fruitCutDisabled: false;
      lockMenuVisible: false;
      modeIndex: ModeSelectIndex;
      removesLockMenu: false;
    }>
  | Readonly<{
      type: 'construct-unlock-particle-container';
      maximumTravelMagnitude: number;
      minimumTravelMagnitude: number;
      particleCount: 45;
      durationMaximumHundredths: 70;
      durationMinimumHundredths: 35;
    }>
  | Readonly<{
      type: 'position-unlock-particle-container';
      worldPosition: ModeSelectPoint;
    }>
  | Readonly<{
      type: 'configure-unlock-particle-container';
      autoDeleteParticles: false;
      colorFlags: readonly [false, false];
      cleanupDelaySeconds: number;
      fadeOutParticles: false;
      removeAtSeconds: number;
      startDelaySeconds: number;
      textureLogicalPath: typeof MODE_SELECT_UNLOCK_PARTICLE_TEXTURE_PATH;
    }>
  | Readonly<{
      type: 'attach-unlock-particle-container';
      zOrder: 1;
    }>
  | Readonly<{
      type: 'show-insufficient-coins-label';
      visible: true;
    }>
  | Readonly<{
      type: 'set-insufficient-coins-label-opacity';
      opacity: 0;
    }>
  | Readonly<{
      type: 'attach-insufficient-coins-action-sequence';
      actions: readonly [
        Readonly<{ type: 'fade-in'; seconds: number }>,
        Readonly<{ type: 'delay'; seconds: number }>,
        Readonly<{ type: 'fade-out'; seconds: number }>,
      ];
      cancelsExistingActions: false;
      permitsOverlap: true;
    }>;

export interface ModeSelectUnlockOutcome {
  readonly burstPlan: ModeSelectUnlockBurstPlan | null;
  readonly commands: readonly ModeSelectUnlockCommand[];
  readonly modeIndex: ModeSelectIndex;
  readonly nextTotalCoins: number;
  readonly success: boolean;
}

const MODE_DESTINATIONS: readonly ModeSelectDestination[] = Object.freeze([
  'ClassicModeLayer',
  'CrazyModeLayer',
  'GNStyleLayer',
  'ClassicBirdLayer',
  'CrazyBirdLayer',
  'ComboBirdLayer',
]);

export const MODE_SELECT_LOCKABLE_INDICES: readonly ModeSelectLockableIndex[]
  = Object.freeze([1, 2, 4, 5]);

const REQUEST_SELECTION_AUDIO: ModeSelectSelectionCommand = Object.freeze({
  canonicalPath: MODE_SELECT_GAMEPLAY_SELECTED_AUDIO_PATH,
  loop: false,
  type: 'request-gameplay-selected-audio',
});
const SCHEDULE_MODE_NAVIGATION: ModeSelectSelectionCommand = Object.freeze({
  delaySeconds: MODE_SELECT_NAVIGATION_DELAY_SECONDS,
  readsDestinationAtExecution: true,
  repeatable: true,
  type: 'schedule-mode-navigation',
});
const CAPTURE_MODE_SELECT_PARENT = Object.freeze({
  boundary: MODE_SELECT_CAPTURED_PARENT_BOUNDARY,
  type: 'capture-mode-select-parent' as const,
});
const REMOVE_MODE_SELECT = Object.freeze({
  cleanup: true as const,
  type: 'remove-mode-select' as const,
});
const STOP_ALL_MODE_SELECT_ACTIONS: ModeSelectBackCommand = Object.freeze({
  type: 'stop-all-mode-select-actions',
});
const REQUEST_MENU_BUTTON_AUDIO: ModeSelectBackCommand = Object.freeze({
  canonicalPath: MODE_SELECT_MENU_BUTTON_AUDIO_PATH,
  loop: false,
  type: 'request-menu-button-audio',
});
const CONSTRUCT_MAIN_MENU: ModeSelectBackCommand = Object.freeze({
  fresh: true,
  type: 'construct-main-menu',
});
const ATTACH_MAIN_MENU: ModeSelectBackCommand = Object.freeze({
  boundary: MODE_SELECT_CAPTURED_PARENT_BOUNDARY,
  type: 'attach-main-menu-to-captured-parent',
  zOrder: MODE_SELECT_NAVIGATION_Z_ORDER,
});

const FAILURE_ACTIONS = Object.freeze([
  Object.freeze({ seconds: Math.fround(0.5), type: 'fade-in' as const }),
  Object.freeze({ seconds: Math.fround(1), type: 'delay' as const }),
  Object.freeze({ seconds: Math.fround(0.5), type: 'fade-out' as const }),
] as const);
const INSUFFICIENT_COINS_COMMANDS: readonly ModeSelectUnlockCommand[] = Object.freeze([
  Object.freeze({ type: 'show-insufficient-coins-label', visible: true as const }),
  Object.freeze({ opacity: 0 as const, type: 'set-insufficient-coins-label-opacity' }),
  Object.freeze({
    actions: FAILURE_ACTIONS,
    cancelsExistingActions: false as const,
    permitsOverlap: true as const,
    type: 'attach-insufficient-coins-action-sequence',
  }),
]);

/** Exact four Settings getter calls; indices 0 and 3 never query an unlock key. */
export const MODE_SELECT_LOCK_LOAD_COMMANDS: readonly ModeSelectLockLoadCommand[]
  = Object.freeze(MODE_SELECT_LOCKABLE_INDICES.map((modeIndex) => Object.freeze({
    defaultValue: false as const,
    modeIndex,
    storageKey: modeUnlockStorageKey(modeIndex),
    type: 'read-mode-unlock' as const,
  })));

/** Pure, snapshot-oriented port of the recovered ModeSelectLayer rail and callback state. */
export class ModeSelectState {
  private readonly layoutValue: ModeSelectLayoutInput;
  private readonly cardLocksValue: boolean[];
  private anchorXsValue: number[];
  private currentIndexValue: ModeSelectCurrentIndex = MODE_SELECT_INITIAL_CURRENT_INDEX;
  private destinationStateValue: ModeSelectDestinationState
    = MODE_SELECT_INITIAL_DESTINATION_STATE;

  constructor(input: ModeSelectStateInput) {
    assertStateInput(input);
    this.layoutValue = copyLayout(input.layout);
    this.anchorXsValue = createInitialAnchorXs(this.layoutValue);
    this.cardLocksValue = createInitialCardLocks(input.persistedUnlocks ?? {});
  }

  get snapshot(): ModeSelectStateSnapshot {
    return Object.freeze({
      anchorXs: Object.freeze([...this.anchorXsValue]),
      cardLocks: Object.freeze([...this.cardLocksValue]),
      currentIndex: this.currentIndexValue,
      destinationState: this.destinationStateValue,
      layout: this.layoutValue,
    });
  }

  /** Applies the recovered direct gesture delta and always refreshes the last-qualifying index. */
  drag(deltaX: number): ModeSelectDragResult {
    const floatDeltaX = finiteFloat32(deltaX, 'deltaX');
    const firstAnchorX = requireAnchor(this.anchorXsValue, 0);
    const lastAnchorX = requireAnchor(this.anchorXsValue, MODE_SELECT_LAST_CARD_INDEX);
    const canMove = (
      floatDeltaX < 0
      && lastAnchorX >= this.layoutValue.visibleLeftX
    ) || (
      floatDeltaX > 0
      && firstAnchorX <= this.layoutValue.logicalWidth
    );

    const nextAnchorXs = canMove
      ? shiftedAnchors(this.anchorXsValue, floatDeltaX)
      : this.anchorXsValue;
    const nextCurrentIndex = lastQualifyingIndex(
      nextAnchorXs,
      this.layoutValue.logicalWidth,
    );

    if (canMove) {
      this.anchorXsValue = nextAnchorXs;
    }
    this.currentIndexValue = nextCurrentIndex;
    return Object.freeze({
      appliedDeltaX: canMove ? floatDeltaX : 0,
      currentIndex: nextCurrentIndex,
      moved: canMove,
    });
  }

  /** Changes only the index; the next unpressed frame performs rail centering. */
  flick(deltaX: number): ModeSelectFlickResult {
    const floatDeltaX = finiteFloat32(deltaX, 'deltaX');
    const previousIndex = this.currentIndexValue;
    let nextIndex = previousIndex;
    if (floatDeltaX > 0 && previousIndex > 0) {
      nextIndex = (previousIndex - 1) as ModeSelectCurrentIndex;
    } else if (floatDeltaX < 0 && previousIndex < MODE_SELECT_LAST_CARD_INDEX) {
      nextIndex = (previousIndex + 1) as ModeSelectCurrentIndex;
    }
    this.currentIndexValue = nextIndex;
    return Object.freeze({
      changed: nextIndex !== previousIndex,
      currentIndex: nextIndex,
      previousIndex,
    });
  }

  /** Advances one scheduled frame; elapsed time is deliberately not an input. */
  updateFrame(pressed: boolean): ModeSelectFrameResult {
    if (typeof pressed !== 'boolean') {
      throw new TypeError('pressed must be a boolean');
    }
    if (pressed) {
      return Object.freeze({
        appliedDeltaX: 0,
        centerDifference: null,
        pressed: true,
      });
    }
    const selectedAnchorX = requireSelectedAnchor(
      this.anchorXsValue,
      this.currentIndexValue,
    );
    const targetX = multiplyFloat32(this.layoutValue.logicalWidth, HALF);
    const difference = subtractFloat32(targetX, selectedAnchorX);
    let deltaX = difference;
    if (difference === 0) {
      deltaX = 0;
    } else if (Math.abs(difference) > CENTERING_SNAP_THRESHOLD) {
      deltaX = addFloat32(
        multiplyFloat32(CENTERING_FACTOR, difference),
        divideFloat32(Math.abs(difference), difference),
      );
    }

    if (deltaX !== 0) {
      this.anchorXsValue = shiftedAnchors(this.anchorXsValue, deltaX);
    }
    return Object.freeze({
      appliedDeltaX: deltaX,
      centerDifference: difference,
      pressed: false,
    });
  }

  /** Fixed callback-to-state mapping. Every call emits another independent delay command. */
  selectMode(
    modeIndex: number,
    effectsEnabled: boolean,
  ): readonly ModeSelectSelectionCommand[] {
    const selectedModeIndex = requireModeIndex(modeIndex, 'modeIndex');
    if (typeof effectsEnabled !== 'boolean') {
      throw new TypeError('effectsEnabled must be a boolean');
    }
    const commands = effectsEnabled
      ? Object.freeze([REQUEST_SELECTION_AUDIO, SCHEDULE_MODE_NAVIGATION])
      : Object.freeze([SCHEDULE_MODE_NAVIGATION]);
    this.destinationStateValue = selectedModeIndex;
    return commands;
  }

  /** The delayed callback intentionally reads the current shared destination state. */
  delayedNavigationCommands(): readonly ModeSelectDelayedNavigationCommand[] {
    return createModeSelectDelayedNavigationCommands(this.destinationStateValue);
  }

  /** Unlock sender identity is intentionally absent; native behavior uses currentIndex. */
  unlockCurrentMode(totalCoins: number): ModeSelectUnlockOutcome {
    assertSignedInt32(totalCoins, 'totalCoins');
    const modeIndex = requireModeIndex(this.currentIndexValue, 'currentIndex');
    if (totalCoins <= MODE_SELECT_UNLOCK_PRICE - 1) {
      return Object.freeze({
        burstPlan: null,
        commands: INSUFFICIENT_COINS_COMMANDS,
        modeIndex,
        nextTotalCoins: totalCoins,
        success: false,
      });
    }

    // Build and validate the complete output before mutating the lock snapshot.
    const burstPlan = createModeSelectUnlockBurstPlan(this.layoutValue);
    const nextTotalCoins = totalCoins - MODE_SELECT_UNLOCK_PRICE;
    assertSignedInt32(nextTotalCoins, 'nextTotalCoins');
    const commands = createSuccessfulUnlockCommands(
      modeIndex,
      totalCoins,
      nextTotalCoins,
      burstPlan,
    );
    this.cardLocksValue[modeIndex] = false;
    return Object.freeze({
      burstPlan,
      commands,
      modeIndex,
      nextTotalCoins,
      success: true,
    });
  }
}

export function createModeSelectDelayedNavigationCommands(
  destinationState: number,
): readonly ModeSelectDelayedNavigationCommand[] {
  assertSignedInt32(destinationState, 'destinationState');
  const commands: ModeSelectDelayedNavigationCommand[] = [
    CAPTURE_MODE_SELECT_PARENT,
    REMOVE_MODE_SELECT,
  ];
  if (isModeIndex(destinationState)) {
    const destination = requireDestination(destinationState);
    commands.push(
      Object.freeze({
        destination,
        destinationState,
        fresh: true,
        type: 'construct-mode-destination',
      }),
      Object.freeze({
        boundary: MODE_SELECT_CAPTURED_PARENT_BOUNDARY,
        destination,
        destinationState,
        type: 'attach-mode-destination-to-captured-parent',
        zOrder: MODE_SELECT_NAVIGATION_Z_ORDER,
      }),
    );
  }
  return Object.freeze(commands);
}

/** Back-key callers delegate here and therefore receive the same immediate command order. */
export function createModeSelectBackCommands(
  effectsEnabled: boolean,
): readonly ModeSelectBackCommand[] {
  if (typeof effectsEnabled !== 'boolean') {
    throw new TypeError('effectsEnabled must be a boolean');
  }
  return Object.freeze([
    ...(effectsEnabled ? [REQUEST_MENU_BUTTON_AUDIO] : []),
    STOP_ALL_MODE_SELECT_ACTIONS,
    CAPTURE_MODE_SELECT_PARENT,
    REMOVE_MODE_SELECT,
    CONSTRUCT_MAIN_MENU,
    ATTACH_MAIN_MENU,
  ]);
}

export function createModeSelectUnlockBurstPlan(
  layout: ModeSelectLayoutInput,
): ModeSelectUnlockBurstPlan {
  assertLayout(layout);
  const copiedLayout = copyLayout(layout);
  const widthScale = divideFloat32(
    copiedLayout.logicalWidth,
    UNLOCK_DISTANCE_REFERENCE_WIDTH,
  );
  const minimumTravelMagnitude = Math.trunc(multiplyFloat32(
    widthScale,
    UNLOCK_MINIMUM_DISTANCE_FACTOR,
  ));
  const maximumTravelMagnitude = Math.trunc(multiplyFloat32(
    widthScale,
    UNLOCK_MAXIMUM_DISTANCE_FACTOR,
  ));
  assertNonNegativeSafeInteger(minimumTravelMagnitude, 'minimumTravelMagnitude');
  assertNonNegativeSafeInteger(maximumTravelMagnitude, 'maximumTravelMagnitude');

  return Object.freeze({
    autoDeleteParticles: false,
    cleanupDelaySeconds: MODE_SELECT_UNLOCK_PARTICLE_CLEANUP_DELAY_SECONDS,
    colorFlags: Object.freeze([false, false] as const),
    emitterWorldPosition: point(
      copiedLayout.visibleCenterX,
      multiplyFloat32(copiedLayout.logicalHeight, UNLOCK_EMITTER_Y_FACTOR),
    ),
    fadeOutParticles: false,
    maximumTravelMagnitude,
    minimumTravelMagnitude,
    particleCount: MODE_SELECT_UNLOCK_PARTICLE_COUNT,
    particleRootZOrder: MODE_SELECT_UNLOCK_PARTICLE_Z_ORDER,
    removeAtSeconds: MODE_SELECT_UNLOCK_PARTICLE_REMOVE_AT_SECONDS,
    spriteChildZOrder: MODE_SELECT_UNLOCK_PARTICLE_SPRITE_Z_ORDER,
    startDelaySeconds: MODE_SELECT_UNLOCK_PARTICLE_DELAY_SECONDS,
    textureLogicalPath: MODE_SELECT_UNLOCK_PARTICLE_TEXTURE_PATH,
  });
}

/**
 * Performs the recovered synchronous unlock burst after the 0.05-second container delay.
 * Each particle consumes duration, X sign, X magnitude, Y sign, then Y magnitude.
 */
export function createModeSelectUnlockParticleBurst(
  plan: ModeSelectUnlockBurstPlan,
  random: ModeSelectUnlockParticleRandom,
): readonly ModeSelectUnlockParticlePlan[] {
  assertUnlockBurstPlan(plan);
  assertUnlockParticleRandom(random);

  const particles: ModeSelectUnlockParticlePlan[] = [];
  for (let index = 0; index < plan.particleCount; index += 1) {
    const durationHundredths = drawUnlockInclusive(
      random,
      MODE_SELECT_UNLOCK_PARTICLE_DURATION_MINIMUM_HUNDREDTHS,
      MODE_SELECT_UNLOCK_PARTICLE_DURATION_MAXIMUM_HUNDREDTHS,
    );
    const horizontalSign = normalizeUnlockSign(drawUnlockInclusive(random, -1, 1));
    const horizontalMagnitude = drawUnlockInclusive(
      random,
      plan.minimumTravelMagnitude,
      plan.maximumTravelMagnitude,
    );
    const verticalSign = normalizeUnlockSign(drawUnlockInclusive(random, -1, 1));
    const verticalMagnitude = drawUnlockInclusive(
      random,
      plan.minimumTravelMagnitude,
      plan.maximumTravelMagnitude,
    );
    const durationSeconds = divideFloat32(durationHundredths, HUNDREDTHS_PER_SECOND);
    const deltaLocal = point(
      horizontalSign * horizontalMagnitude,
      verticalSign * verticalMagnitude,
    );
    const moveAction = Object.freeze({
      deltaLocal,
      durationSeconds,
      type: 'move-by' as const,
    });
    const finishedCallback = Object.freeze({
      type: 'invoke-finished-callback' as const,
    });

    particles.push(Object.freeze({
      actionsRunConcurrently: true,
      appliesColor: false,
      autoDelete: false,
      deltaLocal,
      durationHundredths,
      durationSeconds,
      fadeOut: false,
      horizontalMagnitude,
      horizontalSign,
      index,
      moveActionSequence: Object.freeze([moveAction, finishedCallback] as const),
      particleRootZOrder: MODE_SELECT_UNLOCK_PARTICLE_Z_ORDER,
      rotateAction: Object.freeze({
        deltaX: 1 as const,
        deltaY: 1 as const,
        durationSeconds,
        overload: 'three-argument' as const,
        type: 'rotate-by' as const,
      }),
      scaleAction: Object.freeze({
        durationSeconds,
        scaleX: 0 as const,
        scaleY: 0 as const,
        type: 'scale-to' as const,
      }),
      spriteChildZOrder: MODE_SELECT_UNLOCK_PARTICLE_SPRITE_Z_ORDER,
      verticalMagnitude,
      verticalSign,
    }));
  }

  return Object.freeze(particles);
}

function createInitialAnchorXs(layout: ModeSelectLayoutInput): number[] {
  return Array.from({ length: MODE_SELECT_CARD_COUNT }, (_, index) => subtractFloat32(
    layout.visibleCenterX,
    multiplyFloat32(5 - index, layout.logicalWidth),
  ));
}

function createInitialCardLocks(unlocks: ModeSelectPersistedUnlocks): boolean[] {
  return [
    false,
    !(unlocks[1] ?? false),
    !(unlocks[2] ?? false),
    false,
    !(unlocks[4] ?? false),
    !(unlocks[5] ?? false),
  ];
}

function createSuccessfulUnlockCommands(
  modeIndex: ModeSelectIndex,
  totalCoins: number,
  nextTotalCoins: number,
  burstPlan: ModeSelectUnlockBurstPlan,
): readonly ModeSelectUnlockCommand[] {
  return Object.freeze([
    Object.freeze({
      flushCalled: true,
      fromRereadValue: totalCoins,
      persistence: 'process-memory-until-save-data',
      storageKey: MODE_SELECT_TOTAL_COINS_STORAGE_KEY,
      type: 'set-process-total-coins',
      value: nextTotalCoins,
      writesStorageKey: false,
    }),
    Object.freeze({
      flushImmediately: true,
      modeIndex,
      storageKey: modeUnlockStorageKey(modeIndex),
      type: 'persist-mode-unlock',
      value: true,
    }),
    Object.freeze({
      fruitCutDisabled: false,
      lockMenuVisible: false,
      modeIndex,
      removesLockMenu: false,
      type: 'unlock-rope-button',
    }),
    Object.freeze({
      durationMaximumHundredths: MODE_SELECT_UNLOCK_PARTICLE_DURATION_MAXIMUM_HUNDREDTHS,
      durationMinimumHundredths: MODE_SELECT_UNLOCK_PARTICLE_DURATION_MINIMUM_HUNDREDTHS,
      maximumTravelMagnitude: burstPlan.maximumTravelMagnitude,
      minimumTravelMagnitude: burstPlan.minimumTravelMagnitude,
      particleCount: MODE_SELECT_UNLOCK_PARTICLE_COUNT,
      type: 'construct-unlock-particle-container',
    }),
    Object.freeze({
      type: 'position-unlock-particle-container',
      worldPosition: burstPlan.emitterWorldPosition,
    }),
    Object.freeze({
      autoDeleteParticles: false,
      cleanupDelaySeconds: burstPlan.cleanupDelaySeconds,
      colorFlags: burstPlan.colorFlags,
      fadeOutParticles: false,
      removeAtSeconds: burstPlan.removeAtSeconds,
      startDelaySeconds: burstPlan.startDelaySeconds,
      textureLogicalPath: burstPlan.textureLogicalPath,
      type: 'configure-unlock-particle-container',
    }),
    Object.freeze({
      type: 'attach-unlock-particle-container',
      zOrder: MODE_SELECT_UNLOCK_PARTICLE_Z_ORDER,
    }),
  ]);
}

function lastQualifyingIndex(
  anchorXs: readonly number[],
  logicalWidth: number,
): ModeSelectCurrentIndex {
  const halfWidth = multiplyFloat32(logicalWidth, HALF);
  let currentIndex: ModeSelectCurrentIndex = -1;
  for (let index = 0; index < MODE_SELECT_CARD_COUNT; index += 1) {
    const anchorX = requireAnchor(anchorXs, index);
    if (subtractFloat32(anchorX, halfWidth) < logicalWidth) {
      currentIndex = index as ModeSelectIndex;
      // The native path computes absolute center distance here but does not compare it.
      Math.abs(subtractFloat32(anchorX, halfWidth));
    }
  }
  return currentIndex;
}

function shiftedAnchors(anchorXs: readonly number[], deltaX: number): number[] {
  return anchorXs.map((anchorX, index) => finiteFloat32(
    addFloat32(anchorX, deltaX),
    `anchorXs[${index}] after move`,
  ));
}

function modeUnlockStorageKey(modeIndex: ModeSelectIndex): string {
  return `mode_unlock_${modeIndex}`;
}

function requireDestination(modeIndex: ModeSelectIndex): ModeSelectDestination {
  const destination = MODE_DESTINATIONS[modeIndex];
  if (destination === undefined) {
    throw new Error(`Mode Select destination ${modeIndex} is unavailable`);
  }
  return destination;
}

function requireSelectedAnchor(
  anchorXs: readonly number[],
  currentIndex: ModeSelectCurrentIndex,
): number {
  if (!isModeIndex(currentIndex)) {
    throw new RangeError('currentIndex must identify a card before an unpressed update');
  }
  return requireAnchor(anchorXs, currentIndex);
}

function requireAnchor(anchorXs: readonly number[], index: number): number {
  const anchorX = anchorXs[index];
  if (anchorX === undefined) {
    throw new Error(`Mode Select anchor ${index} is unavailable`);
  }
  return anchorX;
}

function assertStateInput(input: ModeSelectStateInput): void {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('input must be a Mode Select state object');
  }
  assertLayout(input.layout);
  assertPersistedUnlocks(input.persistedUnlocks ?? {});
}

function assertLayout(layout: ModeSelectLayoutInput): void {
  if (layout === null || typeof layout !== 'object' || Array.isArray(layout)) {
    throw new TypeError('layout must be an object');
  }
  positiveFiniteFloat32(layout.logicalWidth, 'layout.logicalWidth');
  positiveFiniteFloat32(layout.logicalHeight, 'layout.logicalHeight');
  finiteFloat32(layout.visibleCenterX, 'layout.visibleCenterX');
  finiteFloat32(layout.visibleLeftX, 'layout.visibleLeftX');
}

function assertPersistedUnlocks(unlocks: ModeSelectPersistedUnlocks): void {
  if (unlocks === null || typeof unlocks !== 'object' || Array.isArray(unlocks)) {
    throw new TypeError('persistedUnlocks must be an object');
  }
  const allowedKeys = new Set(['1', '2', '4', '5']);
  for (const key of Object.keys(unlocks)) {
    if (!allowedKeys.has(key)) {
      throw new RangeError('persistedUnlocks may contain only mode indices 1, 2, 4, and 5');
    }
    if (typeof unlocks[key as unknown as keyof ModeSelectPersistedUnlocks] !== 'boolean') {
      throw new TypeError(`persistedUnlocks[${key}] must be a boolean`);
    }
  }
}

function requireModeIndex(value: number, label: string): ModeSelectIndex {
  if (!isModeIndex(value)) {
    throw new RangeError(`${label} must identify one of the six Mode Select cards`);
  }
  return value;
}

function isModeIndex(value: number): value is ModeSelectIndex {
  return Number.isSafeInteger(value) && value >= 0 && value <= MODE_SELECT_LAST_CARD_INDEX;
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

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
}

function assertUnlockBurstPlan(plan: ModeSelectUnlockBurstPlan): void {
  if (plan === null || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new TypeError('unlock burst plan must be an object');
  }
  if (plan.textureLogicalPath !== MODE_SELECT_UNLOCK_PARTICLE_TEXTURE_PATH) {
    throw new RangeError('unlock burst plan must use the exact recovered texture');
  }
  if (plan.startDelaySeconds !== MODE_SELECT_UNLOCK_PARTICLE_DELAY_SECONDS) {
    throw new RangeError('unlock burst plan must use the recovered start delay');
  }
  if (plan.cleanupDelaySeconds !== MODE_SELECT_UNLOCK_PARTICLE_CLEANUP_DELAY_SECONDS) {
    throw new RangeError('unlock burst plan must use the recovered cleanup delay');
  }
  if (plan.removeAtSeconds !== MODE_SELECT_UNLOCK_PARTICLE_REMOVE_AT_SECONDS) {
    throw new RangeError('unlock burst plan must use the recovered removal time');
  }
  if (plan.particleCount !== MODE_SELECT_UNLOCK_PARTICLE_COUNT) {
    throw new RangeError('unlock burst plan must contain exactly 45 particles');
  }
  if (plan.particleRootZOrder !== MODE_SELECT_UNLOCK_PARTICLE_Z_ORDER) {
    throw new RangeError('unlock particles must use recovered root z-order 1');
  }
  if (plan.spriteChildZOrder !== MODE_SELECT_UNLOCK_PARTICLE_SPRITE_Z_ORDER) {
    throw new RangeError('unlock particle sprites must use default child z-order 0');
  }
  if (plan.autoDeleteParticles !== false || plan.fadeOutParticles !== false) {
    throw new RangeError('unlock particles must remain retained and must not fade');
  }
  if (
    !Array.isArray(plan.colorFlags)
    || plan.colorFlags.length !== 2
    || plan.colorFlags[0] !== false
    || plan.colorFlags[1] !== false
  ) {
    throw new RangeError('unlock burst plan must preserve both false color flags');
  }
  if (
    plan.emitterWorldPosition === null
    || typeof plan.emitterWorldPosition !== 'object'
    || Array.isArray(plan.emitterWorldPosition)
  ) {
    throw new TypeError('unlock burst emitterWorldPosition must be an object');
  }
  finiteFloat32(plan.emitterWorldPosition.x, 'unlock burst emitterWorldPosition.x');
  finiteFloat32(plan.emitterWorldPosition.y, 'unlock burst emitterWorldPosition.y');
  assertNonNegativeSafeInteger(
    plan.minimumTravelMagnitude,
    'unlock burst minimumTravelMagnitude',
  );
  assertNonNegativeSafeInteger(
    plan.maximumTravelMagnitude,
    'unlock burst maximumTravelMagnitude',
  );
  if (plan.minimumTravelMagnitude > plan.maximumTravelMagnitude) {
    throw new RangeError('unlock burst travel bounds must be ordered');
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

function drawUnlockInclusive(
  random: ModeSelectUnlockParticleRandom,
  minimumInclusive: number,
  maximumInclusive: number,
): number {
  const value = random.nextIntInclusive(minimumInclusive, maximumInclusive);
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(
      `nextIntInclusive(${minimumInclusive}, ${maximumInclusive}) must return a safe integer`,
    );
  }
  if (value < minimumInclusive || value > maximumInclusive) {
    throw new RangeError(
      `nextIntInclusive(${minimumInclusive}, ${maximumInclusive}) returned ${value} outside the inclusive range`,
    );
  }
  return value;
}

function normalizeUnlockSign(value: number): ModeSelectUnlockParticleSign {
  if (value === -1) {
    return -1;
  }
  if (value === 1) {
    return 1;
  }
  return 0;
}

function copyLayout(layout: ModeSelectLayoutInput): ModeSelectLayoutInput {
  return Object.freeze({
    logicalHeight: finiteFloat32(layout.logicalHeight, 'layout.logicalHeight'),
    logicalWidth: finiteFloat32(layout.logicalWidth, 'layout.logicalWidth'),
    visibleCenterX: finiteFloat32(layout.visibleCenterX, 'layout.visibleCenterX'),
    visibleLeftX: finiteFloat32(layout.visibleLeftX, 'layout.visibleLeftX'),
  });
}

function point(x: number, y: number): ModeSelectPoint {
  return Object.freeze({ x: finiteFloat32(x, 'point.x'), y: finiteFloat32(y, 'point.y') });
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
