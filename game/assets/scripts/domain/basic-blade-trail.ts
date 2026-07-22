import type { BladePoint } from './blade-tracks';

export const BASIC_BLADE_SLOT_COUNT = 4;
export const BASIC_BLADE_POINT_LIMIT = 10;
export const BASIC_BLADE_LEGACY_VERTEX_STRIDE_BYTES = 20;
export const BASIC_BLADE_LEGACY_VERTEX_CAPACITY_BYTES = 500;

export type BasicBladeTrailState = 0 | 4;

export interface BasicBladeUv {
  readonly u: number;
  readonly v: number;
}

export interface BasicBladeVertex {
  readonly alphaUv: BasicBladeUv;
  readonly position: BladePoint;
}

export interface BasicBladeGeometry {
  /** Width used when this cached geometry was rebuilt. */
  readonly geometryWidth: number;
  readonly legacyVertexStrideBytes: 20;
  readonly primitive: 'triangle-strip';
  readonly vertices: readonly BasicBladeVertex[];
}

export interface BasicBladeSlotSnapshot {
  readonly claimed: boolean;
  readonly currentWidth: number;
  readonly geometry: BasicBladeGeometry | null;
  readonly points: readonly BladePoint[];
  readonly slot: number;
  readonly state: BasicBladeTrailState;
}

interface MutableBasicBladeSlot {
  claimed: boolean;
  currentWidth: number;
  geometry: BasicBladeGeometry | null;
  points: BladePoint[];
  state: BasicBladeTrailState;
}

const ACTIVE_STATE: BasicBladeTrailState = 0;
const DISPOSING_STATE: BasicBladeTrailState = 4;
const WIDTH_REFERENCE = Math.fround(480);
const WIDTH_SLOPE = Math.fround(0.0025);
const WIDTH_OFFSET = Math.fround(3.5);
const DISPOSAL_WIDTH_DIVISOR = Math.fround(1.1);

/** Pure four-slot model for the recovered default BasicBlade trail. */
export class BasicBladeTrailModel {
  readonly baseWidth: number;

  private readonly slots: MutableBasicBladeSlot[];

  constructor(viewportWidth: number) {
    this.baseWidth = getBasicBladeDefaultWidth(viewportWidth);
    this.slots = Array.from({ length: BASIC_BLADE_SLOT_COUNT }, () => ({
      claimed: false,
      currentWidth: this.baseWidth,
      geometry: null,
      points: [],
      state: ACTIVE_STATE,
    }));
  }

  /** Begin claims an already selected input slot but intentionally appends no path point. */
  begin(slotIndex: number): void {
    const slot = this.requireSlot(slotIndex);
    if (slot.claimed) {
      throw new Error(`BasicBlade slot ${slotIndex} is already claimed`);
    }
    slot.claimed = true;
  }

  /** Appends every accepted visual move, including repeated and zero-distance points. */
  move(slotIndex: number, point: BladePoint): BasicBladeGeometry | null {
    const slot = this.requireClaimedSlot(slotIndex, 'move');
    const nextPoint = copyFloat32Point(point);
    if (slot.state === DISPOSING_STATE) {
      this.setNew(slot);
    }

    slot.points.push(nextPoint);
    if (slot.points.length > BASIC_BLADE_POINT_LIMIT) {
      slot.points.splice(0, 2);
      // Native Pop rebuilds here, then Push performs the same final rebuild once more.
      this.rebuildGeometry(slot);
    }
    this.rebuildGeometry(slot);
    return slot.geometry;
  }

  /** End frees ownership immediately while retaining the current geometry for disposal. */
  end(slotIndex: number): void {
    const slot = this.requireClaimedSlot(slotIndex, 'end');
    slot.claimed = false;
    slot.state = DISPOSING_STATE;
  }

  /**
   * Advances the native scheduled frame contract, not elapsed time.
   * Returns only slots whose render submission may have changed.
   */
  updateFrame(): readonly number[] {
    const changed: number[] = [];
    this.slots.forEach((slot, slotIndex) => {
      if (slot.state !== DISPOSING_STATE) {
        return;
      }
      if (slot.points.length >= 2) {
        slot.points.splice(0, 1);
        // Pop rebuilds with the pre-division width. The narrower width applies next frame.
        this.rebuildGeometry(slot);
        slot.currentWidth = Math.fround(slot.currentWidth / DISPOSAL_WIDTH_DIVISOR);
      } else {
        this.setNew(slot);
      }
      changed.push(slotIndex);
    });
    return Object.freeze(changed);
  }

  geometry(slotIndex: number): BasicBladeGeometry | null {
    return this.requireSlot(slotIndex).geometry;
  }

  isClaimed(slotIndex: number): boolean {
    return this.requireSlot(slotIndex).claimed;
  }

  snapshot(): readonly BasicBladeSlotSnapshot[] {
    return Object.freeze(this.slots.map((slot, slotIndex) => Object.freeze({
      claimed: slot.claimed,
      currentWidth: slot.currentWidth,
      geometry: slot.geometry,
      points: Object.freeze(slot.points.map(copyPoint)),
      slot: slotIndex,
      state: slot.state,
    })));
  }

  private rebuildGeometry(slot: MutableBasicBladeSlot): void {
    slot.geometry = createBasicBladeGeometry(slot.points, slot.currentWidth);
  }

  private setNew(slot: MutableBasicBladeSlot): void {
    slot.points.length = 0;
    slot.currentWidth = this.baseWidth;
    slot.geometry = null;
    slot.state = ACTIVE_STATE;
  }

