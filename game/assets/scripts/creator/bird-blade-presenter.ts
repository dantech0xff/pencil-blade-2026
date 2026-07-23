import {
  Material,
  Mesh,
  MeshRenderer,
  Node,
  Sprite,
  UIMeshRenderer,
  UIOpacity,
  UITransform,
  Vec3,
  gfx,
  isValid,
} from 'cc';

import {
  BASIC_BLADE_LEGACY_VERTEX_CAPACITY_BYTES,
  BASIC_BLADE_LEGACY_VERTEX_STRIDE_BYTES,
  BASIC_BLADE_POINT_LIMIT,
  createBasicBladeGeometry,
  getBasicBladeDefaultWidth,
  type BasicBladeGeometry,
  type BasicBladeUv,
} from '../domain/basic-blade-trail';
import type {
  BirdBladeParticleSpawnCommand,
} from '../domain/bird-blade-particle-plan';
import {
  BirdBladeStateMachine,
  type BirdBladePoint,
  type BirdBladeRandom,
  type BirdBladeRaySegment,
  type BirdBladeStateSnapshot,
  type BirdBladeTouchResult,
  type BirdBladeUpdateResult,
  type BirdBladeViewport,
} from '../domain/bird-blade-state';
import {
  BIRD_ANIMATION_FRAME_COUNT,
  BIRD_RASTER_RESOURCE_COUNT,
  getBirdResourceProfile,
} from '../domain/bird-resource-contract';
import type {
  GameRasterResource,
} from '../domain/game-resource-contract';
import type {
  LoadedBirdResources,
} from './bird-resource-loader';
import type {
  LoadedGameRasterResource,
} from './game-resource-loader';

export const BIRD_BLADE_Z_ORDER = 1 as const;
export const BIRD_BLADE_ANIMATION_FRAME_DELAY_SECONDS = Math.fround(0.1);
export const BIRD_BLADE_MATERIAL_TECHNIQUE = 3 as const;

const INITIAL_SCALE = 1;
const FINAL_SCALE = 0;
const MAX_OPACITY = 255;
const PARTICLE_ROTATION_X_DEGREES = 1;
const PARTICLE_ROTATION_Y_DEGREES = 1;
const TRAIL_DISPOSAL_WIDTH_DIVISOR = Math.fround(1.1);
const ANIMATION_EPSILON_SECONDS = 1e-9;

export interface BirdBladePresenterInput {
  readonly random: BirdBladeRandom;
  readonly resources: LoadedBirdResources;
  readonly viewport: BirdBladeViewport;
}

export interface PresentedBirdBladeSprite {
  readonly node: Node;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

export interface PresentedBirdBladeParticle {
  readonly command: BirdBladeParticleSpawnCommand;
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly sprite: Sprite;
  readonly spriteNode: Node;
  readonly transform: UITransform;
}

export interface BirdBladeTrailSnapshot {
  readonly currentWidth: number;
  readonly disposing: boolean;
  readonly geometry: BasicBladeGeometry | null;
  readonly points: readonly BirdBladePoint[];
}

export interface BirdBladePresenterSnapshot {
  readonly animationFrameIndex: number;
  readonly attached: boolean;
  readonly blade: BirdBladeStateSnapshot;
  readonly disposed: boolean;
  readonly leftVisible: boolean;
  readonly mainVisible: boolean;
  readonly particleCount: number;
  readonly rightVisible: boolean;
  readonly trail: BirdBladeTrailSnapshot;
}

interface ActiveBirdBladeParticle {
  elapsedSeconds: number;
  readonly presented: PresentedBirdBladeParticle;
}

interface BirdBladeMeshOwner {
  readonly meshRenderer: MeshRenderer;
  readonly node: Node;
  readonly uiMeshRenderer: UIMeshRenderer;
  readonly vertexBytes: Uint8Array;
}

/**
 * Creator presentation for the recovered BirdBlade visual types.
 *
 * The state machine owns movement/RNG/ray semantics. This class owns only one textured
 * testblade7 trail, three Bird sprites, and native ParticleObject-style actions.
 */
export class BirdBladePresenter {
  readonly leftDirection: PresentedBirdBladeSprite;
  readonly main: PresentedBirdBladeSprite;
  readonly rightDirection: PresentedBirdBladeSprite;
  readonly root: Node;
  readonly state: BirdBladeStateMachine;

