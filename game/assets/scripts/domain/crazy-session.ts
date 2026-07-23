import {
  type ScoreCommand,
  ScoreService,
} from './score-service';
import {
  CRAZY_TOSS_BOMB_HIT_STOP_ORDER,
  CRAZY_TOSS_CREATION_ORDER,
  CRAZY_TOSS_START_ORDER,
  CRAZY_TOSS_TIME_UP_STOP_ORDER,
  type CrazyTossControllerId,
  type CrazyTossRow,
  CRAZY_TOSS_ROWS,
} from './crazy-toss-config';
import {
  CRAZY_BIRD_TIMED_PROFILE,
  CRAZY_BIRD_CAPTURED_PARENT_BOUNDARY,
  CRAZY_CAPTURED_PARENT_BOUNDARY as PROFILE_CRAZY_CAPTURED_PARENT_BOUNDARY,
  CRAZY_TIMED_PROFILE,
  type CrazyTimedModeBestScoreKey,
  type CrazyTimedModeId,
  type CrazyTimedModeProfile,
  type CrazyTimedModeRemoveCommand,
} from './crazy-timed-mode-profile';

export const CRAZY_INITIAL_INTRO_SECONDS = 60 as const;
export const CRAZY_SETTINGS_BEST_SCORE_KEY = CRAZY_TIMED_PROFILE.bestScoreKey;
export const CRAZY_RESULT_NAVIGATION_Z_ORDER = 1;
export const CRAZY_CAPTURED_PARENT_BOUNDARY
  = PROFILE_CRAZY_CAPTURED_PARENT_BOUNDARY;

export interface CrazyPoint {
  readonly x: number;
  readonly y: number;
}

export type CrazyLifecycle =
  | 'intro'
  | 'running'
  | 'time-up'
  | 'result-transition'
  | 'result-removed';

export interface CrazySessionSnapshot {
  readonly cutEnabled: boolean;
  readonly hasTimeManager: true;
  readonly lifecycle: CrazyLifecycle;
  readonly mode: CrazyTimedModeId;
  readonly score: ReturnType<ScoreService['snapshot']>;
}

export type CrazyObjectiveEventId = 4 | 5 | 8 | 9;
export type CrazyObjectiveState = 0 | 1 | 2;
export type CrazyStartableControllerId =
  (typeof CRAZY_TOSS_START_ORDER)[number];
export type CrazyStoppableControllerId =
  | (typeof CRAZY_TOSS_BOMB_HIT_STOP_ORDER)[number]
  | (typeof CRAZY_TOSS_TIME_UP_STOP_ORDER)[number];

export type CrazySessionCommand =
  | Readonly<{ type: 'enter-base-gameplay-layer' }>
  | Readonly<{ type: 'enter-base-bird-layer' }>
  | Readonly<{ type: 'reset-bonus-manager' }>
  | Readonly<{
      type: 'process-objective';
      eventId: CrazyObjectiveEventId;
      state: CrazyObjectiveState;
    }>
  | Readonly<{ type: 'read-logical-director-size' }>
  | Readonly<{
      type: 'construct-controller';
      controller: CrazyTossControllerId;
      row: CrazyTossRow;
    }>
  | Readonly<{
      type: 'attach-controller';
      controller: CrazyTossControllerId;
      zOrder: 1;
    }>
  | Readonly<{
      type: 'construct-time-manager';
      durationSeconds: 60;
      callbackOrder: readonly [
        'freeze-start',
        'freeze-finish',
        'time-up',
        'time-up-finish',
      ];
    }>
  | Readonly<{
      type: 'attach-time-manager';
      zOrder: 1;
    }>
  | Readonly<{
      type: 'create-intro-sixty';
      canonicalPath: 'Text/text-60s.png';
      zOrder: 1;
    }>
  | Readonly<{
      type: 'construct-bomb-electric';
      zOrder: 1;
    }>
  | Readonly<{
      type: 'attach-bomb-electric';
      zOrder: 1;
    }>
  | Readonly<{ type: 'initialize-pause-ui' }>
  | Readonly<{
      type: 'initialize-best-score';
      key: CrazyTimedModeBestScoreKey;
      score: number;
    }>
  | Readonly<{ type: 'set-cut-enabled'; enabled: boolean }>
  | Readonly<{ type: 'add-score'; value: number }>
  | Readonly<{ type: 'start-time-manager' }>
  | Readonly<{
      type: 'start-controller';
      controller: CrazyStartableControllerId;
    }>
  | Readonly<{
      type: 'stop-controller';
      controller: CrazyStoppableControllerId;
    }>
  | Readonly<{ type: 'stop-electric-bomb' }>
  | Readonly<{ type: 'freeze-world' }>
  | Readonly<{ type: 'unfreeze-world' }>
  | Readonly<{ type: 'stop-effects' }>
  | Readonly<{
      type: 'capture-crazy-parent';
      boundary: typeof CRAZY_CAPTURED_PARENT_BOUNDARY;
    }>
  | Readonly<{
      type: 'capture-crazy-bird-parent';
      boundary: typeof CRAZY_BIRD_CAPTURED_PARENT_BOUNDARY;
    }>
  | Readonly<{ type: 'construct-result' }>
  | Readonly<{ type: 'set-result-mode'; mode: CrazyTimedModeId }>
  | Readonly<{ type: 'set-result-score'; score: number }>
  | Readonly<{ type: CrazyTimedModeRemoveCommand; cleanup: true }>
  | Readonly<{ type: 'attach-result'; zOrder: typeof CRAZY_RESULT_NAVIGATION_Z_ORDER }>
  | ScoreCommand;

