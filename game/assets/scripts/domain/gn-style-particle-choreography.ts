import {
  GN_STYLE_GENERATED_PARTICLE_TUPLES,
  GN_STYLE_PARTICLE_FAMILY_PATHS,
  type GnStyleGeneratedParticleTuple,
  type GnStyleParticleFamily,
  type GnStyleParticlePointId,
// Node's direct TypeScript runner treats ".generated" as an extension and requires the
// explicit source suffix. Creator resolves the same source; TS5097 is only its no-emit policy.
// @ts-expect-error Explicit TypeScript suffix is required by the repository's Node test runner.
} from './gn-style-particle-choreography.generated.ts';

export const GN_STYLE_PARTICLE_CHOREOGRAPHY_CALL_COUNT = 439 as const;
export const GN_STYLE_PARTICLE_CANONICAL_CSV_SHA256
  = '6c8dd814fb776e15507c2f42081b315bd410ea5b9a9156a4726c186504507c97' as const;
export const GN_STYLE_PARTICLE_EMITTER_Z_ORDER = 1 as const;
export const GN_STYLE_RESULT_REPLACEMENT_GAMEPLAY_SECONDS = 153;

const BASELINE_FRAME_WIDTH = 480;
const FIXED_COUNT_SCALE_MINIMUM_WIDTH = 720;
const FIXED_COUNT_SCALE_MAXIMUM_WIDTH = 1136;
const FIXED_COUNT_SCALE = Math.fround(0.45);
const AREA_COUNT_SCALE_FACTOR = 2 ** -20;
const HUNDREDTHS_PER_SECOND = 100;

const EXPECTED_FAMILY_COUNTS: Readonly<Record<GnStyleParticleFamily, number>>
  = Object.freeze({
    F5: 223,
    F4: 128,
    ST: 32,
    VN: 30,
    HX: 17,
    CI: 9,
  });

export interface GnStyleParticleViewport {
  readonly height: number;
  readonly width: number;
}

export interface GnStyleParticlePoint {
  readonly x: number;
  readonly y: number;
}

export interface GnStyleParticleRawChoreographyRow {
  readonly ordinal: number;
  readonly minimumDistance: number;
  readonly maximumDistance: number;
  readonly minimumDurationBits: number;
  readonly maximumDurationBits: number;
  readonly particleCount: number;
  readonly startDelayBits: number;
  readonly pointId: GnStyleParticlePointId;
  readonly pointXFactorBits: number;
  readonly pointYFactorBits: number;
  readonly family: GnStyleParticleFamily;
  readonly canonicalPath: string;
  readonly flagA: boolean;
  readonly flagB: boolean;
}

export interface GnStyleParticleEmitterPlan {
  readonly ordinal: number;
  readonly minimumTravelMagnitude: number;
  readonly maximumTravelMagnitude: number;
  readonly minimumDurationHundredths: number;
  readonly maximumDurationHundredths: number;
  readonly particleCount: number;
  readonly startDelaySeconds: number;
  readonly cleanupDelaySeconds: number;
  readonly removeAtSeconds: number;
  readonly emitterWorldPosition: GnStyleParticlePoint;
  readonly pointId: GnStyleParticlePointId;
  readonly family: GnStyleParticleFamily;
  readonly textureLogicalPath: string;
  /** Opaque recovered flags. Their stripped native semantic names remain unknown. */
  readonly flagA: boolean;
  readonly flagB: boolean;
  readonly zOrder: 1;
}

export const GN_STYLE_PARTICLE_CHOREOGRAPHY: readonly GnStyleParticleRawChoreographyRow[]
  = expandAndValidateGeneratedRows();

/**
 * Expands the exact source-ordered table for one native-size viewport.
 *
 * Frame values, scale operations, point multiplication, and integer conversions preserve the
 * recovered float32 boundaries. Construction consumes no random values.
 */
