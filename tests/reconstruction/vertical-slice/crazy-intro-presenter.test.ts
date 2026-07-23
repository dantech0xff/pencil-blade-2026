import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export class UITransform {
  constructor() { this.anchorPoint = null; this.contentSize = null; }
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
  setContentSize(width, height) { this.contentSize = { width, height }; }
}
export class Sprite {
  static SizeMode = Object.freeze({ CUSTOM: 'CUSTOM' });
  constructor() { this.sizeMode = null; this.spriteFrame = null; }
}
export class UIOpacity { constructor() { this.opacity = 255; } }
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
  setParent(parent) {
    if (this.parent !== null) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
  }
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
  destroy() {
    if (this.destroyed) return;
    for (const child of [...this.children]) child.destroy();
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
const { CrazyIntroPresenter } = await import(
  '../../../game/assets/scripts/creator/crazy-intro-presenter.ts'
);

interface StubNode {
  active: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  layer: number;
  readonly name: string;
  readonly parent: StubNode | null;
  readonly worldPosition: Readonly<{ x: number; y: number; z: number }>;
  getComponent<T>(Type: new () => T): T | null;
}

interface CocosStub {
  readonly Node: new (name?: string) => StubNode;
  readonly UIOpacity: new () => { opacity: number };
}

test('Crazy intro presents exact 60s then GO tracks and completes at two action seconds', () => {
  const completed: string[] = [];
  const presenter = CrazyIntroPresenter.create(input(), {
    onComplete: () => completed.push('complete'),
  });
  const parent = new cc.Node('GameplayRoot');
  parent.layer = 17;
  presenter.attach(parent as never);

  assert.equal(presenter.root.active, false);
  assert.deepEqual(presenter.state, {
    active: false,
    attached: true,
    disposed: false,
    elapsedActionSeconds: 0,
    phase: 'sixty',
    slideElapsedActionSeconds: 0,
  });

  presenter.activate();
  let slide = requireOnlyChild(presenter.root as unknown as StubNode);
  assert.equal(slide.name, 'CrazyIntroSixty');
  assert.equal(slide.layer, 17);
  assert.deepEqual(point(slide.worldPosition), { x: -83.5, y: 400 });
  assert.equal(requireOpacity(slide).opacity, 0);

  presenter.updateAction(0.125);
  assert.deepEqual(point(slide.worldPosition), { x: 78.25, y: 400 });
  assert.equal(requireOpacity(slide).opacity, 127.5);
  presenter.updateAction(0.125);
  assert.deepEqual(point(slide.worldPosition), { x: 240, y: 400 });
  assert.equal(requireOpacity(slide).opacity, 255);
  presenter.updateAction(0.5);
  assert.deepEqual(point(slide.worldPosition), { x: 240, y: 400 });
  presenter.updateAction(0.25);

  assert.equal(slide.destroyed, true);
  slide = requireOnlyChild(presenter.root as unknown as StubNode);
  assert.equal(slide.name, 'CrazyIntroGo');
  assert.deepEqual(point(slide.worldPosition), { x: -35, y: 400 });
  assert.equal(requireOpacity(slide).opacity, 0);
  assert.equal(presenter.state.phase, 'go');
  assert.deepEqual(completed, []);

  presenter.updateAction(1);
  assert.equal(slide.destroyed, true);
  assert.equal((presenter.root as unknown as StubNode).children.length, 0);
  assert.deepEqual(completed, ['complete']);
  assert.deepEqual(presenter.state, {
    active: false,
    attached: true,
    disposed: false,
    elapsedActionSeconds: 2,
    phase: 'complete',
    slideElapsedActionSeconds: 0,
  });
  presenter.updateAction(100);
  assert.deepEqual(completed, ['complete']);
});

test('overshoot crosses both slides once while zero delta preserves the initial frame', () => {
  let completions = 0;
  const presenter = CrazyIntroPresenter.create(input(), {
    onComplete: () => { completions += 1; },
  });
  presenter.attach(new cc.Node('GameplayRoot') as never);
  presenter.activate();
  presenter.updateAction(0);
  assert.equal(presenter.state.phase, 'sixty');
  assert.equal(presenter.state.elapsedActionSeconds, 0);
  presenter.updateAction(10);
  assert.equal(presenter.state.phase, 'complete');
  assert.equal(presenter.state.elapsedActionSeconds, 2);
  assert.equal(completions, 1);
});

test('activation, input, and disposal boundaries fail closed', () => {
  assert.throws(
    () => CrazyIntroPresenter.create(input(), {} as never),
    /onComplete/,
  );
  const presenter = CrazyIntroPresenter.create(input(), { onComplete() {} });
  assert.throws(() => presenter.activate(), /attached/);
  assert.throws(() => presenter.updateAction(-1), /non-negative/);
  const parent = new cc.Node('GameplayRoot');
  presenter.attach(parent as never);
  presenter.activate();
  assert.throws(() => presenter.activate(), /only once/);
  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
  assert.equal(presenter.root.destroyed, true);
  assert.equal(presenter.state.disposed, true);
});

function input() {
  const frames = new Map<string, object>();
  return {
    resources: {
      assetTree: '480x800',
      rasterCount: 37,
      raster(resource: Readonly<{
        canonicalPath: string;
        dimensions: Readonly<{ width: number; height: number }>;
      }>) {
        let spriteFrame = frames.get(resource.canonicalPath);
        if (spriteFrame === undefined) {
          spriteFrame = Object.freeze({ canonicalPath: resource.canonicalPath });
          frames.set(resource.canonicalPath, spriteFrame);
        }
        return Object.freeze({
          canonicalPath: resource.canonicalPath,
          dimensions: resource.dimensions,
          spriteFrame,
        });
      },
      timeManagerFont: Object.freeze({}),
    },
    visibleRect: {
      center: { x: 240, y: 400 },
      leftX: 0,
      rightX: 480,
    },
  };
}

function requireOnlyChild(node: StubNode): StubNode {
  assert.equal(node.children.length, 1);
  const child = node.children[0];
  assert.ok(child);
  return child;
}

function requireOpacity(node: StubNode): { opacity: number } {
  const opacity = node.getComponent(cc.UIOpacity);
  assert.ok(opacity);
  return opacity;
}

function point(value: Readonly<{ x: number; y: number }>) {
  return { x: value.x, y: value.y };
}
