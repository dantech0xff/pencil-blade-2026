/** Recovered four-slot touch tracking, independent of Creator input events. */

export interface BladePoint {
  readonly x: number;
  readonly y: number;
}

export interface BladeSegment {
  readonly current: BladePoint;
  readonly previous: BladePoint;
  readonly slot: number;
  readonly touchId: number;
}

export interface BladeMoveResult {
  readonly segment: BladeSegment;
  readonly shouldPlaySwish: boolean;
}

export interface BladeTrackSnapshot {
  readonly current: BladePoint;
  readonly previous: BladePoint;
  readonly slot: number;
  readonly touchId: number;
}

interface MutableBladeTrack {
  current: BladePoint;
  previous: BladePoint;
  touchId: number;
}

const UNASSIGNED_TOUCH_ID = -1;
const BLADE_COUNT = 4;
const SWISH_WIDTH_RATIO = Math.fround(0.0825);
const ZERO_POINT: BladePoint = Object.freeze({ x: 0, y: 0 });

export class BladeTracks {
  private readonly tracks: MutableBladeTrack[];

  constructor() {
    this.tracks = Array.from({ length: BLADE_COUNT }, () => ({
      current: ZERO_POINT,
      previous: ZERO_POINT,
      touchId: UNASSIGNED_TOUCH_ID,
    }));
  }

  begin(touchId: number, point: BladePoint): number | null {
    assertTouchId(touchId);
    const next = copyPoint(point);
    const slot = this.tracks.findIndex((track) => track.touchId === UNASSIGNED_TOUCH_ID);
    if (slot < 0) {
      return null;
    }
    const track = this.tracks[slot];
    if (!track) {
      throw new Error('Recovered blade slot is missing');
    }
    track.touchId = touchId;
    track.previous = next;
    track.current = next;
    return slot;
  }

  move(touchId: number, point: BladePoint, viewportWidth: number): BladeMoveResult | null {
    assertTouchId(touchId);
    assertPositive(viewportWidth, 'viewportWidth');
    const slot = this.tracks.findIndex((track) => track.touchId === touchId);
    if (slot < 0) {
      return null;
    }
    const track = this.tracks[slot];
    if (!track) {
      throw new Error('Recovered blade slot is missing');
    }
    track.previous = track.current;
    track.current = copyPoint(point);
    const segment = toSegment(track, slot);
    const threshold = Math.fround(viewportWidth * SWISH_WIDTH_RATIO);
    return Object.freeze({
      segment,
      shouldPlaySwish: segmentLength(segment) > threshold,
    });
  }

  end(touchId: number): number | null {
    assertTouchId(touchId);
    const slot = this.tracks.findIndex((track) => track.touchId === touchId);
    if (slot < 0) {
      return null;
    }
    const track = this.tracks[slot];
    if (!track) {
      throw new Error('Recovered blade slot is missing');
    }
    track.touchId = UNASSIGNED_TOUCH_ID;
    track.previous = ZERO_POINT;
    track.current = ZERO_POINT;
    return slot;
  }

  segmentsForPostPhysicsUpdate(cutEnabled: boolean): readonly BladeSegment[] {
    if (!cutEnabled) {
      return Object.freeze([]);
    }
    const segments: BladeSegment[] = [];
    this.tracks.forEach((track, slot) => {
      if (track.touchId === UNASSIGNED_TOUCH_ID) {
        return;
      }
      const segment = toSegment(track, slot);
      if (segmentLength(segment) > 0) {
        segments.push(segment);
      }
    });
    return Object.freeze(segments);
  }

  snapshot(): readonly BladeTrackSnapshot[] {
    return Object.freeze(this.tracks.map((track, slot) => Object.freeze({
      current: copyPoint(track.current),
      previous: copyPoint(track.previous),
      slot,
      touchId: track.touchId,
    })));
  }
}

function toSegment(track: MutableBladeTrack, slot: number): BladeSegment {
  return Object.freeze({
    current: copyPoint(track.current),
    previous: copyPoint(track.previous),
    slot,
    touchId: track.touchId,
  });
}

function segmentLength(segment: BladeSegment): number {
  return Math.hypot(
    segment.current.x - segment.previous.x,
    segment.current.y - segment.previous.y,
  );
}

function copyPoint(point: BladePoint): BladePoint {
  assertFinite(point.x, 'point.x');
  assertFinite(point.y, 'point.y');
  return Object.freeze({ x: point.x, y: point.y });
}

function assertTouchId(touchId: number): void {
  if (!Number.isSafeInteger(touchId) || touchId === UNASSIGNED_TOUCH_ID) {
    throw new RangeError('touchId must be a safe integer other than -1');
  }
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
