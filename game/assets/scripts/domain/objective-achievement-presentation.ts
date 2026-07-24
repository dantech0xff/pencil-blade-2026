import type { GameplayRandom } from './gameplay-random';

export const OBJECTIVE_ACHIEVEMENT_Z_ORDER = 1 as const;
export const OBJECTIVE_ACHIEVEMENT_COMPLETED_INGRESS_SECONDS = 0.5;
export const OBJECTIVE_ACHIEVEMENT_COMPLETED_HOLD_SECONDS = 1;
export const OBJECTIVE_ACHIEVEMENT_COMPLETED_EGRESS_SECONDS = 0.5;
export const OBJECTIVE_ACHIEVEMENT_NEXT_DELAY_SECONDS = 4;
export const OBJECTIVE_ACHIEVEMENT_NEXT_INGRESS_SECONDS = 0.5;
export const OBJECTIVE_ACHIEVEMENT_NEXT_HOLD_SECONDS = 2.5;
export const OBJECTIVE_ACHIEVEMENT_NEXT_EGRESS_SECONDS = 0.5;
export const OBJECTIVE_ACHIEVEMENT_COMPLETE_SECONDS
  = OBJECTIVE_ACHIEVEMENT_NEXT_DELAY_SECONDS
    + OBJECTIVE_ACHIEVEMENT_NEXT_INGRESS_SECONDS
    + OBJECTIVE_ACHIEVEMENT_NEXT_HOLD_SECONDS
    + OBJECTIVE_ACHIEVEMENT_NEXT_EGRESS_SECONDS;
export const OBJECTIVE_ACHIEVEMENT_PARTICLE_START_SECONDS = 0.41;
export const OBJECTIVE_ACHIEVEMENT_PARTICLE_CLEANUP_DELAY_SECONDS = 4;
export const OBJECTIVE_ACHIEVEMENT_PARTICLE_REMOVE_SECONDS
  = OBJECTIVE_ACHIEVEMENT_PARTICLE_START_SECONDS
    + OBJECTIVE_ACHIEVEMENT_PARTICLE_CLEANUP_DELAY_SECONDS;

const PARTICLE_DURATION_MINIMUM_HUNDREDTHS = 100;
const PARTICLE_DURATION_MAXIMUM_HUNDREDTHS = 200;
const PARTICLE_DISTANCE_MINIMUM = 50;
const PARTICLE_DISTANCE_MAXIMUM = 300;
const HUNDREDTHS_PER_SECOND = 100;

export interface ObjectiveAchievementPoint {
  readonly x: number;
  readonly y: number;
}

export interface ObjectiveAchievementPlanInput {
  readonly completedBannerHeight: number;
  readonly completedBannerWidth: number;
  readonly completedDescription: string;
  readonly nextBannerHeight: number;
  readonly nextBannerWidth: number;
  readonly nextDescription: string;
  readonly nextReward: string;
  readonly viewportHeight: number;
  readonly viewportWidth: number;
}

export interface ObjectiveAchievementBannerPlan {
  readonly description: string;
  readonly descriptionFontSize: number;
  readonly descriptionLocalPosition: ObjectiveAchievementPoint;
  readonly initialWorldPosition: ObjectiveAchievementPoint;
  readonly visibleWorldPosition: ObjectiveAchievementPoint;
}

export type ObjectiveAchievementParticleTexture = 'xmas-five' | 'xmas-four';

export interface ObjectiveAchievementEmitterPlan {
  readonly autoDeleteParticles: false;
  readonly cleanupDelaySeconds: number;
  readonly colorFlags: readonly [false, false];
  readonly emitterIndex: 0 | 1 | 2;
  readonly particleCount: 40 | 50;
  readonly removeAtSeconds: number;
  readonly startDelaySeconds: number;
  readonly texture: ObjectiveAchievementParticleTexture;
  readonly worldPosition: ObjectiveAchievementPoint;
  readonly zOrder: 1;
}

export interface ObjectiveAchievementPresentationPlan {
  readonly completed: ObjectiveAchievementBannerPlan;
  readonly next: ObjectiveAchievementBannerPlan & Readonly<{
    readonly reward: string;
    readonly rewardFontSize: number;
    readonly rewardLocalPosition: ObjectiveAchievementPoint;
  }>;
  readonly particleEmitters: readonly [
    ObjectiveAchievementEmitterPlan,
    ObjectiveAchievementEmitterPlan,
    ObjectiveAchievementEmitterPlan,
  ];
  readonly zOrder: 1;
}

export interface ObjectiveAchievementParticlePlan {
  readonly deltaLocal: ObjectiveAchievementPoint;
  readonly durationHundredths: number;
  readonly durationSeconds: number;
  readonly emitterIndex: 0 | 1 | 2;
  readonly horizontalMagnitude: number;
  readonly horizontalSign: -1 | 0 | 1;
  readonly particleIndex: number;
  readonly verticalMagnitude: number;
  readonly verticalSign: -1 | 0 | 1;
}

