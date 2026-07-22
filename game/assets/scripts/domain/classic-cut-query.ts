/** Pure blade ray planning and cut-dispatch ordering. */

export interface CutPoint {
  readonly x: number;
  readonly y: number;
}

export interface CutSegment {
  readonly end: CutPoint;
  readonly start: CutPoint;
}

export interface BidirectionalRayPlan {
  readonly forward: CutSegment;
  readonly original: CutSegment;
  readonly reverse: CutSegment;
}

export interface CuttableSnapshot {
  readonly bodyWorldPosition: CutPoint;
  readonly cutDisabled: boolean;
  readonly id: string;
  readonly isFruit: boolean;
  readonly nodeTag: number;
}

export interface CutQueryHit {
  readonly target: CuttableSnapshot | null;
}

export type CutDispatchCommand =
  | Readonly<{ type: 'combo-check'; position: CutPoint; targetId: string }>
  | Readonly<{ type: 'cut'; segment: CutSegment; targetId: string }>;

const EXCLUDED_NODE_TAG = 1437;
const RAY_EXTENSION_DIVISOR = 16;

export function buildBidirectionalRayPlan(
  original: CutSegment,
  viewportWidth: number,
): BidirectionalRayPlan | null {
  const segment = copySegment(original);
  assertPositive(viewportWidth, 'viewportWidth');
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return null;
  }

  const extraWorld = Math.trunc(viewportWidth / RAY_EXTENSION_DIVISOR);
  const unitX = dx / length;
  const unitY = dy / length;
  const extendedStart = Object.freeze({
    x: segment.start.x - unitX * extraWorld,
    y: segment.start.y - unitY * extraWorld,
  });
  const extendedEnd = Object.freeze({
    x: segment.end.x + unitX * extraWorld,
    y: segment.end.y + unitY * extraWorld,
  });
  const forward = Object.freeze({ start: extendedStart, end: extendedEnd });
  const reverse = Object.freeze({ start: extendedEnd, end: extendedStart });
  return Object.freeze({ forward, original: segment, reverse });
}

/** Forward hits then reverse hits; no sorting or value-level deduplication. */
export function createCutDispatchCommands(
  plan: BidirectionalRayPlan,
  forwardHits: readonly CutQueryHit[],
  reverseHits: readonly CutQueryHit[],
): readonly CutDispatchCommand[] {
  const commands: CutDispatchCommand[] = [];
  const hits = [...forwardHits, ...reverseHits];
  for (const hit of hits) {
    const target = hit.target;
    if (target === null) {
      continue;
    }
    if (target.nodeTag === EXCLUDED_NODE_TAG) {
      continue;
    }
    if (target.cutDisabled) {
      continue;
    }
    if (target.isFruit) {
      commands.push(Object.freeze({
        type: 'combo-check',
        position: copyPoint(target.bodyWorldPosition),
        targetId: target.id,
      }));
    }
    commands.push(Object.freeze({
      type: 'cut',
      segment: copySegment(plan.original),
      targetId: target.id,
    }));
  }
  return Object.freeze(commands);
}

function copySegment(segment: CutSegment): CutSegment {
  return Object.freeze({
    end: copyPoint(segment.end),
    start: copyPoint(segment.start),
  });
}

function copyPoint(point: CutPoint): CutPoint {
  assertFinite(point.x, 'point.x');
  assertFinite(point.y, 'point.y');
  return Object.freeze({ x: point.x, y: point.y });
}

function assertPositive(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}