export class CrazySession {
  private readonly scoreService: ScoreService;
  private lifecycle: CrazyLifecycle = 'intro';
  private cutEnabled = true;
  private sceneEntered = false;
  private readonly hasTimeManagerValue: true = true;
  private readonly profileValue: CrazyTimedModeProfile;

  constructor(
    initialBestScore = 0,
    profile: CrazyTimedModeProfile = CRAZY_TIMED_PROFILE,
  ) {
    assertSafeInteger(initialBestScore, 'initialBestScore');
    assertTimedModeProfile(profile);
    this.scoreService = new ScoreService(0, 0, initialBestScore);
    this.profileValue = profile;
  }

  snapshot(): CrazySessionSnapshot {
    return Object.freeze({
      cutEnabled: this.cutEnabled,
      hasTimeManager: this.hasTimeManagerValue,
      lifecycle: this.lifecycle,
      mode: this.profileValue.mode,
      score: this.scoreService.snapshot(),
    });
  }

  get bestScoreKey(): CrazyTimedModeBestScoreKey {
    return this.profileValue.bestScoreKey;
  }

  get modeProfile(): CrazyTimedModeProfile {
    return this.profileValue;
  }

  addScore(value: number): void {
    this.scoreService.addScore(assertCrazyScore(value, 'value'));
  }

  enableDoubleScore(): readonly ScoreCommand[] {
    return this.scoreService.enableDoubleScore();
  }

  disableDoubleScore(): readonly ScoreCommand[] {
    return this.scoreService.disableDoubleScore();
  }

  finishDoubleScore(): readonly ScoreCommand[] {
    return this.scoreService.finishDoubleScore();
  }

  updateScorePresentation(): readonly ScoreCommand[] {
    return this.scoreService.updateDisplayedScore();
  }

  completeDisplayedScoreScaleUp(): readonly ScoreCommand[] {
    return this.scoreService.completeDisplayedScoreScaleUp();
  }

  completeDisplayedScoreScaleDown(): void {
    this.scoreService.completeDisplayedScoreScaleDown();
  }

