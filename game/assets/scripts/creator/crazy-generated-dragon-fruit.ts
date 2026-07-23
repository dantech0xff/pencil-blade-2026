import {
  BoxCollider2D,
  Color,
  ERigidBody2DType,
  Label,
  Node,
  RigidBody2D,
  Size,
  Sprite,
  UIOpacity,
  UITransform,
  Vec2,
  isValid,
} from 'cc';

import {
  createClassicBoundsCommands,
  type ClassicBoundsCommand,
  type DisposalBoundary,
} from '../domain/classic-bounds';
import type { ClassicCriticalParticleSpawnCommand } from '../domain/classic-critical-particle-plan';
import type { CutSegment, CuttableSnapshot } from '../domain/classic-cut-query';
import { LEGACY_WORLD_UNITS_PER_METRE } from '../domain/classic-fixture-rules';
import type { ClassicCreateCommand } from '../domain/classic-spawn-planner';
import type { CrazyEffectAudioPath } from '../domain/crazy-audio-contract';
import {
  CRAZY_DRAGON_ACCEPTED_SPLASH_FADE_SECONDS,
  CRAZY_DRAGON_COUNTER_FADE_SECONDS,
  CRAZY_DRAGON_COUNTER_FONT_PATH,
  CRAZY_DRAGON_COUNTER_INITIAL_SCALE,
  CRAZY_DRAGON_COUNTER_PULSE_SECONDS,
  CRAZY_DRAGON_FRUIT_Z_ORDER,
  CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS,
  CRAZY_DRAGON_TERMINAL_PIECE_FADE_SECONDS,
  CrazyDragonFruitState,
  createCrazyDragonCriticalPieceUpdateCommands,
  createCrazyDragonFixtureConfiguration,
  type CrazyDragonCutResult,
  type CrazyDragonFixtureConfiguration,
  type CrazyDragonFruitCommand,
  type CrazyDragonTerminalPieceKind,
  type CrazyDragonTerminalPiecePlan,
} from '../domain/crazy-dragon-fruit-state';
import {
  getCrazySupplementalRasterSet,
} from '../domain/crazy-resource-contract';
import type { GameRasterResource } from '../domain/game-resource-contract';
import type { GameplayRandom } from '../domain/gameplay-random';
import type { LoadedCrazyDragonFont } from './crazy-dragon-font-loader';
import type { LoadedCrazyResources } from './crazy-resource-loader';
import type { LoadedGameRasterResource } from './game-resource-loader';

export type CrazyDragonFruitCreateCommand = Extract<
  ClassicCreateCommand,
  Readonly<{ type: 'create-dragon-fruit'; tossType: 6 }>
>;

export const TARGET_CRAZY_DRAGON_FRUIT_COLLIDER_TAG = 0;

export interface LoadedCrazyDragonVisuals {
  readonly bottomLeft: LoadedGameRasterResource;
  readonly bottomRight: LoadedGameRasterResource;
  readonly intact: LoadedGameRasterResource;
  readonly splash: LoadedGameRasterResource;
  readonly topLeft: LoadedGameRasterResource;
  readonly topRight: LoadedGameRasterResource;
}

export type CrazyGeneratedDragonFruitDisposalReason =
  | 'dragon-finished'
  | 'registry-dispose-all'
  | 'spawn-failed'
  | Readonly<{ readonly boundary: DisposalBoundary; readonly type: 'bounds' }>;

export interface CrazyGeneratedDragonFruitPlayEffectEvent {
  readonly canonicalPath: CrazyEffectAudioPath;
  readonly entityOccurrenceId: number;
  readonly loop: false;
  readonly targetId: string;
}

export interface CrazyGeneratedDragonFruitFinishedEvent {
  readonly acceptedHitCount: number;
  readonly entityOccurrenceId: number;
  readonly targetId: string;
}

export interface CrazyGeneratedDragonFruitObjectiveEvent {
  readonly amount: 1;
  readonly entityOccurrenceId: number;
  readonly eventId: 15;
  readonly targetId: string;
}

export interface CrazyGeneratedDragonCriticalParticleEvent {
  readonly command: ClassicCriticalParticleSpawnCommand;
  readonly entityOccurrenceId: number;
  readonly pieceKind: CrazyDragonTerminalPieceKind;
  readonly positionWorldUnits: Readonly<{ readonly x: number; readonly y: number }>;
  readonly targetId: string;
  readonly zOrder: 1;
}

export interface CrazyGeneratedDragonFruitDisposedEvent {
  readonly collider: BoxCollider2D;
  readonly entityOccurrenceId: number;
  readonly reason: CrazyGeneratedDragonFruitDisposalReason;
  readonly targetId: string;
}

export type CrazyGeneratedDragonOwnedPresentationPart =
  | 'counter'
  | 'lifecycle'
  | 'original'
  | CrazyDragonTerminalPieceKind;

export interface CrazyGeneratedDragonOwnedPresentationFailure {
  readonly error: unknown;
  readonly part: CrazyGeneratedDragonOwnedPresentationPart;
}

export class CrazyGeneratedDragonOwnedPresentationDisposalError extends Error {
  readonly failures: readonly CrazyGeneratedDragonOwnedPresentationFailure[];

  constructor(
    failures: readonly CrazyGeneratedDragonOwnedPresentationFailure[],
  ) {
    super(
      `Crazy Dragon owned-presentation disposal failed at ${failures.length} boundary/boundaries`,
    );
    this.name = 'CrazyGeneratedDragonOwnedPresentationDisposalError';
    this.failures = Object.freeze(failures.map((failure) => Object.freeze({
      ...failure,
    })));
  }
}

export interface CrazyGeneratedDragonFruitLifecycle {
  readonly callAfterStep: (mutation: () => void) => void;
  readonly effectsEnabled: () => boolean;
  readonly onCriticalParticle: (
    event: CrazyGeneratedDragonCriticalParticleEvent,
  ) => void;
  readonly onDisposed: (event: CrazyGeneratedDragonFruitDisposedEvent) => void;
  readonly onDragonFinished: (
    event: CrazyGeneratedDragonFruitFinishedEvent,
  ) => void;
  readonly onObjective: (event: CrazyGeneratedDragonFruitObjectiveEvent) => void;
  readonly onPlayEffect: (
    event: CrazyGeneratedDragonFruitPlayEffectEvent,
  ) => void;
}

export interface CrazyGeneratedDragonPieceUpdate {
  readonly boundsCommands: readonly ClassicBoundsCommand[];
  readonly criticalCommands: readonly ClassicCriticalParticleSpawnCommand[];
  readonly kind: CrazyDragonTerminalPieceKind;
}

