import type { GameplayRandom } from './gameplay-random';
import {
  assertStandardBladeId,
  type StandardBladeParticleLogicalPath,
  type StandardParticleBladeId,
} from './standard-blade-resource-contract';

export const STANDARD_BLADE_PARTICLE_Z_ORDER = 1 as const;

export type StandardBladeParticleRandom = Pick<
  GameplayRandom,
  'nextDecile' | 'nextIntInclusive'
>;

export interface StandardBladeParticlePoint {
  readonly x: number;
  readonly y: number;
}

export interface StandardBladeParticleSpawnCommand {
  readonly attachmentZOrder: 1;
  readonly basePosition: StandardBladeParticlePoint;
  readonly delta: StandardBladeParticlePoint;
  readonly fadeOutEnabled: boolean;
  readonly initialRotationDegrees: number;
  readonly lifetimeSeconds: number;
  readonly logicalPath: StandardBladeParticleLogicalPath;
  readonly rotationEnabled: boolean;
  readonly scaleOutEnabled: boolean;
  readonly sourceBladeId: StandardParticleBladeId;
  readonly type: 'spawn-standard-blade-particle';
}

export type StandardBladeParticleCommandSink = (
  command: StandardBladeParticleSpawnCommand,
) => void;

const NO_COMMANDS: readonly StandardBladeParticleSpawnCommand[] = Object.freeze([]);

/**
 * Plans the recovered move-time cosmetic particles for standard blade IDs 7 through 12.
 * The caller must invoke this once for every accepted visual move, after the trail update.
 */
export function createStandardBladeParticleSpawnCommands(
  bladeId: number,
  currentPosition: StandardBladeParticlePoint,
  viewportWidth: number,
  random: StandardBladeParticleRandom,
  commandSink?: StandardBladeParticleCommandSink,
): readonly StandardBladeParticleSpawnCommand[] {
  assertStandardBladeId(bladeId);
  const current = copyPoint(currentPosition, 'currentPosition');
  const width = positiveFloat32(viewportWidth, 'viewportWidth');
  assertRandom(random);
  assertCommandSink(commandSink);
  if (bladeId < 7 || bladeId > 12) {
    return NO_COMMANDS;
  }

  switch (bladeId as StandardParticleBladeId) {
    case 7:
      return gate(random, 5)
        ? emitCommands([createSignedParticle({
            basePosition: current,
            bladeId: 7,
            fadeOutEnabled: true,
            lifetimeSeconds: hundredths(draw(random, 50, 75)),
            logicalPath: 'Blades/Particles/VN Flag/vnflagstar.png',
            maximumScale: 0.35,
            minimumScale: 0.1,
            random,
            rotationEnabled: true,
            scaleOutEnabled: true,
            viewportWidth: width,
          })], commandSink)
        : NO_COMMANDS;
    case 8:
      return gate(random, 5)
        ? emitCommands([createSelectedSignedParticle(
            8,
            current,
            width,
            draw(random, 0, 2),
            random,
            [
              particleDefinition(
                'Blades/Particles/Ice/snowflake.png',
                1,
                0.2,
                0.415,
              ),
              particleDefinition(
                'Blades/Particles/Ice/star.png',
                0.75,
                0.156,
                0.3125,
              ),
              particleDefinition(
                'Blades/Particles/Ice/circle.png',
                0.5,
                0.1,
                0.25,
              ),
            ],
          )], commandSink)
        : NO_COMMANDS;
    case 9:
      return gate(random, 5)
        ? emitCommands([createSelectedSignedParticle(
            9,
            current,
            width,
            draw(random, 0, 3),
            random,
            [
              particleDefinition(
                'Blades/Particles/X-Mas/xmasfive.png',
                1,
                0.2,
                0.415,
              ),
              particleDefinition(
                'Blades/Particles/X-Mas/xmasfour.png',
                0.75,
                0.156,
                0.3125,
              ),
              particleDefinition(
                'Blades/Particles/X-Mas/xmashexa.png',
                0.5,
                0.1,
                0.25,
              ),
              particleDefinition(
                'Blades/Particles/X-Mas/xmascircle.png',
                0.5,
                0.05,
                0.156,
              ),
            ],
          )], commandSink)
        : NO_COMMANDS;
    case 10:
      if (!gate(random, 5)) {
        return NO_COMMANDS;
      }
      {
        const selection = draw(random, 0, 5);
        const command = createSignedParticle({
          basePosition: current,
          bladeId: 10,
          fadeOutEnabled: true,
          lifetimeSeconds: hundredths(draw(random, 50, 75)),
          logicalPath: (
            `Blades/Particles/Butterfly/butterfly${selection}.png`
          ) as StandardBladeParticleLogicalPath,
          maximumScale: 0.4156,
          minimumScale: 0.1,
          random,
          rotationEnabled: true,
          scaleOutEnabled: true,
          viewportWidth: width,
        });
        return emitCommands([
          withInitialRotation(
            command,
            recoveredVectorAngleDegrees(command.basePosition, command.delta),
          ),
        ], commandSink);
      }
    case 11:
      return createFireCommands(current, width, random, commandSink);
    case 12:
      if (!gate(random, 6)) {
        return NO_COMMANDS;
      }
      {
        const selection = draw(random, 0, 4);
        const command = createSignedParticle({
          basePosition: current,
          bladeId: 12,
          fadeOutEnabled: true,
          lifetimeSeconds: hundredths(draw(random, 50, 150)),
          logicalPath: (
            `Blades/Particles/Rainbow/rainbowstar${selection}.png`
          ) as StandardBladeParticleLogicalPath,
          maximumScale: 0.2,
          minimumScale: 0.1,
          random,
          rotationEnabled: true,
          scaleOutEnabled: true,
          viewportWidth: width,
        });
        return emitCommands([
          withInitialRotation(
            command,
            recoveredVectorAngleDegrees(command.basePosition, command.delta),
          ),
        ], commandSink);
      }
  }
}

