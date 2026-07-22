import { CLASSIC_MENU_BUTTON_AUDIO_PATH } from './classic-audio-contract';
import { CLASSIC_MODE_ID } from './classic-session';

export const CLASSIC_RESULT_CAPTURED_PARENT_BOUNDARY = 'captured-result-parent';
export const CLASSIC_RESULT_NAVIGATION_Z_ORDER = 1;

export type ClassicResultNavigationRoute = 'retry' | 'main-menu';

export interface ClassicResultNavigationInput {
  readonly effectsEnabled: boolean;
  readonly mode: typeof CLASSIC_MODE_ID;
  readonly route: ClassicResultNavigationRoute;
}

export type ClassicResultNavigationCommand =
  | Readonly<{
      type: 'request-menu-button-audio';
      canonicalPath: typeof CLASSIC_MENU_BUTTON_AUDIO_PATH;
      loop: false;
    }>
  | Readonly<{
      type: 'capture-result-parent';
      boundary: typeof CLASSIC_RESULT_CAPTURED_PARENT_BOUNDARY;
    }>
  | Readonly<{
      type: 'remove-result';
      cleanup: true;
    }>
  | Readonly<{
      type: 'construct-classic';
      fresh: true;
      mode: typeof CLASSIC_MODE_ID;
    }>
  | Readonly<{
      type: 'attach-classic-to-captured-parent';
      boundary: typeof CLASSIC_RESULT_CAPTURED_PARENT_BOUNDARY;
      zOrder: typeof CLASSIC_RESULT_NAVIGATION_Z_ORDER;
    }>
  | Readonly<{
      type: 'construct-main-menu';
      fresh: true;
    }>
  | Readonly<{
      type: 'attach-main-menu-to-captured-parent';
      boundary: typeof CLASSIC_RESULT_CAPTURED_PARENT_BOUNDARY;
      zOrder: typeof CLASSIC_RESULT_NAVIGATION_Z_ORDER;
    }>;

export interface ClassicResultNavigationCallbackAbsences {
  readonly delays: false;
  readonly reloadsScene: false;
  readonly replacesScene: false;
  readonly resetsSharedState: false;
  readonly saves: false;
  readonly stopsEffects: false;
}

const CALLBACK_ABSENCES: ClassicResultNavigationCallbackAbsences = Object.freeze({
  delays: false,
  reloadsScene: false,
  replacesScene: false,
  resetsSharedState: false,
  saves: false,
  stopsEffects: false,
});

/** Operations explicitly absent from both recovered synchronous button callbacks. */
export const CLASSIC_RESULT_NAVIGATION_CALLBACK_ABSENCES: Readonly<
  Record<ClassicResultNavigationRoute, ClassicResultNavigationCallbackAbsences>
> = Object.freeze({
  'main-menu': CALLBACK_ABSENCES,
  retry: CALLBACK_ABSENCES,
});

const REQUEST_MENU_BUTTON_AUDIO: ClassicResultNavigationCommand = Object.freeze({
  canonicalPath: CLASSIC_MENU_BUTTON_AUDIO_PATH,
  loop: false,
  type: 'request-menu-button-audio',
});
const CAPTURE_RESULT_PARENT: ClassicResultNavigationCommand = Object.freeze({
  boundary: CLASSIC_RESULT_CAPTURED_PARENT_BOUNDARY,
  type: 'capture-result-parent',
});
const REMOVE_RESULT: ClassicResultNavigationCommand = Object.freeze({
  cleanup: true,
  type: 'remove-result',
});
const CONSTRUCT_CLASSIC: ClassicResultNavigationCommand = Object.freeze({
  fresh: true,
  mode: CLASSIC_MODE_ID,
  type: 'construct-classic',
});
const ATTACH_CLASSIC: ClassicResultNavigationCommand = Object.freeze({
  boundary: CLASSIC_RESULT_CAPTURED_PARENT_BOUNDARY,
  type: 'attach-classic-to-captured-parent',
  zOrder: CLASSIC_RESULT_NAVIGATION_Z_ORDER,
});
const CONSTRUCT_MAIN_MENU: ClassicResultNavigationCommand = Object.freeze({
  fresh: true,
  type: 'construct-main-menu',
});
const ATTACH_MAIN_MENU: ClassicResultNavigationCommand = Object.freeze({
  boundary: CLASSIC_RESULT_CAPTURED_PARENT_BOUNDARY,
  type: 'attach-main-menu-to-captured-parent',
  zOrder: CLASSIC_RESULT_NAVIGATION_Z_ORDER,
});

/**
 * Returns the exact synchronous observable order for a mode-0 Result button callback.
 * Validation finishes before command assembly, so invalid input cannot expose a partial plan.
 */
export function createClassicResultNavigationCommands(
  input: ClassicResultNavigationInput,
): readonly ClassicResultNavigationCommand[] {
  assertNavigationInput(input);

  const commands: ClassicResultNavigationCommand[] = [];
  if (input.effectsEnabled) {
    commands.push(REQUEST_MENU_BUTTON_AUDIO);
  }
  commands.push(CAPTURE_RESULT_PARENT, REMOVE_RESULT);

  if (input.route === 'retry') {
    commands.push(CONSTRUCT_CLASSIC, ATTACH_CLASSIC);
  } else {
    commands.push(CONSTRUCT_MAIN_MENU, ATTACH_MAIN_MENU);
  }
  return Object.freeze(commands);
}

function assertNavigationInput(input: ClassicResultNavigationInput): void {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('input must be a Result navigation object');
  }
  if (input.route !== 'retry' && input.route !== 'main-menu') {
    throw new RangeError('route must be retry or main-menu');
  }
  if (input.mode !== CLASSIC_MODE_ID) {
    throw new RangeError('mode must be Classic mode 0');
  }
  if (typeof input.effectsEnabled !== 'boolean') {
    throw new TypeError('effectsEnabled must be a boolean');
  }
}
