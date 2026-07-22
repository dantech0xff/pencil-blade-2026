import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CLASSIC_RESULT_FONT_RESOURCES,
  getClassicResultResources,
  type ClassicRasterResource,
} from '../../../game/assets/scripts/domain/classic-resource-contract.ts';
import {
  CLASSIC_RESULT_WHITE,
} from '../../../game/assets/scripts/domain/classic-result-presentation.ts';

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
  constructor() {
    this.color = new Color(255, 255, 255, 255);
    this.sizeMode = 0;
    this.spriteFrame = null;
  }
}
Sprite.SizeMode = Object.freeze({ CUSTOM: 2 });

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
    this.lastRequestedSiblingIndex = null;
    this.layer = 0;
    this.name = name;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
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
      const previousIndex = this.parent.children.indexOf(this);
      if (previousIndex >= 0) this.parent.children.splice(previousIndex, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
    if (keepWorldTransform) {
      const parentWorld = parent === null ? { x: 0, y: 0, z: 0 } : parent.worldPosition;
      this.position = {
        x: world.x - parentWorld.x,
        y: world.y - parentWorld.y,
        z: world.z - parentWorld.z,
      };
    }
  }
  setPosition(x, y, z) { this.position = { x, y, z }; }
  setWorldPosition(x, y, z) {
    const parent = this.parent === null
      ? { x: 0, y: 0, z: 0 }
      : this.parent.worldPosition;
    this.position = { x: x - parent.x, y: y - parent.y, z: z - parent.z };
  }
  setRotationFromEuler(x, y, z) { this.eulerAngles = { x, y, z }; }
  setSiblingIndex(index) {
    this.lastRequestedSiblingIndex = index;
    if (this.parent === null) return;
    const siblings = this.parent.children;
    const previousIndex = siblings.indexOf(this);
    if (previousIndex >= 0) siblings.splice(previousIndex, 1);
    siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, this);
  }
  destroy() {
    if (this.destroyed) return;
    for (const child of [...this.children]) child.destroy();
    this.destroyed = true;
    this.active = false;
    this.setParent(null, true);
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
const { ClassicResultRewardPresenter } = await import(
  '../../../game/assets/scripts/creator/classic-result-reward-presenter.ts'
);

type AssetTree = '480x800' | '720x1280';
type RewardPresenter = InstanceType<typeof ClassicResultRewardPresenter>;

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
  destroy(): void;
  getComponent<T>(Type: new () => T): T | null;
  setParent(parent: StubNode | null, keepWorldTransform?: boolean): void;
  setPosition(x: number, y: number, z: number): void;
}

interface StubSprite {
  color: StubColor;
  sizeMode: number;
  spriteFrame: StubSpriteFrame | null;
}

interface StubSpriteFrame {
  destroyed: boolean;
  originalSize: { height: number; width: number };
  rect: { height: number; width: number };
}

interface StubTransform {
  readonly anchorPoint: Readonly<{ x: number; y: number }>;
  readonly contentSize: Readonly<{ height: number; width: number }>;
}

interface LoadedRaster extends ClassicRasterResource {
  readonly spriteFrame: StubSpriteFrame;
}

interface RewardInput {
  readonly badgeResource: LoadedRaster;
  readonly coinResource: LoadedRaster;
  readonly effectResource: LoadedRaster;
  readonly fontResource: Readonly<{ canonicalPath: string; font: StubFont }>;
  readonly viewport: Readonly<{ height: number; width: number; x: number; y: number }>;
}

interface PresentedSpriteStub {
  readonly node: StubNode;
  readonly sprite: StubSprite;
  readonly transform: StubTransform;
}

