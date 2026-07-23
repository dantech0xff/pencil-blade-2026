import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

import {
  CRAZY_DOUBLE_SCORE_AUDIO_PATH,
  CRAZY_ELECTRIC_BACKGROUND_AUDIO_PATH,
  CRAZY_MAGNET_LOOP_AUDIO_PATH,
  CRAZY_PRELOAD_ONLY_AUDIO_PATHS,
  CRAZY_REQUIRED_STAGED_AUDIO_COUNT,
  CRAZY_REQUIRED_STAGED_AUDIO_PATHS,
} from '../../../game/assets/scripts/domain/crazy-audio-contract.ts';
import { canonicalResourceToBundlePath } from '../../../game/assets/scripts/domain/game-resource-contract.ts';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const audioOperations = [];
export const audioSources = [];
export const allNodes = [];
export const loadedBundlePaths = [];
export const nativeOneShots = [];
const pendingAudioLoads = [];
const pendingBundleLoads = [];
const pendingClipLoads = [];
let bundleAvailable = true;
let bundleLoadDeferred = false;
let clipLoadDeferred = false;

export function resetAudioStub() {
  audioOperations.length = 0;
  audioSources.length = 0;
  allNodes.length = 0;
  loadedBundlePaths.length = 0;
  nativeOneShots.length = 0;
  pendingAudioLoads.length = 0;
  pendingBundleLoads.length = 0;
  pendingClipLoads.length = 0;
  bundleAvailable = true;
  bundleLoadDeferred = false;
  clipLoadDeferred = false;
}

export function setBundleAvailable(value) {
  bundleAvailable = value;
}

export function deferBundleLoad() {
  bundleLoadDeferred = true;
}

export function resolveBundleLoad(error = null) {
  const callbacks = pendingBundleLoads.splice(0);
  for (const callback of callbacks) callback(error, error ? null : bundle);
}

export function deferClipLoad() {
  clipLoadDeferred = true;
}

export function resolveClipLoad(error = null) {
  const requests = pendingClipLoads.splice(0);
  for (const { callback, paths, Type } of requests) {
    callback(error, error ? null : paths.map((path) => new Type(path)));
  }
}

export function resolveClipLoadWithoutAssets() {
  const requests = pendingClipLoads.splice(0);
  for (const { callback } of requests) callback(null, null);
}

export function resolveClipLoadIncomplete() {
  const requests = pendingClipLoads.splice(0);
  for (const { callback, paths, Type } of requests) {
    callback(null, paths.slice(0, -1).map((path) => new Type(path)));
  }
}

export function completeAudioLoads() {
  const loads = pendingAudioLoads.splice(0);
  for (const load of loads) {
    if (
      load.source.generation !== load.generation
      || load.source.clip === null
      || load.source.node?.destroyed
    ) {
      continue;
    }
    load.source.loaded = true;
    const operations = load.source.operations.splice(0);
    for (const operation of operations) {
      if (operation === 'play') load.source.startPlaying();
      if (operation === 'pause') {
        load.source.playing = false;
        load.source.paused = true;
      }
      if (operation === 'stop') {
        load.source.playing = false;
        load.source.paused = false;
      }
    }
  }
  for (const oneShot of nativeOneShots) {
    if (oneShot.pending) {
      oneShot.pending = false;
      oneShot.playing = true;
    }
  }
}

export function failNextChildAttachment(parent) {
  parent.failNextChildAttachment = true;
}

export function failNextAudioOperation(source, operation) {
  source.failures.set(operation, (source.failures.get(operation) ?? 0) + 1);
}

export function failNextNodeDestroy(node) {
  node.failDestroyCount += 1;
}

export class AudioClip {
  constructor(canonicalBundlePath = '') { this.canonicalBundlePath = canonicalBundlePath; }
}

