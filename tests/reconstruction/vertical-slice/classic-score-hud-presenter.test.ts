import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CLASSIC_SCORE_HUD_BLACK,
  CLASSIC_SCORE_HUD_NEW_BEST_GREEN,
} from '../../../game/assets/scripts/domain/classic-score-hud-presentation.ts';
import {
  CLASSIC_SCORE_HUD_FONT_RESOURCE,
  getClassicPresentationResources,
  type ClassicRasterResource,
} from '../../../game/assets/scripts/domain/classic-resource-contract.ts';
import {
  DOUBLE_SCORE_ACTIVE_SECONDS,
  ScoreService,
  type ScoreCommand,
} from '../../../game/assets/scripts/domain/score-service.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
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
  constructor() { this.sizeMode = 0; this.spriteFrame = null; }
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

export class Mask {
  constructor() { this.inverted = false; this.type = 0; }
}
Mask.Type = Object.freeze({ GRAPHICS_RECT: 0 });

export class Node {
  constructor(name = '') {
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyed = false;
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
  setParent(parent) {
    if (this.parent !== null) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
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
  setSiblingIndex(index) {
    this.lastRequestedSiblingIndex = index;
    if (this.parent === null) return;
    const current = this.parent.children.indexOf(this);
    if (current >= 0) this.parent.children.splice(current, 1);
    const bounded = Math.max(0, Math.min(index, this.parent.children.length));
    this.parent.children.splice(bounded, 0, this);
  }
  destroy() {
    this.destroyed = true;
    this.active = false;
    this.setParent(null);
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

const cc = await import('cc') as unknown as CocosStub;
const { ClassicScoreHudPresenter } = await import(
  '../../../game/assets/scripts/creator/classic-score-hud-presenter.ts'
);

interface CocosStub {
  readonly Font: new () => StubFont;
  readonly Node: new (name?: string) => StubNode;
  readonly SpriteFrame: new (width: number, height: number) => StubSpriteFrame;
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
  readonly children: StubNode[];
  destroyed: boolean;
  lastRequestedSiblingIndex: number | null;
  layer: number;
  readonly name: string;
  readonly parent: StubNode | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly scale: Readonly<{ x: number; y: number; z: number }>;
  readonly worldPosition: Readonly<{ x: number; y: number; z: number }>;
  readonly worldPositionRequests: readonly Readonly<{ x: number; y: number; z: number }>[];
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

interface PresenterHarness {
  readonly font: StubFont;
  readonly presenter: InstanceType<typeof ClassicScoreHudPresenter>;
  readonly resources: Readonly<{
    readonly bestScoreCup: LoadedRaster;
    readonly doubleScorePanel: LoadedRaster;
    readonly scoreIcon: LoadedRaster;
  }>;
}

test('both profiles create exact untrimmed rasters and Linds labels at recovered coordinates', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    cc.resetCreatedNodes();
    const { font, presenter, resources } = createHarness(assetTree, 123);
    assert.deepEqual(cc.createdNodes.map(({ name }) => name), [
      'ClassicScoreIcon',
      'ClassicBestScoreCup',
      'ClassicDoubleScoreViewportClip',
      'ClassicDoubleScorePanel',
      'ClassicLiveScoreLabel',
      'ClassicBestScoreLabel',
      'ClassicPendingDoubleScoreLabel',
    ]);

    for (const [visual, resource] of [
      [presenter.scoreIcon, resources.scoreIcon],
      [presenter.bestScoreCup, resources.bestScoreCup],
      [presenter.doubleScorePanel, resources.doubleScorePanel],
    ] as const) {
      assert.equal(visual.node.active, false);
      assert.equal(visual.sprite.sizeMode, 2);
      assert.equal(visual.sprite.spriteFrame, resource.spriteFrame);
      assert.deepEqual(size(visual.transform.contentSize), resource.dimensions);
      assert.deepEqual(point(visual.transform.anchorPoint), { x: 0.5, y: 0.5 });
    }
    assert.equal(presenter.scoreIcon.opacity.opacity, 0);
    assert.equal(presenter.bestScoreCup.opacity.opacity, 0);
    assert.deepEqual(size(presenter.doubleScoreViewportClip.transform.contentSize), (
      assetTree === '480x800'
        ? { width: 480, height: 800 }
        : { width: 720, height: 1280 }
    ));
    assert.deepEqual(point(presenter.doubleScoreViewportClip.transform.anchorPoint), {
      x: 0,
      y: 0,
    });
    assert.equal(presenter.doubleScoreViewportClip.mask.type, 0);
    assert.equal(presenter.doubleScoreViewportClip.mask.inverted, false);

    assertLabel(
      presenter.liveScoreLabel.label as unknown as StubLabel,
      font,
      presenter.layout.liveScoreLabel.fontSize,
      '0',
      CLASSIC_SCORE_HUD_BLACK,
    );
    assertLabel(
      presenter.bestScoreLabel.label as unknown as StubLabel,
      font,
      presenter.layout.bestScoreLabel.fontSize,
      ' 123',
      CLASSIC_SCORE_HUD_BLACK,
    );
    assertLabel(
      presenter.pendingDoubleLabel.label as unknown as StubLabel,
      font,
      presenter.layout.pendingDoubleLabel.fontSize,
      '0',
      CLASSIC_SCORE_HUD_BLACK,
    );
    assert.deepEqual(
      point(presenter.liveScoreLabel.transform.anchorPoint),
      presenter.layout.liveScoreLabel.anchor,
    );
    assert.deepEqual(
      point(presenter.bestScoreLabel.transform.anchorPoint),
      presenter.layout.bestScoreLabel.anchor,
    );
    assert.deepEqual(
      point(presenter.pendingDoubleLabel.transform.anchorPoint),
      presenter.layout.pendingDoubleLabel.anchor,
    );

    const parent = new cc.Node('OffsetParent');
    parent.layer = 29;
    parent.setPosition(100, 200, 0);
    presenter.attach(parent as never);

    assert.deepEqual(vector3(presenter.scoreIcon.node.worldPosition), {
      ...presenter.layout.scoreIcon.worldPosition,
      z: 0,
    });
    assert.deepEqual(vector3(presenter.bestScoreCup.node.worldPosition), {
      ...presenter.layout.bestScoreCup.worldPosition,
      z: 0,
    });
    assert.deepEqual(vector3(presenter.doubleScorePanel.node.worldPosition), {
      ...presenter.layout.doubleScorePanel.hiddenWorldPosition,
      z: 0,
    });
    assert.deepEqual(vector3(presenter.doubleScoreViewportClip.node.worldPosition), {
      x: 0,
      y: 0,
      z: 0,
    });
    assert.equal(presenter.doubleScorePanel.node.parent, presenter.doubleScoreViewportClip.node);
    assert.deepEqual(vector3(presenter.liveScoreLabel.node.worldPosition), {
      ...presenter.layout.liveScoreLabel.worldPosition,
      z: 0,
    });
    assert.deepEqual(vector3(presenter.bestScoreLabel.node.worldPosition), {
      x: presenter.layout.bestScoreCup.worldPosition.x
        + presenter.layout.bestScoreLabel.creatorLocalPosition.x,
      y: presenter.layout.bestScoreCup.worldPosition.y
        + presenter.layout.bestScoreLabel.creatorLocalPosition.y,
      z: 0,
    });
    assert.equal(presenter.bestScoreLabel.node.parent, parent);
    assert.deepEqual(vector3(presenter.pendingDoubleLabel.node.position), {
      ...presenter.layout.pendingDoubleLabel.creatorLocalPosition,
      z: 0,
    });
    for (const node of cc.createdNodes.slice(0, 7)) {
      assert.equal(node.layer, 29);
    }
    assert.deepEqual(
      cc.createdNodes.slice(0, 7).map(({ lastRequestedSiblingIndex }) => lastRequestedSiblingIndex),
      [1, 2, 4, 1, 5, 3, 1],
    );
    assert.equal(presenter.scoreIcon.node.active, true);
    assert.equal(presenter.bestScoreCup.node.active, true);
    assert.equal(presenter.liveScoreLabel.node.active, true);
    assert.equal(presenter.bestScoreLabel.node.active, true);
    assert.equal(presenter.doubleScoreViewportClip.node.active, true);
    assert.equal(presenter.doubleScorePanel.node.active, true);
    assert.equal(presenter.pendingDoubleLabel.node.active, true);
    assert.deepEqual(parent.children.map(({ name }) => name), [
      'ClassicScoreIcon',
      'ClassicBestScoreCup',
      'ClassicBestScoreLabel',
      'ClassicDoubleScoreViewportClip',
      'ClassicLiveScoreLabel',
    ]);
    for (const root of [
      presenter.scoreIcon.node,
      presenter.bestScoreCup.node,
      presenter.bestScoreLabel.node,
      presenter.doubleScoreViewportClip.node,
      presenter.liveScoreLabel.node,
    ] as unknown as StubNode[]) {
      assert.ok(root.worldPositionRequests.length >= 1);
    }
  }
});

test('score updates preserve recovered spaces, pending format, and best-score colors', () => {
  const { presenter } = createHarness('480x800', 7);
  presenter.attach(new cc.Node('Parent') as never);

  presenter.setDisplayedScore(0);
  assert.equal(presenter.liveScoreLabel.label.string, '0');
  presenter.setDisplayedScore(1);
  assert.equal(presenter.liveScoreLabel.label.string, ' 1');
  presenter.setDisplayedScore(0);
  assert.equal(presenter.liveScoreLabel.label.string, ' 0');
  presenter.setDisplayedScore(-3);
  presenter.setBestScore(42, true);
  presenter.setPendingDoubleScore(-7);
  assert.equal(presenter.liveScoreLabel.label.string, ' -3');
  assert.equal(presenter.bestScoreLabel.label.string, ' 42');
  assert.deepEqual(color(presenter.bestScoreLabel.label.color), {
    ...CLASSIC_SCORE_HUD_NEW_BEST_GREEN,
    a: 255,
  });
  assert.equal(presenter.pendingDoubleLabel.label.string, '-7');
  assert.deepEqual(presenter.state, {
    attached: true,
    bestScore: 42,
    bestScoreIsNewBest: true,
    displayedScore: -3,
    disposed: false,
    doubleScorePanelPhase: 'hidden',
    entryElapsedActionSeconds: 0,
    pendingDoubleScore: -7,
    scoreIconScale: 1,
    scoreIconScalePhase: 'idle',
  });

  presenter.setBestScore(43, false);
  assert.deepEqual(color(presenter.bestScoreLabel.label.color), {
    ...CLASSIC_SCORE_HUD_BLACK,
    a: 255,
  });
  assert.throws(() => presenter.setDisplayedScore(0.5), /safe integer/);
  assert.throws(() => presenter.setBestScore(1, 'yes' as never), /boolean/);
  assert.throws(
    () => presenter.setPendingDoubleScore(Number.MAX_SAFE_INTEGER + 1),
    /safe integer/,
  );
});

test('double-score panel moves for exact one-second legs and remains clipped when hidden', () => {
  const { presenter } = createHarness('480x800');
  presenter.attach(new cc.Node('Parent') as never);
  const duration = presenter.layout.doubleScorePanel.moveActionSeconds;

  presenter.startDoubleScorePanelIntro(duration, DOUBLE_SCORE_ACTIVE_SECONDS);
  assert.equal(presenter.doubleScorePanel.node.active, true);
  assert.equal(presenter.pendingDoubleLabel.node.active, true);
  assert.equal(presenter.state.doubleScorePanelPhase, 'entering');
  presenter.updateAction(duration / 2);
  assert.equal(presenter.doubleScorePanel.node.worldPosition.x, 0);
  presenter.updateAction(duration / 2);
  assert.deepEqual(vector3(presenter.doubleScorePanel.node.worldPosition), {
    ...presenter.layout.doubleScorePanel.shownWorldPosition,
    z: 0,
  });
  assert.equal(presenter.state.doubleScorePanelPhase, 'shown');

  presenter.startDoubleScorePanelExit(duration);
  presenter.updateAction(duration);
  assert.deepEqual(vector3(presenter.doubleScorePanel.node.worldPosition), {
    ...presenter.layout.doubleScorePanel.hiddenWorldPosition,
    z: 0,
  });
  assert.equal(presenter.state.doubleScorePanelPhase, 'hidden');
  assert.equal(presenter.doubleScorePanel.node.active, true);
  assert.equal(presenter.pendingDoubleLabel.node.active, true);
});

test('double-score presentation preserves concurrent moves and stale native callbacks', () => {
  const score = new ScoreService();
  const completedDelays: number[] = [];
  let presenter: InstanceType<typeof ClassicScoreHudPresenter>;
  const apply = (commands: readonly ScoreCommand[]): void => {
    for (const command of commands) {
      if (command.type === 'start-double-score-presentation') {
        presenter.startDoubleScorePanelIntro(
          command.introDurationSeconds,
          command.activeDelaySeconds,
        );
      } else if (command.type === 'finish-double-score-presentation') {
        presenter.startDoubleScorePanelExit(command.exitDurationSeconds);
      }
    }
  };
  const harness = createHarness('480x800', 0, {
    onDoubleScoreActiveDelayComplete: () => {
      completedDelays.push(score.pendingDoubleScore);
      apply(score.completeDoubleScoreDelay());
    },
    onScoreIconScaleDownComplete() {},
    onScoreIconScaleUpComplete() {},
  });
  presenter = harness.presenter;
  presenter.attach(new cc.Node('Parent') as never);

  apply(score.enableDoubleScore());
  score.addScore(3);
  presenter.updateAction(0.25);
  apply(score.disableDoubleScore());
  assert.equal(score.authoritativeScore, 6);
  assert.equal(presenter.state.doubleScorePanelPhase, 'exiting');
  presenter.updateAction(0.75);
  assert.equal(presenter.state.doubleScorePanelPhase, 'exiting');
  presenter.updateAction(0.25);
  assert.equal(presenter.state.doubleScorePanelPhase, 'hidden');
  presenter.updateAction(DOUBLE_SCORE_ACTIVE_SECONDS - 0.25);
  assert.deepEqual(completedDelays, [0]);
  assert.equal(presenter.state.doubleScorePanelPhase, 'exiting');
  presenter.updateAction(1);
  assert.equal(presenter.state.doubleScorePanelPhase, 'hidden');

  apply(score.enableDoubleScore());
  score.addScore(5);
  presenter.updateAction(0.4);
  apply(score.enableDoubleScore());
  score.addScore(7);
  presenter.updateAction(0.6);
  assert.equal(presenter.state.doubleScorePanelPhase, 'entering');
  presenter.updateAction(0.4);
  assert.equal(presenter.state.doubleScorePanelPhase, 'shown');
  presenter.updateAction(DOUBLE_SCORE_ACTIVE_SECONDS - 0.4);
  assert.equal(score.doubleScoreActive, false);
  assert.equal(score.authoritativeScore, 20);
  assert.deepEqual(completedDelays, [0, 7]);
  assert.equal(presenter.state.doubleScorePanelPhase, 'exiting');
  const positionBeforeStaleDelay = presenter.doubleScorePanel.node.worldPosition.x;
  presenter.updateAction(0.4);
  assert.deepEqual(completedDelays, [0, 7, 0]);
  assert.equal(
    presenter.doubleScorePanel.node.worldPosition.x,
    positionBeforeStaleDelay,
    'delay target must schedule its overlapping exit before the later panel target advances',
  );
  presenter.updateAction(1);
  assert.equal(presenter.state.doubleScorePanelPhase, 'hidden');
});

test('icon and cup fade concurrently for exactly one action second', () => {
  const { presenter } = createHarness('720x1280');
  presenter.attach(new cc.Node('Parent') as never);

  presenter.updateAction(0.4);
  assert.equal(presenter.scoreIcon.opacity.opacity, 102);
  assert.equal(presenter.bestScoreCup.opacity.opacity, 102);
  assert.equal(presenter.state.entryElapsedActionSeconds, 0.4);

  presenter.updateAction(0.6);
  assert.equal(presenter.scoreIcon.opacity.opacity, 255);
  assert.equal(presenter.bestScoreCup.opacity.opacity, 255);
  assert.equal(presenter.state.entryElapsedActionSeconds, 1);

  presenter.updateAction(10);
  assert.equal(presenter.scoreIcon.opacity.opacity, 255);
  assert.equal(presenter.bestScoreCup.opacity.opacity, 255);
  assert.equal(presenter.state.entryElapsedActionSeconds, 1);
});

test('score-icon pulse calls each lifecycle phase without overshooting a callback-started phase', () => {
  const events: string[] = [];
  let presenter: InstanceType<typeof ClassicScoreHudPresenter>;
  const harness = createHarness('480x800', 0, {
    onDoubleScoreActiveDelayComplete() {},
    onScoreIconScaleDownComplete: () => events.push('down'),
    onScoreIconScaleUpComplete: () => {
      events.push('up');
      presenter.startScoreIconScaleDown(
        presenter.layout.scoreIconPulse.actionSecondsPerLeg,
        presenter.layout.scoreIconPulse.restingScale,
      );
    },
  });
  presenter = harness.presenter;
  presenter.attach(new cc.Node('Parent') as never);
  const duration = presenter.layout.scoreIconPulse.actionSecondsPerLeg;

  presenter.startScoreIconScaleUp(duration, presenter.layout.scoreIconPulse.apexScale);
  presenter.updateAction(duration / 2);
  assert.deepEqual(vector3(presenter.scoreIcon.node.scale), { x: 1.125, y: 1.125, z: 1 });
  assert.equal(presenter.state.scoreIconScalePhase, 'up');

  presenter.updateAction(duration * 10);
  assert.deepEqual(events, ['up']);
  assert.deepEqual(vector3(presenter.scoreIcon.node.scale), { x: 1.25, y: 1.25, z: 1 });
  assert.equal(presenter.state.scoreIconScalePhase, 'down');
  assert.equal(presenter.state.scoreIconScale, 1.25);

  presenter.updateAction(duration / 2);
  assert.deepEqual(vector3(presenter.scoreIcon.node.scale), { x: 1.125, y: 1.125, z: 1 });
  assert.deepEqual(events, ['up']);
  presenter.updateAction(duration / 2);
  assert.deepEqual(vector3(presenter.scoreIcon.node.scale), { x: 1, y: 1, z: 1 });
  assert.deepEqual(events, ['up', 'down']);
  assert.equal(presenter.state.scoreIconScalePhase, 'idle');
});

test('attachment, action sequencing, assets, font, lifecycle, and scores reject invalid use', () => {
  const compact = loadedPresentation('480x800');
  const high = loadedPresentation('720x1280');
  const font = new cc.Font();
  const validInput = {
    bestScoreCupResource: compact.bestScoreCup as never,
    doubleScorePanelResource: compact.doubleScorePanel as never,
    fontResource: {
      ...CLASSIC_SCORE_HUD_FONT_RESOURCE,
      font,
    } as never,
    initialBestScore: 0,
    scoreIconResource: compact.scoreIcon as never,
    viewport: { width: 480, height: 800 },
  };
  const lifecycle = {
    onDoubleScoreActiveDelayComplete() {},
    onScoreIconScaleDownComplete() {},
    onScoreIconScaleUpComplete() {},
  };

  assert.throws(
    () => ClassicScoreHudPresenter.create({
      ...validInput,
      doubleScorePanelResource: high.doubleScorePanel as never,
    }, lifecycle),
    /exact raster trio/,
  );
  const trimmedScoreIcon = loadedRaster(getClassicPresentationResources('480x800').scoreIcon);
  trimmedScoreIcon.spriteFrame.rect = { width: 1, height: 1 };
  assert.throws(
    () => ClassicScoreHudPresenter.create({
      ...validInput,
      scoreIconResource: trimmedScoreIcon as never,
    }, lifecycle),
    /untrimmed raster geometry/,
  );
  font.destroyed = true;
  assert.throws(
    () => ClassicScoreHudPresenter.create(validInput, lifecycle),
    /valid loaded Creator Font/,
  );
  font.destroyed = false;
  assert.throws(
    () => ClassicScoreHudPresenter.create({
      ...validInput,
      fontResource: {
        canonicalPath: 'Fonts/Not-Linds.ttf',
        font: new cc.Font(),
      } as never,
    }, lifecycle),
    /exact recovered Classic score font/,
  );
  assert.throws(
    () => ClassicScoreHudPresenter.create(
      { ...validInput, initialBestScore: 0.25 },
      lifecycle,
    ),
    /safe integer/,
  );
  assert.throws(
    () => ClassicScoreHudPresenter.create(validInput, {
      ...lifecycle,
      onScoreIconScaleUpComplete: null,
    } as never),
    /onScoreIconScaleUpComplete/,
  );

  const detachedAncestor = new cc.Node('DetachedAncestor');
  detachedAncestor.active = false;
  const detachedActiveParent = new cc.Node('DetachedActiveParent');
  detachedActiveParent.setParent(detachedAncestor);
  assert.equal(detachedActiveParent.active, true);
  assert.equal(detachedActiveParent.activeInHierarchy, false);
  const detachedPresenter = ClassicScoreHudPresenter.create(validInput, lifecycle);
  assert.doesNotThrow(() => detachedPresenter.attach(detachedActiveParent as never));
  assert.equal(detachedPresenter.dispose(), true);

  const presenter = ClassicScoreHudPresenter.create(validInput, lifecycle);
  assert.throws(() => presenter.setDisplayedScore(1), /must be attached/);
  assert.throws(
    () => presenter.startScoreIconScaleUp(
      presenter.layout.scoreIconPulse.actionSecondsPerLeg,
      presenter.layout.scoreIconPulse.apexScale,
    ),
    /must be attached/,
  );
  const inactiveParent = new cc.Node('InactiveParent');
  inactiveParent.active = false;
  assert.throws(() => presenter.attach(inactiveParent as never), /valid and active/);
  presenter.attach(new cc.Node('Parent') as never);
  assert.throws(() => presenter.attach(new cc.Node('Second') as never), /already attached/);
  assert.throws(
    () => presenter.startScoreIconScaleDown(
      presenter.layout.scoreIconPulse.actionSecondsPerLeg,
      presenter.layout.scoreIconPulse.restingScale,
    ),
    /apex scale/,
  );
  presenter.startDoubleScorePanelExit(presenter.layout.doubleScorePanel.moveActionSeconds);
  presenter.updateAction(presenter.layout.doubleScorePanel.moveActionSeconds);
  assert.throws(
    () => presenter.startDoubleScorePanelIntro(0.5, DOUBLE_SCORE_ACTIVE_SECONDS),
    /durationSeconds/,
  );
  assert.throws(
    () => presenter.startDoubleScorePanelIntro(
      presenter.layout.doubleScorePanel.moveActionSeconds,
      14,
    ),
    /activeDelaySeconds/,
  );
  assert.throws(
    () => presenter.startScoreIconScaleUp(0.025, presenter.layout.scoreIconPulse.apexScale),
    /durationSeconds/,
  );
  presenter.startScoreIconScaleUp(
    presenter.layout.scoreIconPulse.actionSecondsPerLeg,
    presenter.layout.scoreIconPulse.apexScale,
  );
  assert.throws(
    () => presenter.startScoreIconScaleUp(
      presenter.layout.scoreIconPulse.actionSecondsPerLeg,
      presenter.layout.scoreIconPulse.apexScale,
    ),
    /already active/,
  );
  assert.throws(() => presenter.updateAction(Number.NaN), /finite and non-negative/);
});

test('dispose destroys all seven owned nodes and cancels active presentation without callbacks', () => {
  for (const attach of [false, true]) {
    cc.resetCreatedNodes();
    const events: string[] = [];
    const { presenter } = createHarness('480x800', 0, {
      onDoubleScoreActiveDelayComplete: () => events.push('double'),
      onScoreIconScaleDownComplete: () => events.push('down'),
      onScoreIconScaleUpComplete: () => events.push('up'),
    });
    const owned = [...cc.createdNodes];
    if (attach) {
      presenter.attach(new cc.Node('Parent') as never);
      presenter.startDoubleScorePanelIntro(
        presenter.layout.doubleScorePanel.moveActionSeconds,
        DOUBLE_SCORE_ACTIVE_SECONDS,
      );
      presenter.startScoreIconScaleUp(
        presenter.layout.scoreIconPulse.actionSecondsPerLeg,
        presenter.layout.scoreIconPulse.apexScale,
      );
    }

    assert.equal(presenter.dispose(), true);
    assert.equal(presenter.dispose(), false);
    assert.equal(presenter.isDisposed, true);
    assert.equal(presenter.isAttached, false);
    assert.equal(presenter.state.scoreIconScalePhase, 'idle');
    assert.deepEqual(events, []);
    assert.equal(owned.length, 7);
    for (const node of owned) {
      assert.equal(node.destroyed, true);
      assert.equal(cc.isValid(node), false);
      assert.equal(node.parent, null);
    }
    assert.throws(() => presenter.attach(new cc.Node('Parent') as never), /Disposed/);
    assert.throws(() => presenter.setPendingDoubleScore(1), /Disposed/);
    presenter.updateAction(1);
  }
});

test('source keeps unconstrained labels, synchronized line height, and world conversion', () => {
  const source = readFileSync(
    `${REPOSITORY_ROOT}/game/assets/scripts/creator/classic-score-hud-presenter.ts`,
    'utf8',
  );
  assert.match(source, /setWorldPosition\(/);
  assert.doesNotMatch(source, /fontSize\s*\+\s*8/);
  assert.match(source, /label\.lineHeight\s*=\s*layout\.fontSize/);
});

function createHarness(
  assetTree: '480x800' | '720x1280',
  initialBestScore = 0,
  lifecycle = {
    onDoubleScoreActiveDelayComplete() {},
    onScoreIconScaleDownComplete() {},
    onScoreIconScaleUpComplete() {},
  },
): PresenterHarness {
  const resources = loadedPresentation(assetTree);
  const font = new cc.Font();
  const viewport = assetTree === '480x800'
    ? { width: 480, height: 800 }
    : { width: 720, height: 1280 };
  const presenter = ClassicScoreHudPresenter.create({
    bestScoreCupResource: resources.bestScoreCup as never,
    doubleScorePanelResource: resources.doubleScorePanel as never,
    fontResource: {
      ...CLASSIC_SCORE_HUD_FONT_RESOURCE,
      font,
    } as never,
    initialBestScore,
    scoreIconResource: resources.scoreIcon as never,
    viewport,
  }, lifecycle);
  return { font, presenter, resources };
}

function loadedPresentation(assetTree: '480x800' | '720x1280'): Readonly<{
  readonly bestScoreCup: LoadedRaster;
  readonly doubleScorePanel: LoadedRaster;
  readonly scoreIcon: LoadedRaster;
}> {
  const presentation = getClassicPresentationResources(assetTree);
  return Object.freeze({
    bestScoreCup: loadedRaster(presentation.bestScoreCup),
    doubleScorePanel: loadedRaster(presentation.doubleScorePanel),
    scoreIcon: loadedRaster(presentation.scoreIcon),
  });
}

function loadedRaster(resource: ClassicRasterResource): LoadedRaster {
  return Object.freeze({
    ...resource,
    spriteFrame: new cc.SpriteFrame(resource.dimensions.width, resource.dimensions.height),
  });
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

function size(
  value: Readonly<{ height: number; width: number }>,
): Readonly<{ height: number; width: number }> {
  return { height: value.height, width: value.width };
}
