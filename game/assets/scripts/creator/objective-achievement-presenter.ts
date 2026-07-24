import {
  Color,
  Label,
  Node,
  Sprite,
  UITransform,
  isValid,
} from 'cc';

import {
  OBJECTIVE_ACHIEVEMENT_PARTICLE_START_SECONDS,
  ObjectiveAchievementPresentationState,
  createObjectiveAchievementParticleBurst,
  type ObjectiveAchievementEmitterPlan,
  type ObjectiveAchievementParticlePlan,
  type ObjectiveAchievementRandom,
} from '../domain/objective-achievement-presentation';
import type {
  ObjectiveAchievementPopupEvent,
} from '../domain/objectives-manager-state';
import type {
  LoadedBaseGameplayResources,
} from './base-gameplay-resource-loader';
import type { LoadedGameRasterResource } from './game-resource-loader';

const INITIAL_PARTICLE_SCALE = 1;
const FINAL_PARTICLE_ROTATION_DEGREES = 1;
const OPAQUE_CHANNEL = 255;

export interface ObjectiveAchievementPresenterInput {
  readonly event: ObjectiveAchievementPopupEvent;
  readonly random: ObjectiveAchievementRandom;
  readonly resources: LoadedBaseGameplayResources;
  readonly viewport: Readonly<{
    readonly height: number;
    readonly width: number;
  }>;
}

export interface PresentedObjectiveAchievementBanner {
  readonly descriptionLabel: Label;
  readonly node: Node;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

export interface PresentedObjectiveAchievementNextBanner
  extends PresentedObjectiveAchievementBanner {
  readonly rewardLabel: Label;
}

export interface PresentedObjectiveAchievementParticle {
  readonly node: Node;
  readonly plan: ObjectiveAchievementParticlePlan;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

interface PresentedObjectiveAchievementEmitter {
  readonly node: Node;
  readonly plan: ObjectiveAchievementEmitterPlan;
  readonly resource: LoadedGameRasterResource;
}

interface ActiveObjectiveAchievementParticle {
  readonly presented: PresentedObjectiveAchievementParticle;
}

/**
 * Scene-level achievement UI. The five equal-z roots are attached directly to their owning
 * target so the next-objective banner can finish before the owner retires it at natural egress.
 */
export class ObjectiveAchievementPresenter {
  readonly completedBanner: PresentedObjectiveAchievementBanner;
  readonly nextBanner: PresentedObjectiveAchievementNextBanner;

  private readonly activeParticles: ActiveObjectiveAchievementParticle[] = [];
  private attachedValue = false;
  private disposedValue = false;
  private readonly emitters: readonly [
    PresentedObjectiveAchievementEmitter,
    PresentedObjectiveAchievementEmitter,
    PresentedObjectiveAchievementEmitter,
  ];
  private readonly random: ObjectiveAchievementRandom;
  private readonly state: ObjectiveAchievementPresentationState;

  private constructor(input: ObjectiveAchievementPresenterInput) {
    this.random = input.random;
    this.state = new ObjectiveAchievementPresentationState({
      completedBannerHeight:
        input.resources.objectiveAchievement.completedMessage.dimensions.height,
      completedBannerWidth:
        input.resources.objectiveAchievement.completedMessage.dimensions.width,
      completedDescription: input.event.completed.description,
      nextBannerHeight:
        input.resources.objectiveAchievement.nextMessage.dimensions.height,
      nextBannerWidth:
        input.resources.objectiveAchievement.nextMessage.dimensions.width,
      nextDescription: input.event.next.description,
      nextReward: input.event.nextRewardText,
      viewportHeight: input.viewport.height,
      viewportWidth: input.viewport.width,
    });

    const plan = this.state.plan;
    this.completedBanner = createCompletedBanner(
      input.resources.objectiveAchievement.completedMessage,
      input.resources,
      plan.completed.description,
      plan.completed.descriptionFontSize,
      plan.completed.descriptionLocalPosition,
    );
    this.nextBanner = createNextBanner(
      input.resources.objectiveAchievement.nextMessage,
      input.resources,
      plan.next.description,
      plan.next.descriptionFontSize,
      plan.next.descriptionLocalPosition,
      plan.next.reward,
      plan.next.rewardFontSize,
      plan.next.rewardLocalPosition,
    );
    this.emitters = Object.freeze(plan.particleEmitters.map((emitter) => (
      createEmitter(
        emitter,
        emitter.texture === 'xmas-five'
          ? input.resources.objectiveAchievement.xmasFive
          : input.resources.objectiveAchievement.xmasFour,
      )
    )) as unknown as ObjectiveAchievementPresenter['emitters']);
    this.projectBannerPositions();
  }

