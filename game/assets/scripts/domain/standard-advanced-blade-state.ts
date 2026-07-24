import type { BladePoint } from './blade-tracks';

export const STANDARD_ADVANCED_BLADE_SLOT_COUNT = 4 as const;
export const STANDARD_ADVANCED_BLADE_CONFIGURED_POINT_CAPACITY = 32 as const;
export const STANDARD_ADVANCED_BLADE_BASE_OVERFLOW_COUNT = 11 as const;

export type StandardAdvancedBladeFamily = 'dragon' | 'centipede';
export type StandardAdvancedBladeLifecycleState = 0 | 2 | 4;

export interface StandardAdvancedBladeSpriteWidths {
  readonly body: number;
  readonly head: number;
  readonly tail: number;
}

export interface StandardAdvancedBladeSpriteTransform {
  readonly opacity: number;
  readonly position: BladePoint;
  readonly rotationDegrees: number;
  readonly scale: number;
  readonly visible: true;
}

export interface StandardAdvancedBladeBodyTransform
  extends StandardAdvancedBladeSpriteTransform {
  readonly bodyIndex: number;
}

export interface StandardAdvancedBladeLayout {
  readonly bodies: readonly StandardAdvancedBladeBodyTransform[];
  readonly bodyPoolSize: 15 | 20;
  readonly head: StandardAdvancedBladeSpriteTransform | null;
  readonly tail: StandardAdvancedBladeSpriteTransform | null;
  readonly visible: boolean;
}

export interface StandardAdvancedBladeSlotSnapshot {
  readonly basePoints: readonly BladePoint[];
  readonly claimed: boolean;
  readonly configuredPointCapacity: 32;
  readonly family: StandardAdvancedBladeFamily;
  readonly layout: StandardAdvancedBladeLayout;
  readonly opacity: number;
  readonly phase: number;
  readonly slot: number;
  readonly state: StandardAdvancedBladeLifecycleState;
  readonly wavedPointCapacity: 15 | 20;
  readonly wavedPoints: readonly BladePoint[];
}

interface MutableStandardAdvancedBladeSlot {
  basePoints: BladePoint[];
  claimed: boolean;
  opacity: number;
  phase: number;
  state: StandardAdvancedBladeLifecycleState;
  wavedPoints: BladePoint[];
}

interface FamilyContract {
  readonly bodyPoolSize: 15 | 20;
  readonly disposalOpacity: 239 | 244;
  readonly step: 20 | 10;
  readonly wavedPointCapacity: 15 | 20;
}

const NEW_STATE: StandardAdvancedBladeLifecycleState = 0;
const ACTIVE_STATE: StandardAdvancedBladeLifecycleState = 2;
const DISPOSING_STATE: StandardAdvancedBladeLifecycleState = 4;
const FULL_OPACITY = 255;
const RADIANS_TO_DEGREES = Math.fround(57.29578);

const FAMILY_CONTRACTS: Readonly<Record<
  StandardAdvancedBladeFamily,
  FamilyContract
>> = Object.freeze({
  dragon: Object.freeze({
    bodyPoolSize: 15,
    disposalOpacity: 239,
    step: 20,
    wavedPointCapacity: 15,
  }),
  centipede: Object.freeze({
    bodyPoolSize: 20,
    disposalOpacity: 244,
    step: 10,
    wavedPointCapacity: 20,
  }),
});

/**
 * Pure four-slot state and layout model for the recovered standard Dragon and Centipede blades.
 *
 * Sprite widths are supplied by the selected resolution's multipart resource contract. They are
 * intentionally required because the compact and high-resolution packages use different widths.
 */
export class StandardAdvancedBladeState {
  readonly configuredPointCapacity = STANDARD_ADVANCED_BLADE_CONFIGURED_POINT_CAPACITY;
  readonly family: StandardAdvancedBladeFamily;
  readonly slotCount = STANDARD_ADVANCED_BLADE_SLOT_COUNT;
  readonly spriteWidths: StandardAdvancedBladeSpriteWidths;
  readonly step: 20 | 10;
  readonly wavedPointCapacity: 15 | 20;

  private readonly contract: FamilyContract;
  private readonly slots: MutableStandardAdvancedBladeSlot[];

  constructor(
    family: StandardAdvancedBladeFamily,
    spriteWidths: StandardAdvancedBladeSpriteWidths,
  ) {
    assertFamily(family);
    this.family = family;
    this.contract = FAMILY_CONTRACTS[family];
    this.step = this.contract.step;
    this.wavedPointCapacity = this.contract.wavedPointCapacity;
    this.spriteWidths = copySpriteWidths(spriteWidths);
    this.slots = Array.from(
      { length: STANDARD_ADVANCED_BLADE_SLOT_COUNT },
      createNewSlot,
    );
  }

