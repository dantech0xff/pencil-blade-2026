import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLASSIC_SWISH_COOLDOWN_ACTION_SECONDS,
  ClassicSwishAudioGate,
  type ClassicSwishAudioRandom,
} from '../../../game/assets/scripts/domain/classic-swish-audio-gate.ts';
import { getClassicSwishAudioPath } from '../../../game/assets/scripts/domain/classic-audio-contract.ts';

class ScriptedSwishRandom implements ClassicSwishAudioRandom {
  readonly calls: string[] = [];
  private readonly values: number[];

  constructor(values: readonly number[]) {
    this.values = [...values];
  }

  nextIntInclusive(minimum: number, maximum: number): number {
    this.calls.push(`int:${minimum}:${maximum}`);
    const value = this.values.shift();
    if (value === undefined) {
      throw new Error('scripted swish RNG exhausted');
    }
    return value;
  }
}

test('eligible swishes draw inclusive 0..8, map endpoints, lock, and explicitly unlock', () => {
  const random = new ScriptedSwishRandom([0, 8]);
  const gate = new ClassicSwishAudioGate(random);

  assert.deepEqual(gate.request(true, true), [
    { type: 'play-swish-audio', canonicalPath: 'Sounds/swoosh1.wav' },
    { type: 'unlock-swish-after', clock: 'action', delaySeconds: Math.fround(0.5) },
  ]);
  assert.equal(gate.locked, true);
  assert.deepEqual(random.calls, ['int:0:8']);

  assert.deepEqual(gate.request(true, true), []);
  assert.deepEqual(random.calls, ['int:0:8']);

  gate.unlock();
  assert.equal(gate.locked, false);
  assert.deepEqual(gate.request(true, true), [
    { type: 'play-swish-audio', canonicalPath: 'Sounds/swoosh9.wav' },
    { type: 'unlock-swish-after', clock: 'action', delaySeconds: Math.fround(0.5) },
  ]);
  assert.deepEqual(random.calls, ['int:0:8', 'int:0:8']);
});

test('every selected index maps exactly to the recovered swish audio contract', () => {
  const random = new ScriptedSwishRandom([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const gate = new ClassicSwishAudioGate(random);

  for (let soundIndex = 0; soundIndex <= 8; soundIndex += 1) {
    const play = gate.request(true, true)[0];
    assert.deepEqual(play, {
      type: 'play-swish-audio',
      canonicalPath: getClassicSwishAudioPath(soundIndex),
    });
    gate.unlock();
  }
  assert.deepEqual(random.calls, Array.from({ length: 9 }, () => 'int:0:8'));
});

test('effects-disabled eligible swish still draws and locks without an audio path', () => {
  const random = new ScriptedSwishRandom([4]);
  const gate = new ClassicSwishAudioGate(random);

  assert.deepEqual(gate.request(true, false), [
    { type: 'unlock-swish-after', clock: 'action', delaySeconds: Math.fround(0.5) },
  ]);
  assert.deepEqual(random.calls, ['int:0:8']);
  assert.equal(gate.locked, true);
  assert.deepEqual(gate.request(true, false), []);
  assert.deepEqual(random.calls, ['int:0:8']);
});

test('cooldown instruction uses the exact recovered float32 action duration', () => {
  assert.equal(CLASSIC_SWISH_COOLDOWN_ACTION_SECONDS, Math.fround(0.5));
  assert.equal(
    Object.is(CLASSIC_SWISH_COOLDOWN_ACTION_SECONDS, Math.fround(0.5)),
    true,
  );

  const instructions = new ClassicSwishAudioGate(new ScriptedSwishRandom([3]))
    .request(true, true);
  assert.equal(Object.isFrozen(instructions), true);
  assert.equal(Object.isFrozen(instructions[0]), true);
  assert.equal(Object.isFrozen(instructions[1]), true);
  assert.deepEqual(instructions.at(-1), {
    type: 'unlock-swish-after',
    clock: 'action',
    delaySeconds: CLASSIC_SWISH_COOLDOWN_ACTION_SECONDS,
  });
});

test('ineligible requests do not draw, emit instructions, or set the lock', () => {
  const random = new ScriptedSwishRandom([2]);
  const gate = new ClassicSwishAudioGate(random);

  assert.deepEqual(gate.request(false, true), []);
  assert.deepEqual(gate.request(false, false), []);
  assert.deepEqual(random.calls, []);
  assert.equal(gate.locked, false);

  assert.equal(
    gate.request(true, true)[0]?.type,
    'play-swish-audio',
  );
  assert.deepEqual(random.calls, ['int:0:8']);
});

test('invalid adapters, flags, and RNG output fail before mutating lock state', () => {
  assert.throws(() => new ClassicSwishAudioGate(null as never), TypeError);

  const validRandom = new ScriptedSwishRandom([1]);
  const gate = new ClassicSwishAudioGate(validRandom);
  assert.throws(() => gate.request(1 as never, true), TypeError);
  assert.throws(() => gate.request(true, 1 as never), TypeError);
  assert.equal(gate.locked, false);
  assert.deepEqual(validRandom.calls, []);

  for (const value of [-1, 1.5, 9]) {
    const invalidGate = new ClassicSwishAudioGate(new ScriptedSwishRandom([value]));
    assert.throws(() => invalidGate.request(true, true), RangeError);
    assert.equal(invalidGate.locked, false);
  }
});
