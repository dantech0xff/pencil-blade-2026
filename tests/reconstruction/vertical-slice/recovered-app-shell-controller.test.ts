import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SOURCE = readFileSync(
  `${REPOSITORY_ROOT}/game/assets/scripts/creator/recovered-app-shell-controller.ts`,
  'utf8',
);

test('app shell boots the shared scene into Main Menu before any Classic activation', () => {
  const initialize = extractMethod(SOURCE, 'initializeRecoveredApp');

  assertOrderedSubstrings(initialize, [
    'sceneController.prepareSceneResolution()',
    'createRecoveredAppViewport(appliedResolution)',
    'loadLoadingResources(',
    'appliedResolution.profile.assetTree',
    'LoadingAudioPreloader.create()',
    'LoadingPresenter.create({',
    'this.activeLoading = loading',
    'loading.activate()',
    'gameplayController.prepareRecoveredRuntime()',
    'loading.failure',
    'this.requireCrazyGameplayController()',
    '.prepareCrazyRuntime()',
    'const classicBirdPreparation = crazyPreparation',
    'this.requireClassicBirdGameplayController()',
    '.prepareClassicBirdRuntime()',
    'const crazyBirdPreparation = classicBirdPreparation',
    '.prepareCrazyBirdRuntime()',
    'const comboBirdPreparation = crazyBirdPreparation',
    'this.requireComboBirdGameplayController()',
    '.prepareComboBirdRuntime()',
    'const gnStylePreparation = comboBirdPreparation',
    'this.requireGnStyleGameplayController()',
    '.prepareGnStyleRuntime()',
    'const optionalPreparation = Promise.all([',
    'crazyBirdPreparation,',
    'comboBirdPreparation,',
    'gnStylePreparation,',
    'void optionalPreparation.catch',
    '] = await Promise.race([',
    'optionalPreparation,',
    'loading.completion',
    'SharedLeafPresenter.create({',
    'SharedGameScenePresenter.create({',
    'nonClassicPhysics.activateCollisionFilter()',
    'mainMenu = this.createMainMenuPresenter()',
    'sharedScene.attachCurrentScreen(mainMenu.root)',
    'mainMenu.activate()',
    'this.activeMainMenu = mainMenu',
    "this.stateValue = 'main-menu'",
    'this.activeLoading = null',
    "runBestEffortCleanup('Committed Loading retirement'",
    'loading?.dispose()',
  ]);
  assert.doesNotMatch(initialize, /activateClassicFromAppShell|activateInitialClassic/);
  assert.match(
    SOURCE,
    /const selectedBladeId = gameplay\.sharedSettingsRuntime\.state\.snapshot\.selectedBlade;/,
  );
  assert.match(
    SOURCE,
    /standardBlades:\s*\{\s*selectedBladeId,\s*catalog: gameplay\.sharedResourceCatalog\.standardBlades,\s*\}/s,
  );
});

test('Loading remains a boot sub-owner and teardown/update stay shell-owned', () => {
  const update = extractMethod(SOURCE, 'update');
  const destroy = extractMethod(SOURCE, 'onDestroy');
  const initialize = extractMethod(SOURCE, 'initializeRecoveredApp');

  assert.doesNotMatch(SOURCE, /[| ]'loading'/);
  assertOrderedSubstrings(update, [
    'this.sharedLeaf?.update(deltaSeconds)',
    'this.activeLoading?.update(deltaSeconds)',
    'this.activeMainMenu?.update(deltaSeconds)',
  ]);
  assert.match(destroy, /this\.activeLoading\?\.dispose\(\)/);
  assert.match(destroy, /this\.activeLoading = null/);
  assertOrderedSubstrings(initialize, [
    'await Promise.race([',
    'gameplayController.prepareRecoveredRuntime()',
    'loading.failure',
    'await Promise.race([loading.completion, loading.failure])',
    "this.stateValue = 'main-menu'",
    'this.activeLoading = null',
    "runBestEffortCleanup('Committed Loading retirement'",
  ]);
});

test('Loading update failure disposes the transient owner before boot rejects', async () => {
  const failure = new Error('injected Loading update failure');
  let activateCount = 0;
  let disposeCount = 0;
  const initialize = compileAsyncSourceMethod<
    (this: Record<string, unknown>) => Promise<void>
  >('initializeRecoveredApp', {
    LoadingAudioPreloader: {
      async create() {
        return Object.freeze({});
      },
    },
    LoadingPresenter: {
      create() {
        return {
          activate() {
            activateCount += 1;
          },
          completion: new Promise<void>(() => {}),
          dispose() {
            disposeCount += 1;
          },
          failure: Promise.reject(failure),
        };
      },
    },
    createRecoveredAppViewport: () => Object.freeze({}),
    loadLoadingResources: async () => Object.freeze({}),
    runBestEffortCleanup(_label: string, cleanups: readonly (() => void)[]) {
      for (const cleanup of cleanups) {
        try {
          cleanup();
        } catch {
          // Production cleanup is best-effort.
        }
      }
      return Object.freeze([]);
    },
  });
  const shell: Record<string, unknown> = {
    activeLoading: null,
    assertBootStillCurrent() {},
    node: Object.freeze({}),
    requireGameplayController: () => ({
      prepareRecoveredRuntime: () => new Promise<void>(() => {}),
    }),
    requireSceneController: () => ({
      prepareSceneResolution: () => Object.freeze({
        profile: Object.freeze({ assetTree: '480x800' }),
      }),
    }),
  };

  await assert.rejects(
    initialize.call(shell),
    (error) => error === failure,
  );
  assert.equal(activateCount, 1);
  assert.equal(disposeCount, 1);
  assert.equal(shell.activeLoading, null);
});

test('destroyed shell never starts delayed Classic Bird preparation', async () => {
  const initialize = compileAsyncSourceMethod<
    (this: Record<string, unknown>) => Promise<void>
  >('initializeRecoveredApp', {
    LoadingAudioPreloader: {
      async create() {
        return Object.freeze({});
      },
    },
    LoadingPresenter: {
      create() {
        return {
          activate() {},
          completion: Promise.resolve(),
          dispose() {},
          failure: new Promise<never>(() => {}),
        };
      },
    },
    createRecoveredAppViewport: () => Object.freeze({}),
    loadAboutResources: async () => Object.freeze({}),
    loadLeaderboardResources: async () => Object.freeze({}),
    loadLoadingResources: async () => Object.freeze({}),
    loadMainMenuResources: async () => Object.freeze({}),
    loadModeSelectResources: async () => Object.freeze({}),
    loadObjectivesScreenResources: async () => Object.freeze({}),
    loadOptionsResources: async () => Object.freeze({}),
    loadSharedGameSceneResources: async () => Object.freeze({}),
    runBestEffortCleanup: () => Object.freeze([]),
  });
  let resolveCrazyPreparation: (() => void) | null = null;
  let markCrazyPreparationStarted: (() => void) | null = null;
  const crazyPreparationStarted = new Promise<void>((resolve) => {
    markCrazyPreparationStarted = resolve;
  });
  const crazyPreparation = new Promise<void>((resolve) => {
    resolveCrazyPreparation = resolve;
  });
  let classicBirdPreparationCount = 0;
  const shell: Record<string, unknown> = {
    assertBootStillCurrent() {
      if (this.destroyedValue === true) {
        throw new Error('Recovered app shell boot completed after destruction');
      }
    },
    destroyedValue: false,
    node: Object.freeze({}),
    requireClassicBirdGameplayController: () => ({
      async prepareClassicBirdRuntime() {
        classicBirdPreparationCount += 1;
      },
    }),
    requireCrazyGameplayController: () => ({
      prepareCrazyRuntime() {
        markCrazyPreparationStarted?.();
        return crazyPreparation;
      },
    }),
    requireGameplayController: () => ({
      async prepareRecoveredRuntime() {},
      sharedSettingsRuntime: {
        state: {
          snapshot: Object.freeze({
            selectedBlade: 17,
          }),
        },
      },
      sharedResourceCatalog: {
        assetTree: Object.freeze({}),
        standardBlades: Object.freeze({
          profile(bladeId: number) {
            if (bladeId === 17) {
              return Object.freeze({
                bladeId,
                kind: 'centipede',
                particles: Object.freeze([]),
                resources: Object.freeze({
                  body: Object.freeze({
                    canonicalPath: '480x800/Blades/Centipede/body.png',
                    dimensions: Object.freeze({ height: 40, width: 12 }),
                    spriteFrame: Object.freeze({
                      destroyed: false,
                      label: '480x800/Blades/Centipede/body.png',
                      originalSize: Object.freeze({ height: 40, width: 12 }),
                      rect: Object.freeze({ height: 40, width: 12 }),
                      destroy() {},
                    }),
                  }),
                  bodySegmentCount: 20 as const,
                  head: Object.freeze({
                    canonicalPath: '480x800/Blades/Centipede/head.png',
                    dimensions: Object.freeze({ height: 44, width: 47 }),
                    spriteFrame: Object.freeze({
                      destroyed: false,
                      label: '480x800/Blades/Centipede/head.png',
                      originalSize: Object.freeze({ height: 44, width: 47 }),
                      rect: Object.freeze({ height: 44, width: 47 }),
                      destroy() {},
                    }),
                  }),
                  pointCapacity: 32 as const,
                  tail: Object.freeze({
                    canonicalPath: '480x800/Blades/Centipede/tail.png',
                    dimensions: Object.freeze({ height: 14, width: 51 }),
                    spriteFrame: Object.freeze({
                      destroyed: false,
                      label: '480x800/Blades/Centipede/tail.png',
                      originalSize: Object.freeze({ height: 14, width: 51 }),
                      rect: Object.freeze({ height: 14, width: 51 }),
                      destroy() {},
                    }),
                  }),
                }),
              });
            }
            return Object.freeze({
              bladeId,
              kind: 'basic',
              particles: Object.freeze([]),
              texture: Object.freeze({
                canonicalPath: `480x800/Blades/blade${bladeId}.png`,
                dimensions: Object.freeze({ height: 256, width: 256 }),
                spriteFrame: Object.freeze({
                  destroyed: false,
                  texture: Object.freeze({ canonicalPath: `480x800/Blades/blade${bladeId}.png` }),
                  uv: Object.freeze([0, 1, 1, 1, 0, 0, 1, 0]),
                }),
              }),
            });
          },
        }),
      },
    }),
    requireSceneController: () => ({
      prepareSceneResolution: () => Object.freeze({
        profile: Object.freeze({ assetTree: '480x800' }),
      }),
    }),
  };

  const initialization = initialize.call(shell);
  await crazyPreparationStarted;
  shell.destroyedValue = true;
  resolveCrazyPreparation?.();

  await assert.rejects(
    initialization,
    /Recovered app shell boot completed after destruction/,
  );
  assert.equal(classicBirdPreparationCount, 0);
});

test('optional preparation rejection is observed while foreground loading is still pending', async () => {
  let resolveCrazyPreparation: (() => void) | null = null;
  let resolveForegroundLoading: (() => void) | null = null;
  let markForegroundLoadingStarted: (() => void) | null = null;
  const crazyPreparation = new Promise<void>((resolve) => {
    resolveCrazyPreparation = resolve;
  });
  const foregroundLoading = new Promise<void>((resolve) => {
    resolveForegroundLoading = resolve;
  });
  const foregroundLoadingStarted = new Promise<void>((resolve) => {
    markForegroundLoadingStarted = resolve;
  });
  const loadForegroundResource = async () => {
    markForegroundLoadingStarted?.();
    await foregroundLoading;
    return Object.freeze({});
  };
  const initialize = compileAsyncSourceMethod<
    (this: Record<string, unknown>) => Promise<void>
  >('initializeRecoveredApp', {
    LoadingAudioPreloader: {
      async create() {
        return Object.freeze({});
      },
    },
    LoadingPresenter: {
      create() {
        return {
          activate() {},
          completion: Promise.resolve(),
          dispose() {},
          failure: new Promise<never>(() => {}),
        };
      },
    },
    createRecoveredAppViewport: () => Object.freeze({}),
    loadAboutResources: loadForegroundResource,
    loadLeaderboardResources: loadForegroundResource,
    loadLoadingResources: async () => Object.freeze({}),
    loadMainMenuResources: loadForegroundResource,
    loadModeSelectResources: loadForegroundResource,
    loadObjectivesScreenResources: loadForegroundResource,
    loadOptionsResources: loadForegroundResource,
    loadSharedGameSceneResources: loadForegroundResource,
    runBestEffortCleanup: () => Object.freeze([]),
  });
  const shell: Record<string, unknown> = {
    activeLoading: null,
    assertBootStillCurrent() {
      if (this.destroyedValue === true) {
        throw new Error('Recovered app shell boot completed after destruction');
      }
    },
    destroyedValue: false,
    node: Object.freeze({}),
    requireCrazyGameplayController: () => ({
      prepareCrazyRuntime() {
        return crazyPreparation;
      },
    }),
    requireGameplayController: () => ({
      async prepareRecoveredRuntime() {},
      sharedResourceCatalog: {
        assetTree: Object.freeze({}),
      },
    }),
    requireSceneController: () => ({
      prepareSceneResolution: () => Object.freeze({
        profile: Object.freeze({ assetTree: '480x800' }),
      }),
    }),
  };
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };
  process.on('unhandledRejection', onUnhandled);

  try {
    const initialization = initialize.call(shell);
    await foregroundLoadingStarted;
    shell.destroyedValue = true;
    resolveCrazyPreparation?.();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(
      unhandled,
      [],
      'optional destruction rejection must be observed before foreground loading settles',
    );

    resolveForegroundLoading?.();
    await assert.rejects(
      initialization,
      /Recovered app shell boot completed after destruction/,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
    resolveCrazyPreparation?.();
    resolveForegroundLoading?.();
  }
});

test('serialized shell binds every recovered gameplay navigation event and owner', () => {
  const onLoad = extractMethod(SOURCE, 'onLoad');
  const onEnable = extractMethod(SOURCE, 'onEnable');
  const onDisable = extractMethod(SOURCE, 'onDisable');

  assert.match(SOURCE, /@requireComponent\(CrazyGameplayController\)/);
  assert.match(SOURCE, /@requireComponent\(ClassicBirdGameplayController\)/);
  assert.match(SOURCE, /@requireComponent\(ComboBirdGameplayController\)/);
  assert.match(SOURCE, /@requireComponent\(GnStyleGameplayController\)/);
  assert.match(onLoad, /CrazyGameplayController,[\s\S]*?'CrazyGameplayController'/);
  assert.match(
    onLoad,
    /ClassicBirdGameplayController,[\s\S]*?'ClassicBirdGameplayController'/,
  );
  assert.match(
    onLoad,
    /ComboBirdGameplayController,[\s\S]*?'ComboBirdGameplayController'/,
  );
  assert.match(
    onLoad,
    /GnStyleGameplayController,[\s\S]*?'GnStyleGameplayController'/,
  );
  for (const event of [
    'CRAZY_RESULT_MENU_REQUESTED_EVENT',
    'CRAZY_PAUSE_QUIT_REQUESTED_EVENT',
    'CRAZY_BIRD_RESULT_MENU_REQUESTED_EVENT',
    'CRAZY_BIRD_PAUSE_QUIT_REQUESTED_EVENT',
    'CLASSIC_BIRD_RESULT_MENU_REQUESTED_EVENT',
    'CLASSIC_BIRD_PAUSE_QUIT_REQUESTED_EVENT',
    'COMBO_BIRD_RESULT_MENU_REQUESTED_EVENT',
    'COMBO_BIRD_PAUSE_QUIT_REQUESTED_EVENT',
    'GN_STYLE_RESULT_MENU_REQUESTED_EVENT',
    'GN_STYLE_PAUSE_QUIT_REQUESTED_EVENT',
  ]) {
    assert.match(onEnable, new RegExp(`this\\.node\\.on\\([\\s\\S]*?${event}`));
    assert.match(onDisable, new RegExp(`this\\.node\\.off\\([\\s\\S]*?${event}`));
  }
});

test('Main Menu and Mode Select replacement acquires new input before committed cleanup', () => {
  const toMode = extractMethod(SOURCE, 'transitionMainMenuToModeSelect');
  const toMenu = extractMethod(SOURCE, 'transitionModeSelectToMainMenu');

  for (const method of [toMode, toMenu]) {
    assertOrderedSubstrings(method, [
      'replaceCurrentScreen(nextPresenter.root)',
      'oldPresenter.suspendForTransition()',
      'nextPresenter.activate()',
      'this.stateValue =',
      'disposeCommittedPresenter(oldPresenter',
    ]);
    assert.match(method, /catch \(error\)[\s\S]*?restorePreviousScreen/);
    assert.match(method, /nextPresenter\.dispose\(\)/);
  }
});

