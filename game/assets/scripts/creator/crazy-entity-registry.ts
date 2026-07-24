import type { Collider2D, Node } from 'cc';

import type {
  BonusTossCommand,
  BonusTossDirection,
  BonusTossFruitId,
} from '../domain/bonus-toss-strategy';
import type { ClassicBoundsCommand } from '../domain/classic-bounds';
import type { CutSegment, CuttableSnapshot } from '../domain/classic-cut-query';
import {
  CLASSIC_BOMB_TOSS_SOUND,
  CLASSIC_FRUIT_TOSS_SOUND,
  type ClassicCreateCommand,
  type ClassicSpawnCommand,
  type ClassicSpawnPlan,
  type ClassicTossSound,
} from '../domain/classic-spawn-planner';
import type {
  LogicalViewport,
  RecoveredSpawnKinematics,
} from '../domain/spawn-kinematics';
import type { GameplayRandom } from '../domain/gameplay-random';
import {
  ClassicGeneratedBomb,
  type ClassicGeneratedBombCutEvent,
  type ClassicGeneratedBombDisposedEvent,
} from './classic-generated-bomb';
import {
  ClassicGeneratedFruit,
  type ClassicGeneratedFruitCutEvent,
  type ClassicGeneratedFruitDisposedEvent,
  type ClassicGeneratedFruitMissEvent,
} from './classic-generated-fruit';
import type { ClassicSliceResourceCatalog } from './classic-resource-loader';
import type { LoadedCrazyDragonFont } from './crazy-dragon-font-loader';
import {
  CrazyGeneratedDragonFruit,
  type CrazyGeneratedDragonCriticalParticleEvent,
  type CrazyGeneratedDragonFruitDisposedEvent,
  type CrazyGeneratedDragonFruitFinishedEvent,
  type CrazyGeneratedDragonFruitObjectiveEvent,
  type CrazyGeneratedDragonFruitPlayEffectEvent,
  type CrazyGeneratedDragonPhysicsUpdate,
} from './crazy-generated-dragon-fruit';
import {
  CrazyGeneratedSpecialFruit,
  type CrazyGeneratedSpecialFruitCutEvent,
  type CrazyGeneratedSpecialFruitDisposedEvent,
  type CrazyGeneratedSpecialFruitMissEvent,
} from './crazy-generated-special-fruit';
import type { LoadedCrazyResources } from './crazy-resource-loader';

export type CrazyGeneratedEntity =
  | ClassicGeneratedBomb
  | ClassicGeneratedFruit
  | CrazyGeneratedDragonFruit
  | CrazyGeneratedSpecialFruit;

export type CrazyEntityKind =
  | 'bomb'
  | 'dragon-fruit'
  | 'ordinary-fruit'
  | 'special-fruit';

export type CrazyEntityOccurrenceKey =
  | `bonus:${string}:${number}`
  | `shared-planner:${number}`;

export type CrazyEntityDisposedEvent =
  | ClassicGeneratedBombDisposedEvent
  | ClassicGeneratedFruitDisposedEvent
  | CrazyGeneratedDragonFruitDisposedEvent
  | CrazyGeneratedSpecialFruitDisposedEvent;

export type BonusEnableCommand = Extract<
  BonusTossCommand,
  Readonly<{ type: 'enable-bonus' }>
>;

export type BonusTossAudioCommand = Extract<
  BonusTossCommand,
  Readonly<{ type: 'request-bonus-toss-audio' }>
>;

export interface CrazyEntityRegistryOptions {
  readonly callAfterStep: (mutation: () => void) => void;
  readonly classicCatalog: ClassicSliceResourceCatalog;
  readonly crazyResources: LoadedCrazyResources;
  readonly dragonFont: LoadedCrazyDragonFont;
  /**
   * Must be the process-owned gameplay stream also used by the toss planner. Dragon creation
   * consumes no draw; Cut and terminal-piece updates continue from the planner's exact order.
   */
  readonly dragonRandom: Pick<GameplayRandom, 'nextIntInclusive'>;
  readonly effectsEnabled: () => boolean;
  readonly onBeforeBombFreeze: (event: ClassicGeneratedBombCutEvent) => void;
  readonly onBombCut: (event: ClassicGeneratedBombCutEvent) => void;
  readonly onDispose: (event: CrazyEntityDisposedEvent) => void;
  readonly onDragonCriticalParticle: (
    event: CrazyGeneratedDragonCriticalParticleEvent,
  ) => void;
  readonly onDragonFinished: (
    event: CrazyGeneratedDragonFruitFinishedEvent,
  ) => void;
  readonly onDragonObjective: (
    event: CrazyGeneratedDragonFruitObjectiveEvent,
  ) => void;
  readonly onDragonPlayEffect: (
    event: CrazyGeneratedDragonFruitPlayEffectEvent,
  ) => void;
  readonly onEnableBonus: (command: BonusEnableCommand) => void;
  readonly onOrdinaryFruitCut: (event: ClassicGeneratedFruitCutEvent) => void;
  readonly onOrdinaryFruitMiss: (event: ClassicGeneratedFruitMissEvent) => void;
  readonly onPlayBonusTossAudio: (command: BonusTossAudioCommand) => void;
  readonly onPlayTossSound: (sound: ClassicTossSound) => void;
  /**
   * Runs synchronously after the standard Bomb's final attach command. Throwing keeps the
   * failure inside applySpawnPlan(), which retains ownership until deferred Bomb disposal
   * commits so a failed scheduling boundary remains retryable.
   */
  readonly onStandardBombAttached: (bomb: ClassicGeneratedBomb) => void;
  readonly onSpecialFruitCut: (event: CrazyGeneratedSpecialFruitCutEvent) => void;
  readonly onSpecialFruitMiss: (event: CrazyGeneratedSpecialFruitMissEvent) => void;
  /**
   * Uses the process-owned gameplay RNG. It is invoked only when the matching BonusToss
   * randomize command is applied, after entity creation and before attachment.
   */
  readonly sampleBonusKinematics: (
    direction: BonusTossDirection,
    viewport: LogicalViewport,
  ) => RecoveredSpawnKinematics;
}

