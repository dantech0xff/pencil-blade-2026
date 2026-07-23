import {
  CLASSIC_BIRD_MODE_ID,
  CLASSIC_BIRD_TOSS_CREATION_ORDER,
  CLASSIC_BIRD_TOSS_START_ORDER,
  CLASSIC_BIRD_TOSS_STOP_ORDER,
  getClassicBirdTossRow,
  type ClassicBirdTossControllerId,
  type ClassicBirdTossRow,
} from './classic-bird-toss-config';
import {
  type ScoreCommand,
  ScoreService,
} from './score-service';
import {
  STANDARD_BOMB_EXPLOSION_FINISH_SECONDS,
} from './standard-bomb-explosion-state';

export const CLASSIC_BIRD_SETTINGS_BEST_SCORE_KEY = 'bird_classic_best_1';
export const CLASSIC_BIRD_BLADE_ASSET = 'Blades/testblade7.png';
export const CLASSIC_BIRD_BLADE_TYPE = 1 as const;
export const CLASSIC_BIRD_BOMB_DELAY_SECONDS =
  STANDARD_BOMB_EXPLOSION_FINISH_SECONDS;
export const CLASSIC_BIRD_GAME_OVER_SECONDS = 2.5 as const;
export const CLASSIC_BIRD_INITIAL_WORLD_SPEED = Math.fround(1);
export const CLASSIC_BIRD_SPEED_INCREMENT = Math.fround(0.1);
export const CLASSIC_BIRD_SPEED_LIMIT = Math.fround(2);
export const CLASSIC_BIRD_SPEED_UP_DELAY_SECONDS = 45 as const;
export const CLASSIC_BIRD_RESULT_Z_ORDER = 1 as const;
export const CLASSIC_BIRD_CAPTURED_PARENT_BOUNDARY =
  'captured-classic-bird-parent' as const;

/**
 * Native electric/magnet owner callbacks can outlive shutdown. Creator removal instead cancels
 * them, restores normal toss bounds, and stops retained audio before releasing the run.
 */
export const CLASSIC_BIRD_SAFE_CLEANUP_DIVERGENCE =
  'cancel-electric-magnet-callbacks-restore-normal-bounds-without-resume-stop-retained-audio' as const;

export const CLASSIC_BIRD_INTRO_PRESENTATION = Object.freeze({
  durationSeconds: 1.5,
  good: Object.freeze({
    canonicalPath: 'Text/text-good.png' as const,
    start: Object.freeze({ xViewportWidths: -0.25, yHeightRatio: 0.525 }),
    centre: Object.freeze({ xViewportWidths: 0.5, yHeightRatio: 0.525 }),
    end: Object.freeze({ xViewportWidths: 1.25, yHeightRatio: 0.525 }),
    moveInSeconds: 0.5,
    holdSeconds: 0.5,
    moveOutSeconds: 0.5,
    callsStartGame: false,
  }),
  luck: Object.freeze({
    canonicalPath: 'Text/text-luck.png' as const,
    start: Object.freeze({ xViewportWidths: 1.25, yHeightRatio: 0.475 }),
    centre: Object.freeze({ xViewportWidths: 0.5, yHeightRatio: 0.475 }),
    end: Object.freeze({ xViewportWidths: -0.25, yHeightRatio: 0.475 }),
    moveInSeconds: 0.5,
    holdSeconds: 0.5,
    moveOutSeconds: 0.5,
    callsStartGame: true,
  }),
});

export const CLASSIC_BIRD_GAME_OVER_PRESENTATION = Object.freeze({
  durationSeconds: CLASSIC_BIRD_GAME_OVER_SECONDS,
  game: Object.freeze({
    canonicalPath: 'Text/text-game.png' as const,
    start: Object.freeze({
      xViewportWidths: 0.5,
      yHeightRatio: 'top-plus-half-sprite' as const,
    }),
    centre: Object.freeze({ xViewportWidths: 0.5, yHeightRatio: 0.575 }),
    end: Object.freeze({ xViewportWidths: -0.5, yHeightRatio: 0.575 }),
    moveInSeconds: 0.75,
    holdSeconds: 1,
    moveOutSeconds: 0.75,
    callsDisplayScore: true,
  }),
  over: Object.freeze({
    canonicalPath: 'Text/text-over.png' as const,
    start: Object.freeze({
      xViewportWidths: 0.5,
      yHeightRatio: 'bottom-minus-half-sprite' as const,
    }),
    centre: Object.freeze({ xViewportWidths: 0.5, yHeightRatio: 0.425 }),
    end: Object.freeze({ xViewportWidths: 1.5, yHeightRatio: 0.425 }),
    moveInSeconds: 0.75,
    holdSeconds: 1,
    moveOutSeconds: 0.75,
    callsDisplayScore: false,
  }),
});

