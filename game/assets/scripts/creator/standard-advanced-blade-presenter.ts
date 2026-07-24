import {
  Node,
  Sprite,
  UIOpacity,
  UITransform,
  Vec3,
  isValid,
} from 'cc';

import type { BladePoint } from '../domain/blade-tracks';
import {
  StandardAdvancedBladeState,
  type StandardAdvancedBladeLayout,
  type StandardAdvancedBladeSpriteTransform,
} from '../domain/standard-advanced-blade-state';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import {
  STANDARD_ADVANCED_BLADE_POINT_CAPACITY,
  getStandardCentipedeBladeResources,
  getStandardDragonBladeResources,
  type StandardBladeMultipartResources,
  type StandardDragonBladeId,
} from '../domain/standard-blade-resource-contract';
import {
  assertExactSpriteFrameGeometry,
  type LoadedGameRasterResource,
} from './game-resource-loader';
import type {
  LoadedStandardBladeMultipartResources,
  LoadedStandardBladeResourceProfile,
} from './standard-blade-resource-loader';

export const STANDARD_ADVANCED_BLADE_Z_ORDER = 1 as const;

const FULL_OPACITY = 255;

type LoadedStandardAdvancedBladeProfile = Extract<
  LoadedStandardBladeResourceProfile,
  Readonly<{ readonly kind: 'dragon' | 'centipede' }>
>;

export interface StandardAdvancedBladePresenterInput {
  readonly assetTree: ClassicAssetTree;
  readonly profile: LoadedStandardBladeResourceProfile;
}

export interface PresentedStandardAdvancedBladeSprite {
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly sprite: Sprite;
  readonly transform: UITransform;
  readonly zOrder: typeof STANDARD_ADVANCED_BLADE_Z_ORDER;
}

export interface StandardAdvancedBladeSlotOwner {
  readonly bodies: readonly PresentedStandardAdvancedBladeSprite[];
  readonly head: PresentedStandardAdvancedBladeSprite;
  readonly node: Node;
  readonly slot: number;
  readonly tail: PresentedStandardAdvancedBladeSprite;
  readonly zOrder: typeof STANDARD_ADVANCED_BLADE_Z_ORDER;
}

/**
 * Creator owner for the four recovered Dragon/Centipede standard-blade slots.
 *
 * Sampling and lifecycle decisions stay in StandardAdvancedBladeState. This class owns only
 * the exact multipart Sprite topology and maps the model's world/UI layouts into root space.
 */
export class StandardAdvancedBladePresenter {
  readonly model: StandardAdvancedBladeState;
  readonly owners: readonly StandardAdvancedBladeSlotOwner[];
  readonly root: Node;
  readonly selectedBladeId: StandardDragonBladeId | 17;

  private attached = false;
  private disposed = false;
  private readonly localPoint = new Vec3();
  private readonly worldPoint = new Vec3();

  private constructor(
    profile: LoadedStandardAdvancedBladeProfile,
    model: StandardAdvancedBladeState,
    root: Node,
    owners: readonly StandardAdvancedBladeSlotOwner[],
  ) {
    this.selectedBladeId = profile.bladeId;
    this.model = model;
    this.root = root;
    this.owners = owners;
  }

  static create(
    input: StandardAdvancedBladePresenterInput,
  ): StandardAdvancedBladePresenter {
    const profile = requireAdvancedProfile(input);
    const resources = profile.resources;
    const model = new StandardAdvancedBladeState(profile.kind, {
      body: resources.body.dimensions.width,
      head: resources.head.dimensions.width,
      tail: resources.tail.dimensions.width,
    });

    let root: Node | null = null;
    try {
      root = new Node('StandardAdvancedBladeRoot');
      root.active = false;
      root.setPosition(0, 0, 0);
      const owners = Object.freeze(Array.from(
        { length: model.slotCount },
        (_, slot) => createSlotOwner(root!, slot, resources),
      ));
      return new StandardAdvancedBladePresenter(
        profile,
        model,
        root,
        owners,
      );
    } catch (error) {
      if (root !== null && isValid(root, true)) {
        root.destroy();
      }
      throw error;
    }
  }

