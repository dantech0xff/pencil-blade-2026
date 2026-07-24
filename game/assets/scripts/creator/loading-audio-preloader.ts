import {
  AudioClip,
  type AssetManager,
} from 'cc';

import {
  LOADING_AUDIO_PRELOAD_STEPS,
  type LoadingAudioPreloadStep,
} from '../domain/loading-resource-contract';
import { canonicalResourceToBundlePath } from '../domain/game-resource-contract';
import { loadGameResourceBundle } from './game-resource-loader';

export interface LoadingAudioPreloadPort {
  preload(step: LoadingAudioPreloadStep): void;
}

/**
 * Creator preload adapter for the exact native Loading audio sequence.
 *
 * These requests only warm dependency caches. Playback owners still load and retain their own
 * AudioClip references through the existing mode-specific presenters.
 */
export class LoadingAudioPreloader implements LoadingAudioPreloadPort {
  private readonly bundle: AssetManager.Bundle;

  private constructor(bundle: AssetManager.Bundle) {
    this.bundle = bundle;
  }

  static async create(): Promise<LoadingAudioPreloader> {
    return new LoadingAudioPreloader(await loadGameResourceBundle());
  }

  preload(step: LoadingAudioPreloadStep): void {
    const expected = LOADING_AUDIO_PRELOAD_STEPS[step.index];
    if (
      expected === undefined
      || step !== expected
      || step.canonicalPath !== expected.canonicalPath
      || step.kind !== expected.kind
    ) {
      throw new Error('Loading audio preload step changed from the recovered sequence');
    }
    this.bundle.preload(
      canonicalResourceToBundlePath(step.canonicalPath),
      AudioClip,
    );
  }
}
