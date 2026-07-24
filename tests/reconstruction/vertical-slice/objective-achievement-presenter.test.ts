import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SOURCE = readFileSync(
  `${REPOSITORY_ROOT}/game/assets/scripts/creator/objective-achievement-presenter.ts`,
  'utf8',
);

test('presenter binds exact banners, Arial labels, and retained target order', () => {
  assert.match(SOURCE, /ObjectiveAchievementPresentationState/);
  assert.match(SOURCE, /objectiveAchievement\.completedMessage/);
  assert.match(SOURCE, /objectiveAchievement\.nextMessage/);
  assert.match(SOURCE, /resources\.arialFont\.font/);
  assertOrderedSubstrings(SOURCE, [
    'this.completedBanner.node',
    'this.nextBanner.node',
    'this.emitters[0].node',
    'this.emitters[1].node',
    'this.emitters[2].node',
  ]);
  assert.match(
    SOURCE,
    /completed banner -> next banner -> emitter 1 -> emitter 2 -> emitter 3/,
  );
});

test('particle boundary consumes each exact burst and projects move, scale, and rotation', () => {
  const update = extractMethod(SOURCE, 'updateAction');
  assertOrderedSubstrings(update, [
    'this.state.updateAction(deltaSeconds)',
    'this.projectBannerPositions()',
    'this.startParticleBursts()',
    'this.projectParticles(',
    'this.removeParticleContainers()',
  ]);
  const start = extractMethod(SOURCE, 'startParticleBursts');
  assert.match(start, /for \(const emitter of this\.emitters\)/);
  assert.match(start, /createObjectiveAchievementParticleBurst/);
  const project = extractMethod(SOURCE, 'projectParticles');
  assert.match(project, /presented\.plan\.deltaLocal\.x \* progress/);
  assert.match(project, /INITIAL_PARTICLE_SCALE \* \(1 - progress\)/);
  assert.match(project, /FINAL_PARTICLE_ROTATION_DEGREES \* progress/);
  assert.doesNotMatch(SOURCE, /UIOpacity|fade|material|blend/i);
});

test('t=4.41 cleanup keeps banners until the exact natural-completion owner disposal', () => {
  const particleCleanup = extractMethod(SOURCE, 'removeParticleContainers');
  assert.match(particleCleanup, /for \(const emitter of this\.emitters\)/);
  assert.match(particleCleanup, /emitter\.node\.destroy\(\)/);
  assert.doesNotMatch(
    particleCleanup,
    /completedBanner|nextBanner/,
  );
  const disposal = extractMethod(SOURCE, 'dispose');
  assert.match(disposal, /for \(const node of this\.rootNodes\(\)\)/);
  assert.match(
    SOURCE,
    /get isComplete\(\): boolean \{\s*return this\.state\.snapshot\.complete;/,
  );
});

test('registry updater retires before disposal and reports one contained failure', () => {
  const update = extractFunction(
    SOURCE,
    'updateAndRetireObjectiveAchievementPresenters',
  );
  assertOrderedSubstrings(update, [
    'presenter.updateAction(deltaSeconds)',
    'presenter.isComplete',
    'presenters.delete(presenter)',
    'presenter.dispose()',
  ]);
  assert.match(
    update,
    /reportObjectiveAchievementPresentationFailure\(/,
  );
  const report = extractFunction(
    SOURCE,
    'reportObjectiveAchievementPresentationFailure',
  );
  assert.equal(report.split('console.error(').length - 1, 1);
});

function extractMethod(source: string, methodName: string): string {
  const signature = new RegExp(
    `^\\s*(?:private\\s+)?${methodName}\\b`,
    'm',
  );
  const match = signature.exec(source);
  assert.ok(match, `${methodName} method must exist`);
  const openBrace = source.indexOf('{', match.index);
  assert.notEqual(openBrace, -1);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(match.index, index + 1);
      }
    }
  }
  throw new Error(`${methodName} is unterminated`);
}

function extractFunction(source: string, functionName: string): string {
  const signature = new RegExp(`^export function ${functionName}\\b`, 'm');
  const match = signature.exec(source);
  assert.ok(match, `${functionName} function must exist`);
  const openBrace = source.indexOf('{', match.index);
  assert.notEqual(openBrace, -1);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(match.index, index + 1);
      }
    }
  }
  throw new Error(`${functionName} is unterminated`);
}

function assertOrderedSubstrings(source: string, values: readonly string[]): void {
  let previous = -1;
  for (const value of values) {
    const current = source.indexOf(value);
    assert.ok(current > previous, `${value} must appear in recovered order`);
    previous = current;
  }
}
