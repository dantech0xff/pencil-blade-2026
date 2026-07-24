import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

import type {
  ObjectiveAchievementPopupEvent,
  ObjectivesManagerInt32PreferencePort,
  ObjectivesManagerSettingsPort,
  ObjectivesManagerSettingsSnapshot,
} from '../../../game/assets/scripts/domain/objectives-manager-state.ts';
import type {
  ObjectivesScreenListMetrics,
  ObjectivesScreenManagerPort,
} from '../../../game/assets/scripts/domain/objectives-screen-state.ts';

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
  OBJECTIVES_COUNT,
  OBJECTIVE_ORDER,
  OBJECTIVE_REWARDS,
  ObjectivesManagerState,
  objectiveDefinitionAt,
  objectivesValueStorageKey,
} = await import('../../../game/assets/scripts/domain/objectives-manager-state.ts');
const {
  OBJECTIVES_SCREEN_INITIAL_VIEWED_SEQUENCE_POSITION,
  OBJECTIVES_SCREEN_NO_VIEWED_SEQUENCE_POSITION,
  ObjectivesScreenState,
} = await import('../../../game/assets/scripts/domain/objectives-screen-state.ts');

const COMPACT_METRICS: ObjectivesScreenListMetrics = Object.freeze({
  bottomBound: 292.5,
  logicalHeight: 800,
  rowSpacing: 101.25,
  topBound: 594.5,
});

class SettingsPort implements ObjectivesManagerSettingsPort {
  private currentObjectiveValue: number;
  private fruitsCutValue = 0;
  private totalCoinsValue = 2_014;

  constructor(currentObjective: number) {
    this.currentObjectiveValue = currentObjective;
  }

  get snapshot(): ObjectivesManagerSettingsSnapshot {
    return Object.freeze({
      currentObjective: this.currentObjectiveValue,
      fruitsCut: this.fruitsCutValue,
      totalCoins: this.totalCoinsValue,
    });
  }

  addObjectiveRewardCoins(rewardCoins: number) {
    const previousTotalCoins = this.totalCoinsValue;
    this.totalCoinsValue = (this.totalCoinsValue + rewardCoins) | 0;
    return Object.freeze({
      delta: rewardCoins,
      nextTotalCoins: this.totalCoinsValue,
      previousTotalCoins,
    });
  }

  setCurrentObjective(currentObjective: number): void {
    this.currentObjectiveValue = currentObjective;
  }

  setFruitsCut(fruitsCut: number): void {
    this.fruitsCutValue = fruitsCut;
  }
}

class PreferencePort implements ObjectivesManagerInt32PreferencePort {
  readonly values = new Map<string, number>();
  readonly writes: Array<readonly [string, number]> = [];

  constructor(initial: Readonly<Record<number, number>> = {}) {
    for (const [objectiveId, value] of Object.entries(initial)) {
      this.values.set(objectivesValueStorageKey(Number(objectiveId)), value);
    }
  }

  readInt32(key: string, defaultValue: number): number {
    return this.values.get(key) ?? defaultValue;
  }

  writeInt32(key: string, value: number): void {
    this.values.set(key, value);
    this.writes.push([key, value]);
  }
}

interface Harness {
  readonly manager: InstanceType<typeof ObjectivesManagerState>;
  readonly popups: ObjectiveAchievementPopupEvent[];
  readonly preferences: PreferencePort;
  readonly settings: SettingsPort;
  readonly state: InstanceType<typeof ObjectivesScreenState>;
}

