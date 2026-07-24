import {
  GN_STYLE_GO_RASTER_PATH,
  GN_STYLE_GO_SLIDE_SECONDS,
  GN_STYLE_INSTRUCTION_ATTACHMENT_ORDER,
  GN_STYLE_INSTRUCTION_CONSTRUCTION_ORDER,
  GN_STYLE_INSTRUCTION_SLIDE_SECONDS,
  GN_STYLE_INTRO_TOTAL_SECONDS,
  GN_STYLE_ONE_HUNDRED_FIFTY_RASTER_PATH,
  GN_STYLE_ONE_HUNDRED_FIFTY_SLIDE_SECONDS,
  type GnStyleInstructionCard,
} from './gn-style-intro-presentation';
import {
  GN_STYLE_MODE_ID,
  GN_STYLE_TOSS_CREATION_ORDER,
  GN_STYLE_TOSS_OUTER_STOP_ORDER,
  GN_STYLE_TOSS_START_ORDER,
  getGnStyleTossRow,
  type GnStyleTossControllerId,
  type GnStyleTossRow,
} from './gn-style-toss-config';
import {
  type ScoreCommand,
  ScoreService,
} from './score-service';
import { TIME_MANAGER_TIME_UP_TOTAL_SECONDS } from './time-manager-service';

export const GN_STYLE_INITIAL_TIME_SECONDS = Math.fround(150);
export const GN_STYLE_OBJECTIVE_EVENT_SELECTOR = 6 as const;
export const GN_STYLE_SETTINGS_BEST_SCORE_KEY
  = 'gnstyle_best_1' as const;
export const GN_STYLE_RESULT_Z_ORDER = 1 as const;
export const GN_STYLE_TIME_UP_PRESENTATION_SECONDS
  = TIME_MANAGER_TIME_UP_TOTAL_SECONDS;
export const GN_STYLE_CAPTURED_PARENT_BOUNDARY
  = 'captured-gn-style-parent' as const;

export const GN_STYLE_NOMINAL_TIMELINE_SECONDS = Object.freeze({
  enterInstructions: Math.fround(0),
  enterOneHundredFifty: Math.fround(0.75),
  enterGo: Math.fround(1.7),
  enterRunning: GN_STYLE_INTRO_TOTAL_SECONDS,
  enterTimeUp: Math.fround(
    GN_STYLE_INTRO_TOTAL_SECONDS + GN_STYLE_INITIAL_TIME_SECONDS,
  ),
  enterResult: Math.fround(
    GN_STYLE_INTRO_TOTAL_SECONDS
      + GN_STYLE_INITIAL_TIME_SECONDS
      + GN_STYLE_TIME_UP_PRESENTATION_SECONDS,
  ),
});

export interface GnStylePoint {
  readonly x: number;
  readonly y: number;
}

export type GnStyleLifecycle =
  | 'constructed'
  | 'intro-instructions'
  | 'intro-150'
  | 'intro-go'
  | 'running'
  | 'time-up-presentation'
  | 'result-transition'
  | 'result-removed';

export interface GnStyleActivitySnapshot {
  readonly comboActive: boolean;
  readonly entitiesActive: boolean;
  readonly inputActive: boolean;
  readonly ordinaryBladeActive: boolean;
  readonly outerTossControllersActive: boolean;
  readonly physicsActive: boolean;
  readonly scoreActive: boolean;
}

export interface GnStyleSessionSnapshot {
  readonly activity: GnStyleActivitySnapshot;
  readonly hasBirdBlade: false;
  readonly hasBomb: false;
  readonly hasBonusToss: false;
  readonly hasDoubleToss: false;
  readonly hasFreezeProducer: false;
  readonly hasLives: false;
  readonly hasTimeManager: true;
  readonly lifecycle: GnStyleLifecycle;
  readonly mode: typeof GN_STYLE_MODE_ID;
  readonly sceneEntered: boolean;
  readonly score: ReturnType<ScoreService['snapshot']>;
  readonly waveChildAfterTimeUp: 'pre-armed-pause-only';
}

