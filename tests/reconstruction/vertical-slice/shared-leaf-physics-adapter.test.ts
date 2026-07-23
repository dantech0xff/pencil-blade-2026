import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

test('project declares the Box2D runtime package used by the independent leaf world', () => {
  const packageJson = JSON.parse(readText('game/package.json')) as {
    dependencies?: Record<string, string>;
  };
  assert.equal(packageJson.dependencies?.['@cocos/box2d'], '1.0.2');
});

test('leaf adapter owns a second Box2D world with the recovered configuration', () => {
  const source = readText('game/assets/scripts/creator/shared-leaf-physics-adapter.ts');
  const constructor = extractMethod(source, 'constructor');

  assert.match(
    source,
    /import box2dRuntime from '@cocos\/box2d\/build\/box2d\/box2d\.umd\.js'/,
  );
  assert.match(constructor, /this\.world = new box2d\.World\(new box2d\.Vec2\(/);
  assert.match(constructor, /gravityMetresPerSecondSquared\.x/);
  assert.match(constructor, /gravityMetresPerSecondSquared\.y/);
  assert.match(constructor, /SetAllowSleeping\(configuration\.allowSleep\)/);
  assert.match(constructor, /SetContinuousPhysics\(configuration\.continuousPhysics\)/);
  assert.doesNotMatch(source, /PhysicsSystem2D|ClassicPhysicsAdapter|director\.registerSystem/);
});

test('leaf bodies and fixtures retain the exact recovered no-contact profile', () => {
  const source = readText('game/assets/scripts/creator/shared-leaf-physics-adapter.ts');
  const constructor = extractMethod(source, 'constructor');

  assert.match(constructor, /definition\.type = SHARED_LEAF_BODY_DEFAULTS\.box2dTypeCode/);
  assert.match(constructor, /definition\.gravityScale = SHARED_LEAF_BODY_DEFAULTS\.gravityScale/);
  assert.match(constructor, /shape\.SetAsBox\([\s\S]*?fixtureHalfExtentsMetres\.x[\s\S]*?fixtureHalfExtentsMetres\.y/);
  assert.match(constructor, /fixture\.density = SHARED_LEAF_FIXTURE_DEFAULTS\.density/);
  assert.match(constructor, /fixture\.friction = SHARED_LEAF_FIXTURE_DEFAULTS\.friction/);
  assert.match(constructor, /fixture\.restitution = SHARED_LEAF_FIXTURE_DEFAULTS\.restitution/);
  assert.match(constructor, /fixture\.filter\.categoryBits = SHARED_LEAF_FIXTURE_DEFAULTS\.filter\.categoryBits/);
  assert.match(constructor, /fixture\.filter\.maskBits = SHARED_LEAF_FIXTURE_DEFAULTS\.filter\.maskBits/);
  assert.match(constructor, /body\.CreateFixture\(fixture\)/);
});

test('step and respawn preserve solver iterations and ordered mutation operations', () => {
  const source = readText('game/assets/scripts/creator/shared-leaf-physics-adapter.ts');
  const step = extractMethod(source, 'step');
  const respawn = extractMethod(source, 'applyRespawn');

  assert.match(
    step,
    /this\.world\.Step\([\s\S]*?command\.deltaSeconds[\s\S]*?command\.world\.velocityIterations[\s\S]*?command\.world\.positionIterations/,
  );
  const wake = respawn.indexOf("operation.type === 'wake-if-sleeping'");
  const angular = respawn.indexOf("operation.type === 'add-angular-velocity'");
  const transform = respawn.indexOf("operation.type === 'set-transform'");
  const linear = respawn.indexOf('body.SetLinearVelocity', transform);
  assert.ok(wake >= 0 && angular > wake && transform > angular && linear > transform);
  assert.match(respawn, /body\.GetAngularVelocity\(\) \+ operation\.deltaRadiansPerSecond/);
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