export interface CrazyEntityBoundsEvaluation {
  readonly commands: readonly ClassicBoundsCommand[];
  readonly entityOccurrenceId: number;
  readonly kind: CrazyEntityKind;
  readonly occurrenceKey: CrazyEntityOccurrenceKey;
}

export class CrazySpawnRollbackError extends Error {
  readonly cleanupError: unknown;
  readonly spawnError: unknown;

  constructor(
    occurrenceKey: CrazyEntityOccurrenceKey,
    spawnError: unknown,
    cleanupError: unknown,
  ) {
    super(`Crazy spawn ${occurrenceKey} failed and cleanup could not be queued`);
    this.name = 'CrazySpawnRollbackError';
    this.cleanupError = cleanupError;
    this.spawnError = spawnError;
  }
}

export type CrazyEntityDrainOperation =
  | 'dispose-all'
  | 'ray-query-finalization';

export interface CrazyEntityDrainFailure {
  readonly error: unknown;
  readonly occurrenceKey: CrazyEntityOccurrenceKey | null;
  readonly phase:
    | 'drain-dragon-effect'
    | 'execute'
    | 'finalize'
    | 'queue-dispose';
}

export class CrazyEntityDrainError extends Error {
  readonly failures: readonly CrazyEntityDrainFailure[];
  readonly operation: CrazyEntityDrainOperation;

  constructor(
    operation: CrazyEntityDrainOperation,
    failures: readonly CrazyEntityDrainFailure[],
  ) {
    super(`Crazy ${operation} failed at ${failures.length} boundary/boundaries`);
    this.name = 'CrazyEntityDrainError';
    this.operation = operation;
    this.failures = Object.freeze(failures.map((failure) => Object.freeze({
      ...failure,
    })));
  }
}

interface RegisteredEntityBase {
  readonly entityOccurrenceId: number;
  readonly occurrenceKey: CrazyEntityOccurrenceKey;
}

interface RegisteredBomb extends RegisteredEntityBase {
  readonly entity: ClassicGeneratedBomb;
  readonly kind: 'bomb';
}

interface RegisteredOrdinaryFruit extends RegisteredEntityBase {
  readonly entity: ClassicGeneratedFruit;
  readonly kind: 'ordinary-fruit';
}

interface RegisteredDragonFruit extends RegisteredEntityBase {
  readonly entity: CrazyGeneratedDragonFruit;
  readonly kind: 'dragon-fruit';
}

interface RegisteredSpecialFruit extends RegisteredEntityBase {
  readonly entity: CrazyGeneratedSpecialFruit;
  readonly kind: 'special-fruit';
}

type RegisteredEntity =
  | RegisteredBomb
  | RegisteredDragonFruit
  | RegisteredOrdinaryFruit
  | RegisteredSpecialFruit;

type RegisteredFruit = RegisteredOrdinaryFruit | RegisteredSpecialFruit;

interface ActiveDragonEffect {
  readonly entity: CrazyGeneratedDragonFruit;
  readonly occurrenceKey: CrazyEntityOccurrenceKey;
  releaseQueued: boolean;
  retained: boolean;
}

interface ValidatedClassicSpawnPlan {
  readonly createCommand: ClassicCreateCommand;
  readonly occurrenceKey: CrazyEntityOccurrenceKey;
}

export interface CrazyDragonEffectPhysicsEvaluation {
  readonly entityOccurrenceId: number;
  readonly occurrenceKey: CrazyEntityOccurrenceKey;
  readonly update: CrazyGeneratedDragonPhysicsUpdate;
}

interface ValidatedBonusSpawnBatch {
  readonly createCommand: Extract<
    BonusTossCommand,
    Readonly<{ type: 'create-bonus-fruit' }>
  >;
  readonly occurrenceKey: CrazyEntityOccurrenceKey;
}

/**
 * Runtime ownership and blade-query resolution for every exact Crazy tossed entity.
 *
 * Shared-planner IDs and controller-local BonusToss IDs remain separate occurrence domains.
 * A completed DragonFruit leaves its original collider registry but remains an explicit effect
 * owner until all four sibling pieces and the sibling counter finish their recovered actions.
 */
export class CrazyEntityRegistry {
  private readonly activeDragonEffects = new Map<
    CrazyEntityOccurrenceKey,
    ActiveDragonEffect
  >();
  private readonly byCollider = new Map<Collider2D, RegisteredEntity>();
  private readonly byOccurrenceKey = new Map<
    CrazyEntityOccurrenceKey,
    RegisteredEntity
  >();
  private readonly byTargetId = new Map<string, RegisteredEntity>();
  private readonly options: CrazyEntityRegistryOptions;
  private readonly rayQueryCutFruit = new Set<RegisteredFruit>();
  private rayQueryActive = false;

  constructor(options: CrazyEntityRegistryOptions) {
    assertOptions(options);
    this.options = options;
  }

