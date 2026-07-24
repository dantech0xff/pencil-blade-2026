import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  canonicalResourceToBundlePath,
} from '../../../game/assets/scripts/domain/game-resource-contract.ts';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const audioOperations = [];
export const audioSources = [];
export const createdNodes = [];
export const loadedBundlePaths = [];
const pendingClipLoads = [];
let clipLoadDeferred = false;
let nextClipLoadResult = 'success';

export function resetAudioStub() {
  audioOperations.length = 0;
  audioSources.length = 0;
  createdNodes.length = 0;
  loadedBundlePaths.length = 0;
  pendingClipLoads.length = 0;
  clipLoadDeferred = false;
  nextClipLoadResult = 'success';
}

export function deferClipLoad() {
  clipLoadDeferred = true;
}

export function setNextClipLoadResult(result) {
  nextClipLoadResult = result;
}

export function resolveClipLoad() {
  const requests = pendingClipLoads.splice(0);
  for (const request of requests) completeClipLoad(request);
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
  constructor(canonicalBundlePath = '') {
    this.canonicalBundlePath = canonicalBundlePath;
  }
}

export class AudioSource {
  static EventType = Object.freeze({ ENDED: 'ended' });
  constructor() {
    this._clip = null;
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
      audioOperations.push(this.label('clear-clip'));
    }
    this._clip = value;
  }
  consumeFailure(operation) {
    const remaining = this.failures.get(operation) ?? 0;
    if (remaining === 0) return;
    this.failures.set(operation, remaining - 1);
    throw new Error('injected ' + operation + ' failure');
  }
  label(operation) {
    return (this.node?.name ?? 'DetachedAudioSource') + ':' + operation;
  }
  play() {
    this.consumeFailure('play');
    this.playCalls += 1;
    audioOperations.push(this.label('play'));
    if (this.clip !== null) {
      this.playing = true;
      this.paused = false;
    }
  }
  pause() {
    this.consumeFailure('pause');
    this.pauseCalls += 1;
    audioOperations.push(this.label('pause'));
    if (this.playing) {
      this.playing = false;
      this.paused = true;
    }
  }
  stop() {
    this.consumeFailure('stop');
    this.stopCalls += 1;
    audioOperations.push(this.label('stop'));
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
    }
  }
}

export class SpriteFrame {}
export const AssetManager = Object.freeze({});

function completeClipLoad({ callback, paths, Type }) {
  const result = nextClipLoadResult;
  nextClipLoadResult = 'success';
  if (result === 'error') {
    callback(new Error('injected clip load failure'), null);
    return;
  }
  if (result === 'missing') {
    callback(null, null);
    return;
  }
  const selected = result === 'incomplete' ? [] : paths;
  callback(null, selected.map((path) => new Type(path)));
}

const bundle = Object.freeze({
  load(paths, Type, callback) {
    loadedBundlePaths.push(...paths);
    const request = { callback, paths, Type };
    if (clipLoadDeferred) {
      pendingClipLoads.push(request);
      return;
    }
    completeClipLoad(request);
  },
});

export const assetManager = Object.freeze({
  getBundle() { return bundle; },
  loadBundle(_name, callback) { callback(null, bundle); },
});