export interface CrazyGeneratedDragonPhysicsUpdate {
  readonly originalBoundsCommands: readonly ClassicBoundsCommand[];
  readonly pieceUpdates: readonly CrazyGeneratedDragonPieceUpdate[];
}

export interface CrazyGeneratedDragonPieceSnapshot {
  readonly angleRadians: number;
  readonly disposalQueued: boolean;
  readonly kind: CrazyDragonTerminalPieceKind;
  readonly linearVelocityMetresPerSecond: Readonly<{
    readonly x: number;
    readonly y: number;
  }>;
  readonly opacity: number;
  readonly positionMetres: Readonly<{ readonly x: number; readonly y: number }>;
}

export interface CrazyGeneratedDragonPresentationSnapshot {
  readonly counterOpacity: number | null;
  readonly counterScale: number | null;
  readonly counterText: string | null;
  readonly splashOpacity: number;
  readonly splashVisible: boolean;
}

interface CounterPresentation {
  readonly label: Label;
  readonly node: Node;
  readonly opacity: UIOpacity;
  finalFadeElapsedSeconds: number | null;
  pulseElapsedSeconds: number | null;
}

const NO_BOUNDS_COMMANDS: readonly ClassicBoundsCommand[] = Object.freeze([]);
const MAX_OPACITY = 255;
const RADIANS_TO_DEGREES = 180 / Math.PI;

/**
 * Creator runtime for the Crazy type-6 DragonFruit.
 *
 * `updateAction` and `updatePhysics` are deliberately separate. The former advances the
 * recovered Cocos action clock; the latter must be called from the post-physics integration
 * path and owns bounds plus per-surviving-piece critical RNG.
 */
export class CrazyGeneratedDragonFruit {
  readonly body: RigidBody2D;
  readonly bodyNode: Node;
  readonly collider: BoxCollider2D;
  readonly colliderTag = TARGET_CRAZY_DRAGON_FRUIT_COLLIDER_TAG;
  readonly entityOccurrenceId: number;
  readonly node: Node;
  readonly nodeName: string;
  readonly splashNode: Node;
  readonly splashOpacity: UIOpacity;
  readonly splashSprite: Sprite;
  readonly sprite: Sprite;
  readonly targetId: string;
  readonly tossType = 6 as const;
  readonly visuals: LoadedCrazyDragonVisuals;

  private attachedValue = false;
  private counter: CounterPresentation | null = null;
  private disposalQueuedValue = false;
  private lastCutResultValue: CrazyDragonCutResult | null = null;
  private readonly lifecycle: CrazyGeneratedDragonFruitLifecycle;
  private originalDisposalNotifiedValue = false;
  private ownedPresentationDisposalQueuedValue = false;
  private readonly random: Pick<GameplayRandom, 'nextIntInclusive'>;
  private readonly resources: LoadedCrazyResources;
  private splashFadeElapsedSeconds: number | null = null;
  private readonly state: CrazyDragonFruitState;
  private readonly terminalPiecesValue: CrazyGeneratedDragonTerminalPiece[] = [];
  private readonly viewport: Readonly<{ readonly height: number; readonly width: number }>;

  private constructor(
    command: CrazyDragonFruitCreateCommand,
    viewport: Readonly<{ readonly height: number; readonly width: number }>,
    resources: LoadedCrazyResources,
    font: LoadedCrazyDragonFont,
    visuals: LoadedCrazyDragonVisuals,
    fixture: CrazyDragonFixtureConfiguration,
    random: Pick<GameplayRandom, 'nextIntInclusive'>,
    lifecycle: CrazyGeneratedDragonFruitLifecycle,
  ) {
    this.entityOccurrenceId = command.entityOccurrenceId;
    this.nodeName = `CrazyGeneratedDragonFruit-${command.entityOccurrenceId}`;
    this.targetId = `crazy-dragon-fruit:shared-planner:${command.entityOccurrenceId}`;
    this.viewport = Object.freeze({ height: viewport.height, width: viewport.width });
    this.resources = resources;
    this.visuals = visuals;
    this.random = random;
    this.lifecycle = lifecycle;
    this.state = new CrazyDragonFruitState(viewport);

    this.node = new Node(this.nodeName);
    this.node.active = false;
    try {
      this.bodyNode = new Node(`${this.nodeName}-Body`);
      this.bodyNode.setParent(this.node);
      const bodyTransform = this.bodyNode.addComponent(UITransform);
      bodyTransform.setContentSize(
        visuals.intact.dimensions.width,
        visuals.intact.dimensions.height,
      );
      bodyTransform.setAnchorPoint(0.5, 0.5);
      this.sprite = this.bodyNode.addComponent(Sprite);
      this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      this.sprite.spriteFrame = visuals.intact.spriteFrame;
      this.body = this.bodyNode.addComponent(RigidBody2D);
      configureDragonBody(this.body, fixture);
      this.collider = addDragonCollider(this.bodyNode, fixture);
      this.bodyNode.setPosition(
        fixture.body.creatorPositionWorldUnits.x,
        fixture.body.creatorPositionWorldUnits.y,
        0,
      );
      this.bodyNode.setRotationFromEuler(0, 0, 0);
      this.bodyNode.setSiblingIndex(CRAZY_DRAGON_FRUIT_Z_ORDER);

      this.splashNode = new Node(`${this.nodeName}-Splash`);
      this.splashNode.active = false;
      this.splashNode.setParent(this.node);
      const splashTransform = this.splashNode.addComponent(UITransform);
      splashTransform.setContentSize(
        visuals.splash.dimensions.width,
        visuals.splash.dimensions.height,
      );
      splashTransform.setAnchorPoint(0.5, 0.5);
      this.splashOpacity = this.splashNode.addComponent(UIOpacity);
      this.splashOpacity.opacity = MAX_OPACITY;
      this.splashSprite = this.splashNode.addComponent(Sprite);
      this.splashSprite.sizeMode = Sprite.SizeMode.CUSTOM;
      this.splashSprite.spriteFrame = visuals.splash.spriteFrame;
      this.splashNode.setSiblingIndex(CRAZY_DRAGON_FRUIT_Z_ORDER);

      // Validate the exact loaded font before the first Cut can create a sibling label.
      assertDragonFont(font);
      this.dragonFont = font;
    } catch (error) {
      if (isValid(this.node, true)) {
        this.node.destroy();
      }
      throw error;
    }
  }

  private readonly dragonFont: LoadedCrazyDragonFont;