test('both asset trees preserve creation callback order and exact root/child geometry', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    cc.resetCreatedNodes();
    const input = createInput(assetTree);
    const bonus = assetTree === '480x800' ? 3 : -3;
    const parent = new cc.Node('OffsetResultParent');
    parent.layer = 27;
    parent.setPosition(100, 200, 0);
    let callbackCalls = 0;
    let callbackSnapshot: unknown;
    let presenter: RewardPresenter;

    presenter = ClassicResultRewardPresenter.create(input as never, {
      onAwardCoins: () => {
        callbackCalls += 1;
        callbackSnapshot = {
          badgeExists: presenter.badge !== null,
          bonusLabel: presenter.bonusLabel,
          coinChildren: presentedNode(presenter.coin).children.map(({ name }) => name),
          coinExists: presenter.coin !== null,
          effectExists: presenter.effect !== null,
          rewardNodes: cc.createdNodes
            .filter(({ name }) => name.startsWith('ClassicResultReward'))
            .map(({ name }) => name),
          rootChildren: parent.children.map(({ name }) => name),
          state: presenter.state,
        };
        return bonus;
      },
    });

    assert.deepEqual(presenter.state, {
      awardAttempted: false,
      bonusCoins: null,
      disposed: false,
      presented: false,
      presenting: false,
      rotationDegrees: 0,
    });
    assert.equal(presenter.present(parent as never), bonus);
    assert.equal(callbackCalls, 1);
    assert.deepEqual(callbackSnapshot, {
      badgeExists: true,
      bonusLabel: null,
      coinChildren: ['ClassicResultRewardBadge'],
      coinExists: true,
      effectExists: true,
      rewardNodes: [
        'ClassicResultRewardEffect',
        'ClassicResultRewardCoin',
        'ClassicResultRewardBadge',
      ],
      rootChildren: ['ClassicResultRewardEffect', 'ClassicResultRewardCoin'],
      state: {
        awardAttempted: true,
        bonusCoins: null,
        disposed: false,
        presented: false,
        presenting: true,
        rotationDegrees: 0,
      },
    });
    assert.deepEqual(parent.children.map(({ name }) => name), [
      'ClassicResultRewardEffect',
      'ClassicResultRewardCoin',
    ]);

    const effect = presentedSprite(presenter.effect);
    const coin = presentedSprite(presenter.coin);
    const badge = presentedSprite(presenter.badge);
    const bonusLabel = presentedLabel(presenter);
    const expected = assetTree === '480x800'
      ? {
        badgeLocal: { x: 87, y: Math.fround(86.19999694824219), z: 0 },
        fontSize: 34,
        labelLocal: { x: 87, y: -17, z: 0 },
        world: { x: 324, y: 160, z: 0 },
      }
      : {
        badgeLocal: {
          x: Math.fround(102.19999694824219),
          y: Math.fround(101.0999984741211),
          z: 0,
        },
        fontSize: 51,
        labelLocal: { x: Math.fround(102.19999694824219), y: -24.5, z: 0 },
        world: { x: 486, y: 256, z: 0 },
      };

    assertSprite(effect, input.effectResource);
    assertSprite(coin, input.coinResource);
    assertSprite(badge, input.badgeResource);
    assert.deepEqual(vector3(effect.node.worldPosition), expected.world);
    assert.deepEqual(vector3(coin.node.worldPosition), expected.world);
    assert.deepEqual(vector3(badge.node.position), expected.badgeLocal);
    assert.deepEqual(coin.node.children.map(({ name }) => name), [
      'ClassicResultRewardBadge',
      'ClassicResultRewardBonusLabel',
    ]);
    assert.equal(badge.node.lastRequestedSiblingIndex, 0);
    assert.equal(bonusLabel.node.lastRequestedSiblingIndex, 1);
    assert.deepEqual(vector3(bonusLabel.node.position), expected.labelLocal);
    assert.deepEqual(point(bonusLabel.transform.anchorPoint), {
      x: 0.5,
      y: Math.fround(-0.1),
    });
    assert.equal(bonusLabel.label.font, input.fontResource.font);
    assert.equal(bonusLabel.label.fontSize, expected.fontSize);
    assert.equal(bonusLabel.label.lineHeight, expected.fontSize);
    assert.equal(bonusLabel.label.string, String(bonus));
    assert.deepEqual(color(bonusLabel.label.color), {
      ...CLASSIC_RESULT_WHITE,
      a: 255,
    });
    for (const node of [effect.node, coin.node, badge.node, bonusLabel.node]) {
      assert.equal(node.active, true);
      assert.equal(node.layer, 27);
      assert.deepEqual(vector3(node.scale), { x: 1, y: 1, z: 1 });
      assert.deepEqual(vector3(node.eulerAngles), { x: 0, y: 0, z: 0 });
    }
    assert.deepEqual(presenter.state, {
      awardAttempted: true,
      bonusCoins: bonus,
      disposed: false,
      presented: true,
      presenting: false,
      rotationDegrees: 0,
    });
    assert.throws(() => presenter.present(parent as never), /presented only once/);
    assert.equal(callbackCalls, 1);
  }
});