  private requireSlot(slotIndex: number): MutableBasicBladeSlot {
    if (
      !Number.isSafeInteger(slotIndex)
      || slotIndex < 0
      || slotIndex >= BASIC_BLADE_SLOT_COUNT
    ) {
      throw new RangeError('slotIndex must identify one of the four BasicBlade slots');
    }
    const slot = this.slots[slotIndex];
    if (slot === undefined) {
      throw new Error(`BasicBlade slot ${slotIndex} is unavailable`);
    }
    return slot;
  }

  private requireClaimedSlot(slotIndex: number, operation: string): MutableBasicBladeSlot {
    const slot = this.requireSlot(slotIndex);
    if (!slot.claimed) {
      throw new Error(`BasicBlade slot ${slotIndex} must be claimed before ${operation}`);
    }
    return slot;
  }
}

export function getBasicBladeDefaultWidth(viewportWidth: number): number {
  assertFinite(viewportWidth, 'viewportWidth');
  const delta = Math.fround(viewportWidth - WIDTH_REFERENCE);
  return Math.fround(Math.fround(delta * WIDTH_SLOPE) + WIDTH_OFFSET);
}

export function createBasicBladeGeometry(
  points: readonly BladePoint[],
  currentWidth: number,
): BasicBladeGeometry | null {
  assertFinite(currentWidth, 'currentWidth');
  if (points.length < 3) {
    return null;
  }
  const path = points.map(copyFloat32Point);
  const pointCount = path.length;
  const vertices = Array.from<BasicBladeVertex>({ length: 2 * pointCount - 2 });
  const width = Math.fround(currentWidth);
  const step = Math.fround(width / Math.fround(pointCount - 2));

  vertices[0] = createVertex(path[0]!, 0.5, 0.5);
  for (let index = 0; index <= pointCount - 3; index += 1) {
    const oneMinusScaledStep = Math.fround(
      1 - Math.fround(Math.fround(index) * step),
    );
    const halfWidth = Math.fround(
      width - Math.fround(width * oneMinusScaledStep),
    );
    const [upper, lower] = createCrossSection(
      path[index]!,
      path[index + 1]!,
      halfWidth,
    );
    const alphaU = Math.fround(
      Math.fround(index + 1) / Math.fround(2 * pointCount),
    );
    vertices[2 * index + 1] = createVertex(upper, alphaU, 1);
    vertices[2 * index + 2] = createVertex(lower, alphaU, 0);
  }

  const firstUpper = vertices[1];
  const firstLower = vertices[2];
  if (firstUpper === undefined || firstLower === undefined) {
    throw new Error('BasicBlade geometry requires its first cross-section');
  }
  vertices[1] = createVertex(firstUpper.position, 0.25, 1);
  vertices[2] = createVertex(firstLower.position, 0.25, 0);
  vertices[2 * pointCount - 3] = createVertex(path[pointCount - 1]!, 1, 0.5);

  if (vertices.some((vertex) => vertex === undefined)) {
    throw new Error('BasicBlade geometry rebuild left an uninitialized vertex');
  }
  return Object.freeze({
    geometryWidth: width,
    legacyVertexStrideBytes: BASIC_BLADE_LEGACY_VERTEX_STRIDE_BYTES,
    primitive: 'triangle-strip',
    vertices: Object.freeze(vertices),
  });
}

function createCrossSection(
  start: BladePoint,
  end: BladePoint,
  halfWidth: number,
): readonly [BladePoint, BladePoint] {
  const deltaX = Math.fround(end.x - start.x);
  const deltaY = Math.fround(end.y - start.y);
  if (deltaX === 0 && deltaY === 0) {
    return Object.freeze([
      frozenPoint(start.x, Math.fround(start.y + halfWidth)),
      frozenPoint(start.x, Math.fround(start.y - halfWidth)),
    ]);
  }

  const length = Math.fround(Math.hypot(deltaX, deltaY));
  const angle = Math.atan2(deltaY, deltaX);
  return Object.freeze([
    rotateAround(start, length, halfWidth, angle),
    rotateAround(start, length, Math.fround(-halfWidth), angle),
  ]);
}

function rotateAround(
  origin: BladePoint,
  localX: number,
  localY: number,
  angle: number,
): BladePoint {
  const cosine = Math.fround(Math.cos(angle));
  const sine = Math.fround(Math.sin(angle));
  const rotatedX = Math.fround(
    Math.fround(localX * cosine) - Math.fround(localY * sine),
  );
  const rotatedY = Math.fround(
    Math.fround(localX * sine) + Math.fround(localY * cosine),
  );
  return frozenPoint(
    Math.fround(origin.x + rotatedX),
    Math.fround(origin.y + rotatedY),
  );
}

function createVertex(
  position: BladePoint,
  alphaU: number,
  alphaV: number,
): BasicBladeVertex {
  return Object.freeze({
    alphaUv: Object.freeze({
      u: Math.fround(alphaU),
      v: Math.fround(alphaV),
    }),
    position: copyPoint(position),
  });
}

function copyFloat32Point(point: BladePoint): BladePoint {
  assertFinite(point.x, 'point.x');
  assertFinite(point.y, 'point.y');
  return frozenPoint(Math.fround(point.x), Math.fround(point.y));
}

function copyPoint(point: BladePoint): BladePoint {
  return frozenPoint(point.x, point.y);
}

function frozenPoint(x: number, y: number): BladePoint {
  return Object.freeze({ x, y });
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}
