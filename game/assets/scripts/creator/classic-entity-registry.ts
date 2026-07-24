import { Collider2D, Node } from 'cc';

import type { ClassicBoundsCommand } from '../domain/classic-bounds';
import type { CutSegment, CuttableSnapshot } from '../domain/classic-cut-query';
import type {
  ClassicSpawnCommand,
  ClassicTossSound,
} from '../domain/classic-spawn-planner';
import {
  ClassicGeneratedFruit,
  type ClassicGeneratedFruitCutEvent,
  type ClassicGeneratedFruitDisposedEvent,
  type ClassicGeneratedFruitMissEvent,
  type ClassicNormalFruitCreateCommand,
} from './classic-generated-fruit';
import type { ClassicSliceResourceCatalog } from './classic-resource-loader';

export interface ClassicEntityRegistryOptions {
  readonly callAfterStep: (mutation: () => void) => void;
  readonly onDispose: (event: ClassicGeneratedFruitDisposedEvent) => void;
  readonly onFruitCut: (event: ClassicGeneratedFruitCutEvent) => void;
  readonly onFruitMiss: (event: ClassicGeneratedFruitMissEvent) => void;
  readonly onPlayTossSound: (sound: ClassicTossSound) => void;
  readonly resourceCatalog: ClassicSliceResourceCatalog;
}

export interface ClassicEntityBoundsEvaluation {
  readonly commands: readonly ClassicBoundsCommand[];
  readonly entityOccurrenceId: number;
}

/** Runtime-only entity ownership and raycast resolution for the bounded normal-fruit slice. */
export class ClassicEntityRegistry {
  private readonly byCollider = new Map<Collider2D, ClassicGeneratedFruit>();
  private readonly byOccurrenceId = new Map<number, ClassicGeneratedFruit>();
  private readonly byTargetId = new Map<string, ClassicGeneratedFruit>();
  private readonly options: ClassicEntityRegistryOptions;
  private readonly rayQueryCutEntities = new Set<ClassicGeneratedFruit>();
  private rayQueryActive = false;

  constructor(options: ClassicEntityRegistryOptions) {
    assertOptions(options);
    this.options = options;
  }

  get size(): number {
    return this.byOccurrenceId.size;
  }

  applySpawnPlan(
    commands: readonly ClassicSpawnCommand[],
    parent: Node,
    viewport: Readonly<{ width: number; height: number }>,
  ): ClassicGeneratedFruit {
    const createCommand = validateBoundedNormalFruitPlan(commands);
    if (this.byOccurrenceId.has(createCommand.entityOccurrenceId)) {
      throw new Error(
        `Classic entity occurrence ${createCommand.entityOccurrenceId} is already registered`,
      );
    }

    const entity = ClassicGeneratedFruit.create(
      createCommand,
      viewport,
      this.options.resourceCatalog.normalFruit(createCommand.fruitId),
      {
        callAfterStep: this.options.callAfterStep,
        onCut: this.options.onFruitCut,
        onDisposed: (event) => this.unregisterDisposedEntity(entity, event),
        onMiss: this.options.onFruitMiss,
      },
    );
    this.register(entity);

    try {
      for (const command of commands) {
        switch (command.type) {
          case 'create-fruit':
            break;
          case 'set-transform':
            entity.setTransform(command.positionMetres, command.angleRadians);
            break;
          case 'set-linear-velocity':
            entity.setLinearVelocity(command.metresPerSecond);
            break;
          case 'set-angular-velocity':
            entity.setAngularVelocity(command.radiansPerSecond);
            break;
          case 'attach-spawned-entity':
            entity.attach(parent, command.zOrder);
            break;
          case 'play-toss-sound':
            this.options.onPlayTossSound(command.sound);
            break;
          case 'reset-linear-velocity':
          case 'create-bomb':
          case 'create-dragon-fruit':
            throw unsupportedCommand(command);
        }
      }
    } catch (error) {
      entity.queueDispose('spawn-failed');
      throw error;
    }
    return entity;
  }

  getByOccurrenceId(entityOccurrenceId: number): ClassicGeneratedFruit | null {
    assertPositiveSafeInteger(entityOccurrenceId, 'entityOccurrenceId');
    return this.byOccurrenceId.get(entityOccurrenceId) ?? null;
  }

  resolveCollider(collider: Collider2D): ClassicGeneratedFruit | null {
    return this.byCollider.get(collider) ?? null;
  }

  cuttableSnapshotForCollider(collider: Collider2D): CuttableSnapshot | null {
    return this.resolveCollider(collider)?.snapshot() ?? null;
  }

  cuttableSnapshots(): readonly CuttableSnapshot[] {
    return Object.freeze(
      Array.from(this.byOccurrenceId.values()).map((entity) => entity.snapshot()),
    );
  }

  cut(targetId: string, segment: CutSegment): boolean {
    if (typeof targetId !== 'string' || targetId.length === 0) {
      throw new TypeError('targetId must be a non-empty string');
    }
    const entity = this.byTargetId.get(targetId);
    if (entity === undefined) {
      return false;
    }
    if (!this.rayQueryActive) {
      return entity.cut(segment);
    }

    const alreadyQueued = this.rayQueryCutEntities.has(entity);
    this.rayQueryCutEntities.add(entity);
    try {
      const cut = entity.cutWithinRayQuery(segment);
      if (!cut && !alreadyQueued) {
        this.rayQueryCutEntities.delete(entity);
      }
      return cut;
    } catch (error) {
      // Keep the entity queued so the batch's finally block still disposes it.
      throw error;
    }
  }

