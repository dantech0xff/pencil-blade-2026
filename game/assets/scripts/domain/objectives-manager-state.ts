export const OBJECTIVES_COUNT = 52 as const;
export const OBJECTIVES_CURRENT_STORAGE_KEY = 'current_objective' as const;
export const OBJECTIVES_FRUITS_CUT_STORAGE_KEY = 'fruits_cut' as const;
export const OBJECTIVES_VALUE_STORAGE_KEY_PREFIX = 'objectives_value_' as const;
export const OBJECTIVES_VALUE_DEFAULT = 0 as const;

export const OBJECTIVE_ORDER = Object.freeze([
  0, 27, 8, 1, 18, 9, 28, 2, 50, 10, 3, 19, 42, 46, 32, 48, 20, 4,
  21, 29, 11, 5, 22, 33, 51, 34, 23, 12, 24, 36, 13, 25, 37, 38, 14,
  41, 26, 15, 35, 47, 6, 30, 40, 49, 45, 39, 31, 16, 43, 44, 7, 17,
] as const);

export const OBJECTIVE_REWARDS = Object.freeze([
  99, 111, 222, 245, 333, 375, 444, 555, 666, 695, 750, 805, 870, 935,
  1000, 1364, 1437, 1785, 2000, 2320, 2495, 2530, 2635, 2840, 3050,
  3165, 3378, 3515, 3676, 3945, 4250, 4268, 4312, 4320, 4425, 4450,
  4469, 4475, 4500, 4526, 5055, 5600, 5675, 5700, 5777, 5850, 5915,
  5937, 5962, 6999, 7234, 7500,
] as const);

export const OBJECTIVE_TARGETS = Object.freeze([
  15, 15, 15, 15, 15, 15, 15, 15,
  1000, 2000, 5000, 10000, 15000, 20000, 25000, 37500, 50000, 70000,
  50, 50, 25, 25, 50, 100, 200, 200, 200, 250, 500, 1250, 2500, 3500,
  50, 150, 250, 500, 250, 500, 500, 1000, 500, 350, 500, 750, 1437,
  123, 0, 0, 0, 0, 0, 0,
] as const);

export const OBJECTIVE_DESCRIPTIONS = Object.freeze([
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
] as const);

export type ObjectiveId = typeof OBJECTIVE_ORDER[number];
export type ObjectiveTransition = 'finish' | 'skip';
export type FruitObjectiveSelector = 11 | 12 | 13 | 14 | 16 | 17 | 18;

const FRUIT_OBJECTIVE_SELECTORS = Object.freeze({
  1: 11,
  2: 12,
  3: 18,
  7: 17,
  8: 16,
  12: 13,
  13: 14,
} as const satisfies Readonly<Record<number, FruitObjectiveSelector>>);

const FRUITS_CUT_INCREMENT_CEILING = 100_000;

export interface ObjectivesManagerInt32PreferencePort {
  readInt32(key: string, defaultValue: number): number;
  writeInt32(key: string, value: number): void;
}

export interface ObjectivesManagerSettingsSnapshot {
  readonly currentObjective: number;
  readonly fruitsCut: number;
  readonly totalCoins: number;
}

export interface ObjectiveRewardCoinAdjustment {
  readonly delta: number;
  readonly nextTotalCoins: number;
  readonly previousTotalCoins: number;
}

export interface ObjectivesManagerSettingsPort {
  readonly snapshot: ObjectivesManagerSettingsSnapshot;
  addObjectiveRewardCoins(rewardCoins: number): ObjectiveRewardCoinAdjustment;
  setCurrentObjective(currentObjective: number): void;
  setFruitsCut(fruitsCut: number): void;
}

export interface ObjectiveDefinition {
  readonly description: string;
  readonly id: ObjectiveId;
  readonly rewardCoins: number;
  readonly sequencePosition: number;
  readonly target: number;
}

export interface ObjectivePauseCard {
  readonly objective: ObjectiveDefinition;
  readonly progressText: string;
  readonly rewardText: string;
}

