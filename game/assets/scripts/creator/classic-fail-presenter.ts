import {
  Node,
  Sprite,
  UIOpacity,
  UITransform,
  isValid,
} from 'cc';

import {
  CLASSIC_FAIL_ACTIVATION_ACTION_SECONDS,
  CLASSIC_FAIL_ENTRY_ACTION_SECONDS,
  CLASSIC_FAIL_MARKER_Z_ORDER,
  CLASSIC_FAIL_TRANSIENT_ACTION_SECONDS,
  createClassicFailActivationPlan,
  createClassicFailMarkerLayouts,
  type ClassicFailMarkerLayout,
  type ClassicFailViewport,
} from '../domain/classic-fail-presentation';
import {
  getClassicPresentationResources,
  type ClassicRasterResource,
} from '../domain/classic-resource-contract';
import type { FailPosition, FailStrike } from '../domain/fail-service';
import type { LoadedClassicRasterResource } from './classic-resource-loader';

const MAX_OPACITY = 255;
const CLASSIC_ASSET_TREES = Object.freeze(['480x800', '720x1280'] as const);

export interface ClassicFailPresenterInput {
  readonly filledResource: LoadedClassicRasterResource;
  readonly normalResource: LoadedClassicRasterResource;
  readonly viewport: ClassicFailViewport;
}

export interface ClassicFailPresenterLifecycle {
  readonly onIndicatorComplete: (strike: FailStrike) => void;
}

export interface PresentedClassicFailMarker {
  readonly layout: ClassicFailMarkerLayout;
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

export interface ClassicFailPresenterState {
  readonly activeTransientCount: number;
  readonly attached: boolean;
  readonly completedStrikes: readonly FailStrike[];
  readonly disposed: boolean;
  readonly entryElapsedActionSeconds: number;
  readonly queuedStrikes: readonly FailStrike[];
}

interface ActiveMarkerAnimation {
  completed: boolean;
  elapsedActionSeconds: number;
  readonly strike: FailStrike;
}

interface ActiveTransient {
  elapsedActionSeconds: number;
  readonly node: Node;
  readonly spriteNode: Node;
}

type MarkerTuple = readonly [
  PresentedClassicFailMarker,
  PresentedClassicFailMarker,
  PresentedClassicFailMarker,
];

/** Exact persistent and transient FruitFailManager raster presentation. */
export class ClassicFailPresenter {
  readonly markers: MarkerTuple;

  private readonly filledResource: LoadedClassicRasterResource;
  private readonly lifecycle: ClassicFailPresenterLifecycle;
  private readonly viewport: ClassicFailViewport;
  private readonly animations = new Map<FailStrike, ActiveMarkerAnimation>();
  private readonly transients: ActiveTransient[] = [];
  private attachedValue = false;
  private disposedValue = false;
  private entryElapsedActionSecondsValue = 0;
  private parent: Node | null = null;

  private constructor(
    input: ClassicFailPresenterInput,
    lifecycle: ClassicFailPresenterLifecycle,
  ) {
    this.filledResource = input.filledResource;
    this.lifecycle = lifecycle;
    this.viewport = Object.freeze({ ...input.viewport });
    this.markers = Object.freeze(createClassicFailMarkerLayouts(this.viewport).map((layout) => {
      const presented = createRasterNode(
        `ClassicFailMarker-${layout.strike}`,
        input.normalResource,
      );
      presented.node.setPosition(
        layout.initialWorldPosition.x,
        layout.initialWorldPosition.y,
        0,
      );
      presented.node.setScale(layout.scale, layout.scale, 1);
      presented.opacity.opacity = 0;
      return Object.freeze({
        layout,
        node: presented.node,
        opacity: presented.opacity,
        sprite: presented.sprite,
        transform: presented.transform,
      });
    })) as MarkerTuple;
  }

  static create(
    input: ClassicFailPresenterInput,
    lifecycle: ClassicFailPresenterLifecycle,
  ): ClassicFailPresenter {
    assertInput(input);
    if (lifecycle === null || typeof lifecycle !== 'object') {
      throw new TypeError('lifecycle must be an object');
    }
    if (typeof lifecycle.onIndicatorComplete !== 'function') {
      throw new TypeError('onIndicatorComplete must be a function');
    }
    return new ClassicFailPresenter(input, lifecycle);
  }

  get state(): ClassicFailPresenterState {
    const queuedStrikes = [...this.animations.keys()];
    const completedStrikes = queuedStrikes.filter(
      (strike) => this.animations.get(strike)?.completed === true,
    );
    return Object.freeze({
      activeTransientCount: this.transients.length,
      attached: this.attachedValue,
      completedStrikes: Object.freeze(completedStrikes),
      disposed: this.disposedValue,
      entryElapsedActionSeconds: this.entryElapsedActionSecondsValue,
      queuedStrikes: Object.freeze(queuedStrikes),
    });
  }

