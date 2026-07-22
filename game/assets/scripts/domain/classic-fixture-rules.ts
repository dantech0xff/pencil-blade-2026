/** Recovered Classic Box2D fixture values and Creator geometry mappings. */

export const LEGACY_WORLD_UNITS_PER_METRE = 32;
export const MIN_FRUIT_ID = 0;
export const MAX_FRUIT_ID = 14;
export const ELECTRIC_FIELD_NODE_TAG = 1437;

export interface FixtureVector2 {
  readonly x: number;
  readonly y: number;
}

export interface FixtureSize2D {
  readonly height: number;
  readonly width: number;
}

export interface CollisionFilterData {
  readonly categoryBits: number;
  readonly groupIndex: number;
  readonly maskBits: number;
}

export interface DynamicBodyInitialState {
  readonly active: true;
  readonly allowSleep: true;
  readonly angleRadians: 0;
  readonly angularDamping: 0;
  readonly angularVelocityRadiansPerSecond: 0;
  readonly awake: true;
  readonly bodyType: 'dynamic';
  readonly box2dTypeCode: 2;
  readonly bodyUserData: 'owner';
  readonly bullet: false;
  readonly creatorPositionWorldUnits: FixtureVector2;
  readonly fixedRotation: false;
  readonly gravityScale: 1;
  readonly linearDamping: 0;
  readonly linearVelocityMetresPerSecond: FixtureVector2;
  readonly positionMetres: FixtureVector2;
}

export type FixtureShape =
  | Readonly<{
      type: 'box';
      centerMetres: FixtureVector2;
      creatorSizeWorldUnits: FixtureSize2D;
      halfExtentsMetres: FixtureVector2;
    }>
  | Readonly<{
      type: 'circle';
      centerMetres: FixtureVector2;
      creatorRadiusWorldUnits: number;
      radiusMetres: number;
    }>;

export interface ClassicFixtureDefinition {
  readonly density: 1;
  readonly filter: CollisionFilterData;
  readonly fixtureUserData: null;
  readonly friction: number;
  readonly restitution: 0;
  readonly sensor: false;
  readonly shape: FixtureShape;
}

export interface FruitFixtureInput {
  readonly fruitId: number;
  readonly spriteHeightWorldUnits: number;
  readonly spriteWidthWorldUnits: number;
  readonly viewportHeightWorldUnits: number;
  readonly viewportWidthWorldUnits: number;
}

export interface FruitFixtureConfiguration {
  readonly body: DynamicBodyInitialState;
  readonly fixture: ClassicFixtureDefinition;
  readonly fruitId: number;
  readonly kind: 'fruit';
}

export interface BombFixtureInput {
  readonly bombId: number;
  readonly spriteWidthWorldUnits: number;
}

export interface BombFixtureConfiguration {
  readonly body: DynamicBodyInitialState;
  readonly bombId: number;
  readonly fixture: ClassicFixtureDefinition;
  readonly kind: 'bomb';
}

export interface ElectricFieldInput {
  readonly viewportHeightWorldUnits: number;
  readonly viewportWidthWorldUnits: number;
}

export interface ElectricFieldCompatibilityDescriptor {
  readonly body: Readonly<{
    active: false;
    bodyType: 'static';
    box2dTypeCode: 0;
    bodyUserData: 'owner';
    creatorPositionWorldUnits: FixtureVector2;
    positionMetres: FixtureVector2;
  }>;
  readonly compatibilityStatus: 'unresolved';
  readonly instantiable: false;
  readonly kind: 'electric-field';
  readonly nodeTag: 1437;
  readonly nominalFixture: ClassicFixtureDefinition;
  readonly unresolvedReasons: readonly [
    'degenerate-zero-height-shape',
    'unsafe-native-contact-layout',
  ];
}

export type ContactFilterDecision =
  | Readonly<{
      collides: boolean;
      rule: 'shared-group';
      sharedGroupIndex: number;
    }>
  | Readonly<{
      aAcceptsB: boolean;
      bAcceptsA: boolean;
      collides: boolean;
      rule: 'bilateral-masks';
    }>;

export type ClassicFixtureKind = 'fruit' | 'bomb' | 'electric';

const ZERO_VECTOR: FixtureVector2 = Object.freeze({ x: 0, y: 0 });
const RECOVERED_FRICTION = Math.fround(0.2);
const ELECTRIC_UNRESOLVED_REASONS: ElectricFieldCompatibilityDescriptor['unresolvedReasons']
  = Object.freeze([
    'degenerate-zero-height-shape',
    'unsafe-native-contact-layout',
  ]);

export const FRUIT_COLLISION_FILTER: CollisionFilterData = Object.freeze({
  categoryBits: 0x0001,
  groupIndex: 0,
  maskBits: 0xfffc,
});

