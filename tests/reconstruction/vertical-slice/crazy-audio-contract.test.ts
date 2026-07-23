import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  CRAZY_BOMB_ELECTRIC_ACTIVE_SECONDS,
  CRAZY_BOMB_ELECTRIC_AUDIO_LIFECYCLE,
  CRAZY_BOMB_ELECTRIC_ENTRY_SECONDS,
  CRAZY_BOMB_ELECTRIC_FRAME_SECONDS,
  CRAZY_BONUS_TOSS_AUDIO_LIFECYCLE,
  CRAZY_DIRECT_PLAY_AUDIO_COUNT,
  CRAZY_DIRECT_PLAY_AUDIO_PATHS,
  CRAZY_DOUBLE_TOSS_ACTIVE_SECONDS,
  CRAZY_DOUBLE_TOSS_AUDIO_LIFECYCLE,
  CRAZY_DOUBLE_TOSS_RETAINED_EFFECT,
  CRAZY_DRAGON_FINISH_TRIGGER_ORDER,
  CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS,
  CRAZY_DRAGON_POSITION_JITTER_WIDTH_SCALE,
  CRAZY_ELECTRIC_BACKGROUND_AUDIO_PATH,
  CRAZY_ELECTRIC_HIT_AUDIO_PATHS,
  CRAZY_MAGNET_ACTIVE_SECONDS,
  CRAZY_MAGNET_AUDIO_LIFECYCLE,
  CRAZY_MAGNET_ENTRY_SECONDS,
  CRAZY_MAGNET_EXIT_SECONDS,
  CRAZY_MAGNET_RETAINED_EFFECT,
  CRAZY_MAGNET_VISUAL_LIFETIME_SECONDS,
  CRAZY_PRELOAD_ONLY_AUDIO_COUNT,
  CRAZY_PRELOAD_ONLY_AUDIO_PATHS,
  CRAZY_REQUIRED_STAGED_AUDIO_COUNT,
  CRAZY_REQUIRED_STAGED_AUDIO_PATHS,
  CRAZY_SPECIAL_FRUIT_BASE_CUT_AUDIO_PATH,
  CRAZY_SPECIAL_FRUIT_CRITICAL_AUDIO_PATH,
  CRAZY_TIME_UP_FINISH_AUDIO_PLAN,
  classifyCrazyAudioPath,
  executeCrazyBombElectricHitAudio,
  executeCrazyDragonFruitCutAudio,
  getCrazyBombElectricStartAudioPlan,
  getCrazyBombElectricStopAudioPlan,
  getCrazyBombElectricTurnOffAudioPlan,
  getCrazyBombElectricTurnOnAudioPlan,
  getCrazyBonusTossAudioPlan,
  getCrazyDoubleScoreAudioPlan,
  getCrazyDoubleTossStartAudioPlan,
  getCrazyDoubleTossStopAudioPlan,
  getCrazyDragonFruitFinishAudioPlan,
  getCrazyDragonPositionJitterBound,
  getCrazyFreezeAudioPlan,
  getCrazyMagnetBeginAudioPlan,
  getCrazyMagnetEndAudioPlan,
  getCrazySpecialFruitBaseCutAudioPlan,
  getCrazyTimerUpdateAudioPlan,
  type CrazyAudioCommand,
  type CrazyAudioExecutionPort,
  type CrazyAudioPlanStep,
  type CrazyAudioRandomIntStep,
} from '../../../game/assets/scripts/domain/crazy-audio-contract.ts';
import { canonicalResourceToBundlePath } from '../../../game/assets/scripts/domain/game-resource-contract.ts';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../../..');
const STAGING_MANIFEST = readJson<{
  readonly entries: readonly {
    readonly bytes: number;
    readonly canonicalPath: string;
    readonly sha256: string;
    readonly targetPath: string;
  }[];
}>('assets/catalog/creator-staging-manifest.json');
const MANIFEST_BY_PATH = new Map(
  STAGING_MANIFEST.entries.map((entry) => [entry.canonicalPath, entry]),
);