  private readonly resources: LoadedBirdResources;
  private readonly trail: BirdBladeSingleTrail;
  private readonly activeParticles: ActiveBirdBladeParticle[] = [];
  private animationFrameIndexValue = 0;
  private animationRemainderSeconds = 0;
  private attachedValue = false;
  private disposedValue = false;

  private constructor(input: BirdBladePresenterInput) {
    this.resources = input.resources;
    this.state = new BirdBladeStateMachine({
      random: input.random,
      type: input.resources.birdType,
      viewport: input.viewport,
    });

    this.root = new Node('BirdBladeRoot');
    this.root.active = false;
    this.root.setPosition(0, 0, 0);

    this.trail = new BirdBladeSingleTrail(
      this.root,
      input.viewport.width,
      input.resources.blade,
    );
    this.main = createRasterSprite(
      'BirdBladeMain',
      input.resources.animationFrames[0],
    );
    this.leftDirection = createRasterSprite(
      'BirdBladeLeft',
      input.resources.leftDirection,
    );
    this.rightDirection = createRasterSprite(
      'BirdBladeRight',
      input.resources.rightDirection,
    );

    this.main.node.setParent(this.root);
    this.leftDirection.node.setParent(this.root);
    this.leftDirection.node.setSiblingIndex(BIRD_BLADE_Z_ORDER);
    this.rightDirection.node.setParent(this.root);
    this.rightDirection.node.setSiblingIndex(BIRD_BLADE_Z_ORDER);
    this.applyInitialVisualState();
  }

  static create(input: BirdBladePresenterInput): BirdBladePresenter {
    assertInput(input);
    return new BirdBladePresenter(input);
  }

  get isAttached(): boolean {
    return this.attachedValue;
  }

  get isDisposed(): boolean {
    return this.disposedValue;
  }

  get particles(): readonly PresentedBirdBladeParticle[] {
    return Object.freeze(
      this.activeParticles.map(({ presented }) => presented),
    );
  }

  get snapshot(): BirdBladePresenterSnapshot {
    return Object.freeze({
      animationFrameIndex: this.animationFrameIndexValue,
      attached: this.attachedValue,
      blade: this.state.snapshot(),
      disposed: this.disposedValue,
      leftVisible: this.leftDirection.node.active,
      mainVisible: this.main.node.active,
      particleCount: this.activeParticles.length,
      rightVisible: this.rightDirection.node.active,
      trail: this.trail.snapshot(),
    });
  }

  attach(parent: Node): void {
    if (!isValid(parent, true) || !parent.active) {
      throw new Error('BirdBlade parent must be valid and active');
    }
    if (this.disposedValue || !isValid(this.root, true)) {
      throw new Error('Disposed BirdBlade presenter cannot be attached');
    }
    if (this.attachedValue || this.root.parent !== null) {
      throw new Error('BirdBlade presenter is already attached');
    }

    applyLayerRecursively(this.root, parent.layer);
    // Bird state emits native lower-left world points. Preserve this detached root's world
    // origin so a translated/rotated/scaled Canvas screen does not apply its transform twice.
    this.root.setParent(parent, true);
    this.root.setSiblingIndex(BIRD_BLADE_Z_ORDER);
    this.root.active = true;
    this.attachedValue = true;
  }

