import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
}

export class Size {
  constructor(width = 0, height = 0) { this.width = width; this.height = height; }
}

export class Color {
  constructor(r = 0, g = 0, b = 0, a = 255) {
    this.r = r; this.g = g; this.b = b; this.a = a;
  }
}

export class Font {
  constructor() { this.destroyed = false; }
}

export class SpriteFrame {
  constructor(width, height) {
    this.originalSize = new Size(width, height);
    this.rect = { width, height };
    this.destroyed = false;
  }
}

export class UITransform {
  constructor() {
    this.contentSize = new Size();
    this.anchorPoint = new Vec2();
  }
  setContentSize(width, height) { this.contentSize = new Size(width, height); }
  setAnchorPoint(x, y) { this.anchorPoint = new Vec2(x, y); }
}

export class UIOpacity {
  constructor() { this._opacity = 255; }
  get opacity() { return this._opacity; }
  set opacity(value) {
    if (this.node?.destroyed) {
      throw new TypeError("Cannot read properties of null (reading '_uiProps')");
    }
    this._opacity = value;
  }
}

export class Sprite {
  constructor() { this.sizeMode = 0; this.spriteFrame = null; }
}
Sprite.SizeMode = Object.freeze({ CUSTOM: 2 });

export class Label {
  constructor() {
    this.font = null;
    this.fontSize = 0;
    this.lineHeight = 0;
    this.string = '';
    this.color = new Color();
  }
}

export class RigidBody2D {
  constructor() {
    this.type = 0;
    this.allowSleep = false;
    this.awakeOnLoad = false;
    this.bullet = true;
    this.fixedRotation = true;
    this.gravityScale = 0;
    this.linearDamping = -1;
    this.angularDamping = -1;
    this.linearVelocity = new Vec2();
    this.angularVelocity = 0;
    this.group = 0;
    this.impl = null;
  }
}

export class BoxCollider2D {
  constructor() {
    this.size = new Size();
    this.offset = new Vec2();
    this.density = 0;
    this.friction = 0;
    this.restitution = 0;
    this.sensor = true;
    this.group = 0;
    this.tag = -1;
  }
}

export class Node {
  static createdCount = 0;

  constructor(name = '') {
    Node.createdCount += 1;
    this.name = name;
    this.active = true;
    this.destroyed = false;
    this.layer = 0;
    this.parent = null;
    this.children = [];
    this.position = { x: 0, y: 0, z: 0 };
    this.eulerAngles = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
    this.components = new Map();
    this.lastRequestedSiblingIndex = null;
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
  setPosition(x, y, z) { this.position = { x, y, z }; }
  setWorldPosition(x, y, z) {
    const parent = this.parent === null ? { x: 0, y: 0, z: 0 } : this.parent.worldPosition;
    this.position = { x: x - parent.x, y: y - parent.y, z: z - parent.z };
  }
  setRotationFromEuler(x, y, z) { this.eulerAngles = { x, y, z }; }
  setScale(x, y, z) { this.scale = { x, y, z }; }
  setParent(parent, keepWorldTransform = false) {
    const world = this.worldPosition;
    if (this.parent !== null) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
    if (keepWorldTransform) this.setWorldPosition(world.x, world.y, world.z);
  }
  setSiblingIndex(index) { this.lastRequestedSiblingIndex = index; }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.active = false;
    for (const child of [...this.children]) child.destroy();
    this.setParent(null, true);
  }
}

export const ERigidBody2DType = Object.freeze({ Dynamic: 2 });
export const AssetManager = Object.freeze({ Bundle: class Bundle {} });
export const assetManager = {
  getBundle() { return null; },
  loadBundle(_name, callback) { callback(new Error('not configured'), null); },
};
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
  getCrazySupplementalRasterSet,
} = await import('../../../game/assets/scripts/domain/crazy-resource-contract.ts');
const {
  CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS,
} = await import('../../../game/assets/scripts/domain/crazy-dragon-fruit-state.ts');
const {
  CrazyGeneratedDragonFruit,
  CrazyGeneratedDragonOwnedPresentationDisposalError,
} = await import(
  '../../../game/assets/scripts/creator/crazy-generated-dragon-fruit.ts'
);

