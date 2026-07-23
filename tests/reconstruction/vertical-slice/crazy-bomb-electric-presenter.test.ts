import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export class UITransform {
  constructor() {
    this.contentSize = { width: 0, height: 0 };
  }
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
  setContentSize(width, height) { this.contentSize = { width, height }; }
}

export class Sprite {
  static SizeMode = Object.freeze({ CUSTOM: 1 });
  constructor() {
    this.sizeMode = 0;
    this.spriteFrame = null;
  }
}

export class Node {
  constructor(name = '', sceneRoot = false) {
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyed = false;
    this.layer = 0;
    this.name = name;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
    this.sceneRoot = sceneRoot;
    this.siblingIndex = 0;
  }
  get activeInHierarchy() {
    return this.active && (
      this.parent === null ? this.sceneRoot : this.parent.activeInHierarchy
    );
  }
  addComponent(Type) {
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
  setPosition(x, y, z = 0) { this.position = { x, y, z }; }
  setSiblingIndex(index) {
    this.siblingIndex = index;
    if (this.parent === null) return;
    const currentIndex = this.parent.children.indexOf(this);
    if (currentIndex >= 0) this.parent.children.splice(currentIndex, 1);
    const targetIndex = Math.max(0, Math.min(index, this.parent.children.length));
    this.parent.children.splice(targetIndex, 0, this);
  }
  destroy() {
    this.destroyed = true;
    this.active = false;
    this.setParent(null);
  }
}
export class Scene extends Node {
  constructor(name = '') { super(name, true); }
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
  CRAZY_BOMB_ELECTRIC_ACTIVE_SECONDS,
  CRAZY_BOMB_ELECTRIC_FRAME_SECONDS,
} = await import('../../../game/assets/scripts/domain/crazy-audio-contract.ts');
const {
  CRAZY_SUPPLEMENTAL_RASTER_COUNT,
  getCrazySupplementalRasterResources,
} = await import('../../../game/assets/scripts/domain/crazy-resource-contract.ts');
const { CrazyBombElectricPresenter } = await import(
  '../../../game/assets/scripts/creator/crazy-bomb-electric-presenter.ts'
);

interface StubNode {
  active: boolean;
  readonly activeInHierarchy: boolean;
  readonly children: readonly StubNode[];
  readonly destroyed: boolean;
  readonly layer: number;
  readonly name: string;
  readonly parent: StubNode | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  setParent(parent: StubNode | null): void;
}

interface CocosStub {
  readonly Node: new (name?: string) => StubNode;
  readonly Scene: new (name?: string) => StubNode;
}

interface HarnessFaults {
  backgroundStopThrows?: boolean;
  sensorDeactivateThrows?: boolean;
}

interface HarnessGeometry {
  logicalHeight?: number;
  logicalWidth?: number;
  visibleRect?: Readonly<{
    readonly height: number;
    readonly leftX: number;
    readonly rightX: number;
    readonly width: number;
  }>;
}

function createHarness(
  effectsEnabled: () => boolean = () => true,
  options: Readonly<{
    readonly attachParentToScene?: boolean;
    readonly faults?: HarnessFaults;
    readonly geometry?: HarnessGeometry;
  }> = {},
) {
  const resourcesByPath = new Map(
    getCrazySupplementalRasterResources('480x800').map((resource) => [
      resource.canonicalPath,
      Object.freeze({
        canonicalPath: resource.canonicalPath,
        dimensions: resource.dimensions,
        spriteFrame: Object.freeze({ path: resource.canonicalPath }),
      }),
    ]),
  );
  const audioEvents: string[] = [];
  const sensor = {
    active: false,
    setActive(active: boolean) {
      audioEvents.push(`sensor:${active}`);
      if (!active && options.faults?.sensorDeactivateThrows) {
        throw new Error('injected sensor deactivate failure');
      }
      this.active = active;
    },
  };
  const visibleRect = options.geometry?.visibleRect ?? {
    height: 800,
    leftX: 0,
    rightX: 480,
    width: 480,
  };
  const presenter = CrazyBombElectricPresenter.create({
    effectsEnabled,
    logicalHeight: options.geometry?.logicalHeight ?? 800,
    logicalWidth: options.geometry?.logicalWidth ?? 480,
    resources: {
      assetTree: '480x800',
      rasterCount: CRAZY_SUPPLEMENTAL_RASTER_COUNT,
      raster(resource: Readonly<{ canonicalPath: string }>) {
        const loaded = resourcesByPath.get(resource.canonicalPath);
        if (loaded === undefined) {
          throw new Error(`missing ${resource.canonicalPath}`);
        }
        return loaded;
      },
      timeManagerFont: Object.freeze({}),
    } as never,
    visibleRect,
  }, {
    audio: {
      playElectricBackgroundMusic() {
        audioEvents.push('background:start');
      },
      playOneShot(path) {
        audioEvents.push(`one-shot:${path}`);
      },
      stopBackgroundMusic() {
        audioEvents.push('background:stop');
        if (options.faults?.backgroundStopThrows) {
          throw new Error('injected background stop failure');
        }
      },
    },
    sensor,
  });
  const scene = new cc.Scene('Scene');
  const parent = new cc.Node('Parent');
  presenter.attach(parent as never, 1);
  const attachParentToScene = () => {
    if (parent.parent === null) {
      parent.setParent(scene);
    }
  };
  if (options.attachParentToScene !== false) {
    attachParentToScene();
  }
  return {
    attachParentToScene,
    audioEvents,
    parent,
    presenter,
    scene,
    sensor,
  };
}

test('detached attachment keeps BombElectric inactive until hierarchy-bound start', () => {
  const {
    attachParentToScene,
    audioEvents,
    parent,
    presenter,
    sensor,
  } = createHarness(() => true, { attachParentToScene: false });

  assert.equal(parent.active, true);
  assert.equal(parent.parent, null);
  assert.equal(parent.activeInHierarchy, false);
  assert.equal(presenter.state.attached, true);
  assert.equal(presenter.root.parent, parent);
  assert.equal(presenter.root.active, false);
  assert.equal(presenter.root.activeInHierarchy, false);
  assert.equal(presenter.leftNode.activeInHierarchy, false);
  assert.equal(presenter.rightNode.activeInHierarchy, false);
  assert.throws(
    () => presenter.start(),
    /active hierarchy to start/,
  );
  assert.equal(presenter.root.active, false);
  assert.equal(presenter.state.off, true);
  assert.equal(sensor.active, false);
  assert.deepEqual(audioEvents, []);

  attachParentToScene();
  assert.equal(parent.activeInHierarchy, true);
  presenter.start();
  assert.equal(presenter.root.active, true);
  assert.equal(presenter.root.activeInHierarchy, true);
  assert.equal(presenter.state.off, false);
  assert.deepEqual(audioEvents, ['one-shot:Sounds/powerup.wav']);
});

test('BombElectric attaches exact endpoints and completes normal 1s + 15s lifecycle', () => {
  const { audioEvents, presenter, sensor } = createHarness();
  assert.deepEqual(presenter.state.leftNodePosition, { x: -19, y: 200 });
  assert.deepEqual(presenter.state.rightNodePosition, { x: 499.5, y: 200 });

  presenter.start();
  assert.deepEqual(audioEvents, ['one-shot:Sounds/powerup.wav']);
  assert.equal(presenter.state.off, false);
  presenter.updateAction(0.5);
  assert.deepEqual(presenter.state.leftNodePosition, { x: 240, y: 200 });
  assert.deepEqual(presenter.state.rightNodePosition, { x: 240, y: 200 });
  assert.equal(sensor.active, false);

  presenter.updateAction(0.5);
  assert.deepEqual(audioEvents, [
    'one-shot:Sounds/powerup.wav',
    'one-shot:Sounds/electricexplose.wav',
    'background:start',
    'sensor:true',
  ]);
  assert.equal(sensor.active, true);
  assert.equal(presenter.state.activeElectricFieldCount, 1);
  assert.deepEqual(presenter.root.children.map(({ name }) => name), [
    'CrazyElectricField',
    'CrazyElectricLeftNode',
    'CrazyElectricRightNode',
  ]);
  assert.equal(
    presenter.state.turnOffRemainingSeconds,
    CRAZY_BOMB_ELECTRIC_ACTIVE_SECONDS,
  );

  presenter.updateAction(CRAZY_BOMB_ELECTRIC_FRAME_SECONDS * 3);
  assert.equal(presenter.state.currentFrameIndex, 3);
  presenter.updateAction(
    CRAZY_BOMB_ELECTRIC_ACTIVE_SECONDS
      - CRAZY_BOMB_ELECTRIC_FRAME_SECONDS * 3,
  );
  assert.equal(presenter.state.off, true);
  assert.equal(sensor.active, false);
  assert.equal(presenter.state.activeElectricFieldCount, 0);
  assert.deepEqual(audioEvents.slice(-2), ['background:stop', 'sensor:false']);
});

test('early Stop preserves pending entry callback and reproduces delayed reactivation', () => {
  const { audioEvents, presenter, sensor } = createHarness();
  presenter.start();
  presenter.updateAction(0.25);
  assert.equal(presenter.stop(), true);
  assert.equal(presenter.state.off, true);
  assert.equal(presenter.state.entryRemainingSeconds, 0.75);
  assert.equal(sensor.active, false);

  presenter.updateAction(0.75);
  assert.equal(presenter.state.off, true);
  assert.equal(sensor.active, true);
  assert.equal(presenter.state.activeElectricFieldCount, 1);
  assert.equal(presenter.stop(), false);
  assert.deepEqual(audioEvents, [
    'one-shot:Sounds/powerup.wav',
    'background:stop',
    'sensor:false',
    'one-shot:Sounds/electricexplose.wav',
    'background:start',
    'sensor:true',
  ]);
});

test('offset VisibleRect moves endpoints while raw logical W/H place the field', () => {
  const { presenter } = createHarness(() => true, {
    geometry: {
      logicalHeight: 800,
      logicalWidth: 480,
      visibleRect: {
        height: 800,
        leftX: 20,
        rightX: 500,
        width: 480,
      },
    },
  });
  assert.deepEqual(presenter.state.leftNodePosition, { x: 1, y: 200 });
  assert.deepEqual(presenter.state.rightNodePosition, { x: 519.5, y: 200 });

  presenter.start();
  presenter.updateAction(0.5);
  assert.deepEqual(presenter.state.leftNodePosition, { x: 260, y: 200 });
  assert.deepEqual(presenter.state.rightNodePosition, { x: 260, y: 200 });
  presenter.updateAction(0.5);
  const field = presenter.root.children.find(
    ({ name }) => name === 'CrazyElectricField',
  );
  assert.equal(field?.position.x, 240);
  assert.deepEqual(presenter.root.children.map(({ name }) => name), [
    'CrazyElectricField',
    'CrazyElectricLeftNode',
    'CrazyElectricRightNode',
  ]);
});

test('effects gate is re-read at each callback and invalid values fail before start mutation', () => {
  let effects = false;
  const { audioEvents, presenter } = createHarness(() => effects);
  presenter.start();
  effects = true;
  presenter.updateAction(1);
  effects = false;
  presenter.updateAction(15);
  assert.deepEqual(audioEvents, [
    'one-shot:Sounds/electricexplose.wav',
    'background:start',
    'sensor:true',
    'sensor:false',
  ]);

  const invalid = createHarness(() => 1 as never).presenter;
  const before = invalid.state;
  assert.throws(() => invalid.start(), /must return a boolean/);
  assert.deepEqual(invalid.state, before);
});

test('dispose removes fields and deactivates the type-safe sensor exactly once', () => {
  const { presenter, sensor } = createHarness(() => false);
  presenter.start();
  presenter.updateAction(1);
  assert.equal(sensor.active, true);
  assert.equal(presenter.dispose(), true);
  assert.equal(sensor.active, false);
  assert.equal(presenter.state.disposed, true);
  assert.equal(presenter.state.activeElectricFieldCount, 0);
  assert.equal(presenter.dispose(), false);
  assert.throws(() => presenter.start(), /must be attached/);
});

test('active explicit dispose unconditionally stops the background it started', () => {
  let effectsEnabled = true;
  const { audioEvents, presenter, sensor } = createHarness(
    () => effectsEnabled,
  );
  presenter.start();
  presenter.updateAction(1);
  assert.equal(sensor.active, true);
  effectsEnabled = false;

  assert.equal(presenter.dispose(), true);
  assert.equal(sensor.active, false);
  assert.equal(presenter.root.destroyed, true);
  assert.deepEqual(audioEvents.slice(-2), ['background:stop', 'sensor:false']);
});

test('Stop after turn-on preserves the pending native automatic turn-off callback', () => {
  const { audioEvents, presenter, sensor } = createHarness();
  presenter.start();
  presenter.updateAction(1);
  assert.equal(presenter.stop(), true);
  assert.equal(presenter.state.turnOffRemainingSeconds, 15);
  assert.equal(sensor.active, false);

  presenter.updateAction(15);
  assert.equal(presenter.state.turnOffRemainingSeconds, null);
  assert.deepEqual(audioEvents.slice(-4), [
    'background:stop',
    'sensor:false',
    'background:stop',
    'sensor:false',
  ]);
});

test('dispose aggregates throwing cleanup ports after converging fields and nodes, then retries', () => {
  const faults: HarnessFaults = {
    backgroundStopThrows: true,
    sensorDeactivateThrows: true,
  };
  const { audioEvents, presenter, sensor } = createHarness(
    () => true,
    { faults },
  );
  presenter.start();
  presenter.updateAction(1);

  assert.throws(
    () => presenter.dispose(),
    (error: unknown) => {
      assert.match(
        (error as Error).message,
        /stop owned electric background: injected background stop failure/,
      );
      assert.match(
        (error as Error).message,
        /deactivate electric sensor: injected sensor deactivate failure/,
      );
      return true;
    },
  );
  assert.equal(presenter.state.disposed, true);
  assert.equal(presenter.state.activeElectricFieldCount, 0);
  assert.equal(presenter.root.destroyed, true);
  assert.equal(sensor.active, true);
  assert.deepEqual(audioEvents.slice(-2), ['background:stop', 'sensor:false']);

  faults.backgroundStopThrows = false;
  faults.sensorDeactivateThrows = false;
  assert.equal(presenter.dispose(), false);
  assert.equal(sensor.active, false);
  assert.deepEqual(audioEvents.slice(-2), ['background:stop', 'sensor:false']);
});

test('ordinary gated turn-off still clears field and sensor when background stop throws', () => {
  const faults: HarnessFaults = { backgroundStopThrows: true };
  const { presenter, sensor } = createHarness(() => true, { faults });
  presenter.start();
  presenter.updateAction(1);

  assert.throws(
    () => presenter.stop(),
    /Crazy BombElectric turn-off completed with cleanup failures/,
  );
  assert.equal(presenter.state.off, true);
  assert.equal(presenter.state.activeElectricFieldCount, 0);
  assert.equal(sensor.active, false);
  assert.equal(presenter.root.destroyed, false);

  faults.backgroundStopThrows = false;
  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.root.destroyed, true);
});

test('geometry rejects float32 overflow and inconsistent visible bounds before node creation', () => {
  assert.throws(
    () => createHarness(() => true, {
      geometry: { logicalWidth: Number.MAX_VALUE },
    }),
    /logicalWidth must be finite in float32/,
  );
  assert.throws(
    () => createHarness(() => true, {
      geometry: { logicalHeight: Number.MAX_VALUE },
    }),
    /logicalHeight must be finite in float32/,
  );
  assert.throws(
    () => createHarness(() => true, {
      geometry: {
        visibleRect: {
          height: 800,
          leftX: 3e38,
          rightX: 3.4e38,
          width: 3e38,
        },
      },
    }),
    /derived rightX must be finite in float32/,
  );
  assert.throws(
    () => createHarness(() => true, {
      geometry: {
        visibleRect: {
          height: 800,
          leftX: 20,
          rightX: 480,
          width: 480,
        },
      },
    }),
    /rightX must equal float32 leftX \+ width/,
  );
});
