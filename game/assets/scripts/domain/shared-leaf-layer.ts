/**
 * Pure recovered model for the shared GameScene LeafLayer.
 *
 * The app-owned evidence bounds the call to `b2World::Step(dt, 5, 5)`, but not the
 * bundled Box2D solver's internal arithmetic. This module therefore owns the recovered
 * state, random placement, display synchronization, and frame ordering while delegating
 * the world step through an explicit port.
 */

import type { GameplayRandom } from './gameplay-random';

export type SharedLeafAssetTree = '480x800' | '720x1280';
export type SharedLeafId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface SharedLeafPoint {
  readonly x: number;
  readonly y: number;
}

export interface SharedLeafSize {
  readonly height: number;
  readonly width: number;
}

export interface SharedLeafVisibleGrid {
  readonly bottomYWorldUnits: number;
  readonly heightWorldUnits: number;
  readonly randomXMaximumInclusive: number;
  readonly randomXMinimumInclusive: 10;
  readonly randomYMaximumInclusive: number;
  readonly randomYMinimumInclusive: number;
  readonly respawnBelowWorldY: number;
  readonly topYWorldUnits: number;
  readonly widthWorldUnits: number;
}

export interface SharedLeafVisibleBounds {
  readonly bottomYWorldUnits: number;
  readonly heightWorldUnits: number;
  readonly topYWorldUnits: number;
  readonly widthWorldUnits: number;
}

export interface SharedLeafAssetDefinition {
  readonly byteLength: number;
  readonly fixtureHalfExtentsMetres: SharedLeafPoint;
  readonly heightWorldUnits: number;
  readonly leafId: SharedLeafId;
  readonly logicalPath: `Leaf/leave${SharedLeafId}.png`;
  readonly profilePath: `${SharedLeafAssetTree}/Leaf/leave${SharedLeafId}.png`;
  readonly sha256: string;
  readonly slotIndex: number;
  readonly widthWorldUnits: number;
}

export interface SharedLeafAssetProfile {
  readonly assetTree: SharedLeafAssetTree;
  readonly designSizeWorldUnits: SharedLeafSize;
  readonly leaves: readonly SharedLeafAssetDefinition[];
  readonly visibleGrid: SharedLeafVisibleGrid;
}

export interface SharedLeafBodyState {
  readonly angleRadians: number;
  readonly angularVelocityRadiansPerSecond: number;
  readonly awake: boolean;
  readonly linearVelocityMetresPerSecond: SharedLeafPoint;
  readonly positionMetres: SharedLeafPoint;
}

export interface SharedLeafBodyDefaults extends SharedLeafBodyState {
  readonly active: true;
  readonly allowSleep: true;
  readonly angularDamping: 0;
  readonly bodyType: 'dynamic';
  readonly box2dTypeCode: 2;
  readonly bullet: false;
  readonly fixedRotation: false;
  readonly gravityScale: 1;
  readonly linearDamping: 0;
}

export interface SharedLeafFixtureDefaults {
  readonly density: 1;
  readonly filter: Readonly<{
    readonly categoryBits: 0;
    readonly groupIndex: 0;
    readonly maskBits: 0xffff;
  }>;
  readonly fixtureUserData: null;
  readonly friction: number;
  readonly restitution: 0;
  readonly sensor: false;
  readonly shapeType: 'box';
}

export interface SharedLeafWorldConfiguration {
  readonly allowSleep: true;
  readonly continuousPhysics: true;
  readonly gravityMetresPerSecondSquared: SharedLeafPoint;
  readonly positionIterations: 5;
  readonly velocityIterations: 5;
}

export interface SharedLeafDisplayState {
  readonly opacity: 32;
  readonly positionWorldUnits: SharedLeafPoint;
  readonly rotationDegrees: number;
}

export interface SharedLeafSlotSnapshot {
  readonly asset: SharedLeafAssetDefinition;
  readonly body: SharedLeafBodyState;
  readonly display: SharedLeafDisplayState;
  readonly slotIndex: number;
}