  attach(parent: Node): void {
    if (!isValid(parent, true) || !parent.activeInHierarchy) {
      throw new Error('Classic fail-presenter parent must be valid and active');
    }
    if (this.disposedValue) {
      throw new Error('Disposed Classic fail presenter cannot be attached');
    }
    if (this.attachedValue || this.parent !== null) {
      throw new Error('Classic fail presenter is already attached');
    }

    this.parent = parent;
    for (const marker of this.markers) {
      marker.node.layer = parent.layer;
      marker.node.setParent(parent, true);
      marker.node.setSiblingIndex(CLASSIC_FAIL_MARKER_Z_ORDER);
      marker.node.active = true;
    }
    this.attachedValue = true;
  }

  presentMiss(strike: FailStrike, missPosition: FailPosition): void {
    this.assertActive('present a miss');
    const plan = createClassicFailActivationPlan(strike, missPosition, this.viewport);
    if (this.animations.has(strike)) {
      throw new Error(`Classic fail strike ${strike} is already queued`);
    }
    const marker = this.markers[strike - 1];
    marker.sprite.spriteFrame = this.filledResource.spriteFrame;
    marker.transform.setContentSize(
      this.filledResource.dimensions.width,
      this.filledResource.dimensions.height,
    );
    marker.node.setScale(
      marker.layout.scale * plan.initialScaleMultiplier,
      marker.layout.scale * plan.initialScaleMultiplier,
      1,
    );
    marker.opacity.opacity = plan.initialOpacity;
    this.animations.set(strike, {
      completed: false,
      elapsedActionSeconds: 0,
      strike,
    });
    this.createTransient(plan.transientWorldPosition);
  }

  updateAction(unscaledDeltaSeconds: number): void {
    assertNonNegativeFinite(unscaledDeltaSeconds, 'unscaledDeltaSeconds');
    if (this.disposedValue) {
      return;
    }
    this.assertActive('update actions');
    this.updateEntry(unscaledDeltaSeconds);
    this.updateActivations(unscaledDeltaSeconds);
    this.updateTransients(unscaledDeltaSeconds);
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.attachedValue = false;
    for (const transient of this.transients) {
      destroyTransient(transient);
    }
    this.transients.length = 0;
    for (const marker of this.markers) {
      if (isValid(marker.node, true)) {
        marker.node.destroy();
      }
    }
    this.parent = null;
    return true;
  }

  private updateEntry(deltaSeconds: number): void {
    if (this.entryElapsedActionSecondsValue >= CLASSIC_FAIL_ENTRY_ACTION_SECONDS) {
      return;
    }
    this.entryElapsedActionSecondsValue = Math.min(
      this.entryElapsedActionSecondsValue + deltaSeconds,
      CLASSIC_FAIL_ENTRY_ACTION_SECONDS,
    );
    const progress = this.entryElapsedActionSecondsValue / CLASSIC_FAIL_ENTRY_ACTION_SECONDS;
    for (const marker of this.markers) {
      marker.node.setWorldPosition(
        lerp(marker.layout.initialWorldPosition.x, marker.layout.targetWorldPosition.x, progress),
        lerp(marker.layout.initialWorldPosition.y, marker.layout.targetWorldPosition.y, progress),
        0,
      );
      if (!this.animations.has(marker.layout.strike)) {
        marker.opacity.opacity = MAX_OPACITY * progress;
      }
    }
  }

  private updateActivations(deltaSeconds: number): void {
    const completedNow: FailStrike[] = [];
    for (const animation of this.animations.values()) {
      if (animation.completed) {
        continue;
      }
      animation.elapsedActionSeconds = Math.min(
        animation.elapsedActionSeconds + deltaSeconds,
        CLASSIC_FAIL_ACTIVATION_ACTION_SECONDS,
      );
      const progress = animation.elapsedActionSeconds / CLASSIC_FAIL_ACTIVATION_ACTION_SECONDS;
      const marker = this.markers[animation.strike - 1];
      const scaleMultiplier = lerp(5, 1, progress);
      marker.node.setScale(
        marker.layout.scale * scaleMultiplier,
        marker.layout.scale * scaleMultiplier,
        1,
      );
      marker.opacity.opacity = MAX_OPACITY * progress;
      if (animation.elapsedActionSeconds >= CLASSIC_FAIL_ACTIVATION_ACTION_SECONDS) {
        animation.completed = true;
        completedNow.push(animation.strike);
      }
    }
    for (const strike of completedNow) {
      this.lifecycle.onIndicatorComplete(strike);
    }
  }

