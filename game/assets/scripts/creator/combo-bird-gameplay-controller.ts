import {
  _decorator,
  Component,
  Node,
  isValid,
} from 'cc';

import {
  createCutDispatchCommands,
  type CutQueryHit,
} from '../domain/classic-cut-query';
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
  CLASSIC_SWISH_COOLDOWN_ACTION_SECONDS,
  ClassicSwishAudioGate,
} from '../domain/classic-swish-audio-gate';
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
  applyComboCommandBatch,
  ComboService,
  type ComboCommand,
} from '../domain/combo-service';
import type {
  ComboBirdInstructionCard,
} from '../domain/combo-bird-intro-presentation';
import {
  createComboBirdResultNavigationCommands,
  type ComboBirdResultNavigationCommand,
} from '../domain/combo-bird-result-navigation';
import {
  COMBO_BIRD_RESULT_MODE_ID,
  comboBirdLeaderboardPanelValues,
  insertComboBirdResultScore,
} from '../domain/combo-bird-result-ranking';
import {
  createRecoveredResultObjectiveCommand,
} from '../domain/recovered-result-objective';
import {
  COMBO_BIRD_BLADE_ASSET,
  COMBO_BIRD_BLADE_TYPE,
  COMBO_BIRD_INITIAL_TIME_SECONDS,
  COMBO_BIRD_OBJECTIVE_EVENT_SELECTOR,
  COMBO_BIRD_SETTINGS_BEST_SCORE_KEY,
  type ComboBirdSessionCommand,
  type ComboBirdSessionSnapshot,
} from '../domain/combo-bird-session';
import {
  COMBO_BIRD_TOSS_CREATION_ORDER,
  type ComboBirdTossControllerId,
} from '../domain/combo-bird-toss-config';
import type {
  ComboBirdTossCoordinatorOptions,
  ComboBirdTossRuntimeCommand,
} from '../domain/combo-bird-toss-coordinator';
import type { GameplayRandom } from '../domain/gameplay-random';
import type {
  ObjectiveAchievementPopupEvent,
  ObjectivesManagerState,
} from '../domain/objectives-manager-state';
import {
  sampleSpawnKinematics,
} from '../domain/spawn-kinematics';
import {
  BaseGameplayPausePresenter,
} from './base-gameplay-pause-presenter';
import {
  BIRD_BLADE_TOUCH_BEGAN_EVENT,
  BirdInputController,
  type BirdBladeTouchBeganEvent,
} from './bird-input-controller';
import {
  BirdBladePresenter,
} from './bird-blade-presenter';
import {
  BirdBladeRayAdapter,
  type BirdBladeRaycastBatch,
} from './bird-blade-ray-adapter';
import {
  loadBirdResources,
  type LoadedBirdResources,
} from './bird-resource-loader';
import {
  loadBaseGameplayResources,
  type LoadedBaseGameplayResources,
} from './base-gameplay-resource-loader';
import {
  ClassicCriticalParticlePresenter,
} from './classic-critical-particle-presenter';
import {
  ClassicCutHalfPresenter,
} from './classic-cut-half-presenter';
import {
  ClassicEntityRegistry,
} from './classic-entity-registry';
import type {
  ClassicGeneratedFruitCutEvent,
  ClassicGeneratedFruitMissEvent,
} from './classic-generated-fruit';
import {
  ClassicGameplayController,
  type ClassicScreenPlacementPort,
} from './classic-gameplay-controller';
import {
  ClassicResultPresenter,
} from './classic-result-presenter';
import {
  ClassicSceneController,
} from './classic-scene-controller';
import {
  ClassicScoreHudPresenter,
} from './classic-score-hud-presenter';
import type {
  ClassicSettingsRuntime,
} from './classic-settings-runtime';
import {
  ComboBirdIntroPresenter,
} from './combo-bird-intro-presenter';
import {
  createComboBirdTimeManagerResourcePort,
  loadComboBirdResources,
  type LoadedComboBirdResources,
} from './combo-bird-resource-loader';
import {
  COMBO_BIRD_PHYSICS_STEPPED_EVENT,
  COMBO_BIRD_SESSION_COMMAND_EVENT,
  ComboBirdLifecycleRollbackError,
  ComboBirdSceneController,
  type ComboBirdPhysicsSteppedEvent,
  type ComboBirdTimeUpFinishParticipant,
} from './combo-bird-scene-controller';
import {
  ComboItemPresenter,
} from './combo-item-presenter';
import {
  createDetachedScreenRoot,
} from './detached-screen-root';
import {
  ObjectiveAchievementPresenter,
  reportObjectiveAchievementPresentationFailure,
  updateAndRetireObjectiveAchievementPresenters,
} from './objective-achievement-presenter';
import {
  TimeManagerPresenter,
} from './time-manager-presenter';
import {
  TimeManagerAudioPresenter,
} from './time-manager-audio-presenter';

const { ccclass, requireComponent } = _decorator;

export const COMBO_BIRD_GAMEPLAY_COMMAND_EVENT
  = 'combo-bird-gameplay-command';
export const COMBO_BIRD_GAMEPLAY_SNAPSHOT_EVENT
  = 'combo-bird-gameplay-snapshot';
export const COMBO_BIRD_PAUSE_QUIT_REQUESTED_EVENT
  = 'combo-bird-pause-quit-requested';
export const COMBO_BIRD_PAUSE_REPLAY_FAILED_EVENT
  = 'combo-bird-pause-replay-failed';
export const COMBO_BIRD_RESOURCE_LOAD_FAILED_EVENT
  = 'combo-bird-resource-load-failed';
export const COMBO_BIRD_RESULT_MENU_REQUESTED_EVENT
  = 'combo-bird-result-menu-requested';
export const COMBO_BIRD_RESULT_RETRY_FAILED_EVENT
  = 'combo-bird-result-retry-failed';
export const COMBO_BIRD_RESULT_REWARD_READY_EVENT
  = 'combo-bird-result-reward-ready';

export type ComboBirdScreenPlacementPort = ClassicScreenPlacementPort;

export type ComboBirdGameplayReadinessStatus =
  | 'failed'
  | 'idle'
  | 'pending'
  | 'ready';

export interface ComboBirdGameplayReadiness {
  readonly error: Error | null;
  readonly status: ComboBirdGameplayReadinessStatus;
}

export interface ComboBirdGameplaySnapshot {
  readonly activeEntityCount: number;
  readonly displayedScore: number;
  readonly lifecycle: ComboBirdSessionSnapshot['lifecycle'];
  readonly readiness: ComboBirdGameplayReadinessStatus;
  readonly resultActive: boolean;
  readonly score: number;
}

export interface ComboBirdPauseQuitRequestedEvent {
  readonly comboBirdRoot: Node;
  commit(previousRoot: Node): void;
  rollback(): void;
}

export interface ComboBirdPauseReplayFailedEvent {
  readonly message: string;
  readonly reason: 'restart-error';
}

export interface ComboBirdResultMenuRequestedEvent {
  readonly completedRunScore: number;
  readonly resultRoot: Node;
  commit(previousRoot: Node): void;
  rollback(): void;
}

export interface ComboBirdResultRetryFailedEvent {
  readonly message: string;
  readonly reason: 'restart-error';
}

export interface ComboBirdResultRewardReadyEvent {
  readonly bonusCoins: number;
  readonly completedRunScore: number;
  readonly totalCoins: number;
}

