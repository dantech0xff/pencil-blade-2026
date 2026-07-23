import type {
  MainMenuFruitButtonPurpose,
  MainMenuFruitId,
} from './main-menu-resource-contract';
import {
  MAIN_MENU_BUTTON_AUDIO_CANONICAL_PATH,
  MAIN_MENU_MUSIC_AUDIO_CANONICAL_PATH,
  getMainMenuFruitButtonDefinition,
  getMainMenuFruitButtonDefinitionById,
} from './main-menu-resource-contract';

export const MAIN_MENU_INITIAL_NAVIGATION_STATE = 0 as const;
export const MAIN_MENU_NAVIGATION_DELAY_SECONDS = Math.fround(0.75);
export const MAIN_MENU_NAVIGATION_Z_ORDER = 1 as const;
export const MAIN_MENU_REVIEW_REWARD_COINS = 500 as const;
export const MAIN_MENU_CAPTURED_PARENT_BOUNDARY = 'captured-main-menu-parent' as const;

export type MainMenuNavigationState = 0 | 1 | 2 | 3;
export type MainMenuDestinationState = 1 | 2 | 3;
export type MainMenuDestinationLayer =
  | 'ModeSelectLayer'
  | 'LeaderboardLayer'
  | 'ObjectivesLayer';
export type MainMenuImmediateDestinationLayer = 'AboutLayer' | 'OptionsLayer';
export type MainMenuToggleIndex = 0 | 1;

export interface MainMenuStateInput {
  readonly effectsEnabled: boolean;
  readonly musicEnabled: boolean;
  readonly networkAvailable: boolean;
  readonly rated: boolean;
  readonly totalCoins: number;
}

export interface MainMenuStateSnapshot {
  readonly cuttingDisabled: boolean;
  readonly effectsEnabled: boolean;
  readonly effectsToggleIndex: MainMenuToggleIndex;
  readonly musicEnabled: boolean;
  readonly musicToggleIndex: MainMenuToggleIndex;
  readonly navigationState: MainMenuNavigationState;
  readonly networkAvailable: boolean;
  readonly rated: boolean;
  readonly totalCoins: number;
}

export type MainMenuAudioCommand =
  | Readonly<{
      readonly type: 'set-background-music-volume';
      readonly value: 1;
    }>
  | Readonly<{
      readonly type: 'set-effects-volume';
      readonly value: 1;
    }>
  | Readonly<{
      readonly canonicalPath: typeof MAIN_MENU_MUSIC_AUDIO_CANONICAL_PATH;
      readonly loop: true;
      readonly type: 'request-background-music';
    }>
  | Readonly<{
      /** Recovered `false` argument; adapter naming must not change its value. */
      readonly releaseData: false;
      readonly type: 'stop-background-music';
    }>
  | Readonly<{
      readonly type: 'stop-all-effects';
    }>
  | Readonly<{
      readonly canonicalPath: typeof MAIN_MENU_BUTTON_AUDIO_CANONICAL_PATH;
      readonly loop: false;
      readonly type: 'request-menu-button-audio';
    }>;

export type MainMenuSettingCommand =
  | Readonly<{
      readonly enabled: boolean;
      readonly reason: 'callback-flip' | 'initialization-compensation';
      readonly type: 'set-music-enabled';
    }>
  | Readonly<{
      readonly enabled: boolean;
      readonly reason: 'callback-flip' | 'initialization-compensation';
      readonly type: 'set-effects-enabled';
    }>;

export type MainMenuConstructionCommand =
  | MainMenuAudioCommand
  | MainMenuSettingCommand
  | Readonly<{
      readonly type: 'set-navigation-state';
      readonly value: 0;
    }>
  | Readonly<{
      readonly invokesCallback: true;
      readonly selectedIndex: 1;
      readonly toggle: 'music' | 'effects';
      readonly type: 'activate-toggle';
    }>;

export type MainMenuToggleCommand = MainMenuAudioCommand | MainMenuSettingCommand;

