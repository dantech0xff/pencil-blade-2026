import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const events = [];
export const createdFrames = [];
export const createdNodes = [];

let resetFailureFrameIndex = null;
let failNextSmokeDestroy = false;
let failNextSmokeSiblingPlacement = false;

export function resetStub() {
  events.length = 0;
  createdFrames.length = 0;
  createdNodes.length = 0;
  resetFailureFrameIndex = null;
  failNextSmokeDestroy = false;
  failNextSmokeSiblingPlacement = false;
}

export function setResetFailureFrameIndex(frameIndex) {
  resetFailureFrameIndex = frameIndex;
}

export function setFailNextSmokeDestroy(value) {
  failNextSmokeDestroy = value;
}

export function setFailNextSmokeSiblingPlacement(value) {
  failNextSmokeSiblingPlacement = value;
}

export class Rect {
  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
}

export class Size {
  constructor(width = 0, height = 0) {
    this.width = width;
    this.height = height;
  }
}

export class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
}

export class Texture2D {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.destroyed = false;
    this.destroyCalls = 0;
  }
  destroy() {
    this.destroyCalls += 1;
    this.destroyed = true;
  }
}

export class SpriteFrame {
  constructor(name = '') {
    this.name = name;
    this.destroyed = false;
    this.destroyCalls = 0;
    this.offset = new Vec2();
    this.originalSize = new Size();
    this.rect = new Rect();
    this.rotated = false;
    this.texture = null;
    createdFrames.push(this);
  }
  reset(info) {
    const match = /^StandardBombFuseSmokeFrame-(\\d+)$/.exec(this.name);
    if (match !== null && Number(match[1]) === resetFailureFrameIndex) {
      throw new Error('injected SpriteFrame reset failure');
    }
    this.texture = info.texture;
    this.originalSize = info.originalSize;
    this.rect = info.rect;
    this.offset = info.offset;
    this.rotated = info.isRotate;
  }
  destroy() {
    this.destroyCalls += 1;
    this.destroyed = true;
  }
}

export class UITransform {
  constructor() {
    this.contentSize = new Size();
    this.anchorPoint = new Vec2();
  }
  setContentSize(width, height) {
    this.contentSize = new Size(width, height);
  }
  setAnchorPoint(x, y) {
    this.anchorPoint = new Vec2(x, y);
  }
}

export class Sprite {
  static SizeMode = Object.freeze({ CUSTOM: 7 });
  constructor() {
    this.sizeMode = null;
    this.spriteFrame = null;
  }
}

