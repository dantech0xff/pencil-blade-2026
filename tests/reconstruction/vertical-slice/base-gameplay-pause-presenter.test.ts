import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const createdNodes = [];
export const directorCalls = [];
export function resetCreatedNodes() { createdNodes.length = 0; }
export function resetDirectorCalls() { directorCalls.length = 0; }

export class Color {
  constructor(r = 0, g = 0, b = 0, a = 255) {
    this.r = r; this.g = g; this.b = b; this.a = a;
  }
}

export class Font {
  constructor() { this.destroyed = false; }
}

export class Size {
  constructor(width = 0, height = 0) { this.width = width; this.height = height; }
}

export class SpriteFrame {
  constructor(width, height) {
    this.destroyed = false;
    this.originalSize = new Size(width, height);
    this.rect = { width, height };
  }
}

export class UITransform {
  constructor() {
    this.anchorPoint = { x: 0.5, y: 0.5 };
    this.contentSize = new Size();
  }
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
  setContentSize(width, height) { this.contentSize = new Size(width, height); }
}

export class Graphics {
  constructor() {
    this.commands = [];
    this.fillColor = new Color(255, 255, 255, 255);
  }
  rect(x, y, width, height) {
    this.commands.push({ type: 'rect', x, y, width, height });
  }
  fill() { this.commands.push({ type: 'fill' }); }
}

export class Sprite {
  constructor() {
    this.sizeMode = 0;
    this.spriteFrame = null;
  }
}
Sprite.SizeMode = Object.freeze({ CUSTOM: 2 });

export class UIOpacity {
  constructor() { this.opacity = 255; }
}

export class Label {
  constructor() {
    this.color = new Color(255, 255, 255, 255);
    this.font = null;
    this.fontSize = 40;
    this.lineHeight = 40;
    this.string = '';
  }
}

export class Node {
  constructor(name = '') {
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyed = false;
    this.events = new Map();
    this.failNextSetParent = false;
    this.failNextSetSiblingIndex = false;
    this.lastRequestedSiblingIndex = null;
    this.layer = 0;
    this.name = name;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
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
  addComponent(Type) {
    const component = new Type();
    component.node = this;
    this.components.set(Type, component);
    return component;
  }
  getComponent(Type) { return this.components.get(Type) ?? null; }
  setParent(parent, keepWorldTransform = false) {
    if (this.failNextSetParent) {
      this.failNextSetParent = false;
      throw new Error('injected setParent failure');
    }
    const world = this.worldPosition;
    if (this.parent !== null) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
    if (keepWorldTransform) {
      const parentWorld = parent === null
        ? { x: 0, y: 0, z: 0 }
        : parent.worldPosition;
      this.position = {
        x: world.x - parentWorld.x,
        y: world.y - parentWorld.y,
        z: world.z - parentWorld.z,
      };
    }
  }
  setPosition(x, y, z) { this.position = { x, y, z }; }
  setSiblingIndex(index) {
    if (this.failNextSetSiblingIndex) {
      this.failNextSetSiblingIndex = false;
      throw new Error('injected setSiblingIndex failure');
    }
    this.lastRequestedSiblingIndex = index;
    if (this.parent === null) return;
    const current = this.parent.children.indexOf(this);
    if (current >= 0) this.parent.children.splice(current, 1);
    const bounded = Math.max(0, Math.min(index, this.parent.children.length));
    this.parent.children.splice(bounded, 0, this);
  }
  on(type, callback, target) {
    const listeners = this.events.get(type) ?? [];
    listeners.push({ callback, target });
    this.events.set(type, listeners);
  }
  off(type, callback, target) {
    const listeners = this.events.get(type) ?? [];
    this.events.set(type, listeners.filter((listener) => (
      listener.callback !== callback || listener.target !== target
    )));
  }
  emit(type, ...args) {
    for (const listener of [...(this.events.get(type) ?? [])]) {
      listener.callback.apply(listener.target, args);
    }
  }
  listenerCount(type) { return (this.events.get(type) ?? []).length; }
  destroy() {
    if (this.destroyed) return;
    for (const child of [...this.children]) child.destroy();
    this.destroyed = true;
    this.active = false;
    this.events.clear();
    this.setParent(null);
  }
}
Node.EventType = Object.freeze({
  TOUCH_CANCEL: 'touch-cancel',
  TOUCH_END: 'touch-end',
  TOUCH_START: 'touch-start',
});

export const director = Object.freeze({
  pause() { directorCalls.push('pause'); },
  resume() { directorCalls.push('resume'); },
});

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
  BASE_GAMEPLAY_ARIAL_FONT_RESOURCE,
  getBaseGameplayResourceProfile,
} = await import(
  '../../../game/assets/scripts/domain/base-gameplay-resource-contract.ts'
);
const { BaseGameplayPausePresenter } = await import(
  '../../../game/assets/scripts/creator/base-gameplay-pause-presenter.ts'
);

