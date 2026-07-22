import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const sys = { localStorage: null };
`)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') {
      return { shortCircuit: true, url: CC_STUB_URL };
    }
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
  ClassicCreatorInt32PreferencePort,
  ClassicSettingsRuntime,
} = await import('../../../game/assets/scripts/creator/classic-settings-runtime.ts');

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

test('Creator preference adapter round-trips canonical signed int32 decimals', () => {
  const storage = new MemoryStorage();
  const port = new ClassicCreatorInt32PreferencePort(storage);

  assert.equal(port.readInt32('missing', 2014), 2014);
  port.writeInt32('positive', 123);
  port.writeInt32('negative', -456);
  assert.equal(storage.values.get('positive'), '123');
  assert.equal(storage.values.get('negative'), '-456');
  assert.equal(port.readInt32('positive', 0), 123);
  assert.equal(port.readInt32('negative', 0), -456);
});

test('Creator preference adapter round-trips canonical lowercase booleans', () => {
  const storage = new MemoryStorage();
  const port = new ClassicCreatorInt32PreferencePort(storage);

  assert.equal(port.readBoolean('missing-true', true), true);
  assert.equal(port.readBoolean('missing-false', false), false);
  port.writeBoolean('enabled', true);
  port.writeBoolean('disabled', false);
  assert.equal(storage.values.get('enabled'), 'true');
  assert.equal(storage.values.get('disabled'), 'false');
  assert.equal(port.readBoolean('enabled', false), true);
  assert.equal(port.readBoolean('disabled', true), false);
});

test('runtime keeps mutations in memory and writes only on save', () => {
  const storage = new MemoryStorage();
  storage.values.set('total_coins', '3000');
  storage.values.set('classic_best_1', '30');
  storage.values.set('classic_best_2', '20');
  storage.values.set('classic_best_3', '10');
  storage.values.set('enable_effect', 'false');
  const runtime = new ClassicSettingsRuntime(
    new ClassicCreatorInt32PreferencePort(storage),
  );
  assert.equal(runtime.loadFailure, null);
  assert.equal(runtime.state.snapshot.effectsEnabled, false);

  runtime.state.recordClassicResultScore(40);
  runtime.state.awardClassicResultCoins(10);
  assert.equal(storage.values.get('total_coins'), '3000');
  assert.equal(storage.values.get('classic_best_1'), '30');

  runtime.save();
  assert.equal(storage.values.get('total_coins'), '3006');
  assert.equal(storage.values.get('classic_best_1'), '40');
  assert.equal(storage.values.get('classic_best_2'), '30');
  assert.equal(storage.values.get('classic_best_3'), '20');
  assert.equal(storage.values.get('enable_effect'), 'false');
});

test('Creator preference adapter fails closed on malformed or out-of-range data', () => {
  const storage = new MemoryStorage();
  const port = new ClassicCreatorInt32PreferencePort(storage);

  for (const invalid of ['', '+1', '01', '-0', '1.5', '2147483648']) {
    storage.values.set('bad', invalid);
    assert.throws(() => port.readInt32('bad', 0));
  }
  for (const invalid of ['', 'TRUE', 'False', '1', '0', ' true ', 'yes']) {
    storage.values.set('bad', invalid);
    assert.throws(() => port.readBoolean('bad', true), /canonical lowercase boolean/);
  }
  assert.throws(() => port.readInt32('', 0), /non-empty string/);
  assert.throws(() => port.writeInt32('bad', 0x8000_0000), /signed 32-bit integer/);
  assert.throws(() => port.readBoolean('bad', 'true' as never), /must be a boolean/);
  assert.throws(() => port.writeBoolean('bad', 1 as never), /must be a boolean/);
  assert.throws(
    () => new ClassicCreatorInt32PreferencePort(null as never),
    /must provide getItem and setItem/,
  );
  const foreignStorage = {
    getItem: () => 123,
    setItem() {},
  };
  assert.throws(
    () => new ClassicCreatorInt32PreferencePort(foreignStorage as never).readInt32('bad', 0),
    /not a string/,
  );
  assert.throws(
    () => new ClassicCreatorInt32PreferencePort(foreignStorage as never).readBoolean('bad', true),
    /not a string/,
  );
});

test('runtime recovers corrupt or unreadable target storage to exact defaults', () => {
  const corruptStorage = new MemoryStorage();
  corruptStorage.values.set('total_coins', '3000');
  corruptStorage.values.set('classic_best_1', '30');
  corruptStorage.values.set('classic_best_2', '20');
  corruptStorage.values.set('classic_best_3', '10');
  corruptStorage.values.set('enable_effect', 'TRUE');
  const corruptRuntime = new ClassicSettingsRuntime(
    new ClassicCreatorInt32PreferencePort(corruptStorage),
  );

  assert.match(corruptRuntime.loadFailure?.message ?? '', /canonical lowercase boolean/);
  assert.deepEqual(corruptRuntime.state.snapshot, {
    effectsEnabled: true,
    leaderboard: { first: 0, second: 0, third: 0 },
    totalCoins: 2014,
  });
  assert.throws(() => corruptRuntime.save(), /save is disabled after load recovery/);
  assert.equal(corruptStorage.values.get('total_coins'), '3000');
  assert.equal(corruptStorage.values.get('classic_best_1'), '30');
  assert.equal(corruptStorage.values.get('enable_effect'), 'TRUE');

  const readFailure = new Error('storage unavailable');
  let unavailableWrites = 0;
  const unavailableRuntime = new ClassicSettingsRuntime({
    readInt32() {
      throw readFailure;
    },
    writeInt32() {
      unavailableWrites += 1;
    },
    readBoolean() {
      throw readFailure;
    },
    writeBoolean() {
      unavailableWrites += 1;
    },
  });
  assert.equal(unavailableRuntime.loadFailure, readFailure);
  assert.equal(unavailableRuntime.state.snapshot.totalCoins, 2014);
  assert.throws(() => unavailableRuntime.save(), /save is disabled after load recovery/);
  assert.equal(unavailableWrites, 0);
  assert.throws(
    () => new ClassicSettingsRuntime(null as never),
    /requires an int32 and boolean preference port/,
  );
});
