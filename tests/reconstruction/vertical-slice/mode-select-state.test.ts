import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  MODE_SELECT_CARD_COUNT,
  MODE_SELECT_CAPTURED_PARENT_BOUNDARY,
  MODE_SELECT_GAMEPLAY_SELECTED_AUDIO_PATH,
  MODE_SELECT_INITIAL_CURRENT_INDEX,
  MODE_SELECT_INITIAL_DESTINATION_STATE,
  MODE_SELECT_LOCKABLE_INDICES,
  MODE_SELECT_LOCK_LOAD_COMMANDS,
  MODE_SELECT_MENU_BUTTON_AUDIO_PATH,
  MODE_SELECT_NAVIGATION_DELAY_SECONDS,
  MODE_SELECT_NAVIGATION_Z_ORDER,
  MODE_SELECT_TOTAL_COINS_STORAGE_KEY,
  MODE_SELECT_UNLOCK_PARTICLE_CLEANUP_DELAY_SECONDS,
  MODE_SELECT_UNLOCK_PARTICLE_COUNT,
  MODE_SELECT_UNLOCK_PARTICLE_DELAY_SECONDS,
  MODE_SELECT_UNLOCK_PARTICLE_DURATION_MAXIMUM_HUNDREDTHS,
  MODE_SELECT_UNLOCK_PARTICLE_DURATION_MINIMUM_HUNDREDTHS,
  MODE_SELECT_UNLOCK_PARTICLE_REMOVE_AT_SECONDS,
  MODE_SELECT_UNLOCK_PARTICLE_TEXTURE_PATH,
  MODE_SELECT_UNLOCK_PRICE,
  ModeSelectState,
  createModeSelectBackCommands,
  createModeSelectDelayedNavigationCommands,
  createModeSelectUnlockBurstPlan,
  createModeSelectUnlockParticleBurst,
  type ModeSelectLayoutInput,
} from '../../../game/assets/scripts/domain/mode-select-state.ts';

interface InclusiveCall {
  readonly maximumInclusive: number;
  readonly minimumInclusive: number;
}

class ScriptedRandom {
  readonly calls: InclusiveCall[] = [];
  private readonly draws: readonly number[];
  private offset = 0;

  constructor(draws: readonly number[]) {
    this.draws = draws;
  }

  nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number {
    this.calls.push(Object.freeze({ maximumInclusive, minimumInclusive }));
    const value = this.draws[this.offset];
    if (value === undefined) {
      throw new Error(`scripted random exhausted at draw ${this.offset}`);
    }
    this.offset += 1;
    return value;
  }

  get consumedDrawCount(): number {
    return this.offset;
  }
}

const DURATION_CALL = Object.freeze({ maximumInclusive: 70, minimumInclusive: 35 });
const SIGN_CALL = Object.freeze({ maximumInclusive: 1, minimumInclusive: -1 });
const COMPACT_MAGNITUDE_CALL = Object.freeze({
  maximumInclusive: 150,
  minimumInclusive: 50,
});

const COMPACT_LAYOUT: ModeSelectLayoutInput = Object.freeze({
  logicalHeight: 800,
  logicalWidth: 480,
  visibleCenterX: 240,
  visibleLeftX: 0,
});
const HIGH_LAYOUT: ModeSelectLayoutInput = Object.freeze({
  logicalHeight: 1280,
  logicalWidth: 720,
  visibleCenterX: 360,
  visibleLeftX: 0,
});