export interface ObjectiveAchievementPopupEvent {
  readonly awardedCoins: number;
  readonly completed: ObjectiveDefinition;
  readonly currentObjective: number;
  readonly next: ObjectiveDefinition;
  readonly nextRewardText: string;
  readonly totalCoins: number;
  readonly transition: ObjectiveTransition;
  readonly type: 'objective-achievement';
}

export type ObjectiveAchievementPopupCallback = (
  event: ObjectiveAchievementPopupEvent,
) => void;

/**
 * Engine-independent port of the recovered static ObjectivesManager.
 *
 * Per-objective values are deliberately read from and written to the preference port on every
 * call. Current sequence position, global fruit count, and coins stay in the process settings
 * state until its bulk save checkpoint.
 */
export class ObjectivesManagerState {
  private readonly onPopup: ObjectiveAchievementPopupCallback;
  private readonly preferences: ObjectivesManagerInt32PreferencePort;
  private readonly settings: ObjectivesManagerSettingsPort;

  constructor(
    settings: ObjectivesManagerSettingsPort,
    preferences: ObjectivesManagerInt32PreferencePort,
    onPopup: ObjectiveAchievementPopupCallback,
  ) {
    assertSettingsPort(settings);
    assertPreferencePort(preferences);
    if (typeof onPopup !== 'function') {
      throw new TypeError('ObjectivesManager requires a synchronous popup callback');
    }
    this.settings = settings;
    this.preferences = preferences;
    this.onPopup = onPopup;
  }

  activeObjective(): ObjectiveDefinition | null {
    return objectiveDefinitionAt(this.settings.snapshot.currentObjective);
  }

  pauseCard(): ObjectivePauseCard | null {
    const objective = this.activeObjective();
    if (objective === null) {
      return null;
    }
    return Object.freeze({
      objective,
      progressText: this.extraObjectivesString(objective),
      rewardText: objectiveRewardText(objective.rewardCoins),
    });
  }

  extraObjectivesString(
    objective: ObjectiveDefinition | null = this.activeObjective(),
  ): string {
    if (objective === null) {
      return '';
    }
    const { id, target } = objective;
    if (id <= 7) {
      return `(${target - this.value(id)} times to go)`;
    }
    if (id <= 17) {
      return `(${target - this.settings.snapshot.fruitsCut} fruits to go)`;
    }
    if (id <= 26) {
      return `(${target - this.value(id)} to go)`;
    }
    return '';
  }

  isFinished(objectiveId: number): boolean {
    assertSignedInt32(objectiveId, 'objectiveId');
    return this.readStoredValue(objectiveId) === -2;
  }

  setValue(objectiveId: number, value: number): boolean {
    assertSignedInt32(objectiveId, 'objectiveId');
    assertSignedInt32(value, 'objective value');
    if (objectiveId > 51) {
      return false;
    }
    this.writeStoredValue(objectiveId, value);
    return true;
  }

  isLost(objectiveId: number): boolean {
    assertSignedInt32(objectiveId, 'objectiveId');
    if (objectiveId > 51) {
      return true;
    }
    return this.readStoredValue(objectiveId) === -1;
  }

  setLost(objectiveId: number): boolean {
    assertSignedInt32(objectiveId, 'objectiveId');
    if (objectiveId > 52) {
      return false;
    }
    this.writeStoredValue(objectiveId, -1);
    return true;
  }

  value(objectiveId: number): number {
    assertSignedInt32(objectiveId, 'objectiveId');
    if (objectiveId > 51) {
      return 0;
    }
    return this.readStoredValue(objectiveId);
  }

  skip(objectiveId: number): ObjectiveAchievementPopupEvent | null {
    assertSignedInt32(objectiveId, 'objectiveId');
    if (objectiveId > 51) {
      return null;
    }
    this.writeStoredValue(objectiveId, -2);
    const completedPosition = this.settings.snapshot.currentObjective;
    this.settings.setCurrentObjective(completedPosition + 1);
    return this.popupAfterAdvance('skip', 0);
  }