  get size(): number {
    return this.byOccurrenceKey.size;
  }

  get activeDragonEffectCount(): number {
    return this.activeDragonEffects.size;
  }

  /**
   * Advances registered Dragon hit timers and any retained sibling presentation owners.
   * Release remains deferred until the original, counter, and every terminal piece are gone.
   */
  updateDragonEffectsAction(unscaledDeltaSeconds: number): void {
    assertNonNegativeFinite(unscaledDeltaSeconds, 'unscaledDeltaSeconds');
    for (const effect of Array.from(this.activeDragonEffects.values())) {
      if (
        effect.releaseQueued
        || effect.entity.ownedPresentationDisposalQueued
      ) {
        continue;
      }
      effect.entity.updateAction(unscaledDeltaSeconds);
      if (
        effect.entity.stateSnapshot().finished
        && effect.entity.presentationSnapshot().counterText === null
      ) {
        this.scheduleDragonEffectRelease(effect);
      }
    }
  }

  /**
   * Ticks only completed Dragon owners whose original colliders are already unregistered.
   * Registered originals remain covered by evaluateBounds(), which calls their combined
   * original-and-piece physics update exactly once.
   */
  updateDragonEffectsPhysics(
    viewport: LogicalViewport,
  ): readonly CrazyDragonEffectPhysicsEvaluation[] {
    assertViewport(viewport);
    const evaluations: CrazyDragonEffectPhysicsEvaluation[] = [];
    for (const effect of Array.from(this.activeDragonEffects.values())) {
      if (
        !effect.retained
        || effect.releaseQueued
        || effect.entity.ownedPresentationDisposalQueued
        || effect.entity.ownedPresentationDisposed
      ) {
        continue;
      }
      evaluations.push(Object.freeze({
        entityOccurrenceId: effect.entity.entityOccurrenceId,
        occurrenceKey: effect.occurrenceKey,
        update: effect.entity.updatePhysics(viewport),
      }));
    }
    return Object.freeze(evaluations);
  }

  applySpawnPlan(
    plan: ClassicSpawnPlan,
    parent: Node,
    viewport: LogicalViewport,
  ): CrazyGeneratedEntity {
    const validated = validateClassicSpawnPlan(plan);
    this.assertOccurrenceAvailable(validated.occurrenceKey);

    const record = this.createSharedPlannerEntity(
      validated.createCommand,
      validated.occurrenceKey,
      viewport,
    );
    this.register(record);

    try {
      for (const command of plan.commands) {
        this.applyClassicSpawnCommand(record.entity, command, parent);
      }
      return record.entity;
    } catch (error) {
      this.rollbackSpawn(record, error);
    }
  }

  applyBonusSpawnBatch(
    commands: readonly BonusTossCommand[],
    parent: Node,
    viewport: LogicalViewport,
  ): CrazyGeneratedSpecialFruit {
    const validated = validateBonusSpawnBatch(commands);
    this.assertOccurrenceAvailable(validated.occurrenceKey);

    const record = this.createBonusEntity(
      validated.createCommand,
      validated.occurrenceKey,
      viewport,
    );
    this.register(record);

    let bonusCommitted = false;
    try {
      for (const command of commands) {
        switch (command.type) {
          case 'create-bonus-fruit':
            break;
          case 'randomize-bonus-fruit': {
            const kinematics = this.options.sampleBonusKinematics(
              command.direction,
              viewport,
            );
            applyBonusKinematics(record.entity, command.direction, kinematics);
            break;
          }
          case 'attach-bonus-fruit':
            record.entity.attach(parent, command.zOrder);
            break;
          case 'enable-bonus':
            this.options.onEnableBonus(command);
            // Native order attaches and enables before optional audio. Once the enable
            // callback succeeds, removing the entity would leave BonusManager enabled with
            // no corresponding cuttable fruit, so the entity transaction is committed here.
            bonusCommitted = true;
            break;
          case 'request-bonus-toss-audio':
            this.options.onPlayBonusTossAudio(command);
            break;
        }
      }
      return record.entity;
    } catch (error) {
      if (bonusCommitted) {
        throw error;
      }
      this.rollbackSpawn(record, error);
    }
  }

  getByOccurrenceKey(
    occurrenceKey: CrazyEntityOccurrenceKey,
  ): CrazyGeneratedEntity | null {
    assertOccurrenceKey(occurrenceKey);
    return this.byOccurrenceKey.get(occurrenceKey)?.entity ?? null;
  }

  getSharedPlannerEntity(entityOccurrenceId: number): CrazyGeneratedEntity | null {
    return this.getByOccurrenceKey(sharedPlannerOccurrenceKey(entityOccurrenceId));
  }

  getBonusEntity(
    controllerId: string,
    entityOccurrenceId: number,
  ): CrazyGeneratedSpecialFruit | null {
    const record = this.byOccurrenceKey.get(
      bonusOccurrenceKey(controllerId, entityOccurrenceId),
    );
    if (record === undefined) {
      return null;
    }
    if (record.kind !== 'special-fruit') {
      throw new Error('Crazy BonusToss occurrence resolved to a non-special entity');
    }
    return record.entity;
  }

  resolveCollider(collider: Collider2D): CrazyGeneratedEntity | null {
    return this.byCollider.get(collider)?.entity ?? null;
  }

  resolveBombCollider(collider: Collider2D): ClassicGeneratedBomb | null {
    const record = this.byCollider.get(collider);
    return record?.kind === 'bomb' ? record.entity : null;
  }

