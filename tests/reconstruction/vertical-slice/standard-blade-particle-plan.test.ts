import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';

registerHooks({
  resolve(specifier, context, nextResolve) {
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
  STANDARD_BLADE_PARTICLE_Z_ORDER,
  createStandardBladeParticleSpawnCommands,
} = await import(
  '../../../game/assets/scripts/domain/standard-blade-particle-plan.ts'
);

interface IntCall {
  readonly kind: 'int';
  readonly maximumInclusive: number;
  readonly minimumInclusive: number;
}

interface DecileCall {
  readonly kind: 'decile';
}

type RandomCall = IntCall | DecileCall;

class ScriptedRandom {
  readonly calls: RandomCall[] = [];

  private readonly deciles: readonly number[];
  private readonly ints: readonly number[];
  private decileOffset = 0;
  private intOffset = 0;

  constructor(
    ints: readonly number[],
    deciles: readonly number[] = [],
  ) {
    this.ints = ints;
    this.deciles = deciles;
  }

  nextIntInclusive(
    minimumInclusive: number,
    maximumInclusive: number,
  ): number {
    this.calls.push(Object.freeze({
      kind: 'int',
      maximumInclusive,
      minimumInclusive,
    }));
    const value = this.ints[this.intOffset];
    this.intOffset += 1;
    if (value === undefined) {
      throw new Error('scripted int random exhausted');
    }
    return value;
  }

  nextDecile(): number {
    this.calls.push(Object.freeze({ kind: 'decile' }));
    const value = this.deciles[this.decileOffset];
    this.decileOffset += 1;
    if (value === undefined) {
      throw new Error('scripted decile random exhausted');
    }
    return value;
  }

  get consumedDrawCount(): number {
    return this.intOffset + this.decileOffset;
  }
}

const EMPTY_RANDOM_CALLS = Object.freeze([]) as readonly RandomCall[];
const PARTICLE_SOURCE_POSITION = Object.freeze({ x: 240, y: 400 });
const ROTATION_SOURCE_POSITION = Object.freeze({ x: 10, y: 20 });
const ROTATION_TEST_WIDTH = 1000;

const INT_GATE_0_5 = Object.freeze({ kind: 'int', minimumInclusive: 0, maximumInclusive: 5 });
const INT_GATE_0_4 = Object.freeze({ kind: 'int', minimumInclusive: 0, maximumInclusive: 4 });
const INT_GATE_0_6 = Object.freeze({ kind: 'int', minimumInclusive: 0, maximumInclusive: 6 });
const INT_SIGN = Object.freeze({ kind: 'int', minimumInclusive: -1, maximumInclusive: 1 });
const INT_7_MIN_MAG = Object.freeze({ kind: 'int', minimumInclusive: 100, maximumInclusive: 350 });
const INT_8_9_MIN_200_415 = Object.freeze({ kind: 'int', minimumInclusive: 200, maximumInclusive: 415 });
const INT_8_9_MIN_156_312 = Object.freeze({ kind: 'int', minimumInclusive: 156, maximumInclusive: 312 });
const INT_8_9_MIN_100_250 = Object.freeze({ kind: 'int', minimumInclusive: 100, maximumInclusive: 250 });
const INT_9_MIN_50_156 = Object.freeze({ kind: 'int', minimumInclusive: 50, maximumInclusive: 156 });
const INT_10_12_MIN_100_415 = Object.freeze({ kind: 'int', minimumInclusive: 100, maximumInclusive: 415 });
const INT_10_12_MIN_100_200 = Object.freeze({ kind: 'int', minimumInclusive: 100, maximumInclusive: 200 });
const INT_11_FIRE_X = Object.freeze({ kind: 'int', minimumInclusive: -200, maximumInclusive: 200 });
const INT_11_FIRE_Y = Object.freeze({ kind: 'int', minimumInclusive: 50, maximumInclusive: 200 });
const INT_11_SMOKE_X = Object.freeze({ kind: 'int', minimumInclusive: -100, maximumInclusive: 200 });
const INT_11_SMOKE_Y = Object.freeze({ kind: 'int', minimumInclusive: 0, maximumInclusive: 200 });

test('standard particle IDs outside 7 through 12 emit no commands and no random draws', () => {
  for (const bladeId of [0, 1, 2, 3, 4, 5, 6, 13, 14, 15, 16, 17] as const) {
    const random = new ScriptedRandom([]);

    const commands = createStandardBladeParticleSpawnCommands(
      bladeId,
      PARTICLE_SOURCE_POSITION,
      ROTATION_TEST_WIDTH,
      random,
    );

    assert.deepEqual(commands, []);
    assert.equal(Object.isFrozen(commands), true);
    assert.deepEqual(random.calls, EMPTY_RANDOM_CALLS);
    assert.equal(random.consumedDrawCount, 0);
  }
});

test('non-zero gate draws short-circuit every particle branch before any later selection or offset draw', () => {
  const cases = [
    { bladeId: 7, gate: 5, gateCall: INT_GATE_0_5 },
    { bladeId: 8, gate: 1, gateCall: INT_GATE_0_5 },
    { bladeId: 9, gate: 2, gateCall: INT_GATE_0_5 },
    { bladeId: 10, gate: 3, gateCall: INT_GATE_0_5 },
    { bladeId: 11, gate: 4, gateCall: INT_GATE_0_4 },
    { bladeId: 12, gate: 6, gateCall: INT_GATE_0_6 },
  ] as const;

  for (const entry of cases) {
    const random = new ScriptedRandom([entry.gate]);

    const commands = createStandardBladeParticleSpawnCommands(
      entry.bladeId,
      PARTICLE_SOURCE_POSITION,
      ROTATION_TEST_WIDTH,
      random,
    );

    assert.deepEqual(commands, []);
    assert.equal(Object.isFrozen(commands), true);
    assert.deepEqual(random.calls, [entry.gateCall]);
    assert.equal(random.consumedDrawCount, 1);
  }
});

test('ID 7 draws lifetime before signX, magnitudeX, signY, and magnitudeY', () => {
  const random = new ScriptedRandom([0, 50, -1, 100, 1, 350]);

  const commands = createStandardBladeParticleSpawnCommands(
    7,
    PARTICLE_SOURCE_POSITION,
    ROTATION_TEST_WIDTH,
    random,
  );

  assert.deepEqual(random.calls, [
    INT_GATE_0_5,
    { kind: 'int', minimumInclusive: 50, maximumInclusive: 75 },
    INT_SIGN,
    INT_7_MIN_MAG,
    INT_SIGN,
    INT_7_MIN_MAG,
  ]);
  assert.deepEqual(commands, [
    {
      attachmentZOrder: STANDARD_BLADE_PARTICLE_Z_ORDER,
      basePosition: { x: 240, y: 400 },
      delta: { x: -100, y: 350 },
      fadeOutEnabled: true,
      initialRotationDegrees: 0,
      lifetimeSeconds: Math.fround(0.5),
      logicalPath: 'Blades/Particles/VN Flag/vnflagstar.png',
      rotationEnabled: true,
      scaleOutEnabled: true,
      sourceBladeId: 7,
      type: 'spawn-standard-blade-particle',
    },
  ]);
  assertFrozenSpawnCommands(commands);
});

test('signed bounds preserve float32 minima and promoted-double maxima', () => {
  const random = new ScriptedRandom([0, 50, 1, 62, -1, 18]);

  const [command] = createStandardBladeParticleSpawnCommands(
    7,
    PARTICLE_SOURCE_POSITION,
    180,
    random,
  );

  assert.deepEqual(random.calls, [
    INT_GATE_0_5,
    { kind: 'int', minimumInclusive: 50, maximumInclusive: 75 },
    INT_SIGN,
    { kind: 'int', minimumInclusive: 18, maximumInclusive: 62 },
    INT_SIGN,
    { kind: 'int', minimumInclusive: 18, maximumInclusive: 62 },
  ]);
  assert.deepEqual(command?.delta, { x: 62, y: -18 });
});

test('ID 8 selects the exact ice asset, lifetime, and signed pair bounds for all three selections', () => {
  const cases = [
    {
      draws: [0, 0, 1, 200, -1, 415],
      expected: {
        delta: { x: 200, y: -415 },
        lifetimeSeconds: Math.fround(1),
        logicalPath: 'Blades/Particles/Ice/snowflake.png',
        selection: 0,
      },
      signedCall: INT_8_9_MIN_200_415,
    },
    {
      draws: [0, 1, -1, 156, 1, 312],
      expected: {
        delta: { x: -156, y: 312 },
        lifetimeSeconds: Math.fround(0.75),
        logicalPath: 'Blades/Particles/Ice/star.png',
        selection: 1,
      },
      signedCall: INT_8_9_MIN_156_312,
    },
    {
      draws: [0, 2, 1, 100, -1, 250],
      expected: {
        delta: { x: 100, y: -250 },
        lifetimeSeconds: Math.fround(0.5),
        logicalPath: 'Blades/Particles/Ice/circle.png',
        selection: 2,
      },
      signedCall: INT_8_9_MIN_100_250,
    },
  ] as const;

  for (const entry of cases) {
    const random = new ScriptedRandom(entry.draws);

    const commands = createStandardBladeParticleSpawnCommands(
      8,
      PARTICLE_SOURCE_POSITION,
      ROTATION_TEST_WIDTH,
      random,
    );

    assert.deepEqual(random.calls, [
      INT_GATE_0_5,
      { kind: 'int', minimumInclusive: 0, maximumInclusive: 2 },
      INT_SIGN,
      entry.signedCall,
      INT_SIGN,
      entry.signedCall,
    ]);
    assert.deepEqual(commands, [
      {
        attachmentZOrder: STANDARD_BLADE_PARTICLE_Z_ORDER,
        basePosition: { x: 240, y: 400 },
        delta: entry.expected.delta,
        fadeOutEnabled: true,
        initialRotationDegrees: 0,
        lifetimeSeconds: entry.expected.lifetimeSeconds,
        logicalPath: entry.expected.logicalPath,
        rotationEnabled: true,
        scaleOutEnabled: true,
        sourceBladeId: 8,
        type: 'spawn-standard-blade-particle',
      },
    ]);
    assertFrozenSpawnCommands(commands);
    assert.equal(random.consumedDrawCount, 6);
  }
});

test('ID 9 selects the exact X-Mas asset, lifetime, and signed pair bounds for all four selections', () => {
  const cases = [
    {
      draws: [0, 0, 1, 200, -1, 415],
      expected: {
        delta: { x: 200, y: -415 },
        lifetimeSeconds: Math.fround(1),
        logicalPath: 'Blades/Particles/X-Mas/xmasfive.png',
        selection: 0,
      },
      signedCall: INT_8_9_MIN_200_415,
    },
    {
      draws: [0, 1, -1, 156, 1, 312],
      expected: {
        delta: { x: -156, y: 312 },
        lifetimeSeconds: Math.fround(0.75),
        logicalPath: 'Blades/Particles/X-Mas/xmasfour.png',
        selection: 1,
      },
      signedCall: INT_8_9_MIN_156_312,
    },
    {
      draws: [0, 2, 1, 100, -1, 250],
      expected: {
        delta: { x: 100, y: -250 },
        lifetimeSeconds: Math.fround(0.5),
        logicalPath: 'Blades/Particles/X-Mas/xmashexa.png',
        selection: 2,
      },
      signedCall: INT_8_9_MIN_100_250,
    },
    {
      draws: [0, 3, -1, 50, 1, 156],
      expected: {
        delta: { x: -50, y: 156 },
        lifetimeSeconds: Math.fround(0.5),
        logicalPath: 'Blades/Particles/X-Mas/xmascircle.png',
        selection: 3,
      },
      signedCall: INT_9_MIN_50_156,
    },
  ] as const;

  for (const entry of cases) {
    const random = new ScriptedRandom(entry.draws);

    const commands = createStandardBladeParticleSpawnCommands(
      9,
      PARTICLE_SOURCE_POSITION,
      ROTATION_TEST_WIDTH,
      random,
    );

    assert.deepEqual(random.calls, [
      INT_GATE_0_5,
      { kind: 'int', minimumInclusive: 0, maximumInclusive: 3 },
      INT_SIGN,
      entry.signedCall,
      INT_SIGN,
      entry.signedCall,
    ]);
    assert.deepEqual(commands, [
      {
        attachmentZOrder: STANDARD_BLADE_PARTICLE_Z_ORDER,
        basePosition: { x: 240, y: 400 },
        delta: entry.expected.delta,
        fadeOutEnabled: true,
        initialRotationDegrees: 0,
        lifetimeSeconds: entry.expected.lifetimeSeconds,
        logicalPath: entry.expected.logicalPath,
        rotationEnabled: true,
        scaleOutEnabled: true,
        sourceBladeId: 9,
        type: 'spawn-standard-blade-particle',
      },
    ]);
    assertFrozenSpawnCommands(commands);
    assert.equal(random.consumedDrawCount, 6);
  }
});

test('ID 10 keeps selection and lifetime ordering before the recovered vector-angle rotation', () => {
  const random = new ScriptedRandom([0, 5, 75, 1, 110, 1, 120]);

  const commands = createStandardBladeParticleSpawnCommands(
    10,
    ROTATION_SOURCE_POSITION,
    ROTATION_TEST_WIDTH,
    random,
  );

  assert.deepEqual(random.calls, [
    INT_GATE_0_5,
    { kind: 'int', minimumInclusive: 0, maximumInclusive: 5 },
    { kind: 'int', minimumInclusive: 50, maximumInclusive: 75 },
    INT_SIGN,
    INT_10_12_MIN_100_415,
    INT_SIGN,
    INT_10_12_MIN_100_415,
  ]);
  assert.deepEqual(commands, [
    {
      attachmentZOrder: STANDARD_BLADE_PARTICLE_Z_ORDER,
      basePosition: { x: 10, y: 20 },
      delta: { x: 110, y: 120 },
      fadeOutEnabled: true,
      initialRotationDegrees: recoveredVectorRotation({ x: 10, y: 20 }, { x: 110, y: 120 }),
      lifetimeSeconds: Math.fround(0.75),
      logicalPath: 'Blades/Particles/Butterfly/butterfly5.png',
      rotationEnabled: true,
      scaleOutEnabled: true,
      sourceBladeId: 10,
      type: 'spawn-standard-blade-particle',
    },
  ]);
  assertFrozenSpawnCommands(commands);
  assert.equal(random.consumedDrawCount, 7);
});

test('ID 11 selection 0 preserves gate, selection, lifetime, and direct-range ordering', () => {
  const random = new ScriptedRandom([0, 0, 125, 200, 50]);

  const commands = createStandardBladeParticleSpawnCommands(
    11,
    PARTICLE_SOURCE_POSITION,
    ROTATION_TEST_WIDTH,
    random,
  );

  assert.deepEqual(random.calls, [
    INT_GATE_0_4,
    { kind: 'int', minimumInclusive: 0, maximumInclusive: 2 },
    { kind: 'int', minimumInclusive: 25, maximumInclusive: 125 },
    INT_11_FIRE_X,
    INT_11_FIRE_Y,
  ]);
  assert.deepEqual(commands, [
    {
      attachmentZOrder: STANDARD_BLADE_PARTICLE_Z_ORDER,
      basePosition: { x: 240, y: 400 },
      delta: { x: 200, y: 50 },
      fadeOutEnabled: true,
      initialRotationDegrees: 0,
      lifetimeSeconds: Math.fround(1.25),
      logicalPath: 'Blades/Particles/Fire/firecircle.png',
      rotationEnabled: false,
      scaleOutEnabled: false,
      sourceBladeId: 11,
      type: 'spawn-standard-blade-particle',
    },
  ]);
  assertFrozenSpawnCommands(commands);
});

test('ID 11 selection 1 reads the decile after lifetime and direct-range draws', () => {
  const random = new ScriptedRandom([0, 1, 25, -200, 200], [0.2]);

  const commands = createStandardBladeParticleSpawnCommands(
    11,
    PARTICLE_SOURCE_POSITION,
    ROTATION_TEST_WIDTH,
    random,
  );

  assert.deepEqual(random.calls, [
    INT_GATE_0_4,
    { kind: 'int', minimumInclusive: 0, maximumInclusive: 2 },
    { kind: 'int', minimumInclusive: 25, maximumInclusive: 125 },
    INT_11_FIRE_X,
    INT_11_FIRE_Y,
    { kind: 'decile' },
  ]);
  assert.deepEqual(commands, [
    {
      attachmentZOrder: STANDARD_BLADE_PARTICLE_Z_ORDER,
      basePosition: { x: 240, y: 400 },
      delta: { x: -200, y: 200 },
      fadeOutEnabled: true,
      initialRotationDegrees: Math.fround(9),
      lifetimeSeconds: Math.fround(0.25),
      logicalPath: 'Blades/Particles/Fire/fireparticle.png',
      rotationEnabled: false,
      scaleOutEnabled: true,
      sourceBladeId: 11,
      type: 'spawn-standard-blade-particle',
    },
  ]);
  assertFrozenSpawnCommands(commands);
  assert.equal(random.consumedDrawCount, 6);
});

test('ID 11 selection 2 repeats lifetime, x, and y draws exactly three times for smoke', () => {
  const random = new ScriptedRandom([
    0,
    2,
    25,
    -100,
    0,
    125,
    200,
    200,
    50,
    50,
    100,
  ]);

  const commands = createStandardBladeParticleSpawnCommands(
    11,
    PARTICLE_SOURCE_POSITION,
    ROTATION_TEST_WIDTH,
    random,
  );

  assert.deepEqual(random.calls, [
    INT_GATE_0_4,
    { kind: 'int', minimumInclusive: 0, maximumInclusive: 2 },
    { kind: 'int', minimumInclusive: 25, maximumInclusive: 125 },
    INT_11_SMOKE_X,
    INT_11_SMOKE_Y,
    { kind: 'int', minimumInclusive: 25, maximumInclusive: 125 },
    INT_11_SMOKE_X,
    INT_11_SMOKE_Y,
    { kind: 'int', minimumInclusive: 25, maximumInclusive: 125 },
    INT_11_SMOKE_X,
    INT_11_SMOKE_Y,
  ]);
  assert.deepEqual(commands, [
    {
      attachmentZOrder: STANDARD_BLADE_PARTICLE_Z_ORDER,
      basePosition: { x: 240, y: 400 },
      delta: { x: -100, y: 0 },
      fadeOutEnabled: true,
      initialRotationDegrees: 0,
      lifetimeSeconds: Math.fround(0.25),
      logicalPath: 'Blades/Particles/Fire/smoke.png',
      rotationEnabled: false,
      scaleOutEnabled: false,
      sourceBladeId: 11,
      type: 'spawn-standard-blade-particle',
    },
    {
      attachmentZOrder: STANDARD_BLADE_PARTICLE_Z_ORDER,
      basePosition: { x: 240, y: 400 },
      delta: { x: 200, y: 200 },
      fadeOutEnabled: true,
      initialRotationDegrees: 0,
      lifetimeSeconds: Math.fround(1.25),
      logicalPath: 'Blades/Particles/Fire/smoke.png',
      rotationEnabled: false,
      scaleOutEnabled: false,
      sourceBladeId: 11,
      type: 'spawn-standard-blade-particle',
    },
    {
      attachmentZOrder: STANDARD_BLADE_PARTICLE_Z_ORDER,
      basePosition: { x: 240, y: 400 },
      delta: { x: 50, y: 100 },
      fadeOutEnabled: true,
      initialRotationDegrees: 0,
      lifetimeSeconds: Math.fround(0.5),
      logicalPath: 'Blades/Particles/Fire/smoke.png',
      rotationEnabled: false,
      scaleOutEnabled: false,
      sourceBladeId: 11,
      type: 'spawn-standard-blade-particle',
    },
  ]);
  assertFrozenSpawnCommands(commands);
  assert.equal(random.consumedDrawCount, 11);
});

test('ID 12 keeps selection ordering and the recovered vector-angle rotation formula', () => {
  const random = new ScriptedRandom([0, 4, 150, 1, 110, 1, 120]);

  const commands = createStandardBladeParticleSpawnCommands(
    12,
    ROTATION_SOURCE_POSITION,
    ROTATION_TEST_WIDTH,
    random,
  );

  assert.deepEqual(random.calls, [
    INT_GATE_0_6,
    { kind: 'int', minimumInclusive: 0, maximumInclusive: 4 },
    { kind: 'int', minimumInclusive: 50, maximumInclusive: 150 },
    INT_SIGN,
    INT_10_12_MIN_100_200,
    INT_SIGN,
    INT_10_12_MIN_100_200,
  ]);
  assert.deepEqual(commands, [
    {
      attachmentZOrder: STANDARD_BLADE_PARTICLE_Z_ORDER,
      basePosition: { x: 10, y: 20 },
      delta: { x: 110, y: 120 },
      fadeOutEnabled: true,
      initialRotationDegrees: recoveredVectorRotation({ x: 10, y: 20 }, { x: 110, y: 120 }),
      lifetimeSeconds: Math.fround(1.5),
      logicalPath: 'Blades/Particles/Rainbow/rainbowstar4.png',
      rotationEnabled: true,
      scaleOutEnabled: true,
      sourceBladeId: 12,
      type: 'spawn-standard-blade-particle',
    },
  ]);
  assertFrozenSpawnCommands(commands);
  assert.equal(random.consumedDrawCount, 7);
});

test('the native zero-vector angle keeps its draw stream and uses a finite Creator fallback', () => {
  const source = Object.freeze({ x: 100, y: 100 });
  for (const entry of [
    {
      bladeId: 10,
      draws: [0, 0, 50, 1, 100, 1, 100],
      gateCall: INT_GATE_0_5,
      lifetimeCall: Object.freeze({
        kind: 'int',
        minimumInclusive: 50,
        maximumInclusive: 75,
      }),
      magnitudeCall: INT_10_12_MIN_100_415,
      selectionMaximum: 5,
    },
    {
      bladeId: 12,
      draws: [0, 0, 50, 1, 100, 1, 100],
      gateCall: INT_GATE_0_6,
      lifetimeCall: Object.freeze({
        kind: 'int',
        minimumInclusive: 50,
        maximumInclusive: 150,
      }),
      magnitudeCall: INT_10_12_MIN_100_200,
      selectionMaximum: 4,
    },
  ] as const) {
    const random = new ScriptedRandom(entry.draws);
    const [command] = createStandardBladeParticleSpawnCommands(
      entry.bladeId,
      source,
      ROTATION_TEST_WIDTH,
      random,
    );

    assert.equal(command?.initialRotationDegrees, 0);
    assert.deepEqual(command?.delta, source);
    assert.deepEqual(random.calls, [
      entry.gateCall,
      {
        kind: 'int',
        minimumInclusive: 0,
        maximumInclusive: entry.selectionMaximum,
      },
      entry.lifetimeCall,
      INT_SIGN,
      entry.magnitudeCall,
      INT_SIGN,
      entry.magnitudeCall,
    ]);
    assert.equal(random.consumedDrawCount, 7);
  }
});

test('invalid integer and decile draws fail exactly at the draw boundary', () => {
  assertInvalidDraw(
    7,
    [1.5],
    TypeError,
    [INT_GATE_0_5],
  );
  assertInvalidDraw(
    8,
    [0, 3],
    RangeError,
    [INT_GATE_0_5, { kind: 'int', minimumInclusive: 0, maximumInclusive: 2 }],
  );
  assertInvalidDraw(
    11,
    [0, 1, 25, 0, 50],
    [1],
    RangeError,
    [
      INT_GATE_0_4,
      { kind: 'int', minimumInclusive: 0, maximumInclusive: 2 },
      { kind: 'int', minimumInclusive: 25, maximumInclusive: 125 },
      INT_11_FIRE_X,
      INT_11_FIRE_Y,
      { kind: 'decile' },
    ],
  );
});

test('returned command arrays and nested points are frozen', () => {
  const random = new ScriptedRandom([0, 50, -1, 100, 1, 350]);

  const commands = createStandardBladeParticleSpawnCommands(
    7,
    PARTICLE_SOURCE_POSITION,
    ROTATION_TEST_WIDTH,
    random,
  );

  assert.equal(Object.isFrozen(commands), true);
  assert.equal(Object.isFrozen(commands[0]), true);
  assert.equal(Object.isFrozen(commands[0]?.basePosition), true);
  assert.equal(Object.isFrozen(commands[0]?.delta), true);
});

function assertFrozenSpawnCommands(
  commands: readonly Readonly<{
    readonly basePosition: Readonly<{ readonly x: number; readonly y: number }>;
    readonly delta: Readonly<{ readonly x: number; readonly y: number }>;
  }>[],
): void {
  assert.equal(Object.isFrozen(commands), true);
  for (const command of commands) {
    assert.equal(Object.isFrozen(command), true);
    assert.equal(Object.isFrozen(command.basePosition), true);
    assert.equal(Object.isFrozen(command.delta), true);
  }
}

function assertInvalidDraw(
  bladeId: 7 | 8 | 11,
  draws: readonly number[],
  deciles: readonly number[] | typeof TypeError | typeof RangeError,
  errorType: typeof TypeError | typeof RangeError | readonly RandomCall[],
  expectedCalls?: readonly RandomCall[],
): void {
  const actualDeciles = Array.isArray(deciles) ? deciles : [];
  const actualErrorType = Array.isArray(deciles) ? errorType : deciles;
  const actualExpectedCalls = Array.isArray(deciles)
    ? expectedCalls ?? []
    : errorType as readonly RandomCall[];
  const random = new ScriptedRandom(draws, actualDeciles);

  assert.throws(() => {
    createStandardBladeParticleSpawnCommands(
      bladeId,
      PARTICLE_SOURCE_POSITION,
      ROTATION_TEST_WIDTH,
      random,
    );
  }, actualErrorType);

  assert.deepEqual(random.calls, actualExpectedCalls);
  assert.equal(random.consumedDrawCount, draws.length + actualDeciles.length);
}

function recoveredVectorRotation(
  nodePosition: Readonly<{ readonly x: number; readonly y: number }>,
  randomMoveBy: Readonly<{ readonly x: number; readonly y: number }>,
): number {
  const differenceX = Math.fround(randomMoveBy.x - nodePosition.x);
  const differenceY = Math.fround(randomMoveBy.y - nodePosition.y);
  const ratio = Math.fround(Math.fround(-differenceX) / differenceY);
  const radians = Math.fround(Math.atan(ratio));
  return Math.fround(radians * Math.fround(180 / Math.PI));
}
