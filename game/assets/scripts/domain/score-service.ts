/** Recovered score state with presentation work exposed as explicit commands. */

export const DOUBLE_SCORE_BONUS_ID = 10;
export const DOUBLE_SCORE_INTRO_SECONDS = 1;
export const DOUBLE_SCORE_ACTIVE_SECONDS = 15;
export const DOUBLE_SCORE_EXIT_SECONDS = 1;
export const DISPLAY_SCORE_SCALE_SECONDS = Math.fround(0.025);

export type ScoreCommand =
  | Readonly<{
      type: 'start-double-score-presentation';
      activeDelaySeconds: 15;
      introDurationSeconds: 1;
    }>
  | Readonly<{
      type: 'finish-double-score-presentation';
      exitDurationSeconds: 1;
    }>
  | Readonly<{ type: 'disable-bonus'; bonusId: 10 }>
  | Readonly<{
      type: 'start-displayed-score-scale-up';
      durationSeconds: number;
      targetScale: 1.25;
    }>
  | Readonly<{
      type: 'start-displayed-score-scale-down';
      durationSeconds: number;
      targetScale: 1;
    }>;

export interface ScoreSnapshot {
  readonly authoritativeScore: number;
  readonly displayedScore: number;
  readonly doubleScoreActive: boolean;
  readonly displayedScoreScaleActive: boolean;
  readonly pendingDoubleScore: number;
}

const NO_SCORE_COMMANDS: readonly ScoreCommand[] = Object.freeze([]);
type DisplayedScoreScalePhase = 'idle' | 'up' | 'down';

export class ScoreService {
  private authoritativeScoreValue: number;
  private displayedScoreValue: number;
  private pendingDoubleScoreValue = 0;
  private doubleScoreActiveValue = false;
  private displayedScoreScalePhase: DisplayedScoreScalePhase = 'idle';

  constructor(initialAuthoritativeScore = 0, initialDisplayedScore = 0) {
    assertSafeInteger(initialAuthoritativeScore, 'initialAuthoritativeScore');
    assertSafeInteger(initialDisplayedScore, 'initialDisplayedScore');
    this.authoritativeScoreValue = initialAuthoritativeScore;
    this.displayedScoreValue = initialDisplayedScore;
  }

  get authoritativeScore(): number {
    return this.authoritativeScoreValue;
  }

  get displayedScore(): number {
    return this.displayedScoreValue;
  }

  get pendingDoubleScore(): number {
    return this.pendingDoubleScoreValue;
  }

  get doubleScoreActive(): boolean {
    return this.doubleScoreActiveValue;
  }

  snapshot(): ScoreSnapshot {
    return Object.freeze({
      authoritativeScore: this.authoritativeScoreValue,
      displayedScore: this.displayedScoreValue,
      doubleScoreActive: this.doubleScoreActiveValue,
      displayedScoreScaleActive: this.displayedScoreScalePhase !== 'idle',
      pendingDoubleScore: this.pendingDoubleScoreValue,
    });
  }

  /** Signed values enter the pending bucket for the whole double-score window. */
  addScore(value: number): void {
    assertSafeInteger(value, 'score');
    if (this.doubleScoreActiveValue) {
      this.pendingDoubleScoreValue = checkedAdd(
        this.pendingDoubleScoreValue,
        value,
        'pending double score',
      );
      return;
    }

    this.authoritativeScoreValue = checkedAdd(
      this.authoritativeScoreValue,
      value,
      'authoritative score',
    );
  }

  /**
   * Re-enabling is intentionally not guarded: recovered behavior activates the
   * flag and clears the pending bucket before starting another presentation.
   */
  enableDoubleScore(): readonly ScoreCommand[] {
    this.doubleScoreActiveValue = true;
    this.pendingDoubleScoreValue = 0;
    return Object.freeze([
      Object.freeze({
        type: 'start-double-score-presentation',
        activeDelaySeconds: DOUBLE_SCORE_ACTIVE_SECONDS,
        introDurationSeconds: DOUBLE_SCORE_INTRO_SECONDS,
      }),
    ]);
  }

