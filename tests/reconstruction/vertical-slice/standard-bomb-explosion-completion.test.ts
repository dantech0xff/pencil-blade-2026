import assert from 'node:assert/strict';
import test from 'node:test';

import {
  StandardBombExplosionCompletion,
} from '../../../game/assets/scripts/domain/standard-bomb-explosion-completion.ts';

test('completion waits for natural finish and commits gameplay boundaries in order', () => {
  const completion = new StandardBombExplosionCompletion();
  const events: string[] = [];
  const port = {
    afterBombHit() {
      events.push('after-bomb-hit');
    },
    finishBombAfterHit() {
      events.push('finish-bomb');
      return true;
    },
    isBombDisposalCommitted() {
      return false;
    },
  };

  assert.equal(completion.drain(port), false);
  assert.deepEqual(events, []);
  assert.equal(completion.markNaturalFinish(), true);
  assert.equal(completion.markNaturalFinish(), false);
  assert.equal(completion.drain(port), true);
  assert.deepEqual(events, ['after-bomb-hit', 'finish-bomb']);
  assert.equal(completion.drain(port), true);
  assert.deepEqual(events, ['after-bomb-hit', 'finish-bomb']);
  assert.deepEqual(completion.snapshot(), {
    afterBombHitDone: true,
    bombDisposeQueued: true,
    complete: true,
    naturalFinishReached: true,
  });
});

test('after-bomb-hit failure retries both uncommitted boundaries', () => {
  const completion = new StandardBombExplosionCompletion();
  const events: string[] = [];
  let failAfterBombHit = true;
  completion.markNaturalFinish();

  const port = {
    afterBombHit() {
      events.push('after-bomb-hit');
      if (failAfterBombHit) {
        failAfterBombHit = false;
        throw new Error('injected after-bomb-hit failure');
      }
    },
    finishBombAfterHit() {
      events.push('finish-bomb');
      return true;
    },
    isBombDisposalCommitted() {
      return false;
    },
  };

  assert.throws(() => completion.drain(port), /injected after-bomb-hit failure/);
  assert.deepEqual(completion.snapshot(), {
    afterBombHitDone: false,
    bombDisposeQueued: false,
    complete: false,
    naturalFinishReached: true,
  });
  assert.equal(completion.drain(port), true);
  assert.deepEqual(events, [
    'after-bomb-hit',
    'after-bomb-hit',
    'finish-bomb',
  ]);
});

test('Bomb-disposal failure never repeats committed AfterBombHit', () => {
  const completion = new StandardBombExplosionCompletion();
  const events: string[] = [];
  let finishAttempt = 0;
  completion.markNaturalFinish();

  const port = {
    afterBombHit() {
      events.push('after-bomb-hit');
    },
    finishBombAfterHit() {
      finishAttempt += 1;
      events.push(`finish-bomb:${finishAttempt}`);
      if (finishAttempt === 1) {
        throw new Error('injected Bomb-disposal failure');
      }
      return true;
    },
    isBombDisposalCommitted() {
      return false;
    },
  };

  assert.throws(() => completion.drain(port), /injected Bomb-disposal failure/);
  assert.deepEqual(completion.snapshot(), {
    afterBombHitDone: true,
    bombDisposeQueued: false,
    complete: false,
    naturalFinishReached: true,
  });
  assert.equal(completion.drain(port), true);
  assert.deepEqual(events, [
    'after-bomb-hit',
    'finish-bomb:1',
    'finish-bomb:2',
  ]);
});

test('a rejected Bomb disposal remains uncommitted and retryable', () => {
  const completion = new StandardBombExplosionCompletion();
  let accept = false;
  completion.markNaturalFinish();
  const port = {
    afterBombHit() {},
    finishBombAfterHit() {
      return accept;
    },
    isBombDisposalCommitted() {
      return false;
    },
  };

  assert.throws(() => completion.drain(port), /rejected its finish disposal/);
  assert.equal(completion.snapshot().bombDisposeQueued, false);
  accept = true;
  assert.equal(completion.drain(port), true);
});

test('post-commit Bomb-disposal failure is surfaced once and never retried', () => {
  const completion = new StandardBombExplosionCompletion();
  let disposalCommitted = false;
  let finishAttempts = 0;
  completion.markNaturalFinish();
  const port = {
    afterBombHit() {},
    finishBombAfterHit() {
      finishAttempts += 1;
      disposalCommitted = true;
      throw new Error('observer failed after Bomb disposal committed');
    },
    isBombDisposalCommitted() {
      return disposalCommitted;
    },
  };

  assert.throws(
    () => completion.drain(port),
    /observer failed after Bomb disposal committed/,
  );
  assert.deepEqual(completion.snapshot(), {
    afterBombHitDone: true,
    bombDisposeQueued: true,
    complete: true,
    naturalFinishReached: true,
  });
  assert.equal(completion.drain(port), true);
  assert.equal(finishAttempts, 1);
});

test('an already-absent Bomb satisfies idempotent disposal completion', () => {
  const completion = new StandardBombExplosionCompletion();
  let finishAttempts = 0;
  completion.markNaturalFinish();
  const port = {
    afterBombHit() {},
    finishBombAfterHit() {
      finishAttempts += 1;
      return false;
    },
    isBombDisposalCommitted() {
      return true;
    },
  };

  assert.equal(completion.drain(port), true);
  assert.equal(completion.snapshot().bombDisposeQueued, true);
  assert.equal(completion.drain(port), true);
  assert.equal(finishAttempts, 1);
});
