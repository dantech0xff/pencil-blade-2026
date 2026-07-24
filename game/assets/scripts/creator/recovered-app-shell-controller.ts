import {
  _decorator,
  Component,
  Game,
  Node,
  director,
  game,
  isValid,
} from 'cc';

import { BladeInputController } from './blade-input-controller';
import {
  CLASSIC_RESULT_MENU_REQUESTED_EVENT,
  CLASSIC_SETTINGS_SAVE_FAILED_EVENT,
  ClassicGameplayController,
  type ClassicResultMenuRequestedEvent,
} from './classic-gameplay-controller';
import {
  CLASSIC_BIRD_PAUSE_QUIT_REQUESTED_EVENT,
  CLASSIC_BIRD_RESULT_MENU_REQUESTED_EVENT,
  ClassicBirdGameplayController,
} from './classic-bird-gameplay-controller';
import {
  ClassicBirdLifecycleRollbackError,
} from './classic-bird-scene-controller';
import {
  COMBO_BIRD_PAUSE_QUIT_REQUESTED_EVENT,
  COMBO_BIRD_RESULT_MENU_REQUESTED_EVENT,
  ComboBirdGameplayController,
} from './combo-bird-gameplay-controller';
import {
  ComboBirdLifecycleRollbackError,
} from './combo-bird-scene-controller';
import {
  GN_STYLE_PAUSE_QUIT_REQUESTED_EVENT,
  GN_STYLE_RESULT_MENU_REQUESTED_EVENT,
  GnStyleGameplayController,
} from './gn-style-gameplay-controller';
import {
  GnStyleLifecycleRollbackError,
} from './gn-style-scene-controller';
import { ClassicSceneController } from './classic-scene-controller';
import {
  CRAZY_BIRD_PAUSE_QUIT_REQUESTED_EVENT,
  CRAZY_BIRD_RESULT_MENU_REQUESTED_EVENT,
  CRAZY_PAUSE_QUIT_REQUESTED_EVENT,
  CRAZY_RESULT_MENU_REQUESTED_EVENT,
  CrazyGameplayController,
  type CrazyPauseQuitRequestedEvent,
  type CrazyResultMenuRequestedEvent,
} from './crazy-gameplay-controller';
import { CrazyLifecycleRollbackError } from './crazy-scene-controller';
import {
  MainMenuPresenter,
  type MainMenuNavigationTransaction,
  type MainMenuUnsupportedDestination,
} from './main-menu-presenter';
import { loadMainMenuResources, type LoadedMainMenuResources } from './main-menu-resource-loader';
import {
  ModeSelectFatalNavigationError,
  ModeSelectPresenter,
  type ModeSelectNavigationTransaction,
  type ModeSelectUnsupportedDestination,
} from './mode-select-presenter';
import {
  loadModeSelectResources,
  type LoadedModeSelectResources,
} from './mode-select-resource-loader';
import { NonClassicPhysicsAdapter } from './non-classic-physics-adapter';
import {
  createRecoveredAppViewport,
  type RecoveredAppViewport,
} from './recovered-app-viewport';
import { loadSharedGameSceneResources } from './shared-game-resource-loader';
import { SharedGameScenePresenter } from './shared-game-scene-presenter';
import { SharedLeafPresenter } from './shared-leaf-presenter';

const { ccclass, requireComponent } = _decorator;

export const RECOVERED_APP_SHELL_BOOT_FAILED_EVENT = 'recovered-app-shell-boot-failed';
export const RECOVERED_APP_SHELL_TRANSITION_FAILED_EVENT
  = 'recovered-app-shell-transition-failed';
export const RECOVERED_APP_SHELL_UNSUPPORTED_DESTINATION_EVENT
  = 'recovered-app-shell-unsupported-destination';
export const RECOVERED_APP_SHELL_PLATFORM_REVIEW_REQUESTED_EVENT
  = 'recovered-app-shell-platform-review-requested';

export type RecoveredAppShellState =
  | 'booting'
  | 'classic-bird'
  | 'classic'
  | 'combo-bird'
  | 'crazy-bird'
  | 'crazy'
  | 'destroyed'
  | 'failed'
  | 'gn-style'
  | 'main-menu'
  | 'mode-select';

export interface RecoveredAppShellTransitionFailure {
  readonly error: Error;
  readonly from: RecoveredAppShellState;
  readonly to: RecoveredAppShellState;
}

export interface RecoveredAppShellUnsupportedDestination {
  readonly destination: MainMenuUnsupportedDestination | ModeSelectUnsupportedDestination;
  readonly source: 'main-menu' | 'mode-select';
}

export interface RecoveredAppShellPlatformReviewRequest {
  /** A platform bridge must call this synchronously for the native reward flow to continue. */
  approve(): void;
}

interface RecoveredAppResources {
  readonly mainMenu: LoadedMainMenuResources;
  readonly modeSelect: LoadedModeSelectResources;
}

interface CrazyMainMenuNavigationRequest {
  readonly root: Node;
  commit(previousRoot: Node): void;
  rollback(): void;
}

interface ClassicBirdMainMenuNavigationRequest {
  readonly root: Node;
  /** Idempotent producer commit; the shell retries once to detect a post-commit throw. */
  commit(previousRoot: Node): void;
  rollback(): void;
}

interface CapturedClassicBirdMainMenuNavigationRequest {
  readonly request: ClassicBirdMainMenuNavigationRequest | null;
  readonly rollback: (() => void) | null;
}

interface CapturedCrazyMainMenuNavigationRequest {
  readonly request: CrazyMainMenuNavigationRequest | null;
  readonly rollback: (() => void) | null;
}

/**
 * Persistent serialized owner for the recovered Boot -> Menu -> Mode Select gameplay loop.
 * Every top-level screen swap is transactional; unsupported recovered destinations fail closed.
 */
@ccclass('RecoveredAppShellController')
@requireComponent(GnStyleGameplayController)
@requireComponent(ComboBirdGameplayController)
@requireComponent(ClassicBirdGameplayController)
@requireComponent(CrazyGameplayController)
@requireComponent(ClassicGameplayController)
export class RecoveredAppShellController extends Component {
  private activeMainMenu: MainMenuPresenter | null = null;
  private activeModeSelect: ModeSelectPresenter | null = null;
  private bladeInput: BladeInputController | null = null;
  private bootPromise: Promise<void> | null = null;
  private classicBirdGameplayController: ClassicBirdGameplayController | null = null;
  private comboBirdGameplayController: ComboBirdGameplayController | null = null;
  private crazyGameplayController: CrazyGameplayController | null = null;
  private destroyedValue = false;
  private gameplayController: ClassicGameplayController | null = null;
  private gnStyleGameplayController: GnStyleGameplayController | null = null;
  private nonClassicPhysics: NonClassicPhysicsAdapter | null = null;
  private resources: RecoveredAppResources | null = null;
  private sceneController: ClassicSceneController | null = null;
  private sharedLeaf: SharedLeafPresenter | null = null;
  private sharedScene: SharedGameScenePresenter | null = null;
  private stateValue: RecoveredAppShellState = 'booting';
  private transitioning = false;
  private viewport: RecoveredAppViewport | null = null;

  get state(): RecoveredAppShellState {
    return this.stateValue;
  }

  onLoad(): void {
    this.bladeInput = requireComponentFromNode(
      this.node,
      BladeInputController,
      'BladeInputController',
    );
    this.sceneController = requireComponentFromNode(
      this.node,
      ClassicSceneController,
      'ClassicSceneController',
    );
    this.gameplayController = requireComponentFromNode(
      this.node,
      ClassicGameplayController,
      'ClassicGameplayController',
    );
    this.classicBirdGameplayController = requireComponentFromNode(
      this.node,
      ClassicBirdGameplayController,
      'ClassicBirdGameplayController',
    );
    this.comboBirdGameplayController = requireComponentFromNode(
      this.node,
      ComboBirdGameplayController,
      'ComboBirdGameplayController',
    );
    this.gnStyleGameplayController = requireComponentFromNode(
      this.node,
      GnStyleGameplayController,
      'GnStyleGameplayController',
    );
    this.crazyGameplayController = requireComponentFromNode(
      this.node,
      CrazyGameplayController,
      'CrazyGameplayController',
    );
  }

  onEnable(): void {
    this.node.on(
      CLASSIC_RESULT_MENU_REQUESTED_EVENT,
      this.onClassicResultMenuRequested,
      this,
    );
    this.node.on(
      CRAZY_RESULT_MENU_REQUESTED_EVENT,
      this.onCrazyResultMenuRequested,
      this,
    );
    this.node.on(
      CRAZY_PAUSE_QUIT_REQUESTED_EVENT,
      this.onCrazyPauseQuitRequested,
      this,
    );
    this.node.on(
      CRAZY_BIRD_RESULT_MENU_REQUESTED_EVENT,
      this.onCrazyBirdResultMenuRequested,
      this,
    );
    this.node.on(
      CRAZY_BIRD_PAUSE_QUIT_REQUESTED_EVENT,
      this.onCrazyBirdPauseQuitRequested,
      this,
    );
    this.node.on(
      CLASSIC_BIRD_RESULT_MENU_REQUESTED_EVENT,
      this.onClassicBirdResultMenuRequested,
      this,
    );
    this.node.on(
      CLASSIC_BIRD_PAUSE_QUIT_REQUESTED_EVENT,
      this.onClassicBirdPauseQuitRequested,
      this,
    );
    this.node.on(
      COMBO_BIRD_RESULT_MENU_REQUESTED_EVENT,
      this.onComboBirdResultMenuRequested,
      this,
    );
    this.node.on(
      COMBO_BIRD_PAUSE_QUIT_REQUESTED_EVENT,
      this.onComboBirdPauseQuitRequested,
      this,
    );
    this.node.on(
      GN_STYLE_RESULT_MENU_REQUESTED_EVENT,
      this.onGnStyleResultMenuRequested,
      this,
    );
    this.node.on(
      GN_STYLE_PAUSE_QUIT_REQUESTED_EVENT,
      this.onGnStylePauseQuitRequested,
      this,
    );
    game.on(Game.EVENT_HIDE, this.onApplicationHidden, this);
  }

  start(): void {
    void this.bootRecoveredApp().catch(() => {
      // The boot boundary already emits the normalized failure for the host/editor.
    });
  }

  update(deltaSeconds: number): void {
    if (this.destroyedValue) {
      return;
    }
    this.sharedLeaf?.update(deltaSeconds);
    this.activeMainMenu?.update(deltaSeconds);
    this.activeModeSelect?.update(deltaSeconds);
  }

  onDisable(): void {
    this.node.off(
      CLASSIC_RESULT_MENU_REQUESTED_EVENT,
      this.onClassicResultMenuRequested,
      this,
    );
    this.node.off(
      CRAZY_RESULT_MENU_REQUESTED_EVENT,
      this.onCrazyResultMenuRequested,
      this,
    );
    this.node.off(
      CRAZY_PAUSE_QUIT_REQUESTED_EVENT,
      this.onCrazyPauseQuitRequested,
      this,
    );
    this.node.off(
      CRAZY_BIRD_RESULT_MENU_REQUESTED_EVENT,
      this.onCrazyBirdResultMenuRequested,
      this,
    );
    this.node.off(
      CRAZY_BIRD_PAUSE_QUIT_REQUESTED_EVENT,
      this.onCrazyBirdPauseQuitRequested,
      this,
    );
    this.node.off(
      CLASSIC_BIRD_RESULT_MENU_REQUESTED_EVENT,
      this.onClassicBirdResultMenuRequested,
      this,
    );
    this.node.off(
      CLASSIC_BIRD_PAUSE_QUIT_REQUESTED_EVENT,
      this.onClassicBirdPauseQuitRequested,
      this,
    );
    this.node.off(
      COMBO_BIRD_RESULT_MENU_REQUESTED_EVENT,
      this.onComboBirdResultMenuRequested,
      this,
    );
    this.node.off(
      COMBO_BIRD_PAUSE_QUIT_REQUESTED_EVENT,
      this.onComboBirdPauseQuitRequested,
      this,
    );
    this.node.off(
      GN_STYLE_RESULT_MENU_REQUESTED_EVENT,
      this.onGnStyleResultMenuRequested,
      this,
    );
    this.node.off(
      GN_STYLE_PAUSE_QUIT_REQUESTED_EVENT,
      this.onGnStylePauseQuitRequested,
      this,
    );
    game.off(Game.EVENT_HIDE, this.onApplicationHidden, this);
  }

