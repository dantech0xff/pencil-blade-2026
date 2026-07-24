import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

test('serialized Classic scene and blade components stay passive during engine lifecycle', () => {
  const bladeSource = readText('game/assets/scripts/creator/blade-input-controller.ts');
  const sceneSource = readText('game/assets/scripts/creator/classic-scene-controller.ts');
  const sceneOnLoad = extractMethod(sceneSource, 'onLoad');
  const sceneStart = extractMethod(sceneSource, 'start');

  assert.match(bladeSource, /private cutEnabled = false/);
  assert.match(bladeSource, /private classicLayerActive = false/);
  assert.doesNotMatch(bladeSource, /onEnable\(\): void/);
  assert.match(sceneOnLoad, /this\.bladeInput = bladeInput/);
  assert.match(sceneOnLoad, /bladeInput\.deactivateForNonClassicScreen\(\)/);
  assert.doesNotMatch(
    sceneOnLoad,
    /resolution\.apply|configureResolvedWorldProperties|startVariableSimulation|activateForClassicLayer|enableClassicSpeedUp/,
  );
  assert.doesNotMatch(
    sceneStart,
    /resolution\.apply|configureResolvedWorldProperties|startVariableSimulation|activateForClassicLayer|enableClassicSpeedUp|node\.emit|emitSessionSnapshot/,
  );
});

