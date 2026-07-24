import { sys } from 'cc';

import {
  CLASSIC_RATED_STORAGE_KEY,
  ClassicSettingsState,
  classicBackgroundPriceStorageKey,
  classicBladePriceStorageKey,
  classicModeUnlockStorageKey,
  type ClassicCosmeticPurchase,
  type ClassicInt32PreferencePort,
} from '../domain/classic-settings-state';
import {
  OBJECTIVES_VALUE_DEFAULT,
  OBJECTIVES_VALUE_STORAGE_KEY_PREFIX,
  ObjectivesManagerState,
  objectivesValueStorageKey,
  type ObjectiveAchievementPopupCallback,
  type ObjectivesManagerInt32PreferencePort,
} from '../domain/objectives-manager-state';

export interface ClassicStringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type ClassicCosmeticPurchaseWithCoins =
  | Readonly<{
      readonly kind: 'already-owned';
      readonly index: number;
      readonly price: 0;
      readonly totalCoins: number;
    }>
  | Readonly<{
      readonly kind: 'insufficient-coins';
      readonly index: number;
      readonly price: number;
      readonly totalCoins: number;
    }>
  | Readonly<{
      readonly kind: 'purchased';
      readonly index: number;
      readonly price: number;
      readonly totalCoins: number;
    }>;

/**
 * Adapts Creator's string storage to the recovered Settings subset.
 * Target booleans use only the canonical lowercase strings `true` and `false`.
 */
export class ClassicCreatorInt32PreferencePort implements ClassicInt32PreferencePort {
  private readonly storage: ClassicStringStorage;

  constructor(storage: ClassicStringStorage) {
    assertStorage(storage);
    this.storage = storage;
  }

  readInt32(key: string, defaultValue: number): number {
    assertStorageKey(key);
    assertSignedInt32(defaultValue, 'defaultValue');
    const stored = this.storage.getItem(key);
    if (stored === null) {
      return defaultValue;
    }
    if (typeof stored !== 'string') {
      throw new Error(`Classic integer preference ${key} is not a string`);
    }
    if (!/^(?:0|-?[1-9][0-9]*)$/.test(stored)) {
      throw new Error(`Classic integer preference ${key} is not canonical decimal int32`);
    }
    const value = Number(stored);
    assertSignedInt32(value, `stored ${key}`);
    return value;
  }

  writeInt32(key: string, value: number): void {
    assertStorageKey(key);
    assertSignedInt32(value, 'value');
    this.storage.setItem(key, String(value));
  }

  readBoolean(key: string, defaultValue: boolean): boolean {
    assertStorageKey(key);
    assertBoolean(defaultValue, 'defaultValue');
    const stored = this.storage.getItem(key);
    if (stored === null) {
      return defaultValue;
    }
    if (typeof stored !== 'string') {
      throw new Error(`Classic boolean preference ${key} is not a string`);
    }
    if (stored === 'true') {
      return true;
    }
    if (stored === 'false') {
      return false;
    }
    throw new Error(`Classic boolean preference ${key} is not a canonical lowercase boolean`);
  }

  writeBoolean(key: string, value: boolean): void {
    assertStorageKey(key);
    assertBoolean(value, 'value');
    this.storage.setItem(key, value ? 'true' : 'false');
  }
}

/** Stable process-owned Settings state shared across recovered same-parent layer replacements. */
export class ClassicSettingsRuntime {
  readonly state: ClassicSettingsState;
  private loadFailureValue: Error | null = null;
  private readonly port: ClassicInt32PreferencePort;

  constructor(port: ClassicInt32PreferencePort) {
    assertPreferencePort(port);
    this.port = port;
    try {
      const recovery = ClassicSettingsState.loadRecovering(port);
      this.state = recovery.state;
      this.loadFailureValue = recovery.failure;
    } catch (error) {
      this.state = ClassicSettingsState.defaults();
      this.loadFailureValue = normalizeError(error, 'Classic settings load failed');
    }
  }

  /** Target-only recovery diagnostic; native normal-state load order remains unchanged. */
  get loadFailure(): Error | null {
    return this.loadFailureValue;
  }

