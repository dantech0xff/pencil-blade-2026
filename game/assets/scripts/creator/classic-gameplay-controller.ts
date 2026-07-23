import {
  _decorator,
  Component,
  Node,
  Sprite,
  Tween,
  UITransform,
  Vec3,
  isValid,
  tween,
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
  getClassicResultRankAudioPath,
} from '../domain/classic-audio-contract';
import { ClassicSwishAudioGate } from '../domain/classic-swish-audio-gate';
import { createClassicCriticalParticleUpdateCommands } from '../domain/classic-critical-particle-plan';
import {
  createClassicFruitCutCommands,
} from '../domain/classic-fruit-cut';
import { createClassicCutHalfMotion } from '../domain/classic-cut-half-motion';
import type { ClassicSessionCommand, ClassicTossControllerId } from '../domain/classic-session';
import {
  ClassicSpawnPlanner,
  type ClassicSpawnCommand,
} from '../domain/classic-spawn-planner';
import { CLASSIC_TOSS_DIRECTION, sampleSpawnKinematics } from '../domain/spawn-kinematics';
import {
  ClassicFreeTossStrategy,
  type ClassicTossStrategyCommand,
} from '../domain/classic-toss-strategies';
import {
  applyComboCommandBatch,
  ComboService,
  type ComboCommand,
} from '../domain/combo-service';
import type { FailCommand } from '../domain/fail-service';
import { FailService } from '../domain/fail-service';
import {
  ModuloGameplayRandom,
  SeededTargetRawSource,
  type GameplayRandom,
} from '../domain/gameplay-random';
import type { ScoreCommand } from '../domain/score-service';
import { ScoreService } from '../domain/score-service';
import {
  classicLeaderboardPanelValues,
} from '../domain/classic-result-ranking';
import {
  createClassicResultNavigationCommands,
  type ClassicResultNavigationCommand,
} from '../domain/classic-result-navigation';
import {
  createRecoveredResultObjectiveCommand,
} from '../domain/recovered-result-objective';
import type {
  ObjectiveAchievementPopupEvent,
  ObjectivesManagerState,
} from '../domain/objectives-manager-state';
import { TossTimer } from '../domain/toss-timer';
import {
  CLASSIC_BLADE_BEGAN_EVENT,
  CLASSIC_BLADE_ENDED_EVENT,
  CLASSIC_BLADE_MOVED_EVENT,
  type ClassicBladeBeganEvent,
  type ClassicBladeEndedEvent,
} from './blade-input-controller';
import { ClassicAudioPresenter } from './classic-audio-presenter';
import {
  loadBaseGameplayResources,
  type LoadedBaseGameplayResources,
} from './base-gameplay-resource-loader';
import { ClassicBladePresenter } from './classic-blade-presenter';
import { ComboItemPresenter } from './combo-item-presenter';
import { ClassicCriticalParticlePresenter } from './classic-critical-particle-presenter';
import { ClassicCutHalfPresenter } from './classic-cut-half-presenter';
import { ClassicEntityRegistry } from './classic-entity-registry';
import { ClassicFailPresenter } from './classic-fail-presenter';
import { ClassicResultPresenter } from './classic-result-presenter';
import { ClassicScoreHudPresenter } from './classic-score-hud-presenter';
import { createDetachedScreenRoot } from './detached-screen-root';
import {
  getClassicSettingsRuntime,
  type ClassicSettingsRuntime,
} from './classic-settings-runtime';
import type {
  ClassicGeneratedFruitCutEvent,
  ClassicGeneratedFruitMissEvent,
} from './classic-generated-fruit';
import {
  CLASSIC_PHYSICS_STEPPED_EVENT,
  CLASSIC_SESSION_COMMAND_EVENT,
  ClassicSceneController,
  type ClassicPhysicsSteppedEvent,
} from './classic-scene-controller';
import {
  ClassicSliceResourceCatalog,
  loadClassicSliceResourceCatalog,
  type LoadedClassicRasterResource,
} from './classic-resource-loader';
import { ObjectiveAchievementPresenter } from './objective-achievement-presenter';

const { ccclass, requireComponent } = _decorator;

export const CLASSIC_GAMEPLAY_COMMAND_EVENT = 'classic-gameplay-command';
export const CLASSIC_GAMEPLAY_SNAPSHOT_EVENT = 'classic-gameplay-snapshot';
export const CLASSIC_DEFERRED_TOSS_CONTROLLER_EVENT = 'classic-deferred-toss-controller';
export const CLASSIC_RESOURCE_LOAD_FAILED_EVENT = 'classic-resource-load-failed';
export const CLASSIC_RESULT_MENU_REQUESTED_EVENT = 'classic-result-menu-requested';
export const CLASSIC_RESULT_REWARD_READY_EVENT = 'classic-result-reward-ready';
export const CLASSIC_RESULT_RETRY_FAILED_EVENT = 'classic-result-retry-failed';
export const CLASSIC_SETTINGS_LOAD_RECOVERED_EVENT = 'classic-settings-load-recovered';
export const CLASSIC_SETTINGS_SAVE_FAILED_EVENT = 'classic-settings-save-failed';

const TARGET_REPLAY_SEED = 0x5042_4c44;
const NORMAL_FREE_CONTROLLER: ClassicTossControllerId = 'normal-free';

export interface ClassicDeferredTossControllerEvent {
  readonly action: 'start' | 'stop';
  readonly controller: ClassicTossControllerId;
  readonly reason: 'bounded-normal-fruit-slice';
}

export interface ClassicGameplaySnapshot {
  readonly activeFruitCount: number;
  readonly deferredControllers: readonly ClassicTossControllerId[];
  readonly displayedScore: number;
  readonly gameOver: boolean;
  readonly score: number;
  readonly strikes: number;
}

export interface ClassicScreenPlacementPort {
  readonly currentScreen: Node | null;
  attachCurrentScreen(screen: Node): void;
  detachCurrentScreen(expectedScreen?: Node): Node;
  replaceCurrentScreen(nextScreen: Node): Node;
}

export interface ClassicResultMenuRequestedEvent {
  readonly completedRunScore: number;
  readonly resultRoot: Node;
  commit(previousRoot: Node): void;
  rollback(): void;
}

export interface ClassicResultRewardReadyEvent {
  readonly bonusCoins: number;
  readonly completedRunScore: number;
  readonly totalCoins: number;
}

export interface ClassicResultRetryFailedEvent {
  readonly message: string;
  readonly reason: 'restart-error';
}

interface ClassicRetryRestartContext {
  readonly audioPresenter: ClassicAudioPresenter;
  readonly mode: 0;
  readonly previousRunState: ClassicRetryRunStateSnapshot;
  readonly resources: ClassicSliceResourceCatalog;
  readonly resultRoot: Node;
  readonly score: number;
  readonly sceneController: ClassicSceneController;
  readonly screenPlacement: ClassicScreenPlacementPort;
  readonly viewport: Readonly<{ x: number; y: number; width: number; height: number }>;
}

interface ClassicRetryRunStateSnapshot {
  readonly combo: ComboService;
  readonly deferredControllers: readonly ClassicTossControllerId[];
  readonly fail: FailService;
  readonly gameOver: boolean;
  readonly planner: ClassicSpawnPlanner;
  readonly score: ScoreService;
  readonly swishAudio: ClassicSwishAudioGate;
}

interface ClassicRetryRestartState {
  capturedResultRoot: Node | null;
  resultCleanupCommitted: boolean;
  resultDetached: boolean;
}

interface ClassicRetryResultCleanupToken {
  readonly presenter: ClassicResultPresenter;
  readonly root: Node;
}

interface ClassicResultMenuTransactionState {
  readonly presenter: ClassicResultPresenter;
  readonly root: Node;
  readonly screenPlacement: ClassicScreenPlacementPort;
  status: 'committed' | 'pending' | 'rolled-back';
}

/**
 * Playable Classic slice: the recovered intro gate starts the normal-free timer, exact
 * recovered fruit use Creator Physics2D, post-step blade rays drive cut/score/combo, and the
 * terminal callback replaces Classic presentation with the recovered result-entry shell.
 * The serialized component is passive until the app-shell explicitly prepares and activates
 * Classic through a shared current-screen placement port.
 */
