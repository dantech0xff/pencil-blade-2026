import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

test('serialized gameplay lifecycle is passive and leaves shared shell ownership alone', () => {
  const source = readGameplaySource();
  const onLoad = extractMethod(source, 'onLoad');
  const onEnable = extractMethod(source, 'onEnable');
  const onDisable = extractMethod(source, 'onDisable');

  assert.match(onLoad, /getComponent\(ClassicSceneController\)/);
  assert.match(onLoad, /this\.settingsRuntime = getClassicSettingsRuntime\(\)/);
  assert.match(onLoad, /this\.score = new ScoreService/);
  assert.doesNotMatch(
    onLoad,
    /prepareSceneResolution|requireViewport|initializeRecoveredResources|loadClassicSliceResourceCatalog|ClassicAudioPresenter|constructRecoveredClassicMode|attachRecoveredClassicMode|activateInitialClassicLayer|configureResolvedWorldProperties|startVariableSimulation/,
  );
  assert.doesNotMatch(onEnable, /EVENT_HIDE|game\.on|settingsRuntime.*save/);
  assert.doesNotMatch(onDisable, /EVENT_HIDE|game\.off/);
  assert.doesNotMatch(source, /ClassicRecoveredPaperBackground|createRecoveredBackground/);
});

test('Classic exports the exact app-shell screen placement and shared-runtime ports', () => {
  const source = readGameplaySource();

  assert.match(
    source,
    /export interface ClassicScreenPlacementPort \{[\s\S]*?readonly currentScreen: Node \| null;[\s\S]*?attachCurrentScreen\(screen: Node\): void;[\s\S]*?detachCurrentScreen\(expectedScreen\?: Node\): Node;[\s\S]*?replaceCurrentScreen\(nextScreen: Node\): Node;[\s\S]*?\}/,
  );
  assert.match(
    source,
    /get sharedGameplayRandom\(\): GameplayRandom \{\s*return this\.random;\s*\}/,
  );
  assert.match(
    source,
    /get sharedSettingsRuntime\(\): ClassicSettingsRuntime \{\s*return this\.requireSettingsRuntime\(\);\s*\}/,
  );
  assert.match(
    source,
    /get sharedAudioPresenter\(\): ClassicAudioPresenter \{[\s\S]*?this\.shuttingDown \|\| this\.audioPresenter === null[\s\S]*?return this\.audioPresenter;[\s\S]*?\}/,
  );
  assert.match(
    source,
    /get sharedResourceCatalog\(\): ClassicSliceResourceCatalog \{[\s\S]*?this\.shuttingDown \|\| this\.resourceCatalog === null[\s\S]*?return this\.resourceCatalog;[\s\S]*?\}/,
  );
});