export type MainMenuImmediateReplacementCommand =
  | Readonly<{
      readonly boundary: typeof MAIN_MENU_CAPTURED_PARENT_BOUNDARY;
      readonly type: 'capture-main-menu-parent';
    }>
  | Readonly<{
      readonly cleanup: true;
      readonly type: 'remove-main-menu';
    }>
  | Readonly<{
      readonly destination: MainMenuImmediateDestinationLayer;
      readonly fresh: true;
      readonly type: 'construct-immediate-destination';
    }>
  | Readonly<{
      readonly boundary: typeof MAIN_MENU_CAPTURED_PARENT_BOUNDARY;
      readonly destination: MainMenuImmediateDestinationLayer;
      readonly type: 'attach-immediate-destination-to-captured-parent';
      readonly zOrder: 1;
    }>
  | Extract<MainMenuAudioCommand, { readonly type: 'request-menu-button-audio' }>;

export type MainMenuReviewCommand =
  | Readonly<{
      readonly boundary: 'isolated-platform-review-port';
      readonly type: 'request-platform-review';
    }>
  | Readonly<{
      readonly type: 'persist-rated-flag';
      readonly value: true;
    }>
  | Readonly<{
      readonly type: 'set-rated-in-memory';
      readonly value: true;
    }>
  | Readonly<{
      readonly delta: 500;
      readonly nextTotalCoins: number;
      readonly previousTotalCoins: number;
      readonly type: 'add-total-coins';
      readonly updatesExistingLabel: false;
    }>;

export type MainMenuExitCommand =
  | Extract<MainMenuAudioCommand, { readonly type: 'request-menu-button-audio' }>
  | Readonly<{ readonly type: 'end-director' }>
  | Readonly<{ readonly type: 'save-settings-data' }>;

export type MainMenuFruitNavigationCommand =
  | Readonly<{
      readonly disabled: true;
      readonly type: 'set-cutting-disabled';
    }>
  | Readonly<{
      readonly actions: readonly [
        Readonly<{ readonly durationSeconds: number; readonly type: 'delay' }>,
        Readonly<{ readonly callback: 'delayed-navigation'; readonly type: 'invoke-callback' }>,
      ];
      readonly destinationReadAtExecution: true;
      readonly type: 'schedule-main-menu-navigation';
    }>
  | Readonly<{
      readonly type: 'set-navigation-state';
      readonly value: MainMenuDestinationState;
    }>;

export interface MainMenuFruitNavigationOutcome {
  readonly accepted: boolean;
  readonly commands: readonly MainMenuFruitNavigationCommand[];
  readonly destinationState: MainMenuDestinationState;
  readonly fruitId: MainMenuFruitId;
  readonly purpose: MainMenuFruitButtonPurpose;
}

export type MainMenuDelayedNavigationCommand =
  | Readonly<{
      readonly boundary: typeof MAIN_MENU_CAPTURED_PARENT_BOUNDARY;
      readonly type: 'capture-main-menu-parent';
    }>
  | Readonly<{
      readonly cleanup: true;
      readonly type: 'remove-main-menu';
    }>
  | Readonly<{
      readonly destination: MainMenuDestinationLayer;
      readonly destinationState: MainMenuDestinationState;
      readonly fresh: true;
      readonly type: 'construct-delayed-destination';
    }>
  | Readonly<{
      readonly boundary: typeof MAIN_MENU_CAPTURED_PARENT_BOUNDARY;
      readonly destination: MainMenuDestinationLayer;
      readonly destinationState: MainMenuDestinationState;
      readonly type: 'attach-delayed-destination-to-captured-parent';
      readonly zOrder: 1;
    }>
  | Extract<MainMenuAudioCommand, { readonly type: 'stop-background-music' }>;

const EMPTY_FRUIT_NAVIGATION_COMMANDS: readonly MainMenuFruitNavigationCommand[]
  = Object.freeze([]);