  cuttableSnapshotForCollider(collider: Collider2D): CuttableSnapshot | null {
    return this.resolveCollider(collider)?.snapshot() ?? null;
  }

  cuttableSnapshots(): readonly CuttableSnapshot[] {
    return Object.freeze(
      Array.from(this.byOccurrenceKey.values()).map(({ entity }) => entity.snapshot()),
    );
  }

  cut(targetId: string, segment: CutSegment): boolean {
    assertTargetId(targetId);
    const record = this.byTargetId.get(targetId);
    if (record === undefined) {
      return false;
    }
    if (
      !this.rayQueryActive
      || record.kind === 'bomb'
      || record.kind === 'dragon-fruit'
    ) {
      return record.entity.cut(segment);
    }

    const alreadyQueued = this.rayQueryCutFruit.has(record);
    this.rayQueryCutFruit.add(record);
    try {
      const cut = record.entity.cutWithinRayQuery(segment);
      if (!cut && !alreadyQueued) {
        this.rayQueryCutFruit.delete(record);
      }
      return cut;
    } catch (error) {
      // Preserve the entry so the batch finally block still performs one fruit disposal.
      throw error;
    }
  }

  runRayQueryCutBatch(execute: () => void): void {
    if (typeof execute !== 'function') {
      throw new TypeError('execute must be a function');
    }
    if (this.rayQueryActive) {
      throw new Error('Crazy ray-query cut batches cannot be nested');
    }

    this.rayQueryActive = true;
    let executeError: unknown;
    let executeFailed = false;
    try {
      execute();
    } catch (error) {
      executeError = error;
      executeFailed = true;
    }

    this.rayQueryActive = false;
    const cutFruit = Array.from(this.rayQueryCutFruit);
    this.rayQueryCutFruit.clear();
    const failures: CrazyEntityDrainFailure[] = [];
    for (const record of cutFruit) {
      try {
        record.entity.completeRayQueryCuts();
      } catch (error) {
        failures.push(Object.freeze({
          error,
          occurrenceKey: record.occurrenceKey,
          phase: 'finalize',
        }));
      }
    }
    if (failures.length > 0) {
      if (executeFailed) {
        failures.unshift(Object.freeze({
          error: executeError,
          occurrenceKey: null,
          phase: 'execute',
        }));
      }
      throw new CrazyEntityDrainError('ray-query-finalization', failures);
    }
    if (executeFailed) {
      throw executeError;
    }
  }

  finishBombAfterHit(targetId: string): boolean {
    assertTargetId(targetId);
    const record = this.byTargetId.get(targetId);
    if (record === undefined) {
      return false;
    }
    if (record.kind !== 'bomb') {
      throw new Error(`Crazy target ${targetId} is not a standard bomb`);
    }
    return record.entity.finishAfterBombHit();
  }

  hasTarget(targetId: string): boolean {
    assertTargetId(targetId);
    return this.byTargetId.has(targetId);
  }

  evaluateBounds(
    viewport: LogicalViewport,
  ): readonly CrazyEntityBoundsEvaluation[] {
    const evaluations: CrazyEntityBoundsEvaluation[] = [];
    for (const record of Array.from(this.byOccurrenceKey.values())) {
      const commands = record.kind === 'dragon-fruit'
        ? record.entity.updatePhysics(viewport).originalBoundsCommands
        : record.entity.evaluateBounds(viewport);
      if (commands.length > 0) {
        evaluations.push(Object.freeze({
          commands,
          entityOccurrenceId: record.entityOccurrenceId,
          kind: record.kind,
          occurrenceKey: record.occurrenceKey,
        }));
      }
    }
    return Object.freeze(evaluations);
  }

  disposeAll(): void {
    const failures: CrazyEntityDrainFailure[] = [];
    const registeredDragonKeys = new Set<CrazyEntityOccurrenceKey>();
    for (const record of Array.from(this.byOccurrenceKey.values())) {
      try {
        if (record.kind === 'dragon-fruit') {
          registeredDragonKeys.add(record.occurrenceKey);
          record.entity.disposeOwnedPresentation('registry-dispose-all');
        } else {
          record.entity.queueDispose('registry-dispose-all');
        }
      } catch (error) {
        failures.push(Object.freeze({
          error,
          occurrenceKey: record.occurrenceKey,
          phase: 'queue-dispose',
        }));
      }
    }
    for (const effect of Array.from(this.activeDragonEffects.values())) {
      if (registeredDragonKeys.has(effect.occurrenceKey)) {
        continue;
      }
      try {
        effect.entity.disposeOwnedPresentation('registry-dispose-all');
        this.scheduleDragonEffectRelease(effect);
      } catch (error) {
        failures.push(Object.freeze({
          error,
          occurrenceKey: effect.occurrenceKey,
          phase: 'drain-dragon-effect',
        }));
      }
    }
    if (failures.length > 0) {
      throw new CrazyEntityDrainError('dispose-all', failures);
    }
  }

  private applyClassicSpawnCommand(
    entity: CrazyGeneratedEntity,
    command: ClassicSpawnCommand,
    parent: Node,
  ): void {
    switch (command.type) {
      case 'create-fruit':
      case 'create-bomb':
      case 'create-dragon-fruit':
        break;
      case 'reset-linear-velocity':
      case 'set-linear-velocity':
        entity.setLinearVelocity(command.metresPerSecond);
        break;
      case 'set-transform':
        entity.setTransform(command.positionMetres, command.angleRadians);
        break;
      case 'set-angular-velocity':
        entity.setAngularVelocity(command.radiansPerSecond);
        break;
      case 'play-toss-sound':
        this.options.onPlayTossSound(command.sound);
        break;
      case 'attach-spawned-entity':
        entity.attach(parent, command.zOrder);
        if (entity instanceof ClassicGeneratedBomb) {
          this.options.onStandardBombAttached(entity);
        }
        break;
    }
  }

