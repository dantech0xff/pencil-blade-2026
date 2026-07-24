import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  canonicalResourceToBundlePath,
} from '../../../game/assets/scripts/domain/game-resource-contract.ts';

const SOURCE = readFileSync(
  fileURLToPath(new URL(
    '../../../game/assets/scripts/creator/time-manager-audio-presenter.ts',
    import.meta.url,
  )),
  'utf8',
);

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
  const selected = result === 'incomplete' ? paths.slice(0, -1) : paths;
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
        const retained = this.listeners.get(event) ?? [];
        const index = retained.indexOf(listener);
        if (index >= 0) retained.splice(index, 1);
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

const cc = await import('cc') as unknown as {
  readonly AudioSource: new () => StubAudioSource;
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
  readonly loadedBundlePaths: string[];
  readonly resetAudioStub: () => void;
  readonly resolveClipLoad: () => void;
  readonly setNextClipLoadResult: (
    result: 'error' | 'incomplete' | 'missing' | 'success',
  ) => void;
};

const {
  TIME_MANAGER_AUDIO_PATHS,
  TimeManagerAudioPresenter,
} = await import(
  '../../../game/assets/scripts/creator/time-manager-audio-presenter.ts'
);

interface StubAudioClip {
  readonly canonicalBundlePath: string;
}

interface StubAudioSource {
  clip: StubAudioClip | null;
  readonly failures: Map<string, number>;
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

test('Set snapshots use Array.from before Creator loose-build iteration', () => {
  assert.equal(SOURCE.split('Array.from(this.voices)').length - 1, 4);
  assert.equal(SOURCE.includes('[...this.voices]'), false);
});

test('loads exactly the two shared clips and preserves overlapping one-shot semantics', async () => {
  cc.resetAudioStub();
  const parent = new cc.Node('Parent');
  const presenter = await TimeManagerAudioPresenter.load(parent as never);

  assert.deepEqual(
    cc.loadedBundlePaths,
    TIME_MANAGER_AUDIO_PATHS.map(canonicalResourceToBundlePath),
  );
  assert.deepEqual(TIME_MANAGER_AUDIO_PATHS, [
    'Sounds/timetick.wav',
    'Sounds/timeup.wav',
  ]);
  assert.deepEqual(parent.children.map(({ name }) => name), [
    'TimeManagerAudioRoot',
  ]);

  presenter.playOneShot('Sounds/timetick.wav');
  presenter.playOneShot('Sounds/timeup.wav');
  const tick = cc.audioSources[0];
  const timeUp = cc.audioSources[1];
  assert.notEqual(tick, undefined);
  assert.notEqual(timeUp, undefined);
  assert.notEqual(tick, timeUp);
  assert.equal(tick?.clip?.canonicalBundlePath, 'Sounds/timetick');
  assert.equal(timeUp?.clip?.canonicalBundlePath, 'Sounds/timeup');
  assert.equal(tick?.playOnAwake, false);
  assert.equal(tick?.loop, false);
  assert.equal(tick?.volume, 1);

  tick?.finish();
  assert.equal(tick?.node.destroyed, true);
  assert.equal(timeUp?.node.destroyed, false);
  presenter.stopAllEffects();
  presenter.stopAllEffects();
  assert.equal(timeUp?.stopCalls, 1);
  assert.equal(timeUp?.clip, null);
  assert.equal(timeUp?.node.destroyed, true);
  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
  assert.equal(parent.children.length, 0);
});

test('pause lease is idempotent and immediately covers voices created while paused', async () => {
  cc.resetAudioStub();
  const parent = new cc.Node('Parent');
  const presenter = await TimeManagerAudioPresenter.load(parent as never);
  presenter.playOneShot('Sounds/timetick.wav');
  const first = cc.audioSources[0];
  assert.notEqual(first, undefined);

  presenter.pauseAllEffects();
  presenter.pauseAllEffects();
  assert.equal(first?.pauseCalls, 1);
  assert.equal(first?.paused, true);

  presenter.playOneShot('Sounds/timeup.wav');
  const second = cc.audioSources[1];
  assert.notEqual(second, undefined);
  assert.equal(second?.playCalls, 1);
  assert.equal(second?.pauseCalls, 1);
  assert.equal(second?.paused, true);

  presenter.resumeAllEffects();
  presenter.resumeAllEffects();
  assert.equal(first?.playCalls, 2);
  assert.equal(second?.playCalls, 2);
  assert.equal(first?.paused, false);
  assert.equal(second?.paused, false);
  presenter.dispose();
});

test('voice creation and lease operations remain retryable after injected failures', async () => {
  cc.resetAudioStub();
  const parent = new cc.Node('Parent');
  const presenter = await TimeManagerAudioPresenter.load(parent as never);

  presenter.playOneShot('Sounds/timetick.wav');
  const first = cc.audioSources[0];
  assert.notEqual(first, undefined);
  cc.failNextAudioOperation(first!, 'pause');
  assert.throws(() => presenter.pauseAllEffects(), /injected pause failure/);
  presenter.pauseAllEffects();
  assert.equal(first?.paused, true);

  cc.failNextAudioOperation(first!, 'play');
  assert.throws(() => presenter.resumeAllEffects(), /injected play failure/);
  presenter.resumeAllEffects();
  assert.equal(first?.paused, false);

  cc.failNextAudioOperation(first!, 'stop');
  assert.throws(() => presenter.stopAllEffects(), /injected stop failure/);
  assert.equal(first?.node.destroyed, false);
  presenter.stopAllEffects();
  assert.equal(first?.node.destroyed, true);
  presenter.dispose();
});

test('load failures never retain an attached owner or live voice', async () => {
  cc.resetAudioStub();
  const duringLoad = new cc.Node('DuringLoad');
  cc.deferClipLoad();
  const loading = TimeManagerAudioPresenter.load(duringLoad as never);
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
    TimeManagerAudioPresenter.load(incomplete as never),
    /incomplete TimeManager audio batch/,
  );
  assert.equal(incomplete.children.length, 0);

  cc.resetAudioStub();
  const attachment = new cc.Node('AttachmentFailure');
  cc.failNextChildAttachment(attachment);
  await assert.rejects(
    TimeManagerAudioPresenter.load(attachment as never),
    /injected child attachment failure/,
  );
  assert.equal(attachment.children.length, 0);
  assert.equal(
    cc.createdNodes
      .filter(({ name }) => name === 'TimeManagerAudioRoot')
      .every(({ destroyed }) => destroyed),
    true,
  );
});
