import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SOURCE = readFileSync(
  `${REPOSITORY_ROOT}/game/assets/scripts/creator/crazy-gameplay-controller.ts`,
  'utf8',
);
const TEST_CRAZY_PROFILE = Object.freeze({
  kind: 'crazy',
  mode: 1,
});
const TEST_CRAZY_BIRD_PROFILE = Object.freeze({
  kind: 'crazy-bird',
  mode: 4,
});

test('Crazy gameplay is a passive serialized owner of the existing Crazy scene', () => {
  assert.match(SOURCE, /@ccclass\('CrazyGameplayController'\)/);
  assert.match(SOURCE, /@requireComponent\(CrazySceneController\)/);

  const onLoad = extractMethod(SOURCE, 'onLoad');
  assert.match(onLoad, /this\.getComponent\(CrazySceneController\)/);
  assert.match(onLoad, /this\.getComponent\(ClassicGameplayController\)/);
  assert.match(onLoad, /this\.getComponent\(ClassicSceneController\)/);

  const start = extractMethod(SOURCE, 'start');
  assert.match(start, /this\.emitSnapshot\(\)/);
  assert.doesNotMatch(start, /prepare|activate|attach|loadCrazy|CrazyAudioPresenter/);

  const update = extractMethod(SOURCE, 'update');
  assert.match(
    update,
    /pendingResultEntryTransaction === null[\s\S]*?resultPresenter\?\.updateAction\(deltaSeconds\)/,
  );
  assertOrderedSubstrings(update, [
    'this.resultPresenter?.updateAction(deltaSeconds)',
    'if (!this.isCrazyGameplayAttached())',
    "cutDriver?.kind === 'standard'",
    'cutDriver.presenter.updateFrame()',
  ]);
});

test('preparation reuses Classic process services and leaves failed attempts retryable', () => {
  const prepare = extractMethod(SOURCE, 'prepareCrazyRuntime');
  assertOrderedSubstrings(prepare, [
    "this.readinessStatus = 'pending'",
    'const attempt = this.initializeCrazyPreparation()',
    'this.preparation = attempt',
    'void attempt.catch',
    'this.preparation = null',
    "this.readinessStatus = 'failed'",
    'CRAZY_RESOURCE_LOAD_FAILED_EVENT',
  ]);

  const initialize = extractMethod(SOURCE, 'initializeCrazyPreparation');
  assertOrderedSubstrings(initialize, [
    'await classic.prepareRecoveredRuntime()',
    'const classicCatalog = classic.sharedResourceCatalog',
    'const [resources, dragonFont, baseGameplayResources] = await Promise.all([',
    'loadCrazyResources(classicCatalog.assetTree)',
    'loadCrazyDragonFont()',
    'loadBaseGameplayResources(classicCatalog.assetTree)',
    'const audio = await CrazyAudioPresenter.load(this.node)',
    'this.commitCrazyPreparation(products)',
  ]);
  assert.match(initialize, /if \(!committed\)[\s\S]*?audio\.stop\(\)/);
  assert.match(initialize, /destroyNamedChild\(this\.node, 'CrazyAudioRoot'\)/);

  const commit = extractMethod(SOURCE, 'commitCrazyPreparation');
  assertOrderedSubstrings(commit, [
    "new Node('ObjectiveAchievementTargetRoot')",
    'this.sharedSettingsRuntime.createObjectivesManager(',
    'this.audioPresenter = products.audio',
    'this.baseGameplayResources = products.baseGameplayResources',
    'this.crazyResources = products.resources',
    'this.dragonFont = products.dragonFont',
    'this.objectiveAchievementTargetRoot = objectiveTarget',
    'this.objectivesManager = objectivesManager',
    "this.readinessStatus = 'ready'",
  ]);
});

test('activation constructs detached state and commits only through an empty screen host', () => {
  const defaultEntry = extractMethod(SOURCE, 'activateCrazyFromAppShell');
  assert.match(
    defaultEntry,
    /this\.activateTimedModeFromAppShell\(screenPlacement, CRAZY_TIMED_PROFILE\)/,
  );
  const activation = extractMethod(SOURCE, 'activateTimedModeFromAppShell');
  assertOrderedSubstrings(activation, [
    'const readiness = profile === CRAZY_BIRD_TIMED_PROFILE',
    "if (readiness !== 'ready')",
    'this.drainRetiredCrazyRunOwnership()',
    'screenPlacement.currentScreen !== null',
    'this.screenPlacement = screenPlacement',
    'this.constructCrazyMode(profile)',
    'this.captureCrazyActivationObjectiveRollback()',
    'this.attachCrazyModeAndActivateScene(screenPlacement, profile)',
    'this.updateScorePresentation()',
  ]);
  assert.match(
    activation,
    /catch \(error\)[\s\S]*?this\.disposeCrazyModePresentation\(\)[\s\S]*?this\.restoreCrazyActivationObjective\(retainedObjectiveRollback\)[\s\S]*?this\.screenPlacement = retainedPlacement/,
  );

  const construct = extractMethod(SOURCE, 'constructCrazyMode');
  assertOrderedSubstrings(construct, [
    'const root = createDetachedScreenRoot(',
    "profile === CRAZY_BIRD_TIMED_PROFILE ? 'CrazyBirdModeRoot' : 'CrazyModeRoot'",
    'this.runProfile = profile',
    'this.registry = new CrazyEntityRegistry({',
    'this.coordinator = new CrazyTossCoordinator({',
    'this.createCorePresentation(',
  ]);
  assert.match(construct, /const random = classic\.sharedGameplayRandom/);
  assert.match(construct, /const settings = classic\.sharedSettingsRuntime/);
  assert.match(construct, /const classicCatalog = classic\.sharedResourceCatalog/);

  const attach = extractMethod(SOURCE, 'attachCrazyModeAndActivateScene');
  assertOrderedSubstrings(attach, [
    'screenPlacement.attachCurrentScreen(root)',
    'screenPlacement.currentScreen !== root',
    'const scene = this.requireCrazySceneController()',
    'scene.activateCrazyLayer(best)',
    'scene.sessionSnapshot().mode !== profile.mode',
    'scene.timedModeProfile !== profile',
  ]);
});