test('initial rail snapshots preserve both profile formulas, Combo centering, and constructor state', () => {
  const compact = new ModeSelectState({ layout: COMPACT_LAYOUT });
  const high = new ModeSelectState({
    layout: HIGH_LAYOUT,
    persistedUnlocks: { 1: true, 2: false, 4: true, 5: false },
  });
  const noncanonical = new ModeSelectState({
    layout: {
      logicalHeight: 900,
      logicalWidth: 480,
      visibleCenterX: 300,
      visibleLeftX: 60,
    },
  });

  assert.equal(MODE_SELECT_CARD_COUNT, 6);
  assert.equal(MODE_SELECT_INITIAL_CURRENT_INDEX, 0);
  assert.equal(MODE_SELECT_INITIAL_DESTINATION_STATE, -1);
  assert.deepEqual(compact.snapshot, {
    anchorXs: [-2160, -1680, -1200, -720, -240, 240],
    cardLocks: [false, true, true, false, true, true],
    currentIndex: 0,
    destinationState: -1,
    layout: COMPACT_LAYOUT,
  });
  assert.deepEqual(high.snapshot.anchorXs, [
    -3240,
    -2520,
    -1800,
    -1080,
    -360,
    360,
  ]);
  assert.deepEqual(high.snapshot.cardLocks, [false, false, true, false, false, true]);
  assert.deepEqual(noncanonical.snapshot.anchorXs, [
    -2100,
    -1620,
    -1140,
    -660,
    -180,
    300,
  ]);
  assert.equal(compact.snapshot.anchorXs[5], compact.snapshot.layout.visibleCenterX);
  assert.equal(high.snapshot.anchorXs[5], high.snapshot.layout.visibleCenterX);
  assert.equal(noncanonical.snapshot.anchorXs[5], 300);

  const snapshot = compact.snapshot;
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.layout), true);
  assert.equal(Object.isFrozen(snapshot.anchorXs), true);
  assert.equal(Object.isFrozen(snapshot.cardLocks), true);
});

test('only indices 1, 2, 4, and 5 load persisted locks with absent keys defaulting false', () => {
  assert.deepEqual(MODE_SELECT_LOCKABLE_INDICES, [1, 2, 4, 5]);
  assert.deepEqual(MODE_SELECT_LOCK_LOAD_COMMANDS, [
    { defaultValue: false, modeIndex: 1, storageKey: 'mode_unlock_1', type: 'read-mode-unlock' },
    { defaultValue: false, modeIndex: 2, storageKey: 'mode_unlock_2', type: 'read-mode-unlock' },
    { defaultValue: false, modeIndex: 4, storageKey: 'mode_unlock_4', type: 'read-mode-unlock' },
    { defaultValue: false, modeIndex: 5, storageKey: 'mode_unlock_5', type: 'read-mode-unlock' },
  ]);
  assert.equal(Object.isFrozen(MODE_SELECT_LOCKABLE_INDICES), true);
  assert.equal(Object.isFrozen(MODE_SELECT_LOCK_LOAD_COMMANDS), true);
  assert.equal(MODE_SELECT_LOCK_LOAD_COMMANDS.every(Object.isFrozen), true);
  assert.deepEqual(new ModeSelectState({
    layout: COMPACT_LAYOUT,
    persistedUnlocks: {},
  }).snapshot.cardLocks, [false, true, true, false, true, true]);
});

test('drag applies its direct delta after pre-checks and refreshes current index after every callback', () => {
  const state = new ModeSelectState({ layout: COMPACT_LAYOUT });

  assert.deepEqual(state.drag(-1000), {
    appliedDeltaX: -1000,
    currentIndex: 5,
    moved: true,
  });
  assert.deepEqual(state.snapshot.anchorXs, [-3160, -2680, -2200, -1720, -1240, -760]);

  assert.deepEqual(state.drag(-1), {
    appliedDeltaX: 0,
    currentIndex: 5,
    moved: false,
  });
  assert.deepEqual(state.snapshot.anchorXs, [-3160, -2680, -2200, -1720, -1240, -760]);

  const zero = new ModeSelectState({ layout: COMPACT_LAYOUT });
  assert.equal(zero.snapshot.currentIndex, 0);
  assert.deepEqual(zero.drag(0), {
    appliedDeltaX: 0,
    currentIndex: 5,
    moved: false,
  });
});

test('drag uses the strict last-qualifying rule rather than nearest card selection', () => {
  const notNearest = new ModeSelectState({ layout: COMPACT_LAYOUT });
  notNearest.drag(479);
  assert.equal(notNearest.snapshot.anchorXs[4], 239);
  assert.equal(notNearest.snapshot.anchorXs[5], 719);
  assert.equal(notNearest.snapshot.currentIndex, 5);

  const strictThreshold = new ModeSelectState({ layout: COMPACT_LAYOUT });
  strictThreshold.drag(480);
  assert.equal(strictThreshold.snapshot.anchorXs[5], 720);
  assert.equal(strictThreshold.snapshot.currentIndex, 4);
});

