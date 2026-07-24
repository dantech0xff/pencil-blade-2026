import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const createdMaterials = [];
export const createdMeshes = [];
export const createdNodes = [];
let failingSiblingName = null;

export class AssetManager {}
export const assetManager = {};

export function resetCreatedObjects() {
  createdMaterials.length = 0;
  createdMeshes.length = 0;
  createdNodes.length = 0;
  failingSiblingName = null;
}

export function failNextSiblingPlacementFor(name) {
  failingSiblingName = name;
}

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
}

export class Material {
  constructor() {
    this.destroyCalls = 0;
    this.destroyed = false;
    this.properties = {};
    createdMaterials.push(this);
  }
  reset(options) { this.resetOptions = options; }
  setProperty(name, value) { this.properties[name] = value; }
  destroy() {
    if (this.destroyed) return;
    this.destroyCalls += 1;
    this.destroyed = true;
  }
}

export class Mesh {
  constructor(name = '') {
    this.destroyCalls = 0;
    this.destroyed = false;
    this.name = name;
    this.renderingSubMeshes = [];
    this.struct = null;
    createdMeshes.push(this);
  }
  reset(options) {
    this.struct = options.struct;
    this.renderingSubMeshes = [{
      drawInfo: { vertexCount: 0 },
      invalidateGeometricInfo() {},
      vertexBuffers: [{ update() {} }],
    }];
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyCalls += 1;
    this.destroyed = true;
  }
}

export class MeshRenderer {
  constructor() {
    this.mesh = null;
    this.sharedMaterial = null;
  }
  setSharedMaterial(material) { this.sharedMaterial = material; }
  onGeometryChanged() {}
}

export class UIMeshRenderer {}

export class UITransform {
  constructor() {
    this.anchorPoint = { x: 0, y: 0 };
    this.contentSize = { width: 0, height: 0 };
  }
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
  setContentSize(width, height) { this.contentSize = { width, height }; }
}

export class UIOpacity {
  constructor() { this.opacity = 255; }
}

export class Sprite {
  constructor() {
    this.sizeMode = 0;
    this.spriteFrame = null;
  }
}
Sprite.SizeMode = Object.freeze({ CUSTOM: 2 });

export class SpriteFrame {
  constructor(label = '', width = 0, height = 0, uv = [0, 1, 1, 1, 0, 0, 1, 0]) {
    this.destroyed = false;
    this.label = label;
    this.originalSize = { width, height };
    this.rect = { width, height };
    this.texture = Object.freeze({ label });
    this.uv = uv;
  }
  destroy() { this.destroyed = true; }
}

