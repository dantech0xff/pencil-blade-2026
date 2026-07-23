import type { ClassicCriticalParticleSpawnCommand } from './classic-critical-particle-plan';
import { createClassicCriticalParticleUpdateCommands } from './classic-critical-particle-plan';
import type { CutSegment } from './classic-cut-query';
import {
  FRUIT_COLLISION_FILTER,
  LEGACY_WORLD_UNITS_PER_METRE,
  type CollisionFilterData,
} from './classic-fixture-rules';
import {
  CRAZY_DRAGON_ACCEPTED_HIT_AUDIO_PATH,
  CRAZY_DRAGON_FINISH_AUDIO_PATH,
  CRAZY_DRAGON_HIT_MUSIC_AUDIO_PATH,
  type CrazyEffectAudioPath,
} from './crazy-audio-contract';
import {
  getCrazySupplementalRasterSet,
} from './crazy-resource-contract';
import type { GameAssetTree, GameRasterResource } from './game-resource-contract';
import type { GameplayRandom } from './gameplay-random';

export const CRAZY_DRAGON_FRUIT_ID = 15 as const;
export const CRAZY_DRAGON_FRUIT_Z_ORDER = 1 as const;
export const CRAZY_DRAGON_COUNTER_FONT_PATH = 'Fonts/Razing.ttf' as const;
export const CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS = Math.fround(2.1);
export const CRAZY_DRAGON_ACCEPTED_SPLASH_FADE_SECONDS = Math.fround(0.175);
export const CRAZY_DRAGON_COUNTER_PULSE_SECONDS = Math.fround(0.05);
export const CRAZY_DRAGON_COUNTER_FADE_SECONDS = Math.fround(1.5);
export const CRAZY_DRAGON_TERMINAL_PIECE_FADE_SECONDS = Math.fround(0.75);
export const CRAZY_DRAGON_POSITION_JITTER_WIDTH_SCALE = Math.fround(0.03);
export const CRAZY_DRAGON_COUNTER_INITIAL_SCALE = Math.fround(0.9);
export const CRAZY_DRAGON_TERMINAL_SPEED_SCALE = Math.fround(35);

export interface CrazyDragonPoint {
  readonly x: number;
  readonly y: number;
}

export interface CrazyDragonViewport {
  readonly height: number;
  readonly width: number;
}

export interface CrazyDragonFixtureConfiguration {
  readonly body: Readonly<{
    readonly active: true;
    readonly allowSleep: true;
    readonly angleRadians: 0;
    readonly angularDamping: 0;
    readonly angularVelocityRadiansPerSecond: 0;
    readonly awake: true;
    readonly bodyDefinitionUserData: null;
    readonly bodyType: 'dynamic';
    readonly bodyUserData: 'owner';
    readonly bullet: false;
    readonly creatorPositionWorldUnits: CrazyDragonPoint;
    readonly fixedRotation: false;
    readonly gravityScale: 1;
    readonly linearDamping: 0;
    readonly linearVelocityMetresPerSecond: CrazyDragonPoint;
    readonly positionMetres: CrazyDragonPoint;
  }>;
  readonly fixture: Readonly<{
    readonly density: 1;
    readonly filter: CollisionFilterData;
    readonly fixtureUserData: 'owner';
    readonly friction: number;
    readonly restitution: 0;
    readonly sensor: false;
    readonly shape: Readonly<{
      readonly centerMetres: CrazyDragonPoint;
      readonly creatorSizeWorldUnits: Readonly<{
        readonly height: number;
        readonly width: number;
      }>;
      readonly halfExtentsMetres: CrazyDragonPoint;
      readonly type: 'box';
    }>;
  }>;
  readonly fruitId: typeof CRAZY_DRAGON_FRUIT_ID;
  readonly kind: 'dragon-fruit';
}

export type CrazyDragonTerminalPieceKind =
  | 'top-left'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left';

