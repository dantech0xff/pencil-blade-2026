import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const SOURCES = Object.freeze({
  classic: readSource('classic-gameplay-controller.ts'),
  classicBird: readSource('classic-bird-gameplay-controller.ts'),
  comboBird: readSource('combo-bird-gameplay-controller.ts'),
  crazy: readSource('crazy-gameplay-controller.ts'),
  gnStyle: readSource('gn-style-gameplay-controller.ts'),
  mainMenuFruit: readSource('main-menu-fruit-presenter.ts'),
  modeSelectFruit: readSource('mode-select-rope-button-presenter.ts'),
  shell: readSource('recovered-app-shell-controller.ts'),
});

test('all six mode routes preserve global, mode, then per-type fruit objective order', () => {
  assertFruitObjectiveOrder(
    extractBlock(
      SOURCES.classic,
      '  private onFruitCut(event: ClassicGeneratedFruitCutEvent): void {',
      '  private presentRecoveredCutHalves(',
    ),
    'createClassicFruitCutCommands(',
    'Classic',
  );

  for (const [source, label] of [
    [SOURCES.classicBird, 'Classic Bird ordinary'],
    [SOURCES.comboBird, 'Combo Bird'],
    [SOURCES.gnStyle, 'GN Style'],
  ] as const) {
    assertFruitObjectiveOrder(
      extractBlock(
        source,
        '  private readonly onOrdinaryFruitCut = (',
        '  private readonly onOrdinaryFruitMiss = (',
      ),
      'this.requireSceneController().fruitCut(',
      label,
    );
  }

  assertFruitObjectiveOrder(
    extractBlock(
      SOURCES.crazy,
      '  private readonly onOrdinaryFruitCut = (',
      '  private readonly onSpecialFruitCut = (',
    ),
    'this.applyFruitCutCommands(',
    'Crazy/Crazy Bird ordinary',
  );
  assertFruitObjectiveOrder(
    extractBlock(
      SOURCES.crazy,
      '  private readonly onSpecialFruitCut = (',
      '  private applyFruitCutCommands(',
    ),
    'this.applyFruitCutCommands(',
    'Crazy/Crazy Bird special',
  );
  assertFruitObjectiveOrder(
    extractBlock(
      SOURCES.classicBird,
      '  private readonly onSpecialFruitCut = (',
      '  private presentCutHalves(',
    ),
    'this.requireSceneController().fruitCut(',
    'Classic Bird special',
  );
});

test('Dragon objective remains on its dedicated selector without global fruit accounting', () => {
  const dragon = extractBlock(
    SOURCES.crazy,
    '  private readonly onDragonObjective = (',
    '  private readonly onDragonPlayEffect = (',
  );
  assert.match(dragon, /processGameEvent\(\s*command\.eventId,\s*command\.count/);
  assert.doesNotMatch(dragon, /processGlobalFruitCut|processFruitTypeCut/);
});

test('Main Menu and Mode Select fruits preserve callback, global, then per-type progression', () => {
  const mainMenuCut = extractBlock(
    SOURCES.mainMenuFruit,
    '  cut(segment: CutSegment, effectsEnabled: boolean): boolean {',
    '  /** Commits the accepted cut',
  );
  assertBefore(
    mainMenuCut,
    'this.lifecycle.onNavigation(this.presentation.purpose)',
    'this.processObjectiveNotificationsOnce()',
    'Main Menu callback before objective tail',
  );
  assertBefore(
    extractBlock(
      SOURCES.mainMenuFruit,
      '  private processObjectiveNotificationsOnce(): void {',
      '\n  }\n}',
    ),
    'this.lifecycle.onGlobalFruitCut()',
    'this.lifecycle.onFruitTypeCut(this.presentation.fruitId)',
    'Main Menu global before per-type',
  );

  const modeSelectCut = extractBlock(
    SOURCES.modeSelectFruit,
    '  cut(segment: CutSegment, effectsEnabled: boolean): boolean {',
    '  unlock(): void {',
  );
  assertBefore(
    modeSelectCut,
    'this.lifecycle.onModeSelected(this.modeIndex)',
    'this.processObjectiveNotificationsOnce()',
    'Mode Select callback before objective tail',
  );
  assertBefore(
    extractBlock(
      SOURCES.modeSelectFruit,
      '  private processObjectiveNotificationsOnce(): void {',
      '  private createBlurNode(',
    ),
    'this.lifecycle.onGlobalFruitCut()',
    'this.lifecycle.onFruitTypeCut(this.presentation.card.fruitId)',
    'Mode Select global before per-type',
  );

  assert.equal(
    occurrences(SOURCES.shell, 'objectives: gameplay.sharedObjectivesManager'),
    0,
  );
  assert.equal(
    occurrences(SOURCES.shell, 'this.requireObjectivesManager()'),
    3,
  );
});

function assertFruitObjectiveOrder(
  block: string,
  middleMarker: string,
  label: string,
  firstMarker = 'this.requireObjectivesManager().processGlobalFruitCut()',
  finalMarker =
    'this.requireObjectivesManager().processFruitTypeCut(event.fruitId)',
): void {
  const firstIndex = block.indexOf(firstMarker);
  const middleIndex = block.indexOf(middleMarker);
  const finalIndex = block.indexOf(finalMarker);
  assert.ok(firstIndex >= 0, `${label} needs its first recovered fruit-cut stage`);
  assert.ok(
    middleIndex > firstIndex,
    `${label} must apply its middle fruit-cut stage in recovered order`,
  );
  assert.ok(
    finalIndex > middleIndex,
    `${label} must apply its final fruit-cut stage in recovered order`,
  );
}

function readSource(fileName: string): string {
  return readFileSync(
    `${REPOSITORY_ROOT}/game/assets/scripts/creator/${fileName}`,
    'utf8',
  );
}

function extractBlock(
  source: string,
  startMarker: string,
  endMarker: string,
): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.ok(end > start, `missing source marker after ${startMarker}: ${endMarker}`);
  return source.slice(start, end);
}

function occurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

function assertBefore(
  source: string,
  first: string,
  second: string,
  label: string,
): void {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert.ok(firstIndex >= 0, `${label}: missing ${first}`);
  assert.ok(secondIndex > firstIndex, `${label}: expected recovered order`);
}
