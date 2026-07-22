import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLASSIC_CRITICAL_PARTICLE_SCALE_OUT_ACTION_SECONDS,
  createClassicCriticalParticleUpdateCommands,
} from '../../../game/assets/scripts/domain/classic-critical-particle-plan.ts';

interface InclusiveCall {
  readonly maximumInclusive: number;
  readonly minimumInclusive: number;
}

class ScriptedRandom {
  readonly calls: InclusiveCall[] = [];
  private readonly draws: readonly number[];
  private nextDraw = 0;

  constructor(draws: readonly number[]) {
    this.draws = draws;
  }

  nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number {
    this.calls.push(Object.freeze({ maximumInclusive, minimumInclusive }));
    if (this.nextDraw >= this.draws.length) {
      throw new Error('scripted random exhausted');
    }
    const value = this.draws[this.nextDraw];
    this.nextDraw += 1;
    return value;
  }

  get consumedDrawCount(): number {
    return this.nextDraw;
  }
}

const GATE_CALL = Object.freeze({ minimumInclusive: 0, maximumInclusive: 3 });
const RESOURCE_CALL = Object.freeze({ minimumInclusive: 1, maximumInclusive: 4 });
const DEAD_DRAW_CALL = Object.freeze({ minimumInclusive: -10, maximumInclusive: 10 });

test('noncritical active halves emit nothing and consume no shared random draw', () => {
  const random = new ScriptedRandom([]);

  const commands = createClassicCriticalParticleUpdateCommands(false, random);

  assert.deepEqual(commands, []);
  assert.equal(Object.isFrozen(commands), true);
  assert.equal(random.consumedDrawCount, 0);
  assert.deepEqual(random.calls, []);
});

test('every nonzero inclusive 0..3 gate result consumes only the gate draw', () => {
  for (const gate of [1, 2, 3]) {
    const random = new ScriptedRandom([gate]);

    assert.deepEqual(createClassicCriticalParticleUpdateCommands(true, random), []);
    assert.deepEqual(random.calls, [GATE_CALL]);
    assert.equal(random.consumedDrawCount, 1);
  }
});

test('zero gate selects all four exact logical resources before consuming the dead draw', () => {
  const expectedPaths = [
    'Criticles/criticle1.png',
    'Criticles/criticle2.png',
    'Criticles/criticle3.png',
    'Criticles/criticle4.png',
  ] as const;

  for (const [offset, logicalPath] of expectedPaths.entries()) {
    const resourceIndex = offset + 1;
    const deadDraw = resourceIndex % 2 === 0 ? 10 : -10;
    const random = new ScriptedRandom([0, resourceIndex, deadDraw]);

    const commands = createClassicCriticalParticleUpdateCommands(true, random);

    assert.deepEqual(random.calls, [GATE_CALL, RESOURCE_CALL, DEAD_DRAW_CALL]);
    assert.equal(random.consumedDrawCount, 3);
    assert.deepEqual(commands, [{
      type: 'spawn-critical-particle',
      logicalPath,
      resourceIndex,
      scaleOutActionSeconds: Math.fround(1.5),
    }]);
    assert.equal(Object.isFrozen(commands), true);
    assert.equal(Object.isFrozen(commands[0]), true);
  }
});

test('scale-out duration is the recovered float32 action duration', () => {
  const random = new ScriptedRandom([0, 1, 0]);
  const [command] = createClassicCriticalParticleUpdateCommands(true, random);

  assert.equal(CLASSIC_CRITICAL_PARTICLE_SCALE_OUT_ACTION_SECONDS, Math.fround(1.5));
  assert.equal(command.scaleOutActionSeconds, CLASSIC_CRITICAL_PARTICLE_SCALE_OUT_ACTION_SECONDS);
});

test('each random return is validated at its draw boundary without later consumption', () => {
  assertInvalidDraw([4], RangeError, [GATE_CALL]);
  assertInvalidDraw([-1], RangeError, [GATE_CALL]);
  assertInvalidDraw([1.5], TypeError, [GATE_CALL]);

  assertInvalidDraw([0, 0], RangeError, [GATE_CALL, RESOURCE_CALL]);
  assertInvalidDraw([0, 5], RangeError, [GATE_CALL, RESOURCE_CALL]);
  assertInvalidDraw([0, Number.NaN], TypeError, [GATE_CALL, RESOURCE_CALL]);

  assertInvalidDraw([0, 1, -11], RangeError, [GATE_CALL, RESOURCE_CALL, DEAD_DRAW_CALL]);
  assertInvalidDraw([0, 4, 11], RangeError, [GATE_CALL, RESOURCE_CALL, DEAD_DRAW_CALL]);
  assertInvalidDraw([0, 1, Number.POSITIVE_INFINITY], TypeError, [
    GATE_CALL,
    RESOURCE_CALL,
    DEAD_DRAW_CALL,
  ]);
});

test('malformed critical and random inputs reject before any draw', () => {
  const random = new ScriptedRandom([0]);
  assert.throws(
    () => createClassicCriticalParticleUpdateCommands(1 as never, random),
    TypeError,
  );
  assert.equal(random.consumedDrawCount, 0);

  assert.throws(
    () => createClassicCriticalParticleUpdateCommands(true, null as never),
    TypeError,
  );
  assert.throws(
    () => createClassicCriticalParticleUpdateCommands(false, {} as never),
    TypeError,
  );
});

function assertInvalidDraw(
  draws: readonly number[],
  ErrorType: typeof TypeError | typeof RangeError,
  expectedCalls: readonly InclusiveCall[],
): void {
  const random = new ScriptedRandom(draws);
  assert.throws(
    () => createClassicCriticalParticleUpdateCommands(true, random),
    ErrorType,
  );
  assert.deepEqual(random.calls, expectedCalls);
  assert.equal(random.consumedDrawCount, draws.length);
}