export function createGnStyleParticleEmitterPlans(
  viewport: GnStyleParticleViewport,
): readonly GnStyleParticleEmitterPlan[] {
  const { frameWidth, frameHeight } = normalizedFrame(viewport);
  const widthScale = Math.fround(frameWidth / BASELINE_FRAME_WIDTH);
  const countScale = createCountScale(frameWidth, frameHeight);

  const plans = GN_STYLE_PARTICLE_CHOREOGRAPHY.map((row) => {
    const minimumTravelMagnitude = truncFloat32Product(row.minimumDistance, widthScale);
    const maximumTravelMagnitude = truncFloat32Product(row.maximumDistance, widthScale);
    const particleCount = truncFloat32Product(row.particleCount, countScale);
    assertNonNegativeSafeInteger(
      minimumTravelMagnitude,
      `row ${row.ordinal} minimumTravelMagnitude`,
    );
    assertNonNegativeSafeInteger(
      maximumTravelMagnitude,
      `row ${row.ordinal} maximumTravelMagnitude`,
    );
    assertNonNegativeSafeInteger(particleCount, `row ${row.ordinal} particleCount`);
    if (minimumTravelMagnitude > maximumTravelMagnitude) {
      throw new RangeError(`row ${row.ordinal} scaled travel bounds are reversed`);
    }

    const minimumDurationHundredths = Math.trunc(float32FromBits(row.minimumDurationBits));
    const maximumDurationHundredths = Math.trunc(float32FromBits(row.maximumDurationBits));
    const startDelaySeconds = float32FromBits(row.startDelayBits);
    const cleanupDelaySeconds = Math.fround(
      Math.fround(2 * maximumDurationHundredths)
      / Math.fround(HUNDREDTHS_PER_SECOND),
    );
    const removeAtSeconds = Math.fround(
      startDelaySeconds + cleanupDelaySeconds,
    );

    return Object.freeze({
      ordinal: row.ordinal,
      minimumTravelMagnitude,
      maximumTravelMagnitude,
      minimumDurationHundredths,
      maximumDurationHundredths,
      particleCount,
      startDelaySeconds,
      cleanupDelaySeconds,
      removeAtSeconds,
      emitterWorldPosition: frozenPoint(
        multiplyFrameFactor(frameWidth, row.pointXFactorBits),
        multiplyFrameFactor(frameHeight, row.pointYFactorBits),
      ),
      pointId: row.pointId,
      family: row.family,
      textureLogicalPath: row.canonicalPath,
      flagA: row.flagA,
      flagB: row.flagB,
      zOrder: GN_STYLE_PARTICLE_EMITTER_Z_ORDER,
    });
  });

  return Object.freeze(plans);
}

/** Returns the source ordinals whose parent roots have not reached nominal self-cleanup. */
export function gnStyleParticleRootOrdinalsAliveAt(
  plans: readonly GnStyleParticleEmitterPlan[],
  gameplaySeconds: number,
): readonly number[] {
  assertEmitterPlans(plans);
  assertNonNegativeFinite(gameplaySeconds, 'gameplaySeconds');
  return Object.freeze(
    plans
      .filter((plan) => gameplaySeconds < plan.removeAtSeconds)
      .map((plan) => plan.ordinal),
  );
}