test('effect rotation preserves RepeatForever RotateBy +360 degrees per 2.5 seconds', () => {
  const input = createInput('480x800');
  let callbackCalls = 0;
  const presenter = ClassicResultRewardPresenter.create(input as never, {
    onAwardCoins: () => {
      callbackCalls += 1;
      return 5;
    },
  });

  presenter.updateAction(2.5);
  assert.equal(presenter.state.rotationDegrees, 0);
  presenter.present(new cc.Node('Parent') as never);
  const effect = presentedSprite(presenter.effect);
  const coin = presentedSprite(presenter.coin);
  const badge = presentedSprite(presenter.badge);
  const label = presentedLabel(presenter);

  presenter.updateAction(1.25);
  assert.equal(presenter.state.rotationDegrees, 180);
  assert.deepEqual(vector3(effect.node.eulerAngles), { x: 0, y: 0, z: 180 });
  presenter.updateAction(1.25);
  assert.equal(presenter.state.rotationDegrees, 0);
  assert.deepEqual(vector3(effect.node.eulerAngles), { x: 0, y: 0, z: 0 });
  presenter.updateAction(2.5);
  assert.equal(presenter.state.rotationDegrees, 0);
  assert.deepEqual(vector3(effect.node.eulerAngles), { x: 0, y: 0, z: 0 });
  presenter.updateAction(0.625);
  assert.equal(presenter.state.rotationDegrees, 90);
  assert.deepEqual(vector3(effect.node.eulerAngles), { x: 0, y: 0, z: 90 });
  assert.deepEqual(vector3(coin.node.eulerAngles), { x: 0, y: 0, z: 0 });
  assert.deepEqual(vector3(badge.node.eulerAngles), { x: 0, y: 0, z: 0 });
  assert.deepEqual(vector3(label.node.eulerAngles), { x: 0, y: 0, z: 0 });
  assert.equal(callbackCalls, 1);
  assert.throws(() => presenter.updateAction(-1), /finite and non-negative/);
  assert.throws(() => presenter.updateAction(Number.NaN), /finite and non-negative/);
  assert.throws(() => presenter.updateAction(Number.POSITIVE_INFINITY), /finite and non-negative/);
});

test('explicit, pre-presentation, and parent-led disposal are deterministic and idempotent', () => {
  let callbackCalls = 0;
  const presenter = ClassicResultRewardPresenter.create(createInput('720x1280') as never, {
    onAwardCoins: () => {
      callbackCalls += 1;
      return 9;
    },
  });
  const parent = new cc.Node('Parent');
  presenter.present(parent as never);
  presenter.updateAction(1.25);
  const owned = [
    presentedNode(presenter.effect),
    presentedNode(presenter.coin),
    presentedNode(presenter.badge),
    presentedLabel(presenter).node,
  ];

  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
  assert.deepEqual(presenter.state, {
    awardAttempted: true,
    bonusCoins: 9,
    disposed: true,
    presented: false,
    presenting: false,
    rotationDegrees: 180,
  });
  assert.equal(parent.children.length, 0);
  assert.equal(owned.every(({ destroyed }) => destroyed), true);
  assert.equal(owned.every(({ parent: owner }) => owner === null), true);
  assert.equal(presenter.effect, null);
  assert.equal(presenter.coin, null);
  assert.equal(presenter.badge, null);
  assert.equal(presenter.bonusLabel, null);
  presenter.updateAction(10);
  assert.equal(presenter.state.rotationDegrees, 180);
  assert.throws(() => presenter.present(parent as never), /presented only once/);
  assert.equal(callbackCalls, 1);

  let beforeCalls = 0;
  const before = ClassicResultRewardPresenter.create(createInput('480x800') as never, {
    onAwardCoins: () => {
      beforeCalls += 1;
      return 1;
    },
  });
  assert.equal(before.dispose(), true);
  assert.throws(() => before.present(new cc.Node('UnusedParent') as never), /presented only once/);
  assert.equal(beforeCalls, 0);

  const parentLed = ClassicResultRewardPresenter.create(createInput('480x800') as never, {
    onAwardCoins: () => 2,
  });
  const destroyedParent = new cc.Node('DestroyedParent');
  parentLed.present(destroyedParent as never);
  const parentOwned = [
    presentedNode(parentLed.effect),
    presentedNode(parentLed.coin),
    presentedNode(parentLed.badge),
    presentedLabel(parentLed).node,
  ];
  destroyedParent.destroy();
  parentLed.updateAction(0);
  assert.deepEqual(parentLed.state, {
    awardAttempted: true,
    bonusCoins: 2,
    disposed: true,
    presented: false,
    presenting: false,
    rotationDegrees: 0,
  });
  assert.equal(parentOwned.every(({ destroyed }) => destroyed), true);
  assert.equal(parentLed.dispose(), false);
});

