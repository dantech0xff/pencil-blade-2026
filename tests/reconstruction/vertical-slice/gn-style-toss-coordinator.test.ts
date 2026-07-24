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
  GnStyleTossCoordinator,
} = await import(
  '../../../game/assets/scripts/domain/gn-style-toss-coordinator.ts'
);
const {
  GN_STYLE_TOSS_OUTER_STOP_ORDER,
  GN_STYLE_TOSS_START_ORDER,
  GN_STYLE_WAVE_ACTIVE_WINDOW_MAX_SAMPLE_SECONDS,
} = await import(
  '../../../game/assets/scripts/domain/gn-style-toss-config.ts'
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
  timeline: string[] = [],
) {
  const commands: Array<Readonly<{
    controllerId?: string;
    delaySeconds?: number;
    pauseRequestId?: number;
    type: string;
  }>> = [];
  const planner = new RecordingPlanner(random);
  const coordinator = new GnStyleTossCoordinator({
    commandSink: (batch) => {
      commands.push(...batch);
      timeline.push(...batch.map(({ type }) => `toss:${type}`));
    },
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
  assert.deepEqual(coordinator.controlLog, GN_STYLE_TOSS_START_ORDER.map(
    (controller) => ({ action: 'start', controller, scope: 'outer' }),
  ));
  assert.equal(
    coordinator.controllerSnapshot('free').timer.thresholdSeconds,
    Math.fround(0.5),
  );
  assert.equal(
    coordinator.controllerSnapshot('wave').timer.thresholdSeconds,
    Math.fround(3.95),
  );
  assert.equal(
    coordinator.controllerSnapshot('concurrent').timer.thresholdSeconds,
    Math.fround(4.2),
  );
});

test('running-frame seam advances the coordinator before its TimeManager consumer', () => {
  const timeline: string[] = [];
  const { coordinator } = createCoordinator(
    new ScriptedRandom([0, 0, 0, 0]),
    () => false,
    timeline,
  );
  coordinator.startController('free');
  timeline.length = 0;

  coordinator.tickBeforeTimeManager(0.51, (deltaSeconds) => {
    timeline.push(`timer:${String(deltaSeconds)}`);
  });

  const tossIndex = timeline.indexOf('toss:create-fruit');
  const timerIndex = timeline.indexOf('timer:0.51');
  assert.notEqual(tossIndex, -1);
  assert.equal(tossIndex < timerIndex, true);
});

test('stopAll stops only Free, Wave, Concurrent outer timers in recovered order', () => {
  const { coordinator, planner, random } = createCoordinator();
  coordinator.startAll();
  const drawsBeforeStop = [...random.calls];

  coordinator.stopAll();

  assert.deepEqual(
    coordinator.controlLog.slice(-GN_STYLE_TOSS_OUTER_STOP_ORDER.length),
    GN_STYLE_TOSS_OUTER_STOP_ORDER.map(
      (controller) => ({ action: 'stop', controller, scope: 'outer' }),
    ),
  );
  for (const controller of GN_STYLE_TOSS_OUTER_STOP_ORDER) {
    assert.equal(coordinator.controllerSnapshot(controller).timer.scheduled, false);
  }
  coordinator.tick(100);
  assert.deepEqual(planner.requests, []);
  assert.deepEqual(random.calls, drawsBeforeStop);
});

test('Concurrent constructor maximum 6 retains actual inclusive output 7', () => {
  const random = new ScriptedRandom([0, 0, 0], [7]);
  const { coordinator, planner } = createCoordinator(random);
  coordinator.startController('concurrent');

  coordinator.tick(3.01);

  assert.equal(planner.requests.length, 7);
  assert.equal(planner.requests.every((request) => (
    request.direction === 0 && request.tossType === 0
  )), true);
  assert.deepEqual(random.calls, [
    'decile:0',
    'decile:0',
    'decile:0',
    'int:3:7:7',
  ]);
});

test('an active Wave child survives outer stop only until its pre-armed pause', () => {
  const random = new ScriptedRandom([
    0, // setup child threshold 0.25
    0, // Wave outer Start threshold 3.5
    0, // Wave outer rearm before callback
    0.9, // active window: recovered maximum 5.55
    0, // child rearm after same-frame spawn
    0, // child rearm during Time Up
    0, // child rearm before its pause
  ]);
  const { commands, coordinator, planner } = createCoordinator(random);
  coordinator.startController('wave');
  coordinator.tick(3.51);

  const schedule = commands.find(
    ({ type }) => type === 'schedule-wave-child-pause',
  );
  assert.equal(
    schedule?.delaySeconds,
    GN_STYLE_WAVE_ACTIVE_WINDOW_MAX_SAMPLE_SECONDS,
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
  coordinator.tick(5.28);
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

test('a scheduled Wave pause sink failure cannot retain an already-consumed request', () => {
  const random = new ScriptedRandom([
    0, // setup child threshold 0.25
    0, // Wave outer Start threshold 3.5
    0, // Wave outer rearm
    0.9, // recovered maximum active window 5.55
    0, // child rearm after the same-frame spawn
  ]);
  const planner = new RecordingPlanner(random);
  let rejectScheduledPause = false;
  const coordinator = new GnStyleTossCoordinator({
    commandSink: (batch) => {
      if (
        rejectScheduledPause
        && batch.some((command) => (
          command.type === 'pause-wave-child'
          && command.reason === 'scheduled'
        ))
      ) {
        throw new Error('injected scheduled Wave pause sink failure');
      }
    },
    effectsEnabled: () => false,
    planner: planner as never,
    random: random as never,
    viewport: () => ({ height: 800, width: 480 }),
  });
  coordinator.startController('wave');
  coordinator.tick(3.51);
  assert.equal(coordinator.snapshot.pendingWavePauseCount, 1);
  assert.equal(
    coordinator.controllerSnapshot('wave').pendingPauseRequestIds.length,
    1,
  );

  rejectScheduledPause = true;
  assert.throws(
    () => coordinator.tick(5.56),
    /injected scheduled Wave pause sink failure/,
  );
  assert.equal(coordinator.snapshot.pendingWavePauseCount, 0);
  const afterFailure = coordinator.controllerSnapshot('wave');
  assert.equal(afterFailure.pendingPauseRequestIds.length, 0);
  assert.equal(afterFailure.childTimer.scheduled, false);

  rejectScheduledPause = false;
  let timeManagerTicks = 0;
  coordinator.tickBeforeTimeManager(0.01, () => {
    timeManagerTicks += 1;
  });
  assert.equal(timeManagerTicks, 1);
  assert.equal(coordinator.snapshot.pendingWavePauseCount, 0);
});

test('coordinator rejects mismatched RNG ownership and invalid frame inputs', () => {
  const random = new ScriptedRandom();
  assert.throws(() => new GnStyleTossCoordinator({
    effectsEnabled: () => false,
    planner: new RecordingPlanner(new ScriptedRandom()) as never,
    random: random as never,
    viewport: () => ({ height: 800, width: 480 }),
  }), /share the same GameplayRandom/);

  const { coordinator } = createCoordinator();
  assert.throws(() => coordinator.tick(-1), /finite and non-negative/);
  assert.throws(
    () => coordinator.tickBeforeTimeManager(1, null as never),
    /tickTimeManager must be a function/,
  );
});