  save(): void {
    this.assertWritesEnabled('save');
    this.state.save(this.port);
  }

  purchaseBlade(index: number): ClassicCosmeticPurchase {
    const currentPrice = this.state.bladePriceAt(index);
    if (currentPrice === 0) {
      return this.state.markBladePurchased(index);
    }
    this.assertWritesEnabled('blade purchase');
    this.port.writeInt32(classicBladePriceStorageKey(index), 0);
    return this.state.markBladePurchased(index);
  }

  purchaseBackground(index: number): ClassicCosmeticPurchase {
    const currentPrice = this.state.backgroundPriceAt(index);
    if (currentPrice === 0) {
      return this.state.markBackgroundPurchased(index);
    }
    this.assertWritesEnabled('background purchase');
    this.port.writeInt32(classicBackgroundPriceStorageKey(index), 0);
    return this.state.markBackgroundPurchased(index);
  }

  /**
   * Commits ownership before applying the in-memory coin debit.
   *
   * Native code debits memory and then persists the zero-price sentinel. Reversing those two
   * operations preserves the successful observable result while avoiding a partial debit when
   * the durable ownership write fails.
   */
  purchaseBladeWithCoins(index: number): ClassicCosmeticPurchaseWithCoins {
    const price = this.state.bladePriceAt(index);
    return this.purchaseCosmeticWithCoins(
      index,
      price,
      classicBladePriceStorageKey(index),
      () => this.state.markBladePurchased(index),
      'blade purchase',
    );
  }

  /** See {@link purchaseBladeWithCoins} for the storage-first transaction contract. */
  purchaseBackgroundWithCoins(index: number): ClassicCosmeticPurchaseWithCoins {
    const price = this.state.backgroundPriceAt(index);
    return this.purchaseCosmeticWithCoins(
      index,
      price,
      classicBackgroundPriceStorageKey(index),
      () => this.state.markBackgroundPurchased(index),
      'background purchase',
    );
  }

  createObjectivesManager(
    onPopup: ObjectiveAchievementPopupCallback,
  ): ObjectivesManagerState {
    const preferences: ObjectivesManagerInt32PreferencePort = Object.freeze({
      readInt32: (key: string, defaultValue: number): number => (
        this.readImmediateObjectiveInt32(key, defaultValue)
      ),
      writeInt32: (key: string, value: number): void => {
        this.writeImmediateObjectiveInt32(key, value);
      },
    });
    return new ObjectivesManagerState(this.state, preferences, onPopup);
  }

  readObjectiveValue(objectiveId: number): number {
    return this.readImmediateObjectiveInt32(
      objectivesValueStorageKey(objectiveId),
      OBJECTIVES_VALUE_DEFAULT,
    );
  }

  /** Immediately commits one indexed objective value independently from bulk Settings save. */
  persistObjectiveValue(objectiveId: number, value: number): void {
    this.writeImmediateObjectiveInt32(objectivesValueStorageKey(objectiveId), value);
  }

  readModeUnlock(modeIndex: number): boolean {
    const storageKey = classicModeUnlockStorageKey(modeIndex);
    try {
      const unlocked = this.port.readBoolean(storageKey, false);
      assertBoolean(unlocked, storageKey);
      return unlocked;
    } catch (error) {
      const failure = normalizeError(error, `Classic mode unlock ${modeIndex} load failed`);
      this.loadFailureValue ??= failure;
      throw failure;
    }
  }

  /** Immediately commits the indexed unlock independently from bulk Settings save. */
  persistModeUnlock(modeIndex: number): void {
    const storageKey = classicModeUnlockStorageKey(modeIndex);
    this.assertWritesEnabled('mode unlock persistence');
    this.port.writeBoolean(storageKey, true);
  }

  /** Storage-only first step of the recovered review reward sequence. */
  persistRatedFlag(): void {
    this.assertWritesEnabled('rated flag persistence');
    this.port.writeBoolean(CLASSIC_RATED_STORAGE_KEY, true);
  }

