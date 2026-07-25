import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const createdNodes = [];
export const runtimeFaults = {
  failNodeConstructionName: null,
  failClassicAttachAfterParent: false,
  failPhysicsRegistration: false,
};

export class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
}

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
}

export class Size {
  constructor(width = 0, height = 0) { this.width = width; this.height = height; }
}

function vector3(valueOrX = 0, y = 0, z = 0) {
  if (valueOrX !== null && typeof valueOrX === 'object') {
    return new Vec3(valueOrX.x ?? 0, valueOrX.y ?? 0, valueOrX.z ?? 0);
  }
  return new Vec3(valueOrX, y, z);
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
  constructor(width = 0, height = 0) {
    this.destroyed = false;
    this.originalSize = new Size(width, height);
    this.rect = { width, height };
    this.texture = Object.freeze({ width, height });
    this.uv = [0, 1, 1, 1, 0, 0, 1, 0];
  }
}

export class Material {
  constructor() { this.destroyed = false; this.properties = {}; }
  reset(options) { this.resetOptions = options; }
  setProperty(name, value) { this.properties[name] = value; }
  destroy() { this.destroyed = true; }
}

export class Mesh {
  constructor(name = '') {
    this.destroyed = false;
    this.name = name;
    this.renderingSubMeshes = [];
  }
  reset(options) {
    this.data = options.data;
    this.resetOptions = options;
    this.struct = options.struct;
    this.renderingSubMeshes = [{
      drawInfo: { vertexCount: 0 },
      invalidateGeometricInfo() {},
      vertexBuffers: [{ update() {} }],
    }];
  }
  initialize() {}
  destroy() { this.destroyed = true; }
}

export class MeshRenderer {
  constructor() { this.mesh = null; this.sharedMaterials = []; }
  setSharedMaterial(material, index) { this.sharedMaterials[index] = material; }
  onGeometryChanged() {}
}

export class UIMeshRenderer {}

export const gfx = Object.freeze({
  Attribute: class Attribute {
    constructor(name, format, normalized = false) {
      this.name = name; this.format = format; this.normalized = normalized;
    }
  },
  AttributeName: Object.freeze({
    ATTR_COLOR: 'ATTR_COLOR',
    ATTR_POSITION: 'ATTR_POSITION',
    ATTR_TEX_COORD: 'ATTR_TEX_COORD',
  }),
  Format: Object.freeze({ RG32F: 'RG32F', RGBA8: 'RGBA8' }),
  PrimitiveMode: Object.freeze({ TRIANGLE_STRIP: 'TRIANGLE_STRIP' }),
});

export class UITransform {
  constructor() {
    this.anchorPoint = new Vec2();
    this.contentSize = new Size();
  }
  setAnchorPoint(x, y) { this.anchorPoint = new Vec2(x, y); }
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

export class UIOpacity {
  constructor() { this.opacity = 255; }
}

export class Label {
  constructor() {
    this.color = new Color(255, 255, 255, 255);
    this.font = null;
    this.fontSize = 40;
    this.lineHeight = 40;
    this.string = '';
  }
}

export class Graphics {
  constructor() {
    this.fillColor = new Color();
    this.rects = [];
  }
  rect(x, y, width, height) { this.rects.push({ x, y, width, height }); }
  fill() {}
}

export class Mask {
  constructor() { this.inverted = false; this.type = 0; }
}

export class AudioClip {}
export class AudioSource {
  constructor() {
    this.clip = null;
    this.loop = false;
    this.playOnAwake = false;
    this.volume = 1;
  }
  play() {}
  playOneShot() {}
  stop() {}
}
export class AssetManager {}

export class RigidBody2D {
  constructor() {
    this.angularVelocity = 0;
    this.linearVelocity = new Vec2();
  }
  applyLinearImpulseToCenter() {}
  getMass() { return 1; }
}

export class Collider2D {}
export class BoxCollider2D extends Collider2D {}
export class CircleCollider2D extends Collider2D {}
export const ERigidBody2DType = Object.freeze({ Dynamic: 2 });

export class Node {
  constructor(name = '') {
    if (runtimeFaults.failNodeConstructionName === name) {
      throw new Error('Injected node construction failure: ' + name);
    }
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyed = false;
    this.events = new Map();
    this.lastRequestedSiblingIndex = null;
    this.layer = 0;
    this.name = name;
    this.parent = null;
    this.position = new Vec3();
    this.rotation = new Vec3();
    this.scale = new Vec3(1, 1, 1);
    createdNodes.push(this);
  }
  get activeInHierarchy() {
    if (!this.active) return false;
    if (this.parent === null) return this.name === 'Canvas';
    return this.parent.activeInHierarchy;
  }
  get worldPosition() {
    if (this.parent === null) return vector3(this.position);
    const parent = this.parent.worldPosition;
    return new Vec3(
      parent.x + this.position.x,
      parent.y + this.position.y,
      parent.z + this.position.z,
    );
  }
  get worldRotation() { return vector3(this.rotation); }
  get worldScale() { return vector3(this.scale); }
  addChild(child) { child.setParent(this); }
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
  setPosition(valueOrX, y, z) { this.position = vector3(valueOrX, y, z); }
  setScale(valueOrX, y, z) { this.scale = vector3(valueOrX, y, z); }
  setRotationFromEuler(valueOrX, y, z) { this.rotation = vector3(valueOrX, y, z); }
  setWorldPosition(valueOrX, y, z) {
    const requested = vector3(valueOrX, y, z);
    const parent = this.parent === null ? new Vec3() : this.parent.worldPosition;
    this.position = new Vec3(
      requested.x - parent.x,
      requested.y - parent.y,
      requested.z - parent.z,
    );
  }
  setWorldRotation(valueOrX, y, z) { this.rotation = vector3(valueOrX, y, z); }
  setWorldScale(valueOrX, y, z) { this.scale = vector3(valueOrX, y, z); }
  setParent(parent, keepWorldTransform = false) {
    const world = this.worldPosition;
    if (this.parent !== null) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
    if (keepWorldTransform) this.setWorldPosition(world);
    if (
      runtimeFaults.failClassicAttachAfterParent
      && this.name === 'ClassicModeRoot'
      && parent !== null
    ) {
      throw new Error('Injected ClassicModeRoot post-parent attachment failure');
    }
  }
  removeFromParent() { this.setParent(null); }
  setSiblingIndex(index) {
    this.lastRequestedSiblingIndex = index;
    if (this.parent === null) return;
    const current = this.parent.children.indexOf(this);
    if (current >= 0) this.parent.children.splice(current, 1);
    const bounded = Math.max(0, Math.min(index, this.parent.children.length));
    this.parent.children.splice(bounded, 0, this);
  }
  on(type, callback, target) {
    const listeners = this.events.get(type) ?? [];
    listeners.push({ callback, target });
    this.events.set(type, listeners);
  }
  off(type, callback, target) {
    const listeners = this.events.get(type) ?? [];
    this.events.set(type, listeners.filter((listener) => (
      listener.callback !== callback || listener.target !== target
    )));
  }
  emit(type, ...args) {
    for (const listener of [...(this.events.get(type) ?? [])]) {
      listener.callback.apply(listener.target, args);
    }
  }
  destroy() {
    if (this.destroyed) return;
    for (const child of [...this.children]) child.destroy();
    this.destroyed = true;
    this.active = false;
    this.events.clear();
  }
}
Node.EventType = Object.freeze({
  TOUCH_CANCEL: 'touch-cancel',
  TOUCH_END: 'touch-end',
  TOUCH_START: 'touch-start',
});

export function isValid(value) {
  return value !== null && value !== undefined && value.destroyed !== true;
}

export class Component {
  constructor() {
    this.node = null;
    this.scheduledCallbacks = [];
  }
  getComponent(Type) { return this.node?.getComponent(Type) ?? null; }
  scheduleOnce(callback, delaySeconds) {
    this.scheduledCallbacks.push({ callback, delaySeconds });
  }
  unschedule(callback) {
    this.scheduledCallbacks = this.scheduledCallbacks.filter(
      (scheduled) => scheduled.callback !== callback,
    );
  }
}

export const _decorator = Object.freeze({
  ccclass() { return (value) => value; },
  requireComponent() { return (value) => value; },
});

export class EventTouch {}
export const Input = Object.freeze({
  EventType: Object.freeze({
    TOUCH_CANCEL: 'touch-cancel',
    TOUCH_END: 'touch-end',
    TOUCH_MOVE: 'touch-move',
    TOUCH_START: 'touch-start',
  }),
});
export const input = Object.freeze({ on() {}, off() {} });

export const Game = Object.freeze({ EVENT_HIDE: 'game-hide' });
export const game = Object.freeze({ on() {}, off() {} });

export class Tween {
  static stopAllByTarget() {}
}
export function tween() {
  const chain = {
    call() { return chain; },
    delay() { return chain; },
    start() { return chain; },
    to() { return chain; },
  };
  return chain;
}

export const ResolutionPolicy = Object.freeze({ SHOW_ALL: 2 });
export const screen = Object.freeze({ windowSize: Object.freeze({ width: 720, height: 1280 }) });
export const view = Object.freeze({
  convertToLocationInView(x, y) { return new Vec2(x, y); },
  getVisibleOrigin() { return new Vec2(0, 0); },
  getVisibleSize() { return new Size(720, 1280); },
  setDesignResolutionSize() {},
});

const localValues = new Map();
export const sys = Object.freeze({
  localStorage: Object.freeze({
    getItem(key) { return localValues.get(key) ?? null; },
    setItem(key, value) { localValues.set(key, value); },
  }),
});

export const assetManager = Object.freeze({
  getBundle() { return null; },
  loadBundle(_name, callback) { callback(new Error('not available in retry harness')); },
});

export const Director = Object.freeze({
  EVENT_AFTER_PHYSICS: 'after-physics',
  EVENT_BEFORE_PHYSICS: 'before-physics',
});
export const ERaycast2DType = Object.freeze({ All: 0 });
export class System {}
export const SystemPriority = Object.freeze({ LOW: 100 });

const systems = new Map();
export const director = {
  emit() {},
  getSystem(id) { return systems.get(id) ?? null; },
  pause() {},
  registerSystem(id, system) {
    if (runtimeFaults.failPhysicsRegistration) {
      throw new Error('Injected physics registration failure');
    }
    systems.set(id, system);
  },
  unregisterSystem(system) {
    for (const [id, registered] of systems) {
      if (registered === system) systems.delete(id);
    }
  },
  resume() {},
};

export const physicsRuntime = {
  allowSleep: false,
  autoSimulation: true,
  collisionMatrix: { '1': 0x1234, '2': 0x5678 },
  debugDrawFlags: 0,
  enable: true,
  gravity: new Vec2(9, -10),
  physicsWorld: {
    drawDebug() {},
    syncPhysicsToScene() {},
    syncSceneToPhysics() {},
  },
  positionIterations: 3,
  resetAccumulatorCalls: 0,
  velocityIterations: 4,
  raycast() { return []; },
  resetAccumulator() { this.resetAccumulatorCalls += 1; },
  step() {},
};

export class PhysicsSystem2D {}
PhysicsSystem2D.instance = physicsRuntime;

export function resetRuntime() {
  createdNodes.length = 0;
  runtimeFaults.failNodeConstructionName = null;
  runtimeFaults.failClassicAttachAfterParent = false;
  runtimeFaults.failPhysicsRegistration = false;
  systems.clear();
  physicsRuntime.allowSleep = false;
  physicsRuntime.autoSimulation = true;
  physicsRuntime.collisionMatrix = { '1': 0x1234, '2': 0x5678 };
  physicsRuntime.debugDrawFlags = 0;
  physicsRuntime.enable = true;
  physicsRuntime.gravity = new Vec2(9, -10);
  physicsRuntime.positionIterations = 3;
  physicsRuntime.resetAccumulatorCalls = 0;
  physicsRuntime.velocityIterations = 4;
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
  load(url, context, nextLoad) {
    if (url.endsWith('.ts') && url.includes('/game/assets/scripts/')) {
      const fileName = fileURLToPath(url);
      const source = readFileSync(fileName, 'utf8');
      return {
        format: 'module',
        shortCircuit: true,
        source: transpileGameTypeScript(source, fileName),
      };
    }
    return nextLoad(url, context);
  },
});

