import * as Cocos from 'cc';

import {
  _decorator,
  Component,
  Node,
  isValid,
  type AssetManager,
  type Font,
} from 'cc';

import type { BladeMoveResult } from '../domain/blade-tracks';
import {
  CLASSIC_MENU_BUTTON_AUDIO_PATH,
  CLASSIC_OBJECTIVE_CHEER_AUDIO_PATH,
  getClassicComboAudioPath,
  getClassicFruitCutAudioSequence,
  getClassicResultRankAudioPath,
} from '../domain/classic-audio-contract';
import type {
  BaseGameplayPauseObjectiveCard,
} from '../domain/base-gameplay-pause-state';
import {
  buildBidirectionalRayPlan,
  createCutDispatchCommands,
  type CutQueryHit,
} from '../domain/classic-cut-query';
import {
  createClassicCriticalParticleUpdateCommands,
  type ClassicCriticalParticleSpawnCommand,
} from '../domain/classic-critical-particle-plan';
import { createClassicCutHalfMotion } from '../domain/classic-cut-half-motion';
import {
  partitionClassicSpawnCommands,
} from '../domain/classic-spawn-plan-batch';
import {
  ClassicSpawnPlanner,
  type ClassicTossSound,
} from '../domain/classic-spawn-planner';
import type {
  ClassicTossStrategyCommand,
} from '../domain/classic-toss-strategies';
import {
  CLASSIC_SWISH_COOLDOWN_ACTION_SECONDS,
  ClassicSwishAudioGate,
} from '../domain/classic-swish-audio-gate';
import {
  applyComboCommandBatch,
  ComboService,
  type ComboCommand,
} from '../domain/combo-service';
import {
  canonicalResourceToBundlePath,
  createGameRaster,
  type GameAssetTree,
} from '../domain/game-resource-contract';
import type {
  GnStyleInstructionCard,
} from '../domain/gn-style-intro-presentation';
import {
  createGnStyleResultNavigationCommands,
} from '../domain/gn-style-result-navigation';
import {
  GN_STYLE_RESULT_MODE_ID,
  gnStyleLeaderboardPanelValues,
  insertGnStyleResultScore,
} from '../domain/gn-style-result-ranking';
import {
  GN_STYLE_INITIAL_TIME_SECONDS,
  GN_STYLE_OBJECTIVE_EVENT_SELECTOR,
  GN_STYLE_SETTINGS_BEST_SCORE_KEY,
  type GnStyleSessionCommand,
  type GnStyleSessionSnapshot,
} from '../domain/gn-style-session';
import {
  GN_STYLE_TOSS_CREATION_ORDER,
  type GnStyleTossControllerId,
} from '../domain/gn-style-toss-config';
import type {
  GnStyleTossCoordinatorOptions,
  GnStyleTossRuntimeCommand,
} from '../domain/gn-style-toss-coordinator';
import type { GameplayRandom } from '../domain/gameplay-random';
import type {
  ObjectiveAchievementPopupEvent,
  ObjectivesManagerState,
} from '../domain/objectives-manager-state';
import {
  createRecoveredResultObjectiveCommand,
} from '../domain/recovered-result-objective';
import { sampleSpawnKinematics } from '../domain/spawn-kinematics';
import {
  BaseGameplayPausePresenter,
} from './base-gameplay-pause-presenter';
import {
  CLASSIC_BLADE_BEGAN_EVENT,
  CLASSIC_BLADE_ENDED_EVENT,
  CLASSIC_BLADE_MOVED_EVENT,
  BladeInputController,
  type ClassicBladeBeganEvent,
  type ClassicBladeEndedEvent,
} from './blade-input-controller';
import {
  loadBaseGameplayResources,
  type LoadedBaseGameplayResources,
} from './base-gameplay-resource-loader';
import { ClassicBladePresenter } from './classic-blade-presenter';
import {
  ClassicCriticalParticlePresenter,
} from './classic-critical-particle-presenter';
import { ClassicCutHalfPresenter } from './classic-cut-half-presenter';
import { ClassicEntityRegistry } from './classic-entity-registry';
import type {
  ClassicGeneratedFruitCutEvent,
  ClassicGeneratedFruitMissEvent,
} from './classic-generated-fruit';
import {
  ClassicGameplayController,
  type ClassicScreenPlacementPort,
} from './classic-gameplay-controller';
import { ClassicResultPresenter } from './classic-result-presenter';
import {
  type LoadedClassicNormalFruitResources,
} from './classic-resource-loader';
import { ClassicSceneController } from './classic-scene-controller';
import { ClassicScoreHudPresenter } from './classic-score-hud-presenter';
import type {
  ClassicSettingsRuntime,
} from './classic-settings-runtime';
import { ComboItemPresenter } from './combo-item-presenter';
import { createDetachedScreenRoot } from './detached-screen-root';
import {
  loadExactGameRasters,
  loadGameResourceBundle,
  type LoadedGameRasterResource,
} from './game-resource-loader';
import {
  GnStyleBackgroundMusicPresenter,
} from './gn-style-background-music-presenter';
import { GnStyleIntroPresenter } from './gn-style-intro-presenter';
import { GnStyleParticlePresenter } from './gn-style-particle-presenter';
import {
  loadGnStyleResources,
  type LoadedGnStyleResources,
} from './gn-style-resource-loader';
import {
  GN_STYLE_PHYSICS_STEPPED_EVENT,
  GN_STYLE_SESSION_COMMAND_EVENT,
  GnStyleLifecycleRollbackError,
  GnStyleSceneController,
  type GnStylePhysicsSteppedEvent,
  type GnStyleTimeUpFinishParticipant,
} from './gn-style-scene-controller';
import { ObjectiveAchievementPresenter } from './objective-achievement-presenter';
import { TimeManagerAudioPresenter } from './time-manager-audio-presenter';
import {
  TimeManagerPresenter,
  type TimeManagerResourcePort,
} from './time-manager-presenter';

const { ccclass, requireComponent } = _decorator;

export const GN_STYLE_GAMEPLAY_COMMAND_EVENT
  = 'gn-style-gameplay-command';
export const GN_STYLE_GAMEPLAY_SNAPSHOT_EVENT
  = 'gn-style-gameplay-snapshot';
export const GN_STYLE_PAUSE_QUIT_REQUESTED_EVENT
  = 'gn-style-pause-quit-requested';
export const GN_STYLE_PAUSE_REPLAY_FAILED_EVENT
  = 'gn-style-pause-replay-failed';
export const GN_STYLE_RESOURCE_LOAD_FAILED_EVENT
  = 'gn-style-resource-load-failed';
export const GN_STYLE_RESULT_MENU_REQUESTED_EVENT
  = 'gn-style-result-menu-requested';
export const GN_STYLE_RESULT_RETRY_FAILED_EVENT
  = 'gn-style-result-retry-failed';
export const GN_STYLE_RESULT_REWARD_READY_EVENT
  = 'gn-style-result-reward-ready';

export type GnStyleScreenPlacementPort = ClassicScreenPlacementPort;

export type GnStyleGameplayReadinessStatus =
  | 'failed'
  | 'idle'
  | 'pending'
  | 'ready';

export interface GnStyleGameplayReadiness {
  readonly error: Error | null;
  readonly status: GnStyleGameplayReadinessStatus;
}

export interface GnStyleGameplaySnapshot {
  readonly activeEntityCount: number;
  readonly displayedScore: number;
  readonly fatal: boolean;
  readonly lifecycle: GnStyleSessionSnapshot['lifecycle'];
  readonly particleRootCount: number;
  readonly readiness: GnStyleGameplayReadinessStatus;
  readonly resultActive: boolean;
  readonly score: number;
}

export interface GnStylePauseQuitRequestedEvent {
  readonly gnStyleRoot: Node;
  commit(previousRoot: Node): void;
  rollback(): void;
}

export interface GnStylePauseReplayFailedEvent {
  readonly message: string;
  readonly reason: 'restart-error';
}

export interface GnStyleResultMenuRequestedEvent {
  readonly completedRunScore: number;
  readonly resultRoot: Node;
  commit(previousRoot: Node): void;
  rollback(): void;
}

export interface GnStyleResultRetryFailedEvent {
  readonly message: string;
  readonly reason: 'restart-error';
}

export interface GnStyleResultRewardReadyEvent {
  readonly bonusCoins: number;
  readonly completedRunScore: number;
  readonly totalCoins: number;
}

interface GnStyleViewport {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

interface GnStyleResultConfiguration {
  readonly mode: typeof GN_STYLE_RESULT_MODE_ID;
  readonly score: number;
}

interface GnStylePendingResultConfiguration {
  mode?: typeof GN_STYLE_RESULT_MODE_ID;
  score?: number;
}

interface GnStyleResultEntryTransaction {
  configuration: GnStyleResultConfiguration | null;
  readonly gnStyleRoot: Node;
  objectiveTailAttempted: boolean;
  presenter: ClassicResultPresenter | null;
  root: Node | null;
  status: 'committed' | 'pending' | 'prepared' | 'rolled-back';
}

interface GnStyleResultMenuTransaction {
  readonly presenter: ClassicResultPresenter;
  readonly root: Node;
  readonly screenPlacement: GnStyleScreenPlacementPort;
  status: 'committed' | 'pending' | 'rolled-back';
}

interface GnStylePauseAudioLeaseSnapshot {
  readonly effectsPauseLeaseRequired: boolean;
  readonly musicPauseLeaseRequired: boolean;
  readonly particlePauseLeaseRequired: boolean;
}

interface GnStylePauseQuitTransaction extends GnStylePauseAudioLeaseSnapshot {
  audioReleaseAttempted: boolean;
  readonly presenter: BaseGameplayPausePresenter;
  readonly root: Node;
  readonly screenPlacement: GnStyleScreenPlacementPort;
  status: 'committed' | 'pending' | 'rolled-back';
}

interface GnStyleActivationObjectiveRollback {
  readonly objectiveId: 48;
  readonly value: number;
}

interface GnStyleCutPresentationEvent {
  readonly critical: boolean;
  readonly entityOccurrenceId: number;
  readonly fruitId: number;
  readonly segment: Readonly<{
    readonly end: Readonly<{ readonly x: number; readonly y: number }>;
    readonly start: Readonly<{ readonly x: number; readonly y: number }>;
  }>;
  readonly sourceAngleRadians: number;
  readonly sourceAngularVelocityRadiansPerSecond: number;
  readonly sourceBodyMass: number;
  readonly visuals: LoadedClassicNormalFruitResources;
  readonly worldPosition: Readonly<{ readonly x: number; readonly y: number }>;
}

interface LoadedGnStyleTimeManagerResources extends TimeManagerResourcePort {
  readonly rasterCount: 2;
}

interface GnStylePreparationProducts {
  readonly baseGameplayResources: LoadedBaseGameplayResources;
  readonly music: GnStyleBackgroundMusicPresenter;
  readonly resources: LoadedGnStyleResources;
  readonly timeManagerResources: LoadedGnStyleTimeManagerResources;
  readonly timerAudio: TimeManagerAudioPresenter;
}

interface GnStyleRunOwnership {
  readonly bladePresenter: ClassicBladePresenter | null;
  readonly combo: ComboService | null;
  readonly comboItemPresenters: Set<ComboItemPresenter>;
  readonly criticalCutHalfPresenters: Set<ClassicCutHalfPresenter>;
  readonly criticalParticlePresenters: Set<ClassicCriticalParticlePresenter>;
  readonly cutHalfPresenters: Set<ClassicCutHalfPresenter>;
  readonly instructionAttachments: Set<GnStyleInstructionCard>;
  readonly introPresenter: GnStyleIntroPresenter | null;
  readonly modeRoot: Node | null;
  readonly particlePresenter: GnStyleParticlePresenter | null;
  readonly pausePresenter: BaseGameplayPausePresenter | null;
  readonly pendingCapturedRoot: Node | null;
  readonly pendingResultConfiguration: GnStylePendingResultConfiguration | null;
  readonly registry: ClassicEntityRegistry | null;
  readonly scoreHudPresenter: ClassicScoreHudPresenter | null;
  readonly scoreHudRoot: Node | null;
  readonly swishAudio: ClassicSwishAudioGate | null;
  readonly timeManagerPresenter: TimeManagerPresenter | null;
  readonly worldPresentationRoot: Node | null;
}

interface RetiredGnStyleRunOwnership {
  readonly ownership: GnStyleRunOwnership;
  readonly scene: GnStyleSceneController;
}

/**
 * Passive process owner for recovered mode 2.
 *
 * Preparation retains only immutable shared resources and dedicated audio owners. Each run is
 * fully built while detached, becomes current before pause/action activation, and owns only
 * the ordinary Classic fruit/blade/score/combo stack.
 */
@ccclass('GnStyleGameplayController')
@requireComponent(GnStyleSceneController)
@requireComponent(BladeInputController)
@requireComponent(ClassicGameplayController)
@requireComponent(ClassicSceneController)
export class GnStyleGameplayController extends Component {
  private baseGameplayResources: LoadedBaseGameplayResources | null = null;
  private bladePresenter: ClassicBladePresenter | null = null;
  private classicGameplayController: ClassicGameplayController | null = null;
  private classicSceneController: ClassicSceneController | null = null;
  private combo: ComboService | null = null;
  private comboItemPresenters = new Set<ComboItemPresenter>();
  private criticalCutHalfPresenters = new Set<ClassicCutHalfPresenter>();
  private criticalParticlePresenters = new Set<ClassicCriticalParticlePresenter>();
  private cutHalfPresenters = new Set<ClassicCutHalfPresenter>();
  private gnStyleResources: LoadedGnStyleResources | null = null;
  private gnStyleSceneController: GnStyleSceneController | null = null;
  private instructionAttachments = new Set<GnStyleInstructionCard>();
  private introPresenter: GnStyleIntroPresenter | null = null;
  private lifecycleFatalError: GnStyleLifecycleRollbackError | null = null;
  private modeRoot: Node | null = null;
  private music: GnStyleBackgroundMusicPresenter | null = null;
  private readonly objectiveAchievementPresenters =
    new Set<ObjectiveAchievementPresenter>();
  private objectiveAchievementTargetRoot: Node | null = null;
  private objectivesManager: ObjectivesManagerState | null = null;
  private particlePresenter: GnStyleParticlePresenter | null = null;
  private pausePresenter: BaseGameplayPausePresenter | null = null;
  private pendingCapturedRoot: Node | null = null;
  private pendingResultConfiguration: GnStylePendingResultConfiguration | null = null;
  private pendingResultEntryTransaction: GnStyleResultEntryTransaction | null = null;
  private preparation: Promise<void> | null = null;
  private preparationError: Error | null = null;
  private readinessStatus: GnStyleGameplayReadinessStatus = 'idle';
  private registry: ClassicEntityRegistry | null = null;
  private resultPresenter: ClassicResultPresenter | null = null;
  private resultPresentationRoot: Node | null = null;
  private readonly retiredRuns: RetiredGnStyleRunOwnership[] = [];
  private scoreHudPresenter: ClassicScoreHudPresenter | null = null;
  private scoreHudRoot: Node | null = null;
  private screenPlacement: GnStyleScreenPlacementPort | null = null;
  private shuttingDown = false;
  private standbySceneController: GnStyleSceneController | null = null;
  private swishAudio: ClassicSwishAudioGate | null = null;
  private timeManagerPresenter: TimeManagerPresenter | null = null;
  private timeManagerResources: LoadedGnStyleTimeManagerResources | null = null;
  private timerAudio: TimeManagerAudioPresenter | null = null;
  private worldPresentationRoot: Node | null = null;