  /** Claims an already selected input slot without appending a path point. */
  begin(slotIndex: number): void {
    const slot = this.requireSlot(slotIndex);
    if (slot.claimed) {
      throw new Error(`Advanced blade slot ${slotIndex} is already claimed`);
    }
    slot.claimed = true;
  }

  /**
   * Processes one native Push input and returns the layout derived from the retained waved path.
   * Sub-step inputs are intentionally discarded; their residual distance remains relative to B.last.
   */
  move(slotIndex: number, point: BladePoint): StandardAdvancedBladeLayout {
    const slot = this.requireClaimedSlot(slotIndex, 'move');
    const nextPoint = copyFloat32Point(point);
    if (slot.state === DISPOSING_STATE) {
      this.setNew(slot);
    }

    if (slot.basePoints.length === 0) {
      slot.basePoints.push(nextPoint);
      slot.wavedPoints.push(nextPoint);
      slot.state = ACTIVE_STATE;
      return this.createLayout(slot);
    }

    const anchor = requireLast(slot.basePoints, 'base path');
    const deltaX = Math.fround(nextPoint.x - anchor.x);
    const deltaY = Math.fround(nextPoint.y - anchor.y);
    const distance = this.length(deltaX, deltaY);
    if (!Number.isFinite(distance)) {
      throw new RangeError('advanced blade move distance must remain finite');
    }
    const segmentCount = Math.trunc(
      Math.fround(distance / Math.fround(this.contract.step)),
    );
    if (!Number.isSafeInteger(segmentCount)) {
      throw new RangeError('advanced blade move segment count must be a safe integer');
    }
    if (segmentCount === 0) {
      return this.createLayout(slot);
    }

    const stepRatio = Math.fround(
      Math.fround(this.contract.step) / distance,
    );
    const normalizedX = Math.fround(deltaX / distance);
    const normalizedY = Math.fround(deltaY / distance);
    const normalX = Math.fround(-normalizedY);
    const normalY = normalizedX;

    for (let segment = 1; segment <= segmentCount; segment += 1) {
      const segmentFloat = Math.fround(segment);
      const scaledDeltaX = Math.fround(deltaX * segmentFloat);
      const scaledDeltaY = Math.fround(deltaY * segmentFloat);
      const straight = frozenPoint(
        Math.fround(
          anchor.x + Math.fround(scaledDeltaX * stepRatio),
        ),
        Math.fround(
          anchor.y + Math.fround(scaledDeltaY * stepRatio),
        ),
      );
      const wave = this.wave(slot.phase);
      const waved = frozenPoint(
        Math.fround(
          straight.x + Math.fround(normalX * wave),
        ),
        Math.fround(
          straight.y + Math.fround(normalY * wave),
        ),
      );

      slot.phase = Math.fround(
        slot.phase + Math.fround(this.contract.step),
      );
      slot.wavedPoints.push(waved);
      if (slot.wavedPoints.length > this.contract.wavedPointCapacity) {
        slot.wavedPoints.shift();
      }
      if (segment === segmentCount) {
        slot.basePoints.push(straight);
      }
    }

    return this.createLayout(slot);
  }

  /** Frees ownership immediately while retaining B until the recovered disposal update runs. */
  end(slotIndex: number): void {
    const slot = this.requireClaimedSlot(slotIndex, 'end');
    slot.claimed = false;
    slot.state = DISPOSING_STATE;
  }

  /**
   * Advances one scheduled native update. Active B overflow removes one point, not a whole excess;
   * disposing gestures with at least two B anchors clear Q but remain in state 4.
   */
  updateFrame(): readonly number[] {
    const changed: number[] = [];
    this.slots.forEach((slot, slotIndex) => {
      if (slot.state === DISPOSING_STATE) {
        if (slot.basePoints.length >= 2) {
          slot.wavedPoints.length = 0;
          slot.opacity = this.contract.disposalOpacity;
        } else {
          this.setNew(slot);
        }
        changed.push(slotIndex);
        return;
      }

      if (
        slot.state === ACTIVE_STATE
        && slot.basePoints.length >= STANDARD_ADVANCED_BLADE_BASE_OVERFLOW_COUNT
      ) {
        slot.basePoints.shift();
        changed.push(slotIndex);
      }
    });
    return Object.freeze(changed);
  }

  isClaimed(slotIndex: number): boolean {
    return this.requireSlot(slotIndex).claimed;
  }

  layout(slotIndex: number): StandardAdvancedBladeLayout {
    return this.createLayout(this.requireSlot(slotIndex));
  }

