import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

import { getClassicPresentationResources } from '../../../game/assets/scripts/domain/classic-resource-contract.ts';

const SOURCE = readFileSync(
  new URL(
    '../../../game/assets/scripts/creator/classic-fail-presenter.ts',
    import.meta.url,
  ),
  'utf8',
);

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const createdNodes = [];
export function resetCreatedNodes() { createdNodes.length = 0; }

export class Size {
  constructor(width = 0, height = 0) { this.width = width; this.height = height; }
}

export class SpriteFrame {
  constructor(width, height) { this.originalSize = new Size(width, height); this.rect = { width, height }; }
}

export class UITransform {
  constructor() { this.contentSize = new Size(); this.anchorPoint = { x: 0, y: 0 }; }
  setContentSize(width, height) { this.contentSize = new Size(width, height); }
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
}

export class Sprite { constructor() { this.sizeMode = 0; this.spriteFrame = null; } }
Sprite.SizeMode = Object.freeze({ CUSTOM: 2 });

export class UIOpacity { constructor() { this.opacity = 255; } }

export class Node {
  constructor(name = '') {
    this.name = name;
    this.active = true;
    this.destroyed = false;
    this.layer = 0;
    this.parent = null;
    this.children = [];
    this.position = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
    this.components = new Map();
    this.lastRequestedSiblingIndex = null;
    createdNodes.push(this);
  }
  get activeInHierarchy() { return this.active && (this.parent === null || this.parent.activeInHierarchy); }
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
  getComponent(Type) { return this.components.get(Type) ?? null; }
  setPosition(x, y, z) { this.position = { x, y, z }; }
  setWorldPosition(x, y, z) {
    const parent = this.parent === null ? { x: 0, y: 0, z: 0 } : this.parent.worldPosition;
    this.position = { x: x - parent.x, y: y - parent.y, z: z - parent.z };
  }
  setScale(x, y, z) { this.scale = { x, y, z }; }
  setParent(parent, keepWorldTransform = false) {
    const world = this.worldPosition;
    if (this.parent !== null) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
    if (keepWorldTransform) this.setWorldPosition(world.x, world.y, world.z);
  }
  setSiblingIndex(index) {
    this.lastRequestedSiblingIndex = index;
    if (this.parent === null) return;
    const current = this.parent.children.indexOf(this);
    if (current >= 0) this.parent.children.splice(current, 1);
    const bounded = Math.max(0, Math.min(index, this.parent.children.length));
    this.parent.children.splice(bounded, 0, this);
  }
  destroy() { this.destroyed = true; this.active = false; this.setParent(null, true); }
}

