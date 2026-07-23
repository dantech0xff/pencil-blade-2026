import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  assert.match(
    activate,
    /catch \(error\)[\s\S]*?deactivateForNonClassicScreen\(\)[\s\S]*?restorePreviousWorldProperties\(\)[\s\S]*?this\.session = previousSession[\s\S]*?this\.worldSpeed = previousWorldSpeed[\s\S]*?throw error/,
  );
  assert.match(applyWorldSpeed, /scheduleOnce\(this\.onSpeedUpDelayComplete/);
  assert.match(applyWorldSpeed, /this\.node\.emit\(CLASSIC_WORLD_SPEED_COMMAND_EVENT, command\)/);
});

test('same-parent Retry keeps prepare, commit, and exact Result rollback identities', () => {
  const source = readText('game/assets/scripts/creator/classic-scene-controller.ts');
  const restart = extractMethod(source, 'restartClassicLayer');
  const commit = extractMethod(source, 'commitClassicLayerRestart');
  const rollback = extractMethod(source, 'rollbackClassicLayerRestart');
  const restore = extractMethod(source, 'restorePendingClassicLayerRestart');

  assert.match(restart, /if \(this\.destroyed\)/);
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
  assert.match(
    restart,
    /catch \(error\)[\s\S]*?restorePendingClassicLayerRestart\(\)[\s\S]*?throw error/,
  );
  assert.match(commit, /pendingLayerRestartRollback === null/);
  assert.match(commit, /!this\.initialClassicActivated/);
  assert.match(commit, /pendingLayerRestartRollback = null/);
  assert.match(rollback, /restorePendingClassicLayerRestart\(\)/);
  assert.match(rollback, /emitSessionSnapshot\(\)/);
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

function readText(path: string): string {
  return readFileSync(`${REPOSITORY_ROOT}/${path}`, 'utf8');
}

function extractMethod(source: string, methodName: string): string {
  const signature = new RegExp(
    `(?:private\\s+)?(?:readonly\\s+)?${methodName}\\b[^\\n]*\\{`,
    'm',
  );
  const match = signature.exec(source);
  assert.ok(match, `${methodName} method must exist`);

  const start = match.index;
  const openBrace = source.indexOf('{', start);
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

function countOccurrences(source: string, value: string): number {
  return source.split(value).length - 1;
}
