import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

import type {
  ClassicInt32PreferencePort,
  ClassicSettingsState as ClassicSettingsStateType,
} from '../../../game/assets/scripts/domain/classic-settings-state.ts';
import type {
  ObjectiveAchievementPopupEvent,
  ObjectiveId,
} from '../../../game/assets/scripts/domain/objectives-manager-state.ts';

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
  ClassicSettingsState,
} = await import('../../../game/assets/scripts/domain/classic-settings-state.ts');
const {
  OBJECTIVES_COUNT,
  OBJECTIVES_CURRENT_STORAGE_KEY,
  OBJECTIVES_FRUITS_CUT_STORAGE_KEY,
  OBJECTIVES_VALUE_DEFAULT,
  OBJECTIVE_DESCRIPTIONS,
  OBJECTIVE_ORDER,
  OBJECTIVE_REWARDS,
  OBJECTIVE_TARGETS,
  ObjectivesManagerState,
  objectiveDefinitionAt,
  objectiveSelectorForFruitId,
  objectivesValueStorageKey,
} = await import('../../../game/assets/scripts/domain/objectives-manager-state.ts');

class RecordingPreferencePort implements ClassicInt32PreferencePort {
  readonly reads: Array<readonly [string, number | boolean]> = [];
  readonly values = new Map<string, number | boolean>();
  readonly writes: Array<readonly [string, number | boolean]> = [];

  constructor(values: Readonly<Record<string, number | boolean>> = {}) {
    for (const [key, value] of Object.entries(values)) {
      this.values.set(key, value);
    }
  }

  readInt32(key: string, defaultValue: number): number {
    this.reads.push([key, defaultValue]);
    const value = this.values.get(key);
    return typeof value === 'number' ? value : defaultValue;
  }

  writeInt32(key: string, value: number): void {
    this.writes.push([key, value]);
    this.values.set(key, value);
  }

  readBoolean(key: string, defaultValue: boolean): boolean {
    this.reads.push([key, defaultValue]);
    const value = this.values.get(key);
    return typeof value === 'boolean' ? value : defaultValue;
  }

  writeBoolean(key: string, value: boolean): void {
    this.writes.push([key, value]);
    this.values.set(key, value);
  }
}

interface Harness {
  readonly manager: InstanceType<typeof ObjectivesManagerState>;
  readonly popups: ObjectiveAchievementPopupEvent[];
  readonly preferences: RecordingPreferencePort;
  readonly settings: ClassicSettingsStateType;
}

function createHarness(
  currentObjective = 0,
  objectiveValues: Readonly<Record<number, number>> = {},
  fruitsCut = 0,
  totalCoins = 2014,
  onPopup?: (event: ObjectiveAchievementPopupEvent) => void,
): Harness {
  const settings = ClassicSettingsState.defaults();
  settings.setCurrentObjective(currentObjective);
  settings.setFruitsCut(fruitsCut);
  const initialTotalCoins = settings.snapshot.totalCoins;
  if (totalCoins !== initialTotalCoins) {
    settings.addTotalCoins(totalCoins - initialTotalCoins);
  }
  const values: Record<string, number> = {};
  for (const [objectiveId, value] of Object.entries(objectiveValues)) {
    values[objectivesValueStorageKey(Number(objectiveId))] = value;
  }
  const preferences = new RecordingPreferencePort(values);
  const popups: ObjectiveAchievementPopupEvent[] = [];
  const manager = new ObjectivesManagerState(
    settings,
    preferences,
    (event: ObjectiveAchievementPopupEvent) => {
      popups.push(event);
      onPopup?.(event);
    },
  );
  return { manager, popups, preferences, settings };
}

