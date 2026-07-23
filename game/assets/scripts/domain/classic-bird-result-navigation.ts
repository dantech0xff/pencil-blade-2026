import { CLASSIC_MENU_BUTTON_AUDIO_PATH } from './classic-audio-contract';
import { CLASSIC_BIRD_RESULT_MODE_ID } from './classic-bird-result-ranking';

export const CLASSIC_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY
  = 'captured-result-parent' as const;
export const CLASSIC_BIRD_RESULT_NAVIGATION_Z_ORDER = 1 as const;

export type ClassicBirdResultNavigationRoute = 'retry' | 'main-menu';

export interface ClassicBirdResultNavigationInput {
  readonly effectsEnabled: boolean;
  readonly mode: typeof CLASSIC_BIRD_RESULT_MODE_ID;
  readonly route: ClassicBirdResultNavigationRoute;
}

export type ClassicBirdResultNavigationCommand =
  | Readonly<{
      readonly canonicalPath: typeof CLASSIC_MENU_BUTTON_AUDIO_PATH;
      readonly loop: false;
      readonly type: 'request-menu-button-audio';
    }>
  | Readonly<{
      readonly boundary: typeof CLASSIC_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY;
      readonly type: 'capture-result-parent';
    }>
  | Readonly<{ readonly cleanup: true; readonly type: 'remove-result' }>
  | Readonly<{
      readonly fresh: true;
      readonly mode: typeof CLASSIC_BIRD_RESULT_MODE_ID;
      readonly type: 'construct-classic-bird';
    }>
  | Readonly<{
      readonly boundary: typeof CLASSIC_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY;
      readonly type: 'attach-classic-bird-to-captured-parent';
      readonly zOrder: 1;
    }>
  | Readonly<{ readonly fresh: true; readonly type: 'construct-main-menu' }>
  | Readonly<{
      readonly boundary: typeof CLASSIC_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY;
      readonly type: 'attach-main-menu-to-captured-parent';
      readonly zOrder: 1;
    }>;

export interface ClassicBirdResultNavigationAbsences {
  readonly delays: false;
  readonly reloadsScene: false;
  readonly replacesScene: false;
  readonly reseedsRandom: false;
  readonly saves: false;
}

const ABSENCES: ClassicBirdResultNavigationAbsences = Object.freeze({
  delays: false,
  reloadsScene: false,
  replacesScene: false,
  reseedsRandom: false,
  saves: false,
});

export const CLASSIC_BIRD_RESULT_NAVIGATION_CALLBACK_ABSENCES = Object.freeze({
  'main-menu': ABSENCES,
  retry: ABSENCES,
});

export function createClassicBirdResultNavigationCommands(
  input: ClassicBirdResultNavigationInput,
): readonly ClassicBirdResultNavigationCommand[] {
  assertInput(input);
  const commands: ClassicBirdResultNavigationCommand[] = [];
  if (input.effectsEnabled) {
    commands.push(Object.freeze({
      canonicalPath: CLASSIC_MENU_BUTTON_AUDIO_PATH,
      loop: false,
      type: 'request-menu-button-audio',
    }));
  }
  commands.push(
    Object.freeze({
      boundary: CLASSIC_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY,
      type: 'capture-result-parent',
    }),
    Object.freeze({ cleanup: true, type: 'remove-result' }),
  );
  if (input.route === 'retry') {
    commands.push(
      Object.freeze({
        fresh: true,
        mode: CLASSIC_BIRD_RESULT_MODE_ID,
        type: 'construct-classic-bird',
      }),
      Object.freeze({
        boundary: CLASSIC_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY,
        type: 'attach-classic-bird-to-captured-parent',
        zOrder: CLASSIC_BIRD_RESULT_NAVIGATION_Z_ORDER,
      }),
    );
  } else {
    commands.push(
      Object.freeze({ fresh: true, type: 'construct-main-menu' }),
      Object.freeze({
        boundary: CLASSIC_BIRD_RESULT_CAPTURED_PARENT_BOUNDARY,
        type: 'attach-main-menu-to-captured-parent',
        zOrder: CLASSIC_BIRD_RESULT_NAVIGATION_Z_ORDER,
      }),
    );
  }
  return Object.freeze(commands);
}

function assertInput(input: ClassicBirdResultNavigationInput): void {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('input must be a Classic Bird Result navigation object');
  }
  if (input.mode !== CLASSIC_BIRD_RESULT_MODE_ID) {
    throw new RangeError('mode must be Classic Bird mode 3');
  }
  if (input.route !== 'retry' && input.route !== 'main-menu') {
    throw new RangeError('route must be retry or main-menu');
  }
  if (typeof input.effectsEnabled !== 'boolean') {
    throw new TypeError('effectsEnabled must be a boolean');
  }
}