test('one direct drag may cross a bound; later events use VisibleRect left and raw W', () => {
  const leftBound = new ModeSelectState({
    layout: {
      logicalHeight: 800,
      logicalWidth: 480,
      visibleCenterX: 300,
      visibleLeftX: 100,
    },
  });
  assert.equal(leftBound.drag(-250).moved, true);
  assert.equal(leftBound.snapshot.anchorXs[5], 50);
  assert.equal(leftBound.drag(-10).moved, false);
  assert.equal(leftBound.snapshot.anchorXs[5], 50);

  const rightBound = new ModeSelectState({
    layout: {
      logicalHeight: 800,
      logicalWidth: 480,
      visibleCenterX: 200,
      visibleLeftX: -100,
    },
  });
  assert.equal(rightBound.drag(2690).moved, true);
  assert.equal(rightBound.snapshot.anchorXs[0], 490);
  assert.equal(rightBound.drag(1).moved, false);
  assert.equal(rightBound.snapshot.anchorXs[0], 490);
});

test('bounded flick changes only current index and leaves the rail untouched', () => {
  const state = new ModeSelectState({ layout: COMPACT_LAYOUT });
  const initialAnchors = state.snapshot.anchorXs;

  assert.deepEqual(state.flick(10), { changed: false, currentIndex: 0, previousIndex: 0 });
  assert.deepEqual(state.flick(-10), { changed: true, currentIndex: 1, previousIndex: 0 });
  assert.deepEqual(state.flick(0), { changed: false, currentIndex: 1, previousIndex: 1 });
  assert.deepEqual(state.flick(10), { changed: true, currentIndex: 0, previousIndex: 1 });
  assert.deepEqual(state.snapshot.anchorXs, initialAnchors);

  state.drag(0);
  assert.equal(state.snapshot.currentIndex, 5);
  assert.deepEqual(state.flick(-1), { changed: false, currentIndex: 5, previousIndex: 5 });
  assert.deepEqual(state.flick(1), { changed: true, currentIndex: 4, previousIndex: 5 });
  assert.deepEqual(state.snapshot.anchorXs, initialAnchors);
});

test('unpressed updates begin the recovered Combo-to-Classic movement with exact float32 math', () => {
  const state = new ModeSelectState({ layout: COMPACT_LAYOUT });

  assert.deepEqual(state.updateFrame(false), {
    appliedDeltaX: 241,
    centerDifference: 2400,
    pressed: false,
  });
  assert.deepEqual(state.snapshot.anchorXs, [-1919, -1439, -959, -479, 1, 481]);
  assert.equal(state.snapshot.currentIndex, 0);
});

test('pressed frames do not move and strict |d| > 2 selects easing versus exact snap', () => {
  const pressed = nearCenteredState(2637.5);
  const beforePressed = pressed.snapshot;
  assert.deepEqual(pressed.updateFrame(true), {
    appliedDeltaX: 0,
    centerDifference: null,
    pressed: true,
  });
  assert.deepEqual(pressed.snapshot, beforePressed);

  const positiveSnap = nearCenteredState(2638);
  assert.deepEqual(positiveSnap.updateFrame(false), {
    appliedDeltaX: 2,
    centerDifference: 2,
    pressed: false,
  });
  assert.equal(positiveSnap.snapshot.anchorXs[0], 240);

  const negativeSnap = nearCenteredState(2642);
  assert.deepEqual(negativeSnap.updateFrame(false), {
    appliedDeltaX: -2,
    centerDifference: -2,
    pressed: false,
  });
  assert.equal(negativeSnap.snapshot.anchorXs[0], 240);

  const eased = nearCenteredState(2637.5);
  assert.deepEqual(eased.updateFrame(false), {
    appliedDeltaX: 1.25,
    centerDifference: 2.5,
    pressed: false,
  });
  assert.equal(eased.snapshot.anchorXs[0], 238.75);

  const centered = nearCenteredState(2640);
  assert.deepEqual(centered.updateFrame(false), {
    appliedDeltaX: 0,
    centerDifference: 0,
    pressed: false,
  });
  assert.equal(centered.snapshot.anchorXs[0], 240);
});

