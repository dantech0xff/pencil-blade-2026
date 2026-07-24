import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SOURCE = readFileSync(
  fileURLToPath(new URL(
    '../../../game/assets/scripts/creator/crazy-entity-registry.ts',
    import.meta.url,
  )),
  'utf8',
);

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
  constructor() { this.opacity = 255; }
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
  getMass() { return 1; }
}

export class Collider2D {
  constructor() {
    this.offset = new Vec2();
    this.density = 0;
    this.friction = 0;
    this.restitution = 0;
    this.sensor = true;
    this.group = 0;
    this.tag = -1;
  }
}

export class CircleCollider2D extends Collider2D {
  constructor() { super(); this.radius = 0; }
}

export class BoxCollider2D extends Collider2D {
  constructor() { super(); this.size = new Size(); }
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
      const previousIndex = this.parent.children.indexOf(this);
      if (previousIndex >= 0) this.parent.children.splice(previousIndex, 1);
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

const cc = await import('cc') as unknown as {
  readonly Font: new () => { destroyed: boolean };
  readonly Node: {
    new (name?: string): StubNode;
    createdCount: number;
  };
  readonly SpriteFrame: new (width: number, height: number) => StubSpriteFrame;
  readonly isValid: (value: unknown) => boolean;
};
const {
  getClassicBombResource,
  getClassicNormalFruitResources,
} = await import('../../../game/assets/scripts/domain/classic-resource-contract.ts');
const {
  getCrazySpecialFruitResources,
  getCrazySupplementalRasterSet,
} = await import('../../../game/assets/scripts/domain/crazy-resource-contract.ts');
const {
  CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS,
} = await import('../../../game/assets/scripts/domain/crazy-dragon-fruit-state.ts');
const {
  ClassicGeneratedBomb,
} = await import('../../../game/assets/scripts/creator/classic-generated-bomb.ts');
const {
  ClassicGeneratedFruit,
} = await import('../../../game/assets/scripts/creator/classic-generated-fruit.ts');
const {
  CrazyGeneratedSpecialFruit,
} = await import('../../../game/assets/scripts/creator/crazy-generated-special-fruit.ts');
const {
  CrazyGeneratedDragonFruit,
} = await import('../../../game/assets/scripts/creator/crazy-generated-dragon-fruit.ts');
const {
  CrazyEntityDrainError,
  CrazyEntityRegistry,
  CrazySpawnRollbackError,
  bonusOccurrenceKey,
  sharedPlannerOccurrenceKey,
} = await import('../../../game/assets/scripts/creator/crazy-entity-registry.ts');

interface StubNode {
  active: boolean;
  readonly activeInHierarchy: boolean;
  children: StubNode[];
  destroy(): void;
  destroyed: boolean;
  lastRequestedSiblingIndex: number | null;
  readonly name: string;
  parent: StubNode | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly scale: Readonly<{ x: number; y: number; z: number }>;
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

type FruitId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type SpecialFruitId = 10 | 11 | 12 | 13 | 14;

const VIEWPORT = Object.freeze({ width: 480, height: 800 });
const SEGMENT = Object.freeze({
  start: Object.freeze({ x: 1, y: 2 }),
  end: Object.freeze({ x: 3, y: 4 }),
});

function loadedRaster(
  resource: Readonly<{
    canonicalPath: string;
    dimensions: Readonly<{ height: number; width: number }>;
  }>,
): LoadedRaster {
  return Object.freeze({
    ...resource,
    spriteFrame: new cc.SpriteFrame(
      resource.dimensions.width,
      resource.dimensions.height,
    ),
  });
}

function createClassicCatalog() {
  const fruits = Array.from({ length: 9 }, (_, fruitId) => {
    const resources = getClassicNormalFruitResources(fruitId, '480x800');
    return Object.freeze({
      cutBottom: loadedRaster(resources.cutBottom),
      cutTop: loadedRaster(resources.cutTop),
      intact: loadedRaster(resources.intact),
    });
  });
  const bomb = loadedRaster(getClassicBombResource(0, '480x800'));
  return Object.freeze({
    normalFruit(fruitId: number) {
      const resources = fruits[fruitId];
      if (resources === undefined) {
        throw new RangeError('missing ordinary fruit');
      }
      return resources;
    },
    bomb(bombId: number) {
      if (bombId !== 0) {
        throw new RangeError('missing bomb');
      }
      return bomb;
    },
  });
}

function createCrazyResources() {
  const byPath = new Map<string, LoadedRaster>();
  for (let fruitId = 10; fruitId <= 14; fruitId += 1) {
    const resources = getCrazySpecialFruitResources(fruitId, '480x800');
    for (const resource of [
      resources.intact,
      resources.cutTop,
      resources.cutBottom,
    ]) {
      byPath.set(resource.canonicalPath, loadedRaster(resource));
    }
  }
  const dragon = getCrazySupplementalRasterSet('480x800');
  for (const resource of [
    dragon.dragonFruit,
    dragon.dragonSplash,
    dragon.dragonCutTopLeft,
    dragon.dragonCutTopRight,
    dragon.dragonCutBottomRight,
    dragon.dragonCutBottomLeft,
  ]) {
    byPath.set(resource.canonicalPath, loadedRaster(resource));
  }
  return Object.freeze({
    assetTree: '480x800' as const,
    rasterCount: 37 as const,
    timeManagerFont: Object.freeze({}),
    raster(resource: Readonly<{ canonicalPath: string }>) {
      const loaded = byPath.get(resource.canonicalPath);
      if (loaded === undefined) {
        throw new Error(`missing Crazy raster ${resource.canonicalPath}`);
      }
      return loaded;
    },
  });
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

interface RegistryHarness {
  readonly attachedBombs: Array<InstanceType<typeof ClassicGeneratedBomb>>;
  readonly audio: string[];
  readonly beforeBombFreeze: unknown[];
  readonly bombCuts: unknown[];
  readonly bonusAudio: unknown[];
  readonly cuts: unknown[];
  readonly deferred: Array<() => void>;
  readonly disposals: Array<Readonly<{
    readonly entityOccurrenceId: number;
    readonly reason: unknown;
    readonly targetId: string;
  }>>;
  readonly dragonCritical: unknown[];
  readonly dragonEffects: unknown[];
  readonly dragonFinishes: unknown[];
  readonly dragonObjectives: unknown[];
  readonly dragonRandom: ScriptedRandom;
  readonly enabled: unknown[];
  readonly events: string[];
  readonly misses: unknown[];
  readonly parent: StubNode;
  readonly registry: InstanceType<typeof CrazyEntityRegistry>;
  readonly samples: Array<Readonly<{
    readonly direction: number;
    readonly viewport: Readonly<{ height: number; width: number }>;
  }>>;
}

interface HarnessOverrides {
  readonly callAfterStep?: (
    mutation: () => void,
    harness: RegistryHarness,
  ) => void;
  readonly dragonDraws?: readonly number[];
  readonly effectsEnabled?: boolean;
  readonly onDispose?: (event: unknown, harness: RegistryHarness) => void;
  readonly onEnableBonus?: (command: unknown, harness: RegistryHarness) => void;
  readonly onPlayBonusTossAudio?: (
    command: unknown,
    harness: RegistryHarness,
  ) => void;
  readonly onPlayTossSound?: (sound: string, harness: RegistryHarness) => void;
  readonly onStandardBombAttached?: (
    bomb: InstanceType<typeof ClassicGeneratedBomb>,
    harness: RegistryHarness,
  ) => void;
  readonly sampleBonusKinematics?: (
    direction: number,
    viewport: Readonly<{ height: number; width: number }>,
    harness: RegistryHarness,
  ) => Readonly<{
    readonly angleRadians: 0;
    readonly angularVelocityRadiansPerSecond: number;
    readonly direction: number;
    readonly linearVelocityMetresPerSecond?: Readonly<{ x: number; y: number }>;
    readonly positionMetres: Readonly<{ x: number; y: number }>;
  }>;
}

function createHarness(overrides: HarnessOverrides = {}): RegistryHarness {
  const attachedBombs: Array<InstanceType<typeof ClassicGeneratedBomb>> = [];
  const deferred: Array<() => void> = [];
  const events: string[] = [];
  const cuts: unknown[] = [];
  const misses: unknown[] = [];
  const disposals: RegistryHarness['disposals'] = [];
  const dragonCritical: unknown[] = [];
  const dragonEffects: unknown[] = [];
  const dragonFinishes: unknown[] = [];
  const dragonObjectives: unknown[] = [];
  const dragonRandom = new ScriptedRandom(overrides.dragonDraws ?? []);
  const beforeBombFreeze: unknown[] = [];
  const bombCuts: unknown[] = [];
  const enabled: unknown[] = [];
  const bonusAudio: unknown[] = [];
  const audio: string[] = [];
  const samples: RegistryHarness['samples'] = [];
  const parent = new cc.Node('CrazyWorld');
  let harness: RegistryHarness;

  const registry = new CrazyEntityRegistry({
    callAfterStep: (mutation) => {
      if (overrides.callAfterStep === undefined) {
        deferred.push(mutation);
      } else {
        overrides.callAfterStep(mutation, harness);
      }
    },
    classicCatalog: createClassicCatalog() as never,
    crazyResources: createCrazyResources() as never,
    dragonFont: Object.freeze({
      canonicalPath: 'Fonts/Razing.ttf' as const,
      font: new cc.Font(),
    }) as never,
    dragonRandom,
    effectsEnabled: () => overrides.effectsEnabled ?? true,
    onBeforeBombFreeze: (event) => {
      events.push('before-bomb-freeze');
      beforeBombFreeze.push(event);
    },
    onBombCut: (event) => {
      events.push('bomb-cut');
      bombCuts.push(event);
    },
    onDispose: (event) => {
      disposals.push({
        entityOccurrenceId: event.entityOccurrenceId,
        reason: event.reason,
        targetId: event.targetId,
      });
      overrides.onDispose?.(event, harness);
    },
    onDragonCriticalParticle: (event) => {
      events.push('dragon-critical');
      dragonCritical.push(event);
    },
    onDragonFinished: (event) => {
      events.push('dragon-finished');
      dragonFinishes.push(event);
    },
    onDragonObjective: (event) => {
      events.push('dragon-objective');
      dragonObjectives.push(event);
    },
    onDragonPlayEffect: (event) => {
      events.push(`dragon-effect:${event.canonicalPath}`);
      dragonEffects.push(event);
    },
    onEnableBonus: (command) => {
      events.push('enable');
      enabled.push(command);
      overrides.onEnableBonus?.(command, harness);
    },
    onOrdinaryFruitCut: (event) => {
      cuts.push(event);
    },
    onOrdinaryFruitMiss: (event) => {
      misses.push(event);
    },
    onPlayBonusTossAudio: (command) => {
      events.push('bonus-audio');
      bonusAudio.push(command);
      overrides.onPlayBonusTossAudio?.(command, harness);
    },
    onPlayTossSound: (sound) => {
      events.push('toss-audio');
      audio.push(sound);
      overrides.onPlayTossSound?.(sound, harness);
    },
    onStandardBombAttached: (bomb) => {
      events.push('bomb-attached');
      attachedBombs.push(bomb);
      overrides.onStandardBombAttached?.(bomb, harness);
    },
    onSpecialFruitCut: (event) => {
      cuts.push(event);
    },
    onSpecialFruitMiss: (event) => {
      misses.push(event);
    },
    sampleBonusKinematics: (direction, viewport) => {
      events.push('sample');
      samples.push(Object.freeze({ direction, viewport }));
      return (overrides.sampleBonusKinematics?.(
        direction,
        viewport,
        harness,
      ) ?? (
        direction === 1
          ? Object.freeze({
              angleRadians: 0 as const,
              angularVelocityRadiansPerSecond: 5,
              direction: 1 as const,
              positionMetres: Object.freeze({ x: 4, y: 5 }),
            })
          : Object.freeze({
              angleRadians: 0 as const,
              angularVelocityRadiansPerSecond: 6,
              direction,
              linearVelocityMetresPerSecond: Object.freeze({ x: 7, y: 8 }),
              positionMetres: Object.freeze({ x: 2, y: 3 }),
            })
      )) as never;
    },
  });
  harness = {
    attachedBombs,
    audio,
    beforeBombFreeze,
    bombCuts,
    bonusAudio,
    cuts,
    deferred,
    disposals,
    dragonCritical,
    dragonEffects,
    dragonFinishes,
    dragonObjectives,
    dragonRandom,
    enabled,
    events,
    misses,
    parent,
    registry,
    samples,
  };
  return harness;
}

function flushDeferred(harness: RegistryHarness): void {
  while (harness.deferred.length > 0) {
    harness.deferred.shift()?.();
  }
}

function ordinaryPlan(
  fruitId: FruitId,
  entityOccurrenceId: number,
  sound = false,
) {
  return Object.freeze({
    entityOccurrenceId,
    commands: Object.freeze([
      Object.freeze({
        type: 'create-fruit' as const,
        entityOccurrenceId,
        tossType: 0 as const,
        fruitId,
        critical: fruitId === 8,
      }),
      Object.freeze({
        type: 'set-transform' as const,
        entityOccurrenceId,
        positionMetres: Object.freeze({ x: fruitId + 1, y: 4 }),
        angleRadians: 0 as const,
      }),
      Object.freeze({
        type: 'set-linear-velocity' as const,
        entityOccurrenceId,
        metresPerSecond: Object.freeze({ x: 2, y: 3 }),
        reason: 'spawn-kinematics' as const,
      }),
      Object.freeze({
        type: 'set-angular-velocity' as const,
        entityOccurrenceId,
        radiansPerSecond: 4,
      }),
      ...(sound
        ? [Object.freeze({
            type: 'play-toss-sound' as const,
            entityOccurrenceId,
            sound: 'Sounds/tossfruit.wav' as const,
          })]
        : []),
      Object.freeze({
        type: 'attach-spawned-entity' as const,
        entityOccurrenceId,
        zOrder: 1 as const,
      }),
    ]),
  });
}

function bombPlan(entityOccurrenceId: number, sound = false) {
  return Object.freeze({
    entityOccurrenceId,
    commands: Object.freeze([
      Object.freeze({
        type: 'create-bomb' as const,
        entityOccurrenceId,
        tossType: 1 as const,
        bombId: 0 as const,
      }),
      Object.freeze({
        type: 'set-transform' as const,
        entityOccurrenceId,
        positionMetres: Object.freeze({ x: 3, y: 4 }),
        angleRadians: 0 as const,
      }),
      Object.freeze({
        type: 'set-linear-velocity' as const,
        entityOccurrenceId,
        metresPerSecond: Object.freeze({ x: 5, y: 6 }),
        reason: 'spawn-kinematics' as const,
      }),
      Object.freeze({
        type: 'set-angular-velocity' as const,
        entityOccurrenceId,
        radiansPerSecond: 7,
      }),
      ...(sound
        ? [Object.freeze({
            type: 'play-toss-sound' as const,
            entityOccurrenceId,
            sound: 'Sounds/boomtoss.wav' as const,
          })]
        : []),
      Object.freeze({
        type: 'attach-spawned-entity' as const,
        entityOccurrenceId,
        zOrder: 1 as const,
      }),
    ]),
  });
}

function downSpecialPlan(
  fruitId: Extract<SpecialFruitId, 13 | 14>,
  entityOccurrenceId: number,
) {
  const tossType = fruitId === 13 ? 3 as const : 4 as const;
  return Object.freeze({
    entityOccurrenceId,
    commands: Object.freeze([
      Object.freeze({
        type: 'create-fruit' as const,
        entityOccurrenceId,
        tossType,
        fruitId,
      }),
      Object.freeze({
        type: 'reset-linear-velocity' as const,
        entityOccurrenceId,
        metresPerSecond: Object.freeze({ x: 0, y: 0 }),
        reason: 'fruit-factory-down-reset' as const,
      }),
      Object.freeze({
        type: 'set-transform' as const,
        entityOccurrenceId,
        positionMetres: Object.freeze({ x: 9, y: 10 }),
        angleRadians: 0 as const,
      }),
      Object.freeze({
        type: 'set-angular-velocity' as const,
        entityOccurrenceId,
        radiansPerSecond: 5,
      }),
      Object.freeze({
        type: 'attach-spawned-entity' as const,
        entityOccurrenceId,
        zOrder: 1 as const,
      }),
    ]),
  });
}

function dragonPlan(
  entityOccurrenceId: number,
  positionMetres = Object.freeze({ x: 9, y: 28.125 }),
) {
  return Object.freeze({
    entityOccurrenceId,
    commands: Object.freeze([
      Object.freeze({
        type: 'create-dragon-fruit' as const,
        entityOccurrenceId,
        tossType: 6 as const,
      }),
      Object.freeze({
        type: 'set-transform' as const,
        entityOccurrenceId,
        positionMetres,
        angleRadians: 0 as const,
      }),
      Object.freeze({
        type: 'set-angular-velocity' as const,
        entityOccurrenceId,
        radiansPerSecond: 7,
      }),
      Object.freeze({
        type: 'attach-spawned-entity' as const,
        entityOccurrenceId,
        zOrder: 1 as const,
      }),
    ]),
  });
}

function bonusBatch(
  fruitId: Extract<SpecialFruitId, 10 | 11 | 12>,
  entityOccurrenceId: number,
  controllerId = 'b5',
  audio = false,
  direction: 1 | 2 | 3 = 2,
) {
  return Object.freeze([
    Object.freeze({
      type: 'create-bonus-fruit' as const,
      controllerId,
      entityOccurrenceId,
      fruitId,
      tossType: 5 as const,
    }),
    Object.freeze({
      type: 'randomize-bonus-fruit' as const,
      controllerId,
      direction,
      entityOccurrenceId,
    }),
    Object.freeze({
      type: 'attach-bonus-fruit' as const,
      controllerId,
      entityOccurrenceId,
      zOrder: 1 as const,
    }),
    Object.freeze({
      type: 'enable-bonus' as const,
      bonusId: fruitId,
      entityOccurrenceId,
    }),
    ...(audio
      ? [Object.freeze({
          type: 'request-bonus-toss-audio' as const,
          canonicalPath: 'Sounds/tossfruit.wav' as const,
          entityOccurrenceId,
          loop: false as const,
        })]
      : []),
  ]);
}

test('Set and Map snapshots use Array.from before Creator loose-build iteration', () => {
  assert.equal(
    SOURCE.split('Array.from(this.activeDragonEffects.values())').length - 1,
    3,
  );
  assert.equal(
    SOURCE.split('Array.from(this.byOccurrenceKey.values())').length - 1,
    3,
  );
  assert.equal(SOURCE.split('Array.from(this.rayQueryCutFruit)').length - 1, 1);
  assert.equal(
    SOURCE.includes('[...this.activeDragonEffects.values()]'),
    false,
  );
  assert.equal(SOURCE.includes('[...this.byOccurrenceKey.values()]'), false);
  assert.equal(SOURCE.includes('[...this.rayQueryCutFruit]'), false);
});

test('registry creates all exact ordinary, standard-bomb, and Crazy special entities', () => {
  const harness = createHarness();
  const entities: unknown[] = [];

  for (let fruitId = 0; fruitId <= 8; fruitId += 1) {
    const entity = harness.registry.applySpawnPlan(
      ordinaryPlan(fruitId as FruitId, fruitId + 1),
      harness.parent as never,
      VIEWPORT,
    );
    assert.equal(entity instanceof ClassicGeneratedFruit, true);
    assert.equal(entity.fruitId, fruitId);
    assert.equal(entity.node.parent, harness.parent);
    assert.equal(harness.registry.resolveCollider(entity.collider), entity);
    assert.equal(harness.registry.resolveBombCollider(entity.collider), null);
    entities.push(entity);
  }

  const bomb = harness.registry.applySpawnPlan(
    bombPlan(10),
    harness.parent as never,
    VIEWPORT,
  );
  assert.equal(bomb instanceof ClassicGeneratedBomb, true);
  assert.equal(harness.registry.resolveBombCollider(bomb.collider), bomb);
  entities.push(bomb);

  for (const fruitId of [13, 14] as const) {
    const entity = harness.registry.applySpawnPlan(
      downSpecialPlan(fruitId, fruitId),
      harness.parent as never,
      VIEWPORT,
    );
    assert.equal(entity instanceof CrazyGeneratedSpecialFruit, true);
    assert.equal(entity.fruitId, fruitId);
    assert.equal(entity.tossType, fruitId === 13 ? 3 : 4);
    assert.equal(harness.registry.resolveBombCollider(entity.collider), null);
    entities.push(entity);
  }

  for (const fruitId of [10, 11, 12] as const) {
    const entity = harness.registry.applyBonusSpawnBatch(
      bonusBatch(fruitId, fruitId, `b5-${fruitId}`),
      harness.parent as never,
      VIEWPORT,
    );
    assert.equal(entity instanceof CrazyGeneratedSpecialFruit, true);
    assert.equal(entity.fruitId, fruitId);
    assert.equal(entity.tossType, 5);
    entities.push(entity);
  }

  assert.equal(harness.registry.size, 15);
  assert.equal(harness.registry.cuttableSnapshots().length, 15);
  assert.equal(
    entities.every((entity) => harness.registry.cuttableSnapshotForCollider(
      (entity as { collider: never }).collider,
    ) !== null),
    true,
  );

  harness.registry.disposeAll();
  assert.equal(harness.deferred.length, 15);
  assert.equal(harness.registry.size, 15);
  flushDeferred(harness);
  assert.equal(harness.registry.size, 0);
  assert.equal(harness.disposals.length, 15);
  assert.equal(
    harness.disposals.every(({ reason }) => reason === 'registry-dispose-all'),
    true,
  );
});

test('shared planner #1 and Bonus b5#1 coexist through collision-free composite keys', () => {
  const harness = createHarness();
  const ordinary = harness.registry.applySpawnPlan(
    ordinaryPlan(0, 1),
    harness.parent as never,
    VIEWPORT,
  );
  const bonus = harness.registry.applyBonusSpawnBatch(
    bonusBatch(10, 1, 'b5'),
    harness.parent as never,
    VIEWPORT,
  );

  assert.equal(sharedPlannerOccurrenceKey(1), 'shared-planner:1');
  assert.equal(bonusOccurrenceKey('b5', 1), 'bonus:b5:1');
  assert.equal(harness.registry.getSharedPlannerEntity(1), ordinary);
  assert.equal(harness.registry.getBonusEntity('b5', 1), bonus);
  assert.equal(
    harness.registry.getByOccurrenceKey('shared-planner:1'),
    ordinary,
  );
  assert.equal(harness.registry.getByOccurrenceKey('bonus:b5:1'), bonus);
  assert.notEqual(ordinary.targetId, bonus.targetId);
  assert.equal(harness.registry.size, 2);

  harness.registry.disposeAll();
  flushDeferred(harness);
});

test('spawn execution preserves transform/velocity/audio/attach and Bonus command order', () => {
  let classicEntityAtAudio: unknown = null;
  let bombAtAttach: InstanceType<typeof ClassicGeneratedBomb> | null = null;
  let bonusEntityAtEnable: CrazyGeneratedSpecialFruit | null = null;
  const harness = createHarness({
    onPlayTossSound(sound, current) {
      const occurrenceId = sound === 'Sounds/boomtoss.wav' ? 21 : 20;
      classicEntityAtAudio = current.registry.getSharedPlannerEntity(occurrenceId);
      assert.equal(
        (classicEntityAtAudio as { node: StubNode }).node.parent,
        null,
      );
    },
    onStandardBombAttached(bomb, current) {
      bombAtAttach = bomb;
      assert.equal(bomb.node.parent, current.parent);
      assert.equal(bomb.node.activeInHierarchy, true);
    },
    onEnableBonus(_command, current) {
      bonusEntityAtEnable = current.registry.getBonusEntity('b5', 20);
      assert.equal(bonusEntityAtEnable?.node.parent, current.parent);
    },
    onPlayBonusTossAudio(_command, current) {
      assert.equal(current.registry.getBonusEntity('b5', 20), bonusEntityAtEnable);
    },
    sampleBonusKinematics(direction, viewport, current) {
      const entity = current.registry.getBonusEntity('b5', 20);
      assert.equal(entity?.node.parent, null);
      assert.deepEqual(viewport, VIEWPORT);
      return Object.freeze({
        angleRadians: 0,
        angularVelocityRadiansPerSecond: 9,
        direction,
        linearVelocityMetresPerSecond: Object.freeze({ x: 4, y: 5 }),
        positionMetres: Object.freeze({ x: 6, y: 7 }),
      });
    },
  });

  const ordinary = harness.registry.applySpawnPlan(
    ordinaryPlan(2, 20, true),
    harness.parent as never,
    VIEWPORT,
  );
  assert.equal(classicEntityAtAudio, ordinary);
  assert.deepEqual(ordinary.node.position, { x: 96, y: 128, z: 0 });
  assert.deepEqual(
    { x: ordinary.body.linearVelocity.x, y: ordinary.body.linearVelocity.y },
    { x: 2, y: 3 },
  );
  assert.equal(ordinary.body.angularVelocity, 4);
  assert.equal(ordinary.node.parent, harness.parent);
  assert.deepEqual(harness.audio, ['Sounds/tossfruit.wav']);

  harness.events.length = 0;
  const bomb = harness.registry.applySpawnPlan(
    bombPlan(21, true),
    harness.parent as never,
    VIEWPORT,
  );
  assert.equal(bombAtAttach, bomb);
  assert.deepEqual(harness.events, ['toss-audio', 'bomb-attached']);
  assert.deepEqual(harness.audio, [
    'Sounds/tossfruit.wav',
    'Sounds/boomtoss.wav',
  ]);
  assert.equal(bomb.node.parent, harness.parent);
  assert.equal(bomb.node.activeInHierarchy, true);

  harness.events.length = 0;
  const bombWithoutTossAudio = harness.registry.applySpawnPlan(
    bombPlan(22, false),
    harness.parent as never,
    VIEWPORT,
  );
  assert.deepEqual(harness.events, ['bomb-attached']);
  assert.equal(bombWithoutTossAudio.node.parent, harness.parent);
  assert.deepEqual(harness.audio, [
    'Sounds/tossfruit.wav',
    'Sounds/boomtoss.wav',
  ]);

  harness.events.length = 0;
  const bonus = harness.registry.applyBonusSpawnBatch(
    bonusBatch(11, 20, 'b5', true, 2),
    harness.parent as never,
    VIEWPORT,
  );
  assert.deepEqual(harness.events, ['sample', 'enable', 'bonus-audio']);
  assert.equal(bonusEntityAtEnable, bonus);
  assert.deepEqual(bonus.node.position, { x: 192, y: 224, z: 0 });
  assert.deepEqual(
    { x: bonus.body.linearVelocity.x, y: bonus.body.linearVelocity.y },
    { x: 4, y: 5 },
  );
  assert.equal(bonus.body.angularVelocity, 9);
  assert.equal(bonus.node.parent, harness.parent);
  assert.equal(bonus.node.lastRequestedSiblingIndex, 1);
  assert.deepEqual(harness.enabled, [{
    type: 'enable-bonus',
    bonusId: 11,
    entityOccurrenceId: 20,
  }]);

  harness.registry.disposeAll();
  flushDeferred(harness);
});

test('Dragon spawn, repeated ray cuts, retained physics/actions, and deferred release preserve exact order', () => {
  const harness = createHarness({
    dragonDraws: [
      ...Array.from({ length: 17 }, () => 0),
      1, 1, 1, 1,
    ],
    effectsEnabled: false,
  });
  const dragon = harness.registry.applySpawnPlan(
    dragonPlan(25),
    harness.parent as never,
    VIEWPORT,
  );

  assert.equal(dragon instanceof CrazyGeneratedDragonFruit, true);
  assert.deepEqual(dragon.bodyNode.position, { x: 288, y: 900, z: 0 });
  assert.deepEqual(
    { x: dragon.body.linearVelocity.x, y: dragon.body.linearVelocity.y },
    { x: 0, y: 0 },
  );
  assert.equal(dragon.body.angularVelocity, 7);
  assert.equal(dragon.node.parent, harness.parent);
  assert.equal(harness.registry.resolveCollider(dragon.collider), dragon);
  assert.equal(harness.registry.resolveBombCollider(dragon.collider), null);
  assert.equal(harness.registry.activeDragonEffectCount, 1);
  assert.equal(harness.dragonRandom.calls.length, 0);

  harness.registry.runRayQueryCutBatch(() => {
    assert.equal(harness.registry.cut(dragon.targetId, SEGMENT), true);
    assert.equal(harness.registry.cut(dragon.targetId, SEGMENT), true);
    assert.equal(harness.registry.cut(dragon.targetId, SEGMENT), true);
    assert.equal(harness.registry.cut(dragon.targetId, SEGMENT), true);
  });
  assert.equal(dragon.stateSnapshot().acceptedHitCount, 4);
  assert.deepEqual(harness.dragonRandom.calls, [
    { minimumInclusive: -30, maximumInclusive: 30 },
    { minimumInclusive: 0, maximumInclusive: 1 },
    { minimumInclusive: -45, maximumInclusive: 45 },
    { minimumInclusive: -14, maximumInclusive: 14 },
    { minimumInclusive: -14, maximumInclusive: 14 },
    ...Array.from({ length: 3 }, () => [
      { minimumInclusive: 0, maximumInclusive: 1 },
      { minimumInclusive: -45, maximumInclusive: 45 },
      { minimumInclusive: -14, maximumInclusive: 14 },
      { minimumInclusive: -14, maximumInclusive: 14 },
    ]).flat(),
  ]);

  harness.registry.updateDragonEffectsAction(
    CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS,
  );
  assert.equal(dragon.terminalPieces.length, 4);
  assert.equal(harness.dragonFinishes.length, 1);
  assert.equal(harness.dragonObjectives.length, 1);
  assert.equal(harness.deferred.length, 1);
  harness.deferred.shift()?.();

  assert.equal(harness.registry.size, 0);
  assert.equal(harness.registry.resolveCollider(dragon.collider), null);
  assert.equal(harness.registry.activeDragonEffectCount, 1);
  assert.equal(harness.disposals[0]?.reason, 'dragon-finished');

  const physics = harness.registry.updateDragonEffectsPhysics(VIEWPORT);
  assert.equal(physics.length, 1);
  assert.equal(physics[0]?.occurrenceKey, 'shared-planner:25');
  assert.equal(physics[0]?.update.pieceUpdates.length, 4);
  assert.deepEqual(harness.dragonRandom.calls.slice(-4), [
    { minimumInclusive: 0, maximumInclusive: 3 },
    { minimumInclusive: 0, maximumInclusive: 3 },
    { minimumInclusive: 0, maximumInclusive: 3 },
    { minimumInclusive: 0, maximumInclusive: 3 },
  ]);
  assert.equal(harness.dragonCritical.length, 0);

  harness.registry.updateDragonEffectsAction(0.75);
  assert.equal(harness.registry.activeDragonEffectCount, 1);
  assert.equal(harness.deferred.length, 4);
  flushDeferred(harness);
  assert.equal(harness.registry.activeDragonEffectCount, 1);

  harness.registry.updateDragonEffectsAction(0.75);
  assert.equal(dragon.presentationSnapshot().counterText, null);
  assert.equal(harness.registry.activeDragonEffectCount, 1);
  assert.equal(harness.deferred.length, 1);
  flushDeferred(harness);
  assert.equal(harness.registry.activeDragonEffectCount, 0);
});

test('bomb reports repeat pre-guard stops while freeze/handoff remains once', () => {
  const harness = createHarness();
  const bomb = harness.registry.applySpawnPlan(
    bombPlan(30),
    harness.parent as never,
    VIEWPORT,
  ) as InstanceType<typeof ClassicGeneratedBomb>;
  const fruit = harness.registry.applySpawnPlan(
    ordinaryPlan(1, 31),
    harness.parent as never,
    VIEWPORT,
  );
  harness.events.length = 0;

  assert.equal(harness.registry.resolveBombCollider(bomb.collider), bomb);
  assert.equal(harness.registry.resolveBombCollider(fruit.collider), null);
  assert.equal(harness.registry.cut(bomb.targetId, SEGMENT), true);
  assert.equal(harness.registry.cut(bomb.targetId, SEGMENT), false);
  assert.deepEqual(harness.events, [
    'before-bomb-freeze',
    'bomb-cut',
    'before-bomb-freeze',
  ]);
  assert.equal(harness.beforeBombFreeze.length, 2);
  assert.equal(harness.bombCuts.length, 1);
  assert.deepEqual(
    { x: bomb.body.linearVelocity.x, y: bomb.body.linearVelocity.y },
    { x: 0, y: 0 },
  );
  assert.equal(bomb.body.angularVelocity, 0);
  assert.equal(bomb.body.gravityScale, 0);
  assert.equal(harness.deferred.length, 0);

  assert.equal(harness.registry.finishBombAfterHit(bomb.targetId), true);
  assert.equal(harness.registry.finishBombAfterHit(bomb.targetId), false);
  assert.equal(harness.deferred.length, 1);
  flushDeferred(harness);
  assert.equal(harness.registry.resolveBombCollider(bomb.collider), null);
  assert.equal(harness.registry.hasTarget(bomb.targetId), false);
  assert.deepEqual(harness.disposals[0]?.reason, 'after-bomb-hit');
  assert.throws(
    () => harness.registry.finishBombAfterHit(fruit.targetId),
    /not a standard bomb/,
  );

  harness.registry.disposeAll();
  flushDeferred(harness);
});

test('synchronous post-disposal observer failure leaves an explicit committed Bomb boundary', () => {
  const harness = createHarness({
    callAfterStep(mutation) {
      mutation();
    },
    onDispose() {
      throw new Error('injected post-disposal observer failure');
    },
  });
  const bomb = harness.registry.applySpawnPlan(
    bombPlan(35),
    harness.parent as never,
    VIEWPORT,
  ) as InstanceType<typeof ClassicGeneratedBomb>;

  assert.equal(harness.registry.hasTarget(bomb.targetId), true);
  assert.equal(harness.registry.cut(bomb.targetId, SEGMENT), true);
  assert.throws(
    () => harness.registry.finishBombAfterHit(bomb.targetId),
    /injected post-disposal observer failure/,
  );
  assert.equal(harness.registry.hasTarget(bomb.targetId), false);
  assert.equal(harness.registry.size, 0);
  assert.equal(bomb.disposalQueued, true);
  assert.equal(harness.disposals[0]?.reason, 'after-bomb-hit');
});

test('full-ray batches repeat fruit fixture cuts, keep bombs one-shot, and always drain', () => {
  const harness = createHarness();
  const ordinary = harness.registry.applySpawnPlan(
    ordinaryPlan(3, 40),
    harness.parent as never,
    VIEWPORT,
  );
  const special = harness.registry.applySpawnPlan(
    downSpecialPlan(13, 41),
    harness.parent as never,
    VIEWPORT,
  );
  const bomb = harness.registry.applySpawnPlan(
    bombPlan(42),
    harness.parent as never,
    VIEWPORT,
  );

  assert.throws(() => harness.registry.runRayQueryCutBatch(() => {
    assert.equal(harness.registry.cut(ordinary.targetId, SEGMENT), true);
    assert.equal(harness.registry.cut(ordinary.targetId, SEGMENT), true);
    assert.equal(harness.registry.cut(special.targetId, SEGMENT), true);
    assert.equal(harness.registry.cut(special.targetId, SEGMENT), true);
    assert.equal(harness.registry.cut(bomb.targetId, SEGMENT), true);
    assert.equal(harness.registry.cut(bomb.targetId, SEGMENT), false);
    assert.throws(
      () => harness.registry.runRayQueryCutBatch(() => undefined),
      /cannot be nested/,
    );
    throw new Error('ray callback failed');
  }), /ray callback failed/);

  assert.equal(harness.cuts.length, 4);
  assert.equal(harness.bombCuts.length, 1);
  assert.equal(harness.deferred.length, 2);
  assert.equal(ordinary.cutDisabled, true);
  assert.equal(special.cutDisabled, true);
  assert.equal(harness.registry.finishBombAfterHit(bomb.targetId), true);
  assert.equal(harness.deferred.length, 3);
  flushDeferred(harness);
  assert.equal(harness.registry.size, 0);
});

test('ray-query finalization best-effort drains every fruit and aggregates callback plus finalizer failures', () => {
  const harness = createHarness();
  const ordinary = harness.registry.applySpawnPlan(
    ordinaryPlan(4, 43),
    harness.parent as never,
    VIEWPORT,
  );
  const special = harness.registry.applySpawnPlan(
    downSpecialPlan(14, 44),
    harness.parent as never,
    VIEWPORT,
  );
  const ordinaryComplete = ordinary.completeRayQueryCuts.bind(ordinary);
  const specialComplete = special.completeRayQueryCuts.bind(special);
  const finalized: string[] = [];
  (ordinary as unknown as { completeRayQueryCuts(): void }).completeRayQueryCuts = () => {
    finalized.push('ordinary');
    throw new Error('ordinary finalizer failed');
  };
  (special as unknown as { completeRayQueryCuts(): void }).completeRayQueryCuts = () => {
    finalized.push('special');
    throw new Error('special finalizer failed');
  };

  assert.throws(
    () => harness.registry.runRayQueryCutBatch(() => {
      assert.equal(harness.registry.cut(ordinary.targetId, SEGMENT), true);
      assert.equal(harness.registry.cut(special.targetId, SEGMENT), true);
      throw new Error('ray execution failed');
    }),
    (error: unknown) => {
      assert.equal(error instanceof CrazyEntityDrainError, true);
      const aggregate = error as InstanceType<typeof CrazyEntityDrainError>;
      assert.equal(aggregate.operation, 'ray-query-finalization');
      assert.deepEqual(
        aggregate.failures.map(({ occurrenceKey, phase }) => ({
          occurrenceKey,
          phase,
        })),
        [
          { occurrenceKey: null, phase: 'execute' },
          { occurrenceKey: 'shared-planner:43', phase: 'finalize' },
          { occurrenceKey: 'shared-planner:44', phase: 'finalize' },
        ],
      );
      return true;
    },
  );
  assert.deepEqual(finalized, ['ordinary', 'special']);
  assert.equal(harness.registry.size, 2);

  (ordinary as unknown as { completeRayQueryCuts(): void }).completeRayQueryCuts
    = ordinaryComplete;
  (special as unknown as { completeRayQueryCuts(): void }).completeRayQueryCuts
    = specialComplete;
  harness.registry.disposeAll();
  flushDeferred(harness);
  assert.equal(harness.registry.size, 0);
});

test('bounds evaluation keeps composite identity and applies fruit versus bomb lifecycles', () => {
  const harness = createHarness({
    sampleBonusKinematics() {
      return Object.freeze({
        angleRadians: 0,
        angularVelocityRadiansPerSecond: 3,
        direction: 1,
        positionMetres: Object.freeze({ x: 2, y: -9 }),
      });
    },
  });
  const ordinaryPlanBelow = ordinaryPlan(0, 50);
  const ordinaryCommands = ordinaryPlanBelow.commands.map((command) => (
    command.type === 'set-transform'
      ? Object.freeze({
          ...command,
          positionMetres: Object.freeze({ x: 1, y: -9 }),
        })
      : command
  ));
  const bombPlanBelow = bombPlan(51);
  const bombCommands = bombPlanBelow.commands.map((command) => (
    command.type === 'set-transform'
      ? Object.freeze({
          ...command,
          positionMetres: Object.freeze({ x: 1, y: -9 }),
        })
      : command
  ));
  harness.registry.applySpawnPlan(
    Object.freeze({
      entityOccurrenceId: 50,
      commands: Object.freeze(ordinaryCommands),
    }),
    harness.parent as never,
    VIEWPORT,
  );
  harness.registry.applySpawnPlan(
    Object.freeze({
      entityOccurrenceId: 51,
      commands: Object.freeze(bombCommands),
    }),
    harness.parent as never,
    VIEWPORT,
  );
  const bonus = harness.registry.applyBonusSpawnBatch(
    bonusBatch(12, 50, 'b5', false, 1),
    harness.parent as never,
    VIEWPORT,
  );
  bonus.body.linearVelocity = { x: 0, y: -1 } as never;
  const dragon = harness.registry.applySpawnPlan(
    dragonPlan(52, Object.freeze({ x: 1, y: -9 })),
    harness.parent as never,
    VIEWPORT,
  );
  dragon.body.linearVelocity = { x: 0, y: -1 } as never;

  const evaluations = harness.registry.evaluateBounds(VIEWPORT);
  assert.deepEqual(
    evaluations.map(({ kind, occurrenceKey, commands }) => ({
      kind,
      occurrenceKey,
      types: commands.map(({ type }) => type),
    })),
    [
      {
        kind: 'ordinary-fruit',
        occurrenceKey: 'shared-planner:50',
        types: ['fail', 'defer-dispose'],
      },
      {
        kind: 'bomb',
        occurrenceKey: 'shared-planner:51',
        types: ['defer-dispose'],
      },
      {
        kind: 'special-fruit',
        occurrenceKey: 'bonus:b5:50',
        types: ['fail', 'defer-dispose'],
      },
      {
        kind: 'dragon-fruit',
        occurrenceKey: 'shared-planner:52',
        types: ['fail', 'defer-dispose'],
      },
    ],
  );
  assert.equal(harness.misses.length, 2);
  assert.equal(harness.deferred.length, 4);
  assert.equal(harness.registry.size, 4);
  flushDeferred(harness);
  assert.equal(harness.registry.size, 0);
  assert.equal(harness.registry.activeDragonEffectCount, 0);
});

test('duplicate, partial, mixed, invalid Dragon, and misordered plans fail before allocation', () => {
  const harness = createHarness();
  harness.registry.applySpawnPlan(
    ordinaryPlan(0, 60),
    harness.parent as never,
    VIEWPORT,
  );
  const createdBefore = cc.Node.createdCount;
  const sampleCount = harness.samples.length;

  assert.throws(
    () => harness.registry.applySpawnPlan(
      ordinaryPlan(1, 60),
      harness.parent as never,
      VIEWPORT,
    ),
    /already registered/,
  );
  assert.throws(
    () => harness.registry.applyBonusSpawnBatch(
      bonusBatch(10, 1).slice(0, 3) as never,
      harness.parent as never,
      VIEWPORT,
    ),
    /exactly four or five/,
  );
  assert.throws(
    () => harness.registry.applyBonusSpawnBatch([
      ...bonusBatch(10, 2).slice(0, 2),
      ordinaryPlan(0, 2).commands.at(-1),
      bonusBatch(10, 2)[3],
    ] as never, harness.parent as never, VIEWPORT),
    /order must be/,
  );
  const misordered = ordinaryPlan(2, 61);
  assert.throws(
    () => harness.registry.applySpawnPlan(Object.freeze({
      entityOccurrenceId: 61,
      commands: Object.freeze([
        misordered.commands[0],
        misordered.commands[1],
        misordered.commands[3],
        misordered.commands[2],
        misordered.commands[4],
      ]),
    }) as never, harness.parent as never, VIEWPORT),
    /set angular velocity|end with/,
  );
  assert.throws(
    () => harness.registry.applySpawnPlan(Object.freeze({
      entityOccurrenceId: 62,
      commands: Object.freeze([
        Object.freeze({
          type: 'create-dragon-fruit',
          entityOccurrenceId: 62,
          tossType: 6,
        }),
        Object.freeze({
          type: 'set-transform',
          entityOccurrenceId: 62,
          positionMetres: Object.freeze({ x: 1, y: 2 }),
          angleRadians: 0,
        }),
        Object.freeze({
          type: 'set-linear-velocity',
          entityOccurrenceId: 62,
          metresPerSecond: Object.freeze({ x: 0, y: -1 }),
          reason: 'spawn-kinematics',
        }),
        Object.freeze({
          type: 'set-angular-velocity',
          entityOccurrenceId: 62,
          radiansPerSecond: 3,
        }),
        Object.freeze({
          type: 'attach-spawned-entity',
          entityOccurrenceId: 62,
          zOrder: 1,
        }),
      ]),
    }) as never, harness.parent as never, VIEWPORT),
    /Down DragonFruit/,
  );

  assert.equal(cc.Node.createdCount, createdBefore);
  assert.equal(harness.samples.length, sampleCount);
  assert.equal(harness.deferred.length, 0);
  assert.equal(harness.registry.size, 1);
  harness.registry.disposeAll();
  flushDeferred(harness);
});

test('Bonus audio failure after enable retains the committed attached entity and BonusManager boundary', () => {
  let entityAtEnable: CrazyGeneratedSpecialFruit | null = null;
  const harness = createHarness({
    onEnableBonus(_command, current) {
      entityAtEnable = current.registry.getBonusEntity('b5', 70);
    },
    onPlayBonusTossAudio() {
      throw new Error('audio presenter failed');
    },
  });

  assert.throws(
    () => harness.registry.applyBonusSpawnBatch(
      bonusBatch(10, 70, 'b5', true),
      harness.parent as never,
      VIEWPORT,
    ),
    /audio presenter failed/,
  );
  assert.notEqual(entityAtEnable, null);
  assert.equal(harness.enabled.length, 1);
  assert.equal(harness.bonusAudio.length, 1);
  assert.equal(harness.registry.size, 1);
  assert.equal(harness.registry.getBonusEntity('b5', 70), entityAtEnable);
  assert.equal(entityAtEnable?.node.parent, harness.parent);
  assert.equal(harness.deferred.length, 0);
  assert.equal(cc.isValid(entityAtEnable?.node), true);

  harness.registry.disposeAll();
  assert.equal(harness.deferred.length, 1);
  flushDeferred(harness);
  assert.equal(cc.isValid(entityAtEnable?.node), false);
  assert.deepEqual(harness.disposals, [{
    entityOccurrenceId: 70,
    reason: 'registry-dispose-all',
    targetId: 'crazy-special-fruit:bonus:b5:70',
  }]);
  assert.equal(harness.enabled.length, 1);
  assert.equal(harness.bonusAudio.length, 1);
});

test('disposeAll attempts every entity, aggregates scheduling failures, and leaves failures retryable', () => {
  let attempts = 0;
  let failScheduling = true;
  const harness = createHarness({
    callAfterStep(mutation, current) {
      attempts += 1;
      if (failScheduling && attempts <= 2) {
        throw new Error(`schedule ${attempts} failed`);
      }
      current.deferred.push(mutation);
    },
  });
  harness.registry.applySpawnPlan(
    ordinaryPlan(0, 71),
    harness.parent as never,
    VIEWPORT,
  );
  harness.registry.applySpawnPlan(
    bombPlan(72),
    harness.parent as never,
    VIEWPORT,
  );
  harness.registry.applyBonusSpawnBatch(
    bonusBatch(12, 73),
    harness.parent as never,
    VIEWPORT,
  );

  assert.throws(
    () => harness.registry.disposeAll(),
    (error: unknown) => {
      assert.equal(error instanceof CrazyEntityDrainError, true);
      const aggregate = error as InstanceType<typeof CrazyEntityDrainError>;
      assert.equal(aggregate.operation, 'dispose-all');
      assert.deepEqual(
        aggregate.failures.map(({ occurrenceKey, phase }) => ({
          occurrenceKey,
          phase,
        })),
        [
          { occurrenceKey: 'shared-planner:71', phase: 'queue-dispose' },
          { occurrenceKey: 'shared-planner:72', phase: 'queue-dispose' },
        ],
      );
      return true;
    },
  );
  assert.equal(attempts, 3);
  assert.equal(harness.deferred.length, 1);
  flushDeferred(harness);
  assert.equal(harness.registry.size, 2);

  failScheduling = false;
  harness.registry.disposeAll();
  assert.equal(attempts, 5);
  assert.equal(harness.deferred.length, 2);
  flushDeferred(harness);
  assert.equal(harness.registry.size, 0);
});

test('disposeAll removes an unfinished Dragon counter without completing gameplay or consuming RNG', () => {
  const harness = createHarness({
    dragonDraws: [0, 1],
    effectsEnabled: false,
  });
  const dragon = harness.registry.applySpawnPlan(
    dragonPlan(74),
    harness.parent as never,
    VIEWPORT,
  );
  harness.registry.cut(dragon.targetId, SEGMENT);
  const callsBeforeDispose = [...harness.dragonRandom.calls];

  harness.registry.disposeAll();
  assert.equal(harness.deferred.length, 1);
  assert.equal(harness.registry.size, 1);
  assert.equal(harness.registry.activeDragonEffectCount, 1);
  flushDeferred(harness);

  assert.equal(harness.registry.size, 0);
  assert.equal(harness.registry.activeDragonEffectCount, 0);
  assert.equal(dragon.stateSnapshot().finished, false);
  assert.equal(dragon.terminalPieces.length, 0);
  assert.equal(dragon.presentationSnapshot().counterText, null);
  assert.deepEqual(harness.dragonRandom.calls, callsBeforeDispose);
  assert.equal(harness.dragonFinishes.length, 0);
  assert.equal(harness.dragonObjectives.length, 0);
  assert.equal(harness.disposals[0]?.reason, 'registry-dispose-all');
});

test('disposeAll best-effort drains retained Dragon owners and converges after retry', () => {
  let failNextSchedule = false;
  const harness = createHarness({
    callAfterStep(mutation, current) {
      if (failNextSchedule) {
        failNextSchedule = false;
        throw new Error('retained cleanup schedule failed');
      }
      current.deferred.push(mutation);
    },
    dragonDraws: [0, 1, 0, 1],
    effectsEnabled: false,
  });
  const first = harness.registry.applySpawnPlan(
    dragonPlan(75),
    harness.parent as never,
    VIEWPORT,
  );
  const second = harness.registry.applySpawnPlan(
    dragonPlan(76),
    harness.parent as never,
    VIEWPORT,
  );
  harness.registry.cut(first.targetId, SEGMENT);
  harness.registry.cut(second.targetId, SEGMENT);
  harness.registry.updateDragonEffectsAction(
    CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS,
  );
  flushDeferred(harness);
  assert.equal(harness.registry.size, 0);
  assert.equal(harness.registry.activeDragonEffectCount, 2);
  const callsBeforeDispose = [...harness.dragonRandom.calls];

  failNextSchedule = true;
  assert.throws(
    () => harness.registry.disposeAll(),
    (error: unknown) => {
      assert.equal(error instanceof CrazyEntityDrainError, true);
      const aggregate = error as InstanceType<typeof CrazyEntityDrainError>;
      assert.deepEqual(
        aggregate.failures.map(({ occurrenceKey, phase }) => ({
          occurrenceKey,
          phase,
        })),
        [{
          occurrenceKey: 'shared-planner:75',
          phase: 'drain-dragon-effect',
        }],
      );
      return true;
    },
  );
  assert.equal(harness.deferred.length, 2);
  flushDeferred(harness);
  assert.equal(harness.registry.activeDragonEffectCount, 1);

  harness.registry.disposeAll();
  assert.equal(harness.deferred.length, 2);
  flushDeferred(harness);
  assert.equal(harness.registry.activeDragonEffectCount, 0);
  assert.deepEqual(harness.dragonRandom.calls, callsBeforeDispose);
});

test('sampler, Classic audio, or post-attach Bomb hook failure uses one rollback seam', () => {
  const sampleFailure = createHarness({
    sampleBonusKinematics() {
      throw new Error('kinematics failed');
    },
  });
  assert.throws(
    () => sampleFailure.registry.applyBonusSpawnBatch(
      bonusBatch(12, 80),
      sampleFailure.parent as never,
      VIEWPORT,
    ),
    /kinematics failed/,
  );
  assert.equal(sampleFailure.registry.size, 1);
  assert.equal(sampleFailure.enabled.length, 0);
  assert.equal(sampleFailure.deferred.length, 1);
  flushDeferred(sampleFailure);
  assert.equal(sampleFailure.registry.size, 0);
  assert.equal(sampleFailure.disposals[0]?.reason, 'spawn-failed');

  const audioFailure = createHarness({
    onPlayTossSound() {
      throw new Error('classic toss audio failed');
    },
  });
  assert.throws(
    () => audioFailure.registry.applySpawnPlan(
      bombPlan(81, true),
      audioFailure.parent as never,
      VIEWPORT,
    ),
    /classic toss audio failed/,
  );
  assert.equal(audioFailure.registry.size, 1);
  assert.equal(audioFailure.deferred.length, 1);
  flushDeferred(audioFailure);
  assert.equal(audioFailure.registry.size, 0);
  assert.equal(audioFailure.disposals[0]?.reason, 'spawn-failed');

  const attachedHookFailure = createHarness({
    onStandardBombAttached(bomb, current) {
      assert.equal(bomb.node.parent, current.parent);
      assert.equal(bomb.node.activeInHierarchy, true);
      throw new Error('post-attach Bomb effects failed');
    },
  });
  assert.throws(
    () => attachedHookFailure.registry.applySpawnPlan(
      bombPlan(82, true),
      attachedHookFailure.parent as never,
      VIEWPORT,
    ),
    /post-attach Bomb effects failed/,
  );
  assert.deepEqual(attachedHookFailure.events, [
    'toss-audio',
    'bomb-attached',
  ]);
  assert.equal(attachedHookFailure.registry.size, 1);
  assert.equal(attachedHookFailure.deferred.length, 1);
  flushDeferred(attachedHookFailure);
  assert.equal(attachedHookFailure.registry.size, 0);
  assert.equal(attachedHookFailure.disposals[0]?.reason, 'spawn-failed');
});

test('spawn rollback scheduling failure retains registry ownership for disposeAll retry', () => {
  let failNextSchedule = true;
  const harness = createHarness({
    callAfterStep(mutation, current) {
      if (failNextSchedule) {
        failNextSchedule = false;
        throw new Error('rollback schedule failed');
      }
      current.deferred.push(mutation);
    },
    onPlayTossSound() {
      throw new Error('spawn audio failed');
    },
  });

  assert.throws(
    () => harness.registry.applySpawnPlan(
      bombPlan(83, true),
      harness.parent as never,
      VIEWPORT,
    ),
    (error: unknown) => {
      assert.equal(error instanceof CrazySpawnRollbackError, true);
      const rollback = error as InstanceType<typeof CrazySpawnRollbackError>;
      assert.match(String(rollback.spawnError), /spawn audio failed/);
      assert.match(String(rollback.cleanupError), /rollback schedule failed/);
      return true;
    },
  );
  assert.equal(harness.registry.size, 1);
  assert.equal(harness.deferred.length, 0);

  harness.registry.disposeAll();
  assert.equal(harness.registry.size, 1);
  assert.equal(harness.deferred.length, 1);
  flushDeferred(harness);
  assert.equal(harness.registry.size, 0);
  assert.equal(harness.disposals[0]?.reason, 'registry-dispose-all');
});

test('Dragon attach failure rolls back collider and effect ownership through the deferred seam', () => {
  const harness = createHarness();
  harness.parent.active = false;

  assert.throws(
    () => harness.registry.applySpawnPlan(
      dragonPlan(82),
      harness.parent as never,
      VIEWPORT,
    ),
    /parent must be active/,
  );
  assert.equal(harness.registry.size, 1);
  assert.equal(harness.registry.activeDragonEffectCount, 1);
  assert.equal(harness.deferred.length, 1);
  flushDeferred(harness);
  assert.equal(harness.registry.size, 0);
  assert.equal(harness.registry.activeDragonEffectCount, 0);
  assert.equal(harness.disposals[0]?.reason, 'spawn-failed');
  assert.equal(harness.dragonRandom.calls.length, 0);
});