test('recovered preparation deduplicates catalogs, objectives, and audio without constructing UI', () => {
  const source = readGameplaySource();
  const prepare = extractMethod(source, 'prepareRecoveredRuntime');
  const initialize = extractMethod(source, 'initializeRecoveredResources');

  assert.match(prepare, /this\.shuttingDown \|\| !isValid\(this\.node, true\)/);
  assert.match(prepare, /sceneController\.resolutionSnapshot\(\)\?\.profile\.assetTree/);
  assert.match(prepare, /Classic resolution must be prepared before runtime preparation/);
  assert.match(
    prepare,
    /if \(this\.recoveredRuntimePreparation !== null\) \{\s*return this\.recoveredRuntimePreparation;/,
  );
  assertOrderedSubstrings(prepare, [
    'const preparation = this.initializeRecoveredResources(assetTree)',
    'this.recoveredRuntimePreparation = preparation',
    'this.recoveredRuntimePreparation = null',
    'return preparation',
  ]);
  assertOrderedSubstrings(initialize, [
    'await loadClassicSliceResourceCatalog(assetTree)',
    'await loadBaseGameplayResources(assetTree)',
    'await ClassicAudioPresenter.load(this.node)',
    '.createObjectivesManager(this.onObjectiveAchievement)',
    'this.audioPresenter = loadedAudioPresenter',
    'this.baseGameplayResources = baseGameplayResources',
    'this.objectivesManager = objectivesManager',
    'this.resourceCatalog = resources',
  ]);
  assert.match(initialize, /this\.shuttingDown[\s\S]*?!isValid\(this\.node, true\)/);
  assert.doesNotMatch(
    `${prepare}\n${initialize}`,
    /constructRecoveredClassicMode|attachRecoveredClassicMode|createRecoveredPresentation|activateInitialClassicLayer|setParent|setSiblingIndex/,
  );
});

test('app-shell activation shares the first-launch boundary with the legacy API', () => {
  const source = readGameplaySource();
  const activate = extractMethod(source, 'activateClassicFromAppShell');
  const legacyActivate = extractMethod(source, 'activateInitialClassicRuntime');
  const attachClassic = extractMethod(source, 'attachRecoveredClassicMode');

  assert.match(legacyActivate, /this\.activateClassicFromAppShell\(screenPlacement\)/);
  assert.match(activate, /const retainedScreenPlacement = this\.screenPlacement/);
  assert.match(activate, /const isReentry = this\.initialClassicRuntimeActivated/);
  assert.doesNotMatch(activate, /this\.initialClassicRuntimeActivated \|\| this\.screenPlacement !== null/);
  assert.match(activate, /screenPlacement\.currentScreen !== null/);
  assert.match(activate, /resources === null \|\| audioPresenter === null/);
  assert.match(activate, /Classic runtime must reuse the retained screen placement/);
  assert.match(activate, /Classic runtime can activate only from intro/);
  assert.match(activate, /Classic runtime can re-enter only after Result removal/);
  assert.match(activate, /sceneController\.commitClassicLayerRestart\(\)/);
  assertOrderedSubstrings(activate, [
    'this.screenPlacement = screenPlacement',
    'sceneController.restartClassicLayer()',
    'this.resetRecoveredClassicRunState()',
    'this.constructRecoveredClassicMode(',
    'this.attachRecoveredClassicMode(1)',
    'this.updatePresentation()',
    'this.emitSnapshot()',
    'sceneController.commitClassicLayerRestart()',
    "sceneController.activateInitialClassicLayer()",
    'this.initialClassicRuntimeActivated = true',
  ]);
  assertOrderedSubstrings(activate, [
    'catch (error)',
    'const rollbackFailures: unknown[] = []',
    'sceneController.rollbackClassicLayerRestart()',
    'this.disposeClassicModePresentation()',
    'this.retainCurrentClassicRunForCleanup()',
    'this.installClassicRunOwnership(this.createFreshClassicRunOwnership())',
    'this.screenPlacement = retainedScreenPlacement',
    'error instanceof ClassicLifecycleRollbackError',
    'sceneController.fatalLifecycle',
    'this.quiesceClassicAfterFatalLifecycle(fatalError)',
    'throw error',
  ]);
  assert.match(attachClassic, /zOrder !== 1/);
  assert.match(attachClassic, /screenPlacement\.attachCurrentScreen\(root\)/);
  assert.match(attachClassic, /screenPlacement\.currentScreen !== root/);
  assert.doesNotMatch(attachClassic, /setParent|setSiblingIndex|addChild|removeFromParent/);
});

test('post-menu activation rolls back scene and host ownership on failure', () => {
  const source = readGameplaySource();
  const activate = extractMethod(source, 'activateClassicFromAppShell');

  assert.match(activate, /const isReentry = this\.initialClassicRuntimeActivated/);
  assert.match(activate, /sceneController\.restartClassicLayer\(\)[\s\S]*?this\.resetRecoveredClassicRunState\(\)/);
  assert.match(activate, /resetRecoveredClassicRunState/);
  assert.match(activate, /sceneController\.rollbackClassicLayerRestart\(\)/);
  assertOrderedSubstrings(activate, [
    'catch (error)',
    'sceneController.rollbackClassicLayerRestart()',
    'this.disposeClassicModePresentation()',
    'this.retainCurrentClassicRunForCleanup()',
    'this.installClassicRunOwnership(this.createFreshClassicRunOwnership())',
    'this.screenPlacement = retainedScreenPlacement',
    'typedLifecycleFailure',
    'sceneController.failClosedAfterLifecycleRollback(',
    'this.quiesceClassicAfterFatalLifecycle(fatalError)',
  ]);
  assert.match(activate, /screenPlacement\.currentScreen !== null/);
  assertOrderedSubstrings(activate, [
    'sceneController.restartClassicLayer()',
    'this.resetRecoveredClassicRunState()',
    'this.constructRecoveredClassicMode(',
    'this.attachRecoveredClassicMode(1)',
    'this.updatePresentation()',
    'this.emitSnapshot()',
    'sceneController.commitClassicLayerRestart()',
    "sceneController.activateInitialClassicLayer()",
    'this.initialClassicRuntimeActivated = true',
  ]);
});

test('blade handlers ignore shared menu input unless Classic is the active current screen', () => {
  const source = readGameplaySource();
  const onMoved = extractMethod(source, 'onBladeMoved');
  const onBegan = extractMethod(source, 'onBladeBegan');
  const onEnded = extractMethod(source, 'onBladeEnded');
  const helper = extractMethod(source, 'isClassicGameplayActive');

  assert.match(helper, /root !== null/);
  assert.match(helper, /screenPlacement\?\.currentScreen === root/);
  assert.match(helper, /root\.activeInHierarchy/);
  for (const handler of [onMoved, onBegan, onEnded]) {
    assert.match(handler, /if \(!this\.isClassicGameplayActive\(\)\) \{\s*return;/);
  }
  assertOrderedSubstrings(onMoved, [
    'if (!this.isClassicGameplayActive())',
    'const presenter = this.bladePresenter',
    'this.swishAudio.request(',
  ]);
});

test('Classic to Result to Retry routes every top-level screen through the placement port', () => {
  const source = readGameplaySource();
  const attachResult = extractMethod(source, 'attachRecoveredResult');
  const removeResult = extractMethod(source, 'removeResultForRetry');
  const attachFreshClassic = extractMethod(source, 'attachClassicForRetry');
  const rollbackRetry = extractMethod(source, 'rollbackFailedRetry');

  assertOrderedSubstrings(attachResult, [
    'createDetachedScreenRoot(',
    'this.requireScreenPlacement().attachCurrentScreen(root)',
    'presenter.attach(root)',
  ]);
  assert.match(
    removeResult,
    /screenPlacement\.detachCurrentScreen\([\s\S]*?retryContext\.resultRoot/,
  );
  assert.match(attachFreshClassic, /retryContext\.screenPlacement\.currentScreen !== null/);
  assert.match(attachFreshClassic, /this\.attachRecoveredClassicMode\(command\.zOrder\)/);
  assert.match(
    rollbackRetry,
    /screenPlacement\.currentScreen !== null[\s\S]*?screenPlacement\.attachCurrentScreen\(retryContext\.resultRoot\)[\s\S]*?rearmNavigationAfterFailure\('retry'\)/,
  );
  for (const boundary of [attachResult, removeResult, attachFreshClassic, rollbackRetry]) {
    assert.doesNotMatch(boundary, /\.setParent\(|\.setSiblingIndex\(|\.addChild\(|\.removeFromParent\(/);
  }
});

test('Classic Result commits the native objective tail once only after visible attachment', () => {
  const source = readGameplaySource();
  const attachResult = extractMethod(source, 'attachRecoveredResult');
  const dispatchObjective = extractMethod(
    source,
    'dispatchRecoveredResultObjectiveTail',
  );
  const resetRun = extractMethod(source, 'resetRecoveredClassicRunState');

  assertOrderedSubstrings(attachResult, [
    'settings.state.recordClassicResultScore(configured.score)',
    'this.requireScreenPlacement().attachCurrentScreen(root)',
    'presenter.attach(root)',
    'this.resultPresentationRoot = root',
    'this.resultPresenter = presenter',
    'this.dispatchRecoveredResultObjectiveTail(configured.mode, configured.score)',
  ]);
  assertOrderedSubstrings(dispatchObjective, [
    'if (this.resultObjectiveTailAttempted)',
    'this.resultObjectiveTailAttempted = true',
    'createRecoveredResultObjectiveCommand(mode, score)',
    'this.requireObjectivesManager().processGameEvent(',
  ]);
  assert.match(
    dispatchObjective,
    /collectClassicCleanupFailure\(failures,[\s\S]*?console\.error/,
  );
  assert.match(resetRun, /this\.resultObjectiveTailAttempted = false/);
});

test('Result Menu exposes idempotent commit and rollback tokens around atomic replacement', () => {
  const source = readGameplaySource();
  const onMenu = extractMethod(source, 'onResultMenu');
  const commit = extractMethod(source, 'commitResultMenuTransition');
  const rollback = extractMethod(source, 'rollbackResultMenuTransition');

  assert.match(
    source,
    /export interface ClassicResultMenuRequestedEvent \{[\s\S]*?readonly completedRunScore: number;[\s\S]*?readonly resultRoot: Node;[\s\S]*?commit\(previousRoot: Node\): void;[\s\S]*?rollback\(\): void;[\s\S]*?\}/,
  );
  assert.match(onMenu, /resultRoot,/);
  assert.match(onMenu, /commit: \(previousRoot: Node\)/);
  assert.match(onMenu, /rollback: \(\)/);
  assert.match(onMenu, /CLASSIC_RESULT_MENU_REQUESTED_EVENT/);

  assert.match(commit, /previousRoot !== transaction\.root/);
  assert.match(commit, /transaction\.status === 'committed'[\s\S]*?return;/);
  assert.match(commit, /transaction\.root\.parent !== null/);
  assert.match(commit, /transaction\.screenPlacement\.currentScreen === transaction\.root/);
  assertOrderedSubstrings(commit, [
    'this.resultPresentationRoot = null',
    'this.resultPresenter = null',
    "transaction.status = 'committed'",
    'transaction.presenter.dispose()',
    'transaction.root.destroy()',
  ]);

  assert.match(rollback, /transaction\.status === 'rolled-back'[\s\S]*?return;/);
  assert.match(rollback, /transaction\.screenPlacement\.attachCurrentScreen\(transaction\.root\)/);
  assert.match(rollback, /transaction\.screenPlacement\.replaceCurrentScreen\(transaction\.root\)/);
  assertOrderedSubstrings(rollback, [
    'transaction.screenPlacement.currentScreen !== transaction.root',
    "transaction.presenter.rearmNavigationAfterFailure('menu')",
    "transaction.status = 'rolled-back'",
  ]);
});

test('standard Classic attaches and owns the recovered BaseGameplay pause presenter', () => {
  const source = readGameplaySource();
  const initialize = extractMethod(source, 'initializePausePresentation');
  const attach = extractMethod(source, 'attachRecoveredClassicMode');
  const update = extractMethod(source, 'update');
  const dispose = extractMethod(source, 'disposeClassicModePresentation');
  const disposePause = extractMethod(source, 'disposePausePresenterForRetry');
  const disposeDisposedPause = extractMethod(
    source,
    'disposeDisposedPausePresenter',
  );

  assert.match(source, /import \{ BaseGameplayPausePresenter \}/);
  assertOrderedSubstrings(initialize, [
    'const resolution = this.sceneController?.resolutionSnapshot()',
    'contentScaleFactor: resolution.profile.contentScaleFactor',
    'initialCard: this.currentPauseCard()',
    'resources: this.requireBaseGameplayResources()',
    'height: resolution.visibleRect.height',
    'width: resolution.visibleRect.width',
    'this.pausePresenter = presenter',
    'presenter.attach(this.requireClassicModeRoot())',
    'this.disposePausePresenterForRetry(presenter)',
    'if (this.pausePresenter === presenter)',
  ]);
  assertOrderedSubstrings(attach, [
    'screenPlacement.attachCurrentScreen(root)',
    'screenPlacement.currentScreen !== root',
    'this.initializePausePresentation()',
  ]);
  assert.match(update, /this\.pausePresenter\?\.updateAction\(deltaSeconds\)/);
  assertOrderedSubstrings(dispose, [
    'const pausePresenter = this.pausePresenter',
    'this.disposePausePresenterForRetry(pausePresenter)',
    'if (this.pausePresenter === pausePresenter)',
    'this.pausePresenter = null',
    'this.classicModeRoot = null',
  ]);
  assertOrderedSubstrings(disposePause, [
    'const directorPauseOwned = presenter.snapshot.directorPauseOwned',
    'this.pendingPauseDirectorResumes.add(presenter)',
    'presenter.dispose()',
    'director.isPaused()',
    'this.disposeDisposedPausePresenter(presenter)',
  ]);
  assertOrderedSubstrings(disposeDisposedPause, [
    'this.pendingPauseDirectorResumes.has(presenter)',
    'director.resume()',
    'this.pendingPauseDirectorResumes.delete(presenter)',
    'presenter.objectiveOverlay.node',
    'presenter.optionsMenu.node',
    'presenter.pauseMenu.node',
  ]);
});

test('Classic Pause and Resume preserve recovered ingress-first audio asymmetry', () => {
  const source = readGameplaySource();
  const pause = extractMethod(source, 'onPauseRequested');
  const resume = extractMethod(source, 'onResumeRequested');

  assertOrderedSubstrings(pause, [
    'this.requirePausePresenter().pauseIngress(this.currentPauseCard())',
    'this.sharedAudioPresenter.playOneShot(CLASSIC_MENU_BUTTON_AUDIO_PATH)',
    'this.sharedAudioPresenter.pauseAllEffects()',
    'this.sharedAudioPresenter.pauseBackgroundMusic()',
  ]);
  assertOrderedSubstrings(resume, [
    'this.requirePausePresenter().resumeEgress()',
    'this.sharedAudioPresenter.playOneShot(CLASSIC_MENU_BUTTON_AUDIO_PATH)',
    'this.sharedAudioPresenter.resumeAllEffects()',
  ]);
  assert.doesNotMatch(resume, /resumeBackgroundMusic/);
});

test('Classic Pause Replay replaces with a fresh run in exact shared callback order', () => {
  const source = readGameplaySource();
  const replay = extractMethod(source, 'restartClassicFromPause');

  assertOrderedSubstrings(replay, [
    'this.createFreshClassicRunOwnership()',
    'this.constructRecoveredClassicMode(',
    'audio.stopBackgroundMusic()',
    'audio.stopAllEffects()',
    'oldPause.resumeEgress()',
    'oldPause.stopAllActions()',
    'sceneController.suspendClassicLayerForNavigation()',
    'placement.replaceCurrentScreen(freshRoot)',
    'this.initializePausePresentation()',
    'sceneController.restartSuspendedClassicLayer()',
    'sceneController.commitClassicLayerRestart()',
  ]);
  const committedReplay = replay.slice(
    replay.indexOf('const freshOwnership = this.captureClassicRunOwnership()'),
  );
  assertOrderedSubstrings(committedReplay, [
    'this.installClassicRunOwnership(oldOwnership)',
    'this.disposeClassicModePresentation()',
    'this.installClassicRunOwnership(freshOwnership)',
    'audio.playOneShot(CLASSIC_MENU_BUTTON_AUDIO_PATH)',
  ]);
  assert.match(
    replay,
    /catch \(error\)[\s\S]*?rollbackClassicLayerRestart\(\)[\s\S]*?replaceCurrentScreen\(oldRoot\)[\s\S]*?installClassicRunOwnership\(oldOwnership\)/,
  );
  assertOrderedSubstrings(replay, [
    'destructiveAudioMutationStarted = true',
    'audio.stopBackgroundMusic()',
    'error instanceof ClassicLifecycleRollbackError',
    '|| destructiveAudioMutationStarted',
    'sceneController.failClosedAfterLifecycleRollback(',
    'this.quiesceClassicAfterFatalLifecycle(fatalError)',
  ]);
  assert.doesNotMatch(replay, /\.save\(|awardClassicResultCoins|processGameEvent/);
});

test('Classic Pause Quit emits one typed synchronous transaction and restores missing shell', () => {
  const source = readGameplaySource();
  const quit = extractMethod(source, 'onPauseQuitRequested');
  const commit = extractMethod(source, 'commitPauseQuit');
  const rollback = extractMethod(source, 'rollbackPauseQuit');

  assert.match(
    source,
    /export interface ClassicPauseQuitRequestedEvent \{[\s\S]*?readonly classicRoot: Node;[\s\S]*?commit\(previousRoot: Node\): void;[\s\S]*?rollback\(\): void;/,
  );
  assertOrderedSubstrings(quit, [
    'pauseEgressStarted = true',
    'pause.resumeEgress()',
    'pause.stopAllActions()',
    'this.requireClassicModeRoot()',
    'suspendClassicLayerForNavigation()',
    'CLASSIC_PAUSE_QUIT_REQUESTED_EVENT',
    "transaction.status === 'pending'",
  ]);
  assert.match(
    quit,
    /try \{[\s\S]*?pauseEgressStarted = true[\s\S]*?pause\.resumeEgress\(\)[\s\S]*?catch \(error\)[\s\S]*?pause\.stopAllActions\(\)[\s\S]*?restorePausedPresenter\(pause, directorPauseOwned\)/,
  );
  assert.match(
    quit,
    /try \{[\s\S]*?this\.node\.emit\(CLASSIC_PAUSE_QUIT_REQUESTED_EVENT, payload\);[\s\S]*?\} finally \{[\s\S]*?transaction\.status === 'pending'[\s\S]*?this\.rollbackPauseQuit\(transaction\)/,
  );
  assert.doesNotMatch(quit, /stopBackgroundMusic|stopAllEffects|\.save\(/);
  assertOrderedSubstrings(commit, [
    'const retiredOwnership = this.captureClassicRunOwnership()',
    'const emptyOwnership = this.createFreshClassicRunOwnership()',
    'finalizeSuspendedClassicLayerRelease()',
    "transaction.status = 'committed'",
    'this.disposeClassicModePresentation()',
    'this.installClassicRunOwnership(emptyOwnership)',
    'this.sharedAudioPresenter.stopAllEffects()',
    'this.sharedAudioPresenter.resumeBackgroundMusic()',
    'playOneShot(CLASSIC_MENU_BUTTON_AUDIO_PATH)',
  ]);
  assertOrderedSubstrings(rollback, [
    'transaction.screenPlacement.attachCurrentScreen(transaction.root)',
    'transaction.screenPlacement.replaceCurrentScreen(transaction.root)',
    'resumeSuspendedClassicLayer()',
    'this.restorePausedPresenter(',
    'this.restoreClassicPauseAudioLeases(',
    "transaction.status = 'rolled-back'",
    'this.emitSnapshotReportOnly(',
  ]);
  assertOrderedSubstrings(rollback, [
    'catch (error)',
    'sceneController.failClosedAfterLifecycleRollback(',
    "transaction.status = 'fatal'",
    'this.quiesceClassicAfterFatalLifecycle(fatalError)',
    'throw fatalError',
  ]);
});

test('Classic pause disposal retries only its captured director-pause lease', () => {
  const collectClassicCleanupFailure = (
    failures: unknown[],
    operation: () => void,
  ): void => {
    try {
      operation();
    } catch (error) {
      failures.push(error);
    }
  };
  const throwClassicCleanupFailures = (
    operation: string,
    failures: readonly unknown[],
  ): void => {
    if (failures.length > 0) {
      throw new Error(`${operation}: ${String(failures[0])}`);
    }
  };
  let paused = true;
  let resumeAttempts = 0;
  const timeline: string[] = [];
  const executableDirector = {
    isPaused: () => paused,
    resume() {
      resumeAttempts += 1;
      timeline.push(`director:resume:${resumeAttempts}`);
      if (resumeAttempts === 1) {
        throw new Error('injected first director resume failure');
      }
      paused = false;
    },
  };
  const dependencies = {
    aggregateClassicFailure: (
      label: string,
      primary: unknown,
      rollbackFailures: readonly unknown[],
    ) => new Error(
      `${label}: ${String(primary)}; retry: ${String(rollbackFailures[0])}`,
    ),
    collectClassicCleanupFailure,
    director: executableDirector,
    isValid: (node: { valid: boolean }) => node.valid,
    throwClassicCleanupFailures,
  };
  const disposeDisposedPausePresenter = compileGameplayMethod<
    (
      this: Record<string, unknown>,
      presenter: Record<string, unknown>,
    ) => void
  >('disposeDisposedPausePresenter', dependencies);
  const disposePausePresenterForRetry = compileGameplayMethod<
    (
      this: Record<string, unknown>,
      presenter: Record<string, unknown>,
    ) => void
  >('disposePausePresenterForRetry', dependencies);

  const createRoot = (name: string) => ({
    valid: true,
    destroy() {
      timeline.push(`root:destroy:${name}`);
      this.valid = false;
    },
  });
  let disposed = false;
  const presenter = {
    objectiveOverlay: { node: createRoot('objective') },
    optionsMenu: { node: createRoot('options') },
    pauseMenu: { node: createRoot('pause') },
    get isDisposed() {
      return disposed;
    },
    snapshot: { directorPauseOwned: true },
    dispose() {
      disposed = true;
      executableDirector.resume();
    },
  };
  const controller: Record<string, unknown> = {
    disposeDisposedPausePresenter,
    pendingPauseDirectorResumes: new Set(),
  };

  disposePausePresenterForRetry.call(controller, presenter);
  assert.equal(paused, false);
  assert.equal(
    (controller.pendingPauseDirectorResumes as Set<unknown>).size,
    0,
  );
  assert.deepEqual(timeline, [
    'director:resume:1',
    'director:resume:2',
    'root:destroy:objective',
    'root:destroy:options',
    'root:destroy:pause',
  ]);

  disposePausePresenterForRetry.call(controller, presenter);
  assert.equal(resumeAttempts, 2);
});

test('Classic Pause Quit stages fallible empty ownership before scene retirement', () => {
  const commitPauseQuit = compileGameplayMethod<
    (
      this: Record<string, unknown>,
      transaction: Record<string, unknown>,
      previousRoot: object,
    ) => void
  >('commitPauseQuit');

  const primary = new Error('injected fresh ownership construction failure');
  const timeline: string[] = [];
  const root = { parent: null };
  const menuRoot = {};
  const presenter = {};
  const transaction: Record<string, unknown> = {
    presenter,
    root,
    screenPlacement: { currentScreen: menuRoot },
    status: 'pending',
  };
  const controller: Record<string, unknown> = {
    classicModeRoot: root,
    captureClassicRunOwnership() {
      timeline.push('ownership:capture-retired');
      return { id: 'retired' };
    },
    createFreshClassicRunOwnership() {
      timeline.push('ownership:stage-empty');
      throw primary;
    },
    pausePresenter: presenter,
    requireSceneController: () => ({
      finalizeSuspendedClassicLayerRelease() {
        timeline.push('scene:finalize');
      },
    }),
  };

  assert.throws(
    () => commitPauseQuit.call(controller, transaction, root),
    (error) => error === primary,
  );
  assert.equal(transaction.status, 'pending');
  assert.deepEqual(timeline, [
    'ownership:capture-retired',
    'ownership:stage-empty',
  ]);
});

test('Classic Pause Quit cancels queued PauseOut before restoring pause after resume failure', () => {
  class ExecutableClassicLifecycleRollbackError extends Error {}
  const collectClassicCleanupFailure = (
    failures: unknown[],
    operation: () => void,
  ): void => {
    try {
      operation();
    } catch (error) {
      failures.push(error);
    }
  };
  const onPauseQuitRequested = compileGameplayArrowMember<
    (this: Record<string, unknown>) => void
  >('onPauseQuitRequested', {
    ClassicLifecycleRollbackError: ExecutableClassicLifecycleRollbackError,
    aggregateClassicFailure: (
      label: string,
      primary: unknown,
    ) => new Error(`${label}: ${String(primary)}`),
    collectClassicCleanupFailure,
  });

  const timeline: string[] = [];
  const primary = new Error('injected director resume failure');
  const pausePresenter = {
    snapshot: { directorPauseOwned: true },
    resumeEgress() {
      timeline.push('pause:resume-egress');
      throw primary;
    },
    stopAllActions() {
      timeline.push('pause:stop-actions');
    },
  };
  const controller: Record<string, unknown> = {
    lifecycleFatalError: null,
    requirePausePresenter: () => pausePresenter,
    requireSceneController: () => ({ fatalLifecycle: false }),
    requireSettingsRuntime: () => ({
      state: {
        snapshot: {
          effectsEnabled: true,
          musicEnabled: true,
        },
      },
    }),
    restorePausedPresenter(
      presenter: typeof pausePresenter,
      directorPauseOwned: boolean,
    ) {
      assert.equal(presenter, pausePresenter);
      assert.equal(directorPauseOwned, true);
      timeline.push('pause:restore');
    },
  };

  assert.throws(
    () => onPauseQuitRequested.call(controller),
    (error) => error === primary,
  );
  assert.deepEqual(timeline, [
    'pause:resume-egress',
    'pause:stop-actions',
    'pause:restore',
  ]);
});

test('Classic committed Pause Quit retains fallible cleanup and releases audio before click', () => {
  const collectClassicCleanupFailure = (
    failures: unknown[],
    operation: () => void,
  ): void => {
    try {
      operation();
    } catch (error) {
      failures.push(error);
    }
  };
  const retryClassicCleanupOperation = (
    failures: unknown[],
    operation: () => void,
  ): void => {
    try {
      operation();
    } catch (firstError) {
      try {
        operation();
      } catch (retryError) {
        failures.push(new Error(
          `${String(firstError)}; retry: ${String(retryError)}`,
        ));
      }
    }
  };
  const reported: unknown[][] = [];
  const commitPauseQuit = compileGameplayMethod<
    (
      this: Record<string, unknown>,
      transaction: Record<string, unknown>,
      previousRoot: object,
    ) => void
  >('commitPauseQuit', {
    CLASSIC_MENU_BUTTON_AUDIO_PATH: 'audio/menu-click.mp3',
    collectClassicCleanupFailure,
    reportClassicCleanupFailures: (
      _label: string,
      failures: readonly unknown[],
    ) => reported.push([...failures]),
    retryClassicCleanupOperation,
  });

  const timeline: string[] = [];
  const root = { parent: null };
  const menuRoot = {};
  const pausePresenter = {};
  const transaction: Record<string, unknown> = {
    directorPauseOwned: true,
    effectsPauseLeaseRequired: true,
    musicPauseLeaseRequired: true,
    presenter: pausePresenter,
    root,
    screenPlacement: { currentScreen: menuRoot },
    status: 'pending',
  };
  let installedOwnership: object = { id: 'active' };
  const controller: Record<string, unknown> = {
    captureClassicRunOwnership() {
      timeline.push('ownership:capture-retired');
      return { id: 'retired' };
    },
    classicModeRoot: root,
    createFreshClassicRunOwnership() {
      return { id: 'empty' };
    },
    disposeClassicModePresentation() {
      timeline.push('presentation:dispose');
      throw new Error('injected committed presentation cleanup failure');
    },
    effectsEnabled: () => true,
    emitSnapshot() {
      timeline.push('snapshot');
    },
    installClassicRunOwnership(ownership: object) {
      installedOwnership = ownership;
      timeline.push(`ownership:install:${String(
        (ownership as { id?: string }).id,
      )}`);
    },
    pausePresenter,
    requireSceneController: () => ({
      finalizeSuspendedClassicLayerRelease() {
        timeline.push('scene:finalize');
      },
    }),
    retainCurrentClassicRunForCleanup() {
      timeline.push('ownership:retain-failed');
    },
    sharedAudioPresenter: {
      playOneShot() {
        timeline.push('audio:click');
      },
      resumeBackgroundMusic() {
        timeline.push('audio:resume-background');
      },
      stopAllEffects() {
        timeline.push('audio:stop-effects');
      },
    },
  };

  commitPauseQuit.call(controller, transaction, root);

  assert.equal(transaction.status, 'committed');
  assert.deepEqual(installedOwnership, { id: 'empty' });
  assert.deepEqual(timeline, [
    'ownership:capture-retired',
    'scene:finalize',
    'ownership:install:retired',
    'presentation:dispose',
    'ownership:retain-failed',
    'ownership:install:empty',
    'audio:stop-effects',
    'audio:resume-background',
    'audio:click',
    'snapshot',
  ]);
  assert.equal(reported.length, 1);
  assert.equal(reported[0]?.length, 1);
});

test('Classic Pause Replay audio retirement failure enters the typed fatal boundary', () => {
  class ExecutableClassicLifecycleRollbackError extends Error {}
  const collectClassicCleanupFailure = (
    failures: unknown[],
    operation: () => void,
  ): void => {
    try {
      operation();
    } catch (error) {
      failures.push(error);
    }
  };
  const restartClassicFromPause = compileGameplayMethod<
    (this: Record<string, unknown>) => void
  >('restartClassicFromPause', {
    CLASSIC_MENU_BUTTON_AUDIO_PATH: 'audio/menu-click.mp3',
    ClassicLifecycleRollbackError: ExecutableClassicLifecycleRollbackError,
    aggregateClassicFailure: (
      label: string,
      primary: unknown,
    ) => new Error(`${label}: ${String(primary)}`),
    collectClassicCleanupFailure,
    isValid: () => true,
    reportClassicCleanupFailures() {},
  });

  const timeline: string[] = [];
  const oldRoot = { parent: {} };
  const freshRoot = { parent: null };
  const oldPause = {
    snapshot: { directorPauseOwned: true },
  };
  const oldOwnership = {
    swishAudio: { locked: false },
  };
  const primary = new Error('injected background stop failure');
  const fatal = new ExecutableClassicLifecycleRollbackError(
    'fatal Classic replay',
  );
  const sceneController = {
    fatalLifecycle: false,
    suspended: false,
    failClosedAfterLifecycleRollback() {
      timeline.push('scene:fail-closed');
      return fatal;
    },
  };
  const audio = {
    stopBackgroundMusic() {
      timeline.push('audio:stop-background');
      throw primary;
    },
    stopAllEffects() {
      timeline.push('audio:stop-effects');
    },
  };
  const controller: Record<string, unknown> = {
    captureClassicRunOwnership: () => oldOwnership,
    constructRecoveredClassicMode() {
      timeline.push('presentation:construct-fresh');
    },
    createFreshClassicRunOwnership: () => ({ id: 'fresh' }),
    disposeClassicModePresentation() {
      timeline.push('presentation:dispose-fresh');
    },
    drainRetiredClassicRunOwnership() {},
    installClassicRunOwnership(ownership: object) {
      timeline.push(
        ownership === oldOwnership
          ? 'ownership:restore-old'
          : 'ownership:install-fresh',
      );
    },
    lifecycleFatalError: null,
    quiesceClassicAfterFatalLifecycle(error: Error) {
      assert.equal(error, fatal);
      timeline.push('presentation:quiesce');
    },
    requireClassicModeRoot: () => oldRoot,
    requireDetachedClassicModeRoot: () => freshRoot,
    requirePausePresenter: () => oldPause,
    requireSceneController: () => sceneController,
    requireScreenPlacement: () => ({ currentScreen: oldRoot }),
    requireSettingsRuntime: () => ({
      state: {
        snapshot: {
          effectsEnabled: true,
          musicEnabled: true,
        },
      },
    }),
    requireViewport: () => ({ height: 640, width: 360 }),
    restoreClassicPauseAudioLeases() {
      timeline.push('audio:restore-pause-leases');
    },
    restoreRetainedSwishCooldown() {
      timeline.push('swish:restore');
    },
    sharedAudioPresenter: audio,
    sharedResourceCatalog: {},
    unschedule() {
      timeline.push('swish:unschedule');
    },
  };

  assert.throws(
    () => restartClassicFromPause.call(controller),
    (error) => error === fatal,
  );
  assert.deepEqual(timeline, [
    'swish:unschedule',
    'ownership:install-fresh',
    'presentation:construct-fresh',
    'audio:stop-background',
    'presentation:dispose-fresh',
    'ownership:restore-old',
    'audio:restore-pause-leases',
    'swish:restore',
    'scene:fail-closed',
    'presentation:quiesce',
  ]);
});

test('Classic Pause Quit rollback failure becomes fatal after restoring screen ownership', () => {
  class ExecutableClassicLifecycleRollbackError extends Error {}
  const rollbackPauseQuit = compileGameplayMethod<
    (
      this: Record<string, unknown>,
      transaction: Record<string, unknown>,
    ) => void
  >('rollbackPauseQuit', {
    ClassicLifecycleRollbackError: ExecutableClassicLifecycleRollbackError,
    isValid: () => true,
  });

  const root = { parent: null };
  const menuRoot = {};
  const presenter = {};
  const placement = {
    currentScreen: menuRoot as object,
    replaceCurrentScreen(next: object) {
      const previous = this.currentScreen;
      this.currentScreen = next;
      return previous;
    },
  };
  const fatal = new ExecutableClassicLifecycleRollbackError(
    'injected fatal Quit rollback',
  );
  let quiesced: Error | null = null;
  const sceneController = {
    failClosedAfterLifecycleRollback() {
      return fatal;
    },
    resumeSuspendedClassicLayer() {
      throw new Error('injected scene resume failure');
    },
  };
  const transaction: Record<string, unknown> = {
    directorPauseOwned: true,
    effectsPauseLeaseRequired: true,
    musicPauseLeaseRequired: true,
    presenter,
    root,
    screenPlacement: placement,
    status: 'pending',
  };
  const controller: Record<string, unknown> = {
    classicModeRoot: root,
    lifecycleFatalError: null,
    pausePresenter: presenter,
    quiesceClassicAfterFatalLifecycle(error: Error) {
      quiesced = error;
    },
    requireSceneController: () => sceneController,
  };

  assert.throws(
    () => rollbackPauseQuit.call(controller, transaction),
    (error) => error === fatal,
  );
  assert.equal(placement.currentScreen, root);
  assert.equal(transaction.status, 'fatal');
  assert.equal(quiesced, fatal);
});

test('retired Classic presentation cleanup remains owned until a retry succeeds', () => {
  const drainRetiredClassicRunOwnership = compileGameplayMethod<
    (this: Record<string, unknown>) => void
  >('drainRetiredClassicRunOwnership', {
    throwClassicCleanupFailures(
      label: string,
      failures: readonly unknown[],
    ) {
      if (failures.length > 0) {
        throw new Error(`${label}: ${String(failures[0])}`);
      }
    },
  });

  const activeOwnership = { id: 'active' };
  const retiredOwnership = { id: 'retired' };
  const partiallyDisposedOwnership = { id: 'retired-partial' };
  let installedOwnership = activeOwnership;
  let disposalAttempts = 0;
  const controller: Record<string, unknown> = {
    captureClassicRunOwnership: () => installedOwnership,
    disposeClassicModePresentation() {
      disposalAttempts += 1;
      if (disposalAttempts === 1) {
        installedOwnership = partiallyDisposedOwnership;
        throw new Error('injected first cleanup failure');
      }
    },
    installClassicRunOwnership(ownership: typeof activeOwnership) {
      installedOwnership = ownership;
    },
    retiredClassicRuns: [retiredOwnership],
  };

  assert.throws(
    () => drainRetiredClassicRunOwnership.call(controller),
    /injected first cleanup failure/,
  );
  assert.equal(installedOwnership, activeOwnership);
  assert.deepEqual(controller.retiredClassicRuns, [partiallyDisposedOwnership]);

  drainRetiredClassicRunOwnership.call(controller);
  assert.equal(installedOwnership, activeOwnership);
  assert.deepEqual(controller.retiredClassicRuns, []);
  assert.equal(disposalAttempts, 2);
});

test('Classic re-entry always cleans gameplay and restores placement after scene rollback poison', () => {
  class ExecutableClassicLifecycleRollbackError extends Error {}
  const collectClassicCleanupFailure = (
    failures: unknown[],
    operation: () => void,
  ): void => {
    try {
      operation();
    } catch (error) {
      failures.push(error);
    }
  };
  const activateClassicFromAppShell = compileGameplayMethod<
    (
      this: Record<string, unknown>,
      placement: Record<string, unknown>,
    ) => void
  >('activateClassicFromAppShell', {
    ClassicLifecycleRollbackError: ExecutableClassicLifecycleRollbackError,
    aggregateClassicFailure: (
      label: string,
      primary: unknown,
    ) => new Error(`${label}: ${String(primary)}`),
    assertScreenPlacementPort() {},
    collectClassicCleanupFailure,
    reportClassicCleanupFailures() {},
  });

  const timeline: string[] = [];
  const placement = { currentScreen: null as object | null };
  const freshRoot = {};
  const primary = new Error('injected post-attachment observer failure');
  const fatal = new ExecutableClassicLifecycleRollbackError(
    'injected scene rollback poison',
  );
  const sceneController = {
    fatalLifecycle: false,
    rollbackClassicLayerRestart() {
      timeline.push('scene:rollback');
      this.fatalLifecycle = true;
      throw fatal;
    },
    restartClassicLayer() {
      timeline.push('scene:restart');
    },
    sessionSnapshot: () => ({ lifecycle: 'navigation-removed' }),
  };
  const controller: Record<string, unknown> = {
    audioPresenter: {},
    baseGameplayResources: {},
    bladePresenter: null,
    classicModeRoot: null,
    constructRecoveredClassicMode() {
      timeline.push('presentation:construct');
      this.classicModeRoot = freshRoot;
    },
    disposeClassicModePresentation() {
      timeline.push('presentation:dispose');
      this.classicModeRoot = null;
      placement.currentScreen = null;
    },
    drainRetiredClassicRunOwnership() {},
    emitSnapshot() {
      timeline.push('snapshot:emit');
      throw primary;
    },
    failPresenter: null,
    initialClassicRuntimeActivated: true,
    lifecycleFatalError: null,
    normalFree: null,
    objectivesManager: {},
    pausePresenter: null,
    quiesceClassicAfterFatalLifecycle(error: Error) {
      assert.equal(error, fatal);
      timeline.push('presentation:quiesce');
    },
    registry: null,
    requireViewport: () => ({ height: 640, width: 360 }),
    resetRecoveredClassicRunState() {
      timeline.push('run:reset');
    },
    resourceCatalog: {},
    resultPresentationRoot: null,
    resultPresenter: null,
    sceneController,
    scoreHudPresenter: null,
    screenPlacement: placement,
    shuttingDown: false,
    attachRecoveredClassicMode() {
      timeline.push('presentation:attach');
      placement.currentScreen = freshRoot;
    },
    updatePresentation() {
      timeline.push('presentation:update');
    },
  };

  assert.throws(
    () => activateClassicFromAppShell.call(controller, placement),
    (error) => error === fatal,
  );
  assert.equal(controller.screenPlacement, placement);
  assert.equal(controller.classicModeRoot, null);
  assert.equal(placement.currentScreen, null);
  assert.deepEqual(timeline, [
    'scene:restart',
    'run:reset',
    'presentation:construct',
    'presentation:attach',
    'presentation:update',
    'snapshot:emit',
    'scene:rollback',
    'presentation:dispose',
    'presentation:quiesce',
  ]);
});

function readGameplaySource(): string {
  return readFileSync(
    `${REPOSITORY_ROOT}/game/assets/scripts/creator/classic-gameplay-controller.ts`,
    'utf8',
  );
}

function extractMethod(source: string, methodName: string): string {
  const signature = new RegExp(
    `^[\\t ]*(?:private\\s+)?(?:readonly\\s+)?(?:async\\s+)?${methodName}\\b(?=[\\t ]*(?:=|\\())`,
    'm',
  );
  const match = signature.exec(source);
  assert.ok(match, `${methodName} method must exist`);

  const start = match.index;
  const openParenthesis = source.indexOf('(', start);
  assert.notEqual(openParenthesis, -1, `${methodName} parameter list must start`);
  let parenthesisDepth = 0;
  let closeParenthesis = -1;
  for (let index = openParenthesis; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') {
      parenthesisDepth += 1;
    } else if (character === ')') {
      parenthesisDepth -= 1;
      if (parenthesisDepth === 0) {
        closeParenthesis = index;
        break;
      }
    }
  }
  assert.notEqual(closeParenthesis, -1, `${methodName} parameter list must end`);
  const openBrace = source.indexOf('{', closeParenthesis);
  assert.notEqual(openBrace, -1, `${methodName} method body must start`);
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
  throw new Error(`${methodName} method body is unterminated`);
}

function compileGameplayMethod<T extends (...args: any[]) => unknown>(
  methodName: string,
  dependencies: Readonly<Record<string, unknown>> = {},
): T {
  const source = extractMethod(readGameplaySource(), methodName).replace(
    new RegExp(`^[\\t ]*(?:private\\s+)?${methodName}`),
    `function ${methodName}`,
  );
  const names = Object.keys(dependencies);
  const values = names.map((name) => dependencies[name]);
  const javascript = stripTypeScriptTypes(source, {
    mode: 'transform',
    sourceUrl: `classic-app-shell-boundary.test.${methodName}.ts`,
  });
  return Function(
    ...names,
    `"use strict";\n${javascript}\nreturn ${methodName};`,
  )(...values) as T;
}

function compileGameplayArrowMember<T extends (...args: any[]) => unknown>(
  memberName: string,
  dependencies: Readonly<Record<string, unknown>> = {},
): T {
  const source = extractMethod(readGameplaySource(), memberName)
    .replace(
      new RegExp(
        `^[\\t ]*private\\s+readonly\\s+${memberName}\\s*=\\s*\\(`,
      ),
      `function ${memberName}(`,
    )
    .replace(/\)\s*:\s*void\s*=>\s*\{/, '): void {');
  const names = Object.keys(dependencies);
  const values = names.map((name) => dependencies[name]);
  const javascript = stripTypeScriptTypes(source, {
    mode: 'transform',
    sourceUrl: `classic-app-shell-boundary.test.${memberName}.ts`,
  });
  return Function(
    ...names,
    `"use strict";\n${javascript}\nreturn ${memberName};`,
  )(...values) as T;
}

function assertOrderedSubstrings(source: string, expected: readonly string[]): void {
  let previousIndex = -1;
  for (const value of expected) {
    const index = source.indexOf(value);
    assert.ok(index > previousIndex, `${value} must appear in recovered order`);
    previousIndex = index;
  }
}
