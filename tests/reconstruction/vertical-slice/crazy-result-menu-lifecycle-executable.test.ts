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

const CRAZY_PROFILE = Object.freeze({
  kind: 'crazy',
  mode: 1,
});
const CRAZY_BIRD_PROFILE = Object.freeze({
  kind: 'crazy-bird',
  mode: 4,
});

class TestCrazyLifecycleRollbackError extends Error {
  readonly cause: unknown;
  readonly rollbackErrors: readonly unknown[];

  constructor(
    label: string,
    primary: unknown,
    rollbackErrors: readonly unknown[],
  ) {
    super(label);
    this.name = 'CrazyLifecycleRollbackError';
    this.cause = primary;
    this.rollbackErrors = Object.freeze([...rollbackErrors]);
  }
}

for (const mode of [
  {
    event: 'crazy-result-menu-requested',
    label: 'mode 1',
    profile: CRAZY_PROFILE,
  },
  {
    event: 'crazy-bird-result-menu-requested',
    label: 'mode 4',
    profile: CRAZY_BIRD_PROFILE,
  },
] as const) {
  test(`${mode.label} audio failure rearms Menu for a later successful request`, () => {
    const fixture = createResultMenuFixture(mode.profile);
    fixture.failAudio = true;

    assert.throws(
      () => fixture.onResultMenu.call(fixture.controller),
      /injected Result menu audio failure/,
    );
    assert.equal(fixture.presenter.state.navigation, 'none');
    assert.equal(fixture.rearmCalls(), 1);
    assert.equal(fixture.requests.length, 0);
    assert.equal(fixture.controller.lifecycleFatalError, null);

    fixture.presenter.setNavigation('retry');
    assert.doesNotThrow(() => fixture.onResultRetry.call(fixture.controller));
    assert.equal(fixture.restarts(), 1);

    fixture.failAudio = false;
    fixture.presenter.setNavigation('menu');
    fixture.listener = (payload) => payload.rollback();
    assert.doesNotThrow(() => fixture.onResultMenu.call(fixture.controller));
    assert.equal(fixture.presenter.state.navigation, 'none');
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.requests[0]?.type, mode.event);
    assert.equal(fixture.controller.lifecycleFatalError, null);
  });

  for (const failurePoint of ['configuration', 'root'] as const) {
    test(`${mode.label} ${failurePoint} preflight failure rearms Menu`, () => {
      const fixture = createResultMenuFixture(mode.profile);
      fixture.preflightFailure = failurePoint;

      assert.throws(
        () => fixture.onResultMenu.call(fixture.controller),
        new RegExp(`injected Result menu ${failurePoint} failure`),
      );
      assert.equal(fixture.presenter.state.navigation, 'none');
      assert.equal(fixture.rearmCalls(), 1);
      assert.equal(fixture.requests.length, 0);
      assert.equal(fixture.controller.lifecycleFatalError, null);
    });
  }

  test(`${mode.label} listener failure rolls back and leaves Result navigation usable`, () => {
    const fixture = createResultMenuFixture(mode.profile);
    fixture.listener = () => {
      throw new Error('injected Result menu listener failure');
    };

    assert.throws(
      () => fixture.onResultMenu.call(fixture.controller),
      /injected Result menu listener failure/,
    );
    assert.equal(fixture.presenter.state.navigation, 'none');
    assert.equal(fixture.rearmCalls(), 1);
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.controller.lifecycleFatalError, null);
    assert.equal(fixture.snapshots(), 1);
  });

  test(`${mode.label} rollback rearm failure retains one typed fatal boundary`, () => {
    const fixture = createResultMenuFixture(mode.profile);
    fixture.presenter.failRearm = true;
    fixture.listener = () => {
      throw new Error('injected Result menu listener failure');
    };

    let thrown: unknown;
    try {
      fixture.onResultMenu.call(fixture.controller);
      assert.fail('rollback/rearm failure must throw');
    } catch (error) {
      thrown = error;
    }
    assert.ok(thrown instanceof TestCrazyLifecycleRollbackError);
    assert.equal(fixture.controller.lifecycleFatalError, thrown);
    assert.ok(
      thrown.cause instanceof Error
      && /listener failure/.test(thrown.cause.message),
    );
    assert.equal(thrown.rollbackErrors.length, 1);
    assert.equal(fixture.presenter.state.navigation, 'menu');
    assert.equal(fixture.snapshots(), 0);

    const retainedRequestCount = fixture.requests.length;
    assert.doesNotThrow(() => fixture.onResultMenu.call(fixture.controller));
    assert.equal(fixture.requests.length, retainedRequestCount);
    assert.equal(fixture.controller.lifecycleFatalError, thrown);
  });
}

