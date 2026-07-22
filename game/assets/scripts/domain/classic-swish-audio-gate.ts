import type { ClassicSwishSoundIndex } from './classic-audio-contract';
import type { GameplayRandom } from './gameplay-random';

export const CLASSIC_SWISH_COOLDOWN_ACTION_SECONDS = Math.fround(0.5);

export type ClassicSwishAudioRandom = Pick<GameplayRandom, 'nextIntInclusive'>;

export type ClassicSwishAudioInstruction =
  | Readonly<{
      type: 'play-swish-audio';
      canonicalPath: string;
    }>
  | Readonly<{
      type: 'unlock-swish-after';
      clock: 'action';
      delaySeconds: number;
    }>;

const NO_INSTRUCTIONS: readonly ClassicSwishAudioInstruction[] = Object.freeze([]);
const COOLDOWN_INSTRUCTION: ClassicSwishAudioInstruction = Object.freeze({
  type: 'unlock-swish-after',
  clock: 'action',
  delaySeconds: CLASSIC_SWISH_COOLDOWN_ACTION_SECONDS,
});

/** Recovered swipe-sound draw/effects/cooldown ordering, independent of Creator APIs. */
export class ClassicSwishAudioGate {
  private readonly random: ClassicSwishAudioRandom;
  private lockedValue = false;

  constructor(random: ClassicSwishAudioRandom) {
    if (
      random === null
      || typeof random !== 'object'
      || typeof random.nextIntInclusive !== 'function'
    ) {
      throw new TypeError('random must provide nextIntInclusive(minimum, maximum)');
    }
    this.random = random;
  }

  get locked(): boolean {
    return this.lockedValue;
  }

  request(
    eligible: boolean,
    effectsEnabled: boolean,
  ): readonly ClassicSwishAudioInstruction[] {
    assertBoolean(eligible, 'eligible');
    assertBoolean(effectsEnabled, 'effectsEnabled');

    if (!eligible || this.lockedValue) {
      return NO_INSTRUCTIONS;
    }

    // Selection intentionally precedes the effects gate because both use the shared stream.
    const soundIndex = this.random.nextIntInclusive(0, 8);
    assertClassicSwishSoundIndex(soundIndex);
    const canonicalPath = classicSwishAudioPath(soundIndex);

    const instructions: readonly ClassicSwishAudioInstruction[] = effectsEnabled
      ? Object.freeze([
          Object.freeze({ type: 'play-swish-audio', canonicalPath }),
          COOLDOWN_INSTRUCTION,
        ])
      : Object.freeze([COOLDOWN_INSTRUCTION]);
    this.lockedValue = true;
    return instructions;
  }

  unlock(): void {
    this.lockedValue = false;
  }
}

function assertClassicSwishSoundIndex(value: number): asserts value is ClassicSwishSoundIndex {
  if (!Number.isInteger(value) || value < 0 || value > 8) {
    throw new RangeError('nextIntInclusive(0, 8) must return an integer from 0 through 8');
  }
}

function classicSwishAudioPath(soundIndex: ClassicSwishSoundIndex): string {
  return `Sounds/swoosh${soundIndex + 1}.wav`;
}

function assertBoolean(value: boolean, label: string): void {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be a boolean`);
  }
}