interface ComboBirdViewport {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

interface ComboBirdResultConfiguration {
  readonly mode: typeof COMBO_BIRD_RESULT_MODE_ID;
  readonly score: number;
}

interface ComboBirdPendingResultConfiguration {
  mode?: typeof COMBO_BIRD_RESULT_MODE_ID;
  score?: number;
}

interface ComboBirdResultEntryTransaction {
  configuration: ComboBirdResultConfiguration | null;
  readonly comboBirdRoot: Node;
  presenter: ClassicResultPresenter | null;
  root: Node | null;
  status: 'committed' | 'pending' | 'prepared' | 'rolled-back';
}

interface ComboBirdResultMenuTransaction {
  readonly presenter: ClassicResultPresenter;
  readonly root: Node;
  readonly screenPlacement: ComboBirdScreenPlacementPort;
  status: 'committed' | 'pending' | 'rolled-back';
}

interface ComboBirdPauseAudioLeaseSnapshot {
  readonly effectsPauseLeaseRequired: boolean;
  readonly musicPauseLeaseRequired: boolean;
}

interface ComboBirdPauseQuitTransaction
  extends ComboBirdPauseAudioLeaseSnapshot {
  audioReleaseAttempted: boolean;
  readonly presenter: BaseGameplayPausePresenter;
  readonly root: Node;
  readonly screenPlacement: ComboBirdScreenPlacementPort;
  status: 'committed' | 'pending' | 'rolled-back';
}

interface ComboBirdActivationObjectiveRollback {
  readonly objectiveId: 49;
  readonly value: number;
}

interface ComboBirdCutPresentationEvent {
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

interface ComboBirdPreparationProducts {
  readonly baseGameplayResources: LoadedBaseGameplayResources;
  readonly birdResources: LoadedBirdResources;
  readonly resources: LoadedComboBirdResources;
  readonly timerAudio: TimeManagerAudioPresenter;
}

interface ComboBirdRunOwnership {
  readonly birdBladePresenter: BirdBladePresenter | null;
  readonly birdBladeRayAdapter: BirdBladeRayAdapter<ComboBirdPhysicsRayHit> | null;
  readonly combo: ComboService | null;
  readonly comboItemPresenters: Set<ComboItemPresenter>;
  readonly criticalCutHalfPresenters: Set<ClassicCutHalfPresenter>;
  readonly criticalParticlePresenters: Set<ClassicCriticalParticlePresenter>;
  readonly cutHalfPresenters: Set<ClassicCutHalfPresenter>;
  readonly instructionAttachments: Set<ComboBirdInstructionCard>;
  readonly introPresenter: ComboBirdIntroPresenter | null;
  readonly modeRoot: Node | null;
  readonly pausePresenter: BaseGameplayPausePresenter | null;
  readonly pendingCapturedRoot: Node | null;
  readonly pendingResultConfiguration: ComboBirdPendingResultConfiguration | null;
  readonly registry: ClassicEntityRegistry | null;
  readonly scoreHudPresenter: ClassicScoreHudPresenter | null;
  readonly scoreHudRoot: Node | null;
  readonly swishAudio: ClassicSwishAudioGate | null;
  readonly timeManagerPresenter: TimeManagerPresenter | null;
  readonly worldPresentationRoot: Node | null;
}

interface RetiredComboBirdRunOwnership {
  readonly ownership: ComboBirdRunOwnership;
  readonly scene: ComboBirdSceneController;
}

type ComboBirdPhysicsRayHit = ReturnType<
  ComboBirdSceneController['raycastAll']
>[number];

/**
 * Passive process owner for recovered mode 5.
 *
 * Combo Bird loads only its seven-raster supplement, Bird type 3, the shared pause/objective
 * resources, and the two TimeManager clips absent from Classic's process audio catalog.
 * Every gameplay object is detached and run-owned until the app shell commits activation.
 */
@ccclass('ComboBirdGameplayController')
@requireComponent(ComboBirdSceneController)
@requireComponent(BirdInputController)
@requireComponent(ClassicGameplayController)
@requireComponent(ClassicSceneController)
export class ComboBirdGameplayController extends Component {
  private baseGameplayResources: LoadedBaseGameplayResources | null = null;
  private birdBladePresenter: BirdBladePresenter | null = null;
  private birdBladeRayAdapter: BirdBladeRayAdapter<ComboBirdPhysicsRayHit> | null = null;
  private birdResources: LoadedBirdResources | null = null;
  private classicGameplayController: ClassicGameplayController | null = null;
  private classicSceneController: ClassicSceneController | null = null;
  private combo: ComboService | null = null;
  private comboBirdResources: LoadedComboBirdResources | null = null;
  private comboBirdSceneController: ComboBirdSceneController | null = null;
  private comboItemPresenters = new Set<ComboItemPresenter>();
  private criticalCutHalfPresenters = new Set<ClassicCutHalfPresenter>();
  private criticalParticlePresenters = new Set<ClassicCriticalParticlePresenter>();
  private cutHalfPresenters = new Set<ClassicCutHalfPresenter>();
  private instructionAttachments = new Set<ComboBirdInstructionCard>();
  private introPresenter: ComboBirdIntroPresenter | null = null;
  private lifecycleFatalError: ComboBirdLifecycleRollbackError | null = null;
  private modeRoot: Node | null = null;
  private readonly objectiveAchievementPresenters =
    new Set<ObjectiveAchievementPresenter>();
  private objectiveAchievementTargetRoot: Node | null = null;
  private objectivesManager: ObjectivesManagerState | null = null;
  private pausePresenter: BaseGameplayPausePresenter | null = null;
  private pendingCapturedRoot: Node | null = null;
  private pendingResultConfiguration: ComboBirdPendingResultConfiguration | null = null;
  private pendingResultEntryTransaction: ComboBirdResultEntryTransaction | null = null;
  private preparation: Promise<void> | null = null;
  private preparationError: Error | null = null;
  private readinessStatus: ComboBirdGameplayReadinessStatus = 'idle';
  private registry: ClassicEntityRegistry | null = null;
  private resultPresenter: ClassicResultPresenter | null = null;
  private resultPresentationRoot: Node | null = null;
  private readonly retiredRuns: RetiredComboBirdRunOwnership[] = [];
  private scoreHudPresenter: ClassicScoreHudPresenter | null = null;
  private scoreHudRoot: Node | null = null;
  private screenPlacement: ComboBirdScreenPlacementPort | null = null;
  private shuttingDown = false;
  private standbySceneController: ComboBirdSceneController | null = null;
  private swishAudio: ClassicSwishAudioGate | null = null;
  private timeManagerPresenter: TimeManagerPresenter | null = null;
  private timerAudio: TimeManagerAudioPresenter | null = null;
  private worldPresentationRoot: Node | null = null;

  onLoad(): void {
    const scene = this.getComponent(ComboBirdSceneController);
    const input = this.getComponent(BirdInputController);
    const classic = this.getComponent(ClassicGameplayController);
    const classicScene = this.getComponent(ClassicSceneController);
    if (scene === null) {
      throw new Error(
        'ComboBirdGameplayController requires ComboBirdSceneController',
      );
    }
    if (input === null) {
      throw new Error(
        'ComboBirdGameplayController requires BirdInputController',
      );
    }
    if (classic === null) {
      throw new Error(
        'ComboBirdGameplayController requires ClassicGameplayController',
      );
    }
    if (classicScene === null) {
      throw new Error(
        'ComboBirdGameplayController requires the shared Classic resolution owner',
      );
    }
    this.comboBirdSceneController = scene;
    this.classicGameplayController = classic;
    this.classicSceneController = classicScene;
  }

  onEnable(): void {
    this.node.on(
      BIRD_BLADE_TOUCH_BEGAN_EVENT,
      this.onBirdBladeTouchBegan,
      this,
    );
    this.node.on(
      COMBO_BIRD_PHYSICS_STEPPED_EVENT,
      this.onPhysicsStepped,
      this,
    );
    this.node.on(
      COMBO_BIRD_SESSION_COMMAND_EVENT,
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
    updateAndRetireObjectiveAchievementPresenters(
      this.objectiveAchievementPresenters,
      deltaSeconds,
      'Combo Bird objective achievement presentation update failed',
    );
    if (this.pendingResultEntryTransaction === null) {
      this.resultPresenter?.updateAction(deltaSeconds);
    }
    if (!this.isComboBirdGameplayAttached()) {
      return;
    }

    this.birdBladePresenter?.update(deltaSeconds);
    for (const presenter of Array.from(this.comboItemPresenters)) {
      presenter.updateAction(deltaSeconds);
    }
    const lifecycleAtFrameStart = this.requireSceneController()
      .sessionSnapshot().lifecycle;
    this.introPresenter?.updateAction(deltaSeconds);
    if (!this.isComboBirdGameplayAttached()) {
      return;
    }

    // Time-Up actions consume the host action clock before this frame's scheduler work.
    // A timer expiry below therefore creates an action that begins on the next host frame.
    try {
      this.timeManagerPresenter?.updateAction(deltaSeconds);
    } catch (error) {
      if (error instanceof ComboBirdLifecycleRollbackError) {
        this.retainFatalLifecycleBoundary(error);
      }
      throw error;
    }
    for (const presenter of Array.from(this.cutHalfPresenters)) {
      presenter.updateAction(deltaSeconds);
    }
    for (const presenter of Array.from(this.criticalParticlePresenters)) {
      presenter.updateAction(deltaSeconds);
    }
    this.scoreHudPresenter?.updateAction(deltaSeconds);
    this.pausePresenter?.updateAction(deltaSeconds);
    if (!this.isComboBirdGameplayAttached()) {
      return;
    }

    if (
      lifecycleAtFrameStart === 'intro-instructions'
      || lifecycleAtFrameStart === 'intro-ninety'
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
      BIRD_BLADE_TOUCH_BEGAN_EVENT,
      this.onBirdBladeTouchBegan,
      this,
    );
    this.node.off(
      COMBO_BIRD_PHYSICS_STEPPED_EVENT,
      this.onPhysicsStepped,
      this,
    );
    this.node.off(
      COMBO_BIRD_SESSION_COMMAND_EVENT,
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
    reportCleanupFailures('Combo Bird gameplay teardown', failures);
  }

  get readiness(): ComboBirdGameplayReadiness {
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

  snapshot(): ComboBirdGameplaySnapshot {
    const session = this.comboBirdSceneController?.sessionSnapshot()
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
      lifecycle: session.lifecycle,
      readiness: this.readinessStatus,
      resultActive: this.resultPresentationRoot !== null,
      score: session.score.authoritativeScore,
    });
  }

  /**
   * Independent mode-5 preparation. A Crazy preparation failure is irrelevant: only Classic's
   * process catalog/services are shared, and Combo owns its narrow timer-audio supplement.
   */
  prepareComboBirdRuntime(): Promise<void> {
    if (this.shuttingDown || !isValid(this.node, true)) {
      throw new Error('Combo Bird runtime cannot be prepared after destruction');
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
        'Combo Bird runtime preparation failed',
      );
      this.preparationError = failure;
      this.readinessStatus = 'failed';
      if (!this.shuttingDown && isValid(this.node, true)) {
        this.node.emit(COMBO_BIRD_RESOURCE_LOAD_FAILED_EVENT, failure);
        console.error(failure);
      }
    });
    return attempt;
  }

  /** Compatibility name for app-shell preparation owners. */
  prepareRecoveredRuntime(): Promise<void> {
    return this.prepareComboBirdRuntime();
  }

  private async initializePreparation(): Promise<void> {
    const classic = this.requireClassicGameplayController();
    await classic.prepareRecoveredRuntime();
    this.assertPreparationStillUsable();
    const assetTree = classic.sharedResourceCatalog.assetTree;
    const [resources, birdResources, baseGameplayResources] = await Promise.all([
      loadComboBirdResources(assetTree),
      loadBirdResources(assetTree, COMBO_BIRD_BLADE_TYPE),
      loadBaseGameplayResources(assetTree),
    ]);
    this.assertPreparationStillUsable();
    const timerAudio = await TimeManagerAudioPresenter.load(this.node);
    let committed = false;
    try {
      this.assertPreparationStillUsable();
      this.commitPreparation({
        baseGameplayResources,
        birdResources,
        resources,
        timerAudio,
      });
      committed = true;
    } finally {
      if (!committed) {
        const failures: unknown[] = [];
        collectCleanupFailure(failures, () => timerAudio.dispose());
        reportCleanupFailures('Combo Bird partial preparation', failures);
      }
    }
  }