export class Node {
  constructor(name = '') {
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyCalls = 0;
    this.destroyed = false;
    this.lastRequestedSiblingIndex = null;
    this.layer = 0;
    this.name = name;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
    createdNodes.push(this);
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
  inverseTransformPoint(out, point) {
    const world = this.worldPosition;
    out.x = point.x - world.x;
    out.y = point.y - world.y;
    out.z = point.z - world.z;
    return out;
  }
  removeFromParent() { this.setParent(null); }
  setParent(parent) {
    if (this.parent !== null) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
  }
  setPosition(x, y, z) { this.position = { x, y, z }; }
  setRotationFromEuler(x, y, z) { this.rotation = { x, y, z }; }
  setScale(x, y, z) { this.scale = { x, y, z }; }
  setSiblingIndex(index) {
    this.lastRequestedSiblingIndex = index;
    if (failingSiblingName === this.name) {
      failingSiblingName = null;
      throw new Error('injected sibling placement failure for ' + this.name);
    }
    if (this.parent === null) return;
    const siblings = this.parent.children;
    const current = siblings.indexOf(this);
    if (current >= 0) siblings.splice(current, 1);
    siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, this);
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyCalls += 1;
    for (const child of [...this.children]) child.destroy();
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
const {
  StandardBladePresenter,
} = await import(
  '../../../game/assets/scripts/creator/standard-blade-presenter.ts'
);
const {
  getStandardBasicBladeResource,
  getStandardBladeParticleResources,
  getStandardCentipedeBladeResources,
  getStandardDragonBladeResources,
} = await import(
  '../../../game/assets/scripts/domain/standard-blade-resource-contract.ts'
);

type AssetTree = '480x800' | '720x1280';

interface CocosStub {
  readonly Node: new (name?: string) => StubNode;
  readonly SpriteFrame: new (
    label?: string,
    width?: number,
    height?: number,
    uv?: readonly number[],
  ) => StubSpriteFrame;
  readonly createdMaterials: StubOwnedObject[];
  readonly createdMeshes: StubOwnedObject[];
  readonly createdNodes: StubNode[];
  failNextSiblingPlacementFor(name: string): void;
  resetCreatedObjects(): void;
}

interface StubOwnedObject {
  destroyCalls: number;
  destroyed: boolean;
}

interface StubNode extends StubOwnedObject {
  active: boolean;
  children: StubNode[];
  lastRequestedSiblingIndex: number | null;
  layer: number;
  readonly name: string;
  parent: StubNode | null;
  position: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  rotation: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  scale: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  destroy(): void;
}

interface StubSpriteFrame {
  destroyed: boolean;
  readonly label: string;
  readonly texture: unknown;
  readonly uv: readonly number[];
}

interface RasterContract {
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{
    readonly height: number;
    readonly width: number;
  }>;
}

interface LoadedRaster extends RasterContract {
  readonly spriteFrame: StubSpriteFrame;
}

interface MultipartContract {
  readonly body: RasterContract;
  readonly bodySegmentCount: 15 | 20;
  readonly head: RasterContract;
  readonly pointCapacity: 32;
  readonly tail: RasterContract;
}

interface RandomCall {
  readonly maximumInclusive: number;
  readonly minimumInclusive: number;
}

class ScriptedRandom {
  readonly decileCalls: number[] = [];
  readonly intCalls: RandomCall[] = [];
  private readonly deciles: readonly number[];
  private readonly integers: readonly number[];
  private decileOffset = 0;
  private intOffset = 0;

  constructor(
    integers: readonly number[],
    deciles: readonly number[] = [],
  ) {
    this.integers = integers;
    this.deciles = deciles;
  }

  nextDecile(): number {
    this.decileCalls.push(this.decileOffset);
    const value = this.deciles[this.decileOffset];
    this.decileOffset += 1;
    if (value === undefined) {
      throw new Error('scripted decile random exhausted');
    }
    return value;
  }

  nextIntInclusive(
    minimumInclusive: number,
    maximumInclusive: number,
  ): number {
    this.intCalls.push(Object.freeze({
      maximumInclusive,
      minimumInclusive,
    }));
    const value = this.integers[this.intOffset];
    this.intOffset += 1;
    if (value === undefined) {
      throw new Error('scripted integer random exhausted');
    }
    return value;
  }
}

const VALID_SEGMENT = Object.freeze({
  current: Object.freeze({ x: 40, y: 0 }),
  previous: Object.freeze({ x: 20, y: 0 }),
  slot: 0,
  touchId: 41,
});

test('all IDs 0 through 17 dispatch exhaustively to their exact family in both asset trees', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    for (let bladeId = 0; bladeId <= 17; bladeId += 1) {
      cc.resetCreatedObjects();
      const random = new ScriptedRandom([]);
      const presenter = StandardBladePresenter.create({
        assetTree,
        profile: loadedProfile(bladeId, assetTree) as never,
        random,
        viewportWidth: assetTree === '480x800' ? 480 : 720,
      });

      const expectedKind = bladeId <= 12
        ? 'basic'
        : bladeId <= 16
          ? 'dragon'
          : 'centipede';
      assert.equal(presenter.selectedBladeId, bladeId);
      assert.equal(presenter.kind, expectedKind);
      assert.equal(random.intCalls.length, 0);
      assert.equal(random.decileCalls.length, 0);
      if (expectedKind === 'basic') {
        assert.equal(cc.createdMaterials.length, 1);
        assert.equal(cc.createdMeshes.length, 4);
      } else {
        assert.equal(cc.createdMaterials.length, 0);
        assert.equal(cc.createdMeshes.length, 0);
      }

      assert.equal(presenter.dispose(), true);
      assert.equal(presenter.dispose(), false);
      assert.equal(cc.createdNodes.every(({ destroyed }) => destroyed), true);
      assert.equal(cc.createdMeshes.every(({ destroyed }) => destroyed), true);
      assert.equal(cc.createdMaterials.every(({ destroyed }) => destroyed), true);
    }
  }
});