export interface CrazyDragonTerminalPiecePlan {
  readonly angleRadians: number;
  readonly critical: true;
  readonly fadeActionSeconds: typeof CRAZY_DRAGON_TERMINAL_PIECE_FADE_SECONDS;
  readonly fixture: Readonly<{
    readonly density: 1;
    readonly filter: CollisionFilterData;
    readonly fixtureUserData: null;
    readonly friction: number;
    readonly restitution: 0;
    readonly sensor: false;
    readonly shape: Readonly<{
      readonly creatorSizeWorldUnits: Readonly<{
        readonly height: number;
        readonly width: number;
      }>;
      readonly halfExtentsMetres: CrazyDragonPoint;
      readonly type: 'box';
    }>;
  }>;
  readonly kind: CrazyDragonTerminalPieceKind;
  readonly linearVelocityMetresPerSecond: CrazyDragonPoint;
  readonly positionMetres: CrazyDragonPoint;
  readonly raster: GameRasterResource;
}

export type CrazyDragonFruitCommand =
  | Readonly<{
      readonly canonicalPath: CrazyEffectAudioPath;
      readonly loop: false;
      readonly type: 'play-effect';
    }>
  | Readonly<{ readonly type: 'freeze-body' }>
  | Readonly<{ readonly type: 'show-splash' }>
  | Readonly<{
      readonly delaySeconds: typeof CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS;
      readonly type: 'start-hit-finish-delay';
    }>
  | Readonly<{
      readonly anchor: Readonly<{ readonly x: -0.5; readonly y: 0.5 }>;
      readonly color: Readonly<{
        readonly blue: 64;
        readonly green: 128;
        readonly red: 255;
      }>;
      readonly fontCanonicalPath: typeof CRAZY_DRAGON_COUNTER_FONT_PATH;
      readonly fontSize: number;
      readonly positionWorldUnits: CrazyDragonPoint;
      readonly rotationDegrees: number;
      readonly text: '+0\nHITS';
      readonly type: 'create-hit-counter';
      readonly zOrder: 1;
    }>
  | Readonly<{
      readonly angleRadians: number;
      readonly positionMetres: CrazyDragonPoint;
      readonly type: 'set-body-transform';
    }>
  | Readonly<{
      readonly fadeSeconds: typeof CRAZY_DRAGON_ACCEPTED_SPLASH_FADE_SECONDS;
      readonly opacity: 255;
      readonly positionWorldUnits: CrazyDragonPoint;
      readonly rotationDegrees: number;
      readonly type: 'animate-accepted-splash';
    }>
  | Readonly<{
      readonly initialScale: typeof CRAZY_DRAGON_COUNTER_INITIAL_SCALE;
      readonly scaleSeconds: typeof CRAZY_DRAGON_COUNTER_PULSE_SECONDS;
      readonly targetScale: 1;
      readonly text: string;
      readonly type: 'animate-hit-counter';
    }>
  | Readonly<{
      readonly piece: CrazyDragonTerminalPiecePlan;
      readonly type: 'create-terminal-piece';
    }>
  | Readonly<{
      readonly acceptedHitCount: number;
      readonly type: 'notify-dragon-finished';
    }>
  | Readonly<{
      readonly type: 'defer-dispose-original';
    }>
  | Readonly<{
      readonly fadeSeconds: typeof CRAZY_DRAGON_COUNTER_FADE_SECONDS;
      readonly type: 'start-counter-fade';
    }>
  | Readonly<{
      readonly amount: 1;
      readonly eventId: 15;
      readonly type: 'process-objective';
    }>;

export interface CrazyDragonCutInput {
  readonly bodyPositionMetres: CrazyDragonPoint;
  readonly effectsEnabled: boolean;
  readonly logicalWidthWorldUnits: number;
  readonly segment: CutSegment;
}

export interface CrazyDragonCutResult {
  readonly accepted: boolean;
  readonly acceptedHitCount: number;
  readonly commands: readonly CrazyDragonFruitCommand[];
  readonly firstCut: boolean;
  readonly finished: boolean;
}

export interface CrazyDragonCompletionInput {
  readonly assetTree: GameAssetTree;
  readonly bodyAngleRadians: number;
  readonly bodyPositionMetres: CrazyDragonPoint;
  readonly effectsEnabled: boolean;
}

export interface CrazyDragonActionResult {
  readonly commands: readonly CrazyDragonFruitCommand[];
  readonly completedNow: boolean;
}

export interface CrazyDragonFruitStateSnapshot {
  readonly acceptedHitCount: number;
  readonly cachedHeightMetres: number;
  readonly cachedWidthMetres: number;
  readonly finished: boolean;
  readonly hitActionElapsedSeconds: number;
  readonly started: boolean;
}

