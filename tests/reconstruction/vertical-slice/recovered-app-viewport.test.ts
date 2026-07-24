import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../'))
      && extname(specifier) === ''
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const {
  createRecoveredAppViewport,
} = await import('../../../game/assets/scripts/creator/recovered-app-viewport.ts');
const SOURCE = readFileSync(
  fileURLToPath(new URL(
    '../../../game/assets/scripts/creator/recovered-app-viewport.ts',
    import.meta.url,
  )),
  'utf8',
);

test('shared viewport facade explicitly includes the About viewport and point contracts', () => {
  assert.match(SOURCE, /type RecoveredAppViewport =\s*& AboutViewport/);
  assert.match(SOURCE, /\): AboutPoint\s*& LeaderboardPoint/);
});

test('creates a shared viewport for every non-gameplay foreground contract', () => {
  const compact = createRecoveredAppViewport({
    profile: { designHeight: 800, designWidth: 480 },
    visibleRect: { height: 800, width: 480, x: 0, y: 0 },
  } as never);
  assert.deepEqual(compact, {
    logicalHeight: 800,
    logicalWidth: 480,
    visibleRect: {
      bottom: { x: 240, y: 0 },
      center: { x: 240, y: 400 },
      left: { x: 0, y: 400 },
      right: { x: 480, y: 400 },
      top: { x: 240, y: 800 },
    },
  });
  assert.ok(Object.isFrozen(compact));
  assert.ok(Object.isFrozen(compact.visibleRect));
  assert.ok(Object.isFrozen(compact.visibleRect.bottom));
  assert.ok(Object.isFrozen(compact.visibleRect.center));
  assert.ok(Object.isFrozen(compact.visibleRect.left));
  assert.ok(Object.isFrozen(compact.visibleRect.right));
  assert.ok(Object.isFrozen(compact.visibleRect.top));

  const high = createRecoveredAppViewport({
    profile: { designHeight: 1280, designWidth: 720 },
    visibleRect: { height: 1280, width: 720, x: 0, y: 0 },
  } as never);
  assert.deepEqual(high.visibleRect.top, { x: 360, y: 1280 });
  assert.equal(high.logicalWidth, 720);
  assert.equal(high.logicalHeight, 1280);

  const offset = createRecoveredAppViewport({
    profile: { designHeight: 900, designWidth: 600 },
    visibleRect: { height: 900, width: 600, x: -20, y: 40 },
  } as never);
  assert.deepEqual(offset.visibleRect, {
    bottom: { x: 280, y: 40 },
    center: { x: 280, y: 490 },
    left: { x: -20, y: 490 },
    right: { x: 580, y: 490 },
    top: { x: 280, y: 940 },
  });
});

test('rejects invalid logical and visible dimensions', () => {
  assert.throws(
    () => createRecoveredAppViewport({
      profile: { designHeight: 800, designWidth: 0 },
      visibleRect: { height: 800, width: 480, x: 0, y: 0 },
    } as never),
    /input\.profile\.designWidth/,
  );
  assert.throws(
    () => createRecoveredAppViewport({
      profile: { designHeight: Number.POSITIVE_INFINITY, designWidth: 480 },
      visibleRect: { height: 800, width: 480, x: 0, y: 0 },
    } as never),
    /input\.profile\.designHeight/,
  );
  assert.throws(
    () => createRecoveredAppViewport({
      profile: { designHeight: 800, designWidth: 480 },
      visibleRect: { height: 0, width: 480, x: 0, y: 0 },
    } as never),
    /input\.visibleRect\.height/,
  );
  assert.throws(
    () => createRecoveredAppViewport({
      profile: { designHeight: 800, designWidth: 480 },
      visibleRect: { height: 800, width: Number.NaN, x: 0, y: 0 },
    } as never),
    /input\.visibleRect\.width/,
  );
});
