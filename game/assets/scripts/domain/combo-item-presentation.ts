/** Recovered `ComboItem` label content, color selection, and action timeline. */

export const COMBO_ITEM_SCALE_IN_SECONDS = Math.fround(0.15);
export const COMBO_ITEM_HOLD_SECONDS = Math.fround(1.5);
export const COMBO_ITEM_OVERSHOOT_SECONDS = Math.fround(0.25);
export const COMBO_ITEM_SCALE_OUT_SECONDS = Math.fround(0.15);
export const COMBO_ITEM_OVERSHOOT_SCALE = Math.fround(1.15);
export const COMBO_ITEM_BASE_FONT_SIZE = Math.fround(32);
export const COMBO_ITEM_REFERENCE_WIDTH = Math.fround(480);
export const COMBO_ITEM_Z_ORDER = 1 as const;

export interface ComboItemPoint {
  readonly x: number;
  readonly y: number;
}

export interface ComboItemColor {
  readonly b: number;
  readonly g: number;
  readonly r: number;
}

export interface ComboItemPresentationPlan {
  readonly color: ComboItemColor;
  readonly count: number;
  readonly fontSize: number;
  readonly position: ComboItemPoint;
  readonly text: string;
  readonly zOrder: 1;
}

export interface ComboItemPresentationSnapshot {
  readonly complete: boolean;
  readonly disposed: boolean;
  readonly elapsedActionSeconds: number;
  readonly scale: number;
}

export interface ComboItemPresentationUpdate {
  readonly completedNow: boolean;
  readonly snapshot: ComboItemPresentationSnapshot;
}

const COMBO_ITEM_SCALE_IN_END_SECONDS = COMBO_ITEM_SCALE_IN_SECONDS;
const COMBO_ITEM_HOLD_END_SECONDS = Math.fround(
  COMBO_ITEM_SCALE_IN_END_SECONDS + COMBO_ITEM_HOLD_SECONDS,
);
const COMBO_ITEM_OVERSHOOT_END_SECONDS = Math.fround(
  COMBO_ITEM_HOLD_END_SECONDS + COMBO_ITEM_OVERSHOOT_SECONDS,
);
export const COMBO_ITEM_TOTAL_SECONDS = Math.fround(
  COMBO_ITEM_OVERSHOOT_END_SECONDS + COMBO_ITEM_SCALE_OUT_SECONDS,
);

const COMBO_COLORS: Readonly<Record<number, ComboItemColor>> = Object.freeze({
  3: freezeColor(255, 153, 0),
  4: freezeColor(152, 204, 0),
  5: freezeColor(147, 39, 143),
  6: freezeColor(255, 0, 255),
  7: freezeColor(255, 102, 0),
  8: freezeColor(147, 39, 143),
  9: freezeColor(0, 51, 0),
});
const DEFAULT_COMBO_COLOR = freezeColor(0, 0, 255);

export function createComboItemPresentationPlan(
  count: number,
  position: ComboItemPoint,
  viewportWidth: number,
): ComboItemPresentationPlan {
  assertComboCount(count);
  const recoveredPosition = freezePoint(position);
  const width = toPositiveFloat32(viewportWidth, 'viewportWidth');
  const widthRatio = Math.fround(width / COMBO_ITEM_REFERENCE_WIDTH);
  const fontSize = Math.fround(COMBO_ITEM_BASE_FONT_SIZE * widthRatio);
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    throw new RangeError('ComboItem font size must be positive and finite');
  }
  return Object.freeze({
    color: copyColor(COMBO_COLORS[count] ?? DEFAULT_COMBO_COLOR),
    count,
    fontSize,
    position: recoveredPosition,
    text: `+${count} Fruits\nCombo`,
    zOrder: COMBO_ITEM_Z_ORDER,
  });
}

export class ComboItemPresentationState {
  readonly plan: ComboItemPresentationPlan;

  private completeValue = false;
  private disposedValue = false;
  private elapsedActionSecondsValue = Math.fround(0);
  private scaleValue = Math.fround(0);

  constructor(plan: ComboItemPresentationPlan) {
    assertPlan(plan);
    this.plan = Object.freeze({
      ...plan,
      color: copyColor(plan.color),
      position: freezePoint(plan.position),
    });
  }

  get snapshot(): ComboItemPresentationSnapshot {
    return this.createSnapshot();
  }

