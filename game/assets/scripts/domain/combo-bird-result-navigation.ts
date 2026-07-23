import { CLASSIC_MENU_BUTTON_AUDIO_PATH } from './classic-audio-contract';
import { COMBO_BIRD_RESULT_MODE_ID } from './combo-bird-result-ranking';

export const COMBO_BIRD_RESULT_MENU_BUTTON_AUDIO_PATH
  = CLASSIC_MENU_BUTTON_AUDIO_PATH;
export const COMBO_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY
  = 'captured-result-parent' as const;
export const COMBO_BIRD_RESULT_NAVIGATION_Z_ORDER = 1 as const;

export type ComboBirdResultNavigationRoute = 'retry' | 'main-menu';

export interface ComboBirdResultNavigationInput {
  readonly effectsEnabled: boolean;
  readonly mode: typeof COMBO_BIRD_RESULT_MODE_ID;
  readonly route: ComboBirdResultNavigationRoute;
}

export type ComboBirdResultNavigationCommand =
  | Readonly<{
      readonly canonicalPath: typeof COMBO_BIRD_RESULT_MENU_BUTTON_AUDIO_PATH;
      readonly loop: false;
      readonly type: 'request-menu-button-audio';
    }>
  | Readonly<{
      readonly boundary: typeof COMBO_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY;
      readonly type: 'capture-result-parent';
    }>
  | Readonly<{ readonly cleanup: true; readonly type: 'remove-result' }>
  | Readonly<{
      readonly fresh: true;
      readonly mode: typeof COMBO_BIRD_RESULT_MODE_ID;
      readonly type: 'construct-combo-bird';
    }>
  | Readonly<{
      readonly boundary: typeof COMBO_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY;
      readonly type: 'attach-combo-bird-to-captured-parent';
      readonly zOrder: 1;
    }>
  | Readonly<{ readonly fresh: true; readonly type: 'construct-main-menu' }>
  | Readonly<{
      readonly boundary: typeof COMBO_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY;
      readonly type: 'attach-main-menu-to-captured-parent';
      readonly zOrder: 1;
    }>;

export interface ComboBirdResultNavigationAbsences {
  readonly delays: false;
  readonly reloadsScene: false;
  readonly replacesScene: false;
  readonly reseedsRandom: false;
  readonly resetsSharedState: false;
  readonly saves: false;
  readonly stopsEffects: false;
}

const ABSENCES: ComboBirdResultNavigationAbsences = Object.freeze({
  delays: false,
  reloadsScene: false,
  replacesScene: false,
  reseedsRandom: false,
  resetsSharedState: false,
  saves: false,
  stopsEffects: false,
});

export const COMBO_BIRD_RESULT_NAVIGATION_CALLBACK_ABSENCES = Object.freeze({
  'main-menu': ABSENCES,
  retry: ABSENCES,
});

export function createComboBirdResultNavigationCommands(
  input: ComboBirdResultNavigationInput,
): readonly ComboBirdResultNavigationCommand[] {
  assertInput(input);
  const commands: ComboBirdResultNavigationCommand[] = [];
  if (input.effectsEnabled) {
    commands.push(Object.freeze({
      canonicalPath: COMBO_BIRD_RESULT_MENU_BUTTON_AUDIO_PATH,
      loop: false,
      type: 'request-menu-button-audio',
    }));
  }
  commands.push(
    Object.freeze({
      boundary: COMBO_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY,
      type: 'capture-result-parent',
    }),
    Object.freeze({ cleanup: true, type: 'remove-result' }),
  );
  if (input.route === 'retry') {
    commands.push(
      Object.freeze({
        fresh: true,
        mode: COMBO_BIRD_RESULT_MODE_ID,
        type: 'construct-combo-bird',
      }),
      Object.freeze({
        boundary: COMBO_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY,
        type: 'attach-combo-bird-to-captured-parent',
        zOrder: COMBO_BIRD_RESULT_NAVIGATION_Z_ORDER,
      }),
    );
  } else {
    commands.push(
      Object.freeze({ fresh: true, type: 'construct-main-menu' }),
      Object.freeze({
        boundary: COMBO_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY,
        type: 'attach-main-menu-to-captured-parent',
        zOrder: COMBO_BIRD_RESULT_NAVIGATION_Z_ORDER,
      }),
    );
  }
  return Object.freeze(commands);
}

function assertInput(input: ComboBirdResultNavigationInput): void {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('input must be a Combo Bird Result navigation object');
  }
  if (input.mode !== COMBO_BIRD_RESULT_MODE_ID) {
    throw new RangeError('mode must be Combo Bird mode 5');
  }
  if (input.route !== 'retry' && input.route !== 'main-menu') {
    throw new RangeError('route must be retry or main-menu');
  }
  if (typeof input.effectsEnabled !== 'boolean') {
    throw new TypeError('effectsEnabled must be a boolean');
  }
}