test('direct-play and preload-only catalogs are exact, disjoint, and classified', () => {
  assert.equal(CRAZY_DIRECT_PLAY_AUDIO_PATHS.length, CRAZY_DIRECT_PLAY_AUDIO_COUNT);
  assert.equal(CRAZY_PRELOAD_ONLY_AUDIO_PATHS.length, CRAZY_PRELOAD_ONLY_AUDIO_COUNT);
  assert.equal(
    CRAZY_REQUIRED_STAGED_AUDIO_PATHS.length,
    CRAZY_REQUIRED_STAGED_AUDIO_COUNT,
  );
  assert.equal(new Set(CRAZY_DIRECT_PLAY_AUDIO_PATHS).size, 20);
  assert.equal(new Set(CRAZY_PRELOAD_ONLY_AUDIO_PATHS).size, 4);
  assert.equal(new Set(CRAZY_REQUIRED_STAGED_AUDIO_PATHS).size, 24);

  const preloadOnly = new Set<string>(CRAZY_PRELOAD_ONLY_AUDIO_PATHS);
  for (const canonicalPath of CRAZY_DIRECT_PLAY_AUDIO_PATHS) {
    assert.equal(preloadOnly.has(canonicalPath), false, canonicalPath);
    assert.equal(classifyCrazyAudioPath(canonicalPath), 'direct-play');
  }
  for (const canonicalPath of CRAZY_PRELOAD_ONLY_AUDIO_PATHS) {
    assert.equal(classifyCrazyAudioPath(canonicalPath), 'preload-only');
  }
  assert.deepEqual(CRAZY_PRELOAD_ONLY_AUDIO_PATHS, [
    'Sounds/boomhit.wav',
    'Sounds/eapplecut.wav',
    'Sounds/lightning1.wav',
    'Sounds/lightning2.wav',
  ]);
  assert.equal(classifyCrazyAudioPath('Sounds/unclassified.wav'), 'unclassified');
  assert.throws(() => classifyCrazyAudioPath(''), TypeError);
  assert.throws(() => classifyCrazyAudioPath('../Sounds/timeup.wav'), RangeError);
  assert.throws(() => classifyCrazyAudioPath('Sounds/'), RangeError);
  assert.throws(() => classifyCrazyAudioPath('Sounds//timeup.wav'), RangeError);
  assert.throws(() => classifyCrazyAudioPath('Sounds/./timeup.wav'), RangeError);
  assert.throws(() => classifyCrazyAudioPath('Sounds\\timeup.wav'), RangeError);
});

test('all 24 required Crazy audio files match staged bytes and Creator metadata', () => {
  for (const canonicalPath of CRAZY_REQUIRED_STAGED_AUDIO_PATHS) {
    const entry = MANIFEST_BY_PATH.get(canonicalPath);
    assert.ok(entry, `missing manifest row ${canonicalPath}`);
    const bytes = readFileSync(resolve(REPOSITORY_ROOT, entry.targetPath));
    assert.equal(bytes.byteLength, entry.bytes, canonicalPath);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      entry.sha256,
      canonicalPath,
    );
    const meta = readJson<{
      readonly imported: boolean;
      readonly importer: string;
      readonly userData: { readonly downloadMode: number };
    }>(`game/assets/game/${canonicalPath}.meta`);
    assert.equal(meta.imported, true, canonicalPath);
    assert.equal(meta.importer, 'audio-clip', canonicalPath);
    assert.equal(meta.userData.downloadMode, 0, canonicalPath);
    assert.equal(
      canonicalResourceToBundlePath(canonicalPath),
      canonicalPath.replace(/\.(?:wav|mp3)$/u, ''),
      canonicalPath,
    );
  }
});

