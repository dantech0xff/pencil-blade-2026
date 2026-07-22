import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  getClassicResultResources,
  type ClassicRasterResource,
} from '../../../game/assets/scripts/domain/classic-resource-contract.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const createdNodes = [];
export function resetCreatedNodes() { createdNodes.length = 0; }

export class Color {
  constructor(r = 0, g = 0, b = 0, a = 255) {
    this.r = r; this.g = g; this.b = b; this.a = a;
  }
}

export class Size {
  constructor(width = 0, height = 0) { this.width = width; this.height = height; }
}

export class SpriteFrame {
  constructor(width, height) {
    this.destroyed = false;
    this.originalSize = new Size(width, height);
    this.rect = { width, height };
  }
}

export class UITransform {
  constructor() {
    this.anchorPoint = { x: 0, y: 0 };
    this.contentSize = new Size();
  }
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
  setContentSize(width, height) { this.contentSize = new Size(width, height); }
}

export class Sprite {
  constructor() {
    this.color = new Color(255, 255, 255, 255);
    this.sizeMode = 0;
    this.spriteFrame = null;
  }
}
Sprite.SizeMode = Object.freeze({ CUSTOM: 2 });

export class Node {
  constructor(name = '') {
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyed = false;
    this.eulerAngles = { x: 0, y: 0, z: 0 };
    this.lastRequestedSiblingIndex = null;
    this.layer = 0;
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
  setParent(parent, keepWorldTransform = false) {
    const world = this.worldPosition;
    if (this.parent !== null) {
      const previousIndex = this.parent.children.indexOf(this);
      if (previousIndex >= 0) this.parent.children.splice(previousIndex, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
    if (keepWorldTransform) {
      const parentWorld = parent === null ? { x: 0, y: 0, z: 0 } : parent.worldPosition;
      this.position = {
        x: world.x - parentWorld.x,
        y: world.y - parentWorld.y,
        z: world.z - parentWorld.z,
      };
    }
  }
  setPosition(x, y, z) { this.position = { x, y, z }; }
  setRotationFromEuler(x, y, z) { this.eulerAngles = { x, y, z }; }
  setScale(x, y, z) { this.scale = { x, y, z }; }
  setSiblingIndex(index) {
    this.lastRequestedSiblingIndex = index;
    if (this.parent === null) return;
    const siblings = this.parent.children;
    const previousIndex = siblings.indexOf(this);
    if (previousIndex >= 0) siblings.splice(previousIndex, 1);
    siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, this);
  }
  destroy() {
    if (this.destroyed) return;
    for (const child of [...this.children]) child.destroy();
    this.destroyed = true;
    this.active = false;
    this.setParent(null, true);
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
  ClassicResultParticleExplosionPresenter,
} = await import(
  '../../../game/assets/scripts/creator/classic-result-particle-explosion-presenter.ts'
);

type AssetTree = '480x800' | '720x1280';

interface CocosStub {
  readonly Node: new (name?: string) => StubNode;
  readonly SpriteFrame: new (width: number, height: number) => StubSpriteFrame;
  readonly UITransform: new () => StubTransform;
  readonly createdNodes: StubNode[];
  readonly isValid: (value: unknown) => boolean;
  readonly resetCreatedNodes: () => void;
}

interface StubColor {
  readonly a: number;
  readonly b: number;
  readonly g: number;
  readonly r: number;
}

interface StubNode {
  active: boolean;
  readonly activeInHierarchy: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  readonly eulerAngles: Readonly<{ x: number; y: number; z: number }>;
  lastRequestedSiblingIndex: number | null;
  layer: number;
  readonly name: string;
  readonly parent: StubNode | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly scale: Readonly<{ x: number; y: number; z: number }>;
  readonly worldPosition: Readonly<{ x: number; y: number; z: number }>;
  destroy(): void;
  getComponent<T>(Type: new () => T): T | null;
  setParent(parent: StubNode | null, keepWorldTransform?: boolean): void;
  setPosition(x: number, y: number, z: number): void;
}

interface StubSpriteFrame {
  destroyed: boolean;
  readonly originalSize: Readonly<{ height: number; width: number }>;
  rect: Readonly<{ height: number; width: number }>;
}

interface StubTransform {
  readonly anchorPoint: Readonly<{ x: number; y: number }>;
  readonly contentSize: Readonly<{ height: number; width: number }>;
}

interface LoadedRaster extends ClassicRasterResource {
  readonly spriteFrame: StubSpriteFrame;
}

interface InclusiveCall {
  readonly maximumInclusive: number;
  readonly minimumInclusive: number;
}

class ScriptedRandom {
  readonly calls: InclusiveCall[] = [];
  private readonly draws: readonly number[];
  private offset = 0;

  constructor(draws: readonly number[]) {
    this.draws = draws;
  }

  nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number {
    this.calls.push({ maximumInclusive, minimumInclusive });
    const draw = this.draws[this.offset];
    if (draw === undefined) {
      throw new Error(`scripted random exhausted at draw ${this.offset}`);
    }
    this.offset += 1;
    return draw;
  }

  get drawCount(): number {
    return this.offset;
  }
}

test('both exact textures create a delayed emitter at recovered world position with no draw', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    cc.resetCreatedNodes();
    const resource = loadedBonusParticle(assetTree);
    const viewport = assetTree === '480x800'
      ? { width: 480, height: 800 }
      : { width: 720, height: 1280 };
    const random = randomForParticles(viewport.width);
    const presenter = ClassicResultParticleExplosionPresenter.create({
      random,
      resource: resource as never,
      viewport,
    });

    assert.equal(random.drawCount, 0);
    assert.deepEqual(cc.createdNodes.map(({ name }) => name), [
      'ClassicResultParticleExplosion',
    ]);
    assert.equal(presenter.node.active, false);
    assert.deepEqual(vector3(presenter.node.position), {
      x: viewport.width * 0.75,
      y: viewport.height * 0.2,
      z: 0,
    });
    assert.deepEqual(presenter.state, {
      attached: false,
      burstStarted: false,
      completedParticleCount: 0,
      disposed: false,
      elapsedActionSeconds: 0,
      particleCount: 0,
    });
    assert.deepEqual(presenter.particles, []);
    assert.equal(Object.isFrozen(presenter.particles), true);

    const parent = new cc.Node('OffsetResultParent');
    parent.layer = 27;
    parent.setPosition(100, 200, 0);
    const earlier = new cc.Node('Earlier');
    earlier.setParent(parent);
    const totalCoinsPanel = new cc.Node('TotalCoinsPanel');
    totalCoinsPanel.setParent(parent);
    const oldTotalLabel = new cc.Node('OldTotalLabel');
    oldTotalLabel.setParent(parent);
    const later = new cc.Node('Later');
    later.setParent(parent);

    presenter.attachBetween(
      parent as never,
      totalCoinsPanel as never,
      oldTotalLabel as never,
    );

    assert.deepEqual(parent.children.map(({ name }) => name), [
      'Earlier',
      'TotalCoinsPanel',
      'ClassicResultParticleExplosion',
      'OldTotalLabel',
      'Later',
    ]);
    assert.equal(presenter.node.lastRequestedSiblingIndex, 2);
    assert.equal(presenter.node.layer, 27);
    assert.deepEqual(vector3(presenter.node.worldPosition), {
      x: viewport.width * 0.75,
      y: viewport.height * 0.2,
      z: 0,
    });
    assert.equal(presenter.node.active, true);
    assert.equal(presenter.isAttached, true);
    assert.equal(random.drawCount, 0);
  }
});

test('burst boundary synchronously creates 100 exact sprites in draw and child order', () => {
  cc.resetCreatedNodes();
  const random = randomForParticles();
  const resource = loadedBonusParticle('480x800');
  const presenter = ClassicResultParticleExplosionPresenter.create({
    random,
    resource: resource as never,
    viewport: { width: 480, height: 800 },
  });
  presenter.attach(new cc.Node('Parent') as never);

  presenter.updateAction(1);
  assert.equal(random.drawCount, 0);
  assert.equal(presenter.particles.length, 0);
  presenter.updateAction(0.65);

  assert.equal(random.drawCount, 500);
  assert.equal(random.calls.length, 500);
  assert.equal(presenter.state.burstStarted, true);
  assert.equal(presenter.state.particleCount, 100);
  assert.equal(presenter.node.children.length, 100);
  assert.deepEqual(
    presenter.node.children.map(({ name }) => name),
    Array.from({ length: 100 }, (_, index) => `ClassicResultParticle-${index + 1}`),
  );
  assert.deepEqual(
    presenter.particles.map(({ plan }) => plan.index),
    Array.from({ length: 100 }, (_, index) => index),
  );

  for (let index = 0; index < presenter.particles.length; index += 1) {
    const particle = presenter.particles[index];
    assert.equal(particle.node, presenter.node.children[index]);
    assert.equal(particle.node.active, true);
    assert.equal(particle.node.layer, presenter.node.layer);
    assert.equal(particle.node.lastRequestedSiblingIndex, index);
    assert.deepEqual(vector3(particle.node.position), { x: 0, y: 0, z: 0 });
    assert.deepEqual(vector3(particle.node.scale), { x: 1, y: 1, z: 1 });
    assert.deepEqual(vector3(particle.node.eulerAngles), { x: 0, y: 0, z: 0 });
    assert.equal(particle.sprite.sizeMode, 2);
    assert.equal(particle.sprite.spriteFrame, resource.spriteFrame);
    assert.deepEqual(size(particle.transform.contentSize), resource.dimensions);
    assert.deepEqual(point(particle.transform.anchorPoint), { x: 0.5, y: 0.5 });
    assert.deepEqual(color(particle.sprite.color as unknown as StubColor), {
      r: 255,
      g: 255,
      b: 255,
      a: 255,
    });
    assert.equal(Object.isFrozen(particle), true);
  }
});

test('all particles move, scale, and rotate linearly and remain at scale zero after completion', () => {
  const random = randomForParticles();
  const presenter = ClassicResultParticleExplosionPresenter.create({
    random,
    resource: loadedBonusParticle('480x800') as never,
    viewport: { width: 480, height: 800 },
  });
  presenter.attach(new cc.Node('Parent') as never);
  presenter.updateAction(1.65);

  presenter.updateAction(1.325);
  const first = presenter.particles[0];
  const second = presenter.particles[1];
  assertVector3Close(first.node.position, { x: -39.75, y: 119.25, z: 0 });
  assertVector3Close(first.node.scale, { x: 0.66875, y: 0.66875, z: 1 });
  assertVector3Close(first.node.eulerAngles, { x: 0, y: 0, z: 0.33125 });
  assertVector3Close(second.node.position, { x: 0, y: -60, z: 0 });
  assertVector3Close(second.node.scale, { x: 0.5, y: 0.5, z: 1 });
  assertVector3Close(second.node.eulerAngles, { x: 0, y: 0, z: 0.5 });
  assert.equal(presenter.state.completedParticleCount, 0);

  presenter.updateAction(1.325);
  assert.deepEqual(vector3(second.node.position), { x: 0, y: -120, z: 0 });
  assert.deepEqual(vector3(second.node.scale), { x: 0, y: 0, z: 1 });
  assert.deepEqual(vector3(second.node.eulerAngles), { x: 0, y: 0, z: 1 });
  assert.equal(second.node.destroyed, false);
  assert.equal(second.node.parent, presenter.node);
  assert.equal(presenter.state.completedParticleCount, 1);

  presenter.updateAction(2.1);
  assert.equal(presenter.state.completedParticleCount, 100);
  assert.equal(presenter.particles.every(({ node }) => node.destroyed === false), true);
  assert.equal(presenter.particles.every(({ node }) => node.scale.x === 0), true);
  assert.equal(presenter.particles.every(({ node }) => node.eulerAngles.z === 1), true);
  assert.equal(presenter.node.children.length, 100);
});

test('the 11.15-second cleanup destroys container and retained children exactly once', () => {
  const random = randomForParticles(720);
  const presenter = ClassicResultParticleExplosionPresenter.create({
    random,
    resource: loadedBonusParticle('720x1280') as never,
    viewport: { width: 720, height: 1280 },
  });
  const parent = new cc.Node('Parent');
  presenter.attach(parent as never);
  presenter.updateAction(1.65);
  const particles = [...presenter.particles];
  presenter.updateAction(9.499);

  assert.equal(presenter.isDisposed, false);
  assert.equal(cc.isValid(presenter.node), true);
  assert.equal(particles.every(({ node }) => cc.isValid(node)), true);
  presenter.updateAction(0.001);

  assert.deepEqual(presenter.state, {
    attached: false,
    burstStarted: true,
    completedParticleCount: 100,
    disposed: true,
    elapsedActionSeconds: 11.15,
    particleCount: 100,
  });
  assert.equal(cc.isValid(presenter.node), false);
  assert.equal(presenter.node.parent, null);
  assert.equal(particles.every(({ node }) => node.destroyed), true);
  assert.equal(particles.every(({ node }) => node.parent === null), true);
  assert.equal(presenter.dispose(), false);
  presenter.updateAction(100);
  assert.equal(random.drawCount, 500);
});

test('one overshooting clock tick preserves burst draws, concurrent endpoints, then cleanup order', () => {
  cc.resetCreatedNodes();
  const random = randomForParticles();
  const presenter = ClassicResultParticleExplosionPresenter.create({
    random,
    resource: loadedBonusParticle('480x800') as never,
    viewport: { width: 480, height: 800 },
  });
  presenter.attach(new cc.Node('Parent') as never);

  presenter.updateAction(100);

  assert.equal(random.drawCount, 500);
  assert.equal(presenter.particles.length, 0);
  assert.equal(
    cc.createdNodes.filter(({ name }) => name.startsWith('ClassicResultParticle-')).length,
    100,
  );
  assert.equal(
    cc.createdNodes
      .filter(({ name }) => name.startsWith('ClassicResultParticle-'))
      .every(({ destroyed }) => destroyed),
    true,
  );
  assert.deepEqual(presenter.state, {
    attached: false,
    burstStarted: true,
    completedParticleCount: 100,
    disposed: true,
    elapsedActionSeconds: 11.15,
    particleCount: 100,
  });
});

test('explicit and parent-led disposal are idempotent before and after the burst', () => {
  for (const elapsed of [0, 1.65]) {
    const presenter = ClassicResultParticleExplosionPresenter.create({
      random: randomForParticles(),
      resource: loadedBonusParticle('480x800') as never,
      viewport: { width: 480, height: 800 },
    });
    const parent = new cc.Node('Parent');
    presenter.attach(parent as never);
    presenter.updateAction(elapsed);

    assert.equal(presenter.dispose(), true);
    assert.equal(presenter.dispose(), false);
    assert.equal(presenter.isAttached, false);
    assert.equal(presenter.isDisposed, true);
    assert.equal(presenter.node.destroyed, true);
    assert.throws(
      () => presenter.attach(new cc.Node('Other') as never),
      /Disposed/,
    );
  }

  const parentLed = ClassicResultParticleExplosionPresenter.create({
    random: randomForParticles(720),
    resource: loadedBonusParticle('720x1280') as never,
    viewport: { width: 720, height: 1280 },
  });
  const parent = new cc.Node('ParentLed');
  parentLed.attach(parent as never);
  parentLed.updateAction(1.65);
  parent.destroy();
  assert.equal(cc.isValid(parentLed.node), false);
  assert.equal(parentLed.dispose(), true);
  assert.equal(parentLed.dispose(), false);
});

test('resource, input, clock, parent, and exact insertion paths reject fail-closed', () => {
  const resource = loadedBonusParticle('480x800');
  const validInput = {
    random: randomForParticles(),
    resource: resource as never,
    viewport: { width: 480, height: 800 },
  };

  cc.resetCreatedNodes();
  assert.throws(
    () => ClassicResultParticleExplosionPresenter.create(null as never),
    /input must be an object/,
  );
  assert.throws(() => ClassicResultParticleExplosionPresenter.create({
    ...validInput,
    random: null,
  } as never), /random must provide/);
  assert.throws(() => ClassicResultParticleExplosionPresenter.create({
    ...validInput,
    viewport: { width: 0, height: 800 },
  } as never), /viewport.width.*positive/);
  assert.throws(() => ClassicResultParticleExplosionPresenter.create({
    ...validInput,
    resource: {
      ...resource,
      canonicalPath: '480x800/Interfaces/wrong.png',
    },
  } as never), /exact recovered result-particle path/);
  assert.throws(() => ClassicResultParticleExplosionPresenter.create({
    ...validInput,
    resource: { ...resource, dimensions: { width: 1, height: 1 } },
  } as never), /dimensions.*exact recovered/);
  const trimmed = loadedBonusParticle('480x800');
  trimmed.spriteFrame.rect = { width: 1, height: 1 };
  assert.throws(() => ClassicResultParticleExplosionPresenter.create({
    ...validInput,
    resource: trimmed,
  } as never), /untrimmed raster geometry/);
  resource.spriteFrame.destroyed = true;
  assert.throws(
    () => ClassicResultParticleExplosionPresenter.create(validInput as never),
    /spriteFrame.*valid/,
  );
  resource.spriteFrame.destroyed = false;
  assert.equal(cc.createdNodes.length, 0);

  const presenter = ClassicResultParticleExplosionPresenter.create(validInput as never);
  assert.throws(() => presenter.updateAction(0), /must be attached/);
  assert.throws(() => presenter.attach(new cc.Node('Parent') as never, -1), /siblingIndex/);
  const inactive = new cc.Node('Inactive');
  inactive.active = false;
  assert.throws(() => presenter.attach(inactive as never), /valid and active/);
  const parent = new cc.Node('Parent');
  const after = new cc.Node('After');
  after.setParent(parent);
  const gap = new cc.Node('Gap');
  gap.setParent(parent);
  const before = new cc.Node('Before');
  before.setParent(parent);
  assert.throws(
    () => presenter.attachBetween(parent as never, after as never, before as never),
    /adjacent/,
  );
  assert.equal(presenter.node.parent, null);
  presenter.attach(parent as never, parent.children.length);
  assert.throws(() => presenter.attach(parent as never), /already attached/);
  assert.throws(() => presenter.updateAction(-1), /finite and non-negative/);
  assert.throws(() => presenter.updateAction(Number.NaN), /finite and non-negative/);
});

test('presenter source contains no fade, audio, random-before-delay, or blend invention', () => {
  const source = readFileSync(
    `${REPOSITORY_ROOT}game/assets/scripts/creator/classic-result-particle-explosion-presenter.ts`,
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /UIOpacity|AudioSource|playOneShot|\btween\(|customMaterial\s*=|blendFactor|additive/i,
  );
  assert.match(
    source,
    /elapsedActionSecondsValue >= this\.plan\.startDelaySeconds[\s\S]*?createClassicResultParticleBurst/,
  );
  assert.match(source, /sprite\.spriteFrame = this\.resource\.spriteFrame/);
  assert.match(source, /setRotationFromEuler\([\s\S]*?FINAL_ROTATION_DEGREES \* progress/);
});

function randomForParticles(width = 480): ScriptedRandom {
  const minimumMagnitude = Math.trunc(width * 0.25);
  const maximumMagnitude = Math.trunc(width * 0.75);
  const middleMagnitude = Math.trunc((minimumMagnitude + maximumMagnitude) / 2);
  const draws: number[] = [];
  for (let index = 0; index < 100; index += 1) {
    if (index === 0) {
      draws.push(400, -1, minimumMagnitude, 1, maximumMagnitude);
    } else if (index === 1) {
      draws.push(265, 0, maximumMagnitude, -1, minimumMagnitude);
    } else {
      draws.push(475, 1, middleMagnitude, 0, middleMagnitude);
    }
  }
  return new ScriptedRandom(draws);
}

function loadedBonusParticle(assetTree: AssetTree): LoadedRaster {
  const resource = getClassicResultResources(assetTree).bonusParticle;
  return {
    ...resource,
    spriteFrame: new cc.SpriteFrame(
      resource.dimensions.width,
      resource.dimensions.height,
    ),
  };
}

function color(value: StubColor): { a: number; b: number; g: number; r: number } {
  return { r: value.r, g: value.g, b: value.b, a: value.a };
}

function point(value: Readonly<{ x: number; y: number }>): { x: number; y: number } {
  return { x: value.x, y: value.y };
}

function size(
  value: Readonly<{ height: number; width: number }>,
): { height: number; width: number } {
  return { width: value.width, height: value.height };
}

function vector3(
  value: Readonly<{ x: number; y: number; z: number }>,
): { x: number; y: number; z: number } {
  return { x: value.x, y: value.y, z: value.z };
}

function assertVector3Close(
  actual: Readonly<{ x: number; y: number; z: number }>,
  expected: Readonly<{ x: number; y: number; z: number }>,
): void {
  for (const axis of ['x', 'y', 'z'] as const) {
    assert.ok(
      Math.abs(actual[axis] - expected[axis]) <= 1e-12,
      `${axis}: expected ${expected[axis]}, received ${actual[axis]}`,
    );
  }
}