test('all six callbacks map identity states and every selection emits another 0.75-second sequence', () => {
  const destinations = [
    'ClassicModeLayer',
    'CrazyModeLayer',
    'GNStyleLayer',
    'ClassicBirdLayer',
    'CrazyBirdLayer',
    'ComboBirdLayer',
  ] as const;
  const expectedSchedule = {
    delaySeconds: Math.fround(0.75),
    readsDestinationAtExecution: true,
    repeatable: true,
    type: 'schedule-mode-navigation',
  };

  assert.equal(MODE_SELECT_NAVIGATION_DELAY_SECONDS, Math.fround(0.75));
  assert.equal(MODE_SELECT_GAMEPLAY_SELECTED_AUDIO_PATH, 'Sounds/gameplayselected.wav');
  for (let modeIndex = 0; modeIndex < MODE_SELECT_CARD_COUNT; modeIndex += 1) {
    const state = new ModeSelectState({ layout: COMPACT_LAYOUT });
    assert.deepEqual(state.selectMode(modeIndex, true), [
      {
        canonicalPath: 'Sounds/gameplayselected.wav',
        loop: false,
        type: 'request-gameplay-selected-audio',
      },
      expectedSchedule,
    ]);
    assert.equal(state.snapshot.destinationState, modeIndex);
    assert.deepEqual(state.delayedNavigationCommands(), [
      { boundary: 'captured-mode-select-parent', type: 'capture-mode-select-parent' },
      { cleanup: true, type: 'remove-mode-select' },
      {
        destination: destinations[modeIndex],
        destinationState: modeIndex,
        fresh: true,
        type: 'construct-mode-destination',
      },
      {
        boundary: 'captured-mode-select-parent',
        destination: destinations[modeIndex],
        destinationState: modeIndex,
        type: 'attach-mode-destination-to-captured-parent',
        zOrder: 1,
      },
    ]);
  }

  const repeated = new ModeSelectState({ layout: COMPACT_LAYOUT });
  const first = repeated.selectMode(0, false);
  const second = repeated.selectMode(5, false);
  assert.deepEqual(first, [expectedSchedule]);
  assert.deepEqual(second, [expectedSchedule]);
  assert.equal(repeated.snapshot.destinationState, 5);
  assert.deepEqual(repeated.delayedNavigationCommands(), repeated.delayedNavigationCommands());
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first[0]), true);
});

test('delayed navigation removes first and adds nothing for an out-of-range stored state', () => {
  assert.equal(MODE_SELECT_CAPTURED_PARENT_BOUNDARY, 'captured-mode-select-parent');
  assert.equal(MODE_SELECT_NAVIGATION_Z_ORDER, 1);
  for (const destinationState of [-1, 6, 99]) {
    assert.deepEqual(createModeSelectDelayedNavigationCommands(destinationState), [
      { boundary: 'captured-mode-select-parent', type: 'capture-mode-select-parent' },
      { cleanup: true, type: 'remove-mode-select' },
    ]);
  }
});

test('button and back-key delegation share immediate click-stop-remove-main-menu order', () => {
  assert.equal(MODE_SELECT_MENU_BUTTON_AUDIO_PATH, 'Sounds/menubuttonclick.wav');
  const enabled = createModeSelectBackCommands(true);
  assert.deepEqual(enabled, [
    {
      canonicalPath: 'Sounds/menubuttonclick.wav',
      loop: false,
      type: 'request-menu-button-audio',
    },
    { type: 'stop-all-mode-select-actions' },
    { boundary: 'captured-mode-select-parent', type: 'capture-mode-select-parent' },
    { cleanup: true, type: 'remove-mode-select' },
    { fresh: true, type: 'construct-main-menu' },
    {
      boundary: 'captured-mode-select-parent',
      type: 'attach-main-menu-to-captured-parent',
      zOrder: 1,
    },
  ]);
  assert.deepEqual(createModeSelectBackCommands(false), enabled.slice(1));
  assert.deepEqual(createModeSelectBackCommands(true), enabled);
  assert.equal(enabled.some((command) => 'delaySeconds' in command), false);
  assert.equal(Object.isFrozen(enabled), true);
  assert.equal(enabled.every(Object.isFrozen), true);
});