test('special Fruit IDs preserve base, conditional critical, then downstream boundary', () => {
  for (let fruitId = 10; fruitId <= 14; fruitId += 1) {
    assert.deepEqual(
      getCrazySpecialFruitBaseCutAudioPlan(fruitId, false, true),
      [playEffect(CRAZY_SPECIAL_FRUIT_BASE_CUT_AUDIO_PATH, false)],
    );
    assert.deepEqual(
      getCrazySpecialFruitBaseCutAudioPlan(fruitId, true, true),
      [
        playEffect(CRAZY_SPECIAL_FRUIT_BASE_CUT_AUDIO_PATH, false),
        playEffect(CRAZY_SPECIAL_FRUIT_CRITICAL_AUDIO_PATH, false),
      ],
    );
    assert.deepEqual(
      getCrazySpecialFruitBaseCutAudioPlan(fruitId, true, false),
      [],
    );
  }
  assert.deepEqual(getCrazyDoubleScoreAudioPlan(true), [
    playEffect('Sounds/doublepoint.wav', false),
  ]);
  assert.deepEqual(getCrazyDoubleScoreAudioPlan(false), []);

  assert.throws(
    () => getCrazySpecialFruitBaseCutAudioPlan(9, false, true),
    RangeError,
  );
  assert.throws(
    () => getCrazySpecialFruitBaseCutAudioPlan(15, false, true),
    RangeError,
  );
  assert.throws(
    () => getCrazySpecialFruitBaseCutAudioPlan(10.5, false, true),
    RangeError,
  );
  assert.throws(
    () => getCrazySpecialFruitBaseCutAudioPlan(10, 1 as never, true),
    TypeError,
  );
});

test('BombElectric preserves one-shot, background-channel, stop, and timing contracts', () => {
  assert.equal(CRAZY_BOMB_ELECTRIC_ENTRY_SECONDS, Math.fround(1));
  assert.equal(CRAZY_BOMB_ELECTRIC_ACTIVE_SECONDS, Math.fround(15));
  assert.equal(CRAZY_BOMB_ELECTRIC_FRAME_SECONDS, Math.fround(1 / 15));
  assert.deepEqual(CRAZY_BOMB_ELECTRIC_AUDIO_LIFECYCLE, {
    backgroundChannel: 'background-music',
    finalStopAllEffectsStopsBackground: false,
    startHasActiveGuard: false,
    stopCancelsPendingAutoTurnOff: false,
    stopCancelsPendingTurnOn: false,
    stopUsesCurrentEffectsSetting: true,
    turnOnSetsOffFlag: false,
  });

  assert.deepEqual(getCrazyBombElectricStartAudioPlan(true), [
    playEffect('Sounds/powerup.wav', false),
  ]);
  assert.deepEqual(getCrazyBombElectricTurnOnAudioPlan(true), [
    playEffect('Sounds/electricexplose.wav', false),
    {
      canonicalPath: CRAZY_ELECTRIC_BACKGROUND_AUDIO_PATH,
      gate: 'enable-effects',
      loop: true,
      type: 'play-background-music',
    },
  ]);
  assert.deepEqual(getCrazyBombElectricTurnOffAudioPlan(true), [
    {
      gate: 'enable-effects',
      releaseData: false,
      type: 'stop-background-music',
    },
  ]);
  assert.deepEqual(getCrazyBombElectricStopAudioPlan(false, true), [
    {
      gate: 'enable-effects',
      releaseData: false,
      type: 'stop-background-music',
    },
  ]);
  assert.deepEqual(getCrazyBombElectricStopAudioPlan(true, true), []);
  assert.deepEqual(getCrazyBombElectricStartAudioPlan(false), []);
  assert.deepEqual(getCrazyBombElectricTurnOnAudioPlan(false), []);
  assert.deepEqual(getCrazyBombElectricTurnOffAudioPlan(false), []);
});

