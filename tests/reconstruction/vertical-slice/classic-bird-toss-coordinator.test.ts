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
  ClassicBirdTossCoordinator,
} = await import(
  '../../../game/assets/scripts/domain/classic-bird-toss-coordinator.ts'
);
const {
  CLASSIC_BIRD_MAGNET_BOMB_CONTROLLER_ORDER,
  CLASSIC_BIRD_MAGNET_NORMAL_FRUIT_INTERVAL,
  CLASSIC_BIRD_NORMAL_FRUIT_INTERVAL,
  CLASSIC_BIRD_TOSS_START_ORDER,
  CLASSIC_BIRD_TOSS_STOP_ORDER,
} = await import(
  '../../../game/assets/scripts/domain/classic-bird-toss-config.ts'
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
      entityOccurrenceId,
      commands: Object.freeze([Object.freeze(
        request.tossType === 1
          ? {
              bombId: 0 as const,
              entityOccurrenceId,
              tossType: 1 as const,
              type: 'create-bomb' as const,
            }
          : request.tossType === 6
            ? {
                entityOccurrenceId,
                tossType: 6 as const,
                type: 'create-dragon-fruit' as const,
              }
            : {
                critical: false,
                entityOccurrenceId,
                fruitId: request.tossType === 3
                  ? 13
                  : request.tossType === 4
                    ? 14
                    : 0,
                tossType: request.tossType as 0 | 3 | 4,
                type: 'create-fruit' as const,
              },
      )]),
    });
  }
}

function createCoordinator(
  random = new ScriptedRandom(),
  effectsEnabled: () => boolean = () => false,
) {
  const commands: Array<Readonly<{
    childControllerId?: string;
    controllerId?: string;
    type: string;
  }>> = [];
  const planner = new RecordingPlanner(random);
  const coordinator = new ClassicBirdTossCoordinator({
    commandSink: (batch) => commands.push(...batch),
    effectsEnabled,
    planner: planner as never,
    random: random as never,
    viewport: () => ({ height: 800, width: 480 }),
  });
  return { commands, coordinator, planner, random };
}

test('constructor starts and pauses normal Wave child before bomb Wave child', () => {
  const { commands, coordinator, random } = createCoordinator();

  assert.deepEqual(commands.map(({ type }) => type), [
    'create-wave-child',
    'attach-wave-child',
    'start-wave-child',
    'pause-wave-child',
    'create-wave-child',
    'attach-wave-child',
    'start-wave-child',
    'pause-wave-child',
  ]);
  assert.deepEqual(commands
    .filter(({ type }) => type === 'create-wave-child')
    .map(({ controllerId, childControllerId }) => ({
      childControllerId,
      controllerId,
    })), [
    { childControllerId: 'ac:internal-free', controllerId: 'ac' },
    { childControllerId: 'af:internal-free', controllerId: 'af' },
  ]);
  assert.deepEqual(random.calls, ['decile:0', 'decile:0']);
  assert.equal(coordinator.controllerSnapshot('ac').controller, 'wave');
  assert.equal(coordinator.controllerSnapshot('af').controller, 'wave');
});

test('startAll and stopAll retain the recovered RNG/control order', () => {
  const { coordinator, random } = createCoordinator();

  coordinator.startAll();
  assert.deepEqual(
    coordinator.controlLog,
    CLASSIC_BIRD_TOSS_START_ORDER.map((controller) => ({
      action: 'start',
      controller,
    })),
  );
  assert.deepEqual(random.calls, Array(11).fill('decile:0'));
  for (const controller of CLASSIC_BIRD_TOSS_START_ORDER) {
    assert.equal(timerFor(coordinator.controllerSnapshot(controller)).scheduled, true);
  }

  coordinator.stopAll();
  assert.deepEqual(
    coordinator.controlLog.slice(-CLASSIC_BIRD_TOSS_STOP_ORDER.length),
    CLASSIC_BIRD_TOSS_STOP_ORDER.map((controller) => ({
      action: 'stop',
      controller,
    })),
  );
  for (const controller of CLASSIC_BIRD_TOSS_STOP_ORDER) {
    assert.equal(timerFor(coordinator.controllerSnapshot(controller)).scheduled, false);
  }
});