  static create(
    command: CrazyDragonFruitCreateCommand,
    viewport: Readonly<{ readonly height: number; readonly width: number }>,
    resources: LoadedCrazyResources,
    dragonFont: LoadedCrazyDragonFont,
    random: Pick<GameplayRandom, 'nextIntInclusive'>,
    lifecycle: CrazyGeneratedDragonFruitLifecycle,
  ): CrazyGeneratedDragonFruit {
    assertCreateCommand(command);
    const copiedViewport = copyViewport(viewport);
    assertResources(resources);
    assertDragonFont(dragonFont);
    assertRandom(random);
    assertLifecycle(lifecycle);

    // Resolve every frame before constructing a Node. An incomplete profile must fail without
    // leaving an unregistered body or partial terminal-piece catalog behind.
    const visuals = resolveExactVisuals(resources);
    const fixture = createCrazyDragonFixtureConfiguration(
      copiedViewport,
      visuals.intact.dimensions,
    );
    return new CrazyGeneratedDragonFruit(
      command,
      copiedViewport,
      resources,
      dragonFont,
      visuals,
      fixture,
      random,
      lifecycle,
    );
  }

  get attached(): boolean {
    return this.attachedValue;
  }

  get cutDisabled(): boolean {
    return this.disposalQueuedValue || this.state.finished;
  }

  get disposalQueued(): boolean {
    return this.disposalQueuedValue;
  }

  get lastCutResult(): CrazyDragonCutResult | null {
    return this.lastCutResultValue;
  }

  /**
   * True only after the original and every sibling presentation owned by this adapter are
   * actually destroyed. Deferred terminal-piece disposal therefore remains observable until
   * the after-step queue has run.
   */
  get ownedPresentationDisposed(): boolean {
    return (
      !isValid(this.node, true)
      && (
        this.counter === null
        || !isValid(this.counter.node, true)
      )
      && this.terminalPiecesValue.every((piece) => piece.presentationDisposed)
    );
  }

  get ownedPresentationDisposalQueued(): boolean {
    return this.ownedPresentationDisposalQueuedValue;
  }

  get terminalPieces(): readonly CrazyGeneratedDragonPieceSnapshot[] {
    return Object.freeze(this.terminalPiecesValue.map((piece) => piece.snapshot()));
  }

  stateSnapshot(): ReturnType<CrazyDragonFruitState['snapshot']> {
    return this.state.snapshot();
  }

  presentationSnapshot(): CrazyGeneratedDragonPresentationSnapshot {
    const splashValid = isValid(this.splashNode, true);
    return Object.freeze({
      counterOpacity: this.counter?.opacity.opacity ?? null,
      counterScale: this.counter?.node.scale.x ?? null,
      counterText: this.counter?.label.string ?? null,
      splashOpacity: splashValid ? this.splashOpacity.opacity : 0,
      splashVisible: splashValid && this.splashNode.active,
    });
  }

  setTransform(
    positionMetres: Readonly<{ readonly x: number; readonly y: number }>,
    angleRadians: number,
  ): void {
    assertFinitePoint(positionMetres, 'positionMetres');
    assertFinite(angleRadians, 'angleRadians');
    this.assertMutableBeforeAttachment('set its spawn transform');
    setBodyNodeTransform(this.bodyNode, positionMetres, angleRadians);
  }

  setLinearVelocity(
    metresPerSecond: Readonly<{ readonly x: number; readonly y: number }>,
  ): void {
    assertFinitePoint(metresPerSecond, 'metresPerSecond');
    this.assertMutableBeforeAttachment('set its spawn velocity');
    this.body.linearVelocity = new Vec2(metresPerSecond.x, metresPerSecond.y);
  }

  setAngularVelocity(radiansPerSecond: number): void {
    assertFinite(radiansPerSecond, 'radiansPerSecond');
    this.assertMutableBeforeAttachment('set its angular velocity');
    this.body.angularVelocity = radiansPerSecond;
  }

  attach(parent: Node, zOrder: 1): void {
    if (!isValid(parent, true)) {
      throw new Error('Crazy DragonFruit parent must be valid');
    }
    if (!parent.activeInHierarchy) {
      throw new Error('Crazy DragonFruit parent must be active in the scene');
    }
    if (this.disposalQueuedValue) {
      throw new Error('Crazy DragonFruit cannot attach after disposal is queued');
    }
    if (this.attachedValue || this.node.parent !== null) {
      throw new Error('Crazy DragonFruit is already attached');
    }
    if (zOrder !== CRAZY_DRAGON_FRUIT_Z_ORDER) {
      throw new RangeError('Crazy DragonFruit only supports recovered z-order 1');
    }

    this.node.layer = parent.layer;
    this.bodyNode.layer = parent.layer;
    this.splashNode.layer = parent.layer;
    this.node.setParent(parent, true);
    this.node.setSiblingIndex(CRAZY_DRAGON_FRUIT_Z_ORDER);
    this.attachedValue = true;
    this.node.active = true;
  }

  snapshot(): CuttableSnapshot {
    return Object.freeze({
      bodyWorldPosition: this.bodyWorldPositionSnapshot(),
      cutDisabled: this.cutDisabled,
      id: this.targetId,
      // Native DragonFruit inherits CutObject::IsFruit(), which returns false.
      isFruit: false,
      nodeTag: this.colliderTag,
    });
  }

  cut(segment: CutSegment): boolean {
    return this.cutDetailed(segment) !== null;
  }

  cutDetailed(segment: CutSegment): CrazyDragonCutResult | null {
    if (this.cutDisabled) {
      return null;
    }
    this.assertAttached('receive a Cut');
    const result = this.state.cut({
      bodyPositionMetres: this.bodyPositionMetresSnapshot(),
      effectsEnabled: this.readEffectsEnabled(),
      logicalWidthWorldUnits: this.viewport.width,
      segment,
    }, this.random);
    this.lastCutResultValue = result;
    this.dispatchCommands(result.commands);
    return result;
  }

  /** Dragon has no generic Fruit query-completion disposal; every hit invokes custom Cut. */
  cutWithinRayQuery(segment: CutSegment): boolean {
    return this.cut(segment);
  }

  completeRayQueryCuts(): void {
    // Intentionally empty. Native DragonFruit never calls DisableCut from its custom Cut.
  }

