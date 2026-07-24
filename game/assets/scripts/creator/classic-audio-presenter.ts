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
  private readonly audioRoot: Node;
  private backgroundMusicPauseLeaseActive = false;
  private readonly backgroundMusicNode: Node;
  private backgroundMusicPausedByPresenter = false;
  private readonly backgroundMusicSource: AudioSource;
  private backgroundMusicStarted = false;
  private readonly clipsByCanonicalPath: ReadonlyMap<string, AudioClip>;
  private effectsPauseLeaseActive = false;
  private readonly effectsVoiceRoot: Node;
  private readonly parent: Node;
  private readonly effectVoices = new Set<CreatorClassicOwnedAudioVoice>();

  private constructor(
    parent: Node,
    audioRoot: Node,
    effectsVoiceRoot: Node,
    backgroundMusicNode: Node,
    backgroundMusicSource: AudioSource,
    clipsByCanonicalPath: ReadonlyMap<string, AudioClip>,
  ) {
    this.parent = parent;
    this.audioRoot = audioRoot;
    this.effectsVoiceRoot = effectsVoiceRoot;
    this.backgroundMusicNode = backgroundMusicNode;
    this.backgroundMusicSource = backgroundMusicSource;
    this.clipsByCanonicalPath = clipsByCanonicalPath;
  }

  static async load(parent: Node): Promise<ClassicAudioPresenter> {
    if (!isValid(parent, true)) {
      throw new Error('Classic audio parent must be a valid Creator node');
    }
    const bundle = await loadClassicGameResourceBundle();
    assertValidAudioParent(parent);
    const clips = await loadCoreAudioClips(bundle);
    assertValidAudioParent(parent);
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

    let audioRoot: Node | null = null;
    try {
      audioRoot = new Node('ClassicAudioRoot');
      const effectsVoiceRoot = new Node('ClassicEffectAudioVoices');
      effectsVoiceRoot.setParent(audioRoot);
      const backgroundMusicNode = new Node('RecoveredBackgroundMusicAudio');
      backgroundMusicNode.setParent(audioRoot);
      const backgroundMusicSource = backgroundMusicNode.addComponent(AudioSource);
      backgroundMusicSource.playOnAwake = false;
      backgroundMusicSource.loop = true;
      backgroundMusicSource.volume = 1;

      assertValidAudioParent(parent);
      audioRoot.setParent(parent);
      if (audioRoot.parent !== parent || !isValid(audioRoot, true)) {
        throw new Error('Classic audio root failed to attach to its valid parent');
      }
      return new ClassicAudioPresenter(
        parent,
        audioRoot,
        effectsVoiceRoot,
        backgroundMusicNode,
        backgroundMusicSource,
        clipsByCanonicalPath,
      );
    } catch (error: unknown) {
      if (audioRoot !== null && isValid(audioRoot, true)) {
        const cleanupRoot = audioRoot;
        const failures: unknown[] = [];
        runCleanup(failures, () => cleanupRoot.destroy());
        if (failures.length > 0) {
          throw aggregateWithPrimary(
            'Classic audio load rollback failed',
            error,
            failures,
          );
        }
      }
      throw error;
    }
  }

  playOneShot(canonicalPath: string): void {
    const clip = this.requireClip(canonicalPath);
    this.createEffectVoice('ClassicOneShotAudio', clip, false, true);
  }

  playRetained(canonicalPath: string): ClassicRetainedAudioHandle {
    const clip = this.requireClip(canonicalPath);
    return this.createEffectVoice(
      'ClassicRetainedAudio',
      clip,
      false,
      false,
    );
  }

  playLoopingBackground(canonicalPath: string): void {
    if (
      !isValid(this.parent, true)
      || !isValid(this.audioRoot, true)
      || !isValid(this.backgroundMusicNode, true)
    ) {
      throw new Error('Recovered background-music parent is no longer valid');
    }
    this.backgroundMusicSource.clip = this.requireClip(canonicalPath);
    this.backgroundMusicSource.loop = true;
    this.backgroundMusicSource.play();
    this.backgroundMusicStarted = true;
    this.backgroundMusicPausedByPresenter = false;
    if (this.backgroundMusicPauseLeaseActive) {
      this.backgroundMusicSource.pause();
      this.backgroundMusicPausedByPresenter = true;
    }
  }

  pauseAllEffects(): void {
    this.effectsPauseLeaseActive = true;
    const failures: unknown[] = [];
    for (const voice of Array.from(this.effectVoices)) {
      runCleanup(failures, () => voice.pauseForPresenter());
    }
    throwOperationFailures('Classic effect pause', failures);
  }

  resumeAllEffects(): void {
    if (!this.effectsPauseLeaseActive) {
      return;
    }
    const failures: unknown[] = [];
    for (const voice of Array.from(this.effectVoices)) {
      runCleanup(failures, () => voice.resumeFromPresenterPause());
    }
    if (!Array.from(this.effectVoices).some((voice) => voice.pausedByPresenter)) {
      this.effectsPauseLeaseActive = false;
    }
    throwOperationFailures('Classic effect resume', failures);
  }

  pauseBackgroundMusic(): void {
    this.backgroundMusicPauseLeaseActive = true;
    if (
      !this.backgroundMusicStarted
      || this.backgroundMusicPausedByPresenter
      || !isValid(this.backgroundMusicNode, true)
    ) {
      return;
    }
    this.backgroundMusicSource.pause();
    this.backgroundMusicPausedByPresenter = true;
  }

  resumeBackgroundMusic(): void {
    if (!this.backgroundMusicPauseLeaseActive) {
      return;
    }
    if (this.backgroundMusicPausedByPresenter) {
      if (!isValid(this.backgroundMusicNode, true)) {
        this.backgroundMusicPausedByPresenter = false;
        this.backgroundMusicStarted = false;
      } else {
        this.backgroundMusicSource.play();
        this.backgroundMusicPausedByPresenter = false;
      }
    }
    if (!this.backgroundMusicPausedByPresenter) {
      this.backgroundMusicPauseLeaseActive = false;
    }
  }

  stopBackgroundMusic(): void {
    this.backgroundMusicPauseLeaseActive = false;
    this.backgroundMusicPausedByPresenter = false;
    if (isValid(this.backgroundMusicNode, true)) {
      this.backgroundMusicSource.stop();
    }
    this.backgroundMusicStarted = false;
  }

  stopAllEffects(): void {
    this.effectsPauseLeaseActive = false;
    const failures: unknown[] = [];
    for (const voice of Array.from(this.effectVoices)) {
      runCleanup(failures, () => voice.dispose());
    }
    throwOperationFailures('Classic effect voices', failures);
  }

  stop(): void {
    const failures: unknown[] = [];
    runCleanup(failures, () => this.stopAllEffects());
    runCleanup(failures, () => this.stopBackgroundMusic());
    throwOperationFailures('Classic audio', failures);
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

  private createEffectVoice(
    name: string,
    clip: AudioClip,
    loop: boolean,
    disposeOnEnd: boolean,
  ): CreatorClassicOwnedAudioVoice {
    if (
      !isValid(this.parent, true)
      || !isValid(this.audioRoot, true)
      || !isValid(this.effectsVoiceRoot, true)
    ) {
      throw new Error('Classic audio parent is no longer valid');
    }

    const voiceNode = new Node(name);
    let handle: CreatorClassicOwnedAudioVoice | null = null;
    try {
      voiceNode.setParent(this.effectsVoiceRoot);
      const voice = voiceNode.addComponent(AudioSource);
      voice.playOnAwake = false;
      voice.loop = loop;
      voice.volume = TARGET_ONE_SHOT_VOLUME_SCALE;
      handle = new CreatorClassicOwnedAudioVoice(
        voiceNode,
        voice,
        (disposed) => this.effectVoices.delete(disposed),
      );
      this.effectVoices.add(handle);
      if (disposeOnEnd) {
        voiceNode.once(AudioSource.EventType.ENDED, () => {
          handle?.dispose();
        });
      }
      voice.clip = clip;
      voice.play();
      if (this.effectsPauseLeaseActive) {
        handle.pauseForPresenter();
      }
      return handle;
    } catch (error) {
      const failures: unknown[] = [];
      if (handle !== null) {
        const cleanupHandle = handle;
        runCleanup(failures, () => cleanupHandle.dispose());
      } else if (isValid(voiceNode, true)) {
        runCleanup(failures, () => voiceNode.destroy());
      }
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'Classic effect voice creation rollback failed',
          error,
          failures,
        );
      }
      throw error;
    }
  }
}

