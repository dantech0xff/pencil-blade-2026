import type { GameplayRandom } from './gameplay-random';

export const CLASSIC_RESULT_PARTICLE_EXPLOSION_TEXTURE_LOGICAL_PATH
  = 'Interfaces/object-bonus-particle.png' as const;
export const CLASSIC_RESULT_PARTICLE_EXPLOSION_DELAY_SECONDS = 1.65;
export const CLASSIC_RESULT_PARTICLE_EXPLOSION_CLEANUP_DELAY_SECONDS = 9.5;
export const CLASSIC_RESULT_PARTICLE_EXPLOSION_REMOVE_AT_SECONDS
  = CLASSIC_RESULT_PARTICLE_EXPLOSION_DELAY_SECONDS
    + CLASSIC_RESULT_PARTICLE_EXPLOSION_CLEANUP_DELAY_SECONDS;
export const CLASSIC_RESULT_PARTICLE_EXPLOSION_PARTICLE_COUNT = 100 as const;
export const CLASSIC_RESULT_PARTICLE_EXPLOSION_DURATION_MINIMUM_HUNDREDTHS = 265;
export const CLASSIC_RESULT_PARTICLE_EXPLOSION_DURATION_MAXIMUM_HUNDREDTHS = 475;
export const CLASSIC_RESULT_PARTICLE_EXPLOSION_Z_ORDER = 1 as const;

const MINIMUM_TRAVEL_FACTOR = 0.25;
const MAXIMUM_TRAVEL_FACTOR = 0.75;
const EMITTER_X_FACTOR = 0.75;
const EMITTER_Y_FACTOR = 0.2;
const HUNDREDTHS_PER_SECOND = 100;

export type ClassicResultParticleExplosionRandom = Pick<
  GameplayRandom,
  'nextIntInclusive'
>;

export interface ClassicResultParticleExplosionViewport {
  readonly height: number;
  readonly width: number;
}

export interface ClassicResultParticleExplosionPoint {
  readonly x: number;
  readonly y: number;
}

export interface ClassicResultParticleExplosionPlan {
  readonly autoDeleteParticles: false;
  /** Recovered constructor flags. Their native semantic names are not available. */
  readonly colorFlags: readonly [false, false];
  readonly cleanupDelaySeconds: number;
  readonly emitterWorldPosition: ClassicResultParticleExplosionPoint;
  readonly maximumTravelMagnitude: number;
  readonly minimumTravelMagnitude: number;
  readonly particleCount: 100;
  readonly removeAtSeconds: number;
  readonly startDelaySeconds: number;
  readonly textureLogicalPath: typeof CLASSIC_RESULT_PARTICLE_EXPLOSION_TEXTURE_LOGICAL_PATH;
  readonly zOrder: 1;
}

export type ClassicResultParticleExplosionSign = -1 | 0 | 1;

export interface ClassicResultParticlePlan {
  readonly deltaLocal: ClassicResultParticleExplosionPoint;
  readonly durationHundredths: number;
  readonly durationSeconds: number;
  readonly horizontalMagnitude: number;
  readonly horizontalSign: ClassicResultParticleExplosionSign;
  readonly index: number;
  readonly verticalMagnitude: number;
  readonly verticalSign: ClassicResultParticleExplosionSign;
}

/**
 * Recovered result-emitter configuration, independent of Creator and of the random stream.
 *
 * The native constructor truncates both width-derived travel bounds toward zero. The texture's
 * center anchor, white color, full opacity, and ordinary sprite blend are inferred engine
 * defaults; the Creator presenter documents and applies only those defaults, with no fade.
 */
export function createClassicResultParticleExplosionPlan(
  viewport: ClassicResultParticleExplosionViewport,
): ClassicResultParticleExplosionPlan {
  assertViewport(viewport);

  const minimumTravelMagnitude = Math.trunc(viewport.width * MINIMUM_TRAVEL_FACTOR);
  const maximumTravelMagnitude = Math.trunc(viewport.width * MAXIMUM_TRAVEL_FACTOR);
  assertNonNegativeSafeInteger(minimumTravelMagnitude, 'minimumTravelMagnitude');
  assertNonNegativeSafeInteger(maximumTravelMagnitude, 'maximumTravelMagnitude');

  return Object.freeze({
    autoDeleteParticles: false,
    colorFlags: Object.freeze([false, false] as const),
    cleanupDelaySeconds: CLASSIC_RESULT_PARTICLE_EXPLOSION_CLEANUP_DELAY_SECONDS,
    emitterWorldPosition: frozenPoint(
      viewport.width * EMITTER_X_FACTOR,
      viewport.height * EMITTER_Y_FACTOR,
    ),
    maximumTravelMagnitude,
    minimumTravelMagnitude,
    particleCount: CLASSIC_RESULT_PARTICLE_EXPLOSION_PARTICLE_COUNT,
    removeAtSeconds: CLASSIC_RESULT_PARTICLE_EXPLOSION_REMOVE_AT_SECONDS,
    startDelaySeconds: CLASSIC_RESULT_PARTICLE_EXPLOSION_DELAY_SECONDS,
    textureLogicalPath: CLASSIC_RESULT_PARTICLE_EXPLOSION_TEXTURE_LOGICAL_PATH,
    zOrder: CLASSIC_RESULT_PARTICLE_EXPLOSION_Z_ORDER,
  });
}

/**
 * Performs the recovered synchronous burst loop.
 *
 * Call this only when the 1.65-second delay expires. Every particle consumes exactly five
 * inclusive integer draws in native order: duration, X sign, X magnitude, Y sign, Y magnitude.
 */