test('Main Menu and Options use explicit transactional replacement without stopping menu music', () => {
  const createMainMenu = extractMethod(SOURCE, 'createMainMenuPresenter');
  const createOptions = extractMethod(SOURCE, 'createOptionsPresenter');
  const toOptions = extractMethod(SOURCE, 'transitionMainMenuToOptions');
  const toMenu = extractMethod(SOURCE, 'transitionOptionsToMainMenu');

  assert.match(
    createMainMenu,
    /onOptionsRequested: \(transaction\) => \([\s\S]*?this\.transitionMainMenuToOptions\(transaction\)/,
  );
  assertOrderedSubstrings(createOptions, [
    'OptionsPresenter.create({',
    'audio: gameplay.sharedAudioPresenter',
    'onMainMenuRequested: (transaction)',
    'this.transitionOptionsToMainMenu(transaction)',
    'resources: resources.options',
    'settings: gameplay.sharedSettingsRuntime',
    'currentBackgroundIndex',
    'sharedScene.background.selectedIndex',
    'currentThemeIndex',
    'sharedScene.theme.selectedIndex',
    'selectBackground:',
    'sharedScene.background.select(index)',
    'selectTheme:',
    'sharedScene.theme.select(index)',
  ]);
  for (const method of [toOptions, toMenu]) {
    assertOrderedSubstrings(method, [
      'replaceCurrentScreen(nextPresenter.root)',
      'oldPresenter.suspendForTransition()',
      'nextPresenter.activate()',
      'compensateFailedMenuScreenReplacement(',
      'this.stateValue =',
      'disposeCommittedPresenter(oldPresenter',
    ]);
    assert.doesNotMatch(method, /stopBackgroundMusic/);
  }
  const compensation = extractMethod(
    SOURCE,
    'compensateFailedMenuScreenReplacement',
  );
  assertOrderedSubstrings(compensation, [
    'if (!sourceOwnershipPoisoned)',
    'this.restorePreviousScreen(oldPresenter.root, nextPresenter.root)',
    'nextPresenter.dispose()',
    'oldPresenter.rearmNavigationAfterFailure()',
    'this.releaseFailedMenuScreenOwnership(',
    'oldPresenter.dispose()',
    'new ModeSelectFatalNavigationError(',
  ]);
  assert.match(toOptions, /transaction\.root !== oldPresenter\.root/);
  assert.match(toOptions, /transaction\.destination !== 'OptionsLayer'/);
  assert.match(toOptions, /transaction\.timing !== 'immediate'/);
  assert.match(toOptions, /transaction\.zOrder !== 1/);
  assert.match(toOptions, /this\.activeOptions = nextPresenter/);
  assert.match(toOptions, /this\.stateValue = 'options'/);
  assert.match(toMenu, /transaction\.root !== oldPresenter\.root/);
  assert.match(toMenu, /transaction\.destination !== 'MainMenuLayer'/);
  assert.match(toMenu, /transaction\.timing !== 'immediate'/);
  assert.match(toMenu, /transaction\.zOrder !== 1/);
  assert.match(toMenu, /this\.activeMainMenu = nextPresenter/);
  assert.match(toMenu, /this\.stateValue = 'main-menu'/);
});

for (const route of ['main-menu-to-options', 'options-to-main-menu'] as const) {
  const label = route === 'main-menu-to-options'
    ? 'Main Menu to Options'
    : 'Options to Main Menu';

  test(`${label} activation failure restores the source host and permits caller rearm`, () => {
    const outcome = executeMenuOptionsReplacementFailure(route, false);

    assert.equal(outcome.thrown, null);
    assert.equal(outcome.result, false);
    assert.equal(outcome.state, outcome.sourceState);
    assert.equal(outcome.currentScreen, outcome.sourceRoot);
    assert.equal(outcome.sourceRoot.parent?.activeInHierarchy, true);
    assert.equal(outcome.sourcePresenter.disposed, false);
    assert.equal(outcome.sourcePresenter.suspended, false);
    assert.equal(outcome.sourcePresenter.inputLeaseHeld, true);
    assert.equal(outcome.sourcePresenter.rearmSuccessCount, 1);
    assert.equal(outcome.destinationPresenter.disposed, true);
    assert.equal(outcome.transitionFailureCount, 1);
  });

  test(`${label} incomplete rollback fails closed and keeps the source lease quiescent`, () => {
    const outcome = executeMenuOptionsReplacementFailure(route, true);

    assert.ok(outcome.thrown instanceof ExecutableModeSelectFatalNavigationError);
    assert.equal(outcome.result, null);
    assert.equal(outcome.state, 'failed');
    assert.equal(outcome.currentScreen, null);
    assert.equal(outcome.sourceRoot.parent, null);
    assert.equal(outcome.sourcePresenter.disposed, true);
    assert.equal(outcome.sourcePresenter.suspended, true);
    assert.equal(outcome.sourcePresenter.inputLeaseHeld, false);
    assert.equal(outcome.sourcePresenter.rearmAttemptCount, 0);
    assert.equal(outcome.sourcePresenter.rearmSuccessCount, 0);
    assert.equal(outcome.destinationPresenter.disposed, true);
    assert.equal(outcome.activeMainMenu, null);
    assert.equal(outcome.activeOptions, null);
    assert.equal(outcome.transitionFailureCount, 1);
    assert.match(
      String(outcome.thrown),
      /rollback is incomplete[\s\S]*injected screen restoration failure/,
    );
  });
}

test('app shell loads, creates, updates, and tears down its local-only About owner', () => {
  const initialize = extractMethod(SOURCE, 'initializeRecoveredApp');
  const createMainMenu = extractMethod(SOURCE, 'createMainMenuPresenter');
  const createAbout = extractMethod(SOURCE, 'createAboutPresenter');
  const update = extractMethod(SOURCE, 'update');
  const destroy = extractMethod(SOURCE, 'onDestroy');

  assert.match(
    SOURCE,
    /import \{\s*AboutPresenter,\s*type AboutNavigationTransaction,\s*type AboutRetiredActionEvent,/,
  );
  assert.match(SOURCE, /loadAboutResources,\s*type LoadedAboutResources,/);
  assert.match(SOURCE, /\| 'about'/);
  assert.match(SOURCE, /readonly about: LoadedAboutResources/);
  assert.match(SOURCE, /private activeAbout: AboutPresenter \| null = null/);
  assertOrderedSubstrings(initialize, [
    'loadAboutResources(assetTree)',
    'about: aboutResources',
    'mainMenu = this.createMainMenuPresenter()',
  ]);
  assert.match(
    createMainMenu,
    /onAboutRequested: \(transaction\) => \([\s\S]*?this\.transitionMainMenuToAbout\(transaction\)/,
  );
  assertOrderedSubstrings(createAbout, [
    'const settingsState = gameplay.sharedSettingsRuntime.state',
    'AboutPresenter.create({',
    'audio: gameplay.sharedAudioPresenter',
    'canvas: this.node',
    'onMainMenuRequested: (transaction)',
    'this.transitionAboutToMainMenu(transaction)',
    'onRetiredAction: (event)',
    'this.emitRetiredPlatformAction(event)',
    'localCompatibilityAvailable: false',
    'rated: settingsState.snapshot.rated',
    'random: gameplay.sharedGameplayRandom',
    'resources: resources.about',
    'effectsEnabled: () => settingsState.snapshot.effectsEnabled',
    'viewport: this.requireViewport()',
  ]);
  assert.doesNotMatch(
    createAbout,
    /networkAvailable|fetch\(|XMLHttpRequest|openURL|mailto:|https?:|platformReview/,
  );
  assert.match(update, /this\.activeAbout\?\.update\(deltaSeconds\)/);
  assertOrderedSubstrings(destroy, [
    'this.activeAbout?.dispose()',
    'this.activeAbout = null',
    'this.resources = null',
  ]);
  assert.match(
    initialize,
    /catch \(error\)[\s\S]*?this\.activeAbout = null;[\s\S]*?this\.resources = null;/,
  );
});

test('Main Menu and About use exact immediate z1 transactions and fresh ownership', () => {
  const toAbout = extractMethod(SOURCE, 'transitionMainMenuToAbout');
  const toMainMenu = extractMethod(SOURCE, 'transitionAboutToMainMenu');

  assertOrderedSubstrings(toAbout, [
    "transaction.destination !== 'AboutLayer'",
    "transaction.timing !== 'immediate'",
    'transaction.zOrder !== 1',
    "this.runTransition('main-menu', 'about'",
    'this.createAboutPresenter()',
    'replaceCurrentScreen(nextPresenter.root)',
    'oldPresenter.suspendForTransition()',
    'nextPresenter.activate()',
    'this.compensateFailedMenuScreenReplacement(',
    'oldPresenter.state.poisoned',
    'this.activeMainMenu = null',
    'this.activeAbout = nextPresenter',
    "this.stateValue = 'about'",
    "disposeCommittedPresenter(oldPresenter, 'Main Menu')",
  ]);
  assertOrderedSubstrings(toMainMenu, [
    "transaction.destination !== 'MainMenuLayer'",
    "transaction.timing !== 'immediate'",
    'transaction.zOrder !== 1',
    "this.runTransition('about', 'main-menu'",
    'this.createMainMenuPresenter()',
    'replaceCurrentScreen(nextPresenter.root)',
    'oldPresenter.suspendForTransition()',
    'nextPresenter.activate()',
    'this.compensateFailedMenuScreenReplacement(',
    'oldPresenter.state.poisoned',
    'this.activeAbout = null',
    'this.activeMainMenu = nextPresenter',
    "this.stateValue = 'main-menu'",
    "disposeCommittedPresenter(oldPresenter, 'About')",
  ]);
  for (const transition of [toAbout, toMainMenu]) {
    assert.match(transition, /transaction\.root !== oldPresenter\.root/);
    assert.doesNotMatch(
      transition,
      /menubuttonclick|playOneShot|playEffect|stopBackgroundMusic/,
    );
  }
});

test('app shell boots, snapshots, updates, and tears down its Leaderboard owner', () => {
  const initialize = extractMethod(SOURCE, 'initializeRecoveredApp');
  const create = extractMethod(SOURCE, 'createLeaderboardPresenter');
  const update = extractMethod(SOURCE, 'update');
  const destroy = extractMethod(SOURCE, 'onDestroy');

  assert.match(SOURCE, /import \{\s*LeaderboardPresenter,\s*type LeaderboardNavigationTransaction,/);
  assert.match(
    SOURCE,
    /loadLeaderboardResources,\s*type LoadedLeaderboardResources,/,
  );
  assert.match(SOURCE, /\| 'leaderboard'/);
  assert.match(SOURCE, /readonly leaderboard: LoadedLeaderboardResources/);
  assert.match(SOURCE, /private activeLeaderboard: LeaderboardPresenter \| null = null/);
  assertOrderedSubstrings(initialize, [
    'loadLeaderboardResources(assetTree)',
    'leaderboard: leaderboardResources',
    'mainMenu = this.createMainMenuPresenter()',
  ]);
  assertOrderedSubstrings(create, [
    'const settingsState = gameplay.sharedSettingsRuntime.state',
    'const settingsSnapshot = settingsState.snapshot',
    'LeaderboardPresenter.create({',
    'audio: gameplay.sharedAudioPresenter',
    'bladeInput: this.requireBladeInput()',
    'canvas: this.node',
    'onMainMenuRequested: (transaction)',
    'this.transitionLeaderboardToMainMenu(transaction)',
    'resources: resources.leaderboard',
    'settings: Object.freeze({',
    'effectsEnabled: () => settingsState.snapshot.effectsEnabled',
    'classic: settingsSnapshot.leaderboard',
    'crazy: settingsSnapshot.crazyLeaderboard',
    'gnStyle: settingsState.gnStyleLeaderboard',
    'classicBird: settingsState.birdClassicLeaderboard',
    'crazyBird: settingsState.birdCrazyLeaderboard',
    'comboBird: settingsState.birdComboLeaderboard',
    'viewport: this.requireViewport()',
  ]);
  assert.doesNotMatch(create, /\.save\(|record.*Result|networkAvailable/);
  assert.match(update, /this\.activeLeaderboard\?\.update\(deltaSeconds\)/);
  assertOrderedSubstrings(destroy, [
    'this.activeLeaderboard?.dispose()',
    'this.activeLeaderboard = null',
    'this.resources = null',
  ]);
});

test('app shell boots a fresh Objectives manager with a persistent achievement host', () => {
  const initialize = extractMethod(SOURCE, 'initializeRecoveredApp');
  const createMainMenu = extractMethod(SOURCE, 'createMainMenuPresenter');
  const create = extractMethod(SOURCE, 'createObjectivesPresenter');
  const createModeSelect = extractMethod(SOURCE, 'createModeSelectPresenter');
  const update = extractMethod(SOURCE, 'update');
  const destroy = extractMethod(SOURCE, 'onDestroy');

  assert.match(
    SOURCE,
    /import \{\s*ObjectivesScreenPresenter,\s*type ObjectivesScreenNavigationTransaction,/,
  );
  assert.match(
    SOURCE,
    /loadObjectivesScreenResources,\s*type LoadedObjectivesScreenResources,/,
  );
  assert.match(SOURCE, /\| 'objectives'/);
  assert.match(SOURCE, /readonly objectives: LoadedObjectivesScreenResources/);
  assert.match(
    SOURCE,
    /private activeObjectives: ObjectivesScreenPresenter \| null = null/,
  );
  assertOrderedSubstrings(initialize, [
    'loadObjectivesScreenResources(assetTree)',
    'objectives: objectivesResources',
    'ObjectiveAchievementHost.create({',
    'createPresenter: (event) => ObjectiveAchievementPresenter.create({',
    'resources: gameplayController.sharedBaseGameplayResources',
    'playCheer: () => gameplayController.sharedAudioPresenter.playOneShot(',
    'CLASSIC_OBJECTIVE_CHEER_AUDIO_PATH',
    '.createObjectivesManager(objectiveAchievementHost.onPopup)',
    'this.objectiveAchievementHost = objectiveAchievementHost',
    'this.objectivesManager = objectivesManager',
    'mainMenu = this.createMainMenuPresenter()',
  ]);
  assertOrderedSubstrings(create, [
    'const settingsState = gameplay.sharedSettingsRuntime.state',
    'ObjectivesScreenPresenter.create({',
    'audio: gameplay.sharedAudioPresenter',
    'bladeInput: this.requireBladeInput()',
    'canvas: this.node',
    'onFatalOwnership: (error)',
    'this.recoverFromObjectivesFatalOwnership(presenter, error)',
    'onMainMenuRequested: (transaction)',
    'this.transitionObjectivesToMainMenu(transaction)',
    'manager: this.requireObjectivesManager()',
    'resources: resources.objectives',
    'effectsEnabled: () => settingsState.snapshot.effectsEnabled',
    'viewport: this.requireViewport()',
  ]);
  assert.match(createMainMenu, /objectives: this\.requireObjectivesManager\(\)/);
  assert.match(createModeSelect, /objectives: this\.requireObjectivesManager\(\)/);
  assert.doesNotMatch(
    [createMainMenu, create, createModeSelect].join('\n'),
    /sharedObjectivesManager/,
  );
  assertOrderedSubstrings(update, [
    'this.objectiveAchievementHost?.update(deltaSeconds)',
    'this.activeObjectives?.update(deltaSeconds)',
  ]);
  assert.match(update, /this\.activeObjectives\?\.update\(deltaSeconds\)/);
  assertOrderedSubstrings(destroy, [
    'this.activeObjectives?.dispose()',
    'this.objectiveAchievementHost?.dispose()',
    'this.activeObjectives = null',
    'this.objectiveAchievementHost = null',
    'this.objectivesManager = null',
    'this.resources = null',
  ]);
});

test('app shell snapshots six boards once but defers effects gating to accepted Back', () => {
  const board = (
    first: number,
    second: number,
    third: number,
  ): Readonly<{ readonly first: number; readonly second: number; readonly third: number }> => (
    Object.freeze({ first, second, third })
  );
  const classic = board(3, 2, 1);
  const crazy = board(6, 5, 4);
  const gnStyle = board(9, 8, 7);
  const classicBird = board(12, 11, 10);
  const crazyBird = board(15, 14, 13);
  const comboBird = board(18, 17, 16);
  let effectsEnabled = true;
  let snapshotReadCount = 0;
  const settingsState = {
    birdClassicLeaderboard: classicBird,
    birdComboLeaderboard: comboBird,
    birdCrazyLeaderboard: crazyBird,
    get snapshot() {
      snapshotReadCount += 1;
      return Object.freeze({
        crazyLeaderboard: crazy,
        effectsEnabled,
        leaderboard: classic,
      });
    },
    gnStyleLeaderboard: gnStyle,
  };
  const create = compileSourceMethod<
    (this: Record<string, unknown>) => Readonly<{
      readonly settings: Readonly<{
        readonly classic: unknown;
        readonly classicBird: unknown;
        readonly comboBird: unknown;
        readonly crazy: unknown;
        readonly crazyBird: unknown;
        readonly effectsEnabled: () => boolean;
        readonly gnStyle: unknown;
      }>;
    }>
  >('createLeaderboardPresenter', {
    LeaderboardPresenter: {
      create(input: unknown) {
        return input;
      },
    },
  });
  const shell: Record<string, unknown> = {
    node: Object.freeze({}),
    requireBladeInput: () => Object.freeze({}),
    requireGameplayController: () => Object.freeze({
      sharedAudioPresenter: Object.freeze({}),
      sharedSettingsRuntime: Object.freeze({ state: settingsState }),
    }),
    requireResources: () => Object.freeze({
      leaderboard: Object.freeze({}),
    }),
    requireViewport: () => Object.freeze({}),
    transitionLeaderboardToMainMenu: () => true,
  };

  const input = create.call(shell);
  assert.equal(snapshotReadCount, 1);
  assert.equal(Object.isFrozen(input.settings), true);
  assert.deepEqual(
    {
      classic: input.settings.classic,
      classicBird: input.settings.classicBird,
      comboBird: input.settings.comboBird,
      crazy: input.settings.crazy,
      crazyBird: input.settings.crazyBird,
      gnStyle: input.settings.gnStyle,
    },
    { classic, classicBird, comboBird, crazy, crazyBird, gnStyle },
  );

  effectsEnabled = false;
  assert.equal(input.settings.effectsEnabled(), false);
  assert.equal(snapshotReadCount, 2);
});

test('Main Menu and Leaderboard use exact delayed/immediate transactional routes', () => {
  const createMainMenu = extractMethod(SOURCE, 'createMainMenuPresenter');
  const toLeaderboard = extractMethod(SOURCE, 'transitionMainMenuToLeaderboard');
  const toMainMenu = extractMethod(SOURCE, 'transitionLeaderboardToMainMenu');

  assert.match(
    createMainMenu,
    /onLeaderboardRequested: \(transaction\) => \([\s\S]*?this\.transitionMainMenuToLeaderboard\(transaction\)/,
  );
  assertOrderedSubstrings(toLeaderboard, [
    "transaction.destination !== 'LeaderboardLayer'",
    "transaction.timing !== 'delayed'",
    'transaction.zOrder !== 1',
    "this.runTransition('main-menu', 'leaderboard'",
    'this.createLeaderboardPresenter()',
    'replaceCurrentScreen(nextPresenter.root)',
    'oldPresenter.suspendForTransition()',
    'nextPresenter.activate()',
    'this.compensateFailedMenuScreenReplacement(',
    'oldPresenter.state.poisoned',
    'this.activeMainMenu = null',
    'this.activeLeaderboard = nextPresenter',
    "this.stateValue = 'leaderboard'",
    "disposeCommittedPresenter(oldPresenter, 'Main Menu')",
  ]);
  assertOrderedSubstrings(toMainMenu, [
    "transaction.destination !== 'MainMenuLayer'",
    "transaction.timing !== 'immediate'",
    'transaction.zOrder !== 1',
    "this.runTransition('leaderboard', 'main-menu'",
    'this.createMainMenuPresenter()',
    'replaceCurrentScreen(nextPresenter.root)',
    'oldPresenter.suspendForTransition()',
    'nextPresenter.activate()',
    'this.compensateFailedMenuScreenReplacement(',
    'oldPresenter.state.poisoned',
    'this.activeLeaderboard = null',
    'this.activeMainMenu = nextPresenter',
    "this.stateValue = 'main-menu'",
    "disposeCommittedPresenter(oldPresenter, 'Leaderboard')",
  ]);
  for (const transition of [toLeaderboard, toMainMenu]) {
    assert.match(transition, /transaction\.root !== oldPresenter\.root/);
    assert.doesNotMatch(
      transition,
      /menubuttonclick|playOneShot|playEffect|stopBackgroundMusic/,
    );
  }
});

test('Main Menu and Objectives use exact delayed/immediate transactional routes', () => {
  const createMainMenu = extractMethod(SOURCE, 'createMainMenuPresenter');
  const toObjectives = extractMethod(SOURCE, 'transitionMainMenuToObjectives');
  const toMainMenu = extractMethod(SOURCE, 'transitionObjectivesToMainMenu');

  assert.match(
    createMainMenu,
    /onObjectivesRequested: \(transaction\) => \([\s\S]*?this\.transitionMainMenuToObjectives\(transaction\)/,
  );
  assertOrderedSubstrings(toObjectives, [
    "transaction.destination !== 'ObjectivesLayer'",
    "transaction.timing !== 'delayed'",
    'transaction.zOrder !== 1',
    "this.runTransition('main-menu', 'objectives'",
    'this.createObjectivesPresenter()',
    'replaceCurrentScreen(nextPresenter.root)',
    'oldPresenter.suspendForTransition()',
    'nextPresenter.activate()',
    'this.compensateFailedMenuScreenReplacement(',
    'oldPresenter.state.poisoned',
    'this.activeMainMenu = null',
    'this.activeObjectives = nextPresenter',
    "this.stateValue = 'objectives'",
    "disposeCommittedPresenter(oldPresenter, 'Main Menu')",
  ]);
  assertOrderedSubstrings(toMainMenu, [
    "transaction.destination !== 'MainMenuLayer'",
    "transaction.timing !== 'immediate'",
    'transaction.zOrder !== 1',
    "this.runTransition('objectives', 'main-menu'",
    'this.createMainMenuPresenter()',
    'replaceCurrentScreen(nextPresenter.root)',
    'oldPresenter.suspendForTransition()',
    'nextPresenter.activate()',
    'this.compensateFailedMenuScreenReplacement(',
    'oldPresenter.state.poisoned',
    'this.activeObjectives = null',
    'this.activeMainMenu = nextPresenter',
    "this.stateValue = 'main-menu'",
    "disposeCommittedPresenter(oldPresenter, 'Objectives')",
  ]);
  for (const transition of [toObjectives, toMainMenu]) {
    assert.match(transition, /transaction\.root !== oldPresenter\.root/);
    assert.doesNotMatch(
      transition,
      /menubuttonclick|playOneShot|playEffect|stopBackgroundMusic/,
    );
  }
});

for (const route of [
  'main-menu-to-about',
  'about-to-main-menu',
  'main-menu-to-leaderboard',
  'leaderboard-to-main-menu',
  'main-menu-to-objectives',
  'objectives-to-main-menu',
] as const) {
  const label = executableMenuScreenRouteLabel(route);

  test(`${label} commits only after destination activation`, () => {
    const outcome = executeMenuScreenReplacement(route, false, false);

    assert.equal(outcome.thrown, null);
    assert.equal(outcome.result, true);
    assert.equal(outcome.state, outcome.destinationState);
    assert.equal(outcome.currentScreen, outcome.destinationPresenter.root);
    assert.equal(outcome.sourceRoot.parent, null);
    assert.equal(outcome.sourcePresenter.disposed, true);
    assert.equal(outcome.sourcePresenter.inputLeaseHeld, false);
    assert.equal(outcome.destinationPresenter.disposed, false);
    assert.equal(outcome.destinationPresenter.inputLeaseHeld, true);
    assert.equal(outcome.destinationPresenter.activationCount, 1);
    assert.equal(
      outcome.activeAbout,
      outcome.destinationState === 'about' ? outcome.destinationPresenter : null,
    );
    assert.equal(outcome.transitionFailureCount, 0);
  });

  test(`${label} activation failure restores the same source and permits rearm`, () => {
    const outcome = executeMenuScreenReplacement(route, true, false);

    assert.equal(outcome.thrown, null);
    assert.equal(outcome.result, false);
    assert.equal(outcome.state, outcome.sourceState);
    assert.equal(outcome.currentScreen, outcome.sourceRoot);
    assert.equal(outcome.sourceRoot.parent?.activeInHierarchy, true);
    assert.equal(outcome.sourcePresenter.disposed, false);
    assert.equal(outcome.sourcePresenter.suspended, false);
    assert.equal(outcome.sourcePresenter.inputLeaseHeld, true);
    assert.equal(outcome.sourcePresenter.rearmSuccessCount, 1);
    assert.equal(outcome.destinationPresenter.disposed, true);
    assert.equal(outcome.transitionFailureCount, 1);
  });

  test(`${label} incomplete rollback clears the correct active owner`, () => {
    const outcome = executeMenuScreenReplacement(route, true, true);

    assert.ok(outcome.thrown instanceof ExecutableModeSelectFatalNavigationError);
    assert.equal(outcome.result, null);
    assert.equal(outcome.state, 'failed');
    assert.equal(outcome.currentScreen, null);
    assert.equal(outcome.sourceRoot.parent, null);
    assert.equal(outcome.sourcePresenter.disposed, true);
    assert.equal(outcome.sourcePresenter.suspended, true);
    assert.equal(outcome.sourcePresenter.inputLeaseHeld, false);
    assert.equal(outcome.destinationPresenter.disposed, true);
    assert.equal(outcome.activeAbout, null);
    assert.equal(outcome.activeLeaderboard, null);
    assert.equal(outcome.activeMainMenu, null);
    assert.equal(outcome.activeObjectives, null);
    assert.equal(outcome.activeOptions, null);
    assert.equal(outcome.transitionFailureCount, 1);
  });
}

for (const route of [
  'main-menu-to-about',
  'about-to-main-menu',
  'main-menu-to-leaderboard',
  'leaderboard-to-main-menu',
  'main-menu-to-objectives',
  'objectives-to-main-menu',
] as const) {
  const label = executableMenuScreenRouteLabel(route);

  test(`${label} destination creation failure leaves the source untouched`, () => {
    const outcome = executeMenuScreenReplacement(
      route,
      false,
      false,
      { creationFails: true },
    );

    assert.equal(outcome.thrown, null);
    assert.equal(outcome.result, false);
    assert.equal(outcome.state, outcome.sourceState);
    assert.equal(outcome.currentScreen, outcome.sourceRoot);
    assert.equal(outcome.sourcePresenter.disposed, false);
    assert.equal(outcome.sourcePresenter.suspended, false);
    assert.equal(outcome.sourcePresenter.inputLeaseHeld, true);
    assert.equal(outcome.sourcePresenter.rearmSuccessCount, 1);
    assert.equal(outcome.destinationPresenter.activationCount, 0);
    assert.equal(outcome.destinationPresenter.disposed, false);
    assert.equal(outcome.transitionFailureCount, 1);
  });

  test(`${label} initial replacement failure disposes only the attempted destination`, () => {
    const outcome = executeMenuScreenReplacement(
      route,
      false,
      false,
      { initialReplacementFails: true },
    );

    assert.equal(outcome.thrown, null);
    assert.equal(outcome.result, false);
    assert.equal(outcome.state, outcome.sourceState);
    assert.equal(outcome.currentScreen, outcome.sourceRoot);
    assert.equal(outcome.sourcePresenter.disposed, false);
    assert.equal(outcome.sourcePresenter.suspended, false);
    assert.equal(outcome.sourcePresenter.inputLeaseHeld, true);
    assert.equal(outcome.sourcePresenter.rearmSuccessCount, 1);
    assert.equal(outcome.destinationPresenter.activationCount, 0);
    assert.equal(outcome.destinationPresenter.disposed, true);
    assert.equal(outcome.transitionFailureCount, 1);
  });

  test(`${label} attempted destination disposal failure triggers fatal cleanup`, () => {
    const outcome = executeMenuScreenReplacement(
      route,
      true,
      false,
      { destinationDisposeFailures: 1 },
    );

    assert.ok(outcome.thrown instanceof ExecutableModeSelectFatalNavigationError);
    assert.equal(outcome.result, null);
    assert.equal(outcome.state, 'failed');
    assert.equal(outcome.currentScreen, null);
    assert.equal(outcome.sourceRoot.parent, null);
    assert.equal(outcome.sourcePresenter.disposed, true);
    assert.equal(outcome.sourcePresenter.inputLeaseHeld, false);
    assert.equal(outcome.sourcePresenter.rearmSuccessCount, 0);
    assert.equal(outcome.destinationPresenter.activationCount, 1);
    assert.equal(outcome.destinationPresenter.disposed, true);
    assert.equal(outcome.activeAbout, null);
    assert.equal(outcome.activeLeaderboard, null);
    assert.equal(outcome.activeMainMenu, null);
    assert.equal(outcome.activeObjectives, null);
    assert.equal(outcome.activeOptions, null);
    assert.equal(outcome.transitionFailureCount, 1);
  });

  test(`${label} source rearm failure is fatal and clears both screen owners`, () => {
    const outcome = executeMenuScreenReplacement(
      route,
      true,
      false,
      { rearmFails: true },
    );

    assert.ok(outcome.thrown instanceof ExecutableModeSelectFatalNavigationError);
    assert.equal(outcome.result, null);
    assert.equal(outcome.state, 'failed');
    assert.equal(outcome.currentScreen, null);
    assert.equal(outcome.sourceRoot.parent, null);
    assert.equal(outcome.sourcePresenter.disposed, true);
    assert.equal(outcome.sourcePresenter.inputLeaseHeld, false);
    assert.equal(outcome.sourcePresenter.rearmAttemptCount, 1);
    assert.equal(outcome.sourcePresenter.rearmSuccessCount, 0);
    assert.equal(outcome.destinationPresenter.activationCount, 1);
    assert.equal(outcome.destinationPresenter.disposed, true);
    assert.equal(outcome.activeAbout, null);
    assert.equal(outcome.activeLeaderboard, null);
    assert.equal(outcome.activeMainMenu, null);
    assert.equal(outcome.activeObjectives, null);
    assert.equal(outcome.activeOptions, null);
    assert.equal(outcome.transitionFailureCount, 1);
  });
}

for (const route of [
  'main-menu-to-about',
  'about-to-main-menu',
  'main-menu-to-leaderboard',
  'leaderboard-to-main-menu',
  'main-menu-to-objectives',
  'objectives-to-main-menu',
] as const) {
  const label = executableMenuScreenRouteLabel(route);

  test(`${label} poisoned source suspension fails closed without rearm or activation`, () => {
    const outcome = executeMenuScreenReplacement(
      route,
      false,
      false,
      { suspensionFails: true },
    );

    assert.ok(outcome.thrown instanceof ExecutableModeSelectFatalNavigationError);
    assert.equal(outcome.result, null);
    assert.equal(outcome.state, 'failed');
    assert.equal(outcome.currentScreen, null);
    assert.equal(outcome.sourceRoot.parent, null);
    assert.equal(outcome.sourcePresenter.poisoned, true);
    assert.equal(outcome.sourcePresenter.disposed, true);
    assert.equal(outcome.sourcePresenter.inputLeaseHeld, false);
    assert.equal(outcome.sourcePresenter.rearmAttemptCount, 0);
    assert.equal(outcome.sourcePresenter.rearmSuccessCount, 0);
    assert.equal(outcome.destinationPresenter.activationCount, 0);
    assert.equal(outcome.destinationPresenter.disposed, true);
    assert.equal(outcome.activeAbout, null);
    assert.equal(outcome.activeLeaderboard, null);
    assert.equal(outcome.activeMainMenu, null);
    assert.equal(outcome.activeObjectives, null);
    assert.equal(outcome.activeOptions, null);
    assert.equal(outcome.transitionFailureCount, 1);
  });
}

test('About, Leaderboard, and Objectives transitions reject stale roots before mutation', () => {
  for (const methodName of [
    'transitionMainMenuToAbout',
    'transitionAboutToMainMenu',
    'transitionMainMenuToLeaderboard',
    'transitionLeaderboardToMainMenu',
    'transitionMainMenuToObjectives',
    'transitionObjectivesToMainMenu',
  ] as const) {
    const transition = extractMethod(SOURCE, methodName);
    assertOrderedSubstrings(transition, [
      'const oldPresenter = this.active',
      'oldPresenter === null',
      'transaction.root !== oldPresenter.root',
      'return false',
      'this.runTransition(',
    ]);
  }
  const runTransition = extractMethod(SOURCE, 'runTransition');
  assert.match(
    runTransition,
    /this\.destroyedValue \|\| this\.transitioning \|\| this\.stateValue !== from/,
  );
});

test('About route guards reject stale, inexact, and reentrant transactions before mutation', () => {
  const toAbout = compileSourceMethod<
    (this: Record<string, unknown>, transaction: Record<string, unknown>) => boolean
  >('transitionMainMenuToAbout');
  const toMainMenu = compileSourceMethod<
    (this: Record<string, unknown>, transaction: Record<string, unknown>) => boolean
  >('transitionAboutToMainMenu');
  const sourceRoot = new ExecutableScreenNode();
  const staleRoot = new ExecutableScreenNode();
  const sourcePresenter = { root: sourceRoot };
  let runCount = 0;
  const shell: Record<string, unknown> = {
    activeAbout: sourcePresenter,
    activeMainMenu: sourcePresenter,
    runTransition() {
      runCount += 1;
      return false;
    },
  };

  for (const transaction of [
    { destination: 'AboutLayer', root: staleRoot, timing: 'immediate', zOrder: 1 },
    { destination: 'OptionsLayer', root: sourceRoot, timing: 'immediate', zOrder: 1 },
    { destination: 'AboutLayer', root: sourceRoot, timing: 'delayed', zOrder: 1 },
    { destination: 'AboutLayer', root: sourceRoot, timing: 'immediate', zOrder: 2 },
  ]) {
    assert.equal(toAbout.call(shell, transaction), false);
  }
  for (const transaction of [
    { destination: 'MainMenuLayer', root: staleRoot, timing: 'immediate', zOrder: 1 },
    { destination: 'AboutLayer', root: sourceRoot, timing: 'immediate', zOrder: 1 },
    { destination: 'MainMenuLayer', root: sourceRoot, timing: 'delayed', zOrder: 1 },
    { destination: 'MainMenuLayer', root: sourceRoot, timing: 'immediate', zOrder: 2 },
  ]) {
    assert.equal(toMainMenu.call(shell, transaction), false);
  }
  assert.equal(runCount, 0);

  assert.equal(toAbout.call(shell, {
    destination: 'AboutLayer',
    root: sourceRoot,
    timing: 'immediate',
    zOrder: 1,
  }), false);
  assert.equal(toMainMenu.call(shell, {
    destination: 'MainMenuLayer',
    root: sourceRoot,
    timing: 'immediate',
    zOrder: 1,
  }), false);
  assert.equal(runCount, 2);

  const normalizeError = compileSourceFunction<
    (error: unknown, fallback: string) => Error
  >('normalizeError');
  const runTransition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      from: string,
      to: string,
      operation: () => boolean,
    ) => boolean
  >('runTransition', {
    console: { error() {} },
    ModeSelectFatalNavigationError: ExecutableModeSelectFatalNavigationError,
    normalizeError,
  });
  let operationCount = 0;
  const transitionShell = {
    destroyedValue: false,
    emitTransitionFailure() {},
    stateValue: 'main-menu',
    transitioning: true,
  };
  assert.equal(runTransition.call(
    transitionShell,
    'main-menu',
    'about',
    () => {
      operationCount += 1;
      return true;
    },
  ), false);
  transitionShell.transitioning = false;
  transitionShell.stateValue = 'about';
  assert.equal(runTransition.call(
    transitionShell,
    'main-menu',
    'about',
    () => {
      operationCount += 1;
      return true;
    },
  ), false);
  assert.equal(operationCount, 0);
});

test('Leaderboard route guards and runTransition reject wrong or reentrant requests', () => {
  const toLeaderboard = compileSourceMethod<
    (this: Record<string, unknown>, transaction: Record<string, unknown>) => boolean
  >('transitionMainMenuToLeaderboard');
  const toMainMenu = compileSourceMethod<
    (this: Record<string, unknown>, transaction: Record<string, unknown>) => boolean
  >('transitionLeaderboardToMainMenu');
  const sourceRoot = new ExecutableScreenNode();
  const staleRoot = new ExecutableScreenNode();
  const sourcePresenter = { root: sourceRoot };
  let runCount = 0;
  const shell: Record<string, unknown> = {
    activeLeaderboard: sourcePresenter,
    activeMainMenu: sourcePresenter,
    runTransition() {
      runCount += 1;
      return false;
    },
  };

  for (const transaction of [
    {
      destination: 'LeaderboardLayer',
      root: staleRoot,
      timing: 'delayed',
      zOrder: 1,
    },
    {
      destination: 'ModeSelectLayer',
      root: sourceRoot,
      timing: 'delayed',
      zOrder: 1,
    },
    {
      destination: 'LeaderboardLayer',
      root: sourceRoot,
      timing: 'immediate',
      zOrder: 1,
    },
    {
      destination: 'LeaderboardLayer',
      root: sourceRoot,
      timing: 'delayed',
      zOrder: 2,
    },
  ]) {
    assert.equal(toLeaderboard.call(shell, transaction), false);
  }
  for (const transaction of [
    {
      destination: 'MainMenuLayer',
      root: staleRoot,
      timing: 'immediate',
      zOrder: 1,
    },
    {
      destination: 'LeaderboardLayer',
      root: sourceRoot,
      timing: 'immediate',
      zOrder: 1,
    },
    {
      destination: 'MainMenuLayer',
      root: sourceRoot,
      timing: 'delayed',
      zOrder: 1,
    },
    {
      destination: 'MainMenuLayer',
      root: sourceRoot,
      timing: 'immediate',
      zOrder: 2,
    },
  ]) {
    assert.equal(toMainMenu.call(shell, transaction), false);
  }
  assert.equal(runCount, 0);

  assert.equal(toLeaderboard.call(shell, {
    destination: 'LeaderboardLayer',
    root: sourceRoot,
    timing: 'delayed',
    zOrder: 1,
  }), false);
  assert.equal(toMainMenu.call(shell, {
    destination: 'MainMenuLayer',
    root: sourceRoot,
    timing: 'immediate',
    zOrder: 1,
  }), false);
  assert.equal(runCount, 2);

  const normalizeError = compileSourceFunction<
    (error: unknown, fallback: string) => Error
  >('normalizeError');
  const runTransition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      from: string,
      to: string,
      operation: () => boolean,
    ) => boolean
  >('runTransition', {
    console: { error() {} },
    ModeSelectFatalNavigationError: ExecutableModeSelectFatalNavigationError,
    normalizeError,
  });
  let operationCount = 0;
  const transitionShell = {
    destroyedValue: false,
    emitTransitionFailure() {},
    stateValue: 'main-menu',
    transitioning: true,
  };
  assert.equal(runTransition.call(
    transitionShell,
    'main-menu',
    'leaderboard',
    () => {
      operationCount += 1;
      return true;
    },
  ), false);
  assert.equal(operationCount, 0);

  transitionShell.transitioning = false;
  assert.equal(runTransition.call(
    transitionShell,
    'main-menu',
    'leaderboard',
    () => {
      operationCount += 1;
      transitionShell.stateValue = 'leaderboard';
      return true;
    },
  ), true);
  assert.equal(runTransition.call(
    transitionShell,
    'main-menu',
    'leaderboard',
    () => {
      operationCount += 1;
      return true;
    },
  ), false);
  assert.equal(operationCount, 1);
});

test('Objectives route guards reject stale or inexact transactions before mutation', () => {
  const toObjectives = compileSourceMethod<
    (this: Record<string, unknown>, transaction: Record<string, unknown>) => boolean
  >('transitionMainMenuToObjectives');
  const toMainMenu = compileSourceMethod<
    (this: Record<string, unknown>, transaction: Record<string, unknown>) => boolean
  >('transitionObjectivesToMainMenu');
  const sourceRoot = new ExecutableScreenNode();
  const staleRoot = new ExecutableScreenNode();
  const sourcePresenter = { root: sourceRoot };
  let runCount = 0;
  const shell: Record<string, unknown> = {
    activeMainMenu: sourcePresenter,
    activeObjectives: sourcePresenter,
    runTransition() {
      runCount += 1;
      return false;
    },
  };

  for (const transaction of [
    { destination: 'ObjectivesLayer', root: staleRoot, timing: 'delayed', zOrder: 1 },
    { destination: 'LeaderboardLayer', root: sourceRoot, timing: 'delayed', zOrder: 1 },
    { destination: 'ObjectivesLayer', root: sourceRoot, timing: 'immediate', zOrder: 1 },
    { destination: 'ObjectivesLayer', root: sourceRoot, timing: 'delayed', zOrder: 2 },
  ]) {
    assert.equal(toObjectives.call(shell, transaction), false);
  }
  for (const transaction of [
    { destination: 'MainMenuLayer', root: staleRoot, timing: 'immediate', zOrder: 1 },
    { destination: 'ObjectivesLayer', root: sourceRoot, timing: 'immediate', zOrder: 1 },
    { destination: 'MainMenuLayer', root: sourceRoot, timing: 'delayed', zOrder: 1 },
    { destination: 'MainMenuLayer', root: sourceRoot, timing: 'immediate', zOrder: 2 },
  ]) {
    assert.equal(toMainMenu.call(shell, transaction), false);
  }
  assert.equal(runCount, 0);

  assert.equal(toObjectives.call(shell, {
    destination: 'ObjectivesLayer',
    root: sourceRoot,
    timing: 'delayed',
    zOrder: 1,
  }), false);
  assert.equal(toMainMenu.call(shell, {
    destination: 'MainMenuLayer',
    root: sourceRoot,
    timing: 'immediate',
    zOrder: 1,
  }), false);
  assert.equal(runCount, 2);
});

for (const fault of [
  'manager/popup failure',
  'post-commit refresh failure',
  'row-projection failure',
] as const) {
  test(`Objectives ${fault} transfers poisoned ownership and reconstructs Main Menu`, () => {
    const primary = new Error(`injected ${fault}`);
    const outcome = executeObjectivesFatalOwnershipRecovery(primary, false);

    assert.equal(outcome.reportCount, 1);
    assert.equal(outcome.reportedPrimary, primary);
    assert.deepEqual(outcome.recoveryFailures, []);
    assert.equal(outcome.sourcePresenter.disposed, true);
    assert.equal(outcome.sourcePresenter.inputLeaseHeld, false);
    assert.equal(outcome.activeObjectives, null);
    assert.equal(outcome.activeMainMenu, outcome.destinationPresenter);
    assert.equal(outcome.destinationPresenter.activationCount, 1);
    assert.equal(outcome.currentScreen, outcome.destinationPresenter.root);
    assert.equal(outcome.state, 'main-menu');
    assert.equal(outcome.transitioning, false);
  });
}

test('Objectives fatal recovery releases a failed Main Menu and reports only once', () => {
  const primary = new Error('injected committed Skip refresh failure');
  const outcome = executeObjectivesFatalOwnershipRecovery(primary, true);

  assert.equal(outcome.reportCount, 1);
  assert.equal(outcome.reportedPrimary, primary);
  assert.equal(
    outcome.recoveryFailures.some((error) => (
      error instanceof Error
      && /destination activation failure/.test(error.message)
    )),
    true,
  );
  assert.equal(outcome.sourcePresenter.disposed, true);
  assert.equal(outcome.destinationPresenter.disposed, true);
  assert.equal(outcome.activeObjectives, null);
  assert.equal(outcome.activeMainMenu, null);
  assert.equal(outcome.currentScreen, null);
  assert.equal(outcome.state, 'failed');
  assert.equal(outcome.transitioning, false);
});

test('Mode Select enters Classic only through an empty shared current-screen host', () => {
  const transition = extractMethod(SOURCE, 'transitionModeSelectToClassic');

  assertOrderedSubstrings(transition, [
    'sharedScene.detachCurrentScreen(oldPresenter.root)',
    'oldPresenter.suspendForTransition()',
    'nonClassicPhysics.restorePreviousCollisionFilter()',
    'this.requireGameplayController().activateClassicFromAppShell(sharedScene)',
    "this.stateValue = 'classic'",
    "disposeCommittedPresenter(oldPresenter, 'Mode Select')",
  ]);
  const rollbackStart = transition.indexOf('} catch (error) {');
  assert.ok(rollbackStart > -1);
  assertOrderedSubstrings(transition.slice(rollbackStart), [
    'const rollbackFailures: unknown[] = []',
    'this.restoreModeSelectAfterFailedClassicActivation(oldPresenter.root)',
    'nonClassicPhysics.activateCollisionFilter()',
    'if (rollbackFailures.length > 0)',
    'new ModeSelectFatalNavigationError(',
    'aggregateWithPrimaryError(',
    "'Mode Select to Classic rollback failed'",
  ]);
});

test('Mode Select enters prepared Crazy through the same empty transactional host', () => {
  const createModeSelect = extractMethod(SOURCE, 'createModeSelectPresenter');
  const transition = extractMethod(SOURCE, 'transitionModeSelectToCrazy');

  assert.match(
    createModeSelect,
    /onCrazyRequested: \(transaction\) => this\.transitionModeSelectToCrazy\(transaction\)/,
  );
  assertOrderedSubstrings(transition, [
    "transaction.destination !== 'CrazyModeLayer'",
    '!crazy.prepared',
    "this.runTransition('mode-select', 'crazy'",
    'sharedScene.detachCurrentScreen(oldPresenter.root)',
    'oldPresenter.suspendForTransition()',
    'nonClassicPhysics.restorePreviousCollisionFilter()',
    'crazy.activateCrazyFromAppShell(sharedScene)',
    "this.stateValue = 'crazy'",
    "disposeCommittedPresenter(oldPresenter, 'Mode Select')",
  ]);
  const rollbackStart = transition.indexOf('} catch (error) {');
  assert.ok(rollbackStart > -1);
  const rollbackBlock = transition.slice(rollbackStart);
  assert.match(
    rollbackBlock,
    /this\.compensateFailedTimedCrazyActivation\(\s*oldPresenter,\s*nonClassicPhysics,\s*error,\s*'Crazy',\s*\)/,
  );

  const rollback = extractMethod(SOURCE, 'restoreModeSelectAfterFailedCrazyActivation');
  assertOrderedSubstrings(rollback, [
    'const current = sharedScene.currentScreen',
    'if (current === previous)',
    'if (!isValid(previous, true) || previous.parent !== null)',
    'if (current === null)',
    'sharedScene.attachCurrentScreen(previous)',
    'sharedScene.replaceCurrentScreen(previous)',
    'sharedScene.currentScreen !== previous',
  ]);
  assert.doesNotMatch(rollback, /previous\.setParent\(|previous\.parent\s*=/);
});

test('Mode Select enters prepared Classic Bird through its isolated transactional host', () => {
  const createModeSelect = extractMethod(SOURCE, 'createModeSelectPresenter');
  const transition = extractMethod(SOURCE, 'transitionModeSelectToClassicBird');

  assert.match(
    createModeSelect,
    /onClassicBirdRequested: \(transaction\) => \([\s\S]*?this\.transitionModeSelectToClassicBird\(transaction\)/,
  );
  assertOrderedSubstrings(transition, [
    "transaction.destination !== 'ClassicBirdLayer'",
    '!classicBird.prepared',
    "this.runTransition('mode-select', 'classic-bird'",
    'sharedScene.detachCurrentScreen(oldPresenter.root)',
    'oldPresenter.suspendForTransition()',
    'nonClassicPhysics.restorePreviousCollisionFilter()',
    'classicBird.activateClassicBirdFromAppShell(sharedScene)',
    "this.stateValue = 'classic-bird'",
    "disposeCommittedPresenter(oldPresenter, 'Mode Select')",
  ]);
  const rollbackStart = transition.indexOf('} catch (error) {');
  assert.ok(rollbackStart > -1);
  const rollbackBlock = transition.slice(rollbackStart);
  assertOrderedSubstrings(rollbackBlock, [
    'const rollbackFailures: unknown[] = []',
    'this.restoreModeSelectAfterFailedClassicBirdActivation(oldPresenter.root)',
    'nonClassicPhysics.activateCollisionFilter()',
    'oldPresenter.rearmNavigationAfterFailure()',
    'if (rollbackFailures.length > 0)',
    'new ModeSelectFatalNavigationError(',
    'aggregateWithPrimaryError(',
    "'Mode Select to Classic Bird rollback failed'",
    'error instanceof ClassicBirdLifecycleRollbackError',
    "'Mode Select to Classic Bird retained poisoned runtime ownership'",
  ]);

  const rollback = extractMethod(
    SOURCE,
    'restoreModeSelectAfterFailedClassicBirdActivation',
  );
  assertOrderedSubstrings(rollback, [
    'const current = sharedScene.currentScreen',
    'if (current === previous)',
    'if (!isValid(previous, true) || previous.parent !== null)',
    'if (current === null)',
    'sharedScene.attachCurrentScreen(previous)',
    'sharedScene.replaceCurrentScreen(previous)',
    'sharedScene.currentScreen !== previous',
  ]);
  assert.doesNotMatch(rollback, /previous\.setParent\(|previous\.parent\s*=/);
});

test('Mode Select enters prepared Crazy Bird through the profiled timed-mode owner', () => {
  const createModeSelect = extractMethod(SOURCE, 'createModeSelectPresenter');
  const transition = extractMethod(SOURCE, 'transitionModeSelectToCrazyBird');

  assert.match(
    createModeSelect,
    /onCrazyBirdRequested: \(transaction\) => \([\s\S]*?this\.transitionModeSelectToCrazyBird\(transaction\)/,
  );
  assertOrderedSubstrings(transition, [
    "transaction.destination !== 'CrazyBirdLayer'",
    '!crazy.crazyBirdPrepared',
    "this.runTransition('mode-select', 'crazy-bird'",
    'sharedScene.detachCurrentScreen(oldPresenter.root)',
    'oldPresenter.suspendForTransition()',
    'nonClassicPhysics.restorePreviousCollisionFilter()',
    'crazy.activateCrazyBirdFromAppShell(sharedScene)',
    "this.stateValue = 'crazy-bird'",
    "disposeCommittedPresenter(oldPresenter, 'Mode Select')",
  ]);
  const rollbackStart = transition.indexOf('} catch (error) {');
  assert.ok(rollbackStart > -1);
  const rollbackBlock = transition.slice(rollbackStart);
  assert.match(
    rollbackBlock,
    /this\.compensateFailedTimedCrazyActivation\(\s*oldPresenter,\s*nonClassicPhysics,\s*error,\s*'Crazy Bird',\s*\)/,
  );

  const rollback = extractMethod(
    SOURCE,
    'restoreModeSelectAfterFailedCrazyBirdActivation',
  );
  assertOrderedSubstrings(rollback, [
    'const current = sharedScene.currentScreen',
    'if (current === previous)',
    'if (!isValid(previous, true) || previous.parent !== null)',
    'if (current === null)',
    'sharedScene.attachCurrentScreen(previous)',
    'sharedScene.replaceCurrentScreen(previous)',
    'sharedScene.currentScreen !== previous',
  ]);
  assert.doesNotMatch(rollback, /previous\.setParent\(|previous\.parent\s*=/);

  const compensation = extractMethod(
    SOURCE,
    'compensateFailedTimedCrazyActivation',
  );
  assertOrderedSubstrings(compensation, [
    'containsCrazyLifecycleRollbackError(error)',
    'new ModeSelectFatalNavigationError(',
    'retained poisoned runtime ownership',
    'const rollbackFailures: unknown[] = []',
    "destination === 'Crazy Bird'",
    'this.restoreModeSelectAfterFailedCrazyBirdActivation(oldPresenter.root)',
    'this.restoreModeSelectAfterFailedCrazyActivation(oldPresenter.root)',
    'nonClassicPhysics.activateCollisionFilter()',
    '!nonClassicPhysics.collisionFilterActive',
    'oldPresenter.rearmNavigationAfterFailure()',
    'if (rollbackFailures.length > 0)',
    'aggregateWithPrimaryError(',
  ]);
});

test('Mode Select enters prepared Combo Bird through its isolated mode-5 owner', () => {
  const createModeSelect = extractMethod(SOURCE, 'createModeSelectPresenter');
  const transition = extractMethod(SOURCE, 'transitionModeSelectToComboBird');

  assert.match(
    createModeSelect,
    /onComboBirdRequested: \(transaction\) => \([\s\S]*?this\.transitionModeSelectToComboBird\(transaction\)/,
  );
  assertOrderedSubstrings(transition, [
    "transaction.destination !== 'ComboBirdLayer'",
    '!comboBird.prepared',
    "this.runTransition('mode-select', 'combo-bird'",
    'sharedScene.detachCurrentScreen(oldPresenter.root)',
    'oldPresenter.suspendForTransition()',
    'nonClassicPhysics.restorePreviousCollisionFilter()',
    'comboBird.activateComboBirdFromAppShell(sharedScene)',
    "this.stateValue = 'combo-bird'",
    "disposeCommittedPresenter(oldPresenter, 'Mode Select')",
  ]);
  const rollbackStart = transition.indexOf('} catch (error) {');
  assert.ok(rollbackStart > -1);
  assertOrderedSubstrings(transition.slice(rollbackStart), [
    'const rollbackFailures: unknown[] = []',
    'this.restoreModeSelectAfterFailedComboBirdActivation(oldPresenter.root)',
    'nonClassicPhysics.activateCollisionFilter()',
    'oldPresenter.rearmNavigationAfterFailure()',
    'if (rollbackFailures.length > 0)',
    'new ModeSelectFatalNavigationError(',
    'aggregateWithPrimaryError(',
    "'Mode Select to Combo Bird rollback failed'",
    'error instanceof ComboBirdLifecycleRollbackError',
    "'Mode Select to Combo Bird retained poisoned runtime ownership'",
  ]);

  const rollback = extractMethod(
    SOURCE,
    'restoreModeSelectAfterFailedComboBirdActivation',
  );
  assertOrderedSubstrings(rollback, [
    'const current = sharedScene.currentScreen',
    'if (current === previous)',
    'if (!isValid(previous, true) || previous.parent !== null)',
    'if (current === null)',
    'sharedScene.attachCurrentScreen(previous)',
    'sharedScene.replaceCurrentScreen(previous)',
    'sharedScene.currentScreen !== previous',
  ]);
  assert.doesNotMatch(rollback, /previous\.setParent\(|previous\.parent\s*=/);
});

test('Mode Select enters prepared GN Style through its isolated mode-2 owner', () => {
  const createModeSelect = extractMethod(SOURCE, 'createModeSelectPresenter');
  const transition = extractMethod(SOURCE, 'transitionModeSelectToGnStyle');

  assert.match(
    createModeSelect,
    /onGnStyleRequested: \(transaction\) => \([\s\S]*?this\.transitionModeSelectToGnStyle\(transaction\)/,
  );
  assertOrderedSubstrings(transition, [
    "transaction.destination !== 'GNStyleLayer'",
    '!gnStyle.prepared',
    "this.runTransition('mode-select', 'gn-style'",
    'sharedScene.detachCurrentScreen(oldPresenter.root)',
    'oldPresenter.suspendForTransition()',
    'nonClassicPhysics.restorePreviousCollisionFilter()',
    'gnStyle.activateGnStyleFromAppShell(sharedScene)',
    "this.stateValue = 'gn-style'",
    "disposeCommittedPresenter(oldPresenter, 'Mode Select')",
  ]);
  const rollbackStart = transition.indexOf('} catch (error) {');
  assert.ok(rollbackStart > -1);
  assertOrderedSubstrings(transition.slice(rollbackStart), [
    'const rollbackFailures: unknown[] = []',
    'this.restoreModeSelectAfterFailedGnStyleActivation(oldPresenter.root)',
    'nonClassicPhysics.activateCollisionFilter()',
    'oldPresenter.rearmNavigationAfterFailure()',
    'if (rollbackFailures.length > 0)',
    'new ModeSelectFatalNavigationError(',
    'aggregateWithPrimaryError(',
    "'Mode Select to GN Style rollback failed'",
    'error instanceof GnStyleLifecycleRollbackError',
    "'Mode Select to GN Style retained poisoned runtime ownership'",
  ]);

  const rollback = extractMethod(
    SOURCE,
    'restoreModeSelectAfterFailedGnStyleActivation',
  );
  assertOrderedSubstrings(rollback, [
    'const current = sharedScene.currentScreen',
    'if (current === previous)',
    'if (!isValid(previous, true) || previous.parent !== null)',
    'if (current === null)',
    'sharedScene.attachCurrentScreen(previous)',
    'sharedScene.replaceCurrentScreen(previous)',
    'sharedScene.currentScreen !== previous',
  ]);
  assert.doesNotMatch(rollback, /previous\.setParent\(|previous\.parent\s*=/);
});

test('Classic Result to Main Menu commits only after attach and activation, with rollback first', () => {
  const transition = extractMemberBlock(
    SOURCE,
    '  private readonly onClassicResultMenuRequested = (',
  );

  assertOrderedSubstrings(transition, [
    'this.requireNonClassicPhysics().activateCollisionFilter()',
    'sharedScene.replaceCurrentScreen(nextPresenter.root)',
    'nextPresenter.activate()',
    'request.commit(previous)',
    'this.activeMainMenu = nextPresenter',
    "this.stateValue = 'main-menu'",
  ]);
  const catchIndex = transition.indexOf('} catch (error) {');
  const rollbackIndex = transition.indexOf('request.rollback()', catchIndex);
  const disposeIndex = transition.indexOf('nextPresenter?.dispose()', catchIndex);
  assert.ok(rollbackIndex > catchIndex);
  assert.ok(disposeIndex > rollbackIndex);
});

test('Crazy Result and Pause Quit share one commit-after-activation Main Menu transaction', () => {
  const result = extractMemberBlock(
    SOURCE,
    '  private readonly onCrazyResultMenuRequested = (',
  );
  const quit = extractMemberBlock(
    SOURCE,
    '  private readonly onCrazyPauseQuitRequested = (',
  );
  const transition = extractMethod(SOURCE, 'transitionCrazyToMainMenu');
  const sharedTransition = extractMethod(SOURCE, 'transitionTimedCrazyToMainMenu');

  assertOrderedSubstrings(result, [
    'if (!isCrazyResultMenuRequestedEvent(request))',
    "rollbackRejectedCrazyNavigationRequest(request, 'Crazy Result')",
    'root: request.resultRoot',
  ]);
  assert.match(result, /root: request\.resultRoot/);
  assert.match(result, /'Crazy Result'/);
  assertOrderedSubstrings(quit, [
    'if (!isCrazyPauseQuitRequestedEvent(request))',
    "rollbackRejectedCrazyNavigationRequest(request, 'Crazy Pause Quit')",
    'root: request.crazyRoot',
  ]);
  assert.match(quit, /root: request\.crazyRoot/);
  assert.match(quit, /'Crazy Pause Quit'/);
  assert.match(
    transition,
    /this\.transitionTimedCrazyToMainMenu\(request, 'crazy', source\)/,
  );
  assertOrderedSubstrings(sharedTransition, [
    'this.stateValue !== expectedState',
    'this.requireNonClassicPhysics()',
    '.activateCollisionFilter()',
    'sharedScene.replaceCurrentScreen(nextPresenter.root)',
    'nextPresenter.activate()',
    'commitCrazyMainMenuNavigationRequest(request, previous, source)',
    'this.activeMainMenu = nextPresenter',
    "this.stateValue = 'main-menu'",
  ]);
  const catchIndex = sharedTransition.indexOf('} catch (error) {');
  const restoreIndex = sharedTransition.indexOf(
    'this.restoreCrazyNavigationRootBeforeRollback(request.root)',
    catchIndex,
  );
  const rollbackIndex = sharedTransition.indexOf('request.rollback()', catchIndex);
  const disposeIndex = sharedTransition.indexOf('nextPresenter?.dispose()', catchIndex);
  const filterIndex = sharedTransition.indexOf(
    'this.requireNonClassicPhysics().restorePreviousCollisionFilter()',
    catchIndex,
  );
  assert.ok(restoreIndex > catchIndex);
  assert.ok(disposeIndex > restoreIndex);
  assert.ok(filterIndex > disposeIndex);
  assert.ok(rollbackIndex > filterIndex);
});

test('Crazy Bird Result and Pause Quit use distinct events and fatal rollback handling', () => {
  const result = extractMemberBlock(
    SOURCE,
    '  private readonly onCrazyBirdResultMenuRequested = (',
  );
  const quit = extractMemberBlock(
    SOURCE,
    '  private readonly onCrazyBirdPauseQuitRequested = (',
  );
  const transition = extractMethod(SOURCE, 'transitionCrazyBirdToMainMenu');
  const sharedTransition = extractMethod(SOURCE, 'transitionTimedCrazyToMainMenu');

  assertOrderedSubstrings(result, [
    'captureCrazyResultMenuNavigationRequest(request)',
    'if (captured.request === null)',
    'this.rejectCrazyBirdNavigationRequest(',
    "'Crazy Bird Result'",
    'this.transitionCrazyBirdToMainMenu(',
  ]);
  assertOrderedSubstrings(quit, [
    'captureCrazyPauseQuitNavigationRequest(request)',
    'if (captured.request === null)',
    'this.rejectCrazyBirdNavigationRequest(',
    "'Crazy Bird Pause Quit'",
    'this.transitionCrazyBirdToMainMenu(',
  ]);
  assert.match(
    transition,
    /this\.transitionTimedCrazyToMainMenu\(request, 'crazy-bird', source\)/,
  );
  assertOrderedSubstrings(sharedTransition, [
    'this.stateValue !== expectedState',
    'this.requireNonClassicPhysics()',
    '.activateCollisionFilter()',
    'sharedScene.replaceCurrentScreen(nextPresenter.root)',
    'nextPresenter.activate()',
    'commitCrazyMainMenuNavigationRequest(request, previous, source)',
    "this.stateValue = 'main-menu'",
    'this.assertCrazyNavigationRollbackRestored(request.root)',
    "expectedState === 'crazy-bird' && rollbackFailures.length > 0",
    'this.retainCrazyBirdShellFailure(',
  ]);
});

test('Classic Bird Result and Pause Quit share one commit-after-activation transaction', () => {
  const result = extractMemberBlock(
    SOURCE,
    '  private readonly onClassicBirdResultMenuRequested = (',
  );
  const quit = extractMemberBlock(
    SOURCE,
    '  private readonly onClassicBirdPauseQuitRequested = (',
  );
  const transition = extractMethod(SOURCE, 'transitionClassicBirdToMainMenu');

  assertOrderedSubstrings(result, [
    'captureClassicBirdResultMenuNavigationRequest(request)',
    'if (captured.request === null)',
    'this.rejectClassicBirdNavigationRequest(',
    "'Classic Bird Result'",
    'this.transitionClassicBirdToMainMenu(captured.request',
  ]);
  assertOrderedSubstrings(quit, [
    'captureClassicBirdPauseQuitNavigationRequest(request)',
    'if (captured.request === null)',
    'this.rejectClassicBirdNavigationRequest(',
    "'Classic Bird Pause Quit'",
    'this.transitionClassicBirdToMainMenu(captured.request',
  ]);
  assertOrderedSubstrings(transition, [
    "this.stateValue !== 'classic-bird'",
    'this.requireNonClassicPhysics()',
    '.activateCollisionFilter()',
    'sharedScene.replaceCurrentScreen(nextPresenter.root)',
    'nextPresenter.activate()',
    'commitClassicBirdMainMenuNavigationRequest(request, previous, source)',
    'this.activeMainMenu = nextPresenter',
    "this.stateValue = 'main-menu'",
  ]);
  const catchIndex = transition.indexOf('} catch (error) {');
  const restoreIndex = transition.indexOf(
    'this.restoreClassicBirdNavigationRootBeforeRollback(request.root)',
    catchIndex,
  );
  const rollbackIndex = transition.indexOf('request.rollback()', catchIndex);
  const disposeIndex = transition.indexOf('nextPresenter?.dispose()', catchIndex);
  const filterIndex = transition.indexOf(
    'this.requireNonClassicPhysics().restorePreviousCollisionFilter()',
    catchIndex,
  );
  assert.ok(restoreIndex > catchIndex);
  assert.ok(disposeIndex > restoreIndex);
  assert.ok(filterIndex > disposeIndex);
  assert.ok(rollbackIndex > filterIndex);
});

test('Combo Bird Result and Pause Quit share one commit-after-activation transaction', () => {
  const result = extractMemberBlock(
    SOURCE,
    '  private readonly onComboBirdResultMenuRequested = (',
  );
  const quit = extractMemberBlock(
    SOURCE,
    '  private readonly onComboBirdPauseQuitRequested = (',
  );
  const transition = extractMethod(SOURCE, 'transitionComboBirdToMainMenu');

  assertOrderedSubstrings(result, [
    'captureComboBirdResultMenuNavigationRequest(request)',
    'if (captured.request === null)',
    'this.rejectComboBirdNavigationRequest(',
    "'Combo Bird Result'",
    'this.transitionComboBirdToMainMenu(captured.request',
  ]);
  assertOrderedSubstrings(quit, [
    'captureComboBirdPauseQuitNavigationRequest(request)',
    'if (captured.request === null)',
    'this.rejectComboBirdNavigationRequest(',
    "'Combo Bird Pause Quit'",
    'this.transitionComboBirdToMainMenu(captured.request',
  ]);
  assertOrderedSubstrings(transition, [
    "this.stateValue !== 'combo-bird'",
    'this.requireNonClassicPhysics()',
    '.activateCollisionFilter()',
    'sharedScene.replaceCurrentScreen(nextPresenter.root)',
    'nextPresenter.activate()',
    'commitClassicBirdMainMenuNavigationRequest(request, previous, source)',
    'this.activeMainMenu = nextPresenter',
    "this.stateValue = 'main-menu'",
  ]);
  const catchIndex = transition.indexOf('} catch (error) {');
  assertOrderedSubstrings(transition.slice(catchIndex), [
    'this.restoreComboBirdNavigationRootBeforeRollback(request.root)',
    'nextPresenter?.dispose()',
    'this.requireNonClassicPhysics().restorePreviousCollisionFilter()',
    'request.rollback()',
    'this.assertComboBirdNavigationRollbackRestored(request.root)',
    'this.retainComboBirdShellFailure(',
  ]);
});

test('GN Style Result and Pause Quit share one commit-after-activation transaction', () => {
  const result = extractMemberBlock(
    SOURCE,
    '  private readonly onGnStyleResultMenuRequested = (',
  );
  const quit = extractMemberBlock(
    SOURCE,
    '  private readonly onGnStylePauseQuitRequested = (',
  );
  const transition = extractMethod(SOURCE, 'transitionGnStyleToMainMenu');

  assertOrderedSubstrings(result, [
    'captureGnStyleResultMenuNavigationRequest(request)',
    'if (captured.request === null)',
    'this.rejectGnStyleNavigationRequest(',
    "'GN Style Result'",
    'this.transitionGnStyleToMainMenu(captured.request',
  ]);
  assertOrderedSubstrings(quit, [
    'captureGnStylePauseQuitNavigationRequest(request)',
    'if (captured.request === null)',
    'this.rejectGnStyleNavigationRequest(',
    "'GN Style Pause Quit'",
    'this.transitionGnStyleToMainMenu(captured.request',
  ]);
  assertOrderedSubstrings(transition, [
    "this.stateValue !== 'gn-style'",
    'this.requireNonClassicPhysics()',
    '.activateCollisionFilter()',
    'sharedScene.replaceCurrentScreen(nextPresenter.root)',
    'nextPresenter.activate()',
    'commitClassicBirdMainMenuNavigationRequest(request, previous, source)',
    'this.activeMainMenu = nextPresenter',
    "this.stateValue = 'main-menu'",
  ]);
  const rollbackStart = transition.indexOf(
    'this.restoreGnStyleNavigationRootBeforeRollback(request.root)',
  );
  assert.ok(rollbackStart > -1);
  const catchIndex = transition.lastIndexOf('} catch (error) {', rollbackStart);
  assert.ok(catchIndex > -1);
  assertOrderedSubstrings(transition.slice(catchIndex), [
    'this.restoreGnStyleNavigationRootBeforeRollback(request.root)',
    'nextPresenter?.dispose()',
    'this.requireNonClassicPhysics().restorePreviousCollisionFilter()',
    'request.rollback()',
    'this.assertGnStyleNavigationRollbackRestored(request.root)',
    'this.retainGnStyleShellFailure(',
  ]);
});

test('Crazy shell payload guards reject malformed events before dereferencing navigation fields', () => {
  const resultGuard = extractMemberBlock(
    SOURCE,
    'function isCrazyResultMenuRequestedEvent(',
  );
  const quitGuard = extractMemberBlock(
    SOURCE,
    'function isCrazyPauseQuitRequestedEvent(',
  );
  const reject = extractMemberBlock(
    SOURCE,
    'function rollbackRejectedCrazyNavigationRequest(',
  );

  for (const guard of [resultGuard, quitGuard]) {
    assertOrderedSubstrings(guard, [
      "request === null || typeof request !== 'object'",
      'return false',
      'try {',
    ]);
    assert.match(guard, /instanceof Node/);
    assert.match(guard, /isValid\(candidate\.[a-zA-Z]+, true\)/);
    assert.match(guard, /typeof candidate\.commit === 'function'/);
    assert.match(guard, /typeof candidate\.rollback === 'function'/);
    assert.match(guard, /catch \{\s*return false;/);
  }
  assert.match(resultGuard, /isSignedInt32\(candidate\.completedRunScore\)/);
  assert.doesNotMatch(resultGuard, /candidate\.completedRunScore >= 0/);
  assertOrderedSubstrings(reject, [
    "request === null || typeof request !== 'object'",
    'return',
    'typeof rollback === \'function\'',
    'rollback.call(request)',
  ]);
});

test('Classic Bird payload captures reject malformed events without repeat dereferences', () => {
  const resultCapture = extractMemberBlock(
    SOURCE,
    'function captureClassicBirdResultMenuNavigationRequest(',
  );
  const quitCapture = extractMemberBlock(
    SOURCE,
    'function captureClassicBirdPauseQuitNavigationRequest(',
  );
  const reject = extractMemberBlock(
    SOURCE,
    'function rollbackRejectedClassicBirdNavigationRequest(',
  );

  for (const capture of [resultCapture, quitCapture]) {
    assertOrderedSubstrings(capture, [
      "request === null || typeof request !== 'object'",
      'request: null',
      'try {',
      'const rollback = candidate.rollback',
      'capturedRollback = () => rollback.call(request)',
    ]);
    assert.match(capture, /instanceof Node/);
    assert.match(capture, /typeof commit !== 'function'/);
    assert.match(capture, /catch \{/);
  }
  assert.equal((resultCapture.match(/candidate\.resultRoot/g) ?? []).length, 1);
  assert.equal((resultCapture.match(/candidate\.completedRunScore/g) ?? []).length, 1);
  assert.equal((resultCapture.match(/candidate\.commit/g) ?? []).length, 1);
  assert.equal((resultCapture.match(/candidate\.rollback/g) ?? []).length, 1);
  assert.equal((quitCapture.match(/candidate\.classicBirdRoot/g) ?? []).length, 1);
  assert.equal((quitCapture.match(/candidate\.commit/g) ?? []).length, 1);
  assert.equal((quitCapture.match(/candidate\.rollback/g) ?? []).length, 1);
  assert.match(resultCapture, /Number\.isFinite\(completedRunScore\)/);
  assert.match(resultCapture, /completedRunScore < 0/);
  assertOrderedSubstrings(reject, [
    'if (rollback === null)',
    'return Object.freeze([])',
    'runBestEffortCleanup(',
    '[rollback]',
  ]);
});

test('Combo Bird payload captures use the exact result and pause roots once', () => {
  const resultCapture = extractMemberBlock(
    SOURCE,
    'function captureComboBirdResultMenuNavigationRequest(',
  );
  const quitCapture = extractMemberBlock(
    SOURCE,
    'function captureComboBirdPauseQuitNavigationRequest(',
  );

  assertOrderedSubstrings(resultCapture, [
    "request === null || typeof request !== 'object'",
    'const rollback = candidate.rollback',
    'capturedRollback = () => rollback.call(request)',
    'const resultRoot = candidate.resultRoot',
    'const completedRunScore = candidate.completedRunScore',
    'const commit = candidate.commit',
    'resultRoot instanceof Node',
    'isValid(resultRoot, true)',
    'isSignedInt32(completedRunScore)',
    'completedRunScore < 0',
    "typeof commit !== 'function'",
    'root: resultRoot',
  ]);
  assertOrderedSubstrings(quitCapture, [
    "request === null || typeof request !== 'object'",
    'const rollback = candidate.rollback',
    'capturedRollback = () => rollback.call(request)',
    'const comboBirdRoot = candidate.comboBirdRoot',
    'const commit = candidate.commit',
    'comboBirdRoot instanceof Node',
    'isValid(comboBirdRoot, true)',
    "typeof commit !== 'function'",
    'root: comboBirdRoot',
  ]);
  assert.equal((quitCapture.match(/candidate\.comboBirdRoot/g) ?? []).length, 1);
  assert.equal((quitCapture.match(/candidate\.commit/g) ?? []).length, 1);
  assert.equal((quitCapture.match(/candidate\.rollback/g) ?? []).length, 1);
  assert.equal((resultCapture.match(/candidate\.resultRoot/g) ?? []).length, 1);
  assert.equal((resultCapture.match(/candidate\.completedRunScore/g) ?? []).length, 1);
  assert.equal((resultCapture.match(/candidate\.commit/g) ?? []).length, 1);
  assert.equal((resultCapture.match(/candidate\.rollback/g) ?? []).length, 1);
});

test('GN Style payload captures accept the full signed result range and exact pause root', () => {
  const resultCapture = extractMemberBlock(
    SOURCE,
    'function captureGnStyleResultMenuNavigationRequest(',
  );
  const quitCapture = extractMemberBlock(
    SOURCE,
    'function captureGnStylePauseQuitNavigationRequest(',
  );

  assert.match(
    resultCapture,
    /return captureCrazyResultMenuNavigationRequest\(request\)/,
  );
  assertOrderedSubstrings(quitCapture, [
    "request === null || typeof request !== 'object'",
    'const rollback = candidate.rollback',
    'capturedRollback = () => rollback.call(request)',
    'const gnStyleRoot = candidate.gnStyleRoot',
    'const commit = candidate.commit',
    'gnStyleRoot instanceof Node',
    'isValid(gnStyleRoot, true)',
    "typeof commit !== 'function'",
    'root: gnStyleRoot',
  ]);
  assert.equal((quitCapture.match(/candidate\.gnStyleRoot/g) ?? []).length, 1);
  assert.equal((quitCapture.match(/candidate\.commit/g) ?? []).length, 1);
  assert.equal((quitCapture.match(/candidate\.rollback/g) ?? []).length, 1);
});

test('Crazy Bird payload captures every effectful navigation field once', () => {
  const resultCapture = extractMemberBlock(
    SOURCE,
    'function captureCrazyResultMenuNavigationRequest(',
  );
  const quitCapture = extractMemberBlock(
    SOURCE,
    'function captureCrazyPauseQuitNavigationRequest(',
  );

  for (const capture of [resultCapture, quitCapture]) {
    assertOrderedSubstrings(capture, [
      "request === null || typeof request !== 'object'",
      'request: null',
      'try {',
      'const rollback = candidate.rollback',
      'capturedRollback = () => rollback.call(request)',
    ]);
    assert.match(capture, /instanceof Node/);
    assert.match(capture, /typeof commit !== 'function'/);
    assert.match(capture, /catch \{/);
  }
  assert.equal((resultCapture.match(/candidate\.resultRoot/g) ?? []).length, 1);
  assert.equal((resultCapture.match(/candidate\.completedRunScore/g) ?? []).length, 1);
  assert.equal((resultCapture.match(/candidate\.commit/g) ?? []).length, 1);
  assert.equal((resultCapture.match(/candidate\.rollback/g) ?? []).length, 1);
  assert.equal((quitCapture.match(/candidate\.crazyRoot/g) ?? []).length, 1);
  assert.equal((quitCapture.match(/candidate\.commit/g) ?? []).length, 1);
  assert.equal((quitCapture.match(/candidate\.rollback/g) ?? []).length, 1);
  assert.match(resultCapture, /isSignedInt32\(completedRunScore\)/);
  assert.doesNotMatch(resultCapture, /completedRunScore < 0/);
});

test('non-Classic producer commit errors use the idempotent commit contract', () => {
  for (const functionName of [
    'commitCrazyMainMenuNavigationRequest',
    'commitClassicBirdMainMenuNavigationRequest',
  ]) {
    const commit = extractMemberBlock(SOURCE, `function ${functionName}(`);
    const calls = commit.match(/request\.commit\(previousRoot\)/g) ?? [];

    assert.equal(calls.length, 2);
    assert.match(
      commit,
      /try \{[\s\S]*?request\.commit\(previousRoot\)[\s\S]*?catch \(error\) \{[\s\S]*?try \{[\s\S]*?request\.commit\(previousRoot\)[\s\S]*?catch \{[\s\S]*?throw error/,
    );
    assert.match(
      commit,
      /producer reported an error after committing Main Menu navigation/,
    );
  }
});

test('Crazy transaction helpers execute malformed, commit, and partial-root failure paths', () => {
  const isValid = (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  );
  const normalizeError = compileSourceFunction<
    (error: unknown, fallback: string) => Error
  >('normalizeError');
  const errors: unknown[] = [];
  const testConsole = { error: (error: unknown) => errors.push(error) };
  const isSignedInt32 = compileSourceFunction<
    (value: unknown) => value is number
  >('isSignedInt32');
  const resultGuard = compileSourceFunction<(request: unknown) => boolean>(
    'isCrazyResultMenuRequestedEvent',
    { Node: ExecutableScreenNode, isSignedInt32, isValid },
  );
  const quitGuard = compileSourceFunction<(request: unknown) => boolean>(
    'isCrazyPauseQuitRequestedEvent',
    { Node: ExecutableScreenNode, isValid },
  );
  const reject = compileSourceFunction<
    (request: unknown, source: 'Crazy Pause Quit' | 'Crazy Result') => void
  >(
    'rollbackRejectedCrazyNavigationRequest',
    { console: testConsole, normalizeError },
  );

  assert.equal(resultGuard(null), false);
  assert.equal(quitGuard(undefined), false);
  assert.equal(resultGuard({
    commit() {},
    completedRunScore: Number.NaN,
    resultRoot: new ExecutableScreenNode(),
    rollback() {},
  }), false);
  assert.equal(quitGuard({
    commit() {},
    crazyRoot: Object.assign(new ExecutableScreenNode(), { destroyed: true }),
    rollback() {},
  }), false);
  assert.equal(resultGuard({
    commit() {},
    completedRunScore: 42,
    resultRoot: new ExecutableScreenNode(),
    rollback() {},
  }), true);

  let rollbackCount = 0;
  reject({ rollback: () => { rollbackCount += 1; } }, 'Crazy Result');
  assert.equal(rollbackCount, 1);
  assert.doesNotThrow(() => reject({
    rollback: () => {
      throw new Error('injected rejected rollback failure');
    },
  }, 'Crazy Pause Quit'));
  assert.equal(errors.length, 1);

  const commit = compileSourceFunction<
    (
      request: Readonly<{ commit(previousRoot: ExecutableScreenNode): void }>,
      previousRoot: ExecutableScreenNode,
      source: 'Crazy Pause Quit' | 'Crazy Result',
    ) => void
  >(
    'commitCrazyMainMenuNavigationRequest',
    { console: testConsole, normalizeError },
  );
  const previousRoot = new ExecutableScreenNode();
  let committed = false;
  let commitCalls = 0;
  assert.doesNotThrow(() => commit({
    commit() {
      commitCalls += 1;
      if (committed) {
        return;
      }
      committed = true;
      throw new Error('injected post-commit notification failure');
    },
  }, previousRoot, 'Crazy Pause Quit'));
  assert.equal(commitCalls, 2);
  assert.equal(committed, true);

  let rejectedCommitCalls = 0;
  assert.throws(() => commit({
    commit() {
      rejectedCommitCalls += 1;
      throw new Error('injected pre-commit failure');
    },
  }, previousRoot, 'Crazy Result'), /injected pre-commit failure/);
  assert.equal(rejectedCommitCalls, 2);

  const restore = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      previous: ExecutableScreenNode,
    ) => void
  >('restoreModeSelectAfterFailedCrazyActivation', { isValid });
  const detachedModeSelect = new ExecutableScreenNode();
  const emptyScene = new ExecutableSharedScene();
  restore.call({ requireSharedScene: () => emptyScene }, detachedModeSelect);
  assert.equal(emptyScene.currentScreen, detachedModeSelect);

  const attachedModeSelect = new ExecutableScreenNode();
  const partialCrazy = new ExecutableScreenNode();
  const occupiedScene = new ExecutableSharedScene(partialCrazy);
  restore.call({ requireSharedScene: () => occupiedScene }, attachedModeSelect);
  assert.equal(occupiedScene.currentScreen, attachedModeSelect);
  assert.equal(partialCrazy.parent, null);

  const restoreCrazyRoot = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      root: ExecutableScreenNode,
    ) => void
  >('restoreCrazyNavigationRootBeforeRollback', { isValid });
  const crazyRoot = new ExecutableScreenNode();
  const failedMenuRoot = new ExecutableScreenNode();
  const crazyRollbackScene = new ExecutableSharedScene(failedMenuRoot);
  restoreCrazyRoot.call(
    { requireSharedScene: () => crazyRollbackScene },
    crazyRoot,
  );
  assert.equal(crazyRollbackScene.currentScreen, crazyRoot);
  assert.equal(failedMenuRoot.parent, null);

  class TestFatalNavigationError extends Error {
    constructor(message: string, cause: unknown) {
      super(`${message}: ${String(cause)}`);
    }
  }
  const transitionToCrazy = compileSourceMethod<
    (this: Record<string, unknown>, transaction: Readonly<{
      destination: string;
      root: ExecutableScreenNode;
    }>) => boolean
  >('transitionModeSelectToCrazy', {
    ModeSelectFatalNavigationError: TestFatalNavigationError,
  });
  const compensateFailedTimedCrazyActivation = compileCrazyActivationCompensation(
    TestFatalNavigationError,
  );
  const captureModeSelectFatalScreenRelease = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      root: ExecutableScreenNode,
    ) => () => void
  >('captureModeSelectFatalScreenRelease');

  for (const attachPartialCrazy of [false, true]) {
    const modeSelectRoot = new ExecutableScreenNode();
    const sharedScene = new ExecutableSharedScene(modeSelectRoot);
    const partiallyAttachedCrazyRoot = new ExecutableScreenNode();
    let filterActive = true;
    let filterReacquireCount = 0;
    let transitionFailure: unknown = null;
    const oldPresenter = {
      dispose: () => true,
      root: modeSelectRoot,
      suspendForTransition: () => true,
    };
    const nonClassicPhysics = {
      activateCollisionFilter() {
        filterReacquireCount += 1;
        throw new Error('injected collision-filter reacquisition failure');
      },
      get collisionFilterActive() {
        return filterActive;
      },
      restorePreviousCollisionFilter() {
        filterActive = false;
        return true;
      },
    };
    const shell = {
      activeModeSelect: oldPresenter,
      captureModeSelectFatalScreenRelease(root: ExecutableScreenNode) {
        return captureModeSelectFatalScreenRelease.call(this, root);
      },
      compensateFailedTimedCrazyActivation(
        presenter: typeof oldPresenter,
        physics: typeof nonClassicPhysics,
        error: unknown,
        destination: 'Crazy' | 'Crazy Bird',
      ) {
        return compensateFailedTimedCrazyActivation.call(
          this,
          presenter,
          physics,
          error,
          destination,
        );
      },
      requireCrazyGameplayController: () => ({
        activateCrazyFromAppShell() {
          if (attachPartialCrazy) {
            sharedScene.attachCurrentScreen(partiallyAttachedCrazyRoot);
          }
          throw new Error('injected Crazy activation failure');
        },
        prepared: true,
      }),
      requireNonClassicPhysics: () => nonClassicPhysics,
      requireSharedScene: () => sharedScene,
      restoreModeSelectAfterFailedCrazyActivation: restore,
      runTransition(_from: string, _to: string, operation: () => boolean) {
        try {
          return operation();
        } catch (error) {
          transitionFailure = error;
          return false;
        }
      },
      stateValue: 'mode-select',
    };

    assert.equal(transitionToCrazy.call(shell, {
      destination: 'CrazyModeLayer',
      root: modeSelectRoot,
    }), false);
    assert.equal(sharedScene.currentScreen, modeSelectRoot);
    assert.equal(partiallyAttachedCrazyRoot.parent, null);
    assert.equal(filterReacquireCount, 1);
    assert.match(
      String(transitionFailure),
      /injected Crazy activation failure.*injected collision-filter reacquisition failure/,
    );
  }
});

test('Crazy Result Menu accepts a completed signed score of -10', () => {
  const outcome = executeCrazyResultMenuRequest('crazy', -10);

  assert.equal(outcome.commitCount, 1);
  assert.equal(outcome.rollbackCount, 0);
  assert.equal(outcome.state, 'main-menu');
  assert.equal(outcome.currentScreen, outcome.mainMenuRoot);
});

test('Crazy Bird Result Menu accepts a completed signed score of -10', () => {
  const outcome = executeCrazyResultMenuRequest('crazy-bird', -10);

  assert.equal(outcome.commitCount, 1);
  assert.equal(outcome.rollbackCount, 0);
  assert.equal(outcome.state, 'main-menu');
  assert.equal(outcome.currentScreen, outcome.mainMenuRoot);
});

test('both Crazy Result Menu paths enforce the complete signed-int32 score boundary', () => {
  for (const mode of ['crazy', 'crazy-bird'] as const) {
    for (const completedRunScore of [-0x8000_0000, 0x7fff_ffff]) {
      const outcome = executeCrazyResultMenuRequest(mode, completedRunScore);
      assert.equal(outcome.commitCount, 1);
      assert.equal(outcome.rollbackCount, 0);
      assert.equal(outcome.state, 'main-menu');
    }
    for (const completedRunScore of [-0x8000_0001, 0x8000_0000, 0.5]) {
      const outcome = executeCrazyResultMenuRequest(mode, completedRunScore);
      assert.equal(outcome.commitCount, 0);
      assert.equal(outcome.rollbackCount, 1);
      assert.equal(outcome.state, mode);
    }
  }
});

for (const route of ['crazy', 'crazy-bird'] as const) {
  const label = route === 'crazy' ? 'Crazy' : 'Crazy Bird';

  test(`direct fatal ${label} activation keeps every Mode Select lease quiescent`, () => {
    const fatal = new ExecutableCrazyLifecycleRollbackError(
      `injected direct fatal ${label} ownership`,
    );
    const outcome = executeCrazyActivationFailure(route, fatal);

    assert.ok(outcome.thrown instanceof ExecutableModeSelectFatalNavigationError);
    assert.equal(outcome.state, 'failed');
    assert.equal(outcome.currentScreen, null);
    assert.equal(outcome.modeSelectRoot.parent, null);
    assert.equal(outcome.filterActive, false);
    assert.equal(outcome.filterReactivationCount, 0);
    assert.equal(outcome.inputLeaseHeld, false);
    assert.equal(outcome.inputRearmCount, 0);
    assert.equal(outcome.transitionFailureCount, 1);
  });

  test(`nested masked fatal ${label} activation keeps every Mode Select lease quiescent`, () => {
    const fatal = new ExecutableCrazyLifecycleRollbackError(
      `injected nested fatal ${label} ownership`,
    );
    const cleanupFailure = new Error(`injected ${label} cleanup failure`);
    const masked = Object.assign(
      new Error(`injected masked ${label} activation failure`),
      {
        cause: Object.assign(
          new Error(`injected nested ${label} activation aggregate`),
          {
            errors: Object.freeze([fatal, cleanupFailure]),
          },
        ),
      },
    );
    const outcome = executeCrazyActivationFailure(route, masked);

    assert.ok(outcome.thrown instanceof ExecutableModeSelectFatalNavigationError);
    assert.equal(outcome.state, 'failed');
    assert.equal(outcome.currentScreen, null);
    assert.equal(outcome.modeSelectRoot.parent, null);
    assert.equal(outcome.filterActive, false);
    assert.equal(outcome.filterReactivationCount, 0);
    assert.equal(outcome.inputLeaseHeld, false);
    assert.equal(outcome.inputRearmCount, 0);
    assert.equal(outcome.transitionFailureCount, 1);
  });

  test(`nonfatal ${label} activation completely restores and rearms Mode Select`, () => {
    const outcome = executeCrazyActivationFailure(
      route,
      new Error(`injected nonfatal ${label} activation failure`),
    );

    assert.equal(outcome.thrown, null);
    assert.equal(outcome.result, false);
    assert.equal(outcome.state, 'mode-select');
    assert.equal(outcome.currentScreen, outcome.modeSelectRoot);
    assert.notEqual(outcome.modeSelectRoot.parent, null);
    assert.equal(outcome.filterActive, true);
    assert.equal(outcome.filterReactivationCount, 1);
    assert.equal(outcome.inputLeaseHeld, true);
    assert.equal(outcome.inputRearmCount, 1);
    assert.equal(outcome.transitionFailureCount, 1);
  });
}

test('Classic Bird transaction helpers execute malformed and partial-root failure paths', () => {
  const isValid = (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  );
  const normalizeError = compileSourceFunction<
    (error: unknown, fallback: string) => Error
  >('normalizeError');
  const errors: unknown[] = [];
  const testConsole = { error: (error: unknown) => errors.push(error) };
  const resultCapture = compileSourceFunction<
    (request: unknown) => Readonly<{
      request: Readonly<{
        commit(previousRoot: ExecutableScreenNode): void;
        rollback(): void;
        root: ExecutableScreenNode;
      }> | null;
      rollback: (() => void) | null;
    }>
  >(
    'captureClassicBirdResultMenuNavigationRequest',
    { Node: ExecutableScreenNode, isValid },
  );
  const quitCapture = compileSourceFunction<
    (request: unknown) => Readonly<{
      request: Readonly<{
        commit(previousRoot: ExecutableScreenNode): void;
        rollback(): void;
        root: ExecutableScreenNode;
      }> | null;
      rollback: (() => void) | null;
    }>
  >(
    'captureClassicBirdPauseQuitNavigationRequest',
    { Node: ExecutableScreenNode, isValid },
  );
  const runBestEffortCleanup = compileSourceFunction<
    (label: string, operations: readonly (() => void)[]) => readonly Error[]
  >('runBestEffortCleanup', {
    console: testConsole,
    normalizeError,
  });
  const reject = compileSourceFunction<
    (
      rollback: (() => void) | null,
      source: 'Classic Bird Pause Quit' | 'Classic Bird Result',
    ) => readonly Error[]
  >(
    'rollbackRejectedClassicBirdNavigationRequest',
    { runBestEffortCleanup },
  );

  assert.equal(resultCapture(null).request, null);
  assert.equal(quitCapture(undefined).request, null);
  assert.equal(resultCapture({
    commit() {},
    completedRunScore: Number.NaN,
    resultRoot: new ExecutableScreenNode(),
    rollback() {},
  }).request, null);
  assert.equal(quitCapture({
    classicBirdRoot: Object.assign(new ExecutableScreenNode(), { destroyed: true }),
    commit() {},
    rollback() {},
  }).request, null);
  const validResultRoot = new ExecutableScreenNode();
  const capturedResult = resultCapture({
    commit() {},
    completedRunScore: 42,
    resultRoot: validResultRoot,
    rollback() {},
  });
  assert.equal(capturedResult.request?.root, validResultRoot);

  let rollbackCount = 0;
  assert.equal(reject(() => { rollbackCount += 1; }, 'Classic Bird Result').length, 0);
  assert.equal(rollbackCount, 1);
  const rejectedFailures = reject(
    () => {
      throw new Error('injected rejected Bird rollback failure');
    },
    'Classic Bird Pause Quit',
  );
  assert.equal(rejectedFailures.length, 1);
  assert.equal(errors.length, 1);

  const commit = compileSourceFunction<
    (
      request: Readonly<{ commit(previousRoot: ExecutableScreenNode): void }>,
      previousRoot: ExecutableScreenNode,
      source: 'Classic Bird Pause Quit' | 'Classic Bird Result',
    ) => void
  >(
    'commitClassicBirdMainMenuNavigationRequest',
    { console: testConsole, normalizeError },
  );
  const previousRoot = new ExecutableScreenNode();
  let committed = false;
  let commitCalls = 0;
  assert.doesNotThrow(() => commit({
    commit() {
      commitCalls += 1;
      if (committed) {
        return;
      }
      committed = true;
      throw new Error('injected post-commit Bird failure');
    },
  }, previousRoot, 'Classic Bird Result'));
  assert.equal(commitCalls, 2);
  assert.equal(committed, true);

  const restore = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      previous: ExecutableScreenNode,
    ) => void
  >('restoreModeSelectAfterFailedClassicBirdActivation', { isValid });
  const detachedModeSelect = new ExecutableScreenNode();
  const emptyScene = new ExecutableSharedScene();
  restore.call({ requireSharedScene: () => emptyScene }, detachedModeSelect);
  assert.equal(emptyScene.currentScreen, detachedModeSelect);

  const restoreBirdRoot = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      root: ExecutableScreenNode,
    ) => void
  >('restoreClassicBirdNavigationRootBeforeRollback', { isValid });
  const birdRoot = new ExecutableScreenNode();
  const failedMenuRoot = new ExecutableScreenNode();
  const rollbackScene = new ExecutableSharedScene(failedMenuRoot);
  restoreBirdRoot.call({ requireSharedScene: () => rollbackScene }, birdRoot);
  assert.equal(rollbackScene.currentScreen, birdRoot);
  assert.equal(failedMenuRoot.parent, null);
});

test('incomplete Classic Bird activation rollback fails the shell and never returns rejection', () => {
  const isValid = (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  );
  const errorMessage = compileSourceFunction<(error: unknown) => string>('errorMessage');
  const aggregateWithPrimaryError = compileSourceFunction<
    (label: string, primary: unknown, secondary: readonly unknown[]) => Error
  >('aggregateWithPrimaryError', { errorMessage });
  class TestFatalNavigationError extends Error {
    readonly cause: unknown;

    constructor(message: string, cause: unknown) {
      super(`${message}: ${String(cause)}`);
      this.cause = cause;
    }
  }
  class TestBirdLifecycleRollbackError extends Error {}
  const transition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      transaction: Readonly<{
        destination: string;
        root: ExecutableScreenNode;
      }>,
    ) => boolean
  >('transitionModeSelectToClassicBird', {
    aggregateWithPrimaryError,
    ClassicBirdLifecycleRollbackError: TestBirdLifecycleRollbackError,
    ModeSelectFatalNavigationError: TestFatalNavigationError,
  });
  const runTransition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      from: string,
      to: string,
      operation: () => boolean,
    ) => boolean
  >('runTransition', {
    ModeSelectFatalNavigationError: TestFatalNavigationError,
  });
  const restore = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      root: ExecutableScreenNode,
    ) => void
  >('restoreModeSelectAfterFailedClassicBirdActivation', { isValid });

  const modeSelectRoot = new ExecutableScreenNode();
  const sharedScene = new ExecutableSharedScene(modeSelectRoot);
  const partialBirdRoot = new ExecutableScreenNode();
  let filterActive = true;
  let filterReacquireCount = 0;
  let transitionFailureCount = 0;
  let suspended = false;
  const shell: Record<string, unknown> = {
    activeModeSelect: {
      dispose: () => true,
      root: modeSelectRoot,
      suspendForTransition() {
        suspended = true;
        return true;
      },
    },
    captureModeSelectFatalScreenRelease: () => () => {},
    destroyedValue: false,
    emitTransitionFailure() {
      transitionFailureCount += 1;
    },
    requireClassicBirdGameplayController: () => ({
      activateClassicBirdFromAppShell() {
        sharedScene.attachCurrentScreen(partialBirdRoot);
        throw new Error('injected Classic Bird activation failure');
      },
      prepared: true,
    }),
    requireNonClassicPhysics: () => ({
      activateCollisionFilter() {
        filterReacquireCount += 1;
        throw new Error('injected Bird filter reacquisition failure');
      },
      get collisionFilterActive() {
        return filterActive;
      },
      restorePreviousCollisionFilter() {
        filterActive = false;
        return true;
      },
    }),
    requireSharedScene: () => sharedScene,
    restoreModeSelectAfterFailedClassicBirdActivation(root: ExecutableScreenNode) {
      restore.call(this as never, root);
    },
    runTransition(from: string, to: string, operation: () => boolean) {
      return runTransition.call(this, from, to, operation);
    },
    stateValue: 'mode-select',
    transitioning: false,
  };

  assert.throws(
    () => transition.call(shell, {
      destination: 'ClassicBirdLayer',
      root: modeSelectRoot,
    }),
    /Mode Select to Classic Bird rollback is incomplete[\s\S]*injected Bird filter reacquisition failure/,
  );
  assert.equal(shell.stateValue, 'failed');
  assert.equal(sharedScene.currentScreen, modeSelectRoot);
  assert.equal(partialBirdRoot.parent, null);
  assert.equal(suspended, true);
  assert.equal(filterReacquireCount, 1);
  assert.equal(transitionFailureCount, 1);
});

test('poisoned Classic Bird runtime ownership fails closed after shell rollback succeeds', () => {
  const isValid = (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  );
  const errorMessage = compileSourceFunction<(error: unknown) => string>('errorMessage');
  const aggregateWithPrimaryError = compileSourceFunction<
    (label: string, primary: unknown, secondary: readonly unknown[]) => Error
  >('aggregateWithPrimaryError', { errorMessage });
  class TestFatalNavigationError extends Error {
    readonly cause: unknown;

    constructor(message: string, cause: unknown) {
      super(message);
      this.cause = cause;
    }
  }
  class TestBirdLifecycleRollbackError extends Error {}
  const transition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      transaction: Readonly<{
        destination: string;
        root: ExecutableScreenNode;
      }>,
    ) => boolean
  >('transitionModeSelectToClassicBird', {
    aggregateWithPrimaryError,
    ClassicBirdLifecycleRollbackError: TestBirdLifecycleRollbackError,
    ModeSelectFatalNavigationError: TestFatalNavigationError,
  });
  const runTransition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      from: string,
      to: string,
      operation: () => boolean,
    ) => boolean
  >('runTransition', {
    ModeSelectFatalNavigationError: TestFatalNavigationError,
  });
  const restore = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      root: ExecutableScreenNode,
    ) => void
  >('restoreModeSelectAfterFailedClassicBirdActivation', { isValid });

  const modeSelectRoot = new ExecutableScreenNode();
  const sharedScene = new ExecutableSharedScene(modeSelectRoot);
  let filterActive = true;
  let transitionFailureCount = 0;
  const poisoned = new TestBirdLifecycleRollbackError(
    'injected poisoned Classic Bird ownership',
  );
  const shell: Record<string, unknown> = {
    activeModeSelect: {
      dispose: () => true,
      root: modeSelectRoot,
      rearmNavigationAfterFailure: () => true,
      suspendForTransition: () => true,
    },
    captureModeSelectFatalScreenRelease: () => () => {},
    destroyedValue: false,
    emitTransitionFailure() {
      transitionFailureCount += 1;
    },
    requireClassicBirdGameplayController: () => ({
      activateClassicBirdFromAppShell() {
        throw poisoned;
      },
      prepared: true,
    }),
    requireNonClassicPhysics: () => ({
      activateCollisionFilter() {
        filterActive = true;
        return true;
      },
      get collisionFilterActive() {
        return filterActive;
      },
      restorePreviousCollisionFilter() {
        filterActive = false;
        return true;
      },
    }),
    requireSharedScene: () => sharedScene,
    restoreModeSelectAfterFailedClassicBirdActivation(root: ExecutableScreenNode) {
      restore.call(this as never, root);
    },
    runTransition(from: string, to: string, operation: () => boolean) {
      return runTransition.call(this, from, to, operation);
    },
    stateValue: 'mode-select',
    transitioning: false,
  };

  assert.throws(
    () => transition.call(shell, {
      destination: 'ClassicBirdLayer',
      root: modeSelectRoot,
    }),
    (error: unknown) => (
      error instanceof TestFatalNavigationError
      && error.cause === poisoned
    ),
  );
  assert.equal(shell.stateValue, 'failed');
  assert.equal(sharedScene.currentScreen, modeSelectRoot);
  assert.equal(filterActive, true);
  assert.equal(transitionFailureCount, 1);
});

test('failed nonfatal Classic Bird activation restores and rearms every Mode Select lease', () => {
  const isValid = (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  );
  const errorMessage = compileSourceFunction<(error: unknown) => string>('errorMessage');
  const aggregateWithPrimaryError = compileSourceFunction<
    (label: string, primary: unknown, secondary: readonly unknown[]) => Error
  >('aggregateWithPrimaryError', { errorMessage });
  class TestFatalNavigationError extends Error {
    readonly cause: unknown;

    constructor(message: string, cause: unknown) {
      super(`${message}: ${String(cause)}`);
      this.cause = cause;
    }
  }
  class TestBirdLifecycleRollbackError extends Error {}
  const transition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      transaction: Readonly<{
        destination: string;
        root: ExecutableScreenNode;
      }>,
    ) => boolean
  >('transitionModeSelectToClassicBird', {
    aggregateWithPrimaryError,
    ClassicBirdLifecycleRollbackError: TestBirdLifecycleRollbackError,
    ModeSelectFatalNavigationError: TestFatalNavigationError,
  });
  const runTransition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      from: string,
      to: string,
      operation: () => boolean,
    ) => boolean
  >('runTransition', {
    ModeSelectFatalNavigationError: TestFatalNavigationError,
  });
  const restore = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      root: ExecutableScreenNode,
    ) => void
  >('restoreModeSelectAfterFailedClassicBirdActivation', { isValid });

  for (const injectedRearmFailure of [
    null,
    new Error('injected Mode Select input lease reacquisition failure'),
  ]) {
    const modeSelectRoot = new ExecutableScreenNode();
    const partialBirdRoot = new ExecutableScreenNode();
    const sharedScene = new ExecutableSharedScene(modeSelectRoot);
    let filterActive = true;
    let inputLeaseHeld = true;
    let rearmCount = 0;
    let transitionFailureCount = 0;
    const oldPresenter = {
      dispose: () => true,
      root: modeSelectRoot,
      rearmNavigationAfterFailure() {
        rearmCount += 1;
        assert.equal(sharedScene.currentScreen, modeSelectRoot);
        assert.equal(filterActive, true);
        if (injectedRearmFailure !== null) {
          throw injectedRearmFailure;
        }
        inputLeaseHeld = true;
        return true;
      },
      suspendForTransition() {
        inputLeaseHeld = false;
        return true;
      },
    };
    const shell: Record<string, unknown> = {
      activeModeSelect: oldPresenter,
      captureModeSelectFatalScreenRelease: () => () => {},
      destroyedValue: false,
      emitTransitionFailure() {
        transitionFailureCount += 1;
      },
      requireClassicBirdGameplayController: () => ({
        activateClassicBirdFromAppShell() {
          sharedScene.attachCurrentScreen(partialBirdRoot);
          throw new Error('injected nonfatal Classic Bird activation failure');
        },
        prepared: true,
      }),
      requireNonClassicPhysics: () => ({
        activateCollisionFilter() {
          filterActive = true;
          return true;
        },
        get collisionFilterActive() {
          return filterActive;
        },
        restorePreviousCollisionFilter() {
          filterActive = false;
          return true;
        },
      }),
      requireSharedScene: () => sharedScene,
      restoreModeSelectAfterFailedClassicBirdActivation(root: ExecutableScreenNode) {
        restore.call(this as never, root);
      },
      runTransition(from: string, to: string, operation: () => boolean) {
        return runTransition.call(this, from, to, operation);
      },
      stateValue: 'mode-select',
      transitioning: false,
    };
    const transaction = {
      destination: 'ClassicBirdLayer',
      root: modeSelectRoot,
    };

    if (injectedRearmFailure === null) {
      assert.equal(transition.call(shell, transaction), false);
      assert.equal(shell.stateValue, 'mode-select');
      assert.equal(inputLeaseHeld, true);
    } else {
      assert.throws(
        () => transition.call(shell, transaction),
        /Mode Select to Classic Bird rollback is incomplete[\s\S]*input lease reacquisition/,
      );
      assert.equal(shell.stateValue, 'failed');
      assert.equal(inputLeaseHeld, false);
    }
    assert.equal(sharedScene.currentScreen, modeSelectRoot);
    assert.equal(partialBirdRoot.parent, null);
    assert.equal(filterActive, true);
    assert.equal(rearmCount, 1);
    assert.equal(transitionFailureCount, 1);
  }
});

test('incomplete Classic activation rollback fails the shell and never returns rejection', () => {
  const isValid = (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  );
  const errorMessage = compileSourceFunction<(error: unknown) => string>('errorMessage');
  const aggregateWithPrimaryError = compileSourceFunction<
    (label: string, primary: unknown, secondary: readonly unknown[]) => Error
  >('aggregateWithPrimaryError', { errorMessage });
  class TestFatalNavigationError extends Error {
    readonly cause: unknown;

    constructor(message: string, cause: unknown) {
      super(`${message}: ${String(cause)}`);
      this.cause = cause;
    }
  }
  const transition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      transaction: Readonly<{
        destination: string;
        root: ExecutableScreenNode;
      }>,
    ) => boolean
  >('transitionModeSelectToClassic', {
    aggregateWithPrimaryError,
    ModeSelectFatalNavigationError: TestFatalNavigationError,
  });
  const runTransition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      from: string,
      to: string,
      operation: () => boolean,
    ) => boolean
  >('runTransition', {
    ModeSelectFatalNavigationError: TestFatalNavigationError,
  });
  const restore = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      root: ExecutableScreenNode,
    ) => void
  >('restoreModeSelectAfterFailedClassicActivation', { isValid });

  const modeSelectRoot = new ExecutableScreenNode();
  const sharedScene = new ExecutableSharedScene(modeSelectRoot);
  const partialClassicRoot = new ExecutableScreenNode();
  let filterActive = true;
  let filterReacquireCount = 0;
  let transitionFailureCount = 0;
  let suspended = false;
  const shell: Record<string, unknown> = {
    activeModeSelect: {
      dispose: () => true,
      root: modeSelectRoot,
      suspendForTransition() {
        suspended = true;
        return true;
      },
    },
    captureModeSelectFatalScreenRelease: () => () => {},
    destroyedValue: false,
    emitTransitionFailure() {
      transitionFailureCount += 1;
    },
    requireGameplayController: () => ({
      activateClassicFromAppShell() {
        sharedScene.attachCurrentScreen(partialClassicRoot);
        throw new Error('injected Classic activation failure');
      },
    }),
    requireNonClassicPhysics: () => ({
      activateCollisionFilter() {
        filterReacquireCount += 1;
        throw new Error('injected Classic filter reacquisition failure');
      },
      get collisionFilterActive() {
        return filterActive;
      },
      restorePreviousCollisionFilter() {
        filterActive = false;
        return true;
      },
    }),
    requireSharedScene: () => sharedScene,
    restoreModeSelectAfterFailedClassicActivation(root: ExecutableScreenNode) {
      restore.call(this as never, root);
    },
    runTransition(from: string, to: string, operation: () => boolean) {
      return runTransition.call(this, from, to, operation);
    },
    stateValue: 'mode-select',
    transitioning: false,
  };

  assert.throws(
    () => transition.call(shell, {
      destination: 'ClassicModeLayer',
      root: modeSelectRoot,
    }),
    /Mode Select to Classic rollback is incomplete[\s\S]*injected Classic filter reacquisition failure/,
  );
  assert.equal(shell.stateValue, 'failed');
  assert.equal(sharedScene.currentScreen, modeSelectRoot);
  assert.equal(partialClassicRoot.parent, null);
  assert.equal(suspended, true);
  assert.equal(filterReacquireCount, 1);
  assert.equal(transitionFailureCount, 1);
});

test('post-mutation collision-filter release failure repairs the mask before rejection', () => {
  const isValid = (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  );
  class TestFatalNavigationError extends Error {}
  class TestBirdLifecycleRollbackError extends Error {}
  const errorMessage = compileSourceFunction<(error: unknown) => string>('errorMessage');
  const aggregateWithPrimaryError = compileSourceFunction<
    (label: string, primary: unknown, secondary: readonly unknown[]) => Error
  >('aggregateWithPrimaryError', { errorMessage });
  const transition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      transaction: Readonly<{
        destination: string;
        root: ExecutableScreenNode;
      }>,
    ) => boolean
  >('transitionModeSelectToClassicBird', {
    aggregateWithPrimaryError,
    ClassicBirdLifecycleRollbackError: TestBirdLifecycleRollbackError,
    ModeSelectFatalNavigationError: TestFatalNavigationError,
  });
  const runTransition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      from: string,
      to: string,
      operation: () => boolean,
    ) => boolean
  >('runTransition', {
    ModeSelectFatalNavigationError: TestFatalNavigationError,
  });
  const restore = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      root: ExecutableScreenNode,
    ) => void
  >('restoreModeSelectAfterFailedClassicBirdActivation', { isValid });

  const recoveredMask = 0xfffc;
  const previousMask = 0x1234;
  let mask = recoveredMask;
  let activationCalls = 0;
  let transitionFailureCount = 0;
  const modeSelectRoot = new ExecutableScreenNode();
  const sharedScene = new ExecutableSharedScene(modeSelectRoot);
  const shell: Record<string, unknown> = {
    activeModeSelect: {
      dispose: () => true,
      root: modeSelectRoot,
      rearmNavigationAfterFailure: () => true,
      suspendForTransition: () => true,
    },
    destroyedValue: false,
    emitTransitionFailure() {
      transitionFailureCount += 1;
    },
    requireClassicBirdGameplayController: () => ({
      activateClassicBirdFromAppShell() {
        activationCalls += 1;
      },
      prepared: true,
    }),
    requireNonClassicPhysics: () => ({
      activateCollisionFilter() {
        mask = recoveredMask;
        return false;
      },
      get collisionFilterActive() {
        return mask === recoveredMask;
      },
      restorePreviousCollisionFilter() {
        mask = previousMask;
        throw new Error('injected post-mutation release failure');
      },
    }),
    requireSharedScene: () => sharedScene,
    restoreModeSelectAfterFailedClassicBirdActivation(root: ExecutableScreenNode) {
      restore.call(this as never, root);
    },
    runTransition(from: string, to: string, operation: () => boolean) {
      return runTransition.call(this, from, to, operation);
    },
    stateValue: 'mode-select',
    transitioning: false,
  };

  assert.equal(transition.call(shell, {
    destination: 'ClassicBirdLayer',
    root: modeSelectRoot,
  }), false);
  assert.equal(shell.stateValue, 'mode-select');
  assert.equal(sharedScene.currentScreen, modeSelectRoot);
  assert.equal(mask, recoveredMask);
  assert.equal(activationCalls, 0);
  assert.equal(transitionFailureCount, 1);
});

test('failed Crazy Main Menu activation releases destination leases before producer rollback', () => {
  const runBestEffortCleanup = compileSourceFunction<
    (label: string, operations: readonly (() => void)[]) => readonly Error[]
  >('runBestEffortCleanup');
  const transition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      request: Readonly<{
        root: ExecutableScreenNode;
        commit(previousRoot: ExecutableScreenNode): void;
        rollback(): void;
      }>,
      expectedState: 'crazy',
      source: 'Crazy Pause Quit',
    ) => void
  >('transitionTimedCrazyToMainMenu', { runBestEffortCleanup });
  const isValid = (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  );
  const restore = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      root: ExecutableScreenNode,
    ) => void
  >('restoreCrazyNavigationRootBeforeRollback', { isValid });

  const timeline: string[] = [];
  const crazyRoot = new ExecutableScreenNode();
  const menuRoot = new ExecutableScreenNode();
  const sharedScene = new ExecutableSharedScene(crazyRoot);
  const originalReplace = sharedScene.replaceCurrentScreen.bind(sharedScene);
  sharedScene.replaceCurrentScreen = (nextScreen) => {
    timeline.push(nextScreen === menuRoot ? 'screen:menu' : 'screen:crazy');
    return originalReplace(nextScreen);
  };
  const request = {
    commit() {
      timeline.push('producer:commit');
    },
    rollback() {
      assert.equal(sharedScene.currentScreen, crazyRoot);
      timeline.push('producer:rollback');
    },
    root: crazyRoot,
  };
  const shell = {
    activeMainMenu: null,
    createMainMenuPresenter() {
      timeline.push('menu:create');
      return {
        activate() {
          timeline.push('menu:activate');
          throw new Error('injected Main Menu activation failure');
        },
        dispose() {
          timeline.push('menu:dispose');
        },
        root: menuRoot,
      };
    },
    destroyedValue: false,
    emitTransitionFailure() {
      timeline.push('transition:failed');
    },
    requireGameplayController: () => ({
      sharedAudioPresenter: {
        stopBackgroundMusic() {
          timeline.push('audio:stop');
        },
      },
    }),
    requireNonClassicPhysics: () => ({
      activateCollisionFilter() {
        timeline.push('filter:activate');
        return true;
      },
      restorePreviousCollisionFilter() {
        timeline.push('filter:restore');
      },
    }),
    requireSharedScene: () => sharedScene,
    restoreCrazyNavigationRootBeforeRollback(root: ExecutableScreenNode) {
      restore.call(this, root);
    },
    stateValue: 'crazy',
    transitioning: false,
  };

  transition.call(shell, request, 'crazy', 'Crazy Pause Quit');
  assert.deepEqual(timeline, [
    'filter:activate',
    'menu:create',
    'screen:menu',
    'menu:activate',
    'screen:crazy',
    'menu:dispose',
    'audio:stop',
    'filter:restore',
    'producer:rollback',
    'transition:failed',
  ]);
});

test('Crazy Bird Main Menu rollback failure retains a fatal shell state', () => {
  const normalizeError = compileSourceFunction<
    (error: unknown, fallback: string) => Error
  >('normalizeError');
  const errorMessage = compileSourceFunction<(error: unknown) => string>('errorMessage');
  const aggregateWithPrimaryError = compileSourceFunction<
    (label: string, primary: unknown, secondary: readonly unknown[]) => Error
  >('aggregateWithPrimaryError', { errorMessage });
  const runBestEffortCleanup = compileSourceFunction<
    (label: string, operations: readonly (() => void)[]) => readonly Error[]
  >('runBestEffortCleanup', {
    console: { error() {} },
    normalizeError,
  });
  const transition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      request: Readonly<{
        root: ExecutableScreenNode;
        commit(previousRoot: ExecutableScreenNode): void;
        rollback(): void;
      }>,
      expectedState: 'crazy-bird',
      source: 'Crazy Bird Pause Quit',
    ) => void
  >('transitionTimedCrazyToMainMenu', {
    aggregateWithPrimaryError,
    runBestEffortCleanup,
  });
  const isValid = (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  );
  const restore = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      root: ExecutableScreenNode,
    ) => void
  >('restoreCrazyNavigationRootBeforeRollback', { isValid });

  const birdRoot = new ExecutableScreenNode();
  const menuRoot = new ExecutableScreenNode();
  const sharedScene = new ExecutableSharedScene(birdRoot);
  let collisionFilterActive = false;
  const reported: Error[] = [];
  const shell: Record<string, unknown> = {
    activeMainMenu: null,
    createMainMenuPresenter: () => ({
      activate() {
        throw new Error('injected Crazy Bird menu activation failure');
      },
      dispose() {},
      root: menuRoot,
    }),
    destroyedValue: false,
    emitTransitionFailure(_from: string, _to: string, error: unknown) {
      reported.push(error instanceof Error ? error : new Error(String(error)));
    },
    requireGameplayController: () => ({
      sharedAudioPresenter: {
        stopBackgroundMusic() {},
      },
    }),
    requireNonClassicPhysics: () => ({
      activateCollisionFilter() {
        collisionFilterActive = true;
        return true;
      },
      get collisionFilterActive() {
        return collisionFilterActive;
      },
      restorePreviousCollisionFilter() {
        collisionFilterActive = false;
      },
    }),
    requireSharedScene: () => sharedScene,
    assertCrazyNavigationRollbackRestored(root: ExecutableScreenNode) {
      assert.equal(sharedScene.currentScreen, root);
      assert.equal(collisionFilterActive, false);
    },
    restoreCrazyNavigationRootBeforeRollback(root: ExecutableScreenNode) {
      restore.call(this as never, root);
    },
    retainCrazyBirdShellFailure(from: string, error: unknown) {
      this.stateValue = 'failed';
      this.emitTransitionFailure(from, 'main-menu', error);
    },
    stateValue: 'crazy-bird',
    transitioning: false,
  };

  transition.call(shell, {
    commit() {},
    rollback() {
      throw new Error('injected Crazy Bird producer rollback failure');
    },
    root: birdRoot,
  }, 'crazy-bird', 'Crazy Bird Pause Quit');

  assert.equal(shell.stateValue, 'failed');
  assert.equal(reported.length, 1);
  assert.match(
    reported[0]?.message ?? '',
    /injected Crazy Bird menu activation failure[\s\S]*injected Crazy Bird producer rollback failure/,
  );
});

