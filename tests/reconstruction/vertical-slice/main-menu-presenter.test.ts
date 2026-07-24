import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const CC_STUB_URL = moduleUrl(`
export class UITransform {
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
  setContentSize(width, height) { this.contentSize = { width, height }; }
}
export class UIOpacity { constructor() { this.opacity = 255; } }
export class Sprite {
  static SizeMode = Object.freeze({ CUSTOM: 'CUSTOM' });
  constructor() { this.sizeMode = null; this.spriteFrame = null; }
}
export class Label { constructor() { this.font = null; this.fontSize = 0; this.string = ''; } }
export class Collider2D { constructor() { this.tag = 0; } }
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
    this.eulerAngles = { x: 0, y: 0, z: 0 };
    this.layer = 0;
    this.listeners = new Map();
    this.name = name;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
    this.worldPositionWrites = 0;
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
  emit(type, event) {
    for (const listener of this.listeners.get(type) ?? []) listener.callback.call(listener.target, event);
  }
  getComponent(Type) { return this.components.get(Type) ?? null; }
  listenerCount(type) { return (this.listeners.get(type) ?? []).length; }
  off(type, callback, target) {
    const retained = (this.listeners.get(type) ?? []).filter((listener) => (
      listener.callback !== callback || listener.target !== target
    ));
    this.listeners.set(type, retained);
  }
  on(type, callback, target) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push({ callback, target });
    this.listeners.set(type, listeners);
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
    this.worldPositionWrites += 1;
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
export const STANDARD_BLADE_SLOT_COUNT = 4;
export class StandardBladePresenter {
  static create() { return new StandardBladePresenter(); }
  constructor() {
    this.claimed = new Set();
    this.events = [];
    this.root = new Node('StandardBladeRoot');
    this.root.active = false;
  }
  attach(parent) { this.root.setParent(parent); this.root.active = true; }
  begin(slot) {
    if (this.claimed.has(slot)) throw new Error('blade slot already claimed: ' + slot);
    this.claimed.add(slot);
    this.events.push('begin:' + slot);
  }
  dispose() { this.root.destroy(); return true; }
  end(slot) {
    if (!this.claimed.has(slot)) throw new Error('blade slot is not claimed: ' + slot);
    this.claimed.delete(slot);
    this.events.push('end:' + slot);
  }
  isClaimed(slot) { return this.claimed.has(slot); }
  move(slot) {
    if (!this.claimed.has(slot)) throw new Error('blade slot is not claimed: ' + slot);
    this.events.push('move:' + slot);
  }
  presentMovedSegment() {}
  update() {}
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

const FRUIT_STUB_URL = moduleUrl(`
import { Collider2D, Node } from 'cc';
export const createdFruitPresenters = [];
let failActivationIndex = -1;
let activationFailureConsumed = false;
export function configureActivationFailure(index) {
  failActivationIndex = index;
  activationFailureConsumed = false;
}
export function resetFruitPresenters() {
  createdFruitPresenters.length = 0;
  configureActivationFailure(-1);
}
export function mainMenuLegacyRotationToCreatorDegrees(value) { return Math.fround(value); }
export class MainMenuFruitPresenter {
  static create(input, lifecycle) {
    const fruit = new MainMenuFruitPresenter(input.presentation, lifecycle, createdFruitPresenters.length);
    createdFruitPresenters.push(fruit);
    return fruit;
  }
  constructor(presentation, lifecycle, index) {
    this.activated = false;
    this.collider = new Collider2D();
    this.commitCount = 0;
    this.committed = false;
    this.cutAccepted = false;
    this.disposed = false;
    this.index = index;
    this.lifecycle = lifecycle;
    this.presentation = presentation;
    this.rollbackCount = 0;
    this.root = new Node(presentation.purpose + '-fruit-button');
    this.root.active = false;
    this.targetId = 'main-menu-fruit:' + presentation.purpose;
  }
  activate() {
    if (this.index === failActivationIndex && !activationFailureConsumed) {
      activationFailureConsumed = true;
      throw new Error('injected fruit activation failure');
    }
    if (this.activated) throw new Error('fruit already activated');
    this.activated = true;
    this.root.active = true;
  }
  attach(parent, siblingIndex) { this.root.setParent(parent); this.root.setSiblingIndex(siblingIndex); }
  commitCut() {
    if (this.disposed || !this.cutAccepted || this.committed) return false;
    this.commitCount += 1;
    this.committed = true;
    return true;
  }
  cut(_segment, effectsEnabled) {
    if (!this.activated || this.disposed || this.cutAccepted) return false;
    this.cutAccepted = true;
    let rollbackNavigation = null;
    try {
      if (effectsEnabled) this.lifecycle.onPlayFruitAudio('fruit.wav');
      rollbackNavigation = this.lifecycle.onNavigation(this.presentation.purpose) ?? null;
      this.lifecycle.onGlobalFruitCut();
      this.lifecycle.onFruitTypeCut(this.presentation.fruitId);
    } catch (error) {
      rollbackNavigation?.();
      this.cutAccepted = false;
      throw error;
    }
    return true;
  }
  deactivateAfterActivationFailure() {
    if (!this.activated) return false;
    this.activated = false;
    this.root.active = false;
    return true;
  }
  dispose() { if (this.disposed) return false; this.disposed = true; this.root.destroy(); return true; }
  rollbackCut() {
    if (!this.cutAccepted || this.committed) return false;
    this.cutAccepted = false;
    this.rollbackCount += 1;
    return true;
  }
  snapshot() {
    return Object.freeze({ bodyWorldPosition: { x: 0, y: 0 }, cutDisabled: this.cutAccepted, id: this.targetId, isFruit: true, nodeTag: 0 });
  }
  updateAction() {}
}
`);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') return { shortCircuit: true, url: CC_STUB_URL };
    if (specifier === './standard-blade-presenter') {
      return { shortCircuit: true, url: BLADE_STUB_URL };
    }
    if (specifier === './blade-input-controller') {
      return { shortCircuit: true, url: BLADE_INPUT_STUB_URL };
    }
    if (specifier === './detached-screen-root') {
      return { shortCircuit: true, url: DETACHED_ROOT_STUB_URL };
    }
    if (specifier === './main-menu-fruit-presenter') {
      return { shortCircuit: true, url: FRUIT_STUB_URL };
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
const fruitStub = await import(FRUIT_STUB_URL) as unknown as FruitStub;
const { MainMenuPresenter } = await import(
  '../../../game/assets/scripts/creator/main-menu-presenter.ts'
);

interface StubNode {
  active: boolean;
  readonly activeInHierarchy: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  layer: number;
  readonly name: string;
  parent: StubNode | null;
  worldPositionWrites: number;
  emit(type: string, event?: unknown): void;
  setParent(parent: StubNode | null): void;
}

interface StubFruitPresenter {
  activated: boolean;
  commitCount: number;
  cutAccepted: boolean;
  cut(segment: unknown, effectsEnabled: boolean): boolean;
  disposed: boolean;
  rollbackCount: number;
}

interface FruitStub {
  readonly createdFruitPresenters: StubFruitPresenter[];
  configureActivationFailure(index: number): void;
  resetFruitPresenters(): void;
}

interface BladeInputHarness {
  readonly events: string[];
  readonly node: StubNode;
  activateForClassicLayer(): void;
  deactivateForNonClassicScreen(): void;
  setCutEnabled(enabled: boolean): void;
}

test('detached or suspended disposal releases BladeInput only when Main Menu owns its lease', () => {
  fruitStub.resetFruitPresenters();
  const neverActivatedInput = bladeInputHarness();
  const detached = MainMenuPresenter.create(input(neverActivatedInput));
  assert.equal(detached.root.parent, null);
  assert.equal(detached.root.active, false);
  assert.equal(detached.dispose(), true);
  assert.deepEqual(neverActivatedInput.events, []);
  assert.equal(detached.dispose(), false);

  const activeInput = bladeInputHarness();
  const active = MainMenuPresenter.create(input(activeInput));
  const host = new cc.Node('SharedGameSceneRoot');
  active.root.setParent(host as never);
  active.activate();
  assert.equal(active.suspendForTransition(), true);
  const releasesAtSuspend = activeInput.events.filter((event) => event === 'deactivate').length;
  assert.equal(releasesAtSuspend, 1);
  assert.equal(active.dispose(), true);
  assert.equal(
    activeInput.events.filter((event) => event === 'deactivate').length,
    releasesAtSuspend,
  );
});

test('suspend ends claimed blade slots before input reset so rollback can reuse slot zero', () => {
  fruitStub.resetFruitPresenters();
  const bladeInput = bladeInputHarness();
  const presenter = MainMenuPresenter.create(input(bladeInput));
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot') as never);
  presenter.activate();
  const blade = presenter.blade as unknown as {
    readonly events: readonly string[];
    isClaimed(slot: number): boolean;
  };

  bladeInput.node.emit('classic-blade-began', {
    point: { x: 100, y: 200 },
    slot: 0,
    touchId: 40,
  });
  assert.equal(blade.isClaimed(0), true);
  assert.equal(presenter.suspendForTransition(), true);
  assert.equal(blade.isClaimed(0), false);
  assert.equal(blade.events.at(-1), 'end:0');

  assert.equal(presenter.rearmNavigationAfterFailure(), true);
  assert.doesNotThrow(() => bladeInput.node.emit('classic-blade-began', {
    point: { x: 120, y: 220 },
    slot: 0,
    touchId: 41,
  }));
  assert.equal(blade.isClaimed(0), true);
  presenter.dispose();
});

test('pre-suspension screen replacement failure treats an active idle source as already rearmed', () => {
  fruitStub.resetFruitPresenters();
  const bladeInput = bladeInputHarness();
  const presenter = MainMenuPresenter.create(input(bladeInput));
  const host = new cc.Node('SharedGameSceneRoot');
  presenter.root.setParent(host as never);
  presenter.activate();
  const eventsBeforeRearm = [...bladeInput.events];

  assert.equal(presenter.state.navigationPending, false);
  assert.equal(presenter.state.suspended, false);
  assert.equal(presenter.rearmNavigationAfterFailure(), true);
  assert.deepEqual(bladeInput.events, eventsBeforeRearm);
  assert.equal(presenter.state.navigationPending, false);
  assert.equal(presenter.state.suspended, false);

  presenter.dispose();
});

test('failed suspension poisons uncertain Main Menu input ownership and rejects rearm', () => {
  fruitStub.resetFruitPresenters();
  const bladeInput = bladeInputHarness({ failDeactivate: true });
  const presenter = MainMenuPresenter.create(input(bladeInput));
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot') as never);
  presenter.activate();

  assert.throws(
    () => presenter.suspendForTransition(),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, 'MainMenuCleanupError');
      assert.match(error.message, /Main Menu suspension failed/);
      return true;
    },
  );
  assert.equal(presenter.state.poisoned, true);
  assert.equal(presenter.state.suspended, true);
  assert.throws(
    () => presenter.rearmNavigationAfterFailure(),
    /Poisoned Main Menu presenter cannot rearm navigation/,
  );
  assert.throws(() => presenter.dispose(), /Main Menu disposal: 1 failure/);
  assert.equal(presenter.root.destroyed, true);
});

test('partial fruit activation rolls back atomically and permits a clean retry', () => {
  fruitStub.resetFruitPresenters();
  fruitStub.configureActivationFailure(1);
  const bladeInput = bladeInputHarness();
  const presenter = MainMenuPresenter.create(input(bladeInput));
  const host = new cc.Node('SharedGameSceneRoot');
  presenter.root.setParent(host as never);

  assert.throws(() => presenter.activate(), /injected fruit activation failure/);
  assert.equal(presenter.root.active, false);
  assert.equal(presenter.state.activated, false);
  assert.deepEqual(
    fruitStub.createdFruitPresenters.map(({ activated }) => activated),
    [false, false, false],
  );
  assert.deepEqual(bladeInput.events.filter((event) => event === 'deactivate'), ['deactivate']);

  presenter.activate();
  assert.equal(presenter.state.activated, true);
  assert.deepEqual(
    fruitStub.createdFruitPresenters.map(({ activated }) => activated),
    [true, true, true],
  );
  presenter.dispose();
});

test('failed Mode Select transaction resumes shared input and permits recutting the same fruit', () => {
  fruitStub.resetFruitPresenters();
  const bladeInput = bladeInputHarness();
  let presenter: InstanceType<typeof MainMenuPresenter>;
  const lifecycle = defaultLifecycle();
  lifecycle.onModeSelectRequested = () => {
    assert.equal(presenter.suspendForTransition(), true);
    return false;
  };
  presenter = MainMenuPresenter.create(input(bladeInput, lifecycle));
  const host = new cc.Node('SharedGameSceneRoot');
  presenter.root.setParent(host as never);
  presenter.activate();
  const newGame = presenter.fruitButtons.find(({ presentation }) => (
    presentation.purpose === 'new-game'
  ));
  assert.ok(newGame);

  const segment = { end: { x: 2, y: 2 }, start: { x: 1, y: 1 } };
  assert.equal(newGame.cut(segment, true), true);
  const leaderboard = presenter.fruitButtons.find(({ presentation }) => (
    presentation.purpose === 'leaderboard'
  ));
  assert.ok(leaderboard);
  assert.equal(leaderboard.cut(segment, true), true);
  assert.equal(presenter.state.navigationPending, true);
  presenter.update(0.75);

  assert.equal(presenter.state.navigationPending, false);
  assert.equal(presenter.state.suspended, false);
  assert.equal((newGame as unknown as StubFruitPresenter).rollbackCount, 1);
  assert.equal((newGame as unknown as StubFruitPresenter).cutAccepted, false);
  assert.equal((leaderboard as unknown as StubFruitPresenter).rollbackCount, 1);
  assert.equal((leaderboard as unknown as StubFruitPresenter).cutAccepted, false);
  assert.deepEqual(bladeInput.events.slice(-4), [
    'cut:false',
    'deactivate',
    'activate',
    'cut:true',
  ]);
  assert.equal(newGame.cut(segment, true), true);
  presenter.dispose();
  assert.doesNotThrow(() => presenter.update(-1));
});

test('successful destination callback commits once before fallible post-commit effects', () => {
  fruitStub.resetFruitPresenters();
  const bladeInput = bladeInputHarness();
  let presenter: InstanceType<typeof MainMenuPresenter>;
  let destinationCalls = 0;
  const lifecycle = defaultLifecycle();
  lifecycle.onModeSelectRequested = () => {
    destinationCalls += 1;
    presenter.suspendForTransition();
    return true;
  };
  const presenterInput = input(bladeInput, lifecycle);
  presenterInput.audio.stopBackgroundMusic = () => {
    throw new Error('injected music stop failure');
  };
  presenter = MainMenuPresenter.create(presenterInput);
  const host = new cc.Node('SharedGameSceneRoot');
  presenter.root.setParent(host as never);
  presenter.activate();
  const segment = { end: { x: 2, y: 2 }, start: { x: 1, y: 1 } };
  const newGame = presenter.fruitButtons.find(({ presentation }) => (
    presentation.purpose === 'new-game'
  ));
  const leaderboard = presenter.fruitButtons.find(({ presentation }) => (
    presentation.purpose === 'leaderboard'
  ));
  assert.ok(newGame);
  assert.ok(leaderboard);
  newGame.cut(segment, true);
  leaderboard.cut(segment, true);

  assert.throws(() => presenter.update(0.75), /post-commit cleanup/);
  assert.equal(destinationCalls, 1);
  assert.equal(presenter.state.navigationPending, false);
  assert.equal((newGame as unknown as StubFruitPresenter).commitCount, 1);
  assert.equal((leaderboard as unknown as StubFruitPresenter).commitCount, 1);
  presenter.update(1);
  assert.equal(destinationCalls, 1);
  presenter.dispose();
});

test('Leaderboard fruit uses its dedicated delayed route instead of the unsupported boundary', () => {
  fruitStub.resetFruitPresenters();
  const bladeInput = bladeInputHarness();
  const transactions: unknown[] = [];
  let unsupportedCalls = 0;
  const lifecycle = defaultLifecycle();
  lifecycle.onLeaderboardRequested = (transaction: unknown) => {
    transactions.push(transaction);
    return true;
  };
  lifecycle.onUnsupportedDestinationRequested = () => {
    unsupportedCalls += 1;
    return false;
  };
  const presenter = MainMenuPresenter.create(input(bladeInput, lifecycle));
  const host = new cc.Node('SharedGameSceneRoot');
  presenter.root.setParent(host as never);
  presenter.activate();
  const leaderboard = presenter.fruitButtons.find(({ presentation }) => (
    presentation.purpose === 'leaderboard'
  ));
  assert.ok(leaderboard);

  assert.equal(
    leaderboard.cut({ end: { x: 2, y: 2 }, start: { x: 1, y: 1 } }, true),
    true,
  );
  presenter.update(0.749);
  assert.deepEqual(transactions, []);
  presenter.update(0.001);

  assert.equal(unsupportedCalls, 0);
  assert.deepEqual(transactions, [{
    destination: 'LeaderboardLayer',
    root: presenter.root,
    timing: 'delayed',
    zOrder: 1,
  }]);
  assert.equal(presenter.state.navigationPending, false);
  presenter.dispose();
});

test('Objectives fruit uses its dedicated delayed route instead of the unsupported boundary', () => {
  fruitStub.resetFruitPresenters();
  const bladeInput = bladeInputHarness();
  const transactions: unknown[] = [];
  let unsupportedCalls = 0;
  const lifecycle = defaultLifecycle();
  lifecycle.onObjectivesRequested = (transaction: unknown) => {
    transactions.push(transaction);
    return true;
  };
  lifecycle.onUnsupportedDestinationRequested = () => {
    unsupportedCalls += 1;
    return false;
  };
  const presenter = MainMenuPresenter.create(input(bladeInput, lifecycle));
  const host = new cc.Node('SharedGameSceneRoot');
  presenter.root.setParent(host as never);
  presenter.activate();
  const objectives = presenter.fruitButtons.find(({ presentation }) => (
    presentation.purpose === 'objectives'
  ));
  assert.ok(objectives);

  assert.equal(
    objectives.cut({ end: { x: 2, y: 2 }, start: { x: 1, y: 1 } }, true),
    true,
  );
  presenter.update(0.749);
  assert.deepEqual(transactions, []);
  presenter.update(0.001);

  assert.equal(unsupportedCalls, 0);
  assert.deepEqual(transactions, [{
    destination: 'ObjectivesLayer',
    root: presenter.root,
    timing: 'delayed',
    zOrder: 1,
  }]);
  assert.equal(presenter.state.navigationPending, false);
  presenter.dispose();
});

test('objective failure cancels the delayed route before the same fruit can be cut again', () => {
  fruitStub.resetFruitPresenters();
  const bladeInput = bladeInputHarness();
  let destinationCalls = 0;
  const lifecycle = defaultLifecycle();
  lifecycle.onObjectivesRequested = () => {
    destinationCalls += 1;
    return true;
  };
  const presenterInput = input(bladeInput, lifecycle);
  let failGlobalObjective = true;
  presenterInput.objectives.processGlobalFruitCut = () => {
    if (failGlobalObjective) {
      throw new Error('injected objective storage failure');
    }
  };
  const presenter = MainMenuPresenter.create(presenterInput);
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot') as never);
  presenter.activate();
  const objectives = presenter.fruitButtons.find(({ presentation }) => (
    presentation.purpose === 'objectives'
  ));
  assert.ok(objectives);
  const segment = { end: { x: 2, y: 2 }, start: { x: 1, y: 1 } };

  assert.throws(
    () => objectives.cut(segment, true),
    /injected objective storage failure/,
  );
  assert.equal(presenter.state.navigationPending, false);
  assert.equal((objectives as unknown as StubFruitPresenter).cutAccepted, false);
  assert.deepEqual(bladeInput.events.slice(-2), ['cut:false', 'cut:true']);
  presenter.update(1);
  assert.equal(destinationCalls, 0);

  failGlobalObjective = false;
  assert.equal(objectives.cut(segment, true), true);
  assert.equal(presenter.state.navigationPending, true);
  presenter.update(0.75);
  assert.equal(destinationCalls, 1);
  presenter.dispose();
});

test('objective failure on a follower fruit preserves the route owned by the first fruit', () => {
  fruitStub.resetFruitPresenters();
  const bladeInput = bladeInputHarness();
  let destinationCalls = 0;
  const lifecycle = defaultLifecycle();
  lifecycle.onModeSelectRequested = () => {
    destinationCalls += 1;
    return true;
  };
  const presenterInput = input(bladeInput, lifecycle);
  let globalObjectiveCalls = 0;
  presenterInput.objectives.processGlobalFruitCut = () => {
    globalObjectiveCalls += 1;
    if (globalObjectiveCalls === 2) {
      throw new Error('injected follower objective storage failure');
    }
  };
  const presenter = MainMenuPresenter.create(presenterInput);
  presenter.root.setParent(new cc.Node('SharedGameSceneRoot') as never);
  presenter.activate();
  const newGame = presenter.fruitButtons.find(({ presentation }) => (
    presentation.purpose === 'new-game'
  ));
  const leaderboard = presenter.fruitButtons.find(({ presentation }) => (
    presentation.purpose === 'leaderboard'
  ));
  assert.ok(newGame);
  assert.ok(leaderboard);
  const segment = { end: { x: 2, y: 2 }, start: { x: 1, y: 1 } };

  assert.equal(newGame.cut(segment, true), true);
  assert.throws(
    () => leaderboard.cut(segment, true),
    /injected follower objective storage failure/,
  );
  assert.equal(presenter.state.navigationPending, true);
  assert.equal((newGame as unknown as StubFruitPresenter).cutAccepted, true);
  assert.equal((leaderboard as unknown as StubFruitPresenter).cutAccepted, false);

  presenter.update(0.75);

  assert.equal(destinationCalls, 1);
  assert.equal((newGame as unknown as StubFruitPresenter).commitCount, 1);
  assert.equal((leaderboard as unknown as StubFruitPresenter).commitCount, 0);
  presenter.dispose();
});

test('cut-gate failure restores model and fruit so a later cut can navigate', () => {
  fruitStub.resetFruitPresenters();
  const bladeInput = bladeInputHarness({ failDisableOnce: true });
  const presenter = MainMenuPresenter.create(input(bladeInput));
  const host = new cc.Node('SharedGameSceneRoot');
  presenter.root.setParent(host as never);
  presenter.activate();
  const newGame = presenter.fruitButtons.find(({ presentation }) => (
    presentation.purpose === 'new-game'
  ));
  assert.ok(newGame);
  const segment = { end: { x: 2, y: 2 }, start: { x: 1, y: 1 } };

  assert.throws(() => newGame.cut(segment, true), /injected cut disable failure/);
  assert.equal(presenter.state.navigationPending, false);
  assert.equal((newGame as unknown as StubFruitPresenter).cutAccepted, false);
  assert.equal(newGame.cut(segment, true), true);
  assert.equal(presenter.state.navigationPending, true);
  presenter.dispose();
});

test('About false and throw both bypass unsupported routing and reacquire host-suspended input', () => {
  for (const failure of ['false', 'throw'] as const) {
    fruitStub.resetFruitPresenters();
    const bladeInput = bladeInputHarness();
    const audioCalls: string[] = [];
    let presenter: InstanceType<typeof MainMenuPresenter>;
    let unsupportedCalls = 0;
    const lifecycle = defaultLifecycle();
    lifecycle.onAboutRequested = () => {
      presenter.suspendForTransition();
      if (failure === 'throw') throw new Error('injected About route failure');
      return false;
    };
    lifecycle.onUnsupportedDestinationRequested = () => {
      unsupportedCalls += 1;
      return false;
    };
    const presenterInput = input(bladeInput, lifecycle);
    presenterInput.audio.playOneShot = () => {
      audioCalls.push('menu-click');
    };
    presenter = MainMenuPresenter.create(presenterInput);
    const host = new cc.Node('SharedGameSceneRoot');
    presenter.root.setParent(host as never);
    presenter.activate();
    audioCalls.length = 0;
    const controls = presenter as unknown as {
      readonly controls: { readonly about: { readonly node: StubNode } };
    };
    if (failure === 'throw') {
      assert.throws(
        () => controls.controls.about.node.emit('touch-end'),
        /injected About route failure/,
      );
    } else {
      controls.controls.about.node.emit('touch-end');
    }
    assert.equal(unsupportedCalls, 0);
    assert.deepEqual(audioCalls, []);
    assert.equal(presenter.state.navigationPending, false);
    assert.equal(presenter.state.poisoned, false);
    assert.equal(presenter.state.suspended, false);
    assert.deepEqual(bladeInput.events.slice(-4), [
      'cut:false',
      'deactivate',
      'activate',
      'cut:true',
    ]);
    presenter.dispose();
  }
});

test('About uses its explicit immediate route and plays its click only after host commit', () => {
  fruitStub.resetFruitPresenters();
  const bladeInput = bladeInputHarness();
  const transactions: unknown[] = [];
  const order: string[] = [];
  let unsupportedCalls = 0;
  const lifecycle = defaultLifecycle();
  lifecycle.onAboutRequested = (transaction: unknown) => {
    order.push('host-commit');
    transactions.push(transaction);
    return true;
  };
  lifecycle.onUnsupportedDestinationRequested = () => {
    unsupportedCalls += 1;
    return false;
  };
  const presenterInput = input(bladeInput, lifecycle);
  presenterInput.audio.playOneShot = () => {
    order.push('menu-click');
  };
  const presenter = MainMenuPresenter.create(presenterInput);
  const host = new cc.Node('SharedGameSceneRoot');
  presenter.root.setParent(host as never);
  presenter.activate();
  order.length = 0;
  const controls = presenter as unknown as {
    readonly controls: { readonly about: { readonly node: StubNode } };
  };

  controls.controls.about.node.emit('touch-end');

  assert.equal(unsupportedCalls, 0);
  assert.deepEqual(order, ['host-commit', 'menu-click']);
  assert.deepEqual(transactions, [{
    destination: 'AboutLayer',
    root: presenter.root,
    timing: 'immediate',
    zOrder: 1,
  }]);
  presenter.dispose();
});

test('About lifecycle boundary is required during presenter construction', () => {
  fruitStub.resetFruitPresenters();
  const lifecycle = {
    ...defaultLifecycle(),
    onAboutRequested: undefined,
  };

  assert.throws(
    () => MainMenuPresenter.create(input(bladeInputHarness(), lifecycle as never)),
    /lifecycle port requires onAboutRequested\(\)/,
  );
});

test('immediate Options host and rearm failures are retained together', () => {
  fruitStub.resetFruitPresenters();
  const bladeInput = bladeInputHarness({ failReactivate: true });
  let presenter: InstanceType<typeof MainMenuPresenter>;
  const hostFailure = new Error('injected Options host failure');
  const lifecycle = defaultLifecycle();
  lifecycle.onOptionsRequested = () => {
    presenter.suspendForTransition();
    throw hostFailure;
  };
  presenter = MainMenuPresenter.create(input(bladeInput, lifecycle));
  const host = new cc.Node('SharedGameSceneRoot');
  presenter.root.setParent(host as never);
  presenter.activate();
  const controls = presenter as unknown as {
    readonly controls: { readonly options: { readonly node: StubNode } };
  };

  assert.throws(
    () => controls.controls.options.node.emit('touch-end'),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, 'MainMenuCleanupError');
      const failures = (error as Error & { readonly failures: readonly unknown[] }).failures;
      assert.equal(failures[0], hostFailure);
      assert.match(String(failures[1]), /injected reactivate failure/);
      return true;
    },
  );
  assert.deepEqual(bladeInput.events.slice(-4), [
    'cut:true',
    'cut:false',
    'deactivate',
    'activate',
  ]);
  presenter.dispose();
});

test('Options uses its explicit immediate route instead of the unsupported boundary', () => {
  fruitStub.resetFruitPresenters();
  const bladeInput = bladeInputHarness();
  const transactions: unknown[] = [];
  let unsupportedCalls = 0;
  const lifecycle = defaultLifecycle();
  lifecycle.onOptionsRequested = (transaction: unknown) => {
    transactions.push(transaction);
    return true;
  };
  lifecycle.onUnsupportedDestinationRequested = () => {
    unsupportedCalls += 1;
    return false;
  };
  const presenter = MainMenuPresenter.create(input(bladeInput, lifecycle));
  const host = new cc.Node('SharedGameSceneRoot');
  presenter.root.setParent(host as never);
  presenter.activate();
  const controls = presenter as unknown as {
    readonly controls: { readonly options: { readonly node: StubNode } };
  };

  controls.controls.options.node.emit('touch-end');

  assert.equal(unsupportedCalls, 0);
  assert.equal(transactions.length, 1);
  assert.deepEqual(transactions[0], {
    destination: 'OptionsLayer',
    root: presenter.root,
    timing: 'immediate',
    zOrder: 1,
  });
  presenter.dispose();
});

test('extreme deltas fail before action mutation and completed retained hearts stop updating', () => {
  fruitStub.resetFruitPresenters();
  const presenter = MainMenuPresenter.create(input(bladeInputHarness()));
  const host = new cc.Node('SharedGameSceneRoot');
  presenter.root.setParent(host as never);
  presenter.activate();
  assert.throws(() => presenter.update(Number.MAX_VALUE), /must not exceed/);

  presenter.update(0.45);
  const firstHeart = presenter.root.children.find(({ name }) => name === 'review-heart');
  assert.ok(firstHeart);
  presenter.update(1.5);
  const completedWrites = firstHeart.worldPositionWrites;
  const heartState = presenter as unknown as {
    readonly activeHearts: readonly Array<{ readonly node: StubNode }>;
  };
  assert.equal(heartState.activeHearts.some(({ node }) => node === firstHeart), false);
  assert.ok(heartState.activeHearts.length < presenter.state.retainedHeartCount);
  presenter.update(0.1);
  assert.equal(firstHeart.worldPositionWrites, completedWrites);
  assert.ok(presenter.state.retainedHeartCount > 0);
  presenter.dispose();
});

test('disposal aggregates a release failure after destroying all owned nodes', () => {
  fruitStub.resetFruitPresenters();
  const presenter = MainMenuPresenter.create(input(
    bladeInputHarness({ failDeactivate: true }),
  ));
  const host = new cc.Node('SharedGameSceneRoot');
  presenter.root.setParent(host as never);
  presenter.activate();

  assert.throws(() => presenter.dispose(), /Main Menu disposal: 1 failure/);
  assert.equal(presenter.root.destroyed, true);
  assert.equal(fruitStub.createdFruitPresenters.every(({ disposed }) => disposed), true);
  assert.equal(presenter.dispose(), false);
});

test('runtime source preserves detached construction, exact append order, and separate route ports', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(
    new URL('../../../game/assets/scripts/creator/main-menu-presenter.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /createDetachedScreenRoot\('MainMenuRoot', input\.canvas\)/);
  assert.match(source, /this\.root\.active = false/);
  assert.match(source, /this\.input\.resources\.raster\(layout\.resource\)/);
  assert.match(source, /StandardBladePresenter\.create\(/);
  assert.match(source, /input\.standardBlades\.selectedBladeId/);
  assert.match(source, /this\.blade\.update\(deltaSeconds\)/);
  assert.match(source, /this\.blade\.presentMovedSegment\(event\.segment\)/);
  const order = [
    "this.blade.attach(this.root)",
    "'pencilbladebk'",
    "'pencilblade'",
    "'total-coins-panel'",
    'this.attachCoinsLabel',
    "const menu = new Node('menu')",
    "'orange-wheel'",
    "'black-wheel'",
    'this.presentation.fruitButtons.map',
    "new Node('gestures-layer')",
  ];
  for (let index = 1; index < order.length; index += 1) {
    assert.ok(source.indexOf(order[index - 1]) < source.indexOf(order[index]));
  }
  assert.match(source, /onLeaderboardRequested/);
  assert.match(source, /onModeSelectRequested/);
  assert.match(source, /onObjectivesRequested/);
  assert.match(source, /onAboutRequested/);
  assert.match(source, /onOptionsRequested/);
  assert.match(source, /onUnsupportedDestinationRequested/);
  assert.match(source, /callAfterStep: \(mutation\) => input\.raycast\.callAfterStep\(mutation\)/);
  assert.match(source, /if \(this\.inputLeaseHeld\)/);
  assert.doesNotMatch(source, /swish|placeholder/i);
});

function input(
  bladeInput: BladeInputHarness,
  lifecycle = defaultLifecycle(),
) {
  const data = {
    effectsEnabled: true,
    musicEnabled: true,
    networkAvailable: true,
    rated: false,
    totalCoins: 40,
  };
  const settingsState = {
    addTotalCoins(delta: number) {
      const previousTotalCoins = data.totalCoins;
      data.totalCoins += delta;
      return { delta, nextTotalCoins: data.totalCoins, previousTotalCoins };
    },
    setEffectsEnabled(enabled: boolean) { data.effectsEnabled = enabled; },
    setMusicEnabled(enabled: boolean) { data.musicEnabled = enabled; },
    setRated(rated: boolean) { data.rated = rated; },
    get snapshot() { return Object.freeze({ ...data }); },
  };
  return {
    audio: {
      playLoopingBackground() {},
      playOneShot() {},
      stopAllEffects() {},
      stopBackgroundMusic() {},
    },
    bladeInput,
    canvas: new cc.Node('Canvas'),
    classicResources: {
      assetTree: '480x800' as const,
    },
    lifecycle,
    objectives: {
      processFruitTypeCut() {},
      processGlobalFruitCut() {},
    },
    random: {
      nextDecile: () => 0.5,
      nextIntInclusive: (minimum: number) => minimum,
    },
    raycast: {
      callAfterStep: (mutation: () => void) => mutation(),
      raycastAll: () => Object.freeze([]),
    },
    resources: {
      assetTree: '480x800' as const,
      font: Object.freeze({}),
      raster: (contract: Readonly<{
        canonicalPath: string;
        dimensions: Readonly<{ height: number; width: number }>;
      }>) => Object.freeze({ ...contract, spriteFrame: Object.freeze({}) }),
    },
    settings: {
      persistRatedFlag() {},
      save() {},
      state: settingsState,
    },
    standardBlades: {
      selectedBladeId: 15,
      catalog: {
        profile(bladeId: number) {
          return makeStandardBladeProfile(bladeId);
        },
      },
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
}

function makeStandardBladeProfile(bladeId: number) {
  if (bladeId === 17) {
    return Object.freeze({
      bladeId,
      kind: 'centipede',
      particles: Object.freeze([]),
      resources: Object.freeze({
        body: makeLoadedRaster('480x800/Blades/Centipede/body.png', 12, 40),
        bodySegmentCount: 20 as const,
        head: makeLoadedRaster('480x800/Blades/Centipede/head.png', 47, 44),
        pointCapacity: 32 as const,
        tail: makeLoadedRaster('480x800/Blades/Centipede/tail.png', 51, 14),
      }),
    });
  }
  if (bladeId >= 13 && bladeId <= 16) {
    const variant = bladeId - 13;
    return Object.freeze({
      bladeId,
      kind: 'dragon',
      particles: Object.freeze([]),
      resources: Object.freeze({
        body: makeLoadedRaster(
          `480x800/Blades/Dragon/dragon-body-${variant}.png`,
          variant === 0 ? 21 : variant === 1 ? 21 : variant === 2 ? 21 : 21,
          variant === 0 ? 17 : variant === 1 ? 17 : variant === 2 ? 17 : 17,
        ),
        bodySegmentCount: 15 as const,
        head: makeLoadedRaster(
          `480x800/Blades/Dragon/dragon-head-${variant}.png`,
          92,
          63,
        ),
        pointCapacity: 32 as const,
        tail: makeLoadedRaster(
          `480x800/Blades/Dragon/dragon-tail-${variant}.png`,
          53,
          22,
        ),
      }),
      variant,
    });
  }
  const canonicalPath = bladeId === 11
    ? '480x800/Blades/firebladetexture.png'
    : bladeId === 12
      ? '480x800/Blades/rainbow.png'
      : `480x800/Blades/blade${bladeId}.png`;
  const spriteFrame = Object.freeze({
    destroyed: false,
    texture: Object.freeze({ canonicalPath }),
    uv: Object.freeze([0, 1, 1, 1, 0, 0, 1, 0]),
  });
  return Object.freeze({
    bladeId,
    kind: 'basic',
    particles: Object.freeze([]),
    texture: Object.freeze({
      canonicalPath,
      dimensions: Object.freeze({ height: 256, width: 256 }),
      spriteFrame,
    }),
  });
}

function makeLoadedRaster(canonicalPath: string, width: number, height: number) {
  return Object.freeze({
    canonicalPath,
    dimensions: Object.freeze({ height, width }),
    spriteFrame: {
      destroyed: false,
      label: canonicalPath,
      originalSize: Object.freeze({ height, width }),
      rect: Object.freeze({ height, width }),
      destroy() {},
    },
  });
}

function bladeInputHarness(options: Readonly<{
  failReactivate?: boolean;
  failDeactivate?: boolean;
  failDisableOnce?: boolean;
}> = {}): BladeInputHarness {
  const events: string[] = [];
  let activationCount = 0;
  let disableFailed = false;
  return {
    activateForClassicLayer: () => {
      events.push('activate');
      activationCount += 1;
      if (options.failReactivate === true && activationCount > 1) {
        throw new Error('injected reactivate failure');
      }
    },
    deactivateForNonClassicScreen: () => {
      events.push('deactivate');
      if (options.failDeactivate === true) {
        throw new Error('injected deactivate failure');
      }
    },
    events,
    node: new cc.Node('BladeInput'),
    setCutEnabled: (enabled: boolean) => {
      events.push(`cut:${String(enabled)}`);
      if (!enabled && options.failDisableOnce === true && !disableFailed) {
        disableFailed = true;
        throw new Error('injected cut disable failure');
      }
    },
  };
}

function defaultLifecycle() {
  return {
    onAboutRequested() { return true; },
    onExitRequested() {},
    onLeaderboardRequested() { return true; },
    onModeSelectRequested() { return true; },
    onObjectivesRequested() { return true; },
    onOptionsRequested() { return true; },
    onPlatformReviewRequested() { return true; },
    onUnsupportedDestinationRequested() { return false; },
  };
}

function moduleUrl(source: string): string {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
