import {
  Node,
  Sprite,
  UIOpacity,
  UITransform,
  isValid,
} from 'cc';

import type { BladeSegment } from '../domain/blade-tracks';
import {
  STANDARD_BLADE_PARTICLE_Z_ORDER,
  createStandardBladeParticleSpawnCommands,
  type StandardBladeParticleRandom,
  type StandardBladeParticleSpawnCommand,
} from '../domain/standard-blade-particle-plan';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import {
  getStandardBladeParticleResources,
  type StandardBasicBladeId,
  type StandardBladeParticleLogicalPath,
} from '../domain/standard-blade-resource-contract';
import type { LoadedGameRasterResource } from './game-resource-loader';

const INITIAL_SCALE = 1;
const FINAL_SCALE = 0;
const MAX_OPACITY = 255;
const PARTICLE_ROTATION_X_DEGREES = 1;
const PARTICLE_ROTATION_Y_DEGREES = 1;

export interface StandardBladeParticlePresenterInput {
  readonly assetTree: ClassicAssetTree;
  readonly random: StandardBladeParticleRandom;
  readonly resources: readonly LoadedGameRasterResource[];
  readonly selectedBladeId: StandardBasicBladeId;
  readonly viewportWidth: number;
}

export interface PresentedStandardBladeParticle {
  readonly command: StandardBladeParticleSpawnCommand;
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly sprite: Sprite;
  readonly spriteNode: Node;
  readonly transform: UITransform;
}

interface ActiveStandardBladeParticle {
  elapsedSeconds: number;
  readonly presented: PresentedStandardBladeParticle;
}

/**
 * Creator-side lifecycle for the recovered move-only particles of Basic blade IDs 7..12.
 *
 * The owner invokes `presentMovedSegment` only after an accepted move. Touch begin deliberately
 * has no particle hook, and visual particles stay independent from the effects-audio setting.
 */
export class StandardBladeParticlePresenter {
  private readonly activeParticles: ActiveStandardBladeParticle[] = [];
  private attachedParent: Node | null = null;
  private disposed = false;
  private readonly input: StandardBladeParticlePresenterInput;
  private readonly resourceByLogicalPath: ReadonlyMap<
    StandardBladeParticleLogicalPath,
    LoadedGameRasterResource
  >;
  private spawnSequence = 0;

  private constructor(input: StandardBladeParticlePresenterInput) {
    this.input = input;
    this.resourceByLogicalPath = createResourceMap(input);
  }

  static create(
    input: StandardBladeParticlePresenterInput,
  ): StandardBladeParticlePresenter {
    assertInput(input);
    return new StandardBladeParticlePresenter(input);
  }

  get particles(): readonly PresentedStandardBladeParticle[] {
    return Object.freeze(
      this.activeParticles.map(({ presented }) => presented),
    );
  }

  attach(parent: Node): void {
    if (!isValid(parent, true)) {
      throw new Error('Standard blade particle parent must be valid');
    }
    if (this.disposed) {
      throw new Error('Disposed standard blade particles cannot be attached');
    }
    if (this.attachedParent !== null) {
      throw new Error('Standard blade particles are already attached');
    }
    this.attachedParent = parent;
  }

  presentMovedSegment(segment: BladeSegment): void {
    const parent = this.requireReady('present a moved segment');
    assertSegment(segment);
    const retainedCount = this.activeParticles.length;
    const retainedSequence = this.spawnSequence;
    try {
      createStandardBladeParticleSpawnCommands(
        this.input.selectedBladeId,
        segment.current,
        this.input.viewportWidth,
        this.input.random,
        (command) => this.spawn(parent, command),
      );
    } catch (error) {
      for (
        let index = this.activeParticles.length - 1;
        index >= retainedCount;
        index -= 1
      ) {
        const active = this.activeParticles[index];
        if (active !== undefined && isValid(active.presented.node, true)) {
          active.presented.node.destroy();
        }
        this.activeParticles.splice(index, 1);
      }
      this.spawnSequence = retainedSequence;
      throw error;
    }
  }

  update(deltaSeconds: number): void {
    this.requireReady('update');
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    for (let index = this.activeParticles.length - 1; index >= 0; index -= 1) {
      const active = this.activeParticles[index];
      if (active === undefined) {
        continue;
      }
      const { command, node, opacity, spriteNode } = active.presented;
      active.elapsedSeconds = Math.min(
        command.lifetimeSeconds,
        active.elapsedSeconds + deltaSeconds,
      );
      const progress = active.elapsedSeconds / command.lifetimeSeconds;
      node.setPosition(
        command.basePosition.x + command.delta.x * progress,
        command.basePosition.y + command.delta.y * progress,
        0,
      );
      const scale = command.scaleOutEnabled
        ? INITIAL_SCALE + (FINAL_SCALE - INITIAL_SCALE) * progress
        : INITIAL_SCALE;
      spriteNode.setScale(scale, scale, INITIAL_SCALE);
      spriteNode.setRotationFromEuler(
        command.rotationEnabled ? PARTICLE_ROTATION_X_DEGREES * progress : 0,
        command.rotationEnabled ? PARTICLE_ROTATION_Y_DEGREES * progress : 0,
        command.initialRotationDegrees,
      );
      opacity.opacity = command.fadeOutEnabled
        ? MAX_OPACITY * (1 - progress)
        : MAX_OPACITY;

      if (active.elapsedSeconds >= command.lifetimeSeconds) {
        if (isValid(node, true)) {
          node.destroy();
        }
        this.activeParticles.splice(index, 1);
      }
    }
  }

