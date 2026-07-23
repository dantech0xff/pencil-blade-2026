import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
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

const {
  ComboBirdTossCoordinator,
} = await import(
  '../../../game/assets/scripts/domain/combo-bird-toss-coordinator.ts'
);
const {
  COMBO_BIRD_TOSS_OUTER_STOP_ORDER,
  COMBO_BIRD_TOSS_START_ORDER,
  COMBO_BIRD_WAVE_ACTIVE_WINDOW_MAX_SAMPLE_SECONDS,
} = await import(
  '../../../game/assets/scripts/domain/combo-bird-toss-config.ts'
);

class ScriptedRandom {
  readonly calls: string[] = [];
  private readonly deciles: number[];
  private readonly integers: number[];

  constructor(
    deciles: readonly number[] = Array(100).fill(0),
    integers: readonly number[] = [],
  ) {
    this.deciles = [...deciles];
    this.integers = [...integers];
  }

  nextRawNonNegativeInt(): number {
    this.calls.push('raw');
    return 0;
  }

  nextIntInclusive(min: number, max: number): number {
    const value = this.integers.shift() ?? min;
    this.calls.push(`int:${min}:${max}:${value}`);
    return value;
  }

  nextDecile(): number {
    const value = this.deciles.shift();
    if (value === undefined) {
      throw new Error('decile script exhausted');
    }
    this.calls.push(`decile:${value}`);
    return value;
  }
}

class RecordingPlanner {
  readonly random: ScriptedRandom;
  readonly requests: Array<Readonly<{
    direction: number;
    effectsEnabled: boolean;
    tossType: number;
  }>> = [];
  private nextId = 1;

  constructor(random: ScriptedRandom) {
    this.random = random;
  }

  planSpawn(request: Readonly<{
    direction: number;
    effectsEnabled: boolean;
    tossType: number;
  }>) {
    const entityOccurrenceId = this.nextId;
    this.nextId += 1;
    this.requests.push(Object.freeze({
      direction: request.direction,
      effectsEnabled: request.effectsEnabled,
      tossType: request.tossType,
    }));
    return Object.freeze({
      commands: Object.freeze([
        Object.freeze({
          critical: false,
          entityOccurrenceId,
          fruitId: 0,
          tossType: 0,
          type: 'create-fruit',
        }),
      ]),
      entityOccurrenceId,
    });
  }
}

function createCoordinator(
  random = new ScriptedRandom(),
  effectsEnabled: () => boolean = () => false,
) {
  const commands: Array<Readonly<{
    controllerId?: string;
    delaySeconds?: number;
    pauseRequestId?: number;
    type: string;
  }>> = [];
  const planner = new RecordingPlanner(random);
  const coordinator = new ComboBirdTossCoordinator({
    commandSink: (batch) => commands.push(...batch),
    effectsEnabled,
    planner: planner as never,
    random: random as never,
    viewport: () => ({ height: 800, width: 480 }),
  });
  return { commands, coordinator, planner, random };
}

test('construction samples and pauses Wave child before GO-time outer draws', () => {
  const random = new ScriptedRandom([0.9, 0, 0.1, 0.2]);
  const { commands, coordinator } = createCoordinator(random);

  assert.deepEqual(commands.map(({ type }) => type), [
    'create-wave-child',
    'attach-wave-child',
    'start-wave-child',
    'pause-wave-child',
  ]);
  assert.deepEqual(random.calls, ['decile:0.9']);
  const setup = coordinator.controllerSnapshot('wave');
  assert.equal(setup.controller, 'wave');
  assert.equal(setup.childTimer.scheduled, false);
  assert.equal(setup.childTimer.thresholdSeconds, Math.fround(0.7));

  coordinator.startAll();

  assert.deepEqual(random.calls, [
    'decile:0.9',
    'decile:0',
    'decile:0.1',
    'decile:0.2',
  ]);
  assert.deepEqual(coordinator.controlLog, COMBO_BIRD_TOSS_START_ORDER.map(
    (controller) => ({ action: 'start', controller, scope: 'outer' }),
  ));
  assert.equal(
    coordinator.controllerSnapshot('free').timer.thresholdSeconds,
    Math.fround(0.75),
  );
  assert.equal(
    coordinator.controllerSnapshot('wave').timer.thresholdSeconds,
    Math.fround(8.75),
  );
  assert.equal(
    coordinator.controllerSnapshot('concurrent').timer.thresholdSeconds,
    Math.fround(13),
  );
});