  updateAction(deltaSeconds: number): ComboItemPresentationUpdate {
    const delta = toNonNegativeFloat32(deltaSeconds, 'deltaSeconds');
    if (this.disposedValue || this.completeValue) {
      return Object.freeze({
        completedNow: false,
        snapshot: this.createSnapshot(),
      });
    }

    this.elapsedActionSecondsValue = Math.min(
      COMBO_ITEM_TOTAL_SECONDS,
      Math.fround(this.elapsedActionSecondsValue + delta),
    );
    this.scaleValue = comboItemScaleAt(this.elapsedActionSecondsValue);
    const completedNow = this.elapsedActionSecondsValue >= COMBO_ITEM_TOTAL_SECONDS;
    if (completedNow) {
      this.completeValue = true;
      this.scaleValue = Math.fround(0);
    }
    return Object.freeze({
      completedNow,
      snapshot: this.createSnapshot(),
    });
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    return true;
  }

  private createSnapshot(): ComboItemPresentationSnapshot {
    return Object.freeze({
      complete: this.completeValue,
      disposed: this.disposedValue,
      elapsedActionSeconds: this.elapsedActionSecondsValue,
      scale: this.scaleValue,
    });
  }
}

export function comboItemScaleAt(elapsedActionSeconds: number): number {
  const elapsed = toNonNegativeFloat32(
    elapsedActionSeconds,
    'elapsedActionSeconds',
  );
  if (elapsed >= COMBO_ITEM_TOTAL_SECONDS) {
    return Math.fround(0);
  }
  if (elapsed < COMBO_ITEM_SCALE_IN_END_SECONDS) {
    return Math.fround(elapsed / COMBO_ITEM_SCALE_IN_SECONDS);
  }
  if (elapsed < COMBO_ITEM_HOLD_END_SECONDS) {
    return Math.fround(1);
  }
  if (elapsed < COMBO_ITEM_OVERSHOOT_END_SECONDS) {
    const progress = Math.fround(
      (elapsed - COMBO_ITEM_HOLD_END_SECONDS) / COMBO_ITEM_OVERSHOOT_SECONDS,
    );
    return Math.fround(1 + Math.fround(
      (COMBO_ITEM_OVERSHOOT_SCALE - 1) * progress,
    ));
  }
  const progress = Math.fround(
    (elapsed - COMBO_ITEM_OVERSHOOT_END_SECONDS) / COMBO_ITEM_SCALE_OUT_SECONDS,
  );
  return Math.fround(COMBO_ITEM_OVERSHOOT_SCALE * Math.fround(1 - progress));
}

function assertPlan(plan: ComboItemPresentationPlan): void {
  if (plan === null || typeof plan !== 'object') {
    throw new TypeError('ComboItem plan must be an object');
  }
  assertComboCount(plan.count);
  freezePoint(plan.position);
  assertColor(plan.color);
  if (plan.text !== `+${plan.count} Fruits\nCombo`) {
    throw new Error('ComboItem text must preserve the recovered format');
  }
  toPositiveFloat32(plan.fontSize, 'fontSize');
  if (plan.zOrder !== COMBO_ITEM_Z_ORDER) {
    throw new RangeError('ComboItem z-order must be 1');
  }
}

function assertComboCount(count: number): void {
  if (!Number.isSafeInteger(count) || count < 3) {
    throw new RangeError('ComboItem count must be a safe integer of at least 3');
  }
}

function assertColor(color: ComboItemColor): void {
  if (color === null || typeof color !== 'object') {
    throw new TypeError('ComboItem color must be an object');
  }
  for (const [label, channel] of [
    ['r', color.r],
    ['g', color.g],
    ['b', color.b],
  ] as const) {
    if (!Number.isInteger(channel) || channel < 0 || channel > 255) {
      throw new RangeError(`ComboItem color ${label} must be an integer from 0 through 255`);
    }
  }
}

function freezeColor(r: number, g: number, b: number): ComboItemColor {
  return Object.freeze({ b, g, r });
}

function copyColor(color: ComboItemColor): ComboItemColor {
  assertColor(color);
  return freezeColor(color.r, color.g, color.b);
}

function freezePoint(point: ComboItemPoint): ComboItemPoint {
  if (point === null || typeof point !== 'object') {
    throw new TypeError('ComboItem position must be an object');
  }
  return Object.freeze({
    x: toFloat32(point.x, 'position.x'),
    y: toFloat32(point.y, 'position.y'),
  });
}

function toPositiveFloat32(value: number, label: string): number {
  const result = toFloat32(value, label);
  if (result <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
  return result;
}

function toNonNegativeFloat32(value: number, label: string): number {
  const result = toFloat32(value, label);
  if (result < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
  return result;
}

function toFloat32(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
  const result = Math.fround(value);
  if (!Number.isFinite(result)) {
    throw new RangeError(`${label} must remain finite as float32`);
  }
  return result;
}