export function isValid(value) { return value !== null && value !== undefined && !value.destroyed; }
`)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') return { shortCircuit: true, url: CC_STUB_URL };
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && extname(specifier) === '') {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const cc = await import('cc') as unknown as CocosStub;
const { ClassicFailPresenter } = await import(
  '../../../game/assets/scripts/creator/classic-fail-presenter.ts'
);

interface CocosStub {
  readonly Node: new (name?: string) => StubNode;
  readonly SpriteFrame: new (width: number, height: number) => object;
  readonly UIOpacity: new () => { opacity: number };
  readonly UITransform: new () => StubTransform;
  readonly createdNodes: StubNode[];
  readonly isValid: (node: unknown) => boolean;
  readonly resetCreatedNodes: () => void;
}

interface StubNode {
  active: boolean;
  children: StubNode[];
  destroyed: boolean;
  lastRequestedSiblingIndex: number | null;
  layer: number;
  readonly name: string;
  readonly parent: StubNode | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly scale: Readonly<{ x: number; y: number; z: number }>;
  readonly worldPosition: Readonly<{ x: number; y: number; z: number }>;
  getComponent<T>(Type: new () => T): T | null;
  setPosition(x: number, y: number, z: number): void;
}

interface StubTransform {
  readonly anchorPoint: Readonly<{ x: number; y: number }>;
  readonly contentSize: Readonly<{ width: number; height: number }>;
}

test('queued animation keys use Array.from before Creator loose-build iteration', () => {
  assert.match(SOURCE, /Array\.from\(this\.animations\.keys\(\)\)/);
  assert.doesNotMatch(
    SOURCE,
    /\[\s*\.\.\.\s*this\.animations\.keys\(\)\s*\]/,
  );
});

test('persistent markers use exact profile resources, entry layout, scale, anchor, and z-order', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    cc.resetCreatedNodes();
    const resources = loadedResources(assetTree);
    const viewport = assetTree === '480x800'
      ? { width: 480, height: 800 }
      : { width: 720, height: 1280 };
    const presenter = ClassicFailPresenter.create({
      filledResource: resources.failFilled,
      normalResource: resources.failNormal,
      viewport,
    }, { onIndicatorComplete() {} });

    assert.equal(presenter.markers.length, 3);
    for (const marker of presenter.markers) {
      assert.equal(marker.node.active, false);
      assert.equal(marker.opacity.opacity, 0);
      assert.equal(marker.sprite.spriteFrame, resources.failNormal.spriteFrame);
      assert.deepEqual(vector(marker.node.worldPosition), marker.layout.initialWorldPosition);
      assert.deepEqual(vector3(marker.node.scale), {
        x: marker.layout.scale,
        y: marker.layout.scale,
        z: 1,
      });
      const transform = (marker.node as unknown as StubNode).getComponent(cc.UITransform);
      assert.ok(transform);
      assert.deepEqual(vector(transform.anchorPoint), { x: 0.5, y: 0.5 });
      assert.deepEqual(size(transform.contentSize), resources.failNormal.dimensions);
    }

    const parent = new cc.Node('Parent');
    parent.layer = 31;
    parent.setPosition(100, 200, 0);
    presenter.attach(parent as never);
    for (let index = 0; index < presenter.markers.length; index += 1) {
      const marker = presenter.markers[index];
      assert.equal(marker.node.layer, 31);
      assert.equal(marker.node.lastRequestedSiblingIndex, index);
      assert.deepEqual(vector(marker.node.worldPosition), marker.layout.initialWorldPosition);
    }
    assert.deepEqual(parent.children.map(({ name }) => name), [
      'ClassicFailMarker-1',
      'ClassicFailMarker-2',
      'ClassicFailMarker-3',
    ]);
  }
});

test('entry action moves and fades concurrently for exactly one action second', () => {
  const resources = loadedResources('480x800');
  const presenter = ClassicFailPresenter.create({
    filledResource: resources.failFilled,
    normalResource: resources.failNormal,
    viewport: { width: 480, height: 800 },
  }, { onIndicatorComplete() {} });
  presenter.attach(new cc.Node('Parent') as never);

  presenter.updateAction(0.5);
  for (const marker of presenter.markers) {
    assert.equal(marker.opacity.opacity, 127.5);
    assert.equal(marker.node.worldPosition.y, (
      marker.layout.initialWorldPosition.y + marker.layout.targetWorldPosition.y
    ) / 2);
  }

  presenter.updateAction(0.5);
  for (const marker of presenter.markers) {
    assert.equal(marker.opacity.opacity, 255);
    assert.deepEqual(vector(marker.node.worldPosition), marker.layout.targetWorldPosition);
  }
  assert.equal(presenter.state.entryElapsedActionSeconds, 1);
});

test('each miss swaps the exact filled raster, animates 5x to normal in 0.25s, and cleans its transient at 1s', () => {
  cc.resetCreatedNodes();
  const resources = loadedResources('720x1280');
  const completed: number[] = [];
  const presenter = ClassicFailPresenter.create({
    filledResource: resources.failFilled,
    normalResource: resources.failNormal,
    viewport: { width: 720, height: 1280 },
  }, { onIndicatorComplete: (strike) => completed.push(strike) });
  presenter.attach(new cc.Node('Parent') as never);
  presenter.updateAction(1);

  for (const strike of [1, 2, 3] as const) {
    presenter.presentMiss(strike, { x: 100 * strike, y: -500 });
    assert.equal(presenter.markers[strike - 1].sprite.spriteFrame, resources.failFilled.spriteFrame);
    assert.deepEqual(
      size(presenter.markers[strike - 1].transform.contentSize as never),
      resources.failFilled.dimensions,
    );
  }
  assert.deepEqual(presenter.state.queuedStrikes, [1, 2, 3]);
  assert.deepEqual(presenter.state.completedStrikes, []);
  const transientNodes = cc.createdNodes.filter((node) => node.name === 'ClassicTransientFailAnimation');
  assert.equal(transientNodes.length, 3);
  assert.deepEqual(transientNodes.map((node) => vector(node.worldPosition)), [
    { x: 100, y: 96 },
    { x: 200, y: 96 },
    { x: 300, y: 96 },
  ]);
  const presentationRoot = presenter.markers[0].node.parent as unknown as StubNode;
  assert.deepEqual(presentationRoot.children.map(({ name }) => name), [
    'ClassicFailMarker-1',
    'ClassicFailMarker-2',
    'ClassicFailMarker-3',
    'ClassicTransientFailAnimation',
    'ClassicTransientFailAnimation',
    'ClassicTransientFailAnimation',
  ]);

  presenter.updateAction(0.125);
  for (const marker of presenter.markers) {
    assert.equal(marker.opacity.opacity, 127.5);
    assert.deepEqual(vector3(marker.node.scale), {
      x: marker.layout.scale * 3,
      y: marker.layout.scale * 3,
      z: 1,
    });
  }
  assert.deepEqual(completed, []);

  presenter.updateAction(0.125);
  assert.deepEqual(completed, [1, 2, 3]);
  assert.deepEqual(presenter.state.completedStrikes, [1, 2, 3]);
  presenter.updateAction(0.75);
  assert.equal(presenter.state.activeTransientCount, 0);
  assert.equal(transientNodes.every((node) => node.destroyed), true);
});

test('entry and miss actions remain concurrent while overshoot, zero delta, and staggered cleanup stay stable', () => {
  cc.resetCreatedNodes();
  const resources = loadedResources('480x800');
  const completed: number[] = [];
  const presenter = ClassicFailPresenter.create({
    filledResource: resources.failFilled,
    normalResource: resources.failNormal,
    viewport: { width: 480, height: 800 },
  }, { onIndicatorComplete: (strike) => completed.push(strike) });
  const parent = new cc.Node('TranslatedParent');
  parent.setPosition(75, 125, 0);
  presenter.attach(parent as never);

  presenter.updateAction(0.1);
  presenter.presentMiss(1, { x: 137.5, y: -300 });
  const firstTransient = cc.createdNodes.find(
    (node) => node.name === 'ClassicTransientFailAnimation',
  );
  const firstTransientSprite = cc.createdNodes.find(
    (node) => node.name === 'ClassicTransientFailMarker',
  );
  assert.ok(firstTransient);
  assert.ok(firstTransientSprite);
  assert.deepEqual(vector(firstTransient.worldPosition), { x: 137.5, y: 60 });

  presenter.updateAction(0);
  assert.deepEqual(completed, []);
  presenter.updateAction(0.5);
  assert.deepEqual(completed, [1]);
  assert.equal(presenter.markers[0].opacity.opacity, 255);
  assert.deepEqual(vector3(presenter.markers[0].node.scale), {
    x: presenter.markers[0].layout.scale,
    y: presenter.markers[0].layout.scale,
    z: 1,
  });
  assert.equal(presenter.markers[0].node.worldPosition.y, (
    presenter.markers[0].layout.initialWorldPosition.y
    + (presenter.markers[0].layout.targetWorldPosition.y
      - presenter.markers[0].layout.initialWorldPosition.y) * 0.6
  ));

  presenter.presentMiss(2, { x: 222, y: -300 });
  presenter.updateAction(0.5);
  assert.deepEqual(completed, [1, 2]);
  assert.equal(firstTransient.destroyed, true);
  assert.equal(firstTransientSprite.destroyed, true);
  assert.equal(presenter.state.activeTransientCount, 1);
  assert.deepEqual(vector(presenter.markers[0].node.worldPosition), (
    presenter.markers[0].layout.targetWorldPosition
  ));

  presenter.updateAction(10);
  assert.deepEqual(completed, [1, 2]);
  assert.equal(presenter.state.activeTransientCount, 0);
});

test('duplicate strikes, premature use, invalid resources, and disposal reject safely', () => {
  cc.resetCreatedNodes();
  const resources = loadedResources('480x800');
  const input = {
    filledResource: resources.failFilled,
    normalResource: resources.failNormal,
    viewport: { width: 480, height: 800 },
  };
  const completed: number[] = [];
  const detachedAncestor = new cc.Node('DetachedAncestor');
  detachedAncestor.active = false;
  const detachedActiveParent = new cc.Node('DetachedActiveParent');
  detachedActiveParent.setParent(detachedAncestor);
  assert.equal(detachedActiveParent.active, true);
  assert.equal(detachedActiveParent.activeInHierarchy, false);
  const detachedPresenter = ClassicFailPresenter.create(
    input,
    { onIndicatorComplete() {} },
  );
  assert.doesNotThrow(() => detachedPresenter.attach(detachedActiveParent as never));
  assert.equal(detachedPresenter.dispose(), true);

  const presenter = ClassicFailPresenter.create(
    input,
    { onIndicatorComplete: (strike) => completed.push(strike) },
  );
  assert.throws(() => presenter.presentMiss(1, { x: 1, y: 2 }), /attached/);
  presenter.attach(new cc.Node('Parent') as never);
  presenter.presentMiss(1, { x: 1, y: 2 });
  assert.throws(() => presenter.presentMiss(1, { x: 1, y: 2 }), /already queued/);
  const transientNodes = cc.createdNodes.filter((node) => (
    node.name === 'ClassicTransientFailAnimation' || node.name === 'ClassicTransientFailMarker'
  ));
  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
  presenter.updateAction(10);
  assert.deepEqual(completed, []);
  assert.equal(presenter.markers.every((marker) => marker.node.destroyed), true);
  assert.equal(transientNodes.every((node) => node.destroyed), true);
  assert.equal(presenter.state.attached, false);
  assert.equal(presenter.state.disposed, true);
  assert.throws(() => presenter.attach(new cc.Node('Other') as never), /Disposed/);

  assert.throws(() => ClassicFailPresenter.create({
    ...input,
    normalResource: { ...resources.failNormal, canonicalPath: 'wrong.png' },
  }, { onIndicatorComplete() {} }), /exact normal\/filled pair/);
  assert.throws(() => ClassicFailPresenter.create({
    ...input,
    filledResource: loadedResources('720x1280').failFilled,
  }, { onIndicatorComplete() {} }), /one asset tree/);
  assert.throws(() => ClassicFailPresenter.create({
    ...input,
    normalResource: {
      ...resources.failNormal,
      dimensions: { width: 1, height: 1 },
    },
  }, { onIndicatorComplete() {} }), /dimensions/);
});

function loadedResources(assetTree: '480x800' | '720x1280') {
  const contract = getClassicPresentationResources(assetTree);
  return {
    failFilled: { ...contract.failFilled, spriteFrame: new cc.SpriteFrame(
      contract.failFilled.dimensions.width,
      contract.failFilled.dimensions.height,
    ) },
    failNormal: { ...contract.failNormal, spriteFrame: new cc.SpriteFrame(
      contract.failNormal.dimensions.width,
      contract.failNormal.dimensions.height,
    ) },
  };
}

function vector(value: Readonly<{ x: number; y: number }>) {
  return { x: value.x, y: value.y };
}

function vector3(value: Readonly<{ x: number; y: number; z: number }>) {
  return { x: value.x, y: value.y, z: value.z };
}

function size(value: Readonly<{ width: number; height: number }>) {
  return { width: value.width, height: value.height };
}