  onDestroy(): void {
    this.destroyedValue = true;
    this.stateValue = 'destroyed';
    this.onDisable();
    runBestEffortCleanup('Recovered app shell teardown', [
      () => this.activeMainMenu?.dispose(),
      () => this.activeModeSelect?.dispose(),
      () => this.sharedScene?.dispose(),
      () => this.nonClassicPhysics?.dispose(),
    ]);
    this.activeMainMenu = null;
    this.activeModeSelect = null;
    this.sharedScene = null;
    this.sharedLeaf = null;
    this.resources = null;
    this.viewport = null;
    this.nonClassicPhysics = null;
  }

  /** Idempotent boot entry used by the serialized start hook and Preview diagnostics. */
  bootRecoveredApp(): Promise<void> {
    if (this.destroyedValue) {
      return Promise.reject(new Error('Recovered app shell cannot boot after destruction'));
    }
    if (this.bootPromise !== null) {
      return this.bootPromise;
    }
    const boot = this.initializeRecoveredApp().catch((error: unknown) => {
      const failure = normalizeError(error, 'Recovered app shell boot failed');
      if (!this.destroyedValue) {
        this.stateValue = 'failed';
        this.node.emit(RECOVERED_APP_SHELL_BOOT_FAILED_EVENT, failure);
        console.error(failure);
      }
      throw failure;
    });
    this.bootPromise = boot;
    return boot;
  }

  private async initializeRecoveredApp(): Promise<void> {
    const sceneController = this.requireSceneController();
    const gameplayController = this.requireGameplayController();
    const appliedResolution = sceneController.prepareSceneResolution();
    const viewport = createRecoveredAppViewport(appliedResolution);

    // Classic performs the first bundle load. Optional foreground loaders then reuse the
    // registered bundle instead of racing multiple Creator first-load requests.
    await gameplayController.prepareRecoveredRuntime();
    this.assertBootStillCurrent();
    const assetTree = gameplayController.sharedResourceCatalog.assetTree;
    // Crazy supplements the already-loaded Classic catalog. Its failure is isolated: Menu and
    // Classic remain available while the Crazy transaction stays fail-closed.
    const crazyPreparation = this.requireCrazyGameplayController()
      .prepareCrazyRuntime()
      .catch(() => undefined);
    // Classic Bird reuses the process-owned Classic/Crazy catalogs but remains an independent
    // fail-closed destination. Its preparation waits for Crazy to settle so both modes never race
    // the same supplemental bundle on first load.
    const classicBirdPreparation = crazyPreparation.then(async () => {
      this.assertBootStillCurrent();
      try {
        await this.requireClassicBirdGameplayController().prepareClassicBirdRuntime();
      } catch {
        // Menu and the prepared modes remain available when Classic Bird cannot prepare.
      }
      this.assertBootStillCurrent();
    });
    // Crazy Bird is another independent optional destination. It shares the settled Crazy
    // supplement, then loads the exact Bird type-2 profile after the type-1 request has settled
    // so Creator never receives competing first-load batches for the same game bundle.
    const crazyBirdPreparation = classicBirdPreparation.then(async () => {
      this.assertBootStillCurrent();
      try {
        await this.requireCrazyGameplayController().prepareCrazyBirdRuntime();
      } catch {
        // Menu, Crazy, and Classic Bird stay available when only type-2 preparation fails.
      }
      this.assertBootStillCurrent();
    });
    // Combo Bird owns its mode-5 resources and can prepare even when an earlier optional
    // destination failed. Waiting for the chain only serializes first access to the game bundle.
    const comboBirdPreparation = crazyBirdPreparation.then(async () => {
      this.assertBootStillCurrent();
      try {
        await this.requireComboBirdGameplayController().prepareComboBirdRuntime();
      } catch {
        // Every previously prepared destination remains available when only Combo Bird fails.
      }
      this.assertBootStillCurrent();
    });
    // GN Style is the final optional destination. It waits for every preceding supplemental
    // load to settle before loading its exact resources, TimeManager audio, and dedicated track.
    const gnStylePreparation = comboBirdPreparation.then(async () => {
      this.assertBootStillCurrent();
      try {
        await this.requireGnStyleGameplayController().prepareGnStyleRuntime();
      } catch {
        // All previously prepared destinations remain available when only GN Style fails.
      }
      this.assertBootStillCurrent();
    });
    const [sharedResources, mainMenuResources, modeSelectResources] = await Promise.all([
      loadSharedGameSceneResources(assetTree),
      loadMainMenuResources(assetTree),
      loadModeSelectResources(assetTree),
    ]);
    await Promise.all([
      crazyPreparation,
      classicBirdPreparation,
      crazyBirdPreparation,
      comboBirdPreparation,
      gnStylePreparation,
    ]);
    this.assertBootStillCurrent();

    const settings = gameplayController.sharedSettingsRuntime.state.snapshot;
    const sharedLeaf = SharedLeafPresenter.create({
      assetTree,
      random: gameplayController.sharedGameplayRandom,
      resources: sharedResources.leaves,
      viewport: appliedResolution.visibleRect,
    });
    let sharedScene: SharedGameScenePresenter | null = null;
    let mainMenu: MainMenuPresenter | null = null;
    try {
      sharedScene = SharedGameScenePresenter.create({
        backgroundIndex: settings.selectedBackground,
        leafFactory: { create: () => sharedLeaf },
        parent: this.node,
        resources: sharedResources,
        themeIndex: settings.selectedTheme,
      });
      const nonClassicPhysics = new NonClassicPhysicsAdapter();
      nonClassicPhysics.activateCollisionFilter();
      this.viewport = viewport;
      this.nonClassicPhysics = nonClassicPhysics;
      this.resources = Object.freeze({
        mainMenu: mainMenuResources,
        modeSelect: modeSelectResources,
      });
      this.sharedLeaf = sharedLeaf;
      this.sharedScene = sharedScene;

      mainMenu = this.createMainMenuPresenter();
      sharedScene.attachCurrentScreen(mainMenu.root);
      mainMenu.activate();
      this.activeMainMenu = mainMenu;
      this.stateValue = 'main-menu';
    } catch (error) {
      runBestEffortCleanup('Recovered app shell failed-boot cleanup', [
        () => mainMenu?.dispose(),
        () => sharedScene?.dispose(),
        () => {
          if (sharedScene === null) {
            sharedLeaf.dispose();
          }
        },
        () => this.nonClassicPhysics?.dispose(),
        () => gameplayController.sharedAudioPresenter.stop(),
      ]);
      this.activeMainMenu = null;
      this.sharedScene = null;
      this.sharedLeaf = null;
      this.resources = null;
      this.viewport = null;
      this.nonClassicPhysics = null;
      throw error;
    }
  }

  private createMainMenuPresenter(): MainMenuPresenter {
    const gameplay = this.requireGameplayController();
    const resources = this.requireResources();
    return MainMenuPresenter.create({
      audio: gameplay.sharedAudioPresenter,
      bladeInput: this.requireBladeInput(),
      canvas: this.node,
      classicResources: {
        assetTree: gameplay.sharedResourceCatalog.assetTree,
        defaultBlade: gameplay.sharedResourceCatalog.defaultBlade,
      },
      lifecycle: {
        onExitRequested: () => director.end(),
        onModeSelectRequested: (transaction) => (
          this.transitionMainMenuToModeSelect(transaction)
        ),
        onPlatformReviewRequested: () => this.requestPlatformReview(),
        onUnsupportedDestinationRequested: (destination) => (
          this.rejectUnsupportedDestination('main-menu', destination)
        ),
      },
      random: gameplay.sharedGameplayRandom,
      raycast: this.requireNonClassicPhysics(),
      resources: resources.mainMenu,
      settings: gameplay.sharedSettingsRuntime,
      viewport: this.requireViewport(),
    });
  }

  private createModeSelectPresenter(): ModeSelectPresenter {
    const gameplay = this.requireGameplayController();
    const resources = this.requireResources();
    return ModeSelectPresenter.create({
      audio: gameplay.sharedAudioPresenter,
      bladeInput: this.requireBladeInput(),
      canvas: this.node,
      classicResources: {
        assetTree: gameplay.sharedResourceCatalog.assetTree,
        defaultBlade: gameplay.sharedResourceCatalog.defaultBlade,
      },
      lifecycle: {
        onClassicRequested: (transaction) => this.transitionModeSelectToClassic(transaction),
        onCrazyRequested: (transaction) => this.transitionModeSelectToCrazy(transaction),
        onClassicBirdRequested: (transaction) => (
          this.transitionModeSelectToClassicBird(transaction)
        ),
        onCrazyBirdRequested: (transaction) => (
          this.transitionModeSelectToCrazyBird(transaction)
        ),
        onComboBirdRequested: (transaction) => (
          this.transitionModeSelectToComboBird(transaction)
        ),
        onGnStyleRequested: (transaction) => (
          this.transitionModeSelectToGnStyle(transaction)
        ),
        onMainMenuRequested: (transaction) => (
          this.transitionModeSelectToMainMenu(transaction)
        ),
        onUnsupportedDestinationRequested: (destination) => (
          this.rejectUnsupportedDestination('mode-select', destination)
        ),
      },
      random: gameplay.sharedGameplayRandom,
      raycast: this.requireNonClassicPhysics(),
      resources: resources.modeSelect,
      settings: gameplay.sharedSettingsRuntime,
      viewport: this.requireViewport(),
    });
  }

  private transitionMainMenuToModeSelect(
    transaction: MainMenuNavigationTransaction,
  ): boolean {
    const oldPresenter = this.activeMainMenu;
    if (
      oldPresenter === null
      || transaction.root !== oldPresenter.root
      || transaction.destination !== 'ModeSelectLayer'
    ) {
      return false;
    }
    return this.runTransition('main-menu', 'mode-select', () => {
      const sharedScene = this.requireSharedScene();
      const nextPresenter = this.createModeSelectPresenter();
      try {
        const previous = sharedScene.replaceCurrentScreen(nextPresenter.root);
        if (previous !== oldPresenter.root || !oldPresenter.suspendForTransition()) {
          throw new Error('Main Menu did not surrender the shared input lease');
        }
        nextPresenter.activate();
      } catch (error) {
        try {
          this.restorePreviousScreen(oldPresenter.root, nextPresenter.root);
        } finally {
          nextPresenter.dispose();
        }
        throw error;
      }
      this.activeMainMenu = null;
      this.activeModeSelect = nextPresenter;
      this.stateValue = 'mode-select';
      disposeCommittedPresenter(oldPresenter, 'Main Menu');
      return true;
    });
  }

