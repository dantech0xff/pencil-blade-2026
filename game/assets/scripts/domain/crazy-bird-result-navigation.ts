import { CLASSIC_MENU_BUTTON_AUDIO_PATH } from './classic-audio-contract';
import { CRAZY_BIRD_RESULT_MODE_ID } from './crazy-bird-result-ranking';

export const CRAZY_BIRD_RESULT_MENU_BUTTON_AUDIO_PATH
  = CLASSIC_MENU_BUTTON_AUDIO_PATH;
export const CRAZY_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY
  = 'captured-result-parent' as const;
export const CRAZY_BIRD_RESULT_NAVIGATION_Z_ORDER = 1 as const;

export type CrazyBirdResultNavigationRoute = 'retry' | 'main-menu';

export interface CrazyBirdResultNavigationInput {
  readonly effectsEnabled: boolean;
  readonly mode: typeof CRAZY_BIRD_RESULT_MODE_ID;
  readonly route: CrazyBirdResultNavigationRoute;
}

export type CrazyBirdResultNavigationCommand =
  | Readonly<{
      readonly canonicalPath: typeof CRAZY_BIRD_RESULT_MENU_BUTTON_AUDIO_PATH;
      readonly loop: false;
      readonly type: 'request-menu-button-audio';
    }>
  | Readonly<{
      readonly boundary: typeof CRAZY_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY;
      readonly type: 'capture-result-parent';
    }>
  | Readonly<{ readonly cleanup: true; readonly type: 'remove-result' }>
  | Readonly<{
      readonly fresh: true;
      readonly mode: typeof CRAZY_BIRD_RESULT_MODE_ID;
      readonly type: 'construct-crazy-bird';
    }>
  | Readonly<{
      readonly boundary: typeof CRAZY_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY;
      readonly type: 'attach-crazy-bird-to-captured-parent';
      readonly zOrder: 1;
    }>
  | Readonly<{ readonly fresh: true; readonly type: 'construct-main-menu' }>
  | Readonly<{
      readonly boundary: typeof CRAZY_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY;
      readonly type: 'attach-main-menu-to-captured-parent';
      readonly zOrder: 1;
    }>;

export interface CrazyBirdResultNavigationAbsences {
  readonly delays: false;
  readonly reloadsScene: false;
  readonly replacesScene: false;
  readonly resetsSharedState: false;
  readonly saves: false;
  readonly stopsEffects: false;
}

const ABSENCES: CrazyBirdResultNavigationAbsences = Object.freeze({
  delays: false,
  reloadsScene: false,
  replacesScene: false,
  resetsSharedState: false,
  saves: false,
  stopsEffects: false,
});

export const CRAZY_BIRD_RESULT_NAVIGATION_CALLBACK_ABSENCES = Object.freeze({
  'main-menu': ABSENCES,
  retry: ABSENCES,
});

export function createCrazyBirdResultNavigationCommands(
  input: CrazyBirdResultNavigationInput,
): readonly CrazyBirdResultNavigationCommand[] {
  assertInput(input);
  const commands: CrazyBirdResultNavigationCommand[] = [];
  if (input.effectsEnabled) {
    commands.push(Object.freeze({
      canonicalPath: CRAZY_BIRD_RESULT_MENU_BUTTON_AUDIO_PATH,
      loop: false,
      type: 'request-menu-button-audio',
    }));
  }
  commands.push(
    Object.freeze({
      boundary: CRAZY_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY,
      type: 'capture-result-parent',
    }),
    Object.freeze({ cleanup: true, type: 'remove-result' }),
  );
  if (input.route === 'retry') {
    commands.push(
      Object.freeze({
        fresh: true,
        mode: CRAZY_BIRD_RESULT_MODE_ID,
        type: 'construct-crazy-bird',
      }),
      Object.freeze({
        boundary: CRAZY_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY,
        type: 'attach-crazy-bird-to-captured-parent',
        zOrder: CRAZY_BIRD_RESULT_NAVIGATION_Z_ORDER,
      }),
    );
  } else {
    commands.push(
      Object.freeze({ fresh: true, type: 'construct-main-menu' }),
      Object.freeze({
        boundary: CRAZY_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY,
        type: 'attach-main-menu-to-captured-parent',
        zOrder: CRAZY_BIRD_RESULT_NAVIGATION_Z_ORDER,
      }),
    );
  }
  return Object.freeze(commands);
}

function assertInput(input: CrazyBirdResultNavigationInput): void {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('input must be a Crazy Bird Result navigation object');
  }
  if (input.mode !== CRAZY_BIRD_RESULT_MODE_ID) {
    throw new RangeError('mode must be Crazy Bird mode 4');
  }
  if (input.route !== 'retry' && input.route !== 'main-menu') {
    throw new RangeError('route must be retry or main-menu');
  }
  if (typeof input.effectsEnabled !== 'boolean') {
    throw new TypeError('effectsEnabled must be a boolean');
  }
}
