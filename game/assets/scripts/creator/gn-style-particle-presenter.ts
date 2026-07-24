import {
  Color,
  Node,
  Sprite,
  UITransform,
  isValid,
} from 'cc';

import {
  GN_STYLE_PARTICLE_CHOREOGRAPHY_CALL_COUNT,
  GN_STYLE_PARTICLE_EMITTER_Z_ORDER,
  createGnStyleParticleEmitterPlans,
  type GnStyleParticleEmitterPlan,
  type GnStyleParticleViewport,
} from '../domain/gn-style-particle-choreography';
import {
  createGnStyleParticleBurst,
  type GnStyleParticleChildPlan,
  type GnStyleParticleExplosionRandom,
} from '../domain/gn-style-particle-explosion';
import {
  GN_STYLE_PARTICLE_FAMILY_RASTER_COUNT,
  GN_STYLE_SUPPLEMENTAL_RASTER_COUNT,
  listGnStyleParticleFamilyRasterResources,
} from '../domain/gn-style-resource-contract';
import type { GameRasterResource } from '../domain/game-resource-contract';
import type { LoadedGameRasterResource } from './game-resource-loader';
import type { LoadedGnStyleResources } from './gn-style-resource-loader';

const INITIAL_SCALE = 1;
const FINAL_SCALE = 0;
const FINAL_ROTATION_DEGREES = 1;
const OPAQUE_CHANNEL = 255;
const WHITE_CHANNEL = 255;
const NO_PARTICLES: readonly PresentedGnStyleParticle[] = Object.freeze([]);

export interface GnStyleParticlePresenterInput {
  readonly random: GnStyleParticleExplosionRandom;
  readonly resources: LoadedGnStyleResources;
  readonly viewport: GnStyleParticleViewport;
}

export interface PresentedGnStyleParticleRoot {
  readonly node: Node;
  readonly plan: GnStyleParticleEmitterPlan;
}

export interface PresentedGnStyleParticle {
  readonly node: Node;
  readonly plan: GnStyleParticleChildPlan;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

export interface GnStyleParticlePresenterState {
  readonly active: boolean;
  readonly attachedRootCount: number;
  readonly burstEmitterCount: number;
  readonly completed: boolean;
  readonly completedParticleCount: number;
  readonly disposed: boolean;
  readonly elapsedActionSeconds: number;
  readonly liveParticleCount: number;
  readonly liveRootCount: number;
  readonly paused: boolean;
  readonly preparedRootCount: number;
  readonly spawnedParticleCount: number;
  readonly started: boolean;
}

interface PreparedParticleInput {
  readonly plans: readonly GnStyleParticleEmitterPlan[];
  readonly random: GnStyleParticleExplosionRandom;
  readonly resourcesByLogicalPath: ReadonlyMap<string, LoadedGameRasterResource>;
}

interface ActiveParticle {
  elapsedActionSeconds: number;
  readonly presented: PresentedGnStyleParticle;
}

interface PreparedEmitter {
  burstStarted: boolean;
  cleaned: boolean;
  completedParticleCount: number;
  readonly node: Node;
  readonly particles: ActiveParticle[];
  readonly plan: GnStyleParticleEmitterPlan;
  readonly resource: LoadedGameRasterResource;
  spawnedParticleCount: number;
}

/**
 * Owns the exact 439-parent GN Style choreography behind one explicit action clock.
 *
 * Construction prepares inactive detached parents only. `start` is the sole attachment and
 * activation boundary. Particle children are created synchronously at their recovered delayed
 * callbacks so construction/start consume no random values.
 */
export class GnStyleParticlePresenter {
  private disposedValue = false;
  private elapsedActionSecondsValue = 0;
  private readonly emitters: PreparedEmitter[] = [];
  private ownerParent: Node | null = null;
  private pausedValue = false;
  private readonly random: GnStyleParticleExplosionRandom;
  private startedValue = false;

  private constructor(input: PreparedParticleInput) {
    this.random = input.random;
  }

