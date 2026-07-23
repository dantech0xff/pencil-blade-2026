import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

test('shared presenter encodes exact equal-z visual root order and screen placement', () => {
  const source = readText('game/assets/scripts/creator/shared-game-scene-presenter.ts');
  const constructor = extractMethod(source, 'constructor');
  const attach = extractMethod(source, 'attachCurrentScreen');
  const enforce = extractMethod(source, 'enforceSharedOrder');
  const attachLeaf = extractFunction(source, 'attachSharedLeafRoot');

  assert.ok(constructor.indexOf('this.background.attach(this.parent, 0)')
    < constructor.indexOf('attachSharedLeafRoot(this.leaf.root, this.parent, 1)'));
  assert.ok(constructor.indexOf('attachSharedLeafRoot(this.leaf.root, this.parent, 1)')
    < constructor.indexOf('this.theme.attach(this.parent, 2)'));
  assert.match(attachLeaf, /root\.setParent\(parent\)/);
  assert.doesNotMatch(attachLeaf, /root\.setParent\(parent, true\)/);
  assert.match(attach, /attachRoot\(screen, this\.parent, 3, 'current screen'\)/);
  assert.match(enforce, /background\.root\.setSiblingIndex\(0\)/);
  assert.match(enforce, /leaf\.root\.setSiblingIndex\(1\)/);
  assert.match(enforce, /theme\.root\.setSiblingIndex\(2\)/);
  assert.match(enforce, /currentScreenValue\?\.setSiblingIndex\(3\)/);
  assert.doesNotMatch(source, /setSiblingIndex\(command\.zOrder\)|tag\s*[=:]\s*[0-3]/);
});

test('screen replacement retains the exact previous identity and rolls back attachment failures', () => {
  const source = readText('game/assets/scripts/creator/shared-game-scene-presenter.ts');
  const attach = extractMethod(source, 'attachCurrentScreen');
  const detach = extractMethod(source, 'detachCurrentScreen');
  const replace = extractMethod(source, 'replaceCurrentScreen');

  assert.match(
    attach,
    /try \{[\s\S]*?attachRoot\(screen, this\.parent, 3, 'current screen'\)[\s\S]*?this\.currentScreenValue = screen[\s\S]*?catch \(error\)[\s\S]*?screen\.parent === this\.parent[\s\S]*?screen\.setParent\(null, true\)[\s\S]*?this\.currentScreenValue = null[\s\S]*?throw error/,
  );
  assert.match(
    detach,
    /try \{[\s\S]*?screen\.setParent\(null, true\)[\s\S]*?catch \(error\)[\s\S]*?screen\.parent === null[\s\S]*?attachRoot\(screen, this\.parent, 3, 'rollback failed current-screen detach'\)[\s\S]*?this\.currentScreenValue = screen[\s\S]*?throw error/,
  );
  assert.match(replace, /const previous = this\.currentScreenValue/);
  assert.match(replace, /this\.detachCurrentScreen\(previous\)/);
  assert.match(replace, /this\.attachCurrentScreen\(nextScreen\)/);
  assert.match(
    replace,
    /catch \(error\)[\s\S]*?this\.attachCurrentScreen\(previous\)[\s\S]*?throw error/,
  );
});

test('background and theme are immediate opaque centered custom-size sprites with retained geometry', () => {
  for (const path of [
    'game/assets/scripts/creator/shared-background-presenter.ts',
    'game/assets/scripts/creator/shared-theme-presenter.ts',
  ]) {
    const source = readText(path);
    const initial = extractMethod(source, 'applyInitialResource');
    const select = extractMethod(source, 'select');
    assert.match(source, /setAnchorPoint\(0\.5, 0\.5\)/);
    assert.match(source, /Sprite\.SizeMode\.CUSTOM/);
    assert.match(initial, /setPosition\(0, 0, 0\)/);
    assert.match(initial, /setScale\(1, 1, 1\)/);
    assert.match(initial, /this\.opacity\.opacity = 255/);
    assert.match(select, /retainedWidth[\s\S]*?retainedHeight[\s\S]*?spriteFrame = resource\.spriteFrame[\s\S]*?setContentSize\(retainedWidth, retainedHeight\)/);
    assert.doesNotMatch(source, /FadeIn|tween\(|scheduleOnce/);
  }
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

function extractFunction(source: string, functionName: string): string {
  const signature = new RegExp(`function\\s+${functionName}\\b[^\\n]*\\{`, 'm');
  const match = signature.exec(source);
  assert.ok(match, `${functionName} function must exist`);
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
  throw new Error(`${functionName} function body is unterminated`);
}
