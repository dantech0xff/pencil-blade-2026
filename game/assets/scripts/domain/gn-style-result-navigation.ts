import { CLASSIC_MENU_BUTTON_AUDIO_PATH } from './classic-audio-contract';
import { GN_STYLE_RESULT_MODE_ID } from './gn-style-result-ranking';

export const GN_STYLE_RESULT_MENU_BUTTON_AUDIO_PATH
  = CLASSIC_MENU_BUTTON_AUDIO_PATH;
export const GN_STYLE_RESULT_CAPTURED_PARENT_BOUNDARY
  = 'captured-result-parent' as const;
export const GN_STYLE_RESULT_NAVIGATION_Z_ORDER = 1 as const;

export type GnStyleResultNavigationRoute = 'retry' | 'main-menu';

export interface GnStyleResultNavigationInput {
  readonly effectsEnabled: boolean;
  readonly mode: typeof GN_STYLE_RESULT_MODE_ID;
  readonly route: GnStyleResultNavigationRoute;
}

export type GnStyleResultNavigationCommand =
  | Readonly<{
      readonly canonicalPath: typeof GN_STYLE_RESULT_MENU_BUTTON_AUDIO_PATH;
      readonly loop: false;
      readonly type: 'request-menu-button-audio';
    }>
  | Readonly<{
      readonly boundary: typeof GN_STYLE_RESULT_CAPTURED_PARENT_BOUNDARY;
      readonly type: 'capture-result-parent';
    }>
  | Readonly<{ readonly cleanup: true; readonly type: 'remove-result' }>
  | Readonly<{
      readonly fresh: true;
      readonly mode: typeof GN_STYLE_RESULT_MODE_ID;
      readonly type: 'construct-gn-style';
    }>
  | Readonly<{
      readonly boundary: typeof GN_STYLE_RESULT_CAPTURED_PARENT_BOUNDARY;
      readonly type: 'attach-gn-style-to-captured-parent';
      readonly zOrder: 1;
    }>
  | Readonly<{ readonly fresh: true; readonly type: 'construct-main-menu' }>
  | Readonly<{
      readonly boundary: typeof GN_STYLE_RESULT_CAPTURED_PARENT_BOUNDARY;
      readonly type: 'attach-main-menu-to-captured-parent';
      readonly zOrder: 1;
    }>;

export interface GnStyleResultNavigationAbsences {
  readonly delays: false;
  readonly reloadsScene: false;
  readonly replacesScene: false;
  readonly reseedsRandom: false;
  readonly resetsSharedState: false;
  readonly saves: false;
  readonly stopsEffects: false;
}

const ABSENCES: GnStyleResultNavigationAbsences = Object.freeze({
  delays: false,
  reloadsScene: false,
  replacesScene: false,
  reseedsRandom: false,
  resetsSharedState: false,
  saves: false,
  stopsEffects: false,
});

export const GN_STYLE_RESULT_NAVIGATION_CALLBACK_ABSENCES = Object.freeze({
  'main-menu': ABSENCES,
  retry: ABSENCES,
});

export function createGnStyleResultNavigationCommands(
  input: GnStyleResultNavigationInput,
): readonly GnStyleResultNavigationCommand[] {
  assertInput(input);
  const commands: GnStyleResultNavigationCommand[] = [];
  if (input.effectsEnabled) {
    commands.push(Object.freeze({
      canonicalPath: GN_STYLE_RESULT_MENU_BUTTON_AUDIO_PATH,
      loop: false,
      type: 'request-menu-button-audio',
    }));
  }
  commands.push(
    Object.freeze({
      boundary: GN_STYLE_RESULT_CAPTURED_PARENT_BOUNDARY,
      type: 'capture-result-parent',
    }),
    Object.freeze({ cleanup: true, type: 'remove-result' }),
  );
  if (input.route === 'retry') {
    commands.push(
      Object.freeze({
        fresh: true,
        mode: GN_STYLE_RESULT_MODE_ID,
        type: 'construct-gn-style',
      }),
      Object.freeze({
        boundary: GN_STYLE_RESULT_CAPTURED_PARENT_BOUNDARY,
        type: 'attach-gn-style-to-captured-parent',
        zOrder: GN_STYLE_RESULT_NAVIGATION_Z_ORDER,
      }),
    );
  } else {
    commands.push(
      Object.freeze({ fresh: true, type: 'construct-main-menu' }),
      Object.freeze({
        boundary: GN_STYLE_RESULT_CAPTURED_PARENT_BOUNDARY,
        type: 'attach-main-menu-to-captured-parent',
        zOrder: GN_STYLE_RESULT_NAVIGATION_Z_ORDER,
      }),
    );
  }
  return Object.freeze(commands);
}

function assertInput(input: GnStyleResultNavigationInput): void {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('input must be a GN Style Result navigation object');
  }
  if (input.mode !== GN_STYLE_RESULT_MODE_ID) {
    throw new RangeError('mode must be GN Style mode 2');
  }
  if (input.route !== 'retry' && input.route !== 'main-menu') {
    throw new RangeError('route must be retry or main-menu');
  }
  if (typeof input.effectsEnabled !== 'boolean') {
    throw new TypeError('effectsEnabled must be a boolean');
  }
}