  finish(objectiveId: number): ObjectiveAchievementPopupEvent | null {
    assertSignedInt32(objectiveId, 'objectiveId');
    if (objectiveId > 51) {
      return null;
    }
    this.writeStoredValue(objectiveId, -2);
    const completedPosition = this.settings.snapshot.currentObjective;
    const rewardCoins = objectiveRewardAt(completedPosition);
    this.settings.addObjectiveRewardCoins(rewardCoins);
    this.settings.setCurrentObjective(completedPosition + 1);
    return this.popupAfterAdvance('finish', rewardCoins);
  }

  achievementEvent(
    objectiveId: number,
    enabled: boolean,
    payload: number,
  ): ObjectiveAchievementPopupEvent | null {
    assertSignedInt32(objectiveId, 'objectiveId');
    assertBoolean(enabled, 'enabled');
    assertSignedInt32(payload, 'payload');

    // Keep the native three-read ordinary path: finish test, lose test, then current value.
    if (this.isFinished(objectiveId) || this.isLost(objectiveId)) {
      return null;
    }
    const sequencePosition = OBJECTIVE_ORDER.indexOf(objectiveId as ObjectiveId);
    if (sequencePosition < this.settings.snapshot.currentObjective) {
      return null;
    }
    const currentValue = this.value(objectiveId);
    const target = objectiveTargetById(objectiveId);

    if (
      (objectiveId >= 0 && objectiveId <= 7)
      || (objectiveId >= 18 && objectiveId <= 26)
    ) {
      const nextValue = (currentValue + 1) | 0;
      if (nextValue < target) {
        this.setValue(objectiveId, nextValue);
        return null;
      }
      return this.finish(objectiveId);
    }
    if (
      (objectiveId >= 8 && objectiveId <= 17)
      || (objectiveId >= 27 && objectiveId <= 43)
    ) {
      return payload >= target ? this.finish(objectiveId) : null;
    }
    if (objectiveId === 44 || objectiveId === 45) {
      return payload === target ? this.finish(objectiveId) : null;
    }
    if (objectiveId >= 46 && objectiveId <= 51) {
      if (!enabled) {
        return null;
      }
      if (payload === 0) {
        this.setValue(objectiveId, 0);
      } else if (payload === 1) {
        this.setValue(objectiveId, (currentValue + 1) | 0);
      } else if (payload === 2 && currentValue === 0) {
        return this.finish(objectiveId);
      }
    }
    return null;
  }

  processGameEvent(
    selector: number,
    payload: number,
  ): ObjectiveAchievementPopupEvent | null {
    assertSignedInt32(selector, 'selector');
    assertSignedInt32(payload, 'payload');
    const active = this.activeObjective();
    if (active === null) {
      return null;
    }
    const id = active.id;

    switch (selector) {
      case 0:
        return payload >= 3 && payload <= 10 && id === payload - 3
          ? this.achievementEvent(id, true, 1)
          : null;
      case 1:
        return isObjectiveIdIn(id, 27, 28, 29, 30, 31, 44)
          ? this.achievementEvent(id, true, payload)
          : null;
      case 2:
        return isObjectiveIdIn(id, 42, 43)
          ? this.achievementEvent(id, true, payload)
          : null;
      case 3:
        return isObjectiveIdIn(id, 38, 39)
          ? this.achievementEvent(id, true, payload)
          : null;
      case 4:
        return id === 46 ? this.achievementEvent(id, true, payload) : null;
      case 5:
        return id === 47 ? this.achievementEvent(id, true, payload) : null;
      case 6:
        return id === 48 ? this.achievementEvent(id, true, payload) : null;
      case 7:
        return id === 49 ? this.achievementEvent(id, true, payload) : null;
      case 8:
        return id === 50 ? this.achievementEvent(id, true, payload) : null;
      case 9:
        return id === 51 ? this.achievementEvent(id, true, payload) : null;
      case 10:
        return id >= 8 && id <= 17
          ? this.achievementEvent(id, true, payload)
          : null;
      case 11:
        return id === 18 ? this.achievementEvent(id, true, payload) : null;
      case 12:
        return id === 19 ? this.achievementEvent(id, true, payload) : null;
      case 13:
        return id === 20 ? this.achievementEvent(id, true, payload) : null;
      case 14:
        return id === 21 ? this.achievementEvent(id, true, payload) : null;
      case 15:
        return id === 22 || id === 23
          ? this.achievementEvent(id, true, payload)
          : null;
      case 16:
        return id === 24 ? this.achievementEvent(id, true, payload) : null;
      case 17:
        return id === 25 ? this.achievementEvent(id, true, payload) : null;
      case 18:
        return id === 26 ? this.achievementEvent(id, true, payload) : null;
      case 19:
        return isObjectiveIdIn(id, 32, 33, 34, 35, 45)
          ? this.achievementEvent(id, true, payload)
          : null;
      case 20:
        return id === 36 || id === 37
          ? this.achievementEvent(id, true, payload)
          : null;
      case 21:
        return id === 37 || id === 41
          ? this.achievementEvent(id, true, payload)
          : null;
      default:
        return null;
    }
  }

