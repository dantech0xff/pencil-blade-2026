import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extname } from 'node:path';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const _decorator = Object.freeze({
  ccclass() { return (Type) => Type; },
  requireComponent() { return (Type) => Type; },
});
export class Node {
  constructor(name = '') {
    this.name = name;
    this.components = new Map();
    this.listeners = new Map();
  }
  addComponent(Type) {
    const component = new Type();
    component.node = this;
    this.components.set(Type, component);
    return component;
  }
  getComponent(Type) { return this.components.get(Type) ?? null; }
  on(type, callback) {
    const values = this.listeners.get(type) ?? [];
    values.push(callback);
    this.listeners.set(type, values);
  }
  off(type, callback) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((value) => value !== callback));
  }
  emit(type, payload) {
    for (const callback of this.listeners.get(type) ?? []) callback(payload);
  }
}
export class Component {
  constructor() { this.node = null; }
  getComponent(Type) { return this.node?.getComponent(Type) ?? null; }
}
`)}`;

const BLADE_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export class BladeInputController {
  constructor() { this.events = []; this.segments = []; }
  activateForClassicLayer() { this.events.push('activate'); }
  deactivateForNonClassicScreen() { this.events.push('deactivate'); }
  segmentsForPostPhysicsUpdate() { return this.segments; }
  setCutEnabled(enabled) { this.events.push('cut:' + String(enabled)); }
}
`)}`;