@ccclass('ClassicGameplayController')
@requireComponent(ClassicSceneController)
export class ClassicGameplayController extends Component {
  private readonly random = new ModuloGameplayRandom(
    new SeededTargetRawSource(TARGET_REPLAY_SEED),
  );
  private planner = new ClassicSpawnPlanner({
    random: this.random,
    sampleKinematics: sampleSpawnKinematics,
  });
  private swishAudio = new ClassicSwishAudioGate(this.random);
  private combo = new ComboService(this.random);
  private fail = new FailService();
  private score = new ScoreService();
  private readonly deferredControllers = new Set<ClassicTossControllerId>();
  private readonly cutHalfPresenters = new Set<ClassicCutHalfPresenter>();
  private readonly criticalCutHalfPresenters = new Set<ClassicCutHalfPresenter>();
  private readonly criticalParticlePresenters = new Set<ClassicCriticalParticlePresenter>();
  private readonly comboItemPresenters = new Set<ComboItemPresenter>();
  private readonly objectiveAchievementPresenters = new Set<
    ObjectiveAchievementPresenter
  >();
  private sceneController: ClassicSceneController | null = null;
  private audioPresenter: ClassicAudioPresenter | null = null;
  private baseGameplayResources: LoadedBaseGameplayResources | null = null;
  private classicModeRoot: Node | null = null;
  private scoreHudRoot: Node | null = null;
  private worldPresentationRoot: Node | null = null;
  private failPresentationRoot: Node | null = null;
  private resultPresentationRoot: Node | null = null;
  private registry: ClassicEntityRegistry | null = null;
  private failPresenter: ClassicFailPresenter | null = null;
  private bladePresenter: ClassicBladePresenter | null = null;
  private resultPresenter: ClassicResultPresenter | null = null;
  private scoreHudPresenter: ClassicScoreHudPresenter | null = null;
  private resourceCatalog: ClassicSliceResourceCatalog | null = null;
  private normalFree: ClassicFreeTossStrategy | null = null;
  private introGoodNode: Node | null = null;
  private introLuckNode: Node | null = null;
  private terminalGameNode: Node | null = null;
  private terminalOverNode: Node | null = null;
  private settingsRuntime: ClassicSettingsRuntime | null = null;
  private objectiveAchievementTargetRoot: Node | null = null;
  private objectivesManager: ObjectivesManagerState | null = null;
  private resultConstructionRequested = false;
  private resultObjectiveTailAttempted = false;
  private resultMode: 0 | null = null;
  private resultScore: number | null = null;
  private gameOver = false;
  private shuttingDown = false;
  private recoveredRuntimePreparation: Promise<void> | null = null;
  private screenPlacement: ClassicScreenPlacementPort | null = null;
  private initialClassicRuntimeActivated = false;

  onLoad(): void {
    const sceneController = this.getComponent(ClassicSceneController);
    if (sceneController === null) {
      throw new Error('ClassicGameplayController requires ClassicSceneController');
    }
    this.sceneController = sceneController;
    this.settingsRuntime = getClassicSettingsRuntime();
    if (this.settingsRuntime.loadFailure !== null) {
      this.node.emit(
        CLASSIC_SETTINGS_LOAD_RECOVERED_EVENT,
        this.settingsRuntime.loadFailure,
      );
      console.warn(this.settingsRuntime.loadFailure);
    }
    this.score = new ScoreService(
      0,
      0,
      this.settingsRuntime.state.snapshot.leaderboard.first,
    );
  }

  get sharedGameplayRandom(): GameplayRandom {
    return this.random;
  }

  get sharedSettingsRuntime(): ClassicSettingsRuntime {
    return this.requireSettingsRuntime();
  }

  get sharedAudioPresenter(): ClassicAudioPresenter {
    if (this.shuttingDown || this.audioPresenter === null) {
      throw new Error('Classic audio presenter is unavailable before preparation or after teardown');
    }
    return this.audioPresenter;
  }

  get sharedResourceCatalog(): ClassicSliceResourceCatalog {
    if (this.shuttingDown || this.resourceCatalog === null) {
      throw new Error('Classic resource catalog is unavailable before preparation or after teardown');
    }
    return this.resourceCatalog;
  }

  /** Loads the Classic catalog and audio once without constructing or attaching a screen. */
  prepareRecoveredRuntime(): Promise<void> {
    if (this.shuttingDown || !isValid(this.node, true)) {
      throw new Error('Classic runtime cannot be prepared after destruction');
    }
    if (
      this.resourceCatalog !== null
      && this.audioPresenter !== null
      && this.baseGameplayResources !== null
      && this.objectivesManager !== null
    ) {
      return this.recoveredRuntimePreparation ?? Promise.resolve();
    }
    if (this.recoveredRuntimePreparation !== null) {
      return this.recoveredRuntimePreparation;
    }
    const sceneController = this.sceneController;
    if (sceneController === null) {
      throw new Error('Classic scene controller must load before runtime preparation');
    }
    const assetTree = sceneController.resolutionSnapshot()?.profile.assetTree;
    if (assetTree === undefined) {
      throw new Error('Classic resolution must be prepared before runtime preparation');
    }

    const preparation = this.initializeRecoveredResources(assetTree);
    this.recoveredRuntimePreparation = preparation;
    void preparation.catch((error: unknown) => {
      if (this.recoveredRuntimePreparation === preparation) {
        this.recoveredRuntimePreparation = null;
      }
      this.onRecoveredResourceInitializationFailed(error);
    });
    return preparation;
  }

  private async initializeRecoveredResources(
    assetTree: ClassicSliceResourceCatalog['assetTree'],
  ): Promise<void> {
    let loadedAudioPresenter: ClassicAudioPresenter | null = null;
    try {
      // Load the bundle-backed visual catalog first so audio reuses the registered bundle.
      // This avoids issuing two first-load requests against Creator's bundle registry.
      const resources = await loadClassicSliceResourceCatalog(assetTree);
      const baseGameplayResources = await loadBaseGameplayResources(assetTree);
      if (this.shuttingDown || !isValid(this.node, true)) {
        throw new Error('Classic runtime preparation completed after destruction');
      }
      loadedAudioPresenter = await ClassicAudioPresenter.load(this.node);
      if (
        this.shuttingDown
        || !isValid(this.node, true)
      ) {
        loadedAudioPresenter.stop();
        throw new Error('Classic runtime preparation completed after destruction');
      }

      const objectivesManager = this.requireSettingsRuntime()
        .createObjectivesManager(this.onObjectiveAchievement);
      this.audioPresenter = loadedAudioPresenter;
      this.baseGameplayResources = baseGameplayResources;
      this.objectivesManager = objectivesManager;
      this.resourceCatalog = resources;
    } catch (error) {
      if (loadedAudioPresenter !== null && loadedAudioPresenter !== this.audioPresenter) {
        loadedAudioPresenter.stop();
      }
      throw error;
    }
  }

  /**
   * App-shell entry point for both the first Classic activation and later re-entry after
   * Result has already been removed from the shared current-screen host.
   */
  activateClassicFromAppShell(screenPlacement: ClassicScreenPlacementPort): void {
    assertScreenPlacementPort(screenPlacement);
    if (this.shuttingDown) {
      throw new Error('Classic runtime cannot activate after destruction');
    }
    const retainedScreenPlacement = this.screenPlacement;
    if (
      retainedScreenPlacement !== null
      && retainedScreenPlacement !== screenPlacement
    ) {
      throw new Error('Classic runtime must reuse the retained screen placement');
    }
    if (screenPlacement.currentScreen !== null) {
      throw new Error('Classic runtime requires an empty current-screen host');
    }
    const sceneController = this.sceneController;
    const resources = this.resourceCatalog;
    const audioPresenter = this.audioPresenter;
    if (sceneController === null || resources === null || audioPresenter === null) {
      throw new Error('Classic runtime must be prepared before activation');
    }
    if (this.baseGameplayResources === null || this.objectivesManager === null) {
      throw new Error('Classic objective runtime must be prepared before activation');
    }
    const lifecycle = sceneController.sessionSnapshot().lifecycle;
    const isReentry = this.initialClassicRuntimeActivated;
    if (isReentry) {
      if (lifecycle !== 'result-removed') {
        throw new Error('Classic runtime can re-enter only after Result removal');
      }
    } else if (lifecycle !== 'intro') {
      throw new Error('Classic runtime can activate only from intro');
    }
    if (
      this.classicModeRoot !== null
      || this.registry !== null
      || this.normalFree !== null
      || this.bladePresenter !== null
      || this.scoreHudPresenter !== null
      || this.failPresenter !== null
      || this.resultPresenter !== null
      || this.resultPresentationRoot !== null
    ) {
      throw new Error('Classic runtime requires a fully disposed presentation before activation');
    }

    this.screenPlacement = screenPlacement;
    let restartPrepared = false;
    try {
      if (isReentry) {
        sceneController.restartClassicLayer();
        restartPrepared = true;
      }
      this.resetRecoveredClassicRunState();
      this.constructRecoveredClassicMode(
        this.requireViewport(),
        resources,
        sceneController,
        audioPresenter,
      );
      this.attachRecoveredClassicMode(1);
      this.updatePresentation();
      this.emitSnapshot();
      if (isReentry) {
        sceneController.commitClassicLayerRestart();
        restartPrepared = false;
      } else {
        sceneController.activateInitialClassicLayer();
      }
      this.initialClassicRuntimeActivated = true;
    } catch (error) {
      if (restartPrepared) {
        sceneController.rollbackClassicLayerRestart();
      }
      try {
        this.disposeClassicModePresentation();
      } finally {
        this.screenPlacement = retainedScreenPlacement;
      }
      throw error;
    }
  }

  /** Preserves the original initial-launch API while routing through the shared shell path. */
  activateInitialClassicRuntime(screenPlacement: ClassicScreenPlacementPort): void {
    this.activateClassicFromAppShell(screenPlacement);
  }

