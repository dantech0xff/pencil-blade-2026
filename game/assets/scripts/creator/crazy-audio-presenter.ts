import {
  AudioClip,
  AudioSource,
  Node,
  isValid,
} from 'cc';

import type { AssetManager } from 'cc';

import {
  CRAZY_DIRECT_PLAY_AUDIO_PATHS,
  CRAZY_ELECTRIC_BACKGROUND_AUDIO_PATH,
  CRAZY_REQUIRED_STAGED_AUDIO_COUNT,
  CRAZY_REQUIRED_STAGED_AUDIO_PATHS,
  type CrazyEffectAudioPath,
} from '../domain/crazy-audio-contract';
import { canonicalResourceToBundlePath } from '../domain/game-resource-contract';
import { loadGameResourceBundle } from './game-resource-loader';

const TARGET_EFFECT_VOLUME = 1;
const DIRECT_PLAY_PATHS: ReadonlySet<string> = new Set(
  CRAZY_DIRECT_PLAY_AUDIO_PATHS,
);

export interface CrazyRetainedAudioHandle {
  readonly disposed: boolean;
  readonly stopped: boolean;
  dispose(): void;
  stop(): void;
}

/**
 * Exact Crazy audio supplement over Creator AudioSource.
 *
 * All statically proven preload rows are loaded, while playback is restricted to the direct
 * consumer catalog. Owned one-shot/retained effect voices and the electric background channel
 * deliberately keep separate stop boundaries because native `stopAllEffects()` does not stop
 * the latter.
 */
export class CrazyAudioPresenter {
  private readonly audioRoot: Node;
  private backgroundMusicPauseLeaseActive = false;
  private backgroundMusicPausedByPresenter = false;
  private backgroundMusicStarted = false;
  private readonly backgroundMusicNode: Node;
  private readonly backgroundMusicSource: AudioSource;
  private readonly clipsByCanonicalPath: ReadonlyMap<string, AudioClip>;
  private readonly effectVoices = new Set<CreatorCrazyOwnedAudioVoice>();
  private effectsPauseLeaseActive = false;
  private readonly effectsVoiceRoot: Node;
  private readonly parent: Node;

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

  static async load(parent: Node): Promise<CrazyAudioPresenter> {
    if (!isValid(parent, true)) {
      throw new Error('Crazy audio parent must be a valid Creator node');
    }
    const bundle = await loadGameResourceBundle();
    assertValidAudioParent(parent);
    const clips = await loadCrazyAudioClips(bundle);
    assertValidAudioParent(parent);
    const clipsByCanonicalPath = new Map<string, AudioClip>();
    for (
      let index = 0;
      index < CRAZY_REQUIRED_STAGED_AUDIO_PATHS.length;
      index += 1
    ) {
      const canonicalPath = CRAZY_REQUIRED_STAGED_AUDIO_PATHS[index];
      const clip = clips[index];
      if (canonicalPath === undefined || clip === undefined) {
        throw new Error('Creator returned an incomplete Crazy AudioClip batch');
      }
      if (clipsByCanonicalPath.has(canonicalPath)) {
        throw new Error(`Crazy audio catalog contains duplicate path ${canonicalPath}`);
      }
      clipsByCanonicalPath.set(canonicalPath, clip);
    }
    if (clipsByCanonicalPath.size !== CRAZY_REQUIRED_STAGED_AUDIO_COUNT) {
      throw new Error('Creator returned an incomplete Crazy staged-audio catalog');
    }

    let audioRoot: Node | null = null;
    try {
      audioRoot = new Node('CrazyAudioRoot');
      const effectsVoiceRoot = new Node('CrazyEffectAudioVoices');
      effectsVoiceRoot.setParent(audioRoot);
      const backgroundMusicNode = new Node('CrazyElectricBackgroundAudio');
      backgroundMusicNode.setParent(audioRoot);
      const backgroundMusicSource = backgroundMusicNode.addComponent(AudioSource);
      backgroundMusicSource.playOnAwake = false;
      backgroundMusicSource.loop = true;
      backgroundMusicSource.volume = 1;

      assertValidAudioParent(parent);
      audioRoot.setParent(parent);
      if (audioRoot.parent !== parent || !isValid(audioRoot, true)) {
        throw new Error('Crazy audio root failed to attach to its valid parent');
      }
      return new CrazyAudioPresenter(
        parent,
        audioRoot,
        effectsVoiceRoot,
        backgroundMusicNode,
        backgroundMusicSource,
        clipsByCanonicalPath,
      );
    } catch (error: unknown) {
      if (audioRoot !== null && isValid(audioRoot, true)) {
        try {
          audioRoot.destroy();
        } catch (cleanupError: unknown) {
          throw new Error(
            `Crazy audio load failed: ${errorMessage(error)}; `
            + `partial attachment cleanup failed: ${errorMessage(cleanupError)}`,
          );
        }
      }
      throw error;
    }
  }

