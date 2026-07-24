import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

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
  createLoadingPresentation,
} = await import('../../../game/assets/scripts/domain/loading-presentation.ts');

test('compact Loading composition preserves native positions, anchors, and insertion order', () => {
  const presentation = createLoadingPresentation('480x800', {
    logicalHeight: 800,
    logicalWidth: 480,
    visibleRect: {
      center: { x: 240, y: 400 },
    },
  });

  assert.deepEqual(summary(presentation), [
    ['480x800/Loading/backgroundLogo.png', 0, { x: 0.5, y: 0.5 }, { x: 240, y: 400 }],
    ['480x800/Loading/loadbkback.png', 1, { x: 0.5, y: 0.5 }, { x: 240, y: 200 }],
    ['480x800/Loading/loadprocess.png', 2, { x: 0, y: 0.5 }, { x: 147.5, y: 200 }],
    ['480x800/Loading/loadbkfront.png', 3, { x: 0.5, y: 0.5 }, { x: 240, y: 200 }],
  ]);
  assertDeepFrozen(presentation);
});

test('high Loading uses visible center x, raw win height quarter, and intrinsic fill width', () => {
  const presentation = createLoadingPresentation('720x1280', {
    logicalHeight: 1280,
    logicalWidth: 720,
    visibleRect: {
      center: { x: 401, y: 633 },
    },
  });

  assert.deepEqual(presentation.backgroundLogo.position, { x: 401, y: 633 });
  assert.deepEqual(presentation.barBack.position, { x: 401, y: 320 });
  assert.deepEqual(presentation.barFront.position, { x: 401, y: 320 });
  assert.deepEqual(presentation.progress.position, { x: 268.5, y: 320 });
  assert.equal(presentation.progress.resource.dimensions.width, 265);
});

test('Loading presentation rejects malformed viewport geometry', () => {
  assert.throws(
    () => createLoadingPresentation('480x800', null as never),
    TypeError,
  );
  assert.throws(
    () => createLoadingPresentation('480x800', {
      logicalHeight: 0,
      logicalWidth: 480,
      visibleRect: { center: { x: 240, y: 400 } },
    }),
    RangeError,
  );
  assert.throws(
    () => createLoadingPresentation('480x800', {
      logicalHeight: 800,
      logicalWidth: 480,
      visibleRect: { center: { x: Number.NaN, y: 400 } },
    }),
    RangeError,
  );
});

function summary(
  presentation: ReturnType<typeof createLoadingPresentation>,
): readonly unknown[] {
  return [
    presentation.backgroundLogo,
    presentation.barBack,
    presentation.progress,
    presentation.barFront,
  ].map(({ anchor, insertionIndex, position, resource }) => (
    [resource.canonicalPath, insertionIndex, anchor, position]
  ));
}

function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return;
  }
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) {
    assertDeepFrozen(child, seen);
  }
}
