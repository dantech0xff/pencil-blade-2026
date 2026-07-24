import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const SOURCE = readFileSync(
  new URL('../../../game/assets/scripts/creator/options-presenter.ts', import.meta.url),
  'utf8',
);

const CC_STUB_URL = moduleUrl(`
let listenerFailure = null;
let siblingIndexFailureName = null;
export function failNextListenerRegistration(ownerName, type) {
  listenerFailure = { ownerName, type };
}
export function failNextSiblingIndex(name) {
  siblingIndexFailureName = name;
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
      listenerFailure !== null
      && listenerFailure.ownerName === ownerName
      && listenerFailure.type === type
    ) {
      listenerFailure = null;
      throw new Error('injected listener registration failure');
    }
  }
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
export class Label {
  constructor() { this.color = null; this.font = null; this.fontSize = 0; this.string = ''; }
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
  setRotationFromEuler(x, y, z) { this.eulerAngles = { x, y, z }; }
  setScale(x, y, z = 1) { this.scale = { x, y, z }; }
  setSiblingIndex(index) {
    if (this.parent === null) return;
    const siblings = this.parent.children;
    const current = siblings.indexOf(this);
    if (current >= 0) siblings.splice(current, 1);
    siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, this);
    if (siblingIndexFailureName === this.name) {
      siblingIndexFailureName = null;
      throw new Error('injected sibling-index failure');
    }
  }
  setWorldPosition(x, y, z = 0) {
    if (typeof x === 'object') {
      z = x.z;
      y = x.y;
      x = x.x;
    }
    if (this.parent === null) this.position = { x, y, z };
    else {
      const parent = this.parent.worldPosition;
      this.position = { x: x - parent.x, y: y - parent.y, z: z - parent.z };
    }
  }
  setWorldRotation(rotation) { this.rotation = rotation; }
  setWorldScale(scale) { this.scale = scale; }
}
export const input = new EventOwner();
export function isValid(value) {
  return value !== null && value !== undefined && !value.destroyed;
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
  failNextListenerRegistration(ownerName: string, type: string): void;
  failNextSiblingIndex(name: string): void;
  readonly Input: Readonly<{ readonly EventType: Readonly<{ readonly KEY_UP: string }> }>;
  readonly KeyCode: Readonly<{ readonly MOBILE_BACK: number }>;
  readonly Label: new () => StubLabel;
  readonly Node: typeof StubNode;
  readonly Sprite: new () => StubSprite;
  readonly UIOpacity: new () => StubOpacity;
  readonly input: StubEventOwner;
};
const {
  OptionsPresenter,
} = await import('../../../game/assets/scripts/creator/options-presenter.ts');

interface StubEventOwner {
  emit(type: string, event?: unknown): void;
  listenerCount(type: string): number;
}

interface StubLabel {
  fontSize: number;
  string: string;
}

interface StubOpacity {
  opacity: number;
}

interface StubSprite {
  spriteFrame: unknown;
}

class StubNode implements StubEventOwner {
  static readonly EventType: Readonly<{
    readonly TOUCH_CANCEL: string;
    readonly TOUCH_END: string;
    readonly TOUCH_START: string;
  }>;

  active = true;
  readonly activeInHierarchy = true;
  readonly children: StubNode[] = [];
  destroyed = false;
  layer = 0;
  readonly name = '';
  parent: StubNode | null = null;
  readonly position = { x: 0, y: 0, z: 0 };
  readonly worldPosition = { x: 0, y: 0, z: 0 };

  destroy(): void {}
  emit(_type: string, _event?: unknown): void {}
  getComponent<T>(_type: new () => T): T | null { return null; }
  getSiblingIndex(): number { return 0; }
  listenerCount(_type: string): number { return 0; }
  setParent(_parent: StubNode | null, _keepWorldTransform?: boolean): void {}
}

interface SettingsHarness {
  backgroundPrices: number[];
  bladePrices: number[];
  effectsEnabled: boolean;
  failNextBackgroundSelection: boolean;
  failNextPurchase: boolean;
  readonly port: ReturnType<typeof settingsHarness>['port'];
  selectedBackground: number;
  selectedBlade: number;
  selectedTheme: number;
  totalCoins: number;
}

interface SharedHarness {
  background: number;
  failNextBackgroundSelection: boolean;
  readonly port: ReturnType<typeof sharedHarness>['port'];
  theme: number;
}

test('detached lifecycle owns listeners and runs exact chained reveal timing and cues', () => {
  const fixture = createFixture();
  const { presenter } = fixture;
  const back = requireDescendant(presenter.root as unknown as StubNode, 'back-item');

  assert.equal(presenter.root.parent, null);
  assert.equal(presenter.root.active, false);
  assert.deepEqual(presenter.state.revealedRows, []);
  assert.equal(back.listenerCount(cc.Node.EventType.TOUCH_END), 0);
  assert.equal(cc.input.listenerCount(cc.Input.EventType.KEY_UP), 0);
  assert.throws(() => presenter.activate(), /host-attached/);

  attachAndActivate(fixture);
  assert.equal(back.listenerCount(cc.Node.EventType.TOUCH_END), 1);
  assert.equal(cc.input.listenerCount(cc.Input.EventType.KEY_UP), 1);
  assert.throws(() => presenter.activate(), /only once/);

  presenter.update(0.75);
  assert.equal(labelOf(requireDescendant(
    presenter.root as unknown as StubNode,
    'total-coins-label',
  )).string, '100');
  assert.equal(opacityOf(requireDescendant(
    presenter.root as unknown as StubNode,
    'total-coins-panel',
  )).opacity, 255);
  assert.deepEqual(presenter.state.revealedRows, []);

  presenter.update(0.499);
  assert.deepEqual(presenter.state.revealedRows, []);
  assert.deepEqual(fixture.audio, []);
  presenter.update(0.001);
  assert.deepEqual(presenter.state.revealedRows, ['background']);
  assert.deepEqual(fixture.audio, []);
  assert.deepEqual(
    (presenter.selectors.background.root as unknown as StubNode).worldPosition,
    { ...presenter.presentation.rows.background.selector.position, z: 0 },
  );

  presenter.update(0.249);
  assert.deepEqual(presenter.state.revealedRows, ['background']);
  presenter.update(0.001);
  assert.deepEqual(presenter.state.revealedRows, ['background', 'blade']);
  assert.deepEqual(fixture.audio, ['Sounds/mono1.wav']);
  presenter.update(0.249);
  assert.deepEqual(presenter.state.revealedRows, ['background', 'blade']);
  presenter.update(0.001);
  assert.deepEqual(presenter.state.revealedRows, ['background', 'blade', 'theme']);
  assert.deepEqual(fixture.audio, ['Sounds/mono1.wav', 'Sounds/mono2.wav']);
  presenter.update(0);
  presenter.update(1);
  assert.deepEqual(fixture.audio, ['Sounds/mono1.wav', 'Sounds/mono2.wav']);

  const beforeInvalid = presenter.state.entryElapsedSeconds;
  const beforeInvalidAudio = [...fixture.audio];
  assert.throws(() => presenter.update(Number.NaN), /finite and non-negative/);
  assert.throws(() => presenter.update(-0.01), /finite and non-negative/);
  assert.equal(presenter.state.entryElapsedSeconds, beforeInvalid);
  assert.deepEqual(fixture.audio, beforeInvalidAudio);

  const childNames = (presenter.root as unknown as StubNode).children.map(({ name }) => name);
  assert.equal(presenter.suspendForTransition(), true);
  assert.equal(presenter.root.active, true);
  assert.equal(back.listenerCount(cc.Node.EventType.TOUCH_END), 0);
  assert.equal(cc.input.listenerCount(cc.Input.EventType.KEY_UP), 0);
  assert.deepEqual(
    (presenter.root as unknown as StubNode).children.map(({ name }) => name),
    childNames,
  );
  assert.equal(presenter.suspendForTransition(), false);
  assert.equal(presenter.rearmNavigationAfterFailure(), true);
  assert.equal(back.listenerCount(cc.Node.EventType.TOUCH_END), 1);
  assert.equal(cc.input.listenerCount(cc.Input.EventType.KEY_UP), 1);

  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.root.destroyed, true);
  assert.equal(cc.input.listenerCount(cc.Input.EventType.KEY_UP), 0);
  assert.equal(presenter.dispose(), false);
  assert.throws(() => presenter.update(-1), /finite and non-negative/);
});

test('all selectors mutate Settings immediately, synchronize persistent visuals, and gate sound', () => {
  const fixture = createFixture();
  attachAndActivate(fixture);
  fixture.presenter.update(1.75);
  fixture.audio.length = 0;

  selectorButton(fixture.presenter, 'background', 'next').emit(
    cc.Node.EventType.TOUCH_END,
  );
  assert.equal(fixture.settings.selectedBackground, 1);
  assert.equal(fixture.shared.background, 1);
  assert.equal(fixture.presenter.state.model.selectedBackground, 1);
  const backgroundBuy = requireDescendant(
    fixture.presenter.root as unknown as StubNode,
    'background-buy-menu',
  );
  assert.equal(backgroundBuy.active, true);
  assert.equal(labelOf(requireDescendant(backgroundBuy, 'background-price-label')).string, '10');

  selectorButton(fixture.presenter, 'blade', 'next').emit(cc.Node.EventType.TOUCH_END);
  assert.equal(fixture.settings.selectedBlade, 1);
  assert.equal(fixture.presenter.state.model.selectedBlade, 1);

  selectorButton(fixture.presenter, 'theme', 'next').emit(cc.Node.EventType.TOUCH_END);
  assert.equal(fixture.settings.selectedTheme, 1);
  assert.equal(fixture.shared.theme, 1);
  assert.equal(fixture.presenter.state.model.selectedTheme, 1);
  assert.deepEqual(fixture.audio, [
    'Sounds/menubuttonclick.wav',
    'Sounds/menubuttonclick.wav',
    'Sounds/menubuttonclick.wav',
  ]);

  fixture.settings.effectsEnabled = false;
  selectorButton(fixture.presenter, 'background', 'next').emit(
    cc.Node.EventType.TOUCH_END,
  );
  assert.equal(fixture.settings.selectedBackground, 2);
  assert.equal(fixture.shared.background, 2);
  assert.equal(fixture.audio.length, 3);
  fixture.presenter.dispose();
});

test('persistence reconciliation rolls back unpaid previews and retains owned selections and theme', () => {
  {
    const fixture = createFixture();
    attachAndActivate(fixture);
    fixture.presenter.update(1.75);
    selectorButton(fixture.presenter, 'background', 'next').emit(
      cc.Node.EventType.TOUCH_END,
    );
    selectorButton(fixture.presenter, 'blade', 'next').emit(
      cc.Node.EventType.TOUCH_END,
    );
    selectorButton(fixture.presenter, 'theme', 'next').emit(
      cc.Node.EventType.TOUCH_END,
    );
    const audioCountBeforeReconciliation = fixture.audio.length;

    fixture.presenter.reconcileSelectionsForPersistence();

    assert.deepEqual({
      model: {
        background: fixture.presenter.state.model.selectedBackground,
        blade: fixture.presenter.state.model.selectedBlade,
        theme: fixture.presenter.state.model.selectedTheme,
      },
      settings: {
        background: fixture.settings.selectedBackground,
        blade: fixture.settings.selectedBlade,
        theme: fixture.settings.selectedTheme,
      },
      shared: {
        background: fixture.shared.background,
        theme: fixture.shared.theme,
      },
    }, {
      model: { background: 0, blade: 0, theme: 1 },
      settings: { background: 0, blade: 0, theme: 1 },
      shared: { background: 0, theme: 1 },
    });
    assert.equal(fixture.presenter.selectors.background.selectedIndex, 0);
    assert.equal(fixture.presenter.selectors.blade.selectedIndex, 0);
    assert.equal(fixture.presenter.selectors.theme.selectedIndex, 1);
    assert.equal(requireDescendant(
      fixture.presenter.root as unknown as StubNode,
      'background-buy-menu',
    ).active, false);
    assert.equal(requireDescendant(
      fixture.presenter.root as unknown as StubNode,
      'blade-buy-menu',
    ).active, false);
    assert.equal(fixture.presenter.state.navigationPending, false);
    assert.equal(fixture.settings.totalCoins, 100);
    assert.equal(fixture.audio.length, audioCountBeforeReconciliation);

    fixture.presenter.reconcileSelectionsForPersistence();
    assert.equal(fixture.settings.selectedBackground, 0);
    assert.equal(fixture.settings.selectedBlade, 0);
    assert.equal(fixture.settings.selectedTheme, 1);
    fixture.presenter.dispose();
  }

  {
    const fixture = createFixture();
    attachAndActivate(fixture);
    fixture.presenter.update(1.75);
    selectorButton(fixture.presenter, 'background', 'next').emit(
      cc.Node.EventType.TOUCH_END,
    );
    requireDescendant(
      fixture.presenter.root as unknown as StubNode,
      'background-buy-item',
    ).emit(cc.Node.EventType.TOUCH_END);
    selectorButton(fixture.presenter, 'blade', 'next').emit(
      cc.Node.EventType.TOUCH_END,
    );
    requireDescendant(
      fixture.presenter.root as unknown as StubNode,
      'blade-buy-item',
    ).emit(cc.Node.EventType.TOUCH_END);
    selectorButton(fixture.presenter, 'theme', 'next').emit(
      cc.Node.EventType.TOUCH_END,
    );

    fixture.presenter.reconcileSelectionsForPersistence();
    fixture.presenter.reconcileSelectionsForPersistence();

    assert.equal(fixture.settings.backgroundPrices[1], 0);
    assert.equal(fixture.settings.bladePrices[1], 0);
    assert.equal(fixture.settings.selectedBackground, 1);
    assert.equal(fixture.settings.selectedBlade, 1);
    assert.equal(fixture.settings.selectedTheme, 1);
    assert.equal(fixture.settings.totalCoins, 70);
    assert.equal(fixture.shared.background, 1);
    assert.equal(fixture.shared.theme, 1);
    assert.equal(fixture.presenter.state.model.selectedBackground, 1);
    assert.equal(fixture.presenter.state.model.selectedBlade, 1);
    assert.equal(fixture.presenter.state.model.selectedTheme, 1);
    fixture.presenter.dispose();
  }
});

test('failed persistence reconciliation is compensated and retryable without navigation', () => {
  let navigationCount = 0;
  const fixture = createFixture({
    lifecycle: {
      onMainMenuRequested() {
        navigationCount += 1;
        return false;
      },
    },
  });
  attachAndActivate(fixture);
  fixture.presenter.update(1.75);
  selectorButton(fixture.presenter, 'background', 'next').emit(
    cc.Node.EventType.TOUCH_END,
  );
  fixture.shared.failNextBackgroundSelection = true;

  assert.throws(
    () => fixture.presenter.reconcileSelectionsForPersistence(),
    /injected shared failure/,
  );
  assert.equal(navigationCount, 0);
  assert.equal(fixture.presenter.state.model.selectedBackground, 1);
  assert.equal(fixture.presenter.selectors.background.selectedIndex, 1);
  assert.equal(fixture.settings.selectedBackground, 1);
  assert.equal(fixture.shared.background, 1);

  fixture.presenter.reconcileSelectionsForPersistence();
  assert.equal(navigationCount, 0);
  assert.equal(fixture.presenter.state.model.selectedBackground, 0);
  assert.equal(fixture.presenter.selectors.background.selectedIndex, 0);
  assert.equal(fixture.settings.selectedBackground, 0);
  assert.equal(fixture.shared.background, 0);
  fixture.presenter.dispose();
});

test('activation and rearm remove every partially registered presenter listener', () => {
  {
    const fixture = createFixture();
    fixture.presenter.root.setParent(fixture.host as never, true);
    const back = requireDescendant(
      fixture.presenter.root as unknown as StubNode,
      'back-item',
    );
    cc.failNextListenerRegistration('back-item', cc.Node.EventType.TOUCH_END);
    assert.throws(
      () => fixture.presenter.activate(),
      /injected listener registration failure/,
    );
    assert.equal(fixture.presenter.state.activated, false);
    assert.equal(fixture.presenter.root.active, false);
    assert.equal(back.listenerCount(cc.Node.EventType.TOUCH_START), 0);
    assert.equal(back.listenerCount(cc.Node.EventType.TOUCH_END), 0);
    assert.equal(back.listenerCount(cc.Node.EventType.TOUCH_CANCEL), 0);
    assert.equal(cc.input.listenerCount(cc.Input.EventType.KEY_UP), 0);
    fixture.presenter.activate();
    assert.equal(back.listenerCount(cc.Node.EventType.TOUCH_END), 1);
    fixture.presenter.dispose();
  }

  {
    const fixture = createFixture();
    attachAndActivate(fixture);
    fixture.presenter.update(1.75);
    selectorButton(fixture.presenter, 'background', 'next').emit(
      cc.Node.EventType.TOUCH_END,
    );
    const back = requireDescendant(
      fixture.presenter.root as unknown as StubNode,
      'back-item',
    );
    const buy = requireDescendant(
      fixture.presenter.root as unknown as StubNode,
      'background-buy-item',
    );
    fixture.presenter.suspendForTransition();
    cc.failNextListenerRegistration(
      'background-buy-item',
      cc.Node.EventType.TOUCH_END,
    );
    assert.throws(
      () => fixture.presenter.rearmNavigationAfterFailure(),
      /injected listener registration failure/,
    );
    assert.equal(fixture.presenter.state.suspended, true);
    assert.equal(fixture.presenter.root.active, false);
    assert.equal(back.listenerCount(cc.Node.EventType.TOUCH_START), 0);
    assert.equal(back.listenerCount(cc.Node.EventType.TOUCH_END), 0);
    assert.equal(buy.listenerCount(cc.Node.EventType.TOUCH_START), 0);
    assert.equal(buy.listenerCount(cc.Node.EventType.TOUCH_END), 0);
    assert.equal(buy.listenerCount(cc.Node.EventType.TOUCH_CANCEL), 0);
    assert.equal(cc.input.listenerCount(cc.Input.EventType.KEY_UP), 0);
    assert.equal(fixture.presenter.rearmNavigationAfterFailure(), true);
    assert.equal(buy.listenerCount(cc.Node.EventType.TOUCH_END), 1);
    fixture.presenter.dispose();
  }
});

test('equality purchases debit once, hide Buy, update coins, and attach the exact burst', () => {
  const fixture = createFixture({ totalCoins: 10 });
  attachAndActivate(fixture);
  fixture.presenter.update(1.75);
  selectorButton(fixture.presenter, 'background', 'next').emit(
    cc.Node.EventType.TOUCH_END,
  );
  fixture.audio.length = 0;
  const buy = requireDescendant(
    fixture.presenter.root as unknown as StubNode,
    'background-buy-item',
  );
  buy.emit(cc.Node.EventType.TOUCH_END);

  assert.equal(fixture.settings.totalCoins, 0);
  assert.equal(fixture.settings.backgroundPrices[1], 0);
  assert.equal(labelOf(requireDescendant(
    fixture.presenter.root as unknown as StubNode,
    'total-coins-label',
  )).string, '0');
  assert.equal(requireDescendant(
    fixture.presenter.root as unknown as StubNode,
    'background-buy-menu',
  ).active, false);
  assert.equal(fixture.presenter.state.purchaseBurstCount, 1);
  const burst = requireDescendant(
    fixture.presenter.root as unknown as StubNode,
    'OptionsPurchaseParticleExplosion',
  );
  assert.deepEqual(burst.worldPosition, { x: 50, y: 150, z: 0 });

  const runtime = fixture.presenter as unknown as {
    readonly purchaseBursts: readonly Array<{
      readonly plan: Readonly<{ readonly startDelaySeconds: number }>;
    }>;
  };
  const startDelay = runtime.purchaseBursts[0]?.plan.startDelaySeconds;
  assert.equal(startDelay, Math.fround(0.05));
  fixture.presenter.update(startDelay);
  assert.equal(burst.children.length, 45);
  assert.equal(burst.children[0]?.name, 'OptionsPurchaseParticle-1');
  const removeAt = (runtime.purchaseBursts[0] as unknown as {
    readonly plan: Readonly<{ readonly removeAtSeconds: number }>;
  }).plan.removeAtSeconds;
  fixture.presenter.update(removeAt);
  assert.equal(fixture.presenter.state.purchaseBurstCount, 0);
  assert.equal(burst.destroyed, true);
  fixture.presenter.dispose();
});

test('failed burst attachment is disposed while the committed purchase remains reflected', () => {
  const fixture = createFixture({ totalCoins: 10 });
  attachAndActivate(fixture);
  fixture.presenter.update(1.75);
  selectorButton(fixture.presenter, 'background', 'next').emit(
    cc.Node.EventType.TOUCH_END,
  );
  cc.failNextSiblingIndex('OptionsPurchaseParticleExplosion');
  assert.throws(
    () => requireDescendant(
      fixture.presenter.root as unknown as StubNode,
      'background-buy-item',
    ).emit(cc.Node.EventType.TOUCH_END),
    /injected sibling-index failure/,
  );

  assert.equal(fixture.settings.totalCoins, 0);
  assert.equal(fixture.settings.backgroundPrices[1], 0);
  assert.equal(fixture.presenter.state.model.totalCoins, 0);
  assert.equal(fixture.presenter.state.model.backgroundPrices[1], 0);
  assert.equal(fixture.presenter.state.purchaseBurstCount, 0);
  assert.equal(findDescendant(
    fixture.presenter.root as unknown as StubNode,
    'OptionsPurchaseParticleExplosion',
  ), null);
  assert.equal(requireDescendant(
    fixture.presenter.root as unknown as StubNode,
    'background-buy-menu',
  ).active, false);
  fixture.presenter.dispose();
});

test('insufficient, already-owned, and failed-storage purchases never mutate UI or spawn', () => {
  {
    const fixture = createFixture({ totalCoins: 9 });
    attachAndActivate(fixture);
    fixture.presenter.update(1.75);
    selectorButton(fixture.presenter, 'blade', 'next').emit(cc.Node.EventType.TOUCH_END);
    const buyMenu = requireDescendant(
      fixture.presenter.root as unknown as StubNode,
      'blade-buy-menu',
    );
    const label = labelOf(requireDescendant(buyMenu, 'blade-price-label'));
    requireDescendant(buyMenu, 'blade-buy-item').emit(cc.Node.EventType.TOUCH_END);
    assert.equal(fixture.settings.totalCoins, 9);
    assert.equal(fixture.settings.bladePrices[1], 20);
    assert.equal(label.string, '20');
    assert.equal(buyMenu.active, true);
    assert.equal(fixture.presenter.state.purchaseBurstCount, 0);
    fixture.presenter.dispose();
  }

  {
    const fixture = createFixture();
    attachAndActivate(fixture);
    fixture.presenter.update(1.75);
    selectorButton(fixture.presenter, 'background', 'next').emit(
      cc.Node.EventType.TOUCH_END,
    );
    fixture.settings.backgroundPrices[1] = 0;
    const buyMenu = requireDescendant(
      fixture.presenter.root as unknown as StubNode,
      'background-buy-menu',
    );
    requireDescendant(buyMenu, 'background-buy-item').emit(cc.Node.EventType.TOUCH_END);
    assert.equal(fixture.settings.totalCoins, 100);
    assert.equal(buyMenu.active, true);
    assert.equal(labelOf(requireDescendant(
      buyMenu,
      'background-price-label',
    )).string, '10');
    assert.equal(fixture.presenter.state.purchaseBurstCount, 0);
    fixture.presenter.dispose();
  }

  {
    const fixture = createFixture();
    attachAndActivate(fixture);
    fixture.presenter.update(1.75);
    selectorButton(fixture.presenter, 'blade', 'next').emit(cc.Node.EventType.TOUCH_END);
    fixture.settings.failNextPurchase = true;
    const buyMenu = requireDescendant(
      fixture.presenter.root as unknown as StubNode,
      'blade-buy-menu',
    );
    assert.throws(
      () => requireDescendant(
        buyMenu,
        'blade-buy-item',
      ).emit(cc.Node.EventType.TOUCH_END),
      /injected storage failure/,
    );
    assert.equal(fixture.settings.totalCoins, 100);
    assert.equal(fixture.settings.bladePrices[1], 20);
    assert.equal(buyMenu.active, true);
    assert.equal(labelOf(requireDescendant(buyMenu, 'blade-price-label')).string, '20');
    assert.equal(fixture.presenter.state.purchaseBurstCount, 0);
    fixture.presenter.dispose();
  }
});

test('Back commits unowned rollback, retains theme, and rearms after false or throw', () => {
  for (const failure of ['false', 'throw'] as const) {
    let observed: unknown;
    let fixture: ReturnType<typeof createFixture>;
    const lifecycle = {
      onMainMenuRequested(transaction: unknown) {
        observed = transaction;
        assert.equal(fixture.presenter.suspendForTransition(), true);
        fixture.presenter.root.setParent(null, true);
        if (failure === 'throw') {
          throw new Error('injected Options route failure');
        }
        return false;
      },
    };
    fixture = createFixture({ lifecycle });
    attachAndActivate(fixture);
    fixture.presenter.update(1.75);
    selectorButton(fixture.presenter, 'background', 'next').emit(
      cc.Node.EventType.TOUCH_END,
    );
    selectorButton(fixture.presenter, 'blade', 'next').emit(cc.Node.EventType.TOUCH_END);
    selectorButton(fixture.presenter, 'theme', 'next').emit(cc.Node.EventType.TOUCH_END);
    fixture.audio.length = 0;
    const back = requireDescendant(
      fixture.presenter.root as unknown as StubNode,
      'back-item',
    );

    if (failure === 'throw') {
      assert.throws(
        () => back.emit(cc.Node.EventType.TOUCH_END),
        /injected Options route failure/,
      );
    } else {
      back.emit(cc.Node.EventType.TOUCH_END);
    }

    assert.deepEqual(observed, {
      destination: 'MainMenuLayer',
      root: fixture.presenter.root,
      timing: 'immediate',
      zOrder: 1,
    });
    assert.equal(fixture.settings.selectedBackground, 0);
    assert.equal(fixture.shared.background, 0);
    assert.equal(fixture.settings.selectedBlade, 0);
    assert.equal(fixture.settings.selectedTheme, 1);
    assert.equal(fixture.shared.theme, 1);
    assert.equal(fixture.presenter.state.model.selectedBackground, 0);
    assert.equal(fixture.presenter.state.model.selectedBlade, 0);
    assert.equal(fixture.presenter.state.model.selectedTheme, 1);
    assert.equal(fixture.presenter.state.suspended, false);
    assert.equal(fixture.presenter.state.navigationPending, false);
    assert.equal(fixture.presenter.root.parent, fixture.host);
    assert.equal(back.listenerCount(cc.Node.EventType.TOUCH_END), 1);
    assert.deepEqual(fixture.audio, ['Sounds/menubuttonclick.wav']);
    fixture.presenter.dispose();
  }
});

test('rejected Back restores the exact original foreground sibling index', () => {
  let fixture: ReturnType<typeof createFixture>;
  const lifecycle = {
    onMainMenuRequested() {
      fixture.presenter.suspendForTransition();
      fixture.presenter.root.setParent(null, true);
      return false;
    },
  };
  fixture = createFixture({ lifecycle });
  for (let index = 0; index < 3; index += 1) {
    const persistent = new cc.Node(`persistent-${index}`);
    persistent.setParent(fixture.host);
  }
  attachAndActivate(fixture);
  assert.equal(fixture.presenter.root.getSiblingIndex(), 3);

  requireDescendant(
    fixture.presenter.root as unknown as StubNode,
    'back-item',
  ).emit(cc.Node.EventType.TOUCH_END);

  assert.equal(fixture.presenter.root.parent, fixture.host);
  assert.equal(fixture.presenter.root.getSiblingIndex(), 3);
  assert.equal(fixture.presenter.state.suspended, false);
  fixture.presenter.dispose();
});

test('Back rollback compensates Settings, shared, and UI failures so a retry can commit', () => {
  for (const injectedFailure of ['settings', 'shared', 'ui'] as const) {
    let lifecycleCalls = 0;
    const fixture = createFixture({
      lifecycle: {
        onMainMenuRequested() {
          lifecycleCalls += 1;
          return false;
        },
      },
    });
    attachAndActivate(fixture);
    fixture.presenter.update(1.75);
    selectorButton(fixture.presenter, 'background', 'next').emit(
      cc.Node.EventType.TOUCH_END,
    );
    const back = requireDescendant(
      fixture.presenter.root as unknown as StubNode,
      'back-item',
    );

    if (injectedFailure === 'settings') {
      fixture.settings.failNextBackgroundSelection = true;
    } else if (injectedFailure === 'shared') {
      fixture.shared.failNextBackgroundSelection = true;
    } else {
      const runtime = fixture.presenter as unknown as {
        refreshPurchaseControl(category: 'background' | 'blade'): void;
      };
      const original = runtime.refreshPurchaseControl.bind(runtime);
      let failOnce = true;
      runtime.refreshPurchaseControl = (category): void => {
        if (category === 'background' && failOnce) {
          failOnce = false;
          throw new Error('injected Buy UI failure');
        }
        original(category);
      };
    }

    assert.throws(
      () => back.emit(cc.Node.EventType.TOUCH_END),
      /injected (?:Settings|shared|Buy UI) failure/,
    );
    assert.equal(lifecycleCalls, 0);
    assert.equal(fixture.presenter.state.model.selectedBackground, 1);
    assert.equal(fixture.presenter.selectors.background.selectedIndex, 1);
    assert.equal(fixture.settings.selectedBackground, 1);
    assert.equal(fixture.shared.background, 1);
    assert.equal(requireDescendant(
      fixture.presenter.root as unknown as StubNode,
      'background-buy-menu',
    ).active, true);

    back.emit(cc.Node.EventType.TOUCH_END);
    assert.equal(lifecycleCalls, 1);
    assert.equal(fixture.presenter.state.model.selectedBackground, 0);
    assert.equal(fixture.presenter.selectors.background.selectedIndex, 0);
    assert.equal(fixture.settings.selectedBackground, 0);
    assert.equal(fixture.shared.background, 0);
    fixture.presenter.dispose();
  }
});

test('a rejected transaction that cannot rearm is surfaced as recovery failure', () => {
  let fixture: ReturnType<typeof createFixture>;
  fixture = createFixture({
    lifecycle: {
      onMainMenuRequested() {
        fixture.presenter.suspendForTransition();
        fixture.presenter.root.destroy();
        return false;
      },
    },
  });
  attachAndActivate(fixture);
  const back = requireDescendant(
    fixture.presenter.root as unknown as StubNode,
    'back-item',
  );
  assert.throws(
    () => back.emit(cc.Node.EventType.TOUCH_END),
    /transaction recovery failed/,
  );
  assert.equal(fixture.presenter.state.suspended, true);
  assert.equal(fixture.presenter.dispose(), true);
});

test('saved shared background 8 stays live while local selector safely uses 0', () => {
  const fixture = createFixture({
    selectedBackground: 8,
    sharedBackground: 8,
  });
  attachAndActivate(fixture);
  assert.equal(fixture.presenter.state.backgroundSelectionOutsideOptions, true);
  assert.equal(fixture.presenter.state.model.selectedBackground, 0);
  assert.equal(fixture.presenter.selectors.background.selectedIndex, 0);
  assert.equal(fixture.settings.selectedBackground, 8);
  assert.equal(fixture.shared.background, 8);

  const back = requireDescendant(
    fixture.presenter.root as unknown as StubNode,
    'back-item',
  );
  back.emit(cc.Node.EventType.TOUCH_END);
  assert.equal(fixture.settings.selectedBackground, 8);
  assert.equal(fixture.shared.background, 8);
  assert.equal(fixture.presenter.state.backgroundSelectionOutsideOptions, true);

  fixture.presenter.update(1.25);
  selectorButton(fixture.presenter, 'background', 'next').emit(
    cc.Node.EventType.TOUCH_END,
  );
  assert.equal(fixture.settings.selectedBackground, 1);
  assert.equal(fixture.shared.background, 1);
  assert.equal(fixture.presenter.state.backgroundSelectionOutsideOptions, false);
  fixture.presenter.dispose();
});

test('MOBILE_BACK is active-only, effects-gated, and sends one exact transaction', () => {
  let calls = 0;
  const fixture = createFixture({
    effectsEnabled: false,
    lifecycle: {
      onMainMenuRequested() {
        calls += 1;
        return false;
      },
    },
  });
  cc.input.emit(cc.Input.EventType.KEY_UP, { keyCode: cc.KeyCode.MOBILE_BACK });
  assert.equal(calls, 0);
  attachAndActivate(fixture);
  fixture.presenter.update(1.75);
  assert.deepEqual(fixture.audio, []);
  cc.input.emit(cc.Input.EventType.KEY_UP, { keyCode: cc.KeyCode.MOBILE_BACK });
  assert.equal(calls, 1);
  assert.deepEqual(fixture.audio, []);
  fixture.presenter.suspendForTransition();
  cc.input.emit(cc.Input.EventType.KEY_UP, { keyCode: cc.KeyCode.MOBILE_BACK });
  assert.equal(calls, 1);
  fixture.presenter.dispose();
});

test('source preserves production boundaries and contains no native, ad, music-stop, or placeholder path', () => {
  assert.match(SOURCE, /createDetachedScreenRoot\('OptionsRoot', input\.canvas\)/);
  assert.match(SOURCE, /purchaseBackgroundWithCoins/);
  assert.match(SOURCE, /purchaseBladeWithCoins/);
  assert.match(SOURCE, /OptionsPurchaseParticlePresenter\.create/);
  assert.match(SOURCE, /prepareExitRollback\(\)/);
  assert.match(SOURCE, /onMainMenuRequested/);
  assert.match(SOURCE, /presentation\.audio\.rowReveal\[row\.kind\]/);
  assert.doesNotMatch(SOURCE, /gameplayselected/i);
  assert.doesNotMatch(SOURCE, /stopBackgroundMusic|stopAllEffects|stopMusic/);
  assert.doesNotMatch(SOURCE, /\b(?:JNI|JniHelper|libgame|APK|showInterstitial|ads?)\b/i);
  assert.doesNotMatch(SOURCE, /placeholder/i);
});

function createFixture(options: Readonly<{
  readonly effectsEnabled?: boolean;
  readonly lifecycle?: Readonly<{
    onMainMenuRequested(transaction: unknown): boolean | void;
  }>;
  readonly selectedBackground?: number;
  readonly sharedBackground?: number;
  readonly totalCoins?: number;
}> = {}) {
  const audio: string[] = [];
  const settings = settingsHarness({
    effectsEnabled: options.effectsEnabled,
    selectedBackground: options.selectedBackground,
    totalCoins: options.totalCoins,
  });
  const shared = sharedHarness({
    background: options.sharedBackground ?? options.selectedBackground,
  });
  const canvas = new cc.Node('Canvas');
  canvas.layer = 17;
  const presenter = OptionsPresenter.create({
    audio: {
      playOneShot(canonicalPath: string) {
        audio.push(canonicalPath);
      },
    },
    canvas: canvas as never,
    lifecycle: options.lifecycle ?? {
      onMainMenuRequested() { return false; },
    },
    random: {
      nextIntInclusive(minimum: number) {
        return minimum;
      },
    },
    resources: optionsResources(),
    settings: settings.port,
    sharedCosmetics: shared.port,
    viewport: viewport(),
  });
  const host = new cc.Node('SharedGameSceneRoot');
  host.layer = canvas.layer;
  return { audio, canvas, host, presenter, settings, shared };
}

function attachAndActivate(fixture: ReturnType<typeof createFixture>): void {
  fixture.presenter.root.setParent(fixture.host as never, true);
  fixture.presenter.activate();
}

function settingsHarness(options: Readonly<{
  readonly effectsEnabled?: boolean;
  readonly selectedBackground?: number;
  readonly totalCoins?: number;
}> = {}) {
  const data = {
    backgroundPrices: [0, 10, 30, 40, 50, 60, 70, 80],
    bladePrices: [0, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180],
    effectsEnabled: options.effectsEnabled ?? true,
    failNextBackgroundSelection: false,
    failNextPurchase: false,
    selectedBackground: options.selectedBackground ?? 0,
    selectedBlade: 0,
    selectedTheme: 0,
    totalCoins: options.totalCoins ?? 100,
  };
  const purchase = (
    prices: number[],
    index: number,
  ): Readonly<{
    readonly index: number;
    readonly kind: 'already-owned' | 'insufficient-coins' | 'purchased';
    readonly price: number;
    readonly totalCoins: number;
  }> => {
    const price = prices[index] ?? -1;
    if (price === 0) {
      return Object.freeze({ index, kind: 'already-owned' as const, price, totalCoins: data.totalCoins });
    }
    if (data.totalCoins < price) {
      return Object.freeze({ index, kind: 'insufficient-coins' as const, price, totalCoins: data.totalCoins });
    }
    if (data.failNextPurchase) {
      data.failNextPurchase = false;
      throw new Error('injected storage failure');
    }
    prices[index] = 0;
    data.totalCoins -= price;
    return Object.freeze({ index, kind: 'purchased' as const, price, totalCoins: data.totalCoins });
  };
  const port = {
    get state() {
      return {
        get backgroundPrices() { return Object.freeze([...data.backgroundPrices]); },
        get bladePrices() { return Object.freeze([...data.bladePrices]); },
        get snapshot() {
          return Object.freeze({
            effectsEnabled: data.effectsEnabled,
            selectedBackground: data.selectedBackground,
            selectedBlade: data.selectedBlade,
            selectedTheme: data.selectedTheme,
            totalCoins: data.totalCoins,
          });
        },
        setSelectedBackground(index: number) {
          if (data.failNextBackgroundSelection) {
            data.failNextBackgroundSelection = false;
            throw new Error('injected Settings failure');
          }
          data.selectedBackground = index;
        },
        setSelectedBlade(index: number) { data.selectedBlade = index; },
        setSelectedTheme(index: number) { data.selectedTheme = index; },
      };
    },
    purchaseBackgroundWithCoins(index: number) {
      return purchase(data.backgroundPrices, index);
    },
    purchaseBladeWithCoins(index: number) {
      return purchase(data.bladePrices, index);
    },
  };
  return Object.assign(data, { port });
}

function sharedHarness(options: Readonly<{
  readonly background?: number;
  readonly theme?: number;
}> = {}) {
  const data = {
    background: options.background ?? 0,
    failNextBackgroundSelection: false,
    theme: options.theme ?? 0,
  };
  const port = {
    get currentBackgroundIndex() { return data.background; },
    get currentThemeIndex() { return data.theme; },
    selectBackground(index: number) {
      if (data.failNextBackgroundSelection) {
        data.failNextBackgroundSelection = false;
        throw new Error('injected shared failure');
      }
      data.background = index;
    },
    selectTheme(index: number) { data.theme = index; },
  };
  return Object.assign(data, { port });
}

function optionsResources() {
  return Object.freeze({
    assetTree: '480x800' as const,
    font: Object.freeze({ canonicalPath: 'Fonts/SlabThing.ttf' }),
    rasterCount: 51 as const,
    raster(resource: Readonly<{
      readonly canonicalPath: string;
      readonly dimensions: Readonly<{ readonly height: number; readonly width: number }>;
    }>) {
      return Object.freeze({
        canonicalPath: resource.canonicalPath,
        dimensions: resource.dimensions,
        spriteFrame: Object.freeze({ canonicalPath: resource.canonicalPath }),
      });
    },
  });
}

function viewport() {
  return Object.freeze({
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
}

function selectorButton(
  presenter: InstanceType<typeof OptionsPresenter>,
  kind: 'background' | 'blade' | 'theme',
  direction: 'next' | 'previous',
): StubNode {
  return requireDescendant(
    presenter.selectors[kind].root as unknown as StubNode,
    direction,
  );
}

function requireDescendant(root: StubNode, name: string): StubNode {
  if (root.name === name) {
    return root;
  }
  for (const child of root.children) {
    const found = findDescendant(child, name);
    if (found !== null) {
      return found;
    }
  }
  assert.fail(`Missing descendant ${name}`);
}

function findDescendant(root: StubNode, name: string): StubNode | null {
  if (root.name === name) {
    return root;
  }
  for (const child of root.children) {
    const found = findDescendant(child, name);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

function labelOf(node: StubNode): StubLabel {
  const label = node.getComponent(cc.Label);
  assert.ok(label, `Missing Label on ${node.name}`);
  return label;
}

function opacityOf(node: StubNode): StubOpacity {
  const opacity = node.getComponent(cc.UIOpacity);
  assert.ok(opacity, `Missing UIOpacity on ${node.name}`);
  return opacity;
}

function moduleUrl(source: string): string {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