  /**
   * The input controller deliberately calls this for every start. Busy rejection occurs in
   * the pure state before point validation and leaves presentation untouched.
   */
  touch(point: BirdBladePoint): BirdBladeTouchResult {
    this.assertReady('accept touches');
    const result = this.state.touch(point);
    if (!result.accepted) {
      return result;
    }

    this.trail.setNew();
    this.leftDirection.node.active = false;
    this.rightDirection.node.active = false;
    const snapshot = this.state.snapshot();
    const active = result.activeDirection === 'left'
      ? this.leftDirection
      : this.rightDirection;
    active.node.setPosition(
      snapshot.currentPosition.x,
      snapshot.currentPosition.y,
      0,
    );
    active.node.setRotationFromEuler(0, 0, result.rotationDegrees ?? 0);
    active.node.active = true;
    // Native Touch does not hide the main sprite; moving update does so next.
    return result;
  }

  /**
   * Runs one native BirdBlade update. The pure state always performs its particle plan,
   * including idle/intro updates, before any command is visually materialized.
   */
  update(deltaSeconds: number): BirdBladeUpdateResult {
    this.assertReady('update');
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    const actionDeltaSeconds = Math.fround(deltaSeconds);
    if (!Number.isFinite(actionDeltaSeconds)) {
      throw new RangeError('deltaSeconds must fit in a finite float32');
    }

    this.advanceMainAnimation(actionDeltaSeconds);
    this.trail.updateDisposalFrame();
    this.advanceParticles(actionDeltaSeconds);

    const result = this.state.update(actionDeltaSeconds);
    this.applyUpdateVisuals(result);
    for (const command of result.particleCommands) {
      this.spawnParticle(command);
    }
    return result;
  }

  peekCachedRaySegment(): BirdBladeRaySegment | null {
    this.assertReady('inspect cached rays');
    return this.state.peekCachedRaySegment();
  }

  acknowledgeCachedRay(): boolean {
    this.assertReady('acknowledge cached rays');
    return this.state.acknowledgeCachedRay();
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.attachedValue = false;
    for (const particle of this.activeParticles) {
      if (isValid(particle.presented.node, true)) {
        particle.presented.node.destroy();
      }
    }
    this.activeParticles.length = 0;
    this.trail.dispose();
    if (isValid(this.root, true)) {
      this.root.destroy();
    }
    return true;
  }

  private applyInitialVisualState(): void {
    const position = this.state.snapshot().currentPosition;
    for (const presented of [
      this.main,
      this.leftDirection,
      this.rightDirection,
    ]) {
      presented.node.setPosition(position.x, position.y, 0);
    }
    this.main.node.active = true;
    this.leftDirection.node.active = false;
    this.rightDirection.node.active = false;
  }

  private applyUpdateVisuals(result: BirdBladeUpdateResult): void {
    const position = result.snapshot.currentPosition;
    switch (result.branch) {
      case 'idle':
        this.leftDirection.node.active = false;
        this.rightDirection.node.active = false;
        this.main.node.active = true;
        this.main.node.setPosition(position.x, position.y, 0);
        break;
      case 'moving': {
        this.main.node.active = false;
        const active = result.snapshot.activeDirection === 'left'
          ? this.leftDirection
          : this.rightDirection;
        active.node.active = true;
        active.node.setPosition(position.x, position.y, 0);
        this.trail.push(position);
        break;
      }
      case 'settle':
        this.trail.end();
        // Native state 2 changes only the blade trail/state. The prior directional
        // sprite remains visible until the following idle update.
        break;
    }
  }

  private advanceMainAnimation(deltaSeconds: number): void {
    this.animationRemainderSeconds += deltaSeconds;
    const frameAdvance = Math.floor(
      (this.animationRemainderSeconds + ANIMATION_EPSILON_SECONDS)
        / BIRD_BLADE_ANIMATION_FRAME_DELAY_SECONDS,
    );
    if (frameAdvance <= 0) {
      return;
    }
    this.animationRemainderSeconds -= (
      frameAdvance * BIRD_BLADE_ANIMATION_FRAME_DELAY_SECONDS
    );
    this.animationFrameIndexValue = (
      this.animationFrameIndexValue + frameAdvance
    ) % BIRD_ANIMATION_FRAME_COUNT;
    const resource = this.resources.animationFrames[
      this.animationFrameIndexValue
    ];
    if (resource === undefined) {
      throw new Error(
        `Bird animation frame ${this.animationFrameIndexValue} is unavailable`,
      );
    }
    applyRasterToSprite(this.main, resource);
  }

