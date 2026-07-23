export const CRAZY_SPECIAL_FRUIT_BASE_CUT_AUDIO_PATH = 'Sounds/mangosteen.wav' as const;
export const CRAZY_SPECIAL_FRUIT_CRITICAL_AUDIO_PATH = 'Sounds/critical.wav' as const;
export const CRAZY_DOUBLE_SCORE_AUDIO_PATH = 'Sounds/doublepoint.wav' as const;
export const CRAZY_DOUBLE_TOSS_STRUM_AUDIO_PATH = 'Sounds/doubletosstrum.wav' as const;
export const CRAZY_DOUBLE_TOSS_LOOP_AUDIO_PATH = 'Sounds/doubletoss.wav' as const;
export const CRAZY_FREEZE_AUDIO_PATH = 'Sounds/freeze.wav' as const;
export const CRAZY_ELECTRIC_POWER_UP_AUDIO_PATH = 'Sounds/powerup.wav' as const;
export const CRAZY_ELECTRIC_EXPLOSION_AUDIO_PATH = 'Sounds/electricexplose.wav' as const;
export const CRAZY_ELECTRIC_BACKGROUND_AUDIO_PATH = 'Sounds/electric.mp3' as const;
export const CRAZY_MAGNET_LOOP_AUDIO_PATH = 'Sounds/magnet.wav' as const;
export const CRAZY_BONUS_TOSS_AUDIO_PATH = 'Sounds/tossfruit.wav' as const;
export const CRAZY_TIMER_TICK_AUDIO_PATH = 'Sounds/timetick.wav' as const;
export const CRAZY_TIME_UP_AUDIO_PATH = 'Sounds/timeup.wav' as const;
export const CRAZY_DRAGON_HIT_MUSIC_AUDIO_PATH = 'Sounds/hitmusic.wav' as const;
export const CRAZY_DRAGON_ACCEPTED_HIT_AUDIO_PATH = 'Sounds/strawberry.wav' as const;
export const CRAZY_DRAGON_FINISH_AUDIO_PATH = 'Sounds/finishhitmusic.wav' as const;

export const CRAZY_ELECTRIC_HIT_AUDIO_PATHS = Object.freeze([
  'Sounds/ehit1.wav',
  'Sounds/ehit2.wav',
  'Sounds/ehit3.wav',
  'Sounds/ehit4.wav',
] as const);

export const CRAZY_PRELOAD_ONLY_AUDIO_PATHS = Object.freeze([
  'Sounds/boomhit.wav',
  'Sounds/eapplecut.wav',
  'Sounds/lightning1.wav',
  'Sounds/lightning2.wav',
] as const);

export type CrazyElectricHitSoundIndex = 0 | 1 | 2 | 3;
export type CrazyPreloadOnlyAudioPath = typeof CRAZY_PRELOAD_ONLY_AUDIO_PATHS[number];

export type CrazyEffectAudioPath =
  | typeof CRAZY_SPECIAL_FRUIT_BASE_CUT_AUDIO_PATH
  | typeof CRAZY_SPECIAL_FRUIT_CRITICAL_AUDIO_PATH
  | typeof CRAZY_DOUBLE_SCORE_AUDIO_PATH
  | typeof CRAZY_DOUBLE_TOSS_STRUM_AUDIO_PATH
  | typeof CRAZY_DOUBLE_TOSS_LOOP_AUDIO_PATH
  | typeof CRAZY_FREEZE_AUDIO_PATH
  | typeof CRAZY_ELECTRIC_POWER_UP_AUDIO_PATH
  | typeof CRAZY_ELECTRIC_EXPLOSION_AUDIO_PATH
  | typeof CRAZY_ELECTRIC_HIT_AUDIO_PATHS[number]
  | typeof CRAZY_MAGNET_LOOP_AUDIO_PATH
  | typeof CRAZY_BONUS_TOSS_AUDIO_PATH
  | typeof CRAZY_TIMER_TICK_AUDIO_PATH
  | typeof CRAZY_TIME_UP_AUDIO_PATH
  | typeof CRAZY_DRAGON_HIT_MUSIC_AUDIO_PATH
  | typeof CRAZY_DRAGON_ACCEPTED_HIT_AUDIO_PATH
  | typeof CRAZY_DRAGON_FINISH_AUDIO_PATH;

