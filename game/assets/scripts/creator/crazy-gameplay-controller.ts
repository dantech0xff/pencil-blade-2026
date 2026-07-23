import {
  _decorator,
  Component,
  Node,
  isValid,
} from 'cc';

import {
  buildBidirectionalRayPlan,
  createCutDispatchCommands,
  type CutQueryHit,
} from '../domain/classic-cut-query';
import type { BladeMoveResult } from '../domain/blade-tracks';
import {
  CLASSIC_MENU_BUTTON_AUDIO_PATH,
  CLASSIC_OBJECTIVE_CHEER_AUDIO_PATH,
  getClassicComboAudioPath,
  getClassicFruitCutAudioSequence,
  getClassicOrdinaryBombAudioPath,
  getClassicResultRankAudioPath,
} from '../domain/classic-audio-contract';
import type {
  BaseGameplayPauseObjectiveCard,
} from '../domain/base-gameplay-pause-state';
import {
  CLASSIC_SWISH_COOLDOWN_ACTION_SECONDS,
  ClassicSwishAudioGate,
} from '../domain/classic-swish-audio-gate';
import { createClassicCriticalParticleUpdateCommands } from '../domain/classic-critical-particle-plan';
import { createClassicCutHalfMotion } from '../domain/classic-cut-half-motion';
import {
  ClassicSpawnPlanner,
  type ClassicTossSound,
} from '../domain/classic-spawn-planner';
import {
  applyComboCommandBatch,
  ComboService,
  type ComboCommand,
} from '../domain/combo-service';
import {
  CRAZY_DOUBLE_SCORE_AUDIO_PATH,
  CRAZY_SPECIAL_FRUIT_BASE_CUT_AUDIO_PATH,
  executeCrazyBombElectricHitAudio,
  type CrazyAudioCommand,
} from '../domain/crazy-audio-contract';
import {
  createCrazyFruitCutCommands,
  type CrazyFruitCutCommand,
} from '../domain/crazy-fruit-cut';
import {
  CRAZY_RESULT_MENU_BUTTON_AUDIO_PATH,
  createCrazyResultNavigationCommands,
  type CrazyResultNavigationCommand,
} from '../domain/crazy-result-navigation';
import {
  CRAZY_RESULT_MODE_ID,
  crazyLeaderboardPanelValues,
  insertCrazyResultScore,
} from '../domain/crazy-result-ranking';
import {
  partitionCrazyRuntimeCommands,
  type CrazyRuntimeCommandBatch,
} from '../domain/crazy-runtime-command-batches';
import type {
  CrazySessionCommand,
  CrazySessionSnapshot,
} from '../domain/crazy-session';
import type { CrazyTossControllerId } from '../domain/crazy-toss-config';
import {
  CrazyTossCoordinator,
  type CrazyTossRuntimeCommand,
} from '../domain/crazy-toss-coordinator';
import { BonusManagerState } from '../domain/bonus-manager-state';
import type { GameplayRandom } from '../domain/gameplay-random';
import type { ScoreCommand } from '../domain/score-service';
import {
  sampleSpawnKinematics,
} from '../domain/spawn-kinematics';
import {
  StandardBombExplosionCompletion,
} from '../domain/standard-bomb-explosion-completion';
import type {
  ObjectiveAchievementPopupEvent,
  ObjectivesManagerState,
} from '../domain/objectives-manager-state';
import {
  CLASSIC_BLADE_BEGAN_EVENT,
  CLASSIC_BLADE_ENDED_EVENT,
  CLASSIC_BLADE_MOVED_EVENT,
  type ClassicBladeBeganEvent,
  type ClassicBladeEndedEvent,
} from './blade-input-controller';
import { BaseGameplayPausePresenter } from './base-gameplay-pause-presenter';
import {
  loadBaseGameplayResources,
  type LoadedBaseGameplayResources,
} from './base-gameplay-resource-loader';
import type {
  ClassicGeneratedBomb,
  ClassicGeneratedBombCutEvent,
} from './classic-generated-bomb';
import type {
  ClassicGeneratedFruitCutEvent,
  ClassicGeneratedFruitMissEvent,
} from './classic-generated-fruit';
import { ClassicBladePresenter } from './classic-blade-presenter';
import type { ClassicRetainedAudioHandle } from './classic-audio-presenter';
import { ComboItemPresenter } from './combo-item-presenter';
import { ClassicCriticalParticlePresenter } from './classic-critical-particle-presenter';
import { ClassicCutHalfPresenter } from './classic-cut-half-presenter';
import {
  ClassicGameplayController,
  type ClassicScreenPlacementPort,
} from './classic-gameplay-controller';
import type { ClassicSliceResourceCatalog } from './classic-resource-loader';
import { ClassicResultPresenter } from './classic-result-presenter';
import { ClassicSceneController } from './classic-scene-controller';
import { ClassicScoreHudPresenter } from './classic-score-hud-presenter';
import type {
  ClassicSettingsRuntime,
} from './classic-settings-runtime';
import { CrazyAudioPresenter, type CrazyRetainedAudioHandle } from './crazy-audio-presenter';
import { CrazyBombElectricPresenter } from './crazy-bomb-electric-presenter';
import { loadCrazyDragonFont, type LoadedCrazyDragonFont } from './crazy-dragon-font-loader';
import {
  CrazyElectricContactAdapter,
  type CrazyElectricBombContactTarget,
} from './crazy-electric-contact-adapter';
import {
  CrazyEntityRegistry,
  type BonusEnableCommand,
  type BonusTossAudioCommand,
  type CrazyEntityDisposedEvent,
} from './crazy-entity-registry';
import type {
  CrazyGeneratedDragonCriticalParticleEvent,
  CrazyGeneratedDragonFruitFinishedEvent,
  CrazyGeneratedDragonFruitObjectiveEvent,
  CrazyGeneratedDragonFruitPlayEffectEvent,
} from './crazy-generated-dragon-fruit';
import type {
  CrazyGeneratedSpecialFruitCutEvent,
  CrazyGeneratedSpecialFruitMissEvent,
} from './crazy-generated-special-fruit';
import { CrazyIntroPresenter } from './crazy-intro-presenter';
import { CrazyMagnetPresenter } from './crazy-magnet-presenter';
import {
  CRAZY_PHYSICS_STEPPED_EVENT,
  CRAZY_SESSION_COMMAND_EVENT,
  CrazySceneController,
  type CrazyPhysicsSteppedEvent,
  type CrazyTimeUpFinishParticipant,
} from './crazy-scene-controller';
import {
  loadCrazyResources,
  type LoadedCrazyResources,
} from './crazy-resource-loader';
import { createDetachedScreenRoot } from './detached-screen-root';
import { ObjectiveAchievementPresenter } from './objective-achievement-presenter';
import { StandardBombExplosionPresenter } from './standard-bomb-explosion-presenter';
import { StandardBombFuseSmokePresenter } from './standard-bomb-fuse-smoke-presenter';
import { TimeManagerPresenter } from './time-manager-presenter';

const { ccclass, requireComponent } = _decorator;

export const CRAZY_GAMEPLAY_COMMAND_EVENT = 'crazy-gameplay-command';
export const CRAZY_GAMEPLAY_SNAPSHOT_EVENT = 'crazy-gameplay-snapshot';
export const CRAZY_PAUSE_QUIT_REQUESTED_EVENT = 'crazy-pause-quit-requested';
export const CRAZY_PAUSE_REPLAY_FAILED_EVENT = 'crazy-pause-replay-failed';
export const CRAZY_RESOURCE_LOAD_FAILED_EVENT = 'crazy-resource-load-failed';
export const CRAZY_RESULT_MENU_REQUESTED_EVENT = 'crazy-result-menu-requested';
export const CRAZY_RESULT_RETRY_FAILED_EVENT = 'crazy-result-retry-failed';
export const CRAZY_RESULT_REWARD_READY_EVENT = 'crazy-result-reward-ready';

export type CrazyGameplayReadinessStatus =
  | 'failed'
  | 'idle'
  | 'pending'
  | 'ready';

export interface CrazyGameplayReadiness {
  readonly error: Error | null;
  readonly status: CrazyGameplayReadinessStatus;
}

export interface CrazyGameplaySnapshot {
  readonly activeDragonEffectCount: number;
  readonly activeEntityCount: number;
  readonly displayedScore: number;
  readonly lifecycle: CrazySessionSnapshot['lifecycle'];
  readonly pendingStandardBombCount: number;
  readonly readiness: CrazyGameplayReadinessStatus;
  readonly resultActive: boolean;
  readonly score: number;
}

export interface CrazyPauseQuitRequestedEvent {
  readonly crazyRoot: Node;
  commit(previousRoot: Node): void;
  rollback(): void;
}

export interface CrazyPauseReplayFailedEvent {
  readonly message: string;
  readonly reason: 'restart-error';
}

export interface CrazyResultMenuRequestedEvent {
  readonly completedRunScore: number;
  readonly resultRoot: Node;
  commit(previousRoot: Node): void;
  rollback(): void;
}

export interface CrazyResultRetryFailedEvent {
  readonly message: string;
  readonly reason: 'restart-error';
}

export interface CrazyResultRewardReadyEvent {
  readonly bonusCoins: number;
  readonly completedRunScore: number;
  readonly totalCoins: number;
}

export type CrazyScreenPlacementPort = ClassicScreenPlacementPort;

interface CrazyViewport {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

interface CrazyResultConfiguration {
  readonly mode: typeof CRAZY_RESULT_MODE_ID;
  readonly score: number;
}

interface CrazyPendingResultConfiguration {
  mode?: typeof CRAZY_RESULT_MODE_ID;
  score?: number;
}

interface CrazyResultMenuTransaction {
  readonly presenter: ClassicResultPresenter;
  readonly root: Node;
  readonly screenPlacement: CrazyScreenPlacementPort;
  status: 'committed' | 'pending' | 'rolled-back';
}

interface CrazyResultEntryTransaction {
  configuration: CrazyResultConfiguration | null;
  readonly crazyRoot: Node;
  presenter: ClassicResultPresenter | null;
  root: Node | null;
  status: 'committed' | 'pending' | 'prepared' | 'rolled-back';
}

interface CrazyPauseQuitTransaction {
  readonly presenter: BaseGameplayPausePresenter;
  readonly root: Node;
  readonly screenPlacement: CrazyScreenPlacementPort;
  status: 'committed' | 'pending' | 'rolled-back';
}

interface CrazyCutPresentationEvent {
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
  readonly visuals: Parameters<typeof ClassicCutHalfPresenter.create>[0]['visuals'];
  readonly worldPosition: Readonly<{ readonly x: number; readonly y: number }>;
}

interface CrazyPreparationProducts {
  readonly audio: CrazyAudioPresenter;
  readonly baseGameplayResources: LoadedBaseGameplayResources;
  readonly dragonFont: LoadedCrazyDragonFont;
  readonly resources: LoadedCrazyResources;
}

interface StandardBombExplosionOwner {
  readonly completion: StandardBombExplosionCompletion;
  readonly presenter: StandardBombExplosionPresenter;
}

interface CrazyRunOwnership {
  readonly bladePresenter: ClassicBladePresenter | null;
  readonly bonusManager: BonusManagerState;
  readonly bombElectricPresenter: CrazyBombElectricPresenter | null;
  readonly combo: ComboService | null;
  readonly comboItemPresenters: Set<ComboItemPresenter>;
  readonly coordinator: CrazyTossCoordinator | null;
  readonly crazyModeRoot: Node | null;
  readonly criticalCutHalfPresenters: Set<ClassicCutHalfPresenter>;
  readonly criticalParticlePresenters: Set<ClassicCriticalParticlePresenter>;
  readonly cutHalfPresenters: Set<ClassicCutHalfPresenter>;
  readonly doubleTossLoop: CrazyRetainedAudioHandle | null;
  readonly electricContactAdapter: CrazyElectricContactAdapter | null;
  readonly introPresenter: CrazyIntroPresenter | null;
  readonly magnetPresenters: Set<CrazyMagnetPresenter>;
  readonly pausePresenter: BaseGameplayPausePresenter | null;
  readonly pendingCapturedCrazyRoot: Node | null;
  readonly pendingResultConfiguration: CrazyPendingResultConfiguration | null;
  readonly registry: CrazyEntityRegistry | null;
  readonly scoreHudPresenter: ClassicScoreHudPresenter | null;
  readonly scoreHudRoot: Node | null;
  readonly standardBombEntryAudioHandles: Map<string, ClassicRetainedAudioHandle>;
  readonly standardBombExplosionOwners: Map<string, StandardBombExplosionOwner>;
  readonly standardBombFuseSmokePresenters: Map<string, StandardBombFuseSmokePresenter>;
  readonly swishAudio: ClassicSwishAudioGate | null;
  readonly timeManagerPresenter: TimeManagerPresenter | null;
  readonly worldPresentationRoot: Node | null;
}

interface CrazyActivationObjectiveRollback {
  readonly objectiveId: 46 | 50;
  readonly value: number;
}

interface RetiredCrazyRunOwnership {
  readonly ownership: CrazyRunOwnership;
  readonly scene: CrazySceneController;
}

/**
 * Production owner for the recovered timed Crazy mode.
 *
 * The serialized component remains passive until the app shell explicitly prepares and
 * activates it. Classic owns the process-lifetime random/settings/catalog/audio services;
 * every run-specific state and presentation below belongs only to Crazy.
 */
@ccclass('CrazyGameplayController')
@requireComponent(CrazySceneController)
export class CrazyGameplayController extends Component {
  private audioPresenter: CrazyAudioPresenter | null = null;
  private baseGameplayResources: LoadedBaseGameplayResources | null = null;
  private bladePresenter: ClassicBladePresenter | null = null;
  private bonusManager = new BonusManagerState();
  private bombElectricPresenter: CrazyBombElectricPresenter | null = null;
  private classicGameplayController: ClassicGameplayController | null = null;
  private classicSceneController: ClassicSceneController | null = null;
  private combo: ComboService | null = null;
  private comboItemPresenters = new Set<ComboItemPresenter>();
  private coordinator: CrazyTossCoordinator | null = null;
  private crazyModeRoot: Node | null = null;
  private crazyResources: LoadedCrazyResources | null = null;
  private crazySceneController: CrazySceneController | null = null;
  private criticalParticlePresenters = new Set<ClassicCriticalParticlePresenter>();
  private criticalCutHalfPresenters = new Set<ClassicCutHalfPresenter>();
  private cutHalfPresenters = new Set<ClassicCutHalfPresenter>();
  private doubleTossLoop: CrazyRetainedAudioHandle | null = null;
  private dragonFont: LoadedCrazyDragonFont | null = null;
  private electricContactAdapter: CrazyElectricContactAdapter | null = null;
  private introPresenter: CrazyIntroPresenter | null = null;
  private magnetPresenters = new Set<CrazyMagnetPresenter>();
  private readonly objectiveAchievementPresenters = new Set<
    ObjectiveAchievementPresenter
  >();
  private objectiveAchievementTargetRoot: Node | null = null;
  private objectivesManager: ObjectivesManagerState | null = null;
  private pausePresenter: BaseGameplayPausePresenter | null = null;
  private pendingCapturedCrazyRoot: Node | null = null;
  private pendingResultEntryTransaction: CrazyResultEntryTransaction | null = null;
  private pendingResultConfiguration: CrazyPendingResultConfiguration | null = null;
  private preparation: Promise<void> | null = null;
  private preparationError: Error | null = null;
  private readinessStatus: CrazyGameplayReadinessStatus = 'idle';
  private registry: CrazyEntityRegistry | null = null;
  private resultPresenter: ClassicResultPresenter | null = null;
  private resultPresentationRoot: Node | null = null;
  private readonly retiredCrazyRuns: RetiredCrazyRunOwnership[] = [];
  private scoreHudPresenter: ClassicScoreHudPresenter | null = null;
  private scoreHudRoot: Node | null = null;
  private screenPlacement: CrazyScreenPlacementPort | null = null;
  private shuttingDown = false;
  private standbyCrazySceneController: CrazySceneController | null = null;
  private standardBombExplosionOwners = new Map<
    string,
    StandardBombExplosionOwner
  >();
  private standardBombFuseSmokePresenters = new Map<
    string,
    StandardBombFuseSmokePresenter
  >();
  private standardBombEntryAudioHandles = new Map<
    string,
    ClassicRetainedAudioHandle
  >();
  private swishAudio: ClassicSwishAudioGate | null = null;
  private timeManagerPresenter: TimeManagerPresenter | null = null;
  private worldPresentationRoot: Node | null = null;

