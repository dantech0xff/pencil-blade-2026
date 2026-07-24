import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
    this.wakeCount = 0;
  }
  applyLinearImpulseToCenter(impulse) { this.impulses.push(impulse); }
  getMass() { return this.mass; }
  wakeUp() { this.wakeCount += 1; }
}
export class HingeJoint2D {
  constructor() { this.connectedBody = null; }
}
export class Collider2D {
  constructor() {
    this.enabled = true;
    this.group = 0;
    this.tag = 0;
  }
}
export class BoxCollider2D extends Collider2D {}
export class CircleCollider2D extends Collider2D {}
export const ERigidBody2DType = Object.freeze({ Dynamic: 'Dynamic', Static: 'Static' });
class EventOwner {
  constructor() { this.listeners = new Map(); }
  emit(type, event) {
    for (const listener of this.listeners.get(type) ?? []) listener.callback.call(listener.target, event);
  }
  off(type, callback, target) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((listener) => (
      listener.callback !== callback || listener.target !== target
    )));
  }
  on(type, callback, target) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push({ callback, target });
    this.listeners.set(type, listeners);
  }
}
export class Node extends EventOwner {
  static EventType = Object.freeze({
    TOUCH_CANCEL: 'touch-cancel',
    TOUCH_END: 'touch-end',
    TOUCH_START: 'touch-start',
  });
  constructor(name = '') {
    super();
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
  readonly ERigidBody2DType: Readonly<{ readonly Dynamic: string; readonly Static: string }>;
  readonly HingeJoint2D: new () => StubJoint;
  readonly Node: new (name?: string) => StubNode;
};
const {
  createClassicCutHalfMotion,
} = await import('../../../game/assets/scripts/domain/classic-cut-half-motion.ts');
const {
  createModeSelectPresentation,
} = await import('../../../game/assets/scripts/domain/mode-select-presentation.ts');
const {
  getModeSelectCardResources,
} = await import('../../../game/assets/scripts/domain/mode-select-resource-contract.ts');
const {
  ModeSelectCutHalfPresenter,
} = await import('../../../game/assets/scripts/creator/mode-select-cut-half-presenter.ts');
const {
  ModeSelectRopeButtonPresenter,
} = await import('../../../game/assets/scripts/creator/mode-select-rope-button-presenter.ts');

interface StubJoint {
  connectedBody: unknown;
}

interface StubNode {
  active: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  readonly eulerAngles: Readonly<{ x: number; y: number; z: number }>;
  layer: number;
  readonly name: string;
  parent: StubNode | null;
  readonly scale: Readonly<{ x: number; y: number; z: number }>;
  getComponent(Type: new () => unknown): unknown;
  setParent(parent: StubNode | null, keepWorldTransform?: boolean): void;
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

function loadedRaster(contract: Readonly<{
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{ readonly height: number; readonly width: number }>;
}>): Readonly<{
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{ readonly height: number; readonly width: number }>;
  readonly spriteFrame: object;
}> {
  return Object.freeze({ ...contract, spriteFrame: Object.freeze({}) });
}

test('RopeButton owns the exact visual topology and reversible real-physics cut', () => {
  const presentation = createModeSelectPresentation('480x800', VIEWPORT, 5000).cards[1];
  assert.ok(presentation);
  const visualHost = new cc.Node('ModeSelectRoot');
  visualHost.layer = 7;
  const physicsHost = new cc.Node('gestures-layer');
  physicsHost.layer = 7;
  const deferred: Array<() => void> = [];
  const events: string[] = [];
  let rejectSelection = true;
  const presenter = ModeSelectRopeButtonPresenter.create({
    assetTree: '480x800',
    physicsHost: physicsHost as never,
    presentation,
    resources: {
      assetTree: '480x800',
      font: Object.freeze({}),
      raster: loadedRaster,
      rasterCount: 42,
    },
    viewport: { height: 800, width: 480 },
  }, {
    callAfterStep: (mutation: () => void) => deferred.push(mutation),
    onColliderDisposed: () => events.push('collider-disposed'),
    onColliderRestored: () => events.push('collider-restored'),
    onFruitTypeCut: () => events.push('type-objective'),
    onGlobalFruitCut: () => events.push('global-objective'),
    onModeSelected: () => {
      events.push('mode-selected');
      if (rejectSelection) throw new Error('injected selection failure');
    },
    onPlayFruitAudio: () => events.push('fruit-audio'),
    onUnlockRequested: () => events.push('unlock-requested'),
  });

  presenter.attach(visualHost as never, 0);
  presenter.activate();
  presenter.unlock();
  assert.deepEqual(presenter.root.children.map(({ name }) => name), [
    'rope-link-0',
    'rope-link-1',
    'rope-link-2',
    'rope-link-3',
    'rope-link-4',
    'rope-link-5',
    'rope-link-6',
    'description-shader',
    'description-art',
    'fruit-button',
    'upper-wheel',
    'lower-wheel',
    'wheel-connector',
  ]);
  assert.equal(presenter.ropeLinks.length, 7);
  assert.equal(presenter.staticAnchorBody.type, cc.ERigidBody2DType.Static);
  let previousBody: unknown = presenter.staticAnchorBody;
  for (const link of presenter.ropeLinks) {
    assert.equal(link.body.type, cc.ERigidBody2DType.Dynamic);
    assert.equal(link.joint.connectedBody, previousBody);
    previousBody = link.body;
  }
  const fruitJoint = presenter.fruitButton.root.getComponent(cc.HingeJoint2D) as StubJoint;
  assert.equal(fruitJoint.connectedBody, previousBody);

  const circleRotation = presenter.fruitButton.circleNode.eulerAngles.z;
  assert.throws(() => presenter.update(60.01), /must not exceed 60 seconds/);
  assert.equal(presenter.fruitButton.circleNode.eulerAngles.z, circleRotation);

  const segment = Object.freeze({
    end: Object.freeze({ x: 260, y: 440 }),
    start: Object.freeze({ x: 180, y: 340 }),
  });
  assert.throws(() => presenter.cut(segment, true), /injected selection failure/);
  assert.equal(presenter.state.cutAccepted, false);
  assert.equal(presenter.state.wrapperCut, false);
  assert.equal(presenter.cutHalfPresenter, null);
  assert.deepEqual(events, [
    'fruit-audio',
    'mode-selected',
  ]);

  rejectSelection = false;
  assert.equal(presenter.cut(segment, true), true);
  assert.equal(presenter.state.cutAccepted, true);
  assert.equal(presenter.state.wrapperCut, true);
  assert.ok(presenter.cutHalfPresenter);
  assert.deepEqual(events.slice(-4), [
    'fruit-audio',
    'mode-selected',
    'global-objective',
    'type-objective',
  ]);
  assert.equal(deferred.length, 1);
  deferred.shift()?.();
  assert.equal(presenter.fruitButton.collider.enabled, false);
  assert.equal(
    presenter.fruitButton.root.children.find(({ name }) => name === 'intact-fruit')?.active,
    false,
  );

  presenter.restoreAfterFailedNavigation(false);
  assert.deepEqual(presenter.state, {
    activated: true,
    attached: true,
    cutAccepted: false,
    disposed: false,
    locked: false,
    wrapperCut: false,
  });
  assert.equal(presenter.fruitButton.collider.enabled, true);
  assert.deepEqual(presenter.fruitButton.circleNode.scale, { x: 1, y: 1, z: 1 });
  assert.equal(presenter.fruitButton.root.children.some(({ name }) => name === 'blur'), true);
  assert.equal(presenter.fruitButton.root.children.some(({ name }) => name === 'intact-fruit'), true);
  assert.equal(events.includes('collider-restored'), true);
  assert.equal(presenter.cut(segment, false), true);
  assert.equal(events.filter((event) => event === 'global-objective').length, 1);
  assert.equal(events.filter((event) => event === 'type-objective').length, 1);
  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
});

test('cut-half attach rollback destroys the half whose impulse throws', () => {
  const resources = getModeSelectCardResources(0, '480x800');
  const motion = createClassicCutHalfMotion({
    bottomHeightWorldUnits: resources.cutBottom.dimensions.height,
    critical: false,
    segment: {
      end: { x: 260, y: 440 },
      start: { x: 180, y: 340 },
    },
    sourceAngleRadians: 0,
    sourceAngularVelocityRadiansPerSecond: 2,
    sourceBodyMass: 1,
    sourcePositionWorldUnits: { x: 240, y: 400 },
    topHeightWorldUnits: resources.cutTop.dimensions.height,
    viewportWidthWorldUnits: 480,
  });
  const presenter = ModeSelectCutHalfPresenter.create({
    assetTree: '480x800',
    modeIndex: 0,
    motion,
    resources: {
      bottom: loadedRaster(resources.cutBottom),
      top: loadedRaster(resources.cutTop),
    },
  }, { callAfterStep: () => {} });
  const halves = presenter.halves as unknown as Array<{
    readonly body: { applyLinearImpulseToCenter(): void };
    readonly node: StubNode;
  }>;
  const top = halves[1];
  assert.ok(top);
  top.body.applyLinearImpulseToCenter = () => {
    throw new Error('injected impulse failure');
  };
  const parent = new cc.Node('ModeSelectRoot');

  assert.throws(() => presenter.attach(parent as never, 0), /injected impulse failure/);
  assert.equal(presenter.attached, false);
  assert.equal(parent.children.length, 0);
  assert.equal(halves.every(({ node }) => node.destroyed), true);
});

test('Mode Select physics presenters keep actual body/joint and deferred cleanup boundaries', async () => {
  const [ropeSource, halfSource] = await Promise.all([
    readFile(new URL(
      '../../../game/assets/scripts/creator/mode-select-rope-button-presenter.ts',
      import.meta.url,
    ), 'utf8'),
    readFile(new URL(
      '../../../game/assets/scripts/creator/mode-select-cut-half-presenter.ts',
      import.meta.url,
    ), 'utf8'),
  ]);
  assert.match(ropeSource, /addComponent\(RigidBody2D\)/);
  assert.match(ropeSource, /addComponent\(HingeJoint2D\)/);
  assert.match(ropeSource, /input\.presentation\.ropeLinks\.length !== 7/);
  assert.match(ropeSource, /input\.presentation\.joints\.length !== 8/);
  assert.match(ropeSource, /MAX_MODE_SELECT_ROPE_BUTTON_UPDATE_SECONDS = 60/);
  assert.match(halfSource, /attached\.push\(half\)[\s\S]*applyInitialCentreImpulse\(\)/);
  assert.match(halfSource, /this\.lifecycle\.callAfterStep/);
  assert.doesNotMatch(`${ropeSource}\n${halfSource}`, /placeholder/i);
});
