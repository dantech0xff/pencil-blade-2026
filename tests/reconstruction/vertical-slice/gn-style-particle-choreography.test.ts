import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GN_STYLE_PARTICLE_CANONICAL_CSV_SHA256,
  GN_STYLE_PARTICLE_CHOREOGRAPHY,
  GN_STYLE_PARTICLE_CHOREOGRAPHY_CALL_COUNT,
  GN_STYLE_PARTICLE_EMITTER_Z_ORDER,
  GN_STYLE_RESULT_REPLACEMENT_GAMEPLAY_SECONDS,
  createGnStyleParticleEmitterPlans,
  gnStyleParticleRootOrdinalsAliveAt,
} from '../../../game/assets/scripts/domain/gn-style-particle-choreography.ts';

test('generated facade preserves all 439 rows, closed families, flags, points, and source order', () => {
  assert.equal(GN_STYLE_PARTICLE_CHOREOGRAPHY_CALL_COUNT, 439);
  assert.equal(GN_STYLE_PARTICLE_CHOREOGRAPHY.length, 439);
  assert.equal(GN_STYLE_PARTICLE_EMITTER_Z_ORDER, 1);
  assert.equal(
    GN_STYLE_PARTICLE_CANONICAL_CSV_SHA256,
    '6c8dd814fb776e15507c2f42081b315bd410ea5b9a9156a4726c186504507c97',
  );
  assert.equal(Object.isFrozen(GN_STYLE_PARTICLE_CHOREOGRAPHY), true);
  assert.equal(GN_STYLE_PARTICLE_CHOREOGRAPHY.every(Object.isFrozen), true);
  assert.deepEqual(
    GN_STYLE_PARTICLE_CHOREOGRAPHY.slice(0, 4).map((row) => row.pointId),
    ['A08', 'A01', 'A03', 'A13'],
  );

  const familyCounts = countBy((row) => row.family);
  assert.deepEqual(familyCounts, {
    F5: 223,
    ST: 32,
    VN: 30,
    HX: 17,
    F4: 128,
    CI: 9,
  });
  assert.deepEqual(countBy((row) => `${Number(row.flagA)},${Number(row.flagB)}`), {
    '0,0': 341,
    '0,1': 34,
    '1,0': 64,
  });
  assert.equal(
    GN_STYLE_PARTICLE_CHOREOGRAPHY.filter((row) => row.pointId.startsWith('A')).length,
    423,
  );
  assert.equal(
    GN_STYLE_PARTICLE_CHOREOGRAPHY.filter((row) => row.pointId.startsWith('D')).length,
    16,
  );

  let delayDecreaseCount = 0;
  for (let index = 1; index < GN_STYLE_PARTICLE_CHOREOGRAPHY.length; index += 1) {
    if (
      float32(GN_STYLE_PARTICLE_CHOREOGRAPHY[index].startDelayBits)
      < float32(GN_STYLE_PARTICLE_CHOREOGRAPHY[index - 1].startDelayBits)
    ) {
      delayDecreaseCount += 1;
    }
  }
  assert.equal(delayDecreaseCount, 25);
});

test('480x800 expansion preserves float32 scaling, positions, durations, and dynamic cleanup', () => {
  const plans = createGnStyleParticleEmitterPlans({ width: 480, height: 800 });
  const expectedCountScale = Math.fround(
    Math.fround(Math.fround(480) * Math.fround(800)) * (2 ** -20),
  );

  assert.equal(plans.length, 439);
  assert.equal(Object.isFrozen(plans), true);
  assert.equal(plans.every(Object.isFrozen), true);
  assert.equal(plans.every((plan) => Object.isFrozen(plan.emitterWorldPosition)), true);
  assert.deepEqual(plans[0], {
    ordinal: 1,
    minimumTravelMagnitude: 50,
    maximumTravelMagnitude: 300,
    minimumDurationHundredths: 50,
    maximumDurationHundredths: 150,
    particleCount: Math.trunc(Math.fround(50 * expectedCountScale)),
    startDelaySeconds: 3,
    cleanupDelaySeconds: 3,
    removeAtSeconds: 6,
    emitterWorldPosition: { x: 240, y: 350 },
    pointId: 'A08',
    family: 'F5',
    textureLogicalPath: 'Blades/Particles/X-Mas/xmasfive.png',
    flagA: false,
    flagB: false,
    zOrder: 1,
  });

  const direct = plans.find((plan) => plan.pointId === 'D02');
  assert.ok(direct);
  assert.deepEqual(direct.emitterWorldPosition, {
    x: 240,
    y: Math.fround(800 * float32(0x3e90_20c5)),
  });
});