  static create(input: GnStyleParticlePresenterInput): GnStyleParticlePresenter {
    const prepared = prepareInput(input);
    const presenter = new GnStyleParticlePresenter(prepared);
    try {
      presenter.prepareEmitters(
        prepared.plans,
        prepared.resourcesByLogicalPath,
      );
      return presenter;
    } catch (error) {
      presenter.disposedValue = true;
      const failures = presenter.destroyAllOwnedNodes();
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'GN Style particle construction rollback failed',
          error,
          failures,
        );
      }
      throw error;
    }
  }

  /** Immutable source-ordered parent ownership snapshot. */
  get roots(): readonly PresentedGnStyleParticleRoot[] {
    return Object.freeze(this.emitters.map(({ node, plan }) => (
      Object.freeze({ node, plan })
    )));
  }

  get state(): GnStyleParticlePresenterState {
    let attachedRootCount = 0;
    let burstEmitterCount = 0;
    let completedParticleCount = 0;
    let liveParticleCount = 0;
    let liveRootCount = 0;
    let spawnedParticleCount = 0;

    for (const emitter of this.emitters) {
      const rootValid = isValid(emitter.node, true);
      if (
        this.ownerParent !== null
        && rootValid
        && emitter.node.parent === this.ownerParent
      ) {
        attachedRootCount += 1;
      }
      if (rootValid && !emitter.cleaned) {
        liveRootCount += 1;
      }
      if (emitter.burstStarted) {
        burstEmitterCount += 1;
      }
      completedParticleCount += emitter.completedParticleCount;
      spawnedParticleCount += emitter.spawnedParticleCount;
      for (const particle of emitter.particles) {
        if (isValid(particle.presented.node, true)) {
          liveParticleCount += 1;
        }
      }
    }

    const completed = this.emitters.length > 0
      && this.emitters.every(({ cleaned }) => cleaned);
    const ownerActive = this.ownerParent !== null
      && isValid(this.ownerParent, true)
      && this.ownerParent.activeInHierarchy;
    return Object.freeze({
      active: this.startedValue
        && !this.pausedValue
        && !this.disposedValue
        && !completed
        && ownerActive,
      attachedRootCount,
      burstEmitterCount,
      completed,
      completedParticleCount,
      disposed: this.disposedValue,
      elapsedActionSeconds: this.elapsedActionSecondsValue,
      liveParticleCount,
      liveRootCount,
      paused: this.pausedValue,
      preparedRootCount: this.emitters.length,
      spawnedParticleCount,
      started: this.startedValue,
    });
  }

  /** Returns currently retained native-style particle children for one source ordinal. */
  particlesForEmitter(
    emitterOrdinal: number,
  ): readonly PresentedGnStyleParticle[] {
    if (!Number.isSafeInteger(emitterOrdinal)) {
      throw new TypeError('emitterOrdinal must be a safe integer');
    }
    const emitter = this.emitters[emitterOrdinal - 1];
    if (emitter === undefined || emitter.plan.ordinal !== emitterOrdinal) {
      throw new RangeError('emitterOrdinal must identify one recovered GN Style row');
    }
    if (emitter.particles.length === 0) {
      return NO_PARTICLES;
    }
    return Object.freeze(
      emitter.particles.map(({ presented }) => presented),
    );
  }

  /**
   * Attaches and activates every recovered parent in canonical source order.
   *
   * All parents share recovered z-order 1. Creator sibling insertion preserves the native
   * equal-z construction order by placing the contiguous source-ordered block from index 1.
   */
  start(parent: Node): void {
    this.assertStartable(parent);
    const previousLayers = this.emitters.map(({ node }) => node.layer);

    try {
      for (const emitter of this.emitters) {
        emitter.node.layer = parent.layer;
        emitter.node.setParent(parent, true);
        emitter.node.setSiblingIndex(
          GN_STYLE_PARTICLE_EMITTER_Z_ORDER + emitter.plan.ordinal - 1,
        );
        emitter.node.active = true;
        if (
          emitter.node.parent !== parent
          || !isValid(emitter.node, true)
          || !emitter.node.activeInHierarchy
        ) {
          throw new Error(
            `GN Style particle root ${String(emitter.plan.ordinal)} failed to start`,
          );
        }
      }
      this.ownerParent = parent;
      this.startedValue = true;
    } catch (error) {
      const failures: unknown[] = [];
      for (let index = this.emitters.length - 1; index >= 0; index -= 1) {
        const emitter = this.emitters[index];
        if (emitter === undefined) {
          continue;
        }
        emitter.node.active = false;
        if (emitter.node.parent !== null) {
          collectFailure(failures, () => emitter.node.setParent(null, true));
        }
      }
      for (let index = 0; index < this.emitters.length; index += 1) {
        const emitter = this.emitters[index];
        const previousLayer = previousLayers[index];
        if (emitter !== undefined && previousLayer !== undefined) {
          emitter.node.active = false;
          emitter.node.layer = previousLayer;
        }
      }
      if (failures.length > 0) {
        this.disposedValue = true;
        failures.push(...this.destroyAllOwnedNodes());
        throw aggregateWithPrimary(
          'GN Style particle start rollback failed',
          error,
          failures,
        );
      }
      throw error;
    }
  }

  /** Advances only this recovered action clock; it is intentionally independent of wall time. */
  updateAction(unscaledDeltaSeconds: number): void {
    assertNonNegativeFinite(unscaledDeltaSeconds, 'unscaledDeltaSeconds');
    if (this.disposedValue) {
      return;
    }
    if (!this.startedValue || this.ownerParent === null) {
      throw new Error('GN Style particles must be started before updating actions');
    }
    if (this.pausedValue) {
      return;
    }
    if (!isValid(this.ownerParent, true)) {
      this.disposeAfterOwnerDestruction();
      return;
    }
    if (!this.ownerParent.activeInHierarchy) {
      return;
    }

    try {
      this.assertLiveOwnership();
      const nextElapsed = Math.min(
        this.elapsedActionSecondsValue + unscaledDeltaSeconds,
        maximumRemoveAtSeconds(this.emitters),
      );

      for (const emitter of this.emitters) {
        if (emitter.cleaned) {
          continue;
        }
        if (
          !emitter.burstStarted
          && reachedBoundary(nextElapsed, emitter.plan.startDelaySeconds)
        ) {
          this.startBurst(emitter);
        }
        if (emitter.burstStarted) {
          this.renderEmitterParticles(emitter, Math.max(
            0,
            nextElapsed - emitter.plan.startDelaySeconds,
          ));
        }
        if (reachedBoundary(nextElapsed, emitter.plan.removeAtSeconds)) {
          this.cleanupEmitter(emitter);
        }
      }

      this.elapsedActionSecondsValue = nextElapsed;
    } catch (error) {
      this.failRuntime(error);
    }
  }

  /** Pauses this presenter's action clock without mutating the 439-node attachment graph. */
  pause(): boolean {
    if (this.disposedValue) {
      return false;
    }
    if (!this.startedValue) {
      throw new Error('GN Style particles must be started before pause');
    }
    if (this.pausedValue) {
      return false;
    }
    this.pausedValue = true;
    return true;
  }

  /** Resumes the same action clock and preserves every pending delay/dynamic action. */
  resume(): boolean {
    if (this.disposedValue) {
      return false;
    }
    if (!this.startedValue) {
      throw new Error('GN Style particles must be started before resume');
    }
    if (!this.pausedValue) {
      return false;
    }
    this.pausedValue = false;
    return true;
  }

  /**
   * Removes every surviving parent/child owned by this presenter.
   *
   * Cleanup attempts all nodes even after a destroy fault. A later idempotent call retries any
   * still-valid nodes while correctly returning `false` for the repeated disposal request.
   */
  dispose(): boolean {
    const firstDisposal = !this.disposedValue;
    this.disposedValue = true;
    this.startedValue = false;
    this.pausedValue = false;
    this.ownerParent = null;
    const failures = this.destroyAllOwnedNodes();
    if (failures.length > 0) {
      throw aggregateFailures('GN Style particle disposal failed', failures);
    }
    return firstDisposal;
  }

  private assertStartable(parent: Node): void {
    if (!isValid(parent, true) || !parent.activeInHierarchy) {
      throw new Error('GN Style particle parent must be valid and active');
    }
    if (this.disposedValue) {
      throw new Error('Disposed GN Style particles cannot start');
    }
    if (this.startedValue || this.ownerParent !== null) {
      throw new Error('GN Style particles can start only once');
    }
    if (this.emitters.length !== GN_STYLE_PARTICLE_CHOREOGRAPHY_CALL_COUNT) {
      throw new Error('GN Style particle presenter omitted recovered roots');
    }
    for (const emitter of this.emitters) {
      if (
        !isValid(emitter.node, true)
        || emitter.node.parent !== null
        || emitter.node.active
        || emitter.burstStarted
        || emitter.cleaned
        || emitter.particles.length !== 0
      ) {
        throw new Error(
          `GN Style particle root ${String(emitter.plan.ordinal)} is not startable`,
        );
      }
    }
  }

  private assertLiveOwnership(): void {
    for (const emitter of this.emitters) {
      if (emitter.cleaned) {
        continue;
      }
      if (
        !isValid(emitter.node, true)
        || emitter.node.parent !== this.ownerParent
        || !emitter.node.activeInHierarchy
      ) {
        throw new Error(
          `GN Style particle root ${String(emitter.plan.ordinal)} lost ownership`,
        );
      }
    }
  }

  private prepareEmitters(
    plans: readonly GnStyleParticleEmitterPlan[],
    resourcesByLogicalPath: ReadonlyMap<string, LoadedGameRasterResource>,
  ): void {
    for (const plan of plans) {
      const resource = resourcesByLogicalPath.get(plan.textureLogicalPath);
      if (resource === undefined) {
        throw new Error(
          `GN Style particle raster was not staged: ${plan.textureLogicalPath}`,
        );
      }
      const node = createDetachedEmitterNode(plan);
      this.emitters.push({
        burstStarted: false,
        cleaned: false,
        completedParticleCount: 0,
        node,
        particles: [],
        plan,
        resource,
        spawnedParticleCount: 0,
      });
    }
  }

  private startBurst(emitter: PreparedEmitter): void {
    const burst = createGnStyleParticleBurst(emitter.plan, this.random);
    if (
      burst.emitterOrdinal !== emitter.plan.ordinal
      || burst.particles.length !== emitter.plan.particleCount
    ) {
      throw new Error(
        `GN Style particle burst ${String(emitter.plan.ordinal)} changed cardinality`,
      );
    }

    const provisional: ActiveParticle[] = [];
    try {
      for (const plan of burst.particles) {
        const presented = createDetachedParticleNode(
          emitter.plan.ordinal,
          plan,
          emitter.resource,
          emitter.node.layer,
        );
        const particle: ActiveParticle = {
          elapsedActionSeconds: 0,
          presented,
        };
        provisional.push(particle);
        presented.node.setParent(emitter.node);
        // Every native ParticleObject has equal z-order 1; sibling order carries source order.
        presented.node.setSiblingIndex(plan.index);
        presented.node.active = true;
        if (
          presented.node.parent !== emitter.node
          || !isValid(presented.node, true)
          || !presented.node.activeInHierarchy
        ) {
          throw new Error(
            `GN Style particle child ${String(plan.index)} failed to attach`,
          );
        }
      }
    } catch (error) {
      const failures: unknown[] = [];
      for (const { presented } of provisional) {
        if (isValid(presented.node, true)) {
          collectFailure(failures, () => presented.node.destroy());
        }
      }
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          `GN Style particle burst ${String(emitter.plan.ordinal)} rollback failed`,
          error,
          failures,
        );
      }
      throw error;
    }

    emitter.particles.push(...provisional);
    emitter.spawnedParticleCount = provisional.length;
    emitter.burstStarted = true;
  }

  private renderEmitterParticles(
    emitter: PreparedEmitter,
    elapsedSinceBurst: number,
  ): void {
    let completedParticleCount = 0;
    for (const particle of emitter.particles) {
      const durationSeconds = particle.presented.plan.durationSeconds;
      particle.elapsedActionSeconds = Math.min(
        elapsedSinceBurst,
        durationSeconds,
      );
      const progress = durationSeconds === 0
        ? 1
        : particle.elapsedActionSeconds / durationSeconds;
      particle.presented.node.setPosition(
        progress === 0 ? 0 : particle.presented.plan.deltaLocal.x * progress,
        progress === 0 ? 0 : particle.presented.plan.deltaLocal.y * progress,
        0,
      );
      const scale = INITIAL_SCALE + (FINAL_SCALE - INITIAL_SCALE) * progress;
      particle.presented.node.setScale(scale, scale, INITIAL_SCALE);
      particle.presented.node.setRotationFromEuler(
        FINAL_ROTATION_DEGREES * progress,
        FINAL_ROTATION_DEGREES * progress,
        0,
      );
      if (particle.elapsedActionSeconds >= durationSeconds) {
        completedParticleCount += 1;
      }
      // Fade and auto-delete are recovered false: scale-zero children remain until root cleanup.
    }
    emitter.completedParticleCount = completedParticleCount;
  }

  private cleanupEmitter(emitter: PreparedEmitter): void {
    const failures = destroyEmitterNodes(emitter);
    if (failures.length > 0) {
      throw aggregateFailures(
        `GN Style particle root ${String(emitter.plan.ordinal)} cleanup failed`,
        failures,
      );
    }
    emitter.cleaned = true;
    emitter.completedParticleCount = emitter.spawnedParticleCount;
  }

  private failRuntime(primary: unknown): never {
    this.disposedValue = true;
    this.startedValue = false;
    this.pausedValue = false;
    this.ownerParent = null;
    const failures = this.destroyAllOwnedNodes();
    if (failures.length > 0) {
      throw aggregateWithPrimary(
        'GN Style particle runtime rollback failed',
        primary,
        failures,
      );
    }
    throw primary;
  }

  private disposeAfterOwnerDestruction(): void {
    this.disposedValue = true;
    this.startedValue = false;
    this.pausedValue = false;
    this.ownerParent = null;
    const failures = this.destroyAllOwnedNodes();
    if (failures.length > 0) {
      throw aggregateFailures(
        'GN Style particle owner-destruction cleanup failed',
        failures,
      );
    }
  }

  private destroyAllOwnedNodes(): unknown[] {
    const failures: unknown[] = [];
    for (const emitter of this.emitters) {
      failures.push(...destroyEmitterNodes(emitter));
      if (!isValid(emitter.node, true)) {
        emitter.cleaned = true;
        emitter.completedParticleCount = emitter.spawnedParticleCount;
      }
    }
    return failures;
  }
}