  private spawnParticle(command: BirdBladeParticleSpawnCommand): void {
    assertParticleCommand(command);
    const resource = this.resources.particles[command.selection];
    if (resource === undefined) {
      throw new Error(`Bird particle selection ${command.selection} is unavailable`);
    }
    const expectedLogicalPath = resource.canonicalPath.slice(
      resource.canonicalPath.indexOf('/') + 1,
    );
    if (expectedLogicalPath !== command.logicalPath) {
      throw new Error(
        `Bird particle resource mismatch for ${command.logicalPath}`,
      );
    }

    const node = new Node(`BirdBladeParticle-${command.selection}`);
    node.active = false;
    node.layer = this.root.layer;
    node.setPosition(
      command.basePosition.x,
      command.basePosition.y,
      0,
    );

    const spriteNode = new Node('BirdBladeParticleSprite');
    spriteNode.layer = this.root.layer;
    spriteNode.setPosition(0, 0, 0);
    spriteNode.setScale(INITIAL_SCALE, INITIAL_SCALE, INITIAL_SCALE);
    spriteNode.setRotationFromEuler(0, 0, 0);
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
    spriteNode.setParent(node);

    const copiedCommand = copyParticleCommand(command);
    const presented: PresentedBirdBladeParticle = Object.freeze({
      command: copiedCommand,
      node,
      opacity,
      sprite,
      spriteNode,
      transform,
    });
    node.setParent(this.root);
    node.setSiblingIndex(command.attachmentZOrder);
    node.active = true;
    this.activeParticles.push({
      elapsedSeconds: 0,
      presented,
    });
  }

  private advanceParticles(deltaSeconds: number): void {
    for (let index = this.activeParticles.length - 1; index >= 0; index -= 1) {
      const active = this.activeParticles[index];
      if (active === undefined) {
        continue;
      }
      const command = active.presented.command;
      active.elapsedSeconds = Math.min(
        command.lifetimeSeconds,
        active.elapsedSeconds + deltaSeconds,
      );
      const progress = active.elapsedSeconds / command.lifetimeSeconds;
      active.presented.spriteNode.setPosition(
        command.randomOffset.x * progress,
        command.randomOffset.y * progress,
        0,
      );
      const scale = INITIAL_SCALE + (FINAL_SCALE - INITIAL_SCALE) * progress;
      active.presented.spriteNode.setScale(scale, scale, INITIAL_SCALE);
      active.presented.spriteNode.setRotationFromEuler(
        PARTICLE_ROTATION_X_DEGREES * progress,
        PARTICLE_ROTATION_Y_DEGREES * progress,
        0,
      );
      active.presented.opacity.opacity = MAX_OPACITY * (1 - progress);

      if (active.elapsedSeconds >= command.lifetimeSeconds) {
        if (isValid(active.presented.node, true)) {
          active.presented.node.destroy();
        }
        this.activeParticles.splice(index, 1);
      }
    }
  }

  private assertReady(operation: string): void {
    if (this.disposedValue || !isValid(this.root, true)) {
      throw new Error(`Disposed BirdBlade presenter cannot ${operation}`);
    }
    if (!this.attachedValue || this.root.parent === null) {
      throw new Error(`BirdBlade presenter must be attached before it can ${operation}`);
    }
  }
}

class BirdBladeSingleTrail {
  private readonly baseWidth: number;
  private currentWidth: number;
  private disposing = false;
  private geometryValue: BasicBladeGeometry | null = null;
  private readonly material: Material;
  private readonly owner: BirdBladeMeshOwner;
  private readonly points: BirdBladePoint[] = [];
  private readonly spriteUv: readonly number[];

