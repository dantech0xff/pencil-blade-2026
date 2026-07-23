import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { extname } from 'node:path';
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
    this.owner = null;
  }
  activateForBirdLayer(owner) {
    if (this.owner === owner) return;
    this.owner = owner;
    this.events.push('activate');
    if (this.failActivateCount > 0) {
      this.failActivateCount -= 1;
      throw new Error('injected Bird input activation failure');
    }
  }
  deactivateForNonBirdScreen(owner) {
    if (owner !== undefined && this.owner !== null && this.owner !== owner) {
      this.events.push('deactivate-rejected');
      return false;
    }
    this.owner = null;
    this.events.push('deactivate');
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
    this.stopped = false;
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
    this.stopped = stopped;
  }
  raycastAll() {
    this.calls.push('raycast');
    return ['bird-hit'];
  }
  callAfterStep(mutation) {
    this.calls.push('after-step');
    mutation();
  }
  emitFrame(frameDeltaSeconds) {
    if (!this.active || this.stopped) return null;
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
  CLASSIC_BIRD_PHYSICS_STEPPED_EVENT,
  CLASSIC_BIRD_SESSION_COMMAND_EVENT,
  CLASSIC_BIRD_SESSION_SNAPSHOT_EVENT,
  ClassicBirdLifecycleRollbackError,
  ClassicBirdSceneController,
} = await import(
  '../../../game/assets/scripts/creator/classic-bird-scene-controller.ts'
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
  stopped: boolean;
}

interface PhysicsModule {
  readonly instances: PhysicsStub[];
}

test('activation publishes exact Bird construction and LUCK starts nine controllers in order', () => {
  const { controller, input, node, physics } = harness();
  const commands: Array<Readonly<{
    action?: string;
    controller?: string;
    delaySeconds?: number;
    score?: number;
    type: string;
  }>> = [];
  node.on(CLASSIC_BIRD_SESSION_COMMAND_EVENT, (command) => {
    commands.push(command as never);
  });

  controller.activateClassicBirdLayer(77);
  assert.equal(controller.active, true);
  assert.deepEqual(input.events, ['deactivate', 'activate']);
  assert.deepEqual(physics.calls.slice(0, 3), [
    'configure',
    'start',
    'stopped:false',
  ]);
  assert.equal(
    commands.filter(({ type }) => type === 'construct-controller').length,
    9,
  );
  assert.deepEqual(commands.at(-1), {
    type: 'schedule-speed-up-callback',
    delaySeconds: 45,
  });
  assert.equal(controller.speedDelayRemaining, 45);

  commands.length = 0;
  controller.completeIntro();
  assert.deepEqual(commands.map(({ type, action, controller: id }) => (
    type === 'toss-controller' ? `${action}:${id}` : type
  )), [
    'set-cut-enabled',
    'start:aa',
    'start:b0',
    'start:b1',
    'start:b2',
    'start:ab',
    'start:ac',
    'start:ad',
    'start:ae',
    'start:af',
  ]);
});

test('45-second scheduler callback changes only subsequent Physics2D delta', () => {
  const { controller, node, physics } = harness();
  const physicsPayloads: unknown[] = [];
  const commands: Array<Readonly<{ type: string; value?: number }>> = [];
  node.on(CLASSIC_BIRD_PHYSICS_STEPPED_EVENT, (payload) => {
    physicsPayloads.push(payload);
  });
  node.on(CLASSIC_BIRD_SESSION_COMMAND_EVENT, (command) => {
    commands.push(command as never);
  });
  controller.activateClassicBirdLayer(0);

  const initial = physics.emitFrame(0.5);
  assert.equal(initial, 0.5);
  controller.update(44.75);
  assert.equal(controller.speedDelayRemaining, 0.25);
  controller.update(0.25);
  assert.equal(controller.speedDelayRemaining, 45);
  const speedCommand = commands.findLast(({ type }) => type === 'set-world-speed');
  assert.deepEqual(speedCommand, {
    type: 'set-world-speed',
    value: Math.fround(1 + Math.fround(0.1)),
  });

  const accelerated = physics.emitFrame(0.5);
  assert.equal(
    accelerated,
    Math.fround(Math.fround(0.5) * Math.fround(1 + Math.fround(0.1))),
  );
  assert.deepEqual(physicsPayloads, [
    { deltaSeconds: initial },
    { deltaSeconds: accelerated },
  ]);
});

