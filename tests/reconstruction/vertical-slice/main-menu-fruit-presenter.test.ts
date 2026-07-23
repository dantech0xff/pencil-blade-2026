import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
}
export class Size {
  constructor(width = 0, height = 0) { this.width = width; this.height = height; }
}
export class UITransform {
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
  setContentSize(width, height) { this.contentSize = { width, height }; }
}
export class UIOpacity { constructor() { this.opacity = 255; } }
export class Sprite {
  static SizeMode = Object.freeze({ CUSTOM: 'CUSTOM' });
  constructor() { this.sizeMode = null; this.spriteFrame = null; }
}
export class RigidBody2D {
  constructor() {
    this.angularVelocity = 0;
    this.impl = null;
    this.linearVelocity = new Vec2();
    this.mass = 1;
    this.impulses = [];
  }
  applyLinearImpulseToCenter(impulse) { this.impulses.push(impulse); }
  getMass() { return this.mass; }
}
export class Collider2D { constructor() { this.tag = 0; } }
export class BoxCollider2D extends Collider2D {}
export class CircleCollider2D extends Collider2D {}
export const ERigidBody2DType = Object.freeze({ Dynamic: 'Dynamic' });
export class Node {
  constructor(name = '') {
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyed = false;
    this.eulerAngles = { x: 0, y: 0, z: 0 };
    this.layer = 0;
    this.name = name;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
  }
  get activeInHierarchy() {
    return this.active && (this.parent === null || this.parent.activeInHierarchy);
  }
  get worldPosition() {
    if (this.parent === null) return this.position;
    const parent = this.parent.worldPosition;
    return { x: parent.x + this.position.x, y: parent.y + this.position.y, z: parent.z + this.position.z };
  }
  addComponent(Type) {
    const component = new Type();
    component.node = this;
    this.components.set(Type, component);
    return component;
  }
  destroy() {
    if (this.destroyed) return;
    for (const child of [...this.children]) child.destroy();
    this.destroyed = true;
    this.active = false;
    this.setParent(null);
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
  setPosition(x, y, z = 0) { this.position = { x, y, z }; }
  setRotationFromEuler(x, y, z) { this.eulerAngles = { x, y, z }; }
  setScale(x, y, z = 1) { this.scale = { x, y, z }; }
  setSiblingIndex(index) {
    if (this.parent === null) return;
    const siblings = this.parent.children;
    const current = siblings.indexOf(this);
    if (current >= 0) siblings.splice(current, 1);
    siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, this);
  }
  setWorldPosition(x, y, z = 0) {
    if (this.parent === null) this.position = { x, y, z };
    else {
      const parent = this.parent.worldPosition;
      this.position = { x: x - parent.x, y: y - parent.y, z: z - parent.z };
    }
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
};
const { createMainMenuFruitButtonPresentations } = await import(
  '../../../game/assets/scripts/domain/main-menu-presentation.ts'
);
const { MainMenuFruitPresenter } = await import(
  '../../../game/assets/scripts/creator/main-menu-fruit-presenter.ts'
);

interface StubNode {
  active: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  readonly name: string;
  parent: StubNode | null;
  readonly scale: Readonly<{ x: number; y: number; z: number }>;
  setParent(parent: StubNode | null): void;
}

const VIEWPORT = Object.freeze({
  logicalHeight: 800,
  logicalWidth: 480,
  visibleRect: Object.freeze({
    bottom: Object.freeze({ x: 240, y: 0 }),
    center: Object.freeze({ x: 240, y: 400 }),
    left: Object.freeze({ x: 0, y: 400 }),
    right: Object.freeze({ x: 480, y: 400 }),
    top: Object.freeze({ x: 240, y: 800 }),
  }),
});

test('FruitButton cut is reversible until route commit and the same fruit can be cut again', () => {
  const presentation = createMainMenuFruitButtonPresentations('480x800', VIEWPORT)[0];
  assert.ok(presentation);
  const deferred: Array<() => void> = [];
  const events: string[] = [];
  const presenter = MainMenuFruitPresenter.create({
    assetTree: '480x800',
    presentation,
    resources: {
      assetTree: '480x800',
      font: Object.freeze({}),
      raster: (contract: Readonly<{
        canonicalPath: string;
        dimensions: Readonly<{ height: number; width: number }>;
      }>) => Object.freeze({ ...contract, spriteFrame: Object.freeze({}) }),
    },
    viewport: { height: 800, width: 480 },
  }, {
    callAfterStep: (mutation: () => void) => deferred.push(mutation),
    onColliderDisposed: () => events.push('collider-disposed'),
    onNavigation: () => events.push('navigation'),
    onPlayFruitAudio: () => events.push('fruit-audio'),
  });
  const parent = new cc.Node('MainMenuRoot');
  presenter.attach(parent as never, 0);
  presenter.activate();

  const segment = Object.freeze({
    end: Object.freeze({ x: 200, y: 400 }),
    start: Object.freeze({ x: 100, y: 300 }),
  });
  assert.equal(presenter.cut(segment, true), true);
  assert.deepEqual(parent.children.slice(-2).map(({ name }) => name), [
    'MainMenuCutHalf-bottom',
    'MainMenuCutHalf-top',
  ]);
  assert.deepEqual(events, ['fruit-audio', 'navigation']);
  assert.equal(presenter.blurNode.active, false);
  assert.equal(presenter.fruitNode.active, false);
  assert.equal(presenter.state.cutCommitted, false);

  assert.equal(presenter.rollbackCut(), true);
  assert.equal(presenter.state.cutAccepted, false);
  assert.equal(presenter.blurNode.active, true);
  assert.equal(presenter.fruitNode.active, true);
  assert.deepEqual(presenter.circleNode.scale, { x: 1, y: 1, z: 1 });

  assert.equal(presenter.cut(segment, true), true);
  assert.deepEqual(events, ['fruit-audio', 'navigation', 'fruit-audio', 'navigation']);
  assert.equal(presenter.commitCut(), true);
  assert.equal(presenter.rollbackCut(), false);
  assert.equal(deferred.length, 1);
  deferred.shift()?.();
  assert.equal(presenter.fruitNode.destroyed, true);
  assert.deepEqual(events.at(-1), 'collider-disposed');
  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
});

test('FruitButton restores its cut gate when pre-attach resource preparation throws', () => {
  const presentation = createMainMenuFruitButtonPresentations('480x800', VIEWPORT)[0];
  assert.ok(presentation);
  let rejectCutRaster = false;
  const presenter = MainMenuFruitPresenter.create({
    assetTree: '480x800',
    presentation,
    resources: {
      assetTree: '480x800',
      font: Object.freeze({}),
      raster: (contract: Readonly<{
        canonicalPath: string;
        dimensions: Readonly<{ height: number; width: number }>;
      }>) => {
        if (
          rejectCutRaster
          && contract.canonicalPath === presentation.resources.cutBottom.canonicalPath
        ) {
          throw new Error('injected cut raster failure');
        }
        return Object.freeze({ ...contract, spriteFrame: Object.freeze({}) });
      },
    },
    viewport: { height: 800, width: 480 },
  }, {
    callAfterStep: () => {},
    onColliderDisposed: () => {},
    onNavigation: () => {},
    onPlayFruitAudio: () => {},
  });
  const parent = new cc.Node('MainMenuRoot');
  presenter.attach(parent as never, 0);
  presenter.activate();
  const segment = Object.freeze({
    end: Object.freeze({ x: 200, y: 400 }),
    start: Object.freeze({ x: 100, y: 300 }),
  });

  rejectCutRaster = true;
  assert.throws(() => presenter.cut(segment, true), /injected cut raster failure/);
  assert.equal(presenter.state.cutAccepted, false);
  assert.equal(presenter.blurNode.active, true);
  assert.equal(presenter.fruitNode.active, true);

  rejectCutRaster = false;
  assert.equal(presenter.cut(segment, true), true);
  assert.equal(presenter.rollbackCut(), true);
  presenter.dispose();
});

test('FruitButton uses actual Creator bodies and recovered fixture/cleanup boundaries', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(
    new URL('../../../game/assets/scripts/creator/main-menu-fruit-presenter.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /addComponent\(RigidBody2D\)/);
  assert.match(source, /addComponent\(BoxCollider2D\)/);
  assert.match(source, /addComponent\(CircleCollider2D\)/);
  assert.match(source, /body\.gravityScale = 0/);
  assert.match(source, /body\.angularVelocity = Math\.fround\(2\)/);
  assert.match(source, /this\.lifecycle\.callAfterStep/);
  assert.doesNotMatch(source, /button-review-normal|placeholder/i);
});
