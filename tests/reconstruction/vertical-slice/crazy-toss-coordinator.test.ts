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
  CRAZY_MAGNET_BOMB_CONTROLLER_ORDER,
  CRAZY_MAGNET_NORMAL_FRUIT_INTERVAL,
  CRAZY_NORMAL_FRUIT_INTERVAL,
  CrazyTossCoordinator,
} = await import('../../../game/assets/scripts/domain/crazy-toss-coordinator.ts');
const {
  CRAZY_TOSS_START_ORDER,
} = await import('../../../game/assets/scripts/domain/crazy-toss-config.ts');

class ScriptedRandom {
  readonly calls: string[] = [];
  private readonly deciles: number[];
  private readonly integers: number[];

  constructor(
    deciles: readonly number[] = Array(100).fill(0),
    integers: readonly number[] = Array(100).fill(0),
  ) {
    this.deciles = [...deciles];
    this.integers = [...integers];
  }

  nextRawNonNegativeInt(): number {
    this.calls.push('raw');
    return 0;
  }

  nextIntInclusive(min: number, max: number): number {
    const value = this.integers.shift();
    if (value === undefined) {
      throw new Error('integer script exhausted');
    }
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
                fruitId: request.tossType === 3 ? 13 : request.tossType === 4 ? 14 : 0,
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
  const planner = new RecordingPlanner(random);
  const commands: Array<Readonly<{ type: string }>> = [];
  const coordinator = new CrazyTossCoordinator({
    bonusState: { isEnabled: () => false },
    commandSink: (batch) => commands.push(...batch),
    effectsEnabled,
    planner: planner as never,
    random: random as never,
    viewport: () => ({ height: 800, width: 480 }),
  });
  return { commands, coordinator, planner, random };
}

test('Crazy coordinator constructs Wave children and Double children in slot order', () => {
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
    'create-double-free-child',
    'attach-double-free-child',
    'create-double-free-child',
    'attach-double-free-child',
  ]);
  assert.deepEqual(random.calls, ['decile:0', 'decile:0']);
  assert.equal(coordinator.controllerSnapshot('b2').controller, 'wave');
  assert.equal(coordinator.controllerSnapshot('b4').controller, 'double');
  assert.equal(coordinator.controllerSnapshot('b5').controller, 'bonus');
});

test('Crazy GO starts ten slots in recovered shared-RNG order and leaves Double idle', () => {
  const { coordinator, random } = createCoordinator();
  for (const controllerId of CRAZY_TOSS_START_ORDER) {
    coordinator.startController(controllerId);
  }
  assert.deepEqual(random.calls, Array(12).fill('decile:0'));
  for (const controllerId of CRAZY_TOSS_START_ORDER) {
    const snapshot = coordinator.controllerSnapshot(controllerId);
    assert.equal(snapshot.controller === 'double' ? false : snapshot.timer.scheduled, true);
  }
  const double = coordinator.controllerSnapshot('b4');
  assert.equal(double.controller, 'double');
  assert.equal(double.state.active, false);
  assert.equal(double.state.baseTimer.scheduled, false);
});

test('Electric, magnet, and Dragon schedulers preserve the recovered Down ABI', () => {
  const { coordinator, planner } = createCoordinator();
  coordinator.startController('af');
  coordinator.startController('ae');
  coordinator.startController('ad');

  coordinator.tick(60);

  assert.deepEqual(planner.requests, [
    { direction: 1, effectsEnabled: false, tossType: 3 },
    { direction: 1, effectsEnabled: false, tossType: 4 },
    { direction: 1, effectsEnabled: false, tossType: 6 },
  ]);
});

