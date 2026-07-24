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
import type {
  TimeManagerAudioPath,
  TimeManagerAudioPort,
} from './time-manager-presenter';

export const TIME_MANAGER_AUDIO_PATHS = Object.freeze([
  'Sounds/timetick.wav',
  'Sounds/timeup.wav',
] as const satisfies readonly TimeManagerAudioPath[]);

/** Narrow process-owned audio owner for the two shared TimeManager effects. */
export class TimeManagerAudioPresenter implements TimeManagerAudioPort {
  private disposedValue = false;
  private pauseLeaseActive = false;
  private readonly clips: ReadonlyMap<TimeManagerAudioPath, AudioClip>;
  private readonly parent: Node;
  private readonly root: Node;
  private readonly voices = new Set<TimeManagerAudioVoice>();

  private constructor(
    parent: Node,
    root: Node,
    clips: ReadonlyMap<TimeManagerAudioPath, AudioClip>,
  ) {
    this.parent = parent;
    this.root = root;
    this.clips = clips;
  }

  static async load(parent: Node): Promise<TimeManagerAudioPresenter> {
    if (!isValid(parent, true)) {
      throw new Error(
        'TimeManager audio parent must be a valid Creator node',
      );
    }
    const bundle = await loadGameResourceBundle();
    const loaded = await loadTimerAudioClips(bundle);
    if (!isValid(parent, true)) {
      throw new Error(
        'TimeManager audio parent was destroyed while loading',
      );
    }
    const clips = new Map<TimeManagerAudioPath, AudioClip>();
    TIME_MANAGER_AUDIO_PATHS.forEach((path, index) => {
      const clip = loaded[index];
      if (clip === undefined) {
        throw new Error(
          'Creator returned an incomplete TimeManager audio batch',
        );
      }
      clips.set(path, clip);
    });
    if (clips.size !== TIME_MANAGER_AUDIO_PATHS.length) {
      throw new Error('TimeManager audio catalog contains duplicates');
    }

    const root = new Node('TimeManagerAudioRoot');
    try {
      root.layer = parent.layer;
      root.setParent(parent);
      if (root.parent !== parent || !isValid(root, true)) {
        throw new Error('TimeManager audio root failed to attach');
      }
      return new TimeManagerAudioPresenter(parent, root, clips);
    } catch (error) {
      if (isValid(root, true)) {
        root.destroy();
      }
      throw error;
    }
  }

  playOneShot(canonicalPath: TimeManagerAudioPath): void {
    this.assertUsable();
    const clip = this.clips.get(canonicalPath);
    if (clip === undefined) {
      throw new Error(
        `TimeManager AudioClip was not loaded: ${canonicalPath}`,
      );
    }
    const voiceNode = new Node('TimeManagerOneShotAudio');
    let owner: TimeManagerAudioVoice | null = null;
    try {
      voiceNode.setParent(this.root);
      const source = voiceNode.addComponent(AudioSource);
      source.playOnAwake = false;
      source.loop = false;
      source.volume = 1;
      owner = new TimeManagerAudioVoice(
        voiceNode,
        source,
        (disposed) => this.voices.delete(disposed),
      );
      this.voices.add(owner);
      const retainedOwner = owner;
      voiceNode.once(
        AudioSource.EventType.ENDED,
        () => retainedOwner.dispose(),
      );
      source.clip = clip;
      source.play();
      if (this.pauseLeaseActive) {
        owner.pause();
      }
    } catch (error) {
      if (owner !== null) {
        owner.dispose();
      } else if (isValid(voiceNode, true)) {
        voiceNode.destroy();
      }
      throw error;
    }
  }

  pauseAllEffects(): void {
    this.assertUsable();
    this.pauseLeaseActive = true;
    const failures: unknown[] = [];
    for (const voice of Array.from(this.voices)) {
      collectCleanupFailure(failures, () => voice.pause());
    }
    if (failures.length > 0) {
      throw cleanupError('TimeManager audio pause', failures);
    }
  }

