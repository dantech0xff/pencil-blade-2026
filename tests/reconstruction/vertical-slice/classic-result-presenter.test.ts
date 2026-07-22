import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

import {
  CLASSIC_RESULT_FONT_RESOURCES,
  getClassicResultResources,
  type ClassicRasterResource,
} from '../../../game/assets/scripts/domain/classic-resource-contract.ts';
import {
  CLASSIC_RESULT_PURPLE,
  CLASSIC_RESULT_WHITE,
} from '../../../game/assets/scripts/domain/classic-result-presentation.ts';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const createdNodes = [];
export function resetCreatedNodes() { createdNodes.length = 0; }

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
    this.anchorPoint = { x: 0, y: 0 };
    this.contentSize = new Size();
  }
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
  setContentSize(width, height) { this.contentSize = new Size(width, height); }
}

export class Sprite {
  constructor() {
    this.color = new Color(255, 255, 255, 255);
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
    this.eulerAngles = { x: 0, y: 0, z: 0 };
    this.events = new Map();
    this.lastRequestedSiblingIndex = null;
    this.layer = 0;
    this.name = name;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
    this.worldPositionRequests = [];
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
  setWorldPosition(x, y, z) {
    this.worldPositionRequests.push({ x, y, z });
    const parent = this.parent === null
      ? { x: 0, y: 0, z: 0 }
      : this.parent.worldPosition;
    this.position = { x: x - parent.x, y: y - parent.y, z: z - parent.z };
  }
  setScale(x, y, z) { this.scale = { x, y, z }; }
  setRotationFromEuler(x, y, z) { this.eulerAngles = { x, y, z }; }
  setSiblingIndex(index) {
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
const { ClassicResultPresenter } = await import(
  '../../../game/assets/scripts/creator/classic-result-presenter.ts'
);

type AssetTree = '480x800' | '720x1280';

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
  readonly isValid: (value: unknown) => boolean;
  readonly resetCreatedNodes: () => void;
}

interface StubColor {
  readonly a: number;
  readonly b: number;
  readonly g: number;
  readonly r: number;
}

interface StubFont {
  destroyed: boolean;
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
  readonly eulerAngles: Readonly<{ x: number; y: number; z: number }>;
  lastRequestedSiblingIndex: number | null;
  layer: number;
  readonly name: string;
  readonly parent: StubNode | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly scale: Readonly<{ x: number; y: number; z: number }>;
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

interface LoadedRaster extends ClassicRasterResource {
  readonly spriteFrame: StubSpriteFrame;
}

interface Harness {
  readonly agencyFont: StubFont;
  readonly events: string[];
  readonly input: ResultInput;
  readonly presenter: InstanceType<typeof ClassicResultPresenter>;
  readonly resources: LoadedResultResources;
  readonly slabFont: StubFont;
}

interface LoadedResultResources {
  readonly background: LoadedRaster;
  readonly bonusCoinsBadge: LoadedRaster;
  readonly bonusCoinsEffect: LoadedRaster;
  readonly bonusParticle: LoadedRaster;
  readonly coin: LoadedRaster;
  readonly header: LoadedRaster;
  readonly medalNone: LoadedRaster;
  readonly menuNormal: LoadedRaster;
  readonly menuSelected: LoadedRaster;
  readonly retryNormal: LoadedRaster;
  readonly retrySelected: LoadedRaster;
  readonly totalCoins: LoadedRaster;
}

interface ResultInput {
  readonly completedRunScore: number;
  readonly fonts: Readonly<{
    readonly agencyB: Readonly<{ canonicalPath: string; font: StubFont }>;
    readonly slabThing: Readonly<{ canonicalPath: string; font: StubFont }>;
  }>;
  readonly panelValues: readonly [number, number, number];
  readonly random: Readonly<{
    nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number;
  }>;
  readonly resources: LoadedResultResources;
  readonly totalCoins: number;
  readonly viewport: Readonly<{ height: number; width: number; x: number; y: number }>;
}

test('both asset trees construct exact native-order sibling visuals, resources, fonts, and text', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    cc.resetCreatedNodes();
    let boundaryCalls = 0;
    let nodesAtBoundary: readonly string[] = [];
    const harness = createHarness(assetTree, {
      onRankPresentationBoundary: () => {
        boundaryCalls += 1;
        nodesAtBoundary = cc.createdNodes.map(({ name }) => name);
      },
    });
    const { presenter, resources } = harness;
    const owned = [...cc.createdNodes];

    assert.equal(boundaryCalls, 1);
    assert.deepEqual(nodesAtBoundary, [
      'ClassicResultScorePanel',
      'ClassicResultScoreLabel',
      'ClassicResultHeader',
      'ClassicResultRetryButton',
      'ClassicResultMenuButton',
      'ClassicResultMedalNone',
    ]);

    assert.deepEqual(owned.map(({ name }) => name), [
      'ClassicResultScorePanel',
      'ClassicResultScoreLabel',
      'ClassicResultHeader',
      'ClassicResultRetryButton',
      'ClassicResultMenuButton',
      'ClassicResultMedalNone',
      'ClassicResultPanelLabel-1',
      'ClassicResultPanelLabel-2',
      'ClassicResultPanelLabel-3',
      'ClassicResultTotalCoinsPanel',
      'ClassicResultParticleExplosion',
      'ClassicResultTotalCoinsLabel',
    ]);
    assert.equal(owned.some(({ name }) => name.includes('Reward')), false);
    assert.equal(owned.length, 12);

    for (const [visual, resource] of [
      [presenter.scorePanel, resources.background],
      [presenter.resultHeader, resources.header],
      [presenter.retryButton, resources.retryNormal],
      [presenter.menuButton, resources.menuNormal],
      [presenter.medalNone, resources.medalNone],
      [presenter.totalCoinsPanel, resources.totalCoins],
    ] as const) {
      assert.equal(visual.node.active, false);
      assert.equal(visual.sprite.sizeMode, 2);
      assert.equal(visual.sprite.spriteFrame, resource.spriteFrame);
      assert.deepEqual(size(visual.transform.contentSize), resource.dimensions);
      assert.deepEqual(point(visual.transform.anchorPoint), { x: 0.5, y: 0.5 });
      assert.equal(visual.opacity.opacity, 0);
    }
    assert.deepEqual(vector3(presenter.medalNone.node.scale), { x: 0.5, y: 0.5, z: 1 });

    assertLabel(
      presenter.mainScoreLabel.label as unknown as StubLabel,
      harness.agencyFont,
      presenter.layout.mainScoreLabel.fontSize,
      'Score: 321',
      CLASSIC_RESULT_PURPLE,
    );
    assert.deepEqual(
      point(presenter.mainScoreLabel.transform.anchorPoint),
      presenter.layout.mainScoreLabel.anchor,
    );
    for (let index = 0; index < presenter.panelLabels.length; index += 1) {
      assertLabel(
        presenter.panelLabels[index].label as unknown as StubLabel,
        harness.agencyFont,
        presenter.layout.panelLabels[index].fontSize,
        String([33, 22, 11][index]),
        CLASSIC_RESULT_WHITE,
      );
      assert.deepEqual(
        point(presenter.panelLabels[index].transform.anchorPoint),
        presenter.layout.panelLabels[index].anchor,
      );
      assert.equal(
        (presenter.panelLabels[index].node as unknown as StubNode).getComponent(cc.UIOpacity),
        null,
      );
    }
    assertLabel(
      presenter.totalCoinsLabel.label as unknown as StubLabel,
      harness.slabFont,
      presenter.layout.totalCoinsLabel.fontSize,
      '777',
      CLASSIC_RESULT_WHITE,
    );
    assert.deepEqual(
      point(presenter.totalCoinsLabel.transform.anchorPoint),
      presenter.layout.totalCoinsLabel.anchor,
    );
    assert.equal(
      (presenter.totalCoinsLabel.node as unknown as StubNode).getComponent(cc.UIOpacity),
      null,
    );

    const parent = new cc.Node('OffsetParent');
    parent.layer = 27;
    parent.setPosition(100, 200, 0);
    presenter.attach(parent as never);

    assert.deepEqual(parent.children.map(({ name }) => name), owned.map(({ name }) => name));
    assert.deepEqual(owned.map(({ lastRequestedSiblingIndex }) => lastRequestedSiblingIndex), [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11,
    ]);
    for (const node of owned) {
      assert.equal(node.layer, 27);
      assert.equal(node.parent, parent);
      assert.equal(node.active, true);
    }
    assert.deepEqual(
      vector3(presenter.scorePanel.node.worldPosition),
      withZ(presenter.layout.scorePanel.initial.worldPosition),
    );
    assert.deepEqual(
      vector3(presenter.mainScoreLabel.node.worldPosition),
      withZ(presenter.layout.mainScoreLabel.worldPosition),
    );
    assert.deepEqual(
      vector3(presenter.resultHeader.node.worldPosition),
      withZ(presenter.layout.resultHeader.initial.worldPosition),
    );
    assert.deepEqual(
      vector3(presenter.retryButton.node.worldPosition),
      withZ(presenter.layout.retryButton.initial.worldPosition),
    );
    assert.deepEqual(
      vector3(presenter.menuButton.node.worldPosition),
      withZ(presenter.layout.menuButton.initial.worldPosition),
    );
    assert.deepEqual(
      vector3(presenter.medalNone.node.worldPosition),
      withZ(presenter.layout.medalNone.initial.worldPosition),
    );
    assert.deepEqual(
      vector3(presenter.totalCoinsPanel.node.worldPosition),
      withZ(presenter.layout.totalCoinsPanel.initial.worldPosition),
    );
    for (let index = 0; index < presenter.panelLabels.length; index += 1) {
      assert.deepEqual(vector3(presenter.panelLabels[index].node.worldPosition), {
        x: presenter.layout.scorePanel.initial.worldPosition.x
          + presenter.layout.panelLabels[index].creatorLocalPosition.x,
        y: presenter.layout.scorePanel.initial.worldPosition.y
          + presenter.layout.panelLabels[index].creatorLocalPosition.y,
        z: 0,
      });
    }
    assertTotalCoinsLabelTracksPanel(presenter);
  }
});

test('score, shell, and total-coins actions preserve exact independent durations and callback order', () => {
  const callbackStates: Array<Readonly<{ complete: boolean; x: number }>> = [];
  let presenter: InstanceType<typeof ClassicResultPresenter>;
  const harness = createHarness('480x800', {
    onTotalCoinsEntranceComplete: () => {
      callbackStates.push({
        complete: presenter.state.totalCoinsEntranceComplete,
        x: presenter.totalCoinsPanel.node.worldPosition.x,
      });
      return 24;
    },
  });
  presenter = harness.presenter;
  presenter.attach(new cc.Node('Parent') as never);

  const panelLabelsAtStart = presenter.panelLabels.map(({ node }) => vector3(node.worldPosition));
  presenter.updateAction(0.375);
  assert.equal(presenter.scorePanel.opacity.opacity, 127.5);
  assert.equal(presenter.resultHeader.opacity.opacity, 255 * 0.375);
  assert.equal(presenter.retryButton.opacity.opacity, 255 * 0.375);
  assert.equal(presenter.menuButton.opacity.opacity, 255 * 0.375);
  assert.equal(presenter.medalNone.opacity.opacity, 255 * 0.375);
  assert.deepEqual(vector3(presenter.medalNone.node.scale), {
    x: 0.6875,
    y: 0.6875,
    z: 1,
  });
  assert.equal(
    presenter.totalCoinsPanel.opacity.opacity,
    255 * (0.375 / presenter.layout.totalCoinsPanel.actionSeconds),
  );
  assert.deepEqual(
    presenter.panelLabels.map(({ node }) => vector3(node.worldPosition)),
    panelLabelsAtStart,
  );
  assertTotalCoinsLabelTracksPanel(presenter);
  assert.deepEqual(callbackStates, []);

  presenter.updateAction(0.375);
  assert.equal(presenter.scorePanel.opacity.opacity, 255);
  assert.equal(presenter.state.scorePanelElapsedActionSeconds, 0.75);
  presenter.updateAction(0.25);
  assert.equal(presenter.state.shellElapsedActionSeconds, 1);
  assert.deepEqual(
    vector3(presenter.resultHeader.node.worldPosition),
    withZ(presenter.layout.resultHeader.final.worldPosition),
  );
  assert.deepEqual(
    vector3(presenter.retryButton.node.worldPosition),
    withZ(presenter.layout.retryButton.final.worldPosition),
  );
  assert.deepEqual(
    vector3(presenter.menuButton.node.worldPosition),
    withZ(presenter.layout.menuButton.final.worldPosition),
  );
  assert.deepEqual(vector3(presenter.medalNone.node.scale), { x: 1, y: 1, z: 1 });
  assert.deepEqual(callbackStates, []);

  presenter.updateAction(0.75);
  assert.equal(presenter.state.totalCoinsElapsedActionSeconds, 1.75);
  assert.equal(presenter.state.totalCoinsEntranceComplete, true);
  assert.equal(presenter.totalCoinsPanel.opacity.opacity, 255);
  assert.deepEqual(
    vector3(presenter.totalCoinsPanel.node.worldPosition),
    withZ(presenter.layout.totalCoinsPanel.final.worldPosition),
  );
  assertTotalCoinsLabelTracksPanel(presenter);
  assert.deepEqual(callbackStates, [{
    complete: true,
    x: presenter.layout.totalCoinsPanel.final.worldPosition.x,
  }]);
  assert.equal(presenter.rewardPresenter.state.bonusCoins, 24);
  assert.equal(presenter.rewardPresenter.bonusLabel?.label.string, '24');
  presenter.updateAction(10);
  presenter.updateAction(0);
  assert.equal(callbackStates.length, 1);
});

test('one overshooting action tick lands every node exactly and completes total coins once', () => {
  let presenter: InstanceType<typeof ClassicResultPresenter>;
  let rewardBoundary: Readonly<{
    readonly awardAttempted: boolean;
    readonly bonusLabelAbsent: boolean;
    readonly particleCount: number;
    readonly particleDisposed: boolean;
    readonly presenting: boolean;
  }> | null = null;
  const harness = createHarness('720x1280', {
    onTotalCoinsEntranceComplete: () => {
      rewardBoundary = Object.freeze({
        awardAttempted: presenter.rewardPresenter.state.awardAttempted,
        bonusLabelAbsent: presenter.rewardPresenter.bonusLabel === null,
        particleCount: presenter.particleExplosionPresenter.state.particleCount,
        particleDisposed: presenter.particleExplosionPresenter.state.disposed,
        presenting: presenter.rewardPresenter.state.presenting,
      });
      harness.events.push('total-coins-complete');
      return 192;
    },
  });
  presenter = harness.presenter;
  harness.presenter.attach(new cc.Node('Parent') as never);
  harness.presenter.updateAction(100);

  assert.deepEqual(harness.presenter.state, {
    attached: true,
    disposed: false,
    navigation: 'none',
    particleBurstStarted: true,
    rewardPresented: true,
    scorePanelElapsedActionSeconds: 0.75,
    shellElapsedActionSeconds: 1,
    totalCoinsElapsedActionSeconds: 1.75,
    totalCoinsEntranceComplete: true,
  });
  assert.deepEqual(harness.events, ['total-coins-complete']);
  assert.deepEqual(rewardBoundary, {
    awardAttempted: true,
    bonusLabelAbsent: true,
    particleCount: 100,
    particleDisposed: false,
    presenting: true,
  });
  assert.equal(harness.presenter.particleExplosionPresenter.state.disposed, true);
  assert.equal(harness.presenter.rewardPresenter.state.bonusCoins, 192);
  assert.equal(
    harness.presenter.rewardPresenter.state.rotationDegrees,
    ((100 - 1.75) % 2.5) / 2.5 * 360,
  );
  for (const [presented, layout] of [
    [harness.presenter.scorePanel, harness.presenter.layout.scorePanel],
    [harness.presenter.resultHeader, harness.presenter.layout.resultHeader],
    [harness.presenter.retryButton, harness.presenter.layout.retryButton],
    [harness.presenter.menuButton, harness.presenter.layout.menuButton],
    [harness.presenter.medalNone, harness.presenter.layout.medalNone],
    [harness.presenter.totalCoinsPanel, harness.presenter.layout.totalCoinsPanel],
  ] as const) {
    assert.deepEqual(vector3(presented.node.worldPosition), withZ(layout.final.worldPosition));
    assert.deepEqual(vector3(presented.node.scale), {
      x: layout.final.scale,
      y: layout.final.scale,
      z: 1,
    });
    assert.equal(presented.opacity.opacity, layout.final.opacity);
  }
  assertTotalCoinsLabelTracksPanel(harness.presenter);
});

test('retry and menu use exact selected geometry and share a one-navigation guard', () => {
  const low = createHarness('480x800');
  low.presenter.retryButton.node.emit(cc.Node.EventType.TOUCH_START);
  assert.equal(low.presenter.retryButton.sprite.spriteFrame, low.resources.retryNormal.spriteFrame);
  low.presenter.attach(new cc.Node('LowParent') as never);

  low.presenter.retryButton.node.emit(cc.Node.EventType.TOUCH_START);
  assert.equal(low.presenter.retryButton.sprite.spriteFrame, low.resources.retrySelected.spriteFrame);
  assert.deepEqual(
    size(low.presenter.retryButton.transform.contentSize),
    low.resources.retrySelected.dimensions,
  );
  low.presenter.retryButton.node.emit(cc.Node.EventType.TOUCH_CANCEL);
  assert.equal(low.presenter.retryButton.sprite.spriteFrame, low.resources.retryNormal.spriteFrame);
  assert.deepEqual(
    size(low.presenter.retryButton.transform.contentSize),
    low.resources.retryNormal.dimensions,
  );
  assert.deepEqual(low.events, []);

  low.presenter.retryButton.node.emit(cc.Node.EventType.TOUCH_START);
  low.presenter.menuButton.node.emit(cc.Node.EventType.TOUCH_START);
  assert.equal(low.presenter.retryButton.sprite.spriteFrame, low.resources.retrySelected.spriteFrame);
  assert.equal(low.presenter.menuButton.sprite.spriteFrame, low.resources.menuSelected.spriteFrame);
  low.presenter.retryButton.node.emit(cc.Node.EventType.TOUCH_END);
  assert.deepEqual(low.events, ['retry']);
  assert.equal(low.presenter.state.navigation, 'retry');
  assert.equal(low.presenter.retryButton.sprite.spriteFrame, low.resources.retryNormal.spriteFrame);
  assert.equal(low.presenter.menuButton.sprite.spriteFrame, low.resources.menuNormal.spriteFrame);
  assert.deepEqual(
    size(low.presenter.menuButton.transform.contentSize),
    low.resources.menuNormal.dimensions,
  );
  low.presenter.menuButton.node.emit(cc.Node.EventType.TOUCH_START);
  assert.equal(low.presenter.menuButton.sprite.spriteFrame, low.resources.menuNormal.spriteFrame);
  low.presenter.menuButton.node.emit(cc.Node.EventType.TOUCH_END);
  low.presenter.retryButton.node.emit(cc.Node.EventType.TOUCH_END);
  assert.deepEqual(low.events, ['retry']);

  assert.equal(low.presenter.rearmNavigationAfterFailure('menu'), false);
  assert.equal(low.presenter.rearmNavigationAfterFailure('retry'), true);
  assert.equal(low.presenter.state.navigation, 'none');
  assert.throws(
    () => low.presenter.rearmNavigationAfterFailure('none' as never),
    /must be menu or retry/,
  );
  low.presenter.retryButton.node.emit(cc.Node.EventType.TOUCH_START);
  low.presenter.retryButton.node.emit(cc.Node.EventType.TOUCH_END);
  assert.deepEqual(low.events, ['retry', 'retry']);

  let high: Harness;
  high = createHarness('720x1280', {
    onMenu: () => {
      high.events.push('menu');
      high.presenter.retryButton.node.emit(cc.Node.EventType.TOUCH_END);
    },
  });
  high.presenter.attach(new cc.Node('HighParent') as never);
  high.presenter.menuButton.node.emit(cc.Node.EventType.TOUCH_START);
  assert.equal(high.presenter.menuButton.sprite.spriteFrame, high.resources.menuSelected.spriteFrame);
  assert.deepEqual(
    size(high.presenter.menuButton.transform.contentSize),
    high.resources.menuSelected.dimensions,
  );
  high.presenter.menuButton.node.emit(cc.Node.EventType.TOUCH_END);
  assert.equal(high.presenter.menuButton.sprite.spriteFrame, high.resources.menuNormal.spriteFrame);
  assert.deepEqual(
    size(high.presenter.menuButton.transform.contentSize),
    high.resources.menuNormal.dimensions,
  );
  assert.deepEqual(high.events, ['menu']);
  assert.equal(high.presenter.state.navigation, 'menu');
});

test('resources, fonts, viewport, values, lifecycle, and parent all validate fail-closed', () => {
  const harness = createHarness('480x800');
  const input = harness.input;
  const lifecycle = lifecycleCallbacks([]);

  assert.throws(
    () => ClassicResultPresenter.create(null as never, lifecycle),
    /input must be an object/,
  );
  assert.throws(() => ClassicResultPresenter.create({
    ...input,
    completedRunScore: 0.5,
  } as never, lifecycle), /safe integer/);
  assert.throws(() => ClassicResultPresenter.create({
    ...input,
    panelValues: [1, 2],
  } as never, lifecycle), /exactly three/);
  assert.throws(() => ClassicResultPresenter.create({
    ...input,
    panelValues: [1, Number.NaN, 3],
  } as never, lifecycle), /panelValues\[1\].*safe integer/);
  assert.throws(() => ClassicResultPresenter.create({
    ...input,
    totalCoins: Number.MAX_SAFE_INTEGER + 1,
  } as never, lifecycle), /totalCoins.*safe integer/);
  assert.throws(() => ClassicResultPresenter.create({
    ...input,
    viewport: { ...input.viewport, width: 0 },
  } as never, lifecycle), /viewport.width/);

  assert.throws(() => ClassicResultPresenter.create({
    ...input,
    resources: {
      ...input.resources,
      menuSelected: loadedResources('720x1280').menuSelected,
    },
  } as never, lifecycle), /exact raster set from one asset tree/);
  assert.throws(() => ClassicResultPresenter.create({
    ...input,
    resources: {
      ...input.resources,
      bonusParticle: {
        ...input.resources.bonusParticle,
        dimensions: { width: 1, height: 1 },
      },
    },
  } as never, lifecycle), /bonusParticle.*dimensions/);
  const trimmedFrame = new cc.SpriteFrame(
    input.resources.header.dimensions.width,
    input.resources.header.dimensions.height,
  );
  trimmedFrame.rect = { width: 1, height: 1 };
  assert.throws(() => ClassicResultPresenter.create({
    ...input,
    resources: {
      ...input.resources,
      header: { ...input.resources.header, spriteFrame: trimmedFrame },
    },
  } as never, lifecycle), /header.*untrimmed raster geometry/);
  input.resources.totalCoins.spriteFrame.destroyed = true;
  assert.throws(
    () => ClassicResultPresenter.create(input as never, lifecycle),
    /totalCoins.spriteFrame.*valid/,
  );
  input.resources.totalCoins.spriteFrame.destroyed = false;

  assert.throws(() => ClassicResultPresenter.create({
    ...input,
    fonts: {
      ...input.fonts,
      agencyB: { ...input.fonts.agencyB, canonicalPath: 'Fonts/wrong.ttf' },
    },
  } as never, lifecycle), /agencyB.*exact recovered/);
  input.fonts.slabThing.font.destroyed = true;
  assert.throws(
    () => ClassicResultPresenter.create(input as never, lifecycle),
    /slabThing.font.*valid/,
  );
  input.fonts.slabThing.font.destroyed = false;

  assert.throws(
    () => ClassicResultPresenter.create(input as never, null as never),
    /lifecycle must be an object/,
  );
  assert.throws(
    () => ClassicResultPresenter.create(input as never, {
      ...lifecycle,
      onMenu: null,
    } as never),
    /onMenu must be a function/,
  );
  assert.throws(
    () => ClassicResultPresenter.create(input as never, {
      ...lifecycle,
      onRankPresentationBoundary: undefined,
    } as never),
    /onRankPresentationBoundary must be a function/,
  );

  const presenter = ClassicResultPresenter.create(input as never, lifecycle);
  assert.throws(() => presenter.updateAction(0), /must be attached/);
  const inactiveParent = new cc.Node('Inactive');
  inactiveParent.active = false;
  assert.throws(() => presenter.attach(inactiveParent as never), /valid and active/);
  presenter.attach(new cc.Node('Parent') as never);
  assert.throws(() => presenter.attach(new cc.Node('Other') as never), /already attached/);
  assert.throws(() => presenter.updateAction(-1), /finite and non-negative/);
  assert.throws(() => presenter.updateAction(Number.NaN), /finite and non-negative/);
});

test('rank-boundary failure propagates once and destroys only the partial core shell', () => {
  const seed = createHarness('480x800');
  const callbackError = new Error('rank boundary failed');
  let boundaryCalls = 0;
  cc.resetCreatedNodes();

  assert.throws(() => ClassicResultPresenter.create(seed.input as never, {
    ...lifecycleCallbacks([]),
    onRankPresentationBoundary: () => {
      boundaryCalls += 1;
      assert.deepEqual(cc.createdNodes.map(({ name }) => name), [
        'ClassicResultScorePanel',
        'ClassicResultScoreLabel',
        'ClassicResultHeader',
        'ClassicResultRetryButton',
        'ClassicResultMenuButton',
        'ClassicResultMedalNone',
      ]);
      throw callbackError;
    },
  }), (error) => error === callbackError);

  assert.equal(boundaryCalls, 1);
  assert.equal(cc.createdNodes.length, 6);
  assert.equal(cc.createdNodes.every(({ destroyed }) => destroyed), true);
  assert.equal(cc.createdNodes.every(({ parent }) => parent === null), true);
  assert.equal(
    cc.createdNodes[3].listenerCount(cc.Node.EventType.TOUCH_START),
    0,
  );
  assert.equal(
    cc.createdNodes[4].listenerCount(cc.Node.EventType.TOUCH_END),
    0,
  );
});

test('dispose is idempotent, removes touch handlers, destroys all visuals, and cancels callbacks', () => {
  for (const attach of [false, true]) {
    cc.resetCreatedNodes();
    const harness = createHarness('720x1280');
    const owned = [...cc.createdNodes];
    if (attach) {
      harness.presenter.attach(new cc.Node('Parent') as never);
      harness.presenter.updateAction(0.5);
    }
    assert.equal(
      harness.presenter.retryButton.node.listenerCount(cc.Node.EventType.TOUCH_START),
      1,
    );
    assert.equal(
      harness.presenter.menuButton.node.listenerCount(cc.Node.EventType.TOUCH_END),
      1,
    );

    assert.equal(harness.presenter.dispose(), true);
    assert.equal(harness.presenter.dispose(), false);
    assert.equal(harness.presenter.isDisposed, true);
    assert.equal(harness.presenter.isAttached, false);
    assert.equal(owned.length, 12);
    assert.equal(owned.every(({ destroyed }) => destroyed), true);
    assert.equal(owned.every(({ parent }) => parent === null), true);
    for (const type of Object.values(cc.Node.EventType)) {
      assert.equal(harness.presenter.retryButton.node.listenerCount(type), 0);
      assert.equal(harness.presenter.menuButton.node.listenerCount(type), 0);
    }
    harness.presenter.retryButton.node.emit(cc.Node.EventType.TOUCH_END);
    harness.presenter.menuButton.node.emit(cc.Node.EventType.TOUCH_END);
    harness.presenter.updateAction(100);
    assert.deepEqual(harness.events, []);
    assert.throws(
      () => harness.presenter.attach(new cc.Node('Other') as never),
      /Disposed/,
    );
    assert.throws(
      () => harness.presenter.updateAction(Number.NaN),
      /finite and non-negative/,
    );
  }
});

test('dispose tolerates result buttons already destroyed by their scene parent', () => {
  cc.resetCreatedNodes();
  const harness = createHarness('720x1280');
  const owned = [...cc.createdNodes];
  harness.presenter.attach(new cc.Node('Parent') as never);

  harness.presenter.retryButton.node.destroy();
  harness.presenter.menuButton.node.destroy();

  assert.equal(harness.presenter.dispose(), true);
  assert.equal(harness.presenter.dispose(), false);
  assert.equal(harness.presenter.isDisposed, true);
  assert.equal(owned.every(({ destroyed }) => destroyed), true);
});

function createHarness(
  assetTree: AssetTree,
  lifecycleOverrides: Partial<ReturnType<typeof lifecycleCallbacks>> = {},
): Harness {
  const events: string[] = [];
  const resources = loadedResources(assetTree);
  const agencyFont = new cc.Font();
  const slabFont = new cc.Font();
  const viewport = assetTree === '480x800'
    ? { x: 0, y: 0, width: 480, height: 800 }
    : { x: 0, y: 0, width: 720, height: 1280 };
  const input: ResultInput = Object.freeze({
    completedRunScore: 321,
    fonts: Object.freeze({
      agencyB: Object.freeze({
        ...CLASSIC_RESULT_FONT_RESOURCES.agencyB,
        font: agencyFont,
      }),
      slabThing: Object.freeze({
        ...CLASSIC_RESULT_FONT_RESOURCES.slabThing,
        font: slabFont,
      }),
    }),
    panelValues: Object.freeze([33, 22, 11]) as readonly [number, number, number],
    random: Object.freeze({
      nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number {
        return Math.trunc((minimumInclusive + maximumInclusive) / 2);
      },
    }),
    resources,
    totalCoins: 777,
    viewport: Object.freeze(viewport),
  });
  const presenter = ClassicResultPresenter.create(
    input as never,
    { ...lifecycleCallbacks(events), ...lifecycleOverrides },
  );
  return { agencyFont, events, input, presenter, resources, slabFont };
}

function lifecycleCallbacks(events: string[]) {
  return {
    onMenu: () => events.push('menu'),
    onRankPresentationBoundary() {},
    onRetry: () => events.push('retry'),
    onTotalCoinsEntranceComplete: () => {
      events.push('total-coins-complete');
      return 192;
    },
  };
}

function loadedResources(assetTree: AssetTree): LoadedResultResources {
  const resources = getClassicResultResources(assetTree);
  return Object.freeze({
    background: loadedRaster(resources.background),
    bonusCoinsBadge: loadedRaster(resources.bonusCoinsBadge),
    bonusCoinsEffect: loadedRaster(resources.bonusCoinsEffect),
    bonusParticle: loadedRaster(resources.bonusParticle),
    coin: loadedRaster(resources.coin),
    header: loadedRaster(resources.header),
    medalNone: loadedRaster(resources.medalNone),
    menuNormal: loadedRaster(resources.menuNormal),
    menuSelected: loadedRaster(resources.menuSelected),
    retryNormal: loadedRaster(resources.retryNormal),
    retrySelected: loadedRaster(resources.retrySelected),
    totalCoins: loadedRaster(resources.totalCoins),
  });
}

function loadedRaster(resource: ClassicRasterResource): LoadedRaster {
  return {
    ...resource,
    spriteFrame: new cc.SpriteFrame(resource.dimensions.width, resource.dimensions.height),
  };
}

function assertLabel(
  label: StubLabel,
  font: StubFont,
  fontSize: number,
  string: string,
  expectedColor: Readonly<{ b: number; g: number; r: number }>,
): void {
  assert.equal(label.font, font);
  assert.equal(label.fontSize, fontSize);
  assert.equal(label.lineHeight, fontSize);
  assert.equal(label.string, string);
  assert.deepEqual(color(label.color), { ...expectedColor, a: 255 });
}

function assertTotalCoinsLabelTracksPanel(
  presenter: InstanceType<typeof ClassicResultPresenter>,
): void {
  assert.deepEqual(vector3(presenter.totalCoinsLabel.node.worldPosition), {
    x: presenter.totalCoinsPanel.node.worldPosition.x
      + presenter.layout.totalCoinsLabel.creatorLocalPosition.x,
    y: presenter.totalCoinsPanel.node.worldPosition.y
      + presenter.layout.totalCoinsLabel.creatorLocalPosition.y,
    z: 0,
  });
}

function color(value: Readonly<{ a: number; b: number; g: number; r: number }>): StubColor {
  return { a: value.a, b: value.b, g: value.g, r: value.r };
}

function point(value: Readonly<{ x: number; y: number }>): Readonly<{ x: number; y: number }> {
  return { x: value.x, y: value.y };
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

function size(
  value: Readonly<{ height: number; width: number }>,
): Readonly<{ height: number; width: number }> {
  return { height: value.height, width: value.width };
}
