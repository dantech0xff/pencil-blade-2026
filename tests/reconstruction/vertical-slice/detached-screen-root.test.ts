import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

test('detached screen roots stage the exact Canvas world transform before attachment', () => {
  const source = readFileSync(
    `${REPOSITORY_ROOT}/game/assets/scripts/creator/detached-screen-root.ts`,
    'utf8',
  );
  assert.match(source, /const root = new Node\(name\)/);
  assert.match(source, /root\.layer = canvas\.layer/);
  assert.match(source, /root\.setWorldPosition\(canvas\.worldPosition\)/);
  assert.match(source, /root\.setWorldRotation\(canvas\.worldRotation\)/);
  assert.match(source, /root\.setWorldScale\(canvas\.worldScale\)/);
  assert.doesNotMatch(source, /root\.setParent/);
});
