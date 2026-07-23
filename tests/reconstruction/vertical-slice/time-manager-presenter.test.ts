import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const createdNodes = [];
export const events = [];
let failSetParentError = null;
let failSetParentNodeName = null;
export function resetCreatedNodes() { createdNodes.length = 0; }
export function resetEvents() { events.length = 0; }
export function failNextSetParentForNode(
  name,
  error = new Error('injected Time Up setParent failure'),
) {
  failSetParentNodeName = name;
  failSetParentError = error;
}

export class Color {
  constructor(r = 255, g = 255, b = 255, a = 255) {
    this.r = r; this.g = g; this.b = b; this.a = a;
  }
}

export class Font {
  constructor() { this.destroyed = false; }
}

export class Size {
  constructor(width = 0, height = 0) { this.width = width; this.height = height; }
}

export class SpriteFrame {
  constructor(width, height) {
    this.destroyed = false;
    this.originalSize = new Size(width, height);
    this.rect = { width, height };
  }
}

export class UITransform {
  constructor() {
    this.anchorPoint = { x: 0.5, y: 0.5 };
    this.contentSize = new Size();
  }
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
  setContentSize(width, height) { this.contentSize = new Size(width, height); }
}

export class Sprite {
  constructor() {
    this._color = new Color();
    this.sizeMode = 0;
    this.spriteFrame = null;
  }
  get color() { return this._color; }
  set color(value) {
    this._color = value;
    if (this.node !== undefined) {
      events.push(
        'sprite-color:' + this.node.name + ':'
        + [value.r, value.g, value.b, value.a].join(','),
      );
    }
  }
}
Sprite.SizeMode = Object.freeze({ CUSTOM: 2 });

export class UIOpacity {
  constructor() { this._opacity = 255; }
  get opacity() { return this._opacity; }
  set opacity(value) {
    this._opacity = value;
    if (this.node !== undefined) {
      events.push('opacity:' + this.node.name + ':' + String(value));
    }
  }
}

export class Label {
  constructor() {
    this._color = new Color();
    this._string = '';
    this.font = null;
    this.fontSize = 40;
    this.lineHeight = 40;
  }
  get color() { return this._color; }
  set color(value) {
    this._color = value;
    if (this.node !== undefined) {
      events.push(
        'label-color:' + this.node.name + ':'
        + [value.r, value.g, value.b, value.a].join(','),
      );
    }
  }
  get string() { return this._string; }
  set string(value) {
    this._string = value;
    if (this.node !== undefined) {
      events.push('label-text:' + this.node.name + ':' + value);
    }
  }
}

export class Node {
  constructor(name = '') {
    this._active = true;
    this.children = [];
    this.components = new Map();
    this.destroyed = false;
    this.lastRequestedSiblingIndex = null;
    this.layer = 0;
    this.name = name;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
    createdNodes.push(this);
  }
  get active() { return this._active; }
  set active(value) {
    this._active = value;
    events.push('node-active:' + this.name + ':' + String(value));
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
    const parent = this.parent === null
      ? { x: 0, y: 0, z: 0 }
      : this.parent.worldPosition;
    this.position = { x: x - parent.x, y: y - parent.y, z: z - parent.z };
  }
  setParent(parent, keepWorldTransform = false) {
    if (parent !== null && failSetParentNodeName === this.name) {
      failSetParentNodeName = null;
      const error = failSetParentError;
      failSetParentError = null;
      throw error;
    }
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
    if (this.parent === null) return;
    const current = this.parent.children.indexOf(this);
    if (current >= 0) this.parent.children.splice(current, 1);
    const bounded = Math.max(0, Math.min(index, this.parent.children.length));
    this.parent.children.splice(bounded, 0, this);
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.active = false;
    this.setParent(null, true);
  }
}