test('failed Classic Bird Main Menu activation restores source before producer rollback', () => {
  const normalizeError = compileSourceFunction<
    (error: unknown, fallback: string) => Error
  >('normalizeError');
  const runBestEffortCleanup = compileSourceFunction<
    (label: string, operations: readonly (() => void)[]) => readonly Error[]
  >('runBestEffortCleanup', {
    console: { error() {} },
    normalizeError,
  });
  const transition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      request: Readonly<{
        root: ExecutableScreenNode;
        commit(previousRoot: ExecutableScreenNode): void;
        rollback(): void;
      }>,
      source: 'Classic Bird Pause Quit',
    ) => void
  >('transitionClassicBirdToMainMenu', { runBestEffortCleanup });
  const isValid = (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  );
  const restore = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      root: ExecutableScreenNode,
    ) => void
  >('restoreClassicBirdNavigationRootBeforeRollback', { isValid });

  const timeline: string[] = [];
  const birdRoot = new ExecutableScreenNode();
  const menuRoot = new ExecutableScreenNode();
  const sharedScene = new ExecutableSharedScene(birdRoot);
  let collisionFilterActive = false;
  const originalReplace = sharedScene.replaceCurrentScreen.bind(sharedScene);
  sharedScene.replaceCurrentScreen = (nextScreen) => {
    timeline.push(nextScreen === menuRoot ? 'screen:menu' : 'screen:bird');
    return originalReplace(nextScreen);
  };
  const request = {
    commit() {
      timeline.push('producer:commit');
    },
    rollback() {
      assert.equal(sharedScene.currentScreen, birdRoot);
      timeline.push('producer:rollback');
    },
    root: birdRoot,
  };
  const shell = {
    activeMainMenu: null,
    createMainMenuPresenter() {
      timeline.push('menu:create');
      return {
        activate() {
          timeline.push('menu:activate');
          throw new Error('injected Main Menu activation failure');
        },
        dispose() {
          timeline.push('menu:dispose');
        },
        root: menuRoot,
      };
    },
    destroyedValue: false,
    emitTransitionFailure() {
      timeline.push('transition:failed');
    },
    requireGameplayController: () => ({
      sharedAudioPresenter: {
        stopBackgroundMusic() {
          timeline.push('audio:stop');
        },
      },
    }),
    requireNonClassicPhysics: () => ({
      activateCollisionFilter() {
        timeline.push('filter:activate');
        collisionFilterActive = true;
        return true;
      },
      get collisionFilterActive() {
        return collisionFilterActive;
      },
      restorePreviousCollisionFilter() {
        timeline.push('filter:restore');
        collisionFilterActive = false;
        return true;
      },
    }),
    requireSharedScene: () => sharedScene,
    assertClassicBirdNavigationRollbackRestored(root: ExecutableScreenNode) {
      assert.equal(sharedScene.currentScreen, root);
      assert.equal(collisionFilterActive, false);
    },
    restoreClassicBirdNavigationRootBeforeRollback(root: ExecutableScreenNode) {
      restore.call(this, root);
    },
    stateValue: 'classic-bird',
    transitioning: false,
  };

  transition.call(shell, request, 'Classic Bird Pause Quit');
  assert.deepEqual(timeline, [
    'filter:activate',
    'menu:create',
    'screen:menu',
    'menu:activate',
    'screen:bird',
    'menu:dispose',
    'audio:stop',
    'filter:restore',
    'producer:rollback',
    'transition:failed',
  ]);
});

