import {
  Material,
  Mesh,
  MeshRenderer,
  Node,
  UITransform,
  UIMeshRenderer,
  Vec3,
  gfx,
  isValid,
} from 'cc';

import {
  BASIC_BLADE_LEGACY_VERTEX_CAPACITY_BYTES,
  BASIC_BLADE_LEGACY_VERTEX_STRIDE_BYTES,
  BASIC_BLADE_SLOT_COUNT,
  BasicBladeTrailModel,
  type BasicBladeGeometry,
  type BasicBladeSlotSnapshot,
  type BasicBladeUv,
} from '../domain/basic-blade-trail';
import type { BladePoint } from '../domain/blade-tracks';
import { getClassicDefaultBladeResource } from '../domain/classic-resource-contract';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import type { LoadedClassicRasterResource } from './classic-resource-loader';

export const CLASSIC_BASIC_BLADE_Z_ORDER = 1;
export const CLASSIC_BASIC_BLADE_MATERIAL_TECHNIQUE = 3;

export interface ClassicBladePresenterInput {
  readonly assetTree: ClassicAssetTree;
  readonly resource: LoadedClassicRasterResource;
  readonly selectedBladeId: 0;
  readonly viewportWidth: number;
}

export interface ClassicBladeMeshOwner {
  readonly meshRenderer: MeshRenderer;
  readonly node: Node;
  readonly slot: number;
  readonly uiMeshRenderer: UIMeshRenderer;
  readonly vertexBytes: Uint8Array;
}

/** Creator adapter for four exact default BasicBlade textured triangle strips. */
export class ClassicBladePresenter {
  readonly model: BasicBladeTrailModel;
  readonly owners: readonly ClassicBladeMeshOwner[];
  readonly root: Node;

  private readonly material: Material;
  private readonly spriteUv: readonly number[];
  private attached = false;
  private disposed = false;

  private constructor(input: ClassicBladePresenterInput) {
    this.model = new BasicBladeTrailModel(input.viewportWidth);
    this.root = new Node('ClassicBasicBladeRoot');
    this.root.active = false;

    this.material = createBasicBladeMaterial(input.resource);
    this.spriteUv = Object.freeze([...input.resource.spriteFrame.uv]);
    assertSpriteUv(this.spriteUv);

    this.owners = Object.freeze(Array.from(
      { length: BASIC_BLADE_SLOT_COUNT },
      (_, slot) => createMeshOwner(this.root, this.material, slot),
    ));
  }

  static create(input: ClassicBladePresenterInput): ClassicBladePresenter {
    assertInput(input);
    return new ClassicBladePresenter(input);
  }

  attach(parent: Node): void {
    if (!isValid(parent, true)) {
      throw new Error('BasicBlade parent must be valid');
    }
    if (this.attached || this.root.parent !== null) {
      throw new Error('BasicBlade presenter is already attached');
    }
    if (this.disposed || !isValid(this.root, true)) {
      throw new Error('Disposed BasicBlade presenter cannot be attached');
    }

    this.root.layer = parent.layer;
    for (const owner of this.owners) {
      owner.node.layer = parent.layer;
    }
    this.root.setParent(parent);
    this.root.setSiblingIndex(CLASSIC_BASIC_BLADE_Z_ORDER);
    this.root.active = true;
    this.attached = true;
  }

  begin(slot: number): void {
    this.assertReady('begin');
    this.model.begin(slot);
  }

  move(slot: number, point: BladePoint): void {
    this.assertReady('move');
    this.model.move(slot, point);
    this.refreshSlot(slot);
  }

  end(slot: number): void {
    this.assertReady('end');
    this.model.end(slot);
  }

  isClaimed(slot: number): boolean {
    this.assertReady('inspect ownership');
    return this.model.isClaimed(slot);
  }

  /** Called once from Creator update; native disposal is intentionally frame-count based. */
  updateFrame(): void {
    this.assertReady('update');
    for (const slot of this.model.updateFrame()) {
      this.refreshSlot(slot);
    }
  }

  snapshot(): readonly BasicBladeSlotSnapshot[] {
    return this.model.snapshot();
  }

  dispose(): boolean {
    if (this.disposed) {
      return false;
    }
    this.disposed = true;
    this.attached = false;
    if (this.root.parent !== null) {
      this.root.removeFromParent();
    }
    for (const owner of this.owners) {
      const mesh = owner.meshRenderer.mesh;
      owner.meshRenderer.mesh = null;
      owner.meshRenderer.setSharedMaterial(null, 0);
      mesh?.destroy();
    }
    this.material.destroy();
    if (isValid(this.root, true)) {
      this.root.destroy();
    }
    return true;
  }

