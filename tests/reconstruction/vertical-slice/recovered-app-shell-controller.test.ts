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
    'await gameplayController.prepareRecoveredRuntime()',
    'this.requireCrazyGameplayController()',
    '.prepareCrazyRuntime()',
    'const classicBirdPreparation = crazyPreparation',
    'this.requireClassicBirdGameplayController()',
    '.prepareClassicBirdRuntime()',
    'const crazyBirdPreparation = classicBirdPreparation',
    '.prepareCrazyBirdRuntime()',
    'await Promise.all([',
    'crazyBirdPreparation,',
    'SharedLeafPresenter.create({',
    'SharedGameScenePresenter.create({',
    'nonClassicPhysics.activateCollisionFilter()',
    'mainMenu = this.createMainMenuPresenter()',
    'sharedScene.attachCurrentScreen(mainMenu.root)',
    'mainMenu.activate()',
    'this.activeMainMenu = mainMenu',
    "this.stateValue = 'main-menu'",
  ]);
  assert.doesNotMatch(initialize, /activateClassicFromAppShell|activateInitialClassic/);
});

test('destroyed shell never starts delayed Classic Bird preparation', async () => {
  const initialize = compileAsyncSourceMethod<
    (this: Record<string, unknown>) => Promise<void>
  >('initializeRecoveredApp', {
    createRecoveredAppViewport: () => Object.freeze({}),
    loadMainMenuResources: async () => Object.freeze({}),
    loadModeSelectResources: async () => Object.freeze({}),
    loadSharedGameSceneResources: async () => Object.freeze({}),
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
      sharedResourceCatalog: {
        assetTree: Object.freeze({}),
      },
    }),
    requireSceneController: () => ({
      prepareSceneResolution: () => Object.freeze({}),
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

test('serialized shell binds every Crazy and Classic Bird navigation event and owner', () => {
  const onLoad = extractMethod(SOURCE, 'onLoad');
  const onEnable = extractMethod(SOURCE, 'onEnable');
  const onDisable = extractMethod(SOURCE, 'onDisable');

  assert.match(SOURCE, /@requireComponent\(CrazyGameplayController\)/);
  assert.match(SOURCE, /@requireComponent\(ClassicBirdGameplayController\)/);
  assert.match(onLoad, /CrazyGameplayController,[\s\S]*?'CrazyGameplayController'/);
  assert.match(
    onLoad,
    /ClassicBirdGameplayController,[\s\S]*?'ClassicBirdGameplayController'/,
  );
  for (const event of [
    'CRAZY_RESULT_MENU_REQUESTED_EVENT',
    'CRAZY_PAUSE_QUIT_REQUESTED_EVENT',
    'CRAZY_BIRD_RESULT_MENU_REQUESTED_EVENT',
    'CRAZY_BIRD_PAUSE_QUIT_REQUESTED_EVENT',
    'CLASSIC_BIRD_RESULT_MENU_REQUESTED_EVENT',
    'CLASSIC_BIRD_PAUSE_QUIT_REQUESTED_EVENT',
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

test('app shell owns the single application-hide settings save boundary', () => {
  const onEnable = extractMethod(SOURCE, 'onEnable');
  const onDisable = extractMethod(SOURCE, 'onDisable');
  const onHidden = extractMemberBlock(SOURCE, '  private readonly onApplicationHidden = ()');

  assert.match(onEnable, /game\.on\(Game\.EVENT_HIDE, this\.onApplicationHidden, this\)/);
  assert.match(onDisable, /game\.off\(Game\.EVENT_HIDE, this\.onApplicationHidden, this\)/);
  assert.match(onHidden, /sharedSettingsRuntime\.save\(\)/);
  assert.match(onHidden, /CLASSIC_SETTINGS_SAVE_FAILED_EVENT/);
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

class ExecutableSharedScene {
  currentScreen: ExecutableScreenNode | null;
  private readonly host = new ExecutableScreenNode();

  constructor(currentScreen: ExecutableScreenNode | null = null) {
    this.currentScreen = currentScreen;
    if (currentScreen !== null) {
      currentScreen.parent = this.host;
    }
  }

  attachCurrentScreen(screen: ExecutableScreenNode): void {
    if (this.currentScreen !== null || screen.parent !== null || screen.destroyed) {
      throw new Error('Executable shared scene requires one valid detached screen');
    }
    screen.parent = this.host;
    this.currentScreen = screen;
  }

  detachCurrentScreen(expectedScreen?: ExecutableScreenNode): ExecutableScreenNode {
    const current = this.currentScreen;
    if (current === null || (expectedScreen !== undefined && expectedScreen !== current)) {
      throw new Error('Executable shared scene current-screen identity changed before detach');
    }
    current.parent = null;
    this.currentScreen = null;
    return current;
  }

  replaceCurrentScreen(nextScreen: ExecutableScreenNode): ExecutableScreenNode {
    const previous = this.currentScreen;
    if (previous === null) {
      throw new Error('Executable shared scene has no current screen to replace');
    }
    previous.parent = null;
    this.currentScreen = null;
    this.attachCurrentScreen(nextScreen);
    return previous;
  }
}

class ExecutableScreenNode {
  destroyed = false;
  parent: ExecutableScreenNode | null = null;
}

class ExecutableCrazyLifecycleRollbackError extends Error {}

class ExecutableModeSelectFatalNavigationError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(`${message}: ${String(cause)}`);
    this.cause = cause;
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
