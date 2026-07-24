import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SOURCE = readFileSync(
  `${REPOSITORY_ROOT}/game/assets/scripts/creator/gn-style-gameplay-controller.ts`,
  'utf8',
);
const META = JSON.parse(readFileSync(
  `${REPOSITORY_ROOT}/game/assets/scripts/creator/gn-style-gameplay-controller.ts.meta`,
  'utf8',
)) as Readonly<{ importer?: unknown; uuid?: unknown; ver?: unknown }>;
const MUSIC_SOURCE = readFileSync(
  `${REPOSITORY_ROOT}/game/assets/scripts/creator/gn-style-background-music-presenter.ts`,
  'utf8',
);
const PARTICLE_SOURCE = readFileSync(
  `${REPOSITORY_ROOT}/game/assets/scripts/creator/gn-style-particle-presenter.ts`,
  'utf8',
);

test('GN Style gameplay is passive mode 2 with the required ordinary-input owners', () => {
  assert.equal(META.importer, 'typescript');
  assert.equal(META.ver, '4.0.24');
  assert.match(
    String(META.uuid),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.match(SOURCE, /@ccclass\('GnStyleGameplayController'\)/);
  for (const dependency of [
    'GnStyleSceneController',
    'BladeInputController',
    'ClassicGameplayController',
    'ClassicSceneController',
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
  assert.doesNotMatch(
    SOURCE,
    /BirdInputController|BirdBladePresenter|CrazyGameplayController/,
  );

  const start = extractMethod(SOURCE, 'start');
  assert.match(start, /this\.emitSnapshot\(\)/);
  assert.doesNotMatch(
    start,
    /prepareGnStyleRuntime|activateGnStyleFromAppShell|loadGnStyleResources/,
  );

  const destroy = extractMethod(SOURCE, 'onDestroy');
  assertOrderedSubstrings(destroy, [
    'this.releaseSceneForTeardown()',
    'this.stopRunEffectsForTeardown()',
    'this.disposeModePresentation()',
    'this.drainRetiredRuns()',
    'this.disposeResultPresentation()',
    'this.disposePreparation()',
    'this.disposeStandbySceneController()',
  ]);
});

test('preparation is retryable, isolated, and commits exact shared and GN owners', () => {
  const prepare = extractMethod(SOURCE, 'prepareGnStyleRuntime');
  assertOrderedSubstrings(prepare, [
    "this.readinessStatus = 'pending'",
    'const attempt = this.initializePreparation()',
    'this.preparation = attempt',
    'void attempt.catch',
    'this.preparation = null',
    "this.readinessStatus = 'failed'",
    'GN_STYLE_RESOURCE_LOAD_FAILED_EVENT',
  ]);

  const initialize = extractMethod(SOURCE, 'initializePreparation');
  assertOrderedSubstrings(initialize, [
    'await classic.prepareRecoveredRuntime()',
    'const assetTree = classic.sharedResourceCatalog.assetTree',
    'await Promise.all([',
    'loadGnStyleResources(assetTree)',
    'loadBaseGameplayResources(assetTree)',
    'loadGnStyleTimeManagerResources(assetTree)',
    'TimeManagerAudioPresenter.load(this.node)',
    'GnStyleBackgroundMusicPresenter.load(this.node)',
    'this.commitPreparation({',
  ]);
  assert.match(
    initialize,
    /finally \{[\s\S]*?!committed[\s\S]*?music\?\s*\.dispose\(\)[\s\S]*?timerAudio\.dispose\(\)/,
  );
  assert.doesNotMatch(
    initialize,
    /constructMode|activateGnStyleLayer|GnStyleParticlePresenter\.create/,
  );

  const commit = extractMethod(SOURCE, 'commitPreparation');
  assertOrderedSubstrings(commit, [
    'products.resources.rasterCount !== 11',
    'products.timeManagerResources.rasterCount !== 2',
    "new Node('GnStyleObjectiveAchievementTargetRoot')",
    'this.sharedSettingsRuntime.createObjectivesManager(',
    'this.baseGameplayResources = products.baseGameplayResources',
    'this.gnStyleResources = products.resources',
    'this.timeManagerResources = products.timeManagerResources',
    'this.timerAudio = products.timerAudio',
    'this.music = products.music',
    'this.objectivesManager = objectivesManager',
    "this.readinessStatus = 'ready'",
  ]);
});

test('activation constructs detached ordinary gameplay and makes it current before pause/actions', () => {
  const activate = extractMethod(SOURCE, 'activateGnStyleFromAppShell');
  assertOrderedSubstrings(activate, [
    'assertScreenPlacementPort(screenPlacement)',
    "this.readinessStatus !== 'ready'",
    'this.drainRetiredRuns()',
    'screenPlacement.currentScreen !== null',
    'this.screenPlacement = screenPlacement',
    'this.constructMode()',
    'this.captureActivationObjectiveRollback()',
    'this.attachModeAndActivateScene(screenPlacement)',
    'this.updateScorePresentation()',
  ]);
  assert.match(
    activate,
    /catch \(error\)[\s\S]*?releaseGnStyleLayerForReplacement\(\)[\s\S]*?disposeModePresentation\(\)[\s\S]*?restoreActivationObjective/,
  );

  const construct = extractMethod(SOURCE, 'constructMode');
  assertOrderedSubstrings(construct, [
    "createDetachedScreenRoot('GnStyleModeRoot', this.node)",
    "'GnStyleWorldPresentationRoot'",
    "'GnStyleScoreHudRoot'",
    'this.combo = new ComboService(random)',
    'this.swishAudio = new ClassicSwishAudioGate(random)',
    'this.registry = new ClassicEntityRegistry({',
    'this.createCorePresentation(',
  ]);
  assert.match(construct, /onFruitCut: this\.onOrdinaryFruitCut/);
  assert.match(construct, /onFruitMiss: this\.onOrdinaryFruitMiss/);
  assert.doesNotMatch(
    construct,
    /initializePausePresentation|Bomb|Dragon|Electric|Magnet|Bonus/,
  );

  const attach = extractMethod(SOURCE, 'attachModeAndActivateScene');
  assertOrderedSubstrings(attach, [
    'screenPlacement.attachCurrentScreen(root)',
    'screenPlacement.currentScreen !== root',
    'this.initializePausePresentation()',
    'this.activateCurrentSceneWithFreshCoordinator(',
    'snapshot.mode !== GN_STYLE_RESULT_MODE_ID',
    "snapshot.lifecycle !== 'intro-instructions'",
  ]);
});

test('core presentation owns the saved standard blade, HUD, 150-second timer, exact intro, and 439 roots', () => {
  const create = extractMethod(SOURCE, 'createCorePresentation');
  assertOrderedSubstrings(create, [
    'ClassicScoreHudPresenter.create({',
    'TimeManagerPresenter.create({',
    'totalSeconds: GN_STYLE_INITIAL_TIME_SECONDS',
    'audio: this.requireTimerAudio()',
    'onTimeUp: () => this.requireSceneController().timeUp()',
    'onTimeUpFinish: () => this.requireSceneController().timeUpFinish()',
    'GnStyleIntroPresenter.create({',
    'onShowGo: () => this.requireSceneController().goCallback()',
    'this.requireSceneController().totalTimeCallback()',
    'onStartGame: this.startGnStyleGame',
    'const selectedBlade = this.sharedSettingsRuntime',
    '.state.snapshot.selectedBlade',
    'StandardBladePresenter.create({',
    'profile: catalog.standardBlades.profile(selectedBlade)',
    '      random,',
    'GnStyleParticlePresenter.create({',
    'this.particlePresenter.roots.length !== 439',
  ]);
  assert.match(
    create,
    /GnStyleParticlePresenter\.create\(\{[\s\S]*?random,[\s\S]*?resources: this\.requireGnStyleResources\(\),[\s\S]*?viewport,/,
  );
  assert.match(
    create,
    /disableBonusType: \(\) => \{[\s\S]*?cannot disable a bonus type/,
  );
  assert.match(create, /cannot finish freeze/);
  assert.match(create, /cannot start freeze/);
});

test('StartGame preserves mutual exclusion and timer-before-particle ordering', () => {
  const startGame = extractMemberBlock(
    SOURCE,
    '  private readonly startGnStyleGame = (',
  );
  assertOrderedSubstrings(startGame, [
    'sharedAudioPresenter.stopBackgroundMusic()',
    'this.requireMusic().play(',
    'this.requireSceneController().startGameCallback()',
  ]);
  assert.match(
    startGame,
    /catch \(error\)[\s\S]*?requireParticlePresenter\(\)\.dispose\(\)[\s\S]*?requireTimeManagerPresenter\(\)\.stop\(\)[\s\S]*?releaseGnStyleLayerForReplacement[\s\S]*?requireMusic\(\)\.stop\(\)/,
  );

  const session = extractMemberBlock(
    SOURCE,
    '  private readonly onSessionCommand = (',
  );
  assertOrderedSubstrings(
    extractCase(session, "'start-time-manager'"),
    [
      'this.requireTimeManagerPresenter().start()',
      'this.requireParticlePresenter().start(',
      'this.requireWorldPresentationRoot()',
    ],
  );
  assert.match(
    session,
    /case 'start-controller':[\s\S]*?assertGnStyleController\(command\.controller\)/,
  );

  const musicPlay = extractMethod(MUSIC_SOURCE, 'play');
  assert.match(musicPlay, /if \(!musicEnabled\)/);
  assert.match(musicPlay, /this\.source\.play\(\)/);
  assert.match(MUSIC_SOURCE, /source\.loop = false/);
});

test('running and late-cut frames tick coordinator before TimeManager while particles use action time', () => {
  const update = extractMethod(SOURCE, 'update');
  assertOrderedSubstrings(update, [
    'this.lifecycleFatalError !== null',
    'this.objectiveAchievementPresenters',
    'this.sharedSettingsRuntime.state.snapshot.musicEnabled',
    'this.requireMusic().stop()',
    'this.bladePresenter?.update(deltaSeconds)',
    'this.introPresenter?.updateAction(deltaSeconds)',
    'this.timeManagerPresenter?.updateAction(deltaSeconds)',
    'this.particlePresenter.updateAction(deltaSeconds)',
    "lifecycle === 'running' || lifecycle === 'time-up-presentation'",
    'this.requireSceneController().tickCoordinatorBeforeTimeManager(',
    '() => this.requireTimeManagerPresenter().updateScheduler(deltaSeconds)',
    'this.requireCombo().update(deltaSeconds, this.effectsEnabled())',
  ]);
  assert.match(
    update,
    /lifecycleAtFrameStart === 'intro-instructions'[\s\S]*?lifecycleAtFrameStart === 'intro-150'[\s\S]*?lifecycleAtFrameStart === 'intro-go'[\s\S]*?return/,
  );
  assert.match(
    update,
    /lifecycleAtFrameStart !== 'intro-instructions'[\s\S]*?lifecycleAtFrameStart !== 'intro-150'[\s\S]*?lifecycleAtFrameStart !== 'intro-go'[\s\S]*?particlePresenter\?\.state\.started[\s\S]*?particlePresenter\.updateAction/,
  );
  assert.doesNotMatch(update, /disposeModePresentation|stopAllRunEffects/);

  const session = extractMemberBlock(
    SOURCE,
    '  private readonly onSessionCommand = (',
  );
  assert.match(
    extractCase(session, "'construct-time-manager'"),
    /GN_STYLE_INITIAL_TIME_SECONDS/,
  );
  assert.match(
    extractCase(session, "'stop-effects'"),
    /this\.stopAllRunEffects\(\)/,
  );
});

test('Set snapshots use Array.from before Creator loose-build iteration', () => {
  for (const expected of [
    'Array.from(this.objectiveAchievementPresenters)',
    'Array.from(this.comboItemPresenters)',
    'Array.from(this.cutHalfPresenters)',
    'Array.from(this.criticalParticlePresenters)',
  ]) {
    assert.match(SOURCE, new RegExp(escapeRegExp(expected)));
  }
  for (const forbidden of [
    '[...this.objectiveAchievementPresenters]',
    '[...this.comboItemPresenters]',
    '[...this.cutHalfPresenters]',
    '[...this.criticalParticlePresenters]',
  ]) {
    assert.doesNotMatch(SOURCE, new RegExp(escapeRegExp(forbidden)));
  }
});

test('ordinary blade, post-physics bidirectional cuts, score, combo, and miss stay end to end', () => {
  for (const name of ['onBladeBegan', 'onBladeMoved', 'onBladeEnded']) {
    const member = extractMemberBlock(
      SOURCE,
      `  private readonly ${name} = (`,
    );
    assert.match(member, /this\.lifecycleFatalError !== null/);
    assert.match(member, /this\.isGnStyleGameplayAttached\(\)/);
  }

  const physics = extractMemberBlock(
    SOURCE,
    '  private readonly onPhysicsStepped = (',
  );
  assertOrderedSubstrings(physics, [
    'registry.size > 0',
    'registry.runRayQueryCutBatch(() =>',
    'for (const segment of event.bladeSegments)',
    'buildBidirectionalRayPlan(',
    '.raycastAll(plan.forward.start, plan.forward.end)',
    '.raycastAll(plan.reverse.start, plan.reverse.end)',
    'createCutDispatchCommands(',
    "command.type === 'combo-check'",
    'scene.checkCombo(command.position)',
    'registry.cut(command.targetId, command.segment)',
    'registry.evaluateBounds(viewport)',
  ]);
  assert.doesNotMatch(
    physics,
    /lifecycle === 'running'|lifecycle === 'time-up-presentation'/,
  );

  const cut = extractMemberBlock(
    SOURCE,
    '  private readonly onOrdinaryFruitCut = (',
  );
  assertOrderedSubstrings(cut, [
    'this.presentCutHalves({',
    'getClassicFruitCutAudioSequence(',
    'this.requireSceneController().fruitCut(',
  ]);
  const miss = extractMemberBlock(
    SOURCE,
    '  private readonly onOrdinaryFruitMiss = (',
  );
  assert.match(
    miss,
    /this\.requireSceneController\(\)\.fruitFail\(event\.worldPosition\)/,
  );

  const combo = extractMethod(SOURCE, 'applyComboCommands');
  assertOrderedSubstrings(combo, [
    'combo.assertPendingUpdate(commands)',
    'applyComboCommandBatch(commands, {',
    "case 'process-objective':",
    'this.requireObjectivesManager().processGameEvent(',
    "case 'create-combo-item':",
    "case 'add-score':",
    'this.requireSceneController().addScore(command.value)',
    "case 'attach-combo-item':",
    "case 'play-combo-sound':",
    'getClassicComboAudioPath(command.soundIndex)',
    "case 'reset-combo':",
    'combo.commitPendingUpdate(commands)',
  ]);
});

test('Pause and Resume freeze the GN clock, effects, dedicated music, and particles', () => {
  const pause = extractMemberBlock(
    SOURCE,
    '  private readonly onPauseRequested = (',
  );
  assertOrderedSubstrings(pause, [
    'this.requirePausePresenter().pauseIngress(this.currentPauseCard())',
    'sharedAudioPresenter.pauseAllEffects()',
    'this.requireTimerAudio().pauseAllEffects()',
    'this.requireMusic().pause(settings.musicEnabled)',
    'this.requireParticlePresenter().pause()',
  ]);

  const resume = extractMemberBlock(
    SOURCE,
    '  private readonly onResumeRequested = (',
  );
  assertOrderedSubstrings(resume, [
    'this.requirePausePresenter().resumeEgress()',
    'sharedAudioPresenter.resumeAllEffects()',
    'this.requireTimerAudio().resumeAllEffects()',
    'sharedAudioPresenter.stopBackgroundMusic()',
    'this.requireMusic().resume(settings.musicEnabled)',
    'this.requireParticlePresenter().resume()',
  ]);

  assert.match(extractMethod(PARTICLE_SOURCE, 'pause'), /this\.pausedValue = true/);
  assert.match(extractMethod(PARTICLE_SOURCE, 'resume'), /this\.pausedValue = false/);
});

test('Pause Replay leases a fresh scene and retains cleanup-fault ownership', () => {
  const restart = extractMethod(SOURCE, 'restartFromPause');
  assertOrderedSubstrings(restart, [
    'const oldOwnership = this.captureRunOwnership()',
    'oldScene.suspendGnStyleLayerForNavigation()',
    'freshScene = this.acquireStandbySceneController(oldScene)',
    'this.installRunOwnership(this.createEmptyRunOwnership())',
    'this.constructMode()',
    'placement.replaceCurrentScreen(freshRoot)',
    'this.initializePausePresentation()',
    'this.activateCurrentSceneWithFreshCoordinator(freshScene)',
    'oldScene.finalizeSuspendedGnStyleLayerRelease()',
    'const freshOwnership = this.captureRunOwnership()',
  ]);
  assert.match(
    restart,
    /catch \(error\)[\s\S]*?releaseGnStyleLayerForReplacement\(\)[\s\S]*?resumeSuspendedGnStyleLayer\(\)/,
  );
  assert.match(
    restart,
    /this\.retiredRuns\.push\(Object\.freeze\(\{[\s\S]*?ownership: this\.captureRunOwnership\(\),[\s\S]*?scene:/,
  );
  assert.match(
    restart,
    /this\.restorePauseOwnershipAfterNavigationRollback\([\s\S]*?pauseAudioLeaseSnapshot/,
  );
});

test('Pause Quit exposes gnStyleRoot and settles commit or lossless rollback exactly once', () => {
  const quit = extractMemberBlock(
    SOURCE,
    '  private readonly onPauseQuitRequested = (',
  );
  assertOrderedSubstrings(quit, [
    'suspendGnStyleLayerForNavigation()',
    'gnStyleRoot: root',
    'transaction.audioReleaseAttempted = true',
    'this.releasePauseEffectsForNavigation()',
    'GN_STYLE_PAUSE_QUIT_REQUESTED_EVENT',
    "transaction.status === 'pending'",
  ]);

  const commit = extractMethod(SOURCE, 'commitPauseQuit');
  assertOrderedSubstrings(commit, [
    'previousRoot !== transaction.root',
    'releasedScene.finalizeSuspendedGnStyleLayerRelease()',
    "transaction.status = 'committed'",
    'this.requireMusic().stop()',
    'this.disposeModePresentation()',
  ]);

  const rollback = extractMethod(SOURCE, 'rollbackPauseQuit');
  assertOrderedSubstrings(rollback, [
    'transaction.screenPlacement.attachCurrentScreen(transaction.root)',
    'scene.resumeSuspendedGnStyleLayer()',
    'transaction.presenter.pauseIngress(this.currentPauseCard())',
    'this.restorePauseOwnershipAfterNavigationRollback(transaction)',
    "transaction.status = 'rolled-back'",
  ]);
});

test('Time Up Result is provisional and commits leaderboard then one latched objective tail', () => {
  const session = extractMemberBlock(
    SOURCE,
    '  private readonly onSessionCommand = (',
  );
  assertOrderedSubstrings(session, [
    "case 'stop-effects':",
    "case 'capture-gn-style-parent':",
    'this.captureModeForResult()',
    "case 'construct-result':",
    'this.beginResultConstruction()',
    "case 'set-result-mode':",
    "case 'set-result-score':",
    "case 'remove-gn-style':",
    "case 'attach-result':",
  ]);

  const capture = extractMethod(SOURCE, 'captureModeForResult');
  assertOrderedSubstrings(capture, [
    "status: 'pending'",
    'commit: () => this.commitResultTransition(transaction)',
    'prepareCommit: () => this.prepareResultCommit(transaction)',
    'rollback: () => this.rollbackResultTransition(transaction)',
    'enlistTimeUpFinishParticipant(participant)',
  ]);

  const attach = extractMethod(SOURCE, 'attachResult');
  assertOrderedSubstrings(attach, [
    'insertGnStyleResultScore(',
    'gnStyleLeaderboardPanelValues(ranking.leaderboard)',
    'ClassicResultPresenter.create({',
    'completedRunScore: configured.score',
    'onRankPresentationBoundary:',
    'getClassicResultRankAudioPath(ranking.achievedRank)',
    'onRetry: this.onResultRetry',
    'onTotalCoinsEntranceComplete: this.onResultTotalCoinsEntranceComplete',
    'this.requireScreenPlacement().attachCurrentScreen(root)',
    'presenter.attach(root)',
  ]);

  const commit = extractMethod(SOURCE, 'commitResultTransition');
  assertOrderedSubstrings(commit, [
    "transaction.status !== 'prepared'",
    'assertSignedInt32(configured.score',
    'recordGnStyleResultScore(',
    "transaction.status = 'committed'",
    'this.pendingResultEntryTransaction = null',
    'transaction.objectiveTailAttempted = true',
    'createRecoveredResultObjectiveCommand(',
    'this.requireObjectivesManager().processGameEvent(',
    'releasedScene.releaseGnStyleLayerForReplacement()',
    'this.disposeModePresentation()',
  ]);
  assert.equal(occurrences(commit, 'recordGnStyleResultScore('), 1);
  assert.equal(
    occurrences(commit, 'createRecoveredResultObjectiveCommand('),
    1,
  );
});

test('completed scores use signed-int32 semantics and never add a nonnegative guard', () => {
  const setScore = extractMethod(SOURCE, 'setPendingResultScore');
  assert.match(
    setScore,
    /assertSignedInt32\(score, 'GN Style completedRunScore'\)/,
  );
  assert.doesNotMatch(setScore, /score\s*<\s*0|non-negative/);

  const configured = extractMethod(SOURCE, 'configuredResult');
  assert.match(configured, /assertSignedInt32\(pending\.score/);
  assert.doesNotMatch(configured, /pending\.score\s*<\s*0/);

  const guard = extractFunction(SOURCE, 'assertSignedInt32');
  assert.match(guard, /value < -2_147_483_648/);
  assert.match(guard, /value > 2_147_483_647/);
  assert.doesNotMatch(guard, /value < 0/);

  const menu = extractMemberBlock(
    SOURCE,
    '  private readonly onResultMenu = (',
  );
  assert.match(menu, /completedRunScore: configured\.score/);
  assert.match(menu, /assertSignedInt32\(configured\.score/);
});

test('GN ranking reward, fresh Retry, and Result Menu reuse recovered shared contracts', () => {
  const reward = extractMemberBlock(
    SOURCE,
    '  private readonly onResultTotalCoinsEntranceComplete = (',
  );
  assertOrderedSubstrings(reward, [
    'this.pendingResultEntryTransaction !== null',
    'awardGnStyleResultCoins(',
    'GN_STYLE_RESULT_REWARD_READY_EVENT',
    'return award.bonusCoins',
  ]);
  assert.equal(occurrences(reward, 'awardGnStyleResultCoins('), 1);
  assert.doesNotMatch(SOURCE, /\.save\(|saveSettings|flushSettings/);

  const retry = extractMethod(SOURCE, 'restartFromResult');
  assertOrderedSubstrings(retry, [
    'createGnStyleResultNavigationCommands({',
    "route: 'retry'",
    "case 'capture-result-parent':",
    "case 'remove-result':",
    "case 'construct-gn-style':",
    '!command.fresh',
    'this.constructMode()',
    "case 'attach-gn-style-to-captured-parent':",
    'this.attachModeAndActivateScene(placement)',
  ]);

  const menu = extractMemberBlock(
    SOURCE,
    '  private readonly onResultMenu = (',
  );
  assert.match(menu, /route: 'main-menu'/);
  assert.match(menu, /GN_STYLE_RESULT_MENU_REQUESTED_EVENT/);
  assert.match(menu, /this\.rollbackResultMenu\(transaction\)/);
});

test('executable Pause Replay restores every paused lease after standby acquisition fails', () => {
  const reports: unknown[][] = [];
  const restart = compileSourceMethod<
    (this: Record<string, any>) => void
  >('restartFromPause', gnStyleLifecycleDependencies(reports));
  const harness = createGnStyleReplayHarness('standby-lease');

  assert.throws(
    () => restart.call(harness.controller),
    /injected standby scene lease failure/,
  );
  assert.equal(harness.placement.currentScreen, harness.oldRoot);
  assert.equal(harness.oldRoot.parent, harness.host);
  assert.equal(harness.oldScene.active, true);
  assert.equal(harness.oldScene.suspended, false);
  assert.equal(
    harness.controller.gnStyleSceneController,
    harness.oldScene,
  );
  assert.equal(harness.controller.currentOwnership, harness.oldOwnership);
  assert.equal(harness.music.paused, true);
  assert.equal(harness.oldParticle.state.paused, true);
  assert.equal(harness.oldParticle.disposed, false);
  assert.equal(harness.controller.pausePresenter, harness.oldPause);
  assert.equal(harness.oldPause.disposed, false);
  assert.equal(harness.freshPause.disposed, false);
  assert.equal(harness.initializePauseCalls(), 0);
  assert.equal(harness.classicAudio.pauseCalls, 1);
  assert.equal(harness.timerAudio.pauseCalls, 1);
  assert.equal(harness.controller.lifecycleFatalError, null);
  assert.equal(harness.controller.retiredRuns.length, 0);
  assert.deepEqual(reports, []);
});

test('executable Pause Replay replacement failure poisons and quiesces the restored run', () => {
  const reports: unknown[][] = [];
  const restart = compileSourceMethod<
    (this: Record<string, any>) => void
  >('restartFromPause', gnStyleLifecycleDependencies(reports));
  const harness = createGnStyleReplayHarness('replacement');

  assert.throws(
    () => restart.call(harness.controller),
    (error: unknown) => (
      error instanceof TestGnStyleLifecycleRollbackError
      && /GN Style Pause Replay rollback failed/.test(error.message)
      && error.rollbackErrors.some((failure) => (
        String(failure).includes(
          'paused music lease was not retained for rollback',
        )
      ))
    ),
  );
  assert.equal(harness.placement.currentScreen, harness.oldRoot);
  assert.equal(harness.oldScene.active, false);
  assert.equal(harness.oldScene.suspended, true);
  assert.equal(harness.controller.currentOwnership, harness.oldOwnership);
  assert.equal(harness.controller.pausePresenter, harness.oldPause);
  assert.equal(harness.oldPause.disposed, false);
  assert.equal(harness.freshPause.disposed, false);
  assert.equal(harness.initializePauseCalls(), 0);
  assert.ok(
    harness.controller.lifecycleFatalError
      instanceof TestGnStyleLifecycleRollbackError,
  );
  assert.equal(harness.freshParticle.disposed, true);
  assert.equal(harness.controller.retiredRuns.length, 0);
  assert.equal(harness.music.paused, false);
  assert.equal(harness.music.playing, false);
  assert.deepEqual(reports, []);
});

test('executable Pause Replay commits fresh ownership and drains a failed old particle cleanup', () => {
  const reports: unknown[][] = [];
  const dependencies = gnStyleLifecycleDependencies(reports);
  const restart = compileSourceMethod<
    (this: Record<string, any>) => void
  >('restartFromPause', dependencies);
  const drain = compileSourceMethod<
    (this: Record<string, any>) => void
  >('drainRetiredRuns', dependencies);
  const harness = createGnStyleReplayHarness('old-disposal');

  assert.doesNotThrow(() => restart.call(harness.controller));
  assert.equal(harness.placement.currentScreen, harness.freshRoot);
  assert.equal(harness.oldRoot.parent, null);
  assert.equal(harness.freshRoot.parent, harness.host);
  assert.equal(harness.oldScene.active, false);
  assert.equal(harness.oldScene.suspended, false);
  assert.equal(harness.freshScene.active, true);
  assert.equal(harness.controller.currentOwnership, harness.freshOwnership);
  assert.equal(harness.controller.pausePresenter, harness.freshPause);
  assert.equal(harness.oldPause.disposed, true);
  assert.equal(harness.freshPause.disposed, false);
  assert.equal(harness.initializePauseCalls(), 1);
  assert.equal(
    harness.controller.gnStyleSceneController,
    harness.freshScene,
  );
  assert.equal(harness.controller.retiredRuns.length, 1);
  assert.equal(
    harness.controller.retiredRuns[0].ownership,
    harness.oldOwnership,
  );
  assert.equal(harness.oldParticle.disposed, false);
  assert.equal(harness.freshParticle.disposed, false);
  assert.equal(reports.length, 1);

  assert.doesNotThrow(() => drain.call(harness.controller));
  assert.equal(harness.controller.retiredRuns.length, 0);
  assert.equal(harness.oldParticle.disposed, true);
  assert.equal(harness.freshParticle.disposed, false);
  assert.equal(harness.oldPause.disposed, true);
  assert.equal(harness.freshPause.disposed, false);
  assert.equal(harness.controller.pausePresenter, harness.freshPause);
  assert.equal(harness.controller.currentOwnership, harness.freshOwnership);
  assert.equal(
    harness.controller.gnStyleSceneController,
    harness.freshScene,
  );
  assert.equal(harness.music.playing, false);
  assert.equal(harness.music.paused, false);
});

test('executable Pause Quit audio failure restores input, physics, and paused owners before observer reporting', () => {
  const reports: unknown[][] = [];
  const dependencies = gnStyleLifecycleDependencies(reports);
  const quit = compileSourceArrowMember<
    (this: Record<string, any>) => void
  >('onPauseQuitRequested', {
    ...dependencies,
    GN_STYLE_PAUSE_QUIT_REQUESTED_EVENT: 'gn-style-pause-quit-requested',
  });
  const release = compileSourceMethod<
    (this: Record<string, any>) => void
  >('releasePauseEffectsForNavigation', dependencies);
  const restore = compileSourceMethod<
    (
      this: Record<string, any>,
      snapshot: Record<string, boolean>,
    ) => void
  >('restorePauseOwnershipAfterNavigationRollback', dependencies);
  const rollback = compileSourceMethod<
    (
      this: Record<string, any>,
      transaction: Record<string, any>,
    ) => void
  >('rollbackPauseQuit', dependencies);
  const host = {};
  const root = { parent: host };
  const placement = {
    currentScreen: root as typeof root | null,
    attachCurrentScreen(next: typeof root) {
      next.parent = host;
      this.currentScreen = next;
    },
    replaceCurrentScreen(next: typeof root) {
      const previous = this.currentScreen;
      assert.ok(previous);
      previous.parent = null;
      next.parent = host;
      this.currentScreen = next;
      return previous;
    },
  };
  const scene = {
    active: true,
    suspended: false,
    resumeSuspendedGnStyleLayer() {
      assert.equal(this.suspended, true);
      this.suspended = false;
      this.active = true;
    },
    suspendGnStyleLayerForNavigation() {
      assert.equal(this.active, true);
      this.active = false;
      this.suspended = true;
    },
  };
  const pause = {
    ingressCalls: 0,
    pauseIngress() {
      this.ingressCalls += 1;
    },
    resumeEgress() {},
    stopAllActions() {},
  };
  const classicAudio = {
    pauseCalls: 0,
    pauseAllEffects() {
      this.pauseCalls += 1;
    },
    stopAllEffects() {},
  };
  const timerAudio = {
    pauseCalls: 0,
    pauseAllEffects() {
      this.pauseCalls += 1;
    },
    stopAllEffects() {
      throw new Error('injected timer audio release failure');
    },
  };
  const music = { paused: true };
  const particle = { state: { paused: true } };
  let navigationEmits = 0;
  const controller: Record<string, any> = {
    lifecycleFatalError: null,
    modeRoot: root,
    particlePresenter: particle,
    pausePresenter: pause,
    sharedSettingsRuntime: {
      state: {
        snapshot: {
          effectsEnabled: true,
          musicEnabled: true,
        },
      },
    },
    currentPauseCard: () => ({}),
    emitSnapshot() {
      throw new Error('injected rolled-back snapshot observer failure');
    },
    node: {
      emit() {
        navigationEmits += 1;
      },
    },
    releasePauseEffectsForNavigation() {
      return release.call(this);
    },
    requireClassicGameplayController: () => ({
      sharedAudioPresenter: classicAudio,
    }),
    requireModeRoot: () => root,
    requireMusic: () => music,
    requireParticlePresenter: () => particle,
    requirePausePresenter: () => pause,
    requireSceneController: () => scene,
    requireScreenPlacement: () => placement,
    requireTimerAudio: () => timerAudio,
    restorePauseOwnershipAfterNavigationRollback(snapshot: unknown) {
      return restore.call(this, snapshot as Record<string, boolean>);
    },
    retainFatalLifecycleBoundary(error: unknown) {
      this.lifecycleFatalError ??= error;
    },
    rollbackPauseQuit(transaction: unknown) {
      return rollback.call(this, transaction as Record<string, any>);
    },
  };

  assert.throws(
    () => quit.call(controller),
    /injected timer audio release failure/,
  );
  assert.equal(placement.currentScreen, root);
  assert.equal(root.parent, host);
  assert.equal(scene.active, true);
  assert.equal(scene.suspended, false);
  assert.equal(pause.ingressCalls, 1);
  assert.equal(classicAudio.pauseCalls, 1);
  assert.equal(timerAudio.pauseCalls, 1);
  assert.equal(music.paused, true);
  assert.equal(particle.state.paused, true);
  assert.equal(navigationEmits, 0);
  assert.equal(controller.lifecycleFatalError, null);
  assert.equal(reports.length, 1);
  assert.match(
    String(reports[0][0]),
    /injected rolled-back snapshot observer failure/,
  );
});

test('executable Pause Quit commit is irreversible and drains failed particle disposal', () => {
  const reports: unknown[][] = [];
  const dependencies = gnStyleLifecycleDependencies(reports);
  const commit = compileSourceMethod<
    (
      this: Record<string, any>,
      transaction: Record<string, any>,
      previousRoot: object,
    ) => void
  >('commitPauseQuit', dependencies);
  const drain = compileSourceMethod<
    (this: Record<string, any>) => void
  >('drainRetiredRuns', dependencies);
  const root = { parent: null };
  const destination = { parent: {} };
  const particle = { disposed: false };
  const pause = {};
  const releasedOwnership = {
    id: 'released',
    modeRoot: root,
    particlePresenter: particle,
    pausePresenter: pause,
  };
  const emptyOwnership = {
    id: 'empty',
    modeRoot: null,
    particlePresenter: null,
    pausePresenter: null,
  };
  let ownership = releasedOwnership;
  let disposeAttempts = 0;
  let finalizeCalls = 0;
  let musicStopCalls = 0;
  const scene = {
    active: false,
    readyForActivation: false,
    suspended: true,
    finalizeSuspendedGnStyleLayerRelease() {
      finalizeCalls += 1;
      this.suspended = false;
      this.readyForActivation = true;
    },
  };
  const placement = { currentScreen: destination };
  const controller: Record<string, any> = {
    gnStyleSceneController: scene,
    modeRoot: root,
    particlePresenter: particle,
    pausePresenter: pause,
    retiredRuns: [],
    captureRunOwnership() {
      return ownership;
    },
    createEmptyRunOwnership() {
      return emptyOwnership;
    },
    disposeModePresentation() {
      disposeAttempts += 1;
      if (disposeAttempts === 1) {
        throw new Error('injected committed particle disposal failure');
      }
      ownership.particlePresenter.disposed = true;
      this.particlePresenter = null;
    },
    effectsEnabled: () => false,
    emitSnapshot() {
      throw new Error('injected committed Pause Quit observer failure');
    },
    installRunOwnership(next: typeof releasedOwnership | typeof emptyOwnership) {
      ownership = next as typeof releasedOwnership;
      this.modeRoot = next.modeRoot;
      this.particlePresenter = next.particlePresenter;
      this.pausePresenter = next.pausePresenter;
    },
    quiesceSceneAfterFailedRelease() {},
    requireMusic: () => ({
      stop() {
        musicStopCalls += 1;
      },
    }),
    requireSceneController: () => scene,
  };
  const transaction = {
    audioReleaseAttempted: true,
    presenter: pause,
    root,
    screenPlacement: placement,
    status: 'pending',
  };

  assert.doesNotThrow(() => commit.call(controller, transaction, root));
  assert.equal(transaction.status, 'committed');
  assert.doesNotThrow(() => commit.call(controller, transaction, root));
  assert.equal(finalizeCalls, 1);
  assert.equal(musicStopCalls, 1);
  assert.equal(disposeAttempts, 1);
  assert.equal(ownership, emptyOwnership);
  assert.equal(controller.particlePresenter, null);
  assert.equal(controller.retiredRuns.length, 1);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].length, 2);

  assert.doesNotThrow(() => drain.call(controller));
  assert.equal(disposeAttempts, 2);
  assert.equal(particle.disposed, true);
  assert.equal(controller.retiredRuns.length, 0);
  assert.equal(ownership, emptyOwnership);
  assert.equal(controller.particlePresenter, null);
});

test('executable Time Up to Result commits ranking and objective once despite cleanup faults', () => {
  const reports: unknown[][] = [];
  const dependencies = {
    ...gnStyleLifecycleDependencies(reports),
    createRecoveredResultObjectiveCommand(
      mode: number,
      completedScore: number,
    ) {
      return {
        completedScore,
        mode,
        selector: 2,
      };
    },
  };
  const capture = compileSourceMethod<
    (this: Record<string, any>) => void
  >('captureModeForResult', dependencies);
  const prepare = compileSourceMethod<
    (
      this: Record<string, any>,
      transaction: Record<string, any>,
    ) => void
  >('prepareResultCommit', dependencies);
  const commit = compileSourceMethod<
    (
      this: Record<string, any>,
      transaction: Record<string, any>,
    ) => void
  >('commitResultTransition', dependencies);
  const drain = compileSourceMethod<
    (this: Record<string, any>) => void
  >('drainRetiredRuns', dependencies);
  const oldRoot = { parent: null };
  const resultRoot = { parent: {} };
  const resultPresenter = {};
  const particle = { disposed: false };
  const oldOwnership = {
    id: 'time-up',
    particlePresenter: particle,
    pendingCapturedRoot: oldRoot,
    pendingResultConfiguration: null,
  };
  const emptyOwnership = {
    id: 'empty',
    particlePresenter: null,
    pendingCapturedRoot: null,
    pendingResultConfiguration: null,
  };
  let ownership = oldOwnership;
  let participant: Record<string, () => void> | null = null;
  let rankingMutations = 0;
  let objectiveMutations = 0;
  let releaseAttempts = 0;
  let disposeAttempts = 0;
  let snapshotCalls = 0;
  const scene = {
    active: true,
    readyForActivation: false,
    suspended: false,
    enlistTimeUpFinishParticipant(next: Record<string, () => void>) {
      participant = next;
    },
    releaseGnStyleLayerForReplacement() {
      releaseAttempts += 1;
      if (releaseAttempts === 1) {
        throw new Error('injected Time Up physics lease release failure');
      }
      this.active = false;
      this.readyForActivation = true;
    },
  };
  const placement = { currentScreen: resultRoot };
  const controller: Record<string, any> = {
    gnStyleSceneController: scene,
    modeRoot: oldRoot,
    particlePresenter: particle,
    pendingCapturedRoot: null,
    pendingResultConfiguration: null,
    pendingResultEntryTransaction: null,
    resultPresentationRoot: null,
    resultPresenter: null,
    retiredRuns: [],
    sharedSettingsRuntime: {
      state: {
        recordGnStyleResultScore(score: number) {
          assert.equal(score, 73);
          rankingMutations += 1;
        },
      },
    },
    captureRunOwnership() {
      return ownership;
    },
    commitResultTransition(transaction: Record<string, any>) {
      return commit.call(this, transaction);
    },
    configuredResult: () => ({ mode: 2, score: 73 }),
    createEmptyRunOwnership: () => emptyOwnership,
    disposeModePresentation() {
      disposeAttempts += 1;
      if (disposeAttempts === 1) {
        throw new Error('injected Time Up particle disposal failure');
      }
      ownership.particlePresenter.disposed = true;
      this.particlePresenter = null;
    },
    emitSnapshot() {
      snapshotCalls += 1;
      throw new Error('injected committed Result snapshot observer failure');
    },
    installRunOwnership(next: typeof oldOwnership | typeof emptyOwnership) {
      ownership = next as typeof oldOwnership;
      this.particlePresenter = next.particlePresenter;
    },
    quiesceSceneAfterFailedRelease(target: typeof scene, _label: string, failures: unknown[]) {
      if (target.active) {
        collectExecutableCleanupFailure(
          failures,
          () => target.releaseGnStyleLayerForReplacement(),
        );
      }
    },
    requireModeRoot: () => oldRoot,
    requireObjectivesManager: () => ({
      processGameEvent(selector: number, score: number) {
        assert.equal(selector, 2);
        assert.equal(score, 73);
        objectiveMutations += 1;
        throw new Error('injected objective observer failure');
      },
    }),
    requireSceneController: () => scene,
    requireScreenPlacement: () => placement,
  };

  capture.call(controller);
  assert.ok(participant);
  const transaction = controller.pendingResultEntryTransaction;
  controller.pendingResultConfiguration = { mode: 2, score: 73 };
  controller.resultPresentationRoot = resultRoot;
  controller.resultPresenter = resultPresenter;
  transaction.configuration = { mode: 2, score: 73 };
  transaction.presenter = resultPresenter;
  transaction.root = resultRoot;
  prepare.call(controller, transaction);
  assert.equal(transaction.status, 'prepared');

  assert.doesNotThrow(() => participant?.commit());
  assert.equal(transaction.status, 'committed');
  assert.equal(controller.pendingResultEntryTransaction, null);
  assert.equal(rankingMutations, 1);
  assert.equal(objectiveMutations, 1);
  assert.equal(releaseAttempts, 1);
  assert.equal(disposeAttempts, 1);
  assert.equal(snapshotCalls, 1);
  assert.equal(ownership, emptyOwnership);
  assert.equal(controller.particlePresenter, null);
  assert.equal(controller.retiredRuns.length, 1);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].length, 4);

  assert.doesNotThrow(() => participant?.commit());
  assert.equal(rankingMutations, 1);
  assert.equal(objectiveMutations, 1);
  assert.equal(releaseAttempts, 1);
  assert.equal(disposeAttempts, 1);
  assert.equal(snapshotCalls, 1);

  assert.doesNotThrow(() => drain.call(controller));
  assert.equal(releaseAttempts, 2);
  assert.equal(disposeAttempts, 2);
  assert.equal(particle.disposed, true);
  assert.equal(controller.retiredRuns.length, 0);
  assert.equal(ownership, emptyOwnership);
  assert.equal(controller.particlePresenter, null);
});

test('executable provisional Time Up Result rolls back its real attachment exactly once', () => {
  const reports: unknown[][] = [];
  const host = { name: 'CurrentScreenHost' };
  const gameplayRoot = {
    destroyed: false,
    name: 'gameplay',
    parent: host as object | null,
  };
  const resultRoot = {
    destroyCalls: 0,
    destroyed: false,
    name: 'result',
    parent: null as object | null,
    destroy() {
      this.destroyCalls += 1;
      this.destroyed = true;
    },
  };
  const presenter = {
    attachCalls: 0,
    disposeCalls: 0,
    attach(root: typeof resultRoot) {
      assert.equal(root, resultRoot);
      assert.equal(root.parent, host);
      this.attachCalls += 1;
    },
    dispose() {
      this.disposeCalls += 1;
    },
  };
  const leaderboard = { first: 80, second: 60, third: 40 };
  const originalLeaderboard = { ...leaderboard };
  let rankingPreviewCalls = 0;
  let rankingMutations = 0;
  let objectiveMutations = 0;
  let snapshotCalls = 0;
  let musicStopCalls = 0;
  let participant: Record<string, () => void> | null = null;
  const dependencies = {
    ...gnStyleLifecycleDependencies(reports),
    ClassicResultPresenter: {
      create(
        options: Readonly<{ completedRunScore: number }>,
        _callbacks: unknown,
      ) {
        assert.equal(options.completedRunScore, 73);
        return presenter;
      },
    },
    createDetachedScreenRoot(name: string, _owner: unknown) {
      assert.equal(name, 'GnStyleResultPresentationRoot');
      return resultRoot;
    },
    getClassicResultRankAudioPath(rank: number) {
      return `rank-${rank}.wav`;
    },
    gnStyleLeaderboardPanelValues(
      next: Readonly<{ first: number; second: number; third: number }>,
    ) {
      return [next.first, next.second, next.third];
    },
    insertGnStyleResultScore(
      score: number,
      current: Readonly<{
        first: number;
        second: number;
        third: number;
      }>,
    ) {
      assert.equal(score, 73);
      assert.equal(current, leaderboard);
      rankingPreviewCalls += 1;
      return {
        achievedRank: 2,
        leaderboard: {
          first: current.first,
          second: score,
          third: current.second,
        },
      };
    },
  };
  const capture = compileSourceMethod<
    (this: Record<string, any>) => void
  >('captureModeForResult', dependencies);
  const begin = compileSourceMethod<
    (this: Record<string, any>) => void
  >('beginResultConstruction', dependencies);
  const setMode = compileSourceMethod<
    (this: Record<string, any>, mode: number) => void
  >('setPendingResultMode', dependencies);
  const setScore = compileSourceMethod<
    (this: Record<string, any>, score: number) => void
  >('setPendingResultScore', dependencies);
  const configured = compileSourceMethod<
    (this: Record<string, any>) => Readonly<{ mode: number; score: number }>
  >('configuredResult', dependencies);
  const detach = compileSourceMethod<
    (this: Record<string, any>, cleanup: true) => void
  >('detachModeForResult', dependencies);
  const attach = compileSourceMethod<
    (this: Record<string, any>, zOrder: 1) => void
  >('attachResult', dependencies);
  const prepare = compileSourceMethod<
    (
      this: Record<string, any>,
      transaction: Record<string, any>,
    ) => void
  >('prepareResultCommit', dependencies);
  const rollback = compileSourceMethod<
    (
      this: Record<string, any>,
      transaction: Record<string, any>,
    ) => void
  >('rollbackResultTransition', dependencies);
  const placement = {
    currentScreen: gameplayRoot as
      | typeof gameplayRoot
      | typeof resultRoot
      | null,
    attachCurrentScreen(root: typeof gameplayRoot | typeof resultRoot) {
      assert.equal(this.currentScreen, null);
      assert.equal(root.parent, null);
      root.parent = host;
      this.currentScreen = root;
      return root;
    },
    detachCurrentScreen(root: typeof gameplayRoot | typeof resultRoot) {
      assert.equal(this.currentScreen, root);
      root.parent = null;
      this.currentScreen = null;
      return root;
    },
  };
  const controller: Record<string, any> = {
    modeRoot: gameplayRoot,
    node: {},
    pendingCapturedRoot: null,
    pendingResultConfiguration: null,
    pendingResultEntryTransaction: null,
    resultPresentationRoot: null,
    resultPresenter: null,
    sharedSettingsRuntime: {
      state: {
        gnStyleLeaderboard: leaderboard,
        snapshot: { totalCoins: 999 },
        recordGnStyleResultScore() {
          rankingMutations += 1;
        },
      },
    },
    configuredResult() {
      return configured.call(this);
    },
    effectsEnabled: () => false,
    emitSnapshot() {
      snapshotCalls += 1;
    },
    prepareResultCommit(transaction: Record<string, any>) {
      return prepare.call(this, transaction);
    },
    requireClassicGameplayController: () => ({
      sharedAudioPresenter: {
        playOneShot() {},
      },
      sharedGameplayRandom: {},
      sharedResourceCatalog: {
        result: {},
        resultFonts: {},
      },
    }),
    requireModeRoot: () => gameplayRoot,
    requireMusic: () => ({
      stop() {
        musicStopCalls += 1;
      },
    }),
    requireObjectivesManager: () => ({
      processGameEvent() {
        objectiveMutations += 1;
      },
    }),
    requirePendingResultTransition() {
      return this.pendingResultEntryTransaction;
    },
    requireSceneController: () => ({
      enlistTimeUpFinishParticipant(
        next: Record<string, () => void>,
      ) {
        participant = next;
      },
    }),
    requireScreenPlacement: () => placement,
    requireViewport: () => ({ height: 800, width: 480, x: 0, y: 0 }),
    rollbackResultTransition(transaction: Record<string, any>) {
      return rollback.call(this, transaction);
    },
  };

  capture.call(controller);
  begin.call(controller);
  setMode.call(controller, 2);
  setScore.call(controller, 73);
  detach.call(controller, true);
  attach.call(controller, 1);
  assert.ok(participant);
  const transaction = controller.pendingResultEntryTransaction;
  assert.equal(transaction.status, 'pending');
  assert.equal(transaction.gnStyleRoot, gameplayRoot);
  assert.equal(transaction.root, resultRoot);
  assert.equal(transaction.presenter, presenter);
  assert.equal(placement.currentScreen, resultRoot);
  assert.equal(gameplayRoot.parent, null);
  assert.equal(resultRoot.parent, host);
  assert.equal(presenter.attachCalls, 1);
  assert.equal(musicStopCalls, 1);
  assert.equal(rankingPreviewCalls, 1);
  assert.deepEqual(leaderboard, originalLeaderboard);

  controller.pendingResultConfiguration = { mode: 2, score: 74 };
  assert.throws(
    () => participant?.prepareCommit(),
    /GN Style Result can commit only from its provisional boundary/,
  );
  assert.equal(transaction.status, 'pending');

  assert.doesNotThrow(() => participant?.rollback());
  assert.equal(transaction.status, 'rolled-back');
  assert.equal(placement.currentScreen, gameplayRoot);
  assert.equal(gameplayRoot.parent, host);
  assert.equal(resultRoot.parent, null);
  assert.equal(resultRoot.destroyed, true);
  assert.equal(resultRoot.destroyCalls, 1);
  assert.equal(presenter.disposeCalls, 1);
  assert.equal(controller.resultPresentationRoot, null);
  assert.equal(controller.resultPresenter, null);
  assert.equal(controller.pendingCapturedRoot, null);
  assert.equal(controller.pendingResultConfiguration, null);
  assert.equal(controller.pendingResultEntryTransaction, null);
  assert.equal(snapshotCalls, 1);
  assert.equal(rankingMutations, 0);
  assert.equal(objectiveMutations, 0);
  assert.deepEqual(leaderboard, originalLeaderboard);
  assert.deepEqual(reports, []);

  assert.doesNotThrow(() => participant?.rollback());
  assert.equal(resultRoot.destroyCalls, 1);
  assert.equal(presenter.disposeCalls, 1);
  assert.equal(snapshotCalls, 1);
  assert.equal(rankingMutations, 0);
  assert.equal(objectiveMutations, 0);
});

test('executable Result Retry restores Result and objective after fresh physics activation fails', () => {
  const reports: unknown[][] = [];
  const retry = compileSourceMethod<
    (this: Record<string, any>) => void
  >('restartFromResult', gnStyleResultDependencies(reports));
  const harness = createGnStyleRetryHarness('activation');

  assert.throws(
    () => retry.call(harness.controller),
    /injected fresh GN physics activation failure/,
  );
  assert.equal(harness.placement.currentScreen, harness.resultRoot);
  assert.equal(harness.resultRoot.parent, harness.host);
  assert.equal(harness.freshRoot.parent, null);
  assert.equal(harness.scene.active, false);
  assert.equal(harness.scene.readyForActivation, true);
  assert.equal(harness.objectiveValue(), 9);
  assert.deepEqual(
    harness.controller.pendingResultConfiguration,
    { mode: 2, score: 91 },
  );
  assert.equal(harness.presenter.state.navigation, 'none');
  assert.equal(harness.presenter.rearmCalls, 1);
  assert.equal(
    harness.controller.resultPresentationRoot,
    harness.resultRoot,
  );
  assert.equal(harness.controller.resultPresenter, harness.presenter);
  assert.equal(harness.controller.currentOwnership, harness.emptyOwnership);
  assert.equal(harness.controller.modeRoot, null);
  assert.equal(harness.freshParticle.disposed, true);
  assert.equal(harness.freshOwnership.particlePresenter, null);
  assert.equal(harness.controller.particlePresenter, null);
  assert.equal(harness.controller.lifecycleFatalError, null);
  assert.deepEqual(reports, []);
});

test('executable Result Retry keeps fresh ownership after disposal and observer faults', () => {
  const reports: unknown[][] = [];
  const retry = compileSourceMethod<
    (this: Record<string, any>) => void
  >('restartFromResult', gnStyleResultDependencies(reports));
  const harness = createGnStyleRetryHarness('post-commit');

  assert.doesNotThrow(() => retry.call(harness.controller));
  assert.equal(harness.placement.currentScreen, harness.freshRoot);
  assert.equal(harness.resultRoot.parent, null);
  assert.equal(harness.freshRoot.parent, harness.host);
  assert.equal(harness.scene.active, true);
  assert.equal(harness.scene.readyForActivation, false);
  assert.equal(harness.controller.currentOwnership, harness.freshOwnership);
  assert.equal(harness.controller.pendingResultConfiguration, null);
  assert.equal(harness.controller.particlePresenter, harness.freshParticle);
  assert.equal(harness.freshParticle.disposed, false);
  assert.equal(harness.controller.resultPresentationRoot, null);
  assert.equal(harness.controller.resultPresenter, null);
  assert.equal(harness.presenter.disposeCalls, 1);
  assert.equal(harness.resultRoot.destroyCalls, 1);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].length, 2);
});

test('executable Result Menu audio failure restores and rearms Result despite observer failure', () => {
  const reports: unknown[][] = [];
  const dependencies = gnStyleResultDependencies(reports);
  const menu = compileSourceArrowMember<
    (this: Record<string, any>) => void
  >('onResultMenu', {
    ...dependencies,
    GN_STYLE_RESULT_MENU_REQUESTED_EVENT: 'gn-style-result-menu-requested',
  });
  const rollback = compileSourceMethod<
    (
      this: Record<string, any>,
      transaction: Record<string, any>,
    ) => void
  >('rollbackResultMenu', dependencies);
  const host = {};
  const root = { parent: host };
  const placement = {
    currentScreen: root as typeof root | null,
    attachCurrentScreen(next: typeof root) {
      next.parent = host;
      this.currentScreen = next;
    },
    replaceCurrentScreen(next: typeof root) {
      const previous = this.currentScreen;
      assert.ok(previous);
      previous.parent = null;
      next.parent = host;
      this.currentScreen = next;
      return previous;
    },
  };
  const presenter = {
    rearmCalls: 0,
    state: { navigation: 'menu' },
    rearmNavigationAfterFailure(route: string) {
      assert.equal(route, 'menu');
      this.rearmCalls += 1;
      this.state.navigation = 'none';
      return true;
    },
  };
  let requestEmits = 0;
  const controller: Record<string, any> = {
    lifecycleFatalError: null,
    resultPresentationRoot: root,
    resultPresenter: presenter,
    configuredResult: () => ({ mode: 2, score: -10 }),
    effectsEnabled: () => true,
    emitCommand() {},
    emitSnapshot() {
      throw new Error('injected Result Menu rollback observer failure');
    },
    node: {
      emit() {
        requestEmits += 1;
      },
    },
    requireAttachedResultRoot: () => root,
    requireClassicGameplayController: () => ({
      sharedAudioPresenter: {
        playOneShot() {
          throw new Error('injected Result Menu audio failure');
        },
      },
    }),
    requireResultPresenter: () => presenter,
    requireScreenPlacement: () => placement,
    retainFatalLifecycleBoundary(error: unknown) {
      this.lifecycleFatalError ??= error;
    },
    rollbackResultMenu(transaction: unknown) {
      return rollback.call(this, transaction as Record<string, any>);
    },
  };

  assert.throws(
    () => menu.call(controller),
    /injected Result Menu audio failure/,
  );
  assert.equal(placement.currentScreen, root);
  assert.equal(root.parent, host);
  assert.equal(presenter.state.navigation, 'none');
  assert.equal(presenter.rearmCalls, 1);
  assert.equal(requestEmits, 0);
  assert.equal(controller.lifecycleFatalError, null);
  assert.equal(reports.length, 1);
  assert.match(
    String(reports[0][0]),
    /injected Result Menu rollback observer failure/,
  );
});

test('executable Result Menu commit clears owners once after disposal failure', () => {
  const reports: unknown[][] = [];
  const commit = compileSourceMethod<
    (
      this: Record<string, any>,
      transaction: Record<string, any>,
      previousRoot: object,
    ) => void
  >('commitResultMenu', gnStyleLifecycleDependencies(reports));
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
      throw new Error('injected Result presenter disposal failure');
    },
  };
  const music = {
    paused: true,
    playing: true,
    stopCalls: 0,
    stop() {
      this.stopCalls += 1;
      this.paused = false;
      this.playing = false;
    },
  };
  const transaction = {
    presenter,
    root,
    screenPlacement: { currentScreen: destination },
    status: 'pending',
  };
  const controller: Record<string, any> = {
    particlePresenter: null,
    resultPresentationRoot: root,
    resultPresenter: presenter,
    requireMusic: () => music,
  };

  assert.doesNotThrow(() => commit.call(controller, transaction, root));
  assert.equal(transaction.status, 'committed');
  assert.doesNotThrow(() => commit.call(controller, transaction, root));
  assert.equal(controller.resultPresentationRoot, null);
  assert.equal(controller.resultPresenter, null);
  assert.equal(controller.particlePresenter, null);
  assert.equal(music.stopCalls, 1);
  assert.equal(music.playing, false);
  assert.equal(music.paused, false);
  assert.equal(presenter.disposeCalls, 1);
  assert.equal(root.destroyCalls, 1);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].length, 1);
});

test('producer commit and rollback callbacks are idempotent and reject reversal', () => {
  for (const method of ['commitPauseQuit', 'commitResultMenu']) {
    const block = extractMethod(SOURCE, method);
    assert.match(
      block,
      /transaction\.status === 'committed'[\s\S]*?return/,
      `${method} must accept a repeated committed settlement`,
    );
    assert.match(
      block,
      /transaction\.status === 'rolled-back'[\s\S]*?throw new Error/,
      `${method} must reject commit after rollback`,
    );
  }
  const resultCommit = extractMethod(SOURCE, 'commitResultTransition');
  assert.match(
    resultCommit,
    /transaction\.status === 'committed'[\s\S]*?return/,
  );
  assert.match(
    resultCommit,
    /transaction\.status !== 'prepared'[\s\S]*?throw new Error/,
  );
  for (const method of [
    'rollbackPauseQuit',
    'rollbackResultTransition',
    'rollbackResultMenu',
  ]) {
    const block = extractMethod(SOURCE, method);
    assert.match(
      block,
      /transaction\.status === 'rolled-back'[\s\S]*?return/,
      `${method} must accept a repeated rollback settlement`,
    );
    assert.match(
      block,
      /transaction\.status === 'committed'[\s\S]*?throw new Error/,
      `${method} must reject rollback after commit`,
    );
  }
});

test('teardown drains exact particle, entity, presenter, audio, and retired ownership', () => {
  const dispose = extractMethod(SOURCE, 'disposeModePresentation');
  assertOrderedSubstrings(dispose, [
    'presenter.disposeAll()',
    'presenter.dispose()',
    'particle.dispose()',
    'intro.dispose()',
    'timeManager.dispose()',
    'blade.dispose()',
    'scoreHud.dispose()',
    'pause.dispose()',
    'registry.disposeAll()',
    'this.particlePresenter === null',
    'root.destroy()',
  ]);

  const retired = extractMethod(SOURCE, 'drainRetiredRuns');
  assertOrderedSubstrings(retired, [
    'this.captureRunOwnership()',
    'this.installRunOwnership(retired.ownership)',
    'retired.scene.releaseGnStyleLayerForReplacement()',
    'this.quiesceSceneAfterFailedRelease(',
    'retired.scene.finalizeSuspendedGnStyleLayerRelease()',
    'this.disposeModePresentation()',
    'this.installRunOwnership(activeOwnership)',
  ]);

  const preparation = extractMethod(SOURCE, 'disposePreparation');
  assert.match(preparation, /timerAudio\.dispose\(\)/);
  assert.match(preparation, /music\.dispose\(\)/);
});

function extractMethod(source: string, methodName: string): string {
  const signature = new RegExp(
    `^\\s*(?:function\\s+|(?:private\\s+)?(?:static\\s+)?(?:async\\s+)?)${methodName}\\b`,
    'm',
  );
  const match = signature.exec(source);
  assert.ok(match, `${methodName} method must exist`);
  return extractBalancedBlock(source, match.index);
}

function extractFunction(source: string, functionName: string): string {
  const match = new RegExp(`^function ${functionName}\\b`, 'm').exec(source);
  assert.ok(match, `${functionName} function must exist`);
  return extractBalancedBlock(source, match.index);
}

function extractMemberBlock(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${signature} must exist`);
  return extractBalancedBlock(source, start);
}

function extractCase(source: string, label: string): string {
  const start = source.indexOf(`case ${label}:`);
  assert.notEqual(start, -1, `case ${label} must exist`);
  const next = source.indexOf('\n      case ', start + 1);
  const end = next === -1 ? source.length : next;
  return source.slice(start, end);
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

function occurrences(source: string, value: string): number {
  return source.split(value).length - 1;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class TestGnStyleLifecycleRollbackError extends Error {
  readonly primary: unknown;
  readonly rollbackErrors: readonly unknown[];

  constructor(
    label: string,
    primary: unknown,
    rollbackErrors: readonly unknown[],
  ) {
    super(label);
    this.primary = primary;
    this.rollbackErrors = Object.freeze([...rollbackErrors]);
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
    sourceUrl: `gn-style-gameplay-controller.test.${methodName}.ts`,
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
    sourceUrl: `gn-style-gameplay-controller.test.${memberName}.ts`,
  });
  return Function(
    ...names,
    `"use strict";\n${javascript}\nreturn ${memberName};`,
  )(...values) as T;
}

function collectExecutableCleanupFailure(
  failures: unknown[],
  cleanup: () => unknown,
): void {
  try {
    cleanup();
  } catch (error) {
    failures.push(error);
  }
}

function gnStyleLifecycleDependencies(
  reports: unknown[][],
): Readonly<Record<string, unknown>> {
  return {
    CLASSIC_MENU_BUTTON_AUDIO_PATH: 'Sounds/menu-click.wav',
    GN_STYLE_RESULT_MODE_ID: 2,
    GnStyleLifecycleRollbackError: TestGnStyleLifecycleRollbackError,
    assertSignedInt32(value: number, label: string) {
      if (
        !Number.isInteger(value)
        || value < -2_147_483_648
        || value > 2_147_483_647
      ) {
        throw new Error(`${label} must be a signed int32`);
      }
    },
    cleanupError(label: string, failures: readonly unknown[]) {
      return new Error(
        `${label} failed: ${failures.map(String).join('; ')}`,
      );
    },
    collectCleanupFailure: collectExecutableCleanupFailure,
    isValid(value: unknown) {
      return (
        value !== null
        && typeof value === 'object'
        && !('destroyed' in value && value.destroyed === true)
      );
    },
    reportCleanupFailures(
      _label: string,
      failures: readonly unknown[],
    ) {
      if (failures.length > 0) {
        reports.push([...failures]);
      }
    },
  };
}

function gnStyleResultDependencies(
  reports: unknown[][],
): Readonly<Record<string, unknown>> {
  return {
    ...gnStyleLifecycleDependencies(reports),
    GN_STYLE_RESULT_MENU_REQUESTED_EVENT: 'gn-style-result-menu-requested',
    assertNever(command: Readonly<{ type: string }>): never {
      throw new Error(`Unexpected GN Style command ${command.type}`);
    },
    createGnStyleResultNavigationCommands(
      options: Readonly<{ route: 'main-menu' | 'retry' }>,
    ) {
      const audio = Object.freeze({
        canonicalPath: 'Sounds/menu-click.wav',
        type: 'request-menu-button-audio',
      });
      if (options.route === 'main-menu') {
        return Object.freeze([audio]);
      }
      return Object.freeze([
        audio,
        Object.freeze({ type: 'capture-result-parent' }),
        Object.freeze({ cleanup: true, type: 'remove-result' }),
        Object.freeze({
          fresh: true,
          mode: 2,
          type: 'construct-gn-style',
        }),
        Object.freeze({
          type: 'attach-gn-style-to-captured-parent',
          zOrder: 1,
        }),
      ]);
    },
  };
}

function createGnStyleReplayHarness(
  failure:
    | 'old-disposal'
    | 'replacement'
    | 'standby-lease'
    | null,
) {
  const restore = compileSourceMethod<
    (
      this: Record<string, any>,
      snapshot: Record<string, boolean>,
    ) => void
  >(
    'restorePauseOwnershipAfterNavigationRollback',
    gnStyleLifecycleDependencies([]),
  );
  const host = { name: 'CurrentScreenHost' };
  const oldRoot = {
    destroyed: false,
    name: 'old',
    parent: host as object | null,
  };
  const freshRoot = {
    destroyed: false,
    name: 'fresh',
    parent: null as object | null,
  };
  const oldParticle = {
    disposed: false,
    state: { paused: true },
  };
  const freshParticle = {
    disposed: false,
    state: { paused: false },
  };
  const oldPause = {
    disposed: false,
    ingressCalls: 0,
    dispose() {
      this.disposed = true;
    },
    pauseIngress() {
      this.ingressCalls += 1;
    },
    resumeEgress() {},
    stopAllActions() {},
  };
  const freshPause = {
    disposed: false,
    dispose() {
      this.disposed = true;
    },
  };
  const oldOwnership = {
    id: 'old',
    modeRoot: oldRoot,
    particlePresenter: oldParticle as typeof oldParticle | null,
    pausePresenter: oldPause as typeof oldPause | typeof freshPause | null,
    swishAudio: null,
  };
  const emptyOwnership = {
    id: 'empty',
    modeRoot: null,
    particlePresenter: null,
    pausePresenter: null,
    swishAudio: null,
  };
  const freshOwnership = {
    id: 'fresh',
    modeRoot: freshRoot,
    particlePresenter: freshParticle as typeof freshParticle | null,
    pausePresenter: null as typeof oldPause | typeof freshPause | null,
    swishAudio: null,
  };
  let ownership:
    | typeof emptyOwnership
    | typeof freshOwnership
    | typeof oldOwnership = oldOwnership;
  let initializePauseCalls = 0;
  let oldDisposeAttempts = 0;
  const oldScene = {
    active: true,
    readyForActivation: false,
    suspended: false,
    finalizeSuspendedGnStyleLayerRelease() {
      assert.equal(this.suspended, true);
      this.suspended = false;
      this.readyForActivation = true;
    },
    resumeSuspendedGnStyleLayer() {
      assert.equal(this.suspended, true);
      this.active = true;
      this.readyForActivation = false;
      this.suspended = false;
    },
    suspendGnStyleLayerForNavigation() {
      assert.equal(this.active, true);
      this.active = false;
      this.suspended = true;
    },
  };
  const freshScene = {
    active: false,
    readyForActivation: true,
    suspended: false,
    finalizeSuspendedGnStyleLayerRelease() {
      this.active = false;
      this.readyForActivation = true;
      this.suspended = false;
    },
    releaseGnStyleLayerForReplacement() {
      this.active = false;
      this.readyForActivation = true;
      this.suspended = false;
    },
    suspendGnStyleLayerForNavigation() {
      this.active = false;
      this.suspended = true;
    },
  };
  const placement = {
    currentScreen: oldRoot as typeof freshRoot | typeof oldRoot | null,
    attachCurrentScreen(root: typeof freshRoot | typeof oldRoot) {
      assert.equal(this.currentScreen, null);
      assert.equal(root.parent, null);
      root.parent = host;
      this.currentScreen = root;
    },
    replaceCurrentScreen(root: typeof freshRoot | typeof oldRoot) {
      if (failure === 'replacement' && root === freshRoot) {
        throw new Error('injected screen replacement failure');
      }
      const previous = this.currentScreen;
      assert.ok(previous);
      previous.parent = null;
      root.parent = host;
      this.currentScreen = root;
      return previous;
    },
  };
  const classicAudio = {
    pauseCalls: 0,
    pauseAllEffects() {
      this.pauseCalls += 1;
    },
    playOneShot() {},
    stopAllEffects() {},
  };
  const timerAudio = {
    pauseCalls: 0,
    pauseAllEffects() {
      this.pauseCalls += 1;
    },
    stopAllEffects() {},
  };
  const music = {
    paused: true,
    playing: true,
    stop() {
      this.paused = false;
      this.playing = false;
    },
  };
  const controller: Record<string, any> = {
    currentOwnership: oldOwnership,
    gnStyleSceneController: oldScene,
    lifecycleFatalError: null,
    modeRoot: oldRoot,
    particlePresenter: oldParticle,
    pausePresenter: oldPause,
    retiredRuns: [],
    screenPlacement: placement,
    standbySceneController: null,
    sharedSettingsRuntime: {
      state: {
        snapshot: {
          effectsEnabled: true,
          musicEnabled: true,
        },
      },
    },
    acquireStandbySceneController() {
      if (failure === 'standby-lease') {
        throw new Error('injected standby scene lease failure');
      }
      return freshScene;
    },
    activateCurrentSceneWithFreshCoordinator(scene: typeof freshScene) {
      assert.equal(this.currentOwnership, freshOwnership);
      assert.equal(placement.currentScreen, freshRoot);
      scene.active = true;
      scene.readyForActivation = false;
    },
    captureActivationObjectiveRollback: () => null,
    captureRunOwnership() {
      return ownership;
    },
    constructMode() {
      this.installRunOwnership(freshOwnership);
    },
    createEmptyRunOwnership: () => emptyOwnership,
    currentPauseCard: () => ({}),
    disposeModePresentation() {
      let particleFailure: Error | null = null;
      if (ownership === oldOwnership) {
        oldDisposeAttempts += 1;
        if (failure === 'old-disposal' && oldDisposeAttempts === 1) {
          particleFailure = new Error(
            'injected old particle disposal failure',
          );
        }
      }
      const target = ownership.particlePresenter;
      if (target !== null && particleFailure === null) {
        target.disposed = true;
        ownership.particlePresenter = null;
        if (this.particlePresenter === target) {
          this.particlePresenter = null;
        }
      }
      const targetPause = ownership.pausePresenter;
      if (targetPause !== null) {
        targetPause.dispose();
        ownership.pausePresenter = null;
        if (this.pausePresenter === targetPause) {
          this.pausePresenter = null;
        }
      }
      if (particleFailure !== null) {
        throw particleFailure;
      }
    },
    drainRetiredRuns() {},
    effectsEnabled: () => true,
    emitSnapshot() {},
    initializePausePresentation() {
      initializePauseCalls += 1;
      assert.equal(ownership, freshOwnership);
      assert.equal(this.pausePresenter, null);
      freshOwnership.pausePresenter = freshPause;
      this.pausePresenter = freshPause;
    },
    installRunOwnership(
      next:
        | typeof emptyOwnership
        | typeof freshOwnership
        | typeof oldOwnership,
    ) {
      ownership = next;
      this.currentOwnership = next;
      this.modeRoot = next.modeRoot;
      this.particlePresenter = next.particlePresenter;
      this.pausePresenter = next.pausePresenter;
    },
    quiesceSceneAfterFailedRelease(
      scene: typeof freshScene,
      _label: string,
      failures: unknown[],
    ) {
      if (scene.active) {
        collectExecutableCleanupFailure(
          failures,
          () => scene.releaseGnStyleLayerForReplacement(),
        );
      }
      if (scene.active) {
        collectExecutableCleanupFailure(
          failures,
          () => scene.suspendGnStyleLayerForNavigation(),
        );
      }
      if (scene.active) {
        failures.push(new Error('retained active input/physics lease'));
      }
    },
    requireClassicGameplayController: () => ({
      sharedAudioPresenter: classicAudio,
    }),
    requireDetachedModeRoot: () => freshRoot,
    requireModeRoot() {
      return this.modeRoot;
    },
    requireMusic: () => music,
    requirePausePresenter() {
      return this.pausePresenter;
    },
    requireSceneController() {
      return this.gnStyleSceneController;
    },
    requireScreenPlacement: () => placement,
    requireTimerAudio: () => timerAudio,
    restoreActivationObjective() {},
    restorePauseOwnershipAfterNavigationRollback(snapshot: unknown) {
      return restore.call(this, snapshot as Record<string, boolean>);
    },
    restoreRetainedSwishCooldown() {},
    retainFatalLifecycleBoundary(error: unknown) {
      this.lifecycleFatalError ??= error;
    },
    stopAllRunEffects() {
      classicAudio.stopAllEffects();
      timerAudio.stopAllEffects();
    },
    unschedule() {},
    updateScorePresentation() {},
  };
  return {
    classicAudio,
    controller,
    emptyOwnership,
    freshOwnership,
    freshParticle,
    freshRoot,
    freshScene,
    host,
    music,
    freshPause,
    oldOwnership,
    oldPause,
    oldParticle,
    oldRoot,
    oldScene,
    placement,
    timerAudio,
    initializePauseCalls: () => initializePauseCalls,
  };
}

function createGnStyleRetryHarness(
  failure: 'activation' | 'post-commit',
) {
  const host = { name: 'CurrentScreenHost' };
  const resultRoot = {
    destroyCalls: 0,
    destroyed: false,
    name: 'result',
    parent: host as object | null,
    destroy() {
      this.destroyCalls += 1;
      this.destroyed = true;
    },
  };
  const freshRoot = {
    destroyed: false,
    name: 'fresh',
    parent: null as object | null,
  };
  const placement = {
    currentScreen: resultRoot as
      | typeof freshRoot
      | typeof resultRoot
      | null,
    attachCurrentScreen(root: typeof freshRoot | typeof resultRoot) {
      assert.equal(this.currentScreen, null);
      assert.equal(root.parent, null);
      root.parent = host;
      this.currentScreen = root;
    },
    detachCurrentScreen(root: typeof freshRoot | typeof resultRoot) {
      assert.equal(this.currentScreen, root);
      root.parent = null;
      this.currentScreen = null;
      return root;
    },
  };
  const presenter = {
    disposeCalls: 0,
    rearmCalls: 0,
    state: { navigation: 'retry' },
    dispose() {
      this.disposeCalls += 1;
      if (failure === 'post-commit') {
        throw new Error('injected committed Result disposal failure');
      }
    },
    rearmNavigationAfterFailure(route: string) {
      assert.equal(route, 'retry');
      this.rearmCalls += 1;
      this.state.navigation = 'none';
      return true;
    },
  };
  const scene = {
    active: false,
    readyForActivation: true,
    suspended: false,
    releaseGnStyleLayerForReplacement() {
      this.active = false;
      this.readyForActivation = true;
    },
    suspendGnStyleLayerForNavigation() {
      this.active = false;
      this.suspended = true;
    },
  };
  const freshParticle = {
    disposed: false,
    state: { paused: false },
  };
  const emptyOwnership = {
    id: 'empty',
    modeRoot: null,
    particlePresenter: null,
  };
  const freshOwnership = {
    id: 'fresh',
    modeRoot: freshRoot,
    particlePresenter: freshParticle as typeof freshParticle | null,
  };
  let ownership: typeof emptyOwnership | typeof freshOwnership
    = emptyOwnership;
  let objectiveValue = 9;
  const controller: Record<string, any> = {
    currentOwnership: emptyOwnership,
    lifecycleFatalError: null,
    modeRoot: null,
    particlePresenter: null,
    pendingResultConfiguration: { mode: 2, score: 91 },
    resultPresentationRoot: resultRoot,
    resultPresenter: presenter,
    attachModeAndActivateScene(targetPlacement: typeof placement) {
      targetPlacement.attachCurrentScreen(freshRoot);
      objectiveValue = 0;
      scene.active = true;
      scene.readyForActivation = false;
      if (failure === 'activation') {
        throw new Error('injected fresh GN physics activation failure');
      }
    },
    captureActivationObjectiveRollback() {
      return { objectiveId: 48, value: objectiveValue };
    },
    configuredResult: () => ({ mode: 2, score: 91 }),
    constructMode() {
      ownership = freshOwnership;
      this.currentOwnership = freshOwnership;
      this.modeRoot = freshRoot;
      this.particlePresenter = freshParticle;
      this.pendingResultConfiguration = null;
    },
    disposeModePresentation() {
      if (placement.currentScreen === freshRoot) {
        placement.detachCurrentScreen(freshRoot);
      }
      freshParticle.disposed = true;
      freshOwnership.particlePresenter = null;
      ownership = emptyOwnership;
      this.currentOwnership = emptyOwnership;
      this.modeRoot = null;
      this.particlePresenter = null;
    },
    drainRetiredRuns() {},
    effectsEnabled: () => true,
    emitCommand() {},
    emitSnapshot() {
      if (failure === 'post-commit') {
        throw new Error('injected committed Retry snapshot observer failure');
      }
    },
    quiesceSceneAfterFailedRelease(
      target: typeof scene,
      _label: string,
      failures: unknown[],
    ) {
      if (target.active) {
        collectExecutableCleanupFailure(
          failures,
          () => target.releaseGnStyleLayerForReplacement(),
        );
      }
      if (target.active) {
        failures.push(new Error('retained fresh input/physics lease'));
      }
    },
    requireAttachedResultRoot: () => resultRoot,
    requireClassicGameplayController: () => ({
      sharedAudioPresenter: { playOneShot() {} },
    }),
    requireResultPresenter: () => presenter,
    requireSceneController: () => scene,
    requireScreenPlacement: () => placement,
    restoreActivationObjective(rollback: Readonly<{ value: number }>) {
      objectiveValue = rollback.value;
    },
    retainFatalLifecycleBoundary(error: unknown) {
      this.lifecycleFatalError ??= error;
    },
  };
  return {
    controller,
    emptyOwnership,
    freshOwnership,
    freshParticle,
    freshRoot,
    host,
    objectiveValue: () => objectiveValue,
    placement,
    presenter,
    resultRoot,
    scene,
  };
}
