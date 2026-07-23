import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BonusManagerState,
  RECOVERED_BONUS_IDS,
} from '../../../game/assets/scripts/domain/bonus-manager-state.ts';

test('BonusManager reset clears the three recovered static flags', () => {
  const state = new BonusManagerState();
  for (const bonusId of RECOVERED_BONUS_IDS) {
    state.enableBonusType(bonusId);
  }

  assert.deepEqual(state.snapshot(), {
    doubleScoreEnabled: true,
    doubleTossEnabled: true,
    freezeEnabled: true,
  });

  state.reset();

  assert.deepEqual(state.snapshot(), {
    doubleScoreEnabled: false,
    doubleTossEnabled: false,
    freezeEnabled: false,
  });
});

test('BonusManager enables and disables IDs 10, 11, and 12 independently', () => {
  const state = new BonusManagerState();

  for (const bonusId of RECOVERED_BONUS_IDS) {
    assert.equal(state.isEnabled(bonusId), false);
    state.enableBonusType(bonusId);
    assert.equal(state.isEnabled(bonusId), true);
    assert.equal(state.isBonusEnabled(bonusId), true);
    state.disableBonusType(bonusId);
    assert.equal(state.isEnabled(bonusId), false);
  }
});

test('unsupported native bonus IDs are ignored by mutations and read as enabled', () => {
  const state = new BonusManagerState();

  for (const bonusId of [-1, 0, 9, 13, 14, 99]) {
    state.enableBonusType(bonusId);
    assert.equal(state.isBonusEnabled(bonusId), true);
    state.disableBonusType(bonusId);
    assert.equal(state.isBonusEnabled(bonusId), true);
  }

  assert.deepEqual(state.snapshot(), {
    doubleScoreEnabled: false,
    doubleTossEnabled: false,
    freezeEnabled: false,
  });
});

test('BonusManager rejects non-integer inputs at its numeric native boundary', () => {
  const state = new BonusManagerState();

  assert.throws(() => state.enableBonusType(10.5), /safe integer/);
  assert.throws(() => state.disableBonusType(Number.NaN), /safe integer/);
  assert.throws(() => state.isBonusEnabled(Number.POSITIVE_INFINITY), /safe integer/);
});
