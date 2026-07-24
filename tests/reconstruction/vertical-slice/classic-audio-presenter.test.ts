import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

import {
  CLASSIC_CORE_AUDIO_PATHS,
  CLASSIC_ELECTRIC_BOMB_HIT_AUDIO_PATH,
  CLASSIC_ORDINARY_BOMB_AUDIO_PATHS,
  CLASSIC_TOSS_AUDIO_PATH,
  MAIN_MENU_MUSIC_AUDIO_PATH,
} from '../../../game/assets/scripts/domain/classic-audio-contract.ts';
import { canonicalResourceToBundlePath } from '../../../game/assets/scripts/domain/classic-resource-contract.ts';

const SOURCE = readFileSync(
  new URL(
    '../../../game/assets/scripts/creator/classic-audio-presenter.ts',
    import.meta.url,
  ),
  'utf8',
);

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const audioOperations = [];
export const audioSources = [];
export const createdNodes = [];
export const loadedBundlePaths = [];
const pendingBundleLoads = [];
const pendingClipLoads = [];
let bundleAvailable = true;
let bundleLoadDeferred = false;
let clipLoadDeferred = false;
let nodeConstructionFailureName = null;

export function resetAudioStub() {
  audioOperations.length = 0;
  audioSources.length = 0;
  createdNodes.length = 0;
  loadedBundlePaths.length = 0;
  pendingBundleLoads.length = 0;
  pendingClipLoads.length = 0;
  bundleAvailable = true;
  bundleLoadDeferred = false;
  clipLoadDeferred = false;
  nodeConstructionFailureName = null;
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

export function failNextChildAttachment(parent) {
  parent.failNextChildAttachment = true;
}

export function failNextNodeConstruction(name) {
  nodeConstructionFailureName = name;
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
  static EventType = Object.freeze({ ENDED: 'ended' });
  constructor() {
    this._clip = null;
    this.destroyed = false;
    this.failures = new Map();
    this.loop = true;
    this.node = null;
    this.pauseCalls = 0;
    this.paused = false;
    this.playCalls = 0;
    this.playOnAwake = true;
    this.playing = false;
    this.stopCalls = 0;
    this.volume = 0;
    audioSources.push(this);
  }
  get clip() { return this._clip; }
  set clip(value) {
    if (value === null && this._clip !== null) {
      this.consumeFailure('clear-clip');
      audioOperations.push(this.operationLabel('clear-clip'));
    }
    this._clip = value;
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
    if (this.clip !== null) {
      this.playing = true;
      this.paused = false;
    }
  }
  pause() {
    this.consumeFailure('pause');
    this.pauseCalls += 1;
    audioOperations.push(this.operationLabel('pause'));
    if (this.playing) {
      this.playing = false;
      this.paused = true;
    }
  }
  stop() {
    this.consumeFailure('stop');
    this.stopCalls += 1;
    audioOperations.push(this.operationLabel('stop'));
    this.playing = false;
    this.paused = false;
  }
  finish() {
    if (!this.playing) return;
    this.playing = false;
    this.node?.emit(AudioSource.EventType.ENDED, this);
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
    if (name === nodeConstructionFailureName) {
      nodeConstructionFailureName = null;
      throw new Error('injected node construction failure');
    }
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyed = false;
    this.failNextChildAttachment = false;
    this.failDestroyCount = 0;
    this.listeners = new Map();
    this.name = name;
    this.parent = null;
    createdNodes.push(this);
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
const { ClassicAudioPresenter } = await import(
  '../../../game/assets/scripts/creator/classic-audio-presenter.ts'
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
  readonly audioOperations: string[];
  readonly audioSources: StubAudioSource[];
  readonly createdNodes: StubNode[];
  readonly deferBundleLoad: () => void;
  readonly deferClipLoad: () => void;
  readonly failNextAudioOperation: (
    source: StubAudioSource,
    operation: 'clear-clip' | 'pause' | 'play' | 'stop',
  ) => void;
  readonly failNextChildAttachment: (parent: StubNode) => void;
  readonly failNextNodeConstruction: (name: string) => void;
  readonly failNextNodeDestroy: (node: StubNode) => void;
  readonly loadedBundlePaths: string[];
  readonly resetAudioStub: () => void;
  readonly resolveBundleLoad: (error?: Error | null) => void;
  readonly resolveClipLoad: (error?: Error | null) => void;
  readonly setBundleAvailable: (value: boolean) => void;
}

test('effect voice snapshots use Array.from before Creator loose-build iteration', () => {
  assert.equal(
    SOURCE.split('Array.from(this.effectVoices)').length - 1,
    4,
  );
  assert.doesNotMatch(
    SOURCE,
    /\[\s*\.\.\.\s*this\.effectVoices\s*\]/,
  );
  assert.match(
    SOURCE,
    /Object\.freeze\(\[\.\.\.audioClips\]\)/,
    'the definite AudioClip array copy must remain an array spread',
  );
});

test('preload requests the exact recovered core batch and excludes electric-only bomb audio', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await ClassicAudioPresenter.load(root as never);

  assert.deepEqual(
    cc.loadedBundlePaths,
    CLASSIC_CORE_AUDIO_PATHS.map(canonicalResourceToBundlePath),
  );
  assert.equal(cc.loadedBundlePaths.length, 31);
  assert.equal(
    cc.loadedBundlePaths.includes(
      canonicalResourceToBundlePath(CLASSIC_ELECTRIC_BOMB_HIT_AUDIO_PATH),
    ),
    false,
  );
  assert.equal(cc.audioSources.length, 1);
  assert.equal(cc.audioSources[0]?.loop, true);
  assert.equal(cc.audioSources[0]?.volume, 1);
  assert.deepEqual(root.children.map(({ name }) => name), ['ClassicAudioRoot']);
  assert.deepEqual(root.children[0]?.children.map(({ name }) => name), [
    'ClassicEffectAudioVoices',
    'RecoveredBackgroundMusicAudio',
  ]);
  presenter.stop();
});

test('owned one-shots overlap and retained voices stop and dispose independently', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await ClassicAudioPresenter.load(root as never);
  const background = cc.audioSources[0];
  assert.notEqual(background, undefined);

  presenter.playOneShot(CLASSIC_TOSS_AUDIO_PATH);
  const tossVoice = cc.audioSources[1];
  const first = presenter.playRetained(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.entry);
  const second = presenter.playRetained(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.entry);
  const firstVoice = cc.audioSources[2];
  const secondVoice = cc.audioSources[3];
  presenter.playOneShot(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.explosion);
  const explosionVoice = cc.audioSources[4];
  assert.notEqual(tossVoice, undefined);
  assert.notEqual(firstVoice, undefined);
  assert.notEqual(secondVoice, undefined);
  assert.notEqual(explosionVoice, undefined);
  assert.notEqual(firstVoice, secondVoice);
  assert.notEqual(firstVoice, background);
  assert.notEqual(tossVoice, explosionVoice);
  assert.equal(tossVoice?.playing, true);
  assert.equal(explosionVoice?.playing, true);
  assert.equal(firstVoice?.playCalls, 1);
  assert.equal(secondVoice?.playCalls, 1);
  assert.equal(firstVoice?.clip?.canonicalBundlePath, 'Sounds/boomsound');
  assert.equal(secondVoice?.clip?.canonicalBundlePath, 'Sounds/boomsound');
  assert.equal(tossVoice?.clip?.canonicalBundlePath, 'Sounds/tossfruit');
  assert.equal(explosionVoice?.clip?.canonicalBundlePath, 'Sounds/boomexplosion');

  first.stop();
  first.stop();
  assert.equal(first.stopped, true);
  assert.equal(first.disposed, false);
  assert.equal(firstVoice?.stopCalls, 1);
  assert.equal(secondVoice?.stopCalls, 0);
  assert.equal(tossVoice?.stopCalls, 0);
  assert.equal(explosionVoice?.stopCalls, 0);
  assert.equal(background?.stopCalls, 0);

  first.dispose();
  first.dispose();
  assert.equal(first.disposed, true);
  assert.equal(firstVoice?.stopCalls, 1);
  assert.equal(firstVoice?.node.destroyed, true);
  assert.equal(second.disposed, false);
  assert.equal(secondVoice?.node.destroyed, false);

  presenter.stop();
  assert.equal(second.stopped, true);
  assert.equal(second.disposed, true);
  assert.equal(secondVoice?.stopCalls, 1);
  assert.equal(secondVoice?.node.destroyed, true);
  assert.equal(tossVoice?.stopCalls, 1);
  assert.equal(tossVoice?.node.destroyed, true);
  assert.equal(explosionVoice?.stopCalls, 1);
  assert.equal(explosionVoice?.node.destroyed, true);
  assert.equal(background?.stopCalls, 1);
});

test('effect cleanup preserves Set insertion order while each voice releases ownership', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await ClassicAudioPresenter.load(root as never);
  presenter.playOneShot(CLASSIC_TOSS_AUDIO_PATH);
  presenter.playRetained(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.entry);
  presenter.playOneShot(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.explosion);
  cc.audioOperations.length = 0;

  presenter.stopAllEffects();

  assert.deepEqual(cc.audioOperations, [
    'ClassicOneShotAudio:stop',
    'ClassicOneShotAudio:clear-clip',
    'ClassicOneShotAudio:destroy',
    'ClassicRetainedAudio:stop',
    'ClassicRetainedAudio:clear-clip',
    'ClassicRetainedAudio:destroy',
    'ClassicOneShotAudio:stop',
    'ClassicOneShotAudio:clear-clip',
    'ClassicOneShotAudio:destroy',
  ]);
});