  resumeAllEffects(): void {
    this.assertUsable();
    if (!this.pauseLeaseActive) {
      return;
    }
    const failures: unknown[] = [];
    for (const voice of Array.from(this.voices)) {
      collectCleanupFailure(failures, () => voice.resume());
    }
    if (!Array.from(this.voices).some((voice) => voice.paused)) {
      this.pauseLeaseActive = false;
    }
    if (failures.length > 0) {
      throw cleanupError('TimeManager audio resume', failures);
    }
  }

  stopAllEffects(): void {
    if (this.disposedValue) {
      return;
    }
    this.pauseLeaseActive = false;
    const failures: unknown[] = [];
    for (const voice of Array.from(this.voices)) {
      collectCleanupFailure(failures, () => voice.dispose());
    }
    if (failures.length > 0) {
      throw cleanupError('TimeManager audio stop', failures);
    }
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    const failures: unknown[] = [];
    collectCleanupFailure(failures, () => this.stopAllEffects());
    collectCleanupFailure(failures, () => {
      if (isValid(this.root, true)) {
        this.root.destroy();
      }
    });
    if (failures.length > 0) {
      throw cleanupError('TimeManager audio disposal', failures);
    }
    this.disposedValue = true;
    return true;
  }

  private assertUsable(): void {
    if (
      this.disposedValue
      || !isValid(this.parent, true)
      || !isValid(this.root, true)
    ) {
      throw new Error('TimeManager audio owner is unavailable');
    }
  }
}

class TimeManagerAudioVoice {
  private disposedValue = false;
  private pausedValue = false;
  private readonly onDisposed: (voice: TimeManagerAudioVoice) => void;
  private readonly source: AudioSource;
  private readonly voiceNode: Node;

  constructor(
    voiceNode: Node,
    source: AudioSource,
    onDisposed: (voice: TimeManagerAudioVoice) => void,
  ) {
    this.voiceNode = voiceNode;
    this.source = source;
    this.onDisposed = onDisposed;
  }

  get paused(): boolean {
    return this.pausedValue;
  }

  pause(): void {
    if (
      this.disposedValue
      || this.pausedValue
      || !isValid(this.voiceNode, true)
    ) {
      return;
    }
    this.source.pause();
    this.pausedValue = true;
  }

  resume(): void {
    if (
      this.disposedValue
      || !this.pausedValue
      || !isValid(this.voiceNode, true)
    ) {
      return;
    }
    this.source.play();
    this.pausedValue = false;
  }

  dispose(): void {
    if (this.disposedValue) {
      return;
    }
    if (isValid(this.voiceNode, true)) {
      this.source.stop();
      this.source.clip = null;
      this.voiceNode.destroy();
    }
    this.pausedValue = false;
    this.disposedValue = true;
    this.onDisposed(this);
  }
}

function loadTimerAudioClips(
  bundle: AssetManager.Bundle,
): Promise<readonly AudioClip[]> {
  const paths = TIME_MANAGER_AUDIO_PATHS.map(
    canonicalResourceToBundlePath,
  );
  return new Promise((resolve, reject) => {
    bundle.load(paths, AudioClip, (error, clips) => {
      if (error !== null && error !== undefined) {
        reject(new Error(
          `Failed to load TimeManager AudioClips: ${error.message}`,
        ));
        return;
      }
      if (clips === null || clips === undefined) {
        reject(new Error(
          'Creator returned no TimeManager AudioClips',
        ));
        return;
      }
      resolve(Object.freeze([...clips]));
    });
  });
}

function collectCleanupFailure(
  failures: unknown[],
  action: () => void,
): void {
  try {
    action();
  } catch (error) {
    failures.push(error);
  }
}

function cleanupError(label: string, failures: readonly unknown[]): Error {
  return new Error(
    `${label} failed: ${failures.map(errorMessage).join('; ')}`,
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