  attach(parent: Node): void {
    this.assertUsable('attach');
    if (this.attached || this.root.parent !== null) {
      throw new Error('Standard advanced blade presenter is already attached');
    }
    try {
      if (!isValid(parent, true)) {
        throw new Error('Standard advanced blade parent must be valid');
      }
      applyLayerRecursively(this.root, parent.layer);
      // Model layouts use native lower-left world/UI points. Preserve the detached root's
      // identity transform so a translated Canvas parent does not offset those points twice.
      this.root.setParent(parent, true);
      this.root.setSiblingIndex(STANDARD_ADVANCED_BLADE_Z_ORDER);
      this.root.active = true;
      this.attached = true;
    } catch (error) {
      try {
        this.dispose();
      } catch {
        // Preserve the attachment failure that selected the rollback path.
      }
      throw error;
    }
  }

  begin(slot: number): void {
    this.assertReady('begin');
    this.model.begin(slot);
  }

  move(slot: number, point: BladePoint): StandardAdvancedBladeLayout {
    this.assertReady('move');
    const layout = this.model.move(slot, point);
    this.applyLayout(slot, layout);
    return layout;
  }

  end(slot: number): void {
    this.assertReady('end');
    this.model.end(slot);
  }

  isClaimed(slot: number): boolean {
    this.assertReady('inspect ownership');
    return this.model.isClaimed(slot);
  }

  updateFrame(): readonly number[] {
    this.assertReady('update');
    const changed = this.model.updateFrame();
    for (const slot of changed) {
      this.applyLayout(slot, this.model.layout(slot));
    }
    return changed;
  }

  dispose(): boolean {
    if (this.disposed) {
      return false;
    }
    this.disposed = true;
    this.attached = false;
    if (isValid(this.root, true)) {
      this.root.destroy();
    }
    return true;
  }

  private applyLayout(
    slot: number,
    layout: StandardAdvancedBladeLayout,
  ): void {
    const owner = this.owners[slot];
    if (owner === undefined) {
      throw new RangeError(`Advanced blade slot must be from 0 through ${this.owners.length - 1}`);
    }
    hideSlot(owner);
    if (!layout.visible) {
      return;
    }
    if (
      layout.bodyPoolSize !== owner.bodies.length
      || layout.head === null
      || layout.tail === null
    ) {
      throw new Error(`Advanced blade slot ${slot} produced an invalid visible layout`);
    }

    this.applySprite(owner.head, layout.head);
    this.applySprite(owner.tail, layout.tail);
    const usedBodies = new Set<number>();
    for (const body of layout.bodies) {
      if (
        body.bodyIndex <= 0
        || body.bodyIndex >= owner.bodies.length
        || usedBodies.has(body.bodyIndex)
      ) {
        throw new Error(
          `Advanced blade slot ${slot} produced invalid body index ${body.bodyIndex}`,
        );
      }
      usedBodies.add(body.bodyIndex);
      this.applySprite(owner.bodies[body.bodyIndex]!, body);
    }
  }

  private applySprite(
    owner: PresentedStandardAdvancedBladeSprite,
    value: StandardAdvancedBladeSpriteTransform,
  ): void {
    this.worldPoint.x = value.position.x;
    this.worldPoint.y = value.position.y;
    this.worldPoint.z = 0;
    this.root.inverseTransformPoint(this.localPoint, this.worldPoint);
    owner.node.setPosition(
      this.localPoint.x,
      this.localPoint.y,
      this.localPoint.z,
    );
    owner.node.setRotationFromEuler(0, 0, value.rotationDegrees);
    owner.node.setScale(value.scale, value.scale, 1);
    owner.opacity.opacity = value.opacity;
    owner.node.active = true;
  }

  private assertUsable(operation: string): void {
    if (this.disposed || !isValid(this.root, true)) {
      throw new Error(
        `Disposed standard advanced blade presenter cannot ${operation}`,
      );
    }
  }

  private assertReady(operation: string): void {
    this.assertUsable(operation);
    if (
      !this.attached
      || this.root.parent === null
      || !isValid(this.root.parent, true)
    ) {
      throw new Error(
        `Standard advanced blade presenter must be attached before it can ${operation}`,
      );
    }
  }
}

