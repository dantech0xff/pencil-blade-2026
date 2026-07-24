import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  BONUS_TOSS_AUDIO_PATH,
  BONUS_TOSS_CANDIDATE_FRUIT_IDS,
  BonusTossStrategy,
  type BonusTossFruitId,
  type BonusTossStatePort,
} from '../../../game/assets/scripts/domain/bonus-toss-strategy.ts';
import {
  DOUBLE_TOSS_CHILD_INTERVAL,
  DOUBLE_TOSS_LOOP_AUDIO_PATH,
  DOUBLE_TOSS_STRUM_AUDIO_PATH,
  DoubleTossStrategy,
} from '../../../game/assets/scripts/domain/double-toss-strategy.ts';
import type { GameplayRandom } from '../../../game/assets/scripts/domain/gameplay-random.ts';
import type { TossStrategyTimerFactory } from '../../../game/assets/scripts/domain/classic-toss-strategies.ts';
import { TossTimer } from '../../../game/assets/scripts/domain/toss-timer.ts';

const DOUBLE_TOSS_SOURCE = readFileSync(
  fileURLToPath(new URL(
    '../../../game/assets/scripts/domain/double-toss-strategy.ts',
    import.meta.url,
  )),
  'utf8',
);

class ScriptedGameplayRandom implements GameplayRandom {
  readonly calls: string[] = [];
  private readonly deciles: number[];
  private readonly integers: number[];
  private readonly sharedEvents: string[] | null;

  constructor(
    integers: readonly number[] = [],
    deciles: readonly number[] = [],
    sharedEvents: string[] | null = null,
  ) {
    this.integers = [...integers];
    this.deciles = [...deciles];
    this.sharedEvents = sharedEvents;
  }

  nextRawNonNegativeInt(): number {
    this.calls.push('raw');
    this.sharedEvents?.push('raw');
    return 0;
  }

  nextIntInclusive(min: number, max: number): number {
    const value = this.integers.shift();
    if (value === undefined) {
      throw new Error(`scripted integer RNG exhausted for [${min}, ${max}]`);
    }
    const event = `int:${min}:${max}:${value}`;
    this.calls.push(event);
    this.sharedEvents?.push(event);
    return value;
  }

  nextDecile(): number {
    const value = this.deciles.shift();
    if (value === undefined) {
      throw new Error('scripted decile RNG exhausted');
    }
    const event = `decile:${value}`;
    this.calls.push(event);
    this.sharedEvents?.push(event);
    return value;
  }
}

class TrackingBonusState implements BonusTossStatePort {
  readonly calls: BonusTossFruitId[] = [];
  private readonly enabled: ReadonlySet<BonusTossFruitId>;
  private readonly sharedEvents: string[] | null;

  constructor(
    enabled: readonly BonusTossFruitId[],
    sharedEvents: string[] | null = null,
  ) {
    this.enabled = new Set(enabled);
    this.sharedEvents = sharedEvents;
  }

  isEnabled(bonusId: BonusTossFruitId): boolean {
    this.calls.push(bonusId);
    this.sharedEvents?.push(`enabled:${bonusId}`);
    return this.enabled.has(bonusId);
  }
}

const CREATE_REAL_TIMER: TossStrategyTimerFactory = (options) => new TossTimer(options);
const BONUS_INTERVAL = Object.freeze({ lowSeconds: 5, highSeconds: 30 });

function createDouble(
  random: GameplayRandom,
  effectsEnabled: () => boolean = () => true,
): DoubleTossStrategy {
  return new DoubleTossStrategy({
    controllerId: 'crazy:b4',
    createTimer: CREATE_REAL_TIMER,
    effectsEnabled,
    random,
  });
}

function createBonus(
  random: GameplayRandom,
  bonusState: BonusTossStatePort,
  effectsEnabled: () => boolean = () => true,
  firstEntityOccurrenceId = 1,
): BonusTossStrategy {
  return new BonusTossStrategy({
    bonusState,
    controllerId: 'crazy:b5',
    createTimer: CREATE_REAL_TIMER,
    effectsEnabled,
    firstEntityOccurrenceId,
    interval: BONUS_INTERVAL,
    random,
  });
}

test('Double pending Set snapshots use Array.from before Creator loose-build iteration', () => {
  assert.equal(
    DOUBLE_TOSS_SOURCE.split('Array.from(this.pendingStopRequests)').length - 1,
    1,
  );
  assert.equal(
    DOUBLE_TOSS_SOURCE.includes('[...this.pendingStopRequests]'),
    false,
  );
});