  /**
   * Advances only recovered action time. It does not evaluate physics bounds or consume the
   * terminal pieces' update RNG.
   */
  updateAction(unscaledDeltaSeconds: number): void {
    const delta = toNonNegativeFloat32(unscaledDeltaSeconds, 'unscaledDeltaSeconds');
    this.updateExistingPresentationActions(delta);
    for (const piece of [...this.terminalPiecesValue]) {
      piece.updateAction(delta);
    }

    if (
      !this.state.started
      || this.state.finished
      || this.disposalQueuedValue
    ) {
      return;
    }
    const actionSnapshot = this.state.snapshot();
    const completesNow = Math.fround(
      actionSnapshot.hitActionElapsedSeconds + delta,
    ) >= CRAZY_DRAGON_HIT_FINISH_DELAY_SECONDS;
    const result = this.state.advanceAction(delta, {
      assetTree: this.resources.assetTree,
      bodyAngleRadians: this.bodyAngleRadiansSnapshot(),
      bodyPositionMetres: this.bodyPositionMetresSnapshot(),
      // Native reads the completion gate in HitFinishedCallback, not on every action tick.
      effectsEnabled: completesNow ? this.readEffectsEnabled() : false,
    });
    this.dispatchCommands(result.commands);
  }

  /**
   * Evaluates original and piece physics after a world step. Piece updates remain in recovered
   * creation order and consume one-or-three shared RNG draws only while still alive.
   */
  updatePhysics(
    viewport: Readonly<{ readonly height: number; readonly width: number }>,
  ): CrazyGeneratedDragonPhysicsUpdate {
    const copiedViewport = copyViewport(viewport);
    const originalBoundsCommands = this.evaluateBounds(copiedViewport);
    const pieceUpdates = this.terminalPiecesValue.map((piece) => (
      piece.updatePhysics(
        copiedViewport,
        this.random,
        (command, positionWorldUnits) => {
          this.lifecycle.onCriticalParticle(Object.freeze({
            command,
            entityOccurrenceId: this.entityOccurrenceId,
            pieceKind: piece.kind,
            positionWorldUnits,
            targetId: this.targetId,
            zOrder: CRAZY_DRAGON_FRUIT_Z_ORDER,
          }));
        },
      )
    ));
    return Object.freeze({
      originalBoundsCommands,
      pieceUpdates: Object.freeze(pieceUpdates),
    });
  }

  evaluateBounds(
    viewport: Readonly<{ readonly height: number; readonly width: number }>,
  ): readonly ClassicBoundsCommand[] {
    const copiedViewport = copyViewport(viewport);
    if (this.disposalQueuedValue || !isValid(this.bodyNode, true)) {
      return NO_BOUNDS_COMMANDS;
    }
    const velocity = this.body.linearVelocity;
    const commands = createClassicBoundsCommands({
      linearVelocityMetresPerSecond: { x: velocity.x, y: velocity.y },
      positionWorldUnits: this.bodyWorldPositionSnapshot(),
      viewportHeightWorldUnits: copiedViewport.height,
      viewportWidthWorldUnits: copiedViewport.width,
    });
    for (const command of commands) {
      if (command.type === 'defer-dispose') {
        this.queueDispose(Object.freeze({
          boundary: command.boundary,
          type: 'bounds',
        }));
        break;
      }
      // DragonFruit's inherited FailNotifycation is empty: preserve the command transcript
      // without emitting a Crazy miss, strike, score, or objective callback.
    }
    return commands;
  }

  queueDispose(reason: CrazyGeneratedDragonFruitDisposalReason): boolean {
    assertDisposalReason(reason);
    if (this.disposalQueuedValue) {
      return false;
    }
    this.disposalQueuedValue = true;
    const event: CrazyGeneratedDragonFruitDisposedEvent = Object.freeze({
      collider: this.collider,
      entityOccurrenceId: this.entityOccurrenceId,
      reason,
      targetId: this.targetId,
    });
    let mutationStarted = false;
    try {
      this.lifecycle.callAfterStep(() => {
        mutationStarted = true;
        try {
          if (isValid(this.node, true)) {
            this.node.destroy();
          }
        } finally {
          this.attachedValue = false;
          this.notifyOriginalDisposed(event);
        }
      });
    } catch (error) {
      if (!mutationStarted) {
        this.disposalQueuedValue = false;
      }
      throw error;
    }
    return true;
  }

  /**
   * Explicit layer-teardown path for presentation that outlives the original Dragon node.
   *
   * This does not advance the action clock, create terminal pieces, emit score/objective/audio,
   * or consume gameplay RNG. All currently owned nodes are destroyed best-effort in one
   * after-step mutation. The normal native queueDispose path remains unchanged.
   */
  disposeOwnedPresentation(reason: 'registry-dispose-all'): boolean {
    if (reason !== 'registry-dispose-all') {
      throw new TypeError(
        'Crazy Dragon owned presentation only supports registry-dispose-all',
      );
    }
    if (
      this.ownedPresentationDisposed
      || this.ownedPresentationDisposalQueuedValue
    ) {
      return false;
    }

    const ownsOriginalDisposal = !this.disposalQueuedValue;
    if (ownsOriginalDisposal) {
      this.disposalQueuedValue = true;
    }
    this.ownedPresentationDisposalQueuedValue = true;
    const event: CrazyGeneratedDragonFruitDisposedEvent = Object.freeze({
      collider: this.collider,
      entityOccurrenceId: this.entityOccurrenceId,
      reason,
      targetId: this.targetId,
    });

    let mutationStarted = false;
    try {
      this.lifecycle.callAfterStep(() => {
        mutationStarted = true;
        this.ownedPresentationDisposalQueuedValue = false;
        const failures: CrazyGeneratedDragonOwnedPresentationFailure[] = [];

        try {
          if (isValid(this.node, true)) {
            this.node.destroy();
          }
        } catch (error) {
          failures.push(Object.freeze({ error, part: 'original' }));
        }
        if (!isValid(this.node, true)) {
          this.attachedValue = false;
        }

        const counter = this.counter;
        if (counter !== null) {
          try {
            if (isValid(counter.node, true)) {
              counter.node.destroy();
            }
          } catch (error) {
            failures.push(Object.freeze({ error, part: 'counter' }));
          }
          if (!isValid(counter.node, true)) {
            this.counter = null;
          }
        }

        for (const piece of this.terminalPiecesValue) {
          try {
            piece.destroyImmediately();
          } catch (error) {
            failures.push(Object.freeze({ error, part: piece.kind }));
          }
        }

        if (ownsOriginalDisposal) {
          try {
            this.notifyOriginalDisposed(event);
          } catch (error) {
            failures.push(Object.freeze({ error, part: 'lifecycle' }));
          }
        }
        if (failures.length > 0) {
          throw new CrazyGeneratedDragonOwnedPresentationDisposalError(failures);
        }
      });
    } catch (error) {
      if (!mutationStarted) {
        this.ownedPresentationDisposalQueuedValue = false;
        if (ownsOriginalDisposal) {
          this.disposalQueuedValue = false;
        }
      }
      throw error;
    }
    return true;
  }