export interface ObjectiveAchievementPresentationSnapshot {
  readonly complete: boolean;
  readonly completedBannerWorldPosition: ObjectiveAchievementPoint;
  readonly disposed: boolean;
  readonly elapsedActionSeconds: number;
  readonly nextBannerWorldPosition: ObjectiveAchievementPoint;
  readonly particleContainersRemoved: boolean;
  readonly particlesStarted: boolean;
}

export interface ObjectiveAchievementPresentationUpdate {
  readonly removeParticleContainersNow: boolean;
  readonly snapshot: ObjectiveAchievementPresentationSnapshot;
  readonly startParticlesNow: boolean;
}

export type ObjectiveAchievementRandom = Pick<GameplayRandom, 'nextIntInclusive'>;

export class ObjectiveAchievementPresentationState {
  readonly plan: ObjectiveAchievementPresentationPlan;

  private disposedValue = false;
  private elapsedActionSecondsValue = 0;
  private particleContainersRemovedValue = false;
  private particlesStartedValue = false;

  constructor(input: ObjectiveAchievementPlanInput) {
    this.plan = createObjectiveAchievementPresentationPlan(input);
  }

  get snapshot(): ObjectiveAchievementPresentationSnapshot {
    return this.createSnapshot();
  }

  updateAction(deltaSeconds: number): ObjectiveAchievementPresentationUpdate {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (this.disposedValue) {
      return Object.freeze({
        removeParticleContainersNow: false,
        snapshot: this.createSnapshot(),
        startParticlesNow: false,
      });
    }

    this.elapsedActionSecondsValue += deltaSeconds;
    let startParticlesNow = false;
    let removeParticleContainersNow = false;
    if (
      !this.particlesStartedValue
      && this.elapsedActionSecondsValue
        >= OBJECTIVE_ACHIEVEMENT_PARTICLE_START_SECONDS
    ) {
      this.particlesStartedValue = true;
      startParticlesNow = true;
    }
    if (
      !this.particleContainersRemovedValue
      && this.elapsedActionSecondsValue
        >= OBJECTIVE_ACHIEVEMENT_PARTICLE_REMOVE_SECONDS
    ) {
      this.particleContainersRemovedValue = true;
      removeParticleContainersNow = true;
    }
    return Object.freeze({
      removeParticleContainersNow,
      snapshot: this.createSnapshot(),
      startParticlesNow,
    });
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    return true;
  }

  private createSnapshot(): ObjectiveAchievementPresentationSnapshot {
    return Object.freeze({
      complete:
        this.elapsedActionSecondsValue >= OBJECTIVE_ACHIEVEMENT_COMPLETE_SECONDS,
      completedBannerWorldPosition: completedBannerPosition(
        this.elapsedActionSecondsValue,
        this.plan.completed,
      ),
      disposed: this.disposedValue,
      elapsedActionSeconds: this.elapsedActionSecondsValue,
      nextBannerWorldPosition: nextBannerPosition(
        this.elapsedActionSecondsValue,
        this.plan.next,
      ),
      particleContainersRemoved: this.particleContainersRemovedValue,
      particlesStarted: this.particlesStartedValue,
    });
  }
}

export function createObjectiveAchievementPresentationPlan(
  input: ObjectiveAchievementPlanInput,
): ObjectiveAchievementPresentationPlan {
  assertPlanInput(input);
  const centerX = input.viewportWidth * 0.5;
  const top = input.viewportHeight;
  const descriptionFontSize = 24 * input.viewportWidth / 400;
  const completedInitial = point(
    centerX,
    top + input.completedBannerHeight * 0.5,
  );
  const completedVisible = point(
    centerX,
    top - input.completedBannerHeight * 0.5,
  );
  const nextInitial = point(centerX, top + input.nextBannerHeight * 0.5);
  const nextVisible = point(centerX, top - input.nextBannerHeight * 0.5);
  return Object.freeze({
    completed: Object.freeze({
      description: input.completedDescription,
      descriptionFontSize,
      descriptionLocalPosition: point(
        input.completedBannerWidth * 0.5,
        input.completedBannerHeight * 0.5,
      ),
      initialWorldPosition: completedInitial,
      visibleWorldPosition: completedVisible,
    }),
    next: Object.freeze({
      description: input.nextDescription,
      descriptionFontSize,
      descriptionLocalPosition: point(
        input.nextBannerWidth * 0.5,
        input.nextBannerHeight * 0.6,
      ),
      initialWorldPosition: nextInitial,
      reward: input.nextReward,
      rewardFontSize: 20 * input.viewportWidth / 400,
      rewardLocalPosition: point(
        input.nextBannerWidth * 0.625,
        input.nextBannerHeight / 2.75,
      ),
      visibleWorldPosition: nextVisible,
    }),
    particleEmitters: Object.freeze([
      createEmitterPlan(0, 40, 'xmas-five', input.viewportWidth * 0.2, input.viewportHeight),
      createEmitterPlan(1, 50, 'xmas-four', input.viewportWidth * 0.5, input.viewportHeight),
      createEmitterPlan(2, 40, 'xmas-five', input.viewportWidth * 0.8, input.viewportHeight),
    ] as const),
    zOrder: OBJECTIVE_ACHIEVEMENT_Z_ORDER,
  });
}