test('Double setup creates and attaches Left then Right type-0 Free children', () => {
  const strategy = createDouble(new ScriptedGameplayRandom());
  const commands = strategy.setup();

  assert.deepEqual(commands, [
    {
      type: 'create-double-free-child',
      controllerId: 'crazy:b4',
      child: {
        childControllerId: 'crazy:b4:left-free',
        direction: 2,
        interval: { lowSeconds: 0.75, highSeconds: 1.5 },
        side: 'left',
        tossType: 0,
        zOrder: 1,
      },
    },
    {
      type: 'attach-double-free-child',
      controllerId: 'crazy:b4',
      childControllerId: 'crazy:b4:left-free',
      side: 'left',
      zOrder: 1,
    },
    {
      type: 'create-double-free-child',
      controllerId: 'crazy:b4',
      child: {
        childControllerId: 'crazy:b4:right-free',
        direction: 3,
        interval: { lowSeconds: 0.75, highSeconds: 1.5 },
        side: 'right',
        tossType: 0,
        zOrder: 1,
      },
    },
    {
      type: 'attach-double-free-child',
      controllerId: 'crazy:b4',
      childControllerId: 'crazy:b4:right-free',
      side: 'right',
      zOrder: 1,
    },
  ]);
  assert.equal(Object.isFrozen(commands), true);
  assert.equal(commands.every(Object.isFrozen), true);
  assert.equal(Object.isFrozen(DOUBLE_TOSS_CHILD_INTERVAL), true);
  assert.throws(() => strategy.setup(), /already set up/);
});

test('Double first Start consumes base/Left/Right draws and repeats as a true no-op', () => {
  const events: string[] = [];
  const random = new ScriptedGameplayRandom([], [0.4, 0.2, 0.6], events);
  const strategy = createDouble(random, () => {
    events.push('effects');
    return true;
  });
  strategy.setup();

  const commands = strategy.start();
  assert.deepEqual(events, [
    'effects',
    'decile:0.4',
    'decile:0.2',
    'decile:0.6',
  ]);
  assert.deepEqual(commands, [
    { type: 'start-double-base-timer', controllerId: 'crazy:b4' },
    {
      type: 'request-double-toss-strum-audio',
      canonicalPath: DOUBLE_TOSS_STRUM_AUDIO_PATH,
      loop: false,
    },
    {
      type: 'request-double-toss-loop-audio',
      canonicalPath: DOUBLE_TOSS_LOOP_AUDIO_PATH,
      loop: true,
    },
    {
      type: 'start-double-free-child',
      controllerId: 'crazy:b4',
      childControllerId: 'crazy:b4:left-free',
      side: 'left',
    },
    {
      type: 'start-double-free-child',
      controllerId: 'crazy:b4',
      childControllerId: 'crazy:b4:right-free',
      side: 'right',
    },
    {
      type: 'schedule-double-toss-stop',
      controllerId: 'crazy:b4',
      delaySeconds: 15,
      stopRequestId: 1,
      uncancelledByPauseOrStop: true,
    },
  ]);
  assert.equal(strategy.active, true);
  assert.deepEqual(strategy.pendingStopRequestIds, [1]);

  const repeated = strategy.start();
  assert.deepEqual(repeated, []);
  assert.equal(Object.isFrozen(repeated), true);
  assert.deepEqual(events, [
    'effects',
    'decile:0.4',
    'decile:0.2',
    'decile:0.6',
  ]);
});

test('Double zero-limit base perturbs RNG per positive tick while child rearms before turn', () => {
  const random = new ScriptedGameplayRandom([], [
    0,
    0,
    0,
    0.1,
    0.2,
  ]);
  const strategy = createDouble(random, () => false);
  strategy.setup();
  strategy.start();
  const commandCountAfterStart = strategy.commandLog.length;

  assert.equal(strategy.tickBase(0), false);
  assert.equal(strategy.tickBase(0.01), true);
  assert.equal(strategy.commandLog.length, commandCountAfterStart);
  assert.equal(strategy.tickChild('left', 0.75), false);
  assert.equal(strategy.tickChild('left', 0.01), true);
  assert.equal(strategy.commandLog.at(-1)?.type, 'request-double-free-child-turn');
  assert.deepEqual(random.calls, [
    'decile:0',
    'decile:0',
    'decile:0',
    'decile:0.1',
    'decile:0.2',
  ]);
});

test('Double Pause/Resume forward base, Left, Right and preserve timer state', () => {
  const strategy = createDouble(new ScriptedGameplayRandom([], [0, 0, 0]), () => false);
  strategy.setup();
  strategy.start();

  assert.deepEqual(strategy.pause().map((command) => command.type), [
    'pause-double-base-timer',
    'pause-double-free-child',
    'pause-double-free-child',
  ]);
  assert.equal(strategy.snapshot().baseTimer.scheduled, false);
  assert.equal(strategy.snapshot().leftChildTimer?.scheduled, false);
  assert.equal(strategy.snapshot().rightChildTimer?.scheduled, false);

  assert.deepEqual(strategy.resume().map((command) => command.type), [
    'resume-double-base-timer',
    'resume-double-free-child',
    'resume-double-free-child',
  ]);
  assert.equal(strategy.snapshot().baseTimer.scheduled, true);
  assert.equal(strategy.snapshot().leftChildTimer?.scheduled, true);
  assert.equal(strategy.snapshot().rightChildTimer?.scheduled, true);
});