  private commitPreparation(products: ComboBirdPreparationProducts): void {
    if (
      this.baseGameplayResources !== null
      || this.birdResources !== null
      || this.comboBirdResources !== null
      || this.timerAudio !== null
      || this.objectivesManager !== null
      || this.objectiveAchievementTargetRoot !== null
    ) {
      throw new Error('Combo Bird preparation products can commit only once');
    }
    const assetTree = this.requireClassicGameplayController()
      .sharedResourceCatalog.assetTree;
    if (
      products.resources.assetTree !== assetTree
      || products.birdResources.assetTree !== assetTree
      || products.baseGameplayResources.assetTree !== assetTree
      || products.birdResources.birdType !== COMBO_BIRD_BLADE_TYPE
    ) {
      throw new Error(
        'Combo Bird preparation must share one exact tree and Bird type 3',
      );
    }

    const objectiveTarget = new Node('ComboBirdObjectiveAchievementTargetRoot');
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
    this.birdResources = products.birdResources;
    this.comboBirdResources = products.resources;
    this.timerAudio = products.timerAudio;
    this.objectiveAchievementTargetRoot = objectiveTarget;
    this.objectivesManager = objectivesManager;
    this.readinessStatus = 'ready';
    this.preparationError = null;
  }

  /** App-shell entry. The current-screen host must already be empty. */
  activateComboBirdFromAppShell(
    screenPlacement: ComboBirdScreenPlacementPort,
  ): void {
    assertScreenPlacementPort(screenPlacement);
    if (this.shuttingDown) {
      throw new Error('Combo Bird runtime cannot activate after destruction');
    }
    if (this.lifecycleFatalError !== null) {
      throw this.lifecycleFatalError;
    }
    if (this.readinessStatus !== 'ready') {
      throw new Error(
        'Combo Bird runtime must be fully prepared before activation',
      );
    }
    const retainedPlacement = this.screenPlacement;
    if (retainedPlacement !== null && retainedPlacement !== screenPlacement) {
      throw new Error(
        'Combo Bird runtime must reuse its process screen-placement owner',
      );
    }
    this.drainRetiredRuns();
    if (screenPlacement.currentScreen !== null) {
      throw new Error('Combo Bird runtime requires an empty current-screen host');
    }
    if (
      this.modeRoot !== null
      || this.resultPresentationRoot !== null
      || this.resultPresenter !== null
    ) {
      throw new Error(
        'Combo Bird runtime requires fully released run presentation',
      );
    }

    this.screenPlacement = screenPlacement;
    let objectiveRollback: ComboBirdActivationObjectiveRollback | null = null;
    try {
      this.constructMode();
      objectiveRollback = this.captureActivationObjectiveRollback();
      this.attachModeAndActivateScene(screenPlacement);
      this.updateScorePresentation();
      this.emitSnapshot();
    } catch (error) {
      const failures: unknown[] = [];
      const scene = this.comboBirdSceneController;
      if (scene?.active) {
        collectCleanupFailure(
          failures,
          () => scene.releaseComboBirdLayerForReplacement(),
        );
      }
      if (scene !== null) {
        this.quiesceSceneAfterFailedRelease(
          scene,
          'Combo Bird activation rollback',
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
        const failure = new ComboBirdLifecycleRollbackError(
          'Combo Bird activation rollback failed',
          error,
          failures,
        );
        this.retainFatalLifecycleBoundary(failure);
        throw failure;
      }
      if (error instanceof ComboBirdLifecycleRollbackError) {
        this.retainFatalLifecycleBoundary(error);
      }
      throw error;
    }
  }

  private constructMode(): void {
    if (this.modeRoot !== null) {
      throw new Error(
        'Combo Bird mode can be constructed only from an empty run owner',
      );
    }
    const classic = this.requireClassicGameplayController();
    const scene = this.requireSceneController();
    const random = classic.sharedGameplayRandom;
    const viewport = this.requireViewport();
    const catalog = classic.sharedResourceCatalog;
    const root = createDetachedScreenRoot('ComboBirdModeRoot', this.node);
    this.modeRoot = root;
    this.worldPresentationRoot = createPresenterRoot(
      root,
      'ComboBirdWorldPresentationRoot',
    );
    this.scoreHudRoot = createPresenterRoot(
      root,
      'ComboBirdScoreHudRoot',
    );
    this.pendingCapturedRoot = null;
    this.pendingResultConfiguration = null;
    this.instructionAttachments = new Set<ComboBirdInstructionCard>();
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
          'Combo Bird detached construction cleanup failed',
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
    viewport: ComboBirdViewport,
    random: GameplayRandom,
  ): void {
    const classic = this.requireClassicGameplayController();
    const catalog = classic.sharedResourceCatalog;
    const settings = classic.sharedSettingsRuntime;
    const initialBestScore = settings.state.birdComboLeaderboard.first;
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
      resources: createComboBirdTimeManagerResourcePort(
        this.requireComboBirdResources(),
      ),
      totalSeconds: COMBO_BIRD_INITIAL_TIME_SECONDS,
      visibleRect,
    }, {
      audio: this.requireTimerAudio(),
      disableBonusType: () => {
        throw new Error('Combo Bird TimeManager cannot disable a bonus type');
      },
      onFreezeFinish: () => {
        throw new Error('Combo Bird TimeManager cannot finish freeze');
      },
      onFreezeStart: () => {
        throw new Error('Combo Bird TimeManager cannot start freeze');
      },
      onTimeUp: () => this.requireSceneController().timeUp(),
      onTimeUpFinish: () => this.requireSceneController().timeUpFinish(),
    });
    this.timeManagerPresenter.attach(modeRoot, 1);

    this.introPresenter = ComboBirdIntroPresenter.create({
      logicalHeight: resolution.profile.designHeight,
      resources: this.requireComboBirdResources(),
      visibleRect,
    }, {
      onComplete: () => this.requireSceneController().startGameCallback(),
      onGo: () => this.requireSceneController().goCallback(),
      onNinety: () => this.requireSceneController().totalTimeCallback(),
    });
    this.introPresenter.attach(modeRoot);

    this.birdBladePresenter = BirdBladePresenter.create({
      random,
      resources: this.requireBirdResources(),
      viewport,
    });
    this.birdBladePresenter.attach(worldRoot);
    this.birdBladeRayAdapter = BirdBladeRayAdapter.create<ComboBirdPhysicsRayHit>({
      raySource: this.birdBladePresenter,
      raycast: {
        raycastAll: (start, end) => this.requireSceneController()
          .raycastAll(start, end),
      },
      viewportWidth: viewport.width,
    });

    if (random !== classic.sharedGameplayRandom) {
      throw new Error(
        'Combo Bird presentation lost the process-owned GameplayRandom',
      );
    }
  }

