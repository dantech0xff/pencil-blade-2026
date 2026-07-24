/** GN Style's recovered mode identity and ordinary-fruit-only toss graph. */

export const GN_STYLE_MODE_ID = 2 as const;

export type GnStyleTossControllerId = 'free' | 'wave' | 'concurrent';
export type GnStyleTossControllerKind = GnStyleTossControllerId;
export type GnStyleTossDirection = 0;
export type GnStyleTossObjectType = 0;

export interface GnStyleTossInterval {
  readonly lowSeconds: number;
  readonly highSeconds: number;
}

interface GnStyleTossBaseRow {
  readonly controller: GnStyleTossControllerKind;
  readonly direction: GnStyleTossDirection;
  readonly id: GnStyleTossControllerId;
  readonly objectType: GnStyleTossObjectType;
  readonly outerInterval: GnStyleTossInterval;
  readonly slotOffset: number;
  readonly zOrder: 1;
}

export interface GnStyleFreeTossRow extends GnStyleTossBaseRow {
  readonly controller: 'free';
  readonly id: 'free';
}

export interface GnStyleWaveTossRow extends GnStyleTossBaseRow {
  readonly activeWindow: GnStyleTossInterval;
  readonly controller: 'wave';
  readonly id: 'wave';
  readonly internalInterval: GnStyleTossInterval;
}

export interface GnStyleConcurrentTossRow extends GnStyleTossBaseRow {
  /** Constructor arguments recovered from the native graph. */
  readonly countMax: 6;
  readonly countMin: 3;
  readonly controller: 'concurrent';
  readonly id: 'concurrent';
  /** The shared inclusive helper is called with `countMax + 1`. */
  readonly actualCountMaxInclusive: 7;
  readonly actualCountMinInclusive: 3;
}

export type GnStyleTossRow =
  | GnStyleFreeTossRow
  | GnStyleWaveTossRow
  | GnStyleConcurrentTossRow;

function interval(
  lowSeconds: number,
  highSeconds: number,
): GnStyleTossInterval {
  return Object.freeze({ highSeconds, lowSeconds });
}

export const GN_STYLE_FREE_OUTER_INTERVAL = interval(0.5, 3);
export const GN_STYLE_WAVE_OUTER_INTERVAL = interval(3.5, 8);
export const GN_STYLE_CONCURRENT_OUTER_INTERVAL = interval(3, 9);
export const GN_STYLE_WAVE_CHILD_INTERVAL = interval(0.25, 0.75);
export const GN_STYLE_WAVE_ACTIVE_WINDOW = interval(1.5, 6);

/** Maximum produced by the recovered decile sampler (`q = 0.9`), not the high limit. */
export const GN_STYLE_WAVE_ACTIVE_WINDOW_MAX_SAMPLE_SECONDS
  = Math.fround(
    GN_STYLE_WAVE_ACTIVE_WINDOW.lowSeconds
      + Math.fround(0.9) * (
        GN_STYLE_WAVE_ACTIVE_WINDOW.highSeconds
          - GN_STYLE_WAVE_ACTIVE_WINDOW.lowSeconds
      ),
  );

export const GN_STYLE_TOSS_ROWS: readonly GnStyleTossRow[] = Object.freeze([
  Object.freeze({
    controller: 'free',
    direction: 0,
    id: 'free',
    objectType: 0,
    outerInterval: GN_STYLE_FREE_OUTER_INTERVAL,
    slotOffset: 0x2ac,
    zOrder: 1,
  }),
  Object.freeze({
    activeWindow: GN_STYLE_WAVE_ACTIVE_WINDOW,
    controller: 'wave',
    direction: 0,
    id: 'wave',
    internalInterval: GN_STYLE_WAVE_CHILD_INTERVAL,
    objectType: 0,
    outerInterval: GN_STYLE_WAVE_OUTER_INTERVAL,
    slotOffset: 0x2b0,
    zOrder: 1,
  }),
  Object.freeze({
    actualCountMaxInclusive: 7,
    actualCountMinInclusive: 3,
    controller: 'concurrent',
    countMax: 6,
    countMin: 3,
    direction: 0,
    id: 'concurrent',
    objectType: 0,
    outerInterval: GN_STYLE_CONCURRENT_OUTER_INTERVAL,
    slotOffset: 0x2b4,
    zOrder: 1,
  }),
]);

/** Creation, equal-z attachment, GO start, and Time Up outer-stop share this order. */
export const GN_STYLE_TOSS_CREATION_ORDER = Object.freeze([
  'free', 'wave', 'concurrent',
] as const satisfies readonly GnStyleTossControllerId[]);

export const GN_STYLE_TOSS_START_ORDER = GN_STYLE_TOSS_CREATION_ORDER;
export const GN_STYLE_TOSS_OUTER_STOP_ORDER = GN_STYLE_TOSS_CREATION_ORDER;

export function getGnStyleTossRow(
  controllerId: GnStyleTossControllerId,
): GnStyleTossRow {
  const row = GN_STYLE_TOSS_ROWS.find(({ id }) => id === controllerId);
  if (row === undefined) {
    throw new RangeError(`unknown GN Style controller ${controllerId}`);
  }
  return row;
}
