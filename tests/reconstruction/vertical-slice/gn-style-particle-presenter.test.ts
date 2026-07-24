import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const events = [];
export const faults = {
  addComponentName: null,
  constructName: null,
  destroyName: null,
  setParentName: null,
};
export const nodes = [];
export class Color {
  constructor(r, g, b, a) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
}
export class UITransform {
  constructor() {
    this.anchorPoint = null;
    this.contentSize = null;
    this.node = null;
  }
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
  setContentSize(width, height) { this.contentSize = { width, height }; }
}
export class Sprite {
  static SizeMode = Object.freeze({ CUSTOM: 'CUSTOM' });
  constructor() {
    this.color = null;
    this.node = null;
    this.sizeMode = null;
    this.spriteFrame = null;
  }
}
export class Node {
  constructor(name = '') {
    if (faults.constructName === name) {
      faults.constructName = null;
      throw new Error('injected construct failure: ' + name);
    }
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyed = false;
    this.layer = 0;
    this.name = name;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
    events.push('create:' + name);
    nodes.push(this);
  }
  get activeInHierarchy() {
    return this.active
      && !this.destroyed
      && (this.parent === null || this.parent.activeInHierarchy);
  }
  get worldPosition() {
    if (this.parent === null) return { ...this.position };
    const parent = this.parent.worldPosition;
    return {
      x: parent.x + this.position.x,
      y: parent.y + this.position.y,
      z: parent.z + this.position.z,
    };
  }
  addComponent(Type) {
    if (faults.addComponentName === this.name) {
      faults.addComponentName = null;
      throw new Error('injected addComponent failure: ' + this.name);
    }
    const component = new Type();
    component.node = this;
    this.components.set(Type, component);
    return component;
  }
  getComponent(Type) { return this.components.get(Type) ?? null; }
  setParent(parent, keepWorldTransform = false) {
    if (faults.setParentName === this.name) {
      faults.setParentName = null;
      throw new Error('injected setParent failure: ' + this.name);
    }
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
  setPosition(x, y, z = 0) { this.position = { x, y, z }; }
  setRotationFromEuler(x, y, z) { this.rotation = { x, y, z }; }
  setScale(x, y, z = 1) { this.scale = { x, y, z }; }
  setSiblingIndex(index) {
    if (this.parent === null) return;
    const siblings = this.parent.children;
    const current = siblings.indexOf(this);
    if (current >= 0) siblings.splice(current, 1);
    siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, this);
  }
  setWorldPosition(x, y, z = 0) {
    if (this.parent === null) this.position = { x, y, z };
    else {
      const parent = this.parent.worldPosition;
      this.position = { x: x - parent.x, y: y - parent.y, z: z - parent.z };
    }
  }
  destroy() {
    if (this.destroyed) return;
    if (faults.destroyName === this.name) {
      faults.destroyName = null;
      throw new Error('injected destroy failure: ' + this.name);
    }
    for (const child of [...this.children]) child.destroy();
    this.destroyed = true;
    this.active = false;
    this.setParent(null);
    events.push('destroy:' + this.name);
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
  createGnStyleParticleEmitterPlans,
} = await import(
  '../../../game/assets/scripts/domain/gn-style-particle-choreography.ts'
);
const {
  createGnStyleParticleBurst,
} = await import(
  '../../../game/assets/scripts/domain/gn-style-particle-explosion.ts'
);
const {
  getGnStyleSupplementalRasterSet,
  listGnStyleParticleFamilyRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/gn-style-resource-contract.ts'
);
const {
  GnStyleParticlePresenter,
} = await import(
  '../../../game/assets/scripts/creator/gn-style-particle-presenter.ts'
);

type AssetTree = '480x800' | '720x1280';

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
  readonly components: Map<unknown, unknown>;
  destroyed: boolean;
  layer: number;
  readonly name: string;
  readonly parent: StubNode | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly rotation: Readonly<{ x: number; y: number; z: number }>;
  readonly scale: Readonly<{ x: number; y: number; z: number }>;
  readonly worldPosition: Readonly<{ x: number; y: number; z: number }>;
  destroy(): void;
  setPosition(x: number, y: number, z?: number): void;
}

interface StubSpriteFrame {
  destroyed: boolean;
  readonly originalSize: { height: number; width: number };
  readonly path: string;
  readonly rect: { height: number; width: number };
}