export interface ClassicBirdPoint {
  readonly x: number;
  readonly y: number;
}

export type ClassicBirdLifecycle =
  | 'intro'
  | 'running'
  | 'game-over'
  | 'result-transition'
  | 'result-removed';

export type ClassicBirdWorldSpeedCommand =
  | Readonly<{ type: 'set-world-speed'; value: number }>
  | Readonly<{
      type: 'schedule-speed-up-callback';
      delaySeconds: typeof CLASSIC_BIRD_SPEED_UP_DELAY_SECONDS;
    }>;

export type ClassicBirdScorePresentationCommand = Extract<
  ScoreCommand,
  Readonly<{
    type:
      | 'start-displayed-score-scale-up'
      | 'start-displayed-score-scale-down';
  }>
>;

export interface ClassicBirdWorldSpeedSnapshot {
  readonly callbackArmed: boolean;
  readonly speed: number;
}

const NO_CLASSIC_BIRD_SPEED_COMMANDS:
  readonly ClassicBirdWorldSpeedCommand[] = Object.freeze([]);

/**
 * The one pending callback is modeled explicitly so the tenth float32 addition can rearm a
 * final callback whose pre-add check is a no-op.
 */
export class ClassicBirdWorldSpeed {
  private callbackArmedValue = false;
  private speedValue = CLASSIC_BIRD_INITIAL_WORLD_SPEED;

  snapshot(): ClassicBirdWorldSpeedSnapshot {
    return Object.freeze({
      callbackArmed: this.callbackArmedValue,
      speed: this.speedValue,
    });
  }

  enableAtSceneEntry(): readonly ClassicBirdWorldSpeedCommand[] {
    if (this.callbackArmedValue) {
      throw new Error('Classic Bird world speed is already armed');
    }
    this.callbackArmedValue = true;
    return Object.freeze([
      Object.freeze({
        type: 'schedule-speed-up-callback',
        delaySeconds: CLASSIC_BIRD_SPEED_UP_DELAY_SECONDS,
      }),
    ]);
  }

  speedUpDelayComplete(): readonly ClassicBirdWorldSpeedCommand[] {
    if (!this.callbackArmedValue) {
      return NO_CLASSIC_BIRD_SPEED_COMMANDS;
    }

    this.callbackArmedValue = false;
    if (this.speedValue >= CLASSIC_BIRD_SPEED_LIMIT) {
      return NO_CLASSIC_BIRD_SPEED_COMMANDS;
    }

    this.speedValue = Math.fround(
      this.speedValue + CLASSIC_BIRD_SPEED_INCREMENT,
    );
    this.callbackArmedValue = true;
    return Object.freeze([
      Object.freeze({ type: 'set-world-speed', value: this.speedValue }),
      Object.freeze({
        type: 'schedule-speed-up-callback',
        delaySeconds: CLASSIC_BIRD_SPEED_UP_DELAY_SECONDS,
      }),
    ]);
  }

  /** Only the physics-step delta crosses the world-speed multiplier. */
  physicsStepDelta(frameDeltaSeconds: number): number {
    assertFiniteNonNegative(frameDeltaSeconds, 'frameDeltaSeconds');
    const floatDelta = Math.fround(frameDeltaSeconds);
    if (!Number.isFinite(floatDelta)) {
      throw new RangeError('frameDeltaSeconds is outside the float32 range');
    }
    return Math.fround(floatDelta * this.speedValue);
  }
}