export function isValid(value) {
  return value !== null && value !== undefined && value.destroyed !== true;
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
  CRAZY_SUPPLEMENTAL_RASTER_COUNT,
  getCrazySupplementalRasterSet,
} = await import(
  '../../../game/assets/scripts/domain/crazy-resource-contract.ts'
);
const {
  TIME_MANAGER_FREEZE_AUDIO_PATH,
  TIME_MANAGER_NORMAL_COLOR,
  TIME_MANAGER_TICK_AUDIO_PATH,
  TIME_MANAGER_TIME_UP_AUDIO_PATH,
  TIME_MANAGER_WARNING_COLOR,
} = await import(
  '../../../game/assets/scripts/domain/time-manager-service.ts'
);
const { CrazySession } = await import(
  '../../../game/assets/scripts/domain/crazy-session.ts'
);
const {
  TimeManagerPresenter,
  TimeManagerTimeUpDispatchError,
} = await import(
  '../../../game/assets/scripts/creator/time-manager-presenter.ts'
);

interface CocosStub {
  readonly Font: new () => StubFont;
  readonly Node: new (name?: string) => StubNode;
  readonly SpriteFrame: new (width: number, height: number) => StubSpriteFrame;
  readonly createdNodes: StubNode[];
  readonly events: string[];
  failNextSetParentForNode(name: string, error?: Error): void;
  resetCreatedNodes(): void;
  resetEvents(): void;
}

interface StubColor {
  readonly a: number;
  readonly b: number;
  readonly g: number;
  readonly r: number;
}

interface StubFont {
  destroyed: boolean;
}

interface StubNode {
  active: boolean;
  readonly activeInHierarchy: boolean;
  readonly children: StubNode[];
  destroyed: boolean;
  lastRequestedSiblingIndex: number | null;
  layer: number;
  readonly name: string;
  readonly parent: StubNode | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly worldPosition: Readonly<{ x: number; y: number; z: number }>;
  setParent(parent: StubNode | null, keepWorldTransform?: boolean): void;
  setPosition(x: number, y: number, z: number): void;
}

interface StubSpriteFrame {
  destroyed: boolean;
  readonly originalSize: Readonly<{ height: number; width: number }>;
  readonly rect: Readonly<{ height: number; width: number }>;
}

type Presenter = InstanceType<typeof TimeManagerPresenter>;
type AssetTree = '480x800' | '720x1280';

const VIEWPORTS = Object.freeze({
  '480x800': Object.freeze({
    center: Object.freeze({ x: 240, y: 400 }),
    height: 800,
    leftX: 0,
    rightX: 480,
    topY: 800,
    width: 480,
  }),
  '720x1280': Object.freeze({
    center: Object.freeze({ x: 360, y: 640 }),
    height: 1280,
    leftX: 0,
    rightX: 720,
    topY: 1280,
    width: 720,
  }),
});

