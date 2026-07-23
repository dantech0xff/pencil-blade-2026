import {
  _decorator,
  Collider2D,
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
import {
  createClassicCriticalParticleUpdateCommands,
} from '../domain/classic-critical-particle-plan';
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
import type { FailCommand } from '../domain/fail-service';
import { FailService } from '../domain/fail-service';
import {
  CRAZY_SPECIAL_FRUIT_BASE_CUT_AUDIO_PATH,
  executeCrazyBombElectricHitAudio,
  type CrazyAudioCommand,
} from '../domain/crazy-audio-contract';
import {
  createClassicBirdResultNavigationCommands,
  type ClassicBirdResultNavigationCommand,
} from '../domain/classic-bird-result-navigation';
import {
  CLASSIC_BIRD_RESULT_MODE_ID,
  classicBirdLeaderboardPanelValues,
  insertClassicBirdResultScore,
} from '../domain/classic-bird-result-ranking';
import type {
  ClassicBirdSessionCommand,
  ClassicBirdSessionSnapshot,
} from '../domain/classic-bird-session';
import type {
  ClassicBirdTossControllerId,
} from '../domain/classic-bird-toss-config';
import {
  ClassicBirdTossCoordinator,
  type ClassicBirdTossRuntimeCommand,
} from '../domain/classic-bird-toss-coordinator';
import {
  partitionCrazyRuntimeCommands,
  type CrazyRuntimeCommandBatch,
} from '../domain/crazy-runtime-command-batches';
import type { GameplayRandom } from '../domain/gameplay-random';
import type { ObjectivesManagerState } from '../domain/objectives-manager-state';
import { sampleSpawnKinematics } from '../domain/spawn-kinematics';
import {
  StandardBombExplosionCompletion,
} from '../domain/standard-bomb-explosion-completion';
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
import type {
  ClassicRetainedAudioHandle,
} from './classic-audio-presenter';
import {
  CLASSIC_BIRD_PHYSICS_STEPPED_EVENT,
  CLASSIC_BIRD_SESSION_COMMAND_EVENT,
  ClassicBirdLifecycleRollbackError,
  ClassicBirdSceneController,
  type ClassicBirdPhysicsSteppedEvent,
  type ClassicBirdResultTransitionParticipant,
} from './classic-bird-scene-controller';
import {
  ClassicBirdWordPresenter,
} from './classic-bird-word-presenter';
import { ComboItemPresenter } from './combo-item-presenter';
import { ClassicCriticalParticlePresenter } from './classic-critical-particle-presenter';
import { ClassicCutHalfPresenter } from './classic-cut-half-presenter';
import { ClassicFailPresenter } from './classic-fail-presenter';
import {
  ClassicGameplayController,
  type ClassicScreenPlacementPort,
} from './classic-gameplay-controller';
import type {
  ClassicGeneratedBomb,
  ClassicGeneratedBombCutEvent,
} from './classic-generated-bomb';
import type {
  ClassicGeneratedFruitCutEvent,
  ClassicGeneratedFruitMissEvent,
} from './classic-generated-fruit';
import { ClassicResultPresenter } from './classic-result-presenter';
import { ClassicSceneController } from './classic-scene-controller';
import { ClassicScoreHudPresenter } from './classic-score-hud-presenter';
import {
  CrazyBombElectricPresenter,
} from './crazy-bomb-electric-presenter';
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
import {
  CrazyGameplayController,
} from './crazy-gameplay-controller';
import { CrazyMagnetPresenter } from './crazy-magnet-presenter';
import { createDetachedScreenRoot } from './detached-screen-root';
import {
  StandardBombExplosionPresenter,
} from './standard-bomb-explosion-presenter';
import {
  StandardBombFuseSmokePresenter,
} from './standard-bomb-fuse-smoke-presenter';

const { ccclass, requireComponent } = _decorator;

export const CLASSIC_BIRD_GAMEPLAY_COMMAND_EVENT
  = 'classic-bird-gameplay-command';
export const CLASSIC_BIRD_GAMEPLAY_SNAPSHOT_EVENT
  = 'classic-bird-gameplay-snapshot';
export const CLASSIC_BIRD_PAUSE_QUIT_REQUESTED_EVENT
  = 'classic-bird-pause-quit-requested';
export const CLASSIC_BIRD_PAUSE_REPLAY_FAILED_EVENT
  = 'classic-bird-pause-replay-failed';
export const CLASSIC_BIRD_RESOURCE_LOAD_FAILED_EVENT
  = 'classic-bird-resource-load-failed';
export const CLASSIC_BIRD_RESULT_MENU_REQUESTED_EVENT
  = 'classic-bird-result-menu-requested';
export const CLASSIC_BIRD_RESULT_RETRY_FAILED_EVENT
  = 'classic-bird-result-retry-failed';
export const CLASSIC_BIRD_RESULT_REWARD_READY_EVENT
  = 'classic-bird-result-reward-ready';

export type ClassicBirdScreenPlacementPort = ClassicScreenPlacementPort;

export type ClassicBirdGameplayReadinessStatus =
  | 'failed'
  | 'idle'
  | 'pending'
  | 'ready';

export interface ClassicBirdGameplayReadiness {
  readonly error: Error | null;
  readonly status: ClassicBirdGameplayReadinessStatus;
}

export interface ClassicBirdGameplaySnapshot {
  readonly activeDragonEffectCount: number;
  readonly activeEntityCount: number;
  readonly displayedScore: number;
  readonly lifecycle: ClassicBirdSessionSnapshot['lifecycle'];
  readonly pendingStandardBombCount: number;
  readonly readiness: ClassicBirdGameplayReadinessStatus;
  readonly resultActive: boolean;
  readonly score: number;
  readonly strikes: number;
}

export interface ClassicBirdPauseQuitRequestedEvent {
  readonly classicBirdRoot: Node;
  commit(previousRoot: Node): void;
  rollback(): void;
}

export interface ClassicBirdPauseReplayFailedEvent {
  readonly message: string;
  readonly reason: 'restart-error';
}

export interface ClassicBirdResultMenuRequestedEvent {
  readonly completedRunScore: number;
  readonly resultRoot: Node;
  commit(previousRoot: Node): void;
  rollback(): void;
}

export interface ClassicBirdResultRetryFailedEvent {
  readonly message: string;
  readonly reason: 'restart-error';
}

export interface ClassicBirdResultRewardReadyEvent {
  readonly bonusCoins: number;
  readonly completedRunScore: number;
  readonly totalCoins: number;
}

interface ClassicBirdViewport {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

interface ClassicBirdResultConfiguration {
  readonly mode: typeof CLASSIC_BIRD_RESULT_MODE_ID;
  readonly score: number;
}

interface ClassicBirdPendingResultConfiguration {
  mode?: typeof CLASSIC_BIRD_RESULT_MODE_ID;
  score?: number;
}

interface ClassicBirdResultEntryTransaction {
  configuration: ClassicBirdResultConfiguration | null;
  readonly classicBirdRoot: Node;
  presenter: ClassicResultPresenter | null;
  root: Node | null;
  status: 'committed' | 'pending' | 'prepared' | 'rolled-back';
}

interface ClassicBirdResultMenuTransaction {
  readonly presenter: ClassicResultPresenter;
  readonly root: Node;
  readonly screenPlacement: ClassicBirdScreenPlacementPort;
  status: 'committed' | 'pending' | 'rolled-back';
}

interface ClassicBirdPauseQuitTransaction {
  readonly presenter: BaseGameplayPausePresenter;
  readonly root: Node;
  readonly screenPlacement: ClassicBirdScreenPlacementPort;
  status: 'committed' | 'pending' | 'rolled-back';
}

interface ClassicBirdCutPresentationEvent {
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

interface StandardBombExplosionOwner {
  readonly completion: StandardBombExplosionCompletion;
  readonly presenter: StandardBombExplosionPresenter;
  runGeneration: number | null;
}

interface ClassicBirdRunOwnership {
  readonly birdBladePresenter: BirdBladePresenter | null;
  readonly birdBladeRayAdapter: BirdBladeRayAdapter<BirdPhysicsRayHit> | null;
  readonly bombElectricPresenter: CrazyBombElectricPresenter | null;
  readonly combo: ComboService | null;
  readonly comboItemPresenters: Set<ComboItemPresenter>;
  readonly coordinator: ClassicBirdTossCoordinator | null;
  readonly criticalCutHalfPresenters: Set<ClassicCutHalfPresenter>;
  readonly criticalParticlePresenters: Set<ClassicCriticalParticlePresenter>;
  readonly cutHalfPresenters: Set<ClassicCutHalfPresenter>;
  readonly electricContactAdapter: CrazyElectricContactAdapter | null;
  readonly fail: FailService | null;
  readonly failPresenter: ClassicFailPresenter | null;
  readonly failPresentationRoot: Node | null;
  readonly gameOverPresenter: ClassicBirdWordPresenter | null;
  readonly introPresenter: ClassicBirdWordPresenter | null;
  readonly magnetPresenters: Set<CrazyMagnetPresenter>;
  readonly modeRoot: Node | null;
  readonly pausePresenter: BaseGameplayPausePresenter | null;
  readonly pendingCapturedRoot: Node | null;
  readonly pendingResultConfiguration: ClassicBirdPendingResultConfiguration | null;
  readonly registry: CrazyEntityRegistry | null;
  readonly scoreHudPresenter: ClassicScoreHudPresenter | null;
  readonly scoreHudRoot: Node | null;
  readonly standardBombEntryAudioHandles: Map<string, ClassicRetainedAudioHandle>;
  readonly standardBombExplosionOwners: Map<string, StandardBombExplosionOwner>;
  readonly standardBombFuseSmokePresenters: Map<
    string,
    StandardBombFuseSmokePresenter
  >;
  readonly swishAudio: ClassicSwishAudioGate | null;
  readonly worldPresentationRoot: Node | null;
}

interface RetiredClassicBirdRunOwnership {
  readonly ownership: ClassicBirdRunOwnership;
  readonly scene: ClassicBirdSceneController;
}

interface BirdPhysicsRayHit {
  readonly collider: Collider2D;
}

/**
 * Production process owner for native mode 3.
 *
 * Only the 17-raster Bird supplement belongs to this component. Classic and Crazy retain the
 * process-lifetime RNG, settings, catalogs, fonts, audio, pause assets, and objective manager.
 * Every gameplay/presentation object below is detached, attached, and released per run.
 */
@ccclass('ClassicBirdGameplayController')
@requireComponent(ClassicBirdSceneController)
@requireComponent(BirdInputController)
@requireComponent(ClassicGameplayController)
@requireComponent(CrazyGameplayController)
export class ClassicBirdGameplayController extends Component {
  private birdBladePresenter: BirdBladePresenter | null = null;
  private birdBladeRayAdapter: BirdBladeRayAdapter<BirdPhysicsRayHit> | null = null;
  private birdInputController: BirdInputController | null = null;
  private birdResources: LoadedBirdResources | null = null;
  private bombElectricPresenter: CrazyBombElectricPresenter | null = null;
  private classicBirdSceneController: ClassicBirdSceneController | null = null;
  private classicGameplayController: ClassicGameplayController | null = null;
  private classicSceneController: ClassicSceneController | null = null;
  private combo: ComboService | null = null;
  private comboItemPresenters = new Set<ComboItemPresenter>();
  private coordinator: ClassicBirdTossCoordinator | null = null;
  private crazyGameplayController: CrazyGameplayController | null = null;
  private criticalCutHalfPresenters = new Set<ClassicCutHalfPresenter>();
  private criticalParticlePresenters = new Set<ClassicCriticalParticlePresenter>();
  private cutHalfPresenters = new Set<ClassicCutHalfPresenter>();
  private electricContactAdapter: CrazyElectricContactAdapter | null = null;
  private fail: FailService | null = null;
  private failPresenter: ClassicFailPresenter | null = null;
  private failPresentationRoot: Node | null = null;
  private gameOverPresenter: ClassicBirdWordPresenter | null = null;
  private introPresenter: ClassicBirdWordPresenter | null = null;
  private lifecycleFatalError: ClassicBirdLifecycleRollbackError | null = null;
  private magnetPresenters = new Set<CrazyMagnetPresenter>();
  private modeRoot: Node | null = null;
  private pausePresenter: BaseGameplayPausePresenter | null = null;
  private pendingCapturedRoot: Node | null = null;
  private pendingResultConfiguration: ClassicBirdPendingResultConfiguration | null = null;
  private pendingResultEntryTransaction: ClassicBirdResultEntryTransaction | null = null;
  private preparation: Promise<void> | null = null;
  private preparationError: Error | null = null;
  private readinessStatus: ClassicBirdGameplayReadinessStatus = 'idle';
  private registry: CrazyEntityRegistry | null = null;
  private resultPresenter: ClassicResultPresenter | null = null;
  private resultPresentationRoot: Node | null = null;
  private readonly retiredRuns: RetiredClassicBirdRunOwnership[] = [];
  private scoreHudPresenter: ClassicScoreHudPresenter | null = null;
  private scoreHudRoot: Node | null = null;
  private screenPlacement: ClassicBirdScreenPlacementPort | null = null;
  private shuttingDown = false;
  private standbySceneController: ClassicBirdSceneController | null = null;
  private standardBombEntryAudioHandles =
    new Map<string, ClassicRetainedAudioHandle>();
  private standardBombExplosionOwners =
    new Map<string, StandardBombExplosionOwner>();
  private standardBombFuseSmokePresenters =
    new Map<string, StandardBombFuseSmokePresenter>();
  private swishAudio: ClassicSwishAudioGate | null = null;
  private worldPresentationRoot: Node | null = null;

  onLoad(): void {
    const scene = this.getComponent(ClassicBirdSceneController);
    const input = this.getComponent(BirdInputController);
    const classic = this.getComponent(ClassicGameplayController);
    const crazy = this.getComponent(CrazyGameplayController);
    const classicScene = this.getComponent(ClassicSceneController);
    if (scene === null) {
      throw new Error(
        'ClassicBirdGameplayController requires ClassicBirdSceneController',
      );
    }
    if (input === null) {
      throw new Error(
        'ClassicBirdGameplayController requires BirdInputController',
      );
    }
    if (classic === null) {
      throw new Error(
        'ClassicBirdGameplayController requires ClassicGameplayController',
      );
    }
    if (crazy === null) {
      throw new Error(
        'ClassicBirdGameplayController requires CrazyGameplayController',
      );
    }
    if (classicScene === null) {
      throw new Error(
        'ClassicBirdGameplayController requires the shared Classic resolution owner',
      );
    }
    this.classicBirdSceneController = scene;
    this.birdInputController = input;
    this.classicGameplayController = classic;
    this.crazyGameplayController = crazy;
    this.classicSceneController = classicScene;
  }

  onEnable(): void {
    this.node.on(
      BIRD_BLADE_TOUCH_BEGAN_EVENT,
      this.onBirdBladeTouchBegan,
      this,
    );
    this.node.on(
      CLASSIC_BIRD_PHYSICS_STEPPED_EVENT,
      this.onPhysicsStepped,
      this,
    );
    this.node.on(
      CLASSIC_BIRD_SESSION_COMMAND_EVENT,
      this.onSessionCommand,
      this,
    );
  }

  start(): void {
    // Preparation and activation are explicit app-shell transactions.
    this.emitSnapshot();
  }

  onDisable(): void {
    this.node.off(
      BIRD_BLADE_TOUCH_BEGAN_EVENT,
      this.onBirdBladeTouchBegan,
      this,
    );
    this.node.off(
      CLASSIC_BIRD_PHYSICS_STEPPED_EVENT,
      this.onPhysicsStepped,
      this,
    );
    this.node.off(
      CLASSIC_BIRD_SESSION_COMMAND_EVENT,
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
    collectCleanupFailure(failures, () => this.stopAllBirdRunEffects());
    collectCleanupFailure(failures, () => this.disposeModePresentation());
    collectCleanupFailure(failures, () => this.drainRetiredRuns());
    collectCleanupFailure(failures, () => this.disposeResultPresentation());
    collectCleanupFailure(failures, () => this.disposeStandbySceneController());
    this.birdResources = null;
    this.preparation = null;
    this.screenPlacement = null;
    reportCleanupFailures('Classic Bird gameplay teardown', failures);
  }

  get readiness(): ClassicBirdGameplayReadiness {
    return Object.freeze({
      error: this.preparationError,
      status: this.readinessStatus,
    });
  }

  get prepared(): boolean {
    return this.readinessStatus === 'ready';
  }

  snapshot(): ClassicBirdGameplaySnapshot {
    const session = this.classicBirdSceneController?.sessionSnapshot()
      ?? Object.freeze({
        lifecycle: 'intro',
        score: Object.freeze({
          authoritativeScore: 0,
          displayedScore: 0,
        }),
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
      strikes: this.fail?.count ?? 0,
    });
  }

  /**
   * Prepares Classic, Crazy, and then exactly the dedicated 17-raster Bird closure.
   * A rejected attempt commits no partial Bird owner and may be retried.
   */
  prepareClassicBirdRuntime(): Promise<void> {
    if (this.shuttingDown || !isValid(this.node, true)) {
      throw new Error('Classic Bird runtime cannot prepare after destruction');
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
      const failure = normalizeError(error, 'Classic Bird runtime preparation failed');
      this.preparationError = failure;
      this.readinessStatus = 'failed';
      if (!this.shuttingDown && isValid(this.node, true)) {
        this.node.emit(CLASSIC_BIRD_RESOURCE_LOAD_FAILED_EVENT, failure);
        console.error(failure);
      }
    });
    return attempt;
  }

  /** Compatibility name used by process owners with the Classic preparation shape. */
  prepareRecoveredRuntime(): Promise<void> {
    return this.prepareClassicBirdRuntime();
  }

  private async initializePreparation(): Promise<void> {
    const classic = this.requireClassicGameplayController();
    const crazy = this.requireCrazyGameplayController();
    await classic.prepareRecoveredRuntime();
    this.assertPreparationStillUsable();
    await crazy.prepareCrazyRuntime();
    this.assertPreparationStillUsable();

    const classicCatalog = classic.sharedResourceCatalog;
    const crazyResources = crazy.sharedCrazyResources;
    if (classicCatalog.assetTree !== crazyResources.assetTree) {
      throw new Error('Classic Bird shared catalogs must use one asset tree');
    }

    // Touch every borrowed owner before starting the only Bird-owned load. This keeps a
    // dependency failure from being misreported as a partial Bird catalog.
    crazy.sharedBaseGameplayResources;
    crazy.sharedCrazyAudioPresenter;
    crazy.sharedCrazyDragonFont;
    crazy.sharedObjectivesManager;

    const resources = await loadBirdResources(classicCatalog.assetTree);
    this.assertPreparationStillUsable();
    if (
      resources.assetTree !== classicCatalog.assetTree
      || resources.rasterCount !== 17
      || resources.orderedRasters.length !== 17
    ) {
      throw new Error('Classic Bird preparation requires exactly 17 dedicated rasters');
    }
    if (this.birdResources !== null) {
      throw new Error('Classic Bird preparation products can commit only once');
    }
    this.birdResources = resources;
    this.readinessStatus = 'ready';
    this.preparationError = null;
  }

  /** App-shell entry. The shared current-screen owner must already be empty. */
  activateClassicBirdFromAppShell(
    screenPlacement: ClassicBirdScreenPlacementPort,
  ): void {
    assertScreenPlacementPort(screenPlacement);
    if (this.shuttingDown) {
      throw new Error('Classic Bird runtime cannot activate after destruction');
    }
    if (this.lifecycleFatalError !== null) {
      throw this.lifecycleFatalError;
    }
    if (!this.prepared) {
      throw new Error('Classic Bird runtime must be fully prepared before activation');
    }
    const retainedPlacement = this.screenPlacement;
    if (retainedPlacement !== null && retainedPlacement !== screenPlacement) {
      throw new Error(
        'Classic Bird runtime must reuse its process screen-placement owner',
      );
    }
    this.drainRetiredRuns();
    if (screenPlacement.currentScreen !== null) {
      throw new Error('Classic Bird runtime requires an empty current-screen host');
    }
    if (
      this.modeRoot !== null
      || this.resultPresentationRoot !== null
      || this.resultPresenter !== null
    ) {
      throw new Error('Classic Bird runtime requires fully released presentation');
    }

    this.screenPlacement = screenPlacement;
    try {
      this.constructMode();
      this.attachModeAndActivateScene(screenPlacement);
      this.updateScorePresentation();
      this.emitSnapshot();
    } catch (error) {
      const failures: unknown[] = [];
      const scene = this.classicBirdSceneController;
      if (scene?.active) {
        collectCleanupFailure(
          failures,
          () => scene.releaseClassicBirdLayerForReplacement(),
        );
      }
      collectCleanupFailure(failures, () => this.disposeModePresentation());
      this.screenPlacement = retainedPlacement;
      if (failures.length > 0) {
        const failure = new ClassicBirdLifecycleRollbackError(
          'Classic Bird activation rollback failed',
          error,
          failures,
        );
        this.retainFatalLifecycleBoundary(failure);
        throw failure;
      }
      if (error instanceof ClassicBirdLifecycleRollbackError) {
        this.retainFatalLifecycleBoundary(error);
      }
      throw error;
    }
  }

  private constructMode(): void {
    if (this.modeRoot !== null) {
      throw new Error(
        'Classic Bird mode can construct only from an empty run owner',
      );
    }
    const resources = this.requireBirdResources();
    const classic = this.requireClassicGameplayController();
    const crazy = this.requireCrazyGameplayController();
    const scene = this.requireSceneController();
    const viewport = this.requireViewport();
    const random = classic.sharedGameplayRandom;
    const classicCatalog = classic.sharedResourceCatalog;
    const crazyResources = crazy.sharedCrazyResources;
    const root = createDetachedScreenRoot('ClassicBirdModeRoot', this.node);
    this.modeRoot = root;
    this.worldPresentationRoot = createPresenterRoot(
      root,
      'ClassicBirdWorldPresentationRoot',
    );
    this.scoreHudRoot = createPresenterRoot(root, 'ClassicBirdScoreHudRoot');
    this.failPresentationRoot = createPresenterRoot(
      root,
      'ClassicBirdFailPresentationRoot',
    );
    this.pendingCapturedRoot = null;
    this.pendingResultConfiguration = null;
    this.combo = new ComboService(random);
    this.fail = new FailService();
    this.swishAudio = new ClassicSwishAudioGate(random);

    try {
      this.registry = new CrazyEntityRegistry({
        callAfterStep: (mutation) => scene.callAfterPhysicsStep(mutation),
        classicCatalog,
        crazyResources,
        dragonFont: crazy.sharedCrazyDragonFont,
        dragonRandom: random,
        effectsEnabled: this.effectsEnabled,
        onBeforeBombFreeze: this.onBeforeBombFreeze,
        onBombCut: this.onStandardBombCut,
        onDispose: this.onEntityDisposed,
        onDragonCriticalParticle: this.onDragonCriticalParticle,
        onDragonFinished: this.onDragonFinished,
        onDragonObjective: this.onDragonObjective,
        onDragonPlayEffect: this.onDragonPlayEffect,
        onEnableBonus: this.onUnexpectedBonusEnable,
        onOrdinaryFruitCut: this.onOrdinaryFruitCut,
        onOrdinaryFruitMiss: this.onOrdinaryFruitMiss,
        onPlayBonusTossAudio: this.onUnexpectedBonusTossAudio,
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
      this.coordinator = new ClassicBirdTossCoordinator({
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
        this.requireFailPresentationRoot(),
        viewport,
        resources,
        random,
      );
    } catch (error) {
      const failures: unknown[] = [];
      collectCleanupFailure(failures, () => this.disposeModePresentation());
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'Classic Bird detached construction cleanup failed',
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
    failRoot: Node,
    viewport: ClassicBirdViewport,
    birdResources: LoadedBirdResources,
    random: GameplayRandom,
  ): void {
    const classic = this.requireClassicGameplayController();
    const crazy = this.requireCrazyGameplayController();
    const catalog = classic.sharedResourceCatalog;
    const leaderboard = classic.sharedSettingsRuntime.state.birdClassicLeaderboard;

    this.scoreHudPresenter = ClassicScoreHudPresenter.create({
      bestScoreCupResource: catalog.presentation.bestScoreCup,
      doubleScorePanelResource: catalog.presentation.doubleScorePanel,
      fontResource: catalog.scoreFont,
      initialBestScore: leaderboard.first,
      scoreIconResource: catalog.presentation.scoreIcon,
      viewport,
    }, {
      onDoubleScoreActiveDelayComplete: this.onUnexpectedDoubleScoreDelay,
      onScoreIconScaleDownComplete: this.onDisplayedScoreScaleDownComplete,
      onScoreIconScaleUpComplete: this.onDisplayedScoreScaleUpComplete,
    });
    this.scoreHudPresenter.attach(scoreRoot);

    this.failPresenter = ClassicFailPresenter.create({
      filledResource: catalog.presentation.failFilled,
      normalResource: catalog.presentation.failNormal,
      viewport,
    }, {
      onIndicatorComplete: this.onFailIndicatorComplete,
    });
    this.failPresenter.attach(failRoot);

    this.birdBladePresenter = BirdBladePresenter.create({
      random,
      resources: birdResources,
      viewport,
    });
    this.birdBladeRayAdapter = BirdBladeRayAdapter.create<BirdPhysicsRayHit>({
      raySource: this.birdBladePresenter,
      raycast: {
        raycastAll: (start, end) => this.requireSceneController()
          .raycastAll(start, end) as readonly BirdPhysicsRayHit[],
      },
      viewportWidth: viewport.width,
    });

    this.introPresenter = ClassicBirdWordPresenter.createIntro({
      resources: catalog.presentation,
      viewport,
    }, {
      onComplete: () => this.requireSceneController().completeIntro(),
    });
    this.introPresenter.attach(modeRoot);

    const electricContactAdapter = CrazyElectricContactAdapter
      .create<CrazyElectricBombContactTarget>({
      logicalHeight: this.requireResolution().profile.designHeight,
      logicalWidth: this.requireResolution().profile.designWidth,
      parent: worldRoot,
    }, {
      callAfterStep: (mutation) => this.requireSceneController()
        .callAfterPhysicsStep(mutation),
      onBombContact: this.onElectricBombContact,
      resolveBomb: (collider) => this.registry?.resolveBombCollider(collider) ?? null,
    });
    this.electricContactAdapter = electricContactAdapter;
    this.bombElectricPresenter = CrazyBombElectricPresenter.create({
      effectsEnabled: this.effectsEnabled,
      logicalHeight: this.requireResolution().profile.designHeight,
      logicalWidth: this.requireResolution().profile.designWidth,
      resources: crazy.sharedCrazyResources,
      visibleRect: {
        height: viewport.height,
        leftX: viewport.x,
        rightX: viewport.x + viewport.width,
        width: viewport.width,
      },
    }, {
      audio: crazy.sharedCrazyAudioPresenter,
      sensor: electricContactAdapter,
    });
    this.bombElectricPresenter.attach(modeRoot, 1);

    if (random !== crazy.sharedGameplayRandom) {
      throw new Error('Classic Bird presentation lost the process GameplayRandom');
    }
  }

  private attachModeAndActivateScene(
    screenPlacement: ClassicBirdScreenPlacementPort,
  ): void {
    const root = this.requireDetachedModeRoot();
    screenPlacement.attachCurrentScreen(root);
    if (screenPlacement.currentScreen !== root) {
      throw new Error(
        'Classic Bird current-screen placement lost the attached mode root',
      );
    }
    this.requireBirdBladePresenter().attach(
      this.requireWorldPresentationRoot(),
    );
    const best = this.requireClassicGameplayController()
      .sharedSettingsRuntime.state.birdClassicLeaderboard.first;
    this.requireSceneController().activateClassicBirdLayer(best);
  }

  update(deltaSeconds: number): void {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (this.pendingResultEntryTransaction === null) {
      this.resultPresenter?.updateAction(deltaSeconds);
    }
    if (!this.isGameplayAttached()) {
      return;
    }

    this.birdBladePresenter?.update(deltaSeconds);
    for (const presenter of [...this.comboItemPresenters]) {
      presenter.updateAction(deltaSeconds);
    }
    const lifecycleAtFrameStart = this.requireSceneController()
      .sessionSnapshot().lifecycle;
    this.introPresenter?.updateAction(deltaSeconds);
    this.gameOverPresenter?.updateAction(deltaSeconds);
    if (!this.isGameplayAttached()) {
      return;
    }

    this.bombElectricPresenter?.updateAction(deltaSeconds);
    for (const presenter of [...this.magnetPresenters]) {
      presenter.updateAction(deltaSeconds);
      if (presenter.state.phase === 'disposed') {
        this.magnetPresenters.delete(presenter);
      }
    }
    for (const [targetId, presenter] of [
      ...this.standardBombFuseSmokePresenters,
    ]) {
      presenter.updateAction(deltaSeconds);
      if (presenter.snapshot().drained) {
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
      throw cleanupError(
        'Classic Bird standard Bomb explosion update',
        explosionFailures,
      );
    }

    this.registry?.updateDragonEffectsAction(deltaSeconds);
    for (const presenter of [...this.cutHalfPresenters]) {
      presenter.updateAction(deltaSeconds);
    }
    for (const presenter of [...this.criticalParticlePresenters]) {
      presenter.updateAction(deltaSeconds);
    }
    this.scoreHudPresenter?.updateAction(deltaSeconds);
    this.failPresenter?.updateAction(deltaSeconds);
    this.pausePresenter?.updateAction(deltaSeconds);

    // LUCK starts the graph for the next host frame; it never inherits the intro delta.
    if (lifecycleAtFrameStart === 'intro') {
      this.updateScorePresentation();
      this.emitSnapshot();
      return;
    }
    const lifecycle = this.requireSceneController().sessionSnapshot().lifecycle;
    if (lifecycle === 'running') {
      this.requireCoordinator().tick(deltaSeconds);
      this.applyComboCommands(
        this.requireCombo().update(deltaSeconds, this.effectsEnabled()),
      );
    }
    this.updateScorePresentation();
    this.emitSnapshot();
  }

  private readonly onBirdBladeTouchBegan = (
    event: BirdBladeTouchBeganEvent,
  ): void => {
    if (!this.isGameplayAttached()) {
      return;
    }

    // Native BaseBird requests swish before BirdBlade performs its idle/busy acceptance test.
    const swish = this.requireSwishAudio();
    for (const instruction of swish.request(true, this.effectsEnabled())) {
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
    this.swishAudio?.unlock();
  };

  private readonly onPhysicsStepped = (
    _event: ClassicBirdPhysicsSteppedEvent,
  ): void => {
    const registry = this.registry;
    const blade = this.birdBladePresenter;
    const rayAdapter = this.birdBladeRayAdapter;
    if (
      registry === null
      || blade === null
      || rayAdapter === null
      || !this.isGameplayAttached()
    ) {
      return;
    }
    const viewport = this.requireViewport();
    const existingCutHalves = [...this.cutHalfPresenters];
    const cutEnabled = this.requireSceneController()
      .sessionSnapshot().cutEnabled;

    // BaseBird observes at most one cached ray after each world step. Avoid querying Creator's
    // empty Box2D tree, but still acknowledge a stale cache when cutting is disabled.
    if (registry.size > 0 && cutEnabled) {
      rayAdapter.processOneCachedRay((batch) => (
        this.applyBirdRaycastBatch(batch, registry)
      ));
    } else {
      blade.acknowledgeCachedRay();
    }

    if (registry.size > 0) {
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

  private applyBirdRaycastBatch(
    batch: BirdBladeRaycastBatch<BirdPhysicsRayHit>,
    registry: CrazyEntityRegistry,
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

  private readonly onCoordinatorCommands = (
    commands: readonly ClassicBirdTossRuntimeCommand[],
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
        this.requireRegistry().applySpawnPlan(
          batch.plan,
          this.requireWorldPresentationRoot(),
          this.requireViewport(),
        );
        return;
      case 'control':
        // Wave child and delayed-pause ownership is already committed by the pure coordinator.
        return;
      case 'bonus-spawn':
        throw new Error('Classic Bird controller graph cannot emit BonusToss');
      default:
        throwUnexpectedCoordinatorBatch(batch);
    }
  }

  private readonly onSessionCommand = (
    command: ClassicBirdSessionCommand,
  ): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    this.emitCommand(command);
    switch (command.type) {
      case 'enter-base-bird-layer':
        this.requireModeRoot();
        break;
      case 'read-logical-size-and-physics-world':
        this.requireViewport();
        break;
      case 'construct-controller':
      case 'attach-controller':
        this.assertCoordinatorContains(command.controller);
        break;
      case 'construct-fruit-fail-manager':
      case 'register-fruit-fail-game-over-callback':
      case 'attach-fruit-fail-manager':
        this.requireFailPresenter();
        break;
      case 'create-intro-word':
        if (command.word === 'good') {
          this.requireIntroPresenter();
        } else {
          const intro = this.requireIntroPresenter();
          if (!intro.state.active && !intro.state.complete) {
            intro.activate();
          }
        }
        break;
      case 'construct-bomb-electric':
      case 'attach-bomb-electric':
        this.requireBombElectricPresenter();
        break;
      case 'create-bird-blade':
        this.requireBirdBladePresenter();
        break;
      case 'focus-combo-on-score-manager':
        this.requireCombo();
        break;
      case 'initialize-pause-ui':
        this.initializePausePresentation();
        break;
      case 'initialize-best-score':
        if (
          command.score
          !== this.requireClassicGameplayController()
            .sharedSettingsRuntime.state.birdClassicLeaderboard.first
        ) {
          throw new Error(
            'Classic Bird best-score initialization lost shared Settings',
          );
        }
        break;
      case 'toss-controller':
        if (command.action === 'start') {
          this.requireCoordinator().startController(command.controller);
        } else {
          this.requireCoordinator().stopController(command.controller);
        }
        break;
      case 'check-combo':
        this.requireCombo().checkCombo(command.position);
        break;
      case 'register-fruit-fail':
        this.applyFailCommands(
          this.requireFail().registerMiss(command.position),
        );
        break;
      case 'start-electric-bomb':
        this.requireBombElectricPresenter().start();
        break;
      case 'create-magnet-animation':
        this.createMagnetPresenter(command.zOrder);
        break;
      case 'add-score':
        // ClassicBirdSession already committed this score before publishing the trace.
        if (command.application !== 'already-applied') {
          throw new Error('Classic Bird score observation must already be applied');
        }
        this.processBirdScoreObjective();
        break;
      case 'stop-electric-bomb':
        this.requireBombElectricPresenter().stop();
        break;
      case 'show-game-over':
        this.disposeCutHalfPresenters();
        this.presentGameOver();
        break;
      case 'stop-effects':
        this.stopAllBirdRunEffects();
        break;
      case 'capture-classic-bird-parent':
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
      case 'remove-classic-bird':
        this.detachModeForResult(command.cleanup);
        break;
      case 'attach-result':
        this.attachResult(command.zOrder);
        break;
      case 'start-displayed-score-scale-up':
      case 'start-displayed-score-scale-down':
        this.applyScorePresentationCommand(command);
        break;
      case 'set-cut-enabled':
      case 'set-physics-stopped':
      case 'set-world-speed':
      case 'schedule-speed-up-callback':
        // Scene/domain owners already committed these gates and clocks.
        break;
      default:
        throwUnexpectedSessionCommand(command);
    }
    this.updateScorePresentation();
    this.emitSnapshot();
  };

  private presentGameOver(): void {
    if (this.gameOverPresenter !== null) {
      return;
    }
    const presenter = ClassicBirdWordPresenter.createGameOver({
      resources: this.requireClassicGameplayController()
        .sharedResourceCatalog.presentation,
      viewport: this.requireViewport(),
    }, {
      onComplete: () => this.completeGameOverPresentation(),
    });
    try {
      presenter.attach(this.requireModeRoot());
      presenter.activate();
      this.gameOverPresenter = presenter;
    } catch (error) {
      const failures: unknown[] = [];
      collectCleanupFailure(failures, () => presenter.dispose());
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'Classic Bird GAME/OVER rollback failed',
          error,
          failures,
        );
      }
      throw error;
    }
  }

  private completeGameOverPresentation(): void {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    try {
      this.requireSceneController().displayScoreComplete();
    } catch (error) {
      if (error instanceof ClassicBirdLifecycleRollbackError) {
        this.retainFatalLifecycleBoundary(error);
      }
      throw error;
    }
  }

  private applyScorePresentationCommand(
    command: Extract<
      ClassicBirdSessionCommand,
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
    throw new Error('Classic Bird has no double-score presentation');
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

  private readonly onSpecialFruitCut = (
    event: CrazyGeneratedSpecialFruitCutEvent,
  ): void => {
    this.presentCutHalves({
      ...event,
      critical: false,
      visuals: event.visuals,
    });
    if (this.effectsEnabled()) {
      this.requireCrazyGameplayController().sharedCrazyAudioPresenter.playOneShot(
        CRAZY_SPECIAL_FRUIT_BASE_CUT_AUDIO_PATH,
      );
    }
    this.requireSceneController().fruitCut(
      event.worldPosition,
      event.fruitId,
      10,
    );
  };

  private presentCutHalves(event: ClassicBirdCutPresentationEvent): void {
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
      throw new Error(
        `Classic Bird critical particle ${command.resourceIndex} is unavailable`,
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

  private readonly onDragonFinished = (
    event: CrazyGeneratedDragonFruitFinishedEvent,
  ): void => {
    this.requireSceneController().addScore(event.acceptedHitCount);
    this.processBirdScoreObjective();
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
      this.requireCrazyGameplayController().sharedCrazyAudioPresenter.playOneShot(
        event.canonicalPath,
      );
    }
  };

  private readonly onOrdinaryFruitMiss = (
    event: ClassicGeneratedFruitMissEvent,
  ): void => {
    this.requireSceneController().fruitFail(event.worldPosition);
  };

  private readonly onSpecialFruitMiss = (
    event: CrazyGeneratedSpecialFruitMissEvent,
  ): void => {
    this.requireSceneController().fruitFail(event.worldPosition);
  };

  private readonly onUnexpectedBonusEnable = (
    _command: BonusEnableCommand,
  ): void => {
    throw new Error('Classic Bird has no BonusToss enable callback');
  };

  private readonly onUnexpectedBonusTossAudio = (
    _command: BonusTossAudioCommand,
  ): void => {
    throw new Error('Classic Bird has no BonusToss audio callback');
  };

  private readonly onPlayTossSound = (sound: ClassicTossSound): void => {
    this.requireClassicGameplayController()
      .sharedAudioPresenter.playOneShot(sound);
  };

  private readonly onFailIndicatorComplete = (): void => {
    this.applyFailCommands(this.requireFail().completeIndicator());
  };

  private applyFailCommands(commands: readonly FailCommand[]): void {
    for (const command of commands) {
      switch (command.type) {
        case 'queue-fail-indicator':
          this.requireFailPresenter().presentMiss(
            command.strike,
            command.missPosition,
          );
          break;
        case 'game-over-callback':
          this.requireSceneController().gameOverFromMiss();
          break;
        case 'increment-fail-count':
          break;
        default:
          throwUnexpectedFailCommand(command);
      }
    }
    this.emitCommands(commands);
    this.emitSnapshot();
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
                'Classic Bird Combo created more than one pending item',
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
            this.processBirdScoreObjective();
            return;
          case 'attach-combo-item': {
            if (command.zOrder !== 1 || pendingPresenter === null) {
              throw new Error(
                'Classic Bird Combo requires one pending z-order-1 item',
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
            throwUnexpectedComboCommand(command);
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

  private processBirdScoreObjective(): void {
    this.requireObjectivesManager().processGameEvent(
      19,
      this.requireSceneController().sessionSnapshot().score.authoritativeScore,
    );
  }

  private createMagnetPresenter(zOrder: 1): void {
    const viewport = this.requireViewport();
    let presenter: CrazyMagnetPresenter;
    presenter = CrazyMagnetPresenter.create({
      centerX: viewport.x + viewport.width / 2,
      effectsEnabled: this.effectsEnabled,
      random: this.sharedGameplayRandom,
      resources: this.requireCrazyGameplayController().sharedCrazyResources,
      topY: viewport.y + viewport.height,
    }, {
      audio: this.requireCrazyGameplayController().sharedCrazyAudioPresenter,
      gameplay: {
        onMagnetBegin: () => this.requireCoordinator().magnetBegin(),
        onMagnetEnd: () => this.requireCoordinator().magnetEnd(),
      },
    });
    presenter.attach(this.requireModeRoot(), zOrder);
    this.magnetPresenters.add(presenter);
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
    const audio = this.requireCrazyGameplayController()
      .sharedCrazyAudioPresenter;
    switch (command.type) {
      case 'play-effect':
        if (command.loop) {
          audio.playLoopingEffect(command.canonicalPath);
        } else {
          audio.playOneShot(command.canonicalPath);
        }
        return;
      case 'play-background-music':
        audio.playElectricBackgroundMusic();
        return;
      case 'stop-background-music':
        audio.stopBackgroundMusic();
        return;
      case 'stop-all-effects':
        audio.stopAllEffects();
        return;
      case 'stop-effect':
        // Classic Bird owns no Crazy retained handle outside MagnetPresenter.
        audio.stopAllEffects();
        return;
      default:
        throwUnexpectedAudioCommand(command);
    }
  }

  private readonly onEntityDisposed = (
    event: CrazyEntityDisposedEvent,
  ): void => {
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
      throw cleanupError(
        `Classic Bird entity ${event.targetId}`,
        failures,
      );
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
      throw new Error(
        `Classic Bird standard Bomb ${event.targetId} already owns an explosion`,
      );
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
      onFinished: () => completion.markNaturalFinish(),
    });
    owner = {
      completion,
      presenter,
      runGeneration: null,
    };

    let bombHitApplied = false;
    let ownerRegistered = false;
    try {
      presenter.attach(this.requireWorldPresentationRoot(), 1);
      this.standardBombExplosionOwners.set(event.targetId, owner);
      ownerRegistered = true;
      owner.runGeneration = this.requireSceneController().bombHit();
      bombHitApplied = true;
      if (this.effectsEnabled()) {
        this.requireClassicGameplayController()
          .sharedAudioPresenter.playOneShot(
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
      if (bombHitApplied && owner.runGeneration !== null) {
        const runGeneration = owner.runGeneration;
        collectCleanupFailure(
          failures,
          () => this.requireSceneController().afterBombHit(runGeneration),
        );
      }
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'Classic Bird standard Bomb handoff rollback failed',
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
      const runGeneration = owner.runGeneration;
      if (runGeneration === null) {
        failures.push(new Error(
          `Classic Bird Bomb ${targetId} finished without a run generation`,
        ));
        continue;
      }
      try {
        if (owner.completion.drain({
          afterBombHit: () => this.requireSceneController()
            .afterBombHit(runGeneration),
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
      throw cleanupError(
        'Classic Bird standard Bomb explosion finish',
        failures,
      );
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
        throw new Error(
          'Classic Bird standard Bomb must attach before entry effects',
        );
      }
      if (
        this.standardBombEntryAudioHandles.has(targetId)
        || this.standardBombFuseSmokePresenters.has(targetId)
      ) {
        throw new Error(
          `Classic Bird standard Bomb ${targetId} already owns entry effects`,
        );
      }
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
        if (
          this.standardBombFuseSmokePresenters.get(targetId)
          === rollbackPresenter
        ) {
          this.standardBombFuseSmokePresenters.delete(targetId);
        }
        collectCleanupFailure(
          failures,
          () => rollbackPresenter.dispose(),
        );
      }
      if (entryAudioStarted) {
        collectCleanupFailure(
          failures,
          () => this.disposeStandardBombEntryAudio(targetId),
        );
      }
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'Classic Bird Bomb entry-effect rollback failed',
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

  private captureRunOwnership(): ClassicBirdRunOwnership {
    return {
      birdBladePresenter: this.birdBladePresenter,
      birdBladeRayAdapter: this.birdBladeRayAdapter,
      bombElectricPresenter: this.bombElectricPresenter,
      combo: this.combo,
      comboItemPresenters: this.comboItemPresenters,
      coordinator: this.coordinator,
      criticalCutHalfPresenters: this.criticalCutHalfPresenters,
      criticalParticlePresenters: this.criticalParticlePresenters,
      cutHalfPresenters: this.cutHalfPresenters,
      electricContactAdapter: this.electricContactAdapter,
      fail: this.fail,
      failPresenter: this.failPresenter,
      failPresentationRoot: this.failPresentationRoot,
      gameOverPresenter: this.gameOverPresenter,
      introPresenter: this.introPresenter,
      magnetPresenters: this.magnetPresenters,
      modeRoot: this.modeRoot,
      pausePresenter: this.pausePresenter,
      pendingCapturedRoot: this.pendingCapturedRoot,
      pendingResultConfiguration: this.pendingResultConfiguration,
      registry: this.registry,
      scoreHudPresenter: this.scoreHudPresenter,
      scoreHudRoot: this.scoreHudRoot,
      standardBombEntryAudioHandles: this.standardBombEntryAudioHandles,
      standardBombExplosionOwners: this.standardBombExplosionOwners,
      standardBombFuseSmokePresenters:
        this.standardBombFuseSmokePresenters,
      swishAudio: this.swishAudio,
      worldPresentationRoot: this.worldPresentationRoot,
    };
  }

  private createEmptyRunOwnership(): ClassicBirdRunOwnership {
    return {
      birdBladePresenter: null,
      birdBladeRayAdapter: null,
      bombElectricPresenter: null,
      combo: null,
      comboItemPresenters: new Set<ComboItemPresenter>(),
      coordinator: null,
      criticalCutHalfPresenters: new Set<ClassicCutHalfPresenter>(),
      criticalParticlePresenters: new Set<ClassicCriticalParticlePresenter>(),
      cutHalfPresenters: new Set<ClassicCutHalfPresenter>(),
      electricContactAdapter: null,
      fail: null,
      failPresenter: null,
      failPresentationRoot: null,
      gameOverPresenter: null,
      introPresenter: null,
      magnetPresenters: new Set<CrazyMagnetPresenter>(),
      modeRoot: null,
      pausePresenter: null,
      pendingCapturedRoot: null,
      pendingResultConfiguration: null,
      registry: null,
      scoreHudPresenter: null,
      scoreHudRoot: null,
      standardBombEntryAudioHandles:
        new Map<string, ClassicRetainedAudioHandle>(),
      standardBombExplosionOwners:
        new Map<string, StandardBombExplosionOwner>(),
      standardBombFuseSmokePresenters:
        new Map<string, StandardBombFuseSmokePresenter>(),
      swishAudio: null,
      worldPresentationRoot: null,
    };
  }

  private installRunOwnership(ownership: ClassicBirdRunOwnership): void {
    this.birdBladePresenter = ownership.birdBladePresenter;
    this.birdBladeRayAdapter = ownership.birdBladeRayAdapter;
    this.bombElectricPresenter = ownership.bombElectricPresenter;
    this.combo = ownership.combo;
    this.comboItemPresenters = ownership.comboItemPresenters;
    this.coordinator = ownership.coordinator;
    this.criticalCutHalfPresenters = ownership.criticalCutHalfPresenters;
    this.criticalParticlePresenters = ownership.criticalParticlePresenters;
    this.cutHalfPresenters = ownership.cutHalfPresenters;
    this.electricContactAdapter = ownership.electricContactAdapter;
    this.fail = ownership.fail;
    this.failPresenter = ownership.failPresenter;
    this.failPresentationRoot = ownership.failPresentationRoot;
    this.gameOverPresenter = ownership.gameOverPresenter;
    this.introPresenter = ownership.introPresenter;
    this.magnetPresenters = ownership.magnetPresenters;
    this.modeRoot = ownership.modeRoot;
    this.pausePresenter = ownership.pausePresenter;
    this.pendingCapturedRoot = ownership.pendingCapturedRoot;
    this.pendingResultConfiguration = ownership.pendingResultConfiguration;
    this.registry = ownership.registry;
    this.scoreHudPresenter = ownership.scoreHudPresenter;
    this.scoreHudRoot = ownership.scoreHudRoot;
    this.standardBombEntryAudioHandles =
      ownership.standardBombEntryAudioHandles;
    this.standardBombExplosionOwners =
      ownership.standardBombExplosionOwners;
    this.standardBombFuseSmokePresenters =
      ownership.standardBombFuseSmokePresenters;
    this.swishAudio = ownership.swishAudio;
    this.worldPresentationRoot = ownership.worldPresentationRoot;
  }

  private acquireStandbySceneController(
    activeScene: ClassicBirdSceneController,
  ): ClassicBirdSceneController {
    let standby = this.standbySceneController;
    if (standby === null || !isValid(standby, true)) {
      const existing = this.node
        .getComponents(ClassicBirdSceneController)
        .filter((scene) => scene !== activeScene && isValid(scene, true));
      if (existing.length > 1) {
        throw new Error(
          'Classic Bird Replay found more than one standby scene lease',
        );
      }
      if (existing.length === 1) {
        [standby] = existing;
      } else {
        try {
          standby = this.node.addComponent(ClassicBirdSceneController);
        } catch (error) {
          const cleanupFailures: unknown[] = [];
          for (const partial of this.node.getComponents(
            ClassicBirdSceneController,
          )) {
            if (partial !== activeScene && isValid(partial, true)) {
              collectCleanupFailure(
                cleanupFailures,
                () => partial.destroy(),
              );
            }
          }
          this.standbySceneController = null;
          if (cleanupFailures.length > 0) {
            throw aggregateWithPrimary(
              'Classic Bird standby construction rollback failed',
              error,
              cleanupFailures,
            );
          }
          throw error;
        }
      }
      this.standbySceneController = standby;
    }

    const liveScenes = this.node
      .getComponents(ClassicBirdSceneController)
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
        'Classic Bird Replay requires one inactive standby scene lease',
      );
    }
    return standby;
  }

  private restoreRetainedSwishCooldown(
    ownership: ClassicBirdRunOwnership,
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
    const retained: RetiredClassicBirdRunOwnership[] = [];
    const failures: unknown[] = [];
    try {
      for (const retired of this.retiredRuns) {
        this.installRunOwnership(retired.ownership);
        this.classicBirdSceneController = retired.scene;
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
      this.classicBirdSceneController = activeScene;
      this.retiredRuns.length = 0;
      this.retiredRuns.push(...retained);
    }
    if (failures.length > 0) {
      throw cleanupError('Retired Classic Bird run ownership', failures);
    }
  }

  private initializePausePresentation(): void {
    if (this.pausePresenter !== null) {
      throw new Error(
        'Classic Bird pause presentation can initialize only once per run',
      );
    }
    const resolution = this.requireResolution();
    const presenter = BaseGameplayPausePresenter.create({
      contentScaleFactor: resolution.profile.contentScaleFactor,
      initialCard: this.currentPauseCard(),
      resources: this.requireCrazyGameplayController()
        .sharedBaseGameplayResources,
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
          'Classic Bird pause initialization rollback failed',
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
      throw new Error('Classic Bird pause UI requires one active objective');
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
    const settings = this.requireClassicGameplayController()
      .sharedSettingsRuntime.state.snapshot;
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
        () => this.requireCrazyGameplayController()
          .sharedCrazyAudioPresenter.pauseAllEffects(),
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
        () => this.requireCrazyGameplayController()
          .sharedCrazyAudioPresenter.pauseBackgroundMusic(),
      );
    }
    if (failures.length > 0) {
      throw cleanupError('Classic Bird Pause audio', failures);
    }
  };

  private readonly onResumeRequested = (): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
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
      () => this.requireCrazyGameplayController()
        .sharedCrazyAudioPresenter.resumeAllEffects(),
    );
    // Native mode 3 never resumes either paused background-music owner.
    if (failures.length > 0) {
      throw cleanupError('Classic Bird Resume audio', failures);
    }
  };

  private readonly onPauseReplayRequested = (): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    try {
      this.restartFromPause();
    } catch (error) {
      const failure = normalizeError(error, 'Classic Bird Pause Replay failed');
      if (error instanceof ClassicBirdLifecycleRollbackError) {
        this.retainFatalLifecycleBoundary(error);
      }
      const payload: ClassicBirdPauseReplayFailedEvent = Object.freeze({
        message: failure.message,
        reason: 'restart-error',
      });
      this.node.emit(CLASSIC_BIRD_PAUSE_REPLAY_FAILED_EVENT, payload);
      console.error(failure);
    }
  };

  private restartFromPause(): void {
    this.drainRetiredRuns();
    const effectsEnabled = this.effectsEnabled();
    const placement = this.requireScreenPlacement();
    const oldRoot = this.requireModeRoot();
    const pause = this.requirePausePresenter();
    const oldScene = this.requireSceneController();
    if (placement.currentScreen !== oldRoot || !oldScene.active) {
      throw new Error(
        'Classic Bird Pause Replay requires attached active gameplay',
      );
    }

    const oldOwnership = this.captureRunOwnership();
    let freshInstalled = false;
    let freshRoot: Node | null = null;
    let freshScene: ClassicBirdSceneController | null = null;
    this.unschedule(this.onSwishCooldownComplete);

    try {
      oldScene.suspendClassicBirdLayerForNavigation();
      freshScene = this.acquireStandbySceneController(oldScene);
      this.installRunOwnership(this.createEmptyRunOwnership());
      this.classicBirdSceneController = freshScene;
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
        () => this.requireCrazyGameplayController()
          .sharedCrazyAudioPresenter.stopBackgroundMusic(),
      );
      collectCleanupFailure(
        audioFailures,
        () => this.requireClassicGameplayController()
          .sharedAudioPresenter.stopAllEffects(),
      );
      collectCleanupFailure(
        audioFailures,
        () => this.requireCrazyGameplayController()
          .sharedCrazyAudioPresenter.stopAllEffects(),
      );
      if (audioFailures.length > 0) {
        throw cleanupError(
          'Classic Bird Pause Replay audio',
          audioFailures,
        );
      }

      pause.resumeEgress();
      pause.stopAllActions();
      const previous = placement.replaceCurrentScreen(freshRoot);
      if (
        previous !== oldRoot
        || oldRoot.parent !== null
        || placement.currentScreen !== freshRoot
      ) {
        throw new Error(
          'Classic Bird Pause Replay replaced an unexpected gameplay screen',
        );
      }

      this.requireBirdBladePresenter().attach(
        this.requireWorldPresentationRoot(),
      );
      const best = this.requireClassicGameplayController()
        .sharedSettingsRuntime.state.birdClassicLeaderboard.first;
      freshScene.activateClassicBirdLayer(best);
      this.updateScorePresentation();
      oldScene.finalizeSuspendedClassicBirdLayerRelease();
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      const primaryFatal = error instanceof ClassicBirdLifecycleRollbackError;
      if (freshInstalled && freshScene !== null) {
        collectCleanupFailure(rollbackFailures, () => {
          if (freshScene?.active) {
            freshScene.releaseClassicBirdLayerForReplacement();
          }
        });
        collectCleanupFailure(rollbackFailures, () => {
          const current = placement.currentScreen;
          if (current === oldRoot) {
            return;
          }
          if (!isValid(oldRoot, true) || oldRoot.parent !== null) {
            throw new Error(
              'Classic Bird Pause Replay rollback lost old gameplay',
            );
          }
          if (current === null) {
            placement.attachCurrentScreen(oldRoot);
          } else {
            const displaced = placement.replaceCurrentScreen(oldRoot);
            if (freshRoot !== null && displaced !== freshRoot) {
              throw new Error(
                'Classic Bird Pause Replay rollback displaced an unexpected screen',
              );
            }
          }
        });
        try {
          this.disposeModePresentation();
        } catch (cleanupFailure) {
          rollbackFailures.push(cleanupFailure);
          if (!freshScene.active && !freshScene.suspended) {
            this.retiredRuns.push(Object.freeze({
              ownership: this.captureRunOwnership(),
              scene: freshScene,
            }));
          } else {
            rollbackFailures.push(new Error(
              'Classic Bird Replay rollback retained an active fresh scene',
            ));
          }
        }
      }

      this.installRunOwnership(oldOwnership);
      this.classicBirdSceneController = oldScene;
      if (freshScene !== null && freshScene !== oldScene) {
        this.standbySceneController = freshScene;
      }
      collectCleanupFailure(rollbackFailures, () => {
        if (placement.currentScreen === null) {
          placement.attachCurrentScreen(oldRoot);
        }
        if (placement.currentScreen !== oldRoot) {
          throw new Error(
            'Classic Bird Pause Replay rollback could not restore gameplay',
          );
        }
      });
      // Only a complete, nonfatal rollback may reactivate the retained run.
      if (!primaryFatal && rollbackFailures.length === 0) {
        collectCleanupFailure(rollbackFailures, () => {
          if (oldScene.suspended) {
            oldScene.resumeSuspendedClassicBirdLayer();
          }
        });
        if (rollbackFailures.length === 0) {
          collectCleanupFailure(
            rollbackFailures,
            () => this.restoreRetainedSwishCooldown(oldOwnership),
          );
          collectCleanupFailure(
            rollbackFailures,
            () => pause.pauseIngress(this.currentPauseCard()),
          );
        }
      }
      if (rollbackFailures.length > 0) {
        const failure = new ClassicBirdLifecycleRollbackError(
          'Classic Bird Pause Replay rollback failed',
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
      throw new Error('Classic Bird Replay lost its fresh scene lease');
    }
    const freshOwnership = this.captureRunOwnership();
    const cleanupFailures: unknown[] = [];
    try {
      this.installRunOwnership(oldOwnership);
      this.classicBirdSceneController = oldScene;
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
      this.classicBirdSceneController = freshScene;
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
      'Committed Classic Bird Pause Replay cleanup',
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
      this.requireSceneController().suspendClassicBirdLayerForNavigation();
    } catch (error) {
      if (error instanceof ClassicBirdLifecycleRollbackError) {
        this.retainFatalLifecycleBoundary(error);
        throw error;
      }
      const rollbackFailures: unknown[] = [];
      collectCleanupFailure(
        rollbackFailures,
        () => pause.pauseIngress(this.currentPauseCard()),
      );
      if (rollbackFailures.length > 0) {
        const failure = new ClassicBirdLifecycleRollbackError(
          'Classic Bird Pause Quit suspension rollback failed',
          error,
          rollbackFailures,
        );
        this.retainFatalLifecycleBoundary(failure);
        throw failure;
      }
      throw error;
    }
    const transaction: ClassicBirdPauseQuitTransaction = {
      presenter: pause,
      root,
      screenPlacement: this.requireScreenPlacement(),
      status: 'pending',
    };
    const payload: ClassicBirdPauseQuitRequestedEvent = Object.freeze({
      classicBirdRoot: root,
      commit: (previousRoot: Node) => (
        this.commitPauseQuit(transaction, previousRoot)
      ),
      rollback: () => this.rollbackPauseQuit(transaction),
    });
    try {
      this.node.emit(CLASSIC_BIRD_PAUSE_QUIT_REQUESTED_EVENT, payload);
    } finally {
      if (transaction.status === 'pending') {
        this.rollbackPauseQuit(transaction);
      }
    }
  };

  private commitPauseQuit(
    transaction: ClassicBirdPauseQuitTransaction,
    previousRoot: Node,
  ): void {
    if (transaction.status === 'committed') {
      return;
    }
    if (previousRoot !== transaction.root) {
      throw new Error(
        'Classic Bird Pause Quit commit received an unexpected previous screen',
      );
    }
    if (transaction.status === 'rolled-back') {
      throw new Error(
        'Rolled-back Classic Bird Pause Quit cannot commit',
      );
    }
    if (
      this.modeRoot !== transaction.root
      || this.pausePresenter !== transaction.presenter
      || transaction.root.parent !== null
      || transaction.screenPlacement.currentScreen === null
      || transaction.screenPlacement.currentScreen === transaction.root
    ) {
      throw new Error(
        'Classic Bird Pause Quit commit requires screen replacement',
      );
    }

    const releasedScene = this.requireSceneController();
    releasedScene.finalizeSuspendedClassicBirdLayerRelease();
    transaction.status = 'committed';
    const failures: unknown[] = [];
    collectCleanupFailure(failures, () => this.stopAllBirdRunEffects());
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
    reportCleanupFailures(
      'Committed Classic Bird Pause Quit cleanup',
      failures,
    );
    this.emitSnapshot();
  }

  private rollbackPauseQuit(
    transaction: ClassicBirdPauseQuitTransaction,
  ): void {
    if (transaction.status === 'rolled-back') {
      return;
    }
    if (transaction.status === 'committed') {
      throw new Error(
        'Committed Classic Bird Pause Quit cannot roll back',
      );
    }
    if (this.lifecycleFatalError !== null) {
      throw this.lifecycleFatalError;
    }
    let resumedScene: ClassicBirdSceneController | null = null;
    try {
      if (
        this.modeRoot !== transaction.root
        || this.pausePresenter !== transaction.presenter
        || !isValid(transaction.root, true)
      ) {
        throw new Error(
          'Classic Bird Pause Quit rollback lost gameplay ownership',
        );
      }
      const current = transaction.screenPlacement.currentScreen;
      if (current !== transaction.root) {
        if (transaction.root.parent !== null) {
          throw new Error(
            'Classic Bird Pause Quit rollback found an unknown parent',
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
          'Classic Bird Pause Quit rollback could not restore gameplay',
        );
      }
      const scene = this.requireSceneController();
      scene.resumeSuspendedClassicBirdLayer();
      resumedScene = scene;
      transaction.presenter.pauseIngress(this.currentPauseCard());
    } catch (error) {
      const quiesceFailures: unknown[] = [];
      if (resumedScene?.active) {
        collectCleanupFailure(
          quiesceFailures,
          () => resumedScene?.suspendClassicBirdLayerForNavigation(),
        );
      }
      const failure = (
        error instanceof ClassicBirdLifecycleRollbackError
        && quiesceFailures.length === 0
          ? error
          : new ClassicBirdLifecycleRollbackError(
            'Classic Bird Pause Quit rollback failed',
            new Error(
              'Classic Bird Pause Quit request did not settle',
            ),
            [error, ...quiesceFailures],
          )
      );
      this.retainFatalLifecycleBoundary(failure);
      throw failure;
    }
    transaction.status = 'rolled-back';
    this.emitSnapshot();
  }

  private captureModeForResult(): void {
    const root = this.requireModeRoot();
    if (
      this.pendingCapturedRoot !== null
      || this.pendingResultEntryTransaction !== null
      || this.resultPresenter !== null
      || this.resultPresentationRoot !== null
    ) {
      throw new Error('Classic Bird Result parent can be captured only once');
    }
    const transaction: ClassicBirdResultEntryTransaction = {
      classicBirdRoot: root,
      configuration: null,
      presenter: null,
      root: null,
      status: 'pending',
    };
    this.pendingCapturedRoot = root;
    this.pendingResultEntryTransaction = transaction;
    const participant: ClassicBirdResultTransitionParticipant = Object.freeze({
      prepareCommit: () => this.prepareResultCommit(transaction),
      commit: () => this.commitResultTransition(transaction),
      rollback: () => this.rollbackResultTransition(transaction),
    });
    try {
      this.requireSceneController().enlistResultTransitionParticipant(
        participant,
      );
    } catch (error) {
      this.pendingCapturedRoot = null;
      this.pendingResultEntryTransaction = null;
      throw error;
    }
  }

  private beginResultConstruction(): void {
    if (this.pendingResultConfiguration !== null) {
      throw new Error(
        'Classic Bird Result construction can begin only once',
      );
    }
    this.pendingResultConfiguration = {};
  }

  private setPendingResultMode(
    mode: typeof CLASSIC_BIRD_RESULT_MODE_ID,
  ): void {
    if (
      this.pendingResultConfiguration === null
      || this.pendingResultConfiguration.mode !== undefined
      || mode !== CLASSIC_BIRD_RESULT_MODE_ID
    ) {
      throw new Error(
        'Classic Bird Result mode requires one mode-3 construction',
      );
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
        'Classic Bird Result score requires one safe-integer construction',
      );
    }
    this.pendingResultConfiguration = {
      ...this.pendingResultConfiguration,
      score,
    };
  }

  private configuredResult(): ClassicBirdResultConfiguration {
    const pending = this.pendingResultConfiguration;
    if (
      pending === null
      || pending.mode !== CLASSIC_BIRD_RESULT_MODE_ID
      || pending.score === undefined
    ) {
      throw new Error(
        'Classic Bird Result must be constructed, mode-set, and score-set',
      );
    }
    return Object.freeze({
      mode: pending.mode,
      score: pending.score,
    });
  }

  private detachModeForResult(cleanup: true): void {
    if (cleanup !== true) {
      throw new Error('Classic Bird Result removal requires cleanup');
    }
    this.configuredResult();
    const root = this.requireModeRoot();
    if (this.pendingCapturedRoot !== root) {
      throw new Error(
        'Classic Bird Result removal lost its captured parent',
      );
    }
    const detached = this.requireScreenPlacement()
      .detachCurrentScreen(root);
    if (detached !== root || root.parent !== null) {
      throw new Error(
        'Classic Bird Result removed an unexpected current screen',
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
      || transaction.classicBirdRoot !== this.pendingCapturedRoot
      || transaction.status !== 'pending'
    ) {
      throw new Error(
        'Classic Bird Result must attach once to an empty host at z-order 1',
      );
    }
    transaction.configuration = configured;
    const classic = this.requireClassicGameplayController();
    const settings = classic.sharedSettingsRuntime;
    const ranking = insertClassicBirdResultScore(
      configured.score,
      settings.state.birdClassicLeaderboard,
    );
    const catalog = classic.sharedResourceCatalog;
    const presenter = ClassicResultPresenter.create({
      completedRunScore: configured.score,
      fonts: catalog.resultFonts,
      panelValues: classicBirdLeaderboardPanelValues(ranking.leaderboard),
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
      onTotalCoinsEntranceComplete:
        this.onResultTotalCoinsEntranceComplete,
    });
    transaction.presenter = presenter;
    const root = createDetachedScreenRoot(
      'ClassicBirdResultPresentationRoot',
      this.node,
    );
    transaction.root = root;
    this.resultPresentationRoot = root;
    this.resultPresenter = presenter;
    this.requireScreenPlacement().attachCurrentScreen(root);
    presenter.attach(root);
  }

  private prepareResultCommit(
    transaction: ClassicBirdResultEntryTransaction,
  ): void {
    const configured = this.configuredResult();
    const resultRoot = transaction.root;
    const resultPresenter = transaction.presenter;
    if (
      this.pendingResultEntryTransaction !== transaction
      || this.pendingCapturedRoot !== transaction.classicBirdRoot
      || resultRoot === null
      || resultPresenter === null
      || this.resultPresentationRoot !== resultRoot
      || this.resultPresenter !== resultPresenter
      || transaction.configuration?.mode !== configured.mode
      || transaction.configuration.score !== configured.score
      || transaction.classicBirdRoot.parent !== null
      || this.requireScreenPlacement().currentScreen !== resultRoot
    ) {
      throw new Error(
        'Classic Bird Result can commit only at its provisional boundary',
      );
    }
    transaction.status = 'prepared';
  }

  private commitResultTransition(
    transaction: ClassicBirdResultEntryTransaction,
  ): void {
    if (transaction.status === 'committed') {
      return;
    }
    if (
      transaction.status !== 'prepared'
      || transaction.configuration === null
    ) {
      throw new Error(
        'Classic Bird Result transaction must prepare before commit',
      );
    }
    const configured = transaction.configuration;
    this.requireClassicGameplayController()
      .sharedSettingsRuntime.state.recordClassicBirdResultScore(
        configured.score,
      );
    transaction.status = 'committed';
    this.pendingResultEntryTransaction = null;

    const retainedResultConfiguration: ClassicBirdPendingResultConfiguration = {
      mode: configured.mode,
      score: configured.score,
    };
    const releasedScene = this.requireSceneController();
    const cleanupFailures: unknown[] = [];
    try {
      this.disposeModePresentation();
    } catch (error) {
      cleanupFailures.push(error);
      const retainedOwnership = this.captureRunOwnership();
      this.retiredRuns.push(Object.freeze({
        ownership: Object.freeze({
          ...retainedOwnership,
          pendingCapturedRoot: null,
          pendingResultConfiguration: null,
        }),
        scene: releasedScene,
      }));
    } finally {
      this.installRunOwnership(this.createEmptyRunOwnership());
      this.pendingResultConfiguration = retainedResultConfiguration;
    }
    collectCleanupFailure(cleanupFailures, () => this.emitSnapshot());
    reportCleanupFailures(
      'Committed Classic Bird-to-Result cleanup',
      cleanupFailures,
    );
  }

  private rollbackResultTransition(
    transaction: ClassicBirdResultEntryTransaction,
  ): void {
    if (transaction.status === 'rolled-back') {
      return;
    }
    if (transaction.status === 'committed') {
      throw new Error(
        'Committed Classic Bird Result transaction cannot roll back',
      );
    }
    if (
      this.pendingResultEntryTransaction !== transaction
      || this.pendingCapturedRoot !== transaction.classicBirdRoot
      || this.modeRoot !== transaction.classicBirdRoot
      || !isValid(transaction.classicBirdRoot, true)
    ) {
      throw new Error(
        'Classic Bird Result rollback lost its gameplay owner',
      );
    }

    const failures: unknown[] = [];
    const placement = this.requireScreenPlacement();
    const resultRoot = transaction.root;
    const resultPresenter = transaction.presenter;
    if (resultRoot !== null && placement.currentScreen === resultRoot) {
      collectCleanupFailure(failures, () => {
        if (placement.detachCurrentScreen(resultRoot) !== resultRoot) {
          throw new Error(
            'Classic Bird Result rollback detached an unexpected Result',
          );
        }
      });
    }
    if (placement.currentScreen === null) {
      collectCleanupFailure(
        failures,
        () => placement.attachCurrentScreen(transaction.classicBirdRoot),
      );
    }
    if (placement.currentScreen !== transaction.classicBirdRoot) {
      failures.push(new Error(
        'Classic Bird Result rollback could not restore gameplay',
      ));
    }

    this.resultPresentationRoot = null;
    this.resultPresenter = null;
    this.pendingCapturedRoot = null;
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
      throw cleanupError('Classic Bird Result rollback', failures);
    }
  }

  private readonly onResultRetry = (): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    const presenter = this.resultPresenter;
    try {
      this.restartFromResult();
    } catch (error) {
      let failure = normalizeError(error, 'Classic Bird Retry failed');
      let fatalFailure = (
        error instanceof ClassicBirdLifecycleRollbackError
          ? error
          : null
      );
      if (
        fatalFailure === null
        && presenter !== null
        && this.resultPresenter === presenter
        && presenter.state.navigation === 'retry'
      ) {
        const rollbackFailures: unknown[] = [];
        collectCleanupFailure(rollbackFailures, () => {
          if (
            !presenter.rearmNavigationAfterFailure('retry')
            || presenter.state.navigation !== 'none'
          ) {
            throw new Error(
              'Classic Bird Retry preflight could not rearm Result',
            );
          }
        });
        if (rollbackFailures.length > 0) {
          fatalFailure = new ClassicBirdLifecycleRollbackError(
            'Classic Bird Retry preflight rollback failed',
            error,
            rollbackFailures,
          );
        }
      }
      if (fatalFailure !== null) {
        this.retainFatalLifecycleBoundary(fatalFailure);
        failure = fatalFailure;
      }
      const payload: ClassicBirdResultRetryFailedEvent = Object.freeze({
        message: failure.message,
        reason: 'restart-error',
      });
      this.node.emit(CLASSIC_BIRD_RESULT_RETRY_FAILED_EVENT, payload);
      console.error(failure);
    }
  };

  private restartFromResult(): void {
    this.drainRetiredRuns();
    const configured = this.configuredResult();
    const retainedResultConfiguration: ClassicBirdPendingResultConfiguration = {
      mode: configured.mode,
      score: configured.score,
    };
    const resultRoot = this.requireAttachedResultRoot();
    const resultPresenter = this.requireResultPresenter();
    const placement = this.requireScreenPlacement();
    const scene = this.requireSceneController();
    const commands = createClassicBirdResultNavigationCommands({
      effectsEnabled: this.effectsEnabled(),
      mode: configured.mode,
      route: 'retry',
    });
    let captured = false;
    let detached = false;
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
              throw new Error(
                'Classic Bird Retry lost Result before capture',
              );
            }
            captured = true;
            break;
          case 'remove-result':
            if (!captured || command.cleanup !== true) {
              throw new Error(
                'Classic Bird Retry must capture Result before removal',
              );
            }
            if (placement.detachCurrentScreen(resultRoot) !== resultRoot) {
              throw new Error(
                'Classic Bird Retry detached an unexpected Result',
              );
            }
            detached = true;
            break;
          case 'construct-classic-bird':
            if (
              !detached
              || !command.fresh
              || command.mode !== CLASSIC_BIRD_RESULT_MODE_ID
            ) {
              throw new Error(
                'Classic Bird Retry requires fresh mode-3 construction',
              );
            }
            this.constructMode();
            break;
          case 'attach-classic-bird-to-captured-parent':
            if (command.zOrder !== 1) {
              throw new Error(
                'Classic Bird Retry requires native z-order 1',
              );
            }
            this.attachModeAndActivateScene(placement);
            break;
          default:
            throwUnexpectedRetryCommand(command);
        }
      }
    } catch (error) {
      const failures: unknown[] = [];
      if (scene.active) {
        collectCleanupFailure(
          failures,
          () => scene.releaseClassicBirdLayerForReplacement(),
        );
      }
      collectCleanupFailure(failures, () => this.disposeModePresentation());
      this.pendingResultConfiguration = retainedResultConfiguration;
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
          'Classic Bird Retry rollback could not restore Result ownership',
        ));
      }
      if (failures.length > 0) {
        throw new ClassicBirdLifecycleRollbackError(
          'Classic Bird Retry rollback failed',
          error,
          failures,
        );
      }
      collectCleanupFailure(failures, () => {
        if (
          !resultPresenter.rearmNavigationAfterFailure('retry')
          || resultPresenter.state.navigation !== 'none'
        ) {
          throw new Error(
            'Classic Bird Retry rollback could not rearm Result',
          );
        }
      });
      if (failures.length > 0) {
        throw new ClassicBirdLifecycleRollbackError(
          'Classic Bird Retry rollback failed',
          error,
          failures,
        );
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
    reportCleanupFailures(
      'Committed Classic Bird Retry Result cleanup',
      failures,
    );
    this.emitSnapshot();
  }

  private readonly onResultMenu = (): void => {
    if (this.lifecycleFatalError !== null) {
      return;
    }
    const presenter = this.requireResultPresenter();
    let transaction: ClassicBirdResultMenuTransaction | null = null;
    try {
      const configured = this.configuredResult();
      const root = this.requireAttachedResultRoot();
      const commands = createClassicBirdResultNavigationCommands({
        effectsEnabled: this.effectsEnabled(),
        mode: configured.mode,
        route: 'main-menu',
      });
      const activeTransaction: ClassicBirdResultMenuTransaction = {
        presenter,
        root,
        screenPlacement: this.requireScreenPlacement(),
        status: 'pending',
      };
      transaction = activeTransaction;
      for (const command of commands) {
        this.emitCommand(command);
        if (command.type === 'request-menu-button-audio') {
          this.requireClassicGameplayController()
            .sharedAudioPresenter.playOneShot(command.canonicalPath);
        }
      }
      const payload: ClassicBirdResultMenuRequestedEvent = Object.freeze({
        completedRunScore: configured.score,
        resultRoot: root,
        commit: (previousRoot: Node) => (
          this.commitResultMenu(activeTransaction, previousRoot)
        ),
        rollback: () => this.rollbackResultMenu(activeTransaction),
      });
      this.node.emit(CLASSIC_BIRD_RESULT_MENU_REQUESTED_EVENT, payload);
    } catch (error) {
      if (transaction === null) {
        const rearmed = (
          this.resultPresenter === presenter
          && (
            presenter.state.navigation === 'none'
            || presenter.rearmNavigationAfterFailure('menu')
          )
        );
        if (!rearmed) {
          const failure = new ClassicBirdLifecycleRollbackError(
            'Classic Bird Result menu preflight rollback failed',
            error,
            [new Error('Classic Bird Result menu could not rearm Result')],
          );
          this.retainFatalLifecycleBoundary(failure);
          throw failure;
        }
      } else if (transaction.status === 'pending') {
        try {
          this.rollbackResultMenu(transaction);
        } catch (rollbackError) {
          const failure = new ClassicBirdLifecycleRollbackError(
            'Classic Bird Result menu rollback failed',
            error,
            [rollbackError],
          );
          this.retainFatalLifecycleBoundary(failure);
          throw failure;
        }
      }
      if (error instanceof ClassicBirdLifecycleRollbackError) {
        this.retainFatalLifecycleBoundary(error);
      }
      throw error;
    }
    if (transaction.status === 'pending') {
      try {
        this.rollbackResultMenu(transaction);
      } catch (error) {
        const failure = new ClassicBirdLifecycleRollbackError(
          'Classic Bird Result menu rollback failed',
          new Error('Classic Bird Result menu request returned without settlement'),
          [error],
        );
        this.retainFatalLifecycleBoundary(failure);
        throw failure;
      }
    }
  };

  private commitResultMenu(
    transaction: ClassicBirdResultMenuTransaction,
    previousRoot: Node,
  ): void {
    if (transaction.status === 'committed') {
      return;
    }
    if (previousRoot !== transaction.root) {
      throw new Error(
        'Classic Bird Result menu commit received an unexpected previous screen',
      );
    }
    if (transaction.status === 'rolled-back') {
      throw new Error(
        'Rolled-back Classic Bird Result menu cannot commit',
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
        'Classic Bird Result menu commit requires screen replacement',
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
      'Committed Classic Bird Result menu cleanup',
      failures,
    );
  }

  private rollbackResultMenu(
    transaction: ClassicBirdResultMenuTransaction,
  ): void {
    if (transaction.status === 'rolled-back') {
      return;
    }
    if (transaction.status === 'committed') {
      throw new Error(
        'Committed Classic Bird Result menu cannot roll back',
      );
    }
    if (
      this.resultPresentationRoot !== transaction.root
      || this.resultPresenter !== transaction.presenter
      || !isValid(transaction.root, true)
    ) {
      throw new Error(
        'Classic Bird Result menu rollback lost Result ownership',
      );
    }
    const current = transaction.screenPlacement.currentScreen;
    if (current !== transaction.root) {
      if (transaction.root.parent !== null) {
        throw new Error(
          'Classic Bird Result menu rollback found an unknown parent',
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
    ) {
      throw new Error(
        'Classic Bird Result menu rollback could not restore Result',
      );
    }
    transaction.status = 'rolled-back';
    this.emitSnapshot();
  }

  private readonly onResultTotalCoinsEntranceComplete = (): number => {
    if (this.pendingResultEntryTransaction !== null) {
      throw new Error(
        'Classic Bird Result reward cannot commit before Result entry',
      );
    }
    const configured = this.configuredResult();
    const award = this.requireClassicGameplayController()
      .sharedSettingsRuntime.state.awardClassicBirdResultCoins(
        configured.score,
      );
    const payload: ClassicBirdResultRewardReadyEvent = Object.freeze({
      bonusCoins: award.bonusCoins,
      completedRunScore: configured.score,
      totalCoins: award.totalCoins,
    });
    this.node.emit(CLASSIC_BIRD_RESULT_REWARD_READY_EVENT, payload);
    return award.bonusCoins;
  };

  private retainFatalLifecycleBoundary(
    error: ClassicBirdLifecycleRollbackError,
  ): void {
    this.lifecycleFatalError ??= error;
    this.unschedule(this.onSwishCooldownComplete);
  }

  private updateScorePresentation(): void {
    const score = this.classicBirdSceneController?.sessionSnapshot().score;
    if (score === undefined) {
      return;
    }
    const best = this.requireClassicGameplayController()
      .sharedSettingsRuntime.state.birdClassicLeaderboard.first;
    this.scoreHudPresenter?.setDisplayedScore(score.displayedScore);
    this.scoreHudPresenter?.setBestScore(
      Math.max(best, score.authoritativeScore),
      score.authoritativeScore > best,
    );
    this.scoreHudPresenter?.setPendingDoubleScore(0);
  }

  private stopAllBirdRunEffects(): void {
    const failures: unknown[] = [];
    const classic = this.classicGameplayController;
    const crazy = this.crazyGameplayController;
    if (classic !== null) {
      collectCleanupFailure(
        failures,
        () => classic.sharedAudioPresenter.stopAllEffects(),
      );
    }
    if (crazy !== null) {
      collectCleanupFailure(
        failures,
        () => crazy.sharedCrazyAudioPresenter.stopAllEffects(),
      );
    }
    if (failures.length > 0) {
      throw cleanupError('Classic Bird stop-all-effects', failures);
    }
  }

  private disposeCutHalfPresenters(): void {
    const failures: unknown[] = [];
    for (const presenter of [...this.cutHalfPresenters]) {
      try {
        presenter.disposeAll();
        this.cutHalfPresenters.delete(presenter);
        this.criticalCutHalfPresenters.delete(presenter);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw cleanupError('Classic Bird cut halves', failures);
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
            'Classic Bird teardown detached an unexpected current screen',
          );
        }
      });
    }

    this.unschedule(this.onSwishCooldownComplete);
    this.swishAudio?.unlock();
    this.swishAudio = null;

    const coordinator = this.coordinator;
    if (coordinator !== null) {
      collectCleanupFailure(failures, () => coordinator.stopAll());
      // Never use magnetEnd here: it would resume Bomb controllers after shutdown.
      collectCleanupFailure(
        failures,
        () => coordinator.restoreNormalFruitIntervalForCleanup(),
      );
    }

    for (const presenter of [...this.magnetPresenters]) {
      try {
        presenter.dispose();
        this.magnetPresenters.delete(presenter);
      } catch (error) {
        failures.push(error);
      }
    }
    for (const [targetId, owner] of [
      ...this.standardBombExplosionOwners,
    ]) {
      try {
        // Explicit teardown does not synthesize AfterBombHit. Registry drain owns the
        // frozen entity, while the generation token prevents a retired callback leak.
        owner.presenter.dispose();
        if (this.standardBombExplosionOwners.get(targetId) === owner) {
          this.standardBombExplosionOwners.delete(targetId);
        }
      } catch (error) {
        failures.push(error);
      }
    }
    for (const [targetId, presenter] of [
      ...this.standardBombFuseSmokePresenters,
    ]) {
      try {
        presenter.dispose();
        if (
          this.standardBombFuseSmokePresenters.get(targetId) === presenter
        ) {
          this.standardBombFuseSmokePresenters.delete(targetId);
        }
      } catch (error) {
        failures.push(error);
      }
    }
    for (const targetId of [
      ...this.standardBombEntryAudioHandles.keys(),
    ]) {
      collectCleanupFailure(
        failures,
        () => this.disposeStandardBombEntryAudio(targetId),
      );
    }
    collectCleanupFailure(failures, () => this.disposeCutHalfPresenters());
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
    const gameOverPresenter = this.gameOverPresenter;
    if (gameOverPresenter !== null) {
      try {
        gameOverPresenter.dispose();
        if (this.gameOverPresenter === gameOverPresenter) {
          this.gameOverPresenter = null;
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
    this.birdBladeRayAdapter = null;
    const birdBladePresenter = this.birdBladePresenter;
    if (birdBladePresenter !== null) {
      try {
        birdBladePresenter.dispose();
        if (this.birdBladePresenter === birdBladePresenter) {
          this.birdBladePresenter = null;
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
    const failPresenter = this.failPresenter;
    if (failPresenter !== null) {
      try {
        failPresenter.dispose();
        if (this.failPresenter === failPresenter) {
          this.failPresenter = null;
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
        registry.disposeAll();
        registryDrained = (
          registry.size === 0
          && registry.activeDragonEffectCount === 0
        );
        if (!registryDrained) {
          failures.push(new Error(
            'Classic Bird registry drain retained an entity owner',
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
      && this.magnetPresenters.size === 0
      && this.standardBombExplosionOwners.size === 0
      && this.standardBombFuseSmokePresenters.size === 0
      && this.standardBombEntryAudioHandles.size === 0
      && this.cutHalfPresenters.size === 0
      && this.criticalParticlePresenters.size === 0
      && this.comboItemPresenters.size === 0
      && this.introPresenter === null
      && this.gameOverPresenter === null
      && this.bombElectricPresenter === null
      && this.electricContactAdapter === null
      && this.birdBladePresenter === null
      && this.scoreHudPresenter === null
      && this.failPresenter === null
      && this.pausePresenter === null
    );
    if (presentationOwnersDrained) {
      this.criticalCutHalfPresenters.clear();
      this.coordinator = null;
      this.combo = null;
      this.fail = null;
      for (const childRoot of [
        this.worldPresentationRoot,
        this.scoreHudRoot,
        this.failPresentationRoot,
      ]) {
        if (childRoot !== null && isValid(childRoot, true)) {
          collectCleanupFailure(failures, () => childRoot.destroy());
        }
      }
      this.worldPresentationRoot = null;
      this.scoreHudRoot = null;
      this.failPresentationRoot = null;
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
      throw cleanupError('Classic Bird mode presentation', failures);
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
      throw cleanupError('Classic Bird Result presentation', failures);
    }
  }

  private releaseSceneForTeardown(): void {
    const scene = this.classicBirdSceneController;
    if (scene === null || !isValid(scene, true)) {
      return;
    }
    if (scene.active) {
      scene.releaseClassicBirdLayerForReplacement();
    } else if (scene.suspended) {
      scene.finalizeSuspendedClassicBirdLayerRelease();
    }
  }

  private disposeStandbySceneController(): void {
    const standby = this.standbySceneController;
    this.standbySceneController = null;
    if (
      standby !== null
      && standby !== this.classicBirdSceneController
      && isValid(standby, true)
    ) {
      standby.destroy();
    }
  }

  private get sharedGameplayRandom(): GameplayRandom {
    return this.requireClassicGameplayController().sharedGameplayRandom;
  }

  private readonly effectsEnabled = (): boolean => (
    this.classicGameplayController?.sharedSettingsRuntime
      .state.snapshot.effectsEnabled ?? true
  );

  private requireClassicGameplayController(): ClassicGameplayController {
    const controller = this.classicGameplayController;
    if (controller === null) {
      throw new Error(
        'Classic Bird requires its sibling Classic process owner',
      );
    }
    return controller;
  }

  private requireCrazyGameplayController(): CrazyGameplayController {
    const controller = this.crazyGameplayController;
    if (controller === null) {
      throw new Error(
        'Classic Bird requires its sibling Crazy process owner',
      );
    }
    return controller;
  }

  private requireSceneController(): ClassicBirdSceneController {
    const controller = this.classicBirdSceneController;
    if (controller === null) {
      throw new Error(
        'Classic Bird scene controller is unavailable before onLoad',
      );
    }
    return controller;
  }

  private requireResolution(): NonNullable<
    ReturnType<ClassicSceneController['resolutionSnapshot']>
  > {
    const resolution = this.classicSceneController?.resolutionSnapshot();
    if (resolution === null || resolution === undefined) {
      throw new Error(
        'Classic Bird requires the prepared shared resolution profile',
      );
    }
    return resolution;
  }

  private requireViewport(): ClassicBirdViewport {
    const visibleRect = this.requireResolution().visibleRect;
    return Object.freeze({
      height: visibleRect.height,
      width: visibleRect.width,
      x: visibleRect.x,
      y: visibleRect.y,
    });
  }

  private requireBirdResources(): LoadedBirdResources {
    const resources = this.birdResources;
    if (resources === null) {
      throw new Error(
        'Classic Bird resources are unavailable before preparation',
      );
    }
    return resources;
  }

  private requireObjectivesManager(): ObjectivesManagerState {
    return this.requireCrazyGameplayController().sharedObjectivesManager;
  }

  private requirePausePresenter(): BaseGameplayPausePresenter {
    const presenter = this.pausePresenter;
    if (presenter === null) {
      throw new Error(
        'Classic Bird pause presenter is unavailable before scene entry',
      );
    }
    return presenter;
  }

  private requireScreenPlacement(): ClassicBirdScreenPlacementPort {
    const screenPlacement = this.screenPlacement;
    if (screenPlacement === null) {
      throw new Error(
        'Classic Bird current-screen placement is unavailable',
      );
    }
    return screenPlacement;
  }

  private requireModeRoot(): Node {
    const root = this.modeRoot;
    if (root === null || !isValid(root, true)) {
      throw new Error('Classic Bird mode root is unavailable');
    }
    return root;
  }

  private requireDetachedModeRoot(): Node {
    const root = this.requireModeRoot();
    if (root.parent !== null) {
      throw new Error(
        'Classic Bird mode root must be detached before attachment',
      );
    }
    return root;
  }

  private requireWorldPresentationRoot(): Node {
    const root = this.worldPresentationRoot;
    if (root === null || !isValid(root, true)) {
      throw new Error(
        'Classic Bird world presentation root is unavailable',
      );
    }
    return root;
  }

  private requireScoreHudRoot(): Node {
    const root = this.scoreHudRoot;
    if (root === null || !isValid(root, true)) {
      throw new Error('Classic Bird score HUD root is unavailable');
    }
    return root;
  }

  private requireFailPresentationRoot(): Node {
    const root = this.failPresentationRoot;
    if (root === null || !isValid(root, true)) {
      throw new Error(
        'Classic Bird fail presentation root is unavailable',
      );
    }
    return root;
  }

  private requireRegistry(): CrazyEntityRegistry {
    const registry = this.registry;
    if (registry === null) {
      throw new Error('Classic Bird entity registry is unavailable');
    }
    return registry;
  }

  private requireCoordinator(): ClassicBirdTossCoordinator {
    const coordinator = this.coordinator;
    if (coordinator === null) {
      throw new Error('Classic Bird toss coordinator is unavailable');
    }
    return coordinator;
  }

  private requireCombo(): ComboService {
    const combo = this.combo;
    if (combo === null) {
      throw new Error('Classic Bird combo service is unavailable');
    }
    return combo;
  }

  private requireFail(): FailService {
    const fail = this.fail;
    if (fail === null) {
      throw new Error('Classic Bird fail service is unavailable');
    }
    return fail;
  }

  private requireIntroPresenter(): ClassicBirdWordPresenter {
    const presenter = this.introPresenter;
    if (presenter === null) {
      throw new Error('Classic Bird GOOD/LUCK presenter is unavailable');
    }
    return presenter;
  }

  private requireBombElectricPresenter(): CrazyBombElectricPresenter {
    const presenter = this.bombElectricPresenter;
    if (presenter === null) {
      throw new Error('Classic Bird BombElectric presenter is unavailable');
    }
    return presenter;
  }

  private requireBirdBladePresenter(): BirdBladePresenter {
    const presenter = this.birdBladePresenter;
    if (presenter === null) {
      throw new Error('Classic Bird Blade presenter is unavailable');
    }
    return presenter;
  }

  private requireScoreHudPresenter(): ClassicScoreHudPresenter {
    const presenter = this.scoreHudPresenter;
    if (presenter === null) {
      throw new Error('Classic Bird score HUD presenter is unavailable');
    }
    return presenter;
  }

  private requireFailPresenter(): ClassicFailPresenter {
    const presenter = this.failPresenter;
    if (presenter === null) {
      throw new Error('Classic Bird fail presenter is unavailable');
    }
    return presenter;
  }

  private requireSwishAudio(): ClassicSwishAudioGate {
    const gate = this.swishAudio;
    if (gate === null) {
      throw new Error('Classic Bird swish gate is unavailable');
    }
    return gate;
  }

  private requireResultPresenter(): ClassicResultPresenter {
    const presenter = this.resultPresenter;
    if (presenter === null) {
      throw new Error('Classic Bird Result presenter is unavailable');
    }
    return presenter;
  }

  private requirePendingResultTransition():
    ClassicBirdResultEntryTransaction {
    const transaction = this.pendingResultEntryTransaction;
    if (transaction === null || transaction.status !== 'pending') {
      throw new Error('Classic Bird Result transition is not pending');
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
      throw new Error(
        'Classic Bird Result must be the active current screen',
      );
    }
    return root;
  }

  private assertCoordinatorContains(
    controller: ClassicBirdTossControllerId,
  ): void {
    this.requireCoordinator().controllerSnapshot(controller);
  }

  private isGameplayAttached(): boolean {
    const root = this.modeRoot;
    return (
      this.lifecycleFatalError === null
      && root !== null
      && isValid(root, true)
      && root.parent !== null
      && this.screenPlacement?.currentScreen === root
      && root.activeInHierarchy
      && this.classicBirdSceneController?.active === true
    );
  }

  private assertPreparationStillUsable(): void {
    if (this.shuttingDown || !isValid(this.node, true)) {
      throw new Error(
        'Classic Bird preparation completed after destruction',
      );
    }
  }

  private emitCommands(commands: readonly unknown[]): void {
    for (const command of commands) {
      this.emitCommand(command);
    }
  }

  private emitCommand(command: unknown): void {
    if (!this.shuttingDown) {
      this.node.emit(CLASSIC_BIRD_GAMEPLAY_COMMAND_EVENT, command);
    }
  }

  private emitSnapshot(): void {
    if (!this.shuttingDown && isValid(this.node, true)) {
      this.node.emit(
        CLASSIC_BIRD_GAMEPLAY_SNAPSHOT_EVENT,
        this.snapshot(),
      );
    }
  }
}

function createPresenterRoot(parent: Node, name: string): Node {
  const root = new Node(name);
  root.layer = parent.layer;
  root.setParent(parent);
  return root;
}

function assertScreenPlacementPort(
  screenPlacement: ClassicBirdScreenPlacementPort,
): void {
  if (
    screenPlacement === null
    || typeof screenPlacement !== 'object'
    || typeof screenPlacement.attachCurrentScreen !== 'function'
    || typeof screenPlacement.detachCurrentScreen !== 'function'
    || typeof screenPlacement.replaceCurrentScreen !== 'function'
  ) {
    throw new TypeError(
      'Classic Bird screen placement must implement current-screen ownership',
    );
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function normalizeError(error: unknown, fallback: string): Error {
  return error instanceof Error
    ? error
    : new Error(`${fallback}: ${String(error)}`);
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

function cleanupError(
  label: string,
  failures: readonly unknown[],
): Error {
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

function reportCleanupFailures(
  label: string,
  failures: readonly unknown[],
): void {
  if (failures.length > 0) {
    console.error(cleanupError(label, failures));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function throwUnexpectedCoordinatorBatch(
  batch: never,
): never {
  throw new Error(
    `Unsupported Classic Bird coordinator batch ${String(batch)}`,
  );
}

function throwUnexpectedSessionCommand(command: never): never {
  throw new Error(
    `Unsupported Classic Bird session command ${String(command)}`,
  );
}

function throwUnexpectedComboCommand(command: never): never {
  throw new Error(
    `Unsupported Classic Bird Combo command ${String(command)}`,
  );
}

function throwUnexpectedFailCommand(command: never): never {
  throw new Error(
    `Unsupported Classic Bird fail command ${String(command)}`,
  );
}

function throwUnexpectedAudioCommand(command: never): never {
  throw new Error(
    `Unsupported Classic Bird Crazy audio command ${String(command)}`,
  );
}

function throwUnexpectedRetryCommand(
  command: ClassicBirdResultNavigationCommand,
): never {
  throw new Error(
    `Unsupported Classic Bird Retry command ${command.type}`,
  );
}