const EMPTY_CARD = Object.freeze({
  description: 'No bombs hit Crazy Mode',
  progress: '',
  reward: 'reward: 666 coins',
});

const PROGRESS_CARD = Object.freeze({
  description: '1000 fruits total',
  progress: '(1000 fruits to go)',
  reward: 'reward: 222 coins',
});

type GameAssetTree = '480x800' | '720x1280';

interface GameRasterResource {
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{ height: number; width: number }>;
}

interface CocosStub {
  readonly Font: new () => StubFont;
  readonly Label: new () => StubLabel;
  readonly Node: (new (name?: string) => StubNode) & {
    readonly EventType: Readonly<{
      TOUCH_CANCEL: string;
      TOUCH_END: string;
      TOUCH_START: string;
    }>;
  };
  readonly SpriteFrame: new (width: number, height: number) => StubSpriteFrame;
  readonly UIOpacity: new () => { opacity: number };
  readonly createdNodes: StubNode[];
  readonly director: Readonly<{ pause(): void; resume(): void }>;
  readonly directorCalls: string[];
  readonly resetCreatedNodes: () => void;
  readonly resetDirectorCalls: () => void;
}

interface StubColor {
  readonly a: number;
  readonly b: number;
  readonly g: number;
  readonly r: number;
}

interface StubFont {
  destroyed: boolean;
  failNextSetParent: boolean;
  failNextSetSiblingIndex: boolean;
}

interface StubGraphics {
  readonly commands: readonly Readonly<Record<string, number | string>>[];
  readonly fillColor: StubColor;
}

interface StubLabel {
  color: StubColor;
  font: StubFont | null;
  fontSize: number;
  lineHeight: number;
  string: string;
}

interface StubNode {
  active: boolean;
  readonly activeInHierarchy: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  lastRequestedSiblingIndex: number | null;
  layer: number;
  readonly name: string;
  readonly parent: StubNode | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly worldPosition: Readonly<{ x: number; y: number; z: number }>;
  emit(type: string): void;
  getComponent<T>(Type: new () => T): T | null;
  listenerCount(type: string): number;
  setParent(parent: StubNode | null, keepWorldTransform?: boolean): void;
  setPosition(x: number, y: number, z: number): void;
}

interface StubSpriteFrame {
  destroyed: boolean;
  readonly originalSize: Readonly<{ height: number; width: number }>;
  rect: Readonly<{ height: number; width: number }>;
}

interface LoadedRaster extends GameRasterResource {
  readonly spriteFrame: StubSpriteFrame;
}

interface LoadedResources {
  readonly arialFont: Readonly<{
    readonly canonicalPath: string;
    readonly font: StubFont;
  }>;
  readonly assetTree: GameAssetTree;
  readonly objectiveAchievement: Readonly<{
    readonly completedMessage: LoadedRaster;
    readonly nextMessage: LoadedRaster;
    readonly xmasFive: LoadedRaster;
    readonly xmasFour: LoadedRaster;
  }>;
  readonly pause: Readonly<{
    readonly objectiveBackground: LoadedRaster;
    readonly pauseNormal: LoadedRaster;
    readonly pauseSelected: LoadedRaster;
    readonly quitNormal: LoadedRaster;
    readonly quitSelected: LoadedRaster;
    readonly replayNormal: LoadedRaster;
    readonly replaySelected: LoadedRaster;
    readonly resumeNormal: LoadedRaster;
    readonly resumeSelected: LoadedRaster;
  }>;
}

interface Harness {
  readonly events: string[];
  readonly font: StubFont;
  readonly input: Readonly<{
    readonly contentScaleFactor: number;
    readonly initialCard: typeof EMPTY_CARD;
    readonly resources: LoadedResources;
    readonly viewport: Readonly<{ height: number; width: number }>;
  }>;
  readonly presenter: InstanceType<typeof BaseGameplayPausePresenter>;
  readonly resources: LoadedResources;
}

