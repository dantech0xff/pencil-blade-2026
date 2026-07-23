import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SOURCE = readFileSync(
  `${REPOSITORY_ROOT}/game/assets/scripts/creator/combo-bird-gameplay-controller.ts`,
  'utf8',
);

class TestComboBirdLifecycleRollbackError extends Error {
  readonly cause: unknown;
  readonly rollbackErrors: readonly unknown[];

  constructor(
    label: string,
    primary: unknown,
    rollbackErrors: readonly unknown[],
  ) {
    super(label);
    this.name = 'ComboBirdLifecycleRollbackError';
    this.cause = primary;
    this.rollbackErrors = Object.freeze([...rollbackErrors]);
  }
}

test('Result Menu producer rollback rearms navigation for another request', () => {
  const fixture = createResultMenuFixture();
  fixture.listener = (payload) => payload.rollback();

  assert.doesNotThrow(() => fixture.onResultMenu.call(fixture.controller));
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.presenter.state.navigation, 'none');
  assert.equal(fixture.rearmCalls(), 1);
  assert.equal(fixture.snapshots(), 1);
  assert.equal(fixture.controller.lifecycleFatalError, null);

  fixture.presenter.setNavigation('menu');
  fixture.listener = (payload) => payload.rollback();
  assert.doesNotThrow(() => fixture.onResultMenu.call(fixture.controller));
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.presenter.state.navigation, 'none');
});

test('Result Menu shell replacement commits and disposes its source exactly once', () => {
  const fixture = createResultMenuFixture();
  const destination = { parent: null };
  fixture.listener = (payload) => {
    const previous = fixture.placement.replaceCurrentScreen(destination);
    assert.equal(previous, fixture.root);
    payload.commit(previous);
  };

  assert.doesNotThrow(() => fixture.onResultMenu.call(fixture.controller));
  assert.equal(fixture.placement.currentScreen, destination);
  assert.equal(fixture.controller.resultPresentationRoot, null);
  assert.equal(fixture.controller.resultPresenter, null);
  assert.equal(fixture.presenter.disposeCalls, 1);
  assert.equal(fixture.root.destroyCalls, 1);

  const payload = fixture.requests[0];
  assert.ok(payload);
  assert.doesNotThrow(() => payload.commit({ unexpected: true }));
  assert.equal(fixture.presenter.disposeCalls, 1);
  assert.equal(fixture.root.destroyCalls, 1);
});

test('Result Menu rollback failure retains one typed fatal boundary', () => {
  const fixture = createResultMenuFixture();
  fixture.presenter.failRearm = true;
  fixture.listener = () => {
    throw new Error('injected Combo Bird Result menu listener failure');
  };

  let thrown: unknown;
  try {
    fixture.onResultMenu.call(fixture.controller);
    assert.fail('failed Result Menu rollback must throw');
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof TestComboBirdLifecycleRollbackError);
  assert.equal(fixture.controller.lifecycleFatalError, thrown);
  assert.equal(fixture.presenter.state.navigation, 'menu');

  const retainedRequests = fixture.requests.length;
  assert.doesNotThrow(() => fixture.onResultMenu.call(fixture.controller));
  assert.equal(fixture.requests.length, retainedRequests);
});