test('input, exact rasters, untrimmed frames, and reward font fail closed before creation', () => {
  const lifecycle = { onAwardCoins: () => 0 };
  cc.resetCreatedNodes();

  assert.throws(
    () => ClassicResultRewardPresenter.create(null as never, lifecycle),
    /input must be an object/,
  );
  assert.throws(
    () => ClassicResultRewardPresenter.create(createInput('480x800') as never, null as never),
    /provide onAwardCoins/,
  );
  assert.throws(
    () => ClassicResultRewardPresenter.create(createInput('480x800') as never, {} as never),
    /provide onAwardCoins/,
  );
  assert.throws(() => ClassicResultRewardPresenter.create({
    ...createInput('480x800'),
    viewport: { x: 0, y: 0, width: 0, height: 800 },
  } as never, lifecycle), /viewport.width/);
  assert.throws(() => ClassicResultRewardPresenter.create({
    ...createInput('480x800'),
    viewport: { x: Number.NaN, y: 0, width: 480, height: 800 },
  } as never, lifecycle), /viewport.x/);
  assert.throws(() => ClassicResultRewardPresenter.create({
    ...createInput('480x800'),
    badgeResource: null,
  } as never, lifecycle), /exact raster set/);

  const wrongPath = createInput('480x800');
  assert.throws(() => ClassicResultRewardPresenter.create({
    ...wrongPath,
    effectResource: {
      ...wrongPath.effectResource,
      canonicalPath: '480x800/Interfaces/wrong-effect.png',
    },
  } as never, lifecycle), /exact raster set/);

  const mixedTree = createInput('480x800');
  assert.throws(() => ClassicResultRewardPresenter.create({
    ...mixedTree,
    coinResource: createInput('720x1280').coinResource,
  } as never, lifecycle), /exact raster set/);

  const wrongDimensions = createInput('480x800');
  assert.throws(() => ClassicResultRewardPresenter.create({
    ...wrongDimensions,
    badgeResource: {
      ...wrongDimensions.badgeResource,
      dimensions: { width: 1, height: 1 },
    },
  } as never, lifecycle), /badgeResource dimensions/);

  const trimmed = createInput('480x800');
  trimmed.effectResource.spriteFrame.rect = { width: 1, height: 1 };
  assert.throws(
    () => ClassicResultRewardPresenter.create(trimmed as never, lifecycle),
    /effectResource\.spriteFrame.*untrimmed/,
  );

  const wrongOriginal = createInput('480x800');
  wrongOriginal.coinResource.spriteFrame.originalSize.width = 1;
  assert.throws(
    () => ClassicResultRewardPresenter.create(wrongOriginal as never, lifecycle),
    /coinResource\.spriteFrame.*untrimmed/,
  );

  const destroyedFrame = createInput('480x800');
  destroyedFrame.badgeResource.spriteFrame.destroyed = true;
  assert.throws(
    () => ClassicResultRewardPresenter.create(destroyedFrame as never, lifecycle),
    /badgeResource\.spriteFrame must be valid/,
  );

  const wrongFont = createInput('480x800');
  assert.throws(() => ClassicResultRewardPresenter.create({
    ...wrongFont,
    fontResource: { ...wrongFont.fontResource, canonicalPath: 'Fonts/AgencyB.ttf' },
  } as never, lifecycle), /exact recovered Classic reward font/);

  const destroyedFont = createInput('480x800');
  destroyedFont.fontResource.font.destroyed = true;
  assert.throws(
    () => ClassicResultRewardPresenter.create(destroyedFont as never, lifecycle),
    /fontResource\.font must be valid/,
  );
  assert.equal(cc.createdNodes.length, 0);
});

