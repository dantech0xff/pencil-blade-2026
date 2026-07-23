import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export class UITransform {
  constructor() { this.anchorPoint = null; this.contentSize = null; }
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
    this.layer = 0;
    this.name = name;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
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
  setSiblingIndex(index) {
    if (this.parent === null) return;
    const siblings = this.parent.children;
    const current = siblings.indexOf(this);
    if (current >= 0) siblings.splice(current, 1);
    siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, this);
  }
  setPosition(x, y, z = 0) { this.position = { x, y, z }; }
  destroy() {
    if (this.destroyed) return;
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
const { ClassicBirdWordPresenter } = await import(
  '../../../game/assets/scripts/creator/classic-bird-word-presenter.ts'
);

interface StubNode {
  active: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  layer: number;
  readonly name: string;
  readonly parent: StubNode | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
}

interface CocosStub {
  readonly Node: new (name?: string) => StubNode;
}

test('GOOD and LUCK run together for 1.5 action seconds and only the presenter completion starts gameplay', () => {
  const completions: string[] = [];
  const presenter = ClassicBirdWordPresenter.createIntro(input(), {
    onComplete: () => completions.push('start'),
  });
  const parent = new cc.Node('ClassicBirdRoot');
  parent.layer = 19;
  presenter.attach(parent as never);
  presenter.activate();

  let [good, luck] = requireWords(presenter.root as unknown as StubNode);
  assert.equal(good.name, 'ClassicBirdIntroGood');
  assert.equal(luck.name, 'ClassicBirdIntroLuck');
  assert.equal(good.layer, 19);
  assert.deepEqual(point(good), { x: -360, y: 20 });
  assert.deepEqual(point(luck), { x: 360, y: -20 });

  presenter.updateAction(0.25);
  assert.deepEqual(point(good), { x: -180, y: 20 });
  assert.deepEqual(point(luck), { x: 180, y: -20 });
  presenter.updateAction(0.25);
  assert.deepEqual(point(good), { x: 0, y: 20 });
  assert.deepEqual(point(luck), { x: 0, y: -20 });
  presenter.updateAction(0.5);
  assert.deepEqual(point(good), { x: 0, y: 20 });
  assert.deepEqual(point(luck), { x: 0, y: -20 });
  assert.deepEqual(completions, []);

  presenter.updateAction(0.5);
  assert.equal(good.destroyed, true);
  assert.equal(luck.destroyed, true);
  assert.equal((presenter.root as unknown as StubNode).children.length, 0);
  assert.equal(presenter.root.active, false);
  assert.deepEqual(completions, ['start']);
  assert.deepEqual(presenter.state, {
    active: false,
    attached: true,
    complete: true,
    disposed: false,
    elapsedActionSeconds: 1.5,
    presentation: 'intro',
  });
  presenter.updateAction(10);
  assert.deepEqual(completions, ['start']);
});

test('GAME and OVER preserve recovered off-screen geometry and GAME-only completion boundary', () => {
  let completions = 0;
  const presenter = ClassicBirdWordPresenter.createGameOver(input(), {
    onComplete: () => { completions += 1; },
  });
  presenter.attach(new cc.Node('ClassicBirdRoot') as never);
  presenter.activate();

  const [game, over] = requireWords(presenter.root as unknown as StubNode);
  assert.equal(game.name, 'ClassicBirdTerminalGame');
  assert.equal(over.name, 'ClassicBirdTerminalOver');
  assert.deepEqual(point(game), { x: 0, y: 425.5 });
  assert.deepEqual(point(over), { x: 0, y: -442.5 });

  presenter.updateAction(0.75);
  assert.deepEqual(point(game), { x: 0, y: 60 });
  assert.deepEqual(point(over), { x: 0, y: -60 });
  presenter.updateAction(1);
  assert.deepEqual(point(game), { x: 0, y: 60 });
  assert.deepEqual(point(over), { x: 0, y: -60 });
  assert.equal(completions, 0);

  presenter.updateAction(0.75);
  assert.deepEqual(point(game), { x: -480, y: 60 });
  assert.deepEqual(point(over), { x: 480, y: -60 });
  assert.equal(game.destroyed, false);
  assert.equal(over.destroyed, false);
  assert.equal(completions, 1);
  assert.equal(presenter.state.elapsedActionSeconds, 2.5);
});

test('overshoot, activation, validation, and disposal boundaries fail closed', () => {
  assert.throws(
    () => ClassicBirdWordPresenter.createIntro(input(), {} as never),
    /onComplete/,
  );
  assert.throws(
    () => ClassicBirdWordPresenter.createIntro({
      ...input(),
      viewport: { height: 0, width: 480 },
    }, { onComplete() {} }),
    /viewport.height/,
  );

  let completions = 0;
  const presenter = ClassicBirdWordPresenter.createGameOver(input(), {
    onComplete: () => { completions += 1; },
  });
  assert.throws(() => presenter.activate(), /attached/);
  assert.throws(() => presenter.updateAction(-1), /non-negative/);
  presenter.attach(new cc.Node('ClassicBirdRoot') as never);
  presenter.activate();
  presenter.updateAction(100);
  assert.equal(presenter.state.elapsedActionSeconds, 2.5);
  assert.equal(completions, 1);
  assert.throws(() => presenter.activate(), /only once/);
  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
  assert.equal(presenter.root.destroyed, true);
});

function input() {
  return {
    resources: {
      background: resource('480x800/Backgrounds/paperbackground0.png', 480, 800),
      bestScoreCup: resource('480x800/Interfaces/object-score-best-cup.png', 49, 52),
      doubleScorePanel: resource('480x800/Interfaces/object-score-double.png', 134, 115),
      failFilled: resource('480x800/Interfaces/object-x-filled.png', 49, 48),
      failNormal: resource('480x800/Interfaces/object-x-normal.png', 49, 48),
      introGood: resource('480x800/Text/text-good.png', 112, 25),
      introLuck: resource('480x800/Text/text-luck.png', 112, 33),
      scoreIcon: resource('480x800/Interfaces/object-score-sprite.png', 55, 55),
      terminalGame: resource('480x800/Text/text-game.png', 269, 51),
      terminalOver: resource('480x800/Text/text-over.png', 216, 85),
    },
    viewport: { height: 800, width: 480 },
  };
}

function resource(
  canonicalPath: string,
  width: number,
  height: number,
) {
  return Object.freeze({
    canonicalPath,
    dimensions: Object.freeze({ height, width }),
    spriteFrame: Object.freeze({ canonicalPath }),
  });
}

function requireWords(root: StubNode): readonly [StubNode, StubNode] {
  assert.equal(root.children.length, 2);
  const first = root.children[0];
  const second = root.children[1];
  assert.ok(first);
  assert.ok(second);
  return [first, second];
}

function point(node: StubNode) {
  return { x: node.position.x, y: node.position.y };
}