export type CrazyDirectPlayAudioPath =
  | CrazyEffectAudioPath
  | typeof CRAZY_ELECTRIC_BACKGROUND_AUDIO_PATH;

export const CRAZY_DIRECT_PLAY_AUDIO_PATHS: readonly CrazyDirectPlayAudioPath[]
  = Object.freeze([
    CRAZY_SPECIAL_FRUIT_BASE_CUT_AUDIO_PATH,
    CRAZY_SPECIAL_FRUIT_CRITICAL_AUDIO_PATH,
    CRAZY_DOUBLE_SCORE_AUDIO_PATH,
    CRAZY_DOUBLE_TOSS_STRUM_AUDIO_PATH,
    CRAZY_DOUBLE_TOSS_LOOP_AUDIO_PATH,
    CRAZY_FREEZE_AUDIO_PATH,
    CRAZY_ELECTRIC_POWER_UP_AUDIO_PATH,
    CRAZY_ELECTRIC_EXPLOSION_AUDIO_PATH,
    CRAZY_ELECTRIC_BACKGROUND_AUDIO_PATH,
    ...CRAZY_ELECTRIC_HIT_AUDIO_PATHS,
    CRAZY_MAGNET_LOOP_AUDIO_PATH,
    CRAZY_BONUS_TOSS_AUDIO_PATH,
    CRAZY_TIMER_TICK_AUDIO_PATH,
    CRAZY_TIME_UP_AUDIO_PATH,
    CRAZY_DRAGON_HIT_MUSIC_AUDIO_PATH,
    CRAZY_DRAGON_ACCEPTED_HIT_AUDIO_PATH,
    CRAZY_DRAGON_FINISH_AUDIO_PATH,
  ]);

export const CRAZY_REQUIRED_STAGED_AUDIO_PATHS: readonly (
  CrazyDirectPlayAudioPath | CrazyPreloadOnlyAudioPath
)[] = Object.freeze([
  ...CRAZY_DIRECT_PLAY_AUDIO_PATHS,
  ...CRAZY_PRELOAD_ONLY_AUDIO_PATHS,
]);

export const CRAZY_DIRECT_PLAY_AUDIO_COUNT = 20 as const;
export const CRAZY_PRELOAD_ONLY_AUDIO_COUNT = 4 as const;
export const CRAZY_REQUIRED_STAGED_AUDIO_COUNT = 24 as const;

export const CRAZY_BOMB_ELECTRIC_ENTRY_SECONDS = Math.fround(1);
export const CRAZY_BOMB_ELECTRIC_ACTIVE_SECONDS = Math.fround(15);
export const CRAZY_BOMB_ELECTRIC_FRAME_SECONDS = Math.fround(1 / 15);
export const CRAZY_MAGNET_ENTRY_SECONDS = Math.fround(2);
export const CRAZY_MAGNET_ACTIVE_SECONDS = Math.fround(10.5);
export const CRAZY_MAGNET_EXIT_SECONDS = Math.fround(2);
export const CRAZY_MAGNET_VISUAL_LIFETIME_SECONDS = Math.fround(14.5);
export const CRAZY_DOUBLE_TOSS_ACTIVE_SECONDS = Math.fround(15);
export const CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS = Math.fround(2.1);
export const CRAZY_DRAGON_POSITION_JITTER_WIDTH_SCALE = Math.fround(0.03);

export const CRAZY_MAGNET_RETAINED_EFFECT = Object.freeze({
  owner: 'magnet-animation' as const,
  slotOffset: 0x100 as const,
});

export const CRAZY_DOUBLE_TOSS_RETAINED_EFFECT = Object.freeze({
  owner: 'double-toss' as const,
  slotOffset: 0x120 as const,
});

export const CRAZY_BOMB_ELECTRIC_AUDIO_LIFECYCLE = Object.freeze({
  backgroundChannel: 'background-music' as const,
  finalStopAllEffectsStopsBackground: false,
  startHasActiveGuard: false,
  stopCancelsPendingAutoTurnOff: false,
  stopCancelsPendingTurnOn: false,
  stopUsesCurrentEffectsSetting: true,
  turnOnSetsOffFlag: false,
});

