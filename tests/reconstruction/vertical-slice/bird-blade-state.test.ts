import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

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
  BIRD_BLADE_IDLE_STATE,
  BIRD_BLADE_MOVING_STATE,
  BIRD_BLADE_RAY_GATE_MAXIMUM,
  BIRD_BLADE_SETTLE_STATE,
  BIRD_BLADE_TYPE,
  BirdBladeStateMachine,
  getBirdBladeMovementScalar,
} = await import(
  '../../../game/assets/scripts/domain/bird-blade-state.ts'
);

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

const RAY_CALL = Object.freeze({ minimumInclusive: 0, maximumInclusive: 3 });
const PARTICLE_GATE_CALL = Object.freeze({
  minimumInclusive: 0,
  maximumInclusive: 4,
});

test('initial state is centered idle type 1 and scalar uses native float32 multiply then divide', () => {
  const random = new ScriptedRandom([4]);
  const blade = createBlade(random);

  assert.equal(BIRD_BLADE_TYPE, 1);
  assert.equal(BIRD_BLADE_IDLE_STATE, 0);
  assert.equal(BIRD_BLADE_MOVING_STATE, 1);
  assert.equal(BIRD_BLADE_SETTLE_STATE, 2);
  assert.equal(BIRD_BLADE_RAY_GATE_MAXIMUM, 3);
  assert.equal(getBirdBladeMovementScalar(480), 1234);
  assert.equal(getBirdBladeMovementScalar(720), 1851);
  assert.equal(
    getBirdBladeMovementScalar(653.1628029005719),
    1679.172607421875,
  );
  assert.notEqual(
    getBirdBladeMovementScalar(653.1628029005719),
    Math.fround(653.1628029005719 * 1234 / 480),
  );
  assert.deepEqual(blade.snapshot(), {
    type: 1,
    state: 0,
    movementScalar: 1234,
    currentPosition: { x: 240, y: 400 },
    targetPosition: { x: 240, y: 400 },
    movementOrigin: { x: 240, y: 400 },
    activeDirection: null,
    rotationDegrees: 0,
    rayCached: false,
  });

  const idle = blade.update(0);
  assert.equal(idle.branch, 'idle');
  assert.equal(idle.trailOperation, 'none');
  assert.deepEqual(idle.particleCommands, []);
  assert.deepEqual(random.calls, [PARTICLE_GATE_CALL]);
});

test('target x equality selects left and every later busy touch rejects without mutation', () => {
  const random = new ScriptedRandom([]);
  const blade = createBlade(random);
  const rightBlade = createBlade(new ScriptedRandom([]));

  assert.equal(
    rightBlade.touch({ x: 241, y: 400 }).activeDirection,
    'right',
  );

  assert.deepEqual(blade.touch({ x: 240, y: 500 }), {
    accepted: true,
    activeDirection: 'left',
    resetTrail: true,
    rotationDegrees: 270,
  });
  const acceptedSnapshot = blade.snapshot();

  assert.deepEqual(
    blade.touch({ x: Number.NaN, y: Number.POSITIVE_INFINITY }),
    {
      accepted: false,
      activeDirection: null,
      resetTrail: false,
      rotationDegrees: null,
    },
  );
  assert.deepEqual(blade.snapshot(), acceptedSnapshot);
  assert.deepEqual(random.calls, []);
});

test('exact step equality remains moving at target, next strict overshoot enters settle, then settle returns idle', () => {
  const random = new ScriptedRandom([1, 4, 4, 4]);
  const blade = createBlade(random);
  blade.touch({ x: 857, y: 400 });

  const equality = blade.update(0.5);
  assert.equal(equality.stateBefore, 1);
  assert.equal(equality.stateAfter, 1);
  assert.equal(equality.overshot, false);
  assert.equal(equality.trailOperation, 'push-point');
  assert.deepEqual(equality.movementSegment, {
    previous: { x: 240, y: 400 },
    current: { x: 857, y: 400 },
  });
  assert.deepEqual(equality.snapshot.currentPosition, { x: 857, y: 400 });
  assert.equal(equality.snapshot.rayCached, false);
  assert.deepEqual(random.calls, [RAY_CALL, PARTICLE_GATE_CALL]);

  const overshoot = blade.update(0.5);
  assert.equal(overshoot.stateBefore, 1);
  assert.equal(overshoot.stateAfter, 2);
  assert.equal(overshoot.overshot, true);
  assert.deepEqual(overshoot.snapshot.currentPosition, { x: 857, y: 400 });
  assert.equal(overshoot.snapshot.rayCached, true);
  // Overshoot forces the cache before the conditional 0..3 draw.
  assert.deepEqual(random.calls, [
    RAY_CALL,
    PARTICLE_GATE_CALL,
    PARTICLE_GATE_CALL,
  ]);

  const settle = blade.update(0);
  assert.equal(settle.branch, 'settle');
  assert.equal(settle.stateBefore, 2);
  assert.equal(settle.stateAfter, 0);
  assert.equal(settle.trailOperation, 'reset-end');
  assert.deepEqual(random.calls, [
    RAY_CALL,
    PARTICLE_GATE_CALL,
    PARTICLE_GATE_CALL,
    PARTICLE_GATE_CALL,
  ]);
});