type AssetTree = '480x800' | '720x1280';

interface CocosStub {
  readonly Font: new () => StubFont;
  readonly Node: {
    new (name?: string): StubNode;
    createdCount: number;
  };
  readonly SpriteFrame: new (width: number, height: number) => StubSpriteFrame;
}

interface StubFont {
  destroyed: boolean;
}

interface StubNode {
  active: boolean;
  children: StubNode[];
  destroy(): void;
  destroyed: boolean;
  readonly eulerAngles: Readonly<{ x: number; y: number; z: number }>;
  layer: number;
  readonly name: string;
  readonly parent: StubNode | null;
  position: Readonly<{ x: number; y: number; z: number }>;
  readonly scale: Readonly<{ x: number; y: number; z: number }>;
  readonly worldPosition: Readonly<{ x: number; y: number; z: number }>;
  setPosition(x: number, y: number, z: number): void;
}

interface StubSpriteFrame {
  destroyed: boolean;
  readonly originalSize: Readonly<{ height: number; width: number }>;
  readonly rect: Readonly<{ height: number; width: number }>;
}

interface LoadedRaster {
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{ height: number; width: number }>;
  readonly spriteFrame: StubSpriteFrame;
}

interface InclusiveCall {
  readonly maximumInclusive: number;
  readonly minimumInclusive: number;
}

class ScriptedRandom {
  readonly calls: InclusiveCall[] = [];
  private readonly draws: readonly number[];
  private nextDraw = 0;

  constructor(draws: readonly number[]) {
    this.draws = draws;
  }

  nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number {
    this.calls.push({ maximumInclusive, minimumInclusive });
    const value = this.draws[this.nextDraw];
    if (value === undefined) {
      throw new Error('scripted random exhausted');
    }
    this.nextDraw += 1;
    return value;
  }
}

function createResources(assetTree: AssetTree) {
  const contract = getCrazySupplementalRasterSet(assetTree);
  const rasters = [
    contract.dragonFruit,
    contract.dragonSplash,
    contract.dragonCutTopLeft,
    contract.dragonCutTopRight,
    contract.dragonCutBottomRight,
    contract.dragonCutBottomLeft,
  ];
  const loaded = new Map<string, LoadedRaster>(rasters.map((raster) => [
    raster.canonicalPath,
    Object.freeze({
      ...raster,
      spriteFrame: new cc.SpriteFrame(
        raster.dimensions.width,
        raster.dimensions.height,
      ),
    }),
  ]));
  return Object.freeze({
    assetTree,
    rasterCount: 37 as const,
    timeManagerFont: new cc.Font(),
    raster(resource: Readonly<{
      canonicalPath: string;
      dimensions: Readonly<{ height: number; width: number }>;
    }>): LoadedRaster {
      const result = loaded.get(resource.canonicalPath);
      if (result === undefined) {
        throw new Error(`missing ${resource.canonicalPath}`);
      }
      return result;
    },
  });
}

function createFont() {
  return Object.freeze({
    canonicalPath: 'Fonts/Razing.ttf' as const,
    font: new cc.Font(),
  });
}

function createLifecycle(options: {
  effectsEnabled?: boolean;
  throwOnSchedule?: boolean;
} = {}) {
  const callbacks: Array<() => void> = [];
  const events: string[] = [];
  const critical: unknown[] = [];
  let effectsEnabled = options.effectsEnabled ?? true;
  return {
    callbacks,
    critical,
    events,
    lifecycle: {
      callAfterStep(callback: () => void) {
        events.push('defer-dispose');
        if (options.throwOnSchedule === true) {
          throw new Error('schedule failed');
        }
        callbacks.push(callback);
      },
      effectsEnabled() {
        return effectsEnabled;
      },
      onCriticalParticle(event: unknown) {
        critical.push(event);
        events.push('critical');
      },
      onDisposed() {
        events.push('disposed');
      },
      onDragonFinished(event: Readonly<{ acceptedHitCount: number }>) {
        events.push(`finished:${event.acceptedHitCount}`);
      },
      onObjective(event: Readonly<{ amount: number; eventId: number }>) {
        events.push(`objective:${event.eventId}:${event.amount}`);
      },
      onPlayEffect(event: Readonly<{ canonicalPath: string }>) {
        events.push(`audio:${event.canonicalPath}`);
      },
    },
    setEffectsEnabled(value: boolean) {
      effectsEnabled = value;
    },
  };
}