  /**
   * Mirrors Fruit::Cut's per-type objective dispatch. Fruits without a recovered selector still
   * participate in the later global fruit notification.
   */
  processFruitTypeCut(fruitId: number): ObjectiveAchievementPopupEvent | null {
    const selector = objectiveSelectorForFruitId(fruitId);
    return selector === null ? null : this.processGameEvent(selector, 1);
  }

  /**
   * Mirrors NotifycationManager::FruitCut: update the process-wide cumulative counter first,
   * dispatch selector 10 with that value, then let the caller apply its mode-specific cut.
   */
  processGlobalFruitCut(): ObjectiveAchievementPopupEvent | null {
    const current = this.settings.snapshot.fruitsCut;
    const next = current <= FRUITS_CUT_INCREMENT_CEILING
      ? current + 1
      : current;
    if (next !== current) {
      this.settings.setFruitsCut(next);
    }
    return this.processGameEvent(10, next);
  }

  private popupAfterAdvance(
    transition: ObjectiveTransition,
    awardedCoins: number,
  ): ObjectiveAchievementPopupEvent | null {
    const currentObjective = this.settings.snapshot.currentObjective;
    if (currentObjective > 51) {
      this.settings.setCurrentObjective(0);
      this.settings.setFruitsCut(0);
      for (let objectiveId = 0; objectiveId < OBJECTIVES_COUNT; objectiveId += 1) {
        this.writeStoredValue(objectiveId, 0);
      }
      return null;
    }

    const completed = requiredObjectiveDefinitionAt(currentObjective - 1);
    const next = requiredObjectiveDefinitionAt(currentObjective);
    const event = Object.freeze({
      awardedCoins,
      completed,
      currentObjective,
      next,
      nextRewardText: objectiveRewardText(next.rewardCoins),
      totalCoins: this.settings.snapshot.totalCoins,
      transition,
      type: 'objective-achievement' as const,
    });
    this.onPopup(event);
    return event;
  }

  private readStoredValue(objectiveId: number): number {
    const value = this.preferences.readInt32(
      objectivesValueStorageKey(objectiveId),
      OBJECTIVES_VALUE_DEFAULT,
    );
    assertSignedInt32(value, `stored objective ${objectiveId}`);
    return value;
  }

  private writeStoredValue(objectiveId: number, value: number): void {
    this.preferences.writeInt32(objectivesValueStorageKey(objectiveId), value);
  }
}

export function objectivesValueStorageKey(objectiveId: number): string {
  assertSignedInt32(objectiveId, 'objectiveId');
  return `${OBJECTIVES_VALUE_STORAGE_KEY_PREFIX}${objectiveId}`;
}

