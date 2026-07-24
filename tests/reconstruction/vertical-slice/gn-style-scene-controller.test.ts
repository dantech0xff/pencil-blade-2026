import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

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
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(
      (value) => value !== callback
    ));
  }
  emit(type, payload) {
    for (const callback of [...(this.listeners.get(type) ?? [])]) callback(payload);
  }
}
export class Component {
  constructor() { this.node = null; }
  getComponent(Type) { return this.node?.getComponent(Type) ?? null; }
}
`)}`;

const BLADE_INPUT_STUB_URL = `data:text/javascript,${encodeURIComponent(`
const segment = Object.freeze({
  current: Object.freeze({ x: 4, y: 5 }),
  previous: Object.freeze({ x: 1, y: 1 }),
  slot: 0,
  touchId: 7,
});
export class BladeInputController {
  constructor() {
    this.active = false;
    this.activeLeaseCount = 0;
    this.activateCalls = 0;
    this.deactivateCalls = 0;
    this.events = [];
    this.failActivateCount = 0;
    this.failDeactivateCount = 0;
    this.maxActiveLeaseCount = 0;
    this.segments = Object.freeze([segment]);
  }
  activateForClassicLayer() {
    this.activateCalls += 1;
    if (this.active) {
      this.events.push('activate-inert');
      return;
    }
    this.events.push('activate');
    if (this.failActivateCount > 0) {
      this.failActivateCount -= 1;
      this.events.push('activate-failed');
      throw new Error('injected ordinary input activation failure');
    }
    this.active = true;
    this.activeLeaseCount += 1;
    this.maxActiveLeaseCount = Math.max(
      this.maxActiveLeaseCount,
      this.activeLeaseCount,
    );
  }
  deactivateForNonClassicScreen() {
    this.deactivateCalls += 1;
    if (!this.active) {
      this.events.push('deactivate-inert');
      return;
    }
    this.events.push('deactivate');
    if (this.failDeactivateCount > 0) {
      this.failDeactivateCount -= 1;
      this.events.push('deactivate-failed');
      throw new Error('injected ordinary input deactivation failure');
    }
    this.active = false;
    this.activeLeaseCount -= 1;
  }
  segmentsForPostPhysicsUpdate() {
    return this.active ? this.segments : Object.freeze([]);
  }
}
`)}`;

