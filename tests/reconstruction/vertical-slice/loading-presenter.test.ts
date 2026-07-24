import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

const CC_STUB_URL = moduleUrl(`
export const createdNodes = [];
let addComponentFailure = null;
let destroyFailureName = null;
let setParentFailureName = null;
export function failNextAddComponent(nodeName, componentName) {
  addComponentFailure = { componentName, nodeName };
}
export function failNextDestroy(nodeName) {
  destroyFailureName = nodeName;
}
export function failNextSetParent(nodeName) {
  setParentFailureName = nodeName;
}
export function resetInjectedFailures() {
  addComponentFailure = null;
  destroyFailureName = null;
  setParentFailureName = null;
}
export class UITransform {
  constructor() {
    this.anchorPoint = { x: 0.5, y: 0.5 };
    this.contentSize = { height: 0, width: 0 };
  }
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
  setContentSize(width, height) { this.contentSize = { height, width }; }
}
export class Sprite {
  static FillType = Object.freeze({ HORIZONTAL: 'HORIZONTAL' });
  static SizeMode = Object.freeze({ CUSTOM: 'CUSTOM' });
  static Type = Object.freeze({ FILLED: 'FILLED' });
  constructor() {
    this.fillRange = 1;
    this.fillStart = 0;
    this.fillType = null;
    this.sizeMode = null;
    this.spriteFrame = null;
    this.type = null;
  }
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
    this.rotation = { x: 0, y: 0, z: 0, w: 1 };
    this.scale = { x: 1, y: 1, z: 1 };
    createdNodes.push(this);
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
  get worldRotation() { return this.rotation; }
  get worldScale() { return this.scale; }
  addComponent(Type) {
    if (
      addComponentFailure !== null
      && addComponentFailure.nodeName === this.name
      && addComponentFailure.componentName === Type.name
    ) {
      addComponentFailure = null;
      throw new Error('injected addComponent failure');
    }
    const component = new Type();
    component.node = this;
    this.components.set(Type, component);
    return component;
  }
  destroy() {
    if (destroyFailureName === this.name) {
      destroyFailureName = null;
      throw new Error('injected destroy failure');
    }
    if (this.destroyed) return;
    for (const child of [...this.children]) child.destroy();
    this.destroyed = true;
    this.active = false;
    this.setParent(null);
  }
  getComponent(Type) { return this.components.get(Type) ?? null; }
  setParent(parent, keepWorldTransform = false) {
    if (parent !== null && setParentFailureName === this.name) {
      setParentFailureName = null;
      throw new Error('injected setParent failure');
    }
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
    if (this.parent === null) return;
    const siblings = this.parent.children;
    const current = siblings.indexOf(this);
    if (current >= 0) siblings.splice(current, 1);
    siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, this);
  }
  setWorldPosition(x, y, z = 0) {
    if (typeof x === 'object') {
      z = x.z; y = x.y; x = x.x;
    }
    if (this.parent === null) this.position = { x, y, z };
    else {
      const parent = this.parent.worldPosition;
      this.position = { x: x - parent.x, y: y - parent.y, z: z - parent.z };
    }
  }
  setWorldRotation(rotation) { this.rotation = { ...rotation }; }
  setWorldScale(scale) { this.scale = { ...scale }; }
}
export function isValid(value) {
  return value !== null && value !== undefined && value.destroyed !== true;
}
`);

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
  readonly createdNodes: StubNode[];
  readonly failNextAddComponent: (nodeName: string, componentName: string) => void;
  readonly failNextDestroy: (nodeName: string) => void;
  readonly failNextSetParent: (nodeName: string) => void;
  readonly Node: new (name?: string) => StubNode;
  readonly resetInjectedFailures: () => void;
  readonly Sprite: new () => StubSprite;
  readonly UITransform: new () => StubTransform;
};
const {
  LoadingPresenter,
} = await import('../../../game/assets/scripts/creator/loading-presenter.ts');
const {
  LOADING_AUDIO_PRELOAD_STEPS,
  LOADING_RASTER_RESOURCE_COUNT,
  collectLoadingRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/loading-resource-contract.ts'
);

interface StubNode {
  readonly activeInHierarchy: boolean;
  active: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  readonly name: string;
  parent: StubNode | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  destroy(): void;
  getComponent<T>(Type: new () => T): T | null;
  setParent(parent: StubNode | null, keepWorldTransform?: boolean): void;
  setSiblingIndex(index: number): void;
}

interface StubSprite {
  fillRange: number;
  fillStart: number;
  fillType: string | null;
  spriteFrame: unknown;
  type: string | null;
}

