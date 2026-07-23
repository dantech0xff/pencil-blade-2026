import {
  COMBO_BIRD_GO_RASTER_PATH,
  COMBO_BIRD_INSTRUCTION_ATTACHMENT_ORDER,
  COMBO_BIRD_INSTRUCTION_CONSTRUCTION_ORDER,
  COMBO_BIRD_INTRO_SLIDE_SECONDS,
  COMBO_BIRD_INTRO_TOTAL_SECONDS,
  COMBO_BIRD_NINETY_RASTER_PATH,
  type ComboBirdInstructionCard,
} from './combo-bird-intro-presentation';
import type { BirdBladeType } from './bird-blade-state';
import type { BirdResourceProfile } from './bird-resource-contract';
import {
  COMBO_BIRD_MODE_ID,
  COMBO_BIRD_TOSS_CREATION_ORDER,
  COMBO_BIRD_TOSS_OUTER_STOP_ORDER,
  COMBO_BIRD_TOSS_START_ORDER,
  getComboBirdTossRow,
  type ComboBirdTossControllerId,
  type ComboBirdTossRow,
} from './combo-bird-toss-config';
import {
  type ScoreCommand,
  ScoreService,
} from './score-service';
import { TIME_MANAGER_TIME_UP_TOTAL_SECONDS } from './time-manager-service';

export const COMBO_BIRD_INITIAL_TIME_SECONDS = Math.fround(90);
export const COMBO_BIRD_OBJECTIVE_EVENT_SELECTOR = 7 as const;
export const COMBO_BIRD_SETTINGS_BEST_SCORE_KEY
  = 'bird_combo_best_1' as const;
export const COMBO_BIRD_BLADE_ASSET = 'Blades/testblade7.png' as const;
export const COMBO_BIRD_BLADE_TYPE = 3 satisfies BirdBladeType;
export const COMBO_BIRD_RESULT_Z_ORDER = 1 as const;
export const COMBO_BIRD_TIME_UP_PRESENTATION_SECONDS
  = TIME_MANAGER_TIME_UP_TOTAL_SECONDS;
export const COMBO_BIRD_CAPTURED_PARENT_BOUNDARY
  = 'captured-combo-bird-parent' as const;

/** Session-command projection checked directly against the shared Bird resource profile. */
export const COMBO_BIRD_BLADE_PROFILE = Object.freeze({
  bladeType: COMBO_BIRD_BLADE_TYPE,
  canonicalPath: COMBO_BIRD_BLADE_ASSET,
}) satisfies Readonly<{
  readonly bladeType: BirdResourceProfile['birdType'];
  readonly canonicalPath: BirdResourceProfile['blade']['canonicalPath'];
}>;

export const COMBO_BIRD_NOMINAL_TIMELINE_SECONDS = Object.freeze({
  enterInstructions: Math.fround(0),
  enterNinety: COMBO_BIRD_INTRO_SLIDE_SECONDS,
  enterGo: Math.fround(COMBO_BIRD_INTRO_SLIDE_SECONDS * 2),
  enterRunning: COMBO_BIRD_INTRO_TOTAL_SECONDS,
  enterTimeUp: Math.fround(
    COMBO_BIRD_INTRO_TOTAL_SECONDS + COMBO_BIRD_INITIAL_TIME_SECONDS,
  ),
  enterResult: Math.fround(
    COMBO_BIRD_INTRO_TOTAL_SECONDS
      + COMBO_BIRD_INITIAL_TIME_SECONDS
      + COMBO_BIRD_TIME_UP_PRESENTATION_SECONDS,
  ),
});

export interface ComboBirdPoint {
  readonly x: number;
  readonly y: number;
}

export type ComboBirdLifecycle =
  | 'constructed'
  | 'intro-instructions'
  | 'intro-ninety'
  | 'intro-go'
  | 'running'
  | 'time-up-presentation'
  | 'result-transition'
  | 'result-removed';

