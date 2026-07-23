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
  OBJECTIVE_ACHIEVEMENT_PARTICLE_REMOVE_SECONDS,
  OBJECTIVE_ACHIEVEMENT_PARTICLE_START_SECONDS,
  ObjectiveAchievementPresentationState,
  createObjectiveAchievementParticleBurst,
  createObjectiveAchievementPresentationPlan,
} = await import(
  '../../../game/assets/scripts/domain/objective-achievement-presentation.ts'
);

const INPUT = Object.freeze({
  completedBannerHeight: 138,
  completedBannerWidth: 552,
  completedDescription: 'No bombs hit Crazy Mode',
  nextBannerHeight: 132,
  nextBannerWidth: 552,
  nextDescription: '5000 fruits total',
  nextReward: 'reward: 695 coins',
  viewportHeight: 800,
  viewportWidth: 480,
});

test('achievement plan preserves banner labels, timing geometry, and equal-z insertion inputs', () => {
  const plan = createObjectiveAchievementPresentationPlan(INPUT);
  assert.deepEqual(plan.completed.initialWorldPosition, { x: 240, y: 869 });
  assert.deepEqual(plan.completed.visibleWorldPosition, { x: 240, y: 731 });
  assert.deepEqual(plan.completed.descriptionLocalPosition, { x: 276, y: 69 });
  assert.equal(plan.completed.descriptionFontSize, 28.8);

  assert.deepEqual(plan.next.initialWorldPosition, { x: 240, y: 866 });
  assert.deepEqual(plan.next.visibleWorldPosition, { x: 240, y: 734 });
  assert.deepEqual(plan.next.descriptionLocalPosition, { x: 276, y: 79.2 });
  assert.deepEqual(plan.next.rewardLocalPosition, { x: 345, y: 48 });
  assert.equal(plan.next.rewardFontSize, 24);
  assert.equal(plan.zOrder, 1);

  assert.deepEqual(
    plan.particleEmitters.map((emitter) => ({
      count: emitter.particleCount,
      position: emitter.worldPosition,
      texture: emitter.texture,
    })),
    [
      { count: 40, position: { x: 96, y: 770 }, texture: 'xmas-five' },
      { count: 50, position: { x: 240, y: 770 }, texture: 'xmas-four' },
      { count: 40, position: { x: 384, y: 770 }, texture: 'xmas-five' },
    ],
  );
  for (const emitter of plan.particleEmitters) {
    assert.equal(emitter.startDelaySeconds, 0.41);
    assert.equal(emitter.cleanupDelaySeconds, 4);
    assert.equal(emitter.removeAtSeconds, 4.41);
    assert.deepEqual(emitter.colorFlags, [false, false]);
    assert.equal(emitter.autoDeleteParticles, false);
    assert.equal(emitter.zOrder, 1);
  }
});

test('completed banner occupies t0-.5 ingress, one-second hold, and .5 egress', () => {
  const state = new ObjectiveAchievementPresentationState(INPUT);
  assert.deepEqual(
    state.snapshot.completedBannerWorldPosition,
    { x: 240, y: 869 },
  );
  state.updateAction(0.25);
  assert.deepEqual(
    state.snapshot.completedBannerWorldPosition,
    { x: 240, y: 800 },
  );
  state.updateAction(0.25);
  assert.deepEqual(
    state.snapshot.completedBannerWorldPosition,
    { x: 240, y: 731 },
  );
  state.updateAction(1);
  assert.deepEqual(
    state.snapshot.completedBannerWorldPosition,
    { x: 240, y: 731 },
  );
  state.updateAction(0.25);
  assert.deepEqual(
    state.snapshot.completedBannerWorldPosition,
    { x: 240, y: 800 },
  );
  state.updateAction(0.25);
  assert.deepEqual(
    state.snapshot.completedBannerWorldPosition,
    { x: 240, y: 869 },
  );
});

