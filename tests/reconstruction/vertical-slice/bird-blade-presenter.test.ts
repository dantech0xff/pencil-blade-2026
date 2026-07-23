import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const createdMaterials = [];
export const createdMeshes = [];
export const createdNodes = [];

export function resetCreatedObjects() {
  createdMaterials.length = 0;
  createdMeshes.length = 0;
  createdNodes.length = 0;
}

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
}

export class Material {
  constructor() {
    this.destroyed = false;
    this.properties = {};
    this.resetOptions = null;
    createdMaterials.push(this);
  }
  reset(options) { this.resetOptions = options; }
  setProperty(name, value) { this.properties[name] = value; }
  destroy() { this.destroyed = true; }
}

export class Mesh {
  constructor(name = '') {
    this.data = null;
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
  destroy() { this.destroyed = true; }
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
  constructor(width = 0, height = 0, label = '') {
    this.destroyed = false;
    this.label = label;
    this.originalSize = { width, height };
    this.rect = { width, height };
    this.texture = Object.freeze({ label });
    this.uv = [0, 1, 1, 1, 0, 0, 1, 0];
  }
}

export class Node {
  constructor(name = '') {
    this.active = true;
    this.children = [];
    this.components = new Map();
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
  get activeInHierarchy() {
    return this.active && (this.parent === null || this.parent.activeInHierarchy);
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
  setParent(parent, keepWorldTransform = false) {
    const world = this.worldPosition;
    if (this.parent !== null) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
    if (keepWorldTransform) {
      this.setWorldPosition(world.x, world.y, world.z);
    }
  }
  setPosition(x, y, z) { this.position = { x, y, z }; }
  setWorldPosition(x, y, z) {
    const parent = this.parent === null
      ? { x: 0, y: 0, z: 0 }
      : this.parent.worldPosition;
    this.position = {
      x: x - parent.x,
      y: y - parent.y,
      z: z - parent.z,
    };
  }
  setRotationFromEuler(x, y, z) { this.rotation = { x, y, z }; }
  setScale(x, y, z) { this.scale = { x, y, z }; }
  setSiblingIndex(index) {
    this.lastRequestedSiblingIndex = index;
    if (this.parent === null) return;
    const siblings = this.parent.children;
    const current = siblings.indexOf(this);
    if (current >= 0) siblings.splice(current, 1);
    siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, this);
  }
  destroy() {
    if (this.destroyed) return;
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
  BIRD_BLADE_ANIMATION_FRAME_DELAY_SECONDS,
  BIRD_BLADE_Z_ORDER,
  BirdBladePresenter,
} = await import(
  '../../../game/assets/scripts/creator/bird-blade-presenter.ts'
);
const {
  getBirdResourceProfile,
  listBirdRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/bird-resource-contract.ts'
);

interface CocosStub {
  readonly Material: new () => StubMaterial;
  readonly Mesh: new (name?: string) => StubMesh;
  readonly MeshRenderer: new () => StubMeshRenderer;
  readonly Node: new (name?: string) => StubNode;
  readonly SpriteFrame: new (
    width?: number,
    height?: number,
    label?: string,
  ) => StubSpriteFrame;
  readonly UIOpacity: new () => StubOpacity;
  readonly UITransform: new () => StubTransform;
  readonly createdMaterials: StubMaterial[];
  readonly createdMeshes: StubMesh[];
  readonly createdNodes: StubNode[];
  readonly isValid: (value: unknown) => boolean;
  resetCreatedObjects(): void;
}

interface StubMaterial {
  destroyed: boolean;
  properties: Record<string, unknown>;
  resetOptions: {
    readonly effectName: string;
    readonly technique: number;
  } | null;
}

interface StubMesh {
  data: Uint8Array;
  destroyed: boolean;
  readonly renderingSubMeshes: readonly [{
    readonly drawInfo: { vertexCount: number };
    readonly vertexBuffers: readonly [{
      readonly updates: readonly Array<{
        readonly data: Uint8Array;
        readonly size: number;
      }>;
    }];
  }];
  readonly struct: {
    readonly vertexBundles: readonly [{
      readonly view: {
        count: number;
        length: number;
        stride: number;
      };
    }];
  };
}

interface StubMeshRenderer {
  mesh: StubMesh | null;
  sharedMaterial: StubMaterial | null;
}

interface StubNode {
  active: boolean;
  readonly activeInHierarchy: boolean;
  children: StubNode[];
  destroyed: boolean;
  lastRequestedSiblingIndex: number | null;
  layer: number;
  readonly name: string;
  parent: StubNode | null;
  position: Readonly<{ x: number; y: number; z: number }>;
  rotation: Readonly<{ x: number; y: number; z: number }>;
  scale: Readonly<{ x: number; y: number; z: number }>;
  readonly worldPosition: Readonly<{ x: number; y: number; z: number }>;
  addComponent<T>(Type: new () => T): T;
  getComponent<T>(Type: new () => T): T | null;
  setParent(parent: StubNode | null, keepWorldTransform?: boolean): void;
  setPosition(x: number, y: number, z: number): void;
  setWorldPosition(x: number, y: number, z: number): void;
}

interface StubOpacity {
  opacity: number;
}

interface StubSpriteFrame {
  destroyed: boolean;
  readonly label: string;
  readonly originalSize: Readonly<{ height: number; width: number }>;
  readonly rect: Readonly<{ height: number; width: number }>;
  readonly texture: unknown;
  readonly uv: readonly number[];
}

interface StubTransform {
  readonly anchorPoint: Readonly<{ x: number; y: number }>;
  readonly contentSize: Readonly<{ height: number; width: number }>;
}

interface RasterContract {
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{ height: number; width: number }>;
}

class BoundsAwareRandom {
  readonly calls: Array<Readonly<{
    maximumInclusive: number;
    minimumInclusive: number;
  }>> = [];

  nextIntInclusive(
    minimumInclusive: number,
    maximumInclusive: number,
  ): number {
    this.calls.push(Object.freeze({ minimumInclusive, maximumInclusive }));
    return maximumInclusive;
  }
}

class ScriptedRandom {
  readonly calls: Array<Readonly<{
    maximumInclusive: number;
    minimumInclusive: number;
  }>> = [];
  private readonly draws: readonly number[];
  private offset = 0;

  constructor(draws: readonly number[]) {
    this.draws = draws;
  }

  nextIntInclusive(
    minimumInclusive: number,
    maximumInclusive: number,
  ): number {
    this.calls.push(Object.freeze({ minimumInclusive, maximumInclusive }));
    const value = this.draws[this.offset];
    this.offset += 1;
    if (value === undefined) {
      throw new Error('scripted random exhausted');
    }
    return value;
  }
}

test('presenter starts centered with ten exact 0.1-second looping main frames', () => {
  cc.resetCreatedObjects();
  const resources = loadedBirdResources('480x800');
  const random = new BoundsAwareRandom();
  const presenter = BirdBladePresenter.create({
    random,
    resources: resources as never,
    viewport: { width: 480, height: 800 },
  });

  assert.equal(BIRD_BLADE_ANIMATION_FRAME_DELAY_SECONDS, Math.fround(0.1));
  assert.deepEqual(presenter.state.snapshot().currentPosition, { x: 240, y: 400 });
  assert.equal(presenter.state.snapshot().type, 1);
  assert.deepEqual(presenter.main.node.position, { x: 240, y: 400, z: 0 });
  assert.equal(presenter.main.node.active, true);
  assert.equal(presenter.leftDirection.node.active, false);
  assert.equal(presenter.rightDirection.node.active, false);
  assert.equal(
    (presenter.main.sprite.spriteFrame as unknown as StubSpriteFrame).label,
    '480x800/Birds/bird-anim-1-0.png',
  );
  const trailMesh = cc.createdMeshes[0];
  const trailMaterial = cc.createdMaterials[0];
  assert.ok(trailMesh);
  assert.ok(trailMaterial);
  assert.equal(trailMesh.data.byteLength, 500);
  assert.equal(trailMesh.struct.vertexBundles[0].view.stride, 20);
  assert.equal(
    trailMaterial.properties.mainTexture,
    resources.blade.spriteFrame.texture,
  );

  const parent = new cc.Node('Parent');
  parent.layer = 13;
  presenter.attach(parent as never);
  assert.equal(presenter.root.lastRequestedSiblingIndex, BIRD_BLADE_Z_ORDER);
  assert.equal(presenter.root.layer, 13);
  assert.equal(presenter.main.node.layer, 13);

  for (let frame = 1; frame <= 10; frame += 1) {
    const update = presenter.update(0.1);
    assert.equal(update.branch, 'idle');
    assert.equal(presenter.snapshot.animationFrameIndex, frame % 10);
    assert.equal(
      (presenter.main.sprite.spriteFrame as unknown as StubSpriteFrame).label,
      `480x800/Birds/bird-anim-1-${frame % 10}.png`,
    );
  }
  assert.equal(random.calls.length, 10);
  assert.deepEqual(
    random.calls,
    Array.from({ length: 10 }, () => ({
      minimumInclusive: 0,
      maximumInclusive: 4,
    })),
  );
});

test('presenter derives type 2 from loaded resources and rejects a mismatched profile', () => {
  const resources = loadedBirdResources('480x800', 2);
  const presenter = BirdBladePresenter.create({
    random: new BoundsAwareRandom(),
    resources: resources as never,
    viewport: { width: 480, height: 800 },
  });

  assert.equal(presenter.state.snapshot().type, 2);
  assert.equal(
    (presenter.main.sprite.spriteFrame as unknown as StubSpriteFrame).label,
    '480x800/Birds/bird-anim-2-0.png',
  );
  assert.equal(
    (presenter.leftDirection.sprite.spriteFrame as unknown as StubSpriteFrame).label,
    '480x800/Birds/bird-left-2.png',
  );
  assert.equal(
    (presenter.rightDirection.sprite.spriteFrame as unknown as StubSpriteFrame).label,
    '480x800/Birds/bird-right-2.png',
  );
  assert.deepEqual(
    presenter.leftDirection.transform.contentSize,
    { width: 110, height: 101 },
  );
  assert.deepEqual(
    presenter.rightDirection.transform.contentSize,
    { width: 111, height: 101 },
  );

  assert.throws(
    () => BirdBladePresenter.create({
      random: new BoundsAwareRandom(),
      resources: { ...resources, birdType: 1 } as never,
      viewport: { width: 480, height: 800 },
    }),
    /resources profile must match Bird type 1/,
  );
  assert.throws(
    () => BirdBladePresenter.create({
      random: new BoundsAwareRandom(),
      resources: {
        ...resources,
        profile: getBirdResourceProfile('480x800'),
      } as never,
      viewport: { width: 480, height: 800 },
    }),
    /resources profile must match Bird type 2/,
  );
});

test('attachment preserves native lower-left world coordinates under a translated Canvas root', () => {
  const resources = loadedBirdResources('480x800');
  const presenter = BirdBladePresenter.create({
    random: new ScriptedRandom([0, 3, -1, -192, 1, -123]),
    resources: resources as never,
    viewport: { width: 480, height: 800 },
  });
  const translatedCanvasRoot = new cc.Node('TranslatedCanvasRoot');
  translatedCanvasRoot.setPosition(240, 400, 0);

  presenter.attach(translatedCanvasRoot as never);

  assert.deepEqual(presenter.root.worldPosition, { x: 0, y: 0, z: 0 });
  assert.deepEqual(presenter.main.node.worldPosition, {
    x: 240,
    y: 400,
    z: 0,
  });
  const trailNode = presenter.root.children.find(({ name }) => (
    name === 'BirdBladeTrail'
  ));
  assert.ok(trailNode);
  assert.deepEqual(trailNode.worldPosition, { x: 0, y: 0, z: 0 });

  presenter.update(0);
  const particle = presenter.particles[0];
  assert.ok(particle);
  assert.deepEqual(particle.node.worldPosition, {
    x: 240,
    y: 307.45001220703125,
    z: 0,
  });
});

test('x equality selects left, busy touches reject, and strict overshoot keeps directional rendering', () => {
  const equalityPresenter = BirdBladePresenter.create({
    random: new BoundsAwareRandom(),
    resources: loadedBirdResources('480x800') as never,
    viewport: { width: 480, height: 800 },
  });
  equalityPresenter.attach(new cc.Node('Parent') as never);

  assert.deepEqual(equalityPresenter.touch({ x: 240, y: 500 }), {
    accepted: true,
    activeDirection: 'left',
    resetTrail: true,
    rotationDegrees: 270,
  });
  assert.equal(equalityPresenter.main.node.active, true);
  assert.equal(equalityPresenter.leftDirection.node.active, true);
  assert.equal(equalityPresenter.rightDirection.node.active, false);
  assert.deepEqual(equalityPresenter.leftDirection.node.rotation, {
    x: 0,
    y: 0,
    z: 270,
  });
  const beforeBusy = equalityPresenter.snapshot;
  assert.equal(
    equalityPresenter.touch({ x: Number.NaN, y: Number.POSITIVE_INFINITY }).accepted,
    false,
  );
  assert.deepEqual(equalityPresenter.snapshot, beforeBusy);

  const movementPresenter = BirdBladePresenter.create({
    random: new ScriptedRandom([1, 4, 4, 4, 4]),
    resources: loadedBirdResources('480x800') as never,
    viewport: { width: 480, height: 800 },
  });
  movementPresenter.attach(new cc.Node('Parent') as never);
  movementPresenter.touch({ x: 857, y: 400 });

  const equality = movementPresenter.update(0.5);
  assert.equal(equality.overshot, false);
  assert.equal(equality.stateAfter, 1);
  assert.equal(movementPresenter.main.node.active, false);
  assert.equal(movementPresenter.rightDirection.node.active, true);
  assert.deepEqual(movementPresenter.rightDirection.node.position, {
    x: 857,
    y: 400,
    z: 0,
  });

  const overshoot = movementPresenter.update(0.5);
  assert.equal(overshoot.overshot, true);
  assert.equal(overshoot.stateAfter, 2);
  assert.equal(movementPresenter.rightDirection.node.active, true);
  assert.deepEqual(movementPresenter.peekCachedRaySegment(), {
    previous: { x: 240, y: 400 },
    current: { x: 857, y: 400 },
  });
  assert.equal(movementPresenter.acknowledgeCachedRay(), true);
  assert.equal(movementPresenter.acknowledgeCachedRay(), false);

  const settle = movementPresenter.update(0);
  assert.equal(settle.branch, 'settle');
  assert.equal(settle.stateAfter, 0);
  assert.equal(movementPresenter.main.node.active, false);
  assert.equal(movementPresenter.rightDirection.node.active, true);
  assert.equal(movementPresenter.snapshot.trail.disposing, true);

  movementPresenter.update(0);
  assert.equal(movementPresenter.main.node.active, true);
  assert.equal(movementPresenter.rightDirection.node.active, false);
});

test('idle update plans and presents the selected X-Mas particle with native actions and lifetime', () => {
  const resources = loadedBirdResources('480x800');
  const random = new ScriptedRandom([
    0, 3, -1, -192, 1, -123,
    4,
    4,
  ]);
  const presenter = BirdBladePresenter.create({
    random,
    resources: resources as never,
    viewport: { width: 480, height: 800 },
  });
  presenter.attach(new cc.Node('Parent') as never);

  const idle = presenter.update(0);
  assert.equal(idle.branch, 'idle');
  assert.equal(idle.particleCommands.length, 1);
  assert.equal(presenter.particles.length, 1);
  const particle = presenter.particles[0];
  assert.ok(particle);
  assert.equal(
    particle.sprite.spriteFrame,
    resources.particles[3].spriteFrame,
  );
  assert.equal(particle.node.lastRequestedSiblingIndex, 1);
  assert.deepEqual(particle.node.position, {
    x: 240,
    y: 307.45001220703125,
    z: 0,
  });
  assert.deepEqual(particle.spriteNode.position, { x: 0, y: 0, z: 0 });
  assert.deepEqual(particle.transform.contentSize, { width: 34, height: 34 });
  assert.deepEqual(particle.transform.anchorPoint, { x: 0.5, y: 0.5 });
  assert.equal(particle.opacity.opacity, 255);
  assert.equal(Object.isFrozen(particle.command), true);
  assert.equal(Object.isFrozen(particle.command.basePosition), true);

  presenter.update(0.25);
  assert.equal(presenter.particles.length, 1);
  assert.deepEqual(particle.spriteNode.position, {
    x: 96,
    y: -61.5,
    z: 0,
  });
  assert.deepEqual(particle.spriteNode.scale, { x: 0.5, y: 0.5, z: 1 });
  assert.deepEqual(particle.spriteNode.rotation, { x: 0.5, y: 0.5, z: 0 });
  assert.equal(particle.opacity.opacity, 127.5);

  presenter.update(0.25);
  assert.equal(presenter.particles.length, 0);
  assert.equal(particle.node.destroyed, true);
  assert.equal(random.calls[0]?.maximumInclusive, 4);
});

test('testblade7 trail is single-owner, builds geometry, disposes by frames, and uses no Classic blade production adapters', () => {
  const source = readFileSync(
    `${REPOSITORY_ROOT}game/assets/scripts/creator/bird-blade-presenter.ts`,
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /BladeInputController|ClassicBladePresenter|BladeTracks|BasicBladeTrailModel/,
  );
  assert.match(source, /resources\.blade/);
  assert.match(source, /createBasicBladeGeometry/);
  assert.match(source, /builtin-unlit/);

  cc.resetCreatedObjects();
  const presenter = BirdBladePresenter.create({
    random: new BoundsAwareRandom(),
    resources: loadedBirdResources('480x800') as never,
    viewport: { width: 480, height: 800 },
  });
  presenter.attach(new cc.Node('Parent') as never);
  presenter.touch({ x: 2000, y: 400 });
  presenter.update(0.1);
  presenter.update(0.1);
  presenter.update(0.1);

  assert.equal(cc.createdMeshes.length, 1);
  assert.equal(cc.createdMaterials.length, 1);
  assert.equal(presenter.snapshot.trail.points.length, 3);
  assert.ok(presenter.snapshot.trail.geometry);
  assert.equal(cc.createdMeshes[0]?.renderingSubMeshes[0].drawInfo.vertexCount, 4);
});

test('explicit disposal destroys trail and particles exactly once and guards further use', () => {
  cc.resetCreatedObjects();
  const presenter = BirdBladePresenter.create({
    random: new ScriptedRandom([0, 0, 0, -24]),
    resources: loadedBirdResources('480x800') as never,
    viewport: { width: 480, height: 800 },
  });
  presenter.attach(new cc.Node('Parent') as never);
  presenter.update(0);
  const particle = presenter.particles[0];
  assert.ok(particle);
  const mesh = cc.createdMeshes[0];
  const material = cc.createdMaterials[0];
  assert.ok(mesh);
  assert.ok(material);

  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
  assert.equal(presenter.root.destroyed, true);
  assert.equal(particle.node.destroyed, true);
  assert.equal(mesh.destroyed, true);
  assert.equal(material.destroyed, true);
  assert.throws(() => presenter.update(0), /Disposed BirdBlade/);
  assert.throws(() => presenter.touch({ x: 1, y: 2 }), /Disposed BirdBlade/);
  assert.throws(
    () => presenter.attach(new cc.Node('Parent') as never),
    /Disposed BirdBlade/,
  );
});

test('active BirdBlade parent may be assembled below an inactive detached ancestor', () => {
  cc.resetCreatedObjects();
  const detachedAncestor = new cc.Node('DetachedAncestor');
  detachedAncestor.active = false;
  const detachedActiveParent = new cc.Node('DetachedActiveParent');
  detachedActiveParent.setParent(detachedAncestor);
  assert.equal(detachedActiveParent.active, true);
  assert.equal(detachedActiveParent.activeInHierarchy, false);

  const presenter = BirdBladePresenter.create({
    random: new BoundsAwareRandom(),
    resources: loadedBirdResources('480x800') as never,
    viewport: { width: 480, height: 800 },
  });

  assert.doesNotThrow(() => presenter.attach(detachedActiveParent as never));
  assert.equal(presenter.root.parent, detachedActiveParent);
  assert.equal(presenter.snapshot.attached, true);
  assert.equal(presenter.root.active, true);
  assert.equal(presenter.root.lastRequestedSiblingIndex, BIRD_BLADE_Z_ORDER);
});

test('invalid viewport, random, parent, and changed raster geometry reject', () => {
  const resources = loadedBirdResources('720x1280');
  const validInput = {
    random: new BoundsAwareRandom(),
    resources: resources as never,
    viewport: { width: 720, height: 1280 },
  };

  assert.throws(
    () => BirdBladePresenter.create({ ...validInput, viewport: { width: 0, height: 1 } }),
    /viewport/,
  );
  assert.throws(
    () => BirdBladePresenter.create({ ...validInput, random: {} as never }),
    /nextIntInclusive/,
  );
  assert.throws(
    () => BirdBladePresenter.create({
      ...validInput,
      resources: {
        ...resources,
        blade: {
          ...resources.blade,
          spriteFrame: new cc.SpriteFrame(65, 65, 'bad'),
        },
      } as never,
    }),
    /SpriteFrame geometry/,
  );

  const presenter = BirdBladePresenter.create(validInput);
  const inactive = new cc.Node('Inactive');
  inactive.active = false;
  assert.throws(() => presenter.attach(inactive as never), /valid and active/);
  const destroyed = new cc.Node('Destroyed');
  destroyed.destroy();
  assert.throws(() => presenter.attach(destroyed as never), /valid and active/);
  assert.throws(() => presenter.update(0), /must be attached/);
});

function loadedBirdResources(
  assetTree: '480x800' | '720x1280',
  birdType: 1 | 2 = 1,
) {
  const profile = getBirdResourceProfile(assetTree, birdType);
  const contracts = listBirdRasterResources(assetTree, birdType);
  const loadedByPath = new Map(
    contracts.map((contract) => [
      contract.canonicalPath,
      loadedRaster(contract),
    ]),
  );
  const requireRaster = (contract: RasterContract) => {
    const loaded = loadedByPath.get(contract.canonicalPath);
    assert.ok(loaded);
    return loaded;
  };
  const orderedRasters = Object.freeze(contracts.map(requireRaster));
  return Object.freeze({
    animationFrames: Object.freeze(profile.animationFrames.map(requireRaster)),
    assetTree,
    blade: requireRaster(profile.blade),
    birdType,
    leftDirection: requireRaster(profile.leftDirection),
    orderedRasters,
    particles: Object.freeze(profile.particles.map(requireRaster)),
    profile,
    rasterCount: 17,
    rightDirection: requireRaster(profile.rightDirection),
    raster: requireRaster,
  });
}

function loadedRaster(contract: RasterContract) {
  return Object.freeze({
    ...contract,
    spriteFrame: new cc.SpriteFrame(
      contract.dimensions.width,
      contract.dimensions.height,
      contract.canonicalPath,
    ),
  });
}