export interface ComboBirdActivitySnapshot {
  readonly birdBladeActive: boolean;
  readonly comboActive: boolean;
  readonly entitiesActive: boolean;
  readonly inputActive: boolean;
  readonly outerTossControllersActive: boolean;
  readonly physicsActive: boolean;
  readonly scoreActive: boolean;
}

export interface ComboBirdSessionSnapshot {
  readonly activity: ComboBirdActivitySnapshot;
  readonly hasBomb: false;
  readonly hasBonusToss: false;
  readonly hasDoubleToss: false;
  readonly hasLives: false;
  readonly hasTimeManager: true;
  readonly lifecycle: ComboBirdLifecycle;
  readonly mode: typeof COMBO_BIRD_MODE_ID;
  readonly sceneEntered: boolean;
  readonly score: ReturnType<ScoreService['snapshot']>;
  readonly waveChildAfterTimeUp: 'pre-armed-pause-only';
}

export type ComboBirdScorePresentationCommand = Extract<
  ScoreCommand,
  Readonly<{
    type:
      | 'start-displayed-score-scale-up'
      | 'start-displayed-score-scale-down';
  }>
>;

export type ComboBirdSessionCommand =
  | Readonly<{ readonly type: 'enter-base-bird-layer' }>
  | Readonly<{
      readonly payload: 0 | 1 | 2;
      readonly selector: typeof COMBO_BIRD_OBJECTIVE_EVENT_SELECTOR;
      readonly type: 'process-objective';
    }>
  | Readonly<{
      readonly controller: ComboBirdTossControllerId;
      readonly row: ComboBirdTossRow;
      readonly type: 'construct-controller';
    }>
  | Readonly<{
      readonly controller: ComboBirdTossControllerId;
      readonly type: 'attach-controller';
      readonly zOrder: 1;
    }>
  | Readonly<{
      readonly callbackOrder: readonly ['time-up', 'time-up-finish'];
      readonly durationSeconds: typeof COMBO_BIRD_INITIAL_TIME_SECONDS;
      readonly type: 'construct-time-manager';
    }>
  | Readonly<{ readonly type: 'attach-time-manager'; readonly zOrder: 1 }>
  | Readonly<{
      readonly card: ComboBirdInstructionCard;
      readonly type: 'create-instruction-card';
    }>
  | Readonly<{
      readonly card: ComboBirdInstructionCard;
      readonly durationSeconds: typeof COMBO_BIRD_INTRO_SLIDE_SECONDS;
      readonly ownsContinuation: boolean;
      readonly type: 'start-instruction-action';
    }>
  | Readonly<{
      readonly card: ComboBirdInstructionCard;
      readonly type: 'attach-instruction-card';
      readonly zOrder: 1;
    }>
  | Readonly<{
      readonly bladeType: typeof COMBO_BIRD_BLADE_TYPE;
      readonly canonicalPath: typeof COMBO_BIRD_BLADE_ASSET;
      readonly type: 'create-bird-blade';
      readonly zOrder: 1;
    }>
  | Readonly<{ readonly type: 'focus-combo-on-score-manager' }>
  | Readonly<{
      readonly key: typeof COMBO_BIRD_SETTINGS_BEST_SCORE_KEY;
      readonly score: number;
      readonly type: 'initialize-best-score';
    }>
  | Readonly<{
      readonly canonicalPath: typeof COMBO_BIRD_NINETY_RASTER_PATH;
      readonly durationSeconds: typeof COMBO_BIRD_INTRO_SLIDE_SECONDS;
      readonly type: 'create-ninety-intro';
      readonly zOrder: 1;
    }>
  | Readonly<{
      readonly canonicalPath: typeof COMBO_BIRD_GO_RASTER_PATH;
      readonly durationSeconds: typeof COMBO_BIRD_INTRO_SLIDE_SECONDS;
      readonly type: 'create-go-intro';
      readonly zOrder: 1;
    }>
  | Readonly<{
      readonly controller: ComboBirdTossControllerId;
      readonly scope: 'outer';
      readonly type: 'start-controller';
    }>
  | Readonly<{ readonly type: 'start-time-manager' }>
  | Readonly<{
      readonly controller: ComboBirdTossControllerId;
      readonly preservesActiveWaveChild: boolean;
      readonly scope: 'outer';
      readonly type: 'stop-controller';
    }>
  | Readonly<{
      readonly position: ComboBirdPoint;
      readonly type: 'check-combo';
    }>
  | Readonly<{
      readonly application: 'already-applied';
      readonly type: 'add-score';
      readonly value: number;
    }>
  | Readonly<{ readonly type: 'stop-effects' }>
  | Readonly<{
      readonly boundary: typeof COMBO_BIRD_CAPTURED_PARENT_BOUNDARY;
      readonly type: 'capture-combo-bird-parent';
    }>
  | Readonly<{ readonly type: 'construct-result' }>
  | Readonly<{
      readonly mode: typeof COMBO_BIRD_MODE_ID;
      readonly type: 'set-result-mode';
    }>
  | Readonly<{ readonly score: number; readonly type: 'set-result-score' }>
  | Readonly<{
      readonly cleanup: true;
      readonly type: 'remove-combo-bird';
    }>
  | Readonly<{
      readonly type: 'attach-result';
      readonly zOrder: typeof COMBO_BIRD_RESULT_Z_ORDER;
    }>
  | ComboBirdScorePresentationCommand;