test('construction snapshots all 52 canonical definitions, rewards, finishes, and initial ys', () => {
  const harness = createHarness(8, { 0: -2, 27: -2, 50: 7 });
  const snapshot = harness.state.snapshot;

  assert.equal(OBJECTIVES_SCREEN_INITIAL_VIEWED_SEQUENCE_POSITION, 0);
  assert.equal(OBJECTIVES_SCREEN_NO_VIEWED_SEQUENCE_POSITION, -1);
  assert.equal(snapshot.rows.length, OBJECTIVES_COUNT);
  assert.equal(snapshot.initialBaseY, 1_404.5);
  assert.equal(snapshot.viewedSequencePosition, 0);
  assert.deepEqual(
    snapshot.rows.map(({ objective }) => objective.id),
    OBJECTIVE_ORDER,
  );
  assert.deepEqual(
    snapshot.rows.map(({ objective }) => objective.rewardCoins),
    OBJECTIVE_REWARDS,
  );
  assert.equal(snapshot.rows[0]?.y, 1_404.5);
  assert.equal(snapshot.rows[8]?.y, COMPACT_METRICS.topBound);
  assert.equal(snapshot.rows[51]?.y, -3_759.25);
  assert.deepEqual(snapshot.rows.slice(0, 3).map((row) => ({
    finished: row.finished,
    labelsFinishedAtConstruction: row.labelsFinishedAtConstruction,
  })), [
    { finished: true, labelsFinishedAtConstruction: true },
    { finished: true, labelsFinishedAtConstruction: true },
    { finished: false, labelsFinishedAtConstruction: false },
  ]);
  assert.deepEqual(snapshot.currentCard, {
    customBackground: true,
    labelsFinishedAtConstruction: false,
    objective: {
      description: 'No bombs hit Crazy Mode',
      id: 50,
      rewardCoins: 666,
      sequencePosition: 8,
      target: 0,
    },
  });
  assertDeepFrozen(snapshot);
});

test('drag uses movement=-deltaY, prechecks the full delta, and permits overshoot', () => {
  const up = createHarness().state;
  const beforeFixed = up.snapshot.currentCard;
  const beforeRows = up.snapshot.rows.map(({ y }) => y);
  assert.deepEqual(up.drag(-101.25), {
    appliedMovementY: 101.25,
    moved: true,
    movementY: 101.25,
    viewedSequencePosition: 1,
  });
  assert.equal(
    up.snapshot.rows.every((row, index) => (
      row.y - (beforeRows[index] ?? Number.NaN) === 101.25
    )),
    true,
  );
  assert.deepEqual(up.snapshot.currentCard, beforeFixed);

  const crossingTop = createHarness().state;
  assert.deepEqual(crossingTop.drag(-6_000), {
    appliedMovementY: 6_000,
    moved: true,
    movementY: 6_000,
    viewedSequencePosition: -1,
  });
  assert.equal(crossingTop.snapshot.rows[51]?.y, 1_430.75);
  const afterTopOvershoot = crossingTop.snapshot;
  assert.deepEqual(crossingTop.drag(-1), {
    appliedMovementY: 0,
    moved: false,
    movementY: 1,
    viewedSequencePosition: -1,
  });
  assert.deepEqual(crossingTop.snapshot, afterTopOvershoot);

  const crossingBottom = createHarness().state;
  assert.deepEqual(crossingBottom.drag(400), {
    appliedMovementY: -400,
    moved: true,
    movementY: -400,
    viewedSequencePosition: 0,
  });
  assert.equal(crossingBottom.snapshot.rows[0]?.y, 194.5);
  const afterBottomOvershoot = crossingBottom.snapshot;
  assert.deepEqual(crossingBottom.drag(1), {
    appliedMovementY: 0,
    moved: false,
    movementY: -1,
    viewedSequencePosition: 0,
  });
  assert.deepEqual(crossingBottom.snapshot, afterBottomOvershoot);
});

