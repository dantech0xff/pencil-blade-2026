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

test('Result Retry commits one fresh run and snapshot observers are report-only', () => {
  const fixture = createRetryFixture('success');
  fixture.failSnapshot = true;

  assert.doesNotThrow(() => fixture.restart.call(fixture.controller));
  assert.equal(fixture.scene.active, true);
  assert.equal(fixture.placement.currentScreen, fixture.freshRoot());
  assert.equal(fixture.presenter.disposeCalls, 1);
  assert.equal(fixture.resultRoot.destroyCalls, 1);
  assert.equal(fixture.controller.resultPresenter, null);
  assert.equal(fixture.controller.resultPresentationRoot, null);
  assert.equal(fixture.reportedFailures().length, 1);
  assert.match(
    String(fixture.reportedFailures()[0]),
    /snapshot observer failure/,
  );
});

test('Result Retry nonfatal activation failure restores and rearms Result', () => {
  const fixture = createRetryFixture('nonfatal');

  assert.throws(
    () => fixture.restart.call(fixture.controller),
    /injected nonfatal retry activation failure/,
  );
  assert.equal(fixture.scene.active, false);
  assert.equal(fixture.placement.currentScreen, fixture.resultRoot);
  assert.equal(fixture.resultRoot.parent, fixture.host);
  assert.equal(fixture.presenter.state.navigation, 'none');
  assert.equal(fixture.presenter.rearmCalls, 1);
  assert.equal(fixture.objectiveRestores(), 1);
  assert.equal(fixture.controller.lifecycleFatalError, null);
});

test('Result Retry fatal activation failure releases fresh leases and poisons retries', () => {
  const fixture = createRetryFixture('fatal');

  let thrown: unknown;
  try {
    fixture.restart.call(fixture.controller);
    assert.fail('fatal retry activation must throw');
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof TestComboBirdLifecycleRollbackError);
  assert.equal(fixture.controller.lifecycleFatalError, thrown);
  assert.equal(fixture.scene.active, false);
  assert.equal(fixture.scene.releaseCalls, 1);
  assert.equal(fixture.placement.currentScreen, fixture.resultRoot);
  assert.equal(fixture.presenter.state.navigation, 'none');
});

test('Pause Quit clears leases before shell activation and rollback restores them', () => {
  const fixture = createPauseQuitFixture();
  fixture.listener = (payload) => {
    assert.deepEqual(fixture.audioSnapshot(), {
      classicEffectsPaused: false,
      classicMusicPaused: false,
      timerPaused: false,
    });
    payload.rollback();
  };

  assert.doesNotThrow(() => fixture.request.call(fixture.controller));
  assert.equal(fixture.scene.active, true);
  assert.equal(fixture.scene.suspended, false);
  assert.equal(fixture.pause.ingressCalls, 1);
  assert.deepEqual(fixture.audioSnapshot(), {
    classicEffectsPaused: true,
    classicMusicPaused: true,
    timerPaused: true,
  });
  assert.equal(fixture.controller.lifecycleFatalError, null);
});

test('early Pause Replay failure preserves the existing ingress and restores leases once', () => {
  const fixture = createPauseReplayEarlyFailureFixture();

  assert.throws(
    () => fixture.restart.call(fixture.controller),
    /injected standby construction failure/,
  );
  assert.equal(fixture.pause.resumeCalls, 0);
  assert.equal(fixture.pause.ingressCalls, 0);
  assert.equal(fixture.scene.active, true);
  assert.equal(fixture.scene.suspended, false);
  assert.deepEqual(fixture.audioSnapshot(), {
    classicEffectsPaused: true,
    classicMusicPaused: true,
    timerPaused: true,
  });
  assert.equal(fixture.controller.lifecycleFatalError, null);
});