test('Classic Bird Main Menu rollback failures aggregate and retain failed shell state', () => {
  const normalizeError = compileSourceFunction<
    (error: unknown, fallback: string) => Error
  >('normalizeError');
  const errorMessage = compileSourceFunction<(error: unknown) => string>('errorMessage');
  const aggregateWithPrimaryError = compileSourceFunction<
    (label: string, primary: unknown, secondary: readonly unknown[]) => Error
  >('aggregateWithPrimaryError', { errorMessage });
  const cleanupDiagnostics: unknown[] = [];
  const runBestEffortCleanup = compileSourceFunction<
    (label: string, operations: readonly (() => void)[]) => readonly Error[]
  >('runBestEffortCleanup', {
    console: { error: (error: unknown) => cleanupDiagnostics.push(error) },
    normalizeError,
  });
  const transition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      request: Readonly<{
        root: ExecutableScreenNode;
        commit(previousRoot: ExecutableScreenNode): void;
        rollback(): void;
      }>,
      source: 'Classic Bird Result',
    ) => void
  >('transitionClassicBirdToMainMenu', {
    aggregateWithPrimaryError,
    console: { error() {} },
    normalizeError,
    runBestEffortCleanup,
  });

  const birdRoot = new ExecutableScreenNode();
  const menuRoot = new ExecutableScreenNode();
  const sharedScene = new ExecutableSharedScene(birdRoot);
  const reported: Error[] = [];
  const request = {
    commit() {},
    rollback() {
      throw new Error('injected producer rollback failure');
    },
    root: birdRoot,
  };
  const shell: Record<string, unknown> = {
    activeMainMenu: null,
    createMainMenuPresenter: () => ({
      activate() {
        throw new Error('injected Main Menu activation failure');
      },
      dispose() {
        throw new Error('injected Main Menu disposal failure');
      },
      root: menuRoot,
    }),
    destroyedValue: false,
    emitTransitionFailure(_from: string, _to: string, error: unknown) {
      reported.push(error instanceof Error ? error : new Error(String(error)));
    },
    requireGameplayController: () => ({
      sharedAudioPresenter: {
        stopBackgroundMusic() {
          throw new Error('injected audio cleanup failure');
        },
      },
    }),
    requireNonClassicPhysics: () => ({
      activateCollisionFilter: () => true,
      get collisionFilterActive() {
        return true;
      },
      restorePreviousCollisionFilter() {
        throw new Error('injected filter rollback failure');
      },
    }),
    requireSharedScene: () => sharedScene,
    assertClassicBirdNavigationRollbackRestored() {
      throw new Error('injected final rollback invariant failure');
    },
    restoreClassicBirdNavigationRootBeforeRollback() {
      throw new Error('injected source-root rollback failure');
    },
    retainClassicBirdShellFailure(
      from: string,
      error: unknown,
    ) {
      this.stateValue = 'failed';
      this.emitTransitionFailure(from, 'main-menu', error);
    },
    stateValue: 'classic-bird',
    transitioning: false,
  };

  transition.call(shell, request, 'Classic Bird Result');

  assert.equal(shell.stateValue, 'failed');
  assert.equal(reported.length, 1);
  for (const message of [
    'injected Main Menu activation failure',
    'injected source-root rollback failure',
    'injected Main Menu disposal failure',
    'injected audio cleanup failure',
    'injected filter rollback failure',
    'injected producer rollback failure',
    'injected final rollback invariant failure',
  ]) {
    assert.match(reported[0]?.message ?? '', new RegExp(message));
  }
  assert.equal(cleanupDiagnostics.length, 1);
});

