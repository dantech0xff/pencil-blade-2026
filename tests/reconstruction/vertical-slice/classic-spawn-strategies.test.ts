import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLASSIC_BOMB_TOSS_SOUND,
  CLASSIC_FRUIT_TOSS_SOUND,
  CLASSIC_NORMAL_FRUIT_IDS,
  ClassicSpawnPlanner,
  soundForTossType,
  type SpawnKinematicsSampler,
} from '../../../game/assets/scripts/domain/classic-spawn-planner.ts';
import {
  CLASSIC_WAVE_INTERNAL_INTERVAL,
  ClassicConcurrentTossStrategy,
  ClassicFreeTossStrategy,
  ClassicWaveTossStrategy,
  type TossStrategyTimerFactory,
} from '../../../game/assets/scripts/domain/classic-toss-strategies.ts';
import type { GameplayRandom } from '../../../game/assets/scripts/domain/gameplay-random.ts';
import type { RecoveredSpawnKinematics } from '../../../game/assets/scripts/domain/spawn-kinematics.ts';
import { TossTimer } from '../../../game/assets/scripts/domain/toss-timer.ts';

class ScriptedGameplayRandom implements GameplayRandom {
  readonly calls: string[] = [];
  private readonly integers: number[];
  private readonly deciles: number[];

  constructor(integers: readonly number[] = [], deciles: readonly number[] = []) {
    this.integers = [...integers];
    this.deciles = [...deciles];
  }

  nextRawNonNegativeInt(): number {
    this.calls.push('raw');
    return 0;
  }

  nextIntInclusive(min: number, max: number): number {
    const value = this.integers.shift();
    if (value === undefined) {
      throw new Error(`scripted integer RNG exhausted for [${min}, ${max}]`);
    }
    this.calls.push(`int:${min}:${max}:${value}`);
    return value;
  }

  nextDecile(): number {
    const value = this.deciles.shift();
    if (value === undefined) {
      throw new Error('scripted decile RNG exhausted');
    }
    this.calls.push(`decile:${value}`);
    return value;
  }
}

const CONSTANT_KINEMATICS: SpawnKinematicsSampler = (direction) => {
  const base = {
    direction,
    positionMetres: { x: 2, y: 3 },
    angleRadians: 0 as const,
    angularVelocityRadiansPerSecond: 4,
  };
  if (direction === 1) {
    return base as RecoveredSpawnKinematics;
  }
  return {
    ...base,
    direction,
    linearVelocityMetresPerSecond: { x: 5, y: 6 },
  } as RecoveredSpawnKinematics;
};

const CREATE_REAL_TIMER: TossStrategyTimerFactory = (options) => new TossTimer(options);
const VIEWPORT = Object.freeze({ width: 480, height: 800 });

test('type 0 maps all nine fruit-vector indices and draws critical before kinematics', () => {
  assert.deepEqual(CLASSIC_NORMAL_FRUIT_IDS, [0, 1, 6, 5, 7, 4, 2, 3, 8]);

  CLASSIC_NORMAL_FRUIT_IDS.forEach((expectedFruitId, index) => {
    const criticalDraw = index === 0 ? 0 : 1;
    const random = new ScriptedGameplayRandom([index, criticalDraw]);
    const events: string[] = [];
    const planner = new ClassicSpawnPlanner({
      random,
      sampleKinematics(direction) {
        events.push('kinematics');
        return CONSTANT_KINEMATICS(direction, VIEWPORT, random);
      },
    });

    const plan = planner.planSpawn({
      tossType: 0,
      direction: 0,
      viewport: VIEWPORT,
      effectsEnabled: false,
    });

    assert.deepEqual(plan.commands[0], {
      type: 'create-fruit',
      entityOccurrenceId: 1,
      tossType: 0,
      fruitId: expectedFruitId,
      critical: index === 0,
    });
    assert.deepEqual(random.calls, [`int:0:8:${index}`, `int:0:24:${criticalDraw}`]);
    assert.deepEqual(events, ['kinematics']);
  });
});