  private transitionModeSelectToMainMenu(
    transaction: ModeSelectNavigationTransaction,
  ): boolean {
    const oldPresenter = this.activeModeSelect;
    if (
      oldPresenter === null
      || transaction.root !== oldPresenter.root
      || transaction.destination !== 'MainMenuLayer'
    ) {
      return false;
    }
    return this.runTransition('mode-select', 'main-menu', () => {
      const sharedScene = this.requireSharedScene();
      const nextPresenter = this.createMainMenuPresenter();
      try {
        const previous = sharedScene.replaceCurrentScreen(nextPresenter.root);
        if (previous !== oldPresenter.root || !oldPresenter.suspendForTransition()) {
          throw new Error('Mode Select did not surrender the shared input lease');
        }
        nextPresenter.activate();
      } catch (error) {
        try {
          this.restorePreviousScreen(oldPresenter.root, nextPresenter.root);
        } finally {
          nextPresenter.dispose();
          this.requireGameplayController().sharedAudioPresenter.stopBackgroundMusic();
        }
        throw error;
      }
      this.activeModeSelect = null;
      this.activeMainMenu = nextPresenter;
      this.stateValue = 'main-menu';
      disposeCommittedPresenter(oldPresenter, 'Mode Select');
      return true;
    });
  }

  private transitionModeSelectToClassic(
    transaction: ModeSelectNavigationTransaction,
  ): boolean {
    const oldPresenter = this.activeModeSelect;
    if (
      oldPresenter === null
      || transaction.root !== oldPresenter.root
      || transaction.destination !== 'ClassicModeLayer'
    ) {
      return false;
    }
    return this.runTransition('mode-select', 'classic', () => {
      const sharedScene = this.requireSharedScene();
      const nonClassicPhysics = this.requireNonClassicPhysics();
      try {
        const previous = sharedScene.detachCurrentScreen(oldPresenter.root);
        if (previous !== oldPresenter.root || !oldPresenter.suspendForTransition()) {
          throw new Error('Mode Select did not surrender the shared input lease');
        }
        nonClassicPhysics.restorePreviousCollisionFilter();
        this.requireGameplayController().activateClassicFromAppShell(sharedScene);
      } catch (error) {
        const rollbackFailures: unknown[] = [];
        try {
          this.restoreModeSelectAfterFailedClassicActivation(oldPresenter.root);
        } catch (rollbackError) {
          rollbackFailures.push(rollbackError);
        }
        try {
          nonClassicPhysics.activateCollisionFilter();
        } catch (rollbackError) {
          rollbackFailures.push(rollbackError);
        }
        if (rollbackFailures.length > 0) {
          throw new ModeSelectFatalNavigationError(
            'Mode Select to Classic rollback is incomplete',
            aggregateWithPrimaryError(
              'Mode Select to Classic rollback failed',
              error,
              rollbackFailures,
            ),
            this.captureModeSelectFatalScreenRelease(oldPresenter.root),
          );
        }
        throw error;
      }
      this.activeModeSelect = null;
      this.stateValue = 'classic';
      disposeCommittedPresenter(oldPresenter, 'Mode Select');
      return true;
    });
  }

  private transitionModeSelectToCrazy(
    transaction: ModeSelectNavigationTransaction,
  ): boolean {
    const oldPresenter = this.activeModeSelect;
    const crazy = this.requireCrazyGameplayController();
    if (
      oldPresenter === null
      || transaction.root !== oldPresenter.root
      || transaction.destination !== 'CrazyModeLayer'
      || !crazy.prepared
    ) {
      return false;
    }
    return this.runTransition('mode-select', 'crazy', () => {
      const sharedScene = this.requireSharedScene();
      const nonClassicPhysics = this.requireNonClassicPhysics();
      try {
        const previous = sharedScene.detachCurrentScreen(oldPresenter.root);
        if (previous !== oldPresenter.root || !oldPresenter.suspendForTransition()) {
          throw new Error('Mode Select did not surrender the shared input lease');
        }
        nonClassicPhysics.restorePreviousCollisionFilter();
        crazy.activateCrazyFromAppShell(sharedScene);
      } catch (error) {
        this.compensateFailedTimedCrazyActivation(
          oldPresenter,
          nonClassicPhysics,
          error,
          'Crazy',
        );
      }
      this.activeModeSelect = null;
      this.stateValue = 'crazy';
      disposeCommittedPresenter(oldPresenter, 'Mode Select');
      return true;
    });
  }

  private transitionModeSelectToClassicBird(
    transaction: ModeSelectNavigationTransaction,
  ): boolean {
    const oldPresenter = this.activeModeSelect;
    const classicBird = this.requireClassicBirdGameplayController();
    if (
      oldPresenter === null
      || transaction.root !== oldPresenter.root
      || transaction.destination !== 'ClassicBirdLayer'
      || !classicBird.prepared
    ) {
      return false;
    }
    return this.runTransition('mode-select', 'classic-bird', () => {
      const sharedScene = this.requireSharedScene();
      const nonClassicPhysics = this.requireNonClassicPhysics();
      try {
        const previous = sharedScene.detachCurrentScreen(oldPresenter.root);
        if (previous !== oldPresenter.root || !oldPresenter.suspendForTransition()) {
          throw new Error('Mode Select did not surrender the shared input lease');
        }
        nonClassicPhysics.restorePreviousCollisionFilter();
        classicBird.activateClassicBirdFromAppShell(sharedScene);
      } catch (error) {
        const rollbackFailures: unknown[] = [];
        try {
          this.restoreModeSelectAfterFailedClassicBirdActivation(oldPresenter.root);
        } catch (rollbackError) {
          rollbackFailures.push(rollbackError);
        }
        try {
          nonClassicPhysics.activateCollisionFilter();
          if (!nonClassicPhysics.collisionFilterActive) {
            throw new Error(
              'Classic Bird activation rollback could not reacquire the collision filter',
            );
          }
        } catch (rollbackError) {
          rollbackFailures.push(rollbackError);
        }
        if (rollbackFailures.length === 0) {
          try {
            if (!oldPresenter.rearmNavigationAfterFailure()) {
              throw new Error(
                'Classic Bird activation rollback could not reacquire Mode Select input',
              );
            }
          } catch (rollbackError) {
            rollbackFailures.push(rollbackError);
          }
        }
        if (rollbackFailures.length > 0) {
          throw new ModeSelectFatalNavigationError(
            'Mode Select to Classic Bird rollback is incomplete',
            aggregateWithPrimaryError(
              'Mode Select to Classic Bird rollback failed',
              error,
              rollbackFailures,
            ),
            this.captureModeSelectFatalScreenRelease(oldPresenter.root),
          );
        }
        if (error instanceof ClassicBirdLifecycleRollbackError) {
          throw new ModeSelectFatalNavigationError(
            'Mode Select to Classic Bird retained poisoned runtime ownership',
            error,
            this.captureModeSelectFatalScreenRelease(oldPresenter.root),
          );
        }
        throw error;
      }
      this.activeModeSelect = null;
      this.stateValue = 'classic-bird';
      disposeCommittedPresenter(oldPresenter, 'Mode Select');
      return true;
    });
  }

  private transitionModeSelectToCrazyBird(
    transaction: ModeSelectNavigationTransaction,
  ): boolean {
    const oldPresenter = this.activeModeSelect;
    const crazy = this.requireCrazyGameplayController();
    if (
      oldPresenter === null
      || transaction.root !== oldPresenter.root
      || transaction.destination !== 'CrazyBirdLayer'
      || !crazy.crazyBirdPrepared
    ) {
      return false;
    }
    return this.runTransition('mode-select', 'crazy-bird', () => {
      const sharedScene = this.requireSharedScene();
      const nonClassicPhysics = this.requireNonClassicPhysics();
      try {
        const previous = sharedScene.detachCurrentScreen(oldPresenter.root);
        if (previous !== oldPresenter.root || !oldPresenter.suspendForTransition()) {
          throw new Error('Mode Select did not surrender the shared input lease');
        }
        nonClassicPhysics.restorePreviousCollisionFilter();
        crazy.activateCrazyBirdFromAppShell(sharedScene);
      } catch (error) {
        this.compensateFailedTimedCrazyActivation(
          oldPresenter,
          nonClassicPhysics,
          error,
          'Crazy Bird',
        );
      }
      this.activeModeSelect = null;
      this.stateValue = 'crazy-bird';
      disposeCommittedPresenter(oldPresenter, 'Mode Select');
      return true;
    });
  }

  private transitionModeSelectToComboBird(
    transaction: ModeSelectNavigationTransaction,
  ): boolean {
    const oldPresenter = this.activeModeSelect;
    const comboBird = this.requireComboBirdGameplayController();
    if (
      oldPresenter === null
      || transaction.root !== oldPresenter.root
      || transaction.destination !== 'ComboBirdLayer'
      || !comboBird.prepared
    ) {
      return false;
    }
    return this.runTransition('mode-select', 'combo-bird', () => {
      const sharedScene = this.requireSharedScene();
      const nonClassicPhysics = this.requireNonClassicPhysics();
      try {
        const previous = sharedScene.detachCurrentScreen(oldPresenter.root);
        if (previous !== oldPresenter.root || !oldPresenter.suspendForTransition()) {
          throw new Error('Mode Select did not surrender the shared input lease');
        }
        nonClassicPhysics.restorePreviousCollisionFilter();
        comboBird.activateComboBirdFromAppShell(sharedScene);
      } catch (error) {
        const rollbackFailures: unknown[] = [];
        try {
          this.restoreModeSelectAfterFailedComboBirdActivation(oldPresenter.root);
        } catch (rollbackError) {
          rollbackFailures.push(rollbackError);
        }
        try {
          nonClassicPhysics.activateCollisionFilter();
          if (!nonClassicPhysics.collisionFilterActive) {
            throw new Error(
              'Combo Bird activation rollback could not reacquire the collision filter',
            );
          }
        } catch (rollbackError) {
          rollbackFailures.push(rollbackError);
        }
        if (rollbackFailures.length === 0) {
          try {
            if (!oldPresenter.rearmNavigationAfterFailure()) {
              throw new Error(
                'Combo Bird activation rollback could not reacquire Mode Select input',
              );
            }
          } catch (rollbackError) {
            rollbackFailures.push(rollbackError);
          }
        }
        if (rollbackFailures.length > 0) {
          throw new ModeSelectFatalNavigationError(
            'Mode Select to Combo Bird rollback is incomplete',
            aggregateWithPrimaryError(
              'Mode Select to Combo Bird rollback failed',
              error,
              rollbackFailures,
            ),
            this.captureModeSelectFatalScreenRelease(oldPresenter.root),
          );
        }
        if (error instanceof ComboBirdLifecycleRollbackError) {
          throw new ModeSelectFatalNavigationError(
            'Mode Select to Combo Bird retained poisoned runtime ownership',
            error,
            this.captureModeSelectFatalScreenRelease(oldPresenter.root),
          );
        }
        throw error;
      }
      this.activeModeSelect = null;
      this.stateValue = 'combo-bird';
      disposeCommittedPresenter(oldPresenter, 'Mode Select');
      return true;
    });
  }