export interface SharedLeafLayerSnapshot {
  readonly profile: SharedLeafAssetProfile;
  readonly slots: readonly SharedLeafSlotSnapshot[];
  readonly visibleGrid: SharedLeafVisibleGrid;
}

export type SharedLeafRandom = Pick<GameplayRandom, 'nextIntInclusive'>;

export interface SharedLeafPhysicsBodyInput {
  readonly body: SharedLeafBodyState;
  readonly slotIndex: number;
}

export interface SharedLeafWorldStepCommand {
  readonly bodies: readonly SharedLeafPhysicsBodyInput[];
  readonly deltaSeconds: number;
  readonly type: 'step-shared-leaf-world';
  readonly world: SharedLeafWorldConfiguration;
}

export interface SharedLeafPhysicsBodyResult {
  readonly body: SharedLeafBodyState;
  readonly slotIndex: number;
}

export interface SharedLeafWakeIfSleepingOperation {
  readonly type: 'wake-if-sleeping';
}

export interface SharedLeafAddAngularVelocityOperation {
  readonly deltaRadiansPerSecond: number;
  readonly type: 'add-angular-velocity';
}

export interface SharedLeafSetTransformOperation {
  readonly angleRadians: number;
  readonly positionMetres: SharedLeafPoint;
  readonly type: 'set-transform';
}

export interface SharedLeafSetLinearVelocityOperation {
  readonly type: 'set-linear-velocity';
  readonly velocityMetresPerSecond: SharedLeafPoint;
}

/** Exact recovered post-step mutation order for one child `RandomPosition` call. */
export type SharedLeafRespawnOperations = readonly [
  SharedLeafWakeIfSleepingOperation,
  SharedLeafAddAngularVelocityOperation,
  SharedLeafSetTransformOperation,
  SharedLeafSetLinearVelocityOperation,
];

export interface SharedLeafRespawnCommand {
  readonly operations: SharedLeafRespawnOperations;
  readonly slotIndex: number;
  readonly type: 'respawn-shared-leaf-body';
}

/**
 * Adapter boundary for the recovered `b2World::Step(dt, 5, 5)` call.
 *
 * Command bodies are the authoritative pre-step states, including any prior respawn.
 * Implementations must return one complete post-step body per slot in creation order, then
 * synchronously apply every respawn command in the supplied operation order. Respawn callbacks
 * occur after the world step, in child creation order, and before display-state mapping. The
 * model validates the entire step result before issuing any respawn command or committing state.
 */
export interface SharedLeafPhysicsStepPort {
  applyRespawn(command: SharedLeafRespawnCommand): void;
  step(command: SharedLeafWorldStepCommand): readonly SharedLeafPhysicsBodyResult[];
}

export interface SharedLeafFrameResult {
  readonly respawnCommands: readonly SharedLeafRespawnCommand[];
  readonly respawnedSlotIndices: readonly number[];
  readonly snapshot: SharedLeafLayerSnapshot;
  readonly stepCommand: SharedLeafWorldStepCommand;
}

export interface SharedLeafLayerOptions {
  readonly assetTree: SharedLeafAssetTree;
  readonly random: SharedLeafRandom;
  readonly visibleBounds?: SharedLeafVisibleBounds;
}

export const SHARED_LEAF_SLOT_COUNT = 7;
export const SHARED_LEAF_WORLD_UNITS_PER_METRE = 32;
export const SHARED_LEAF_SPRITE_OPACITY = 32 as const;
export const SHARED_LEAF_RANDOM_X_MARGIN_WORLD_UNITS = 10;
export const SHARED_LEAF_RANDOM_Y_MARGIN_WORLD_UNITS = 50;
export const SHARED_LEAF_RESPAWN_MARGIN_WORLD_UNITS = 100;
export const SHARED_LEAF_ANGULAR_INCREMENT_MINIMUM = -25;
export const SHARED_LEAF_ANGULAR_INCREMENT_MAXIMUM = 25;
export const SHARED_LEAF_ROTATION_DEGREES_PER_RADIAN = Math.fround(57.29578);