test('Magnet changes only future normal thresholds and pauses/resumes bomb slots in order', () => {
  const { coordinator } = createCoordinator();
  for (const controllerId of CRAZY_TOSS_START_ORDER) {
    coordinator.startController(controllerId);
  }
  const armedThreshold = timerFor(coordinator.controllerSnapshot('ab')).thresholdSeconds;

  coordinator.magnetBegin();
  assert.deepEqual(coordinator.snapshot.normalFruitInterval, CRAZY_MAGNET_NORMAL_FRUIT_INTERVAL);
  assert.equal(timerFor(coordinator.controllerSnapshot('ab')).thresholdSeconds, armedThreshold);
  assert.deepEqual(CRAZY_MAGNET_BOMB_CONTROLLER_ORDER, ['ac', 'b1', 'b3']);
  for (const controllerId of CRAZY_MAGNET_BOMB_CONTROLLER_ORDER) {
    assert.equal(timerFor(coordinator.controllerSnapshot(controllerId)).scheduled, false);
  }

  coordinator.magnetEnd();
  assert.deepEqual(coordinator.snapshot.normalFruitInterval, CRAZY_NORMAL_FRUIT_INTERVAL);
  assert.equal(timerFor(coordinator.controllerSnapshot('ab')).thresholdSeconds, armedThreshold);
  for (const controllerId of CRAZY_MAGNET_BOMB_CONTROLLER_ORDER) {
    assert.equal(timerFor(coordinator.controllerSnapshot(controllerId)).scheduled, true);
  }
});

test('Double child turns expand to normal spawns and its uncancelled delay stops the run', () => {
  const { commands, coordinator, planner } = createCoordinator();
  coordinator.startController('b4');
  const commandStart = commands.length;

  coordinator.tick(0.76);
  assert.deepEqual(
    commands.slice(commandStart).map(({ type }) => type),
    [
      'request-double-free-child-turn',
      'create-fruit',
      'request-double-free-child-turn',
      'create-fruit',
    ],
  );
  assert.deepEqual(planner.requests, [
    { direction: 2, effectsEnabled: false, tossType: 0 },
    { direction: 3, effectsEnabled: false, tossType: 0 },
  ]);
  assert.equal(coordinator.snapshot.pendingDoubleStopCount, 1);

  coordinator.tick(15);
  const double = coordinator.controllerSnapshot('b4');
  assert.equal(double.controller, 'double');
  assert.equal(double.state.active, false);
  assert.equal(coordinator.snapshot.pendingDoubleStopCount, 0);
  assert.equal(commands.some(({ type }) => type === 'disable-bonus'), true);
});

test('Wave resumes its child, records one delayed pause, then pauses on the action clock', () => {
  const { coordinator } = createCoordinator();
  coordinator.startController('b2');
  coordinator.tick(6.01);
  const active = coordinator.controllerSnapshot('b2');
  assert.equal(active.controller, 'wave');
  assert.equal(active.childTimer.scheduled, true);
  assert.equal(coordinator.snapshot.pendingWavePauseCount, 1);

  coordinator.tick(3);
  const paused = coordinator.controllerSnapshot('b2');
  assert.equal(paused.controller, 'wave');
  assert.equal(paused.childTimer.scheduled, false);
  assert.equal(coordinator.snapshot.pendingWavePauseCount, 0);
});

test('Crazy coordinator rejects mismatched ownership and invalid frame deltas', () => {
  const random = new ScriptedRandom();
  assert.throws(() => new CrazyTossCoordinator({
    bonusState: { isEnabled: () => false },
    effectsEnabled: () => false,
    planner: new RecordingPlanner(new ScriptedRandom()) as never,
    random: random as never,
    viewport: () => ({ height: 800, width: 480 }),
  }), /share the same GameplayRandom/);

  const { coordinator } = createCoordinator();
  assert.throws(() => coordinator.tick(-1), /finite and non-negative/);
});

function timerFor(
  snapshot: ReturnType<InstanceType<typeof CrazyTossCoordinator>['controllerSnapshot']>,
) {
  if (snapshot.controller === 'double') {
    throw new Error('expected a timed controller');
  }
  return snapshot.timer;
}
