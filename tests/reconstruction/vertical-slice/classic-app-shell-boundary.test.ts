import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  assert.match(
    activate,
    /catch \(error\)[\s\S]*?rollbackClassicLayerRestart\(\)[\s\S]*?disposeClassicModePresentation\(\)[\s\S]*?this\.screenPlacement = retainedScreenPlacement[\s\S]*?throw error/,
  );
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
  assert.match(
    activate,
    /catch \(error\)[\s\S]*?rollbackClassicLayerRestart\(\)[\s\S]*?disposeClassicModePresentation\(\)[\s\S]*?this\.screenPlacement = retainedScreenPlacement/,
  );
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

function readGameplaySource(): string {
  return readFileSync(
    `${REPOSITORY_ROOT}/game/assets/scripts/creator/classic-gameplay-controller.ts`,
    'utf8',
  );
}

function extractMethod(source: string, methodName: string): string {
  const signature = new RegExp(
    `^\\s*(?:private\\s+)?(?:readonly\\s+)?(?:async\\s+)?${methodName}\\b`,
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

function assertOrderedSubstrings(source: string, expected: readonly string[]): void {
  let previousIndex = -1;
  for (const value of expected) {
    const index = source.indexOf(value);
    assert.ok(index > previousIndex, `${value} must appear in recovered order`);
    previousIndex = index;
  }
}
