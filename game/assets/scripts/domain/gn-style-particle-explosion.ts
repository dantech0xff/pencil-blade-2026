import type { GameplayRandom } from './gameplay-random';
import type {
  GnStyleParticleEmitterPlan,
  GnStyleParticlePoint,
} from './gn-style-particle-choreography';

const HUNDREDTHS_PER_SECOND = 100;
const COLOR_COMPONENT_MINIMUM = 0;
const COLOR_COMPONENT_MAXIMUM = 255;

export type GnStyleParticleExplosionRandom = Pick<GameplayRandom, 'nextIntInclusive'>;
export type GnStyleParticleExplosionSign = -1 | 0 | 1;

export interface GnStyleParticleColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

export interface GnStyleParticleChildPlan {
  readonly index: number;
  readonly durationHundredths: number;
  readonly durationSeconds: number;
  readonly horizontalSign: GnStyleParticleExplosionSign;
  readonly horizontalMagnitude: number;
  readonly verticalSign: GnStyleParticleExplosionSign;
  readonly verticalMagnitude: number;
  readonly deltaLocal: GnStyleParticlePoint;
  /** Color assignments in native application order. Empty means the default sprite color. */
  readonly colorApplications: readonly GnStyleParticleColor[];
  readonly finalColor: GnStyleParticleColor | null;
  readonly rotationEnabled: true;
  readonly scaleToZero: true;
  readonly fadeEnabled: false;
  readonly autoDelete: false;
  readonly movementActionSeconds: number;
  readonly scaleActionSeconds: number;
  readonly rotationActionSeconds: number;
}

export interface GnStyleParticleBurstPlan {
  readonly emitterOrdinal: number;
  readonly sharedFlagBColor: GnStyleParticleColor | null;
  readonly particles: readonly GnStyleParticleChildPlan[];
}

/**
 * Performs one recovered synchronous ParticleExplosion child loop.
 *
 * `flagB` consumes one shared RGB triplet before the loop, including for a zero-child emitter.
 * Every child then consumes duration, X sign, X magnitude, Y sign, and Y magnitude. `flagA`
 * adds a per-child RGB triplet; `flagB` applies its shared color afterward.
 */
export function createGnStyleParticleBurst(
  emitter: GnStyleParticleEmitterPlan,
  random: GnStyleParticleExplosionRandom,
): GnStyleParticleBurstPlan {
  assertEmitter(emitter);
  assertRandom(random);

  const sharedFlagBColor = emitter.flagB ? drawColor(random) : null;
  const particles: GnStyleParticleChildPlan[] = [];
  for (let index = 0; index < emitter.particleCount; index += 1) {
    const durationHundredths = drawInclusive(
      random,
      emitter.minimumDurationHundredths,
      emitter.maximumDurationHundredths,
    );
    const horizontalSign = normalizeSign(drawInclusive(random, -1, 1));
    const horizontalMagnitude = drawInclusive(
      random,
      emitter.minimumTravelMagnitude,
      emitter.maximumTravelMagnitude,
    );
    const verticalSign = normalizeSign(drawInclusive(random, -1, 1));
    const verticalMagnitude = drawInclusive(
      random,
      emitter.minimumTravelMagnitude,
      emitter.maximumTravelMagnitude,
    );
    const colorApplications: GnStyleParticleColor[] = [];
    if (emitter.flagA) {
      colorApplications.push(drawColor(random));
    }
    if (sharedFlagBColor !== null) {
      colorApplications.push(sharedFlagBColor);
    }

    const durationSeconds = Math.fround(
      durationHundredths / HUNDREDTHS_PER_SECOND,
    );
    particles.push(Object.freeze({
      index,
      durationHundredths,
      durationSeconds,
      horizontalSign,
      horizontalMagnitude,
      verticalSign,
      verticalMagnitude,
      deltaLocal: frozenPoint(
        horizontalSign * horizontalMagnitude,
        verticalSign * verticalMagnitude,
      ),
      colorApplications: Object.freeze(colorApplications),
      finalColor: colorApplications.length > 0
        ? colorApplications[colorApplications.length - 1]
        : null,
      rotationEnabled: true,
      scaleToZero: true,
      fadeEnabled: false,
      autoDelete: false,
      movementActionSeconds: durationSeconds,
      scaleActionSeconds: durationSeconds,
      rotationActionSeconds: durationSeconds,
    }));
  }

  return Object.freeze({
    emitterOrdinal: emitter.ordinal,
    sharedFlagBColor,
    particles: Object.freeze(particles),
  });
}

function drawColor(
  random: GnStyleParticleExplosionRandom,
): GnStyleParticleColor {
  return Object.freeze({
    red: drawInclusive(random, COLOR_COMPONENT_MINIMUM, COLOR_COMPONENT_MAXIMUM),
    green: drawInclusive(random, COLOR_COMPONENT_MINIMUM, COLOR_COMPONENT_MAXIMUM),
    blue: drawInclusive(random, COLOR_COMPONENT_MINIMUM, COLOR_COMPONENT_MAXIMUM),
  });
}

function drawInclusive(
  random: GnStyleParticleExplosionRandom,
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

function normalizeSign(value: number): GnStyleParticleExplosionSign {
  if (value === -1) {
    return -1;
  }
  if (value === 1) {
    return 1;
  }
  return 0;
}

function assertEmitter(emitter: GnStyleParticleEmitterPlan): void {
  if (emitter === null || typeof emitter !== 'object') {
    throw new TypeError('emitter must be an object');
  }
  assertNonNegativeSafeInteger(
    emitter.minimumTravelMagnitude,
    'emitter.minimumTravelMagnitude',
  );
  assertNonNegativeSafeInteger(
    emitter.maximumTravelMagnitude,
    'emitter.maximumTravelMagnitude',
  );
  assertNonNegativeSafeInteger(
    emitter.minimumDurationHundredths,
    'emitter.minimumDurationHundredths',
  );
  assertNonNegativeSafeInteger(
    emitter.maximumDurationHundredths,
    'emitter.maximumDurationHundredths',
  );
  assertNonNegativeSafeInteger(emitter.particleCount, 'emitter.particleCount');
  if (emitter.minimumTravelMagnitude > emitter.maximumTravelMagnitude) {
    throw new RangeError('emitter travel bounds must be ordered');
  }
  if (emitter.minimumDurationHundredths > emitter.maximumDurationHundredths) {
    throw new RangeError('emitter duration bounds must be ordered');
  }
  if (typeof emitter.flagA !== 'boolean' || typeof emitter.flagB !== 'boolean') {
    throw new TypeError('emitter flags must be booleans');
  }
  if (!Number.isSafeInteger(emitter.ordinal) || emitter.ordinal <= 0) {
    throw new RangeError('emitter.ordinal must be a positive safe integer');
  }
}

function assertRandom(random: GnStyleParticleExplosionRandom): void {
  if (
    random === null
    || typeof random !== 'object'
    || typeof random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive(minimum, maximum)');
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer`);
  }
  if (value < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
}

function frozenPoint(x: number, y: number): GnStyleParticlePoint {
  return Object.freeze({ x, y });
}
