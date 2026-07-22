import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

test('same-parent Retry rebuilds only fresh per-layer state after completed Result removal', () => {
  const source = readText('game/assets/scripts/creator/classic-scene-controller.ts');
  const restart = extractMethod(source, 'restartClassicLayer');
  const commit = extractMethod(source, 'commitClassicLayerRestart');
  const rollback = extractMethod(source, 'rollbackClassicLayerRestart');
  const restore = extractMethod(source, 'restorePendingClassicLayerRestart');

  assert.match(
    restart,
    /this\.session\.snapshot\(\)\.lifecycle !== 'result-removed'[\s\S]*?!this\.classicLayerRemovedForResult/,
  );
  assert.match(restart, /const freshSession = new ClassicSession\(\)/);
  assert.match(restart, /const freshWorldSpeed = new ClassicWorldSpeed\(\)/);
  assert.match(
    restart,
    /this\.pendingLayerRestartRollback = Object\.freeze\(\{[\s\S]*?session: this\.session[\s\S]*?worldSpeed: this\.worldSpeed/,
  );
  assert.match(restart, /this\.physics\.configureResolvedWorldProperties\(\)/);
  assert.match(restart, /this\.physics\.startVariableSimulation\(/);
  assert.match(restart, /freshWorldSpeed\.physicsStepDelta\(frameDeltaSeconds\)/);
  assert.match(restart, /bladeInput\.resetForFreshClassicLayer\(\)/);
  assert.match(restart, /freshWorldSpeed\.enableClassicSpeedUp\(\)/);
  assert.match(restart, /this\.emitSessionSnapshot\(\)/);
  assert.match(
    restart,
    /catch \(error\)[\s\S]*?restorePendingClassicLayerRestart\(\)[\s\S]*?throw error/,
  );
  assert.match(commit, /pendingLayerRestartRollback === null/);
  assert.match(commit, /pendingLayerRestartRollback = null/);
  assert.match(rollback, /restorePendingClassicLayerRestart\(\)/);
  assert.match(
    restore,
    /unschedule\(this\.onSpeedUpDelayComplete\)[\s\S]*?restorePreviousWorldProperties\(\)[\s\S]*?this\.session = rollback\.session[\s\S]*?this\.worldSpeed = rollback\.worldSpeed[\s\S]*?bladeInput\.setCutEnabled\(rollback\.session\.snapshot\(\)\.cutEnabled\)/,
  );
  assert.ok(
    restart.indexOf('this.unschedule(this.onSpeedUpDelayComplete)')
      < restart.indexOf('freshWorldSpeed.enableClassicSpeedUp()'),
  );
  assert.doesNotMatch(restart, /\bdirector\b|loadScene|Settings|Random|Audio/);
});

test('fresh-layer blade reset drops all touch tracks and restores cutting', () => {
  const source = readText('game/assets/scripts/creator/blade-input-controller.ts');
  const reset = extractMethod(source, 'resetForFreshClassicLayer');

  assert.match(reset, /this\.tracks = new BladeTracks\(\)/);
  assert.match(reset, /this\.cutEnabled = true/);
});

test('initial scene startup and terminal removal keep their existing boundaries', () => {
  const source = readText('game/assets/scripts/creator/classic-scene-controller.ts');
  const onLoad = extractMethod(source, 'onLoad');
  const start = extractMethod(source, 'start');
  const applyResolvedCommand = extractMethod(source, 'applyResolvedCommand');

  assert.match(onLoad, /this\.physics\.configureResolvedWorldProperties\(\)/);
  assert.match(onLoad, /this\.physics\.startVariableSimulation\(/);
  assert.match(start, /this\.worldSpeed\.enableClassicSpeedUp\(\)/);
  assert.match(
    applyResolvedCommand,
    /command\.type === 'remove-classic'[\s\S]*?unschedule\(this\.onSpeedUpDelayComplete\)[\s\S]*?restorePreviousWorldProperties\(\)[\s\S]*?classicLayerRemovedForResult = true/,
  );
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