test('both profiles construct and attach the exact three-root pause tree', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    resetRuntime();
    const harness = createHarness(assetTree);
    const { presenter, resources } = harness;
    const owned = [...cc.createdNodes];

    assert.deepEqual(owned.map(({ name }) => name), [
      'BaseGameplayPauseOverlay',
      'BaseGameplayPauseObjectiveBackground',
      'BaseGameplayPauseDescriptionLabel',
      'BaseGameplayPauseProgressLabel',
      'BaseGameplayPauseRewardLabel',
      'BaseGameplayPauseMenu',
      'BaseGameplayPauseButton',
      'BaseGameplayPauseOptionsMenu',
      'BaseGameplayPauseResumeButton',
      'BaseGameplayPauseReplayButton',
      'BaseGameplayPauseQuitButton',
    ]);
    assert.equal(owned.length, 11);
    assert.equal(presenter.isAttached, false);
    assert.equal(presenter.isDisposed, false);
    assert.equal(presenter.objectiveOverlay.node.active, false);
    assert.equal(presenter.pauseMenu.node.active, false);
    assert.equal(presenter.optionsMenu.node.active, false);

    assert.deepEqual(
      presenter.objectiveOverlay.node.children.map(({ name }) => name),
      ['BaseGameplayPauseObjectiveBackground'],
    );
    assert.deepEqual(
      presenter.objectiveBackground.node.children.map(({ name }) => name),
      [
        'BaseGameplayPauseDescriptionLabel',
        'BaseGameplayPauseProgressLabel',
        'BaseGameplayPauseRewardLabel',
      ],
    );
    assert.deepEqual(
      presenter.pauseMenu.node.children.map(({ name }) => name),
      ['BaseGameplayPauseButton'],
    );
    assert.deepEqual(
      presenter.optionsMenu.node.children.map(({ name }) => name),
      [
        'BaseGameplayPauseResumeButton',
        'BaseGameplayPauseReplayButton',
        'BaseGameplayPauseQuitButton',
      ],
    );

    assert.deepEqual(
      size(presenter.objectiveOverlay.transform.contentSize),
      harness.input.viewport,
    );
    assert.deepEqual(point(presenter.objectiveOverlay.transform.anchorPoint), {
      x: 0,
      y: 0,
    });
    assert.deepEqual(
      color((presenter.objectiveOverlay.graphics as unknown as StubGraphics).fillColor),
      { a: 65, b: 0, g: 0, r: 0 },
    );
    assert.deepEqual(
      (presenter.objectiveOverlay.graphics as unknown as StubGraphics).commands,
      [
        {
          height: harness.input.viewport.height,
          type: 'rect',
          width: harness.input.viewport.width,
          x: 0,
          y: 0,
        },
        { type: 'fill' },
      ],
    );
    assert.equal(presenter.objectiveOverlay.opacity, 65);
    assert.equal(
      presenter.objectiveOverlay.node.getComponent(cc.UIOpacity),
      null,
    );

    assert.equal(
      presenter.objectiveBackground.sprite.spriteFrame,
      resources.pause.objectiveBackground.spriteFrame,
    );
    assert.deepEqual(
      size(presenter.objectiveBackground.transform.contentSize),
      resources.pause.objectiveBackground.dimensions,
    );
    assert.deepEqual(
      vector3(presenter.objectiveBackground.node.position),
      withZ(presenter.layout.objectiveBackgroundWorldPosition),
    );

    assertPresentedLabel(
      presenter.descriptionLabel,
      harness.font,
      EMPTY_CARD.description,
      presenter.layout.fontSize,
      { x: 0.5, y: 0.5 },
      centeredLocal(
        presenter.layout.descriptionLocalPosition,
        resources.pause.objectiveBackground.dimensions,
      ),
    );
    assertPresentedLabel(
      presenter.progressLabel,
      harness.font,
      EMPTY_CARD.progress,
      presenter.layout.fontSize,
      { x: 0, y: 0.5 },
      centeredLocal(
        presenter.layout.progressLocalPosition,
        resources.pause.objectiveBackground.dimensions,
      ),
    );
    assertPresentedLabel(
      presenter.rewardLabel,
      harness.font,
      EMPTY_CARD.reward,
      presenter.layout.fontSize,
      { x: 0, y: 0.5 },
      centeredLocal(
        presenter.layout.rewardLocalPosition,
        resources.pause.objectiveBackground.dimensions,
      ),
    );
    assert.deepEqual(
      vector3(presenter.descriptionLabel.node.worldPosition),
      withZ({
        x: presenter.layout.objectiveBackgroundWorldPosition.x
          + centeredLocal(
            presenter.layout.descriptionLocalPosition,
            resources.pause.objectiveBackground.dimensions,
          ).x,
        y: presenter.layout.objectiveBackgroundWorldPosition.y
          + centeredLocal(
            presenter.layout.descriptionLocalPosition,
            resources.pause.objectiveBackground.dimensions,
          ).y,
      }),
    );

    for (const [button, normal] of [
      [presenter.pauseButton, resources.pause.pauseNormal],
      [presenter.resumeButton, resources.pause.resumeNormal],
      [presenter.replayButton, resources.pause.replayNormal],
      [presenter.quitButton, resources.pause.quitNormal],
    ] as const) {
      assert.equal(button.sprite.sizeMode, 2);
      assert.equal(button.sprite.spriteFrame, normal.spriteFrame);
      assert.deepEqual(size(button.transform.contentSize), normal.dimensions);
      assert.deepEqual(point(button.transform.anchorPoint), { x: 0.5, y: 0.5 });
    }
    assert.deepEqual(
      vector3(presenter.pauseButton.node.position),
      withZ(presenter.layout.pauseItemWorldPosition),
    );
    assert.deepEqual(
      vector3(presenter.resumeButton.node.position),
      withZ(presenter.layout.resumeHidden),
    );
    assert.deepEqual(
      vector3(presenter.replayButton.node.position),
      withZ(presenter.layout.replayHidden),
    );
    assert.deepEqual(
      vector3(presenter.quitButton.node.position),
      withZ(presenter.layout.quitHidden),
    );

    const parent = new cc.Node('Parent');
    parent.layer = 29;
    parent.setPosition(100, 200, 0);
    presenter.attach(parent as never);

    assert.deepEqual(parent.children.map(({ name }) => name), [
      'BaseGameplayPauseOverlay',
      'BaseGameplayPauseMenu',
      'BaseGameplayPauseOptionsMenu',
    ]);
    assert.deepEqual(
      parent.children.map(({ lastRequestedSiblingIndex }) => lastRequestedSiblingIndex),
      [1, 2, 3],
    );
    assert.equal(presenter.objectiveOverlay.node.active, false);
    assert.equal(presenter.pauseMenu.node.active, true);
    assert.equal(presenter.optionsMenu.node.active, false);
    assert.equal(owned.every(({ layer }) => layer === 29), true);
    for (const root of parent.children) {
      assert.deepEqual(vector3(root.worldPosition), { x: 0, y: 0, z: 0 });
    }
    assert.deepEqual(
      vector3(presenter.objectiveBackground.node.worldPosition),
      withZ(presenter.layout.objectiveBackgroundWorldPosition),
    );
    assert.deepEqual(presenter.snapshot, {
      card: EMPTY_CARD,
      directorPauseOwned: false,
      disposed: false,
      objectiveOverlayVisible: false,
      optionsMenuEnabled: false,
      optionsMenuVisible: false,
      pauseMenuEnabled: true,
      pauseMenuVisible: true,
      pendingCallbackCount: 0,
      pendingMoveCount: 0,
      quitPosition: presenter.layout.quitHidden,
      replayPosition: presenter.layout.replayHidden,
      resumePosition: presenter.layout.resumeHidden,
    });
  }
});