export type ClassicBirdSessionCommand =
  | Readonly<{ type: 'enter-base-bird-layer' }>
  | Readonly<{ type: 'read-logical-size-and-physics-world' }>
  | Readonly<{
      type: 'construct-controller';
      controller: ClassicBirdTossControllerId;
      row: ClassicBirdTossRow;
    }>
  | Readonly<{
      type: 'attach-controller';
      controller: ClassicBirdTossControllerId;
      zOrder: 1;
    }>
  | Readonly<{ type: 'construct-fruit-fail-manager' }>
  | Readonly<{ type: 'register-fruit-fail-game-over-callback' }>
  | Readonly<{ type: 'attach-fruit-fail-manager'; zOrder: 1 }>
  | Readonly<{
      type: 'create-intro-word';
      word: 'good' | 'luck';
      plan:
        | typeof CLASSIC_BIRD_INTRO_PRESENTATION.good
        | typeof CLASSIC_BIRD_INTRO_PRESENTATION.luck;
      zOrder: 1;
    }>
  | Readonly<{ type: 'construct-bomb-electric' }>
  | Readonly<{ type: 'attach-bomb-electric'; zOrder: 1 }>
  | Readonly<{
      type: 'create-bird-blade';
      canonicalPath: typeof CLASSIC_BIRD_BLADE_ASSET;
      bladeType: typeof CLASSIC_BIRD_BLADE_TYPE;
      zOrder: 1;
    }>
  | Readonly<{ type: 'focus-combo-on-score-manager' }>
  | Readonly<{ type: 'initialize-pause-ui' }>
  | Readonly<{
      type: 'initialize-best-score';
      key: typeof CLASSIC_BIRD_SETTINGS_BEST_SCORE_KEY;
      score: number;
    }>
  | Readonly<{ type: 'set-cut-enabled'; enabled: boolean }>
  | Readonly<{
      type: 'toss-controller';
      action: 'start' | 'stop';
      controller: ClassicBirdTossControllerId;
    }>
  | Readonly<{ type: 'check-combo'; position: ClassicBirdPoint }>
  | Readonly<{ type: 'register-fruit-fail'; position: ClassicBirdPoint }>
  | Readonly<{ type: 'start-electric-bomb' }>
  | Readonly<{
      type: 'create-magnet-animation';
      beginCallback: 'classic-bird-magnet-begin';
      endCallback: 'classic-bird-magnet-end';
      zOrder: 1;
    }>
  | Readonly<{
      type: 'add-score';
      value: number;
      application: 'already-applied';
    }>
  | Readonly<{ type: 'stop-electric-bomb' }>
  | Readonly<{ type: 'set-physics-stopped'; stopped: boolean }>
  | Readonly<{
      type: 'show-game-over';
      presentation: typeof CLASSIC_BIRD_GAME_OVER_PRESENTATION;
    }>
  | Readonly<{ type: 'stop-effects' }>
  | Readonly<{
      type: 'capture-classic-bird-parent';
      boundary: typeof CLASSIC_BIRD_CAPTURED_PARENT_BOUNDARY;
    }>
  | Readonly<{ type: 'construct-result' }>
  | Readonly<{ type: 'set-result-mode'; mode: typeof CLASSIC_BIRD_MODE_ID }>
  | Readonly<{ type: 'set-result-score'; score: number }>
  | Readonly<{
      type: 'remove-classic-bird';
      cleanup: true;
      cleanupPolicy: typeof CLASSIC_BIRD_SAFE_CLEANUP_DIVERGENCE;
    }>
  | Readonly<{
      type: 'attach-result';
      zOrder: typeof CLASSIC_BIRD_RESULT_Z_ORDER;
    }>
  | ClassicBirdWorldSpeedCommand
  | ClassicBirdScorePresentationCommand;

export interface ClassicBirdSessionSnapshot {
  readonly cutEnabled: boolean;
  readonly hasBonusToss: false;
  readonly hasDoubleToss: false;
  readonly hasTimeManager: false;
  readonly lifecycle: ClassicBirdLifecycle;
  readonly mode: typeof CLASSIC_BIRD_MODE_ID;
  readonly sceneEntered: boolean;
  readonly score: ReturnType<ScoreService['snapshot']>;
  readonly terminalPresentationGuard: boolean;
  readonly worldSpeed: ClassicBirdWorldSpeedSnapshot;
  readonly worldStopped: boolean;
}

const NO_CLASSIC_BIRD_SESSION_COMMANDS:
  readonly ClassicBirdSessionCommand[] = Object.freeze([]);

/**
 * Untimed Classic Bird session. Shared score and combo behavior remain separate services:
 * this owner exposes their command/delegation seams and owns only Bird-specific routing.
 */
export class ClassicBirdSession {
  private readonly scoreService: ScoreService;
  private readonly worldSpeed = new ClassicBirdWorldSpeed();
  private cutEnabled = true;
  private lifecycle: ClassicBirdLifecycle = 'intro';
  private sceneEntered = false;
  private terminalPresentationGuard = false;
  private worldStopped = false;