for (const [profile, primaryKind] of [
  [CRAZY_PROFILE, 'direct'],
  [CRAZY_PROFILE, 'nested'],
  [CRAZY_BIRD_PROFILE, 'direct'],
  [CRAZY_BIRD_PROFILE, 'nested'],
] as const) {
  test(
    `${profile.kind} activation keeps ${primaryKind} fatal lifecycle identity after cleanup failure`,
    () => {
      const containsFatal = compileGameplayLifecycleClassifier();
      const activate = compileSourceMethod<
        (this: Record<string, any>, placement: object, profile: object) => void
      >('activateTimedModeFromAppShell', {
        CRAZY_BIRD_TIMED_PROFILE: CRAZY_BIRD_PROFILE,
        CrazyLifecycleRollbackError: TestCrazyLifecycleRollbackError,
        aggregateWithPrimary() {
          throw new Error('typed lifecycle failure must not use plain aggregation');
        },
        assertScreenPlacementPort() {},
        collectCleanupFailure,
        containsCrazyLifecycleRollbackError: containsFatal,
        timedModeLabel(candidate: object) {
          return candidate === CRAZY_BIRD_PROFILE ? 'Crazy Bird' : 'Crazy';
        },
      });
      const fatal = new TestCrazyLifecycleRollbackError(
        'injected fatal scene activation',
        new Error('injected Physics2D ownership failure'),
        [],
      );
      const primary = primaryKind === 'direct'
        ? fatal
        : Object.assign(new Error('nested scene activation wrapper'), {
          cause: fatal,
        });
      const cleanupFailure = new Error('injected detached presentation cleanup failure');
      const placement = { currentScreen: null };
      const controller: Record<string, any> = {
        crazyBirdReadinessStatus: 'ready',
        crazyModeRoot: null,
        readinessStatus: 'ready',
        resultPresentationRoot: null,
        resultPresenter: null,
        screenPlacement: null,
        shuttingDown: false,
        attachCrazyModeAndActivateScene() {
          throw primary;
        },
        captureCrazyActivationObjectiveRollback() {
          return null;
        },
        constructCrazyMode() {
          this.crazyModeRoot = {};
        },
        disposeCrazyModePresentation() {
          throw cleanupFailure;
        },
        drainRetiredCrazyRunOwnership() {},
        emitSnapshot() {},
        restoreCrazyActivationObjective() {},
        updateScorePresentation() {},
      };

      let thrown: unknown;
      try {
        activate.call(controller, placement, profile);
        assert.fail('fatal activation plus cleanup failure must throw');
      } catch (error) {
        thrown = error;
      }
      assert.ok(thrown instanceof TestCrazyLifecycleRollbackError);
      assert.equal(thrown.cause, primary);
      assert.deepEqual(thrown.rollbackErrors, [cleanupFailure]);
      assert.equal(controller.screenPlacement, null);
    },
  );
}