  playOneShot(canonicalPath: CrazyEffectAudioPath): void {
    const clip = this.requireDirectClip(canonicalPath);
    this.createEffectVoice('CrazyOneShotEffectAudio', clip, false, true);
  }

  playLoopingEffect(
    canonicalPath: CrazyEffectAudioPath,
  ): CrazyRetainedAudioHandle {
    const clip = this.requireDirectClip(canonicalPath);
    return this.createEffectVoice(
      'CrazyRetainedEffectAudio',
      clip,
      true,
      false,
    );
  }

  playElectricBackgroundMusic(): void {
    if (
      !isValid(this.parent, true)
      || !isValid(this.audioRoot, true)
      || !isValid(this.backgroundMusicNode, true)
    ) {
      throw new Error('Crazy electric background parent is no longer valid');
    }
    this.backgroundMusicSource.clip = this.requireDirectClip(
      CRAZY_ELECTRIC_BACKGROUND_AUDIO_PATH,
    );
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
    throwOperationFailures('Crazy effect pause', failures);
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
    throwOperationFailures('Crazy effect resume', failures);
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

  /** Stops every owned one-shot/retained effect; electric background remains separate. */
  stopAllEffects(): void {
    this.effectsPauseLeaseActive = false;
    const failures: unknown[] = [];
    for (const voice of Array.from(this.effectVoices)) {
      runCleanup(failures, () => voice.dispose());
    }
    throwOperationFailures('Crazy effect voices', failures);
  }

  stop(): void {
    const failures: unknown[] = [];
    runCleanup(failures, () => this.stopAllEffects());
    runCleanup(failures, () => this.stopBackgroundMusic());
    throwOperationFailures('Crazy audio', failures);
  }

  private requireDirectClip(canonicalPath: string): AudioClip {
    if (typeof canonicalPath !== 'string' || canonicalPath.length === 0) {
      throw new TypeError('canonicalPath must be a non-empty string');
    }
    if (!DIRECT_PLAY_PATHS.has(canonicalPath)) {
      throw new Error(`Crazy audio path has no recovered play consumer: ${canonicalPath}`);
    }
    const clip = this.clipsByCanonicalPath.get(canonicalPath);
    if (clip === undefined) {
      throw new Error(`Crazy AudioClip was not loaded: ${canonicalPath}`);
    }
    return clip;
  }

  private createEffectVoice(
    name: string,
    clip: AudioClip,
    loop: boolean,
    disposeOnEnd: boolean,
  ): CreatorCrazyOwnedAudioVoice {
    if (
      !isValid(this.parent, true)
      || !isValid(this.audioRoot, true)
      || !isValid(this.effectsVoiceRoot, true)
    ) {
      throw new Error('Crazy audio parent is no longer valid');
    }

    const voiceNode = new Node(name);
    let handle: CreatorCrazyOwnedAudioVoice | null = null;
    try {
      voiceNode.setParent(this.effectsVoiceRoot);
      const voice = voiceNode.addComponent(AudioSource);
      voice.playOnAwake = false;
      voice.loop = loop;
      voice.volume = TARGET_EFFECT_VOLUME;
      handle = new CreatorCrazyOwnedAudioVoice(
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
    } catch (error: unknown) {
      const failures: unknown[] = [];
      if (handle !== null) {
        const cleanupHandle = handle;
        runCleanup(failures, () => cleanupHandle.dispose());
      } else if (isValid(voiceNode, true)) {
        runCleanup(failures, () => voiceNode.destroy());
      }
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'Crazy effect voice creation rollback failed',
          error,
          failures,
        );
      }
      throw error;
    }
  }
}

class CreatorCrazyOwnedAudioVoice implements CrazyRetainedAudioHandle {
  private clipClearedValue = false;
  private disposedValue = false;
  private nodeDestroyedValue = false;
  private readonly onDisposed: (handle: CreatorCrazyOwnedAudioVoice) => void;
  private ownerReleasedValue = false;
  private pausedByPresenterValue = false;
  private stoppedValue = false;
  private readonly voice: AudioSource;
  private readonly voiceNode: Node;

  constructor(
    voiceNode: Node,
    voice: AudioSource,
    onDisposed: (handle: CreatorCrazyOwnedAudioVoice) => void,
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
    throw new Error('Crazy audio parent was destroyed while audio was loading');
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

function loadCrazyAudioClips(
  bundle: AssetManager.Bundle,
): Promise<readonly AudioClip[]> {
  const bundlePaths = CRAZY_REQUIRED_STAGED_AUDIO_PATHS.map(
    canonicalResourceToBundlePath,
  );
  return new Promise((resolve, reject) => {
    bundle.load(bundlePaths, AudioClip, (error, audioClips) => {
      if (error !== null && error !== undefined) {
        reject(new Error(`Failed to load Crazy AudioClips: ${error.message}`));
        return;
      }
      if (audioClips === null || audioClips === undefined) {
        reject(new Error('Creator returned no Crazy AudioClips'));
        return;
      }
      resolve(Object.freeze([...audioClips]));
    });
  });
}