  enterScene(): readonly CrazySessionCommand[] {
    if (this.sceneEntered || this.lifecycle !== 'intro') {
      throw new Error('Crazy scene can enter only once');
    }
    this.sceneEntered = true;

    const commands: CrazySessionCommand[] = [
      Object.freeze({ type: this.profileValue.baseEntryCommand }),
      Object.freeze({ type: 'reset-bonus-manager' }),
      Object.freeze({
        type: 'process-objective',
        eventId: this.profileValue.noBombObjectiveEventId,
        state: 0,
      }),
      Object.freeze({
        type: 'process-objective',
        eventId: this.profileValue.noDropObjectiveEventId,
        state: 0,
      }),
      Object.freeze({ type: 'read-logical-director-size' }),
    ];

    for (const controller of CRAZY_TOSS_CREATION_ORDER) {
      const row = getCrazyRow(controller);
      commands.push(Object.freeze({ type: 'construct-controller', controller, row }));
      commands.push(Object.freeze({ type: 'attach-controller', controller, zOrder: 1 }));
    }

    commands.push(Object.freeze({
      type: 'construct-time-manager',
      durationSeconds: CRAZY_INITIAL_INTRO_SECONDS,
      callbackOrder: Object.freeze([
        'freeze-start',
        'freeze-finish',
        'time-up',
        'time-up-finish',
      ] as const),
    }));
    commands.push(Object.freeze({ type: 'attach-time-manager', zOrder: 1 }));
    commands.push(Object.freeze({
      canonicalPath: 'Text/text-60s.png',
      type: 'create-intro-sixty',
      zOrder: 1,
    }));
    commands.push(Object.freeze({ type: 'construct-bomb-electric', zOrder: 1 }));
    commands.push(Object.freeze({ type: 'attach-bomb-electric', zOrder: 1 }));
    commands.push(Object.freeze({ type: 'initialize-pause-ui' }));
    commands.push(Object.freeze({
      type: 'initialize-best-score',
      key: this.profileValue.bestScoreKey,
      score: this.scoreService.bestScore,
    }));

    return Object.freeze(commands);
  }

  completeIntro(): readonly CrazySessionCommand[] {
    if (!this.sceneEntered || this.lifecycle !== 'intro') {
      throw new Error('Crazy intro can complete only once');
    }

    this.lifecycle = 'running';
    this.cutEnabled = true;

    const commands: CrazySessionCommand[] = [
      Object.freeze({ type: 'start-time-manager' }),
      Object.freeze({ type: 'set-cut-enabled', enabled: true }),
    ];
    for (const controller of CRAZY_TOSS_START_ORDER) {
      commands.push(Object.freeze({ type: 'start-controller', controller }));
    }
    return Object.freeze(commands);
  }

  fruitFail(position: CrazyPoint): readonly CrazySessionCommand[] {
    assertPoint(position);
    return Object.freeze([
      Object.freeze({
        type: 'process-objective',
        eventId: this.profileValue.noDropObjectiveEventId,
        state: 1,
      }),
    ]);
  }

  bonusFruitFail(position: CrazyPoint): readonly CrazySessionCommand[] {
    assertPoint(position);
    return Object.freeze([
      Object.freeze({
        type: 'process-objective',
        eventId: this.profileValue.noDropObjectiveEventId,
        state: 1,
      }),
    ]);
  }

  bombHit(position: CrazyPoint): readonly CrazySessionCommand[] {
    assertPoint(position);
    this.cutEnabled = false;

    // Native order is AddScore(-10) followed by DisableDoubleScore(). ScoreService owns
    // the pending double-score bucket, so commit the signed delta before flushing it.
    // The matching command below is the observable operation trace for presenters/objectives;
    // it must not be applied to ScoreService a second time by a Creator adapter.
    this.scoreService.addScore(-10);
    const doubleScoreCommands = this.disableDoubleScore();
    const commands: CrazySessionCommand[] = [
      Object.freeze({ type: 'set-cut-enabled', enabled: false }),
      Object.freeze({ type: 'add-score', value: -10 }),
      ...doubleScoreCommands,
    ];
    for (const controller of CRAZY_TOSS_BOMB_HIT_STOP_ORDER) {
      commands.push(Object.freeze({ type: 'stop-controller', controller }));
    }
    commands.push(Object.freeze({
      type: 'process-objective',
      eventId: this.profileValue.noBombObjectiveEventId,
      state: 1,
    }));
    return Object.freeze(commands);
  }

  afterBombHit(): readonly CrazySessionCommand[] {
    this.cutEnabled = true;
    return Object.freeze([
      Object.freeze({ type: 'set-cut-enabled', enabled: true }),
    ]);
  }

  freezeStart(): readonly CrazySessionCommand[] {
    return Object.freeze([
      Object.freeze({ type: 'freeze-world' }),
    ]);
  }

