import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  TIME_MANAGER_FREEZE_AUDIO_PATH,
  TIME_MANAGER_FREEZE_CLOCK_PATH,
  TIME_MANAGER_LABEL_FONT_PATH,
  TIME_MANAGER_NORMAL_COLOR,
  TIME_MANAGER_TICK_AUDIO_PATH,
  TIME_MANAGER_TIME_UP_AUDIO_PATH,
  TIME_MANAGER_TIME_UP_RASTER_PATH,
  TIME_MANAGER_WARNING_COLOR,
  TimeManagerService,
  createTimeManagerEntryPlan,
  createTimeManagerTimeUpPresentationPlan,
  formatTimeManagerCountdown,
} from '../../../game/assets/scripts/domain/time-manager-service.ts';

const VISIBLE_RECT = Object.freeze({
  center: Object.freeze({ x: 240, y: 400 }),
  height: 800,
  leftX: 0,
  rightX: 480,
  topY: 800,
  width: 480,
});

test('entry plan preserves exact label, freeze-clock resources, geometry, and z order', () => {
  assert.deepEqual(createTimeManagerEntryPlan({
    freezeClockHeight: 85,
    freezeClockWidth: 148,
    initialRemainingSeconds: 60,
    logicalHeight: 800,
    logicalWidth: 480,
    visibleRect: VISIBLE_RECT,
  }), {
    freezeClock: {
      initialVisible: false,
      rasterPath: TIME_MANAGER_FREEZE_CLOCK_PATH,
      worldPosition: { x: 406, y: 757.5 },
      zOrder: 1,
    },
    label: {
      color: TIME_MANAGER_NORMAL_COLOR,
      fadeInSeconds: 1,
      fontPath: TIME_MANAGER_LABEL_FONT_PATH,
      fontSize: 36,
      initialText: '60',
      worldPosition: { x: 408, y: 760 },
      zOrder: 1,
    },
  });

  const highResolution = createTimeManagerEntryPlan({
    freezeClockHeight: 127,
    freezeClockWidth: 222,
    initialRemainingSeconds: 60.9,
    logicalHeight: 1280,
    logicalWidth: 720,
    visibleRect: {
      center: { x: 360, y: 640 },
      height: 1280,
      leftX: 0,
      rightX: 720,
      topY: 1280,
      width: 720,
    },
  });
  assert.equal(highResolution.label.fontSize, 54);
  assert.equal(highResolution.label.initialText, '60');
  assert.deepEqual(highResolution.freezeClock.worldPosition, { x: 609, y: 1216.5 });
});

test('time-up presentation is a three-second center-crossing action with finish callback', () => {
  const plan = createTimeManagerTimeUpPresentationPlan({
    spriteHeight: 135,
    spriteWidth: 345,
    visibleRect: VISIBLE_RECT,
  });
  assert.deepEqual(plan, {
    actionSequence: [
      { durationSeconds: 1, position: { x: 240, y: 400 }, type: 'move-to' },
      { durationSeconds: 1, type: 'delay' },
      { durationSeconds: 1, position: { x: 652.5, y: 400 }, type: 'move-to' },
      { type: 'invoke-time-up-finish' },
    ],
    initialWorldPosition: { x: -172.5, y: 400 },
    rasterPath: TIME_MANAGER_TIME_UP_RASTER_PATH,
    totalActionSeconds: 3,
    zOrder: 1,
  });
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.actionSequence), true);
  assert.equal(plan.actionSequence.every(Object.isFrozen), true);
});

test('Start, Stop, setTotalTime, and Restart preserve recovered narrow mutations', () => {
  const manager = new TimeManagerService({
    effectsEnabled: () => true,
    totalSeconds: 60,
  });
  assert.deepEqual(manager.snapshot, {
    freezeClockColorByte: 255,
    freezeElapsedSeconds: 0,
    frozen: false,
    labelColor: TIME_MANAGER_NORMAL_COLOR,
    remainingSeconds: 60,
    scheduled: false,
    totalSeconds: 60,
    warningSecond: 10,
  });

  manager.start();
  manager.update(1.25);
  manager.freeze();
  manager.stop();
  assert.equal(manager.snapshot.scheduled, false);
  assert.equal(manager.snapshot.remainingSeconds, Math.fround(58.75));
  assert.equal(manager.snapshot.frozen, true);

  manager.restart();
  assert.equal(manager.snapshot.remainingSeconds, 60);
  assert.equal(manager.snapshot.warningSecond, 10);
  assert.equal(manager.snapshot.scheduled, false);
  assert.equal(manager.snapshot.frozen, true);

  manager.setTotalTime(30.5);
  assert.equal(manager.snapshot.totalSeconds, Math.fround(30.5));
  assert.equal(manager.snapshot.remainingSeconds, Math.fround(30.5));
  assert.equal(manager.snapshot.frozen, true);
});