function createRetryFixture(
  failure: 'fatal' | 'nonfatal' | 'success',
) {
  const reported: unknown[] = [];
  const restart = compileSourceMethod<
    (this: Record<string, any>) => void
  >('restartFromResult', {
    COMBO_BIRD_RESULT_MODE_ID: 5,
    ComboBirdLifecycleRollbackError:
      TestComboBirdLifecycleRollbackError,
    assertNever(value: never): never {
      throw new Error(`unexpected retry command ${String(value)}`);
    },
    collectCleanupFailure,
    createComboBirdResultNavigationCommands: retryCommands,
    isValid: (value: { destroyed?: boolean }) => value.destroyed !== true,
    reportCleanupFailures(
      _label: string,
      failures: readonly unknown[],
    ) {
      reported.push(...failures);
    },
  });
  const retainFatal = compileSourceMethod<
    (
      this: Record<string, any>,
      error: TestComboBirdLifecycleRollbackError,
    ) => void
  >('retainFatalLifecycleBoundary', {});

  const host = {};
  const resultRoot = createRoot(host);
  const placement = createPlacement(host, resultRoot);
  let freshRoot: ReturnType<typeof createRoot> | null = null;
  let objectiveRestoreCount = 0;
  const presenter = createRetryPresenter();
  const scene = {
    active: false,
    suspended: false,
    releaseCalls: 0,
    releaseComboBirdLayerForReplacement() {
      this.releaseCalls += 1;
      this.active = false;
      this.suspended = false;
    },
    suspendComboBirdLayerForNavigation() {
      this.active = false;
      this.suspended = true;
    },
  };
  const fixture = {
    failSnapshot: false,
  };
  const controller: Record<string, any> = {
    lifecycleFatalError: null,
    modeRoot: null,
    pendingResultConfiguration: { mode: 5, score: 42 },
    resultPresentationRoot: resultRoot,
    resultPresenter: presenter,
    attachModeAndActivateScene(screenPlacement: typeof placement) {
      const root = freshRoot;
      assert.ok(root);
      screenPlacement.attachCurrentScreen(root);
      if (failure === 'nonfatal') {
        throw new Error('injected nonfatal retry activation failure');
      }
      scene.active = true;
      if (failure === 'fatal') {
        throw new TestComboBirdLifecycleRollbackError(
          'injected fatal retry activation failure',
          new Error('injected Bird input lease failure'),
          [],
        );
      }
    },
    captureActivationObjectiveRollback: () => ({
      objectiveId: 49,
      value: 7,
    }),
    configuredResult: () => ({ mode: 5, score: 42 }),
    constructMode() {
      freshRoot = createRoot(null);
      this.modeRoot = freshRoot;
      this.pendingResultConfiguration = null;
    },
    disposeModePresentation() {
      const root = this.modeRoot as ReturnType<typeof createRoot> | null;
      if (root !== null && placement.currentScreen === root) {
        placement.detachCurrentScreen(root);
      }
      root?.destroy();
      this.modeRoot = null;
    },
    drainRetiredRuns() {},
    effectsEnabled: () => false,
    emitCommand() {},
    emitSnapshot() {
      if (fixture.failSnapshot) {
        throw new Error('injected snapshot observer failure');
      }
    },
    onSwishCooldownComplete() {},
    quiesceSceneAfterFailedRelease(
      candidate: typeof scene,
      _label: string,
      failures: unknown[],
    ) {
      if (candidate.active) {
        collectCleanupFailure(
          failures,
          () => candidate.releaseComboBirdLayerForReplacement(),
        );
      }
      if (candidate.active) {
        collectCleanupFailure(
          failures,
          () => candidate.suspendComboBirdLayerForNavigation(),
        );
      }
    },
    requireAttachedResultRoot: () => resultRoot,
    requireClassicGameplayController: () => ({
      sharedAudioPresenter: { playOneShot() {} },
    }),
    requireResultPresenter: () => presenter,
    requireSceneController: () => scene,
    requireScreenPlacement: () => placement,
    restoreActivationObjective() {
      objectiveRestoreCount += 1;
    },
    retainFatalLifecycleBoundary(
      error: TestComboBirdLifecycleRollbackError,
    ) {
      return retainFatal.call(this, error);
    },
    unschedule() {},
  };

  return Object.assign(fixture, {
    controller,
    freshRoot: () => freshRoot,
    host,
    objectiveRestores: () => objectiveRestoreCount,
    placement,
    presenter,
    reportedFailures: () => reported,
    restart,
    resultRoot,
    scene,
  });
}