  onLoad(): void {
    const scene = this.getComponent(GnStyleSceneController);
    const input = this.getComponent(BladeInputController);
    const classic = this.getComponent(ClassicGameplayController);
    const classicScene = this.getComponent(ClassicSceneController);
    if (scene === null) {
      throw new Error(
        'GnStyleGameplayController requires GnStyleSceneController',
      );
    }
    if (input === null) {
      throw new Error(
        'GnStyleGameplayController requires BladeInputController',
      );
    }
    if (classic === null) {
      throw new Error(
        'GnStyleGameplayController requires ClassicGameplayController',
      );
    }
    if (classicScene === null) {
      throw new Error(
        'GnStyleGameplayController requires the shared Classic resolution owner',
      );
    }
    this.gnStyleSceneController = scene;
    this.classicGameplayController = classic;
    this.classicSceneController = classicScene;
  }

  onEnable(): void {
    this.node.on(
      CLASSIC_BLADE_BEGAN_EVENT,
      this.onBladeBegan,
      this,
    );
    this.node.on(
      CLASSIC_BLADE_MOVED_EVENT,
      this.onBladeMoved,
      this,
    );
    this.node.on(
      CLASSIC_BLADE_ENDED_EVENT,
      this.onBladeEnded,
      this,
    );
    this.node.on(
      GN_STYLE_PHYSICS_STEPPED_EVENT,
      this.onPhysicsStepped,
      this,
    );
    this.node.on(
      GN_STYLE_SESSION_COMMAND_EVENT,
      this.onSessionCommand,
      this,
    );
  }

  start(): void {
    // Intentionally passive. The app shell owns preparation and foreground activation.
    this.emitSnapshot();
  }

  update(deltaSeconds: number): void {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (this.lifecycleFatalError !== null) {
      return;
    }
    for (const presenter of this.objectiveAchievementPresenters) {
      presenter.updateAction(deltaSeconds);
    }
    if (this.pendingResultEntryTransaction === null) {
      this.resultPresenter?.updateAction(deltaSeconds);
    }
    if (!this.isGnStyleGameplayAttached()) {
      return;
    }
    if (!this.sharedSettingsRuntime.state.snapshot.musicEnabled) {
      // A disabled setting quiesces the dedicated source immediately. Re-enabling never
      // restarts a stopped or naturally completed non-looping track.
      this.requireMusic().stop();
    }

    this.bladePresenter?.updateFrame();
    for (const presenter of [...this.comboItemPresenters]) {
      presenter.updateAction(deltaSeconds);
    }
    const lifecycleAtFrameStart = this.requireSceneController()
      .sessionSnapshot().lifecycle;
    this.introPresenter?.updateAction(deltaSeconds);
    if (!this.isGnStyleGameplayAttached()) {
      return;
    }

    try {
      this.timeManagerPresenter?.updateAction(deltaSeconds);
      if (
        lifecycleAtFrameStart !== 'intro-instructions'
        && lifecycleAtFrameStart !== 'intro-150'
        && lifecycleAtFrameStart !== 'intro-go'
        && this.particlePresenter?.state.started === true
      ) {
        this.particlePresenter.updateAction(deltaSeconds);
      }
    } catch (error) {
      if (error instanceof GnStyleLifecycleRollbackError) {
        this.retainFatalLifecycleBoundary(error);
      }
      throw error;
    }
    for (const presenter of [...this.cutHalfPresenters]) {
      presenter.updateAction(deltaSeconds);
    }
    for (const presenter of [...this.criticalParticlePresenters]) {
      presenter.updateAction(deltaSeconds);
    }
    this.scoreHudPresenter?.updateAction(deltaSeconds);
    this.pausePresenter?.updateAction(deltaSeconds);
    if (!this.isGnStyleGameplayAttached()) {
      return;
    }

    if (
      lifecycleAtFrameStart === 'intro-instructions'
      || lifecycleAtFrameStart === 'intro-150'
      || lifecycleAtFrameStart === 'intro-go'
    ) {
      this.updateScorePresentation();
      this.emitSnapshot();
      return;
    }

    const lifecycle = this.requireSceneController().sessionSnapshot().lifecycle;
    if (lifecycle === 'running' || lifecycle === 'time-up-presentation') {
      this.requireSceneController().tickCoordinatorBeforeTimeManager(
        deltaSeconds,
        () => this.requireTimeManagerPresenter().updateScheduler(deltaSeconds),
      );
      this.applyComboCommands(
        this.requireCombo().update(deltaSeconds, this.effectsEnabled()),
      );
    }
    this.updateScorePresentation();
    this.emitSnapshot();
  }

  onDisable(): void {
    this.node.off(
      CLASSIC_BLADE_BEGAN_EVENT,
      this.onBladeBegan,
      this,
    );
    this.node.off(
      CLASSIC_BLADE_MOVED_EVENT,
      this.onBladeMoved,
      this,
    );
    this.node.off(
      CLASSIC_BLADE_ENDED_EVENT,
      this.onBladeEnded,
      this,
    );
    this.node.off(
      GN_STYLE_PHYSICS_STEPPED_EVENT,
      this.onPhysicsStepped,
      this,
    );
    this.node.off(
      GN_STYLE_SESSION_COMMAND_EVENT,
      this.onSessionCommand,
      this,
    );
  }

  onDestroy(): void {
    if (this.shuttingDown) {
      return;
    }
    this.shuttingDown = true;
    this.unschedule(this.onSwishCooldownComplete);
    const failures: unknown[] = [];
    collectCleanupFailure(failures, () => this.releaseSceneForTeardown());
    collectCleanupFailure(failures, () => this.stopRunEffectsForTeardown());
    collectCleanupFailure(failures, () => this.disposeModePresentation());
    collectCleanupFailure(failures, () => this.drainRetiredRuns());
    collectCleanupFailure(failures, () => this.disposeResultPresentation());
    collectCleanupFailure(failures, () => this.disposePreparation());
    collectCleanupFailure(failures, () => this.disposeStandbySceneController());
    this.screenPlacement = null;
    this.preparation = null;
    reportCleanupFailures('GN Style gameplay teardown', failures);
  }

  get readiness(): GnStyleGameplayReadiness {
    return Object.freeze({
      error: this.preparationError,
      status: this.readinessStatus,
    });
  }

  get prepared(): boolean {
    return this.readinessStatus === 'ready';
  }

  get sharedGameplayRandom(): GameplayRandom {
    return this.requireClassicGameplayController().sharedGameplayRandom;
  }

  get sharedSettingsRuntime(): ClassicSettingsRuntime {
    return this.requireClassicGameplayController().sharedSettingsRuntime;
  }

  snapshot(): GnStyleGameplaySnapshot {
    const session = this.gnStyleSceneController?.sessionSnapshot()
      ?? Object.freeze({
        lifecycle: 'constructed' as const,
        score: Object.freeze({
          authoritativeScore: 0,
          displayedScore: 0,
        }),
      });
    return Object.freeze({
      activeEntityCount: this.registry?.size ?? 0,
      displayedScore: session.score.displayedScore,
      fatal: this.lifecycleFatalError !== null,
      lifecycle: session.lifecycle,
      particleRootCount: this.particlePresenter?.roots.length ?? 0,
      readiness: this.readinessStatus,
      resultActive: this.resultPresentationRoot !== null,
      score: session.score.authoritativeScore,
    });
  }

  prepareGnStyleRuntime(): Promise<void> {
    if (this.shuttingDown || !isValid(this.node, true)) {
      throw new Error('GN Style runtime cannot be prepared after destruction');
    }
    if (this.readinessStatus === 'ready') {
      return this.preparation ?? Promise.resolve();
    }
    if (this.preparation !== null) {
      return this.preparation;
    }

    this.readinessStatus = 'pending';
    this.preparationError = null;
    const attempt = this.initializePreparation();
    this.preparation = attempt;
    void attempt.catch((error: unknown) => {
      if (this.preparation === attempt) {
        this.preparation = null;
      }
      const failure = normalizeError(
        error,
        'GN Style runtime preparation failed',
      );
      this.preparationError = failure;
      this.readinessStatus = 'failed';
      if (!this.shuttingDown && isValid(this.node, true)) {
        this.node.emit(GN_STYLE_RESOURCE_LOAD_FAILED_EVENT, failure);
        console.error(failure);
      }
    });
    return attempt;
  }

  /** Compatibility name for process preparation owners. */
  prepareRecoveredRuntime(): Promise<void> {
    return this.prepareGnStyleRuntime();
  }

  private async initializePreparation(): Promise<void> {
    const classic = this.requireClassicGameplayController();
    await classic.prepareRecoveredRuntime();
    this.assertPreparationStillUsable();
    const assetTree = classic.sharedResourceCatalog.assetTree;
    const [
      resources,
      baseGameplayResources,
      timeManagerResources,
    ] = await Promise.all([
      loadGnStyleResources(assetTree),
      loadBaseGameplayResources(assetTree),
      loadGnStyleTimeManagerResources(assetTree),
    ]);
    this.assertPreparationStillUsable();

    const timerAudio = await TimeManagerAudioPresenter.load(this.node);
    let music: GnStyleBackgroundMusicPresenter | null = null;
    let committed = false;
    try {
      this.assertPreparationStillUsable();
      music = await GnStyleBackgroundMusicPresenter.load(this.node);
      this.assertPreparationStillUsable();
      this.commitPreparation({
        baseGameplayResources,
        music,
        resources,
        timeManagerResources,
        timerAudio,
      });
      committed = true;
    } finally {
      if (!committed) {
        const failures: unknown[] = [];
        if (music !== null) {
          collectCleanupFailure(failures, () => music?.dispose());
        }
        collectCleanupFailure(failures, () => timerAudio.dispose());
        reportCleanupFailures('GN Style partial preparation', failures);
      }
    }
  }

  private commitPreparation(products: GnStylePreparationProducts): void {
    if (
      this.baseGameplayResources !== null
      || this.gnStyleResources !== null
      || this.timeManagerResources !== null
      || this.timerAudio !== null
      || this.music !== null
      || this.objectivesManager !== null
      || this.objectiveAchievementTargetRoot !== null
    ) {
      throw new Error('GN Style preparation products can commit only once');
    }
    const assetTree = this.requireClassicGameplayController()
      .sharedResourceCatalog.assetTree;
    if (
      products.resources.assetTree !== assetTree
      || products.baseGameplayResources.assetTree !== assetTree
      || products.timeManagerResources.assetTree !== assetTree
      || products.resources.rasterCount !== 11
      || products.timeManagerResources.rasterCount !== 2
    ) {
      throw new Error(
        'GN Style preparation must share one exact resource tree',
      );
    }

    const objectiveTarget = new Node('GnStyleObjectiveAchievementTargetRoot');
    let objectivesManager: ObjectivesManagerState;
    try {
      objectiveTarget.layer = this.node.layer;
      objectiveTarget.setParent(this.node);
      objectivesManager = this.sharedSettingsRuntime.createObjectivesManager(
        this.onObjectiveAchievement,
      );
    } catch (error) {
      if (isValid(objectiveTarget, true)) {
        objectiveTarget.destroy();
      }
      throw error;
    }
    this.baseGameplayResources = products.baseGameplayResources;
    this.gnStyleResources = products.resources;
    this.timeManagerResources = products.timeManagerResources;
    this.timerAudio = products.timerAudio;
    this.music = products.music;
    this.objectiveAchievementTargetRoot = objectiveTarget;
    this.objectivesManager = objectivesManager;
    this.readinessStatus = 'ready';
    this.preparationError = null;
  }

  /** App-shell entry. The current-screen host must already be empty. */
  activateGnStyleFromAppShell(
    screenPlacement: GnStyleScreenPlacementPort,
  ): void {
    assertScreenPlacementPort(screenPlacement);
    if (this.shuttingDown) {
      throw new Error('GN Style runtime cannot activate after destruction');
    }
    if (this.lifecycleFatalError !== null) {
      throw this.lifecycleFatalError;
    }
    if (this.readinessStatus !== 'ready') {
      throw new Error(
        'GN Style runtime must be fully prepared before activation',
      );
    }
    const retainedPlacement = this.screenPlacement;
    if (retainedPlacement !== null && retainedPlacement !== screenPlacement) {
      throw new Error(
        'GN Style runtime must reuse its process screen-placement owner',
      );
    }
    this.drainRetiredRuns();
    if (screenPlacement.currentScreen !== null) {
      throw new Error('GN Style runtime requires an empty current-screen host');
    }
    if (
      this.modeRoot !== null
      || this.resultPresentationRoot !== null
      || this.resultPresenter !== null
    ) {
      throw new Error(
        'GN Style runtime requires fully released run presentation',
      );
    }

    this.screenPlacement = screenPlacement;
    let objectiveRollback: GnStyleActivationObjectiveRollback | null = null;
    try {
      this.constructMode();
      objectiveRollback = this.captureActivationObjectiveRollback();
      this.attachModeAndActivateScene(screenPlacement);
      this.updateScorePresentation();
      this.emitSnapshot();
    } catch (error) {
      const failures: unknown[] = [];
      const scene = this.gnStyleSceneController;
      if (scene?.active) {
        collectCleanupFailure(
          failures,
          () => scene.releaseGnStyleLayerForReplacement(),
        );
      }
      if (scene !== null) {
        this.quiesceSceneAfterFailedRelease(
          scene,
          'GN Style activation rollback',
          failures,
        );
      }
      if (scene?.active !== true) {
        collectCleanupFailure(failures, () => this.disposeModePresentation());
      }
      if (objectiveRollback !== null) {
        const retained = objectiveRollback;
        collectCleanupFailure(
          failures,
          () => this.restoreActivationObjective(retained),
        );
      }
      this.screenPlacement = retainedPlacement;
      if (failures.length > 0) {
        const failure = new GnStyleLifecycleRollbackError(
          'GN Style activation rollback failed',
          error,
          failures,
        );
        this.retainFatalLifecycleBoundary(failure);
        throw failure;
      }
      if (error instanceof GnStyleLifecycleRollbackError) {
        this.retainFatalLifecycleBoundary(error);
      }
      throw error;
    }
  }