test('bomb uses the full physics gate with no second timer and late unfreeze stays lease-local', () => {
  const { controller, node, physics } = harness();
  const commands: Array<Readonly<{ type: string }>> = [];
  node.on(CLASSIC_BIRD_SESSION_COMMAND_EVENT, (command) => {
    commands.push(command as never);
  });
  controller.activateClassicBirdLayer(0);
  controller.completeIntro();
  controller.addScore(25);

  const runGeneration = controller.bombHit();
  assert.equal(physics.stopped, true);
  assert.equal(physics.calls.at(-1), 'stopped:true');
  assert.equal(
    commands.some(({ type }) => type === 'schedule-after-bomb-hit'),
    false,
  );
  assert.equal(controller.sessionSnapshot().score.authoritativeScore, 25);
  controller.afterBombHit(runGeneration);
  assert.equal(physics.stopped, false);
  assert.equal(physics.calls.at(-1), 'stopped:false');

  controller.gameOverFromMiss();
  enlistResultParticipant(controller, node);
  controller.displayScoreComplete();
  const callsAfterCommit = physics.calls.length;
  controller.afterBombHit(runGeneration);
  assert.equal(physics.calls.length, callsAfterCommit);
  assert.equal(controller.sessionSnapshot().worldStopped, false);
});

test('a stale standard-bomb completion cannot mutate a newly activated run', () => {
  const { controller, node, physics } = harness();
  const commands: Array<Readonly<{ type: string }>> = [];
  node.on(CLASSIC_BIRD_SESSION_COMMAND_EVENT, (command) => {
    commands.push(command as never);
  });
  controller.activateClassicBirdLayer(0);
  controller.completeIntro();
  const retiredRunGeneration = controller.bombHit();
  controller.gameOverFromMiss();
  enlistResultParticipant(controller, node);
  controller.displayScoreComplete();

  controller.activateClassicBirdLayer(99);
  commands.length = 0;
  const callsBeforeStaleCompletion = physics.calls.length;
  controller.afterBombHit(retiredRunGeneration);

  assert.equal(controller.active, true);
  assert.equal(controller.sessionSnapshot().lifecycle, 'intro');
  assert.equal(controller.sessionSnapshot().worldStopped, false);
  assert.equal(physics.calls.length, callsBeforeStaleCompletion);
  assert.deepEqual(commands, []);
});

test('pause suspension preserves session, speed delay, and stopped-world state', () => {
  const { controller, input, physics } = harness();
  controller.activateClassicBirdLayer(12);
  controller.completeIntro();
  controller.addScore(45);
  controller.update(4);
  controller.bombHit();
  const retained = controller.sessionSnapshot();
  const retainedDelay = controller.speedDelayRemaining;

  controller.suspendClassicBirdLayerForNavigation();
  assert.equal(controller.active, false);
  assert.equal(controller.suspended, true);
  assert.deepEqual(controller.sessionSnapshot(), retained);
  assert.equal(controller.speedDelayRemaining, retainedDelay);
  assert.equal(physics.calls.at(-1), 'restore');
  controller.update(10);
  assert.equal(
    controller.speedDelayRemaining,
    retainedDelay,
    'suspended scheduler time must not advance the retained 45-second callback',
  );

  controller.resumeSuspendedClassicBirdLayer();
  assert.equal(controller.active, true);
  assert.equal(controller.suspended, false);
  assert.deepEqual(controller.sessionSnapshot(), retained);
  assert.deepEqual(physics.calls.slice(-3), [
    'configure',
    'start',
    'stopped:true',
  ]);
  assert.deepEqual(input.events.slice(-2), ['deactivate', 'activate']);

  controller.suspendClassicBirdLayerForNavigation();
  controller.finalizeSuspendedClassicBirdLayerRelease();
  assert.equal(controller.sessionSnapshot().lifecycle, 'intro');
  assert.equal(controller.sessionSnapshot().score.authoritativeScore, 0);
});

