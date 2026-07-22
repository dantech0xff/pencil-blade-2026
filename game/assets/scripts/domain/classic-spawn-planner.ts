import type { GameplayRandom } from './gameplay-random';
import type {
  ClassicTossDirection,
  LogicalViewport,
  ReadonlyVector2,
  RecoveredSpawnKinematics,
} from './spawn-kinematics';

export const CLASSIC_NORMAL_FRUIT_IDS = Object.freeze([
  0, 1, 6, 5, 7, 4, 2, 3, 8,
] as const);

export const CLASSIC_FRUIT_TOSS_SOUND = 'Sounds/tossfruit.wav';
export const CLASSIC_BOMB_TOSS_SOUND = 'Sounds/boomtoss.wav';
export const CLASSIC_SPAWN_Z_ORDER = 1;

export type ClassicNormalFruitId = (typeof CLASSIC_NORMAL_FRUIT_IDS)[number];
export type ClassicSpecialFruitId = 13 | 14;
export type ClassicSpawnTossType = 0 | 1 | 3 | 4 | 6;
export type ClassicTossSound =
  | typeof CLASSIC_FRUIT_TOSS_SOUND
  | typeof CLASSIC_BOMB_TOSS_SOUND;

export type ClassicCreateCommand =
  | Readonly<{
      type: 'create-fruit';
      entityOccurrenceId: number;
      tossType: 0;
      fruitId: ClassicNormalFruitId;
      critical: boolean;
    }>
  | Readonly<{
      type: 'create-fruit';
      entityOccurrenceId: number;
      tossType: 3 | 4;
      fruitId: ClassicSpecialFruitId;
    }>
  | Readonly<{
      type: 'create-bomb';
      entityOccurrenceId: number;
      tossType: 1;
      bombId: 0;
    }>
  | Readonly<{
      type: 'create-dragon-fruit';
      entityOccurrenceId: number;
      tossType: 6;
    }>;

export type ClassicSpawnCommand =
  | ClassicCreateCommand
  | Readonly<{
      type: 'reset-linear-velocity';
      entityOccurrenceId: number;
      metresPerSecond: ReadonlyVector2;
      reason: 'fruit-factory-down-reset';
    }>
  | Readonly<{
      type: 'set-transform';
      entityOccurrenceId: number;
      positionMetres: ReadonlyVector2;
      angleRadians: 0;
    }>
  | Readonly<{
      type: 'set-linear-velocity';
      entityOccurrenceId: number;
      metresPerSecond: ReadonlyVector2;
      reason: 'spawn-kinematics';
    }>
  | Readonly<{
      type: 'set-angular-velocity';
      entityOccurrenceId: number;
      radiansPerSecond: number;
    }>
  | Readonly<{
      type: 'play-toss-sound';
      entityOccurrenceId: number;
      sound: ClassicTossSound;
    }>
  | Readonly<{
      type: 'attach-spawned-entity';
      entityOccurrenceId: number;
      zOrder: 1;
    }>;

export interface ClassicSpawnRequest {
  readonly tossType: ClassicSpawnTossType;
  readonly direction: ClassicTossDirection;
  readonly viewport: LogicalViewport;
  readonly effectsEnabled: boolean;
}

export interface ClassicSpawnPlan {
  readonly entityOccurrenceId: number;
  readonly commands: readonly ClassicSpawnCommand[];
}

export type SpawnKinematicsSampler = (
  direction: ClassicTossDirection,
  viewport: LogicalViewport,
  random: GameplayRandom,
) => RecoveredSpawnKinematics;

export interface ClassicSpawnPlannerOptions {
  readonly random: GameplayRandom;
  readonly sampleKinematics: SpawnKinematicsSampler;
  /** Target replay seam; defaults to one and consumes no gameplay RNG. */
  readonly firstEntityOccurrenceId?: number;
}

/**
 * Classic-only factory and spawn command planner.
 *
 * Recovered ordering is encoded in each frozen command array: factory selection (including
 * type-0 fruit and critical draws), kinematics, conditional sound, then attachment. The
 * monotonic occurrence ID is target bookkeeping and never consumes gameplay randomness.
 */