test('entry constructs exact detached Crazy resources and activates without starting', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    cc.resetCreatedNodes();
    cc.resetEvents();
    const requestedPaths: string[] = [];
    const resources = loadedCrazyResources(assetTree, requestedPaths);
    const harness = createHarness({ assetTree, resources, totalSeconds: 60 });
    const { presenter } = harness;
    const supplement = getCrazySupplementalRasterSet(assetTree);

    assert.deepEqual(requestedPaths, [
      supplement.freezeClock.canonicalPath,
      supplement.timeUp.canonicalPath,
    ]);
    assert.deepEqual(cc.createdNodes.map(({ name }) => name), [
      'TimeManagerRoot',
      'TimeManagerCountdownLabel',
      'TimeManagerFreezeClock',
    ]);
    assert.equal(presenter.root.parent, null);
    assert.equal(presenter.root.active, false);
    assert.equal(presenter.timerLabel.node.parent, presenter.root);
    assert.equal(presenter.freezeClock.node.parent, presenter.root);
    assert.equal(presenter.timerLabel.label.font, resources.timeManagerFont);
    assert.equal(
      presenter.timerLabel.label.fontSize,
      assetTree === '480x800' ? 36 : 54,
    );
    assert.equal(presenter.timerLabel.label.lineHeight, presenter.timerLabel.label.fontSize);
    assert.equal(presenter.timerLabel.label.string, '60');
    assert.deepEqual(color(presenter.timerLabel.label.color), {
      ...TIME_MANAGER_NORMAL_COLOR,
      a: 255,
    });
    assert.equal(presenter.timerLabel.opacity.opacity, 0);
    assert.equal(presenter.freezeClock.node.active, false);
    assert.equal(presenter.freezeClock.sprite.sizeMode, 2);
    assert.equal(
      presenter.freezeClock.transform.contentSize.width,
      supplement.freezeClock.dimensions.width,
    );
    assert.equal(
      presenter.freezeClock.transform.contentSize.height,
      supplement.freezeClock.dimensions.height,
    );
    assert.deepEqual(
      point(presenter.freezeClock.node.worldPosition),
      assetTree === '480x800'
        ? { x: 406, y: 757.5 }
        : { x: 609, y: 1216.5 },
    );

    const parent = new cc.Node('CrazyRoot');
    parent.layer = 17;
    parent.setPosition(100, 200, 0);
    presenter.attach(parent as never, 12);
    assert.equal(presenter.root.parent, parent);
    assert.equal(presenter.root.lastRequestedSiblingIndex, 12);
    assert.equal(presenter.root.active, false);
    assert.equal(presenter.root.layer, 17);
    assert.equal(presenter.timerLabel.node.layer, 17);
    assert.equal(presenter.freezeClock.node.layer, 17);
    assert.deepEqual(
      point(presenter.timerLabel.node.worldPosition),
      assetTree === '480x800'
        ? { x: 408, y: 760 }
        : { x: 612, y: 1216 },
    );

    presenter.activate();
    assert.equal(presenter.root.active, true);
    assert.equal(presenter.state.activated, true);
    assert.equal(presenter.state.timeManager.scheduled, false);
    assert.equal(presenter.state.timeManager.remainingSeconds, 60);

    presenter.updateAction(0.5);
    assert.equal(presenter.timerLabel.opacity.opacity, 127.5);
    presenter.updateAction(0.5);
    assert.equal(presenter.timerLabel.opacity.opacity, 255);
    assert.equal(presenter.state.entryElapsedActionSeconds, 1);
  }
});

test('scheduler ticks delegate audio then apply warning color and countdown text', () => {
  cc.resetCreatedNodes();
  const { presenter } = createHarness({ totalSeconds: 11 });
  attachAndActivate(presenter);
  presenter.start();

  cc.resetEvents();
  presenter.updateScheduler(0.1);
  assert.deepEqual(cc.events, [
    `audio:${TIME_MANAGER_TICK_AUDIO_PATH}`,
    'label-color:TimeManagerCountdownLabel:247,147,30,255',
    'label-text:TimeManagerCountdownLabel:0:10',
  ]);
  assert.deepEqual(color(presenter.timerLabel.label.color), {
    ...TIME_MANAGER_WARNING_COLOR,
    a: 255,
  });

  cc.resetEvents();
  presenter.updateScheduler(1);
  assert.deepEqual(cc.events, [
    `audio:${TIME_MANAGER_TICK_AUDIO_PATH}`,
    'label-color:TimeManagerCountdownLabel:71,71,71,255',
    'label-text:TimeManagerCountdownLabel:0:09',
  ]);
  assert.deepEqual(color(presenter.timerLabel.label.color), {
    ...TIME_MANAGER_NORMAL_COLOR,
    a: 255,
  });
});