  constructor(initialBestScore = 0) {
    assertSafeInteger(initialBestScore, 'initialBestScore');
    this.scoreService = new ScoreService(0, 0, initialBestScore);
  }

  snapshot(): ClassicBirdSessionSnapshot {
    return Object.freeze({
      cutEnabled: this.cutEnabled,
      hasBonusToss: false,
      hasDoubleToss: false,
      hasTimeManager: false,
      lifecycle: this.lifecycle,
      mode: CLASSIC_BIRD_MODE_ID,
      sceneEntered: this.sceneEntered,
      score: this.scoreService.snapshot(),
      terminalPresentationGuard: this.terminalPresentationGuard,
      worldSpeed: this.worldSpeed.snapshot(),
      worldStopped: this.worldStopped,
    });
  }

  enterScene(): readonly ClassicBirdSessionCommand[] {
    if (this.sceneEntered || this.lifecycle !== 'intro') {
      throw new Error('Classic Bird scene can enter only once');
    }
    this.sceneEntered = true;

    const commands: ClassicBirdSessionCommand[] = [
      Object.freeze({ type: 'enter-base-bird-layer' }),
      Object.freeze({ type: 'read-logical-size-and-physics-world' }),
    ];
    for (const controller of CLASSIC_BIRD_TOSS_CREATION_ORDER) {
      commands.push(Object.freeze({
        type: 'construct-controller',
        controller,
        row: getClassicBirdTossRow(controller),
      }));
      commands.push(Object.freeze({
        type: 'attach-controller',
        controller,
        zOrder: 1,
      }));
    }
    commands.push(Object.freeze({ type: 'construct-fruit-fail-manager' }));
    commands.push(Object.freeze({
      type: 'register-fruit-fail-game-over-callback',
    }));
    commands.push(Object.freeze({
      type: 'attach-fruit-fail-manager',
      zOrder: 1,
    }));
    commands.push(Object.freeze({
      type: 'create-intro-word',
      word: 'good',
      plan: CLASSIC_BIRD_INTRO_PRESENTATION.good,
      zOrder: 1,
    }));
    commands.push(Object.freeze({
      type: 'create-intro-word',
      word: 'luck',
      plan: CLASSIC_BIRD_INTRO_PRESENTATION.luck,
      zOrder: 1,
    }));
    commands.push(Object.freeze({ type: 'construct-bomb-electric' }));
    commands.push(Object.freeze({ type: 'attach-bomb-electric', zOrder: 1 }));
    commands.push(Object.freeze({
      type: 'create-bird-blade',
      canonicalPath: CLASSIC_BIRD_BLADE_ASSET,
      bladeType: CLASSIC_BIRD_BLADE_TYPE,
      zOrder: 1,
    }));
    commands.push(Object.freeze({ type: 'focus-combo-on-score-manager' }));
    commands.push(Object.freeze({ type: 'initialize-pause-ui' }));
    commands.push(Object.freeze({
      type: 'initialize-best-score',
      key: CLASSIC_BIRD_SETTINGS_BEST_SCORE_KEY,
      score: this.scoreService.bestScore,
    }));
    commands.push(...this.worldSpeed.enableAtSceneEntry());
    return Object.freeze(commands);
  }

  /** Only LUCK completion calls this start boundary. */
  completeIntro(): readonly ClassicBirdSessionCommand[] {
    if (!this.sceneEntered || this.lifecycle !== 'intro') {
      throw new Error('Classic Bird intro can complete only once');
    }

    this.lifecycle = 'running';
    this.cutEnabled = true;
    const commands: ClassicBirdSessionCommand[] = [
      Object.freeze({ type: 'set-cut-enabled', enabled: true }),
    ];
    for (const controller of CLASSIC_BIRD_TOSS_START_ORDER) {
      commands.push(Object.freeze({
        type: 'toss-controller',
        action: 'start',
        controller,
      }));
    }
    return Object.freeze(commands);
  }

  /** Shared blade/raycast owners delegate eligible fruit positions through this seam. */
  checkCombo(position: ClassicBirdPoint): readonly ClassicBirdSessionCommand[] {
    assertPoint(position);
    return Object.freeze([
      Object.freeze({ type: 'check-combo', position: freezePoint(position) }),
    ]);
  }

  /** Shared combo command batches delegate their signed score additions here. */
  addScore(value: number): void {
    this.scoreService.addScore(assertSafeScore(value, 'value'));
  }