export function createObjectiveAchievementParticleBurst(
  emitter: ObjectiveAchievementEmitterPlan,
  random: ObjectiveAchievementRandom,
): readonly ObjectiveAchievementParticlePlan[] {
  assertEmitterPlan(emitter);
  assertRandom(random);
  const particles: ObjectiveAchievementParticlePlan[] = [];
  for (let particleIndex = 0; particleIndex < emitter.particleCount; particleIndex += 1) {
    const durationHundredths = drawInclusive(
      random,
      PARTICLE_DURATION_MINIMUM_HUNDREDTHS,
      PARTICLE_DURATION_MAXIMUM_HUNDREDTHS,
    );
    const horizontalSign = normalizeSign(drawInclusive(random, -1, 1));
    const horizontalMagnitude = drawInclusive(
      random,
      PARTICLE_DISTANCE_MINIMUM,
      PARTICLE_DISTANCE_MAXIMUM,
    );
    const verticalSign = normalizeSign(drawInclusive(random, -1, 1));
    const verticalMagnitude = drawInclusive(
      random,
      PARTICLE_DISTANCE_MINIMUM,
      PARTICLE_DISTANCE_MAXIMUM,
    );
    particles.push(Object.freeze({
      deltaLocal: point(
        horizontalSign * horizontalMagnitude,
        verticalSign * verticalMagnitude,
      ),
      durationHundredths,
      durationSeconds: durationHundredths / HUNDREDTHS_PER_SECOND,
      emitterIndex: emitter.emitterIndex,
      horizontalMagnitude,
      horizontalSign,
      particleIndex,
      verticalMagnitude,
      verticalSign,
    }));
  }
  return Object.freeze(particles);
}

function completedBannerPosition(
  elapsed: number,
  plan: ObjectiveAchievementBannerPlan,
): ObjectiveAchievementPoint {
  if (elapsed < OBJECTIVE_ACHIEVEMENT_COMPLETED_INGRESS_SECONDS) {
    return interpolate(
      plan.initialWorldPosition,
      plan.visibleWorldPosition,
      elapsed / OBJECTIVE_ACHIEVEMENT_COMPLETED_INGRESS_SECONDS,
    );
  }
  const exitStart = OBJECTIVE_ACHIEVEMENT_COMPLETED_INGRESS_SECONDS
    + OBJECTIVE_ACHIEVEMENT_COMPLETED_HOLD_SECONDS;
  if (elapsed < exitStart) {
    return plan.visibleWorldPosition;
  }
  const exitEnd = exitStart + OBJECTIVE_ACHIEVEMENT_COMPLETED_EGRESS_SECONDS;
  if (elapsed < exitEnd) {
    return interpolate(
      plan.visibleWorldPosition,
      plan.initialWorldPosition,
      (elapsed - exitStart) / OBJECTIVE_ACHIEVEMENT_COMPLETED_EGRESS_SECONDS,
    );
  }
  return plan.initialWorldPosition;
}

function nextBannerPosition(
  elapsed: number,
  plan: ObjectiveAchievementBannerPlan,
): ObjectiveAchievementPoint {
  if (elapsed < OBJECTIVE_ACHIEVEMENT_NEXT_DELAY_SECONDS) {
    return plan.initialWorldPosition;
  }
  const ingressEnd = OBJECTIVE_ACHIEVEMENT_NEXT_DELAY_SECONDS
    + OBJECTIVE_ACHIEVEMENT_NEXT_INGRESS_SECONDS;
  if (elapsed < ingressEnd) {
    return interpolate(
      plan.initialWorldPosition,
      plan.visibleWorldPosition,
      (elapsed - OBJECTIVE_ACHIEVEMENT_NEXT_DELAY_SECONDS)
        / OBJECTIVE_ACHIEVEMENT_NEXT_INGRESS_SECONDS,
    );
  }
  const exitStart = ingressEnd + OBJECTIVE_ACHIEVEMENT_NEXT_HOLD_SECONDS;
  if (elapsed < exitStart) {
    return plan.visibleWorldPosition;
  }
  const exitEnd = exitStart + OBJECTIVE_ACHIEVEMENT_NEXT_EGRESS_SECONDS;
  if (elapsed < exitEnd) {
    return interpolate(
      plan.visibleWorldPosition,
      plan.initialWorldPosition,
      (elapsed - exitStart) / OBJECTIVE_ACHIEVEMENT_NEXT_EGRESS_SECONDS,
    );
  }
  return plan.initialWorldPosition;
}

