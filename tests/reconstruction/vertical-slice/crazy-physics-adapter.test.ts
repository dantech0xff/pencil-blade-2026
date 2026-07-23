import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const CLASSIC_PHYSICS_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export class ClassicPhysicsAdapter {}
`)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './classic-physics-adapter') {
      return { shortCircuit: true, url: CLASSIC_PHYSICS_STUB_URL };
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

const {
  CRAZY_FROZEN_WORLD_SPEED,
  CRAZY_NORMAL_WORLD_SPEED,
  CrazyPhysicsAdapter,
} = await import('../../../game/assets/scripts/creator/crazy-physics-adapter.ts');

test('Crazy physics preserves the recovered 1.0 normal and 0.5 freeze step scales', () => {
  const delegate = createDelegate();
  const stepped: number[] = [];
  const adapter = new CrazyPhysicsAdapter(delegate.port as never);

  adapter.activate((deltaSeconds) => stepped.push(deltaSeconds));
  assert.equal(delegate.configureCount, 1);
  assert.deepEqual(adapter.state, {
    active: true,
    frozen: false,
    restorePending: false,
    worldSpeed: CRAZY_NORMAL_WORLD_SPEED,
  });
  assert.equal(delegate.resolveDelta?.(0.02), Math.fround(0.02));
  delegate.afterStep?.(0.02);
  assert.deepEqual(stepped, [0.02]);

  adapter.freezeWorld();
  assert.equal(adapter.physicsStepDelta(0.02), Math.fround(Math.fround(0.02) * 0.5));
  assert.equal(adapter.state.worldSpeed, CRAZY_FROZEN_WORLD_SPEED);
  adapter.unfreezeWorld();
  assert.equal(adapter.physicsStepDelta(0.02), Math.fround(0.02));
  assert.equal(adapter.state.worldSpeed, CRAZY_NORMAL_WORLD_SPEED);
});

test('freeze ownership restores exactly once without a global Crazy bomb hold', () => {
  const delegate = createDelegate();
  const adapter = new CrazyPhysicsAdapter(delegate.port as never);
  adapter.activate(() => {});
  adapter.freezeWorld();
  assert.deepEqual(adapter.state, {
    active: true,
    frozen: true,
    restorePending: false,
    worldSpeed: 0.5,
  });
  assert.equal(adapter.state.frozen, true);
  assert.equal(adapter.state.worldSpeed, 0.5);

  assert.equal(adapter.deactivate(), true);
  assert.equal(adapter.deactivate(), false);
  assert.equal(delegate.restoreCount, 1);
  assert.deepEqual(adapter.state, {
    active: false,
    frozen: false,
    restorePending: false,
    worldSpeed: 1,
  });
});

test('raycasts and after-step mutations remain behind the active Crazy lease', () => {
  const delegate = createDelegate();
  const adapter = new CrazyPhysicsAdapter(delegate.port as never);
  const mutation = () => {};
  assert.throws(() => adapter.callAfterStep(mutation), /must be active/);
  assert.throws(
    () => adapter.raycastAll({ x: 0, y: 0 }, { x: 1, y: 1 }),
    /must be active/,
  );
  adapter.activate(() => {});
  adapter.callAfterStep(mutation);
  assert.equal(delegate.mutations[0], mutation);
  assert.deepEqual(adapter.raycastAll({ x: 0, y: 0 }, { x: 1, y: 1 }), ['hit']);
});

test('activation failure restores the shared singleton and malformed calls fail closed', () => {
  const delegate = createDelegate();
  delegate.failStart = true;
  const adapter = new CrazyPhysicsAdapter(delegate.port as never);
  assert.throws(() => adapter.activate(() => {}), /injected start failure/);
  assert.equal(delegate.restoreCount, 1);
  assert.equal(adapter.state.active, false);
  assert.throws(() => adapter.activate(null as never), /must be a function/);
  assert.throws(() => adapter.physicsStepDelta(-1), /non-negative/);
  assert.throws(
    () => new CrazyPhysicsAdapter({} as never),
    /must provide/,
  );
});

test('configuration failure enters activation cleanup and remains retryable', () => {
  const delegate = createDelegate();
  delegate.failConfigureCount = 1;
  const adapter = new CrazyPhysicsAdapter(delegate.port as never);

  assert.throws(
    () => adapter.activate(() => {}),
    /injected configure failure/,
  );
  assert.deepEqual(delegate.lifecycle, ['configure', 'restore']);
  assert.equal(adapter.state.active, false);

  adapter.activate(() => {});
  assert.deepEqual(
    delegate.lifecycle,
    ['configure', 'restore', 'configure', 'start'],
  );
  assert.equal(adapter.state.active, true);
});

test('activation cleanup failure retains a retryable shared-world restore obligation', () => {
  const delegate = createDelegate();
  delegate.failConfigureCount = 1;
  delegate.failRestoreCount = 1;
  const adapter = new CrazyPhysicsAdapter(delegate.port as never);

  assert.throws(
    () => adapter.activate(() => {}),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, 'CrazyPhysicsActivationError');
      assert.deepEqual(
        (error as { readonly failures: readonly unknown[] }).failures.map(
          errorMessage,
        ),
        ['injected configure failure', 'injected restore failure'],
      );
      return true;
    },
  );
  assert.deepEqual(delegate.lifecycle, ['configure', 'restore']);
  assert.equal(adapter.state.active, false);
  assert.equal(adapter.state.restorePending, true);
  assert.throws(
    () => adapter.activate(() => {}),
    /cleanup must complete before activation/,
  );

  assert.equal(adapter.deactivate(), true);
  assert.equal(adapter.state.restorePending, false);
  adapter.activate(() => {});
  assert.equal(adapter.state.active, true);
  assert.deepEqual(
    delegate.lifecycle,
    ['configure', 'restore', 'restore', 'configure', 'start'],
  );
});

test('failed deactivation retains the active lease so restoration can be retried', () => {
  const delegate = createDelegate();
  const adapter = new CrazyPhysicsAdapter(delegate.port as never);
  adapter.activate(() => {});
  delegate.failRestoreCount = 1;

  assert.throws(() => adapter.deactivate(), /injected restore failure/);
  assert.equal(adapter.state.active, true);
  assert.equal(adapter.deactivate(), true);
  assert.equal(adapter.state.active, false);
  assert.equal(delegate.restoreCount, 2);
});

function createDelegate() {
  const harness = {
    afterStep: null as ((deltaSeconds: number) => void) | null,
    configureCount: 0,
    failConfigureCount: 0,
    failRestoreCount: 0,
    failStart: false,
    lifecycle: [] as string[],
    mutations: [] as Array<() => void>,
    resolveDelta: null as ((deltaSeconds: number) => number) | null,
    restoreCount: 0,
    stopped: [] as boolean[],
    port: {
      callAfterStep(mutation: () => void) {
        harness.mutations.push(mutation);
      },
      configureResolvedWorldProperties() {
        harness.configureCount += 1;
        harness.lifecycle.push('configure');
        if (harness.failConfigureCount > 0) {
          harness.failConfigureCount -= 1;
          throw new Error('injected configure failure');
        }
      },
      raycastAll() {
        return ['hit'];
      },
      restorePreviousWorldProperties() {
        harness.restoreCount += 1;
        harness.lifecycle.push('restore');
        if (harness.failRestoreCount > 0) {
          harness.failRestoreCount -= 1;
          throw new Error('injected restore failure');
        }
      },
      setWorldStopped(stopped: boolean) {
        harness.stopped.push(stopped);
      },
      startVariableSimulation(
        resolveDelta: (deltaSeconds: number) => number,
        afterStep: (deltaSeconds: number) => void,
      ) {
        harness.lifecycle.push('start');
        if (harness.failStart) {
          throw new Error('injected start failure');
        }
        harness.resolveDelta = resolveDelta;
        harness.afterStep = afterStep;
      },
    },
  };
  return harness;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