  private notifyOriginalDisposed(
    event: CrazyGeneratedDragonFruitDisposedEvent,
  ): void {
    if (this.originalDisposalNotifiedValue) {
      return;
    }
    this.originalDisposalNotifiedValue = true;
    this.lifecycle.onDisposed(event);
  }

  private dispatchCommands(commands: readonly CrazyDragonFruitCommand[]): void {
    for (const command of commands) {
      switch (command.type) {
        case 'play-effect':
          this.lifecycle.onPlayEffect(Object.freeze({
            canonicalPath: command.canonicalPath,
            entityOccurrenceId: this.entityOccurrenceId,
            loop: command.loop,
            targetId: this.targetId,
          }));
          break;
        case 'freeze-body':
          this.body.angularVelocity = 0;
          this.body.linearVelocity = new Vec2(0, 0);
          this.body.gravityScale = 0;
          break;
        case 'show-splash':
          this.splashNode.active = true;
          break;
        case 'start-hit-finish-delay':
          // The pure state owns this explicit action-clock timer.
          break;
        case 'create-hit-counter':
          this.createCounter(command);
          break;
        case 'set-body-transform':
          setBodyNodeTransform(
            this.bodyNode,
            command.positionMetres,
            command.angleRadians,
          );
          break;
        case 'animate-accepted-splash':
          this.splashNode.setPosition(
            command.positionWorldUnits.x,
            command.positionWorldUnits.y,
            0,
          );
          this.splashNode.setRotationFromEuler(0, 0, command.rotationDegrees);
          this.splashOpacity.opacity = command.opacity;
          this.splashFadeElapsedSeconds = 0;
          break;
        case 'animate-hit-counter':
          if (this.counter === null) {
            throw new Error('Crazy Dragon hit counter was not created before animation');
          }
          this.counter.label.string = command.text;
          this.counter.node.setScale(
            command.initialScale,
            command.initialScale,
            1,
          );
          this.counter.pulseElapsedSeconds = 0;
          break;
        case 'create-terminal-piece':
          this.createTerminalPiece(command.piece);
          break;
        case 'notify-dragon-finished':
          this.lifecycle.onDragonFinished(Object.freeze({
            acceptedHitCount: command.acceptedHitCount,
            entityOccurrenceId: this.entityOccurrenceId,
            targetId: this.targetId,
          }));
          break;
        case 'defer-dispose-original':
          this.queueDispose('dragon-finished');
          break;
        case 'start-counter-fade':
          if (this.counter !== null) {
            this.counter.finalFadeElapsedSeconds = 0;
          }
          break;
        case 'process-objective':
          this.lifecycle.onObjective(Object.freeze({
            amount: command.amount,
            entityOccurrenceId: this.entityOccurrenceId,
            eventId: command.eventId,
            targetId: this.targetId,
          }));
          break;
      }
    }
  }

  private createCounter(
    command: Extract<CrazyDragonFruitCommand, Readonly<{ type: 'create-hit-counter' }>>,
  ): void {
    if (this.counter !== null) {
      throw new Error('Crazy Dragon hit counter already exists');
    }
    const parent = this.node.parent;
    if (parent === null || !isValid(parent, true)) {
      throw new Error('Crazy DragonFruit must have a valid parent for its hit counter');
    }
    if (command.fontCanonicalPath !== this.dragonFont.canonicalPath) {
      throw new Error('Crazy Dragon counter command requested a mismatched font');
    }

    const node = new Node(`${this.nodeName}-HitCounter`);
    try {
      node.layer = parent.layer;
      const transform = node.addComponent(UITransform);
      transform.setAnchorPoint(command.anchor.x, command.anchor.y);
      const label = node.addComponent(Label);
      label.font = this.dragonFont.font;
      label.fontSize = command.fontSize;
      label.lineHeight = command.fontSize;
      label.string = command.text;
      label.color = new Color(
        command.color.red,
        command.color.green,
        command.color.blue,
        MAX_OPACITY,
      );
      const opacity = node.addComponent(UIOpacity);
      opacity.opacity = MAX_OPACITY;
      node.setParent(parent);
      node.setWorldPosition(
        command.positionWorldUnits.x,
        command.positionWorldUnits.y,
        0,
      );
      node.setRotationFromEuler(0, 0, command.rotationDegrees);
      node.setSiblingIndex(command.zOrder);
      this.counter = {
        finalFadeElapsedSeconds: null,
        label,
        node,
        opacity,
        pulseElapsedSeconds: null,
      };
    } catch (error) {
      if (isValid(node, true)) {
        node.destroy();
      }
      throw error;
    }
  }

  private createTerminalPiece(plan: CrazyDragonTerminalPiecePlan): void {
    const parent = this.node.parent;
    if (parent === null || !isValid(parent, true)) {
      throw new Error('Crazy DragonFruit needs its parent to attach terminal pieces');
    }
    const loaded = loadedPieceForPlan(this.visuals, plan);
    const piece = CrazyGeneratedDragonTerminalPiece.create(
      `${this.nodeName}-${plan.kind}`,
      plan,
      loaded,
      this.lifecycle.callAfterStep,
    );
    try {
      piece.attach(parent);
      this.terminalPiecesValue.push(piece);
    } catch (error) {
      piece.destroyImmediately();
      throw error;
    }
  }

  private updateExistingPresentationActions(delta: number): void {
    if (this.splashFadeElapsedSeconds !== null) {
      if (!isValid(this.splashNode, true)) {
        this.splashFadeElapsedSeconds = null;
      } else {
        this.splashFadeElapsedSeconds = Math.fround(
          this.splashFadeElapsedSeconds + delta,
        );
        const duration = CRAZY_DRAGON_ACCEPTED_SPLASH_FADE_SECONDS;
        const clamped = Math.min(duration, this.splashFadeElapsedSeconds);
        this.splashOpacity.opacity = MAX_OPACITY * (1 - clamped / duration);
        if (clamped >= duration) {
          this.splashFadeElapsedSeconds = null;
        }
      }
    }

    const counter = this.counter;
    if (counter === null) {
      return;
    }
    if (counter.pulseElapsedSeconds !== null) {
      const duration = CRAZY_DRAGON_COUNTER_PULSE_SECONDS;
      counter.pulseElapsedSeconds = Math.min(
        duration,
        Math.fround(counter.pulseElapsedSeconds + delta),
      );
      const ratio = counter.pulseElapsedSeconds / duration;
      const scale = Math.fround(
        CRAZY_DRAGON_COUNTER_INITIAL_SCALE + Math.fround(0.1 * ratio),
      );
      counter.node.setScale(scale, scale, 1);
      if (counter.pulseElapsedSeconds >= duration) {
        counter.pulseElapsedSeconds = null;
      }
    }
    if (counter.finalFadeElapsedSeconds !== null) {
      counter.finalFadeElapsedSeconds = Math.min(
        CRAZY_DRAGON_COUNTER_FADE_SECONDS,
        Math.fround(counter.finalFadeElapsedSeconds + delta),
      );
      counter.opacity.opacity = MAX_OPACITY * (
        1 - counter.finalFadeElapsedSeconds / CRAZY_DRAGON_COUNTER_FADE_SECONDS
      );
      if (
        counter.finalFadeElapsedSeconds
        >= CRAZY_DRAGON_COUNTER_FADE_SECONDS
      ) {
        if (isValid(counter.node, true)) {
          counter.node.destroy();
        }
        this.counter = null;
      }
    }
  }