export const SHARED_LEAF_CREATION_ORDER: readonly `leave${SharedLeafId}`[] = Object.freeze([
  'leave7',
  'leave1',
  'leave2',
  'leave3',
  'leave4',
  'leave5',
  'leave6',
]);

const ZERO_POINT: SharedLeafPoint = Object.freeze({ x: 0, y: 0 });

export const SHARED_LEAF_BODY_DEFAULTS: SharedLeafBodyDefaults = Object.freeze({
  active: true,
  allowSleep: true,
  angleRadians: 0,
  angularDamping: 0,
  angularVelocityRadiansPerSecond: 0,
  awake: true,
  bodyType: 'dynamic',
  box2dTypeCode: 2,
  bullet: false,
  fixedRotation: false,
  gravityScale: 1,
  linearDamping: 0,
  linearVelocityMetresPerSecond: ZERO_POINT,
  positionMetres: ZERO_POINT,
});

export const SHARED_LEAF_FIXTURE_DEFAULTS: SharedLeafFixtureDefaults = Object.freeze({
  density: 1,
  filter: Object.freeze({
    categoryBits: 0,
    groupIndex: 0,
    maskBits: 0xffff,
  }),
  fixtureUserData: null,
  friction: Math.fround(0.5),
  restitution: 0,
  sensor: false,
  shapeType: 'box',
});

export const SHARED_LEAF_WORLD_CONFIGURATION: SharedLeafWorldConfiguration = Object.freeze({
  allowSleep: true,
  continuousPhysics: true,
  gravityMetresPerSecondSquared: Object.freeze({
    x: 0,
    y: Math.fround(-0.15),
  }),
  positionIterations: 5,
  velocityIterations: 5,
});

interface LeafAssetRow {
  readonly byteLength: number;
  readonly heightWorldUnits: number;
  readonly leafId: SharedLeafId;
  readonly sha256: string;
  readonly widthWorldUnits: number;
}

interface SharedLeafRandomPositionDraw {
  readonly angularIncrementRadiansPerSecond: number;
  readonly positionMetres: SharedLeafPoint;
}

const LEAF_ASSET_ROWS: readonly LeafAssetRow[] = Object.freeze([
  Object.freeze({
    byteLength: 5506,
    heightWorldUnits: 71,
    leafId: 7,
    sha256: '81e0350dbab6ce33a172bdb30549e57f8dec687c432168e97d66ca404f0c1359',
    widthWorldUnits: 75,
  }),
  Object.freeze({
    byteLength: 3515,
    heightWorldUnits: 79,
    leafId: 1,
    sha256: '64a7a8d44208ed22bf14c903b0e1faf8264aec9dfdc1eb8dfc0fa22b001a1bfa',
    widthWorldUnits: 84,
  }),
  Object.freeze({
    byteLength: 4415,
    heightWorldUnits: 64,
    leafId: 2,
    sha256: '994bcebea40a2e375a6d4ba9119c7ab256323041777ce5900b39dd24588edf9e',
    widthWorldUnits: 69,
  }),
  Object.freeze({
    byteLength: 7136,
    heightWorldUnits: 91,
    leafId: 3,
    sha256: 'cfc6f0b49b0461a3cb49fb10e822f909701cc5f282e18d7670f82176ac0c066d',
    widthWorldUnits: 51,
  }),
  Object.freeze({
    byteLength: 3815,
    heightWorldUnits: 71,
    leafId: 4,
    sha256: 'c091aace9ebe3038d51a975584e3845fd65a17d7574e6087b90eadfe8bee2846',
    widthWorldUnits: 74,
  }),
  Object.freeze({
    byteLength: 3992,
    heightWorldUnits: 69,
    leafId: 5,
    sha256: 'afce7fbd41f9be4c06d84244714ce76d474994829aa78d84612156b42184dd34',
    widthWorldUnits: 79,
  }),
  Object.freeze({
    byteLength: 5069,
    heightWorldUnits: 70,
    leafId: 6,
    sha256: 'd51294f17f57343b045d0ee0692c88970c5a26d2b631ccde5101c07c093de1ff',
    widthWorldUnits: 66,
  }),
]);

