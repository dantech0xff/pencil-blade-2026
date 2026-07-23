import {
  Node,
  Sprite,
  UIOpacity,
  UITransform,
  isValid,
} from 'cc';

import {
  SHARED_BACKGROUND_DEFAULT_INDEX,
  getSharedBackgroundResource,
} from '../domain/shared-game-scene-resources';
import type { LoadedGameRasterResource } from './game-resource-loader';

export class SharedBackgroundPresenter {
  readonly root: Node;
  readonly spriteNode: Node;

  private readonly resources: readonly LoadedGameRasterResource[];
  private readonly opacity: UIOpacity;
  private readonly sprite: Sprite;
  private readonly transform: UITransform;
  private disposedValue = false;
  private selectedIndexValue: number;

  private constructor(
    resources: readonly LoadedGameRasterResource[],
    selectedIndex: number,
  ) {
    this.resources = resources;
    this.selectedIndexValue = selectedIndex;
    this.root = new Node('SharedBackgroundRoot');
    this.spriteNode = new Node('SharedBackgroundSprite');
    this.spriteNode.setParent(this.root);
    this.spriteNode.setSiblingIndex(0);
    this.transform = this.spriteNode.addComponent(UITransform);
    this.transform.setAnchorPoint(0.5, 0.5);
    this.sprite = this.spriteNode.addComponent(Sprite);
    this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.opacity = this.spriteNode.addComponent(UIOpacity);
    this.applyInitialResource(selectedIndex);
  }

  static create(
    resources: readonly LoadedGameRasterResource[],
    selectedIndex = SHARED_BACKGROUND_DEFAULT_INDEX,
  ): SharedBackgroundPresenter {
    assertResourceFamily(resources, 9, 'background');
    assertIndex(selectedIndex, 0, 8, 'selected background index');
    return new SharedBackgroundPresenter(resources, selectedIndex);
  }

  get selectedIndex(): number {
    return this.selectedIndexValue;
  }

  get disposed(): boolean {
    return this.disposedValue;
  }

  attach(parent: Node, siblingIndex: number): void {
    this.assertUsable('attach');
    if (!isValid(parent, true) || !parent.active) {
      throw new Error('Shared background parent must be valid and active');
    }
    if (this.root.parent !== null) {
      throw new Error('Shared background is already attached');
    }
    this.root.layer = parent.layer;
    this.spriteNode.layer = parent.layer;
    this.root.setParent(parent);
    this.root.setSiblingIndex(siblingIndex);
  }

  select(index: number): void {
    this.assertUsable('select');
    assertIndex(index, 0, 8, 'background index');
    const resource = requireResource(this.resources[index], 'background', index);
    const retainedWidth = this.transform.contentSize.width;
    const retainedHeight = this.transform.contentSize.height;
    this.sprite.spriteFrame = resource.spriteFrame;
    this.transform.setContentSize(retainedWidth, retainedHeight);
    this.opacity.opacity = 255;
    this.selectedIndexValue = index;
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    if (isValid(this.root, true)) {
      this.root.destroy();
    }
    return true;
  }

  private applyInitialResource(index: number): void {
    const resource = requireResource(this.resources[index], 'background', index);
    this.sprite.spriteFrame = resource.spriteFrame;
    this.transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
    this.spriteNode.setPosition(0, 0, 0);
    this.spriteNode.setScale(1, 1, 1);
    this.opacity.opacity = 255;
  }

  private assertUsable(action: string): void {
    if (this.disposedValue || !isValid(this.root, true)) {
      throw new Error(`Disposed shared background cannot ${action}`);
    }
  }
}

function assertResourceFamily(
  resources: readonly LoadedGameRasterResource[],
  expectedLength: number,
  family: string,
): void {
  if (!Array.isArray(resources) || resources.length !== expectedLength) {
    throw new RangeError(`Shared ${family} resources must contain ${expectedLength} rasters`);
  }
  for (let index = 0; index < resources.length; index += 1) {
    const expected = getSharedBackgroundResource(resourceTree(resources[index]), index);
    const resource = requireResource(resources[index], family, index);
    if (
      resource.canonicalPath !== expected.canonicalPath
      || resource.dimensions.width !== expected.dimensions.width
      || resource.dimensions.height !== expected.dimensions.height
    ) {
      throw new RangeError(`Shared ${family} resource ${index} is not the recovered raster`);
    }
  }
}

function resourceTree(resource: LoadedGameRasterResource | undefined): '480x800' | '720x1280' {
  if (resource?.canonicalPath.startsWith('480x800/')) {
    return '480x800';
  }
  if (resource?.canonicalPath.startsWith('720x1280/')) {
    return '720x1280';
  }
  throw new RangeError('Shared background resource must belong to one canonical asset tree');
}

function requireResource(
  resource: LoadedGameRasterResource | undefined,
  family: string,
  index: number,
): LoadedGameRasterResource {
  if (resource === undefined || !isValid(resource.spriteFrame, true)) {
    throw new Error(`Missing loaded shared ${family} SpriteFrame ${index}`);
  }
  return resource;
}

function assertIndex(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer from ${minimum} through ${maximum}`);
  }
}