export type GnStyleScorePresentationCommand = Extract<
  ScoreCommand,
  Readonly<{
    type:
      | 'start-displayed-score-scale-up'
      | 'start-displayed-score-scale-down';
  }>
>;

export type GnStyleSessionCommand =
  | Readonly<{ readonly type: 'enter-base-gameplay-layer' }>
  | Readonly<{
      readonly payload: 0 | 1 | 2;
      readonly selector: typeof GN_STYLE_OBJECTIVE_EVENT_SELECTOR;
      readonly type: 'process-objective';
    }>
  | Readonly<{
      readonly controller: GnStyleTossControllerId;
      readonly row: GnStyleTossRow;
      readonly type: 'construct-controller';
    }>
  | Readonly<{
      readonly controller: GnStyleTossControllerId;
      readonly type: 'attach-controller';
      readonly zOrder: 1;
    }>
  | Readonly<{
      readonly callbackOrder: readonly ['time-up', 'time-up-finish'];
      readonly durationSeconds: typeof GN_STYLE_INITIAL_TIME_SECONDS;
      readonly type: 'construct-time-manager';
    }>
  | Readonly<{ readonly type: 'attach-time-manager'; readonly zOrder: 1 }>
  | Readonly<{
      readonly key: typeof GN_STYLE_SETTINGS_BEST_SCORE_KEY;
      readonly score: number;
      readonly type: 'initialize-best-score';
    }>
  | Readonly<{
      readonly card: GnStyleInstructionCard;
      readonly type: 'create-instruction-card';
    }>
  | Readonly<{
      readonly card: GnStyleInstructionCard;
      readonly durationSeconds: typeof GN_STYLE_INSTRUCTION_SLIDE_SECONDS;
      readonly ownsContinuation: boolean;
      readonly type: 'start-instruction-action';
    }>
  | Readonly<{
      readonly card: GnStyleInstructionCard;
      readonly type: 'attach-instruction-card';
      readonly zOrder: 1;
    }>
  | Readonly<{
      readonly canonicalPath: typeof GN_STYLE_ONE_HUNDRED_FIFTY_RASTER_PATH;
      readonly durationSeconds: typeof GN_STYLE_ONE_HUNDRED_FIFTY_SLIDE_SECONDS;
      readonly type: 'create-one-hundred-fifty-intro';
      readonly zOrder: 1;
    }>
  | Readonly<{
      readonly canonicalPath: typeof GN_STYLE_GO_RASTER_PATH;
      readonly durationSeconds: typeof GN_STYLE_GO_SLIDE_SECONDS;
      readonly type: 'create-go-intro';
      readonly zOrder: 1;
    }>
  | Readonly<{
      readonly controller: GnStyleTossControllerId;
      readonly scope: 'outer';
      readonly type: 'start-controller';
    }>
  | Readonly<{ readonly type: 'start-time-manager' }>
  | Readonly<{
      readonly controller: GnStyleTossControllerId;
      readonly preservesActiveWaveChild: boolean;
      readonly scope: 'outer';
      readonly type: 'stop-controller';
    }>
  | Readonly<{
      readonly position: GnStylePoint;
      readonly type: 'check-combo';
    }>
  | Readonly<{
      readonly application: 'already-applied';
      readonly type: 'add-score';
      readonly value: number;
    }>
  | Readonly<{ readonly type: 'stop-effects' }>
  | Readonly<{
      readonly boundary: typeof GN_STYLE_CAPTURED_PARENT_BOUNDARY;
      readonly type: 'capture-gn-style-parent';
    }>
  | Readonly<{ readonly type: 'construct-result' }>
  | Readonly<{
      readonly mode: typeof GN_STYLE_MODE_ID;
      readonly type: 'set-result-mode';
    }>
  | Readonly<{ readonly score: number; readonly type: 'set-result-score' }>
  | Readonly<{
      readonly cleanup: true;
      readonly type: 'remove-gn-style';
    }>
  | Readonly<{
      readonly type: 'attach-result';
      readonly zOrder: typeof GN_STYLE_RESULT_Z_ORDER;
    }>
  | GnStyleScorePresentationCommand;