function transpileGameTypeScript(source: string, fileName: string): string {
  // Node can transform the TypeScript used by these modules, but its JavaScript parser does
  // not yet accept Creator's legacy class decorators. They carry editor metadata only; remove
  // those two declarations while leaving every executable controller member unchanged.
  const withoutCreatorDecorators = source.replace(
    /^\s*@(ccclass|requireComponent)\([^\n]*\)\s*$/gm,
    '',
  );
  return stripTypeScriptTypes(withoutCreatorDecorators, {
    mode: 'transform',
    sourceUrl: fileName,
  });
}

const cc = await import('cc') as unknown as CocosRuntime;
const {
  CLASSIC_RESULT_MENU_REQUESTED_EVENT,
  CLASSIC_RESULT_RETRY_FAILED_EVENT,
  ClassicGameplayController,
} = await import('../../../game/assets/scripts/creator/classic-gameplay-controller.ts');
const { ClassicBladePresenter } = await import(
  '../../../game/assets/scripts/creator/classic-blade-presenter.ts'
);
const { ClassicSceneController } = await import(
  '../../../game/assets/scripts/creator/classic-scene-controller.ts'
);
const { BladeInputController } = await import(
  '../../../game/assets/scripts/creator/blade-input-controller.ts'
);
const {
  CLASSIC_SCORE_HUD_FONT_RESOURCE,
  getClassicDefaultBladeResource,
  getClassicPresentationResources,
} = await import('../../../game/assets/scripts/domain/classic-resource-contract.ts');
const {
  BASE_GAMEPLAY_ARIAL_FONT_RESOURCE,
  getBaseGameplayResourceProfile,
} = await import('../../../game/assets/scripts/domain/base-gameplay-resource-contract.ts');
const { ClassicSpawnPlanner } = await import(
  '../../../game/assets/scripts/domain/classic-spawn-planner.ts'
);
const { ClassicSwishAudioGate } = await import(
  '../../../game/assets/scripts/domain/classic-swish-audio-gate.ts'
);
const { ComboService } = await import(
  '../../../game/assets/scripts/domain/combo-service.ts'
);
const { FailService } = await import(
  '../../../game/assets/scripts/domain/fail-service.ts'
);
const { ScoreService } = await import(
  '../../../game/assets/scripts/domain/score-service.ts'
);
const { sampleSpawnKinematics } = await import(
  '../../../game/assets/scripts/domain/spawn-kinematics.ts'
);

interface StubNode {
  readonly active: boolean;
  readonly children: StubNode[];
  readonly destroyed: boolean;
  readonly lastRequestedSiblingIndex: number | null;
  readonly name: string;
  readonly parent: StubNode | null;
  addComponent<T>(Type: new () => T): T;
  on(type: string, callback: (...args: unknown[]) => void, target?: unknown): void;
  setParent(parent: StubNode | null, keepWorldTransform?: boolean): void;
  setSiblingIndex(index: number): void;
}