test('nearest-row scan uses strict distance below H and strict ties retain lower sequence', () => {
  const state = createHarness().state;
  assert.deepEqual(state.drag(-50.625), {
    appliedMovementY: 50.625,
    moved: true,
    movementY: 50.625,
    viewedSequencePosition: 0,
  });

  const beyondEveryRow = createHarness().state;
  assert.equal(
    beyondEveryRow.drag(-6_000).viewedSequencePosition,
    OBJECTIVES_SCREEN_NO_VIEWED_SEQUENCE_POSITION,
  );

  const zero = createHarness().state;
  assert.deepEqual(zero.drag(0), {
    appliedMovementY: 0,
    moved: false,
    movementY: -0,
    viewedSequencePosition: 0,
  });
  assertDeepFrozen(zero.drag(0));
});

test('Skip targets manager active objective, not the independently viewed row', () => {
  const harness = createHarness(8);
  harness.state.drag(-303.75);
  assert.equal(harness.state.snapshot.viewedSequencePosition, 3);
  const rowYsBeforeSkip = harness.state.snapshot.rows.map(({ y }) => y);

  const result = harness.state.skipActiveObjective();

  assert.equal(result.skippedObjectiveId, 50);
  assert.equal(result.previousActiveObjective.sequencePosition, 8);
  assert.equal(result.nextActiveObjective.sequencePosition, 9);
  assert.equal(result.viewedSequencePosition, 3);
  assert.deepEqual(harness.preferences.writes, [
    ['objectives_value_50', -2],
  ]);
  assert.equal(harness.settings.snapshot.currentObjective, 9);
  assert.equal(harness.popups.length, 1);

  const snapshot = harness.state.snapshot;
  assert.equal(snapshot.currentCard.objective.id, 10);
  assert.equal(snapshot.currentCard.objective.description, '5000 fruits total');
  assert.equal(snapshot.currentCard.objective.rewardCoins, 695);
  assert.equal(snapshot.rows[8]?.finished, true);
  assert.equal(snapshot.rows[8]?.labelsFinishedAtConstruction, false);
  assert.deepEqual(snapshot.rows.map(({ y }) => y), rowYsBeforeSkip);
  assertDeepFrozen(result);
  assertDeepFrozen(snapshot);
});

test('manager refresh updates every background and fixed card without recoloring or moving rows', () => {
  const harness = createHarness(4);
  const before = harness.state.snapshot;
  harness.manager.setValue(18, -2);
  harness.settings.setCurrentObjective(5);

  const refreshed = harness.state.refreshFromManager();

  assert.equal(refreshed.rows[4]?.finished, true);
  assert.equal(refreshed.rows[4]?.labelsFinishedAtConstruction, false);
  assert.equal(refreshed.currentCard.objective.id, 9);
  assert.deepEqual(
    refreshed.rows.map(({ y }) => y),
    before.rows.map(({ y }) => y),
  );
  assert.equal(
    refreshed.currentCard.labelsFinishedAtConstruction,
    before.currentCard.labelsFinishedAtConstruction,
  );
  assertDeepFrozen(refreshed);
});

test('skipping the final row adopts manager wrap reset as the new authoritative screen', () => {
  const finishedValues = Object.fromEntries(
    Array.from({ length: OBJECTIVES_COUNT }, (_, objectiveId) => [
      objectiveId,
      -2,
    ]),
  );
  finishedValues[17] = 0;
  const harness = createHarness(51, finishedValues);

  const result = harness.state.skipActiveObjective();

  assert.equal(result.skippedObjectiveId, 17);
  assert.equal(result.nextActiveObjective.sequencePosition, 0);
  assert.equal(harness.settings.snapshot.currentObjective, 0);
  assert.equal(harness.state.snapshot.currentCard.objective.id, 0);
  assert.equal(
    harness.state.snapshot.rows.every(({ finished }) => !finished),
    true,
  );
  assert.equal(harness.preferences.writes.length, 53);
});