export const SHARED_LEAF_ASSET_PROFILES: Readonly<
  Record<SharedLeafAssetTree, SharedLeafAssetProfile>
> = Object.freeze({
  '480x800': createAssetProfile('480x800', 480, 800),
  '720x1280': createAssetProfile('720x1280', 720, 1280),
});

export function getSharedLeafAssetProfile(
  assetTree: SharedLeafAssetTree,
): SharedLeafAssetProfile {
  if (assetTree !== '480x800' && assetTree !== '720x1280') {
    throw new RangeError('assetTree must be 480x800 or 720x1280');
  }
  return SHARED_LEAF_ASSET_PROFILES[assetTree];
}

/** Recovered C++ integer division used after each RandomPosition coordinate draw. */
export function sharedLeafRandomCoordinateToMetres(worldUnits: number): number {
  if (!Number.isSafeInteger(worldUnits)) {
    throw new TypeError('random coordinate must be a safe integer');
  }
  return integerDivideTowardZero(worldUnits, SHARED_LEAF_WORLD_UNITS_PER_METRE);
}

/** Derives the recovered inclusive RandomPosition and respawn bounds from W/H/T/B. */
export function createSharedLeafVisibleGrid(
  bounds: SharedLeafVisibleBounds,
): SharedLeafVisibleGrid {
  assertObject(bounds, 'visibleBounds');
  const width = toPositiveFloat32(bounds.widthWorldUnits, 'visibleBounds.widthWorldUnits');
  const height = toPositiveFloat32(bounds.heightWorldUnits, 'visibleBounds.heightWorldUnits');
  const topY = toFiniteFloat32(bounds.topYWorldUnits, 'visibleBounds.topYWorldUnits');
  const bottomY = toFiniteFloat32(bounds.bottomYWorldUnits, 'visibleBounds.bottomYWorldUnits');
  const randomXMaximumInclusive = Math.trunc(subtractFloat32(width, 10));
  const randomYMinimumInclusive = Math.trunc(addFloat32(topY, 50));
  const randomYMaximumInclusive = Math.trunc(addFloat32(topY, height));
  assertSafeInclusiveRange(10, randomXMaximumInclusive, 'leaf random X');
  assertSafeInclusiveRange(
    randomYMinimumInclusive,
    randomYMaximumInclusive,
    'leaf random Y',
  );

  return Object.freeze({
    bottomYWorldUnits: bottomY,
    heightWorldUnits: height,
    randomXMaximumInclusive,
    randomXMinimumInclusive: 10,
    randomYMaximumInclusive,
    randomYMinimumInclusive,
    respawnBelowWorldY: subtractFloat32(bottomY, 100),
    topYWorldUnits: topY,
    widthWorldUnits: width,
  });
}

/**
 * Stateful seven-slot model with immutable snapshots and transactional local-state commits.
 * Injected RNG consumption and a stateful port cannot be rolled back after they return malformed
 * data; adapters must treat such contract violations as fatal and resynchronize from a snapshot.
 */
export class SharedLeafLayerModel {
  readonly profile: SharedLeafAssetProfile;
  readonly visibleGrid: SharedLeafVisibleGrid;
  private readonly random: SharedLeafRandom;
  private frameMutationInProgress = false;
  private slotsValue: readonly SharedLeafSlotSnapshot[];

  constructor(options: SharedLeafLayerOptions) {
    assertObject(options, 'options');
    const profile = getSharedLeafAssetProfile(options.assetTree);
    assertRandom(options.random);
    const visibleGrid = options.visibleBounds === undefined
      ? profile.visibleGrid
      : createSharedLeafVisibleGrid(options.visibleBounds);

    const initialSlots = profile.leaves.map((asset, slotIndex) => {
      const defaultBody = bodyStateFromDefaults();
      const draw = drawRandomPosition(visibleGrid, options.random);
      const body = applyRandomPositionDraw(defaultBody, draw);
      return freezeSlot({
        asset,
        body,
        display: displayStateFromBody(body),
        slotIndex,
      });
    });

    this.profile = profile;
    this.random = options.random;
    this.slotsValue = Object.freeze(initialSlots);
    this.visibleGrid = visibleGrid;
  }