interface PhysicsRuntime {
  readonly collisionMatrix: Readonly<Record<string, number>>;
  readonly gravity: Readonly<{ x: number; y: number }>;
  readonly allowSleep: boolean;
  readonly autoSimulation: boolean;
  readonly enable: boolean;
  readonly positionIterations: number;
  readonly velocityIterations: number;
}

interface CocosRuntime {
  readonly Font: new () => { destroyed: boolean };
  readonly Node: new (name?: string) => StubNode;
  readonly SpriteFrame: new (width?: number, height?: number) => unknown;
  readonly createdNodes: StubNode[];
  readonly director: { getSystem(id: string): unknown };
  readonly physicsRuntime: PhysicsRuntime;
  readonly resetRuntime: () => void;
  readonly runtimeFaults: {
    failClassicAttachAfterParent: boolean;
    failNodeConstructionName: string | null;
    failPhysicsRegistration: boolean;
  };
}

interface PersistenceCounters {
  award: number;
  record: number;
  save: number;
}

interface SettingsRuntimeProbe {
  readonly loadFailure: null;
  readonly state: {
    readonly snapshot: Readonly<{
      effectsEnabled: boolean;
      leaderboard: Readonly<{ first: number; second: number; third: number }>;
      selectedBlade: number;
      totalCoins: number;
    }>;
    awardClassicResultCoins(score: number): unknown;
    recordClassicResultScore(score: number): unknown;
  };
  save(): void;
}

interface ResultPresenterProbe {
  disposed: boolean;
  navigation: 'menu' | 'none' | 'retry';
  rearmCalls: number;
  successfulRearms: number;
  throwOnDispose: boolean;
  readonly state: Readonly<{ navigation: 'menu' | 'none' | 'retry' }>;
  dispose(): boolean;
  rearmNavigationAfterFailure(route: 'menu' | 'retry'): boolean;
}

interface AudioProbe {
  readonly played: string[];
  playOneShot(path: string): void;
}

interface RetryFixture {
  readonly audio: AudioProbe;
  readonly baseline: RetryBaseline;
  readonly bladeInput: InstanceType<typeof BladeInputController>;
  readonly canvas: StubNode;
  readonly gameplay: InstanceType<typeof ClassicGameplayController>;
  readonly placement: ScreenPlacementProbe;
  readonly persistence: PersistenceCounters;
  readonly random: CountingRandom;
  readonly resultPresenter: ResultPresenterProbe;
  readonly resultRoot: StubNode;
  readonly retryFailures: ReadonlyArray<Readonly<{ message: string; reason: string }>>;
  readonly scene: InstanceType<typeof ClassicSceneController>;
  readonly sharedRoots: readonly [StubNode, StubNode, StubNode];
}

interface ResultMenuTransitionToken {
  readonly completedRunScore: number;
  readonly resultRoot: StubNode;
  commit(previousRoot: StubNode): void;
  rollback(): void;
}

interface RetryBaseline {
  readonly combo: object;
  readonly comboSnapshot: unknown;
  readonly fail: object;
  readonly failSnapshot: unknown;
  readonly gameplaySnapshot: unknown;
  readonly persistence: Readonly<PersistenceCounters>;
  readonly physics: unknown;
  readonly planner: object;
  readonly plannerNextEntityOccurrenceId: number;
  readonly randomDraws: number;
  readonly sceneSession: object;
  readonly sceneSessionSnapshot: unknown;
  readonly sceneWorldSpeed: object;
  readonly sceneWorldSpeedSnapshot: unknown;
  readonly score: object;
  readonly scoreSnapshot: unknown;
  readonly swishAudio: object;
  readonly swishLocked: boolean;
}

class CountingRandom {
  draws = 0;

  nextRawNonNegativeInt(): number {
    this.draws += 1;
    return 7;
  }

  nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number {
    const span = maximumInclusive - minimumInclusive + 1;
    return minimumInclusive + (this.nextRawNonNegativeInt() % span);
  }

  nextDecile(): number {
    return (this.nextRawNonNegativeInt() % 10) / 10;
  }
}

class ScreenPlacementProbe {
  currentScreen: StubNode | null = null;
  failNextAttachAfterParent = false;
  private readonly parent: StubNode;
  private readonly sharedRoots: readonly [StubNode, StubNode, StubNode];

  constructor(
    parent: StubNode,
    sharedRoots: readonly [StubNode, StubNode, StubNode],
  ) {
    this.parent = parent;
    this.sharedRoots = sharedRoots;
    this.assertSharedOrder();
  }

  attachCurrentScreen(screen: StubNode): void {
    if (this.currentScreen !== null) {
      throw new Error('Current-screen host already owns a screen');
    }
    if (screen.parent !== null) {
      throw new Error('Current screen must be detached before attachment');
    }

    try {
      screen.setParent(this.parent, true);
      if (this.failNextAttachAfterParent) {
        this.failNextAttachAfterParent = false;
        throw new Error('Injected current-screen attachment failure');
      }
      screen.setSiblingIndex(3);
      if (this.parent.children[3] !== screen) {
        throw new Error('Current screen did not occupy shared physical slot 3');
      }
      this.currentScreen = screen;
      this.assertSharedOrder();
    } catch (error) {
      if (screen.parent === this.parent) {
        screen.setParent(null, true);
      }
      this.currentScreen = null;
      this.assertSharedOrder();
      throw error;
    }
  }

  detachCurrentScreen(expectedScreen?: StubNode): StubNode {
    const current = this.currentScreen;
    if (current === null) {
      throw new Error('Current-screen host is already empty');
    }
    if (expectedScreen !== undefined && current !== expectedScreen) {
      throw new Error('Current-screen identity did not match the expected screen');
    }
    current.setParent(null, true);
    this.currentScreen = null;
    this.assertSharedOrder();
    return current;
  }

  replaceCurrentScreen(nextScreen: StubNode): StubNode {
    const previous = this.detachCurrentScreen();
    try {
      this.attachCurrentScreen(nextScreen);
      return previous;
    } catch (error) {
      this.attachCurrentScreen(previous);
      throw error;
    }
  }

  assertSharedOrder(): void {
    assert.deepEqual(this.parent.children.slice(0, 3), this.sharedRoots);
    for (const root of this.sharedRoots) {
      assert.equal(root.parent, this.parent);
    }
    if (this.currentScreen !== null) {
      assert.equal(this.parent.children[3], this.currentScreen);
      assert.equal(this.currentScreen.parent, this.parent);
    }
  }
}

test('runtime preparation deduplicates concurrent callers and guards shared owners', async () => {
  cc.resetRuntime();
  const canvas = new cc.Node('Canvas');
  addComponent(canvas, BladeInputController);
  const scene = addComponent(canvas, ClassicSceneController);
  scene.onLoad();
  scene.prepareSceneResolution();
  const gameplay = addComponent(canvas, ClassicGameplayController);
  gameplay.onLoad();

  assert.throws(() => gameplay.sharedAudioPresenter, /unavailable before preparation/);
  assert.throws(() => gameplay.sharedResourceCatalog, /unavailable before preparation/);

  const resources = createResourceCatalog();
  const audio = {
    played: [] as string[],
    stopCalls: 0,
    playOneShot(path: string) { this.played.push(path); },
    stop() { this.stopCalls += 1; },
  };
  let releasePreparation: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    releasePreparation = resolve;
  });
  let initializationCalls = 0;
  setPrivate(gameplay, 'initializeRecoveredResources', async () => {
    initializationCalls += 1;
    await gate;
    setPrivate(gameplay, 'resourceCatalog', resources);
    setPrivate(gameplay, 'audioPresenter', audio);
  });

  const first = gameplay.prepareRecoveredRuntime();
  const second = gameplay.prepareRecoveredRuntime();
  assert.equal(first, second);
  assert.equal(initializationCalls, 1);
  releasePreparation();
  await first;

  assert.equal(gameplay.sharedAudioPresenter, audio);
  assert.equal(gameplay.sharedResourceCatalog, resources);
  gameplay.onDestroy();
  assert.equal(audio.stopCalls, 1);
  assert.throws(() => gameplay.sharedAudioPresenter, /after teardown/);
  assert.throws(() => gameplay.sharedResourceCatalog, /after teardown/);
});

