import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const CC_STUB_URL = moduleUrl(`
let failOnCall = 0;
let onCallCount = 0;
export function configureNodeOnFailure(call) {
  failOnCall = call;
  onCallCount = 0;
}
export class UITransform {
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
  setContentSize(width, height) { this.contentSize = { width, height }; }
}
export class Sprite {
  static SizeMode = Object.freeze({ CUSTOM: 'CUSTOM' });
  constructor() { this.sizeMode = null; this.spriteFrame = null; }
}
export class Node {
  static EventType = Object.freeze({
    TOUCH_CANCEL: 'touch-cancel',
    TOUCH_END: 'touch-end',
    TOUCH_START: 'touch-start',
  });
  constructor(name = '') {
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyed = false;
    this.listeners = new Map();
    this.name = name;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
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
  emit(type) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener();
  }
  getComponent(Type) { return this.components.get(Type) ?? null; }
  listenerCount(type) { return (this.listeners.get(type) ?? []).length; }
  off(type, callback) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((listener) => listener !== callback),
    );
  }
  on(type, callback) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(callback);
    this.listeners.set(type, listeners);
    onCallCount += 1;
    if (failOnCall !== 0 && onCallCount === failOnCall) {
      throw new Error('injected selector listener registration failure');
    }
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
}
export function isValid(value) {
  return value !== null && value !== undefined && !value.destroyed;
}
`);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') return { shortCircuit: true, url: CC_STUB_URL };
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
  configureNodeOnFailure(call: number): void;
  readonly Node: typeof StubNode;
  readonly Sprite: new () => StubSprite;
};
const { OptionsItemSelectorPresenter } = await import(
  '../../../game/assets/scripts/creator/options-item-selector-presenter.ts'
);

interface StubSprite {
  spriteFrame: unknown;
}

class StubNode {
  static readonly EventType: Readonly<{
    TOUCH_CANCEL: string;
    TOUCH_END: string;
    TOUCH_START: string;
  }>;

  active = true;
  readonly children: StubNode[] = [];
  destroyed = false;
  readonly name = '';
  readonly position = { x: 0, y: 0, z: 0 };

  emit(_type: string): void {}
  getComponent<T>(_type: new () => T): T | null { return null; }
  listenerCount(_type: string): number { return 0; }
}

test('selector preserves recovered geometry, bounded callbacks, and listener lifecycle', () => {
  const selections: number[] = [];
  const icons = [
    raster('icon-0', 50, 51),
    raster('icon-1', 52, 53),
    raster('icon-2', 54, 55),
  ];
  const previous = {
    normal: raster('previous-normal', 20, 21),
    selected: raster('previous-selected', 22, 23),
  };
  const next = {
    normal: raster('next-normal', 24, 25),
    selected: raster('next-selected', 26, 27),
  };
  const presenter = OptionsItemSelectorPresenter.create({
    icons,
    name: 'background-selector',
    next,
    onSelectionChanged: (index: number) => selections.push(index),
    previous,
    selectedIndex: 1,
    selectorBackground: raster('selector-background', 100, 101),
  });
  const previousNode = requireChild(presenter.root, 'previous');
  const nextNode = requireChild(presenter.root, 'next');
  const selectedItem = requireChild(presenter.root, 'selected-item');

  assert.equal(presenter.root.active, false);
  assert.equal(previousNode.position.x, -100);
  assert.equal(nextNode.position.x, 100);
  assert.equal(previousNode.listenerCount(cc.Node.EventType.TOUCH_END), 0);
  assert.equal(nextNode.listenerCount(cc.Node.EventType.TOUCH_END), 0);
  assert.equal(spriteOf(selectedItem).spriteFrame, icons[1]?.spriteFrame);

  presenter.activate();
  assert.equal(presenter.root.active, true);
  assert.equal(previousNode.listenerCount(cc.Node.EventType.TOUCH_END), 1);
  assert.equal(nextNode.listenerCount(cc.Node.EventType.TOUCH_END), 1);

  previousNode.emit(cc.Node.EventType.TOUCH_START);
  assert.equal(spriteOf(previousNode).spriteFrame, previous.selected.spriteFrame);
  previousNode.emit(cc.Node.EventType.TOUCH_CANCEL);
  assert.equal(spriteOf(previousNode).spriteFrame, previous.normal.spriteFrame);
  previousNode.emit(cc.Node.EventType.TOUCH_END);
  assert.equal(presenter.selectedIndex, 0);
  assert.deepEqual(selections, [0]);

  previousNode.emit(cc.Node.EventType.TOUCH_END);
  assert.equal(presenter.selectedIndex, 0);
  assert.deepEqual(selections, [0]);

  nextNode.emit(cc.Node.EventType.TOUCH_END);
  nextNode.emit(cc.Node.EventType.TOUCH_END);
  nextNode.emit(cc.Node.EventType.TOUCH_END);
  assert.equal(presenter.selectedIndex, 2);
  assert.deepEqual(selections, [0, 1, 2]);
  assert.equal(spriteOf(selectedItem).spriteFrame, icons[2]?.spriteFrame);

  assert.equal(presenter.select(0), true);
  assert.equal(presenter.select(0), false);
  assert.equal(presenter.selectedIndex, 0);
  assert.deepEqual(selections, [0, 1, 2]);

  assert.equal(presenter.suspend(), true);
  assert.equal(presenter.root.active, true);
  assert.equal(nextNode.listenerCount(cc.Node.EventType.TOUCH_END), 0);
  nextNode.emit(cc.Node.EventType.TOUCH_END);
  assert.equal(presenter.selectedIndex, 0);
  assert.equal(presenter.suspend(), false);

  presenter.activate();
  assert.equal(nextNode.listenerCount(cc.Node.EventType.TOUCH_END), 1);
  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.root.destroyed, true);
  assert.equal(presenter.dispose(), false);
  assert.throws(() => presenter.select(1), /Disposed Options selector/);
});