export const CRAZY_MAGNET_AUDIO_LIFECYCLE = Object.freeze({
  beginWritesHandleOnlyWhenEffectsEnabled: true,
  constructorInitializesHandleSlot: false,
  endReadsHandleWhenEffectsEnabled: true,
  finalStopAllEffectsCoversLoop: true,
  immediateTimeUpInvokesEndCallback: false,
});

export const CRAZY_DOUBLE_TOSS_AUDIO_LIFECYCLE = Object.freeze({
  constructorInitializesHandleSlot: false,
  finalStopAllEffectsCoversLoop: true,
  immediateTimeUpCallsStop: false,
  startHasActiveGuard: true,
  startWritesHandleOnlyWhenEffectsEnabled: true,
  stopCancelsDurationCallback: false,
  stopHasActiveGuard: false,
  stopReadsHandleWhenEffectsEnabled: true,
});

export const CRAZY_BONUS_TOSS_AUDIO_LIFECYCLE = Object.freeze({
  audioOnlyAfterSuccessfulSpawn: true,
  immediateTimeUpCallsStop: false,
  sharedTossType: 5 as const,
});

export type CrazyRetainedEffectReference =
  | typeof CRAZY_MAGNET_RETAINED_EFFECT
  | typeof CRAZY_DOUBLE_TOSS_RETAINED_EFFECT;

export type CrazyAudioCommand =
  | Readonly<{
      readonly canonicalPath: CrazyEffectAudioPath;
      readonly gate: 'enable-effects';
      readonly loop: boolean;
      readonly retainResultAt?: CrazyRetainedEffectReference;
      readonly type: 'play-effect';
    }>
  | Readonly<{
      readonly canonicalPath: typeof CRAZY_ELECTRIC_BACKGROUND_AUDIO_PATH;
      readonly gate: 'enable-effects';
      readonly loop: true;
      readonly type: 'play-background-music';
    }>
  | Readonly<{
      readonly gate: 'enable-effects';
      readonly readHandleFrom: CrazyRetainedEffectReference;
      readonly type: 'stop-effect';
    }>
  | Readonly<{
      readonly gate: 'enable-effects';
      readonly releaseData: false;
      readonly type: 'stop-background-music';
    }>
  | Readonly<{
      readonly gate: 'unconditional';
      readonly type: 'stop-all-effects';
    }>;

export type CrazyAudioRandomPurpose =
  | 'electric-hit-sound'
  | 'dragon-counter-rotation'
  | 'dragon-hit-acceptance'
  | 'dragon-accepted-hit-rotation'
  | 'dragon-position-x'
  | 'dragon-position-y';

export interface CrazyAudioRandomIntStep {
  readonly maximum: number;
  readonly minimum: number;
  readonly purpose: CrazyAudioRandomPurpose;
  readonly type: 'draw-random-int-inclusive';
}

export type CrazyAudioPlanStep = CrazyAudioCommand | CrazyAudioRandomIntStep;

export interface CrazyAudioRandomIntTranscriptStep extends CrazyAudioRandomIntStep {
  readonly result: number;
}

export type CrazyAudioExecutionTranscriptStep =
  | CrazyAudioCommand
  | CrazyAudioRandomIntTranscriptStep;

/**
 * Executes a branch-dependent plan in recovered order. The caller supplies one shared RNG
 * boundary and one audio-command boundary; the returned immutable transcript is evidence of
 * every command and exact draw result consumed by the operation.
 */
export interface CrazyAudioExecutionPort {
  drawRandomIntInclusive(request: CrazyAudioRandomIntStep): number;
  executeAudioCommand(command: CrazyAudioCommand): void;
}

export type CrazyAudioPathUsage = 'direct-play' | 'preload-only' | 'unclassified';

export interface CrazyTimerAudioInput {
  readonly displayedSeconds: number;
  readonly effectsEnabled: boolean;
  readonly expired: boolean;
  readonly minutes: number;
  readonly warningSecond: number;
}

export interface CrazyDragonFruitCutAudioInput {
  readonly effectsEnabled: boolean;
  readonly finished: boolean;
  readonly firstCut: boolean;
  readonly logicalWidth?: number;
}