function prepareInput(
  input: GnStyleParticlePresenterInput,
): PreparedParticleInput {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('input must be an object');
  }
  if (
    input.random === null
    || typeof input.random !== 'object'
    || typeof input.random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive(minimum, maximum)');
  }
  if (
    input.resources === null
    || typeof input.resources !== 'object'
    || Array.isArray(input.resources)
  ) {
    throw new TypeError('resources must be loaded GN Style resources');
  }
  if (input.resources.rasterCount !== GN_STYLE_SUPPLEMENTAL_RASTER_COUNT) {
    throw new RangeError(
      `GN Style resources must contain ${
        String(GN_STYLE_SUPPLEMENTAL_RASTER_COUNT)
      } rasters`,
    );
  }
  if (typeof input.resources.raster !== 'function') {
    throw new TypeError('resources.raster must be a function');
  }

  assertViewportMatchesAssetTree(input.viewport, input.resources.assetTree);
  const plans = createGnStyleParticleEmitterPlans(input.viewport);
  if (plans.length !== GN_STYLE_PARTICLE_CHOREOGRAPHY_CALL_COUNT) {
    throw new Error('GN Style choreography must prepare exactly 439 roots');
  }

  const resourceContracts = listGnStyleParticleFamilyRasterResources(
    input.resources.assetTree,
  );
  if (resourceContracts.length !== GN_STYLE_PARTICLE_FAMILY_RASTER_COUNT) {
    throw new Error('GN Style choreography must stage exactly six particle rasters');
  }
  const resourcesByLogicalPath = new Map<string, LoadedGameRasterResource>();
  for (const contract of resourceContracts) {
    const loaded = input.resources.raster(contract);
    assertLoadedParticleRaster(loaded, contract);
    const logicalPath = logicalPathForAssetTree(
      contract.canonicalPath,
      input.resources.assetTree,
    );
    if (resourcesByLogicalPath.has(logicalPath)) {
      throw new Error(`Duplicate GN Style particle raster ${logicalPath}`);
    }
    resourcesByLogicalPath.set(logicalPath, loaded);
  }
  if (resourcesByLogicalPath.size !== GN_STYLE_PARTICLE_FAMILY_RASTER_COUNT) {
    throw new Error('GN Style particle raster closure is incomplete');
  }
  for (const plan of plans) {
    if (!resourcesByLogicalPath.has(plan.textureLogicalPath)) {
      throw new Error(
        `GN Style choreography references unstaged raster ${plan.textureLogicalPath}`,
      );
    }
  }

  return Object.freeze({
    plans,
    random: input.random,
    resourcesByLogicalPath,
  });
}

