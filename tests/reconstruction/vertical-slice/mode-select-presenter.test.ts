import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const APP_SHELL_SOURCE = readFileSync(
  new URL(
    '../../../game/assets/scripts/creator/recovered-app-shell-controller.ts',
    import.meta.url,
  ),
  'utf8',
);

const CC_STUB_URL = moduleUrl(`
export class Color {
  constructor(r = 0, g = 0, b = 0, a = 255) { this.r = r; this.g = g; this.b = b; this.a = a; }
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
export class Label {
  constructor() { this.color = null; this.font = null; this.fontSize = 0; this.string = ''; }
}
export class Collider2D { constructor() { this.enabled = true; this.tag = 0; } }
export class EventKeyboard { constructor(keyCode = 0) { this.keyCode = keyCode; } }
export const Input = Object.freeze({ EventType: Object.freeze({ KEY_UP: 'key-up' }) });
export const KeyCode = Object.freeze({ MOBILE_BACK: 6 });
class EventOwner {
  constructor() { this.listeners = new Map(); }
  emit(type, event) {
    for (const listener of this.listeners.get(type) ?? []) listener.callback.call(listener.target, event);
  }
  listenerCount(type) { return (this.listeners.get(type) ?? []).length; }
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
export const input = new EventOwner();
export const nodeConstructions = [];
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
    nodeConstructions.push(name);
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
`);

const BLADE_STUB_URL = moduleUrl(`
import { Node } from 'cc';
export class ClassicBladePresenter {
  static create() { return new ClassicBladePresenter(); }
  constructor() {
    this.disposed = false;
    this.events = [];
    this.root = new Node('ClassicBasicBladeRoot');
    this.root.active = false;
  }
  attach(parent) { this.root.setParent(parent); this.root.active = true; }
  begin(slot) { this.events.push('begin:' + slot); }
  dispose() { if (this.disposed) return false; this.disposed = true; this.root.destroy(); return true; }
  end(slot) { this.events.push('end:' + slot); }
  move(slot, point) { this.events.push('move:' + slot + ':' + point.x + ':' + point.y); }
  updateFrame() {}
}
`);

const BLADE_INPUT_STUB_URL = moduleUrl(`
export const CLASSIC_BLADE_BEGAN_EVENT = 'classic-blade-began';
export const CLASSIC_BLADE_MOVED_EVENT = 'classic-blade-moved';
export const CLASSIC_BLADE_ENDED_EVENT = 'classic-blade-ended';
`);

const DETACHED_ROOT_STUB_URL = moduleUrl(`
import { Node } from 'cc';
export function createDetachedScreenRoot(name, canvas) {
  const root = new Node(name);
  root.layer = canvas.layer;
  return root;
}
`);

