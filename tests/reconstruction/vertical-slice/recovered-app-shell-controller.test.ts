import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    'await Promise.all([',
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
  assert.match(
    transition,
    /catch \(error\)[\s\S]*?sharedScene\.currentScreen === null[\s\S]*?attachCurrentScreen\(oldPresenter\.root\)/,
  );
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
