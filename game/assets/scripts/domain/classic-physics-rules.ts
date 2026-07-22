/**
 * Pure values at the recovered Box2D -> Cocos Creator Physics2D boundary.
 *
 * Timestep equivalence is intentionally absent. The original uses a variable
 * `frameDt * worldSpeed` step while Creator 3.8.8 defaults to a fixed-step
 * accumulator. That policy remains unresolved and must be integration-tested.
 */

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface ClassicPhysicsConfiguration {
  readonly allowSleep: true;
  readonly gravityWorldUnitsPerSecondSquared: Point2D;
  readonly positionIterations: 10;
  readonly timestepPolicy: 'unresolved';
  readonly velocityIterations: 10;
}

export const LEGACY_WORLD_UNITS_PER_METRE = 32;
export const CLASSIC_BLADE_SLOT_COUNT = 4;
export const CLASSIC_EXCLUDED_CUT_NODE_TAG = 1437;
export const CLASSIC_RAY_EXTENSION_DIVISOR = 16;
export const CLASSIC_SWISH_WIDTH_RATIO = Math.fround(0.0825);

export const CLASSIC_PHYSICS_CONFIGURATION: ClassicPhysicsConfiguration = Object.freeze({
  allowSleep: true,
  gravityWorldUnitsPerSecondSquared: Object.freeze({ x: 0, y: -320 }),
  positionIterations: 10,
  timestepPolicy: 'unresolved',
  velocityIterations: 10,
});

export function metresToCreatorWorld(value: number): number {
  assertFinite(value, 'metres');
  return value * LEGACY_WORLD_UNITS_PER_METRE;
}

export function creatorWorldToMetres(value: number): number {
  assertFinite(value, 'Creator world value');
  return value / LEGACY_WORLD_UNITS_PER_METRE;
}

export function positionMetresToCreatorWorld(position: Point2D): Point2D {
  assertPoint(position, 'position');
  return {
    x: metresToCreatorWorld(position.x),
    y: metresToCreatorWorld(position.y),
  };
}

/** Creator's RigidBody2D API already exposes Box2D metres/second. */
export function linearVelocityToCreator(velocityMetresPerSecond: Point2D): Point2D {
  assertPoint(velocityMetresPerSecond, 'linear velocity');
  return { x: velocityMetresPerSecond.x, y: velocityMetresPerSecond.y };
}

/** Creator and the recovered contract both use radians/second. */
export function angularVelocityToCreator(radiansPerSecond: number): number {
  assertFinite(radiansPerSecond, 'angular velocity');
  return radiansPerSecond;
}

/** Creator ray endpoints stay in legacy/Creator world units; do not divide by 32. */
export function rayEndpointToCreator(endpoint: Point2D): Point2D {
  assertPoint(endpoint, 'ray endpoint');
  return { x: endpoint.x, y: endpoint.y };
}

function assertPoint(point: Point2D, label: string): void {
  assertFinite(point.x, `${label}.x`);
  assertFinite(point.y, `${label}.y`);
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}
