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
export class ClassicBladePresenter {
  static create() { return new ClassicBladePresenter(); }
  constructor() { this.root = new Node('ClassicBasicBladeRoot'); this.root.active = false; }
  attach(parent) { this.root.setParent(parent); this.root.active = true; }
  begin() {}
  dispose() { this.root.destroy(); return true; }
  end() {}
  move() {}
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
    try {
      if (effectsEnabled) this.lifecycle.onPlayFruitAudio('fruit.wav');
      this.lifecycle.onNavigation(this.presentation.purpose);
    } catch (error) {
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
    if (specifier === './classic-blade-presenter') {
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

test('immediate route false and throw both reacquire input after host suspension', () => {
  for (const failure of ['false', 'throw'] as const) {
    fruitStub.resetFruitPresenters();
    const bladeInput = bladeInputHarness();
    let presenter: InstanceType<typeof MainMenuPresenter>;
    const lifecycle = defaultLifecycle();
    lifecycle.onUnsupportedDestinationRequested = () => {
      presenter.suspendForTransition();
      if (failure === 'throw') throw new Error('injected immediate route failure');
      return false;
    };
    presenter = MainMenuPresenter.create(input(bladeInput, lifecycle));
    const host = new cc.Node('SharedGameSceneRoot');
    presenter.root.setParent(host as never);
    presenter.activate();
    const controls = presenter as unknown as {
      readonly controls: { readonly about: { readonly node: StubNode } };
    };
    if (failure === 'throw') {
      assert.throws(
        () => controls.controls.about.node.emit('touch-end'),
        /injected immediate route failure/,
      );
    } else {
      controls.controls.about.node.emit('touch-end');
    }
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
  assert.match(source, /onModeSelectRequested/);
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
      defaultBlade: Object.freeze({}),
    },
    lifecycle,
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

function bladeInputHarness(options: Readonly<{
  failDeactivate?: boolean;
  failDisableOnce?: boolean;
}> = {}): BladeInputHarness {
  const events: string[] = [];
  let disableFailed = false;
  return {
    activateForClassicLayer: () => events.push('activate'),
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
    onExitRequested() {},
    onModeSelectRequested() { return true; },
    onPlatformReviewRequested() { return true; },
    onUnsupportedDestinationRequested() { return false; },
  };
}

function moduleUrl(source: string): string {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