class CreatorClassicOwnedAudioVoice implements ClassicRetainedAudioHandle {
  private clipClearedValue = false;
  private disposedValue = false;
  private nodeDestroyedValue = false;
  private readonly onDisposed: (handle: CreatorClassicOwnedAudioVoice) => void;
  private ownerReleasedValue = false;
  private pausedByPresenterValue = false;
  private stoppedValue = false;
  private readonly voice: AudioSource;
  private readonly voiceNode: Node;

  constructor(
    voiceNode: Node,
    voice: AudioSource,
    onDisposed: (handle: CreatorClassicOwnedAudioVoice) => void,
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

  get pausedByPresenter(): boolean {
    return this.pausedByPresenterValue;
  }

  pauseForPresenter(): boolean {
    if (
      this.disposedValue
      || this.stoppedValue
      || this.pausedByPresenterValue
      || !isValid(this.voiceNode, true)
    ) {
      return false;
    }
    this.voice.pause();
    this.pausedByPresenterValue = true;
    return true;
  }

  resumeFromPresenterPause(): boolean {
    if (
      !this.pausedByPresenterValue
      || this.disposedValue
      || this.stoppedValue
    ) {
      return false;
    }
    if (!isValid(this.voiceNode, true)) {
      this.pausedByPresenterValue = false;
      return false;
    }
    this.voice.play();
    this.pausedByPresenterValue = false;
    return true;
  }

  stop(): void {
    if (this.stoppedValue) {
      return;
    }
    if (isValid(this.voiceNode, true)) {
      this.voice.stop();
    }
    this.stoppedValue = true;
    this.pausedByPresenterValue = false;
  }

  dispose(): void {
    if (this.disposedValue) {
      return;
    }
    this.stop();
    if (!this.clipClearedValue) {
      this.voice.clip = null;
      this.clipClearedValue = true;
    }
    if (!this.nodeDestroyedValue) {
      if (isValid(this.voiceNode, true)) {
        this.voiceNode.destroy();
      }
      this.nodeDestroyedValue = true;
    }
    if (!this.ownerReleasedValue) {
      this.onDisposed(this);
      this.ownerReleasedValue = true;
    }
    this.disposedValue = true;
  }
}

function assertValidAudioParent(parent: Node): void {
  if (!isValid(parent, true)) {
    throw new Error('Classic audio parent was destroyed while audio was loading');
  }
}

function runCleanup(failures: unknown[], cleanup: () => void): void {
  try {
    cleanup();
  } catch (error) {
    failures.push(error);
  }
}

function throwOperationFailures(
  label: string,
  failures: readonly unknown[],
): void {
  if (failures.length > 0) {
    throw new Error(
      `${label} failed: ${failures.map(errorMessage).join('; ')}`,
    );
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