  snapshot(): SharedLeafLayerSnapshot {
    return Object.freeze({
      profile: this.profile,
      slots: this.slotsValue,
      visibleGrid: this.visibleGrid,
    });
  }

  /** Recovered RandomPosition mutation for one stable creation-order slot. */
  randomPosition(slotIndex: number): SharedLeafLayerSnapshot {
    this.assertMutationAvailable();
    assertSlotIndex(slotIndex);
    const current = this.slotsValue[slotIndex];
    if (current === undefined) {
      throw new RangeError(`leaf slot ${slotIndex} does not exist`);
    }

    const draw = drawRandomPosition(this.visibleGrid, this.random);
    const body = applyRandomPositionDraw(current.body, draw);
    const nextSlots = [...this.slotsValue];
    nextSlots[slotIndex] = freezeSlot({
      ...current,
      body,
      display: displayStateFromBody(body),
    });
    this.slotsValue = Object.freeze(nextSlots);
    return this.snapshot();
  }

  /**
   * Executes the recovered parent-step then child-update traversal.
   *
   * Each child tests its post-step body and randomizes strictly below the lower margin. The
   * later render traversal then synchronizes from the final body, so a respawn is visible in
   * the same rendered frame.
   */
  stepFrame(
    deltaSeconds: number,
    physics: SharedLeafPhysicsStepPort,
  ): SharedLeafFrameResult {
    this.assertMutationAvailable();
    const normalizedDelta = toFiniteNonNegativeFloat32(deltaSeconds, 'deltaSeconds');
    assertPhysicsPort(physics);

    this.frameMutationInProgress = true;
    try {
      const stepCommand = createWorldStepCommand(normalizedDelta, this.slotsValue);
      const postStepResults = normalizePhysicsResults(physics.step(stepCommand));
      const postChildBodies: SharedLeafBodyState[] = [];
      const respawnCommands: SharedLeafRespawnCommand[] = [];
      const respawnedSlotIndices: number[] = [];

      for (let slotIndex = 0; slotIndex < SHARED_LEAF_SLOT_COUNT; slotIndex += 1) {
        const result = postStepResults[slotIndex];
        if (result === undefined) {
          throw new Error(`leaf slot ${slotIndex} disappeared during frame preparation`);
        }

        let body = result.body;
        if (bodyWorldY(body) < this.visibleGrid.respawnBelowWorldY) {
          const draw = drawRandomPosition(this.visibleGrid, this.random);
          const respawnCommand = createRespawnCommand(slotIndex, body, draw);
          physics.applyRespawn(respawnCommand);
          body = applyRandomPositionDraw(body, draw);
          respawnCommands.push(respawnCommand);
          respawnedSlotIndices.push(slotIndex);
        }
        postChildBodies.push(body);
      }

      const nextSlots = postChildBodies.map((body, slotIndex) => {
        const current = this.slotsValue[slotIndex];
        if (current === undefined) {
          throw new Error(`leaf slot ${slotIndex} disappeared before render synchronization`);
        }
        return freezeSlot({
          asset: current.asset,
          body,
          display: displayStateFromBody(body),
          slotIndex,
        });
      });

      this.slotsValue = Object.freeze(nextSlots);
      const snapshot = this.snapshot();
      return Object.freeze({
        respawnCommands: Object.freeze(respawnCommands),
        respawnedSlotIndices: Object.freeze(respawnedSlotIndices),
        snapshot,
        stepCommand,
      });
    } finally {
      this.frameMutationInProgress = false;
    }
  }

  private assertMutationAvailable(): void {
    if (this.frameMutationInProgress) {
      throw new Error('Shared Leaf model mutation cannot be re-entered during stepFrame');
    }
  }
}