const SET_INITIAL_NAVIGATION_STATE: MainMenuConstructionCommand = Object.freeze({
  type: 'set-navigation-state',
  value: MAIN_MENU_INITIAL_NAVIGATION_STATE,
});
const SET_BACKGROUND_MUSIC_VOLUME: MainMenuAudioCommand = Object.freeze({
  type: 'set-background-music-volume',
  value: 1,
});
const SET_EFFECTS_VOLUME: MainMenuAudioCommand = Object.freeze({
  type: 'set-effects-volume',
  value: 1,
});
const REQUEST_BACKGROUND_MUSIC: MainMenuAudioCommand = Object.freeze({
  canonicalPath: MAIN_MENU_MUSIC_AUDIO_CANONICAL_PATH,
  loop: true,
  type: 'request-background-music',
});
const STOP_BACKGROUND_MUSIC: Extract<
  MainMenuAudioCommand,
  { readonly type: 'stop-background-music' }
> = Object.freeze({
  releaseData: false,
  type: 'stop-background-music',
});
const STOP_ALL_EFFECTS: MainMenuAudioCommand = Object.freeze({
  type: 'stop-all-effects',
});
const REQUEST_MENU_BUTTON_AUDIO: Extract<
  MainMenuAudioCommand,
  { readonly type: 'request-menu-button-audio' }
> = Object.freeze({
  canonicalPath: MAIN_MENU_BUTTON_AUDIO_CANONICAL_PATH,
  loop: false,
  type: 'request-menu-button-audio',
});
const CAPTURE_MAIN_MENU_PARENT: Extract<
  MainMenuImmediateReplacementCommand,
  { readonly type: 'capture-main-menu-parent' }
> = Object.freeze({
  boundary: MAIN_MENU_CAPTURED_PARENT_BOUNDARY,
  type: 'capture-main-menu-parent',
});
const REMOVE_MAIN_MENU: Extract<
  MainMenuImmediateReplacementCommand,
  { readonly type: 'remove-main-menu' }
> = Object.freeze({
  cleanup: true,
  type: 'remove-main-menu',
});
const REQUEST_PLATFORM_REVIEW: MainMenuReviewCommand = Object.freeze({
  boundary: 'isolated-platform-review-port',
  type: 'request-platform-review',
});
const END_DIRECTOR: MainMenuExitCommand = Object.freeze({ type: 'end-director' });
const SAVE_SETTINGS_DATA: MainMenuExitCommand = Object.freeze({
  type: 'save-settings-data',
});

/** Pure state/command port for recovered Main Menu construction and callbacks. */
export class MainMenuState {
  private cuttingDisabledValue = false;
  private effectsEnabledValue: boolean;
  private readonly effectsToggleIndexValue: MainMenuToggleIndex;
  private musicEnabledValue: boolean;
  private readonly musicToggleIndexValue: MainMenuToggleIndex;
  private navigationStateValue: MainMenuNavigationState = MAIN_MENU_INITIAL_NAVIGATION_STATE;
  private readonly networkAvailableValue: boolean;
  private ratedValue: boolean;
  private totalCoinsValue: number;
  private readonly constructionCommandsValue: readonly MainMenuConstructionCommand[];

  constructor(input: MainMenuStateInput) {
    const copiedInput = copyStateInput(input);
    const construction = createConstructionCommands(copiedInput);
    this.effectsEnabledValue = copiedInput.effectsEnabled;
    this.effectsToggleIndexValue = construction.effectsToggleIndex;
    this.musicEnabledValue = copiedInput.musicEnabled;
    this.musicToggleIndexValue = construction.musicToggleIndex;
    this.networkAvailableValue = copiedInput.networkAvailable;
    this.ratedValue = copiedInput.rated;
    this.totalCoinsValue = copiedInput.totalCoins;
    this.constructionCommandsValue = construction.commands;
  }

  get constructionCommands(): readonly MainMenuConstructionCommand[] {
    return this.constructionCommandsValue;
  }

  get snapshot(): MainMenuStateSnapshot {
    return Object.freeze({
      cuttingDisabled: this.cuttingDisabledValue,
      effectsEnabled: this.effectsEnabledValue,
      effectsToggleIndex: this.effectsToggleIndexValue,
      musicEnabled: this.musicEnabledValue,
      musicToggleIndex: this.musicToggleIndexValue,
      navigationState: this.navigationStateValue,
      networkAvailable: this.networkAvailableValue,
      rated: this.ratedValue,
      totalCoins: this.totalCoinsValue,
    });
  }