  private readImmediateObjectiveInt32(key: string, defaultValue: number): number {
    assertObjectiveValueStorageKey(key);
    if (defaultValue !== OBJECTIVES_VALUE_DEFAULT) {
      throw new RangeError('Objective preference default must be zero');
    }
    try {
      const value = this.port.readInt32(key, defaultValue);
      assertSignedInt32(value, `stored ${key}`);
      return value;
    } catch (error) {
      const failure = normalizeError(error, `Objective value ${key} load failed`);
      this.loadFailureValue ??= failure;
      throw failure;
    }
  }

  private writeImmediateObjectiveInt32(key: string, value: number): void {
    assertObjectiveValueStorageKey(key);
    assertSignedInt32(value, 'objective value');
    this.assertWritesEnabled('objective value persistence');
    this.port.writeInt32(key, value);
  }

  private purchaseCosmeticWithCoins(
    index: number,
    price: number,
    storageKey: string,
    markPurchased: () => ClassicCosmeticPurchase,
    operation: string,
  ): ClassicCosmeticPurchaseWithCoins {
    const totalCoins = this.state.snapshot.totalCoins;
    if (price === 0) {
      return Object.freeze({
        index,
        kind: 'already-owned' as const,
        price: 0 as const,
        totalCoins,
      });
    }
    if (totalCoins < price) {
      return Object.freeze({
        index,
        kind: 'insufficient-coins' as const,
        price,
        totalCoins,
      });
    }

    this.assertWritesEnabled(operation);
    this.port.writeInt32(storageKey, 0);
    const purchase = markPurchased();
    if (!purchase.changed || purchase.previousPrice !== price) {
      throw new Error(`Classic settings ${operation} ownership transition changed unexpectedly`);
    }
    const debit = this.state.addTotalCoins(-price);
    return Object.freeze({
      index,
      kind: 'purchased' as const,
      price,
      totalCoins: debit.nextTotalCoins,
    });
  }

  private assertWritesEnabled(operation: string): void {
    if (this.loadFailureValue !== null) {
      throw new Error(
        `Classic settings ${operation} is disabled after load recovery: ${this.loadFailureValue.message}`,
      );
    }
  }
}

let sharedRuntime: ClassicSettingsRuntime | null = null;

export function getClassicSettingsRuntime(): ClassicSettingsRuntime {
  if (sharedRuntime === null) {
    sharedRuntime = new ClassicSettingsRuntime(
      new ClassicCreatorInt32PreferencePort(sys.localStorage as ClassicStringStorage),
    );
  }
  return sharedRuntime;
}

function assertStorage(storage: ClassicStringStorage): void {
  if (
    storage === null
    || typeof storage !== 'object'
    || typeof storage.getItem !== 'function'
    || typeof storage.setItem !== 'function'
  ) {
    throw new TypeError('Classic settings storage must provide getItem and setItem');
  }
}

function assertPreferencePort(port: ClassicInt32PreferencePort): void {
  if (
    port === null
    || typeof port !== 'object'
    || typeof port.readInt32 !== 'function'
    || typeof port.writeInt32 !== 'function'
    || typeof port.readBoolean !== 'function'
    || typeof port.writeBoolean !== 'function'
  ) {
    throw new TypeError('Classic settings runtime requires an int32 and boolean preference port');
  }
}

function assertStorageKey(key: string): void {
  if (typeof key !== 'string' || key.length === 0) {
    throw new TypeError('Classic settings key must be a non-empty string');
  }
}

function assertObjectiveValueStorageKey(key: string): void {
  assertStorageKey(key);
  if (!key.startsWith(OBJECTIVES_VALUE_STORAGE_KEY_PREFIX)) {
    throw new RangeError('Objective value key must use the recovered indexed prefix');
  }
  const suffix = key.slice(OBJECTIVES_VALUE_STORAGE_KEY_PREFIX.length);
  if (!/^(?:0|-?[1-9][0-9]*)$/.test(suffix)) {
    throw new RangeError('Objective value key must end in a canonical signed integer');
  }
  assertSignedInt32(Number(suffix), 'objectiveId');
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

function assertBoolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be a boolean`);
  }
}

function normalizeError(error: unknown, fallbackMessage: string): Error {
  return error instanceof Error ? error : new Error(`${fallbackMessage}: ${String(error)}`);
}