  freezeFinish(): readonly CrazySessionCommand[] {
    return Object.freeze([
      Object.freeze({ type: 'unfreeze-world' }),
    ]);
  }

  timeUp(): readonly CrazySessionCommand[] {
    if (this.lifecycle !== 'running') {
      throw new Error('Crazy time-up can begin only while running');
    }
    this.lifecycle = 'time-up';
    const commands: CrazySessionCommand[] = [];
    for (const controller of CRAZY_TOSS_TIME_UP_STOP_ORDER) {
      commands.push(Object.freeze({ type: 'stop-controller', controller }));
    }
    commands.push(Object.freeze({ type: 'stop-electric-bomb' }));
    commands.push(...this.finishDoubleScore());
    commands.push(Object.freeze({
      type: 'process-objective',
      eventId: this.profileValue.noBombObjectiveEventId,
      state: 2,
    }));
    commands.push(Object.freeze({
      type: 'process-objective',
      eventId: this.profileValue.noDropObjectiveEventId,
      state: 2,
    }));
    return Object.freeze(commands);
  }

  timeUpFinish(): readonly CrazySessionCommand[] {
    if (this.lifecycle !== 'time-up') {
      throw new Error('Crazy result transition can begin only after time-up');
    }
    this.lifecycle = 'result-transition';
    const captureCommand = createCaptureCommand(this.profileValue);
    return Object.freeze([
      Object.freeze({ type: 'set-cut-enabled', enabled: false }),
      Object.freeze({ type: 'stop-effects' }),
      captureCommand,
      Object.freeze({ type: 'construct-result' }),
      Object.freeze({ type: 'set-result-mode', mode: this.profileValue.mode }),
      Object.freeze({
        type: 'set-result-score',
        score: this.scoreService.authoritativeScore,
      }),
      Object.freeze({ type: this.profileValue.removeCommand, cleanup: true }),
      Object.freeze({ type: 'attach-result', zOrder: CRAZY_RESULT_NAVIGATION_Z_ORDER }),
    ]);
  }

  commitTimeUpFinish(): void {
    if (this.lifecycle !== 'result-transition') {
      throw new Error('Crazy result transition is not pending');
    }
    this.cutEnabled = false;
    this.lifecycle = 'result-removed';
  }

  rollbackTimeUpFinish(): void {
    if (this.lifecycle !== 'result-transition') {
      throw new Error('Crazy result transition is not pending');
    }
    this.cutEnabled = true;
    this.lifecycle = 'time-up';
  }

}

function getCrazyRow(controller: CrazyTossControllerId): CrazyTossRow {
  const row = CRAZY_TOSS_ROWS.find((candidate) => candidate.id === controller);
  if (row === undefined) {
    throw new RangeError(`unknown Crazy controller ${controller}`);
  }
  return row;
}

function createCaptureCommand(
  profile: CrazyTimedModeProfile,
): Extract<
  CrazySessionCommand,
  Readonly<{
    type: 'capture-crazy-parent' | 'capture-crazy-bird-parent';
  }>
> {
  if (profile.kind === 'crazy-bird') {
    return Object.freeze({
      type: 'capture-crazy-bird-parent',
      boundary: CRAZY_BIRD_CAPTURED_PARENT_BOUNDARY,
    });
  }
  return Object.freeze({
    type: 'capture-crazy-parent',
    boundary: CRAZY_CAPTURED_PARENT_BOUNDARY,
  });
}

function assertPoint(point: CrazyPoint): void {
  if (point === null || typeof point !== 'object') {
    throw new TypeError('position must be an object');
  }
  assertFinite(point.x, 'position.x');
  assertFinite(point.y, 'position.y');
}

function assertCrazyScore(value: number, label: string): number {
  assertSafeInteger(value, label);
  return value;
}

function assertTimedModeProfile(profile: CrazyTimedModeProfile): void {
  if (
    profile !== CRAZY_TIMED_PROFILE
    && profile !== CRAZY_BIRD_TIMED_PROFILE
  ) {
    throw new TypeError('profile must be a supported immutable Crazy timed-mode profile');
  }
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}