test('the coordinator registry bridge preserves complete spawn batches and retained Dragon work', () => {
  const coordinator = extractMemberBlock(
    SOURCE,
    '  private readonly onCoordinatorCommands = (',
  );
  assertOrderedSubstrings(coordinator, [
    'this.emitCommands(commands)',
    'partitionCrazyRuntimeCommands(commands)',
    'this.applyCoordinatorBatch(batch)',
    'this.emitSnapshot()',
  ]);

  const batch = extractMethod(SOURCE, 'applyCoordinatorBatch');
  assert.match(batch, /case 'classic-spawn':[\s\S]*?applyClassicSpawnPlan\(/);
  assert.match(batch, /case 'bonus-spawn':[\s\S]*?applyBonusSpawnBatch\(/);
  assert.match(batch, /case 'control':[\s\S]*?applyCoordinatorControl\(/);

  const update = extractMethod(SOURCE, 'update');
  const physics = extractMemberBlock(
    SOURCE,
    '  private readonly onPhysicsStepped = (',
  );
  assert.match(update, /this\.registry\?\.updateDragonEffectsAction\(deltaSeconds\)/);
  assert.match(physics, /registry\.updateDragonEffectsPhysics\(viewport\)/);
  assert.doesNotMatch(SOURCE, /new (?:GameplayRandom|SeededGameplayRandom)/);
});

test('post-physics cutting uses ordered bidirectional rays and one registry batch boundary', () => {
  const physics = extractMemberBlock(
    SOURCE,
    '  private readonly onPhysicsStepped = (',
  );
  assertOrderedSubstrings(physics, [
    'registry.runRayQueryCutBatch(() =>',
    'buildBidirectionalRayPlan({',
    '.raycastAll(plan.forward.start, plan.forward.end)',
    '.raycastAll(plan.reverse.start, plan.reverse.end)',
    'createCutDispatchCommands(',
    'this.requireCombo().checkCombo(command.position)',
    'registry.cut(command.targetId, command.segment)',
    'registry.evaluateBounds(viewport)',
    'registry.updateDragonEffectsPhysics(viewport)',
  ]);
  assert.match(physics, /presenter\.evaluateBounds\(viewport\)/);
  assert.match(physics, /this\.emitCriticalParticlesForCutHalves\(presenter\)/);
});

test('ordinary, special, timer, electric, magnet, and HUD paths reuse recovered presenters', () => {
  for (const dependency of [
    'ClassicBladePresenter',
    'ComboItemPresenter',
    'ClassicCriticalParticlePresenter',
    'ClassicCutHalfPresenter',
    'ClassicResultPresenter',
    'ClassicScoreHudPresenter',
    'CrazyBombElectricPresenter',
    'CrazyIntroPresenter',
    'CrazyMagnetPresenter',
    'StandardBombFuseSmokePresenter',
    'TimeManagerPresenter',
  ]) {
    assert.match(SOURCE, new RegExp(`\\b${dependency}\\b`));
  }

  const fruitCommands = extractMethod(SOURCE, 'applyFruitCutCommands');
  assert.match(
    fruitCommands,
    /case 'enable-double-score':[\s\S]*?enableDoubleScore\(\)/,
  );
  assert.match(
    fruitCommands,
    /case 'start-double-toss':[\s\S]*?startController\('b4'\)/,
  );
  assert.match(fruitCommands, /case 'freeze-time':[\s\S]*?\.freeze\(\)/);
  assert.match(
    fruitCommands,
    /case 'start-electric-bomb':[\s\S]*?\.start\(\)/,
  );
  assert.match(
    fruitCommands,
    /case 'create-magnet-animation':[\s\S]*?createMagnetPresenter/,
  );
  assert.match(fruitCommands, /case 'add-score':[\s\S]*?addScore\(command\.value\)/);
});

test('shared combo batches preserve objective, popup, score, attachment, and audio consumers', () => {
  const applyCombo = extractMethod(SOURCE, 'applyComboCommands');
  assertOrderedSubstrings(applyCombo, [
    'combo.assertPendingUpdate(commands)',
    'applyComboCommandBatch(commands, {',
    "case 'process-objective':",
    'this.requireObjectivesManager().processGameEvent(',
    "case 'create-combo-item':",
    'fontResource: classic.sharedResourceCatalog.comboFont',
    'position: command.position',
    "case 'add-score':",
    'this.requireCrazySceneController().addScore(command.value)',
    "case 'attach-combo-item':",
    'presenter.attach(this.requireWorldPresentationRoot())',
    'this.comboItemPresenters.add(presenter)',
    "case 'play-combo-sound':",
    "case 'reset-combo':",
    'combo.commitPendingUpdate(commands)',
  ]);
  assert.match(
    applyCombo,
    /let pendingPresenter: ComboItemPresenter \| null = null[\s\S]*?finalize: \(\) => \{[\s\S]*?const presenter = pendingPresenter[\s\S]*?pendingPresenter = null[\s\S]*?presenter\?\.dispose\(\)/,
  );
  assert.match(
    applyCombo,
    /publish: \(command\) => \{[\s\S]*?this\.emitCommand\(command\)/,
  );
  assert.doesNotMatch(applyCombo, /this\.emitCommands\(commands\)/);
  assert.match(
    SOURCE,
    /for \(const presenter of \[\.\.\.this\.comboItemPresenters\]\)[\s\S]*?presenter\.updateAction\(deltaSeconds\)/,
  );
  assert.match(
    SOURCE,
    /readonly comboItemPresenters: Set<ComboItemPresenter>/,
  );
  assert.match(
    SOURCE,
    /comboItemPresenters: new Set<ComboItemPresenter>\(\)/,
  );
  assert.match(
    SOURCE,
    /this\.comboItemPresenters = ownership\.comboItemPresenters/,
  );
});

test('a standard bomb cut holds only its entity and never requests a global world stop', () => {
  const beforeFreeze = extractMemberBlock(
    SOURCE,
    '  private readonly onBeforeBombFreeze = (',
  );
  const bombCut = extractMemberBlock(
    SOURCE,
    '  private readonly onStandardBombCut = (',
  );
  const completion = extractMethod(SOURCE, 'drainFinishedStandardBombExplosions');
  const construct = extractMethod(SOURCE, 'constructCrazyMode');
  const entryEffects = extractMemberBlock(
    SOURCE,
    '  private readonly startStandardBombAfterAttachment = (',
  );
  const entityDisposed = extractMemberBlock(
    SOURCE,
    '  private readonly onEntityDisposed = (',
  );
  const tossAudio = extractMemberBlock(
    SOURCE,
    '  private readonly onPlayTossSound = (',
  );
  const update = extractMethod(SOURCE, 'update');

  assert.match(
    tossAudio,
    /sharedAudioPresenter\.playOneShot\(sound\)/,
  );
  assert.doesNotMatch(
    tossAudio,
    /playRetained|boomsound|effectsEnabled|standardBombSpawnTargetId/,
  );
  assertOrderedSubstrings(construct, [
    'onPlayTossSound: this.onPlayTossSound',
    'onStandardBombAttached: this.startStandardBombAfterAttachment',
  ]);
  assertOrderedSubstrings(entryEffects, [
    '!bomb.attached',
    'this.effectsEnabled()',
    'sharedAudioPresenter.playRetained(',
    "getClassicOrdinaryBombAudioPath('entry')",
    'StandardBombFuseSmokePresenter.create({',
    'random: this.sharedGameplayRandom',
    '.sharedResourceCatalog.bombSmoke',
    'this.standardBombFuseSmokePresenters.set(targetId, smokePresenter)',
  ]);
  assert.match(
    entryEffects,
    /catch \(error\)[\s\S]*?rollbackPresenter\.dispose\(\)[\s\S]*?disposeStandardBombEntryAudio\(targetId\)/,
  );
  assert.doesNotMatch(entryEffects, /bombTossAudioRequested|queueDispose/);
  assert.match(
    beforeFreeze,
    /this\.effectsEnabled\(\)[\s\S]*?standardBombEntryAudioHandles\.get\(event\.targetId\)\?\.stop\(\)/,
  );
  assert.match(beforeFreeze, /this\.stopStandardBombFuseSmoke\(event\.targetId\)/);
  assert.match(beforeFreeze, /type: 'standard-bomb-hold-begin'/);
  assertOrderedSubstrings(entityDisposed, [
    'this.stopStandardBombFuseSmoke(event.targetId)',
    'this.disposeStandardBombEntryAudio(event.targetId)',
  ]);
  assertOrderedSubstrings(bombCut, [
    'const completion = new StandardBombExplosionCompletion()',
    'StandardBombExplosionPresenter.create({',
    'random: this.sharedGameplayRandom',
    'completion.markNaturalFinish()',
    'presenter.attach(this.requireWorldPresentationRoot(), 1)',
    'this.standardBombExplosionOwners.set(event.targetId, owner)',
    'this.requireCrazySceneController().bombHit(event.worldPosition)',
    "getClassicOrdinaryBombAudioPath('explosion')",
  ]);
  assertOrderedSubstrings(bombCut, [
    'const bombHitNeedsRecovery = bombHitApplied',
    'sessionSnapshot().cutEnabled',
    'if (bombHitNeedsRecovery)',
    'this.requireCrazySceneController().afterBombHit()',
  ]);
  assertOrderedSubstrings(completion, [
    'owner.completion.drain({',
    'afterBombHit: () => this.requireCrazySceneController().afterBombHit()',
    'finishBombAfterHit: () => this.requireRegistry()',
    '.finishBombAfterHit(targetId)',
    'isBombDisposalCommitted: () => !this.requireRegistry()',
    '.hasTarget(targetId)',
    'this.standardBombExplosionOwners.delete(targetId)',
  ]);
  assert.match(
    update,
    /this\.standardBombExplosionOwners\.values\(\)[\s\S]*?owner\.presenter\.updateAction\(deltaSeconds\)[\s\S]*?this\.drainFinishedStandardBombExplosions\(\)/,
  );
  assert.match(
    update,
    /this\.standardBombFuseSmokePresenters[\s\S]*?presenter\.updateAction\(deltaSeconds\)[\s\S]*?presenter\.snapshot\(\)\.drained[\s\S]*?presenter\.dispose\(\)[\s\S]*?standardBombFuseSmokePresenters\.delete\(targetId\)/,
  );
  assert.doesNotMatch(SOURCE, /standardBombSpawnTargetId|bombTossAudioRequested/);
  assert.doesNotMatch(SOURCE, /pendingStandardBombs|finishStandardBombExplosion/);
  assert.doesNotMatch(SOURCE, /setWorldStopped|set-physics-stopped|freezeWorld\(\).*Bomb/);

  const entryAudioCleanup = extractMethod(SOURCE, 'disposeStandardBombEntryAudio');
  assertOrderedSubstrings(entryAudioCleanup, [
    'handle.dispose()',
    'this.standardBombEntryAudioHandles.get(targetId) === handle',
    'this.standardBombEntryAudioHandles.delete(targetId)',
  ]);
});

test('Time Up constructs mode-1 Result with ranking, reward, Retry rollback, and menu transaction', () => {
  const sessionBridge = extractMemberBlock(
    SOURCE,
    '  private readonly onSessionCommand = (',
  );
  assertOrderedSubstrings(sessionBridge, [
    "case 'capture-crazy-parent':",
    'this.captureCrazyForResult()',
    "case 'construct-result':",
    'this.beginResultConstruction()',
    "case 'set-result-mode':",
    'this.setPendingResultMode(command.mode)',
    "case 'set-result-score':",
    'this.setPendingResultScore(command.score)',
    "case 'remove-crazy':",
    'this.detachCrazyForResult(command.cleanup)',
    "case 'attach-result':",
    'this.attachCrazyResult(command.zOrder)',
  ]);

  const capture = extractMethod(SOURCE, 'captureCrazyForResult');
  assertOrderedSubstrings(capture, [
    'this.pendingCapturedCrazyRoot = root',
    'this.pendingResultEntryTransaction = transaction',
    'prepareCommit: () => this.prepareCrazyResultCommit(transaction)',
    'enlistTimeUpFinishParticipant(participant)',
  ]);
  assert.doesNotMatch(capture, /disposeActivePhysicsPresentations/);

  const result = extractMethod(SOURCE, 'attachCrazyResult');
  assertOrderedSubstrings(result, [
    'insertCrazyResultScore(',
    'crazyLeaderboardPanelValues(ranking.leaderboard)',
    'ClassicResultPresenter.create({',
    '      panelValues,',
    "createDetachedScreenRoot('CrazyResultPresentationRoot', this.node)",
    'this.resultPresentationRoot = root',
    'this.resultPresenter = presenter',
    'this.requireScreenPlacement().attachCurrentScreen(root)',
    'presenter.attach(root)',
  ]);
  assert.doesNotMatch(result, /recordCrazyResultScore|disposeCrazyModePresentation/);

  const prepare = extractMethod(SOURCE, 'prepareCrazyResultCommit');
  assertOrderedSubstrings(prepare, [
    'const configured = this.configuredResult()',
    'this.pendingResultEntryTransaction !== transaction',
    'this.resultPresentationRoot !== resultRoot',
    'this.resultPresenter !== resultPresenter',
    'this.requireScreenPlacement().currentScreen !== resultRoot',
    "transaction.status = 'prepared'",
  ]);

  const commit = extractMethod(SOURCE, 'commitCrazyResultTransition');
  assertOrderedSubstrings(commit, [
    'this.sharedSettingsRuntime.state.recordCrazyResultScore(configured.score)',
    "transaction.status = 'committed'",
    'this.disposeCrazyModePresentation()',
    'this.retiredCrazyRuns.push',
    'this.installCrazyRunOwnership(this.createEmptyCrazyRunOwnership())',
    'this.pendingResultConfiguration = retainedResultConfiguration',
  ]);
  assert.match(
    commit,
    /reportCleanupFailures\('Committed Crazy-to-Result cleanup'/,
  );

  const rollback = extractMethod(SOURCE, 'rollbackCrazyResultTransition');
  assertOrderedSubstrings(rollback, [
    'placement.detachCurrentScreen(resultRoot)',
    'placement.attachCurrentScreen(transaction.crazyRoot)',
    'this.resultPresentationRoot = null',
    'this.resultPresenter = null',
    'this.pendingCapturedCrazyRoot = null',
    'this.pendingResultConfiguration = null',
    'this.pendingResultEntryTransaction = null',
    "transaction.status = 'rolled-back'",
  ]);
  assert.match(
    rollback,
    /resultPresenter\.dispose\(\)[\s\S]*?resultRoot\.destroy\(\)/,
  );

  const reward = extractMemberBlock(
    SOURCE,
    '  private readonly onResultTotalCoinsEntranceComplete = ()',
  );
  assert.match(
    reward,
    /pendingResultEntryTransaction !== null[\s\S]*?reward cannot commit before Time-Up Finish/,
  );
  assert.match(reward, /awardCrazyResultCoins\(configured\.score\)/);
  assert.match(reward, /CRAZY_RESULT_REWARD_READY_EVENT/);

  const retry = extractMethod(SOURCE, 'restartCrazyFromResult');
  assert.match(retry, /createCrazyResultNavigationCommands\(/);
  assertOrderedSubstrings(retry, [
    'this.drainRetiredCrazyRunOwnership()',
    "case 'capture-result-parent':",
    "case 'remove-result':",
    "case 'construct-crazy':",
    'this.constructCrazyMode(configured.profile)',
    "case 'attach-crazy-to-captured-parent':",
    'this.attachCrazyModeAndActivateScene(placement, configured.profile)',
  ]);
  assert.match(
    retry,
    /catch \(error\)[\s\S]*?disposeCrazyModePresentation\(\)[\s\S]*?restoreCrazyActivationObjective\(retainedObjectiveRollback\)[\s\S]*?attachCurrentScreen\(resultRoot\)[\s\S]*?rearmNavigationAfterFailure\('retry'\)/,
  );
  assert.match(
    retry,
    /catch \(error\)[\s\S]*?this\.pendingResultConfiguration = retainedResultConfiguration/,
  );

  const menu = extractMemberBlock(SOURCE, '  private readonly onResultMenu = ()');
  assertOrderedSubstrings(menu, [
    'const presenter = this.requireResultPresenter()',
    'let transaction: CrazyResultMenuTransaction | null = null',
    "route: 'main-menu'",
    'transaction = activeTransaction',
    "command.type === 'request-menu-button-audio'",
    'CRAZY_RESULT_MENU_REQUESTED_EVENT',
    '} catch (error) {',
    "presenter.rearmNavigationAfterFailure('menu')",
    "transaction.status === 'pending'",
  ]);
  assert.match(menu, /commit: \(previousRoot: Node\)/);
  assert.match(menu, /rollback: \(\)/);
  assert.match(
    menu,
    /catch \(rollbackError\)[\s\S]*?new CrazyLifecycleRollbackError\([\s\S]*?this\.retainFatalLifecycleBoundary\(failure\)/,
  );
});

test('committed Result retires failed Crazy cleanup without blocking a later drain', () => {
  const cleanupReports: unknown[][] = [];
  const dependencies = replayDependencies(cleanupReports);
  const commit = compileSourceMethod<
    (this: Record<string, any>, transaction: Record<string, any>) => void
  >('commitCrazyResultTransition', dependencies);
  const drain = compileSourceMethod<
    (this: Record<string, any>) => void
  >('drainRetiredCrazyRunOwnership', dependencies);
  const host = {};
  const crazyRoot = { name: 'crazy', parent: null };
  const resultRoot = { name: 'result', parent: host };
  const resultPresenter = {};
  const scene = {};
  const remainingRoot = { name: 'retired-crazy', parent: null };
  const transaction = {
    configuration: { mode: 1, profile: TEST_CRAZY_PROFILE, score: 321 },
    crazyRoot,
    profile: TEST_CRAZY_PROFILE,
    presenter: resultPresenter,
    root: resultRoot,
    status: 'prepared',
  };
  let cleanupAttempts = 0;
  let failCleanup = true;
  let scoreRecords = 0;
  const controller: Record<string, any> = {
    crazyModeRoot: crazyRoot,
    crazySceneController: scene,
    pendingCapturedCrazyRoot: crazyRoot,
    pendingResultConfiguration: {
      mode: 1,
      profile: TEST_CRAZY_PROFILE,
      score: 321,
    },
    pendingResultEntryTransaction: transaction,
    resultPresentationRoot: resultRoot,
    resultPresenter,
    retiredCrazyRuns: [],
    sharedSettingsRuntime: {
      state: {
        recordCrazyResultScore(score: number) {
          assert.equal(score, 321);
          scoreRecords += 1;
        },
      },
    },
    captureCrazyRunOwnership() {
      return {
        crazyModeRoot: this.crazyModeRoot,
        pendingCapturedCrazyRoot: this.pendingCapturedCrazyRoot,
        pendingResultConfiguration: this.pendingResultConfiguration,
      };
    },
    configuredResult() {
      return { mode: 1, profile: TEST_CRAZY_PROFILE, score: 321 };
    },
    createEmptyCrazyRunOwnership() {
      return {
        crazyModeRoot: null,
        pendingCapturedCrazyRoot: null,
        pendingResultConfiguration: null,
      };
    },
    disposeCrazyModePresentation() {
      cleanupAttempts += 1;
      if (failCleanup) {
        this.crazyModeRoot = remainingRoot;
        throw new Error('injected committed Crazy cleanup failure');
      }
      this.crazyModeRoot = null;
    },
    emitSnapshot() {},
    installCrazyRunOwnership(ownership: Record<string, any>) {
      this.crazyModeRoot = ownership.crazyModeRoot;
      this.pendingCapturedCrazyRoot = ownership.pendingCapturedCrazyRoot;
      this.pendingResultConfiguration = ownership.pendingResultConfiguration;
    },
    requireCrazySceneController() {
      return this.crazySceneController;
    },
    requireScreenPlacement() {
      return { currentScreen: resultRoot };
    },
  };

  commit.call(controller, transaction);
  commit.call(controller, transaction);
  assert.equal(scoreRecords, 1);
  assert.equal(cleanupAttempts, 1);
  assert.equal(transaction.status, 'committed');
  assert.equal(controller.pendingResultEntryTransaction, null);
  assert.equal(controller.crazyModeRoot, null);
  assert.deepEqual(controller.pendingResultConfiguration, {
    mode: 1,
    profile: TEST_CRAZY_PROFILE,
    score: 321,
  });
  assert.equal(controller.resultPresentationRoot, resultRoot);
  assert.equal(controller.resultPresenter, resultPresenter);
  assert.equal(controller.retiredCrazyRuns.length, 1);
  assert.equal(
    controller.retiredCrazyRuns[0].ownership.pendingCapturedCrazyRoot,
    null,
  );
  assert.equal(
    controller.retiredCrazyRuns[0].ownership.pendingResultConfiguration,
    null,
  );
  assert.equal(cleanupReports.length, 1);

  failCleanup = false;
  drain.call(controller);
  assert.equal(cleanupAttempts, 2);
  assert.equal(controller.retiredCrazyRuns.length, 0);
  assert.equal(controller.crazyModeRoot, null);
  assert.deepEqual(controller.pendingResultConfiguration, {
    mode: 1,
    profile: TEST_CRAZY_PROFILE,
    score: 321,
  });
  assert.equal(controller.resultPresentationRoot, resultRoot);
});

test('shared pause and objective owners preserve Crazy callback and navigation order', () => {
  const sessionBridge = extractMemberBlock(
    SOURCE,
    '  private readonly onSessionCommand = (',
  );
  assert.match(
    sessionBridge,
    /case 'process-objective':[\s\S]*?processGameEvent\([\s\S]*?command\.eventId,[\s\S]*?command\.state/,
  );
  assert.match(
    sessionBridge,
    /case 'initialize-pause-ui':[\s\S]*?this\.initializePausePresentation\(\)/,
  );

  const pause = extractMemberBlock(
    SOURCE,
    '  private readonly onPauseRequested = ()',
  );
  assertOrderedSubstrings(pause, [
    'this.requirePausePresenter().pauseIngress(this.currentPauseCard())',
    'playOneShot(CLASSIC_MENU_BUTTON_AUDIO_PATH)',
    '.sharedAudioPresenter.pauseAllEffects()',
    'this.requireCrazyAudioPresenter().pauseAllEffects()',
    '.sharedAudioPresenter.pauseBackgroundMusic()',
    'this.requireCrazyAudioPresenter().pauseBackgroundMusic()',
  ]);

  const resume = extractMemberBlock(
    SOURCE,
    '  private readonly onResumeRequested = ()',
  );
  assertOrderedSubstrings(resume, [
    'this.requirePausePresenter().resumeEgress()',
    'playOneShot(CLASSIC_MENU_BUTTON_AUDIO_PATH)',
    '.sharedAudioPresenter.resumeAllEffects()',
    'this.requireCrazyAudioPresenter().resumeAllEffects()',
  ]);
  assert.doesNotMatch(resume, /resumeBackgroundMusic/);

  const replay = extractMethod(SOURCE, 'restartCrazyFromPause');
  assertOrderedSubstrings(replay, [
    'oldScene.suspendCrazyLayerForNavigation()',
    'this.acquireStandbyCrazySceneController(oldScene)',
    'this.installCrazyRunOwnership(this.createEmptyCrazyRunOwnership())',
    'this.constructCrazyMode(profile)',
    '.sharedAudioPresenter.stopBackgroundMusic()',
    'this.requireCrazyAudioPresenter().stopBackgroundMusic()',
    '.sharedAudioPresenter.stopAllEffects()',
    'this.requireCrazyAudioPresenter().stopAllEffects()',
    'pause.resumeEgress()',
    'pause.stopAllActions()',
    'placement.replaceCurrentScreen(freshRoot)',
    'this.captureCrazyActivationObjectiveRollback()',
    'freshScene.activateCrazyLayer(best)',
    'freshScene.sessionSnapshot().mode !== profile.mode',
    'this.updateScorePresentation()',
    'oldScene.finalizeSuspendedCrazyLayerRelease()',
  ]);
  const committedReplay = replay.slice(replay.indexOf('const freshOwnership'));
  assertOrderedSubstrings(committedReplay, [
    'this.installCrazyRunOwnership(oldOwnership)',
    'this.disposeCrazyModePresentation()',
    'this.installCrazyRunOwnership(freshOwnership)',
    'this.standbyCrazySceneController = oldScene',
    'playOneShot(',
  ]);
  assert.match(
    replay,
    /catch \(error\)[\s\S]*?freshScene\.releaseCrazyLayerForReplacement\(\)[\s\S]*?placement\.replaceCurrentScreen\(oldRoot\)[\s\S]*?this\.disposeCrazyModePresentation\(\)[\s\S]*?this\.retiredCrazyRuns\.push\([\s\S]*?this\.restoreCrazyActivationObjective\(retainedObjectiveRollback\)[\s\S]*?this\.installCrazyRunOwnership\(oldOwnership\)[\s\S]*?oldScene\.resumeSuspendedCrazyLayer\(\)[\s\S]*?pause\.pauseIngress/,
  );
  assert.match(
    replay,
    /this\.standbyCrazySceneController = oldScene/,
  );

  const quit = extractMemberBlock(
    SOURCE,
    '  private readonly onPauseQuitRequested = ()',
  );
  assertOrderedSubstrings(quit, [
    'pause.resumeEgress()',
    'pause.stopAllActions()',
    'this.requireCrazySceneController().suspendCrazyLayerForNavigation()',
    'CRAZY_PAUSE_QUIT_REQUESTED_EVENT',
    "transaction.status === 'pending'",
  ]);
  assert.match(
    quit,
    /catch \(error\)[\s\S]*?pause\.pauseIngress\(this\.currentPauseCard\(\)\)/,
  );
  assert.match(
    quit,
    /try \{[\s\S]*?this\.node\.emit\([\s\S]*?CRAZY_PAUSE_QUIT_REQUESTED_EVENT[\s\S]*?payload,[\s\S]*?finally \{[\s\S]*?if \(transaction\.status === 'pending'\)[\s\S]*?this\.rollbackPauseQuit\(transaction\)/,
  );
  const quitCommit = extractMethod(SOURCE, 'commitPauseQuit');
  assertOrderedSubstrings(quitCommit, [
    'finalizeSuspendedCrazyLayerRelease()',
    "transaction.status = 'committed'",
    'this.disposeCrazyModePresentation()',
    'this.retiredCrazyRuns.push(',
    'this.installCrazyRunOwnership(this.createEmptyCrazyRunOwnership())',
    'playOneShot(CLASSIC_MENU_BUTTON_AUDIO_PATH)',
  ]);
  const quitRollback = extractMethod(SOURCE, 'rollbackPauseQuit');
  assertOrderedSubstrings(quitRollback, [
    'transaction.screenPlacement.replaceCurrentScreen(transaction.root)',
    'this.requireCrazySceneController().resumeSuspendedCrazyLayer()',
    'transaction.presenter.pauseIngress(this.currentPauseCard())',
    "transaction.status = 'rolled-back'",
  ]);

  const objective = extractMemberBlock(
    SOURCE,
    '  private readonly onObjectiveAchievement = (',
  );
  assertOrderedSubstrings(objective, [
    'playOneShot(',
    'CLASSIC_OBJECTIVE_CHEER_AUDIO_PATH',
    'ObjectiveAchievementPresenter.create({',
    'presenter.attach(this.requireObjectiveAchievementTargetRoot())',
    'this.objectiveAchievementPresenters.add(presenter)',
  ]);
});

test('initial activation and Result Retry restore objectives 46/50 after partial entry failure', () => {
  const activate = compileSourceMethod<
    (this: Record<string, any>, placement: any, profile: object) => void
  >(
    'activateTimedModeFromAppShell',
    transactionDependencies(),
  );
  const retry = compileSourceMethod<(this: Record<string, any>) => void>(
    'restartCrazyFromResult',
    {
      ...transactionDependencies(),
      createCrazyResultNavigationCommands() {
        return [
          { type: 'capture-result-parent' },
          { cleanup: true, type: 'remove-result' },
          { fresh: true, mode: 1, type: 'construct-crazy' },
          { type: 'attach-crazy-to-captured-parent' },
        ];
      },
      createCrazyBirdResultNavigationCommands() {
        throw new Error('mode-1 retry must not request Crazy Bird navigation');
      },
      isValid(value: unknown) {
        return (
          value !== null
          && typeof value === 'object'
          && !('destroyed' in value && value.destroyed)
        );
      },
      reportCleanupFailures() {},
      throwUnexpectedRetryCommand(command: Readonly<{ type: string }>): never {
        throw new Error(`unexpected ${command.type}`);
      },
    },
  );

  for (const objectiveId of [46, 50] as const) {
    const initial = createInitialActivationObjectiveHarness(objectiveId);
    assert.throws(
      () => activate.call(
        initial.controller,
        initial.placement,
        TEST_CRAZY_PROFILE,
      ),
      /injected initial partial-command failure/,
    );
    assert.equal(initial.objectiveValue(), 7);
    assert.equal(initial.placement.currentScreen, null);
    assert.equal(initial.controller.screenPlacement, null);

    const result = createResultRetryObjectiveHarness(objectiveId);
    assert.throws(
      () => retry.call(result.controller),
      /injected Result Retry partial-command failure/,
    );
    assert.equal(result.objectiveValue(), 9);
    assert.equal(result.placement.currentScreen, result.resultRoot);
    assert.equal(result.resultRoot.parent, result.host);
    assert.deepEqual(result.events.filter((event) => event === 'result:rearm'), [
      'result:rearm',
    ]);
  }
});

test('Pause Replay transaction restores the exact old run across staged failure boundaries', () => {
  const restart = compileSourceMethod<(this: Record<string, any>) => void>(
    'restartCrazyFromPause',
    replayDependencies(),
  );

  for (const failure of ['construct', 'attach', 'activate', 'score'] as const) {
    const harness = createReplayHarness(failure);
    assert.throws(
      () => restart.call(harness.controller),
      new RegExp(`injected ${failure} failure`),
    );
    assert.equal(harness.placement.currentScreen, harness.oldRoot);
    assert.equal(harness.oldRoot.parent, harness.host);
    assert.equal(harness.freshRoot.parent, null);
    assert.equal(harness.oldScene.active, true);
    assert.equal(harness.oldScene.suspended, false);
    assert.equal(harness.oldScene.finalized, false);
    assert.equal(harness.controller.crazySceneController, harness.oldScene);
    assert.equal(harness.controller.currentOwnership.id, harness.oldOwnership.id);
    assert.equal(
      harness.controller.currentOwnership.doubleTossLoop,
      failure === 'construct' ? undefined : null,
    );
    assert.equal(harness.controller.standbyCrazySceneController, harness.freshScene);
    assert.equal(harness.objectiveProgress(), 1);
    assert.equal(harness.events.filter((event) => event === 'pause:ingress').length, 1);
    const disposedCandidate = failure === 'construct' ? 'dispose:empty' : 'dispose:fresh';
    assert.equal(harness.events.filter((event) => event === disposedCandidate).length, 1);
  }
});

test('Pause Replay rollback retains failed fresh cleanup and drains it on the next retry', () => {
  const restart = compileSourceMethod<(this: Record<string, any>) => void>(
    'restartCrazyFromPause',
    replayDependencies(),
  );
  const drain = compileSourceMethod<(this: Record<string, any>) => void>(
    'drainRetiredCrazyRunOwnership',
    {
      cleanupError(label: string, failures: readonly unknown[]) {
        return new Error(`${label}: ${failures.map(String).join('; ')}`);
      },
    },
  );
  const harness = createReplayHarness('rollback-cleanup');

  assert.throws(
    () => restart.call(harness.controller),
    /injected score failure[\s\S]*injected fresh rollback cleanup failure/,
  );
  assert.equal(harness.freshScene.active, false);
  assert.equal(harness.controller.currentOwnership.id, harness.oldOwnership.id);
  assert.equal(harness.controller.crazySceneController, harness.oldScene);
  assert.equal(harness.controller.retiredCrazyRuns.length, 1);
  assert.equal(
    harness.controller.retiredCrazyRuns[0].ownership,
    harness.freshOwnership,
  );
  assert.equal(
    harness.controller.retiredCrazyRuns[0].scene,
    harness.freshScene,
  );

  assert.doesNotThrow(() => drain.call(harness.controller));
  assert.equal(harness.controller.retiredCrazyRuns.length, 0);
  assert.equal(harness.controller.currentOwnership.id, harness.oldOwnership.id);
  assert.equal(harness.controller.crazySceneController, harness.oldScene);
  assert.equal(harness.events.filter((event) => event === 'dispose:fresh').length, 2);
});

test('Pause Replay commits one fresh run and retires the old owner against its inactive scene', () => {
  const cleanupReports: unknown[][] = [];
  const restart = compileSourceMethod<(this: Record<string, any>) => void>(
    'restartCrazyFromPause',
    replayDependencies(cleanupReports),
  );
  const harness = createReplayHarness(null);

  assert.doesNotThrow(() => restart.call(harness.controller));
  assert.equal(harness.placement.currentScreen, harness.freshRoot);
  assert.equal(harness.freshRoot.parent, harness.host);
  assert.equal(harness.oldRoot.parent, null);
  assert.equal(harness.freshScene.active, true);
  assert.equal(harness.oldScene.active, false);
  assert.equal(harness.oldScene.suspended, false);
  assert.equal(harness.oldScene.finalized, true);
  assert.equal(harness.controller.crazySceneController, harness.freshScene);
  assert.equal(harness.controller.standbyCrazySceneController, harness.oldScene);
  assert.equal(harness.controller.currentOwnership, harness.freshOwnership);
  assert.equal(harness.objectiveProgress(), 0);
  assert.equal(harness.events.filter((event) => event === 'dispose:old').length, 1);
  assert.equal(harness.events.includes('pause:ingress'), false);
  assert.deepEqual(cleanupReports, []);
});

test('failed old-run cleanup stays owned and drains successfully on retry', () => {
  const cleanupReports: unknown[][] = [];
  const restart = compileSourceMethod<(this: Record<string, any>) => void>(
    'restartCrazyFromPause',
    replayDependencies(cleanupReports),
  );
  const drain = compileSourceMethod<(this: Record<string, any>) => void>(
    'drainRetiredCrazyRunOwnership',
    {
      cleanupError(label: string, failures: readonly unknown[]) {
        return new Error(`${label}: ${failures.map(String).join('; ')}`);
      },
    },
  );
  const harness = createReplayHarness('cleanup');

  assert.doesNotThrow(() => restart.call(harness.controller));
  assert.equal(harness.controller.currentOwnership, harness.freshOwnership);
  assert.equal(harness.controller.retiredCrazyRuns.length, 1);
  assert.equal(cleanupReports.length, 1);

  assert.doesNotThrow(() => drain.call(harness.controller));
  assert.equal(harness.controller.retiredCrazyRuns.length, 0);
  assert.equal(harness.controller.currentOwnership, harness.freshOwnership);
  assert.equal(harness.controller.crazySceneController, harness.freshScene);
  assert.equal(harness.events.filter((event) => event === 'dispose:old').length, 2);
});

test('committed Pause Quit retains failed cleanup and drains it before Crazy re-entry', () => {
  const cleanupReports: unknown[][] = [];
  const commit = compileSourceMethod<
    (this: Record<string, any>, transaction: Record<string, any>, root: object) => void
  >('commitPauseQuit', {
    CLASSIC_MENU_BUTTON_AUDIO_PATH: 'Sounds/menu-click.wav',
    collectCleanupFailure: transactionDependencies().collectCleanupFailure,
    reportCleanupFailures(_label: string, failures: readonly unknown[]) {
      if (failures.length > 0) {
        cleanupReports.push([...failures]);
      }
    },
  });
  const activate = compileSourceMethod<
    (this: Record<string, any>, placement: any, profile: object) => void
  >(
    'activateTimedModeFromAppShell',
    transactionDependencies(),
  );
  const drain = compileSourceMethod<(this: Record<string, any>) => void>(
    'drainRetiredCrazyRunOwnership',
    {
      cleanupError(label: string, failures: readonly unknown[]) {
        return new Error(`${label}: ${failures.map(String).join('; ')}`);
      },
    },
  );
  const harness = createPauseQuitCleanupHarness();

  assert.doesNotThrow(() => (
    commit.call(
      harness.controller,
      harness.transaction,
      harness.releasedRoot,
    )
  ));
  assert.equal(harness.transaction.status, 'committed');
  assert.equal(harness.controller.currentOwnership, harness.emptyOwnership);
  assert.equal(harness.controller.crazyModeRoot, null);
  assert.equal(harness.controller.retiredCrazyRuns.length, 1);
  assert.equal(cleanupReports.length, 1);

  harness.placement.currentScreen = null;
  harness.controller.drainRetiredCrazyRunOwnership = () => (
    drain.call(harness.controller)
  );
  assert.doesNotThrow(() => (
    activate.call(
      harness.controller,
      harness.placement,
      TEST_CRAZY_PROFILE,
    )
  ));
  assert.equal(harness.controller.retiredCrazyRuns.length, 0);
  assert.equal(harness.cleanupAttempts(), 2);
  assert.equal(harness.placement.currentScreen, harness.freshRoot);
  assertOrderedSubstrings(harness.events.join('\n'), [
    'cleanup:released:failure',
    'cleanup:released:success',
    'construct:fresh',
  ]);
});

test('Pause Quit suspension failure restores active gameplay and pause ingress', () => {
  const quit = compileSourceArrowMember<(this: Record<string, any>) => void>(
    'onPauseQuitRequested',
    {
      CRAZY_PAUSE_QUIT_REQUESTED_EVENT: 'crazy-pause-quit-requested',
      aggregateWithPrimary: transactionDependencies().aggregateWithPrimary,
      collectCleanupFailure: transactionDependencies().collectCleanupFailure,
    },
  );
  const events: string[] = [];
  const scene = {
    active: true,
    suspended: false,
    suspendCrazyLayerForNavigation() {
      events.push('scene:suspend');
      throw new Error('injected Pause Quit suspension failure');
    },
  };
  const pause = {
    pauseIngress() {
      events.push('pause:ingress');
    },
    resumeEgress() {
      events.push('pause:egress');
    },
    stopAllActions() {
      events.push('pause:stop-actions');
    },
  };
  const controller = {
    currentPauseCard() {
      return {};
    },
    node: {
      emit() {
        events.push('navigation:emit');
      },
    },
    requireCrazyModeRoot() {
      return {};
    },
    requireCrazySceneController() {
      return scene;
    },
    requirePausePresenter() {
      return pause;
    },
    requireScreenPlacement() {
      return {};
    },
  };

  assert.throws(
    () => quit.call(controller),
    /injected Pause Quit suspension failure/,
  );
  assert.equal(scene.active, true);
  assert.equal(scene.suspended, false);
  assert.deepEqual(events, [
    'pause:egress',
    'pause:stop-actions',
    'scene:suspend',
    'pause:ingress',
  ]);
});

test('standby acquisition destroys partial onLoad insertion and never grows beyond two scenes', () => {
  class SceneType {}
  const isValid = (value: unknown): boolean => (
    value !== null
    && typeof value === 'object'
    && (value as { valid?: boolean }).valid !== false
  );
  const acquire = compileSourceMethod<
    (this: Record<string, any>, active: Record<string, any>) => Record<string, any>
  >('acquireStandbyCrazySceneController', {
    CrazySceneController: SceneType,
    aggregateWithPrimary(
      label: string,
      primary: unknown,
      failures: readonly unknown[],
    ) {
      return new Error(`${label}: ${String(primary)}; ${failures.map(String).join('; ')}`);
    },
    collectCleanupFailure(failures: unknown[], cleanup: () => unknown) {
      try {
        cleanup();
      } catch (error) {
        failures.push(error);
      }
    },
    isValid,
  });
  const active = replaySceneStub(true);
  const scenes = [active];
  let addCalls = 0;
  const controller = {
    node: {
      addComponent() {
        addCalls += 1;
        const standby = replaySceneStub(false);
        scenes.push(standby);
        if (addCalls === 1) {
          standby.readyForActivation = false;
          throw new Error('injected standby onLoad failure');
        }
        return standby;
      },
      getComponents() {
        return scenes;
      },
    },
    standbyCrazySceneController: null,
  };

  assert.throws(
    () => acquire.call(controller, active),
    /injected standby onLoad failure/,
  );
  assert.equal(scenes.filter(isValid).length, 1);
  assert.equal(controller.standbyCrazySceneController, null);

  const standby = acquire.call(controller, active);
  assert.equal(scenes.filter(isValid).length, 2);
  assert.equal(controller.standbyCrazySceneController, standby);
  assert.equal(acquire.call(controller, active), standby);
  assert.equal(addCalls, 2);
});

test('teardown aggregates all run, Result, and preparation cleanup boundaries', () => {
  const destroy = extractMethod(SOURCE, 'onDestroy');
  assertOrderedSubstrings(destroy, [
    'this.disposeCrazyModePresentation()',
    'this.disposeResultPresentation()',
    'this.disposeCrazyPreparation()',
    "reportCleanupFailures('Crazy gameplay teardown'",
  ]);

  const run = extractMethod(SOURCE, 'disposeCrazyModePresentation');
  assert.match(run, /registry\.disposeAll\(\)/);
  assert.match(
    run,
    /registry\.size === 0[\s\S]*?registry\.activeDragonEffectCount === 0/,
  );
  assert.match(
    run,
    /if \(registryDrained && this\.registry === registry\)[\s\S]*?this\.registry = null/,
  );
  assert.match(
    run,
    /this\.standardBombExplosionOwners[\s\S]*?owner\.presenter\.dispose\(\)[\s\S]*?standardBombExplosionOwners\.delete\(targetId\)/,
  );
  assert.match(
    run,
    /this\.standardBombFuseSmokePresenters[\s\S]*?presenter\.dispose\(\)[\s\S]*?standardBombFuseSmokePresenters\.delete\(targetId\)/,
  );
  assert.match(
    run,
    /this\.standardBombEntryAudioHandles\.keys\(\)[\s\S]*?disposeStandardBombEntryAudio\(targetId\)/,
  );
  assert.match(run, /timeManagerPresenter\.dispose\(\)/);
  assert.match(run, /bombElectricPresenter\.dispose\(\)/);
  assert.match(run, /electricContactAdapter\.dispose\(\)/);
  assert.match(run, /cutDriver\.presenter\.dispose\(\)/);
  assert.match(run, /scoreHudPresenter\.dispose\(\)/);
  assert.match(run, /pausePresenter\.dispose\(\)/);
  assert.match(
    run,
    /const presentationOwnersDrained = \([\s\S]*?registryDrained[\s\S]*?if \(presentationOwnersDrained\)/,
  );
  assert.doesNotMatch(run, /while \(|updateDragonEffectsAction|updateDragonEffectsPhysics/);

  const preparation = extractMethod(SOURCE, 'disposeCrazyPreparation');
  assert.match(preparation, /objectiveAchievementPresenters[\s\S]*?presenter\.dispose\(\)/);
  assert.match(preparation, /objectiveTarget\.destroy\(\)/);
  assert.match(preparation, /audio\.stop\(\)/);
  assert.match(preparation, /destroyNamedChild\(this\.node, 'CrazyAudioRoot'\)/);
  assert.match(preparation, /this\.baseGameplayResources = null/);
  assert.match(preparation, /this\.objectivesManager = null/);
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
    sourceUrl: `crazy-gameplay-controller.test.${methodName}.ts`,
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
    `  private readonly ${memberName} = ()`,
  ).replace(
    new RegExp(`^\\s*private\\s+readonly\\s+${memberName}\\s*=\\s*\\(\\)\\s*:\\s*void\\s*=>`),
    `function ${memberName}()`,
  );
  const names = Object.keys(dependencies);
  const values = names.map((name) => dependencies[name]);
  const javascript = stripTypeScriptTypes(source, {
    mode: 'transform',
    sourceUrl: `crazy-gameplay-controller.test.${memberName}.ts`,
  });
  return Function(
    ...names,
    `"use strict";\n${javascript}\nreturn ${memberName};`,
  )(...values) as T;
}

function transactionDependencies() {
  return {
    CRAZY_BIRD_RESULT_MODE_ID: 4,
    CRAZY_BIRD_TIMED_PROFILE: TEST_CRAZY_BIRD_PROFILE,
    CRAZY_RESULT_MODE_ID: 1,
    aggregateWithPrimary(
      label: string,
      primary: unknown,
      failures: readonly unknown[],
    ) {
      return new Error(
        `${label}: ${String(primary)}; cleanup: ${failures.map(String).join('; ')}`,
      );
    },
    assertScreenPlacementPort() {},
    collectCleanupFailure(failures: unknown[], cleanup: () => unknown) {
      try {
        cleanup();
      } catch (error) {
        failures.push(error);
      }
    },
    timedModeLabel(profile: object) {
      return profile === TEST_CRAZY_BIRD_PROFILE ? 'Crazy Bird' : 'Crazy';
    },
  };
}

function replayDependencies(cleanupReports: unknown[][] = []) {
  return {
    CLASSIC_MENU_BUTTON_AUDIO_PATH: 'Sounds/menu-click.wav',
    CRAZY_BIRD_TIMED_PROFILE: TEST_CRAZY_BIRD_PROFILE,
    aggregateWithPrimary(
      label: string,
      primary: unknown,
      failures: readonly unknown[],
    ) {
      return new Error(
        `${label}: ${String(primary)}; cleanup: ${failures.map(String).join('; ')}`,
      );
    },
    cleanupError(label: string, failures: readonly unknown[]) {
      return new Error(`${label}: ${failures.map(String).join('; ')}`);
    },
    collectCleanupFailure(failures: unknown[], cleanup: () => unknown) {
      try {
        cleanup();
      } catch (error) {
        failures.push(error);
      }
    },
    isValid(value: unknown) {
      return (
        value !== null
        && typeof value === 'object'
        && !('destroyed' in value && value.destroyed)
      );
    },
    reportCleanupFailures(_label: string, failures: readonly unknown[]) {
      if (failures.length > 0) {
        cleanupReports.push([...failures]);
      }
    },
    timedModeLeaderboardFirst(_settings: unknown, profile: object) {
      assert.equal(profile, TEST_CRAZY_PROFILE);
      return 99;
    },
  };
}

function createInitialActivationObjectiveHarness(objectiveId: 46 | 50) {
  const host = { name: 'CurrentScreenHost' };
  const freshRoot = {
    destroyed: false,
    name: 'fresh',
    parent: null as object | null,
  };
  let objectiveValue = 7;
  const placement = {
    currentScreen: null as typeof freshRoot | null,
  };
  const controller: Record<string, any> = {
    crazyModeRoot: null,
    readinessStatus: 'ready',
    resultPresentationRoot: null,
    resultPresenter: null,
    screenPlacement: null,
    shuttingDown: false,
    attachCrazyModeAndActivateScene(targetPlacement: typeof placement) {
      freshRoot.parent = host;
      targetPlacement.currentScreen = freshRoot;
      objectiveValue = 0;
      throw new Error('injected initial partial-command failure');
    },
    captureCrazyActivationObjectiveRollback() {
      return { objectiveId, value: objectiveValue };
    },
    constructCrazyMode() {
      this.crazyModeRoot = freshRoot;
    },
    disposeCrazyModePresentation() {
      freshRoot.parent = null;
      placement.currentScreen = null;
      this.crazyModeRoot = null;
    },
    drainRetiredCrazyRunOwnership() {},
    emitSnapshot() {},
    restoreCrazyActivationObjective(rollback: { value: number }) {
      objectiveValue = rollback.value;
    },
    updateScorePresentation() {},
  };
  return {
    controller,
    objectiveValue: () => objectiveValue,
    placement,
  };
}

function createResultRetryObjectiveHarness(objectiveId: 46 | 50) {
  const host = { name: 'CurrentScreenHost' };
  const resultRoot = {
    destroyed: false,
    name: 'result',
    parent: host as object | null,
  };
  const freshRoot = {
    destroyed: false,
    name: 'fresh',
    parent: null as object | null,
  };
  const events: string[] = [];
  let objectiveValue = 9;
  const placement = {
    currentScreen: resultRoot as typeof resultRoot | typeof freshRoot | null,
    attachCurrentScreen(root: typeof resultRoot | typeof freshRoot) {
      assert.equal(this.currentScreen, null);
      root.parent = host;
      this.currentScreen = root;
      events.push(`screen:attach:${root.name}`);
    },
    detachCurrentScreen(root: typeof resultRoot | typeof freshRoot) {
      assert.equal(this.currentScreen, root);
      root.parent = null;
      this.currentScreen = null;
      events.push(`screen:detach:${root.name}`);
      return root;
    },
  };
  const resultPresenter = {
    dispose() {
      events.push('result:dispose');
    },
    rearmNavigationAfterFailure(route: string) {
      assert.equal(route, 'retry');
      events.push('result:rearm');
    },
  };
  const controller: Record<string, any> = {
    crazyModeRoot: null,
    pendingResultConfiguration: null,
    resultPresentationRoot: resultRoot,
    resultPresenter,
    attachCrazyModeAndActivateScene(targetPlacement: typeof placement) {
      targetPlacement.attachCurrentScreen(freshRoot);
      objectiveValue = 0;
      throw new Error('injected Result Retry partial-command failure');
    },
    captureCrazyActivationObjectiveRollback() {
      return { objectiveId, value: objectiveValue };
    },
    configuredResult() {
      return { mode: 1, profile: TEST_CRAZY_PROFILE, score: 123 };
    },
    constructCrazyMode() {
      this.crazyModeRoot = freshRoot;
      events.push('construct:fresh');
    },
    disposeCrazyModePresentation() {
      if (placement.currentScreen === freshRoot) {
        placement.detachCurrentScreen(freshRoot);
      }
      this.crazyModeRoot = null;
      events.push('dispose:fresh');
    },
    drainRetiredCrazyRunOwnership() {},
    effectsEnabled() {
      return false;
    },
    emitCommand(command: Readonly<{ type: string }>) {
      events.push(`command:${command.type}`);
    },
    emitSnapshot() {
      events.push('snapshot');
    },
    requireAttachedResultRoot() {
      return resultRoot;
    },
    requireResultPresenter() {
      return resultPresenter;
    },
    requireScreenPlacement() {
      return placement;
    },
    restoreCrazyActivationObjective(rollback: { value: number }) {
      objectiveValue = rollback.value;
      events.push('objective:restore');
    },
  };
  return {
    controller,
    events,
    host,
    objectiveValue: () => objectiveValue,
    placement,
    resultRoot,
  };
}

function createPauseQuitCleanupHarness() {
  const releasedRoot = {
    destroyed: false,
    name: 'released',
    parent: null as object | null,
  };
  const freshRoot = {
    destroyed: false,
    name: 'fresh',
    parent: null as object | null,
  };
  const destinationRoot = {
    destroyed: false,
    name: 'destination',
    parent: {} as object | null,
  };
  const events: string[] = [];
  let cleanupAttempts = 0;
  const pause = {};
  const releasedOwnership = {
    id: 'released',
    pause,
    root: releasedRoot,
  };
  const emptyOwnership = {
    id: 'empty',
    pause: null,
    root: null,
  };
  const freshOwnership = {
    id: 'fresh',
    pause: {},
    root: freshRoot,
  };
  const scene = {
    active: false,
    finalized: false,
    suspended: true,
    finalizeSuspendedCrazyLayerRelease() {
      assert.equal(this.suspended, true);
      this.suspended = false;
      this.finalized = true;
      events.push('scene:finalize');
    },
  };
  const host = {};
  const placement = {
    currentScreen: destinationRoot as typeof destinationRoot | typeof freshRoot | null,
    attachCurrentScreen(root: typeof freshRoot) {
      assert.equal(this.currentScreen, null);
      root.parent = host;
      this.currentScreen = root;
      events.push('screen:attach:fresh');
    },
  };
  const controller: Record<string, any> = {
    crazyModeRoot: releasedRoot,
    crazySceneController: scene,
    currentOwnership: releasedOwnership,
    pausePresenter: pause,
    readinessStatus: 'ready',
    resultPresentationRoot: null,
    resultPresenter: null,
    retiredCrazyRuns: [],
    screenPlacement: placement,
    shuttingDown: false,
    attachCrazyModeAndActivateScene(targetPlacement: typeof placement) {
      targetPlacement.attachCurrentScreen(freshRoot);
      events.push('scene:activate:fresh');
    },
    captureCrazyActivationObjectiveRollback() {
      return null;
    },
    captureCrazyRunOwnership() {
      return this.currentOwnership;
    },
    constructCrazyMode() {
      assert.equal(this.retiredCrazyRuns.length, 0);
      this.currentOwnership = freshOwnership;
      this.crazyModeRoot = freshRoot;
      this.pausePresenter = freshOwnership.pause;
      events.push('construct:fresh');
    },
    createEmptyCrazyRunOwnership() {
      return emptyOwnership;
    },
    disposeCrazyModePresentation() {
      assert.equal(this.currentOwnership, releasedOwnership);
      cleanupAttempts += 1;
      if (cleanupAttempts === 1) {
        events.push('cleanup:released:failure');
        throw new Error('injected committed Pause Quit cleanup failure');
      }
      events.push('cleanup:released:success');
    },
    effectsEnabled() {
      return false;
    },
    emitSnapshot() {
      events.push('snapshot');
    },
    installCrazyRunOwnership(ownership: typeof releasedOwnership | typeof emptyOwnership) {
      this.currentOwnership = ownership;
      this.crazyModeRoot = ownership.root;
      this.pausePresenter = ownership.pause;
      events.push(`install:${ownership.id}`);
    },
    requireCrazySceneController() {
      return this.crazySceneController;
    },
    restoreCrazyActivationObjective() {},
    updateScorePresentation() {
      events.push('score:update');
    },
  };
  const transaction = {
    presenter: pause,
    root: releasedRoot,
    screenPlacement: placement,
    status: 'pending',
  };
  return {
    cleanupAttempts: () => cleanupAttempts,
    controller,
    emptyOwnership,
    events,
    freshRoot,
    placement,
    releasedRoot,
    transaction,
  };
}

function createReplayHarness(
  failure:
    | 'activate'
    | 'attach'
    | 'cleanup'
    | 'construct'
    | 'rollback-cleanup'
    | 'score'
    | null,
) {
  const host = { name: 'CurrentScreenHost' };
  const oldRoot = { destroyed: false, name: 'old', parent: host };
  const freshRoot = { destroyed: false, name: 'fresh', parent: null as object | null };
  const events: string[] = [];
  let objectiveProgress = 1;
  const oldOwnership = { id: 'old' };
  const emptyOwnership = { id: 'empty' };
  const freshOwnership = { id: 'fresh' };
  let oldDisposeFailuresRemaining = failure === 'cleanup' ? 1 : 0;
  let freshDisposeFailuresRemaining = failure === 'rollback-cleanup' ? 1 : 0;
  const oldScene = {
    active: true,
    finalized: false,
    suspended: false,
    finalizeSuspendedCrazyLayerRelease() {
      assert.equal(this.suspended, true);
      this.suspended = false;
      this.finalized = true;
      events.push('old:finalize');
    },
    resumeSuspendedCrazyLayer() {
      assert.equal(this.suspended, true);
      this.suspended = false;
      this.active = true;
      events.push('old:resume');
    },
    suspendCrazyLayerForNavigation() {
      assert.equal(this.active, true);
      this.active = false;
      this.suspended = true;
      events.push('old:suspend');
    },
  };
  const freshScene = {
    active: false,
    suspended: false,
    timedModeProfile: TEST_CRAZY_PROFILE,
    activateCrazyLayer() {
      events.push('fresh:activate');
      objectiveProgress = 0;
      if (failure === 'activate') {
        throw new Error('injected activate failure');
      }
      this.active = true;
    },
    sessionSnapshot() {
      return { mode: 1 };
    },
    releaseCrazyLayerForReplacement() {
      assert.equal(this.active, true);
      this.active = false;
      events.push('fresh:release');
    },
  };
  const placement = {
    currentScreen: oldRoot as typeof oldRoot | typeof freshRoot | null,
    attachCurrentScreen(root: typeof oldRoot | typeof freshRoot) {
      assert.equal(this.currentScreen, null);
      root.parent = host;
      this.currentScreen = root;
      events.push(`screen:attach:${root.name}`);
    },
    replaceCurrentScreen(root: typeof oldRoot | typeof freshRoot) {
      const previous = this.currentScreen;
      assert.ok(previous);
      if (failure === 'attach' && root === freshRoot) {
        throw new Error('injected attach failure');
      }
      previous.parent = null;
      root.parent = host;
      this.currentScreen = root;
      events.push(`screen:replace:${root.name}`);
      return previous;
    },
  };
  const pause = {
    pauseIngress() {
      events.push('pause:ingress');
    },
    resumeEgress() {
      events.push('pause:egress');
    },
    stopAllActions() {
      events.push('pause:stop-actions');
    },
  };
  const controller: Record<string, any> = {
    crazySceneController: oldScene,
    currentOwnership: oldOwnership,
    retiredCrazyRuns: [],
    standbyCrazySceneController: null,
    acquireStandbyCrazySceneController() {
      events.push('standby:acquire');
      return freshScene;
    },
    captureCrazyRunOwnership() {
      return this.currentOwnership;
    },
    captureCrazyActivationObjectiveRollback() {
      return { objectiveId: 46, value: objectiveProgress };
    },
    captureCrazyReplayObjectiveRollback() {
      return this.captureCrazyActivationObjectiveRollback();
    },
    constructCrazyMode() {
      events.push('construct:fresh');
      if (failure === 'construct') {
        throw new Error('injected construct failure');
      }
      this.currentOwnership = freshOwnership;
    },
    createEmptyCrazyRunOwnership() {
      return emptyOwnership;
    },
    currentPauseCard() {
      return {};
    },
    disposeCrazyModePresentation() {
      events.push(`dispose:${this.currentOwnership.id}`);
      if (this.currentOwnership.id === oldOwnership.id && oldDisposeFailuresRemaining > 0) {
        oldDisposeFailuresRemaining -= 1;
        throw new Error('injected retired cleanup failure');
      }
      if (
        this.currentOwnership.id === freshOwnership.id
        && freshDisposeFailuresRemaining > 0
      ) {
        freshDisposeFailuresRemaining -= 1;
        throw new Error('injected fresh rollback cleanup failure');
      }
    },
    drainRetiredCrazyRunOwnership() {
      events.push('retired:drain');
    },
    effectsEnabled() {
      return false;
    },
    emitSnapshot() {
      events.push('snapshot');
    },
    installCrazyRunOwnership(ownership: unknown) {
      this.currentOwnership = ownership;
      events.push(`install:${(ownership as { id: string }).id}`);
    },
    requireClassicGameplayController() {
      return {
        sharedAudioPresenter: {
          playOneShot() {
            events.push('audio:click');
          },
          stopAllEffects() {
            events.push('audio:classic-effects-stop');
          },
          stopBackgroundMusic() {
            events.push('audio:classic-music-stop');
          },
        },
      };
    },
    requireCrazyAudioPresenter() {
      return {
        stopAllEffects() {
          events.push('audio:crazy-effects-stop');
        },
        stopBackgroundMusic() {
          events.push('audio:crazy-music-stop');
        },
      };
    },
    requireCrazyModeRoot() {
      return oldRoot;
    },
    requireCrazySceneController() {
      return this.crazySceneController;
    },
    requireDetachedCrazyModeRoot() {
      return freshRoot;
    },
    requirePausePresenter() {
      return pause;
    },
    requireRunProfile() {
      return TEST_CRAZY_PROFILE;
    },
    requireScreenPlacement() {
      return placement;
    },
    restoreRetainedSwishCooldown() {
      events.push('swish:restore');
    },
    restoreCrazyActivationObjective(rollback: { value: number }) {
      objectiveProgress = rollback.value;
      events.push('objective:restore');
    },
    restoreCrazyReplayObjective(rollback: { value: number }) {
      this.restoreCrazyActivationObjective(rollback);
    },
    scheduleOnce() {},
    sharedSettingsRuntime: {
      state: { snapshot: { crazyLeaderboard: { first: 99 } } },
    },
    unschedule() {
      events.push('swish:unschedule');
    },
    updateScorePresentation() {
      events.push('score:update');
      if (failure === 'score' || failure === 'rollback-cleanup') {
        throw new Error('injected score failure');
      }
    },
  };
  return {
    controller,
    events,
    freshOwnership,
    freshRoot,
    freshScene,
    host,
    oldOwnership,
    oldRoot,
    oldScene,
    objectiveProgress: () => objectiveProgress,
    placement,
  };
}

function replaySceneStub(active: boolean) {
  return {
    active,
    readyForActivation: true,
    suspended: false,
    valid: true,
    destroy() {
      this.valid = false;
      return true;
    },
  };
}
