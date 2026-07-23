export interface StandardBombExplosionCompletionPort {
  readonly afterBombHit: () => void;
  readonly finishBombAfterHit: () => boolean;
  readonly isBombDisposalCommitted: () => boolean;
}

export interface StandardBombExplosionCompletionSnapshot {
  readonly afterBombHitDone: boolean;
  readonly bombDisposeQueued: boolean;
  readonly complete: boolean;
  readonly naturalFinishReached: boolean;
}

/**
 * Retry-safe handoff from the natural Bomb explosion finish into the two native gameplay
 * boundaries. A failed step never repeats an earlier committed step.
 */
export class StandardBombExplosionCompletion {
  private afterBombHitDoneValue = false;
  private bombDisposeQueuedValue = false;
  private naturalFinishReachedValue = false;

  markNaturalFinish(): boolean {
    const first = !this.naturalFinishReachedValue;
    this.naturalFinishReachedValue = true;
    return first;
  }

  drain(port: StandardBombExplosionCompletionPort): boolean {
    assertPort(port);
    if (!this.naturalFinishReachedValue) {
      return false;
    }
    if (!this.afterBombHitDoneValue) {
      port.afterBombHit();
      this.afterBombHitDoneValue = true;
    }
    if (!this.bombDisposeQueuedValue) {
      try {
        if (!port.finishBombAfterHit()) {
          if (!port.isBombDisposalCommitted()) {
            throw new Error('Standard Bomb rejected its finish disposal');
          }
        }
        this.bombDisposeQueuedValue = true;
      } catch (error) {
        // A synchronous after-step seam can unregister/destroy the Bomb and then surface an
        // observer failure. Record that committed boundary before reporting it so the next
        // frame never retries an entity that no longer exists.
        if (port.isBombDisposalCommitted()) {
          this.bombDisposeQueuedValue = true;
        }
        throw error;
      }
    }
    return true;
  }

  snapshot(): StandardBombExplosionCompletionSnapshot {
    return Object.freeze({
      afterBombHitDone: this.afterBombHitDoneValue,
      bombDisposeQueued: this.bombDisposeQueuedValue,
      complete: this.afterBombHitDoneValue && this.bombDisposeQueuedValue,
      naturalFinishReached: this.naturalFinishReachedValue,
    });
  }
}

function assertPort(port: StandardBombExplosionCompletionPort): void {
  if (
    port === null
    || typeof port !== 'object'
    || typeof port.afterBombHit !== 'function'
    || typeof port.finishBombAfterHit !== 'function'
    || typeof port.isBombDisposalCommitted !== 'function'
  ) {
    throw new TypeError(
      'Standard Bomb completion port must provide afterBombHit(), finishBombAfterHit(), '
        + 'and isBombDisposalCommitted()',
    );
  }
}