  runRayQueryCutBatch(execute: () => void): void {
    if (typeof execute !== 'function') {
      throw new TypeError('execute must be a function');
    }
    if (this.rayQueryActive) {
      throw new Error('Classic ray-query cut batches cannot be nested');
    }

    this.rayQueryActive = true;
    try {
      execute();
    } finally {
      this.rayQueryActive = false;
      const cutEntities = Array.from(this.rayQueryCutEntities);
      this.rayQueryCutEntities.clear();
      for (const entity of cutEntities) {
        entity.completeRayQueryCuts();
      }
    }
  }

  evaluateBounds(
    viewport: Readonly<{ width: number; height: number }>,
  ): readonly ClassicEntityBoundsEvaluation[] {
    const evaluations: ClassicEntityBoundsEvaluation[] = [];
    for (const entity of Array.from(this.byOccurrenceId.values())) {
      const commands = entity.evaluateBounds(viewport);
      if (commands.length > 0) {
        evaluations.push(Object.freeze({
          commands,
          entityOccurrenceId: entity.entityOccurrenceId,
        }));
      }
    }
    return Object.freeze(evaluations);
  }

  disposeAll(): void {
    for (const entity of Array.from(this.byOccurrenceId.values())) {
      entity.queueDispose('registry-dispose-all');
    }
  }

  private register(entity: ClassicGeneratedFruit): void {
    if (
      this.byOccurrenceId.has(entity.entityOccurrenceId)
      || this.byTargetId.has(entity.targetId)
      || this.byCollider.has(entity.collider)
    ) {
      throw new Error('Classic generated fruit registry key collision');
    }
    this.byOccurrenceId.set(entity.entityOccurrenceId, entity);
    this.byTargetId.set(entity.targetId, entity);
    this.byCollider.set(entity.collider, entity);
  }

  private unregisterDisposedEntity(
    entity: ClassicGeneratedFruit,
    event: ClassicGeneratedFruitDisposedEvent,
  ): void {
    if (this.byOccurrenceId.get(entity.entityOccurrenceId) === entity) {
      this.byOccurrenceId.delete(entity.entityOccurrenceId);
    }
    if (this.byTargetId.get(entity.targetId) === entity) {
      this.byTargetId.delete(entity.targetId);
    }
    if (this.byCollider.get(entity.collider) === entity) {
      this.byCollider.delete(entity.collider);
    }
    this.options.onDispose(event);
  }
}

function validateBoundedNormalFruitPlan(
  commands: readonly ClassicSpawnCommand[],
): ClassicNormalFruitCreateCommand {
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new TypeError('Classic spawn commands must be a non-empty array');
  }

  const first = commands[0];
  if (first.type !== 'create-fruit' || first.tossType !== 0) {
    throw new RangeError(
      'Generated Classic slice only supports a leading create-fruit tossType 0 command',
    );
  }
  const occurrenceId = first.entityOccurrenceId;
  assertPositiveSafeInteger(occurrenceId, 'entityOccurrenceId');

  let createCount = 0;
  let attachCount = 0;
  let tossSoundCount = 0;
  for (const command of commands) {
    if (command.entityOccurrenceId !== occurrenceId) {
      throw new Error('Classic spawn plan commands must share one entityOccurrenceId');
    }
    switch (command.type) {
      case 'create-fruit':
        if (command.tossType !== 0) {
          throw unsupportedCommand(command);
        }
        createCount += 1;
        break;
      case 'attach-spawned-entity':
        attachCount += 1;
        break;
      case 'set-transform':
      case 'set-linear-velocity':
      case 'set-angular-velocity':
        break;
      case 'play-toss-sound':
        tossSoundCount += 1;
        break;
      case 'reset-linear-velocity':
      case 'create-bomb':
      case 'create-dragon-fruit':
        throw unsupportedCommand(command);
    }
  }

  if (createCount !== 1) {
    throw new Error('Classic normal-fruit spawn plan must create exactly one entity');
  }
  if (attachCount !== 1 || commands[commands.length - 1].type !== 'attach-spawned-entity') {
    throw new Error('Classic normal-fruit spawn plan must end with exactly one attachment');
  }
  if (tossSoundCount > 1) {
    throw new Error('Classic normal-fruit spawn plan may request at most one toss sound');
  }
  return first;
}

function unsupportedCommand(command: ClassicSpawnCommand): Error {
  return new Error(
    `Unsupported Classic spawn command in generated normal-fruit slice: ${command.type}`,
  );
}

function assertOptions(options: ClassicEntityRegistryOptions): void {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('options must be an object');
  }
  for (const callback of [
    options.callAfterStep,
    options.onDispose,
    options.onFruitCut,
    options.onFruitMiss,
    options.onPlayTossSound,
  ]) {
    if (typeof callback !== 'function') {
      throw new TypeError('Classic entity registry callbacks must be functions');
    }
  }
  if (
    options.resourceCatalog === null
    || typeof options.resourceCatalog !== 'object'
    || typeof options.resourceCatalog.normalFruit !== 'function'
  ) {
    throw new TypeError('Classic entity registry requires a loaded resource catalog');
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
}