  /** Native constructs the replacement layer before adding it back to the same parent. */
  private constructRecoveredClassicMode(
    viewport: Readonly<{ x: number; y: number; width: number; height: number }>,
    resources: ClassicSliceResourceCatalog,
    sceneController: ClassicSceneController,
    audioPresenter: ClassicAudioPresenter,
  ): void {
    if (
      this.classicModeRoot !== null
      || this.bladePresenter !== null
      || this.registry !== null
      || this.normalFree !== null
    ) {
      throw new Error('Classic mode can be constructed only when no run is attached');
    }

    const classicModeRoot = new Node('ClassicModeRoot');
    classicModeRoot.layer = this.node.layer;
    // Presenter constructors use recovered world coordinates while this root is detached.
    // Stage the future parent's world transform now, then preserve it at the native attach
    // boundary so Canvas translation does not offset the assembled HUD a second time.
    classicModeRoot.setWorldPosition(this.node.worldPosition);
    classicModeRoot.setWorldRotation(this.node.worldRotation);
    classicModeRoot.setWorldScale(this.node.worldScale);
    this.classicModeRoot = classicModeRoot;
    try {
      this.registry = new ClassicEntityRegistry({
        callAfterStep: (mutation) => sceneController.callAfterPhysicsStep(mutation),
        onDispose: () => this.emitSnapshot(),
        onFruitCut: (event) => this.onFruitCut(event),
        onFruitMiss: (event) => this.onFruitMiss(event),
        onPlayTossSound: (sound) => audioPresenter.playOneShot(sound),
        resourceCatalog: resources,
      });
      this.normalFree = new ClassicFreeTossStrategy({
        controllerId: 'a9',
        random: this.random,
        interval: { lowSeconds: 0.5, highSeconds: 3 },
        createTimer: (options) => new TossTimer(options),
        planner: this.planner,
        tossType: 0,
        direction: CLASSIC_TOSS_DIRECTION.UP,
        viewport: () => this.requireViewport(),
        effectsEnabled: this.effectsEnabled,
        commandSink: (commands) => {
          const spawnCommands = requireSpawnCommands(commands);
          this.registry?.applySpawnPlan(
            spawnCommands,
            this.requireWorldPresentationRoot(),
            this.requireViewport(),
          );
          this.emitCommands(commands);
          this.emitSnapshot();
        },
      });
      this.createRecoveredPresentation(classicModeRoot, viewport, resources);
      this.playRecoveredIntro(classicModeRoot, viewport, resources);
    } catch (error) {
      this.disposeClassicModePresentation();
      throw error;
    }
  }

  private attachRecoveredClassicMode(zOrder: 1): void {
    const root = this.classicModeRoot;
    if (
      zOrder !== 1
      || root === null
      || !isValid(root, true)
      || root.parent !== null
    ) {
      throw new Error('Classic mode must attach once at recovered z-order 1');
    }
    const screenPlacement = this.requireScreenPlacement();
    screenPlacement.attachCurrentScreen(root);
    if (screenPlacement.currentScreen !== root) {
      throw new Error('Classic current-screen placement lost the attached mode root');
    }
  }

  private readonly onRecoveredResourceInitializationFailed = (error: unknown): void => {
    if (this.shuttingDown || !isValid(this.node, true)) {
      return;
    }
    const failure = error instanceof Error ? error : new Error(String(error));
    this.node.emit(CLASSIC_RESOURCE_LOAD_FAILED_EVENT, failure);
    console.error(failure);
  };

  onEnable(): void {
    this.node.on(CLASSIC_BLADE_BEGAN_EVENT, this.onBladeBegan, this);
    this.node.on(CLASSIC_BLADE_MOVED_EVENT, this.onBladeMoved, this);
    this.node.on(CLASSIC_BLADE_ENDED_EVENT, this.onBladeEnded, this);
    this.node.on(CLASSIC_PHYSICS_STEPPED_EVENT, this.onPhysicsStepped, this);
    this.node.on(CLASSIC_SESSION_COMMAND_EVENT, this.onSessionCommand, this);
  }

  start(): void {
    this.updatePresentation();
    this.emitSnapshot();
  }

  update(deltaSeconds: number): void {
    for (const presenter of this.objectiveAchievementPresenters) {
      presenter.updateAction(deltaSeconds);
    }
    this.bladePresenter?.updateFrame();
    for (const presenter of [...this.comboItemPresenters]) {
      presenter.updateAction(deltaSeconds);
    }
    const lifecycle = this.sceneController?.sessionSnapshot().lifecycle;
    if (lifecycle === 'running' && !this.gameOver) {
      this.normalFree?.tick(deltaSeconds);
      this.applyComboCommands(this.combo.update(deltaSeconds, this.effectsEnabled()));
    }
    for (const presenter of this.cutHalfPresenters) {
      // Native CutFruit fades on the action clock, independently of physics world speed.
      presenter.updateAction(deltaSeconds);
    }
    for (const presenter of this.criticalParticlePresenters) {
      presenter.updateAction(deltaSeconds);
    }
    this.resultPresenter?.updateAction(deltaSeconds);
    if (lifecycle !== 'result-removed') {
      this.failPresenter?.updateAction(deltaSeconds);
      this.scoreHudPresenter?.updateAction(deltaSeconds);
      this.applyScoreCommands(this.score.updateDisplayedScore());
      this.updatePresentation();
    }
  }

  onDisable(): void {
    this.node.off(CLASSIC_BLADE_BEGAN_EVENT, this.onBladeBegan, this);
    this.node.off(CLASSIC_BLADE_MOVED_EVENT, this.onBladeMoved, this);
    this.node.off(CLASSIC_BLADE_ENDED_EVENT, this.onBladeEnded, this);
    this.node.off(CLASSIC_PHYSICS_STEPPED_EVENT, this.onPhysicsStepped, this);
    this.node.off(CLASSIC_SESSION_COMMAND_EVENT, this.onSessionCommand, this);
  }

  onDestroy(): void {
    this.shuttingDown = true;
    this.unschedule(this.onSwishCooldownComplete);
    this.swishAudio.unlock();
    this.disposeRecoveredRuntime();
  }

  private disposeRecoveredRuntime(): void {
    const cleanupFailures: unknown[] = [];
    try {
      collectClassicCleanupFailure(
        cleanupFailures,
        () => this.disposeClassicModePresentation(),
      );
      collectClassicCleanupFailure(
        cleanupFailures,
        () => this.disposeResultPresentation(),
      );
      collectClassicCleanupFailure(
        cleanupFailures,
        () => this.disposeObjectiveAchievementPresentation(),
      );
      collectClassicCleanupFailure(
        cleanupFailures,
        () => this.audioPresenter?.stop(),
      );
    } finally {
      // Publish teardown ownership even when an individual presenter reports a cleanup
      // failure. No later caller may reuse a partially disposed catalog, audio graph,
      // preparation promise, or current-screen placement.
      this.audioPresenter = null;
      this.baseGameplayResources = null;
      this.objectivesManager = null;
      this.objectiveAchievementTargetRoot = null;
      this.resourceCatalog = null;
      this.recoveredRuntimePreparation = null;
      this.screenPlacement = null;
    }
    throwClassicCleanupFailures('Classic recovered runtime teardown', cleanupFailures);
  }

  /** Removes only the native Classic layer's owned runtime and presentation. */
  private disposeClassicModePresentation(): void {
    const classicModeRoot = this.classicModeRoot;
    if (
      classicModeRoot !== null
      && isValid(classicModeRoot, true)
      && classicModeRoot.parent !== null
    ) {
      this.detachOwnedScreen(classicModeRoot, 'Classic mode');
    }
    for (const node of [
      this.introGoodNode,
      this.introLuckNode,
      this.terminalGameNode,
      this.terminalOverNode,
    ]) {
      if (node !== null && isValid(node, true)) {
        Tween.stopAllByTarget(node);
        node.destroy();
      }
    }
    this.introGoodNode = null;
    this.introLuckNode = null;
    this.terminalGameNode = null;
    this.terminalOverNode = null;
    this.normalFree?.stop();
    this.normalFree = null;
    this.deferredControllers.clear();
    this.disposeCutHalfPresenters();
    this.cutHalfPresenters.clear();
    this.criticalCutHalfPresenters.clear();
    for (const presenter of this.criticalParticlePresenters) {
      presenter.dispose();
    }
    this.criticalParticlePresenters.clear();
    for (const presenter of [...this.comboItemPresenters]) {
      presenter.dispose();
    }
    this.comboItemPresenters.clear();
    this.bladePresenter?.dispose();
    this.bladePresenter = null;
    this.failPresenter?.dispose();
    this.failPresenter = null;
    this.scoreHudPresenter?.dispose();
    this.scoreHudPresenter = null;
    this.registry?.disposeAll();
    this.registry = null;
    for (const root of [
      this.scoreHudRoot,
      this.worldPresentationRoot,
      this.failPresentationRoot,
    ]) {
      if (root !== null && isValid(root, true)) {
        root.destroy();
      }
    }
    this.scoreHudRoot = null;
    this.worldPresentationRoot = null;
    this.failPresentationRoot = null;
    if (classicModeRoot !== null && isValid(classicModeRoot, true)) {
      classicModeRoot.destroy();
    }
    this.classicModeRoot = null;
  }

  private disposeResultPresentation(): void {
    const root = this.resultPresentationRoot;
    if (root !== null && isValid(root, true)) {
      this.detachOwnedScreen(root, 'Classic Result');
    }
    this.resultPresenter?.dispose();
    this.resultPresenter = null;
    if (root !== null && isValid(root, true)) {
      root.destroy();
    }
    this.resultPresentationRoot = null;
  }