  private assertOccurrenceAvailable(
    occurrenceKey: CrazyEntityOccurrenceKey,
  ): void {
    if (
      this.byOccurrenceKey.has(occurrenceKey)
      || this.activeDragonEffects.has(occurrenceKey)
    ) {
      throw new Error(`Crazy entity occurrence ${occurrenceKey} is already registered`);
    }
  }

  private createSharedPlannerEntity(
    command: ValidatedClassicSpawnPlan['createCommand'],
    occurrenceKey: CrazyEntityOccurrenceKey,
    viewport: LogicalViewport,
  ): RegisteredEntity {
    switch (command.type) {
      case 'create-bomb': {
        let record: RegisteredBomb;
        const entity = ClassicGeneratedBomb.create(
          command,
          this.options.classicCatalog.bomb(command.bombId),
          {
            callAfterStep: this.options.callAfterStep,
            onBeforeFreeze: this.options.onBeforeBombFreeze,
            onCut: this.options.onBombCut,
            onDisposed: (event) => this.unregisterDisposedEntity(record, event),
          },
        );
        record = Object.freeze({
          entity,
          entityOccurrenceId: command.entityOccurrenceId,
          kind: 'bomb',
          occurrenceKey,
        });
        return record;
      }
      case 'create-fruit':
        if (command.tossType === 0) {
          let record: RegisteredOrdinaryFruit;
          const entity = ClassicGeneratedFruit.create(
            command,
            viewport,
            this.options.classicCatalog.normalFruit(command.fruitId),
            {
              callAfterStep: this.options.callAfterStep,
              onCut: this.options.onOrdinaryFruitCut,
              onDisposed: (event) => this.unregisterDisposedEntity(record, event),
              onMiss: this.options.onOrdinaryFruitMiss,
            },
          );
          record = Object.freeze({
            entity,
            entityOccurrenceId: command.entityOccurrenceId,
            kind: 'ordinary-fruit',
            occurrenceKey,
          });
          return record;
        }

        {
          let record: RegisteredSpecialFruit;
          const entity = CrazyGeneratedSpecialFruit.create(
            command,
            viewport,
            this.options.crazyResources,
            {
              callAfterStep: this.options.callAfterStep,
              onCut: this.options.onSpecialFruitCut,
              onDisposed: (event) => this.unregisterDisposedEntity(record, event),
              onMiss: this.options.onSpecialFruitMiss,
            },
          );
          record = Object.freeze({
            entity,
            entityOccurrenceId: command.entityOccurrenceId,
            kind: 'special-fruit',
            occurrenceKey,
          });
          return record;
        }
      case 'create-dragon-fruit': {
        let record: RegisteredDragonFruit;
        const entity = CrazyGeneratedDragonFruit.create(
          command,
          viewport,
          this.options.crazyResources,
          this.options.dragonFont,
          this.options.dragonRandom,
          {
            callAfterStep: this.options.callAfterStep,
            effectsEnabled: this.options.effectsEnabled,
            onCriticalParticle: this.options.onDragonCriticalParticle,
            onDisposed: (event) => this.unregisterDisposedEntity(record, event),
            onDragonFinished: this.options.onDragonFinished,
            onObjective: this.options.onDragonObjective,
            onPlayEffect: this.options.onDragonPlayEffect,
          },
        );
        record = Object.freeze({
          entity,
          entityOccurrenceId: command.entityOccurrenceId,
          kind: 'dragon-fruit',
          occurrenceKey,
        });
        return record;
      }
    }
  }

  private createBonusEntity(
    command: ValidatedBonusSpawnBatch['createCommand'],
    occurrenceKey: CrazyEntityOccurrenceKey,
    viewport: LogicalViewport,
  ): RegisteredSpecialFruit {
    let record: RegisteredSpecialFruit;
    const entity = CrazyGeneratedSpecialFruit.create(
      command,
      viewport,
      this.options.crazyResources,
      {
        callAfterStep: this.options.callAfterStep,
        onCut: this.options.onSpecialFruitCut,
        onDisposed: (event) => this.unregisterDisposedEntity(record, event),
        onMiss: this.options.onSpecialFruitMiss,
      },
    );
    record = Object.freeze({
      entity,
      entityOccurrenceId: command.entityOccurrenceId,
      kind: 'special-fruit',
      occurrenceKey,
    });
    return record;
  }

  private register(record: RegisteredEntity): void {
    if (
      this.byOccurrenceKey.has(record.occurrenceKey)
      || this.activeDragonEffects.has(record.occurrenceKey)
      || this.byTargetId.has(record.entity.targetId)
      || this.byCollider.has(record.entity.collider)
    ) {
      throw new Error('Crazy generated entity registry key collision');
    }
    this.byOccurrenceKey.set(record.occurrenceKey, record);
    this.byTargetId.set(record.entity.targetId, record);
    this.byCollider.set(record.entity.collider, record);
    if (record.kind === 'dragon-fruit') {
      this.activeDragonEffects.set(record.occurrenceKey, {
        entity: record.entity,
        occurrenceKey: record.occurrenceKey,
        releaseQueued: false,
        retained: false,
      });
    }
  }