test('Double Stop preserves uncancelled callbacks and an old callback stops a newer run', () => {
  const strategy = createDouble(
    new ScriptedGameplayRandom([], [0, 0, 0, 0, 0, 0]),
  );
  strategy.setup();
  strategy.start();

  assert.deepEqual(strategy.stop().map((command) => command.type), [
    'stop-double-base-timer',
    'stop-double-free-child',
    'stop-double-free-child',
    'stop-double-toss-loop-audio',
    'request-double-toss-strum-audio',
    'disable-bonus',
  ]);
  assert.deepEqual(strategy.pendingStopRequestIds, [1]);
  assert.deepEqual(strategy.commandLog.at(-1), {
    type: 'disable-bonus',
    bonusId: 11,
  });

  strategy.start();
  assert.deepEqual(strategy.pendingStopRequestIds, [1, 2]);
  strategy.fireStopRequest(1);
  assert.equal(strategy.active, false);
  assert.deepEqual(strategy.pendingStopRequestIds, [2]);
  assert.throws(() => strategy.fireStopRequest(1), /unknown or already-fired/);
});

test('Double effects gate both strums and loop start but never loop stop or bonus disable', () => {
  const strategy = createDouble(
    new ScriptedGameplayRandom([], [0, 0, 0]),
    () => false,
  );
  strategy.setup();

  assert.deepEqual(strategy.start().map((command) => command.type), [
    'start-double-base-timer',
    'start-double-free-child',
    'start-double-free-child',
    'schedule-double-toss-stop',
  ]);
  assert.deepEqual(strategy.stop().map((command) => command.type), [
    'stop-double-base-timer',
    'stop-double-free-child',
    'stop-double-free-child',
    'stop-double-toss-loop-audio',
    'disable-bonus',
  ]);
});

test('Double rejects invalid setup, side, callback, effects, and timer inputs', () => {
  const strategy = createDouble(new ScriptedGameplayRandom([], [0, 0, 0]));
  assert.throws(() => strategy.start(), /setup/);
  strategy.setup();
  assert.throws(() => strategy.tickChild('up' as never, 1), /left or right/);
  assert.throws(() => strategy.tickBase(Number.NaN), /finite/);
  assert.throws(() => strategy.fireStopRequest(0), /positive safe integer/);
  assert.throws(() => strategy.fireStopRequest(99), /unknown/);

  const invalidEffects = createDouble(
    new ScriptedGameplayRandom([], [0]),
    (() => 'yes') as never,
  );
  invalidEffects.setup();
  assert.throws(() => invalidEffects.start(), /must return a boolean/);
  assert.deepEqual(invalidEffects.snapshot(), {
    active: false,
    baseTimer: {
      elapsedSeconds: 0,
      scheduled: false,
      thresholdSeconds: null,
    },
    leftChildTimer: {
      elapsedSeconds: 0,
      scheduled: false,
      thresholdSeconds: null,
    },
    pendingStopRequestIds: [],
    rightChildTimer: {
      elapsedSeconds: 0,
      scheduled: false,
      thresholdSeconds: null,
    },
    setupComplete: true,
  });
  assert.equal(invalidEffects.commandLog.length, 4);

  assert.throws(() => new DoubleTossStrategy({
    controllerId: '',
    createTimer: CREATE_REAL_TIMER,
    effectsEnabled: () => true,
    random: new ScriptedGameplayRandom(),
  }), /non-empty string/);
});

test('Double invalid effects on Stop preserves the complete active run for retry', () => {
  let effectsResult: unknown = true;
  const strategy = createDouble(
    new ScriptedGameplayRandom([], [0, 0, 0]),
    (() => effectsResult) as never,
  );
  strategy.setup();
  strategy.start();
  const before = strategy.snapshot();
  const commandCount = strategy.commandLog.length;

  effectsResult = 'invalid';
  assert.throws(() => strategy.stop(), /must return a boolean/);
  assert.deepEqual(strategy.snapshot(), before);
  assert.equal(strategy.commandLog.length, commandCount);
});

test('Bonus all-enabled path performs no random draw, allocation, effect read, or command', () => {
  assert.deepEqual(BONUS_TOSS_CANDIDATE_FRUIT_IDS, [12, 10, 11]);
  const random = new ScriptedGameplayRandom();
  const state = new TrackingBonusState([12, 10, 11]);
  const strategy = createBonus(random, state, () => {
    throw new Error('effects must not be read');
  }, 40);

  const commands = strategy.performTurn();
  assert.deepEqual(commands, []);
  assert.equal(Object.isFrozen(commands), true);
  assert.deepEqual(random.calls, []);
  assert.deepEqual(state.calls, [12, 10, 11]);
  assert.equal(strategy.nextEntityOccurrenceId, 40);
  assert.deepEqual(strategy.commandLog, []);
});

