import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRecoveredResultObjectiveCommand,
  recoveredResultObjectiveSelector,
  type RecoveredResultMode,
} from '../../../game/assets/scripts/domain/recovered-result-objective.ts';

test('DisplayScore objective tail preserves the exact six-mode selector table', () => {
  const expected = Object.freeze([
    [0, 1],
    [1, 3],
    [2, 2],
    [3, 19],
    [4, 20],
    [5, 21],
  ] as const);

  for (const [mode, selector] of expected) {
    assert.equal(recoveredResultObjectiveSelector(mode), selector);
    const command = createRecoveredResultObjectiveCommand(mode, 321);
    assert.deepEqual(command, {
      completedScore: 321,
      mode,
      selector,
      type: 'process-result-objective',
    });
    assert.equal(Object.isFrozen(command), true);
  }
});

test('result objective commands retain signed-int32 score boundaries', () => {
  assert.equal(
    createRecoveredResultObjectiveCommand(5, -0x8000_0000).completedScore,
    -0x8000_0000,
  );
  assert.equal(
    createRecoveredResultObjectiveCommand(0, 0x7fff_ffff).completedScore,
    0x7fff_ffff,
  );
});

test('result objective dispatch rejects unknown modes and invalid scores', () => {
  for (const mode of [-1, 6, 1.5, Number.NaN]) {
    assert.throws(
      () => recoveredResultObjectiveSelector(mode as RecoveredResultMode),
      /mode must be a recovered result mode/,
    );
  }
  for (const score of [
    -0x8000_0001,
    0x8000_0000,
    1.5,
    Number.POSITIVE_INFINITY,
  ]) {
    assert.throws(
      () => createRecoveredResultObjectiveCommand(2, score),
      /completedScore must fit a signed 32-bit integer/,
    );
  }
});