  private initializePausePresentation(): void {
    if (this.pausePresenter !== null) {
      throw new Error(
        'Combo Bird pause presentation can initialize only once per run',
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
          'Combo Bird pause initialization rollback failed',
          error,
          failures,
        );
      }
      throw error;
    }
  }

  private attachModeAndActivateScene(
    screenPlacement: ComboBirdScreenPlacementPort,
  ): void {
    const root = this.requireDetachedModeRoot();
    screenPlacement.attachCurrentScreen(root);
    if (screenPlacement.currentScreen !== root) {
      throw new Error(
        'Combo Bird current-screen placement lost the attached mode root',
      );
    }
    this.initializePausePresentation();
    const random = this.sharedGameplayRandom;
    const planner = new ClassicSpawnPlanner({
      random,
      sampleKinematics: sampleSpawnKinematics,
    });
    const coordinatorOptions: ComboBirdTossCoordinatorOptions = {
      commandSink: this.onCoordinatorCommands,
      effectsEnabled: this.effectsEnabled,
      planner,
      random,
      viewport: () => this.requireViewport(),
    };
    const scene = this.requireSceneController();
    scene.activateComboBirdLayer(
      this.sharedSettingsRuntime.state.birdComboLeaderboard.first,
      coordinatorOptions,
    );
    if (
      scene.sessionSnapshot().mode !== COMBO_BIRD_RESULT_MODE_ID
      || scene.sessionSnapshot().lifecycle !== 'intro-instructions'
    ) {
      throw new Error(
        'Combo Bird scene activation committed a different mode or lifecycle',
      );
    }
  }

  private readonly onCoordinatorCommands = (
    commands: readonly ComboBirdTossRuntimeCommand[],
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
    this.emitSnapshot();
  };

  private readonly onSessionCommand = (
    command: ComboBirdSessionCommand,
  ): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    this.emitCommand(command);
    switch (command.type) {
      case 'enter-base-bird-layer':
        if (
          this.requireBirdResources().birdType !== COMBO_BIRD_BLADE_TYPE
          || this.birdBladePresenter === null
        ) {
          throw new Error(
            'Combo Bird base entry requires the type-3 Bird driver',
          );
        }
        break;
      case 'process-objective':
        if (command.selector !== COMBO_BIRD_OBJECTIVE_EVENT_SELECTOR) {
          throw new Error('Combo Bird objective selector must remain 7');
        }
        this.requireObjectivesManager().processGameEvent(
          command.selector,
          command.payload,
        );
        break;
      case 'construct-controller':
      case 'attach-controller':
        assertComboBirdController(command.controller);
        break;
      case 'construct-time-manager':
        if (
          command.durationSeconds !== COMBO_BIRD_INITIAL_TIME_SECONDS
          || command.callbackOrder[0] !== 'time-up'
          || command.callbackOrder[1] !== 'time-up-finish'
        ) {
          throw new Error(
            'Combo Bird TimeManager construction lost its recovered contract',
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
            `Combo Bird instruction ${command.card} attached more than once`,
          );
        }
        this.instructionAttachments.add(command.card);
        if (this.instructionAttachments.size === 3) {
          this.requireIntroPresenter().activate();
        }
        break;
      case 'create-bird-blade':
        if (
          command.bladeType !== COMBO_BIRD_BLADE_TYPE
          || command.canonicalPath !== COMBO_BIRD_BLADE_ASSET
          || command.zOrder !== 1
        ) {
          throw new Error('Combo Bird must construct BirdBlade type 3');
        }
        this.requireBirdBladePresenter();
        break;
      case 'focus-combo-on-score-manager':
        this.requireCombo();
        break;
      case 'initialize-best-score':
        if (
          command.key !== COMBO_BIRD_SETTINGS_BEST_SCORE_KEY
          || command.score
            !== this.sharedSettingsRuntime.state.birdComboLeaderboard.first
        ) {
          throw new Error(
            'Combo Bird best-score initialization lost shared settings',
          );
        }
        break;
      case 'create-ninety-intro':
        if (this.requireIntroPresenter().state.phase !== 'ninety') {
          throw new Error(
            'Combo Bird 90s command requires the ninety intro phase',
          );
        }
        break;
      case 'create-go-intro':
        if (this.requireIntroPresenter().state.phase !== 'go') {
          throw new Error(
            'Combo Bird GO command requires the GO intro phase',
          );
        }
        break;
      case 'start-controller':
      case 'stop-controller':
        assertComboBirdController(command.controller);
        break;
      case 'start-time-manager':
        this.requireTimeManagerPresenter().start();
        break;
      case 'check-combo':
        this.requireCombo().checkCombo(command.position);
        break;
      case 'add-score':
        if (command.application !== 'already-applied') {
          throw new Error(
            'Combo Bird ordinary score must already be applied by the session',
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
      case 'capture-combo-bird-parent':
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
      case 'remove-combo-bird':
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

  private readonly onBirdBladeTouchBegan = (
    event: BirdBladeTouchBeganEvent,
  ): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    if (!this.isComboBirdGameplayAttached()) {
      return;
    }
    // BaseBird requests swish before BirdBlade performs its busy guard.
    for (const instruction of this.requireSwishAudio().request(
      true,
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
    this.requireBirdBladePresenter().touch(event.point);
  };

  private readonly onSwishCooldownComplete = (): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    this.swishAudio?.unlock();
  };

  private readonly onPhysicsStepped = (
    _event: ComboBirdPhysicsSteppedEvent,
  ): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    const registry = this.registry;
    const ray = this.birdBladeRayAdapter;
    const blade = this.birdBladePresenter;
    if (
      registry === null
      || ray === null
      || blade === null
      || !this.isComboBirdGameplayAttached()
    ) {
      return;
    }

    const viewport = this.requireViewport();
    const existingCutHalves = Array.from(this.cutHalfPresenters);
    if (registry.size > 0) {
      ray.processOneCachedRay((batch) => (
        this.applyBirdRaycastBatch(batch, registry)
      ));
    } else {
      blade.acknowledgeCachedRay();
    }
    if (registry.size > 0) {
      registry.evaluateBounds(viewport);
    }
    for (const presenter of existingCutHalves) {
      presenter.evaluateBounds(viewport);
      this.emitCriticalParticlesForCutHalves(presenter);
    }
    this.updateScorePresentation();
    this.emitSnapshot();
  };

  private applyBirdRaycastBatch(
    batch: BirdBladeRaycastBatch<ComboBirdPhysicsRayHit>,
    registry: ClassicEntityRegistry,
  ): boolean {
    if (batch.plan === null) {
      return true;
    }
    registry.runRayQueryCutBatch(() => {
      const forwardHits: CutQueryHit[] = batch.forwardHits.map(
        ({ collider }) => ({
          target: registry.cuttableSnapshotForCollider(collider),
        }),
      );
      const reverseHits: CutQueryHit[] = batch.reverseHits.map(
        ({ collider }) => ({
          target: registry.cuttableSnapshotForCollider(collider),
        }),
      );
      for (const command of createCutDispatchCommands(
        batch.plan as NonNullable<typeof batch.plan>,
        forwardHits,
        reverseHits,
      )) {
        this.emitCommand(command);
        if (command.type === 'combo-check') {
          this.requireSceneController().checkCombo(command.position);
        } else {
          registry.cut(command.targetId, command.segment);
        }
      }
    });
    return true;
  }

  private readonly onOrdinaryFruitCut = (
    event: ClassicGeneratedFruitCutEvent,
  ): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    this.requireObjectivesManager().processGlobalFruitCut();
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
    this.requireObjectivesManager().processFruitTypeCut(event.fruitId);
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

  private presentCutHalves(event: ComboBirdCutPresentationEvent): void {
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
        `Combo Bird critical particle ${command.resourceIndex} is not loaded`,
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
                'Combo Bird combo created more than one pending item',
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
                'Combo Bird combo requires one pending z-order-1 item',
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
      ComboBirdSessionCommand,
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
    throw new Error('Combo Bird has no double-score presentation');
  };

  private updateScorePresentation(): void {
    const score = this.comboBirdSceneController?.sessionSnapshot().score;
    if (score === undefined) {
      return;
    }
    const bestScore = this.sharedSettingsRuntime.state.birdComboLeaderboard.first;
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
      throw new Error('Combo Bird pause UI requires one active objective');
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
    if (settings.musicEnabled) {
      collectCleanupFailure(
        failures,
        () => this.requireClassicGameplayController()
          .sharedAudioPresenter.pauseBackgroundMusic(),
      );
    }
    if (failures.length > 0) {
      throw cleanupError('Combo Bird Pause audio', failures);
    }
  };

  private readonly onResumeRequested = (): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    this.requirePausePresenter().resumeEgress();
    const failures: unknown[] = [];
    if (this.effectsEnabled()) {
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
    // Native timed gameplay stays silent after Resume, but the process lease must be cleared.
    collectCleanupFailure(
      failures,
      () => this.requireClassicGameplayController()
        .sharedAudioPresenter.stopBackgroundMusic(),
    );
    if (failures.length > 0) {
      throw cleanupError('Combo Bird Resume audio', failures);
    }
  };

  private readonly onPauseReplayRequested = (): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    try {
      this.restartFromPause();
    } catch (error) {
      const failure = normalizeError(error, 'Combo Bird Pause Replay failed');
      if (error instanceof ComboBirdLifecycleRollbackError) {
        this.retainFatalLifecycleBoundary(error);
      }
      const payload: ComboBirdPauseReplayFailedEvent = Object.freeze({
        message: failure.message,
        reason: 'restart-error',
      });
      this.node.emit(COMBO_BIRD_PAUSE_REPLAY_FAILED_EVENT, payload);
      console.error(failure);
    }
  };

  private restartFromPause(): void {
    this.drainRetiredRuns();
    const effectsEnabled = this.effectsEnabled();
    const pauseAudioSettings = this.sharedSettingsRuntime.state.snapshot;
    const pauseAudioLeaseSnapshot: ComboBirdPauseAudioLeaseSnapshot = {
      effectsPauseLeaseRequired: pauseAudioSettings.effectsEnabled,
      musicPauseLeaseRequired: pauseAudioSettings.musicEnabled,
    };
    const placement = this.requireScreenPlacement();
    const oldRoot = this.requireModeRoot();
    const pause = this.requirePausePresenter();
    const oldScene = this.requireSceneController();
    if (placement.currentScreen !== oldRoot || !oldScene.active) {
      throw new Error(
        'Combo Bird Pause Replay requires the attached active run',
      );
    }

    const oldOwnership = this.captureRunOwnership();
    let freshInstalled = false;
    let freshRoot: Node | null = null;
    let freshScene: ComboBirdSceneController | null = null;
    let objectiveRollback: ComboBirdActivationObjectiveRollback | null = null;
    let pauseEgressAttempted = false;
    this.unschedule(this.onSwishCooldownComplete);

    try {
      oldScene.suspendComboBirdLayerForNavigation();
      freshScene = this.acquireStandbySceneController(oldScene);
      this.installRunOwnership(this.createEmptyRunOwnership());
      this.comboBirdSceneController = freshScene;
      freshInstalled = true;
      this.constructMode();
      freshRoot = this.requireDetachedModeRoot();

      const audioFailures: unknown[] = [];
      collectCleanupFailure(
        audioFailures,
        () => this.requireClassicGameplayController()
          .sharedAudioPresenter.stopBackgroundMusic(),
      );
      collectCleanupFailure(
        audioFailures,
        () => this.requireClassicGameplayController()
          .sharedAudioPresenter.stopAllEffects(),
      );
      collectCleanupFailure(
        audioFailures,
        () => this.requireTimerAudio().stopAllEffects(),
      );
      if (audioFailures.length > 0) {
        throw cleanupError('Combo Bird Pause Replay audio', audioFailures);
      }

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
          'Combo Bird Pause Replay replaced an unexpected gameplay screen',
        );
      }
      this.initializePausePresentation();
      objectiveRollback = this.captureActivationObjectiveRollback();
      this.activateCurrentSceneWithFreshCoordinator(freshScene);
      this.updateScorePresentation();
      oldScene.finalizeSuspendedComboBirdLayerRelease();
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      const primaryFatal = error instanceof ComboBirdLifecycleRollbackError;
      if (freshInstalled && freshScene !== null) {
        collectCleanupFailure(rollbackFailures, () => {
          if (freshScene?.active) {
            freshScene.releaseComboBirdLayerForReplacement();
          }
        });
        this.quiesceSceneAfterFailedRelease(
          freshScene,
          'Combo Bird Pause Replay fresh-scene rollback',
          rollbackFailures,
        );
        collectCleanupFailure(rollbackFailures, () => {
          const current = placement.currentScreen;
          if (current === oldRoot) {
            return;
          }
          if (!isValid(oldRoot, true) || oldRoot.parent !== null) {
            throw new Error(
              'Combo Bird Pause Replay rollback lost the old root',
            );
          }
          if (current === null) {
            placement.attachCurrentScreen(oldRoot);
          } else {
            const displaced = placement.replaceCurrentScreen(oldRoot);
            if (freshRoot !== null && displaced !== freshRoot) {
              throw new Error(
                'Combo Bird Pause Replay rollback displaced an unexpected screen',
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
      this.comboBirdSceneController = oldScene;
      if (freshScene !== null && freshScene !== oldScene) {
        this.standbySceneController = freshScene;
      }
      collectCleanupFailure(rollbackFailures, () => {
        if (placement.currentScreen === null) {
          placement.attachCurrentScreen(oldRoot);
        }
        if (placement.currentScreen !== oldRoot) {
          throw new Error(
            'Combo Bird Pause Replay rollback could not restore gameplay',
          );
        }
      });
      // Only a complete, nonfatal rollback may reactivate the retained run.
      let oldSceneResumed = false;
      if (!primaryFatal && rollbackFailures.length === 0) {
        collectCleanupFailure(rollbackFailures, () => {
          if (oldScene.suspended) {
            oldScene.resumeSuspendedComboBirdLayer();
            oldSceneResumed = true;
          }
        });
        if (rollbackFailures.length === 0) {
          collectCleanupFailure(
            rollbackFailures,
            () => this.restorePauseAudioAfterNavigationRollback(
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
          () => oldScene.suspendComboBirdLayerForNavigation(),
        );
        if (oldScene.active) {
          rollbackFailures.push(new Error(
            'Combo Bird Pause Replay rollback retained the old active lease',
          ));
        }
      }
      if (rollbackFailures.length > 0) {
        const failure = new ComboBirdLifecycleRollbackError(
          'Combo Bird Pause Replay rollback failed',
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
        'Committed Combo Bird Pause Replay lost its fresh scene lease',
      );
    }
    const freshOwnership = this.captureRunOwnership();
    const cleanupFailures: unknown[] = [];
    try {
      this.installRunOwnership(oldOwnership);
      this.comboBirdSceneController = oldScene;
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
      this.comboBirdSceneController = freshScene;
      this.standbySceneController = oldScene;
    }
    if (effectsEnabled) {
      collectCleanupFailure(
        cleanupFailures,
        () => this.requireClassicGameplayController()
          .sharedAudioPresenter.playOneShot(CLASSIC_MENU_BUTTON_AUDIO_PATH),
      );
    }
    collectCleanupFailure(cleanupFailures, () => this.emitSnapshot());
    reportCleanupFailures(
      'Committed Combo Bird Pause Replay cleanup',
      cleanupFailures,
    );
  }

  private activateCurrentSceneWithFreshCoordinator(
    scene: ComboBirdSceneController,
  ): void {
    const random = this.sharedGameplayRandom;
    const planner = new ClassicSpawnPlanner({
      random,
      sampleKinematics: sampleSpawnKinematics,
    });
    scene.activateComboBirdLayer(
      this.sharedSettingsRuntime.state.birdComboLeaderboard.first,
      {
        commandSink: this.onCoordinatorCommands,
        effectsEnabled: this.effectsEnabled,
        planner,
        random,
        viewport: () => this.requireViewport(),
      },
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
      this.requireSceneController().suspendComboBirdLayerForNavigation();
    } catch (error) {
      if (error instanceof ComboBirdLifecycleRollbackError) {
        this.retainFatalLifecycleBoundary(error);
        throw error;
      }
      const failures: unknown[] = [];
      collectCleanupFailure(
        failures,
        () => pause.pauseIngress(this.currentPauseCard()),
      );
      if (failures.length > 0) {
        const failure = new ComboBirdLifecycleRollbackError(
          'Combo Bird Pause Quit suspension rollback failed',
          error,
          failures,
        );
        this.retainFatalLifecycleBoundary(failure);
        throw failure;
      }
      throw error;
    }
    const audioSettings = this.sharedSettingsRuntime.state.snapshot;
    const transaction: ComboBirdPauseQuitTransaction = {
      audioReleaseAttempted: false,
      effectsPauseLeaseRequired: audioSettings.effectsEnabled,
      musicPauseLeaseRequired: audioSettings.musicEnabled,
      presenter: pause,
      root,
      screenPlacement: this.requireScreenPlacement(),
      status: 'pending',
    };
    const payload: ComboBirdPauseQuitRequestedEvent = Object.freeze({
      comboBirdRoot: root,
      commit: (previousRoot: Node) => (
        this.commitPauseQuit(transaction, previousRoot)
      ),
      rollback: () => this.rollbackPauseQuit(transaction),
    });
    try {
      transaction.audioReleaseAttempted = true;
      this.releasePauseAudioForNavigation();
      this.node.emit(COMBO_BIRD_PAUSE_QUIT_REQUESTED_EVENT, payload);
    } catch (error) {
      if (transaction.status === 'pending') {
        try {
          this.rollbackPauseQuit(transaction);
        } catch (rollbackError) {
          const failure = new ComboBirdLifecycleRollbackError(
            'Combo Bird Pause Quit request rollback failed',
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
        const failure = new ComboBirdLifecycleRollbackError(
          'Combo Bird Pause Quit request settlement failed',
          new Error(
            'Combo Bird Pause Quit request returned without settlement',
          ),
          [error],
        );
        this.retainFatalLifecycleBoundary(failure);
        throw failure;
      }
    }
  };

  private commitPauseQuit(
    transaction: ComboBirdPauseQuitTransaction,
    previousRoot: Node,
  ): void {
    if (previousRoot !== transaction.root) {
      throw new Error(
        'Combo Bird Pause Quit commit received an unexpected previous screen',
      );
    }
    if (transaction.status === 'committed') {
      return;
    }
    if (transaction.status === 'rolled-back') {
      throw new Error(
        'Rolled-back Combo Bird Pause Quit transaction cannot commit',
      );
    }
    if (
      !transaction.audioReleaseAttempted
      ||
      this.modeRoot !== transaction.root
      || this.pausePresenter !== transaction.presenter
      || transaction.root.parent !== null
      || transaction.screenPlacement.currentScreen === null
      || transaction.screenPlacement.currentScreen === transaction.root
    ) {
      throw new Error(
        'Combo Bird Pause Quit commit requires a successful screen replacement',
      );
    }
    const releasedScene = this.requireSceneController();
    releasedScene.finalizeSuspendedComboBirdLayerRelease();
    transaction.status = 'committed';
    const failures: unknown[] = [];
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
      'Committed Combo Bird Pause Quit cleanup',
      failures,
    );
  }

  private rollbackPauseQuit(
    transaction: ComboBirdPauseQuitTransaction,
  ): void {
    if (transaction.status === 'rolled-back') {
      return;
    }
    if (transaction.status === 'committed') {
      throw new Error(
        'Committed Combo Bird Pause Quit transaction cannot roll back',
      );
    }
    if (this.lifecycleFatalError !== null) {
      throw this.lifecycleFatalError;
    }
    let resumedScene: ComboBirdSceneController | null = null;
    try {
      if (
        this.modeRoot !== transaction.root
        || this.pausePresenter !== transaction.presenter
        || !isValid(transaction.root, true)
      ) {
        throw new Error(
          'Combo Bird Pause Quit rollback lost gameplay ownership',
        );
      }
      const current = transaction.screenPlacement.currentScreen;
      if (current !== transaction.root) {
        if (transaction.root.parent !== null) {
          throw new Error(
            'Combo Bird Pause Quit rollback found gameplay under an unknown owner',
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
          'Combo Bird Pause Quit rollback could not restore gameplay',
        );
      }
      const scene = this.requireSceneController();
      scene.resumeSuspendedComboBirdLayer();
      resumedScene = scene;
      transaction.presenter.pauseIngress(this.currentPauseCard());
      if (transaction.audioReleaseAttempted) {
        this.restorePauseAudioAfterNavigationRollback(transaction);
      }
      transaction.status = 'rolled-back';
    } catch (error) {
      const quiesceFailures: unknown[] = [];
      if (resumedScene?.active) {
        collectCleanupFailure(
          quiesceFailures,
          () => resumedScene?.suspendComboBirdLayerForNavigation(),
        );
      }
      const failure = (
        error instanceof ComboBirdLifecycleRollbackError
        && quiesceFailures.length === 0
          ? error
          : new ComboBirdLifecycleRollbackError(
            'Combo Bird Pause Quit rollback failed',
            new Error(
              'Combo Bird Pause Quit request did not settle',
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
      'Rolled-back Combo Bird Pause Quit notification',
      notificationFailures,
    );
  }

  private releasePauseAudioForNavigation(): void {
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
    collectCleanupFailure(
      failures,
      () => this.requireClassicGameplayController()
        .sharedAudioPresenter.stopBackgroundMusic(),
    );
    if (failures.length > 0) {
      throw cleanupError(
        'Combo Bird Pause Quit audio release',
        failures,
      );
    }
  }

  private restorePauseAudioAfterNavigationRollback(
    snapshot: ComboBirdPauseAudioLeaseSnapshot,
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
    if (snapshot.musicPauseLeaseRequired) {
      collectCleanupFailure(
        failures,
        () => this.requireClassicGameplayController()
          .sharedAudioPresenter.pauseBackgroundMusic(),
      );
    }
    if (failures.length > 0) {
      throw cleanupError(
        'Combo Bird Pause Quit audio rollback',
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
      throw cleanupError('Combo Bird stop-all-effects', failures);
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
      throw new Error('Combo Bird Result parent can be captured only once');
    }
    const transaction: ComboBirdResultEntryTransaction = {
      configuration: null,
      comboBirdRoot: root,
      presenter: null,
      root: null,
      status: 'pending',
    };
    this.pendingCapturedRoot = root;
    this.pendingResultEntryTransaction = transaction;
    const participant: ComboBirdTimeUpFinishParticipant = Object.freeze({
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
        'Combo Bird Result construction can begin only once',
      );
    }
    this.pendingResultConfiguration = {};
  }

  private setPendingResultMode(
    mode: typeof COMBO_BIRD_RESULT_MODE_ID,
  ): void {
    if (
      this.pendingResultConfiguration === null
      || this.pendingResultConfiguration.mode !== undefined
      || mode !== COMBO_BIRD_RESULT_MODE_ID
    ) {
      throw new Error('Combo Bird Result mode must be exactly 5');
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
      throw new Error(
        'Combo Bird Result score requires one safe-integer sample',
      );
    }
    this.pendingResultConfiguration = {
      ...this.pendingResultConfiguration,
      score,
    };
  }

  private configuredResult(): ComboBirdResultConfiguration {
    const pending = this.pendingResultConfiguration;
    if (
      pending === null
      || pending.mode !== COMBO_BIRD_RESULT_MODE_ID
      || pending.score === undefined
    ) {
      throw new Error(
        'Combo Bird Result must be constructed, mode-set, and score-set',
      );
    }
    return Object.freeze({
      mode: pending.mode,
      score: pending.score,
    });
  }

  private detachModeForResult(cleanup: true): void {
    if (cleanup !== true) {
      throw new Error('Combo Bird Result removal requires cleanup');
    }
    this.configuredResult();
    const root = this.requireModeRoot();
    if (this.pendingCapturedRoot !== root) {
      throw new Error(
        'Combo Bird Result removal lost the captured gameplay parent',
      );
    }
    const detached = this.requireScreenPlacement().detachCurrentScreen(root);
    if (detached !== root || root.parent !== null) {
      throw new Error(
        'Combo Bird Result removal detached an unexpected current screen',
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
      || transaction.comboBirdRoot !== this.pendingCapturedRoot
      || transaction.status !== 'pending'
    ) {
      throw new Error(
        'Combo Bird Result must attach once to an empty host at z-order 1',
      );
    }
    transaction.configuration = configured;
    const settings = this.sharedSettingsRuntime;
    const ranking = insertComboBirdResultScore(
      configured.score,
      settings.state.birdComboLeaderboard,
    );
    const panelValues = comboBirdLeaderboardPanelValues(ranking.leaderboard);
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
      'ComboBirdResultPresentationRoot',
      this.node,
    );
    transaction.root = root;
    this.resultPresentationRoot = root;
    this.resultPresenter = presenter;
    this.requireScreenPlacement().attachCurrentScreen(root);
    presenter.attach(root);
  }

  private prepareResultCommit(
    transaction: ComboBirdResultEntryTransaction,
  ): void {
    const configured = this.configuredResult();
    const resultRoot = transaction.root;
    const presenter = transaction.presenter;
    if (
      this.pendingResultEntryTransaction !== transaction
      || this.pendingCapturedRoot !== transaction.comboBirdRoot
      || resultRoot === null
      || presenter === null
      || this.resultPresentationRoot !== resultRoot
      || this.resultPresenter !== presenter
      || transaction.configuration?.mode !== configured.mode
      || transaction.configuration.score !== configured.score
      || transaction.comboBirdRoot.parent !== null
      || this.requireScreenPlacement().currentScreen !== resultRoot
    ) {
      throw new Error(
        'Combo Bird Result can commit only from its provisional boundary',
      );
    }
    transaction.status = 'prepared';
  }

  private commitResultTransition(
    transaction: ComboBirdResultEntryTransaction,
  ): void {
    if (transaction.status === 'committed') {
      return;
    }
    if (transaction.status !== 'prepared' || transaction.configuration === null) {
      throw new Error(
        'Combo Bird Result transaction must prepare before commit',
      );
    }
    const configured = transaction.configuration;
    this.sharedSettingsRuntime.state.recordComboBirdResultScore(
      configured.score,
    );
    transaction.status = 'committed';
    this.pendingResultEntryTransaction = null;

    const retainedConfiguration: ComboBirdPendingResultConfiguration = {
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
    } finally {
      this.installRunOwnership(this.createEmptyRunOwnership());
      this.pendingResultConfiguration = retainedConfiguration;
    }
    collectCleanupFailure(failures, () => this.emitSnapshot());
    reportCleanupFailures(
      'Committed Combo Bird-to-Result cleanup',
      failures,
    );
  }

  private rollbackResultTransition(
    transaction: ComboBirdResultEntryTransaction,
  ): void {
    if (transaction.status === 'rolled-back') {
      return;
    }
    if (transaction.status === 'committed') {
      throw new Error(
        'Committed Combo Bird Result transaction cannot roll back',
      );
    }
    if (
      this.pendingResultEntryTransaction !== transaction
      || this.pendingCapturedRoot !== transaction.comboBirdRoot
      || this.modeRoot !== transaction.comboBirdRoot
      || !isValid(transaction.comboBirdRoot, true)
    ) {
      throw new Error(
        'Combo Bird Result rollback lost its retained gameplay owner',
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
            'Combo Bird Result rollback detached an unexpected Result',
          );
        }
      });
    }
    if (placement.currentScreen === null) {
      collectCleanupFailure(
        failures,
        () => placement.attachCurrentScreen(transaction.comboBirdRoot),
      );
    }
    if (placement.currentScreen !== transaction.comboBirdRoot) {
      failures.push(new Error(
        'Combo Bird Result rollback could not restore gameplay',
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
      throw cleanupError('Combo Bird Result rollback', failures);
    }
  }

  private readonly onResultRetry = (): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    try {
      this.restartFromResult();
    } catch (error) {
      const failure = normalizeError(error, 'Combo Bird Retry failed');
      if (this.resultPresenter?.state.navigation === 'retry') {
        this.resultPresenter.rearmNavigationAfterFailure('retry');
      }
      const payload: ComboBirdResultRetryFailedEvent = Object.freeze({
        message: failure.message,
        reason: 'restart-error',
      });
      this.node.emit(COMBO_BIRD_RESULT_RETRY_FAILED_EVENT, payload);
      console.error(failure);
    }
  };

  private restartFromResult(): void {
    this.drainRetiredRuns();
    const configured = this.configuredResult();
    const retainedConfiguration: ComboBirdPendingResultConfiguration = {
      mode: configured.mode,
      score: configured.score,
    };
    const resultRoot = this.requireAttachedResultRoot();
    const resultPresenter = this.requireResultPresenter();
    const placement = this.requireScreenPlacement();
    const scene = this.requireSceneController();
    const commands = createComboBirdResultNavigationCommands({
      effectsEnabled: this.effectsEnabled(),
      mode: COMBO_BIRD_RESULT_MODE_ID,
      route: 'retry',
    });
    let captured = false;
    let detached = false;
    let objectiveRollback: ComboBirdActivationObjectiveRollback | null = null;
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
              throw new Error('Combo Bird Retry lost Result before capture');
            }
            captured = true;
            break;
          case 'remove-result':
            if (!captured || command.cleanup !== true) {
              throw new Error(
                'Combo Bird Retry must capture Result before removal',
              );
            }
            if (placement.detachCurrentScreen(resultRoot) !== resultRoot) {
              throw new Error(
                'Combo Bird Retry detached an unexpected Result',
              );
            }
            detached = true;
            break;
          case 'construct-combo-bird':
            if (
              !detached
              || !command.fresh
              || command.mode !== COMBO_BIRD_RESULT_MODE_ID
            ) {
              throw new Error(
                'Combo Bird Retry requires fresh mode-5 construction',
              );
            }
            this.constructMode();
            break;
          case 'attach-combo-bird-to-captured-parent':
            if (command.zOrder !== 1) {
              throw new Error(
                'Combo Bird Retry requires recovered z-order 1',
              );
            }
            objectiveRollback = this.captureActivationObjectiveRollback();
            this.attachModeAndActivateScene(placement);
            break;
          case 'construct-main-menu':
          case 'attach-main-menu-to-captured-parent':
            throw new Error(
              `Unexpected Combo Bird Retry command ${command.type}`,
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
          () => scene.releaseComboBirdLayerForReplacement(),
        );
      }
      this.quiesceSceneAfterFailedRelease(
        scene,
        'Combo Bird Retry rollback',
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
          'Combo Bird Retry rollback could not restore Result ownership',
        ));
      }
      collectCleanupFailure(
        failures,
        () => resultPresenter.rearmNavigationAfterFailure('retry'),
      );
      if (failures.length > 0) {
        const failure = new ComboBirdLifecycleRollbackError(
          'Combo Bird Retry rollback failed',
          error,
          failures,
        );
        this.retainFatalLifecycleBoundary(failure);
        throw failure;
      }
      if (error instanceof ComboBirdLifecycleRollbackError) {
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
      'Committed Combo Bird Retry Result cleanup',
      failures,
    );
  }

  private readonly onResultMenu = (): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    const presenter = this.requireResultPresenter();
    let transaction: ComboBirdResultMenuTransaction | null = null;
    try {
      const configured = this.configuredResult();
      const root = this.requireAttachedResultRoot();
      const activeTransaction: ComboBirdResultMenuTransaction = {
        presenter,
        root,
        screenPlacement: this.requireScreenPlacement(),
        status: 'pending',
      };
      transaction = activeTransaction;
      for (const command of createComboBirdResultNavigationCommands({
        effectsEnabled: this.effectsEnabled(),
        mode: COMBO_BIRD_RESULT_MODE_ID,
        route: 'main-menu',
      })) {
        this.emitCommand(command);
        if (command.type === 'request-menu-button-audio') {
          this.requireClassicGameplayController()
            .sharedAudioPresenter.playOneShot(command.canonicalPath);
        }
      }
      const payload: ComboBirdResultMenuRequestedEvent = Object.freeze({
        completedRunScore: configured.score,
        resultRoot: root,
        commit: (previousRoot: Node) => (
          this.commitResultMenu(activeTransaction, previousRoot)
        ),
        rollback: () => this.rollbackResultMenu(activeTransaction),
      });
      this.node.emit(COMBO_BIRD_RESULT_MENU_REQUESTED_EVENT, payload);
    } catch (error) {
      if (transaction !== null && transaction.status === 'pending') {
        try {
          this.rollbackResultMenu(transaction);
        } catch (rollbackError) {
          const failure = new ComboBirdLifecycleRollbackError(
            'Combo Bird Result menu rollback failed',
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
          const failure = new ComboBirdLifecycleRollbackError(
            'Combo Bird Result menu rearm failed',
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
        const failure = new ComboBirdLifecycleRollbackError(
          'Combo Bird Result menu settlement failed',
          new Error(
            'Combo Bird Result menu request returned without settlement',
          ),
          [error],
        );
        this.retainFatalLifecycleBoundary(failure);
        throw failure;
      }
    }
  };

  private commitResultMenu(
    transaction: ComboBirdResultMenuTransaction,
    previousRoot: Node,
  ): void {
    if (transaction.status === 'committed') {
      return;
    }
    if (previousRoot !== transaction.root) {
      throw new Error(
        'Combo Bird Result menu commit received an unexpected previous screen',
      );
    }
    if (transaction.status === 'rolled-back') {
      throw new Error(
        'Rolled-back Combo Bird Result menu cannot commit',
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
        'Combo Bird Result menu commit requires successful replacement',
      );
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
    reportCleanupFailures(
      'Committed Combo Bird Result menu cleanup',
      failures,
    );
  }

  private rollbackResultMenu(
    transaction: ComboBirdResultMenuTransaction,
  ): void {
    if (transaction.status === 'rolled-back') {
      return;
    }
    if (transaction.status === 'committed') {
      throw new Error(
        'Committed Combo Bird Result menu cannot roll back',
      );
    }
    if (
      this.resultPresentationRoot !== transaction.root
      || this.resultPresenter !== transaction.presenter
      || !isValid(transaction.root, true)
    ) {
      throw new Error(
        'Combo Bird Result menu rollback lost Result ownership',
      );
    }
    const current = transaction.screenPlacement.currentScreen;
    if (current !== transaction.root) {
      if (transaction.root.parent !== null) {
        throw new Error(
          'Combo Bird Result menu rollback found Result under an unknown owner',
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
        'Combo Bird Result menu rollback could not restore and rearm Result',
      );
    }
    transaction.status = 'rolled-back';
    const notificationFailures: unknown[] = [];
    collectCleanupFailure(
      notificationFailures,
      () => this.emitSnapshot(),
    );
    reportCleanupFailures(
      'Rolled-back Combo Bird Result menu notification',
      notificationFailures,
    );
  }

  private readonly onResultTotalCoinsEntranceComplete = (): number => {
    if (this.pendingResultEntryTransaction !== null) {
      throw new Error(
        'Combo Bird Result reward cannot commit before Time-Up Finish',
      );
    }
    const configured = this.configuredResult();
    const award = this.sharedSettingsRuntime.state.awardComboBirdResultCoins(
      configured.score,
    );
    const payload: ComboBirdResultRewardReadyEvent = Object.freeze({
      bonusCoins: award.bonusCoins,
      completedRunScore: configured.score,
      totalCoins: award.totalCoins,
    });
    this.node.emit(COMBO_BIRD_RESULT_REWARD_READY_EVENT, payload);
    return award.bonusCoins;
  };

  private readonly onObjectiveAchievement = (
    event: ObjectiveAchievementPopupEvent,
  ): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    let presenter: ObjectiveAchievementPresenter | null = null;
    try {
      if (this.effectsEnabled()) {
        this.requireClassicGameplayController()
          .sharedAudioPresenter.playOneShot(CLASSIC_OBJECTIVE_CHEER_AUDIO_PATH);
      }
      presenter = ObjectiveAchievementPresenter.create({
        event,
        random: this.sharedGameplayRandom,
        resources: this.requireBaseGameplayResources(),
        viewport: this.requireViewport(),
      });
      presenter.attach(this.requireObjectiveAchievementTargetRoot());
      this.objectiveAchievementPresenters.add(presenter);
    } catch (error) {
      const failures: unknown[] = [];
      if (presenter !== null) {
        const failedPresenter = presenter;
        this.objectiveAchievementPresenters.delete(failedPresenter);
        collectCleanupFailure(failures, () => failedPresenter.dispose());
      }
      reportObjectiveAchievementPresentationFailure(
        'Combo Bird objective achievement presentation failed',
        error,
        failures,
      );
    }
  };

  private captureActivationObjectiveRollback():
    ComboBirdActivationObjectiveRollback | null {
    const manager = this.requireObjectivesManager();
    const active = manager.activeObjective();
    if (active?.id !== 49) {
      return null;
    }
    return Object.freeze({
      objectiveId: 49,
      value: manager.value(49),
    });
  }

  private restoreActivationObjective(
    rollback: ComboBirdActivationObjectiveRollback,
  ): void {
    if (!this.requireObjectivesManager().setValue(
      rollback.objectiveId,
      rollback.value,
    )) {
      throw new Error(
        'Combo Bird activation could not restore objective progress',
      );
    }
  }

  private captureRunOwnership(): ComboBirdRunOwnership {
    return {
      birdBladePresenter: this.birdBladePresenter,
      birdBladeRayAdapter: this.birdBladeRayAdapter,
      combo: this.combo,
      comboItemPresenters: this.comboItemPresenters,
      criticalCutHalfPresenters: this.criticalCutHalfPresenters,
      criticalParticlePresenters: this.criticalParticlePresenters,
      cutHalfPresenters: this.cutHalfPresenters,
      instructionAttachments: this.instructionAttachments,
      introPresenter: this.introPresenter,
      modeRoot: this.modeRoot,
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

  private createEmptyRunOwnership(): ComboBirdRunOwnership {
    return {
      birdBladePresenter: null,
      birdBladeRayAdapter: null,
      combo: null,
      comboItemPresenters: new Set<ComboItemPresenter>(),
      criticalCutHalfPresenters: new Set<ClassicCutHalfPresenter>(),
      criticalParticlePresenters: new Set<ClassicCriticalParticlePresenter>(),
      cutHalfPresenters: new Set<ClassicCutHalfPresenter>(),
      instructionAttachments: new Set<ComboBirdInstructionCard>(),
      introPresenter: null,
      modeRoot: null,
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

  private installRunOwnership(ownership: ComboBirdRunOwnership): void {
    this.birdBladePresenter = ownership.birdBladePresenter;
    this.birdBladeRayAdapter = ownership.birdBladeRayAdapter;
    this.combo = ownership.combo;
    this.comboItemPresenters = ownership.comboItemPresenters;
    this.criticalCutHalfPresenters = ownership.criticalCutHalfPresenters;
    this.criticalParticlePresenters = ownership.criticalParticlePresenters;
    this.cutHalfPresenters = ownership.cutHalfPresenters;
    this.instructionAttachments = ownership.instructionAttachments;
    this.introPresenter = ownership.introPresenter;
    this.modeRoot = ownership.modeRoot;
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
    activeScene: ComboBirdSceneController,
  ): ComboBirdSceneController {
    let standby = this.standbySceneController;
    if (standby === null || !isValid(standby, true)) {
      const existing = this.node
        .getComponents(ComboBirdSceneController)
        .filter((scene) => scene !== activeScene && isValid(scene, true));
      if (existing.length > 1) {
        throw new Error(
          'Combo Bird Replay found more than one standby scene lease',
        );
      }
      if (existing.length === 1) {
        [standby] = existing;
      } else {
        try {
          standby = this.node.addComponent(ComboBirdSceneController);
        } catch (error) {
          const failures: unknown[] = [];
          for (const partial of this.node.getComponents(
            ComboBirdSceneController,
          )) {
            if (partial !== activeScene && isValid(partial, true)) {
              collectCleanupFailure(failures, () => partial.destroy());
            }
          }
          this.standbySceneController = null;
          if (failures.length > 0) {
            throw aggregateWithPrimary(
              'Combo Bird standby construction rollback failed',
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
      .getComponents(ComboBirdSceneController)
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
      this.standbySceneController = null;
      throw new Error(
        'Combo Bird Replay requires one inactive standby scene lease',
      );
    }
    return standby;
  }

  private restoreRetainedSwishCooldown(
    ownership: ComboBirdRunOwnership,
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
    const retained: RetiredComboBirdRunOwnership[] = [];
    const failures: unknown[] = [];
    try {
      for (const retired of this.retiredRuns) {
        this.installRunOwnership(retired.ownership);
        this.comboBirdSceneController = retired.scene;
        if (retired.scene.active) {
          collectCleanupFailure(
            failures,
            () => retired.scene.releaseComboBirdLayerForReplacement(),
          );
        }
        this.quiesceSceneAfterFailedRelease(
          retired.scene,
          'Retired Combo Bird run cleanup',
          failures,
        );
        if (retired.scene.suspended) {
          collectCleanupFailure(
            failures,
            () => retired.scene.finalizeSuspendedComboBirdLayerRelease(),
          );
        }
        if (retired.scene.active || retired.scene.suspended) {
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
      this.comboBirdSceneController = activeScene;
      this.retiredRuns.length = 0;
      this.retiredRuns.push(...retained);
    }
    if (failures.length > 0) {
      throw cleanupError('Retired Combo Bird run ownership', failures);
    }
  }

  private retainFatalLifecycleBoundary(
    error: ComboBirdLifecycleRollbackError,
  ): void {
    this.lifecycleFatalError ??= error;
    this.unschedule(this.onSwishCooldownComplete);
  }

  private quiesceSceneAfterFailedRelease(
    scene: ComboBirdSceneController,
    label: string,
    failures: unknown[],
  ): void {
    if (scene.active) {
      collectCleanupFailure(
        failures,
        () => scene.releaseComboBirdLayerForReplacement(),
      );
    }
    if (scene.active) {
      collectCleanupFailure(
        failures,
        () => scene.suspendComboBirdLayerForNavigation(),
      );
    }
    if (scene.active) {
      failures.push(new Error(
        `${label} retained an active Bird input/Physics2D lease`,
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
            'Combo Bird teardown detached an unexpected current screen',
          );
        }
      });
    }

    this.unschedule(this.onSwishCooldownComplete);
    this.swishAudio?.unlock();
    this.swishAudio = null;
    for (const presenter of Array.from(this.cutHalfPresenters)) {
      try {
        presenter.disposeAll();
        this.cutHalfPresenters.delete(presenter);
        this.criticalCutHalfPresenters.delete(presenter);
      } catch (error) {
        failures.push(error);
      }
    }
    for (const presenter of Array.from(this.criticalParticlePresenters)) {
      try {
        presenter.dispose();
        this.criticalParticlePresenters.delete(presenter);
      } catch (error) {
        failures.push(error);
      }
    }
    for (const presenter of Array.from(this.comboItemPresenters)) {
      try {
        presenter.dispose();
        this.comboItemPresenters.delete(presenter);
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
    const blade = this.birdBladePresenter;
    if (blade !== null) {
      try {
        blade.dispose();
        if (this.birdBladePresenter === blade) {
          this.birdBladePresenter = null;
          this.birdBladeRayAdapter = null;
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
            'Combo Bird registry drain retained an entity owner',
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
      && this.introPresenter === null
      && this.timeManagerPresenter === null
      && this.birdBladePresenter === null
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
      throw cleanupError('Combo Bird mode presentation', failures);
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
      throw cleanupError('Combo Bird Result presentation', failures);
    }
  }

  private disposePreparation(): void {
    const failures: unknown[] = [];
    for (const presenter of Array.from(this.objectiveAchievementPresenters)) {
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
    if (
      this.timerAudio === null
      && this.objectiveAchievementPresenters.size === 0
      && this.objectiveAchievementTargetRoot === null
    ) {
      this.baseGameplayResources = null;
      this.birdResources = null;
      this.comboBirdResources = null;
      this.objectivesManager = null;
      if (this.shuttingDown) {
        this.readinessStatus = 'idle';
      }
    }
    if (failures.length > 0) {
      throw cleanupError('Combo Bird preparation', failures);
    }
  }

  private disposeStandbySceneController(): void {
    const standby = this.standbySceneController;
    if (
      standby !== null
      && standby !== this.comboBirdSceneController
      && isValid(standby, true)
    ) {
      standby.destroy();
    }
    this.standbySceneController = null;
  }

  private releaseSceneForTeardown(): void {
    const scene = this.comboBirdSceneController;
    if (scene === null || !isValid(scene, true)) {
      return;
    }
    if (scene.active) {
      scene.releaseComboBirdLayerForReplacement();
    } else if (scene.suspended) {
      scene.finalizeSuspendedComboBirdLayerRelease();
    }
  }

  private stopRunEffectsForTeardown(): void {
    const failures: unknown[] = [];
    const timerAudio = this.timerAudio;
    const classic = this.classicGameplayController;
    if (timerAudio !== null) {
      collectCleanupFailure(failures, () => timerAudio.stopAllEffects());
    }
    if (classic !== null) {
      collectCleanupFailure(
        failures,
        () => classic.sharedAudioPresenter.stopAllEffects(),
      );
    }
    if (failures.length > 0) {
      throw cleanupError('Combo Bird teardown stop-all-effects', failures);
    }
  }

  private requireClassicGameplayController(): ClassicGameplayController {
    if (this.classicGameplayController === null) {
      throw new Error(
        'Combo Bird requires its Classic process owner after onLoad',
      );
    }
    return this.classicGameplayController;
  }

  private requireSceneController(): ComboBirdSceneController {
    if (this.comboBirdSceneController === null) {
      throw new Error(
        'Combo Bird scene controller is unavailable before onLoad',
      );
    }
    return this.comboBirdSceneController;
  }

  private requireResolution(): NonNullable<
    ReturnType<ClassicSceneController['resolutionSnapshot']>
  > {
    const resolution = this.classicSceneController?.resolutionSnapshot();
    if (resolution === null || resolution === undefined) {
      throw new Error(
        'Combo Bird requires the prepared shared resolution profile',
      );
    }
    return resolution;
  }

  private requireViewport(): ComboBirdViewport {
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
        'Combo Bird base-gameplay resources are unavailable before preparation',
      );
    }
    return this.baseGameplayResources;
  }

  private requireBirdResources(): LoadedBirdResources {
    const resources = this.birdResources;
    if (
      resources === null
      || resources.birdType !== COMBO_BIRD_BLADE_TYPE
    ) {
      throw new Error(
        'Combo Bird type-3 Bird resources are unavailable before preparation',
      );
    }
    return resources;
  }

  private requireComboBirdResources(): LoadedComboBirdResources {
    if (this.comboBirdResources === null) {
      throw new Error(
        'Combo Bird supplemental resources are unavailable before preparation',
      );
    }
    return this.comboBirdResources;
  }

  private requireTimerAudio(): TimeManagerAudioPresenter {
    if (this.timerAudio === null) {
      throw new Error(
        'Combo Bird timer audio is unavailable before preparation',
      );
    }
    return this.timerAudio;
  }

  private requireObjectivesManager(): ObjectivesManagerState {
    if (this.objectivesManager === null) {
      throw new Error(
        'Combo Bird objectives manager is unavailable before preparation',
      );
    }
    return this.objectivesManager;
  }

  private requireObjectiveAchievementTargetRoot(): Node {
    const root = this.objectiveAchievementTargetRoot;
    if (root === null || !isValid(root, true)) {
      throw new Error(
        'Combo Bird objective-achievement target is unavailable',
      );
    }
    return root;
  }

  private requireModeRoot(): Node {
    const root = this.modeRoot;
    if (root === null || !isValid(root, true)) {
      throw new Error('Combo Bird mode root is unavailable');
    }
    return root;
  }

  private requireDetachedModeRoot(): Node {
    const root = this.requireModeRoot();
    if (root.parent !== null) {
      throw new Error(
        'Combo Bird mode root must be detached before shell attachment',
      );
    }
    return root;
  }

  private requireWorldPresentationRoot(): Node {
    const root = this.worldPresentationRoot;
    if (root === null || !isValid(root, true)) {
      throw new Error(
        'Combo Bird world presentation root is unavailable',
      );
    }
    return root;
  }

  private requireScoreHudRoot(): Node {
    const root = this.scoreHudRoot;
    if (root === null || !isValid(root, true)) {
      throw new Error(
        'Combo Bird score-HUD root is unavailable',
      );
    }
    return root;
  }

  private requireRegistry(): ClassicEntityRegistry {
    if (this.registry === null) {
      throw new Error('Combo Bird entity registry is unavailable');
    }
    return this.registry;
  }

  private requireCombo(): ComboService {
    if (this.combo === null) {
      throw new Error('Combo Bird combo service is unavailable');
    }
    return this.combo;
  }

  private requireSwishAudio(): ClassicSwishAudioGate {
    if (this.swishAudio === null) {
      throw new Error('Combo Bird swish audio gate is unavailable');
    }
    return this.swishAudio;
  }

  private requireBirdBladePresenter(): BirdBladePresenter {
    if (this.birdBladePresenter === null) {
      throw new Error('Combo Bird BirdBlade presenter is unavailable');
    }
    return this.birdBladePresenter;
  }

  private requireIntroPresenter(): ComboBirdIntroPresenter {
    if (this.introPresenter === null) {
      throw new Error('Combo Bird intro presenter is unavailable');
    }
    return this.introPresenter;
  }

  private requireTimeManagerPresenter(): TimeManagerPresenter {
    if (this.timeManagerPresenter === null) {
      throw new Error('Combo Bird TimeManager presenter is unavailable');
    }
    return this.timeManagerPresenter;
  }

  private requireScoreHudPresenter(): ClassicScoreHudPresenter {
    if (this.scoreHudPresenter === null) {
      throw new Error('Combo Bird score-HUD presenter is unavailable');
    }
    return this.scoreHudPresenter;
  }

  private requirePausePresenter(): BaseGameplayPausePresenter {
    if (this.pausePresenter === null) {
      throw new Error(
        'Combo Bird pause presenter is unavailable before scene entry',
      );
    }
    return this.pausePresenter;
  }

  private requireScreenPlacement(): ComboBirdScreenPlacementPort {
    if (this.screenPlacement === null) {
      throw new Error(
        'Combo Bird current-screen placement is unavailable',
      );
    }
    return this.screenPlacement;
  }

  private requirePendingResultTransition():
    ComboBirdResultEntryTransaction {
    const transaction = this.pendingResultEntryTransaction;
    if (transaction === null || transaction.status !== 'pending') {
      throw new Error('Combo Bird Result transition is not pending');
    }
    return transaction;
  }

  private requireResultPresenter(): ClassicResultPresenter {
    if (this.resultPresenter === null) {
      throw new Error('Combo Bird Result presenter is unavailable');
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
        'Combo Bird Result must be the active current screen',
      );
    }
    return root;
  }

  private isComboBirdGameplayAttached(): boolean {
    const root = this.modeRoot;
    return (
      this.lifecycleFatalError === null
      && root !== null
      && isValid(root, true)
      && root.parent !== null
      && this.screenPlacement?.currentScreen === root
      && root.activeInHierarchy
      && this.comboBirdSceneController?.active === true
    );
  }

  private assertPreparationStillUsable(): void {
    if (this.shuttingDown || !isValid(this.node, true)) {
      throw new Error(
        'Combo Bird runtime preparation completed after destruction',
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
      this.node.emit(COMBO_BIRD_GAMEPLAY_COMMAND_EVENT, command);
    }
  }

  private emitSnapshot(): void {
    if (!this.shuttingDown && isValid(this.node, true)) {
      this.node.emit(COMBO_BIRD_GAMEPLAY_SNAPSHOT_EVENT, this.snapshot());
    }
  }
}

function createPresenterRoot(parent: Node, name: string): Node {
  const root = new Node(name);
  root.layer = parent.layer;
  root.setParent(parent);
  return root;
}

function createVisibleRect(viewport: ComboBirdViewport): Readonly<{
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
  command: ComboBirdTossRuntimeCommand,
): command is Extract<
  ClassicTossStrategyCommand,
  Readonly<{ readonly entityOccurrenceId: number }>
> {
  return 'entityOccurrenceId' in command;
}

function assertComboBirdController(
  controller: ComboBirdTossControllerId,
): void {
  if (!COMBO_BIRD_TOSS_CREATION_ORDER.some((candidate) => (
    candidate === controller
  ))) {
    throw new Error(
      `Unsupported Combo Bird toss controller ${controller}`,
    );
  }
}

function assertScreenPlacementPort(
  screenPlacement: ComboBirdScreenPlacementPort,
): void {
  if (
    screenPlacement === null
    || typeof screenPlacement !== 'object'
    || typeof screenPlacement.attachCurrentScreen !== 'function'
    || typeof screenPlacement.detachCurrentScreen !== 'function'
    || typeof screenPlacement.replaceCurrentScreen !== 'function'
  ) {
    throw new TypeError(
      'Combo Bird screen placement must implement the current-screen port',
    );
  }
}

function containsLifecycleRollbackError(error: unknown): boolean {
  if (error instanceof ComboBirdLifecycleRollbackError) {
    return true;
  }
  if (error instanceof Error && 'failures' in error) {
    const failures = (error as Error & { failures?: unknown }).failures;
    return Array.isArray(failures)
      && failures.some(containsLifecycleRollbackError);
  }
  return false;
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

function cleanupError(label: string, failures: readonly unknown[]): Error {
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

function assertNever(value: never): never {
  throw new Error(`Unsupported Combo Bird command: ${String(value)}`);
}