function createAssetProfile(
  assetTree: SharedLeafAssetTree,
  designWidth: number,
  designHeight: number,
): SharedLeafAssetProfile {
  const visibleGrid = createVisibleGrid(designWidth, designHeight);
  const leaves = LEAF_ASSET_ROWS.map((row, slotIndex): SharedLeafAssetDefinition => {
    const logicalPath = `Leaf/leave${row.leafId}.png` as const;
    return Object.freeze({
      byteLength: row.byteLength,
      fixtureHalfExtentsMetres: frozenPoint(
        divideFloat32(row.widthWorldUnits, 64),
        divideFloat32(row.heightWorldUnits, 64),
      ),
      heightWorldUnits: row.heightWorldUnits,
      leafId: row.leafId,
      logicalPath,
      profilePath: `${assetTree}/${logicalPath}`,
      sha256: row.sha256,
      slotIndex,
      widthWorldUnits: row.widthWorldUnits,
    });
  });

  return Object.freeze({
    assetTree,
    designSizeWorldUnits: Object.freeze({ height: designHeight, width: designWidth }),
    leaves: Object.freeze(leaves),
    visibleGrid,
  });
}

function createVisibleGrid(width: number, height: number): SharedLeafVisibleGrid {
  return createSharedLeafVisibleGrid({
    bottomYWorldUnits: 0,
    heightWorldUnits: height,
    topYWorldUnits: height,
    widthWorldUnits: width,
  });
}

function createWorldStepCommand(
  deltaSeconds: number,
  slots: readonly SharedLeafSlotSnapshot[],
): SharedLeafWorldStepCommand {
  const bodies = slots.map(({ body, slotIndex }) => Object.freeze({
    body: copyBodyState(body),
    slotIndex,
  }));
  return Object.freeze({
    bodies: Object.freeze(bodies),
    deltaSeconds,
    type: 'step-shared-leaf-world',
    world: SHARED_LEAF_WORLD_CONFIGURATION,
  });
}

function normalizePhysicsResults(
  results: readonly SharedLeafPhysicsBodyResult[],
): readonly SharedLeafPhysicsBodyResult[] {
  if (!Array.isArray(results)) {
    throw new TypeError('physics step results must be an array');
  }
  if (results.length !== SHARED_LEAF_SLOT_COUNT) {
    throw new RangeError(`physics step must return exactly ${SHARED_LEAF_SLOT_COUNT} bodies`);
  }

  const normalized: SharedLeafPhysicsBodyResult[] = [];
  for (
    let expectedSlotIndex = 0;
    expectedSlotIndex < SHARED_LEAF_SLOT_COUNT;
    expectedSlotIndex += 1
  ) {
    const result = results[expectedSlotIndex];
    if (result === undefined) {
      throw new TypeError(`physics result ${expectedSlotIndex} must be present`);
    }
    assertObject(result, `physics result ${expectedSlotIndex}`);
    if (result.slotIndex !== expectedSlotIndex) {
      throw new RangeError('physics step results must preserve creation-order slot indices');
    }
    normalized.push(Object.freeze({
      body: normalizeBodyState(result.body, `physics result ${expectedSlotIndex}.body`),
      slotIndex: expectedSlotIndex,
    }));
  }
  return Object.freeze(normalized);
}

function drawRandomPosition(
  grid: SharedLeafVisibleGrid,
  random: SharedLeafRandom,
): SharedLeafRandomPositionDraw {
  const xWorldUnits = drawInclusive(
    random,
    grid.randomXMinimumInclusive,
    grid.randomXMaximumInclusive,
  );
  const yWorldUnits = drawInclusive(
    random,
    grid.randomYMinimumInclusive,
    grid.randomYMaximumInclusive,
  );
  const angularIncrement = drawInclusive(
    random,
    SHARED_LEAF_ANGULAR_INCREMENT_MINIMUM,
    SHARED_LEAF_ANGULAR_INCREMENT_MAXIMUM,
  );

  return Object.freeze({
    angularIncrementRadiansPerSecond: Math.fround(angularIncrement),
    positionMetres: frozenPoint(
      sharedLeafRandomCoordinateToMetres(xWorldUnits),
      sharedLeafRandomCoordinateToMetres(yWorldUnits),
    ),
  });
}

