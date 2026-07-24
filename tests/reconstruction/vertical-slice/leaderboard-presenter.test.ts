import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const SOURCE = readFileSync(
  new URL(
    '../../../game/assets/scripts/creator/leaderboard-presenter.ts',
    import.meta.url,
  ),
  'utf8',
);

const CC_STUB_URL = moduleUrl(`
let listenerOnFailure = null;
let listenerOffFailure = null;
let destroyFailureName = null;
export function failNextListenerRegistration(ownerName, type) {
  listenerOnFailure = { ownerName, type };
}
export function failNextListenerRemoval(ownerName, type) {
  listenerOffFailure = { ownerName, type };
}
export function failNextDestroy(name) { destroyFailureName = name; }
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
    this.string = '';
  }
}
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
    nodeConstructions.push(this);
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
export function resetTestState() {
  listenerOnFailure = null;
  listenerOffFailure = null;
  destroyFailureName = null;
  input.resetListeners();
  nodeConstructions.length = 0;
}
`);

const BLADE_INPUT_STUB_URL = moduleUrl(`
export const CLASSIC_BLADE_BEGAN_EVENT = 'classic-blade-began';
export const CLASSIC_BLADE_MOVED_EVENT = 'classic-blade-moved';
export const CLASSIC_BLADE_ENDED_EVENT = 'classic-blade-ended';
`);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') {
      return { shortCircuit: true, url: CC_STUB_URL };
    }
    if (specifier.includes('blade-input-controller')) {
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

const cc = await import('cc') as unknown as {
  failNextDestroy(name: string): void;
  failNextListenerRegistration(ownerName: string, type: string): void;
  failNextListenerRemoval(ownerName: string, type: string): void;
  readonly Input: Readonly<{
    readonly EventType: Readonly<{ readonly KEY_UP: string }>;
  }>;
  readonly KeyCode: Readonly<{ readonly MOBILE_BACK: number }>;
  readonly Label: new () => StubLabel;
  readonly Node: typeof StubNode;
  readonly Sprite: new () => StubSprite;
  readonly UITransform: new () => StubTransform;
  readonly input: StubEventOwner;
  readonly nodeConstructions: StubNode[];
  resetTestState(): void;
};

const {
  LeaderboardCleanupError,
  LeaderboardPostCommitAudioError,
  LeaderboardPostCommitSettingsError,
  LeaderboardPresenter,
} = await import(
  '../../../game/assets/scripts/creator/leaderboard-presenter.ts'
);
const {
  CLASSIC_BLADE_BEGAN_EVENT,
  CLASSIC_BLADE_ENDED_EVENT,
  CLASSIC_BLADE_MOVED_EVENT,
} = await import(
  '../../../game/assets/scripts/creator/blade-input-controller.ts'
);
const {
  getLeaderboardRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/leaderboard-resource-contract.ts'
);

interface StubEventOwner {
  emit(type: string, event?: unknown): void;
  listenerCount(type: string): number;
}

interface StubLabel {
  color: Readonly<{ readonly a: number; readonly b: number; readonly g: number; readonly r: number }>;
  font: unknown;
  fontSize: number;
  lineHeight: number;
  string: string;
}

interface StubSprite {
  spriteFrame: Readonly<{ readonly canonicalPath: string }> | null;
}

interface StubTransform {
  anchorPoint: Readonly<{ readonly x: number; readonly y: number }>;
  contentSize: Readonly<{ readonly height: number; readonly width: number }>;
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
  readonly eulerAngles = { x: 0, y: 0, z: 0 };
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

interface ScoreBoard {
  first: number;
  second: number;
  third: number;
}

interface BladeHarness {
  calls: string[];
  failActivate: boolean;
  failDeactivate: boolean;
  failSetCut: boolean;
  readonly node: StubNode;
  readonly port: {
    readonly node: StubNode;
    activateForClassicLayer(): void;
    deactivateForNonClassicScreen(): void;
    setCutEnabled(enabled: boolean): void;
  };
}

interface Fixture {
  readonly audioCalls: string[];
  readonly blade: BladeHarness;
  readonly canvas: StubNode;
  readonly host: StubNode;
  lifecycle(transaction: unknown): boolean | void;
  readonly order: string[];
  readonly presenter: InstanceType<typeof LeaderboardPresenter>;
  readonly settings: ReturnType<typeof createSettings>;
}

test('constructs the exact detached title, Back, six-card hierarchy, fonts, and resources', () => {
  const fixture = createFixture({ assetTree: '720x1280' });
  const { presenter } = fixture;

  assert.equal(presenter.root.parent, null);
  assert.equal(presenter.root.active, false);
  assert.equal(presenter.state.activated, false);
  assert.equal(Object.isFrozen(presenter.state), true);
  assert.equal(Object.isFrozen(presenter.presentation), true);
  assert.deepEqual(
    (presenter.root as unknown as StubNode).children.map(({ name }) => name),
    [
      'gestures-layer',
      'title',
      'back-menu',
      'classic-card',
      'crazy-card',
      'gn-style-card',
      'classic-bird-card',
      'crazy-bird-card',
      'combo-bird-card',
    ],
  );
  assert.deepEqual(fixture.blade.calls, []);

  const title = requireDescendant(presenter.root as unknown as StubNode, 'title');
  assert.equal(
    spriteOf(title).spriteFrame?.canonicalPath,
    '720x1280/Leaderboard/leaderboard_title.png',
  );
  assert.deepEqual(
    transformOf(title).contentSize,
    { width: 793, height: 159 },
  );
  assert.deepEqual(transformOf(title).anchorPoint, { x: 0.5, y: 1 });

  const back = requireDescendant(presenter.root as unknown as StubNode, 'back-item');
  assert.equal(
    spriteOf(back).spriteFrame?.canonicalPath,
    '720x1280/Buttons/button-blue-back-normal.png',
  );
  assert.deepEqual(transformOf(back).contentSize, { width: 180, height: 150 });

  for (const card of (presenter.root as unknown as StubNode).children.slice(3)) {
    assert.deepEqual(card.children.map(({ name }) => name), ['template', 'header']);
    const template = requireChild(card, 'template');
    assert.deepEqual(
      template.children.map(({ name }) => name),
      ['player-1', 'player-2', 'player-3', 'score-1', 'score-2', 'score-3'],
    );
    assert.deepEqual(
      template.children.slice(0, 3).map((node) => labelOf(node).string),
      ['Player 1', 'Player 2', 'Player 3'],
    );
    assert.equal(labelOf(template.children[0]!).font, fixtureResources.playerFont);
    assert.equal(labelOf(template.children[3]!).font, fixtureResources.scoreFont);
    assert.deepEqual({ ...labelOf(template.children[0]!).color }, {
      r: 255, g: 0, b: 0, a: 255,
    });
    assert.deepEqual({ ...labelOf(template.children[3]!).color }, {
      r: 128, g: 0, b: 0, a: 255,
    });
  }

  const classicTemplate = requireDescendant(
    presenter.root as unknown as StubNode,
    'classic-card',
  ).children[0]!;
  assert.deepEqual(
    classicTemplate.children.slice(3).map((node) => labelOf(node).string),
    ['103', '102', '101'],
  );
  assert.deepEqual(
    presenter.state.model.itemXs,
    (presenter.root as unknown as StubNode).children
      .slice(3)
      .map(({ worldPosition }) => worldPosition.x),
  );
});

test('matches Creator label line heights to both profile point-size contracts', () => {
  for (const [assetTree, playerSize, scoreSize, localX, localYs] of [
    [
      '480x800',
      30,
      40,
      -27,
      [205.10000610351562, 29.300018310546875, -131.84999084472656],
    ],
    [
      '720x1280',
      45,
      60,
      -38.6500244140625,
      [295.4000244140625, 42.20001220703125, -189.89999389648438],
    ],
  ] as const) {
    const fixture = createFixture({ assetTree });
    const template = requireDescendant(
      fixture.presenter.root as unknown as StubNode,
      'classic-card',
    ).children[0]!;
    const playerNodes = template.children.slice(0, 3);
    const scoreNodes = template.children.slice(3);
    const playerLabels = playerNodes.map(labelOf);
    const scoreLabels = scoreNodes.map(labelOf);

    assert.deepEqual(
      playerLabels.map(({ fontSize, lineHeight }) => ({ fontSize, lineHeight })),
      Array.from({ length: 3 }, () => ({ fontSize: playerSize, lineHeight: playerSize })),
    );
    assert.deepEqual(
      scoreLabels.map(({ fontSize, lineHeight }) => ({ fontSize, lineHeight })),
      Array.from({ length: 3 }, () => ({ fontSize: scoreSize, lineHeight: scoreSize })),
    );
    const expectedPositions = localYs.map((y) => ({ x: localX, y, z: 0 }));
    assert.deepEqual(
      playerNodes.map(({ position }) => ({ ...position })),
      expectedPositions,
    );
    assert.deepEqual(
      scoreNodes.map(({ position }) => ({ ...position })),
      expectedPositions,
    );
  }
});

test('snapshots every board once but reads effects only after an accepted Back commit', () => {
  cc.resetTestState();
  const counts = new Map<string, number>();
  const scores = {
    classic: board(3, 2, 1),
    crazy: board(6, 5, 4),
    gnStyle: board(9, 8, 7),
    classicBird: board(12, 11, 10),
    crazyBird: board(15, 14, 13),
    comboBird: board(18, 17, 16),
  };
  let effectsEnabled = false;
  let effectsReadCount = 0;
  const readEffectsEnabled = () => {
    effectsReadCount += 1;
    return effectsEnabled;
  };
  const settings = {} as Record<string, unknown>;
  for (const key of [
    'effectsEnabled',
    'classic',
    'crazy',
    'gnStyle',
    'classicBird',
    'crazyBird',
    'comboBird',
  ]) {
    Object.defineProperty(settings, key, {
      enumerable: true,
      get() {
        counts.set(key, (counts.get(key) ?? 0) + 1);
        return key === 'effectsEnabled'
          ? readEffectsEnabled
          : scores[key as keyof typeof scores];
      },
    });
  }
  const fixture = createFixture({ reset: false, settings });
  assert.deepEqual(Object.fromEntries(counts), {
    effectsEnabled: 1,
    classic: 1,
    crazy: 1,
    gnStyle: 1,
    classicBird: 1,
    crazyBird: 1,
    comboBird: 1,
  });
  assert.equal(effectsReadCount, 0, 'effects are not consulted during construction');

  scores.classic.first = 999;
  effectsEnabled = true;
  assert.deepEqual(fixture.presenter.state.model.boards[0].values, [3, 2, 1]);
  attachAndActivate(fixture);
  fixture.lifecycle = () => true;
  backOf(fixture).emit(cc.Node.EventType.TOUCH_END);
  assert.deepEqual(fixture.audioCalls, ['Sounds/menubuttonclick.wav']);
  assert.equal(effectsReadCount, 1);
  assert.deepEqual(Object.fromEntries(counts), {
    effectsEnabled: 1,
    classic: 1,
    crazy: 1,
    gnStyle: 1,
    classicBird: 1,
    crazyBird: 1,
    comboBird: 1,
  });
});

test('uses one touchId+slot gesture, strict horizontal moves, retained f32 segment flicks', () => {
  const fixture = createFixture();
  attachAndActivate(fixture);
  const cards = cardNodes(fixture);
  const initialXs = cards.map(({ worldPosition }) => worldPosition.x);

  begin(fixture, 10, 1);
  move(fixture, 11, 1, { x: 0, y: 0 }, { x: -100, y: 0 });
  end(fixture, 11, 1, false);
  assert.deepEqual(
    cards.map(({ worldPosition }) => worldPosition.x),
    initialXs,
    'foreign touch cannot alter the active gesture',
  );
  assert.deepEqual(fixture.presenter.state.activeGesture, { touchId: 10, slot: 1 });

  move(fixture, 10, 1, { x: 0, y: 0 }, { x: -10, y: 0 });
  assert.deepEqual(
    cards.map(({ worldPosition }, index) => worldPosition.x - initialXs[index]!),
    [-10, -10, -10, -10, -10, -10],
    'qualifying move drags before touch end',
  );
  end(fixture, 10, 1, false);
  assert.equal(fixture.presenter.state.model.currentIndex, 1);
  assert.equal(fixture.presenter.state.activeGesture, null);

  const beforeTie = cards.map(({ worldPosition }) => worldPosition.x);
  begin(fixture, 20, 0);
  move(fixture, 20, 0, { x: 0, y: 0 }, { x: 10, y: 10 });
  end(fixture, 20, 0, false);
  assert.deepEqual(cards.map(({ worldPosition }) => worldPosition.x), beforeTie);
  assert.equal(fixture.presenter.state.model.currentIndex, 1);

  begin(fixture, 21, 0);
  move(fixture, 21, 0, { x: 0, y: 0 }, { x: -1, y: 0 });
  const indexAfterUnitDrag = fixture.presenter.state.model.currentIndex;
  end(fixture, 21, 0, false);
  assert.equal(
    fixture.presenter.state.model.currentIndex,
    indexAfterUnitDrag,
    'length exactly 1 is not a flick',
  );

  begin(fixture, 22, 0);
  move(fixture, 22, 0, { x: 0, y: 0 }, { x: -8, y: 0 });
  const indexBeforeCancelledEnd = fixture.presenter.state.model.currentIndex;
  end(fixture, 22, 0, true);
  assert.equal(
    fixture.presenter.state.model.currentIndex,
    indexBeforeCancelledEnd,
    'cancelled end never flicks',
  );

  begin(fixture, 23, 0);
  move(fixture, 23, 0, { x: 0, y: 0 }, { x: -8, y: 0 });
  move(fixture, 23, 0, { x: -8, y: 0 }, { x: -8, y: 3 });
  const indexBeforeVerticalEnd = fixture.presenter.state.model.currentIndex;
  end(fixture, 23, 0, false);
  assert.equal(
    fixture.presenter.state.model.currentIndex,
    indexBeforeVerticalEnd,
    'flick uses the retained last segment, including a vertical last segment',
  );
});

test('malformed BladeInput payloads fail closed without throwing or moving cards', () => {
  const fixture = createFixture();
  attachAndActivate(fixture);
  const before = cardNodes(fixture).map(({ worldPosition }) => worldPosition.x);
  const node = fixture.blade.node;

  node.emit(CLASSIC_BLADE_BEGAN_EVENT, null);
  node.emit(CLASSIC_BLADE_BEGAN_EVENT, { point: { x: 0, y: 0 }, slot: 4, touchId: 1 });
  node.emit(CLASSIC_BLADE_BEGAN_EVENT, { point: { x: Number.NaN, y: 0 }, slot: 0, touchId: 1 });
  assert.equal(fixture.presenter.state.activeGesture, null);

  begin(fixture, 2, 0);
  node.emit(CLASSIC_BLADE_MOVED_EVENT, { segment: { slot: 0, touchId: 2 } });
  assert.equal(fixture.presenter.state.activeGesture, null);
  node.emit(CLASSIC_BLADE_ENDED_EVENT, { cancelled: 'no', slot: 0, touchId: 2 });
  node.emit(CLASSIC_BLADE_MOVED_EVENT, {});
  assert.deepEqual(
    cardNodes(fixture).map(({ worldPosition }) => worldPosition.x),
    before,
  );
});

test('update validates before mutation, advances exact one-second entry, and snaps once per frame', () => {
  const fixture = createFixture();
  assert.throws(() => fixture.presenter.update(Number.NaN), /non-negative finite/);
  assert.throws(() => fixture.presenter.update(-0.01), /non-negative finite/);
  assert.throws(() => fixture.presenter.update(60.001), /must not exceed 60/);
  assert.equal(fixture.presenter.state.entryElapsedSeconds, 0);

  attachAndActivate(fixture);
  const title = requireDescendant(fixture.presenter.root as unknown as StubNode, 'title');
  const back = backOf(fixture);
  fixture.presenter.update(0.5);
  assert.deepEqual(title.worldPosition, {
    x: interpolate(
      fixture.presenter.presentation.shell.title.initialPosition.x,
      fixture.presenter.presentation.shell.title.finalPosition.x,
      0.5,
    ),
    y: interpolate(
      fixture.presenter.presentation.shell.title.initialPosition.y,
      fixture.presenter.presentation.shell.title.finalPosition.y,
      0.5,
    ),
    z: 0,
  });
  assert.equal(back.eulerAngles.z, 180);
  fixture.presenter.update(0.5);
  assert.deepEqual(
    { x: title.worldPosition.x, y: title.worldPosition.y },
    fixture.presenter.presentation.shell.title.finalPosition,
  );
  assert.deepEqual(
    { x: back.worldPosition.x, y: back.worldPosition.y },
    fixture.presenter.presentation.shell.back.finalPosition,
  );
  assert.equal(back.eulerAngles.z, 360);
  fixture.presenter.update(10);
  assert.equal(fixture.presenter.state.entryElapsedSeconds, 1);

  begin(fixture, 30, 0);
  move(fixture, 30, 0, { x: 0, y: 0 }, { x: -100, y: 0 });
  end(fixture, 30, 0, true);
  const beforeSnap = cardNodes(fixture).map(({ worldPosition }) => worldPosition.x);
  fixture.presenter.update(0);
  assert.deepEqual(
    cardNodes(fixture).map(({ worldPosition }, index) => (
      Math.fround(worldPosition.x - beforeSnap[index]!)
    )),
    [11, 11, 11, 11, 11, 11],
    'zero-dt host frame still advances exactly one native snap frame',
  );

  begin(fixture, 31, 0);
  const held = cardNodes(fixture).map(({ worldPosition }) => worldPosition.x);
  fixture.presenter.update(0);
  assert.deepEqual(cardNodes(fixture).map(({ worldPosition }) => worldPosition.x), held);
});

test('Back touch and MOBILE_BACK share one frozen transaction; pending blocks duplicates', () => {
  const fixture = createFixture({ assetTree: '720x1280' });
  attachAndActivate(fixture);
  const transactions: unknown[] = [];
  fixture.lifecycle = (transaction) => {
    fixture.order.push('lifecycle');
    transactions.push(transaction);
    return true;
  };
  const back = backOf(fixture);

  back.emit(cc.Node.EventType.TOUCH_START);
  assert.equal(
    spriteOf(back).spriteFrame?.canonicalPath,
    '720x1280/Buttons/button-back-selected.png',
  );
  assert.deepEqual(transformOf(back).contentSize, { width: 181, height: 150 });
  back.emit(cc.Node.EventType.TOUCH_CANCEL);
  assert.equal(
    spriteOf(back).spriteFrame?.canonicalPath,
    '720x1280/Buttons/button-blue-back-normal.png',
  );
  back.emit(cc.Node.EventType.TOUCH_END);
  cc.input.emit(cc.Input.EventType.KEY_UP, { keyCode: cc.KeyCode.MOBILE_BACK });
  back.emit(cc.Node.EventType.TOUCH_END);

  assert.equal(transactions.length, 1);
  assert.deepEqual(transactions[0], {
    destination: 'MainMenuLayer',
    root: fixture.presenter.root,
    timing: 'immediate',
    zOrder: 1,
  });
  assert.equal(Object.isFrozen(transactions[0]), true);
  assert.equal(fixture.presenter.state.navigationPending, true);
  assert.deepEqual(fixture.order, ['lifecycle', 'audio']);
  assert.deepEqual(fixture.audioCalls, ['Sounds/menubuttonclick.wav']);

  const hardware = createFixture();
  attachAndActivate(hardware);
  const hardwareTransactions: unknown[] = [];
  hardware.lifecycle = (transaction) => {
    hardwareTransactions.push(transaction);
    return true;
  };
  cc.input.emit(cc.Input.EventType.KEY_UP, { keyCode: cc.KeyCode.MOBILE_BACK });
  assert.equal(hardwareTransactions.length, 1);

  let mutedEffectsReads = 0;
  const mutedSettings = createSettings();
  mutedSettings.effectsEnabled = () => {
    mutedEffectsReads += 1;
    return false;
  };
  const muted = createFixture({ settings: mutedSettings });
  attachAndActivate(muted);
  backOf(muted).emit(cc.Node.EventType.TOUCH_END);
  assert.equal(mutedEffectsReads, 1);
  assert.deepEqual(muted.audioCalls, []);
});

test('false and throwing navigation restore exact host/sibling, positions, and the same input lease', () => {
  for (const outcome of ['false', 'throw'] as const) {
    let effectsReadCount = 0;
    const settings = createSettings();
    settings.effectsEnabled = () => {
      effectsReadCount += 1;
      return true;
    };
    const fixture = createFixture({ settings });
    const before = new cc.Node('before') as unknown as StubNode;
    const after = new cc.Node('after') as unknown as StubNode;
    before.setParent(fixture.host);
    fixture.presenter.root.setParent(fixture.host);
    after.setParent(fixture.host);
    fixture.presenter.root.setSiblingIndex(1);
    fixture.presenter.activate();
    fixture.presenter.update(0.25);
    begin(fixture, 40, 0);
    move(fixture, 40, 0, { x: 0, y: 0 }, { x: -24, y: 0 });
    end(fixture, 40, 0, true);
    const positions = cardNodes(fixture).map(({ worldPosition }) => ({ ...worldPosition }));
    const entry = fixture.presenter.state.entryElapsedSeconds;

    fixture.lifecycle = (transaction) => {
      assert.equal(fixture.presenter.suspendForTransition(), true);
      (transaction as { root: StubNode }).root.setParent(null, true);
      if (outcome === 'throw') {
        throw new Error('injected route failure');
      }
      return false;
    };

    if (outcome === 'throw') {
      assert.throws(
        () => backOf(fixture).emit(cc.Node.EventType.TOUCH_END),
        /injected route failure/,
      );
    } else {
      backOf(fixture).emit(cc.Node.EventType.TOUCH_END);
    }
    assert.equal(fixture.presenter.root.parent, fixture.host);
    assert.equal(fixture.presenter.root.getSiblingIndex(), 1);
    assert.equal(fixture.presenter.state.suspended, false);
    assert.equal(fixture.presenter.state.navigationPending, false);
    assert.equal(fixture.presenter.state.entryElapsedSeconds, entry);
    assert.deepEqual(
      cardNodes(fixture).map(({ worldPosition }) => ({ ...worldPosition })),
      positions,
    );
    assert.deepEqual(
      fixture.blade.calls,
      ['activate', 'cut:false', 'cut:false', 'deactivate', 'activate', 'cut:false'],
    );
    assert.deepEqual(fixture.audioCalls, []);
    assert.equal(
      effectsReadCount,
      0,
      'rejected/throwing navigation must not consult or play effects',
    );
  }
});

test('post-commit audio runs after synchronous disposal and failure never rolls back or rearms', () => {
  const fixture = createFixture();
  attachAndActivate(fixture);
  let committedRoot: StubNode | null = null;
  fixture.lifecycle = (transaction) => {
    fixture.order.push('lifecycle');
    committedRoot = (transaction as { root: StubNode }).root;
    assert.equal(fixture.presenter.suspendForTransition(), true);
    assert.equal(fixture.presenter.dispose(), true);
    return true;
  };
  fixture.audioCalls.length = 0;
  const originalPlay = fixtureAudioPort.playOneShot;
  fixtureAudioPort.playOneShot = (path: string) => {
    fixture.order.push('audio');
    fixture.audioCalls.push(path);
    throw new Error('injected postcommit audio failure');
  };

  try {
    assert.throws(
      () => backOf(fixture).emit(cc.Node.EventType.TOUCH_END),
      (error: unknown) => (
        error instanceof LeaderboardPostCommitAudioError
        && /postcommit audio failure/.test(error.message)
      ),
    );
    assert.equal(committedRoot, fixture.presenter.root);
    assert.equal(fixture.presenter.state.disposed, true);
    assert.equal(fixture.presenter.root.destroyed, true);
    assert.deepEqual(fixture.order, ['lifecycle', 'audio']);
    assert.deepEqual(fixture.audioCalls, ['Sounds/menubuttonclick.wav']);
    assert.equal(
      fixture.blade.calls.filter((call) => call === 'activate').length,
      1,
      'post-commit failure must not rearm',
    );
  } finally {
    fixtureAudioPort.playOneShot = originalPlay;
  }
});

test('dynamic effects failures are post-commit, distinct, and never rearm the source', () => {
  const settings = createSettings();
  settings.effectsEnabled = () => {
    throw new Error('injected effects read failure');
  };
  const fixture = createFixture({ settings });
  attachAndActivate(fixture);
  fixture.lifecycle = () => {
    fixture.order.push('lifecycle');
    assert.equal(fixture.presenter.suspendForTransition(), true);
    assert.equal(fixture.presenter.dispose(), true);
    return true;
  };

  assert.throws(
    () => backOf(fixture).emit(cc.Node.EventType.TOUCH_END),
    (error: unknown) => (
      error instanceof LeaderboardPostCommitSettingsError
      && /effects read failure/.test(error.message)
    ),
  );
  assert.equal(fixture.presenter.state.disposed, true);
  assert.deepEqual(fixture.order, ['lifecycle']);
  assert.deepEqual(fixture.audioCalls, []);
  assert.equal(
    fixture.blade.calls.filter((call) => call === 'activate').length,
    1,
  );
});

test('activation rollback handles lease, cut-disable, and partial listener failures without cut=true', () => {
  const activateFailure = createFixture();
  activateFailure.blade.failActivate = true;
  activateFailure.presenter.root.setParent(activateFailure.host);
  assert.throws(() => activateFailure.presenter.activate(), /injected activate failure/);
  assert.equal(activateFailure.presenter.root.active, false);
  assert.deepEqual(activateFailure.blade.calls, ['activate']);

  const cutFailure = createFixture();
  cutFailure.blade.failSetCut = true;
  cutFailure.presenter.root.setParent(cutFailure.host);
  assert.throws(() => cutFailure.presenter.activate(), /injected setCut failure/);
  assert.deepEqual(
    cutFailure.blade.calls,
    ['activate', 'cut:false', 'cut:false', 'deactivate'],
  );
  assert.equal(cutFailure.presenter.root.active, false);

  const listenerFailure = createFixture();
  listenerFailure.presenter.root.setParent(listenerFailure.host);
  cc.failNextListenerRegistration('back-item', cc.Node.EventType.TOUCH_END);
  assert.throws(() => listenerFailure.presenter.activate(), /listener registration failure/);
  assert.equal(listenerFailure.blade.node.listenerCount(CLASSIC_BLADE_BEGAN_EVENT), 0);
  assert.equal(backOf(listenerFailure).listenerCount(cc.Node.EventType.TOUCH_START), 0);
  assert.equal(cc.input.listenerCount(cc.Input.EventType.KEY_UP), 0);
  assert.equal(listenerFailure.presenter.root.active, false);
  assert.equal(
    listenerFailure.blade.calls.some((call) => call === 'cut:true'),
    false,
  );

  const poisonedRollback = createFixture();
  poisonedRollback.presenter.root.setParent(poisonedRollback.host);
  poisonedRollback.blade.failDeactivate = true;
  cc.failNextListenerRegistration('back-item', cc.Node.EventType.TOUCH_END);
  assert.throws(
    () => poisonedRollback.presenter.activate(),
    (error: unknown) => error instanceof LeaderboardCleanupError,
  );
  assert.equal(poisonedRollback.presenter.state.poisoned, true);
  assert.equal(poisonedRollback.presenter.state.suspended, true);
  assert.throws(
    () => poisonedRollback.presenter.activate(),
    /Poisoned Leaderboard presenter/,
  );
  assert.equal(poisonedRollback.presenter.dispose(), true);
  assert.equal(
    poisonedRollback.blade.calls.filter((call) => call === 'deactivate').length,
    2,
    'dispose retries activation rollback lease surrender',
  );
});

test('suspend/rearm/dispose are idempotent, lease-safe, and aggregate cleanup failures', () => {
  const fixture = createFixture();
  attachAndActivate(fixture);
  assert.equal(fixture.presenter.suspendForTransition(), true);
  assert.equal(fixture.presenter.suspendForTransition(), false);
  assert.equal(fixture.blade.node.listenerCount(CLASSIC_BLADE_BEGAN_EVENT), 0);
  assert.equal(cc.input.listenerCount(cc.Input.EventType.KEY_UP), 0);
  assert.equal(fixture.presenter.rearmNavigationAfterFailure(), true);
  assert.equal(fixture.presenter.state.suspended, false);
  assert.equal(fixture.blade.node.listenerCount(CLASSIC_BLADE_BEGAN_EVENT), 1);
  assert.equal(fixture.presenter.suspendForTransition(), true);
  const deactivations = fixture.blade.calls.filter((call) => call === 'deactivate').length;
  assert.equal(fixture.presenter.dispose(), true);
  assert.equal(fixture.presenter.dispose(), false);
  assert.equal(
    fixture.blade.calls.filter((call) => call === 'deactivate').length,
    deactivations,
    'disposing a suspended source must not deactivate a newer owner',
  );
  assert.equal(
    fixture.blade.calls.some((call) => call === 'cut:true'),
    false,
  );

  const failing = createFixture();
  attachAndActivate(failing);
  failing.blade.failSetCut = true;
  failing.blade.failDeactivate = true;
  cc.failNextDestroy('LeaderboardRoot');
  assert.throws(
    () => failing.presenter.dispose(),
    (error: unknown) => (
      error instanceof LeaderboardCleanupError
      && error.causes.length === 3
    ),
  );
  assert.equal(failing.presenter.state.disposed, true);
  assert.equal(failing.presenter.root.destroyed, true);
});

test('suspension listener failure poisons rearm and disposal retries the leaked listener', () => {
  const fixture = createFixture();
  attachAndActivate(fixture);
  cc.failNextListenerRemoval(
    fixture.blade.node.name,
    CLASSIC_BLADE_MOVED_EVENT,
  );
  assert.throws(
    () => fixture.presenter.suspendForTransition(),
    (error: unknown) => (
      error instanceof LeaderboardCleanupError
      && error.causes.length === 1
    ),
  );
  assert.equal(fixture.presenter.state.suspended, true);
  assert.equal(fixture.presenter.state.poisoned, true);
  assert.equal(
    fixture.blade.node.listenerCount(CLASSIC_BLADE_MOVED_EVENT),
    1,
    'failed off remains retry-needed',
  );
  assert.deepEqual(
    fixture.blade.calls.slice(-2),
    ['cut:false', 'deactivate'],
  );
  assert.throws(
    () => fixture.presenter.rearmNavigationAfterFailure(),
    /cannot rearm navigation/,
  );
  assert.equal(fixture.presenter.dispose(), true);
  assert.equal(fixture.blade.node.listenerCount(CLASSIC_BLADE_MOVED_EVENT), 0);
  assert.equal(fixture.blade.calls.some((call) => call === 'cut:true'), false);
});

test('failed BladeInput deactivation retains ownership for disposal retry and forbids rearm', () => {
  const fixture = createFixture();
  attachAndActivate(fixture);
  fixture.blade.failDeactivate = true;
  assert.throws(
    () => fixture.presenter.suspendForTransition(),
    (error: unknown) => error instanceof LeaderboardCleanupError,
  );
  assert.equal(fixture.presenter.state.poisoned, true);
  assert.equal(fixture.presenter.state.suspended, true);
  assert.throws(
    () => fixture.presenter.rearmNavigationAfterFailure(),
    /cannot rearm navigation/,
  );
  assert.equal(fixture.presenter.dispose(), true);
  assert.equal(
    fixture.blade.calls.filter((call) => call === 'deactivate').length,
    2,
    'dispose retries uncertain lease surrender',
  );
  assert.equal(fixture.blade.calls.some((call) => call === 'cut:true'), false);
});

test('failed rearm rollback poisons the source and retains its uncertain lease for disposal', () => {
  const fixture = createFixture();
  attachAndActivate(fixture);
  assert.equal(fixture.presenter.suspendForTransition(), true);
  fixture.blade.failSetCut = true;
  fixture.blade.failDeactivate = true;

  assert.throws(
    () => fixture.presenter.rearmNavigationAfterFailure(),
    (error: unknown) => error instanceof LeaderboardCleanupError,
  );
  assert.equal(fixture.presenter.state.poisoned, true);
  assert.equal(fixture.presenter.state.suspended, true);
  assert.throws(
    () => fixture.presenter.rearmNavigationAfterFailure(),
    /cannot rearm navigation/,
  );
  assert.equal(fixture.presenter.dispose(), true);
  assert.equal(
    fixture.blade.calls.filter((call) => call === 'deactivate').length,
    3,
  );
  assert.equal(fixture.blade.calls.some((call) => call === 'cut:true'), false);
});

test('rejects malformed ports/settings/resources/dt and aggregates constructor rollback', () => {
  const valid = createFixture();
  assert.throws(
    () => LeaderboardPresenter.create(null as never),
    /input must be an object/,
  );
  assert.throws(
    () => LeaderboardPresenter.create({
      ...baseInput(valid),
      resources: { ...fixtureResources, rasterCount: 9 },
    } as never),
    /complete 10-raster catalog/,
  );
  assert.throws(
    () => LeaderboardPresenter.create({
      ...baseInput(valid),
      settings: { ...valid.settings, extra: true },
    } as never),
    /must contain exactly/,
  );
  assert.throws(
    () => LeaderboardPresenter.create({
      ...baseInput(valid),
      settings: {
        ...valid.settings,
        classic: { first: 1, second: 2, third: Number.NaN },
      },
    } as never),
    /safe integer/,
  );

  cc.resetTestState();
  const broken = createFixture({ reset: false });
  const expected = fixtureResources.raster;
  fixtureResources.raster = (resource: RasterContract) => ({
    canonicalPath: `${resource.canonicalPath}.wrong`,
    dimensions: resource.dimensions,
    spriteFrame: { canonicalPath: resource.canonicalPath },
  });
  cc.failNextDestroy('LeaderboardRoot');
  try {
    assert.throws(
      () => LeaderboardPresenter.create(baseInput(broken) as never),
      (error: unknown) => (
        error instanceof LeaderboardCleanupError
        && error.causes.length === 2
      ),
    );
  } finally {
    fixtureResources.raster = expected;
  }
});

test('source has no blade rendering, raycasts, particles, RNG, persistence, or cut enable path', () => {
  for (const forbidden of [
    'StandardBladePresenter',
    'raycast',
    'Collider2D',
    'particle',
    'GameplayRandom',
    'Math.random',
    'persist',
    'save',
    'fetch(',
    'JNI',
    'setCutEnabled(true)',
  ]) {
    assert.equal(
      SOURCE.includes(forbidden),
      false,
      `presenter source must not contain ${forbidden}`,
    );
  }
  assert.equal(
    (SOURCE.match(/model\.updateFrame\(/g) ?? []).length,
    1,
    'the presenter has one updateFrame call site',
  );
});

type RasterContract = Readonly<{
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{ readonly height: number; readonly width: number }>;
}>;

const fixtureResources: {
  readonly assetTree: '480x800' | '720x1280';
  readonly playerFont: Readonly<{ readonly name: string }>;
  readonly rasterCount: 10;
  raster(resource: RasterContract): Readonly<{
    readonly canonicalPath: string;
    readonly dimensions: RasterContract['dimensions'];
    readonly spriteFrame: Readonly<{ readonly canonicalPath: string }>;
  }>;
  readonly scoreFont: Readonly<{ readonly name: string }>;
} = {
  assetTree: '480x800',
  playerFont: Object.freeze({ name: 'Andyb' }),
  rasterCount: 10,
  raster(resource: RasterContract) {
    return Object.freeze({
      canonicalPath: resource.canonicalPath,
      dimensions: resource.dimensions,
      spriteFrame: Object.freeze({ canonicalPath: resource.canonicalPath }),
    });
  },
  scoreFont: Object.freeze({ name: 'Century' }),
};

const fixtureAudioPort: { playOneShot(path: string): void } = {
  playOneShot(): void {},
};

function createFixture(options: Readonly<{
  readonly assetTree?: '480x800' | '720x1280';
  readonly reset?: boolean;
  readonly settings?: Record<string, unknown>;
}> = {}): Fixture {
  if (options.reset !== false) {
    cc.resetTestState();
  }
  const assetTree = options.assetTree ?? '480x800';
  Object.assign(fixtureResources, { assetTree });
  const canvas = new cc.Node('Canvas') as unknown as StubNode;
  const host = new cc.Node('host') as unknown as StubNode;
  const blade = bladeHarness();
  const audioCalls: string[] = [];
  const order: string[] = [];
  const settings = (options.settings ?? createSettings()) as ReturnType<typeof createSettings>;
  const viewport = assetTree === '480x800'
    ? createViewport(480, 800)
    : createViewport(720, 1280);
  let lifecycle: (transaction: unknown) => boolean | void = () => true;
  fixtureAudioPort.playOneShot = (path: string) => {
    order.push('audio');
    audioCalls.push(path);
  };
  const fixture = {
    audioCalls,
    blade,
    canvas,
    host,
    get lifecycle() { return lifecycle; },
    set lifecycle(callback: (transaction: unknown) => boolean | void) {
      lifecycle = callback;
    },
    order,
    presenter: null as unknown as InstanceType<typeof LeaderboardPresenter>,
    settings,
  };
  fixture.presenter = LeaderboardPresenter.create({
    audio: fixtureAudioPort,
    bladeInput: blade.port,
    canvas,
    lifecycle: {
      onMainMenuRequested(transaction: unknown) {
        return lifecycle(transaction);
      },
    },
    resources: fixtureResources,
    settings,
    viewport,
  } as never);
  return fixture;
}

function baseInput(fixture: Fixture): Record<string, unknown> {
  return {
    audio: fixtureAudioPort,
    bladeInput: fixture.blade.port,
    canvas: fixture.canvas,
    lifecycle: {
      onMainMenuRequested(transaction: unknown) {
        return fixture.lifecycle(transaction);
      },
    },
    resources: fixtureResources,
    settings: fixture.settings,
    viewport: createViewport(
      fixtureResources.assetTree === '480x800' ? 480 : 720,
      fixtureResources.assetTree === '480x800' ? 800 : 1280,
    ),
  };
}

function createSettings(): {
  effectsEnabled: () => boolean;
  classic: ScoreBoard;
  crazy: ScoreBoard;
  gnStyle: ScoreBoard;
  classicBird: ScoreBoard;
  crazyBird: ScoreBoard;
  comboBird: ScoreBoard;
} {
  return {
    effectsEnabled: () => true,
    classic: board(103, 102, 101),
    crazy: board(203, 202, 201),
    gnStyle: board(303, 302, 301),
    classicBird: board(403, 402, 401),
    crazyBird: board(503, 502, 501),
    comboBird: board(603, 602, 601),
  };
}

function board(first: number, second: number, third: number): ScoreBoard {
  return { first, second, third };
}

function createViewport(width: number, height: number): Readonly<Record<string, unknown>> {
  return Object.freeze({
    logicalHeight: Math.fround(height),
    logicalWidth: Math.fround(width),
    visibleRect: Object.freeze({
      bottom: Object.freeze({ x: Math.fround(width / 2), y: 0 }),
      center: Object.freeze({ x: Math.fround(width / 2), y: Math.fround(height / 2) }),
      left: Object.freeze({ x: 0, y: Math.fround(height / 2) }),
      right: Object.freeze({ x: Math.fround(width), y: Math.fround(height / 2) }),
      top: Object.freeze({ x: Math.fround(width / 2), y: Math.fround(height) }),
    }),
  });
}

function bladeHarness(): BladeHarness {
  const node = new cc.Node('BladeInput') as unknown as StubNode;
  const harness: BladeHarness = {
    calls: [],
    failActivate: false,
    failDeactivate: false,
    failSetCut: false,
    node,
    port: null as unknown as BladeHarness['port'],
  };
  harness.port = {
    node,
    activateForClassicLayer(): void {
      harness.calls.push('activate');
      if (harness.failActivate) {
        harness.failActivate = false;
        throw new Error('injected activate failure');
      }
    },
    deactivateForNonClassicScreen(): void {
      harness.calls.push('deactivate');
      if (harness.failDeactivate) {
        harness.failDeactivate = false;
        throw new Error('injected deactivate failure');
      }
    },
    setCutEnabled(enabled: boolean): void {
      harness.calls.push(`cut:${String(enabled)}`);
      if (harness.failSetCut) {
        harness.failSetCut = false;
        throw new Error('injected setCut failure');
      }
    },
  };
  return harness;
}

function attachAndActivate(fixture: Fixture): void {
  fixture.presenter.root.setParent(fixture.host);
  fixture.presenter.activate();
}

function begin(fixture: Fixture, touchId: number, slot: number): void {
  fixture.blade.node.emit(CLASSIC_BLADE_BEGAN_EVENT, {
    point: { x: 0, y: 0 },
    slot,
    touchId,
  });
}

function move(
  fixture: Fixture,
  touchId: number,
  slot: number,
  previous: Readonly<{ readonly x: number; readonly y: number }>,
  current: Readonly<{ readonly x: number; readonly y: number }>,
): void {
  fixture.blade.node.emit(CLASSIC_BLADE_MOVED_EVENT, {
    segment: { current, previous, slot, touchId },
    shouldPlaySwish: false,
  });
}

function end(
  fixture: Fixture,
  touchId: number,
  slot: number,
  cancelled: boolean,
): void {
  fixture.blade.node.emit(CLASSIC_BLADE_ENDED_EVENT, {
    cancelled,
    slot,
    touchId,
  });
}

function backOf(fixture: Fixture): StubNode {
  return requireDescendant(fixture.presenter.root as unknown as StubNode, 'back-item');
}

function cardNodes(fixture: Fixture): StubNode[] {
  return (fixture.presenter.root as unknown as StubNode).children.slice(3);
}

function requireChild(root: StubNode, name: string): StubNode {
  const child = root.children.find((candidate) => candidate.name === name);
  assert.notEqual(child, undefined, `missing child ${name}`);
  return child!;
}

function requireDescendant(root: StubNode, name: string): StubNode {
  if (root.name === name) {
    return root;
  }
  for (const child of root.children) {
    try {
      return requireDescendant(child, name);
    } catch {}
  }
  throw new Error(`Missing descendant ${name}`);
}

function labelOf(node: StubNode): StubLabel {
  const label = node.getComponent(cc.Label);
  assert.notEqual(label, null, `${node.name} must have Label`);
  return label!;
}

function spriteOf(node: StubNode): StubSprite {
  const sprite = node.getComponent(cc.Sprite);
  assert.notEqual(sprite, null, `${node.name} must have Sprite`);
  return sprite!;
}

function transformOf(node: StubNode): StubTransform {
  const transform = node.getComponent(cc.UITransform);
  assert.notEqual(transform, null, `${node.name} must have UITransform`);
  return transform!;
}

function interpolate(start: number, end: number, progress: number): number {
  return Math.fround(Math.fround(start) + Math.fround(
    Math.fround(end - start) * Math.fround(progress),
  ));
}

function moduleUrl(source: string): string {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}
