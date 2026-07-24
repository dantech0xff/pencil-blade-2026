import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createGnStyleParticleEmitterPlans,
  type GnStyleParticleEmitterPlan,
} from '../../../game/assets/scripts/domain/gn-style-particle-choreography.ts';
import {
  createGnStyleParticleBurst,
} from '../../../game/assets/scripts/domain/gn-style-particle-explosion.ts';

interface InclusiveCall {
  readonly minimumInclusive: number;
  readonly maximumInclusive: number;
}

class ScriptedRandom {
  readonly calls: InclusiveCall[] = [];
  private readonly values: readonly number[];
  private offset = 0;

  constructor(values: readonly number[]) {
    this.values = values;
  }

  nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number {
    this.calls.push(Object.freeze({ minimumInclusive, maximumInclusive }));
    const value = this.values[this.offset];
    if (value === undefined) {
      throw new Error(`scripted random exhausted at draw ${this.offset}`);
    }
    this.offset += 1;
    return value;
  }

  get consumedDrawCount(): number {
    return this.offset;
  }
}

const BASE = createGnStyleParticleEmitterPlans({ width: 480, height: 800 })[0];
const COLOR_CALL = Object.freeze({ minimumInclusive: 0, maximumInclusive: 255 });
const DURATION_CALL = Object.freeze({ minimumInclusive: 50, maximumInclusive: 150 });
const SIGN_CALL = Object.freeze({ minimumInclusive: -1, maximumInclusive: 1 });
const MAGNITUDE_CALL = Object.freeze({ minimumInclusive: 50, maximumInclusive: 300 });

test('unflagged child consumes five draws and uses duration for every recovered action', () => {
  const random = new ScriptedRandom([50, -1, 50, 0, 300]);
  const burst = createGnStyleParticleBurst(emitter({ particleCount: 1 }), random);

  assert.equal(random.consumedDrawCount, 5);
  assert.deepEqual(random.calls, [
    DURATION_CALL,
    SIGN_CALL,
    MAGNITUDE_CALL,
    SIGN_CALL,
    MAGNITUDE_CALL,
  ]);
  assert.equal(Object.isFrozen(burst), true);
  assert.equal(Object.isFrozen(burst.particles), true);
  assert.deepEqual(burst.particles[0], {
    index: 0,
    durationHundredths: 50,
    durationSeconds: Math.fround(0.5),
    horizontalSign: -1,
    horizontalMagnitude: 50,
    verticalSign: 0,
    verticalMagnitude: 300,
    deltaLocal: { x: -50, y: 0 },
    colorApplications: [],
    finalColor: null,
    rotationEnabled: true,
    scaleToZero: true,
    fadeEnabled: false,
    autoDelete: false,
    movementActionSeconds: Math.fround(0.5),
    scaleActionSeconds: Math.fround(0.5),
    rotationActionSeconds: Math.fround(0.5),
  });
  assert.equal(Object.is(burst.particles[0].deltaLocal.y, -0), false);
});

test('flagA samples a fresh RGB triplet after the five movement draws for each child', () => {
  const random = new ScriptedRandom([
    50, -1, 50, 0, 300, 1, 2, 3,
    150, 1, 300, -1, 50, 4, 5, 6,
  ]);
  const burst = createGnStyleParticleBurst(
    emitter({ particleCount: 2, flagA: true }),
    random,
  );

  assert.equal(random.consumedDrawCount, 16);
  assert.deepEqual(random.calls.slice(0, 8), [
    DURATION_CALL,
    SIGN_CALL,
    MAGNITUDE_CALL,
    SIGN_CALL,
    MAGNITUDE_CALL,
    COLOR_CALL,
    COLOR_CALL,
    COLOR_CALL,
  ]);
  assert.deepEqual(burst.particles.map((particle) => particle.finalColor), [
    { red: 1, green: 2, blue: 3 },
    { red: 4, green: 5, blue: 6 },
  ]);
  assert.equal(burst.particles[0].finalColor === burst.particles[1].finalColor, false);
});