test('freeze commands preserve audio, callback, visibility, opacity, and thaw order', () => {
  cc.resetCreatedNodes();
  let presenter: Presenter;
  const harness = createHarness({
    portOverrides: {
      onFreezeStart() {
        cc.events.push(`freeze-start:visible=${String(presenter.freezeClock.node.active)}`);
      },
      onFreezeFinish() {
        cc.events.push(`freeze-finish:visible=${String(presenter.freezeClock.node.active)}`);
      },
    },
  });
  presenter = harness.presenter;
  attachAndActivate(presenter);

  cc.resetEvents();
  presenter.freeze();
  assert.deepEqual(cc.events, [
    `audio:${TIME_MANAGER_FREEZE_AUDIO_PATH}`,
    'sprite-color:TimeManagerFreezeClock:255,255,255,255',
    'freeze-start:visible=false',
    'node-active:TimeManagerFreezeClock:true',
    'opacity:TimeManagerFreezeClock:0',
  ]);
  assert.equal(presenter.freezeClock.node.active, true);
  assert.equal(presenter.freezeClock.opacity.opacity, 0);

  presenter.start();
  cc.resetEvents();
  presenter.updateScheduler(0.75);
  assert.deepEqual(cc.events, [
    'opacity:TimeManagerFreezeClock:127',
    'sprite-color:TimeManagerFreezeClock:127,127,127,255',
  ]);
  assert.equal(presenter.state.timeManager.remainingSeconds, 60);

  cc.resetEvents();
  presenter.updateScheduler(14.25);
  assert.deepEqual(cc.events, [
    'freeze-finish:visible=true',
    'node-active:TimeManagerFreezeClock:false',
    'disable-bonus:12',
    'sprite-color:TimeManagerFreezeClock:127,127,127,255',
  ]);
  assert.equal(presenter.freezeClock.node.active, false);
  assert.equal(presenter.state.timeManager.frozen, false);
  assert.equal(presenter.state.timeManager.remainingSeconds, 60);
});

test('expiry invokes immediate callback before each retained three-second Time Up finish', () => {
  cc.resetCreatedNodes();
  let presenter: Presenter;
  const harness = createHarness({
    totalSeconds: 0.5,
    portOverrides: {
      onTimeUp() {
        cc.events.push(`time-up:sprites=${String(presenter.timeUpSprites.length)}`);
      },
      onTimeUpFinish() {
        cc.events.push('time-up-finish');
      },
    },
  });
  presenter = harness.presenter;
  attachAndActivate(presenter);
  presenter.start();

  cc.resetEvents();
  presenter.updateScheduler(0.5);
  assert.equal(cc.events[0], `audio:${TIME_MANAGER_TIME_UP_AUDIO_PATH}`);
  assert.equal(cc.events[1], 'time-up:sprites=0');
  assert.ok(
    cc.events.indexOf('node-active:TimeManagerTimeUp:true')
      < cc.events.indexOf('label-text:TimeManagerCountdownLabel:0:00'),
  );
  assert.equal(presenter.timeUpSprites.length, 1);
  assert.deepEqual(point(presenter.timeUpSprites[0].node.worldPosition), {
    x: -172.5,
    y: 400,
  });
  assert.equal(presenter.timeUpSprites[0].sprite.spriteFrame.originalSize.width, 345);
  assert.equal(presenter.state.timeManager.scheduled, false);

  // Restart/Start does not cancel or replace the first retained Time Up action.
  presenter.restart();
  presenter.start();
  presenter.updateScheduler(0.5);
  assert.equal(presenter.timeUpSprites.length, 2);
  assert.equal(
    cc.events.filter((event) => event.startsWith('time-up:sprites=')).join(','),
    'time-up:sprites=0,time-up:sprites=1',
  );
  assert.deepEqual(presenter.root.children.map(({ name }) => name), [
    'TimeManagerCountdownLabel',
    'TimeManagerFreezeClock',
    'TimeManagerTimeUp',
    'TimeManagerTimeUp',
  ]);

  cc.resetEvents();
  presenter.updateAction(1);
  assert.deepEqual(
    presenter.timeUpSprites.map(({ node }) => point(node.worldPosition)),
    [{ x: 240, y: 400 }, { x: 240, y: 400 }],
  );
  assert.equal(cc.events.includes('time-up-finish'), false);
  presenter.updateAction(1);
  assert.deepEqual(
    presenter.timeUpSprites.map(({ node }) => point(node.worldPosition)),
    [{ x: 240, y: 400 }, { x: 240, y: 400 }],
  );
  assert.equal(cc.events.includes('time-up-finish'), false);
  presenter.updateAction(1);
  assert.deepEqual(
    presenter.timeUpSprites.map(({ node }) => point(node.worldPosition)),
    [{ x: 652.5, y: 400 }, { x: 652.5, y: 400 }],
  );
  assert.deepEqual(cc.events.filter((event) => event === 'time-up-finish'), [
    'time-up-finish',
    'time-up-finish',
  ]);
  assert.equal(presenter.state.timeUpPresentationCount, 2);
  assert.equal(presenter.state.activeTimeUpPresentationCount, 0);
});

