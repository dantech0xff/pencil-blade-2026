import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const events = [];
export const faults = {
  destroyName: null,
  setParentName: null,
};
export const nodes = [];
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
    nodes.push(this);
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
    if (faults.setParentName === this.name) {
      faults.setParentName = null;
      throw new Error('injected setParent failure: ' + this.name);
    }
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
    if (faults.destroyName === this.name) {
      faults.destroyName = null;
      throw new Error('injected destroy failure: ' + this.name);
    }
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
  getGnStyleSupplementalRasterSet,
} = await import(
  '../../../game/assets/scripts/domain/gn-style-resource-contract.ts'
);
const {
  GnStyleIntroPresenter,
} = await import(
  '../../../game/assets/scripts/creator/gn-style-intro-presenter.ts'
);

interface StubNode {
  active: boolean;
  readonly activeInHierarchy: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  layer: number;
  readonly name: string;
  readonly parent: StubNode | null;
  readonly worldPosition: Readonly<{ x: number; y: number; z: number }>;
}

interface CocosStub {
  readonly events: string[];
  readonly faults: {
    destroyName: string | null;
    setParentName: string | null;
  };
  readonly Node: new (name?: string) => StubNode;
  readonly nodes: StubNode[];
}

test('detached construction, attachment, and variable native phases preserve exact order', () => {
  cc.events.length = 0;
  cc.nodes.length = 0;
  const callbacks: string[] = [];
  const fixture = resourceFixture('480x800');
  const presenter = GnStyleIntroPresenter.create({
    logicalHeight: 800,
    resources: fixture.resources as never,
    visibleRect: visibleRect('480x800'),
  }, lifecycle(callbacks));

  assert.deepEqual(
    cc.events.filter((event) => event.startsWith('create:')),
    [
      'create:GnStyleIntroRoot',
      'create:GnStyleIntroNoBomb',
      'create:GnStyleIntroGnStyle',
      'create:GnStyleIntroNoLife',
    ],
  );
  assert.equal(presenter.root.parent, null);
  assert.equal(presenter.root.active, false);
  assert.deepEqual(childNames(presenter.root as unknown as StubNode), [
    'GnStyleIntroGnStyle',
    'GnStyleIntroNoBomb',
    'GnStyleIntroNoLife',
  ]);
  assert.deepEqual(childPoints(presenter.root as unknown as StubNode), [
    { x: 651, y: 400 },
    { x: -115.5, y: Math.fround(800 * Math.fround(0.6)) },
    { x: -95, y: Math.fround(800 * Math.fround(0.4)) },
  ]);
  assert.deepEqual(fixture.requested, [
    '480x800/Text/text-nobomb.png',
    '480x800/Text/text-gnstyle.png',
    '480x800/Text/text-nolive.png',
  ]);

  presenter.updateAction(10);
  assert.deepEqual(callbacks, []);
  assert.equal(presenter.state.elapsedActionSeconds, 0);
  const parent = new cc.Node('GameplayRoot');
  parent.layer = 17;
  presenter.attach(parent as never);
  presenter.updateAction(10);
  assert.deepEqual(callbacks, []);
  assert.equal(presenter.root.active, false);
  assert.equal(
    (presenter.root as unknown as StubNode).children.every(
      ({ layer }) => layer === 17,
    ),
    true,
  );

  presenter.activate();
  assert.equal(presenter.root.active, true);
  assert.equal(presenter.state.visibleSlideCount, 3);
  presenter.updateAction(0.749);
  assert.equal(presenter.state.phase, 'instructions');
  assert.deepEqual(callbacks, []);
  presenter.updateAction(0.001);

  assert.equal(presenter.state.phase, 'one-hundred-fifty');
  assert.deepEqual(callbacks, ['show-150']);
  assert.deepEqual(childNames(presenter.root as unknown as StubNode), [
    'GnStyleIntroOneHundredFifty',
  ]);
  assert.deepEqual(childPoints(presenter.root as unknown as StubNode), [
    { x: -96, y: 400 },
  ]);

  presenter.updateAction(0.949);
  assert.equal(presenter.state.phase, 'one-hundred-fifty');
  presenter.updateAction(0.001);
  assert.equal(presenter.state.phase, 'go');
  assert.deepEqual(callbacks, ['show-150', 'show-go']);
  assert.deepEqual(childNames(presenter.root as unknown as StubNode), [
    'GnStyleIntroGo',
  ]);
  assertPointNear(
    childPoints(presenter.root as unknown as StubNode)[0],
    { x: -35, y: 400 },
  );

  presenter.updateAction(0.899);
  assert.equal(presenter.state.phase, 'go');
  presenter.updateAction(0.001);
  assert.deepEqual(callbacks, ['show-150', 'show-go', 'start-game']);
  assert.deepEqual(childNames(presenter.root as unknown as StubNode), []);
  assert.deepEqual(presenter.state, {
    active: false,
    attached: true,
    disposed: false,
    elapsedActionSeconds: Math.fround(2.6),
    phase: 'complete',
    phaseElapsedActionSeconds: 0,
    visibleSlideCount: 0,
  });
});