export const CRAZY_DRAGON_FINISH_TRIGGER_ORDER = Object.freeze([
  'end-hit-animation',
  'notify-dragon-fruit-finished',
  'dispose-physics-object',
  'finish-audio-if-effects-enabled',
  'counter-fade-and-objective',
] as const);

const EMPTY_AUDIO_PLAN: readonly CrazyAudioPlanStep[] = Object.freeze([]);
const EMPTY_EXECUTION_TRANSCRIPT: readonly CrazyAudioExecutionTranscriptStep[]
  = Object.freeze([]);

const SPECIAL_FRUIT_BASE_COMMAND = playEffect(
  CRAZY_SPECIAL_FRUIT_BASE_CUT_AUDIO_PATH,
  false,
);
const SPECIAL_FRUIT_CRITICAL_COMMAND = playEffect(
  CRAZY_SPECIAL_FRUIT_CRITICAL_AUDIO_PATH,
  false,
);
const DOUBLE_SCORE_COMMAND = playEffect(CRAZY_DOUBLE_SCORE_AUDIO_PATH, false);
const DOUBLE_TOSS_ENTRY_COMMAND = playEffect(CRAZY_DOUBLE_TOSS_STRUM_AUDIO_PATH, false);
const DOUBLE_TOSS_LOOP_COMMAND = playEffect(
  CRAZY_DOUBLE_TOSS_LOOP_AUDIO_PATH,
  true,
  CRAZY_DOUBLE_TOSS_RETAINED_EFFECT,
);
const DOUBLE_TOSS_STOP_COMMAND: CrazyAudioCommand = Object.freeze({
  gate: 'enable-effects',
  readHandleFrom: CRAZY_DOUBLE_TOSS_RETAINED_EFFECT,
  type: 'stop-effect',
});
const FREEZE_COMMAND = playEffect(CRAZY_FREEZE_AUDIO_PATH, false);
const ELECTRIC_POWER_UP_COMMAND = playEffect(
  CRAZY_ELECTRIC_POWER_UP_AUDIO_PATH,
  false,
);
const ELECTRIC_EXPLOSION_COMMAND = playEffect(
  CRAZY_ELECTRIC_EXPLOSION_AUDIO_PATH,
  false,
);
const ELECTRIC_BACKGROUND_COMMAND: CrazyAudioCommand = Object.freeze({
  canonicalPath: CRAZY_ELECTRIC_BACKGROUND_AUDIO_PATH,
  gate: 'enable-effects',
  loop: true,
  type: 'play-background-music',
});
const ELECTRIC_BACKGROUND_STOP_COMMAND: CrazyAudioCommand = Object.freeze({
  gate: 'enable-effects',
  releaseData: false,
  type: 'stop-background-music',
});
const MAGNET_LOOP_COMMAND = playEffect(
  CRAZY_MAGNET_LOOP_AUDIO_PATH,
  true,
  CRAZY_MAGNET_RETAINED_EFFECT,
);
const MAGNET_STOP_COMMAND: CrazyAudioCommand = Object.freeze({
  gate: 'enable-effects',
  readHandleFrom: CRAZY_MAGNET_RETAINED_EFFECT,
  type: 'stop-effect',
});
const BONUS_TOSS_COMMAND = playEffect(CRAZY_BONUS_TOSS_AUDIO_PATH, false);
const TIMER_TICK_COMMAND = playEffect(CRAZY_TIMER_TICK_AUDIO_PATH, false);
const TIME_UP_COMMAND = playEffect(CRAZY_TIME_UP_AUDIO_PATH, false);
const DRAGON_HIT_MUSIC_COMMAND = playEffect(
  CRAZY_DRAGON_HIT_MUSIC_AUDIO_PATH,
  false,
);
const DRAGON_ACCEPTED_HIT_COMMAND = playEffect(
  CRAZY_DRAGON_ACCEPTED_HIT_AUDIO_PATH,
  false,
);
const DRAGON_FINISH_COMMAND = playEffect(CRAZY_DRAGON_FINISH_AUDIO_PATH, false);

