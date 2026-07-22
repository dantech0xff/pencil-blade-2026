import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

import {
  getClassicBombResource,
  type ClassicRasterResource,
} from '../../../game/assets/scripts/domain/classic-resource-contract.ts';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
}

export class Size {
  constructor(width = 0, height = 0) { this.width = width; this.height = height; }
}

export class SpriteFrame {
  constructor(width, height) {
    this.originalSize = new Size(width, height);
    this.rect = { width, height };
    this.destroyed = false;
  }
}

export class UITransform {
  constructor() {
    this.contentSize = new Size();
    this.anchorPoint = new Vec2();
  }
  setContentSize(width, height) { this.contentSize = new Size(width, height); }
  setAnchorPoint(x, y) { this.anchorPoint = new Vec2(x, y); }
}

export class Sprite {
  constructor() { this.sizeMode = 0; this.spriteFrame = null; }
}
Sprite.SizeMode = Object.freeze({ CUSTOM: 2 });

export class RigidBody2D {
  constructor() {
    this.type = 0;
    this.allowSleep = false;
    this.awakeOnLoad = false;
    this.bullet = true;
    this.fixedRotation = true;
    this.gravityScale = 0;
    this.linearDamping = -1;
    this.angularDamping = -1;
    this.linearVelocity = new Vec2();
    this.angularVelocity = 0;
    this.group = 0;
  }
}

export class CircleCollider2D {
  constructor() {
    this.radius = 0;
    this.offset = new Vec2();
    this.density = 0;
    this.friction = 0;
    this.restitution = 0;
    this.sensor = true;
    this.group = 0;
    this.tag = -1;
  }
}