  private transitionModeSelectToGnStyle(
    transaction: ModeSelectNavigationTransaction,
  ): boolean {
    const oldPresenter = this.activeModeSelect;
    const gnStyle = this.requireGnStyleGameplayController();
    if (
      oldPresenter === null
      || transaction.root !== oldPresenter.root
      || transaction.destination !== 'GNStyleLayer'
      || !gnStyle.prepared
    ) {
      return false;
    }
    return this.runTransition('mode-select', 'gn-style', () => {
      const sharedScene = this.requireSharedScene();
      const nonClassicPhysics = this.requireNonClassicPhysics();
      try {
        const previous = sharedScene.detachCurrentScreen(oldPresenter.root);
        if (previous !== oldPresenter.root || !oldPresenter.suspendForTransition()) {
          throw new Error('Mode Select did not surrender the shared input lease');
        }
        nonClassicPhysics.restorePreviousCollisionFilter();
        gnStyle.activateGnStyleFromAppShell(sharedScene);
      } catch (error) {
        const rollbackFailures: unknown[] = [];
        try {
          this.restoreModeSelectAfterFailedGnStyleActivation(oldPresenter.root);
        } catch (rollbackError) {
          rollbackFailures.push(rollbackError);
        }
        try {
          nonClassicPhysics.activateCollisionFilter();
          if (!nonClassicPhysics.collisionFilterActive) {
            throw new Error(
              'GN Style activation rollback could not reacquire the collision filter',
            );
          }
        } catch (rollbackError) {
          rollbackFailures.push(rollbackError);
        }
        if (rollbackFailures.length === 0) {
          try {
            if (!oldPresenter.rearmNavigationAfterFailure()) {
              throw new Error(
                'GN Style activation rollback could not reacquire Mode Select input',
              );
            }
          } catch (rollbackError) {
            rollbackFailures.push(rollbackError);
          }
        }
        if (rollbackFailures.length > 0) {
          throw new ModeSelectFatalNavigationError(
            'Mode Select to GN Style rollback is incomplete',
            aggregateWithPrimaryError(
              'Mode Select to GN Style rollback failed',
              error,
              rollbackFailures,
            ),
            this.captureModeSelectFatalScreenRelease(oldPresenter.root),
          );
        }
        if (error instanceof GnStyleLifecycleRollbackError) {
          throw new ModeSelectFatalNavigationError(
            'Mode Select to GN Style retained poisoned runtime ownership',
            error,
            this.captureModeSelectFatalScreenRelease(oldPresenter.root),
          );
        }
        throw error;
      }
      this.activeModeSelect = null;
      this.stateValue = 'gn-style';
      disposeCommittedPresenter(oldPresenter, 'Mode Select');
      return true;
    });
  }

  private readonly onClassicResultMenuRequested = (
    request: ClassicResultMenuRequestedEvent,
  ): void => {
    if (
      this.destroyedValue
      || this.stateValue !== 'classic'
      || this.transitioning
      || request === null
      || typeof request !== 'object'
    ) {
      try {
        request?.rollback();
      } catch (error) {
        console.error(normalizeError(error, 'Rejected Classic Result rollback failed'));
      }
      return;
    }
    const from = this.stateValue;
    this.transitioning = true;
    let nextPresenter: MainMenuPresenter | null = null;
    let collisionFilterActivated = false;
    try {
      const sharedScene = this.requireSharedScene();
      if (sharedScene.currentScreen !== request.resultRoot) {
        throw new Error('Classic Result menu request does not own the current screen');
      }
      collisionFilterActivated = this.requireNonClassicPhysics().activateCollisionFilter();
      nextPresenter = this.createMainMenuPresenter();
      const previous = sharedScene.replaceCurrentScreen(nextPresenter.root);
      nextPresenter.activate();
      request.commit(previous);
      this.activeMainMenu = nextPresenter;
      this.stateValue = 'main-menu';
    } catch (error) {
      runBestEffortCleanup('Classic Result to Main Menu rollback', [
        () => request.rollback(),
        () => nextPresenter?.dispose(),
        () => this.requireGameplayController().sharedAudioPresenter.stopBackgroundMusic(),
        () => {
          if (collisionFilterActivated) {
            this.requireNonClassicPhysics().restorePreviousCollisionFilter();
          }
        },
      ]);
      this.emitTransitionFailure(from, 'main-menu', error);
    } finally {
      this.transitioning = false;
    }
  };

  private readonly onCrazyResultMenuRequested = (
    request: unknown,
  ): void => {
    if (!isCrazyResultMenuRequestedEvent(request)) {
      rollbackRejectedCrazyNavigationRequest(request, 'Crazy Result');
      return;
    }
    this.transitionCrazyToMainMenu({
      root: request.resultRoot,
      commit: (previousRoot) => request.commit(previousRoot),
      rollback: () => request.rollback(),
    }, 'Crazy Result');
  };

  private readonly onCrazyPauseQuitRequested = (
    request: unknown,
  ): void => {
    if (!isCrazyPauseQuitRequestedEvent(request)) {
      rollbackRejectedCrazyNavigationRequest(request, 'Crazy Pause Quit');
      return;
    }
    this.transitionCrazyToMainMenu({
      root: request.crazyRoot,
      commit: (previousRoot) => request.commit(previousRoot),
      rollback: () => request.rollback(),
    }, 'Crazy Pause Quit');
  };

  private readonly onCrazyBirdResultMenuRequested = (
    request: unknown,
  ): void => {
    const captured = captureCrazyResultMenuNavigationRequest(request);
    if (captured.request === null) {
      this.rejectCrazyBirdNavigationRequest(
        captured.rollback,
        'Crazy Bird Result',
      );
      return;
    }
    this.transitionCrazyBirdToMainMenu(
      captured.request,
      'Crazy Bird Result',
    );
  };

  private readonly onCrazyBirdPauseQuitRequested = (
    request: unknown,
  ): void => {
    const captured = captureCrazyPauseQuitNavigationRequest(request);
    if (captured.request === null) {
      this.rejectCrazyBirdNavigationRequest(
        captured.rollback,
        'Crazy Bird Pause Quit',
      );
      return;
    }
    this.transitionCrazyBirdToMainMenu(
      captured.request,
      'Crazy Bird Pause Quit',
    );
  };

  private readonly onClassicBirdResultMenuRequested = (
    request: unknown,
  ): void => {
    const captured = captureClassicBirdResultMenuNavigationRequest(request);
    if (captured.request === null) {
      this.rejectClassicBirdNavigationRequest(
        captured.rollback,
        'Classic Bird Result',
      );
      return;
    }
    this.transitionClassicBirdToMainMenu(captured.request, 'Classic Bird Result');
  };

  private readonly onClassicBirdPauseQuitRequested = (
    request: unknown,
  ): void => {
    const captured = captureClassicBirdPauseQuitNavigationRequest(request);
    if (captured.request === null) {
      this.rejectClassicBirdNavigationRequest(
        captured.rollback,
        'Classic Bird Pause Quit',
      );
      return;
    }
    this.transitionClassicBirdToMainMenu(captured.request, 'Classic Bird Pause Quit');
  };

  private readonly onComboBirdResultMenuRequested = (
    request: unknown,
  ): void => {
    const captured = captureComboBirdResultMenuNavigationRequest(request);
    if (captured.request === null) {
      this.rejectComboBirdNavigationRequest(
        captured.rollback,
        'Combo Bird Result',
      );
      return;
    }
    this.transitionComboBirdToMainMenu(captured.request, 'Combo Bird Result');
  };

  private readonly onComboBirdPauseQuitRequested = (
    request: unknown,
  ): void => {
    const captured = captureComboBirdPauseQuitNavigationRequest(request);
    if (captured.request === null) {
      this.rejectComboBirdNavigationRequest(
        captured.rollback,
        'Combo Bird Pause Quit',
      );
      return;
    }
    this.transitionComboBirdToMainMenu(captured.request, 'Combo Bird Pause Quit');
  };

  private readonly onGnStyleResultMenuRequested = (
    request: unknown,
  ): void => {
    const captured = captureGnStyleResultMenuNavigationRequest(request);
    if (captured.request === null) {
      this.rejectGnStyleNavigationRequest(
        captured.rollback,
        'GN Style Result',
      );
      return;
    }
    this.transitionGnStyleToMainMenu(captured.request, 'GN Style Result');
  };

  private readonly onGnStylePauseQuitRequested = (
    request: unknown,
  ): void => {
    const captured = captureGnStylePauseQuitNavigationRequest(request);
    if (captured.request === null) {
      this.rejectGnStyleNavigationRequest(
        captured.rollback,
        'GN Style Pause Quit',
      );
      return;
    }
    this.transitionGnStyleToMainMenu(captured.request, 'GN Style Pause Quit');
  };

  private transitionCrazyToMainMenu(
    request: CrazyMainMenuNavigationRequest,
    source: 'Crazy Pause Quit' | 'Crazy Result',
  ): void {
    this.transitionTimedCrazyToMainMenu(request, 'crazy', source);
  }

  private transitionCrazyBirdToMainMenu(
    request: CrazyMainMenuNavigationRequest,
    source: 'Crazy Bird Pause Quit' | 'Crazy Bird Result',
  ): void {
    this.transitionTimedCrazyToMainMenu(request, 'crazy-bird', source);
  }

  private transitionTimedCrazyToMainMenu(
    request: CrazyMainMenuNavigationRequest,
    expectedState: 'crazy' | 'crazy-bird',
    source:
      | 'Crazy Pause Quit'
      | 'Crazy Result'
      | 'Crazy Bird Pause Quit'
      | 'Crazy Bird Result',
  ): void {
    if (
      this.destroyedValue
      || this.stateValue !== expectedState
      || this.transitioning
      || request === null
      || typeof request !== 'object'
    ) {
      try {
        request?.rollback();
      } catch (error) {
        console.error(normalizeError(error, `Rejected ${source} rollback failed`));
      }
      return;
    }
    const from = this.stateValue;
    this.transitioning = true;
    let nextPresenter: MainMenuPresenter | null = null;
    let collisionFilterActivated = false;
    try {
      const sharedScene = this.requireSharedScene();
      if (sharedScene.currentScreen !== request.root) {
        throw new Error(`${source} request does not own the current screen`);
      }
      collisionFilterActivated = this.requireNonClassicPhysics()
        .activateCollisionFilter();
      nextPresenter = this.createMainMenuPresenter();
      const previous = sharedScene.replaceCurrentScreen(nextPresenter.root);
      nextPresenter.activate();
      commitCrazyMainMenuNavigationRequest(request, previous, source);
      this.activeMainMenu = nextPresenter;
      this.stateValue = 'main-menu';
    } catch (error) {
      const rollbackFailures = runBestEffortCleanup(`${source} to Main Menu rollback`, [
        () => this.restoreCrazyNavigationRootBeforeRollback(request.root),
        () => nextPresenter?.dispose(),
        () => this.requireGameplayController().sharedAudioPresenter.stopBackgroundMusic(),
        () => {
          if (collisionFilterActivated) {
            this.requireNonClassicPhysics().restorePreviousCollisionFilter();
          }
        },
        () => request.rollback(),
        () => {
          if (expectedState === 'crazy-bird') {
            this.assertCrazyNavigationRollbackRestored(request.root);
          }
        },
      ]);
      if (expectedState === 'crazy-bird' && rollbackFailures.length > 0) {
        this.retainCrazyBirdShellFailure(
          from,
          aggregateWithPrimaryError(
            `${source} to Main Menu rollback failed`,
            error,
            rollbackFailures,
          ),
        );
      } else {
        this.emitTransitionFailure(from, 'main-menu', error);
      }
    } finally {
      this.transitioning = false;
    }
  }