  private bodyWorldPositionSnapshot(): Readonly<{ readonly x: number; readonly y: number }> {
    const position = this.bodyNode.worldPosition;
    return Object.freeze({ x: position.x, y: position.y });
  }

  private bodyPositionMetresSnapshot(): Readonly<{ readonly x: number; readonly y: number }> {
    const position = this.bodyWorldPositionSnapshot();
    return Object.freeze({
      x: Math.fround(position.x / LEGACY_WORLD_UNITS_PER_METRE),
      y: Math.fround(position.y / LEGACY_WORLD_UNITS_PER_METRE),
    });
  }

  private bodyAngleRadiansSnapshot(): number {
    const rawBody: unknown = this.body.impl?.impl;
    if (
      rawBody !== null
      && typeof rawBody === 'object'
      && 'GetAngle' in rawBody
      && typeof rawBody.GetAngle === 'function'
    ) {
      const angle = rawBody.GetAngle.call(rawBody) as unknown;
      if (typeof angle === 'number' && Number.isFinite(angle)) {
        return Math.fround(angle);
      }
    }
    return Math.fround(this.bodyNode.eulerAngles.z * Math.PI / 180);
  }

  private readEffectsEnabled(): boolean {
    const enabled = this.lifecycle.effectsEnabled();
    if (typeof enabled !== 'boolean') {
      throw new TypeError('effectsEnabled() must return a boolean');
    }
    return enabled;
  }

  private assertMutableBeforeAttachment(action: string): void {
    if (this.disposalQueuedValue) {
      throw new Error(`Crazy DragonFruit cannot ${action} after disposal is queued`);
    }
    if (this.attachedValue) {
      throw new Error(`Crazy DragonFruit must ${action} before attachment`);
    }
  }

  private assertAttached(action: string): void {
    if (!this.attachedValue || this.node.parent === null) {
      throw new Error(`Crazy DragonFruit must be attached before it can ${action}`);
    }
  }
}

class CrazyGeneratedDragonTerminalPiece {
  readonly body: RigidBody2D;
  readonly collider: BoxCollider2D;
  readonly kind: CrazyDragonTerminalPieceKind;
  readonly node: Node;
  readonly opacity: UIOpacity;

  private disposalQueuedValue = false;
  private fadeElapsedSeconds = 0;
  private readonly callAfterStep: (mutation: () => void) => void;

  private constructor(
    name: string,
    plan: CrazyDragonTerminalPiecePlan,
    visual: LoadedGameRasterResource,
    callAfterStep: (mutation: () => void) => void,
  ) {
    this.kind = plan.kind;
    this.callAfterStep = callAfterStep;
    this.node = new Node(name);
    this.node.active = false;
    try {
      const transform = this.node.addComponent(UITransform);
      transform.setContentSize(
        visual.dimensions.width,
        visual.dimensions.height,
      );
      transform.setAnchorPoint(0.5, 0.5);
      this.opacity = this.node.addComponent(UIOpacity);
      this.opacity.opacity = MAX_OPACITY;
      const sprite = this.node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.spriteFrame = visual.spriteFrame;
      this.body = this.node.addComponent(RigidBody2D);
      configureTerminalPieceBody(this.body, plan);
      this.collider = addTerminalPieceCollider(this.node, plan);
      setBodyNodeTransform(this.node, plan.positionMetres, plan.angleRadians);
    } catch (error) {
      if (isValid(this.node, true)) {
        this.node.destroy();
      }
      throw error;
    }
  }

  static create(
    name: string,
    plan: CrazyDragonTerminalPiecePlan,
    visual: LoadedGameRasterResource,
    callAfterStep: (mutation: () => void) => void,
  ): CrazyGeneratedDragonTerminalPiece {
    assertLoadedRaster(visual, plan.raster, `${plan.kind} visual`);
    return new CrazyGeneratedDragonTerminalPiece(
      name,
      plan,
      visual,
      callAfterStep,
    );
  }

  get disposalQueued(): boolean {
    return this.disposalQueuedValue;
  }

  get presentationDisposed(): boolean {
    return !isValid(this.node, true);
  }

  attach(parent: Node): void {
    if (!isValid(parent, true) || !parent.activeInHierarchy) {
      throw new Error('Crazy Dragon terminal-piece parent must be active and valid');
    }
    this.node.layer = parent.layer;
    this.node.setParent(parent, true);
    this.node.setSiblingIndex(CRAZY_DRAGON_FRUIT_Z_ORDER);
    this.node.active = true;
  }

  updateAction(delta: number): void {
    if (this.disposalQueuedValue) {
      return;
    }
    this.fadeElapsedSeconds = Math.min(
      CRAZY_DRAGON_TERMINAL_PIECE_FADE_SECONDS,
      Math.fround(this.fadeElapsedSeconds + delta),
    );
    this.opacity.opacity = MAX_OPACITY * (
      1 - this.fadeElapsedSeconds / CRAZY_DRAGON_TERMINAL_PIECE_FADE_SECONDS
    );
    if (
      this.fadeElapsedSeconds
      >= CRAZY_DRAGON_TERMINAL_PIECE_FADE_SECONDS
    ) {
      this.queueDispose();
    }
  }