function createEntity(
  assetTree: AssetTree,
  random: ScriptedRandom,
  lifecycle = createLifecycle(),
) {
  const viewport = assetTree === '480x800'
    ? { width: 480, height: 800 }
    : { width: 720, height: 1280 };
  const entity = CrazyGeneratedDragonFruit.create(
    {
      type: 'create-dragon-fruit',
      entityOccurrenceId: 9,
      tossType: 6,
    },
    viewport,
    createResources(assetTree),
    createFont(),
    random,
    lifecycle.lifecycle,
  );
  return { entity, lifecycle, viewport };
}

function attach(entity: InstanceType<typeof CrazyGeneratedDragonFruit>) {
  const parent = new cc.Node('GameplayLayer');
  parent.layer = 7;
  entity.attach(parent as never, 1);
  return parent;
}

const SEGMENT = Object.freeze({
  end: Object.freeze({ x: 0, y: 0 }),
  start: Object.freeze({ x: 0, y: 10 }),
});

test('both profiles bind exact visuals and build a zero-velocity 2x box body', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    const { entity, viewport } = createEntity(assetTree, new ScriptedRandom([]));
    const intact = assetTree === '480x800'
      ? { width: 118, height: 101 }
      : { width: 177, height: 153 };

    assert.deepEqual(entity.visuals.intact.dimensions, intact);
    assert.equal(entity.collider.size.width, intact.width * 2);
    assert.equal(entity.collider.size.height, intact.height * 2);
    assert.equal(entity.body.linearVelocity.x, 0);
    assert.equal(entity.body.linearVelocity.y, 0);
    assert.equal(entity.body.angularVelocity, 0);
    assert.equal(entity.body.gravityScale, 1);
    assert.deepEqual(entity.bodyNode.position, {
      x: Math.fround(Math.fround(viewport.width * Math.fround(0.5)) / 32) * 32,
      y: Math.fround(Math.fround(viewport.height * Math.fround(1.25)) / 32) * 32,
      z: 0,
    });
  }
});

test('Down applies transform and angular velocity without overwriting factory linear zero', () => {
  const { entity } = createEntity('480x800', new ScriptedRandom([]));

  entity.setTransform({ x: 1, y: 28.125 }, 0);
  entity.setAngularVelocity(7);

  assert.deepEqual(entity.bodyNode.position, { x: 32, y: 900, z: 0 });
  assert.equal(entity.body.angularVelocity, 7);
  assert.equal(entity.body.linearVelocity.x, 0);
  assert.equal(entity.body.linearVelocity.y, 0);
  const parent = attach(entity);
  assert.equal(entity.node.parent, parent);
  assert.equal(entity.snapshot().isFruit, false);
  assert.equal(entity.snapshot().cutDisabled, false);
  assert.throws(() => entity.setLinearVelocity({ x: 1, y: 1 }), Error);
});

test('first reject freezes body and creates ungated splash/counter with exact audio gate', () => {
  const random = new ScriptedRandom([-30, 1]);
  const runtime = createEntity('480x800', random);
  const { entity, lifecycle } = runtime;
  entity.setAngularVelocity(7);
  attach(entity);

  assert.equal(entity.cut(SEGMENT), true);

  assert.deepEqual(random.calls, [
    { minimumInclusive: -30, maximumInclusive: 30 },
    { minimumInclusive: 0, maximumInclusive: 1 },
  ]);
  assert.equal(entity.body.linearVelocity.x, 0);
  assert.equal(entity.body.linearVelocity.y, 0);
  assert.equal(entity.body.angularVelocity, 0);
  assert.equal(entity.body.gravityScale, 0);
  assert.deepEqual(lifecycle.events, ['audio:Sounds/hitmusic.wav']);
  assert.deepEqual(entity.presentationSnapshot(), {
    counterOpacity: 255,
    counterScale: 1,
    counterText: '+0\nHITS',
    splashOpacity: 255,
    splashVisible: true,
  });
  assert.equal(entity.stateSnapshot().started, true);
  assert.equal(entity.lastCutResult?.accepted, false);
});