test('count scale uses the inclusive 720..1136 fixed-width branch and area branch outside it', () => {
  const at720 = createGnStyleParticleEmitterPlans({ width: 720, height: 1280 })[0];
  const at1136 = createGnStyleParticleEmitterPlans({ width: 1136, height: 1280 })[0];
  const above1136 = createGnStyleParticleEmitterPlans({ width: 1137, height: 1280 })[0];
  const below720 = createGnStyleParticleEmitterPlans({ width: 719, height: 1280 })[0];

  assert.equal(at720.minimumTravelMagnitude, 75);
  assert.equal(at720.maximumTravelMagnitude, 450);
  assert.equal(at720.particleCount, Math.trunc(Math.fround(50 * Math.fround(0.45))));
  assert.equal(at1136.particleCount, Math.trunc(Math.fround(50 * Math.fround(0.45))));
  assert.equal(above1136.particleCount, 50);
  assert.equal(
    below720.particleCount,
    Math.trunc(Math.fround(
      50 * Math.min(
        Math.fround(Math.fround(719 * 1280) * (2 ** -20)),
        Math.fround(1),
      ),
    )),
  );

  const tiny = createGnStyleParticleEmitterPlans({ width: 1, height: 1 })[0];
  assert.equal(tiny.minimumTravelMagnitude, 0);
  assert.equal(tiny.maximumTravelMagnitude, 0);
  assert.equal(tiny.particleCount, 0);
});

test('cleanup thresholds retain the native float32 division and action-sequence sum', () => {
  const plans = createGnStyleParticleEmitterPlans({ width: 480, height: 800 });
  const row229 = plans[228];
  const row236 = plans[235];

  assert.ok(row229);
  assert.ok(row236);
  assert.equal(row229.cleanupDelaySeconds, 0.699999988079071);
  assert.equal(row229.removeAtSeconds, 119.69999694824219);
  assert.equal(row236.cleanupDelaySeconds, 0.699999988079071);
  assert.equal(row236.removeAtSeconds, 120.29999542236328);
  assert.equal(
    gnStyleParticleRootOrdinalsAliveAt(plans, row229.removeAtSeconds - 0.000_001)
      .includes(229),
    true,
  );
  assert.equal(
    gnStyleParticleRootOrdinalsAliveAt(plans, row229.removeAtSeconds)
      .includes(229),
    false,
  );
});

test('twelve late roots survive Result replacement and are removed by layer teardown', () => {
  const plans = createGnStyleParticleEmitterPlans({ width: 480, height: 800 });
  const aliveAtResult = gnStyleParticleRootOrdinalsAliveAt(
    plans,
    GN_STYLE_RESULT_REPLACEMENT_GAMEPLAY_SECONDS,
  );
  assert.deepEqual(
    aliveAtResult,
    Array.from({ length: 12 }, (_, index) => index + 428),
  );
  assert.equal(
    plans.slice(427, 437).every((plan) => plan.removeAtSeconds === 153.5),
    true,
  );
  assert.equal(
    plans.slice(437).every((plan) => plan.removeAtSeconds === 155.5),
    true,
  );
  assert.deepEqual(gnStyleParticleRootOrdinalsAliveAt(plans, 153.5), [438, 439]);
  assert.deepEqual(gnStyleParticleRootOrdinalsAliveAt(plans, 155.5), []);
});

test('viewport and alive-root boundaries reject malformed external inputs', () => {
  for (const viewport of [
    null,
    { width: 0, height: 800 },
    { width: 480, height: -1 },
    { width: Number.NaN, height: 800 },
    { width: Number.MAX_VALUE, height: 800 },
    { width: Number.MIN_VALUE, height: 800 },
  ]) {
    assert.throws(
      () => createGnStyleParticleEmitterPlans(viewport as never),
      /viewport|positive|finite/,
    );
  }

  const plans = createGnStyleParticleEmitterPlans({ width: 480, height: 800 });
  assert.throws(() => gnStyleParticleRootOrdinalsAliveAt(null as never, 153), /plans/);
  assert.throws(() => gnStyleParticleRootOrdinalsAliveAt(plans, -1), /non-negative/);
  assert.throws(
    () => gnStyleParticleRootOrdinalsAliveAt(plans, Number.NaN),
    /finite/,
  );
});

function countBy(
  selector: (
    row: (typeof GN_STYLE_PARTICLE_CHOREOGRAPHY)[number],
  ) => string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of GN_STYLE_PARTICLE_CHOREOGRAPHY) {
    const key = selector(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function float32(bits: number): number {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, bits, true);
  return view.getFloat32(0, true);
}