for (const contract of [
  { bladeId: 0, integers: [] },
  { bladeId: 7, integers: [0, 50, 1, 100, -1, 50] },
  { bladeId: 12, integers: [0, 4, 100, 1, 72, -1, 72] },
] as const) {
  test(`Basic ID ${contract.bladeId} preserves trail ownership and its moved-only particle boundary`, () => {
    cc.resetCreatedObjects();
    const random = new ScriptedRandom(contract.integers);
    const presenter = createPresenter(contract.bladeId, '480x800', random);
    const parent = new cc.Node(`Basic-${contract.bladeId}-Parent`);
    presenter.attach(parent as never);

    presenter.begin(0);
    assert.equal(presenter.isClaimed(0), true);
    presenter.move(0, point(0));
    presenter.move(0, point(10));
    presenter.move(0, point(20));
    assert.equal(random.intCalls.length, 0);
    presenter.presentMovedSegment(VALID_SEGMENT);
    assert.equal(
      parent.children.filter(({ name }) => (
        name.startsWith('StandardBladeParticle-')
      )).length,
      contract.bladeId === 0 ? 0 : 1,
    );

    presenter.end(0);
    assert.equal(presenter.isClaimed(0), false);
    presenter.update(0);
    assert.equal(presenter.dispose(), true);
    assert.equal(parent.children.length, 0);
    assert.equal(parent.destroyed, false);
  });
}

for (const bladeId of [13, 16, 17] as const) {
  test(`advanced ID ${bladeId} owns movement and treats the moved-segment boundary as a validated no-op`, () => {
    cc.resetCreatedObjects();
    const random = new ScriptedRandom([]);
    const presenter = createPresenter(bladeId, '720x1280', random);
    const parent = new cc.Node(`Advanced-${bladeId}-Parent`);
    presenter.attach(parent as never);

    presenter.begin(0);
    assert.equal(presenter.isClaimed(0), true);
    presenter.move(0, point(0));
    presenter.move(0, point(80));
    const nodeCountBeforeBoundary = cc.createdNodes.length;
    presenter.presentMovedSegment(VALID_SEGMENT);
    assert.equal(cc.createdNodes.length, nodeCountBeforeBoundary);
    assert.equal(random.intCalls.length, 0);
    assert.equal(random.decileCalls.length, 0);
    assert.throws(
      () => presenter.presentMovedSegment({
        ...VALID_SEGMENT,
        slot: 4,
      }),
      /advanced blade moved segment is invalid/,
    );
    assert.throws(
      () => presenter.update(-0.01),
      /deltaSeconds must be non-negative and finite/,
    );

    presenter.end(0);
    assert.equal(presenter.isClaimed(0), false);
    presenter.update(0);
    assert.equal(presenter.dispose(), true);
    assert.equal(parent.children.length, 0);
    assert.equal(parent.destroyed, false);
    assert.throws(
      () => presenter.begin(0),
      /Disposed standard blade presenter cannot begin/,
    );
  });
}

test('invalid IDs and family/profile mismatches fail before allocating any presenter owner', () => {
  const basicZero = loadedProfile(0, '480x800');
  const dragonThirteen = loadedProfile(13, '480x800');
  const centipede = loadedProfile(17, '480x800');

  assertConstructionFailsWithoutOwners(null as never, /input must be an object/);
  assertConstructionFailsWithoutOwners({
    assetTree: '480x800',
    profile: null,
    random: new ScriptedRandom([]),
    viewportWidth: 480,
  } as never, /profile must be an object/);
  for (const bladeId of [-1, 18, 1.5]) {
    assertConstructionFailsWithoutOwners({
      assetTree: '480x800',
      profile: { ...basicZero, bladeId },
      random: new ScriptedRandom([]),
      viewportWidth: 480,
    } as never, /standard blade ID must be from 0 through 17/);
  }

  assertConstructionFailsWithoutOwners({
    assetTree: '480x800',
    profile: { ...dragonThirteen, bladeId: 0 },
    random: new ScriptedRandom([]),
    viewportWidth: 480,
  } as never, /ID 0 requires basic profile, got dragon/);
  assertConstructionFailsWithoutOwners({
    assetTree: '480x800',
    profile: { ...basicZero, bladeId: 13 },
    random: new ScriptedRandom([]),
    viewportWidth: 480,
  } as never, /ID 13 requires dragon profile, got basic/);
  assertConstructionFailsWithoutOwners({
    assetTree: '480x800',
    profile: { ...dragonThirteen, bladeId: 17 },
    random: new ScriptedRandom([]),
    viewportWidth: 480,
  } as never, /ID 17 requires centipede profile, got dragon/);
  assertConstructionFailsWithoutOwners({
    assetTree: '480x800',
    profile: { ...centipede, bladeId: 16 },
    random: new ScriptedRandom([]),
    viewportWidth: 480,
  } as never, /ID 16 requires dragon profile, got centipede/);
});