  snapshot(): readonly StandardAdvancedBladeSlotSnapshot[] {
    return Object.freeze(this.slots.map((slot, slotIndex) => Object.freeze({
      basePoints: freezePointCopies(slot.basePoints),
      claimed: slot.claimed,
      configuredPointCapacity: STANDARD_ADVANCED_BLADE_CONFIGURED_POINT_CAPACITY,
      family: this.family,
      layout: this.createLayout(slot),
      opacity: slot.opacity,
      phase: slot.phase,
      slot: slotIndex,
      state: slot.state,
      wavedPointCapacity: this.contract.wavedPointCapacity,
      wavedPoints: freezePointCopies(slot.wavedPoints),
    })));
  }

  private createLayout(
    slot: MutableStandardAdvancedBladeSlot,
  ): StandardAdvancedBladeLayout {
    const points = slot.wavedPoints;
    if (points.length < 3) {
      return Object.freeze({
        bodies: Object.freeze([]),
        bodyPoolSize: this.contract.bodyPoolSize,
        head: null,
        tail: null,
        visible: false,
      });
    }

    const bodies: StandardAdvancedBladeBodyTransform[] = [];
    for (let index = points.length - 1; index >= 1; index -= 1) {
      const current = requirePoint(points, index);
      const previous = requirePoint(points, index - 1);
      const angleVectorX = Math.fround(previous.x - current.x);
      const angleVectorY = Math.fround(previous.y - current.y);
      bodies.push(Object.freeze({
        bodyIndex: index,
        opacity: slot.opacity,
        position: frozenPoint(
          Math.fround(
            Math.fround(current.x + previous.x) * Math.fround(0.5),
          ),
          Math.fround(
            Math.fround(current.y + previous.y) * Math.fround(0.5),
          ),
        ),
        rotationDegrees: this.rotationDegrees(angleVectorX, angleVectorY),
        scale: this.bodyScale(index, points.length),
        visible: true,
      }));
    }

    const first = requirePoint(points, 0);
    const second = requirePoint(points, 1);
    const tailVectorX = Math.fround(second.x - first.x);
    const tailVectorY = Math.fround(second.y - first.y);
    const tailLength = this.length(tailVectorX, tailVectorY);
    const tailFactor = Math.fround(
      this.spriteWidths.tail
      / Math.fround(this.spriteWidths.tail + tailLength),
    );
    const tail = freezeTransform({
      opacity: slot.opacity,
      position: frozenPoint(
        Math.fround(
          first.x - Math.fround(tailVectorX * tailFactor),
        ),
        Math.fround(
          first.y - Math.fround(tailVectorY * tailFactor),
        ),
      ),
      rotationDegrees: this.rotationDegrees(
        Math.fround(-tailVectorX),
        Math.fround(-tailVectorY),
      ),
      scale: 1,
      visible: true,
    });

    const headPoint = requireLast(points, 'waved path');
    const beforeHead = requirePoint(points, points.length - 2);
    const backX = Math.fround(beforeHead.x - headPoint.x);
    const backY = Math.fround(beforeHead.y - headPoint.y);
    const backLength = this.length(backX, backY);
    const halfHeadWidth = Math.fround(
      Math.fround(0.5) * this.spriteWidths.head,
    );
    const headFactor = Math.fround(
      halfHeadWidth / Math.fround(halfHeadWidth + backLength),
    );
    const head = freezeTransform({
      opacity: slot.opacity,
      position: frozenPoint(
        Math.fround(
          headPoint.x - Math.fround(backX * headFactor),
        ),
        Math.fround(
          headPoint.y - Math.fround(backY * headFactor),
        ),
      ),
      rotationDegrees: this.rotationDegrees(backX, backY),
      scale: 1,
      visible: true,
    });

    return Object.freeze({
      bodies: Object.freeze(bodies),
      bodyPoolSize: this.contract.bodyPoolSize,
      head,
      tail,
      visible: true,
    });
  }

  private bodyScale(index: number, pointCount: number): number {
    if (this.family === 'centipede') {
      return 1;
    }
    const leading = Math.fround(
      Math.fround(index) / Math.fround(pointCount - 1),
    );
    const taper = Math.fround(
      Math.fround(0.5) * Math.fround(
        Math.fround(pointCount - 1 - index) / Math.fround(pointCount),
      ),
    );
    return Math.fround(leading + taper);
  }

  private length(x: number, y: number): number {
    const squared = Math.fround(
      Math.fround(x * x) + Math.fround(y * y),
    );
    if (this.family === 'dragon') {
      // JavaScript has no sqrtf; rounding the result models its float32 boundary.
      return Math.fround(Math.sqrt(squared));
    }
    // Native Centipede promotes the float32 squared sum to double for sqrt.
    const doubleLength = Math.sqrt(squared);
    return Math.fround(doubleLength);
  }

  private wave(phase: number): number {
    const angle = Math.fround(phase * Math.fround(5));
    if (this.family === 'dragon') {
      // JavaScript has no sinf; preserve the native float result before the float multiply.
      const sine = Math.fround(Math.sin(angle));
      return Math.fround(sine * Math.fround(15));
    }
    return Math.fround(Math.sin(angle) * 15);
  }

