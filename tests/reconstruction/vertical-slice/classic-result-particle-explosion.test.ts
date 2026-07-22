import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLASSIC_RESULT_PARTICLE_EXPLOSION_CLEANUP_DELAY_SECONDS,
  CLASSIC_RESULT_PARTICLE_EXPLOSION_DELAY_SECONDS,
  CLASSIC_RESULT_PARTICLE_EXPLOSION_DURATION_MAXIMUM_HUNDREDTHS,
  CLASSIC_RESULT_PARTICLE_EXPLOSION_DURATION_MINIMUM_HUNDREDTHS,
  CLASSIC_RESULT_PARTICLE_EXPLOSION_PARTICLE_COUNT,
  CLASSIC_RESULT_PARTICLE_EXPLOSION_REMOVE_AT_SECONDS,
  CLASSIC_RESULT_PARTICLE_EXPLOSION_TEXTURE_LOGICAL_PATH,
  CLASSIC_RESULT_PARTICLE_EXPLOSION_Z_ORDER,
  createClassicResultParticleBurst,
  createClassicResultParticleExplosionPlan,
} from '../../../game/assets/scripts/domain/classic-result-particle-explosion.ts';
import { ModuloGameplayRandom } from '../../../game/assets/scripts/domain/gameplay-random.ts';

interface InclusiveCall {
  readonly maximumInclusive: number;
  readonly minimumInclusive: number;
}

class ScriptedRandom {
  readonly calls: InclusiveCall[] = [];
  private readonly draws: readonly number[];
  private offset = 0;

  constructor(draws: readonly number[]) {
    this.draws = draws;
  }

  nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number {
    this.calls.push(Object.freeze({ maximumInclusive, minimumInclusive }));
    const draw = this.draws[this.offset];
    if (draw === undefined) {
      throw new Error(`scripted random exhausted at draw ${this.offset}`);
    }
    this.offset += 1;
    return draw;
  }

  get consumedDrawCount(): number {
    return this.offset;
  }
}

const DURATION_CALL = Object.freeze({
  maximumInclusive: 475,
  minimumInclusive: 265,
});
const SIGN_CALL = Object.freeze({ maximumInclusive: 1, minimumInclusive: -1 });
const LOW_MAGNITUDE_CALL = Object.freeze({
  maximumInclusive: 360,
  minimumInclusive: 120,
});

test('constructor plan recovers truncating bounds, emitter layout, flags, and full timeline', () => {
  const low = createClassicResultParticleExplosionPlan({ width: 480, height: 800 });

  assert.deepEqual(low, {
    autoDeleteParticles: false,
    colorFlags: [false, false],
    cleanupDelaySeconds: 9.5,
    emitterWorldPosition: { x: 360, y: 160 },
    maximumTravelMagnitude: 360,
    minimumTravelMagnitude: 120,
    particleCount: 100,
    removeAtSeconds: 11.15,
    startDelaySeconds: 1.65,
    textureLogicalPath: 'Interfaces/object-bonus-particle.png',
    zOrder: 1,
  });
  assert.equal(Object.isFrozen(low), true);
  assert.equal(Object.isFrozen(low.colorFlags), true);
  assert.equal(Object.isFrozen(low.emitterWorldPosition), true);

  const fractional = createClassicResultParticleExplosionPlan({
    width: 481.9,
    height: 803,
  });
  assert.equal(fractional.minimumTravelMagnitude, 120);
  assert.equal(fractional.maximumTravelMagnitude, 361);
  assert.deepEqual(fractional.emitterWorldPosition, {
    x: 361.42499999999995,
    y: 160.60000000000002,
  });

  assert.equal(CLASSIC_RESULT_PARTICLE_EXPLOSION_TEXTURE_LOGICAL_PATH, low.textureLogicalPath);
  assert.equal(CLASSIC_RESULT_PARTICLE_EXPLOSION_DELAY_SECONDS, 1.65);
  assert.equal(CLASSIC_RESULT_PARTICLE_EXPLOSION_CLEANUP_DELAY_SECONDS, 9.5);
  assert.equal(CLASSIC_RESULT_PARTICLE_EXPLOSION_REMOVE_AT_SECONDS, 11.15);
  assert.equal(CLASSIC_RESULT_PARTICLE_EXPLOSION_PARTICLE_COUNT, 100);
  assert.equal(CLASSIC_RESULT_PARTICLE_EXPLOSION_Z_ORDER, 1);
  assert.equal(CLASSIC_RESULT_PARTICLE_EXPLOSION_DURATION_MINIMUM_HUNDREDTHS, 265);
  assert.equal(CLASSIC_RESULT_PARTICLE_EXPLOSION_DURATION_MAXIMUM_HUNDREDTHS, 475);
});

test('plan construction consumes no random value and burst consumes exactly 500 through GameplayRandom', () => {
  let rawDrawCount = 0;
  const random = new ModuloGameplayRandom({
    nextRawNonNegativeInt: () => {
      rawDrawCount += 1;
      return rawDrawCount - 1;
    },
  });

  const plan = createClassicResultParticleExplosionPlan({ width: 720, height: 1280 });
  assert.equal(rawDrawCount, 0);

  const particles = createClassicResultParticleBurst(plan, random);
  assert.equal(particles.length, 100);
  assert.equal(rawDrawCount, 500);
  assert.equal(Object.isFrozen(particles), true);
  assert.equal(particles.every((particle) => Object.isFrozen(particle)), true);
  assert.equal(particles.every((particle) => Object.isFrozen(particle.deltaLocal)), true);
});