test('rejected Classic Bird Main Menu rollback failures retain failed shell state', () => {
  const isValid = (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  );
  const normalizeError = compileSourceFunction<
    (error: unknown, fallback: string) => Error
  >('normalizeError');
  const errorMessage = compileSourceFunction<(error: unknown) => string>('errorMessage');
  const aggregateWithPrimaryError = compileSourceFunction<
    (label: string, primary: unknown, secondary: readonly unknown[]) => Error
  >('aggregateWithPrimaryError', { errorMessage });
  const runBestEffortCleanup = compileSourceFunction<
    (label: string, operations: readonly (() => void)[]) => readonly Error[]
  >('runBestEffortCleanup', {
    console: { error() {} },
    normalizeError,
  });
  const rollbackRejectedClassicBirdNavigationRequest = compileSourceFunction<
    (
      rollback: (() => void) | null,
      source: 'Classic Bird Pause Quit' | 'Classic Bird Result',
    ) => readonly Error[]
  >('rollbackRejectedClassicBirdNavigationRequest', { runBestEffortCleanup });
  const rejectClassicBirdNavigationRequest = compileSourceMethod<
    (
      this: Record<string, unknown>,
      rollback: (() => void) | null,
      source: 'Classic Bird Pause Quit' | 'Classic Bird Result',
    ) => void
  >('rejectClassicBirdNavigationRequest', {
    aggregateWithPrimaryError,
    rollbackRejectedClassicBirdNavigationRequest,
  });
  const captureClassicBirdPauseQuitNavigationRequest = compileSourceFunction<
    (request: unknown) => Readonly<{
      request: unknown;
      rollback: (() => void) | null;
    }>
  >(
    'captureClassicBirdPauseQuitNavigationRequest',
    { Node: ExecutableScreenNode, isValid },
  );
  const rejectedEventHandler = compileSourceArrowMember<
    (this: Record<string, unknown>, request: unknown) => void
  >('onClassicBirdPauseQuitRequested', {
    captureClassicBirdPauseQuitNavigationRequest,
  });
  const transition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      request: Readonly<{
        root: ExecutableScreenNode;
        commit(previousRoot: ExecutableScreenNode): void;
        rollback(): void;
      }>,
      source: 'Classic Bird Pause Quit',
    ) => void
  >('transitionClassicBirdToMainMenu', {
    aggregateWithPrimaryError,
    console: { error() {} },
    normalizeError,
    runBestEffortCleanup,
  });
  const reported: Error[] = [];
  const shell: Record<string, unknown> = {
    destroyedValue: false,
    emitTransitionFailure(_from: string, _to: string, error: unknown) {
      reported.push(error instanceof Error ? error : new Error(String(error)));
    },
    retainClassicBirdShellFailure(
      from: string,
      error: unknown,
    ) {
      this.stateValue = 'failed';
      this.emitTransitionFailure(from, 'main-menu', error);
    },
    rejectClassicBirdNavigationRequest(
      rollback: (() => void) | null,
      source: 'Classic Bird Pause Quit' | 'Classic Bird Result',
    ) {
      rejectClassicBirdNavigationRequest.call(this, rollback, source);
    },
    stateValue: 'classic-bird',
    transitioning: true,
  };

  transition.call(shell, {
    commit() {},
    rollback() {
      throw new Error('injected rejected request rollback failure');
    },
    root: new ExecutableScreenNode(),
  }, 'Classic Bird Pause Quit');

  assert.equal(shell.stateValue, 'failed');
  assert.equal(reported.length, 1);
  assert.match(
    reported[0]?.message ?? '',
    /Rejected Classic Bird Pause Quit[\s\S]*injected rejected request rollback failure/,
  );

  const rejectedEventFailures: Error[] = [];
  const rejectedEventShell: Record<string, unknown> = {
    destroyedValue: false,
    emitTransitionFailure(_from: string, _to: string, error: unknown) {
      rejectedEventFailures.push(
        error instanceof Error ? error : new Error(String(error)),
      );
    },
    rejectClassicBirdNavigationRequest(
      rollback: (() => void) | null,
      source: 'Classic Bird Pause Quit' | 'Classic Bird Result',
    ) {
      rejectClassicBirdNavigationRequest.call(this, rollback, source);
    },
    retainClassicBirdShellFailure(
      from: string,
      error: unknown,
    ) {
      this.stateValue = 'failed';
      this.emitTransitionFailure(from, 'main-menu', error);
    },
    stateValue: 'classic-bird',
    transitionClassicBirdToMainMenu() {
      throw new Error('Rejected Classic Bird payload must not reach transition');
    },
  };
  rejectedEventHandler.call(rejectedEventShell, {
    classicBirdRoot: Object.assign(new ExecutableScreenNode(), { destroyed: true }),
    commit() {},
    rollback() {
      throw new Error('injected malformed-event rollback failure');
    },
  });

  assert.equal(rejectedEventShell.stateValue, 'failed');
  assert.equal(rejectedEventFailures.length, 1);
  assert.match(
    rejectedEventFailures[0]?.message ?? '',
    /Rejected Classic Bird Pause Quit[\s\S]*injected malformed-event rollback failure/,
  );
});