test('runtime teardown attempts every owner cleanup and clears shared ownership after failures', () => {
  cc.resetRuntime();
  const canvas = new cc.Node('Canvas');
  const gameplay = addComponent(canvas, ClassicGameplayController);
  const resources = createResourceCatalog();
  const preparation = Promise.resolve();
  const placement = Object.freeze({ currentScreen: null });
  const attempts: string[] = [];
  const audio = {
    stop() {
      attempts.push('audio');
      throw new Error('Injected audio cleanup failure');
    },
  };

  setPrivate(gameplay, 'resourceCatalog', resources);
  setPrivate(gameplay, 'audioPresenter', audio);
  setPrivate(gameplay, 'recoveredRuntimePreparation', preparation);
  setPrivate(gameplay, 'screenPlacement', placement);
  setPrivate(gameplay, 'disposeClassicModePresentation', () => {
    attempts.push('classic');
    throw new Error('Injected Classic presentation cleanup failure');
  });
  setPrivate(gameplay, 'disposeResultPresentation', () => {
    attempts.push('result');
    throw new Error('Injected Result presentation cleanup failure');
  });

  assert.throws(
    () => gameplay.onDestroy(),
    /Classic recovered runtime teardown failed: Injected Classic presentation cleanup failure; Injected Result presentation cleanup failure; Injected audio cleanup failure/,
  );

  assert.deepEqual(attempts, ['classic', 'result', 'audio']);
  assert.equal(getPrivate(gameplay, 'shuttingDown'), true);
  assert.equal(getPrivate(gameplay, 'audioPresenter'), null);
  assert.equal(getPrivate(gameplay, 'resourceCatalog'), null);
  assert.equal(getPrivate(gameplay, 'recoveredRuntimePreparation'), null);
  assert.equal(getPrivate(gameplay, 'screenPlacement'), null);
  assert.throws(() => gameplay.sharedAudioPresenter, /after teardown/);
  assert.throws(() => gameplay.sharedResourceCatalog, /after teardown/);
});

