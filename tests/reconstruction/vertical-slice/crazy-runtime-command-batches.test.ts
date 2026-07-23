import assert from 'node:assert/strict';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../'))
      && extname(specifier) === ''
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { partitionCrazyRuntimeCommands } = await import(
  '../../../game/assets/scripts/domain/crazy-runtime-command-batches.ts'
);

const spawn = Object.freeze([
  Object.freeze({
    critical: false,
    entityOccurrenceId: 7,
    fruitId: 0,
    tossType: 0,
    type: 'create-fruit',
  }),
  Object.freeze({
    angleRadians: 0,
    entityOccurrenceId: 7,
    positionMetres: Object.freeze({ x: 1, y: 2 }),
    type: 'set-transform',
  }),
  Object.freeze({
    entityOccurrenceId: 7,
    metresPerSecond: Object.freeze({ x: 3, y: 4 }),
    reason: 'spawn-kinematics',
    type: 'set-linear-velocity',
  }),
  Object.freeze({
    entityOccurrenceId: 7,
    radiansPerSecond: 5,
    type: 'set-angular-velocity',
  }),
  Object.freeze({
    entityOccurrenceId: 7,
    type: 'attach-spawned-entity',
    zOrder: 1,
  }),
] as const);

const bonus = Object.freeze([
  Object.freeze({
    controllerId: 'b5',
    entityOccurrenceId: 3,
    fruitId: 12,
    tossType: 5,
    type: 'create-bonus-fruit',
  }),
  Object.freeze({
    controllerId: 'b5',
    direction: 2,
    entityOccurrenceId: 3,
    type: 'randomize-bonus-fruit',
  }),
  Object.freeze({
    controllerId: 'b5',
    entityOccurrenceId: 3,
    type: 'attach-bonus-fruit',
    zOrder: 1,
  }),
  Object.freeze({
    bonusId: 12,
    entityOccurrenceId: 3,
    type: 'enable-bonus',
  }),
  Object.freeze({
    canonicalPath: 'Sounds/tossfruit.wav',
    entityOccurrenceId: 3,
    loop: false,
    type: 'request-bonus-toss-audio',
  }),
] as const);

test('partitions mixed composite callbacks without changing observable order', () => {
  const controlBefore = Object.freeze({
    child: Object.freeze({
      childControllerId: 'b4:left',
      direction: 2,
      interval: Object.freeze({ highSeconds: 1.5, lowSeconds: 0.75 }),
      side: 'left',
      tossType: 0,
      zOrder: 1,
    }),
    controllerId: 'b4',
    type: 'request-double-free-child-turn',
  });
  const controlAfter = Object.freeze({
    controllerId: 'b4',
    type: 'stop-double-base-timer',
  });

  const batches = partitionCrazyRuntimeCommands([
    controlBefore,
    ...spawn,
    ...bonus,
    controlAfter,
  ] as never);

  assert.deepEqual(batches.map(({ kind }) => kind), [
    'control',
    'classic-spawn',
    'bonus-spawn',
    'control',
  ]);
  assert.equal(batches[0]?.kind === 'control' && batches[0].command, controlBefore);
  assert.deepEqual(
    batches[1]?.kind === 'classic-spawn' ? batches[1].plan : null,
    { commands: spawn, entityOccurrenceId: 7 },
  );
  assert.deepEqual(
    batches[2]?.kind === 'bonus-spawn' ? batches[2].commands : null,
    bonus,
  );
  assert.equal(batches[3]?.kind === 'control' && batches[3].command, controlAfter);
  assert.equal(Object.isFrozen(batches), true);
});

test('supports Dragon create plans and bonus batches without optional audio', () => {
  const dragon = Object.freeze([
    Object.freeze({
      entityOccurrenceId: 9,
      tossType: 6,
      type: 'create-dragon-fruit',
    }),
    Object.freeze({
      angleRadians: 0,
      entityOccurrenceId: 9,
      positionMetres: Object.freeze({ x: 0, y: 0 }),
      type: 'set-transform',
    }),
    Object.freeze({
      entityOccurrenceId: 9,
      radiansPerSecond: 0,
      type: 'set-angular-velocity',
    }),
    Object.freeze({
      entityOccurrenceId: 9,
      type: 'attach-spawned-entity',
      zOrder: 1,
    }),
  ] as const);

  const batches = partitionCrazyRuntimeCommands([
    ...dragon,
    ...bonus.slice(0, 4),
  ] as never);
  assert.equal(batches[0]?.kind, 'classic-spawn');
  assert.equal(batches[1]?.kind, 'bonus-spawn');
  assert.equal(
    batches[1]?.kind === 'bonus-spawn' && batches[1].commands.length,
    4,
  );
});

test('rejects truncated, interleaved, and orphaned spawn command streams', () => {
  assert.throws(
    () => partitionCrazyRuntimeCommands(spawn.slice(0, -1) as never),
    /must end with attach/,
  );
  assert.throws(
    () => partitionCrazyRuntimeCommands([
      spawn[0],
      { ...spawn[1], entityOccurrenceId: 8 },
    ] as never),
    /cannot interleave/,
  );
  assert.throws(
    () => partitionCrazyRuntimeCommands([spawn[1]] as never),
    /orphaned set-transform/,
  );
  assert.throws(
    () => partitionCrazyRuntimeCommands(bonus.slice(0, 3) as never),
    /expected enable-bonus/,
  );
  assert.throws(
    () => partitionCrazyRuntimeCommands([
      ...bonus.slice(0, 4),
      { ...bonus[4], entityOccurrenceId: 4 },
    ] as never),
    /bonus audio must match/,
  );
});