test('special Down fruits reset pooled velocity before transform and omit a Down velocity write', () => {
  for (const [tossType, fruitId] of [[3, 13], [4, 14]] as const) {
    const random = new ScriptedGameplayRandom();
    const planner = new ClassicSpawnPlanner({ random, sampleKinematics: CONSTANT_KINEMATICS });
    const plan = planner.planSpawn({
      tossType,
      direction: 1,
      viewport: VIEWPORT,
      effectsEnabled: true,
    });

    assert.deepEqual(plan.commands, [
      { type: 'create-fruit', entityOccurrenceId: 1, tossType, fruitId },
      {
        type: 'reset-linear-velocity',
        entityOccurrenceId: 1,
        metresPerSecond: { x: 0, y: 0 },
        reason: 'fruit-factory-down-reset',
      },
      {
        type: 'set-transform',
        entityOccurrenceId: 1,
        positionMetres: { x: 2, y: 3 },
        angleRadians: 0,
      },
      { type: 'set-angular-velocity', entityOccurrenceId: 1, radiansPerSecond: 4 },
      { type: 'attach-spawned-entity', entityOccurrenceId: 1, zOrder: 1 },
    ]);
    assert.equal(plan.commands.some((command) => command.type === 'set-linear-velocity'), false);
    assert.deepEqual(random.calls, []);
  }
});

test('sound gating and Dragon branch preserve recovered omissions', () => {
  assert.equal(soundForTossType(0, true), CLASSIC_FRUIT_TOSS_SOUND);
  assert.equal(soundForTossType(1, true), CLASSIC_BOMB_TOSS_SOUND);
  assert.equal(soundForTossType(0, false), null);
  assert.equal(soundForTossType(1, false), null);
  assert.equal(soundForTossType(3, true), null);
  assert.equal(soundForTossType(4, true), null);
  assert.equal(soundForTossType(6, true), null);

  const random = new ScriptedGameplayRandom();
  const planner = new ClassicSpawnPlanner({ random, sampleKinematics: CONSTANT_KINEMATICS });
  const dragon = planner.planSpawn({
    tossType: 6,
    direction: 0,
    viewport: VIEWPORT,
    effectsEnabled: true,
  });
  assert.equal(dragon.commands[0]?.type, 'create-dragon-fruit');
  assert.equal(dragon.commands.some((command) => command.type === 'play-toss-sound'), false);
  assert.equal(dragon.commands.at(-1)?.type, 'attach-spawned-entity');
});

test('target occurrence IDs are monotonic bookkeeping and consume no gameplay RNG', () => {
  const random = new ScriptedGameplayRandom();
  const planner = new ClassicSpawnPlanner({
    random,
    sampleKinematics: CONSTANT_KINEMATICS,
    firstEntityOccurrenceId: 40,
  });
  const request = {
    tossType: 1 as const,
    direction: 0 as const,
    viewport: VIEWPORT,
    effectsEnabled: false,
  };

  assert.equal(planner.planSpawn(request).entityOccurrenceId, 40);
  assert.equal(planner.planSpawn(request).entityOccurrenceId, 41);
  assert.equal(planner.nextEntityOccurrenceId, 42);
  assert.deepEqual(random.calls, []);
});

test('Free emits one complete create, kinematics, sound, attach sequence', () => {
  const random = new ScriptedGameplayRandom();
  const planner = new ClassicSpawnPlanner({ random, sampleKinematics: CONSTANT_KINEMATICS });
  const free = new ClassicFreeTossStrategy({
    controllerId: 'free-test',
    random,
    interval: { lowSeconds: 1, highSeconds: 1 },
    createTimer: CREATE_REAL_TIMER,
    planner,
    tossType: 1,
    direction: 0,
    viewport: () => VIEWPORT,
    effectsEnabled: () => true,
  });

  const commands = free.performTurn();
  assert.deepEqual(commands.map((command) => command.type), [
    'create-bomb',
    'set-transform',
    'set-linear-velocity',
    'set-angular-velocity',
    'play-toss-sound',
    'attach-spawned-entity',
  ]);
  assert.deepEqual(free.commandLog, commands);
});

test('Concurrent samples inclusive max plus one and keeps five whole sequences contiguous', () => {
  const random = new ScriptedGameplayRandom([5]);
  const planner = new ClassicSpawnPlanner({ random, sampleKinematics: CONSTANT_KINEMATICS });
  const concurrent = new ClassicConcurrentTossStrategy({
    controllerId: 'concurrent-test',
    random,
    interval: { lowSeconds: 1, highSeconds: 1 },
    createTimer: CREATE_REAL_TIMER,
    planner,
    tossType: 1,
    direction: 0,
    viewport: () => VIEWPORT,
    effectsEnabled: () => true,
    countMin: 2,
    countMax: 4,
  });

  const commands = concurrent.performTurn();
  assert.deepEqual(random.calls, ['int:2:5:5']);
  assert.equal(commands.length, 30);
  for (let occurrenceIndex = 0; occurrenceIndex < 5; occurrenceIndex += 1) {
    const occurrenceId = occurrenceIndex + 1;
    const sequence = commands.slice(occurrenceIndex * 6, occurrenceIndex * 6 + 6);
    assert.deepEqual(sequence.map((command) => command.type), [
      'create-bomb',
      'set-transform',
      'set-linear-velocity',
      'set-angular-velocity',
      'play-toss-sound',
      'attach-spawned-entity',
    ]);
    assert.ok(
      sequence.every(
        (command) =>
          'entityOccurrenceId' in command && command.entityOccurrenceId === occurrenceId,
      ),
    );
  }
});