test('all recovered objective tables retain exact 52-entry order and values', () => {
  assert.equal(OBJECTIVES_COUNT, 52);
  assert.deepEqual(OBJECTIVE_ORDER, [
    0, 27, 8, 1, 18, 9, 28, 2, 50, 10, 3, 19, 42, 46, 32, 48, 20, 4,
    21, 29, 11, 5, 22, 33, 51, 34, 23, 12, 24, 36, 13, 25, 37, 38, 14,
    41, 26, 15, 35, 47, 6, 30, 40, 49, 45, 39, 31, 16, 43, 44, 7, 17,
  ]);
  assert.deepEqual(OBJECTIVE_REWARDS, [
    99, 111, 222, 245, 333, 375, 444, 555, 666, 695, 750, 805, 870, 935,
    1000, 1364, 1437, 1785, 2000, 2320, 2495, 2530, 2635, 2840, 3050,
    3165, 3378, 3515, 3676, 3945, 4250, 4268, 4312, 4320, 4425, 4450,
    4469, 4475, 4500, 4526, 5055, 5600, 5675, 5700, 5777, 5850, 5915,
    5937, 5962, 6999, 7234, 7500,
  ]);
  assert.deepEqual(OBJECTIVE_TARGETS, [
    15, 15, 15, 15, 15, 15, 15, 15,
    1000, 2000, 5000, 10000, 15000, 20000, 25000, 37500, 50000, 70000,
    50, 50, 25, 25, 50, 100, 200, 200, 200, 250, 500, 1250, 2500, 3500,
    50, 150, 250, 500, 250, 500, 500, 1000, 500, 350, 500, 750, 1437,
    123, 0, 0, 0, 0, 0, 0,
  ]);
  assert.deepEqual(OBJECTIVE_DESCRIPTIONS, [
    '15 times combo 3',
    '15 times combo 4',
    '15 times combo 5',
    '15 times combo 6',
    '15 times combo 7',
    '15 tiems combo 8',
    '15 times combo 9',
    '15 times combo 10',
    '1000 fruits total',
    '2000 fruits total',
    '5000 fruits total',
    '10000 fruits total',
    '15000 fruits total',
    '20000 fruits total',
    '25000 fruits total',
    '37500 fruits total',
    '50000 fruits total',
    '70000 fruits total',
    'Kill 50 bananas',
    'Kill 50 strawberries',
    'Kill 25 ice bananas',
    'Kill 25 electric ftuits',
    'Kill 50 dragon fruits',
    'Kill 100 dragon fruits',
    'Kill 200 papaya',
    'Kill 200 oranges',
    'Kill 200 watermelon',
    'Score > 250 Classic Mode',
    'Score > 500 Classic Mode',
    'Score > 1250 Classic Mode',
    'Score > 2500 Classic Mode',
    'Score > 3500 Classic Mode',
    'Score > 50 Classic Bird',
    'Score > 150 Classic Bird',
    'Score > 250 Classic Bird',
    'Score > 500 Classic Bird',
    'Score > 250 Crazy Bird',
    'Score > 500 Crazy Bird',
    'Score > 500 Crazy Mode',
    'Score > 1000 Crazy Mode',
    'Score > 350 Combo Bird',
    'Score > 500 Combo Bird',
    'Score > 500 Gangnam Style',
    'Score > 750 Gangnam Style',
    'Score = 1437 Classic Mode',
    'Score = 123 Classic Bird',
    'No fruits drop Crazy Mode',
    'No fruits drop Crazy Bird',
    'No fruits drop Gangnam Style',
    'No fruits drop Combo Bird',
    'No bombs hit Crazy Mode',
    'No bombs hit Crazy Bird',
  ]);
  for (const table of [
    OBJECTIVE_ORDER,
    OBJECTIVE_REWARDS,
    OBJECTIVE_TARGETS,
    OBJECTIVE_DESCRIPTIONS,
  ]) {
    assert.equal(table.length, OBJECTIVES_COUNT);
    assert.equal(Object.isFrozen(table), true);
  }
  assert.equal(new Set(OBJECTIVE_ORDER).size, OBJECTIVES_COUNT);
});

test('active lookup and pause-card strings use recovered sequence, progress, and reward axes', () => {
  const combo = createHarness(0, { 0: 3 });
  assert.deepEqual(combo.manager.pauseCard(), {
    objective: {
      description: '15 times combo 3',
      id: 0,
      rewardCoins: 99,
      sequencePosition: 0,
      target: 15,
    },
    progressText: '(12 times to go)',
    rewardText: 'reward: 99 coins',
  });

  const fruitTotal = createHarness(2, {}, 123);
  assert.deepEqual(fruitTotal.manager.pauseCard(), {
    objective: {
      description: '1000 fruits total',
      id: 8,
      rewardCoins: 222,
      sequencePosition: 2,
      target: 1000,
    },
    progressText: '(877 fruits to go)',
    rewardText: 'reward: 222 coins',
  });

  const fruitType = createHarness(4, { 18: 2 });
  assert.equal(fruitType.manager.pauseCard()?.progressText, '(48 to go)');

  const noBomb = createHarness(8, { 50: 7 });
  assert.deepEqual(noBomb.manager.pauseCard(), {
    objective: {
      description: 'No bombs hit Crazy Mode',
      id: 50,
      rewardCoins: 666,
      sequencePosition: 8,
      target: 0,
    },
    progressText: '',
    rewardText: 'reward: 666 coins',
  });
  assert.equal(objectiveDefinitionAt(52), null);
  assert.equal(objectivesValueStorageKey(50), 'objectives_value_50');
  assert.deepEqual(combo.preferences.reads, [
    ['objectives_value_0', OBJECTIVES_VALUE_DEFAULT],
  ]);
});