test('strict unlock threshold preserves coin-memory, immediate unlock-key, hide, and burst order', () => {
  assert.equal(MODE_SELECT_UNLOCK_PRICE, 2500);
  assert.equal(MODE_SELECT_TOTAL_COINS_STORAGE_KEY, 'total_coins');
  const insufficientState = stateAtIndex(1);
  const beforeFailure = insufficientState.snapshot;
  const insufficient = insufficientState.unlockCurrentMode(2499);
  assert.equal(insufficient.success, false);
  assert.equal(insufficient.nextTotalCoins, 2499);
  assert.equal(insufficient.burstPlan, null);
  assert.deepEqual(insufficientState.snapshot, beforeFailure);

  const state = stateAtIndex(1);
  const outcome = state.unlockCurrentMode(2500);
  assert.equal(outcome.success, true);
  assert.equal(outcome.modeIndex, 1);
  assert.equal(outcome.nextTotalCoins, 0);
  assert.equal(state.snapshot.cardLocks[1], false);
  assert.deepEqual(outcome.commands.map(({ type }) => type), [
    'set-process-total-coins',
    'persist-mode-unlock',
    'unlock-rope-button',
    'construct-unlock-particle-container',
    'position-unlock-particle-container',
    'configure-unlock-particle-container',
    'attach-unlock-particle-container',
  ]);
  assert.deepEqual(outcome.commands[0], {
    flushCalled: true,
    fromRereadValue: 2500,
    persistence: 'process-memory-until-save-data',
    storageKey: 'total_coins',
    type: 'set-process-total-coins',
    value: 0,
    writesStorageKey: false,
  });
  assert.deepEqual(outcome.commands[1], {
    flushImmediately: true,
    modeIndex: 1,
    storageKey: 'mode_unlock_1',
    type: 'persist-mode-unlock',
    value: true,
  });
  assert.deepEqual(outcome.commands[2], {
    fruitCutDisabled: false,
    lockMenuVisible: false,
    modeIndex: 1,
    removesLockMenu: false,
    type: 'unlock-rope-button',
  });
  assert.equal(Object.isFrozen(outcome), true);
  assert.equal(Object.isFrozen(outcome.commands), true);
  assert.equal(outcome.commands.every(Object.isFrozen), true);
});

test('all four lockable current indices target their own unlock key without using sender identity', () => {
  for (const modeIndex of MODE_SELECT_LOCKABLE_INDICES) {
    const state = stateAtIndex(modeIndex);
    const outcome = state.unlockCurrentMode(5000);
    assert.equal(outcome.modeIndex, modeIndex);
    assert.equal(outcome.success, true);
    assert.equal(state.snapshot.cardLocks[modeIndex], false);
    const persist = outcome.commands.find(({ type }) => type === 'persist-mode-unlock');
    assert.deepEqual(persist, {
      flushImmediately: true,
      modeIndex,
      storageKey: `mode_unlock_${modeIndex}`,
      type: 'persist-mode-unlock',
      value: true,
    });
  }
});

test('repeated insufficient attempts attach overlapping show-opacity-fade sequences without cancellation', () => {
  const state = stateAtIndex(2);
  const first = state.unlockCurrentMode(0);
  const second = state.unlockCurrentMode(0);

  assert.deepEqual(first.commands, [
    { type: 'show-insufficient-coins-label', visible: true },
    { opacity: 0, type: 'set-insufficient-coins-label-opacity' },
    {
      actions: [
        { seconds: Math.fround(0.5), type: 'fade-in' },
        { seconds: Math.fround(1), type: 'delay' },
        { seconds: Math.fround(0.5), type: 'fade-out' },
      ],
      cancelsExistingActions: false,
      permitsOverlap: true,
      type: 'attach-insufficient-coins-action-sequence',
    },
  ]);
  assert.deepEqual(second.commands, first.commands);
  assert.equal(first.commands.some(({ type }) => type.includes('audio')), false);
  assert.equal(first.commands.some(({ type }) => type.includes('particle')), false);
  assert.equal(first.commands.some(({ type }) => type === 'set-process-total-coins'), false);
  assert.equal(first.commands.some(({ type }) => type === 'persist-mode-unlock'), false);
  assert.equal(state.snapshot.cardLocks[2], true);
});