/**
 * Pure one-run GN Style lifecycle.
 *
 * Shared ordinary blade input, coordinator, timer, combo, entities, physics, and presentation
 * remain separate owners. This class fixes their recovered callback ordering and score handoff.
 */
export class GnStyleSession {
  private readonly scoreService: ScoreService;
  private lifecycle: GnStyleLifecycle = 'constructed';
  private sceneEntered = false;

  constructor(initialBestScore = 0) {
    assertSafeInteger(initialBestScore, 'initialBestScore');
    this.scoreService = new ScoreService(0, 0, initialBestScore);
  }

  snapshot(): GnStyleSessionSnapshot {
    return Object.freeze({
      activity: activityFor(this.lifecycle),
      hasBirdBlade: false,
      hasBomb: false,
      hasBonusToss: false,
      hasDoubleToss: false,
      hasFreezeProducer: false,
      hasLives: false,
      hasTimeManager: true,
      lifecycle: this.lifecycle,
      mode: GN_STYLE_MODE_ID,
      sceneEntered: this.sceneEntered,
      score: this.scoreService.snapshot(),
      waveChildAfterTimeUp: 'pre-armed-pause-only',
    });
  }

  enterScene(): readonly GnStyleSessionCommand[] {
    if (this.sceneEntered || this.lifecycle !== 'constructed') {
      throw new Error('GN Style scene can enter only once');
    }
    this.sceneEntered = true;
    this.lifecycle = 'intro-instructions';

    const commands: GnStyleSessionCommand[] = [
      Object.freeze({ type: 'enter-base-gameplay-layer' }),
      objectiveCommand(0),
    ];
    for (const controller of GN_STYLE_TOSS_CREATION_ORDER) {
      commands.push(Object.freeze({
        controller,
        row: getGnStyleTossRow(controller),
        type: 'construct-controller',
      }));
      commands.push(Object.freeze({
        controller,
        type: 'attach-controller',
        zOrder: 1,
      }));
    }
    commands.push(Object.freeze({
      callbackOrder: Object.freeze(['time-up', 'time-up-finish'] as const),
      durationSeconds: GN_STYLE_INITIAL_TIME_SECONDS,
      type: 'construct-time-manager',
    }));
    commands.push(Object.freeze({ type: 'attach-time-manager', zOrder: 1 }));
    commands.push(Object.freeze({
      key: GN_STYLE_SETTINGS_BEST_SCORE_KEY,
      score: this.scoreService.bestScore,
      type: 'initialize-best-score',
    }));

    for (const card of GN_STYLE_INSTRUCTION_CONSTRUCTION_ORDER) {
      commands.push(Object.freeze({ card, type: 'create-instruction-card' }));
      commands.push(Object.freeze({
        card,
        durationSeconds: GN_STYLE_INSTRUCTION_SLIDE_SECONDS,
        ownsContinuation: card === 'gn-style',
        type: 'start-instruction-action',
      }));
    }
    for (const card of GN_STYLE_INSTRUCTION_ATTACHMENT_ORDER) {
      commands.push(Object.freeze({
        card,
        type: 'attach-instruction-card',
        zOrder: 1,
      }));
    }
    return Object.freeze(commands);
  }

  /** Invoked only by the center GN Style action at nominal 0.75s. */
  totalTimeCallback(): readonly GnStyleSessionCommand[] {
    this.requireLifecycle(
      'intro-instructions',
      'GN Style 150s intro requires the instruction callback',
    );
    this.lifecycle = 'intro-150';
    return Object.freeze([
      Object.freeze({
        canonicalPath: GN_STYLE_ONE_HUNDRED_FIFTY_RASTER_PATH,
        durationSeconds: GN_STYLE_ONE_HUNDRED_FIFTY_SLIDE_SECONDS,
        type: 'create-one-hundred-fifty-intro',
        zOrder: 1,
      }),
    ]);
  }

