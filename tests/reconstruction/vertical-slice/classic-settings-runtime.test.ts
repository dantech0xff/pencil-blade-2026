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
  readonly writes: Array<readonly [string, string]> = [];

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes.push([key, value]);
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
  storage.values.set('enable_music', 'true');
  storage.values.set('enable_effect', 'false');
  storage.values.set('network_available', 'true');
  storage.values.set('rated', 'false');
  storage.values.set('selected_background', '8');
  storage.values.set('selected_blade', '17');
  storage.values.set('selected_theme', '9');
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
  assert.equal(storage.values.get('selected_theme'), '9');
  assert.equal(storage.values.get('selected_background'), '8');
  assert.equal(storage.values.get('selected_blade'), '17');
  assert.equal(storage.values.get('enable_music'), 'true');
  assert.equal(storage.values.get('enable_effect'), 'false');
  assert.equal(storage.values.get('network_available'), 'false');
  assert.equal(storage.values.get('rated'), 'false');
  assert.equal(runtime.state.snapshot.networkAvailable, true);
});

test('runtime preserves immediate rated and indexed unlock writes while coin changes stay in memory', () => {
  const storage = new MemoryStorage();
  storage.values.set('total_coins', '3000');
  storage.values.set('network_available', 'true');
  storage.values.set('mode_unlock_2', 'true');
  const runtime = new ClassicSettingsRuntime(
    new ClassicCreatorInt32PreferencePort(storage),
  );

  assert.equal(runtime.readModeUnlock(1), false);
  assert.equal(runtime.readModeUnlock(2), true);
  assert.equal(runtime.readModeUnlock(4), false);
  assert.equal(runtime.readModeUnlock(5), false);
  assert.deepEqual(storage.writes, []);

  for (const modeIndex of [1, 2, 4, 5]) {
    runtime.persistModeUnlock(modeIndex);
    assert.equal(storage.values.get(`mode_unlock_${modeIndex}`), 'true');
  }
  assert.deepEqual(storage.writes, [
    ['mode_unlock_1', 'true'],
    ['mode_unlock_2', 'true'],
    ['mode_unlock_4', 'true'],
    ['mode_unlock_5', 'true'],
  ]);

  const spend = runtime.state.addTotalCoins(-2500);
  assert.deepEqual(spend, {
    delta: -2500,
    nextTotalCoins: 500,
    previousTotalCoins: 3000,
  });
  assert.equal(storage.values.get('total_coins'), '3000');

  runtime.persistRatedFlag();
  assert.equal(storage.values.get('rated'), 'true');
  assert.equal(runtime.state.snapshot.rated, false);
  runtime.state.setRated(true);
  assert.deepEqual(runtime.state.addTotalCoins(500), {
    delta: 500,
    nextTotalCoins: 1000,
    previousTotalCoins: 500,
  });
  assert.deepEqual(storage.writes, [
    ['mode_unlock_1', 'true'],
    ['mode_unlock_2', 'true'],
    ['mode_unlock_4', 'true'],
    ['mode_unlock_5', 'true'],
    ['rated', 'true'],
  ]);
  assert.equal(storage.values.get('total_coins'), '3000');

  assert.throws(() => runtime.readModeUnlock(0), /1, 2, 4, or 5/);
  assert.throws(() => runtime.persistModeUnlock(3), /1, 2, 4, or 5/);
});

test('malformed indexed unlock data becomes diagnostic and disables every settings write', () => {
  const storage = new MemoryStorage();
  storage.values.set('mode_unlock_1', 'TRUE');
  const runtime = new ClassicSettingsRuntime(
    new ClassicCreatorInt32PreferencePort(storage),
  );

  assert.equal(runtime.loadFailure, null);
  assert.throws(() => runtime.readModeUnlock(1), /canonical lowercase boolean/);
  assert.match(runtime.loadFailure?.message ?? '', /canonical lowercase boolean/);
  assert.throws(() => runtime.persistModeUnlock(2), /disabled after load recovery/);
  assert.throws(() => runtime.persistRatedFlag(), /disabled after load recovery/);
  assert.throws(() => runtime.save(), /disabled after load recovery/);
  assert.deepEqual(storage.writes, []);
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
    musicEnabled: true,
    networkAvailable: false,
    rated: false,
    selectedBackground: 0,
    selectedBlade: 0,
    selectedTheme: 2,
    totalCoins: 2014,
  });
  assert.throws(() => corruptRuntime.save(), /save is disabled after load recovery/);
  assert.throws(
    () => corruptRuntime.persistModeUnlock(1),
    /mode unlock persistence is disabled after load recovery/,
  );
  assert.throws(
    () => corruptRuntime.persistRatedFlag(),
    /rated flag persistence is disabled after load recovery/,
  );
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

  const invalidSelectionStorage = new MemoryStorage();
  invalidSelectionStorage.values.set('selected_theme', '10');
  const invalidSelectionRuntime = new ClassicSettingsRuntime(
    new ClassicCreatorInt32PreferencePort(invalidSelectionStorage),
  );
  assert.match(invalidSelectionRuntime.loadFailure?.message ?? '', /selectedTheme/);
  assert.equal(invalidSelectionRuntime.state.snapshot.selectedTheme, 2);
  assert.throws(() => invalidSelectionRuntime.save(), /save is disabled after load recovery/);
});