test('Down controllers preserve Dragon, magnet ID14, and electric ID13 types', () => {
  const { coordinator, planner } = createCoordinator();
  coordinator.startController('b0');
  coordinator.startController('b1');
  coordinator.startController('b2');

  coordinator.tick(90);

  assert.deepEqual(planner.requests, [
    { direction: 1, effectsEnabled: false, tossType: 6 },
    { direction: 1, effectsEnabled: false, tossType: 4 },
    { direction: 1, effectsEnabled: false, tossType: 3 },
  ]);
});

test('magnet mutates future normal samples without resampling and preserves bomb state', () => {
  const { coordinator, random } = createCoordinator();
  coordinator.startAll();
  coordinator.tick(0.25);
  const normalBefore = timerFor(coordinator.controllerSnapshot('aa'));
  const bombBefore = new Map(CLASSIC_BIRD_MAGNET_BOMB_CONTROLLER_ORDER.map(
    (controller) => [controller, timerFor(coordinator.controllerSnapshot(controller))],
  ));
  const drawsBefore = random.calls.length;

  coordinator.magnetBegin();

  assert.deepEqual(
    coordinator.snapshot.normalFruitInterval,
    CLASSIC_BIRD_MAGNET_NORMAL_FRUIT_INTERVAL,
  );
  assert.equal(random.calls.length, drawsBefore);
  assert.deepEqual(timerFor(coordinator.controllerSnapshot('aa')), normalBefore);
  assert.deepEqual(
    coordinator.controlLog.slice(-3),
    CLASSIC_BIRD_MAGNET_BOMB_CONTROLLER_ORDER.map((controller) => ({
      action: 'pause',
      controller,
    })),
  );
  for (const controller of CLASSIC_BIRD_MAGNET_BOMB_CONTROLLER_ORDER) {
    const paused = timerFor(coordinator.controllerSnapshot(controller));
    assert.equal(paused.scheduled, false);
    assert.equal(paused.elapsedSeconds, bombBefore.get(controller)?.elapsedSeconds);
    assert.equal(paused.thresholdSeconds, bombBefore.get(controller)?.thresholdSeconds);
  }

  coordinator.magnetEnd();

  assert.deepEqual(
    coordinator.snapshot.normalFruitInterval,
    CLASSIC_BIRD_NORMAL_FRUIT_INTERVAL,
  );
  assert.equal(random.calls.length, drawsBefore);
  assert.deepEqual(timerFor(coordinator.controllerSnapshot('aa')), normalBefore);
  assert.deepEqual(
    coordinator.controlLog.slice(-3),
    CLASSIC_BIRD_MAGNET_BOMB_CONTROLLER_ORDER.map((controller) => ({
      action: 'resume',
      controller,
    })),
  );
  for (const controller of CLASSIC_BIRD_MAGNET_BOMB_CONTROLLER_ORDER) {
    const resumed = timerFor(coordinator.controllerSnapshot(controller));
    assert.equal(resumed.scheduled, true);
    assert.equal(resumed.elapsedSeconds, bombBefore.get(controller)?.elapsedSeconds);
    assert.equal(resumed.thresholdSeconds, bombBefore.get(controller)?.thresholdSeconds);
  }
});

test('magnet override is used only by the next normal Free rearm', () => {
  const random = new ScriptedRandom([
    0, 0, // Wave child entry.
    0, 0, 0, 0, // normal Free and three bomb starts.
    0.9, // normal Free rearm while magnet is active.
  ]);
  const { coordinator } = createCoordinator(random);
  coordinator.startController('aa');
  coordinator.startController('ad');
  coordinator.startController('ae');
  coordinator.startController('af');
  const originalThreshold = timerFor(
    coordinator.controllerSnapshot('aa'),
  ).thresholdSeconds;

  coordinator.magnetBegin();
  assert.equal(
    timerFor(coordinator.controllerSnapshot('aa')).thresholdSeconds,
    originalThreshold,
  );
  coordinator.tick(0.76);
  assert.equal(
    timerFor(coordinator.controllerSnapshot('aa')).thresholdSeconds,
    Math.fround(0.5 + Math.fround(0.9) * (1.5 - 0.5)),
  );

  const callsBeforeEnd = [...random.calls];
  coordinator.magnetEnd();
  assert.deepEqual(random.calls, callsBeforeEnd);
});