interface CocosStub {
  readonly Color: new (
    red: number,
    green: number,
    blue: number,
    alpha: number,
  ) => StubColor;
  readonly events: string[];
  readonly faults: {
    addComponentName: string | null;
    constructName: string | null;
    destroyName: string | null;
    setParentName: string | null;
  };
  readonly Node: new (name?: string) => StubNode;
  readonly nodes: StubNode[];
  readonly Sprite: new () => unknown;
  readonly UITransform: new () => unknown;
}

interface RandomCall {
  readonly maximum: number;
  readonly minimum: number;
}

test('both profiles prepare 439 detached roots, stage six rasters, and delegate delayed draws', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    resetCocos();
    const fixture = resourceFixture(assetTree);
    const actualRandom = minimumRandom();
    const viewport = viewportFor(assetTree);
    const plans = createGnStyleParticleEmitterPlans(viewport);
    const presenter = GnStyleParticlePresenter.create({
      random: actualRandom,
      resources: fixture.resources as never,
      viewport,
    });

    assert.deepEqual(fixture.requested, [
      `${assetTree}/Blades/Particles/X-Mas/xmasfive.png`,
      `${assetTree}/Blades/Particles/X-Mas/xmasfour.png`,
      `${assetTree}/Blades/Particles/X-Mas/xmashexa.png`,
      `${assetTree}/Blades/Particles/X-Mas/xmascircle.png`,
      `${assetTree}/Blades/Particles/stars.png`,
      `${assetTree}/Blades/Particles/VN Flag/vnflagstar.png`,
    ]);
    assert.equal(presenter.roots.length, 439);
    assert.equal(presenter.roots[0]?.node.name, 'GnStyleParticleEmitter-001');
    assert.equal(presenter.roots[438]?.node.name, 'GnStyleParticleEmitter-439');
    assert.deepEqual(
      presenter.roots.map(({ plan }) => plan.ordinal),
      Array.from({ length: 439 }, (_, index) => index + 1),
    );
    assert.equal(
      presenter.roots.every(({ node }) => (
        node.parent === null
        && node.active === false
        && (node as unknown as StubNode).children.length === 0
      )),
      true,
    );
    assert.deepEqual(presenter.state, {
      active: false,
      attachedRootCount: 0,
      burstEmitterCount: 0,
      completed: false,
      completedParticleCount: 0,
      disposed: false,
      elapsedActionSeconds: 0,
      liveParticleCount: 0,
      liveRootCount: 439,
      paused: false,
      preparedRootCount: 439,
      spawnedParticleCount: 0,
      started: false,
    });
    assert.deepEqual(actualRandom.calls, []);
    assert.throws(
      () => presenter.updateAction(0),
      /must be started before updating/,
    );
    assert.deepEqual(actualRandom.calls, []);

    const parent = new cc.Node(`Gameplay-${assetTree}`);
    parent.layer = 17;
    parent.setPosition(19, -31, 0);
    const backdrop = new cc.Node(`Backdrop-${assetTree}`);
    backdrop.setPosition(0, 0, 0);
    (backdrop as never as { setParent(parent: StubNode): void }).setParent(parent);
    presenter.start(parent as never);

    assert.deepEqual(actualRandom.calls, []);
    assert.equal(presenter.state.active, true);
    assert.equal(presenter.state.attachedRootCount, 439);
    assert.equal(
      parent.children.slice(1).every(
        (node, index) => node === presenter.roots[index]?.node,
      ),
      true,
    );
    assert.deepEqual(
      (presenter.roots[0]?.node as unknown as StubNode).worldPosition,
      { ...plans[0]?.emitterWorldPosition, z: 0 },
    );
    assert.equal(
      presenter.roots.every(({ node }) => (
        node.active
        && node.layer === 17
        && node.parent === parent as never
      )),
      true,
    );
    assert.throws(() => presenter.start(parent as never), /start only once/);

    presenter.updateAction(2.999);
    assert.deepEqual(actualRandom.calls, []);
    assert.equal(presenter.state.burstEmitterCount, 0);
    presenter.updateAction(0.001);

    const expectedRandom = minimumRandom();
    const expectedBursts = plans.slice(0, 5).map((plan) => (
      createGnStyleParticleBurst(plan, expectedRandom)
    ));
    assert.deepEqual(actualRandom.calls, expectedRandom.calls);
    assert.equal(presenter.state.burstEmitterCount, 5);
    assert.equal(
      presenter.state.spawnedParticleCount,
      expectedBursts.reduce((sum, burst) => sum + burst.particles.length, 0),
    );
    for (const burst of expectedBursts) {
      assert.deepEqual(
        presenter.particlesForEmitter(burst.emitterOrdinal)
          .map(({ plan }) => plan),
        burst.particles,
      );
    }

    const firstParticle = presenter.particlesForEmitter(1)[0];
    assert.ok(firstParticle);
    const firstNode = firstParticle.node as unknown as StubNode;
    assert.equal(firstNode.name, 'GnStyleParticle-001-001');
    assert.equal(firstNode.parent, presenter.roots[0]?.node as never);
    assert.equal(firstNode.layer, 17);
    assert.deepEqual(firstNode.position, { x: 0, y: 0, z: 0 });
    assert.deepEqual(firstNode.scale, { x: 1, y: 1, z: 1 });
    assert.deepEqual(firstNode.rotation, { x: 0, y: 0, z: 0 });
    assert.deepEqual(firstParticle.transform.contentSize, assetTree === '480x800'
      ? { width: 46, height: 44 }
      : { width: 66, height: 64 });
    assert.equal(
      (firstParticle.sprite.spriteFrame as unknown as StubSpriteFrame).path,
      `${assetTree}/Blades/Particles/X-Mas/xmasfive.png`,
    );
    assert.deepEqual(firstParticle.sprite.color, new cc.Color(255, 255, 255, 255));

    const flagBParticle = presenter.particlesForEmitter(2)[0];
    assert.ok(flagBParticle);
    assert.deepEqual(flagBParticle.sprite.color, new cc.Color(0, 0, 0, 255));
    assert.equal(presenter.dispose(), true);
    assert.equal(presenter.dispose(), false);
  }
});