test('looping menu music and effects have independent stop boundaries', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await ClassicAudioPresenter.load(root as never);
  const background = cc.audioSources[0];
  assert.notEqual(background, undefined);

  presenter.playLoopingBackground(MAIN_MENU_MUSIC_AUDIO_PATH);
  presenter.playOneShot(CLASSIC_TOSS_AUDIO_PATH);
  const effect = cc.audioSources[1];
  assert.notEqual(effect, undefined);
  assert.equal(background?.clip?.canonicalBundlePath, 'Sounds/mainmenumusic');
  assert.equal(background?.playCalls, 1);
  assert.equal(effect?.playing, true);

  presenter.stopAllEffects();
  assert.equal(effect?.stopCalls, 1);
  assert.equal(effect?.node.destroyed, true);
  assert.equal(background?.stopCalls, 0);

  presenter.stopBackgroundMusic();
  assert.equal(background?.stopCalls, 1);
});

test('retained playback rejects invalid and unloaded paths before creating a voice', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await ClassicAudioPresenter.load(root as never);
  assert.equal(cc.audioSources.length, 1);

  assert.throws(() => presenter.playRetained(''), TypeError);
  assert.throws(
    () => presenter.playRetained(CLASSIC_ELECTRIC_BOMB_HIT_AUDIO_PATH),
    /Classic AudioClip was not loaded/,
  );
  assert.equal(cc.audioSources.length, 1);
  assert.equal(root.children.length, 1);

  root.destroy();
  assert.throws(
    () => presenter.playRetained(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.entry),
    /parent is no longer valid/,
  );
});

