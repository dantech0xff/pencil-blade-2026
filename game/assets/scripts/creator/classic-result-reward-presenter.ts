import {
  Color,
  Label,
  Node,
  Sprite,
  UITransform,
  isValid,
} from 'cc';

import { CLASSIC_RESULT_WHITE } from '../domain/classic-result-presentation';
import {
  CLASSIC_RESULT_FONT_RESOURCES,
  getClassicResultResources,
  type ClassicRasterResource,
} from '../domain/classic-resource-contract';
import {
  CLASSIC_RESULT_REWARD_ROTATION_PLAN,
  createClassicResultRewardTree,
  type ClassicResultRewardTree,
  type ClassicResultRewardViewport,
} from '../domain/classic-result-reward-presentation';
import type {
  LoadedClassicFontResource,
  LoadedClassicRasterResource,
} from './classic-resource-loader';

const CLASSIC_ASSET_TREES = Object.freeze(['480x800', '720x1280'] as const);

export interface ClassicResultRewardPresenterInput {
  readonly badgeResource: LoadedClassicRasterResource;
  readonly coinResource: LoadedClassicRasterResource;
  readonly effectResource: LoadedClassicRasterResource;
  readonly fontResource: LoadedClassicFontResource;
  readonly viewport: ClassicResultRewardViewport;
}

export interface ClassicResultRewardPresenterLifecycle {
  /** Native accounting occurs after effect, coin, and badge creation but before the label. */
  readonly onAwardCoins: () => number;
}

export interface ClassicResultRewardPresenterState {
  readonly awardAttempted: boolean;
  readonly bonusCoins: number | null;
  readonly disposed: boolean;
  readonly presented: boolean;
  readonly presenting: boolean;
  readonly rotationDegrees: number;
}

interface PresentedSprite {
  readonly node: Node;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

/** Presents the synchronous tree created by DisplayScoreLayer::TotalCoinsCallback. */
export class ClassicResultRewardPresenter {
  effect: PresentedSprite | null = null;
  coin: PresentedSprite | null = null;
  badge: PresentedSprite | null = null;
  bonusLabel: Readonly<{ label: Label; node: Node; transform: UITransform }> | null = null;

  private readonly input: ClassicResultRewardPresenterInput;
  private readonly lifecycle: ClassicResultRewardPresenterLifecycle;
  private awardAttemptedValue = false;
  private bonusCoinsValue: number | null = null;
  private disposedValue = false;
  private presentingValue = false;
  private presentedValue = false;
  private rotationDegreesValue = 0;

  private constructor(
    input: ClassicResultRewardPresenterInput,
    lifecycle: ClassicResultRewardPresenterLifecycle,
  ) {
    this.input = input;
    this.lifecycle = lifecycle;
  }

  static create(
    input: ClassicResultRewardPresenterInput,
    lifecycle: ClassicResultRewardPresenterLifecycle,
  ): ClassicResultRewardPresenter {
    assertInput(input);
    if (
      lifecycle === null
      || typeof lifecycle !== 'object'
      || typeof lifecycle.onAwardCoins !== 'function'
    ) {
      throw new TypeError('Result reward lifecycle must provide onAwardCoins()');
    }
    return new ClassicResultRewardPresenter(input, lifecycle);
  }

  get state(): ClassicResultRewardPresenterState {
    return Object.freeze({
      awardAttempted: this.awardAttemptedValue,
      bonusCoins: this.bonusCoinsValue,
      disposed: this.disposedValue,
      presented: this.presentedValue,
      presenting: this.presentingValue,
      rotationDegrees: this.rotationDegreesValue,
    });
  }