const ZERO = frozenPoint(0, 0);
const NO_COMMANDS: readonly CrazyDragonFruitCommand[] = Object.freeze([]);
const RECOVERED_FRICTION = Math.fround(0.2);
const RADIANS_TO_DEGREES = Math.fround(180 / Math.PI);

/**
 * Exact dynamic body and oversized Box2D fixture created before Down spawn mutations.
 *
 * The box arguments recovered from `SetAsBox(w / 32, h / 32)` are half-extents. Creator
 * therefore receives a full collider size of `2w` by `2h`, not the visual sprite size.
 */
export function createCrazyDragonFixtureConfiguration(
  viewport: CrazyDragonViewport,
  spriteDimensions: Readonly<{ readonly height: number; readonly width: number }>,
): CrazyDragonFixtureConfiguration {
  const copiedViewport = copyViewport(viewport);
  assertObject(spriteDimensions, 'spriteDimensions');
  const width = toPositiveFloat32(spriteDimensions.width, 'spriteDimensions.width');
  const height = toPositiveFloat32(spriteDimensions.height, 'spriteDimensions.height');
  const positionMetres = frozenPoint(
    f32(f32(copiedViewport.width * f32(0.5)) / f32(LEGACY_WORLD_UNITS_PER_METRE)),
    f32(f32(copiedViewport.height * f32(1.25)) / f32(LEGACY_WORLD_UNITS_PER_METRE)),
  );

  return Object.freeze({
    body: Object.freeze({
      active: true,
      allowSleep: true,
      angleRadians: 0,
      angularDamping: 0,
      angularVelocityRadiansPerSecond: 0,
      awake: true,
      bodyDefinitionUserData: null,
      bodyType: 'dynamic',
      bodyUserData: 'owner',
      bullet: false,
      creatorPositionWorldUnits: frozenPoint(
        f32(positionMetres.x * f32(LEGACY_WORLD_UNITS_PER_METRE)),
        f32(positionMetres.y * f32(LEGACY_WORLD_UNITS_PER_METRE)),
      ),
      fixedRotation: false,
      gravityScale: 1,
      linearDamping: 0,
      linearVelocityMetresPerSecond: ZERO,
      positionMetres,
    }),
    fixture: Object.freeze({
      density: 1,
      filter: FRUIT_COLLISION_FILTER,
      fixtureUserData: 'owner',
      friction: RECOVERED_FRICTION,
      restitution: 0,
      sensor: false,
      shape: Object.freeze({
        centerMetres: ZERO,
        creatorSizeWorldUnits: Object.freeze({
          height: f32(height * f32(2)),
          width: f32(width * f32(2)),
        }),
        halfExtentsMetres: frozenPoint(
          f32(width / f32(LEGACY_WORLD_UNITS_PER_METRE)),
          f32(height / f32(LEGACY_WORLD_UNITS_PER_METRE)),
        ),
        type: 'box',
      }),
    }),
    fruitId: CRAZY_DRAGON_FRUIT_ID,
    kind: 'dragon-fruit',
  });
}

/**
 * Pure recovered DragonFruit cut state. Physics and Creator presentation are emitted as
 * ordered commands so the adapter can keep action time distinct from physics-step time.
 */
export class CrazyDragonFruitState {
  readonly cachedHeightMetres: number;
  readonly cachedWidthMetres: number;

  private acceptedHitCountValue = 0;
  private finishedValue = false;
  private hitActionElapsedSecondsValue = 0;
  private startedValue = false;

  constructor(onEnterViewport: CrazyDragonViewport) {
    const viewport = copyViewport(onEnterViewport);
    this.cachedWidthMetres = f32(
      viewport.width / f32(LEGACY_WORLD_UNITS_PER_METRE),
    );
    this.cachedHeightMetres = f32(
      viewport.height / f32(LEGACY_WORLD_UNITS_PER_METRE),
    );
  }

  get acceptedHitCount(): number {
    return this.acceptedHitCountValue;
  }

  get finished(): boolean {
    return this.finishedValue;
  }

  get started(): boolean {
    return this.startedValue;
  }