export class ClassicSpawnPlanner {
  readonly random: GameplayRandom;
  private readonly sampleKinematicsValue: SpawnKinematicsSampler;
  private nextEntityOccurrenceIdValue: number;

  constructor(options: ClassicSpawnPlannerOptions) {
    if (options === null || typeof options !== 'object') {
      throw new TypeError('options must be an object');
    }
    assertGameplayRandom(options.random);
    if (typeof options.sampleKinematics !== 'function') {
      throw new TypeError('sampleKinematics must be a function');
    }

    const firstId = options.firstEntityOccurrenceId ?? 1;
    assertPositiveSafeInteger(firstId, 'firstEntityOccurrenceId');
    this.random = options.random;
    this.sampleKinematicsValue = options.sampleKinematics;
    this.nextEntityOccurrenceIdValue = firstId;
  }

  get nextEntityOccurrenceId(): number {
    return this.nextEntityOccurrenceIdValue;
  }

  planSpawn(request: ClassicSpawnRequest): ClassicSpawnPlan {
    validateSpawnRequest(request);
    if (this.nextEntityOccurrenceIdValue >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('entity occurrence ID space is exhausted');
    }

    const entityOccurrenceId = this.nextEntityOccurrenceIdValue;
    const commands: ClassicSpawnCommand[] = [];

    commands.push(this.createEntity(request.tossType, entityOccurrenceId));

    // Recovered Fruit creation establishes (0,0). The explicit reset is a Creator pooling
    // responsibility, not a velocity write invented for DownRandomData.
    if (
      request.direction === 1
      && (request.tossType === 3 || request.tossType === 4)
    ) {
      commands.push(Object.freeze({
        type: 'reset-linear-velocity',
        entityOccurrenceId,
        metresPerSecond: frozenVector(0, 0),
        reason: 'fruit-factory-down-reset',
      }));
    }

    const kinematics = this.sampleKinematicsValue(
      request.direction,
      request.viewport,
      this.random,
    );
    appendKinematicsCommands(commands, entityOccurrenceId, request.direction, kinematics);

    const sound = soundForTossType(request.tossType, request.effectsEnabled);
    if (sound !== null) {
      commands.push(Object.freeze({
        type: 'play-toss-sound',
        entityOccurrenceId,
        sound,
      }));
    }

    commands.push(Object.freeze({
      type: 'attach-spawned-entity',
      entityOccurrenceId,
      zOrder: CLASSIC_SPAWN_Z_ORDER,
    }));

    this.nextEntityOccurrenceIdValue += 1;
    return Object.freeze({
      entityOccurrenceId,
      commands: Object.freeze(commands),
    });
  }

  private createEntity(
    tossType: ClassicSpawnTossType,
    entityOccurrenceId: number,
  ): ClassicCreateCommand {
    switch (tossType) {
      case 0: {
        const fruitIndex = drawInclusive(
          this.random,
          0,
          CLASSIC_NORMAL_FRUIT_IDS.length - 1,
        );
        const fruitId = CLASSIC_NORMAL_FRUIT_IDS[fruitIndex];
        const critical = drawInclusive(this.random, 0, 24) === 0;
        return Object.freeze({
          type: 'create-fruit',
          entityOccurrenceId,
          tossType,
          fruitId,
          critical,
        });
      }
      case 1:
        return Object.freeze({
          type: 'create-bomb',
          entityOccurrenceId,
          tossType,
          bombId: 0,
        });
      case 3:
        return Object.freeze({
          type: 'create-fruit',
          entityOccurrenceId,
          tossType,
          fruitId: 13,
        });
      case 4:
        return Object.freeze({
          type: 'create-fruit',
          entityOccurrenceId,
          tossType,
          fruitId: 14,
        });
      case 6:
        return Object.freeze({
          type: 'create-dragon-fruit',
          entityOccurrenceId,
          tossType,
        });
    }
  }
}

