import type { GameplayRandom } from './gameplay-random';

export const STANDARD_BOMB_EXPLOSION_BLANK_SECONDS = 0.25;
export const STANDARD_BOMB_EXPLOSION_FLASH_SECONDS = 1;
export const STANDARD_BOMB_EXPLOSION_TRIANGLE_SECONDS = 1.25;
export const STANDARD_BOMB_EXPLOSION_FLASH_START_SECONDS
  = STANDARD_BOMB_EXPLOSION_BLANK_SECONDS;
export const STANDARD_BOMB_EXPLOSION_TRIANGLE_START_SECONDS
  = STANDARD_BOMB_EXPLOSION_FLASH_START_SECONDS
    + STANDARD_BOMB_EXPLOSION_FLASH_SECONDS;
export const STANDARD_BOMB_EXPLOSION_FINISH_SECONDS
  = STANDARD_BOMB_EXPLOSION_TRIANGLE_START_SECONDS
    + STANDARD_BOMB_EXPLOSION_TRIANGLE_SECONDS;
export const STANDARD_BOMB_EXPLOSION_MAX_TRIANGLES = 100 as const;
export const STANDARD_BOMB_EXPLOSION_RANDOM_GATE_MAXIMUM = 6 as const;

const GAP_MINIMUM_WIDTH_FACTOR = Math.fround(0.1);
const GAP_MAXIMUM_WIDTH_FACTOR = Math.fround(0.2);
const RANDOM_GATE_SUCCESS = 0;

export type StandardBombExplosionPhase =
  | 'blank'
  | 'flash'
  | 'triangles'
  | 'finished';

export type StandardBombExplosionVisualState = 0 | 1 | 2 | null;
export type StandardBombExplosionEdge = 'right' | 'bottom' | 'left' | 'top';
export type StandardBombExplosionEdgeCursor = 1 | 2 | 3 | 4;

export interface StandardBombExplosionPoint {
  readonly x: number;
  readonly y: number;
}

export interface StandardBombExplosionVisibleRect {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

export type StandardBombExplosionRandom = Pick<
  GameplayRandom,
  'nextIntInclusive'
>;

export interface StandardBombExplosionStateInput {
  readonly bombWorldPosition: StandardBombExplosionPoint;
  /**
   * The process-owned gameplay stream. A standard explosion never creates or seeds a
   * private random source.
   */
  readonly random: StandardBombExplosionRandom;
  readonly visibleRect: StandardBombExplosionVisibleRect;
}

export interface StandardBombExplosionTriangle {
  readonly edge: StandardBombExplosionEdge;
  readonly firstEdgePoint: StandardBombExplosionPoint;
  readonly secondEdgePoint: StandardBombExplosionPoint;
}

export interface StandardBombExplosionStateSnapshot {
  readonly bombWorldPosition: StandardBombExplosionPoint;
  readonly edgeCursor: StandardBombExplosionEdgeCursor;
  readonly elapsedActionSeconds: number;
  readonly finished: boolean;
  readonly phase: StandardBombExplosionPhase;
  readonly triangles: readonly StandardBombExplosionTriangle[];
  readonly visibleRect: StandardBombExplosionVisibleRect;
  /** Recovered native state value; no visual state exists after detachment. */
  readonly visualState: StandardBombExplosionVisualState;
}

export interface StandardBombExplosionUpdateResult {
  readonly finishedNow: boolean;
  readonly generatedTriangleNow: boolean;
  readonly phase: StandardBombExplosionPhase;
}

const EDGE_BY_CURSOR: Readonly<Record<
  StandardBombExplosionEdgeCursor,
  StandardBombExplosionEdge
>> = Object.freeze({
  1: 'top',
  2: 'right',
  3: 'bottom',
  4: 'left',
});

/**
 * Pure recovered action clock and accumulated geometry for the shared standard Bomb.
 *
 * For deterministic oversized target updates, the action clock resolves before the one
 * scheduled-update draw. An update that lands on or inside the triangle phase therefore
 * performs one gate draw, while an oversized update that resolves directly to finish performs
 * none because finish unschedules updates. This convention does not claim the unknown native
 * frame/scheduler interleaving.
 */
export class StandardBombExplosionState {
  readonly bombWorldPosition: StandardBombExplosionPoint;
  readonly visibleRect: StandardBombExplosionVisibleRect;

  private edgeCursorValue: StandardBombExplosionEdgeCursor = 1;
  private elapsedActionSecondsValue = 0;
  private finishedValue = false;
  private readonly random: StandardBombExplosionRandom;
  private readonly trianglesValue: StandardBombExplosionTriangle[] = [];

