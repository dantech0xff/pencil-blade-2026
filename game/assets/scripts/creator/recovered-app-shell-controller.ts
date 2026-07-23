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
import { ClassicSceneController } from './classic-scene-controller';
import {
  MainMenuPresenter,
  type MainMenuNavigationTransaction,
  type MainMenuUnsupportedDestination,
} from './main-menu-presenter';
import { loadMainMenuResources, type LoadedMainMenuResources } from './main-menu-resource-loader';
import {
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
  | 'classic'
  | 'destroyed'
  | 'failed'
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

/**
 * Persistent serialized owner for the recovered Boot -> Menu -> Mode Select -> Classic loop.
 * Every top-level screen swap is transactional; unsupported recovered destinations fail closed.
 */
@ccclass('RecoveredAppShellController')
@requireComponent(ClassicGameplayController)
export class RecoveredAppShellController extends Component {
  private activeMainMenu: MainMenuPresenter | null = null;
  private activeModeSelect: ModeSelectPresenter | null = null;
  private bladeInput: BladeInputController | null = null;
  private bootPromise: Promise<void> | null = null;
  private destroyedValue = false;
  private gameplayController: ClassicGameplayController | null = null;
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
  }

  onEnable(): void {
    this.node.on(
      CLASSIC_RESULT_MENU_REQUESTED_EVENT,
      this.onClassicResultMenuRequested,
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

    // Classic performs the first bundle load. The three foreground loaders then reuse the
    // registered bundle instead of racing multiple Creator first-load requests.
    await gameplayController.prepareRecoveredRuntime();
    this.assertBootStillCurrent();
    const assetTree = gameplayController.sharedResourceCatalog.assetTree;
    const [sharedResources, mainMenuResources, modeSelectResources] = await Promise.all([
      loadSharedGameSceneResources(assetTree),
      loadMainMenuResources(assetTree),
      loadModeSelectResources(assetTree),
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
      let collisionFilterReleased = false;
      try {
        const previous = sharedScene.detachCurrentScreen(oldPresenter.root);
        if (previous !== oldPresenter.root || !oldPresenter.suspendForTransition()) {
          throw new Error('Mode Select did not surrender the shared input lease');
        }
        collisionFilterReleased = nonClassicPhysics.restorePreviousCollisionFilter();
        this.requireGameplayController().activateClassicFromAppShell(sharedScene);
      } catch (error) {
        if (collisionFilterReleased && !nonClassicPhysics.collisionFilterActive) {
          nonClassicPhysics.activateCollisionFilter();
        }
        if (sharedScene.currentScreen === null) {
          sharedScene.attachCurrentScreen(oldPresenter.root);
        }
        throw error;
      }
      this.activeModeSelect = null;
      this.stateValue = 'classic';
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

function normalizeError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(`${fallback}: ${String(error)}`);
}

function runBestEffortCleanup(
  label: string,
  operations: readonly (() => unknown)[],
): void {
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
}