test('accepted Cut teleports, resets angle, restarts splash/pulse, and samples effects per call', () => {
  const random = new ScriptedRandom([10, 1, 0, -45, -14, 14]);
  const runtime = createEntity('480x800', random);
  const { entity, lifecycle } = runtime;
  entity.setTransform({ x: 0.1, y: 20 }, 0.7);
  attach(entity);

  lifecycle.setEffectsEnabled(false);
  entity.cut(SEGMENT);
  lifecycle.setEffectsEnabled(true);
  entity.cut(SEGMENT);

  assert.equal(entity.lastCutResult?.accepted, true);
  assert.deepEqual(entity.bodyNode.position, {
    x: 0,
    y: Math.fround(Math.fround(20 + Math.fround(14 / 32)) * 32),
    z: 0,
  });
  assert.equal(entity.bodyNode.eulerAngles.z, 0);
  assert.deepEqual(lifecycle.events, ['audio:Sounds/strawberry.wav']);
  assert.equal(entity.presentationSnapshot().counterText, '+1\nHITS');
  assert.equal(entity.presentationSnapshot().counterScale, Math.fround(0.9));
  assert.equal(entity.presentationSnapshot().splashOpacity, 255);

  entity.updateAction(Math.fround(0.175));
  assert.equal(entity.presentationSnapshot().splashOpacity, 0);
  assert.equal(entity.presentationSnapshot().counterScale, 1);
});

test('completion has pieces before score, then deferred original/audio/fade/objective', () => {
  const random = new ScriptedRandom([0, 1]);
  const lifecycle = createLifecycle({ effectsEnabled: true });
  const { entity } = createEntity('480x800', random, lifecycle);
  attach(entity);
  entity.cut(SEGMENT);

  const originalFinished = lifecycle.lifecycle.onDragonFinished;
  lifecycle.lifecycle.onDragonFinished = (event: Readonly<{ acceptedHitCount: number }>) => {
    assert.equal(entity.terminalPieces.length, 4);
    originalFinished(event);
  };
  entity.updateAction(CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS);

  assert.deepEqual(entity.terminalPieces.map(({ kind }) => kind), [
    'top-left',
    'top-right',
    'bottom-right',
    'bottom-left',
  ]);
  assert.deepEqual(lifecycle.events, [
    'audio:Sounds/hitmusic.wav',
    'finished:0',
    'defer-dispose',
    'audio:Sounds/finishhitmusic.wav',
    'objective:15:1',
  ]);
  assert.equal(entity.disposalQueued, true);
  assert.equal(entity.presentationSnapshot().counterOpacity, 255);

  lifecycle.callbacks.shift()?.();
  assert.equal(entity.node.destroyed, true);
  assert.equal(lifecycle.events.at(-1), 'disposed');
  assert.deepEqual(entity.presentationSnapshot(), {
    counterOpacity: 255,
    counterScale: 1,
    counterText: '+0\nHITS',
    splashOpacity: 0,
    splashVisible: false,
  });

  // The retained sibling counter and pieces continue after the original/splash subtree is gone.
  // Creator rejects UIOpacity writes on destroyed nodes, so this is the runtime regression gate.
  entity.updateAction(Math.fround(0.75));
  assert.equal(entity.terminalPieces.every(({ disposalQueued }) => disposalQueued), true);
  assert.equal(entity.presentationSnapshot().counterOpacity, 127.5);
  entity.updateAction(Math.fround(0.75));
  assert.equal(entity.presentationSnapshot().counterText, null);
  while (lifecycle.callbacks.length > 0) {
    lifecycle.callbacks.shift()?.();
  }
});