  private transitionClassicBirdToMainMenu(
    request: ClassicBirdMainMenuNavigationRequest,
    source: 'Classic Bird Pause Quit' | 'Classic Bird Result',
  ): void {
    if (
      this.destroyedValue
      || this.stateValue !== 'classic-bird'
      || this.transitioning
    ) {
      this.rejectClassicBirdNavigationRequest(request.rollback, source);
      return;
    }
    const from = this.stateValue;
    this.transitioning = true;
    let nextPresenter: MainMenuPresenter | null = null;
    let collisionFilterActivated = false;
    try {
      const sharedScene = this.requireSharedScene();
      if (sharedScene.currentScreen !== request.root) {
        throw new Error(`${source} request does not own the current screen`);
      }
      collisionFilterActivated = this.requireNonClassicPhysics()
        .activateCollisionFilter();
      nextPresenter = this.createMainMenuPresenter();
      const previous = sharedScene.replaceCurrentScreen(nextPresenter.root);
      nextPresenter.activate();
      commitClassicBirdMainMenuNavigationRequest(request, previous, source);
      this.activeMainMenu = nextPresenter;
      this.stateValue = 'main-menu';
    } catch (error) {
      const rollbackFailures = runBestEffortCleanup(
        `${source} to Main Menu rollback`,
        [
          () => this.restoreClassicBirdNavigationRootBeforeRollback(request.root),
          () => nextPresenter?.dispose(),
          () => this.requireGameplayController().sharedAudioPresenter.stopBackgroundMusic(),
          () => {
            if (collisionFilterActivated) {
              this.requireNonClassicPhysics().restorePreviousCollisionFilter();
            }
          },
          () => request.rollback(),
          () => this.assertClassicBirdNavigationRollbackRestored(request.root),
        ],
      );
      if (rollbackFailures.length > 0) {
        this.retainClassicBirdShellFailure(
          from,
          aggregateWithPrimaryError(
            `${source} to Main Menu rollback failed`,
            error,
            rollbackFailures,
          ),
        );
      } else {
        this.emitTransitionFailure(from, 'main-menu', error);
      }
    } finally {
      this.transitioning = false;
    }
  }

  private transitionComboBirdToMainMenu(
    request: ClassicBirdMainMenuNavigationRequest,
    source: 'Combo Bird Pause Quit' | 'Combo Bird Result',
  ): void {
    if (
      this.destroyedValue
      || this.stateValue !== 'combo-bird'
      || this.transitioning
    ) {
      this.rejectComboBirdNavigationRequest(request.rollback, source);
      return;
    }
    const from = this.stateValue;
    this.transitioning = true;
    let nextPresenter: MainMenuPresenter | null = null;
    let collisionFilterActivated = false;
    try {
      const sharedScene = this.requireSharedScene();
      if (sharedScene.currentScreen !== request.root) {
        throw new Error(`${source} request does not own the current screen`);
      }
      collisionFilterActivated = this.requireNonClassicPhysics()
        .activateCollisionFilter();
      nextPresenter = this.createMainMenuPresenter();
      const previous = sharedScene.replaceCurrentScreen(nextPresenter.root);
      nextPresenter.activate();
      commitClassicBirdMainMenuNavigationRequest(request, previous, source);
      this.activeMainMenu = nextPresenter;
      this.stateValue = 'main-menu';
    } catch (error) {
      const rollbackFailures = runBestEffortCleanup(
        `${source} to Main Menu rollback`,
        [
          () => this.restoreComboBirdNavigationRootBeforeRollback(request.root),
          () => nextPresenter?.dispose(),
          () => this.requireGameplayController().sharedAudioPresenter.stopBackgroundMusic(),
          () => {
            if (collisionFilterActivated) {
              this.requireNonClassicPhysics().restorePreviousCollisionFilter();
            }
          },
          () => request.rollback(),
          () => this.assertComboBirdNavigationRollbackRestored(request.root),
        ],
      );
      if (rollbackFailures.length > 0) {
        this.retainComboBirdShellFailure(
          from,
          aggregateWithPrimaryError(
            `${source} to Main Menu rollback failed`,
            error,
            rollbackFailures,
          ),
        );
      } else {
        this.emitTransitionFailure(from, 'main-menu', error);
      }
    } finally {
      this.transitioning = false;
    }
  }

  private transitionGnStyleToMainMenu(
    request: ClassicBirdMainMenuNavigationRequest,
    source: 'GN Style Pause Quit' | 'GN Style Result',
  ): void {
    if (
      this.destroyedValue
      || this.stateValue !== 'gn-style'
      || this.transitioning
    ) {
      this.rejectStaleGnStyleNavigationRequest(request.rollback, source);
      return;
    }
    const from = this.stateValue;
    let sourceOwnershipConfirmed = false;
    let sharedScene: SharedGameScenePresenter;
    try {
      sharedScene = this.requireSharedScene();
    } catch (error) {
      const rollbackFailures = rollbackRejectedClassicBirdNavigationRequest(
        request.rollback,
        source,
      );
      this.retainGnStyleShellFailure(
        from,
        aggregateWithPrimaryError(
          `${source} source validation failed`,
          error,
          rollbackFailures,
        ),
      );
      return;
    }
    if (sharedScene.currentScreen !== request.root) {
      this.rejectStaleGnStyleNavigationRequest(request.rollback, source);
      return;
    }
    sourceOwnershipConfirmed = true;
    this.transitioning = true;
    let nextPresenter: MainMenuPresenter | null = null;
    let collisionFilterActivated = false;
    try {
      collisionFilterActivated = this.requireNonClassicPhysics()
        .activateCollisionFilter();
      nextPresenter = this.createMainMenuPresenter();
      const previous = sharedScene.replaceCurrentScreen(nextPresenter.root);
      nextPresenter.activate();
      commitClassicBirdMainMenuNavigationRequest(request, previous, source);
      this.activeMainMenu = nextPresenter;
      this.stateValue = 'main-menu';
    } catch (error) {
      const rollbackFailures = runBestEffortCleanup(
        `${source} to Main Menu rollback`,
        [
          () => {
            if (sourceOwnershipConfirmed) {
              this.restoreGnStyleNavigationRootBeforeRollback(request.root);
            }
          },
          () => nextPresenter?.dispose(),
          () => this.requireGameplayController().sharedAudioPresenter.stopBackgroundMusic(),
          () => {
            if (collisionFilterActivated) {
              this.requireNonClassicPhysics().restorePreviousCollisionFilter();
            }
          },
          () => request.rollback(),
          () => {
            if (sourceOwnershipConfirmed) {
              this.assertGnStyleNavigationRollbackRestored(request.root);
            }
          },
        ],
      );
      if (rollbackFailures.length > 0) {
        this.retainGnStyleShellFailure(
          from,
          aggregateWithPrimaryError(
            `${source} to Main Menu rollback failed`,
            error,
            rollbackFailures,
          ),
        );
      } else {
        this.emitTransitionFailure(from, 'main-menu', error);
      }
    } finally {
      this.transitioning = false;
    }
  }

  private rejectClassicBirdNavigationRequest(
    rollback: (() => void) | null,
    source: 'Classic Bird Pause Quit' | 'Classic Bird Result',
  ): void {
    const from = this.stateValue;
    const rollbackFailures = rollbackRejectedClassicBirdNavigationRequest(
      rollback,
      source,
    );
    if (rollbackFailures.length === 0) {
      return;
    }
    this.retainClassicBirdShellFailure(
      from,
      aggregateWithPrimaryError(
        `Rejected ${source} navigation rollback failed`,
        new Error(`Recovered app shell rejected ${source} navigation`),
        rollbackFailures,
      ),
    );
  }

  private rejectCrazyBirdNavigationRequest(
    rollback: (() => void) | null,
    source: 'Crazy Bird Pause Quit' | 'Crazy Bird Result',
  ): void {
    const from = this.stateValue;
    const rollbackFailures = rollbackRejectedCapturedNavigationRequest(
      rollback,
      source,
    );
    if (rollbackFailures.length === 0) {
      return;
    }
    this.retainCrazyBirdShellFailure(
      from,
      aggregateWithPrimaryError(
        `Rejected ${source} navigation rollback failed`,
        new Error(`Recovered app shell rejected ${source} navigation`),
        rollbackFailures,
      ),
    );
  }

  private rejectComboBirdNavigationRequest(
    rollback: (() => void) | null,
    source: 'Combo Bird Pause Quit' | 'Combo Bird Result',
  ): void {
    const from = this.stateValue;
    const rollbackFailures = rollbackRejectedClassicBirdNavigationRequest(
      rollback,
      source,
    );
    if (rollbackFailures.length === 0) {
      return;
    }
    this.retainComboBirdShellFailure(
      from,
      aggregateWithPrimaryError(
        `Rejected ${source} navigation rollback failed`,
        new Error(`Recovered app shell rejected ${source} navigation`),
        rollbackFailures,
      ),
    );
  }

  private rejectGnStyleNavigationRequest(
    rollback: (() => void) | null,
    source: 'GN Style Pause Quit' | 'GN Style Result',
  ): void {
    const from = this.stateValue;
    const rollbackFailures = rollbackRejectedClassicBirdNavigationRequest(
      rollback,
      source,
    );
    if (rollbackFailures.length === 0) {
      return;
    }
    this.retainGnStyleShellFailure(
      from,
      aggregateWithPrimaryError(
        `Rejected ${source} navigation rollback failed`,
        new Error(`Recovered app shell rejected ${source} navigation`),
        rollbackFailures,
      ),
    );
  }

  private rejectStaleGnStyleNavigationRequest(
    _rollback: (() => void) | null,
    _source: 'GN Style Pause Quit' | 'GN Style Result',
  ): void {
    // Without a matching current root or generation token, producer callbacks are unowned.
    // Calling either settlement path could mutate the fresh run that superseded this request.
  }

  private retainClassicBirdShellFailure(
    from: RecoveredAppShellState,
    error: unknown,
  ): void {
    const failure = normalizeError(
      error,
      'Recovered Classic Bird navigation rollback failed',
    );
    if (this.destroyedValue) {
      console.error(failure);
      return;
    }
    this.stateValue = 'failed';
    try {
      this.emitTransitionFailure(from, 'main-menu', failure);
    } catch (reportingError) {
      console.error(aggregateWithPrimaryError(
        'Recovered fatal Classic Bird transition reporting failed',
        failure,
        [reportingError],
      ));
    }
  }

  private retainCrazyBirdShellFailure(
    from: RecoveredAppShellState,
    error: unknown,
  ): void {
    const failure = normalizeError(
      error,
      'Recovered Crazy Bird navigation rollback failed',
    );
    if (this.destroyedValue) {
      console.error(failure);
      return;
    }
    this.stateValue = 'failed';
    try {
      this.emitTransitionFailure(from, 'main-menu', failure);
    } catch (reportingError) {
      console.error(aggregateWithPrimaryError(
        'Recovered fatal Crazy Bird transition reporting failed',
        failure,
        [reportingError],
      ));
    }
  }

  private retainComboBirdShellFailure(
    from: RecoveredAppShellState,
    error: unknown,
  ): void {
    const failure = normalizeError(
      error,
      'Recovered Combo Bird navigation rollback failed',
    );
    if (this.destroyedValue) {
      console.error(failure);
      return;
    }
    this.stateValue = 'failed';
    try {
      this.emitTransitionFailure(from, 'main-menu', failure);
    } catch (reportingError) {
      console.error(aggregateWithPrimaryError(
        'Recovered fatal Combo Bird transition reporting failed',
        failure,
        [reportingError],
      ));
    }
  }

  private retainGnStyleShellFailure(
    from: RecoveredAppShellState,
    error: unknown,
  ): void {
    const failure = normalizeError(
      error,
      'Recovered GN Style navigation rollback failed',
    );
    if (this.destroyedValue) {
      console.error(failure);
      return;
    }
    this.stateValue = 'failed';
    try {
      this.emitTransitionFailure(from, 'main-menu', failure);
    } catch (reportingError) {
      console.error(aggregateWithPrimaryError(
        'Recovered fatal GN Style transition reporting failed',
        failure,
        [reportingError],
      ));
    }
  }