  static create(
    input: ObjectiveAchievementPresenterInput,
  ): ObjectiveAchievementPresenter {
    assertInput(input);
    return new ObjectiveAchievementPresenter(input);
  }

  get isAttached(): boolean {
    return this.attachedValue;
  }

  get isComplete(): boolean {
    return this.state.snapshot.complete;
  }

  get isDisposed(): boolean {
    return this.disposedValue;
  }

  get particles(): readonly PresentedObjectiveAchievementParticle[] {
    return Object.freeze(this.activeParticles.map(({ presented }) => presented));
  }

  get snapshot() {
    return this.state.snapshot;
  }

  attach(parent: Node): void {
    if (!isValid(parent, true) || !parent.activeInHierarchy) {
      throw new Error('Objective achievement target must be valid and active');
    }
    if (this.disposedValue) {
      throw new Error('Disposed objective achievement cannot be attached');
    }
    if (
      this.attachedValue
      || this.rootNodes().some((node) => node.parent !== null)
    ) {
      throw new Error('Objective achievement is already attached');
    }

    const roots = this.rootNodes();
    try {
      for (let index = 0; index < roots.length; index += 1) {
        const node = roots[index];
        node.layer = parent.layer;
        node.setParent(parent, true);
        // All native adds use z=1. Consecutive sibling placement preserves equal-z insertion:
        // completed banner -> next banner -> emitter 1 -> emitter 2 -> emitter 3.
        node.setSiblingIndex(this.state.plan.zOrder + index);
        node.active = true;
      }
      this.attachedValue = true;
      this.projectBannerPositions();
      this.projectEmitterPositions();
    } catch (error) {
      this.disposedValue = true;
      this.state.dispose();
      const failures: unknown[] = [];
      for (const node of roots) {
        collectFailure(failures, () => {
          if (isValid(node, true)) {
            node.destroy();
          }
        });
      }
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'Objective achievement attachment rollback failed',
          error,
          failures,
        );
      }
      throw error;
    }
  }

  updateAction(deltaSeconds: number): void {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (this.disposedValue) {
      return;
    }
    if (!this.attachedValue) {
      throw new Error('Objective achievement must be attached before update');
    }

    const update = this.state.updateAction(deltaSeconds);
    this.projectBannerPositions();
    if (update.startParticlesNow) {
      this.startParticleBursts();
    }
    if (update.snapshot.particlesStarted) {
      this.projectParticles(
        Math.max(
          0,
          update.snapshot.elapsedActionSeconds
            - OBJECTIVE_ACHIEVEMENT_PARTICLE_START_SECONDS,
        ),
      );
    }
    if (update.removeParticleContainersNow) {
      this.removeParticleContainers();
    }
  }

  /** Explicit target teardown after natural completion or host rollback/destruction. */
  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.state.dispose();
    this.disposedValue = true;
    this.attachedValue = false;
    const failures: unknown[] = [];
    for (const node of this.rootNodes()) {
      collectFailure(failures, () => {
        if (isValid(node, true)) {
          node.destroy();
        }
      });
    }
    this.activeParticles.length = 0;
    throwFailures('Objective achievement disposal', failures);
    return true;
  }

  private projectBannerPositions(): void {
    const snapshot = this.state.snapshot;
    setWorldPosition(
      this.completedBanner.node,
      snapshot.completedBannerWorldPosition.x,
      snapshot.completedBannerWorldPosition.y,
    );
    setWorldPosition(
      this.nextBanner.node,
      snapshot.nextBannerWorldPosition.x,
      snapshot.nextBannerWorldPosition.y,
    );
  }

  private projectEmitterPositions(): void {
    for (const emitter of this.emitters) {
      setWorldPosition(
        emitter.node,
        emitter.plan.worldPosition.x,
        emitter.plan.worldPosition.y,
      );
    }
  }

  private startParticleBursts(): void {
    for (const emitter of this.emitters) {
      const burst = createObjectiveAchievementParticleBurst(
        emitter.plan,
        this.random,
      );
      for (const particlePlan of burst) {
        const presented = createParticle(
          emitter,
          particlePlan,
          this.activeParticles.length,
        );
        this.activeParticles.push({ presented });
      }
    }
  }

  private projectParticles(elapsedSinceBurst: number): void {
    for (const { presented } of this.activeParticles) {
      const progress = Math.min(
        elapsedSinceBurst / presented.plan.durationSeconds,
        1,
      );
      presented.node.setPosition(
        progress === 0 ? 0 : presented.plan.deltaLocal.x * progress,
        progress === 0 ? 0 : presented.plan.deltaLocal.y * progress,
        0,
      );
      const scale = INITIAL_PARTICLE_SCALE * (1 - progress);
      presented.node.setScale(scale, scale, INITIAL_PARTICLE_SCALE);
      presented.node.setRotationFromEuler(
        0,
        0,
        FINAL_PARTICLE_ROTATION_DEGREES * progress,
      );
      // Recovered autoDeleteParticles=false: scale-zero sprites remain until t=4.41 cleanup.
    }
  }

  private removeParticleContainers(): void {
    const failures: unknown[] = [];
    for (const emitter of this.emitters) {
      collectFailure(failures, () => {
        if (isValid(emitter.node, true)) {
          emitter.node.destroy();
        }
      });
    }
    if (failures.length === 0) {
      this.activeParticles.length = 0;
    }
    throwFailures('Objective achievement particle cleanup', failures);
  }

  private rootNodes(): readonly [Node, Node, Node, Node, Node] {
    return [
      this.completedBanner.node,
      this.nextBanner.node,
      this.emitters[0].node,
      this.emitters[1].node,
      this.emitters[2].node,
    ];
  }
}