test('button touches swap exact frames and emit unguarded typed intents only while enabled', () => {
  resetRuntime();
  const harness = createHarness('480x800');
  const { presenter, resources } = harness;

  presenter.pauseButton.node.emit(cc.Node.EventType.TOUCH_START);
  presenter.pauseButton.node.emit(cc.Node.EventType.TOUCH_END);
  assert.deepEqual(harness.events, []);
  assert.equal(
    presenter.pauseButton.sprite.spriteFrame,
    resources.pause.pauseNormal.spriteFrame,
  );

  presenter.attach(new cc.Node('Parent') as never);
  presenter.pauseButton.node.emit(cc.Node.EventType.TOUCH_START);
  assert.equal(
    presenter.pauseButton.sprite.spriteFrame,
    resources.pause.pauseSelected.spriteFrame,
  );
  presenter.pauseButton.node.emit(cc.Node.EventType.TOUCH_CANCEL);
  assert.equal(
    presenter.pauseButton.sprite.spriteFrame,
    resources.pause.pauseNormal.spriteFrame,
  );
  presenter.pauseButton.node.emit(cc.Node.EventType.TOUCH_START);
  presenter.pauseButton.node.emit(cc.Node.EventType.TOUCH_END);
  assert.deepEqual(harness.events, ['pause-requested']);
  assert.equal(
    presenter.pauseButton.sprite.spriteFrame,
    resources.pause.pauseNormal.spriteFrame,
  );

  presenter.pauseIngress(EMPTY_CARD);
  presenter.pauseButton.node.emit(cc.Node.EventType.TOUCH_START);
  presenter.pauseButton.node.emit(cc.Node.EventType.TOUCH_END);
  assert.deepEqual(harness.events, ['pause-requested']);

  for (const [button, selected, normal, expectedEvent] of [
    [
      presenter.resumeButton,
      resources.pause.resumeSelected,
      resources.pause.resumeNormal,
      'resume-requested',
    ],
    [
      presenter.replayButton,
      resources.pause.replaySelected,
      resources.pause.replayNormal,
      'replay-requested',
    ],
    [
      presenter.quitButton,
      resources.pause.quitSelected,
      resources.pause.quitNormal,
      'quit-requested',
    ],
  ] as const) {
    button.node.emit(cc.Node.EventType.TOUCH_START);
    assert.equal(button.sprite.spriteFrame, selected.spriteFrame);
    assert.deepEqual(size(button.transform.contentSize), selected.dimensions);
    button.node.emit(cc.Node.EventType.TOUCH_END);
    assert.equal(button.sprite.spriteFrame, normal.spriteFrame);
    assert.deepEqual(size(button.transform.contentSize), normal.dimensions);
    assert.equal(harness.events.at(-1), expectedEvent);
  }

  presenter.replayButton.node.emit(cc.Node.EventType.TOUCH_END);
  presenter.replayButton.node.emit(cc.Node.EventType.TOUCH_END);
  assert.deepEqual(harness.events.filter((event) => event === 'replay-requested'), [
    'replay-requested',
    'replay-requested',
    'replay-requested',
  ]);
});