test('selectors 0 through 21 use the exact recovered active-objective gates', () => {
  const permittedBySelector: Readonly<Record<number, readonly ObjectiveId[]>> = {
    0: [0, 1, 2, 3, 4, 5, 6, 7],
    1: [27, 28, 29, 30, 31, 44],
    2: [42, 43],
    3: [38, 39],
    4: [46],
    5: [47],
    6: [48],
    7: [49],
    8: [50],
    9: [51],
    10: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    11: [18],
    12: [19],
    13: [20],
    14: [21],
    15: [22, 23],
    16: [24],
    17: [25],
    18: [26],
    19: [32, 33, 34, 35, 45],
    20: [36, 37],
    21: [37, 41],
  };

  for (let selector = 0; selector <= 21; selector += 1) {
    const permitted = permittedBySelector[selector] ?? [];
    for (let sequencePosition = 0; sequencePosition < OBJECTIVES_COUNT; sequencePosition += 1) {
      const objectiveId = OBJECTIVE_ORDER[sequencePosition];
      assert.notEqual(objectiveId, undefined);
      const harness = createHarness(sequencePosition);
      const payload = selector === 0 ? (objectiveId ?? 0) + 3 : 9;
      harness.manager.processGameEvent(selector, payload);
      assert.equal(
        harness.preferences.reads.length > 0,
        permitted.includes(objectiveId as ObjectiveId),
        `selector ${selector} gate for objective ${objectiveId}`,
      );
    }
  }
});

test('Fruit::Cut maps only the seven recovered fruit IDs to per-type selectors', () => {
  assert.deepEqual(
    Array.from({ length: 14 }, (_, fruitId) => objectiveSelectorForFruitId(fruitId)),
    [null, 11, 12, 18, null, null, null, 17, 16, null, null, null, 13, 14],
  );

  const banana = createHarness(4, { 18: 48 });
  assert.equal(banana.manager.processFruitTypeCut(1), null);
  assert.equal(banana.preferences.values.get('objectives_value_18'), 49);

  const unmapped = createHarness(4, { 18: 48 });
  assert.equal(unmapped.manager.processFruitTypeCut(6), null);
  assert.deepEqual(unmapped.preferences.reads, []);
  assert.deepEqual(unmapped.preferences.writes, []);
});

test('NotifycationManager fruit count increments first, dispatches selector 10, and caps at 100001', () => {
  const threshold = createHarness(2, {}, 999);
  assert.equal(threshold.manager.processGlobalFruitCut()?.completed.id, 8);
  assert.equal(threshold.settings.snapshot.fruitsCut, 1000);
  assert.equal(threshold.popups.length, 1);

  const ceiling = createHarness(0, {}, 100_000);
  assert.equal(ceiling.manager.processGlobalFruitCut(), null);
  assert.equal(ceiling.settings.snapshot.fruitsCut, 100_001);
  assert.equal(ceiling.manager.processGlobalFruitCut(), null);
  assert.equal(ceiling.settings.snapshot.fruitsCut, 100_001);

  const alreadyBeyond = createHarness(0, {}, 123_456);
  assert.equal(alreadyBeyond.manager.processGlobalFruitCut(), null);
  assert.equal(alreadyBeyond.settings.snapshot.fruitsCut, 123_456);
});

test('one cut can advance a global objective before applying its per-type progress', () => {
  const harness = createHarness(27, { 24: 0 }, 14_999, 2014);

  assert.equal(harness.manager.processGlobalFruitCut()?.completed.id, 12);
  assert.equal(harness.settings.snapshot.currentObjective, 28);
  assert.equal(harness.manager.processFruitTypeCut(8), null);
  assert.equal(harness.settings.snapshot.currentObjective, 28);
  assert.equal(harness.settings.snapshot.fruitsCut, 15_000);
  assert.equal(harness.preferences.values.get('objectives_value_24'), 1);
  assert.deepEqual(
    harness.popups.map(({ completed }) => completed.id),
    [12],
  );
});