export class Node {
  constructor(name = '') {
    this.name = name;
    this.active = true;
    this.destroyed = false;
    this.layer = 0;
    this.parent = null;
    this.children = [];
    this.position = { x: 0, y: 0, z: 0 };
    this.eulerAngles = { x: 0, y: 0, z: 0 };
    this.components = new Map();
    this.lastRequestedSiblingIndex = null;
  }
  get activeInHierarchy() {
    return this.active && (this.parent === null || this.parent.activeInHierarchy);
  }
  get worldPosition() {
    if (this.parent === null) return this.position;
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
  getComponent(Type) { return this.components.get(Type) ?? null; }
  setPosition(x, y, z) { this.position = { x, y, z }; }
  setWorldPosition(x, y, z) {
    const parent = this.parent === null ? { x: 0, y: 0, z: 0 } : this.parent.worldPosition;
    this.position = { x: x - parent.x, y: y - parent.y, z: z - parent.z };
  }
  setRotationFromEuler(x, y, z) { this.eulerAngles = { x, y, z }; }
  setParent(parent, keepWorldTransform = false) {
    const world = this.worldPosition;
    if (this.parent !== null) {
      const previousIndex = this.parent.children.indexOf(this);
      if (previousIndex >= 0) this.parent.children.splice(previousIndex, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
    if (keepWorldTransform) this.setWorldPosition(world.x, world.y, world.z);
  }
  setSiblingIndex(index) { this.lastRequestedSiblingIndex = index; }
  destroy() {
    this.destroyed = true;
    this.active = false;
    this.setParent(null, true);
  }
}

export const ERigidBody2DType = Object.freeze({ Dynamic: 2 });
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
  CLASSIC_GENERATED_BOMB_Z_ORDER,
  TARGET_CLASSIC_BOMB_COLLIDER_TAG,
  ClassicGeneratedBomb,
} = await import('../../../game/assets/scripts/creator/classic-generated-bomb.ts');

interface CocosStub {
  readonly ERigidBody2DType: Readonly<{ Dynamic: number }>;
  readonly Node: new (name?: string) => StubNode;
  readonly SpriteFrame: new (width: number, height: number) => StubSpriteFrame;
  readonly UITransform: new () => StubTransform;
  readonly isValid: (value: unknown) => boolean;
}

interface StubNode {
  active: boolean;
  children: StubNode[];
  destroyed: boolean;
  readonly eulerAngles: Readonly<{ x: number; y: number; z: number }>;
  lastRequestedSiblingIndex: number | null;
  layer: number;
  readonly name: string;
  readonly parent: StubNode | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly worldPosition: Readonly<{ x: number; y: number; z: number }>;
  getComponent<T>(Type: new () => T): T | null;
  setPosition(x: number, y: number, z: number): void;
}

interface StubSpriteFrame {
  destroyed: boolean;
  readonly originalSize: Readonly<{ height: number; width: number }>;
  readonly rect: Readonly<{ height: number; width: number }>;
}

interface StubTransform {
  readonly anchorPoint: Readonly<{ x: number; y: number }>;
  readonly contentSize: Readonly<{ height: number; width: number }>;
}

interface LoadedBombVisual extends ClassicRasterResource {
  readonly spriteFrame: StubSpriteFrame;
}

interface DeferredLifecycle {
  readonly callbacks: Array<() => void>;
  readonly cuts: Array<{
    readonly entityOccurrenceId: number;
    readonly targetId: string;
    readonly worldPosition: Readonly<{ x: number; y: number }>;
  }>;
  readonly disposals: Array<{
    readonly entityOccurrenceId: number;
    readonly reason: unknown;
    readonly targetId: string;
  }>;
  readonly lifecycle: {
    readonly callAfterStep: (mutation: () => void) => void;
    readonly onBeforeFreeze: (event: {
      readonly entityOccurrenceId: number;
      readonly targetId: string;
      readonly worldPosition: Readonly<{ x: number; y: number }>;
    }) => void;
    readonly onCut: (event: {
      readonly entityOccurrenceId: number;
      readonly targetId: string;
      readonly worldPosition: Readonly<{ x: number; y: number }>;
    }) => void;
    readonly onDisposed: (event: {
      readonly entityOccurrenceId: number;
      readonly reason: unknown;
      readonly targetId: string;
    }) => void;
  };
}

test('standard bomb uses exact rasters, anchor, stable identifiers, body, fixture, and attach order', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    const visual = createLoadedBombVisual(assetTree);
    const deferred = createDeferredLifecycle();
    const bomb = ClassicGeneratedBomb.create(
      createCommand(assetTree === '480x800' ? 17 : 18),
      visual as never,
      deferred.lifecycle,
    );
    const expectedRadius = Math.fround((4 * visual.dimensions.width) / 11);
    const transform = (bomb.node as unknown as StubNode).getComponent(cc.UITransform);
    assert.ok(transform);

    assert.equal(bomb.bombId, 0);
    assert.equal(bomb.nodeName, `ClassicGeneratedBomb-${bomb.entityOccurrenceId}`);
    assert.equal(bomb.node.name, bomb.nodeName);
    assert.equal(bomb.targetId, `classic-bomb:${bomb.entityOccurrenceId}`);
    assert.equal(bomb.node.active, false);
    assert.deepEqual(size(transform.contentSize), visual.dimensions);
    assert.deepEqual(vector(transform.anchorPoint), { x: 0.5, y: 0.4 });
    assert.equal(bomb.sprite.spriteFrame, visual.spriteFrame);
    assert.equal(bomb.body.type, cc.ERigidBody2DType.Dynamic);
    assert.equal(bomb.body.allowSleep, true);
    assert.equal(bomb.body.awakeOnLoad, true);
    assert.equal(bomb.body.bullet, false);
    assert.equal(bomb.body.fixedRotation, false);
    assert.equal(bomb.body.gravityScale, 1);
    assert.equal(bomb.body.linearDamping, 0);
    assert.equal(bomb.body.angularDamping, 0);
    assert.deepEqual(vector(bomb.body.linearVelocity), { x: 0, y: 0 });
    assert.equal(bomb.body.angularVelocity, 0);
    assert.equal(bomb.body.group, 0x0002);
    assert.equal(bomb.collider.radius, expectedRadius);
    assert.deepEqual(vector(bomb.collider.offset), { x: 0, y: 0 });
    assert.equal(bomb.collider.density, 1);
    assert.equal(bomb.collider.friction, Math.fround(0.2));
    assert.equal(bomb.collider.restitution, 0);
    assert.equal(bomb.collider.sensor, false);
    assert.equal(bomb.collider.group, 0x0002);
    assert.equal(bomb.collider.tag, TARGET_CLASSIC_BOMB_COLLIDER_TAG);
    assert.deepEqual(bomb.collisionFilter, {
      categoryBits: 0x0002,
      groupIndex: 0,
      maskBits: 0x0001,
    });

    bomb.setTransform({ x: 2, y: 3 }, 0);
    bomb.setLinearVelocity({ x: -4, y: 5 });
    bomb.setAngularVelocity(6);
    assert.deepEqual(vector((bomb.node as unknown as StubNode).worldPosition), { x: 64, y: 96 });
    assert.deepEqual(vector(bomb.body.linearVelocity), { x: -4, y: 5 });
    assert.equal(bomb.body.angularVelocity, 6);

    const parent = new cc.Node('Parent');
    parent.layer = 19;
    parent.setPosition(10, 20, 0);
    bomb.attach(parent as never, CLASSIC_GENERATED_BOMB_Z_ORDER);
    assert.equal(bomb.attached, true);
    assert.equal(bomb.node.active, true);
    assert.equal(bomb.node.layer, 19);
    assert.equal((bomb.node as unknown as StubNode).lastRequestedSiblingIndex, 1);
    assert.deepEqual(vector((bomb.node as unknown as StubNode).worldPosition), { x: 64, y: 96 });
    assert.deepEqual(bomb.snapshot(), {
      bodyWorldPosition: { x: 64, y: 96 },
      cutDisabled: false,
      id: bomb.targetId,
      isFruit: false,
      nodeTag: TARGET_CLASSIC_BOMB_COLLIDER_TAG,
    });
  }
});

