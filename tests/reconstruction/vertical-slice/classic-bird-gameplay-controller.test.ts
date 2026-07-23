import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SOURCE = readFileSync(
  `${REPOSITORY_ROOT}/game/assets/scripts/creator/classic-bird-gameplay-controller.ts`,
  'utf8',
);

test('Classic Bird gameplay owns the complete four-component Creator boundary', () => {
  assert.match(SOURCE, /@ccclass\('ClassicBirdGameplayController'\)/);
  for (const dependency of [
    'ClassicBirdSceneController',
    'BirdInputController',
    'ClassicGameplayController',
    'CrazyGameplayController',
  ]) {
    assert.match(
      SOURCE,
      new RegExp(`@requireComponent\\(${dependency}\\)`),
    );
    assert.match(
      extractMethod(SOURCE, 'onLoad'),
      new RegExp(`this\\.getComponent\\(${dependency}\\)`),
    );
  }
  const start = extractMethod(SOURCE, 'start');
  assert.match(start, /this\.emitSnapshot\(\)/);
  assert.doesNotMatch(start, /prepare|activate|attach|loadBirdResources/);
});

test('preparation reuses Classic and Crazy before loading exactly 17 Bird rasters', () => {
  const prepare = extractMethod(SOURCE, 'prepareClassicBirdRuntime');
  assertOrderedSubstrings(prepare, [
    "this.readinessStatus = 'pending'",
    'const attempt = this.initializePreparation()',
    'this.preparation = attempt',
    'void attempt.catch',
    'this.preparation = null',
    "this.readinessStatus = 'failed'",
    'CLASSIC_BIRD_RESOURCE_LOAD_FAILED_EVENT',
  ]);

  const initialize = extractMethod(SOURCE, 'initializePreparation');
  assertOrderedSubstrings(initialize, [
    'await classic.prepareRecoveredRuntime()',
    'await crazy.prepareCrazyRuntime()',
    'const classicCatalog = classic.sharedResourceCatalog',
    'const crazyResources = crazy.sharedCrazyResources',
    'crazy.sharedBaseGameplayResources',
    'crazy.sharedCrazyAudioPresenter',
    'crazy.sharedCrazyDragonFont',
    'crazy.sharedObjectivesManager',
    'loadBirdResources(classicCatalog.assetTree)',
    'resources.rasterCount !== 17',
    'resources.orderedRasters.length !== 17',
    'this.birdResources = resources',
    "this.readinessStatus = 'ready'",
  ]);
  assert.doesNotMatch(initialize, /new (?:GameplayRandom|ClassicSettings)/);
});

test('activation constructs detached ownership and commits through an empty app-shell host', () => {
  const activate = extractMethod(SOURCE, 'activateClassicBirdFromAppShell');
  assertOrderedSubstrings(activate, [
    'assertScreenPlacementPort(screenPlacement)',
    'this.drainRetiredRuns()',
    'screenPlacement.currentScreen !== null',
    'this.screenPlacement = screenPlacement',
    'this.constructMode()',
    'this.attachModeAndActivateScene(screenPlacement)',
    'this.updateScorePresentation()',
  ]);
  assert.match(
    activate,
    /catch \(error\)[\s\S]*?releaseClassicBirdLayerForReplacement\(\)[\s\S]*?disposeModePresentation\(\)[\s\S]*?this\.screenPlacement = retainedPlacement/,
  );

  const construct = extractMethod(SOURCE, 'constructMode');
  assertOrderedSubstrings(construct, [
    "createDetachedScreenRoot('ClassicBirdModeRoot', this.node)",
    'this.registry = new CrazyEntityRegistry({',
    'this.coordinator = new ClassicBirdTossCoordinator({',
    'this.createCorePresentation(',
  ]);
  assert.match(construct, /const random = classic\.sharedGameplayRandom/);
  assert.match(construct, /dragonFont: crazy\.sharedCrazyDragonFont/);
  assert.match(construct, /onEnableBonus: this\.onUnexpectedBonusEnable/);
  assert.match(construct, /onPlayBonusTossAudio: this\.onUnexpectedBonusTossAudio/);
  assert.doesNotMatch(
    extractMethod(SOURCE, 'createCorePresentation'),
    /birdBladePresenter\.attach/,
  );

  const attach = extractMethod(SOURCE, 'attachModeAndActivateScene');
  assertOrderedSubstrings(attach, [
    'screenPlacement.attachCurrentScreen(root)',
    'screenPlacement.currentScreen !== root',
    'this.requireBirdBladePresenter().attach(',
    'this.requireWorldPresentationRoot()',
    'state.birdClassicLeaderboard.first',
    'activateClassicBirdLayer(best)',
  ]);
});

