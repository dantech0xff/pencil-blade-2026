import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CRAZY_INTRO_GO_RASTER_PATH,
  CRAZY_INTRO_SIXTY_RASTER_PATH,
  CRAZY_INTRO_TOTAL_SECONDS,
  createCrazyIntroPresentationPlan,
} from '../../../game/assets/scripts/domain/crazy-intro-presentation.ts';

test('Crazy intro preserves exact 60s then GO paths, geometry, timing, and callbacks', () => {
  const plan = createCrazyIntroPresentationPlan({
    goSpriteWidth: 70,
    sixtySpriteWidth: 167,
    visibleRect: {
      center: { x: 240, y: 400 },
      leftX: 0,
      rightX: 480,
    },
  });

  assert.deepEqual(plan, {
    cutDisabledDuringIntro: false,
    go: {
      completion: 'start-crazy',
      fadeSequence: [
        { durationSeconds: 0.25, type: 'fade-in' },
        { durationSeconds: 0.5, type: 'delay' },
        { durationSeconds: 0.25, type: 'fade-out' },
        { cleanupCurrent: true, type: 'invoke-completion', value: 'start-crazy' },
      ],
      initialWorldPosition: { x: -35, y: 400 },
      moveSequence: [
        { durationSeconds: 0.25, position: { x: 240, y: 400 }, type: 'move-to' },
        { durationSeconds: 0.5, type: 'delay' },
        { durationSeconds: 0.25, position: { x: 515, y: 400 }, type: 'move-to' },
      ],
      rasterPath: CRAZY_INTRO_GO_RASTER_PATH,
      tracksRunConcurrently: true,
      zOrder: 1,
    },
    sixty: {
      completion: 'replace-with-go',
      fadeSequence: [
        { durationSeconds: 0.25, type: 'fade-in' },
        { durationSeconds: 0.5, type: 'delay' },
        { durationSeconds: 0.25, type: 'fade-out' },
        { cleanupCurrent: true, type: 'invoke-completion', value: 'replace-with-go' },
      ],
      initialWorldPosition: { x: -83.5, y: 400 },
      moveSequence: [
        { durationSeconds: 0.25, position: { x: 240, y: 400 }, type: 'move-to' },
        { durationSeconds: 0.5, type: 'delay' },
        { durationSeconds: 0.25, position: { x: 563.5, y: 400 }, type: 'move-to' },
      ],
      rasterPath: CRAZY_INTRO_SIXTY_RASTER_PATH,
      tracksRunConcurrently: true,
      zOrder: 1,
    },
    totalActionSeconds: 2,
  });
  assert.equal(CRAZY_INTRO_TOTAL_SECONDS, 2);
});

test('both resolution trees use their own exact widths and the same visible center', () => {
  const plan = createCrazyIntroPresentationPlan({
    goSpriteWidth: 106,
    sixtySpriteWidth: 249,
    visibleRect: {
      center: { x: 360, y: 640 },
      leftX: 0,
      rightX: 720,
    },
  });
  assert.deepEqual(plan.sixty.initialWorldPosition, { x: -124.5, y: 640 });
  assert.deepEqual(plan.sixty.moveSequence[2], {
    durationSeconds: 0.25,
    position: { x: 844.5, y: 640 },
    type: 'move-to',
  });
  assert.deepEqual(plan.go.initialWorldPosition, { x: -53, y: 640 });
  assert.deepEqual(plan.go.moveSequence[2], {
    durationSeconds: 0.25,
    position: { x: 773, y: 640 },
    type: 'move-to',
  });
});

test('plan is deeply immutable and invalid geometry fails closed', () => {
  const plan = createCrazyIntroPresentationPlan({
    goSpriteWidth: 1,
    sixtySpriteWidth: 1,
    visibleRect: { center: { x: 0, y: 0 }, leftX: -1, rightX: 1 },
  });
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.sixty), true);
  assert.equal(Object.isFrozen(plan.sixty.fadeSequence), true);
  assert.equal(plan.sixty.fadeSequence.every(Object.isFrozen), true);
  assert.equal(Object.isFrozen(plan.go.moveSequence), true);
  assert.equal(plan.go.moveSequence.every(Object.isFrozen), true);

  assert.throws(
    () => createCrazyIntroPresentationPlan({
      goSpriteWidth: 0,
      sixtySpriteWidth: 1,
      visibleRect: { center: { x: 0, y: 0 }, leftX: -1, rightX: 1 },
    }),
    /positive/,
  );
  assert.throws(
    () => createCrazyIntroPresentationPlan({
      goSpriteWidth: 1,
      sixtySpriteWidth: 1,
      visibleRect: { center: { x: 0, y: 0 }, leftX: 1, rightX: 1 },
    }),
    /greater/,
  );
});

test('Crazy intro domain has no Creator dependency', () => {
  const source = readFileSync(new URL(
    '../../../game/assets/scripts/domain/crazy-intro-presentation.ts',
    import.meta.url,
  ), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]cc['"]/);
});
