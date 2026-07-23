import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

test('leaf presenter creates seven exact ordered center-anchored opacity-32 sprites', () => {
  const source = readText('game/assets/scripts/creator/shared-leaf-presenter.ts');
  const constructor = extractMethod(source, 'constructor');

  assert.match(constructor, /new SharedLeafLayerModel\(/);
  assert.match(constructor, /new SharedLeafPhysicsAdapter\(this\.model\.snapshot\(\)\)/);
  assert.match(constructor, /SHARED_LEAF_CREATION_ORDER\[slotIndex\]/);
  assert.match(constructor, /node\.setSiblingIndex\(slotIndex\)/);
  assert.match(constructor, /transform\.setAnchorPoint\(0\.5, 0\.5\)/);
  assert.match(constructor, /Sprite\.SizeMode\.CUSTOM/);
  assert.match(constructor, /opacity\.opacity = SHARED_LEAF_SPRITE_OPACITY/);
  assert.match(constructor, /spriteNode\.setScale\(1, 1, 1\)/);
});

test('leaf frame update steps before applying same-frame position and negative rotation display', () => {
  const source = readText('game/assets/scripts/creator/shared-leaf-presenter.ts');
  const update = extractMethod(source, 'update');
  const synchronize = extractMethod(source, 'synchronizeDisplay');

  assert.ok(update.indexOf('this.model.stepFrame(deltaSeconds, this.physics)')
    < update.indexOf('this.synchronizeDisplay(frame.snapshot.slots)'));
  assert.match(synchronize, /slot\.display\.positionWorldUnits\.x - this\.viewportCenter\.x/);
  assert.match(synchronize, /slot\.display\.positionWorldUnits\.y - this\.viewportCenter\.y/);
  assert.match(synchronize, /setRotationFromEuler\(0, 0, slot\.display\.rotationDegrees\)/);
  assert.match(synchronize, /presented\.opacity\.opacity = slot\.display\.opacity/);
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
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  throw new Error(`${methodName} method body is unterminated`);
}