function requireAdvancedProfile(
  input: StandardAdvancedBladePresenterInput,
): LoadedStandardAdvancedBladeProfile {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Standard advanced blade input must be an object');
  }
  const profile = input.profile;
  if (
    profile === null
    || typeof profile !== 'object'
    || (profile.kind !== 'dragon' && profile.kind !== 'centipede')
  ) {
    throw new Error(
      'Standard advanced blade requires an exact loaded Dragon or Centipede profile',
    );
  }
  if (!Array.isArray(profile.particles) || profile.particles.length !== 0) {
    throw new Error('Standard advanced blade profiles cannot contain particle resources');
  }

  let expected: StandardBladeMultipartResources;
  if (profile.kind === 'dragon') {
    expected = getStandardDragonBladeResources(profile.bladeId, input.assetTree);
    if (profile.variant !== profile.bladeId - 13) {
      throw new Error(
        `Standard Dragon blade ${profile.bladeId} has an invalid variant`,
      );
    }
  } else {
    if (profile.bladeId !== 17) {
      throw new Error('Standard Centipede blade profile must use blade ID 17');
    }
    expected = getStandardCentipedeBladeResources(input.assetTree);
  }
  assertExactMultipartResources(profile.resources, expected);
  return profile;
}

function assertExactMultipartResources(
  loaded: LoadedStandardBladeMultipartResources,
  expected: StandardBladeMultipartResources,
): void {
  if (loaded === null || typeof loaded !== 'object') {
    throw new Error('Standard advanced blade multipart resources are missing');
  }
  if (
    loaded.bodySegmentCount !== expected.bodySegmentCount
    || loaded.pointCapacity !== expected.pointCapacity
    || loaded.pointCapacity !== STANDARD_ADVANCED_BLADE_POINT_CAPACITY
  ) {
    throw new Error('Standard advanced blade multipart capacities do not match the exact contract');
  }
  assertExactLoadedRaster(loaded.head, expected.head, 'head');
  assertExactLoadedRaster(loaded.body, expected.body, 'body');
  assertExactLoadedRaster(loaded.tail, expected.tail, 'tail');
}

function assertExactLoadedRaster(
  loaded: LoadedGameRasterResource,
  expected: StandardBladeMultipartResources['head'],
  label: string,
): void {
  if (
    loaded === null
    || typeof loaded !== 'object'
    || loaded.canonicalPath !== expected.canonicalPath
    || loaded.dimensions === null
    || typeof loaded.dimensions !== 'object'
    || loaded.dimensions.width !== expected.dimensions.width
    || loaded.dimensions.height !== expected.dimensions.height
  ) {
    throw new Error(
      `Standard advanced blade ${label} does not match its exact resource contract`,
    );
  }
  if (!isValid(loaded.spriteFrame, true)) {
    throw new Error(`Standard advanced blade ${label} SpriteFrame must be valid`);
  }
  assertExactSpriteFrameGeometry(loaded.spriteFrame, expected);
}

function createSlotOwner(
  root: Node,
  slot: number,
  resources: LoadedStandardBladeMultipartResources,
): StandardAdvancedBladeSlotOwner {
  const node = new Node(`StandardAdvancedBlade-${slot}`);
  try {
    node.setParent(root);
    const head = createSpriteOwner('StandardAdvancedBladeHead', node, resources.head);
    const bodies = Object.freeze(Array.from(
      { length: resources.bodySegmentCount },
      (_, bodyIndex) => createSpriteOwner(
        `StandardAdvancedBladeBody-${bodyIndex}`,
        node,
        resources.body,
      ),
    ));
    const tail = createSpriteOwner('StandardAdvancedBladeTail', node, resources.tail);
    return Object.freeze({
      bodies,
      head,
      node,
      slot,
      tail,
      zOrder: STANDARD_ADVANCED_BLADE_Z_ORDER,
    });
  } catch (error) {
    if (isValid(node, true)) {
      node.destroy();
    }
    throw error;
  }
}

function createSpriteOwner(
  name: string,
  parent: Node,
  resource: LoadedGameRasterResource,
): PresentedStandardAdvancedBladeSprite {
  const node = new Node(name);
  try {
    node.active = false;
    node.setParent(parent);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(
      resource.dimensions.width,
      resource.dimensions.height,
    );
    const opacity = node.addComponent(UIOpacity);
    opacity.opacity = FULL_OPACITY;
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = resource.spriteFrame;
    return Object.freeze({
      node,
      opacity,
      sprite,
      transform,
      zOrder: STANDARD_ADVANCED_BLADE_Z_ORDER,
    });
  } catch (error) {
    if (isValid(node, true)) {
      node.destroy();
    }
    throw error;
  }
}

function hideSlot(owner: StandardAdvancedBladeSlotOwner): void {
  owner.head.node.active = false;
  owner.tail.node.active = false;
  for (const body of owner.bodies) {
    body.node.active = false;
  }
}

function applyLayerRecursively(node: Node, layer: number): void {
  node.layer = layer;
  for (const child of node.children) {
    applyLayerRecursively(child, layer);
  }
}