test('failed pause suspension compensation becomes typed fatal state with cleanup retry', () => {
  const { controller, input, physics } = harness();
  controller.activateClassicBirdLayer(0);
  physics.failRestoreCount = 2;

  let thrown: unknown = null;
  assert.throws(
    () => controller.suspendClassicBirdLayerForNavigation(),
    (error: unknown) => {
      thrown = error;
      return error instanceof ClassicBirdLifecycleRollbackError;
    },
  );
  assert.ok(thrown instanceof ClassicBirdLifecycleRollbackError);
  assert.match(
    thrown.message,
    /Classic Bird navigation suspension rollback failed/,
  );
  assert.match(String(thrown.cause), /injected restore failure/);
  assert.equal(thrown.rollbackErrors.length, 1);
  assert.match(String(thrown.rollbackErrors[0]), /injected restore failure/);
  assert.equal(controller.active, false);
  assert.equal(controller.suspended, false);
  assert.equal(controller.fatalLifecycle, true);
  assert.equal(controller.readyForActivation, false);
  assert.equal(input.owner, null);
  assert.equal(physics.active, false);
  assert.throws(
    () => controller.activateClassicBirdLayer(0),
    /cannot activate before load or after destruction/,
  );

  assert.doesNotThrow(() => controller.onDestroy());
  assert.equal(
    physics.calls.filter((call) => call === 'restore').length,
    3,
    'destruction must retry the retained physics snapshot after fatal compensation',
  );
});

test('failed pause resume compensation remains typed, fatal, and inert through cleanup retry', () => {
  const { controller, input, physics } = harness();
  controller.activateClassicBirdLayer(0);
  controller.suspendClassicBirdLayerForNavigation();
  physics.failStart = true;
  physics.failRestoreCount = 2;

  let thrown: unknown = null;
  assert.throws(
    () => controller.resumeSuspendedClassicBirdLayer(),
    (error: unknown) => {
      thrown = error;
      return error instanceof ClassicBirdLifecycleRollbackError;
    },
  );
  assert.ok(thrown instanceof ClassicBirdLifecycleRollbackError);
  assert.match(
    thrown.message,
    /Classic Bird navigation resume rollback failed/,
  );
  assert.match(
    String(thrown.cause),
    /Classic Bird Physics2D acquisition rollback failed/,
  );
  assert.equal(thrown.rollbackErrors.length, 1);
  assert.match(String(thrown.rollbackErrors[0]), /injected restore failure/);
  assert.equal(controller.active, false);
  assert.equal(controller.suspended, false);
  assert.equal(controller.fatalLifecycle, true);
  assert.equal(controller.readyForActivation, false);
  assert.equal(input.owner, null);
  assert.equal(physics.active, false);

  assert.doesNotThrow(() => controller.onDestroy());
  assert.equal(
    physics.calls.filter((call) => call === 'restore').length,
    4,
    'destruction must retry the retained resume-compensation snapshot',
  );
});

test('standby load and retired destruction cannot release a newer Bird input owner', () => {
  const { controller: retired, input, node } = harness();
  retired.activateClassicBirdLayer(0);
  const standby = node.addComponent(ClassicBirdSceneController);
  standby.onLoad();
  assert.equal(input.owner, retired);
  assert.equal(input.events.at(-1), 'deactivate-rejected');

  retired.suspendClassicBirdLayerForNavigation();
  standby.activateClassicBirdLayer(0);
  assert.equal(input.owner, standby);
  assert.equal(standby.active, true);

  retired.onDestroy();
  assert.equal(input.owner, standby);
  assert.equal(input.events.at(-1), 'deactivate-rejected');
  assert.equal(standby.active, true);
});

test('Result attachment failure rolls back domain, Bird input, and physics before one commit', () => {
  const { controller, input, node, physics } = harness();
  controller.activateClassicBirdLayer(0);
  controller.completeIntro();
  controller.addScore(73);
  controller.gameOverFromMiss();

  let commitCount = 0;
  let rollbackCount = 0;
  node.on(CLASSIC_BIRD_SESSION_COMMAND_EVENT, (command) => {
    if (
      command !== null
      && typeof command === 'object'
      && 'type' in command
      && command.type === 'capture-classic-bird-parent'
    ) {
      controller.enlistResultTransitionParticipant({
        prepareCommit() {},
        commit() { commitCount += 1; },
        rollback() { rollbackCount += 1; },
      });
    }
  });
  const attachmentFailure = (command: unknown) => {
    if (
      command !== null
      && typeof command === 'object'
      && 'type' in command
      && command.type === 'attach-result'
    ) {
      throw new Error('injected Bird Result attachment failure');
    }
  };
  node.on(CLASSIC_BIRD_SESSION_COMMAND_EVENT, attachmentFailure);

  assert.throws(
    () => controller.displayScoreComplete(),
    /injected Bird Result attachment failure/,
  );
  assert.equal(rollbackCount, 1);
  assert.equal(commitCount, 0);
  assert.equal(controller.active, true);
  assert.equal(controller.sessionSnapshot().lifecycle, 'game-over');
  assert.equal(controller.sessionSnapshot().score.authoritativeScore, 73);
  assert.equal(physics.active, true);
  assert.deepEqual(input.events.slice(-2), ['deactivate', 'activate']);

  node.off(CLASSIC_BIRD_SESSION_COMMAND_EVENT, attachmentFailure);
  controller.displayScoreComplete();
  assert.equal(commitCount, 1);
  assert.equal(controller.active, false);
  assert.equal(controller.sessionSnapshot().lifecycle, 'result-removed');
});

