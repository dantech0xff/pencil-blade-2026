import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
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
  BASE_GAMEPLAY_PAUSE_ACTION_SECONDS,
  BASE_GAMEPLAY_PAUSE_OVERLAY_OPACITY,
  BASE_GAMEPLAY_PAUSE_Z_ORDER,
  BaseGameplayPauseState,
  createBaseGameplayPauseLayout,
} = await import(
  '../../../game/assets/scripts/domain/base-gameplay-pause-state.ts'
);

const EMPTY_CARD = Object.freeze({
  description: 'No bombs hit Crazy Mode',
  progress: '',
  reward: 'reward: 666 coins',
});

const PROGRESS_CARD = Object.freeze({
  description: '1000 fruits total',
  progress: '(1000 fruits to go)',
  reward: 'reward: 222 coins',
});

test('empty-progress 480 layout preserves recovered positions, scale quirk, and constants', () => {
  const layout = createBaseGameplayPauseLayout({
    contentScaleFactor: 2,
    objectiveBackgroundHeight: 206,
    objectiveBackgroundWidth: 552,
    viewportHeight: 800,
    viewportWidth: 480,
  }, '');

  assert.equal(BASE_GAMEPLAY_PAUSE_ACTION_SECONDS, 0.25);
  assert.equal(BASE_GAMEPLAY_PAUSE_OVERLAY_OPACITY, 65);
  assert.equal(BASE_GAMEPLAY_PAUSE_Z_ORDER, 1);
  assert.deepEqual(layout.pauseItemWorldPosition, { x: 72, y: 36 });
  assert.deepEqual(layout.objectiveBackgroundWorldPosition, { x: 240, y: 697 });
  assert.deepEqual(layout.resumeHidden, { x: -72, y: 400 });
  assert.deepEqual(layout.resumeShown, { x: 168, y: 400 });
  assert.deepEqual(layout.replayHidden, { x: 600, y: 400 });
  assert.deepEqual(layout.replayShown, { x: 312, y: 400 });
  assert.deepEqual(layout.quitHidden, { x: 600, y: 120 });
  assert.deepEqual(layout.quitShown, { x: 408, y: 120 });
  assert.deepEqual(layout.descriptionLocalPosition, {
    x: 276,
    y: 206 * 0.5845,
  });
  assert.deepEqual(layout.progressLocalPosition, {
    x: 276,
    y: 206 * 0.4335,
  });
  assert.deepEqual(layout.rewardLocalPosition, {
    x: 220.8,
    y: 206 * 0.335,
  });
  assert.deepEqual(layout.progressAnchor, { x: 0, y: 0.5 });
  assert.deepEqual(layout.rewardAnchor, { x: 0, y: 0.5 });
  assert.equal(layout.fontSize, 28.8);
});

test('non-empty progress selects only the recovered alternate initial label layout', () => {
  const layout = createBaseGameplayPauseLayout({
    contentScaleFactor: 1,
    objectiveBackgroundHeight: 291,
    objectiveBackgroundWidth: 792,
    viewportHeight: 1280,
    viewportWidth: 720,
  }, PROGRESS_CARD.progress);

  assert.deepEqual(layout.descriptionLocalPosition, {
    x: 396,
    y: 291 * 0.635,
  });
  assert.deepEqual(layout.rewardLocalPosition, {
    x: 316.8,
    y: 291 * 0.275,
  });
  assert.equal(layout.fontSize, 43.2);
});

test('pause ingress exposes UI immediately, moves for .25 seconds, then owns director pause', () => {
  const state = createState(EMPTY_CARD);
  assert.deepEqual(state.pauseIngress(PROGRESS_CARD), []);
  assert.deepEqual(state.snapshot.card, PROGRESS_CARD);
  assert.equal(state.snapshot.objectiveOverlayVisible, true);
  assert.equal(state.snapshot.optionsMenuEnabled, true);
  assert.equal(state.snapshot.optionsMenuVisible, true);
  assert.equal(state.snapshot.pauseMenuEnabled, false);
  assert.equal(state.snapshot.pauseMenuVisible, false);
  assert.equal(state.snapshot.pendingMoveCount, 3);
  assert.equal(state.snapshot.pendingCallbackCount, 1);

  assert.deepEqual(state.updateAction(0.125), []);
  assert.deepEqual(state.snapshot.resumePosition, { x: 48, y: 400 });
  assert.deepEqual(state.snapshot.replayPosition, { x: 456, y: 400 });
  assert.deepEqual(state.snapshot.quitPosition, { x: 504, y: 120 });
  assert.equal(state.snapshot.directorPauseOwned, false);

  assert.deepEqual(state.updateAction(0.125), [{ type: 'pause-director' }]);
  assert.deepEqual(state.snapshot.resumePosition, { x: 168, y: 400 });
  assert.deepEqual(state.snapshot.replayPosition, { x: 312, y: 400 });
  assert.deepEqual(state.snapshot.quitPosition, { x: 408, y: 120 });
  assert.equal(state.snapshot.directorPauseOwned, true);
  assert.equal(state.snapshot.pendingMoveCount, 0);
  assert.equal(state.snapshot.pendingCallbackCount, 0);
});