test('committed Classic Result latches a failing objective tail without replay', () => {
  cc.resetRuntime();
  const canvas = new cc.Node('Canvas');
  const gameplay = addComponent(canvas, ClassicGameplayController);
  const calls: Array<readonly [number, number]> = [];
  setPrivate(gameplay, 'objectivesManager', {
    processGameEvent(selector: number, completedScore: number) {
      calls.push(Object.freeze([selector, completedScore]));
      throw new Error('Injected Classic objective storage failure');
    },
  });

  const errors: Error[] = [];
  const originalConsoleError = console.error;
  console.error = (value?: unknown) => {
    errors.push(value instanceof Error ? value : new Error(String(value)));
  };
  try {
    invokePrivate<void>(
      gameplay,
      'dispatchRecoveredResultObjectiveTail',
      0,
      321,
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(calls, [Object.freeze([1, 321])]);
  assert.equal(getPrivate(gameplay, 'resultObjectiveTailAttempted'), true);
  assert.match(
    errors[0]?.message ?? '',
    /Classic Result committed with objective-tail failure: Injected Classic objective storage failure/,
  );
  assert.throws(
    () => invokePrivate<void>(
      gameplay,
      'dispatchRecoveredResultObjectiveTail',
      0,
      321,
    ),
    /Classic Result objective tail can be attempted only once per run/,
  );
  assert.deepEqual(calls, [Object.freeze([1, 321])]);
});

test('blade ownership reconciles when resource loading finishes during an active touch', () => {
  cc.resetRuntime();
  const canvas = new cc.Node('Canvas');
  const gameplay = addComponent(canvas, ClassicGameplayController);
  const classicRoot = new cc.Node('ClassicModeRoot');
  classicRoot.setParent(canvas);
  setPrivate(gameplay, 'classicModeRoot', classicRoot);
  setPrivate(gameplay, 'screenPlacement', { currentScreen: classicRoot });

  invokePrivate<void>(gameplay, 'onBladeBegan', {
    point: { x: 1, y: 2 },
    slot: 0,
    touchId: 41,
  });

  const presenter = createAttachedBladePresenter(classicRoot as never);
  setPrivate(gameplay, 'bladePresenter', presenter);
  invokePrivate<void>(gameplay, 'onBladeMoved', {
    segment: {
      current: { x: 10, y: 20 },
      previous: { x: 1, y: 2 },
      slot: 0,
      touchId: 41,
    },
    shouldPlaySwish: false,
  });

  assert.equal(presenter.snapshot()[0]?.claimed, true);
  assert.equal(presenter.snapshot()[0]?.state, 0);
  assert.deepEqual(presenter.snapshot()[0]?.points, [{ x: 10, y: 20 }]);

  invokePrivate<void>(gameplay, 'onBladeEnded', {
    cancelled: false,
    slot: 0,
    touchId: 41,
  });
  assert.equal(presenter.snapshot()[0]?.claimed, false);
  assert.equal(presenter.snapshot()[0]?.state, 4);
});

test('app-shell reentry rolls back scene and leaves the host empty when presentation reporting fails', () => {
  const fixture = createRetryFixture();
  fixture.placement.detachCurrentScreen(fixture.resultRoot);
  fixture.resultPresenter.dispose();
  setPrivate(fixture.gameplay, 'resultPresentationRoot', null);
  setPrivate(fixture.gameplay, 'resultPresenter', null);
  setPrivate(fixture.gameplay, 'updatePresentation', () => {
    throw new Error('Injected presentation reporting failure');
  });

  assert.throws(
    () => fixture.gameplay.activateClassicFromAppShell(fixture.placement),
    /Injected presentation reporting failure/,
  );

  assert.equal(fixture.placement.currentScreen, null);
  assert.equal(getPrivate(fixture.gameplay, 'screenPlacement'), fixture.placement);
  assert.equal(getPrivate(fixture.gameplay, 'classicModeRoot'), null);
  assert.equal(getPrivate(fixture.scene, 'pendingLayerRestartRollback'), null);
  assert.equal(fixture.scene.sessionSnapshot().lifecycle, 'result-removed');
});

test('an end arriving after attachment for a pre-attachment gesture is safely ignored', () => {
  cc.resetRuntime();
  const canvas = new cc.Node('Canvas');
  const gameplay = addComponent(canvas, ClassicGameplayController);

  invokePrivate<void>(gameplay, 'onBladeBegan', {
    point: { x: 3, y: 4 },
    slot: 1,
    touchId: 42,
  });
  invokePrivate<void>(gameplay, 'onBladeMoved', {
    segment: {
      current: { x: 8, y: 9 },
      previous: { x: 3, y: 4 },
      slot: 1,
      touchId: 42,
    },
    shouldPlaySwish: false,
  });

  const presenter = createAttachedBladePresenter(canvas);
  setPrivate(gameplay, 'bladePresenter', presenter);
  invokePrivate<void>(gameplay, 'onBladeEnded', {
    cancelled: false,
    slot: 1,
    touchId: 42,
  });

  assert.deepEqual(presenter.snapshot()[1], {
    claimed: false,
    currentWidth: 4.099999904632568,
    geometry: null,
    points: [],
    slot: 1,
    state: 0,
  });
});

test('a touch completed before resource attachment leaves no synthetic blade ownership', () => {
  cc.resetRuntime();
  const canvas = new cc.Node('Canvas');
  const gameplay = addComponent(canvas, ClassicGameplayController);

  invokePrivate<void>(gameplay, 'onBladeBegan', {
    point: { x: 5, y: 6 },
    slot: 2,
    touchId: 43,
  });
  invokePrivate<void>(gameplay, 'onBladeMoved', {
    segment: {
      current: { x: 11, y: 12 },
      previous: { x: 5, y: 6 },
      slot: 2,
      touchId: 43,
    },
    shouldPlaySwish: false,
  });
  invokePrivate<void>(gameplay, 'onBladeEnded', {
    cancelled: false,
    slot: 2,
    touchId: 43,
  });

  const presenter = createAttachedBladePresenter(canvas);
  setPrivate(gameplay, 'bladePresenter', presenter);
  assert.deepEqual(presenter.snapshot()[2], {
    claimed: false,
    currentWidth: 4.099999904632568,
    geometry: null,
    points: [],
    slot: 2,
    state: 0,
  });
});

test('successful Retry commits a fresh Classic root through shared physical slot 3', () => {
  const fixture = createRetryFixture();

  invokePrivate<void>(fixture.gameplay, 'onResultRetry');

  const classicRoot = getPrivate<StubNode | null>(fixture.gameplay, 'classicModeRoot');
  assert.ok(classicRoot);
  assert.equal(classicRoot.parent, fixture.canvas);
  assert.equal(classicRoot.lastRequestedSiblingIndex, 3);
  assert.equal(fixture.canvas.children[3], classicRoot);
  assert.equal(fixture.placement.currentScreen, classicRoot);
  fixture.placement.assertSharedOrder();
  assert.equal(fixture.resultRoot.parent, null);
  assert.equal(fixture.resultRoot.destroyed, true);
  assert.equal(fixture.resultPresenter.disposed, true);
  assert.equal(getPrivate(fixture.gameplay, 'resultPresentationRoot'), null);
  assert.equal(getPrivate(fixture.gameplay, 'resultPresenter'), null);

  assert.notEqual(getPrivate(fixture.gameplay, 'planner'), fixture.baseline.planner);
  assert.notEqual(getPrivate(fixture.gameplay, 'swishAudio'), fixture.baseline.swishAudio);
  assert.notEqual(getPrivate(fixture.gameplay, 'combo'), fixture.baseline.combo);
  assert.notEqual(getPrivate(fixture.gameplay, 'fail'), fixture.baseline.fail);
  assert.notEqual(getPrivate(fixture.gameplay, 'score'), fixture.baseline.score);
  assert.deepEqual(fixture.gameplay.snapshot(), {
    activeFruitCount: 0,
    deferredControllers: [],
    displayedScore: 0,
    gameOver: false,
    score: 0,
    strikes: 0,
  });

  assert.notEqual(getPrivate(fixture.scene, 'session'), fixture.baseline.sceneSession);
  assert.notEqual(getPrivate(fixture.scene, 'worldSpeed'), fixture.baseline.sceneWorldSpeed);
  assert.equal(getPrivate(fixture.scene, 'pendingLayerRestartRollback'), null);
  assert.equal(getPrivate(fixture.scene, 'classicLayerRemovedForResult'), false);
  assert.equal(fixture.scene.sessionSnapshot().lifecycle, 'intro');
  assert.notEqual(cc.director.getSystem('CLASSIC_VARIABLE_PHYSICS'), null);
  assert.equal(cc.physicsRuntime.autoSimulation, false);

  assert.deepEqual(fixture.persistence, fixture.baseline.persistence);
  assert.equal(fixture.random.draws, fixture.baseline.randomDraws);
  assert.equal(fixture.audio.played.length, 1);
  assert.deepEqual(fixture.retryFailures, []);
  assertNoExtraLiveClassicRoots(classicRoot);
});

test('Retry restores Result and exact run identities after partial Classic construction fails', () => {
  const fixture = createRetryFixture();
  cc.runtimeFaults.failNodeConstructionName = 'ClassicFailPresentationRoot';

  const errors = invokeRetryAndCaptureErrors(fixture);

  assert.equal(errors.length, 1);
  assert.match(errors[0]?.message ?? '', /Injected node construction failure/);
  assertFailedRetryRestored(fixture, /Injected node construction failure/);
});

test('Retry rolls back the real scene and physics restart when system registration fails', () => {
  const fixture = createRetryFixture();
  cc.runtimeFaults.failPhysicsRegistration = true;

  const errors = invokeRetryAndCaptureErrors(fixture);

  assert.equal(errors.length, 1);
  assert.match(errors[0]?.message ?? '', /Injected physics registration failure/);
  assertFailedRetryRestored(fixture, /Injected physics registration failure/);
});

test('Retry rolls back physics and fresh session assignment after registration succeeds', () => {
  const fixture = createRetryFixture();
  setPrivate(fixture.bladeInput, 'resetForFreshClassicLayer', () => {
    throw new Error('Injected post-registration blade reset failure');
  });

  const errors = invokeRetryAndCaptureErrors(fixture);

  assert.equal(errors.length, 1);
  assert.match(errors[0]?.message ?? '', /Injected post-registration blade reset failure/);
  assertFailedRetryRestored(fixture, /Injected post-registration blade reset failure/);
});

test('Retry detaches a partially attached Classic root before restoring Result', () => {
  const fixture = createRetryFixture();
  cc.runtimeFaults.failClassicAttachAfterParent = true;

  const errors = invokeRetryAndCaptureErrors(fixture);

  assert.equal(errors.length, 1);
  assert.match(errors[0]?.message ?? '', /Injected ClassicModeRoot post-parent attachment failure/);
  assertFailedRetryRestored(fixture, /Injected ClassicModeRoot post-parent attachment failure/);
});

test('Retry rolls back scene state and the attached root when commit fails', () => {
  const fixture = createRetryFixture();
  setPrivate(fixture.scene, 'commitClassicLayerRestart', () => {
    throw new Error('Injected Classic layer commit failure');
  });

  const errors = invokeRetryAndCaptureErrors(fixture);

  assert.equal(errors.length, 1);
  assert.match(errors[0]?.message ?? '', /Injected Classic layer commit failure/);
  assertFailedRetryRestored(fixture, /Injected Classic layer commit failure/);
});

test('post-commit Result disposal failure cannot tear down the fresh Classic transaction', () => {
  const fixture = createRetryFixture();
  fixture.resultPresenter.throwOnDispose = true;

  const errors = invokeRetryAndCaptureErrors(fixture);

  assert.equal(errors.length, 1);
  assert.match(errors[0]?.message ?? '', /committed with Result cleanup failures/);
  const classicRoot = getPrivate<StubNode | null>(fixture.gameplay, 'classicModeRoot');
  assert.ok(classicRoot);
  assert.equal(classicRoot.parent, fixture.canvas);
  assert.equal(classicRoot.lastRequestedSiblingIndex, 3);
  assert.equal(fixture.canvas.children[3], classicRoot);
  assert.equal(fixture.placement.currentScreen, classicRoot);
  fixture.placement.assertSharedOrder();
  assert.equal(fixture.resultRoot.parent, null);
  assert.equal(fixture.resultRoot.destroyed, true);
  assert.equal(getPrivate(fixture.gameplay, 'resultPresentationRoot'), null);
  assert.equal(getPrivate(fixture.gameplay, 'resultPresenter'), null);
  assert.equal(getPrivate(fixture.scene, 'pendingLayerRestartRollback'), null);
  assert.equal(getPrivate(fixture.scene, 'classicLayerRemovedForResult'), false);
  assert.equal(fixture.scene.sessionSnapshot().lifecycle, 'intro');
  assert.notEqual(cc.director.getSystem('CLASSIC_VARIABLE_PHYSICS'), null);
  assert.deepEqual(fixture.persistence, fixture.baseline.persistence);
  assert.equal(fixture.random.draws, fixture.baseline.randomDraws);
  assert.deepEqual(fixture.retryFailures, []);
  assertNoExtraLiveClassicRoots(classicRoot);
});

test('Result Menu construction rollback keeps the exact Result root and side effects', () => {
  const fixture = createRetryFixture();
  fixture.resultPresenter.navigation = 'menu';
  const tokens: ResultMenuTransitionToken[] = [];
  fixture.canvas.on(
    CLASSIC_RESULT_MENU_REQUESTED_EVENT,
    (payload: unknown) => tokens.push(payload as ResultMenuTransitionToken),
  );

  invokePrivate<void>(fixture.gameplay, 'onResultMenu');

  assert.equal(tokens.length, 1);
  const token = tokens[0];
  assert.ok(token);
  assert.equal(token.completedRunScore, 321);
  assert.equal(token.resultRoot, fixture.resultRoot);
  token.rollback();
  token.rollback();

  assertResultMenuRollbackRestored(fixture);
});

test('Result Menu replace failure rolls back the atomic host and rearms the exact Result', () => {
  const fixture = createRetryFixture();
  fixture.resultPresenter.navigation = 'menu';
  const tokens: ResultMenuTransitionToken[] = [];
  fixture.canvas.on(
    CLASSIC_RESULT_MENU_REQUESTED_EVENT,
    (payload: unknown) => tokens.push(payload as ResultMenuTransitionToken),
  );
  invokePrivate<void>(fixture.gameplay, 'onResultMenu');
  const token = tokens[0];
  assert.ok(token);

  const menuRoot = new cc.Node('MainMenuScreenRoot');
  fixture.placement.failNextAttachAfterParent = true;
  assert.throws(
    () => fixture.placement.replaceCurrentScreen(menuRoot),
    /Injected current-screen attachment failure/,
  );
  token.rollback();

  assert.equal(menuRoot.parent, null);
  assertResultMenuRollbackRestored(fixture);
});

test('Result Menu commit cleans Result best-effort without tearing down the new Menu', () => {
  const fixture = createRetryFixture();
  fixture.resultPresenter.navigation = 'menu';
  fixture.resultPresenter.throwOnDispose = true;
  const tokens: ResultMenuTransitionToken[] = [];
  fixture.canvas.on(
    CLASSIC_RESULT_MENU_REQUESTED_EVENT,
    (payload: unknown) => tokens.push(payload as ResultMenuTransitionToken),
  );
  invokePrivate<void>(fixture.gameplay, 'onResultMenu');
  const token = tokens[0];
  assert.ok(token);

  const menuRoot = new cc.Node('MainMenuScreenRoot');
  const previousRoot = fixture.placement.replaceCurrentScreen(menuRoot);
  const errors = captureConsoleErrors(() => {
    token.commit(previousRoot);
    token.commit(previousRoot);
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0]?.message ?? '', /committed with cleanup failures/);
  assert.equal(previousRoot, fixture.resultRoot);
  assert.equal(fixture.resultRoot.parent, null);
  assert.equal(fixture.resultRoot.destroyed, true);
  assert.equal(menuRoot.parent, fixture.canvas);
  assert.equal(menuRoot.destroyed, false);
  assert.equal(menuRoot.lastRequestedSiblingIndex, 3);
  assert.equal(fixture.placement.currentScreen, menuRoot);
  fixture.placement.assertSharedOrder();
  assert.equal(getPrivate(fixture.gameplay, 'resultPresentationRoot'), null);
  assert.equal(getPrivate(fixture.gameplay, 'resultPresenter'), null);
  assert.deepEqual(fixture.persistence, fixture.baseline.persistence);
  assert.equal(fixture.random.draws, fixture.baseline.randomDraws);
  assert.equal(fixture.audio.played.length, 1);
});

function createRetryFixture(): RetryFixture {
  cc.resetRuntime();
  const canvas = new cc.Node('Canvas');
  const background = new cc.Node('SharedBackground');
  const leaf = new cc.Node('SharedLeafFrame');
  const theme = new cc.Node('SharedThemeLayer');
  const sharedRoots = [background, leaf, theme] as const;
  sharedRoots.forEach((root, index) => {
    root.setParent(canvas);
    root.setSiblingIndex(index);
  });
  const placement = new ScreenPlacementProbe(canvas, sharedRoots);

  const bladeInput = addComponent(canvas, BladeInputController);
  const scene = addComponent(canvas, ClassicSceneController);
  scene.onLoad();
  scene.prepareSceneResolution();
  scene.activateInitialClassicLayer();
  scene.start();
  scene.completeIntro();
  scene.gameOverFromMiss();
  scene.displayScoreComplete(321);
  assert.equal(scene.sessionSnapshot().lifecycle, 'result-removed');
  assert.equal(cc.director.getSystem('CLASSIC_VARIABLE_PHYSICS'), null);

  const gameplay = addComponent(canvas, ClassicGameplayController);
  const random = new CountingRandom();
  const persistence: PersistenceCounters = { award: 0, record: 0, save: 0 };
  const settingsRuntime = createSettingsRuntime(persistence);
  // Result entry and its reward have already mutated shared settings once. Retry must not
  // replay either side effect while replacing the scene-owned Classic layer.
  settingsRuntime.state.recordClassicResultScore(321);
  settingsRuntime.state.awardClassicResultCoins(321);
  setPrivate(gameplay, 'settingsRuntime', settingsRuntime);
  setPrivate(gameplay, 'random', random);
  setPrivate(gameplay, 'planner', new ClassicSpawnPlanner({
    random,
    sampleKinematics: sampleSpawnKinematics,
  }));
  setPrivate(gameplay, 'swishAudio', new ClassicSwishAudioGate(random));
  setPrivate(gameplay, 'combo', new ComboService(random));
  setPrivate(gameplay, 'fail', new FailService());
  setPrivate(gameplay, 'score', new ScoreService(0, 0, 900));

  const score = getPrivate<InstanceType<typeof ScoreService>>(gameplay, 'score');
  score.addScore(321);
  const fail = getPrivate<InstanceType<typeof FailService>>(gameplay, 'fail');
  fail.registerMiss({ x: 1, y: 2 });
  fail.registerMiss({ x: 3, y: 4 });
  fail.registerMiss({ x: 5, y: 6 });
  const combo = getPrivate<InstanceType<typeof ComboService>>(gameplay, 'combo');
  combo.checkCombo({ x: 11, y: 12 });
  combo.checkCombo({ x: 13, y: 14 });
  const swishAudio = getPrivate<InstanceType<typeof ClassicSwishAudioGate>>(
    gameplay,
    'swishAudio',
  );
  swishAudio.request(true, false);

  const deferredControllers = getPrivate<Set<string>>(gameplay, 'deferredControllers');
  deferredControllers.add('dragon-free');
  deferredControllers.add('bomb-wave');
  setPrivate(gameplay, 'gameOver', true);
  setPrivate(gameplay, 'sceneController', scene);
  setPrivate(gameplay, 'resourceCatalog', createResourceCatalog());
  setPrivate(gameplay, 'baseGameplayResources', createBaseGameplayResources());
  setPrivate(gameplay, 'objectivesManager', Object.freeze({
    pauseCard() {
      return Object.freeze({
        objective: Object.freeze({
          description: '15 times combo 3',
        }),
        progressText: '(15 times to go)',
        rewardText: 'reward: 100 coins',
      });
    },
    processGameEvent() { return null; },
  }));

  const audio: AudioProbe = {
    played: [],
    playOneShot(path) { this.played.push(path); },
  };
  setPrivate(gameplay, 'audioPresenter', audio);

  const resultRoot = new cc.Node('ClassicResultPresentationRoot');
  placement.attachCurrentScreen(resultRoot);
  const resultPresenter = createResultPresenterProbe();
  setPrivate(gameplay, 'screenPlacement', placement);
  setPrivate(gameplay, 'initialClassicRuntimeActivated', true);
  setPrivate(gameplay, 'resultPresentationRoot', resultRoot);
  setPrivate(gameplay, 'resultPresenter', resultPresenter);
  setPrivate(gameplay, 'resultConstructionRequested', true);
  setPrivate(gameplay, 'resultMode', 0);
  setPrivate(gameplay, 'resultScore', 321);
  gameplay.onEnable();

  const retryFailures: Array<Readonly<{ message: string; reason: string }>> = [];
  canvas.on(
    CLASSIC_RESULT_RETRY_FAILED_EVENT,
    (payload: unknown) => retryFailures.push(
      payload as Readonly<{ message: string; reason: string }>,
    ),
  );

  const baseline: RetryBaseline = {
    combo,
    comboSnapshot: combo.snapshot(),
    fail,
    failSnapshot: fail.snapshot(),
    gameplaySnapshot: gameplay.snapshot(),
    persistence: Object.freeze({ ...persistence }),
    physics: physicsSnapshot(),
    planner: getPrivate(gameplay, 'planner'),
    plannerNextEntityOccurrenceId: getPrivate<InstanceType<typeof ClassicSpawnPlanner>>(
      gameplay,
      'planner',
    ).nextEntityOccurrenceId,
    randomDraws: random.draws,
    sceneSession: getPrivate(scene, 'session'),
    sceneSessionSnapshot: scene.sessionSnapshot(),
    sceneWorldSpeed: getPrivate(scene, 'worldSpeed'),
    sceneWorldSpeedSnapshot: scene.worldSpeedSnapshot(),
    score,
    scoreSnapshot: score.snapshot(),
    swishAudio,
    swishLocked: swishAudio.locked,
  };

  return {
    audio,
    baseline,
    bladeInput,
    canvas,
    gameplay,
    placement,
    persistence,
    random,
    resultPresenter,
    resultRoot,
    retryFailures,
    scene,
    sharedRoots,
  };
}

function createResourceCatalog(): object {
  const contracts = getClassicPresentationResources('720x1280');
  const bladeContract = getClassicDefaultBladeResource(0, '720x1280');
  const loadedBlade = Object.freeze({
    ...bladeContract,
    spriteFrame: new cc.SpriteFrame(
      bladeContract.dimensions.width,
      bladeContract.dimensions.height,
    ),
  });
  const presentation = Object.fromEntries(
    Object.entries(contracts).map(([key, contract]) => {
      const raster = contract as Readonly<{
        canonicalPath: string;
        dimensions: Readonly<{ height: number; width: number }>;
      }>;
      return [key, Object.freeze({
        ...raster,
        spriteFrame: new cc.SpriteFrame(raster.dimensions.width, raster.dimensions.height),
      })];
    }),
  );
  return Object.freeze({
    assetTree: '720x1280',
    normalFruit() {
      throw new Error('Retry construction must not spawn before the intro gate');
    },
    presentation: Object.freeze(presentation),
    scoreFont: Object.freeze({
      ...CLASSIC_SCORE_HUD_FONT_RESOURCE,
      font: new cc.Font(),
    }),
    standardBlades: Object.freeze({
      profile(bladeId: number) {
        if (bladeId !== 0) {
          throw new RangeError('Retry harness only provides standard blade 0');
        }
        return Object.freeze({
          bladeId: 0,
          kind: 'basic',
          particles: Object.freeze([]),
          texture: loadedBlade,
        });
      },
    }),
  });
}

function createBaseGameplayResources(): object {
  const profile = getBaseGameplayResourceProfile('720x1280');
  const loadRaster = (
    resource: Readonly<{
      readonly canonicalPath: string;
      readonly dimensions: Readonly<{ height: number; width: number }>;
    }>,
  ) => Object.freeze({
    ...resource,
    spriteFrame: new cc.SpriteFrame(
      resource.dimensions.width,
      resource.dimensions.height,
    ),
  });
  return Object.freeze({
    arialFont: Object.freeze({
      ...BASE_GAMEPLAY_ARIAL_FONT_RESOURCE,
      font: new cc.Font(),
    }),
    assetTree: '720x1280',
    objectiveAchievement: Object.freeze(
      Object.fromEntries(
        Object.entries(profile.objectiveAchievement)
          .map(([key, resource]) => [key, loadRaster(resource)]),
      ),
    ),
    pause: Object.freeze(
      Object.fromEntries(
        Object.entries(profile.pause)
          .map(([key, resource]) => [key, loadRaster(resource)]),
      ),
    ),
  });
}

function createAttachedBladePresenter(parent: StubNode) {
  const bladeContract = getClassicDefaultBladeResource(0, '720x1280');
  const presenter = ClassicBladePresenter.create({
    assetTree: '720x1280',
    resource: Object.freeze({
      ...bladeContract,
      spriteFrame: new cc.SpriteFrame(
        bladeContract.dimensions.width,
        bladeContract.dimensions.height,
      ),
    }),
    selectedBladeId: 0,
    viewportWidth: 720,
  });
  Object.assign(presenter, {
    presentMovedSegment() {},
  });
  presenter.attach(parent as never);
  return presenter;
}

function createSettingsRuntime(counters: PersistenceCounters): SettingsRuntimeProbe {
  const snapshot = Object.freeze({
    effectsEnabled: true,
    leaderboard: Object.freeze({ first: 900, second: 800, third: 700 }),
    musicEnabled: true,
    selectedBlade: 0,
    soundEnabled: true,
    totalCoins: 41,
  });
  return {
    loadFailure: null,
    save() { counters.save += 1; },
    state: {
      awardClassicResultCoins(_score: number) {
        counters.award += 1;
        return Object.freeze({ bonusCoins: 0, totalCoins: snapshot.totalCoins });
      },
      recordClassicResultScore(_score: number) {
        counters.record += 1;
        return Object.freeze({ achievedRank: null, leaderboard: snapshot.leaderboard });
      },
      snapshot,
    },
  };
}

function createResultPresenterProbe(): ResultPresenterProbe {
  return {
    disposed: false,
    navigation: 'retry',
    rearmCalls: 0,
    successfulRearms: 0,
    throwOnDispose: false,
    get state() {
      return Object.freeze({ navigation: this.navigation });
    },
    dispose() {
      if (this.throwOnDispose) {
        throw new Error('Injected Result presenter disposal failure');
      }
      if (this.disposed) return false;
      this.disposed = true;
      return true;
    },
    rearmNavigationAfterFailure(route) {
      this.rearmCalls += 1;
      if (this.disposed || this.navigation !== route) return false;
      this.navigation = 'none';
      this.successfulRearms += 1;
      return true;
    },
  };
}

function invokeRetryAndCaptureErrors(fixture: RetryFixture): Error[] {
  const errors: Error[] = [];
  const originalConsoleError = console.error;
  console.error = (value?: unknown) => {
    errors.push(value instanceof Error ? value : new Error(String(value)));
  };
  try {
    invokePrivate<void>(fixture.gameplay, 'onResultRetry');
  } finally {
    console.error = originalConsoleError;
  }
  return errors;
}

function assertFailedRetryRestored(
  fixture: RetryFixture,
  expectedFailure: RegExp,
): void {
  assert.equal(fixture.resultRoot.destroyed, false);
  assert.equal(fixture.resultRoot.parent, fixture.canvas);
  assert.equal(fixture.resultRoot.lastRequestedSiblingIndex, 3);
  assert.equal(fixture.canvas.children[3], fixture.resultRoot);
  assert.equal(fixture.placement.currentScreen, fixture.resultRoot);
  fixture.placement.assertSharedOrder();
  assert.equal(fixture.resultPresenter.disposed, false);
  assert.equal(fixture.resultPresenter.navigation, 'none');
  assert.equal(fixture.resultPresenter.rearmCalls, 1);
  assert.equal(fixture.resultPresenter.successfulRearms, 1);
  assert.equal(getPrivate(fixture.gameplay, 'resultPresentationRoot'), fixture.resultRoot);
  assert.equal(getPrivate(fixture.gameplay, 'resultPresenter'), fixture.resultPresenter);
  assert.equal(getPrivate(fixture.gameplay, 'resultConstructionRequested'), true);
  assert.equal(getPrivate(fixture.gameplay, 'resultMode'), 0);
  assert.equal(getPrivate(fixture.gameplay, 'resultScore'), 321);

  assert.equal(getPrivate(fixture.gameplay, 'planner'), fixture.baseline.planner);
  assert.equal(getPrivate(fixture.gameplay, 'swishAudio'), fixture.baseline.swishAudio);
  assert.equal(getPrivate(fixture.gameplay, 'combo'), fixture.baseline.combo);
  assert.equal(getPrivate(fixture.gameplay, 'fail'), fixture.baseline.fail);
  assert.equal(getPrivate(fixture.gameplay, 'score'), fixture.baseline.score);
  assert.equal(
    getPrivate<InstanceType<typeof ClassicSpawnPlanner>>(fixture.gameplay, 'planner')
      .nextEntityOccurrenceId,
    fixture.baseline.plannerNextEntityOccurrenceId,
  );
  assert.equal(
    getPrivate<InstanceType<typeof ClassicSwishAudioGate>>(fixture.gameplay, 'swishAudio')
      .locked,
    fixture.baseline.swishLocked,
  );
  assert.deepEqual(
    getPrivate<InstanceType<typeof ComboService>>(fixture.gameplay, 'combo').snapshot(),
    fixture.baseline.comboSnapshot,
  );
  assert.deepEqual(
    getPrivate<InstanceType<typeof FailService>>(fixture.gameplay, 'fail').snapshot(),
    fixture.baseline.failSnapshot,
  );
  assert.deepEqual(
    getPrivate<InstanceType<typeof ScoreService>>(fixture.gameplay, 'score').snapshot(),
    fixture.baseline.scoreSnapshot,
  );
  assert.deepEqual(fixture.gameplay.snapshot(), fixture.baseline.gameplaySnapshot);

  assert.equal(getPrivate(fixture.scene, 'session'), fixture.baseline.sceneSession);
  assert.equal(getPrivate(fixture.scene, 'worldSpeed'), fixture.baseline.sceneWorldSpeed);
  assert.deepEqual(fixture.scene.sessionSnapshot(), fixture.baseline.sceneSessionSnapshot);
  assert.deepEqual(fixture.scene.worldSpeedSnapshot(), fixture.baseline.sceneWorldSpeedSnapshot);
  assert.equal(getPrivate(fixture.scene, 'classicLayerRemovedForResult'), true);
  assert.equal(getPrivate(fixture.scene, 'pendingLayerRestartRollback'), null);
  assert.equal(getPrivate(fixture.bladeInput, 'cutEnabled'), false);
  assert.deepEqual(physicsSnapshot(), fixture.baseline.physics);

  assert.deepEqual(fixture.persistence, fixture.baseline.persistence);
  assert.equal(fixture.random.draws, fixture.baseline.randomDraws);
  assert.equal(fixture.audio.played.length, 1);
  assert.equal(fixture.retryFailures.length, 1);
  assert.equal(fixture.retryFailures[0]?.reason, 'restart-error');
  assert.match(fixture.retryFailures[0]?.message ?? '', expectedFailure);
  assertNoExtraLiveClassicRoots(null);
}

function assertResultMenuRollbackRestored(fixture: RetryFixture): void {
  assert.equal(fixture.resultRoot.destroyed, false);
  assert.equal(fixture.resultRoot.parent, fixture.canvas);
  assert.equal(fixture.resultRoot.lastRequestedSiblingIndex, 3);
  assert.equal(fixture.canvas.children[3], fixture.resultRoot);
  assert.equal(fixture.placement.currentScreen, fixture.resultRoot);
  fixture.placement.assertSharedOrder();
  assert.equal(fixture.resultPresenter.disposed, false);
  assert.equal(fixture.resultPresenter.navigation, 'none');
  assert.equal(fixture.resultPresenter.rearmCalls, 1);
  assert.equal(fixture.resultPresenter.successfulRearms, 1);
  assert.equal(getPrivate(fixture.gameplay, 'resultPresentationRoot'), fixture.resultRoot);
  assert.equal(getPrivate(fixture.gameplay, 'resultPresenter'), fixture.resultPresenter);
  assert.deepEqual(fixture.persistence, fixture.baseline.persistence);
  assert.equal(fixture.random.draws, fixture.baseline.randomDraws);
  assert.equal(fixture.audio.played.length, 1);
  assert.deepEqual(fixture.retryFailures, []);
}

function captureConsoleErrors(action: () => void): Error[] {
  const errors: Error[] = [];
  const originalConsoleError = console.error;
  console.error = (value?: unknown) => {
    errors.push(value instanceof Error ? value : new Error(String(value)));
  };
  try {
    action();
  } finally {
    console.error = originalConsoleError;
  }
  return errors;
}

function assertNoExtraLiveClassicRoots(expected: StubNode | null): void {
  const attachedClassicRoots = cc.createdNodes.filter((node) => (
    node.name === 'ClassicModeRoot' && node.parent !== null
  ));
  const liveClassicRoots = cc.createdNodes.filter((node) => (
    node.name === 'ClassicModeRoot' && !node.destroyed
  ));
  assert.deepEqual(attachedClassicRoots, expected === null ? [] : [expected]);
  assert.deepEqual(liveClassicRoots, expected === null ? [] : [expected]);
}

function physicsSnapshot(): object {
  return Object.freeze({
    allowSleep: cc.physicsRuntime.allowSleep,
    autoSimulation: cc.physicsRuntime.autoSimulation,
    bombCollisionMask: cc.physicsRuntime.collisionMatrix['2'],
    enable: cc.physicsRuntime.enable,
    fruitCollisionMask: cc.physicsRuntime.collisionMatrix['1'],
    gravity: Object.freeze({
      x: cc.physicsRuntime.gravity.x,
      y: cc.physicsRuntime.gravity.y,
    }),
    positionIterations: cc.physicsRuntime.positionIterations,
    systemRegistered: cc.director.getSystem('CLASSIC_VARIABLE_PHYSICS') !== null,
    velocityIterations: cc.physicsRuntime.velocityIterations,
  });
}

function addComponent<T>(node: StubNode, Type: new () => T): T {
  return node.addComponent(Type);
}

function getPrivate<T = unknown>(target: object, property: string): T {
  return Reflect.get(target, property) as T;
}

function setPrivate(target: object, property: string, value: unknown): void {
  assert.equal(Reflect.set(target, property, value), true);
}

function invokePrivate<T>(target: object, property: string, ...args: unknown[]): T {
  const member = Reflect.get(target, property) as (...values: unknown[]) => T;
  assert.equal(typeof member, 'function', `${property} must remain executable at runtime`);
  return Reflect.apply(member, target, args);
}