  constructor(input: StandardBombExplosionStateInput) {
    assertInput(input);
    this.bombWorldPosition = frozenPoint(
      input.bombWorldPosition.x,
      input.bombWorldPosition.y,
    );
    this.visibleRect = Object.freeze({
      bottom: input.visibleRect.bottom,
      left: input.visibleRect.left,
      right: input.visibleRect.right,
      top: input.visibleRect.top,
    });
    this.random = input.random;
  }

  get finished(): boolean {
    return this.finishedValue;
  }

  get phase(): StandardBombExplosionPhase {
    return phaseAt(this.elapsedActionSecondsValue);
  }

  snapshot(): StandardBombExplosionStateSnapshot {
    const phase = this.phase;
    return Object.freeze({
      bombWorldPosition: this.bombWorldPosition,
      edgeCursor: this.edgeCursorValue,
      elapsedActionSeconds: this.elapsedActionSecondsValue,
      finished: this.finishedValue,
      phase,
      triangles: Object.freeze([...this.trianglesValue]),
      visibleRect: this.visibleRect,
      visualState: visualStateFor(phase),
    });
  }

  /**
   * Advances the recovered action clock and performs at most one scheduled-update RNG
   * transaction. Earlier triangles remain accumulated until the finish boundary.
   */
  updateAction(deltaSeconds: number): StandardBombExplosionUpdateResult {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (this.finishedValue) {
      return freezeUpdateResult(false, false, 'finished');
    }

    this.elapsedActionSecondsValue = advanceActionClock(
      this.elapsedActionSecondsValue,
      deltaSeconds,
    );
    const phase = this.phase;
    if (phase === 'finished') {
      this.finishedValue = true;
      return freezeUpdateResult(true, false, phase);
    }

    const generatedTriangleNow = phase === 'triangles'
      ? this.tryGenerateTriangle()
      : false;
    return freezeUpdateResult(false, generatedTriangleNow, phase);
  }

  private tryGenerateTriangle(): boolean {
    if (this.trianglesValue.length >= STANDARD_BOMB_EXPLOSION_MAX_TRIANGLES) {
      return false;
    }
    if (
      drawInclusive(
        this.random,
        RANDOM_GATE_SUCCESS,
        STANDARD_BOMB_EXPLOSION_RANDOM_GATE_MAXIMUM,
      ) !== RANDOM_GATE_SUCCESS
    ) {
      return false;
    }

    const width = Math.fround(this.visibleRect.right - this.visibleRect.left);
    const minimumGap = Math.trunc(Math.fround(width * GAP_MINIMUM_WIDTH_FACTOR));
    const maximumGap = Math.trunc(Math.fround(width * GAP_MAXIMUM_WIDTH_FACTOR));
    const gap = drawInclusive(this.random, minimumGap, maximumGap);
    const edgeCursor = nextEdgeCursor(this.edgeCursorValue);
    const triangle = createTriangle(
      edgeCursor,
      gap,
      this.visibleRect,
      this.random,
    );

    this.edgeCursorValue = edgeCursor;
    this.trianglesValue.push(triangle);
    return true;
  }
}

function createTriangle(
  edgeCursor: StandardBombExplosionEdgeCursor,
  gap: number,
  visibleRect: StandardBombExplosionVisibleRect,
  random: StandardBombExplosionRandom,
): StandardBombExplosionTriangle {
  const edge = EDGE_BY_CURSOR[edgeCursor];
  switch (edge) {
    case 'right': {
      const y = drawInclusive(
        random,
        Math.trunc(visibleRect.bottom),
        Math.trunc(visibleRect.top),
      );
      return frozenTriangle(
        edge,
        frozenPoint(visibleRect.right, y),
        frozenPoint(visibleRect.right, y + gap),
      );
    }
    case 'bottom': {
      const x = drawInclusive(
        random,
        Math.trunc(visibleRect.left),
        Math.trunc(visibleRect.right),
      );
      return frozenTriangle(
        edge,
        frozenPoint(x, visibleRect.bottom),
        frozenPoint(x + gap, visibleRect.bottom),
      );
    }
    case 'left': {
      const y = drawInclusive(
        random,
        Math.trunc(visibleRect.bottom),
        Math.trunc(visibleRect.top),
      );
      return frozenTriangle(
        edge,
        frozenPoint(visibleRect.left, y),
        frozenPoint(visibleRect.left, y + gap),
      );
    }
    case 'top': {
      const x = drawInclusive(
        random,
        Math.trunc(visibleRect.left),
        Math.trunc(visibleRect.right),
      );
      return frozenTriangle(
        edge,
        frozenPoint(x, visibleRect.top),
        frozenPoint(x + gap, visibleRect.top),
      );
    }
  }
}

function nextEdgeCursor(
  current: StandardBombExplosionEdgeCursor,
): StandardBombExplosionEdgeCursor {
  return current === 4 ? 1 : (current + 1) as StandardBombExplosionEdgeCursor;
}

function phaseAt(elapsedActionSeconds: number): StandardBombExplosionPhase {
  if (elapsedActionSeconds >= STANDARD_BOMB_EXPLOSION_FINISH_SECONDS) {
    return 'finished';
  }
  if (elapsedActionSeconds >= STANDARD_BOMB_EXPLOSION_TRIANGLE_START_SECONDS) {
    return 'triangles';
  }
  if (elapsedActionSeconds >= STANDARD_BOMB_EXPLOSION_FLASH_START_SECONDS) {
    return 'flash';
  }
  return 'blank';
}

function visualStateFor(
  phase: StandardBombExplosionPhase,
): StandardBombExplosionVisualState {
  switch (phase) {
    case 'blank':
      return 0;
    case 'flash':
      return 2;
    case 'triangles':
      return 1;
    case 'finished':
      return null;
  }
}

function advanceActionClock(elapsedSeconds: number, deltaSeconds: number): number {
  const advanced = Math.min(
    elapsedSeconds + deltaSeconds,
    STANDARD_BOMB_EXPLOSION_FINISH_SECONDS,
  );
  for (const boundary of [
    STANDARD_BOMB_EXPLOSION_FLASH_START_SECONDS,
    STANDARD_BOMB_EXPLOSION_TRIANGLE_START_SECONDS,
    STANDARD_BOMB_EXPLOSION_FINISH_SECONDS,
  ]) {
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(boundary)) * 8;
    if (Math.abs(advanced - boundary) <= tolerance) {
      return boundary;
    }
  }
  return advanced;
}