test('countdown ticks exact displayed seconds, toggles colors, and preserves command order', () => {
  const manager = new TimeManagerService({
    effectsEnabled: () => true,
    totalSeconds: 11,
  });
  manager.start();

  assert.deepEqual(manager.update(0.1), [
    {
      canonicalPath: TIME_MANAGER_TICK_AUDIO_PATH,
      loop: false,
      type: 'request-audio',
    },
    { color: TIME_MANAGER_WARNING_COLOR, type: 'set-timer-label-color' },
    { text: '0:10', type: 'set-timer-label-text' },
  ]);
  assert.equal(manager.snapshot.warningSecond, 9);
  assert.equal(manager.snapshot.labelColor, TIME_MANAGER_WARNING_COLOR);

  assert.deepEqual(manager.update(1), [
    {
      canonicalPath: TIME_MANAGER_TICK_AUDIO_PATH,
      loop: false,
      type: 'request-audio',
    },
    { color: TIME_MANAGER_NORMAL_COLOR, type: 'set-timer-label-color' },
    { text: '0:09', type: 'set-timer-label-text' },
  ]);
  assert.equal(manager.snapshot.warningSecond, 8);
  assert.equal(manager.snapshot.labelColor, TIME_MANAGER_NORMAL_COLOR);
});

test('warning equality can be skipped and disabled effects consume no audio command', () => {
  const manager = new TimeManagerService({
    effectsEnabled: () => false,
    totalSeconds: 11,
  });
  manager.start();
  assert.deepEqual(manager.update(2), [
    { text: '0:09', type: 'set-timer-label-text' },
  ]);
  assert.equal(manager.snapshot.warningSecond, 10);
  assert.equal(manager.snapshot.labelColor, TIME_MANAGER_NORMAL_COLOR);
});

test('warning zero and expiry share one tick before Time Up callback and label write', () => {
  const manager = new TimeManagerService({
    effectsEnabled: () => true,
    totalSeconds: 10.5,
  });
  manager.start();
  manager.update(0.1);
  for (let expected = 9; expected >= 1; expected -= 1) {
    const commands = manager.update(1);
    assert.equal(commands.at(-1)?.type, 'set-timer-label-text');
    assert.equal(manager.snapshot.warningSecond, expected - 1);
  }
  const remainingBeforeExpiry = manager.snapshot.remainingSeconds;
  assert.ok(Math.abs(remainingBeforeExpiry - 1.4) < 1e-5);
  assert.equal(manager.snapshot.warningSecond, 0);

  const commands = manager.update(remainingBeforeExpiry);
  assert.deepEqual(commands, [
    {
      canonicalPath: TIME_MANAGER_TICK_AUDIO_PATH,
      loop: false,
      type: 'request-audio',
    },
    { color: TIME_MANAGER_WARNING_COLOR, type: 'set-timer-label-color' },
    {
      canonicalPath: TIME_MANAGER_TIME_UP_AUDIO_PATH,
      loop: false,
      type: 'request-audio',
    },
    { type: 'invoke-time-up' },
    { type: 'begin-time-up-presentation' },
    { text: '0:00', type: 'set-timer-label-text' },
  ]);
  assert.equal(manager.snapshot.scheduled, false);
  assert.equal(manager.snapshot.remainingSeconds, 0);
  assert.deepEqual(manager.timeUpPresentationFinished(), [
    { type: 'invoke-time-up-finish' },
  ]);
});

test('Freeze repeats without a guard and orders audio, world callback, show, then opacity', () => {
  let effectsEnabled = true;
  const manager = new TimeManagerService({
    effectsEnabled: () => effectsEnabled,
    totalSeconds: 60,
  });
  const expected = [
    {
      canonicalPath: TIME_MANAGER_FREEZE_AUDIO_PATH,
      loop: false,
      type: 'request-audio',
    },
    { colorByte: 255, type: 'set-freeze-clock-color' },
    { type: 'invoke-freeze-start' },
    { type: 'set-freeze-clock-visible', visible: true },
    { opacity: 0, type: 'set-freeze-clock-opacity' },
  ];
  assert.deepEqual(manager.freeze(), expected);
  manager.start();
  manager.update(2);
  assert.notEqual(manager.snapshot.freezeElapsedSeconds, 0);
  assert.deepEqual(manager.freeze(), expected);
  assert.equal(manager.snapshot.freezeElapsedSeconds, 0);

  effectsEnabled = false;
  assert.deepEqual(manager.freeze(), expected.slice(1));
});