test('invalid parent and callback bonus fail closed with one callback and complete cleanup', () => {
  let parentCalls = 0;
  const invalidParentPresenter = ClassicResultRewardPresenter.create(
    createInput('480x800') as never,
    { onAwardCoins: () => { parentCalls += 1; return 0; } },
  );
  assert.throws(() => invalidParentPresenter.present(null as never), /valid and active/);
  const inactive = new cc.Node('Inactive');
  inactive.active = false;
  assert.throws(() => invalidParentPresenter.present(inactive as never), /valid and active/);
  const destroyed = new cc.Node('Destroyed');
  destroyed.destroy();
  assert.throws(() => invalidParentPresenter.present(destroyed as never), /valid and active/);
  const inactiveAncestor = new cc.Node('InactiveAncestor');
  inactiveAncestor.active = false;
  const inactiveChild = new cc.Node('InactiveChild');
  inactiveChild.setParent(inactiveAncestor);
  assert.throws(() => invalidParentPresenter.present(inactiveChild as never), /valid and active/);
  assert.equal(parentCalls, 0);

  for (const invalidBonus of [0.5, Number.NaN, 0x8000_0000]) {
    let callbackCalls = 0;
    const presenter = ClassicResultRewardPresenter.create(createInput('480x800') as never, {
      onAwardCoins: () => {
        callbackCalls += 1;
        return invalidBonus;
      },
    });
    const parent = new cc.Node('BonusParent');
    const createdBefore = cc.createdNodes.length;

    assert.throws(() => presenter.present(parent as never), /signed 32-bit integer/);
    const partialNodes = cc.createdNodes.slice(createdBefore);
    assert.deepEqual(partialNodes.map(({ name }) => name), [
      'ClassicResultRewardEffect',
      'ClassicResultRewardCoin',
      'ClassicResultRewardBadge',
    ]);
    assert.equal(callbackCalls, 1);
    assert.equal(parent.children.length, 0);
    assert.equal(partialNodes.every(({ destroyed: isDestroyed }) => isDestroyed), true);
    assert.equal(presenter.effect, null);
    assert.equal(presenter.coin, null);
    assert.equal(presenter.badge, null);
    assert.equal(presenter.bonusLabel, null);
    assert.deepEqual(presenter.state, {
      awardAttempted: true,
      bonusCoins: null,
      disposed: true,
      presented: false,
      presenting: false,
      rotationDegrees: 0,
    });
  }
});

test('accounting re-entry, throw, and disposal remain at-most-once and terminal-safe', () => {
  const reentryParent = new cc.Node('ReentryParent');
  let reentryCalls = 0;
  let reentryPresenter: RewardPresenter;
  reentryPresenter = ClassicResultRewardPresenter.create(
    createInput('480x800') as never,
    {
      onAwardCoins: () => {
        reentryCalls += 1;
        assert.throws(
          () => reentryPresenter.present(reentryParent as never),
          /presented only once/,
        );
        return 7;
      },
    },
  );
  assert.equal(reentryPresenter.present(reentryParent as never), 7);
  assert.equal(reentryCalls, 1);

  const callbackFailure = new Error('accounting callback failed');
  let failureCalls = 0;
  const failedPresenter = ClassicResultRewardPresenter.create(
    createInput('480x800') as never,
    {
      onAwardCoins: () => {
        failureCalls += 1;
        throw callbackFailure;
      },
    },
  );
  const failureParent = new cc.Node('FailureParent');
  assert.throws(
    () => failedPresenter.present(failureParent as never),
    (error) => error === callbackFailure,
  );
  assert.equal(failureCalls, 1);
  assert.equal(failureParent.children.length, 0);
  assert.deepEqual(failedPresenter.state, {
    awardAttempted: true,
    bonusCoins: null,
    disposed: true,
    presented: false,
    presenting: false,
    rotationDegrees: 0,
  });
  assert.throws(
    () => failedPresenter.present(failureParent as never),
    /presented only once/,
  );
  assert.equal(failureCalls, 1);

  let disposalCalls = 0;
  let disposedPresenter: RewardPresenter;
  disposedPresenter = ClassicResultRewardPresenter.create(
    createInput('480x800') as never,
    {
      onAwardCoins: () => {
        disposalCalls += 1;
        assert.equal(disposedPresenter.dispose(), true);
        return 5;
      },
    },
  );
  const disposalParent = new cc.Node('DisposalParent');
  assert.throws(
    () => disposedPresenter.present(disposalParent as never),
    /disposed during coin accounting/,
  );
  assert.equal(disposalCalls, 1);
  assert.equal(disposalParent.children.length, 0);
  assert.equal(disposedPresenter.state.disposed, true);
  assert.equal(disposedPresenter.dispose(), false);
});