test('attachment accepts a locally active detached screen but activation waits for hierarchy ownership', () => {
  const fixture = resourceFixture('480x800');
  const presenter = GnStyleIntroPresenter.create({
    logicalHeight: 800,
    resources: fixture.resources as never,
    visibleRect: visibleRect('480x800'),
  }, lifecycle([]));
  const detachedScreen = new cc.Node('DetachedGameplayRoot');
  Object.defineProperty(detachedScreen, 'activeInHierarchy', {
    configurable: true,
    get: () => detachedScreen.parent !== null && detachedScreen.active,
  });

  presenter.attach(detachedScreen as never);
  assert.equal(presenter.state.attached, true);
  assert.throws(() => presenter.activate(), /attached before activation/);

  detachedScreen.setParent(new cc.Node('ActiveScreenHost'));
  presenter.activate();
  assert.equal(presenter.state.active, true);
});

test('both profiles request only exact intro resources and overshoot invokes each continuation once', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    const callbacks: string[] = [];
    const fixture = resourceFixture(assetTree);
    const presenter = GnStyleIntroPresenter.create({
      logicalHeight: assetTree === '480x800' ? 800 : 1280,
      resources: fixture.resources as never,
      visibleRect: visibleRect(assetTree),
    }, lifecycle(callbacks));
    presenter.attach(new cc.Node('GameplayRoot') as never);
    presenter.activate();

    assert.deepEqual(
      presenter.plan.instructions.gnStyle.actionSequence.map(
        ({ durationSeconds }) => durationSeconds,
      ),
      [Math.fround(0.25), Math.fround(0.25), Math.fround(0.25)],
    );
    assert.deepEqual(
      presenter.plan.oneHundredFifty.actionSequence.map(
        ({ durationSeconds }) => durationSeconds,
      ),
      [Math.fround(0.35), Math.fround(0.25), Math.fround(0.35)],
    );
    assert.deepEqual(
      presenter.plan.go.actionSequence.map(
        ({ durationSeconds }) => durationSeconds,
      ),
      [Math.fround(0.325), Math.fround(0.25), Math.fround(0.325)],
    );
    assert.equal(
      presenter.plan.instructions.noBomb.completion,
      null,
    );
    assert.equal(
      presenter.plan.instructions.gnStyle.completion,
      'show-one-hundred-fifty',
    );
    assert.equal(
      presenter.plan.instructions.noLife.completion,
      null,
    );

    presenter.updateAction(10);
    presenter.updateAction(10);

    assert.deepEqual(callbacks, ['show-150', 'show-go', 'start-game']);
    assert.equal(presenter.state.phase, 'complete');
    assert.equal(
      presenter.state.elapsedActionSeconds,
      Math.fround(2.6),
    );
    assert.deepEqual(fixture.requested, [
      `${assetTree}/Text/text-nobomb.png`,
      `${assetTree}/Text/text-gnstyle.png`,
      `${assetTree}/Text/text-nolive.png`,
      `${assetTree}/Text/text-150s.png`,
      `${assetTree}/Text/text-go.png`,
    ]);
  }
});