  toggleMusic(): readonly MainMenuToggleCommand[] {
    const nextMusicEnabled = !this.musicEnabledValue;
    const commands: MainMenuToggleCommand[] = [settingMusic(nextMusicEnabled, 'callback-flip')];
    if (!nextMusicEnabled) {
      commands.push(STOP_BACKGROUND_MUSIC);
    }
    if (this.effectsEnabledValue) {
      commands.push(REQUEST_MENU_BUTTON_AUDIO);
    }
    const frozenCommands = Object.freeze(commands);
    this.musicEnabledValue = nextMusicEnabled;
    return frozenCommands;
  }

  toggleEffects(): readonly MainMenuToggleCommand[] {
    const nextEffectsEnabled = !this.effectsEnabledValue;
    const commands: MainMenuToggleCommand[] = [
      settingEffects(nextEffectsEnabled, 'callback-flip'),
      nextEffectsEnabled ? REQUEST_MENU_BUTTON_AUDIO : STOP_ALL_EFFECTS,
    ];
    const frozenCommands = Object.freeze(commands);
    this.effectsEnabledValue = nextEffectsEnabled;
    return frozenCommands;
  }

  aboutCommands(): readonly MainMenuImmediateReplacementCommand[] {
    return createMainMenuImmediateReplacementCommands('AboutLayer', this.effectsEnabledValue);
  }

  optionsCommands(): readonly MainMenuImmediateReplacementCommand[] {
    return createMainMenuImmediateReplacementCommands('OptionsLayer', this.effectsEnabledValue);
  }

  reviewCommands(): readonly MainMenuReviewCommand[] {
    if (this.ratedValue || !this.networkAvailableValue) {
      return Object.freeze([REQUEST_PLATFORM_REVIEW]);
    }

    const nextTotalCoins = this.totalCoinsValue + MAIN_MENU_REVIEW_REWARD_COINS;
    assertSignedInt32(nextTotalCoins, 'review nextTotalCoins');
    const commands: readonly MainMenuReviewCommand[] = Object.freeze([
      REQUEST_PLATFORM_REVIEW,
      Object.freeze({ type: 'persist-rated-flag' as const, value: true as const }),
      Object.freeze({ type: 'set-rated-in-memory' as const, value: true as const }),
      Object.freeze({
        delta: MAIN_MENU_REVIEW_REWARD_COINS,
        nextTotalCoins,
        previousTotalCoins: this.totalCoinsValue,
        type: 'add-total-coins' as const,
        updatesExistingLabel: false as const,
      }),
    ]);
    this.ratedValue = true;
    this.totalCoinsValue = nextTotalCoins;
    return commands;
  }

  exitCommands(): readonly MainMenuExitCommand[] {
    return Object.freeze([
      ...(this.effectsEnabledValue ? [REQUEST_MENU_BUTTON_AUDIO] : []),
      END_DIRECTOR,
      SAVE_SETTINGS_DATA,
    ]);
  }

  acceptFruitNavigation(
    purpose: MainMenuFruitButtonPurpose,
  ): MainMenuFruitNavigationOutcome {
    const definition = getMainMenuFruitButtonDefinition(purpose);
    return this.acceptValidatedFruitNavigation(
      definition.purpose,
      definition.fruitId,
      destinationStateForPurpose(definition.purpose),
    );
  }

  acceptFruitNavigationById(fruitId: number): MainMenuFruitNavigationOutcome {
    const definition = getMainMenuFruitButtonDefinitionById(fruitId);
    return this.acceptValidatedFruitNavigation(
      definition.purpose,
      definition.fruitId,
      destinationStateForPurpose(definition.purpose),
    );
  }

  delayedNavigationCommands(): readonly MainMenuDelayedNavigationCommand[] {
    return createMainMenuDelayedNavigationCommands(
      this.navigationStateValue,
      this.musicEnabledValue,
    );
  }