function createDetachedEmitterNode(plan: GnStyleParticleEmitterPlan): Node {
  const node = new Node(
    `GnStyleParticleEmitter-${threeDigitOrdinal(plan.ordinal)}`,
  );
  try {
    node.active = false;
    node.setWorldPosition(
      plan.emitterWorldPosition.x,
      plan.emitterWorldPosition.y,
      0,
    );
    return node;
  } catch (error) {
    if (isValid(node, true)) {
      try {
        node.destroy();
      } catch (rollbackError) {
        throw aggregateWithPrimary(
          'GN Style particle-root construction rollback failed',
          error,
          [rollbackError],
        );
      }
    }
    throw error;
  }
}

function createDetachedParticleNode(
  emitterOrdinal: number,
  plan: GnStyleParticleChildPlan,
  resource: LoadedGameRasterResource,
  layer: number,
): PresentedGnStyleParticle {
  const node = new Node(
    `GnStyleParticle-${threeDigitOrdinal(emitterOrdinal)}`
    + `-${threeDigitOrdinal(plan.index + 1)}`,
  );
  try {
    node.active = false;
    node.layer = layer;
    node.setPosition(0, 0, 0);
    node.setScale(INITIAL_SCALE, INITIAL_SCALE, INITIAL_SCALE);
    node.setRotationFromEuler(0, 0, 0);

    const transform = node.addComponent(UITransform);
    transform.setAnchorPoint(0.5, 0.5);
    transform.setContentSize(
      resource.dimensions.width,
      resource.dimensions.height,
    );

    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = resource.spriteFrame;
    const color = plan.finalColor;
    sprite.color = color === null
      ? new Color(
        WHITE_CHANNEL,
        WHITE_CHANNEL,
        WHITE_CHANNEL,
        OPAQUE_CHANNEL,
      )
      : new Color(color.red, color.green, color.blue, OPAQUE_CHANNEL);
    // No opacity component, generic particle emitter, custom material, or blend override.

    return Object.freeze({ node, plan, sprite, transform });
  } catch (error) {
    if (isValid(node, true)) {
      try {
        node.destroy();
      } catch (rollbackError) {
        throw aggregateWithPrimary(
          'GN Style particle-child construction rollback failed',
          error,
          [rollbackError],
        );
      }
    }
    throw error;
  }
}