const PHYSICS_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const instances = [];
export class ClassicPhysicsAdapter {
  constructor() {
    this.active = false;
    this.afterStep = null;
    this.calls = [];
    this.failConfigure = false;
    this.failRestoreCount = 0;
    this.failStart = false;
    this.resolveDelta = null;
    instances.push(this);
  }
  configureResolvedWorldProperties() {
    this.calls.push('configure');
    if (this.failConfigure) throw new Error('injected configure failure');
  }
  startVariableSimulation(resolveDelta, afterStep) {
    this.calls.push('start');
    if (this.failStart) throw new Error('injected start failure');
    this.active = true;
    this.resolveDelta = resolveDelta;
    this.afterStep = afterStep;
  }
  restorePreviousWorldProperties() {
    this.calls.push('restore');
    this.active = false;
    this.resolveDelta = null;
    this.afterStep = null;
    if (this.failRestoreCount > 0) {
      this.failRestoreCount -= 1;
      throw new Error('injected restore failure');
    }
  }
  setWorldStopped(stopped) {
    this.calls.push('stopped:' + String(stopped));
  }
  raycastAll() {
    this.calls.push('raycast');
    return ['gn-style-hit'];
  }
  callAfterStep(mutation) {
    this.calls.push('after-step');
    mutation();
  }
  emitFrame(frameDeltaSeconds) {
    if (!this.active) return null;
    const resolved = this.resolveDelta(frameDeltaSeconds);
    this.afterStep(resolved);
    return resolved;
  }
}
`)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') {
      return { shortCircuit: true, url: CC_STUB_URL };
    }
    if (specifier === './blade-input-controller') {
      return { shortCircuit: true, url: BLADE_INPUT_STUB_URL };
    }
    if (specifier === './classic-physics-adapter') {
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
const bladeInputModule = await import(
  BLADE_INPUT_STUB_URL
) as unknown as BladeInputModule;
const physicsModule = await import(
  PHYSICS_STUB_URL
) as unknown as PhysicsModule;
const {
  GN_STYLE_PHYSICS_STEPPED_EVENT,
  GN_STYLE_SESSION_COMMAND_EVENT,
  GN_STYLE_SESSION_SNAPSHOT_EVENT,
  GnStyleLifecycleRollbackError,
  GnStyleSceneController,
  GnStyleTimeUpDispatchError,
  GnStyleTimeUpFinishCommitError,
  GnStyleTimeUpFinishRollbackError,
} = await import(
  '../../../game/assets/scripts/creator/gn-style-scene-controller.ts'
);

interface StubNode {
  addComponent<T>(Type: new () => T): T;
  emit(type: string, payload?: unknown): void;
  off(type: string, callback: (payload: unknown) => void): void;
  on(type: string, callback: (payload: unknown) => void): void;
}

interface CocosStub {
  readonly Node: new (name?: string) => StubNode;
}

interface BladeInputStub {
  active: boolean;
  activeLeaseCount: number;
  activateCalls: number;
  deactivateCalls: number;
  readonly events: string[];
  failActivateCount: number;
  failDeactivateCount: number;
  maxActiveLeaseCount: number;
  readonly segments: readonly unknown[];
}

interface BladeInputModule {
  readonly BladeInputController: new () => BladeInputStub;
}

interface PhysicsStub {
  active: boolean;
  readonly calls: string[];
  emitFrame(frameDeltaSeconds: number): number | null;
  failConfigure: boolean;
  failRestoreCount: number;
  failStart: boolean;
}

interface PhysicsModule {
  readonly instances: PhysicsStub[];
}

class ScriptedRandom {
  readonly calls: string[] = [];
  private readonly deciles: number[];
  private readonly integers: number[];

  constructor(
    deciles: readonly number[] = Array(256).fill(0),
    integers: readonly number[] = [],
  ) {
    this.deciles = [...deciles];
    this.integers = [...integers];
  }

  nextRawNonNegativeInt(): number {
    this.calls.push('raw');
    return 0;
  }

  nextIntInclusive(min: number, max: number): number {
    const value = this.integers.shift() ?? min;
    this.calls.push(`int:${min}:${max}:${value}`);
    return value;
  }

  nextDecile(): number {
    const value = this.deciles.shift();
    if (value === undefined) {
      throw new Error('decile script exhausted');
    }
    this.calls.push(`decile:${value}`);
    return value;
  }
}

class RecordingPlanner {
  readonly random: ScriptedRandom;
  readonly requests: Array<Readonly<{
    direction: number;
    effectsEnabled: boolean;
    tossType: number;
  }>> = [];
  private nextId = 1;

  constructor(random: ScriptedRandom) {
    this.random = random;
  }

  planSpawn(request: Readonly<{
    direction: number;
    effectsEnabled: boolean;
    tossType: number;
  }>) {
    const entityOccurrenceId = this.nextId;
    this.nextId += 1;
    this.requests.push(Object.freeze({
      direction: request.direction,
      effectsEnabled: request.effectsEnabled,
      tossType: request.tossType,
    }));
    return Object.freeze({
      commands: Object.freeze([
        Object.freeze({
          critical: false,
          entityOccurrenceId,
          fruitId: 0,
          tossType: 0,
          type: 'create-fruit',
        }),
      ]),
      entityOccurrenceId,
    });
  }
}

test('source is a serialized GN-only Creator owner with a valid metadata UUID', () => {
  const controllerPath = fileURLToPath(new URL(
    '../../../game/assets/scripts/creator/gn-style-scene-controller.ts',
    import.meta.url,
  ));
  const source = readFileSync(controllerPath, 'utf8');
  const metadata = JSON.parse(
    readFileSync(`${controllerPath}.meta`, 'utf8'),
  ) as Readonly<{
    importer: string;
    uuid: string;
    ver: string;
  }>;

  assert.match(source, /@ccclass\('GnStyleSceneController'\)/);
  assert.match(source, /@requireComponent\(BladeInputController\)/);
  assert.match(source, /new GnStyleSession\(/);
  assert.match(source, /new GnStyleTossCoordinator\(/);
  assert.match(source, /new ClassicPhysicsAdapter\(/);
  assert.match(source, /private inputLeaseActive = false/);
  assert.doesNotMatch(source, /from ['"][^'"]*(bird|crazy)[^'"]*['"]/i);
  assert.deepEqual(metadata, {
    files: [],
    imported: true,
    importer: 'typescript',
    subMetas: {},
    userData: {},
    uuid: '7334546e-ceae-4335-aba7-ddaa5400dc3d',
    ver: '4.0.24',
  });
});

test('passive mode-2 owner emits exact commands and ticks tosses before TimeManager', () => {
  const { controller, input, node, physics } = harness();
  const runtime = runtimeOptions(new ScriptedRandom());
  const commands: Array<Readonly<{
    card?: string;
    controller?: string;
    score?: number;
    type: string;
  }>> = [];
  const snapshots: unknown[] = [];
  const physicsSteps: unknown[] = [];
  node.on(GN_STYLE_SESSION_COMMAND_EVENT, (command) => {
    commands.push(command as never);
  });
  node.on(GN_STYLE_SESSION_SNAPSHOT_EVENT, (snapshot) => {
    snapshots.push(snapshot);
  });
  node.on(GN_STYLE_PHYSICS_STEPPED_EVENT, (payload) => {
    physicsSteps.push(payload);
  });

  assert.equal(controller.readyForActivation, true);
  assert.deepEqual(input.events, [], 'onLoad/start must remain passive');
  assert.equal(GN_STYLE_SESSION_COMMAND_EVENT, 'gn-style-session-command');
  assert.equal(GN_STYLE_SESSION_SNAPSHOT_EVENT, 'gn-style-session-snapshot');
  assert.equal(GN_STYLE_PHYSICS_STEPPED_EVENT, 'gn-style-physics-stepped');

  controller.start();
  controller.activateGnStyleLayer(77, runtime.options);

  assert.equal(controller.active, true);
  assert.equal(controller.sessionSnapshot().mode, 2);
  assert.deepEqual(input.events, ['activate']);
  assert.equal(input.activeLeaseCount, 1);
  assert.equal(input.maxActiveLeaseCount, 1);
  assert.deepEqual(physics.calls.slice(0, 3), [
    'configure',
    'start',
    'stopped:false',
  ]);
  assert.deepEqual(runtime.commands.map(({ type }) => type), [
    'create-wave-child',
    'attach-wave-child',
    'start-wave-child',
    'pause-wave-child',
  ]);
  assert.deepEqual(commands.slice(0, 2), [
    { type: 'enter-base-gameplay-layer' },
    { payload: 0, selector: 6, type: 'process-objective' },
  ]);
  assert.deepEqual(
    commands
      .filter(({ type }) => type === 'construct-controller')
      .map(({ controller: id }) => id),
    ['free', 'wave', 'concurrent'],
  );
  assert.deepEqual(
    commands
      .filter(({ type }) => type === 'create-instruction-card')
      .map(({ card }) => card),
    ['no-bomb', 'gn-style', 'no-life'],
  );
  assert.deepEqual(
    commands
      .filter(({ type }) => type === 'attach-instruction-card')
      .map(({ card }) => card),
    ['gn-style', 'no-bomb', 'no-life'],
  );
  assert.deepEqual(
    commands.find(({ type }) => type === 'initialize-best-score'),
    { key: 'gnstyle_best_1', score: 77, type: 'initialize-best-score' },
  );
  assert.equal(
    (snapshots.at(-1) as Readonly<{ lifecycle: string }>).lifecycle,
    'intro-instructions',
  );

  commands.length = 0;
  controller.totalTimeCallback();
  controller.goCallback();
  controller.startGameCallback();
  assert.deepEqual(commands.map(({ type, controller: id }) => (
    type === 'start-controller' ? `${type}:${String(id)}` : type
  )), [
    'create-one-hundred-fifty-intro',
    'create-go-intro',
    'start-controller:free',
    'start-controller:wave',
    'start-controller:concurrent',
    'start-time-manager',
  ]);
  assert.equal(controller.sessionSnapshot().lifecycle, 'running');

  runtime.timeline.length = 0;
  controller.tickCoordinatorBeforeTimeManager(0.51, (deltaSeconds) => {
    runtime.timeline.push(`timer:${String(deltaSeconds)}`);
  });
  const tossIndex = runtime.timeline.indexOf('toss:create-fruit');
  const timerIndex = runtime.timeline.indexOf('timer:0.51');
  assert.notEqual(tossIndex, -1);
  assert.equal(tossIndex < timerIndex, true);

  assert.equal(physics.emitFrame(0.016), Math.fround(0.016));
  assert.deepEqual(physicsSteps, [{
    bladeSegments: input.segments,
    deltaSeconds: Math.fround(0.016),
  }]);
  assert.deepEqual(
    controller.raycastAll({ x: 0, y: 0 }, { x: 1, y: 1 }),
    ['gn-style-hit'],
  );
});

test('TIME UP stops only outers while input, physics, score, misses, and Wave child stay live', () => {
  const random = new ScriptedRandom([
    0, // setup Wave child
    0.9, // Free start
    0, // Wave start
    0.9, // Concurrent start
    0.9, // Free rearm on the pre-zero frame
    0.9, // Wave outer rearm
    0.9, // Wave active window
    0, // Wave child rearm on the pre-zero frame
    0, // Wave child rearm during Time Up
    0, // Wave child rearm before the armed pause
    ...Array(64).fill(0),
  ]);
  const { controller, input, node, physics } = harness();
  const runtime = runtimeOptions(random);
  const commands: Array<Readonly<{
    controller?: string;
    payload?: number;
    score?: number;
    type: string;
  }>> = [];
  node.on(GN_STYLE_SESSION_COMMAND_EVENT, (command) => {
    commands.push(command as never);
  });
  controller.activateGnStyleLayer(0, runtime.options);
  enterRunning(controller);

  let timerTickCount = 0;
  controller.tickCoordinatorBeforeTimeManager(3.51, () => {
    timerTickCount += 1;
  });
  assert.equal(timerTickCount, 1);
  assert.equal(runtime.planner.requests.length, 2);
  const armedWave = controller.tossControllerSnapshot('wave');
  assert.equal(armedWave.controller, 'wave');
  assert.equal(armedWave.childTimer.scheduled, true);
  assert.equal(armedWave.pendingPauseRequestIds.length, 1);

  commands.length = 0;
  controller.timeUp();
  assert.deepEqual(commands.map((command) => (
    command.type === 'stop-controller'
      ? `${command.type}:${String(command.controller)}`
      : `${command.type}:${String(command.payload)}`
  )), [
    'stop-controller:free',
    'stop-controller:wave',
    'stop-controller:concurrent',
    'process-objective:2',
  ]);
  assert.equal(controller.active, true);
  assert.equal(input.active, true);
  assert.equal(physics.active, true);
  assert.deepEqual(controller.sessionSnapshot().activity, {
    comboActive: true,
    entitiesActive: true,
    inputActive: true,
    ordinaryBladeActive: true,
    outerTossControllersActive: false,
    physicsActive: true,
    scoreActive: true,
  });

  controller.tickCoordinatorBeforeTimeManager(0.26, () => {
    timerTickCount += 1;
  });
  controller.tickCoordinatorBeforeTimeManager(5.28, () => {
    timerTickCount += 1;
  });
  assert.equal(timerTickCount, 1, 'TimeManager remains stopped after zero');
  assert.equal(runtime.planner.requests.length, 4);
  controller.tickCoordinatorBeforeTimeManager(0.02, () => {
    timerTickCount += 1;
  });
  const pausedWave = controller.tossControllerSnapshot('wave');
  assert.equal(pausedWave.controller, 'wave');
  assert.equal(pausedWave.childTimer.scheduled, false);
  assert.equal(pausedWave.pendingPauseRequestIds.length, 0);
  const requestsAfterPause = runtime.planner.requests.length;
  controller.tickCoordinatorBeforeTimeManager(100, () => {
    timerTickCount += 1;
  });
  assert.equal(runtime.planner.requests.length, requestsAfterPause);
  assert.equal(timerTickCount, 1);

  let mutationCalls = 0;
  controller.callAfterPhysicsStep(() => {
    mutationCalls += 1;
  });
  assert.equal(mutationCalls, 1);
  assert.equal(physics.calls.at(-1), 'after-step');
  assert.equal(physics.emitFrame(0.025), Math.fround(0.025));
  assert.deepEqual(
    controller.raycastAll({ x: 0, y: 0 }, { x: 2, y: 2 }),
    ['gn-style-hit'],
  );

  commands.length = 0;
  controller.checkCombo({ x: 1, y: 2 });
  controller.fruitCut({ x: 3, y: 4 }, 8, 10);
  controller.addScore(3);
  controller.fruitFail({ x: 5, y: 6 });
  controller.bonusFruitFail({ x: 7, y: 8 });
  controller.update(0.016);
  assert.equal(controller.sessionSnapshot().score.authoritativeScore, 13);
  assert.equal(commands.some(({ type }) => type === 'check-combo'), true);
  assert.equal(
    commands.filter(({ type, payload }) => (
      type === 'process-objective' && payload === 1
    )).length,
    2,
  );
  assert.equal(
    commands.some(({ type }) => type === 'start-displayed-score-scale-up'),
    true,
  );

  let participantCommitCount = 0;
  enlistResultParticipant(controller, node, {
    commit() {
      participantCommitCount += 1;
    },
    rollback() {
      assert.fail('successful Result must not roll back');
    },
  });
  commands.length = 0;
  controller.timeUpFinish();
  assert.deepEqual(
    commands.find(({ type }) => type === 'set-result-score'),
    { score: 13, type: 'set-result-score' },
  );
  assert.equal(participantCommitCount, 1);
  assert.equal(controller.sessionSnapshot().lifecycle, 'result-removed');
  assert.equal(controller.active, false);
  assert.equal(input.active, false);
  assert.equal(input.activeLeaseCount, 0);
  assert.equal(physics.active, false);
});

test('suspend, resume, finalize, replacement, and stale cleanup are idempotent', () => {
  const { controller: retired, input, node, physics } = harness();
  retired.activateGnStyleLayer(12, runtimeOptions().options);
  enterRunning(retired);
  retired.fruitCut({ x: 0, y: 0 }, 0, 9);
  retired.tickCoordinatorBeforeTimeManager(0.25, () => {});
  const retainedSession = retired.sessionSnapshot();
  const retainedFree = retired.tossControllerSnapshot('free');

  retired.suspendGnStyleLayerForNavigation();
  const callsAfterSuspend = {
    deactivate: input.deactivateCalls,
    restore: physics.calls.filter((call) => call === 'restore').length,
  };
  retired.suspendGnStyleLayerForNavigation();
  assert.equal(retired.active, false);
  assert.equal(retired.suspended, true);
  assert.deepEqual(retired.sessionSnapshot(), retainedSession);
  assert.deepEqual(retired.tossControllerSnapshot('free'), retainedFree);
  assert.equal(input.deactivateCalls, callsAfterSuspend.deactivate);
  assert.equal(
    physics.calls.filter((call) => call === 'restore').length,
    callsAfterSuspend.restore,
  );

  retired.resumeSuspendedGnStyleLayer();
  const callsAfterResume = input.activateCalls;
  retired.resumeSuspendedGnStyleLayer();
  assert.equal(retired.active, true);
  assert.equal(retired.suspended, false);
  assert.deepEqual(retired.sessionSnapshot(), retainedSession);
  assert.deepEqual(retired.tossControllerSnapshot('free'), retainedFree);
  assert.equal(input.activateCalls, callsAfterResume);
  assert.equal(input.activeLeaseCount, 1);
  assert.equal(input.maxActiveLeaseCount, 1);

  retired.suspendGnStyleLayerForNavigation();
  const standby = node.addComponent(
    GnStyleSceneController as never,
  ) as InstanceType<typeof GnStyleSceneController>;
  standby.onLoad();
  const eventsBeforeStandbyActivation = [...input.events];
  assert.deepEqual(input.events, eventsBeforeStandbyActivation);
  standby.activateGnStyleLayer(0, runtimeOptions().options);
  const eventCountWithNewOwner = input.events.length;
  retired.onDestroy();
  retired.onDestroy();
  assert.equal(input.events.length, eventCountWithNewOwner);
  assert.equal(input.active, true);
  assert.equal(input.activeLeaseCount, 1);
  assert.equal(input.maxActiveLeaseCount, 1);
  assert.equal(standby.active, true);

  standby.suspendGnStyleLayerForNavigation();
  standby.finalizeSuspendedGnStyleLayerRelease();
  standby.finalizeSuspendedGnStyleLayerRelease();
  assert.equal(standby.sessionSnapshot().lifecycle, 'constructed');
  assert.doesNotThrow(() => standby.releaseGnStyleLayerForReplacement());

  standby.activateGnStyleLayer(99, runtimeOptions().options);
  standby.releaseGnStyleLayerForReplacement();
  standby.releaseGnStyleLayerForReplacement();
  assert.equal(standby.active, false);
  assert.equal(standby.sessionSnapshot().lifecycle, 'constructed');
  assert.equal(input.activeLeaseCount, 0);
});

test('activation faults restore the constructed boundary and never exceed one lease', () => {
  const configureHarness = harness();
  configureHarness.physics.failConfigure = true;
  assert.throws(
    () => configureHarness.controller.activateGnStyleLayer(
      0,
      runtimeOptions().options,
    ),
    /injected configure failure/,
  );
  assert.equal(configureHarness.controller.readyForActivation, true);
  assert.equal(configureHarness.input.activateCalls, 0);
  assert.equal(configureHarness.input.activeLeaseCount, 0);
  assert.equal(configureHarness.physics.active, false);
  configureHarness.physics.failConfigure = false;
  configureHarness.controller.activateGnStyleLayer(0, runtimeOptions().options);
  assert.equal(configureHarness.input.maxActiveLeaseCount, 1);

  const inputHarness = harness();
  inputHarness.input.failActivateCount = 1;
  assert.throws(
    () => inputHarness.controller.activateGnStyleLayer(
      0,
      runtimeOptions().options,
    ),
    /injected ordinary input activation failure/,
  );
  assert.equal(inputHarness.controller.readyForActivation, true);
  assert.equal(inputHarness.input.activeLeaseCount, 0);
  assert.equal(inputHarness.physics.active, false);
  inputHarness.controller.activateGnStyleLayer(0, runtimeOptions().options);
  assert.equal(inputHarness.input.activeLeaseCount, 1);
  assert.equal(inputHarness.input.maxActiveLeaseCount, 1);

  const dispatchHarness = harness();
  const dispatchFailure = new Error('injected enter dispatch failure');
  const failEnter = (command: unknown): void => {
    if (isCommand(command, 'enter-base-gameplay-layer')) {
      throw dispatchFailure;
    }
  };
  dispatchHarness.node.on(GN_STYLE_SESSION_COMMAND_EVENT, failEnter);
  assert.throws(
    () => dispatchHarness.controller.activateGnStyleLayer(
      0,
      runtimeOptions().options,
    ),
    (error: unknown) => error === dispatchFailure,
  );
  assert.equal(dispatchHarness.controller.readyForActivation, true);
  assert.equal(dispatchHarness.controller.sessionSnapshot().lifecycle, 'constructed');
  assert.equal(dispatchHarness.input.activeLeaseCount, 0);
  assert.equal(dispatchHarness.physics.active, false);
  dispatchHarness.node.off(GN_STYLE_SESSION_COMMAND_EVENT, failEnter);
  dispatchHarness.controller.activateGnStyleLayer(0, runtimeOptions().options);
  assert.equal(dispatchHarness.input.activeLeaseCount, 1);
  assert.equal(dispatchHarness.input.maxActiveLeaseCount, 1);
});

test('navigation faults either restore one live lease or enter typed fatal quiescence', () => {
  const inputHarness = harness();
  inputHarness.controller.activateGnStyleLayer(0, runtimeOptions().options);
  inputHarness.input.failDeactivateCount = 1;
  assert.throws(
    () => inputHarness.controller.suspendGnStyleLayerForNavigation(),
    /injected ordinary input deactivation failure/,
  );
  assert.equal(inputHarness.controller.active, true);
  assert.equal(inputHarness.controller.suspended, false);
  assert.equal(inputHarness.input.activeLeaseCount, 1);
  assert.equal(inputHarness.input.maxActiveLeaseCount, 1);
  assert.equal(inputHarness.physics.active, true);

  const restoredHarness = harness();
  restoredHarness.controller.activateGnStyleLayer(0, runtimeOptions().options);
  restoredHarness.physics.failRestoreCount = 1;
  assert.throws(
    () => restoredHarness.controller.suspendGnStyleLayerForNavigation(),
    /injected restore failure/,
  );
  assert.equal(restoredHarness.controller.active, true);
  assert.equal(restoredHarness.controller.suspended, false);
  assert.equal(restoredHarness.input.activeLeaseCount, 1);
  assert.equal(restoredHarness.input.maxActiveLeaseCount, 1);
  assert.equal(restoredHarness.physics.active, true);
  assert.deepEqual(restoredHarness.physics.calls.slice(-3), [
    'configure',
    'start',
    'stopped:false',
  ]);

  const fatalHarness = harness();
  fatalHarness.controller.activateGnStyleLayer(0, runtimeOptions().options);
  fatalHarness.physics.failRestoreCount = 2;
  assert.throws(
    () => fatalHarness.controller.suspendGnStyleLayerForNavigation(),
    (error: unknown) => {
      assert.ok(error instanceof GnStyleLifecycleRollbackError);
      assert.match(
        error.message,
        /GN Style navigation suspension rollback failed/,
      );
      assert.equal(error.rollbackErrors.length >= 1, true);
      return true;
    },
  );
  assert.equal(fatalHarness.controller.active, false);
  assert.equal(fatalHarness.controller.suspended, false);
  assert.equal(fatalHarness.controller.fatalLifecycle, true);
  assert.equal(fatalHarness.controller.readyForActivation, false);
  assert.equal(fatalHarness.input.activeLeaseCount, 0);
  assert.equal(fatalHarness.physics.active, false);
  assert.doesNotThrow(() => fatalHarness.controller.onDestroy());
});

test('destroy retries unresolved cleanup without ever acquiring a second lease', () => {
  const { controller, input, physics } = harness();
  controller.activateGnStyleLayer(0, runtimeOptions().options);
  input.failDeactivateCount = 1;
  physics.failRestoreCount = 1;

  assert.throws(
    () => controller.onDestroy(),
    (error: unknown) => {
      assert.ok(error instanceof GnStyleLifecycleRollbackError);
      assert.match(error.message, /GN Style destruction cleanup failed/);
      assert.equal(error.rollbackErrors.length, 1);
      return true;
    },
  );
  assert.equal(controller.active, false);
  assert.equal(controller.fatalLifecycle, true);
  assert.equal(controller.readyForActivation, false);
  assert.equal(input.activeLeaseCount, 1);
  assert.equal(physics.active, false);

  assert.doesNotThrow(() => controller.onDestroy());
  const callsAfterRetry = {
    activate: input.activateCalls,
    deactivate: input.deactivateCalls,
    restore: physics.calls.filter((call) => call === 'restore').length,
  };
  assert.equal(input.activeLeaseCount, 0);
  assert.equal(input.maxActiveLeaseCount, 1);
  assert.equal(physics.active, false);
  assert.doesNotThrow(() => controller.onDestroy());
  assert.deepEqual({
    activate: input.activateCalls,
    deactivate: input.deactivateCalls,
    restore: physics.calls.filter((call) => call === 'restore').length,
  }, callsAfterRetry);
});

test('Time Up drains its ordered suffix once and aggregates observer failures', () => {
  const { controller, node } = harness();
  controller.activateGnStyleLayer(0, runtimeOptions().options);
  enterRunning(controller);
  const waveFailure = new Error('injected Wave stop observer failure');
  const objectiveFailure = new Error('injected objective observer failure');
  const commands: Array<Readonly<{
    controller?: string;
    payload?: number;
    type: string;
  }>> = [];
  node.on(GN_STYLE_SESSION_COMMAND_EVENT, (command) => {
    const typed = command as typeof commands[number];
    commands.push(typed);
    if (typed.type === 'stop-controller' && typed.controller === 'wave') {
      throw waveFailure;
    }
    if (typed.type === 'process-objective' && typed.payload === 2) {
      throw objectiveFailure;
    }
  });

  assert.throws(
    () => controller.timeUp(),
    (error: unknown) => {
      assert.ok(error instanceof GnStyleTimeUpDispatchError);
      assert.equal(error.cause, waveFailure);
      assert.deepEqual(error.errors, [waveFailure, objectiveFailure]);
      return true;
    },
  );
  assert.deepEqual(commands.map((command) => (
    command.type === 'stop-controller'
      ? `stop:${String(command.controller)}`
      : `objective:${String(command.payload)}`
  )), [
    'stop:free',
    'stop:wave',
    'stop:concurrent',
    'objective:2',
  ]);
  for (const id of ['free', 'wave', 'concurrent'] as const) {
    assert.equal(controller.tossControllerSnapshot(id).timer.scheduled, false);
  }
  assert.equal(controller.sessionSnapshot().lifecycle, 'time-up-presentation');
  const commandCount = commands.length;
  assert.throws(() => controller.timeUp(), /only while running/);
  assert.equal(commands.length, commandCount);
});

test('Result dispatch rollback restores leases and resamples late score before one commit', () => {
  const { controller, input, node, physics } = harness();
  controller.activateGnStyleLayer(0, runtimeOptions().options);
  enterRunning(controller);
  controller.fruitCut({ x: 0, y: 0 }, 0, 5);
  controller.timeUp();

  let commitCount = 0;
  let rollbackCount = 0;
  const sampledScores: number[] = [];
  node.on(GN_STYLE_SESSION_COMMAND_EVENT, (command) => {
    if (isCommand(command, 'capture-gn-style-parent')) {
      controller.enlistTimeUpFinishParticipant({
        prepareCommit() {},
        commit() {
          commitCount += 1;
        },
        rollback() {
          rollbackCount += 1;
        },
      });
    }
    if (
      isCommand(command, 'set-result-score')
      && 'score' in command
      && typeof command.score === 'number'
    ) {
      sampledScores.push(command.score);
    }
  });
  let failAttach = true;
  node.on(GN_STYLE_SESSION_COMMAND_EVENT, (command) => {
    if (failAttach && isCommand(command, 'attach-result')) {
      failAttach = false;
      throw new Error('injected GN Style Result attachment failure');
    }
  });

  assert.throws(
    () => controller.timeUpFinish(),
    /injected GN Style Result attachment failure/,
  );
  assert.equal(rollbackCount, 1);
  assert.equal(commitCount, 0);
  assert.equal(controller.active, true);
  assert.equal(controller.sessionSnapshot().lifecycle, 'time-up-presentation');
  assert.equal(input.activeLeaseCount, 1);
  assert.equal(input.maxActiveLeaseCount, 1);
  assert.equal(physics.active, true);
  assert.deepEqual(physics.calls.slice(-3), [
    'configure',
    'start',
    'stopped:false',
  ]);

  controller.fruitCut({ x: 0, y: 0 }, 0, 7);
  controller.timeUpFinish();
  assert.deepEqual(sampledScores, [5, 12]);
  assert.equal(rollbackCount, 1);
  assert.equal(commitCount, 1);
  assert.equal(controller.active, false);
  assert.equal(controller.sessionSnapshot().lifecycle, 'result-removed');
});

test('missing, prepare, and rollback participant failures preserve atomic Result ownership', () => {
  const missing = harness();
  missing.controller.activateGnStyleLayer(0, runtimeOptions().options);
  enterRunning(missing.controller);
  missing.controller.timeUp();
  assert.throws(
    () => missing.controller.timeUpFinish(),
    /requires an enlisted gameplay participant/,
  );
  assert.equal(missing.controller.active, true);
  assert.equal(missing.controller.sessionSnapshot().lifecycle, 'time-up-presentation');
  assert.equal(missing.input.activeLeaseCount, 1);
  assert.equal(missing.physics.active, true);

  const prepare = harness();
  prepare.controller.activateGnStyleLayer(0, runtimeOptions().options);
  enterRunning(prepare.controller);
  prepare.controller.timeUp();
  let prepareRollbackCount = 0;
  const prepareFailure = new Error('injected participant prepare failure');
  enlistResultParticipant(prepare.controller, prepare.node, {
    prepareCommit() {
      throw prepareFailure;
    },
    rollback() {
      prepareRollbackCount += 1;
    },
  });
  assert.throws(
    () => prepare.controller.timeUpFinish(),
    (error: unknown) => error === prepareFailure,
  );
  assert.equal(prepareRollbackCount, 1);
  assert.equal(prepare.controller.active, true);
  assert.equal(prepare.input.activeLeaseCount, 1);
  assert.equal(prepare.physics.active, true);

  const rollback = harness();
  rollback.controller.activateGnStyleLayer(0, runtimeOptions().options);
  enterRunning(rollback.controller);
  rollback.controller.timeUp();
  enlistResultParticipant(rollback.controller, rollback.node, {
    prepareCommit() {
      throw prepareFailure;
    },
    rollback() {
      throw new Error('injected participant rollback failure');
    },
  });
  assert.throws(
    () => rollback.controller.timeUpFinish(),
    (error: unknown) => {
      assert.ok(error instanceof GnStyleTimeUpFinishRollbackError);
      assert.equal(error.cause, prepareFailure);
      assert.equal(
        error.rollbackErrors.some((failure) => (
          String(failure).includes('injected participant rollback failure')
        )),
        true,
      );
      return true;
    },
  );
  assert.equal(rollback.controller.active, true);
  assert.equal(rollback.input.activeLeaseCount, 1);
  assert.equal(rollback.physics.active, true);
});

test('failed Result lease restoration poisons the retained run and quiesces every lease', () => {
  const { controller, input, node, physics } = harness();
  controller.activateGnStyleLayer(0, runtimeOptions().options);
  enterRunning(controller);
  controller.timeUp();
  enlistResultParticipant(controller, node);
  const attachmentFailure = new Error('injected post-removal attachment failure');
  node.on(GN_STYLE_SESSION_COMMAND_EVENT, (command) => {
    if (isCommand(command, 'attach-result')) {
      physics.failStart = true;
      throw attachmentFailure;
    }
  });

  assert.throws(
    () => controller.timeUpFinish(),
    (error: unknown) => {
      assert.ok(error instanceof GnStyleLifecycleRollbackError);
      assert.equal(error.cause, attachmentFailure);
      assert.equal(
        error.rollbackErrors.some((failure) => (
          String(failure).includes('injected start failure')
        )),
        true,
      );
      return true;
    },
  );
  assert.equal(controller.active, false);
  assert.equal(controller.suspended, false);
  assert.equal(controller.fatalLifecycle, true);
  assert.equal(controller.readyForActivation, false);
  assert.equal(controller.sessionSnapshot().lifecycle, 'time-up-presentation');
  assert.equal(input.activeLeaseCount, 0);
  assert.equal(physics.active, false);
  assert.throws(
    () => controller.activateGnStyleLayer(0, runtimeOptions().options),
    /fatal lifecycle failure/,
  );

  physics.failStart = false;
  assert.doesNotThrow(() => controller.onDestroy());
  assert.doesNotThrow(() => controller.onDestroy());
});

test('participant commit failure is irreversible and publishes the removed boundary', () => {
  const { controller, input, node, physics } = harness();
  controller.activateGnStyleLayer(0, runtimeOptions().options);
  enterRunning(controller);
  controller.timeUp();
  let rollbackCount = 0;
  const commitFailure = new Error('injected participant commit failure');
  enlistResultParticipant(controller, node, {
    commit() {
      throw commitFailure;
    },
    rollback() {
      rollbackCount += 1;
    },
  });

  assert.throws(
    () => controller.timeUpFinish(),
    (error: unknown) => {
      assert.ok(error instanceof GnStyleTimeUpFinishCommitError);
      assert.equal(error.cause, commitFailure);
      return true;
    },
  );
  assert.equal(rollbackCount, 0);
  assert.equal(controller.active, false);
  assert.equal(controller.sessionSnapshot().lifecycle, 'result-removed');
  assert.equal(input.activeLeaseCount, 0);
  assert.equal(physics.active, false);
});

test('malformed and out-of-order calls fail before mutating ownership', () => {
  const { controller, input, physics } = harness();
  const runtime = runtimeOptions();
  let immediateMutations = 0;
  controller.callAfterPhysicsStep(() => {
    immediateMutations += 1;
  });
  assert.equal(immediateMutations, 1);
  assert.equal(physics.calls.includes('after-step'), false);
  assert.throws(
    () => controller.callAfterPhysicsStep(null as never),
    /must be a function/,
  );
  assert.throws(
    () => controller.raycastAll({ x: 0, y: 0 }, { x: 1, y: 1 }),
    /active Physics2D lease/,
  );
  assert.throws(
    () => controller.activateGnStyleLayer(Number.NaN, runtime.options),
    /safe integer/,
  );
  assert.throws(
    () => controller.activateGnStyleLayer(0, null as never),
    /options must be an object/,
  );
  assert.equal(controller.sessionSnapshot().lifecycle, 'constructed');
  assert.equal(input.activeLeaseCount, 0);
  assert.equal(physics.active, false);

  controller.activateGnStyleLayer(0, runtime.options);
  const initialWave = controller.tossControllerSnapshot('wave');
  assert.throws(() => controller.goCallback(), /requires the 150s callback/);
  assert.equal(controller.sessionSnapshot().lifecycle, 'intro-instructions');
  assert.throws(
    () => controller.tickCoordinatorBeforeTimeManager(-1, () => {}),
    /finite and non-negative/,
  );
  assert.throws(
    () => controller.tickCoordinatorBeforeTimeManager(1, null as never),
    /must be a function/,
  );
  assert.throws(
    () => controller.tickCoordinatorBeforeTimeManager(1, () => {}),
    /requires running or Time Up/,
  );
  assert.deepEqual(controller.tossControllerSnapshot('wave'), initialWave);
  assert.throws(
    () => controller.fruitCut({ x: 0, y: 0 }, 0, 1),
    /gameplay callbacks require/,
  );
  assert.throws(
    () => controller.enlistTimeUpFinishParticipant(null as never),
    /must provide prepareCommit, commit, and rollback/,
  );
  assert.throws(
    () => controller.enlistTimeUpFinishParticipant({
      prepareCommit() {},
      commit() {},
      rollback() {},
    }),
    /only during command dispatch/,
  );
  assert.doesNotThrow(
    () => controller.resumeSuspendedGnStyleLayer(),
    'resume is idempotent while the same run is already active',
  );
  assert.throws(
    () => controller.finalizeSuspendedGnStyleLayerRelease(),
    /only from a suspended run/,
  );
});

function runtimeOptions(
  random = new ScriptedRandom(),
): Readonly<{
  commands: Array<Readonly<{ readonly type: string }>>;
  options: {
    commandSink: (commands: readonly Readonly<{ type: string }>[]) => void;
    effectsEnabled: () => boolean;
    planner: RecordingPlanner;
    random: ScriptedRandom;
    viewport: () => Readonly<{ height: number; width: number }>;
  };
  planner: RecordingPlanner;
  random: ScriptedRandom;
  timeline: string[];
}> {
  const commands: Array<Readonly<{ readonly type: string }>> = [];
  const planner = new RecordingPlanner(random);
  const timeline: string[] = [];
  return {
    commands,
    options: {
      commandSink: (batch) => {
        commands.push(...batch);
        timeline.push(...batch.map(({ type }) => `toss:${type}`));
      },
      effectsEnabled: () => false,
      planner,
      random,
      viewport: () => ({ height: 800, width: 480 }),
    },
    planner,
    random,
    timeline,
  };
}

function harness(): Readonly<{
  controller: InstanceType<typeof GnStyleSceneController>;
  input: BladeInputStub;
  node: StubNode;
  physics: PhysicsStub;
}> {
  const node = new cc.Node('Canvas');
  const input = node.addComponent(bladeInputModule.BladeInputController);
  const controller = node.addComponent(
    GnStyleSceneController as never,
  ) as InstanceType<typeof GnStyleSceneController>;
  controller.onLoad();
  const physics = physicsModule.instances.at(-1);
  assert.ok(physics);
  return { controller, input, node, physics };
}

function enterRunning(
  controller: InstanceType<typeof GnStyleSceneController>,
): void {
  controller.totalTimeCallback();
  controller.goCallback();
  controller.startGameCallback();
}

function enlistResultParticipant(
  controller: InstanceType<typeof GnStyleSceneController>,
  node: StubNode,
  overrides: Partial<{
    commit: () => void;
    prepareCommit: () => void;
    rollback: () => void;
  }> = {},
): void {
  node.on(GN_STYLE_SESSION_COMMAND_EVENT, (command) => {
    if (isCommand(command, 'capture-gn-style-parent')) {
      controller.enlistTimeUpFinishParticipant({
        commit: overrides.commit ?? (() => {}),
        prepareCommit: overrides.prepareCommit ?? (() => {}),
        rollback: overrides.rollback ?? (() => {}),
      });
    }
  });
}

function isCommand(
  command: unknown,
  type: string,
): command is Readonly<{ readonly type: string }> & Record<string, unknown> {
  return (
    command !== null
    && typeof command === 'object'
    && 'type' in command
    && command.type === type
  );
}