function drawInclusive(
  random: StandardBombExplosionRandom,
  minimumInclusive: number,
  maximumInclusive: number,
): number {
  const value = random.nextIntInclusive(minimumInclusive, maximumInclusive);
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(
      `nextIntInclusive(${minimumInclusive}, ${maximumInclusive}) must return a safe integer`,
    );
  }
  if (value < minimumInclusive || value > maximumInclusive) {
    throw new RangeError(
      `nextIntInclusive(${minimumInclusive}, ${maximumInclusive}) returned ${value} outside the inclusive range`,
    );
  }
  return value;
}

function assertInput(input: StandardBombExplosionStateInput): void {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('input must be an object');
  }
  assertPoint(input.bombWorldPosition, 'bombWorldPosition');
  assertVisibleRect(input.visibleRect);
  if (
    input.random === null
    || typeof input.random !== 'object'
    || typeof input.random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive(minimum, maximum)');
  }
}

function assertVisibleRect(rect: StandardBombExplosionVisibleRect): void {
  if (rect === null || typeof rect !== 'object' || Array.isArray(rect)) {
    throw new TypeError('visibleRect must be an object');
  }
  assertFinite(rect.left, 'visibleRect.left');
  assertFinite(rect.right, 'visibleRect.right');
  assertFinite(rect.bottom, 'visibleRect.bottom');
  assertFinite(rect.top, 'visibleRect.top');
  const width = Math.fround(rect.right - rect.left);
  const height = Math.fround(rect.top - rect.bottom);
  if (!Number.isFinite(width) || width <= 0) {
    throw new RangeError('visibleRect.right must be greater than visibleRect.left');
  }
  if (!Number.isFinite(height) || height <= 0) {
    throw new RangeError('visibleRect.top must be greater than visibleRect.bottom');
  }
}

function assertPoint(point: StandardBombExplosionPoint, label: string): void {
  if (point === null || typeof point !== 'object' || Array.isArray(point)) {
    throw new TypeError(`${label} must be an object`);
  }
  assertFinite(point.x, `${label}.x`);
  assertFinite(point.y, `${label}.y`);
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

function frozenPoint(x: number, y: number): StandardBombExplosionPoint {
  return Object.freeze({ x, y });
}

function frozenTriangle(
  edge: StandardBombExplosionEdge,
  firstEdgePoint: StandardBombExplosionPoint,
  secondEdgePoint: StandardBombExplosionPoint,
): StandardBombExplosionTriangle {
  return Object.freeze({ edge, firstEdgePoint, secondEdgePoint });
}

function freezeUpdateResult(
  finishedNow: boolean,
  generatedTriangleNow: boolean,
  phase: StandardBombExplosionPhase,
): StandardBombExplosionUpdateResult {
  return Object.freeze({ finishedNow, generatedTriangleNow, phase });
}