  private restoreCrazyNavigationRootBeforeRollback(root: Node): void {
    const sharedScene = this.requireSharedScene();
    const current = sharedScene.currentScreen;
    if (current === root) {
      return;
    }
    if (!isValid(root, true) || root.parent !== null) {
      throw new Error('Crazy navigation rollback lost its detached source screen');
    }
    if (current === null) {
      sharedScene.attachCurrentScreen(root);
    } else {
      const displaced = sharedScene.replaceCurrentScreen(root);
      if (displaced !== current) {
        throw new Error('Crazy navigation rollback displaced an unexpected destination');
      }
    }
    if (sharedScene.currentScreen !== root) {
      throw new Error('Crazy navigation rollback could not restore its source screen');
    }
  }

  private assertCrazyNavigationRollbackRestored(root: Node): void {
    const sharedScene = this.requireSharedScene();
    if (
      sharedScene.currentScreen !== root
      || !isValid(root, true)
      || root.parent === null
    ) {
      throw new Error(
        'Crazy Bird navigation rollback did not retain its source screen',
      );
    }
    if (this.requireNonClassicPhysics().collisionFilterActive) {
      throw new Error(
        'Crazy Bird navigation rollback retained the non-Classic collision filter',
      );
    }
  }

  private restoreClassicBirdNavigationRootBeforeRollback(root: Node): void {
    const sharedScene = this.requireSharedScene();
    const current = sharedScene.currentScreen;
    if (current === root) {
      return;
    }
    if (!isValid(root, true) || root.parent !== null) {
      throw new Error('Classic Bird navigation rollback lost its detached source screen');
    }
    if (current === null) {
      sharedScene.attachCurrentScreen(root);
    } else {
      const displaced = sharedScene.replaceCurrentScreen(root);
      if (displaced !== current) {
        throw new Error(
          'Classic Bird navigation rollback displaced an unexpected destination',
        );
      }
    }
    if (sharedScene.currentScreen !== root) {
      throw new Error('Classic Bird navigation rollback could not restore its source screen');
    }
  }

  private assertClassicBirdNavigationRollbackRestored(root: Node): void {
    const sharedScene = this.requireSharedScene();
    if (
      sharedScene.currentScreen !== root
      || !isValid(root, true)
      || root.parent === null
    ) {
      throw new Error(
        'Classic Bird navigation rollback did not retain its source screen',
      );
    }
    if (this.requireNonClassicPhysics().collisionFilterActive) {
      throw new Error(
        'Classic Bird navigation rollback retained the non-Classic collision filter',
      );
    }
  }

  private restoreComboBirdNavigationRootBeforeRollback(root: Node): void {
    const sharedScene = this.requireSharedScene();
    const current = sharedScene.currentScreen;
    if (current === root) {
      return;
    }
    if (!isValid(root, true) || root.parent !== null) {
      throw new Error('Combo Bird navigation rollback lost its detached source screen');
    }
    if (current === null) {
      sharedScene.attachCurrentScreen(root);
    } else {
      const displaced = sharedScene.replaceCurrentScreen(root);
      if (displaced !== current) {
        throw new Error(
          'Combo Bird navigation rollback displaced an unexpected destination',
        );
      }
    }
    if (sharedScene.currentScreen !== root) {
      throw new Error('Combo Bird navigation rollback could not restore its source screen');
    }
  }

  private assertComboBirdNavigationRollbackRestored(root: Node): void {
    const sharedScene = this.requireSharedScene();
    if (
      sharedScene.currentScreen !== root
      || !isValid(root, true)
      || root.parent === null
    ) {
      throw new Error(
        'Combo Bird navigation rollback did not retain its source screen',
      );
    }
    if (this.requireNonClassicPhysics().collisionFilterActive) {
      throw new Error(
        'Combo Bird navigation rollback retained the non-Classic collision filter',
      );
    }
  }

  private restoreGnStyleNavigationRootBeforeRollback(root: Node): void {
    const sharedScene = this.requireSharedScene();
    const current = sharedScene.currentScreen;
    if (current === root) {
      return;
    }
    if (!isValid(root, true) || root.parent !== null) {
      throw new Error('GN Style navigation rollback lost its detached source screen');
    }
    if (current === null) {
      sharedScene.attachCurrentScreen(root);
    } else {
      const displaced = sharedScene.replaceCurrentScreen(root);
      if (displaced !== current) {
        throw new Error(
          'GN Style navigation rollback displaced an unexpected destination',
        );
      }
    }
    if (sharedScene.currentScreen !== root) {
      throw new Error('GN Style navigation rollback could not restore its source screen');
    }
  }

  private assertGnStyleNavigationRollbackRestored(root: Node): void {
    const sharedScene = this.requireSharedScene();
    if (
      sharedScene.currentScreen !== root
      || !isValid(root, true)
      || root.parent === null
    ) {
      throw new Error(
        'GN Style navigation rollback did not retain its source screen',
      );
    }
    if (this.requireNonClassicPhysics().collisionFilterActive) {
      throw new Error(
        'GN Style navigation rollback retained the non-Classic collision filter',
      );
    }
  }

  private restoreModeSelectAfterFailedCrazyActivation(previous: Node): void {
    const sharedScene = this.requireSharedScene();
    const current = sharedScene.currentScreen;
    if (current === previous) {
      return;
    }
    if (!isValid(previous, true) || previous.parent !== null) {
      throw new Error('Crazy activation rollback lost the detached Mode Select root');
    }
    if (current === null) {
      sharedScene.attachCurrentScreen(previous);
    } else {
      const displaced = sharedScene.replaceCurrentScreen(previous);
      if (displaced !== current) {
        throw new Error('Crazy activation rollback displaced an unexpected current screen');
      }
    }
    if (sharedScene.currentScreen !== previous) {
      throw new Error('Crazy activation rollback could not restore Mode Select ownership');
    }
  }

  private restoreModeSelectAfterFailedClassicActivation(previous: Node): void {
    const sharedScene = this.requireSharedScene();
    const current = sharedScene.currentScreen;
    if (current === previous) {
      return;
    }
    if (!isValid(previous, true) || previous.parent !== null) {
      throw new Error('Classic activation rollback lost the detached Mode Select root');
    }
    if (current === null) {
      sharedScene.attachCurrentScreen(previous);
    } else {
      const displaced = sharedScene.replaceCurrentScreen(previous);
      if (displaced !== current) {
        throw new Error('Classic activation rollback displaced an unexpected current screen');
      }
    }
    if (sharedScene.currentScreen !== previous) {
      throw new Error('Classic activation rollback could not restore Mode Select ownership');
    }
  }

  private restoreModeSelectAfterFailedClassicBirdActivation(previous: Node): void {
    const sharedScene = this.requireSharedScene();
    const current = sharedScene.currentScreen;
    if (current === previous) {
      return;
    }
    if (!isValid(previous, true) || previous.parent !== null) {
      throw new Error(
        'Classic Bird activation rollback lost the detached Mode Select root',
      );
    }
    if (current === null) {
      sharedScene.attachCurrentScreen(previous);
    } else {
      const displaced = sharedScene.replaceCurrentScreen(previous);
      if (displaced !== current) {
        throw new Error(
          'Classic Bird activation rollback displaced an unexpected current screen',
        );
      }
    }
    if (sharedScene.currentScreen !== previous) {
      throw new Error(
        'Classic Bird activation rollback could not restore Mode Select ownership',
      );
    }
  }

  private restoreModeSelectAfterFailedCrazyBirdActivation(previous: Node): void {
    const sharedScene = this.requireSharedScene();
    const current = sharedScene.currentScreen;
    if (current === previous) {
      return;
    }
    if (!isValid(previous, true) || previous.parent !== null) {
      throw new Error(
        'Crazy Bird activation rollback lost the detached Mode Select root',
      );
    }
    if (current === null) {
      sharedScene.attachCurrentScreen(previous);
    } else {
      const displaced = sharedScene.replaceCurrentScreen(previous);
      if (displaced !== current) {
        throw new Error(
          'Crazy Bird activation rollback displaced an unexpected current screen',
        );
      }
    }
    if (sharedScene.currentScreen !== previous) {
      throw new Error(
        'Crazy Bird activation rollback could not restore Mode Select ownership',
      );
    }
  }

  private restoreModeSelectAfterFailedComboBirdActivation(previous: Node): void {
    const sharedScene = this.requireSharedScene();
    const current = sharedScene.currentScreen;
    if (current === previous) {
      return;
    }
    if (!isValid(previous, true) || previous.parent !== null) {
      throw new Error(
        'Combo Bird activation rollback lost the detached Mode Select root',
      );
    }
    if (current === null) {
      sharedScene.attachCurrentScreen(previous);
    } else {
      const displaced = sharedScene.replaceCurrentScreen(previous);
      if (displaced !== current) {
        throw new Error(
          'Combo Bird activation rollback displaced an unexpected current screen',
        );
      }
    }
    if (sharedScene.currentScreen !== previous) {
      throw new Error(
        'Combo Bird activation rollback could not restore Mode Select ownership',
      );
    }
  }

  private restoreModeSelectAfterFailedGnStyleActivation(previous: Node): void {
    const sharedScene = this.requireSharedScene();
    const current = sharedScene.currentScreen;
    if (current === previous) {
      return;
    }
    if (!isValid(previous, true) || previous.parent !== null) {
      throw new Error(
        'GN Style activation rollback lost the detached Mode Select root',
      );
    }
    if (current === null) {
      sharedScene.attachCurrentScreen(previous);
    } else {
      const displaced = sharedScene.replaceCurrentScreen(previous);
      if (displaced !== current) {
        throw new Error(
          'GN Style activation rollback displaced an unexpected current screen',
        );
      }
    }
    if (sharedScene.currentScreen !== previous) {
      throw new Error(
        'GN Style activation rollback could not restore Mode Select ownership',
      );
    }
  }

  private compensateFailedTimedCrazyActivation(
    oldPresenter: ModeSelectPresenter,
    nonClassicPhysics: NonClassicPhysicsAdapter,
    error: unknown,
    destination: 'Crazy' | 'Crazy Bird',
  ): never {
    const releaseScreenOwnership = this.captureModeSelectFatalScreenRelease(
      oldPresenter.root,
    );
    if (containsCrazyLifecycleRollbackError(error)) {
      throw new ModeSelectFatalNavigationError(
        `Mode Select to ${destination} retained poisoned runtime ownership`,
        error,
        releaseScreenOwnership,
      );
    }

    const rollbackFailures: unknown[] = [];
    try {
      if (destination === 'Crazy Bird') {
        this.restoreModeSelectAfterFailedCrazyBirdActivation(oldPresenter.root);
      } else {
        this.restoreModeSelectAfterFailedCrazyActivation(oldPresenter.root);
      }
    } catch (rollbackError) {
      rollbackFailures.push(rollbackError);
    }
    try {
      nonClassicPhysics.activateCollisionFilter();
      if (!nonClassicPhysics.collisionFilterActive) {
        throw new Error(
          `${destination} activation rollback could not reacquire the collision filter`,
        );
      }
    } catch (rollbackError) {
      rollbackFailures.push(rollbackError);
    }
    if (rollbackFailures.length === 0) {
      try {
        if (!oldPresenter.rearmNavigationAfterFailure()) {
          throw new Error(
            `${destination} activation rollback could not reacquire Mode Select input`,
          );
        }
      } catch (rollbackError) {
        rollbackFailures.push(rollbackError);
      }
    }
    if (rollbackFailures.length > 0) {
      throw new ModeSelectFatalNavigationError(
        `Mode Select to ${destination} rollback is incomplete`,
        aggregateWithPrimaryError(
          `Mode Select to ${destination} rollback failed`,
          error,
          rollbackFailures,
        ),
        releaseScreenOwnership,
      );
    }
    throw error;
  }