  present(parent: Node): number {
    if (!isValid(parent, true) || !parent.activeInHierarchy) {
      throw new Error('Classic result reward parent must be valid and active');
    }
    if (
      this.disposedValue
      || this.presentedValue
      || this.presentingValue
      || this.awardAttemptedValue
    ) {
      throw new Error('Classic result reward can be presented only once');
    }

    const prefix = this.createTree(0);
    this.presentingValue = true;
    try {
      this.effect = createSprite('ClassicResultRewardEffect', this.input.effectResource);
      attachWorldSprite(this.effect, parent, prefix.rootChildren[0].worldPosition);

      this.coin = createSprite('ClassicResultRewardCoin', this.input.coinResource);
      attachWorldSprite(this.coin, parent, prefix.rootChildren[1].worldPosition);

      const badgeLayout = prefix.rootChildren[1].children[0];
      this.badge = createSprite('ClassicResultRewardBadge', this.input.badgeResource);
      attachLocalSprite(this.badge, this.coin.node, badgeLayout.creatorLocalPosition);

      // Preserve native mutation order: the Settings update happens after the badge exists.
      // Mark the external accounting boundary first: failure or re-entry can never award twice.
      this.awardAttemptedValue = true;
      const bonusCoins = this.lifecycle.onAwardCoins();
      const completed = this.createTree(bonusCoins);
      if (this.disposedValue || this.coin === null || !isValid(this.coin.node, true)) {
        throw new Error('Classic result reward was disposed during coin accounting');
      }
      const labelLayout = completed.rootChildren[1].children[1];
      this.bonusLabel = createLabel(
        'ClassicResultRewardBonusLabel',
        this.input.fontResource,
        labelLayout.text,
        labelLayout.fontSize,
        labelLayout.anchor,
      );
      this.bonusLabel.node.layer = this.coin.node.layer;
      this.bonusLabel.node.setParent(this.coin.node);
      this.bonusLabel.node.setPosition(
        labelLayout.creatorLocalPosition.x,
        labelLayout.creatorLocalPosition.y,
        0,
      );
      this.bonusLabel.node.setSiblingIndex(1);
      this.bonusLabel.node.active = true;

      this.bonusCoinsValue = bonusCoins;
      this.presentedValue = true;
      this.presentingValue = false;
      return bonusCoins;
    } catch (error) {
      this.destroyOwnedNodes();
      this.presentingValue = false;
      if (this.awardAttemptedValue) {
        this.disposedValue = true;
      }
      throw error;
    }
  }

  updateAction(unscaledDeltaSeconds: number): void {
    if (!Number.isFinite(unscaledDeltaSeconds) || unscaledDeltaSeconds < 0) {
      throw new RangeError('unscaledDeltaSeconds must be finite and non-negative');
    }
    if (this.disposedValue || !this.presentedValue) {
      return;
    }
    const effect = this.effect;
    if (effect === null || !isValid(effect.node, true)) {
      this.disposedValue = true;
      this.presentedValue = false;
      this.destroyOwnedNodes();
      return;
    }
    const cycleSeconds = CLASSIC_RESULT_REWARD_ROTATION_PLAN.action.seconds;
    const cycleDeltaSeconds = unscaledDeltaSeconds % cycleSeconds;
    this.rotationDegreesValue = (
      this.rotationDegreesValue
      + cycleDeltaSeconds
      / CLASSIC_RESULT_REWARD_ROTATION_PLAN.action.seconds
      * CLASSIC_RESULT_REWARD_ROTATION_PLAN.action.degrees
    ) % CLASSIC_RESULT_REWARD_ROTATION_PLAN.action.degrees;
    effect.node.setRotationFromEuler(0, 0, this.rotationDegreesValue);
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.presentedValue = false;
    this.destroyOwnedNodes();
    return true;
  }

  private createTree(bonusCoins: number): ClassicResultRewardTree {
    return createClassicResultRewardTree(this.input.viewport, {
      badge: this.input.badgeResource.dimensions,
      coin: this.input.coinResource.dimensions,
      effect: this.input.effectResource.dimensions,
    }, bonusCoins);
  }