  private acceptValidatedFruitNavigation(
    purpose: MainMenuFruitButtonPurpose,
    fruitId: MainMenuFruitId,
    destinationState: MainMenuDestinationState,
  ): MainMenuFruitNavigationOutcome {
    if (this.navigationStateValue !== MAIN_MENU_INITIAL_NAVIGATION_STATE) {
      return Object.freeze({
        accepted: false,
        commands: EMPTY_FRUIT_NAVIGATION_COMMANDS,
        destinationState,
        fruitId,
        purpose,
      });
    }

    const commands: readonly MainMenuFruitNavigationCommand[] = deepFreeze([
      { disabled: true as const, type: 'set-cutting-disabled' as const },
      {
        actions: [
          { durationSeconds: MAIN_MENU_NAVIGATION_DELAY_SECONDS, type: 'delay' as const },
          { callback: 'delayed-navigation' as const, type: 'invoke-callback' as const },
        ],
        destinationReadAtExecution: true as const,
        type: 'schedule-main-menu-navigation' as const,
      },
      { type: 'set-navigation-state' as const, value: destinationState },
    ]);
    this.cuttingDisabledValue = true;
    this.navigationStateValue = destinationState;
    return Object.freeze({
      accepted: true,
      commands,
      destinationState,
      fruitId,
      purpose,
    });
  }
}

export function createMainMenuImmediateReplacementCommands(
  destination: MainMenuImmediateDestinationLayer,
  effectsEnabled: boolean,
): readonly MainMenuImmediateReplacementCommand[] {
  assertImmediateDestination(destination);
  assertBoolean(effectsEnabled, 'effectsEnabled');
  return Object.freeze([
    CAPTURE_MAIN_MENU_PARENT,
    REMOVE_MAIN_MENU,
    Object.freeze({
      destination,
      fresh: true as const,
      type: 'construct-immediate-destination' as const,
    }),
    Object.freeze({
      boundary: MAIN_MENU_CAPTURED_PARENT_BOUNDARY,
      destination,
      type: 'attach-immediate-destination-to-captured-parent' as const,
      zOrder: MAIN_MENU_NAVIGATION_Z_ORDER,
    }),
    ...(effectsEnabled ? [REQUEST_MENU_BUTTON_AUDIO] : []),
  ]);
}

export function createMainMenuDelayedNavigationCommands(
  navigationState: number,
  musicEnabled: boolean,
): readonly MainMenuDelayedNavigationCommand[] {
  assertSignedInt32(navigationState, 'navigationState');
  assertBoolean(musicEnabled, 'musicEnabled');
  const commands: MainMenuDelayedNavigationCommand[] = [
    CAPTURE_MAIN_MENU_PARENT,
    REMOVE_MAIN_MENU,
  ];
  if (isDestinationState(navigationState)) {
    const destination = destinationForState(navigationState);
    commands.push(
      Object.freeze({
        destination,
        destinationState: navigationState,
        fresh: true as const,
        type: 'construct-delayed-destination' as const,
      }),
      Object.freeze({
        boundary: MAIN_MENU_CAPTURED_PARENT_BOUNDARY,
        destination,
        destinationState: navigationState,
        type: 'attach-delayed-destination-to-captured-parent' as const,
        zOrder: MAIN_MENU_NAVIGATION_Z_ORDER,
      }),
    );
  }
  if (musicEnabled) {
    commands.push(STOP_BACKGROUND_MUSIC);
  }
  return Object.freeze(commands);
}

interface MainMenuConstructionResult {
  readonly commands: readonly MainMenuConstructionCommand[];
  readonly effectsToggleIndex: MainMenuToggleIndex;
  readonly musicToggleIndex: MainMenuToggleIndex;
}