export function soundForTossType(
  tossType: ClassicSpawnTossType,
  effectsEnabled: boolean,
): ClassicTossSound | null {
  assertClassicTossType(tossType);
  assertBoolean(effectsEnabled, 'effectsEnabled');
  if (!effectsEnabled || tossType === 3 || tossType === 4 || tossType === 6) {
    return null;
  }
  return tossType === 0 ? CLASSIC_FRUIT_TOSS_SOUND : CLASSIC_BOMB_TOSS_SOUND;
}

function appendKinematicsCommands(
  commands: ClassicSpawnCommand[],
  entityOccurrenceId: number,
  expectedDirection: ClassicTossDirection,
  kinematics: RecoveredSpawnKinematics,
): void {
  if (kinematics === null || typeof kinematics !== 'object') {
    throw new TypeError('sampleKinematics must return an object');
  }
  if (kinematics.direction !== expectedDirection) {
    throw new Error('sampleKinematics returned a different direction');
  }
  if (kinematics.angleRadians !== 0) {
    throw new Error('recovered spawn transform angle must be zero');
  }

  commands.push(Object.freeze({
    type: 'set-transform',
    entityOccurrenceId,
    positionMetres: copyFiniteVector(kinematics.positionMetres, 'positionMetres'),
    angleRadians: 0,
  }));

  const hasLinearVelocity = 'linearVelocityMetresPerSecond' in kinematics;
  if (expectedDirection === 1 && hasLinearVelocity) {
    throw new Error('Down kinematics must not emit linear velocity');
  }
  if (expectedDirection !== 1 && !hasLinearVelocity) {
    throw new Error('non-Down kinematics must emit linear velocity');
  }
  if (hasLinearVelocity) {
    commands.push(Object.freeze({
      type: 'set-linear-velocity',
      entityOccurrenceId,
      metresPerSecond: copyFiniteVector(
        kinematics.linearVelocityMetresPerSecond,
        'linearVelocityMetresPerSecond',
      ),
      reason: 'spawn-kinematics',
    }));
  }

  assertFinite(
    kinematics.angularVelocityRadiansPerSecond,
    'angularVelocityRadiansPerSecond',
  );
  commands.push(Object.freeze({
    type: 'set-angular-velocity',
    entityOccurrenceId,
    radiansPerSecond: kinematics.angularVelocityRadiansPerSecond,
  }));
}

function validateSpawnRequest(request: ClassicSpawnRequest): void {
  if (request === null || typeof request !== 'object') {
    throw new TypeError('request must be an object');
  }
  assertClassicTossType(request.tossType);
  if (
    request.direction !== 0
    && request.direction !== 1
    && request.direction !== 2
    && request.direction !== 3
  ) {
    throw new RangeError('direction must be 0, 1, 2, or 3');
  }
  if (request.viewport === null || typeof request.viewport !== 'object') {
    throw new TypeError('viewport must be an object');
  }
  assertBoolean(request.effectsEnabled, 'effectsEnabled');
}

function assertClassicTossType(value: number): asserts value is ClassicSpawnTossType {
  if (value !== 0 && value !== 1 && value !== 3 && value !== 4 && value !== 6) {
    throw new RangeError('Classic toss type must be 0, 1, 3, 4, or 6');
  }
}

function assertGameplayRandom(random: GameplayRandom): void {
  if (
    random === null
    || typeof random !== 'object'
    || typeof random.nextRawNonNegativeInt !== 'function'
    || typeof random.nextIntInclusive !== 'function'
    || typeof random.nextDecile !== 'function'
  ) {
    throw new TypeError('random must implement GameplayRandom');
  }
}

function drawInclusive(random: GameplayRandom, min: number, max: number): number {
  const value = random.nextIntInclusive(min, max);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`nextIntInclusive() must return an integer in [${min}, ${max}]`);
  }
  return value;
}

function copyFiniteVector(value: ReadonlyVector2, label: string): ReadonlyVector2 {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
  assertFinite(value.x, `${label}.x`);
  assertFinite(value.y, `${label}.y`);
  return frozenVector(value.x, value.y);
}

function frozenVector(x: number, y: number): ReadonlyVector2 {
  return Object.freeze({ x, y });
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
}

function assertBoolean(value: boolean, label: string): void {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be a boolean`);
  }
}