const SPECIAL_FRUIT_BASE_PLAN = frozenPlan([SPECIAL_FRUIT_BASE_COMMAND]);
const SPECIAL_FRUIT_CRITICAL_PLAN = frozenPlan([
  SPECIAL_FRUIT_BASE_COMMAND,
  SPECIAL_FRUIT_CRITICAL_COMMAND,
]);
const DOUBLE_SCORE_PLAN = frozenPlan([DOUBLE_SCORE_COMMAND]);
const DOUBLE_TOSS_START_PLAN = frozenPlan([
  DOUBLE_TOSS_ENTRY_COMMAND,
  DOUBLE_TOSS_LOOP_COMMAND,
]);
const DOUBLE_TOSS_STOP_PLAN = frozenPlan([
  DOUBLE_TOSS_STOP_COMMAND,
  DOUBLE_TOSS_ENTRY_COMMAND,
]);
const FREEZE_PLAN = frozenPlan([FREEZE_COMMAND]);
const ELECTRIC_START_PLAN = frozenPlan([ELECTRIC_POWER_UP_COMMAND]);
const ELECTRIC_TURN_ON_PLAN = frozenPlan([
  ELECTRIC_EXPLOSION_COMMAND,
  ELECTRIC_BACKGROUND_COMMAND,
]);
const ELECTRIC_TURN_OFF_PLAN = frozenPlan([ELECTRIC_BACKGROUND_STOP_COMMAND]);
const MAGNET_BEGIN_PLAN = frozenPlan([MAGNET_LOOP_COMMAND]);
const MAGNET_END_PLAN = frozenPlan([MAGNET_STOP_COMMAND]);
const BONUS_TOSS_PLAN = frozenPlan([BONUS_TOSS_COMMAND]);
const TIMER_TICK_PLAN = frozenPlan([TIMER_TICK_COMMAND]);
const TIME_UP_PLAN = frozenPlan([TIME_UP_COMMAND]);
const TIMER_TICK_AND_TIME_UP_PLAN = frozenPlan([
  TIMER_TICK_COMMAND,
  TIME_UP_COMMAND,
]);
const DRAGON_FINISH_PLAN = frozenPlan([DRAGON_FINISH_COMMAND]);

export const CRAZY_TIME_UP_FINISH_AUDIO_PLAN: readonly CrazyAudioPlanStep[]
  = frozenPlan([
    Object.freeze({
      gate: 'unconditional',
      type: 'stop-all-effects',
    }),
  ]);

const ELECTRIC_HIT_RANDOM_STEP = randomStep(
  'electric-hit-sound',
  0,
  3,
);
const ELECTRIC_HIT_COMMANDS: readonly CrazyAudioCommand[] = Object.freeze(
  CRAZY_ELECTRIC_HIT_AUDIO_PATHS.map((canonicalPath) => (
    playEffect(canonicalPath, false)
  )),
);

const DRAGON_COUNTER_ROTATION_STEP = randomStep(
  'dragon-counter-rotation',
  -30,
  30,
);
const DRAGON_ACCEPTANCE_STEP = randomStep(
  'dragon-hit-acceptance',
  0,
  1,
);
const DRAGON_ACCEPTED_ROTATION_STEP = randomStep(
  'dragon-accepted-hit-rotation',
  -45,
  45,
);

const DIRECT_PATH_SET: ReadonlySet<string> = new Set(CRAZY_DIRECT_PLAY_AUDIO_PATHS);
const PRELOAD_ONLY_PATH_SET: ReadonlySet<string> = new Set(CRAZY_PRELOAD_ONLY_AUDIO_PATHS);

export function classifyCrazyAudioPath(canonicalPath: string): CrazyAudioPathUsage {
  assertCanonicalAudioPath(canonicalPath);
  if (DIRECT_PATH_SET.has(canonicalPath)) {
    return 'direct-play';
  }
  if (PRELOAD_ONLY_PATH_SET.has(canonicalPath)) {
    return 'preload-only';
  }
  return 'unclassified';
}

export function getCrazySpecialFruitBaseCutAudioPlan(
  fruitId: number,
  critical: boolean,
  effectsEnabled: boolean,
): readonly CrazyAudioPlanStep[] {
  assertIntegerInRange(fruitId, 10, 14, 'fruitId');
  assertBoolean(critical, 'critical');
  assertBoolean(effectsEnabled, 'effectsEnabled');
  if (!effectsEnabled) {
    return EMPTY_AUDIO_PLAN;
  }
  return critical ? SPECIAL_FRUIT_CRITICAL_PLAN : SPECIAL_FRUIT_BASE_PLAN;
}