  dispose(): boolean {
    if (this.disposed) {
      return false;
    }
    this.disposed = true;
    this.attachedParent = null;
    for (const { presented } of this.activeParticles) {
      if (isValid(presented.node, true)) {
        presented.node.destroy();
      }
    }
    this.activeParticles.length = 0;
    return true;
  }

  private spawn(
    parent: Node,
    command: StandardBladeParticleSpawnCommand,
  ): void {
    const resource = this.resourceByLogicalPath.get(command.logicalPath);
    if (resource === undefined) {
      throw new Error(
        `Loaded standard blade particle is missing ${command.logicalPath}`,
      );
    }
    let node: Node | null = null;
    let spriteNode: Node | null = null;
    try {
      node = new Node(`StandardBladeParticle-${this.spawnSequence}`);
      this.spawnSequence += 1;
      node.active = false;
      node.layer = parent.layer;
      node.setPosition(command.basePosition.x, command.basePosition.y, 0);

      spriteNode = new Node('StandardBladeParticleSprite');
      spriteNode.setParent(node);
      spriteNode.layer = parent.layer;
      spriteNode.setPosition(0, 0, 0);
      spriteNode.setScale(INITIAL_SCALE, INITIAL_SCALE, INITIAL_SCALE);
      spriteNode.setRotationFromEuler(0, 0, command.initialRotationDegrees);
      const transform = spriteNode.addComponent(UITransform);
      transform.setContentSize(
        resource.dimensions.width,
        resource.dimensions.height,
      );
      transform.setAnchorPoint(0.5, 0.5);
      const opacity = spriteNode.addComponent(UIOpacity);
      opacity.opacity = MAX_OPACITY;
      const sprite = spriteNode.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.spriteFrame = resource.spriteFrame;

      const presented: PresentedStandardBladeParticle = Object.freeze({
        command,
        node,
        opacity,
        sprite,
        spriteNode,
        transform,
      });
      node.setParent(parent);
      node.setSiblingIndex(command.attachmentZOrder);
      node.active = true;
      this.activeParticles.push({
        elapsedSeconds: 0,
        presented,
      });
    } catch (error) {
      if (
        spriteNode !== null
        && spriteNode.parent !== node
        && isValid(spriteNode, true)
      ) {
        spriteNode.destroy();
      }
      if (node !== null && isValid(node, true)) {
        node.destroy();
      }
      throw error;
    }
  }

  private requireReady(operation: string): Node {
    if (this.disposed) {
      throw new Error(`Disposed standard blade particles cannot ${operation}`);
    }
    const parent = this.attachedParent;
    if (parent === null || !isValid(parent, true)) {
      throw new Error(
        `Standard blade particles must be attached before they can ${operation}`,
      );
    }
    return parent;
  }
}

function createResourceMap(
  input: StandardBladeParticlePresenterInput,
): ReadonlyMap<StandardBladeParticleLogicalPath, LoadedGameRasterResource> {
  const byPath = new Map<
    StandardBladeParticleLogicalPath,
    LoadedGameRasterResource
  >();
  for (const resource of input.resources) {
    const logicalPath = resource.canonicalPath.slice(
      input.assetTree.length + 1,
    ) as StandardBladeParticleLogicalPath;
    if (byPath.has(logicalPath)) {
      throw new Error(`Duplicate loaded standard blade particle ${logicalPath}`);
    }
    byPath.set(logicalPath, resource);
  }
  return byPath;
}

function assertInput(input: StandardBladeParticlePresenterInput): void {
  const expected = getStandardBladeParticleResources(
    input.selectedBladeId,
    input.assetTree,
  );
  if (!Array.isArray(input.resources) || input.resources.length !== expected.length) {
    throw new Error('Standard blade particle resources do not match the selected blade');
  }
  expected.forEach((contract, index) => {
    const loaded = input.resources[index];
    if (
      loaded === undefined
      || loaded.canonicalPath !== contract.canonicalPath
      || loaded.dimensions.width !== contract.dimensions.width
      || loaded.dimensions.height !== contract.dimensions.height
      || !isValid(loaded.spriteFrame, true)
    ) {
      throw new Error(
        `Standard blade particle resource ${index} must match ${contract.canonicalPath}`,
      );
    }
  });
  if (
    input.random === null
    || typeof input.random !== 'object'
    || typeof input.random.nextIntInclusive !== 'function'
    || typeof input.random.nextDecile !== 'function'
  ) {
    throw new TypeError(
      'Standard blade particle random must provide nextIntInclusive() and nextDecile()',
    );
  }
  if (!Number.isFinite(input.viewportWidth) || input.viewportWidth <= 0) {
    throw new RangeError('Standard blade particle viewportWidth must be positive and finite');
  }
}

function assertSegment(segment: BladeSegment): void {
  if (
    segment === null
    || typeof segment !== 'object'
    || !Number.isFinite(segment.current?.x)
    || !Number.isFinite(segment.current?.y)
    || !Number.isFinite(segment.previous?.x)
    || !Number.isFinite(segment.previous?.y)
    || !Number.isSafeInteger(segment.slot)
    || segment.slot < 0
    || segment.slot > 3
    || !Number.isSafeInteger(segment.touchId)
    || segment.touchId === -1
  ) {
    throw new RangeError('Standard blade particle segment is invalid');
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be non-negative and finite`);
  }
}