  constructor(
    parent: Node,
    viewportWidth: number,
    resource: LoadedGameRasterResource,
  ) {
    this.baseWidth = getBasicBladeDefaultWidth(viewportWidth);
    this.currentWidth = this.baseWidth;
    this.material = createBladeMaterial(resource);
    this.spriteUv = Object.freeze([...resource.spriteFrame.uv]);
    assertSpriteUv(this.spriteUv);
    this.owner = createMeshOwner(parent, this.material);
  }

  setNew(): void {
    this.points.length = 0;
    this.currentWidth = this.baseWidth;
    this.disposing = false;
    this.geometryValue = null;
    updateLegacyLayoutMesh(this.owner, null, this.spriteUv);
  }

  push(point: BirdBladePoint): void {
    if (this.disposing) {
      this.setNew();
    }
    this.points.push(copyFloat32Point(point));
    if (this.points.length > BASIC_BLADE_POINT_LIMIT) {
      this.points.splice(0, 2);
    }
    this.rebuild();
  }

  end(): void {
    this.disposing = true;
  }

  updateDisposalFrame(): void {
    if (!this.disposing) {
      return;
    }
    if (this.points.length >= 2) {
      this.points.splice(0, 1);
      this.rebuild();
      this.currentWidth = Math.fround(
        this.currentWidth / TRAIL_DISPOSAL_WIDTH_DIVISOR,
      );
      return;
    }
    this.setNew();
  }

  snapshot(): BirdBladeTrailSnapshot {
    return Object.freeze({
      currentWidth: this.currentWidth,
      disposing: this.disposing,
      geometry: this.geometryValue,
      points: Object.freeze(this.points.map(copyPoint)),
    });
  }

  dispose(): void {
    const mesh = this.owner.meshRenderer.mesh;
    this.owner.meshRenderer.mesh = null;
    this.owner.meshRenderer.setSharedMaterial(null, 0);
    mesh?.destroy();
    this.material.destroy();
  }