for (const profile of [CRAZY_PROFILE, CRAZY_BIRD_PROFILE] as const) {
  for (const fatalLocation of ['primary', 'cleanup'] as const) {
    test(
      `${profile.kind} activation preserves fatal lifecycle poison in a cyclic ${fatalLocation} aggregate graph`,
      () => {
        const containsFatal = compileGameplayLifecycleClassifier();
        const activate = compileSourceMethod<
          (this: Record<string, any>, placement: object, profile: object) => void
        >('activateTimedModeFromAppShell', {
          CRAZY_BIRD_TIMED_PROFILE: CRAZY_BIRD_PROFILE,
          CrazyLifecycleRollbackError: TestCrazyLifecycleRollbackError,
          aggregateWithPrimary() {
            throw new Error('nested fatal lifecycle failure must not use plain aggregation');
          },
          assertScreenPlacementPort() {},
          collectCleanupFailure,
          containsCrazyLifecycleRollbackError: containsFatal,
          timedModeLabel(candidate: object) {
            return candidate === CRAZY_BIRD_PROFILE ? 'Crazy Bird' : 'Crazy';
          },
        });
        const fatal = new TestCrazyLifecycleRollbackError(
          'injected fatal scene activation',
          new Error('injected Physics2D ownership failure'),
          [],
        );
        const aggregate = createCyclicAggregateLike(
          `injected ${fatalLocation} aggregate`,
          fatal,
        );
        const primary = fatalLocation === 'primary'
          ? aggregate
          : new Error('injected nonfatal scene activation failure');
        const cleanupFailure = fatalLocation === 'cleanup'
          ? aggregate
          : new Error('injected detached presentation cleanup failure');
        const placement = { currentScreen: null };
        const controller: Record<string, any> = {
          crazyBirdReadinessStatus: 'ready',
          crazyModeRoot: null,
          readinessStatus: 'ready',
          resultPresentationRoot: null,
          resultPresenter: null,
          screenPlacement: null,
          shuttingDown: false,
          attachCrazyModeAndActivateScene() {
            throw primary;
          },
          captureCrazyActivationObjectiveRollback() {
            return null;
          },
          constructCrazyMode() {
            this.crazyModeRoot = {};
          },
          disposeCrazyModePresentation() {
            throw cleanupFailure;
          },
          drainRetiredCrazyRunOwnership() {},
          emitSnapshot() {},
          restoreCrazyActivationObjective() {},
          updateScorePresentation() {},
        };

        let thrown: unknown;
        try {
          activate.call(controller, placement, profile);
          assert.fail('fatal aggregate plus cleanup failure must throw');
        } catch (error) {
          thrown = error;
        }
        assert.ok(thrown instanceof TestCrazyLifecycleRollbackError);
        assert.equal(thrown.cause, primary);
        assert.deepEqual(thrown.rollbackErrors, [cleanupFailure]);
        assert.equal(containsWithShellCompatibleGraphSemantics(thrown), true);
        assert.equal(
          containsWithShellCompatibleGraphSemantics(
            fatalLocation === 'primary'
              ? thrown.cause
              : thrown.rollbackErrors[0],
          ),
          true,
        );
        assert.equal(controller.screenPlacement, null);
      },
    );
  }
}

test('gameplay cleanup aggregation retains its primary and complete frozen error graph', () => {
  const aggregateWithPrimary = compileSourceFunction<
    (
      label: string,
      primary: unknown,
      cleanupFailures: readonly unknown[],
    ) => Error & {
      readonly cause: unknown;
      readonly errors: readonly unknown[];
    }
  >('aggregateWithPrimary', {
    errorMessage(error: unknown) {
      return error instanceof Error ? error.message : String(error);
    },
  });
  const fatal = new TestCrazyLifecycleRollbackError(
    'injected nested lifecycle fatal',
    new Error('injected Physics2D ownership failure'),
    [],
  );
  const primary = new Error('injected primary failure');
  const cleanupAggregate = createCyclicAggregateLike(
    'injected cleanup aggregate',
    fatal,
  );
  const opaqueCleanupFailure = Object.freeze({ message: 'opaque cleanup failure' });

  const aggregated = aggregateWithPrimary(
    'Crazy activation rollback failed',
    primary,
    [cleanupAggregate, opaqueCleanupFailure],
  );

  assert.equal(aggregated.cause, primary);
  assert.deepEqual(
    aggregated.errors,
    [primary, cleanupAggregate, opaqueCleanupFailure],
  );
  assert.equal(Object.isFrozen(aggregated.errors), true);
  assert.equal(aggregated.errors[1], cleanupAggregate);
  assert.equal(containsWithShellCompatibleGraphSemantics(aggregated), true);
});

test('committed Result Menu stays idempotent after post-commit cleanup reporting fails', () => {
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
      throw new Error('injected committed Result menu cleanup report failure');
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
    profile: CRAZY_PROFILE,
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
    /injected committed Result menu cleanup report failure/,
  );
  assert.equal(transaction.status, 'committed');
  assert.doesNotThrow(
    () => commit.call(controller, transaction, { unexpected: true }),
  );
  assert.equal(presenter.disposeCalls, 1);
  assert.equal(root.destroyCalls, 1);
});