function createPauseQuitFixture() {
  const request = compileSourceArrowMember<
    (this: Record<string, any>) => void
  >('onPauseQuitRequested', {
    COMBO_BIRD_PAUSE_QUIT_REQUESTED_EVENT:
      'combo-bird-pause-quit-requested',
    ComboBirdLifecycleRollbackError:
      TestComboBirdLifecycleRollbackError,
  });
  const rollback = compileSourceMethod<
    (this: Record<string, any>, transaction: Record<string, any>) => void
  >('rollbackPauseQuit', {
    ComboBirdLifecycleRollbackError:
      TestComboBirdLifecycleRollbackError,
    collectCleanupFailure,
    isValid: () => true,
    reportCleanupFailures() {},
  });
  const releaseAudio = compileSourceMethod<
    (this: Record<string, any>) => void
  >('releasePauseAudioForNavigation', {
    cleanupError,
    collectCleanupFailure,
  });
  const restoreAudio = compileSourceMethod<
    (this: Record<string, any>, snapshot: Record<string, boolean>) => void
  >('restorePauseAudioAfterNavigationRollback', {
    cleanupError,
    collectCleanupFailure,
  });
  const retainFatal = compileSourceMethod<
    (
      this: Record<string, any>,
      error: TestComboBirdLifecycleRollbackError,
    ) => void
  >('retainFatalLifecycleBoundary', {});

  const audio = createPauseAudioState();
  const host = {};
  const root = createRoot(host);
  const placement = createPlacement(host, root);
  const scene = createSuspendableScene();
  const pause = {
    ingressCalls: 0,
    resumeCalls: 0,
    pauseIngress() {
      this.ingressCalls += 1;
    },
    resumeEgress() {
      this.resumeCalls += 1;
    },
    stopAllActions() {},
  };
  const fixture: {
    listener: ((payload: PauseQuitPayload) => void) | null;
  } = {
    listener: null,
  };
  const controller: Record<string, any> = {
    lifecycleFatalError: null,
    modeRoot: root,
    pausePresenter: pause,
    audioSnapshot: audio.snapshot,
    currentPauseCard: () => ({}),
    emitSnapshot() {},
    node: {
      emit(type: string, payload: PauseQuitPayload) {
        assert.equal(type, 'combo-bird-pause-quit-requested');
        fixture.listener?.(payload);
      },
    },
    onSwishCooldownComplete() {},
    releasePauseAudioForNavigation() {
      return releaseAudio.call(this);
    },
    requireClassicGameplayController: () => audio.classic,
    requireModeRoot: () => root,
    requirePausePresenter: () => pause,
    requireSceneController: () => scene,
    requireScreenPlacement: () => placement,
    requireTimerAudio: () => audio.timer,
    restorePauseAudioAfterNavigationRollback(
      snapshot: Record<string, boolean>,
    ) {
      return restoreAudio.call(this, snapshot);
    },
    retainFatalLifecycleBoundary(
      error: TestComboBirdLifecycleRollbackError,
    ) {
      return retainFatal.call(this, error);
    },
    rollbackPauseQuit(transaction: Record<string, any>) {
      return rollback.call(this, transaction);
    },
    sharedSettingsRuntime: {
      state: {
        snapshot: {
          effectsEnabled: true,
          musicEnabled: true,
        },
      },
    },
    unschedule() {},
  };

  return Object.assign(fixture, {
    audioSnapshot: audio.snapshot,
    controller,
    pause,
    request,
    scene,
  });
}

function createPauseReplayEarlyFailureFixture() {
  const restart = compileSourceMethod<
    (this: Record<string, any>) => void
  >('restartFromPause', {
    ComboBirdLifecycleRollbackError:
      TestComboBirdLifecycleRollbackError,
    collectCleanupFailure,
    isValid: () => true,
    reportCleanupFailures() {},
  });
  const audio = createPauseAudioState();
  const host = {};
  const root = createRoot(host);
  const placement = createPlacement(host, root);
  const scene = createSuspendableScene();
  const pause = {
    ingressCalls: 0,
    resumeCalls: 0,
    pauseIngress() {
      this.ingressCalls += 1;
    },
    resumeEgress() {
      this.resumeCalls += 1;
    },
    stopAllActions() {},
  };
  const oldOwnership = {
    swishAudio: null,
  };
  const controller: Record<string, any> = {
    comboBirdSceneController: scene,
    lifecycleFatalError: null,
    screenPlacement: placement,
    standbySceneController: null,
    acquireStandbySceneController() {
      throw new Error('injected standby construction failure');
    },
    captureRunOwnership: () => oldOwnership,
    currentPauseCard: () => ({}),
    drainRetiredRuns() {},
    effectsEnabled: () => true,
    installRunOwnership() {},
    onSwishCooldownComplete() {},
    requireClassicGameplayController: () => audio.classic,
    requireModeRoot: () => root,
    requirePausePresenter: () => pause,
    requireSceneController: () => scene,
    requireScreenPlacement: () => placement,
    restorePauseAudioAfterNavigationRollback(
      snapshot: Readonly<{
        effectsPauseLeaseRequired: boolean;
        musicPauseLeaseRequired: boolean;
      }>,
    ) {
      if (snapshot.effectsPauseLeaseRequired) {
        audio.classic.sharedAudioPresenter.pauseAllEffects();
        audio.timer.pauseAllEffects();
      }
      if (snapshot.musicPauseLeaseRequired) {
        audio.classic.sharedAudioPresenter.pauseBackgroundMusic();
      }
    },
    restoreRetainedSwishCooldown() {},
    retainFatalLifecycleBoundary(
      error: TestComboBirdLifecycleRollbackError,
    ) {
      this.lifecycleFatalError ??= error;
    },
    sharedSettingsRuntime: {
      state: {
        snapshot: {
          effectsEnabled: true,
          musicEnabled: true,
        },
      },
    },
    unschedule() {},
  };

  return {
    audioSnapshot: audio.snapshot,
    controller,
    pause,
    restart,
    scene,
  };
}