test('effect pause leases are idempotent and include voices requested while paused', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await ClassicAudioPresenter.load(root as never);
  const retained = presenter.playRetained(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.entry);
  const retainedVoice = cc.audioSources[1];
  assert.notEqual(retainedVoice, undefined);

  presenter.pauseAllEffects();
  presenter.pauseAllEffects();
  assert.equal(retainedVoice?.pauseCalls, 1);
  assert.equal(retainedVoice?.paused, true);
  assert.equal(retained.stopped, false);
  assert.equal(retained.disposed, false);

  presenter.playOneShot(CLASSIC_TOSS_AUDIO_PATH);
  const resumeClickVoice = cc.audioSources[2];
  assert.notEqual(resumeClickVoice, undefined);
  assert.equal(resumeClickVoice?.playCalls, 1);
  assert.equal(resumeClickVoice?.pauseCalls, 1);
  assert.equal(resumeClickVoice?.paused, true);
  assert.deepEqual(cc.audioOperations.slice(-2), [
    'ClassicOneShotAudio:play',
    'ClassicOneShotAudio:pause',
  ]);

  presenter.resumeAllEffects();
  presenter.resumeAllEffects();
  assert.equal(retainedVoice?.playCalls, 2);
  assert.equal(retainedVoice?.paused, false);
  assert.equal(resumeClickVoice?.playCalls, 2);
  assert.equal(resumeClickVoice?.paused, false);

  const stopped = presenter.playRetained(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.entry);
  const stoppedVoice = cc.audioSources[3];
  stopped.stop();
  presenter.pauseAllEffects();
  presenter.resumeAllEffects();
  assert.equal(stoppedVoice?.playCalls, 1);
  assert.equal(stoppedVoice?.pauseCalls, 0);
  presenter.stop();
});