  /** Invoked by the 150s card completion at nominal 1.70s. */
  goCallback(): readonly GnStyleSessionCommand[] {
    this.requireLifecycle(
      'intro-150',
      'GN Style GO intro requires the 150s callback',
    );
    this.lifecycle = 'intro-go';
    return Object.freeze([
      Object.freeze({
        canonicalPath: GN_STYLE_GO_RASTER_PATH,
        durationSeconds: GN_STYLE_GO_SLIDE_SECONDS,
        type: 'create-go-intro',
        zOrder: 1,
      }),
    ]);
  }

  /** Invoked by GO completion at nominal 2.60s. Controllers start before TimeManager. */
  startGameCallback(): readonly GnStyleSessionCommand[] {
    this.requireLifecycle(
      'intro-go',
      'GN Style start requires the GO callback',
    );
    this.lifecycle = 'running';
    const commands: GnStyleSessionCommand[] = [];
    for (const controller of GN_STYLE_TOSS_START_ORDER) {
      commands.push(Object.freeze({
        controller,
        scope: 'outer',
        type: 'start-controller',
      }));
    }
    commands.push(Object.freeze({ type: 'start-time-manager' }));
    return Object.freeze(commands);
  }

  checkCombo(position: GnStylePoint): readonly GnStyleSessionCommand[] {
    this.requireGameplayCallbacksLive();
    return Object.freeze([
      Object.freeze({
        position: freezePoint(position),
        type: 'check-combo',
      }),
    ]);
  }

  addScore(value: number): void {
    this.requireGameplayCallbacksLive();
    this.scoreService.addScore(assertSafeScore(value, 'value'));
  }

  /** Native GN Style ignores position/fruit ID locally and forwards supplied score once. */
  fruitCut(
    position: GnStylePoint,
    fruitId: number,
    suppliedScore: number,
  ): readonly GnStyleSessionCommand[] {
    this.requireGameplayCallbacksLive();
    assertPoint(position);
    assertSafeInteger(fruitId, 'fruitId');
    const score = assertSafeScore(suppliedScore, 'suppliedScore');
    this.scoreService.addScore(score);
    return Object.freeze([
      Object.freeze({
        application: 'already-applied',
        type: 'add-score',
        value: score,
      }),
    ]);
  }

  fruitFail(position: GnStylePoint): readonly GnStyleSessionCommand[] {
    return this.failFruit(position);
  }

  bonusFruitFail(position: GnStylePoint): readonly GnStyleSessionCommand[] {
    return this.failFruit(position);
  }

  updateScorePresentation():
    readonly GnStyleScorePresentationCommand[] {
    this.requireGameplayCallbacksLive();
    return requireScorePresentationCommands(
      this.scoreService.updateDisplayedScore(),
    );
  }

  completeDisplayedScoreScaleUp():
    readonly GnStyleScorePresentationCommand[] {
    this.requireGameplayCallbacksLive();
    return requireScorePresentationCommands(
      this.scoreService.completeDisplayedScoreScaleUp(),
    );
  }

  completeDisplayedScoreScaleDown(): void {
    this.requireGameplayCallbacksLive();
    this.scoreService.completeDisplayedScoreScaleDown();
  }

  /**
   * Timer-zero callback. Only the three outer slots stop; gameplay callback owners remain
   * live and score is deliberately not sampled here.
   */
  timeUp(): readonly GnStyleSessionCommand[] {
    this.requireLifecycle(
      'running',
      'GN Style Time Up can begin only while running',
    );
    this.lifecycle = 'time-up-presentation';
    const commands: GnStyleSessionCommand[] = [];
    for (const controller of GN_STYLE_TOSS_OUTER_STOP_ORDER) {
      commands.push(Object.freeze({
        controller,
        preservesActiveWaveChild: controller === 'wave',
        scope: 'outer',
        type: 'stop-controller',
      }));
    }
    commands.push(objectiveCommand(2));
    return Object.freeze(commands);
  }

