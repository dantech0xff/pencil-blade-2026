import {
  buildBidirectionalRayPlan,
  type BidirectionalRayPlan,
} from '../domain/classic-cut-query';
import type { BirdBladeRaySegment } from '../domain/bird-blade-state';

export interface BirdBladeRaySourcePort {
  acknowledgeCachedRay(): boolean;
  peekCachedRaySegment(): BirdBladeRaySegment | null;
}

export interface BirdBladeRaycastPort<RayHit> {
  raycastAll(
    startWorld: Readonly<{ x: number; y: number }>,
    endWorld: Readonly<{ x: number; y: number }>,
  ): readonly RayHit[];
}

export interface BirdBladeRayAdapterInput<RayHit> {
  readonly raySource: BirdBladeRaySourcePort;
  readonly raycast: BirdBladeRaycastPort<RayHit>;
  readonly viewportWidth: number;
}

export interface BirdBladeRaycastBatch<RayHit> {
  readonly forwardHits: readonly RayHit[];
  readonly plan: BidirectionalRayPlan | null;
  readonly reverseHits: readonly RayHit[];
  readonly sourceSegment: BirdBladeRaySegment;
}

export type BirdBladeRayBatchAcknowledgement<RayHit> = (
  batch: BirdBladeRaycastBatch<RayHit>,
) => boolean;

/**
 * Converts the one BirdBlade cache into the shared ray-plan boundary.
 *
 * Entity lookup, combo checks, and cut dispatch remain with the gameplay registry. The
 * source cache is cleared only when that caller confirms the complete batch succeeded.
 */
export class BirdBladeRayAdapter<RayHit = unknown> {
  private readonly raySource: BirdBladeRaySourcePort;
  private readonly raycast: BirdBladeRaycastPort<RayHit>;
  private readonly viewportWidth: number;

  private constructor(input: BirdBladeRayAdapterInput<RayHit>) {
    this.raySource = input.raySource;
    this.raycast = input.raycast;
    this.viewportWidth = input.viewportWidth;
  }

  static create<RayHit = unknown>(
    input: BirdBladeRayAdapterInput<RayHit>,
  ): BirdBladeRayAdapter<RayHit> {
    assertInput(input);
    return new BirdBladeRayAdapter(input);
  }

  /**
   * Processes at most one cached segment. Returns true only when the caller accepted the
   * batch and the source acknowledged it.
   */
  processOneCachedRay(
    acknowledgeBatch: BirdBladeRayBatchAcknowledgement<RayHit>,
  ): boolean {
    if (typeof acknowledgeBatch !== 'function') {
      throw new TypeError('acknowledgeBatch must be a function');
    }

    const sourceSegment = copySourceSegment(
      this.raySource.peekCachedRaySegment(),
    );
    if (sourceSegment === null) {
      return false;
    }

    const plan = buildBidirectionalRayPlan({
      start: sourceSegment.previous,
      end: sourceSegment.current,
    }, this.viewportWidth);
    const forwardHits = plan === null
      ? emptyHits<RayHit>()
      : copyHits(
        this.raycast.raycastAll(plan.forward.start, plan.forward.end),
        'forward',
      );
    const reverseHits = plan === null
      ? emptyHits<RayHit>()
      : copyHits(
        this.raycast.raycastAll(plan.reverse.start, plan.reverse.end),
        'reverse',
      );
    const batch: BirdBladeRaycastBatch<RayHit> = Object.freeze({
      forwardHits,
      plan,
      reverseHits,
      sourceSegment,
    });

    const accepted = acknowledgeBatch(batch);
    if (typeof accepted !== 'boolean') {
      throw new TypeError('acknowledgeBatch must return a boolean');
    }
    if (!accepted) {
      return false;
    }

    const acknowledged = this.raySource.acknowledgeCachedRay();
    if (typeof acknowledged !== 'boolean') {
      throw new TypeError('raySource.acknowledgeCachedRay() must return a boolean');
    }
    return acknowledged;
  }
}

function assertInput<RayHit>(
  input: BirdBladeRayAdapterInput<RayHit>,
): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('input must be an object');
  }
  assertFunctions(
    input.raySource,
    ['acknowledgeCachedRay', 'peekCachedRaySegment'],
    'raySource',
  );
  assertFunctions(input.raycast, ['raycastAll'], 'raycast');
  if (!Number.isFinite(input.viewportWidth) || input.viewportWidth <= 0) {
    throw new RangeError('viewportWidth must be positive and finite');
  }
}

function assertFunctions(
  port: unknown,
  functionNames: readonly string[],
  label: string,
): void {
  if (port === null || typeof port !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
  for (const functionName of functionNames) {
    if (
      !(functionName in port)
      || typeof (port as Record<string, unknown>)[functionName] !== 'function'
    ) {
      throw new TypeError(`${label}.${functionName} must be a function`);
    }
  }
}

function copySourceSegment(
  segment: BirdBladeRaySegment | null,
): BirdBladeRaySegment | null {
  if (segment === null) {
    return null;
  }
  if (typeof segment !== 'object') {
    throw new TypeError('raySource.peekCachedRaySegment() must return a segment or null');
  }
  return Object.freeze({
    current: copyPoint(segment.current, 'sourceSegment.current'),
    previous: copyPoint(segment.previous, 'sourceSegment.previous'),
  });
}

function copyPoint(
  point: Readonly<{ x: number; y: number }>,
  label: string,
): Readonly<{ x: number; y: number }> {
  if (point === null || typeof point !== 'object') {
    throw new TypeError(`${label} must be a point`);
  }
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError(`${label} must contain finite coordinates`);
  }
  return Object.freeze({ x: point.x, y: point.y });
}

function copyHits<RayHit>(
  hits: readonly RayHit[],
  direction: 'forward' | 'reverse',
): readonly RayHit[] {
  if (!Array.isArray(hits)) {
    throw new TypeError(`${direction} raycastAll() must return an array`);
  }
  return Object.freeze([...hits]);
}

function emptyHits<RayHit>(): readonly RayHit[] {
  return Object.freeze([] as RayHit[]);
}