  private rollbackSpawn(record: RegisteredEntity, error: unknown): never {
    try {
      // Keep the record registered until the entity's disposal callback commits. If scheduling
      // fails before execution, disposeAll() retains an owner and can retry the same record.
      record.entity.queueDispose('spawn-failed');
    } catch (cleanupError) {
      throw new CrazySpawnRollbackError(
        record.occurrenceKey,
        error,
        cleanupError,
      );
    }
    throw error;
  }

  private unregisterDisposedEntity(
    record: RegisteredEntity,
    event: CrazyEntityDisposedEvent,
  ): void {
    this.unregister(record);
    if (record.kind === 'dragon-fruit') {
      const effect = this.activeDragonEffects.get(record.occurrenceKey);
      if (effect !== undefined && effect.entity === record.entity) {
        if (event.reason === 'dragon-finished') {
          effect.retained = true;
          if (effect.entity.ownedPresentationDisposed) {
            this.scheduleDragonEffectRelease(effect);
          }
        } else {
          this.activeDragonEffects.delete(record.occurrenceKey);
        }
      }
    }
    this.options.onDispose(event);
  }

  private scheduleDragonEffectRelease(effect: ActiveDragonEffect): void {
    if (!effect.retained || effect.releaseQueued) {
      return;
    }
    effect.releaseQueued = true;
    try {
      this.options.callAfterStep(() => {
        effect.releaseQueued = false;
        if (
          this.activeDragonEffects.get(effect.occurrenceKey) === effect
          && effect.entity.ownedPresentationDisposed
        ) {
          this.activeDragonEffects.delete(effect.occurrenceKey);
        }
      });
    } catch (error) {
      effect.releaseQueued = false;
      throw error;
    }
  }

  private removeDragonEffect(record: RegisteredEntity): void {
    if (record.kind !== 'dragon-fruit') {
      return;
    }
    const effect = this.activeDragonEffects.get(record.occurrenceKey);
    if (effect?.entity === record.entity) {
      this.activeDragonEffects.delete(record.occurrenceKey);
    }
  }

  private unregister(record: RegisteredEntity): void {
    if (this.byOccurrenceKey.get(record.occurrenceKey) === record) {
      this.byOccurrenceKey.delete(record.occurrenceKey);
    }
    if (this.byTargetId.get(record.entity.targetId) === record) {
      this.byTargetId.delete(record.entity.targetId);
    }
    if (this.byCollider.get(record.entity.collider) === record) {
      this.byCollider.delete(record.entity.collider);
    }
    this.rayQueryCutFruit.delete(record as RegisteredFruit);
  }
}

export function sharedPlannerOccurrenceKey(
  entityOccurrenceId: number,
): CrazyEntityOccurrenceKey {
  assertPositiveSafeInteger(entityOccurrenceId, 'entityOccurrenceId');
  return `shared-planner:${entityOccurrenceId}`;
}

export function bonusOccurrenceKey(
  controllerId: string,
  entityOccurrenceId: number,
): CrazyEntityOccurrenceKey {
  assertControllerId(controllerId);
  assertPositiveSafeInteger(entityOccurrenceId, 'entityOccurrenceId');
  return `bonus:${controllerId}:${entityOccurrenceId}`;
}

function validateClassicSpawnPlan(
  plan: ClassicSpawnPlan,
): ValidatedClassicSpawnPlan {
  if (plan === null || typeof plan !== 'object') {
    throw new TypeError('Classic spawn plan must be an object');
  }
  assertPositiveSafeInteger(plan.entityOccurrenceId, 'plan.entityOccurrenceId');
  if (!Array.isArray(plan.commands) || plan.commands.length === 0) {
    throw new TypeError('Classic spawn plan commands must be a non-empty array');
  }

  for (const command of plan.commands) {
    assertClassicCommandObject(command);
    if (command.entityOccurrenceId !== plan.entityOccurrenceId) {
      throw new Error(
        'Crazy shared-planner commands must match plan.entityOccurrenceId',
      );
    }
  }

  const createCommand = plan.commands[0];
  if (
    createCommand.type !== 'create-fruit'
    && createCommand.type !== 'create-bomb'
    && createCommand.type !== 'create-dragon-fruit'
  ) {
    throw new Error('Crazy shared-planner plan must begin with one create command');
  }
  validateSupportedCreateCommand(createCommand);

  let index = 1;
  let hasReset = false;
  if (plan.commands[index]?.type === 'reset-linear-velocity') {
    const reset = plan.commands[index];
    if (
      createCommand.type !== 'create-fruit'
      || (createCommand.tossType !== 3 && createCommand.tossType !== 4)
      || reset.reason !== 'fruit-factory-down-reset'
      || reset.metresPerSecond.x !== 0
      || reset.metresPerSecond.y !== 0
    ) {
      throw new Error('Crazy spawn plan contains an invalid factory velocity reset');
    }
    hasReset = true;
    index += 1;
  }

  const transform = plan.commands[index];
  if (transform?.type !== 'set-transform') {
    throw new Error('Crazy spawn plan must set transform immediately after creation/reset');
  }
  assertFiniteVector(transform.positionMetres, 'positionMetres');
  if (transform.angleRadians !== 0) {
    throw new RangeError('Crazy spawn transform angle must be zero');
  }
  index += 1;

  let hasLinearVelocity = false;
  if (plan.commands[index]?.type === 'set-linear-velocity') {
    const velocity = plan.commands[index];
    if (velocity.reason !== 'spawn-kinematics') {
      throw new Error('Crazy spawn plan contains an invalid velocity reason');
    }
    assertFiniteVector(velocity.metresPerSecond, 'metresPerSecond');
    hasLinearVelocity = true;
    index += 1;
  }

  const angular = plan.commands[index];
  if (angular?.type !== 'set-angular-velocity') {
    throw new Error('Crazy spawn plan must set angular velocity after transform/velocity');
  }
  assertFinite(angular.radiansPerSecond, 'radiansPerSecond');
  index += 1;

  if (plan.commands[index]?.type === 'play-toss-sound') {
    const sound = plan.commands[index];
    const expected = createCommand.type === 'create-bomb'
      ? CLASSIC_BOMB_TOSS_SOUND
      : createCommand.tossType === 0
        ? CLASSIC_FRUIT_TOSS_SOUND
        : null;
    if (sound.sound !== expected) {
      throw new Error('Crazy spawn plan requests an invalid toss sound for its entity');
    }
    index += 1;
  }

  const attachment = plan.commands[index];
  if (
    attachment?.type !== 'attach-spawned-entity'
    || attachment.zOrder !== 1
    || index !== plan.commands.length - 1
  ) {
    throw new Error(
      'Crazy spawn plan must end with exactly one recovered z-order attachment',
    );
  }

  const special = createCommand.type === 'create-fruit'
    && (createCommand.tossType === 3 || createCommand.tossType === 4);
  const dragon = createCommand.type === 'create-dragon-fruit';
  if (hasReset && hasLinearVelocity) {
    throw new Error('Crazy Down special-fruit plan cannot write spawn linear velocity');
  }
  if (special && hasReset === hasLinearVelocity) {
    throw new Error(
      'Crazy special-fruit plan must contain either Down reset or non-Down velocity',
    );
  }
  if (!special && hasReset) {
    throw new Error('Crazy ordinary fruit/bomb plans cannot reset factory velocity');
  }
  if (dragon && hasLinearVelocity) {
    throw new Error('Crazy Down DragonFruit plan cannot write spawn linear velocity');
  }

  return Object.freeze({
    createCommand,
    occurrenceKey: sharedPlannerOccurrenceKey(plan.entityOccurrenceId),
  });
}