  private constructMode(): void {
    if (this.modeRoot !== null) {
      throw new Error(
        'GN Style mode can be constructed only from an empty run owner',
      );
    }
    const classic = this.requireClassicGameplayController();
    const scene = this.requireSceneController();
    const random = classic.sharedGameplayRandom;
    const viewport = this.requireViewport();
    const catalog = classic.sharedResourceCatalog;
    const root = createDetachedScreenRoot('GnStyleModeRoot', this.node);
    this.modeRoot = root;
    this.worldPresentationRoot = createPresenterRoot(
      root,
      'GnStyleWorldPresentationRoot',
    );
    this.scoreHudRoot = createPresenterRoot(
      root,
      'GnStyleScoreHudRoot',
    );
    this.pendingCapturedRoot = null;
    this.pendingResultConfiguration = null;
    this.instructionAttachments = new Set<GnStyleInstructionCard>();
    this.combo = new ComboService(random);
    this.swishAudio = new ClassicSwishAudioGate(random);

    try {
      this.registry = new ClassicEntityRegistry({
        callAfterStep: (mutation) => scene.callAfterPhysicsStep(mutation),
        onDispose: () => this.emitSnapshot(),
        onFruitCut: this.onOrdinaryFruitCut,
        onFruitMiss: this.onOrdinaryFruitMiss,
        onPlayTossSound: this.onPlayTossSound,
        resourceCatalog: catalog,
      });
      this.createCorePresentation(
        root,
        this.requireWorldPresentationRoot(),
        this.requireScoreHudRoot(),
        viewport,
        random,
      );
    } catch (error) {
      const failures: unknown[] = [];
      collectCleanupFailure(failures, () => this.disposeModePresentation());
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'GN Style detached construction cleanup failed',
          error,
          failures,
        );
      }
      throw error;
    }
  }

  private createCorePresentation(
    modeRoot: Node,
    worldRoot: Node,
    scoreRoot: Node,
    viewport: GnStyleViewport,
    random: GameplayRandom,
  ): void {
    const classic = this.requireClassicGameplayController();
    const catalog = classic.sharedResourceCatalog;
    const initialBestScore =
      this.sharedSettingsRuntime.state.gnStyleLeaderboard.first;
    const resolution = this.requireResolution();
    const visibleRect = createVisibleRect(viewport);

    this.scoreHudPresenter = ClassicScoreHudPresenter.create({
      bestScoreCupResource: catalog.presentation.bestScoreCup,
      doubleScorePanelResource: catalog.presentation.doubleScorePanel,
      fontResource: catalog.scoreFont,
      initialBestScore,
      scoreIconResource: catalog.presentation.scoreIcon,
      viewport,
    }, {
      onDoubleScoreActiveDelayComplete: this.onUnexpectedDoubleScoreDelay,
      onScoreIconScaleDownComplete: this.onDisplayedScoreScaleDownComplete,
      onScoreIconScaleUpComplete: this.onDisplayedScoreScaleUpComplete,
    });
    this.scoreHudPresenter.attach(scoreRoot);

    this.timeManagerPresenter = TimeManagerPresenter.create({
      effectsEnabled: this.effectsEnabled,
      logicalHeight: resolution.profile.designHeight,
      logicalWidth: resolution.profile.designWidth,
      resources: this.requireTimeManagerResources(),
      totalSeconds: GN_STYLE_INITIAL_TIME_SECONDS,
      visibleRect,
    }, {
      audio: this.requireTimerAudio(),
      disableBonusType: () => {
        throw new Error('GN Style TimeManager cannot disable a bonus type');
      },
      onFreezeFinish: () => {
        throw new Error('GN Style TimeManager cannot finish freeze');
      },
      onFreezeStart: () => {
        throw new Error('GN Style TimeManager cannot start freeze');
      },
      onTimeUp: () => this.requireSceneController().timeUp(),
      onTimeUpFinish: () => this.requireSceneController().timeUpFinish(),
    });
    this.timeManagerPresenter.attach(modeRoot, 1);

    this.introPresenter = GnStyleIntroPresenter.create({
      logicalHeight: resolution.profile.designHeight,
      resources: this.requireGnStyleResources(),
      visibleRect,
    }, {
      onShowGo: () => this.requireSceneController().goCallback(),
      onShowOneHundredFifty: () => (
        this.requireSceneController().totalTimeCallback()
      ),
      onStartGame: this.startGnStyleGame,
    });
    this.introPresenter.attach(modeRoot);

    // The landed Classic catalog currently exposes the bounded selected/default BasicBlade.
    this.bladePresenter = ClassicBladePresenter.create({
      assetTree: catalog.assetTree,
      resource: catalog.defaultBlade,
      selectedBladeId: 0,
      viewportWidth: viewport.width,
    });
    this.bladePresenter.attach(worldRoot);

    this.particlePresenter = GnStyleParticlePresenter.create({
      random,
      resources: this.requireGnStyleResources(),
      viewport,
    });
    if (this.particlePresenter.roots.length !== 439) {
      throw new Error(
        'GN Style particle presenter must prepare all 439 recovered roots',
      );
    }
    if (random !== classic.sharedGameplayRandom) {
      throw new Error(
        'GN Style presentation lost the process-owned GameplayRandom',
      );
    }
  }

  private initializePausePresentation(): void {
    if (this.pausePresenter !== null) {
      throw new Error(
        'GN Style pause presentation can initialize only once per run',
      );
    }
    const resolution = this.requireResolution();
    const presenter = BaseGameplayPausePresenter.create({
      contentScaleFactor: resolution.profile.contentScaleFactor,
      initialCard: this.currentPauseCard(),
      resources: this.requireBaseGameplayResources(),
      viewport: {
        height: resolution.visibleRect.height,
        width: resolution.visibleRect.width,
      },
    }, {
      onPauseRequested: this.onPauseRequested,
      onQuitRequested: this.onPauseQuitRequested,
      onReplayRequested: this.onPauseReplayRequested,
      onResumeRequested: this.onResumeRequested,
    });
    try {
      presenter.attach(this.requireModeRoot());
      this.pausePresenter = presenter;
    } catch (error) {
      const failures: unknown[] = [];
      collectCleanupFailure(failures, () => presenter.dispose());
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'GN Style pause initialization rollback failed',
          error,
          failures,
        );
      }
      throw error;
    }
  }

  private attachModeAndActivateScene(
    screenPlacement: GnStyleScreenPlacementPort,
  ): void {
    const root = this.requireDetachedModeRoot();
    screenPlacement.attachCurrentScreen(root);
    if (screenPlacement.currentScreen !== root) {
      throw new Error(
        'GN Style current-screen placement lost the attached mode root',
      );
    }
    this.initializePausePresentation();
    this.activateCurrentSceneWithFreshCoordinator(
      this.requireSceneController(),
    );
    const snapshot = this.requireSceneController().sessionSnapshot();
    if (
      snapshot.mode !== GN_STYLE_RESULT_MODE_ID
      || snapshot.lifecycle !== 'intro-instructions'
    ) {
      throw new Error(
        'GN Style scene activation committed a different mode or lifecycle',
      );
    }
  }

  private activateCurrentSceneWithFreshCoordinator(
    scene: GnStyleSceneController,
  ): void {
    const random = this.sharedGameplayRandom;
    const planner = new ClassicSpawnPlanner({
      random,
      sampleKinematics: sampleSpawnKinematics,
    });
    const coordinatorOptions: GnStyleTossCoordinatorOptions = {
      commandSink: this.onCoordinatorCommands,
      effectsEnabled: this.effectsEnabled,
      planner,
      random,
      viewport: () => this.requireViewport(),
    };
    scene.activateGnStyleLayer(
      this.sharedSettingsRuntime.state.gnStyleLeaderboard.first,
      coordinatorOptions,
    );
  }

  private readonly startGnStyleGame = (): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    const failures: unknown[] = [];
    try {
      // Native StartGame order: shared background -> dedicated track -> controllers -> timer
      // -> the exact 439-parent InitParticlesExplosion boundary.
      this.requireClassicGameplayController()
        .sharedAudioPresenter.stopBackgroundMusic();
      this.requireMusic().play(
        this.sharedSettingsRuntime.state.snapshot.musicEnabled,
      );
      this.requireSceneController().startGameCallback();
      return;
    } catch (error) {
      collectCleanupFailure(failures, () => this.requireParticlePresenter().dispose());
      collectCleanupFailure(failures, () => this.requireTimeManagerPresenter().stop());
      const scene = this.gnStyleSceneController;
      if (scene?.active) {
        collectCleanupFailure(
          failures,
          () => scene.releaseGnStyleLayerForReplacement(),
        );
      }
      collectCleanupFailure(failures, () => this.requireMusic().stop());
      const failure = new GnStyleLifecycleRollbackError(
        'GN Style StartGame rollback failed',
        error,
        failures,
      );
      this.retainFatalLifecycleBoundary(failure);
      throw failure;
    }
  };

  private readonly onCoordinatorCommands = (
    commands: readonly GnStyleTossRuntimeCommand[],
  ): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    this.emitCommands(commands);
    const spawnCommands = commands.filter(isClassicSpawnCommand);
    for (const plan of partitionClassicSpawnCommands(spawnCommands)) {
      this.requireRegistry().applySpawnPlan(
        plan.commands,
        this.requireWorldPresentationRoot(),
        this.requireViewport(),
      );
    }
  };

  private readonly onSessionCommand = (
    command: GnStyleSessionCommand,
  ): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    this.emitCommand(command);
    switch (command.type) {
      case 'enter-base-gameplay-layer':
        if (
          this.bladePresenter === null
          || this.registry === null
          || this.combo === null
        ) {
          throw new Error(
            'GN Style base entry requires the ordinary Classic stack',
          );
        }
        break;
      case 'process-objective':
        if (command.selector !== GN_STYLE_OBJECTIVE_EVENT_SELECTOR) {
          throw new Error('GN Style run objective selector must remain 6');
        }
        this.requireObjectivesManager().processGameEvent(
          command.selector,
          command.payload,
        );
        break;
      case 'construct-controller':
      case 'attach-controller':
        assertGnStyleController(command.controller);
        break;
      case 'construct-time-manager':
        if (
          command.durationSeconds !== GN_STYLE_INITIAL_TIME_SECONDS
          || command.callbackOrder[0] !== 'time-up'
          || command.callbackOrder[1] !== 'time-up-finish'
        ) {
          throw new Error(
            'GN Style TimeManager construction lost its recovered contract',
          );
        }
        break;
      case 'attach-time-manager':
        this.requireTimeManagerPresenter().activate();
        break;
      case 'create-instruction-card':
      case 'start-instruction-action':
        break;
      case 'attach-instruction-card':
        if (this.instructionAttachments.has(command.card)) {
          throw new Error(
            `GN Style instruction ${command.card} attached more than once`,
          );
        }
        this.instructionAttachments.add(command.card);
        if (this.instructionAttachments.size === 3) {
          this.requireIntroPresenter().activate();
        }
        break;
      case 'initialize-best-score':
        if (
          command.key !== GN_STYLE_SETTINGS_BEST_SCORE_KEY
          || command.score
            !== this.sharedSettingsRuntime.state.gnStyleLeaderboard.first
        ) {
          throw new Error(
            'GN Style best-score initialization lost shared settings',
          );
        }
        break;
      case 'create-one-hundred-fifty-intro':
        if (
          this.requireIntroPresenter().state.phase
            !== 'one-hundred-fifty'
        ) {
          throw new Error(
            'GN Style 150s command requires the 150s intro phase',
          );
        }
        break;
      case 'create-go-intro':
        if (this.requireIntroPresenter().state.phase !== 'go') {
          throw new Error(
            'GN Style GO command requires the GO intro phase',
          );
        }
        break;
      case 'start-controller':
      case 'stop-controller':
        assertGnStyleController(command.controller);
        break;
      case 'start-time-manager':
        this.requireTimeManagerPresenter().start();
        this.requireParticlePresenter().start(
          this.requireWorldPresentationRoot(),
        );
        break;
      case 'check-combo':
        this.requireCombo().checkCombo(command.position);
        break;
      case 'add-score':
        if (command.application !== 'already-applied') {
          throw new Error(
            'GN Style ordinary score must already be applied by the session',
          );
        }
        break;
      case 'start-displayed-score-scale-up':
      case 'start-displayed-score-scale-down':
        this.applyScorePresentationCommand(command);
        break;
      case 'stop-effects':
        this.stopAllRunEffects();
        break;
      case 'capture-gn-style-parent':
        this.captureModeForResult();
        break;
      case 'construct-result':
        this.beginResultConstruction();
        break;
      case 'set-result-mode':
        this.setPendingResultMode(command.mode);
        break;
      case 'set-result-score':
        this.setPendingResultScore(command.score);
        break;
      case 'remove-gn-style':
        this.detachModeForResult(command.cleanup);
        break;
      case 'attach-result':
        this.attachResult(command.zOrder);
        break;
      default:
        assertNever(command);
    }
    this.updateScorePresentation();
    this.emitSnapshot();
  };

  private readonly onBladeBegan = (
    event: ClassicBladeBeganEvent,
  ): void => {
    if (
      this.lifecycleFatalError !== null
      || !this.isGnStyleGameplayAttached()
    ) {
      return;
    }
    const presenter = this.bladePresenter;
    if (presenter !== null && !presenter.isClaimed(event.slot)) {
      presenter.begin(event.slot);
    }
  };

  private readonly onBladeMoved = (event: BladeMoveResult): void => {
    if (
      this.lifecycleFatalError !== null
      || !this.isGnStyleGameplayAttached()
    ) {
      return;
    }
    const presenter = this.bladePresenter;
    if (presenter !== null) {
      if (!presenter.isClaimed(event.segment.slot)) {
        presenter.begin(event.segment.slot);
      }
      presenter.move(event.segment.slot, event.segment.current);
    }
    for (const instruction of this.requireSwishAudio().request(
      event.shouldPlaySwish,
      this.effectsEnabled(),
    )) {
      if (instruction.type === 'play-swish-audio') {
        this.requireClassicGameplayController()
          .sharedAudioPresenter.playOneShot(instruction.canonicalPath);
      } else {
        this.scheduleOnce(
          this.onSwishCooldownComplete,
          instruction.delaySeconds,
        );
      }
    }
  };

  private readonly onBladeEnded = (
    event: ClassicBladeEndedEvent,
  ): void => {
    if (
      this.lifecycleFatalError !== null
      || !this.isGnStyleGameplayAttached()
    ) {
      return;
    }
    const presenter = this.bladePresenter;
    if (presenter !== null && presenter.isClaimed(event.slot)) {
      presenter.end(event.slot);
    }
  };

  private readonly onSwishCooldownComplete = (): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    this.swishAudio?.unlock();
  };

  private readonly onPhysicsStepped = (
    event: GnStylePhysicsSteppedEvent,
  ): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    const registry = this.registry;
    const scene = this.gnStyleSceneController;
    if (
      registry === null
      || scene === null
      || !this.isGnStyleGameplayAttached()
    ) {
      return;
    }

    const viewport = this.requireViewport();
    const existingCutHalves = [...this.cutHalfPresenters];
    if (registry.size > 0) {
      registry.runRayQueryCutBatch(() => {
        for (const segment of event.bladeSegments) {
          const plan = buildBidirectionalRayPlan(
            { end: segment.current, start: segment.previous },
            viewport.width,
          );
          if (plan === null) {
            continue;
          }
          const forwardHits: CutQueryHit[] = scene
            .raycastAll(plan.forward.start, plan.forward.end)
            .map(({ collider }) => ({
              target: registry.cuttableSnapshotForCollider(collider),
            }));
          const reverseHits: CutQueryHit[] = scene
            .raycastAll(plan.reverse.start, plan.reverse.end)
            .map(({ collider }) => ({
              target: registry.cuttableSnapshotForCollider(collider),
            }));
          for (const command of createCutDispatchCommands(
            plan,
            forwardHits,
            reverseHits,
          )) {
            this.emitCommand(command);
            if (command.type === 'combo-check') {
              scene.checkCombo(command.position);
            } else {
              registry.cut(command.targetId, command.segment);
            }
          }
        }
      });
      registry.evaluateBounds(viewport);
    }
    for (const presenter of existingCutHalves) {
      presenter.evaluateBounds(viewport);
      this.emitCriticalParticlesForCutHalves(presenter);
    }
    this.updateScorePresentation();
    this.emitSnapshot();
  };

  private readonly onOrdinaryFruitCut = (
    event: ClassicGeneratedFruitCutEvent,
  ): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    this.presentCutHalves({
      ...event,
      visuals: this.requireClassicGameplayController()
        .sharedResourceCatalog.normalFruit(event.fruitId),
    });
    if (this.effectsEnabled()) {
      for (const path of getClassicFruitCutAudioSequence(
        event.fruitId,
        event.critical,
      )) {
        this.requireClassicGameplayController()
          .sharedAudioPresenter.playOneShot(path);
      }
    }
    this.requireSceneController().fruitCut(
      event.worldPosition,
      event.fruitId,
      event.score,
    );
  };

  private readonly onOrdinaryFruitMiss = (
    event: ClassicGeneratedFruitMissEvent,
  ): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    this.requireSceneController().fruitFail(event.worldPosition);
  };

  private readonly onPlayTossSound = (sound: ClassicTossSound): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    this.requireClassicGameplayController().sharedAudioPresenter.playOneShot(sound);
  };

  private presentCutHalves(event: GnStyleCutPresentationEvent): void {
    const viewport = this.requireViewport();
    const motion = createClassicCutHalfMotion({
      bottomHeightWorldUnits: event.visuals.cutBottom.dimensions.height,
      critical: event.critical,
      segment: event.segment,
      sourceAngleRadians: event.sourceAngleRadians,
      sourceAngularVelocityRadiansPerSecond:
        event.sourceAngularVelocityRadiansPerSecond,
      sourceBodyMass: event.sourceBodyMass,
      sourcePositionWorldUnits: event.worldPosition,
      topHeightWorldUnits: event.visuals.cutTop.dimensions.height,
      viewportWidthWorldUnits: viewport.width,
    });
    let presenter: ClassicCutHalfPresenter;
    presenter = ClassicCutHalfPresenter.create({
      fruitId: event.fruitId as Parameters<
        typeof ClassicCutHalfPresenter.create
      >[0]['fruitId'],
      motion,
      sourceEntityOccurrenceId: event.entityOccurrenceId,
      visuals: event.visuals,
    }, {
      callAfterStep: (mutation) => this.requireSceneController()
        .callAfterPhysicsStep(mutation),
      onDisposed: () => {
        if (presenter.activeHalfCount === 0) {
          this.cutHalfPresenters.delete(presenter);
          this.criticalCutHalfPresenters.delete(presenter);
        }
      },
    });
    presenter.attach(this.requireWorldPresentationRoot(), 1);
    this.cutHalfPresenters.add(presenter);
    if (event.critical) {
      this.criticalCutHalfPresenters.add(presenter);
    }
  }

  private emitCriticalParticlesForCutHalves(
    cutHalves: ClassicCutHalfPresenter,
  ): void {
    const critical = this.criticalCutHalfPresenters.has(cutHalves);
    for (const half of cutHalves.halves) {
      if (half.disposalQueued) {
        continue;
      }
      for (const command of createClassicCriticalParticleUpdateCommands(
        critical,
        this.sharedGameplayRandom,
      )) {
        const position = half.node.worldPosition;
        this.createCriticalParticle(command, {
          x: position.x,
          y: position.y,
        });
      }
    }
  }

  private createCriticalParticle(
    command: ClassicCriticalParticleSpawnCommand,
    positionWorldUnits: Readonly<{ readonly x: number; readonly y: number }>,
  ): void {
    const resource = this.requireClassicGameplayController()
      .sharedResourceCatalog.criticalParticles[command.resourceIndex - 1];
    if (resource === undefined) {
      throw new Error(
        `GN Style critical particle ${command.resourceIndex} is not loaded`,
      );
    }
    let presenter: ClassicCriticalParticlePresenter;
    presenter = ClassicCriticalParticlePresenter.create({
      command,
      positionWorldUnits,
      resource,
    }, {
      onDisposed: () => this.criticalParticlePresenters.delete(presenter),
    });
    presenter.attach(this.requireWorldPresentationRoot());
    this.criticalParticlePresenters.add(presenter);
  }

  private applyComboCommands(commands: readonly ComboCommand[]): void {
    if (commands.length === 0) {
      return;
    }
    const combo = this.requireCombo();
    combo.assertPendingUpdate(commands);
    let pendingPresenter: ComboItemPresenter | null = null;
    applyComboCommandBatch(commands, {
      apply: (command) => {
        switch (command.type) {
          case 'process-objective':
            this.requireObjectivesManager().processGameEvent(
              command.eventId,
              command.count,
            );
            return;
          case 'create-combo-item': {
            if (pendingPresenter !== null) {
              throw new Error(
                'GN Style combo created more than one pending item',
              );
            }
            let presenter: ComboItemPresenter;
            presenter = ComboItemPresenter.create({
              count: command.count,
              fontResource: this.requireClassicGameplayController()
                .sharedResourceCatalog.comboFont,
              position: command.position,
              viewportWidth: this.requireViewport().width,
            }, {
              onDisposed: () => this.comboItemPresenters.delete(presenter),
            });
            pendingPresenter = presenter;
            return;
          }
          case 'add-score':
            this.requireSceneController().addScore(command.value);
            return;
          case 'attach-combo-item': {
            if (command.zOrder !== 1 || pendingPresenter === null) {
              throw new Error(
                'GN Style combo requires one pending z-order-1 item',
              );
            }
            const presenter = pendingPresenter;
            presenter.attach(this.requireWorldPresentationRoot());
            this.comboItemPresenters.add(presenter);
            pendingPresenter = null;
            return;
          }
          case 'play-combo-sound':
            this.requireClassicGameplayController()
              .sharedAudioPresenter.playOneShot(
                getClassicComboAudioPath(command.soundIndex),
              );
            return;
          case 'reset-combo':
            combo.commitPendingUpdate(commands);
            return;
          default:
            assertNever(command);
        }
      },
      finalize: () => {
        const presenter = pendingPresenter;
        pendingPresenter = null;
        presenter?.dispose();
      },
      publish: (command) => this.emitCommand(command),
    });
  }

  private applyScorePresentationCommand(
    command: Extract<
      GnStyleSessionCommand,
      Readonly<{
        type:
          | 'start-displayed-score-scale-down'
          | 'start-displayed-score-scale-up';
      }>
    >,
  ): void {
    if (command.type === 'start-displayed-score-scale-up') {
      this.requireScoreHudPresenter().startScoreIconScaleUp(
        command.durationSeconds,
        command.targetScale,
      );
    } else {
      this.requireScoreHudPresenter().startScoreIconScaleDown(
        command.durationSeconds,
        command.targetScale,
      );
    }
  }

  private readonly onDisplayedScoreScaleUpComplete = (): void => {
    this.requireSceneController().completeDisplayedScoreScaleUp();
    this.updateScorePresentation();
  };

  private readonly onDisplayedScoreScaleDownComplete = (): void => {
    this.requireSceneController().completeDisplayedScoreScaleDown();
  };

  private readonly onUnexpectedDoubleScoreDelay = (): void => {
    throw new Error('GN Style has no double-score presentation');
  };

  private updateScorePresentation(): void {
    const score = this.gnStyleSceneController?.sessionSnapshot().score;
    if (score === undefined) {
      return;
    }
    const bestScore =
      this.sharedSettingsRuntime.state.gnStyleLeaderboard.first;
    this.scoreHudPresenter?.setDisplayedScore(score.displayedScore);
    this.scoreHudPresenter?.setBestScore(
      Math.max(bestScore, score.authoritativeScore),
      score.authoritativeScore > bestScore,
    );
    this.scoreHudPresenter?.setPendingDoubleScore(score.pendingDoubleScore);
  }

  private currentPauseCard(): BaseGameplayPauseObjectiveCard {
    const card = this.requireObjectivesManager().pauseCard();
    if (card === null) {
      throw new Error('GN Style pause UI requires one active objective');
    }
    return Object.freeze({
      description: card.objective.description,
      progress: card.progressText,
      reward: card.rewardText,
    });
  }

  private readonly onPauseRequested = (): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    this.requirePausePresenter().pauseIngress(this.currentPauseCard());
    const settings = this.sharedSettingsRuntime.state.snapshot;
    const failures: unknown[] = [];
    if (settings.effectsEnabled) {
      collectCleanupFailure(
        failures,
        () => this.requireClassicGameplayController()
          .sharedAudioPresenter.playOneShot(CLASSIC_MENU_BUTTON_AUDIO_PATH),
      );
      collectCleanupFailure(
        failures,
        () => this.requireClassicGameplayController()
          .sharedAudioPresenter.pauseAllEffects(),
      );
      collectCleanupFailure(
        failures,
        () => this.requireTimerAudio().pauseAllEffects(),
      );
    }
    collectCleanupFailure(
      failures,
      () => this.requireMusic().pause(settings.musicEnabled),
    );
    if (this.particlePresenter?.state.started === true) {
      collectCleanupFailure(
        failures,
        () => this.requireParticlePresenter().pause(),
      );
    }
    if (failures.length > 0) {
      throw cleanupError('GN Style Pause ownership', failures);
    }
  };

  private readonly onResumeRequested = (): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    this.requirePausePresenter().resumeEgress();
    const settings = this.sharedSettingsRuntime.state.snapshot;
    const failures: unknown[] = [];
    if (settings.effectsEnabled) {
      collectCleanupFailure(
        failures,
        () => this.requireClassicGameplayController()
          .sharedAudioPresenter.playOneShot(CLASSIC_MENU_BUTTON_AUDIO_PATH),
      );
      collectCleanupFailure(
        failures,
        () => this.requireClassicGameplayController()
          .sharedAudioPresenter.resumeAllEffects(),
      );
      collectCleanupFailure(
        failures,
        () => this.requireTimerAudio().resumeAllEffects(),
      );
    }
    collectCleanupFailure(
      failures,
      () => this.requireClassicGameplayController()
        .sharedAudioPresenter.stopBackgroundMusic(),
    );
    collectCleanupFailure(
      failures,
      () => this.requireMusic().resume(settings.musicEnabled),
    );
    if (this.particlePresenter?.state.paused === true) {
      collectCleanupFailure(
        failures,
        () => this.requireParticlePresenter().resume(),
      );
    }
    if (failures.length > 0) {
      throw cleanupError('GN Style Resume ownership', failures);
    }
  };

  private readonly onPauseReplayRequested = (): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    try {
      this.restartFromPause();
    } catch (error) {
      const failure = normalizeError(error, 'GN Style Pause Replay failed');
      if (error instanceof GnStyleLifecycleRollbackError) {
        this.retainFatalLifecycleBoundary(error);
      }
      const payload: GnStylePauseReplayFailedEvent = Object.freeze({
        message: failure.message,
        reason: 'restart-error',
      });
      this.node.emit(GN_STYLE_PAUSE_REPLAY_FAILED_EVENT, payload);
      console.error(failure);
    }
  };

  private restartFromPause(): void {
    this.drainRetiredRuns();
    const settings = this.sharedSettingsRuntime.state.snapshot;
    const pauseAudioLeaseSnapshot: GnStylePauseAudioLeaseSnapshot = {
      effectsPauseLeaseRequired: settings.effectsEnabled,
      musicPauseLeaseRequired: settings.musicEnabled,
      particlePauseLeaseRequired:
        this.particlePresenter?.state.paused === true,
    };
    const placement = this.requireScreenPlacement();
    const oldRoot = this.requireModeRoot();
    const pause = this.requirePausePresenter();
    const oldScene = this.requireSceneController();
    if (placement.currentScreen !== oldRoot || !oldScene.active) {
      throw new Error(
        'GN Style Pause Replay requires the attached active run',
      );
    }

    const oldOwnership = this.captureRunOwnership();
    let freshInstalled = false;
    let freshRoot: Node | null = null;
    let freshScene: GnStyleSceneController | null = null;
    let objectiveRollback: GnStyleActivationObjectiveRollback | null = null;
    let pauseEgressAttempted = false;
    this.unschedule(this.onSwishCooldownComplete);

    try {
      oldScene.suspendGnStyleLayerForNavigation();
      freshScene = this.acquireStandbySceneController(oldScene);
      this.installRunOwnership(this.createEmptyRunOwnership());
      this.gnStyleSceneController = freshScene;
      freshInstalled = true;
      this.constructMode();
      freshRoot = this.requireDetachedModeRoot();

      this.stopAllRunEffects();
      this.requireMusic().stop();
      pauseEgressAttempted = true;
      pause.resumeEgress();
      pause.stopAllActions();
      const previous = placement.replaceCurrentScreen(freshRoot);
      if (
        previous !== oldRoot
        || oldRoot.parent !== null
        || placement.currentScreen !== freshRoot
      ) {
        throw new Error(
          'GN Style Pause Replay replaced an unexpected gameplay screen',
        );
      }
      this.initializePausePresentation();
      objectiveRollback = this.captureActivationObjectiveRollback();
      this.activateCurrentSceneWithFreshCoordinator(freshScene);
      this.updateScorePresentation();
      oldScene.finalizeSuspendedGnStyleLayerRelease();
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      const primaryFatal = error instanceof GnStyleLifecycleRollbackError;
      if (freshInstalled && freshScene !== null) {
        collectCleanupFailure(rollbackFailures, () => {
          if (freshScene?.active) {
            freshScene.releaseGnStyleLayerForReplacement();
          }
        });
        this.quiesceSceneAfterFailedRelease(
          freshScene,
          'GN Style Pause Replay fresh-scene rollback',
          rollbackFailures,
        );
        collectCleanupFailure(rollbackFailures, () => {
          const current = placement.currentScreen;
          if (current === oldRoot) {
            return;
          }
          if (!isValid(oldRoot, true) || oldRoot.parent !== null) {
            throw new Error(
              'GN Style Pause Replay rollback lost the old root',
            );
          }
          if (current === null) {
            placement.attachCurrentScreen(oldRoot);
          } else {
            const displaced = placement.replaceCurrentScreen(oldRoot);
            if (freshRoot !== null && displaced !== freshRoot) {
              throw new Error(
                'GN Style Pause Replay rollback displaced an unexpected screen',
              );
            }
          }
        });
        if (freshScene.active) {
          this.retiredRuns.push(Object.freeze({
            ownership: this.captureRunOwnership(),
            scene: freshScene,
          }));
        } else {
          try {
            this.disposeModePresentation();
          } catch (cleanupFailure) {
            rollbackFailures.push(cleanupFailure);
            this.retiredRuns.push(Object.freeze({
              ownership: this.captureRunOwnership(),
              scene: freshScene,
            }));
          }
        }
      }
      if (objectiveRollback !== null) {
        const retained = objectiveRollback;
        collectCleanupFailure(
          rollbackFailures,
          () => this.restoreActivationObjective(retained),
        );
      }
      this.installRunOwnership(oldOwnership);
      this.gnStyleSceneController = oldScene;
      if (freshScene !== null && freshScene !== oldScene) {
        this.standbySceneController = freshScene;
      }
      collectCleanupFailure(rollbackFailures, () => {
        if (placement.currentScreen === null) {
          placement.attachCurrentScreen(oldRoot);
        }
        if (placement.currentScreen !== oldRoot) {
          throw new Error(
            'GN Style Pause Replay rollback could not restore gameplay',
          );
        }
      });
      let oldSceneResumed = false;
      if (!primaryFatal && rollbackFailures.length === 0) {
        collectCleanupFailure(rollbackFailures, () => {
          if (oldScene.suspended) {
            oldScene.resumeSuspendedGnStyleLayer();
            oldSceneResumed = true;
          }
        });
        if (rollbackFailures.length === 0) {
          collectCleanupFailure(
            rollbackFailures,
            () => this.restorePauseOwnershipAfterNavigationRollback(
              pauseAudioLeaseSnapshot,
            ),
          );
          collectCleanupFailure(
            rollbackFailures,
            () => this.restoreRetainedSwishCooldown(oldOwnership),
          );
          if (pauseEgressAttempted) {
            collectCleanupFailure(
              rollbackFailures,
              () => pause.pauseIngress(this.currentPauseCard()),
            );
          }
        }
      }
      if (rollbackFailures.length > 0 && oldSceneResumed && oldScene.active) {
        collectCleanupFailure(
          rollbackFailures,
          () => oldScene.suspendGnStyleLayerForNavigation(),
        );
      }
      if (rollbackFailures.length > 0) {
        const failure = new GnStyleLifecycleRollbackError(
          'GN Style Pause Replay rollback failed',
          error,
          rollbackFailures,
        );
        this.retainFatalLifecycleBoundary(failure);
        throw failure;
      }
      if (primaryFatal) {
        this.retainFatalLifecycleBoundary(error);
      }
      throw error;
    }

    if (freshScene === null) {
      throw new Error(
        'Committed GN Style Pause Replay lost its fresh scene lease',
      );
    }
    const freshOwnership = this.captureRunOwnership();
    const cleanupFailures: unknown[] = [];
    try {
      this.installRunOwnership(oldOwnership);
      this.gnStyleSceneController = oldScene;
      try {
        this.disposeModePresentation();
      } catch (error) {
        cleanupFailures.push(error);
        this.retiredRuns.push(Object.freeze({
          ownership: this.captureRunOwnership(),
          scene: oldScene,
        }));
      }
    } finally {
      this.installRunOwnership(freshOwnership);
      this.gnStyleSceneController = freshScene;
      this.standbySceneController = oldScene;
    }
    if (settings.effectsEnabled) {
      collectCleanupFailure(
        cleanupFailures,
        () => this.requireClassicGameplayController()
          .sharedAudioPresenter.playOneShot(CLASSIC_MENU_BUTTON_AUDIO_PATH),
      );
    }
    collectCleanupFailure(cleanupFailures, () => this.emitSnapshot());
    reportCleanupFailures(
      'Committed GN Style Pause Replay cleanup',
      cleanupFailures,
    );
  }

  private readonly onPauseQuitRequested = (): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    const pause = this.requirePausePresenter();
    pause.resumeEgress();
    pause.stopAllActions();
    let root: Node;
    try {
      root = this.requireModeRoot();
      this.requireSceneController().suspendGnStyleLayerForNavigation();
    } catch (error) {
      if (error instanceof GnStyleLifecycleRollbackError) {
        this.retainFatalLifecycleBoundary(error);
        throw error;
      }
      const failures: unknown[] = [];
      collectCleanupFailure(
        failures,
        () => pause.pauseIngress(this.currentPauseCard()),
      );
      if (failures.length > 0) {
        const failure = new GnStyleLifecycleRollbackError(
          'GN Style Pause Quit suspension rollback failed',
          error,
          failures,
        );
        this.retainFatalLifecycleBoundary(failure);
        throw failure;
      }
      throw error;
    }

    const settings = this.sharedSettingsRuntime.state.snapshot;
    const transaction: GnStylePauseQuitTransaction = {
      audioReleaseAttempted: false,
      effectsPauseLeaseRequired: settings.effectsEnabled,
      musicPauseLeaseRequired:
        settings.musicEnabled && this.requireMusic().paused,
      particlePauseLeaseRequired:
        this.particlePresenter?.state.paused === true,
      presenter: pause,
      root,
      screenPlacement: this.requireScreenPlacement(),
      status: 'pending',
    };
    const payload: GnStylePauseQuitRequestedEvent = Object.freeze({
      commit: (previousRoot: Node) => (
        this.commitPauseQuit(transaction, previousRoot)
      ),
      gnStyleRoot: root,
      rollback: () => this.rollbackPauseQuit(transaction),
    });

    try {
      transaction.audioReleaseAttempted = true;
      this.releasePauseEffectsForNavigation();
      this.node.emit(GN_STYLE_PAUSE_QUIT_REQUESTED_EVENT, payload);
    } catch (error) {
      if (transaction.status === 'pending') {
        try {
          this.rollbackPauseQuit(transaction);
        } catch (rollbackError) {
          const failure = new GnStyleLifecycleRollbackError(
            'GN Style Pause Quit request rollback failed',
            error,
            [rollbackError],
          );
          this.retainFatalLifecycleBoundary(failure);
          throw failure;
        }
      }
      throw error;
    }
    if (transaction.status === 'pending') {
      try {
        this.rollbackPauseQuit(transaction);
      } catch (error) {
        const failure = new GnStyleLifecycleRollbackError(
          'GN Style Pause Quit request settlement failed',
          new Error(
            'GN Style Pause Quit request returned without settlement',
          ),
          [error],
        );
        this.retainFatalLifecycleBoundary(failure);
        throw failure;
      }
    }
  };

  private commitPauseQuit(
    transaction: GnStylePauseQuitTransaction,
    previousRoot: Node,
  ): void {
    if (transaction.status === 'committed') {
      return;
    }
    if (previousRoot !== transaction.root) {
      throw new Error(
        'GN Style Pause Quit commit received an unexpected previous screen',
      );
    }
    if (transaction.status === 'rolled-back') {
      throw new Error(
        'Rolled-back GN Style Pause Quit transaction cannot commit',
      );
    }
    if (
      !transaction.audioReleaseAttempted
      || this.modeRoot !== transaction.root
      || this.pausePresenter !== transaction.presenter
      || transaction.root.parent !== null
      || transaction.screenPlacement.currentScreen === null
      || transaction.screenPlacement.currentScreen === transaction.root
    ) {
      throw new Error(
        'GN Style Pause Quit commit requires a successful screen replacement',
      );
    }

    const releasedScene = this.requireSceneController();
    releasedScene.finalizeSuspendedGnStyleLayerRelease();
    transaction.status = 'committed';
    const failures: unknown[] = [];
    collectCleanupFailure(failures, () => this.requireMusic().stop());
    try {
      this.disposeModePresentation();
    } catch (error) {
      failures.push(error);
      this.retiredRuns.push(Object.freeze({
        ownership: this.captureRunOwnership(),
        scene: releasedScene,
      }));
    } finally {
      this.installRunOwnership(this.createEmptyRunOwnership());
    }
    if (this.effectsEnabled()) {
      collectCleanupFailure(
        failures,
        () => this.requireClassicGameplayController()
          .sharedAudioPresenter.playOneShot(CLASSIC_MENU_BUTTON_AUDIO_PATH),
      );
    }
    collectCleanupFailure(failures, () => this.emitSnapshot());
    reportCleanupFailures(
      'Committed GN Style Pause Quit cleanup',
      failures,
    );
  }

  private rollbackPauseQuit(
    transaction: GnStylePauseQuitTransaction,
  ): void {
    if (transaction.status === 'rolled-back') {
      return;
    }
    if (transaction.status === 'committed') {
      throw new Error(
        'Committed GN Style Pause Quit transaction cannot roll back',
      );
    }
    if (this.lifecycleFatalError !== null) {
      throw this.lifecycleFatalError;
    }
    let resumedScene: GnStyleSceneController | null = null;
    try {
      if (
        this.modeRoot !== transaction.root
        || this.pausePresenter !== transaction.presenter
        || !isValid(transaction.root, true)
      ) {
        throw new Error(
          'GN Style Pause Quit rollback lost gameplay ownership',
        );
      }
      const current = transaction.screenPlacement.currentScreen;
      if (current !== transaction.root) {
        if (transaction.root.parent !== null) {
          throw new Error(
            'GN Style Pause Quit rollback found gameplay under an unknown owner',
          );
        }
        if (current === null) {
          transaction.screenPlacement.attachCurrentScreen(transaction.root);
        } else {
          transaction.screenPlacement.replaceCurrentScreen(transaction.root);
        }
      }
      if (transaction.screenPlacement.currentScreen !== transaction.root) {
        throw new Error(
          'GN Style Pause Quit rollback could not restore gameplay',
        );
      }
      const scene = this.requireSceneController();
      scene.resumeSuspendedGnStyleLayer();
      resumedScene = scene;
      transaction.presenter.pauseIngress(this.currentPauseCard());
      if (transaction.audioReleaseAttempted) {
        this.restorePauseOwnershipAfterNavigationRollback(transaction);
      }
      transaction.status = 'rolled-back';
    } catch (error) {
      const quiesceFailures: unknown[] = [];
      if (resumedScene?.active) {
        collectCleanupFailure(
          quiesceFailures,
          () => resumedScene?.suspendGnStyleLayerForNavigation(),
        );
      }
      const failure = (
        error instanceof GnStyleLifecycleRollbackError
        && quiesceFailures.length === 0
          ? error
          : new GnStyleLifecycleRollbackError(
            'GN Style Pause Quit rollback failed',
            new Error(
              'GN Style Pause Quit request did not settle',
            ),
            [error, ...quiesceFailures],
          )
      );
      this.retainFatalLifecycleBoundary(failure);
      throw failure;
    }
    const notificationFailures: unknown[] = [];
    collectCleanupFailure(
      notificationFailures,
      () => this.emitSnapshot(),
    );
    reportCleanupFailures(
      'Rolled-back GN Style Pause Quit notification',
      notificationFailures,
    );
  }

  private releasePauseEffectsForNavigation(): void {
    const failures: unknown[] = [];
    collectCleanupFailure(
      failures,
      () => this.requireClassicGameplayController()
        .sharedAudioPresenter.stopAllEffects(),
    );
    collectCleanupFailure(
      failures,
      () => this.requireTimerAudio().stopAllEffects(),
    );
    // The dedicated GN source and particle clock remain paused until producer commit.
    // Preserving them here makes a shell rollback lossless.
    if (failures.length > 0) {
      throw cleanupError(
        'GN Style Pause Quit effects release',
        failures,
      );
    }
  }

  private restorePauseOwnershipAfterNavigationRollback(
    snapshot: GnStylePauseAudioLeaseSnapshot,
  ): void {
    const failures: unknown[] = [];
    if (snapshot.effectsPauseLeaseRequired) {
      collectCleanupFailure(
        failures,
        () => this.requireClassicGameplayController()
          .sharedAudioPresenter.pauseAllEffects(),
      );
      collectCleanupFailure(
        failures,
        () => this.requireTimerAudio().pauseAllEffects(),
      );
    }
    if (
      snapshot.musicPauseLeaseRequired
      && !this.requireMusic().paused
    ) {
      failures.push(new Error(
        'GN Style paused music lease was not retained for rollback',
      ));
    }
    if (
      snapshot.particlePauseLeaseRequired
      && this.particlePresenter?.state.paused !== true
    ) {
      failures.push(new Error(
        'GN Style paused particle lease was not retained for rollback',
      ));
    }
    if (failures.length > 0) {
      throw cleanupError(
        'GN Style Pause Quit ownership rollback',
        failures,
      );
    }
  }

  private stopAllRunEffects(): void {
    const failures: unknown[] = [];
    collectCleanupFailure(
      failures,
      () => this.requireTimerAudio().stopAllEffects(),
    );
    collectCleanupFailure(
      failures,
      () => this.requireClassicGameplayController()
        .sharedAudioPresenter.stopAllEffects(),
    );
    if (failures.length > 0) {
      throw cleanupError('GN Style stop-all-effects', failures);
    }
  }

  private captureModeForResult(): void {
    const root = this.requireModeRoot();
    if (
      this.pendingCapturedRoot !== null
      || this.pendingResultEntryTransaction !== null
      || this.resultPresenter !== null
      || this.resultPresentationRoot !== null
    ) {
      throw new Error('GN Style Result parent can be captured only once');
    }
    const transaction: GnStyleResultEntryTransaction = {
      configuration: null,
      gnStyleRoot: root,
      objectiveTailAttempted: false,
      presenter: null,
      root: null,
      status: 'pending',
    };
    this.pendingCapturedRoot = root;
    this.pendingResultEntryTransaction = transaction;
    const participant: GnStyleTimeUpFinishParticipant = Object.freeze({
      commit: () => this.commitResultTransition(transaction),
      prepareCommit: () => this.prepareResultCommit(transaction),
      rollback: () => this.rollbackResultTransition(transaction),
    });
    try {
      this.requireSceneController()
        .enlistTimeUpFinishParticipant(participant);
    } catch (error) {
      this.pendingCapturedRoot = null;
      this.pendingResultEntryTransaction = null;
      throw error;
    }
  }

  private beginResultConstruction(): void {
    if (this.pendingResultConfiguration !== null) {
      throw new Error(
        'GN Style Result construction can begin only once',
      );
    }
    this.pendingResultConfiguration = {};
  }

  private setPendingResultMode(
    mode: typeof GN_STYLE_RESULT_MODE_ID,
  ): void {
    if (
      this.pendingResultConfiguration === null
      || this.pendingResultConfiguration.mode !== undefined
      || mode !== GN_STYLE_RESULT_MODE_ID
    ) {
      throw new Error('GN Style Result mode must be exactly 2');
    }
    this.pendingResultConfiguration = {
      ...this.pendingResultConfiguration,
      mode,
    };
  }

  private setPendingResultScore(score: number): void {
    if (
      this.pendingResultConfiguration === null
      || this.pendingResultConfiguration.score !== undefined
    ) {
      throw new Error(
        'GN Style Result score requires one signed-int32 sample',
      );
    }
    assertSignedInt32(score, 'GN Style completedRunScore');
    this.pendingResultConfiguration = {
      ...this.pendingResultConfiguration,
      score,
    };
  }

  private configuredResult(): GnStyleResultConfiguration {
    const pending = this.pendingResultConfiguration;
    if (
      pending === null
      || pending.mode !== GN_STYLE_RESULT_MODE_ID
      || pending.score === undefined
    ) {
      throw new Error(
        'GN Style Result must be constructed, mode-set, and score-set',
      );
    }
    assertSignedInt32(pending.score, 'GN Style completedRunScore');
    return Object.freeze({
      mode: pending.mode,
      score: pending.score,
    });
  }

  private detachModeForResult(cleanup: true): void {
    if (cleanup !== true) {
      throw new Error('GN Style Result removal requires cleanup');
    }
    this.configuredResult();
    const root = this.requireModeRoot();
    if (this.pendingCapturedRoot !== root) {
      throw new Error(
        'GN Style Result removal lost the captured gameplay parent',
      );
    }
    this.requireMusic().stop();
    const detached = this.requireScreenPlacement().detachCurrentScreen(root);
    if (detached !== root || root.parent !== null) {
      throw new Error(
        'GN Style Result removal detached an unexpected current screen',
      );
    }
  }

  private attachResult(zOrder: 1): void {
    const configured = this.configuredResult();
    const transaction = this.requirePendingResultTransition();
    if (
      zOrder !== 1
      || this.resultPresenter !== null
      || this.resultPresentationRoot !== null
      || this.requireScreenPlacement().currentScreen !== null
      || transaction.gnStyleRoot !== this.pendingCapturedRoot
      || transaction.status !== 'pending'
    ) {
      throw new Error(
        'GN Style Result must attach once to an empty host at z-order 1',
      );
    }
    transaction.configuration = configured;
    const settings = this.sharedSettingsRuntime;
    const ranking = insertGnStyleResultScore(
      configured.score,
      settings.state.gnStyleLeaderboard,
    );
    const panelValues = gnStyleLeaderboardPanelValues(ranking.leaderboard);
    const classic = this.requireClassicGameplayController();
    const catalog = classic.sharedResourceCatalog;
    const presenter = ClassicResultPresenter.create({
      completedRunScore: configured.score,
      fonts: catalog.resultFonts,
      panelValues,
      random: classic.sharedGameplayRandom,
      resources: catalog.result,
      totalCoins: settings.state.snapshot.totalCoins,
      viewport: this.requireViewport(),
    }, {
      onMenu: this.onResultMenu,
      onRankPresentationBoundary: () => {
        if (ranking.achievedRank !== null && this.effectsEnabled()) {
          classic.sharedAudioPresenter.playOneShot(
            getClassicResultRankAudioPath(ranking.achievedRank),
          );
        }
      },
      onRetry: this.onResultRetry,
      onTotalCoinsEntranceComplete: this.onResultTotalCoinsEntranceComplete,
    });
    transaction.presenter = presenter;
    const root = createDetachedScreenRoot(
      'GnStyleResultPresentationRoot',
      this.node,
    );
    transaction.root = root;
    this.resultPresentationRoot = root;
    this.resultPresenter = presenter;
    this.requireScreenPlacement().attachCurrentScreen(root);
    presenter.attach(root);
  }

  private prepareResultCommit(
    transaction: GnStyleResultEntryTransaction,
  ): void {
    const configured = this.configuredResult();
    const resultRoot = transaction.root;
    const presenter = transaction.presenter;
    if (
      this.pendingResultEntryTransaction !== transaction
      || this.pendingCapturedRoot !== transaction.gnStyleRoot
      || resultRoot === null
      || presenter === null
      || this.resultPresentationRoot !== resultRoot
      || this.resultPresenter !== presenter
      || transaction.configuration?.mode !== configured.mode
      || transaction.configuration.score !== configured.score
      || transaction.gnStyleRoot.parent !== null
      || this.requireScreenPlacement().currentScreen !== resultRoot
      || transaction.status !== 'pending'
    ) {
      throw new Error(
        'GN Style Result can commit only from its provisional boundary',
      );
    }
    transaction.status = 'prepared';
  }

  private commitResultTransition(
    transaction: GnStyleResultEntryTransaction,
  ): void {
    if (transaction.status === 'committed') {
      return;
    }
    if (
      transaction.status !== 'prepared'
      || transaction.configuration === null
    ) {
      throw new Error(
        'GN Style Result transaction must prepare before commit',
      );
    }
    const configured = transaction.configuration;
    assertSignedInt32(configured.score, 'GN Style completedRunScore');
    this.sharedSettingsRuntime.state.recordGnStyleResultScore(
      configured.score,
    );

    // Publish the irreversible boundary before the recovered objective tail. A popup,
    // preference, or observer fault after this point cannot replay selector 2.
    transaction.status = 'committed';
    this.pendingResultEntryTransaction = null;
    transaction.objectiveTailAttempted = true;

    const retainedConfiguration: GnStylePendingResultConfiguration = {
      mode: configured.mode,
      score: configured.score,
    };
    const releasedScene = this.requireSceneController();
    const failures: unknown[] = [];
    collectCleanupFailure(failures, () => {
      const objective = createRecoveredResultObjectiveCommand(
        configured.mode,
        configured.score,
      );
      this.requireObjectivesManager().processGameEvent(
        objective.selector,
        objective.completedScore,
      );
    });
    let sceneReleased = false;
    try {
      releasedScene.releaseGnStyleLayerForReplacement();
      sceneReleased = releasedScene.readyForActivation;
      if (!sceneReleased) {
        throw new Error(
          'GN Style Result cleanup retained its scene lease',
        );
      }
    } catch (error) {
      failures.push(error);
    }
    let retiredWithRunOwnership = false;
    try {
      this.disposeModePresentation();
    } catch (error) {
      failures.push(error);
      const retained = this.captureRunOwnership();
      this.retiredRuns.push(Object.freeze({
        ownership: Object.freeze({
          ...retained,
          pendingCapturedRoot: null,
          pendingResultConfiguration: null,
        }),
        scene: releasedScene,
      }));
      retiredWithRunOwnership = true;
    } finally {
      this.installRunOwnership(this.createEmptyRunOwnership());
      this.pendingResultConfiguration = retainedConfiguration;
    }
    if (!sceneReleased && !retiredWithRunOwnership) {
      this.retiredRuns.push(Object.freeze({
        ownership: this.createEmptyRunOwnership(),
        scene: releasedScene,
      }));
    }
    collectCleanupFailure(failures, () => this.emitSnapshot());
    reportCleanupFailures(
      'Committed GN Style-to-Result cleanup',
      failures,
    );
  }

  private rollbackResultTransition(
    transaction: GnStyleResultEntryTransaction,
  ): void {
    if (transaction.status === 'rolled-back') {
      return;
    }
    if (transaction.status === 'committed') {
      throw new Error(
        'Committed GN Style Result transaction cannot roll back',
      );
    }
    if (
      this.pendingResultEntryTransaction !== transaction
      || this.pendingCapturedRoot !== transaction.gnStyleRoot
      || this.modeRoot !== transaction.gnStyleRoot
      || !isValid(transaction.gnStyleRoot, true)
    ) {
      throw new Error(
        'GN Style Result rollback lost its retained gameplay owner',
      );
    }
    const failures: unknown[] = [];
    const placement = this.requireScreenPlacement();
    const resultRoot = transaction.root;
    const presenter = transaction.presenter;
    if (resultRoot !== null && placement.currentScreen === resultRoot) {
      collectCleanupFailure(failures, () => {
        if (placement.detachCurrentScreen(resultRoot) !== resultRoot) {
          throw new Error(
            'GN Style Result rollback detached an unexpected Result',
          );
        }
      });
    }
    if (placement.currentScreen === null) {
      collectCleanupFailure(
        failures,
        () => placement.attachCurrentScreen(transaction.gnStyleRoot),
      );
    }
    if (placement.currentScreen !== transaction.gnStyleRoot) {
      failures.push(new Error(
        'GN Style Result rollback could not restore gameplay',
      ));
    }

    this.resultPresentationRoot = null;
    this.resultPresenter = null;
    this.pendingCapturedRoot = null;
    this.pendingResultConfiguration = null;
    this.pendingResultEntryTransaction = null;
    transaction.status = 'rolled-back';
    if (presenter !== null) {
      collectCleanupFailure(failures, () => presenter.dispose());
    }
    if (resultRoot !== null && isValid(resultRoot, true)) {
      collectCleanupFailure(failures, () => resultRoot.destroy());
    }
    collectCleanupFailure(failures, () => this.emitSnapshot());
    if (failures.length > 0) {
      throw cleanupError('GN Style Result rollback', failures);
    }
  }

  private readonly onResultRetry = (): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    try {
      this.restartFromResult();
    } catch (error) {
      const failure = normalizeError(error, 'GN Style Retry failed');
      if (this.resultPresenter?.state.navigation === 'retry') {
        this.resultPresenter.rearmNavigationAfterFailure('retry');
      }
      if (error instanceof GnStyleLifecycleRollbackError) {
        this.retainFatalLifecycleBoundary(error);
      }
      const payload: GnStyleResultRetryFailedEvent = Object.freeze({
        message: failure.message,
        reason: 'restart-error',
      });
      this.node.emit(GN_STYLE_RESULT_RETRY_FAILED_EVENT, payload);
      console.error(failure);
    }
  };

  private restartFromResult(): void {
    this.drainRetiredRuns();
    const configured = this.configuredResult();
    const retainedConfiguration: GnStylePendingResultConfiguration = {
      mode: configured.mode,
      score: configured.score,
    };
    const resultRoot = this.requireAttachedResultRoot();
    const resultPresenter = this.requireResultPresenter();
    const placement = this.requireScreenPlacement();
    const scene = this.requireSceneController();
    const commands = createGnStyleResultNavigationCommands({
      effectsEnabled: this.effectsEnabled(),
      mode: GN_STYLE_RESULT_MODE_ID,
      route: 'retry',
    });
    let captured = false;
    let detached = false;
    let objectiveRollback: GnStyleActivationObjectiveRollback | null = null;
    try {
      for (const command of commands) {
        this.emitCommand(command);
        switch (command.type) {
          case 'request-menu-button-audio':
            this.requireClassicGameplayController()
              .sharedAudioPresenter.playOneShot(command.canonicalPath);
            break;
          case 'capture-result-parent':
            if (placement.currentScreen !== resultRoot) {
              throw new Error('GN Style Retry lost Result before capture');
            }
            captured = true;
            break;
          case 'remove-result':
            if (!captured || command.cleanup !== true) {
              throw new Error(
                'GN Style Retry must capture Result before removal',
              );
            }
            if (placement.detachCurrentScreen(resultRoot) !== resultRoot) {
              throw new Error(
                'GN Style Retry detached an unexpected Result',
              );
            }
            detached = true;
            break;
          case 'construct-gn-style':
            if (
              !detached
              || !command.fresh
              || command.mode !== GN_STYLE_RESULT_MODE_ID
            ) {
              throw new Error(
                'GN Style Retry requires fresh mode-2 construction',
              );
            }
            this.constructMode();
            break;
          case 'attach-gn-style-to-captured-parent':
            if (command.zOrder !== 1) {
              throw new Error(
                'GN Style Retry requires recovered z-order 1',
              );
            }
            objectiveRollback = this.captureActivationObjectiveRollback();
            this.attachModeAndActivateScene(placement);
            break;
          case 'construct-main-menu':
          case 'attach-main-menu-to-captured-parent':
            throw new Error(
              `Unexpected GN Style Retry command ${command.type}`,
            );
          default:
            assertNever(command);
        }
      }
    } catch (error) {
      const failures: unknown[] = [];
      if (scene.active) {
        collectCleanupFailure(
          failures,
          () => scene.releaseGnStyleLayerForReplacement(),
        );
      }
      this.quiesceSceneAfterFailedRelease(
        scene,
        'GN Style Retry rollback',
        failures,
      );
      if (!scene.active) {
        collectCleanupFailure(failures, () => this.disposeModePresentation());
      }
      if (objectiveRollback !== null) {
        const retained = objectiveRollback;
        collectCleanupFailure(
          failures,
          () => this.restoreActivationObjective(retained),
        );
      }
      this.pendingResultConfiguration = retainedConfiguration;
      if (
        detached
        && isValid(resultRoot, true)
        && resultRoot.parent === null
        && placement.currentScreen === null
      ) {
        collectCleanupFailure(
          failures,
          () => placement.attachCurrentScreen(resultRoot),
        );
      }
      if (
        placement.currentScreen !== resultRoot
        || resultRoot.parent === null
      ) {
        failures.push(new Error(
          'GN Style Retry rollback could not restore Result ownership',
        ));
      }
      collectCleanupFailure(
        failures,
        () => resultPresenter.rearmNavigationAfterFailure('retry'),
      );
      if (failures.length > 0) {
        const failure = new GnStyleLifecycleRollbackError(
          'GN Style Retry rollback failed',
          error,
          failures,
        );
        this.retainFatalLifecycleBoundary(failure);
        throw failure;
      }
      if (error instanceof GnStyleLifecycleRollbackError) {
        this.retainFatalLifecycleBoundary(error);
      }
      throw error;
    }

    this.resultPresentationRoot = null;
    this.resultPresenter = null;
    const failures: unknown[] = [];
    collectCleanupFailure(failures, () => resultPresenter.dispose());
    collectCleanupFailure(failures, () => {
      if (isValid(resultRoot, true)) {
        resultRoot.destroy();
      }
    });
    collectCleanupFailure(failures, () => this.emitSnapshot());
    reportCleanupFailures(
      'Committed GN Style Retry Result cleanup',
      failures,
    );
  }

  private readonly onResultMenu = (): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    const presenter = this.requireResultPresenter();
    let transaction: GnStyleResultMenuTransaction | null = null;
    try {
      const configured = this.configuredResult();
      assertSignedInt32(configured.score, 'GN Style completedRunScore');
      const root = this.requireAttachedResultRoot();
      const activeTransaction: GnStyleResultMenuTransaction = {
        presenter,
        root,
        screenPlacement: this.requireScreenPlacement(),
        status: 'pending',
      };
      transaction = activeTransaction;
      for (const command of createGnStyleResultNavigationCommands({
        effectsEnabled: this.effectsEnabled(),
        mode: GN_STYLE_RESULT_MODE_ID,
        route: 'main-menu',
      })) {
        this.emitCommand(command);
        if (command.type === 'request-menu-button-audio') {
          this.requireClassicGameplayController()
            .sharedAudioPresenter.playOneShot(command.canonicalPath);
        }
      }
      const payload: GnStyleResultMenuRequestedEvent = Object.freeze({
        commit: (previousRoot: Node) => (
          this.commitResultMenu(activeTransaction, previousRoot)
        ),
        completedRunScore: configured.score,
        resultRoot: root,
        rollback: () => this.rollbackResultMenu(activeTransaction),
      });
      this.node.emit(GN_STYLE_RESULT_MENU_REQUESTED_EVENT, payload);
    } catch (error) {
      if (transaction !== null && transaction.status === 'pending') {
        try {
          this.rollbackResultMenu(transaction);
        } catch (rollbackError) {
          const failure = new GnStyleLifecycleRollbackError(
            'GN Style Result menu rollback failed',
            error,
            [rollbackError],
          );
          this.retainFatalLifecycleBoundary(failure);
          throw failure;
        }
      } else if (
        this.resultPresenter === presenter
        && presenter.state.navigation === 'menu'
      ) {
        if (!presenter.rearmNavigationAfterFailure('menu')) {
          const failure = new GnStyleLifecycleRollbackError(
            'GN Style Result menu rearm failed',
            error,
            [],
          );
          this.retainFatalLifecycleBoundary(failure);
          throw failure;
        }
      }
      throw error;
    }
    if (transaction.status === 'pending') {
      try {
        this.rollbackResultMenu(transaction);
      } catch (error) {
        const failure = new GnStyleLifecycleRollbackError(
          'GN Style Result menu settlement failed',
          new Error(
            'GN Style Result menu request returned without settlement',
          ),
          [error],
        );
        this.retainFatalLifecycleBoundary(failure);
        throw failure;
      }
    }
  };

  private commitResultMenu(
    transaction: GnStyleResultMenuTransaction,
    previousRoot: Node,
  ): void {
    if (transaction.status === 'committed') {
      return;
    }
    if (previousRoot !== transaction.root) {
      throw new Error(
        'GN Style Result menu commit received an unexpected previous screen',
      );
    }
    if (transaction.status === 'rolled-back') {
      throw new Error(
        'Rolled-back GN Style Result menu cannot commit',
      );
    }
    if (
      this.resultPresentationRoot !== transaction.root
      || this.resultPresenter !== transaction.presenter
      || transaction.root.parent !== null
      || transaction.screenPlacement.currentScreen === null
      || transaction.screenPlacement.currentScreen === transaction.root
    ) {
      throw new Error(
        'GN Style Result menu commit requires successful replacement',
      );
    }
    this.resultPresentationRoot = null;
    this.resultPresenter = null;
    transaction.status = 'committed';
    const failures: unknown[] = [];
    collectCleanupFailure(failures, () => this.requireMusic().stop());
    collectCleanupFailure(failures, () => transaction.presenter.dispose());
    collectCleanupFailure(failures, () => {
      if (isValid(transaction.root, true)) {
        transaction.root.destroy();
      }
    });
    reportCleanupFailures(
      'Committed GN Style Result menu cleanup',
      failures,
    );
  }

  private rollbackResultMenu(
    transaction: GnStyleResultMenuTransaction,
  ): void {
    if (transaction.status === 'rolled-back') {
      return;
    }
    if (transaction.status === 'committed') {
      throw new Error(
        'Committed GN Style Result menu cannot roll back',
      );
    }
    if (
      this.resultPresentationRoot !== transaction.root
      || this.resultPresenter !== transaction.presenter
      || !isValid(transaction.root, true)
    ) {
      throw new Error(
        'GN Style Result menu rollback lost Result ownership',
      );
    }
    const current = transaction.screenPlacement.currentScreen;
    if (current !== transaction.root) {
      if (transaction.root.parent !== null) {
        throw new Error(
          'GN Style Result menu rollback found Result under an unknown owner',
        );
      }
      if (current === null) {
        transaction.screenPlacement.attachCurrentScreen(transaction.root);
      } else {
        transaction.screenPlacement.replaceCurrentScreen(transaction.root);
      }
    }
    if (
      transaction.screenPlacement.currentScreen !== transaction.root
      || !transaction.presenter.rearmNavigationAfterFailure('menu')
      || transaction.presenter.state.navigation !== 'none'
    ) {
      throw new Error(
        'GN Style Result menu rollback could not restore and rearm Result',
      );
    }
    transaction.status = 'rolled-back';
    const notificationFailures: unknown[] = [];
    collectCleanupFailure(
      notificationFailures,
      () => this.emitSnapshot(),
    );
    reportCleanupFailures(
      'Rolled-back GN Style Result menu notification',
      notificationFailures,
    );
  }

  private readonly onResultTotalCoinsEntranceComplete = (): number => {
    if (this.pendingResultEntryTransaction !== null) {
      throw new Error(
        'GN Style Result reward cannot commit before Time-Up Finish',
      );
    }
    const configured = this.configuredResult();
    assertSignedInt32(configured.score, 'GN Style completedRunScore');
    const award = this.sharedSettingsRuntime.state.awardGnStyleResultCoins(
      configured.score,
    );
    const payload: GnStyleResultRewardReadyEvent = Object.freeze({
      bonusCoins: award.bonusCoins,
      completedRunScore: configured.score,
      totalCoins: award.totalCoins,
    });
    this.node.emit(GN_STYLE_RESULT_REWARD_READY_EVENT, payload);
    return award.bonusCoins;
  };

  private readonly onObjectiveAchievement = (
    event: ObjectiveAchievementPopupEvent,
  ): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    if (this.effectsEnabled()) {
      this.requireClassicGameplayController()
        .sharedAudioPresenter.playOneShot(CLASSIC_OBJECTIVE_CHEER_AUDIO_PATH);
    }
    const presenter = ObjectiveAchievementPresenter.create({
      event,
      random: this.sharedGameplayRandom,
      resources: this.requireBaseGameplayResources(),
      viewport: this.requireViewport(),
    });
    try {
      presenter.attach(this.requireObjectiveAchievementTargetRoot());
      this.objectiveAchievementPresenters.add(presenter);
    } catch (error) {
      const failures: unknown[] = [];
      collectCleanupFailure(failures, () => presenter.dispose());
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'GN Style objective achievement rollback failed',
          error,
          failures,
        );
      }
      throw error;
    }
  };

  private captureActivationObjectiveRollback():
    GnStyleActivationObjectiveRollback | null {
    const manager = this.requireObjectivesManager();
    const active = manager.activeObjective();
    if (active?.id !== 48) {
      return null;
    }
    return Object.freeze({
      objectiveId: 48,
      value: manager.value(48),
    });
  }

  private restoreActivationObjective(
    rollback: GnStyleActivationObjectiveRollback,
  ): void {
    if (!this.requireObjectivesManager().setValue(
      rollback.objectiveId,
      rollback.value,
    )) {
      throw new Error(
        'GN Style activation could not restore objective progress',
      );
    }
  }

  private captureRunOwnership(): GnStyleRunOwnership {
    return {
      bladePresenter: this.bladePresenter,
      combo: this.combo,
      comboItemPresenters: this.comboItemPresenters,
      criticalCutHalfPresenters: this.criticalCutHalfPresenters,
      criticalParticlePresenters: this.criticalParticlePresenters,
      cutHalfPresenters: this.cutHalfPresenters,
      instructionAttachments: this.instructionAttachments,
      introPresenter: this.introPresenter,
      modeRoot: this.modeRoot,
      particlePresenter: this.particlePresenter,
      pausePresenter: this.pausePresenter,
      pendingCapturedRoot: this.pendingCapturedRoot,
      pendingResultConfiguration: this.pendingResultConfiguration,
      registry: this.registry,
      scoreHudPresenter: this.scoreHudPresenter,
      scoreHudRoot: this.scoreHudRoot,
      swishAudio: this.swishAudio,
      timeManagerPresenter: this.timeManagerPresenter,
      worldPresentationRoot: this.worldPresentationRoot,
    };
  }

  private createEmptyRunOwnership(): GnStyleRunOwnership {
    return {
      bladePresenter: null,
      combo: null,
      comboItemPresenters: new Set<ComboItemPresenter>(),
      criticalCutHalfPresenters: new Set<ClassicCutHalfPresenter>(),
      criticalParticlePresenters: new Set<ClassicCriticalParticlePresenter>(),
      cutHalfPresenters: new Set<ClassicCutHalfPresenter>(),
      instructionAttachments: new Set<GnStyleInstructionCard>(),
      introPresenter: null,
      modeRoot: null,
      particlePresenter: null,
      pausePresenter: null,
      pendingCapturedRoot: null,
      pendingResultConfiguration: null,
      registry: null,
      scoreHudPresenter: null,
      scoreHudRoot: null,
      swishAudio: null,
      timeManagerPresenter: null,
      worldPresentationRoot: null,
    };
  }

  private installRunOwnership(ownership: GnStyleRunOwnership): void {
    this.bladePresenter = ownership.bladePresenter;
    this.combo = ownership.combo;
    this.comboItemPresenters = ownership.comboItemPresenters;
    this.criticalCutHalfPresenters = ownership.criticalCutHalfPresenters;
    this.criticalParticlePresenters = ownership.criticalParticlePresenters;
    this.cutHalfPresenters = ownership.cutHalfPresenters;
    this.instructionAttachments = ownership.instructionAttachments;
    this.introPresenter = ownership.introPresenter;
    this.modeRoot = ownership.modeRoot;
    this.particlePresenter = ownership.particlePresenter;
    this.pausePresenter = ownership.pausePresenter;
    this.pendingCapturedRoot = ownership.pendingCapturedRoot;
    this.pendingResultConfiguration = ownership.pendingResultConfiguration;
    this.registry = ownership.registry;
    this.scoreHudPresenter = ownership.scoreHudPresenter;
    this.scoreHudRoot = ownership.scoreHudRoot;
    this.swishAudio = ownership.swishAudio;
    this.timeManagerPresenter = ownership.timeManagerPresenter;
    this.worldPresentationRoot = ownership.worldPresentationRoot;
  }

  private acquireStandbySceneController(
    activeScene: GnStyleSceneController,
  ): GnStyleSceneController {
    let standby = this.standbySceneController;
    if (standby === null || !isValid(standby, true)) {
      const existing = this.node
        .getComponents(GnStyleSceneController)
        .filter((scene) => scene !== activeScene && isValid(scene, true));
      if (existing.length > 1) {
        throw new Error(
          'GN Style Replay found more than one standby scene lease',
        );
      }
      if (existing.length === 1) {
        [standby] = existing;
      } else {
        try {
          standby = this.node.addComponent(GnStyleSceneController);
        } catch (error) {
          const failures: unknown[] = [];
          for (const partial of this.node.getComponents(
            GnStyleSceneController,
          )) {
            if (partial !== activeScene && isValid(partial, true)) {
              collectCleanupFailure(failures, () => partial.destroy());
            }
          }
          this.standbySceneController = null;
          if (failures.length > 0) {
            throw aggregateWithPrimary(
              'GN Style standby construction rollback failed',
              error,
              failures,
            );
          }
          throw error;
        }
      }
      this.standbySceneController = standby;
    }
    const liveScenes = this.node
      .getComponents(GnStyleSceneController)
      .filter((scene) => isValid(scene, true));
    if (
      liveScenes.length !== 2
      || liveScenes.indexOf(activeScene) === -1
      || liveScenes.indexOf(standby) === -1
      || !standby.readyForActivation
      || standby === activeScene
      || standby.active
      || standby.suspended
    ) {
      if (standby !== activeScene && isValid(standby, true)) {
        standby.destroy();
      }
      this.standbySceneController = null;
      throw new Error(
        'GN Style Replay requires one inactive standby scene lease',
      );
    }
    return standby;
  }

  private restoreRetainedSwishCooldown(
    ownership: GnStyleRunOwnership,
  ): void {
    if (ownership.swishAudio?.locked) {
      this.scheduleOnce(
        this.onSwishCooldownComplete,
        CLASSIC_SWISH_COOLDOWN_ACTION_SECONDS,
      );
    }
  }

  private drainRetiredRuns(): void {
    if (this.retiredRuns.length === 0) {
      return;
    }
    const activeOwnership = this.captureRunOwnership();
    const activeScene = this.requireSceneController();
    const retained: RetiredGnStyleRunOwnership[] = [];
    const failures: unknown[] = [];
    try {
      for (const retired of this.retiredRuns) {
        this.installRunOwnership(retired.ownership);
        this.gnStyleSceneController = retired.scene;
        if (retired.scene.active) {
          collectCleanupFailure(
            failures,
            () => retired.scene.releaseGnStyleLayerForReplacement(),
          );
        }
        this.quiesceSceneAfterFailedRelease(
          retired.scene,
          'Retired GN Style run cleanup',
          failures,
        );
        if (retired.scene.suspended) {
          collectCleanupFailure(
            failures,
            () => retired.scene.finalizeSuspendedGnStyleLayerRelease(),
          );
        }
        if (
          !retired.scene.active
          && !retired.scene.suspended
          && !retired.scene.readyForActivation
        ) {
          collectCleanupFailure(
            failures,
            () => retired.scene.releaseGnStyleLayerForReplacement(),
          );
        }
        if (
          retired.scene.active
          || retired.scene.suspended
          || !retired.scene.readyForActivation
        ) {
          retained.push(Object.freeze({
            ownership: this.captureRunOwnership(),
            scene: retired.scene,
          }));
          continue;
        }
        try {
          this.disposeModePresentation();
        } catch (error) {
          retained.push(Object.freeze({
            ownership: this.captureRunOwnership(),
            scene: retired.scene,
          }));
          failures.push(error);
        }
      }
    } finally {
      this.installRunOwnership(activeOwnership);
      this.gnStyleSceneController = activeScene;
      this.retiredRuns.length = 0;
      this.retiredRuns.push(...retained);
    }
    if (failures.length > 0) {
      throw cleanupError('Retired GN Style run ownership', failures);
    }
  }

  private retainFatalLifecycleBoundary(
    error: GnStyleLifecycleRollbackError,
  ): void {
    this.lifecycleFatalError ??= error;
    this.unschedule(this.onSwishCooldownComplete);
  }

  private quiesceSceneAfterFailedRelease(
    scene: GnStyleSceneController,
    label: string,
    failures: unknown[],
  ): void {
    if (scene.active) {
      collectCleanupFailure(
        failures,
        () => scene.releaseGnStyleLayerForReplacement(),
      );
    }
    if (scene.active) {
      collectCleanupFailure(
        failures,
        () => scene.suspendGnStyleLayerForNavigation(),
      );
    }
    if (scene.active) {
      failures.push(new Error(
        `${label} retained an active ordinary-input/Physics2D lease`,
      ));
    }
  }

  private disposeModePresentation(): void {
    const failures: unknown[] = [];
    const root = this.modeRoot;
    if (
      root !== null
      && root.parent !== null
      && this.screenPlacement?.currentScreen === root
    ) {
      collectCleanupFailure(failures, () => {
        const detached = this.screenPlacement?.detachCurrentScreen(root);
        if (detached !== root) {
          throw new Error(
            'GN Style teardown detached an unexpected current screen',
          );
        }
      });
    }

    this.unschedule(this.onSwishCooldownComplete);
    this.swishAudio?.unlock();
    this.swishAudio = null;
    for (const presenter of [...this.cutHalfPresenters]) {
      try {
        presenter.disposeAll();
        this.cutHalfPresenters.delete(presenter);
        this.criticalCutHalfPresenters.delete(presenter);
      } catch (error) {
        failures.push(error);
      }
    }
    for (const presenter of [...this.criticalParticlePresenters]) {
      try {
        presenter.dispose();
        this.criticalParticlePresenters.delete(presenter);
      } catch (error) {
        failures.push(error);
      }
    }
    for (const presenter of [...this.comboItemPresenters]) {
      try {
        presenter.dispose();
        this.comboItemPresenters.delete(presenter);
      } catch (error) {
        failures.push(error);
      }
    }

    const particle = this.particlePresenter;
    if (particle !== null) {
      try {
        particle.dispose();
        if (this.particlePresenter === particle) {
          this.particlePresenter = null;
        }
      } catch (error) {
        failures.push(error);
      }
    }
    const intro = this.introPresenter;
    if (intro !== null) {
      try {
        intro.dispose();
        if (this.introPresenter === intro) {
          this.introPresenter = null;
        }
      } catch (error) {
        failures.push(error);
      }
    }
    const timeManager = this.timeManagerPresenter;
    if (timeManager !== null) {
      try {
        timeManager.dispose();
        if (this.timeManagerPresenter === timeManager) {
          this.timeManagerPresenter = null;
        }
      } catch (error) {
        failures.push(error);
      }
    }
    const blade = this.bladePresenter;
    if (blade !== null) {
      try {
        blade.dispose();
        if (this.bladePresenter === blade) {
          this.bladePresenter = null;
        }
      } catch (error) {
        failures.push(error);
      }
    }
    const scoreHud = this.scoreHudPresenter;
    if (scoreHud !== null) {
      try {
        scoreHud.dispose();
        if (this.scoreHudPresenter === scoreHud) {
          this.scoreHudPresenter = null;
        }
      } catch (error) {
        failures.push(error);
      }
    }
    const pause = this.pausePresenter;
    if (pause !== null) {
      try {
        pause.dispose();
        if (this.pausePresenter === pause) {
          this.pausePresenter = null;
        }
      } catch (error) {
        failures.push(error);
      }
    }

    const registry = this.registry;
    let registryDrained = registry === null;
    if (registry !== null) {
      try {
        registry.disposeAll();
        registryDrained = registry.size === 0;
        if (!registryDrained) {
          failures.push(new Error(
            'GN Style registry drain retained an entity owner',
          ));
        }
      } catch (error) {
        failures.push(error);
        registryDrained = false;
      }
      if (registryDrained && this.registry === registry) {
        this.registry = null;
      }
    }

    const presentationOwnersDrained = (
      registryDrained
      && this.cutHalfPresenters.size === 0
      && this.criticalParticlePresenters.size === 0
      && this.comboItemPresenters.size === 0
      && this.particlePresenter === null
      && this.introPresenter === null
      && this.timeManagerPresenter === null
      && this.bladePresenter === null
      && this.scoreHudPresenter === null
      && this.pausePresenter === null
    );
    if (presentationOwnersDrained) {
      this.criticalCutHalfPresenters.clear();
      this.instructionAttachments.clear();
      this.combo = null;
      for (const childRoot of [
        this.worldPresentationRoot,
        this.scoreHudRoot,
      ]) {
        if (childRoot !== null && isValid(childRoot, true)) {
          collectCleanupFailure(failures, () => childRoot.destroy());
        }
      }
      this.worldPresentationRoot = null;
      this.scoreHudRoot = null;
      if (root !== null && isValid(root, true)) {
        collectCleanupFailure(failures, () => root.destroy());
      }
      if (root === null || !isValid(root, true)) {
        this.modeRoot = null;
        if (this.pendingCapturedRoot === root) {
          this.pendingCapturedRoot = null;
        }
      }
    }
    if (failures.length > 0) {
      throw cleanupError('GN Style mode presentation', failures);
    }
  }

  private disposeResultPresentation(): void {
    const failures: unknown[] = [];
    const root = this.resultPresentationRoot;
    if (
      root !== null
      && root.parent !== null
      && this.screenPlacement?.currentScreen === root
    ) {
      collectCleanupFailure(
        failures,
        () => this.screenPlacement?.detachCurrentScreen(root),
      );
    }
    collectCleanupFailure(failures, () => this.resultPresenter?.dispose());
    if (root !== null && isValid(root, true)) {
      collectCleanupFailure(failures, () => root.destroy());
    }
    this.resultPresenter = null;
    this.resultPresentationRoot = null;
    if (failures.length > 0) {
      throw cleanupError('GN Style Result presentation', failures);
    }
  }

  private disposePreparation(): void {
    const failures: unknown[] = [];
    for (const presenter of [...this.objectiveAchievementPresenters]) {
      try {
        presenter.dispose();
        this.objectiveAchievementPresenters.delete(presenter);
      } catch (error) {
        failures.push(error);
      }
    }
    const objectiveTarget = this.objectiveAchievementTargetRoot;
    if (
      objectiveTarget !== null
      && this.objectiveAchievementPresenters.size === 0
    ) {
      collectCleanupFailure(failures, () => {
        if (isValid(objectiveTarget, true)) {
          objectiveTarget.destroy();
        }
      });
      if (!isValid(objectiveTarget, true)) {
        this.objectiveAchievementTargetRoot = null;
      }
    }
    const timerAudio = this.timerAudio;
    if (timerAudio !== null) {
      try {
        timerAudio.dispose();
        if (this.timerAudio === timerAudio) {
          this.timerAudio = null;
        }
      } catch (error) {
        failures.push(error);
      }
    }
    const music = this.music;
    if (music !== null) {
      try {
        music.dispose();
        if (this.music === music) {
          this.music = null;
        }
      } catch (error) {
        failures.push(error);
      }
    }
    if (
      this.timerAudio === null
      && this.music === null
      && this.objectiveAchievementPresenters.size === 0
      && this.objectiveAchievementTargetRoot === null
    ) {
      this.baseGameplayResources = null;
      this.gnStyleResources = null;
      this.timeManagerResources = null;
      this.objectivesManager = null;
      if (this.shuttingDown) {
        this.readinessStatus = 'idle';
      }
    }
    if (failures.length > 0) {
      throw cleanupError('GN Style preparation', failures);
    }
  }

  private disposeStandbySceneController(): void {
    const standby = this.standbySceneController;
    if (
      standby !== null
      && standby !== this.gnStyleSceneController
      && isValid(standby, true)
    ) {
      standby.destroy();
    }
    this.standbySceneController = null;
  }

  private releaseSceneForTeardown(): void {
    const scene = this.gnStyleSceneController;
    if (scene === null || !isValid(scene, true)) {
      return;
    }
    if (scene.active) {
      scene.releaseGnStyleLayerForReplacement();
    } else if (scene.suspended) {
      scene.finalizeSuspendedGnStyleLayerRelease();
    }
  }

  private stopRunEffectsForTeardown(): void {
    const failures: unknown[] = [];
    const timerAudio = this.timerAudio;
    const music = this.music;
    const classic = this.classicGameplayController;
    if (timerAudio !== null) {
      collectCleanupFailure(failures, () => timerAudio.stopAllEffects());
    }
    if (music !== null) {
      collectCleanupFailure(failures, () => music.stop());
    }
    if (classic !== null) {
      collectCleanupFailure(
        failures,
        () => classic.sharedAudioPresenter.stopAllEffects(),
      );
      collectCleanupFailure(
        failures,
        () => classic.sharedAudioPresenter.stopBackgroundMusic(),
      );
    }
    if (failures.length > 0) {
      throw cleanupError('GN Style teardown stop-all-effects', failures);
    }
  }

  private requireClassicGameplayController(): ClassicGameplayController {
    if (this.classicGameplayController === null) {
      throw new Error(
        'GN Style requires its Classic process owner after onLoad',
      );
    }
    return this.classicGameplayController;
  }

  private requireSceneController(): GnStyleSceneController {
    if (this.gnStyleSceneController === null) {
      throw new Error(
        'GN Style scene controller is unavailable before onLoad',
      );
    }
    return this.gnStyleSceneController;
  }

  private requireResolution(): NonNullable<
    ReturnType<ClassicSceneController['resolutionSnapshot']>
  > {
    const resolution = this.classicSceneController?.resolutionSnapshot();
    if (resolution === null || resolution === undefined) {
      throw new Error(
        'GN Style requires the prepared shared resolution profile',
      );
    }
    return resolution;
  }

  private requireViewport(): GnStyleViewport {
    const visibleRect = this.requireResolution().visibleRect;
    return Object.freeze({
      height: visibleRect.height,
      width: visibleRect.width,
      x: visibleRect.x,
      y: visibleRect.y,
    });
  }

  private requireBaseGameplayResources(): LoadedBaseGameplayResources {
    if (this.baseGameplayResources === null) {
      throw new Error(
        'GN Style base-gameplay resources are unavailable before preparation',
      );
    }
    return this.baseGameplayResources;
  }

  private requireGnStyleResources(): LoadedGnStyleResources {
    if (this.gnStyleResources === null) {
      throw new Error(
        'GN Style supplemental resources are unavailable before preparation',
      );
    }
    return this.gnStyleResources;
  }

  private requireTimeManagerResources():
    LoadedGnStyleTimeManagerResources {
    if (this.timeManagerResources === null) {
      throw new Error(
        'GN Style TimeManager resources are unavailable before preparation',
      );
    }
    return this.timeManagerResources;
  }

  private requireTimerAudio(): TimeManagerAudioPresenter {
    if (this.timerAudio === null) {
      throw new Error(
        'GN Style timer audio is unavailable before preparation',
      );
    }
    return this.timerAudio;
  }

  private requireMusic(): GnStyleBackgroundMusicPresenter {
    if (this.music === null) {
      throw new Error(
        'GN Style background music is unavailable before preparation',
      );
    }
    return this.music;
  }

  private requireObjectivesManager(): ObjectivesManagerState {
    if (this.objectivesManager === null) {
      throw new Error(
        'GN Style objectives manager is unavailable before preparation',
      );
    }
    return this.objectivesManager;
  }

  private requireObjectiveAchievementTargetRoot(): Node {
    const root = this.objectiveAchievementTargetRoot;
    if (root === null || !isValid(root, true)) {
      throw new Error(
        'GN Style objective-achievement target is unavailable',
      );
    }
    return root;
  }

  private requireModeRoot(): Node {
    const root = this.modeRoot;
    if (root === null || !isValid(root, true)) {
      throw new Error('GN Style mode root is unavailable');
    }
    return root;
  }

  private requireDetachedModeRoot(): Node {
    const root = this.requireModeRoot();
    if (root.parent !== null) {
      throw new Error(
        'GN Style mode root must be detached before shell attachment',
      );
    }
    return root;
  }

  private requireWorldPresentationRoot(): Node {
    const root = this.worldPresentationRoot;
    if (root === null || !isValid(root, true)) {
      throw new Error(
        'GN Style world presentation root is unavailable',
      );
    }
    return root;
  }

  private requireScoreHudRoot(): Node {
    const root = this.scoreHudRoot;
    if (root === null || !isValid(root, true)) {
      throw new Error(
        'GN Style score-HUD root is unavailable',
      );
    }
    return root;
  }

  private requireRegistry(): ClassicEntityRegistry {
    if (this.registry === null) {
      throw new Error('GN Style entity registry is unavailable');
    }
    return this.registry;
  }

  private requireCombo(): ComboService {
    if (this.combo === null) {
      throw new Error('GN Style combo service is unavailable');
    }
    return this.combo;
  }

  private requireSwishAudio(): ClassicSwishAudioGate {
    if (this.swishAudio === null) {
      throw new Error('GN Style swish audio gate is unavailable');
    }
    return this.swishAudio;
  }

  private requireIntroPresenter(): GnStyleIntroPresenter {
    if (this.introPresenter === null) {
      throw new Error('GN Style intro presenter is unavailable');
    }
    return this.introPresenter;
  }

  private requireParticlePresenter(): GnStyleParticlePresenter {
    if (this.particlePresenter === null) {
      throw new Error('GN Style particle presenter is unavailable');
    }
    return this.particlePresenter;
  }

  private requireTimeManagerPresenter(): TimeManagerPresenter {
    if (this.timeManagerPresenter === null) {
      throw new Error('GN Style TimeManager presenter is unavailable');
    }
    return this.timeManagerPresenter;
  }

  private requireScoreHudPresenter(): ClassicScoreHudPresenter {
    if (this.scoreHudPresenter === null) {
      throw new Error('GN Style score-HUD presenter is unavailable');
    }
    return this.scoreHudPresenter;
  }

  private requirePausePresenter(): BaseGameplayPausePresenter {
    if (this.pausePresenter === null) {
      throw new Error(
        'GN Style pause presenter is unavailable before scene entry',
      );
    }
    return this.pausePresenter;
  }

  private requireScreenPlacement(): GnStyleScreenPlacementPort {
    if (this.screenPlacement === null) {
      throw new Error(
        'GN Style current-screen placement is unavailable',
      );
    }
    return this.screenPlacement;
  }

  private requirePendingResultTransition():
    GnStyleResultEntryTransaction {
    const transaction = this.pendingResultEntryTransaction;
    if (transaction === null || transaction.status !== 'pending') {
      throw new Error('GN Style Result transition is not pending');
    }
    return transaction;
  }

  private requireResultPresenter(): ClassicResultPresenter {
    if (this.resultPresenter === null) {
      throw new Error('GN Style Result presenter is unavailable');
    }
    return this.resultPresenter;
  }

  private requireAttachedResultRoot(): Node {
    const root = this.resultPresentationRoot;
    if (
      root === null
      || !isValid(root, true)
      || root.parent === null
      || this.screenPlacement?.currentScreen !== root
      || !root.activeInHierarchy
    ) {
      throw new Error(
        'GN Style Result must be the active current screen',
      );
    }
    return root;
  }

  private isGnStyleGameplayAttached(): boolean {
    const root = this.modeRoot;
    return (
      this.lifecycleFatalError === null
      && root !== null
      && isValid(root, true)
      && root.parent !== null
      && this.screenPlacement?.currentScreen === root
      && root.activeInHierarchy
      && this.gnStyleSceneController?.active === true
    );
  }

  private assertPreparationStillUsable(): void {
    if (this.shuttingDown || !isValid(this.node, true)) {
      throw new Error(
        'GN Style runtime preparation completed after destruction',
      );
    }
  }

  private effectsEnabled = (): boolean => (
    this.classicGameplayController?.sharedSettingsRuntime
      .state.snapshot.effectsEnabled ?? true
  );

  private emitCommands(commands: readonly unknown[]): void {
    for (const command of commands) {
      this.emitCommand(command);
    }
  }

  private emitCommand(command: unknown): void {
    if (!this.shuttingDown) {
      this.node.emit(GN_STYLE_GAMEPLAY_COMMAND_EVENT, command);
    }
  }

  private emitSnapshot(): void {
    if (!this.shuttingDown && isValid(this.node, true)) {
      this.node.emit(GN_STYLE_GAMEPLAY_SNAPSHOT_EVENT, this.snapshot());
    }
  }
}