test('Result prepare failure rolls back the participant and restores the active run', () => {
  const { controller, node, physics } = harness();
  controller.activateClassicBirdLayer(0);
  controller.completeIntro();
  controller.gameOverFromMiss();
  let rollbackCount = 0;
  node.on(CLASSIC_BIRD_SESSION_COMMAND_EVENT, (command) => {
    if (isClassicBirdCommand(command, 'capture-classic-bird-parent')) {
      controller.enlistResultTransitionParticipant({
        prepareCommit() {
          throw new Error('injected Bird Result prepare failure');
        },
        commit() {
          assert.fail('prepare failure must not commit');
        },
        rollback() {
          rollbackCount += 1;
        },
      });
    }
  });

  assert.throws(
    () => controller.displayScoreComplete(),
    /injected Bird Result prepare failure/,
  );
  assert.equal(rollbackCount, 1);
  assert.equal(controller.active, true);
  assert.equal(controller.sessionSnapshot().lifecycle, 'game-over');
  assert.equal(physics.active, true);
});

test('Result rollback aggregates participant failure without skipping scene restoration', () => {
  const { controller, node, physics } = harness();
  controller.activateClassicBirdLayer(0);
  controller.completeIntro();
  controller.gameOverFromMiss();
  node.on(CLASSIC_BIRD_SESSION_COMMAND_EVENT, (command) => {
    if (isClassicBirdCommand(command, 'capture-classic-bird-parent')) {
      controller.enlistResultTransitionParticipant({
        prepareCommit() {},
        commit() {},
        rollback() {
          throw new Error('injected participant rollback failure');
        },
      });
    }
  });
  node.on(CLASSIC_BIRD_SESSION_COMMAND_EVENT, (command) => {
    if (isClassicBirdCommand(command, 'attach-result')) {
      throw new Error('injected result attachment failure');
    }
  });

  assert.throws(
    () => controller.displayScoreComplete(),
    /Classic Bird result rollback failed[\s\S]*injected result attachment failure[\s\S]*injected participant rollback failure/,
  );
  assert.equal(controller.active, true);
  assert.equal(controller.sessionSnapshot().lifecycle, 'game-over');
  assert.equal(physics.active, true);
});

test('Result rollback Physics2D reacquisition failure is fatal and retains cleanup ownership', () => {
  const { controller, input, node, physics } = harness();
  controller.activateClassicBirdLayer(0);
  controller.completeIntro();
  controller.gameOverFromMiss();
  let participantRollbackCount = 0;
  node.on(CLASSIC_BIRD_SESSION_COMMAND_EVENT, (command) => {
    if (isClassicBirdCommand(command, 'capture-classic-bird-parent')) {
      controller.enlistResultTransitionParticipant({
        prepareCommit() {},
        commit() {
          assert.fail('failed Result restoration must not commit');
        },
        rollback() {
          participantRollbackCount += 1;
        },
      });
    }
  });
  const attachmentFailure = new Error('injected result attachment failure');
  node.on(CLASSIC_BIRD_SESSION_COMMAND_EVENT, (command) => {
    if (isClassicBirdCommand(command, 'attach-result')) {
      physics.failStart = true;
      physics.failRestoreCount = 2;
      throw attachmentFailure;
    }
  });

  let thrown: unknown = null;
  assert.throws(
    () => controller.displayScoreComplete(),
    (error: unknown) => {
      thrown = error;
      return (
        error instanceof ClassicBirdLifecycleRollbackError
        && error.cause === attachmentFailure
        && error.rollbackErrors.some(
          (failure) => String(failure).includes('injected start failure'),
        )
      );
    },
  );
  assert.ok(thrown instanceof ClassicBirdLifecycleRollbackError);
  assert.equal(participantRollbackCount, 1);
  assert.equal(controller.sessionSnapshot().lifecycle, 'game-over');
  assert.equal(controller.active, false);
  assert.equal(controller.suspended, false);
  assert.equal(controller.fatalLifecycle, true);
  assert.equal(controller.readyForActivation, false);
  assert.equal(input.owner, null);
  assert.equal(physics.active, false);
  assert.equal(
    physics.calls.filter((call) => call === 'restore').length,
    3,
    'Result removal plus both failed reacquisition cleanup attempts must retain ownership',
  );
  assert.throws(
    () => controller.activateClassicBirdLayer(0),
    /cannot activate before load or after destruction/,
  );

  physics.failStart = false;
  assert.doesNotThrow(() => controller.onDestroy());
  assert.equal(
    physics.calls.filter((call) => call === 'restore').length,
    4,
    'destruction must retry the retained Physics2D snapshot',
  );
});