  private disposeObjectiveAchievementPresentation(): void {
    const failures: unknown[] = [];
    for (const presenter of [...this.objectiveAchievementPresenters]) {
      collectClassicCleanupFailure(failures, () => presenter.dispose());
    }
    this.objectiveAchievementPresenters.clear();
    const target = this.objectiveAchievementTargetRoot;
    this.objectiveAchievementTargetRoot = null;
    if (target !== null && isValid(target, true)) {
      collectClassicCleanupFailure(failures, () => target.destroy());
    }
    throwClassicCleanupFailures(
      'Classic objective-achievement presentation teardown',
      failures,
    );
  }

  snapshot(): ClassicGameplaySnapshot {
    const score = this.score.snapshot();
    return Object.freeze({
      activeFruitCount: this.registry?.size ?? 0,
      deferredControllers: Object.freeze([...this.deferredControllers]),
      displayedScore: score.displayedScore,
      gameOver: this.gameOver,
      score: score.authoritativeScore,
      strikes: this.fail.count,
    });
  }

  private readonly onBladeMoved = (event: BladeMoveResult): void => {
    if (!this.isClassicGameplayActive()) {
      return;
    }
    const presenter = this.bladePresenter;
    if (presenter !== null) {
      // Creator loads the exact texture asynchronously. A gesture can begin before the
      // presenter attaches and move afterward; lazily restore only its ownership, never a
      // synthetic begin point, so that target loading cannot turn a valid touch into a crash.
      if (!presenter.isClaimed(event.segment.slot)) {
        presenter.begin(event.segment.slot);
      }
      presenter.move(event.segment.slot, event.segment.current);
    }
    if (this.gameOver) {
      return;
    }
    for (const instruction of this.swishAudio.request(
      event.shouldPlaySwish,
      this.effectsEnabled(),
    )) {
      if (instruction.type === 'play-swish-audio') {
        this.audioPresenter?.playOneShot(instruction.canonicalPath);
      } else {
        this.scheduleOnce(this.onSwishCooldownComplete, instruction.delaySeconds);
      }
    }
  };

  private readonly onBladeBegan = (event: ClassicBladeBeganEvent): void => {
    if (!this.isClassicGameplayActive()) {
      return;
    }
    const presenter = this.bladePresenter;
    if (presenter !== null && !presenter.isClaimed(event.slot)) {
      presenter.begin(event.slot);
    }
  };

  private readonly onBladeEnded = (event: ClassicBladeEndedEvent): void => {
    if (!this.isClassicGameplayActive()) {
      return;
    }
    // Native cancellation is unresolved. Creator cancellation follows the bounded cleanup
    // inference documented by the BasicBlade contract so a slot cannot retain ownership.
    const presenter = this.bladePresenter;
    if (presenter !== null && presenter.isClaimed(event.slot)) {
      presenter.end(event.slot);
    }
  };

  private readonly onSwishCooldownComplete = (): void => {
    this.swishAudio.unlock();
  };

  private readonly onSessionCommand = (command: ClassicSessionCommand): void => {
    this.emitCommands([command]);
    if (command.type === 'toss-controller') {
      if (command.controller === NORMAL_FREE_CONTROLLER) {
        if (command.action === 'start') {
          this.normalFree?.start();
        } else {
          this.normalFree?.stop();
        }
      } else {
        this.recordDeferredController(command.controller, command.action);
      }
    } else if (command.type === 'add-score') {
      this.score.addScore(command.value);
    } else if (command.type === 'show-game-over') {
      this.gameOver = true;
      this.disposeCutHalfPresenters();
      this.playRecoveredTerminalPresentation();
    } else if (command.type === 'stop-effects') {
      this.audioPresenter?.stop();
    } else if (command.type === 'construct-result') {
      this.beginResultConstruction();
    } else if (command.type === 'set-result-mode') {
      this.setPendingResultMode(command.mode);
    } else if (command.type === 'set-result-score') {
      this.setPendingResultScore(command.score);
    } else if (command.type === 'remove-classic') {
      this.requireConfiguredResultTransition();
      this.disposeClassicModePresentation();
    } else if (command.type === 'attach-result') {
      this.attachRecoveredResult(command.zOrder);
    }
    this.updatePresentation();
    this.emitSnapshot();
  };

  private readonly onPhysicsStepped = (event: ClassicPhysicsSteppedEvent): void => {
    const registry = this.registry;
    const sceneController = this.sceneController;
    if (registry === null || sceneController === null) {
      return;
    }
    const viewport = this.requireViewport();
    // A CutFruit created by this frame's blade query does not receive its first native
    // CutFruit::update until the following frame.
    const existingCutHalfPresenters = [...this.cutHalfPresenters];
    // @cocos/box2d 1.0.2 throws while raycasting an empty dynamic tree. This bounded
    // slice owns every fixture, so the registry is the public, deterministic guard.
    if (registry.size > 0) {
      registry.runRayQueryCutBatch(() => {
        for (const segment of event.bladeSegments) {
          const plan = buildBidirectionalRayPlan(
            { start: segment.previous, end: segment.current },
            viewport.width,
          );
          if (plan === null) {
            continue;
          }
          const forwardHits: CutQueryHit[] = sceneController
            .raycastAll(plan.forward.start, plan.forward.end)
            .map((result) => ({ target: registry.cuttableSnapshotForCollider(result.collider) }));
          const reverseHits: CutQueryHit[] = sceneController
            .raycastAll(plan.reverse.start, plan.reverse.end)
            .map((result) => ({ target: registry.cuttableSnapshotForCollider(result.collider) }));
          const commands = createCutDispatchCommands(plan, forwardHits, reverseHits);
          for (const command of commands) {
            this.emitCommand(command);
            if (command.type === 'combo-check') {
              this.combo.checkCombo(command.position);
            } else {
              registry.cut(command.targetId, command.segment);
            }
          }
        }
      });
      registry.evaluateBounds(viewport);
    }
    for (const presenter of existingCutHalfPresenters) {
      presenter.evaluateBounds(viewport);
      this.emitRecoveredCriticalParticles(presenter);
    }
    this.updatePresentation();
    this.emitSnapshot();
  };

  private onFruitCut(event: ClassicGeneratedFruitCutEvent): void {
    this.presentRecoveredCutHalves(event);
    if (this.effectsEnabled()) {
      for (const audioPath of getClassicFruitCutAudioSequence(event.fruitId, event.critical)) {
        this.audioPresenter?.playOneShot(audioPath);
      }
    }
    const commands = createClassicFruitCutCommands(
      event.worldPosition,
      event.fruitId,
      event.score,
    );
    for (const command of commands) {
      if (command.type === 'add-score') {
        this.score.addScore(command.value);
      }
    }
    this.emitCommands(commands);
    this.emitSnapshot();
  }