test('stopAll stops only Free, Wave, Concurrent outer timers in recovered order', () => {
  const { coordinator, planner, random } = createCoordinator();
  coordinator.startAll();
  const drawsBeforeStop = [...random.calls];

  coordinator.stopAll();

  assert.deepEqual(
    coordinator.controlLog.slice(-COMBO_BIRD_TOSS_OUTER_STOP_ORDER.length),
    COMBO_BIRD_TOSS_OUTER_STOP_ORDER.map(
      (controller) => ({ action: 'stop', controller, scope: 'outer' }),
    ),
  );
  for (const controller of COMBO_BIRD_TOSS_OUTER_STOP_ORDER) {
    assert.equal(coordinator.controllerSnapshot(controller).timer.scheduled, false);
  }
  coordinator.tick(100);
  assert.deepEqual(planner.requests, []);
  assert.deepEqual(random.calls, drawsBeforeStop);
});

test('Concurrent constructor maximum 3 retains actual inclusive output 4', () => {
  const random = new ScriptedRandom([0, 0, 0], [4]);
  const { coordinator, planner } = createCoordinator(random);
  coordinator.startController('concurrent');

  coordinator.tick(10.01);

  assert.equal(planner.requests.length, 4);
  assert.equal(planner.requests.every((request) => (
    request.direction === 0 && request.tossType === 0
  )), true);
  assert.deepEqual(random.calls, [
    'decile:0',
    'decile:0',
    'decile:0',
    'int:1:4:4',
  ]);
});

test('an active Wave child survives outer stop only until its pre-armed pause', () => {
  const random = new ScriptedRandom([
    0, // setup child threshold 0.25
    0, // Wave outer Start threshold 7.5
    0, // Wave outer rearm before callback
    0.9, // active window: recovered maximum 2.85
    0, // child rearm after same-frame spawn
    0, // child rearm during Time Up
    0, // child rearm before its pause
  ]);
  const { commands, coordinator, planner } = createCoordinator(random);
  coordinator.startController('wave');
  coordinator.tick(7.51);

  const schedule = commands.find(
    ({ type }) => type === 'schedule-wave-child-pause',
  );
  assert.equal(
    schedule?.delaySeconds,
    COMBO_BIRD_WAVE_ACTIVE_WINDOW_MAX_SAMPLE_SECONDS,
  );
  assert.equal(planner.requests.length, 1);
  assert.equal(coordinator.snapshot.pendingWavePauseCount, 1);

  coordinator.stopAll();
  const stopped = coordinator.controllerSnapshot('wave');
  assert.equal(stopped.controller, 'wave');
  assert.equal(stopped.timer.scheduled, false);
  assert.equal(stopped.childTimer.scheduled, true);
  assert.equal(stopped.pendingPauseRequestIds.length, 1);

  coordinator.tick(0.26);
  coordinator.tick(2.58);
  assert.equal(planner.requests.length, 3);
  assert.equal(coordinator.snapshot.pendingWavePauseCount, 1);

  coordinator.tick(0.02);
  const paused = coordinator.controllerSnapshot('wave');
  assert.equal(paused.controller, 'wave');
  assert.equal(paused.timer.scheduled, false);
  assert.equal(paused.childTimer.scheduled, false);
  assert.equal(paused.pendingPauseRequestIds.length, 0);
  assert.equal(coordinator.snapshot.pendingWavePauseCount, 0);

  coordinator.tick(100);
  assert.equal(planner.requests.length, 3);
  assert.equal(
    commands.filter(({ type }) => type === 'pause-wave-child').at(-1)?.pauseRequestId,
    schedule?.pauseRequestId,
  );
});

test('coordinator rejects mismatched RNG ownership and invalid scheduler delta', () => {
  const random = new ScriptedRandom();
  assert.throws(() => new ComboBirdTossCoordinator({
    effectsEnabled: () => false,
    planner: new RecordingPlanner(new ScriptedRandom()) as never,
    random: random as never,
    viewport: () => ({ height: 800, width: 480 }),
  }), /share the same GameplayRandom/);

  const { coordinator } = createCoordinator();
  assert.throws(() => coordinator.tick(-1), /finite and non-negative/);
});
