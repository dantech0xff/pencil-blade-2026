import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SOURCE = readFileSync(
  `${REPOSITORY_ROOT}game/assets/scripts/creator/main-menu-cut-half-presenter.ts`,
  'utf8',
);

test('Main Menu cut halves are actual ordered Creator physics bodies', () => {
  assert.ok(
    SOURCE.indexOf("new PresentedCutHalf('bottom'")
      < SOURCE.indexOf("new PresentedCutHalf('top'"),
  );
  assert.match(SOURCE, /addComponent\(RigidBody2D\)/);
  assert.match(SOURCE, /addComponent\(BoxCollider2D\)/);
  assert.match(SOURCE, /body\.gravityScale = CLASSIC_CUT_HALF_GRAVITY_SCALE/);
  assert.match(SOURCE, /applyLinearImpulseToCenter/);
  assert.match(SOURCE, /collider\.group = FRUIT_COLLISION_FILTER\.categoryBits/);
  assert.match(SOURCE, /collider\.size = new Size\(/);
});

test('Main Menu cut-half expiry and bounds cleanup stay after the physics step', () => {
  const queueHalf = extractMethod(SOURCE, 'queueHalf');
  assert.match(queueHalf, /this\.lifecycle\.callAfterStep\(\(\) =>/);
  assert.ok(queueHalf.indexOf('markDisposalQueued()') < queueHalf.indexOf('callAfterStep'));
  assert.match(queueHalf, /clearDisposalQueued\(\)/);
  assert.match(extractMethod(SOURCE, 'updateAction'), /queueAll\('fade-complete'\)/);
  assert.match(extractMethod(SOURCE, 'evaluateBounds'), /createClassicBoundsCommands/);
  assert.match(extractMethod(SOURCE, 'dispose'), /if \(this\.disposedValue\)/);
});

test('cut-half attach tracks ownership immediately after parenting for rollback cleanup', () => {
  const attach = extractMethod(SOURCE, 'attach');
  assert.ok(attach.indexOf('half.node.setParent(parent, true)') < attach.indexOf('attached.push(half)'));
  assert.ok(attach.indexOf('attached.push(half)') < attach.indexOf('half.node.setSiblingIndex'));
  assert.match(attach, /for \(const half of attached\.reverse\(\)\)/);
});

function extractMethod(source: string, methodName: string): string {
  const privateStart = source.indexOf(`\n  private ${methodName}(`);
  const publicStart = source.indexOf(`\n  ${methodName}(`);
  const start = privateStart >= 0 ? privateStart + 1 : publicStart + 1;
  assert.ok(start > 0, `${methodName} method must exist`);
  const returnToken = methodName === 'dispose' ? '): boolean {' : '): void {';
  const returnStart = source.indexOf(returnToken, start);
  assert.ok(returnStart > start, `${methodName} return boundary must exist`);
  const openBrace = returnStart + returnToken.length - 1;
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${methodName} method body is unterminated`);
}