  snapshot(): CrazyDragonFruitStateSnapshot {
    return Object.freeze({
      acceptedHitCount: this.acceptedHitCountValue,
      cachedHeightMetres: this.cachedHeightMetres,
      cachedWidthMetres: this.cachedWidthMetres,
      finished: this.finishedValue,
      hitActionElapsedSeconds: this.hitActionElapsedSecondsValue,
      started: this.startedValue,
    });
  }

  cut(
    input: CrazyDragonCutInput,
    random: Pick<GameplayRandom, 'nextIntInclusive'>,
  ): CrazyDragonCutResult {
    if (this.finishedValue) {
      return Object.freeze({
        accepted: false,
        acceptedHitCount: this.acceptedHitCountValue,
        commands: NO_COMMANDS,
        firstCut: false,
        finished: true,
      });
    }
    assertCutInput(input);
    assertRandom(random);

    const commands: CrazyDragonFruitCommand[] = [];
    const firstCut = !this.startedValue;
    const bodyPosition = copyFloat32Point(
      input.bodyPositionMetres,
      'bodyPositionMetres',
    );

    if (firstCut) {
      this.startedValue = true;
      this.hitActionElapsedSecondsValue = 0;
      if (input.effectsEnabled) {
        commands.push(playEffect(CRAZY_DRAGON_HIT_MUSIC_AUDIO_PATH));
      }
      commands.push(
        Object.freeze({ type: 'freeze-body' }),
        Object.freeze({ type: 'show-splash' }),
        Object.freeze({
          delaySeconds: CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS,
          type: 'start-hit-finish-delay',
        }),
      );
      const counterRotation = drawInclusive(random, -30, 30);
      commands.push(Object.freeze({
        anchor: Object.freeze({ x: -0.5, y: 0.5 }),
        color: Object.freeze({ blue: 64, green: 128, red: 255 }),
        fontCanonicalPath: CRAZY_DRAGON_COUNTER_FONT_PATH,
        fontSize: createCounterFontSize(input.logicalWidthWorldUnits),
        positionWorldUnits: metresToWorldUnits(bodyPosition),
        rotationDegrees: f32(counterRotation),
        text: '+0\nHITS',
        type: 'create-hit-counter',
        zOrder: CRAZY_DRAGON_FRUIT_Z_ORDER,
      }));
    }

    const accepted = drawInclusive(random, 0, 1) === 0;
    if (!accepted) {
      return freezeCutResult(
        false,
        this.acceptedHitCountValue,
        commands,
        firstCut,
      );
    }

    this.acceptedHitCountValue += 1;

    // Native signed integer division happens before conversion. Every recovered draw is
    // strictly between -180 and 180, so the resulting transform angle is exactly zero.
    const deadAngleDraw = drawInclusive(random, -45, 45);
    const integerAngle = Math.trunc(deadAngleDraw / 180);
    const acceptedAngleRadians = integerAngle === 0 ? 0 : f32(integerAngle);
    const jitterRadius = createPositionJitterRadius(input.logicalWidthWorldUnits);
    const minimumJitter = jitterRadius === 0 ? 0 : -jitterRadius;
    const jitterX = drawInclusive(random, minimumJitter, jitterRadius);
    const jitterY = drawInclusive(random, minimumJitter, jitterRadius);
    const position = frozenPoint(
      f32(bodyPosition.x + f32(f32(jitterX) / f32(LEGACY_WORLD_UNITS_PER_METRE))),
      f32(bodyPosition.y + f32(f32(jitterY) / f32(LEGACY_WORLD_UNITS_PER_METRE))),
    );
    const clampedPosition = frozenPoint(
      position.x <= 0
        ? 0
        : position.x >= this.cachedWidthMetres
          ? this.cachedWidthMetres
          : position.x,
      position.y,
    );

    commands.push(Object.freeze({
      angleRadians: acceptedAngleRadians,
      positionMetres: clampedPosition,
      type: 'set-body-transform',
    }));
    if (input.effectsEnabled) {
      commands.push(playEffect(CRAZY_DRAGON_ACCEPTED_HIT_AUDIO_PATH));
    }
    commands.push(
      Object.freeze({
        fadeSeconds: CRAZY_DRAGON_ACCEPTED_SPLASH_FADE_SECONDS,
        opacity: 255,
        positionWorldUnits: metresToWorldUnits(clampedPosition),
        rotationDegrees: createSplashRotationDegrees(input.segment),
        type: 'animate-accepted-splash',
      }),
      Object.freeze({
        initialScale: CRAZY_DRAGON_COUNTER_INITIAL_SCALE,
        scaleSeconds: CRAZY_DRAGON_COUNTER_PULSE_SECONDS,
        targetScale: 1,
        text: `+${this.acceptedHitCountValue}\nHITS`,
        type: 'animate-hit-counter',
      }),
    );

    return freezeCutResult(
      true,
      this.acceptedHitCountValue,
      commands,
      firstCut,
    );
  }

