import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SHARED_BACKGROUND_DEFAULT_INDEX,
  SHARED_BACKGROUND_RESOURCES,
  SHARED_LEAF_RESOURCES,
  SHARED_THEME_DEFAULT_INDEX,
  SHARED_THEME_RESOURCES,
  getSharedBackgroundResource,
  getSharedLeafResources,
  getSharedThemeResource,
} from '../../../game/assets/scripts/domain/shared-game-scene-resources.ts';

test('shared defaults and both exact indexed families remain complete', () => {
  assert.equal(SHARED_BACKGROUND_DEFAULT_INDEX, 0);
  assert.equal(SHARED_THEME_DEFAULT_INDEX, 2);
  assert.equal(SHARED_BACKGROUND_RESOURCES['480x800'].length, 9);
  assert.equal(SHARED_BACKGROUND_RESOURCES['720x1280'].length, 9);
  assert.equal(SHARED_THEME_RESOURCES['480x800'].length, 10);
  assert.equal(SHARED_THEME_RESOURCES['720x1280'].length, 10);

  assert.deepEqual(
    SHARED_BACKGROUND_RESOURCES['480x800'].map(({ dimensions }) => [
      dimensions.width,
      dimensions.height,
    ]),
    [
      [480, 800], [480, 800], [480, 800], [480, 802], [481, 801],
      [480, 800], [480, 800], [480, 801], [481, 800],
    ],
  );
  assert.deepEqual(
    SHARED_BACKGROUND_RESOURCES['720x1280'].map(({ dimensions }) => [
      dimensions.width,
      dimensions.height,
    ]),
    [
      [720, 1280], [721, 1281], [720, 1280], [720, 1280], [721, 1281],
      [720, 1280], [721, 1280], [720, 1281], [721, 1281],
    ],
  );
  assert.deepEqual(
    SHARED_THEME_RESOURCES['480x800'].map(({ dimensions }) => [
      dimensions.width,
      dimensions.height,
    ]),
    [
      [480, 800], [482, 802], [482, 802], [480, 800], [480, 800],
      [480, 800], [480, 800], [480, 800], [480, 800], [480, 800],
    ],
  );
  assert.ok(SHARED_THEME_RESOURCES['720x1280'].every(({ dimensions }) => (
    dimensions.width === 720 && dimensions.height === 1280
  )));

  for (const tree of ['480x800', '720x1280'] as const) {
    SHARED_BACKGROUND_RESOURCES[tree].forEach((resource, index) => {
      assert.equal(resource.canonicalPath, `${tree}/Backgrounds/paperbackground${index}.png`);
      assert.equal(getSharedBackgroundResource(tree, index), resource);
    });
    SHARED_THEME_RESOURCES[tree].forEach((resource, index) => {
      assert.equal(resource.canonicalPath, `${tree}/Themes/theme${index}.png`);
      assert.equal(getSharedThemeResource(tree, index), resource);
    });
  }
});

test('leaf resources preserve the native pointer-array order and byte-identical geometry', () => {
  assert.deepEqual(
    SHARED_LEAF_RESOURCES.map(({ name }) => name),
    ['leave7', 'leave1', 'leave2', 'leave3', 'leave4', 'leave5', 'leave6'],
  );
  assert.deepEqual(
    getSharedLeafResources('480x800').map(({ dimensions }) => [
      dimensions.width,
      dimensions.height,
    ]),
    [[75, 71], [84, 79], [69, 64], [51, 91], [74, 71], [79, 69], [66, 70]],
  );
  assert.deepEqual(
    getSharedLeafResources('720x1280').map(({ dimensions }) => [
      dimensions.width,
      dimensions.height,
    ]),
    [[75, 71], [84, 79], [69, 64], [51, 91], [74, 71], [79, 69], [66, 70]],
  );
  for (const definition of SHARED_LEAF_RESOURCES) {
    assert.equal(
      definition.rasters['480x800'].canonicalPath.replace('480x800/', ''),
      definition.rasters['720x1280'].canonicalPath.replace('720x1280/', ''),
    );
  }
});

test('shared resource catalogs are deeply immutable and invalid selections fail safely', () => {
  assert.equal(Object.isFrozen(SHARED_BACKGROUND_RESOURCES), true);
  assert.equal(Object.isFrozen(SHARED_BACKGROUND_RESOURCES['480x800']), true);
  assert.equal(Object.isFrozen(SHARED_BACKGROUND_RESOURCES['480x800'][0]), true);
  assert.equal(Object.isFrozen(SHARED_BACKGROUND_RESOURCES['480x800'][0]?.dimensions), true);
  assert.equal(Object.isFrozen(SHARED_THEME_RESOURCES), true);
  assert.equal(Object.isFrozen(SHARED_LEAF_RESOURCES), true);
  assert.equal(Object.isFrozen(SHARED_LEAF_RESOURCES[0]?.rasters), true);

  assert.throws(() => getSharedBackgroundResource('480x800', -1), RangeError);
  assert.throws(() => getSharedBackgroundResource('720x1280', 9), RangeError);
  assert.throws(() => getSharedThemeResource('480x800', 10), RangeError);
  assert.throws(() => getSharedThemeResource('720x1280', 1.5), RangeError);
});