  private refreshSlot(slot: number): void {
    const owner = this.owners[slot];
    if (owner === undefined) {
      throw new RangeError('BasicBlade render slot must be from 0 through 3');
    }
    updateLegacyLayoutMesh(owner, this.model.geometry(slot), this.spriteUv);
  }

  private assertReady(operation: string): void {
    if (this.disposed || !isValid(this.root, true)) {
      throw new Error(`Disposed BasicBlade presenter cannot ${operation}`);
    }
    if (!this.attached || this.root.parent === null) {
      throw new Error(`BasicBlade presenter must be attached before ${operation}`);
    }
  }
}

function createMeshOwner(
  parent: Node,
  material: Material,
  slot: number,
): ClassicBladeMeshOwner {
  const node = new Node(`ClassicBasicBlade-${slot}`);
  node.setParent(parent);
  node.setSiblingIndex(slot);
  node.addComponent(UITransform);
  const meshRenderer = node.addComponent(MeshRenderer);
  meshRenderer.setSharedMaterial(material, 0);
  const vertexBytes = new Uint8Array(BASIC_BLADE_LEGACY_VERTEX_CAPACITY_BYTES);
  meshRenderer.mesh = createPersistentLegacyLayoutMesh(vertexBytes, slot);
  const uiMeshRenderer = node.addComponent(UIMeshRenderer);
  return Object.freeze({ meshRenderer, node, slot, uiMeshRenderer, vertexBytes });
}

function createBasicBladeMaterial(resource: LoadedClassicRasterResource): Material {
  const material = new Material();
  material.reset({
    effectName: 'builtin-unlit',
    technique: CLASSIC_BASIC_BLADE_MATERIAL_TECHNIQUE,
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
  slot: number,
): Mesh {
  const vertexCapacity = BASIC_BLADE_LEGACY_VERTEX_CAPACITY_BYTES
    / BASIC_BLADE_LEGACY_VERTEX_STRIDE_BYTES;
  const mesh = new Mesh(`ClassicBasicBladeMesh-${slot}`);
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
  owner: ClassicBladeMeshOwner,
  geometry: BasicBladeGeometry | null,
  spriteUv: readonly number[],
): void {
  const mesh = owner.meshRenderer.mesh;
  if (mesh === null) {
    throw new Error(`BasicBlade slot ${owner.slot} lost its persistent mesh`);
  }
  const vertexBundle = mesh.struct.vertexBundles[0];
  const subMesh = mesh.renderingSubMeshes[0];
  const vertexBuffer = subMesh?.vertexBuffers[0];
  const drawInfo = subMesh?.drawInfo;
  if (vertexBundle === undefined || subMesh === undefined || vertexBuffer === undefined || !drawInfo) {
    throw new Error(`BasicBlade slot ${owner.slot} persistent mesh is incomplete`);
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
  const updateBytes = vertexCount * BASIC_BLADE_LEGACY_VERTEX_STRIDE_BYTES;
  if (updateBytes > owner.vertexBytes.byteLength) {
    throw new Error(`BasicBlade slot ${owner.slot} exceeded its recovered 500-byte capacity`);
  }
  const bytes = owner.vertexBytes;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
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
    bytes[offset + 8] = 255;
    bytes[offset + 9] = 255;
    bytes[offset + 10] = 255;
    bytes[offset + 11] = 255;
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

function assertInput(input: ClassicBladePresenterInput): void {
  const contract = getClassicDefaultBladeResource(input.selectedBladeId, input.assetTree);
  if (input.resource.canonicalPath !== contract.canonicalPath) {
    throw new Error(`BasicBlade resource mismatch for ${contract.canonicalPath}`);
  }
  if (
    input.resource.dimensions.width !== contract.dimensions.width
    || input.resource.dimensions.height !== contract.dimensions.height
  ) {
    throw new Error('BasicBlade resource dimensions do not match the recovered contract');
  }
  if (!Number.isFinite(input.viewportWidth)) {
    throw new RangeError('BasicBlade viewportWidth must be finite');
  }
}

function assertSpriteUv(spriteUv: readonly number[]): void {
  if (spriteUv.length < 8 || spriteUv.some((value) => !Number.isFinite(value))) {
    throw new Error('BasicBlade SpriteFrame must provide a finite four-corner UV quad');
  }
}