  advanceAction(
    unscaledDeltaSeconds: number,
    completion: CrazyDragonCompletionInput,
  ): CrazyDragonActionResult {
    const delta = toNonNegativeFloat32(unscaledDeltaSeconds, 'unscaledDeltaSeconds');
    assertCompletionInput(completion);
    if (!this.startedValue || this.finishedValue) {
      return Object.freeze({ commands: NO_COMMANDS, completedNow: false });
    }

    this.hitActionElapsedSecondsValue = f32(
      this.hitActionElapsedSecondsValue + delta,
    );
    if (
      this.hitActionElapsedSecondsValue
      < CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS
    ) {
      return Object.freeze({ commands: NO_COMMANDS, completedNow: false });
    }

    this.finishedValue = true;
    const commands: CrazyDragonFruitCommand[] = [];
    for (const piece of createCrazyDragonTerminalPiecePlans(completion)) {
      commands.push(Object.freeze({ piece, type: 'create-terminal-piece' }));
    }
    commands.push(
      Object.freeze({
        acceptedHitCount: this.acceptedHitCountValue,
        type: 'notify-dragon-finished',
      }),
      Object.freeze({ type: 'defer-dispose-original' }),
    );
    if (completion.effectsEnabled) {
      commands.push(playEffect(CRAZY_DRAGON_FINISH_AUDIO_PATH));
    }
    commands.push(
      Object.freeze({
        fadeSeconds: CRAZY_DRAGON_COUNTER_FADE_SECONDS,
        type: 'start-counter-fade',
      }),
      Object.freeze({
        amount: 1,
        eventId: CRAZY_DRAGON_FRUIT_ID,
        type: 'process-objective',
      }),
    );
    return Object.freeze({
      commands: Object.freeze(commands),
      completedNow: true,
    });
  }
}

export function createCrazyDragonTerminalPiecePlans(
  input: CrazyDragonCompletionInput,
): readonly CrazyDragonTerminalPiecePlan[] {
  assertCompletionInput(input);
  const resources = getCrazySupplementalRasterSet(input.assetTree);
  const centre = copyFloat32Point(input.bodyPositionMetres, 'bodyPositionMetres');
  const angle = toFiniteFloat32(input.bodyAngleRadians, 'bodyAngleRadians');
  return Object.freeze([
    createTerminalPiecePlan('top-left', resources.dragonCutTopLeft, -1, 1, centre, angle),
    createTerminalPiecePlan('top-right', resources.dragonCutTopRight, 1, 1, centre, angle),
    createTerminalPiecePlan(
      'bottom-right',
      resources.dragonCutBottomRight,
      1,
      -1,
      centre,
      angle,
    ),
    createTerminalPiecePlan(
      'bottom-left',
      resources.dragonCutBottomLeft,
      -1,
      -1,
      centre,
      angle,
    ),
  ]);
}

/**
 * Preserves the critical piece's one-or-three shared-stream draws. The recovered final
 * rotation is evaluated but intentionally not reapplied to the particle position.
 */
export function createCrazyDragonCriticalPieceUpdateCommands(
  positionWorldUnits: CrazyDragonPoint,
  random: Pick<GameplayRandom, 'nextIntInclusive'>,
): readonly ClassicCriticalParticleSpawnCommand[] {
  const position = copyFloat32Point(positionWorldUnits, 'positionWorldUnits');
  assertRandom(random);
  let discardedRotationRadians: number | null = null;
  const recordingRandom = Object.freeze({
    nextIntInclusive(minimum: number, maximum: number): number {
      const value = random.nextIntInclusive(minimum, maximum);
      if (minimum === -10 && maximum === 10) {
        discardedRotationRadians = value;
      }
      return value;
    },
  });
  const commands = createClassicCriticalParticleUpdateCommands(true, recordingRandom);
  if (discardedRotationRadians !== null) {
    // Native calls VectorHelper::Rotate(r, position), then discards the result.
    rotateFloat32(f32(discardedRotationRadians), position);
  }
  return commands;
}