test('first cut guards repeats before callback, freezes motion, and waits for afterBombHit finish', () => {
  const deferred = createDeferredLifecycle();
  const cutOrder: string[] = [];
  const bomb = ClassicGeneratedBomb.create(
    createCommand(41),
    createLoadedBombVisual('480x800') as never,
    {
      ...deferred.lifecycle,
      onBeforeFreeze(event) {
        cutOrder.push('stop-retained-handles');
        assert.deepEqual(vector(bomb.body.linearVelocity), { x: 4, y: 12 });
        assert.equal(bomb.body.angularVelocity, -8);
        deferred.lifecycle.onBeforeFreeze(event);
      },
      onCut(event) {
        cutOrder.push('explosion-handoff');
        assert.equal(bomb.cutDisabled, true);
        assert.deepEqual(vector(bomb.body.linearVelocity), { x: 0, y: 0 });
        assert.equal(bomb.body.angularVelocity, 0);
        deferred.lifecycle.onCut(event);
      },
    },
  );
  const parent = new cc.Node('Parent');
  bomb.setTransform({ x: 7, y: 9 }, 0);
  bomb.setLinearVelocity({ x: 4, y: 12 });
  bomb.setAngularVelocity(-8);
  bomb.attach(parent as never, 1);
  const segment = { start: { x: 1, y: 2 }, end: { x: 3, y: 4 } };

  assert.equal(bomb.cut(segment), true);
  segment.start.x = 999;
  assert.equal(bomb.cut(null as never), false);
  assert.equal(deferred.cuts.length, 1);
  assert.deepEqual(cutOrder, ['stop-retained-handles', 'explosion-handoff']);
  assert.deepEqual(deferred.cuts[0], {
    entityOccurrenceId: 41,
    targetId: 'classic-bomb:41',
    worldPosition: { x: 224, y: 288 },
  });
  assert.equal(deferred.callbacks.length, 0);
  assert.equal(cc.isValid(bomb.node), true);
  assert.equal(bomb.snapshot().cutDisabled, true);

  assert.equal(bomb.finishAfterBombHit(), true);
  assert.equal(bomb.finishAfterBombHit(), false);
  assert.equal(deferred.callbacks.length, 1);
  assert.equal(cc.isValid(bomb.node), true);
  flushDeferred(deferred);
  assert.equal(cc.isValid(bomb.node), false);
  assert.equal(bomb.attached, false);
  assert.deepEqual(deferred.disposals, [{
    entityOccurrenceId: 41,
    reason: 'after-bomb-hit',
    targetId: 'classic-bomb:41',
  }]);
});

test('throwing cut handoff keeps the one-shot guard and defers fail-closed disposal', () => {
  const deferred = createDeferredLifecycle();
  const handoffFailure = new Error('explosion handoff failed');
  const bomb = ClassicGeneratedBomb.create(
    createCommand(42),
    createLoadedBombVisual('480x800') as never,
    {
      ...deferred.lifecycle,
      onCut() {
        throw handoffFailure;
      },
    },
  );
  bomb.setLinearVelocity({ x: 4, y: 5 });
  bomb.setAngularVelocity(6);
  bomb.attach(new cc.Node('Parent') as never, 1);

  assert.throws(
    () => bomb.cut({ start: { x: 1, y: 2 }, end: { x: 3, y: 4 } }),
    (error) => error === handoffFailure,
  );
  assert.equal(bomb.cutDisabled, true);
  assert.equal(bomb.disposalQueued, true);
  assert.deepEqual(vector(bomb.body.linearVelocity), { x: 0, y: 0 });
  assert.equal(bomb.body.angularVelocity, 0);
  assert.equal(bomb.cut(null as never), false);
  assert.equal(deferred.callbacks.length, 1);

  flushDeferred(deferred);
  assert.equal(cc.isValid(bomb.node), false);
  assert.deepEqual(deferred.disposals.map(({ reason }) => reason), ['cut-handoff-failed']);
});