function createPauseAudioState() {
  let classicEffectsPaused = true;
  let classicMusicPaused = true;
  let timerPaused = true;
  const classic = {
    sharedAudioPresenter: {
      pauseAllEffects() {
        classicEffectsPaused = true;
      },
      pauseBackgroundMusic() {
        classicMusicPaused = true;
      },
      playOneShot() {},
      stopAllEffects() {
        classicEffectsPaused = false;
      },
      stopBackgroundMusic() {
        classicMusicPaused = false;
      },
    },
  };
  const timer = {
    pauseAllEffects() {
      timerPaused = true;
    },
    stopAllEffects() {
      timerPaused = false;
    },
  };
  return {
    classic,
    snapshot: () => ({
      classicEffectsPaused,
      classicMusicPaused,
      timerPaused,
    }),
    timer,
  };
}

function createSuspendableScene() {
  return {
    active: true,
    suspended: false,
    finalizeSuspendedComboBirdLayerRelease() {
      this.suspended = false;
    },
    resumeSuspendedComboBirdLayer() {
      assert.equal(this.suspended, true);
      this.active = true;
      this.suspended = false;
    },
    suspendComboBirdLayerForNavigation() {
      assert.equal(this.active, true);
      this.active = false;
      this.suspended = true;
    },
  };
}

function createRetryPresenter() {
  let navigation: 'none' | 'retry' = 'retry';
  return {
    disposeCalls: 0,
    rearmCalls: 0,
    get state() {
      return { navigation };
    },
    dispose() {
      this.disposeCalls += 1;
    },
    rearmNavigationAfterFailure(expected: string) {
      assert.equal(expected, 'retry');
      this.rearmCalls += 1;
      navigation = 'none';
      return true;
    },
  };
}

function createRoot(parent: object | null) {
  return {
    destroyCalls: 0,
    destroyed: false,
    parent,
    destroy() {
      this.destroyCalls += 1;
      this.destroyed = true;
      this.parent = null;
    },
  };
}

function createPlacement(
  host: object,
  initial: ReturnType<typeof createRoot>,
) {
  return {
    currentScreen: initial as ReturnType<typeof createRoot> | null,
    attachCurrentScreen(next: ReturnType<typeof createRoot>) {
      assert.equal(this.currentScreen, null);
      next.parent = host;
      this.currentScreen = next;
    },
    detachCurrentScreen(expected: ReturnType<typeof createRoot>) {
      assert.equal(this.currentScreen, expected);
      this.currentScreen = null;
      expected.parent = null;
      return expected;
    },
    replaceCurrentScreen(next: ReturnType<typeof createRoot>) {
      const previous = this.currentScreen;
      if (previous !== null) {
        previous.parent = null;
      }
      next.parent = host;
      this.currentScreen = next;
      return previous;
    },
  };
}

function retryCommands(options: Readonly<{
  readonly effectsEnabled: boolean;
}>): readonly object[] {
  const commands: object[] = [];
  if (options.effectsEnabled) {
    commands.push({
      canonicalPath: 'Sounds/menu.wav',
      type: 'request-menu-button-audio',
    });
  }
  commands.push(
    { type: 'capture-result-parent' },
    { cleanup: true, type: 'remove-result' },
    { fresh: true, mode: 5, type: 'construct-combo-bird' },
    { type: 'attach-combo-bird-to-captured-parent', zOrder: 1 },
  );
  return Object.freeze(commands.map(Object.freeze));
}

interface PauseQuitPayload {
  readonly comboBirdRoot: object;
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

function cleanupError(label: string, failures: readonly unknown[]): Error {
  return new Error(`${label}: ${failures.map(String).join('; ')}`);
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
    sourceUrl: `combo-bird-retry-lifecycle.${functionName}.ts`,
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