interface SignedParticleInput {
  readonly basePosition: StandardBladeParticlePoint;
  readonly bladeId: StandardParticleBladeId;
  readonly fadeOutEnabled: boolean;
  readonly lifetimeSeconds: number;
  readonly logicalPath: StandardBladeParticleLogicalPath;
  readonly maximumScale: number;
  readonly minimumScale: number;
  readonly random: StandardBladeParticleRandom;
  readonly rotationEnabled: boolean;
  readonly scaleOutEnabled: boolean;
  readonly viewportWidth: number;
}

interface ParticleDefinition {
  readonly lifetimeSeconds: number;
  readonly logicalPath: StandardBladeParticleLogicalPath;
  readonly maximumScale: number;
  readonly minimumScale: number;
}

function createSelectedSignedParticle(
  bladeId: 8 | 9,
  basePosition: StandardBladeParticlePoint,
  viewportWidth: number,
  selection: number,
  random: StandardBladeParticleRandom,
  definitions: readonly ParticleDefinition[],
): StandardBladeParticleSpawnCommand {
  const definition = definitions[selection];
  if (definition === undefined) {
    throw new Error(`Standard blade ${bladeId} particle selection ${selection} is unavailable`);
  }
  return createSignedParticle({
    basePosition,
    bladeId,
    fadeOutEnabled: true,
    lifetimeSeconds: definition.lifetimeSeconds,
    logicalPath: definition.logicalPath,
    maximumScale: definition.maximumScale,
    minimumScale: definition.minimumScale,
    random,
    rotationEnabled: true,
    scaleOutEnabled: true,
    viewportWidth,
  });
}

function createSignedParticle(
  input: SignedParticleInput,
): StandardBladeParticleSpawnCommand {
  const minimum = scaledIntegerFloat32(
    input.viewportWidth,
    input.minimumScale,
  );
  const maximum = scaledIntegerDouble(
    input.viewportWidth,
    input.maximumScale,
  );
  return command({
    basePosition: input.basePosition,
    bladeId: input.bladeId,
    delta: signedPair(minimum, maximum, input.random),
    fadeOutEnabled: input.fadeOutEnabled,
    initialRotationDegrees: 0,
    lifetimeSeconds: input.lifetimeSeconds,
    logicalPath: input.logicalPath,
    rotationEnabled: input.rotationEnabled,
    scaleOutEnabled: input.scaleOutEnabled,
  });
}