export function getCrazyDoubleScoreAudioPlan(
  effectsEnabled: boolean,
): readonly CrazyAudioPlanStep[] {
  return effectsPlan(effectsEnabled, DOUBLE_SCORE_PLAN);
}

export function getCrazyBombElectricStartAudioPlan(
  effectsEnabled: boolean,
): readonly CrazyAudioPlanStep[] {
  return effectsPlan(effectsEnabled, ELECTRIC_START_PLAN);
}

export function getCrazyBombElectricTurnOnAudioPlan(
  effectsEnabled: boolean,
): readonly CrazyAudioPlanStep[] {
  return effectsPlan(effectsEnabled, ELECTRIC_TURN_ON_PLAN);
}

export function getCrazyBombElectricTurnOffAudioPlan(
  effectsEnabled: boolean,
): readonly CrazyAudioPlanStep[] {
  return effectsPlan(effectsEnabled, ELECTRIC_TURN_OFF_PLAN);
}

export function getCrazyBombElectricStopAudioPlan(
  offFlag: boolean,
  effectsEnabled: boolean,
): readonly CrazyAudioPlanStep[] {
  assertBoolean(offFlag, 'offFlag');
  assertBoolean(effectsEnabled, 'effectsEnabled');
  return offFlag
    ? EMPTY_AUDIO_PLAN
    : getCrazyBombElectricTurnOffAudioPlan(effectsEnabled);
}

/** Executes the native effects gate, one shared RNG draw, then its selected hit cue. */
export function executeCrazyBombElectricHitAudio(
  effectsEnabled: boolean,
  port: CrazyAudioExecutionPort,
): readonly CrazyAudioExecutionTranscriptStep[] {
  assertBoolean(effectsEnabled, 'effectsEnabled');
  assertExecutionPort(port);
  if (!effectsEnabled) {
    return EMPTY_EXECUTION_TRANSCRIPT;
  }
  const transcript: CrazyAudioExecutionTranscriptStep[] = [];
  const drawResult = executeRandomIntStep(
    ELECTRIC_HIT_RANDOM_STEP,
    port,
    transcript,
  );
  const command = ELECTRIC_HIT_COMMANDS[drawResult];
  if (command === undefined) {
    throw new Error(`Crazy electric-hit command is missing for draw ${drawResult}`);
  }
  executeAudioCommand(command, port, transcript);
  return frozenTranscript(transcript);
}

export function getCrazyMagnetBeginAudioPlan(
  effectsEnabled: boolean,
): readonly CrazyAudioPlanStep[] {
  return effectsPlan(effectsEnabled, MAGNET_BEGIN_PLAN);
}

export function getCrazyMagnetEndAudioPlan(
  effectsEnabled: boolean,
): readonly CrazyAudioPlanStep[] {
  return effectsPlan(effectsEnabled, MAGNET_END_PLAN);
}

export function getCrazyDoubleTossStartAudioPlan(
  active: boolean,
  effectsEnabled: boolean,
): readonly CrazyAudioPlanStep[] {
  assertBoolean(active, 'active');
  assertBoolean(effectsEnabled, 'effectsEnabled');
  if (active || !effectsEnabled) {
    return EMPTY_AUDIO_PLAN;
  }
  return DOUBLE_TOSS_START_PLAN;
}

/** Native Stop has no active guard and can repeat this pair. */
export function getCrazyDoubleTossStopAudioPlan(
  effectsEnabled: boolean,
): readonly CrazyAudioPlanStep[] {
  return effectsPlan(effectsEnabled, DOUBLE_TOSS_STOP_PLAN);
}

export function getCrazyBonusTossAudioPlan(
  spawned: boolean,
  effectsEnabled: boolean,
): readonly CrazyAudioPlanStep[] {
  assertBoolean(spawned, 'spawned');
  assertBoolean(effectsEnabled, 'effectsEnabled');
  return spawned && effectsEnabled ? BONUS_TOSS_PLAN : EMPTY_AUDIO_PLAN;
}