function createResultMenuFixture(profile: object) {
  const rollback = compileSourceMethod<
    (this: Record<string, any>, transaction: Record<string, any>) => void
  >('rollbackResultMenu', {
    isValid: () => true,
  });
  const retainFatal = compileSourceMethod<
    (this: Record<string, any>, error: TestCrazyLifecycleRollbackError) => void
  >('retainFatalLifecycleBoundary', {});
  const onResultMenu = compileSourceArrowMember<
    (this: Record<string, any>) => void
  >('onResultMenu', {
    CRAZY_BIRD_RESULT_MENU_REQUESTED_EVENT: 'crazy-bird-result-menu-requested',
    CRAZY_BIRD_RESULT_MODE_ID: 4,
    CRAZY_BIRD_TIMED_PROFILE: CRAZY_BIRD_PROFILE,
    CRAZY_RESULT_MENU_REQUESTED_EVENT: 'crazy-result-menu-requested',
    CRAZY_RESULT_MODE_ID: 1,
    CrazyLifecycleRollbackError: TestCrazyLifecycleRollbackError,
    collectCleanupFailure,
    createCrazyBirdResultNavigationCommands: resultMenuCommands,
    createCrazyResultNavigationCommands: resultMenuCommands,
  });
  const onResultRetry = compileSourceArrowMember<
    (this: Record<string, any>) => void
  >('onResultRetry', {
    CRAZY_BIRD_RESULT_RETRY_FAILED_EVENT: 'crazy-bird-result-retry-failed',
    CRAZY_BIRD_TIMED_PROFILE: CRAZY_BIRD_PROFILE,
    CRAZY_RESULT_RETRY_FAILED_EVENT: 'crazy-result-retry-failed',
    normalizeError(error: unknown, fallback: string) {
      return error instanceof Error ? error : new Error(fallback);
    },
  });

  const root = { parent: {} };
  const placement = { currentScreen: root };
  let navigation: 'menu' | 'none' | 'retry' = 'menu';
  let rearmCallCount = 0;
  let restartCount = 0;
  let snapshotCount = 0;
  const requests: Array<{ readonly payload: ResultMenuPayload; readonly type: string }> = [];
  const fixture: {
    failAudio: boolean;
    listener: ((payload: ResultMenuPayload) => void) | null;
    preflightFailure: 'configuration' | 'root' | null;
  } = {
    failAudio: false,
    listener: null,
    preflightFailure: null,
  };
  const presenter = {
    failRearm: false,
    get state() {
      return { navigation };
    },
    rearmNavigationAfterFailure(expected: string) {
      assert.equal(expected, 'menu');
      rearmCallCount += 1;
      if (this.failRearm) {
        return false;
      }
      navigation = 'none';
      return true;
    },
    setNavigation(value: 'menu' | 'none' | 'retry') {
      navigation = value;
    },
  };
  const controller: Record<string, any> = {
    lifecycleFatalError: null,
    resultPresentationRoot: root,
    resultPresenter: presenter,
    configuredResult() {
      if (fixture.preflightFailure === 'configuration') {
        throw new Error('injected Result menu configuration failure');
      }
      return { mode: profile === CRAZY_BIRD_PROFILE ? 4 : 1, profile, score: 42 };
    },
    effectsEnabled: () => true,
    emitCommand() {},
    emitSnapshot() {
      snapshotCount += 1;
    },
    node: {
      emit(type: string, payload: ResultMenuPayload) {
        requests.push({ payload, type });
        fixture.listener?.(payload);
      },
    },
    requireAttachedResultRoot() {
      if (fixture.preflightFailure === 'root') {
        throw new Error('injected Result menu root failure');
      }
      return root;
    },
    requireClassicGameplayController: () => ({
      sharedAudioPresenter: {
        playOneShot() {
          if (fixture.failAudio) {
            throw new Error('injected Result menu audio failure');
          }
        },
      },
    }),
    requireResultPresenter: () => presenter,
    requireScreenPlacement: () => placement,
    restartCrazyFromResult() {
      restartCount += 1;
    },
    retainFatalLifecycleBoundary(error: TestCrazyLifecycleRollbackError) {
      return retainFatal.call(this, error);
    },
    rollbackResultMenu(transaction: Record<string, any>) {
      return rollback.call(this, transaction);
    },
    unschedule() {},
  };

  return Object.assign(fixture, {
    controller,
    onResultMenu,
    onResultRetry,
    presenter,
    rearmCalls: () => rearmCallCount,
    requests,
    restarts: () => restartCount,
    snapshots: () => snapshotCount,
  });
}