function expandAndValidateGeneratedRows(): readonly GnStyleParticleRawChoreographyRow[] {
  if (GN_STYLE_GENERATED_PARTICLE_TUPLES.length !== GN_STYLE_PARTICLE_CHOREOGRAPHY_CALL_COUNT) {
    throw new Error(
      `GN Style generated choreography must contain exactly ${GN_STYLE_PARTICLE_CHOREOGRAPHY_CALL_COUNT} rows`,
    );
  }

  const familyCounts: Partial<Record<GnStyleParticleFamily, number>> = {};
  const flagPairCounts = new Map<string, number>();
  const seenPointIds = new Set<string>();
  let reusableAnchorCallCount = 0;
  let directConstructionCallCount = 0;
  let delayDecreaseCount = 0;
  let minimumDelay = Number.POSITIVE_INFINITY;
  let maximumDelay = Number.NEGATIVE_INFINITY;
  let previousDelay = Number.NEGATIVE_INFINITY;

  const rows = GN_STYLE_GENERATED_PARTICLE_TUPLES.map((
    tuple: GnStyleGeneratedParticleTuple,
    index: number,
  ) => {
    if (!Array.isArray(tuple) || tuple.length !== 12) {
      throw new TypeError(`generated row ${index + 1} must be a 12-value tuple`);
    }
    const [
      minimumDistance,
      maximumDistance,
      minimumDurationBits,
      maximumDurationBits,
      particleCount,
      startDelayBits,
      pointId,
      pointXFactorBits,
      pointYFactorBits,
      family,
      rawFlagA,
      rawFlagB,
    ] = tuple;
    const ordinal = index + 1;

    assertNonNegativeSafeInteger(minimumDistance, `row ${ordinal} minimumDistance`);
    assertNonNegativeSafeInteger(maximumDistance, `row ${ordinal} maximumDistance`);
    assertNonNegativeSafeInteger(particleCount, `row ${ordinal} particleCount`);
    if (minimumDistance > maximumDistance) {
      throw new RangeError(`row ${ordinal} raw travel bounds are reversed`);
    }
    assertUint32(minimumDurationBits, `row ${ordinal} minimumDurationBits`);
    assertUint32(maximumDurationBits, `row ${ordinal} maximumDurationBits`);
    assertUint32(startDelayBits, `row ${ordinal} startDelayBits`);
    assertUint32(pointXFactorBits, `row ${ordinal} pointXFactorBits`);
    assertUint32(pointYFactorBits, `row ${ordinal} pointYFactorBits`);

    const minimumDuration = float32FromBits(minimumDurationBits);
    const maximumDuration = float32FromBits(maximumDurationBits);
    const delay = float32FromBits(startDelayBits);
    const pointXFactor = float32FromBits(pointXFactorBits);
    const pointYFactor = float32FromBits(pointYFactorBits);
    if (
      minimumDuration < 0
      || maximumDuration < minimumDuration
      || delay < 0
      || pointXFactor < 0
      || pointXFactor > 1
      || pointYFactor < 0
      || pointYFactor > 1
    ) {
      throw new RangeError(`generated row ${ordinal} contains invalid decoded float bounds`);
    }

    if (typeof pointId !== 'string' || !/^[AD]\d{2}$/.test(pointId)) {
      throw new TypeError(`generated row ${ordinal} has invalid point ID`);
    }
    const pointOrdinal = Number.parseInt(pointId.slice(1), 10);
    if (
      (pointId.startsWith('A') && (pointOrdinal < 1 || pointOrdinal > 15))
      || (pointId.startsWith('D') && (pointOrdinal < 1 || pointOrdinal > 16))
    ) {
      throw new RangeError(`generated row ${ordinal} point ID is outside the recovered set`);
    }
    seenPointIds.add(pointId);
    if (pointId.startsWith('A')) {
      reusableAnchorCallCount += 1;
    } else {
      directConstructionCallCount += 1;
    }

    if (!Object.prototype.hasOwnProperty.call(GN_STYLE_PARTICLE_FAMILY_PATHS, family)) {
      throw new RangeError(`generated row ${ordinal} has unknown particle family`);
    }
    if (
      (rawFlagA !== 0 && rawFlagA !== 1)
      || (rawFlagB !== 0 && rawFlagB !== 1)
      || (rawFlagA === 1 && rawFlagB === 1)
    ) {
      throw new RangeError(`generated row ${ordinal} has invalid recovered flags`);
    }

    familyCounts[family] = (familyCounts[family] ?? 0) + 1;
    const flagKey = `${rawFlagA},${rawFlagB}`;
    flagPairCounts.set(flagKey, (flagPairCounts.get(flagKey) ?? 0) + 1);
    if (delay < previousDelay) {
      delayDecreaseCount += 1;
    }
    previousDelay = delay;
    minimumDelay = Math.min(minimumDelay, delay);
    maximumDelay = Math.max(maximumDelay, delay);

    return Object.freeze({
      ordinal,
      minimumDistance,
      maximumDistance,
      minimumDurationBits,
      maximumDurationBits,
      particleCount,
      startDelayBits,
      pointId,
      pointXFactorBits,
      pointYFactorBits,
      family,
      canonicalPath: GN_STYLE_PARTICLE_FAMILY_PATHS[family],
      flagA: rawFlagA === 1,
      flagB: rawFlagB === 1,
    });
  });

  for (const family of Object.keys(EXPECTED_FAMILY_COUNTS) as GnStyleParticleFamily[]) {
    if (familyCounts[family] !== EXPECTED_FAMILY_COUNTS[family]) {
      throw new Error(`generated ${family} family count does not match recovered evidence`);
    }
  }
  if (
    flagPairCounts.size !== 3
    || flagPairCounts.get('0,0') !== 341
    || flagPairCounts.get('1,0') !== 64
    || flagPairCounts.get('0,1') !== 34
  ) {
    throw new Error('generated flag-pair totals do not match recovered evidence');
  }
  if (
    reusableAnchorCallCount !== 423
    || directConstructionCallCount !== 16
    || seenPointIds.size !== 31
  ) {
    throw new Error('generated point identities do not match recovered evidence');
  }
  if (delayDecreaseCount !== 25 || minimumDelay !== 3 || maximumDelay !== 146.5) {
    throw new Error('generated source-order delay invariants do not match recovered evidence');
  }

  return Object.freeze(rows);
}