function createResultMenuFixture() {
  const rollback = compileSourceMethod<
    (this: Record<string, any>, transaction: Record<string, any>) => void
  >('rollbackResultMenu', {
    collectCleanupFailure,
    isValid: (value: { destroyed?: boolean }) => value.destroyed !== true,
    reportCleanupFailures() {},
  });
  const commit = compileSourceMethod<
    (
      this: Record<string, any>,
      transaction: Record<string, any>,
      previousRoot: object,
    ) => void
  >('commitResultMenu', {
    collectCleanupFailure,
    isValid: (value: { destroyed?: boolean }) => value.destroyed !== true,
    reportCleanupFailures() {},
  });
  const retainFatal = compileSourceMethod<
    (
      this: Record<string, any>,
      error: TestComboBirdLifecycleRollbackError,
    ) => void
  >('retainFatalLifecycleBoundary', {});
  const onResultMenu = compileSourceArrowMember<
    (this: Record<string, any>) => void
  >('onResultMenu', {
    COMBO_BIRD_RESULT_MENU_REQUESTED_EVENT:
      'combo-bird-result-menu-requested',
    COMBO_BIRD_RESULT_MODE_ID: 5,
    ComboBirdLifecycleRollbackError:
      TestComboBirdLifecycleRollbackError,
    createComboBirdResultNavigationCommands() {
      return Object.freeze([
        Object.freeze({
          canonicalPath: 'Sounds/menu.wav',
          type: 'request-menu-button-audio',
        }),
      ]);
    },
  });

  const host = {};
  const root = {
    destroyCalls: 0,
    destroyed: false,
    parent: host as object | null,
    destroy() {
      this.destroyCalls += 1;
      this.destroyed = true;
      this.parent = null;
    },
  };
  const placement = createPlacement(host, root);
  let navigation: 'menu' | 'none' = 'menu';
  let rearmCount = 0;
  let snapshotCount = 0;
  const presenter = {
    disposeCalls: 0,
    failRearm: false,
    get state() {
      return { navigation };
    },
    dispose() {
      this.disposeCalls += 1;
    },
    rearmNavigationAfterFailure(expected: string) {
      assert.equal(expected, 'menu');
      rearmCount += 1;
      if (this.failRearm) {
        return false;
      }
      navigation = 'none';
      return true;
    },
    setNavigation(value: 'menu' | 'none') {
      navigation = value;
    },
  };
  const requests: ResultMenuPayload[] = [];
  const fixture: {
    listener: ((payload: ResultMenuPayload) => void) | null;
  } = {
    listener: null,
  };
  const controller: Record<string, any> = {
    lifecycleFatalError: null,
    resultPresentationRoot: root,
    resultPresenter: presenter,
    configuredResult: () => ({ mode: 5, score: 42 }),
    effectsEnabled: () => true,
    emitCommand() {},
    emitSnapshot() {
      snapshotCount += 1;
    },
    node: {
      emit(type: string, payload: ResultMenuPayload) {
        assert.equal(type, 'combo-bird-result-menu-requested');
        requests.push(payload);
        fixture.listener?.(payload);
      },
    },
    onSwishCooldownComplete() {},
    requireAttachedResultRoot: () => root,
    requireClassicGameplayController: () => ({
      sharedAudioPresenter: {
        playOneShot() {},
      },
    }),
    requireResultPresenter: () => presenter,
    requireScreenPlacement: () => placement,
    retainFatalLifecycleBoundary(
      error: TestComboBirdLifecycleRollbackError,
    ) {
      return retainFatal.call(this, error);
    },
    rollbackResultMenu(transaction: Record<string, any>) {
      return rollback.call(this, transaction);
    },
    commitResultMenu(
      transaction: Record<string, any>,
      previousRoot: object,
    ) {
      return commit.call(this, transaction, previousRoot);
    },
    unschedule() {},
  };

  return Object.assign(fixture, {
    controller,
    onResultMenu,
    placement,
    presenter,
    rearmCalls: () => rearmCount,
    requests,
    root,
    snapshots: () => snapshotCount,
  });
}

function createPlacement(host: object, initial: { parent: object | null }) {
  return {
    currentScreen: initial as object | null,
    attachCurrentScreen(next: { parent: object | null }) {
      assert.equal(this.currentScreen, null);
      next.parent = host;
      this.currentScreen = next;
    },
    replaceCurrentScreen(next: { parent: object | null }) {
      const previous = this.currentScreen as {
        parent?: object | null;
      } | null;
      if (previous !== null && 'parent' in previous) {
        previous.parent = null;
      }
      next.parent = host;
      this.currentScreen = next;
      return previous;
    },
  };
}

interface ResultMenuPayload {
  readonly completedRunScore: number;
  readonly resultRoot: object;
  commit(previousRoot: object): void;
  rollback(): void;
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

function compileSourceMethod<T extends (...args: any[]) => unknown>(
  methodName: string,
  dependencies: Readonly<Record<string, unknown>>,
): T {
  const source = extractMethod(SOURCE, methodName).replace(
    new RegExp(`^\\s*(?:private\\s+)?${methodName}`),
    `function ${methodName}`,
  );
  return compileTypeScriptFunction<T>(source, methodName, dependencies);
}

function compileSourceArrowMember<T extends (...args: any[]) => unknown>(
  memberName: string,
  dependencies: Readonly<Record<string, unknown>>,
): T {
  const source = extractMemberBlock(
    SOURCE,
    `  private readonly ${memberName} = ()`,
  ).replace(
    new RegExp(
      `^\\s*private\\s+readonly\\s+${memberName}\\s*=\\s*\\(\\)\\s*:\\s*void\\s*=>`,
    ),
    `function ${memberName}()`,
  );
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
    sourceUrl: `combo-bird-result-menu-lifecycle.${functionName}.ts`,
  });
  return Function(
    ...names,
    `"use strict";\n${javascript}\nreturn ${functionName};`,
  )(...values) as T;
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
  assert.notEqual(openBrace, -1, 'function body must start');
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
  throw new Error('function body is unterminated');
}