test('Classic Bird event dispatch captures mutable request properties exactly once', () => {
  const isValid = (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  );
  const captureClassicBirdResultMenuNavigationRequest = compileSourceFunction<
    (request: unknown) => Readonly<{
      request: Readonly<{
        commit(previousRoot: ExecutableScreenNode): void;
        rollback(): void;
        root: ExecutableScreenNode;
      }> | null;
      rollback: (() => void) | null;
    }>
  >(
    'captureClassicBirdResultMenuNavigationRequest',
    { Node: ExecutableScreenNode, isValid },
  );
  const handler = compileSourceArrowMember<
    (this: Record<string, unknown>, request: unknown) => void
  >('onClassicBirdResultMenuRequested', {
    captureClassicBirdResultMenuNavigationRequest,
  });
  const firstRoot = new ExecutableScreenNode();
  const changedRoot = new ExecutableScreenNode();
  let rootReads = 0;
  let capturedRoot: ExecutableScreenNode | null = null;
  const payload = {
    get commit() {
      return () => {};
    },
    get completedRunScore() {
      return 5;
    },
    get resultRoot() {
      rootReads += 1;
      return rootReads === 1 ? firstRoot : changedRoot;
    },
    get rollback() {
      return () => {};
    },
  };
  const shell = {
    rejectClassicBirdNavigationRequest() {},
    transitionClassicBirdToMainMenu(
      request: Readonly<{ root: ExecutableScreenNode }>,
    ) {
      capturedRoot = request.root;
    },
  };

  handler.call(shell, payload);

  assert.equal(rootReads, 1);
  assert.equal(capturedRoot, firstRoot);
});

test('unrecovered destinations and platform review fail closed at isolated shell ports', () => {
  const unsupported = extractMethod(SOURCE, 'rejectUnsupportedDestination');
  const review = extractMethod(SOURCE, 'requestPlatformReview');

  assert.match(unsupported, /RECOVERED_APP_SHELL_UNSUPPORTED_DESTINATION_EVENT/);
  assert.match(unsupported, /return false/);
  assert.match(review, /let approved = false/);
  assert.match(review, /approve: \(\) =>/);
  assert.match(review, /RECOVERED_APP_SHELL_PLATFORM_REVIEW_REQUESTED_EVENT/);
  assert.match(review, /return approved/);
  assert.doesNotMatch(SOURCE, /CrazyModePresenter|GNStylePresenter|BirdModePresenter/);
});