function createFireCommands(
  basePosition: StandardBladeParticlePoint,
  viewportWidth: number,
  random: StandardBladeParticleRandom,
  commandSink: StandardBladeParticleCommandSink | undefined,
): readonly StandardBladeParticleSpawnCommand[] {
  if (!gate(random, 4)) {
    return NO_COMMANDS;
  }
  const selection = draw(random, 0, 2);
  if (selection === 0) {
    const lifetimeSeconds = hundredths(draw(random, 25, 125));
    const delta = directIntegerRanges(
      scaledIntegerFloat32(viewportWidth, -0.2),
      scaledIntegerDouble(viewportWidth, 0.2),
      scaledIntegerFloat32(viewportWidth, 0.05),
      scaledIntegerFloat32(viewportWidth, 0.2),
      random,
    );
    return emitCommands([
      command({
        basePosition,
        bladeId: 11,
        delta,
        fadeOutEnabled: true,
        initialRotationDegrees: 0,
        lifetimeSeconds,
        logicalPath: 'Blades/Particles/Fire/firecircle.png',
        rotationEnabled: false,
        scaleOutEnabled: false,
      }),
    ], commandSink);
  }
  if (selection === 1) {
    const lifetimeSeconds = hundredths(draw(random, 25, 125));
    const delta = directIntegerRanges(
      scaledIntegerFloat32(viewportWidth, -0.2),
      scaledIntegerDouble(viewportWidth, 0.2),
      scaledIntegerFloat32(viewportWidth, 0.05),
      scaledIntegerFloat32(viewportWidth, 0.2),
      random,
    );
    const initialRotationDegrees = recoveredRandomRotation(
      -45,
      45,
      random,
    );
    return emitCommands([
      command({
        basePosition,
        bladeId: 11,
        delta,
        fadeOutEnabled: true,
        initialRotationDegrees,
        lifetimeSeconds,
        logicalPath: 'Blades/Particles/Fire/fireparticle.png',
        rotationEnabled: false,
        scaleOutEnabled: true,
      }),
    ], commandSink);
  }

  const commands: StandardBladeParticleSpawnCommand[] = [];
  for (let index = 0; index < 3; index += 1) {
    const lifetimeSeconds = hundredths(draw(random, 25, 125));
    const delta = directIntegerRanges(
      scaledIntegerFloat32(viewportWidth, -0.1),
      scaledIntegerDouble(viewportWidth, 0.2),
      0,
      scaledIntegerFloat32(viewportWidth, 0.2),
      random,
    );
    const next = command({
      basePosition,
      bladeId: 11,
      delta,
      fadeOutEnabled: true,
      initialRotationDegrees: 0,
      lifetimeSeconds,
      logicalPath: 'Blades/Particles/Fire/smoke.png',
      rotationEnabled: false,
      scaleOutEnabled: false,
    });
    commands.push(next);
    commandSink?.(next);
  }
  return Object.freeze(commands);
}

function emitCommands(
  commands: StandardBladeParticleSpawnCommand[],
  commandSink: StandardBladeParticleCommandSink | undefined,
): readonly StandardBladeParticleSpawnCommand[] {
  const frozen = Object.freeze(commands);
  for (const command of frozen) {
    commandSink?.(command);
  }
  return frozen;
}

function particleDefinition(
  logicalPath: StandardBladeParticleLogicalPath,
  lifetimeSeconds: number,
  minimumScale: number,
  maximumScale: number,
): ParticleDefinition {
  return Object.freeze({
    lifetimeSeconds: Math.fround(lifetimeSeconds),
    logicalPath,
    maximumScale: finiteNumber(maximumScale, 'maximumScale'),
    minimumScale: Math.fround(minimumScale),
  });
}