interface StubTransform {
  readonly anchorPoint: Readonly<{ x: number; y: number }>;
  readonly contentSize: Readonly<{ height: number; width: number }>;
}

test('Loading presenter constructs exact graph and issues one preload per update', async () => {
  const canvas = new cc.Node('Canvas');
  const preloads: unknown[] = [];
  const presenter = LoadingPresenter.create({
    audioPreloader: {
      preload(step) {
        preloads.push(step);
      },
    },
    canvas: canvas as never,
    resources: resourceFixture('480x800') as never,
    viewport: {
      logicalHeight: 800,
      logicalWidth: 480,
      visibleRect: { center: { x: 240, y: 400 } },
    },
  });
  const root = presenter.root as unknown as StubNode;

  assert.equal(root.name, 'LoadingScene');
  assert.equal(root.parent, null);
  assert.equal(root.active, false);
  assert.deepEqual(root.children.map(({ name }) => name), [
    'backgroundLogo',
    'loadbkback',
    'loadprocess',
    'loadbkfront',
  ]);
  const progress = requireChild(root, 'loadprocess');
  assert.deepEqual(transformOf(progress).anchorPoint, { x: 0, y: 0.5 });
  assert.deepEqual(transformOf(progress).contentSize, { height: 20, width: 185 });
  assert.deepEqual(progress.position, { x: 147.5, y: 200, z: 0 });
  assert.equal(spriteOf(progress).fillRange, 0);
  assert.equal(spriteOf(progress).fillStart, 0);
  assert.equal(spriteOf(progress).fillType, 'HORIZONTAL');
  assert.equal(spriteOf(progress).type, 'FILLED');

  presenter.activate();
  assert.equal(root.parent, canvas);
  assert.equal(root.active, true);
  for (let index = 0; index < 62; index += 1) {
    presenter.update(1 / 60);
  }
  assert.equal(preloads.length, 62);
  assert.deepEqual(preloads, LOADING_AUDIO_PRELOAD_STEPS);
  assert.equal(spriteOf(progress).fillRange, 1);
  assert.equal(presenter.snapshot.phase, 'preloading');

  presenter.update(999);
  assert.equal(presenter.snapshot.phase, 'delay');
  presenter.update(0.5);
  await presenter.completion;
  assert.equal(presenter.snapshot.phase, 'finished');
  assert.equal(presenter.snapshot.active, false);
  assert.equal(root.active, true, 'full Loading overlay remains visible until shell commit');

  assert.equal(presenter.dispose(), true);
  assert.equal(root.destroyed, true);
  assert.equal(presenter.dispose(), false);
});

test('early Loading disposal settles completion and prevents later work', async () => {
  const canvas = new cc.Node('Canvas');
  let preloadCount = 0;
  const presenter = LoadingPresenter.create({
    audioPreloader: {
      preload() {
        preloadCount += 1;
      },
    },
    canvas: canvas as never,
    resources: resourceFixture('720x1280') as never,
    viewport: {
      logicalHeight: 1280,
      logicalWidth: 720,
      visibleRect: { center: { x: 360, y: 640 } },
    },
  });
  presenter.activate();
  assert.equal(presenter.dispose(), true);
  await presenter.completion;
  presenter.update(1);
  assert.equal(preloadCount, 0);
  assert.equal(presenter.snapshot.disposed, true);
  assert.throws(() => presenter.activate(), /Disposed Loading presenter/);
});

test('preload adapter failure leaves overlay visible and rejects the shell-consumed channel', async () => {
  const canvas = new cc.Node('Canvas');
  const failure = new Error('injected preload failure');
  const presenter = LoadingPresenter.create({
    audioPreloader: {
      preload() {
        throw failure;
      },
    },
    canvas: canvas as never,
    resources: resourceFixture('480x800') as never,
    viewport: {
      logicalHeight: 800,
      logicalWidth: 480,
      visibleRect: { center: { x: 240, y: 400 } },
    },
  });
  presenter.activate();

  assert.doesNotThrow(() => presenter.update(1 / 60));
  await assert.rejects(presenter.failure, (error) => error === failure);
  assert.equal(presenter.snapshot.active, false);
  assert.equal((presenter.root as unknown as StubNode).active, true);
  presenter.dispose();
  await presenter.completion;
});