function applyRandomPositionDraw(
  current: SharedLeafBodyState,
  draw: SharedLeafRandomPositionDraw,
): SharedLeafBodyState {
  return freezeBodyState({
    angleRadians: current.angleRadians,
    angularVelocityRadiansPerSecond: addFloat32(
      current.angularVelocityRadiansPerSecond,
      draw.angularIncrementRadiansPerSecond,
    ),
    awake: true,
    linearVelocityMetresPerSecond: ZERO_POINT,
    positionMetres: draw.positionMetres,
  });
}

function createRespawnCommand(
  slotIndex: number,
  current: SharedLeafBodyState,
  draw: SharedLeafRandomPositionDraw,
): SharedLeafRespawnCommand {
  const operations: SharedLeafRespawnOperations = Object.freeze([
    Object.freeze({ type: 'wake-if-sleeping' }),
    Object.freeze({
      deltaRadiansPerSecond: draw.angularIncrementRadiansPerSecond,
      type: 'add-angular-velocity',
    }),
    Object.freeze({
      angleRadians: current.angleRadians,
      positionMetres: draw.positionMetres,
      type: 'set-transform',
    }),
    Object.freeze({
      type: 'set-linear-velocity',
      velocityMetresPerSecond: ZERO_POINT,
    }),
  ]);
  return Object.freeze({
    operations,
    slotIndex,
    type: 'respawn-shared-leaf-body',
  });
}

function displayStateFromBody(body: SharedLeafBodyState): SharedLeafDisplayState {
  return Object.freeze({
    opacity: SHARED_LEAF_SPRITE_OPACITY,
    positionWorldUnits: frozenPoint(
      multiplyFloat32(body.positionMetres.x, SHARED_LEAF_WORLD_UNITS_PER_METRE),
      multiplyFloat32(body.positionMetres.y, SHARED_LEAF_WORLD_UNITS_PER_METRE),
    ),
    rotationDegrees: Math.fround(
      -multiplyFloat32(body.angleRadians, SHARED_LEAF_ROTATION_DEGREES_PER_RADIAN),
    ),
  });
}

function bodyWorldY(body: SharedLeafBodyState): number {
  return multiplyFloat32(body.positionMetres.y, SHARED_LEAF_WORLD_UNITS_PER_METRE);
}

function bodyStateFromDefaults(): SharedLeafBodyState {
  return freezeBodyState({
    angleRadians: SHARED_LEAF_BODY_DEFAULTS.angleRadians,
    angularVelocityRadiansPerSecond:
      SHARED_LEAF_BODY_DEFAULTS.angularVelocityRadiansPerSecond,
    awake: SHARED_LEAF_BODY_DEFAULTS.awake,
    linearVelocityMetresPerSecond:
      SHARED_LEAF_BODY_DEFAULTS.linearVelocityMetresPerSecond,
    positionMetres: SHARED_LEAF_BODY_DEFAULTS.positionMetres,
  });
}

function normalizeBodyState(body: SharedLeafBodyState, label: string): SharedLeafBodyState {
  assertObject(body, label);
  if (typeof body.awake !== 'boolean') {
    throw new TypeError(`${label}.awake must be a boolean`);
  }
  return freezeBodyState({
    angleRadians: toFiniteFloat32(body.angleRadians, `${label}.angleRadians`),
    angularVelocityRadiansPerSecond: toFiniteFloat32(
      body.angularVelocityRadiansPerSecond,
      `${label}.angularVelocityRadiansPerSecond`,
    ),
    awake: body.awake,
    linearVelocityMetresPerSecond: normalizePoint(
      body.linearVelocityMetresPerSecond,
      `${label}.linearVelocityMetresPerSecond`,
    ),
    positionMetres: normalizePoint(body.positionMetres, `${label}.positionMetres`),
  });
}

function copyBodyState(body: SharedLeafBodyState): SharedLeafBodyState {
  return freezeBodyState({
    angleRadians: body.angleRadians,
    angularVelocityRadiansPerSecond: body.angularVelocityRadiansPerSecond,
    awake: body.awake,
    linearVelocityMetresPerSecond: frozenPoint(
      body.linearVelocityMetresPerSecond.x,
      body.linearVelocityMetresPerSecond.y,
    ),
    positionMetres: frozenPoint(body.positionMetres.x, body.positionMetres.y),
  });
}