test('constructor and transitions reject malformed input before screen-state mutation', () => {
  const validManager = createManager().manager;
  for (const input of [
    null,
    [],
    { listMetrics: COMPACT_METRICS },
    { listMetrics: COMPACT_METRICS, manager: validManager, extra: true },
    { listMetrics: null, manager: validManager },
    {
      listMetrics: { ...COMPACT_METRICS, rowSpacing: 0 },
      manager: validManager,
    },
    {
      listMetrics: { ...COMPACT_METRICS, logicalHeight: Number.NaN },
      manager: validManager,
    },
    {
      listMetrics: { ...COMPACT_METRICS, bottomBound: 594.5 },
      manager: validManager,
    },
    {
      listMetrics: { ...COMPACT_METRICS, extra: 1 },
      manager: validManager,
    },
    { listMetrics: COMPACT_METRICS, manager: null },
    { listMetrics: COMPACT_METRICS, manager: {} },
  ]) {
    assert.throws(() => new ObjectivesScreenState(input as never));
  }

  const noActive: ObjectivesScreenManagerPort = {
    activeObjective: () => null,
    isFinished: () => false,
    skip: () => null,
  };
  assert.throws(
    () => new ObjectivesScreenState({
      listMetrics: COMPACT_METRICS,
      manager: noActive,
    }),
    /requires an active objective/,
  );

  const malformedDefinition: ObjectivesScreenManagerPort = {
    activeObjective: () => ({
      ...objectiveDefinitionAt(0)!,
      rewardCoins: 100,
    }),
    isFinished: () => false,
    skip: () => null,
  };
  assert.throws(
    () => new ObjectivesScreenState({
      listMetrics: COMPACT_METRICS,
      manager: malformedDefinition,
    }),
    /recovered objective definition/,
  );

  const malformedFinished: ObjectivesScreenManagerPort = {
    activeObjective: () => objectiveDefinitionAt(0),
    isFinished: () => 1 as never,
    skip: () => null,
  };
  assert.throws(
    () => new ObjectivesScreenState({
      listMetrics: COMPACT_METRICS,
      manager: malformedFinished,
    }),
    /must return a boolean/,
  );

  const state = createHarness().state;
  const initial = state.snapshot;
  for (const delta of [
    Number.NaN,
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.MAX_VALUE,
  ]) {
    assert.throws(() => state.drag(delta));
    assert.deepEqual(state.snapshot, initial);
  }
});

test('state domain stays Creator-free and contains no clipping, inertia, or persistence owner', () => {
  const source = readFileSync(new URL(
    '../../../game/assets/scripts/domain/objectives-screen-state.ts',
    import.meta.url,
  ), 'utf8');

  assert.doesNotMatch(source, /from\s+['"]cc['"]/);
  assert.doesNotMatch(
    source,
    /\b(Mask|Stencil|Scissor|applyInertia|snapTo|clampRows)\b/,
  );
  assert.doesNotMatch(source, /\b(writeInt32|save)\s*\(/);
  assert.match(source, /movementY = Math\.fround\(-finiteFloat32/);
  assert.match(source, /this\.manager\.skip\(previousActiveObjective\.id\)/);
});

function createHarness(
  currentObjective = 0,
  objectiveValues: Readonly<Record<number, number>> = {},
): Harness {
  const base = createManager(currentObjective, objectiveValues);
  const state = new ObjectivesScreenState({
    listMetrics: COMPACT_METRICS,
    manager: base.manager,
  });
  return { ...base, state };
}

function createManager(
  currentObjective = 0,
  objectiveValues: Readonly<Record<number, number>> = {},
): Omit<Harness, 'state'> {
  const settings = new SettingsPort(currentObjective);
  const preferences = new PreferencePort(objectiveValues);
  const popups: ObjectiveAchievementPopupEvent[] = [];
  const manager = new ObjectivesManagerState(
    settings,
    preferences,
    (event) => popups.push(event),
  );
  return { manager, popups, preferences, settings };
}

function assertDeepFrozen(
  value: unknown,
  seen: Set<object> = new Set(),
): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return;
  }
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) {
    assertDeepFrozen(child, seen);
  }
}