test('presenter source adds no audio, fade, scale tween, or automatic expiry behavior', () => {
  const source = readFileSync(
    `${REPOSITORY_ROOT}game/assets/scripts/creator/classic-result-reward-presenter.ts`,
    'utf8',
  );

  assert.doesNotMatch(
    source,
    /AudioSource|playOneShot|UIOpacity|\btween\(|fade(?:In|Out|To)?/i,
  );
  assert.doesNotMatch(source, /scheduleOnce|setTimeout|expiry/i);
  assert.match(source, /CLASSIC_RESULT_REWARD_ROTATION_PLAN\.action\.seconds/);
  assert.match(source, /CLASSIC_RESULT_REWARD_ROTATION_PLAN\.action\.degrees/);
  assert.match(source, /const bonusCoins = this\.lifecycle\.onAwardCoins\(\)/);
  assert.match(source, /this\.badge = createSprite[\s\S]*?onAwardCoins\(\)[\s\S]*?createLabel/);
});

function createInput(assetTree: AssetTree): RewardInput {
  const resources = getClassicResultResources(assetTree);
  const viewport = assetTree === '480x800'
    ? { x: 0, y: 0, width: 480, height: 800 }
    : { x: 0, y: 0, width: 720, height: 1280 };
  return {
    badgeResource: loadedRaster(resources.bonusCoinsBadge),
    coinResource: loadedRaster(resources.coin),
    effectResource: loadedRaster(resources.bonusCoinsEffect),
    fontResource: {
      canonicalPath: CLASSIC_RESULT_FONT_RESOURCES.slabThing.canonicalPath,
      font: new cc.Font(),
    },
    viewport,
  };
}

function loadedRaster(resource: ClassicRasterResource): LoadedRaster {
  return {
    ...resource,
    spriteFrame: new cc.SpriteFrame(resource.dimensions.width, resource.dimensions.height),
  };
}

function presentedSprite(value: unknown): PresentedSpriteStub {
  assert.notEqual(value, null);
  return value as PresentedSpriteStub;
}

function presentedNode(value: unknown): StubNode {
  return presentedSprite(value).node;
}

function presentedLabel(
  presenter: RewardPresenter,
): Readonly<{ label: StubLabel; node: StubNode; transform: StubTransform }> {
  assert.notEqual(presenter.bonusLabel, null);
  return presenter.bonusLabel as unknown as Readonly<{
    label: StubLabel;
    node: StubNode;
    transform: StubTransform;
  }>;
}

function assertSprite(presented: PresentedSpriteStub, resource: LoadedRaster): void {
  assert.equal(presented.sprite.sizeMode, 2);
  assert.equal(presented.sprite.spriteFrame, resource.spriteFrame);
  assert.deepEqual(size(presented.transform.contentSize), resource.dimensions);
  assert.deepEqual(point(presented.transform.anchorPoint), { x: 0.5, y: 0.5 });
  assert.deepEqual(color(presented.sprite.color), { r: 255, g: 255, b: 255, a: 255 });
}

function color(value: StubColor): { a: number; b: number; g: number; r: number } {
  return { r: value.r, g: value.g, b: value.b, a: value.a };
}

function point(value: Readonly<{ x: number; y: number }>): { x: number; y: number } {
  return { x: value.x, y: value.y };
}

function size(
  value: Readonly<{ height: number; width: number }>,
): { height: number; width: number } {
  return { width: value.width, height: value.height };
}

function vector3(
  value: Readonly<{ x: number; y: number; z: number }>,
): { x: number; y: number; z: number } {
  return { x: value.x, y: value.y, z: value.z };
}