export class Node {
  constructor(name = '') {
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyed = false;
    this.failDestroyCount = 0;
    this.failNextChildAttachment = false;
    this.layer = 0;
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
  on(event, callback, target) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push({ callback, target });
    this.listeners.set(event, listeners);
  }
  off(event, callback, target) {
    const listeners = this.listeners.get(event) ?? [];
    this.listeners.set(
      event,
      listeners.filter((listener) => (
        listener.callback !== callback || listener.target !== target
      )),
    );
  }
  emit(event, ...args) {
    for (const listener of [...(this.listeners.get(event) ?? [])]) {
      listener.callback.apply(listener.target, args);
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
    for (const child of [...this.children]) child.destroy();
    for (const component of this.components.values()) {
      component.onDestroy?.();
    }
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

const cc = await import('cc') as unknown as {
  readonly Node: new (name?: string) => StubNode;
  readonly audioOperations: string[];
  readonly audioSources: StubAudioSource[];
  readonly createdNodes: StubNode[];
  readonly deferClipLoad: () => void;
  readonly failNextAudioOperation: (
    source: StubAudioSource,
    operation: 'clear-clip' | 'pause' | 'play' | 'stop',
  ) => void;
  readonly failNextChildAttachment: (parent: StubNode) => void;
  readonly failNextNodeDestroy: (node: StubNode) => void;
  readonly loadedBundlePaths: string[];
  readonly resetAudioStub: () => void;
  readonly resolveClipLoad: () => void;
  readonly setNextClipLoadResult: (
    result: 'error' | 'incomplete' | 'missing' | 'success',
  ) => void;
};

const {
  GN_STYLE_BACKGROUND_MUSIC_AUDIO_PATH,
  GnStyleBackgroundMusicPresenter,
} = await import(
  '../../../game/assets/scripts/creator/gn-style-background-music-presenter.ts'
);

interface StubAudioClip {
  readonly canonicalBundlePath: string;
}

interface StubAudioSource {
  clip: StubAudioClip | null;
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
  readonly children: StubNode[];
  readonly destroyed: boolean;
  readonly name: string;
  readonly parent: StubNode | null;
  destroy(): void;
}

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SOURCE = readFileSync(
  `${REPOSITORY_ROOT}/game/assets/scripts/creator/gn-style-background-music-presenter.ts`,
  'utf8',
);

test('loads only GangnamStyle.mp3 into one non-looping dedicated source', async () => {
  cc.resetAudioStub();
  const parent = new cc.Node('Parent');
  const presenter = await GnStyleBackgroundMusicPresenter.load(
    parent as never,
  );
  const source = cc.audioSources[0];
  assert.notEqual(source, undefined);

  assert.equal(
    GN_STYLE_BACKGROUND_MUSIC_AUDIO_PATH,
    'Sounds/GangnamStyle.mp3',
  );
  assert.deepEqual(cc.loadedBundlePaths, [
    canonicalResourceToBundlePath(GN_STYLE_BACKGROUND_MUSIC_AUDIO_PATH),
  ]);
  assert.equal(cc.audioSources.length, 1);
  assert.equal(source?.clip?.canonicalBundlePath, 'Sounds/GangnamStyle');
  assert.equal(source?.playOnAwake, false);
  assert.equal(source?.loop, false);
  assert.equal(source?.volume, 1);
  assert.deepEqual(parent.children.map(({ name }) => name), [
    'GnStyleBackgroundMusicRoot',
  ]);
  assert.doesNotMatch(SOURCE, /ClassicAudioPresenter|CrazyAudioPresenter/);
  assert.doesNotMatch(SOURCE, /gn-style-resource-loader/);

  assert.equal(presenter.dispose(), true);
  assert.equal(source?.clip, null);
  assert.equal(source?.node.destroyed, true);
});

test('play, pause, resume, stop, natural end, and disabled music are idempotent', async () => {
  cc.resetAudioStub();
  const parent = new cc.Node('Parent');
  const presenter = await GnStyleBackgroundMusicPresenter.load(
    parent as never,
  );
  const source = cc.audioSources[0];
  assert.notEqual(source, undefined);

  assert.equal(presenter.play(false), false);
  assert.equal(source?.playCalls, 0);
  assert.equal(presenter.play(true), true);
  assert.equal(presenter.play(true), false);
  assert.equal(source?.playCalls, 1);
  assert.equal(presenter.playing, true);

  assert.equal(presenter.pause(true), true);
  assert.equal(presenter.pause(true), false);
  assert.equal(source?.pauseCalls, 1);
  assert.equal(presenter.paused, true);
  assert.equal(presenter.resume(true), true);
  assert.equal(presenter.resume(true), false);
  assert.equal(source?.playCalls, 2);
  assert.equal(presenter.paused, false);

  assert.equal(presenter.pause(true), true);
  assert.equal(presenter.resume(false), true);
  assert.equal(source?.stopCalls, 1);
  assert.equal(presenter.playing, false);
  assert.equal(presenter.paused, false);
  assert.equal(presenter.stop(), false);

  assert.equal(presenter.play(true), true);
  source?.finish();
  assert.equal(presenter.playing, false);
  assert.equal(presenter.pause(true), false);
  assert.equal(presenter.resume(true), false);
  assert.equal(source?.playCalls, 3);

  assert.equal(presenter.play(true), true);
  assert.equal(presenter.stop(), true);
  assert.equal(presenter.stop(), false);
  assert.equal(source?.stopCalls, 2);
  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
  assert.equal(presenter.disposed, true);
  assert.throws(() => presenter.play(true), /owner is unavailable/);
  assert.equal(presenter.play(false), false);
});

test('all playback transitions and staged disposal remain retryable after faults', async () => {
  cc.resetAudioStub();
  const parent = new cc.Node('Parent');
  const presenter = await GnStyleBackgroundMusicPresenter.load(
    parent as never,
  );
  const source = cc.audioSources[0];
  assert.notEqual(source, undefined);

  cc.failNextAudioOperation(source!, 'play');
  assert.throws(() => presenter.play(true), /injected play failure/);
  assert.equal(presenter.playing, false);
  assert.equal(presenter.play(true), true);

  cc.failNextAudioOperation(source!, 'pause');
  assert.throws(() => presenter.pause(true), /injected pause failure/);
  assert.equal(presenter.paused, false);
  assert.equal(presenter.pause(true), true);

  cc.failNextAudioOperation(source!, 'play');
  assert.throws(() => presenter.resume(true), /injected play failure/);
  assert.equal(presenter.paused, true);
  assert.equal(presenter.resume(true), true);

  cc.failNextAudioOperation(source!, 'stop');
  assert.throws(() => presenter.stop(), /injected stop failure/);
  assert.equal(presenter.playing, true);
  assert.equal(presenter.stop(), true);

  cc.failNextAudioOperation(source!, 'clear-clip');
  assert.throws(() => presenter.dispose(), /injected clear-clip failure/);
  assert.equal(presenter.disposed, false);
  assert.equal(source?.node.destroyed, false);
  assert.equal(presenter.dispose(), true);
  assert.equal(source?.node.destroyed, true);

  cc.resetAudioStub();
  const destroyParent = new cc.Node('DestroyParent');
  const destroyPresenter = await GnStyleBackgroundMusicPresenter.load(
    destroyParent as never,
  );
  const destroySource = cc.audioSources[0];
  assert.notEqual(destroySource, undefined);
  cc.failNextNodeDestroy(destroySource!.node);
  assert.throws(() => destroyPresenter.dispose(), /injected destroy failure/);
  assert.equal(destroyPresenter.disposed, false);
  assert.equal(destroySource?.clip, null);
  assert.equal(destroyPresenter.dispose(), true);
});

test('failed preparation and parent destruction leave no hidden GN voice', async () => {
  cc.resetAudioStub();
  const duringLoad = new cc.Node('DuringLoad');
  cc.deferClipLoad();
  const loading = GnStyleBackgroundMusicPresenter.load(
    duringLoad as never,
  );
  await Promise.resolve();
  duringLoad.destroy();
  cc.resolveClipLoad();
  await assert.rejects(loading, /destroyed while loading/);
  assert.equal(cc.audioSources.length, 0);
  assert.equal(duringLoad.children.length, 0);

  cc.resetAudioStub();
  cc.setNextClipLoadResult('incomplete');
  const incomplete = new cc.Node('Incomplete');
  await assert.rejects(
    GnStyleBackgroundMusicPresenter.load(incomplete as never),
    /incomplete GN Style background-music batch/,
  );
  assert.equal(incomplete.children.length, 0);
  assert.equal(cc.audioSources.length, 0);

  cc.resetAudioStub();
  const attachment = new cc.Node('AttachmentFailure');
  cc.failNextChildAttachment(attachment);
  await assert.rejects(
    GnStyleBackgroundMusicPresenter.load(attachment as never),
    /injected child attachment failure/,
  );
  const failedSource = cc.audioSources[0];
  assert.notEqual(failedSource, undefined);
  assert.equal(failedSource?.playing, false);
  assert.equal(failedSource?.clip, null);
  assert.equal(failedSource?.node.destroyed, true);
  assert.equal(attachment.children.length, 0);

  cc.resetAudioStub();
  const ownerParent = new cc.Node('OwnerParent');
  const owner = await GnStyleBackgroundMusicPresenter.load(
    ownerParent as never,
  );
  const ownedSource = cc.audioSources[0];
  owner.play(true);
  ownerParent.destroy();
  assert.equal(ownedSource?.playing, false);
  assert.equal(ownedSource?.clip, null);
  assert.equal(owner.dispose(), true);
  assert.equal(owner.dispose(), false);
});
