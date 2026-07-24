import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const createdMaterials = [];
export const createdMeshes = [];
export const createdNodes = [];
let failingSiblingName = null;

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
    this.resetOptions = null;
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
    this.data = null;
    this.destroyCalls = 0;
    this.destroyed = false;
    this.name = name;
    this.renderingSubMeshes = [];
    this.struct = null;
    createdMeshes.push(this);
  }
  reset(options) {
    this.data = options.data;
    this.struct = options.struct;
    this.renderingSubMeshes = [{
      drawInfo: { vertexCount: 0 },
      invalidations: 0,
      invalidateGeometricInfo() { this.invalidations += 1; },
      vertexBuffers: [{
        updates: [],
        update(data, size) {
          this.updates.push({ data: new Uint8Array(data), size });
        },
      }],
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
    this.geometryChangedCalls = 0;
    this.mesh = null;
    this.sharedMaterial = null;
  }
  setSharedMaterial(material) { this.sharedMaterial = material; }
  onGeometryChanged() { this.geometryChangedCalls += 1; }
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
  StandardBasicBladePresenter,
} = await import(
  '../../../game/assets/scripts/creator/standard-basic-blade-presenter.ts'
);
const {
  ClassicBladePresenter,
} = await import(
  '../../../game/assets/scripts/creator/classic-blade-presenter.ts'
);
const {
  StandardBladeParticlePresenter,
} = await import(
  '../../../game/assets/scripts/creator/standard-blade-particle-presenter.ts'
);
const {
  getStandardBasicBladeResource,
  getStandardBladeParticleResources,
} = await import(
  '../../../game/assets/scripts/domain/standard-blade-resource-contract.ts'
);

type AssetTree = '480x800' | '720x1280';

interface CocosStub {
  readonly Material: new () => StubMaterial;
  readonly Mesh: new (name?: string) => StubMesh;
  readonly Node: new (name?: string) => StubNode;
  readonly SpriteFrame: new (
    label?: string,
    width?: number,
    height?: number,
    uv?: readonly number[],
  ) => StubSpriteFrame;
  readonly createdMaterials: StubMaterial[];
  readonly createdMeshes: StubMesh[];
  readonly createdNodes: StubNode[];
  failNextSiblingPlacementFor(name: string): void;
  resetCreatedObjects(): void;
}

interface StubMaterial {
  destroyCalls: number;
  destroyed: boolean;
  properties: Record<string, unknown>;
}

interface StubMesh {
  destroyCalls: number;
  destroyed: boolean;
}

interface StubNode {
  active: boolean;
  children: StubNode[];
  destroyCalls: number;
  destroyed: boolean;
  lastRequestedSiblingIndex: number | null;
  layer: number;
  readonly name: string;
  parent: StubNode | null;
  position: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  rotation: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  scale: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  destroy(): void;
  setParent(parent: StubNode | null): void;
}

interface StubSpriteFrame {
  destroyed: boolean;
  readonly label: string;
  readonly texture: unknown;
  readonly uv: readonly number[];
  destroy(): void;
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

interface LoadedBasicProfile {
  readonly bladeId: number;
  readonly kind: 'basic';
  readonly particles: readonly LoadedRaster[];
  readonly texture: LoadedRaster;
}

interface RandomCall {
  readonly maximumInclusive: number;
  readonly minimumInclusive: number;
}

class ScriptedRandom {
  readonly decileCalls: number[] = [];
  readonly intCalls: RandomCall[] = [];
  private decileOffset = 0;
  private intOffset = 0;
  private readonly deciles: readonly number[];
  private readonly integers: readonly number[];

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

const MOVED_SEGMENT = Object.freeze({
  current: Object.freeze({ x: 100, y: 200 }),
  previous: Object.freeze({ x: 80, y: 180 }),
  slot: 0,
  touchId: 41,
});

test('IDs 0, 7, and 12 compose their exact trail textures and particle profiles in both asset trees', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    for (const bladeId of [0, 7, 12] as const) {
      cc.resetCreatedObjects();
      const profile = loadedProfile(bladeId, assetTree);
      const random = new ScriptedRandom([]);
      const presenter = StandardBasicBladePresenter.create({
        assetTree,
        profile: profile as never,
        random,
        viewportWidth: assetTree === '480x800' ? 480 : 720,
      });

      assert.equal(presenter.selectedBladeId, bladeId);
      assert.ok(presenter.trailPresenter instanceof ClassicBladePresenter);
      assert.ok(
        presenter.particlePresenter instanceof StandardBladeParticlePresenter,
      );
      assert.equal(presenter.trailPresenter.root.active, false);
      assert.equal(presenter.trailPresenter.owners.length, 4);
      assert.equal(cc.createdNodes.length, 5);
      assert.equal(cc.createdMeshes.length, 4);
      assert.equal(cc.createdMaterials.length, 1);
      const material = cc.createdMaterials[0];
      assert.ok(material);
      assert.equal(
        material.properties.mainTexture,
        profile.texture.spriteFrame.texture,
      );

      const parent = new cc.Node(`${assetTree}-${bladeId}-Parent`);
      parent.layer = 23;
      presenter.attach(parent as never);
      assert.equal(presenter.trailPresenter.root.parent, parent);
      assert.equal(presenter.trailPresenter.root.layer, 23);
      assert.equal(presenter.trailPresenter.root.lastRequestedSiblingIndex, 1);
      assert.equal(presenter.particlePresenter.particles.length, 0);

      presenter.begin(0);
      assert.equal(presenter.isClaimed(0), true);
      presenter.move(0, point(0));
      presenter.move(0, point(10));
      presenter.move(0, point(20));
      assert.equal(
        presenter.trailPresenter.model.snapshot()[0]?.points.length,
        3,
      );
      assert.equal(random.intCalls.length, 0);
      assert.equal(random.decileCalls.length, 0);
      assert.equal(presenter.particlePresenter.particles.length, 0);
      presenter.end(0);
      assert.equal(presenter.isClaimed(0), false);
      presenter.update(0);
      assert.equal(
        presenter.trailPresenter.model.snapshot()[0]?.points.length,
        2,
      );

      assert.equal(presenter.dispose(), true);
      assert.equal(presenter.dispose(), false);
      assert.equal(presenter.trailPresenter.root.destroyed, true);
      assert.equal(material.destroyed, true);
      assert.equal(cc.createdMeshes.every(({ destroyed }) => destroyed), true);
    }
  }
});

test('begin and move never draw or emit; presentMovedSegment is the sole particle boundary and update advances both owners', () => {
  cc.resetCreatedObjects();
  const profile = loadedProfile(7, '480x800');
  const random = new ScriptedRandom([0, 50, 1, 100, -1, 50]);
  const presenter = StandardBasicBladePresenter.create({
    assetTree: '480x800',
    profile: profile as never,
    random,
    viewportWidth: 480,
  });
  const parent = new cc.Node('ParticleParent');
  presenter.attach(parent as never);

  presenter.begin(0);
  presenter.move(0, point(0));
  presenter.move(0, point(10));
  presenter.move(0, point(20));
  assert.equal(random.intCalls.length, 0);
  assert.equal(random.decileCalls.length, 0);
  assert.equal(presenter.particlePresenter.particles.length, 0);

  presenter.presentMovedSegment(MOVED_SEGMENT);
  assert.equal(random.intCalls.length, 6);
  assert.equal(presenter.particlePresenter.particles.length, 1);
  const particle = presenter.particlePresenter.particles[0];
  assert.ok(particle);
  assert.equal(
    particle.sprite.spriteFrame,
    requireRaster(profile.particles[0]).spriteFrame,
  );
  const particleNode = particle.node as unknown as StubNode;
  const particleSpriteNode = particle.spriteNode as unknown as StubNode;
  assert.deepEqual(particleNode.position, { x: 100, y: 200, z: 0 });

  presenter.move(0, point(30));
  assert.equal(random.intCalls.length, 6);
  assert.equal(presenter.particlePresenter.particles.length, 1);
  presenter.end(0);
  const beforeInvalidUpdate = presenter.trailPresenter.model.snapshot();
  assert.throws(
    () => presenter.update(-0.25),
    /deltaSeconds must be non-negative and finite/,
  );
  assert.deepEqual(presenter.trailPresenter.model.snapshot(), beforeInvalidUpdate);
  assert.deepEqual(particleNode.position, { x: 100, y: 200, z: 0 });

  presenter.update(0.25);
  assert.equal(
    presenter.trailPresenter.model.snapshot()[0]?.points.length,
    3,
  );
  assert.deepEqual(particleNode.position, { x: 150, y: 175, z: 0 });
  assert.deepEqual(particleSpriteNode.scale, { x: 0.5, y: 0.5, z: 1 });
  assert.equal(particle.opacity.opacity, 127.5);

  presenter.update(0.25);
  assert.equal(
    presenter.trailPresenter.model.snapshot()[0]?.points.length,
    2,
  );
  assert.equal(particleNode.destroyed, true);
  assert.equal(presenter.particlePresenter.particles.length, 0);
});

test('ID 0 remains particle-free while ID 12 binds its selected high-resolution rainbow raster', () => {
  cc.resetCreatedObjects();
  const idZeroRandom = new ScriptedRandom([]);
  const idZero = createPresenter(0, '480x800', idZeroRandom);
  const idZeroParent = new cc.Node('ID0Parent');
  idZero.attach(idZeroParent as never);
  idZero.begin(0);
  idZero.move(0, point(5));
  idZero.presentMovedSegment(MOVED_SEGMENT);
  idZero.update(1);
  assert.equal(idZeroRandom.intCalls.length, 0);
  assert.equal(idZeroRandom.decileCalls.length, 0);
  assert.equal(idZero.particlePresenter.particles.length, 0);
  assert.equal(
    idZeroParent.children.some(({ name }) => (
      name.startsWith('StandardBladeParticle-')
    )),
    false,
  );
  idZero.dispose();

  cc.resetCreatedObjects();
  const profile = loadedProfile(12, '720x1280');
  const idTwelve = StandardBasicBladePresenter.create({
    assetTree: '720x1280',
    profile: profile as never,
    random: new ScriptedRandom([0, 4, 100, 1, 72, -1, 72]),
    viewportWidth: 720,
  });
  const idTwelveParent = new cc.Node('ID12Parent');
  idTwelve.attach(idTwelveParent as never);
  idTwelve.presentMovedSegment(MOVED_SEGMENT);
  const rainbow = idTwelve.particlePresenter.particles[0];
  assert.ok(rainbow);
  assert.equal(
    rainbow.command.logicalPath,
    'Blades/Particles/Rainbow/rainbowstar4.png',
  );
  assert.equal(
    rainbow.sprite.spriteFrame,
    requireRaster(profile.particles[4]).spriteFrame,
  );
  assert.deepEqual(rainbow.transform.contentSize, {
    width: 135,
    height: 131,
  });
});

test('profile, tree, random, width, and SpriteFrame validation fail before allocating mesh owners', () => {
  const compactZero = loadedProfile(0, '480x800');
  assertConstructionFailsWithoutOwners(
    {
      assetTree: '480x800',
      profile: {
        bladeId: 13,
        kind: 'dragon',
        particles: [],
      } as never,
      random: new ScriptedRandom([]),
      viewportWidth: 480,
    },
    /requires an exact loaded basic profile/,
  );
  assertConstructionFailsWithoutOwners(
    {
      assetTree: '720x1280',
      profile: compactZero as never,
      random: new ScriptedRandom([]),
      viewportWidth: 720,
    },
    /resource mismatch.*720x1280\/Blades\/blade0\.png/,
  );

  const compactTwelve = loadedProfile(12, '480x800');
  assertConstructionFailsWithoutOwners(
    {
      assetTree: '480x800',
      profile: {
        ...compactTwelve,
        texture: compactZero.texture,
      } as never,
      random: new ScriptedRandom([]),
      viewportWidth: 480,
    },
    /resource mismatch.*rainbow\.png/,
  );

  const compactSeven = loadedProfile(7, '480x800');
  assertConstructionFailsWithoutOwners(
    {
      assetTree: '480x800',
      profile: {
        ...compactSeven,
        particles: [],
      } as never,
      random: new ScriptedRandom([]),
      viewportWidth: 480,
    },
    /particle resources do not match the selected blade/,
  );
  assertConstructionFailsWithoutOwners(
    {
      assetTree: '480x800',
      profile: compactSeven as never,
      random: {} as never,
      viewportWidth: 480,
    },
    /random must provide nextIntInclusive\(\) and nextDecile\(\)/,
  );
  assertConstructionFailsWithoutOwners(
    {
      assetTree: '480x800',
      profile: compactSeven as never,
      random: new ScriptedRandom([]),
      viewportWidth: 0,
    },
    /viewportWidth must be positive and finite/,
  );

  const invalidUvFrame = new cc.SpriteFrame(
    'invalid-uv',
    256,
    256,
    [0, 1, Number.NaN],
  );
  assertConstructionFailsWithoutOwners(
    {
      assetTree: '480x800',
      profile: {
        ...compactZero,
        texture: {
          ...compactZero.texture,
          spriteFrame: invalidUvFrame,
        },
      } as never,
      random: new ScriptedRandom([]),
      viewportWidth: 480,
    },
    /valid finite four-corner SpriteFrame UV quad/,
  );

  const destroyedFrame = new cc.SpriteFrame('destroyed', 256, 256);
  destroyedFrame.destroy();
  assertConstructionFailsWithoutOwners(
    {
      assetTree: '480x800',
      profile: {
        ...compactZero,
        texture: {
          ...compactZero.texture,
          spriteFrame: destroyedFrame,
        },
      } as never,
      random: new ScriptedRandom([]),
      viewportWidth: 480,
    },
    /valid finite four-corner SpriteFrame UV quad/,
  );
  assertConstructionFailsWithoutOwners(
    {
      assetTree: '480x800',
      profile: {
        ...compactZero,
        bladeId: 13,
      } as never,
      random: new ScriptedRandom([]),
      viewportWidth: 480,
    },
    /BasicBlade ID must be from 0 through 12/,
  );
});

test('an attachment failure rolls back both child owners and leaves no live node, mesh, or material', () => {
  cc.resetCreatedObjects();
  const presenter = createPresenter(7, '480x800', new ScriptedRandom([]));
  const ownedNodes = [...cc.createdNodes];
  const parent = new cc.Node('AttachParent');
  cc.failNextSiblingPlacementFor('ClassicBasicBladeRoot');

  assert.throws(
    () => presenter.attach(parent as never),
    /injected sibling placement failure/,
  );

  assert.equal(parent.children.length, 0);
  assert.equal(ownedNodes.every(({ destroyed }) => destroyed), true);
  assert.equal(cc.createdMeshes.every(({ destroyed }) => destroyed), true);
  assert.equal(cc.createdMaterials.every(({ destroyed }) => destroyed), true);
  assert.equal(presenter.trailPresenter.root.destroyCalls, 1);
  assert.equal(presenter.dispose(), false);
  assert.throws(
    () => presenter.begin(0),
    /Disposed Standard BasicBlade presenter cannot begin/,
  );
  assert.throws(
    () => presenter.presentMovedSegment(MOVED_SEGMENT),
    /Disposed Standard BasicBlade presenter cannot present a moved segment/,
  );

  cc.resetCreatedObjects();
  const invalidParentPresenter = createPresenter(
    0,
    '720x1280',
    new ScriptedRandom([]),
  );
  const invalidOwnedNodes = [...cc.createdNodes];
  const destroyedParent = new cc.Node('DestroyedParent');
  destroyedParent.destroy();
  assert.throws(
    () => invalidParentPresenter.attach(destroyedParent as never),
    /particle parent must be valid/,
  );
  assert.equal(invalidOwnedNodes.every(({ destroyed }) => destroyed), true);
  assert.equal(cc.createdMeshes.every(({ destroyed }) => destroyed), true);
  assert.equal(cc.createdMaterials.every(({ destroyed }) => destroyed), true);
  assert.equal(invalidParentPresenter.dispose(), false);
});

test('successful attachment is single-owner and disposal destroys an active trail and particle exactly once', () => {
  cc.resetCreatedObjects();
  const presenter = createPresenter(
    7,
    '480x800',
    new ScriptedRandom([0, 50, 1, 100, -1, 50]),
  );
  assert.throws(
    () => presenter.begin(0),
    /must be attached before it can begin/,
  );
  assert.throws(
    () => presenter.update(0),
    /must be attached before it can update/,
  );

  const parent = new cc.Node('Parent');
  presenter.attach(parent as never);
  assert.throws(
    () => presenter.attach(new cc.Node('SecondParent') as never),
    /already attached/,
  );
  assert.equal(presenter.trailPresenter.root.destroyed, false);

  presenter.begin(0);
  presenter.move(0, point(0));
  presenter.move(0, point(10));
  presenter.move(0, point(20));
  presenter.presentMovedSegment(MOVED_SEGMENT);
  const particle = presenter.particlePresenter.particles[0];
  assert.ok(particle);
  const particleNode = particle.node as unknown as StubNode;
  const trailRoot = presenter.trailPresenter.root as unknown as StubNode;
  const material = cc.createdMaterials[0];
  assert.ok(material);
  const meshes = [...cc.createdMeshes];

  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
  assert.equal(trailRoot.destroyed, true);
  assert.equal(trailRoot.destroyCalls, 1);
  assert.equal(particleNode.destroyed, true);
  assert.equal(particleNode.destroyCalls, 1);
  assert.equal(material.destroyed, true);
  assert.equal(material.destroyCalls, 1);
  assert.equal(meshes.every(({ destroyed }) => destroyed), true);
  assert.equal(meshes.every(({ destroyCalls }) => destroyCalls === 1), true);
  assert.equal(parent.destroyed, false);
  assert.equal(parent.children.length, 0);
  assert.throws(
    () => presenter.attach(parent as never),
    /Disposed Standard BasicBlade presenter cannot attach/,
  );
  assert.throws(
    () => presenter.move(0, point(30)),
    /Disposed Standard BasicBlade presenter cannot move/,
  );
  assert.throws(
    () => presenter.end(0),
    /Disposed Standard BasicBlade presenter cannot end/,
  );
  assert.throws(
    () => presenter.isClaimed(0),
    /Disposed Standard BasicBlade presenter cannot inspect ownership/,
  );
  assert.throws(
    () => presenter.update(0),
    /Disposed Standard BasicBlade presenter cannot update/,
  );
});

function createPresenter(
  bladeId: number,
  assetTree: AssetTree,
  random: ScriptedRandom,
) {
  return StandardBasicBladePresenter.create({
    assetTree,
    profile: loadedProfile(bladeId, assetTree) as never,
    random,
    viewportWidth: assetTree === '480x800' ? 480 : 720,
  });
}

function loadedProfile(
  bladeId: number,
  assetTree: AssetTree,
): LoadedBasicProfile {
  return Object.freeze({
    bladeId,
    kind: 'basic' as const,
    particles: Object.freeze(
      getStandardBladeParticleResources(bladeId, assetTree)
        .map((contract: RasterContract) => loadedRaster(contract)),
    ),
    texture: loadedRaster(getStandardBasicBladeResource(bladeId, assetTree)),
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
  input: Parameters<typeof StandardBasicBladePresenter.create>[0],
  pattern: RegExp,
): void {
  cc.resetCreatedObjects();
  assert.throws(
    () => StandardBasicBladePresenter.create(input),
    pattern,
  );
  assert.equal(cc.createdNodes.length, 0);
  assert.equal(cc.createdMeshes.length, 0);
  assert.equal(cc.createdMaterials.length, 0);
}

function point(x: number, y = 0) {
  return Object.freeze({ x, y });
}

function requireRaster(value: LoadedRaster | undefined): LoadedRaster {
  assert.ok(value);
  return value;
}
