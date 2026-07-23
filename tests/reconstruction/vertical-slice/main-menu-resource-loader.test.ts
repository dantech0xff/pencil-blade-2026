import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

test('Main Menu loader consumes the complete accepted raster profile and exact font', () => {
  const source = readFileSync(
    `${REPOSITORY_ROOT}/game/assets/scripts/creator/main-menu-resource-loader.ts`,
    'utf8',
  );

  for (const expression of [
    'profile.pencilBladeBackground',
    'profile.pencilBlade',
    'profile.totalCoinsPanel',
    'profile.about',
    'profile.review',
    'profile.musicToggle',
    'profile.effectsToggle',
    'profile.blueWheelOptions',
    'profile.exit',
    'profile.orangeWheel',
    'profile.blackWheel',
    'profile.circles.blur',
    'profile.circles.leaderboard',
    'profile.circles.objectives',
    'profile.circles.newGame',
    'profile.fruits.electricApple',
    'profile.fruits.orange',
    'profile.fruits.strawberry',
    'profile.heart',
  ]) {
    assert.ok(source.includes(expression), `loader omitted ${expression}`);
  }
  assert.match(source, /MAIN_MENU_SHARED_RESOURCES\.font\.canonicalPath/);
  assert.match(source, /loadExactGameRasters\(rasterContracts, bundle\)/);
  assert.doesNotMatch(source, /button-review-normal|button-review-selected/);
});

test('Main Menu catalog rejects missing or geometry-changed runtime lookups', () => {
  const source = readFileSync(
    `${REPOSITORY_ROOT}/game/assets/scripts/creator/main-menu-resource-loader.ts`,
    'utf8',
  );

  assert.match(source, /rastersByPath\.get\(resource\.canonicalPath\)/);
  assert.match(source, /Main Menu raster was not loaded/);
  assert.match(source, /loaded\.dimensions\.width !== resource\.dimensions\.width/);
  assert.match(source, /loaded\.dimensions\.height !== resource\.dimensions\.height/);
  assert.match(source, /Duplicate Main Menu raster contract/);
});
