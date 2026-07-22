import type { ClassicNormalFruitId } from './classic-resource-contract';

export type ClassicSwishSoundIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type ClassicComboSoundIndex = 1 | 2 | 3;
export type ClassicResultRankSoundIndex = 1 | 2 | 3;
export type ClassicOrdinaryBombAudioEvent = 'entry' | 'explosion' | 'toss';

export const CLASSIC_MODE_SELECTED_AUDIO_PATH = 'Sounds/gameplayselected.wav';
export const CLASSIC_TOSS_AUDIO_PATH = 'Sounds/tossfruit.wav';
export const CLASSIC_CRITICAL_AUDIO_PATH = 'Sounds/critical.wav';
export const CLASSIC_ELECTRIC_BOMB_HIT_AUDIO_PATH = 'Sounds/boomhit.wav';
export const CLASSIC_MENU_BUTTON_AUDIO_PATH = 'Sounds/menubuttonclick.wav';

export const CLASSIC_RESULT_RANK_AUDIO_PATHS: Readonly<
  Record<ClassicResultRankSoundIndex, string>
> = Object.freeze({
  1: 'Sounds/firstplace.wav',
  2: 'Sounds/secondplace.wav',
  3: 'Sounds/thirdplace.wav',
});

export const CLASSIC_ORDINARY_BOMB_AUDIO_PATHS: Readonly<
  Record<ClassicOrdinaryBombAudioEvent, string>
> = Object.freeze({
  entry: 'Sounds/boomsound.wav',
  explosion: 'Sounds/boomexplosion.wav',
  toss: 'Sounds/boomtoss.wav',
});

export const CLASSIC_SWISH_AUDIO_PATHS: readonly string[] = Object.freeze([
  'Sounds/swoosh1.wav',
  'Sounds/swoosh2.wav',
  'Sounds/swoosh3.wav',
  'Sounds/swoosh4.wav',
  'Sounds/swoosh5.wav',
  'Sounds/swoosh6.wav',
  'Sounds/swoosh7.wav',
  'Sounds/swoosh8.wav',
  'Sounds/swoosh9.wav',
]);

export const CLASSIC_FRUIT_CUT_AUDIO_PATHS: readonly string[] = Object.freeze([
  'Sounds/apple.wav',
  'Sounds/banana.wav',
  'Sounds/strawberry.wav',
  'Sounds/waterfruit.wav',
  'Sounds/waterfruit.wav',
  'Sounds/mangosteen.wav',
  'Sounds/apple.wav',
  'Sounds/strawberry.wav',
  'Sounds/apple.wav',
]);

export const CLASSIC_COMBO_AUDIO_PATHS: Readonly<Record<ClassicComboSoundIndex, string>>
  = Object.freeze({
    1: 'Sounds/compo1.wav',
    2: 'Sounds/compo2.wav',
    3: 'Sounds/compo3.wav',
  });

export const CLASSIC_CORE_AUDIO_PATHS: readonly string[] = Object.freeze([
  CLASSIC_MODE_SELECTED_AUDIO_PATH,
  CLASSIC_TOSS_AUDIO_PATH,
  ...CLASSIC_SWISH_AUDIO_PATHS,
  'Sounds/apple.wav',
  'Sounds/banana.wav',
  'Sounds/strawberry.wav',
  'Sounds/waterfruit.wav',
  'Sounds/mangosteen.wav',
  CLASSIC_CRITICAL_AUDIO_PATH,
  CLASSIC_COMBO_AUDIO_PATHS[1],
  CLASSIC_COMBO_AUDIO_PATHS[2],
  CLASSIC_COMBO_AUDIO_PATHS[3],
  CLASSIC_MENU_BUTTON_AUDIO_PATH,
  CLASSIC_RESULT_RANK_AUDIO_PATHS[1],
  CLASSIC_RESULT_RANK_AUDIO_PATHS[2],
  CLASSIC_RESULT_RANK_AUDIO_PATHS[3],
  CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.toss,
  CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.entry,
  CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.explosion,
]);

export function getClassicSwishAudioPath(soundIndex: number): string {
  assertIndex(soundIndex, 0, CLASSIC_SWISH_AUDIO_PATHS.length - 1, 'soundIndex');
  return requirePath(CLASSIC_SWISH_AUDIO_PATHS[soundIndex], 'Classic swish audio');
}

export function getClassicFruitCutAudioSequence(
  fruitId: number,
  critical: boolean,
): readonly string[] {
  assertIndex(fruitId, 0, CLASSIC_FRUIT_CUT_AUDIO_PATHS.length - 1, 'fruitId');
  if (typeof critical !== 'boolean') {
    throw new TypeError('critical must be a boolean');
  }
  const base = requirePath(
    CLASSIC_FRUIT_CUT_AUDIO_PATHS[fruitId as ClassicNormalFruitId],
    'Classic fruit-cut audio',
  );
  return critical
    ? Object.freeze([base, CLASSIC_CRITICAL_AUDIO_PATH])
    : Object.freeze([base]);
}

export function getClassicComboAudioPath(soundIndex: number): string {
  assertIndex(soundIndex, 1, 3, 'soundIndex');
  return requirePath(
    CLASSIC_COMBO_AUDIO_PATHS[soundIndex as ClassicComboSoundIndex],
    'Classic combo audio',
  );
}

export function getClassicResultRankAudioPath(rank: number): string {
  assertIndex(rank, 1, 3, 'rank');
  return requirePath(
    CLASSIC_RESULT_RANK_AUDIO_PATHS[rank as ClassicResultRankSoundIndex],
    'Classic result-rank audio',
  );
}

export function getClassicOrdinaryBombAudioPath(
  event: ClassicOrdinaryBombAudioEvent,
): string {
  if (event !== 'entry' && event !== 'explosion' && event !== 'toss') {
    throw new RangeError('event must be entry, explosion, or toss');
  }
  return requirePath(
    CLASSIC_ORDINARY_BOMB_AUDIO_PATHS[event],
    'Classic ordinary-bomb audio',
  );
}

function assertIndex(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer from ${minimum} through ${maximum}`);
  }
}

function requirePath(value: string | undefined, label: string): string {
  if (value === undefined) {
    throw new Error(`${label} contract entry is missing`);
  }
  return value;
}