/**
 * Pure one-run Combo Bird lifecycle.
 *
 * The shared coordinator, timer, ComboService, entities, physics, and input presenters remain
 * separate owners. This class fixes their recovered callback ordering and score handoff.
 */
export class ComboBirdSession {
  private readonly scoreService: ScoreService;
  private lifecycle: ComboBirdLifecycle = 'constructed';
  private sceneEntered = false;

  constructor(initialBestScore = 0) {
    assertSafeInteger(initialBestScore, 'initialBestScore');
    this.scoreService = new ScoreService(0, 0, initialBestScore);
  }

  snapshot(): ComboBirdSessionSnapshot {
    return Object.freeze({
      activity: activityFor(this.lifecycle),
      hasBomb: false,
      hasBonusToss: false,
      hasDoubleToss: false,
      hasLives: false,
      hasTimeManager: true,
      lifecycle: this.lifecycle,
      mode: COMBO_BIRD_MODE_ID,
      sceneEntered: this.sceneEntered,
      score: this.scoreService.snapshot(),
      waveChildAfterTimeUp: 'pre-armed-pause-only',
    });
  }

  enterScene(): readonly ComboBirdSessionCommand[] {
    if (this.sceneEntered || this.lifecycle !== 'constructed') {
      throw new Error('Combo Bird scene can enter only once');
    }
    this.sceneEntered = true;
    this.lifecycle = 'intro-instructions';

    const commands: ComboBirdSessionCommand[] = [
      Object.freeze({ type: 'enter-base-bird-layer' }),
      objectiveCommand(0),
    ];
    for (const controller of COMBO_BIRD_TOSS_CREATION_ORDER) {
      commands.push(Object.freeze({
        controller,
        row: getComboBirdTossRow(controller),
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
      durationSeconds: COMBO_BIRD_INITIAL_TIME_SECONDS,
      type: 'construct-time-manager',
    }));
    commands.push(Object.freeze({ type: 'attach-time-manager', zOrder: 1 }));

    for (const card of COMBO_BIRD_INSTRUCTION_CONSTRUCTION_ORDER) {
      commands.push(Object.freeze({ card, type: 'create-instruction-card' }));
      commands.push(Object.freeze({
        card,
        durationSeconds: COMBO_BIRD_INTRO_SLIDE_SECONDS,
        ownsContinuation: card === 'just-combo',
        type: 'start-instruction-action',
      }));
    }
    for (const card of COMBO_BIRD_INSTRUCTION_ATTACHMENT_ORDER) {
      commands.push(Object.freeze({
        card,
        type: 'attach-instruction-card',
        zOrder: 1,
      }));
    }
    commands.push(Object.freeze({
      bladeType: COMBO_BIRD_BLADE_PROFILE.bladeType,
      canonicalPath: COMBO_BIRD_BLADE_PROFILE.canonicalPath,
      type: 'create-bird-blade',
      zOrder: 1,
    }));
    commands.push(Object.freeze({ type: 'focus-combo-on-score-manager' }));
    commands.push(Object.freeze({
      key: COMBO_BIRD_SETTINGS_BEST_SCORE_KEY,
      score: this.scoreService.bestScore,
      type: 'initialize-best-score',
    }));
    return Object.freeze(commands);
  }

  /** Invoked only by the middle `justComboInstruction` action at nominal 1.25s. */
  totalTimeCallback(): readonly ComboBirdSessionCommand[] {
    this.requireLifecycle(
      'intro-instructions',
      'Combo Bird 90s intro requires the instruction callback',
    );
    this.lifecycle = 'intro-ninety';
    return Object.freeze([
      Object.freeze({
        canonicalPath: COMBO_BIRD_NINETY_RASTER_PATH,
        durationSeconds: COMBO_BIRD_INTRO_SLIDE_SECONDS,
        type: 'create-ninety-intro',
        zOrder: 1,
      }),
    ]);
  }

  /** Invoked by the 90s card completion at nominal 2.5s. */
  goCallback(): readonly ComboBirdSessionCommand[] {
    this.requireLifecycle(
      'intro-ninety',
      'Combo Bird GO intro requires the 90s callback',
    );
    this.lifecycle = 'intro-go';
    return Object.freeze([
      Object.freeze({
        canonicalPath: COMBO_BIRD_GO_RASTER_PATH,
        durationSeconds: COMBO_BIRD_INTRO_SLIDE_SECONDS,
        type: 'create-go-intro',
        zOrder: 1,
      }),
    ]);
  }

  /** Invoked by GO completion at nominal 3.75s. Controllers start before TimeManager. */
  startGameCallback(): readonly ComboBirdSessionCommand[] {
    this.requireLifecycle(
      'intro-go',
      'Combo Bird start requires the GO callback',
    );
    this.lifecycle = 'running';
    const commands: ComboBirdSessionCommand[] = [];
    for (const controller of COMBO_BIRD_TOSS_START_ORDER) {
      commands.push(Object.freeze({
        controller,
        scope: 'outer',
        type: 'start-controller',
      }));
    }
    commands.push(Object.freeze({ type: 'start-time-manager' }));
    return Object.freeze(commands);
  }

  /** Shared blade/ray owner delegates each accepted cut position through ComboService. */
  checkCombo(position: ComboBirdPoint): readonly ComboBirdSessionCommand[] {
    this.requireGameplayCallbacksLive();
    return Object.freeze([
      Object.freeze({
        position: freezePoint(position),
        type: 'check-combo',
      }),
    ]);
  }

  /** Shared ComboService delegates its ordered bonus score command through this seam. */
  addScore(value: number): void {
    this.requireGameplayCallbacksLive();
    this.scoreService.addScore(assertSafeScore(value, 'value'));
  }

  /**
   * Native ComboBirdLayer ignores position/fruit ID locally and forwards supplied score once.
   */
  fruitCut(
    position: ComboBirdPoint,
    fruitId: number,
    suppliedScore: number,
  ): readonly ComboBirdSessionCommand[] {
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

  fruitFail(position: ComboBirdPoint): readonly ComboBirdSessionCommand[] {
    return this.failFruit(position);
  }

  bonusFruitFail(position: ComboBirdPoint): readonly ComboBirdSessionCommand[] {
    return this.failFruit(position);
  }

  updateScorePresentation():
    readonly ComboBirdScorePresentationCommand[] {
    this.requireGameplayCallbacksLive();
    return requireScorePresentationCommands(
      this.scoreService.updateDisplayedScore(),
    );
  }

  completeDisplayedScoreScaleUp():
    readonly ComboBirdScorePresentationCommand[] {
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
   * Timer-zero callback. Only the three outer slots stop; all gameplay callback owners remain
   * live and score is deliberately not sampled here.
   */
  timeUp(): readonly ComboBirdSessionCommand[] {
    this.requireLifecycle(
      'running',
      'Combo Bird Time Up can begin only while running',
    );
    this.lifecycle = 'time-up-presentation';
    const commands: ComboBirdSessionCommand[] = [];
    for (const controller of COMBO_BIRD_TOSS_OUTER_STOP_ORDER) {
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

  /**
   * Three-second presentation completion. This is the first and only result-score sample.
   */
  timeUpFinish(): readonly ComboBirdSessionCommand[] {
    this.requireLifecycle(
      'time-up-presentation',
      'Combo Bird result requires the Time Up finish callback',
    );
    this.lifecycle = 'result-transition';
    return Object.freeze([
      Object.freeze({ type: 'stop-effects' }),
      Object.freeze({
        boundary: COMBO_BIRD_CAPTURED_PARENT_BOUNDARY,
        type: 'capture-combo-bird-parent',
      }),
      Object.freeze({ type: 'construct-result' }),
      Object.freeze({ mode: COMBO_BIRD_MODE_ID, type: 'set-result-mode' }),
      Object.freeze({
        score: this.scoreService.authoritativeScore,
        type: 'set-result-score',
      }),
      Object.freeze({ cleanup: true, type: 'remove-combo-bird' }),
      Object.freeze({ type: 'attach-result', zOrder: COMBO_BIRD_RESULT_Z_ORDER }),
    ]);
  }

  commitTimeUpFinish(): void {
    this.requireLifecycle(
      'result-transition',
      'Combo Bird result transition is not pending',
    );
    this.lifecycle = 'result-removed';
  }

  rollbackTimeUpFinish(): void {
    this.requireLifecycle(
      'result-transition',
      'Combo Bird result transition is not pending',
    );
    this.lifecycle = 'time-up-presentation';
  }

  private failFruit(
    position: ComboBirdPoint,
  ): readonly ComboBirdSessionCommand[] {
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
        'Combo Bird gameplay callbacks require running or Time Up presentation',
      );
    }
  }

  private requireLifecycle(
    expected: ComboBirdLifecycle,
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
  ComboBirdSessionCommand,
  Readonly<{ type: 'process-objective' }>
> {
  return Object.freeze({
    payload,
    selector: COMBO_BIRD_OBJECTIVE_EVENT_SELECTOR,
    type: 'process-objective',
  });
}

function activityFor(
  lifecycle: ComboBirdLifecycle,
): ComboBirdActivitySnapshot {
  const gameplayAttached = lifecycle !== 'constructed'
    && lifecycle !== 'result-removed';
  return Object.freeze({
    birdBladeActive: gameplayAttached,
    comboActive: gameplayAttached,
    entitiesActive: gameplayAttached,
    inputActive: gameplayAttached,
    outerTossControllersActive: lifecycle === 'running',
    physicsActive: gameplayAttached,
    scoreActive: gameplayAttached,
  });
}

function requireScorePresentationCommands(
  commands: readonly ScoreCommand[],
): readonly ComboBirdScorePresentationCommand[] {
  for (const command of commands) {
    if (
      command.type !== 'start-displayed-score-scale-up'
      && command.type !== 'start-displayed-score-scale-down'
    ) {
      throw new Error(`unsupported Combo Bird score command ${command.type}`);
    }
  }
  return commands as readonly ComboBirdScorePresentationCommand[];
}

function freezePoint(point: ComboBirdPoint): ComboBirdPoint {
  assertPoint(point);
  const x = Math.fround(point.x);
  const y = Math.fround(point.y);
  assertFinite(x, 'position.x float32');
  assertFinite(y, 'position.y float32');
  return Object.freeze({
    x,
    y,
  });
}

function assertPoint(point: ComboBirdPoint): void {
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
