import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

import type {
  BirdBladeRaycastBatch,
} from '../../../game/assets/scripts/creator/bird-blade-ray-adapter.ts';
import type {
  BirdBladeRaySegment,
} from '../../../game/assets/scripts/domain/bird-blade-state.ts';

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

const { BirdBladeRayAdapter } = await import(
  '../../../game/assets/scripts/creator/bird-blade-ray-adapter.ts'
);

interface Hit {
  readonly id: string;
}

class RaySource {
  acknowledgements = 0;
  segment: BirdBladeRaySegment | null;

  constructor(segment: BirdBladeRaySegment | null) {
    this.segment = segment;
  }

  peekCachedRaySegment(): BirdBladeRaySegment | null {
    return this.segment;
  }

  acknowledgeCachedRay(): boolean {
    if (this.segment === null) {
      return false;
    }
    this.acknowledgements += 1;
    this.segment = null;
    return true;
  }
}

const SEGMENT: BirdBladeRaySegment = Object.freeze({
  current: Object.freeze({ x: 20, y: 10 }),
  previous: Object.freeze({ x: 10, y: 10 }),
});

test('one cached segment uses the shared forward/reverse plan and clears only after success', () => {
  const source = new RaySource(SEGMENT);
  const calls: Array<Readonly<{
    end: Readonly<{ x: number; y: number }>;
    start: Readonly<{ x: number; y: number }>;
  }>> = [];
  const adapter = BirdBladeRayAdapter.create<Hit>({
    raySource: source,
    raycast: {
      raycastAll(start, end) {
        calls.push({ start: { ...start }, end: { ...end } });
        return calls.length % 2 === 1
          ? [{ id: 'forward' }]
          : [{ id: 'reverse' }];
      },
    },
    viewportWidth: 480,
  });
  let rejectedBatch: BirdBladeRaycastBatch<Hit> | null = null;

  assert.equal(adapter.processOneCachedRay((batch) => {
    rejectedBatch = batch;
    return false;
  }), false);
  assert.equal(source.acknowledgements, 0);
  assert.equal(source.segment, SEGMENT);
  assert.deepEqual(calls, [
    { start: { x: -20, y: 10 }, end: { x: 50, y: 10 } },
    { start: { x: 50, y: 10 }, end: { x: -20, y: 10 } },
  ]);
  assert.ok(rejectedBatch);
  assert.deepEqual(rejectedBatch.plan?.original, {
    start: { x: 10, y: 10 },
    end: { x: 20, y: 10 },
  });
  assert.deepEqual(rejectedBatch.forwardHits, [{ id: 'forward' }]);
  assert.deepEqual(rejectedBatch.reverseHits, [{ id: 'reverse' }]);
  assert.equal(Object.isFrozen(rejectedBatch), true);
  assert.equal(Object.isFrozen(rejectedBatch.sourceSegment), true);
  assert.equal(Object.isFrozen(rejectedBatch.sourceSegment.previous), true);
  assert.equal(Object.isFrozen(rejectedBatch.forwardHits), true);

  assert.equal(adapter.processOneCachedRay(() => true), true);
  assert.equal(source.acknowledgements, 1);
  assert.equal(source.segment, null);
  assert.equal(calls.length, 4);
  assert.equal(adapter.processOneCachedRay(() => true), false);
  assert.equal(calls.length, 4);
});

test('zero-length cached segment exposes a no-ray batch and still requires caller success', () => {
  const point = Object.freeze({ x: 4, y: 5 });
  const source = new RaySource(Object.freeze({
    current: point,
    previous: point,
  }));
  let raycasts = 0;
  const adapter = BirdBladeRayAdapter.create({
    raySource: source,
    raycast: {
      raycastAll() {
        raycasts += 1;
        return [];
      },
    },
    viewportWidth: 720,
  });
  let observedPlan: unknown = 'unset';

  assert.equal(adapter.processOneCachedRay((batch) => {
    observedPlan = batch.plan;
    assert.deepEqual(batch.forwardHits, []);
    assert.deepEqual(batch.reverseHits, []);
    return true;
  }), true);

  assert.equal(observedPlan, null);
  assert.equal(raycasts, 0);
  assert.equal(source.acknowledgements, 1);
});

test('raycast or caller failure retains the cache for a later successful retry', () => {
  const source = new RaySource(SEGMENT);
  const adapter = BirdBladeRayAdapter.create({
    raySource: source,
    raycast: {
      raycastAll() {
        throw new Error('physics unavailable');
      },
    },
    viewportWidth: 480,
  });

  assert.throws(
    () => adapter.processOneCachedRay(() => true),
    /physics unavailable/,
  );
  assert.equal(source.segment, SEGMENT);
  assert.equal(source.acknowledgements, 0);
});

test('malformed source, raycast, width, returns, and acknowledgements reject', () => {
  const validInput = {
    raySource: new RaySource(SEGMENT),
    raycast: { raycastAll: () => [] },
    viewportWidth: 480,
  };

  assert.throws(
    () => BirdBladeRayAdapter.create(null as never),
    /input must be an object/,
  );
  assert.throws(
    () => BirdBladeRayAdapter.create({ ...validInput, raySource: {} as never }),
    /raySource\.acknowledgeCachedRay/,
  );
  assert.throws(
    () => BirdBladeRayAdapter.create({ ...validInput, raycast: {} as never }),
    /raycast\.raycastAll/,
  );
  assert.throws(
    () => BirdBladeRayAdapter.create({ ...validInput, viewportWidth: 0 }),
    /viewportWidth/,
  );

  const badHits = BirdBladeRayAdapter.create({
    ...validInput,
    raycast: { raycastAll: () => null as never },
  });
  assert.throws(
    () => badHits.processOneCachedRay(() => true),
    /forward raycastAll\(\) must return an array/,
  );
  assert.equal(validInput.raySource.segment, SEGMENT);

  const badCallback = BirdBladeRayAdapter.create(validInput);
  assert.throws(
    () => badCallback.processOneCachedRay(() => 'yes' as never),
    /acknowledgeBatch must return a boolean/,
  );
  assert.equal(validInput.raySource.acknowledgements, 0);

  const malformedSegment = new RaySource({
    current: { x: Number.NaN, y: 1 },
    previous: { x: 0, y: 0 },
  });
  const badSource = BirdBladeRayAdapter.create({
    ...validInput,
    raySource: malformedSegment,
  });
  assert.throws(
    () => badSource.processOneCachedRay(() => true),
    /finite coordinates/,
  );
});