test('HitElectric executes exactly one gated shared-RNG draw before ehit1..4', () => {
  const disabled = createExecutionSpy([0]);
  assert.deepEqual(executeCrazyBombElectricHitAudio(false, disabled.port), []);
  assert.equal(disabled.drawCount, 0);
  assert.deepEqual(disabled.events, []);

  for (let draw = 0; draw <= 3; draw += 1) {
    const execution = createExecutionSpy([draw]);
    assert.deepEqual(executeCrazyBombElectricHitAudio(true, execution.port), [
      randomTranscript('electric-hit-sound', 0, 3, draw),
      playEffect(CRAZY_ELECTRIC_HIT_AUDIO_PATHS[draw] ?? '', false),
    ]);
    assert.equal(execution.drawCount, 1);
    assert.deepEqual(execution.events, [
      'rng:electric-hit-sound:0:3',
      `audio:${CRAZY_ELECTRIC_HIT_AUDIO_PATHS[draw]}`,
    ]);
  }
  for (const invalidDraw of [-1, 4, 1.5]) {
    const invalid = createExecutionSpy([invalidDraw]);
    assert.throws(
      () => executeCrazyBombElectricHitAudio(true, invalid.port),
      RangeError,
    );
    assert.equal(invalid.drawCount, 1);
    assert.equal(invalid.events.length, 1);
  }
  assert.throws(
    () => executeCrazyBombElectricHitAudio(1 as never, createExecutionSpy([]).port),
    TypeError,
  );
  assert.throws(
    () => executeCrazyBombElectricHitAudio(true, {} as never),
    /execution port is incomplete/,
  );
});

test('Magnet loop uses retained slot 0x100 for exactly the active callback window', () => {
  assert.equal(CRAZY_MAGNET_ENTRY_SECONDS, Math.fround(2));
  assert.equal(CRAZY_MAGNET_ACTIVE_SECONDS, Math.fround(10.5));
  assert.equal(CRAZY_MAGNET_EXIT_SECONDS, Math.fround(2));
  assert.equal(CRAZY_MAGNET_VISUAL_LIFETIME_SECONDS, Math.fround(14.5));
  assert.deepEqual(CRAZY_MAGNET_RETAINED_EFFECT, {
    owner: 'magnet-animation',
    slotOffset: 0x100,
  });
  assert.deepEqual(CRAZY_MAGNET_AUDIO_LIFECYCLE, {
    beginWritesHandleOnlyWhenEffectsEnabled: true,
    constructorInitializesHandleSlot: false,
    endReadsHandleWhenEffectsEnabled: true,
    finalStopAllEffectsCoversLoop: true,
    immediateTimeUpInvokesEndCallback: false,
  });
  assert.deepEqual(getCrazyMagnetBeginAudioPlan(true), [
    playEffect('Sounds/magnet.wav', true, CRAZY_MAGNET_RETAINED_EFFECT),
  ]);
  assert.deepEqual(getCrazyMagnetEndAudioPlan(true), [
    {
      gate: 'enable-effects',
      readHandleFrom: CRAZY_MAGNET_RETAINED_EFFECT,
      type: 'stop-effect',
    },
  ]);
  assert.deepEqual(getCrazyMagnetBeginAudioPlan(false), []);
  assert.deepEqual(getCrazyMagnetEndAudioPlan(false), []);
});

