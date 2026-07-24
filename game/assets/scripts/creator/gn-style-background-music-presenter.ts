import {
  AudioClip,
  AudioSource,
  Node,
  isValid,
} from 'cc';

import type { AssetManager } from 'cc';

import {
  canonicalResourceToBundlePath,
} from '../domain/game-resource-contract';
import {
  loadGameResourceBundle,
} from './game-resource-loader';

export const GN_STYLE_BACKGROUND_MUSIC_AUDIO_PATH
  = 'Sounds/GangnamStyle.mp3' as const;

/**
 * Dedicated non-looping owner for GN Style's recovered background track.
 *
 * Shared-background mutual exclusion remains a gameplay-controller transaction: this owner
 * deliberately knows only the GN clip and its one AudioSource.
 */
export class GnStyleBackgroundMusicPresenter {
  private clipClearedValue = false;
  private disposedValue = false;
  private listenerReleasedValue = false;
  private pausedValue = false;
  private playingValue = false;
  private readonly parent: Node;
  private rootDestroyedValue = false;
  private readonly root: Node;
  private readonly source: AudioSource;

  private constructor(
    parent: Node,
    root: Node,
    source: AudioSource,
  ) {
    this.parent = parent;
    this.root = root;
    this.source = source;
    root.on(AudioSource.EventType.ENDED, this.onPlaybackEnded, this);
  }

  static async load(
    parent: Node,
  ): Promise<GnStyleBackgroundMusicPresenter> {
    if (!isValid(parent, true)) {
      throw new Error(
        'GN Style background-music parent must be a valid Creator node',
      );
    }
    const bundle = await loadGameResourceBundle();
    const clip = await loadGnStyleBackgroundMusicClip(bundle);
    if (!isValid(parent, true)) {
      throw new Error(
        'GN Style background-music parent was destroyed while loading',
      );
    }

    let root: Node | null = null;
    let source: AudioSource | null = null;
    try {
      root = new Node('GnStyleBackgroundMusicRoot');
      root.layer = parent.layer;
      source = root.addComponent(AudioSource);
      source.playOnAwake = false;
      source.loop = false;
      source.volume = 1;
      source.clip = clip;
      root.setParent(parent);
      if (root.parent !== parent || !isValid(root, true)) {
        throw new Error('GN Style background-music root failed to attach');
      }
      return new GnStyleBackgroundMusicPresenter(parent, root, source);
    } catch (error) {
      const failures: unknown[] = [];
      if (source !== null) {
        const partialSource = source;
        collectFailure(failures, () => {
          partialSource.clip = null;
        });
      }
      if (root !== null && isValid(root, true)) {
        const partialRoot = root;
        collectFailure(failures, () => partialRoot.destroy());
      }
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'GN Style background-music load rollback failed',
          error,
          failures,
        );
      }
      throw error;
    }
  }

  get disposed(): boolean {
    return this.disposedValue;
  }

  get paused(): boolean {
    return this.pausedValue;
  }

  get playing(): boolean {
    return this.playingValue;
  }

  /**
   * Starts the recovered clip once for the current caller boundary.
   * Repeated calls while playing or paused do not restart it.
   */
  play(musicEnabled: boolean): boolean {
    assertBoolean(musicEnabled, 'musicEnabled');
    if (!musicEnabled) {
      this.stop();
      return false;
    }
    this.assertUsable();
    if (this.playingValue || this.pausedValue) {
      return false;
    }
    this.source.play();
    this.playingValue = true;
    return true;
  }

  pause(musicEnabled: boolean): boolean {
    assertBoolean(musicEnabled, 'musicEnabled');
    if (!musicEnabled) {
      return this.stop();
    }
    this.assertUsable();
    if (!this.playingValue || this.pausedValue) {
      return false;
    }
    this.source.pause();
    this.pausedValue = true;
    return true;
  }

  resume(musicEnabled: boolean): boolean {
    assertBoolean(musicEnabled, 'musicEnabled');
    if (!musicEnabled) {
      return this.stop();
    }
    this.assertUsable();
    if (!this.playingValue || !this.pausedValue) {
      return false;
    }
    this.source.play();
    this.pausedValue = false;
    return true;
  }

  stop(): boolean {
    if (this.disposedValue) {
      return false;
    }
    const wasActive = this.playingValue || this.pausedValue;
    if (!wasActive) {
      return false;
    }
    if (isValid(this.root, true)) {
      this.source.stop();
    }
    this.playingValue = false;
    this.pausedValue = false;
    return true;
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.stop();
    if (!this.listenerReleasedValue) {
      if (isValid(this.root, true)) {
        this.root.off(
          AudioSource.EventType.ENDED,
          this.onPlaybackEnded,
          this,
        );
      }
      this.listenerReleasedValue = true;
    }
    if (!this.clipClearedValue) {
      if (isValid(this.root, true)) {
        this.source.clip = null;
      }
      this.clipClearedValue = true;
    }
    if (!this.rootDestroyedValue) {
      if (isValid(this.root, true)) {
        this.root.destroy();
      }
      this.rootDestroyedValue = true;
    }
    this.playingValue = false;
    this.pausedValue = false;
    this.disposedValue = true;
    return true;
  }

  private readonly onPlaybackEnded = (): void => {
    if (this.disposedValue) {
      return;
    }
    this.playingValue = false;
    this.pausedValue = false;
  };

  private assertUsable(): void {
    if (
      this.disposedValue
      || !isValid(this.parent, true)
      || !isValid(this.root, true)
    ) {
      throw new Error('GN Style background-music owner is unavailable');
    }
  }
}

function loadGnStyleBackgroundMusicClip(
  bundle: AssetManager.Bundle,
): Promise<AudioClip> {
  const paths = [
    canonicalResourceToBundlePath(
      GN_STYLE_BACKGROUND_MUSIC_AUDIO_PATH,
    ),
  ];
  return new Promise((resolve, reject) => {
    bundle.load(paths, AudioClip, (error, clips) => {
      if (error !== null && error !== undefined) {
        reject(new Error(
          `Failed to load GN Style background music: ${error.message}`,
        ));
        return;
      }
      if (clips === null || clips === undefined) {
        reject(new Error(
          'Creator returned no GN Style background-music AudioClip',
        ));
        return;
      }
      const clip = clips[0];
      if (clip === undefined || clips.length !== 1) {
        reject(new Error(
          'Creator returned an incomplete GN Style background-music batch',
        ));
        return;
      }
      resolve(clip);
    });
  });
}

function assertBoolean(
  value: unknown,
  label: string,
): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be a boolean`);
  }
}

function collectFailure(
  failures: unknown[],
  action: () => void,
): void {
  try {
    action();
  } catch (error) {
    failures.push(error);
  }
}

function aggregateWithPrimary(
  label: string,
  primary: unknown,
  failures: readonly unknown[],
): Error {
  return new Error(
    `${label}: ${errorMessage(primary)}; ${failures.map(errorMessage).join('; ')}`,
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
