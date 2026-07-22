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

export interface ClassicRetainedAudioHandle {
  readonly disposed: boolean;
  readonly stopped: boolean;
  dispose(): void;
  stop(): void;
}

/** Loaded exact clips plus the target-side Creator playback adapter. */
export class ClassicAudioPresenter {
  private readonly audioSource: AudioSource;
  private readonly clipsByCanonicalPath: ReadonlyMap<string, AudioClip>;
  private readonly parent: Node;
  private readonly retainedHandles = new Set<CreatorRetainedAudioHandle>();

  private constructor(
    parent: Node,
    audioSource: AudioSource,
    clipsByCanonicalPath: ReadonlyMap<string, AudioClip>,
  ) {
    this.parent = parent;
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
    return new ClassicAudioPresenter(parent, audioSource, clipsByCanonicalPath);
  }

  playOneShot(canonicalPath: string): void {
    const clip = this.requireClip(canonicalPath);
    // Exact native gain/voice policy is unresolved. Unity gain preserves the clip bytes
    // without inventing per-event attenuation while playOneShot permits recovered overlap.
    this.audioSource.playOneShot(clip, TARGET_ONE_SHOT_VOLUME_SCALE);
  }

  playRetained(canonicalPath: string): ClassicRetainedAudioHandle {
    if (!isValid(this.parent, true)) {
      throw new Error('Classic audio parent is no longer valid');
    }
    const clip = this.requireClip(canonicalPath);
    const voiceNode = new Node('ClassicRetainedAudio');
    voiceNode.setParent(this.parent);
    const voice = voiceNode.addComponent(AudioSource);
    voice.playOnAwake = false;
    voice.loop = false;
    voice.volume = TARGET_ONE_SHOT_VOLUME_SCALE;
    voice.clip = clip;

    const handle = new CreatorRetainedAudioHandle(
      voiceNode,
      voice,
      (disposed) => this.retainedHandles.delete(disposed),
    );
    this.retainedHandles.add(handle);
    voice.play();
    return handle;
  }

  stop(): void {
    for (const handle of [...this.retainedHandles]) {
      handle.dispose();
    }
    this.audioSource.stop();
  }

  private requireClip(canonicalPath: string): AudioClip {
    if (typeof canonicalPath !== 'string' || canonicalPath.length === 0) {
      throw new TypeError('canonicalPath must be a non-empty string');
    }
    const clip = this.clipsByCanonicalPath.get(canonicalPath);
    if (clip === undefined) {
      throw new Error(`Classic AudioClip was not loaded: ${canonicalPath}`);
    }
    return clip;
  }
}

class CreatorRetainedAudioHandle implements ClassicRetainedAudioHandle {
  private disposedValue = false;
  private readonly onDisposed: (handle: CreatorRetainedAudioHandle) => void;
  private stoppedValue = false;
  private readonly voice: AudioSource;
  private readonly voiceNode: Node;

  constructor(
    voiceNode: Node,
    voice: AudioSource,
    onDisposed: (handle: CreatorRetainedAudioHandle) => void,
  ) {
    this.voiceNode = voiceNode;
    this.voice = voice;
    this.onDisposed = onDisposed;
  }

  get disposed(): boolean {
    return this.disposedValue;
  }

  get stopped(): boolean {
    return this.stoppedValue;
  }

  stop(): void {
    if (this.stoppedValue) {
      return;
    }
    this.stoppedValue = true;
    if (isValid(this.voiceNode, true)) {
      this.voice.stop();
    }
  }

  dispose(): void {
    if (this.disposedValue) {
      return;
    }
    this.disposedValue = true;
    this.stop();
    if (isValid(this.voiceNode, true)) {
      this.voiceNode.destroy();
    }
    this.onDisposed(this);
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