test('a late accepted hit never writes splash opacity after original disposal', () => {
  const random = new ScriptedRandom([
    0, 1,
    0, 0, 0, 0,
  ]);
  const lifecycle = createLifecycle({ effectsEnabled: false });
  const { entity } = createEntity('480x800', random, lifecycle);
  attach(entity);

  entity.cut(SEGMENT);
  entity.updateAction(Math.fround(2));
  entity.cut(SEGMENT);
  entity.updateAction(Math.fround(0.1));

  assert.equal(entity.stateSnapshot().finished, true);
  assert.equal(entity.disposalQueued, true);
  lifecycle.callbacks.shift()?.();
  assert.equal(entity.node.destroyed, true);

  assert.doesNotThrow(() => entity.updateAction(Math.fround(0.1)));
  assert.equal(entity.presentationSnapshot().splashOpacity, 0);
  assert.equal(entity.presentationSnapshot().splashVisible, false);
});

test('action updates consume no critical RNG; physics updates draw for each surviving piece', () => {
  const random = new ScriptedRandom([
    0, 1,
    0, 4, -10,
    1,
    2,
    3,
  ]);
  const runtime = createEntity('480x800', random);
  const { entity, lifecycle, viewport } = runtime;
  entity.setTransform({ x: 7.5, y: 28.125 }, 0);
  attach(entity);
  entity.cut(SEGMENT);
  entity.updateAction(CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS);
  const callsAfterCompletion = random.calls.length;

  entity.updateAction(0.1);
  assert.equal(random.calls.length, callsAfterCompletion);

  const update = entity.updatePhysics(viewport);
  assert.equal(update.pieceUpdates.length, 4);
  assert.deepEqual(random.calls.slice(callsAfterCompletion), [
    { minimumInclusive: 0, maximumInclusive: 3 },
    { minimumInclusive: 1, maximumInclusive: 4 },
    { minimumInclusive: -10, maximumInclusive: 10 },
    { minimumInclusive: 0, maximumInclusive: 3 },
    { minimumInclusive: 0, maximumInclusive: 3 },
    { minimumInclusive: 0, maximumInclusive: 3 },
  ]);
  assert.equal(lifecycle.critical.length, 1);
  assert.equal(
    (lifecycle.critical[0] as { command: { resourceIndex: number } }).command.resourceIndex,
    4,
  );
});

test('zero velocity skips bounds; moving below defers disposal without a miss callback', () => {
  const zero = createEntity('480x800', new ScriptedRandom([]));
  zero.entity.setTransform({ x: 1, y: -10 }, 0);
  attach(zero.entity);
  assert.deepEqual(zero.entity.evaluateBounds(zero.viewport), []);
  assert.deepEqual(zero.lifecycle.events, []);

  const moving = createEntity('480x800', new ScriptedRandom([]));
  moving.entity.setTransform({ x: 1, y: -10 }, 0);
  moving.entity.setLinearVelocity({ x: 0, y: -1 });
  attach(moving.entity);
  assert.deepEqual(moving.entity.evaluateBounds(moving.viewport), [
    { type: 'fail', positionWorldUnits: { x: 32, y: -320 } },
    { type: 'defer-dispose', boundary: 'below' },
  ]);
  assert.deepEqual(moving.lifecycle.events, ['defer-dispose']);
});