  updateScorePresentation(): readonly ClassicBirdScorePresentationCommand[] {
    return requireClassicBirdScorePresentationCommands(
      this.scoreService.updateDisplayedScore(),
    );
  }

  completeDisplayedScoreScaleUp():
    readonly ClassicBirdScorePresentationCommand[] {
    return requireClassicBirdScorePresentationCommands(
      this.scoreService.completeDisplayedScoreScaleUp(),
    );
  }

  completeDisplayedScoreScaleDown(): void {
    this.scoreService.completeDisplayedScoreScaleDown();
  }

  /**
   * ID 13 starts electric before fixed +10, ID 14 registers magnet before fixed +10, and all
   * ordinary fruit retain the supplied shared-cut score.
   */
  fruitCut(
    position: ClassicBirdPoint,
    fruitId: number,
    suppliedScore: number,
  ): readonly ClassicBirdSessionCommand[] {
    assertPoint(position);
    assertSafeInteger(fruitId, 'fruitId');
    assertSafeInteger(suppliedScore, 'suppliedScore');
    if (this.lifecycle === 'result-removed') {
      return NO_CLASSIC_BIRD_SESSION_COMMANDS;
    }

    let score = suppliedScore;
    const commands: ClassicBirdSessionCommand[] = [];
    if (fruitId === 13) {
      commands.push(Object.freeze({ type: 'start-electric-bomb' }));
      score = 10;
    } else if (fruitId === 14) {
      commands.push(Object.freeze({
        type: 'create-magnet-animation',
        beginCallback: 'classic-bird-magnet-begin',
        endCallback: 'classic-bird-magnet-end',
        zOrder: 1,
      }));
      score = 10;
    }

    this.scoreService.addScore(score);
    // This is an operation trace, not an imperative adapter command. ScoreService already owns
    // the mutation; feeding the observation back through `addScore()` would double the cut.
    commands.push(Object.freeze({
      type: 'add-score',
      value: score,
      application: 'already-applied',
    }));
    return Object.freeze(commands);
  }

  fruitFail(position: ClassicBirdPoint): readonly ClassicBirdSessionCommand[] {
    assertPoint(position);
    return Object.freeze([
      Object.freeze({
        type: 'register-fruit-fail',
        position: freezePoint(position),
      }),
    ]);
  }

  /**
   * Every fail callback repeats shutdown. Only GAME/OVER construction is guarded, matching the
   * shared fail manager's possible repeated completions after the third marker.
   */
  gameOverFromMiss(): readonly ClassicBirdSessionCommand[] {
    if (this.lifecycle === 'result-removed') {
      return NO_CLASSIC_BIRD_SESSION_COMMANDS;
    }
    const commands = this.shutdownGameplay();
    const terminal = this.armTerminalPresentation();
    if (terminal !== null) {
      commands.push(terminal);
    }
    return Object.freeze(commands);
  }

  /**
   * Standard bomb applies no score mutation. `StandardBombExplosionPresenter` is the sole owner
   * of the recovered 2.5-second clock and invokes `afterBombHit` on natural completion.
   */
  bombHit(): readonly ClassicBirdSessionCommand[] {
    if (this.lifecycle === 'result-removed') {
      return NO_CLASSIC_BIRD_SESSION_COMMANDS;
    }
    const commands = this.shutdownGameplay();
    this.worldStopped = true;
    commands.push(Object.freeze({
      type: 'set-physics-stopped',
      stopped: true,
    }));
    return Object.freeze(commands);
  }

  /** GAME/OVER is guarded, while the shared last-writer physics Boolean always clears. */
  afterBombHit(): readonly ClassicBirdSessionCommand[] {
    if (this.lifecycle === 'result-removed') {
      this.worldStopped = false;
      // Cleanup normally disposes the pending explosion. If its completion already escaped,
      // still clear the adapter's Boolean gate instead of mutating only retired domain state.
      return Object.freeze([
        Object.freeze({ type: 'set-physics-stopped', stopped: false }),
      ]);
    }
    const commands: ClassicBirdSessionCommand[] = [];
    const terminal = this.armTerminalPresentation();
    if (terminal !== null) {
      commands.push(terminal);
    }
    this.worldStopped = false;
    commands.push(Object.freeze({
      type: 'set-physics-stopped',
      stopped: false,
    }));
    return Object.freeze(commands);
  }

