import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const destroyedNames = [];

export class Color {
  constructor(r = 0, g = 0, b = 0, a = 255) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
}

export class Label {
  constructor() {
    this.color = null;
    this.font = null;
    this.fontSize = 0;
    this.lineHeight = 0;
    this.string = '';
  }
}

export class UITransform {}

export class Node {
  constructor(name = '') {
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyed = false;
    this.layer = 0;
    this.name = name;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
    this.siblingIndex = null;
  }
  get activeInHierarchy() {
    return this.active && !this.destroyed
      && (this.parent === null || this.parent.activeInHierarchy);
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
    destroyedNames.push(this.name);
    this.setParent(null);
  }
  setParent(parent) {
    if (this.parent !== null) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
  }
  setPosition(x, y, z) {
    this.position = { x, y, z };
  }
  setScale(x, y, z) {
    this.scale = { x, y, z };
  }
  setSiblingIndex(index) {
    this.siblingIndex = index;
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
  readonly destroyedNames: string[];
  readonly Node: new (name?: string) => StubNode;
};
const { ComboItemPresenter } = await import(
  '../../../game/assets/scripts/creator/combo-item-presenter.ts'
);

interface StubNode {
  active: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  layer: number;
  readonly name: string;
  parent: StubNode | null;
  readonly position: { x: number; y: number; z: number };
  readonly scale: { x: number; y: number; z: number };
  siblingIndex: number | null;
}

test('presenter creates exact GroBold label content, geometry, color, and equal-z nodes', () => {
  let disposedCount = 0;
  const presenter = ComboItemPresenter.create({
    count: 6,
    fontResource: {
      canonicalPath: 'Fonts/GroBold.ttf',
      font: { name: 'GroBold' },
    },
    position: { x: 123, y: 456 },
    viewportWidth: 720,
  }, {
    onDisposed: () => {
      disposedCount += 1;
    },
  });

  assert.equal(presenter.root.name, 'ComboItem');
  assert.equal(presenter.root.active, false);
  assert.equal(presenter.labelNode.name, 'ComboItemLabel');
  assert.deepEqual(presenter.labelNode.position, { x: 123, y: 456, z: 0 });
  assert.deepEqual(presenter.labelNode.scale, { x: 0, y: 0, z: 1 });
  assert.equal(presenter.label.string, '+6 Fruits\nCombo');
  assert.equal(presenter.label.fontSize, 48);
  assert.equal(presenter.label.lineHeight, 48);
  assert.deepEqual({
    r: presenter.label.color.r,
    g: presenter.label.color.g,
    b: presenter.label.color.b,
    a: presenter.label.color.a,
  }, { r: 255, g: 0, b: 255, a: 255 });

  const parent = new cc.Node('WorldRoot');
  parent.layer = 19;
  presenter.attach(parent as never);
  assert.equal(presenter.root.parent, parent);
  assert.equal(presenter.root.layer, 19);
  assert.equal(presenter.labelNode.layer, 19);
  assert.equal(presenter.root.siblingIndex, 1);
  assert.equal(presenter.labelNode.siblingIndex, 1);
  assert.equal(presenter.root.active, true);
  assert.equal(presenter.isAttached, true);
  assert.equal(disposedCount, 0);
});

test('natural completion removes label then owner and notifies exactly once', () => {
  cc.destroyedNames.length = 0;
  let disposedCount = 0;
  const presenter = ComboItemPresenter.create({
    count: 3,
    fontResource: {
      canonicalPath: 'Fonts/GroBold.ttf',
      font: { name: 'GroBold' },
    },
    position: { x: 0, y: 0 },
    viewportWidth: 480,
  }, {
    onDisposed: () => {
      disposedCount += 1;
    },
  });
  presenter.attach(new cc.Node('WorldRoot') as never);

  presenter.updateAction(0.15);
  assert.deepEqual(presenter.labelNode.scale, { x: 1, y: 1, z: 1 });
  presenter.updateAction(1.5);
  assert.deepEqual(presenter.labelNode.scale, { x: 1, y: 1, z: 1 });
  presenter.updateAction(0.25);
  assert.ok(Math.abs(presenter.labelNode.scale.x - 1.15) < 1e-6);
  presenter.updateAction(0.15);

  assert.equal(presenter.isDisposed, true);
  assert.equal(disposedCount, 1);
  assert.deepEqual(cc.destroyedNames.slice(-2), ['ComboItemLabel', 'ComboItem']);
  assert.equal(presenter.dispose(), false);
  presenter.updateAction(10);
  assert.equal(disposedCount, 1);
});

test('invalid font and lifecycle inputs fail before creating an attachable owner', () => {
  assert.throws(
    () => ComboItemPresenter.create({
      count: 3,
      fontResource: {
        canonicalPath: 'Fonts/Linds.ttf',
        font: {},
      },
      position: { x: 0, y: 0 },
      viewportWidth: 480,
    }),
    /Fonts\/GroBold\.ttf/,
  );
  assert.throws(
    () => ComboItemPresenter.create({
      count: 3,
      fontResource: {
        canonicalPath: 'Fonts/GroBold.ttf',
        font: {},
      },
      position: { x: 0, y: 0 },
      viewportWidth: 480,
    }, {
      onDisposed: 1 as never,
    }),
    /onDisposed must be a function/,
  );
});