test('unlock burst config preserves both profile distance formulas, position, flags, and timeline', () => {
  const compact = createModeSelectUnlockBurstPlan(COMPACT_LAYOUT);
  const high = createModeSelectUnlockBurstPlan(HIGH_LAYOUT);
  const noncanonical = createModeSelectUnlockBurstPlan({
    logicalHeight: 900,
    logicalWidth: 481.9,
    visibleCenterX: 300.25,
    visibleLeftX: 60,
  });

  assert.equal(MODE_SELECT_UNLOCK_PARTICLE_TEXTURE_PATH, 'Blades/Particles/X-Mas/xmasfive.png');
  assert.equal(MODE_SELECT_UNLOCK_PARTICLE_COUNT, 45);
  assert.equal(MODE_SELECT_UNLOCK_PARTICLE_DELAY_SECONDS, Math.fround(0.05));
  assert.equal(MODE_SELECT_UNLOCK_PARTICLE_CLEANUP_DELAY_SECONDS, Math.fround(1.4));
  assert.equal(
    MODE_SELECT_UNLOCK_PARTICLE_REMOVE_AT_SECONDS,
    Math.fround(Math.fround(0.05) + Math.fround(1.4)),
  );
  assert.equal(MODE_SELECT_UNLOCK_PARTICLE_DURATION_MINIMUM_HUNDREDTHS, 35);
  assert.equal(MODE_SELECT_UNLOCK_PARTICLE_DURATION_MAXIMUM_HUNDREDTHS, 70);
  assert.deepEqual(compact, {
    autoDeleteParticles: false,
    cleanupDelaySeconds: Math.fround(1.4),
    colorFlags: [false, false],
    emitterWorldPosition: { x: 240, y: 200 },
    fadeOutParticles: false,
    maximumTravelMagnitude: 150,
    minimumTravelMagnitude: 50,
    particleCount: 45,
    particleRootZOrder: 1,
    removeAtSeconds: Math.fround(Math.fround(0.05) + Math.fround(1.4)),
    spriteChildZOrder: 0,
    startDelaySeconds: Math.fround(0.05),
    textureLogicalPath: 'Blades/Particles/X-Mas/xmasfive.png',
  });
  assert.deepEqual(high.emitterWorldPosition, { x: 360, y: 320 });
  assert.equal(high.minimumTravelMagnitude, 75);
  assert.equal(high.maximumTravelMagnitude, 225);
  assert.deepEqual(noncanonical.emitterWorldPosition, { x: 300.25, y: 225 });
  assert.equal(noncanonical.minimumTravelMagnitude, 50);
  assert.equal(noncanonical.maximumTravelMagnitude, 150);
  assert.equal(Object.isFrozen(compact), true);
  assert.equal(Object.isFrozen(compact.colorFlags), true);
  assert.equal(Object.isFrozen(compact.emitterWorldPosition), true);
});