  onLoad(): void {
    const crazySceneController = this.getComponent(CrazySceneController);
    if (crazySceneController === null) {
      throw new Error('CrazyGameplayController requires CrazySceneController');
    }
    const classicGameplayController = this.getComponent(ClassicGameplayController);
    if (classicGameplayController === null) {
      throw new Error(
        'CrazyGameplayController requires the sibling ClassicGameplayController process owner',
      );
    }
    const classicSceneController = this.getComponent(ClassicSceneController);
    if (classicSceneController === null) {
      throw new Error(
        'CrazyGameplayController requires the sibling ClassicSceneController resolution owner',
      );
    }
    this.crazySceneController = crazySceneController;
    this.classicGameplayController = classicGameplayController;
    this.classicSceneController = classicSceneController;
  }

  onEnable(): void {
    this.node.on(CLASSIC_BLADE_BEGAN_EVENT, this.onBladeBegan, this);
    this.node.on(CLASSIC_BLADE_MOVED_EVENT, this.onBladeMoved, this);
    this.node.on(CLASSIC_BLADE_ENDED_EVENT, this.onBladeEnded, this);
    this.node.on(CRAZY_PHYSICS_STEPPED_EVENT, this.onPhysicsStepped, this);
    this.node.on(CRAZY_SESSION_COMMAND_EVENT, this.onSessionCommand, this);
  }

  start(): void {
    // Intentionally passive. Preparation does not take the current-screen/input/physics lease.
    this.emitSnapshot();
  }

  update(deltaSeconds: number): void {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    for (const presenter of this.objectiveAchievementPresenters) {
      presenter.updateAction(deltaSeconds);
    }
    if (this.pendingResultEntryTransaction === null) {
      this.resultPresenter?.updateAction(deltaSeconds);
    }

    if (!this.isCrazyGameplayAttached()) {
      return;
    }

    this.bladePresenter?.updateFrame();
    for (const presenter of [...this.comboItemPresenters]) {
      presenter.updateAction(deltaSeconds);
    }
    const lifecycleAtFrameStart = this.requireCrazySceneController()
      .sessionSnapshot().lifecycle;
    this.introPresenter?.updateAction(deltaSeconds);
    if (!this.isCrazyGameplayAttached()) {
      return;
    }

    this.timeManagerPresenter?.updateAction(deltaSeconds);
    this.bombElectricPresenter?.updateAction(deltaSeconds);
    for (const presenter of [...this.magnetPresenters]) {
      presenter.updateAction(deltaSeconds);
      if (presenter.state.phase === 'disposed') {
        this.magnetPresenters.delete(presenter);
      }
    }
    for (const [targetId, presenter] of [...this.standardBombFuseSmokePresenters]) {
      presenter.updateAction(deltaSeconds);
      if (presenter.snapshot().drained) {
        // Dispose before deleting so a failed generated-frame cleanup remains retryable.
        presenter.dispose();
        this.standardBombFuseSmokePresenters.delete(targetId);
      }
    }
    const explosionFailures: unknown[] = [];
    for (const owner of [...this.standardBombExplosionOwners.values()]) {
      collectCleanupFailure(
        explosionFailures,
        () => owner.presenter.updateAction(deltaSeconds),
      );
    }
    collectCleanupFailure(
      explosionFailures,
      () => this.drainFinishedStandardBombExplosions(),
    );
    if (explosionFailures.length > 0) {
      throw cleanupError('Crazy standard Bomb explosion update', explosionFailures);
    }
    this.registry?.updateDragonEffectsAction(deltaSeconds);
    for (const presenter of [...this.cutHalfPresenters]) {
      presenter.updateAction(deltaSeconds);
    }
    for (const presenter of [...this.criticalParticlePresenters]) {
      presenter.updateAction(deltaSeconds);
    }
    this.scoreHudPresenter?.updateAction(deltaSeconds);
    this.pausePresenter?.updateAction(deltaSeconds);

    // A GO callback that lands inside this action update starts the graph for the next host
    // frame; it does not inherit the delta already consumed by the intro.
    if (lifecycleAtFrameStart === 'intro') {
      this.updateScorePresentation();
      this.emitSnapshot();
      return;
    }

    const lifecycle = this.requireCrazySceneController().sessionSnapshot().lifecycle;
    if (lifecycle === 'running') {
      this.timeManagerPresenter?.updateScheduler(deltaSeconds);
    }
    if (lifecycle === 'running' || lifecycle === 'time-up') {
      this.coordinator?.tick(deltaSeconds);
      this.applyComboCommands(
        this.requireCombo().update(deltaSeconds, this.effectsEnabled()),
      );
    }
    this.updateScorePresentation();
    this.emitSnapshot();
  }

  onDisable(): void {
    this.node.off(CLASSIC_BLADE_BEGAN_EVENT, this.onBladeBegan, this);
    this.node.off(CLASSIC_BLADE_MOVED_EVENT, this.onBladeMoved, this);
    this.node.off(CLASSIC_BLADE_ENDED_EVENT, this.onBladeEnded, this);
    this.node.off(CRAZY_PHYSICS_STEPPED_EVENT, this.onPhysicsStepped, this);
    this.node.off(CRAZY_SESSION_COMMAND_EVENT, this.onSessionCommand, this);
  }

  onDestroy(): void {
    if (this.shuttingDown) {
      return;
    }
    this.shuttingDown = true;
    this.unschedule(this.onSwishCooldownComplete);
    const failures: unknown[] = [];
    collectCleanupFailure(failures, () => this.disposeCrazyModePresentation());
    collectCleanupFailure(failures, () => this.drainRetiredCrazyRunOwnership());
    collectCleanupFailure(failures, () => this.disposeResultPresentation());
    collectCleanupFailure(failures, () => this.disposeCrazyPreparation());
    this.screenPlacement = null;
    this.preparation = null;
    reportCleanupFailures('Crazy gameplay teardown', failures);
  }

