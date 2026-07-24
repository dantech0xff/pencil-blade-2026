import {
  LOADING_AUDIO_PRELOAD_COUNT,
  LOADING_AUDIO_PRELOAD_STEPS,
  type LoadingAudioPreloadStep,
} from './loading-resource-contract';

export const LOADING_PROGRESS_DENOMINATOR = 61 as const;
export const LOADING_FINISH_DELAY_SECONDS = Math.fround(0.5);

export type LoadingPhase = 'delay' | 'finished' | 'preloading';

export interface LoadingFrameResult {
  readonly finishedThisFrame: boolean;
  readonly phase: LoadingPhase;
  readonly preload: LoadingAudioPreloadStep | null;
  readonly progress: number;
  readonly preloadCount: number;
}

/**
 * Exact frame-driven preload counter recovered from `LoadingScene::update(float)`.
 *
 * The first 62 updates issue one audio preload each. Progress divides the incremented
 * counter by 61, so update 61 first reaches full width and update 62 remains clamped.
 * The next update starts the recovered half-second finish delay.
 */
export class LoadingState {
  private delayElapsedSecondsValue = Math.fround(0);
  private phaseValue: LoadingPhase = 'preloading';
  private preloadCountValue = 0;

  get snapshot(): LoadingFrameResult {
    return this.result(null, false);
  }

  update(deltaSeconds: number): LoadingFrameResult {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (this.phaseValue === 'finished') {
      return this.result(null, false);
    }

    if (this.phaseValue === 'preloading') {
      if (this.preloadCountValue < LOADING_AUDIO_PRELOAD_COUNT) {
        const preload = LOADING_AUDIO_PRELOAD_STEPS[this.preloadCountValue];
        if (preload === undefined || preload.index !== this.preloadCountValue) {
          throw new Error('Loading audio preload contract is sparse or reordered');
        }
        this.preloadCountValue += 1;
        return this.result(preload, false);
      }
      this.phaseValue = 'delay';
      return this.result(null, false);
    }

    this.delayElapsedSecondsValue = Math.fround(
      this.delayElapsedSecondsValue + Math.fround(deltaSeconds),
    );
    if (this.delayElapsedSecondsValue < LOADING_FINISH_DELAY_SECONDS) {
      return this.result(null, false);
    }
    this.delayElapsedSecondsValue = LOADING_FINISH_DELAY_SECONDS;
    this.phaseValue = 'finished';
    return this.result(null, true);
  }

  private result(
    preload: LoadingAudioPreloadStep | null,
    finishedThisFrame: boolean,
  ): LoadingFrameResult {
    return Object.freeze({
      finishedThisFrame,
      phase: this.phaseValue,
      preload,
      progress: Math.fround(Math.min(
        1,
        this.preloadCountValue / LOADING_PROGRESS_DENOMINATOR,
      )),
      preloadCount: this.preloadCountValue,
    });
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be non-negative and finite`);
  }
}