  private rebuild(): void {
    this.geometryValue = createBasicBladeGeometry(
      this.points,
      this.currentWidth,
    );
    updateLegacyLayoutMesh(
      this.owner,
      this.geometryValue,
      this.spriteUv,
    );
  }
}

function createRasterSprite(
  name: string,
  resource: LoadedGameRasterResource,
): PresentedBirdBladeSprite {
  const node = new Node(name);
  const transform = node.addComponent(UITransform);
  transform.setContentSize(
    resource.dimensions.width,
    resource.dimensions.height,
  );
  transform.setAnchorPoint(0.5, 0.5);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  return Object.freeze({ node, sprite, transform });
}

function applyRasterToSprite(
  presented: PresentedBirdBladeSprite,
  resource: LoadedGameRasterResource,
): void {
  presented.transform.setContentSize(
    resource.dimensions.width,
    resource.dimensions.height,
  );
  presented.sprite.spriteFrame = resource.spriteFrame;
}

function createMeshOwner(
  parent: Node,
  material: Material,
): BirdBladeMeshOwner {
  const node = new Node('BirdBladeTrail');
  node.setParent(parent);
  node.addComponent(UITransform);
  const meshRenderer = node.addComponent(MeshRenderer);
  meshRenderer.setSharedMaterial(material, 0);
  const vertexBytes = new Uint8Array(
    BASIC_BLADE_LEGACY_VERTEX_CAPACITY_BYTES,
  );
  meshRenderer.mesh = createPersistentLegacyLayoutMesh(vertexBytes);
  const uiMeshRenderer = node.addComponent(UIMeshRenderer);
  return Object.freeze({
    meshRenderer,
    node,
    uiMeshRenderer,
    vertexBytes,
  });
}

function createBladeMaterial(
  resource: LoadedGameRasterResource,
): Material {
  const material = new Material();
  material.reset({
    effectName: 'builtin-unlit',
    technique: BIRD_BLADE_MATERIAL_TECHNIQUE,
    defines: {
      USE_TEXTURE: true,
      USE_VERTEX_COLOR: true,
    },
    states: {
      primitive: gfx.PrimitiveMode.TRIANGLE_STRIP,
      depthStencilState: {
        depthTest: false,
        depthWrite: false,
      },
    },
  });
  material.setProperty('mainTexture', resource.spriteFrame.texture);
  return material;
}

function createPersistentLegacyLayoutMesh(
  vertexBytes: Uint8Array,
): Mesh {
  const vertexCapacity = BASIC_BLADE_LEGACY_VERTEX_CAPACITY_BYTES
    / BASIC_BLADE_LEGACY_VERTEX_STRIDE_BYTES;
  const mesh = new Mesh('BirdBladeTrailMesh');
  mesh.reset({
    struct: {
      vertexBundles: [{
        attributes: [
          new gfx.Attribute(
            gfx.AttributeName.ATTR_POSITION,
            gfx.Format.RG32F,
          ),
          new gfx.Attribute(
            gfx.AttributeName.ATTR_COLOR,
            gfx.Format.RGBA8,
            true,
          ),
          new gfx.Attribute(
            gfx.AttributeName.ATTR_TEX_COORD,
            gfx.Format.RG32F,
          ),
        ],
        view: {
          count: 0,
          length: BASIC_BLADE_LEGACY_VERTEX_CAPACITY_BYTES,
          offset: 0,
          stride: BASIC_BLADE_LEGACY_VERTEX_STRIDE_BYTES,
        },
      }],
      primitives: [{
        primitiveMode: gfx.PrimitiveMode.TRIANGLE_STRIP,
        vertexBundelIndices: [0],
      }],
      minPosition: new Vec3(),
      maxPosition: new Vec3(),
      dynamic: {
        info: {
          maxSubMeshes: 1,
          maxSubMeshIndices: 0,
          maxSubMeshVertices: vertexCapacity,
        },
        bounds: [],
      },
    },
    data: vertexBytes,
  });
  return mesh;
}

function updateLegacyLayoutMesh(
  owner: BirdBladeMeshOwner,
  geometry: BasicBladeGeometry | null,
  spriteUv: readonly number[],
): void {
  const mesh = owner.meshRenderer.mesh;
  if (mesh === null) {
    throw new Error('BirdBlade trail lost its persistent mesh');
  }
  const vertexBundle = mesh.struct.vertexBundles[0];
  const subMesh = mesh.renderingSubMeshes[0];
  const vertexBuffer = subMesh?.vertexBuffers[0];
  const drawInfo = subMesh?.drawInfo;
  if (
    vertexBundle === undefined
    || subMesh === undefined
    || vertexBuffer === undefined
    || !drawInfo
  ) {
    throw new Error('BirdBlade trail persistent mesh is incomplete');
  }
  if (geometry === null) {
    vertexBundle.view.count = 0;
    drawInfo.vertexCount = 0;
    mesh.struct.minPosition = new Vec3();
    mesh.struct.maxPosition = new Vec3();
    subMesh.invalidateGeometricInfo();
    owner.meshRenderer.onGeometryChanged();
    return;
  }

  const vertexCount = geometry.vertices.length;
  const updateBytes = (
    vertexCount * BASIC_BLADE_LEGACY_VERTEX_STRIDE_BYTES
  );
  if (updateBytes > owner.vertexBytes.byteLength) {
    throw new Error('BirdBlade trail exceeded its recovered 500-byte capacity');
  }
  const bytes = owner.vertexBytes;
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
  const localPoint = new Vec3();
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  geometry.vertices.forEach((vertex, index) => {
    owner.node.inverseTransformPoint(
      localPoint,
      new Vec3(vertex.position.x, vertex.position.y, 0),
    );
    const offset = index * BASIC_BLADE_LEGACY_VERTEX_STRIDE_BYTES;
    view.setFloat32(offset, localPoint.x, true);
    view.setFloat32(offset + 4, localPoint.y, true);
    bytes[offset + 8] = MAX_OPACITY;
    bytes[offset + 9] = MAX_OPACITY;
    bytes[offset + 10] = MAX_OPACITY;
    bytes[offset + 11] = MAX_OPACITY;
    const mappedUv = mapSpriteUv(spriteUv, vertex.alphaUv);
    view.setFloat32(offset + 12, mappedUv.u, true);
    view.setFloat32(offset + 16, mappedUv.v, true);
    minX = Math.min(minX, localPoint.x);
    minY = Math.min(minY, localPoint.y);
    maxX = Math.max(maxX, localPoint.x);
    maxY = Math.max(maxY, localPoint.y);
  });

  vertexBundle.view.count = vertexCount;
  drawInfo.vertexCount = vertexCount;
  mesh.struct.minPosition = new Vec3(minX, minY, 0);
  mesh.struct.maxPosition = new Vec3(maxX, maxY, 0);
  vertexBuffer.update(bytes.subarray(0, updateBytes), updateBytes);
  subMesh.invalidateGeometricInfo();
  owner.meshRenderer.onGeometryChanged();
}

function mapSpriteUv(
  spriteUv: readonly number[],
  alphaUv: BasicBladeUv,
): BasicBladeUv {
  const bottomLeftU = spriteUv[0]!;
  const bottomLeftV = spriteUv[1]!;
  const bottomRightU = spriteUv[2]!;
  const bottomRightV = spriteUv[3]!;
  const topLeftU = spriteUv[4]!;
  const topLeftV = spriteUv[5]!;
  return Object.freeze({
    u: Math.fround(
      bottomLeftU
      + (bottomRightU - bottomLeftU) * alphaUv.u
      + (topLeftU - bottomLeftU) * alphaUv.v,
    ),
    v: Math.fround(
      bottomLeftV
      + (bottomRightV - bottomLeftV) * alphaUv.u
      + (topLeftV - bottomLeftV) * alphaUv.v,
    ),
  });
}

function assertInput(input: BirdBladePresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('input must be an object');
  }
  if (input.viewport === null || typeof input.viewport !== 'object') {
    throw new TypeError('viewport must be an object');
  }
  if (
    !Number.isFinite(input.viewport.width)
    || input.viewport.width <= 0
    || !Number.isFinite(input.viewport.height)
    || input.viewport.height <= 0
  ) {
    throw new RangeError('viewport width and height must be positive and finite');
  }
  if (
    input.random === null
    || typeof input.random !== 'object'
    || typeof input.random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive(minimum, maximum)');
  }
  assertResources(input.resources);
}

