export type RecoveredResultMode = 0 | 1 | 2 | 3 | 4 | 5;

export type RecoveredResultObjectiveSelector = 1 | 2 | 3 | 19 | 20 | 21;

export interface RecoveredResultObjectiveCommand {
  readonly completedScore: number;
  readonly mode: RecoveredResultMode;
  readonly selector: RecoveredResultObjectiveSelector;
  readonly type: 'process-result-objective';
}

const SELECTOR_BY_MODE = Object.freeze([
  1,
  3,
  2,
  19,
  20,
  21,
] as const);

/**
 * Exact DisplayScoreLayer tail dispatch recovered from the six-entry native jump table.
 * Callers must execute this command only after Result attachment has committed.
 */
export function createRecoveredResultObjectiveCommand(
  mode: RecoveredResultMode,
  completedScore: number,
): RecoveredResultObjectiveCommand {
  assertRecoveredResultMode(mode);
  assertSignedInt32(completedScore, 'completedScore');
  const selector = SELECTOR_BY_MODE[mode];
  return Object.freeze({
    completedScore,
    mode,
    selector,
    type: 'process-result-objective',
  });
}

export function recoveredResultObjectiveSelector(
  mode: RecoveredResultMode,
): RecoveredResultObjectiveSelector {
  assertRecoveredResultMode(mode);
  return SELECTOR_BY_MODE[mode];
}

function assertRecoveredResultMode(value: number): asserts value is RecoveredResultMode {
  if (!Number.isInteger(value) || value < 0 || value >= SELECTOR_BY_MODE.length) {
    throw new RangeError('mode must be a recovered result mode from 0 through 5');
  }
}

function assertSignedInt32(value: number, label: string): void {
  if (
    !Number.isSafeInteger(value)
    || value < -0x8000_0000
    || value > 0x7fff_ffff
  ) {
    throw new RangeError(`${label} must fit a signed 32-bit integer`);
  }
}