export const BOMB_COLLISION_FILTER: CollisionFilterData = Object.freeze({
  categoryBits: 0x0002,
  groupIndex: 0,
  maskBits: 0x0001,
});

export const ELECTRIC_COLLISION_FILTER: CollisionFilterData = Object.freeze({
  categoryBits: 0x0003,
  groupIndex: 0,
  maskBits: 0x0002,
});

export const CLASSIC_CONTACT_PAIR_OUTCOMES = Object.freeze({
  bombBomb: false,
  bombElectric: true,
  electricElectric: true,
  fruitBomb: false,
  fruitElectric: false,
  fruitFruit: false,
});

export function createFruitFixtureConfiguration(
  input: FruitFixtureInput,
): FruitFixtureConfiguration {
  assertObject(input, 'input');
  assertIntegerInRange(input.fruitId, MIN_FRUIT_ID, MAX_FRUIT_ID, 'fruitId');
  const spriteWidth = toPositiveFloat32(
    input.spriteWidthWorldUnits,
    'spriteWidthWorldUnits',
  );
  const spriteHeight = toPositiveFloat32(
    input.spriteHeightWorldUnits,
    'spriteHeightWorldUnits',
  );
  const viewportWidth = toPositiveFloat32(
    input.viewportWidthWorldUnits,
    'viewportWidthWorldUnits',
  );
  const viewportHeight = toPositiveFloat32(
    input.viewportHeightWorldUnits,
    'viewportHeightWorldUnits',
  );

  const shape = input.fruitId === 1 || input.fruitId === 2
    ? createFruitBoxShape(spriteWidth, spriteHeight)
    : createFruitCircleShape(spriteWidth, spriteHeight);

  return Object.freeze({
    body: createDynamicBody(
      Object.freeze({
        x: Math.fround(-viewportWidth / LEGACY_WORLD_UNITS_PER_METRE),
        y: Math.fround(-viewportHeight / LEGACY_WORLD_UNITS_PER_METRE),
      }),
      Object.freeze({ x: -viewportWidth, y: -viewportHeight }),
    ),
    fixture: createFixture(shape, FRUIT_COLLISION_FILTER),
    fruitId: input.fruitId,
    kind: 'fruit',
  });
}

export function createBombFixtureConfiguration(
  input: BombFixtureInput,
): BombFixtureConfiguration {
  assertObject(input, 'input');
  assertIntegerInRange(input.bombId, 0, 1, 'bombId');
  const spriteWidth = toPositiveFloat32(
    input.spriteWidthWorldUnits,
    'spriteWidthWorldUnits',
  );
  const radiusMetres = Math.fround(spriteWidth / 88);
  const creatorRadiusWorldUnits = Math.fround((4 * spriteWidth) / 11);
  const shape: FixtureShape = Object.freeze({
    type: 'circle',
    centerMetres: ZERO_VECTOR,
    creatorRadiusWorldUnits,
    radiusMetres,
  });

  return Object.freeze({
    body: createDynamicBody(ZERO_VECTOR, ZERO_VECTOR),
    bombId: input.bombId,
    fixture: createFixture(shape, BOMB_COLLISION_FILTER),
    kind: 'bomb',
  });
}

/**
 * Numeric electric-field evidence is exposed for review, but the descriptor
 * cannot be used as an instantiable fixture while both compatibility defects
 * remain unresolved.
 */
export function describeElectricFieldCompatibility(
  input: ElectricFieldInput,
): ElectricFieldCompatibilityDescriptor {
  assertObject(input, 'input');
  const viewportWidth = toPositiveFloat32(
    input.viewportWidthWorldUnits,
    'viewportWidthWorldUnits',
  );
  const viewportHeight = toPositiveFloat32(
    input.viewportHeightWorldUnits,
    'viewportHeightWorldUnits',
  );
  const nominalShape: FixtureShape = Object.freeze({
    type: 'box',
    centerMetres: ZERO_VECTOR,
    creatorSizeWorldUnits: Object.freeze({
      height: 0,
      width: Math.fround(4 * viewportWidth),
    }),
    halfExtentsMetres: Object.freeze({
      x: Math.fround(viewportWidth / 16),
      y: 0,
    }),
  });

  return Object.freeze({
    body: Object.freeze({
      active: false,
      bodyType: 'static',
      box2dTypeCode: 0,
      bodyUserData: 'owner',
      creatorPositionWorldUnits: Object.freeze({
        x: Math.fround(viewportWidth / 2),
        y: Math.fround(viewportHeight / 4),
      }),
      positionMetres: Object.freeze({
        x: Math.fround(viewportWidth / 64),
        y: Math.fround(viewportHeight / 128),
      }),
    }),
    compatibilityStatus: 'unresolved',
    instantiable: false,
    kind: 'electric-field',
    nodeTag: ELECTRIC_FIELD_NODE_TAG,
    nominalFixture: createFixture(nominalShape, ELECTRIC_COLLISION_FILTER),
    unresolvedReasons: ELECTRIC_UNRESOLVED_REASONS,
  });
}