test('resume calls director first, hides overlay, shows pause, then disables options after egress', () => {
  const state = createState(EMPTY_CARD);
  state.pauseIngress(EMPTY_CARD);
  state.updateAction(0.25);

  assert.deepEqual(state.resumeEgress(), [{ type: 'resume-director' }]);
  assert.equal(state.snapshot.directorPauseOwned, false);
  assert.equal(state.snapshot.objectiveOverlayVisible, false);
  assert.equal(state.snapshot.pauseMenuEnabled, true);
  assert.equal(state.snapshot.pauseMenuVisible, true);
  assert.equal(state.snapshot.optionsMenuEnabled, true);
  assert.equal(state.snapshot.optionsMenuVisible, true);

  assert.deepEqual(state.updateAction(0.25), []);
  assert.deepEqual(state.snapshot.resumePosition, { x: -72, y: 400 });
  assert.deepEqual(state.snapshot.replayPosition, { x: 600, y: 400 });
  assert.deepEqual(state.snapshot.quitPosition, { x: 600, y: 120 });
  assert.equal(state.snapshot.optionsMenuEnabled, false);
  assert.equal(state.snapshot.optionsMenuVisible, false);
});

test('early resume preserves native race: pending ingress can pause after resume', () => {
  const state = createState(EMPTY_CARD);
  state.pauseIngress(EMPTY_CARD);
  state.updateAction(0.1);
  assert.deepEqual(state.resumeEgress(), [{ type: 'resume-director' }]);

  assert.deepEqual(state.updateAction(0.15), [{ type: 'pause-director' }]);
  assert.equal(state.snapshot.directorPauseOwned, true);
  assert.equal(state.snapshot.optionsMenuVisible, true);
  assert.equal(state.snapshot.pendingCallbackCount, 1);

  state.updateAction(0.1);
  assert.equal(state.snapshot.optionsMenuVisible, false);
  assert.deepEqual(state.dispose(), [{ type: 'resume-director' }]);
});

test('stopAllActions cancels Replay/Quit egress and teardown resumes only owned pause', () => {
  const active = createState(EMPTY_CARD);
  active.pauseIngress(EMPTY_CARD);
  active.updateAction(0.25);
  active.resumeEgress();
  active.stopAllActions();
  assert.equal(active.snapshot.pendingCallbackCount, 0);
  assert.equal(active.snapshot.pendingMoveCount, 0);
  assert.deepEqual(active.dispose(), []);
  assert.deepEqual(active.dispose(), []);

  const paused = createState(EMPTY_CARD);
  paused.pauseIngress(EMPTY_CARD);
  paused.updateAction(0.25);
  paused.stopAllActions();
  assert.deepEqual(paused.dispose(), [{ type: 'resume-director' }]);
});

test('refresh changes strings without recomputing construction-time label positions', () => {
  const state = createState(EMPTY_CARD);
  const initialDescriptionPosition = state.layout.descriptionLocalPosition;
  const initialRewardPosition = state.layout.rewardLocalPosition;
  state.pauseIngress(PROGRESS_CARD);
  assert.deepEqual(state.snapshot.card, PROGRESS_CARD);
  assert.equal(state.layout.descriptionLocalPosition, initialDescriptionPosition);
  assert.equal(state.layout.rewardLocalPosition, initialRewardPosition);
});

test('invalid input and disposed mutation fail closed', () => {
  assert.throws(
    () => createBaseGameplayPauseLayout({
      contentScaleFactor: 1,
      objectiveBackgroundHeight: 0,
      objectiveBackgroundWidth: 552,
      viewportHeight: 800,
      viewportWidth: 480,
    }, ''),
    /objectiveBackgroundHeight must be positive/,
  );
  assert.throws(
    () => new BaseGameplayPauseState({
      contentScaleFactor: 1,
      objectiveBackgroundHeight: 206,
      objectiveBackgroundWidth: 552,
      viewportHeight: 800,
      viewportWidth: 480,
    }, { ...EMPTY_CARD, reward: 1 } as never),
    /objective card reward must be a string/,
  );

  const state = createState(EMPTY_CARD);
  const beforeInvalidIngress = state.snapshot;
  assert.throws(
    () => state.pauseIngress({ ...PROGRESS_CARD, progress: 1 } as never),
    /objective card progress must be a string/,
  );
  assert.deepEqual(state.snapshot, beforeInvalidIngress);

  state.dispose();
  assert.throws(() => state.pauseIngress(EMPTY_CARD), /Disposed/);
  assert.throws(() => state.resumeEgress(), /Disposed/);
  assert.throws(() => state.stopAllActions(), /Disposed/);
  assert.deepEqual(state.updateAction(1), []);
});

function createState(
  card: typeof EMPTY_CARD | typeof PROGRESS_CARD,
): InstanceType<typeof BaseGameplayPauseState> {
  return new BaseGameplayPauseState({
    contentScaleFactor: 1,
    objectiveBackgroundHeight: 206,
    objectiveBackgroundWidth: 552,
    viewportHeight: 800,
    viewportWidth: 480,
  }, card);
}
