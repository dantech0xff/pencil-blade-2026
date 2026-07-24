import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  getStandardBasicBladeResource,
  type StandardBasicBladeId,
} from '../../../game/assets/scripts/domain/standard-blade-resource-contract.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const createdGraphics = [];
export const createdMeshes = [];
export const createdMaterials = [];
export const createdNodes = [];
let nextFailedMaterialReset = false;
let nextFailedMeshResetName = null;

export function resetCreatedNodes() {
  createdGraphics.length = 0;
  createdMeshes.length = 0;
  createdMaterials.length = 0;
  createdNodes.length = 0;
  nextFailedMaterialReset = false;
  nextFailedMeshResetName = null;
}

export function failNextMaterialReset() {
  nextFailedMaterialReset = true;
}

export function failNextMeshReset(name) {
  nextFailedMeshResetName = name;
}

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

export class Material {
  constructor() {
    this.destroyed = false;
    this.properties = {};
    this.resetOptions = null;
    createdMaterials.push(this);
  }
  reset(options) {
    if (nextFailedMaterialReset) {
      nextFailedMaterialReset = false;
      throw new Error('Injected material reset failure');
    }
    this.resetOptions = options;
  }
  setProperty(name, value) {
    this.properties[name] = value;
  }
  destroy() {
    this.destroyed = true;
  }
}

export class Mesh {
  constructor(name = '') {
    this.data = null;
    this.destroyed = false;
    this.lastReset = null;
    this.name = name;
    this.renderingSubMeshes = [];
    this.struct = null;
    createdMeshes.push(this);
  }
  reset(options) {
    if (nextFailedMeshResetName === this.name) {
      nextFailedMeshResetName = null;
      throw new Error('Injected mesh reset failure: ' + this.name);
    }
    this.lastReset = options;
    this.data = options.data;
    this.struct = options.struct;
    const vertexBuffer = {
      updates: [],
      update(data, size) {
        this.updates.push({ data: new Uint8Array(data), size });
      },
    };
    this.renderingSubMeshes = [{
      drawInfo: { vertexCount: 0 },
      geometricInfoInvalidations: 0,
      invalidateGeometricInfo() { this.geometricInfoInvalidations += 1; },
      vertexBuffers: [vertexBuffer],
    }];
  }
  destroy() {
    this.destroyed = true;
  }
}

export class MeshRenderer {
  constructor() {
    this.geometryChangedCalls = 0;
    this.mesh = null;
    this.sharedMaterial = null;
    this.sharedMaterials = [];
  }
  setSharedMaterial(material, index) {
    this.sharedMaterials[index] = material;
    this.sharedMaterial = material;
  }
  onGeometryChanged() {
    this.geometryChangedCalls += 1;
  }
}

export class UIMeshRenderer {
  constructor() {
    this.enabled = true;
  }
}

export class UITransform {
  constructor() {
    this.anchorPoint = { x: 0, y: 0 };
    this.contentSize = { width: 0, height: 0 };
  }
  setAnchorPoint(x, y) {
    this.anchorPoint = { x, y };
  }
  setContentSize(width, height) {
    this.contentSize = { width, height };
  }
}

export class SpriteFrame {
  constructor(uv = [], texture = null) {
    this.texture = texture ?? { kind: 'texture' };
    this.uv = uv;
  }
}

export class Node {
  constructor(name = '') {
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyed = false;
    this.layer = 0;
    this.lastRequestedSiblingIndex = null;
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
    if (this.parent === null) {
      return this.position;
    }
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
  getComponent(Type) {
    return this.components.get(Type) ?? null;
  }
  inverseTransformPoint(out, point) {
    const world = this.worldPosition;
    out.x = point.x - world.x;
    out.y = point.y - world.y;
    out.z = point.z - world.z;
    return out;
  }
  removeFromParent() {
    this.setParent(null);
  }
  setParent(parent) {
    if (this.parent !== null) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) {
        this.parent.children.splice(index, 1);
      }
    }
    this.parent = parent;
    if (parent !== null) {
      parent.children.push(this);
    }
  }
  setPosition(x, y, z) {
    this.position = { x, y, z };
  }
  setSiblingIndex(index) {
    this.lastRequestedSiblingIndex = index;
    if (this.parent === null) {
      return;
    }
    const siblings = this.parent.children;
    const currentIndex = siblings.indexOf(this);
    if (currentIndex >= 0) {
      siblings.splice(currentIndex, 1);
    }
    const boundedIndex = Math.max(0, Math.min(index, siblings.length));
    siblings.splice(boundedIndex, 0, this);
  }
  destroy() {
    if (this.destroyed) {
      return;
    }
    for (const child of [...this.children]) {
      child.destroy();
    }
    this.destroyed = true;
    this.active = false;
    this.setParent(null);
  }
}

