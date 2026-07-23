import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const events = [];
export class UITransform {
  constructor() { this.anchorPoint = null; this.contentSize = null; }
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
  setContentSize(width, height) { this.contentSize = { width, height }; }
}
export class Sprite {
  static SizeMode = Object.freeze({ CUSTOM: 'CUSTOM' });
  constructor() { this.sizeMode = null; this.spriteFrame = null; }
}
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
    events.push('create:' + name);
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
    events.push('destroy:' + this.name);
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
  getComboBirdSupplementalRasterSet,
} = await import(
  '../../../game/assets/scripts/domain/combo-bird-resource-contract.ts'
);
const {
  ComboBirdIntroPresenter,
} = await import(
  '../../../game/assets/scripts/creator/combo-bird-intro-presenter.ts'
);

interface StubNode {
  active: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  layer: number;
  readonly name: string;
  readonly parent: StubNode | null;
  readonly worldPosition: Readonly<{ x: number; y: number; z: number }>;
}

interface CocosStub {
  readonly Node: new (name?: string) => StubNode;
  readonly events: string[];
}

test('instruction construction, attachment, geometry, and callbacks preserve recovered order', () => {
  const callbacks: string[] = [];
  const fixture = resourceFixture('480x800');
  const presenter = ComboBirdIntroPresenter.create({
    logicalHeight: 800,
    resources: fixture.resources as never,
    visibleRect: compactVisibleRect(),
  }, {
    onComplete: () => callbacks.push('complete'),
    onGo: () => callbacks.push('go'),
    onNinety: () => callbacks.push('ninety'),
  });
  const parent = new cc.Node('GameplayRoot');
  parent.layer = 17;
  presenter.attach(parent as never);
  cc.events.length = 0;

  presenter.activate();
  assert.deepEqual(
    cc.events.filter((event) => event.startsWith('create:')),
    [
      'create:ComboBirdIntroNoBomb',
      'create:ComboBirdIntroJustCombo',
      'create:ComboBirdIntroNoLife',
    ],
  );
  assert.deepEqual(childNames(presenter.root as unknown as StubNode), [
    'ComboBirdIntroJustCombo',
    'ComboBirdIntroNoBomb',
    'ComboBirdIntroNoLife',
  ]);
  assert.deepEqual(
    childPoints(presenter.root as unknown as StubNode),
    [
      { x: 623, y: 400 },
      { x: -115.5, y: Math.fround(800 * Math.fround(0.6)) },
      { x: -95, y: Math.fround(800 * Math.fround(0.4)) },
    ],
  );
  assert.equal(
    (presenter.root as unknown as StubNode).children.every(
      ({ layer }) => layer === 17,
    ),
    true,
  );
  assert.deepEqual(fixture.requested, [
    '480x800/Text/text-nobomb.png',
    '480x800/Text/text-juscombo.png',
    '480x800/Text/text-nolive.png',
  ]);

  presenter.updateAction(0.5);
  assert.deepEqual(childPoints(presenter.root as unknown as StubNode), [
    { x: 240, y: 400 },
    { x: 240, y: Math.fround(800 * Math.fround(0.6)) },
    { x: 240, y: Math.fround(800 * Math.fround(0.4)) },
  ]);
  presenter.updateAction(0.75);

  assert.deepEqual(callbacks, ['ninety']);
  assert.deepEqual(childNames(presenter.root as unknown as StubNode), [
    'ComboBirdIntroNinety',
  ]);
  assert.deepEqual(childPoints(presenter.root as unknown as StubNode), [
    { x: -84.5, y: 400 },
  ]);
  assert.equal(presenter.state.phase, 'ninety');

  presenter.updateAction(1.25);
  assert.deepEqual(callbacks, ['ninety', 'go']);
  assert.deepEqual(childNames(presenter.root as unknown as StubNode), [
    'ComboBirdIntroGo',
  ]);
  assert.deepEqual(childPoints(presenter.root as unknown as StubNode), [
    { x: -35, y: 400 },
  ]);

  presenter.updateAction(1.25);
  assert.deepEqual(callbacks, ['ninety', 'go', 'complete']);
  assert.deepEqual(childNames(presenter.root as unknown as StubNode), []);
  assert.deepEqual(presenter.state, {
    active: false,
    attached: true,
    disposed: false,
    elapsedActionSeconds: 3.75,
    phase: 'complete',
    phaseElapsedActionSeconds: 0,
    visibleSlideCount: 0,
  });
});