function command(input: Readonly<{
  readonly basePosition: StandardBladeParticlePoint;
  readonly bladeId: StandardParticleBladeId;
  readonly delta: StandardBladeParticlePoint;
  readonly fadeOutEnabled: boolean;
  readonly initialRotationDegrees: number;
  readonly lifetimeSeconds: number;
  readonly logicalPath: StandardBladeParticleLogicalPath;
  readonly rotationEnabled: boolean;
  readonly scaleOutEnabled: boolean;
}>): StandardBladeParticleSpawnCommand {
  return Object.freeze({
    attachmentZOrder: STANDARD_BLADE_PARTICLE_Z_ORDER,
    basePosition: copyPoint(input.basePosition, 'basePosition'),
    delta: copyPoint(input.delta, 'delta'),
    fadeOutEnabled: input.fadeOutEnabled,
    initialRotationDegrees: finiteFloat32(
      input.initialRotationDegrees,
      'initialRotationDegrees',
    ),
    lifetimeSeconds: positiveFloat32(input.lifetimeSeconds, 'lifetimeSeconds'),
    logicalPath: input.logicalPath,
    rotationEnabled: input.rotationEnabled,
    scaleOutEnabled: input.scaleOutEnabled,
    sourceBladeId: input.bladeId,
    type: 'spawn-standard-blade-particle',
  });
}

function withInitialRotation(
  value: StandardBladeParticleSpawnCommand,
  initialRotationDegrees: number,
): StandardBladeParticleSpawnCommand {
  return command({
    basePosition: value.basePosition,
    bladeId: value.sourceBladeId,
    delta: value.delta,
    fadeOutEnabled: value.fadeOutEnabled,
    initialRotationDegrees,
    lifetimeSeconds: value.lifetimeSeconds,
    logicalPath: value.logicalPath,
    rotationEnabled: value.rotationEnabled,
    scaleOutEnabled: value.scaleOutEnabled,
  });
}

function directIntegerRanges(
  minimumX: number,
  maximumX: number,
  minimumY: number,
  maximumY: number,
  random: StandardBladeParticleRandom,
): StandardBladeParticlePoint {
  return frozenPoint(
    draw(random, minimumX, maximumX),
    draw(random, minimumY, maximumY),
  );
}

function signedPair(
  minimumMagnitude: number,
  maximumMagnitude: number,
  random: StandardBladeParticleRandom,
): StandardBladeParticlePoint {
  const xSign = draw(random, -1, 1);
  const xMagnitude = draw(random, minimumMagnitude, maximumMagnitude);
  const ySign = draw(random, -1, 1);
  const yMagnitude = draw(random, minimumMagnitude, maximumMagnitude);
  return frozenPoint(xSign * xMagnitude, ySign * yMagnitude);
}

/**
 * Mirrors the recovered `ParticleObject::RandomRotaion` arithmetic, including its
 * asymmetric implementation: `minimum + (u * maximum - minimum)`.
 */
function recoveredRandomRotation(
  minimum: number,
  maximum: number,
  random: StandardBladeParticleRandom,
): number {
  const minimumFloat32 = finiteFloat32(minimum, 'rotation minimum');
  const maximumFloat32 = finiteFloat32(maximum, 'rotation maximum');
  const scaled = Math.fround(readDecile(random) * maximumFloat32);
  return Math.fround(
    Math.fround(minimumFloat32 + Math.fround(scaled - minimumFloat32)),
  );
}

/**
 * Mirrors `VectorHelper::getAngleOfVector(nodePosition, randomMoveBy)`.
 *
 * The second point is the raw `CCMoveBy` offset, not an endpoint. This seemingly odd
 * absolute-position subtraction is preserved because both butterfly and rainbow particles
 * call the same native helper after the particle node has already received the touch point.
 */
