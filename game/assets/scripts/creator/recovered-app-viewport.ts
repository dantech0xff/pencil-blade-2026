import type { AppliedClassicResolution } from './classic-resolution-adapter';
import type {
  AboutPoint,
  AboutViewport,
} from '../domain/about-presentation';
import type {
  LeaderboardPoint,
  LeaderboardViewport,
} from '../domain/leaderboard-presentation';
import type {
  LoadingPoint,
  LoadingViewport,
} from '../domain/loading-presentation';
import type {
  MainMenuPoint,
  MainMenuViewport,
} from '../domain/main-menu-presentation';
import type {
  ModeSelectPoint,
  ModeSelectViewport,
} from '../domain/mode-select-presentation';
import type {
  ObjectivesScreenPoint,
  ObjectivesScreenViewport,
} from '../domain/objectives-screen-presentation';
import type {
  OptionsPoint,
  OptionsViewport,
} from '../domain/options-presentation';

export interface RecoveredAppViewportSource {
  readonly profile: Readonly<{
    readonly designHeight: number;
    readonly designWidth: number;
  }>;
  readonly visibleRect: Readonly<{
    readonly height: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
  }>;
}

export type RecoveredAppViewport =
  & AboutViewport
  & LeaderboardViewport
  & LoadingViewport
  & MainMenuViewport
  & ModeSelectViewport
  & ObjectivesScreenViewport
  & OptionsViewport;

/**
 * Converts the recovered Classic resolution into the shared viewport contract used by
 * About, Main Menu, Mode Select, Objectives, Options, and Leaderboard. The output is
 * deeply frozen and float32-normalized.
 */
export function createRecoveredAppViewport(
  input: AppliedClassicResolution | RecoveredAppViewportSource,
): RecoveredAppViewport {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('input must be an object');
  }
  if (
    input.visibleRect === null
    || typeof input.visibleRect !== 'object'
    || Array.isArray(input.visibleRect)
    || input.profile === null
    || typeof input.profile !== 'object'
    || Array.isArray(input.profile)
  ) {
    throw new TypeError('input.profile and input.visibleRect must be objects');
  }

  const logicalWidth = positiveFiniteFloat32(
    input.profile.designWidth,
    'input.profile.designWidth',
  );
  const logicalHeight = positiveFiniteFloat32(
    input.profile.designHeight,
    'input.profile.designHeight',
  );
  const visibleWidth = positiveFiniteFloat32(
    input.visibleRect.width,
    'input.visibleRect.width',
  );
  const visibleHeight = positiveFiniteFloat32(
    input.visibleRect.height,
    'input.visibleRect.height',
  );
  const visibleX = finiteFloat32(input.visibleRect.x, 'input.visibleRect.x');
  const visibleY = finiteFloat32(input.visibleRect.y, 'input.visibleRect.y');
  const centerX = finiteFloat32(visibleX + Math.fround(visibleWidth * 0.5), 'center.x');
  const centerY = finiteFloat32(visibleY + Math.fround(visibleHeight * 0.5), 'center.y');

  return deepFreeze({
    logicalHeight,
    logicalWidth,
    visibleRect: {
      bottom: point(centerX, visibleY),
      center: point(centerX, centerY),
      left: point(visibleX, centerY),
      right: point(finiteFloat32(visibleX + visibleWidth, 'visibleRect.right.x'), centerY),
      top: point(centerX, finiteFloat32(visibleY + visibleHeight, 'visibleRect.top.y')),
    },
  });
}

function point(
  x: number,
  y: number,
): AboutPoint
  & LeaderboardPoint
  & LoadingPoint
  & MainMenuPoint
  & ModeSelectPoint
  & ObjectivesScreenPoint
  & OptionsPoint {
  return Object.freeze({
    x: finiteFloat32(x, 'point.x'),
    y: finiteFloat32(y, 'point.y'),
  });
}

function positiveFiniteFloat32(value: number, label: string): number {
  const floatValue = finiteFloat32(value, label);
  if (floatValue <= 0) {
    throw new RangeError(`${label} must be positive in float32`);
  }
  return floatValue;
}

function finiteFloat32(value: number, label: string): number {
  const floatValue = Math.fround(value);
  if (!Number.isFinite(value) || !Number.isFinite(floatValue)) {
    throw new RangeError(`${label} must be finite in float32`);
  }
  return floatValue;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    deepFreeze(record[key]);
  }
  return Object.freeze(value);
}
