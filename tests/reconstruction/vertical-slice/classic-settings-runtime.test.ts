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

test('runtime keeps mutations in memory and writes only on save', () => {
  const storage = new MemoryStorage();
  storage.values.set('total_coins', '3000');
  storage.values.set('classic_best_1', '30');
  storage.values.set('classic_best_2', '20');
  storage.values.set('classic_best_3', '10');
  const runtime = new ClassicSettingsRuntime(
    new ClassicCreatorInt32PreferencePort(storage),
  );
  assert.equal(runtime.loadFailure, null);

  runtime.state.recordClassicResultScore(40);
  runtime.state.awardClassicResultCoins(10);
  assert.equal(storage.values.get('total_coins'), '3000');
  assert.equal(storage.values.get('classic_best_1'), '30');

  runtime.save();
  assert.equal(storage.values.get('total_coins'), '3006');
  assert.equal(storage.values.get('classic_best_1'), '40');
  assert.equal(storage.values.get('classic_best_2'), '30');
  assert.equal(storage.values.get('classic_best_3'), '20');
});

test('Creator preference adapter fails closed on malformed or out-of-range data', () => {
  const storage = new MemoryStorage();
  const port = new ClassicCreatorInt32PreferencePort(storage);

  for (const invalid of ['', '+1', '01', '-0', '1.5', '2147483648']) {
    storage.values.set('bad', invalid);
    assert.throws(() => port.readInt32('bad', 0));
  }
  assert.throws(() => port.readInt32('', 0), /non-empty string/);
  assert.throws(() => port.writeInt32('bad', 0x8000_0000), /signed 32-bit integer/);
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
});

test('runtime recovers corrupt or unreadable target storage to exact defaults', () => {
  const corruptStorage = new MemoryStorage();
  corruptStorage.values.set('total_coins', 'not-an-int');
  const corruptRuntime = new ClassicSettingsRuntime(
    new ClassicCreatorInt32PreferencePort(corruptStorage),
  );

  assert.match(corruptRuntime.loadFailure?.message ?? '', /canonical decimal int32/);
  assert.deepEqual(corruptRuntime.state.snapshot, {
    leaderboard: { first: 0, second: 0, third: 0 },
    totalCoins: 2014,
  });
  assert.throws(() => corruptRuntime.save(), /save is disabled after load recovery/);
  assert.equal(corruptStorage.values.get('total_coins'), 'not-an-int');
  assert.equal(corruptStorage.values.has('classic_best_1'), false);

  const readFailure = new Error('storage unavailable');
  let unavailableWrites = 0;
  const unavailableRuntime = new ClassicSettingsRuntime({
    readInt32() {
      throw readFailure;
    },
    writeInt32() {
      unavailableWrites += 1;
    },
  });
  assert.equal(unavailableRuntime.loadFailure, readFailure);
  assert.equal(unavailableRuntime.state.snapshot.totalCoins, 2014);
  assert.throws(() => unavailableRuntime.save(), /save is disabled after load recovery/);
  assert.equal(unavailableWrites, 0);
  assert.throws(
    () => new ClassicSettingsRuntime(null as never),
    /requires an int32 preference port/,
  );
});
