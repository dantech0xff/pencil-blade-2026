import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

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
    this.impl = null;
  }
  getMass() { return 1; }
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
  static createdCount = 0;

  constructor(name = '') {
    Node.createdCount += 1;
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
  getCrazySpecialFruitResources,
} = await import('../../../game/assets/scripts/domain/crazy-resource-contract.ts');
const {
  CRAZY_GENERATED_SPECIAL_FRUIT_Z_ORDER,
  TARGET_CRAZY_SPECIAL_FRUIT_COLLIDER_TAG,
  CrazyGeneratedSpecialFruit,
} = await import('../../../game/assets/scripts/creator/crazy-generated-special-fruit.ts');

type AssetTree = '480x800' | '720x1280';
type SpecialFruitId = 10 | 11 | 12 | 13 | 14;

interface CocosStub {
  readonly ERigidBody2DType: Readonly<{ Dynamic: number }>;
  readonly Node: {
    new (name?: string): StubNode;
    createdCount: number;
  };
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

interface LoadedRaster {
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{ height: number; width: number }>;
  readonly spriteFrame: StubSpriteFrame;
}

interface ExactCatalog {
  readonly assetTree: AssetTree;
  readonly loadedByPath: ReadonlyMap<string, LoadedRaster>;
  readonly raster: (resource: Readonly<{
    canonicalPath: string;
    dimensions: Readonly<{ height: number; width: number }>;
  }>) => LoadedRaster;
  readonly rasterCount: 37;
  readonly timeManagerFont: object;
}

interface DeferredLifecycle {
  readonly callbacks: Array<() => void>;
  readonly cuts: Array<{
    readonly entityOccurrenceId: number;
    readonly fruitId: SpecialFruitId;
    readonly segment: Readonly<{
      readonly end: Readonly<{ x: number; y: number }>;
      readonly start: Readonly<{ x: number; y: number }>;
    }>;
    readonly sourceAngleRadians: number;
    readonly sourceAngularVelocityRadiansPerSecond: number;
    readonly sourceBodyMass: number;
    readonly targetId: string;
    readonly tossType: number;
    readonly visuals: object;
    readonly worldPosition: Readonly<{ x: number; y: number }>;
  }>;
  readonly disposals: Array<{
    readonly entityOccurrenceId: number;
    readonly reason: unknown;
    readonly targetId: string;
  }>;
  readonly lifecycle: {
    readonly callAfterStep: (mutation: () => void) => void;
    readonly onCut: (event: DeferredLifecycle['cuts'][number]) => void;
    readonly onDisposed: (event: {
      readonly entityOccurrenceId: number;
      readonly reason: unknown;
      readonly targetId: string;
    }) => void;
    readonly onMiss: (event: DeferredLifecycle['misses'][number]) => void;
  };
  readonly misses: Array<{
    readonly entityOccurrenceId: number;
    readonly fruitId: SpecialFruitId;
    readonly targetId: string;
    readonly tossType: number;
    readonly worldPosition: Readonly<{ x: number; y: number }>;
  }>;
}

test('all five IDs bind exact loaded triples and recovered fruit physics in both profiles', () => {
  let entityOccurrenceId = 1;
  for (const assetTree of ['480x800', '720x1280'] as const) {
    for (const fruitId of [10, 11, 12, 13, 14] as const) {
      const catalog = createExactCatalog(assetTree);
      const expected = getCrazySpecialFruitResources(fruitId, assetTree);
      const deferred = createDeferredLifecycle();
      const entity = CrazyGeneratedSpecialFruit.create(
        createCommand(fruitId, entityOccurrenceId) as never,
        viewportFor(assetTree),
        catalog as never,
        deferred.lifecycle,
      );
      const transform = (entity.node as unknown as StubNode).getComponent(cc.UITransform);
      assert.ok(transform);

      assert.equal(entity.entityOccurrenceId, entityOccurrenceId);
      assert.equal(entity.fruitId, fruitId);
      assert.equal(entity.tossType, fruitId <= 12 ? 5 : fruitId === 13 ? 3 : 4);
      const identity = expectedIdentity(fruitId, entityOccurrenceId);
      assert.equal(entity.nodeName, identity.nodeName);
      assert.equal(entity.node.name, entity.nodeName);
      assert.equal(entity.targetId, identity.targetId);
      assert.equal(entity.node.active, false);
      assert.deepEqual(size(transform.contentSize), expected.intact.dimensions);
      assert.deepEqual(vector(transform.anchorPoint), { x: 0.5, y: 0.5 });
      assert.equal(
        entity.visuals.intact,
        catalog.loadedByPath.get(expected.intact.canonicalPath),
      );
      assert.equal(
        entity.visuals.cutTop,
        catalog.loadedByPath.get(expected.cutTop.canonicalPath),
      );
      assert.equal(
        entity.visuals.cutBottom,
        catalog.loadedByPath.get(expected.cutBottom.canonicalPath),
      );
      assert.equal(entity.sprite.spriteFrame, entity.visuals.intact.spriteFrame);

      assert.equal(entity.body.type, cc.ERigidBody2DType.Dynamic);
      assert.equal(entity.body.allowSleep, true);
      assert.equal(entity.body.awakeOnLoad, true);
      assert.equal(entity.body.bullet, false);
      assert.equal(entity.body.fixedRotation, false);
      assert.equal(entity.body.gravityScale, 1);
      assert.equal(entity.body.linearDamping, 0);
      assert.equal(entity.body.angularDamping, 0);
      assert.deepEqual(vector(entity.body.linearVelocity), { x: 0, y: 0 });
      assert.equal(entity.body.angularVelocity, 0);
      assert.equal(entity.body.group, 0x0001);
      assert.equal(
        entity.collider.radius,
        Math.fround(
          Math.fround(
            Math.fround(expected.intact.dimensions.width)
            + Math.fround(expected.intact.dimensions.height),
          ) / 4,
        ),
      );
      assert.deepEqual(vector(entity.collider.offset), { x: 0, y: 0 });
      assert.equal(entity.collider.density, 1);
      assert.equal(entity.collider.friction, Math.fround(0.2));
      assert.equal(entity.collider.restitution, 0);
      assert.equal(entity.collider.sensor, false);
      assert.equal(entity.collider.group, 0x0001);
      assert.equal(entity.collider.tag, TARGET_CRAZY_SPECIAL_FRUIT_COLLIDER_TAG);
      assert.deepEqual(entity.collisionFilter, {
        categoryBits: 0x0001,
        groupIndex: 0,
        maskBits: 0xfffc,
      });

      entity.setTransform({ x: 2, y: 3 }, 0);
      entity.setLinearVelocity({ x: -4, y: 5 });
      entity.setAngularVelocity(6);
      assert.deepEqual(
        vector((entity.node as unknown as StubNode).worldPosition),
        { x: 64, y: 96 },
      );
      assert.deepEqual(vector(entity.body.linearVelocity), { x: -4, y: 5 });
      assert.equal(entity.body.angularVelocity, 6);

      const parent = new cc.Node('Parent');
      parent.layer = 19;
      parent.setPosition(10, 20, 0);
      entity.attach(parent as never, CRAZY_GENERATED_SPECIAL_FRUIT_Z_ORDER);
      assert.equal(entity.attached, true);
      assert.equal(entity.node.active, true);
      assert.equal(entity.node.layer, 19);
      assert.equal((entity.node as unknown as StubNode).lastRequestedSiblingIndex, 1);
      assert.deepEqual(
        vector((entity.node as unknown as StubNode).worldPosition),
        { x: 64, y: 96 },
      );
      assert.deepEqual(entity.snapshot(), {
        bodyWorldPosition: { x: 64, y: 96 },
        cutDisabled: false,
        id: entity.targetId,
        isFruit: true,
        nodeTag: TARGET_CRAZY_SPECIAL_FRUIT_COLLIDER_TAG,
      });
      entityOccurrenceId += 1;
    }
  }
});

test('bonus and shared-planner occurrence counters have collision-free stable identities', () => {
  const catalog = createExactCatalog('480x800');
  const viewport = viewportFor('480x800');
  const bonus = CrazyGeneratedSpecialFruit.create(
    createCommand(10, 1, 'b5') as never,
    viewport,
    catalog as never,
    createDeferredLifecycle().lifecycle,
  );
  const otherBonusController = CrazyGeneratedSpecialFruit.create(
    createCommand(11, 1, 'future-bonus-controller') as never,
    viewport,
    catalog as never,
    createDeferredLifecycle().lifecycle,
  );
  const down = CrazyGeneratedSpecialFruit.create(
    createCommand(13, 1) as never,
    viewport,
    catalog as never,
    createDeferredLifecycle().lifecycle,
  );

  assert.equal(bonus.targetId, 'crazy-special-fruit:bonus:b5:1');
  assert.equal(bonus.nodeName, 'CrazyGeneratedSpecialFruit-bonus-b5-1');
  assert.equal(
    otherBonusController.targetId,
    'crazy-special-fruit:bonus:future-bonus-controller:1',
  );
  assert.equal(
    otherBonusController.nodeName,
    'CrazyGeneratedSpecialFruit-bonus-future-bonus-controller-1',
  );
  assert.equal(down.targetId, 'crazy-special-fruit:shared-planner:1');
  assert.equal(down.nodeName, 'CrazyGeneratedSpecialFruit-shared-planner-1');
  assert.equal(new Set([
    bonus.targetId,
    otherBonusController.targetId,
    down.targetId,
  ]).size, 3);
  assert.equal(new Set([
    bonus.nodeName,
    otherBonusController.nodeName,
    down.nodeName,
  ]).size, 3);
});

test('cut emits one immutable controller handoff and disposes only after the physics step', () => {
  const catalog = createExactCatalog('480x800');
  const deferred = createDeferredLifecycle();
  const entity = CrazyGeneratedSpecialFruit.create(
    createCommand(12, 41) as never,
    viewportFor('480x800'),
    catalog as never,
    deferred.lifecycle,
  );
  entity.setTransform({ x: 7, y: 9 }, Math.PI / 4);
  entity.setLinearVelocity({ x: 4, y: 12 });
  entity.setAngularVelocity(-8);
  entity.attach(new cc.Node('Parent') as never, 1);
  const segment = { start: { x: 1, y: 2 }, end: { x: 3, y: 4 } };

  assert.equal(entity.cut(segment), true);
  segment.start.x = 999;
  assert.equal(entity.cut(null as never), false);
  assert.equal(entity.cutDisabled, true);
  assert.equal(entity.disposalQueued, true);
  assert.equal(deferred.cuts.length, 1);
  assert.deepEqual(deferred.cuts[0], {
    entityOccurrenceId: 41,
    fruitId: 12,
    segment: { start: { x: 1, y: 2 }, end: { x: 3, y: 4 } },
    sourceAngleRadians: Math.PI / 4,
    sourceAngularVelocityRadiansPerSecond: -8,
    sourceBodyMass: 1,
    targetId: 'crazy-special-fruit:bonus:b5:41',
    tossType: 5,
    visuals: entity.visuals,
    worldPosition: { x: 224, y: 288 },
  });
  assert.equal(Object.isFrozen(deferred.cuts[0]), true);
  assert.equal(Object.isFrozen(deferred.cuts[0]?.segment), true);
  assert.equal(Object.isFrozen(deferred.cuts[0]?.segment.start), true);
  assert.equal(deferred.callbacks.length, 1);
  assert.equal(cc.isValid(entity.node), true);

  flushDeferred(deferred);
  assert.equal(cc.isValid(entity.node), false);
  assert.equal(entity.attached, false);
  assert.deepEqual(deferred.disposals, [{
    entityOccurrenceId: 41,
    reason: 'cut',
    targetId: 'crazy-special-fruit:bonus:b5:41',
  }]);
});

test('ray-query dispatch preserves repeated fixture cuts until one batch disposal', () => {
  const deferred = createDeferredLifecycle();
  const entity = CrazyGeneratedSpecialFruit.create(
    createCommand(13, 51) as never,
    viewportFor('720x1280'),
    createExactCatalog('720x1280') as never,
    deferred.lifecycle,
  );
  entity.attach(new cc.Node('Parent') as never, 1);

  assert.equal(
    entity.cutWithinRayQuery({ start: { x: 1, y: 2 }, end: { x: 3, y: 4 } }),
    true,
  );
  assert.equal(
    entity.cutWithinRayQuery({ start: { x: 5, y: 6 }, end: { x: 7, y: 8 } }),
    true,
  );
  assert.equal(deferred.cuts.length, 2);
  assert.equal(entity.cutDisabled, false);
  assert.equal(deferred.callbacks.length, 0);

  entity.completeRayQueryCuts();
  assert.equal(entity.cutDisabled, true);
  assert.equal(deferred.callbacks.length, 1);
  assert.equal(
    entity.cutWithinRayQuery(null as never),
    false,
  );
  entity.completeRayQueryCuts();
  assert.equal(deferred.callbacks.length, 1);

  flushDeferred(deferred);
  assert.equal(cc.isValid(entity.node), false);
  assert.deepEqual(deferred.disposals.map(({ reason }) => reason), ['cut']);
});

test('ray-query completion restores cut eligibility when deferred scheduling throws', () => {
  const deferred = createDeferredLifecycle();
  let failScheduling = true;
  const entity = CrazyGeneratedSpecialFruit.create(
    createCommand(14, 52) as never,
    viewportFor('480x800'),
    createExactCatalog('480x800') as never,
    {
      ...deferred.lifecycle,
      callAfterStep(mutation) {
        if (failScheduling) {
          throw new Error('post-step scheduler failed');
        }
        deferred.callbacks.push(mutation);
      },
    },
  );
  entity.attach(new cc.Node('Parent') as never, 1);

  assert.equal(entity.cutWithinRayQuery({
    start: { x: 1, y: 2 },
    end: { x: 3, y: 4 },
  }), true);
  assert.throws(
    () => entity.completeRayQueryCuts(),
    /post-step scheduler failed/,
  );
  assert.equal(entity.cutDisabled, false);
  assert.equal(entity.disposalQueued, false);
  assert.equal(deferred.callbacks.length, 0);

  failScheduling = false;
  assert.equal(entity.cutWithinRayQuery({
    start: { x: 5, y: 6 },
    end: { x: 7, y: 8 },
  }), true);
  entity.completeRayQueryCuts();
  assert.equal(entity.cutDisabled, true);
  assert.equal(entity.disposalQueued, true);
  assert.equal(deferred.callbacks.length, 1);
  assert.equal(deferred.cuts.length, 2);

  flushDeferred(deferred);
  assert.equal(cc.isValid(entity.node), false);
  assert.deepEqual(deferred.disposals.map(({ reason }) => reason), ['cut']);
});

test('lower-bound misses identify bonus versus Down fruit and queue idempotent disposal', () => {
  for (const fruitId of [10, 14] as const) {
    const deferred = createDeferredLifecycle();
    const entity = CrazyGeneratedSpecialFruit.create(
      createCommand(fruitId, 60 + fruitId) as never,
      viewportFor('480x800'),
      createExactCatalog('480x800') as never,
      deferred.lifecycle,
    );
    entity.setTransform({ x: 0, y: -9 }, 0);
    entity.setLinearVelocity({ x: 1, y: -1 });
    entity.attach(new cc.Node('Parent') as never, 1);

    assert.deepEqual(entity.evaluateBounds(viewportFor('480x800')), [
      { type: 'fail', positionWorldUnits: { x: 0, y: -288 } },
      { type: 'defer-dispose', boundary: 'below' },
    ]);
    assert.deepEqual(deferred.misses, [{
      entityOccurrenceId: 60 + fruitId,
      fruitId,
      targetId: expectedIdentity(fruitId, 60 + fruitId).targetId,
      tossType: fruitId === 10 ? 5 : 4,
      worldPosition: { x: 0, y: -288 },
    }]);
    assert.equal(entity.disposalQueued, true);
    assert.deepEqual(entity.evaluateBounds(viewportFor('480x800')), []);
    assert.equal(deferred.misses.length, 1);
    assert.equal(deferred.callbacks.length, 1);

    flushDeferred(deferred);
    assert.equal(cc.isValid(entity.node), false);
    assert.deepEqual(deferred.disposals.map(({ reason }) => reason), [{
      type: 'bounds',
      boundary: 'below',
    }]);
  }
});

test('creation and lifecycle inputs reject invalid commands, resources, frames, and mutations', () => {
  const lifecycle = createDeferredLifecycle().lifecycle;
  const viewport = viewportFor('480x800');
  const catalog = createExactCatalog('480x800');

  assert.throws(
    () => CrazyGeneratedSpecialFruit.create(null as never, viewport, catalog as never, lifecycle),
    TypeError,
  );
  assert.throws(
    () => CrazyGeneratedSpecialFruit.create(
      { ...createCommand(10, 1), entityOccurrenceId: 0 } as never,
      viewport,
      catalog as never,
      lifecycle,
    ),
    RangeError,
  );
  assert.throws(
    () => CrazyGeneratedSpecialFruit.create(
      { ...createCommand(10, 1), fruitId: 13 } as never,
      viewport,
      catalog as never,
      lifecycle,
    ),
    RangeError,
  );
  assert.throws(
    () => CrazyGeneratedSpecialFruit.create(
      { ...createCommand(13, 1), tossType: 4 } as never,
      viewport,
      catalog as never,
      lifecycle,
    ),
    RangeError,
  );
  assert.throws(
    () => CrazyGeneratedSpecialFruit.create(
      { ...createCommand(10, 1), controllerId: '' } as never,
      viewport,
      catalog as never,
      lifecycle,
    ),
    TypeError,
  );
  assert.throws(
    () => CrazyGeneratedSpecialFruit.create(
      createCommand(10, 1) as never,
      { width: 0, height: 800 },
      catalog as never,
      lifecycle,
    ),
    RangeError,
  );
  assert.throws(
    () => CrazyGeneratedSpecialFruit.create(
      createCommand(10, 1) as never,
      viewport,
      { ...catalog, assetTree: 'phone' } as never,
      lifecycle,
    ),
    RangeError,
  );
  assert.throws(
    () => CrazyGeneratedSpecialFruit.create(
      createCommand(10, 1) as never,
      viewport,
      { ...catalog, raster: null } as never,
      lifecycle,
    ),
    TypeError,
  );
  assert.throws(
    () => CrazyGeneratedSpecialFruit.create(
      createCommand(10, 1) as never,
      viewport,
      catalog as never,
      { ...lifecycle, onMiss: null } as never,
    ),
    TypeError,
  );

  const expected = getCrazySpecialFruitResources(10, '480x800');
  assertCatalogFailureDoesNotCreateNode({
    ...catalog,
    raster(resource) {
      const loaded = catalog.raster(resource);
      return resource.canonicalPath === expected.intact.canonicalPath
        ? { ...loaded, canonicalPath: '480x800/Fruits/not-the-fruit.png' }
        : loaded;
    },
  }, /must use exact raster/);
  assertCatalogFailureDoesNotCreateNode({
    ...catalog,
    raster(resource) {
      const loaded = catalog.raster(resource);
      return resource.canonicalPath === expected.cutTop.canonicalPath
        ? {
            ...loaded,
            dimensions: {
              height: loaded.dimensions.height,
              width: loaded.dimensions.width + 1,
            },
          }
        : loaded;
    },
  }, /dimensions must match/);
  assertCatalogFailureDoesNotCreateNode({
    ...catalog,
    raster(resource) {
      const loaded = catalog.raster(resource);
      return resource.canonicalPath === expected.cutBottom.canonicalPath
        ? {
            ...loaded,
            spriteFrame: new cc.SpriteFrame(
              loaded.dimensions.width + 1,
              loaded.dimensions.height,
            ),
          }
        : loaded;
    },
  }, /preserve exact untrimmed/);
  assertCatalogFailureDoesNotCreateNode({
    ...catalog,
    raster(resource) {
      const loaded = catalog.raster(resource);
      if (resource.canonicalPath === expected.intact.canonicalPath) {
        loaded.spriteFrame.destroyed = true;
      }
      return loaded;
    },
  }, /valid loaded Creator SpriteFrame/);

  const entity = CrazyGeneratedSpecialFruit.create(
    createCommand(11, 99) as never,
    viewport,
    createExactCatalog('480x800') as never,
    createDeferredLifecycle().lifecycle,
  );
  const inactiveParent = new cc.Node('Inactive');
  inactiveParent.active = false;
  assert.throws(() => entity.attach(inactiveParent as never, 1), /must be active/);
  assert.throws(() => entity.attach(new cc.Node('Parent') as never, 2 as never), RangeError);
  entity.attach(new cc.Node('Parent') as never, 1);
  assert.throws(() => entity.attach(new cc.Node('Other') as never, 1), /already attached/);
  assert.throws(() => entity.setTransform({ x: 1, y: 2 }, 0), /before attachment/);
  assert.throws(() => entity.setLinearVelocity({ x: 1, y: 2 }), /before attachment/);
  assert.throws(() => entity.setAngularVelocity(1), /before attachment/);
  assert.throws(() => entity.queueDispose('unknown' as never), RangeError);
});

function createCommand(
  fruitId: SpecialFruitId,
  entityOccurrenceId: number,
  controllerId = 'b5',
): Readonly<Record<string, unknown>> {
  if (fruitId <= 12) {
    return Object.freeze({
      type: 'create-bonus-fruit',
      controllerId,
      entityOccurrenceId,
      fruitId,
      tossType: 5,
    });
  }
  return Object.freeze({
    type: 'create-fruit',
    entityOccurrenceId,
    fruitId,
    tossType: fruitId === 13 ? 3 : 4,
  });
}

function expectedIdentity(
  fruitId: SpecialFruitId,
  entityOccurrenceId: number,
  controllerId = 'b5',
): Readonly<{ nodeName: string; targetId: string }> {
  if (fruitId <= 12) {
    return Object.freeze({
      nodeName: `CrazyGeneratedSpecialFruit-bonus-${controllerId}-${entityOccurrenceId}`,
      targetId: `crazy-special-fruit:bonus:${controllerId}:${entityOccurrenceId}`,
    });
  }
  return Object.freeze({
    nodeName: `CrazyGeneratedSpecialFruit-shared-planner-${entityOccurrenceId}`,
    targetId: `crazy-special-fruit:shared-planner:${entityOccurrenceId}`,
  });
}

function createExactCatalog(assetTree: AssetTree): ExactCatalog {
  const loadedByPath = new Map<string, LoadedRaster>();
  for (const fruitId of [10, 11, 12, 13, 14] as const) {
    const resources = getCrazySpecialFruitResources(fruitId, assetTree);
    for (const resource of [resources.intact, resources.cutTop, resources.cutBottom]) {
      loadedByPath.set(resource.canonicalPath, Object.freeze({
        ...resource,
        spriteFrame: new cc.SpriteFrame(
          resource.dimensions.width,
          resource.dimensions.height,
        ),
      }));
    }
  }
  return {
    assetTree,
    loadedByPath,
    rasterCount: 37,
    timeManagerFont: Object.freeze({}),
    raster(resource) {
      const loaded = loadedByPath.get(resource.canonicalPath);
      if (loaded === undefined) {
        throw new Error(`unexpected raster ${resource.canonicalPath}`);
      }
      return loaded;
    },
  };
}

function createDeferredLifecycle(): DeferredLifecycle {
  const callbacks: Array<() => void> = [];
  const cuts: DeferredLifecycle['cuts'] = [];
  const disposals: DeferredLifecycle['disposals'] = [];
  const misses: DeferredLifecycle['misses'] = [];
  return {
    callbacks,
    cuts,
    disposals,
    misses,
    lifecycle: {
      callAfterStep: (mutation) => callbacks.push(mutation),
      onCut: (event) => cuts.push(event),
      onDisposed: (event) => disposals.push({
        entityOccurrenceId: event.entityOccurrenceId,
        reason: event.reason,
        targetId: event.targetId,
      }),
      onMiss: (event) => misses.push(event),
    },
  };
}

function assertCatalogFailureDoesNotCreateNode(
  catalog: Omit<ExactCatalog, 'raster'> & Pick<ExactCatalog, 'raster'>,
  expected: RegExp,
): void {
  const countBefore = cc.Node.createdCount;
  assert.throws(
    () => CrazyGeneratedSpecialFruit.create(
      createCommand(10, 100) as never,
      viewportFor('480x800'),
      catalog as never,
      createDeferredLifecycle().lifecycle,
    ),
    expected,
  );
  assert.equal(cc.Node.createdCount, countBefore);
}

function flushDeferred(deferred: DeferredLifecycle): void {
  while (deferred.callbacks.length > 0) {
    deferred.callbacks.shift()?.();
  }
}

function viewportFor(assetTree: AssetTree): Readonly<{ width: number; height: number }> {
  return assetTree === '480x800'
    ? Object.freeze({ width: 480, height: 800 })
    : Object.freeze({ width: 720, height: 1280 });
}

function vector(value: Readonly<{ x: number; y: number }>): Readonly<{
  x: number;
  y: number;
}> {
  return { x: value.x, y: value.y };
}

function size(value: Readonly<{ width: number; height: number }>): Readonly<{
  width: number;
  height: number;
}> {
  return { width: value.width, height: value.height };
}