test('flagB samples one shared RGB before the loop and applies it after child draws', () => {
  const random = new ScriptedRandom([
    7, 8, 9,
    50, -1, 50, 0, 300,
    150, 1, 300, -1, 50,
  ]);
  const burst = createGnStyleParticleBurst(
    emitter({ particleCount: 2, flagB: true }),
    random,
  );

  assert.equal(random.consumedDrawCount, 13);
  assert.deepEqual(random.calls.slice(0, 3), [COLOR_CALL, COLOR_CALL, COLOR_CALL]);
  assert.deepEqual(random.calls.slice(3, 8), [
    DURATION_CALL,
    SIGN_CALL,
    MAGNITUDE_CALL,
    SIGN_CALL,
    MAGNITUDE_CALL,
  ]);
  assert.deepEqual(burst.sharedFlagBColor, { red: 7, green: 8, blue: 9 });
  assert.equal(burst.particles[0].finalColor, burst.sharedFlagBColor);
  assert.equal(burst.particles[1].finalColor, burst.sharedFlagBColor);
  assert.deepEqual(burst.particles[0].colorApplications, [burst.sharedFlagBColor]);
});

test('raw two-flag branch retains both draw effects and shared color overwrites per-child color', () => {
  const random = new ScriptedRandom([
    10, 20, 30,
    50, 0, 50, 1, 300,
    40, 50, 60,
  ]);
  const burst = createGnStyleParticleBurst(
    emitter({ particleCount: 1, flagA: true, flagB: true }),
    random,
  );

  assert.equal(random.consumedDrawCount, 11);
  assert.deepEqual(burst.particles[0].colorApplications, [
    { red: 40, green: 50, blue: 60 },
    { red: 10, green: 20, blue: 30 },
  ]);
  assert.equal(burst.particles[0].finalColor, burst.sharedFlagBColor);
});

test('zero-child flagB emitter still consumes its recovered pre-loop shared color draws', () => {
  const flagBRandom = new ScriptedRandom([1, 2, 3]);
  const flagBBurst = createGnStyleParticleBurst(
    emitter({ particleCount: 0, flagB: true }),
    flagBRandom,
  );
  assert.equal(flagBRandom.consumedDrawCount, 3);
  assert.deepEqual(flagBBurst.sharedFlagBColor, { red: 1, green: 2, blue: 3 });
  assert.deepEqual(flagBBurst.particles, []);

  const flagARandom = new ScriptedRandom([]);
  const flagABurst = createGnStyleParticleBurst(
    emitter({ particleCount: 0, flagA: true }),
    flagARandom,
  );
  assert.equal(flagARandom.consumedDrawCount, 0);
  assert.equal(flagABurst.sharedFlagBColor, null);
});

test('random results and tampered emitter bounds fail at their own boundary', () => {
  const invalidDuration = new ScriptedRandom([49]);
  assert.throws(
    () => createGnStyleParticleBurst(emitter({ particleCount: 1 }), invalidDuration),
    RangeError,
  );
  assert.equal(invalidDuration.consumedDrawCount, 1);
  assert.deepEqual(invalidDuration.calls, [DURATION_CALL]);

  const invalidSign = new ScriptedRandom([50, 2]);
  assert.throws(
    () => createGnStyleParticleBurst(emitter({ particleCount: 1 }), invalidSign),
    RangeError,
  );
  assert.equal(invalidSign.consumedDrawCount, 2);

  const invalidColor = new ScriptedRandom([256]);
  assert.throws(
    () => createGnStyleParticleBurst(
      emitter({ particleCount: 0, flagB: true }),
      invalidColor,
    ),
    RangeError,
  );
  assert.equal(invalidColor.consumedDrawCount, 1);

  assert.throws(
    () => createGnStyleParticleBurst(
      emitter({ minimumTravelMagnitude: 301 }),
      new ScriptedRandom([]),
    ),
    /travel bounds/,
  );
  assert.throws(
    () => createGnStyleParticleBurst(BASE, null as never),
    /random must provide/,
  );
});

function emitter(
  overrides: Partial<GnStyleParticleEmitterPlan>,
): GnStyleParticleEmitterPlan {
  return Object.freeze({
    ...BASE,
    flagA: false,
    flagB: false,
    ...overrides,
  });
}
