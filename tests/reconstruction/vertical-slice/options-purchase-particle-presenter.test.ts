import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const CC_STUB_URL = moduleUrl(`
export class UITransform {
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
  setContentSize(width, height) { this.contentSize = { width, height }; }
}
export class Sprite {
  static SizeMode = Object.freeze({ CUSTOM: 'CUSTOM' });
  constructor() { this.sizeMode = null; this.spriteFrame = null; }
}
export class Node {
  constructor(name = '') {
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyed = false;
    this.eulerAngles = { x: 0, y: 0, z: 0 };
    this.layer = 0;
    this.name = name;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
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
  destroy() {
    if (this.destroyed) return;
    for (const child of [...this.children]) child.destroy();
    this.destroyed = true;
    this.active = false;
    this.setParent(null);
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
  setRotationFromEuler(x, y, z) { this.eulerAngles = { x, y, z }; }
  setScale(x, y, z = 1) { this.scale = { x, y, z }; }
  setSiblingIndex(index) {
    if (this.parent === null) return;
    const siblings = this.parent.children;
    const current = siblings.indexOf(this);
    if (current >= 0) siblings.splice(current, 1);
    siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, this);
  }
}
export function isValid(value) {
  return value !== null && value !== undefined && !value.destroyed;
}
`);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') return { shortCircuit: true, url: CC_STUB_URL };
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
  readonly Node: new (name?: string) => StubNode;
};
const { OptionsPurchaseParticlePresenter } = await import(
  '../../../game/assets/scripts/creator/options-purchase-particle-presenter.ts'
);

interface StubNode {
  active: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  readonly eulerAngles: { x: number; y: number; z: number };
  layer: number;
  readonly name: string;
  parent: StubNode | null;
  readonly position: { x: number; y: number; z: number };
  readonly scale: { x: number; y: number; z: number };
}

test('purchase burst waits 0.05s, creates exact 45 particles, and retains them until cleanup', () => {
  const draws: Array<readonly [number, number]> = [];
  const resource = raster('480x800/Blades/Particles/X-Mas/xmasfive.png', 46, 44);
  const presenter = OptionsPurchaseParticlePresenter.create({
    random: {
      nextIntInclusive(minimum: number, maximum: number) {
        draws.push([minimum, maximum]);
        return minimum;
      },
    },
    resource,
    viewport: { logicalWidth: 480 },
  });
  const parent = new cc.Node('OptionsRoot');
  parent.layer = 17;

  assert.deepEqual(presenter.root.position, { x: 50, y: 150, z: 0 });
  assert.equal(draws.length, 0);
  presenter.attach(parent as never);
  assert.equal(presenter.root.parent, parent);
  assert.equal(presenter.root.layer, 17);
  assert.equal(presenter.root.active, true);

  presenter.update(presenter.plan.startDelaySeconds / 2);
  assert.equal(presenter.state.burstStarted, false);
  assert.equal(draws.length, 0);
  presenter.update(presenter.plan.startDelaySeconds / 2);
  assert.equal(presenter.state.burstStarted, true);
  assert.equal(presenter.state.particleCount, 45);
  assert.equal(draws.length, 45 * 5);
  assert.equal(presenter.particles[0]?.node.name, 'OptionsPurchaseParticle-1');
  assert.deepEqual(presenter.particles[0]?.node.position, { x: 0, y: 0, z: 0 });
  assert.deepEqual(presenter.particles[0]?.node.scale, { x: 1, y: 1, z: 1 });

  const halfDuration = (presenter.particles[0]?.plan.durationSeconds ?? 0) / 2;
  presenter.update(halfDuration);
  assert.deepEqual(presenter.particles[0]?.node.position, {
    x: -17.5,
    y: -17.5,
    z: 0,
  });
  assert.deepEqual(presenter.particles[0]?.node.scale, { x: 0.5, y: 0.5, z: 1 });
  assert.deepEqual(presenter.particles[0]?.node.eulerAngles, { x: 0.5, y: 0.5, z: 0 });

  presenter.update(halfDuration);
  assert.equal(presenter.state.completedParticleCount, 45);
  assert.equal(presenter.particles.length, 45);
  assert.equal(presenter.particles[0]?.node.destroyed, false);

  presenter.update(presenter.plan.removeAtSeconds);
  assert.equal(presenter.state.disposed, true);
  assert.equal(presenter.root.destroyed, true);
  assert.equal(presenter.particles.length, 0);
  assert.equal(presenter.dispose(), false);
});

test('purchase burst validates attach order, time, and exact resource profile', () => {
  const create = () => OptionsPurchaseParticlePresenter.create({
    random: { nextIntInclusive: (minimum: number) => minimum },
    resource: raster('720x1280/Blades/Particles/X-Mas/xmasfive.png', 66, 64),
    viewport: { logicalWidth: 720 },
  });
  const presenter = create();
  assert.deepEqual(presenter.root.position, { x: 75, y: 225, z: 0 });
  assert.throws(() => presenter.update(0), /must be attached/);
  assert.throws(() => presenter.update(-1), /finite and non-negative/);

  const parent = new cc.Node('OptionsRoot');
  presenter.attach(parent as never);
  assert.throws(() => presenter.attach(parent as never), /not attachable/);
  presenter.dispose();

  assert.throws(
    () => OptionsPurchaseParticlePresenter.create({
      random: { nextIntInclusive: (minimum: number) => minimum },
      resource: raster('480x800/not-xmasfive.png', 46, 44),
      viewport: { logicalWidth: 480 },
    }),
    /exact loaded xmasfive/,
  );
});

function raster(canonicalPath: string, width: number, height: number) {
  return Object.freeze({
    canonicalPath,
    dimensions: Object.freeze({ height, width }),
    spriteFrame: Object.freeze({ canonicalPath }),
  });
}

function moduleUrl(source: string): string {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
