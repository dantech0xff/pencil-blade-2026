import {
  CRAZY_BIRD_MODE_ID,
  CRAZY_MODE_ID,
} from './crazy-toss-config';

export const CRAZY_MODE_BEST_SCORE_KEY = 'crazy_best_1' as const;
export const CRAZY_BIRD_MODE_BEST_SCORE_KEY = 'bird_crazy_best_1' as const;
export const CRAZY_CAPTURED_PARENT_BOUNDARY = 'captured-crazy-parent' as const;
export const CRAZY_BIRD_CAPTURED_PARENT_BOUNDARY
  = 'captured-crazy-bird-parent' as const;

export type CrazyTimedModeId =
  | typeof CRAZY_MODE_ID
  | typeof CRAZY_BIRD_MODE_ID;

export type CrazyTimedModeBestScoreKey =
  | typeof CRAZY_MODE_BEST_SCORE_KEY
  | typeof CRAZY_BIRD_MODE_BEST_SCORE_KEY;

export type CrazyTimedModeEntryCommand =
  | 'enter-base-gameplay-layer'
  | 'enter-base-bird-layer';

export type CrazyTimedModeCaptureCommand =
  | 'capture-crazy-parent'
  | 'capture-crazy-bird-parent';

export type CrazyTimedModeRemoveCommand =
  | 'remove-crazy'
  | 'remove-crazy-bird';

interface CrazyTimedModeProfileContract {
  readonly baseEntryCommand: CrazyTimedModeEntryCommand;
  readonly bestScoreKey: CrazyTimedModeBestScoreKey;
  readonly captureCommand: CrazyTimedModeCaptureCommand;
  readonly capturedParentBoundary:
    | typeof CRAZY_CAPTURED_PARENT_BOUNDARY
    | typeof CRAZY_BIRD_CAPTURED_PARENT_BOUNDARY;
  readonly kind: 'crazy' | 'crazy-bird';
  readonly mode: CrazyTimedModeId;
  readonly noBombObjectiveEventId: 8 | 9;
  readonly noDropObjectiveEventId: 4 | 5;
  readonly removeCommand: CrazyTimedModeRemoveCommand;
}

export const CRAZY_TIMED_PROFILE = Object.freeze({
  baseEntryCommand: 'enter-base-gameplay-layer',
  bestScoreKey: CRAZY_MODE_BEST_SCORE_KEY,
  captureCommand: 'capture-crazy-parent',
  capturedParentBoundary: CRAZY_CAPTURED_PARENT_BOUNDARY,
  kind: 'crazy',
  mode: CRAZY_MODE_ID,
  noBombObjectiveEventId: 8,
  noDropObjectiveEventId: 4,
  removeCommand: 'remove-crazy',
} satisfies CrazyTimedModeProfileContract);

export const CRAZY_BIRD_TIMED_PROFILE = Object.freeze({
  baseEntryCommand: 'enter-base-bird-layer',
  bestScoreKey: CRAZY_BIRD_MODE_BEST_SCORE_KEY,
  captureCommand: 'capture-crazy-bird-parent',
  capturedParentBoundary: CRAZY_BIRD_CAPTURED_PARENT_BOUNDARY,
  kind: 'crazy-bird',
  mode: CRAZY_BIRD_MODE_ID,
  noBombObjectiveEventId: 9,
  noDropObjectiveEventId: 5,
  removeCommand: 'remove-crazy-bird',
} satisfies CrazyTimedModeProfileContract);

export type CrazyTimedModeProfile =
  | typeof CRAZY_TIMED_PROFILE
  | typeof CRAZY_BIRD_TIMED_PROFILE;