const PHYSICS_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const instances = [];
export class CrazyPhysicsAdapter {
  constructor() {
    this.active = false;
    this.afterStep = null;
    this.calls = [];
    this.failActivation = false;
    instances.push(this);
  }
  get state() {
    return { active: this.active };
  }
  activate(afterStep) {
    this.calls.push('activate');
    if (this.failActivation) throw new Error('injected physics activation failure');
    this.active = true;
    this.afterStep = afterStep;
  }
  deactivate() {
    this.calls.push('deactivate');
    const changed = this.active;
    this.active = false;
    return changed;
  }
  callAfterStep(mutation) { this.calls.push('after-step'); mutation(); }
  raycastAll() { this.calls.push('raycast'); return ['hit']; }
  freezeWorld() { this.calls.push('freeze'); }
  unfreezeWorld() { this.calls.push('unfreeze'); }
  setWorldStopped(stopped) { this.calls.push('stopped:' + String(stopped)); }
  emitStep(deltaSeconds) { this.afterStep?.(deltaSeconds); }
}
`)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') {
      return { shortCircuit: true, url: CC_STUB_URL };
    }
    if (specifier === './blade-input-controller') {
      return { shortCircuit: true, url: BLADE_STUB_URL };
    }
    if (specifier === './crazy-physics-adapter') {
      return { shortCircuit: true, url: PHYSICS_STUB_URL };
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
const bladeModule = await import(BLADE_STUB_URL) as unknown as BladeModule;
const physicsModule = await import(PHYSICS_STUB_URL) as unknown as PhysicsModule;
const {
  CRAZY_PHYSICS_STEPPED_EVENT,
  CRAZY_SESSION_COMMAND_EVENT,
  CRAZY_SESSION_SNAPSHOT_EVENT,
  CrazyTimeUpDispatchError,
  CrazySceneController,
} = await import('../../../game/assets/scripts/creator/crazy-scene-controller.ts');

interface StubNode {
  addComponent<T>(Type: new () => T): T;
  emit(type: string, payload?: unknown): void;
  off(type: string, callback: (payload: unknown) => void): void;
  on(type: string, callback: (payload: unknown) => void): void;
}

interface CocosStub {
  readonly Node: new (name?: string) => StubNode;
}

interface BladeStub {
  events: string[];
  segments: unknown[];
}

interface BladeModule {
  readonly BladeInputController: new () => BladeStub;
}

interface PhysicsStub {
  active: boolean;
  calls: string[];
  emitStep(deltaSeconds: number): void;
  failActivation: boolean;
}

interface PhysicsModule {
  readonly instances: PhysicsStub[];
}

test('Crazy scene activation publishes exact construction and GO start order', () => {
  const { controller, blade, node, physics } = harness();
  const commands: Array<Readonly<{ type: string; controller?: string }>> = [];
  node.on(CRAZY_SESSION_COMMAND_EVENT, (command) => {
    commands.push(command as never);
  });

  controller.activateCrazyLayer(123);
  assert.equal(controller.active, true);
  assert.deepEqual(blade.events, ['deactivate', 'activate']);
  assert.equal(physics.calls[0], 'activate');
  assert.deepEqual(commands.slice(0, 5).map(({ type }) => type), [
    'enter-base-gameplay-layer',
    'reset-bonus-manager',
    'process-objective',
    'process-objective',
    'read-logical-director-size',
  ]);
  assert.equal(commands.filter(({ type }) => type === 'construct-controller').length, 11);
  assert.equal(commands.filter(({ type }) => type === 'attach-controller').length, 11);
  assert.deepEqual(commands.at(-1), {
    type: 'initialize-best-score',
    key: 'crazy_best_1',
    score: 123,
  });

  commands.length = 0;
  controller.completeIntro();
  assert.deepEqual(commands.map(({ type, controller: id }) => (
    type === 'start-controller' ? `${type}:${id}` : type
  )), [
    'start-time-manager',
    'set-cut-enabled',
    'start-controller:ab',
    'start-controller:b0',
    'start-controller:b2',
    'start-controller:ac',
    'start-controller:b1',
    'start-controller:b3',
    'start-controller:ad',
    'start-controller:b5',
    'start-controller:ae',
    'start-controller:af',
  ]);
  assert.equal(blade.events.at(-1), 'cut:true');
});

test('freeze, bomb-local hold, Time Up, and final removal preserve separate physics boundaries', () => {
  const { controller, blade, physics } = harness();
  controller.activateCrazyLayer(0);
  controller.completeIntro();

  controller.freezeStart();
  controller.bombHit({ x: 12, y: 34 });
  assert.equal(physics.calls.at(-1), 'freeze');
  assert.equal(physics.calls.includes('stopped:true'), false);
  assert.equal(blade.events.at(-1), 'cut:false');
  controller.afterBombHit();
  assert.equal(physics.calls.includes('stopped:false'), false);
  assert.equal(blade.events.at(-1), 'cut:true');
  controller.freezeFinish();
  assert.equal(physics.calls.at(-1), 'unfreeze');

  controller.addScore(25);
  assert.equal(controller.sessionSnapshot().score.authoritativeScore, 15);
  controller.update();
  controller.timeUp();
  assert.equal(controller.active, true);
  assert.equal(controller.sessionSnapshot().cutEnabled, true);
  controller.timeUpFinish();
  assert.equal(controller.active, false);
  assert.equal(controller.sessionSnapshot().lifecycle, 'result-removed');
  assert.deepEqual(physics.calls.slice(-1), ['deactivate']);
  assert.deepEqual(blade.events.slice(-2), ['cut:false', 'deactivate']);

  const commands: Array<Readonly<{ type: string; score?: number }>> = [];
  controller.node.on(CRAZY_SESSION_COMMAND_EVENT, (command) => commands.push(command as never));
  controller.activateCrazyLayer(200);
  assert.equal(controller.active, true);
  assert.deepEqual(commands.at(-1), {
    type: 'initialize-best-score',
    key: 'crazy_best_1',
    score: 200,
  });
});

test('post-physics payload keeps shared blade segments and active ray/after-step seams', () => {
  const { controller, blade, node, physics } = harness();
  const payloads: unknown[] = [];
  node.on(CRAZY_PHYSICS_STEPPED_EVENT, (payload) => payloads.push(payload));

  let inactiveMutationCalls = 0;
  controller.callAfterPhysicsStep(() => { inactiveMutationCalls += 1; });
  assert.equal(inactiveMutationCalls, 1);
  assert.equal(physics.calls.includes('after-step'), false);
  assert.throws(
    () => controller.callAfterPhysicsStep(null as never),
    /must be a function/,
  );

  controller.activateCrazyLayer(0);
  blade.segments = [{ slot: 2 }];
  physics.emitStep(0.016);
  assert.deepEqual(payloads, [{
    bladeSegments: [{ slot: 2 }],
    deltaSeconds: 0.016,
  }]);
  assert.deepEqual(controller.raycastAll({ x: 0, y: 0 }, { x: 1, y: 1 }), ['hit']);
  let mutationCalls = 0;
  controller.callAfterPhysicsStep(() => { mutationCalls += 1; });
  assert.equal(mutationCalls, 1);
  assert.equal(physics.calls.at(-1), 'after-step');
});

test('activation failures restore the inactive scene and destruction is idempotent', () => {
  const { controller, blade, physics } = harness();
  assert.equal(controller.readyForActivation, true);
  physics.failActivation = true;
  assert.throws(() => controller.activateCrazyLayer(0), /injected physics activation failure/);
  assert.equal(controller.active, false);
  assert.equal(blade.events.at(-1), 'deactivate');
  assert.equal(controller.sessionSnapshot().lifecycle, 'intro');
  physics.failActivation = false;
  controller.activateCrazyLayer(0);
  controller.onDestroy();
  controller.onDestroy();
  assert.equal(controller.active, false);
  assert.equal(controller.readyForActivation, false);
  assert.throws(() => controller.activateCrazyLayer(0), /after scene destruction/);
});

test('Pause replacement releases the active lease and permits only a fresh Crazy session', () => {
  const { controller, blade, physics } = harness();
  controller.activateCrazyLayer(12);
  controller.completeIntro();
  controller.addScore(45);

  controller.releaseCrazyLayerForReplacement();
  assert.equal(controller.active, false);
  assert.equal(controller.sessionSnapshot().lifecycle, 'intro');
  assert.equal(controller.sessionSnapshot().score.authoritativeScore, 0);
  assert.deepEqual(blade.events.slice(-1), ['deactivate']);
  assert.deepEqual(physics.calls.slice(-1), ['deactivate']);
  assert.throws(
    () => controller.releaseCrazyLayerForReplacement(),
    /must be active/,
  );

  controller.activateCrazyLayer(99);
  assert.equal(controller.active, true);
  assert.deepEqual(controller.sessionSnapshot().score, {
    authoritativeScore: 0,
    displayedScore: 0,
    displayedScoreScaleActive: false,
    doubleScoreActive: false,
    pendingDoubleScore: 0,
  });
});

test('Pause navigation suspension restores the exact session, cut gate, and frozen world', () => {
  const { controller, blade, physics } = harness();
  controller.activateCrazyLayer(12);
  controller.completeIntro();
  controller.addScore(45);
  controller.bombHit({ x: 4, y: 8 });
  controller.freezeStart();
  const retained = controller.sessionSnapshot();

  controller.suspendCrazyLayerForNavigation();
  assert.equal(controller.active, false);
  assert.equal(controller.suspended, true);
  assert.deepEqual(controller.sessionSnapshot(), retained);
  assert.deepEqual(blade.events.slice(-1), ['deactivate']);
  assert.deepEqual(physics.calls.slice(-1), ['deactivate']);

  controller.resumeSuspendedCrazyLayer();
  assert.equal(controller.active, true);
  assert.equal(controller.suspended, false);
  assert.deepEqual(controller.sessionSnapshot(), retained);
  assert.deepEqual(physics.calls.slice(-2), ['activate', 'freeze']);
  assert.deepEqual(blade.events.slice(-2), ['activate', 'cut:false']);
});

test('Suspended pause release is explicit and cannot accidentally re-enter the old run', () => {
  const { controller } = harness();
  controller.activateCrazyLayer(5);
  controller.completeIntro();
  controller.addScore(9);
  controller.suspendCrazyLayerForNavigation();

  assert.throws(
    () => controller.activateCrazyLayer(10),
    /suspended run is retained/,
  );
  controller.finalizeSuspendedCrazyLayerRelease();
  assert.equal(controller.suspended, false);
  assert.equal(controller.sessionSnapshot().lifecycle, 'intro');
  assert.equal(controller.sessionSnapshot().score.authoritativeScore, 0);
  assert.throws(
    () => controller.resumeSuspendedCrazyLayer(),
    /only from a suspended run/,
  );

  controller.activateCrazyLayer(10);
  assert.equal(controller.active, true);
});

test('failed Result attachment rolls Crazy back to the active Time Up boundary', () => {
  const { controller, blade, node, physics } = harness();
  controller.activateCrazyLayer(0);
  controller.completeIntro();
  controller.timeUp();
  const failResult = (command: unknown) => {
    if (
      command !== null
      && typeof command === 'object'
      && 'type' in command
      && command.type === 'attach-result'
    ) {
      throw new Error('injected Result attachment failure');
    }
  };
  node.on(CRAZY_SESSION_COMMAND_EVENT, failResult);

  assert.throws(
    () => controller.timeUpFinish(),
    /injected Result attachment failure/,
  );
  node.off(CRAZY_SESSION_COMMAND_EVENT, failResult);
  assert.equal(controller.active, true);
  assert.equal(controller.sessionSnapshot().lifecycle, 'time-up');
  assert.equal(controller.sessionSnapshot().cutEnabled, true);
  assert.equal(physics.active, true);
  assert.deepEqual(physics.calls.slice(-2), ['deactivate', 'activate']);
  assert.deepEqual(blade.events.slice(-3), ['deactivate', 'activate', 'cut:true']);

  controller.timeUpFinish();
  assert.equal(controller.active, false);
  assert.equal(controller.sessionSnapshot().lifecycle, 'result-removed');
});

test('Time Up drains the recovered ordered tail once and preserves every listener failure', () => {
  const { controller, node } = harness();
  controller.activateCrazyLayer(0);
  controller.completeIntro();
  const firstFailure = new Error('injected b2 Time Up listener failure');
  const secondFailure = new Error('injected objective Time Up listener failure');
  const commands: Array<Readonly<{
    controller?: string;
    eventId?: number;
    state?: number;
    type: string;
  }>> = [];
  node.on(CRAZY_SESSION_COMMAND_EVENT, (command) => {
    const typed = command as typeof commands[number];
    commands.push(typed);
    if (typed.type === 'stop-controller' && typed.controller === 'b2') {
      throw firstFailure;
    }
    if (
      typed.type === 'process-objective'
      && typed.eventId === 8
      && typed.state === 2
    ) {
      throw secondFailure;
    }
  });

  assert.throws(
    () => controller.timeUp(),
    (error) => {
      assert.ok(error instanceof CrazyTimeUpDispatchError);
      assert.equal(error.cause, firstFailure);
      assert.deepEqual(error.errors, [firstFailure, secondFailure]);
      return true;
    },
  );
  assert.deepEqual(commands.map((command) => (
    command.type === 'stop-controller'
      ? `${command.type}:${String(command.controller)}`
      : command.type === 'process-objective'
        ? `${command.type}:${String(command.eventId)}:${String(command.state)}`
        : command.type
  )), [
    'stop-controller:ab',
    'stop-controller:ad',
    'stop-controller:ae',
    'stop-controller:af',
    'stop-controller:b0',
    'stop-controller:b2',
    'stop-controller:ac',
    'stop-controller:b1',
    'stop-controller:b3',
    'stop-electric-bomb',
    'process-objective:8:2',
    'process-objective:4:2',
  ]);
  assert.equal(controller.sessionSnapshot().lifecycle, 'time-up');

  const countAfterFailure = commands.length;
  assert.throws(() => controller.timeUp(), /only while running/);
  assert.equal(commands.length, countAfterFailure);
});

test('post-attach failure rolls back the exact Time Up owner before a single successful commit', () => {
  const { controller, blade, node, physics } = harness();
  controller.activateCrazyLayer(0);
  controller.completeIntro();
  controller.addScore(73);
  controller.timeUp();

  let committedResultCount = 0;
  let currentScreen: 'crazy' | 'result' | null = 'crazy';
  let disposedCrazyOwnerCount = 0;
  let disposedResultCount = 0;
  let liveCrazyOwnerCount = 1;
  let liveResultCount = 0;
  let pendingResult: Readonly<{ attached: boolean }> | null = null;
  let recordedScoreCount = 0;
  const timeManagerOwner = { disposed: false };

  node.on(CRAZY_SESSION_COMMAND_EVENT, (command) => {
    if (
      command === null
      || typeof command !== 'object'
      || !('type' in command)
    ) {
      return;
    }
    if (command.type === 'capture-crazy-parent') {
      assert.equal(pendingResult, null);
      const transaction = { attached: false };
      pendingResult = transaction;
      controller.enlistTimeUpFinishParticipant({
        prepareCommit() {
          assert.equal(pendingResult, transaction);
          assert.equal(transaction.attached, true);
          assert.equal(currentScreen, 'result');
        },
        commit() {
          assert.equal(pendingResult, transaction);
          assert.equal(transaction.attached, true);
          assert.equal(currentScreen, 'result');
          committedResultCount += 1;
          recordedScoreCount += 1;
          disposedCrazyOwnerCount += 1;
          liveCrazyOwnerCount -= 1;
          timeManagerOwner.disposed = true;
          pendingResult = null;
        },
        rollback() {
          assert.equal(pendingResult, transaction);
          if (transaction.attached) {
            assert.equal(currentScreen, 'result');
            currentScreen = null;
            liveResultCount -= 1;
            disposedResultCount += 1;
          }
          assert.equal(currentScreen, null);
          currentScreen = 'crazy';
          pendingResult = null;
        },
      });
    } else if (command.type === 'remove-crazy') {
      assert.equal(currentScreen, 'crazy');
      currentScreen = null;
    } else if (command.type === 'attach-result') {
      assert.notEqual(pendingResult, null);
      assert.equal(currentScreen, null);
      (pendingResult as { attached: boolean }).attached = true;
      currentScreen = 'result';
      liveResultCount += 1;
    }
  });

  const postAttachFailure = new Error('injected post-attach observer failure');
  const failAfterAttach = (command: unknown) => {
    if (
      command !== null
      && typeof command === 'object'
      && 'type' in command
      && command.type === 'attach-result'
    ) {
      throw postAttachFailure;
    }
  };
  node.on(CRAZY_SESSION_COMMAND_EVENT, failAfterAttach);

  assert.throws(() => controller.timeUpFinish(), (error) => error === postAttachFailure);
  assert.equal(currentScreen, 'crazy');
  assert.equal(liveCrazyOwnerCount, 1);
  assert.equal(liveResultCount, 0);
  assert.equal(disposedResultCount, 1);
  assert.equal(disposedCrazyOwnerCount, 0);
  assert.equal(recordedScoreCount, 0);
  assert.equal(timeManagerOwner.disposed, false);
  assert.equal(controller.active, true);
  assert.equal(controller.sessionSnapshot().lifecycle, 'time-up');
  assert.equal(controller.sessionSnapshot().score.authoritativeScore, 73);
  assert.equal(physics.active, true);
  assert.deepEqual(blade.events.slice(-2), ['activate', 'cut:true']);

  node.off(CRAZY_SESSION_COMMAND_EVENT, failAfterAttach);
  controller.timeUpFinish();
  assert.equal(currentScreen, 'result');
  assert.equal(liveCrazyOwnerCount, 0);
  assert.equal(liveResultCount, 1);
  assert.equal(disposedResultCount, 1);
  assert.equal(disposedCrazyOwnerCount, 1);
  assert.equal(committedResultCount, 1);
  assert.equal(recordedScoreCount, 1);
  assert.equal(timeManagerOwner.disposed, true);
  assert.equal(controller.active, false);
  assert.equal(controller.sessionSnapshot().lifecycle, 'result-removed');
});

test('post-commit snapshot observer failure is reported without rearming a disposed finish owner', () => {
  const { controller, node } = harness();
  controller.activateCrazyLayer(0);
  controller.completeIntro();
  controller.timeUp();
  let commitCount = 0;
  node.on(CRAZY_SESSION_COMMAND_EVENT, (command) => {
    if (
      command !== null
      && typeof command === 'object'
      && 'type' in command
      && command.type === 'capture-crazy-parent'
    ) {
      controller.enlistTimeUpFinishParticipant({
        prepareCommit() {},
        commit() {
          commitCount += 1;
        },
        rollback() {
          throw new Error('committed finish must not roll back');
        },
      });
    }
  });
  const observerFailure = new Error('injected committed snapshot observer failure');
  node.on(CRAZY_SESSION_SNAPSHOT_EVENT, (snapshot) => {
    if (
      snapshot !== null
      && typeof snapshot === 'object'
      && 'lifecycle' in snapshot
      && snapshot.lifecycle === 'result-removed'
    ) {
      throw observerFailure;
    }
  });
  const reported: unknown[] = [];
  const originalConsoleError = console.error;
  console.error = (error: unknown) => {
    reported.push(error);
  };
  try {
    controller.timeUpFinish();
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(commitCount, 1);
  assert.deepEqual(reported, [observerFailure]);
  assert.equal(controller.active, false);
  assert.equal(controller.sessionSnapshot().lifecycle, 'result-removed');
});

function harness() {
  const node = new cc.Node('Canvas');
  const blade = node.addComponent(bladeModule.BladeInputController);
  const controller = node.addComponent(CrazySceneController as never) as InstanceType<
    typeof CrazySceneController
  >;
  controller.onLoad();
  const physics = physicsModule.instances.at(-1);
  assert.ok(physics);
  return { blade, controller, node, physics };
}