function normalizedFrame(
  viewport: GnStyleParticleViewport,
): { readonly frameWidth: number; readonly frameHeight: number } {
  if (viewport === null || typeof viewport !== 'object') {
    throw new TypeError('viewport must be an object');
  }
  assertPositiveFinite(viewport.width, 'viewport.width');
  assertPositiveFinite(viewport.height, 'viewport.height');
  const frameWidth = Math.fround(viewport.width);
  const frameHeight = Math.fround(viewport.height);
  assertPositiveFinite(frameWidth, 'float32 viewport.width');
  assertPositiveFinite(frameHeight, 'float32 viewport.height');
  return Object.freeze({ frameWidth, frameHeight });
}

function createCountScale(frameWidth: number, frameHeight: number): number {
  if (
    frameWidth >= FIXED_COUNT_SCALE_MINIMUM_WIDTH
    && frameWidth <= FIXED_COUNT_SCALE_MAXIMUM_WIDTH
  ) {
    return FIXED_COUNT_SCALE;
  }
  const area = Math.fround(frameWidth * frameHeight);
  const areaScale = Math.fround(area * AREA_COUNT_SCALE_FACTOR);
  return Math.min(areaScale, Math.fround(1));
}

function truncFloat32Product(left: number, right: number): number {
  return Math.trunc(Math.fround(left * right));
}

function multiplyFrameFactor(frameValue: number, factorBits: number): number {
  return Math.fround(frameValue * float32FromBits(factorBits));
}

function float32FromBits(bits: number): number {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, bits, true);
  const value = view.getFloat32(0, true);
  if (!Number.isFinite(value)) {
    throw new RangeError(`float32 word 0x${bits.toString(16)} must decode to a finite value`);
  }
  return value;
}

function assertEmitterPlans(plans: readonly GnStyleParticleEmitterPlan[]): void {
  if (!Array.isArray(plans)) {
    throw new TypeError('plans must be an array');
  }
  let previousOrdinal = 0;
  for (const plan of plans) {
    if (plan === null || typeof plan !== 'object') {
      throw new TypeError('every plan must be an object');
    }
    if (!Number.isSafeInteger(plan.ordinal) || plan.ordinal <= previousOrdinal) {
      throw new RangeError('plan ordinals must be positive and strictly increasing');
    }
    assertNonNegativeFinite(plan.removeAtSeconds, `plan ${plan.ordinal} removeAtSeconds`);
    previousOrdinal = plan.ordinal;
  }
}

function assertUint32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new TypeError(`${label} must be an unsigned 32-bit integer`);
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer`);
  }
  if (value < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
  if (value <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
  if (value < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
}

function frozenPoint(x: number, y: number): GnStyleParticlePoint {
  return Object.freeze({ x, y });
}