  private presentRecoveredCutHalves(event: ClassicGeneratedFruitCutEvent): void {
    const resources = this.resourceCatalog;
    const sceneController = this.sceneController;
    if (resources === null || sceneController === null) {
      throw new Error('Recovered cut-half presentation requires loaded resources and scene');
    }
    const visuals = resources.normalFruit(event.fruitId);
    const motion = createClassicCutHalfMotion({
      bottomHeightWorldUnits: visuals.cutBottom.dimensions.height,
      critical: event.critical,
      segment: event.segment,
      sourceAngleRadians: event.sourceAngleRadians,
      sourceAngularVelocityRadiansPerSecond: event.sourceAngularVelocityRadiansPerSecond,
      sourceBodyMass: event.sourceBodyMass,
      sourcePositionWorldUnits: event.worldPosition,
      topHeightWorldUnits: visuals.cutTop.dimensions.height,
      viewportWidthWorldUnits: this.requireViewport().width,
    });

    let presenter: ClassicCutHalfPresenter;
    presenter = ClassicCutHalfPresenter.create({
      fruitId: event.fruitId,
      motion,
      sourceEntityOccurrenceId: event.entityOccurrenceId,
      visuals,
    }, {
      callAfterStep: (mutation) => sceneController.callAfterPhysicsStep(mutation),
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

  private emitRecoveredCriticalParticles(cutHalves: ClassicCutHalfPresenter): void {
    const resources = this.resourceCatalog;
    if (resources === null) {
      throw new Error('Recovered critical particles require the loaded resource catalog');
    }
    const critical = this.criticalCutHalfPresenters.has(cutHalves);
    for (const half of cutHalves.halves) {
      if (half.disposalQueued) {
        continue;
      }
      for (const command of createClassicCriticalParticleUpdateCommands(
        critical,
        this.random,
      )) {
        const position = half.node.worldPosition;
        let presenter: ClassicCriticalParticlePresenter;
        presenter = ClassicCriticalParticlePresenter.create({
          command,
          positionWorldUnits: { x: position.x, y: position.y },
          resource: resources.criticalParticles[command.resourceIndex - 1],
        }, {
          onDisposed: () => this.criticalParticlePresenters.delete(presenter),
        });
        presenter.attach(this.requireWorldPresentationRoot());
        this.criticalParticlePresenters.add(presenter);
      }
    }
  }

  private disposeCutHalfPresenters(): void {
    for (const presenter of this.cutHalfPresenters) {
      presenter.disposeAll();
    }
  }

  private onFruitMiss(event: ClassicGeneratedFruitMissEvent): void {
    this.applyFailCommands(this.fail.registerMiss(event.worldPosition));
  }

  private applyComboCommands(commands: readonly ComboCommand[]): void {
    if (commands.length === 0) {
      return;
    }
    this.combo.assertPendingUpdate(commands);
    let pendingPresenter: ComboItemPresenter | null = null;
    applyComboCommandBatch(commands, {
      apply: (command) => {
        switch (command.type) {
          case 'process-objective':
            // Classic's objective bridge predates this Creator slice; retain the recovered
            // command explicitly so the shared transaction never treats it as an unknown type.
            return;
          case 'create-combo-item': {
            if (pendingPresenter !== null) {
              throw new Error('Classic combo batch created more than one pending ComboItem');
            }
            let presenter: ComboItemPresenter;
            presenter = ComboItemPresenter.create({
              count: command.count,
              fontResource: this.sharedResourceCatalog.comboFont,
              position: command.position,
              viewportWidth: this.requireViewport().width,
            }, {
              onDisposed: () => this.comboItemPresenters.delete(presenter),
            });
            pendingPresenter = presenter;
            return;
          }
          case 'add-score':
            this.score.addScore(command.value);
            return;
          case 'attach-combo-item': {
            if (command.zOrder !== 1 || pendingPresenter === null) {
              throw new Error(
                'Classic combo attachment requires one pending z-order-1 ComboItem',
              );
            }
            const presenter = pendingPresenter;
            presenter.attach(this.requireWorldPresentationRoot());
            this.comboItemPresenters.add(presenter);
            pendingPresenter = null;
            return;
          }
          case 'play-combo-sound':
            this.audioPresenter?.playOneShot(getClassicComboAudioPath(command.soundIndex));
            return;
          case 'reset-combo':
            this.combo.commitPendingUpdate(commands);
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
    this.emitSnapshot();
  }

  private applyFailCommands(commands: readonly FailCommand[]): void {
    for (const command of commands) {
      if (command.type === 'queue-fail-indicator') {
        const presenter = this.failPresenter;
        if (presenter === null) {
          throw new Error('Recovered fail presentation requires loaded resources');
        }
        presenter.presentMiss(command.strike, command.missPosition);
      } else if (command.type === 'game-over-callback') {
        this.sceneController?.gameOverFromMiss();
      }
    }
    this.emitCommands(commands);
    this.updatePresentation();
    this.emitSnapshot();
  }

  private applyScoreCommands(commands: readonly ScoreCommand[]): void {
    for (const command of commands) {
      if (command.type === 'start-double-score-presentation') {
        this.requireScoreHudPresenter().startDoubleScorePanelIntro(
          command.introDurationSeconds,
          command.activeDelaySeconds,
        );
      } else if (command.type === 'finish-double-score-presentation') {
        this.requireScoreHudPresenter().startDoubleScorePanelExit(
          command.exitDurationSeconds,
        );
      } else if (command.type === 'start-displayed-score-scale-up') {
        const presenter = this.requireScoreHudPresenter();
        presenter.startScoreIconScaleUp(command.durationSeconds, command.targetScale);
      } else if (command.type === 'start-displayed-score-scale-down') {
        const presenter = this.requireScoreHudPresenter();
        presenter.startScoreIconScaleDown(command.durationSeconds, command.targetScale);
      }
    }
    this.emitCommands(commands);
  }

  private readonly onDisplayedScoreScaleUpComplete = (): void => {
    this.applyScoreCommands(this.score.completeDisplayedScoreScaleUp());
    this.updatePresentation();
  };

  private readonly onDisplayedScoreScaleDownComplete = (): void => {
    this.score.completeDisplayedScoreScaleDown();
  };

  private readonly onDoubleScoreActiveDelayComplete = (): void => {
    this.applyScoreCommands(this.score.completeDoubleScoreDelay());
    this.updatePresentation();
    this.emitSnapshot();
  };

  private recordDeferredController(
    controller: ClassicTossControllerId,
    action: 'start' | 'stop',
  ): void {
    if (action === 'start') {
      this.deferredControllers.add(controller);
    } else {
      this.deferredControllers.delete(controller);
    }
    const payload: ClassicDeferredTossControllerEvent = Object.freeze({
      action,
      controller,
      reason: 'bounded-normal-fruit-slice',
    });
    this.node.emit(CLASSIC_DEFERRED_TOSS_CONTROLLER_EVENT, payload);
  }

  private requireViewport(): Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> {
    const visibleRect = this.sceneController?.resolutionSnapshot()?.visibleRect;
    if (visibleRect === undefined) {
      throw new Error('Classic resolution must be available before gameplay setup');
    }
    return visibleRect;
  }

  private readonly effectsEnabled = (): boolean => (
    this.settingsRuntime?.state.snapshot.effectsEnabled ?? true
  );

  private createRecoveredPresentation(
    parent: Node,
    viewport: Readonly<{ width: number; height: number }>,
    resources: ClassicSliceResourceCatalog,
  ): void {
    const scoreHudRoot = createRecoveredPresenterRoot(parent, 'ClassicScoreHudRoot');
    this.scoreHudRoot = scoreHudRoot;
    this.scoreHudPresenter = ClassicScoreHudPresenter.create({
      bestScoreCupResource: resources.presentation.bestScoreCup,
      doubleScorePanelResource: resources.presentation.doubleScorePanel,
      fontResource: resources.scoreFont,
      initialBestScore: this.score.bestScore,
      scoreIconResource: resources.presentation.scoreIcon,
      viewport,
    }, {
      onDoubleScoreActiveDelayComplete: this.onDoubleScoreActiveDelayComplete,
      onScoreIconScaleDownComplete: this.onDisplayedScoreScaleDownComplete,
      onScoreIconScaleUpComplete: this.onDisplayedScoreScaleUpComplete,
    });
    this.scoreHudPresenter.attach(scoreHudRoot);
    this.worldPresentationRoot = createRecoveredPresenterRoot(
      parent,
      'ClassicWorldPresentationRoot',
    );
    this.bladePresenter = ClassicBladePresenter.create({
      assetTree: resources.assetTree,
      resource: resources.defaultBlade,
      selectedBladeId: 0,
      viewportWidth: viewport.width,
    });
    this.bladePresenter.attach(this.worldPresentationRoot);
    const failPresentationRoot = createRecoveredPresenterRoot(
      parent,
      'ClassicFailPresentationRoot',
    );
    this.failPresentationRoot = failPresentationRoot;
    this.failPresenter = ClassicFailPresenter.create({
      filledResource: resources.presentation.failFilled,
      normalResource: resources.presentation.failNormal,
      viewport,
    }, {
      onIndicatorComplete: () => {
        this.applyFailCommands(this.fail.completeIndicator());
      },
    });
    this.failPresenter.attach(failPresentationRoot);
  }

  private playRecoveredIntro(
    parent: Node,
    viewport: Readonly<{ width: number; height: number }>,
    resources: ClassicSliceResourceCatalog,
  ): void {
    const goodY = viewport.height * 0.025;
    const luckY = -viewport.height * 0.025;
    const outside = viewport.width * 0.75;
    const good = createRecoveredSpriteNode(
      parent,
      'ClassicRecoveredIntroGood',
      resources.presentation.introGood,
    );
    this.introGoodNode = good;
    const luck = createRecoveredSpriteNode(
      parent,
      'ClassicRecoveredIntroLuck',
      resources.presentation.introLuck,
    );
    this.introLuckNode = luck;
    good.setPosition(-outside, goodY, 0);
    luck.setPosition(outside, luckY, 0);

    tween(good)
      .to(0.5, { position: new Vec3(0, goodY, 0) })
      .delay(0.5)
      .to(0.5, { position: new Vec3(outside, goodY, 0) })
      .call(() => {
        good.destroy();
        this.introGoodNode = null;
      })
      .start();
    tween(luck)
      .to(0.5, { position: new Vec3(0, luckY, 0) })
      .delay(0.5)
      .to(0.5, { position: new Vec3(-outside, luckY, 0) })
      .call(() => {
        luck.destroy();
        this.introLuckNode = null;
        if (this.sceneController?.sessionSnapshot().lifecycle === 'intro') {
          this.sceneController.completeIntro();
        }
      })
      .start();
  }

  private playRecoveredTerminalPresentation(): void {
    const resources = this.resourceCatalog;
    const viewport = this.requireViewport();
    if (resources === null || this.terminalGameNode !== null || this.terminalOverNode !== null) {
      return;
    }
    const parent = this.requireClassicModeRoot();
    const game = createRecoveredSpriteNode(
      parent,
      'ClassicRecoveredTerminalGame',
      resources.presentation.terminalGame,
    );
    const over = createRecoveredSpriteNode(
      parent,
      'ClassicRecoveredTerminalOver',
      resources.presentation.terminalOver,
    );
    this.terminalGameNode = game;
    this.terminalOverNode = over;
    game.setPosition(0, viewport.height / 2 + resources.presentation.terminalGame.dimensions.height / 2, 0);
    over.setPosition(0, -viewport.height / 2 - resources.presentation.terminalOver.dimensions.height / 2, 0);

    tween(game)
      .to(0.75, { position: new Vec3(0, viewport.height * 0.075, 0) })
      .delay(1)
      .to(0.75, { position: new Vec3(-viewport.width, viewport.height * 0.075, 0) })
      .call(() => {
        this.sceneController?.displayScoreComplete(this.score.authoritativeScore);
      })
      .start();
    tween(over)
      .to(0.75, { position: new Vec3(0, -viewport.height * 0.075, 0) })
      .delay(1)
      .to(0.75, { position: new Vec3(viewport.width, -viewport.height * 0.075, 0) })
      .start();
  }

  private beginResultConstruction(): void {
    if (this.resultConstructionRequested || this.resultPresenter !== null) {
      throw new Error('Classic result construction can begin only once');
    }
    if (this.resourceCatalog === null) {
      throw new Error('Classic result construction requires loaded resources');
    }
    this.resultConstructionRequested = true;
    this.resultMode = null;
    this.resultScore = null;
  }

  private setPendingResultMode(mode: 0): void {
    if (!this.resultConstructionRequested || this.resultMode !== null) {
      throw new Error('Classic result mode requires one pending construction');
    }
    this.resultMode = mode;
  }

  private setPendingResultScore(score: number): void {
    if (!this.resultConstructionRequested || this.resultScore !== null) {
      throw new Error('Classic result score requires one pending construction');
    }
    if (!Number.isSafeInteger(score)) {
      throw new RangeError('Classic result score must be a safe integer');
    }
    this.resultScore = score;
  }

  private requireConfiguredResultTransition(): Readonly<{ mode: 0; score: number }> {
    if (
      !this.resultConstructionRequested
      || this.resultMode !== 0
      || this.resultScore === null
    ) {
      throw new Error('Classic result must be constructed, mode-set, and score-set first');
    }
    return Object.freeze({ mode: this.resultMode, score: this.resultScore });
  }

  private attachRecoveredResult(zOrder: 1): void {
    const configured = this.requireConfiguredResultTransition();
    const resources = this.resourceCatalog;
    if (resources === null) {
      throw new Error('Classic result attachment requires loaded resources');
    }
    if (zOrder !== 1 || this.resultPresenter !== null || this.resultPresentationRoot !== null) {
      throw new Error('Classic result must attach once at recovered z-order 1');
    }

    const settings = this.requireSettingsRuntime();
    const ranking = settings.state.recordClassicResultScore(configured.score);
    const presenter = ClassicResultPresenter.create({
      completedRunScore: configured.score,
      fonts: resources.resultFonts,
      panelValues: classicLeaderboardPanelValues(ranking.leaderboard),
      random: this.random,
      resources: resources.result,
      totalCoins: settings.state.snapshot.totalCoins,
      viewport: this.requireViewport(),
    }, {
      onMenu: this.onResultMenu,
      onRankPresentationBoundary: () => {
        if (ranking.achievedRank !== null && this.effectsEnabled()) {
          this.audioPresenter?.playOneShot(
            getClassicResultRankAudioPath(ranking.achievedRank),
          );
        }
      },
      onRetry: this.onResultRetry,
      onTotalCoinsEntranceComplete: this.onResultTotalCoinsEntranceComplete,
    });
    const root = createDetachedScreenRoot(
      'ClassicResultPresentationRoot',
      this.node,
    );
    try {
      this.requireScreenPlacement().attachCurrentScreen(root);
      presenter.attach(root);
    } catch (error) {
      if (root.parent !== null) {
        this.detachOwnedScreen(root, 'Classic Result');
      }
      presenter.dispose();
      root.destroy();
      throw error;
    }
    this.resultPresentationRoot = root;
    this.resultPresenter = presenter;
    this.dispatchRecoveredResultObjectiveTail(configured.mode, configured.score);
  }

  private dispatchRecoveredResultObjectiveTail(mode: 0, score: number): void {
    if (this.resultObjectiveTailAttempted) {
      throw new Error('Classic Result objective tail can be attempted only once per run');
    }
    // Result ownership and leaderboard persistence are already committed. Publish the latch
    // before the observer/storage callback so a partial failure can never replay this native
    // final operation against the next objective.
    this.resultObjectiveTailAttempted = true;
    const failures: unknown[] = [];
    collectClassicCleanupFailure(failures, () => {
      const objective = createRecoveredResultObjectiveCommand(mode, score);
      this.requireObjectivesManager().processGameEvent(
        objective.selector,
        objective.completedScore,
      );
    });
    if (failures.length > 0) {
      const details = failures
        .map((error) => error instanceof Error ? error.message : String(error))
        .join('; ');
      console.error(new Error(
        `Classic Result committed with objective-tail failure: ${details}`,
      ));
    }
  }

  private readonly onResultRetry = (): void => {
    try {
      this.restartRecoveredClassicRunSameParent();
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      this.reportFailedResultRetry(failure.message);
      console.error(failure);
    }
  };

  private restartRecoveredClassicRunSameParent(): void {
    const retryContext = this.createRetryRestartContext();
    const retryState: ClassicRetryRestartState = {
      capturedResultRoot: null,
      resultCleanupCommitted: false,
      resultDetached: false,
    };
    const commands = createClassicResultNavigationCommands({
      effectsEnabled: this.effectsEnabled(),
      mode: retryContext.mode,
      route: 'retry',
    });

    try {
      for (const command of commands) {
        this.applyRetryNavigationCommand(command, retryContext, retryState);
      }
    } catch (error) {
      this.rollbackFailedRetry(retryContext, retryState);
      throw error;
    }
    this.updatePresentation();
    this.emitSnapshot();
  }

  private createRetryRestartContext(): ClassicRetryRestartContext {
    const configured = this.requireConfiguredResultTransition();
    const resultRoot = this.requireAttachedResultPresentationRoot();
    const resources = this.resourceCatalog;
    const sceneController = this.sceneController;
    const audioPresenter = this.audioPresenter;
    if (resources === null || sceneController === null || audioPresenter === null) {
      throw new Error('Classic Retry requires loaded scene, resource, and audio owners');
    }
    if (this.classicModeRoot !== null || this.registry !== null || this.normalFree !== null) {
      throw new Error('Classic Retry requires the previous Classic layer to be removed');
    }
    this.requireSettingsRuntime();
    return {
      audioPresenter,
      mode: configured.mode,
      previousRunState: Object.freeze({
        combo: this.combo,
        deferredControllers: Object.freeze([...this.deferredControllers]),
        fail: this.fail,
        gameOver: this.gameOver,
        planner: this.planner,
        score: this.score,
        swishAudio: this.swishAudio,
      }),
      resources,
      resultRoot,
      score: configured.score,
      sceneController,
      screenPlacement: this.requireScreenPlacement(),
      viewport: this.requireViewport(),
    };
  }

  private applyRetryNavigationCommand(
    command: ClassicResultNavigationCommand,
    retryContext: ClassicRetryRestartContext,
    retryState: ClassicRetryRestartState,
  ): void {
    switch (command.type) {
      case 'request-menu-button-audio':
        retryContext.audioPresenter.playOneShot(command.canonicalPath);
        return;
      case 'capture-result-parent':
        if (retryContext.screenPlacement.currentScreen !== retryContext.resultRoot) {
          throw new Error('Classic Retry lost Result before capturing current-screen ownership');
        }
        retryState.capturedResultRoot = retryContext.resultRoot;
        return;
      case 'remove-result':
        this.removeResultForRetry(command, retryContext, retryState);
        return;
      case 'construct-classic':
        this.constructClassicForRetry(retryContext);
        return;
      case 'attach-classic-to-captured-parent':
        this.attachClassicForRetry(command, retryContext, retryState);
        return;
      default:
        throwUnexpectedRetryCommand(command);
    }
  }

  private removeResultForRetry(
    command: Extract<ClassicResultNavigationCommand, { type: 'remove-result' }>,
    retryContext: ClassicRetryRestartContext,
    retryState: ClassicRetryRestartState,
  ): void {
    if (
      retryState.capturedResultRoot !== retryContext.resultRoot
      || command.cleanup !== true
      || retryContext.resultRoot !== this.resultPresentationRoot
      || this.resultPresenter === null
      || retryContext.screenPlacement.currentScreen !== retryContext.resultRoot
    ) {
      throw new Error('Classic Retry must capture the Result screen before cleanup');
    }
    // Removal is synchronous; Creator cleanup remains a same-stack commit token until the
    // fresh layer attaches, allowing an exceptional constructor/physics failure to restore
    // the already-presented Result without replaying rank or coin side effects.
    const detached = retryContext.screenPlacement.detachCurrentScreen(
      retryContext.resultRoot,
    );
    if (detached !== retryContext.resultRoot) {
      throw new Error('Classic Retry detached an unexpected current screen');
    }
    retryState.resultDetached = true;
  }

  private constructClassicForRetry(retryContext: ClassicRetryRestartContext): void {
    this.resetRecoveredClassicRunState();
    this.constructRecoveredClassicMode(
      retryContext.viewport,
      retryContext.resources,
      retryContext.sceneController,
      retryContext.audioPresenter,
    );
  }

  private attachClassicForRetry(
    command: Extract<ClassicResultNavigationCommand, { type: 'attach-classic-to-captured-parent' }>,
    retryContext: ClassicRetryRestartContext,
    retryState: ClassicRetryRestartState,
  ): void {
    if (
      retryState.capturedResultRoot !== retryContext.resultRoot
      || retryContext.screenPlacement.currentScreen !== null
    ) {
      throw new Error('Classic Retry lost the captured Result screen boundary');
    }
    let restartPrepared = false;
    let resultCleanup: ClassicRetryResultCleanupToken;
    try {
      // Fresh session/physics state belongs to construction. Prepare it before CHILD_ADDED,
      // then make the native parent attachment the transaction's final visible boundary.
      retryContext.sceneController.restartClassicLayer();
      restartPrepared = true;
      this.attachRecoveredClassicMode(command.zOrder);
      resultCleanup = this.assertRemovedResultReadyForCleanup(retryContext, retryState);
      retryContext.sceneController.commitClassicLayerRestart();
      restartPrepared = false;
    } catch (error) {
      if (restartPrepared) {
        retryContext.sceneController.rollbackClassicLayerRestart();
      }
      this.disposeClassicModePresentation();
      throw error;
    }
    // Cleanup runs beyond the reversible boundary. Even an unexpected reporting failure must
    // not re-enter the catch above and destroy the newly committed Classic layer.
    this.commitRemovedResultForRetry(retryState, resultCleanup);
  }

  private assertRemovedResultReadyForCleanup(
    retryContext: ClassicRetryRestartContext,
    retryState: ClassicRetryRestartState,
  ): ClassicRetryResultCleanupToken {
    if (
      !retryState.resultDetached
      || retryState.resultCleanupCommitted
      || retryContext.resultRoot.parent !== null
      || retryContext.resultRoot !== this.resultPresentationRoot
      || retryContext.screenPlacement.currentScreen !== this.classicModeRoot
      || this.resultPresenter === null
    ) {
      throw new Error('Classic Retry Result cleanup can commit only after synchronous removal');
    }
    return Object.freeze({
      presenter: this.resultPresenter,
      root: retryContext.resultRoot,
    });
  }

  private commitRemovedResultForRetry(
    retryState: ClassicRetryRestartState,
    cleanup: ClassicRetryResultCleanupToken,
  ): void {
    // The replacement is already visible and scene/physics state is committed. Publish the
    // logical Result disposal first, then make engine cleanup best-effort: a presenter/tween
    // cleanup exception cannot roll the scene back into a mixed fresh-session/old-run state.
    this.resultPresentationRoot = null;
    this.resultPresenter = null;
    retryState.resultCleanupCommitted = true;
    retryState.resultDetached = false;

    const cleanupFailures: unknown[] = [];
    try {
      cleanup.presenter.dispose();
    } catch (error) {
      cleanupFailures.push(error);
    }
    try {
      if (isValid(cleanup.root, true)) {
        cleanup.root.destroy();
      }
    } catch (error) {
      cleanupFailures.push(error);
    }
    if (cleanupFailures.length > 0) {
      const details = cleanupFailures
        .map((error) => error instanceof Error ? error.message : String(error))
        .join('; ');
      console.error(new Error(
        `Classic Retry committed with Result cleanup failures: ${details}`,
      ));
    }
  }

  private rollbackFailedRetry(
    retryContext: ClassicRetryRestartContext,
    retryState: ClassicRetryRestartState,
  ): void {
    if (retryState.resultCleanupCommitted || !retryState.resultDetached) {
      return;
    }
    if (
      retryState.capturedResultRoot !== retryContext.resultRoot
      || retryContext.resultRoot !== this.resultPresentationRoot
      || !isValid(retryContext.resultRoot, true)
      || retryContext.resultRoot.parent !== null
      || this.resultPresenter === null
    ) {
      throw new Error('Classic Retry cannot restore its detached Result after failure');
    }

    this.disposeClassicModePresentation();
    this.planner = retryContext.previousRunState.planner;
    this.swishAudio = retryContext.previousRunState.swishAudio;
    this.combo = retryContext.previousRunState.combo;
    this.fail = retryContext.previousRunState.fail;
    this.score = retryContext.previousRunState.score;
    this.deferredControllers.clear();
    for (const controller of retryContext.previousRunState.deferredControllers) {
      this.deferredControllers.add(controller);
    }
    this.resultConstructionRequested = true;
    this.resultMode = retryContext.mode;
    this.resultScore = retryContext.score;
    this.gameOver = retryContext.previousRunState.gameOver;
    if (retryContext.screenPlacement.currentScreen !== null) {
      throw new Error('Classic Retry cannot restore Result over another current screen');
    }
    retryContext.screenPlacement.attachCurrentScreen(retryContext.resultRoot);
    this.resultPresenter.rearmNavigationAfterFailure('retry');
    retryState.resultDetached = false;
    this.emitSnapshot();
  }

  private resetRecoveredClassicRunState(): void {
    this.unschedule(this.onSwishCooldownComplete);
    this.planner = new ClassicSpawnPlanner({
      random: this.random,
      sampleKinematics: sampleSpawnKinematics,
    });
    this.swishAudio = new ClassicSwishAudioGate(this.random);
    this.combo = new ComboService(this.random);
    this.fail = new FailService();
    this.score = new ScoreService(
      0,
      0,
      this.requireSettingsRuntime().state.snapshot.leaderboard.first,
    );
    this.deferredControllers.clear();
    this.resultConstructionRequested = false;
    this.resultObjectiveTailAttempted = false;
    this.resultMode = null;
    this.resultScore = null;
    this.gameOver = false;
  }

  private reportFailedResultRetry(message: string): void {
    // Context/audio validation can fail before the transactional removal token exists.
    if (this.resultPresenter?.state.navigation === 'retry') {
      this.resultPresenter.rearmNavigationAfterFailure('retry');
    }
    const payload: ClassicResultRetryFailedEvent = Object.freeze({
      message,
      reason: 'restart-error',
    });
    this.node.emit(CLASSIC_RESULT_RETRY_FAILED_EVENT, payload);
  }

  private readonly onResultMenu = (): void => {
    if (this.effectsEnabled()) {
      this.audioPresenter?.playOneShot(CLASSIC_MENU_BUTTON_AUDIO_PATH);
    }
    const { score } = this.requireConfiguredResultTransition();
    const resultRoot = this.requireAttachedResultPresentationRoot();
    const presenter = this.resultPresenter;
    if (presenter === null) {
      throw new Error('Classic Result menu requires its attached presenter');
    }
    const transaction: ClassicResultMenuTransactionState = {
      presenter,
      root: resultRoot,
      screenPlacement: this.requireScreenPlacement(),
      status: 'pending',
    };
    const payload: ClassicResultMenuRequestedEvent = Object.freeze({
      completedRunScore: score,
      resultRoot,
      commit: (previousRoot: Node) => {
        this.commitResultMenuTransition(transaction, previousRoot);
      },
      rollback: () => {
        this.rollbackResultMenuTransition(transaction);
      },
    });
    this.node.emit(CLASSIC_RESULT_MENU_REQUESTED_EVENT, payload);
  };

  private commitResultMenuTransition(
    transaction: ClassicResultMenuTransactionState,
    previousRoot: Node,
  ): void {
    if (previousRoot !== transaction.root) {
      throw new Error('Classic Result menu commit received an unexpected previous screen');
    }
    if (transaction.status === 'committed') {
      return;
    }
    if (transaction.status === 'rolled-back') {
      throw new Error('Rolled-back Classic Result menu transition cannot commit');
    }
    if (
      this.resultPresentationRoot !== transaction.root
      || this.resultPresenter !== transaction.presenter
      || transaction.root.parent !== null
      || transaction.screenPlacement.currentScreen === null
      || transaction.screenPlacement.currentScreen === transaction.root
    ) {
      throw new Error('Classic Result menu commit requires a successful screen replacement');
    }

    // Publish logical ownership before best-effort cleanup. A disposal failure must not tear
    // down the fresh Main Menu now owned by the app-shell.
    this.resultPresentationRoot = null;
    this.resultPresenter = null;
    transaction.status = 'committed';

    const cleanupFailures: unknown[] = [];
    try {
      transaction.presenter.dispose();
    } catch (error) {
      cleanupFailures.push(error);
    }
    try {
      if (isValid(transaction.root, true)) {
        transaction.root.destroy();
      }
    } catch (error) {
      cleanupFailures.push(error);
    }
    if (cleanupFailures.length > 0) {
      const details = cleanupFailures
        .map((error) => error instanceof Error ? error.message : String(error))
        .join('; ');
      console.error(new Error(
        `Classic Result menu committed with cleanup failures: ${details}`,
      ));
    }
  }

  private rollbackResultMenuTransition(
    transaction: ClassicResultMenuTransactionState,
  ): void {
    if (transaction.status === 'rolled-back') {
      return;
    }
    if (transaction.status === 'committed') {
      throw new Error('Committed Classic Result menu transition cannot roll back');
    }
    if (
      this.resultPresentationRoot !== transaction.root
      || this.resultPresenter !== transaction.presenter
      || !isValid(transaction.root, true)
    ) {
      throw new Error('Classic Result menu rollback lost the original Result identity');
    }

    const currentScreen = transaction.screenPlacement.currentScreen;
    if (currentScreen !== transaction.root) {
      if (transaction.root.parent !== null) {
        throw new Error('Classic Result menu rollback found Result under an unknown owner');
      }
      if (currentScreen === null) {
        transaction.screenPlacement.attachCurrentScreen(transaction.root);
      } else {
        transaction.screenPlacement.replaceCurrentScreen(transaction.root);
      }
    }
    if (
      transaction.screenPlacement.currentScreen !== transaction.root
      || !transaction.presenter.rearmNavigationAfterFailure('menu')
    ) {
      throw new Error('Classic Result menu rollback could not restore and rearm Result');
    }
    transaction.status = 'rolled-back';
    this.emitSnapshot();
  }

  private readonly onResultTotalCoinsEntranceComplete = (): number => {
    const { score } = this.requireConfiguredResultTransition();
    const { bonusCoins, totalCoins } = this.requireSettingsRuntime()
      .state.awardClassicResultCoins(score);
    const payload: ClassicResultRewardReadyEvent = Object.freeze({
      bonusCoins,
      completedRunScore: score,
      totalCoins,
    });
    // The presenter creates effect/coin/badge before this mutation and the bonus label after it.
    this.node.emit(CLASSIC_RESULT_REWARD_READY_EVENT, payload);
    return bonusCoins;
  };

  private readonly onObjectiveAchievement = (
    event: ObjectiveAchievementPopupEvent,
  ): void => {
    if (this.effectsEnabled()) {
      this.sharedAudioPresenter.playOneShot(CLASSIC_OBJECTIVE_CHEER_AUDIO_PATH);
    }
    const presenter = ObjectiveAchievementPresenter.create({
      event,
      random: this.random,
      resources: this.requireBaseGameplayResources(),
      viewport: this.requireViewport(),
    });
    try {
      presenter.attach(this.requireObjectiveAchievementTargetRoot());
      this.objectiveAchievementPresenters.add(presenter);
    } catch (error) {
      const failures: unknown[] = [];
      collectClassicCleanupFailure(failures, () => presenter.dispose());
      if (this.objectiveAchievementPresenters.size === 0) {
        const target = this.objectiveAchievementTargetRoot;
        this.objectiveAchievementTargetRoot = null;
        if (target !== null && isValid(target, true)) {
          collectClassicCleanupFailure(failures, () => target.destroy());
        }
      }
      if (failures.length > 0) {
        const details = failures
          .map((failure) => failure instanceof Error ? failure.message : String(failure))
          .join('; ');
        throw new Error(
          `Classic objective-achievement rollback failed after ${String(error)}: ${details}`,
        );
      }
      throw error;
    }
  };

  private requireBaseGameplayResources(): LoadedBaseGameplayResources {
    if (this.baseGameplayResources === null) {
      throw new Error(
        'Classic base-gameplay resources are unavailable before preparation',
      );
    }
    return this.baseGameplayResources;
  }

  private requireObjectivesManager(): ObjectivesManagerState {
    if (this.objectivesManager === null) {
      throw new Error('Classic objectives manager is unavailable before preparation');
    }
    return this.objectivesManager;
  }

  private requireObjectiveAchievementTargetRoot(): Node {
    const retained = this.objectiveAchievementTargetRoot;
    if (retained !== null && isValid(retained, true)) {
      return retained;
    }
    const target = new Node('ClassicObjectiveAchievementTargetRoot');
    target.layer = this.node.layer;
    target.setParent(this.node);
    this.objectiveAchievementTargetRoot = target;
    return target;
  }

  private requireSettingsRuntime(): ClassicSettingsRuntime {
    const runtime = this.settingsRuntime;
    if (runtime === null) {
      throw new Error('Classic settings must load before result behavior');
    }
    return runtime;
  }

  private requireScreenPlacement(): ClassicScreenPlacementPort {
    const screenPlacement = this.screenPlacement;
    if (screenPlacement === null) {
      throw new Error('Classic screen placement must be available for runtime ownership');
    }
    return screenPlacement;
  }

  private detachOwnedScreen(root: Node, label: string): void {
    const screenPlacement = this.screenPlacement;
    if (root.parent === null) {
      if (screenPlacement?.currentScreen === root) {
        throw new Error(`${label} is current but has no Creator parent`);
      }
      return;
    }
    if (screenPlacement === null || screenPlacement.currentScreen !== root) {
      throw new Error(`${label} is attached outside Classic current-screen ownership`);
    }
    const detached = screenPlacement.detachCurrentScreen(root);
    if (detached !== root || root.parent !== null) {
      throw new Error(`${label} current-screen detachment lost node identity`);
    }
  }

  private updatePresentation(): void {
    this.scoreHudPresenter?.setDisplayedScore(this.score.displayedScore);
    this.scoreHudPresenter?.setBestScore(this.score.bestScore, this.score.bestScoreIsNew);
    this.scoreHudPresenter?.setPendingDoubleScore(this.score.pendingDoubleScore);
  }

  private requireScoreHudPresenter(): ClassicScoreHudPresenter {
    const presenter = this.scoreHudPresenter;
    if (presenter === null) {
      throw new Error('Recovered score presentation requires loaded resources');
    }
    return presenter;
  }

  private requireAttachedResultPresentationRoot(): Node {
    const resultRoot = this.resultPresentationRoot;
    if (
      resultRoot === null
      || !isValid(resultRoot, true)
      || resultRoot.parent === null
      || this.screenPlacement?.currentScreen !== resultRoot
      || !resultRoot.activeInHierarchy
    ) {
      throw new Error('Classic operation requires Result as the active current screen');
    }
    return resultRoot;
  }

  private requireClassicModeRoot(): Node {
    const root = this.classicModeRoot;
    if (
      root === null
      || !isValid(root, true)
      || root.parent === null
      || this.screenPlacement?.currentScreen !== root
      || !root.activeInHierarchy
    ) {
      throw new Error('Recovered Classic presentation requires its active mode root');
    }
    return root;
  }

  private isClassicGameplayActive(): boolean {
    const root = this.classicModeRoot;
    return (
      root !== null
      && isValid(root, true)
      && root.parent !== null
      && this.screenPlacement?.currentScreen === root
      && root.activeInHierarchy
    );
  }

  private requireWorldPresentationRoot(): Node {
    const root = this.worldPresentationRoot;
    if (root === null || !isValid(root, true) || !root.activeInHierarchy) {
      throw new Error('Classic world presentation requires its active recovered root');
    }
    return root;
  }

  private emitCommands(commands: readonly unknown[]): void {
    for (const command of commands) {
      this.emitCommand(command);
    }
  }

  private emitCommand(command: unknown): void {
    this.node.emit(CLASSIC_GAMEPLAY_COMMAND_EVENT, command);
  }

  private emitSnapshot(): void {
    if (!this.shuttingDown) {
      this.node.emit(CLASSIC_GAMEPLAY_SNAPSHOT_EVENT, this.snapshot());
    }
  }
}

function createRecoveredSpriteNode(
  parent: Node,
  name: string,
  resource: LoadedClassicRasterResource,
): Node {
  const node = new Node(name);
  node.layer = parent.layer;
  const transform = node.addComponent(UITransform);
  transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
  transform.setAnchorPoint(0.5, 0.5);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  parent.addChild(node);
  return node;
}

function createRecoveredPresenterRoot(parent: Node, name: string): Node {
  const node = new Node(name);
  node.layer = parent.layer;
  node.setParent(parent);
  return node;
}

function collectClassicCleanupFailure(
  failures: unknown[],
  cleanup: () => void,
): void {
  try {
    cleanup();
  } catch (error) {
    failures.push(error);
  }
}

function throwClassicCleanupFailures(
  operation: string,
  failures: readonly unknown[],
): void {
  if (failures.length === 0) {
    return;
  }
  const details = failures
    .map((error) => error instanceof Error ? error.message : String(error))
    .join('; ');
  throw new Error(`${operation} failed: ${details}`);
}

function assertScreenPlacementPort(
  screenPlacement: ClassicScreenPlacementPort,
): void {
  if (
    screenPlacement === null
    || typeof screenPlacement !== 'object'
    || typeof screenPlacement.attachCurrentScreen !== 'function'
    || typeof screenPlacement.detachCurrentScreen !== 'function'
    || typeof screenPlacement.replaceCurrentScreen !== 'function'
  ) {
    throw new TypeError('Classic screen placement must implement the current-screen port');
  }
}

function requireSpawnCommands(
  commands: readonly ClassicTossStrategyCommand[],
): readonly ClassicSpawnCommand[] {
  if (!commands.every(isSpawnCommand)) {
    throw new Error('Normal-free controller emitted a non-spawn command');
  }
  return commands;
}

function isSpawnCommand(
  command: ClassicTossStrategyCommand,
): command is ClassicSpawnCommand {
  return 'entityOccurrenceId' in command;
}

function throwUnexpectedRetryCommand(command: ClassicResultNavigationCommand): never {
  throw new Error(`Classic Retry received unsupported command ${command.type}`);
}

function throwUnexpectedComboCommand(command: never): never {
  throw new Error(`Classic Combo received unsupported command ${String(command)}`);
}