const GN_STYLE_TIME_MANAGER_FONT_PATH
  = 'Fonts/MotorwerkOblique.ttf' as const;

function createPresenterRoot(parent: Node, name: string): Node {
  const root = new Node(name);
  root.layer = parent.layer;
  root.setParent(parent);
  return root;
}

function createVisibleRect(viewport: GnStyleViewport): Readonly<{
  readonly center: Readonly<{ readonly x: number; readonly y: number }>;
  readonly height: number;
  readonly leftX: number;
  readonly rightX: number;
  readonly topY: number;
  readonly width: number;
}> {
  return Object.freeze({
    center: Object.freeze({
      x: viewport.x + viewport.width / 2,
      y: viewport.y + viewport.height / 2,
    }),
    height: viewport.height,
    leftX: viewport.x,
    rightX: viewport.x + viewport.width,
    topY: viewport.y + viewport.height,
    width: viewport.width,
  });
}

function isClassicSpawnCommand(
  command: GnStyleTossRuntimeCommand,
): command is Extract<
  ClassicTossStrategyCommand,
  Readonly<{ readonly entityOccurrenceId: number }>
> {
  return 'entityOccurrenceId' in command;
}

function assertGnStyleController(
  controller: GnStyleTossControllerId,
): void {
  if (!GN_STYLE_TOSS_CREATION_ORDER.some((candidate) => (
    candidate === controller
  ))) {
    throw new Error(
      `Unsupported GN Style toss controller ${controller}`,
    );
  }
}