test('nested Crazy session dispatch failure still presents and reaches Result exactly once', () => {
  cc.resetCreatedNodes();
  const session = new CrazySession();
  session.enterScene();
  session.completeIntro();
  let callbackCount = 0;
  let dispatchedSessionCommandCount = 0;
  let finishCount = 0;
  const primaryFailure = new Error('injected immediate time-up failure');
  const failed = createHarness({
    totalSeconds: 0.5,
    portOverrides: {
      onTimeUp() {
        callbackCount += 1;
        cc.events.push('time-up-callback');
        for (const command of session.timeUp()) {
          dispatchedSessionCommandCount += 1;
          cc.events.push(`session:${command.type}`);
          if (dispatchedSessionCommandCount === 2) {
            throw primaryFailure;
          }
        }
      },
      onTimeUpFinish() {
        finishCount += 1;
        for (const command of session.timeUpFinish()) {
          cc.events.push(`session:${command.type}`);
        }
        session.commitTimeUpFinish();
        cc.events.push('time-up-finish');
      },
    },
  }).presenter;
  attachAndActivate(failed);
  failed.start();
  cc.resetEvents();
  assert.throws(() => failed.updateScheduler(0.5), (error) => error === primaryFailure);
  assert.equal(cc.events[0], `audio:${TIME_MANAGER_TIME_UP_AUDIO_PATH}`);
  assert.equal(cc.events[1], 'time-up-callback');
  assert.equal(dispatchedSessionCommandCount, 2);
  assert.equal(session.snapshot().lifecycle, 'time-up');
  assert.ok(
    cc.events.indexOf('session:stop-controller')
      < cc.events.indexOf('node-active:TimeManagerTimeUp:true'),
  );
  assert.ok(
    cc.events.indexOf('node-active:TimeManagerTimeUp:true')
      < cc.events.indexOf('label-text:TimeManagerCountdownLabel:0:00'),
  );
  assert.equal(callbackCount, 1);
  assert.equal(failed.timeUpSprites.length, 1);
  assert.equal(failed.timerLabel.label.string, '0:00');
  assert.equal(failed.state.timeManager.scheduled, false);
  assert.equal(failed.state.pendingTimeUpPresentationCount, 0);

  failed.updateAction(0);
  assert.equal(callbackCount, 1);
  failed.updateAction(3);
  assert.equal(callbackCount, 1);
  assert.equal(finishCount, 1);
  assert.equal(session.snapshot().lifecycle, 'result-removed');
});

test('multiple Time Up dispatch failures retain original error objects and stacks', () => {
  cc.resetCreatedNodes();
  cc.resetEvents();
  const callbackFailure = new Error('injected callback failure');
  const spriteFailure = new Error('injected sprite attachment failure');
  const presenter = createHarness({
    totalSeconds: 0.5,
    portOverrides: {
      onTimeUp() {
        throw callbackFailure;
      },
    },
  }).presenter;
  attachAndActivate(presenter);
  presenter.start();
  cc.failNextSetParentForNode('TimeManagerTimeUp', spriteFailure);

  assert.throws(() => presenter.updateScheduler(0.5), (error) => {
    assert.ok(error instanceof TimeManagerTimeUpDispatchError);
    assert.equal(error.cause, callbackFailure);
    assert.deepEqual(error.errors, [callbackFailure, spriteFailure]);
    assert.equal(error.errors[0]?.stack, callbackFailure.stack);
    assert.equal(error.errors[1]?.stack, spriteFailure.stack);
    return true;
  });
  assert.equal(presenter.timerLabel.label.string, '0:00');
  assert.equal(presenter.timeUpSprites.length, 0);
  assert.equal(presenter.state.pendingTimeUpPresentationCount, 1);

  assert.equal(presenter.resumeTimeUpPresentation(), true);
  presenter.updateAction(3);
  assert.equal(
    cc.events.filter((event) => event === 'time-up-finish').length,
    1,
  );
});