export function createClassicResultParticleBurst(
  plan: ClassicResultParticleExplosionPlan,
  random: ClassicResultParticleExplosionRandom,
): readonly ClassicResultParticlePlan[] {
  assertPlan(plan);
  assertRandom(random);

  const particles: ClassicResultParticlePlan[] = [];
  for (let index = 0; index < plan.particleCount; index += 1) {
    const durationHundredths = drawInclusive(
      random,
      CLASSIC_RESULT_PARTICLE_EXPLOSION_DURATION_MINIMUM_HUNDREDTHS,
      CLASSIC_RESULT_PARTICLE_EXPLOSION_DURATION_MAXIMUM_HUNDREDTHS,
    );
    const horizontalSign = normalizeSign(drawInclusive(random, -1, 1));
    const horizontalMagnitude = drawInclusive(
      random,
      plan.minimumTravelMagnitude,
      plan.maximumTravelMagnitude,
    );
    const verticalSign = normalizeSign(drawInclusive(random, -1, 1));
    const verticalMagnitude = drawInclusive(
      random,
      plan.minimumTravelMagnitude,
      plan.maximumTravelMagnitude,
    );

    particles.push(Object.freeze({
      deltaLocal: frozenPoint(
        horizontalSign * horizontalMagnitude,
        verticalSign * verticalMagnitude,
      ),
      durationHundredths,
      durationSeconds: durationHundredths / HUNDREDTHS_PER_SECOND,
      horizontalMagnitude,
      horizontalSign,
      index,
      verticalMagnitude,
      verticalSign,
    }));
  }

  return Object.freeze(particles);
}

function assertPlan(plan: ClassicResultParticleExplosionPlan): void {
  if (plan === null || typeof plan !== 'object') {
    throw new TypeError('plan must be an object');
  }
  if (plan.textureLogicalPath !== CLASSIC_RESULT_PARTICLE_EXPLOSION_TEXTURE_LOGICAL_PATH) {
    throw new RangeError('plan must use the exact recovered result-particle texture');
  }
  if (plan.startDelaySeconds !== CLASSIC_RESULT_PARTICLE_EXPLOSION_DELAY_SECONDS) {
    throw new RangeError('plan must use the recovered result-particle start delay');
  }
  if (plan.cleanupDelaySeconds !== CLASSIC_RESULT_PARTICLE_EXPLOSION_CLEANUP_DELAY_SECONDS) {
    throw new RangeError('plan must use the recovered result-particle cleanup delay');
  }
  if (plan.removeAtSeconds !== CLASSIC_RESULT_PARTICLE_EXPLOSION_REMOVE_AT_SECONDS) {
    throw new RangeError('plan must use the recovered result-particle removal time');
  }
  if (plan.particleCount !== CLASSIC_RESULT_PARTICLE_EXPLOSION_PARTICLE_COUNT) {
    throw new RangeError('plan must contain exactly 100 result particles');
  }
  if (plan.zOrder !== CLASSIC_RESULT_PARTICLE_EXPLOSION_Z_ORDER) {
    throw new RangeError('plan must use recovered result z-order 1');
  }
  if (plan.autoDeleteParticles !== false) {
    throw new RangeError('plan must keep completed result particles until container cleanup');
  }
  if (
    !Array.isArray(plan.colorFlags)
    || plan.colorFlags.length !== 2
    || plan.colorFlags[0] !== false
    || plan.colorFlags[1] !== false
  ) {
    throw new RangeError('plan must preserve both recovered false color flags');
  }
  assertPoint(plan.emitterWorldPosition, 'plan.emitterWorldPosition');
  assertNonNegativeSafeInteger(
    plan.minimumTravelMagnitude,
    'plan.minimumTravelMagnitude',
  );
  assertNonNegativeSafeInteger(
    plan.maximumTravelMagnitude,
    'plan.maximumTravelMagnitude',
  );
  if (plan.minimumTravelMagnitude > plan.maximumTravelMagnitude) {
    throw new RangeError('plan travel bounds must be ordered');
  }
}

function drawInclusive(
  random: ClassicResultParticleExplosionRandom,
  minimumInclusive: number,
  maximumInclusive: number,
): number {
  const value = random.nextIntInclusive(minimumInclusive, maximumInclusive);
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(
      `nextIntInclusive(${minimumInclusive}, ${maximumInclusive}) must return a safe integer`,
    );
  }
  if (value < minimumInclusive || value > maximumInclusive) {
    throw new RangeError(
      `nextIntInclusive(${minimumInclusive}, ${maximumInclusive}) returned ${value} outside the inclusive range`,
    );
  }
  return value;
}

function normalizeSign(value: number): ClassicResultParticleExplosionSign {
  if (value === -1) {
    return -1;
  }
  if (value === 1) {
    return 1;
  }
  return 0;
}

function assertRandom(random: ClassicResultParticleExplosionRandom): void {
  if (
    random === null
    || typeof random !== 'object'
    || typeof random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive(minimum, maximum)');
  }
}

function assertViewport(viewport: ClassicResultParticleExplosionViewport): void {
  if (viewport === null || typeof viewport !== 'object') {
    throw new TypeError('viewport must be an object');
  }
  assertPositiveFinite(viewport.width, 'viewport.width');
  assertPositiveFinite(viewport.height, 'viewport.height');
}

function assertPoint(point: ClassicResultParticleExplosionPoint, label: string): void {
  if (point === null || typeof point !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
  assertFinite(point.x, `${label}.x`);
  assertFinite(point.y, `${label}.y`);
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer`);
  }
  if (value < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
}

function assertPositiveFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}

function frozenPoint(x: number, y: number): ClassicResultParticleExplosionPoint {
  return Object.freeze({ x, y });
}