function validateBonusSpawnBatch(
  commands: readonly BonusTossCommand[],
): ValidatedBonusSpawnBatch {
  if (!Array.isArray(commands)) {
    throw new TypeError('BonusToss spawn commands must be an array');
  }
  if (commands.length !== 4 && commands.length !== 5) {
    throw new Error('BonusToss spawn batch must contain exactly four or five commands');
  }

  const create = commands[0];
  const randomize = commands[1];
  const attach = commands[2];
  const enable = commands[3];
  const audio = commands[4];
  if (
    create?.type !== 'create-bonus-fruit'
    || randomize?.type !== 'randomize-bonus-fruit'
    || attach?.type !== 'attach-bonus-fruit'
    || enable?.type !== 'enable-bonus'
    || (audio !== undefined && audio.type !== 'request-bonus-toss-audio')
  ) {
    throw new Error(
      'BonusToss spawn batch order must be create, randomize, attach, enable, optional audio',
    );
  }

  assertPositiveSafeInteger(create.entityOccurrenceId, 'entityOccurrenceId');
  assertControllerId(create.controllerId);
  if (
    create.tossType !== 5
    || !isBonusFruitId(create.fruitId)
    || !isBonusDirection(randomize.direction)
    || attach.zOrder !== 1
    || enable.bonusId !== create.fruitId
  ) {
    throw new Error('BonusToss spawn batch contains an invalid recovered command');
  }
  for (const command of commands) {
    if (
      command === null
      || typeof command !== 'object'
      || command.entityOccurrenceId !== create.entityOccurrenceId
    ) {
      throw new Error('BonusToss spawn commands must share one entityOccurrenceId');
    }
  }
  if (
    randomize.controllerId !== create.controllerId
    || attach.controllerId !== create.controllerId
  ) {
    throw new Error('BonusToss spawn commands must share one controllerId');
  }
  if (
    audio !== undefined
    && (audio.canonicalPath !== 'Sounds/tossfruit.wav' || audio.loop !== false)
  ) {
    throw new Error('BonusToss audio command must use the recovered one-shot toss sound');
  }

  return Object.freeze({
    createCommand: create,
    occurrenceKey: bonusOccurrenceKey(
      create.controllerId,
      create.entityOccurrenceId,
    ),
  });
}

function validateSupportedCreateCommand(
  command: ClassicCreateCommand,
): void {
  if (command.type === 'create-bomb') {
    if (command.tossType !== 1 || command.bombId !== 0) {
      throw new RangeError('Crazy standard bomb plan requires tossType 1 and bomb ID 0');
    }
    return;
  }
  if (command.type === 'create-dragon-fruit') {
    if (command.tossType !== 6) {
      throw new RangeError('Crazy DragonFruit plan requires toss type 6');
    }
    return;
  }
  if (command.tossType === 0) {
    if (
      !Number.isSafeInteger(command.fruitId)
      || command.fruitId < 0
      || command.fruitId > 8
      || typeof command.critical !== 'boolean'
    ) {
      throw new RangeError('Crazy ordinary fruit plan requires fruit ID 0 through 8');
    }
    return;
  }
  if (
    (command.tossType === 3 && command.fruitId === 13)
    || (command.tossType === 4 && command.fruitId === 14)
  ) {
    return;
  }
  throw new RangeError('Crazy shared planner supports toss types 0, 1, 3, 4, and 6');
}

