import type { FailPosition, FailStrike } from './fail-service';

export const CLASSIC_FAIL_ENTRY_ACTION_SECONDS = Math.fround(1);
export const CLASSIC_FAIL_ACTIVATION_ACTION_SECONDS = Math.fround(0.25);
export const CLASSIC_FAIL_TRANSIENT_ACTION_SECONDS = Math.fround(1);
export const CLASSIC_FAIL_MARKER_Z_ORDER = 1;

export interface ClassicFailViewport {
  readonly height: number;
  readonly width: number;
}

export interface ClassicFailMarkerLayout {
  readonly initialWorldPosition: FailPosition;
  readonly scale: number;
  readonly strike: FailStrike;
  readonly targetWorldPosition: FailPosition;
}

export interface ClassicFailActivationPlan {
  readonly activationActionSeconds: number;
  readonly initialOpacity: 0;
  readonly initialScaleMultiplier: 5;
  readonly strike: FailStrike;
  readonly targetOpacity: 255;
  readonly targetScaleMultiplier: 1;
  readonly transientActionSeconds: number;
  readonly transientWorldPosition: FailPosition;
  readonly zOrder: 1;
}

const STRIKE_X_FACTORS = Object.freeze([0.675, 0.775, 0.9] as const);
const STRIKE_SCALES = Object.freeze([0.64, 0.8, 1] as const);
const INITIAL_Y_FACTOR = 1.125;
const TARGET_Y_FACTOR = 0.955;
const TRANSIENT_Y_FACTOR = 0.075;

/** Recovered persistent-marker entry layout in legacy logical world coordinates. */
export function createClassicFailMarkerLayouts(
  viewport: ClassicFailViewport,
): readonly [ClassicFailMarkerLayout, ClassicFailMarkerLayout, ClassicFailMarkerLayout] {
  assertViewport(viewport);
  return Object.freeze(STRIKE_X_FACTORS.map((xFactor, index) => {
    const strike = (index + 1) as FailStrike;
    return Object.freeze({
      initialWorldPosition: frozenPosition(
        Math.fround(viewport.width * xFactor),
        Math.fround(viewport.height * INITIAL_Y_FACTOR),
      ),
      scale: Math.fround(STRIKE_SCALES[index]),
      strike,
      targetWorldPosition: frozenPosition(
        Math.fround(viewport.width * xFactor),
        Math.fround(viewport.height * TARGET_Y_FACTOR),
      ),
    });
  })) as readonly [ClassicFailMarkerLayout, ClassicFailMarkerLayout, ClassicFailMarkerLayout];
}

/** Recovered per-miss marker activation and one-second transient location. */
export function createClassicFailActivationPlan(
  strike: FailStrike,
  missPosition: FailPosition,
  viewport: ClassicFailViewport,
): ClassicFailActivationPlan {
  assertStrike(strike);
  assertPosition(missPosition, 'missPosition');
  assertViewport(viewport);
  return Object.freeze({
    activationActionSeconds: CLASSIC_FAIL_ACTIVATION_ACTION_SECONDS,
    initialOpacity: 0,
    initialScaleMultiplier: 5,
    strike,
    targetOpacity: 255,
    targetScaleMultiplier: 1,
    transientActionSeconds: CLASSIC_FAIL_TRANSIENT_ACTION_SECONDS,
    transientWorldPosition: frozenPosition(
      missPosition.x,
      Math.fround(viewport.height * TRANSIENT_Y_FACTOR),
    ),
    zOrder: CLASSIC_FAIL_MARKER_Z_ORDER,
  });
}

function assertViewport(viewport: ClassicFailViewport): void {
  if (viewport === null || typeof viewport !== 'object') {
    throw new TypeError('viewport must be an object');
  }
  assertPositiveFinite(viewport.width, 'viewport.width');
  assertPositiveFinite(viewport.height, 'viewport.height');
}

function assertStrike(value: number): asserts value is FailStrike {
  if (value !== 1 && value !== 2 && value !== 3) {
    throw new RangeError('strike must be 1, 2, or 3');
  }
}

function assertPosition(position: FailPosition, label: string): void {
  if (position === null || typeof position !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
  assertFinite(position.x, `${label}.x`);
  assertFinite(position.y, `${label}.y`);
}

function assertPositiveFinite(value: number, label: string): void {
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

function frozenPosition(x: number, y: number): FailPosition {
  return Object.freeze({ x, y });
}