export class Node {
  constructor(name = '') {
    this.name = name;
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyed = false;
    this.eulerAngles = { x: 0, y: 0, z: 0 };
    this.lastRequestedSiblingIndex = null;
    this.layer = 0;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
    createdNodes.push(this);
  }
  get activeInHierarchy() {
    return this.active && (this.parent === null || this.parent.activeInHierarchy);
  }
  get worldPosition() {
    if (this.parent === null) return { ...this.position };
    const parent = this.parent.worldPosition;
    return {
      x: parent.x + this.position.x,
      y: parent.y + this.position.y,
      z: parent.z + this.position.z,
    };
  }
  addComponent(Type) {
    const component = new Type();
    component.node = this;
    this.components.set(Type, component);
    return component;
  }
  getComponent(Type) {
    return this.components.get(Type) ?? null;
  }
  setPosition(x, y, z) {
    this.position = { x, y, z };
  }
  setWorldPosition(x, y, z) {
    const parent = this.parent === null
      ? { x: 0, y: 0, z: 0 }
      : this.parent.worldPosition;
    this.position = {
      x: x - parent.x,
      y: y - parent.y,
      z: z - parent.z,
    };
  }
  setRotationFromEuler(x, y, z) {
    this.eulerAngles = { x, y, z };
  }
  setParent(parent, keepWorldTransform = false) {
    const world = this.worldPosition;
    if (this.parent !== null) {
      const oldIndex = this.parent.children.indexOf(this);
      if (oldIndex >= 0) this.parent.children.splice(oldIndex, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
    if (keepWorldTransform) this.setWorldPosition(world.x, world.y, world.z);
    if (this.name.startsWith('StandardBombFuseSmoke-')) {
      events.push('parent:' + this.name);
    }
  }
  setSiblingIndex(index) {
    this.lastRequestedSiblingIndex = index;
    events.push('sibling:' + this.name + ':' + index);
    if (
      this.name.startsWith('StandardBombFuseSmoke-')
      && failNextSmokeSiblingPlacement
    ) {
      failNextSmokeSiblingPlacement = false;
      throw new Error('injected smoke sibling placement failure');
    }
    if (this.parent === null) return;
    const currentIndex = this.parent.children.indexOf(this);
    if (currentIndex >= 0) this.parent.children.splice(currentIndex, 1);
    const clampedIndex = Math.max(0, Math.min(index, this.parent.children.length));
    this.parent.children.splice(clampedIndex, 0, this);
  }
  destroy() {
    events.push('destroy:' + this.name);
    if (
      this.name.startsWith('StandardBombFuseSmoke-')
      && failNextSmokeDestroy
    ) {
      failNextSmokeDestroy = false;
      throw new Error('injected smoke destroy failure');
    }
    this.destroyed = true;
    this.active = false;
    this.setParent(null, true);
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
const {
  STANDARD_BOMB_FUSE_SMOKE_Z_ORDER,
  StandardBombFuseSmokeCleanupError,
  StandardBombFuseSmokePresenter,
} = await import(
  '../../../game/assets/scripts/creator/standard-bomb-fuse-smoke-presenter.ts'
);
const {
  STANDARD_BOMB_SMOKE_FRAME_SECONDS,
} = await import(
  '../../../game/assets/scripts/domain/standard-bomb-fuse-smoke-state.ts'
);

interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface StubTexture {
  destroyCalls: number;
  destroyed: boolean;
  height: number;
  width: number;
}

interface StubSpriteFrame {
  destroyCalls: number;
  destroyed: boolean;
  readonly name: string;
  readonly offset: Readonly<{ x: number; y: number }>;
  readonly originalSize: Readonly<{ width: number; height: number }>;
  readonly rect: Readonly<{ x: number; y: number; width: number; height: number }>;
  readonly rotated: boolean;
  readonly texture: StubTexture;
}

interface StubTransform {
  readonly anchorPoint: Readonly<{ x: number; y: number }>;
  readonly contentSize: Readonly<{ width: number; height: number }>;
  setContentSize(width: number, height: number): void;
}

interface StubSprite {
  readonly sizeMode: number;
  readonly spriteFrame: StubSpriteFrame;
}

interface StubNode {
  active: boolean;
  readonly activeInHierarchy: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  readonly eulerAngles: Readonly<{ x: number; y: number; z: number }>;
  lastRequestedSiblingIndex: number | null;
  layer: number;
  readonly name: string;
  readonly parent: StubNode | null;
  readonly position: Point3;
  readonly worldPosition: Point3;
  addComponent(Type: unknown): unknown;
  destroy(): void;
  getComponent(Type: unknown): unknown;
  setParent(parent: StubNode | null, keepWorldTransform?: boolean): void;
  setPosition(x: number, y: number, z: number): void;
  setRotationFromEuler(x: number, y: number, z: number): void;
}

interface CocosStub {
  readonly Node: new (name?: string) => StubNode;
  readonly Sprite: {
    readonly SizeMode: Readonly<{ CUSTOM: number }>;
    new (): StubSprite;
  };
  readonly SpriteFrame: new (name?: string) => StubSpriteFrame;
  readonly Texture2D: new (width: number, height: number) => StubTexture;
  readonly UITransform: new () => StubTransform;
  readonly createdFrames: StubSpriteFrame[];
  readonly createdNodes: StubNode[];
  readonly events: string[];
  resetStub(): void;
  setFailNextSmokeDestroy(value: boolean): void;
  setFailNextSmokeSiblingPlacement(value: boolean): void;
  setResetFailureFrameIndex(frameIndex: number | null): void;
}

interface LoadedSmokeFixture {
  readonly resource: {
    readonly canonicalPath: string;
    readonly dimensions: Readonly<{ width: number; height: number }>;
    readonly spriteFrame: StubSpriteFrame;
  };
  readonly sourceFrame: StubSpriteFrame;
  readonly texture: StubTexture;
}

class ScriptedRandom {
  readonly calls: Array<Readonly<{
    maximumInclusive: number;
    minimumInclusive: number;
  }>> = [];

  private nextDrawIndex = 0;
  private readonly draws: readonly number[];

  constructor(draws: readonly number[]) {
    this.draws = draws;
  }

  nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number {
    this.calls.push(Object.freeze({ maximumInclusive, minimumInclusive }));
    const value = this.draws[this.nextDrawIndex];
    if (value === undefined) {
      throw new Error('scripted random exhausted');
    }
    this.nextDrawIndex += 1;
    return value;
  }
}

function createLoadedSmoke(): LoadedSmokeFixture {
  const texture = new cc.Texture2D(1920, 256);
  const sourceFrame = new cc.SpriteFrame('LoadedBombSmokeAtlas');
  Object.assign(sourceFrame, {
    offset: { x: 0, y: 0 },
    originalSize: { width: 1920, height: 256 },
    rect: { x: 0, y: 0, width: 1920, height: 256 },
    rotated: false,
    texture,
  });
  return {
    resource: {
      canonicalPath: '480x800/Bomb/bombsmoke.png',
      dimensions: { width: 1920, height: 256 },
      spriteFrame: sourceFrame,
    },
    sourceFrame,
    texture,
  };
}

function createBomb(): Readonly<{
  bomb: Readonly<{ node: StubNode }>;
  node: StubNode;
  parent: StubNode;
}> {
  const parent = new cc.Node('WorldRoot');
  parent.layer = 23;
  parent.setPosition(100, 200, 2);

  const node = new cc.Node('ClassicGeneratedBomb-7');
  node.setParent(parent);
  node.setPosition(20, 30, 2);
  node.setRotationFromEuler(0, 0, 90);
  const transform = node.addComponent(cc.UITransform) as StubTransform;
  transform.setContentSize(80, 100);
  return Object.freeze({ bomb: Object.freeze({ node }), node, parent });
}

function generatedFrames(): StubSpriteFrame[] {
  return cc.createdFrames.filter((frame) => (
    frame.name.startsWith('StandardBombFuseSmokeFrame-')
  ));
}

function smokeNodes(): StubNode[] {
  return cc.createdNodes.filter((node) => (
    node.name.startsWith('StandardBombFuseSmoke-')
  ));
}

test('slices the shared atlas into exact row-major 15+15 frames without taking texture ownership', () => {
  cc.resetStub();
  const loaded = createLoadedSmoke();
  const bomb = createBomb();
  const presenter = StandardBombFuseSmokePresenter.create({
    bomb: bomb.bomb as never,
    random: new ScriptedRandom([1]),
    resource: loaded.resource as never,
  });

  const frames = generatedFrames();
  assert.equal(frames.length, 30);
  assert.deepEqual(
    [0, 14, 15, 29].map((index) => {
      const rect = frames[index]?.rect;
      return rect === undefined
        ? undefined
        : { height: rect.height, width: rect.width, x: rect.x, y: rect.y };
    }),
    [
      { x: 0, y: 0, width: 128, height: 128 },
      { x: 1792, y: 0, width: 128, height: 128 },
      { x: 0, y: 128, width: 128, height: 128 },
      { x: 1792, y: 128, width: 128, height: 128 },
    ],
  );
  for (const frame of frames) {
    assert.equal(frame.texture, loaded.texture);
    assert.deepEqual(
      { height: frame.originalSize.height, width: frame.originalSize.width },
      { height: 128, width: 128 },
    );
    assert.deepEqual(
      { x: frame.offset.x, y: frame.offset.y },
      { x: 0, y: 0 },
    );
    assert.equal(frame.rotated, false);
  }

  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
  assert.ok(frames.every((frame) => frame.destroyed && frame.destroyCalls === 1));
  assert.equal(loaded.sourceFrame.destroyed, false);
  assert.equal(loaded.sourceFrame.destroyCalls, 0);
  assert.equal(loaded.texture.destroyed, false);
  assert.equal(loaded.texture.destroyCalls, 0);
});

test('uses one gate and emits at the rotated fuse coordinate under the Bomb world parent', () => {
  cc.resetStub();
  const loaded = createLoadedSmoke();
  const bomb = createBomb();
  const random = new ScriptedRandom([0]);
  const presenter = StandardBombFuseSmokePresenter.create({
    bomb: bomb.bomb as never,
    random,
    resource: loaded.resource as never,
  });

  presenter.updateAction(0);

  const smoke = smokeNodes()[0];
  assert.ok(smoke);
  assert.equal(smoke.parent, bomb.parent);
  assert.notEqual(smoke.parent, bomb.node);
  assert.equal(smoke.layer, 23);
  assert.equal(smoke.lastRequestedSiblingIndex, STANDARD_BOMB_FUSE_SMOKE_Z_ORDER);
  assert.equal(smoke.active, true);
  assert.ok(Math.abs(smoke.worldPosition.x - 70) < 1e-9);
  assert.ok(Math.abs(smoke.worldPosition.y - 230) < 1e-9);
  assert.equal(smoke.worldPosition.z, 4);

  const transform = smoke.getComponent(cc.UITransform) as StubTransform;
  const sprite = smoke.getComponent(cc.Sprite) as StubSprite;
  assert.deepEqual(
    { height: transform.contentSize.height, width: transform.contentSize.width },
    { height: 128, width: 128 },
  );
  assert.deepEqual(
    { x: transform.anchorPoint.x, y: transform.anchorPoint.y },
    { x: 0.5, y: 0.5 },
  );
  assert.equal(sprite.sizeMode, cc.Sprite.SizeMode.CUSTOM);
  assert.equal(sprite.spriteFrame.name, 'StandardBombFuseSmokeFrame-0');
  assert.deepEqual(random.calls, [{
    maximumInclusive: 6,
    minimumInclusive: 0,
  }]);
  assert.deepEqual(presenter.snapshot(), {
    activeSmokeCount: 1,
    disposed: false,
    drained: false,
    stopped: false,
  });

  presenter.dispose();
});

test('advances every existing action before a successful gate emits a fresh frame-zero smoke', () => {
  cc.resetStub();
  const loaded = createLoadedSmoke();
  const bomb = createBomb();
  const random = new ScriptedRandom([0, 0, 0]);
  const presenter = StandardBombFuseSmokePresenter.create({
    bomb: bomb.bomb as never,
    random,
    resource: loaded.resource as never,
  });

  presenter.updateAction(0);
  presenter.updateAction(STANDARD_BOMB_SMOKE_FRAME_SECONDS);
  let smoke = smokeNodes();
  assert.equal(smoke.length, 2);
  assert.equal(
    (smoke[0]?.getComponent(cc.Sprite) as StubSprite).spriteFrame.name,
    'StandardBombFuseSmokeFrame-1',
  );
  assert.equal(
    (smoke[1]?.getComponent(cc.Sprite) as StubSprite).spriteFrame.name,
    'StandardBombFuseSmokeFrame-0',
  );

  cc.events.length = 0;
  presenter.updateAction(1);
  smoke = smokeNodes();
  assert.equal(smoke.length, 3);
  assert.equal(smoke[0]?.destroyed, true);
  assert.equal(smoke[1]?.destroyed, true);
  assert.equal(smoke[2]?.destroyed, false);
  assert.equal(
    (smoke[2]?.getComponent(cc.Sprite) as StubSprite).spriteFrame.name,
    'StandardBombFuseSmokeFrame-0',
  );
  assert.deepEqual(cc.events.slice(0, 4), [
    'destroy:StandardBombFuseSmoke-1',
    'parent:StandardBombFuseSmoke-1',
    'destroy:StandardBombFuseSmoke-2',
    'parent:StandardBombFuseSmoke-2',
  ]);
  const firstNewAttachment = cc.events.indexOf('parent:StandardBombFuseSmoke-3');
  const secondOldDestroy = cc.events.indexOf('destroy:StandardBombFuseSmoke-2');
  assert.ok(firstNewAttachment > secondOldDestroy);
  assert.equal(random.calls.length, 3);
  assert.equal(presenter.snapshot().activeSmokeCount, 1);

  presenter.dispose();
});

test('stop prevents Bomb inspection and shared-RNG draws while existing smoke drains independently', () => {
  cc.resetStub();
  const loaded = createLoadedSmoke();
  const bomb = createBomb();
  const random = new ScriptedRandom([0]);
  const presenter = StandardBombFuseSmokePresenter.create({
    bomb: bomb.bomb as never,
    random,
    resource: loaded.resource as never,
  });

  presenter.updateAction(0);
  assert.equal(presenter.stopEmitting(), true);
  assert.equal(presenter.stopEmitting(), false);
  bomb.node.destroy();
  presenter.updateAction(1);

  assert.equal(random.calls.length, 1);
  assert.equal(smokeNodes()[0]?.destroyed, true);
  assert.deepEqual(presenter.snapshot(), {
    activeSmokeCount: 0,
    disposed: false,
    drained: true,
    stopped: true,
  });
  presenter.dispose();
});

test('rolls back partial frame slicing and leaves the loaded source atlas alive', () => {
  cc.resetStub();
  const loaded = createLoadedSmoke();
  const bomb = createBomb();
  cc.setResetFailureFrameIndex(4);

  assert.throws(
    () => StandardBombFuseSmokePresenter.create({
      bomb: bomb.bomb as never,
      random: new ScriptedRandom([0]),
      resource: loaded.resource as never,
    }),
    /injected SpriteFrame reset failure/,
  );
  const frames = generatedFrames();
  assert.equal(frames.length, 5);
  assert.ok(frames.every((frame) => frame.destroyed));
  assert.equal(loaded.sourceFrame.destroyed, false);
  assert.equal(loaded.texture.destroyed, false);
});

test('retains failed emission cleanup for explicit teardown retry before destroying frames', () => {
  cc.resetStub();
  const loaded = createLoadedSmoke();
  const bomb = createBomb();
  const presenter = StandardBombFuseSmokePresenter.create({
    bomb: bomb.bomb as never,
    random: new ScriptedRandom([0]),
    resource: loaded.resource as never,
  });
  cc.setFailNextSmokeSiblingPlacement(true);
  cc.setFailNextSmokeDestroy(true);

  assert.throws(
    () => presenter.updateAction(0),
    (error: unknown) => {
      assert.ok(error instanceof StandardBombFuseSmokeCleanupError);
      assert.match(error.message, /rollback was incomplete/);
      return true;
    },
  );
  assert.equal(presenter.snapshot().activeSmokeCount, 0);
  assert.equal(smokeNodes()[0]?.destroyed, false);
  assert.ok(generatedFrames().every((frame) => !frame.destroyed));

  assert.equal(presenter.dispose(), true);
  assert.equal(smokeNodes()[0]?.destroyed, true);
  assert.ok(generatedFrames().every((frame) => frame.destroyed));
  assert.equal(loaded.sourceFrame.destroyed, false);
  assert.equal(loaded.texture.destroyed, false);
});

test('validates atlas identity and scheduled action deltas', () => {
  cc.resetStub();
  const loaded = createLoadedSmoke();
  const bomb = createBomb();
  const wrongResource = {
    ...loaded.resource,
    canonicalPath: '480x800/Bomb/bomb.png',
  };
  assert.throws(
    () => StandardBombFuseSmokePresenter.create({
      bomb: bomb.bomb as never,
      random: new ScriptedRandom([0]),
      resource: wrongResource as never,
    }),
    /bombsmoke\.png atlas/,
  );

  const presenter = StandardBombFuseSmokePresenter.create({
    bomb: bomb.bomb as never,
    random: new ScriptedRandom([1]),
    resource: loaded.resource as never,
  });
  assert.throws(() => presenter.updateAction(-0.001), /finite and non-negative/);
  assert.throws(() => presenter.updateAction(Number.NaN), /finite and non-negative/);
  assert.equal(presenter.snapshot().activeSmokeCount, 0);
  presenter.dispose();
});
