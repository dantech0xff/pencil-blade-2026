import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ClassicVariableStepRunner,
  type ClassicVariableStepPort,
} from '../../../game/assets/scripts/domain/classic-variable-step.ts';

test('variable runner preserves manual Physics2D lifecycle ordering', () => {
  const calls: string[] = [];
  let runner: ClassicVariableStepRunner;
  const port = recordingPort(calls, {
    step: (deltaSeconds) => {
      calls.push(`step:${deltaSeconds}`);
      runner.callAfterStep(() => calls.push('deferred-mutation'));
    },
  });
  runner = new ClassicVariableStepRunner(port);

  assert.equal(runner.run(Math.fround(1 / 60)), true);
  assert.deepEqual(calls, [
    'before',
    'sync-scene-to-physics',
    `step:${Math.fround(1 / 60)}`,
    'deferred-mutation',
    'sync-physics-to-scene',
    'draw-debug',
    'after',
  ]);
  assert.equal(runner.stepping, false);
});

test('disabled physics skips the entire manual lifecycle', () => {
  const calls: string[] = [];
  const runner = new ClassicVariableStepRunner(recordingPort(calls, {
    isEnabled: () => false,
  }));

  assert.equal(runner.run(1 / 60), false);
  assert.deepEqual(calls, []);
});

test('mutations outside a step execute immediately', () => {
  const calls: string[] = [];
  const runner = new ClassicVariableStepRunner(recordingPort(calls));

  runner.callAfterStep(() => calls.push('immediate-mutation'));
  assert.deepEqual(calls, ['immediate-mutation']);
});

test('failed steps clear queued mutations and close the physics event bracket', () => {
  const calls: string[] = [];
  let runner: ClassicVariableStepRunner;
  const port = recordingPort(calls, {
    step: () => {
      runner.callAfterStep(() => calls.push('must-not-run'));
      throw new Error('step failed');
    },
  });
  runner = new ClassicVariableStepRunner(port);

  assert.throws(() => runner.run(0.25), /step failed/);
  assert.deepEqual(calls, ['before', 'sync-scene-to-physics', 'after']);
  assert.equal(runner.stepping, false);
  runner.callAfterStep(() => calls.push('recovered'));
  assert.equal(calls.at(-1), 'recovered');
});

test('a failed deferred mutation does not skip later cleanup or post-step synchronization', () => {
  const calls: string[] = [];
  let runner: ClassicVariableStepRunner;
  const port = recordingPort(calls, {
    step: () => {
      calls.push('step');
      runner.callAfterStep(() => {
        calls.push('failed-mutation');
        throw new Error('deferred mutation failed');
      });
      runner.callAfterStep(() => calls.push('later-cleanup'));
    },
  });
  runner = new ClassicVariableStepRunner(port);

  assert.throws(() => runner.run(0.25), /deferred mutation failed/);
  assert.deepEqual(calls, [
    'before',
    'sync-scene-to-physics',
    'step',
    'failed-mutation',
    'later-cleanup',
    'sync-physics-to-scene',
    'draw-debug',
    'after',
  ]);
  assert.equal(runner.stepping, false);
});

test('variable runner rejects invalid deltas and ports', () => {
  assert.throws(
    () => new ClassicVariableStepRunner(null as unknown as ClassicVariableStepPort),
    TypeError,
  );
  const runner = new ClassicVariableStepRunner(recordingPort([]));
  assert.throws(() => runner.run(Number.NaN), RangeError);
  assert.throws(() => runner.run(-0.001), RangeError);
  assert.throws(() => runner.callAfterStep(null as unknown as () => void), TypeError);
});

function recordingPort(
  calls: string[],
  overrides: Partial<ClassicVariableStepPort> = {},
): ClassicVariableStepPort {
  return {
    afterStep: overrides.afterStep ?? (() => calls.push('after')),
    beforeStep: overrides.beforeStep ?? (() => calls.push('before')),
    drawDebug: overrides.drawDebug ?? (() => calls.push('draw-debug')),
    isEnabled: overrides.isEnabled ?? (() => true),
    step: overrides.step ?? ((deltaSeconds) => calls.push(`step:${deltaSeconds}`)),
    syncPhysicsToScene: overrides.syncPhysicsToScene
      ?? (() => calls.push('sync-physics-to-scene')),
    syncSceneToPhysics: overrides.syncSceneToPhysics
      ?? (() => calls.push('sync-scene-to-physics')),
  };
}