test('DoubleToss, BonusToss, and Freeze expose exact guarded and stop ordering', () => {
  assert.equal(CRAZY_DOUBLE_TOSS_ACTIVE_SECONDS, Math.fround(15));
  assert.deepEqual(CRAZY_DOUBLE_TOSS_RETAINED_EFFECT, {
    owner: 'double-toss',
    slotOffset: 0x120,
  });
  assert.deepEqual(CRAZY_DOUBLE_TOSS_AUDIO_LIFECYCLE, {
    constructorInitializesHandleSlot: false,
    finalStopAllEffectsCoversLoop: true,
    immediateTimeUpCallsStop: false,
    startHasActiveGuard: true,
    startWritesHandleOnlyWhenEffectsEnabled: true,
    stopCancelsDurationCallback: false,
    stopHasActiveGuard: false,
    stopReadsHandleWhenEffectsEnabled: true,
  });
  assert.deepEqual(getCrazyDoubleTossStartAudioPlan(false, true), [
    playEffect('Sounds/doubletosstrum.wav', false),
    playEffect(
      'Sounds/doubletoss.wav',
      true,
      CRAZY_DOUBLE_TOSS_RETAINED_EFFECT,
    ),
  ]);
  assert.deepEqual(getCrazyDoubleTossStartAudioPlan(true, true), []);
  assert.deepEqual(getCrazyDoubleTossStartAudioPlan(false, false), []);
  assert.deepEqual(getCrazyDoubleTossStopAudioPlan(true), [
    {
      gate: 'enable-effects',
      readHandleFrom: CRAZY_DOUBLE_TOSS_RETAINED_EFFECT,
      type: 'stop-effect',
    },
    playEffect('Sounds/doubletosstrum.wav', false),
  ]);
  assert.deepEqual(getCrazyDoubleTossStopAudioPlan(false), []);

  assert.deepEqual(CRAZY_BONUS_TOSS_AUDIO_LIFECYCLE, {
    audioOnlyAfterSuccessfulSpawn: true,
    immediateTimeUpCallsStop: false,
    sharedTossType: 5,
  });
  assert.deepEqual(getCrazyBonusTossAudioPlan(true, true), [
    playEffect('Sounds/tossfruit.wav', false),
  ]);
  assert.deepEqual(getCrazyBonusTossAudioPlan(false, true), []);
  assert.deepEqual(getCrazyBonusTossAudioPlan(true, false), []);
  assert.deepEqual(getCrazyFreezeAudioPlan(true), [
    playEffect('Sounds/freeze.wav', false),
  ]);
  assert.deepEqual(getCrazyFreezeAudioPlan(false), []);
  assert.throws(
    () => getCrazyDoubleTossStartAudioPlan(0 as never, true),
    TypeError,
  );
  assert.throws(() => getCrazyBonusTossAudioPlan(true, 1 as never), TypeError);
});

test('timer equality emits tick before timeup and final cleanup remains effects-only', () => {
  const zeroExpiry = {
    displayedSeconds: 0,
    effectsEnabled: true,
    expired: true,
    minutes: 0,
    warningSecond: 0,
  };
  assert.deepEqual(getCrazyTimerUpdateAudioPlan(zeroExpiry), [
    playEffect('Sounds/timetick.wav', false),
    playEffect('Sounds/timeup.wav', false),
  ]);
  assert.deepEqual(getCrazyTimerUpdateAudioPlan({
    ...zeroExpiry,
    displayedSeconds: 10,
    expired: false,
    warningSecond: 10,
  }), [
    playEffect('Sounds/timetick.wav', false),
  ]);
  assert.deepEqual(getCrazyTimerUpdateAudioPlan({
    ...zeroExpiry,
    displayedSeconds: 9,
    expired: false,
    warningSecond: 10,
  }), []);
  assert.deepEqual(getCrazyTimerUpdateAudioPlan({
    ...zeroExpiry,
    displayedSeconds: -1,
    warningSecond: 0,
  }), [
    playEffect('Sounds/timeup.wav', false),
  ]);
  assert.deepEqual(getCrazyTimerUpdateAudioPlan({
    ...zeroExpiry,
    effectsEnabled: false,
  }), []);
  assert.deepEqual(CRAZY_TIME_UP_FINISH_AUDIO_PLAN, [
    { gate: 'unconditional', type: 'stop-all-effects' },
  ]);

  assert.deepEqual([
    ...getCrazyTimerUpdateAudioPlan(zeroExpiry),
    ...getCrazyBombElectricStopAudioPlan(false, true),
    ...CRAZY_TIME_UP_FINISH_AUDIO_PLAN,
  ], [
    playEffect('Sounds/timetick.wav', false),
    playEffect('Sounds/timeup.wav', false),
    {
      gate: 'enable-effects',
      releaseData: false,
      type: 'stop-background-music',
    },
    { gate: 'unconditional', type: 'stop-all-effects' },
  ]);

  assert.throws(() => getCrazyTimerUpdateAudioPlan(null as never), TypeError);
  assert.throws(
    () => getCrazyTimerUpdateAudioPlan({ ...zeroExpiry, minutes: 0.5 }),
    RangeError,
  );
  assert.throws(
    () => getCrazyTimerUpdateAudioPlan({
      ...zeroExpiry,
      effectsEnabled: 1 as never,
    }),
    TypeError,
  );
});