test('owned-presentation teardown removes an unfinished sibling counter without advancing state or RNG', () => {
  const random = new ScriptedRandom([0, 1]);
  const lifecycle = createLifecycle({ effectsEnabled: false });
  const { entity } = createEntity('480x800', random, lifecycle);
  const parent = attach(entity);
  entity.cut(SEGMENT);
  const callsBeforeTeardown = [...random.calls];
  const stateBeforeTeardown = entity.stateSnapshot();

  assert.equal(entity.disposeOwnedPresentation('registry-dispose-all'), true);
  assert.equal(entity.ownedPresentationDisposalQueued, true);
  assert.equal(entity.ownedPresentationDisposed, false);
  assert.equal(lifecycle.callbacks.length, 1);
  lifecycle.callbacks.shift()?.();

  assert.equal(entity.ownedPresentationDisposalQueued, false);
  assert.equal(entity.ownedPresentationDisposed, true);
  assert.equal(parent.children.length, 0);
  assert.equal(entity.presentationSnapshot().counterText, null);
  assert.deepEqual(entity.stateSnapshot(), stateBeforeTeardown);
  assert.deepEqual(random.calls, callsBeforeTeardown);
  assert.deepEqual(lifecycle.events, ['defer-dispose', 'disposed']);
  assert.equal(entity.disposeOwnedPresentation('registry-dispose-all'), false);
});

test('owned-presentation teardown drains every existing piece best-effort and is retryable', () => {
  const random = new ScriptedRandom([0, 1]);
  const lifecycle = createLifecycle({ effectsEnabled: false });
  const { entity } = createEntity('480x800', random, lifecycle);
  const parent = attach(entity);
  entity.cut(SEGMENT);
  entity.updateAction(CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS);
  lifecycle.callbacks.shift()?.();
  assert.equal(entity.terminalPieces.length, 4);

  const counter = parent.children.find(({ name }) => name.endsWith('-HitCounter'));
  const topLeft = parent.children.find(({ name }) => name.endsWith('-top-left'));
  assert.notEqual(counter, undefined);
  assert.notEqual(topLeft, undefined);
  const counterDestroy = counter!.destroy.bind(counter!);
  const topLeftDestroy = topLeft!.destroy.bind(topLeft!);
  counter!.destroy = () => {
    throw new Error('counter destroy failed');
  };
  topLeft!.destroy = () => {
    throw new Error('top-left destroy failed');
  };
  const callsBeforeTeardown = [...random.calls];

  assert.equal(entity.disposeOwnedPresentation('registry-dispose-all'), true);
  assert.throws(
    () => lifecycle.callbacks.shift()?.(),
    (error: unknown) => {
      assert.equal(
        error instanceof CrazyGeneratedDragonOwnedPresentationDisposalError,
        true,
      );
      assert.deepEqual(
        (
          error as InstanceType<
            typeof CrazyGeneratedDragonOwnedPresentationDisposalError
          >
        ).failures.map(({ part }) => part),
        ['counter', 'top-left'],
      );
      return true;
    },
  );
  assert.equal(entity.ownedPresentationDisposed, false);
  assert.equal(
    parent.children.filter(({ destroyed }) => !destroyed).length,
    2,
  );

  counter!.destroy = counterDestroy;
  topLeft!.destroy = topLeftDestroy;
  assert.equal(entity.disposeOwnedPresentation('registry-dispose-all'), true);
  lifecycle.callbacks.shift()?.();
  assert.equal(entity.ownedPresentationDisposed, true);
  assert.equal(parent.children.length, 0);
  assert.deepEqual(random.calls, callsBeforeTeardown);
  assert.equal(
    lifecycle.events.filter((event) => event === 'disposed').length,
    1,
  );
});

test('create and disposal fail closed without leaving a queued or partial runtime', () => {
  const resources = createResources('480x800');
  const invalidFont = createFont();
  invalidFont.font.destroyed = true;
  const before = cc.Node.createdCount;
  assert.throws(() => CrazyGeneratedDragonFruit.create(
    { type: 'create-dragon-fruit', entityOccurrenceId: 1, tossType: 6 },
    { width: 480, height: 800 },
    resources,
    invalidFont,
    new ScriptedRandom([]),
    createLifecycle().lifecycle,
  ), Error);
  assert.equal(cc.Node.createdCount, before);

  const throwing = createLifecycle({ throwOnSchedule: true });
  const { entity } = createEntity('480x800', new ScriptedRandom([]), throwing);
  attach(entity);
  assert.throws(() => entity.queueDispose('registry-dispose-all'), /schedule failed/);
  assert.equal(entity.disposalQueued, false);
  assert.equal(entity.node.destroyed, false);
});