test('Result rollback input reacquisition failure quiesces input and Physics2D before fatal exit', () => {
  const { controller, input, node, physics } = harness();
  controller.activateClassicBirdLayer(0);
  controller.completeIntro();
  controller.gameOverFromMiss();
  enlistResultParticipant(controller, node);
  const attachmentFailure = new Error('injected result attachment failure');
  node.on(CLASSIC_BIRD_SESSION_COMMAND_EVENT, (command) => {
    if (isClassicBirdCommand(command, 'attach-result')) {
      input.failActivateCount = 1;
      throw attachmentFailure;
    }
  });

  assert.throws(
    () => controller.displayScoreComplete(),
    (error: unknown) => (
      error instanceof ClassicBirdLifecycleRollbackError
      && error.cause === attachmentFailure
      && error.rollbackErrors.some(
        (failure) => String(failure).includes(
          'injected Bird input activation failure',
        ),
      )
    ),
  );
  assert.equal(controller.sessionSnapshot().lifecycle, 'game-over');
  assert.equal(controller.active, false);
  assert.equal(controller.suspended, false);
  assert.equal(controller.fatalLifecycle, true);
  assert.equal(controller.readyForActivation, false);
  assert.equal(input.owner, null);
  assert.deepEqual(
    input.events.slice(-3),
    ['deactivate', 'activate', 'deactivate'],
  );
  assert.equal(physics.active, false);
  assert.equal(
    physics.calls.filter((call) => call === 'restore').length,
    2,
    'the newly reacquired Physics2D lease must be released',
  );
  assert.throws(() => controller.completeIntro(), /layer must be active/);
  assert.doesNotThrow(() => controller.onDestroy());
});

test('post-domain participant commit failure still publishes the committed snapshot', () => {
  const { controller, node, physics } = harness();
  controller.activateClassicBirdLayer(0);
  controller.completeIntro();
  controller.addScore(88);
  controller.gameOverFromMiss();
  let rollbackCount = 0;
  const observedLifecycles: string[] = [];
  node.on(CLASSIC_BIRD_SESSION_SNAPSHOT_EVENT, (snapshot) => {
    observedLifecycles.push(
      (snapshot as Readonly<{ lifecycle: string }>).lifecycle,
    );
  });
  node.on(CLASSIC_BIRD_SESSION_COMMAND_EVENT, (command) => {
    if (isClassicBirdCommand(command, 'capture-classic-bird-parent')) {
      controller.enlistResultTransitionParticipant({
        prepareCommit() {},
        commit() {
          throw new Error('injected participant commit failure');
        },
        rollback() {
          rollbackCount += 1;
        },
      });
    }
  });

  assert.throws(
    () => controller.displayScoreComplete(),
    /Classic Bird result commit failed: injected participant commit failure/,
  );
  assert.equal(rollbackCount, 0);
  assert.equal(controller.active, false);
  assert.equal(controller.sessionSnapshot().lifecycle, 'result-removed');
  assert.equal(observedLifecycles.at(-1), 'result-removed');
  assert.equal(physics.active, false);
});

test('post-commit snapshot observer failure is reported without reopening Result', () => {
  const { controller, node } = harness();
  controller.activateClassicBirdLayer(0);
  controller.completeIntro();
  controller.gameOverFromMiss();
  enlistResultParticipant(controller, node);
  node.on(CLASSIC_BIRD_SESSION_SNAPSHOT_EVENT, (snapshot) => {
    if ((snapshot as Readonly<{ lifecycle: string }>).lifecycle === 'result-removed') {
      throw new Error('injected committed snapshot observer failure');
    }
  });
  const reported: unknown[] = [];
  const previousConsoleError = console.error;
  console.error = (error: unknown) => {
    reported.push(error);
  };
  try {
    assert.doesNotThrow(() => controller.displayScoreComplete());
  } finally {
    console.error = previousConsoleError;
  }

  assert.equal(controller.sessionSnapshot().lifecycle, 'result-removed');
  assert.equal(controller.active, false);
  assert.equal(reported.length, 1);
  assert.match(String(reported[0]), /injected committed snapshot observer failure/);
});