function assertScreenPlacementPort(
  screenPlacement: GnStyleScreenPlacementPort,
): void {
  if (
    screenPlacement === null
    || typeof screenPlacement !== 'object'
    || typeof screenPlacement.attachCurrentScreen !== 'function'
    || typeof screenPlacement.detachCurrentScreen !== 'function'
    || typeof screenPlacement.replaceCurrentScreen !== 'function'
  ) {
    throw new TypeError(
      'GN Style screen placement must implement the current-screen port',
    );
  }
}

async function loadGnStyleTimeManagerResources(
  assetTree: GameAssetTree,
): Promise<LoadedGnStyleTimeManagerResources> {
  const compact = assetTree === '480x800';
  const contracts = Object.freeze({
    freezeClock: createGameRaster(
      `${assetTree}/Interfaces/object-time-freeze.png`,
      compact ? [148, 85] : [222, 127],
    ),
    timeUp: createGameRaster(
      `${assetTree}/Text/text-time-up.png`,
      compact ? [345, 135] : [481, 165],
    ),
  });
  const bundle = await loadGameResourceBundle();
  const [rasters, timeManagerFont] = await Promise.all([
    loadExactGameRasters(
      [contracts.freezeClock, contracts.timeUp],
      bundle,
    ),
    loadGnStyleTimeManagerFont(bundle),
  ]);
  const [freezeClock, timeUp] = rasters;
  if (
    freezeClock === undefined
    || timeUp === undefined
    || rasters.length !== 2
    || freezeClock.canonicalPath !== contracts.freezeClock.canonicalPath
    || timeUp.canonicalPath !== contracts.timeUp.canonicalPath
  ) {
    throw new Error(
      'Creator returned incomplete GN Style TimeManager resources',
    );
  }
  return Object.freeze({
    assetTree,
    freezeClock,
    rasterCount: 2,
    timeManagerFont,
    timeUp,
  });
}

