import type { BonusTossCommand } from './bonus-toss-strategy';
import type {
  ClassicSpawnCommand,
  ClassicSpawnPlan,
} from './classic-spawn-planner';
import type { CrazyTossRuntimeCommand } from './crazy-toss-coordinator';

export type CrazyRuntimeCommandBatch =
  | Readonly<{
      readonly kind: 'classic-spawn';
      readonly plan: ClassicSpawnPlan;
    }>
  | Readonly<{
      readonly commands: readonly BonusTossCommand[];
      readonly kind: 'bonus-spawn';
    }>
  | Readonly<{
      readonly command: CrazyTossRuntimeCommand;
      readonly kind: 'control';
    }>;

const CLASSIC_CREATE_TYPES: ReadonlySet<string> = new Set([
  'create-bomb',
  'create-dragon-fruit',
  'create-fruit',
]);
const CLASSIC_SPAWN_TYPES: ReadonlySet<string> = new Set([
  ...Array.from(CLASSIC_CREATE_TYPES),
  'attach-spawned-entity',
  'play-toss-sound',
  'reset-linear-velocity',
  'set-angular-velocity',
  'set-linear-velocity',
  'set-transform',
]);
const BONUS_SPAWN_TYPES: ReadonlySet<string> = new Set([
  'attach-bonus-fruit',
  'create-bonus-fruit',
  'enable-bonus',
  'randomize-bonus-fruit',
  'request-bonus-toss-audio',
]);
const REQUIRED_BONUS_SEQUENCE = Object.freeze([
  'create-bonus-fruit',
  'randomize-bonus-fruit',
  'attach-bonus-fruit',
  'enable-bonus',
] as const);

/**
 * Splits one coordinator callback into atomic runtime transactions.
 *
 * Concurrent and composite toss strategies can publish several contiguous spawn plans plus
 * lifecycle commands in one callback. The Creator registry accepts one entity transaction at a
 * time, so this bridge preserves order while rejecting orphaned or interleaved spawn commands.
 */
export function partitionCrazyRuntimeCommands(
  commands: readonly CrazyTossRuntimeCommand[],
): readonly CrazyRuntimeCommandBatch[] {
  if (!Array.isArray(commands)) {
    throw new TypeError('Crazy runtime commands must be an array');
  }

  const batches: CrazyRuntimeCommandBatch[] = [];
  let index = 0;
  while (index < commands.length) {
    const command = requireCommand(commands[index], index);
    if (CLASSIC_CREATE_TYPES.has(command.type)) {
      const entityOccurrenceId = requireOccurrenceId(command, index);
      const spawnCommands: ClassicSpawnCommand[] = [];
      let attached = false;
      while (index < commands.length) {
        const candidate = requireCommand(commands[index], index);
        if (!CLASSIC_SPAWN_TYPES.has(candidate.type)) {
          break;
        }
        if (requireOccurrenceId(candidate, index) !== entityOccurrenceId) {
          throw new Error('Crazy spawn commands cannot interleave entity occurrences');
        }
        spawnCommands.push(candidate as ClassicSpawnCommand);
        index += 1;
        if (candidate.type === 'attach-spawned-entity') {
          attached = true;
          break;
        }
      }
      if (!attached) {
        throw new Error('Crazy spawn plan must end with attach-spawned-entity');
      }
      batches.push(Object.freeze({
        kind: 'classic-spawn',
        plan: Object.freeze({
          commands: Object.freeze(spawnCommands),
          entityOccurrenceId,
        }),
      }));
      continue;
    }

    if (command.type === 'create-bonus-fruit') {
      const entityOccurrenceId = requireOccurrenceId(command, index);
      const bonusCommands: BonusTossCommand[] = [];
      for (const expectedType of REQUIRED_BONUS_SEQUENCE) {
        const candidateValue = commands[index];
        if (candidateValue?.type !== expectedType) {
          throw new Error(
            `Crazy bonus spawn expected ${expectedType} for occurrence ${entityOccurrenceId}`,
          );
        }
        const candidate = requireCommand(candidateValue, index);
        if (requireOccurrenceId(candidate, index) !== entityOccurrenceId) {
          throw new Error(
            `Crazy bonus spawn expected ${expectedType} for occurrence ${entityOccurrenceId}`,
          );
        }
        bonusCommands.push(candidate as BonusTossCommand);
        index += 1;
      }
      const optionalAudio = commands[index];
      if (
        optionalAudio !== undefined
        && optionalAudio.type === 'request-bonus-toss-audio'
      ) {
        if (requireOccurrenceId(optionalAudio, index) !== entityOccurrenceId) {
          throw new Error('Crazy bonus audio must match its entity occurrence');
        }
        bonusCommands.push(optionalAudio);
        index += 1;
      }
      batches.push(Object.freeze({
        commands: Object.freeze(bonusCommands),
        kind: 'bonus-spawn',
      }));
      continue;
    }

    if (
      CLASSIC_SPAWN_TYPES.has(command.type)
      || BONUS_SPAWN_TYPES.has(command.type)
    ) {
      throw new Error(`Crazy runtime received orphaned ${command.type} command`);
    }

    batches.push(Object.freeze({ command, kind: 'control' }));
    index += 1;
  }
  return Object.freeze(batches);
}

function requireCommand(
  value: CrazyTossRuntimeCommand | undefined,
  index: number,
): CrazyTossRuntimeCommand {
  if (
    value === undefined
    || value === null
    || typeof value !== 'object'
    || typeof value.type !== 'string'
    || value.type.length === 0
  ) {
    throw new TypeError(`Crazy runtime command ${index} must be a typed object`);
  }
  return value;
}

function requireOccurrenceId(
  command: CrazyTossRuntimeCommand,
  index: number,
): number {
  if (
    !('entityOccurrenceId' in command)
    || !Number.isSafeInteger(command.entityOccurrenceId)
    || command.entityOccurrenceId <= 0
  ) {
    throw new RangeError(
      `Crazy runtime command ${index} requires a positive entityOccurrenceId`,
    );
  }
  return command.entityOccurrenceId;
}
