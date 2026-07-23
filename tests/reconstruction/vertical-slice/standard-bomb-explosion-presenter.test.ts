import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const events = [];

export class Color {
  constructor(r = 0, g = 0, b = 0, a = 255) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
}

export class Graphics {
  constructor() {
    this.fillColor = new Color();
    this.fills = [];
    this.lineWidth = 0;
    this.path = [];
  }
  clear() {
    this.fills = [];
    this.path = [];
  }
  moveTo(x, y) { this.path = [{ x, y }]; }
  lineTo(x, y) { this.path.push({ x, y }); }
  close() {}
  fill() {
    this.fills.push({
      color: {
        r: this.fillColor.r,
        g: this.fillColor.g,
        b: this.fillColor.b,
        a: this.fillColor.a,
      },
      points: this.path.map((point) => ({ ...point })),
    });
  }
}

export class Node {
  constructor(name = '') {
    this.name = name;
    this.active = true;
    this.children = [];
    this.destroyed = false;
    this.failNextRemove = false;
    this.failNextSiblingIndex = false;
    this.lastRequestedSiblingIndex = null;
    this.layer = 0;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
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
    return component;
  }
  setPosition(x, y, z) { this.position = { x, y, z }; }
  setWorldPosition(x, y, z) {
    const parent = this.parent === null
      ? { x: 0, y: 0, z: 0 }
      : this.parent.worldPosition;
    this.position = { x: x - parent.x, y: y - parent.y, z: z - parent.z };
  }
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
  setSiblingIndex(index) {
    this.lastRequestedSiblingIndex = index;
    if (this.failNextSiblingIndex) {
      this.failNextSiblingIndex = false;
      throw new Error('sibling placement failed');
    }
  }
  removeFromParent() {
    if (this.failNextRemove) {
      this.failNextRemove = false;
      throw new Error('parent removal failed');
    }
    events.push('remove:' + this.name);
    this.setParent(null, true);
  }
  destroy() {
    events.push('destroy:' + this.name);
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
  STANDARD_BOMB_EXPLOSION_Z_ORDER,
  StandardBombExplosionCleanupError,
  StandardBombExplosionPresenter,
} = await import(
  '../../../game/assets/scripts/creator/standard-bomb-explosion-presenter.ts'
);

interface CocosStub {
  readonly events: string[];
  readonly Node: new (name?: string) => StubNode;
  readonly isValid: (value: unknown) => boolean;
}

interface StubNode {
  active: boolean;
  children: StubNode[];
  destroyed: boolean;
  failNextRemove: boolean;
  failNextSiblingIndex: boolean;
  lastRequestedSiblingIndex: number | null;
  layer: number;
  readonly parent: StubNode | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly worldPosition: Readonly<{ x: number; y: number; z: number }>;
  setPosition(x: number, y: number, z: number): void;
}

interface StubGraphics {
  readonly fillColor: Readonly<{ a: number; b: number; g: number; r: number }>;
  readonly fills: readonly Readonly<{
    color: Readonly<{ a: number; b: number; g: number; r: number }>;
    points: readonly Readonly<{ x: number; y: number }>[];
  }>[];
  readonly lineWidth: number;
}

class ScriptedRandom {
  readonly calls: Array<Readonly<{
    maximumInclusive: number;
    minimumInclusive: number;
  }>> = [];
  private readonly draws: readonly number[];
  private nextDrawIndex = 0;

  constructor(draws: readonly number[]) {
    this.draws = draws;
  }

  nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number {
    this.calls.push(Object.freeze({ maximumInclusive, minimumInclusive }));
    const value = this.draws[this.nextDrawIndex];
    if (value === undefined) {
      throw new Error('scripted random exhausted');
    }
    this.nextDrawIndex += 1;
    return value;
  }
}

test('blank draws nothing, flash uses exact quad order, and triangles keep world coordinates', () => {
  const random = new ScriptedRandom([0, 48, 800]);
  const presenter = StandardBombExplosionPresenter.create({
    bombWorldPosition: { x: 224, y: 288 },
    random,
    visibleRect: { bottom: 0, left: 0, right: 480, top: 800 },
  }, { onFinished() {} });
  const parent = new cc.Node('OffsetWorld');
  parent.layer = 19;
  parent.setPosition(100, 200, 0);
  presenter.attach(parent as never, STANDARD_BOMB_EXPLOSION_Z_ORDER);

  const root = presenter.root as unknown as StubNode;
  const graphics = presenter.graphics as unknown as StubGraphics;
  assert.deepEqual(root.worldPosition, { x: 0, y: 0, z: 0 });
  assert.deepEqual(root.position, { x: -100, y: -200, z: 0 });
  assert.equal(root.layer, 19);
  assert.equal(root.lastRequestedSiblingIndex, 1);
  assert.equal(graphics.lineWidth, 1);
  assert.deepEqual({
    r: graphics.fillColor.r,
    g: graphics.fillColor.g,
    b: graphics.fillColor.b,
    a: graphics.fillColor.a,
  }, { r: 255, g: 255, b: 255, a: 255 });
  assert.deepEqual(graphics.fills, []);

  presenter.updateAction(0.249);
  assert.deepEqual(graphics.fills, []);
  presenter.updateAction(0.001);
  assert.deepEqual(graphics.fills, [{
    color: { r: 255, g: 255, b: 255, a: 255 },
    points: [
      { x: 0, y: 800 },
      { x: 480, y: 800 },
      { x: 480, y: 0 },
      { x: 0, y: 0 },
    ],
  }]);

  presenter.updateAction(1);
  assert.deepEqual(graphics.fills, [{
    color: { r: 255, g: 255, b: 255, a: 255 },
    points: [
      { x: 224, y: 288 },
      { x: 480, y: 800 },
      { x: 480, y: 848 },
    ],
  }]);
  assert.deepEqual(root.worldPosition, { x: 0, y: 0, z: 0 });
  assert.deepEqual(random.calls, [
    { minimumInclusive: 0, maximumInclusive: 6 },
    { minimumInclusive: 48, maximumInclusive: 96 },
    { minimumInclusive: 0, maximumInclusive: 800 },
  ]);
});

test('triangle phase redraws every accumulated opaque-white triangle', () => {
  const presenter = StandardBombExplosionPresenter.create({
    bombWorldPosition: { x: 20, y: 30 },
    random: new ScriptedRandom([
      0, 48, 100,
      0, 60, 200,
    ]),
    visibleRect: { bottom: 0, left: 0, right: 480, top: 800 },
  }, { onFinished() {} });
  presenter.attach(new cc.Node('World') as never);
  presenter.updateAction(1.25);
  presenter.updateAction(0);

  const graphics = presenter.graphics as unknown as StubGraphics;
  assert.deepEqual(graphics.fills.map(({ points }) => points), [
    [
      { x: 20, y: 30 },
      { x: 480, y: 100 },
      { x: 480, y: 148 },
    ],
    [
      { x: 20, y: 30 },
      { x: 200, y: 0 },
      { x: 260, y: 0 },
    ],
  ]);
});

test('natural finish detaches and destroys before its exactly-once callback', () => {
  cc.events.length = 0;
  let finishCount = 0;
  let presenter: InstanceType<typeof StandardBombExplosionPresenter>;
  presenter = StandardBombExplosionPresenter.create({
    bombWorldPosition: { x: 20, y: 30 },
    random: new ScriptedRandom([]),
    visibleRect: { bottom: 0, left: 0, right: 480, top: 800 },
  }, {
    onFinished() {
      finishCount += 1;
      const root = presenter.root as unknown as StubNode;
      assert.equal(root.parent, null);
      assert.equal(root.destroyed, true);
      cc.events.push('callback');
    },
  });
  presenter.attach(new cc.Node('World') as never);
  cc.events.length = 0;

  presenter.updateAction(2.5);
  assert.deepEqual(cc.events, [
    'remove:StandardBombExplosion',
    'destroy:StandardBombExplosion',
    'callback',
  ]);
  assert.equal(finishCount, 1);
  assert.deepEqual(presenter.snapshot(), {
    attached: false,
    disposed: true,
    explosion: {
      bombWorldPosition: { x: 20, y: 30 },
      edgeCursor: 1,
      elapsedActionSeconds: 2.5,
      finished: true,
      phase: 'finished',
      triangles: [],
      visibleRect: { bottom: 0, left: 0, right: 480, top: 800 },
      visualState: null,
    },
    finishNotified: true,
  });

  presenter.updateAction(1);
  assert.equal(finishCount, 1);
  assert.equal(presenter.dispose(), false);
});

test('explicit disposal is idempotent and never emits natural finish', () => {
  let finishCount = 0;
  const presenter = StandardBombExplosionPresenter.create({
    bombWorldPosition: { x: 0, y: 0 },
    random: new ScriptedRandom([]),
    visibleRect: { bottom: 0, left: 0, right: 480, top: 800 },
  }, { onFinished: () => { finishCount += 1; } });
  presenter.attach(new cc.Node('World') as never);

  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
  assert.equal(finishCount, 0);
  assert.equal(cc.isValid(presenter.root), false);
});

test('failed attachment rolls back its parent and world transform and remains retryable', () => {
  const presenter = StandardBombExplosionPresenter.create({
    bombWorldPosition: { x: 0, y: 0 },
    random: new ScriptedRandom([]),
    visibleRect: { bottom: 0, left: 0, right: 480, top: 800 },
  }, { onFinished() {} });
  const root = presenter.root as unknown as StubNode;
  const parent = new cc.Node('OffsetWorld');
  parent.setPosition(100, 200, 0);
  root.failNextSiblingIndex = true;

  assert.throws(() => presenter.attach(parent as never), /sibling placement failed/);
  assert.equal(root.parent, null);
  assert.equal(root.active, false);
  assert.deepEqual(root.worldPosition, { x: 0, y: 0, z: 0 });
  assert.equal(presenter.snapshot().attached, false);
  assert.equal(presenter.snapshot().disposed, false);

  presenter.attach(parent as never);
  assert.equal(presenter.snapshot().attached, true);
  assert.deepEqual(root.worldPosition, { x: 0, y: 0, z: 0 });
});

test('attachment rollback destroys fail-closed when parent removal itself fails', () => {
  const presenter = StandardBombExplosionPresenter.create({
    bombWorldPosition: { x: 0, y: 0 },
    random: new ScriptedRandom([]),
    visibleRect: { bottom: 0, left: 0, right: 480, top: 800 },
  }, { onFinished() {} });
  const root = presenter.root as unknown as StubNode;
  root.failNextSiblingIndex = true;
  root.failNextRemove = true;

  assert.throws(
    () => presenter.attach(new cc.Node('World') as never),
    (error) => (
      error instanceof StandardBombExplosionCleanupError
      && error.causes.length === 2
    ),
  );
  assert.equal(root.parent, null);
  assert.equal(root.destroyed, true);
  assert.equal(presenter.snapshot().disposed, true);
  assert.throws(
    () => presenter.attach(new cc.Node('World') as never),
    /Disposed/,
  );
});

test('a throwing finish callback observes completed cleanup and is never retried', () => {
  let finishCount = 0;
  const failure = new Error('AfterBombHit failed');
  const presenter = StandardBombExplosionPresenter.create({
    bombWorldPosition: { x: 0, y: 0 },
    random: new ScriptedRandom([]),
    visibleRect: { bottom: 0, left: 0, right: 480, top: 800 },
  }, {
    onFinished() {
      finishCount += 1;
      throw failure;
    },
  });
  presenter.attach(new cc.Node('World') as never);

  assert.throws(
    () => presenter.updateAction(2.5),
    (error) => (
      error instanceof StandardBombExplosionCleanupError
      && error.causes[0] === failure
    ),
  );
  assert.equal(finishCount, 1);
  assert.equal(cc.isValid(presenter.root), false);
  assert.equal(presenter.snapshot().finishNotified, true);
  presenter.updateAction(1);
  assert.equal(finishCount, 1);
});

test('invalid lifecycle, attachment order, z-order, and clocks fail explicitly', () => {
  const input = {
    bombWorldPosition: { x: 0, y: 0 },
    random: new ScriptedRandom([]),
    visibleRect: { bottom: 0, left: 0, right: 480, top: 800 },
  };
  assert.throws(
    () => StandardBombExplosionPresenter.create(input, null as never),
    /onFinished/,
  );
  const presenter = StandardBombExplosionPresenter.create(input, { onFinished() {} });
  assert.throws(() => presenter.updateAction(0), /must be attached/);
  assert.throws(() => presenter.attach(new cc.Node('World') as never, 0 as never), /z-order 1/);
  presenter.attach(new cc.Node('World') as never);
  assert.throws(() => presenter.updateAction(-1), RangeError);
  assert.throws(() => presenter.updateAction(Number.NaN), RangeError);
  assert.throws(() => presenter.attach(new cc.Node('World') as never), /already attached/);
});

test('presenter source uses only Graphics geometry with no texture, particle, fade, or motion path', () => {
  const source = readFileSync(
    new URL(
      '../../../game/assets/scripts/creator/standard-bomb-explosion-presenter.ts',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(source, /\bGraphics\b/);
  assert.doesNotMatch(
    source,
    /\b(Sprite|SpriteFrame|Texture2D|ParticleSystem2D|UIOpacity|tween)\b/,
  );
});