function createTerminalPiecePlan(
  kind: CrazyDragonTerminalPieceKind,
  raster: GameRasterResource,
  horizontalSign: -1 | 1,
  verticalSign: -1 | 1,
  centre: CrazyDragonPoint,
  angleRadians: number,
): CrazyDragonTerminalPiecePlan {
  const width = f32(raster.dimensions.width);
  const height = f32(raster.dimensions.height);
  const offset = frozenPoint(
    f32(f32(horizontalSign) * f32(width / f32(64))),
    f32(f32(verticalSign) * f32(height / f32(64))),
  );

  // Keep native Q-C and P-C cancellation. Replacing this with C + rotate(offset) changes
  // low bits for sufficiently large centres.
  const q = frozenPoint(
    f32(centre.x + offset.x),
    f32(centre.y + offset.y),
  );
  const d0 = frozenPoint(
    f32(q.x - centre.x),
    f32(q.y - centre.y),
  );
  const rotated = rotateFloat32(angleRadians, d0);
  const position = frozenPoint(
    f32(centre.x + rotated.x),
    f32(centre.y + rotated.y),
  );
  const d1 = frozenPoint(
    f32(position.x - centre.x),
    f32(position.y - centre.y),
  );

  return Object.freeze({
    angleRadians,
    critical: true,
    fadeActionSeconds: CRAZY_DRAGON_TERMINAL_PIECE_FADE_SECONDS,
    fixture: Object.freeze({
      density: 1,
      filter: FRUIT_COLLISION_FILTER,
      fixtureUserData: null,
      friction: RECOVERED_FRICTION,
      restitution: 0,
      sensor: false,
      shape: Object.freeze({
        creatorSizeWorldUnits: Object.freeze({
          height: f32(height * f32(2)),
          width: f32(width * f32(2)),
        }),
        halfExtentsMetres: frozenPoint(
          f32(width / f32(LEGACY_WORLD_UNITS_PER_METRE)),
          f32(height / f32(LEGACY_WORLD_UNITS_PER_METRE)),
        ),
        type: 'box',
      }),
    }),
    kind,
    linearVelocityMetresPerSecond: frozenPoint(
      f32(CRAZY_DRAGON_TERMINAL_SPEED_SCALE * d1.x),
      f32(CRAZY_DRAGON_TERMINAL_SPEED_SCALE * d1.y),
    ),
    positionMetres: position,
    raster,
  });
}

function freezeCutResult(
  accepted: boolean,
  acceptedHitCount: number,
  commands: CrazyDragonFruitCommand[],
  firstCut: boolean,
): CrazyDragonCutResult {
  return Object.freeze({
    accepted,
    acceptedHitCount,
    commands: Object.freeze(commands),
    firstCut,
    finished: false,
  });
}

function playEffect(canonicalPath: CrazyEffectAudioPath): CrazyDragonFruitCommand {
  return Object.freeze({ canonicalPath, loop: false, type: 'play-effect' });
}

function createCounterFontSize(logicalWidthWorldUnits: number): number {
  const width = toPositiveFloat32(logicalWidthWorldUnits, 'logicalWidthWorldUnits');
  return f32(f32(width / f32(480)) * f32(48));
}

function createPositionJitterRadius(logicalWidthWorldUnits: number): number {
  const width = toPositiveFloat32(logicalWidthWorldUnits, 'logicalWidthWorldUnits');
  const integerWidth = Math.trunc(width);
  return Math.trunc(
    f32(f32(integerWidth) * CRAZY_DRAGON_POSITION_JITTER_WIDTH_SCALE),
  );
}

function createSplashRotationDegrees(segment: CutSegment): number {
  assertSegment(segment);
  const difference = frozenPoint(
    f32(segment.start.x - segment.end.x),
    f32(segment.start.y - segment.end.y),
  );
  if (difference.x === 0 && difference.y === 0) {
    throw new RangeError('segment must have non-zero length');
  }
  const ratio = f32(f32(-difference.x) / difference.y);
  return f32(f32(Math.atan(ratio)) * RADIANS_TO_DEGREES);
}