test('one cached ray extends while pending and explicit acknowledgment consumes it at most once', () => {
  const random = new ScriptedRandom([0, 4, 4, 1, 4]);
  const blade = createBlade(random);
  blade.touch({ x: 2000, y: 400 });

  const first = blade.update(0.1);
  assert.equal(first.snapshot.rayCached, true);
  const firstRay = blade.peekCachedRaySegment();
  assert.ok(firstRay);
  assert.deepEqual(firstRay.previous, { x: 240, y: 400 });
  assert.deepEqual(firstRay.current, first.snapshot.currentPosition);

  const second = blade.update(0.1);
  assert.equal(second.snapshot.rayCached, true);
  const extendedRay = blade.peekCachedRaySegment();
  assert.ok(extendedRay);
  assert.deepEqual(extendedRay.previous, { x: 240, y: 400 });
  assert.deepEqual(extendedRay.current, second.snapshot.currentPosition);
  assert.notDeepEqual(extendedRay.current, firstRay.current);
  assert.deepEqual(random.calls, [
    RAY_CALL,
    PARTICLE_GATE_CALL,
    PARTICLE_GATE_CALL,
  ]);

  assert.equal(blade.acknowledgeCachedRay(), true);
  assert.equal(blade.peekCachedRaySegment(), null);
  assert.equal(blade.acknowledgeCachedRay(), false);

  const third = blade.update(0.1);
  assert.equal(third.snapshot.rayCached, false);
  assert.deepEqual(random.calls, [
    RAY_CALL,
    PARTICLE_GATE_CALL,
    PARTICLE_GATE_CALL,
    RAY_CALL,
    PARTICLE_GATE_CALL,
  ]);
});

test('moving ray draw precedes particle gate, selection, x, and y on the shared stream', () => {
  const random = new ScriptedRandom([1, 0, 2, -61, -385]);
  const blade = createBlade(random);
  blade.touch({ x: 2000, y: 400 });

  const update = blade.update(0.1);

  assert.deepEqual(random.calls, [
    RAY_CALL,
    PARTICLE_GATE_CALL,
    { minimumInclusive: 0, maximumInclusive: 3 },
    { minimumInclusive: -61, maximumInclusive: 61 },
    { minimumInclusive: -385, maximumInclusive: -123 },
  ]);
  assert.equal(update.particleCommands.length, 1);
  assert.deepEqual(update.particleCommands[0], {
    type: 'spawn-bird-blade-particle',
    logicalPath: 'Blades/Particles/X-Mas/xmashexa.png',
    selection: 2,
    lifetimeSeconds: Math.fround(0.75),
    basePosition: {
      x: update.snapshot.currentPosition.x,
      y: 307.45001220703125,
    },
    randomOffset: { x: -61, y: -385 },
    rotationEnabled: true,
    scaleOutEnabled: true,
    fadeOutEnabled: true,
    attachmentZOrder: 1,
  });
});

test('idle intro updates still consume the particle gate and full RandomPositionData sequence', () => {
  const random = new ScriptedRandom([0, 3, -1, -192, 1, -123]);
  const blade = createBlade(random);

  const idle = blade.update(1 / 60);

  assert.equal(idle.branch, 'idle');
  assert.equal(idle.stateAfter, 0);
  assert.deepEqual(random.calls, [
    PARTICLE_GATE_CALL,
    { minimumInclusive: 0, maximumInclusive: 3 },
    { minimumInclusive: -1, maximumInclusive: 1 },
    { minimumInclusive: -192, maximumInclusive: -123 },
    { minimumInclusive: -1, maximumInclusive: 1 },
    { minimumInclusive: -192, maximumInclusive: -123 },
  ]);
  assert.deepEqual(idle.particleCommands[0], {
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

test('invalid ray draw leaves movement state unchanged and does not reach the particle gate', () => {
  for (const invalid of [-1, 1.5, 4]) {
    const random = new ScriptedRandom([invalid]);
    const blade = createBlade(random);
    blade.touch({ x: 2000, y: 400 });
    const before = blade.snapshot();

    assert.throws(
      () => blade.update(0.1),
      Number.isSafeInteger(invalid) ? RangeError : TypeError,
    );
    assert.deepEqual(blade.snapshot(), before);
    assert.deepEqual(random.calls, [RAY_CALL]);
  }
});

function createBlade(random: ScriptedRandom) {
  return new BirdBladeStateMachine({
    random,
    viewport: { height: 800, width: 480 },
  });
}
