import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SOURCE = readFileSync(
  fileURLToPath(new URL(
    '../../../game/assets/scripts/creator/objective-achievement-host.ts',
    import.meta.url,
  )),
  'utf8',
);

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const events = [];

export class Node {
  static failNextDestroy = false;
  static failNextSetParent = false;

  constructor(name = '') {
    this.active = true;
    this.children = [];
    this.destroyed = false;
    this.layer = 0;
    this.name = name;
    this.parent = null;
    events.push('create:' + name);
  }

  get activeInHierarchy() {
    return this.active && (this.parent === null || this.parent.activeInHierarchy);
  }

  setParent(parent) {
    if (Node.failNextSetParent) {
      Node.failNextSetParent = false;
      throw new Error('target attach failed');
    }
    if (this.parent !== null) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
    events.push('parent:' + this.name + '->' + (parent?.name ?? 'null'));
  }

  destroy() {
    events.push('destroy:' + this.name);
    if (Node.failNextDestroy) {
      Node.failNextDestroy = false;
      throw new Error('target rollback failed');
    }
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
const {
  ObjectiveAchievementHost,
} = await import(
  '../../../game/assets/scripts/creator/objective-achievement-host.ts'
);

interface StubNode {
  active: boolean;
  readonly activeInHierarchy: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  layer: number;
  readonly name: string;
  parent: StubNode | null;
  destroy(): void;
  setParent(parent: StubNode | null): void;
}

interface CocosStub {
  readonly events: string[];
  readonly Node: {
    new (name?: string): StubNode;
    failNextDestroy: boolean;
    failNextSetParent: boolean;
  };
}

class StubPresenter {
  attachedTarget: StubNode | null = null;
  disposeCount = 0;
  elapsed = 0;
  failAttach = false;
  failDispose = false;
  isComplete = false;
  updateCount = 0;

  attach(parent: unknown): void {
    cc.events.push('attach-presenter');
    if (this.failAttach) {
      throw new Error('presenter attach failed');
    }
    this.attachedTarget = parent as StubNode;
  }

  dispose(): boolean {
    cc.events.push('dispose-presenter');
    this.disposeCount += 1;
    if (this.failDispose) {
      throw new Error('presenter rollback failed');
    }
    return this.disposeCount === 1;
  }

  updateAction(deltaSeconds: number): void {
    cc.events.push(`update-presenter:${deltaSeconds}`);
    this.updateCount += 1;
    this.elapsed += deltaSeconds;
    this.isComplete = this.elapsed >= 7.5;
  }
}

const POPUP_EVENT = Object.freeze({
  type: 'objective-achievement',
}) as never;

test('Set snapshots use Array.from before Creator loose-build iteration', () => {
  assert.equal(SOURCE.split('Array.from(this.presentations)').length - 1, 2);
  assert.equal(SOURCE.split('Array.from(this.orphanedTargets)').length - 1, 1);
  assert.equal(SOURCE.includes('[...this.presentations]'), false);
  assert.equal(SOURCE.includes('[...this.orphanedTargets]'), false);
});

test('host preserves cheer-before-create/attach and survives foreground replacement', () => {
  const shell = new cc.Node('Shell');
  shell.layer = 17;
  const foreground = new cc.Node('ObjectivesForeground');
  foreground.setParent(shell);
  const presenter = new StubPresenter();
  const failures: Error[] = [];
  cc.events.length = 0;

  const host = ObjectiveAchievementHost.create({
    createPresenter() {
      cc.events.push('create-presenter');
      return presenter as never;
    },
    effectsEnabled() {
      cc.events.push('effects-enabled');
      return true;
    },
    onFailure(error) {
      failures.push(error);
    },
    parent: shell as never,
    playCheer() {
      cc.events.push('play-cheer');
    },
  });

  host.onPopup(POPUP_EVENT);

  assert.deepEqual(cc.events.slice(0, 6), [
    'effects-enabled',
    'play-cheer',
    'create-presenter',
    'create:ShellObjectiveAchievementTarget-1',
    'parent:ShellObjectiveAchievementTarget-1->Shell',
    'attach-presenter',
  ]);
  assert.equal(host.activePresentationCount, 1);
  assert.equal(presenter.attachedTarget?.parent, shell);
  assert.equal(presenter.attachedTarget?.layer, 17);
  assert.deepEqual(failures, []);

  foreground.destroy();
  const mainMenu = new cc.Node('MainMenuForeground');
  mainMenu.setParent(shell);
  assert.equal(presenter.attachedTarget?.parent, shell);
  assert.equal(presenter.attachedTarget?.destroyed, false);

  host.update(7.5);
  assert.equal(presenter.updateCount, 1);
  assert.equal(presenter.disposeCount, 1);
  assert.equal(presenter.attachedTarget?.destroyed, true);
  assert.equal(host.activePresentationCount, 0);

  host.update(10);
  assert.equal(presenter.updateCount, 1);
  assert.equal(host.activePresentationCount, 0);
});

for (const fault of ['cheer', 'create', 'attach'] as const) {
  test(`${fault} failure is contained and reported exactly once`, () => {
    const shell = new cc.Node(`Shell-${fault}`);
    const presenter = new StubPresenter();
    presenter.failAttach = fault === 'attach';
    const failures: Error[] = [];
    let createCount = 0;
    const host = ObjectiveAchievementHost.create({
      createPresenter() {
        createCount += 1;
        if (fault === 'create') {
          throw new Error('presenter create failed');
        }
        return presenter as never;
      },
      effectsEnabled: () => true,
      onFailure(error) {
        failures.push(error);
      },
      parent: shell as never,
      playCheer() {
        if (fault === 'cheer') {
          throw new Error('cheer failed');
        }
      },
    });

    assert.doesNotThrow(() => host.onPopup(POPUP_EVENT));
    assert.equal(failures.length, 1);
    assert.equal(host.activePresentationCount, 0);
    assert.equal(createCount, fault === 'cheer' ? 0 : 1);
    assert.equal(presenter.disposeCount, fault === 'attach' ? 1 : 0);
    assert.deepEqual(shell.children, []);
  });
}

test('attach rollback faults remain nonthrowing, emit one aggregate, and retry at teardown', () => {
  const shell = new cc.Node('Shell-rollback');
  const presenter = new StubPresenter();
  presenter.failAttach = true;
  presenter.failDispose = true;
  const failures: Error[] = [];
  const host = ObjectiveAchievementHost.create({
    createPresenter: () => presenter as never,
    effectsEnabled: () => true,
    onFailure(error) {
      failures.push(error);
    },
    parent: shell as never,
    playCheer() {},
  });
  cc.Node.failNextDestroy = true;

  assert.doesNotThrow(() => host.onPopup(POPUP_EVENT));
  assert.equal(failures.length, 1);
  assert.match(failures[0]?.message ?? '', /presenter attach failed/);
  assert.match(failures[0]?.message ?? '', /presenter rollback failed/);
  assert.match(failures[0]?.message ?? '', /target rollback failed/);
  assert.equal(shell.children.length, 1);
  assert.equal(host.activePresentationCount, 0);

  assert.equal(host.dispose(), true);
  assert.deepEqual(shell.children, []);
  assert.equal(failures.length, 1);
});

test('shell teardown disposes every retained presenter and ignores later callbacks', () => {
  const shell = new cc.Node('Shell-destroy');
  const presenters: StubPresenter[] = [];
  let createCount = 0;
  const host = ObjectiveAchievementHost.create({
    createPresenter() {
      createCount += 1;
      const presenter = new StubPresenter();
      presenters.push(presenter);
      return presenter as never;
    },
    effectsEnabled: () => false,
    onFailure(error) {
      assert.fail(`unexpected host failure: ${error.message}`);
    },
    parent: shell as never,
    playCheer() {
      assert.fail('disabled effects must not play cheer');
    },
  });
  host.onPopup(POPUP_EVENT);
  host.onPopup(POPUP_EVENT);

  assert.equal(host.activePresentationCount, 2);
  assert.equal(shell.children.length, 2);
  assert.equal(host.dispose(), true);
  assert.equal(host.isDisposed, true);
  assert.equal(host.activePresentationCount, 0);
  assert.deepEqual(presenters.map(({ disposeCount }) => disposeCount), [1, 1]);
  assert.deepEqual(shell.children, []);
  assert.equal(host.dispose(), false);

  host.onPopup(POPUP_EVENT);
  host.update(10);
  assert.equal(createCount, 2);
  assert.deepEqual(presenters.map(({ updateCount }) => updateCount), [0, 0]);
});