test('blade input has an idempotent Classic activation and a defensive passive boundary', () => {
  const source = readText('game/assets/scripts/creator/blade-input-controller.ts');
  const activate = extractMethod(source, 'activateForClassicLayer');
  const deactivate = extractMethod(source, 'deactivateForNonClassicScreen');
  const onDisable = extractMethod(source, 'onDisable');
  const onDestroy = extractMethod(source, 'onDestroy');
  const onTouchStart = extractMethod(source, 'onTouchStart');
  const onTouchMove = extractMethod(source, 'onTouchMove');
  const finishTouch = extractMethod(source, 'finishTouch');

  assert.match(activate, /if \(this\.classicLayerActive\) \{\s*return;/);
  assertOrderedSubstrings(activate, [
    'this.resetForFreshClassicLayer()',
    'this.classicLayerActive = true',
    'input.on(Input.EventType.TOUCH_START',
    'input.on(Input.EventType.TOUCH_MOVE',
    'input.on(Input.EventType.TOUCH_END',
    'input.on(Input.EventType.TOUCH_CANCEL',
  ]);
  assert.match(
    activate,
    /catch \(error\)[\s\S]*?deactivateForNonClassicScreen\(\)[\s\S]*?throw error/,
  );
  assertOrderedSubstrings(deactivate, [
    'this.classicLayerActive = false',
    'input.off(Input.EventType.TOUCH_START',
    'input.off(Input.EventType.TOUCH_MOVE',
    'input.off(Input.EventType.TOUCH_END',
    'input.off(Input.EventType.TOUCH_CANCEL',
    'this.tracks = new BladeTracks()',
    'this.cutEnabled = false',
  ]);
  assert.match(onDisable, /deactivateForNonClassicScreen\(\)/);
  assert.match(onDestroy, /deactivateForNonClassicScreen\(\)/);
  for (const touchBoundary of [onTouchStart, onTouchMove, finishTouch]) {
    assert.match(touchBoundary, /if \(!this\.classicLayerActive\) \{\s*return;/);
  }
});

test('scene resolution preparation is explicit, idempotent, and emits only on first apply', () => {
  const source = readText('game/assets/scripts/creator/classic-scene-controller.ts');
  const prepare = extractMethod(source, 'prepareSceneResolution');

  assert.match(prepare, /if \(this\.destroyed\)/);
  assert.match(
    prepare,
    /if \(this\.appliedResolution !== null\) \{\s*return this\.appliedResolution;/,
  );
  assertOrderedSubstrings(prepare, [
    'const appliedResolution = this.resolution.apply()',
    'this.appliedResolution = appliedResolution',
    'this.node.emit(CLASSIC_RESOLUTION_APPLIED_EVENT, appliedResolution)',
    'return appliedResolution',
  ]);
  assert.equal(countOccurrences(prepare, 'this.resolution.apply()'), 1);
  assert.equal(countOccurrences(prepare, 'CLASSIC_RESOLUTION_APPLIED_EVENT'), 1);
});

test('explicit initial activation creates fresh state in recovered startup order', () => {
  const source = readText('game/assets/scripts/creator/classic-scene-controller.ts');
  const activate = extractMethod(source, 'activateInitialClassicLayer');
  const applyWorldSpeed = extractMethod(source, 'applyWorldSpeedCommands');

  assert.match(
    activate,
    /this\.initialClassicActivated \|\| this\.initialClassicActivationInProgress/,
  );
  assert.match(activate, /this\.appliedResolution === null/);
  assert.match(activate, /this\.session\.snapshot\(\)\.lifecycle !== 'intro'/);
  assertOrderedSubstrings(activate, [
    'const freshSession = new ClassicSession()',
    'const freshWorldSpeed = new ClassicWorldSpeed()',
    'this.physics.configureResolvedWorldProperties()',
    'this.physics.startVariableSimulation(',
    'this.session = freshSession',
    'this.worldSpeed = freshWorldSpeed',
    'bladeInput.activateForClassicLayer()',
    'freshWorldSpeed.enableClassicSpeedUp()',
    'this.emitSessionSnapshot()',
    'this.initialClassicActivated = true',
  ]);
  assert.match(
    activate,
    /freshWorldSpeed\.physicsStepDelta\(frameDeltaSeconds\)/,
  );
  assertOrderedSubstrings(activate, [
    'catch (error)',
    'this.session = previousSession',
    'this.worldSpeed = previousWorldSpeed',
    'bladeInput.deactivateForNonClassicScreen()',
    'this.releasePhysicsLease()',
    'rollbackFailures.length > 0 || this.physicsRestorePending',
    'this.failClosedAfterLifecycleRollback(',
    'throw error',
  ]);
  assert.match(applyWorldSpeed, /scheduleOnce\(this\.onSpeedUpDelayComplete/);
  assert.match(applyWorldSpeed, /this\.node\.emit\(CLASSIC_WORLD_SPEED_COMMAND_EVENT, command\)/);
});

test('same-parent Retry keeps prepare, commit, and exact Result rollback identities', () => {
  const source = readText('game/assets/scripts/creator/classic-scene-controller.ts');
  const restart = extractMethod(source, 'restartClassicLayer');
  const commit = extractMethod(source, 'commitClassicLayerRestart');
  const rollback = extractMethod(source, 'rollbackClassicLayerRestart');
  const restore = extractMethod(source, 'restorePendingClassicLayerRestart');

  assert.match(restart, /if \(this\.destroyed \|\| this\.fatalLifecycleValue\)/);
  assert.match(
    restart,
    /this\.session\.snapshot\(\)\.lifecycle !== 'result-removed'[\s\S]*?!this\.classicLayerRemovedForResult/,
  );
  assert.match(restart, /const freshSession = new ClassicSession\(\)/);
  assert.match(restart, /const freshWorldSpeed = new ClassicWorldSpeed\(\)/);
  assert.match(
    restart,
    /this\.pendingLayerRestartRollback = Object\.freeze\(\{[\s\S]*?initialClassicActivated: this\.initialClassicActivated[\s\S]*?session: this\.session[\s\S]*?worldSpeed: this\.worldSpeed/,
  );
  assert.match(restart, /this\.physics\.configureResolvedWorldProperties\(\)/);
  assert.match(restart, /this\.physics\.startVariableSimulation\(/);
  assert.match(restart, /freshWorldSpeed\.physicsStepDelta\(frameDeltaSeconds\)/);
  assert.match(restart, /bladeInput\.activateForClassicLayer\(\)/);
  assert.match(restart, /freshWorldSpeed\.enableClassicSpeedUp\(\)/);
  assert.match(restart, /this\.emitSessionSnapshot\(\)/);
  assertOrderedSubstrings(restart, [
    'catch (error)',
    'this.restorePendingClassicLayerRestart()',
    'this.failClosedAfterLifecycleRollback(',
    'this.emitSessionSnapshotReportOnly(',
    'throw error',
  ]);
  assert.match(commit, /pendingLayerRestartRollback === null/);
  assert.match(commit, /!this\.initialClassicActivated/);
  assert.match(commit, /pendingLayerRestartRollback = null/);
  assert.match(rollback, /restorePendingClassicLayerRestart\(\)/);
  assert.match(rollback, /emitSessionSnapshotReportOnly\(/);
  assertOrderedSubstrings(restore, [
    'this.unschedule(this.onSpeedUpDelayComplete)',
    'this.physics.restorePreviousWorldProperties()',
    'this.session = rollback.session',
    'this.worldSpeed = rollback.worldSpeed',
    'this.initialClassicActivated = rollback.initialClassicActivated',
    'this.classicLayerRemovedForResult = rollback.classicLayerRemovedForResult',
    'bladeInput.deactivateForNonClassicScreen()',
    'this.pendingLayerRestartRollback = null',
  ]);
  assert.ok(
    restart.indexOf('this.unschedule(this.onSpeedUpDelayComplete)')
      < restart.indexOf('freshWorldSpeed.enableClassicSpeedUp()'),
  );
  assert.doesNotMatch(restart, /\bdirector\b|loadScene|Settings|Random|Audio/);
});

test('terminal removal and destruction both release input and restore global physics', () => {
  const source = readText('game/assets/scripts/creator/classic-scene-controller.ts');
  const applyResolvedCommand = extractMethod(source, 'applyResolvedCommand');
  const onDestroy = extractMethod(source, 'onDestroy');

  assert.match(
    applyResolvedCommand,
    /command\.type === 'remove-classic'[\s\S]*?unschedule\(this\.onSpeedUpDelayComplete\)[\s\S]*?deactivateForNonClassicScreen\(\)[\s\S]*?restorePreviousWorldProperties\(\)[\s\S]*?classicLayerRemovedForResult = true/,
  );
  assertOrderedSubstrings(onDestroy, [
    'this.destroyed = true',
    'this.unschedule(this.onSpeedUpDelayComplete)',
    'this.bladeInput?.deactivateForNonClassicScreen()',
    'this.physics.restorePreviousWorldProperties()',
  ]);
});

test('fresh-layer blade reset still drops every touch track and restores cutting', () => {
  const source = readText('game/assets/scripts/creator/blade-input-controller.ts');
  const reset = extractMethod(source, 'resetForFreshClassicLayer');

  assert.match(reset, /this\.tracks = new BladeTracks\(\)/);
  assert.match(reset, /this\.cutEnabled = true/);
});

test('Pause navigation suspends and restores the same Classic session leases', () => {
  const source = readText('game/assets/scripts/creator/classic-scene-controller.ts');
  const suspend = extractMethod(source, 'suspendClassicLayerForNavigation');
  const resume = extractMethod(source, 'resumeSuspendedClassicLayer');

  assertOrderedSubstrings(suspend, [
    'const retainedDelay = this.speedDelayRemainingSeconds',
    'this.unschedule(this.onSpeedUpDelayComplete)',
    'bladeInput.deactivateForNonClassicScreen()',
    'this.releasePhysicsLease()',
    'this.classicLayerActive = false',
    'this.classicLayerSuspended = true',
  ]);
  assert.match(
    suspend,
    /catch \(error\)[\s\S]*?this\.acquirePhysicsLease\(this\.session, this\.worldSpeed\)[\s\S]*?bladeInput\.activateForClassicLayer\(\)[\s\S]*?this\.restoreSpeedDelay\(retainedDelay\)/,
  );
  assertOrderedSubstrings(resume, [
    'const retainedDelay = this.speedDelayRemainingSeconds',
    'this.acquirePhysicsLease(this.session, this.worldSpeed)',
    'bladeInput.activateForClassicLayer()',
    'this.restoreSpeedDelay(retainedDelay)',
    'this.classicLayerActive = true',
    'this.classicLayerSuspended = false',
  ]);
  assert.match(
    resume,
    /catch \(error\)[\s\S]*?collectClassicLifecycleFailure\([\s\S]*?bladeInput\.deactivateForNonClassicScreen\(\)[\s\S]*?collectClassicLifecycleFailure\([\s\S]*?this\.releasePhysicsLease\(\)[\s\S]*?failClosedAfterLifecycleRollback/,
  );
});

test('Pause Replay stages a fresh session and Pause Quit enables future re-entry', () => {
  const source = readText('game/assets/scripts/creator/classic-scene-controller.ts');
  const replay = extractMethod(source, 'restartSuspendedClassicLayer');
  const quit = extractMethod(source, 'finalizeSuspendedClassicLayerRelease');
  const restart = extractMethod(source, 'restartClassicLayer');

  assertOrderedSubstrings(replay, [
    'const freshSession = new ClassicSession()',
    'const freshWorldSpeed = new ClassicWorldSpeed()',
    'session: this.session',
    'worldSpeed: this.worldSpeed',
    'this.session = freshSession',
    'this.worldSpeed = freshWorldSpeed',
    'this.acquirePhysicsLease(freshSession, freshWorldSpeed)',
    'this.requireBladeInput().activateForClassicLayer()',
    'freshWorldSpeed.enableClassicSpeedUp()',
    'this.emitSessionSnapshot()',
  ]);
  assertOrderedSubstrings(replay, [
    'catch (error)',
    'this.restorePendingClassicLayerRestart()',
    'this.failClosedAfterLifecycleRollback(',
    'this.emitSessionSnapshotReportOnly(',
    'throw error',
  ]);
  assertOrderedSubstrings(quit, [
    'this.session.retireForPauseQuit()',
    'this.worldSpeed = new ClassicWorldSpeed()',
    'this.classicLayerRemovedForResult = true',
    'this.classicLayerSuspended = false',
    'this.emitSessionSnapshotReportOnly(',
  ]);
  assert.match(restart, /lifecycle !== 'navigation-removed'/);
});

test('committed Pause Quit ignores snapshot observers after retiring the session', () => {
  class ExecutableClassicWorldSpeed {}
  const diagnostics: unknown[] = [];
  const emitSessionSnapshotReportOnly = compileSceneMethod<
    (this: Record<string, unknown>, label: string) => void
  >('emitSessionSnapshotReportOnly', {
    classicLifecycleErrorMessage: (error: unknown) => (
      error instanceof Error ? error.message : String(error)
    ),
    console: {
      error(error: unknown) {
        diagnostics.push(error);
      },
    },
  });
  const finalizeSuspendedClassicLayerRelease = compileSceneMethod<
    (this: Record<string, unknown>) => void
  >('finalizeSuspendedClassicLayerRelease', {
    ClassicWorldSpeed: ExecutableClassicWorldSpeed,
  });

  let retired = false;
  const controller: Record<string, unknown> = {
    classicLayerActive: false,
    classicLayerRemovedForResult: false,
    classicLayerSuspended: true,
    destroyed: false,
    emitSessionSnapshot() {
      throw new Error('injected snapshot observer failure');
    },
    emitSessionSnapshotReportOnly(label: string) {
      emitSessionSnapshotReportOnly.call(this, label);
    },
    fatalLifecycleValue: false,
    pendingLayerRestartRollback: null,
    session: {
      retireForPauseQuit() {
        retired = true;
      },
    },
    speedDelayRemainingSeconds: 3,
    worldSpeed: {},
  };

  finalizeSuspendedClassicLayerRelease.call(controller);

  assert.equal(retired, true);
  assert.equal(controller.classicLayerRemovedForResult, true);
  assert.equal(controller.classicLayerSuspended, false);
  assert.equal(controller.speedDelayRemainingSeconds, null);
  assert.ok(controller.worldSpeed instanceof ExecutableClassicWorldSpeed);
  assert.equal(diagnostics.length, 1);
});

test('incomplete Classic lifecycle rollback fail-closes input and physics', () => {
  class ExecutableClassicLifecycleRollbackError extends Error {
    readonly rollbackErrors: readonly unknown[];

    constructor(
      label: string,
      primary: unknown,
      rollbackFailures: readonly unknown[],
    ) {
      super(`${label}: ${String(primary)}`);
      this.rollbackErrors = [...rollbackFailures];
    }
  }
  const collectClassicLifecycleFailure = (
    failures: unknown[],
    operation: () => void,
  ): void => {
    try {
      operation();
    } catch (error) {
      failures.push(error);
    }
  };
  const failClosedAfterLifecycleRollback = compileSceneMethod<
    (
      this: Record<string, unknown>,
      label: string,
      primary: unknown,
      prior: readonly unknown[],
    ) => InstanceType<typeof ExecutableClassicLifecycleRollbackError>
  >('failClosedAfterLifecycleRollback', {
    ClassicLifecycleRollbackError: ExecutableClassicLifecycleRollbackError,
    collectClassicLifecycleFailure,
  });

  const inputFailure = new Error('injected input release failure');
  const physicsFailure = new Error('injected physics release failure');
  const priorFailure = new Error('prior rollback failure');
  const controller: Record<string, unknown> = {
    bladeInput: {
      deactivateForNonClassicScreen() {
        throw inputFailure;
      },
    },
    classicLayerActive: true,
    classicLayerSuspended: true,
    fatalLifecycleValue: false,
    initialClassicActivationInProgress: true,
    onSpeedUpDelayComplete() {},
    pendingLayerRestartRollback: {},
    releasePhysicsLease() {
      throw physicsFailure;
    },
    speedDelayRemainingSeconds: 2,
    unschedule() {},
  };

  const error = failClosedAfterLifecycleRollback.call(
    controller,
    'Classic rollback failed',
    new Error('primary failure'),
    [priorFailure],
  );

  assert.ok(error instanceof ExecutableClassicLifecycleRollbackError);
  assert.equal(controller.fatalLifecycleValue, true);
  assert.equal(controller.classicLayerActive, false);
  assert.equal(controller.classicLayerSuspended, false);
  assert.equal(controller.pendingLayerRestartRollback, null);
  assert.equal(controller.initialClassicActivationInProgress, false);
  assert.equal(controller.speedDelayRemainingSeconds, null);
  assert.deepEqual(error.rollbackErrors, [
    priorFailure,
    inputFailure,
    physicsFailure,
  ]);
});

test('scene destruction retains a failed Physics2D restoration for teardown retry', () => {
  const collectClassicLifecycleFailure = (
    failures: unknown[],
    operation: () => void,
  ): void => {
    try {
      operation();
    } catch (error) {
      failures.push(error);
    }
  };
  const onDestroy = compileSceneMethod<
    (this: Record<string, unknown>) => void
  >('onDestroy', {
    aggregateClassicLifecycleFailure: (
      label: string,
      primary: unknown,
    ) => new Error(`${label}: ${String(primary)}`),
    collectClassicLifecycleFailure,
  });
  const releasePhysicsLease = compileSceneMethod<
    (this: Record<string, unknown>) => void
  >('releasePhysicsLease');
  const retryPendingPhysicsRestore = compileSceneMethod<
    (this: Record<string, unknown>) => void
  >('retryPendingPhysicsRestore');

  let restoreCalls = 0;
  const controller: Record<string, unknown> = {
    bladeInput: {
      deactivateForNonClassicScreen() {},
    },
    classicLayerActive: true,
    classicLayerSuspended: false,
    destroyed: false,
    onSpeedUpDelayComplete() {},
    physics: {
      restorePreviousWorldProperties() {
        restoreCalls += 1;
        if (restoreCalls === 1) {
          throw new Error('injected first Physics2D restoration failure');
        }
      },
    },
    physicsLeaseActive: true,
    physicsRestorePending: false,
    releasePhysicsLease() {
      releasePhysicsLease.call(this);
    },
    speedDelayRemainingSeconds: 1,
    unschedule() {},
  };

  assert.throws(
    () => onDestroy.call(controller),
    /injected first Physics2D restoration failure/,
  );
  assert.equal(controller.physicsLeaseActive, false);
  assert.equal(controller.physicsRestorePending, true);

  retryPendingPhysicsRestore.call(controller);
  assert.equal(restoreCalls, 2);
  assert.equal(controller.physicsRestorePending, false);
});

function readText(path: string): string {
  return readFileSync(`${REPOSITORY_ROOT}/${path}`, 'utf8');
}

function extractMethod(source: string, methodName: string): string {
  const signature = new RegExp(
    `^[\\t ]*(?:private\\s+)?(?:readonly\\s+)?${methodName}\\b(?=[\\t ]*(?:=|\\())`,
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

function compileSceneMethod<T extends (...args: any[]) => unknown>(
  methodName: string,
  dependencies: Readonly<Record<string, unknown>> = {},
): T {
  const sceneSource = readText(
    'game/assets/scripts/creator/classic-scene-controller.ts',
  );
  const source = extractMethod(sceneSource, methodName).replace(
    new RegExp(`^[\\t ]*(?:private\\s+)?${methodName}`),
    `function ${methodName}`,
  );
  const names = Object.keys(dependencies);
  const values = names.map((name) => dependencies[name]);
  const javascript = stripTypeScriptTypes(source, {
    mode: 'transform',
    sourceUrl: `classic-scene-restart.test.${methodName}.ts`,
  });
  return Function(
    ...names,
    `"use strict";\n${javascript}\nreturn ${methodName};`,
  )(...values) as T;
}

function assertOrderedSubstrings(source: string, expected: readonly string[]): void {
  let previousIndex = -1;
  for (const value of expected) {
    const index = source.indexOf(value);
    assert.ok(index > previousIndex, `${value} must appear in recovered order`);
    previousIndex = index;
  }
}

function countOccurrences(source: string, value: string): number {
  return source.split(value).length - 1;
}