test('AchievementEvent preserves finish/lose reads, progress groups, and threshold rules', () => {
  const combo = createHarness(0, { 0: 14 });
  const comboPopup = combo.manager.achievementEvent(0, true, 999);
  assert.equal(comboPopup?.completed.id, 0);
  assert.deepEqual(combo.preferences.reads, [
    ['objectives_value_0', 0],
    ['objectives_value_0', 0],
    ['objectives_value_0', 0],
  ]);
  assert.deepEqual(combo.preferences.writes, [['objectives_value_0', -2]]);

  const fruitType = createHarness(4, { 18: 0 });
  assert.equal(fruitType.manager.achievementEvent(18, true, 999), null);
  assert.deepEqual(fruitType.preferences.writes, [['objectives_value_18', 1]]);

  const scoreThreshold = createHarness(2);
  assert.equal(scoreThreshold.manager.achievementEvent(8, true, 999), null);
  assert.equal(scoreThreshold.manager.achievementEvent(8, true, 1000)?.completed.id, 8);

  const scoreEquality = createHarness(49);
  assert.equal(scoreEquality.manager.achievementEvent(44, true, 1438), null);
  assert.equal(scoreEquality.manager.achievementEvent(44, true, 1437)?.completed.id, 44);

  const finished = createHarness(0, { 0: -2 });
  assert.equal(finished.manager.achievementEvent(0, true, 1), null);
  assert.equal(finished.preferences.reads.length, 1);
  assert.deepEqual(finished.preferences.writes, []);

  const lost = createHarness(0, { 0: -1 });
  assert.equal(lost.manager.achievementEvent(0, true, 1), null);
  assert.equal(lost.preferences.reads.length, 2);
  assert.deepEqual(lost.preferences.writes, []);

  const past = createHarness(5, { 18: 2 });
  assert.equal(past.manager.achievementEvent(18, true, 1), null);
  assert.equal(past.preferences.reads.length, 2);
  assert.deepEqual(past.preferences.writes, []);

  const disabledPhase = createHarness(8, { 50: 4 });
  assert.equal(disabledPhase.manager.achievementEvent(50, false, 0), null);
  assert.equal(disabledPhase.preferences.values.get('objectives_value_50'), 4);
  assert.deepEqual(disabledPhase.preferences.writes, []);
});

test('Crazy no-bomb objective completes synchronously with immediate value durability', () => {
  let callbackObserved = false;
  let harness!: Harness;
  harness = createHarness(8, {}, 0, 3000, (event) => {
    callbackObserved = true;
    assert.equal(harness.preferences.values.get('objectives_value_50'), -2);
    assert.equal(harness.settings.snapshot.currentObjective, 9);
    assert.equal(harness.settings.snapshot.totalCoins, 3666);
    assert.equal(event.completed.id, 50);
    assert.equal(event.next.id, 10);
  });

  assert.equal(harness.manager.processGameEvent(8, 0), null);
  const popup = harness.manager.processGameEvent(8, 2);
  assert.equal(callbackObserved, true);
  assert.deepEqual(popup, {
    awardedCoins: 666,
    completed: {
      description: 'No bombs hit Crazy Mode',
      id: 50,
      rewardCoins: 666,
      sequencePosition: 8,
      target: 0,
    },
    currentObjective: 9,
    next: {
      description: '5000 fruits total',
      id: 10,
      rewardCoins: 695,
      sequencePosition: 9,
      target: 5000,
    },
    nextRewardText: 'reward: 695 coins',
    totalCoins: 3666,
    transition: 'finish',
    type: 'objective-achievement',
  });
  assert.deepEqual(harness.preferences.writes, [
    ['objectives_value_50', 0],
    ['objectives_value_50', -2],
  ]);
  assert.deepEqual(harness.popups, [popup]);
});

test('Crazy no-bomb failure and unrelated Crazy selectors do not advance', () => {
  const failed = createHarness(8);
  failed.manager.processGameEvent(8, 0);
  failed.manager.processGameEvent(8, 1);
  assert.equal(failed.manager.processGameEvent(8, 2), null);
  assert.equal(failed.settings.snapshot.currentObjective, 8);
  assert.equal(failed.settings.snapshot.totalCoins, 2014);
  assert.equal(failed.preferences.values.get('objectives_value_50'), 1);
  assert.deepEqual(failed.popups, []);

  const unrelated = createHarness(0);
  assert.equal(unrelated.manager.processGameEvent(8, 0), null);
  assert.equal(unrelated.manager.processGameEvent(4, 0), null);
  assert.deepEqual(unrelated.preferences.reads, []);
  assert.deepEqual(unrelated.preferences.writes, []);
});