test('background pause lease is idempotent, reversible, and cleared by stop', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await ClassicAudioPresenter.load(root as never);
  const background = cc.audioSources[0];
  assert.notEqual(background, undefined);

  presenter.pauseBackgroundMusic();
  assert.equal(background?.pauseCalls, 0);
  presenter.playLoopingBackground(MAIN_MENU_MUSIC_AUDIO_PATH);
  assert.equal(background?.playCalls, 1);
  assert.equal(background?.pauseCalls, 1);
  assert.equal(background?.paused, true);

  presenter.pauseBackgroundMusic();
  assert.equal(background?.pauseCalls, 1);
  presenter.resumeBackgroundMusic();
  presenter.resumeBackgroundMusic();
  assert.equal(background?.playCalls, 2);
  assert.equal(background?.paused, false);

  presenter.pauseBackgroundMusic();
  presenter.playLoopingBackground(MAIN_MENU_MUSIC_AUDIO_PATH);
  assert.equal(background?.playCalls, 3);
  assert.equal(background?.pauseCalls, 3);
  assert.equal(background?.paused, true);
  presenter.resumeBackgroundMusic();
  assert.equal(background?.playCalls, 4);

  presenter.pauseBackgroundMusic();
  presenter.stopBackgroundMusic();
  const pauseCallsAfterStop = background?.pauseCalls;
  presenter.playLoopingBackground(MAIN_MENU_MUSIC_AUDIO_PATH);
  assert.equal(background?.pauseCalls, pauseCallsAfterStop);
  assert.equal(background?.playing, true);
  presenter.stop();
});

test('effect pause and resume retry without committing failed Creator operations', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await ClassicAudioPresenter.load(root as never);
  presenter.playRetained(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.entry);
  const voice = cc.audioSources[1];
  assert.notEqual(voice, undefined);

  cc.failNextAudioOperation(voice!, 'pause');
  assert.throws(() => presenter.pauseAllEffects(), /injected pause failure/);
  assert.equal(voice?.pauseCalls, 0);
  assert.equal(voice?.paused, false);
  presenter.pauseAllEffects();
  assert.equal(voice?.pauseCalls, 1);
  assert.equal(voice?.paused, true);

  cc.failNextAudioOperation(voice!, 'play');
  assert.throws(() => presenter.resumeAllEffects(), /injected play failure/);
  assert.equal(voice?.playCalls, 1);
  assert.equal(voice?.paused, true);
  presenter.resumeAllEffects();
  assert.equal(voice?.playCalls, 2);
  assert.equal(voice?.paused, false);
  presenter.stop();
});

