import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BIRD_BLADE_PARTICLE_DEFINITIONS,
  BIRD_BLADE_PARTICLE_GATE_MAXIMUM,
  BIRD_BLADE_PARTICLE_SELECTION_MAXIMUM,
  BIRD_BLADE_PARTICLE_Z_ORDER,
  createBirdBladeParticleUpdateCommands,
} from '../../../game/assets/scripts/domain/bird-blade-particle-plan.ts';

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
    return value!;
  }

  get consumedDrawCount(): number {
    return this.nextDraw;
  }
}

const GATE_CALL = Object.freeze({ minimumInclusive: 0, maximumInclusive: 4 });
const SELECTION_CALL = Object.freeze({ minimumInclusive: 0, maximumInclusive: 3 });
const X_CALL = Object.freeze({ minimumInclusive: -61, maximumInclusive: 61 });
const Y_FIVE_FOUR_CALL = Object.freeze({
  minimumInclusive: -385,
  maximumInclusive: -24,
});
const Y_HEXA_CALL = Object.freeze({
  minimumInclusive: -385,
  maximumInclusive: -123,
});
const SIGN_CALL = Object.freeze({ minimumInclusive: -1, maximumInclusive: 1 });
const SIGNED_MAGNITUDE_CALL = Object.freeze({
  minimumInclusive: -192,
  maximumInclusive: -123,
});

test('particle definition table preserves all four exact assets, lifetimes, and strategies', () => {
  assert.equal(BIRD_BLADE_PARTICLE_GATE_MAXIMUM, 4);
  assert.equal(BIRD_BLADE_PARTICLE_SELECTION_MAXIMUM, 3);
  assert.equal(BIRD_BLADE_PARTICLE_Z_ORDER, 1);
  assert.deepEqual(BIRD_BLADE_PARTICLE_DEFINITIONS, [
    {
      selection: 0,
      logicalPath: 'Blades/Particles/X-Mas/xmasfive.png',
      lifetimeSeconds: Math.fround(1.5),
      offsetStrategy: 'independent-axis-ranges',
    },
    {
      selection: 1,
      logicalPath: 'Blades/Particles/X-Mas/xmasfour.png',
      lifetimeSeconds: Math.fround(1),
      offsetStrategy: 'independent-axis-ranges',
    },
    {
      selection: 2,
      logicalPath: 'Blades/Particles/X-Mas/xmashexa.png',
      lifetimeSeconds: Math.fround(0.75),
      offsetStrategy: 'independent-axis-ranges',
    },
    {
      selection: 3,
      logicalPath: 'Blades/Particles/X-Mas/xmascircle.png',
      lifetimeSeconds: Math.fround(0.5),
      offsetStrategy: 'signed-pair',
    },
  ]);
  assert.equal(Object.isFrozen(BIRD_BLADE_PARTICLE_DEFINITIONS), true);
  assert.equal(
    BIRD_BLADE_PARTICLE_DEFINITIONS.every((definition) => Object.isFrozen(definition)),
    true,
  );
});

test('every nonzero inclusive 0..4 gate result consumes only the per-update gate', () => {
  for (const gate of [1, 2, 3, 4]) {
    const random = new ScriptedRandom([gate]);

    const commands = createBirdBladeParticleUpdateCommands(
      { x: 240, y: 400 },
      1234,
      random,
    );

    assert.deepEqual(commands, []);
    assert.equal(Object.isFrozen(commands), true);
    assert.deepEqual(random.calls, [GATE_CALL]);
    assert.equal(random.consumedDrawCount, 1);
  }
});

test('selections 0 and 1 use the shared independent x/y ranges after gate and selection', () => {
  const cases = [
    {
      draws: [0, 0, -61, -385],
      expected: {
        lifetimeSeconds: Math.fround(1.5),
        logicalPath: 'Blades/Particles/X-Mas/xmasfive.png',
        randomOffset: { x: -61, y: -385 },
        selection: 0,
      },
    },
    {
      draws: [0, 1, 61, -24],
      expected: {
        lifetimeSeconds: Math.fround(1),
        logicalPath: 'Blades/Particles/X-Mas/xmasfour.png',
        randomOffset: { x: 61, y: -24 },
        selection: 1,
      },
    },
  ] as const;

  for (const entry of cases) {
    const random = new ScriptedRandom(entry.draws);
    const [command] = createBirdBladeParticleUpdateCommands(
      { x: 240, y: 400 },
      1234,
      random,
    );

    assert.ok(command);
    assert.deepEqual(random.calls, [
      GATE_CALL,
      SELECTION_CALL,
      X_CALL,
      Y_FIVE_FOUR_CALL,
    ]);
    assert.deepEqual(command, {
      type: 'spawn-bird-blade-particle',
      logicalPath: entry.expected.logicalPath,
      selection: entry.expected.selection,
      lifetimeSeconds: entry.expected.lifetimeSeconds,
      basePosition: { x: 240, y: 307.45001220703125 },
      randomOffset: entry.expected.randomOffset,
      rotationEnabled: true,
      scaleOutEnabled: true,
      fadeOutEnabled: true,
      attachmentZOrder: 1,
    });
    assert.equal(Object.isFrozen(command), true);
    assert.equal(Object.isFrozen(command.basePosition), true);
    assert.equal(Object.isFrozen(command.randomOffset), true);
  }
});