test('pause/resume freezes the action clock and retains move/scale/rotation-complete children', () => {
  resetCocos();
  const fixture = resourceFixture('480x800');
  const random = minimumRandom();
  const presenter = GnStyleParticlePresenter.create({
    random,
    resources: fixture.resources as never,
    viewport: viewportFor('480x800'),
  });
  const parent = new cc.Node('Gameplay');
  presenter.start(parent as never);
  presenter.updateAction(3);

  const first = presenter.particlesForEmitter(1)[0];
  assert.ok(first);
  const node = first.node as unknown as StubNode;
  const callsAtPause = random.calls.length;
  assert.equal(first.plan.durationSeconds, 0.5);
  assert.equal(presenter.pause(), true);
  assert.equal(presenter.pause(), false);
  presenter.updateAction(0.25);
  assert.equal(presenter.state.elapsedActionSeconds, 3);
  assert.equal(random.calls.length, callsAtPause);
  assert.deepEqual(node.position, { x: 0, y: 0, z: 0 });

  assert.equal(presenter.resume(), true);
  assert.equal(presenter.resume(), false);
  presenter.updateAction(0.25);
  assert.deepEqual(node.position, { x: -25, y: -25, z: 0 });
  assert.deepEqual(node.scale, { x: 0.5, y: 0.5, z: 1 });
  assert.deepEqual(node.rotation, { x: 0.5, y: 0.5, z: 0 });
  assert.equal(node.components.size, 2);
  assert.equal(first.plan.fadeEnabled, false);
  assert.equal(first.plan.autoDelete, false);

  presenter.updateAction(0.25);
  assert.deepEqual(node.position, { x: -50, y: -50, z: 0 });
  assert.deepEqual(node.scale, { x: 0, y: 0, z: 1 });
  assert.deepEqual(node.rotation, { x: 1, y: 1, z: 0 });
  assert.equal(node.parent, presenter.roots[0]?.node as never);
  assert.equal(node.destroyed, false);
  presenter.dispose();
});