test('retained disposal preserves retry ownership and commits cleanup in order', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await ClassicAudioPresenter.load(root as never);

  const stopFailure = presenter.playRetained(
    CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.entry,
  );
  const stopFailureVoice = cc.audioSources[1];
  assert.notEqual(stopFailureVoice, undefined);
  cc.failNextAudioOperation(stopFailureVoice!, 'stop');
  assert.throws(() => stopFailure.dispose(), /injected stop failure/);
  assert.equal(stopFailure.stopped, false);
  assert.equal(stopFailure.disposed, false);
  assert.equal(stopFailureVoice?.clip?.canonicalBundlePath, 'Sounds/boomsound');
  assert.equal(stopFailureVoice?.node.destroyed, false);
  presenter.stopAllEffects();
  assert.equal(stopFailure.disposed, true);
  assert.equal(stopFailureVoice?.stopCalls, 1);

  const clipFailure = presenter.playRetained(
    CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.entry,
  );
  const clipFailureVoice = cc.audioSources[2];
  assert.notEqual(clipFailureVoice, undefined);
  cc.failNextAudioOperation(clipFailureVoice!, 'clear-clip');
  assert.throws(() => clipFailure.dispose(), /injected clear-clip failure/);
  assert.equal(clipFailure.stopped, true);
  assert.equal(clipFailure.disposed, false);
  assert.equal(clipFailureVoice?.stopCalls, 1);
  assert.equal(clipFailureVoice?.node.destroyed, false);
  presenter.stopAllEffects();
  assert.equal(clipFailure.disposed, true);
  assert.equal(clipFailureVoice?.stopCalls, 1);

  const destroyFailure = presenter.playRetained(
    CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.entry,
  );
  const destroyFailureVoice = cc.audioSources[3];
  assert.notEqual(destroyFailureVoice, undefined);
  cc.audioOperations.length = 0;
  cc.failNextNodeDestroy(destroyFailureVoice!.node);
  assert.throws(() => destroyFailure.dispose(), /injected destroy failure/);
  assert.equal(destroyFailure.stopped, true);
  assert.equal(destroyFailure.disposed, false);
  assert.equal(destroyFailureVoice?.clip, null);
  assert.equal(destroyFailureVoice?.node.destroyed, false);
  assert.deepEqual(cc.audioOperations, [
    'ClassicRetainedAudio:stop',
    'ClassicRetainedAudio:clear-clip',
  ]);
  presenter.stopAllEffects();
  assert.equal(destroyFailure.disposed, true);
  assert.equal(destroyFailureVoice?.stopCalls, 1);
  assert.deepEqual(cc.audioOperations, [
    'ClassicRetainedAudio:stop',
    'ClassicRetainedAudio:clear-clip',
    'ClassicRetainedAudio:destroy',
  ]);
  presenter.stop();
});

test('background pause, resume, and stop retry after injected failures', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await ClassicAudioPresenter.load(root as never);
  const background = cc.audioSources[0];
  assert.notEqual(background, undefined);
  presenter.playLoopingBackground(MAIN_MENU_MUSIC_AUDIO_PATH);

  cc.failNextAudioOperation(background!, 'pause');
  assert.throws(() => presenter.pauseBackgroundMusic(), /injected pause failure/);
  assert.equal(background?.pauseCalls, 0);
  presenter.pauseBackgroundMusic();
  assert.equal(background?.paused, true);

  cc.failNextAudioOperation(background!, 'play');
  assert.throws(() => presenter.resumeBackgroundMusic(), /injected play failure/);
  assert.equal(background?.paused, true);
  presenter.resumeBackgroundMusic();
  assert.equal(background?.paused, false);

  presenter.pauseBackgroundMusic();
  cc.failNextAudioOperation(background!, 'stop');
  assert.throws(() => presenter.stopBackgroundMusic(), /injected stop failure/);
  presenter.stopBackgroundMusic();
  const pauseCallsAfterStop = background?.pauseCalls;
  presenter.playLoopingBackground(MAIN_MENU_MUSIC_AUDIO_PATH);
  assert.equal(background?.pauseCalls, pauseCallsAfterStop);
  presenter.stop();
});