export function getCrazyFreezeAudioPlan(
  effectsEnabled: boolean,
): readonly CrazyAudioPlanStep[] {
  return effectsPlan(effectsEnabled, FREEZE_PLAN);
}

export function getCrazyTimerUpdateAudioPlan(
  input: CrazyTimerAudioInput,
): readonly CrazyAudioPlanStep[] {
  assertRecord(input, 'input');
  assertSafeInteger(input.minutes, 'input.minutes');
  assertSafeInteger(input.displayedSeconds, 'input.displayedSeconds');
  assertSafeInteger(input.warningSecond, 'input.warningSecond');
  assertBoolean(input.expired, 'input.expired');
  assertBoolean(input.effectsEnabled, 'input.effectsEnabled');

  if (!input.effectsEnabled) {
    return EMPTY_AUDIO_PLAN;
  }
  const warningReached = input.minutes === 0
    && input.displayedSeconds === input.warningSecond;
  if (warningReached && input.expired) {
    return TIMER_TICK_AND_TIME_UP_PLAN;
  }
  if (warningReached) {
    return TIMER_TICK_PLAN;
  }
  return input.expired ? TIME_UP_PLAN : EMPTY_AUDIO_PLAN;
}

/** Executes one DragonFruit Cut against shared audio/RNG ports in exact recovered order. */
export function executeCrazyDragonFruitCutAudio(
  input: CrazyDragonFruitCutAudioInput,
  port: CrazyAudioExecutionPort,
): readonly CrazyAudioExecutionTranscriptStep[] {
  assertRecord(input, 'input');
  assertBoolean(input.finished, 'input.finished');
  assertBoolean(input.firstCut, 'input.firstCut');
  assertBoolean(input.effectsEnabled, 'input.effectsEnabled');
  assertExecutionPort(port);

  if (input.finished) {
    if (input.logicalWidth !== undefined) {
      throw new RangeError('finished DragonFruit cuts must not supply logicalWidth');
    }
    return EMPTY_EXECUTION_TRANSCRIPT;
  }

  assertPositiveFinite(input.logicalWidth, 'input.logicalWidth');
  const logicalWidth = input.logicalWidth;
  const bound = getCrazyDragonPositionJitterBound(logicalWidth);

  const transcript: CrazyAudioExecutionTranscriptStep[] = [];
  if (input.firstCut) {
    if (input.effectsEnabled) {
      executeAudioCommand(DRAGON_HIT_MUSIC_COMMAND, port, transcript);
    }
    executeRandomIntStep(DRAGON_COUNTER_ROTATION_STEP, port, transcript);
  }
  const acceptanceDraw = executeRandomIntStep(
    DRAGON_ACCEPTANCE_STEP,
    port,
    transcript,
  );

  if (acceptanceDraw === 0) {
    executeRandomIntStep(DRAGON_ACCEPTED_ROTATION_STEP, port, transcript);
    executeRandomIntStep(
      randomStep('dragon-position-x', -bound, bound),
      port,
      transcript,
    );
    executeRandomIntStep(
      randomStep('dragon-position-y', -bound, bound),
      port,
      transcript,
    );
    if (input.effectsEnabled) {
      executeAudioCommand(DRAGON_ACCEPTED_HIT_COMMAND, port, transcript);
    }
  }
  return frozenTranscript(transcript);
}

export function getCrazyDragonFruitFinishAudioPlan(
  effectsEnabled: boolean,
): readonly CrazyAudioPlanStep[] {
  return effectsPlan(effectsEnabled, DRAGON_FINISH_PLAN);
}

/**
 * Native converts the float32 window width to int, back to float32, multiplies
 * by float32 0.03, then truncates again before the two symmetric position draws.
 */
export function getCrazyDragonPositionJitterBound(logicalWidth: number): number {
  assertPositiveFinite(logicalWidth, 'logicalWidth');
  const floatWidth = Math.fround(logicalWidth);
  const integralWidth = Math.trunc(floatWidth);
  if (!Number.isSafeInteger(integralWidth) || integralWidth > 0x7fffffff) {
    throw new RangeError('logicalWidth must fit a positive signed 32-bit integer');
  }
  return Math.trunc(Math.fround(
    Math.fround(integralWidth) * CRAZY_DRAGON_POSITION_JITTER_WIDTH_SCALE,
  ));
}