function rotateFloat32(
  angleRadians: number,
  point: CrazyDragonPoint,
): CrazyDragonPoint {
  const cosine = f32(Math.cos(angleRadians));
  const sine = f32(Math.sin(angleRadians));
  return frozenPoint(
    f32(f32(cosine * point.x) - f32(sine * point.y)),
    f32(f32(sine * point.x) + f32(cosine * point.y)),
  );
}

function metresToWorldUnits(point: CrazyDragonPoint): CrazyDragonPoint {
  return frozenPoint(
    f32(point.x * f32(LEGACY_WORLD_UNITS_PER_METRE)),
    f32(point.y * f32(LEGACY_WORLD_UNITS_PER_METRE)),
  );
}

function drawInclusive(
  random: Pick<GameplayRandom, 'nextIntInclusive'>,
  minimum: number,
  maximum: number,
): number {
  const result = random.nextIntInclusive(minimum, maximum);
  if (!Number.isSafeInteger(result)) {
    throw new TypeError(
      `nextIntInclusive(${minimum}, ${maximum}) must return a safe integer`,
    );
  }
  if (result < minimum || result > maximum) {
    throw new RangeError(
      `nextIntInclusive(${minimum}, ${maximum}) returned ${result} outside the inclusive range`,
    );
  }
  return result;
}

function assertCutInput(input: CrazyDragonCutInput): void {
  assertObject(input, 'input');
  copyFloat32Point(input.bodyPositionMetres, 'bodyPositionMetres');
  toPositiveFloat32(input.logicalWidthWorldUnits, 'logicalWidthWorldUnits');
  assertSegment(input.segment);
  assertBoolean(input.effectsEnabled, 'effectsEnabled');
}

function assertCompletionInput(input: CrazyDragonCompletionInput): void {
  assertObject(input, 'completion');
  if (input.assetTree !== '480x800' && input.assetTree !== '720x1280') {
    throw new RangeError('completion.assetTree must be 480x800 or 720x1280');
  }
  copyFloat32Point(input.bodyPositionMetres, 'bodyPositionMetres');
  toFiniteFloat32(input.bodyAngleRadians, 'bodyAngleRadians');
  assertBoolean(input.effectsEnabled, 'effectsEnabled');
}

function assertSegment(segment: CutSegment): void {
  assertObject(segment, 'segment');
  copyFloat32Point(segment.start, 'segment.start');
  copyFloat32Point(segment.end, 'segment.end');
}

function copyViewport(viewport: CrazyDragonViewport): CrazyDragonViewport {
  assertObject(viewport, 'viewport');
  return Object.freeze({
    height: toPositiveFloat32(viewport.height, 'viewport.height'),
    width: toPositiveFloat32(viewport.width, 'viewport.width'),
  });
}

function copyFloat32Point(point: CrazyDragonPoint, label: string): CrazyDragonPoint {
  assertObject(point, label);
  return frozenPoint(
    toFiniteFloat32(point.x, `${label}.x`),
    toFiniteFloat32(point.y, `${label}.y`),
  );
}

function frozenPoint(x: number, y: number): CrazyDragonPoint {
  return Object.freeze({ x, y });
}

function toFiniteFloat32(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
  const result = f32(value);
  if (!Number.isFinite(result)) {
    throw new RangeError(`${label} must fit a finite float32 value`);
  }
  return result;
}

function toPositiveFloat32(value: number, label: string): number {
  const result = toFiniteFloat32(value, label);
  if (result <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
  return result;
}

function toNonNegativeFloat32(value: number, label: string): number {
  const result = toFiniteFloat32(value, label);
  if (result < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
  return result;
}

function assertRandom(
  random: Pick<GameplayRandom, 'nextIntInclusive'>,
): void {
  if (
    random === null
    || typeof random !== 'object'
    || typeof random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive(minimum, maximum)');
  }
}

function assertBoolean(value: boolean, label: string): void {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be a boolean`);
  }
}

function assertObject(value: object, label: string): void {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
}

function f32(value: number): number {
  return Math.fround(value);
}