test('DragonFruit executes counter, acceptance, and dependent shared-RNG draws once in order', () => {
  assert.equal(
    CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS,
    Math.fround(2.1),
  );
  assert.equal(
    CRAZY_DRAGON_POSITION_JITTER_WIDTH_SCALE,
    Math.fround(0.03),
  );
  assert.equal(getCrazyDragonPositionJitterBound(480), 14);
  assert.equal(getCrazyDragonPositionJitterBound(480.9), 14);
  assert.equal(getCrazyDragonPositionJitterBound(720), 21);
  assert.throws(() => getCrazyDragonPositionJitterBound(0), RangeError);
  assert.throws(() => getCrazyDragonPositionJitterBound(Number.MIN_VALUE), RangeError);
  assert.throws(() => getCrazyDragonPositionJitterBound(0x80000000), RangeError);
  assert.throws(() => getCrazyDragonPositionJitterBound(Infinity), RangeError);

  const acceptedFirstCut = createExecutionSpy([12, 0, -5, 3, -4]);
  assert.deepEqual(executeCrazyDragonFruitCutAudio({
    effectsEnabled: true,
    finished: false,
    firstCut: true,
    logicalWidth: 480,
  }, acceptedFirstCut.port), [
    playEffect('Sounds/hitmusic.wav', false),
    randomTranscript('dragon-counter-rotation', -30, 30, 12),
    randomTranscript('dragon-hit-acceptance', 0, 1, 0),
    randomTranscript('dragon-accepted-hit-rotation', -45, 45, -5),
    randomTranscript('dragon-position-x', -14, 14, 3),
    randomTranscript('dragon-position-y', -14, 14, -4),
    playEffect('Sounds/strawberry.wav', false),
  ]);
  assert.equal(acceptedFirstCut.drawCount, 5);
  assert.deepEqual(acceptedFirstCut.events, [
    'audio:Sounds/hitmusic.wav',
    'rng:dragon-counter-rotation:-30:30',
    'rng:dragon-hit-acceptance:0:1',
    'rng:dragon-accepted-hit-rotation:-45:45',
    'rng:dragon-position-x:-14:14',
    'rng:dragon-position-y:-14:14',
    'audio:Sounds/strawberry.wav',
  ]);

  const rejectedFirstCut = createExecutionSpy([-7, 1]);
  assert.deepEqual(executeCrazyDragonFruitCutAudio({
    effectsEnabled: true,
    finished: false,
    firstCut: true,
    logicalWidth: 480,
  }, rejectedFirstCut.port), [
    playEffect('Sounds/hitmusic.wav', false),
    randomTranscript('dragon-counter-rotation', -30, 30, -7),
    randomTranscript('dragon-hit-acceptance', 0, 1, 1),
  ]);
  assert.equal(rejectedFirstCut.drawCount, 2);

  const acceptedLaterCut = createExecutionSpy([0, 20, -9, 9]);
  assert.deepEqual(executeCrazyDragonFruitCutAudio({
    effectsEnabled: false,
    finished: false,
    firstCut: false,
    logicalWidth: 320,
  }, acceptedLaterCut.port), [
    randomTranscript('dragon-hit-acceptance', 0, 1, 0),
    randomTranscript('dragon-accepted-hit-rotation', -45, 45, 20),
    randomTranscript('dragon-position-x', -9, 9, -9),
    randomTranscript('dragon-position-y', -9, 9, 9),
  ]);
  assert.equal(acceptedLaterCut.drawCount, 4);

  const finished = createExecutionSpy([0]);
  assert.deepEqual(executeCrazyDragonFruitCutAudio({
    effectsEnabled: true,
    finished: true,
    firstCut: false,
  }, finished.port), []);
  assert.equal(finished.drawCount, 0);

  assert.deepEqual(CRAZY_DRAGON_FINISH_TRIGGER_ORDER, [
    'end-hit-animation',
    'notify-dragon-fruit-finished',
    'dispose-physics-object',
    'finish-audio-if-effects-enabled',
    'counter-fade-and-objective',
  ]);
  assert.deepEqual(getCrazyDragonFruitFinishAudioPlan(true), [
    playEffect('Sounds/finishhitmusic.wav', false),
  ]);
  assert.deepEqual(getCrazyDragonFruitFinishAudioPlan(false), []);
});

