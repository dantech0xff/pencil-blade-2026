import { sys } from 'cc';

import {
  ClassicSettingsState,
  type ClassicInt32PreferencePort,
} from '../domain/classic-settings-state';

export interface ClassicStringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Adapts Creator's string storage to the native signed-integer Settings surface. */
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
}

/** Stable process-owned Settings state shared across Creator scene-reload compatibility. */
export class ClassicSettingsRuntime {
  /** Target-only recovery diagnostic; native normal-state load order remains unchanged. */
  readonly loadFailure: Error | null;
  readonly state: ClassicSettingsState;
  private readonly port: ClassicInt32PreferencePort;

  constructor(port: ClassicInt32PreferencePort) {
    assertPreferencePort(port);
    this.port = port;
    try {
      this.state = ClassicSettingsState.load(port);
      this.loadFailure = null;
    } catch (error) {
      this.state = ClassicSettingsState.defaults();
      this.loadFailure = normalizeError(error, 'Classic settings load failed');
    }
  }

  save(): void {
    if (this.loadFailure !== null) {
      throw new Error(
        `Classic settings save is disabled after load recovery: ${this.loadFailure.message}`,
      );
    }
    this.state.save(this.port);
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
  ) {
    throw new TypeError('Classic settings runtime requires an int32 preference port');
  }
}

function assertStorageKey(key: string): void {
  if (typeof key !== 'string' || key.length === 0) {
    throw new TypeError('Classic settings key must be a non-empty string');
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

function normalizeError(error: unknown, fallbackMessage: string): Error {
  return error instanceof Error ? error : new Error(`${fallbackMessage}: ${String(error)}`);
}