test('unlock burst consumes exactly 225 draws and emits 45 deeply immutable concurrent action sets', () => {
  const draws: number[] = [];
  for (let index = 0; index < 45; index += 1) {
    if (index === 0) {
      draws.push(35, -1, 50, 0, 150);
    } else if (index === 1) {
      draws.push(70, 1, 150, -1, 50);
    } else {
      draws.push(50, 0, 100, 1, 125);
    }
  }
  const random = new ScriptedRandom(draws);
  const plan = createModeSelectUnlockBurstPlan(COMPACT_LAYOUT);
  assert.equal(random.consumedDrawCount, 0);

  const particles = createModeSelectUnlockParticleBurst(plan, random);

  assert.equal(particles.length, 45);
  assert.equal(random.consumedDrawCount, 225);
  assert.equal(random.calls.length, 225);
  for (let index = 0; index < 45; index += 1) {
    assert.deepEqual(random.calls.slice(index * 5, index * 5 + 5), [
      DURATION_CALL,
      SIGN_CALL,
      COMPACT_MAGNITUDE_CALL,
      SIGN_CALL,
      COMPACT_MAGNITUDE_CALL,
    ]);
  }

  assert.deepEqual(particles[0], {
    actionsRunConcurrently: true,
    appliesColor: false,
    autoDelete: false,
    deltaLocal: { x: -50, y: 0 },
    durationHundredths: 35,
    durationSeconds: Math.fround(35 / 100),
    fadeOut: false,
    horizontalMagnitude: 50,
    horizontalSign: -1,
    index: 0,
    moveActionSequence: [
      {
        deltaLocal: { x: -50, y: 0 },
        durationSeconds: Math.fround(35 / 100),
        type: 'move-by',
      },
      { type: 'invoke-finished-callback' },
    ],
    particleRootZOrder: 1,
    rotateAction: {
      deltaX: 1,
      deltaY: 1,
      durationSeconds: Math.fround(35 / 100),
      overload: 'three-argument',
      type: 'rotate-by',
    },
    scaleAction: {
      durationSeconds: Math.fround(35 / 100),
      scaleX: 0,
      scaleY: 0,
      type: 'scale-to',
    },
    spriteChildZOrder: 0,
    verticalMagnitude: 150,
    verticalSign: 0,
  });
  assert.deepEqual(particles[1]?.deltaLocal, { x: 150, y: -50 });
  assert.equal(particles[1]?.durationSeconds, Math.fround(70 / 100));
  assert.equal(Object.is(particles[0]?.deltaLocal.y, -0), false);
  assert.deepEqual(particles.slice(2).map(({ index }) => index), [
    ...Array.from({ length: 43 }, (_, offset) => offset + 2),
  ]);
  assert.equal(Object.isFrozen(particles), true);
  assert.equal(particles.every(Object.isFrozen), true);
  assert.equal(particles.every(({ deltaLocal }) => Object.isFrozen(deltaLocal)), true);
  assert.equal(
    particles.every(({ moveActionSequence }) => (
      Object.isFrozen(moveActionSequence)
      && moveActionSequence.every(Object.isFrozen)
    )),
    true,
  );
  assert.equal(particles.every(({ rotateAction }) => Object.isFrozen(rotateAction)), true);
  assert.equal(particles.every(({ scaleAction }) => Object.isFrozen(scaleAction)), true);
  assert.equal(particles.every(({ actionsRunConcurrently }) => actionsRunConcurrently), true);
  assert.equal(particles.every(({ appliesColor }) => !appliesColor), true);
  assert.equal(particles.every(({ autoDelete }) => !autoDelete), true);
  assert.equal(particles.every(({ fadeOut }) => !fadeOut), true);
});

test('unlock particle draws fail at their own boundary without consuming a later draw', () => {
  assertInvalidUnlockDraw([34], RangeError, [DURATION_CALL]);
  assertInvalidUnlockDraw([71], RangeError, [DURATION_CALL]);
  assertInvalidUnlockDraw([35.5], TypeError, [DURATION_CALL]);
  assertInvalidUnlockDraw([35, -2], RangeError, [DURATION_CALL, SIGN_CALL]);
  assertInvalidUnlockDraw([35, 2], RangeError, [DURATION_CALL, SIGN_CALL]);
  assertInvalidUnlockDraw([35, 0, 49], RangeError, [
    DURATION_CALL,
    SIGN_CALL,
    COMPACT_MAGNITUDE_CALL,
  ]);
  assertInvalidUnlockDraw([35, 0, 50, Number.NaN], TypeError, [
    DURATION_CALL,
    SIGN_CALL,
    COMPACT_MAGNITUDE_CALL,
    SIGN_CALL,
  ]);
  assertInvalidUnlockDraw([35, 0, 50, 0, 151], RangeError, [
    DURATION_CALL,
    SIGN_CALL,
    COMPACT_MAGNITUDE_CALL,
    SIGN_CALL,
    COMPACT_MAGNITUDE_CALL,
  ]);
});

