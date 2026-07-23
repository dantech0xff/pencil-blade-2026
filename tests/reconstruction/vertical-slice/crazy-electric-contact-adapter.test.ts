import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const Contact2DType = Object.freeze({ BEGIN_CONTACT: 'begin-contact' });
export const ERigidBody2DType = Object.freeze({ Static: 0 });
export class Size {
  constructor(width = 0, height = 0) { this.width = width; this.height = height; }
}
export class Collider2D {
  constructor() {
    this.listeners = new Map();
    this.density = 0;
    this.friction = 0;
    this.group = 0;
    this.restitution = 0;
    this.sensor = false;
    this.tag = 0;
  }
  on(type, callback, target) { this.listeners.set(type, { callback, target }); }
  off(type, callback, target) {
    const listener = this.listeners.get(type);
    if (listener?.callback === callback && listener?.target === target) {
      this.listeners.delete(type);
    }
  }
  emit(type, selfCollider, otherCollider, contact = null) {
    const listener = this.listeners.get(type);
    listener?.callback.call(listener.target, selfCollider, otherCollider, contact);
  }
}
export class BoxCollider2D extends Collider2D {
  constructor() { super(); this.size = new Size(1, 1); }
}
export class RigidBody2D {
  constructor() { this.enabledContactListener = false; this.group = 0; this.type = -1; }
}
export class Node {
  constructor(name = '', sceneRoot = false) {
    this.active = true;
    this.children = [];
    this.components = [];
    this.destroyed = false;
    this.layer = 0;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
    this.name = name;
    this.sceneRoot = sceneRoot;
  }
  get activeInHierarchy() {
    return this.active && (
      this.parent === null ? this.sceneRoot : this.parent.activeInHierarchy
    );
  }
  addComponent(Type) {
    const component = new Type();
    component.node = this;
    this.components.push(component);
    return component;
  }
  setParent(parent) {
    if (this.parent !== null) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
  }
  setPosition(x, y, z = 0) { this.position = { x, y, z }; }
  destroy() { this.destroyed = true; this.active = false; this.setParent(null); }
}
export class Scene extends Node {
  constructor(name = '') { super(name, true); }
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
  CRAZY_ELECTRIC_SAFE_SENSOR_HEIGHT,
  CrazyElectricContactAdapter,
} = await import(
  '../../../game/assets/scripts/creator/crazy-electric-contact-adapter.ts'
);
const {
  ELECTRIC_COLLISION_FILTER,
  ELECTRIC_FIELD_NODE_TAG,
} = await import('../../../game/assets/scripts/domain/classic-fixture-rules.ts');

interface StubCollider {
  readonly group: number;
  readonly sensor: boolean;
  readonly size: Readonly<{ width: number; height: number }>;
  readonly tag: number;
  emit(
    type: string,
    selfCollider: StubCollider,
    otherCollider: StubCollider,
    contact?: Readonly<{ colliderA: StubCollider | null; colliderB: StubCollider | null }>,
  ): void;
}

interface StubNode {
  active: boolean;
  readonly activeInHierarchy: boolean;
  readonly destroyed: boolean;
  layer: number;
  readonly parent: StubNode | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  setParent(parent: StubNode | null): void;
}

interface CocosStub {
  readonly Collider2D: new () => StubCollider;
  readonly Contact2DType: Readonly<{ BEGIN_CONTACT: string }>;
  readonly Node: new (name?: string) => StubNode;
  readonly Scene: new (name?: string) => StubNode;
}

function createHarness(
  options: Readonly<{ readonly attachParentToScene?: boolean }> = {},
) {
  const scene = new cc.Scene('Scene');
  const parent = new cc.Node('CrazyRoot');
  parent.layer = 7;
  const bomb = new cc.Collider2D();
  const fruit = new cc.Collider2D();
  const target = Object.freeze({ targetId: 'crazy-bomb:1' });
  const contacts: string[] = [];
  const deferred: Array<() => void> = [];
  const adapter = CrazyElectricContactAdapter.create({
    logicalHeight: 800,
    logicalWidth: 480,
    parent: parent as never,
  }, {
    callAfterStep(mutation) {
      deferred.push(mutation);
    },
    onBombContact(contactTarget) {
      contacts.push(contactTarget.targetId);
    },
    resolveBomb(collider) {
      return collider === bomb ? target : null;
    },
  });
  const attachParentToScene = () => {
    if (parent.parent === null) {
      parent.setParent(scene);
    }
  };
  if (options.attachParentToScene !== false) {
    attachParentToScene();
  }
  return {
    adapter,
    attachParentToScene,
    bomb,
    contacts,
    deferred,
    flushDeferred() {
      for (const mutation of deferred.splice(0, deferred.length)) {
        mutation();
      }
    },
    fruit,
    parent,
    scene,
  };
}

test('detached construction stages an inactive sensor until hierarchy attachment', () => {
  const {
    adapter,
    attachParentToScene,
    parent,
  } = createHarness({ attachParentToScene: false });

  assert.equal(parent.active, true);
  assert.equal(parent.parent, null);
  assert.equal(parent.activeInHierarchy, false);
  assert.equal(adapter.node.parent, parent);
  assert.equal(adapter.node.active, false);
  assert.equal(adapter.node.activeInHierarchy, false);
  assert.throws(
    () => adapter.setActive(true),
    /hierarchy-attached before activation/,
  );
  assert.equal(adapter.active, false);
  assert.equal(adapter.node.active, false);

  attachParentToScene();
  assert.equal(parent.activeInHierarchy, true);
  adapter.setActive(true);
  assert.equal(adapter.active, true);
  assert.equal(adapter.node.activeInHierarchy, true);
});