function destroyEmitterNodes(emitter: PreparedEmitter): unknown[] {
  const failures: unknown[] = [];
  for (const { presented } of emitter.particles) {
    if (isValid(presented.node, true)) {
      collectFailure(failures, () => presented.node.destroy());
    }
  }
  if (isValid(emitter.node, true)) {
    collectFailure(failures, () => emitter.node.destroy());
  }
  for (let index = emitter.particles.length - 1; index >= 0; index -= 1) {
    const particle = emitter.particles[index];
    if (
      particle !== undefined
      && !isValid(particle.presented.node, true)
    ) {
      emitter.particles.splice(index, 1);
    }
  }
  return failures;
}

function assertLoadedParticleRaster(
  loaded: LoadedGameRasterResource,
  expected: GameRasterResource,
): void {
  if (loaded === null || typeof loaded !== 'object') {
    throw new TypeError(
      `GN Style raster loader omitted ${expected.canonicalPath}`,
    );
  }
  if (
    loaded.canonicalPath !== expected.canonicalPath
    || loaded.dimensions.width !== expected.dimensions.width
    || loaded.dimensions.height !== expected.dimensions.height
  ) {
    throw new RangeError(
      `GN Style raster must match ${expected.canonicalPath}`,
    );
  }
  if (!isValid(loaded.spriteFrame, true)) {
    throw new Error(
      `GN Style SpriteFrame must be valid for ${expected.canonicalPath}`,
    );
  }
  const original = loaded.spriteFrame.originalSize;
  const rect = loaded.spriteFrame.rect;
  if (
    original.width !== expected.dimensions.width
    || original.height !== expected.dimensions.height
    || rect.width !== expected.dimensions.width
    || rect.height !== expected.dimensions.height
  ) {
    throw new RangeError(
      `GN Style SpriteFrame geometry must match ${expected.canonicalPath}`,
    );
  }
}