test('unlock particle burst rejects malformed random and tampered plans before drawing', () => {
  const plan = createModeSelectUnlockBurstPlan(COMPACT_LAYOUT);
  assert.throws(
    () => createModeSelectUnlockParticleBurst(plan, null as never),
    /random must provide/,
  );

  for (const tampered of [
    { ...plan, textureLogicalPath: 'Blades/Particles/wrong.png' },
    { ...plan, particleCount: 44 },
    { ...plan, colorFlags: [false, true] },
    { ...plan, minimumTravelMagnitude: 151 },
    { ...plan, emitterWorldPosition: { x: Number.NaN, y: 200 } },
  ]) {
    const random = new ScriptedRandom([35]);
    assert.throws(() => createModeSelectUnlockParticleBurst(tampered as never, random));
    assert.equal(random.consumedDrawCount, 0);
  }
});

test('invalid state inputs and transitions fail before mutating state', () => {
  for (const input of [
    null,
    { layout: null },
    { layout: { ...COMPACT_LAYOUT, logicalWidth: 0 } },
    { layout: { ...COMPACT_LAYOUT, logicalHeight: Number.POSITIVE_INFINITY } },
    { layout: COMPACT_LAYOUT, persistedUnlocks: { 0: true } },
    { layout: COMPACT_LAYOUT, persistedUnlocks: { 1: 1 } },
  ]) {
    assert.throws(() => new ModeSelectState(input as never));
  }

  const state = new ModeSelectState({ layout: COMPACT_LAYOUT });
  const initial = state.snapshot;
  for (const operation of [
    () => state.drag(Number.NaN),
    () => state.flick(Number.POSITIVE_INFINITY),
    () => state.updateFrame('false' as never),
    () => state.selectMode(6, true),
    () => state.selectMode(1, 1 as never),
    () => state.unlockCurrentMode(1.5),
  ]) {
    assert.throws(operation);
    assert.deepEqual(state.snapshot, initial);
  }
  assert.throws(() => createModeSelectDelayedNavigationCommands(1.5));
  assert.throws(() => createModeSelectBackCommands(1 as never));
});

test('malformed unlock burst layouts reject before a partial plan can escape', () => {
  for (const layout of [
    null,
    { ...COMPACT_LAYOUT, logicalWidth: 0 },
    { ...COMPACT_LAYOUT, logicalWidth: Number.MAX_VALUE },
    { ...COMPACT_LAYOUT, visibleCenterX: Number.NaN },
  ]) {
    let partialPlan: ReturnType<typeof createModeSelectUnlockBurstPlan> | undefined;
    assert.throws(() => {
      partialPlan = createModeSelectUnlockBurstPlan(layout as never);
    });
    assert.equal(partialPlan, undefined);
  }
});

test('Mode Select domain stays Creator-free and exposes no elapsed-time carousel path', () => {
  const source = readFileSync(new URL(
    '../../../game/assets/scripts/domain/mode-select-state.ts',
    import.meta.url,
  ), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]cc['"]/);
  assert.doesNotMatch(source, /deltaTime|elapsedTime/);
});

function stateAtIndex(modeIndex: number): ModeSelectState {
  const state = new ModeSelectState({ layout: COMPACT_LAYOUT });
  for (let index = 0; index < modeIndex; index += 1) {
    state.flick(-1);
  }
  assert.equal(state.snapshot.currentIndex, modeIndex);
  return state;
}

function nearCenteredState(visibleCenterX: number): ModeSelectState {
  return new ModeSelectState({
    layout: {
      logicalHeight: 800,
      logicalWidth: 480,
      visibleCenterX,
      visibleLeftX: 0,
    },
  });
}

function assertInvalidUnlockDraw(
  draws: readonly number[],
  ErrorType: typeof TypeError | typeof RangeError,
  expectedCalls: readonly InclusiveCall[],
): void {
  const random = new ScriptedRandom(draws);
  const plan = createModeSelectUnlockBurstPlan(COMPACT_LAYOUT);
  assert.throws(
    () => createModeSelectUnlockParticleBurst(plan, random),
    ErrorType,
  );
  assert.deepEqual(random.calls, expectedCalls);
  assert.equal(random.consumedDrawCount, draws.length);
}