test('failed Time Up sprite creation remains explicitly and idempotently resumable', () => {
  cc.resetCreatedNodes();
  cc.resetEvents();
  let callbackCount = 0;
  const presenter = createHarness({
    totalSeconds: 0.5,
    portOverrides: {
      onTimeUp() {
        callbackCount += 1;
        cc.events.push('time-up');
      },
    },
  }).presenter;
  attachAndActivate(presenter);
  presenter.start();
  cc.failNextSetParentForNode('TimeManagerTimeUp');

  assert.throws(
    () => presenter.updateScheduler(0.5),
    /injected Time Up setParent failure/,
  );
  assert.equal(callbackCount, 1);
  assert.equal(presenter.timeUpSprites.length, 0);
  assert.equal(presenter.timerLabel.label.string, '0:00');
  assert.equal(presenter.state.pendingTimeUpPresentationCount, 1);

  // Crazy no longer runs the scheduler after onTimeUp commits its lifecycle. Its still-active
  // action clock must therefore own automatic recovery, while preserving the same retry record.
  cc.failNextSetParentForNode('TimeManagerTimeUp');
  assert.throws(
    () => presenter.updateAction(0),
    /injected Time Up setParent failure/,
  );
  assert.equal(presenter.state.pendingTimeUpPresentationCount, 1);
  assert.equal(callbackCount, 1);

  assert.equal(presenter.resumeTimeUpPresentation(), true);
  assert.equal(presenter.timeUpSprites.length, 1);
  assert.equal(presenter.state.pendingTimeUpPresentationCount, 0);
  assert.equal(presenter.resumeTimeUpPresentation(), false);
  assert.equal(presenter.timeUpSprites.length, 1);
  assert.equal(callbackCount, 1);

  presenter.updateAction(3);
  assert.equal(
    cc.events.filter((event) => event === 'time-up-finish').length,
    1,
  );
});

test('throwing Time Up finish remains retryable and reentrancy-safe', () => {
  cc.resetCreatedNodes();
  let finishCount = 0;
  let presenter: Presenter;
  const harness = createHarness({
    totalSeconds: 0.5,
    portOverrides: {
      onTimeUpFinish() {
        finishCount += 1;
        cc.events.push(`time-up-finish:${String(finishCount)}`);
        if (finishCount === 1) {
          throw new Error('injected Time Up finish failure');
        }
        presenter.updateAction(0);
      },
    },
  });
  presenter = harness.presenter;
  attachAndActivate(presenter);
  presenter.start();
  presenter.updateScheduler(0.5);

  assert.throws(
    () => presenter.updateAction(3),
    /injected Time Up finish failure/,
  );
  assert.equal(finishCount, 1);
  assert.equal(presenter.state.activeTimeUpPresentationCount, 1);

  assert.doesNotThrow(() => presenter.updateAction(0));
  assert.equal(finishCount, 2);
  assert.equal(presenter.state.activeTimeUpPresentationCount, 0);
  presenter.updateAction(10);
  assert.equal(finishCount, 2);
});

test('disposal and malformed Time Up resources stay safe', () => {
  cc.resetCreatedNodes();
  const failed = createHarness({ totalSeconds: 0.5 }).presenter;
  attachAndActivate(failed);
  assert.equal(failed.dispose(), true);
  assert.equal(failed.dispose(), false);
  assert.doesNotThrow(() => failed.updateScheduler(10));
  assert.doesNotThrow(() => failed.updateAction(10));
  assert.throws(() => failed.freeze(), /Disposed/);
  assert.equal(failed.root.destroyed, true);
  assert.equal(failed.timerLabel.node.destroyed, true);
  assert.equal(failed.freezeClock.node.destroyed, true);

  cc.resetCreatedNodes();
  const pending = createHarness({ totalSeconds: 0.5 }).presenter;
  attachAndActivate(pending);
  pending.start();
  pending.updateScheduler(0.5);
  const pendingTimeUp = pending.timeUpSprites[0];
  assert.ok(pendingTimeUp);
  assert.equal(pending.dispose(), true);
  cc.resetEvents();
  pending.updateAction(3);
  assert.deepEqual(cc.events, []);
  assert.equal(pendingTimeUp.node.destroyed, true);
  assert.equal(pending.state.activeTimeUpPresentationCount, 0);

  cc.resetCreatedNodes();
  const invalidResources = loadedCrazyResources('480x800');
  const supplement = getCrazySupplementalRasterSet('480x800');
  const originalRaster = invalidResources.raster;
  const malformedResources = {
    ...invalidResources,
    raster(resource: Parameters<typeof originalRaster>[0]) {
      const loaded = originalRaster(resource);
      return resource.canonicalPath === supplement.timeUp.canonicalPath
        ? { ...loaded, spriteFrame: new cc.SpriteFrame(1, 1) }
        : loaded;
    },
  };
  assert.throws(
    () => createHarness({ resources: malformedResources }).presenter,
    /untrimmed raster geometry/,
  );
  assert.equal(cc.createdNodes.length, 0);
});