  private captureModeSelectFatalScreenRelease(root: Node): () => void {
    const screen = this.requireSharedScene();
    return () => {
      const current = screen.currentScreen;
      if (current === null) {
        return;
      }
      if (current !== root) {
        throw new Error(
          'Mode Select fatal cleanup cannot release an unexpected current screen',
        );
      }
      const detached = screen.detachCurrentScreen(root);
      if (
        detached !== root
        || screen.currentScreen !== null
        || root.parent !== null
      ) {
        throw new Error(
          'Mode Select fatal cleanup could not release current-screen ownership',
        );
      }
    };
  }

  private runTransition(
    from: RecoveredAppShellState,
    to: RecoveredAppShellState,
    operation: () => boolean,
  ): boolean {
    if (this.destroyedValue || this.transitioning || this.stateValue !== from) {
      return false;
    }
    this.transitioning = true;
    try {
      return operation();
    } catch (error) {
      if (error instanceof ModeSelectFatalNavigationError) {
        this.stateValue = 'failed';
        try {
          this.emitTransitionFailure(from, to, error);
        } catch (reportingError) {
          console.error(normalizeError(
            reportingError,
            'Recovered fatal transition reporting failed',
          ));
        }
        throw error;
      }
      this.emitTransitionFailure(from, to, error);
      return false;
    } finally {
      this.transitioning = false;
    }
  }

  private restorePreviousScreen(previous: Node, attempted: Node): void {
    const sharedScene = this.requireSharedScene();
    if (sharedScene.currentScreen === attempted) {
      const restored = sharedScene.replaceCurrentScreen(previous);
      if (restored !== attempted) {
        throw new Error('Screen rollback detached an unexpected attempted destination');
      }
      return;
    }
    if (sharedScene.currentScreen === null && previous.parent === null) {
      sharedScene.attachCurrentScreen(previous);
      return;
    }
    if (sharedScene.currentScreen !== previous) {
      throw new Error('Screen rollback cannot recover the previous foreground owner');
    }
  }

  private rejectUnsupportedDestination(
    source: RecoveredAppShellUnsupportedDestination['source'],
    destination: RecoveredAppShellUnsupportedDestination['destination'],
  ): false {
    const payload: RecoveredAppShellUnsupportedDestination = Object.freeze({
      destination,
      source,
    });
    this.node.emit(RECOVERED_APP_SHELL_UNSUPPORTED_DESTINATION_EVENT, payload);
    return false;
  }

  private requestPlatformReview(): boolean {
    let approved = false;
    const payload: RecoveredAppShellPlatformReviewRequest = Object.freeze({
      approve: () => {
        approved = true;
      },
    });
    this.node.emit(RECOVERED_APP_SHELL_PLATFORM_REVIEW_REQUESTED_EVENT, payload);
    return approved;
  }

  private readonly onApplicationHidden = (): void => {
    if (this.destroyedValue || this.gameplayController === null) {
      return;
    }
    try {
      this.gameplayController.sharedSettingsRuntime.save();
    } catch (error) {
      const failure = normalizeError(error, 'Recovered settings save failed');
      this.node.emit(CLASSIC_SETTINGS_SAVE_FAILED_EVENT, failure);
      console.error(failure);
    }
  };

  private emitTransitionFailure(
    from: RecoveredAppShellState,
    to: RecoveredAppShellState,
    error: unknown,
  ): void {
    const failure: RecoveredAppShellTransitionFailure = Object.freeze({
      error: normalizeError(error, `Recovered ${from} to ${to} transition failed`),
      from,
      to,
    });
    this.node.emit(RECOVERED_APP_SHELL_TRANSITION_FAILED_EVENT, failure);
    console.error(failure.error);
  }

  private assertBootStillCurrent(): void {
    if (this.destroyedValue || !isValid(this.node, true)) {
      throw new Error('Recovered app shell boot completed after destruction');
    }
  }

  private requireBladeInput(): BladeInputController {
    if (this.bladeInput === null) {
      throw new Error('Recovered app shell requires BladeInputController');
    }
    return this.bladeInput;
  }

  private requireGameplayController(): ClassicGameplayController {
    if (this.gameplayController === null) {
      throw new Error('Recovered app shell requires ClassicGameplayController');
    }
    return this.gameplayController;
  }

  private requireCrazyGameplayController(): CrazyGameplayController {
    if (this.crazyGameplayController === null) {
      throw new Error('Recovered app shell requires CrazyGameplayController');
    }
    return this.crazyGameplayController;
  }

  private requireClassicBirdGameplayController(): ClassicBirdGameplayController {
    if (this.classicBirdGameplayController === null) {
      throw new Error('Recovered app shell requires ClassicBirdGameplayController');
    }
    return this.classicBirdGameplayController;
  }

  private requireComboBirdGameplayController(): ComboBirdGameplayController {
    if (this.comboBirdGameplayController === null) {
      throw new Error('Recovered app shell requires ComboBirdGameplayController');
    }
    return this.comboBirdGameplayController;
  }

  private requireGnStyleGameplayController(): GnStyleGameplayController {
    if (this.gnStyleGameplayController === null) {
      throw new Error('Recovered app shell requires GnStyleGameplayController');
    }
    return this.gnStyleGameplayController;
  }

  private requireSceneController(): ClassicSceneController {
    if (this.sceneController === null) {
      throw new Error('Recovered app shell requires ClassicSceneController');
    }
    return this.sceneController;
  }

  private requireSharedScene(): SharedGameScenePresenter {
    if (this.sharedScene === null || this.sharedScene.disposed) {
      throw new Error('Recovered app shell shared GameScene is unavailable');
    }
    return this.sharedScene;
  }

  private requireResources(): RecoveredAppResources {
    if (this.resources === null) {
      throw new Error('Recovered app shell foreground resources are unavailable');
    }
    return this.resources;
  }

  private requireNonClassicPhysics(): NonClassicPhysicsAdapter {
    if (this.nonClassicPhysics === null) {
      throw new Error('Recovered app shell non-Classic physics is unavailable');
    }
    return this.nonClassicPhysics;
  }

  private requireViewport(): RecoveredAppViewport {
    if (this.viewport === null) {
      throw new Error('Recovered app shell viewport is unavailable');
    }
    return this.viewport;
  }
}

function requireComponentFromNode<T extends Component>(
  node: Node,
  constructor: new (...args: any[]) => T,
  label: string,
): T {
  const component = node.getComponent(constructor);
  if (component === null) {
    throw new Error(`Recovered app shell requires ${label}`);
  }
  return component;
}

function disposeCommittedPresenter(
  presenter: Readonly<{ dispose(): boolean }>,
  label: string,
): void {
  try {
    presenter.dispose();
  } catch (error) {
    console.error(normalizeError(error, `${label} committed cleanup failed`));
  }
}

function isCrazyResultMenuRequestedEvent(
  request: unknown,
): request is CrazyResultMenuRequestedEvent {
  if (request === null || typeof request !== 'object') {
    return false;
  }
  try {
    const candidate = request as Readonly<{
      commit?: unknown;
      completedRunScore?: unknown;
      resultRoot?: unknown;
      rollback?: unknown;
    }>;
    return (
      candidate.resultRoot instanceof Node
      && isValid(candidate.resultRoot, true)
      && isSignedInt32(candidate.completedRunScore)
      && typeof candidate.commit === 'function'
      && typeof candidate.rollback === 'function'
    );
  } catch {
    return false;
  }
}

function isCrazyPauseQuitRequestedEvent(
  request: unknown,
): request is CrazyPauseQuitRequestedEvent {
  if (request === null || typeof request !== 'object') {
    return false;
  }
  try {
    const candidate = request as Readonly<{
      commit?: unknown;
      crazyRoot?: unknown;
      rollback?: unknown;
    }>;
    return (
      candidate.crazyRoot instanceof Node
      && isValid(candidate.crazyRoot, true)
      && typeof candidate.commit === 'function'
      && typeof candidate.rollback === 'function'
    );
  } catch {
    return false;
  }
}

function captureCrazyResultMenuNavigationRequest(
  request: unknown,
): CapturedCrazyMainMenuNavigationRequest {
  if (request === null || typeof request !== 'object') {
    return Object.freeze({
      request: null,
      rollback: null,
    });
  }
  let capturedRollback: (() => void) | null = null;
  try {
    const candidate = request as Readonly<{
      commit?: unknown;
      completedRunScore?: unknown;
      resultRoot?: unknown;
      rollback?: unknown;
    }>;
    const rollback = candidate.rollback;
    if (typeof rollback === 'function') {
      capturedRollback = () => rollback.call(request);
    }
    const resultRoot = candidate.resultRoot;
    const completedRunScore = candidate.completedRunScore;
    const commit = candidate.commit;
    if (
      !(resultRoot instanceof Node)
      || !isValid(resultRoot, true)
      || !isSignedInt32(completedRunScore)
      || typeof commit !== 'function'
      || capturedRollback === null
    ) {
      return Object.freeze({
        request: null,
        rollback: capturedRollback,
      });
    }
    return Object.freeze({
      request: Object.freeze({
        commit: (previousRoot: Node) => commit.call(request, previousRoot),
        rollback: capturedRollback,
        root: resultRoot,
      }),
      rollback: capturedRollback,
    });
  } catch {
    return Object.freeze({
      request: null,
      rollback: capturedRollback,
    });
  }
}

function captureCrazyPauseQuitNavigationRequest(
  request: unknown,
): CapturedCrazyMainMenuNavigationRequest {
  if (request === null || typeof request !== 'object') {
    return Object.freeze({
      request: null,
      rollback: null,
    });
  }
  let capturedRollback: (() => void) | null = null;
  try {
    const candidate = request as Readonly<{
      commit?: unknown;
      crazyRoot?: unknown;
      rollback?: unknown;
    }>;
    const rollback = candidate.rollback;
    if (typeof rollback === 'function') {
      capturedRollback = () => rollback.call(request);
    }
    const crazyRoot = candidate.crazyRoot;
    const commit = candidate.commit;
    if (
      !(crazyRoot instanceof Node)
      || !isValid(crazyRoot, true)
      || typeof commit !== 'function'
      || capturedRollback === null
    ) {
      return Object.freeze({
        request: null,
        rollback: capturedRollback,
      });
    }
    return Object.freeze({
      request: Object.freeze({
        commit: (previousRoot: Node) => commit.call(request, previousRoot),
        rollback: capturedRollback,
        root: crazyRoot,
      }),
      rollback: capturedRollback,
    });
  } catch {
    return Object.freeze({
      request: null,
      rollback: capturedRollback,
    });
  }
}