function assertResources(resources: LoadedBirdResources): void {
  if (resources === null || typeof resources !== 'object') {
    throw new TypeError('resources must be an object');
  }
  const profile = getBirdResourceProfile(
    resources.assetTree,
    resources.birdType,
  );
  if (resources.profile !== profile) {
    throw new RangeError(
      `resources profile must match Bird type ${profile.birdType}`,
    );
  }
  const expected = [
    profile.blade,
    ...profile.animationFrames,
    profile.leftDirection,
    profile.rightDirection,
    ...profile.particles,
  ];
  if (resources.rasterCount !== BIRD_RASTER_RESOURCE_COUNT) {
    throw new RangeError(
      `resources rasterCount must be ${BIRD_RASTER_RESOURCE_COUNT}`,
    );
  }
  if (
    !Array.isArray(resources.orderedRasters)
    || expected.length !== BIRD_RASTER_RESOURCE_COUNT
    || resources.orderedRasters.length !== BIRD_RASTER_RESOURCE_COUNT
  ) {
    throw new RangeError(
      `resources must contain all ${BIRD_RASTER_RESOURCE_COUNT} Bird rasters`,
    );
  }
  expected.forEach((contract, index) => {
    const loaded = resources.orderedRasters[index];
    if (loaded === undefined) {
      throw new Error(`Bird raster ${index} is unavailable`);
    }
    assertLoadedRaster(loaded, contract);
  });
  assertLoadedRaster(resources.blade, profile.blade);
  profile.animationFrames.forEach((contract, index) => {
    const loaded = resources.animationFrames[index];
    if (loaded === undefined) {
      throw new Error(`Bird animation frame ${index} is unavailable`);
    }
    assertLoadedRaster(loaded, contract);
  });
  assertLoadedRaster(resources.leftDirection, profile.leftDirection);
  assertLoadedRaster(resources.rightDirection, profile.rightDirection);
  profile.particles.forEach((contract, index) => {
    const loaded = resources.particles[index];
    if (loaded === undefined) {
      throw new Error(`Bird particle ${index} is unavailable`);
    }
    assertLoadedRaster(loaded, contract);
  });
  assertSpriteUv(resources.blade.spriteFrame.uv);
}