function createConstructionCommands(input: MainMenuStateInput): MainMenuConstructionResult {
  const commands: MainMenuConstructionCommand[] = [
    SET_INITIAL_NAVIGATION_STATE,
    SET_BACKGROUND_MUSIC_VOLUME,
    SET_EFFECTS_VOLUME,
  ];
  let musicEnabled = input.musicEnabled;
  let effectsEnabled = input.effectsEnabled;
  if (musicEnabled) {
    commands.push(REQUEST_BACKGROUND_MUSIC);
  }

  let musicToggleIndex: MainMenuToggleIndex = 0;
  if (!musicEnabled) {
    commands.push(
      STOP_BACKGROUND_MUSIC,
      activateToggle('music'),
    );
    musicEnabled = !musicEnabled;
    commands.push(settingMusic(musicEnabled, 'callback-flip'));
    if (!musicEnabled) {
      commands.push(STOP_BACKGROUND_MUSIC);
    }
    if (effectsEnabled) {
      commands.push(REQUEST_MENU_BUTTON_AUDIO);
    }
    musicEnabled = !musicEnabled;
    commands.push(settingMusic(musicEnabled, 'initialization-compensation'));
    musicToggleIndex = 1;
  }

  let effectsToggleIndex: MainMenuToggleIndex = 0;
  if (!effectsEnabled) {
    commands.push(activateToggle('effects'));
    effectsEnabled = !effectsEnabled;
    commands.push(settingEffects(effectsEnabled, 'callback-flip'));
    if (!effectsEnabled) {
      commands.push(STOP_ALL_EFFECTS);
    } else {
      commands.push(REQUEST_MENU_BUTTON_AUDIO);
    }
    effectsEnabled = !effectsEnabled;
    commands.push(settingEffects(effectsEnabled, 'initialization-compensation'));
    effectsToggleIndex = 1;
  }

  return Object.freeze({
    commands: Object.freeze(commands),
    effectsToggleIndex,
    musicToggleIndex,
  });
}

function activateToggle(toggle: 'music' | 'effects'): MainMenuConstructionCommand {
  return Object.freeze({
    invokesCallback: true,
    selectedIndex: 1,
    toggle,
    type: 'activate-toggle',
  });
}

function settingMusic(
  enabled: boolean,
  reason: 'callback-flip' | 'initialization-compensation',
): MainMenuSettingCommand {
  return Object.freeze({ enabled, reason, type: 'set-music-enabled' });
}

function settingEffects(
  enabled: boolean,
  reason: 'callback-flip' | 'initialization-compensation',
): MainMenuSettingCommand {
  return Object.freeze({ enabled, reason, type: 'set-effects-enabled' });
}

function destinationStateForPurpose(
  purpose: MainMenuFruitButtonPurpose,
): MainMenuDestinationState {
  switch (purpose) {
    case 'new-game':
      return 1;
    case 'leaderboard':
      return 2;
    case 'objectives':
      return 3;
    default:
      return assertNever(purpose);
  }
}

function destinationForState(state: MainMenuDestinationState): MainMenuDestinationLayer {
  switch (state) {
    case 1:
      return 'ModeSelectLayer';
    case 2:
      return 'LeaderboardLayer';
    case 3:
      return 'ObjectivesLayer';
    default:
      return assertNever(state);
  }
}

function isDestinationState(value: number): value is MainMenuDestinationState {
  return value === 1 || value === 2 || value === 3;
}

function copyStateInput(input: MainMenuStateInput): MainMenuStateInput {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('input must be a Main Menu state object');
  }
  assertBoolean(input.effectsEnabled, 'effectsEnabled');
  assertBoolean(input.musicEnabled, 'musicEnabled');
  assertBoolean(input.networkAvailable, 'networkAvailable');
  assertBoolean(input.rated, 'rated');
  assertSignedInt32(input.totalCoins, 'totalCoins');
  return Object.freeze({
    effectsEnabled: input.effectsEnabled,
    musicEnabled: input.musicEnabled,
    networkAvailable: input.networkAvailable,
    rated: input.rated,
    totalCoins: input.totalCoins,
  });
}

function assertImmediateDestination(value: string): asserts value is MainMenuImmediateDestinationLayer {
  if (value !== 'AboutLayer' && value !== 'OptionsLayer') {
    throw new RangeError('destination must be AboutLayer or OptionsLayer');
  }
}

function assertBoolean(value: boolean, label: string): void {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be a boolean`);
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

function assertNever(value: never): never {
  throw new RangeError(`unsupported Main Menu state value: ${String(value)}`);
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