test('twelve late roots survive Result time and owner-layer teardown removes all ownership', () => {
  resetCocos();
  const fixture = resourceFixture('480x800');
  const presenter = GnStyleParticlePresenter.create({
    random: minimumRandom(),
    resources: fixture.resources as never,
    viewport: viewportFor('480x800'),
  });
  const parent = new cc.Node('Gameplay');
  const backdrop = new cc.Node('Backdrop');
  (backdrop as never as { setParent(parent: StubNode): void }).setParent(parent);
  presenter.start(parent as never);
  presenter.updateAction(153);

  assert.equal(presenter.state.burstEmitterCount, 439);
  assert.equal(presenter.state.spawnedParticleCount, 6622);
  assert.equal(presenter.state.completedParticleCount, 6622);
  assert.equal(presenter.state.liveRootCount, 12);
  assert.deepEqual(
    presenter.roots
      .filter(({ node }) => !(node as unknown as StubNode).destroyed)
      .map(({ plan }) => plan.ordinal),
    [428, 429, 430, 431, 432, 433, 434, 435, 436, 437, 438, 439],
  );
  assert.equal(parent.children.length, 13);
  assert.equal(
    presenter.particlesForEmitter(428).every(({ node }) => (
      (node as unknown as StubNode).destroyed === false
      && (node as unknown as StubNode).scale.x === 0
    )),
    true,
  );

  parent.destroy();
  assert.equal(
    presenter.roots.every(({ node }) => (node as unknown as StubNode).destroyed),
    true,
  );
  presenter.updateAction(0);
  assert.equal(presenter.state.disposed, true);
  assert.equal(presenter.state.liveRootCount, 0);
  assert.equal(presenter.state.liveParticleCount, 0);
  assert.equal(presenter.dispose(), false);
});

test('parent construction faults roll back all provisional roots before surfacing', () => {
  resetCocos();
  const fixture = resourceFixture('480x800');
  const random = minimumRandom();
  cc.faults.constructName = 'GnStyleParticleEmitter-011';

  assert.throws(
    () => GnStyleParticlePresenter.create({
      random,
      resources: fixture.resources as never,
      viewport: viewportFor('480x800'),
    }),
    /injected construct failure/,
  );
  const provisional = cc.nodes.filter(({ name }) => (
    name.startsWith('GnStyleParticleEmitter-')
  ));
  assert.equal(provisional.length, 10);
  assert.equal(provisional.every(({ destroyed }) => destroyed), true);
  assert.deepEqual(random.calls, []);
});

test('failed start rolls back all attachments and permits one clean retry', () => {
  resetCocos();
  const fixture = resourceFixture('480x800');
  const presenter = GnStyleParticlePresenter.create({
    random: minimumRandom(),
    resources: fixture.resources as never,
    viewport: viewportFor('480x800'),
  });
  const parent = new cc.Node('Gameplay');
  parent.layer = 9;
  cc.faults.setParentName = 'GnStyleParticleEmitter-003';

  assert.throws(() => presenter.start(parent as never), /injected setParent failure/);
  assert.equal(parent.children.length, 0);
  assert.equal(
    presenter.roots.every(({ node }) => (
      node.parent === null && node.active === false && node.layer === 0
    )),
    true,
  );
  assert.equal(presenter.state.started, false);
  assert.equal(presenter.state.disposed, false);

  presenter.start(parent as never);
  assert.equal(parent.children.length, 439);
  assert.equal(presenter.state.started, true);
  presenter.dispose();
});

test('child construction faults terminate the run and clean all 439 roots', () => {
  resetCocos();
  const fixture = resourceFixture('480x800');
  const random = minimumRandom();
  const presenter = GnStyleParticlePresenter.create({
    random,
    resources: fixture.resources as never,
    viewport: viewportFor('480x800'),
  });
  const parent = new cc.Node('Gameplay');
  presenter.start(parent as never);
  cc.faults.addComponentName = 'GnStyleParticle-001-001';

  assert.throws(
    () => presenter.updateAction(3),
    /injected addComponent failure/,
  );
  assert.equal(random.calls.length, 90);
  assert.equal(presenter.state.disposed, true);
  assert.equal(presenter.state.liveRootCount, 0);
  assert.equal(parent.children.length, 0);
  assert.equal(
    presenter.roots.every(({ node }) => (node as unknown as StubNode).destroyed),
    true,
  );
  assert.equal(presenter.dispose(), false);
});

test('dispose attempts every root after a fault and retries the sole survivor idempotently', () => {
  resetCocos();
  const fixture = resourceFixture('480x800');
  const presenter = GnStyleParticlePresenter.create({
    random: minimumRandom(),
    resources: fixture.resources as never,
    viewport: viewportFor('480x800'),
  });
  const parent = new cc.Node('Gameplay');
  presenter.start(parent as never);
  cc.faults.destroyName = 'GnStyleParticleEmitter-001';

  assert.throws(() => presenter.dispose(), /particle disposal failed/);
  assert.equal(presenter.state.disposed, true);
  assert.equal(presenter.state.liveRootCount, 1);
  assert.equal(parent.children.length, 1);
  assert.equal(parent.children[0]?.name, 'GnStyleParticleEmitter-001');

  assert.equal(presenter.dispose(), false);
  assert.equal(presenter.state.liveRootCount, 0);
  assert.equal(parent.children.length, 0);
});

