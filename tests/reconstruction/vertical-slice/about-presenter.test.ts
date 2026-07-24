import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const SOURCE = readFileSync(
  new URL(
    '../../../game/assets/scripts/creator/about-presenter.ts',
    import.meta.url,
  ),
  'utf8',
);

const CC_STUB_URL = moduleUrl(`
let destroyFailureName = null;
let listenerOffFailure = null;
let listenerOnFailure = null;
export function failNextDestroy(name) { destroyFailureName = name; }
export function failNextListenerRegistration(ownerName, type) {
  listenerOnFailure = { ownerName, type };
}
export function failNextListenerRemoval(ownerName, type) {
  listenerOffFailure = { ownerName, type };
}
class EventOwner {
  constructor() { this.listeners = new Map(); }
  emit(type, event) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener.callback.call(listener.target, event);
    }
  }
  listenerCount(type) { return (this.listeners.get(type) ?? []).length; }
  off(type, callback, target) {
    const ownerName = this.name ?? 'global-input';
    if (
      listenerOffFailure !== null
      && listenerOffFailure.ownerName === ownerName
      && listenerOffFailure.type === type
    ) {
      listenerOffFailure = null;
      throw new Error('injected listener removal failure');
    }
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((listener) => (
      listener.callback !== callback || listener.target !== target
    )));
  }
  on(type, callback, target) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push({ callback, target });
    this.listeners.set(type, listeners);
    const ownerName = this.name ?? 'global-input';
    if (
      listenerOnFailure !== null
      && listenerOnFailure.ownerName === ownerName
      && listenerOnFailure.type === type
    ) {
      listenerOnFailure = null;
      throw new Error('injected listener registration failure');
    }
  }
  resetListeners() { this.listeners.clear(); }
}
export class EventKeyboard {
  constructor(keyCode = 0) { this.keyCode = keyCode; }
}
export const Input = Object.freeze({ EventType: Object.freeze({ KEY_UP: 'key-up' }) });
export const KeyCode = Object.freeze({ MOBILE_BACK: 6 });
export class UITransform {
  constructor() {
    this.anchorPoint = { x: 0.5, y: 0.5 };
    this.contentSize = { width: 0, height: 0 };
  }
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
  setContentSize(width, height) { this.contentSize = { width, height }; }
}
export class UIOpacity { constructor() { this.opacity = 255; } }
export class Sprite {
  static SizeMode = Object.freeze({ CUSTOM: 'CUSTOM' });
  constructor() { this.sizeMode = null; this.spriteFrame = null; }
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
    this.layer = 0;
    this.name = name;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
    this.rotation = { x: 0, y: 0, z: 0, w: 1 };
    this.scale = { x: 1, y: 1, z: 1 };
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
    if (destroyFailureName === this.name) {
      destroyFailureName = null;
      throw new Error('injected destroy failure');
    }
  }
  getComponent(Type) { return this.components.get(Type) ?? null; }
  getSiblingIndex() {
    return this.parent === null ? 0 : this.parent.children.indexOf(this);
  }
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
  setScale(x, y, z = 1) {
    if (typeof x === 'object') this.scale = { ...x };
    else this.scale = { x, y, z };
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
export const input = new EventOwner();
export function isValid(value) {
  return value !== null && value !== undefined && value.destroyed !== true;
}
export function resetTestState() {
  destroyFailureName = null;
  listenerOffFailure = null;
  listenerOnFailure = null;
  input.resetListeners();
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
  failNextDestroy(name: string): void;
  failNextListenerRegistration(ownerName: string, type: string): void;
  failNextListenerRemoval(ownerName: string, type: string): void;
  readonly Input: Readonly<{
    readonly EventType: Readonly<{ readonly KEY_UP: string }>;
  }>;
  readonly KeyCode: Readonly<{ readonly MOBILE_BACK: number }>;
  readonly Node: StubNodeConstructor;
  readonly Sprite: new () => StubSprite;
  readonly UIOpacity: new () => StubOpacity;
  readonly UITransform: new () => StubTransform;
  readonly input: StubEventOwner;
  resetTestState(): void;
};

const {
  AboutCleanupError,
  AboutPostCommitAudioError,
  AboutPostCommitSettingsError,
  AboutPresenter,
} = await import(
  '../../../game/assets/scripts/creator/about-presenter.ts'
);
const {
  ABOUT_BACK_AUDIO_CANONICAL_PATH,
  ABOUT_RASTER_RESOURCE_COUNT,
  collectAboutRasterResources,
  getAboutRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/about-resource-contract.ts'
);

interface StubEventOwner {
  emit(type: string, event?: unknown): void;
  listenerCount(type: string): number;
}

interface StubSprite {
  spriteFrame: Readonly<{ readonly canonicalPath: string }> | null;
}

interface StubOpacity {
  opacity: number;
}

interface StubTransform {
  anchorPoint: Readonly<{ readonly x: number; readonly y: number }>;
  contentSize: Readonly<{ readonly height: number; readonly width: number }>;
}

interface StubNode extends StubEventOwner {
  active: boolean;
  readonly activeInHierarchy: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  layer: number;
  name: string;
  parent: StubNode | null;
  readonly position: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  readonly scale: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  readonly worldPosition: Readonly<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }>;
  addComponent<T>(Type: new () => T): T;
  destroy(): void;
  getComponent<T>(Type: new () => T): T | null;
  getSiblingIndex(): number;
  setParent(parent: StubNode | null, keepWorldTransform?: boolean): void;
}

interface StubNodeConstructor {
  new (name?: string): StubNode;
  readonly EventType: Readonly<{
    readonly TOUCH_CANCEL: string;
    readonly TOUCH_END: string;
    readonly TOUCH_START: string;
  }>;
}

type AssetTree = '480x800' | '720x1280';
type PresenterInstance = InstanceType<typeof AboutPresenter>;

interface Fixture {
  readonly audio: string[];
  readonly canvas: StubNode;
  effectsEnabled(): boolean;
  effectsReads: number;
  readonly events: unknown[];
  readonly host: StubNode;
  lifecycle(transaction: unknown): boolean | void;
  readonly order: string[];
  readonly presenter: PresenterInstance;
  readonly random: ReturnType<typeof randomHarness>;
}

test('constructs the exact detached dual-profile graph and keeps production pulse dormant', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    const fixture = createFixture({ assetTree });
    const { presenter } = fixture;
    const profile = getAboutRasterResources(assetTree);
    const root = presenter.root as unknown as StubNode;
    const menu = requireChild(root, 'menu');

    assert.equal(root.parent, null);
    assert.equal(root.active, false);
    assert.equal(presenter.state.activated, false);
    assert.equal(Object.isFrozen(presenter.state), true);
    assert.equal(Object.isFrozen(presenter.presentation), true);
    assert.deepEqual(
      root.children.map(({ name }) => name),
      ['background', 'menu', 'gestures-layer'],
    );
    assert.deepEqual(
      menu.children.map(({ name }) => name),
      ['menu-item', 'review-item', 'email-item', 'like-item'],
    );
    assert.deepEqual(presenter.presentation.menu.itemOrder, [
      'menu',
      'review',
      'email',
      'like',
    ]);
    assert.equal(
      spriteOf(requireChild(root, 'background')).spriteFrame?.canonicalPath,
      profile.background.canonicalPath,
    );

    for (const purpose of ['menu', 'review', 'email', 'like'] as const) {
      const node = requireChild(menu, `${purpose}-item`);
      const plan = presenter.presentation.menu[purpose];
      assert.deepEqual(node.position, { ...plan.position, z: 0 });
      assert.deepEqual(node.scale, { x: 1, y: 1, z: 1 });
      assert.deepEqual(
        transformOf(node).anchorPoint,
        { x: plan.anchor.x, y: plan.anchor.y },
      );
      assert.deepEqual(
        transformOf(node).contentSize,
        plan.resources.normal.dimensions,
      );
      assert.equal(
        spriteOf(node).spriteFrame?.canonicalPath,
        plan.resources.normal.canonicalPath,
      );
      assert.equal(node.listenerCount(cc.Node.EventType.TOUCH_END), 0);
    }
    assert.equal(cc.input.listenerCount(cc.Input.EventType.KEY_UP), 0);
    assert.equal(presenter.presentation.reviewPulseEligibility.eligible, false);
    assert.equal(
      presenter.presentation.reviewPulseEligibility.liveConnectivityRequested,
      false,
    );
    assert.equal(
      presenter.presentation.reviewPulseEligibility.externalActionRequested,
      false,
    );
    assert.equal(presenter.presentation.reviewPulsePlan, null);
    assert.equal(fixture.random.calls.length, 0);

    attachAndActivate(fixture);
    presenter.update(60);
    assert.equal(presenter.state.heartCount, 0);
    assert.equal(presenter.state.pulseElapsedSeconds, 0);
    assert.equal(fixture.random.calls.length, 0);
    assert.equal(requireChild(menu, 'review-item').scale.x, 1);
    presenter.dispose();
  }
});

test('direct controls expose selected/start/end/cancel and only sanitized retired events', () => {
  const fixture = createFixture({
    retiredObserver(event) {
      fixture.events.push(event);
      if ((event as { action?: string }).action === 'review') {
        throw new Error('observer failure must be contained');
      }
    },
  });
  attachAndActivate(fixture);

  const expected = [
    ['review', 'review'],
    ['email', 'feedback'],
    ['like', 'social'],
  ] as const;
  for (const [controlName, action] of expected) {
    const control = controlOf(fixture, controlName);
    const plan = fixture.presenter.presentation.menu[controlName];
    control.emit(cc.Node.EventType.TOUCH_START);
    assert.equal(
      spriteOf(control).spriteFrame?.canonicalPath,
      plan.resources.selected.canonicalPath,
    );
    assert.deepEqual(
      transformOf(control).contentSize,
      plan.resources.selected.dimensions,
    );
    control.emit(cc.Node.EventType.TOUCH_CANCEL);
    assert.equal(
      spriteOf(control).spriteFrame?.canonicalPath,
      plan.resources.normal.canonicalPath,
    );
    control.emit(cc.Node.EventType.TOUCH_START);
    control.emit(cc.Node.EventType.TOUCH_END);
    assert.equal(
      spriteOf(control).spriteFrame?.canonicalPath,
      plan.resources.normal.canonicalPath,
    );
    const observed = fixture.events.at(-1) as {
      readonly action: string;
      readonly reason: string;
    };
    assert.deepEqual(observed, { action, reason: 'retired-offline' });
    assert.equal(Object.isFrozen(observed), true);
    assert.equal(fixture.presenter.state.retiredActionPending, false);
  }

  assert.equal(fixture.events.length, 3);
  assert.deepEqual(fixture.audio, []);
  assert.deepEqual(fixture.order, []);
  assert.equal(fixture.effectsReads, 0);
  assert.equal(fixture.random.calls.length, 0);
  assert.equal(fixture.presenter.state.navigationPending, false);
  fixture.presenter.dispose();
});

test('Menu and MOBILE_BACK send one frozen transaction and block pending duplicates', () => {
  const fixture = createFixture();
  const transactions: unknown[] = [];
  fixture.lifecycle = (transaction) => {
    fixture.order.push('lifecycle');
    transactions.push(transaction);
    return true;
  };
  attachAndActivate(fixture);
  const menu = controlOf(fixture, 'menu');
  const menuPlan = fixture.presenter.presentation.menu.menu;

  menu.emit(cc.Node.EventType.TOUCH_START);
  assert.equal(
    spriteOf(menu).spriteFrame?.canonicalPath,
    menuPlan.resources.selected.canonicalPath,
  );
  menu.emit(cc.Node.EventType.TOUCH_CANCEL);
  assert.equal(
    spriteOf(menu).spriteFrame?.canonicalPath,
    menuPlan.resources.normal.canonicalPath,
  );
  menu.emit(cc.Node.EventType.TOUCH_END);
  cc.input.emit(cc.Input.EventType.KEY_UP, { keyCode: cc.KeyCode.MOBILE_BACK });
  menu.emit(cc.Node.EventType.TOUCH_END);

  assert.equal(transactions.length, 1);
  assert.deepEqual(transactions[0], {
    destination: 'MainMenuLayer',
    root: fixture.presenter.root,
    timing: 'immediate',
    zOrder: 1,
  });
  assert.equal(Object.isFrozen(transactions[0]), true);
  assert.equal(fixture.presenter.state.navigationPending, true);
  assert.deepEqual(fixture.order, ['lifecycle', 'effects', 'audio']);
  assert.deepEqual(fixture.audio, [ABOUT_BACK_AUDIO_CANONICAL_PATH]);
  assert.equal(fixture.effectsReads, 1);
  fixture.presenter.dispose();

  const hardware = createFixture({ effectsEnabled: false });
  let hardwareCalls = 0;
  hardware.lifecycle = () => {
    hardwareCalls += 1;
    return true;
  };
  attachAndActivate(hardware);
  cc.input.emit(cc.Input.EventType.KEY_UP, { keyCode: cc.KeyCode.MOBILE_BACK });
  assert.equal(hardwareCalls, 1);
  assert.equal(hardware.effectsReads, 1);
  assert.deepEqual(hardware.audio, []);
  hardware.presenter.dispose();
});

test('false and throwing routes restore the exact root, listeners, and omit post-commit effects', () => {
  for (const outcome of ['false', 'throw'] as const) {
    const fixture = createFixture();
    const before = new cc.Node('before');
    const after = new cc.Node('after');
    before.setParent(fixture.host);
    fixture.presenter.root.setParent(fixture.host as never);
    after.setParent(fixture.host);
    fixture.presenter.root.setSiblingIndex(1);
    fixture.presenter.activate();
    const transactions: unknown[] = [];

    fixture.lifecycle = (transaction) => {
      transactions.push(transaction);
      assert.equal(fixture.presenter.suspendForTransition(), true);
      fixture.presenter.root.setParent(null, true);
      if (outcome === 'throw') {
        throw new Error('injected About route failure');
      }
      return false;
    };

    if (outcome === 'throw') {
      assert.throws(
        () => controlOf(fixture, 'menu').emit(cc.Node.EventType.TOUCH_END),
        /injected About route failure/,
      );
    } else {
      controlOf(fixture, 'menu').emit(cc.Node.EventType.TOUCH_END);
    }
    assert.equal(transactions.length, 1);
    assert.equal(fixture.presenter.root.parent, fixture.host);
    assert.equal(fixture.presenter.root.getSiblingIndex(), 1);
    assert.equal(fixture.presenter.state.navigationPending, false);
    assert.equal(fixture.presenter.state.suspended, false);
    assert.equal(
      controlOf(fixture, 'menu').listenerCount(cc.Node.EventType.TOUCH_END),
      1,
    );
    assert.equal(cc.input.listenerCount(cc.Input.EventType.KEY_UP), 1);
    assert.equal(fixture.effectsReads, 0);
    assert.deepEqual(fixture.audio, []);
    fixture.presenter.dispose();
  }
});

test('post-commit settings and audio failures are typed and never rearm About', () => {
  {
    const fixture = createFixture({
      effectsReader() {
        throw new Error('injected effects failure');
      },
    });
    attachAndActivate(fixture);
    fixture.lifecycle = () => {
      fixture.order.push('lifecycle');
      assert.equal(fixture.presenter.suspendForTransition(), true);
      assert.equal(fixture.presenter.dispose(), true);
      return true;
    };
    assert.throws(
      () => controlOf(fixture, 'menu').emit(cc.Node.EventType.TOUCH_END),
      (error: unknown) => (
        error instanceof AboutPostCommitSettingsError
        && /injected effects failure/.test(error.message)
      ),
    );
    assert.equal(fixture.presenter.state.disposed, true);
    assert.equal(fixture.presenter.root.destroyed, true);
    assert.deepEqual(fixture.order, ['lifecycle', 'effects']);
    assert.deepEqual(fixture.audio, []);
  }

  {
    const fixture = createFixture({ audioError: new Error('injected audio failure') });
    attachAndActivate(fixture);
    fixture.lifecycle = () => {
      fixture.order.push('lifecycle');
      assert.equal(fixture.presenter.suspendForTransition(), true);
      assert.equal(fixture.presenter.dispose(), true);
      return true;
    };
    assert.throws(
      () => controlOf(fixture, 'menu').emit(cc.Node.EventType.TOUCH_END),
      (error: unknown) => (
        error instanceof AboutPostCommitAudioError
        && /injected audio failure/.test(error.message)
      ),
    );
    assert.equal(fixture.presenter.state.disposed, true);
    assert.equal(fixture.presenter.root.destroyed, true);
    assert.deepEqual(fixture.order, ['lifecycle', 'effects', 'audio']);
    assert.deepEqual(fixture.audio, [ABOUT_BACK_AUDIO_CANONICAL_PATH]);
  }
});

test('suspend, rearm, activation rollback, and disposal own direct listeners idempotently', () => {
  const fixture = createFixture();
  assert.throws(() => fixture.presenter.activate(), /host-attached/);
  attachAndActivate(fixture);
  assert.throws(() => fixture.presenter.activate(), /only once/);
  for (const controlName of ['menu', 'review', 'email', 'like'] as const) {
    assert.equal(
      controlOf(fixture, controlName).listenerCount(cc.Node.EventType.TOUCH_END),
      1,
    );
  }
  assert.equal(cc.input.listenerCount(cc.Input.EventType.KEY_UP), 1);
  assert.equal(fixture.presenter.suspendForTransition(), true);
  assert.equal(fixture.presenter.suspendForTransition(), false);
  assert.equal(cc.input.listenerCount(cc.Input.EventType.KEY_UP), 0);
  assert.equal(fixture.presenter.rearmNavigationAfterFailure(), true);
  assert.equal(cc.input.listenerCount(cc.Input.EventType.KEY_UP), 1);
  assert.equal(fixture.presenter.dispose(), true);
  assert.equal(fixture.presenter.dispose(), false);
  assert.equal(fixture.presenter.root.destroyed, true);
  assert.equal(cc.input.listenerCount(cc.Input.EventType.KEY_UP), 0);

  const registrationFailure = createFixture();
  registrationFailure.presenter.root.setParent(registrationFailure.host as never);
  cc.failNextListenerRegistration(
    'review-item',
    cc.Node.EventType.TOUCH_END,
  );
  assert.throws(
    () => registrationFailure.presenter.activate(),
    /injected listener registration failure/,
  );
  assert.equal(registrationFailure.presenter.root.active, false);
  assert.equal(
    controlOf(registrationFailure, 'menu').listenerCount(
      cc.Node.EventType.TOUCH_START,
    ),
    0,
  );
  assert.equal(
    controlOf(registrationFailure, 'review').listenerCount(
      cc.Node.EventType.TOUCH_END,
    ),
    0,
  );
  assert.equal(cc.input.listenerCount(cc.Input.EventType.KEY_UP), 0);
  registrationFailure.presenter.activate();
  registrationFailure.presenter.dispose();

  const removalFailure = createFixture();
  attachAndActivate(removalFailure);
  cc.failNextListenerRemoval('email-item', cc.Node.EventType.TOUCH_END);
  assert.throws(
    () => removalFailure.presenter.suspendForTransition(),
    (error: unknown) => (
      error instanceof AboutCleanupError
      && error.causes.length === 1
    ),
  );
  assert.equal(removalFailure.presenter.state.poisoned, true);
  assert.equal(removalFailure.presenter.state.suspended, true);
  assert.throws(
    () => removalFailure.presenter.rearmNavigationAfterFailure(),
    /cannot rearm navigation/,
  );
  assert.equal(removalFailure.presenter.dispose(), true);
  assert.equal(removalFailure.presenter.root.destroyed, true);
});

test('fixture-only pulse uses exact five-draw hearts, catches up, pauses, and retains invisibles', () => {
  const fixture = createFixture({
    localCompatibilityAvailable: true,
    randomDeciles: [0.2, 0.4],
  });
  attachAndActivate(fixture);
  const review = controlOf(fixture, 'review');

  fixture.presenter.update(0.449);
  assert.equal(fixture.presenter.state.heartCount, 0);
  assert.equal(fixture.random.calls.length, 0);
  fixture.presenter.update(0.001);
  assert.equal(fixture.presenter.state.heartCount, 1);
  assert.ok(Math.abs(review.scale.x - Math.fround(1.15)) < 0.000_001);
  assert.deepEqual(fixture.random.calls, [
    'int:48:96',
    'int:40:120',
    'decile',
    'decile',
    'int:80:200',
  ]);

  const firstHeart = requireChild(
    fixture.presenter.root as unknown as StubNode,
    'about-heart-1',
  );
  assert.deepEqual(firstHeart.worldPosition, { x: 48, y: 40, z: 1 });
  assert.ok(Math.abs(firstHeart.scale.x - Math.fround(0.6)) < 0.000_001);
  assert.equal(opacityOf(firstHeart).opacity, 255);
  assert.equal(firstHeart.destroyed, false);

  fixture.presenter.update(0.45);
  assert.equal(fixture.presenter.state.heartCount, 2);
  assert.ok(Math.abs(review.scale.x - 1) < 0.000_001);
  fixture.presenter.update(1.8);
  assert.equal(fixture.presenter.state.heartCount, 6);
  assert.equal(opacityOf(firstHeart).opacity, 0);
  assert.deepEqual(firstHeart.worldPosition, { x: 48, y: 120, z: 1 });
  assert.equal(firstHeart.destroyed, false);
  assert.equal(
    (fixture.presenter.root as unknown as StubNode).children.at(-1)?.name,
    'gestures-layer',
  );

  const pausedAt = fixture.presenter.state.pulseElapsedSeconds;
  assert.equal(fixture.presenter.suspendForTransition(), true);
  fixture.presenter.update(1);
  assert.equal(fixture.presenter.state.pulseElapsedSeconds, pausedAt);
  assert.equal(fixture.presenter.state.heartCount, 6);
  assert.equal(fixture.presenter.rearmNavigationAfterFailure(), true);
  fixture.presenter.update(0.45);
  assert.equal(fixture.presenter.state.heartCount, 7);

  assert.equal(fixture.presenter.dispose(), true);
  assert.equal(firstHeart.destroyed, true);
});

test('validates ports/resources/delta and keeps forbidden platform surfaces absent', () => {
  const valid = createFixture();
  assert.throws(
    () => AboutPresenter.create(null as never),
    /input must be an object/,
  );
  assert.throws(
    () => AboutPresenter.create({
      ...baseInput(valid),
      resources: { ...aboutResources(), rasterCount: 9 },
    } as never),
    /complete 10-raster catalog/,
  );
  assert.throws(
    () => AboutPresenter.create({
      ...baseInput(valid),
      settings: { effectsEnabled() { return true; }, extra: true },
    } as never),
    /must contain exactly effectsEnabled/,
  );
  assert.throws(
    () => AboutPresenter.create({
      ...baseInput(valid),
      localReviewEligibility: {
        localCompatibilityAvailable: false,
        rated: false,
        extra: true,
      },
    } as never),
    /must contain exactly/,
  );
  assert.throws(
    () => AboutPresenter.create({
      ...baseInput(valid),
      random: { nextDecile() { return 0; } },
    } as never),
    /requires nextIntInclusive/,
  );

  const substituted = aboutResources();
  substituted.raster = (resource) => ({
    canonicalPath: `${resource.canonicalPath}.wrong`,
    dimensions: resource.dimensions,
    spriteFrame: { canonicalPath: resource.canonicalPath },
  });
  assert.throws(
    () => AboutPresenter.create({
      ...baseInput(valid),
      resources: substituted,
    } as never),
    /raster contract changed/,
  );

  const before = valid.presenter.state.pulseElapsedSeconds;
  assert.throws(() => valid.presenter.update(Number.NaN), /non-negative finite/);
  assert.throws(() => valid.presenter.update(-0.01), /non-negative finite/);
  assert.throws(() => valid.presenter.update(60.001), /must not exceed 60/);
  assert.equal(valid.presenter.state.pulseElapsedSeconds, before);

  assert.match(SOURCE, /createDetachedScreenRoot\('AboutRoot', input\.canvas\)/);
  assert.match(SOURCE, /onRetiredAction\(RETIRED_ACTION_EVENTS\[action\]\)/);
  assert.match(SOURCE, /reason: 'retired-offline'/);
  assert.match(SOURCE, /AboutPostCommitAudioError/);
  assert.match(SOURCE, /AboutPostCommitSettingsError/);
  for (const forbidden of [
    'BladeInput',
    'setCutEnabled',
    'fetch(',
    'XMLHttpRequest',
    'openURL',
    'market://',
    'fb://',
    'JniHelper',
    'showInterstitial',
    'stopBackgroundMusic',
    'stopMusic',
    'awardCoins',
    'addCoins',
    'persistRated',
  ]) {
    assert.equal(
      SOURCE.includes(forbidden),
      false,
      `About presenter source must not contain ${forbidden}`,
    );
  }
});

function createFixture(options: Readonly<{
  readonly assetTree?: AssetTree;
  readonly audioError?: unknown;
  readonly effectsEnabled?: boolean;
  readonly effectsReader?: () => boolean;
  readonly localCompatibilityAvailable?: boolean;
  readonly randomDeciles?: readonly number[];
  readonly rated?: boolean;
  readonly retiredObserver?: (event: unknown) => void;
}> = {}): Fixture {
  cc.resetTestState();
  const assetTree = options.assetTree ?? '480x800';
  const audio: string[] = [];
  const events: unknown[] = [];
  const order: string[] = [];
  const random = randomHarness(options.randomDeciles);
  const canvas = new cc.Node('Canvas');
  canvas.layer = 17;
  const host = new cc.Node('SharedGameSceneRoot');
  host.layer = 17;
  const fixture = {
    audio,
    canvas,
    effectsEnabled: () => options.effectsEnabled ?? true,
    effectsReads: 0,
    events,
    host,
    lifecycle: () => false,
    order,
    presenter: null as unknown as PresenterInstance,
    random,
  } satisfies Fixture;
  fixture.presenter = AboutPresenter.create({
    audio: {
      playOneShot(canonicalPath: string) {
        order.push('audio');
        audio.push(canonicalPath);
        if (options.audioError !== undefined) {
          throw options.audioError;
        }
      },
    },
    canvas: canvas as never,
    lifecycle: {
      onMainMenuRequested(transaction: unknown) {
        return fixture.lifecycle(transaction);
      },
      onRetiredAction(event: unknown) {
        if (options.retiredObserver === undefined) {
          events.push(event);
        } else {
          options.retiredObserver(event);
        }
      },
    },
    localReviewEligibility: {
      localCompatibilityAvailable:
        options.localCompatibilityAvailable ?? false,
      rated: options.rated ?? false,
    },
    random: random.port,
    resources: aboutResources(assetTree),
    settings: {
      effectsEnabled() {
        fixture.effectsReads += 1;
        order.push('effects');
        if (options.effectsReader !== undefined) {
          return options.effectsReader();
        }
        return fixture.effectsEnabled();
      },
    },
    viewport: viewport(assetTree),
  });
  return fixture;
}

function baseInput(fixture: Fixture): Record<string, unknown> {
  return {
    audio: { playOneShot() {} },
    canvas: fixture.canvas,
    lifecycle: {
      onMainMenuRequested() { return false; },
      onRetiredAction() {},
    },
    localReviewEligibility: {
      localCompatibilityAvailable: false,
      rated: false,
    },
    random: fixture.random.port,
    resources: aboutResources(),
    settings: { effectsEnabled() { return true; } },
    viewport: viewport('480x800'),
  };
}

function attachAndActivate(fixture: Fixture): void {
  fixture.presenter.root.setParent(fixture.host as never, true);
  fixture.presenter.activate();
}

function aboutResources(assetTree: AssetTree = '480x800'): {
  readonly assetTree: AssetTree;
  rasterCount: number;
  raster(resource: Readonly<{
    readonly canonicalPath: string;
    readonly dimensions: Readonly<{ readonly height: number; readonly width: number }>;
  }>): Readonly<{
    readonly canonicalPath: string;
    readonly dimensions: Readonly<{ readonly height: number; readonly width: number }>;
    readonly spriteFrame: Readonly<{ readonly canonicalPath: string }>;
  }>;
} {
  const contracts = new Map(
    collectAboutRasterResources(assetTree).map((resource) => [
      resource.canonicalPath,
      resource,
    ]),
  );
  return {
    assetTree,
    rasterCount: ABOUT_RASTER_RESOURCE_COUNT,
    raster(resource) {
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

function randomHarness(deciles: readonly number[] = [0.2, 0.4]) {
  const calls: string[] = [];
  let decileIndex = 0;
  return {
    calls,
    port: {
      nextDecile() {
        calls.push('decile');
        const value = deciles[decileIndex % deciles.length] ?? 0;
        decileIndex += 1;
        return value;
      },
      nextIntInclusive(minimum: number, maximum: number) {
        calls.push(`int:${minimum}:${maximum}`);
        return minimum;
      },
    },
  };
}

function viewport(assetTree: AssetTree) {
  const logicalWidth = assetTree === '480x800' ? 480 : 720;
  const logicalHeight = assetTree === '480x800' ? 800 : 1280;
  return Object.freeze({
    logicalHeight,
    logicalWidth,
    visibleRect: Object.freeze({
      bottom: Object.freeze({ x: logicalWidth / 2, y: 0 }),
      center: Object.freeze({ x: logicalWidth / 2, y: logicalHeight / 2 }),
      left: Object.freeze({ x: 0, y: logicalHeight / 2 }),
      right: Object.freeze({ x: logicalWidth, y: logicalHeight / 2 }),
      top: Object.freeze({ x: logicalWidth / 2, y: logicalHeight }),
    }),
  });
}

function controlOf(
  fixture: Fixture,
  purpose: 'menu' | 'review' | 'email' | 'like',
): StubNode {
  return requireChild(
    requireChild(fixture.presenter.root as unknown as StubNode, 'menu'),
    `${purpose}-item`,
  );
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

function opacityOf(node: StubNode): StubOpacity {
  const opacity = node.getComponent(cc.UIOpacity);
  assert.ok(opacity, `${node.name} is missing UIOpacity`);
  return opacity;
}

function transformOf(node: StubNode): StubTransform {
  const transform = node.getComponent(cc.UITransform);
  assert.ok(transform, `${node.name} is missing UITransform`);
  return transform;
}

function moduleUrl(source: string): string {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