test('ingress, refresh, pause callback, resume, and egress project the pure clock exactly', () => {
  resetRuntime();
  const harness = createHarness('480x800');
  const { presenter } = harness;
  presenter.attach(new cc.Node('Parent') as never);
  const descriptionPosition = vector3(presenter.descriptionLabel.node.position);
  const rewardPosition = vector3(presenter.rewardLabel.node.position);

  presenter.pauseIngress(PROGRESS_CARD);
  assert.deepEqual(cc.directorCalls, []);
  assert.equal(presenter.descriptionLabel.label.string, PROGRESS_CARD.description);
  assert.equal(presenter.progressLabel.label.string, PROGRESS_CARD.progress);
  assert.equal(presenter.rewardLabel.label.string, PROGRESS_CARD.reward);
  assert.deepEqual(vector3(presenter.descriptionLabel.node.position), descriptionPosition);
  assert.deepEqual(vector3(presenter.rewardLabel.node.position), rewardPosition);
  assert.equal(presenter.objectiveOverlay.node.active, true);
  assert.equal(presenter.pauseMenu.node.active, false);
  assert.equal(presenter.optionsMenu.node.active, true);
  assert.equal(presenter.snapshot.pauseMenuEnabled, false);
  assert.equal(presenter.snapshot.optionsMenuEnabled, true);

  presenter.updateAction(0.125);
  assert.deepEqual(cc.directorCalls, []);
  assert.deepEqual(vector3(presenter.resumeButton.node.position), {
    x: average(presenter.layout.resumeHidden.x, presenter.layout.resumeShown.x),
    y: presenter.layout.resumeShown.y,
    z: 0,
  });
  assert.deepEqual(vector3(presenter.replayButton.node.position), {
    x: average(presenter.layout.replayHidden.x, presenter.layout.replayShown.x),
    y: presenter.layout.replayShown.y,
    z: 0,
  });

  presenter.updateAction(0.125);
  assert.deepEqual(cc.directorCalls, ['pause']);
  assert.equal(presenter.snapshot.directorPauseOwned, true);
  assert.deepEqual(
    vector3(presenter.quitButton.node.position),
    withZ(presenter.layout.quitShown),
  );

  presenter.resumeEgress();
  assert.deepEqual(cc.directorCalls, ['pause', 'resume']);
  assert.equal(presenter.snapshot.directorPauseOwned, false);
  assert.equal(presenter.objectiveOverlay.node.active, false);
  assert.equal(presenter.pauseMenu.node.active, true);
  assert.equal(presenter.optionsMenu.node.active, true);
  assert.equal(presenter.snapshot.pauseMenuEnabled, true);
  assert.equal(presenter.snapshot.optionsMenuEnabled, true);

  presenter.updateAction(0.125);
  assert.equal(presenter.optionsMenu.node.active, true);
  presenter.updateAction(0.125);
  assert.equal(presenter.optionsMenu.node.active, false);
  assert.equal(presenter.snapshot.optionsMenuEnabled, false);
  assert.deepEqual(
    vector3(presenter.resumeButton.node.position),
    withZ(presenter.layout.resumeHidden),
  );
  assert.deepEqual(
    vector3(presenter.replayButton.node.position),
    withZ(presenter.layout.replayHidden),
  );
  assert.deepEqual(
    vector3(presenter.quitButton.node.position),
    withZ(presenter.layout.quitHidden),
  );
});