  private updateTransients(deltaSeconds: number): void {
    for (let index = this.transients.length - 1; index >= 0; index -= 1) {
      const transient = this.transients[index];
      transient.elapsedActionSeconds = Math.min(
        transient.elapsedActionSeconds + deltaSeconds,
        CLASSIC_FAIL_TRANSIENT_ACTION_SECONDS,
      );
      if (transient.elapsedActionSeconds >= CLASSIC_FAIL_TRANSIENT_ACTION_SECONDS) {
        destroyTransient(transient);
        this.transients.splice(index, 1);
      }
    }
  }

  private createTransient(position: FailPosition): void {
    const parent = this.parent;
    if (parent === null) {
      throw new Error('Classic fail presenter has no parent');
    }
    const node = new Node('ClassicTransientFailAnimation');
    node.active = false;
    node.setPosition(position.x, position.y, 0);
    const spriteNode = createRasterNode('ClassicTransientFailMarker', this.filledResource).node;
    spriteNode.setPosition(0, 0, 0);
    spriteNode.setParent(node);
    spriteNode.setSiblingIndex(CLASSIC_FAIL_MARKER_Z_ORDER);
    node.layer = parent.layer;
    spriteNode.layer = parent.layer;
    node.setParent(parent, true);
    node.setSiblingIndex(CLASSIC_FAIL_MARKER_Z_ORDER);
    node.active = true;
    spriteNode.active = true;
    this.transients.push({ elapsedActionSeconds: 0, node, spriteNode });
  }

  private assertActive(action: string): void {
    if (this.disposedValue) {
      throw new Error(`Disposed Classic fail presenter cannot ${action}`);
    }
    if (!this.attachedValue) {
      throw new Error(`Classic fail presenter must be attached before it can ${action}`);
    }
  }
}

function createRasterNode(
  name: string,
  resource: LoadedClassicRasterResource,
): Readonly<{ node: Node; opacity: UIOpacity; sprite: Sprite; transform: UITransform }> {
  const node = new Node(name);
  node.active = false;
  const transform = node.addComponent(UITransform);
  transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
  transform.setAnchorPoint(0.5, 0.5);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  const opacity = node.addComponent(UIOpacity);
  return Object.freeze({ node, opacity, sprite, transform });
}

function destroyTransient(transient: ActiveTransient): void {
  if (isValid(transient.spriteNode, true)) {
    transient.spriteNode.destroy();
  }
  if (isValid(transient.node, true)) {
    transient.node.destroy();
  }
}

function assertInput(input: ClassicFailPresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('input must be an object');
  }
  assertResourcePair(input.normalResource, input.filledResource);
  createClassicFailMarkerLayouts(input.viewport);
}

function assertResourcePair(
  normalResource: LoadedClassicRasterResource,
  filledResource: LoadedClassicRasterResource,
): void {
  const matchingPresentation = CLASSIC_ASSET_TREES
    .map((assetTree) => getClassicPresentationResources(assetTree))
    .find((presentation) => (
      normalResource?.canonicalPath === presentation.failNormal.canonicalPath
      && filledResource?.canonicalPath === presentation.failFilled.canonicalPath
    ));
  if (matchingPresentation === undefined) {
    throw new RangeError('Fail resources must be the exact normal/filled pair from one asset tree');
  }
  assertResource(normalResource, matchingPresentation.failNormal, 'normalResource');
  assertResource(filledResource, matchingPresentation.failFilled, 'filledResource');
}

function assertResource(
  resource: LoadedClassicRasterResource,
  expected: ClassicRasterResource,
  label: string,
): void {
  if (resource === null || typeof resource !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
  if (
    resource.dimensions.width !== expected.dimensions.width
    || resource.dimensions.height !== expected.dimensions.height
  ) {
    throw new RangeError(`${label} dimensions must match the exact recovered raster`);
  }
  if (!isValid(resource.spriteFrame, true)) {
    throw new Error(`${label}.spriteFrame must be a valid loaded Creator SpriteFrame`);
  }
  const original = resource.spriteFrame.originalSize;
  const rect = resource.spriteFrame.rect;
  if (
    original.width !== expected.dimensions.width
    || original.height !== expected.dimensions.height
    || rect.width !== expected.dimensions.width
    || rect.height !== expected.dimensions.height
  ) {
    throw new RangeError(`${label}.spriteFrame must preserve exact untrimmed raster geometry`);
  }
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}
