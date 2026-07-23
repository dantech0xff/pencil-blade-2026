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

const BIRD_INPUT_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export class BirdInputController {
  constructor() {
    this.events = [];
    this.failActivateCount = 0;
    this.failDeactivateCount = 0;
    this.owner = null;
  }
  activateForBirdLayer(owner) {
    if (this.owner === owner) return;
    this.owner = owner;
    this.events.push('activate');
    if (this.failActivateCount > 0) {
      this.failActivateCount -= 1;
      this.owner = null;
      this.events.push('deactivate');
      throw new Error('injected Bird input activation failure');
    }
  }
  deactivateForNonBirdScreen(owner) {
    if (owner !== undefined && this.owner !== null && this.owner !== owner) {
      this.events.push('deactivate-rejected');
      return false;
    }
    this.events.push('deactivate');
    if (this.failDeactivateCount > 0) {
      this.failDeactivateCount -= 1;
      throw new Error('injected Bird input deactivation failure');
    }
    this.owner = null;
    return true;
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
    return ['combo-bird-hit'];
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
    if (specifier === './bird-input-controller') {
      return { shortCircuit: true, url: BIRD_INPUT_STUB_URL };
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
const birdInputModule = await import(
  BIRD_INPUT_STUB_URL
) as unknown as BirdInputModule;
const physicsModule = await import(
  PHYSICS_STUB_URL
) as unknown as PhysicsModule;
const {
  COMBO_BIRD_PHYSICS_STEPPED_EVENT,
  COMBO_BIRD_SESSION_COMMAND_EVENT,
  COMBO_BIRD_SESSION_SNAPSHOT_EVENT,
  ComboBirdLifecycleRollbackError,
  ComboBirdSceneController,
  ComboBirdTimeUpDispatchError,
  ComboBirdTimeUpFinishCommitError,
} = await import(
  '../../../game/assets/scripts/creator/combo-bird-scene-controller.ts'
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

interface BirdInputStub {
  readonly events: string[];
  failActivateCount: number;
  failDeactivateCount: number;
  owner: unknown;
}

interface BirdInputModule {
  readonly BirdInputController: new () => BirdInputStub;
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

test('source is a serialized Bird-only Creator owner with a valid metadata UUID', () => {
  const controllerPath = fileURLToPath(new URL(
    '../../../game/assets/scripts/creator/combo-bird-scene-controller.ts',
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

  assert.match(source, /@ccclass\('ComboBirdSceneController'\)/);
  assert.match(source, /@requireComponent\(BirdInputController\)/);
  assert.match(source, /new ComboBirdSession\(/);
  assert.match(source, /new ComboBirdTossCoordinator\(/);
  assert.match(source, /new ClassicPhysicsAdapter\(/);
  assert.doesNotMatch(source, /from ['"][^'"]*crazy[^'"]*['"]/i);
  assert.deepEqual(metadata, {
    files: [],
    imported: true,
    importer: 'typescript',
    subMetas: {},
    userData: {},
    uuid: '663d307f-fbf0-4445-80e7-2e88c9300d20',
    ver: '4.0.24',
  });
});

test('serialized mode-5 owner publishes exact events and ticks tosses before TimeManager', () => {
  const { controller, input, node, physics } = harness();
  const runtime = runtimeOptions(new ScriptedRandom());
  const commands: Array<Readonly<{
    controller?: string;
    score?: number;
    type: string;
  }>> = [];
  const snapshots: unknown[] = [];
  const physicsSteps: unknown[] = [];
  node.on(COMBO_BIRD_SESSION_COMMAND_EVENT, (command) => {
    commands.push(command as never);
  });
  node.on(COMBO_BIRD_SESSION_SNAPSHOT_EVENT, (snapshot) => {
    snapshots.push(snapshot);
  });
  node.on(COMBO_BIRD_PHYSICS_STEPPED_EVENT, (payload) => {
    physicsSteps.push(payload);
  });

  assert.equal(
    COMBO_BIRD_SESSION_COMMAND_EVENT,
    'combo-bird-session-command',
  );
  assert.equal(
    COMBO_BIRD_SESSION_SNAPSHOT_EVENT,
    'combo-bird-session-snapshot',
  );
  assert.equal(
    COMBO_BIRD_PHYSICS_STEPPED_EVENT,
    'combo-bird-physics-stepped',
  );

  controller.activateComboBirdLayer(77, runtime.options);

  assert.equal(controller.active, true);
  assert.equal(controller.sessionSnapshot().mode, 5);
  assert.deepEqual(input.events, ['deactivate', 'activate']);
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
    { type: 'enter-base-bird-layer' },
    { payload: 0, selector: 7, type: 'process-objective' },
  ]);
  assert.deepEqual(
    commands
      .filter(({ type }) => type === 'construct-controller')
      .map(({ controller: id }) => id),
    ['free', 'wave', 'concurrent'],
  );
  assert.deepEqual(commands.at(-1), {
    key: 'bird_combo_best_1',
    score: 77,
    type: 'initialize-best-score',
  });
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
    'create-ninety-intro',
    'create-go-intro',
    'start-controller:free',
    'start-controller:wave',
    'start-controller:concurrent',
    'start-time-manager',
  ]);
  assert.equal(controller.sessionSnapshot().lifecycle, 'running');
  assert.equal(controller.tossControllerSnapshot('free').timer.scheduled, true);
  assert.equal(controller.tossControllerSnapshot('wave').timer.scheduled, true);
  assert.equal(
    controller.tossControllerSnapshot('concurrent').timer.scheduled,
    true,
  );

  runtime.timeline.length = 0;
  controller.tickCoordinatorBeforeTimeManager(0.76, (deltaSeconds) => {
    runtime.timeline.push(`timer:${String(deltaSeconds)}`);
  });
  const firstSpawnIndex = runtime.timeline.indexOf('toss:create-fruit');
  const timerIndex = runtime.timeline.indexOf('timer:0.76');
  assert.notEqual(firstSpawnIndex, -1);
  assert.equal(firstSpawnIndex < timerIndex, true);

  assert.equal(physics.emitFrame(0.016), Math.fround(0.016));
  assert.deepEqual(physicsSteps, [{ deltaSeconds: Math.fround(0.016) }]);
  assert.deepEqual(
    controller.raycastAll({ x: 0, y: 0 }, { x: 1, y: 1 }),
    ['combo-bird-hit'],
  );
});

test('timer zero stops only outer tosses while late input, physics, score, miss, and Wave work', () => {
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
  node.on(COMBO_BIRD_SESSION_COMMAND_EVENT, (command) => {
    commands.push(command as never);
  });
  controller.activateComboBirdLayer(0, runtime.options);
  enterRunning(controller);

  let timerTickCount = 0;
  controller.tickCoordinatorBeforeTimeManager(7.51, () => {
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
  assert.equal(input.owner, controller);
  assert.equal(physics.active, true);
  assert.deepEqual(controller.sessionSnapshot().activity, {
    birdBladeActive: true,
    comboActive: true,
    entitiesActive: true,
    inputActive: true,
    outerTossControllersActive: false,
    physicsActive: true,
    scoreActive: true,
  });
  for (const id of ['free', 'wave', 'concurrent'] as const) {
    assert.equal(controller.tossControllerSnapshot(id).timer.scheduled, false);
  }

  controller.tickCoordinatorBeforeTimeManager(0.26, () => {
    timerTickCount += 1;
  });
  controller.tickCoordinatorBeforeTimeManager(2.58, () => {
    timerTickCount += 1;
  });
  assert.equal(timerTickCount, 1, 'TimeManager scheduler stays stopped after zero');
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

  let mutationCalls = 0;
  controller.callAfterPhysicsStep(() => {
    mutationCalls += 1;
  });
  assert.equal(mutationCalls, 1);
  assert.equal(physics.calls.at(-1), 'after-step');
  assert.equal(physics.emitFrame(0.025), Math.fround(0.025));
  assert.deepEqual(
    controller.raycastAll({ x: 0, y: 0 }, { x: 2, y: 2 }),
    ['combo-bird-hit'],
  );

  commands.length = 0;
  controller.checkCombo({ x: 1, y: 2 });
  controller.fruitCut({ x: 3, y: 4 }, 8, 10);
  controller.addScore(3);
  controller.fruitFail({ x: 5, y: 6 });
  controller.bonusFruitFail({ x: 7, y: 8 });
  controller.update(0.016);
  assert.equal(controller.sessionSnapshot().score.authoritativeScore, 13);
  assert.equal(
    commands.some(({ type }) => type === 'check-combo'),
    true,
  );
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
      assert.fail('successful result must not roll back');
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
  assert.equal(input.owner, null);
  assert.equal(physics.active, false);
});

test('suspend, resume, finalize, and replacement preserve or retire exactly one run', () => {
  const { controller, input, physics } = harness();
  const runtime = runtimeOptions();
  controller.activateComboBirdLayer(12, runtime.options);
  enterRunning(controller);
  controller.fruitCut({ x: 0, y: 0 }, 0, 9);
  controller.tickCoordinatorBeforeTimeManager(0.5, () => {});
  const retainedSession = controller.sessionSnapshot();
  const retainedFree = controller.tossControllerSnapshot('free');

  controller.suspendComboBirdLayerForNavigation();
  assert.equal(controller.active, false);
  assert.equal(controller.suspended, true);
  assert.deepEqual(controller.sessionSnapshot(), retainedSession);
  assert.deepEqual(controller.tossControllerSnapshot('free'), retainedFree);
  assert.equal(input.owner, null);
  assert.equal(physics.active, false);
  assert.throws(
    () => controller.tickCoordinatorBeforeTimeManager(1, () => {}),
    /must be active/,
  );

  controller.resumeSuspendedComboBirdLayer();
  assert.equal(controller.active, true);
  assert.equal(controller.suspended, false);
  assert.deepEqual(controller.sessionSnapshot(), retainedSession);
  assert.deepEqual(controller.tossControllerSnapshot('free'), retainedFree);
  assert.equal(input.owner, controller);
  assert.equal(physics.active, true);

  controller.suspendComboBirdLayerForNavigation();
  controller.finalizeSuspendedComboBirdLayerRelease();
  assert.equal(controller.suspended, false);
  assert.equal(controller.sessionSnapshot().lifecycle, 'constructed');
  assert.equal(controller.sessionSnapshot().score.authoritativeScore, 0);
  assert.throws(
    () => controller.tossControllerSnapshot('free'),
    /coordinator is unavailable/,
  );

  const freshRuntime = runtimeOptions();
  controller.activateComboBirdLayer(99, freshRuntime.options);
  assert.equal(controller.sessionSnapshot().lifecycle, 'intro-instructions');
  assert.equal(freshRuntime.random.calls.length, 1);
  controller.releaseComboBirdLayerForReplacement();
  assert.equal(controller.active, false);
  assert.equal(controller.sessionSnapshot().lifecycle, 'constructed');
  assert.equal(input.owner, null);
  assert.equal(physics.active, false);
  assert.throws(
    () => controller.releaseComboBirdLayerForReplacement(),
    /must be active/,
  );
});

test('standby load and retired destruction cannot release a newer Bird input owner', () => {
  const { controller: retired, input, node } = harness();
  retired.activateComboBirdLayer(0, runtimeOptions().options);

  const standby = node.addComponent(
    ComboBirdSceneController as never,
  ) as InstanceType<typeof ComboBirdSceneController>;
  standby.onLoad();
  assert.equal(input.owner, retired);
  assert.equal(input.events.at(-1), 'deactivate-rejected');

  retired.suspendComboBirdLayerForNavigation();
  standby.activateComboBirdLayer(0, runtimeOptions().options);
  assert.equal(input.owner, standby);
  assert.equal(standby.active, true);

  retired.onDestroy();
  assert.equal(input.owner, standby);
  assert.equal(input.events.at(-1), 'deactivate-rejected');
  assert.equal(standby.active, true);
});

test('Time Up drains its ordered suffix once and aggregates listener failures', () => {
  const { controller, node } = harness();
  controller.activateComboBirdLayer(0, runtimeOptions().options);
  enterRunning(controller);
  const waveFailure = new Error('injected Wave stop observer failure');
  const objectiveFailure = new Error('injected objective observer failure');
  const commands: Array<Readonly<{
    controller?: string;
    payload?: number;
    type: string;
  }>> = [];
  node.on(COMBO_BIRD_SESSION_COMMAND_EVENT, (command) => {
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
      assert.ok(error instanceof ComboBirdTimeUpDispatchError);
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

test('Time-Up Finish rollback restores leases and resamples late score before one commit', () => {
  const { controller, input, node, physics } = harness();
  controller.activateComboBirdLayer(0, runtimeOptions().options);
  enterRunning(controller);
  controller.fruitCut({ x: 0, y: 0 }, 0, 5);
  controller.timeUp();

  let commitCount = 0;
  let rollbackCount = 0;
  const sampledScores: number[] = [];
  node.on(COMBO_BIRD_SESSION_COMMAND_EVENT, (command) => {
    if (isCommand(command, 'capture-combo-bird-parent')) {
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
  node.on(COMBO_BIRD_SESSION_COMMAND_EVENT, (command) => {
    if (failAttach && isCommand(command, 'attach-result')) {
      failAttach = false;
      throw new Error('injected Combo Bird Result attachment failure');
    }
  });

  assert.throws(
    () => controller.timeUpFinish(),
    /injected Combo Bird Result attachment failure/,
  );
  assert.equal(rollbackCount, 1);
  assert.equal(commitCount, 0);
  assert.equal(controller.active, true);
  assert.equal(controller.sessionSnapshot().lifecycle, 'time-up-presentation');
  assert.equal(input.owner, controller);
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

test('failed Result lease restoration enters a typed fatal retained boundary', () => {
  const { controller, input, node, physics } = harness();
  controller.activateComboBirdLayer(0, runtimeOptions().options);
  enterRunning(controller);
  controller.timeUp();
  enlistResultParticipant(controller, node);
  const attachmentFailure = new Error('injected post-removal attachment failure');
  node.on(COMBO_BIRD_SESSION_COMMAND_EVENT, (command) => {
    if (isCommand(command, 'attach-result')) {
      physics.failStart = true;
      throw attachmentFailure;
    }
  });

  assert.throws(
    () => controller.timeUpFinish(),
    (error: unknown) => {
      assert.ok(error instanceof ComboBirdLifecycleRollbackError);
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
  assert.equal(input.owner, null);
  assert.equal(physics.active, false);
  assert.throws(
    () => controller.activateComboBirdLayer(0, runtimeOptions().options),
    /fatal lifecycle failure/,
  );

  physics.failStart = false;
  assert.doesNotThrow(() => controller.onDestroy());
});

test('post-domain participant failure is commit-only and still publishes removed snapshot', () => {
  const { controller, node, physics } = harness();
  controller.activateComboBirdLayer(0, runtimeOptions().options);
  enterRunning(controller);
  controller.timeUp();
  let rollbackCount = 0;
  const commitFailure = new Error('injected participant commit failure');
  node.on(COMBO_BIRD_SESSION_COMMAND_EVENT, (command) => {
    if (isCommand(command, 'capture-combo-bird-parent')) {
      controller.enlistTimeUpFinishParticipant({
        prepareCommit() {},
        commit() {
          throw commitFailure;
        },
        rollback() {
          rollbackCount += 1;
        },
      });
    }
  });

  assert.throws(
    () => controller.timeUpFinish(),
    (error: unknown) => {
      assert.ok(error instanceof ComboBirdTimeUpFinishCommitError);
      assert.equal(error.cause, commitFailure);
      return true;
    },
  );
  assert.equal(rollbackCount, 0);
  assert.equal(controller.active, false);
  assert.equal(controller.sessionSnapshot().lifecycle, 'result-removed');
  assert.equal(physics.active, false);
});

test('malformed and out-of-order calls fail before mutating run ownership', () => {
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
    () => controller.activateComboBirdLayer(
      Number.NaN,
      runtime.options,
    ),
    /safe integer/,
  );
  assert.throws(
    () => controller.activateComboBirdLayer(0, null as never),
    /options must be an object/,
  );
  assert.equal(controller.sessionSnapshot().lifecycle, 'constructed');
  assert.equal(input.owner, null);
  assert.equal(physics.active, false);

  controller.activateComboBirdLayer(0, runtime.options);
  const initialWave = controller.tossControllerSnapshot('wave');
  assert.throws(() => controller.goCallback(), /requires the 90s callback/);
  assert.equal(
    controller.sessionSnapshot().lifecycle,
    'intro-instructions',
  );
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
  assert.throws(
    () => controller.resumeSuspendedComboBirdLayer(),
    /only from one suspended run/,
  );
  assert.throws(
    () => controller.finalizeSuspendedComboBirdLayerRelease(),
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
  controller: InstanceType<typeof ComboBirdSceneController>;
  input: BirdInputStub;
  node: StubNode;
  physics: PhysicsStub;
}> {
  const node = new cc.Node('Canvas');
  const input = node.addComponent(birdInputModule.BirdInputController);
  const controller = node.addComponent(
    ComboBirdSceneController as never,
  ) as InstanceType<typeof ComboBirdSceneController>;
  controller.onLoad();
  const physics = physicsModule.instances.at(-1);
  assert.ok(physics);
  return { controller, input, node, physics };
}

function enterRunning(
  controller: InstanceType<typeof ComboBirdSceneController>,
): void {
  controller.totalTimeCallback();
  controller.goCallback();
  controller.startGameCallback();
}

function enlistResultParticipant(
  controller: InstanceType<typeof ComboBirdSceneController>,
  node: StubNode,
  overrides: Partial<{
    commit: () => void;
    prepareCommit: () => void;
    rollback: () => void;
  }> = {},
): void {
  node.on(COMBO_BIRD_SESSION_COMMAND_EVENT, (command) => {
    if (isCommand(command, 'capture-combo-bird-parent')) {
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