test('early resume leaves ingress live, permits overlapping option intents, and can pause later', () => {
  resetRuntime();
  const harness = createHarness('720x1280');
  const { presenter } = harness;
  presenter.attach(new cc.Node('Parent') as never);
  presenter.pauseIngress(EMPTY_CARD);
  presenter.updateAction(0.1);

  presenter.resumeEgress();
  assert.deepEqual(cc.directorCalls, ['resume']);
  presenter.updateAction(0.15);
  assert.deepEqual(cc.directorCalls, ['resume', 'pause']);
  assert.equal(presenter.snapshot.directorPauseOwned, true);
  assert.equal(presenter.snapshot.optionsMenuEnabled, true);
  assert.equal(presenter.optionsMenu.node.active, true);
  assert.equal(presenter.snapshot.pendingCallbackCount, 1);

  presenter.replayButton.node.emit(cc.Node.EventType.TOUCH_END);
  presenter.quitButton.node.emit(cc.Node.EventType.TOUCH_END);
  presenter.replayButton.node.emit(cc.Node.EventType.TOUCH_END);
  assert.deepEqual(harness.events, [
    'replay-requested',
    'quit-requested',
    'replay-requested',
  ]);

  presenter.stopAllActions();
  presenter.updateAction(10);
  assert.equal(presenter.snapshot.pendingCallbackCount, 0);
  assert.equal(presenter.optionsMenu.node.active, true);
  assert.equal(presenter.dispose(), true);
  assert.deepEqual(cc.directorCalls, ['resume', 'pause', 'resume']);
});

test('disabled menus clear held selected frames before a later reactivation', () => {
  resetRuntime();
  const harness = createHarness('480x800');
  const { presenter, resources } = harness;
  presenter.attach(new cc.Node('Parent') as never);

  presenter.pauseButton.node.emit(cc.Node.EventType.TOUCH_START);
  assert.equal(
    presenter.pauseButton.sprite.spriteFrame,
    resources.pause.pauseSelected.spriteFrame,
  );
  presenter.pauseIngress(EMPTY_CARD);
  assert.equal(
    presenter.pauseButton.sprite.spriteFrame,
    resources.pause.pauseNormal.spriteFrame,
  );

  presenter.resumeButton.node.emit(cc.Node.EventType.TOUCH_START);
  assert.equal(
    presenter.resumeButton.sprite.spriteFrame,
    resources.pause.resumeSelected.spriteFrame,
  );
  presenter.resumeEgress();
  presenter.updateAction(0.25);
  assert.equal(presenter.optionsMenu.node.active, false);
  assert.equal(
    presenter.resumeButton.sprite.spriteFrame,
    resources.pause.resumeNormal.spriteFrame,
  );

  presenter.pauseIngress(EMPTY_CARD);
  assert.equal(presenter.optionsMenu.node.active, true);
  assert.equal(
    presenter.resumeButton.sprite.spriteFrame,
    resources.pause.resumeNormal.spriteFrame,
  );
});

test('stop and disposal cancel callbacks, remove listeners, destroy visuals, and resume only owned pause', () => {
  resetRuntime();
  const externalPause = createHarness('480x800');
  const externalOwned = [...cc.createdNodes];
  cc.director.pause();
  assert.equal(externalPause.presenter.dispose(), true);
  assert.equal(externalPause.presenter.dispose(), false);
  assert.deepEqual(cc.directorCalls, ['pause']);
  assert.equal(externalOwned.every(({ destroyed }) => destroyed), true);

  resetRuntime();
  const pending = createHarness('480x800');
  const pendingOwned = [...cc.createdNodes];
  pending.presenter.attach(new cc.Node('Parent') as never);
  pending.presenter.pauseIngress(EMPTY_CARD);
  pending.presenter.stopAllActions();
  pending.presenter.updateAction(10);
  assert.deepEqual(cc.directorCalls, []);
  assert.equal(pending.presenter.dispose(), true);
  assert.deepEqual(cc.directorCalls, []);
  assert.equal(pendingOwned.every(({ destroyed }) => destroyed), true);
  assert.equal(pending.presenter.isDisposed, true);
  assert.equal(pending.presenter.isAttached, false);
  for (const node of [
    pending.presenter.pauseButton.node,
    pending.presenter.resumeButton.node,
    pending.presenter.replayButton.node,
    pending.presenter.quitButton.node,
  ]) {
    for (const event of Object.values(cc.Node.EventType)) {
      assert.equal(node.listenerCount(event), 0);
    }
  }
  pending.presenter.pauseButton.node.emit(cc.Node.EventType.TOUCH_END);
  assert.deepEqual(pending.events, []);
  assert.throws(
    () => pending.presenter.attach(new cc.Node('Other') as never),
    /Disposed/,
  );

  resetRuntime();
  const ownedPause = createHarness('720x1280');
  ownedPause.presenter.attach(new cc.Node('Parent') as never);
  ownedPause.presenter.pauseIngress(EMPTY_CARD);
  ownedPause.presenter.updateAction(0.25);
  assert.deepEqual(cc.directorCalls, ['pause']);
  assert.equal(ownedPause.presenter.dispose(), true);
  assert.deepEqual(cc.directorCalls, ['pause', 'resume']);
});