function playEffect(
  canonicalPath: CrazyEffectAudioPath,
  loop: boolean,
  retainResultAt?: CrazyRetainedEffectReference,
): CrazyAudioCommand {
  if (retainResultAt === undefined) {
    return Object.freeze({
      canonicalPath,
      gate: 'enable-effects',
      loop,
      type: 'play-effect',
    });
  }
  return Object.freeze({
    canonicalPath,
    gate: 'enable-effects',
    loop,
    retainResultAt,
    type: 'play-effect',
  });
}

function randomStep(
  purpose: CrazyAudioRandomPurpose,
  minimum: number,
  maximum: number,
): CrazyAudioRandomIntStep {
  return Object.freeze({
    maximum,
    minimum,
    purpose,
    type: 'draw-random-int-inclusive',
  });
}

function effectsPlan(
  effectsEnabled: boolean,
  plan: readonly CrazyAudioPlanStep[],
): readonly CrazyAudioPlanStep[] {
  assertBoolean(effectsEnabled, 'effectsEnabled');
  return effectsEnabled ? plan : EMPTY_AUDIO_PLAN;
}

function frozenPlan(
  steps: readonly CrazyAudioPlanStep[],
): readonly CrazyAudioPlanStep[] {
  return Object.freeze([...steps]);
}

function frozenTranscript(
  steps: readonly CrazyAudioExecutionTranscriptStep[],
): readonly CrazyAudioExecutionTranscriptStep[] {
  return Object.freeze([...steps]);
}

function executeAudioCommand(
  command: CrazyAudioCommand,
  port: CrazyAudioExecutionPort,
  transcript: CrazyAudioExecutionTranscriptStep[],
): void {
  port.executeAudioCommand(command);
  transcript.push(command);
}

function executeRandomIntStep(
  request: CrazyAudioRandomIntStep,
  port: CrazyAudioExecutionPort,
  transcript: CrazyAudioExecutionTranscriptStep[],
): number {
  const result = port.drawRandomIntInclusive(request);
  assertIntegerInRange(
    result,
    request.minimum,
    request.maximum,
    `${request.purpose} result`,
  );
  transcript.push(Object.freeze({ ...request, result }));
  return result;
}

function assertExecutionPort(port: CrazyAudioExecutionPort): void {
  if (
    port === null
    || typeof port !== 'object'
    || Array.isArray(port)
    || typeof port.drawRandomIntInclusive !== 'function'
    || typeof port.executeAudioCommand !== 'function'
  ) {
    throw new TypeError('Crazy audio execution port is incomplete');
  }
}

function assertCanonicalAudioPath(canonicalPath: string): void {
  if (typeof canonicalPath !== 'string' || canonicalPath.length === 0) {
    throw new TypeError('canonicalPath must be a non-empty string');
  }
  const segments = canonicalPath.split('/');
  if (
    canonicalPath.trim() !== canonicalPath
    || canonicalPath.includes('\\')
    || segments.length < 2
    || segments[0] !== 'Sounds'
    || segments.slice(1).some((segment) => (
      segment.length === 0 || segment === '.' || segment === '..'
    ))
  ) {
    throw new RangeError('canonicalPath must be a normalized Sounds resource path');
  }
}

function assertRecord(value: object, label: string): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function assertBoolean(value: boolean, label: string): void {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be a boolean`);
  }
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}

function assertPositiveFinite(
  value: number | undefined,
  label: string,
): asserts value is number {
  if (
    value === undefined
    || !Number.isFinite(value)
    || value <= 0
    || !Number.isFinite(Math.fround(value))
    || Math.fround(value) <= 0
  ) {
    throw new RangeError(`${label} must be positive and finite as float32`);
  }
}

function assertIntegerInRange(
  value: number | undefined,
  minimum: number,
  maximum: number,
  label: string,
): asserts value is number {
  if (
    !Number.isSafeInteger(value)
    || value === undefined
    || value < minimum
    || value > maximum
  ) {
    throw new RangeError(
      `${label} must be an integer from ${minimum} through ${maximum}`,
    );
  }
}