function assertViewportMatchesAssetTree(
  viewport: GnStyleParticleViewport,
  assetTree: LoadedGnStyleResources['assetTree'],
): void {
  const expectedWidth = assetTree === '480x800' ? 480 : 720;
  const expectedHeight = assetTree === '480x800' ? 800 : 1280;
  if (
    viewport === null
    || typeof viewport !== 'object'
    || viewport.width !== expectedWidth
    || viewport.height !== expectedHeight
  ) {
    throw new RangeError(
      `GN Style viewport must match staged ${assetTree} resources`,
    );
  }
}

function logicalPathForAssetTree(
  canonicalPath: string,
  assetTree: LoadedGnStyleResources['assetTree'],
): string {
  const prefix = `${assetTree}/`;
  if (!canonicalPath.startsWith(prefix)) {
    throw new RangeError(
      `GN Style raster must remain inside the ${assetTree} tree`,
    );
  }
  return canonicalPath.slice(prefix.length);
}

function maximumRemoveAtSeconds(
  emitters: readonly PreparedEmitter[],
): number {
  let maximum = 0;
  for (const { plan } of emitters) {
    maximum = Math.max(maximum, plan.removeAtSeconds);
  }
  return maximum;
}

function reachedBoundary(elapsedSeconds: number, boundarySeconds: number): boolean {
  const tolerance = Number.EPSILON
    * Math.max(1, Math.abs(boundarySeconds))
    * 8;
  return elapsedSeconds + tolerance >= boundarySeconds;
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function threeDigitOrdinal(value: number): string {
  if (value < 10) {
    return `00${String(value)}`;
  }
  if (value < 100) {
    return `0${String(value)}`;
  }
  return String(value);
}

function collectFailure(
  failures: unknown[],
  action: () => void,
): void {
  try {
    action();
  } catch (error) {
    failures.push(error);
  }
}

function aggregateWithPrimary(
  label: string,
  primary: unknown,
  failures: readonly unknown[],
): Error {
  return new Error(
    `${label}: ${errorMessage(primary)}; ${failures.map(errorMessage).join('; ')}`,
  );
}

function aggregateFailures(
  label: string,
  failures: readonly unknown[],
): Error {
  return new Error(`${label}: ${failures.map(errorMessage).join('; ')}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