  updatePhysics(
    viewport: Readonly<{ readonly height: number; readonly width: number }>,
    random: Pick<GameplayRandom, 'nextIntInclusive'>,
    onCritical: (
      command: ClassicCriticalParticleSpawnCommand,
      positionWorldUnits: Readonly<{ readonly x: number; readonly y: number }>,
    ) => void,
  ): CrazyGeneratedDragonPieceUpdate {
    if (this.disposalQueuedValue || !isValid(this.node, true)) {
      return Object.freeze({
        boundsCommands: NO_BOUNDS_COMMANDS,
        criticalCommands: Object.freeze([]),
        kind: this.kind,
      });
    }
    const position = this.worldPositionSnapshot();
    const velocity = this.body.linearVelocity;
    const boundsCommands = createClassicBoundsCommands({
      linearVelocityMetresPerSecond: { x: velocity.x, y: velocity.y },
      positionWorldUnits: position,
      viewportHeightWorldUnits: viewport.height,
      viewportWidthWorldUnits: viewport.width,
    });
    const disposal = boundsCommands.find(
      (command): command is Extract<ClassicBoundsCommand, { type: 'defer-dispose' }> => (
        command.type === 'defer-dispose'
      ),
    );
    if (disposal !== undefined) {
      this.queueDispose();
      return Object.freeze({
        boundsCommands,
        criticalCommands: Object.freeze([]),
        kind: this.kind,
      });
    }

    const criticalCommands = createCrazyDragonCriticalPieceUpdateCommands(
      position,
      random,
    );
    for (const command of criticalCommands) {
      onCritical(command, position);
    }
    return Object.freeze({
      boundsCommands,
      criticalCommands,
      kind: this.kind,
    });
  }

  snapshot(): CrazyGeneratedDragonPieceSnapshot {
    const position = this.node.worldPosition;
    return Object.freeze({
      angleRadians: Math.fround(this.node.eulerAngles.z * Math.PI / 180),
      disposalQueued: this.disposalQueuedValue,
      kind: this.kind,
      linearVelocityMetresPerSecond: Object.freeze({
        x: this.body.linearVelocity.x,
        y: this.body.linearVelocity.y,
      }),
      opacity: this.opacity.opacity,
      positionMetres: Object.freeze({
        x: Math.fround(position.x / LEGACY_WORLD_UNITS_PER_METRE),
        y: Math.fround(position.y / LEGACY_WORLD_UNITS_PER_METRE),
      }),
    });
  }

  destroyImmediately(): void {
    if (isValid(this.node, true)) {
      this.node.destroy();
    }
    this.disposalQueuedValue = true;
  }

  private queueDispose(): boolean {
    if (this.disposalQueuedValue) {
      return false;
    }
    this.disposalQueuedValue = true;
    let mutationStarted = false;
    try {
      this.callAfterStep(() => {
        mutationStarted = true;
        if (isValid(this.node, true)) {
          this.node.destroy();
        }
      });
    } catch (error) {
      if (!mutationStarted) {
        this.disposalQueuedValue = false;
      }
      throw error;
    }
    return true;
  }

  private worldPositionSnapshot(): Readonly<{ readonly x: number; readonly y: number }> {
    const position = this.node.worldPosition;
    return Object.freeze({ x: position.x, y: position.y });
  }
}

function configureDragonBody(
  body: RigidBody2D,
  fixture: CrazyDragonFixtureConfiguration,
): void {
  const definition = fixture.body;
  body.type = ERigidBody2DType.Dynamic;
  body.allowSleep = definition.allowSleep;
  body.awakeOnLoad = definition.awake;
  body.bullet = definition.bullet;
  body.fixedRotation = definition.fixedRotation;
  body.gravityScale = definition.gravityScale;
  body.linearDamping = definition.linearDamping;
  body.angularDamping = definition.angularDamping;
  body.linearVelocity = new Vec2(
    definition.linearVelocityMetresPerSecond.x,
    definition.linearVelocityMetresPerSecond.y,
  );
  body.angularVelocity = definition.angularVelocityRadiansPerSecond;
  body.group = fixture.fixture.filter.categoryBits;
}

function addDragonCollider(
  node: Node,
  fixture: CrazyDragonFixtureConfiguration,
): BoxCollider2D {
  const definition = fixture.fixture;
  const collider = node.addComponent(BoxCollider2D);
  collider.size = new Size(
    definition.shape.creatorSizeWorldUnits.width,
    definition.shape.creatorSizeWorldUnits.height,
  );
  collider.offset = new Vec2(0, 0);
  collider.density = definition.density;
  collider.friction = definition.friction;
  collider.restitution = definition.restitution;
  collider.sensor = definition.sensor;
  collider.group = definition.filter.categoryBits;
  collider.tag = TARGET_CRAZY_DRAGON_FRUIT_COLLIDER_TAG;
  return collider;
}

function configureTerminalPieceBody(
  body: RigidBody2D,
  plan: CrazyDragonTerminalPiecePlan,
): void {
  body.type = ERigidBody2DType.Dynamic;
  body.allowSleep = true;
  body.awakeOnLoad = true;
  body.bullet = false;
  body.fixedRotation = false;
  body.gravityScale = 1;
  body.linearDamping = 0;
  body.angularDamping = 0;
  body.linearVelocity = new Vec2(
    plan.linearVelocityMetresPerSecond.x,
    plan.linearVelocityMetresPerSecond.y,
  );
  body.angularVelocity = 0;
  body.group = plan.fixture.filter.categoryBits;
}

function addTerminalPieceCollider(
  node: Node,
  plan: CrazyDragonTerminalPiecePlan,
): BoxCollider2D {
  const definition = plan.fixture;
  const collider = node.addComponent(BoxCollider2D);
  collider.size = new Size(
    definition.shape.creatorSizeWorldUnits.width,
    definition.shape.creatorSizeWorldUnits.height,
  );
  collider.offset = new Vec2(0, 0);
  collider.density = definition.density;
  collider.friction = definition.friction;
  collider.restitution = definition.restitution;
  collider.sensor = definition.sensor;
  collider.group = definition.filter.categoryBits;
  collider.tag = TARGET_CRAZY_DRAGON_FRUIT_COLLIDER_TAG;
  return collider;
}

function setBodyNodeTransform(
  node: Node,
  positionMetres: Readonly<{ readonly x: number; readonly y: number }>,
  angleRadians: number,
): void {
  node.setPosition(
    Math.fround(positionMetres.x * LEGACY_WORLD_UNITS_PER_METRE),
    Math.fround(positionMetres.y * LEGACY_WORLD_UNITS_PER_METRE),
    0,
  );
  node.setRotationFromEuler(0, 0, angleRadians * RADIANS_TO_DEGREES);
}