/** Standard Box2D shared-group precedence, then bilateral mask acceptance. */
export function evaluateContactFilter(
  filterA: CollisionFilterData,
  filterB: CollisionFilterData,
): ContactFilterDecision {
  assertCollisionFilter(filterA, 'filterA');
  assertCollisionFilter(filterB, 'filterB');

  if (filterA.groupIndex !== 0 && filterA.groupIndex === filterB.groupIndex) {
    return Object.freeze({
      collides: filterA.groupIndex > 0,
      rule: 'shared-group',
      sharedGroupIndex: filterA.groupIndex,
    });
  }

  const aAcceptsB = (filterA.maskBits & filterB.categoryBits) !== 0;
  const bAcceptsA = (filterB.maskBits & filterA.categoryBits) !== 0;
  return Object.freeze({
    aAcceptsB,
    bAcceptsA,
    collides: aAcceptsB && bAcceptsA,
    rule: 'bilateral-masks',
  });
}

export function evaluateClassicContactPair(
  fixtureA: ClassicFixtureKind,
  fixtureB: ClassicFixtureKind,
): ContactFilterDecision {
  return evaluateContactFilter(
    collisionFilterForKind(fixtureA),
    collisionFilterForKind(fixtureB),
  );
}

function createFruitBoxShape(spriteWidth: number, spriteHeight: number): FixtureShape {
  return Object.freeze({
    type: 'box',
    centerMetres: ZERO_VECTOR,
    creatorSizeWorldUnits: Object.freeze({
      height: Math.fround(2 * spriteHeight),
      width: Math.fround(2 * spriteWidth),
    }),
    halfExtentsMetres: Object.freeze({
      x: Math.fround(spriteWidth / LEGACY_WORLD_UNITS_PER_METRE),
      y: Math.fround(spriteHeight / LEGACY_WORLD_UNITS_PER_METRE),
    }),
  });
}

function createFruitCircleShape(spriteWidth: number, spriteHeight: number): FixtureShape {
  const combinedDimensions = Math.fround(spriteWidth + spriteHeight);
  return Object.freeze({
    type: 'circle',
    centerMetres: ZERO_VECTOR,
    creatorRadiusWorldUnits: Math.fround(combinedDimensions / 4),
    radiusMetres: Math.fround(combinedDimensions / 128),
  });
}

function createFixture(
  shape: FixtureShape,
  filter: CollisionFilterData,
): ClassicFixtureDefinition {
  return Object.freeze({
    density: 1,
    filter,
    fixtureUserData: null,
    friction: RECOVERED_FRICTION,
    restitution: 0,
    sensor: false,
    shape,
  });
}

function createDynamicBody(
  positionMetres: FixtureVector2,
  creatorPositionWorldUnits: FixtureVector2,
): DynamicBodyInitialState {
  return Object.freeze({
    active: true,
    allowSleep: true,
    angleRadians: 0,
    angularDamping: 0,
    angularVelocityRadiansPerSecond: 0,
    awake: true,
    bodyType: 'dynamic',
    box2dTypeCode: 2,
    bodyUserData: 'owner',
    bullet: false,
    creatorPositionWorldUnits,
    fixedRotation: false,
    gravityScale: 1,
    linearDamping: 0,
    linearVelocityMetresPerSecond: ZERO_VECTOR,
    positionMetres,
  });
}

function collisionFilterForKind(kind: ClassicFixtureKind): CollisionFilterData {
  if (kind === 'fruit') {
    return FRUIT_COLLISION_FILTER;
  }
  if (kind === 'bomb') {
    return BOMB_COLLISION_FILTER;
  }
  if (kind === 'electric') {
    return ELECTRIC_COLLISION_FILTER;
  }
  throw new RangeError('fixture kind must be fruit, bomb, or electric');
}

/** Target-only validation prevents malformed adapter data entering Box2D. */
function assertCollisionFilter(filter: CollisionFilterData, label: string): void {
  assertObject(filter, label);
  assertIntegerInRange(filter.categoryBits, 0, 0xffff, `${label}.categoryBits`);
  assertIntegerInRange(filter.maskBits, 0, 0xffff, `${label}.maskBits`);
  assertIntegerInRange(filter.groupIndex, -0x8000, 0x7fff, `${label}.groupIndex`);
}

function assertIntegerInRange(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer from ${minimum} through ${maximum}`);
  }
}

function toPositiveFloat32(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be positive and finite`);
  }
  const floatValue = Math.fround(value);
  if (!Number.isFinite(floatValue) || floatValue <= 0) {
    throw new RangeError(`${label} must fit a positive float32 value`);
  }
  return floatValue;
}

function assertObject(value: object, label: string): void {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
}