export function updateAndRetireObjectiveAchievementPresenters(
  presenters: Set<ObjectiveAchievementPresenter>,
  deltaSeconds: number,
  failureLabel: string,
): void {
  assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
  for (const presenter of Array.from(presenters)) {
    let updateFailed = false;
    let updateFailure: unknown;
    try {
      presenter.updateAction(deltaSeconds);
      if (!presenter.isComplete) {
        continue;
      }
    } catch (error) {
      updateFailed = true;
      updateFailure = error;
    }

    // Publish retirement before cleanup so a disposal fault cannot leave a per-frame owner.
    presenters.delete(presenter);
    const cleanupFailures: unknown[] = [];
    collectFailure(cleanupFailures, () => presenter.dispose());
    if (updateFailed) {
      reportObjectiveAchievementPresentationFailure(
        failureLabel,
        updateFailure,
        cleanupFailures,
      );
    } else if (cleanupFailures.length > 0) {
      const [primary, ...remainingFailures] = cleanupFailures;
      reportObjectiveAchievementPresentationFailure(
        failureLabel,
        primary,
        remainingFailures,
      );
    }
  }
}

export function reportObjectiveAchievementPresentationFailure(
  label: string,
  primary: unknown,
  cleanupFailures: readonly unknown[] = [],
): void {
  const cleanupDetails = cleanupFailures.length === 0
    ? ''
    : `; cleanup: ${cleanupFailures.map(errorMessage).join('; ')}`;
  console.error(new Error(
    `${label}: ${errorMessage(primary)}${cleanupDetails}`,
  ));
}

function createCompletedBanner(
  resource: LoadedGameRasterResource,
  resources: LoadedBaseGameplayResources,
  description: string,
  fontSize: number,
  descriptionPosition: Readonly<{ readonly x: number; readonly y: number }>,
): PresentedObjectiveAchievementBanner {
  const banner = createBanner('ObjectiveAchievementCompleted', resource);
  const descriptionLabel = createLabel(
    'ObjectiveAchievementCompletedDescription',
    resources,
    description,
    fontSize,
    descriptionPosition,
  );
  descriptionLabel.node.setParent(banner.node);
  descriptionLabel.node.setSiblingIndex(1);
  return Object.freeze({
    ...banner,
    descriptionLabel: descriptionLabel.label,
  });
}

function createNextBanner(
  resource: LoadedGameRasterResource,
  resources: LoadedBaseGameplayResources,
  description: string,
  descriptionFontSize: number,
  descriptionPosition: Readonly<{ readonly x: number; readonly y: number }>,
  reward: string,
  rewardFontSize: number,
  rewardPosition: Readonly<{ readonly x: number; readonly y: number }>,
): PresentedObjectiveAchievementNextBanner {
  const banner = createBanner('ObjectiveAchievementNext', resource);
  const descriptionLabel = createLabel(
    'ObjectiveAchievementNextDescription',
    resources,
    description,
    descriptionFontSize,
    descriptionPosition,
  );
  const rewardLabel = createLabel(
    'ObjectiveAchievementNextReward',
    resources,
    reward,
    rewardFontSize,
    rewardPosition,
  );
  descriptionLabel.node.setParent(banner.node);
  rewardLabel.node.setParent(banner.node);
  descriptionLabel.node.setSiblingIndex(0);
  rewardLabel.node.setSiblingIndex(1);
  return Object.freeze({
    ...banner,
    descriptionLabel: descriptionLabel.label,
    rewardLabel: rewardLabel.label,
  });
}