test('Loading graph construction destroys every transient node after partial failures', () => {
  for (const injection of [
    {
      inject() {},
      resourceFailure: true,
    },
    {
      inject() {
        cc.failNextAddComponent('loadbkback', 'UITransform');
      },
      resourceFailure: false,
    },
    {
      inject() {
        cc.failNextSetParent('loadbkback');
      },
      resourceFailure: false,
    },
  ] as const) {
    cc.resetInjectedFailures();
    const canvas = new cc.Node('Canvas');
    const createdStart = cc.createdNodes.length;
    const resources = resourceFixture('480x800');
    let rasterLookupCount = 0;
    injection.inject();

    assert.throws(
      () => LoadingPresenter.create({
        audioPreloader: { preload() {} },
        canvas: canvas as never,
        resources: {
          ...resources,
          raster(resource: { readonly canonicalPath: string }) {
            rasterLookupCount += 1;
            if (injection.resourceFailure && rasterLookupCount === 2) {
              throw new Error('injected raster lookup failure');
            }
            return resources.raster(resource);
          },
        } as never,
        viewport: {
          logicalHeight: 800,
          logicalWidth: 480,
          visibleRect: { center: { x: 240, y: 400 } },
        },
      }),
      /injected/,
    );

    const transientNodes = cc.createdNodes.slice(createdStart);
    assert.deepEqual(
      transientNodes.map(({ name }) => name),
      ['LoadingScene', 'backgroundLogo', 'loadbkback'],
    );
    assert.equal(
      transientNodes.every(({ destroyed }) => destroyed),
      true,
      'a failed graph must not leave detached or root-owned nodes alive',
    );
    assert.deepEqual(canvas.children, []);
  }
  cc.resetInjectedFailures();
});

test('Loading stays above shared roots inserted into the same Canvas native slots', () => {
  const canvas = new cc.Node('Canvas');
  const presenter = LoadingPresenter.create({
    audioPreloader: { preload() {} },
    canvas: canvas as never,
    resources: resourceFixture('480x800') as never,
    viewport: {
      logicalHeight: 800,
      logicalWidth: 480,
      visibleRect: { center: { x: 240, y: 400 } },
    },
  });
  presenter.activate();
  const root = presenter.root as unknown as StubNode;

  for (const [index, name] of [
    [0, 'SharedBackground'],
    [1, 'SharedLeaves'],
    [2, 'SharedTheme'],
    [3, 'CurrentScreen'],
  ] as const) {
    const sharedRoot = new cc.Node(name);
    sharedRoot.setParent(canvas);
    sharedRoot.setSiblingIndex(index);
  }

  assert.equal(canvas.children.at(-1), root);
  assert.deepEqual(
    canvas.children.map(({ name }) => name),
    ['SharedBackground', 'SharedLeaves', 'SharedTheme', 'CurrentScreen', 'LoadingScene'],
  );
  presenter.dispose();
});

test('Loading retirement deactivates the overlay before a destroy failure escapes', () => {
  const canvas = new cc.Node('Canvas');
  const presenter = LoadingPresenter.create({
    audioPreloader: { preload() {} },
    canvas: canvas as never,
    resources: resourceFixture('480x800') as never,
    viewport: {
      logicalHeight: 800,
      logicalWidth: 480,
      visibleRect: { center: { x: 240, y: 400 } },
    },
  });
  presenter.activate();
  const root = presenter.root as unknown as StubNode;
  cc.failNextDestroy('LoadingScene');

  assert.throws(() => presenter.dispose(), /injected destroy failure/);
  assert.equal(root.active, false);
  assert.equal(presenter.snapshot.active, false);
  assert.equal(presenter.snapshot.disposed, true);
  assert.equal(presenter.dispose(), false);

  root.destroy();
  cc.resetInjectedFailures();
});

function resourceFixture(assetTree: '480x800' | '720x1280') {
  const contracts = new Map(
    collectLoadingRasterResources(assetTree).map((resource) => [
      resource.canonicalPath,
      resource,
    ]),
  );
  return {
    assetTree,
    rasterCount: LOADING_RASTER_RESOURCE_COUNT,
    raster(resource: { readonly canonicalPath: string }) {
      const contract = contracts.get(resource.canonicalPath);
      if (contract === undefined) {
        throw new Error(`fixture raster not loaded: ${resource.canonicalPath}`);
      }
      return {
        canonicalPath: contract.canonicalPath,
        dimensions: contract.dimensions,
        spriteFrame: { canonicalPath: contract.canonicalPath },
      };
    },
  };
}

function requireChild(root: StubNode, name: string): StubNode {
  const child = root.children.find((candidate) => candidate.name === name);
  assert.ok(child, `missing child ${name}`);
  return child;
}

function spriteOf(node: StubNode): StubSprite {
  const sprite = node.getComponent(cc.Sprite);
  assert.ok(sprite, `${node.name} is missing Sprite`);
  return sprite;
}

function transformOf(node: StubNode): StubTransform {
  const transform = node.getComponent(cc.UITransform);
  assert.ok(transform, `${node.name} is missing UITransform`);
  return transform;
}

function moduleUrl(source: string): string {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