test('second and third root attachment failures roll back fully and remain retryable', () => {
  for (const failure of ['second-parent', 'third-sibling'] as const) {
    resetRuntime();
    const harness = createHarness('720x1280');
    const { presenter } = harness;
    const owned = [...cc.createdNodes];
    const parent = new cc.Node('OffsetParent');
    parent.layer = 47;
    parent.setPosition(100, 200, 0);
    if (failure === 'second-parent') {
      (presenter.pauseMenu.node as unknown as StubNode).failNextSetParent = true;
    } else {
      (presenter.optionsMenu.node as unknown as StubNode)
        .failNextSetSiblingIndex = true;
    }

    assert.throws(
      () => presenter.attach(parent as never),
      /injected setParent failure|injected setSiblingIndex failure/,
    );
    assert.equal(presenter.isAttached, false);
    assert.equal(presenter.isDisposed, false);
    assert.deepEqual(parent.children, []);
    for (const root of [
      presenter.objectiveOverlay.node,
      presenter.pauseMenu.node,
      presenter.optionsMenu.node,
    ]) {
      assert.equal(root.parent, null);
      assert.equal(root.active, false);
      assert.deepEqual(vector3(root.worldPosition), { x: 0, y: 0, z: 0 });
    }
    assert.equal(owned.every(({ layer }) => layer === 0), true);

    presenter.attach(parent as never);
    assert.equal(presenter.isAttached, true);
    assert.deepEqual(parent.children.map(({ name }) => name), [
      'BaseGameplayPauseOverlay',
      'BaseGameplayPauseMenu',
      'BaseGameplayPauseOptionsMenu',
    ]);
    assert.equal(owned.every(({ layer }) => layer === 47), true);
    assert.equal(presenter.dispose(), true);
  }
});

test('input, exact resources, lifecycle callbacks, attachment, and deltas fail closed', () => {
  resetRuntime();
  const harness = createHarness('480x800');
  const intents = createIntents([]);
  assert.throws(
    () => BaseGameplayPausePresenter.create(null as never, intents),
    /input must be an object/,
  );
  assert.throws(
    () => BaseGameplayPausePresenter.create({
      ...harness.input,
      viewport: { ...harness.input.viewport, width: 0 },
    } as never, intents),
    /viewport.width/,
  );
  assert.throws(
    () => BaseGameplayPausePresenter.create({
      ...harness.input,
      resources: {
        ...harness.resources,
        pause: {
          ...harness.resources.pause,
          pauseSelected: loadedResources('720x1280').pause.pauseSelected,
        },
      },
    } as never, intents),
    /pauseSelected.*exact recovered/,
  );
  const trimmed = new cc.SpriteFrame(
    harness.resources.pause.quitNormal.dimensions.width,
    harness.resources.pause.quitNormal.dimensions.height,
  );
  trimmed.rect = { width: 1, height: 1 };
  assert.throws(
    () => BaseGameplayPausePresenter.create({
      ...harness.input,
      resources: {
        ...harness.resources,
        pause: {
          ...harness.resources.pause,
          quitNormal: {
            ...harness.resources.pause.quitNormal,
            spriteFrame: trimmed,
          },
        },
      },
    } as never, intents),
    /quitNormal.*untrimmed/,
  );
  assert.throws(
    () => BaseGameplayPausePresenter.create(harness.input as never, {
      ...intents,
      onQuitRequested: null,
    } as never),
    /onQuitRequested must be a function/,
  );

  const presenter = BaseGameplayPausePresenter.create(
    harness.input as never,
    intents,
  );
  assert.throws(() => presenter.pauseIngress(EMPTY_CARD), /must be attached/);
  assert.throws(() => presenter.resumeEgress(), /must be attached/);
  assert.throws(() => presenter.updateAction(0), /must be attached/);
  const inactive = new cc.Node('Inactive');
  inactive.active = false;
  assert.throws(() => presenter.attach(inactive as never), /valid and active/);
  presenter.attach(new cc.Node('Parent') as never);
  assert.throws(() => presenter.attach(new cc.Node('Other') as never), /already attached/);
  assert.throws(() => presenter.updateAction(-1), /non-negative/);
  assert.throws(() => presenter.updateAction(Number.NaN), /finite/);

  const beforeInvalidIngress = presenter.snapshot;
  assert.throws(
    () => presenter.pauseIngress({
      ...EMPTY_CARD,
      reward: 1,
    } as never),
    /objective card reward must be a string/,
  );
  assert.deepEqual(presenter.snapshot, beforeInvalidIngress);
  assert.equal(presenter.objectiveOverlay.node.active, false);
  assert.equal(presenter.pauseMenu.node.active, true);
  assert.equal(presenter.optionsMenu.node.active, false);
  presenter.updateAction(0.25);
  assert.deepEqual(cc.directorCalls, []);
});