function resolveExactVisuals(
  resources: LoadedCrazyResources,
): LoadedCrazyDragonVisuals {
  const expected = getCrazySupplementalRasterSet(resources.assetTree);
  const visuals = Object.freeze({
    bottomLeft: resources.raster(expected.dragonCutBottomLeft),
    bottomRight: resources.raster(expected.dragonCutBottomRight),
    intact: resources.raster(expected.dragonFruit),
    splash: resources.raster(expected.dragonSplash),
    topLeft: resources.raster(expected.dragonCutTopLeft),
    topRight: resources.raster(expected.dragonCutTopRight),
  });
  assertLoadedRaster(visuals.intact, expected.dragonFruit, 'intact');
  assertLoadedRaster(visuals.splash, expected.dragonSplash, 'splash');
  assertLoadedRaster(visuals.topLeft, expected.dragonCutTopLeft, 'top-left');
  assertLoadedRaster(visuals.topRight, expected.dragonCutTopRight, 'top-right');
  assertLoadedRaster(
    visuals.bottomRight,
    expected.dragonCutBottomRight,
    'bottom-right',
  );
  assertLoadedRaster(
    visuals.bottomLeft,
    expected.dragonCutBottomLeft,
    'bottom-left',
  );
  return visuals;
}

function loadedPieceForPlan(
  visuals: LoadedCrazyDragonVisuals,
  plan: CrazyDragonTerminalPiecePlan,
): LoadedGameRasterResource {
  const loaded = plan.kind === 'top-left'
    ? visuals.topLeft
    : plan.kind === 'top-right'
      ? visuals.topRight
      : plan.kind === 'bottom-right'
        ? visuals.bottomRight
        : visuals.bottomLeft;
  assertLoadedRaster(loaded, plan.raster, `${plan.kind} visual`);
  return loaded;
}

function assertLoadedRaster(
  loaded: LoadedGameRasterResource,
  expected: GameRasterResource,
  label: string,
): void {
  if (loaded === null || typeof loaded !== 'object') {
    throw new TypeError(`${label} must be a loaded raster`);
  }
  if (
    loaded.canonicalPath !== expected.canonicalPath
    || loaded.dimensions.width !== expected.dimensions.width
    || loaded.dimensions.height !== expected.dimensions.height
  ) {
    throw new RangeError(`${label} must match exact recovered raster geometry`);
  }
  if (!isValid(loaded.spriteFrame, true)) {
    throw new Error(`${label} must provide a valid loaded Creator SpriteFrame`);
  }
  const original = loaded.spriteFrame.originalSize;
  const rect = loaded.spriteFrame.rect;
  if (
    original.width !== expected.dimensions.width
    || original.height !== expected.dimensions.height
    || rect.width !== expected.dimensions.width
    || rect.height !== expected.dimensions.height
  ) {
    throw new RangeError(`${label} SpriteFrame must preserve untrimmed geometry`);
  }
}

function assertCreateCommand(command: CrazyDragonFruitCreateCommand): void {
  if (command === null || typeof command !== 'object') {
    throw new TypeError('command must be an object');
  }
  if (
    command.type !== 'create-dragon-fruit'
    || command.tossType !== 6
    || !Number.isSafeInteger(command.entityOccurrenceId)
    || command.entityOccurrenceId <= 0
  ) {
    throw new RangeError(
      'Crazy DragonFruit requires a positive type-6 shared-planner create command',
    );
  }
}

function assertResources(resources: LoadedCrazyResources): void {
  if (resources === null || typeof resources !== 'object') {
    throw new TypeError('resources must be a loaded Crazy resource catalog');
  }
  if (resources.assetTree !== '480x800' && resources.assetTree !== '720x1280') {
    throw new RangeError('resources.assetTree must be a recovered game asset tree');
  }
  if (typeof resources.raster !== 'function') {
    throw new TypeError('resources must provide raster()');
  }
}

function assertDragonFont(font: LoadedCrazyDragonFont): void {
  if (font === null || typeof font !== 'object') {
    throw new TypeError('dragonFont must be a loaded Crazy Dragon font');
  }
  if (font.canonicalPath !== CRAZY_DRAGON_COUNTER_FONT_PATH) {
    throw new RangeError(
      `dragonFont must use ${CRAZY_DRAGON_COUNTER_FONT_PATH}`,
    );
  }
  if (!isValid(font.font, true)) {
    throw new Error('dragonFont must provide a valid loaded Creator Font');
  }
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

function assertLifecycle(lifecycle: CrazyGeneratedDragonFruitLifecycle): void {
  if (lifecycle === null || typeof lifecycle !== 'object') {
    throw new TypeError('lifecycle must be an object');
  }
  if (
    typeof lifecycle.callAfterStep !== 'function'
    || typeof lifecycle.effectsEnabled !== 'function'
    || typeof lifecycle.onCriticalParticle !== 'function'
    || typeof lifecycle.onDisposed !== 'function'
    || typeof lifecycle.onDragonFinished !== 'function'
    || typeof lifecycle.onObjective !== 'function'
    || typeof lifecycle.onPlayEffect !== 'function'
  ) {
    throw new TypeError('Crazy DragonFruit lifecycle callbacks must be functions');
  }
}

function assertDisposalReason(
  reason: CrazyGeneratedDragonFruitDisposalReason,
): void {
  if (
    reason === 'dragon-finished'
    || reason === 'registry-dispose-all'
    || reason === 'spawn-failed'
  ) {
    return;
  }
  if (
    reason === null
    || typeof reason !== 'object'
    || reason.type !== 'bounds'
    || (
      reason.boundary !== 'below'
      && reason.boundary !== 'above'
      && reason.boundary !== 'left'
      && reason.boundary !== 'right'
    )
  ) {
    throw new TypeError('reason must be a supported Crazy DragonFruit disposal reason');
  }
}

function copyViewport(
  viewport: Readonly<{ readonly height: number; readonly width: number }>,
): Readonly<{ readonly height: number; readonly width: number }> {
  if (viewport === null || typeof viewport !== 'object') {
    throw new TypeError('viewport must be an object');
  }
  return Object.freeze({
    height: toPositiveFloat32(viewport.height, 'viewport.height'),
    width: toPositiveFloat32(viewport.width, 'viewport.width'),
  });
}

function assertFinitePoint(
  point: Readonly<{ readonly x: number; readonly y: number }>,
  label: string,
): void {
  if (point === null || typeof point !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
  assertFinite(point.x, `${label}.x`);
  assertFinite(point.y, `${label}.y`);
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}

function toPositiveFloat32(value: number, label: string): number {
  assertFinite(value, label);
  const result = Math.fround(value);
  if (!Number.isFinite(result) || result <= 0) {
    throw new RangeError(`${label} must be a positive finite float32`);
  }
  return result;
}

function toNonNegativeFloat32(value: number, label: string): number {
  assertFinite(value, label);
  const result = Math.fround(value);
  if (!Number.isFinite(result) || result < 0) {
    throw new RangeError(`${label} must be a non-negative finite float32`);
  }
  return result;
}
