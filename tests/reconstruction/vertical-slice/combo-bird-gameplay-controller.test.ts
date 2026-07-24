import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SOURCE = readFileSync(
  `${REPOSITORY_ROOT}/game/assets/scripts/creator/combo-bird-gameplay-controller.ts`,
  'utf8',
);
const TIME_MANAGER_AUDIO_SOURCE = readFileSync(
  `${REPOSITORY_ROOT}/game/assets/scripts/creator/time-manager-audio-presenter.ts`,
  'utf8',
);

test('Combo Bird gameplay is a passive mode-5 owner with no Crazy dependency', () => {
  assert.match(SOURCE, /@ccclass\('ComboBirdGameplayController'\)/);
  for (const dependency of [
    'ComboBirdSceneController',
    'BirdInputController',
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
  assert.doesNotMatch(SOURCE, /from ['"].*crazy.*['"]/i);
  assert.doesNotMatch(SOURCE, /CrazyGameplayController|prepareCrazyRuntime/);

  const start = extractMethod(SOURCE, 'start');
  assert.match(start, /this\.emitSnapshot\(\)/);
  assert.doesNotMatch(start, /prepare|activate|attach|loadComboBirdResources/);

  const destroy = extractMethod(SOURCE, 'onDestroy');
  assertOrderedSubstrings(destroy, [
    'this.releaseSceneForTeardown()',
    'this.stopRunEffectsForTeardown()',
    'this.disposeModePresentation()',
    'this.drainRetiredRuns()',
    'this.disposeResultPresentation()',
    'this.disposePreparation()',
  ]);
});

test('preparation is independent, retryable, and loads only the required supplements', () => {
  const prepare = extractMethod(SOURCE, 'prepareComboBirdRuntime');
  assertOrderedSubstrings(prepare, [
    "this.readinessStatus = 'pending'",
    'const attempt = this.initializePreparation()',
    'this.preparation = attempt',
    'void attempt.catch',
    'this.preparation = null',
    "this.readinessStatus = 'failed'",
    'COMBO_BIRD_RESOURCE_LOAD_FAILED_EVENT',
  ]);

  const initialize = extractMethod(SOURCE, 'initializePreparation');
  assertOrderedSubstrings(initialize, [
    'await classic.prepareRecoveredRuntime()',
    'const assetTree = classic.sharedResourceCatalog.assetTree',
    'const [resources, birdResources, baseGameplayResources] = await Promise.all([',
    'loadComboBirdResources(assetTree)',
    'loadBirdResources(assetTree, COMBO_BIRD_BLADE_TYPE)',
    'loadBaseGameplayResources(assetTree)',
    'TimeManagerAudioPresenter.load(this.node)',
    'this.commitPreparation({',
  ]);
  assert.doesNotMatch(initialize, /prepareCrazyRuntime|sharedCrazy/);

  const commit = extractMethod(SOURCE, 'commitPreparation');
  assertOrderedSubstrings(commit, [
    'products.birdResources.birdType !== COMBO_BIRD_BLADE_TYPE',
    "new Node('ComboBirdObjectiveAchievementTargetRoot')",
    'this.sharedSettingsRuntime.createObjectivesManager(',
    'this.baseGameplayResources = products.baseGameplayResources',
    'this.birdResources = products.birdResources',
    'this.comboBirdResources = products.resources',
    'this.timerAudio = products.timerAudio',
    'this.objectivesManager = objectivesManager',
    "this.readinessStatus = 'ready'",
  ]);
});

test('activation builds detached ordinary-only gameplay and exact mode-5 scene input', () => {
  const activate = extractMethod(SOURCE, 'activateComboBirdFromAppShell');
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
    /catch \(error\)[\s\S]*?disposeModePresentation\(\)[\s\S]*?restoreActivationObjective/,
  );

  const construct = extractMethod(SOURCE, 'constructMode');
  assertOrderedSubstrings(construct, [
    "createDetachedScreenRoot('ComboBirdModeRoot', this.node)",
    "createPresenterRoot(\n      root,\n      'ComboBirdWorldPresentationRoot'",
    'this.combo = new ComboService(random)',
    'this.swishAudio = new ClassicSwishAudioGate(random)',
    'this.registry = new ClassicEntityRegistry({',
    'this.createCorePresentation(',
  ]);
  assert.doesNotMatch(construct, /initializePausePresentation/);
  assert.match(construct, /onFruitCut: this\.onOrdinaryFruitCut/);
  assert.match(construct, /onFruitMiss: this\.onOrdinaryFruitMiss/);
  assert.doesNotMatch(
    construct,
    /Bomb|Dragon|Electric|Magnet|Bonus|Special|CrazyEntityRegistry/,
  );

  const attach = extractMethod(SOURCE, 'attachModeAndActivateScene');
  assertOrderedSubstrings(attach, [
    'screenPlacement.attachCurrentScreen(root)',
    'screenPlacement.currentScreen !== root',
    'this.initializePausePresentation()',
    'new ClassicSpawnPlanner({',
    'const coordinatorOptions: ComboBirdTossCoordinatorOptions',
    'scene.activateComboBirdLayer(',
    'birdComboLeaderboard.first',
    'scene.sessionSnapshot().mode !== COMBO_BIRD_RESULT_MODE_ID',
    "scene.sessionSnapshot().lifecycle !== 'intro-instructions'",
  ]);
  assert.match(
    attach,
    /scene\.activateComboBirdLayer\([\s\S]*?birdComboLeaderboard\.first,[\s\S]*?coordinatorOptions,[\s\S]*?\)/,
  );
});

test('core presentation owns type-3 Bird, 90-second timer, intro, score, and pause', () => {
  const create = extractMethod(SOURCE, 'createCorePresentation');
  assertOrderedSubstrings(create, [
    'ClassicScoreHudPresenter.create({',
    'TimeManagerPresenter.create({',
    'totalSeconds: COMBO_BIRD_INITIAL_TIME_SECONDS',
    'audio: this.requireTimerAudio()',
    'onTimeUp: () => this.requireSceneController().timeUp()',
    'onTimeUpFinish: () => this.requireSceneController().timeUpFinish()',
    'ComboBirdIntroPresenter.create({',
    'onComplete: () => this.requireSceneController().startGameCallback()',
    'BirdBladePresenter.create({',
    'resources: this.requireBirdResources()',
    'BirdBladeRayAdapter.create<ComboBirdPhysicsRayHit>',
  ]);
  assert.match(
    create,
    /disableBonusType: \(\) => \{[\s\S]*?cannot disable a bonus type/,
  );
  assert.match(create, /Combo Bird has no double-score presentation|cannot finish freeze/);

  const session = extractMemberBlock(
    SOURCE,
    '  private readonly onSessionCommand = (',
  );
  assert.match(
    session,
    /case 'create-bird-blade':[\s\S]*?command\.bladeType !== COMBO_BIRD_BLADE_TYPE[\s\S]*?command\.canonicalPath !== COMBO_BIRD_BLADE_ASSET/,
  );
  assert.match(
    session,
    /case 'construct-time-manager':[\s\S]*?COMBO_BIRD_INITIAL_TIME_SECONDS/,
  );
});

test('running frames preserve coordinator-before-timer and keep gameplay live during Time Up', () => {
  const update = extractMethod(SOURCE, 'update');
  assertOrderedSubstrings(update, [
    'this.lifecycleFatalError !== null',
    'return',
    'this.objectiveAchievementPresenters',
  ]);
  assertOrderedSubstrings(update, [
    'this.birdBladePresenter?.update(deltaSeconds)',
    'this.introPresenter?.updateAction(deltaSeconds)',
    'this.timeManagerPresenter?.updateAction(deltaSeconds)',
    "lifecycle === 'running' || lifecycle === 'time-up-presentation'",
    'this.requireSceneController().tickCoordinatorBeforeTimeManager(',
    '() => this.requireTimeManagerPresenter().updateScheduler(deltaSeconds)',
    'this.requireCombo().update(deltaSeconds, this.effectsEnabled())',
  ]);
  assert.match(
    update,
    /timeManagerPresenter\?\.updateAction\(deltaSeconds\)[\s\S]*?pausePresenter\?\.updateAction\(deltaSeconds\)[\s\S]*?if \(!this\.isComboBirdGameplayAttached\(\)\) \{\s*return;\s*\}[\s\S]*?const lifecycle = [\s\S]*?if \(lifecycle === 'running' \|\| lifecycle === 'time-up-presentation'\) \{[\s\S]*?tickCoordinatorBeforeTimeManager/,
  );
  assert.match(
    update,
    /lifecycleAtFrameStart === 'intro-instructions'[\s\S]*?return/,
  );
  assert.doesNotMatch(update, /stopAll\(|disposeModePresentation/);

  for (const signature of [
    '  private readonly onCoordinatorCommands = (',
    '  private readonly onSessionCommand = (',
    '  private readonly onBirdBladeTouchBegan = (',
    '  private readonly onPhysicsStepped = (',
    '  private readonly onOrdinaryFruitCut = (',
    '  private readonly onOrdinaryFruitMiss = (',
  ]) {
    assert.match(
      extractMemberBlock(SOURCE, signature),
      /this\.lifecycleFatalError !== null[\s\S]*?return/,
    );
  }

  const attached = extractMethod(SOURCE, 'isComboBirdGameplayAttached');
  assert.match(attached, /this\.lifecycleFatalError === null/);
  assert.match(
    attached,
    /this\.comboBirdSceneController\?\.active === true/,
  );

  const physics = extractMemberBlock(
    SOURCE,
    '  private readonly onPhysicsStepped = (',
  );
  assert.doesNotMatch(physics, /lifecycle === 'running'|time-up-presentation/);
  assert.match(physics, /this\.isComboBirdGameplayAttached\(\)/);
  assert.match(physics, /registry\.evaluateBounds\(viewport\)/);
});

test('ordinary spawn, cached Bird ray, cut, and miss paths remain wired end to end', () => {
  const coordinator = extractMemberBlock(
    SOURCE,
    '  private readonly onCoordinatorCommands = (',
  );
  assertOrderedSubstrings(coordinator, [
    'this.emitCommands(commands)',
    'commands.filter(isClassicSpawnCommand)',
    'partitionClassicSpawnCommands(spawnCommands)',
    'this.requireRegistry().applySpawnPlan(',
  ]);

  const physics = extractMemberBlock(
    SOURCE,
    '  private readonly onPhysicsStepped = (',
  );
  assertOrderedSubstrings(physics, [
    'registry.size > 0',
    'ray.processOneCachedRay',
    'this.applyBirdRaycastBatch(batch, registry)',
    'blade.acknowledgeCachedRay()',
    'registry.evaluateBounds(viewport)',
  ]);
  assert.doesNotMatch(physics, /while\s*\(/);

  const ray = extractMethod(SOURCE, 'applyBirdRaycastBatch');
  assertOrderedSubstrings(ray, [
    'registry.runRayQueryCutBatch(() =>',
    'batch.forwardHits.map',
    'batch.reverseHits.map',
    'createCutDispatchCommands(',
    "command.type === 'combo-check'",
    'this.requireSceneController().checkCombo(command.position)',
    'registry.cut(command.targetId, command.segment)',
  ]);

  const cut = extractMemberBlock(
    SOURCE,
    '  private readonly onOrdinaryFruitCut = (',
  );
  assertOrderedSubstrings(cut, [
    'this.presentCutHalves({',
    'getClassicFruitCutAudioSequence(',
    'this.requireSceneController().fruitCut(',
  ]);
  assert.match(
    cut,
    /fruitCut\(\s*event\.worldPosition,\s*event\.fruitId,\s*event\.score,\s*\)/,
  );
  const miss = extractMemberBlock(
    SOURCE,
    '  private readonly onOrdinaryFruitMiss = (',
  );
  assert.match(miss, /this\.requireSceneController\(\)\.fruitFail\(event\.worldPosition\)/);
});

test('combo command batches preserve objective, item, score, attachment, audio, and commit order', () => {
  const combo = extractMethod(SOURCE, 'applyComboCommands');
  assertOrderedSubstrings(combo, [
    'combo.assertPendingUpdate(commands)',
    'applyComboCommandBatch(commands, {',
    "case 'process-objective':",
    'this.requireObjectivesManager().processGameEvent(',
    "case 'create-combo-item':",
    'fontResource: this.requireClassicGameplayController()',
    "case 'add-score':",
    'this.requireSceneController().addScore(command.value)',
    "case 'attach-combo-item':",
    'presenter.attach(this.requireWorldPresentationRoot())',
    "case 'play-combo-sound':",
    'getClassicComboAudioPath(command.soundIndex)',
    "case 'reset-combo':",
    'combo.commitPendingUpdate(commands)',
  ]);
  assert.match(
    combo,
    /finalize: \(\) => \{[\s\S]*?pendingPresenter = null[\s\S]*?presenter\?\.dispose\(\)/,
  );
  assert.match(combo, /publish: \(command\) => this\.emitCommand\(command\)/);

  const session = extractMemberBlock(
    SOURCE,
    '  private readonly onSessionCommand = (',
  );
  assert.match(
    session,
    /case 'process-objective':[\s\S]*?command\.selector !== COMBO_BIRD_OBJECTIVE_EVENT_SELECTOR[\s\S]*?processGameEvent\(/,
  );
  assert.match(
    session,
    /case 'add-score':[\s\S]*?command\.application !== 'already-applied'/,
  );
});

test('pause replay leases a fresh scene and retains recoverable old ownership', () => {
  for (const member of [
    'onPauseRequested',
    'onResumeRequested',
    'onPauseReplayRequested',
    'onPauseQuitRequested',
  ]) {
    const action = extractMemberBlock(
      SOURCE,
      `  private readonly ${member} = (`,
    );
    assert.match(
      action,
      /this\.lifecycleFatalError !== null[\s\S]*?return/,
    );
  }

  const restart = extractMethod(SOURCE, 'restartFromPause');
  assertOrderedSubstrings(restart, [
    'const oldOwnership = this.captureRunOwnership()',
    'oldScene.suspendComboBirdLayerForNavigation()',
    'freshScene = this.acquireStandbySceneController(oldScene)',
    'this.installRunOwnership(this.createEmptyRunOwnership())',
    'this.constructMode()',
    'placement.replaceCurrentScreen(freshRoot)',
    'this.initializePausePresentation()',
    'this.activateCurrentSceneWithFreshCoordinator(freshScene)',
    'oldScene.finalizeSuspendedComboBirdLayerRelease()',
    'const freshOwnership = this.captureRunOwnership()',
  ]);
  assert.match(
    restart,
    /const freshOwnership[\s\S]*?this\.installRunOwnership\(oldOwnership\)[\s\S]*?this\.disposeModePresentation\(\)[\s\S]*?this\.installRunOwnership\(freshOwnership\)/,
  );
  assert.match(
    restart,
    /catch \(error\)[\s\S]*?releaseComboBirdLayerForReplacement\(\)[\s\S]*?resumeSuspendedComboBirdLayer\(\)/,
  );
  assert.match(
    restart,
    /const primaryFatal = error instanceof ComboBirdLifecycleRollbackError/,
  );
  assert.match(
    restart,
    /if \(!primaryFatal && rollbackFailures\.length === 0\)[\s\S]*?resumeSuspendedComboBirdLayer\(\)/,
  );
  assert.match(
    restart,
    /this\.quiesceSceneAfterFailedRelease\([\s\S]*?'Combo Bird Pause Replay fresh-scene rollback'[\s\S]*?if \(freshScene\.active\) \{[\s\S]*?this\.retiredRuns\.push/,
  );
  assert.match(
    restart,
    /this\.restorePauseAudioAfterNavigationRollback\([\s\S]*?pauseAudioLeaseSnapshot[\s\S]*?if \(pauseEgressAttempted\)[\s\S]*?pause\.pauseIngress/,
  );
  assert.match(
    restart,
    /rollbackFailures\.length > 0 && oldSceneResumed && oldScene\.active[\s\S]*?oldScene\.suspendComboBirdLayerForNavigation\(\)[\s\S]*?new ComboBirdLifecycleRollbackError\([\s\S]*?this\.retainFatalLifecycleBoundary\(failure\)/,
  );
  assert.equal(
    occurrences(SOURCE, 'this.initializePausePresentation()'),
    2,
    'pause UI must attach only after a fresh mode root owns an active screen placement',
  );

  const quit = extractMemberBlock(
    SOURCE,
    '  private readonly onPauseQuitRequested = (',
  );
  assertOrderedSubstrings(quit, [
    'suspendComboBirdLayerForNavigation()',
    'transaction.audioReleaseAttempted = true',
    'this.releasePauseAudioForNavigation()',
    'COMBO_BIRD_PAUSE_QUIT_REQUESTED_EVENT',
    "transaction.status === 'pending'",
  ]);
  assert.match(
    quit,
    /transaction\.status === 'pending'[\s\S]*?this\.rollbackPauseQuit\(transaction\)/,
  );

  const releaseAudio = extractMethod(
    SOURCE,
    'releasePauseAudioForNavigation',
  );
  assertOrderedSubstrings(releaseAudio, [
    'sharedAudioPresenter.stopAllEffects()',
    'this.requireTimerAudio().stopAllEffects()',
    'sharedAudioPresenter.stopBackgroundMusic()',
  ]);

  const rollback = extractMethod(SOURCE, 'rollbackPauseQuit');
  assertOrderedSubstrings(rollback, [
    'resumeSuspendedComboBirdLayer()',
    'transaction.presenter.pauseIngress(this.currentPauseCard())',
    'this.restorePauseAudioAfterNavigationRollback(transaction)',
    "transaction.status = 'rolled-back'",
  ]);
  assert.match(
    rollback,
    /catch \(error\)[\s\S]*?resumedScene\?\.active[\s\S]*?suspendComboBirdLayerForNavigation\(\)[\s\S]*?new ComboBirdLifecycleRollbackError\([\s\S]*?this\.retainFatalLifecycleBoundary\(failure\)/,
  );

  const restoreAudio = extractMethod(
    SOURCE,
    'restorePauseAudioAfterNavigationRollback',
  );
  assert.match(
    restoreAudio,
    /effectsPauseLeaseRequired[\s\S]*?sharedAudioPresenter\.pauseAllEffects\(\)[\s\S]*?requireTimerAudio\(\)\.pauseAllEffects\(\)/,
  );
  assert.match(
    restoreAudio,
    /musicPauseLeaseRequired[\s\S]*?sharedAudioPresenter\.pauseBackgroundMusic\(\)/,
  );

  const resume = extractMemberBlock(
    SOURCE,
    '  private readonly onResumeRequested = (',
  );
  assert.match(
    resume,
    /sharedAudioPresenter\.stopBackgroundMusic\(\)/,
  );
});

test('Time Up result entry is transactional and samples score only at finish dispatch', () => {
  const session = extractMemberBlock(
    SOURCE,
    '  private readonly onSessionCommand = (',
  );
  assertOrderedSubstrings(session, [
    "case 'stop-effects':",
    'this.stopAllRunEffects()',
    "case 'capture-combo-bird-parent':",
    'this.captureModeForResult()',
    "case 'construct-result':",
    'this.beginResultConstruction()',
    "case 'set-result-score':",
    'this.setPendingResultScore(command.score)',
    "case 'remove-combo-bird':",
    'this.detachModeForResult(command.cleanup)',
    "case 'attach-result':",
    'this.attachResult(command.zOrder)',
  ]);

  const capture = extractMethod(SOURCE, 'captureModeForResult');
  assertOrderedSubstrings(capture, [
    "status: 'pending'",
    'enlistTimeUpFinishParticipant(participant)',
  ]);
  assert.match(capture, /prepareCommit: \(\) => this\.prepareResultCommit\(transaction\)/);
  assert.match(capture, /commit: \(\) => this\.commitResultTransition\(transaction\)/);
  assert.match(capture, /rollback: \(\) => this\.rollbackResultTransition\(transaction\)/);

  const commit = extractMethod(SOURCE, 'commitResultTransition');
  assertOrderedSubstrings(commit, [
    "transaction.status !== 'prepared'",
    'recordComboBirdResultScore(',
    "transaction.status = 'committed'",
    'this.pendingResultEntryTransaction = null',
    'createRecoveredResultObjectiveCommand(',
    'this.requireObjectivesManager().processGameEvent(',
    'this.disposeModePresentation()',
  ]);
  assert.equal(
    occurrences(commit, 'recordComboBirdResultScore('),
    1,
  );
  assert.equal(
    occurrences(commit, 'createRecoveredResultObjectiveCommand('),
    1,
  );
});

test('result ranking, reward, Retry, and Menu reuse the recovered shared contracts', () => {
  const attach = extractMethod(SOURCE, 'attachResult');
  assertOrderedSubstrings(attach, [
    'insertComboBirdResultScore(',
    'comboBirdLeaderboardPanelValues(ranking.leaderboard)',
    'ClassicResultPresenter.create({',
    'completedRunScore: configured.score',
    'onRankPresentationBoundary:',
    'getClassicResultRankAudioPath(ranking.achievedRank)',
    'onRetry: this.onResultRetry',
    'onTotalCoinsEntranceComplete: this.onResultTotalCoinsEntranceComplete',
  ]);

  const reward = extractMemberBlock(
    SOURCE,
    '  private readonly onResultTotalCoinsEntranceComplete = (',
  );
  assertOrderedSubstrings(reward, [
    'this.pendingResultEntryTransaction !== null',
    'awardComboBirdResultCoins(',
    'COMBO_BIRD_RESULT_REWARD_READY_EVENT',
    'return award.bonusCoins',
  ]);
  assert.equal(occurrences(reward, 'awardComboBirdResultCoins('), 1);
  assert.doesNotMatch(SOURCE, /\.save\(|saveSettings|flushSettings/);

  const retry = extractMethod(SOURCE, 'restartFromResult');
  assertOrderedSubstrings(retry, [
    'createComboBirdResultNavigationCommands({',
    "route: 'retry'",
    "case 'capture-result-parent':",
    "case 'remove-result':",
    "case 'construct-combo-bird':",
    '!command.fresh',
    'this.constructMode()',
    "case 'attach-combo-bird-to-captured-parent':",
    'this.attachModeAndActivateScene(placement)',
  ]);

  const menu = extractMemberBlock(
    SOURCE,
    '  private readonly onResultMenu = (',
  );
  assert.match(menu, /route: 'main-menu'/);
  assert.match(menu, /COMBO_BIRD_RESULT_MENU_REQUESTED_EVENT/);
  assert.match(menu, /this\.rollbackResultMenu\(transaction\)/);
});

test('timer audio owns exactly timetick and timeup while all other effects stay Classic-owned', () => {
  const audioPaths = extractConstBlock(
    TIME_MANAGER_AUDIO_SOURCE,
    'const TIME_MANAGER_AUDIO_PATHS',
  );
  assert.match(audioPaths, /'Sounds\/timetick\.wav'/);
  assert.match(audioPaths, /'Sounds\/timeup\.wav'/);
  assert.equal(occurrences(audioPaths, "'Sounds/"), 2);

  const loader = extractMethod(
    TIME_MANAGER_AUDIO_SOURCE,
    'loadTimerAudioClips',
  );
  assert.match(loader, /TIME_MANAGER_AUDIO_PATHS\.map/);
  assert.match(loader, /canonicalResourceToBundlePath/);
  assert.match(loader, /bundle\.load\(paths, AudioClip/);

  const timerPlay = extractMethod(TIME_MANAGER_AUDIO_SOURCE, 'playOneShot');
  assert.match(timerPlay, /this\.clips\.get\(canonicalPath\)/);
  assert.match(timerPlay, /new Node\('TimeManagerOneShotAudio'\)/);
  assert.match(timerPlay, /source\.play\(\)/);
  assert.match(
    SOURCE,
    /from '\.\/time-manager-audio-presenter'/,
  );
  assert.doesNotMatch(
    SOURCE,
    /class ComboBirdTimerAudioPresenter|class ComboBirdTimerAudioVoice|loadTimerAudioClips/,
  );

  for (const [method, sharedClassicPath] of [
    ['onPauseRequested', 'CLASSIC_MENU_BUTTON_AUDIO_PATH'],
    ['onObjectiveAchievement', 'CLASSIC_OBJECTIVE_CHEER_AUDIO_PATH'],
    ['applyComboCommands', 'getClassicComboAudioPath'],
    ['onOrdinaryFruitCut', 'getClassicFruitCutAudioSequence'],
    ['attachResult', 'getClassicResultRankAudioPath'],
  ] as const) {
    const owner = method.startsWith('on')
      ? extractMemberBlock(SOURCE, `  private readonly ${method} = (`)
      : extractMethod(SOURCE, method);
    assert.match(owner, /sharedAudioPresenter/);
    assert.ok(owner.includes(sharedClassicPath));
  }
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

function extractMemberBlock(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${signature} must exist`);
  return extractBalancedBlock(source, start);
}

function extractConstBlock(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${signature} must exist`);
  const end = source.indexOf(';', start);
  assert.notEqual(end, -1, `${signature} must terminate`);
  return source.slice(start, end + 1);
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