export class AudioSource {
  static EventType = Object.freeze({ ENDED: 'ended', STARTED: 'started' });
  constructor() {
    this._clip = null;
    this.failures = new Map();
    this.generation = 0;
    this.loaded = false;
    this.loop = false;
    this.node = null;
    this.operations = [];
    this.pauseCalls = 0;
    this.paused = false;
    this.playCalls = 0;
    this.playOnAwake = true;
    this.playing = false;
    this.startCalls = 0;
    this.stopCalls = 0;
    this.volume = 0;
    audioSources.push(this);
  }
  get clip() { return this._clip; }
  set clip(value) {
    if (value === this._clip) return;
    if (value === null && this._clip !== null) {
      this.consumeFailure('clear-clip');
      audioOperations.push(this.operationLabel('clear-clip'));
    }
    this._clip = value;
    this.generation += 1;
    this.loaded = false;
    this.operations.length = 0;
    this.playing = false;
    if (value !== null) {
      pendingAudioLoads.push({ generation: this.generation, source: this });
    }
  }
  consumeFailure(operation) {
    const count = this.failures.get(operation) ?? 0;
    if (count === 0) return;
    this.failures.set(operation, count - 1);
    throw new Error('injected ' + operation + ' failure');
  }
  operationLabel(operation) {
    return (this.node?.name ?? 'DetachedAudioSource') + ':' + operation;
  }
  play() {
    this.consumeFailure('play');
    this.playCalls += 1;
    audioOperations.push(this.operationLabel('play'));
    if (!this.loaded && this.clip !== null) {
      this.operations.push('play');
      return;
    }
    this.startPlaying();
  }
  pause() {
    this.consumeFailure('pause');
    this.pauseCalls += 1;
    audioOperations.push(this.operationLabel('pause'));
    if (!this.loaded && this.clip !== null) {
      this.operations.push('pause');
      return;
    }
    if (this.playing) {
      this.playing = false;
      this.paused = true;
    }
  }
  playOneShot(clip, volumeScale) {
    nativeOneShots.push({ clip, pending: true, playing: false, volumeScale });
  }
  startPlaying() {
    if (this.clip === null) return;
    this.playing = true;
    this.paused = false;
    this.startCalls += 1;
    this.node?.emit(AudioSource.EventType.STARTED, this);
  }
  stop() {
    this.consumeFailure('stop');
    this.stopCalls += 1;
    audioOperations.push(this.operationLabel('stop'));
    if (!this.loaded && this.clip !== null) {
      this.operations.push('stop');
      return;
    }
    this.playing = false;
    this.paused = false;
  }
  finish() {
    if (!this.playing) return;
    this.playing = false;
    this.node?.emit(AudioSource.EventType.ENDED, this);
  }
  onDestroy() {
    if (this.clip !== null) {
      this.stop();
      this.clip = null;
    } else {
      this.playing = false;
      this.paused = false;
    }
  }
}

export class SpriteFrame {}
export const AssetManager = Object.freeze({});

const bundle = Object.freeze({
  load(paths, Type, callback) {
    loadedBundlePaths.push(...paths);
    if (clipLoadDeferred) {
      pendingClipLoads.push({ callback, paths, Type });
      return;
    }
    callback(null, paths.map((path) => new Type(path)));
  },
});

export const assetManager = Object.freeze({
  getBundle() { return bundleAvailable ? bundle : null; },
  loadBundle(_name, callback) {
    if (bundleLoadDeferred) {
      pendingBundleLoads.push(callback);
      return;
    }
    callback(null, bundle);
  },
});

export class Node {
  constructor(name = '') {
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyed = false;
    this.failNextChildAttachment = false;
    this.failDestroyCount = 0;
    this.listeners = new Map();
    this.name = name;
    this.parent = null;
    allNodes.push(this);
  }
  get activeInHierarchy() {
    return this.active && (this.parent === null || this.parent.activeInHierarchy);
  }
  addComponent(Type) {
    const component = new Type();
    component.node = this;
    this.components.set(Type, component);
    return component;
  }
  getComponent(Type) { return this.components.get(Type) ?? null; }
  once(event, callback) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push({ callback, once: true });
    this.listeners.set(event, listeners);
  }
  emit(event, ...args) {
    const listeners = [...(this.listeners.get(event) ?? [])];
    for (const listener of listeners) {
      listener.callback(...args);
      if (listener.once) {
        const current = this.listeners.get(event) ?? [];
        const index = current.indexOf(listener);
        if (index >= 0) current.splice(index, 1);
      }
    }
  }
  setParent(parent) {
    if (this.parent !== null) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
    if (parent?.failNextChildAttachment) {
      parent.failNextChildAttachment = false;
      throw new Error('injected child attachment failure');
    }
  }
  destroy() {
    if (this.destroyed) return;
    if (this.failDestroyCount > 0) {
      this.failDestroyCount -= 1;
      throw new Error('injected destroy failure');
    }
    audioOperations.push(this.name + ':destroy');
    for (const child of [...this.children]) child.destroy();
    for (const component of this.components.values()) component.onDestroy?.();
    this.destroyed = true;
    this.active = false;
    this.listeners.clear();
    this.setParent(null);
  }
}