test('resource/profile mismatches fail before Creator allocation and implementation avoids generic emitters', async () => {
  resetCocos();
  const fixture = resourceFixture('480x800');
  assert.throws(
    () => GnStyleParticlePresenter.create({
      random: minimumRandom(),
      resources: fixture.resources as never,
      viewport: viewportFor('720x1280'),
    }),
    /viewport must match staged 480x800/,
  );
  assert.equal(
    cc.nodes.some(({ name }) => name.startsWith('GnStyleParticleEmitter-')),
    false,
  );

  const malformed = resourceFixture('480x800');
  malformed.frames.get(
    '480x800/Blades/Particles/X-Mas/xmasfive.png',
  )!.rect.width = 45;
  assert.throws(
    () => GnStyleParticlePresenter.create({
      random: minimumRandom(),
      resources: malformed.resources as never,
      viewport: viewportFor('480x800'),
    }),
    /SpriteFrame geometry must match/,
  );
  assert.equal(
    cc.nodes.some(({ name }) => name.startsWith('GnStyleParticleEmitter-')),
    false,
  );

  const source = await readFile(
    new URL(
      '../../../game/assets/scripts/creator/gn-style-particle-presenter.ts',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(source, /createGnStyleParticleBurst\(emitter\.plan, this\.random\)/);
  assert.doesNotMatch(source, /\bParticleSystem2D\b/);
});

function resetCocos(): void {
  cc.events.length = 0;
  cc.nodes.length = 0;
  cc.faults.addComponentName = null;
  cc.faults.constructName = null;
  cc.faults.destroyName = null;
  cc.faults.setParentName = null;
}

function viewportFor(assetTree: AssetTree): {
  readonly height: number;
  readonly width: number;
} {
  return assetTree === '480x800'
    ? Object.freeze({ height: 800, width: 480 })
    : Object.freeze({ height: 1280, width: 720 });
}

function minimumRandom(): {
  readonly calls: RandomCall[];
  nextIntInclusive(minimum: number, maximum: number): number;
} {
  const calls: RandomCall[] = [];
  return {
    calls,
    nextIntInclusive(minimum: number, maximum: number): number {
      calls.push(Object.freeze({ maximum, minimum }));
      return minimum;
    },
  };
}

function resourceFixture(assetTree: AssetTree): {
  readonly frames: Map<string, StubSpriteFrame>;
  readonly requested: string[];
  readonly resources: {
    readonly assetTree: AssetTree;
    readonly rasterCount: 11;
    raster(resource: {
      readonly canonicalPath: string;
      readonly dimensions: Readonly<{ height: number; width: number }>;
    }): {
      readonly canonicalPath: string;
      readonly dimensions: Readonly<{ height: number; width: number }>;
      readonly spriteFrame: StubSpriteFrame;
    };
  };
} {
  const requested: string[] = [];
  const frames = new Map<string, StubSpriteFrame>();
  const contracts = listGnStyleParticleFamilyRasterResources(assetTree);
  for (const contract of contracts) {
    frames.set(contract.canonicalPath, {
      destroyed: false,
      originalSize: {
        height: contract.dimensions.height,
        width: contract.dimensions.width,
      },
      path: contract.canonicalPath,
      rect: {
        height: contract.dimensions.height,
        width: contract.dimensions.width,
      },
    });
  }
  // Assert the fixture follows the public supplemental object as well as the closed list API.
  assert.equal(
    getGnStyleSupplementalRasterSet(assetTree).particleStars.canonicalPath,
    `${assetTree}/Blades/Particles/stars.png`,
  );
  return {
    frames,
    requested,
    resources: {
      assetTree,
      rasterCount: 11,
      raster(resource) {
        requested.push(resource.canonicalPath);
        const spriteFrame = frames.get(resource.canonicalPath);
        if (spriteFrame === undefined) {
          throw new Error(`fixture omitted ${resource.canonicalPath}`);
        }
        return Object.freeze({ ...resource, spriteFrame });
      },
    },
  };
}
