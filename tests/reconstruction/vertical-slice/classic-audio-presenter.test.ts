import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

import {
  CLASSIC_CORE_AUDIO_PATHS,
  CLASSIC_ELECTRIC_BOMB_HIT_AUDIO_PATH,
  CLASSIC_ORDINARY_BOMB_AUDIO_PATHS,
  CLASSIC_TOSS_AUDIO_PATH,
} from '../../../game/assets/scripts/domain/classic-audio-contract.ts';
import { canonicalResourceToBundlePath } from '../../../game/assets/scripts/domain/classic-resource-contract.ts';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const audioSources = [];
export const createdNodes = [];
export const loadedBundlePaths = [];

export function resetAudioStub() {
  audioSources.length = 0;
  createdNodes.length = 0;
  loadedBundlePaths.length = 0;
}

export class AudioClip {
  constructor(canonicalBundlePath = '') { this.canonicalBundlePath = canonicalBundlePath; }
}

export class AudioSource {
  constructor() {
    this.clip = null;
    this.destroyed = false;
    this.loop = true;
    this.node = null;
    this.oneShots = [];
    this.playCalls = 0;
    this.playOnAwake = true;
    this.stopCalls = 0;
    this.volume = 0;
    audioSources.push(this);
  }
  play() { this.playCalls += 1; }
  playOneShot(clip, volumeScale) { this.oneShots.push({ clip, volumeScale }); }
  stop() { this.stopCalls += 1; }
}

export class SpriteFrame {}
export const AssetManager = Object.freeze({});

const bundle = Object.freeze({
  load(paths, Type, callback) {
    loadedBundlePaths.push(...paths);
    callback(null, paths.map((path) => new Type(path)));
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
  setParent(parent) {
    if (this.parent !== null) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
  }
  destroy() {
    this.destroyed = true;
    this.active = false;
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
  readonly oneShots: readonly {
    readonly clip: StubAudioClip;
    readonly volumeScale: number;
  }[];
  readonly playCalls: number;
  readonly playOnAwake: boolean;
  readonly stopCalls: number;
  readonly volume: number;
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
  readonly audioSources: StubAudioSource[];
  readonly createdNodes: StubNode[];
  readonly loadedBundlePaths: string[];
  readonly resetAudioStub: () => void;
}

test('preload requests the exact core batch including only ordinary bomb clips', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await ClassicAudioPresenter.load(root as never);

  assert.deepEqual(
    cc.loadedBundlePaths,
    CLASSIC_CORE_AUDIO_PATHS.map(canonicalResourceToBundlePath),
  );
  assert.equal(cc.loadedBundlePaths.length, 23);
  assert.equal(
    cc.loadedBundlePaths.includes(
      canonicalResourceToBundlePath(CLASSIC_ELECTRIC_BOMB_HIT_AUDIO_PATH),
    ),
    false,
  );
  assert.equal(cc.audioSources.length, 1);
  assert.equal(cc.audioSources[0]?.loop, false);
  assert.equal(cc.audioSources[0]?.volume, 1);
  presenter.stop();
});

test('retained voices stop and dispose independently from shared one-shots', async () => {
  cc.resetAudioStub();
  const root = new cc.Node('Root');
  const presenter = await ClassicAudioPresenter.load(root as never);
  const shared = cc.audioSources[0];
  assert.notEqual(shared, undefined);

  presenter.playOneShot(CLASSIC_TOSS_AUDIO_PATH);
  const first = presenter.playRetained(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.entry);
  const second = presenter.playRetained(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.entry);
  const firstVoice = cc.audioSources[1];
  const secondVoice = cc.audioSources[2];
  assert.notEqual(firstVoice, undefined);
  assert.notEqual(secondVoice, undefined);
  assert.notEqual(firstVoice, secondVoice);
  assert.notEqual(firstVoice, shared);
  assert.equal(firstVoice?.playCalls, 1);
  assert.equal(secondVoice?.playCalls, 1);
  assert.equal(firstVoice?.clip?.canonicalBundlePath, 'Sounds/boomsound');
  assert.equal(secondVoice?.clip?.canonicalBundlePath, 'Sounds/boomsound');

  first.stop();
  first.stop();
  assert.equal(first.stopped, true);
  assert.equal(first.disposed, false);
  assert.equal(firstVoice?.stopCalls, 1);
  assert.equal(secondVoice?.stopCalls, 0);
  assert.equal(shared?.stopCalls, 0);

  presenter.playOneShot(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.explosion);
  assert.deepEqual(
    shared?.oneShots.map(({ clip }) => clip.canonicalBundlePath),
    ['Sounds/tossfruit', 'Sounds/boomexplosion'],
  );

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
  assert.equal(shared?.stopCalls, 1);
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
  assert.equal(root.children.length, 0);

  root.destroy();
  assert.throws(
    () => presenter.playRetained(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS.entry),
    /parent is no longer valid/,
  );
});