test('Crazy no-drop objective handles fail and success paths with exact next payload', () => {
  const failed = createHarness(13);
  failed.manager.processGameEvent(4, 0);
  failed.manager.processGameEvent(4, 1);
  failed.manager.processGameEvent(4, 1);
  assert.equal(failed.manager.processGameEvent(4, 2), null);
  assert.equal(failed.preferences.values.get('objectives_value_46'), 2);
  assert.equal(failed.settings.snapshot.currentObjective, 13);

  const success = createHarness(13, {}, 12, 2014);
  success.manager.processGameEvent(4, 0);
  const popup = success.manager.processGameEvent(4, 2);
  assert.equal(success.preferences.values.get('objectives_value_46'), -2);
  assert.equal(success.settings.snapshot.currentObjective, 14);
  assert.equal(success.settings.snapshot.totalCoins, 2949);
  assert.equal(popup?.awardedCoins, 935);
  assert.equal(popup?.completed.id, 46);
  assert.equal(popup?.next.id, 32);
  assert.equal(popup?.nextRewardText, 'reward: 1000 coins');
});

test('skip persists completion then advances without reward before synchronous popup', () => {
  const harness = createHarness(8, {}, 0, 3000);
  const popup = harness.manager.skip(50);

  assert.deepEqual(harness.preferences.writes, [['objectives_value_50', -2]]);
  assert.equal(harness.settings.snapshot.currentObjective, 9);
  assert.equal(harness.settings.snapshot.totalCoins, 3000);
  assert.equal(popup?.transition, 'skip');
  assert.equal(popup?.awardedCoins, 0);
  assert.equal(popup?.completed.id, 50);
  assert.equal(popup?.next.id, 10);
});

test('last objective completion resets sequence and performs 52 immediate zero writes without popup', () => {
  const initialValues = Object.fromEntries(
    Array.from({ length: OBJECTIVES_COUNT }, (_, objectiveId) => [objectiveId, objectiveId + 1]),
  );
  const harness = createHarness(51, initialValues, 70_000, 2014);

  const result = harness.manager.processGameEvent(10, 70_000);
  assert.equal(result, null);
  assert.equal(harness.settings.snapshot.currentObjective, 0);
  assert.equal(harness.settings.snapshot.fruitsCut, 0);
  assert.equal(harness.settings.snapshot.totalCoins, 9514);
  assert.deepEqual(harness.popups, []);
  assert.deepEqual(harness.preferences.writes[0], ['objectives_value_17', -2]);
  assert.equal(harness.preferences.writes.length, 53);
  assert.deepEqual(
    harness.preferences.writes.slice(1),
    Array.from(
      { length: OBJECTIVES_COUNT },
      (_, objectiveId) => [`objectives_value_${objectiveId}`, 0],
    ),
  );
});

test('recovered value bounds include SetLose ID 52 but not ordinary SetValue ID 52', () => {
  const harness = createHarness();

  assert.equal(harness.manager.setValue(52, 7), false);
  assert.equal(harness.manager.value(52), 0);
  assert.equal(harness.manager.isLost(52), true);
  assert.equal(harness.manager.setLost(52), true);
  assert.deepEqual(harness.preferences.writes, [['objectives_value_52', -1]]);
});

test('Settings keys and objective values preserve distinct persistence boundaries', () => {
  const preferences = new RecordingPreferencePort({
    [OBJECTIVES_CURRENT_STORAGE_KEY]: 8,
    [OBJECTIVES_FRUITS_CUT_STORAGE_KEY]: 123,
    objectives_value_50: 0,
  });
  const settings = ClassicSettingsState.load(preferences);
  preferences.reads.length = 0;
  preferences.writes.length = 0;
  const manager = new ObjectivesManagerState(settings, preferences, () => {});

  manager.processGameEvent(8, 1);
  assert.deepEqual(preferences.writes, [['objectives_value_50', 1]]);
  assert.equal(settings.snapshot.currentObjective, 8);
  assert.equal(settings.snapshot.fruitsCut, 123);

  settings.save(preferences);
  const currentWrite = preferences.writes.findIndex(
    ([key]) => key === OBJECTIVES_CURRENT_STORAGE_KEY,
  );
  const fruitsWrite = preferences.writes.findIndex(
    ([key]) => key === OBJECTIVES_FRUITS_CUT_STORAGE_KEY,
  );
  const musicWrite = preferences.writes.findIndex(([key]) => key === 'enable_music');
  assert.ok(currentWrite > 0);
  assert.equal(fruitsWrite, currentWrite + 1);
  assert.equal(musicWrite, fruitsWrite + 1);
});
