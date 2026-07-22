import type {
  ClassicSpawnCommand,
  ClassicSpawnPlan,
} from './classic-spawn-planner';
import type { ClassicTossStrategyCommand } from './classic-toss-strategies';

const EMPTY_SPAWN_PLANS: readonly ClassicSpawnPlan[] = Object.freeze([]);

/**
 * Restores whole per-entity plans from Concurrent's recovered flat command stream.
 * Commands are never sorted, deduplicated, or regrouped across a non-contiguous ID.
 */
export function partitionClassicSpawnCommands(
  commands: readonly ClassicTossStrategyCommand[],
): readonly ClassicSpawnPlan[] {
  if (!Array.isArray(commands)) {
    throw new TypeError('Classic spawn commands must be an array');
  }
  if (commands.length === 0) {
    return EMPTY_SPAWN_PLANS;
  }

  const plans: ClassicSpawnPlan[] = [];
  const closedOccurrenceIds = new Set<number>();
  let currentOccurrenceId: number | null = null;
  let currentCommands: ClassicSpawnCommand[] = [];

  for (const command of commands) {
    assertSpawnCommand(command);
    if (currentOccurrenceId === command.entityOccurrenceId) {
      currentCommands.push(command);
      continue;
    }

    if (currentOccurrenceId !== null) {
      plans.push(freezePlan(currentOccurrenceId, currentCommands));
      closedOccurrenceIds.add(currentOccurrenceId);
    }
    if (closedOccurrenceIds.has(command.entityOccurrenceId)) {
      throw new Error(
        `Classic spawn occurrence ${command.entityOccurrenceId} is not contiguous`,
      );
    }
    currentOccurrenceId = command.entityOccurrenceId;
    currentCommands = [command];
  }

  if (currentOccurrenceId === null) {
    throw new Error('Classic spawn command partition lost its first occurrence');
  }
  plans.push(freezePlan(currentOccurrenceId, currentCommands));
  return Object.freeze(plans);
}

function freezePlan(
  entityOccurrenceId: number,
  commands: readonly ClassicSpawnCommand[],
): ClassicSpawnPlan {
  let createCount = 0;
  let attachCount = 0;
  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index];
    if (command === undefined) {
      throw new Error(`Classic spawn occurrence ${entityOccurrenceId} contains a gap`);
    }
    if (isCreateCommand(command)) {
      createCount += 1;
      if (index !== 0) {
        throw new Error(
          `Classic spawn occurrence ${entityOccurrenceId} contains an internal create command`,
        );
      }
    } else if (command.type === 'attach-spawned-entity') {
      attachCount += 1;
      if (index !== commands.length - 1) {
        throw new Error(
          `Classic spawn occurrence ${entityOccurrenceId} contains an internal attachment`,
        );
      }
    }
  }
  if (createCount !== 1) {
    throw new Error(
      `Classic spawn occurrence ${entityOccurrenceId} must begin with exactly one create command`,
    );
  }
  if (attachCount !== 1) {
    throw new Error(
      `Classic spawn occurrence ${entityOccurrenceId} must end with exactly one attachment`,
    );
  }
  return Object.freeze({
    entityOccurrenceId,
    commands: Object.freeze([...commands]),
  });
}

function assertSpawnCommand(
  command: ClassicTossStrategyCommand,
): asserts command is ClassicSpawnCommand {
  if (command === null || typeof command !== 'object') {
    throw new TypeError('Classic spawn command must be an object');
  }
  if (!isSpawnCommandType(command.type)) {
    throw new RangeError(`Classic toss command ${command.type} is not a spawn command`);
  }
  if (!('entityOccurrenceId' in command)) {
    throw new TypeError('Classic spawn command must carry an entityOccurrenceId');
  }
  if (
    !Number.isSafeInteger(command.entityOccurrenceId)
    || command.entityOccurrenceId <= 0
  ) {
    throw new RangeError('entityOccurrenceId must be a positive safe integer');
  }
}

function isCreateCommand(command: ClassicSpawnCommand): boolean {
  return command.type === 'create-fruit'
    || command.type === 'create-bomb'
    || command.type === 'create-dragon-fruit';
}

function isSpawnCommandType(type: ClassicTossStrategyCommand['type']): type is ClassicSpawnCommand['type'] {
  return type === 'create-fruit'
    || type === 'create-bomb'
    || type === 'create-dragon-fruit'
    || type === 'reset-linear-velocity'
    || type === 'set-transform'
    || type === 'set-linear-velocity'
    || type === 'set-angular-velocity'
    || type === 'play-toss-sound'
    || type === 'attach-spawned-entity';
}