test('Wave setup samples and pauses child, then preserves progress across uncancelled windows', () => {
  const random = new ScriptedGameplayRandom([], [0.2, 0.4, 0.6, 0.8, 0.1, 0.3]);
  const planner = new ClassicSpawnPlanner({ random, sampleKinematics: CONSTANT_KINEMATICS });
  const wave = new ClassicWaveTossStrategy({
    controllerId: 'wave-test',
    random,
    interval: { lowSeconds: 1, highSeconds: 1 },
    createTimer: CREATE_REAL_TIMER,
    planner,
    tossType: 1,
    direction: 0,
    viewport: () => VIEWPORT,
    effectsEnabled: () => false,
    activeWindow: { lowSeconds: 2, highSeconds: 4 },
  });

  assert.deepEqual(wave.setup(), [
    {
      type: 'create-wave-child',
      controllerId: 'wave-test',
      childControllerId: 'wave-test:internal-free',
      tossType: 1,
      direction: 0,
      interval: CLASSIC_WAVE_INTERNAL_INTERVAL,
    },
    {
      type: 'attach-wave-child',
      controllerId: 'wave-test',
      childControllerId: 'wave-test:internal-free',
      zOrder: 1,
    },
    {
      type: 'start-wave-child',
      controllerId: 'wave-test',
      childControllerId: 'wave-test:internal-free',
    },
    {
      type: 'pause-wave-child',
      controllerId: 'wave-test',
      childControllerId: 'wave-test:internal-free',
      reason: 'setup',
    },
  ]);
  assert.deepEqual(wave.childTimerSnapshot(), {
    elapsedSeconds: 0,
    thresholdSeconds: Math.fround(0.35),
    scheduled: false,
  });
  assert.deepEqual(random.calls, ['decile:0.2']);

  wave.start();
  assert.equal(wave.tick(1), false);
  assert.equal(wave.tick(0.1), true);
  assert.deepEqual(wave.pendingPauseRequestIds, [1]);
  assert.equal(wave.tickChild(0.3), false);
  assert.equal(wave.childTimerSnapshot().elapsedSeconds, Math.fround(0.3));

  assert.equal(wave.tick(1.1), true);
  assert.deepEqual(wave.pendingPauseRequestIds, [1, 2]);
  assert.deepEqual(random.calls, [
    'decile:0.2',
    'decile:0.4',
    'decile:0.6',
    'decile:0.8',
    'decile:0.1',
    'decile:0.3',
  ]);
  assert.equal(wave.childTimerSnapshot().elapsedSeconds, Math.fround(0.3));
  assert.equal(wave.childTimerSnapshot().scheduled, true);

  assert.deepEqual(wave.firePauseRequest(1), [{
    type: 'pause-wave-child',
    controllerId: 'wave-test',
    childControllerId: 'wave-test:internal-free',
    reason: 'scheduled',
    pauseRequestId: 1,
  }]);
  assert.deepEqual(wave.pendingPauseRequestIds, [2]);
  assert.equal(wave.childTimerSnapshot().scheduled, false);
  assert.equal(wave.tickChild(1), false);
  assert.equal(wave.childTimerSnapshot().elapsedSeconds, Math.fround(0.3));

  const scheduled = wave.commandLog.filter((command) => command.type === 'schedule-wave-child-pause');
  assert.deepEqual(scheduled, [
    {
      type: 'schedule-wave-child-pause',
      controllerId: 'wave-test',
      childControllerId: 'wave-test:internal-free',
      pauseRequestId: 1,
      delaySeconds: Math.fround(3.6),
    },
    {
      type: 'schedule-wave-child-pause',
      controllerId: 'wave-test',
      childControllerId: 'wave-test:internal-free',
      pauseRequestId: 2,
      delaySeconds: Math.fround(2.6),
    },
  ]);
});