test('frozen updates preserve remaining time and apply ramp, plateau, fade, then thaw order', () => {
  const manager = new TimeManagerService({
    effectsEnabled: () => false,
    totalSeconds: 60,
  });
  manager.start();
  manager.freeze();

  assert.deepEqual(manager.update(0.75), [
    { opacity: 127, type: 'set-freeze-clock-opacity' },
    { colorByte: 127, type: 'set-freeze-clock-color' },
  ]);
  assert.equal(manager.snapshot.remainingSeconds, 60);

  assert.deepEqual(manager.update(1), [
    { opacity: 255, type: 'set-freeze-clock-opacity' },
    { colorByte: 255, type: 'set-freeze-clock-color' },
  ]);
  assert.deepEqual(manager.update(12), [
    { opacity: 212, type: 'set-freeze-clock-opacity' },
    { colorByte: 212, type: 'set-freeze-clock-color' },
  ]);
  const retainedColor = manager.snapshot.freezeClockColorByte;

  assert.deepEqual(manager.update(1.25), [
    { type: 'invoke-freeze-finish' },
    { type: 'set-freeze-clock-visible', visible: false },
    { bonusType: 12, type: 'disable-bonus-type' },
    { colorByte: retainedColor, type: 'set-freeze-clock-color' },
  ]);
  assert.equal(manager.snapshot.frozen, false);
  assert.equal(manager.snapshot.remainingSeconds, 60);
  assert.equal(manager.snapshot.scheduled, true);
});

test('DisableFreeze has no guard and next thawed tick resumes countdown', () => {
  const manager = new TimeManagerService({
    effectsEnabled: () => false,
    totalSeconds: 60,
  });
  assert.deepEqual(manager.disableFreeze(), [
    { type: 'invoke-freeze-finish' },
    { type: 'set-freeze-clock-visible', visible: false },
    { bonusType: 12, type: 'disable-bonus-type' },
  ]);
  manager.start();
  manager.freeze();
  manager.disableFreeze();
  assert.deepEqual(manager.update(1), [
    { text: '0:59', type: 'set-timer-label-text' },
  ]);
  assert.equal(manager.snapshot.remainingSeconds, 59);
});

test('formatting retains signed truncation/remainder behavior without clamping', () => {
  assert.equal(formatTimeManagerCountdown(60), '1:00');
  assert.equal(formatTimeManagerCountdown(10.99), '0:10');
  assert.equal(formatTimeManagerCountdown(9.99), '0:09');
  assert.equal(formatTimeManagerCountdown(-1.1), '0:0-1');
  assert.equal(formatTimeManagerCountdown(-61.1), '-1:0-1');
});

test('invalid inputs fail before output and all exposed state/commands are immutable', () => {
  assert.throws(
    () => new TimeManagerService({ effectsEnabled: null as never, totalSeconds: 60 }),
    /effectsEnabled/,
  );
  assert.throws(
    () => new TimeManagerService({ effectsEnabled: () => true, totalSeconds: Infinity }),
    /finite/,
  );
  assert.throws(
    () => createTimeManagerEntryPlan({
      freezeClockHeight: 1,
      freezeClockWidth: 1,
      initialRemainingSeconds: 1,
      logicalHeight: 1,
      logicalWidth: 0,
      visibleRect: VISIBLE_RECT,
    }),
    /positive/,
  );
  assert.throws(
    () => createTimeManagerTimeUpPresentationPlan({
      spriteHeight: 1,
      spriteWidth: 0,
      visibleRect: VISIBLE_RECT,
    }),
    /positive/,
  );

  const manager = new TimeManagerService({
    effectsEnabled: () => true,
    totalSeconds: 60,
  });
  manager.start();
  assert.throws(() => manager.update(-1), /non-negative/);
  const commands = manager.freeze();
  assert.equal(Object.isFrozen(manager.snapshot), true);
  assert.equal(Object.isFrozen(commands), true);
  assert.equal(commands.every(Object.isFrozen), true);
});

test('invalid effects port cannot partially freeze or consume a warning countdown', () => {
  const manager = new TimeManagerService({
    effectsEnabled: (() => 'invalid') as never,
    totalSeconds: 60,
  });
  const beforeFreeze = manager.snapshot;
  assert.throws(() => manager.freeze(), /must return a boolean/);
  assert.deepEqual(manager.snapshot, beforeFreeze);

  manager.start();
  const beforeWarning = manager.snapshot;
  assert.throws(() => manager.update(50), /must return a boolean/);
  assert.deepEqual(manager.snapshot, beforeWarning);
});

test('the shared time domain has no Creator dependency', () => {
  const source = readFileSync(new URL(
    '../../../game/assets/scripts/domain/time-manager-service.ts',
    import.meta.url,
  ), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]cc['"]/);
});