function createHarness(
  assetTree: GameAssetTree,
  intentOverrides: Partial<ReturnType<typeof createIntents>> = {},
): Harness {
  const events: string[] = [];
  const resources = loadedResources(assetTree);
  const input = Object.freeze({
    contentScaleFactor: 1,
    initialCard: EMPTY_CARD,
    resources,
    viewport: Object.freeze(assetTree === '480x800'
      ? { height: 800, width: 480 }
      : { height: 1280, width: 720 }),
  });
  const presenter = BaseGameplayPausePresenter.create(
    input as never,
    { ...createIntents(events), ...intentOverrides },
  );
  return {
    events,
    font: resources.arialFont.font,
    input,
    presenter,
    resources,
  };
}

function createIntents(events: string[]) {
  return {
    onPauseRequested: () => events.push('pause-requested'),
    onQuitRequested: () => events.push('quit-requested'),
    onReplayRequested: () => events.push('replay-requested'),
    onResumeRequested: () => events.push('resume-requested'),
  };
}

function loadedResources(assetTree: GameAssetTree): LoadedResources {
  const profile = getBaseGameplayResourceProfile(assetTree);
  return Object.freeze({
    arialFont: Object.freeze({
      ...BASE_GAMEPLAY_ARIAL_FONT_RESOURCE,
      font: new cc.Font(),
    }),
    assetTree,
    objectiveAchievement: Object.freeze({
      completedMessage: loadedRaster(profile.objectiveAchievement.completedMessage),
      nextMessage: loadedRaster(profile.objectiveAchievement.nextMessage),
      xmasFive: loadedRaster(profile.objectiveAchievement.xmasFive),
      xmasFour: loadedRaster(profile.objectiveAchievement.xmasFour),
    }),
    pause: Object.freeze({
      objectiveBackground: loadedRaster(profile.pause.objectiveBackground),
      pauseNormal: loadedRaster(profile.pause.pauseNormal),
      pauseSelected: loadedRaster(profile.pause.pauseSelected),
      quitNormal: loadedRaster(profile.pause.quitNormal),
      quitSelected: loadedRaster(profile.pause.quitSelected),
      replayNormal: loadedRaster(profile.pause.replayNormal),
      replaySelected: loadedRaster(profile.pause.replaySelected),
      resumeNormal: loadedRaster(profile.pause.resumeNormal),
      resumeSelected: loadedRaster(profile.pause.resumeSelected),
    }),
  });
}

function loadedRaster(resource: GameRasterResource): LoadedRaster {
  return Object.freeze({
    ...resource,
    spriteFrame: new cc.SpriteFrame(
      resource.dimensions.width,
      resource.dimensions.height,
    ),
  });
}

function assertPresentedLabel(
  presented: Readonly<{
    readonly label: unknown;
    readonly node: { readonly position: Readonly<{ x: number; y: number; z: number }> };
    readonly transform: {
      readonly anchorPoint: Readonly<{ x: number; y: number }>;
    };
  }>,
  font: StubFont,
  string: string,
  fontSize: number,
  anchor: Readonly<{ x: number; y: number }>,
  position: Readonly<{ x: number; y: number }>,
): void {
  const label = presented.label as StubLabel;
  assert.equal(label.font, font);
  assert.equal(label.string, string);
  assert.equal(label.fontSize, fontSize);
  assert.equal(label.lineHeight, fontSize);
  assert.deepEqual(color(label.color), { a: 255, b: 255, g: 255, r: 255 });
  assert.deepEqual(point(presented.transform.anchorPoint), anchor);
  assert.deepEqual(vector3(presented.node.position), withZ(position));
}

function resetRuntime(): void {
  cc.resetCreatedNodes();
  cc.resetDirectorCalls();
}

function average(left: number, right: number): number {
  return (left + right) / 2;
}

function centeredLocal(
  lowerLeftPosition: Readonly<{ x: number; y: number }>,
  parentDimensions: Readonly<{ height: number; width: number }>,
): Readonly<{ x: number; y: number }> {
  return {
    x: lowerLeftPosition.x - parentDimensions.width * 0.5,
    y: lowerLeftPosition.y - parentDimensions.height * 0.5,
  };
}

function color(value: StubColor): StubColor {
  return { a: value.a, b: value.b, g: value.g, r: value.r };
}

function point(
  value: Readonly<{ x: number; y: number }>,
): Readonly<{ x: number; y: number }> {
  return { x: value.x, y: value.y };
}

function size(
  value: Readonly<{ height: number; width: number }>,
): Readonly<{ height: number; width: number }> {
  return { height: value.height, width: value.width };
}

function vector3(
  value: Readonly<{ x: number; y: number; z: number }>,
): Readonly<{ x: number; y: number; z: number }> {
  return { x: value.x, y: value.y, z: value.z };
}

function withZ(
  value: Readonly<{ x: number; y: number }>,
): Readonly<{ x: number; y: number; z: number }> {
  return { ...value, z: 0 };
}