interface ResultMenuPayload {
  readonly completedRunScore: number;
  readonly resultRoot: object;
  commit(previousRoot: object): void;
  rollback(): void;
}

function resultMenuCommands(options: Readonly<{
  readonly effectsEnabled: boolean;
}>): readonly object[] {
  return options.effectsEnabled
    ? Object.freeze([
      Object.freeze({
        canonicalPath: 'Sounds/menu.wav',
        type: 'request-menu-button-audio',
      }),
    ])
    : Object.freeze([]);
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

function createCyclicAggregateLike(
  label: string,
  fatal: TestCrazyLifecycleRollbackError,
): Error {
  const aggregate = new Error(label) as Error & {
    cause: unknown;
    errors: readonly unknown[];
  };
  const causes = Object.freeze([
    Object.freeze({
      rollbackErrors: Object.freeze([fatal]),
    }),
  ]);
  aggregate.cause = aggregate;
  aggregate.errors = Object.freeze([
    Object.freeze({ causes }),
  ]);
  return aggregate;
}

function containsWithShellCompatibleGraphSemantics(error: unknown): boolean {
  const pending: unknown[] = [error];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const candidate = pending.pop();
    if (candidate instanceof TestCrazyLifecycleRollbackError) {
      return true;
    }
    if (
      candidate === null
      || (typeof candidate !== 'object' && typeof candidate !== 'function')
    ) {
      continue;
    }
    const identity = candidate as object;
    if (visited.has(identity)) {
      continue;
    }
    visited.add(identity);
    for (const key of ['cause', 'errors', 'causes', 'rollbackErrors']) {
      let value: unknown;
      try {
        value = Reflect.get(identity, key);
      } catch {
        continue;
      }
      if (Array.isArray(value)) {
        pending.push(...value);
      } else if (value !== undefined) {
        pending.push(value);
      }
    }
  }
  return false;
}

function compileGameplayLifecycleClassifier(): (error: unknown) => boolean {
  const enqueueErrorGraphValue = compileSourceFunction<
    (pending: unknown[], value: unknown) => void
  >('enqueueCrazyLifecycleErrorGraphValue', {});
  const readErrorGraphValue = compileSourceFunction<
    (value: object, key: string) => unknown
  >('readCrazyLifecycleErrorGraphValue', {});
  return compileSourceFunction<(error: unknown) => boolean>(
    'containsCrazyLifecycleRollbackError',
    {
      CrazyLifecycleRollbackError: TestCrazyLifecycleRollbackError,
      enqueueCrazyLifecycleErrorGraphValue: enqueueErrorGraphValue,
      readCrazyLifecycleErrorGraphValue: readErrorGraphValue,
    },
  );
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
    new RegExp(`^\\s*private\\s+readonly\\s+${memberName}\\s*=\\s*\\(\\)\\s*:\\s*void\\s*=>`),
    `function ${memberName}()`,
  );
  return compileTypeScriptFunction<T>(source, memberName, dependencies);
}

function compileSourceFunction<T extends (...args: any[]) => unknown>(
  functionName: string,
  dependencies: Readonly<Record<string, unknown>>,
): T {
  const source = extractFunction(SOURCE, functionName);
  return compileTypeScriptFunction<T>(source, functionName, dependencies);
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
    sourceUrl: `crazy-result-menu-lifecycle.${functionName}.ts`,
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

function extractFunction(source: string, functionName: string): string {
  const signature = new RegExp(`^function ${functionName}\\b`, 'm');
  const match = signature.exec(source);
  assert.ok(match, `${functionName} function must exist`);
  return extractBalancedBlock(source, match.index);
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