test('a completed one-shot releases only its own voice', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await ClassicAudioPresenter.load(root as never);
  presenter.playOneShot(CLASSIC_TOSS_AUDIO_PATH);
  presenter.playOneShot(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.explosion);
  const first = cc.audioSources[1];
  const second = cc.audioSources[2];
  assert.notEqual(first, undefined);
  assert.notEqual(second, undefined);

  first?.finish();
  assert.equal(first?.node.destroyed, true);
  assert.equal(second?.playing, true);
  assert.equal(second?.node.destroyed, false);
  presenter.stopAllEffects();
  assert.equal(second?.node.destroyed, true);
  presenter.stopBackgroundMusic();
});

test('load rejects parent destruction at both async boundaries without attaching audio', async () => {
  cc.resetAudioStub();
  cc.setBundleAvailable(false);
  cc.deferBundleLoad();
  const duringBundle = new cc.Node('DuringBundle');
  const bundlePromise = ClassicAudioPresenter.load(duringBundle as never);
  duringBundle.destroy();
  cc.resolveBundleLoad();
  await assert.rejects(bundlePromise, /destroyed while audio was loading/);
  assert.equal(cc.audioSources.length, 0);
  assert.equal(duringBundle.children.length, 0);
  assert.equal(
    cc.createdNodes.some(({ name }) => name === 'ClassicAudioRoot'),
    false,
  );

  cc.resetAudioStub();
  cc.deferClipLoad();
  const duringClips = new cc.Node('DuringClips');
  const clipPromise = ClassicAudioPresenter.load(duringClips as never);
  await Promise.resolve();
  duringClips.destroy();
  cc.resolveClipLoad();
  await assert.rejects(clipPromise, /destroyed while audio was loading/);
  assert.equal(cc.audioSources.length, 0);
  assert.equal(duringClips.children.length, 0);
  assert.equal(
    cc.createdNodes.some(({ name }) => name === 'ClassicAudioRoot'),
    false,
  );
});

test('load rolls back every Classic audio node on construction and attachment failures', async () => {
  cc.resetAudioStub();
  const constructionFailureRoot = new cc.Node('ConstructionFailure');
  cc.failNextNodeConstruction('RecoveredBackgroundMusicAudio');
  await assert.rejects(
    ClassicAudioPresenter.load(constructionFailureRoot as never),
    /injected node construction failure/,
  );
  assert.equal(constructionFailureRoot.children.length, 0);
  assert.equal(
    cc.createdNodes
      .filter(({ name }) => (
        name === 'ClassicAudioRoot'
        || name === 'ClassicEffectAudioVoices'
        || name === 'RecoveredBackgroundMusicAudio'
      ))
      .every(({ destroyed }) => destroyed),
    true,
  );

  cc.resetAudioStub();
  const attachmentFailureRoot = new cc.Node('AttachmentFailure');
  cc.failNextChildAttachment(attachmentFailureRoot);
  await assert.rejects(
    ClassicAudioPresenter.load(attachmentFailureRoot as never),
    /injected child attachment failure/,
  );
  assert.equal(attachmentFailureRoot.children.length, 0);
  assert.equal(
    cc.createdNodes
      .filter(({ name }) => (
        name === 'ClassicAudioRoot'
        || name === 'ClassicEffectAudioVoices'
        || name === 'RecoveredBackgroundMusicAudio'
      ))
      .every(({ destroyed }) => destroyed),
    true,
  );
});
