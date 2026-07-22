import assert from 'node:assert/strict';
import test from 'node:test';

import { partitionClassicSpawnCommands } from '../../../game/assets/scripts/domain/classic-spawn-plan-batch.ts';
import { ModuloGameplayRandom } from '../../../game/assets/scripts/domain/gameplay-random.ts';
import type { ClassicSpawnCommand } from '../../../game/assets/scripts/domain/classic-spawn-planner.ts';
import { ClassicConcurrentTossStrategy } from '../../../game/assets/scripts/domain/classic-toss-strategies.ts';
import { TossTimer } from '../../../game/assets/scripts/domain/toss-timer.ts';

test('flattened Concurrent commands become frozen whole plans without reordering', () => {
  const commands = [
    createBomb(10),
    transform(10, 1),
    attach(10),
    createBomb(11),
    transform(11, 2),
    attach(11),
  ] as const;

  const plans = partitionClassicSpawnCommands(commands);
  assert.deepEqual(plans, [
    { entityOccurrenceId: 10, commands: commands.slice(0, 3) },
    { entityOccurrenceId: 11, commands: commands.slice(3, 6) },
  ]);
  assert.equal(Object.isFrozen(plans), true);
  assert.equal(plans.every((plan) => Object.isFrozen(plan) && Object.isFrozen(plan.commands)), true);
});

test('single plans and empty batches preserve their exact command boundaries', () => {
  const commands = [createBomb(1), transform(1, 3), attach(1)] as const;
  const plans = partitionClassicSpawnCommands(commands);
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0]?.commands, commands);
  assert.deepEqual(partitionClassicSpawnCommands([]), []);
});

test('actual Concurrent strategy output passes directly through the partition boundary', () => {
  const random = new ModuloGameplayRandom({ nextRawNonNegativeInt: () => 1 });
  let nextOccurrenceId = 20;
  const concurrent = new ClassicConcurrentTossStrategy({
    controllerId: 'partition-integration',
    random,
    interval: { lowSeconds: 1, highSeconds: 1 },
    createTimer: (options) => new TossTimer(options),
    planner: {
      random,
      planSpawn() {
        const entityOccurrenceId = nextOccurrenceId;
        nextOccurrenceId += 1;
        return Object.freeze({
          entityOccurrenceId,
          commands: Object.freeze([
            createBomb(entityOccurrenceId),
            transform(entityOccurrenceId, entityOccurrenceId),
            attach(entityOccurrenceId),
          ]),
        });
      },
    },
    tossType: 1,
    direction: 0,
    viewport: () => ({ width: 480, height: 800 }),
    effectsEnabled: () => false,
    countMin: 1,
    countMax: 1,
  });

  const plans = partitionClassicSpawnCommands(concurrent.performTurn());
  assert.deepEqual(plans.map((plan) => plan.entityOccurrenceId), [20, 21]);
  assert.deepEqual(plans.map((plan) => plan.commands.length), [3, 3]);
});

test('non-contiguous IDs, partial plans, and invalid commands fail closed', () => {
  assert.throws(() => partitionClassicSpawnCommands([
    createBomb(1),
    attach(1),
    createBomb(2),
    attach(2),
    createBomb(1),
    attach(1),
  ]), /not contiguous/);
  assert.throws(() => partitionClassicSpawnCommands([
    transform(1, 1),
    attach(1),
  ]), /begin with exactly one create/);
  assert.throws(() => partitionClassicSpawnCommands([
    createBomb(1),
    transform(1, 1),
  ]), /end with exactly one attachment/);
  assert.throws(() => partitionClassicSpawnCommands([
    createBomb(1),
    transform(1, 1),
    createBomb(1),
    attach(1),
  ]), /internal create/);
  assert.throws(() => partitionClassicSpawnCommands([
    createBomb(1),
    attach(1),
    transform(1, 1),
    attach(1),
  ]), /internal attachment/);
  assert.throws(() => partitionClassicSpawnCommands([{
    type: 'resume-wave-child',
    controllerId: 'wave',
    childControllerId: 'wave:child',
  }]), /not a spawn command/);
  assert.throws(() => partitionClassicSpawnCommands([
    { ...createBomb(1), entityOccurrenceId: 0 },
    attach(1),
  ] as never), /positive safe integer/);
  assert.throws(() => partitionClassicSpawnCommands(null as never), /array/);
});

function createBomb(entityOccurrenceId: number): ClassicSpawnCommand {
  return Object.freeze({
    type: 'create-bomb',
    entityOccurrenceId,
    tossType: 1,
    bombId: 0,
  });
}

function transform(entityOccurrenceId: number, x: number): ClassicSpawnCommand {
  return Object.freeze({
    type: 'set-transform',
    entityOccurrenceId,
    positionMetres: Object.freeze({ x, y: 2 }),
    angleRadians: 0,
  });
}

function attach(entityOccurrenceId: number): ClassicSpawnCommand {
  return Object.freeze({
    type: 'attach-spawned-entity',
    entityOccurrenceId,
    zOrder: 1,
  });
}