function createBanner(
  name: string,
  resource: LoadedGameRasterResource,
): Omit<PresentedObjectiveAchievementBanner, 'descriptionLabel'> {
  const node = new Node(name);
  node.active = false;
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(0.5, 0.5);
  transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  sprite.color = opaqueWhite();
  return Object.freeze({ node, sprite, transform });
}

function createLabel(
  name: string,
  resources: LoadedBaseGameplayResources,
  text: string,
  fontSize: number,
  position: Readonly<{ readonly x: number; readonly y: number }>,
): Readonly<{ readonly label: Label; readonly node: Node }> {
  const node = new Node(name);
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(0.5, 0.5);
  const label = node.addComponent(Label);
  label.font = resources.arialFont.font;
  label.fontSize = fontSize;
  label.lineHeight = fontSize;
  label.string = text;
  label.color = opaqueWhite();
  node.setPosition(position.x, position.y, 0);
  return Object.freeze({ label, node });
}

function createEmitter(
  plan: ObjectiveAchievementEmitterPlan,
  resource: LoadedGameRasterResource,
): PresentedObjectiveAchievementEmitter {
  const node = new Node(`ObjectiveAchievementEmitter-${plan.emitterIndex + 1}`);
  node.active = false;
  node.setPosition(plan.worldPosition.x, plan.worldPosition.y, 0);
  return Object.freeze({ node, plan, resource });
}

function createParticle(
  emitter: PresentedObjectiveAchievementEmitter,
  plan: ObjectiveAchievementParticlePlan,
  siblingIndex: number,
): PresentedObjectiveAchievementParticle {
  const node = new Node(
    `ObjectiveAchievementParticle-${plan.emitterIndex + 1}-${plan.particleIndex + 1}`,
  );
  node.active = false;
  node.layer = emitter.node.layer;
  node.setPosition(0, 0, 0);
  node.setScale(1, 1, 1);
  node.setRotationFromEuler(0, 0, 0);
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(0.5, 0.5);
  transform.setContentSize(
    emitter.resource.dimensions.width,
    emitter.resource.dimensions.height,
  );
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = emitter.resource.spriteFrame;
  sprite.color = opaqueWhite();
  node.setParent(emitter.node);
  node.setSiblingIndex(siblingIndex);
  node.active = true;
  return Object.freeze({ node, plan, sprite, transform });
}

function setWorldPosition(node: Node, x: number, y: number): void {
  if (node.parent === null) {
    node.setPosition(x, y, 0);
  } else {
    node.setWorldPosition(x, y, 0);
  }
}

function opaqueWhite(): Color {
  return new Color(
    OPAQUE_CHANNEL,
    OPAQUE_CHANNEL,
    OPAQUE_CHANNEL,
    OPAQUE_CHANNEL,
  );
}

function assertInput(input: ObjectiveAchievementPresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Objective achievement input must be an object');
  }
  if (
    input.event === null
    || typeof input.event !== 'object'
    || input.event.type !== 'objective-achievement'
  ) {
    throw new TypeError('Objective achievement event is required');
  }
  if (
    input.random === null
    || typeof input.random !== 'object'
    || typeof input.random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('Objective achievement random must provide nextIntInclusive()');
  }
  if (input.resources === null || typeof input.resources !== 'object') {
    throw new TypeError('Loaded base-gameplay resources are required');
  }
  assertPositiveFinite(input.viewport?.width, 'viewport.width');
  assertPositiveFinite(input.viewport?.height, 'viewport.height');
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be finite and positive`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function collectFailure(failures: unknown[], action: () => void): void {
  try {
    action();
  } catch (error) {
    failures.push(error);
  }
}

function throwFailures(label: string, failures: readonly unknown[]): void {
  if (failures.length > 0) {
    throw new Error(
      `${label} failed: ${failures.map(errorMessage).join('; ')}`,
    );
  }
}

function aggregateWithPrimary(
  label: string,
  primary: unknown,
  failures: readonly unknown[],
): Error {
  return new Error(
    `${label}: ${errorMessage(primary)}; cleanup: `
      + failures.map(errorMessage).join('; '),
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