function loadGnStyleTimeManagerFont(
  bundle: AssetManager.Bundle,
): Promise<Font> {
  const bundlePath = canonicalResourceToBundlePath(
    GN_STYLE_TIME_MANAGER_FONT_PATH,
  );
  return new Promise((resolve, reject) => {
    bundle.load(bundlePath, Cocos.Font, (error, font) => {
      if (error !== null && error !== undefined) {
        reject(new Error(
          `Failed to load GN Style TimeManager font: ${error.message}`,
        ));
        return;
      }
      if (font === null || font === undefined) {
        reject(new Error(
          `Creator returned no GN Style TimeManager font for ${
            GN_STYLE_TIME_MANAGER_FONT_PATH
          }`,
        ));
        return;
      }
      resolve(font);
    });
  });
}

function collectCleanupFailure(
  failures: unknown[],
  action: () => void,
): void {
  try {
    action();
  } catch (error) {
    failures.push(error);
  }
}

function cleanupError(
  label: string,
  failures: readonly unknown[],
): Error {
  const error = new Error(
    `${label} failed: ${failures.map(errorMessage).join('; ')}`,
  );
  Object.defineProperty(error, 'failures', {
    configurable: false,
    enumerable: false,
    value: Object.freeze([...failures]),
    writable: false,
  });
  return error;
}

function aggregateWithPrimary(
  label: string,
  primary: unknown,
  failures: readonly unknown[],
): Error {
  const error = new Error(
    `${label}: ${errorMessage(primary)}; rollback: `
    + failures.map(errorMessage).join('; '),
  );
  Object.defineProperties(error, {
    cause: {
      configurable: false,
      enumerable: false,
      value: primary,
      writable: false,
    },
    failures: {
      configurable: false,
      enumerable: false,
      value: Object.freeze([...failures]),
      writable: false,
    },
  });
  return error;
}

function reportCleanupFailures(
  label: string,
  failures: readonly unknown[],
): void {
  if (failures.length > 0) {
    console.error(cleanupError(label, failures));
  }
}

function normalizeError(error: unknown, fallback: string): Error {
  return error instanceof Error
    ? error
    : new Error(`${fallback}: ${String(error)}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function assertSignedInt32(value: number, label: string): void {
  if (
    !Number.isInteger(value)
    || value < -2_147_483_648
    || value > 2_147_483_647
  ) {
    throw new RangeError(`${label} must be a signed int32`);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported GN Style command: ${String(value)}`);
}