  private destroyOwnedNodes(): void {
    // The two root nodes recursively own badge/label in Creator; explicit child destruction
    // also keeps isolated test adapters and partial-construction cleanup deterministic.
    for (const node of [
      this.bonusLabel?.node,
      this.badge?.node,
      this.coin?.node,
      this.effect?.node,
    ]) {
      if (node !== undefined && isValid(node, true)) {
        node.destroy();
      }
    }
    this.bonusLabel = null;
    this.badge = null;
    this.coin = null;
    this.effect = null;
  }
}

function createSprite(
  name: string,
  resource: LoadedClassicRasterResource,
): PresentedSprite {
  const node = new Node(name);
  node.active = false;
  const transform = node.addComponent(UITransform);
  transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
  transform.setAnchorPoint(0.5, 0.5);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  sprite.color = new Color(255, 255, 255, 255);
  return Object.freeze({ node, sprite, transform });
}

function attachWorldSprite(
  presented: PresentedSprite,
  parent: Node,
  position: Readonly<{ x: number; y: number }>,
): void {
  presented.node.layer = parent.layer;
  presented.node.setParent(parent);
  presented.node.setWorldPosition(position.x, position.y, 0);
  presented.node.active = true;
}

function attachLocalSprite(
  presented: PresentedSprite,
  parent: Node,
  position: Readonly<{ x: number; y: number }>,
): void {
  presented.node.layer = parent.layer;
  presented.node.setParent(parent);
  presented.node.setPosition(position.x, position.y, 0);
  presented.node.setSiblingIndex(0);
  presented.node.active = true;
}

function createLabel(
  name: string,
  fontResource: LoadedClassicFontResource,
  text: string,
  fontSize: number,
  anchor: Readonly<{ x: number; y: number }>,
): Readonly<{ label: Label; node: Node; transform: UITransform }> {
  const node = new Node(name);
  node.active = false;
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(anchor.x, anchor.y);
  const label = node.addComponent(Label);
  label.font = fontResource.font;
  label.fontSize = fontSize;
  label.lineHeight = fontSize;
  label.string = text;
  label.color = new Color(
    CLASSIC_RESULT_WHITE.r,
    CLASSIC_RESULT_WHITE.g,
    CLASSIC_RESULT_WHITE.b,
    255,
  );
  return Object.freeze({ label, node, transform });
}

function assertInput(input: ClassicResultRewardPresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Classic result reward input must be an object');
  }
  const expected = CLASSIC_ASSET_TREES
    .map((assetTree) => getClassicResultResources(assetTree))
    .find((candidate) => (
      input.badgeResource?.canonicalPath === candidate.bonusCoinsBadge.canonicalPath
      && input.coinResource?.canonicalPath === candidate.coin.canonicalPath
      && input.effectResource?.canonicalPath === candidate.bonusCoinsEffect.canonicalPath
    ));
  if (expected === undefined) {
    throw new RangeError('Reward resources must be the exact raster set from one asset tree');
  }
  assertLoadedRaster(input.badgeResource, expected.bonusCoinsBadge, 'badgeResource');
  assertLoadedRaster(input.coinResource, expected.coin, 'coinResource');
  assertLoadedRaster(input.effectResource, expected.bonusCoinsEffect, 'effectResource');

  // The pure contract also validates viewport and the exact layout geometry values.
  createClassicResultRewardTree(input.viewport, {
    badge: input.badgeResource.dimensions,
    coin: input.coinResource.dimensions,
    effect: input.effectResource.dimensions,
  }, 0);
  if (
    input.fontResource === null
    || typeof input.fontResource !== 'object'
    || input.fontResource.canonicalPath !== CLASSIC_RESULT_FONT_RESOURCES.slabThing.canonicalPath
  ) {
    throw new RangeError('fontResource must be the exact recovered Classic reward font');
  }
  if (!isValid(input.fontResource.font, true)) {
    throw new Error('fontResource.font must be valid');
  }
}

function assertLoadedRaster(
  loaded: LoadedClassicRasterResource,
  expected: ClassicRasterResource,
  label: string,
): void {
  if (
    loaded === null
    || typeof loaded !== 'object'
    || loaded.dimensions?.width !== expected.dimensions.width
    || loaded.dimensions?.height !== expected.dimensions.height
  ) {
    throw new RangeError(`${label} dimensions must match the exact recovered raster`);
  }
  if (!isValid(loaded.spriteFrame, true)) {
    throw new Error(`${label}.spriteFrame must be valid`);
  }
  const original = loaded.spriteFrame.originalSize;
  const rect = loaded.spriteFrame.rect;
  if (
    original?.width !== expected.dimensions.width
    || original?.height !== expected.dimensions.height
    || rect?.width !== expected.dimensions.width
    || rect?.height !== expected.dimensions.height
  ) {
    throw new RangeError(`${label}.spriteFrame must preserve exact untrimmed raster geometry`);
  }
}