test('selector rejects empty catalogs and invalid initial or programmatic indices', () => {
  const base = {
    icons: [raster('icon-0', 50, 50)],
    name: 'selector',
    next: {
      normal: raster('next-normal', 20, 20),
      selected: raster('next-selected', 20, 20),
    },
    onSelectionChanged() {},
    previous: {
      normal: raster('previous-normal', 20, 20),
      selected: raster('previous-selected', 20, 20),
    },
    selectedIndex: 0,
    selectorBackground: raster('selector-background', 100, 100),
  };

  assert.throws(
    () => OptionsItemSelectorPresenter.create({ ...base, icons: [] }),
    /at least one icon/,
  );
  assert.throws(
    () => OptionsItemSelectorPresenter.create({ ...base, selectedIndex: 1 }),
    /selectedIndex/,
  );
  const presenter = OptionsItemSelectorPresenter.create(base);
  assert.throws(() => presenter.select(-1), /Options selector index/);
  presenter.dispose();
});

test('partial listener registration is removed before activation can retry', () => {
  const presenter = OptionsItemSelectorPresenter.create({
    icons: [
      raster('icon-0', 50, 50),
      raster('icon-1', 50, 50),
    ],
    name: 'failure-safe-selector',
    next: {
      normal: raster('next-normal', 20, 20),
      selected: raster('next-selected', 20, 20),
    },
    onSelectionChanged() {},
    previous: {
      normal: raster('previous-normal', 20, 20),
      selected: raster('previous-selected', 20, 20),
    },
    selectedIndex: 0,
    selectorBackground: raster('selector-background', 100, 100),
  });
  const previous = requireChild(presenter.root, 'previous');
  const next = requireChild(presenter.root, 'next');

  cc.configureNodeOnFailure(5);
  assert.throws(
    () => presenter.activate(),
    /injected selector listener registration failure/,
  );
  assert.equal(presenter.root.active, false);
  for (const node of [previous, next]) {
    assert.equal(node.listenerCount(cc.Node.EventType.TOUCH_START), 0);
    assert.equal(node.listenerCount(cc.Node.EventType.TOUCH_CANCEL), 0);
    assert.equal(node.listenerCount(cc.Node.EventType.TOUCH_END), 0);
  }

  cc.configureNodeOnFailure(0);
  presenter.activate();
  for (const node of [previous, next]) {
    assert.equal(node.listenerCount(cc.Node.EventType.TOUCH_START), 1);
    assert.equal(node.listenerCount(cc.Node.EventType.TOUCH_CANCEL), 1);
    assert.equal(node.listenerCount(cc.Node.EventType.TOUCH_END), 1);
  }
  presenter.dispose();
});

function raster(name: string, width: number, height: number) {
  return Object.freeze({
    canonicalPath: `480x800/${name}.png`,
    dimensions: Object.freeze({ height, width }),
    spriteFrame: Object.freeze({ name }),
  });
}

function requireChild(root: StubNode, name: string): StubNode {
  const child = root.children.find((candidate) => candidate.name === name);
  assert.ok(child, `Missing child ${name}`);
  return child;
}

function spriteOf(node: StubNode): StubSprite {
  const sprite = node.getComponent(cc.Sprite);
  assert.ok(sprite);
  return sprite;
}

function moduleUrl(source: string): string {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
