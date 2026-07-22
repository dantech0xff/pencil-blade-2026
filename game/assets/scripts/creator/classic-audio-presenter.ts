import {
  AssetManager,
  AudioClip,
  AudioSource,
  Node,
  isValid,
} from 'cc';

import { CLASSIC_CORE_AUDIO_PATHS } from '../domain/classic-audio-contract';
import { canonicalResourceToBundlePath } from '../domain/classic-resource-contract';
import { loadClassicGameResourceBundle } from './classic-resource-loader';

const TARGET_ONE_SHOT_VOLUME_SCALE = 1;

/** Loaded exact clips plus the target-side Creator playback adapter. */
export class ClassicAudioPresenter {
  private readonly audioSource: AudioSource;
  private readonly clipsByCanonicalPath: ReadonlyMap<string, AudioClip>;

  private constructor(
    audioSource: AudioSource,
    clipsByCanonicalPath: ReadonlyMap<string, AudioClip>,
  ) {
    this.audioSource = audioSource;
    this.clipsByCanonicalPath = clipsByCanonicalPath;
  }

  static async load(parent: Node): Promise<ClassicAudioPresenter> {
    if (!isValid(parent, true)) {
      throw new Error('Classic audio parent must be a valid Creator node');
    }
    const bundle = await loadClassicGameResourceBundle();
    const clips = await loadCoreAudioClips(bundle);
    const clipsByCanonicalPath = new Map<string, AudioClip>();
    for (let index = 0; index < CLASSIC_CORE_AUDIO_PATHS.length; index += 1) {
      const canonicalPath = CLASSIC_CORE_AUDIO_PATHS[index];
      const clip = clips[index];
      if (canonicalPath === undefined || clip === undefined) {
        throw new Error('Creator returned an incomplete Classic AudioClip batch');
      }
      clipsByCanonicalPath.set(canonicalPath, clip);
    }
    if (clipsByCanonicalPath.size !== CLASSIC_CORE_AUDIO_PATHS.length) {
      throw new Error('Classic core audio catalog contains duplicate canonical paths');
    }

    const audioSource = parent.getComponent(AudioSource) ?? parent.addComponent(AudioSource);
    audioSource.loop = false;
    audioSource.volume = TARGET_ONE_SHOT_VOLUME_SCALE;
    return new ClassicAudioPresenter(audioSource, clipsByCanonicalPath);
  }

  playOneShot(canonicalPath: string): void {
    if (typeof canonicalPath !== 'string' || canonicalPath.length === 0) {
      throw new TypeError('canonicalPath must be a non-empty string');
    }
    const clip = this.clipsByCanonicalPath.get(canonicalPath);
    if (clip === undefined) {
      throw new Error(`Classic AudioClip was not loaded: ${canonicalPath}`);
    }
    // Exact native gain/voice policy is unresolved. Unity gain preserves the clip bytes
    // without inventing per-event attenuation while playOneShot permits recovered overlap.
    this.audioSource.playOneShot(clip, TARGET_ONE_SHOT_VOLUME_SCALE);
  }

  stop(): void {
    this.audioSource.stop();
  }
}

function loadCoreAudioClips(bundle: AssetManager.Bundle): Promise<readonly AudioClip[]> {
  const bundlePaths = CLASSIC_CORE_AUDIO_PATHS.map(canonicalResourceToBundlePath);
  return new Promise((resolve, reject) => {
    bundle.load(bundlePaths, AudioClip, (error, audioClips) => {
      if (error !== null && error !== undefined) {
        reject(new Error(`Failed to load Classic AudioClips: ${error.message}`));
        return;
      }
      if (audioClips === null || audioClips === undefined) {
        reject(new Error('Creator returned no Classic AudioClips'));
        return;
      }
      resolve(Object.freeze([...audioClips]));
    });
  });
}