  get readiness(): CrazyGameplayReadiness {
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

  /**
   * Process-owned supplemental catalogs are shared by the three Bird modes.
   * Their gameplay owners remain mutually exclusive under the app-shell screen lease.
   */
  get sharedBaseGameplayResources(): LoadedBaseGameplayResources {
    return this.requireBaseGameplayResources();
  }

  get sharedCrazyAudioPresenter(): CrazyAudioPresenter {
    return this.requireCrazyAudioPresenter();
  }

  get sharedCrazyDragonFont(): LoadedCrazyDragonFont {
    return this.requireDragonFont();
  }

  get sharedCrazyResources(): LoadedCrazyResources {
    return this.requireCrazyResources();
  }

  get sharedObjectivesManager(): ObjectivesManagerState {
    return this.requireObjectivesManager();
  }

  snapshot(): CrazyGameplaySnapshot {
    const session = this.crazySceneController?.sessionSnapshot()
      ?? Object.freeze({
        lifecycle: 'intro',
        score: Object.freeze({ authoritativeScore: 0, displayedScore: 0 }),
      });
    return Object.freeze({
      activeDragonEffectCount: this.registry?.activeDragonEffectCount ?? 0,
      activeEntityCount: this.registry?.size ?? 0,
      displayedScore: session.score.displayedScore,
      lifecycle: session.lifecycle,
      pendingStandardBombCount: this.standardBombExplosionOwners.size,
      readiness: this.readinessStatus,
      resultActive: this.resultPresentationRoot !== null,
      score: session.score.authoritativeScore,
    });
  }

  /**
   * Loads the exact Crazy supplement after the process-owned Classic catalog is ready.
   * Failed attempts leave no committed partial owner and can be retried by calling again.
   */
  prepareCrazyRuntime(): Promise<void> {
    if (this.shuttingDown || !isValid(this.node, true)) {
      throw new Error('Crazy runtime cannot be prepared after destruction');
    }
    if (this.readinessStatus === 'ready') {
      return this.preparation ?? Promise.resolve();
    }
    if (this.preparation !== null) {
      return this.preparation;
    }

    this.readinessStatus = 'pending';
    this.preparationError = null;
    const attempt = this.initializeCrazyPreparation();
    this.preparation = attempt;
    void attempt.catch((error: unknown) => {
      if (this.preparation === attempt) {
        this.preparation = null;
      }
      const failure = normalizeError(error, 'Crazy runtime preparation failed');
      this.preparationError = failure;
      this.readinessStatus = 'failed';
      if (!this.shuttingDown && isValid(this.node, true)) {
        this.node.emit(CRAZY_RESOURCE_LOAD_FAILED_EVENT, failure);
        console.error(failure);
      }
    });
    return attempt;
  }

  /** Compatibility name for shell preparation owners that use the Classic lifecycle shape. */
  prepareRecoveredRuntime(): Promise<void> {
    return this.prepareCrazyRuntime();
  }

  private async initializeCrazyPreparation(): Promise<void> {
    const classic = this.requireClassicGameplayController();
    await classic.prepareRecoveredRuntime();
    this.assertPreparationStillUsable();

    const classicCatalog = classic.sharedResourceCatalog;
    const resolution = this.requireResolution();
    if (classicCatalog.assetTree !== resolution.profile.assetTree) {
      throw new Error('Crazy and Classic process catalogs must use the same asset tree');
    }

    // Neither raster/font loader attaches a node. Load both before the audio owner so any
    // earlier rejection has no Creator attachment to unwind.
    const [resources, dragonFont, baseGameplayResources] = await Promise.all([
      loadCrazyResources(classicCatalog.assetTree),
      loadCrazyDragonFont(),
      loadBaseGameplayResources(classicCatalog.assetTree),
    ]);
    this.assertPreparationStillUsable();
    const audio = await CrazyAudioPresenter.load(this.node);
    let committed = false;
    try {
      this.assertPreparationStillUsable();
      const products: CrazyPreparationProducts = {
        audio,
        baseGameplayResources,
        dragonFont,
        resources,
      };
      this.commitCrazyPreparation(products);
      committed = true;
    } finally {
      if (!committed) {
        const failures: unknown[] = [];
        collectCleanupFailure(failures, () => audio.stop());
        collectCleanupFailure(failures, () => destroyNamedChild(this.node, 'CrazyAudioRoot'));
        reportCleanupFailures('Crazy partial preparation', failures);
      }
    }
  }

  private commitCrazyPreparation(products: CrazyPreparationProducts): void {
    if (
      this.audioPresenter !== null
      || this.baseGameplayResources !== null
      || this.crazyResources !== null
      || this.dragonFont !== null
      || this.objectivesManager !== null
      || this.objectiveAchievementTargetRoot !== null
    ) {
      throw new Error('Crazy preparation products can commit only once');
    }
    if (
      products.baseGameplayResources.assetTree
      !== products.resources.assetTree
    ) {
      throw new Error('Crazy base-gameplay resources must share the exact asset tree');
    }
    const objectiveTarget = new Node('ObjectiveAchievementTargetRoot');
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
    this.audioPresenter = products.audio;
    this.baseGameplayResources = products.baseGameplayResources;
    this.crazyResources = products.resources;
    this.dragonFont = products.dragonFont;
    this.objectiveAchievementTargetRoot = objectiveTarget;
    this.objectivesManager = objectivesManager;
    this.readinessStatus = 'ready';
    this.preparationError = null;
  }

  /** App-shell entry. The current-screen host must already be transactionally empty. */
  activateCrazyFromAppShell(screenPlacement: CrazyScreenPlacementPort): void {
    assertScreenPlacementPort(screenPlacement);
    if (this.shuttingDown) {
      throw new Error('Crazy runtime cannot activate after destruction');
    }
    if (this.readinessStatus !== 'ready') {
      throw new Error('Crazy runtime must be fully prepared before activation');
    }
    const retainedPlacement = this.screenPlacement;
    if (retainedPlacement !== null && retainedPlacement !== screenPlacement) {
      throw new Error('Crazy runtime must reuse its process screen-placement owner');
    }
    // A committed Pause Quit can leave a released run in the retryable cleanup backlog.
    // Drain it before deciding whether this controller is eligible to own another run.
    this.drainRetiredCrazyRunOwnership();
    if (screenPlacement.currentScreen !== null) {
      throw new Error('Crazy runtime requires an empty current-screen host');
    }
    if (
      this.crazyModeRoot !== null
      || this.resultPresentationRoot !== null
      || this.resultPresenter !== null
    ) {
      throw new Error('Crazy runtime requires fully released run presentation');
    }

    this.screenPlacement = screenPlacement;
    let objectiveRollback: CrazyActivationObjectiveRollback | null = null;
    try {
      this.constructCrazyMode();
      objectiveRollback = this.captureCrazyActivationObjectiveRollback();
      this.attachCrazyModeAndActivateScene(screenPlacement);
      this.updateScorePresentation();
      this.emitSnapshot();
    } catch (error) {
      const failures: unknown[] = [];
      collectCleanupFailure(failures, () => this.disposeCrazyModePresentation());
      if (objectiveRollback !== null) {
        const retainedObjectiveRollback = objectiveRollback;
        collectCleanupFailure(
          failures,
          () => this.restoreCrazyActivationObjective(retainedObjectiveRollback),
        );
      }
      if (retainedPlacement === null) {
        this.screenPlacement = null;
      } else {
        this.screenPlacement = retainedPlacement;
      }
      if (failures.length > 0) {
        throw aggregateWithPrimary('Crazy activation rollback failed', error, failures);
      }
      throw error;
    }
  }

  private constructCrazyMode(): void {
    if (this.crazyModeRoot !== null) {
      throw new Error('Crazy mode can be constructed only from an empty run owner');
    }
    const resources = this.requireCrazyResources();
    const classic = this.requireClassicGameplayController();
    const viewport = this.requireViewport();
    const scene = this.requireCrazySceneController();
    const random = classic.sharedGameplayRandom;
    const settings = classic.sharedSettingsRuntime;
    const classicCatalog = classic.sharedResourceCatalog;
    const root = createDetachedScreenRoot('CrazyModeRoot', this.node);
    this.crazyModeRoot = root;
    this.worldPresentationRoot = createPresenterRoot(root, 'CrazyWorldPresentationRoot');
    this.scoreHudRoot = createPresenterRoot(root, 'CrazyScoreHudRoot');
    this.bonusManager.reset();
    this.pendingCapturedCrazyRoot = null;
    this.pendingResultConfiguration = null;
    this.combo = new ComboService(random);
    this.swishAudio = new ClassicSwishAudioGate(random);

    try {
      this.registry = new CrazyEntityRegistry({
        callAfterStep: (mutation) => scene.callAfterPhysicsStep(mutation),
        classicCatalog,
        crazyResources: resources,
        dragonFont: this.requireDragonFont(),
        dragonRandom: random,
        effectsEnabled: this.effectsEnabled,
        onBeforeBombFreeze: this.onBeforeBombFreeze,
        onBombCut: this.onStandardBombCut,
        onDispose: this.onEntityDisposed,
        onDragonCriticalParticle: this.onDragonCriticalParticle,
        onDragonFinished: this.onDragonFinished,
        onDragonObjective: this.onDragonObjective,
        onDragonPlayEffect: this.onDragonPlayEffect,
        onEnableBonus: this.onEnableBonus,
        onOrdinaryFruitCut: this.onOrdinaryFruitCut,
        onOrdinaryFruitMiss: this.onOrdinaryFruitMiss,
        onPlayBonusTossAudio: this.onPlayBonusTossAudio,
        onPlayTossSound: this.onPlayTossSound,
        onStandardBombAttached: this.startStandardBombAfterAttachment,
        onSpecialFruitCut: this.onSpecialFruitCut,
        onSpecialFruitMiss: this.onSpecialFruitMiss,
        sampleBonusKinematics: (direction, logicalViewport) => (
          sampleSpawnKinematics(direction, logicalViewport, random)
        ),
      });

      const planner = new ClassicSpawnPlanner({
        random,
        sampleKinematics: sampleSpawnKinematics,
      });
      this.coordinator = new CrazyTossCoordinator({
        bonusState: this.bonusManager,
        commandSink: this.onCoordinatorCommands,
        effectsEnabled: this.effectsEnabled,
        planner,
        random,
        viewport: () => this.requireViewport(),
      });

      this.createCorePresentation(
        root,
        this.requireWorldPresentationRoot(),
        this.requireScoreHudRoot(),
        viewport,
        resources,
        settings,
        classicCatalog,
        random,
      );
    } catch (error) {
      const failures: unknown[] = [];
      collectCleanupFailure(failures, () => this.disposeCrazyModePresentation());
      if (failures.length > 0) {
        throw aggregateWithPrimary('Crazy detached construction cleanup failed', error, failures);
      }
      throw error;
    }
  }

  private captureCrazyRunOwnership(): CrazyRunOwnership {
    return {
      bladePresenter: this.bladePresenter,
      bonusManager: this.bonusManager,
      bombElectricPresenter: this.bombElectricPresenter,
      combo: this.combo,
      comboItemPresenters: this.comboItemPresenters,
      coordinator: this.coordinator,
      crazyModeRoot: this.crazyModeRoot,
      criticalCutHalfPresenters: this.criticalCutHalfPresenters,
      criticalParticlePresenters: this.criticalParticlePresenters,
      cutHalfPresenters: this.cutHalfPresenters,
      doubleTossLoop: this.doubleTossLoop,
      electricContactAdapter: this.electricContactAdapter,
      introPresenter: this.introPresenter,
      magnetPresenters: this.magnetPresenters,
      pausePresenter: this.pausePresenter,
      pendingCapturedCrazyRoot: this.pendingCapturedCrazyRoot,
      pendingResultConfiguration: this.pendingResultConfiguration,
      registry: this.registry,
      scoreHudPresenter: this.scoreHudPresenter,
      scoreHudRoot: this.scoreHudRoot,
      standardBombEntryAudioHandles: this.standardBombEntryAudioHandles,
      standardBombExplosionOwners: this.standardBombExplosionOwners,
      standardBombFuseSmokePresenters: this.standardBombFuseSmokePresenters,
      swishAudio: this.swishAudio,
      timeManagerPresenter: this.timeManagerPresenter,
      worldPresentationRoot: this.worldPresentationRoot,
    };
  }

  private createEmptyCrazyRunOwnership(): CrazyRunOwnership {
    return {
      bladePresenter: null,
      bonusManager: new BonusManagerState(),
      bombElectricPresenter: null,
      combo: null,
      comboItemPresenters: new Set<ComboItemPresenter>(),
      coordinator: null,
      crazyModeRoot: null,
      criticalCutHalfPresenters: new Set<ClassicCutHalfPresenter>(),
      criticalParticlePresenters: new Set<ClassicCriticalParticlePresenter>(),
      cutHalfPresenters: new Set<ClassicCutHalfPresenter>(),
      doubleTossLoop: null,
      electricContactAdapter: null,
      introPresenter: null,
      magnetPresenters: new Set<CrazyMagnetPresenter>(),
      pausePresenter: null,
      pendingCapturedCrazyRoot: null,
      pendingResultConfiguration: null,
      registry: null,
      scoreHudPresenter: null,
      scoreHudRoot: null,
      standardBombEntryAudioHandles: new Map<string, ClassicRetainedAudioHandle>(),
      standardBombExplosionOwners: new Map<string, StandardBombExplosionOwner>(),
      standardBombFuseSmokePresenters:
        new Map<string, StandardBombFuseSmokePresenter>(),
      swishAudio: null,
      timeManagerPresenter: null,
      worldPresentationRoot: null,
    };
  }

  private installCrazyRunOwnership(ownership: CrazyRunOwnership): void {
    this.bladePresenter = ownership.bladePresenter;
    this.bonusManager = ownership.bonusManager;
    this.bombElectricPresenter = ownership.bombElectricPresenter;
    this.combo = ownership.combo;
    this.comboItemPresenters = ownership.comboItemPresenters;
    this.coordinator = ownership.coordinator;
    this.crazyModeRoot = ownership.crazyModeRoot;
    this.criticalCutHalfPresenters = ownership.criticalCutHalfPresenters;
    this.criticalParticlePresenters = ownership.criticalParticlePresenters;
    this.cutHalfPresenters = ownership.cutHalfPresenters;
    this.doubleTossLoop = ownership.doubleTossLoop;
    this.electricContactAdapter = ownership.electricContactAdapter;
    this.introPresenter = ownership.introPresenter;
    this.magnetPresenters = ownership.magnetPresenters;
    this.pausePresenter = ownership.pausePresenter;
    this.pendingCapturedCrazyRoot = ownership.pendingCapturedCrazyRoot;
    this.pendingResultConfiguration = ownership.pendingResultConfiguration;
    this.registry = ownership.registry;
    this.scoreHudPresenter = ownership.scoreHudPresenter;
    this.scoreHudRoot = ownership.scoreHudRoot;
    this.standardBombEntryAudioHandles = ownership.standardBombEntryAudioHandles;
    this.standardBombExplosionOwners = ownership.standardBombExplosionOwners;
    this.standardBombFuseSmokePresenters =
      ownership.standardBombFuseSmokePresenters;
    this.swishAudio = ownership.swishAudio;
    this.timeManagerPresenter = ownership.timeManagerPresenter;
    this.worldPresentationRoot = ownership.worldPresentationRoot;
  }

  private acquireStandbyCrazySceneController(
    activeScene: CrazySceneController,
  ): CrazySceneController {
    let standby = this.standbyCrazySceneController;
    if (standby === null || !isValid(standby, true)) {
      const existing = this.node
        .getComponents(CrazySceneController)
        .filter((scene) => scene !== activeScene && isValid(scene, true));
      if (existing.length > 1) {
        throw new Error('Crazy Replay found more than one standby scene lease');
      }
      if (existing.length === 1) {
        [standby] = existing;
      } else {
        try {
          standby = this.node.addComponent(CrazySceneController);
        } catch (error) {
          const cleanupFailures: unknown[] = [];
          for (const partial of this.node.getComponents(CrazySceneController)) {
            if (partial !== activeScene && isValid(partial, true)) {
              collectCleanupFailure(cleanupFailures, () => partial.destroy());
            }
          }
          this.standbyCrazySceneController = null;
          if (cleanupFailures.length > 0) {
            throw aggregateWithPrimary(
              'Crazy standby construction rollback failed',
              error,
              cleanupFailures,
            );
          }
          throw error;
        }
      }
      this.standbyCrazySceneController = standby;
    }
    const liveScenes = this.node
      .getComponents(CrazySceneController)
      .filter((scene) => isValid(scene, true));
    if (
      liveScenes.length !== 2
      || liveScenes.indexOf(activeScene) === -1
      || liveScenes.indexOf(standby) === -1
      || !activeScene.readyForActivation
      || !standby.readyForActivation
      || standby === activeScene
      || standby.active
      || standby.suspended
    ) {
      if (standby !== activeScene && isValid(standby, true)) {
        standby.destroy();
      }
      this.standbyCrazySceneController = null;
      throw new Error('Crazy Replay requires one inactive standby scene lease');
    }
    return standby;
  }

  private restoreRetainedSwishCooldown(ownership: CrazyRunOwnership): void {
    if (ownership.swishAudio?.locked) {
      this.scheduleOnce(
        this.onSwishCooldownComplete,
        CLASSIC_SWISH_COOLDOWN_ACTION_SECONDS,
      );
    }
  }

  private captureCrazyActivationObjectiveRollback():
    CrazyActivationObjectiveRollback | null {
    const manager = this.requireObjectivesManager();
    const active = manager.activeObjective();
    if (active?.id !== 46 && active?.id !== 50) {
      return null;
    }
    return Object.freeze({
      objectiveId: active.id,
      value: manager.value(active.id),
    });
  }

  private restoreCrazyActivationObjective(
    rollback: CrazyActivationObjectiveRollback,
  ): void {
    if (!this.requireObjectivesManager().setValue(
      rollback.objectiveId,
      rollback.value,
    )) {
      throw new Error('Crazy activation could not restore objective progress');
    }
  }

  private drainRetiredCrazyRunOwnership(): void {
    if (this.retiredCrazyRuns.length === 0) {
      return;
    }
    const activeOwnership = this.captureCrazyRunOwnership();
    const activeScene = this.requireCrazySceneController();
    const retained: RetiredCrazyRunOwnership[] = [];
    const failures: unknown[] = [];
    try {
      for (const retired of this.retiredCrazyRuns) {
        this.installCrazyRunOwnership(retired.ownership);
        this.crazySceneController = retired.scene;
        try {
          this.disposeCrazyModePresentation();
        } catch (error) {
          retained.push(Object.freeze({
            ownership: this.captureCrazyRunOwnership(),
            scene: retired.scene,
          }));
          failures.push(error);
        }
      }
    } finally {
      this.installCrazyRunOwnership(activeOwnership);
      this.crazySceneController = activeScene;
      this.retiredCrazyRuns.length = 0;
      this.retiredCrazyRuns.push(...retained);
    }
    if (failures.length > 0) {
      throw cleanupError('Retired Crazy run ownership', failures);
    }
  }

  private createCorePresentation(
    modeRoot: Node,
    worldRoot: Node,
    scoreRoot: Node,
    viewport: CrazyViewport,
    resources: LoadedCrazyResources,
    settings: ClassicSettingsRuntime,
    classicCatalog: ClassicSliceResourceCatalog,
    random: GameplayRandom,
  ): void {
    const visibleRect = createVisibleRect(viewport);
    this.scoreHudPresenter = ClassicScoreHudPresenter.create({
      bestScoreCupResource: classicCatalog.presentation.bestScoreCup,
      doubleScorePanelResource: classicCatalog.presentation.doubleScorePanel,
      fontResource: classicCatalog.scoreFont,
      initialBestScore: settings.state.snapshot.crazyLeaderboard.first,
      scoreIconResource: classicCatalog.presentation.scoreIcon,
      viewport,
    }, {
      onDoubleScoreActiveDelayComplete: this.onDoubleScoreActiveDelayComplete,
      onScoreIconScaleDownComplete: this.onDisplayedScoreScaleDownComplete,
      onScoreIconScaleUpComplete: this.onDisplayedScoreScaleUpComplete,
    });
    this.scoreHudPresenter.attach(scoreRoot);

    this.bladePresenter = ClassicBladePresenter.create({
      assetTree: classicCatalog.assetTree,
      resource: classicCatalog.defaultBlade,
      selectedBladeId: 0,
      viewportWidth: viewport.width,
    });
    this.bladePresenter.attach(worldRoot);

    this.introPresenter = CrazyIntroPresenter.create({
      resources,
      visibleRect,
    }, {
      onComplete: () => this.requireCrazySceneController().completeIntro(),
    });
    this.introPresenter.attach(modeRoot);

    this.timeManagerPresenter = TimeManagerPresenter.create({
      effectsEnabled: this.effectsEnabled,
      logicalHeight: this.requireResolution().profile.designHeight,
      logicalWidth: this.requireResolution().profile.designWidth,
      resources,
      totalSeconds: 60,
      visibleRect,
    }, {
      audio: this.requireCrazyAudioPresenter(),
      disableBonusType: (bonusType) => this.bonusManager.disableBonusType(bonusType),
      onFreezeFinish: () => this.requireCrazySceneController().freezeFinish(),
      onFreezeStart: () => this.requireCrazySceneController().freezeStart(),
      onTimeUp: () => this.requireCrazySceneController().timeUp(),
      onTimeUpFinish: () => this.requireCrazySceneController().timeUpFinish(),
    });
    this.timeManagerPresenter.attach(modeRoot, 1);

    const electricContactAdapter = CrazyElectricContactAdapter
      .create<CrazyElectricBombContactTarget>({
      logicalHeight: this.requireResolution().profile.designHeight,
      logicalWidth: this.requireResolution().profile.designWidth,
      parent: worldRoot,
    }, {
      callAfterStep: (mutation) => this.requireCrazySceneController()
        .callAfterPhysicsStep(mutation),
      onBombContact: this.onElectricBombContact,
      resolveBomb: (collider) => this.registry?.resolveBombCollider(collider) ?? null,
    });
    this.electricContactAdapter = electricContactAdapter;
    this.bombElectricPresenter = CrazyBombElectricPresenter.create({
      effectsEnabled: this.effectsEnabled,
      logicalHeight: this.requireResolution().profile.designHeight,
      logicalWidth: this.requireResolution().profile.designWidth,
      resources,
      visibleRect,
    }, {
      audio: this.requireCrazyAudioPresenter(),
      sensor: electricContactAdapter,
    });
    this.bombElectricPresenter.attach(modeRoot, 1);

    // Keep the shared random identity explicit at every presentation boundary.
    if (random !== this.requireClassicGameplayController().sharedGameplayRandom) {
      throw new Error('Crazy presentation lost the process-owned GameplayRandom');
    }
  }

  private initializePausePresentation(): void {
    if (this.pausePresenter !== null) {
      throw new Error('Crazy pause presentation can initialize only once per run');
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
      presenter.attach(this.requireCrazyModeRoot());
      this.pausePresenter = presenter;
    } catch (error) {
      const failures: unknown[] = [];
      collectCleanupFailure(failures, () => presenter.dispose());
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'Crazy pause initialization rollback failed',
          error,
          failures,
        );
      }
      throw error;
    }
  }