function assertLoadedRaster(
  loaded: LoadedGameRasterResource,
  expected: GameRasterResource,
): void {
  if (
    loaded.canonicalPath !== expected.canonicalPath
    || loaded.dimensions.width !== expected.dimensions.width
    || loaded.dimensions.height !== expected.dimensions.height
  ) {
    throw new RangeError(
      `Bird raster must match ${expected.canonicalPath}`,
    );
  }
  if (!isValid(loaded.spriteFrame, true)) {
    throw new Error(`Bird SpriteFrame must be valid for ${expected.canonicalPath}`);
  }
  const original = loaded.spriteFrame.originalSize;
  const rect = loaded.spriteFrame.rect;
  if (
    original.width !== expected.dimensions.width
    || original.height !== expected.dimensions.height
    || rect.width !== expected.dimensions.width
    || rect.height !== expected.dimensions.height
  ) {
    throw new RangeError(
      `Bird SpriteFrame geometry must match ${expected.canonicalPath}`,
    );
  }
}

function assertParticleCommand(
  command: BirdBladeParticleSpawnCommand,
): void {
  if (
    command.type !== 'spawn-bird-blade-particle'
    || command.attachmentZOrder !== BIRD_BLADE_Z_ORDER
    || command.rotationEnabled !== true
    || command.scaleOutEnabled !== true
    || command.fadeOutEnabled !== true
  ) {
    throw new RangeError('Bird particle command flags are invalid');
  }
  if (!Number.isFinite(command.lifetimeSeconds) || command.lifetimeSeconds <= 0) {
    throw new RangeError('Bird particle lifetime must be positive and finite');
  }
}

function copyParticleCommand(
  command: BirdBladeParticleSpawnCommand,
): BirdBladeParticleSpawnCommand {
  return Object.freeze({
    ...command,
    basePosition: copyPoint(command.basePosition),
    randomOffset: copyPoint(command.randomOffset),
  });
}

function copyFloat32Point(point: BirdBladePoint): BirdBladePoint {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError('Bird trail point must contain finite coordinates');
  }
  return Object.freeze({
    x: Math.fround(point.x),
    y: Math.fround(point.y),
  });
}

function copyPoint(point: BirdBladePoint): BirdBladePoint {
  return Object.freeze({ x: point.x, y: point.y });
}

function assertSpriteUv(spriteUv: readonly number[]): void {
  if (
    !Array.isArray(spriteUv)
    || spriteUv.length < 8
    || spriteUv.some((value) => !Number.isFinite(value))
  ) {
    throw new Error('Bird testblade7 SpriteFrame must provide a finite UV quad');
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be non-negative and finite`);
  }
}

function applyLayerRecursively(root: Node, layer: number): void {
  root.layer = layer;
  for (const child of root.children) {
    applyLayerRecursively(child, layer);
  }
}