test('failed Physics2D restoration retains a cleanup retry through destruction', () => {
  const { controller, physics } = harness();
  controller.activateClassicBirdLayer(0);
  physics.failRestoreCount = 1;

  assert.throws(() => controller.onDestroy(), /injected restore failure/);
  assert.equal(controller.active, false);
  assert.equal(
    physics.calls.filter((call) => call === 'restore').length,
    1,
  );

  assert.doesNotThrow(() => controller.onDestroy());
  assert.equal(
    physics.calls.filter((call) => call === 'restore').length,
    2,
    'the retained adapter snapshot must be retried instead of losing ownership',
  );
});

test('activation rollback restores the retired session even when physics cleanup also fails', () => {
  const { controller, node, physics } = harness();
  controller.activateClassicBirdLayer(7);
  controller.completeIntro();
  controller.addScore(73);
  controller.gameOverFromMiss();
  enlistResultParticipant(controller, node);
  controller.displayScoreComplete();
  const retired = controller.sessionSnapshot();

  physics.failStart = true;
  physics.failRestoreCount = 2;
  assert.throws(
    () => controller.activateClassicBirdLayer(999),
    /Classic Bird activation rollback failed[\s\S]*injected restore failure/,
  );
  assert.equal(controller.active, false);
  assert.deepEqual(controller.sessionSnapshot(), retired);
  assert.equal(controller.speedDelayRemaining, 45);
  assert.equal(controller.fatalLifecycle, true);
  assert.equal(controller.readyForActivation, false);
  assert.throws(
    () => controller.activateClassicBirdLayer(999),
    /cannot activate before load or after destruction/,
  );

  physics.failStart = false;
  physics.failRestoreCount = 0;
  assert.doesNotThrow(() => controller.onDestroy());
  assert.equal(physics.calls.at(-1), 'restore');
});

test('activation rollback and inactive after-step/raycast boundaries fail closed', () => {
  const { controller, input, physics } = harness();
  let immediateCalls = 0;
  controller.callAfterPhysicsStep(() => { immediateCalls += 1; });
  assert.equal(immediateCalls, 1);
  assert.throws(
    () => controller.raycastAll({ x: 0, y: 0 }, { x: 1, y: 1 }),
    /active Physics2D lease/,
  );

  physics.failStart = true;
  assert.throws(
    () => controller.activateClassicBirdLayer(0),
    /injected start failure/,
  );
  assert.equal(controller.active, false);
  assert.equal(controller.sessionSnapshot().lifecycle, 'intro');
  assert.deepEqual(input.events.slice(-1), ['deactivate']);
  assert.equal(physics.active, false);
  assert.equal(physics.calls.at(-1), 'restore');

  physics.failStart = false;
  controller.activateClassicBirdLayer(0);
  assert.deepEqual(
    controller.raycastAll({ x: 0, y: 0 }, { x: 1, y: 1 }),
    ['bird-hit'],
  );
  let deferredCalls = 0;
  controller.callAfterPhysicsStep(() => { deferredCalls += 1; });
  assert.equal(deferredCalls, 1);
  assert.equal(physics.calls.at(-1), 'after-step');
});

function harness(): Readonly<{
  controller: InstanceType<typeof ClassicBirdSceneController>;
  input: BirdInputStub;
  node: StubNode;
  physics: PhysicsStub;
}> {
  const node = new cc.Node('Canvas');
  const input = node.addComponent(birdInputModule.BirdInputController);
  const controller = node.addComponent(ClassicBirdSceneController);
  controller.onLoad();
  const physics = physicsModule.instances.at(-1);
  assert.ok(physics);
  return { controller, input, node, physics };
}

function enlistResultParticipant(
  controller: InstanceType<typeof ClassicBirdSceneController>,
  node: StubNode,
): void {
  node.on(CLASSIC_BIRD_SESSION_COMMAND_EVENT, (command) => {
    if (
      command !== null
      && typeof command === 'object'
      && 'type' in command
      && command.type === 'capture-classic-bird-parent'
    ) {
      controller.enlistResultTransitionParticipant({
        prepareCommit() {},
        commit() {},
        rollback() {},
      });
    }
  });
}

function isClassicBirdCommand(command: unknown, type: string): boolean {
  return (
    command !== null
    && typeof command === 'object'
    && 'type' in command
    && command.type === type
  );
}