test('electric adapter preserves recovered line geometry with explicit safe thickness', () => {
  const { adapter, parent } = createHarness();

  assert.equal(adapter.active, false);
  assert.equal(adapter.node.active, false);
  assert.equal(adapter.node.layer, parent.layer);
  assert.deepEqual(adapter.node.position, { x: 240, y: 200, z: 0 });
  assert.equal(adapter.collider.size.width, 1920);
  assert.equal(adapter.collider.size.height, CRAZY_ELECTRIC_SAFE_SENSOR_HEIGHT);
  assert.equal(adapter.collider.sensor, true);
  assert.equal(adapter.collider.group, ELECTRIC_COLLISION_FILTER.categoryBits);
  assert.equal(adapter.collider.tag, ELECTRIC_FIELD_NODE_TAG);
  assert.equal(adapter.body.enabledContactListener, true);
});

test('active sensor defers registry-proven bombs from both fixture orderings', () => {
  const {
    adapter,
    bomb,
    contacts,
    deferred,
    flushDeferred,
    fruit,
  } = createHarness();
  adapter.setActive(true);

  adapter.collider.emit(
    cc.Contact2DType.BEGIN_CONTACT,
    adapter.collider as never,
    bomb as never,
  );
  adapter.collider.emit(
    cc.Contact2DType.BEGIN_CONTACT,
    bomb as never,
    adapter.collider as never,
  );
  adapter.collider.emit(
    cc.Contact2DType.BEGIN_CONTACT,
    fruit as never,
    adapter.collider as never,
  );
  adapter.collider.emit(
    cc.Contact2DType.BEGIN_CONTACT,
    fruit as never,
    fruit as never,
    { colliderA: adapter.collider as never, colliderB: bomb as never },
  );

  assert.deepEqual(contacts, []);
  assert.equal(deferred.length, 3);
  flushDeferred();
  assert.deepEqual(contacts, [
    'crazy-bomb:1',
    'crazy-bomb:1',
    'crazy-bomb:1',
  ]);
});

test('inactive and disposed sensors cannot emit or reactivate', () => {
  const {
    adapter,
    bomb,
    contacts,
    deferred,
    flushDeferred,
  } = createHarness();
  adapter.collider.emit(
    cc.Contact2DType.BEGIN_CONTACT,
    adapter.collider as never,
    bomb as never,
  );
  assert.deepEqual(contacts, []);
  assert.equal(deferred.length, 0);

  adapter.setActive(true);
  adapter.collider.emit(
    cc.Contact2DType.BEGIN_CONTACT,
    adapter.collider as never,
    bomb as never,
  );
  assert.equal(deferred.length, 1);
  assert.equal(adapter.dispose(), true);
  flushDeferred();
  assert.equal(adapter.active, false);
  assert.equal(adapter.disposed, true);
  assert.equal(adapter.node.destroyed, true);
  assert.equal(adapter.dispose(), false);
  assert.doesNotThrow(() => adapter.setActive(false));
  assert.throws(() => adapter.setActive(true), /cannot reactivate/);
});

test('adapter validates the type-safe construction boundary', () => {
  const parent = new cc.Node('Parent');
  const inactiveParent = new cc.Node('InactiveParent');
  inactiveParent.active = false;
  assert.throws(() => CrazyElectricContactAdapter.create({
    logicalHeight: 800,
    logicalWidth: 480,
    parent: inactiveParent as never,
  }, {
    callAfterStep() {},
    onBombContact() {},
    resolveBomb() { return null; },
  }), /valid and active/);
  assert.throws(() => CrazyElectricContactAdapter.create({
    logicalHeight: 800,
    logicalWidth: Number.MAX_VALUE,
    parent: parent as never,
  }, {
    callAfterStep() {},
    onBombContact() {},
    resolveBomb() { return null; },
  }), /float32/);
  assert.throws(() => CrazyElectricContactAdapter.create({
    logicalHeight: 0,
    logicalWidth: 480,
    parent: parent as never,
  }, {
    callAfterStep() {},
    onBombContact() {},
    resolveBomb() { return null; },
  }), /positive/);
  assert.throws(() => CrazyElectricContactAdapter.create({
    logicalHeight: 800,
    logicalWidth: 480,
    parent: parent as never,
  }, {} as never), /incomplete/);
});

test('contact callback failures surface only from the post-step drain', () => {
  const scene = new cc.Scene('Scene');
  const parent = new cc.Node('Parent');
  const bomb = new cc.Collider2D();
  const deferred: Array<() => void> = [];
  const adapter = CrazyElectricContactAdapter.create({
    logicalHeight: 800,
    logicalWidth: 480,
    parent: parent as never,
  }, {
    callAfterStep(mutation) {
      deferred.push(mutation);
    },
    onBombContact() {
      throw new Error('contact mutation failed');
    },
    resolveBomb() {
      return { targetId: 'bomb' };
    },
  });
  parent.setParent(scene);
  adapter.setActive(true);

  assert.doesNotThrow(() => adapter.collider.emit(
    cc.Contact2DType.BEGIN_CONTACT,
    adapter.collider as never,
    bomb as never,
  ));
  assert.equal(deferred.length, 1);
  assert.throws(() => deferred[0]?.(), /contact mutation failed/);
});