function freezeBodyState(body: SharedLeafBodyState): SharedLeafBodyState {
  return Object.freeze({
    angleRadians: body.angleRadians,
    angularVelocityRadiansPerSecond: body.angularVelocityRadiansPerSecond,
    awake: body.awake,
    linearVelocityMetresPerSecond: body.linearVelocityMetresPerSecond,
    positionMetres: body.positionMetres,
  });
}

function freezeSlot(slot: SharedLeafSlotSnapshot): SharedLeafSlotSnapshot {
  return Object.freeze({
    asset: slot.asset,
    body: slot.body,
    display: slot.display,
    slotIndex: slot.slotIndex,
  });
}

function normalizePoint(point: SharedLeafPoint, label: string): SharedLeafPoint {
  assertObject(point, label);
  return frozenPoint(
    toFiniteFloat32(point.x, `${label}.x`),
    toFiniteFloat32(point.y, `${label}.y`),
  );
}

function frozenPoint(x: number, y: number): SharedLeafPoint {
  return Object.freeze({ x: Math.fround(x), y: Math.fround(y) });
}

function drawInclusive(
  random: SharedLeafRandom,
  minimumInclusive: number,
  maximumInclusive: number,
): number {
  const value = random.nextIntInclusive(minimumInclusive, maximumInclusive);
  if (!Number.isSafeInteger(value)) {
    throw new TypeError('nextIntInclusive() must return a safe integer');
  }
  if (value < minimumInclusive || value > maximumInclusive) {
    throw new RangeError(
      `nextIntInclusive() returned ${value} outside [${minimumInclusive}, ${maximumInclusive}]`,
    );
  }
  return value;
}

function integerDivideTowardZero(dividend: number, divisor: number): number {
  const quotient = Math.trunc(dividend / divisor);
  return quotient === 0 ? 0 : Math.fround(quotient);
}

function addFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) + Math.fround(right));
}

function subtractFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) - Math.fround(right));
}

function multiplyFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) * Math.fround(right));
}

function divideFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) / Math.fround(right));
}

function toFiniteFloat32(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
  const floatValue = Math.fround(value);
  if (!Number.isFinite(floatValue)) {
    throw new RangeError(`${label} must fit in float32`);
  }
  return floatValue;
}

function toFiniteNonNegativeFloat32(value: number, label: string): number {
  const floatValue = toFiniteFloat32(value, label);
  if (floatValue < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
  return floatValue;
}

function toPositiveFloat32(value: number, label: string): number {
  const floatValue = toFiniteFloat32(value, label);
  if (floatValue <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
  return floatValue;
}

function assertSafeInclusiveRange(minimum: number, maximum: number, label: string): void {
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum)) {
    throw new RangeError(`${label} bounds must be safe integers`);
  }
  if (minimum > maximum) {
    throw new RangeError(`${label} minimum must not exceed its maximum`);
  }
}

function assertSlotIndex(slotIndex: number): void {
  if (
    !Number.isSafeInteger(slotIndex)
    || slotIndex < 0
    || slotIndex >= SHARED_LEAF_SLOT_COUNT
  ) {
    throw new RangeError(`slotIndex must be an integer from 0 through ${SHARED_LEAF_SLOT_COUNT - 1}`);
  }
}

function assertRandom(random: SharedLeafRandom): void {
  if (
    random === null
    || typeof random !== 'object'
    || typeof random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive(minimum, maximum)');
  }
}

function assertPhysicsPort(physics: SharedLeafPhysicsStepPort): void {
  if (
    physics === null
    || typeof physics !== 'object'
    || typeof physics.applyRespawn !== 'function'
    || typeof physics.step !== 'function'
  ) {
    throw new TypeError('physics must provide step(command) and applyRespawn(command)');
  }
}

function assertObject(value: object, label: string): void {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
}
