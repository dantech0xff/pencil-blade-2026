import type { GameplayRandom } from './gameplay-random';
import type { ClassicCriticalParticleIndex } from './classic-resource-contract';

export const CLASSIC_CRITICAL_PARTICLE_SCALE_OUT_ACTION_SECONDS = Math.fround(1.5);

export type ClassicCriticalParticleRandom = Pick<GameplayRandom, 'nextIntInclusive'>;

export type ClassicCriticalParticleLogicalPath
  = `Criticles/criticle${ClassicCriticalParticleIndex}.png`;

export type ClassicCriticalParticleSpawnCommand = Readonly<{
  type: 'spawn-critical-particle';
  logicalPath: ClassicCriticalParticleLogicalPath;
  resourceIndex: ClassicCriticalParticleIndex;
  scaleOutActionSeconds: number;
}>;

const NO_COMMANDS: readonly ClassicCriticalParticleSpawnCommand[] = Object.freeze([]);

const LOGICAL_PATHS: Readonly<Record<
  ClassicCriticalParticleIndex,
  ClassicCriticalParticleLogicalPath
>> = Object.freeze({
  1: 'Criticles/criticle1.png',
  2: 'Criticles/criticle2.png',
  3: 'Criticles/criticle3.png',
  4: 'Criticles/criticle4.png',
});

/**
 * Plans the recovered particle side effect for one active CutFruit half update.
 *
 * Native evidence contains no effects-enabled gate here. A noncritical half consumes no draw;
 * a critical half always consumes the 0..3 gate. A successful gate then consumes the resource
 * selection followed by the unused -10..10 draw, whose shared-stream effect is preserved.
 */
export function createClassicCriticalParticleUpdateCommands(
  critical: boolean,
  random: ClassicCriticalParticleRandom,
): readonly ClassicCriticalParticleSpawnCommand[] {
  assertBoolean(critical, 'critical');
  assertRandom(random);

  if (!critical) {
    return NO_COMMANDS;
  }

  const gate = drawInclusive(random, 0, 3);
  if (gate !== 0) {
    return NO_COMMANDS;
  }

  const resourceIndex = drawInclusive(random, 1, 4) as ClassicCriticalParticleIndex;
  drawInclusive(random, -10, 10);

  return Object.freeze([
    Object.freeze({
      type: 'spawn-critical-particle',
      logicalPath: LOGICAL_PATHS[resourceIndex],
      resourceIndex,
      scaleOutActionSeconds: CLASSIC_CRITICAL_PARTICLE_SCALE_OUT_ACTION_SECONDS,
    }),
  ]);
}

function drawInclusive(
  random: ClassicCriticalParticleRandom,
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

function assertRandom(random: ClassicCriticalParticleRandom): void {
  if (
    random === null
    || typeof random !== 'object'
    || typeof random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive(minimum, maximum)');
  }
}

function assertBoolean(value: boolean, label: string): void {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be a boolean`);
  }
}