test('Bird touch and physics preserve swish-first acceptance and one cached ray per step', () => {
  const touch = extractMemberBlock(
    SOURCE,
    '  private readonly onBirdBladeTouchBegan = (',
  );
  assertOrderedSubstrings(touch, [
    'swish.request(true, this.effectsEnabled())',
    "instruction.type === 'play-swish-audio'",
    'sharedAudioPresenter.playOneShot(instruction.canonicalPath)',
    'this.requireBirdBladePresenter().touch(event.point)',
  ]);

  const physics = extractMemberBlock(
    SOURCE,
    '  private readonly onPhysicsStepped = (',
  );
  assertOrderedSubstrings(physics, [
    'registry.size > 0 && cutEnabled',
    'rayAdapter.processOneCachedRay',
    'this.applyBirdRaycastBatch(batch, registry)',
    'blade.acknowledgeCachedRay()',
    'registry.evaluateBounds(viewport)',
    'registry.updateDragonEffectsPhysics(viewport)',
  ]);
  const batch = extractMethod(SOURCE, 'applyBirdRaycastBatch');
  assertOrderedSubstrings(batch, [
    'registry.runRayQueryCutBatch(() =>',
    'batch.forwardHits.map',
    'batch.reverseHits.map',
    'createCutDispatchCommands(',
    'this.requireSceneController().checkCombo(command.position)',
    'registry.cut(command.targetId, command.segment)',
  ]);
  assert.doesNotMatch(physics, /while\s*\(/);
});

test('session bridge owns the nine-controller, fail, score, electric, magnet, and word flow', () => {
  const bridge = extractMemberBlock(
    SOURCE,
    '  private readonly onSessionCommand = (',
  );
  assertOrderedSubstrings(bridge, [
    'this.lifecycleFatalError !== null',
    'return',
    'this.emitCommand(command)',
  ]);
  for (const expected of [
    "case 'construct-controller':",
    "case 'attach-controller':",
    "case 'register-fruit-fail':",
    "case 'start-electric-bomb':",
    "case 'create-magnet-animation':",
    "case 'show-game-over':",
    "case 'capture-classic-bird-parent':",
    "case 'attach-result':",
  ]) {
    assert.match(bridge, new RegExp(escapeRegExp(expected)));
  }
  assert.match(
    bridge,
    /case 'add-score':[\s\S]*?command\.application !== 'already-applied'[\s\S]*?this\.processBirdScoreObjective\(\)/,
  );
  assert.doesNotMatch(
    bridge.slice(
      bridge.indexOf("case 'add-score':"),
      bridge.indexOf("case 'stop-electric-bomb':"),
    ),
    /addScore\(/,
  );

  const objective = extractMethod(SOURCE, 'processBirdScoreObjective');
  assert.match(
    objective,
    /processGameEvent\(\s*19,\s*this\.requireSceneController\(\)\.sessionSnapshot\(\)\.score\.authoritativeScore/,
  );
  const cleanup = extractMethod(SOURCE, 'disposeModePresentation');
  assertOrderedSubstrings(cleanup, [
    'coordinator.stopAll()',
    'coordinator.restoreNormalFruitIntervalForCleanup()',
    'presenter.dispose()',
  ]);
  assert.doesNotMatch(cleanup, /coordinator\.magnetEnd\(\)/);
});

test('standard Bomb uses the sole natural 2.5-second presenter and a run token with no penalty', () => {
  const bomb = extractMemberBlock(
    SOURCE,
    '  private readonly onStandardBombCut = (',
  );
  assertOrderedSubstrings(bomb, [
    'const completion = new StandardBombExplosionCompletion()',
    'StandardBombExplosionPresenter.create({',
    'completion.markNaturalFinish()',
    'presenter.attach(this.requireWorldPresentationRoot(), 1)',
    'this.standardBombExplosionOwners.set(event.targetId, owner)',
    'owner.runGeneration = this.requireSceneController().bombHit()',
    "getClassicOrdinaryBombAudioPath('explosion')",
  ]);
  assert.doesNotMatch(bomb, /scheduleOnce|setTimeout|addScore|penalty|score\s*[-=]/);

  const finish = extractMethod(
    SOURCE,
    'drainFinishedStandardBombExplosions',
  );
  assertOrderedSubstrings(finish, [
    'owner.completion.drain({',
    'afterBombHit: () => this.requireSceneController()',
    '.afterBombHit(runGeneration)',
    'finishBombAfterHit: () => this.requireRegistry()',
    '.finishBombAfterHit(targetId)',
    'isBombDisposalCommitted: () => !this.requireRegistry()',
    '.hasTarget(targetId)',
    'this.standardBombExplosionOwners.delete(targetId)',
  ]);
});

test('Pause audio and Replay keep process RNG/settings and never resume music', () => {
  const pause = extractMemberBlock(
    SOURCE,
    '  private readonly onPauseRequested = ()',
  );
  assertOrderedSubstrings(pause, [
    'pauseIngress(this.currentPauseCard())',
    'playOneShot(CLASSIC_MENU_BUTTON_AUDIO_PATH)',
    'sharedAudioPresenter.pauseAllEffects()',
    'sharedCrazyAudioPresenter.pauseAllEffects()',
    'sharedAudioPresenter.pauseBackgroundMusic()',
    'sharedCrazyAudioPresenter.pauseBackgroundMusic()',
  ]);
  const resume = extractMemberBlock(
    SOURCE,
    '  private readonly onResumeRequested = ()',
  );
  assert.match(resume, /sharedAudioPresenter\.resumeAllEffects\(\)/);
  assert.match(resume, /sharedCrazyAudioPresenter\.resumeAllEffects\(\)/);
  assert.doesNotMatch(resume, /resumeBackgroundMusic/);

  const replay = extractMethod(SOURCE, 'restartFromPause');
  assertOrderedSubstrings(replay, [
    'oldScene.suspendClassicBirdLayerForNavigation()',
    'this.acquireStandbySceneController(oldScene)',
    'this.installRunOwnership(this.createEmptyRunOwnership())',
    'this.constructMode()',
    'sharedAudioPresenter.stopBackgroundMusic()',
    'sharedCrazyAudioPresenter.stopBackgroundMusic()',
    'sharedAudioPresenter.stopAllEffects()',
    'sharedCrazyAudioPresenter.stopAllEffects()',
    'pause.resumeEgress()',
    'pause.stopAllActions()',
    'placement.replaceCurrentScreen(freshRoot)',
    'this.requireBirdBladePresenter().attach(',
    'this.requireWorldPresentationRoot()',
    'freshScene.activateClassicBirdLayer(best)',
    'oldScene.finalizeSuspendedClassicBirdLayerRelease()',
  ]);
  assert.match(replay, /this\.standbySceneController = oldScene/);
  assert.doesNotMatch(replay, /prepareClassicBirdRuntime|loadBirdResources|save\(|reseed/);
  assert.doesNotMatch(SOURCE, /new (?:GameplayRandom|SeededGameplayRandom)/);
  assert.match(
    replay,
    /error instanceof ClassicBirdLifecycleRollbackError[\s\S]*?!primaryFatal[\s\S]*?pause\.pauseIngress/,
  );
  assert.match(
    replay,
    /if \(!primaryFatal && rollbackFailures\.length === 0\)[\s\S]*?oldScene\.resumeSuspendedClassicBirdLayer\(\)[\s\S]*?if \(rollbackFailures\.length === 0\)[\s\S]*?pause\.pauseIngress/,
  );
  assert.match(
    extractMemberBlock(SOURCE, '  private readonly onPauseQuitRequested = ()'),
    /error instanceof ClassicBirdLifecycleRollbackError[\s\S]*?retainFatalLifecycleBoundary\(error\)/,
  );
});

test('mode-3 Result uses pure preview, transactional settings commit, Retry, and reward', () => {
  const capture = extractMethod(SOURCE, 'captureModeForResult');
  assertOrderedSubstrings(capture, [
    'this.pendingCapturedRoot = root',
    'this.pendingResultEntryTransaction = transaction',
    'prepareCommit: () => this.prepareResultCommit(transaction)',
    'enlistResultTransitionParticipant(',
  ]);

  const attach = extractMethod(SOURCE, 'attachResult');
  assertOrderedSubstrings(attach, [
    'insertClassicBirdResultScore(',
    'settings.state.birdClassicLeaderboard',
    'ClassicResultPresenter.create({',
    'classicBirdLeaderboardPanelValues(ranking.leaderboard)',
    "createDetachedScreenRoot(",
    "'ClassicBirdResultPresentationRoot'",
    'this.requireScreenPlacement().attachCurrentScreen(root)',
    'presenter.attach(root)',
  ]);
  assert.doesNotMatch(attach, /recordClassicBirdResultScore/);

  const commit = extractMethod(SOURCE, 'commitResultTransition');
  assertOrderedSubstrings(commit, [
    'recordClassicBirdResultScore(',
    "transaction.status = 'committed'",
    'this.pendingResultEntryTransaction = null',
    'this.disposeModePresentation()',
    'this.installRunOwnership(this.createEmptyRunOwnership())',
    'this.pendingResultConfiguration = retainedResultConfiguration',
  ]);

  const retry = extractMethod(SOURCE, 'restartFromResult');
  assertOrderedSubstrings(retry, [
    'createClassicBirdResultNavigationCommands({',
    "route: 'retry'",
    "case 'capture-result-parent':",
    "case 'remove-result':",
    "case 'construct-classic-bird':",
    'this.constructMode()',
    "case 'attach-classic-bird-to-captured-parent':",
    'this.attachModeAndActivateScene(placement)',
  ]);
  assert.doesNotMatch(retry, /save\(|prepareClassicBirdRuntime|loadBirdResources|reseed/);
  assert.match(
    retry,
    /Classic Bird Retry rollback could not restore Result ownership[\s\S]*?new ClassicBirdLifecycleRollbackError/,
  );

  const menu = extractMemberBlock(
    SOURCE,
    '  private readonly onResultMenu = ()',
  );
  assertOrderedSubstrings(menu, [
    'const presenter = this.requireResultPresenter()',
    'let transaction: ClassicBirdResultMenuTransaction | null = null',
    'transaction = activeTransaction',
    'this.emitCommand(command)',
    'sharedAudioPresenter.playOneShot(command.canonicalPath)',
    'this.node.emit(CLASSIC_BIRD_RESULT_MENU_REQUESTED_EVENT, payload)',
    '} catch (error) {',
    "presenter.rearmNavigationAfterFailure('menu')",
  ]);

  const reward = extractMemberBlock(
    SOURCE,
    '  private readonly onResultTotalCoinsEntranceComplete = ()',
  );
  assert.match(reward, /awardClassicBirdResultCoins\(\s*configured\.score/);
  assert.match(reward, /CLASSIC_BIRD_RESULT_REWARD_READY_EVENT/);
});

test('GAME/OVER completion retains and exactly rethrows fatal Result-entry ownership', () => {
  class TestLifecycleRollbackError extends Error {}
  const complete = compileSourceMethod<
    (this: Record<string, any>) => void
  >('completeGameOverPresentation', {
    ClassicBirdLifecycleRollbackError: TestLifecycleRollbackError,
  });
  const failure = new TestLifecycleRollbackError(
    'injected fatal Result restoration',
  );
  let displayScoreCompleteCalls = 0;
  const controller: Record<string, any> = {
    lifecycleFatalError: null,
    requireSceneController: () => ({
      displayScoreComplete() {
        displayScoreCompleteCalls += 1;
        throw failure;
      },
    }),
    retainFatalLifecycleBoundary(error: unknown) {
      this.lifecycleFatalError ??= error;
    },
  };

  assert.throws(
    () => complete.call(controller),
    (error: unknown) => error === failure,
  );
  assert.equal(controller.lifecycleFatalError, failure);
  assert.doesNotThrow(() => complete.call(controller));
  assert.equal(displayScoreCompleteCalls, 1);
  assert.match(
    extractMethod(SOURCE, 'presentGameOver'),
    /onComplete: \(\) => this\.completeGameOverPresentation\(\)/,
  );
});

test('Pause Quit commit is idempotent after a post-commit observer failure', () => {
  const commit = compileSourceMethod<
    (
      this: Record<string, any>,
      transaction: Record<string, any>,
      previousRoot: object,
    ) => void
  >('commitPauseQuit', {
    CLASSIC_MENU_BUTTON_AUDIO_PATH: 'Sounds/menu-click.wav',
    collectCleanupFailure,
    reportCleanupFailures() {},
  });
  const destination = {};
  const root = { parent: null };
  const presenter = {};
  let finalizeCalls = 0;
  let cleanupCalls = 0;
  let stopCalls = 0;
  let snapshotCalls = 0;
  const transaction = {
    presenter,
    root,
    screenPlacement: { currentScreen: destination },
    status: 'pending',
  };
  const controller: Record<string, any> = {
    modeRoot: root,
    pausePresenter: presenter,
    retiredRuns: [],
    captureRunOwnership() {
      return {};
    },
    createEmptyRunOwnership() {
      return {};
    },
    disposeModePresentation() {
      cleanupCalls += 1;
    },
    effectsEnabled() {
      return false;
    },
    emitSnapshot() {
      snapshotCalls += 1;
      throw new Error('injected post-commit observer failure');
    },
    installRunOwnership() {},
    requireSceneController() {
      return {
        finalizeSuspendedClassicBirdLayerRelease() {
          finalizeCalls += 1;
        },
      };
    },
    stopAllBirdRunEffects() {
      stopCalls += 1;
    },
  };

  assert.throws(
    () => commit.call(controller, transaction, root),
    /injected post-commit observer failure/,
  );
  assert.equal(transaction.status, 'committed');
  assert.doesNotThrow(
    () => commit.call(controller, transaction, { unexpected: true }),
  );
  assert.equal(finalizeCalls, 1);
  assert.equal(cleanupCalls, 1);
  assert.equal(stopCalls, 1);
  assert.equal(snapshotCalls, 1);
});

test('Pause Quit rollback retains and rethrows a fatal scene resume boundary', () => {
  class TestLifecycleRollbackError extends Error {
    readonly primary: unknown;
    readonly rollbackErrors: readonly unknown[];

    constructor(
      label: string,
      primary: unknown,
      rollbackErrors: readonly unknown[],
    ) {
      super(label);
      this.primary = primary;
      this.rollbackErrors = rollbackErrors;
    }
  }
  const rollback = compileSourceMethod<
    (
      this: Record<string, any>,
      transaction: Record<string, any>,
    ) => void
  >('rollbackPauseQuit', {
    ClassicBirdLifecycleRollbackError: TestLifecycleRollbackError,
    isValid: () => true,
  });
  const root = { parent: {} };
  const presenter = {
    pauseIngressCalls: 0,
    pauseIngress() {
      this.pauseIngressCalls += 1;
    },
  };
  const resumeFailure = new TestLifecycleRollbackError(
    'Classic Bird navigation resume rollback failed',
    new Error('injected resume acquisition failure'),
    [new Error('injected resume restoration failure')],
  );
  let resumeCalls = 0;
  const controller: Record<string, any> = {
    lifecycleFatalError: null,
    modeRoot: root,
    pausePresenter: presenter,
    currentPauseCard: () => ({}),
    emitSnapshot() {
      assert.fail('fatal rollback must not publish a restored snapshot');
    },
    requireSceneController: () => ({
      resumeSuspendedClassicBirdLayer() {
        resumeCalls += 1;
        throw resumeFailure;
      },
    }),
    retainFatalLifecycleBoundary(error: unknown) {
      this.lifecycleFatalError ??= error;
    },
  };
  const transaction = {
    presenter,
    root,
    screenPlacement: { currentScreen: root },
    status: 'pending',
  };

  assert.throws(
    () => rollback.call(controller, transaction),
    (error: unknown) => error === resumeFailure,
  );
  assert.equal(controller.lifecycleFatalError, resumeFailure);
  assert.throws(
    () => rollback.call(controller, transaction),
    (error: unknown) => error === resumeFailure,
  );
  assert.equal(resumeCalls, 1);
  assert.equal(presenter.pauseIngressCalls, 0);
  assert.equal(transaction.status, 'pending');
});

test('Pause Quit rearm failure re-suspends gameplay before retaining fatal ownership', () => {
  class TestLifecycleRollbackError extends Error {
    readonly rollbackErrors: readonly unknown[];

    constructor(
      label: string,
      _primary: unknown,
      rollbackErrors: readonly unknown[],
    ) {
      super(label);
      this.rollbackErrors = rollbackErrors;
    }
  }
  const rollback = compileSourceMethod<
    (
      this: Record<string, any>,
      transaction: Record<string, any>,
    ) => void
  >('rollbackPauseQuit', {
    ClassicBirdLifecycleRollbackError: TestLifecycleRollbackError,
    collectCleanupFailure,
    isValid: () => true,
  });
  const isGameplayAttached = compileSourceMethod<
    (this: Record<string, any>) => boolean
  >('isGameplayAttached', {
    isValid: () => true,
  });
  const host = {};
  const root = { activeInHierarchy: true, parent: host };
  const scene = {
    active: false,
    suspended: true,
    resumeCalls: 0,
    suspendCalls: 0,
    resumeSuspendedClassicBirdLayer() {
      this.resumeCalls += 1;
      this.active = true;
      this.suspended = false;
    },
    suspendClassicBirdLayerForNavigation() {
      this.suspendCalls += 1;
      this.active = false;
      this.suspended = true;
    },
  };
  const presenter = {
    pauseIngressCalls: 0,
    pauseIngress() {
      this.pauseIngressCalls += 1;
      throw new Error('injected Pause Quit rearm failure');
    },
  };
  const placement = { currentScreen: root };
  const controller: Record<string, any> = {
    classicBirdSceneController: scene,
    lifecycleFatalError: null,
    modeRoot: root,
    pausePresenter: presenter,
    screenPlacement: placement,
    currentPauseCard: () => ({}),
    emitSnapshot() {
      assert.fail('fatal rollback must not publish a restored snapshot');
    },
    requireSceneController: () => scene,
    retainFatalLifecycleBoundary(error: unknown) {
      this.lifecycleFatalError ??= error;
    },
  };
  const transaction = {
    presenter,
    root,
    screenPlacement: placement,
    status: 'pending',
  };

  assert.throws(
    () => rollback.call(controller, transaction),
    (error: unknown) => (
      error instanceof TestLifecycleRollbackError
      && error.rollbackErrors.some(
        (failure) => String(failure).includes(
          'injected Pause Quit rearm failure',
        ),
      )
    ),
  );
  assert.equal(scene.resumeCalls, 1);
  assert.equal(scene.suspendCalls, 1);
  assert.equal(scene.active, false);
  assert.equal(scene.suspended, true);
  assert.ok(
    controller.lifecycleFatalError instanceof TestLifecycleRollbackError,
  );
  assert.equal(transaction.status, 'pending');
  assert.equal(isGameplayAttached.call(controller), false);

  scene.active = true;
  scene.suspended = false;
  assert.equal(
    isGameplayAttached.call(controller),
    false,
    'retained fatal ownership must guard callbacks even if scene state regresses',
  );
});

test('Result Menu commit is idempotent after a post-commit notification failure', () => {
  let reportCalls = 0;
  const commit = compileSourceMethod<
    (
      this: Record<string, any>,
      transaction: Record<string, any>,
      previousRoot: object,
    ) => void
  >('commitResultMenu', {
    collectCleanupFailure,
    isValid: () => true,
    reportCleanupFailures() {
      reportCalls += 1;
      throw new Error('injected post-commit notification failure');
    },
  });
  const destination = {};
  const root = {
    destroyCalls: 0,
    parent: null,
    destroy() {
      this.destroyCalls += 1;
    },
  };
  const presenter = {
    disposeCalls: 0,
    dispose() {
      this.disposeCalls += 1;
    },
  };
  const transaction = {
    presenter,
    root,
    screenPlacement: { currentScreen: destination },
    status: 'pending',
  };
  const controller = {
    resultPresentationRoot: root,
    resultPresenter: presenter,
  };

  assert.throws(
    () => commit.call(controller, transaction, root),
    /injected post-commit notification failure/,
  );
  assert.equal(transaction.status, 'committed');
  assert.doesNotThrow(
    () => commit.call(controller, transaction, { unexpected: true }),
  );
  assert.equal(presenter.disposeCalls, 1);
  assert.equal(root.destroyCalls, 1);
  assert.equal(reportCalls, 1);
});

test('Result Menu audio preflight failure rearms the guarded Result presenter', () => {
  class TestLifecycleRollbackError extends Error {
    constructor(
      _label: string,
      _primary: unknown,
      _rollbackErrors: readonly unknown[],
    ) {
      super('fatal result rollback');
    }
  }
  const onResultMenu = compileSourceArrowMember<
    (this: Record<string, any>) => void
  >('onResultMenu', {
    CLASSIC_BIRD_RESULT_MENU_REQUESTED_EVENT: 'result-menu-requested',
    ClassicBirdLifecycleRollbackError: TestLifecycleRollbackError,
    collectCleanupFailure,
    createClassicBirdResultNavigationCommands: () => Object.freeze([
      Object.freeze({
        canonicalPath: 'Sounds/menu.wav',
        type: 'request-menu-button-audio',
      }),
    ]),
  });
  const root = { parent: {} };
  const placement = { currentScreen: root };
  let navigation: 'menu' | 'none' = 'menu';
  let rearmCalls = 0;
  let emittedRequests = 0;
  const presenter = {
    get state() {
      return { navigation };
    },
    rearmNavigationAfterFailure(expected: string) {
      assert.equal(expected, 'menu');
      rearmCalls += 1;
      navigation = 'none';
      return true;
    },
  };
  const controller: Record<string, any> = {
    lifecycleFatalError: null,
    resultPresenter: presenter,
    configuredResult: () => ({ mode: 3, score: 42 }),
    effectsEnabled: () => true,
    emitCommand() {},
    node: {
      emit() {
        emittedRequests += 1;
      },
    },
    requireAttachedResultRoot: () => root,
    requireClassicGameplayController: () => ({
      sharedAudioPresenter: {
        playOneShot() {
          throw new Error('injected Result menu audio failure');
        },
      },
    }),
    requireResultPresenter: () => presenter,
    requireScreenPlacement: () => placement,
    retainFatalLifecycleBoundary() {
      throw new Error('ordinary preflight failure must not become fatal');
    },
    rollbackResultMenu(transaction: Record<string, any>) {
      assert.equal(transaction.status, 'pending');
      transaction.status = 'rolled-back';
      assert.equal(presenter.rearmNavigationAfterFailure('menu'), true);
    },
  };

  assert.throws(
    () => onResultMenu.call(controller),
    /injected Result menu audio failure/,
  );
  assert.equal(navigation, 'none');
  assert.equal(rearmCalls, 1);
  assert.equal(emittedRequests, 0);
});

for (const rearmFailure of ['false', 'throw'] as const) {
  test(`Result Retry preflight ${rearmFailure} rearm retains one fatal guard owner`, () => {
    class TestLifecycleRollbackError extends Error {
      readonly cause: unknown;
      readonly rollbackErrors: readonly unknown[];

      constructor(
        label: string,
        primary: unknown,
        rollbackErrors: readonly unknown[],
      ) {
        super(label);
        this.cause = primary;
        this.rollbackErrors = rollbackErrors;
      }
    }
    const onResultRetry = compileSourceArrowMember<
      (this: Record<string, any>) => void
    >('onResultRetry', {
      CLASSIC_BIRD_RESULT_RETRY_FAILED_EVENT: 'result-retry-failed',
      ClassicBirdLifecycleRollbackError: TestLifecycleRollbackError,
      collectCleanupFailure,
      normalizeError(error: unknown, fallback: string) {
        return error instanceof Error ? error : new Error(fallback);
      },
    });
    let rearmCalls = 0;
    let restartCalls = 0;
    const presenter = {
      state: { navigation: 'retry' },
      rearmNavigationAfterFailure(expected: string) {
        assert.equal(expected, 'retry');
        rearmCalls += 1;
        if (rearmFailure === 'throw') {
          throw new Error('injected Retry presenter rearm failure');
        }
        return false;
      },
    };
    const emitted: unknown[] = [];
    const controller: Record<string, any> = {
      lifecycleFatalError: null,
      resultPresenter: presenter,
      node: {
        emit(type: string, payload: unknown) {
          emitted.push({ payload, type });
        },
      },
      requireResultPresenter: () => presenter,
      restartFromResult() {
        restartCalls += 1;
        throw new Error('injected Retry preflight failure');
      },
      retainFatalLifecycleBoundary(error: unknown) {
        this.lifecycleFatalError ??= error;
      },
    };
    const reported: unknown[] = [];
    const previousConsoleError = console.error;
    console.error = (error: unknown) => {
      reported.push(error);
    };
    try {
      assert.doesNotThrow(() => onResultRetry.call(controller));
      assert.doesNotThrow(() => onResultRetry.call(controller));
    } finally {
      console.error = previousConsoleError;
    }

    assert.ok(
      controller.lifecycleFatalError instanceof TestLifecycleRollbackError,
    );
    assert.match(
      controller.lifecycleFatalError.message,
      /Classic Bird Retry preflight rollback failed/,
    );
    assert.match(
      String(controller.lifecycleFatalError.cause),
      /injected Retry preflight failure/,
    );
    assert.equal(controller.lifecycleFatalError.rollbackErrors.length, 1);
    assert.match(
      String(controller.lifecycleFatalError.rollbackErrors[0]),
      rearmFailure === 'throw'
        ? /injected Retry presenter rearm failure/
        : /could not rearm Result/,
    );
    assert.equal(restartCalls, 1);
    assert.equal(rearmCalls, 1);
    assert.equal(emitted.length, 1);
    assert.equal(reported.length, 1);
  });
}

test('Result Retry never rearms a presenter installed after the callback began', () => {
  class TestLifecycleRollbackError extends Error {}
  const onResultRetry = compileSourceArrowMember<
    (this: Record<string, any>) => void
  >('onResultRetry', {
    CLASSIC_BIRD_RESULT_RETRY_FAILED_EVENT: 'result-retry-failed',
    ClassicBirdLifecycleRollbackError: TestLifecycleRollbackError,
    collectCleanupFailure,
    normalizeError(error: unknown, fallback: string) {
      return error instanceof Error ? error : new Error(fallback);
    },
  });
  const originalPresenter = {
    state: { navigation: 'retry' },
    rearmNavigationAfterFailure() {
      assert.fail('the retired callback owner must not be rearmed');
    },
  };
  let foreignRearmCalls = 0;
  const foreignPresenter = {
    state: { navigation: 'retry' },
    rearmNavigationAfterFailure() {
      foreignRearmCalls += 1;
      return true;
    },
  };
  let emitted = 0;
  const controller: Record<string, any> = {
    lifecycleFatalError: null,
    resultPresenter: originalPresenter,
    node: {
      emit() {
        emitted += 1;
      },
    },
    restartFromResult() {
      this.resultPresenter = foreignPresenter;
      throw new Error('injected post-ownership observer failure');
    },
    retainFatalLifecycleBoundary() {
      assert.fail('a later presenter owner must remain independent');
    },
  };
  const previousConsoleError = console.error;
  console.error = () => {};
  try {
    assert.doesNotThrow(() => onResultRetry.call(controller));
  } finally {
    console.error = previousConsoleError;
  }

  assert.equal(foreignRearmCalls, 0);
  assert.equal(controller.lifecycleFatalError, null);
  assert.equal(emitted, 1);
});

test('incomplete Result Retry rollback remains inert with typed fatal ownership', () => {
  class TestLifecycleRollbackError extends Error {
    readonly primary: unknown;
    readonly rollbackErrors: readonly unknown[];

    constructor(
      label: string,
      primary: unknown,
      rollbackErrors: readonly unknown[],
    ) {
      super(label);
      this.primary = primary;
      this.rollbackErrors = rollbackErrors;
    }
  }
  const restart = compileSourceMethod<
    (this: Record<string, any>) => void
  >('restartFromResult', {
    CLASSIC_BIRD_RESULT_MODE_ID: 3,
    ClassicBirdLifecycleRollbackError: TestLifecycleRollbackError,
    collectCleanupFailure,
    createClassicBirdResultNavigationCommands: () => Object.freeze([
      Object.freeze({ type: 'capture-result-parent' }),
      Object.freeze({ cleanup: true, type: 'remove-result' }),
      Object.freeze({ fresh: true, mode: 3, type: 'construct-classic-bird' }),
    ]),
    isValid: () => true,
  });
  const host = {};
  const root = { parent: host };
  let currentScreen: object | null = root;
  let rearmCalls = 0;
  const placement = {
    get currentScreen() {
      return currentScreen;
    },
    attachCurrentScreen(screen: typeof root) {
      assert.equal(currentScreen, null);
      assert.equal(screen.parent, null);
      screen.parent = host;
      currentScreen = screen;
    },
    detachCurrentScreen(screen: typeof root) {
      assert.equal(currentScreen, screen);
      screen.parent = null;
      currentScreen = null;
      return screen;
    },
  };
  const presenter = {
    rearmNavigationAfterFailure() {
      rearmCalls += 1;
      return true;
    },
  };
  const controller: Record<string, any> = {
    pendingResultConfiguration: null,
    configuredResult: () => ({ mode: 3, score: 77 }),
    constructMode() {
      throw new Error('injected Retry construction failure');
    },
    disposeModePresentation() {
      throw new Error('injected Retry cleanup failure');
    },
    drainRetiredRuns() {},
    effectsEnabled: () => false,
    emitCommand() {},
    requireAttachedResultRoot: () => root,
    requireResultPresenter: () => presenter,
    requireSceneController: () => ({ active: false }),
    requireScreenPlacement: () => placement,
  };

  assert.throws(
    () => restart.call(controller),
    (error: unknown) => (
      error instanceof TestLifecycleRollbackError
      && /Classic Bird Retry rollback failed/.test(error.message)
      && error.rollbackErrors.some(
        (failure) => String(failure).includes('injected Retry cleanup failure'),
      )
    ),
  );
  assert.equal(currentScreen, root);
  assert.equal(root.parent, host);
  assert.equal(rearmCalls, 0);
});

test('throwing Result Retry transaction rearm is converted to typed fatal ownership', () => {
  class TestLifecycleRollbackError extends Error {
    readonly rollbackErrors: readonly unknown[];

    constructor(
      label: string,
      _primary: unknown,
      rollbackErrors: readonly unknown[],
    ) {
      super(label);
      this.rollbackErrors = rollbackErrors;
    }
  }
  const restart = compileSourceMethod<
    (this: Record<string, any>) => void
  >('restartFromResult', {
    CLASSIC_BIRD_RESULT_MODE_ID: 3,
    ClassicBirdLifecycleRollbackError: TestLifecycleRollbackError,
    collectCleanupFailure,
    createClassicBirdResultNavigationCommands: () => Object.freeze([
      Object.freeze({ type: 'capture-result-parent' }),
      Object.freeze({ cleanup: true, type: 'remove-result' }),
      Object.freeze({ fresh: true, mode: 3, type: 'construct-classic-bird' }),
    ]),
    isValid: () => true,
  });
  const host = {};
  const root = { parent: host };
  let currentScreen: object | null = root;
  const placement = {
    get currentScreen() {
      return currentScreen;
    },
    attachCurrentScreen(screen: typeof root) {
      assert.equal(currentScreen, null);
      screen.parent = host;
      currentScreen = screen;
    },
    detachCurrentScreen(screen: typeof root) {
      assert.equal(currentScreen, screen);
      screen.parent = null;
      currentScreen = null;
      return screen;
    },
  };
  const presenter = {
    state: { navigation: 'retry' },
    rearmNavigationAfterFailure() {
      throw new Error('injected Retry transaction rearm failure');
    },
  };
  const controller: Record<string, any> = {
    pendingResultConfiguration: null,
    configuredResult: () => ({ mode: 3, score: 77 }),
    constructMode() {
      throw new Error('injected Retry construction failure');
    },
    disposeModePresentation() {},
    drainRetiredRuns() {},
    effectsEnabled: () => false,
    emitCommand() {},
    requireAttachedResultRoot: () => root,
    requireResultPresenter: () => presenter,
    requireSceneController: () => ({ active: false }),
    requireScreenPlacement: () => placement,
  };

  assert.throws(
    () => restart.call(controller),
    (error: unknown) => (
      error instanceof TestLifecycleRollbackError
      && /Classic Bird Retry rollback failed/.test(error.message)
      && error.rollbackErrors.some(
        (failure) => String(failure).includes(
          'injected Retry transaction rearm failure',
        ),
      )
    ),
  );
  assert.equal(currentScreen, root);
  assert.equal(root.parent, host);
});

test('Pause Replay attaches the fresh BirdBlade before activation can step physics', () => {
  const harness = pauseReplayHarness();

  assert.doesNotThrow(() => harness.restart.call(harness.controller));
  assert.ok(
    harness.events.indexOf('fresh-blade-attach')
    < harness.events.indexOf('fresh-scene-activate'),
  );
  assert.equal(harness.freshBlade.acknowledgeCalls, 1);
  assert.equal(harness.freshBlade.attached, true);
  assert.equal(harness.freshScene.active, true);
  assert.equal(harness.placement.currentScreen, harness.freshRoot);
  assert.equal(harness.controller.classicBirdSceneController, harness.freshScene);
});

test('Pause Replay blade attachment failure restores the old paused run', () => {
  const harness = pauseReplayHarness({ failBladeAttach: true });

  assert.throws(
    () => harness.restart.call(harness.controller),
    /injected fresh BirdBlade attachment failure/,
  );
  assert.equal(harness.placement.currentScreen, harness.oldRoot);
  assert.equal(harness.oldRoot.parent, harness.host);
  assert.equal(harness.oldScene.active, true);
  assert.equal(harness.oldScene.suspended, false);
  assert.equal(harness.freshScene.active, false);
  assert.equal(harness.freshBlade.attached, false);
  assert.equal(harness.pause.pauseIngressCalls, 1);
  assert.equal(harness.controller.classicBirdSceneController, harness.oldScene);
  assert.equal(harness.controller.lifecycleFatalError, null);
});

test('Pause Replay fatal activation keeps the restored old run suspended and inert', () => {
  const harness = pauseReplayHarness({ fatalFreshActivation: true });

  assert.throws(
    () => harness.restart.call(harness.controller),
    /injected fresh scene fatal activation failure/,
  );
  assert.equal(harness.placement.currentScreen, harness.oldRoot);
  assert.equal(harness.oldRoot.parent, harness.host);
  assert.equal(harness.oldScene.active, false);
  assert.equal(harness.oldScene.suspended, true);
  assert.equal(harness.pause.pauseIngressCalls, 0);
  assert.ok(harness.controller.lifecycleFatalError instanceof Error);
  assert.equal(
    harness.isGameplayAttached.call(harness.controller),
    false,
  );

  harness.oldScene.active = true;
  harness.oldScene.suspended = false;
  assert.equal(
    harness.isGameplayAttached.call(harness.controller),
    false,
    'retained fatal ownership must keep callbacks inert',
  );
});

test('Pause Replay incomplete cleanup never resumes the old suspended run', () => {
  const harness = pauseReplayHarness({
    failBladeAttach: true,
    failFreshDispose: true,
  });

  assert.throws(
    () => harness.restart.call(harness.controller),
    /Classic Bird Pause Replay rollback failed/,
  );
  assert.equal(harness.placement.currentScreen, harness.oldRoot);
  assert.equal(harness.oldScene.active, false);
  assert.equal(harness.oldScene.suspended, true);
  assert.equal(harness.pause.pauseIngressCalls, 0);
  assert.ok(harness.controller.lifecycleFatalError instanceof Error);
});

test('teardown drains every run owner without resuming magnet controllers', () => {
  const destroy = extractMethod(SOURCE, 'onDestroy');
  assertOrderedSubstrings(destroy, [
    'this.releaseSceneForTeardown()',
    'this.stopAllBirdRunEffects()',
    'this.disposeModePresentation()',
    'this.drainRetiredRuns()',
    'this.disposeResultPresentation()',
    'this.disposeStandbySceneController()',
  ]);

  const cleanup = extractMethod(SOURCE, 'disposeModePresentation');
  for (const expected of [
    'registry.disposeAll()',
    'owner.presenter.dispose()',
    'this.disposeCutHalfPresenters()',
    'bombElectricPresenter.dispose()',
    'electricContactAdapter.dispose()',
    'birdBladePresenter.dispose()',
    'scoreHudPresenter.dispose()',
    'failPresenter.dispose()',
    'pausePresenter.dispose()',
  ]) {
    assert.match(cleanup, new RegExp(escapeRegExp(expected)));
  }
  assert.match(
    cleanup,
    /registry\.size === 0[\s\S]*?registry\.activeDragonEffectCount === 0/,
  );
  assert.match(
    extractMethod(SOURCE, 'disposeCutHalfPresenters'),
    /presenter\.disposeAll\(\)/,
  );
  assert.doesNotMatch(cleanup, /magnetEnd\(\)|resumeBackgroundMusic/);
});

function pauseReplayHarness(
  options: Readonly<{
    failBladeAttach?: boolean;
    failFreshDispose?: boolean;
    fatalFreshActivation?: boolean;
  }> = {},
) {
  const {
    failBladeAttach = false,
    failFreshDispose = false,
    fatalFreshActivation = false,
  } = options;
  class TestLifecycleRollbackError extends Error {}
  const restart = compileSourceMethod<
    (this: Record<string, any>) => void
  >('restartFromPause', {
    CLASSIC_MENU_BUTTON_AUDIO_PATH: 'Sounds/menu-click.wav',
    ClassicBirdLifecycleRollbackError: TestLifecycleRollbackError,
    cleanupError(label: string, failures: readonly unknown[]) {
      return new Error(`${label}: ${failures.map(String).join('; ')}`);
    },
    collectCleanupFailure,
    isValid: () => true,
    reportCleanupFailures() {},
  });
  const isGameplayAttached = compileSourceMethod<
    (this: Record<string, any>) => boolean
  >('isGameplayAttached', {
    isValid: () => true,
  });
  const events: string[] = [];
  const host = {};
  const oldRoot: Record<string, any> = {
    activeInHierarchy: true,
    parent: host,
  };
  const freshRoot: Record<string, any> = {
    activeInHierarchy: true,
    parent: null,
  };
  const worldRoot = {};
  let currentScreen: Record<string, any> | null = oldRoot;
  const placement = {
    get currentScreen() {
      return currentScreen;
    },
    attachCurrentScreen(root: Record<string, any>) {
      assert.equal(currentScreen, null);
      assert.equal(root.parent, null);
      root.parent = host;
      currentScreen = root;
    },
    replaceCurrentScreen(root: Record<string, any>) {
      const previous = currentScreen;
      assert.ok(previous);
      previous.parent = null;
      root.parent = host;
      currentScreen = root;
      return previous;
    },
  };
  const freshBlade = {
    acknowledgeCalls: 0,
    attached: false,
    acknowledgeCachedRay() {
      if (!this.attached) {
        throw new Error(
          'BirdBlade presenter must be attached before it can acknowledge cached rays',
        );
      }
      this.acknowledgeCalls += 1;
    },
    attach(root: unknown) {
      assert.equal(root, worldRoot);
      events.push('fresh-blade-attach');
      this.attached = true;
      if (failBladeAttach) {
        throw new Error('injected fresh BirdBlade attachment failure');
      }
    },
  };
  const oldScene = {
    active: true,
    suspended: false,
    finalizeSuspendedClassicBirdLayerRelease() {
      assert.equal(this.suspended, true);
      this.suspended = false;
      events.push('old-scene-finalize');
    },
    resumeSuspendedClassicBirdLayer() {
      assert.equal(this.suspended, true);
      this.active = true;
      this.suspended = false;
      events.push('old-scene-resume');
    },
    suspendClassicBirdLayerForNavigation() {
      assert.equal(this.active, true);
      this.active = false;
      this.suspended = true;
      events.push('old-scene-suspend');
    },
  };
  const freshScene = {
    active: false,
    suspended: false,
    activateClassicBirdLayer(best: number) {
      assert.equal(best, 41);
      events.push('fresh-scene-activate');
      if (fatalFreshActivation) {
        throw new TestLifecycleRollbackError(
          'injected fresh scene fatal activation failure',
        );
      }
      freshBlade.acknowledgeCachedRay();
      this.active = true;
    },
    releaseClassicBirdLayerForReplacement() {
      this.active = false;
      events.push('fresh-scene-release');
    },
  };
  const pause = {
    pauseIngressCalls: 0,
    pauseIngress() {
      this.pauseIngressCalls += 1;
      events.push('pause-ingress');
    },
    resumeEgress() {
      events.push('pause-resume-egress');
    },
    stopAllActions() {
      events.push('pause-stop-actions');
    },
  };
  const oldOwnership = { id: 'old', swishAudio: null };
  const freshOwnership = { id: 'fresh', swishAudio: null };
  let ownership = oldOwnership;
  const silentAudio = {
    stopAllEffects() {},
    stopBackgroundMusic() {},
  };
  const controller: Record<string, any> = {
    classicBirdSceneController: oldScene,
    lifecycleFatalError: null,
    modeRoot: oldRoot,
    retiredRuns: [],
    screenPlacement: placement,
    standbySceneController: null,
    acquireStandbySceneController: () => freshScene,
    captureRunOwnership: () => ownership,
    constructMode() {
      events.push('fresh-mode-construct');
    },
    createEmptyRunOwnership: () => freshOwnership,
    currentPauseCard: () => ({}),
    disposeModePresentation() {
      events.push(`dispose-${ownership.id}`);
      if (ownership === freshOwnership) {
        freshBlade.attached = false;
        if (failFreshDispose) {
          throw new Error('injected fresh presentation cleanup failure');
        }
      }
    },
    drainRetiredRuns() {},
    effectsEnabled: () => false,
    emitSnapshot() {
      events.push('snapshot');
    },
    installRunOwnership(next: typeof oldOwnership) {
      ownership = next;
      this.modeRoot = next === oldOwnership ? oldRoot : freshRoot;
    },
    requireBirdBladePresenter: () => freshBlade,
    requireClassicGameplayController: () => ({
      sharedAudioPresenter: silentAudio,
      sharedSettingsRuntime: {
        state: { birdClassicLeaderboard: { first: 41 } },
      },
    }),
    requireCrazyGameplayController: () => ({
      sharedCrazyAudioPresenter: silentAudio,
    }),
    requireDetachedModeRoot: () => freshRoot,
    requireModeRoot: () => oldRoot,
    requirePausePresenter: () => pause,
    requireSceneController: () => oldScene,
    requireScreenPlacement: () => placement,
    requireWorldPresentationRoot: () => worldRoot,
    retainFatalLifecycleBoundary(error: unknown) {
      this.lifecycleFatalError ??= error;
    },
    restoreRetainedSwishCooldown() {},
    unschedule() {},
    updateScorePresentation() {
      events.push('score-update');
    },
  };
  return {
    controller,
    events,
    freshBlade,
    freshRoot,
    freshScene,
    host,
    isGameplayAttached,
    oldRoot,
    oldScene,
    pause,
    placement,
    restart,
  };
}

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

function assertOrderedSubstrings(
  source: string,
  values: readonly string[],
): void {
  let previous = -1;
  for (const value of values) {
    const current = source.indexOf(value);
    assert.ok(current > previous, `${value} must appear in recovered order`);
    previous = current;
  }
}

function compileSourceMethod<T extends (...args: any[]) => unknown>(
  methodName: string,
  dependencies: Readonly<Record<string, unknown>>,
): T {
  const source = extractMethod(SOURCE, methodName).replace(
    new RegExp(`^\\s*(?:private\\s+)?${methodName}`),
    `function ${methodName}`,
  );
  const names = Object.keys(dependencies);
  const values = names.map((name) => dependencies[name]);
  const javascript = stripTypeScriptTypes(source, {
    mode: 'transform',
    sourceUrl: `classic-bird-gameplay-controller.test.${methodName}.ts`,
  });
  return Function(
    ...names,
    `"use strict";\n${javascript}\nreturn ${methodName};`,
  )(...values) as T;
}

function compileSourceArrowMember<T extends (...args: any[]) => unknown>(
  memberName: string,
  dependencies: Readonly<Record<string, unknown>>,
): T {
  const source = extractMemberBlock(
    SOURCE,
    `  private readonly ${memberName} = (`,
  ).replace(
    new RegExp(
      `^\\s*private\\s+readonly\\s+${memberName}\\s*=\\s*\\(\\):\\s*void\\s*=>`,
    ),
    `function ${memberName}()`,
  );
  const names = Object.keys(dependencies);
  const values = names.map((name) => dependencies[name]);
  const javascript = stripTypeScriptTypes(source, {
    mode: 'transform',
    sourceUrl: `classic-bird-gameplay-controller.test.${memberName}.ts`,
  });
  return Function(
    ...names,
    `"use strict";\n${javascript}\nreturn ${memberName};`,
  )(...values) as T;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