function captureClassicBirdResultMenuNavigationRequest(
  request: unknown,
): CapturedClassicBirdMainMenuNavigationRequest {
  if (request === null || typeof request !== 'object') {
    return Object.freeze({
      request: null,
      rollback: null,
    });
  }
  let capturedRollback: (() => void) | null = null;
  try {
    const candidate = request as Readonly<{
      commit?: unknown;
      completedRunScore?: unknown;
      resultRoot?: unknown;
      rollback?: unknown;
    }>;
    const rollback = candidate.rollback;
    if (typeof rollback === 'function') {
      capturedRollback = () => rollback.call(request);
    }
    const resultRoot = candidate.resultRoot;
    const completedRunScore = candidate.completedRunScore;
    const commit = candidate.commit;
    if (
      !(resultRoot instanceof Node)
      || !isValid(resultRoot, true)
      || typeof completedRunScore !== 'number'
      || !Number.isFinite(completedRunScore)
      || completedRunScore < 0
      || typeof commit !== 'function'
      || capturedRollback === null
    ) {
      return Object.freeze({
        request: null,
        rollback: capturedRollback,
      });
    }
    return Object.freeze({
      request: Object.freeze({
        commit: (previousRoot: Node) => commit.call(request, previousRoot),
        rollback: capturedRollback,
        root: resultRoot,
      }),
      rollback: capturedRollback,
    });
  } catch {
    return Object.freeze({
      request: null,
      rollback: capturedRollback,
    });
  }
}

function captureClassicBirdPauseQuitNavigationRequest(
  request: unknown,
): CapturedClassicBirdMainMenuNavigationRequest {
  if (request === null || typeof request !== 'object') {
    return Object.freeze({
      request: null,
      rollback: null,
    });
  }
  let capturedRollback: (() => void) | null = null;
  try {
    const candidate = request as Readonly<{
      classicBirdRoot?: unknown;
      commit?: unknown;
      rollback?: unknown;
    }>;
    const rollback = candidate.rollback;
    if (typeof rollback === 'function') {
      capturedRollback = () => rollback.call(request);
    }
    const classicBirdRoot = candidate.classicBirdRoot;
    const commit = candidate.commit;
    if (
      !(classicBirdRoot instanceof Node)
      || !isValid(classicBirdRoot, true)
      || typeof commit !== 'function'
      || capturedRollback === null
    ) {
      return Object.freeze({
        request: null,
        rollback: capturedRollback,
      });
    }
    return Object.freeze({
      request: Object.freeze({
        commit: (previousRoot: Node) => commit.call(request, previousRoot),
        rollback: capturedRollback,
        root: classicBirdRoot,
      }),
      rollback: capturedRollback,
    });
  } catch {
    return Object.freeze({
      request: null,
      rollback: capturedRollback,
    });
  }
}

function captureComboBirdResultMenuNavigationRequest(
  request: unknown,
): CapturedClassicBirdMainMenuNavigationRequest {
  if (request === null || typeof request !== 'object') {
    return Object.freeze({
      request: null,
      rollback: null,
    });
  }
  let capturedRollback: (() => void) | null = null;
  try {
    const candidate = request as Readonly<{
      commit?: unknown;
      completedRunScore?: unknown;
      resultRoot?: unknown;
      rollback?: unknown;
    }>;
    const rollback = candidate.rollback;
    if (typeof rollback === 'function') {
      capturedRollback = () => rollback.call(request);
    }
    const resultRoot = candidate.resultRoot;
    const completedRunScore = candidate.completedRunScore;
    const commit = candidate.commit;
    if (
      !(resultRoot instanceof Node)
      || !isValid(resultRoot, true)
      || !isSignedInt32(completedRunScore)
      || completedRunScore < 0
      || typeof commit !== 'function'
      || capturedRollback === null
    ) {
      return Object.freeze({
        request: null,
        rollback: capturedRollback,
      });
    }
    return Object.freeze({
      request: Object.freeze({
        commit: (previousRoot: Node) => commit.call(request, previousRoot),
        rollback: capturedRollback,
        root: resultRoot,
      }),
      rollback: capturedRollback,
    });
  } catch {
    return Object.freeze({
      request: null,
      rollback: capturedRollback,
    });
  }
}

function captureComboBirdPauseQuitNavigationRequest(
  request: unknown,
): CapturedClassicBirdMainMenuNavigationRequest {
  if (request === null || typeof request !== 'object') {
    return Object.freeze({
      request: null,
      rollback: null,
    });
  }
  let capturedRollback: (() => void) | null = null;
  try {
    const candidate = request as Readonly<{
      comboBirdRoot?: unknown;
      commit?: unknown;
      rollback?: unknown;
    }>;
    const rollback = candidate.rollback;
    if (typeof rollback === 'function') {
      capturedRollback = () => rollback.call(request);
    }
    const comboBirdRoot = candidate.comboBirdRoot;
    const commit = candidate.commit;
    if (
      !(comboBirdRoot instanceof Node)
      || !isValid(comboBirdRoot, true)
      || typeof commit !== 'function'
      || capturedRollback === null
    ) {
      return Object.freeze({
        request: null,
        rollback: capturedRollback,
      });
    }
    return Object.freeze({
      request: Object.freeze({
        commit: (previousRoot: Node) => commit.call(request, previousRoot),
        rollback: capturedRollback,
        root: comboBirdRoot,
      }),
      rollback: capturedRollback,
    });
  } catch {
    return Object.freeze({
      request: null,
      rollback: capturedRollback,
    });
  }
}

function captureGnStyleResultMenuNavigationRequest(
  request: unknown,
): CapturedClassicBirdMainMenuNavigationRequest {
  return captureCrazyResultMenuNavigationRequest(request);
}

function captureGnStylePauseQuitNavigationRequest(
  request: unknown,
): CapturedClassicBirdMainMenuNavigationRequest {
  if (request === null || typeof request !== 'object') {
    return Object.freeze({
      request: null,
      rollback: null,
    });
  }
  let capturedRollback: (() => void) | null = null;
  try {
    const candidate = request as Readonly<{
      commit?: unknown;
      gnStyleRoot?: unknown;
      rollback?: unknown;
    }>;
    const rollback = candidate.rollback;
    if (typeof rollback === 'function') {
      capturedRollback = () => rollback.call(request);
    }
    const gnStyleRoot = candidate.gnStyleRoot;
    const commit = candidate.commit;
    if (
      !(gnStyleRoot instanceof Node)
      || !isValid(gnStyleRoot, true)
      || typeof commit !== 'function'
      || capturedRollback === null
    ) {
      return Object.freeze({
        request: null,
        rollback: capturedRollback,
      });
    }
    return Object.freeze({
      request: Object.freeze({
        commit: (previousRoot: Node) => commit.call(request, previousRoot),
        rollback: capturedRollback,
        root: gnStyleRoot,
      }),
      rollback: capturedRollback,
    });
  } catch {
    return Object.freeze({
      request: null,
      rollback: capturedRollback,
    });
  }
}

function rollbackRejectedCrazyNavigationRequest(
  request: unknown,
  source: 'Crazy Pause Quit' | 'Crazy Result',
): void {
  if (request === null || typeof request !== 'object') {
    return;
  }
  try {
    const rollback = (request as Readonly<{ rollback?: unknown }>).rollback;
    if (typeof rollback === 'function') {
      rollback.call(request);
    }
  } catch (error) {
    console.error(normalizeError(error, `Rejected ${source} rollback failed`));
  }
}

function rollbackRejectedClassicBirdNavigationRequest(
  rollback: (() => void) | null,
  source:
    | 'Classic Bird Pause Quit'
    | 'Classic Bird Result'
    | 'Combo Bird Pause Quit'
    | 'Combo Bird Result'
    | 'GN Style Pause Quit'
    | 'GN Style Result',
): readonly Error[] {
  if (rollback === null) {
    return Object.freeze([]);
  }
  return runBestEffortCleanup(
    `Rejected ${source} rollback`,
    [rollback],
  );
}

function rollbackRejectedCapturedNavigationRequest(
  rollback: (() => void) | null,
  source: 'Crazy Bird Pause Quit' | 'Crazy Bird Result',
): readonly Error[] {
  if (rollback === null) {
    return Object.freeze([]);
  }
  return runBestEffortCleanup(
    `Rejected ${source} rollback`,
    [rollback],
  );
}

function commitCrazyMainMenuNavigationRequest(
  request: CrazyMainMenuNavigationRequest,
  previousRoot: Node,
  source:
    | 'Crazy Pause Quit'
    | 'Crazy Result'
    | 'Crazy Bird Pause Quit'
    | 'Crazy Bird Result',
): void {
  try {
    request.commit(previousRoot);
  } catch (error) {
    try {
      // Producer commits are idempotent. A second successful call confirms that the first call
      // crossed its commit point before a post-disposal notification escaped.
      request.commit(previousRoot);
    } catch {
      throw error;
    }
    try {
      console.error(normalizeError(
        error,
        `${source} producer reported an error after committing Main Menu navigation`,
      ));
    } catch {
      // Diagnostics cannot reopen a producer transaction whose idempotent commit was confirmed.
    }
  }
}

function commitClassicBirdMainMenuNavigationRequest(
  request: ClassicBirdMainMenuNavigationRequest,
  previousRoot: Node,
  source:
    | 'Classic Bird Pause Quit'
    | 'Classic Bird Result'
    | 'Combo Bird Pause Quit'
    | 'Combo Bird Result'
    | 'GN Style Pause Quit'
    | 'GN Style Result',
): void {
  try {
    request.commit(previousRoot);
  } catch (error) {
    try {
      request.commit(previousRoot);
    } catch {
      throw error;
    }
    try {
      console.error(normalizeError(
        error,
        `${source} producer reported an error after committing Main Menu navigation`,
      ));
    } catch {
      // Diagnostics cannot reopen a producer transaction whose idempotent commit was confirmed.
    }
  }
}

function aggregateWithPrimaryError(
  label: string,
  primary: unknown,
  secondary: readonly unknown[],
): Error {
  const aggregate = new Error(
    `${label}: ${errorMessage(primary)}; secondary: ${secondary.map(errorMessage).join('; ')}`,
  ) as Error & {
    cause: unknown;
    errors: readonly unknown[];
  };
  aggregate.cause = primary;
  aggregate.errors = Object.freeze([primary, ...secondary]);
  return aggregate;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function containsCrazyLifecycleRollbackError(error: unknown): boolean {
  const pending: unknown[] = [error];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current instanceof CrazyLifecycleRollbackError) {
      return true;
    }
    if (
      current === null
      || (typeof current !== 'object' && typeof current !== 'function')
    ) {
      continue;
    }
    const identity = current as object;
    if (visited.has(identity)) {
      continue;
    }
    visited.add(identity);
    enqueueErrorGraphValue(pending, readErrorGraphValue(identity, 'cause'));
    enqueueErrorGraphValue(pending, readErrorGraphValue(identity, 'errors'));
    enqueueErrorGraphValue(pending, readErrorGraphValue(identity, 'causes'));
    enqueueErrorGraphValue(pending, readErrorGraphValue(identity, 'rollbackErrors'));
  }
  return false;
}

function enqueueErrorGraphValue(pending: unknown[], value: unknown): void {
  if (Array.isArray(value)) {
    pending.push(...value);
  } else if (value !== undefined) {
    pending.push(value);
  }
}

function readErrorGraphValue(value: object, key: string): unknown {
  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
}

function isSignedInt32(value: unknown): value is number {
  return (
    typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= -0x8000_0000
    && value <= 0x7fff_ffff
  );
}

function normalizeError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(`${fallback}: ${String(error)}`);
}

function runBestEffortCleanup(
  label: string,
  operations: readonly (() => unknown)[],
): readonly Error[] {
  const failures: Error[] = [];
  for (const operation of operations) {
    try {
      operation();
    } catch (error) {
      failures.push(normalizeError(error, `${label} operation failed`));
    }
  }
  if (failures.length > 0) {
    console.error(new Error(
      `${label} completed with cleanup failures: ${failures.map(({ message }) => message).join('; ')}`,
    ));
  }
  return Object.freeze(failures);
}