test('overshoot crosses the complete intro once and each tree requests its literal alias', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    const fixture = resourceFixture(assetTree);
    const callbacks: string[] = [];
    const presenter = ComboBirdIntroPresenter.create({
      logicalHeight: assetTree === '480x800' ? 800 : 1280,
      resources: fixture.resources as never,
      visibleRect: assetTree === '480x800'
        ? compactVisibleRect()
        : {
            center: { x: 360, y: 640 },
            leftX: 0,
            rightX: 720,
          },
    }, {
      onComplete: () => callbacks.push('complete'),
      onGo: () => callbacks.push('go'),
      onNinety: () => callbacks.push('ninety'),
    });
    presenter.attach(new cc.Node('GameplayRoot') as never);
    presenter.activate();
    presenter.updateAction(10);
    presenter.updateAction(10);

    assert.deepEqual(callbacks, ['ninety', 'go', 'complete']);
    assert.equal(presenter.state.phase, 'complete');
    assert.equal(
      fixture.requested.includes(
        assetTree === '480x800'
          ? '480x800/Text/text-juscombo.png'
          : '720x1280/Text/text-justcombo.png',
      ),
      true,
    );
    assert.equal(
      fixture.requested.some((path) => path.includes(
        assetTree === '480x800' ? 'text-justcombo' : 'text-juscombo',
      )),
      false,
    );
  }
});

test('failed instruction construction rolls back and remains retryable', () => {
  const fixture = resourceFixture('480x800');
  fixture.failPath = '480x800/Text/text-juscombo.png';
  const presenter = ComboBirdIntroPresenter.create({
    logicalHeight: 800,
    resources: fixture.resources as never,
    visibleRect: compactVisibleRect(),
  }, {
    onComplete() {},
    onGo() {},
    onNinety() {},
  });
  presenter.attach(new cc.Node('GameplayRoot') as never);

  assert.throws(() => presenter.activate(), /injected raster failure/);
  assert.equal(presenter.root.active, false);
  assert.deepEqual(childNames(presenter.root as unknown as StubNode), []);
  assert.equal(presenter.state.active, false);
  assert.equal(presenter.state.visibleSlideCount, 0);

  fixture.failPath = null;
  presenter.activate();
  assert.equal(presenter.state.active, true);
  assert.equal(presenter.state.visibleSlideCount, 3);
});

test('input, activation, and disposal boundaries fail closed', () => {
  const fixture = resourceFixture('480x800');
  assert.throws(
    () => ComboBirdIntroPresenter.create({
      logicalHeight: 800,
      resources: fixture.resources as never,
      visibleRect: compactVisibleRect(),
    }, {} as never),
    /onComplete/,
  );
  const presenter = ComboBirdIntroPresenter.create({
    logicalHeight: 800,
    resources: fixture.resources as never,
    visibleRect: compactVisibleRect(),
  }, {
    onComplete() {},
    onGo() {},
    onNinety() {},
  });
  assert.throws(() => presenter.activate(), /attached/);
  assert.throws(() => presenter.updateAction(-1), /non-negative/);
  presenter.attach(new cc.Node('GameplayRoot') as never);
  presenter.activate();
  assert.throws(() => presenter.activate(), /only once/);
  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
  assert.equal(presenter.root.destroyed, true);
  assert.equal(presenter.state.disposed, true);
});

function resourceFixture(assetTree: '480x800' | '720x1280') {
  const contracts = getComboBirdSupplementalRasterSet(assetTree);
  const loadedByPath = new Map(
    Object.values(contracts).map((resource) => [
      resource.canonicalPath,
      Object.freeze({
        ...resource,
        spriteFrame: Object.freeze({ canonicalPath: resource.canonicalPath }),
      }),
    ]),
  );
  const requested: string[] = [];
  const fixture: {
    failPath: string | null;
    readonly requested: string[];
    readonly resources: object;
  } = {
    failPath: null,
    requested,
    resources: {},
  };
  fixture.resources = Object.freeze({
    assetTree,
    freezeClock: loadedByPath.get(contracts.freezeClock.canonicalPath),
    rasterCount: 7,
    timeManagerFont: Object.freeze({}),
    timeUp: loadedByPath.get(contracts.timeUp.canonicalPath),
    raster(resource: Readonly<{ canonicalPath: string }>) {
      requested.push(resource.canonicalPath);
      if (resource.canonicalPath === fixture.failPath) {
        throw new Error('injected raster failure');
      }
      const loaded = loadedByPath.get(resource.canonicalPath);
      if (loaded === undefined) {
        throw new Error(`unexpected resource ${resource.canonicalPath}`);
      }
      return loaded;
    },
  });
  return fixture;
}

function compactVisibleRect() {
  return {
    center: { x: 240, y: 400 },
    leftX: 0,
    rightX: 480,
  };
}

function childNames(node: StubNode): string[] {
  return node.children.map(({ name }) => name);
}

function childPoints(
  node: StubNode,
): Readonly<{ readonly x: number; readonly y: number }>[] {
  return node.children.map(({ worldPosition }) => ({
    x: worldPosition.x,
    y: worldPosition.y,
  }));
}
