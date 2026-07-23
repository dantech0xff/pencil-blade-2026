import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export class UITransform {
  constructor() { this.contentSize = { width: 0, height: 0 }; }
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
  setContentSize(width, height) { this.contentSize = { width, height }; }
}

export class UIOpacity {
  constructor() { this.opacity = 255; }
}

export class Sprite {
  static SizeMode = Object.freeze({ CUSTOM: 1 });
  constructor() { this.sizeMode = 0; this.spriteFrame = null; }
}

export class Node {
  constructor(name = '') {
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyed = false;
    this.layer = 0;
    this.name = name;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
  }
  get activeInHierarchy() {
    return this.active && (this.parent === null || this.parent.activeInHierarchy);
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
  setSiblingIndex(index) { this.siblingIndex = index; }
  destroy() {
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
  CRAZY_MAGNET_ACTIVE_SECONDS,
  CRAZY_MAGNET_ENTRY_SECONDS,
  CRAZY_MAGNET_EXIT_SECONDS,
} = await import('../../../game/assets/scripts/domain/crazy-audio-contract.ts');
const {
  CRAZY_SUPPLEMENTAL_RASTER_COUNT,
  getCrazySupplementalRasterResources,
} = await import('../../../game/assets/scripts/domain/crazy-resource-contract.ts');
const { CrazyMagnetPresenter } = await import(
  '../../../game/assets/scripts/creator/crazy-magnet-presenter.ts'
);

interface StubNode {
  readonly active: boolean;
  readonly activeInHierarchy: boolean;
  readonly children: readonly StubNode[];
  readonly destroyed: boolean;
  readonly layer: number;
  readonly parent: StubNode | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
}

interface CocosStub {
  readonly Node: new (name?: string) => StubNode;
}

function createHarness(options?: Readonly<{
  effectsEnabled?: () => boolean;
  randomValues?: readonly number[];
}>) {
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
  const randomCalls: string[] = [];
  const randomValues = [...(options?.randomValues ?? [50, 75, 60, 55, 50, 50, 50])];
  const gameplayEvents: string[] = [];
  const audioEvents: string[] = [];
  const retained = {
    disposed: false,
    stopped: false,
    dispose() {
      this.disposed = true;
      this.stop();
    },
    stop() {
      if (!this.stopped) {
        this.stopped = true;
        audioEvents.push('loop:stop');
      }
    },
  };
  const presenter = CrazyMagnetPresenter.create({
    centerX: 240,
    effectsEnabled: options?.effectsEnabled ?? (() => true),
    random: {
      nextDecile() {
        throw new Error('unexpected decile');
      },
      nextIntInclusive(min: number, max: number) {
        const value = randomValues.shift();
        if (value === undefined) {
          throw new Error('random script exhausted');
        }
        randomCalls.push(`${min}:${max}:${value}`);
        return value;
      },
      nextRawNonNegativeInt() {
        throw new Error('unexpected raw');
      },
    },
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
    topY: 800,
  }, {
    audio: {
      playLoopingEffect(path) {
        audioEvents.push(`loop:start:${path}`);
        return retained;
      },
    },
    gameplay: {
      onMagnetBegin() {
        gameplayEvents.push('begin');
      },
      onMagnetEnd() {
        gameplayEvents.push('end');
      },
    },
  });
  const parent = new cc.Node('Parent');
  presenter.attach(parent as never, 1);
  return {
    audioEvents,
    gameplayEvents,
    parent,
    presenter,
    randomCalls,
    retained,
  };
}

test('Magnet enters for 2s, begins at top edge, and starts exact loop/callback order', () => {
  const {
    audioEvents,
    gameplayEvents,
    presenter,
    randomCalls,
  } = createHarness();
  assert.deepEqual(presenter.state.magnetPosition, { x: 240, y: 871 });
  presenter.updateAction(CRAZY_MAGNET_ENTRY_SECONDS / 2);
  assert.deepEqual(presenter.state.magnetPosition, { x: 240, y: 800 });
  assert.equal(presenter.state.phase, 'entering');

  presenter.updateAction(CRAZY_MAGNET_ENTRY_SECONDS / 2);
  assert.deepEqual(presenter.state.magnetPosition, { x: 240, y: 729 });
  assert.equal(presenter.state.phase, 'active');
  assert.equal(presenter.state.lineOpacity, 255);
  assert.deepEqual(audioEvents, ['loop:start:Sounds/magnet.wav']);
  assert.deepEqual(gameplayEvents, ['begin']);
  assert.deepEqual(randomCalls, []);
});

test('Magnet line uses 0.5 first fade then inclusive 50..75 shared-RNG durations', () => {
  const { presenter, randomCalls } = createHarness({
    randomValues: [50, 75, 60],
  });
  presenter.updateAction(2);
  presenter.updateAction(0.5);
  assert.equal(presenter.state.lineOpacity, 0);
  assert.deepEqual(randomCalls, ['50:75:50']);

  presenter.updateAction(0.25);
  assert.equal(presenter.state.lineOpacity, 127.5);
  presenter.updateAction(0.25);
  assert.equal(presenter.state.lineOpacity, 255);
  assert.deepEqual(randomCalls, ['50:75:50', '50:75:75']);
});

test('Magnet end callback and loop stop precede its 2s visual exit', () => {
  const {
    audioEvents,
    gameplayEvents,
    presenter,
    retained,
  } = createHarness({
    randomValues: Array(30).fill(50),
  });
  presenter.updateAction(
    CRAZY_MAGNET_ENTRY_SECONDS + CRAZY_MAGNET_ACTIVE_SECONDS,
  );
  assert.equal(presenter.state.phase, 'exiting');
  assert.equal(presenter.state.lineOpacity, null);
  assert.deepEqual(gameplayEvents, ['begin', 'end']);
  assert.deepEqual(audioEvents, [
    'loop:start:Sounds/magnet.wav',
    'loop:stop',
  ]);
  assert.equal(retained.stopped, true);

  presenter.updateAction(CRAZY_MAGNET_EXIT_SECONDS);
  assert.equal(presenter.state.phase, 'disposed');
  assert.equal(presenter.root.destroyed, true);
});

test('Magnet safely handles effect-setting toggles without synthesizing gameplay end', () => {
  let effects = false;
  const {
    audioEvents,
    gameplayEvents,
    presenter,
  } = createHarness({
    effectsEnabled: () => effects,
    randomValues: Array(30).fill(50),
  });
  presenter.updateAction(2);
  effects = true;
  presenter.updateAction(10.5);
  assert.deepEqual(audioEvents, []);
  assert.deepEqual(gameplayEvents, ['begin', 'end']);

  const active = createHarness({
    randomValues: Array(30).fill(50),
  });
  active.presenter.updateAction(2);
  assert.deepEqual(active.gameplayEvents, ['begin']);
  active.presenter.dispose();
  assert.deepEqual(active.gameplayEvents, ['begin']);
  assert.equal(active.retained.stopped, false);
});

test('Magnet rejects invalid RNG output and invalid frame deltas', () => {
  const { presenter } = createHarness({ randomValues: [76] });
  presenter.updateAction(2);
  assert.throws(() => presenter.updateAction(0.5), /50 through 75/);
  assert.throws(() => presenter.updateAction(-1), /finite and non-negative/);
});