  private rotationDegrees(x: number, y: number): number {
    return Math.fround(this.angleRadians(x, y) * RADIANS_TO_DEGREES);
  }

  private angleRadians(x: number, y: number): number {
    if (x === 0 && y === 0) {
      return 0;
    }
    if (x === 0) {
      return y > 0
        ? Math.fround(Math.PI / 2)
        : Math.fround(-Math.PI / 2);
    }
    if (y === 0 && x < 0) {
      return Math.fround(-Math.PI);
    }

    const quotient = Math.fround(y / x);
    if (this.family === 'dragon') {
      const arcTangent = Math.fround(Math.atan(quotient));
      return x < 0
        ? Math.fround(Math.PI - arcTangent)
        : Math.fround(-arcTangent);
    }
    const arcTangent = Math.atan(quotient);
    return x < 0
      ? Math.fround(Math.PI - arcTangent)
      : Math.fround(-arcTangent);
  }

  private setNew(slot: MutableStandardAdvancedBladeSlot): void {
    slot.basePoints.length = 0;
    slot.wavedPoints.length = 0;
    slot.phase = 0;
    slot.opacity = FULL_OPACITY;
    slot.state = NEW_STATE;
  }

  private requireSlot(slotIndex: number): MutableStandardAdvancedBladeSlot {
    if (
      !Number.isSafeInteger(slotIndex)
      || slotIndex < 0
      || slotIndex >= STANDARD_ADVANCED_BLADE_SLOT_COUNT
    ) {
      throw new RangeError('slotIndex must identify one of the four advanced blade slots');
    }
    const slot = this.slots[slotIndex];
    if (slot === undefined) {
      throw new Error(`Advanced blade slot ${slotIndex} is unavailable`);
    }
    return slot;
  }

  private requireClaimedSlot(
    slotIndex: number,
    operation: string,
  ): MutableStandardAdvancedBladeSlot {
    const slot = this.requireSlot(slotIndex);
    if (!slot.claimed) {
      throw new Error(
        `Advanced blade slot ${slotIndex} must be claimed before ${operation}`,
      );
    }
    return slot;
  }
}

function createNewSlot(): MutableStandardAdvancedBladeSlot {
  return {
    basePoints: [],
    claimed: false,
    opacity: FULL_OPACITY,
    phase: 0,
    state: NEW_STATE,
    wavedPoints: [],
  };
}

function copySpriteWidths(
  widths: StandardAdvancedBladeSpriteWidths,
): StandardAdvancedBladeSpriteWidths {
  if (typeof widths !== 'object' || widths === null) {
    throw new TypeError('spriteWidths must be an object');
  }
  return Object.freeze({
    body: positiveFloat32(widths.body, 'spriteWidths.body'),
    head: positiveFloat32(widths.head, 'spriteWidths.head'),
    tail: positiveFloat32(widths.tail, 'spriteWidths.tail'),
  });
}

function positiveFloat32(value: number, label: string): number {
  assertFinite(value, label);
  const converted = Math.fround(value);
  if (!Number.isFinite(converted) || converted <= 0) {
    throw new RangeError(`${label} must be a positive finite float32 value`);
  }
  return converted;
}

function copyFloat32Point(point: BladePoint): BladePoint {
  if (typeof point !== 'object' || point === null) {
    throw new TypeError('point must be an object');
  }
  assertFinite(point.x, 'point.x');
  assertFinite(point.y, 'point.y');
  const x = Math.fround(point.x);
  const y = Math.fround(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new RangeError('point coordinates must fit finite float32 values');
  }
  return frozenPoint(x, y);
}

function assertFamily(
  family: StandardAdvancedBladeFamily,
): asserts family is StandardAdvancedBladeFamily {
  if (family !== 'dragon' && family !== 'centipede') {
    throw new RangeError('family must be either dragon or centipede');
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}

function requirePoint(
  points: readonly BladePoint[],
  index: number,
): BladePoint {
  const point = points[index];
  if (point === undefined) {
    throw new Error(`Advanced blade path point ${index} is unavailable`);
  }
  return point;
}

function requireLast(
  points: readonly BladePoint[],
  label: string,
): BladePoint {
  const point = points[points.length - 1];
  if (point === undefined) {
    throw new Error(`Advanced blade ${label} is empty`);
  }
  return point;
}

function freezePointCopies(points: readonly BladePoint[]): readonly BladePoint[] {
  return Object.freeze(points.map((point) => frozenPoint(point.x, point.y)));
}

function frozenPoint(x: number, y: number): BladePoint {
  return Object.freeze({ x, y });
}

function freezeTransform(
  transform: StandardAdvancedBladeSpriteTransform,
): StandardAdvancedBladeSpriteTransform {
  return Object.freeze(transform);
}