test('throwing pre-freeze hook still freezes motion and defers fail-closed disposal', () => {
  const deferred = createDeferredLifecycle();
  const stopFailure = new Error('retained handle stop failed');
  const bomb = ClassicGeneratedBomb.create(
    createCommand(43),
    createLoadedBombVisual('480x800') as never,
    {
      ...deferred.lifecycle,
      onBeforeFreeze() {
        throw stopFailure;
      },
    },
  );
  bomb.setLinearVelocity({ x: -7, y: 8 });
  bomb.setAngularVelocity(-9);
  bomb.attach(new cc.Node('Parent') as never, 1);

  assert.throws(
    () => bomb.cut({ start: { x: 1, y: 2 }, end: { x: 3, y: 4 } }),
    (error) => error === stopFailure,
  );
  assert.equal(bomb.cutDisabled, true);
  assert.equal(bomb.disposalQueued, true);
  assert.deepEqual(vector(bomb.body.linearVelocity), { x: 0, y: 0 });
  assert.equal(bomb.body.angularVelocity, 0);
  assert.equal(deferred.cuts.length, 0);
  assert.equal(deferred.callbacks.length, 1);

  flushDeferred(deferred);
  assert.equal(cc.isValid(bomb.node), false);
  assert.deepEqual(deferred.disposals.map(({ reason }) => reason), ['cut-handoff-failed']);
});

test('moving bomb bounds defer idempotent disposal without a fruit-miss callback', () => {
  const deferred = createDeferredLifecycle();
  const bomb = ClassicGeneratedBomb.create(
    createCommand(55),
    createLoadedBombVisual('720x1280') as never,
    deferred.lifecycle,
  );
  bomb.setTransform({ x: 0, y: -9 }, 0);
  bomb.setLinearVelocity({ x: 1, y: -1 });
  bomb.attach(new cc.Node('Parent') as never, 1);

  assert.deepEqual(bomb.evaluateBounds({ width: 720, height: 1280 }), [
    { type: 'defer-dispose', boundary: 'below' },
  ]);
  assert.equal(bomb.disposalQueued, true);
  assert.equal(deferred.cuts.length, 0);
  assert.equal(deferred.callbacks.length, 1);
  assert.deepEqual(bomb.evaluateBounds({ width: 720, height: 1280 }), []);
  assert.equal(cc.isValid(bomb.node), true);
  flushDeferred(deferred);
  assert.deepEqual(deferred.disposals, [{
    entityOccurrenceId: 55,
    reason: { type: 'bounds', boundary: 'below' },
    targetId: 'classic-bomb:55',
  }]);

  const stationary = ClassicGeneratedBomb.create(
    createCommand(56),
    createLoadedBombVisual('480x800') as never,
    createDeferredLifecycle().lifecycle,
  );
  stationary.setTransform({ x: 100, y: -100 }, 0);
  assert.deepEqual(stationary.evaluateBounds({ width: 480, height: 800 }), []);
  assert.equal(stationary.disposalQueued, false);
});

test('creation and spawn mutations reject unsupported bombs, rasters, callbacks, and order', () => {
  const visual = createLoadedBombVisual('480x800');
  const lifecycle = createDeferredLifecycle().lifecycle;
  assert.throws(
    () => ClassicGeneratedBomb.create({
      type: 'create-bomb', entityOccurrenceId: 1, tossType: 1, bombId: 1,
    } as never, visual as never, lifecycle),
    /standard create-bomb ID 0/,
  );
  assert.throws(
    () => ClassicGeneratedBomb.create(createCommand(0) as never, visual as never, lifecycle),
    /positive safe integer/,
  );
  assert.throws(
    () => ClassicGeneratedBomb.create(createCommand(1), {
      ...visual,
      canonicalPath: '480x800/Bomb/bomb_10.png',
    } as never, lifecycle),
    /exact Bomb\/bomb_X\.png/,
  );
  assert.throws(
    () => ClassicGeneratedBomb.create(createCommand(1), {
      ...visual,
      dimensions: { width: 81, height: 108 },
    } as never, lifecycle),
    /dimensions must match/,
  );
  const destroyedFrame = new cc.SpriteFrame(80, 108);
  destroyedFrame.destroyed = true;
  assert.throws(
    () => ClassicGeneratedBomb.create(createCommand(1), {
      ...visual,
      spriteFrame: destroyedFrame,
    } as never, lifecycle),
    /valid loaded Creator SpriteFrame/,
  );
  assert.throws(
    () => ClassicGeneratedBomb.create(createCommand(1), visual as never, {
      ...lifecycle,
      onCut: null,
    } as never),
    /callbacks must be functions/,
  );

  const bomb = ClassicGeneratedBomb.create(createCommand(2), visual as never, lifecycle);
  assert.throws(() => bomb.finishAfterBombHit(), /before its first cut/);
  assert.throws(() => bomb.setTransform({ x: Number.NaN, y: 0 }, 0), /finite/);
  assert.throws(() => bomb.setLinearVelocity({ x: 0, y: Infinity }), /finite/);
  assert.throws(() => bomb.setAngularVelocity(Number.NaN), /finite/);
  const parent = new cc.Node('Parent');
  assert.throws(() => bomb.attach(parent as never, 0 as never), /z-order 1/);
  bomb.attach(parent as never, 1);
  assert.throws(() => bomb.setTransform({ x: 0, y: 0 }, 0), /before attachment/);
  assert.throws(() => bomb.setLinearVelocity({ x: 0, y: 0 }), /before attachment/);
  assert.throws(() => bomb.setAngularVelocity(0), /before attachment/);
  assert.throws(() => bomb.attach(parent as never, 1), /already attached/);
});