  private currentPauseCard(): BaseGameplayPauseObjectiveCard {
    const card = this.requireObjectivesManager().pauseCard();
    if (card === null) {
      throw new Error('Crazy pause UI requires one active objective');
    }
    return Object.freeze({
      description: card.objective.description,
      progress: card.progressText,
      reward: card.rewardText,
    });
  }

  private readonly onPauseRequested = (): void => {
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
        () => this.requireCrazyAudioPresenter().pauseAllEffects(),
      );
    }
    if (settings.musicEnabled) {
      collectCleanupFailure(
        failures,
        () => this.requireClassicGameplayController()
          .sharedAudioPresenter.pauseBackgroundMusic(),
      );
      collectCleanupFailure(
        failures,
        () => this.requireCrazyAudioPresenter().pauseBackgroundMusic(),
      );
    }
    if (failures.length > 0) {
      throw cleanupError('Crazy Pause audio', failures);
    }
  };

  private readonly onResumeRequested = (): void => {
    this.requirePausePresenter().resumeEgress();
    if (!this.effectsEnabled()) {
      return;
    }
    const failures: unknown[] = [];
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
      () => this.requireCrazyAudioPresenter().resumeAllEffects(),
    );
    // Crazy is native mode 1: Resume intentionally does not resume background music.
    if (failures.length > 0) {
      throw cleanupError('Crazy Resume audio', failures);
    }
  };

  private readonly onPauseReplayRequested = (): void => {
    try {
      this.restartCrazyFromPause();
    } catch (error) {
      const failure = normalizeError(error, 'Crazy Pause Replay failed');
      const payload: CrazyPauseReplayFailedEvent = Object.freeze({
        message: failure.message,
        reason: 'restart-error',
      });
      this.node.emit(CRAZY_PAUSE_REPLAY_FAILED_EVENT, payload);
      console.error(failure);
    }
  };

  private restartCrazyFromPause(): void {
    this.drainRetiredCrazyRunOwnership();
    const effectsEnabled = this.effectsEnabled();
    const placement = this.requireScreenPlacement();
    const oldRoot = this.requireCrazyModeRoot();
    const pause = this.requirePausePresenter();
    const oldScene = this.requireCrazySceneController();
    if (placement.currentScreen !== oldRoot || !oldScene.active) {
      throw new Error('Crazy Pause Replay requires the attached active gameplay run');
    }

    let oldOwnership = this.captureCrazyRunOwnership();
    let freshInstalled = false;
    let freshRoot: Node | null = null;
    let freshScene: CrazySceneController | null = null;
    let objectiveRollback: CrazyActivationObjectiveRollback | null = null;
    this.unschedule(this.onSwishCooldownComplete);

    try {
      // Retain the complete old session and its run-owner identities until the fresh scene
      // has entered successfully. The standby scene is created only after the shared leases
      // are released, because its onLoad participates in the same BladeInput owner.
      oldScene.suspendCrazyLayerForNavigation();
      freshScene = this.acquireStandbyCrazySceneController(oldScene);
      this.installCrazyRunOwnership(this.createEmptyCrazyRunOwnership());
      this.crazySceneController = freshScene;
      freshInstalled = true;
      this.constructCrazyMode();
      freshRoot = this.requireDetachedCrazyModeRoot();

      const audioFailures: unknown[] = [];
      // Native Replay stops background music before effects and before pause egress.
      collectCleanupFailure(
        audioFailures,
        () => this.requireClassicGameplayController()
          .sharedAudioPresenter.stopBackgroundMusic(),
      );
      collectCleanupFailure(
        audioFailures,
        () => this.requireCrazyAudioPresenter().stopBackgroundMusic(),
      );
      collectCleanupFailure(
        audioFailures,
        () => this.requireClassicGameplayController()
          .sharedAudioPresenter.stopAllEffects(),
      );
      collectCleanupFailure(
        audioFailures,
        () => this.requireCrazyAudioPresenter().stopAllEffects(),
      );
      // stopAllEffects owns and disposes the retained loop voice. A failed later transition
      // may restore the old run, but it must never reinstall that disposed handle.
      oldOwnership = Object.freeze({
        ...oldOwnership,
        doubleTossLoop: null,
      });
      if (audioFailures.length > 0) {
        throw cleanupError('Crazy Pause Replay audio', audioFailures);
      }

      pause.resumeEgress();
      pause.stopAllActions();
      const previous = placement.replaceCurrentScreen(freshRoot);
      if (
        previous !== oldRoot
        || oldRoot.parent !== null
        || placement.currentScreen !== freshRoot
      ) {
        throw new Error('Crazy Pause Replay replaced an unexpected gameplay screen');
      }

      const best = this.sharedSettingsRuntime.state.snapshot.crazyLeaderboard.first;
      objectiveRollback = this.captureCrazyActivationObjectiveRollback();
      freshScene.activateCrazyLayer(best);
      this.updateScorePresentation();
      oldScene.finalizeSuspendedCrazyLayerRelease();
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      if (freshInstalled && freshScene !== null) {
        collectCleanupFailure(rollbackFailures, () => {
          if (freshScene?.active) {
            freshScene.releaseCrazyLayerForReplacement();
          }
        });
        collectCleanupFailure(rollbackFailures, () => {
          const current = placement.currentScreen;
          if (current === oldRoot) {
            return;
          }
          if (!isValid(oldRoot, true) || oldRoot.parent !== null) {
            throw new Error('Crazy Pause Replay rollback lost the old gameplay root');
          }
          if (current === null) {
            placement.attachCurrentScreen(oldRoot);
          } else {
            const displaced = placement.replaceCurrentScreen(oldRoot);
            if (freshRoot !== null && displaced !== freshRoot) {
              throw new Error(
                'Crazy Pause Replay rollback displaced an unexpected fresh screen',
              );
            }
          }
        });
        try {
          this.disposeCrazyModePresentation();
        } catch (cleanupFailure) {
          rollbackFailures.push(cleanupFailure);
          if (!freshScene.active && !freshScene.suspended) {
            this.retiredCrazyRuns.push(Object.freeze({
              ownership: this.captureCrazyRunOwnership(),
              scene: freshScene,
            }));
          } else {
            rollbackFailures.push(new Error(
              'Crazy Pause Replay rollback could not retain an active fresh scene',
            ));
          }
        }
      }
      if (objectiveRollback !== null) {
        const retainedObjectiveRollback = objectiveRollback;
        collectCleanupFailure(
          rollbackFailures,
          () => this.restoreCrazyActivationObjective(retainedObjectiveRollback),
        );
      }

      this.installCrazyRunOwnership(oldOwnership);
      this.crazySceneController = oldScene;
      if (freshScene !== null && freshScene !== oldScene) {
        this.standbyCrazySceneController = freshScene;
      }
      collectCleanupFailure(rollbackFailures, () => {
        if (placement.currentScreen === null) {
          placement.attachCurrentScreen(oldRoot);
        }
        if (placement.currentScreen !== oldRoot) {
          throw new Error('Crazy Pause Replay rollback could not restore gameplay');
        }
      });
      collectCleanupFailure(rollbackFailures, () => {
        if (oldScene.suspended) {
          oldScene.resumeSuspendedCrazyLayer();
        }
      });
      collectCleanupFailure(
        rollbackFailures,
        () => pause.pauseIngress(this.currentPauseCard()),
      );
      collectCleanupFailure(
        rollbackFailures,
        () => this.restoreRetainedSwishCooldown(oldOwnership),
      );
      if (rollbackFailures.length > 0) {
        throw aggregateWithPrimary(
          'Crazy Pause Replay rollback failed',
          error,
          rollbackFailures,
        );
      }
      throw error;
    }

    if (freshScene === null) {
      throw new Error('Committed Crazy Pause Replay lost its fresh scene lease');
    }

    // Fresh construction, foreground replacement, session entry, and score projection have
    // all committed. Drain the detached old owner against its inactive scene seam, then keep
    // that finalized scene as the sole standby for the next Replay.
    const freshOwnership = this.captureCrazyRunOwnership();
    const committedCleanupFailures: unknown[] = [];
    try {
      this.installCrazyRunOwnership(oldOwnership);
      this.crazySceneController = oldScene;
      try {
        this.disposeCrazyModePresentation();
      } catch (error) {
        committedCleanupFailures.push(error);
        this.retiredCrazyRuns.push(Object.freeze({
          ownership: this.captureCrazyRunOwnership(),
          scene: oldScene,
        }));
      }
    } finally {
      this.installCrazyRunOwnership(freshOwnership);
      this.crazySceneController = freshScene;
      this.standbyCrazySceneController = oldScene;
    }

    // Native requests this click only after the fresh Crazy layer has entered its parent.
    if (effectsEnabled) {
      collectCleanupFailure(
        committedCleanupFailures,
        () => this.requireClassicGameplayController().sharedAudioPresenter.playOneShot(
          CLASSIC_MENU_BUTTON_AUDIO_PATH,
        ),
      );
    }
    collectCleanupFailure(committedCleanupFailures, () => this.emitSnapshot());
    reportCleanupFailures(
      'Committed Crazy Pause Replay cleanup',
      committedCleanupFailures,
    );
  }

  private readonly onPauseQuitRequested = (): void => {
    const pause = this.requirePausePresenter();
    pause.resumeEgress();
    pause.stopAllActions();
    let root: Node;
    try {
      root = this.requireCrazyModeRoot();
      this.requireCrazySceneController().suspendCrazyLayerForNavigation();
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      collectCleanupFailure(
        rollbackFailures,
        () => pause.pauseIngress(this.currentPauseCard()),
      );
      if (rollbackFailures.length > 0) {
        throw aggregateWithPrimary(
          'Crazy Pause Quit suspension rollback failed',
          error,
          rollbackFailures,
        );
      }
      throw error;
    }
    const transaction: CrazyPauseQuitTransaction = {
      presenter: pause,
      root,
      screenPlacement: this.requireScreenPlacement(),
      status: 'pending',
    };
    const payload: CrazyPauseQuitRequestedEvent = Object.freeze({
      crazyRoot: root,
      commit: (previousRoot: Node) => (
        this.commitPauseQuit(transaction, previousRoot)
      ),
      rollback: () => this.rollbackPauseQuit(transaction),
    });
    try {
      this.node.emit(CRAZY_PAUSE_QUIT_REQUESTED_EVENT, payload);
    } finally {
      // Node events are synchronous. A missing/rejecting/throwing shell must not leave
      // gameplay resumed behind an options menu whose actions were cancelled.
      if (transaction.status === 'pending') {
        this.rollbackPauseQuit(transaction);
      }
    }
  };

  private commitPauseQuit(
    transaction: CrazyPauseQuitTransaction,
    previousRoot: Node,
  ): void {
    if (previousRoot !== transaction.root) {
      throw new Error('Crazy Pause Quit commit received an unexpected previous screen');
    }
    if (transaction.status === 'committed') {
      return;
    }
    if (transaction.status === 'rolled-back') {
      throw new Error('Rolled-back Crazy Pause Quit transaction cannot commit');
    }
    if (
      this.crazyModeRoot !== transaction.root
      || this.pausePresenter !== transaction.presenter
      || transaction.root.parent !== null
      || transaction.screenPlacement.currentScreen === null
      || transaction.screenPlacement.currentScreen === transaction.root
    ) {
      throw new Error('Crazy Pause Quit commit requires a successful screen replacement');
    }

    const releasedScene = this.requireCrazySceneController();
    releasedScene.finalizeSuspendedCrazyLayerRelease();
    transaction.status = 'committed';
    const failures: unknown[] = [];
    try {
      this.disposeCrazyModePresentation();
    } catch (error) {
      failures.push(error);
      this.retiredCrazyRuns.push(Object.freeze({
        ownership: this.captureCrazyRunOwnership(),
        scene: releasedScene,
      }));
    } finally {
      // The shell owns the committed destination. Publish an empty active owner even when the
      // released run still needs best-effort cleanup so a later Crazy entry can drain it first.
      this.installCrazyRunOwnership(this.createEmptyCrazyRunOwnership());
    }
    if (this.effectsEnabled()) {
      collectCleanupFailure(
        failures,
        () => this.requireClassicGameplayController()
          .sharedAudioPresenter.playOneShot(CLASSIC_MENU_BUTTON_AUDIO_PATH),
      );
    }
    reportCleanupFailures('Committed Crazy Pause Quit cleanup', failures);
    this.emitSnapshot();
  }

  private rollbackPauseQuit(transaction: CrazyPauseQuitTransaction): void {
    if (transaction.status === 'rolled-back') {
      return;
    }
    if (transaction.status === 'committed') {
      throw new Error('Committed Crazy Pause Quit transaction cannot roll back');
    }
    if (
      this.crazyModeRoot !== transaction.root
      || this.pausePresenter !== transaction.presenter
      || !isValid(transaction.root, true)
    ) {
      throw new Error('Crazy Pause Quit rollback lost gameplay ownership');
    }
    const current = transaction.screenPlacement.currentScreen;
    if (current !== transaction.root) {
      if (transaction.root.parent !== null) {
        throw new Error('Crazy Pause Quit rollback found gameplay under an unknown owner');
      }
      if (current === null) {
        transaction.screenPlacement.attachCurrentScreen(transaction.root);
      } else {
        transaction.screenPlacement.replaceCurrentScreen(transaction.root);
      }
    }
    if (transaction.screenPlacement.currentScreen !== transaction.root) {
      throw new Error('Crazy Pause Quit rollback could not restore gameplay');
    }
    this.requireCrazySceneController().resumeSuspendedCrazyLayer();
    transaction.presenter.pauseIngress(this.currentPauseCard());
    transaction.status = 'rolled-back';
    this.emitSnapshot();
  }

  private readonly onObjectiveAchievement = (
    event: ObjectiveAchievementPopupEvent,
  ): void => {
    if (this.effectsEnabled()) {
      // Native requests cheer before allocating either banner or any particle owner.
      this.requireClassicGameplayController().sharedAudioPresenter.playOneShot(
        CLASSIC_OBJECTIVE_CHEER_AUDIO_PATH,
      );
    }
    const viewport = this.requireViewport();
    const presenter = ObjectiveAchievementPresenter.create({
      event,
      random: this.sharedGameplayRandom,
      resources: this.requireBaseGameplayResources(),
      viewport,
    });
    try {
      presenter.attach(this.requireObjectiveAchievementTargetRoot());
      this.objectiveAchievementPresenters.add(presenter);
    } catch (error) {
      const failures: unknown[] = [];
      collectCleanupFailure(failures, () => presenter.dispose());
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'Crazy objective achievement rollback failed',
          error,
          failures,
        );
      }
      throw error;
    }
  };

  private attachCrazyModeAndActivateScene(
    screenPlacement: CrazyScreenPlacementPort,
  ): void {
    const root = this.requireDetachedCrazyModeRoot();
    screenPlacement.attachCurrentScreen(root);
    if (screenPlacement.currentScreen !== root) {
      throw new Error('Crazy current-screen placement lost the attached mode root');
    }
    const best = this.sharedSettingsRuntime.state.snapshot.crazyLeaderboard.first;
    this.requireCrazySceneController().activateCrazyLayer(best);
  }

  private readonly onCoordinatorCommands = (
    commands: readonly CrazyTossRuntimeCommand[],
  ): void => {
    this.emitCommands(commands);
    for (const batch of partitionCrazyRuntimeCommands(commands)) {
      this.applyCoordinatorBatch(batch);
    }
    this.emitSnapshot();
  };

  private applyCoordinatorBatch(batch: CrazyRuntimeCommandBatch): void {
    switch (batch.kind) {
      case 'classic-spawn':
        this.applyClassicSpawnPlan(batch.plan);
        return;
      case 'bonus-spawn':
        this.requireRegistry().applyBonusSpawnBatch(
          batch.commands,
          this.requireWorldPresentationRoot(),
          this.requireViewport(),
        );
        return;
      case 'control':
        this.applyCoordinatorControl(batch.command);
        return;
      default:
        throwUnexpectedCoordinatorBatch(batch);
    }
  }

  private applyClassicSpawnPlan(
    plan: Extract<
      CrazyRuntimeCommandBatch,
      Readonly<{ kind: 'classic-spawn' }>
    >['plan'],
  ): void {
    this.requireRegistry().applySpawnPlan(
      plan,
      this.requireWorldPresentationRoot(),
      this.requireViewport(),
    );
  }

  private applyCoordinatorControl(command: CrazyTossRuntimeCommand): void {
    switch (command.type) {
      case 'request-double-toss-strum-audio':
        this.requireCrazyAudioPresenter().playOneShot(command.canonicalPath);
        return;
      case 'request-double-toss-loop-audio':
        this.doubleTossLoop = this.requireCrazyAudioPresenter()
          .playLoopingEffect(command.canonicalPath);
        return;
      case 'stop-double-toss-loop-audio':
        this.doubleTossLoop?.stop();
        this.doubleTossLoop = null;
        return;
      case 'disable-bonus':
        this.bonusManager.disableBonusType(command.bonusId);
        return;
      default:
        // Timer/child lifecycle and delayed-callback commands are already owned by the pure
        // coordinator. Their public emission above is the exact Creator observation boundary.
        return;
    }
  }

  private readonly onSessionCommand = (command: CrazySessionCommand): void => {
    this.emitCommand(command);
    switch (command.type) {
      case 'reset-bonus-manager':
        this.bonusManager.reset();
        break;
      case 'process-objective':
        this.requireObjectivesManager().processGameEvent(
          command.eventId,
          command.state,
        );
        break;
      case 'construct-controller':
      case 'attach-controller':
        this.assertCoordinatorContains(command.controller);
        break;
      case 'attach-time-manager':
        this.requireTimeManagerPresenter().activate();
        break;
      case 'create-intro-sixty':
        this.requireIntroPresenter().activate();
        break;
      case 'construct-bomb-electric':
      case 'attach-bomb-electric':
        this.requireBombElectricPresenter();
        break;
      case 'initialize-pause-ui':
        this.initializePausePresentation();
        break;
      case 'initialize-best-score':
        if (command.score !== this.sharedSettingsRuntime.state.snapshot.crazyLeaderboard.first) {
          throw new Error('Crazy best-score initialization lost the shared settings value');
        }
        break;
      case 'start-time-manager':
        this.requireTimeManagerPresenter().start();
        break;
      case 'start-controller':
        this.requireCoordinator().startController(command.controller);
        break;
      case 'stop-controller':
        this.requireCoordinator().stopController(command.controller);
        break;
      case 'stop-electric-bomb':
        this.requireBombElectricPresenter().stop();
        break;
      case 'start-double-score-presentation':
      case 'finish-double-score-presentation':
      case 'start-displayed-score-scale-up':
      case 'start-displayed-score-scale-down':
      case 'disable-bonus':
        this.applyScoreCommand(command);
        break;
      case 'stop-effects':
        this.stopAllCrazyRunEffects();
        break;
      case 'capture-crazy-parent':
        this.captureCrazyForResult();
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
      case 'remove-crazy':
        this.detachCrazyForResult(command.cleanup);
        break;
      case 'attach-result':
        this.attachCrazyResult(command.zOrder);
        break;
      default:
        break;
    }
    this.updateScorePresentation();
    this.emitSnapshot();
  };

  private readonly onBladeBegan = (event: ClassicBladeBeganEvent): void => {
    if (!this.isCrazyGameplayAttached()) {
      return;
    }
    const presenter = this.bladePresenter;
    if (presenter !== null && !presenter.isClaimed(event.slot)) {
      presenter.begin(event.slot);
    }
  };

  private readonly onBladeMoved = (event: BladeMoveResult): void => {
    if (!this.isCrazyGameplayAttached()) {
      return;
    }
    const presenter = this.bladePresenter;
    if (presenter !== null) {
      if (!presenter.isClaimed(event.segment.slot)) {
        presenter.begin(event.segment.slot);
      }
      presenter.move(event.segment.slot, event.segment.current);
    }
    const swish = this.swishAudio;
    if (swish === null) {
      return;
    }
    for (const instruction of swish.request(
      event.shouldPlaySwish,
      this.effectsEnabled(),
    )) {
      if (instruction.type === 'play-swish-audio') {
        this.requireClassicGameplayController()
          .sharedAudioPresenter.playOneShot(instruction.canonicalPath);
      } else {
        this.scheduleOnce(this.onSwishCooldownComplete, instruction.delaySeconds);
      }
    }
  };

  private readonly onBladeEnded = (event: ClassicBladeEndedEvent): void => {
    if (!this.isCrazyGameplayAttached()) {
      return;
    }
    const presenter = this.bladePresenter;
    if (presenter !== null && presenter.isClaimed(event.slot)) {
      presenter.end(event.slot);
    }
  };

  private readonly onSwishCooldownComplete = (): void => {
    this.swishAudio?.unlock();
  };

  private readonly onPhysicsStepped = (event: CrazyPhysicsSteppedEvent): void => {
    const registry = this.registry;
    if (registry === null || !this.isCrazyGameplayAttached()) {
      return;
    }
    const viewport = this.requireViewport();
    const existingCutHalves = [...this.cutHalfPresenters];
    if (registry.size > 0) {
      registry.runRayQueryCutBatch(() => {
        for (const bladeSegment of event.bladeSegments) {
          const plan = buildBidirectionalRayPlan({
            end: bladeSegment.current,
            start: bladeSegment.previous,
          }, viewport.width);
          if (plan === null) {
            continue;
          }
          const scene = this.requireCrazySceneController();
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
              this.requireCombo().checkCombo(command.position);
            } else {
              registry.cut(command.targetId, command.segment);
            }
          }
        }
      });
      registry.evaluateBounds(viewport);
    }
    registry.updateDragonEffectsPhysics(viewport);
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
    this.presentCutHalves({
      ...event,
      visuals: this.requireClassicGameplayController()
        .sharedResourceCatalog.normalFruit(event.fruitId),
    });
    if (this.effectsEnabled()) {
      for (const path of getClassicFruitCutAudioSequence(event.fruitId, event.critical)) {
        this.requireClassicGameplayController().sharedAudioPresenter.playOneShot(path);
      }
    }
    this.applyFruitCutCommands(
      createCrazyFruitCutCommands(event.worldPosition, event.fruitId, event.score),
    );
  };

  private readonly onSpecialFruitCut = (
    event: CrazyGeneratedSpecialFruitCutEvent,
  ): void => {
    this.presentCutHalves({
      ...event,
      critical: false,
      visuals: event.visuals,
    });
    if (this.effectsEnabled()) {
      this.requireCrazyAudioPresenter().playOneShot(
        CRAZY_SPECIAL_FRUIT_BASE_CUT_AUDIO_PATH,
      );
    }
    this.applyFruitCutCommands(
      createCrazyFruitCutCommands(event.worldPosition, event.fruitId, 10),
    );
  };

  private applyFruitCutCommands(commands: readonly CrazyFruitCutCommand[]): void {
    this.emitCommands(commands);
    for (const command of commands) {
      switch (command.type) {
        case 'enable-double-score':
          if (this.effectsEnabled()) {
            this.requireCrazyAudioPresenter().playOneShot(CRAZY_DOUBLE_SCORE_AUDIO_PATH);
          }
          this.requireCrazySceneController().enableDoubleScore();
          break;
        case 'start-double-toss':
          this.requireCoordinator().startController('b4');
          break;
        case 'freeze-time':
          this.requireTimeManagerPresenter().freeze();
          break;
        case 'start-electric-bomb':
          this.requireBombElectricPresenter().start();
          break;
        case 'create-magnet-animation':
          this.createMagnetPresenter(command.zOrder);
          break;
        case 'add-score':
          this.requireCrazySceneController().addScore(command.value);
          break;
        default:
          throwUnexpectedFruitCutCommand(command);
      }
    }
    this.updateScorePresentation();
    this.emitSnapshot();
  }

  private createMagnetPresenter(zOrder: 1): void {
    const viewport = this.requireViewport();
    let presenter: CrazyMagnetPresenter;
    presenter = CrazyMagnetPresenter.create({
      centerX: viewport.x + viewport.width / 2,
      effectsEnabled: this.effectsEnabled,
      random: this.sharedGameplayRandom,
      resources: this.requireCrazyResources(),
      topY: viewport.y + viewport.height,
    }, {
      audio: this.requireCrazyAudioPresenter(),
      gameplay: {
        onMagnetBegin: () => this.requireCoordinator().magnetBegin(),
        onMagnetEnd: () => this.requireCoordinator().magnetEnd(),
      },
    });
    presenter.attach(this.requireCrazyModeRoot(), zOrder);
    this.magnetPresenters.add(presenter);
  }

  private presentCutHalves(event: CrazyCutPresentationEvent): void {
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
      fruitId: event.fruitId as Parameters<typeof ClassicCutHalfPresenter.create>[0]['fruitId'],
      motion,
      sourceEntityOccurrenceId: event.entityOccurrenceId,
      visuals: event.visuals,
    }, {
      callAfterStep: (mutation) => this.requireCrazySceneController()
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

  private readonly onDragonCriticalParticle = (
    event: CrazyGeneratedDragonCriticalParticleEvent,
  ): void => {
    this.createCriticalParticle(event.command, event.positionWorldUnits);
  };

  private createCriticalParticle(
    command: CrazyGeneratedDragonCriticalParticleEvent['command'],
    positionWorldUnits: Readonly<{ readonly x: number; readonly y: number }>,
  ): void {
    const resource = this.requireClassicGameplayController()
      .sharedResourceCatalog.criticalParticles[command.resourceIndex - 1];
    if (resource === undefined) {
      throw new Error(`Crazy critical particle ${command.resourceIndex} is not loaded`);
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

  private readonly onDragonFinished = (
    event: CrazyGeneratedDragonFruitFinishedEvent,
  ): void => {
    this.requireCrazySceneController().addScore(event.acceptedHitCount);
    this.emitCommand(event);
  };

  private readonly onDragonObjective = (
    event: CrazyGeneratedDragonFruitObjectiveEvent,
  ): void => {
    const command = Object.freeze({
      count: event.amount,
      eventId: event.eventId,
      type: 'process-objective',
    });
    this.emitCommand(command);
    this.requireObjectivesManager().processGameEvent(
      command.eventId,
      command.count,
    );
  };

  private readonly onDragonPlayEffect = (
    event: CrazyGeneratedDragonFruitPlayEffectEvent,
  ): void => {
    if (this.effectsEnabled()) {
      this.requireCrazyAudioPresenter().playOneShot(event.canonicalPath);
    }
  };

  private readonly onOrdinaryFruitMiss = (
    event: ClassicGeneratedFruitMissEvent,
  ): void => {
    this.requireCrazySceneController().fruitFail(event.worldPosition);
  };

  private readonly onSpecialFruitMiss = (
    event: CrazyGeneratedSpecialFruitMissEvent,
  ): void => {
    if (event.tossType === 5) {
      this.requireCrazySceneController().bonusFruitFail(event.worldPosition);
    } else {
      this.requireCrazySceneController().fruitFail(event.worldPosition);
    }
  };

  private readonly onEnableBonus = (command: BonusEnableCommand): void => {
    this.bonusManager.enableBonusType(command.bonusId);
  };

  private readonly onPlayBonusTossAudio = (
    command: BonusTossAudioCommand,
  ): void => {
    this.requireCrazyAudioPresenter().playOneShot(command.canonicalPath);
  };

  private readonly onPlayTossSound = (sound: ClassicTossSound): void => {
    this.requireClassicGameplayController().sharedAudioPresenter.playOneShot(sound);
  };

  private readonly onEntityDisposed = (event: CrazyEntityDisposedEvent): void => {
    const failures: unknown[] = [];
    collectCleanupFailure(
      failures,
      () => this.stopStandardBombFuseSmoke(event.targetId),
    );
    collectCleanupFailure(
      failures,
      () => this.disposeStandardBombEntryAudio(event.targetId),
    );
    this.emitSnapshot();
    if (failures.length > 0) {
      throw cleanupError(`Crazy entity ${event.targetId}`, failures);
    }
  };

  private readonly onBeforeBombFreeze = (
    event: ClassicGeneratedBombCutEvent,
  ): void => {
    try {
      if (this.effectsEnabled()) {
        this.standardBombEntryAudioHandles.get(event.targetId)?.stop();
      }
    } finally {
      this.stopStandardBombFuseSmoke(event.targetId);
    }
    this.emitCommand(Object.freeze({
      targetId: event.targetId,
      type: 'standard-bomb-hold-begin',
    }));
  };

  private readonly onStandardBombCut = (
    event: ClassicGeneratedBombCutEvent,
  ): void => {
    if (this.standardBombExplosionOwners.has(event.targetId)) {
      throw new Error(`Crazy standard Bomb ${event.targetId} already owns an explosion`);
    }
    const viewport = this.requireViewport();
    let owner: StandardBombExplosionOwner;
    const completion = new StandardBombExplosionCompletion();
    const presenter = StandardBombExplosionPresenter.create({
      bombWorldPosition: event.worldPosition,
      random: this.sharedGameplayRandom,
      visibleRect: {
        bottom: viewport.y,
        left: viewport.x,
        right: viewport.x + viewport.width,
        top: viewport.y + viewport.height,
      },
    }, {
      // The presenter makes this callback exactly once before returning from updateAction().
      // It must never perform fallible gameplay work there: stage completion and let the
      // controller retry each remaining session/entity boundary after all presenters update.
      onFinished: () => {
        completion.markNaturalFinish();
      },
    });
    owner = {
      completion,
      presenter,
    };

    let bombHitApplied = false;
    let ownerRegistered = false;
    try {
      // Native Bomb attaches its explosion before notifying the active mode.
      presenter.attach(this.requireWorldPresentationRoot(), 1);
      this.standardBombExplosionOwners.set(event.targetId, owner);
      ownerRegistered = true;
      this.requireCrazySceneController().bombHit(event.worldPosition);
      bombHitApplied = true;
      // The effects gate is intentionally sampled after BombHit, independently from the
      // retained-handle stop gate that ran before the Bomb froze its own body.
      if (this.effectsEnabled()) {
        this.requireClassicGameplayController().sharedAudioPresenter.playOneShot(
          getClassicOrdinaryBombAudioPath('explosion'),
        );
      }
      this.emitSnapshot();
    } catch (error) {
      const failures: unknown[] = [];
      let presenterDisposed = false;
      try {
        presenter.dispose();
        presenterDisposed = true;
      } catch (cleanupFailure) {
        failures.push(cleanupFailure);
      }
      if (
        presenterDisposed
        && ownerRegistered
        && this.standardBombExplosionOwners.get(event.targetId) === owner
      ) {
        this.standardBombExplosionOwners.delete(event.targetId);
      }
      // CrazySession commits cutEnabled=false before scene command/snapshot observers run.
      // Recover that committed boundary even when bombHit() itself surfaced a later failure.
      const bombHitNeedsRecovery = bombHitApplied
        || !this.requireCrazySceneController().sessionSnapshot().cutEnabled;
      if (bombHitNeedsRecovery) {
        try {
          this.requireCrazySceneController().afterBombHit();
        } catch (cleanupFailure) {
          failures.push(cleanupFailure);
        }
      }
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'Crazy standard Bomb explosion handoff rollback failed',
          error,
          failures,
        );
      }
      throw error;
    }
  };

  private drainFinishedStandardBombExplosions(): void {
    const failures: unknown[] = [];
    let changed = false;
    for (const [targetId, owner] of [...this.standardBombExplosionOwners]) {
      if (!owner.completion.snapshot().naturalFinishReached) {
        continue;
      }
      try {
        if (owner.completion.drain({
          afterBombHit: () => this.requireCrazySceneController().afterBombHit(),
          finishBombAfterHit: () => this.requireRegistry()
            .finishBombAfterHit(targetId),
          isBombDisposalCommitted: () => !this.requireRegistry()
            .hasTarget(targetId),
        })) {
          if (this.standardBombExplosionOwners.get(targetId) === owner) {
            this.standardBombExplosionOwners.delete(targetId);
          }
          changed = true;
        }
      } catch (error) {
        failures.push(error);
      }
    }
    if (changed) {
      this.emitSnapshot();
    }
    if (failures.length > 0) {
      throw cleanupError('Crazy standard Bomb explosion finish', failures);
    }
  }

  private disposeStandardBombEntryAudio(targetId: string): void {
    const handle = this.standardBombEntryAudioHandles.get(targetId);
    if (handle === undefined) {
      return;
    }
    handle.dispose();
    if (this.standardBombEntryAudioHandles.get(targetId) === handle) {
      this.standardBombEntryAudioHandles.delete(targetId);
    }
  }

  private readonly startStandardBombAfterAttachment = (
    bomb: ClassicGeneratedBomb,
  ): void => {
    const targetId = bomb.targetId;
    let entryAudioStarted = false;
    let smokePresenter: StandardBombFuseSmokePresenter | null = null;

    try {
      if (!bomb.attached || bomb.node.parent === null || !bomb.node.activeInHierarchy) {
        throw new Error('Crazy standard Bomb must be attached before entry effects start');
      }
      if (
        this.standardBombEntryAudioHandles.has(targetId)
        || this.standardBombFuseSmokePresenters.has(targetId)
      ) {
        throw new Error(`Crazy standard Bomb ${targetId} already owns entry effects`);
      }

      // Bomb::onEnter samples effects independently from the earlier toss-plan gate.
      if (this.effectsEnabled()) {
        const handle = this.requireClassicGameplayController()
          .sharedAudioPresenter.playRetained(
            getClassicOrdinaryBombAudioPath('entry'),
          );
        this.standardBombEntryAudioHandles.set(targetId, handle);
        entryAudioStarted = true;
      }

      smokePresenter = StandardBombFuseSmokePresenter.create({
        bomb,
        random: this.sharedGameplayRandom,
        resource: this.requireClassicGameplayController()
          .sharedResourceCatalog.bombSmoke,
      });
      this.standardBombFuseSmokePresenters.set(targetId, smokePresenter);
    } catch (error) {
      const failures: unknown[] = [];
      if (smokePresenter !== null) {
        const rollbackPresenter = smokePresenter;
        if (this.standardBombFuseSmokePresenters.get(targetId) === rollbackPresenter) {
          this.standardBombFuseSmokePresenters.delete(targetId);
        }
        collectCleanupFailure(failures, () => rollbackPresenter.dispose());
      }
      if (entryAudioStarted) {
        collectCleanupFailure(
          failures,
          () => this.disposeStandardBombEntryAudio(targetId),
        );
      }
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'Crazy standard Bomb entry-effect rollback failed',
          error,
          failures,
        );
      }
      throw error;
    }
  };

  private stopStandardBombFuseSmoke(targetId: string): void {
    this.standardBombFuseSmokePresenters.get(targetId)?.stopEmitting();
  }

  private readonly onElectricBombContact = (
    _target: CrazyElectricBombContactTarget,
  ): void => {
    executeCrazyBombElectricHitAudio(this.effectsEnabled(), {
      drawRandomIntInclusive: ({ minimum, maximum }) => (
        this.sharedGameplayRandom.nextIntInclusive(minimum, maximum)
      ),
      executeAudioCommand: (command) => this.executeCrazyAudioCommand(command),
    });
  };

  private executeCrazyAudioCommand(command: CrazyAudioCommand): void {
    if (command.type === 'play-effect') {
      if (command.loop) {
        this.requireCrazyAudioPresenter().playLoopingEffect(command.canonicalPath);
      } else {
        this.requireCrazyAudioPresenter().playOneShot(command.canonicalPath);
      }
      return;
    }
    if (command.type === 'play-background-music') {
      this.requireCrazyAudioPresenter().playElectricBackgroundMusic();
      return;
    }
    if (command.type === 'stop-background-music') {
      this.requireCrazyAudioPresenter().stopBackgroundMusic();
      return;
    }
    if (command.type === 'stop-all-effects') {
      this.requireCrazyAudioPresenter().stopAllEffects();
      return;
    }
    if (command.type === 'stop-effect') {
      this.doubleTossLoop?.stop();
      this.doubleTossLoop = null;
    }
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
              throw new Error('Crazy combo batch created more than one pending ComboItem');
            }
            const classic = this.requireClassicGameplayController();
            let presenter: ComboItemPresenter;
            presenter = ComboItemPresenter.create({
              count: command.count,
              fontResource: classic.sharedResourceCatalog.comboFont,
              position: command.position,
              viewportWidth: this.requireViewport().width,
            }, {
              onDisposed: () => this.comboItemPresenters.delete(presenter),
            });
            pendingPresenter = presenter;
            return;
          }
          case 'add-score':
            this.requireCrazySceneController().addScore(command.value);
            return;
          case 'attach-combo-item': {
            if (command.zOrder !== 1 || pendingPresenter === null) {
              throw new Error(
                'Crazy combo attachment requires one pending z-order-1 ComboItem',
              );
            }
            const presenter = pendingPresenter;
            presenter.attach(this.requireWorldPresentationRoot());
            this.comboItemPresenters.add(presenter);
            pendingPresenter = null;
            return;
          }
          case 'play-combo-sound':
            this.requireClassicGameplayController().sharedAudioPresenter.playOneShot(
              getClassicComboAudioPath(command.soundIndex),
            );
            return;
          case 'reset-combo':
            combo.commitPendingUpdate(commands);
            return;
          default:
            throwUnexpectedComboCommand(command);
        }
      },
      finalize: () => {
        const presenter = pendingPresenter;
        pendingPresenter = null;
        presenter?.dispose();
      },
      publish: (command) => {
        this.emitCommand(command);
      },
    });
  }

  private applyScoreCommand(command: ScoreCommand): void {
    switch (command.type) {
      case 'start-double-score-presentation':
        this.requireScoreHudPresenter().startDoubleScorePanelIntro(
          command.introDurationSeconds,
          command.activeDelaySeconds,
        );
        return;
      case 'finish-double-score-presentation':
        this.requireScoreHudPresenter().startDoubleScorePanelExit(
          command.exitDurationSeconds,
        );
        return;
      case 'start-displayed-score-scale-up':
        this.requireScoreHudPresenter().startScoreIconScaleUp(
          command.durationSeconds,
          command.targetScale,
        );
        return;
      case 'start-displayed-score-scale-down':
        this.requireScoreHudPresenter().startScoreIconScaleDown(
          command.durationSeconds,
          command.targetScale,
        );
        return;
      case 'disable-bonus':
        this.bonusManager.disableBonusType(command.bonusId);
        return;
      default:
        throwUnexpectedScoreCommand(command);
    }
  }

  private readonly onDisplayedScoreScaleUpComplete = (): void => {
    this.requireCrazySceneController().completeDisplayedScoreScaleUp();
    this.updateScorePresentation();
  };

  private readonly onDisplayedScoreScaleDownComplete = (): void => {
    this.requireCrazySceneController().completeDisplayedScoreScaleDown();
  };

  private readonly onDoubleScoreActiveDelayComplete = (): void => {
    // CrazyScene exposes the public disable path over the same ScoreService flush boundary.
    this.requireCrazySceneController().disableDoubleScore();
    this.updateScorePresentation();
  };

  private updateScorePresentation(): void {
    const score = this.crazySceneController?.sessionSnapshot().score;
    if (score === undefined) {
      return;
    }
    this.scoreHudPresenter?.setDisplayedScore(score.displayedScore);
    this.scoreHudPresenter?.setBestScore(
      Math.max(
        this.sharedSettingsRuntime.state.snapshot.crazyLeaderboard.first,
        score.authoritativeScore,
      ),
      score.authoritativeScore
        > this.sharedSettingsRuntime.state.snapshot.crazyLeaderboard.first,
    );
    this.scoreHudPresenter?.setPendingDoubleScore(score.pendingDoubleScore);
  }

  private stopAllCrazyRunEffects(): void {
    const failures: unknown[] = [];
    collectCleanupFailure(failures, () => this.requireCrazyAudioPresenter().stopAllEffects());
    collectCleanupFailure(failures, () => (
      this.requireClassicGameplayController().sharedAudioPresenter.stopAllEffects()
    ));
    this.doubleTossLoop = null;
    if (failures.length > 0) {
      throw cleanupError('Crazy stop-all-effects', failures);
    }
  }

  private captureCrazyForResult(): void {
    const root = this.requireCrazyModeRoot();
    if (
      this.pendingCapturedCrazyRoot !== null
      || this.pendingResultEntryTransaction !== null
      || this.resultPresenter !== null
      || this.resultPresentationRoot !== null
    ) {
      throw new Error('Crazy Result parent can be captured only once');
    }
    const transaction: CrazyResultEntryTransaction = {
      configuration: null,
      crazyRoot: root,
      presenter: null,
      root: null,
      status: 'pending',
    };
    this.pendingCapturedCrazyRoot = root;
    this.pendingResultEntryTransaction = transaction;
    const participant: CrazyTimeUpFinishParticipant = Object.freeze({
      prepareCommit: () => this.prepareCrazyResultCommit(transaction),
      commit: () => this.commitCrazyResultTransition(transaction),
      rollback: () => this.rollbackCrazyResultTransition(transaction),
    });
    try {
      this.requireCrazySceneController().enlistTimeUpFinishParticipant(participant);
    } catch (error) {
      this.pendingCapturedCrazyRoot = null;
      this.pendingResultEntryTransaction = null;
      throw error;
    }
  }

  private beginResultConstruction(): void {
    if (this.pendingResultConfiguration !== null) {
      throw new Error('Crazy Result construction can begin only once');
    }
    this.pendingResultConfiguration = {};
  }

  private setPendingResultMode(mode: typeof CRAZY_RESULT_MODE_ID): void {
    if (
      this.pendingResultConfiguration === null
      || this.pendingResultConfiguration.mode !== undefined
      || mode !== CRAZY_RESULT_MODE_ID
    ) {
      throw new Error('Crazy Result mode requires one mode-1 construction');
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
      || !Number.isSafeInteger(score)
    ) {
      throw new Error('Crazy Result score requires one safe-integer construction');
    }
    this.pendingResultConfiguration = {
      ...this.pendingResultConfiguration,
      score,
    };
  }

  private configuredResult(): CrazyResultConfiguration {
    const pending = this.pendingResultConfiguration;
    if (
      pending === null
      || pending.mode !== CRAZY_RESULT_MODE_ID
      || pending.score === undefined
    ) {
      throw new Error('Crazy Result must be constructed, mode-set, and score-set first');
    }
    return Object.freeze({ mode: pending.mode, score: pending.score });
  }

  private detachCrazyForResult(cleanup: true): void {
    if (cleanup !== true) {
      throw new Error('Crazy Result removal requires cleanup');
    }
    this.configuredResult();
    const root = this.requireCrazyModeRoot();
    if (this.pendingCapturedCrazyRoot !== root) {
      throw new Error('Crazy Result removal lost the captured Crazy parent');
    }
    const detached = this.requireScreenPlacement().detachCurrentScreen(root);
    if (detached !== root || root.parent !== null) {
      throw new Error('Crazy Result removal detached an unexpected current screen');
    }
  }

  private attachCrazyResult(zOrder: 1): void {
    const configured = this.configuredResult();
    const transaction = this.requirePendingCrazyResultTransition();
    if (
      zOrder !== 1
      || this.resultPresenter !== null
      || this.resultPresentationRoot !== null
      || this.requireScreenPlacement().currentScreen !== null
      || transaction.crazyRoot !== this.pendingCapturedCrazyRoot
      || transaction.status !== 'pending'
    ) {
      throw new Error('Crazy Result must attach once to an empty host at z-order 1');
    }
    transaction.configuration = configured;
    const settings = this.sharedSettingsRuntime;
    const ranking = insertCrazyResultScore(
      configured.score,
      settings.state.snapshot.crazyLeaderboard,
    );
    const classic = this.requireClassicGameplayController();
    const catalog = classic.sharedResourceCatalog;
    const presenter = ClassicResultPresenter.create({
      completedRunScore: configured.score,
      fonts: catalog.resultFonts,
      panelValues: crazyLeaderboardPanelValues(ranking.leaderboard),
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
    const root = createDetachedScreenRoot('CrazyResultPresentationRoot', this.node);
    transaction.root = root;
    this.resultPresentationRoot = root;
    this.resultPresenter = presenter;
    this.requireScreenPlacement().attachCurrentScreen(root);
    presenter.attach(root);
  }

  private prepareCrazyResultCommit(transaction: CrazyResultEntryTransaction): void {
    const configured = this.configuredResult();
    const resultRoot = transaction.root;
    const resultPresenter = transaction.presenter;
    if (
      this.pendingResultEntryTransaction !== transaction
      || this.pendingCapturedCrazyRoot !== transaction.crazyRoot
      || resultRoot === null
      || resultPresenter === null
      || this.resultPresentationRoot !== resultRoot
      || this.resultPresenter !== resultPresenter
      || transaction.configuration?.mode !== configured.mode
      || transaction.configuration.score !== configured.score
      || transaction.crazyRoot.parent !== null
      || this.requireScreenPlacement().currentScreen !== resultRoot
    ) {
      throw new Error('Crazy Result can commit only from its provisional attached boundary');
    }
    transaction.status = 'prepared';
  }

  private commitCrazyResultTransition(transaction: CrazyResultEntryTransaction): void {
    if (transaction.status === 'committed') {
      return;
    }
    if (transaction.status !== 'prepared' || transaction.configuration === null) {
      throw new Error('Crazy Result transaction must prepare before commit');
    }
    const configured = transaction.configuration;

    // Result construction already consumed the pure ranking preview. Commit the process-owned
    // leaderboard exactly once only after CrazySession has crossed result-removed, then release
    // the old run owner. Result reward accounting remains presentation-callback owned.
    this.sharedSettingsRuntime.state.recordCrazyResultScore(configured.score);
    transaction.status = 'committed';
    this.pendingResultEntryTransaction = null;

    const retainedResultConfiguration: CrazyPendingResultConfiguration = {
      mode: configured.mode,
      score: configured.score,
    };
    const releasedScene = this.requireCrazySceneController();
    const cleanupFailures: unknown[] = [];
    try {
      this.disposeCrazyModePresentation();
    } catch (error) {
      cleanupFailures.push(error);
      const retainedOwnership = this.captureCrazyRunOwnership();
      this.retiredCrazyRuns.push(Object.freeze({
        ownership: Object.freeze({
          ...retainedOwnership,
          pendingCapturedCrazyRoot: null,
          pendingResultConfiguration: null,
        }),
        scene: releasedScene,
      }));
    } finally {
      // Publish a genuinely empty Crazy owner even if engine cleanup needs another attempt.
      // Result Retry drains retired owners before constructing a fresh run.
      this.installCrazyRunOwnership(this.createEmptyCrazyRunOwnership());
      this.pendingResultConfiguration = retainedResultConfiguration;
    }
    collectCleanupFailure(cleanupFailures, () => this.emitSnapshot());
    reportCleanupFailures('Committed Crazy-to-Result cleanup', cleanupFailures);
  }

  private rollbackCrazyResultTransition(transaction: CrazyResultEntryTransaction): void {
    if (transaction.status === 'rolled-back') {
      return;
    }
    if (transaction.status === 'committed') {
      throw new Error('Committed Crazy Result transaction cannot roll back');
    }
    if (
      this.pendingResultEntryTransaction !== transaction
      || this.pendingCapturedCrazyRoot !== transaction.crazyRoot
      || this.crazyModeRoot !== transaction.crazyRoot
      || !isValid(transaction.crazyRoot, true)
    ) {
      throw new Error('Crazy Result rollback lost its retained Crazy owner');
    }

    const failures: unknown[] = [];
    const placement = this.requireScreenPlacement();
    const resultRoot = transaction.root;
    const resultPresenter = transaction.presenter;
    if (resultRoot !== null && placement.currentScreen === resultRoot) {
      collectCleanupFailure(failures, () => {
        if (placement.detachCurrentScreen(resultRoot) !== resultRoot) {
          throw new Error('Crazy Result rollback detached an unexpected Result');
        }
      });
    }
    if (placement.currentScreen === null) {
      collectCleanupFailure(
        failures,
        () => placement.attachCurrentScreen(transaction.crazyRoot),
      );
    }
    if (placement.currentScreen !== transaction.crazyRoot) {
      failures.push(new Error('Crazy Result rollback could not restore gameplay'));
    }

    this.resultPresentationRoot = null;
    this.resultPresenter = null;
    this.pendingCapturedCrazyRoot = null;
    this.pendingResultConfiguration = null;
    this.pendingResultEntryTransaction = null;
    transaction.status = 'rolled-back';

    if (resultPresenter !== null) {
      collectCleanupFailure(failures, () => resultPresenter.dispose());
    }
    if (resultRoot !== null && isValid(resultRoot, true)) {
      collectCleanupFailure(failures, () => resultRoot.destroy());
    }
    collectCleanupFailure(failures, () => this.emitSnapshot());
    if (failures.length > 0) {
      throw cleanupError('Crazy Result rollback', failures);
    }
  }

  private readonly onResultRetry = (): void => {
    try {
      this.restartCrazyFromResult();
    } catch (error) {
      const failure = normalizeError(error, 'Crazy Retry failed');
      if (this.resultPresenter?.state.navigation === 'retry') {
        this.resultPresenter.rearmNavigationAfterFailure('retry');
      }
      const payload: CrazyResultRetryFailedEvent = Object.freeze({
        message: failure.message,
        reason: 'restart-error',
      });
      this.node.emit(CRAZY_RESULT_RETRY_FAILED_EVENT, payload);
      console.error(failure);
    }
  };

  private restartCrazyFromResult(): void {
    this.drainRetiredCrazyRunOwnership();
    const configured = this.configuredResult();
    const retainedResultConfiguration: CrazyPendingResultConfiguration = {
      mode: configured.mode,
      score: configured.score,
    };
    const resultRoot = this.requireAttachedResultRoot();
    const resultPresenter = this.requireResultPresenter();
    const placement = this.requireScreenPlacement();
    const commands = createCrazyResultNavigationCommands({
      effectsEnabled: this.effectsEnabled(),
      mode: configured.mode,
      route: 'retry',
    });
    let captured = false;
    let detached = false;
    let objectiveRollback: CrazyActivationObjectiveRollback | null = null;
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
              throw new Error('Crazy Retry lost Result before capture');
            }
            captured = true;
            break;
          case 'remove-result':
            if (!captured || command.cleanup !== true) {
              throw new Error('Crazy Retry must capture Result before removal');
            }
            if (placement.detachCurrentScreen(resultRoot) !== resultRoot) {
              throw new Error('Crazy Retry detached an unexpected Result');
            }
            detached = true;
            break;
          case 'construct-crazy':
            if (!detached || !command.fresh) {
              throw new Error('Crazy Retry must remove Result before fresh construction');
            }
            this.constructCrazyMode();
            break;
          case 'attach-crazy-to-captured-parent':
            objectiveRollback = this.captureCrazyActivationObjectiveRollback();
            this.attachCrazyModeAndActivateScene(placement);
            break;
          default:
            throwUnexpectedRetryCommand(command);
        }
      }
    } catch (error) {
      const failures: unknown[] = [];
      collectCleanupFailure(failures, () => this.disposeCrazyModePresentation());
      if (objectiveRollback !== null) {
        const retainedObjectiveRollback = objectiveRollback;
        collectCleanupFailure(
          failures,
          () => this.restoreCrazyActivationObjective(retainedObjectiveRollback),
        );
      }
      this.pendingResultConfiguration = retainedResultConfiguration;
      if (
        detached
        && isValid(resultRoot, true)
        && resultRoot.parent === null
        && placement.currentScreen === null
      ) {
        collectCleanupFailure(failures, () => placement.attachCurrentScreen(resultRoot));
      }
      collectCleanupFailure(failures, () => resultPresenter.rearmNavigationAfterFailure('retry'));
      if (failures.length > 0) {
        throw aggregateWithPrimary('Crazy Retry rollback failed', error, failures);
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
    reportCleanupFailures('Committed Crazy Retry Result cleanup', failures);
    this.emitSnapshot();
  }

  private readonly onResultMenu = (): void => {
    if (this.effectsEnabled()) {
      this.requireClassicGameplayController().sharedAudioPresenter.playOneShot(
        CRAZY_RESULT_MENU_BUTTON_AUDIO_PATH,
      );
    }
    const configured = this.configuredResult();
    const root = this.requireAttachedResultRoot();
    const presenter = this.requireResultPresenter();
    const transaction: CrazyResultMenuTransaction = {
      presenter,
      root,
      screenPlacement: this.requireScreenPlacement(),
      status: 'pending',
    };
    const payload: CrazyResultMenuRequestedEvent = Object.freeze({
      completedRunScore: configured.score,
      resultRoot: root,
      commit: (previousRoot: Node) => this.commitResultMenu(transaction, previousRoot),
      rollback: () => this.rollbackResultMenu(transaction),
    });
    try {
      this.node.emit(CRAZY_RESULT_MENU_REQUESTED_EVENT, payload);
    } finally {
      // Node events are synchronous. If no shell accepts the request, restore the attached
      // Result and rearm its Menu action instead of leaving navigation permanently latched.
      if (transaction.status === 'pending') {
        this.rollbackResultMenu(transaction);
      }
    }
  };

  private commitResultMenu(
    transaction: CrazyResultMenuTransaction,
    previousRoot: Node,
  ): void {
    if (previousRoot !== transaction.root) {
      throw new Error('Crazy Result menu commit received an unexpected previous screen');
    }
    if (transaction.status === 'committed') {
      return;
    }
    if (transaction.status === 'rolled-back') {
      throw new Error('Rolled-back Crazy Result menu transaction cannot commit');
    }
    if (
      this.resultPresentationRoot !== transaction.root
      || this.resultPresenter !== transaction.presenter
      || transaction.root.parent !== null
      || transaction.screenPlacement.currentScreen === null
      || transaction.screenPlacement.currentScreen === transaction.root
    ) {
      throw new Error('Crazy Result menu commit requires a successful screen replacement');
    }
    this.resultPresentationRoot = null;
    this.resultPresenter = null;
    transaction.status = 'committed';
    const failures: unknown[] = [];
    collectCleanupFailure(failures, () => transaction.presenter.dispose());
    collectCleanupFailure(failures, () => {
      if (isValid(transaction.root, true)) {
        transaction.root.destroy();
      }
    });
    reportCleanupFailures('Committed Crazy Result menu cleanup', failures);
  }

  private rollbackResultMenu(transaction: CrazyResultMenuTransaction): void {
    if (transaction.status === 'rolled-back') {
      return;
    }
    if (transaction.status === 'committed') {
      throw new Error('Committed Crazy Result menu transaction cannot roll back');
    }
    if (
      this.resultPresentationRoot !== transaction.root
      || this.resultPresenter !== transaction.presenter
      || !isValid(transaction.root, true)
    ) {
      throw new Error('Crazy Result menu rollback lost Result ownership');
    }
    const current = transaction.screenPlacement.currentScreen;
    if (current !== transaction.root) {
      if (transaction.root.parent !== null) {
        throw new Error('Crazy Result menu rollback found Result under an unknown owner');
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
    ) {
      throw new Error('Crazy Result menu rollback could not restore and rearm Result');
    }
    transaction.status = 'rolled-back';
    this.emitSnapshot();
  }

  private readonly onResultTotalCoinsEntranceComplete = (): number => {
    if (this.pendingResultEntryTransaction !== null) {
      throw new Error('Crazy Result reward cannot commit before Time-Up Finish');
    }
    const configured = this.configuredResult();
    const award = this.sharedSettingsRuntime.state
      .awardCrazyResultCoins(configured.score);
    const payload: CrazyResultRewardReadyEvent = Object.freeze({
      bonusCoins: award.bonusCoins,
      completedRunScore: configured.score,
      totalCoins: award.totalCoins,
    });
    this.node.emit(CRAZY_RESULT_REWARD_READY_EVENT, payload);
    return award.bonusCoins;
  };

  private disposeCrazyModePresentation(): void {
    const failures: unknown[] = [];
    const root = this.crazyModeRoot;
    if (
      root !== null
      && root.parent !== null
      && this.screenPlacement?.currentScreen === root
    ) {
      collectCleanupFailure(failures, () => {
        const detached = this.screenPlacement?.detachCurrentScreen(root);
        if (detached !== root) {
          throw new Error('Crazy teardown detached an unexpected current screen');
        }
      });
    }
    this.unschedule(this.onSwishCooldownComplete);
    this.swishAudio?.unlock();
    this.swishAudio = null;
    const doubleTossLoop = this.doubleTossLoop;
    if (doubleTossLoop !== null) {
      try {
        doubleTossLoop.stop();
        if (this.doubleTossLoop === doubleTossLoop) {
          this.doubleTossLoop = null;
        }
      } catch (error) {
        failures.push(error);
      }
    }
    for (const presenter of [...this.magnetPresenters]) {
      try {
        presenter.dispose();
        this.magnetPresenters.delete(presenter);
      } catch (error) {
        failures.push(error);
      }
    }
    for (const [targetId, owner] of [...this.standardBombExplosionOwners]) {
      try {
        // Explicit teardown intentionally does not synthesize AfterBombHit. The registry
        // drain below owns the frozen Bomb once this visual owner is gone.
        owner.presenter.dispose();
        if (this.standardBombExplosionOwners.get(targetId) === owner) {
          this.standardBombExplosionOwners.delete(targetId);
        }
      } catch (error) {
        failures.push(error);
      }
    }
    for (const [targetId, presenter] of [...this.standardBombFuseSmokePresenters]) {
      try {
        presenter.dispose();
        if (this.standardBombFuseSmokePresenters.get(targetId) === presenter) {
          this.standardBombFuseSmokePresenters.delete(targetId);
        }
      } catch (error) {
        failures.push(error);
      }
    }
    for (const targetId of [...this.standardBombEntryAudioHandles.keys()]) {
      collectCleanupFailure(
        failures,
        () => this.disposeStandardBombEntryAudio(targetId),
      );
    }
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

    const introPresenter = this.introPresenter;
    if (introPresenter !== null) {
      try {
        introPresenter.dispose();
        if (this.introPresenter === introPresenter) {
          this.introPresenter = null;
        }
      } catch (error) {
        failures.push(error);
      }
    }
    const timeManagerPresenter = this.timeManagerPresenter;
    if (timeManagerPresenter !== null) {
      try {
        timeManagerPresenter.dispose();
        if (this.timeManagerPresenter === timeManagerPresenter) {
          this.timeManagerPresenter = null;
        }
      } catch (error) {
        failures.push(error);
      }
    }
    const bombElectricPresenter = this.bombElectricPresenter;
    if (bombElectricPresenter !== null) {
      try {
        bombElectricPresenter.dispose();
        if (this.bombElectricPresenter === bombElectricPresenter) {
          this.bombElectricPresenter = null;
        }
      } catch (error) {
        failures.push(error);
      }
    }
    const electricContactAdapter = this.electricContactAdapter;
    if (electricContactAdapter !== null) {
      try {
        electricContactAdapter.dispose();
        if (this.electricContactAdapter === electricContactAdapter) {
          this.electricContactAdapter = null;
        }
      } catch (error) {
        failures.push(error);
      }
    }
    const bladePresenter = this.bladePresenter;
    if (bladePresenter !== null) {
      try {
        bladePresenter.dispose();
        if (this.bladePresenter === bladePresenter) {
          this.bladePresenter = null;
        }
      } catch (error) {
        failures.push(error);
      }
    }
    const scoreHudPresenter = this.scoreHudPresenter;
    if (scoreHudPresenter !== null) {
      try {
        scoreHudPresenter.dispose();
        if (this.scoreHudPresenter === scoreHudPresenter) {
          this.scoreHudPresenter = null;
        }
      } catch (error) {
        failures.push(error);
      }
    }
    const pausePresenter = this.pausePresenter;
    if (pausePresenter !== null) {
      try {
        pausePresenter.dispose();
        if (this.pausePresenter === pausePresenter) {
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
        // CrazyScene executes this immediately whenever the physics lease is inactive, so
        // post-remove cleanup uses the same safe seam without skipping its final owner.
        registry.disposeAll();
        registryDrained = (
          registry.size === 0
          && registry.activeDragonEffectCount === 0
        );
        if (!registryDrained) {
          failures.push(new Error(
            'Crazy registry drain completed without releasing every entity owner',
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
      && this.doubleTossLoop === null
      && this.magnetPresenters.size === 0
      && this.standardBombExplosionOwners.size === 0
      && this.standardBombFuseSmokePresenters.size === 0
      && this.standardBombEntryAudioHandles.size === 0
      && this.cutHalfPresenters.size === 0
      && this.criticalParticlePresenters.size === 0
      && this.comboItemPresenters.size === 0
      && this.introPresenter === null
      && this.timeManagerPresenter === null
      && this.bombElectricPresenter === null
      && this.electricContactAdapter === null
      && this.bladePresenter === null
      && this.scoreHudPresenter === null
      && this.pausePresenter === null
    );
    if (presentationOwnersDrained) {
      this.criticalCutHalfPresenters.clear();
      this.coordinator = null;
      this.combo = null;
      for (const childRoot of [this.worldPresentationRoot, this.scoreHudRoot]) {
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
        this.crazyModeRoot = null;
        if (this.pendingCapturedCrazyRoot === root) {
          this.pendingCapturedCrazyRoot = null;
        }
      }
    }
    if (failures.length > 0) {
      throw cleanupError('Crazy mode presentation', failures);
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
      collectCleanupFailure(failures, () => this.screenPlacement?.detachCurrentScreen(root));
    }
    collectCleanupFailure(failures, () => this.resultPresenter?.dispose());
    if (root !== null && isValid(root, true)) {
      collectCleanupFailure(failures, () => root.destroy());
    }
    this.resultPresenter = null;
    this.resultPresentationRoot = null;
    if (failures.length > 0) {
      throw cleanupError('Crazy Result presentation', failures);
    }
  }

  private disposeCrazyPreparation(): void {
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
      try {
        if (isValid(objectiveTarget, true)) {
          objectiveTarget.destroy();
        }
        if (this.objectiveAchievementTargetRoot === objectiveTarget) {
          this.objectiveAchievementTargetRoot = null;
        }
      } catch (error) {
        failures.push(error);
      }
    }

    const audio = this.audioPresenter;
    if (audio !== null) {
      try {
        audio.stop();
        destroyNamedChild(this.node, 'CrazyAudioRoot');
        if (this.audioPresenter === audio) {
          this.audioPresenter = null;
        }
      } catch (error) {
        failures.push(error);
      }
    } else {
      collectCleanupFailure(
        failures,
        () => destroyNamedChild(this.node, 'CrazyAudioRoot'),
      );
    }

    const preparationOwnersDrained = (
      this.audioPresenter === null
      && this.objectiveAchievementPresenters.size === 0
      && this.objectiveAchievementTargetRoot === null
    );
    if (preparationOwnersDrained) {
      this.baseGameplayResources = null;
      this.crazyResources = null;
      this.dragonFont = null;
      this.objectivesManager = null;
      this.readinessStatus = this.shuttingDown ? 'idle' : this.readinessStatus;
    }
    if (failures.length > 0) {
      throw cleanupError('Crazy preparation', failures);
    }
  }

  private effectsEnabled = (): boolean => (
    this.classicGameplayController?.sharedSettingsRuntime
      .state.snapshot.effectsEnabled ?? true
  );

  private requireClassicGameplayController(): ClassicGameplayController {
    const controller = this.classicGameplayController;
    if (controller === null) {
      throw new Error('Crazy requires its sibling Classic process owner after onLoad');
    }
    return controller;
  }

  private requireCrazySceneController(): CrazySceneController {
    const controller = this.crazySceneController;
    if (controller === null) {
      throw new Error('Crazy scene controller is unavailable before onLoad');
    }
    return controller;
  }

  private requireResolution(): NonNullable<
    ReturnType<ClassicSceneController['resolutionSnapshot']>
  > {
    const resolution = this.classicSceneController?.resolutionSnapshot();
    if (resolution === null || resolution === undefined) {
      throw new Error('Crazy requires the prepared shared resolution profile');
    }
    return resolution;
  }

  private requireViewport(): CrazyViewport {
    const visibleRect = this.requireResolution().visibleRect;
    return Object.freeze({
      height: visibleRect.height,
      width: visibleRect.width,
      x: visibleRect.x,
      y: visibleRect.y,
    });
  }

  private requireCrazyResources(): LoadedCrazyResources {
    if (this.crazyResources === null) {
      throw new Error('Crazy resources are unavailable before preparation');
    }
    return this.crazyResources;
  }

  private requireBaseGameplayResources(): LoadedBaseGameplayResources {
    if (this.baseGameplayResources === null) {
      throw new Error('Crazy base-gameplay resources are unavailable before preparation');
    }
    return this.baseGameplayResources;
  }

  private requireObjectivesManager(): ObjectivesManagerState {
    if (this.objectivesManager === null) {
      throw new Error('Crazy objectives manager is unavailable before preparation');
    }
    return this.objectivesManager;
  }

  private requireObjectiveAchievementTargetRoot(): Node {
    const root = this.objectiveAchievementTargetRoot;
    if (root === null || !isValid(root, true)) {
      throw new Error('Crazy objective-achievement target is unavailable');
    }
    return root;
  }

  private requireDragonFont(): LoadedCrazyDragonFont {
    if (this.dragonFont === null) {
      throw new Error('Crazy Dragon font is unavailable before preparation');
    }
    return this.dragonFont;
  }

  private requireCrazyAudioPresenter(): CrazyAudioPresenter {
    if (this.audioPresenter === null) {
      throw new Error('Crazy audio is unavailable before preparation');
    }
    return this.audioPresenter;
  }

  private requirePausePresenter(): BaseGameplayPausePresenter {
    if (this.pausePresenter === null) {
      throw new Error('Crazy pause presenter is unavailable before scene entry');
    }
    return this.pausePresenter;
  }

  private requireScreenPlacement(): CrazyScreenPlacementPort {
    if (this.screenPlacement === null) {
      throw new Error('Crazy current-screen placement is unavailable');
    }
    return this.screenPlacement;
  }

  private requireCrazyModeRoot(): Node {
    const root = this.crazyModeRoot;
    if (root === null || !isValid(root, true)) {
      throw new Error('Crazy mode root is unavailable');
    }
    return root;
  }

  private requireDetachedCrazyModeRoot(): Node {
    const root = this.requireCrazyModeRoot();
    if (root.parent !== null) {
      throw new Error('Crazy mode root must be detached before app-shell attachment');
    }
    return root;
  }

  private requireWorldPresentationRoot(): Node {
    const root = this.worldPresentationRoot;
    if (root === null || !isValid(root, true)) {
      throw new Error('Crazy world presentation root is unavailable');
    }
    return root;
  }

  private requireScoreHudRoot(): Node {
    const root = this.scoreHudRoot;
    if (root === null || !isValid(root, true)) {
      throw new Error('Crazy score-HUD root is unavailable');
    }
    return root;
  }

  private requireRegistry(): CrazyEntityRegistry {
    if (this.registry === null) {
      throw new Error('Crazy entity registry is unavailable');
    }
    return this.registry;
  }

  private requireCoordinator(): CrazyTossCoordinator {
    if (this.coordinator === null) {
      throw new Error('Crazy toss coordinator is unavailable');
    }
    return this.coordinator;
  }

  private requireCombo(): ComboService {
    if (this.combo === null) {
      throw new Error('Crazy combo service is unavailable');
    }
    return this.combo;
  }

  private requireIntroPresenter(): CrazyIntroPresenter {
    if (this.introPresenter === null) {
      throw new Error('Crazy intro presenter is unavailable');
    }
    return this.introPresenter;
  }

  private requireTimeManagerPresenter(): TimeManagerPresenter {
    if (this.timeManagerPresenter === null) {
      throw new Error('Crazy TimeManager presenter is unavailable');
    }
    return this.timeManagerPresenter;
  }

  private requireBombElectricPresenter(): CrazyBombElectricPresenter {
    if (this.bombElectricPresenter === null) {
      throw new Error('Crazy BombElectric presenter is unavailable');
    }
    return this.bombElectricPresenter;
  }

  private requireScoreHudPresenter(): ClassicScoreHudPresenter {
    if (this.scoreHudPresenter === null) {
      throw new Error('Crazy score-HUD presenter is unavailable');
    }
    return this.scoreHudPresenter;
  }

  private requireResultPresenter(): ClassicResultPresenter {
    if (this.resultPresenter === null) {
      throw new Error('Crazy Result presenter is unavailable');
    }
    return this.resultPresenter;
  }

  private requirePendingCrazyResultTransition(): CrazyResultEntryTransaction {
    const transaction = this.pendingResultEntryTransaction;
    if (transaction === null || transaction.status !== 'pending') {
      throw new Error('Crazy Result transition is not pending');
    }
    return transaction;
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
      throw new Error('Crazy Result must be the active current screen');
    }
    return root;
  }

  private assertCoordinatorContains(controller: CrazyTossControllerId): void {
    this.requireCoordinator().controllerSnapshot(controller);
  }

  private isCrazyGameplayAttached(): boolean {
    const root = this.crazyModeRoot;
    return (
      root !== null
      && isValid(root, true)
      && root.parent !== null
      && this.screenPlacement?.currentScreen === root
      && root.activeInHierarchy
    );
  }

  private assertPreparationStillUsable(): void {
    if (this.shuttingDown || !isValid(this.node, true)) {
      throw new Error('Crazy runtime preparation completed after destruction');
    }
  }

  private emitCommands(commands: readonly unknown[]): void {
    for (const command of commands) {
      this.emitCommand(command);
    }
  }

  private emitCommand(command: unknown): void {
    if (!this.shuttingDown) {
      this.node.emit(CRAZY_GAMEPLAY_COMMAND_EVENT, command);
    }
  }

  private emitSnapshot(): void {
    if (!this.shuttingDown && isValid(this.node, true)) {
      this.node.emit(CRAZY_GAMEPLAY_SNAPSHOT_EVENT, this.snapshot());
    }
  }
}

function createPresenterRoot(parent: Node, name: string): Node {
  const root = new Node(name);
  root.layer = parent.layer;
  root.setParent(parent);
  return root;
}

function createVisibleRect(viewport: CrazyViewport): Readonly<{
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

function assertScreenPlacementPort(
  screenPlacement: CrazyScreenPlacementPort,
): void {
  if (
    screenPlacement === null
    || typeof screenPlacement !== 'object'
    || typeof screenPlacement.attachCurrentScreen !== 'function'
    || typeof screenPlacement.detachCurrentScreen !== 'function'
    || typeof screenPlacement.replaceCurrentScreen !== 'function'
  ) {
    throw new TypeError('Crazy screen placement must implement the current-screen port');
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function normalizeError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(`${fallback}: ${String(error)}`);
}

function collectCleanupFailure(
  failures: unknown[],
  cleanup: () => unknown,
): void {
  try {
    cleanup();
  } catch (error) {
    failures.push(error);
  }
}

function cleanupError(label: string, failures: readonly unknown[]): Error {
  return new Error(
    `${label} cleanup failed: ${failures.map(errorMessage).join('; ')}`,
  );
}

function aggregateWithPrimary(
  label: string,
  primary: unknown,
  cleanupFailures: readonly unknown[],
): Error {
  return new Error(
    `${label}: ${errorMessage(primary)}; cleanup: `
      + cleanupFailures.map(errorMessage).join('; '),
  );
}

function reportCleanupFailures(label: string, failures: readonly unknown[]): void {
  if (failures.length > 0) {
    console.error(cleanupError(label, failures));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function destroyNamedChild(parent: Node, name: string): void {
  const child = parent.getChildByName(name);
  if (child !== null && isValid(child, true)) {
    child.destroy();
  }
}

function throwUnexpectedCoordinatorBatch(batch: never): never {
  throw new Error(`Unsupported Crazy coordinator batch ${String(batch)}`);
}

function throwUnexpectedComboCommand(command: never): never {
  throw new Error(`Unsupported Crazy Combo command ${String(command)}`);
}

function throwUnexpectedFruitCutCommand(command: never): never {
  throw new Error(`Unsupported Crazy fruit-cut command ${String(command)}`);
}

function throwUnexpectedScoreCommand(command: never): never {
  throw new Error(`Unsupported Crazy score command ${String(command)}`);
}

function throwUnexpectedRetryCommand(command: CrazyResultNavigationCommand): never {
  throw new Error(`Crazy Retry received unsupported command ${command.type}`);
}