  speedUpDelayComplete(): readonly ClassicBirdWorldSpeedCommand[] {
    return this.worldSpeed.speedUpDelayComplete();
  }

  physicsStepDelta(frameDeltaSeconds: number): number {
    return this.worldSpeed.physicsStepDelta(frameDeltaSeconds);
  }

  /**
   * GAME's completion prepares the reversible result handoff. The controller commits only after
   * construction, attachment, and ownership transfer succeed; otherwise it rolls this state
   * back and may prepare the same authoritative score again.
   */
  displayScoreComplete(): readonly ClassicBirdSessionCommand[] {
    if (this.lifecycle === 'result-removed') {
      return NO_CLASSIC_BIRD_SESSION_COMMANDS;
    }
    if (this.lifecycle === 'result-transition') {
      throw new Error('Classic Bird result transition is already pending');
    }
    if (!this.terminalPresentationGuard) {
      throw new Error('Classic Bird result requires GAME/OVER presentation');
    }

    this.cutEnabled = false;
    this.lifecycle = 'result-transition';
    return Object.freeze([
      Object.freeze({ type: 'stop-effects' }),
      Object.freeze({
        type: 'capture-classic-bird-parent',
        boundary: CLASSIC_BIRD_CAPTURED_PARENT_BOUNDARY,
      }),
      Object.freeze({ type: 'construct-result' }),
      Object.freeze({ type: 'set-result-mode', mode: CLASSIC_BIRD_MODE_ID }),
      Object.freeze({
        type: 'set-result-score',
        score: this.scoreService.authoritativeScore,
      }),
      Object.freeze({
        type: 'remove-classic-bird',
        cleanup: true,
        cleanupPolicy: CLASSIC_BIRD_SAFE_CLEANUP_DIVERGENCE,
      }),
      Object.freeze({
        type: 'attach-result',
        zOrder: CLASSIC_BIRD_RESULT_Z_ORDER,
      }),
    ]);
  }

  commitDisplayScoreComplete(): void {
    if (this.lifecycle !== 'result-transition') {
      throw new Error('Classic Bird result transition is not pending');
    }
    this.cutEnabled = false;
    this.lifecycle = 'result-removed';
  }

  rollbackDisplayScoreComplete(): void {
    if (this.lifecycle !== 'result-transition') {
      throw new Error('Classic Bird result transition is not pending');
    }
    this.cutEnabled = false;
    this.lifecycle = 'game-over';
  }

  private shutdownGameplay(): ClassicBirdSessionCommand[] {
    this.cutEnabled = false;
    const commands: ClassicBirdSessionCommand[] = [
      Object.freeze({ type: 'set-cut-enabled', enabled: false }),
    ];
    for (const controller of CLASSIC_BIRD_TOSS_STOP_ORDER) {
      commands.push(Object.freeze({
        type: 'toss-controller',
        action: 'stop',
        controller,
      }));
    }
    commands.push(Object.freeze({ type: 'stop-electric-bomb' }));
    return commands;
  }

  private armTerminalPresentation(): ClassicBirdSessionCommand | null {
    if (this.terminalPresentationGuard) {
      return null;
    }
    this.terminalPresentationGuard = true;
    this.lifecycle = 'game-over';
    return Object.freeze({
      type: 'show-game-over',
      presentation: CLASSIC_BIRD_GAME_OVER_PRESENTATION,
    });
  }
}

function freezePoint(point: ClassicBirdPoint): ClassicBirdPoint {
  return Object.freeze({ x: point.x, y: point.y });
}

function requireClassicBirdScorePresentationCommands(
  commands: readonly ScoreCommand[],
): readonly ClassicBirdScorePresentationCommand[] {
  for (const command of commands) {
    if (
      command.type !== 'start-displayed-score-scale-up'
      && command.type !== 'start-displayed-score-scale-down'
    ) {
      throw new Error(`unsupported Classic Bird score command ${command.type}`);
    }
  }
  return commands as readonly ClassicBirdScorePresentationCommand[];
}

function assertPoint(point: ClassicBirdPoint): void {
  if (point === null || typeof point !== 'object') {
    throw new TypeError('position must be an object');
  }
  assertFinite(point.x, 'position.x');
  assertFinite(point.y, 'position.y');
}

function assertSafeScore(value: number, label: string): number {
  assertSafeInteger(value, label);
  return value;
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}

function assertFiniteNonNegative(value: number, label: string): void {
  assertFinite(value, label);
  if (value < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}