function applyBonusKinematics(
  entity: CrazyGeneratedSpecialFruit,
  direction: BonusTossDirection,
  kinematics: RecoveredSpawnKinematics,
): void {
  if (kinematics === null || typeof kinematics !== 'object') {
    throw new TypeError('sampleBonusKinematics must return an object');
  }
  if (kinematics.direction !== direction) {
    throw new Error('sampleBonusKinematics returned a different direction');
  }
  assertFiniteVector(kinematics.positionMetres, 'positionMetres');
  if (kinematics.angleRadians !== 0) {
    throw new RangeError('BonusToss spawn transform angle must be zero');
  }
  assertFinite(
    kinematics.angularVelocityRadiansPerSecond,
    'angularVelocityRadiansPerSecond',
  );

  entity.setTransform(kinematics.positionMetres, kinematics.angleRadians);
  if ('linearVelocityMetresPerSecond' in kinematics) {
    if (direction === 1) {
      throw new Error('BonusToss Down kinematics must not write linear velocity');
    }
    assertFiniteVector(
      kinematics.linearVelocityMetresPerSecond,
      'linearVelocityMetresPerSecond',
    );
    entity.setLinearVelocity(kinematics.linearVelocityMetresPerSecond);
  } else if (direction !== 1) {
    throw new Error('BonusToss side kinematics must write linear velocity');
  }
  entity.setAngularVelocity(kinematics.angularVelocityRadiansPerSecond);
}

function assertOptions(options: CrazyEntityRegistryOptions): void {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('options must be an object');
  }
  for (const callback of [
    options.callAfterStep,
    options.effectsEnabled,
    options.onBeforeBombFreeze,
    options.onBombCut,
    options.onDispose,
    options.onDragonCriticalParticle,
    options.onDragonFinished,
    options.onDragonObjective,
    options.onDragonPlayEffect,
    options.onEnableBonus,
    options.onOrdinaryFruitCut,
    options.onOrdinaryFruitMiss,
    options.onPlayBonusTossAudio,
    options.onPlayTossSound,
    options.onStandardBombAttached,
    options.onSpecialFruitCut,
    options.onSpecialFruitMiss,
    options.sampleBonusKinematics,
  ]) {
    if (typeof callback !== 'function') {
      throw new TypeError('Crazy entity registry callbacks must be functions');
    }
  }
  if (
    options.dragonRandom === null
    || typeof options.dragonRandom !== 'object'
    || typeof options.dragonRandom.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('Crazy entity registry requires the shared Dragon gameplay RNG');
  }
  if (
    options.dragonFont === null
    || typeof options.dragonFont !== 'object'
    || options.dragonFont.canonicalPath !== 'Fonts/Razing.ttf'
    || options.dragonFont.font === null
    || typeof options.dragonFont.font !== 'object'
  ) {
    throw new TypeError('Crazy entity registry requires the loaded Dragon Razing font');
  }
  if (
    options.classicCatalog === null
    || typeof options.classicCatalog !== 'object'
    || typeof options.classicCatalog.normalFruit !== 'function'
    || typeof options.classicCatalog.bomb !== 'function'
  ) {
    throw new TypeError('Crazy entity registry requires a loaded Classic catalog');
  }
  if (
    options.crazyResources === null
    || typeof options.crazyResources !== 'object'
    || typeof options.crazyResources.raster !== 'function'
  ) {
    throw new TypeError('Crazy entity registry requires loaded Crazy resources');
  }
}

function assertClassicCommandObject(
  command: ClassicSpawnCommand,
): void {
  if (command === null || typeof command !== 'object') {
    throw new TypeError('Classic spawn command must be an object');
  }
  assertPositiveSafeInteger(command.entityOccurrenceId, 'entityOccurrenceId');
}

function assertOccurrenceKey(
  occurrenceKey: CrazyEntityOccurrenceKey,
): void {
  if (
    typeof occurrenceKey !== 'string'
    || (
      !occurrenceKey.startsWith('shared-planner:')
      && !occurrenceKey.startsWith('bonus:')
    )
  ) {
    throw new TypeError('occurrenceKey must be a Crazy composite occurrence key');
  }
}

function assertTargetId(targetId: string): void {
  if (typeof targetId !== 'string' || targetId.length === 0) {
    throw new TypeError('targetId must be a non-empty string');
  }
}

function assertControllerId(controllerId: string): void {
  if (typeof controllerId !== 'string' || controllerId.length === 0) {
    throw new TypeError('controllerId must be a non-empty string');
  }
  if (controllerId.includes('\u0000')) {
    throw new RangeError('controllerId must not contain a NUL character');
  }
}

function isBonusFruitId(value: number): value is BonusTossFruitId {
  return value === 10 || value === 11 || value === 12;
}

function isBonusDirection(value: number): value is BonusTossDirection {
  return value === 1 || value === 2 || value === 3;
}

function assertFiniteVector(
  value: Readonly<{ x: number; y: number }>,
  label: string,
): void {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
  assertFinite(value.x, `${label}.x`);
  assertFinite(value.y, `${label}.y`);
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
}

function assertViewport(viewport: LogicalViewport): void {
  if (viewport === null || typeof viewport !== 'object') {
    throw new TypeError('viewport must be an object');
  }
  assertFinite(viewport.width, 'viewport.width');
  assertFinite(viewport.height, 'viewport.height');
  if (viewport.width <= 0 || viewport.height <= 0) {
    throw new RangeError('viewport dimensions must be positive');
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
}