test('Bonus retries enabled candidates then emits create/randomize/attach/enable/audio', () => {
  const random = new ScriptedGameplayRandom([0, 1, 2, 3]);
  const state = new TrackingBonusState([12, 10]);
  const strategy = createBonus(random, state, () => true, 7);

  const commands = strategy.performTurn();
  assert.deepEqual(random.calls, [
    'int:0:2:0',
    'int:0:2:1',
    'int:0:2:2',
    'int:0:3:3',
  ]);
  assert.deepEqual(state.calls, [12, 10, 11, 12, 10, 11]);
  assert.deepEqual(commands, [
    {
      type: 'create-bonus-fruit',
      controllerId: 'crazy:b5',
      entityOccurrenceId: 7,
      fruitId: 11,
      tossType: 5,
    },
    {
      type: 'randomize-bonus-fruit',
      controllerId: 'crazy:b5',
      direction: 1,
      entityOccurrenceId: 7,
    },
    {
      type: 'attach-bonus-fruit',
      controllerId: 'crazy:b5',
      entityOccurrenceId: 7,
      zOrder: 1,
    },
    { type: 'enable-bonus', bonusId: 11, entityOccurrenceId: 7 },
    {
      type: 'request-bonus-toss-audio',
      canonicalPath: BONUS_TOSS_AUDIO_PATH,
      entityOccurrenceId: 7,
      loop: false,
    },
  ]);
  assert.equal(Object.isFrozen(commands), true);
  assert.equal(commands.every(Object.isFrozen), true);
  assert.equal(strategy.nextEntityOccurrenceId, 8);
});

test('Bonus maps direction draws 0/1/2/3 to Left/Right/Down/Down', () => {
  const expectedDirections = [2, 3, 1, 1];

  expectedDirections.forEach((expectedDirection, directionDraw) => {
    const strategy = createBonus(
      new ScriptedGameplayRandom([0, directionDraw]),
      new TrackingBonusState([]),
      () => false,
    );
    const commands = strategy.performTurn();
    assert.deepEqual(commands.map((command) => command.type), [
      'create-bonus-fruit',
      'randomize-bonus-fruit',
      'attach-bonus-fruit',
      'enable-bonus',
    ]);
    assert.deepEqual(commands[1], {
      type: 'randomize-bonus-fruit',
      controllerId: 'crazy:b5',
      direction: expectedDirection,
      entityOccurrenceId: 1,
    });
  });
});

test('Bonus timer rearm draw precedes candidate and direction draws', () => {
  const events: string[] = [];
  const random = new ScriptedGameplayRandom([0, 1], [0, 0.5], events);
  const state = new TrackingBonusState([], events);
  const strategy = createBonus(random, state, () => {
    events.push('effects');
    return false;
  });

  strategy.start();
  assert.equal(strategy.tick(5), false);
  assert.equal(strategy.tick(0.01), true);
  assert.deepEqual(events, [
    'decile:0',
    'decile:0.5',
    'enabled:12',
    'int:0:2:0',
    'enabled:12',
    'int:0:3:1',
    'effects',
  ]);
  assert.equal(strategy.timerSnapshot().thresholdSeconds, Math.fround(17.5));
});

test('Bonus validates interval, state/effects results, and both inclusive draws', () => {
  assert.throws(() => new BonusTossStrategy({
    bonusState: new TrackingBonusState([]),
    controllerId: 'crazy:b5',
    createTimer: CREATE_REAL_TIMER,
    effectsEnabled: () => true,
    interval: { lowSeconds: 2, highSeconds: 1 },
    random: new ScriptedGameplayRandom(),
  }), /0 <= lowSeconds <= highSeconds/);

  const badState = createBonus(
    new ScriptedGameplayRandom(),
    { isEnabled: (() => 1) as never },
  );
  assert.throws(() => badState.performTurn(), /must return a boolean/);

  const badCandidate = createBonus(
    new ScriptedGameplayRandom([3]),
    new TrackingBonusState([]),
  );
  assert.throws(() => badCandidate.performTurn(), /outside \[0, 2\]/);

  const badDirection = createBonus(
    new ScriptedGameplayRandom([0, 1.5]),
    new TrackingBonusState([]),
  );
  assert.throws(() => badDirection.performTurn(), /safe integer/);

  const badEffects = createBonus(
    new ScriptedGameplayRandom([0, 0]),
    new TrackingBonusState([]),
    (() => 'yes') as never,
  );
  assert.throws(() => badEffects.performTurn(), /must return a boolean/);
});