function recoveredVectorAngleDegrees(
  nodePosition: StandardBladeParticlePoint,
  randomMoveBy: StandardBladeParticlePoint,
): number {
  const differenceX = Math.fround(randomMoveBy.x - nodePosition.x);
  const differenceY = Math.fround(randomMoveBy.y - nodePosition.y);
  if (differenceX === 0 && differenceY === 0) {
    // The native helper has no zero-vector guard and produces an IEEE NaN here. Creator cannot
    // safely accept a NaN Euler angle, so preserve the exact draw stream and use its neutral angle.
    return 0;
  }
  const ratio = Math.fround(Math.fround(-differenceX) / differenceY);
  const radians = Math.fround(Math.atan(ratio));
  return Math.fround(radians * Math.fround(180 / Math.PI));
}

function gate(random: StandardBladeParticleRandom, maximum: 4 | 5 | 6): boolean {
  return draw(random, 0, maximum) === 0;
}

function draw(
  random: StandardBladeParticleRandom,
  minimumInclusive: number,
  maximumInclusive: number,
): number {
  if (
    !Number.isSafeInteger(minimumInclusive)
    || !Number.isSafeInteger(maximumInclusive)
    || minimumInclusive > maximumInclusive
  ) {
    throw new RangeError('particle draw bounds must be ordered safe integers');
  }
  const value = random.nextIntInclusive(minimumInclusive, maximumInclusive);
  if (!Number.isSafeInteger(value)) {
    throw new TypeError('nextIntInclusive() must return a safe integer');
  }
  if (value < minimumInclusive || value > maximumInclusive) {
    throw new RangeError(
      `nextIntInclusive(${minimumInclusive}, ${maximumInclusive}) returned ${value}`,
    );
  }
  return value;
}

function hundredths(value: number): number {
  return Math.fround(value / 100);
}

function readDecile(random: StandardBladeParticleRandom): number {
  const value = random.nextDecile();
  if (!Number.isFinite(value)) {
    throw new TypeError('nextDecile() must return a finite number');
  }
  const float32 = Math.fround(value);
  const scaled = Math.fround(float32 * 10);
  if (
    scaled < 0
    || scaled > 9
    || !Number.isInteger(scaled)
    || Math.fround(scaled / 10) !== float32
  ) {
    throw new RangeError(
      'nextDecile() must return one of 0.0, 0.1, ..., 0.9',
    );
  }
  return float32;
}

function scaledIntegerFloat32(viewportWidth: number, scale: number): number {
  const value = Math.trunc(Math.fround(viewportWidth * Math.fround(scale)));
  if (!Number.isSafeInteger(value)) {
    throw new RangeError('float32-scaled particle bound must fit in a safe integer');
  }
  return value;
}

function scaledIntegerDouble(viewportWidth: number, scale: number): number {
  const value = Math.trunc(viewportWidth * finiteNumber(scale, 'scale'));
  if (!Number.isSafeInteger(value)) {
    throw new RangeError('double-scaled particle bound must fit in a safe integer');
  }
  return value;
}

function copyPoint(
  value: StandardBladeParticlePoint,
  label: string,
): StandardBladeParticlePoint {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`${label} must be a point`);
  }
  return frozenPoint(
    finiteFloat32(value.x, `${label}.x`),
    finiteFloat32(value.y, `${label}.y`),
  );
}

function frozenPoint(x: number, y: number): StandardBladeParticlePoint {
  return Object.freeze({ x, y });
}

function assertRandom(random: StandardBladeParticleRandom): void {
  if (
    random === null
    || typeof random !== 'object'
    || typeof random.nextIntInclusive !== 'function'
    || typeof random.nextDecile !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive() and nextDecile()');
  }
}

function assertCommandSink(
  commandSink: StandardBladeParticleCommandSink | undefined,
): void {
  if (commandSink !== undefined && typeof commandSink !== 'function') {
    throw new TypeError('commandSink must be a function when provided');
  }
}

function positiveFloat32(value: number, label: string): number {
  const converted = finiteFloat32(value, label);
  if (converted <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
  return converted;
}

function finiteFloat32(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
  const converted = Math.fround(value);
  if (!Number.isFinite(converted)) {
    throw new RangeError(`${label} must fit in a finite float32`);
  }
  return converted;
}

function finiteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
  return value;
}