test('cleanup restores normal bounds without resuming stopped bomb controllers', () => {
  const { coordinator, random } = createCoordinator();
  coordinator.startAll();
  coordinator.magnetBegin();
  coordinator.stopAll();
  const controlsBeforeCleanup = [...coordinator.controlLog];
  const drawsBeforeCleanup = [...random.calls];

  coordinator.restoreNormalFruitIntervalForCleanup();

  assert.deepEqual(
    coordinator.snapshot.normalFruitInterval,
    CLASSIC_BIRD_NORMAL_FRUIT_INTERVAL,
  );
  assert.deepEqual(coordinator.controlLog, controlsBeforeCleanup);
  assert.deepEqual(random.calls, drawsBeforeCleanup);
  for (const controller of CLASSIC_BIRD_MAGNET_BOMB_CONTROLLER_ORDER) {
    assert.equal(
      timerFor(coordinator.controllerSnapshot(controller)).scheduled,
      false,
    );
  }
});

test('Concurrent constructor maxima produce actual inclusive counts five and four', () => {
  const random = new ScriptedRandom(Array(6).fill(0), [5, 4]);
  const { coordinator, planner } = createCoordinator(random);
  coordinator.startController('ab');
  coordinator.startController('ae');

  coordinator.tick(15.01);

  assert.equal(
    planner.requests.filter(({ tossType }) => tossType === 0).length,
    5,
  );
  assert.equal(
    planner.requests.filter(({ tossType }) => tossType === 1).length,
    4,
  );
  assert.deepEqual(random.calls.slice(-4), [
    'decile:0',
    'int:2:5:5',
    'decile:0',
    'int:1:4:4',
  ]);
});

test('magnet pauses only the bomb Wave outer timer, not an active child', () => {
  const { coordinator } = createCoordinator();
  coordinator.startController('af');
  coordinator.tick(30.01);
  const active = coordinator.controllerSnapshot('af');
  assert.equal(active.controller, 'wave');
  assert.equal(active.timer.scheduled, true);
  assert.equal(active.childTimer.scheduled, true);

  coordinator.magnetBegin();
  const paused = coordinator.controllerSnapshot('af');
  assert.equal(paused.controller, 'wave');
  assert.equal(paused.timer.scheduled, false);
  assert.equal(paused.childTimer.scheduled, true);
});

test('Wave child pause uses scheduler delta and preserves its armed threshold', () => {
  const { coordinator } = createCoordinator();
  coordinator.startController('ac');
  coordinator.tick(7.56);
  const active = coordinator.controllerSnapshot('ac');
  assert.equal(active.controller, 'wave');
  assert.equal(active.childTimer.scheduled, true);
  assert.equal(coordinator.snapshot.pendingWavePauseCount, 1);
  const threshold = active.childTimer.thresholdSeconds;

  coordinator.tick(1.5);
  const paused = coordinator.controllerSnapshot('ac');
  assert.equal(paused.controller, 'wave');
  assert.equal(paused.childTimer.scheduled, false);
  assert.equal(paused.childTimer.thresholdSeconds, threshold);
  assert.equal(coordinator.snapshot.pendingWavePauseCount, 0);
});

test('coordinator rejects mismatched RNG ownership and invalid scheduler delta', () => {
  const random = new ScriptedRandom();
  assert.throws(() => new ClassicBirdTossCoordinator({
    effectsEnabled: () => false,
    planner: new RecordingPlanner(new ScriptedRandom()) as never,
    random: random as never,
    viewport: () => ({ height: 800, width: 480 }),
  }), /share the same GameplayRandom/);

  const { coordinator } = createCoordinator();
  assert.throws(() => coordinator.tick(-1), /finite and non-negative/);
});

function timerFor(
  snapshot: ReturnType<
    InstanceType<typeof ClassicBirdTossCoordinator>['controllerSnapshot']
  >,
) {
  return snapshot.timer;
}