const ROPE_STUB_URL = moduleUrl(`
import { Collider2D, Node } from 'cc';
export const createdRopes = [];
let failActivationIndex = -1;
let activationFailureConsumed = false;
let failDisposeIndex = -1;
export function configureActivationFailure(index) {
  failActivationIndex = index;
  activationFailureConsumed = false;
}
export function configureDisposeFailure(index) { failDisposeIndex = index; }
export function resetRopes() {
  createdRopes.length = 0;
  configureActivationFailure(-1);
  configureDisposeFailure(-1);
}
export class ModeSelectRopeButtonPresenter {
  static create(input, lifecycle) {
    const rope = new ModeSelectRopeButtonPresenter(input.presentation, lifecycle, createdRopes.length);
    createdRopes.push(rope);
    return rope;
  }
  constructor(presentation, lifecycle, index) {
    this.activated = false;
    this.collider = new Collider2D();
    this.cutAccepted = false;
    this.disposed = false;
    this.index = index;
    this.lifecycle = lifecycle;
    this.locked = presentation.initialLocked;
    this.modeIndex = presentation.card.destinationState;
    this.presentation = presentation;
    this.restoreCount = 0;
    this.updateCount = 0;
    this.root = new Node(presentation.card.purpose + '-rope-button');
    this.root.active = false;
    this.targetId = 'mode-select-fruit:' + this.modeIndex;
    this.wrapperCut = false;
    this.fruitButton = { collider: this.collider };
  }
  get state() {
    return Object.freeze({ activated: this.activated, attached: this.root.parent !== null, cutAccepted: this.cutAccepted, disposed: this.disposed, locked: this.locked, wrapperCut: this.wrapperCut });
  }
  activate() {
    if (this.index === failActivationIndex && !activationFailureConsumed) {
      activationFailureConsumed = true;
      throw new Error('injected rope activation failure');
    }
    if (this.activated) throw new Error('rope already activated');
    this.activated = true;
    this.root.active = true;
  }
  attach(parent, siblingIndex) { this.root.setParent(parent); this.root.setSiblingIndex(siblingIndex); }
  cut(segment, effectsEnabled) {
    if (!this.activated || this.disposed || this.locked || this.cutAccepted) return false;
    this.cutAccepted = true;
    try {
      if (effectsEnabled) this.lifecycle.onPlayFruitAudio('fruit.wav');
      this.lifecycle.onModeSelected(this.modeIndex);
    } catch (error) {
      this.cutAccepted = false;
      throw error;
    }
    this.wrapperCut = true;
    return true;
  }
  deactivateAfterActivationFailure() {
    this.activated = false;
    this.root.active = false;
    return true;
  }
  dispose() {
    if (this.disposed) return false;
    this.disposed = true;
    this.root.destroy();
    if (this.index === failDisposeIndex) throw new Error('injected rope dispose failure');
    return true;
  }
  moveAnchor() {}
  requestUnlock() { this.lifecycle.onUnlockRequested(); }
  restoreAfterFailedNavigation(locked) {
    this.cutAccepted = false;
    this.wrapperCut = false;
    this.locked = locked;
    this.restoreCount += 1;
    this.lifecycle.onColliderRestored(this.collider, this);
  }
  snapshot() {
    return Object.freeze({ bodyWorldPosition: { x: 0, y: 0 }, cutDisabled: this.locked || this.cutAccepted, id: this.targetId, isFruit: true, nodeTag: 0 });
  }
  unlock() { this.locked = false; this.collider.enabled = true; }
  update() { this.updateCount += 1; }
}
`);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') return { shortCircuit: true, url: CC_STUB_URL };
    if (specifier === './classic-blade-presenter') {
      return { shortCircuit: true, url: BLADE_STUB_URL };
    }
    if (specifier === './blade-input-controller') {
      return { shortCircuit: true, url: BLADE_INPUT_STUB_URL };
    }
    if (specifier === './detached-screen-root') {
      return { shortCircuit: true, url: DETACHED_ROOT_STUB_URL };
    }
    if (specifier === './mode-select-rope-button-presenter') {
      return { shortCircuit: true, url: ROPE_STUB_URL };
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
const ropeStub = await import(ROPE_STUB_URL) as unknown as RopeStub;
const {
  CLASSIC_BLADE_BEGAN_EVENT,
  CLASSIC_BLADE_ENDED_EVENT,
  CLASSIC_BLADE_MOVED_EVENT,
} = await import(BLADE_INPUT_STUB_URL);
const {
  MODE_SELECT_HORIZONTAL_DRAG_EVENT,
  MODE_SELECT_HORIZONTAL_FLICK_EVENT,
  ModeSelectFatalNavigationError,
  ModeSelectPresenter,
} = await import('../../../game/assets/scripts/creator/mode-select-presenter.ts');

interface StubNode {
  active: boolean;
  readonly activeInHierarchy: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  readonly name: string;
  parent: StubNode | null;
  emit(type: string, event?: unknown): void;
  getComponent<T>(Type: new () => T): T | null;
  listenerCount(type: string): number;
  setParent(parent: StubNode | null): void;
}

interface CocosStub {
  readonly Collider2D: new () => StubCollider;
  readonly Node: new (name?: string) => StubNode;
  readonly UIOpacity: new () => { opacity: number };
  readonly nodeConstructions: string[];
}

interface StubCollider { enabled: boolean; tag: number }

interface StubRope {
  activated: boolean;
  readonly collider: StubCollider;
  cut(segment: unknown, effectsEnabled: boolean): boolean;
  cutAccepted: boolean;
  disposed: boolean;
  locked: boolean;
  requestUnlock(): void;
  restoreCount: number;
  updateCount: number;
  wrapperCut: boolean;
}

interface RopeStub {
  readonly createdRopes: StubRope[];
  configureActivationFailure(index: number): void;
  configureDisposeFailure(index: number): void;
  resetRopes(): void;
}

interface BladeInputHarness {
  readonly events: string[];
  readonly node: StubNode;
  activateForClassicLayer(): void;
  deactivateForNonClassicScreen(): void;
  setCutEnabled(enabled: boolean): void;
}

test('constructs a detached exact six-card screen and acquires input only on activation', () => {
  ropeStub.resetRopes();
  const bladeInput = bladeInputHarness();
  const harness = presenterInput(bladeInput);
  const presenter = ModeSelectPresenter.create(harness.input as never);
  assert.equal(presenter.root.parent, null);
  assert.equal(presenter.root.active, false);
  assert.equal(presenter.presentation.shell.totalCoinsLabelPresent, false);
  assert.equal(presenter.ropeButtons.length, 6);
  assert.deepEqual(harness.unlockReads, [1, 2, 4, 5]);

  const host = new cc.Node('SharedGameSceneRoot');
  presenter.root.setParent(host);
  presenter.activate();
  assert.equal(presenter.state.activated, true);
  assert.deepEqual(bladeInput.events.slice(0, 2), ['activate', 'cut:true']);
  presenter.dispose();
});

test('a short real blade touch drag selects Crazy and the unpressed rail centers it', () => {
  ropeStub.resetRopes();
  const bladeInput = bladeInputHarness();
  const presenter = ModeSelectPresenter.create(presenterInput(bladeInput).input as never);
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot'));
  presenter.activate();
  centerCard(presenter, 0);

  emitBladeBegan(bladeInput, 7, 0, 320, 400);
  emitBladeMoved(bladeInput, 7, 0, 320, 400, 319, 400, 999);
  assert.equal(presenter.state.model.anchorXs[0], 239);
  assert.equal(presenter.state.model.currentIndex, 1);
  emitBladeEnded(bladeInput, 7, 0, false);

  assert.equal(
    presenter.state.model.currentIndex,
    1,
    'the recovered >1 flick threshold must not double-advance an exact one-unit drag',
  );
  centerCard(presenter, 1);
  assert.equal(presenter.state.model.anchorXs[1], 240);
  assert.deepEqual(
    (presenter.blade as unknown as { readonly events: readonly string[] }).events.slice(-4),
    ['begin:0', 'move:0:320:400', 'move:0:319:400', 'end:0'],
  );
  presenter.dispose();
});

test('one blade touch owns the gesture through recovered drag, flick, end, and cancel', () => {
  ropeStub.resetRopes();
  const bladeInput = bladeInputHarness();
  const presenter = ModeSelectPresenter.create(presenterInput(bladeInput).input as never);
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot'));
  presenter.activate();
  centerCard(presenter, 0);

  emitBladeBegan(bladeInput, 5, 0, 300, 400);
  emitBladeMoved(bladeInput, 5, 0, 300, 400, 290, 410);
  assert.equal(presenter.state.model.anchorXs[0], 240);
  emitBladeEnded(bladeInput, 5, 0, false);
  assert.equal(
    presenter.state.model.currentIndex,
    0,
    'a 45-degree tie belongs to the recovered vertical sector for drag and flick',
  );
  assert.doesNotThrow(() => emitBladeBegan(bladeInput, 6, 4, 300, 400));
  emitBladeMoved(bladeInput, 6, 4, 300, 400, 200, 400);
  emitBladeEnded(bladeInput, 6, 4, false);
  assert.equal(presenter.state.model.anchorXs[0], 240);

  emitBladeBegan(bladeInput, 10, 0, 320, 400);
  emitBladeBegan(bladeInput, 20, 1, 100, 400);
  emitBladeMoved(bladeInput, 20, 1, 100, 400, 20, 400);
  assert.equal(presenter.state.model.anchorXs[0], 240);

  emitBladeMoved(bladeInput, 10, 0, 320, 400, 300, 400);
  assert.equal(presenter.state.model.currentIndex, 1);
  emitBladeEnded(bladeInput, 20, 1, false);
  emitBladeMoved(bladeInput, 10, 0, 300, 400, 290, 400);
  emitBladeEnded(bladeInput, 10, 0, false);
  assert.equal(
    presenter.state.model.currentIndex,
    2,
    'a >1 horizontal release preserves recovered drag-then-flick double dispatch',
  );

  const anchorBeforeReplacement = presenter.state.model.anchorXs[0];
  emitBladeBegan(bladeInput, 30, 0, 200, 400);
  emitBladeMoved(bladeInput, 30, 0, 200, 400, 220, 400);
  const indexBeforeCancel = presenter.state.model.currentIndex;
  emitBladeEnded(bladeInput, 30, 0, true);
  assert.equal(presenter.state.model.currentIndex, indexBeforeCancel);
  const anchorAfterCancel = presenter.state.model.anchorXs[0];
  emitBladeMoved(bladeInput, 30, 0, 220, 400, 260, 400);
  assert.equal(presenter.state.model.anchorXs[0], anchorAfterCancel);
  assert.notEqual(anchorAfterCancel, anchorBeforeReplacement);
  presenter.dispose();
});

test('gesture listeners and ownership reset on suspend, rearm, and dispose', () => {
  ropeStub.resetRopes();
  const bladeInput = bladeInputHarness();
  const presenter = ModeSelectPresenter.create(presenterInput(bladeInput).input as never);
  const gestures = presenter.root.children.find(({ name }) => name === 'gestures-layer');
  assert.ok(gestures);
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot'));

  assert.equal(bladeInput.node.listenerCount(CLASSIC_BLADE_BEGAN_EVENT), 0);
  presenter.activate();
  assert.equal(bladeInput.node.listenerCount(CLASSIC_BLADE_BEGAN_EVENT), 1);
  assert.equal(bladeInput.node.listenerCount(CLASSIC_BLADE_MOVED_EVENT), 1);
  assert.equal(bladeInput.node.listenerCount(CLASSIC_BLADE_ENDED_EVENT), 1);
  assert.equal(gestures.listenerCount(MODE_SELECT_HORIZONTAL_DRAG_EVENT), 1);
  assert.equal(gestures.listenerCount(MODE_SELECT_HORIZONTAL_FLICK_EVENT), 1);

  centerCard(presenter, 0);
  emitBladeBegan(bladeInput, 40, 0, 300, 400);
  assert.equal(presenter.suspendForTransition(), true);
  assert.equal(bladeInput.node.listenerCount(CLASSIC_BLADE_BEGAN_EVENT), 0);
  assert.equal(bladeInput.node.listenerCount(CLASSIC_BLADE_MOVED_EVENT), 0);
  assert.equal(bladeInput.node.listenerCount(CLASSIC_BLADE_ENDED_EVENT), 0);
  assert.equal(gestures.listenerCount(MODE_SELECT_HORIZONTAL_DRAG_EVENT), 0);
  const suspendedAnchor = presenter.state.model.anchorXs[0];
  emitBladeMoved(bladeInput, 40, 0, 300, 400, 250, 400);
  assert.equal(presenter.state.model.anchorXs[0], suspendedAnchor);

  assert.equal(presenter.rearmNavigationAfterFailure(), true);
  assert.equal(bladeInput.node.listenerCount(CLASSIC_BLADE_BEGAN_EVENT), 1);
  assert.equal(bladeInput.node.listenerCount(CLASSIC_BLADE_MOVED_EVENT), 1);
  assert.equal(bladeInput.node.listenerCount(CLASSIC_BLADE_ENDED_EVENT), 1);
  assert.equal(gestures.listenerCount(MODE_SELECT_HORIZONTAL_DRAG_EVENT), 1);
  emitBladeBegan(bladeInput, 41, 0, 300, 400);
  emitBladeMoved(bladeInput, 41, 0, 300, 400, 299, 400);
  emitBladeEnded(bladeInput, 41, 0, true);
  assert.equal(presenter.state.model.anchorXs[0], suspendedAnchor - 1);

  gestures.emit(MODE_SELECT_HORIZONTAL_DRAG_EVENT, { deltaX: 1 });
  assert.equal(presenter.state.model.anchorXs[0], suspendedAnchor);
  presenter.dispose();
  assert.equal(bladeInput.node.listenerCount(CLASSIC_BLADE_BEGAN_EVENT), 0);
  assert.equal(bladeInput.node.listenerCount(CLASSIC_BLADE_MOVED_EVENT), 0);
  assert.equal(bladeInput.node.listenerCount(CLASSIC_BLADE_ENDED_EVENT), 0);
  assert.equal(gestures.listenerCount(MODE_SELECT_HORIZONTAL_DRAG_EVENT), 0);
  assert.equal(gestures.listenerCount(MODE_SELECT_HORIZONTAL_FLICK_EVENT), 0);
});

test('partial RopeButton activation rolls back the input lease and permits retry', () => {
  ropeStub.resetRopes();
  ropeStub.configureActivationFailure(2);
  const bladeInput = bladeInputHarness();
  const presenter = ModeSelectPresenter.create(presenterInput(bladeInput).input as never);
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot'));

  assert.throws(() => presenter.activate(), /injected rope activation failure/);
  assert.equal(presenter.state.activated, false);
  assert.equal(presenter.root.active, false);
  assert.equal(ropeStub.createdRopes.every(({ activated }) => !activated), true);
  assert.deepEqual(bladeInput.events.filter((event) => event === 'deactivate'), ['deactivate']);

  presenter.activate();
  assert.equal(ropeStub.createdRopes.every(({ activated }) => activated), true);
  presenter.dispose();
});

test('rejected Crazy, all Bird routes, and unsupported routes restore every cut card', () => {
  ropeStub.resetRopes();
  let crazyCalls = 0;
  let classicBirdCalls = 0;
  let crazyBirdCalls = 0;
  let comboBirdCalls = 0;
  let unsupportedCalls = 0;
  const lifecycle = defaultLifecycle();
  lifecycle.onCrazyRequested = () => {
    crazyCalls += 1;
    return false;
  };
  lifecycle.onClassicBirdRequested = () => {
    classicBirdCalls += 1;
    return false;
  };
  lifecycle.onCrazyBirdRequested = () => {
    crazyBirdCalls += 1;
    return false;
  };
  lifecycle.onComboBirdRequested = () => {
    comboBirdCalls += 1;
    return false;
  };
  lifecycle.onUnsupportedDestinationRequested = () => {
    unsupportedCalls += 1;
    return false;
  };
  const presenter = ModeSelectPresenter.create(
    presenterInput(bladeInputHarness(), { lifecycle, unlocks: [1, 2, 4, 5] }).input as never,
  );
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot'));
  presenter.activate();
  const segment = { end: { x: 2, y: 2 }, start: { x: 1, y: 1 } };
  const crazy = ropeStub.createdRopes[1];
  const gnStyle = ropeStub.createdRopes[2];
  const classicBird = ropeStub.createdRopes[3];
  const crazyBird = ropeStub.createdRopes[4];
  const comboBird = ropeStub.createdRopes[5];
  assert.ok(crazy);
  assert.ok(gnStyle);
  assert.ok(classicBird);
  assert.ok(crazyBird);
  assert.ok(comboBird);
  assert.equal(crazy.cut(segment, true), true);
  assert.equal(presenter.state.navigationPendingCount, 1);
  presenter.update(0.75);
  assert.equal(crazyCalls, 1);
  assert.equal(classicBirdCalls, 0);
  assert.equal(unsupportedCalls, 0);
  assert.equal(crazy.restoreCount, 1);
  assert.equal(crazy.cutAccepted, false);

  assert.equal(classicBird.cut(segment, true), true);
  assert.equal(presenter.state.navigationPendingCount, 1);
  presenter.update(0.75);
  assert.equal(classicBirdCalls, 1);
  assert.equal(unsupportedCalls, 0);
  assert.equal(presenter.state.navigationPendingCount, 0);
  assert.equal(classicBird.restoreCount, 1);
  assert.equal(classicBird.cutAccepted, false);

  assert.equal(crazyBird.cut(segment, true), true);
  assert.equal(presenter.state.navigationPendingCount, 1);
  presenter.update(0.75);
  assert.equal(crazyBirdCalls, 1);
  assert.equal(unsupportedCalls, 0);
  assert.equal(presenter.state.navigationPendingCount, 0);
  assert.equal(crazyBird.restoreCount, 1);
  assert.equal(crazyBird.cutAccepted, false);

  assert.equal(comboBird.cut(segment, true), true);
  assert.equal(presenter.state.navigationPendingCount, 1);
  presenter.update(0.75);
  assert.equal(comboBirdCalls, 1);
  assert.equal(unsupportedCalls, 0);
  assert.equal(presenter.state.navigationPendingCount, 0);
  assert.equal(comboBird.restoreCount, 1);
  assert.equal(comboBird.cutAccepted, false);

  assert.equal(gnStyle.cut(segment, true), true);
  assert.equal(presenter.state.navigationPendingCount, 1);
  presenter.update(0.75);
  assert.equal(unsupportedCalls, 1);
  assert.equal(presenter.state.navigationPendingCount, 0);
  assert.equal(gnStyle.restoreCount, 1);
  assert.equal(gnStyle.cutAccepted, false);
  assert.equal(crazy.cut(segment, true), true);
  presenter.dispose();
});

test('fatal navigation rollback keeps Mode Select inert instead of reacquiring input', () => {
  ropeStub.resetRopes();
  const bladeInput = bladeInputHarness();
  const lifecycle = defaultLifecycle();
  let presenter: InstanceType<typeof ModeSelectPresenter>;
  lifecycle.onClassicBirdRequested = () => {
    presenter.root.setParent(null);
    assert.equal(presenter.suspendForTransition(), true);
    throw new ModeSelectFatalNavigationError(
      'injected rollback-incomplete route',
      new Error('collision filter remains inactive'),
    );
  };
  presenter = ModeSelectPresenter.create(
    presenterInput(bladeInput, { lifecycle }).input as never,
  );
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot'));
  presenter.activate();
  const classicBird = ropeStub.createdRopes[3];
  assert.ok(classicBird);
  assert.equal(
    classicBird.cut(
      { end: { x: 2, y: 2 }, start: { x: 1, y: 1 } },
      true,
    ),
    true,
  );

  assert.throws(
    () => presenter.update(0.75),
    /injected rollback-incomplete route[\s\S]*collision filter remains inactive/,
  );
  assert.equal(presenter.state.suspended, true);
  assert.equal(presenter.state.navigationPendingCount, 0);
  assert.equal(presenter.root.parent, null);
  assert.equal(presenter.root.active, false);
  assert.equal(classicBird.restoreCount, 0);
  assert.equal(classicBird.cutAccepted, true);
  assert.equal(
    bladeInput.events.filter((event) => event === 'activate').length,
    1,
  );
  assert.equal(
    bladeInput.node.listenerCount(CLASSIC_BLADE_BEGAN_EVENT),
    0,
  );
  presenter.dispose();
});

for (const route of [
  {
    destination: 'CrazyModeLayer',
    label: 'Crazy',
    modeIndex: 1,
    transitionMethod: 'transitionModeSelectToCrazy',
  },
  {
    destination: 'CrazyBirdLayer',
    label: 'Crazy Bird',
    modeIndex: 4,
    transitionMethod: 'transitionModeSelectToCrazyBird',
  },
] as const) {
  test(`fatal ${route.label} presenter-to-shell handoff remains fully quiescent`, () => {
    const outcome = executeFatalTimedModePresenterShell(route, 'direct-fatal');
    assertFatalTimedModePresenterShellQuiescent(outcome);
    outcome.presenter.dispose();
  });

  test(
    `${route.label} rollback filter failure clears restored screen ownership`,
    () => {
      const outcome = executeFatalTimedModePresenterShell(
        route,
        'nonfatal-filter-fatal',
      );
      assertFatalTimedModePresenterShellQuiescent(outcome);
      assert.equal(outcome.harness.filterReactivationCount, 1);
      outcome.presenter.dispose();
    },
  );
}

for (const route of [
  {
    destination: 'ClassicModeLayer',
    label: 'Classic',
    modeIndex: 0,
    transitionMethod: 'transitionModeSelectToClassic',
  },
  {
    destination: 'ClassicBirdLayer',
    label: 'Classic Bird',
    modeIndex: 3,
    transitionMethod: 'transitionModeSelectToClassicBird',
  },
] as const) {
  test(
    `${route.label} rollback filter failure clears restored screen ownership`,
    () => {
      const outcome = executeFatalTimedModePresenterShell(
        route,
        'nonfatal-filter-fatal',
      );
      assertFatalTimedModePresenterShellQuiescent(outcome);
      assert.equal(outcome.harness.filterReactivationCount, 1);
      outcome.presenter.dispose();
    },
  );
}

test('ordinary rejected navigation keeps attached Mode Select ownership usable', () => {
  ropeStub.resetRopes();
  const bladeInput = bladeInputHarness();
  const lifecycle = defaultLifecycle();
  lifecycle.onCrazyRequested = () => false;
  const presenter = ModeSelectPresenter.create(
    presenterInput(bladeInput, {
      lifecycle,
      unlocks: [1],
    }).input as never,
  );
  const host = new cc.Node('SharedGameSceneRoot');
  presenter.root.setParent(host);
  presenter.activate();
  const crazy = ropeStub.createdRopes[1];
  assert.ok(crazy);
  assert.equal(
    crazy.cut(
      { end: { x: 2, y: 2 }, start: { x: 1, y: 1 } },
      true,
    ),
    true,
  );

  presenter.update(0.75);
  assert.equal(presenter.root.parent, host);
  assert.equal(presenter.root.active, true);
  assert.equal(presenter.state.suspended, false);
  assert.equal(crazy.restoreCount, 1);
  assert.equal(
    bladeInput.events.filter((event) => event === 'activate').length,
    1,
  );
  assert.equal(
    bladeInput.node.listenerCount(CLASSIC_BLADE_BEGAN_EVENT),
    1,
  );
  presenter.dispose();
});

test('suspended disposal cannot deactivate a newer owner of shared BladeInput', () => {
  ropeStub.resetRopes();
  const bladeInput = bladeInputHarness();
  const presenter = ModeSelectPresenter.create(presenterInput(bladeInput).input as never);
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot'));
  presenter.activate();
  assert.equal(presenter.suspendForTransition(), true);
  const releasesAtSuspend = bladeInput.events.filter((event) => event === 'deactivate').length;
  assert.equal(releasesAtSuspend, 1);
  bladeInput.activateForClassicLayer();
  presenter.dispose();
  assert.equal(
    bladeInput.events.filter((event) => event === 'deactivate').length,
    releasesAtSuspend,
  );
});

test('selection-audio failure rolls back destination state and the cut card', () => {
  ropeStub.resetRopes();
  const harness = presenterInput(bladeInputHarness(), {
    audioFailurePath: 'Sounds/gameplayselected.wav',
    unlocks: [1],
  });
  const presenter = ModeSelectPresenter.create(harness.input as never);
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot'));
  presenter.activate();
  const crazy = ropeStub.createdRopes[1];
  assert.ok(crazy);
  assert.throws(
    () => crazy.cut({ end: { x: 2, y: 2 }, start: { x: 1, y: 1 } }, true),
    /injected audio failure/,
  );
  assert.equal(crazy.cutAccepted, false);
  assert.equal(presenter.state.model.destinationState, -1);
  assert.equal(presenter.state.navigationPendingCount, 0);
  presenter.dispose();
});

test('failed unlock persistence restores coins and keeps model/card locked', () => {
  ropeStub.resetRopes();
  const harness = presenterInput(bladeInputHarness(), {
    failPersist: true,
    totalCoins: 2500,
  });
  const presenter = ModeSelectPresenter.create(harness.input as never);
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot'));
  presenter.activate();
  const gestures = presenter.root.children.find(({ name }) => name === 'gestures-layer');
  assert.ok(gestures);
  gestures.emit(MODE_SELECT_HORIZONTAL_FLICK_EVENT, -1);
  const crazy = ropeStub.createdRopes[1];
  assert.ok(crazy);
  const burstConstructionsBefore = cc.nodeConstructions.filter(
    (name) => name === 'unlock-particle-container',
  ).length;
  assert.throws(() => crazy.requestUnlock(), /injected persist failure/);
  assert.equal(harness.data.totalCoins, 2500);
  assert.equal(presenter.state.model.cardLocks[1], true);
  assert.equal(crazy.locked, true);
  assert.deepEqual(harness.coinDeltas, [-2500, 2500]);
  assert.equal(
    cc.nodeConstructions.filter((name) => name === 'unlock-particle-container').length,
    burstConstructionsBefore,
  );
  presenter.dispose();
});

test('post-persist domain failure converges model and RopeButton to committed unlock', () => {
  ropeStub.resetRopes();
  const harness = presenterInput(bladeInputHarness(), { totalCoins: 2500 });
  const presenter = ModeSelectPresenter.create(harness.input as never);
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot'));
  presenter.activate();
  const gestures = presenter.root.children.find(({ name }) => name === 'gestures-layer');
  assert.ok(gestures);
  gestures.emit(MODE_SELECT_HORIZONTAL_FLICK_EVENT, -1);
  const crazy = ropeStub.createdRopes[1];
  assert.ok(crazy);
  const exposed = presenter as unknown as {
    readonly model: { unlockCurrentMode(totalCoins: number): never };
  };
  exposed.model.unlockCurrentMode = () => {
    throw new Error('injected post-persist domain failure');
  };

  assert.throws(() => crazy.requestUnlock(), /injected post-persist domain failure/);
  assert.equal(harness.data.totalCoins, 0);
  assert.equal(presenter.state.model.cardLocks[1], false);
  assert.equal(crazy.locked, false);
  assert.deepEqual(harness.coinDeltas, [-2500]);
  presenter.dispose();
});

test('oversized frame delta is rejected before RopeButton updates', () => {
  ropeStub.resetRopes();
  const presenter = ModeSelectPresenter.create(
    presenterInput(bladeInputHarness()).input as never,
  );
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot'));
  presenter.activate();

  assert.throws(() => presenter.update(60.01), /must not exceed 60 seconds/);
  assert.equal(ropeStub.createdRopes.every(({ updateCount }) => updateCount === 0), true);
  presenter.dispose();
});

test('unlock RNG is delayed to 0.05 seconds and consumes exactly 225 draws', () => {
  ropeStub.resetRopes();
  const harness = presenterInput(bladeInputHarness(), { totalCoins: 2500 });
  const presenter = ModeSelectPresenter.create(harness.input as never);
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot'));
  presenter.activate();
  const gestures = presenter.root.children.find(({ name }) => name === 'gestures-layer');
  assert.ok(gestures);
  gestures.emit(MODE_SELECT_HORIZONTAL_FLICK_EVENT, -1);
  ropeStub.createdRopes[1]?.requestUnlock();
  assert.equal(harness.randomDraws.count, 0);
  assert.equal(harness.data.totalCoins, 0);
  assert.equal(presenter.state.model.cardLocks[1], false);

  presenter.update(0.049);
  assert.equal(harness.randomDraws.count, 0);
  presenter.update(0.001);
  assert.equal(harness.randomDraws.count, 225);
  const container = presenter.root.children.find(
    ({ name }) => name === 'unlock-particle-container',
  );
  assert.ok(container);
  assert.equal(container.children.length, 45);
  presenter.dispose();
});

test('completed insufficient-coins actions retire and stop rewriting label opacity', () => {
  ropeStub.resetRopes();
  const harness = presenterInput(bladeInputHarness(), { totalCoins: 0 });
  const presenter = ModeSelectPresenter.create(harness.input as never);
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot'));
  presenter.activate();
  const gestures = presenter.root.children.find(({ name }) => name === 'gestures-layer');
  assert.ok(gestures);
  gestures.emit(MODE_SELECT_HORIZONTAL_FLICK_EVENT, -1);
  ropeStub.createdRopes[1]?.requestUnlock();
  const label = presenter.root.children.find(({ name }) => name === 'insufficient-coins-label');
  assert.ok(label);
  const opacity = label.getComponent(cc.UIOpacity);
  assert.ok(opacity);
  presenter.update(2);
  assert.equal(opacity.opacity, 0);
  opacity.opacity = 123;
  presenter.update(0.1);
  assert.equal(opacity.opacity, 123);
  presenter.dispose();
});

test('immediate back callback carries the exact MainMenu transaction', () => {
  ropeStub.resetRopes();
  let observed: unknown = null;
  const lifecycle = defaultLifecycle();
  lifecycle.onMainMenuRequested = (transaction: unknown) => {
    observed = transaction;
    return false;
  };
  const presenter = ModeSelectPresenter.create(
    presenterInput(bladeInputHarness(), { lifecycle }).input as never,
  );
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot'));
  presenter.activate();
  const backMenu = presenter.root.children.find(({ name }) => name === 'back-menu');
  const backItem = backMenu?.children[0];
  assert.ok(backItem);
  backItem.emit('touch-end');
  assert.deepEqual(observed, {
    destination: 'MainMenuLayer',
    root: presenter.root,
    timing: 'immediate',
    zOrder: 1,
  });
  assert.equal(presenter.state.suspended, false);
  presenter.dispose();
});

test('disposal aggregates a RopeButton failure after cleaning every owned node', () => {
  ropeStub.resetRopes();
  ropeStub.configureDisposeFailure(2);
  const presenter = ModeSelectPresenter.create(
    presenterInput(bladeInputHarness()).input as never,
  );
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot'));
  presenter.activate();
  assert.throws(() => presenter.dispose(), /Mode Select disposal failed/);
  assert.equal(presenter.root.destroyed, true);
  assert.equal(ropeStub.createdRopes.every(({ disposed }) => disposed), true);
  assert.equal(presenter.dispose(), false);
});

test('source keeps exact detached/lifecycle boundaries and no destination placeholder', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(
    new URL('../../../game/assets/scripts/creator/mode-select-presenter.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /createDetachedScreenRoot\('ModeSelectRoot', input\.canvas\)/);
  assert.match(source, /this\.inputLeaseHeld = true/);
  assert.match(source, /this\.bladeInput\.deactivateForNonClassicScreen\(\)/);
  assert.match(source, /onClassicRequested/);
  assert.match(source, /onCrazyRequested/);
  assert.match(source, /onClassicBirdRequested/);
  assert.match(source, /onCrazyBirdRequested/);
  assert.match(source, /onComboBirdRequested/);
  assert.match(source, /onMainMenuRequested/);
  assert.match(source, /onUnsupportedDestinationRequested/);
  assert.match(source, /restoreAfterFailedNavigation/);
  assert.doesNotMatch(source, /new Node\(['"](?:Crazy|GNStyle|ClassicBird|CrazyBird|ComboBird)Layer/);
  assert.doesNotMatch(source, /total-coins-label/);
});

interface FatalTimedModeRoute {
  readonly destination:
    | 'ClassicModeLayer'
    | 'CrazyModeLayer'
    | 'ClassicBirdLayer'
    | 'CrazyBirdLayer';
  readonly label: 'Classic' | 'Crazy' | 'Classic Bird' | 'Crazy Bird';
  readonly modeIndex: 0 | 1 | 3 | 4;
  readonly transitionMethod:
    | 'transitionModeSelectToClassic'
    | 'transitionModeSelectToCrazy'
    | 'transitionModeSelectToClassicBird'
    | 'transitionModeSelectToCrazyBird';
}

type FatalTimedModeFailure = 'direct-fatal' | 'nonfatal-filter-fatal';

class ExecutableCrazyLifecycleRollbackError extends Error {}
class ExecutableClassicBirdLifecycleRollbackError extends Error {}

class ExecutableModeSelectSharedScene {
  currentScreen: StubNode | null = null;
  disposed = false;
  private host: StubNode | null = null;

  attachExistingScreen(host: StubNode, screen: StubNode): void {
    assert.equal(screen.parent, host);
    this.host = host;
    this.currentScreen = screen;
  }

  attachCurrentScreen(screen: StubNode): void {
    if (
      this.host === null
      || this.currentScreen !== null
      || screen.parent !== null
      || screen.destroyed
    ) {
      throw new Error('Executable shared scene requires one valid detached screen');
    }
    screen.setParent(this.host);
    this.currentScreen = screen;
  }

  detachCurrentScreen(expectedScreen?: StubNode): StubNode {
    const current = this.currentScreen;
    if (
      current === null
      || (expectedScreen !== undefined && expectedScreen !== current)
    ) {
      throw new Error('Executable shared scene current-screen identity changed before detach');
    }
    current.setParent(null);
    this.currentScreen = null;
    return current;
  }
}

function executeFatalTimedModePresenterShell(
  route: FatalTimedModeRoute,
  failure: FatalTimedModeFailure,
) {
  ropeStub.resetRopes();
  const bladeInput = bladeInputHarness();
  const harness = createFatalTimedModeShellHarness(route, failure);
  const lifecycle = defaultLifecycle();
  let presenter: InstanceType<typeof ModeSelectPresenter>;
  lifecycle.onClassicRequested = (transaction) => (
    route.destination === 'ClassicModeLayer'
      ? harness.transition(transaction)
      : false
  );
  lifecycle.onCrazyRequested = (transaction) => (
    route.destination === 'CrazyModeLayer'
      ? harness.transition(transaction)
      : false
  );
  lifecycle.onClassicBirdRequested = (transaction) => (
    route.destination === 'ClassicBirdLayer'
      ? harness.transition(transaction)
      : false
  );
  lifecycle.onCrazyBirdRequested = (transaction) => (
    route.destination === 'CrazyBirdLayer'
      ? harness.transition(transaction)
      : false
  );
  presenter = ModeSelectPresenter.create(
    presenterInput(bladeInput, {
      lifecycle,
      unlocks: [1, 2, 4, 5],
    }).input as never,
  );
  harness.attachPresenter(presenter);
  presenter.activate();
  const routeButton = ropeStub.createdRopes[route.modeIndex];
  assert.ok(routeButton);
  assert.equal(
    routeButton.cut(
      { end: { x: 2, y: 2 }, start: { x: 1, y: 1 } },
      true,
    ),
    true,
  );

  assert.throws(
    () => presenter.update(0.75),
    failure === 'direct-fatal'
      ? new RegExp(
        `retained poisoned runtime ownership[\\s\\S]*injected ${route.label} fatal`,
      )
      : new RegExp(
        `rollback is incomplete[\\s\\S]*injected ${route.label} filter reacquisition failure`,
      ),
  );
  return { bladeInput, failure, harness, presenter, routeButton };
}

function assertFatalTimedModePresenterShellQuiescent(
  outcome: ReturnType<typeof executeFatalTimedModePresenterShell>,
): void {
  assert.equal(outcome.harness.state, 'failed');
  assert.equal(outcome.harness.currentScreen, null);
  assert.equal(outcome.presenter.root.parent, null);
  assert.equal(outcome.presenter.root.active, false);
  assert.equal(outcome.harness.filterActive, false);
  assert.equal(
    outcome.harness.filterReactivationCount,
    outcome.failure === 'direct-fatal' ? 0 : 1,
  );
  assert.equal(outcome.harness.inputRearmCount, 0);
  assert.equal(outcome.harness.transitionFailureCount, 1);
  assert.equal(outcome.presenter.state.suspended, true);
  assert.equal(outcome.presenter.state.navigationPendingCount, 0);
  assert.equal(outcome.routeButton.restoreCount, 0);
  assert.equal(outcome.routeButton.cutAccepted, true);
  assert.equal(
    outcome.bladeInput.events.filter((event) => event === 'activate').length,
    1,
  );
  assert.equal(
    outcome.bladeInput.events.filter((event) => event === 'deactivate').length,
    1,
  );
  assert.equal(
    outcome.bladeInput.node.listenerCount(CLASSIC_BLADE_BEGAN_EVENT),
    0,
  );
}

function createFatalTimedModeShellHarness(
  route: FatalTimedModeRoute,
  failure: FatalTimedModeFailure,
) {
  const errorMessage = compileAppShellFunction<
    (error: unknown) => string
  >('errorMessage');
  const aggregateWithPrimaryError = compileAppShellFunction<
    (label: string, primary: unknown, secondary: readonly unknown[]) => Error
  >('aggregateWithPrimaryError', { errorMessage });
  const readErrorGraphValue = compileAppShellFunction<
    (value: object, key: string) => unknown
  >('readErrorGraphValue');
  const enqueueErrorGraphValue = compileAppShellFunction<
    (pending: unknown[], value: unknown) => void
  >('enqueueErrorGraphValue');
  const containsCrazyLifecycleRollbackError = compileAppShellFunction<
    (error: unknown) => boolean
  >('containsCrazyLifecycleRollbackError', {
    CrazyLifecycleRollbackError: ExecutableCrazyLifecycleRollbackError,
    enqueueErrorGraphValue,
    readErrorGraphValue,
  });
  const compensateFailedTimedCrazyActivation = compileAppShellMethod<
    (
      this: Record<string, unknown>,
      presenter: InstanceType<typeof ModeSelectPresenter>,
      physics: Readonly<{
        readonly collisionFilterActive: boolean;
        activateCollisionFilter(): boolean;
      }>,
      error: unknown,
      destination: 'Crazy' | 'Crazy Bird',
    ) => never
  >('compensateFailedTimedCrazyActivation', {
    aggregateWithPrimaryError,
    containsCrazyLifecycleRollbackError,
    ModeSelectFatalNavigationError,
  });
  const captureModeSelectFatalScreenRelease = compileAppShellMethod<
    (
      this: Readonly<{
        requireSharedScene(): ExecutableModeSelectSharedScene;
      }>,
      root: StubNode,
    ) => () => void
  >('captureModeSelectFatalScreenRelease');
  const normalizeError = compileAppShellFunction<
    (error: unknown, fallback: string) => Error
  >('normalizeError');
  const runTransition = compileAppShellMethod<
    (
      this: Record<string, unknown>,
      from: string,
      to: string,
      operation: () => boolean,
    ) => boolean
  >('runTransition', {
    ModeSelectFatalNavigationError,
    normalizeError,
  });
  const transition = compileAppShellMethod<
    (
      this: Record<string, unknown>,
      transaction: Readonly<{
        readonly destination: string;
        readonly root: StubNode;
      }>,
    ) => boolean
  >(route.transitionMethod, {
    aggregateWithPrimaryError,
    ClassicBirdLifecycleRollbackError:
      ExecutableClassicBirdLifecycleRollbackError,
    disposeCommittedPresenter: () => {},
    ModeSelectFatalNavigationError,
  });
  const sharedScene = new ExecutableModeSelectSharedScene();
  let filterActive = true;
  let filterReactivationCount = 0;
  let inputRearmCount = 0;
  let transitionFailureCount = 0;
  const nonClassicPhysics = {
    activateCollisionFilter() {
      filterReactivationCount += 1;
      if (failure === 'nonfatal-filter-fatal') {
        throw new Error(
          `injected ${route.label} filter reacquisition failure`,
        );
      }
      filterActive = true;
      return true;
    },
    get collisionFilterActive() {
      return filterActive;
    },
    restorePreviousCollisionFilter() {
      filterActive = false;
      return true;
    },
  };
  const activationError = (): Error => (
    failure === 'direct-fatal'
      ? new ExecutableCrazyLifecycleRollbackError(
        `injected ${route.label} fatal`,
      )
      : new Error(`injected nonfatal ${route.label} activation failure`)
  );
  const crazyGameplay = {
    activateCrazyBirdFromAppShell() {
      throw activationError();
    },
    activateCrazyFromAppShell() {
      throw activationError();
    },
    crazyBirdPrepared: true,
    prepared: true,
  };
  const classicGameplay = {
    activateClassicFromAppShell() {
      throw activationError();
    },
  };
  const classicBirdGameplay = {
    activateClassicBirdFromAppShell() {
      throw activationError();
    },
    prepared: true,
  };
  const shell: Record<string, unknown> = {
    activeModeSelect: null,
    captureModeSelectFatalScreenRelease(root: StubNode) {
      return captureModeSelectFatalScreenRelease.call(this as never, root);
    },
    compensateFailedTimedCrazyActivation(
      presenter: InstanceType<typeof ModeSelectPresenter>,
      physics: typeof nonClassicPhysics,
      error: unknown,
      destination: 'Crazy' | 'Crazy Bird',
    ) {
      return compensateFailedTimedCrazyActivation.call(
        this,
        presenter,
        physics,
        error,
        destination,
      );
    },
    destroyedValue: false,
    emitTransitionFailure() {
      transitionFailureCount += 1;
    },
    requireClassicBirdGameplayController: () => classicBirdGameplay,
    requireCrazyGameplayController: () => crazyGameplay,
    requireGameplayController: () => classicGameplay,
    requireNonClassicPhysics: () => nonClassicPhysics,
    requireSharedScene: () => sharedScene,
    restoreModeSelectAfterFailedClassicActivation(root: StubNode) {
      sharedScene.attachCurrentScreen(root);
    },
    restoreModeSelectAfterFailedClassicBirdActivation(root: StubNode) {
      sharedScene.attachCurrentScreen(root);
    },
    restoreModeSelectAfterFailedCrazyActivation(root: StubNode) {
      sharedScene.attachCurrentScreen(root);
    },
    restoreModeSelectAfterFailedCrazyBirdActivation(root: StubNode) {
      sharedScene.attachCurrentScreen(root);
    },
    runTransition(from: string, to: string, operation: () => boolean) {
      return runTransition.call(this, from, to, operation);
    },
    stateValue: 'mode-select',
    transitioning: false,
  };

  return {
    attachPresenter(presenter: InstanceType<typeof ModeSelectPresenter>) {
      const host = new cc.Node('SharedGameSceneRoot');
      presenter.root.setParent(host);
      sharedScene.attachExistingScreen(host, presenter.root);
      shell.activeModeSelect = presenter;
      const rearm = presenter.rearmNavigationAfterFailure.bind(presenter);
      Object.defineProperty(presenter, 'rearmNavigationAfterFailure', {
        configurable: true,
        value: () => {
          inputRearmCount += 1;
          return rearm();
        },
      });
    },
    get currentScreen() {
      return sharedScene.currentScreen;
    },
    get filterActive() {
      return filterActive;
    },
    get filterReactivationCount() {
      return filterReactivationCount;
    },
    get inputRearmCount() {
      return inputRearmCount;
    },
    get state() {
      return shell.stateValue;
    },
    transition(transaction: unknown) {
      return transition.call(shell, transaction as never);
    },
    get transitionFailureCount() {
      return transitionFailureCount;
    },
  };
}

function compileAppShellFunction<T extends (...args: any[]) => unknown>(
  functionName: string,
  dependencies: Readonly<Record<string, unknown>> = {},
): T {
  const source = extractAppShellMember(`function ${functionName}(`);
  return compileAppShellTypeScriptFunction<T>(
    source,
    functionName,
    dependencies,
  );
}

function compileAppShellMethod<T extends (...args: any[]) => unknown>(
  methodName: string,
  dependencies: Readonly<Record<string, unknown>> = {},
): T {
  const source = extractAppShellMethod(methodName).replace(
    new RegExp(`^\\s*private\\s+${methodName}`),
    `function ${methodName}`,
  );
  return compileAppShellTypeScriptFunction<T>(
    source,
    methodName,
    dependencies,
  );
}

function compileAppShellTypeScriptFunction<T extends (...args: any[]) => unknown>(
  source: string,
  functionName: string,
  dependencies: Readonly<Record<string, unknown>>,
): T {
  const names = Object.keys(dependencies);
  const values = names.map((name) => dependencies[name]);
  const javascript = stripTypeScriptTypes(source, {
    mode: 'transform',
    sourceUrl: `mode-select-presenter.test.${functionName}.ts`,
  });
  return Function(
    ...names,
    `"use strict";\n${javascript}\nreturn ${functionName};`,
  )(...values) as T;
}

function extractAppShellMethod(methodName: string): string {
  const signature = new RegExp(
    `^\\s*(?:private\\s+)?(?:async\\s+)?${methodName}\\b`,
    'm',
  );
  const match = signature.exec(APP_SHELL_SOURCE);
  assert.ok(match, `${methodName} method must exist`);
  return extractAppShellBalancedBlock(match.index);
}

function extractAppShellMember(signature: string): string {
  const start = APP_SHELL_SOURCE.indexOf(signature);
  assert.notEqual(start, -1, `${signature} must exist`);
  return extractAppShellBalancedBlock(start);
}

function extractAppShellBalancedBlock(start: number): string {
  const openBrace = APP_SHELL_SOURCE.indexOf('{', start);
  assert.notEqual(openBrace, -1, 'member body must start');
  let depth = 0;
  for (let index = openBrace; index < APP_SHELL_SOURCE.length; index += 1) {
    const character = APP_SHELL_SOURCE[index];
    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return APP_SHELL_SOURCE.slice(start, index + 1);
      }
    }
  }
  throw new Error('member body is unterminated');
}

function centerCard(
  presenter: InstanceType<typeof ModeSelectPresenter>,
  cardIndex: number,
): void {
  for (let frame = 0; frame < 256; frame += 1) {
    if (presenter.state.model.anchorXs[cardIndex] === 240) {
      return;
    }
    presenter.update(0);
  }
  assert.fail(`card ${String(cardIndex)} did not center within 256 frames`);
}

function emitBladeBegan(
  bladeInput: BladeInputHarness,
  touchId: number,
  slot: number,
  x: number,
  y: number,
): void {
  bladeInput.node.emit(CLASSIC_BLADE_BEGAN_EVENT, {
    point: { x, y },
    slot,
    touchId,
  });
}

function emitBladeMoved(
  bladeInput: BladeInputHarness,
  touchId: number,
  slot: number,
  previousX: number,
  previousY: number,
  currentX: number,
  currentY: number,
  reportedDeltaX?: number,
): void {
  bladeInput.node.emit(CLASSIC_BLADE_MOVED_EVENT, {
    deltaX: reportedDeltaX,
    segment: {
      current: { x: currentX, y: currentY },
      previous: { x: previousX, y: previousY },
      slot,
      touchId,
    },
    shouldPlaySwish: false,
  });
}

function emitBladeEnded(
  bladeInput: BladeInputHarness,
  touchId: number,
  slot: number,
  cancelled: boolean,
): void {
  bladeInput.node.emit(CLASSIC_BLADE_ENDED_EVENT, {
    cancelled,
    slot,
    touchId,
  });
}

function presenterInput(
  bladeInput: BladeInputHarness,
  options: Readonly<{
    audioFailurePath?: string;
    failPersist?: boolean;
    lifecycle?: ReturnType<typeof defaultLifecycle>;
    totalCoins?: number;
    unlocks?: readonly number[];
  }> = {},
) {
  const data = {
    effectsEnabled: true,
    totalCoins: options.totalCoins ?? 0,
  };
  const coinDeltas: number[] = [];
  const unlockReads: number[] = [];
  const randomDraws = { count: 0 };
  const settingsState = {
    addTotalCoins(delta: number) {
      const previousTotalCoins = data.totalCoins;
      data.totalCoins += delta;
      coinDeltas.push(delta);
      return { delta, nextTotalCoins: data.totalCoins, previousTotalCoins };
    },
    get snapshot() { return Object.freeze({ ...data }); },
  };
  const input = {
    audio: {
      playOneShot(canonicalPath: string) {
        if (canonicalPath === options.audioFailurePath) {
          throw new Error('injected audio failure');
        }
      },
    },
    bladeInput,
    canvas: new cc.Node('Canvas'),
    classicResources: {
      assetTree: '480x800' as const,
      defaultBlade: Object.freeze({}),
    },
    lifecycle: options.lifecycle ?? defaultLifecycle(),
    random: {
      nextIntInclusive: (minimum: number) => {
        randomDraws.count += 1;
        return minimum;
      },
    },
    raycast: {
      callAfterStep: (mutation: () => void) => mutation(),
      raycastAll: () => Object.freeze([]),
    },
    resources: {
      assetTree: '480x800' as const,
      font: Object.freeze({}),
      rasterCount: 42 as const,
      raster: (contract: Readonly<{
        canonicalPath: string;
        dimensions: Readonly<{ height: number; width: number }>;
      }>) => Object.freeze({ ...contract, spriteFrame: Object.freeze({}) }),
    },
    settings: {
      persistModeUnlock() {
        if (options.failPersist === true) {
          throw new Error('injected persist failure');
        }
      },
      readModeUnlock(modeIndex: number) {
        unlockReads.push(modeIndex);
        return options.unlocks?.includes(modeIndex) ?? false;
      },
      state: settingsState,
    },
    viewport: Object.freeze({
      logicalHeight: 800,
      logicalWidth: 480,
      visibleRect: Object.freeze({
        bottom: Object.freeze({ x: 240, y: 0 }),
        center: Object.freeze({ x: 240, y: 400 }),
        left: Object.freeze({ x: 0, y: 400 }),
        right: Object.freeze({ x: 480, y: 400 }),
        top: Object.freeze({ x: 240, y: 800 }),
      }),
    }),
  };
  return { coinDeltas, data, input, randomDraws, unlockReads };
}

function bladeInputHarness(): BladeInputHarness {
  const events: string[] = [];
  return {
    activateForClassicLayer: () => events.push('activate'),
    deactivateForNonClassicScreen: () => events.push('deactivate'),
    events,
    node: new cc.Node('BladeInput'),
    setCutEnabled: (enabled: boolean) => events.push(`cut:${String(enabled)}`),
  };
}

function defaultLifecycle() {
  return {
    onClassicRequested(_transaction?: unknown) { return true; },
    onCrazyRequested(_transaction?: unknown) { return true; },
    onClassicBirdRequested(_transaction?: unknown) { return true; },
    onCrazyBirdRequested(_transaction?: unknown) { return true; },
    onComboBirdRequested(_transaction?: unknown) { return true; },
    onMainMenuRequested(_transaction?: unknown) { return true; },
    onUnsupportedDestinationRequested(
      _destination?: unknown,
      _transaction?: unknown,
    ) { return false; },
  };
}

function moduleUrl(source: string): string {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
