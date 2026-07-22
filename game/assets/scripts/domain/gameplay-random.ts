/**
 * Injectable source for the non-negative integer draw used by recovered gameplay rules.
 *
 * This is a target-side port. The recovered runtime used process-global `lrand48`; callers
 * choose the source so tests and production can share the same modulo behavior without
 * claiming native sequence parity.
 */
export interface RawNonNegativeIntSource {
  nextRawNonNegativeInt(): number;
}

/** Recovered gameplay-facing random operations. */
export interface GameplayRandom {
  nextRawNonNegativeInt(): number;
  nextIntInclusive(min: number, max: number): number;
  nextDecile(): number;
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer`);
  }
}

function assertRawNonNegativeInt(value: number): void {
  assertSafeInteger(value, 'raw random value');
  if (value < 0) {
    throw new RangeError('raw random value must be non-negative');
  }
}

function inclusiveSpan(min: number, max: number): number {
  assertSafeInteger(min, 'min');
  assertSafeInteger(max, 'max');

  if (min > max) {
    throw new RangeError('min must be less than or equal to max');
  }

  const span = max - min + 1;
  if (!Number.isSafeInteger(span) || span <= 0) {
    throw new RangeError('inclusive range must fit in a positive safe integer span');
  }

  return span;
}

/**
 * Applies the recovered inclusive-modulo and ten-value decile formulas to an injected draw.
 * Modulo bias is intentionally preserved.
 */
export class ModuloGameplayRandom implements GameplayRandom {
  private readonly source: RawNonNegativeIntSource;

  constructor(source: RawNonNegativeIntSource) {
    if (
      source === null
      || typeof source !== 'object'
      || typeof source.nextRawNonNegativeInt !== 'function'
    ) {
      throw new TypeError('source must provide nextRawNonNegativeInt()');
    }

    this.source = source;
  }

  nextRawNonNegativeInt(): number {
    const raw = this.source.nextRawNonNegativeInt();
    assertRawNonNegativeInt(raw);
    return raw;
  }

  nextIntInclusive(min: number, max: number): number {
    const span = inclusiveSpan(min, max);
    return min + (this.nextRawNonNegativeInt() % span);
  }

  nextDecile(): number {
    return (this.nextRawNonNegativeInt() % 10) / 10;
  }
}

const MAX_UINT32 = 0xffff_ffff;
const MULBERRY_INCREMENT = 0x6d2b_79f5;

/**
 * Deterministic target-side raw source for replayable sessions.
 *
 * This uses a documented Mulberry32-style transition. It is not `lrand48`, does not reproduce
 * the native Android libc stream, and says nothing about the native stream's other consumers.
 */
export class SeededTargetRawSource implements RawNonNegativeIntSource {
  readonly initialSeed: number;
  private state: number;

  constructor(seed: number) {
    assertSafeInteger(seed, 'seed');
    if (seed < 0 || seed > MAX_UINT32) {
      throw new RangeError('seed must be an unsigned 32-bit integer');
    }

    this.initialSeed = seed;
    this.state = seed;
  }

  nextRawNonNegativeInt(): number {
    this.state = (this.state + MULBERRY_INCREMENT) >>> 0;

    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  }

  /** Target replay diagnostic; this state has no native `lrand48` interpretation. */
  getState(): number {
    return this.state;
  }
}