  disableDoubleScore(): readonly ScoreCommand[] {
    return this.finishDoubleScore();
  }

  /** Disabled public finish/disable calls are recovered no-ops. */
  finishDoubleScore(): readonly ScoreCommand[] {
    if (!this.doubleScoreActiveValue) {
      return NO_SCORE_COMMANDS;
    }

    const doubledPending = checkedMultiply(
      this.pendingDoubleScoreValue,
      2,
      'doubled pending score',
    );
    checkedAdd(this.authoritativeScoreValue, doubledPending, 'authoritative score');

    // The active flag must be clear before the normal AddScore route is used.
    this.doubleScoreActiveValue = false;
    this.addScore(doubledPending);
    this.pendingDoubleScoreValue = 0;

    return Object.freeze([
      Object.freeze({
        type: 'finish-double-score-presentation',
        exitDurationSeconds: DOUBLE_SCORE_EXIT_SECONDS,
      }),
      Object.freeze({ type: 'disable-bonus', bonusId: DOUBLE_SCORE_BONUS_ID }),
    ]);
  }

  /**
   * Runs once per gameplay update. Upward smoothing waits for the presenter to
   * report the scale-up callback; downward smoothing subtracts one immediately.
   */
  updateDisplayedScore(): readonly ScoreCommand[] {
    if (this.displayedScoreValue > this.authoritativeScoreValue) {
      this.displayedScoreValue = checkedAdd(this.displayedScoreValue, -1, 'displayed score');
      return NO_SCORE_COMMANDS;
    }

    if (
      this.displayedScoreValue < this.authoritativeScoreValue
      && this.displayedScoreScalePhase === 'idle'
    ) {
      this.displayedScoreScalePhase = 'up';
      return Object.freeze([
        Object.freeze({
          type: 'start-displayed-score-scale-up',
          durationSeconds: DISPLAY_SCORE_SCALE_SECONDS,
          targetScale: 1.25,
        }),
      ]);
    }

    return NO_SCORE_COMMANDS;
  }

  /**
   * Recovered midpoint callback: queue the scale-down presentation first, then
   * advance the displayed integer from the gap observed at callback time.
   */
  completeDisplayedScoreScaleUp(): readonly ScoreCommand[] {
    if (this.displayedScoreScalePhase !== 'up') {
      throw new Error('Displayed-score scale-up is not active');
    }

    const command: ScoreCommand = Object.freeze({
      type: 'start-displayed-score-scale-down',
      durationSeconds: DISPLAY_SCORE_SCALE_SECONDS,
      targetScale: 1,
    });
    const gap = checkedSubtract(
      this.authoritativeScoreValue,
      this.displayedScoreValue,
      'displayed-score gap',
    );
    const increment = gap > 10 ? Math.trunc(gap * 0.1) : 1;
    const nextDisplayedScore = checkedAdd(
      this.displayedScoreValue,
      increment,
      'displayed score',
    );
    // Phase tracking is target-only validation around the recovered action callbacks.
    this.displayedScoreScalePhase = 'down';
    this.displayedScoreValue = nextDisplayedScore;
    return Object.freeze([command]);
  }

  /** Completion only clears the recovered in-flight presentation guard. */
  completeDisplayedScoreScaleDown(): void {
    if (this.displayedScoreScalePhase !== 'down') {
      throw new Error('Displayed-score scale-down is not active');
    }
    this.displayedScoreScalePhase = 'idle';
  }
}

/** Target-only validation prevents silent precision loss in JavaScript numbers. */
function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  assertSafeInteger(result, label);
  return result;
}

function checkedSubtract(left: number, right: number, label: string): number {
  const result = left - right;
  assertSafeInteger(result, label);
  return result;
}

function checkedMultiply(left: number, right: number, label: string): number {
  const result = left * right;
  assertSafeInteger(result, label);
  return result;
}