test('About direct actions emit only frozen sanitized shell-local payloads', () => {
  const normalizeError = compileSourceFunction<
    (error: unknown, fallback: string) => Error
  >('normalizeError');
  const logged: unknown[] = [];
  const emitRetiredPlatformAction = compileSourceMethod<
    (
      this: Record<string, unknown>,
      event: Readonly<{ readonly action: string; readonly reason: string }>,
    ) => void
  >('emitRetiredPlatformAction', {
    console: { error: (error: unknown) => logged.push(error) },
    normalizeError,
    RECOVERED_APP_SHELL_RETIRED_PLATFORM_ACTION_EVENT:
      'recovered-app-shell-retired-platform-action',
  });
  const emissions: Array<Readonly<{
    readonly eventName: string;
    readonly payload: Record<string, unknown>;
  }>> = [];
  const shell = {
    node: {
      emit(eventName: string, payload: Record<string, unknown>) {
        emissions.push(Object.freeze({ eventName, payload }));
      },
    },
  };

  for (const action of ['review', 'feedback', 'social'] as const) {
    emitRetiredPlatformAction.call(shell, {
      action,
      legacyIdentifier: 'must-not-cross-shell-boundary',
      reason: 'attacker-controlled',
    } as never);
  }
  emitRetiredPlatformAction.call(shell, {
    action: 'unknown',
    reason: 'retired-offline',
  });

  assert.deepEqual(
    emissions.map(({ eventName, payload }) => ({ eventName, payload })),
    [
      {
        eventName: 'recovered-app-shell-retired-platform-action',
        payload: { action: 'review', reason: 'retired-offline' },
      },
      {
        eventName: 'recovered-app-shell-retired-platform-action',
        payload: { action: 'feedback', reason: 'retired-offline' },
      },
      {
        eventName: 'recovered-app-shell-retired-platform-action',
        payload: { action: 'social', reason: 'retired-offline' },
      },
    ],
  );
  for (const emission of emissions) {
    assert.ok(Object.isFrozen(emission.payload));
    assert.deepEqual(Object.keys(emission.payload).sort(), ['action', 'reason']);
  }

  const observerFailure = new Error('injected retired action observer failure');
  const throwingShell = {
    node: {
      emit() {
        throw observerFailure;
      },
    },
  };
  assert.doesNotThrow(() => emitRetiredPlatformAction.call(throwingShell, {
    action: 'review',
    reason: 'retired-offline',
  }));
  assert.equal(logged.length, 1);
  assert.equal(logged[0], observerFailure);

  const boundarySource = [
    extractMethod(SOURCE, 'createAboutPresenter'),
    extractMethod(SOURCE, 'emitRetiredPlatformAction'),
  ].join('\n');
  assert.doesNotMatch(
    boundarySource,
    /mailto:|https?:\/\/|facebook\.com|play\.google|uit\.dev|openURL|XMLHttpRequest|fetch\(/i,
  );
});

test('app shell owns the single application-hide settings save boundary', () => {
  const onEnable = extractMethod(SOURCE, 'onEnable');
  const onDisable = extractMethod(SOURCE, 'onDisable');
  const onHidden = extractMemberBlock(SOURCE, '  private readonly onApplicationHidden = ()');

  assert.match(onEnable, /game\.on\(Game\.EVENT_HIDE, this\.onApplicationHidden, this\)/);
  assert.match(onDisable, /game\.off\(Game\.EVENT_HIDE, this\.onApplicationHidden, this\)/);
  assertOrderedSubstrings(onHidden, [
    'this.activeOptions?.reconcileSelectionsForPersistence()',
    'this.gameplayController.sharedSettingsRuntime.save()',
  ]);
  assert.match(onHidden, /CLASSIC_SETTINGS_SAVE_FAILED_EVENT/);
});

test('application hide persists only reconciled Options selections and retries fail closed', () => {
  const normalizeError = compileSourceFunction<
    (error: unknown, fallback: string) => Error
  >('normalizeError');
  const logged: unknown[] = [];
  const onHidden = compileSourceArrowMember<
    (this: Record<string, unknown>) => void
  >('onApplicationHidden', {
    CLASSIC_SETTINGS_SAVE_FAILED_EVENT: 'settings-save-failed',
    console: { error: (error: unknown) => logged.push(error) },
    normalizeError,
  });
  const selections = {
    selectedBackground: 3,
    selectedBlade: 4,
    selectedTheme: 5,
  };
  const failures: unknown[] = [];
  const saved: Array<Readonly<typeof selections>> = [];
  let reconcileAttempts = 0;
  let saveAttempts = 0;
  const shell = {
    activeOptions: {
      reconcileSelectionsForPersistence() {
        reconcileAttempts += 1;
        if (reconcileAttempts === 1) {
          throw new Error('injected reconciliation failure');
        }
        selections.selectedBackground = 0;
        selections.selectedBlade = 0;
      },
    },
    destroyedValue: false,
    gameplayController: {
      sharedSettingsRuntime: {
        save() {
          saveAttempts += 1;
          if (saveAttempts === 1) {
            throw new Error('injected save failure');
          }
          saved.push(Object.freeze({ ...selections }));
        },
      },
    },
    node: {
      emit(event: string, payload: unknown) {
        failures.push(Object.freeze({ event, payload }));
      },
    },
  };

  onHidden.call(shell);
  assert.equal(reconcileAttempts, 1);
  assert.deepEqual(saved, []);
  assert.equal(failures.length, 1);
  assert.equal(logged.length, 1);

  onHidden.call(shell);
  assert.equal(reconcileAttempts, 2);
  assert.equal(saveAttempts, 1);
  assert.deepEqual(selections, {
    selectedBackground: 0,
    selectedBlade: 0,
    selectedTheme: 5,
  });
  assert.deepEqual(saved, []);
  assert.equal(failures.length, 2);
  assert.equal(logged.length, 2);

  onHidden.call(shell);
  assert.equal(reconcileAttempts, 3);
  assert.equal(saveAttempts, 2);
  assert.deepEqual(saved, [{
    selectedBackground: 0,
    selectedBlade: 0,
    selectedTheme: 5,
  }]);

  onHidden.call(shell);
  assert.equal(reconcileAttempts, 4);
  assert.equal(saveAttempts, 3);
  assert.deepEqual(saved, [
    { selectedBackground: 0, selectedBlade: 0, selectedTheme: 5 },
    { selectedBackground: 0, selectedBlade: 0, selectedTheme: 5 },
  ]);
});

test('teardown and failed boot cannot skip shared Physics2D filter restoration', () => {
  const onDestroy = extractMethod(SOURCE, 'onDestroy');
  const initialize = extractMethod(SOURCE, 'initializeRecoveredApp');
  const cleanup = extractMemberBlock(SOURCE, 'function runBestEffortCleanup(');

  assert.match(onDestroy, /runBestEffortCleanup\('Recovered app shell teardown'/);
  assert.match(onDestroy, /this\.nonClassicPhysics\?\.dispose\(\)/);
  assert.match(initialize, /runBestEffortCleanup\('Recovered app shell failed-boot cleanup'/);
  assert.match(cleanup, /for \(const operation of operations\)/);
  assert.match(cleanup, /catch \(error\)/);
});

function extractMethod(source: string, methodName: string): string {
  const signature = new RegExp(
    `^\\s*(?:private\\s+)?(?:async\\s+)?${methodName}\\b`,
    'm',
  );
  const match = signature.exec(source);
  assert.ok(match, `${methodName} method must exist`);
  return extractBalancedBlock(source, match.index);
}

function extractMemberBlock(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${signature} must exist`);
  return extractBalancedBlock(source, start);
}

function extractBalancedBlock(source: string, start: number): string {
  const openBrace = source.indexOf('{', start);
  assert.notEqual(openBrace, -1, 'member body must start');
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  throw new Error('member body is unterminated');
}

function assertOrderedSubstrings(source: string, values: readonly string[]): void {
  let previous = -1;
  for (const value of values) {
    const current = source.indexOf(value);
    assert.ok(current > previous, `${value} must appear in recovered order`);
    previous = current;
  }
}

function executeObjectivesFatalOwnershipRecovery(
  primary: Error,
  destinationActivationFails: boolean,
): Readonly<{
  readonly activeMainMenu: ExecutableMenuOptionsPresenter | null;
  readonly activeObjectives: ExecutableMenuOptionsPresenter | null;
  readonly currentScreen: ExecutableScreenNode | null;
  readonly destinationPresenter: ExecutableMenuOptionsPresenter;
  readonly recoveryFailures: readonly unknown[];
  readonly reportCount: number;
  readonly reportedPrimary: Error | null;
  readonly sourcePresenter: ExecutableMenuOptionsPresenter;
  readonly state: unknown;
  readonly transitioning: unknown;
}> {
  const collectShellFailure = compileSourceFunction<
    (failures: unknown[], operation: () => unknown) => void
  >('collectShellFailure');
  const normalizeError = compileSourceFunction<
    (error: unknown, fallback: string) => Error
  >('normalizeError');
  const recover = compileSourceMethod<
    (
      this: Record<string, unknown>,
      presenter: ExecutableMenuOptionsPresenter,
      error: unknown,
    ) => void
  >('recoverFromObjectivesFatalOwnership', {
    collectShellFailure,
    normalizeError,
  });
  const sourcePresenter = new ExecutableMenuOptionsPresenter(
    new ExecutableScreenNode(),
    false,
    false,
  );
  sourcePresenter.poisoned = true;
  sourcePresenter.root.activeInHierarchy = false;
  const destinationPresenter = new ExecutableMenuOptionsPresenter(
    new ExecutableScreenNode(),
    destinationActivationFails,
    false,
  );
  const sharedScene = new ExecutableSharedScene(sourcePresenter.root);
  let reportCount = 0;
  let reportedPrimary: Error | null = null;
  let recoveryFailures: readonly unknown[] = [];
  const shell: Record<string, unknown> = {
    activeMainMenu: null,
    activeObjectives: sourcePresenter,
    createMainMenuPresenter: () => destinationPresenter,
    destroyedValue: false,
    reportObjectivesFatalOwnership(
      error: Error,
      failures: readonly unknown[],
    ) {
      reportCount += 1;
      reportedPrimary = error;
      recoveryFailures = [...failures];
    },
    sharedScene,
    stateValue: 'objectives',
    transitioning: false,
  };

  recover.call(shell, sourcePresenter, primary);

  return Object.freeze({
    activeMainMenu:
      shell.activeMainMenu as ExecutableMenuOptionsPresenter | null,
    activeObjectives:
      shell.activeObjectives as ExecutableMenuOptionsPresenter | null,
    currentScreen: sharedScene.currentScreen,
    destinationPresenter,
    recoveryFailures,
    reportCount,
    reportedPrimary,
    sourcePresenter,
    state: shell.stateValue,
    transitioning: shell.transitioning,
  });
}

class ExecutableSharedScene {
  currentScreen: ExecutableScreenNode | null;
  disposed = false;
  private readonly host = new ExecutableScreenNode();
  private readonly initialReplacementFailure: Error | null;
  private readonly rollbackFailure: Error | null;
  private replaceCount = 0;

  constructor(
    currentScreen: ExecutableScreenNode | null = null,
    rollbackFailure: Error | null = null,
    initialReplacementFailure: Error | null = null,
  ) {
    this.currentScreen = currentScreen;
    this.initialReplacementFailure = initialReplacementFailure;
    this.rollbackFailure = rollbackFailure;
    if (currentScreen !== null) {
      currentScreen.parent = this.host;
    }
  }

  attachCurrentScreen(screen: ExecutableScreenNode): void {
    if (this.disposed) {
      throw new Error('Executable shared scene is disposed');
    }
    if (this.currentScreen !== null || screen.parent !== null || screen.destroyed) {
      throw new Error('Executable shared scene requires one valid detached screen');
    }
    screen.parent = this.host;
    this.currentScreen = screen;
  }

  detachCurrentScreen(expectedScreen?: ExecutableScreenNode): ExecutableScreenNode {
    if (this.disposed) {
      throw new Error('Executable shared scene is disposed');
    }
    const current = this.currentScreen;
    if (current === null || (expectedScreen !== undefined && expectedScreen !== current)) {
      throw new Error('Executable shared scene current-screen identity changed before detach');
    }
    current.parent = null;
    this.currentScreen = null;
    return current;
  }

  replaceCurrentScreen(nextScreen: ExecutableScreenNode): ExecutableScreenNode {
    this.replaceCount += 1;
    if (this.replaceCount === 1 && this.initialReplacementFailure !== null) {
      throw this.initialReplacementFailure;
    }
    if (this.replaceCount > 1 && this.rollbackFailure !== null) {
      throw this.rollbackFailure;
    }
    const previous = this.currentScreen;
    if (previous === null) {
      throw new Error('Executable shared scene has no current screen to replace');
    }
    previous.parent = null;
    this.currentScreen = null;
    this.attachCurrentScreen(nextScreen);
    return previous;
  }

  dispose(): boolean {
    if (this.disposed) {
      return false;
    }
    this.disposed = true;
    if (this.currentScreen !== null) {
      this.currentScreen.destroyed = true;
      this.currentScreen.parent = null;
    }
    this.currentScreen = null;
    return true;
  }
}

class ExecutableScreenNode {
  activeInHierarchy = true;
  destroyed = false;
  parent: ExecutableScreenNode | null = null;
}

class ExecutableCrazyLifecycleRollbackError extends Error {}

class ExecutableGnStyleLifecycleRollbackError extends Error {}

class ExecutableModeSelectFatalNavigationError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(`${message}: ${String(cause)}`);
    this.cause = cause;
  }
}

function executeMenuOptionsReplacementFailure(
  route: 'main-menu-to-options' | 'options-to-main-menu',
  incompleteRollback: boolean,
): ReturnType<typeof executeMenuScreenReplacement> {
  return executeMenuScreenReplacement(route, true, incompleteRollback);
}

type ExecutableMenuScreenRoute =
  | 'about-to-main-menu'
  | 'leaderboard-to-main-menu'
  | 'main-menu-to-about'
  | 'main-menu-to-leaderboard'
  | 'main-menu-to-objectives'
  | 'main-menu-to-options'
  | 'objectives-to-main-menu'
  | 'options-to-main-menu';

function executableMenuScreenRouteLabel(route: ExecutableMenuScreenRoute): string {
  switch (route) {
    case 'about-to-main-menu':
      return 'About to Main Menu';
    case 'leaderboard-to-main-menu':
      return 'Leaderboard to Main Menu';
    case 'main-menu-to-about':
      return 'Main Menu to About';
    case 'main-menu-to-leaderboard':
      return 'Main Menu to Leaderboard';
    case 'main-menu-to-objectives':
      return 'Main Menu to Objectives';
    case 'main-menu-to-options':
      return 'Main Menu to Options';
    case 'objectives-to-main-menu':
      return 'Objectives to Main Menu';
    case 'options-to-main-menu':
      return 'Options to Main Menu';
  }
}

interface ExecutableMenuScreenFailureOptions {
  readonly creationFails?: boolean;
  readonly destinationDisposeFailures?: number;
  readonly initialReplacementFails?: boolean;
  readonly rearmFails?: boolean;
  readonly suspensionFails?: boolean;
}

function executeMenuScreenReplacement(
  route: ExecutableMenuScreenRoute,
  activationFails: boolean,
  incompleteRollback: boolean,
  failureOptions: ExecutableMenuScreenFailureOptions = {},
): Readonly<{
  readonly activeAbout: ExecutableMenuOptionsPresenter | null;
  readonly activeLeaderboard: ExecutableMenuOptionsPresenter | null;
  readonly activeMainMenu: ExecutableMenuOptionsPresenter | null;
  readonly activeObjectives: ExecutableMenuOptionsPresenter | null;
  readonly activeOptions: ExecutableMenuOptionsPresenter | null;
  readonly currentScreen: ExecutableScreenNode | null;
  readonly destinationState: 'about' | 'leaderboard' | 'main-menu' | 'objectives' | 'options';
  readonly destinationPresenter: ExecutableMenuOptionsPresenter;
  readonly result: boolean | null;
  readonly sourcePresenter: ExecutableMenuOptionsPresenter;
  readonly sourceRoot: ExecutableScreenNode;
  readonly sourceState: 'about' | 'leaderboard' | 'main-menu' | 'objectives' | 'options';
  readonly state: unknown;
  readonly thrown: unknown;
  readonly transitionFailureCount: number;
}> {
  const transitionMethod = route === 'main-menu-to-about'
    ? 'transitionMainMenuToAbout'
    : route === 'about-to-main-menu'
      ? 'transitionAboutToMainMenu'
      : route === 'main-menu-to-options'
        ? 'transitionMainMenuToOptions'
        : route === 'options-to-main-menu'
      ? 'transitionOptionsToMainMenu'
      : route === 'main-menu-to-objectives'
        ? 'transitionMainMenuToObjectives'
        : route === 'objectives-to-main-menu'
          ? 'transitionObjectivesToMainMenu'
      : route === 'main-menu-to-leaderboard'
        ? 'transitionMainMenuToLeaderboard'
        : 'transitionLeaderboardToMainMenu';
  const sourceState = route === 'about-to-main-menu'
    ? 'about'
    : route === 'options-to-main-menu'
      ? 'options'
      : route === 'objectives-to-main-menu'
      ? 'objectives'
    : route === 'leaderboard-to-main-menu'
      ? 'leaderboard'
      : 'main-menu';
  const destinationState = route === 'main-menu-to-about'
    ? 'about'
    : route === 'main-menu-to-options'
      ? 'options'
      : route === 'main-menu-to-objectives'
      ? 'objectives'
    : route === 'main-menu-to-leaderboard'
      ? 'leaderboard'
      : 'main-menu';
  const destination = route === 'main-menu-to-about'
    ? 'AboutLayer'
    : route === 'main-menu-to-options'
      ? 'OptionsLayer'
      : route === 'main-menu-to-objectives'
      ? 'ObjectivesLayer'
    : route === 'main-menu-to-leaderboard'
      ? 'LeaderboardLayer'
      : 'MainMenuLayer';
  const timing = (
    route === 'main-menu-to-leaderboard'
    || route === 'main-menu-to-objectives'
  ) ? 'delayed' : 'immediate';
  const sourceRoot = new ExecutableScreenNode();
  const sourcePresenter = new ExecutableMenuOptionsPresenter(
    sourceRoot,
    false,
    true,
    failureOptions.suspensionFails ?? false,
    0,
    failureOptions.rearmFails ?? false,
  );
  const destinationPresenter = new ExecutableMenuOptionsPresenter(
    new ExecutableScreenNode(),
    activationFails,
    false,
    false,
    failureOptions.destinationDisposeFailures ?? 0,
    false,
  );
  const sharedScene = new ExecutableSharedScene(
    sourceRoot,
    incompleteRollback
      ? new Error('injected screen restoration failure')
      : null,
    failureOptions.initialReplacementFails
      ? new Error('injected initial screen replacement failure')
      : null,
  );
  const isValid = (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  );
  const errorMessage = compileSourceFunction<(error: unknown) => string>('errorMessage');
  const aggregateWithPrimaryError = compileSourceFunction<
    (label: string, primary: unknown, secondary: readonly unknown[]) => Error
  >('aggregateWithPrimaryError', { errorMessage });
  const normalizeError = compileSourceFunction<
    (error: unknown, fallback: string) => Error
  >('normalizeError');
  const restorePreviousScreen = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      previous: ExecutableScreenNode,
      attempted: ExecutableScreenNode,
    ) => void
  >('restorePreviousScreen', { isValid });
  const releaseFailedMenuScreenOwnership = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      previous: ExecutableScreenNode,
      attempted: ExecutableScreenNode,
    ) => void
  >('releaseFailedMenuScreenOwnership');
  const compensateFailedMenuScreenReplacement = compileSourceMethod<
    (
      this: Record<string, unknown>,
      oldPresenter: ExecutableMenuOptionsPresenter,
      nextPresenter: ExecutableMenuOptionsPresenter,
      error: unknown,
      source: 'About' | 'Leaderboard' | 'Main Menu' | 'Objectives' | 'Options',
      destination: 'About' | 'Leaderboard' | 'Main Menu' | 'Objectives' | 'Options',
      sourceOwnershipPoisoned?: boolean,
    ) => never
  >('compensateFailedMenuScreenReplacement', {
    aggregateWithPrimaryError,
    ModeSelectFatalNavigationError: ExecutableModeSelectFatalNavigationError,
  });
  const runTransition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      from: string,
      to: string,
      operation: () => boolean,
    ) => boolean
  >('runTransition', {
    console: { error() {} },
    ModeSelectFatalNavigationError: ExecutableModeSelectFatalNavigationError,
    normalizeError,
  });
  const transition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      transaction: Readonly<{
        readonly destination:
          | 'AboutLayer'
          | 'LeaderboardLayer'
          | 'MainMenuLayer'
          | 'ObjectivesLayer'
          | 'OptionsLayer';
        readonly root: ExecutableScreenNode;
        readonly timing: 'delayed' | 'immediate';
        readonly zOrder: 1;
      }>,
    ) => boolean
  >(transitionMethod, {
    disposeCommittedPresenter: (
      presenter: ExecutableMenuOptionsPresenter,
    ) => presenter.dispose(),
  });
  let transitionFailureCount = 0;
  const createDestinationPresenter = (): ExecutableMenuOptionsPresenter => {
    if (failureOptions.creationFails) {
      throw new Error('injected destination creation failure');
    }
    return destinationPresenter;
  };
  const shell: Record<string, unknown> = {
    activeAbout: sourceState === 'about' ? sourcePresenter : null,
    activeLeaderboard: sourceState === 'leaderboard' ? sourcePresenter : null,
    activeMainMenu: sourceState === 'main-menu' ? sourcePresenter : null,
    activeObjectives: sourceState === 'objectives' ? sourcePresenter : null,
    activeOptions: sourceState === 'options' ? sourcePresenter : null,
    compensateFailedMenuScreenReplacement(
      oldPresenter: ExecutableMenuOptionsPresenter,
      nextPresenter: ExecutableMenuOptionsPresenter,
      error: unknown,
      source: 'About' | 'Leaderboard' | 'Main Menu' | 'Objectives' | 'Options',
      destination: 'About' | 'Leaderboard' | 'Main Menu' | 'Objectives' | 'Options',
      sourceOwnershipPoisoned?: boolean,
    ) {
      return compensateFailedMenuScreenReplacement.call(
        this,
        oldPresenter,
        nextPresenter,
        error,
        source,
        destination,
        sourceOwnershipPoisoned,
      );
    },
    createAboutPresenter: createDestinationPresenter,
    createLeaderboardPresenter: createDestinationPresenter,
    createMainMenuPresenter: createDestinationPresenter,
    createObjectivesPresenter: createDestinationPresenter,
    createOptionsPresenter: createDestinationPresenter,
    destroyedValue: false,
    emitTransitionFailure() {
      transitionFailureCount += 1;
    },
    releaseFailedMenuScreenOwnership(
      previous: ExecutableScreenNode,
      attempted: ExecutableScreenNode,
    ) {
      return releaseFailedMenuScreenOwnership.call(
        this as never,
        previous,
        attempted,
      );
    },
    requireSharedScene: () => sharedScene,
    restorePreviousScreen(
      previous: ExecutableScreenNode,
      attempted: ExecutableScreenNode,
    ) {
      return restorePreviousScreen.call(this as never, previous, attempted);
    },
    runTransition(from: string, to: string, operation: () => boolean) {
      return runTransition.call(this, from, to, operation);
    },
    stateValue: sourceState,
    transitioning: false,
  };

  let result: boolean | null = null;
  let thrown: unknown = null;
  try {
    result = transition.call(shell, {
      destination,
      root: sourceRoot,
      timing,
      zOrder: 1,
    });
  } catch (error) {
    thrown = error;
  }
  if (
    (result === false || thrown !== null)
    && !sourcePresenter.disposed
    && sourcePresenter.rearmSuccessCount === 0
  ) {
    try {
      sourcePresenter.rearmNavigationAfterFailure();
    } catch {
      // A poisoned presenter must reject the caller's mandatory recovery attempt.
    }
  }

  assert.notEqual(destinationState, sourceState);
  return Object.freeze({
    activeAbout: shell.activeAbout as ExecutableMenuOptionsPresenter | null,
    activeLeaderboard:
      shell.activeLeaderboard as ExecutableMenuOptionsPresenter | null,
    activeMainMenu: shell.activeMainMenu as ExecutableMenuOptionsPresenter | null,
    activeObjectives:
      shell.activeObjectives as ExecutableMenuOptionsPresenter | null,
    activeOptions: shell.activeOptions as ExecutableMenuOptionsPresenter | null,
    currentScreen: sharedScene.currentScreen,
    destinationState,
    destinationPresenter,
    result,
    sourcePresenter,
    sourceRoot,
    sourceState,
    state: shell.stateValue,
    thrown,
    transitionFailureCount,
  });
}

class ExecutableMenuOptionsPresenter {
  private readonly activationFails: boolean;
  private disposeFailuresRemaining: number;
  private readonly rearmFails: boolean;
  private readonly suspensionFails: boolean;
  activationCount = 0;
  disposed = false;
  inputLeaseHeld: boolean;
  poisoned = false;
  rearmAttemptCount = 0;
  rearmSuccessCount = 0;
  readonly root: ExecutableScreenNode;
  suspended = false;

  constructor(
    root: ExecutableScreenNode,
    activationFails: boolean,
    inputLeaseHeld = true,
    suspensionFails = false,
    disposeFailuresRemaining = 0,
    rearmFails = false,
  ) {
    this.activationFails = activationFails;
    this.disposeFailuresRemaining = disposeFailuresRemaining;
    this.inputLeaseHeld = inputLeaseHeld;
    this.rearmFails = rearmFails;
    this.root = root;
    this.suspensionFails = suspensionFails;
  }

  get state(): Readonly<{ readonly poisoned: boolean }> {
    return Object.freeze({ poisoned: this.poisoned });
  }

  activate(): void {
    this.activationCount += 1;
    if (this.activationFails) {
      throw new Error('injected destination activation failure');
    }
    this.inputLeaseHeld = true;
  }

  dispose(): boolean {
    if (this.disposed) {
      return false;
    }
    if (this.disposeFailuresRemaining > 0) {
      this.disposeFailuresRemaining -= 1;
      throw new Error('injected presenter disposal failure');
    }
    this.disposed = true;
    this.inputLeaseHeld = false;
    this.root.destroyed = true;
    return true;
  }

  rearmNavigationAfterFailure(): boolean {
    this.rearmAttemptCount += 1;
    if (this.poisoned || this.rearmFails) {
      throw new Error('poisoned source cannot rearm');
    }
    if (this.disposed || this.root.parent === null) {
      return false;
    }
    this.suspended = false;
    this.inputLeaseHeld = true;
    this.rearmSuccessCount += 1;
    return true;
  }

  suspendForTransition(): boolean {
    if (this.disposed || this.suspended || !this.inputLeaseHeld) {
      return false;
    }
    this.suspended = true;
    if (this.suspensionFails) {
      this.poisoned = true;
      throw new Error('injected source suspension failure');
    }
    this.inputLeaseHeld = false;
    return true;
  }
}

function executeCrazyResultMenuRequest(
  mode: 'crazy' | 'crazy-bird',
  completedRunScore: number,
): Readonly<{
  readonly commitCount: number;
  readonly currentScreen: ExecutableScreenNode | null;
  readonly mainMenuRoot: ExecutableScreenNode;
  readonly rollbackCount: number;
  readonly state: unknown;
}> {
  const isValid = (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  );
  const isSignedInt32 = (value: unknown): value is number => (
    typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= -0x8000_0000
    && value <= 0x7fff_ffff
  );
  const normalizeError = compileSourceFunction<
    (error: unknown, fallback: string) => Error
  >('normalizeError');
  const commitCrazyMainMenuNavigationRequest = compileSourceFunction<
    (
      request: Readonly<{ commit(previousRoot: ExecutableScreenNode): void }>,
      previousRoot: ExecutableScreenNode,
      source: string,
    ) => void
  >('commitCrazyMainMenuNavigationRequest', {
    console: { error() {} },
    normalizeError,
  });
  const transition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      request: Readonly<{
        root: ExecutableScreenNode;
        commit(previousRoot: ExecutableScreenNode): void;
        rollback(): void;
      }>,
      expectedState: 'crazy' | 'crazy-bird',
      source: string,
    ) => void
  >('transitionTimedCrazyToMainMenu', {
    commitCrazyMainMenuNavigationRequest,
  });
  const resultRoot = new ExecutableScreenNode();
  const mainMenuRoot = new ExecutableScreenNode();
  const sharedScene = new ExecutableSharedScene(resultRoot);
  let commitCount = 0;
  let rollbackCount = 0;
  const shell: Record<string, unknown> = {
    activeMainMenu: null,
    createMainMenuPresenter: () => ({
      activate() {},
      dispose() {},
      root: mainMenuRoot,
    }),
    destroyedValue: false,
    requireNonClassicPhysics: () => ({
      activateCollisionFilter: () => true,
    }),
    requireSharedScene: () => sharedScene,
    stateValue: mode,
    transitioning: false,
  };
  const payload = {
    commit(previousRoot: ExecutableScreenNode) {
      assert.equal(previousRoot, resultRoot);
      commitCount += 1;
    },
    completedRunScore,
    resultRoot,
    rollback() {
      rollbackCount += 1;
    },
  };

  if (mode === 'crazy') {
    const isCrazyResultMenuRequestedEvent = compileSourceFunction<
      (request: unknown) => boolean
    >('isCrazyResultMenuRequestedEvent', {
      Node: ExecutableScreenNode,
      isSignedInt32,
      isValid,
    });
    const rollbackRejectedCrazyNavigationRequest = compileSourceFunction<
      (request: unknown, source: string) => void
    >('rollbackRejectedCrazyNavigationRequest', {
      console: { error() {} },
      normalizeError,
    });
    const handler = compileSourceArrowMember<
      (this: Record<string, unknown>, request: unknown) => void
    >('onCrazyResultMenuRequested', {
      isCrazyResultMenuRequestedEvent,
      rollbackRejectedCrazyNavigationRequest,
    });
    shell.transitionCrazyToMainMenu = (
      request: Readonly<{
        root: ExecutableScreenNode;
        commit(previousRoot: ExecutableScreenNode): void;
        rollback(): void;
      }>,
    ) => transition.call(shell, request, 'crazy', 'Crazy Result');
    handler.call(shell, payload);
  } else {
    const captureCrazyResultMenuNavigationRequest = compileSourceFunction<
      (request: unknown) => Readonly<{
        request: Readonly<{
          root: ExecutableScreenNode;
          commit(previousRoot: ExecutableScreenNode): void;
          rollback(): void;
        }> | null;
        rollback: (() => void) | null;
      }>
    >('captureCrazyResultMenuNavigationRequest', {
      Node: ExecutableScreenNode,
      isSignedInt32,
      isValid,
    });
    const handler = compileSourceArrowMember<
      (this: Record<string, unknown>, request: unknown) => void
    >('onCrazyBirdResultMenuRequested', {
      captureCrazyResultMenuNavigationRequest,
    });
    shell.rejectCrazyBirdNavigationRequest = (
      rollback: (() => void) | null,
    ) => rollback?.();
    shell.transitionCrazyBirdToMainMenu = (
      request: Readonly<{
        root: ExecutableScreenNode;
        commit(previousRoot: ExecutableScreenNode): void;
        rollback(): void;
      }>,
    ) => transition.call(shell, request, 'crazy-bird', 'Crazy Bird Result');
    handler.call(shell, payload);
  }

  return Object.freeze({
    commitCount,
    currentScreen: sharedScene.currentScreen,
    mainMenuRoot,
    rollbackCount,
    state: shell.stateValue,
  });
}

function executeCrazyActivationFailure(
  route: 'crazy' | 'crazy-bird',
  activationError: unknown,
): Readonly<{
  readonly currentScreen: ExecutableScreenNode | null;
  readonly filterActive: boolean;
  readonly filterReactivationCount: number;
  readonly inputLeaseHeld: boolean;
  readonly inputRearmCount: number;
  readonly modeSelectRoot: ExecutableScreenNode;
  readonly result: boolean | null;
  readonly state: unknown;
  readonly thrown: unknown;
  readonly transitionFailureCount: number;
}> {
  const isValid = (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  );
  const compensateFailedTimedCrazyActivation = compileCrazyActivationCompensation(
    ExecutableModeSelectFatalNavigationError,
  );
  const captureModeSelectFatalScreenRelease = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      root: ExecutableScreenNode,
    ) => () => void
  >('captureModeSelectFatalScreenRelease');
  const transition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      transaction: Readonly<{
        destination: string;
        root: ExecutableScreenNode;
      }>,
    ) => boolean
  >(
    route === 'crazy'
      ? 'transitionModeSelectToCrazy'
      : 'transitionModeSelectToCrazyBird',
    {
      ModeSelectFatalNavigationError: ExecutableModeSelectFatalNavigationError,
    },
  );
  const runTransition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      from: string,
      to: string,
      operation: () => boolean,
    ) => boolean
  >('runTransition', {
    ModeSelectFatalNavigationError: ExecutableModeSelectFatalNavigationError,
  });
  const restore = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      root: ExecutableScreenNode,
    ) => void
  >(
    route === 'crazy'
      ? 'restoreModeSelectAfterFailedCrazyActivation'
      : 'restoreModeSelectAfterFailedCrazyBirdActivation',
    { isValid },
  );
  const modeSelectRoot = new ExecutableScreenNode();
  const sharedScene = new ExecutableSharedScene(modeSelectRoot);
  let filterActive = true;
  let filterReactivationCount = 0;
  let inputLeaseHeld = true;
  let inputRearmCount = 0;
  let transitionFailureCount = 0;
  const oldPresenter = {
    dispose: () => true,
    root: modeSelectRoot,
    rearmNavigationAfterFailure() {
      inputRearmCount += 1;
      inputLeaseHeld = true;
      return true;
    },
    suspendForTransition() {
      inputLeaseHeld = false;
      return true;
    },
  };
  const shell: Record<string, unknown> = {
    activeModeSelect: oldPresenter,
    captureModeSelectFatalScreenRelease(root: ExecutableScreenNode) {
      return captureModeSelectFatalScreenRelease.call(this as never, root);
    },
    compensateFailedTimedCrazyActivation(
      presenter: typeof oldPresenter,
      physics: Readonly<{
        readonly collisionFilterActive: boolean;
        activateCollisionFilter(): boolean;
      }>,
      error: unknown,
      destination: 'Crazy' | 'Crazy Bird',
    ) {
      return compensateFailedTimedCrazyActivation.call(
        this,
        presenter,
        physics,
        error,
        destination,
      );
    },
    destroyedValue: false,
    emitTransitionFailure() {
      transitionFailureCount += 1;
    },
    requireCrazyGameplayController: () => ({
      activateCrazyBirdFromAppShell() {
        throw activationError;
      },
      activateCrazyFromAppShell() {
        throw activationError;
      },
      crazyBirdPrepared: true,
      prepared: true,
    }),
    requireNonClassicPhysics: () => ({
      activateCollisionFilter() {
        filterReactivationCount += 1;
        filterActive = true;
        return true;
      },
      get collisionFilterActive() {
        return filterActive;
      },
      restorePreviousCollisionFilter() {
        filterActive = false;
        return true;
      },
    }),
    requireSharedScene: () => sharedScene,
    runTransition(from: string, to: string, operation: () => boolean) {
      return runTransition.call(this, from, to, operation);
    },
    stateValue: 'mode-select',
    transitioning: false,
  };
  const restoreMethodName = route === 'crazy'
    ? 'restoreModeSelectAfterFailedCrazyActivation'
    : 'restoreModeSelectAfterFailedCrazyBirdActivation';
  shell[restoreMethodName] = function restoreModeSelect(root: ExecutableScreenNode) {
    restore.call(this as never, root);
  };

  let result: boolean | null = null;
  let thrown: unknown = null;
  try {
    result = transition.call(shell, {
      destination: route === 'crazy' ? 'CrazyModeLayer' : 'CrazyBirdLayer',
      root: modeSelectRoot,
    });
  } catch (error) {
    thrown = error;
  }

  return Object.freeze({
    currentScreen: sharedScene.currentScreen,
    filterActive,
    filterReactivationCount,
    inputLeaseHeld,
    inputRearmCount,
    modeSelectRoot,
    result,
    state: shell.stateValue,
    thrown,
    transitionFailureCount,
  });
}

function compileCrazyActivationCompensation(
  fatalNavigationError: new (message: string, cause: unknown) => Error,
): (
  this: Record<string, unknown>,
  oldPresenter: Readonly<{
    readonly root: ExecutableScreenNode;
    rearmNavigationAfterFailure(): boolean;
  }>,
  nonClassicPhysics: Readonly<{
    readonly collisionFilterActive: boolean;
    activateCollisionFilter(): boolean;
  }>,
  error: unknown,
  destination: 'Crazy' | 'Crazy Bird',
) => never {
  const errorMessage = compileSourceFunction<(error: unknown) => string>('errorMessage');
  const aggregateWithPrimaryError = compileSourceFunction<
    (label: string, primary: unknown, secondary: readonly unknown[]) => Error
  >('aggregateWithPrimaryError', { errorMessage });
  const readErrorGraphValue = compileSourceFunction<
    (value: object, key: string) => unknown
  >('readErrorGraphValue');
  const enqueueErrorGraphValue = compileSourceFunction<
    (pending: unknown[], value: unknown) => void
  >('enqueueErrorGraphValue');
  const containsCrazyLifecycleRollbackError = compileSourceFunction<
    (error: unknown) => boolean
  >('containsCrazyLifecycleRollbackError', {
    CrazyLifecycleRollbackError: ExecutableCrazyLifecycleRollbackError,
    enqueueErrorGraphValue,
    readErrorGraphValue,
  });
  return compileSourceMethod(
    'compensateFailedTimedCrazyActivation',
    {
      aggregateWithPrimaryError,
      containsCrazyLifecycleRollbackError,
      ModeSelectFatalNavigationError: fatalNavigationError,
    },
  );
}

function compileSourceFunction<T extends (...args: any[]) => unknown>(
  functionName: string,
  dependencies: Readonly<Record<string, unknown>> = {},
): T {
  const source = extractMemberBlock(SOURCE, `function ${functionName}(`);
  return compileTypeScriptFunction<T>(source, functionName, dependencies);
}

function compileSourceMethod<T extends (...args: any[]) => unknown>(
  methodName: string,
  dependencies: Readonly<Record<string, unknown>> = {},
): T {
  const source = extractMethod(SOURCE, methodName).replace(
    new RegExp(`^\\s*private\\s+${methodName}`),
    `function ${methodName}`,
  );
  return compileTypeScriptFunction<T>(source, methodName, dependencies);
}

function compileAsyncSourceMethod<T extends (...args: any[]) => unknown>(
  methodName: string,
  dependencies: Readonly<Record<string, unknown>> = {},
): T {
  const source = extractMethod(SOURCE, methodName).replace(
    new RegExp(`^\\s*private\\s+async\\s+${methodName}`),
    `async function ${methodName}`,
  );
  return compileTypeScriptFunction<T>(source, methodName, dependencies);
}

function compileSourceArrowMember<T extends (...args: any[]) => unknown>(
  memberName: string,
  dependencies: Readonly<Record<string, unknown>> = {},
): T {
  const source = extractMemberBlock(
    SOURCE,
    `  private readonly ${memberName} = (`,
  )
    .replace(
      new RegExp(`^\\s*private\\s+readonly\\s+${memberName}\\s*=\\s*\\(`),
      `function ${memberName}(`,
    )
    .replace(/\): void => \{/, '): void {');
  return compileTypeScriptFunction<T>(source, memberName, dependencies);
}

function compileTypeScriptFunction<T extends (...args: any[]) => unknown>(
  source: string,
  functionName: string,
  dependencies: Readonly<Record<string, unknown>>,
): T {
  const names = Object.keys(dependencies);
  const values = names.map((name) => dependencies[name]);
  const javascript = stripTypeScriptTypes(source, {
    mode: 'transform',
    sourceUrl: `recovered-app-shell-controller.test.${functionName}.ts`,
  });
  return Function(
    ...names,
    `"use strict";\n${javascript}\nreturn ${functionName};`,
  )(...values) as T;
}

function executeGnStyleMainMenuRequest(
  source: 'GN Style Pause Quit' | 'GN Style Result',
  state: 'gn-style' | 'main-menu',
  rollbackThrows: boolean,
  activateThrows = false,
): Readonly<{
  readonly commitCount: number;
  readonly currentRoot: ExecutableScreenNode;
  readonly currentScreen: ExecutableScreenNode | null;
  readonly filterActive: boolean;
  readonly mainMenuRoot: ExecutableScreenNode;
  readonly retainFailureCount: number;
  readonly rollbackCount: number;
  readonly transitionFailureCount: number;
  readonly state: unknown;
}> {
  const errorMessage = compileSourceFunction<(error: unknown) => string>('errorMessage');
  const normalizeError = compileSourceFunction<
    (error: unknown, fallback: string) => Error
  >('normalizeError');
  const aggregateWithPrimaryError = compileSourceFunction<
    (label: string, primary: unknown, secondary: readonly unknown[]) => Error
  >('aggregateWithPrimaryError', { errorMessage });
  const runBestEffortCleanup = compileSourceFunction<
    (label: string, operations: readonly (() => void)[]) => readonly Error[]
  >('runBestEffortCleanup', {
    console: { error() {} },
    normalizeError,
  });
  const rollbackRejectedClassicBirdNavigationRequest = compileSourceFunction<
    (
      rollback: (() => void) | null,
      source:
        | 'Classic Bird Pause Quit'
        | 'Classic Bird Result'
        | 'Combo Bird Pause Quit'
        | 'Combo Bird Result'
        | 'GN Style Pause Quit'
        | 'GN Style Result',
    ) => readonly Error[]
  >('rollbackRejectedClassicBirdNavigationRequest', { runBestEffortCleanup });
  const rejectGnStyleNavigationRequest = compileSourceMethod<
    (
      this: Record<string, unknown>,
      rollback: (() => void) | null,
      source: 'GN Style Pause Quit' | 'GN Style Result',
    ) => void
  >('rejectGnStyleNavigationRequest', {
    aggregateWithPrimaryError,
    rollbackRejectedClassicBirdNavigationRequest,
  });
  const commitClassicBirdMainMenuNavigationRequest = compileSourceFunction<
    (
      request: Readonly<{
        commit(previousRoot: ExecutableScreenNode): void;
      }>,
      previousRoot: ExecutableScreenNode,
      source: 'GN Style Pause Quit' | 'GN Style Result',
    ) => void
  >('commitClassicBirdMainMenuNavigationRequest', { normalizeError });
  const restoreGnStyleNavigationRootBeforeRollback = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      root: ExecutableScreenNode,
    ) => void
  >('restoreGnStyleNavigationRootBeforeRollback', { isValid: (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  ) });
  const assertGnStyleNavigationRollbackRestored = compileSourceMethod<
    (
      this: Readonly<{
        requireNonClassicPhysics(): Readonly<{ collisionFilterActive: boolean }>;
        requireSharedScene(): ExecutableSharedScene;
      }>,
      root: ExecutableScreenNode,
    ) => void
  >('assertGnStyleNavigationRollbackRestored', { isValid: (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  ) });
  const transition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      request: Readonly<{
        root: ExecutableScreenNode;
        commit(previousRoot: ExecutableScreenNode): void;
      rollback(): void;
      }>,
      source: 'GN Style Pause Quit' | 'GN Style Result',
    ) => void
  >('transitionGnStyleToMainMenu', {
    commitClassicBirdMainMenuNavigationRequest,
    aggregateWithPrimaryError,
    runBestEffortCleanup,
  });

  const currentRoot = new ExecutableScreenNode();
  const requestRoot = state === 'gn-style' ? currentRoot : new ExecutableScreenNode();
  const mainMenuRoot = new ExecutableScreenNode();
  const sharedScene = new ExecutableSharedScene(currentRoot);
  let commitCount = 0;
  let filterActive = true;
  let retainFailureCount = 0;
  let rollbackCount = 0;
  let transitionFailureCount = 0;
  const shell: Record<string, unknown> = {
    activeMainMenu: null,
    createMainMenuPresenter: () => ({
      activate() {
        if (activateThrows) {
          throw new Error('injected GN Style main-menu activation failure');
        }
      },
      dispose() {},
      root: mainMenuRoot,
    }),
    destroyedValue: false,
    emitTransitionFailure() {
      transitionFailureCount += 1;
    },
    requireGameplayController: () => ({
      sharedAudioPresenter: {
        stopBackgroundMusic() {},
      },
    }),
    requireNonClassicPhysics: () => ({
      activateCollisionFilter() {
        filterActive = true;
        return true;
      },
      get collisionFilterActive() {
        return filterActive;
      },
      restorePreviousCollisionFilter() {
        filterActive = false;
        return true;
      },
    }),
    requireSharedScene: () => sharedScene,
    restoreGnStyleNavigationRootBeforeRollback(root: ExecutableScreenNode) {
      return restoreGnStyleNavigationRootBeforeRollback.call(this as never, root);
    },
    rejectStaleGnStyleNavigationRequest() {
      return undefined;
    },
    retainGnStyleShellFailure() {
      retainFailureCount += 1;
      shell.stateValue = 'failed';
    },
    assertGnStyleNavigationRollbackRestored(root: ExecutableScreenNode) {
      return assertGnStyleNavigationRollbackRestored.call(this as never, root);
    },
    stateValue: state,
    transitioning: false,
  };
  const request = {
    commit(previousRoot: ExecutableScreenNode) {
      assert.equal(previousRoot, currentRoot);
      commitCount += 1;
    },
    rollback() {
      rollbackCount += 1;
      if (rollbackThrows) {
        throw new Error('injected GN Style rollback failure');
      }
    },
    root: requestRoot,
  };

  transition.call(shell, request, source);

  return Object.freeze({
    commitCount,
    currentRoot,
    currentScreen: sharedScene.currentScreen,
    filterActive,
    mainMenuRoot,
    retainFailureCount,
    rollbackCount,
    transitionFailureCount,
    state: shell.stateValue,
  });
}

function executeGnStyleActivationFailure(
  activationError: unknown,
): Readonly<{
  readonly currentScreen: ExecutableScreenNode | null;
  readonly filterActive: boolean;
  readonly inputLeaseHeld: boolean;
  readonly inputRearmCount: number;
  readonly modeSelectRoot: ExecutableScreenNode;
  readonly result: boolean | null;
  readonly state: unknown;
  readonly thrown: unknown;
  readonly transitionFailureCount: number;
}> {
  const isValid = (value: unknown): boolean => (
    value instanceof ExecutableScreenNode && !value.destroyed
  );
  const transition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      transaction: Readonly<{
        destination: string;
        root: ExecutableScreenNode;
      }>,
    ) => boolean
  >('transitionModeSelectToGnStyle', {
    GnStyleLifecycleRollbackError: ExecutableGnStyleLifecycleRollbackError,
    ModeSelectFatalNavigationError: ExecutableModeSelectFatalNavigationError,
  });
  const runTransition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      from: string,
      to: string,
      operation: () => boolean,
    ) => boolean
  >('runTransition', {
    ModeSelectFatalNavigationError: ExecutableModeSelectFatalNavigationError,
  });
  const restore = compileSourceMethod<
    (
      this: Readonly<{ requireSharedScene(): ExecutableSharedScene }>,
      root: ExecutableScreenNode,
    ) => void
  >('restoreModeSelectAfterFailedGnStyleActivation', { isValid });

  const modeSelectRoot = new ExecutableScreenNode();
  const sharedScene = new ExecutableSharedScene(modeSelectRoot);
  const partialGnStyleRoot = new ExecutableScreenNode();
  let filterActive = true;
  let filterReactivationCount = 0;
  let inputLeaseHeld = true;
  let inputRearmCount = 0;
  let transitionFailureCount = 0;
  const oldPresenter = {
    dispose: () => true,
    root: modeSelectRoot,
    rearmNavigationAfterFailure() {
      inputRearmCount += 1;
      inputLeaseHeld = true;
      return true;
    },
    suspendForTransition() {
      inputLeaseHeld = false;
      return true;
    },
  };
  const shell: Record<string, unknown> = {
    activeModeSelect: oldPresenter,
    captureModeSelectFatalScreenRelease: () => () => {},
    destroyedValue: false,
    emitTransitionFailure() {
      transitionFailureCount += 1;
    },
    requireGnStyleGameplayController: () => ({
      activateGnStyleFromAppShell() {
        sharedScene.attachCurrentScreen(partialGnStyleRoot);
        throw activationError;
      },
      prepared: true,
    }),
    requireNonClassicPhysics: () => ({
      activateCollisionFilter() {
        filterReactivationCount += 1;
        filterActive = true;
        return true;
      },
      get collisionFilterActive() {
        return filterActive;
      },
      restorePreviousCollisionFilter() {
        filterActive = false;
        return true;
      },
    }),
    requireSharedScene: () => sharedScene,
    restoreModeSelectAfterFailedGnStyleActivation(root: ExecutableScreenNode) {
      restore.call(this as never, root);
    },
    runTransition(from: string, to: string, operation: () => boolean) {
      return runTransition.call(this, from, to, operation);
    },
    stateValue: 'mode-select',
    transitioning: false,
  };

  let result: boolean | null = null;
  let thrown: unknown = null;
  try {
    result = transition.call(shell, {
      destination: 'GNStyleLayer',
      root: modeSelectRoot,
    });
  } catch (error) {
    thrown = error;
  }

  return Object.freeze({
    currentScreen: sharedScene.currentScreen,
    filterActive,
    inputLeaseHeld,
    inputRearmCount,
    modeSelectRoot,
    result,
    state: shell.stateValue,
    thrown,
    transitionFailureCount,
  });
}

test('GN Style result and pause quit commit after activation and stale rollback leaves the fresh shell usable', () => {
  for (const source of ['GN Style Result', 'GN Style Pause Quit'] as const) {
    const committed = executeGnStyleMainMenuRequest(source, 'gn-style', false);

    assert.equal(committed.commitCount, 1);
    assert.equal(committed.rollbackCount, 0);
    assert.equal(committed.currentScreen, committed.mainMenuRoot);
    assert.equal(committed.state, 'main-menu');
    assert.equal(committed.filterActive, true);
    assert.equal(committed.retainFailureCount, 0);
    assert.equal(committed.transitionFailureCount, 0);

    const stale = executeGnStyleMainMenuRequest(source, 'main-menu', true);

    assert.equal(stale.commitCount, 0);
    assert.equal(stale.rollbackCount, 0);
    assert.equal(stale.currentScreen, stale.currentRoot);
    assert.equal(stale.state, 'main-menu');
    assert.equal(stale.filterActive, true);
    assert.equal(stale.retainFailureCount, 0);
    assert.equal(stale.transitionFailureCount, 0);
  }
});

test('GN Style main-menu activation failure restores the GN root and only poisons when rollback fails', () => {
  for (const source of ['GN Style Result', 'GN Style Pause Quit'] as const) {
    const recovered = executeGnStyleMainMenuRequest(
      source,
      'gn-style',
      false,
      true,
    );
    assert.equal(recovered.commitCount, 0);
    assert.equal(recovered.rollbackCount, 1);
    assert.equal(recovered.currentScreen, recovered.currentRoot);
    assert.equal(recovered.state, 'gn-style');
    assert.equal(recovered.filterActive, false);
    assert.equal(recovered.retainFailureCount, 0);
    assert.equal(recovered.transitionFailureCount, 1);

    const poisoned = executeGnStyleMainMenuRequest(
      source,
      'gn-style',
      true,
      true,
    );
    assert.equal(poisoned.commitCount, 0);
    assert.equal(poisoned.rollbackCount, 1);
    assert.equal(poisoned.currentScreen, poisoned.currentRoot);
    assert.equal(poisoned.state, 'failed');
    assert.equal(poisoned.filterActive, false);
    assert.equal(poisoned.retainFailureCount, 1);
    assert.equal(poisoned.transitionFailureCount, 0);
  }
});

test('GN Style entry activation failure restores Mode Select and fails closed on poisoned ownership', () => {
  const generic = executeGnStyleActivationFailure(
    new Error('injected GN Style activation failure'),
  );
  assert.equal(generic.result, false);
  assert.equal(generic.thrown, null);
  assert.equal(generic.state, 'mode-select');
  assert.equal(generic.currentScreen, generic.modeSelectRoot);
  assert.equal(generic.filterActive, true);
  assert.equal(generic.inputLeaseHeld, true);
  assert.equal(generic.inputRearmCount, 1);
  assert.equal(generic.transitionFailureCount, 1);

  const poisonedActivationError = new ExecutableGnStyleLifecycleRollbackError(
    'injected poisoned GN Style ownership',
  );
  const poisoned = executeGnStyleActivationFailure(poisonedActivationError);
  assert.equal(poisoned.result, null);
  assert.ok(poisoned.thrown instanceof ExecutableModeSelectFatalNavigationError);
  assert.equal(
    (poisoned.thrown as ExecutableModeSelectFatalNavigationError).cause,
    poisonedActivationError,
  );
  assert.equal(poisoned.state, 'failed');
  assert.equal(poisoned.currentScreen, poisoned.modeSelectRoot);
  assert.equal(poisoned.filterActive, true);
  assert.equal(poisoned.inputLeaseHeld, true);
  assert.equal(poisoned.inputRearmCount, 1);
  assert.equal(poisoned.transitionFailureCount, 1);
});