export function isValid(value) {
  return value !== null && value !== undefined && !value.destroyed;
}
`)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') {
      return { shortCircuit: true, url: CC_STUB_URL };
    }
    if (
      (specifier.startsWith('./') || specifier.startsWith('../'))
      && extname(specifier) === ''
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const cc = await import('cc') as unknown as CocosStub;
const { CrazyAudioPresenter } = await import(
  '../../../game/assets/scripts/creator/crazy-audio-presenter.ts'
);

interface StubAudioClip {
  readonly canonicalBundlePath: string;
}

interface StubAudioSource {
  readonly clip: StubAudioClip | null;
  readonly loop: boolean;
  readonly node: StubNode;
  readonly pauseCalls: number;
  readonly paused: boolean;
  readonly playCalls: number;
  readonly playOnAwake: boolean;
  readonly playing: boolean;
  readonly startCalls: number;
  readonly stopCalls: number;
  readonly volume: number;
  finish(): void;
}

interface StubNode {
  readonly children: readonly StubNode[];
  readonly destroyed: boolean;
  readonly name: string;
  readonly parent: StubNode | null;
  destroy(): void;
}

interface CocosStub {
  readonly AudioSource: new () => StubAudioSource;
  readonly Node: new (name?: string) => StubNode;
  readonly allNodes: StubNode[];
  readonly audioOperations: string[];
  readonly audioSources: StubAudioSource[];
  readonly loadedBundlePaths: string[];
  readonly nativeOneShots: readonly {
    readonly pending: boolean;
    readonly playing: boolean;
  }[];
  readonly completeAudioLoads: () => void;
  readonly deferBundleLoad: () => void;
  readonly deferClipLoad: () => void;
  readonly failNextAudioOperation: (
    source: StubAudioSource,
    operation: 'clear-clip' | 'pause' | 'play' | 'stop',
  ) => void;
  readonly failNextChildAttachment: (parent: StubNode) => void;
  readonly failNextNodeDestroy: (node: StubNode) => void;
  readonly resetAudioStub: () => void;
  readonly resolveBundleLoad: (error?: Error | null) => void;
  readonly resolveClipLoad: (error?: Error | null) => void;
  readonly resolveClipLoadIncomplete: () => void;
  readonly resolveClipLoadWithoutAssets: () => void;
  readonly setBundleAvailable: (value: boolean) => void;
}

test('Crazy audio preload requests every direct and preload-only recovered row', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await CrazyAudioPresenter.load(root as never);

  assert.deepEqual(
    cc.loadedBundlePaths,
    CRAZY_REQUIRED_STAGED_AUDIO_PATHS.map(canonicalResourceToBundlePath),
  );
  assert.equal(cc.loadedBundlePaths.length, CRAZY_REQUIRED_STAGED_AUDIO_COUNT);
  for (const canonicalPath of CRAZY_PRELOAD_ONLY_AUDIO_PATHS) {
    assert.equal(
      cc.loadedBundlePaths.includes(canonicalResourceToBundlePath(canonicalPath)),
      true,
    );
  }
  assert.equal(cc.audioSources.length, 1);
  assert.equal(cc.audioSources[0]?.playOnAwake, false);
  assert.equal(cc.audioSources[0]?.loop, true);
  assert.deepEqual(root.children.map(({ name }) => name), ['CrazyAudioRoot']);
  assert.deepEqual(root.children[0]?.children.map(({ name }) => name), [
    'CrazyEffectAudioVoices',
    'CrazyElectricBackgroundAudio',
  ]);
  presenter.stop();
});

test('Crazy owned one-shot, retained loop, and electric background use distinct voices', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await CrazyAudioPresenter.load(root as never);
  const background = cc.audioSources[0];

  presenter.playOneShot(CRAZY_DOUBLE_SCORE_AUDIO_PATH);
  const magnet = presenter.playLoopingEffect(CRAZY_MAGNET_LOOP_AUDIO_PATH);
  presenter.playElectricBackgroundMusic();
  const oneShotVoice = cc.audioSources.find(
    ({ node }) => node.name === 'CrazyOneShotEffectAudio',
  );
  const magnetVoice = cc.audioSources.find(
    ({ node }) => node.name === 'CrazyRetainedEffectAudio',
  );
  assert.equal(cc.nativeOneShots.length, 0);
  assert.equal(oneShotVoice?.playing, false);
  assert.equal(magnetVoice?.playing, false);
  assert.equal(background?.playing, false);

  cc.completeAudioLoads();

  assert.equal(
    oneShotVoice?.clip?.canonicalBundlePath,
    'Sounds/doublepoint',
  );
  assert.equal(oneShotVoice?.playing, true);
  assert.equal(oneShotVoice?.startCalls, 1);
  assert.equal(magnetVoice?.clip?.canonicalBundlePath, 'Sounds/magnet');
  assert.equal(magnetVoice?.loop, true);
  assert.equal(magnetVoice?.playCalls, 1);
  assert.equal(magnetVoice?.playing, true);
  assert.equal(
    background?.clip?.canonicalBundlePath,
    canonicalResourceToBundlePath(CRAZY_ELECTRIC_BACKGROUND_AUDIO_PATH),
  );
  assert.equal(background?.playCalls, 1);
  assert.equal(background?.playing, true);

  presenter.stopAllEffects();
  assert.equal(oneShotVoice?.playing, false);
  assert.equal(oneShotVoice?.node.destroyed, true);
  assert.equal(magnet.stopped, true);
  assert.equal(magnet.disposed, true);
  assert.equal(magnetVoice?.playing, false);
  assert.equal(magnetVoice?.node.destroyed, true);
  assert.equal(background?.stopCalls, 0);
  assert.equal(background?.playing, true);

  presenter.stopBackgroundMusic();
  assert.equal(background?.stopCalls, 1);
  assert.equal(background?.playing, false);
});

test('Crazy retained handles are safe and preload-only paths cannot be played', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await CrazyAudioPresenter.load(root as never);
  const handle = presenter.playLoopingEffect(CRAZY_MAGNET_LOOP_AUDIO_PATH);
  const voice = cc.audioSources.find(
    ({ node }) => node.name === 'CrazyRetainedEffectAudio',
  );
  cc.completeAudioLoads();

  handle.stop();
  handle.stop();
  assert.equal(handle.stopped, true);
  assert.equal(handle.disposed, false);
  assert.equal(voice?.stopCalls, 1);
  assert.equal(voice?.playing, false);

  handle.dispose();
  handle.dispose();
  assert.equal(handle.disposed, true);
  assert.equal((voice?.stopCalls ?? 0) >= 1, true);
  assert.equal(voice?.node.destroyed, true);

  assert.throws(
    () => presenter.playOneShot(CRAZY_PRELOAD_ONLY_AUDIO_PATHS[0] as never),
    /no recovered play consumer/,
  );
  assert.throws(() => presenter.playOneShot('' as never), TypeError);

  root.destroy();
  assert.throws(
    () => presenter.playLoopingEffect(CRAZY_MAGNET_LOOP_AUDIO_PATH),
    /parent is no longer valid/,
  );
});

test('Crazy effect pause lease is idempotent and includes effects requested while paused', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await CrazyAudioPresenter.load(root as never);
  const magnet = presenter.playLoopingEffect(CRAZY_MAGNET_LOOP_AUDIO_PATH);
  const magnetVoice = cc.audioSources.find(
    ({ node }) => node.name === 'CrazyRetainedEffectAudio',
  );
  assert.ok(magnetVoice);
  cc.completeAudioLoads();

  presenter.pauseAllEffects();
  presenter.pauseAllEffects();
  assert.equal(magnetVoice.pauseCalls, 1);
  assert.equal(magnetVoice.paused, true);
  assert.equal(magnet.stopped, false);
  assert.equal(magnet.disposed, false);

  presenter.playOneShot(CRAZY_DOUBLE_SCORE_AUDIO_PATH);
  const resumeClickVoice = cc.audioSources.find(
    ({ node }) => node.name === 'CrazyOneShotEffectAudio',
  );
  assert.ok(resumeClickVoice);
  assert.equal(resumeClickVoice.playCalls, 1);
  assert.equal(resumeClickVoice.pauseCalls, 1);
  assert.deepEqual(cc.audioOperations.slice(-2), [
    'CrazyOneShotEffectAudio:play',
    'CrazyOneShotEffectAudio:pause',
  ]);
  cc.completeAudioLoads();
  assert.equal(resumeClickVoice.paused, true);
  assert.equal(resumeClickVoice.playing, false);

  presenter.resumeAllEffects();
  presenter.resumeAllEffects();
  assert.equal(magnetVoice.playCalls, 2);
  assert.equal(magnetVoice.paused, false);
  assert.equal(resumeClickVoice.playCalls, 2);
  assert.equal(resumeClickVoice.paused, false);
  assert.equal(resumeClickVoice.playing, true);

  const stopped = presenter.playLoopingEffect(CRAZY_MAGNET_LOOP_AUDIO_PATH);
  const stoppedVoice = cc.audioSources.at(-1);
  assert.ok(stoppedVoice);
  cc.completeAudioLoads();
  stopped.stop();
  presenter.pauseAllEffects();
  presenter.resumeAllEffects();
  assert.equal(stoppedVoice.playCalls, 1);
  assert.equal(stoppedVoice.pauseCalls, 0);
  presenter.stop();
});

test('Crazy background pause lease is idempotent, reversible, and cleared by stop', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await CrazyAudioPresenter.load(root as never);
  const background = cc.audioSources[0];
  assert.ok(background);

  presenter.pauseBackgroundMusic();
  assert.equal(background.pauseCalls, 0);
  presenter.playElectricBackgroundMusic();
  assert.equal(background.playCalls, 1);
  assert.equal(background.pauseCalls, 1);
  cc.completeAudioLoads();
  assert.equal(background.paused, true);

  presenter.pauseBackgroundMusic();
  assert.equal(background.pauseCalls, 1);
  presenter.resumeBackgroundMusic();
  presenter.resumeBackgroundMusic();
  assert.equal(background.playCalls, 2);
  assert.equal(background.paused, false);

  presenter.pauseBackgroundMusic();
  presenter.playElectricBackgroundMusic();
  assert.equal(background.playCalls, 3);
  assert.equal(background.pauseCalls, 3);
  assert.equal(background.paused, true);
  presenter.resumeBackgroundMusic();
  assert.equal(background.playCalls, 4);

  presenter.pauseBackgroundMusic();
  presenter.stopBackgroundMusic();
  const pauseCallsAfterStop = background.pauseCalls;
  presenter.playElectricBackgroundMusic();
  assert.equal(background.pauseCalls, pauseCallsAfterStop);
  assert.equal(background.playing, true);
  presenter.stop();
});

test('Crazy effect pause and resume retry without committing failed Creator operations', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await CrazyAudioPresenter.load(root as never);
  presenter.playLoopingEffect(CRAZY_MAGNET_LOOP_AUDIO_PATH);
  const voice = cc.audioSources.find(
    ({ node }) => node.name === 'CrazyRetainedEffectAudio',
  );
  assert.ok(voice);
  cc.completeAudioLoads();

  cc.failNextAudioOperation(voice, 'pause');
  assert.throws(() => presenter.pauseAllEffects(), /injected pause failure/);
  assert.equal(voice.pauseCalls, 0);
  assert.equal(voice.paused, false);
  presenter.pauseAllEffects();
  assert.equal(voice.pauseCalls, 1);
  assert.equal(voice.paused, true);

  cc.failNextAudioOperation(voice, 'play');
  assert.throws(() => presenter.resumeAllEffects(), /injected play failure/);
  assert.equal(voice.playCalls, 1);
  assert.equal(voice.paused, true);
  presenter.resumeAllEffects();
  assert.equal(voice.playCalls, 2);
  assert.equal(voice.paused, false);
  presenter.stop();
});

test('Crazy retained disposal preserves retry ownership and commits cleanup in order', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await CrazyAudioPresenter.load(root as never);

  const stopFailure = presenter.playLoopingEffect(CRAZY_MAGNET_LOOP_AUDIO_PATH);
  const stopFailureVoice = cc.audioSources[1];
  assert.ok(stopFailureVoice);
  cc.completeAudioLoads();
  cc.failNextAudioOperation(stopFailureVoice, 'stop');
  assert.throws(() => stopFailure.dispose(), /injected stop failure/);
  assert.equal(stopFailure.stopped, false);
  assert.equal(stopFailure.disposed, false);
  assert.equal(stopFailureVoice.clip?.canonicalBundlePath, 'Sounds/magnet');
  assert.equal(stopFailureVoice.node.destroyed, false);
  presenter.stopAllEffects();
  assert.equal(stopFailure.disposed, true);
  assert.equal(stopFailureVoice.stopCalls, 1);

  const clipFailure = presenter.playLoopingEffect(CRAZY_MAGNET_LOOP_AUDIO_PATH);
  const clipFailureVoice = cc.audioSources[2];
  assert.ok(clipFailureVoice);
  cc.completeAudioLoads();
  cc.failNextAudioOperation(clipFailureVoice, 'clear-clip');
  assert.throws(() => clipFailure.dispose(), /injected clear-clip failure/);
  assert.equal(clipFailure.stopped, true);
  assert.equal(clipFailure.disposed, false);
  assert.equal(clipFailureVoice.stopCalls, 1);
  assert.equal(clipFailureVoice.node.destroyed, false);
  presenter.stopAllEffects();
  assert.equal(clipFailure.disposed, true);
  assert.equal(clipFailureVoice.stopCalls, 1);

  const destroyFailure = presenter.playLoopingEffect(CRAZY_MAGNET_LOOP_AUDIO_PATH);
  const destroyFailureVoice = cc.audioSources[3];
  assert.ok(destroyFailureVoice);
  cc.completeAudioLoads();
  cc.audioOperations.length = 0;
  cc.failNextNodeDestroy(destroyFailureVoice.node);
  assert.throws(() => destroyFailure.dispose(), /injected destroy failure/);
  assert.equal(destroyFailure.stopped, true);
  assert.equal(destroyFailure.disposed, false);
  assert.equal(destroyFailureVoice.clip, null);
  assert.equal(destroyFailureVoice.node.destroyed, false);
  assert.deepEqual(cc.audioOperations, [
    'CrazyRetainedEffectAudio:stop',
    'CrazyRetainedEffectAudio:clear-clip',
  ]);
  presenter.stopAllEffects();
  assert.equal(destroyFailure.disposed, true);
  assert.equal(destroyFailureVoice.stopCalls, 1);
  assert.deepEqual(cc.audioOperations, [
    'CrazyRetainedEffectAudio:stop',
    'CrazyRetainedEffectAudio:clear-clip',
    'CrazyRetainedEffectAudio:destroy',
  ]);
  presenter.stop();
});

test('Crazy background pause, resume, and stop retry after injected failures', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await CrazyAudioPresenter.load(root as never);
  const background = cc.audioSources[0];
  assert.ok(background);
  presenter.playElectricBackgroundMusic();
  cc.completeAudioLoads();

  cc.failNextAudioOperation(background, 'pause');
  assert.throws(() => presenter.pauseBackgroundMusic(), /injected pause failure/);
  assert.equal(background.pauseCalls, 0);
  presenter.pauseBackgroundMusic();
  assert.equal(background.paused, true);

  cc.failNextAudioOperation(background, 'play');
  assert.throws(() => presenter.resumeBackgroundMusic(), /injected play failure/);
  assert.equal(background.paused, true);
  presenter.resumeBackgroundMusic();
  assert.equal(background.paused, false);

  presenter.pauseBackgroundMusic();
  cc.failNextAudioOperation(background, 'stop');
  assert.throws(() => presenter.stopBackgroundMusic(), /injected stop failure/);
  presenter.stopBackgroundMusic();
  const pauseCallsAfterStop = background.pauseCalls;
  presenter.playElectricBackgroundMusic();
  assert.equal(background.pauseCalls, pauseCallsAfterStop);
  presenter.stop();
});

test('stopAllEffects cancels pending owned one-shots before their AudioSource load can start', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await CrazyAudioPresenter.load(root as never);

  presenter.playOneShot(CRAZY_DOUBLE_SCORE_AUDIO_PATH);
  const voice = cc.audioSources.find(
    ({ node }) => node.name === 'CrazyOneShotEffectAudio',
  );
  assert.ok(voice);
  assert.equal(voice.startCalls, 0);
  assert.equal(voice.playing, false);

  presenter.stopAllEffects();
  assert.equal(voice.clip, null);
  assert.equal(voice.node.destroyed, true);
  cc.completeAudioLoads();
  assert.equal(voice.startCalls, 0);
  assert.equal(voice.playing, false);
});

test('completed one-shots leave the owned registry and destroy their voice node', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await CrazyAudioPresenter.load(root as never);
  presenter.playOneShot(CRAZY_DOUBLE_SCORE_AUDIO_PATH);
  const voice = cc.audioSources.find(
    ({ node }) => node.name === 'CrazyOneShotEffectAudio',
  );
  assert.ok(voice);
  cc.completeAudioLoads();
  assert.equal(voice.playing, true);

  voice.finish();
  assert.equal(voice.node.destroyed, true);
  const stopCallsAfterEnd = voice.stopCalls;
  presenter.stopAllEffects();
  assert.equal(voice.stopCalls, stopCallsAfterEnd);
});

test('load rejects parent destruction at both async boundaries without attaching audio', async () => {
  cc.resetAudioStub();
  cc.setBundleAvailable(false);
  cc.deferBundleLoad();
  const duringBundle = new cc.Node('DuringBundle');
  const bundlePromise = CrazyAudioPresenter.load(duringBundle as never);
  duringBundle.destroy();
  cc.resolveBundleLoad();
  await assert.rejects(bundlePromise, /destroyed while audio was loading/);
  assert.equal(cc.audioSources.length, 0);

  cc.resetAudioStub();
  cc.deferClipLoad();
  const duringClips = new cc.Node('DuringClips');
  const clipPromise = CrazyAudioPresenter.load(duringClips as never);
  await Promise.resolve();
  duringClips.destroy();
  cc.resolveClipLoad();
  await assert.rejects(clipPromise, /destroyed while audio was loading/);
  assert.equal(cc.audioSources.length, 0);
});

test('load failures and a partial commit destroy every created audio node', async () => {
  cc.resetAudioStub();
  cc.setBundleAvailable(false);
  cc.deferBundleLoad();
  const bundleFailureRoot = new cc.Node('BundleFailure');
  const bundleFailure = CrazyAudioPresenter.load(bundleFailureRoot as never);
  cc.resolveBundleLoad(new Error('injected bundle failure'));
  await assert.rejects(bundleFailure, /Failed to load game bundle/);
  assert.equal(cc.audioSources.length, 0);
  assert.equal(bundleFailureRoot.children.length, 0);

  cc.resetAudioStub();
  cc.deferClipLoad();
  const clipFailureRoot = new cc.Node('ClipFailure');
  const clipFailure = CrazyAudioPresenter.load(clipFailureRoot as never);
  await Promise.resolve();
  cc.resolveClipLoad(new Error('injected clip failure'));
  await assert.rejects(clipFailure, /Failed to load Crazy AudioClips/);
  assert.equal(cc.audioSources.length, 0);
  assert.equal(clipFailureRoot.children.length, 0);

  cc.resetAudioStub();
  cc.deferClipLoad();
  const missingClipsRoot = new cc.Node('MissingClips');
  const missingClips = CrazyAudioPresenter.load(missingClipsRoot as never);
  await Promise.resolve();
  cc.resolveClipLoadWithoutAssets();
  await assert.rejects(missingClips, /returned no Crazy AudioClips/);
  assert.equal(cc.audioSources.length, 0);
  assert.equal(missingClipsRoot.children.length, 0);

  cc.resetAudioStub();
  cc.deferClipLoad();
  const incompleteRoot = new cc.Node('IncompleteClips');
  const incomplete = CrazyAudioPresenter.load(incompleteRoot as never);
  await Promise.resolve();
  cc.resolveClipLoadIncomplete();
  await assert.rejects(incomplete, /incomplete Crazy AudioClip batch/);
  assert.equal(cc.audioSources.length, 0);
  assert.equal(incompleteRoot.children.length, 0);

  cc.resetAudioStub();
  const partialRoot = new cc.Node('PartialCommit');
  cc.failNextChildAttachment(partialRoot);
  await assert.rejects(
    CrazyAudioPresenter.load(partialRoot as never),
    /injected child attachment failure/,
  );
  assert.equal(partialRoot.children.length, 0);
  assert.equal(
    cc.allNodes
      .filter(({ name }) => name.startsWith('Crazy'))
      .every(({ destroyed }) => destroyed),
    true,
  );
});