function createHarness(options: {
  readonly assetTree?: AssetTree;
  readonly portOverrides?: Partial<{
    readonly disableBonusType: (bonusType: 12) => void;
    readonly onFreezeFinish: () => void;
    readonly onFreezeStart: () => void;
    readonly onTimeUp: () => void;
    readonly onTimeUpFinish: () => void;
  }>;
  readonly resources?: ReturnType<typeof loadedCrazyResources>;
  readonly totalSeconds?: number;
} = {}) {
  const assetTree = options.assetTree ?? '480x800';
  const resources = options.resources ?? loadedCrazyResources(assetTree);
  const viewport = VIEWPORTS[assetTree];
  const overrides = options.portOverrides ?? {};
  const presenter = TimeManagerPresenter.create({
    effectsEnabled: () => true,
    logicalHeight: viewport.height,
    logicalWidth: viewport.width,
    resources: resources as never,
    totalSeconds: options.totalSeconds ?? 60,
    visibleRect: viewport,
  }, {
    audio: {
      playOneShot(canonicalPath) {
        cc.events.push(`audio:${canonicalPath}`);
      },
    },
    disableBonusType: overrides.disableBonusType ?? (
      (bonusType) => cc.events.push(`disable-bonus:${String(bonusType)}`)
    ),
    onFreezeFinish: overrides.onFreezeFinish ?? (
      () => cc.events.push('freeze-finish')
    ),
    onFreezeStart: overrides.onFreezeStart ?? (
      () => cc.events.push('freeze-start')
    ),
    onTimeUp: overrides.onTimeUp ?? (() => cc.events.push('time-up')),
    onTimeUpFinish: overrides.onTimeUpFinish ?? (() => cc.events.push('time-up-finish')),
  });
  return { presenter, resources };
}

function attachAndActivate(presenter: Presenter): void {
  const parent = new cc.Node('CrazyRoot');
  presenter.attach(parent as never, 1);
  presenter.activate();
}

function loadedCrazyResources(
  assetTree: AssetTree,
  requestedPaths: string[] = [],
) {
  const supplement = getCrazySupplementalRasterSet(assetTree);
  const loadedByPath = new Map([
    supplement.freezeClock,
    supplement.timeUp,
  ].map((resource) => [
    resource.canonicalPath,
    {
      ...resource,
      spriteFrame: new cc.SpriteFrame(
        resource.dimensions.width,
        resource.dimensions.height,
      ),
    },
  ]));
  return {
    assetTree,
    rasterCount: CRAZY_SUPPLEMENTAL_RASTER_COUNT,
    timeManagerFont: new cc.Font(),
    raster(resource: typeof supplement.freezeClock | typeof supplement.timeUp) {
      requestedPaths.push(resource.canonicalPath);
      const loaded = loadedByPath.get(resource.canonicalPath);
      if (loaded === undefined) {
        throw new Error(`unexpected Crazy raster ${resource.canonicalPath}`);
      }
      return loaded;
    },
  };
}

function color(value: StubColor) {
  return {
    a: value.a,
    blue: value.b,
    green: value.g,
    red: value.r,
  };
}

function point(value: Readonly<{ x: number; y: number }>) {
  return { x: value.x, y: value.y };
}
