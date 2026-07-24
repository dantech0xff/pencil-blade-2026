import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

const SOURCE = readFileSync(
  new URL(
    '../../../game/assets/scripts/creator/objectives-screen-presenter.ts',
    import.meta.url,
  ),
  'utf8',
);

const CC_STUB_URL = moduleUrl(`
let nextLabelStringFailure = null;
let nextWorldPositionFailure = null;
export function injectNextLabelStringFailure(error = new Error(
  'injected post-commit label refresh failure',
)) {
  nextLabelStringFailure = error;
}
export function injectNextWorldPositionFailure(error = new Error(
  'injected world-position projection failure',
)) {
  nextWorldPositionFailure = error;
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
  }
  resetListeners() { this.listeners.clear(); }
}
export class Color {
  constructor(r = 0, g = 0, b = 0, a = 255) {
    this.r = r; this.g = g; this.b = b; this.a = a;
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
  constructor() {
    this.color = null;
    this.font = null;
    this.fontSize = 0;
    this.lineHeight = 0;
    this.stringValue = '';
  }
  get string() { return this.stringValue; }
  set string(value) {
    if (nextLabelStringFailure !== null) {
      const error = nextLabelStringFailure;
      nextLabelStringFailure = null;
      throw error;
    }
    this.stringValue = value;
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
  }
  setWorldPosition(x, y, z = 0) {
    if (nextWorldPositionFailure !== null) {
      const error = nextWorldPositionFailure;
      nextWorldPositionFailure = null;
      throw error;
    }
    if (typeof x === 'object') {
      z = x.z; y = x.y; x = x.x;
    }
    if (this.parent === null) this.position = { x, y, z };
    else {
      const parent = this.parent.worldPosition;
      this.position = { x: x - parent.x, y: y - parent.y, z: z - parent.z };
    }
  }
  setWorldRotation(value) { this.rotation = { ...value }; }
  setWorldScale(value) { this.scale = { ...value }; }
}
export const input = new EventOwner();
export function isValid(value) {
  return value !== null && value !== undefined && value.destroyed !== true;
}
`);
const BLADE_INPUT_STUB_URL = moduleUrl(`
export const CLASSIC_BLADE_MOVED_EVENT = 'classic-blade-moved';
`);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') {
      return { shortCircuit: true, url: CC_STUB_URL };
    }
    if (specifier === './blade-input-controller') {
      return { shortCircuit: true, url: BLADE_INPUT_STUB_URL };
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

const Cocos = await import(CC_STUB_URL) as unknown as {
  readonly Color: new (...values: number[]) => {
    readonly a: number; readonly b: number; readonly g: number; readonly r: number;
  };
  readonly Input: { readonly EventType: { readonly KEY_UP: string } };
  readonly KeyCode: { readonly MOBILE_BACK: number };
  readonly Label: new () => {
    color: { readonly b: number; readonly g: number; readonly r: number };
    string: string;
  };
  readonly Node: typeof StubNode;
  readonly Sprite: new () => { spriteFrame: unknown };
  readonly UIOpacity: new () => { opacity: number };
  readonly injectNextLabelStringFailure: (error?: unknown) => void;
  readonly injectNextWorldPositionFailure: (error?: unknown) => void;
  readonly input: StubEventOwner;
};

interface StubEventOwner {
  emit(type: string, event?: unknown): void;
  listenerCount(type: string): number;
  resetListeners(): void;
}

interface StubNode extends StubEventOwner {
  active: boolean;
  readonly activeInHierarchy: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  eulerAngles: { x: number; y: number; z: number };
  layer: number;
  name: string;
  parent: StubNode | null;
  readonly worldPosition: { x: number; y: number; z: number };
  addComponent<T>(Type: new () => T): T;
  destroy(): void;
  getComponent<T>(Type: new () => T): T | null;
  getSiblingIndex(): number;
  setParent(parent: StubNode | null, keepWorldTransform?: boolean): void;
}

interface StubNodeConstructor {
  new (name?: string): StubNode;
  readonly EventType: {
    readonly TOUCH_CANCEL: string;
    readonly TOUCH_END: string;
    readonly TOUCH_START: string;
  };
}

const StubNode = Cocos.Node as unknown as StubNodeConstructor;
const {
  ObjectivesScreenCleanupError,
  ObjectivesScreenPostCommitRefreshError,
  ObjectivesScreenPresenter,
  ObjectivesScreenSkipOwnershipError,
} = await import(
  '../../../game/assets/scripts/creator/objectives-screen-presenter.ts'
);
const CLASSIC_BLADE_MOVED_EVENT = 'classic-blade-moved';
const {
  ObjectivesManagerState,
  objectiveDefinitionAt,
} = await import(
  '../../../game/assets/scripts/domain/objectives-manager-state.ts'
);
const {
  getObjectivesScreenRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/objectives-screen-resource-contract.ts'
);

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

test('constructs exact detached 57-child hierarchy and activates one cutting-disabled lease', () => {
  const harness = createHarness();
  const { presenter } = harness;
  assert.equal(presenter.root.parent, harness.host);
  assert.equal(presenter.root.active, false);
  assert.equal(presenter.root.children.length, 57);
  assert.deepEqual(
    presenter.root.children.map(({ name }) => name),
    [
      'background',
      ...Array.from({ length: 52 }, (_, index) => `objective-row-${index}`),
      'header',
      'footer',
      'fixed-current-item',
      'menu',
    ],
  );
  const row0 = requiredNode(presenter.root, 'objective-row-0');
  assert.deepEqual(row0.children.map(({ name }) => name), [
    'background',
    'description',
    'reward',
  ]);
  const menu = requiredNode(presenter.root, 'menu');
  assert.deepEqual(menu.children.map(({ name }) => name), ['back-item', 'skip-item']);
  assert.equal(presenter.presentation.clipping.mask, false);
  assert.equal(presenter.presentation.rows.length, 52);

  presenter.activate();
  assert.deepEqual(harness.bladeInput.calls, ['activate', 'cut:false']);
  assert.equal(harness.bladeInput.node.listenerCount(CLASSIC_BLADE_MOVED_EVENT), 1);
  assert.equal(presenter.state.activated, true);
  assert.equal(Object.isFrozen(presenter.state), true);
  assert.equal(presenter.root.active, true);

  const fixed = requiredNode(presenter.root, 'fixed-current-item');
  assert.equal(
    spritePath(requiredNode(fixed, 'background')),
    '480x800/Objectives/objectives-next.png',
  );
});

test('entry fades only fixed sprites and moves Back/Skip to exact one-second targets', () => {
  const { presenter } = createHarness();
  presenter.activate();
  presenter.update(0.5);
  for (const name of ['background', 'header', 'footer']) {
    assert.equal(
      requiredNode(presenter.root, name).getComponent(Cocos.UIOpacity)?.opacity,
      127.5,
    );
  }
  const menu = requiredNode(presenter.root, 'menu');
  const back = requiredNode(menu, 'back-item');
  const skip = requiredNode(menu, 'skip-item');
  assert.equal(back.eulerAngles.z, 180);
  assert.equal(
    back.worldPosition.x,
    midpoint(
      presenter.presentation.menu.back.initialPosition.x,
      presenter.presentation.menu.back.finalPosition.x,
    ),
  );
  assert.equal(
    skip.worldPosition.x,
    midpoint(
      presenter.presentation.menu.skip.initialPosition.x,
      presenter.presentation.menu.skip.finalPosition.x,
    ),
  );
  presenter.update(0.5);
  assert.deepEqual(back.worldPosition, {
    ...presenter.presentation.menu.back.finalPosition,
    z: 0,
  });
  assert.deepEqual(skip.worldPosition, {
    ...presenter.presentation.menu.skip.finalPosition,
    z: 0,
  });
});

test('direct BladeInput movement delegates -deltaY and moves only 52 ordinary row roots', () => {
  const { presenter, bladeInput } = createHarness();
  presenter.activate();
  const rows = Array.from(
    { length: 52 },
    (_, index) => requiredNode(presenter.root, `objective-row-${index}`),
  );
  const beforeRows = rows.map(({ worldPosition }) => ({ ...worldPosition }));
  const fixedBefore = { ...requiredNode(presenter.root, 'fixed-current-item').worldPosition };
  const headerBefore = { ...requiredNode(presenter.root, 'header').worldPosition };
  bladeInput.node.emit(CLASSIC_BLADE_MOVED_EVENT, {
    segment: {
      current: { x: 90, y: -20 },
      previous: { x: 10, y: 0 },
    },
  });
  rows.forEach((row, index) => {
    assert.equal(row.worldPosition.x, beforeRows[index]?.x);
    assert.equal(row.worldPosition.y, (beforeRows[index]?.y ?? 0) + 20);
  });
  assert.deepEqual(
    requiredNode(presenter.root, 'fixed-current-item').worldPosition,
    fixedBefore,
  );
  assert.deepEqual(requiredNode(presenter.root, 'header').worldPosition, headerBefore);
  assert.equal(presenter.state.model.rows[0]?.y, beforeRows[0]?.y + 20);
});

test('row projection failure transfers original fatal ownership after local teardown', () => {
  const rowProjectionFailure = new Error('row projection failed');
  const harness = createHarness();
  harness.presenter.activate();
  Cocos.injectNextWorldPositionFailure(rowProjectionFailure);

  assert.throws(
    () => harness.bladeInput.node.emit(CLASSIC_BLADE_MOVED_EVENT, {
      segment: {
        current: { x: 90, y: -20 },
        previous: { x: 10, y: 0 },
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof ObjectivesScreenCleanupError);
      assert.equal(error.causes[0], rowProjectionFailure);
      return true;
    },
  );
  assert.deepEqual(harness.fatalOwnershipErrors, [rowProjectionFailure]);
  assert.deepEqual(harness.fatalOwnershipObservations, [{
    bladeMoveListeners: 0,
    inputCalls: ['activate', 'cut:false', 'cut:false', 'deactivate'],
    rootActive: false,
  }]);
  assert.equal(harness.presenter.state.fatalOwnership, true);
  assert.equal(harness.presenter.root.active, false);
});

test('Skip clicks before mutation, targets active objective, and refreshes only target background plus fixed text', () => {
  const harness = createHarness();
  const { presenter } = harness;
  presenter.activate();
  const row0 = requiredNode(presenter.root, 'objective-row-0');
  const row1 = requiredNode(presenter.root, 'objective-row-1');
  const row0Description = requiredLabel(row0, 'description');
  assert.deepEqual(
    colorTuple(row0Description.color),
    [179, 179, 179],
  );
  const row1PathBefore = spritePath(requiredNode(row1, 'background'));
  const skip = requiredNode(requiredNode(presenter.root, 'menu'), 'skip-item');
  skip.emit(StubNode.EventType.TOUCH_END);

  assert.ok(harness.events.indexOf('effects') < harness.events.indexOf('audio'));
  assert.ok(harness.events.indexOf('audio') < harness.events.indexOf('write:0:-2'));
  assert.ok(harness.events.indexOf('write:0:-2') < harness.events.indexOf('popup'));
  assert.equal(harness.manager.activeObjective()?.id, 27);
  assert.equal(
    spritePath(requiredNode(row0, 'background')),
    '480x800/Objectives/objectives-active.png',
  );
  assert.equal(spritePath(requiredNode(row1, 'background')), row1PathBefore);
  assert.deepEqual(colorTuple(row0Description.color), [179, 179, 179]);
  const fixed = requiredNode(presenter.root, 'fixed-current-item');
  assert.equal(
    requiredLabel(fixed, 'description').string,
    objectiveDefinitionAt(1)?.description,
  );
  assert.equal(
    requiredLabel(fixed, 'reward').string,
    `reward: ${objectiveDefinitionAt(1)?.rewardCoins} coins`,
  );
  assert.equal(
    spritePath(requiredNode(fixed, 'background')),
    '480x800/Objectives/objectives-next.png',
  );
  assert.equal(presenter.presentation.fixedCurrent.objective.id, 27);
  assert.equal(findDescendant(presenter.root, 'ObjectiveAchievementCompleted'), null);
});

test('terminal Skip resets without popup, refreshes row zero only, and leaves other presented rows stale', () => {
  const finished = Array.from({ length: 51 }, (_, index) => index);
  const harness = createHarness({ currentObjective: 51, finishedPositions: finished });
  const { presenter } = harness;
  presenter.activate();
  const row0 = requiredNode(presenter.root, 'objective-row-0');
  const row1 = requiredNode(presenter.root, 'objective-row-1');
  assert.match(spritePath(requiredNode(row0, 'background')), /objectives-active/);
  assert.match(spritePath(requiredNode(row1, 'background')), /objectives-active/);
  const popupCountBefore = harness.events.filter((event) => event === 'popup').length;
  requiredNode(requiredNode(presenter.root, 'menu'), 'skip-item')
    .emit(StubNode.EventType.TOUCH_END);

  assert.equal(harness.manager.activeObjective()?.id, 0);
  assert.equal(
    harness.events.filter((event) => event === 'popup').length,
    popupCountBefore,
  );
  assert.match(spritePath(requiredNode(row0, 'background')), /objectives-inactive/);
  assert.match(spritePath(requiredNode(row1, 'background')), /objectives-active/);
  assert.equal(presenter.state.model.rows[1]?.finished, false);
  assert.equal(
    requiredLabel(
      requiredNode(presenter.root, 'fixed-current-item'),
      'description',
    ).string,
    objectiveDefinitionAt(0)?.description,
  );
});

test('visible Back clicks before an exact immediate transaction while hardware Back is silent', () => {
  const harness = createHarness({ navigationResult: false });
  const { presenter } = harness;
  presenter.activate();
  const back = requiredNode(requiredNode(presenter.root, 'menu'), 'back-item');
  back.emit(StubNode.EventType.TOUCH_END);
  assert.deepEqual(harness.events.slice(-3), ['effects', 'audio', 'navigation']);
  assert.equal(harness.transactions.length, 1);
  assert.deepEqual(harness.transactions[0], {
    destination: 'MainMenuLayer',
    root: presenter.root,
    timing: 'immediate',
    zOrder: 1,
  });
  assert.equal(Object.isFrozen(harness.transactions[0]), true);
  assert.equal(presenter.state.navigationPending, false);

  const audioBeforeHardware = harness.events.filter((event) => event === 'audio').length;
  Cocos.input.emit(Cocos.Input.EventType.KEY_UP, {
    keyCode: Cocos.KeyCode.MOBILE_BACK,
  });
  assert.equal(harness.transactions.length, 2);
  assert.equal(
    harness.events.filter((event) => event === 'audio').length,
    audioBeforeHardware,
  );
});

test('preflight failure prevents mutation; post-commit refresh failure poisons ownership without rollback', () => {
  const preflight = createHarness();
  preflight.presenter.activate();
  requiredNode(
    requiredNode(preflight.presenter.root, 'objective-row-8'),
    'description',
  ).destroy();
  assert.throws(
    () => requiredNode(requiredNode(preflight.presenter.root, 'menu'), 'skip-item')
      .emit(StubNode.EventType.TOUCH_END),
    /item objective-row-8 is invalid/,
  );
  assert.equal(preflight.manager.activeObjective()?.id, 0);
  assert.equal(preflight.events.some((event) => event.startsWith('write:')), false);
  assert.equal(preflight.presenter.state.fatalOwnership, false);
  assert.equal(preflight.fatalOwnershipErrors.length, 0);
  assert.equal(preflight.presenter.root.active, true);
  assert.equal(
    preflight.bladeInput.node.listenerCount(CLASSIC_BLADE_MOVED_EVENT),
    1,
  );

  const committed = createHarness();
  committed.presenter.activate();
  const presentationFailure = new Error(
    'injected post-commit label refresh failure',
  );
  Cocos.injectNextLabelStringFailure(presentationFailure);
  assert.throws(
    () => requiredNode(requiredNode(committed.presenter.root, 'menu'), 'skip-item')
      .emit(StubNode.EventType.TOUCH_END),
    (error: unknown) => {
      assert.ok(error instanceof ObjectivesScreenPostCommitRefreshError);
      assert.equal(error.cause, presentationFailure);
      return true;
    },
  );
  assert.equal(committed.manager.activeObjective()?.id, 27);
  assert.equal(committed.preferences.get(0), -2);
  assert.equal(committed.presenter.state.fatalOwnership, true);
  assert.equal(committed.presenter.state.poisoned, true);
  assert.equal(committed.presenter.state.suspended, true);
  assert.equal(committed.presenter.root.active, false);
  assert.ok(committed.bladeInput.calls.includes('deactivate'));
  assert.deepEqual(committed.fatalOwnershipErrors, [presentationFailure]);
  assert.deepEqual(committed.fatalOwnershipObservations, [{
    bladeMoveListeners: 0,
    inputCalls: ['activate', 'cut:false', 'cut:false', 'deactivate'],
    rootActive: false,
  }]);
  assert.throws(
    () => committed.presenter.rearmNavigationAfterFailure(),
    /cannot rearm/,
  );
});

test('commit-uncertain manager failure transfers original ownership once and never replays Skip', () => {
  const managerFailure = new Error('manager popup observer failed after commit');
  const fatalCallbackFailure = new Error('shell fatal observer failed');
  const harness = createHarness({
    achievementError: managerFailure,
    fatalOwnershipCallbackError: fatalCallbackFailure,
  });
  harness.presenter.activate();
  const skip = requiredNode(
    requiredNode(harness.presenter.root, 'menu'),
    'skip-item',
  );

  assert.throws(
    () => skip.emit(StubNode.EventType.TOUCH_END),
    (error: unknown) => {
      assert.ok(error instanceof ObjectivesScreenSkipOwnershipError);
      assert.equal(error.cause, managerFailure);
      assert.deepEqual(error.cleanupFailures, [fatalCallbackFailure]);
      return true;
    },
  );
  assert.equal(harness.preferences.get(0), -2);
  assert.equal(harness.manager.activeObjective()?.id, 27);
  assert.deepEqual(harness.fatalOwnershipErrors, [managerFailure]);
  assert.deepEqual(harness.fatalOwnershipObservations, [{
    bladeMoveListeners: 0,
    inputCalls: ['activate', 'cut:false', 'cut:false', 'deactivate'],
    rootActive: false,
  }]);

  const writesAfterCommit = harness.events.filter(
    (event) => event.startsWith('write:'),
  );
  skip.emit(StubNode.EventType.TOUCH_END);
  assert.throws(
    () => harness.presenter.rearmNavigationAfterFailure(),
    /cannot rearm/,
  );
  assert.equal(harness.presenter.dispose(), true);
  assert.equal(harness.presenter.dispose(), false);
  assert.deepEqual(
    harness.events.filter((event) => event.startsWith('write:')),
    writesAfterCommit,
  );
  assert.deepEqual(harness.fatalOwnershipErrors, [managerFailure]);
});

test('ordinary precommit audio failure remains active, retryable, and outside fatal ownership', () => {
  const audioFailure = new Error('menu click audio failed');
  const harness = createHarness({ audioError: audioFailure });
  harness.presenter.activate();
  const skip = requiredNode(
    requiredNode(harness.presenter.root, 'menu'),
    'skip-item',
  );

  assert.throws(
    () => skip.emit(StubNode.EventType.TOUCH_END),
    (error: unknown) => error === audioFailure,
  );
  assert.equal(harness.manager.activeObjective()?.id, 0);
  assert.equal(harness.preferences.has(0), false);
  assert.equal(harness.presenter.state.fatalOwnership, false);
  assert.equal(harness.presenter.state.skipPending, false);
  assert.equal(harness.presenter.root.active, true);
  assert.equal(
    harness.bladeInput.node.listenerCount(CLASSIC_BLADE_MOVED_EVENT),
    1,
  );
  assert.equal(harness.fatalOwnershipErrors.length, 0);

  skip.emit(StubNode.EventType.TOUCH_END);
  assert.equal(harness.manager.activeObjective()?.id, 27);
  assert.equal(harness.preferences.get(0), -2);
  assert.equal(harness.fatalOwnershipErrors.length, 0);
});

test('suspend, rearm, and disposal release/reacquire listeners and the shared lease safely', () => {
  const { presenter, bladeInput } = createHarness();
  presenter.activate();
  assert.equal(presenter.suspendForTransition(), true);
  assert.equal(presenter.suspendForTransition(), false);
  assert.equal(bladeInput.node.listenerCount(CLASSIC_BLADE_MOVED_EVENT), 0);
  assert.equal(Cocos.input.listenerCount(Cocos.Input.EventType.KEY_UP), 0);
  assert.equal(presenter.rearmNavigationAfterFailure(), true);
  assert.equal(bladeInput.node.listenerCount(CLASSIC_BLADE_MOVED_EVENT), 1);
  assert.deepEqual(bladeInput.calls, [
    'activate',
    'cut:false',
    'cut:false',
    'deactivate',
    'activate',
    'cut:false',
  ]);
  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
  assert.equal(presenter.root.destroyed, true);
  assert.equal(bladeInput.node.listenerCount(CLASSIC_BLADE_MOVED_EVENT), 0);
});

test('source owns no popup, clipping, raycast, blade rendering, inertia, snap, or broad row repaint', () => {
  assert.match(SOURCE, /CLASSIC_BLADE_MOVED_EVENT/);
  assert.doesNotMatch(SOURCE, /CLASSIC_BLADE_BEGAN_EVENT|CLASSIC_BLADE_ENDED_EVENT/);
  assert.doesNotMatch(
    SOURCE,
    /ObjectiveAchievementPresenter|\bMask\b|ScrollView|PhysicsSystem|raycast|drawBlade|\binertia\b|\bsnap\b/,
  );
  assert.ok(
    SOURCE.includes('targetRowIndex = nextPosition === 0 ? 0 : nextPosition - 1'),
  );
  assert.ok(SOURCE.includes('for (const row of this.graph.rows)'));
  assert.equal(SOURCE.includes('for (const row of refreshed.rows)'), false);
});

interface HarnessOptions {
  readonly achievementError?: unknown;
  readonly audioError?: unknown;
  readonly currentObjective?: number;
  readonly effectsEnabled?: boolean;
  readonly fatalOwnershipCallbackError?: unknown;
  readonly finishedPositions?: readonly number[];
  readonly navigationResult?: boolean;
}

function createHarness(options: HarnessOptions = {}) {
  Cocos.input.resetListeners();
  const events: string[] = [];
  let audioErrorPending = options.audioError;
  const current = options.currentObjective ?? 0;
  const settingsState = {
    currentObjective: current,
    fruitsCut: 0,
    totalCoins: 0,
  };
  const settings = {
    get snapshot() {
      return Object.freeze({ ...settingsState });
    },
    addObjectiveRewardCoins(rewardCoins: number) {
      const previousTotalCoins = settingsState.totalCoins;
      settingsState.totalCoins = (previousTotalCoins + rewardCoins) | 0;
      return Object.freeze({
        delta: rewardCoins,
        nextTotalCoins: settingsState.totalCoins,
        previousTotalCoins,
      });
    },
    setCurrentObjective(value: number) {
      settingsState.currentObjective = value;
      events.push(`current:${value}`);
    },
    setFruitsCut(value: number) {
      settingsState.fruitsCut = value;
      events.push(`fruits:${value}`);
    },
  };
  const preferences = new Map<number, number>();
  for (const sequencePosition of options.finishedPositions ?? []) {
    const objective = objectiveDefinitionAt(sequencePosition);
    if (objective !== null) {
      preferences.set(objective.id, -2);
    }
  }
  const preferencePort = {
    readInt32(key: string, defaultValue: number) {
      const id = Number(key.slice('objectives_value_'.length));
      return preferences.get(id) ?? defaultValue;
    },
    writeInt32(key: string, value: number) {
      const id = Number(key.slice('objectives_value_'.length));
      preferences.set(id, value);
      events.push(`write:${id}:${value}`);
    },
  };
  const manager = new ObjectivesManagerState(
    settings,
    preferencePort,
    () => {
      events.push('popup');
      if (options.achievementError !== undefined) {
        throw options.achievementError;
      }
    },
  );
  const canvas = new StubNode('Canvas');
  canvas.layer = 17;
  const host = new StubNode('Foreground');
  host.setParent(canvas);
  const inputNode = new StubNode('BladeInput');
  const bladeInput = {
    calls: [] as string[],
    node: inputNode,
    activateForClassicLayer() {
      this.calls.push('activate');
    },
    deactivateForNonClassicScreen() {
      this.calls.push('deactivate');
    },
    setCutEnabled(enabled: boolean) {
      this.calls.push(`cut:${String(enabled)}`);
    },
  };
  const profile = getObjectivesScreenRasterResources('480x800');
  const loadedByPath = new Map<string, {
    readonly canonicalPath: string;
    readonly dimensions: Readonly<{ readonly height: number; readonly width: number }>;
    readonly spriteFrame: Readonly<{ readonly canonicalPath: string }>;
  }>();
  for (const resource of [
    profile.skip.selected,
    profile.skip.normal,
    profile.ordinaryRows.finished,
    profile.background,
    profile.ordinaryRows.unfinished,
    profile.footer,
    profile.fixedCurrentRow,
    profile.header,
    profile.back.normal,
    profile.back.selected,
  ]) {
    loadedByPath.set(resource.canonicalPath, Object.freeze({
      canonicalPath: resource.canonicalPath,
      dimensions: resource.dimensions,
      spriteFrame: Object.freeze({ canonicalPath: resource.canonicalPath }),
    }));
  }
  const resources = Object.freeze({
    arialFont: Object.freeze({
      canonicalPath: 'Fonts/Arial.ttf' as const,
      font: Object.freeze({ name: 'Arial' }),
    }),
    assetTree: '480x800' as const,
    rasterCount: 10 as const,
    raster(resource: { readonly canonicalPath: string }) {
      const loaded = loadedByPath.get(resource.canonicalPath);
      if (loaded === undefined) {
        throw new Error(`missing ${resource.canonicalPath}`);
      }
      return loaded;
    },
  });
  const transactions: unknown[] = [];
  const fatalOwnershipErrors: unknown[] = [];
  const fatalOwnershipObservations: Array<Readonly<{
    readonly bladeMoveListeners: number;
    readonly inputCalls: readonly string[];
    readonly rootActive: boolean;
  }>> = [];
  let presenterReference: Readonly<{ readonly root: StubNode }> | null = null;
  const presenter = ObjectivesScreenPresenter.create({
    audio: {
      playOneShot(path: string) {
        assert.equal(path, 'Sounds/menubuttonclick.wav');
        events.push('audio');
        if (audioErrorPending !== undefined) {
          const error = audioErrorPending;
          audioErrorPending = undefined;
          throw error;
        }
      },
    },
    bladeInput: bladeInput as never,
    canvas: canvas as never,
    lifecycle: {
      onFatalOwnership(error) {
        fatalOwnershipErrors.push(error);
        fatalOwnershipObservations.push(Object.freeze({
          bladeMoveListeners:
            bladeInput.node.listenerCount(CLASSIC_BLADE_MOVED_EVENT),
          inputCalls: Object.freeze([...bladeInput.calls]),
          rootActive: presenterReference?.root.active ?? true,
        }));
        if (options.fatalOwnershipCallbackError !== undefined) {
          throw options.fatalOwnershipCallbackError;
        }
      },
      onMainMenuRequested(transaction) {
        events.push('navigation');
        transactions.push(transaction);
        return options.navigationResult ?? true;
      },
    },
    manager,
    resources: resources as never,
    settings: {
      effectsEnabled() {
        events.push('effects');
        return options.effectsEnabled ?? true;
      },
    },
    viewport: VIEWPORT,
  });
  presenterReference = presenter as unknown as Readonly<{
    readonly root: StubNode;
  }>;
  presenter.root.setParent(host as never, true);
  return {
    bladeInput,
    events,
    fatalOwnershipErrors,
    fatalOwnershipObservations,
    host,
    manager,
    preferences,
    presenter,
    transactions,
  };
}

function requiredNode(root: unknown, name: string): StubNode {
  const found = findDescendant(root as StubNode, name);
  assert.ok(found, `${name} must exist`);
  return found;
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

function requiredLabel(root: StubNode, name: string) {
  const node = requiredNode(root, name);
  const label = node.getComponent(Cocos.Label);
  assert.ok(label, `${name} Label must exist`);
  return label;
}

function spritePath(root: StubNode): string {
  const sprite = root.getComponent(Cocos.Sprite);
  assert.ok(sprite, `${root.name} Sprite must exist`);
  return (sprite.spriteFrame as { readonly canonicalPath: string }).canonicalPath;
}

function colorTuple(color: { readonly b: number; readonly g: number; readonly r: number }) {
  return [color.r, color.g, color.b];
}

function midpoint(start: number, end: number): number {
  return Math.fround(
    Math.fround(start)
    + Math.fround(Math.fround(end - start) * Math.fround(0.5)),
  );
}

function moduleUrl(source: string): string {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