  /** Three-second presentation completion. This is the first and only result-score sample. */
  timeUpFinish(): readonly GnStyleSessionCommand[] {
    this.requireLifecycle(
      'time-up-presentation',
      'GN Style result requires the Time Up finish callback',
    );
    this.lifecycle = 'result-transition';
    return Object.freeze([
      Object.freeze({ type: 'stop-effects' }),
      Object.freeze({
        boundary: GN_STYLE_CAPTURED_PARENT_BOUNDARY,
        type: 'capture-gn-style-parent',
      }),
      Object.freeze({ type: 'construct-result' }),
      Object.freeze({ mode: GN_STYLE_MODE_ID, type: 'set-result-mode' }),
      Object.freeze({
        score: this.scoreService.authoritativeScore,
        type: 'set-result-score',
      }),
      Object.freeze({ cleanup: true, type: 'remove-gn-style' }),
      Object.freeze({ type: 'attach-result', zOrder: GN_STYLE_RESULT_Z_ORDER }),
    ]);
  }

  commitTimeUpFinish(): void {
    this.requireLifecycle(
      'result-transition',
      'GN Style result transition is not pending',
    );
    this.lifecycle = 'result-removed';
  }

  rollbackTimeUpFinish(): void {
    this.requireLifecycle(
      'result-transition',
      'GN Style result transition is not pending',
    );
    this.lifecycle = 'time-up-presentation';
  }

  private failFruit(
    position: GnStylePoint,
  ): readonly GnStyleSessionCommand[] {
    this.requireGameplayCallbacksLive();
    assertPoint(position);
    return Object.freeze([objectiveCommand(1)]);
  }

  private requireGameplayCallbacksLive(): void {
    if (
      this.lifecycle !== 'running'
      && this.lifecycle !== 'time-up-presentation'
    ) {
      throw new Error(
        'GN Style gameplay callbacks require running or Time Up presentation',
      );
    }
  }

  private requireLifecycle(
    expected: GnStyleLifecycle,
    message: string,
  ): void {
    if (this.lifecycle !== expected) {
      throw new Error(message);
    }
  }
}

function objectiveCommand(
  payload: 0 | 1 | 2,
): Extract<
  GnStyleSessionCommand,
  Readonly<{ type: 'process-objective' }>
> {
  return Object.freeze({
    payload,
    selector: GN_STYLE_OBJECTIVE_EVENT_SELECTOR,
    type: 'process-objective',
  });
}

function activityFor(
  lifecycle: GnStyleLifecycle,
): GnStyleActivitySnapshot {
  const gameplayAttached = lifecycle !== 'constructed'
    && lifecycle !== 'result-removed';
  return Object.freeze({
    comboActive: gameplayAttached,
    entitiesActive: gameplayAttached,
    inputActive: gameplayAttached,
    ordinaryBladeActive: gameplayAttached,
    outerTossControllersActive: lifecycle === 'running',
    physicsActive: gameplayAttached,
    scoreActive: gameplayAttached,
  });
}

function requireScorePresentationCommands(
  commands: readonly ScoreCommand[],
): readonly GnStyleScorePresentationCommand[] {
  for (const command of commands) {
    if (
      command.type !== 'start-displayed-score-scale-up'
      && command.type !== 'start-displayed-score-scale-down'
    ) {
      throw new Error(`unsupported GN Style score command ${command.type}`);
    }
  }
  return commands as readonly GnStyleScorePresentationCommand[];
}

function freezePoint(point: GnStylePoint): GnStylePoint {
  assertPoint(point);
  const x = Math.fround(point.x);
  const y = Math.fround(point.y);
  assertFinite(x, 'position.x float32');
  assertFinite(y, 'position.y float32');
  return Object.freeze({ x, y });
}

function assertPoint(point: GnStylePoint): void {
  if (point === null || typeof point !== 'object' || Array.isArray(point)) {
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

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}
