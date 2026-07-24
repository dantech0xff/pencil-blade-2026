import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const createdNodes = [];
let nextFailedComponentConstructionName = null;
let nextFailedNodeConstructionName = null;

export function resetCreatedObjects() {
  createdNodes.length = 0;
  nextFailedComponentConstructionName = null;
  nextFailedNodeConstructionName = null;
}

export function failNextComponentConstruction(name) {
  nextFailedComponentConstructionName = name;
}

export function failNextNodeConstruction(name) {
  nextFailedNodeConstructionName = name;
}

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
  }
  destroy() { this.destroyed = true; }
}

export class Node {
  constructor(name = '') {
    if (nextFailedNodeConstructionName === name) {
      nextFailedNodeConstructionName = null;
      throw new Error('Injected node construction failure: ' + name);
    }
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
  addComponent(Type) {
    if (nextFailedComponentConstructionName === Type.name) {
      nextFailedComponentConstructionName = null;
      throw new Error('Injected component construction failure: ' + Type.name);
    }
    const component = new Type();
    component.node = this;
    this.components.set(Type, component);
    return component;
  }
  getComponent(Type) { return this.components.get(Type) ?? null; }
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
  StandardBladeParticlePresenter,
} = await import(
  '../../../game/assets/scripts/creator/standard-blade-particle-presenter.ts'
);
const {
  STANDARD_BLADE_PARTICLE_Z_ORDER,
} = await import(
  '../../../game/assets/scripts/domain/standard-blade-particle-plan.ts'
);
const {
  getStandardBladeParticleResources,
} = await import(
  '../../../game/assets/scripts/domain/standard-blade-resource-contract.ts'
);

type AssetTree = '480x800' | '720x1280';

interface CocosStub {
  readonly Node: new (name?: string) => StubNode;
  readonly Sprite: {
    new (): StubSprite;
    readonly SizeMode: Readonly<{ readonly CUSTOM: number }>;
  };
  readonly SpriteFrame: new (
    width?: number,
    height?: number,
    label?: string,
  ) => StubSpriteFrame;
  readonly UIOpacity: new () => StubOpacity;
  readonly UITransform: new () => StubTransform;
  readonly createdNodes: StubNode[];
  failNextComponentConstruction(name: string): void;
  failNextNodeConstruction(name: string): void;
  resetCreatedObjects(): void;
}

interface StubNode {
  active: boolean;
  children: StubNode[];
  readonly components: Map<unknown, unknown>;
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
  getComponent<T>(Type: new () => T): T | null;
  setParent(parent: StubNode | null): void;
}

interface StubSprite {
  sizeMode: number;
  spriteFrame: StubSpriteFrame | null;
}

interface StubSpriteFrame {
  destroyed: boolean;
  readonly label: string;
  readonly originalSize: Readonly<{
    readonly height: number;
    readonly width: number;
  }>;
  readonly rect: Readonly<{
    readonly height: number;
    readonly width: number;
  }>;
  destroy(): void;
}

interface StubOpacity {
  opacity: number;
}

interface StubTransform {
  readonly anchorPoint: Readonly<{
    readonly x: number;
    readonly y: number;
  }>;
  readonly contentSize: Readonly<{
    readonly height: number;
    readonly width: number;
  }>;
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

const VALID_SEGMENT = Object.freeze({
  current: Object.freeze({ x: 100, y: 200 }),
  previous: Object.freeze({ x: 90, y: 180 }),
  slot: 0,
  touchId: 42,
});

test('construction accepts only the exact ordered resource closure for each Basic ID and asset tree', () => {
  cc.resetCreatedObjects();

  for (const assetTree of ['480x800', '720x1280'] as const) {
    for (let bladeId = 0; bladeId <= 12; bladeId += 1) {
      const random = new ScriptedRandom([]);
      const resources = loadedParticleResources(bladeId, assetTree);
      const presenter = StandardBladeParticlePresenter.create(
        particleInput(bladeId, assetTree, random, resources),
      );

      assert.equal(presenter.particles.length, 0);
      assert.equal(Object.isFrozen(presenter.particles), true);
      assert.equal(random.intCalls.length, 0);
      assert.equal(random.decileCalls.length, 0);
      assert.equal(presenter.dispose(), true);
      assert.equal(presenter.dispose(), false);
    }
  }

  assert.equal(cc.createdNodes.length, 0);
});

test('construction rejects incomplete, reordered, mismatched, or invalid loaded resources without allocating nodes', () => {
  cc.resetCreatedObjects();
  const random = new ScriptedRandom([]);
  const resources = loadedParticleResources(8, '480x800');
  const valid = particleInput(8, '480x800', random, resources);

  assert.doesNotThrow(() => (
    StandardBladeParticlePresenter.create(valid).dispose()
  ));
  assert.throws(
    () => StandardBladeParticlePresenter.create({
      ...valid,
      resources: {} as never,
    }),
    /resources do not match the selected blade/,
  );
  assert.throws(
    () => StandardBladeParticlePresenter.create({
      ...valid,
      resources: resources.slice(0, -1),
    }),
    /resources do not match the selected blade/,
  );
  assert.throws(
    () => StandardBladeParticlePresenter.create({
      ...valid,
      resources: [...resources, requireRaster(resources[0])],
    }),
    /resources do not match the selected blade/,
  );

  const reordered = [...resources];
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  assert.throws(
    () => StandardBladeParticlePresenter.create({
      ...valid,
      resources: reordered,
    }),
    /resource 0 must match 480x800\/Blades\/Particles\/Ice\/snowflake\.png/,
  );

  const wrongPath = replaceRaster(resources, 0, {
    canonicalPath: '480x800/Blades/Particles/Ice/not-snowflake.png',
  });
  assert.throws(
    () => StandardBladeParticlePresenter.create({
      ...valid,
      resources: wrongPath,
    }),
    /resource 0 must match 480x800\/Blades\/Particles\/Ice\/snowflake\.png/,
  );

  const first = requireRaster(resources[0]);
  const wrongWidth = replaceRaster(resources, 0, {
    dimensions: Object.freeze({
      height: first.dimensions.height,
      width: first.dimensions.width + 1,
    }),
  });
  assert.throws(
    () => StandardBladeParticlePresenter.create({
      ...valid,
      resources: wrongWidth,
    }),
    /resource 0 must match/,
  );

  const wrongHeight = replaceRaster(resources, 0, {
    dimensions: Object.freeze({
      height: first.dimensions.height + 1,
      width: first.dimensions.width,
    }),
  });
  assert.throws(
    () => StandardBladeParticlePresenter.create({
      ...valid,
      resources: wrongHeight,
    }),
    /resource 0 must match/,
  );

  const destroyedFrame = new cc.SpriteFrame(
    first.dimensions.width,
    first.dimensions.height,
    first.canonicalPath,
  );
  destroyedFrame.destroy();
  const invalidFrame = replaceRaster(resources, 0, {
    spriteFrame: destroyedFrame,
  });
  assert.throws(
    () => StandardBladeParticlePresenter.create({
      ...valid,
      resources: invalidFrame,
    }),
    /resource 0 must match/,
  );
  assert.throws(
    () => StandardBladeParticlePresenter.create({
      ...valid,
      resources: replaceRaster(resources, 0, {
        spriteFrame: null as never,
      }),
    }),
    /resource 0 must match/,
  );
  assert.throws(
    () => StandardBladeParticlePresenter.create({
      ...valid,
      resources: loadedParticleResources(8, '720x1280'),
    }),
    /resource 0 must match 480x800/,
  );
  assert.throws(
    () => StandardBladeParticlePresenter.create({
      ...valid,
      resources: loadedParticleResources(9, '480x800'),
    }),
    /resources do not match the selected blade/,
  );
  assert.throws(
    () => StandardBladeParticlePresenter.create({
      ...valid,
      assetTree: 'phone' as never,
    }),
    /assetTree must be 480x800 or 720x1280/,
  );
  assert.throws(
    () => StandardBladeParticlePresenter.create({
      ...valid,
      selectedBladeId: 13 as never,
    }),
    /BasicBlade ID must be from 0 through 12/,
  );

  assert.equal(cc.createdNodes.length, 0);
});

test('attachment is single-owner, emits nothing, exposes no touch-began hook, and fails closed if its parent expires', () => {
  cc.resetCreatedObjects();
  const random = new ScriptedRandom([]);
  const presenter = createPresenter(7, '480x800', random);

  assert.equal('presentBeganSegment' in presenter, false);
  assert.equal('presentTouchBegan' in presenter, false);
  const source = readFileSync(
    `${REPOSITORY_ROOT}game/assets/scripts/creator/standard-blade-particle-presenter.ts`,
    'utf8',
  );
  assert.doesNotMatch(source, /presentBeganSegment|presentTouchBegan/);
  assert.throws(
    () => presenter.presentMovedSegment(VALID_SEGMENT),
    /must be attached before they can present a moved segment/,
  );
  assert.throws(
    () => presenter.update(0),
    /must be attached before they can update/,
  );

  const destroyedParent = new cc.Node('DestroyedParent');
  destroyedParent.destroy();
  assert.throws(
    () => presenter.attach(destroyedParent as never),
    /parent must be valid/,
  );

  const parent = new cc.Node('ParticleParent');
  parent.layer = 31;
  const nodesBeforeAttach = cc.createdNodes.length;
  presenter.attach(parent as never);
  presenter.update(0);
  assert.equal(cc.createdNodes.length, nodesBeforeAttach);
  assert.equal(parent.children.length, 0);
  assert.equal(presenter.particles.length, 0);
  assert.equal(random.intCalls.length, 0);
  assert.equal(random.decileCalls.length, 0);
  assert.throws(
    () => presenter.attach(new cc.Node('SecondParent') as never),
    /already attached/,
  );

  parent.destroy();
  assert.throws(
    () => presenter.presentMovedSegment(VALID_SEGMENT),
    /must be attached before they can present a moved segment/,
  );
  assert.throws(
    () => presenter.update(0),
    /must be attached before they can update/,
  );
  assert.equal(random.intCalls.length, 0);
  assert.equal(presenter.dispose(), true);

  const inactiveParent = new cc.Node('InactiveButValid');
  inactiveParent.active = false;
  const inactivePresenter = createPresenter(
    7,
    '480x800',
    new ScriptedRandom([]),
  );
  assert.doesNotThrow(() => inactivePresenter.attach(inactiveParent as never));
  assert.equal(inactivePresenter.dispose(), true);
});

test('a moved ID 7 segment creates the exact raster node and advances scale, fade, rotation, and translation', () => {
  cc.resetCreatedObjects();
  const random = new ScriptedRandom([0, 50, 1, 100, -1, 50]);
  const resources = loadedParticleResources(7, '480x800');
  const presenter = StandardBladeParticlePresenter.create(
    particleInput(7, '480x800', random, resources),
  );
  const parent = new cc.Node('ParticleParent');
  parent.layer = 17;
  presenter.attach(parent as never);

  presenter.presentMovedSegment(VALID_SEGMENT);

  assert.equal(presenter.particles.length, 1);
  const particle = presenter.particles[0];
  assert.ok(particle);
  const node = particle.node as unknown as StubNode;
  const spriteNode = particle.spriteNode as unknown as StubNode;
  assert.equal(node.name, 'StandardBladeParticle-0');
  assert.equal(node.parent, parent);
  assert.equal(node.active, true);
  assert.equal(node.layer, 17);
  assert.equal(node.lastRequestedSiblingIndex, STANDARD_BLADE_PARTICLE_Z_ORDER);
  assert.deepEqual(node.position, { x: 100, y: 200, z: 0 });
  assert.equal(spriteNode.name, 'StandardBladeParticleSprite');
  assert.equal(spriteNode.parent, node);
  assert.equal(spriteNode.layer, 17);
  assert.deepEqual(spriteNode.position, { x: 0, y: 0, z: 0 });
  assert.deepEqual(spriteNode.scale, { x: 1, y: 1, z: 1 });
  assert.deepEqual(spriteNode.rotation, { x: 0, y: 0, z: 0 });
  assert.equal(particle.sprite.sizeMode, cc.Sprite.SizeMode.CUSTOM);
  assert.equal(particle.sprite.spriteFrame, requireRaster(resources[0]).spriteFrame);
  assert.deepEqual(particle.transform.contentSize, { width: 54, height: 52 });
  assert.deepEqual(particle.transform.anchorPoint, { x: 0.5, y: 0.5 });
  assert.equal(particle.opacity.opacity, 255);
  assert.deepEqual(particle.command.delta, { x: 100, y: -50 });
  assert.equal(particle.command.fadeOutEnabled, true);
  assert.equal(particle.command.scaleOutEnabled, true);
  assert.equal(particle.command.rotationEnabled, true);
  assert.equal(Object.isFrozen(particle.command), true);

  presenter.update(0.25);
  assert.deepEqual(node.position, { x: 150, y: 175, z: 0 });
  assert.deepEqual(spriteNode.scale, { x: 0.5, y: 0.5, z: 1 });
  assert.deepEqual(spriteNode.rotation, { x: 0.5, y: 0.5, z: 0 });
  assert.equal(particle.opacity.opacity, 127.5);
  assert.equal(node.destroyed, false);

  presenter.update(0.25);
  assert.deepEqual(node.position, { x: 200, y: 150, z: 0 });
  assert.deepEqual(spriteNode.scale, { x: 0, y: 0, z: 1 });
  assert.deepEqual(spriteNode.rotation, { x: 1, y: 1, z: 0 });
  assert.equal(particle.opacity.opacity, 0);
  assert.equal(node.destroyed, true);
  assert.equal(node.destroyCalls, 1);
  assert.equal(presenter.particles.length, 0);
  assert.equal(parent.children.length, 0);
});

test('the fire-circle branch performs translation and fade only', () => {
  cc.resetCreatedObjects();
  const random = new ScriptedRandom([0, 0, 100, 48, 48]);
  const resources = loadedParticleResources(11, '480x800');
  const presenter = StandardBladeParticlePresenter.create(
    particleInput(11, '480x800', random, resources),
  );
  const parent = new cc.Node('ParticleParent');
  presenter.attach(parent as never);
  presenter.presentMovedSegment(VALID_SEGMENT);

  const particle = presenter.particles[0];
  assert.ok(particle);
  const node = particle.node as unknown as StubNode;
  const spriteNode = particle.spriteNode as unknown as StubNode;
  assert.equal(particle.command.logicalPath, 'Blades/Particles/Fire/firecircle.png');
  assert.equal(particle.command.fadeOutEnabled, true);
  assert.equal(particle.command.scaleOutEnabled, false);
  assert.equal(particle.command.rotationEnabled, false);
  assert.equal(particle.sprite.spriteFrame, requireRaster(resources[0]).spriteFrame);
  assert.deepEqual(particle.transform.contentSize, { width: 9, height: 9 });

  presenter.update(0.5);
  assert.deepEqual(node.position, { x: 124, y: 224, z: 0 });
  assert.deepEqual(spriteNode.scale, { x: 1, y: 1, z: 1 });
  assert.deepEqual(spriteNode.rotation, { x: 0, y: 0, z: 0 });
  assert.equal(particle.opacity.opacity, 127.5);

  presenter.update(0.5);
  assert.equal(node.destroyed, true);
  assert.equal(presenter.particles.length, 0);
});

test('the smoke branch creates three independent nodes that advance and retire on their own lifetimes', () => {
  cc.resetCreatedObjects();
  const random = new ScriptedRandom([
    0, 2,
    25, 10, 20,
    50, 20, 40,
    100, 30, 60,
  ]);
  const resources = loadedParticleResources(11, '480x800');
  const presenter = StandardBladeParticlePresenter.create(
    particleInput(11, '480x800', random, resources),
  );
  const parent = new cc.Node('ParticleParent');
  parent.layer = 9;
  presenter.attach(parent as never);
  presenter.presentMovedSegment(VALID_SEGMENT);

  const smoke = [...presenter.particles];
  assert.equal(smoke.length, 3);
  assert.deepEqual(
    smoke.map(({ node }) => node.name),
    [
      'StandardBladeParticle-0',
      'StandardBladeParticle-1',
      'StandardBladeParticle-2',
    ],
  );
  assert.equal(new Set(smoke.map(({ node }) => node)).size, 3);
  assert.equal(new Set(smoke.map(({ opacity }) => opacity)).size, 3);
  assert.equal(new Set(smoke.map(({ spriteNode }) => spriteNode)).size, 3);
  assert.deepEqual(
    smoke.map(({ command }) => command.lifetimeSeconds),
    [Math.fround(0.25), Math.fround(0.5), Math.fround(1)],
  );
  for (const particle of smoke) {
    assert.equal(particle.command.logicalPath, 'Blades/Particles/Fire/smoke.png');
    assert.equal(particle.command.fadeOutEnabled, true);
    assert.equal(particle.command.scaleOutEnabled, false);
    assert.equal(particle.command.rotationEnabled, false);
    assert.equal(
      particle.sprite.spriteFrame,
      requireRaster(resources[2]).spriteFrame,
    );
    assert.equal(
      (particle.node as unknown as StubNode).lastRequestedSiblingIndex,
      STANDARD_BLADE_PARTICLE_Z_ORDER,
    );
  }

  presenter.update(0.25);
  assert.equal((smoke[0]?.node as unknown as StubNode).destroyed, true);
  assert.equal((smoke[1]?.node as unknown as StubNode).destroyed, false);
  assert.equal((smoke[2]?.node as unknown as StubNode).destroyed, false);
  assert.deepEqual(
    (smoke[1]?.node as unknown as StubNode).position,
    { x: 110, y: 220, z: 0 },
  );
  assert.deepEqual(
    (smoke[2]?.node as unknown as StubNode).position,
    { x: 107.5, y: 215, z: 0 },
  );
  assert.equal(smoke[1]?.opacity.opacity, 127.5);
  assert.equal(smoke[2]?.opacity.opacity, 191.25);
  assert.deepEqual(presenter.particles, [smoke[1], smoke[2]]);

  presenter.update(0.25);
  assert.equal((smoke[1]?.node as unknown as StubNode).destroyed, true);
  assert.equal((smoke[2]?.node as unknown as StubNode).destroyed, false);
  assert.deepEqual(
    (smoke[2]?.node as unknown as StubNode).position,
    { x: 115, y: 230, z: 0 },
  );
  assert.equal(smoke[2]?.opacity.opacity, 127.5);
  assert.deepEqual(presenter.particles, [smoke[2]]);

  presenter.update(0.5);
  assert.equal((smoke[2]?.node as unknown as StubNode).destroyed, true);
  assert.equal(presenter.particles.length, 0);
  assert.equal(parent.children.length, 0);
});

test('smoke draws and attachment interleave so a second allocation failure consumes no third-smoke RNG', () => {
  cc.resetCreatedObjects();
  const random = new ScriptedRandom([
    0, 2,
    25, 10, 20,
    50, 20, 40,
    100, 30, 60,
  ]);
  const presenter = createPresenter(11, '480x800', random);
  const parent = new cc.Node('ParticleParent');
  presenter.attach(parent as never);
  cc.failNextNodeConstruction('StandardBladeParticle-1');

  assert.throws(
    () => presenter.presentMovedSegment(VALID_SEGMENT),
    /Injected node construction failure: StandardBladeParticle-1/,
  );
  assert.equal(random.intCalls.length, 8);
  assert.equal(random.decileCalls.length, 0);
  assert.equal(presenter.particles.length, 0);
  assert.equal(parent.children.length, 0);
  const firstSmoke = cc.createdNodes.find(
    ({ name }) => name === 'StandardBladeParticle-0',
  );
  assert.ok(firstSmoke);
  assert.equal(firstSmoke.destroyed, true);
  assert.equal(firstSmoke.destroyCalls, 1);
});

test('particle construction destroys its attached sprite child when a component fails', () => {
  cc.resetCreatedObjects();
  const presenter = createPresenter(
    7,
    '480x800',
    new ScriptedRandom([0, 50, 1, 100, -1, 50]),
  );
  const parent = new cc.Node('ParticleParent');
  presenter.attach(parent as never);
  cc.failNextComponentConstruction('UIOpacity');

  assert.throws(
    () => presenter.presentMovedSegment(VALID_SEGMENT),
    /Injected component construction failure: UIOpacity/,
  );
  assert.equal(presenter.particles.length, 0);
  assert.equal(parent.children.length, 0);
  const outer = cc.createdNodes.find(
    ({ name }) => name === 'StandardBladeParticle-0',
  );
  const sprite = cc.createdNodes.find(
    ({ name }) => name === 'StandardBladeParticleSprite',
  );
  assert.ok(outer);
  assert.ok(sprite);
  assert.equal(outer.destroyed, true);
  assert.equal(outer.destroyCalls, 1);
  assert.equal(sprite.destroyed, true);
  assert.equal(sprite.destroyCalls, 1);
  assert.equal(sprite.parent, null);
});

test('IDs 0 through 6 consume no random values and emit no nodes for moved segments', () => {
  for (let bladeId = 0; bladeId <= 6; bladeId += 1) {
    cc.resetCreatedObjects();
    const random = new ScriptedRandom([]);
    const presenter = createPresenter(bladeId, '720x1280', random);
    const parent = new cc.Node(`Parent-${bladeId}`);
    presenter.attach(parent as never);

    assert.doesNotThrow(() => presenter.presentMovedSegment(VALID_SEGMENT));
    assert.doesNotThrow(() => presenter.update(60));
    assert.equal(presenter.particles.length, 0);
    assert.equal(parent.children.length, 0);
    assert.equal(cc.createdNodes.length, 1);
    assert.equal(random.intCalls.length, 0);
    assert.equal(random.decileCalls.length, 0);
    assert.equal(presenter.dispose(), true);
  }
});

test('invalid segments and random output fail before any particle node is created', () => {
  cc.resetCreatedObjects();
  const segmentRandom = new ScriptedRandom([]);
  const presenter = createPresenter(7, '480x800', segmentRandom);
  const parent = new cc.Node('ParticleParent');
  presenter.attach(parent as never);
  const invalidSegments = [
    null,
    { ...VALID_SEGMENT, current: { x: Number.NaN, y: 1 } },
    { ...VALID_SEGMENT, current: { x: 1, y: Number.POSITIVE_INFINITY } },
    { ...VALID_SEGMENT, previous: { x: Number.NEGATIVE_INFINITY, y: 1 } },
    { ...VALID_SEGMENT, previous: { x: 1, y: Number.NaN } },
    { ...VALID_SEGMENT, slot: -1 },
    { ...VALID_SEGMENT, slot: 4 },
    { ...VALID_SEGMENT, slot: 1.5 },
    { ...VALID_SEGMENT, touchId: -1 },
    { ...VALID_SEGMENT, touchId: 1.5 },
  ];
  for (const segment of invalidSegments) {
    assert.throws(
      () => presenter.presentMovedSegment(segment as never),
      /segment is invalid/,
    );
  }
  assert.equal(segmentRandom.intCalls.length, 0);
  assert.equal(segmentRandom.decileCalls.length, 0);
  assert.equal(parent.children.length, 0);
  assert.equal(presenter.particles.length, 0);

  const fractionalRandom = new ScriptedRandom([0.5]);
  const fractional = createPresenter(7, '480x800', fractionalRandom);
  const fractionalParent = new cc.Node('FractionalParent');
  fractional.attach(fractionalParent as never);
  assert.throws(
    () => fractional.presentMovedSegment(VALID_SEGMENT),
    /must return a safe integer/,
  );
  assert.equal(fractionalParent.children.length, 0);
  assert.equal(fractional.particles.length, 0);

  const outOfRangeRandom = new ScriptedRandom([6]);
  const outOfRange = createPresenter(7, '480x800', outOfRangeRandom);
  const outOfRangeParent = new cc.Node('OutOfRangeParent');
  outOfRange.attach(outOfRangeParent as never);
  assert.throws(
    () => outOfRange.presentMovedSegment(VALID_SEGMENT),
    /returned 6/,
  );
  assert.equal(outOfRangeParent.children.length, 0);
  assert.equal(outOfRange.particles.length, 0);

  const invalidDecileRandom = new ScriptedRandom(
    [0, 1, 25, 0, 24],
    [Number.POSITIVE_INFINITY],
  );
  const invalidDecile = createPresenter(11, '480x800', invalidDecileRandom);
  const invalidDecileParent = new cc.Node('InvalidDecileParent');
  invalidDecile.attach(invalidDecileParent as never);
  assert.throws(
    () => invalidDecile.presentMovedSegment(VALID_SEGMENT),
    /nextDecile\(\) must return a finite number/,
  );
  assert.equal(invalidDecileParent.children.length, 0);
  assert.equal(invalidDecile.particles.length, 0);
});

test('invalid random interfaces and viewport widths reject during construction', () => {
  cc.resetCreatedObjects();
  const resources = loadedParticleResources(7, '480x800');
  const valid = particleInput(
    7,
    '480x800',
    new ScriptedRandom([]),
    resources,
  );

  for (const random of [
    null,
    {},
    { nextIntInclusive() { return 0; } },
    { nextDecile() { return 0; } },
  ]) {
    assert.throws(
      () => StandardBladeParticlePresenter.create({
        ...valid,
        random: random as never,
      }),
      /random must provide nextIntInclusive\(\) and nextDecile\(\)/,
    );
  }
  for (const viewportWidth of [
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    assert.throws(
      () => StandardBladeParticlePresenter.create({
        ...valid,
        viewportWidth,
      }),
      /viewportWidth must be positive and finite/,
    );
  }

  assert.equal(cc.createdNodes.length, 0);
});

test('delta validation preserves active state and disposal is destructive, guarded, and idempotent', () => {
  cc.resetCreatedObjects();
  const presenter = createPresenter(
    7,
    '480x800',
    new ScriptedRandom([0, 50, 1, 100, -1, 50]),
  );
  const parent = new cc.Node('ParticleParent');
  presenter.attach(parent as never);
  presenter.presentMovedSegment(VALID_SEGMENT);
  const particle = presenter.particles[0];
  assert.ok(particle);
  const node = particle.node as unknown as StubNode;
  const spriteNode = particle.spriteNode as unknown as StubNode;

  for (const deltaSeconds of [
    -1,
    Number.NaN,
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ]) {
    assert.throws(
      () => presenter.update(deltaSeconds),
      /deltaSeconds must be non-negative and finite/,
    );
  }
  assert.deepEqual(node.position, { x: 100, y: 200, z: 0 });
  assert.deepEqual(spriteNode.scale, { x: 1, y: 1, z: 1 });
  assert.equal(particle.opacity.opacity, 255);
  assert.equal(node.destroyed, false);

  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
  assert.equal(node.destroyed, true);
  assert.equal(node.destroyCalls, 1);
  assert.equal(spriteNode.destroyed, true);
  assert.equal(spriteNode.destroyCalls, 1);
  assert.equal(parent.destroyed, false);
  assert.equal(parent.children.length, 0);
  assert.equal(presenter.particles.length, 0);
  assert.throws(
    () => presenter.attach(parent as never),
    /Disposed standard blade particles cannot be attached/,
  );
  assert.throws(
    () => presenter.presentMovedSegment(VALID_SEGMENT),
    /Disposed standard blade particles cannot present a moved segment/,
  );
  assert.throws(
    () => presenter.update(0),
    /Disposed standard blade particles cannot update/,
  );
});

function createPresenter(
  bladeId: number,
  assetTree: AssetTree,
  random: ScriptedRandom,
) {
  return StandardBladeParticlePresenter.create(
    particleInput(
      bladeId,
      assetTree,
      random,
      loadedParticleResources(bladeId, assetTree),
    ),
  );
}

function particleInput(
  bladeId: number,
  assetTree: AssetTree,
  random: ScriptedRandom,
  resources: readonly LoadedRaster[],
) {
  return {
    assetTree,
    random,
    resources: resources as never,
    selectedBladeId: bladeId as never,
    viewportWidth: assetTree === '480x800' ? 480 : 720,
  };
}

function loadedParticleResources(
  bladeId: number,
  assetTree: AssetTree,
): readonly LoadedRaster[] {
  return Object.freeze(
    getStandardBladeParticleResources(bladeId, assetTree).map(
      (contract: RasterContract) => Object.freeze({
        canonicalPath: contract.canonicalPath,
        dimensions: Object.freeze({
          height: contract.dimensions.height,
          width: contract.dimensions.width,
        }),
        spriteFrame: new cc.SpriteFrame(
          contract.dimensions.width,
          contract.dimensions.height,
          contract.canonicalPath,
        ),
      }),
    ),
  );
}

function replaceRaster(
  resources: readonly LoadedRaster[],
  index: number,
  replacement: Partial<LoadedRaster>,
): readonly LoadedRaster[] {
  const result = [...resources];
  result[index] = Object.freeze({
    ...requireRaster(resources[index]),
    ...replacement,
  });
  return Object.freeze(result);
}

function requireRaster(value: LoadedRaster | undefined): LoadedRaster {
  assert.ok(value);
  return value;
}