export function objectiveSelectorForFruitId(
  fruitId: number,
): FruitObjectiveSelector | null {
  assertSignedInt32(fruitId, 'fruitId');
  const selectors = FRUIT_OBJECTIVE_SELECTORS as Readonly<Record<number, FruitObjectiveSelector>>;
  return selectors[fruitId] ?? null;
}

export function objectiveDefinitionAt(
  sequencePosition: number,
): ObjectiveDefinition | null {
  assertSignedInt32(sequencePosition, 'sequencePosition');
  if (sequencePosition < 0 || sequencePosition >= OBJECTIVES_COUNT) {
    return null;
  }
  const id = OBJECTIVE_ORDER[sequencePosition];
  const rewardCoins = OBJECTIVE_REWARDS[sequencePosition];
  if (id === undefined || rewardCoins === undefined) {
    throw new Error(`Objective sequence position ${sequencePosition} has no recovered row`);
  }
  return Object.freeze({
    description: OBJECTIVE_DESCRIPTIONS[id],
    id,
    rewardCoins,
    sequencePosition,
    target: OBJECTIVE_TARGETS[id],
  });
}

export function objectiveRewardText(rewardCoins: number): string {
  assertSignedInt32(rewardCoins, 'rewardCoins');
  return `reward: ${rewardCoins} coins`;
}

function requiredObjectiveDefinitionAt(sequencePosition: number): ObjectiveDefinition {
  const objective = objectiveDefinitionAt(sequencePosition);
  if (objective === null) {
    throw new RangeError(`Objective sequence position ${sequencePosition} is unavailable`);
  }
  return objective;
}

function objectiveRewardAt(sequencePosition: number): number {
  const reward = OBJECTIVE_REWARDS[sequencePosition];
  if (reward === undefined) {
    throw new RangeError(`Objective reward position ${sequencePosition} is unavailable`);
  }
  return reward;
}

function objectiveTargetById(objectiveId: number): number {
  const target = OBJECTIVE_TARGETS[objectiveId];
  return target ?? 0;
}

function isObjectiveIdIn(
  objectiveId: ObjectiveId,
  ...permitted: readonly ObjectiveId[]
): boolean {
  return permitted.some((candidate) => candidate === objectiveId);
}

function assertSettingsPort(port: ObjectivesManagerSettingsPort): void {
  if (
    port === null
    || typeof port !== 'object'
    || typeof port.addObjectiveRewardCoins !== 'function'
    || typeof port.setCurrentObjective !== 'function'
    || typeof port.setFruitsCut !== 'function'
  ) {
    throw new TypeError('ObjectivesManager settings port is incomplete');
  }
  assertSettingsSnapshot(port.snapshot);
}

function assertSettingsSnapshot(snapshot: ObjectivesManagerSettingsSnapshot): void {
  if (snapshot === null || typeof snapshot !== 'object') {
    throw new TypeError('ObjectivesManager settings snapshot must be an object');
  }
  assertCurrentObjective(snapshot.currentObjective);
  assertSignedInt32(snapshot.fruitsCut, 'fruitsCut');
  assertSignedInt32(snapshot.totalCoins, 'totalCoins');
}

function assertPreferencePort(port: ObjectivesManagerInt32PreferencePort): void {
  if (
    port === null
    || typeof port !== 'object'
    || typeof port.readInt32 !== 'function'
    || typeof port.writeInt32 !== 'function'
  ) {
    throw new TypeError('ObjectivesManager preference port requires int32 read and write');
  }
}

function assertCurrentObjective(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > OBJECTIVES_COUNT) {
    throw new RangeError('currentObjective must be an integer from 0 through 52');
  }
}

function assertBoolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be a boolean`);
  }
}

function assertSignedInt32(value: number, label: string): void {
  if (
    !Number.isSafeInteger(value)
    || value < -0x8000_0000
    || value > 0x7fff_ffff
  ) {
    throw new RangeError(`${label} must be a signed 32-bit integer`);
  }
}
