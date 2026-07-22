import {
  _decorator,
  Component,
  Game,
  Node,
  Sprite,
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
  director,
  game,
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
import type { ComboCommand } from '../domain/combo-service';
import { ComboService } from '../domain/combo-service';
import type { FailCommand } from '../domain/fail-service';
import { FailService } from '../domain/fail-service';
import { ModuloGameplayRandom, SeededTargetRawSource } from '../domain/gameplay-random';
import type { ScoreCommand } from '../domain/score-service';
import { ScoreService } from '../domain/score-service';
import {
  classicLeaderboardPanelValues,
} from '../domain/classic-result-ranking';
import { TossTimer } from '../domain/toss-timer';
import {
  CLASSIC_BLADE_MOVED_EVENT,
} from './blade-input-controller';
import { ClassicAudioPresenter } from './classic-audio-presenter';
import { ClassicCriticalParticlePresenter } from './classic-critical-particle-presenter';
import { ClassicCutHalfPresenter } from './classic-cut-half-presenter';
import { ClassicEntityRegistry } from './classic-entity-registry';
import { ClassicFailPresenter } from './classic-fail-presenter';
import { ClassicResultPresenter } from './classic-result-presenter';
import { ClassicScoreHudPresenter } from './classic-score-hud-presenter';
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

export interface ClassicResultMenuRequestedEvent {
  readonly completedRunScore: number;
}

export interface ClassicResultRewardReadyEvent {
  readonly bonusCoins: number;
  readonly completedRunScore: number;
  readonly totalCoins: number;
}

export interface ClassicResultRetryFailedEvent {
  readonly message: string;
  readonly reason: 'load-rejected' | 'scene-load-error';
}

/**
 * Playable Classic slice: the recovered intro gate starts the normal-free timer, exact
 * recovered fruit use Creator Physics2D, post-step blade rays drive cut/score/combo, and the
 * terminal callback replaces Classic presentation with the recovered result-entry shell.
 * This and ClassicSceneController are scene-lifetime components; do not toggle either one
 * independently to model pause or resume.
 */
@ccclass('ClassicGameplayController')
@requireComponent(ClassicSceneController)
export class ClassicGameplayController extends Component {
  private readonly random = new ModuloGameplayRandom(
    new SeededTargetRawSource(TARGET_REPLAY_SEED),
  );
  private readonly planner = new ClassicSpawnPlanner({
    random: this.random,
    sampleKinematics: sampleSpawnKinematics,
  });
  private readonly swishAudio = new ClassicSwishAudioGate(this.random);
  private readonly combo = new ComboService(this.random);
  private readonly fail = new FailService();
  private score = new ScoreService();
  private readonly deferredControllers = new Set<ClassicTossControllerId>();
  private readonly cutHalfPresenters = new Set<ClassicCutHalfPresenter>();
  private readonly criticalCutHalfPresenters = new Set<ClassicCutHalfPresenter>();
  private readonly criticalParticlePresenters = new Set<ClassicCriticalParticlePresenter>();
  private sceneController: ClassicSceneController | null = null;
  private audioPresenter: ClassicAudioPresenter | null = null;
  private recoveredBackgroundNode: Node | null = null;
  private recoveredBackgroundOpacity: UIOpacity | null = null;
  private scoreHudRoot: Node | null = null;
  private worldPresentationRoot: Node | null = null;
  private failPresentationRoot: Node | null = null;
  private resultPresentationRoot: Node | null = null;
  private registry: ClassicEntityRegistry | null = null;
  private failPresenter: ClassicFailPresenter | null = null;
  private resultPresenter: ClassicResultPresenter | null = null;
  private scoreHudPresenter: ClassicScoreHudPresenter | null = null;
  private resourceCatalog: ClassicSliceResourceCatalog | null = null;
  private normalFree: ClassicFreeTossStrategy | null = null;
  private introGoodNode: Node | null = null;
  private introLuckNode: Node | null = null;
  private terminalGameNode: Node | null = null;
  private terminalOverNode: Node | null = null;
  private settingsRuntime: ClassicSettingsRuntime | null = null;
  private resultConstructionRequested = false;
  private resultMode: 0 | null = null;
  private resultScore: number | null = null;
  private gameOver = false;
  private shuttingDown = false;

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
    const viewport = this.requireViewport();
    void this.initializeRecoveredResources(viewport).catch(
      this.onRecoveredResourceInitializationFailed,
    );
  }

  private async initializeRecoveredResources(
    viewport: Readonly<{ x: number; y: number; width: number; height: number }>,
  ): Promise<void> {
    let loadedAudioPresenter: ClassicAudioPresenter | null = null;
    try {
      const sceneController = this.sceneController;
      if (sceneController === null) {
        throw new Error('Classic scene controller must be available before resource loading');
      }
      const assetTree = sceneController.resolutionSnapshot()?.profile.assetTree;
      if (assetTree === undefined) {
        throw new Error('Classic resolution profile must be available before resource loading');
      }
      // Load the bundle-backed visual catalog first so audio reuses the registered bundle.
      // This avoids issuing two first-load requests against Creator's bundle registry.
      const resources = await loadClassicSliceResourceCatalog(assetTree);
      loadedAudioPresenter = await ClassicAudioPresenter.load(this.node);
      if (
        this.shuttingDown
        || !isValid(this.node, true)
        || !this.node.activeInHierarchy
      ) {
        loadedAudioPresenter.stop();
        return;
      }

      const audioPresenter = loadedAudioPresenter;
      this.audioPresenter = audioPresenter;
      this.resourceCatalog = resources;
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
      this.createRecoveredPresentation(viewport, resources);
      this.playRecoveredIntro(viewport, resources);
      this.updatePresentation();
      this.emitSnapshot();
    } catch (error) {
      if (loadedAudioPresenter !== null && loadedAudioPresenter !== this.audioPresenter) {
        loadedAudioPresenter.stop();
      }
      this.disposeRecoveredRuntime();
      throw error;
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
    game.on(Game.EVENT_HIDE, this.onGameHidden, this);
    this.node.on(CLASSIC_BLADE_MOVED_EVENT, this.onBladeMoved, this);
    this.node.on(CLASSIC_PHYSICS_STEPPED_EVENT, this.onPhysicsStepped, this);
    this.node.on(CLASSIC_SESSION_COMMAND_EVENT, this.onSessionCommand, this);
  }

  start(): void {
    this.updatePresentation();
    this.emitSnapshot();
  }

  update(deltaSeconds: number): void {
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
    game.off(Game.EVENT_HIDE, this.onGameHidden, this);
    this.node.off(CLASSIC_BLADE_MOVED_EVENT, this.onBladeMoved, this);
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
    this.disposeClassicModePresentation();
    this.disposeResultPresentation();
    if (this.recoveredBackgroundOpacity !== null) {
      Tween.stopAllByTarget(this.recoveredBackgroundOpacity);
    }
    if (
      this.recoveredBackgroundNode !== null
      && isValid(this.recoveredBackgroundNode, true)
    ) {
      this.recoveredBackgroundNode.destroy();
    }
    this.recoveredBackgroundOpacity = null;
    this.recoveredBackgroundNode = null;
    this.audioPresenter?.stop();
    this.audioPresenter = null;
    this.resourceCatalog = null;
  }

  /** Removes only the native Classic layer's owned runtime and presentation. */
  private disposeClassicModePresentation(): void {
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
  }

  private disposeResultPresentation(): void {
    this.resultPresenter?.dispose();
    this.resultPresenter = null;
    if (
      this.resultPresentationRoot !== null
      && isValid(this.resultPresentationRoot, true)
    ) {
      this.resultPresentationRoot.destroy();
    }
    this.resultPresentationRoot = null;
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

  restart(onLaunched?: (error: Error | null) => void): boolean {
    return director.loadScene('classic', onLaunched);
  }

  private readonly onBladeMoved = (event: BladeMoveResult): void => {
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

  private readonly onGameHidden = (): void => {
    try {
      this.settingsRuntime?.save();
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      this.node.emit(CLASSIC_SETTINGS_SAVE_FAILED_EVENT, failure);
      console.error(failure);
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
    for (const command of commands) {
      if (command.type === 'add-score') {
        this.score.addScore(command.value);
      } else if (command.type === 'play-combo-sound') {
        this.audioPresenter?.playOneShot(getClassicComboAudioPath(command.soundIndex));
      }
    }
    this.emitCommands(commands);
    if (commands.length > 0) {
      this.emitSnapshot();
    }
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

  private readonly effectsEnabled = (): boolean => true;

  private createRecoveredPresentation(
    viewport: Readonly<{ width: number; height: number }>,
    resources: ClassicSliceResourceCatalog,
  ): void {
    const background = createRecoveredSpriteNode(
      this.node,
      'ClassicRecoveredPaperBackground',
      resources.presentation.background,
    );
    this.recoveredBackgroundNode = background;
    background.setSiblingIndex(0);
    const opacity = background.addComponent(UIOpacity);
    this.recoveredBackgroundOpacity = opacity;
    opacity.opacity = 0;
    tween(opacity).to(0.5, { opacity: 255 }).start();

    const scoreHudRoot = createRecoveredPresenterRoot(this.node, 'ClassicScoreHudRoot');
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
      this.node,
      'ClassicWorldPresentationRoot',
    );
    const failPresentationRoot = createRecoveredPresenterRoot(
      this.node,
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
    viewport: Readonly<{ width: number; height: number }>,
    resources: ClassicSliceResourceCatalog,
  ): void {
    const goodY = viewport.height * 0.025;
    const luckY = -viewport.height * 0.025;
    const outside = viewport.width * 0.75;
    const good = createRecoveredSpriteNode(
      this.node,
      'ClassicRecoveredIntroGood',
      resources.presentation.introGood,
    );
    this.introGoodNode = good;
    const luck = createRecoveredSpriteNode(
      this.node,
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
    const game = createRecoveredSpriteNode(
      this.node,
      'ClassicRecoveredTerminalGame',
      resources.presentation.terminalGame,
    );
    const over = createRecoveredSpriteNode(
      this.node,
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
    const root = createRecoveredPresenterRoot(this.node, 'ClassicResultPresentationRoot');
    root.setSiblingIndex(zOrder);
    try {
      presenter.attach(root);
    } catch (error) {
      presenter.dispose();
      root.destroy();
      throw error;
    }
    this.resultPresentationRoot = root;
    this.resultPresenter = presenter;
  }

  private readonly onResultRetry = (): void => {
    if (this.effectsEnabled()) {
      this.audioPresenter?.playOneShot(CLASSIC_MENU_BUTTON_AUDIO_PATH);
    }
    if (!this.restart(this.onResultRetrySceneLaunched)) {
      this.rearmFailedResultRetry(
        'load-rejected',
        'Creator rejected the Classic scene reload request',
      );
    }
  };

  private readonly onResultRetrySceneLaunched = (error: Error | null): void => {
    if (error !== null) {
      this.rearmFailedResultRetry('scene-load-error', error.message);
    }
  };

  private rearmFailedResultRetry(
    reason: ClassicResultRetryFailedEvent['reason'],
    message: string,
  ): void {
    if (!this.resultPresenter?.rearmNavigationAfterFailure('retry')) {
      return;
    }
    const payload: ClassicResultRetryFailedEvent = Object.freeze({ message, reason });
    this.node.emit(CLASSIC_RESULT_RETRY_FAILED_EVENT, payload);
  }

  private readonly onResultMenu = (): void => {
    if (this.effectsEnabled()) {
      this.audioPresenter?.playOneShot(CLASSIC_MENU_BUTTON_AUDIO_PATH);
    }
    const { score } = this.requireConfiguredResultTransition();
    const payload: ClassicResultMenuRequestedEvent = Object.freeze({
      completedRunScore: score,
    });
    // MainMenuLayer is not restored yet; retain the result while exposing the exact boundary.
    this.node.emit(CLASSIC_RESULT_MENU_REQUESTED_EVENT, payload);
  };

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

  private requireSettingsRuntime(): ClassicSettingsRuntime {
    const runtime = this.settingsRuntime;
    if (runtime === null) {
      throw new Error('Classic settings must load before result behavior');
    }
    return runtime;
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
