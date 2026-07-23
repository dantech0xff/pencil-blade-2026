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
    'await Promise.all([',
    'await crazyPreparation',
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

test('serialized shell binds all Crazy navigation events and the production owner', () => {
  const onLoad = extractMethod(SOURCE, 'onLoad');
  const onEnable = extractMethod(SOURCE, 'onEnable');
  const onDisable = extractMethod(SOURCE, 'onDisable');

  assert.match(SOURCE, /@requireComponent\(CrazyGameplayController\)/);
  assert.match(onLoad, /CrazyGameplayController,[\s\S]*?'CrazyGameplayController'/);
  for (const event of [
    'CRAZY_RESULT_MENU_REQUESTED_EVENT',
    'CRAZY_PAUSE_QUIT_REQUESTED_EVENT',
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
  assert.match(
    transition,
    /catch \(error\)[\s\S]*?sharedScene\.currentScreen === null[\s\S]*?attachCurrentScreen\(oldPresenter\.root\)/,
  );
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
  assertOrderedSubstrings(rollbackBlock, [
    'const rollbackFailures: unknown[] = []',
    'this.restoreModeSelectAfterFailedCrazyActivation(oldPresenter.root)',
    'if (collisionFilterReleased && !nonClassicPhysics.collisionFilterActive)',
    'nonClassicPhysics.activateCollisionFilter()',
    'if (rollbackFailures.length > 0)',
    "aggregateWithPrimaryError(\n            'Mode Select to Crazy rollback failed'",
  ]);
  assert.match(
    rollbackBlock,
    /restoreModeSelectAfterFailedCrazyActivation[\s\S]*?catch \(rollbackError\) \{[\s\S]*?rollbackFailures\.push\(rollbackError\)[\s\S]*?activateCollisionFilter\(\)[\s\S]*?catch \(rollbackError\) \{[\s\S]*?rollbackFailures\.push\(rollbackError\)/,
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
  assertOrderedSubstrings(transition, [
    "this.stateValue !== 'crazy'",
    'this.requireNonClassicPhysics()',
    '.activateCollisionFilter()',
    'sharedScene.replaceCurrentScreen(nextPresenter.root)',
    'nextPresenter.activate()',
    'commitCrazyMainMenuNavigationRequest(request, previous, source)',
    'this.activeMainMenu = nextPresenter',
    "this.stateValue = 'main-menu'",
  ]);
  const catchIndex = transition.indexOf('} catch (error) {');
  const restoreIndex = transition.indexOf(
    'this.restoreCrazyNavigationRootBeforeRollback(request.root)',
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
  assert.match(resultGuard, /Number\.isFinite\(candidate\.completedRunScore\)/);
  assert.match(resultGuard, /candidate\.completedRunScore >= 0/);
  assertOrderedSubstrings(reject, [
    "request === null || typeof request !== 'object'",
    'return',
    'typeof rollback === \'function\'',
    'rollback.call(request)',
  ]);
});

test('Crazy producer commit errors use the idempotent commit contract before shell rollback', () => {
  const commit = extractMemberBlock(
    SOURCE,
    'function commitCrazyMainMenuNavigationRequest(',
  );
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
  const resultGuard = compileSourceFunction<(request: unknown) => boolean>(
    'isCrazyResultMenuRequestedEvent',
    { Node: ExecutableScreenNode, isValid },
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

  const errorMessage = compileSourceFunction<(error: unknown) => string>('errorMessage');
  const aggregateWithPrimaryError = compileSourceFunction<
    (label: string, primary: unknown, secondary: readonly unknown[]) => Error
  >('aggregateWithPrimaryError', { errorMessage });
  const transitionToCrazy = compileSourceMethod<
    (this: Record<string, unknown>, transaction: Readonly<{
      destination: string;
      root: ExecutableScreenNode;
    }>) => boolean
  >('transitionModeSelectToCrazy', { aggregateWithPrimaryError });

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

test('failed Crazy Main Menu activation releases destination leases before producer rollback', () => {
  const runBestEffortCleanup = compileSourceFunction<
    (label: string, operations: readonly (() => void)[]) => void
  >('runBestEffortCleanup');
  const transition = compileSourceMethod<
    (
      this: Record<string, unknown>,
      request: Readonly<{
        root: ExecutableScreenNode;
        commit(previousRoot: ExecutableScreenNode): void;
        rollback(): void;
      }>,
      source: 'Crazy Pause Quit',
    ) => void
  >('transitionCrazyToMainMenu', { runBestEffortCleanup });
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

  transition.call(shell, request, 'Crazy Pause Quit');
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