test('construction and phase faults roll back without losing retryability', () => {
  cc.nodes.length = 0;
  const failedConstruction = resourceFixture('480x800');
  failedConstruction.failPath = '480x800/Text/text-gnstyle.png';
  assert.throws(
    () => GnStyleIntroPresenter.create({
      logicalHeight: 800,
      resources: failedConstruction.resources as never,
      visibleRect: visibleRect('480x800'),
    }, lifecycle([])),
    /injected raster failure/,
  );
  assert.equal(
    cc.nodes.filter(({ destroyed }) => !destroyed).length,
    0,
  );

  const callbacks: string[] = [];
  const fixture = resourceFixture('480x800');
  const presenter = GnStyleIntroPresenter.create({
    logicalHeight: 800,
    resources: fixture.resources as never,
    visibleRect: visibleRect('480x800'),
  }, lifecycle(callbacks));
  presenter.attach(new cc.Node('GameplayRoot') as never);
  presenter.activate();

  fixture.failPath = '480x800/Text/text-150s.png';
  assert.throws(
    () => presenter.updateAction(0.75),
    /injected raster failure/,
  );
  assert.equal(presenter.state.phase, 'instructions');
  assert.equal(presenter.state.visibleSlideCount, 3);
  assert.deepEqual(callbacks, []);

  fixture.failPath = null;
  presenter.updateAction(0);
  assert.equal(presenter.state.phase, 'one-hundred-fifty');
  assert.deepEqual(callbacks, ['show-150']);

  cc.faults.setParentName = 'GnStyleIntroGo';
  assert.throws(
    () => presenter.updateAction(0.95),
    /injected setParent failure/,
  );
  assert.equal(presenter.state.phase, 'one-hundred-fifty');
  assert.deepEqual(childNames(presenter.root as unknown as StubNode), [
    'GnStyleIntroOneHundredFifty',
  ]);
  assert.deepEqual(callbacks, ['show-150']);

  presenter.updateAction(0);
  presenter.updateAction(10);
  assert.deepEqual(callbacks, ['show-150', 'show-go', 'start-game']);
});

test('attach and disposal faults remain retryable and all boundaries fail closed', () => {
  const fixture = resourceFixture('480x800');
  assert.throws(
    () => GnStyleIntroPresenter.create({
      logicalHeight: 800,
      resources: fixture.resources as never,
      visibleRect: visibleRect('480x800'),
    }, {} as never),
    /onShowOneHundredFifty/,
  );
  const presenter = GnStyleIntroPresenter.create({
    logicalHeight: 800,
    resources: fixture.resources as never,
    visibleRect: visibleRect('480x800'),
  }, lifecycle([]));
  assert.throws(() => presenter.activate(), /attached/);
  assert.throws(() => presenter.updateAction(-1), /non-negative/);

  const parent = new cc.Node('GameplayRoot');
  cc.faults.setParentName = 'GnStyleIntroRoot';
  assert.throws(
    () => presenter.attach(parent as never),
    /injected setParent failure/,
  );
  assert.equal(presenter.root.parent, null);
  assert.equal(presenter.state.attached, false);

  presenter.attach(parent as never);
  presenter.activate();
  assert.throws(() => presenter.activate(), /only once/);
  cc.faults.destroyName = 'GnStyleIntroRoot';
  assert.throws(
    () => presenter.dispose(),
    /injected destroy failure/,
  );
  assert.equal(presenter.state.disposed, false);
  assert.equal(presenter.state.active, false);
  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
  assert.equal(presenter.root.destroyed, true);
  assert.equal(presenter.state.disposed, true);
});

function lifecycle(callbacks: string[]) {
  return {
    onShowGo: () => callbacks.push('show-go'),
    onShowOneHundredFifty: () => callbacks.push('show-150'),
    onStartGame: () => callbacks.push('start-game'),
  };
}

function resourceFixture(assetTree: '480x800' | '720x1280') {
  const contracts = getGnStyleSupplementalRasterSet(assetTree);
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
    rasterCount: 11,
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

function visibleRect(assetTree: '480x800' | '720x1280') {
  return assetTree === '480x800'
    ? {
        center: { x: 240, y: 400 },
        leftX: 0,
        rightX: 480,
      }
    : {
        center: { x: 360, y: 640 },
        leftX: 0,
        rightX: 720,
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

function assertPointNear(
  actual: Readonly<{ readonly x: number; readonly y: number }> | undefined,
  expected: Readonly<{ readonly x: number; readonly y: number }>,
): void {
  assert.ok(actual);
  assert.ok(Math.abs(actual.x - expected.x) < 1e-4);
  assert.ok(Math.abs(actual.y - expected.y) < 1e-4);
}
