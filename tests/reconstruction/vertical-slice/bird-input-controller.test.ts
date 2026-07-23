import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const _decorator = Object.freeze({
  ccclass() { return (Type) => Type; },
});

export class Component {
  constructor() { this.node = null; }
}

export class EventTouch {
  constructor(x, y) { this.location = { x, y }; }
  getUILocation() { return this.location; }
}

export const Input = Object.freeze({
  EventType: Object.freeze({
    TOUCH_CANCEL: 'touch-cancel',
    TOUCH_END: 'touch-end',
    TOUCH_MOVE: 'touch-move',
    TOUCH_START: 'touch-start',
  }),
});

class GlobalInput {
  constructor() { this.listeners = new Map(); }
  on(type, callback, target) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push({ callback, target });
    this.listeners.set(type, listeners);
  }
  off(type, callback, target) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(type, listeners.filter((listener) => (
      listener.callback !== callback || listener.target !== target
    )));
  }
  emit(type, event) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener.callback.call(listener.target, event);
    }
  }
  listenerCount(type) { return (this.listeners.get(type) ?? []).length; }
  reset() { this.listeners.clear(); }
}

export const input = new GlobalInput();

export class Node {
  constructor() { this.listeners = new Map(); }
  emit(type, payload) {
    for (const callback of [...(this.listeners.get(type) ?? [])]) callback(payload);
  }
  on(type, callback) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(callback);
    this.listeners.set(type, listeners);
  }
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
      const source = readFileSync(fileName, 'utf8').replace(
        /^\s*@(ccclass|requireComponent)\([^\n]*\)\s*$/gm,
        '',
      );
      return {
        format: 'module',
        shortCircuit: true,
        source: stripTypeScriptTypes(source, {
          mode: 'transform',
          sourceUrl: fileName,
        }),
      };
    }
    return nextLoad(url, context);
  },
});

const cc = await import('cc') as unknown as CocosStub;
const {
  BIRD_BLADE_TOUCH_BEGAN_EVENT,
  BirdInputController,
} = await import(
  '../../../game/assets/scripts/creator/bird-input-controller.ts'
);

interface CocosStub {
  readonly EventTouch: new (x: number, y: number) => StubTouch;
  readonly Input: {
    readonly EventType: Readonly<{
      TOUCH_CANCEL: string;
      TOUCH_END: string;
      TOUCH_MOVE: string;
      TOUCH_START: string;
    }>;
  };
  readonly Node: new () => StubNode;
  readonly input: {
    emit(type: string, event: StubTouch): void;
    listenerCount(type: string): number;
    reset(): void;
  };
}

interface StubTouch {
  readonly location: { x: number; y: number };
}

interface StubNode {
  on(type: string, callback: (payload: BirdPayload) => void): void;
}

interface BirdPayload {
  readonly point: Readonly<{ x: number; y: number }>;
}

function createController(): InstanceType<typeof BirdInputController> {
  const controller = new BirdInputController();
  controller.node = new cc.Node() as never;
  return controller;
}

test('Bird lease subscribes only touch start and activation is idempotent', () => {
  cc.input.reset();
  const controller = createController();

  controller.activateForBirdLayer();
  controller.activateForBirdLayer();

  assert.equal(cc.input.listenerCount(cc.Input.EventType.TOUCH_START), 1);
  assert.equal(cc.input.listenerCount(cc.Input.EventType.TOUCH_MOVE), 0);
  assert.equal(cc.input.listenerCount(cc.Input.EventType.TOUCH_END), 0);
  assert.equal(cc.input.listenerCount(cc.Input.EventType.TOUCH_CANCEL), 0);
});

test('an older scene owner cannot deactivate a newer Bird input lease', () => {
  cc.input.reset();
  const controller = createController();
  const delivered: BirdPayload[] = [];
  const firstOwner = {};
  const secondOwner = {};
  (controller.node as unknown as StubNode).on(
    BIRD_BLADE_TOUCH_BEGAN_EVENT,
    (payload) => delivered.push(payload),
  );

  controller.activateForBirdLayer(firstOwner);
  controller.activateForBirdLayer(secondOwner);
  assert.equal(controller.deactivateForNonBirdScreen(firstOwner), false);
  assert.equal(cc.input.listenerCount(cc.Input.EventType.TOUCH_START), 1);
  cc.input.emit(cc.Input.EventType.TOUCH_START, new cc.EventTouch(9, 11));
  assert.deepEqual(delivered.map(({ point }) => point), [{ x: 9, y: 11 }]);

  assert.equal(controller.deactivateForNonBirdScreen(secondOwner), true);
  assert.equal(cc.input.listenerCount(cc.Input.EventType.TOUCH_START), 0);
});

test('every start emits one immutable point in delivery order, including while consumer is busy', () => {
  cc.input.reset();
  const controller = createController();
  const delivered: BirdPayload[] = [];
  const accepted: BirdPayload[] = [];
  let busy = false;
  (controller.node as unknown as StubNode).on(
    BIRD_BLADE_TOUCH_BEGAN_EVENT,
    (payload) => {
      delivered.push(payload);
      if (!busy) {
        accepted.push(payload);
        busy = true;
      }
    },
  );
  controller.activateForBirdLayer();

  const first = new cc.EventTouch(10, 20);
  const second = new cc.EventTouch(30, 40);
  cc.input.emit(cc.Input.EventType.TOUCH_START, first);
  cc.input.emit(cc.Input.EventType.TOUCH_START, second);
  first.location.x = 999;
  second.location.y = 999;

  assert.deepEqual(delivered.map(({ point }) => point), [
    { x: 10, y: 20 },
    { x: 30, y: 40 },
  ]);
  assert.equal(delivered.length, 2);
  assert.equal(accepted.length, 1);
  for (const payload of delivered) {
    assert.equal(Object.isFrozen(payload), true);
    assert.equal(Object.isFrozen(payload.point), true);
  }
});

test('deactivation and component teardown release the global lease idempotently', () => {
  for (const teardown of ['deactivate', 'disable', 'destroy'] as const) {
    cc.input.reset();
    const controller = createController();
    const delivered: BirdPayload[] = [];
    (controller.node as unknown as StubNode).on(
      BIRD_BLADE_TOUCH_BEGAN_EVENT,
      (payload) => delivered.push(payload),
    );
    controller.activateForBirdLayer();

    if (teardown === 'deactivate') {
      controller.deactivateForNonBirdScreen();
      controller.deactivateForNonBirdScreen();
    } else if (teardown === 'disable') {
      controller.onDisable();
      controller.onDisable();
    } else {
      controller.onDestroy();
      controller.onDestroy();
    }

    assert.equal(cc.input.listenerCount(cc.Input.EventType.TOUCH_START), 0);
    cc.input.emit(cc.Input.EventType.TOUCH_START, new cc.EventTouch(1, 2));
    assert.deepEqual(delivered, []);
  }
});