test('selection 2 uses its distinct y maximum and preserves x then y draw order', () => {
  const random = new ScriptedRandom([0, 2, 0, -123]);

  const [command] = createBirdBladeParticleUpdateCommands(
    { x: 240, y: 400 },
    1234,
    random,
  );

  assert.deepEqual(random.calls, [
    GATE_CALL,
    SELECTION_CALL,
    X_CALL,
    Y_HEXA_CALL,
  ]);
  assert.deepEqual(command, {
    type: 'spawn-bird-blade-particle',
    logicalPath: 'Blades/Particles/X-Mas/xmashexa.png',
    selection: 2,
    lifetimeSeconds: Math.fround(0.75),
    basePosition: { x: 240, y: 307.45001220703125 },
    randomOffset: { x: 0, y: -123 },
    rotationEnabled: true,
    scaleOutEnabled: true,
    fadeOutEnabled: true,
    attachmentZOrder: 1,
  });
});

test('selection 3 reproduces RandomPositionData sign, magnitude, sign, magnitude ordering', () => {
  const random = new ScriptedRandom([0, 3, -1, -192, 1, -123]);

  const [command] = createBirdBladeParticleUpdateCommands(
    { x: 240, y: 400 },
    1234,
    random,
  );

  assert.deepEqual(random.calls, [
    GATE_CALL,
    SELECTION_CALL,
    SIGN_CALL,
    SIGNED_MAGNITUDE_CALL,
    SIGN_CALL,
    SIGNED_MAGNITUDE_CALL,
  ]);
  assert.deepEqual(command, {
    type: 'spawn-bird-blade-particle',
    logicalPath: 'Blades/Particles/X-Mas/xmascircle.png',
    selection: 3,
    lifetimeSeconds: Math.fround(0.5),
    basePosition: { x: 240, y: 307.45001220703125 },
    randomOffset: { x: 192, y: -123 },
    rotationEnabled: true,
    scaleOutEnabled: true,
    fadeOutEnabled: true,
    attachmentZOrder: 1,
  });
});

test('each random result is validated at its draw boundary without later consumption', () => {
  assertInvalidDraw([5], RangeError, [GATE_CALL]);
  assertInvalidDraw([1.5], TypeError, [GATE_CALL]);
  assertInvalidDraw([0, 4], RangeError, [GATE_CALL, SELECTION_CALL]);
  assertInvalidDraw([0, 0, 62], RangeError, [
    GATE_CALL,
    SELECTION_CALL,
    X_CALL,
  ]);
  assertInvalidDraw([0, 2, 0, -122], RangeError, [
    GATE_CALL,
    SELECTION_CALL,
    X_CALL,
    Y_HEXA_CALL,
  ]);
  assertInvalidDraw([0, 3, 2], RangeError, [
    GATE_CALL,
    SELECTION_CALL,
    SIGN_CALL,
  ]);
});

test('malformed points, scalars, and random ports fail before a draw', () => {
  const random = new ScriptedRandom([4]);
  assert.throws(
    () => createBirdBladeParticleUpdateCommands(
      { x: Number.NaN, y: 0 },
      1234,
      random,
    ),
    RangeError,
  );
  assert.throws(
    () => createBirdBladeParticleUpdateCommands(
      { x: 0, y: 0 },
      0,
      random,
    ),
    RangeError,
  );
  assert.equal(random.consumedDrawCount, 0);
  assert.throws(
    () => createBirdBladeParticleUpdateCommands(
      { x: 0, y: 0 },
      1234,
      null as never,
    ),
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
    () => createBirdBladeParticleUpdateCommands(
      { x: 240, y: 400 },
      1234,
      random,
    ),
    ErrorType,
  );
  assert.deepEqual(random.calls, expectedCalls);
  assert.equal(random.consumedDrawCount, draws.length);
}