export const gfx = Object.freeze({
  Attribute: class Attribute {
    constructor(name, format, normalized = false) {
      this.name = name;
      this.format = format;
      this.normalized = normalized;
    }
  },
  AttributeName: Object.freeze({
    ATTR_COLOR: 'ATTR_COLOR',
    ATTR_POSITION: 'ATTR_POSITION',
    ATTR_TEX_COORD: 'ATTR_TEX_COORD',
  }),
  Format: Object.freeze({
    RG32F: 'RG32F',
    RGBA8: 'RGBA8',
  }),
  PrimitiveMode: Object.freeze({
    TRIANGLE_STRIP: 'TRIANGLE_STRIP',
  }),
});

export function isValid(value) {
  return value !== null && value !== undefined && !value.destroyed;
}

export class Graphics {
  constructor() {
    createdGraphics.push(this);
  }
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
const { ClassicBladePresenter } = await import(
  '../../../game/assets/scripts/creator/classic-blade-presenter.ts'
);

type AssetTree = '480x800' | '720x1280';

interface CocosStub {
  readonly Graphics: new () => StubGraphics;
  readonly Material: new () => StubMaterial;
  readonly Mesh: new (name?: string) => StubMesh;
  readonly MeshRenderer: new () => StubMeshRenderer;
  readonly Node: new (name?: string) => StubNode;
  readonly SpriteFrame: new (uv?: readonly number[], texture?: unknown) => StubSpriteFrame;
  readonly UIMeshRenderer: new () => StubUIMeshRenderer;
  readonly UITransform: new () => StubUITransform;
  readonly Vec3: new (x?: number, y?: number, z?: number) => StubVec3;
  readonly createdGraphics: readonly StubGraphics[];
  readonly createdMaterials: readonly StubMaterial[];
  readonly createdMeshes: readonly StubMesh[];
  readonly createdNodes: readonly StubNode[];
  readonly failNextMaterialReset: () => void;
  readonly failNextMeshReset: (name: string) => void;
  readonly gfx: {
    readonly AttributeName: Readonly<{
      ATTR_COLOR: string;
      ATTR_POSITION: string;
      ATTR_TEX_COORD: string;
    }>;
    readonly Format: Readonly<{
      RG32F: string;
      RGBA8: string;
    }>;
    readonly PrimitiveMode: Readonly<{
      TRIANGLE_STRIP: string;
    }>;
  };
  readonly isValid: (value: unknown) => boolean;
  readonly resetCreatedNodes: () => void;
}

interface StubGraphics {}

interface StubMaterial {
  destroyed: boolean;
  properties: Record<string, unknown>;
  resetOptions: {
    readonly defines: Readonly<Record<string, boolean>>;
    readonly effectName: string;
    readonly states: Readonly<{
      readonly depthStencilState: Readonly<{
        readonly depthTest: boolean;
        readonly depthWrite: boolean;
      }>;
      readonly primitive: string;
    }>;
    readonly technique: number;
  } | null;
  destroy(): void;
  reset(options: StubMaterial['resetOptions']): void;
  setProperty(name: string, value: unknown): void;
}

interface StubMesh {
  data: Uint8Array | null;
  destroyed: boolean;
  lastReset: {
    readonly data: Uint8Array;
    readonly struct: {
      readonly maxPosition: StubVec3;
      readonly minPosition: StubVec3;
      readonly primitives: readonly [{
        readonly primitiveMode: string;
        readonly vertexBundelIndices: readonly [0];
      }];
      readonly vertexBundles: readonly [{
        readonly attributes: readonly Array<{
          readonly format: string;
          readonly name: string;
          readonly normalized: boolean;
        }>;
        readonly view: {
          readonly count: number;
          readonly length: number;
          readonly offset: number;
          readonly stride: number;
        };
      }];
      readonly dynamic: {
        readonly info: {
          readonly maxSubMeshIndices: number;
          readonly maxSubMeshes: number;
          readonly maxSubMeshVertices: number;
        };
      };
    };
  } | null;
  readonly renderingSubMeshes: readonly [{
    readonly drawInfo: { vertexCount: number };
    readonly geometricInfoInvalidations: number;
    readonly vertexBuffers: readonly [{
      readonly updates: readonly Array<{ readonly data: Uint8Array; readonly size: number }>;
    }];
  }];
  readonly struct: NonNullable<StubMesh['lastReset']>['struct'];
  destroy(): void;
  reset(options: StubMesh['lastReset']): void;
}

interface StubMeshRenderer {
  geometryChangedCalls: number;
  mesh: StubMesh | null;
  sharedMaterial: StubMaterial | null;
  sharedMaterials: Array<StubMaterial | null>;
  setSharedMaterial(material: StubMaterial | null, index: number): void;
  onGeometryChanged(): void;
}

interface StubNode {
  active: boolean;
  readonly activeInHierarchy: boolean;
  readonly children: StubNode[];
  components: Map<new () => unknown, unknown>;
  destroyed: boolean;
  layer: number;
  lastRequestedSiblingIndex: number | null;
  readonly name: string;
  parent: StubNode | null;
  position: Readonly<{ x: number; y: number; z: number }>;
  scale: Readonly<{ x: number; y: number; z: number }>;
  readonly worldPosition: Readonly<{ x: number; y: number; z: number }>;
  addComponent<T>(Type: new () => T): T;
  destroy(): void;
  getComponent<T>(Type: new () => T): T | null;
  inverseTransformPoint(out: StubVec3, point: StubVec3): StubVec3;
  removeFromParent(): void;
  setParent(parent: StubNode | null): void;
  setPosition(x: number, y: number, z: number): void;
  setSiblingIndex(index: number): void;
}

interface StubSpriteFrame {
  readonly texture: unknown;
  readonly uv: readonly number[];
}

interface StubUITransform {
  readonly anchorPoint: Readonly<{ x: number; y: number }>;
  readonly contentSize: Readonly<{ width: number; height: number }>;
  setAnchorPoint(x: number, y: number): void;
  setContentSize(width: number, height: number): void;
}

interface StubUIMeshRenderer {
  enabled: boolean;
}

interface StubVec3 {
  x: number;
  y: number;
  z: number;
}

test('presenter creates four mesh owners for every Basic ID and binds each exact recovered texture', () => {
  const source = readFileSync(
    `${REPOSITORY_ROOT}game/assets/scripts/creator/classic-blade-presenter.ts`,
    'utf8',
  );
  assert.doesNotMatch(source, /Graphics/);
  assert.match(source, /builtin-unlit/);
  assert.match(source, /CLASSIC_BASIC_BLADE_MATERIAL_TECHNIQUE/);
  assert.match(source, /gfx\.PrimitiveMode\.TRIANGLE_STRIP/);
  assert.match(source, /offset \+ 8/);
  assert.match(source, /offset \+ 12/);

  for (const assetTree of ['480x800', '720x1280'] as const) {
    for (let bladeId = 0; bladeId <= 12; bladeId += 1) {
      cc.resetCreatedNodes();
      const resource = loadedResource(assetTree, bladeId as StandardBasicBladeId);
      const presenter = ClassicBladePresenter.create({
        assetTree,
        resource: resource as never,
        selectedBladeId: bladeId as StandardBasicBladeId,
        viewportWidth: assetTree === '480x800' ? 480 : 720,
      });

      assert.equal(presenter.root.active, false);
      assert.equal(presenter.owners.length, 4);
      assert.deepEqual(presenter.owners.map((owner) => owner.slot), [0, 1, 2, 3]);
      assert.deepEqual(presenter.root.children.map(({ name }) => name), [
        'ClassicBasicBlade-0',
        'ClassicBasicBlade-1',
        'ClassicBasicBlade-2',
        'ClassicBasicBlade-3',
      ]);
      assert.deepEqual(cc.createdNodes.map(({ name }) => name), [
        'ClassicBasicBladeRoot',
        'ClassicBasicBlade-0',
        'ClassicBasicBlade-1',
        'ClassicBasicBlade-2',
        'ClassicBasicBlade-3',
      ]);
      assert.equal(cc.createdMeshes.length, 4);

      const parent = new cc.Node('Parent');
      parent.layer = 12;
      const lowerSibling = new cc.Node('LowerSibling');
      lowerSibling.setParent(parent);

      presenter.attach(parent as never);

      assert.equal(presenter.root.parent, parent);
      assert.equal(presenter.root.lastRequestedSiblingIndex, 1);
      assert.deepEqual(parent.children.map(({ name }) => name), [
        'LowerSibling',
        'ClassicBasicBladeRoot',
      ]);
      for (const owner of presenter.owners) {
        assert.equal(owner.node.parent, presenter.root);
        assert.equal(owner.node.lastRequestedSiblingIndex, owner.slot);
        assert.equal(owner.node.getComponent(cc.UIMeshRenderer), owner.uiMeshRenderer);
        assert.equal(owner.node.layer, 12);
        assert.equal(
          owner.meshRenderer.sharedMaterial,
          presenter.owners[0].meshRenderer.sharedMaterial,
        );
        const mesh = owner.meshRenderer.mesh;
        assert.ok(mesh);
        assert.equal(mesh.data?.byteLength, 500);
        assert.equal(mesh.lastReset?.struct.vertexBundles[0].view.length, 500);
        assert.equal(mesh.lastReset?.struct.vertexBundles[0].view.count, 0);
        assert.deepEqual(mesh.lastReset?.struct.dynamic.info, {
          maxSubMeshIndices: 0,
          maxSubMeshes: 1,
          maxSubMeshVertices: 25,
        });
        assert.equal(mesh.renderingSubMeshes[0].drawInfo.vertexCount, 0);
      }

      const material = presenter.owners[0].meshRenderer.sharedMaterial;
      assert.ok(material);
      assert.equal(material.resetOptions?.effectName, 'builtin-unlit');
      assert.equal(material.resetOptions?.technique, 3);
      assert.deepEqual(material.resetOptions?.defines, {
        USE_TEXTURE: true,
        USE_VERTEX_COLOR: true,
      });
      assert.equal(material.resetOptions?.states.primitive, cc.gfx.PrimitiveMode.TRIANGLE_STRIP);
      assert.equal(material.resetOptions?.states.depthStencilState.depthTest, false);
      assert.equal(material.resetOptions?.states.depthStencilState.depthWrite, false);
      assert.equal(material.properties.mainTexture, resource.spriteFrame.texture);
      assert.equal(cc.createdGraphics.length, 0);
      presenter.dispose();
    }
  }
});

test('mesh data preserves the 20-byte vertex layout, affine SpriteFrame UV mapping, and native frame disposal', () => {
  cc.resetCreatedNodes();
  const resource = loadedResource('480x800', 0);
  const presenter = ClassicBladePresenter.create({
    assetTree: '480x800',
    resource: resource as never,
    selectedBladeId: 0,
    viewportWidth: 480,
  });

  const parent = new cc.Node('Parent');
  presenter.attach(parent as never);

  presenter.begin(0);
  presenter.move(0, point(0));
  presenter.move(0, point(10));
  presenter.move(0, point(20));
  presenter.move(0, point(30));

  const owner = presenter.owners[0];
  const liveMesh = owner.meshRenderer.mesh;
  assert.ok(liveMesh);
  assert.equal(liveMesh.destroyed, false);
  assert.equal(liveMesh.lastReset?.struct.primitives[0].primitiveMode, cc.gfx.PrimitiveMode.TRIANGLE_STRIP);
  assert.equal(liveMesh.lastReset?.struct.vertexBundles[0].view.stride, 20);
  assert.equal(liveMesh.lastReset?.struct.vertexBundles[0].view.length, 500);
  assert.equal(liveMesh.lastReset?.struct.vertexBundles[0].view.count, 6);
  assert.equal(liveMesh.data?.byteLength, 500);
  assert.equal(liveMesh.renderingSubMeshes[0].drawInfo.vertexCount, 6);
  assert.deepEqual(liveMesh.lastReset?.struct.vertexBundles[0].attributes.map(attributeSnapshot), [
    { format: 'RG32F', name: 'ATTR_POSITION', normalized: false },
    { format: 'RGBA8', name: 'ATTR_COLOR', normalized: true },
    { format: 'RG32F', name: 'ATTR_TEX_COORD', normalized: false },
  ]);
  assert.deepEqual(bufferVertices(liveMesh.data!, 6), [
    [0, 0, 7, 12],
    [10, 0, 7, 19],
    [10, 0, 3, 3],
    [20, 6.125, 7, 19],
    [20, -6.125, 3, 3],
    [30, 0, 11, 14],
  ]);

  const firstMesh = liveMesh;
  presenter.end(0);

  presenter.updateFrame();
  assert.equal(firstMesh.destroyed, false);
  const disposalMesh = owner.meshRenderer.mesh;
  assert.ok(disposalMesh);
  assert.equal(disposalMesh, firstMesh);
  assert.equal(disposalMesh.lastReset?.struct.vertexBundles[0].view.count, 4);
  assert.equal(disposalMesh.lastReset?.struct.vertexBundles[0].view.stride, 20);
  assert.equal(disposalMesh.lastReset?.struct.primitives[0].primitiveMode, cc.gfx.PrimitiveMode.TRIANGLE_STRIP);
  assert.equal(disposalMesh.lastReset?.struct.vertexBundles[0].view.length, 500);
  assert.equal(disposalMesh.renderingSubMeshes[0].drawInfo.vertexCount, 4);
  assert.equal(disposalMesh.lastReset?.struct.vertexBundles[0].attributes[1].normalized, true);
  assert.equal(disposalMesh.lastReset?.struct.vertexBundles[0].attributes[0].format, 'RG32F');
  assert.equal(disposalMesh.lastReset?.struct.vertexBundles[0].attributes[1].format, 'RGBA8');
  assert.equal(disposalMesh.lastReset?.struct.vertexBundles[0].attributes[2].format, 'RG32F');
  assert.equal(disposalMesh.lastReset?.struct.maxPosition.x, 30);
  assert.equal(disposalMesh.lastReset?.struct.minPosition.x, 10);
  assert.equal(disposalMesh.lastReset?.struct.minPosition.y, 0);
  assert.equal(disposalMesh.lastReset?.struct.maxPosition.y, 0);
  assert.equal(presenter.snapshot()[0]?.currentWidth, reducedWidth(3.5));
  assert.equal(presenter.model.geometry(0)?.geometryWidth, 3.5);
  assert.deepEqual(bufferVertices(disposalMesh.data!, 4), [
    [10, 0, 7, 12],
    [20, 0, 7, 19],
    [20, 0, 3, 3],
    [30, 0, 11, 14],
  ]);

  presenter.updateFrame();
  assert.equal(disposalMesh.destroyed, false);
  assert.equal(owner.meshRenderer.mesh, firstMesh);
  assert.equal(disposalMesh.lastReset?.struct.vertexBundles[0].view.count, 0);
  assert.equal(disposalMesh.renderingSubMeshes[0].drawInfo.vertexCount, 0);
  assert.equal(presenter.snapshot()[0]?.state, 4);
  assert.equal(presenter.snapshot()[0]?.currentWidth, reducedWidth(reducedWidth(3.5)));
  assert.equal(presenter.model.geometry(0), null);

  presenter.updateFrame();
  assert.equal(presenter.snapshot()[0]?.state, 4);
  assert.equal(presenter.snapshot()[0]?.points.length, 1);
  assert.equal(presenter.snapshot()[0]?.currentWidth, reducedWidth(reducedWidth(reducedWidth(3.5))));
  assert.equal(owner.meshRenderer.mesh, firstMesh);

  presenter.updateFrame();
  assert.equal(presenter.snapshot()[0]?.state, 0);
  assert.equal(presenter.snapshot()[0]?.geometry, null);
  assert.equal(presenter.snapshot()[0]?.currentWidth, 3.5);
  assert.equal(owner.meshRenderer.mesh, firstMesh);
  assert.equal(cc.createdMeshes.length, 4);

  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
  assert.equal(firstMesh.destroyed, true);
  assert.equal(presenter.root.destroyed, true);
  assert.equal(cc.isValid(presenter.root), false);
  assert.equal(cc.createdGraphics.length, 0);
});

test('presenter rejects a resource from a different Basic blade instead of falling back to ID 0', () => {
  const blade0 = loadedResource('720x1280', 0);
  assert.throws(
    () => ClassicBladePresenter.create({
      assetTree: '720x1280',
      resource: blade0 as never,
      selectedBladeId: 1,
      viewportWidth: 720,
    }),
    /BasicBlade resource mismatch.*blade1\.png/,
  );
});

test('construction rolls back root, material, and partial meshes when Creator allocation fails', () => {
  cc.resetCreatedNodes();
  cc.failNextMaterialReset();
  assert.throws(
    () => ClassicBladePresenter.create({
      assetTree: '480x800',
      resource: loadedResource('480x800', 0) as never,
      selectedBladeId: 0,
      viewportWidth: 480,
    }),
    /Injected material reset failure/,
  );
  assert.equal(cc.createdNodes.length, 1);
  assert.equal(cc.createdNodes[0]?.destroyed, true);
  assert.equal(cc.createdMaterials.length, 1);
  assert.equal(cc.createdMaterials[0]?.destroyed, true);
  assert.equal(cc.createdMeshes.length, 0);

  cc.resetCreatedNodes();
  cc.failNextMeshReset('ClassicBasicBladeMesh-1');
  assert.throws(
    () => ClassicBladePresenter.create({
      assetTree: '720x1280',
      resource: loadedResource('720x1280', 12) as never,
      selectedBladeId: 12,
      viewportWidth: 720,
    }),
    /Injected mesh reset failure: ClassicBasicBladeMesh-1/,
  );
  assert.deepEqual(
    cc.createdNodes.map(({ name }) => name),
    [
      'ClassicBasicBladeRoot',
      'ClassicBasicBlade-0',
      'ClassicBasicBlade-1',
    ],
  );
  assert.equal(
    cc.createdNodes.every(({ destroyed, parent }) => destroyed && parent === null),
    true,
  );
  assert.equal(cc.createdMaterials.length, 1);
  assert.equal(cc.createdMaterials[0]?.destroyed, true);
  assert.equal(cc.createdMeshes.length, 2);
  assert.equal(cc.createdMeshes.every(({ destroyed }) => destroyed), true);
});

function loadedResource(assetTree: AssetTree, bladeId: StandardBasicBladeId) {
  const resource = getStandardBasicBladeResource(bladeId, assetTree);
  return Object.freeze({
    ...resource,
    spriteFrame: new cc.SpriteFrame(
      [1, 2, 9, 6, 5, 18, 13, 22],
      Object.freeze({ id: `${assetTree}-blade-${bladeId}-texture` }),
    ),
  });
}

function point(x: number, y = 0) {
  return Object.freeze({ x, y });
}

function attributeSnapshot(attribute: {
  readonly format: string;
  readonly name: string;
  readonly normalized: boolean;
}) {
  return {
    format: attribute.format,
    name: attribute.name,
    normalized: attribute.normalized,
  };
}

function bufferVertices(data: Uint8Array, count: number) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const vertices: Array<[number, number, number, number]> = [];
  for (let index = 0; index < count; index += 1) {
    const offset = index * 20;
    vertices.push([
      view.getFloat32(offset, true),
      view.getFloat32(offset + 4, true),
      view.getFloat32(offset + 12, true),
      view.getFloat32(offset + 16, true),
    ]);
  }
  return vertices;
}

function reducedWidth(width: number): number {
  return Math.fround(width / Math.fround(1.1));
}