test('burst preserves five-draw order, inclusive endpoints, zero signs, and index order', () => {
  const draws: number[] = [];
  for (let index = 0; index < 100; index += 1) {
    if (index === 0) {
      draws.push(265, -1, 120, 0, 360);
    } else if (index === 1) {
      draws.push(475, 1, 360, -1, 120);
    } else {
      draws.push(300, 0, 240, 1, 300);
    }
  }
  const random = new ScriptedRandom(draws);
  const plan = createClassicResultParticleExplosionPlan({ width: 480, height: 800 });

  const particles = createClassicResultParticleBurst(plan, random);

  assert.equal(random.consumedDrawCount, 500);
  assert.equal(random.calls.length, 500);
  for (let index = 0; index < 100; index += 1) {
    assert.deepEqual(random.calls.slice(index * 5, index * 5 + 5), [
      DURATION_CALL,
      SIGN_CALL,
      LOW_MAGNITUDE_CALL,
      SIGN_CALL,
      LOW_MAGNITUDE_CALL,
    ]);
  }
  assert.deepEqual(particles[0], {
    deltaLocal: { x: -120, y: 0 },
    durationHundredths: 265,
    durationSeconds: 2.65,
    horizontalMagnitude: 120,
    horizontalSign: -1,
    index: 0,
    verticalMagnitude: 360,
    verticalSign: 0,
  });
  assert.deepEqual(particles[1], {
    deltaLocal: { x: 360, y: -120 },
    durationHundredths: 475,
    durationSeconds: 4.75,
    horizontalMagnitude: 360,
    horizontalSign: 1,
    index: 1,
    verticalMagnitude: 120,
    verticalSign: -1,
  });
  assert.equal(Object.is(particles[0].deltaLocal.y, -0), false);
  assert.deepEqual(particles.slice(2).map(({ index }) => index), [
    ...Array.from({ length: 98 }, (_, offset) => offset + 2),
  ]);
  assert.equal(particles.slice(2).every(({ deltaLocal }) => deltaLocal.x === 0), true);
  assert.equal(particles.slice(2).every(({ deltaLocal }) => deltaLocal.y === 300), true);
});

test('every random result fails at its own boundary without consuming a later draw', () => {
  assertInvalidDraw([264], RangeError, [DURATION_CALL]);
  assertInvalidDraw([476], RangeError, [DURATION_CALL]);
  assertInvalidDraw([265.5], TypeError, [DURATION_CALL]);

  assertInvalidDraw([265, -2], RangeError, [DURATION_CALL, SIGN_CALL]);
  assertInvalidDraw([265, 2], RangeError, [DURATION_CALL, SIGN_CALL]);
  assertInvalidDraw([265, 0, 119], RangeError, [
    DURATION_CALL,
    SIGN_CALL,
    LOW_MAGNITUDE_CALL,
  ]);
  assertInvalidDraw([265, 0, 120, Number.NaN], TypeError, [
    DURATION_CALL,
    SIGN_CALL,
    LOW_MAGNITUDE_CALL,
    SIGN_CALL,
  ]);
  assertInvalidDraw([265, 0, 120, 0, 361], RangeError, [
    DURATION_CALL,
    SIGN_CALL,
    LOW_MAGNITUDE_CALL,
    SIGN_CALL,
    LOW_MAGNITUDE_CALL,
  ]);
});

test('viewport, random, and tampered plans reject fail-closed', () => {
  for (const viewport of [
    null,
    { width: 0, height: 800 },
    { width: 480, height: -1 },
    { width: Number.NaN, height: 800 },
    { width: Number.MAX_VALUE, height: 800 },
  ]) {
    assert.throws(
      () => createClassicResultParticleExplosionPlan(viewport as never),
      /viewport|positive|finite|safe integer/,
    );
  }

  const plan = createClassicResultParticleExplosionPlan({ width: 480, height: 800 });
  assert.throws(
    () => createClassicResultParticleBurst(plan, null as never),
    /random must provide/,
  );
  const noDraw = new ScriptedRandom([265]);
  assert.throws(
    () => createClassicResultParticleBurst({
      ...plan,
      textureLogicalPath: 'Interfaces/wrong.png',
    } as never, noDraw),
    /exact recovered result-particle texture/,
  );
  assert.equal(noDraw.consumedDrawCount, 0);
});

function assertInvalidDraw(
  draws: readonly number[],
  ErrorType: typeof TypeError | typeof RangeError,
  expectedCalls: readonly InclusiveCall[],
): void {
  const random = new ScriptedRandom(draws);
  const plan = createClassicResultParticleExplosionPlan({ width: 480, height: 800 });
  assert.throws(() => createClassicResultParticleBurst(plan, random), ErrorType);
  assert.deepEqual(random.calls, expectedCalls);
  assert.equal(random.consumedDrawCount, draws.length);
}