test('same-family resource, variant, and asset-tree mismatches never fall back to ID 0', () => {
  const basicZero = loadedProfile(0, '480x800');
  const dragonThirteen = loadedProfile(13, '480x800');

  assertConstructionFailsWithoutOwners({
    assetTree: '480x800',
    profile: { ...basicZero, bladeId: 12 },
    random: new ScriptedRandom([]),
    viewportWidth: 480,
  } as never, /particle resources.*selected blade|resource mismatch/);
  assertConstructionFailsWithoutOwners({
    assetTree: '720x1280',
    profile: basicZero,
    random: new ScriptedRandom([]),
    viewportWidth: 720,
  } as never, /resource mismatch/);
  assertConstructionFailsWithoutOwners({
    assetTree: '480x800',
    profile: { ...dragonThirteen, bladeId: 16 },
    random: new ScriptedRandom([]),
    viewportWidth: 480,
  } as never, /variant|resource|profile/i);
  assertConstructionFailsWithoutOwners({
    assetTree: '720x1280',
    profile: dragonThirteen,
    random: new ScriptedRandom([]),
    viewportWidth: 720,
  } as never, /resource|profile/i);
});

test('facade attach failure rolls back its child and permanently closes the wrapper', () => {
  cc.resetCreatedObjects();
  const presenter = createPresenter(0, '480x800', new ScriptedRandom([]));
  const ownedBeforeParent = [...cc.createdNodes];
  const parent = new cc.Node('AttachFailureParent');
  cc.failNextSiblingPlacementFor('ClassicBasicBladeRoot');

  assert.throws(
    () => presenter.attach(parent as never),
    /injected sibling placement failure/,
  );
  assert.equal(parent.children.length, 0);
  assert.equal(ownedBeforeParent.every(({ destroyed }) => destroyed), true);
  assert.equal(cc.createdMeshes.every(({ destroyed }) => destroyed), true);
  assert.equal(cc.createdMaterials.every(({ destroyed }) => destroyed), true);
  assert.equal(presenter.dispose(), false);
  assert.throws(
    () => presenter.attach(parent as never),
    /Disposed standard blade presenter cannot attach/,
  );
  assert.throws(
    () => presenter.update(0),
    /Disposed standard blade presenter cannot update/,
  );
});

function createPresenter(
  bladeId: number,
  assetTree: AssetTree,
  random: ScriptedRandom,
) {
  return StandardBladePresenter.create({
    assetTree,
    profile: loadedProfile(bladeId, assetTree) as never,
    random,
    viewportWidth: assetTree === '480x800' ? 480 : 720,
  });
}

function loadedProfile(bladeId: number, assetTree: AssetTree): unknown {
  if (bladeId <= 12) {
    return Object.freeze({
      bladeId,
      kind: 'basic' as const,
      particles: Object.freeze(
        getStandardBladeParticleResources(bladeId, assetTree)
          .map((resource: RasterContract) => loadedRaster(resource)),
      ),
      texture: loadedRaster(getStandardBasicBladeResource(bladeId, assetTree)),
    });
  }
  if (bladeId <= 16) {
    return Object.freeze({
      bladeId,
      kind: 'dragon' as const,
      particles: Object.freeze([]),
      resources: loadedMultipart(
        getStandardDragonBladeResources(bladeId, assetTree),
      ),
      variant: bladeId - 13,
    });
  }
  return Object.freeze({
    bladeId,
    kind: 'centipede' as const,
    particles: Object.freeze([]),
    resources: loadedMultipart(getStandardCentipedeBladeResources(assetTree)),
  });
}

function loadedMultipart(contract: MultipartContract) {
  return Object.freeze({
    body: loadedRaster(contract.body),
    bodySegmentCount: contract.bodySegmentCount,
    head: loadedRaster(contract.head),
    pointCapacity: contract.pointCapacity,
    tail: loadedRaster(contract.tail),
  });
}

function loadedRaster(contract: RasterContract): LoadedRaster {
  return Object.freeze({
    canonicalPath: contract.canonicalPath,
    dimensions: Object.freeze({
      height: contract.dimensions.height,
      width: contract.dimensions.width,
    }),
    spriteFrame: new cc.SpriteFrame(
      contract.canonicalPath,
      contract.dimensions.width,
      contract.dimensions.height,
    ),
  });
}

function assertConstructionFailsWithoutOwners(
  input: Parameters<typeof StandardBladePresenter.create>[0],
  pattern: RegExp,
): void {
  cc.resetCreatedObjects();
  assert.throws(
    () => StandardBladePresenter.create(input),
    pattern,
  );
  assert.equal(cc.createdNodes.length, 0);
  assert.equal(cc.createdMeshes.length, 0);
  assert.equal(cc.createdMaterials.length, 0);
}

function point(x: number, y = 0) {
  return Object.freeze({ x, y });
}