function createEmitterPlan(
  emitterIndex: 0 | 1 | 2,
  particleCount: 40 | 50,
  texture: ObjectiveAchievementParticleTexture,
  x: number,
  viewportHeight: number,
): ObjectiveAchievementEmitterPlan {
  return Object.freeze({
    autoDeleteParticles: false,
    cleanupDelaySeconds: OBJECTIVE_ACHIEVEMENT_PARTICLE_CLEANUP_DELAY_SECONDS,
    colorFlags: Object.freeze([false, false] as const),
    emitterIndex,
    particleCount,
    removeAtSeconds: OBJECTIVE_ACHIEVEMENT_PARTICLE_REMOVE_SECONDS,
    startDelaySeconds: OBJECTIVE_ACHIEVEMENT_PARTICLE_START_SECONDS,
    texture,
    worldPosition: point(x, viewportHeight * 0.9625),
    zOrder: OBJECTIVE_ACHIEVEMENT_Z_ORDER,
  });
}

function assertPlanInput(input: ObjectiveAchievementPlanInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('input must be an object');
  }
  for (const [label, value] of [
    ['viewportWidth', input.viewportWidth],
    ['viewportHeight', input.viewportHeight],
    ['completedBannerWidth', input.completedBannerWidth],
    ['completedBannerHeight', input.completedBannerHeight],
    ['nextBannerWidth', input.nextBannerWidth],
    ['nextBannerHeight', input.nextBannerHeight],
  ] as const) {
    assertPositiveFinite(value, label);
  }
  for (const [label, value] of [
    ['completedDescription', input.completedDescription],
    ['nextDescription', input.nextDescription],
    ['nextReward', input.nextReward],
  ] as const) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError(`${label} must be a non-empty string`);
    }
  }
}

function assertEmitterPlan(emitter: ObjectiveAchievementEmitterPlan): void {
  if (emitter === null || typeof emitter !== 'object') {
    throw new TypeError('emitter must be an object');
  }
  if (
    emitter.emitterIndex < 0
    || emitter.emitterIndex > 2
    || (emitter.particleCount !== 40 && emitter.particleCount !== 50)
    || (emitter.texture !== 'xmas-five' && emitter.texture !== 'xmas-four')
    || emitter.startDelaySeconds !== OBJECTIVE_ACHIEVEMENT_PARTICLE_START_SECONDS
    || emitter.cleanupDelaySeconds
      !== OBJECTIVE_ACHIEVEMENT_PARTICLE_CLEANUP_DELAY_SECONDS
    || emitter.removeAtSeconds !== OBJECTIVE_ACHIEVEMENT_PARTICLE_REMOVE_SECONDS
    || emitter.zOrder !== OBJECTIVE_ACHIEVEMENT_Z_ORDER
    || emitter.autoDeleteParticles !== false
    || emitter.colorFlags[0] !== false
    || emitter.colorFlags[1] !== false
  ) {
    throw new RangeError('emitter does not match the recovered achievement contract');
  }
}

function assertRandom(random: ObjectiveAchievementRandom): void {
  if (
    random === null
    || typeof random !== 'object'
    || typeof random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive()');
  }
}

function drawInclusive(
  random: ObjectiveAchievementRandom,
  minimum: number,
  maximum: number,
): number {
  const value = random.nextIntInclusive(minimum, maximum);
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`random draw [${minimum},${maximum}] must be a safe integer`);
  }
  if (value < minimum || value > maximum) {
    throw new RangeError(`random draw ${value} is outside [${minimum},${maximum}]`);
  }
  return value;
}

function normalizeSign(value: number): -1 | 0 | 1 {
  if (value === -1 || value === 0 || value === 1) {
    return value;
  }
  throw new RangeError('particle sign must be -1, 0, or 1');
}

function interpolate(
  start: ObjectiveAchievementPoint,
  end: ObjectiveAchievementPoint,
  progress: number,
): ObjectiveAchievementPoint {
  return point(
    start.x + (end.x - start.x) * progress,
    start.y + (end.y - start.y) * progress,
  );
}

function point(x: number, y: number): ObjectiveAchievementPoint {
  assertFinite(x, 'point.x');
  assertFinite(y, 'point.y');
  return Object.freeze({ x, y });
}

function assertPositiveFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}