test('DragonFruit validates branch context before shared RNG and rejects invalid draw results', () => {
  const base = {
    effectsEnabled: true,
    finished: false,
    firstCut: false,
  };
  const noDraw = createExecutionSpy([0]);
  assert.throws(
    () => executeCrazyDragonFruitCutAudio(base, noDraw.port),
    /logicalWidth/,
  );
  assert.equal(noDraw.drawCount, 0);

  assert.throws(
    () => executeCrazyDragonFruitCutAudio({
      effectsEnabled: true,
      finished: true,
      firstCut: false,
      logicalWidth: 480,
    }, createExecutionSpy([]).port),
    /must not supply logicalWidth/,
  );
  for (const logicalWidth of [-1, Number.MAX_VALUE]) {
    const invalidWidth = createExecutionSpy([0]);
    assert.throws(
      () => executeCrazyDragonFruitCutAudio({
        ...base,
        logicalWidth,
      }, invalidWidth.port),
      RangeError,
    );
    assert.equal(invalidWidth.drawCount, 0);
  }

  const invalidAcceptance = createExecutionSpy([2]);
  assert.throws(
    () => executeCrazyDragonFruitCutAudio({
      ...base,
      logicalWidth: 480,
    }, invalidAcceptance.port),
    RangeError,
  );
  assert.equal(invalidAcceptance.drawCount, 1);

  const invalidCounter = createExecutionSpy([31, 0]);
  assert.throws(
    () => executeCrazyDragonFruitCutAudio({
      ...base,
      firstCut: true,
      logicalWidth: 480,
    }, invalidCounter.port),
    RangeError,
  );
  assert.equal(invalidCounter.drawCount, 1);

  assert.throws(
    () => executeCrazyDragonFruitCutAudio({
      ...base,
      effectsEnabled: 1 as never,
      logicalWidth: -1,
    }, createExecutionSpy([]).port),
    TypeError,
  );
  assert.throws(
    () => executeCrazyDragonFruitCutAudio({
      ...base,
      logicalWidth: 480,
    }, {} as never),
    /execution port is incomplete/,
  );
});

test('every direct-play path is emitted by a proven plan and no preload-only path is', () => {
  const dragonExecution = createExecutionSpy([0, 0, 0, 0, 0]);
  const plans: readonly (readonly CrazyAudioPlanStep[])[] = [
    getCrazySpecialFruitBaseCutAudioPlan(10, true, true),
    getCrazyDoubleScoreAudioPlan(true),
    getCrazyDoubleTossStartAudioPlan(false, true),
    getCrazyDoubleTossStopAudioPlan(true),
    getCrazyFreezeAudioPlan(true),
    getCrazyBombElectricStartAudioPlan(true),
    getCrazyBombElectricTurnOnAudioPlan(true),
    ...CRAZY_ELECTRIC_HIT_AUDIO_PATHS.map((_, draw) => {
      const execution = createExecutionSpy([draw]);
      return executeCrazyBombElectricHitAudio(true, execution.port);
    }),
    getCrazyMagnetBeginAudioPlan(true),
    getCrazyBonusTossAudioPlan(true, true),
    getCrazyTimerUpdateAudioPlan({
      displayedSeconds: 0,
      effectsEnabled: true,
      expired: true,
      minutes: 0,
      warningSecond: 0,
    }),
    executeCrazyDragonFruitCutAudio({
      effectsEnabled: true,
      finished: false,
      firstCut: true,
      logicalWidth: 200,
    }, dragonExecution.port),
    getCrazyDragonFruitFinishAudioPlan(true),
  ];

  const emittedPaths = new Set<string>();
  for (const plan of plans) {
    for (const step of plan) {
      if (step.type === 'play-effect' || step.type === 'play-background-music') {
        emittedPaths.add(step.canonicalPath);
      }
    }
  }
  assert.deepEqual(
    [...emittedPaths].sort(),
    [...CRAZY_DIRECT_PLAY_AUDIO_PATHS].sort(),
  );
  for (const preloadOnlyPath of CRAZY_PRELOAD_ONLY_AUDIO_PATHS) {
    assert.equal(emittedPaths.has(preloadOnlyPath), false, preloadOnlyPath);
  }
});