test('teardown is deferred, idempotent, and rolls back its guard when scheduling fails', () => {
  const deferred = createDeferredLifecycle();
  const bomb = ClassicGeneratedBomb.create(
    createCommand(71),
    createLoadedBombVisual('480x800') as never,
    deferred.lifecycle,
  );
  bomb.attach(new cc.Node('Parent') as never, 1);
  assert.equal(bomb.queueDispose('registry-dispose-all'), true);
  assert.equal(bomb.queueDispose('spawn-failed'), false);
  assert.equal(cc.isValid(bomb.node), true);
  flushDeferred(deferred);
  assert.equal(cc.isValid(bomb.node), false);
  assert.deepEqual(deferred.disposals.map(({ reason }) => reason), ['registry-dispose-all']);

  let scheduleAttempts = 0;
  const retryable = ClassicGeneratedBomb.create(
    createCommand(72),
    createLoadedBombVisual('480x800') as never,
    {
      callAfterStep(mutation) {
        scheduleAttempts += 1;
        if (scheduleAttempts === 1) {
          throw new Error('world unavailable');
        }
        deferred.callbacks.push(mutation);
      },
      onBeforeFreeze() {},
      onCut() {},
      onDisposed() {},
    },
  );
  assert.throws(() => retryable.queueDispose('spawn-failed'), /world unavailable/);
  assert.equal(retryable.disposalQueued, false);
  assert.equal(retryable.queueDispose('spawn-failed'), true);
});

function createCommand(entityOccurrenceId: number) {
  return Object.freeze({
    type: 'create-bomb' as const,
    entityOccurrenceId,
    tossType: 1 as const,
    bombId: 0 as const,
  });
}

function createLoadedBombVisual(
  assetTree: '480x800' | '720x1280',
): LoadedBombVisual {
  const resource = getClassicBombResource(0, assetTree);
  return Object.freeze({
    ...resource,
    spriteFrame: new cc.SpriteFrame(
      resource.dimensions.width,
      resource.dimensions.height,
    ),
  });
}

function createDeferredLifecycle(): DeferredLifecycle {
  const callbacks: Array<() => void> = [];
  const cuts: DeferredLifecycle['cuts'] = [];
  const disposals: DeferredLifecycle['disposals'] = [];
  return {
    callbacks,
    cuts,
    disposals,
    lifecycle: {
      callAfterStep: (mutation) => callbacks.push(mutation),
      onBeforeFreeze() {},
      onCut: (event) => cuts.push({
        entityOccurrenceId: event.entityOccurrenceId,
        targetId: event.targetId,
        worldPosition: event.worldPosition,
      }),
      onDisposed: (event) => disposals.push({
        entityOccurrenceId: event.entityOccurrenceId,
        reason: event.reason,
        targetId: event.targetId,
      }),
    },
  };
}

function flushDeferred(deferred: DeferredLifecycle): void {
  while (deferred.callbacks.length > 0) {
    deferred.callbacks.shift()?.();
  }
}

function vector(value: Readonly<{ x: number; y: number }>): Readonly<{ x: number; y: number }> {
  return { x: value.x, y: value.y };
}

function size(value: Readonly<{ width: number; height: number }>): Readonly<{
  width: number;
  height: number;
}> {
  return { width: value.width, height: value.height };
}