test('next banner delays four seconds, enters .5, holds 2.5, exits .5, and persists', () => {
  const state = new ObjectiveAchievementPresentationState(INPUT);
  state.updateAction(4);
  assert.deepEqual(state.snapshot.nextBannerWorldPosition, { x: 240, y: 866 });
  state.updateAction(0.25);
  assert.deepEqual(state.snapshot.nextBannerWorldPosition, { x: 240, y: 800 });
  state.updateAction(0.25);
  assert.deepEqual(state.snapshot.nextBannerWorldPosition, { x: 240, y: 734 });
  state.updateAction(2.5);
  assert.deepEqual(state.snapshot.nextBannerWorldPosition, { x: 240, y: 734 });
  state.updateAction(0.25);
  assert.deepEqual(state.snapshot.nextBannerWorldPosition, { x: 240, y: 800 });
  state.updateAction(0.25);
  assert.deepEqual(state.snapshot.nextBannerWorldPosition, { x: 240, y: 866 });
  state.updateAction(10);
  assert.deepEqual(state.snapshot.nextBannerWorldPosition, { x: 240, y: 866 });
});

test('particle callbacks fire once at .41 and remove all containers at 4.41', () => {
  const state = new ObjectiveAchievementPresentationState(INPUT);
  assert.equal(OBJECTIVE_ACHIEVEMENT_PARTICLE_START_SECONDS, 0.41);
  assert.equal(OBJECTIVE_ACHIEVEMENT_PARTICLE_REMOVE_SECONDS, 4.41);
  assert.equal(state.updateAction(0.4).startParticlesNow, false);
  assert.deepEqual(state.updateAction(0.01), {
    removeParticleContainersNow: false,
    snapshot: {
      completedBannerWorldPosition: { x: 240, y: 755.84 },
      disposed: false,
      elapsedActionSeconds: 0.41000000000000003,
      nextBannerWorldPosition: { x: 240, y: 866 },
      particleContainersRemoved: false,
      particlesStarted: true,
    },
    startParticlesNow: true,
  });
  assert.equal(state.updateAction(3.99).removeParticleContainersNow, false);
  const removal = state.updateAction(0.01);
  assert.equal(removal.removeParticleContainersNow, true);
  assert.equal(removal.snapshot.particleContainersRemoved, true);
  assert.equal(state.updateAction(1).removeParticleContainersNow, false);
  assert.equal(state.updateAction(1).startParticlesNow, false);
});

test('each generic ParticleExplosion particle consumes five recovered inclusive draws', () => {
  const emitter = createObjectiveAchievementPresentationPlan(INPUT).particleEmitters[0];
  const calls: Array<readonly [number, number]> = [];
  const outputs = [150, -1, 75, 1, 300];
  let draw = 0;
  const random = {
    nextIntInclusive(minimum: number, maximum: number): number {
      calls.push([minimum, maximum]);
      const value = outputs[draw % outputs.length];
      draw += 1;
      if (value === undefined) {
        throw new Error('missing fixture draw');
      }
      return value;
    },
  };
  const particles = createObjectiveAchievementParticleBurst(emitter, random);
  assert.equal(particles.length, 40);
  assert.equal(calls.length, 200);
  assert.deepEqual(calls.slice(0, 5), [
    [100, 200],
    [-1, 1],
    [50, 300],
    [-1, 1],
    [50, 300],
  ]);
  assert.deepEqual(particles[0], {
    deltaLocal: { x: -75, y: 300 },
    durationHundredths: 150,
    durationSeconds: 1.5,
    emitterIndex: 0,
    horizontalMagnitude: 75,
    horizontalSign: -1,
    particleIndex: 0,
    verticalMagnitude: 300,
    verticalSign: 1,
  });
});

test('invalid strings, clocks, emitters, and random values fail closed', () => {
  assert.throws(
    () => createObjectiveAchievementPresentationPlan({
      ...INPUT,
      nextReward: '',
    }),
    /nextReward must be a non-empty string/,
  );
  const state = new ObjectiveAchievementPresentationState(INPUT);
  assert.throws(() => state.updateAction(-1), /deltaSeconds must be non-negative/);
  const emitter = createObjectiveAchievementPresentationPlan(INPUT).particleEmitters[0];
  assert.throws(
    () => createObjectiveAchievementParticleBurst(
      { ...emitter, particleCount: 41 } as never,
      { nextIntInclusive: () => 0 },
    ),
    /recovered achievement contract/,
  );
  assert.throws(
    () => createObjectiveAchievementParticleBurst(
      emitter,
      { nextIntInclusive: () => 999 },
    ),
    /outside/,
  );
  assert.equal(state.dispose(), true);
  assert.equal(state.dispose(), false);
  assert.equal(state.updateAction(10).snapshot.elapsedActionSeconds, 0);
});
