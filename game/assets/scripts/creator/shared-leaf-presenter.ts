import {
  Node,
  Sprite,
  UIOpacity,
  UITransform,
  isValid,
} from 'cc';

import {
  SHARED_LEAF_CREATION_ORDER,
  SHARED_LEAF_SLOT_COUNT,
  SHARED_LEAF_SPRITE_OPACITY,
  SharedLeafLayerModel,
  type SharedLeafRandom,
  type SharedLeafSlotSnapshot,
  type SharedLeafVisibleBounds,
} from '../domain/shared-leaf-layer';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import type { LoadedGameRasterResource } from './game-resource-loader';
import { SharedLeafPhysicsAdapter } from './shared-leaf-physics-adapter';
import type { SharedLeafPresenterHandle } from './shared-game-scene-presenter';

export interface SharedLeafViewport {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface SharedLeafPresenterInput {
  readonly assetTree: ClassicAssetTree;
  readonly random: SharedLeafRandom;
  readonly resources: readonly LoadedGameRasterResource[];
  readonly viewport: SharedLeafViewport;
}

interface PresentedLeaf {
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly spriteNode: Node;
  readonly transform: UITransform;
}

/** Exact seven-leaf visual adapter backed by its own project-owned Box2D world. */
export class SharedLeafPresenter implements SharedLeafPresenterHandle {
  readonly root: Node;

  private disposedValue = false;
  private readonly leaves: readonly PresentedLeaf[];
  private readonly model: SharedLeafLayerModel;
  private readonly physics: SharedLeafPhysicsAdapter;
  private readonly viewportCenter: Readonly<{ x: number; y: number }>;

  private constructor(input: SharedLeafPresenterInput) {
    const visibleBounds = createVisibleBounds(input.viewport);
    this.viewportCenter = Object.freeze({
      x: input.viewport.x + input.viewport.width / 2,
      y: input.viewport.y + input.viewport.height / 2,
    });
    this.model = new SharedLeafLayerModel({
      assetTree: input.assetTree,
      random: input.random,
      visibleBounds,
    });
    this.physics = new SharedLeafPhysicsAdapter(this.model.snapshot());
    this.root = new Node('SharedLeafRoot');
    this.leaves = Object.freeze(this.model.snapshot().slots.map((slot, slotIndex) => {
      const resource = requireResource(input.resources, slot, slotIndex);
      const node = new Node(`SharedLeaf-${SHARED_LEAF_CREATION_ORDER[slotIndex]}`);
      node.setParent(this.root);
      node.setSiblingIndex(slotIndex);
      const spriteNode = new Node(`SharedLeafSprite-${slot.asset.leafId}`);
      spriteNode.setParent(node);
      spriteNode.setSiblingIndex(0);
      const transform = spriteNode.addComponent(UITransform);
      transform.setAnchorPoint(0.5, 0.5);
      transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
      const sprite = spriteNode.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.spriteFrame = resource.spriteFrame;
      const opacity = spriteNode.addComponent(UIOpacity);
      opacity.opacity = SHARED_LEAF_SPRITE_OPACITY;
      spriteNode.setPosition(0, 0, 0);
      spriteNode.setScale(1, 1, 1);
      return Object.freeze({ node, opacity, spriteNode, transform });
    }));
    this.synchronizeDisplay(this.model.snapshot().slots);
  }

  static create(input: SharedLeafPresenterInput): SharedLeafPresenter {
    assertInput(input);
    return new SharedLeafPresenter(input);
  }

  get disposed(): boolean {
    return this.disposedValue;
  }

  update(deltaSeconds: number): void {
    if (this.disposedValue || !isValid(this.root, true)) {
      return;
    }
    const frame = this.model.stepFrame(deltaSeconds, this.physics);
    this.synchronizeDisplay(frame.snapshot.slots);
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.physics.dispose();
    if (isValid(this.root, true)) {
      this.root.destroy();
    }
    return true;
  }

  private synchronizeDisplay(slots: readonly SharedLeafSlotSnapshot[]): void {
    for (let slotIndex = 0; slotIndex < SHARED_LEAF_SLOT_COUNT; slotIndex += 1) {
      const slot = slots[slotIndex];
      const presented = this.leaves[slotIndex];
      if (slot === undefined || presented === undefined) {
        throw new Error(`Shared leaf display slot ${slotIndex} is missing`);
      }
      presented.node.setPosition(
        slot.display.positionWorldUnits.x - this.viewportCenter.x,
        slot.display.positionWorldUnits.y - this.viewportCenter.y,
        0,
      );
      presented.node.setRotationFromEuler(0, 0, slot.display.rotationDegrees);
      presented.opacity.opacity = slot.display.opacity;
    }
  }
}

function createVisibleBounds(viewport: SharedLeafViewport): SharedLeafVisibleBounds {
  return Object.freeze({
    bottomYWorldUnits: viewport.y,
    heightWorldUnits: viewport.height,
    topYWorldUnits: viewport.y + viewport.height,
    widthWorldUnits: viewport.width,
  });
}

function assertInput(input: SharedLeafPresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Shared leaf presenter input must be an object');
  }
  if (input.assetTree !== '480x800' && input.assetTree !== '720x1280') {
    throw new RangeError('Shared leaf assetTree must be 480x800 or 720x1280');
  }
  if (
    input.random === null
    || typeof input.random !== 'object'
    || typeof input.random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('Shared leaf presenter requires shared nextIntInclusive RNG');
  }
  if (!Array.isArray(input.resources) || input.resources.length !== SHARED_LEAF_SLOT_COUNT) {
    throw new RangeError(`Shared leaf presenter requires ${SHARED_LEAF_SLOT_COUNT} rasters`);
  }
  if (input.viewport === null || typeof input.viewport !== 'object') {
    throw new TypeError('Shared leaf viewport must be an object');
  }
  if (
    !Number.isFinite(input.viewport.x)
    || !Number.isFinite(input.viewport.y)
    || !Number.isFinite(input.viewport.width)
    || !Number.isFinite(input.viewport.height)
  ) {
    throw new RangeError('Shared leaf viewport values must be finite');
  }
  if (input.viewport.width <= 0 || input.viewport.height <= 0) {
    throw new RangeError('Shared leaf viewport dimensions must be positive');
  }
}

function requireResource(
  resources: readonly LoadedGameRasterResource[],
  slot: SharedLeafSlotSnapshot,
  slotIndex: number,
): LoadedGameRasterResource {
  const resource = resources[slotIndex];
  if (resource === undefined || !isValid(resource.spriteFrame, true)) {
    throw new Error(`Shared leaf raster ${slotIndex} is missing`);
  }
  if (
    resource.canonicalPath !== slot.asset.profilePath
    || resource.dimensions.width !== slot.asset.widthWorldUnits
    || resource.dimensions.height !== slot.asset.heightWorldUnits
  ) {
    throw new RangeError(`Shared leaf raster ${slotIndex} does not match recovered creation order`);
  }
  return resource;
}