test('all exported plans and lifecycle contracts are immutable', () => {
  const electricExecution = createExecutionSpy([3]);
  const dragonExecution = createExecutionSpy([0, 0, 0, 0, 0]);
  const plans = [
    getCrazySpecialFruitBaseCutAudioPlan(14, true, true),
    getCrazyBombElectricTurnOnAudioPlan(true),
    executeCrazyBombElectricHitAudio(true, electricExecution.port),
    getCrazyMagnetBeginAudioPlan(true),
    getCrazyDoubleTossStartAudioPlan(false, true),
    executeCrazyDragonFruitCutAudio({
      effectsEnabled: true,
      finished: false,
      firstCut: true,
      logicalWidth: 100,
    }, dragonExecution.port),
    CRAZY_TIME_UP_FINISH_AUDIO_PLAN,
  ];
  for (const plan of plans) {
    assert.equal(Object.isFrozen(plan), true);
    assert.equal(plan.every(Object.isFrozen), true);
  }
  assert.equal(Object.isFrozen(CRAZY_DIRECT_PLAY_AUDIO_PATHS), true);
  assert.equal(Object.isFrozen(CRAZY_PRELOAD_ONLY_AUDIO_PATHS), true);
  assert.equal(Object.isFrozen(CRAZY_REQUIRED_STAGED_AUDIO_PATHS), true);
  assert.equal(Object.isFrozen(CRAZY_BOMB_ELECTRIC_AUDIO_LIFECYCLE), true);
  assert.equal(Object.isFrozen(CRAZY_MAGNET_AUDIO_LIFECYCLE), true);
  assert.equal(Object.isFrozen(CRAZY_DOUBLE_TOSS_AUDIO_LIFECYCLE), true);
  assert.equal(Object.isFrozen(CRAZY_BONUS_TOSS_AUDIO_LIFECYCLE), true);
});

function playEffect(
  canonicalPath: string,
  loop: boolean,
  retainResultAt?: Readonly<{ readonly owner: string; readonly slotOffset: number }>,
): Readonly<Record<string, unknown>> {
  if (retainResultAt === undefined) {
    return {
      canonicalPath,
      gate: 'enable-effects',
      loop,
      type: 'play-effect',
    };
  }
  return {
    canonicalPath,
    gate: 'enable-effects',
    loop,
    retainResultAt,
    type: 'play-effect',
  };
}

function randomTranscript(
  purpose: string,
  minimum: number,
  maximum: number,
  result: number,
): Readonly<Record<string, unknown>> {
  return {
    maximum,
    minimum,
    purpose,
    result,
    type: 'draw-random-int-inclusive',
  };
}

function createExecutionSpy(drawResults: readonly number[]): {
  readonly drawCount: number;
  readonly events: string[];
  readonly port: CrazyAudioExecutionPort;
} {
  let drawCount = 0;
  const events: string[] = [];
  const port: CrazyAudioExecutionPort = {
    drawRandomIntInclusive(request: CrazyAudioRandomIntStep): number {
      events.push(
        `rng:${request.purpose}:${request.minimum}:${request.maximum}`,
      );
      const result = drawResults[drawCount];
      if (result === undefined) {
        throw new Error(`unexpected RNG request ${request.purpose}`);
      }
      drawCount += 1;
      return result;
    },
    executeAudioCommand(command: CrazyAudioCommand): void {
      events.push(
        'canonicalPath' in command
          ? `audio:${command.canonicalPath}`
          : `audio:${command.type}`,
      );
    },
  };
  return {
    get drawCount() {
      return drawCount;
    },
    events,
    port,
  };
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    readFileSync(resolve(REPOSITORY_ROOT, relativePath), 'utf8'),
  ) as T;
}
