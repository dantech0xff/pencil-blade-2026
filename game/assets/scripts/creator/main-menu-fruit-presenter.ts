import {
  BoxCollider2D,
  CircleCollider2D,
  Collider2D,
  ERigidBody2DType,
  Node,
  RigidBody2D,
  Size,
  Sprite,
  UIOpacity,
  UITransform,
  Vec2,
  isValid,
} from 'cc';

import type { CutSegment, CuttableSnapshot } from '../domain/classic-cut-query';
import { createClassicCutHalfMotion } from '../domain/classic-cut-half-motion';
import {
  LEGACY_WORLD_UNITS_PER_METRE,
  type FruitFixtureConfiguration,
} from '../domain/classic-fixture-rules';
import {
  MAIN_MENU_ENTRY_FADE_SECONDS,
  MAIN_MENU_FRUIT_CIRCLE_CUT_SECONDS,
  MAIN_MENU_FRUIT_CIRCLE_ROTATION_DEGREES,
  MAIN_MENU_FRUIT_CIRCLE_ROTATION_SECONDS,
  createMainMenuFruitCutPresentationPlan,
  type MainMenuFruitButtonPresentation,
  type MainMenuPoint,
} from '../domain/main-menu-presentation';
import type { MainMenuFruitButtonPurpose } from '../domain/main-menu-resource-contract';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import type { LoadedGameRasterResource } from './game-resource-loader';
import type { LoadedMainMenuResources } from './main-menu-resource-loader';
import {
  MainMenuCutHalfPresenter,
  type MainMenuCutHalfPresenterLifecycle,
} from './main-menu-cut-half-presenter';

export interface MainMenuFruitPresenterInput {
  readonly assetTree: ClassicAssetTree;
  readonly presentation: MainMenuFruitButtonPresentation;
  readonly resources: LoadedMainMenuResources;
  readonly viewport: Readonly<{ readonly height: number; readonly width: number }>;
}

export interface MainMenuFruitPresenterLifecycle extends MainMenuCutHalfPresenterLifecycle {
  readonly onColliderDisposed: (collider: Collider2D) => void;
  readonly onGlobalFruitCut: () => void;
  /**
   * Starts the delayed destination transaction and returns its synchronous rollback.
   * Objective persistence runs after this callback to preserve the recovered ordering.
   */
  readonly onNavigation: (
    purpose: MainMenuFruitButtonPurpose,
  ) => (() => void) | void;
  readonly onPlayFruitAudio: (canonicalPath: string) => void;
  readonly onFruitTypeCut: (fruitId: number) => void;
}

export interface MainMenuFruitPresenterState {
  readonly activated: boolean;
  readonly attached: boolean;
  readonly cutAccepted: boolean;
  readonly cutCommitted: boolean;
  readonly disposed: boolean;
  readonly wrapperCut: boolean;
}

const MAX_OPACITY = 255;
const RADIANS_TO_DEGREES = 180 / Math.PI;

/** Exact blur/circle/intact-fruit wrapper backed by an actual Creator RigidBody2D. */
export class MainMenuFruitPresenter {
  readonly blurNode: Node;
  readonly body: RigidBody2D;
  readonly circleNode: Node;
  readonly collider: Collider2D;
  readonly fruitNode: Node;
  readonly presentation: MainMenuFruitButtonPresentation;
  readonly root: Node;
  readonly targetId: string;

  private activatedValue = false;
  private attachedValue = false;
  private blurOpacity: UIOpacity;
  private circleCutElapsedSeconds: number | null = null;
  private circleOpacity: UIOpacity;
  private cutAcceptedValue = false;
  private cutCommittedValue = false;
  private cutHalfPresenterValue: MainMenuCutHalfPresenter | null = null;
  private disposedValue = false;
  private entryElapsedSeconds = 0;
  private fruitTypeObjectiveProcessed = false;
  private fruitOpacity: UIOpacity;
  private globalObjectiveProcessed = false;
  private readonly input: MainMenuFruitPresenterInput;
  private readonly lifecycle: MainMenuFruitPresenterLifecycle;
  private wrapperCutValue = false;

  private constructor(
    input: MainMenuFruitPresenterInput,
    lifecycle: MainMenuFruitPresenterLifecycle,
  ) {
    this.input = input;
    this.lifecycle = lifecycle;
    this.presentation = input.presentation;
    this.targetId = `main-menu-fruit:${input.presentation.purpose}`;
    this.root = new Node(`${input.presentation.purpose}-fruit-button`);
    this.root.active = false;
    this.root.setWorldPosition(
      input.presentation.wrapperPosition.x,
      input.presentation.wrapperPosition.y,
      0,
    );

    const blur = createSpriteNode(
      'blur',
      input.resources.raster(input.presentation.resources.blur),
      input.presentation.blur.initialOpacity,
    );
    this.blurNode = blur.node;
    this.blurOpacity = blur.opacity;
    this.blurNode.setParent(this.root);
    this.blurNode.setSiblingIndex(0);
    this.blurNode.setPosition(
      input.presentation.blur.initialPosition.x - input.presentation.wrapperPosition.x,
      input.presentation.blur.initialPosition.y - input.presentation.wrapperPosition.y,
      0,
    );

    const circle = createSpriteNode(
      'circle-art',
      input.resources.raster(input.presentation.resources.circle),
      input.presentation.circle.initialOpacity,
    );
    this.circleNode = circle.node;
    this.circleOpacity = circle.opacity;
    this.circleNode.setParent(this.root);
    this.circleNode.setSiblingIndex(1);
    this.circleNode.setPosition(0, 0, 0);

    const fruit = createSpriteNode(
      'intact-fruit',
      input.resources.raster(input.presentation.resources.intact),
      input.presentation.fruit.initialOpacity,
    );
    this.fruitNode = fruit.node;
    this.fruitOpacity = fruit.opacity;
    this.fruitNode.setParent(this.root);
    this.fruitNode.setSiblingIndex(2);
    this.fruitNode.setPosition(0, 0, 0);
    this.fruitNode.setRotationFromEuler(0, 0, 0);

    this.body = this.fruitNode.addComponent(RigidBody2D);
    configureFruitBody(this.body, input.presentation.factoryFixture);
    this.collider = addFruitCollider(
      this.fruitNode,
      input.presentation.factoryFixture,
    );
  }

  static create(
    input: MainMenuFruitPresenterInput,
    lifecycle: MainMenuFruitPresenterLifecycle,
  ): MainMenuFruitPresenter {
    assertInput(input);
    assertLifecycle(lifecycle);
    return new MainMenuFruitPresenter(input, lifecycle);
  }

  get cutHalfPresenter(): MainMenuCutHalfPresenter | null {
    return this.cutHalfPresenterValue;
  }

  get state(): MainMenuFruitPresenterState {
    return Object.freeze({
      activated: this.activatedValue,
      attached: this.attachedValue,
      cutAccepted: this.cutAcceptedValue,
      cutCommitted: this.cutCommittedValue,
      disposed: this.disposedValue,
      wrapperCut: this.wrapperCutValue,
    });
  }

  attach(parent: Node, siblingIndex: number): void {
    if (!isValid(parent, true)) {
      throw new Error('Main Menu FruitButton parent must be valid');
    }
    if (!Number.isSafeInteger(siblingIndex) || siblingIndex < 0) {
      throw new RangeError('FruitButton siblingIndex must be a non-negative safe integer');
    }
    if (this.disposedValue || this.attachedValue || this.root.parent !== null) {
      throw new Error('Main Menu FruitButton cannot attach from its current state');
    }
    this.root.layer = parent.layer;
    applyLayerToChildren(this.root, parent.layer);
    this.root.setParent(parent, true);
    this.root.setSiblingIndex(siblingIndex);
    this.attachedValue = true;
  }

  activate(): void {
    if (this.disposedValue || !this.attachedValue || this.root.parent === null) {
      throw new Error('Main Menu FruitButton must be attached before activation');
    }
    if (this.activatedValue) {
      throw new Error('Main Menu FruitButton can activate only once');
    }
    this.entryElapsedSeconds = 0;
    this.root.active = true;
    this.activatedValue = true;
  }

  /** Returns an uncut FruitButton to its pre-activation state after host activation fails. */
  deactivateAfterActivationFailure(): boolean {
    if (this.disposedValue || !this.activatedValue) {
      return false;
    }
    if (this.cutAcceptedValue) {
      throw new Error('A cut Main Menu FruitButton cannot roll back activation');
    }
    this.activatedValue = false;
    this.entryElapsedSeconds = 0;
    this.rotationElapsedSeconds = 0;
    this.root.active = false;
    this.blurOpacity.opacity = this.presentation.blur.initialOpacity;
    this.circleOpacity.opacity = this.presentation.circle.initialOpacity;
    this.fruitOpacity.opacity = this.presentation.fruit.initialOpacity;
    this.circleNode.setRotationFromEuler(0, 0, 0);
    this.circleNode.setScale(1, 1, 1);
    return true;
  }

  updateAction(deltaSeconds: number): void {
    if (!this.activatedValue || this.disposedValue) {
      return;
    }
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    this.entryElapsedSeconds = Math.min(
      MAIN_MENU_ENTRY_FADE_SECONDS,
      this.entryElapsedSeconds + deltaSeconds,
    );
    this.rotationElapsedSeconds += deltaSeconds;
    const entryOpacity = MAX_OPACITY * (
      this.entryElapsedSeconds / MAIN_MENU_ENTRY_FADE_SECONDS
    );
    if (isValid(this.blurNode, true)) {
      this.blurOpacity.opacity = entryOpacity;
    }
    this.circleOpacity.opacity = entryOpacity;
    if (isValid(this.fruitNode, true)) {
      this.fruitOpacity.opacity = entryOpacity;
    }

    const rotationDelta = mainMenuLegacyRotationToCreatorDegrees(
      MAIN_MENU_FRUIT_CIRCLE_ROTATION_DEGREES,
    );
    const rotationProgress = this.rotationElapsedSeconds
      / MAIN_MENU_FRUIT_CIRCLE_ROTATION_SECONDS;
    this.circleNode.setRotationFromEuler(0, 0, rotationDelta * rotationProgress);

    if (this.circleCutElapsedSeconds !== null) {
      this.circleCutElapsedSeconds = Math.min(
        MAIN_MENU_FRUIT_CIRCLE_CUT_SECONDS,
        this.circleCutElapsedSeconds + deltaSeconds,
      );
      const scale = 1 - (
        this.circleCutElapsedSeconds / MAIN_MENU_FRUIT_CIRCLE_CUT_SECONDS
      );
      this.circleNode.setScale(scale, scale, 1);
    }

    this.cutHalfPresenterValue?.updateAction(deltaSeconds);
    this.cutHalfPresenterValue?.evaluateBounds(this.input.viewport);
  }

  setPosition(position: MainMenuPoint): void {
    assertPoint(position, 'position');
    if (this.disposedValue) {
      throw new Error('Disposed Main Menu FruitButton cannot move');
    }
    this.root.setWorldPosition(position.x, position.y, 0);
    if (this.attachedValue) {
      const postEntry = this.presentation.blur.postEntrySetPosition;
      const wrapper = this.presentation.wrapperPosition;
      this.blurNode.setPosition(
        postEntry.x - wrapper.x,
        postEntry.y - wrapper.y,
        0,
      );
    }
  }

  snapshot(): CuttableSnapshot {
    const position = this.fruitNode.worldPosition;
    return Object.freeze({
      bodyWorldPosition: Object.freeze({ x: position.x, y: position.y }),
      cutDisabled: this.cutAcceptedValue || this.disposedValue,
      id: this.targetId,
      isFruit: true,
      nodeTag: this.collider.tag,
    });
  }

  cut(segment: CutSegment, effectsEnabled: boolean): boolean {
    assertSegment(segment);
    if (!this.activatedValue || this.disposedValue || this.cutAcceptedValue) {
      return false;
    }
    this.cutAcceptedValue = true;
    let cutHalf: MainMenuCutHalfPresenter | null = null;
    let rollbackNavigation: (() => void) | null = null;
    try {
      const sourcePosition = this.fruitNode.worldPosition;
      const sourceMass = this.body.getMass();
      if (!Number.isFinite(sourceMass) || sourceMass <= 0) {
        throw new Error('Main Menu FruitButton requires a positive active body mass before cut');
      }
      const motion = createClassicCutHalfMotion({
        bottomHeightWorldUnits: this.presentation.resources.cutBottom.dimensions.height,
        critical: false,
        segment,
        sourceAngleRadians: readBodyAngleRadians(this.body, this.fruitNode),
        sourceAngularVelocityRadiansPerSecond: this.body.angularVelocity,
        sourceBodyMass: sourceMass,
        sourcePositionWorldUnits: { x: sourcePosition.x, y: sourcePosition.y },
        topHeightWorldUnits: this.presentation.resources.cutTop.dimensions.height,
        viewportWidthWorldUnits: this.input.viewport.width,
      });
      const cutPlan = createMainMenuFruitCutPresentationPlan(
        this.presentation.purpose,
        this.input.assetTree,
        effectsEnabled,
      );
      cutHalf = MainMenuCutHalfPresenter.create({
        assetTree: this.input.assetTree,
        motion,
        purpose: this.presentation.purpose,
        resources: {
          bottom: this.input.resources.raster(this.presentation.resources.cutBottom),
          top: this.input.resources.raster(this.presentation.resources.cutTop),
        },
      }, this.lifecycle);
      const parent = this.root.parent;
      if (parent === null || !parent.activeInHierarchy) {
        throw new Error('Main Menu FruitButton cut requires its active Main Menu parent');
      }

      // FruitButton callback order: halves/audio, destination callback, then Fruit's shared
      // global and per-type objective notifications.
      cutHalf.attach(parent, parent.children.length);
      this.cutHalfPresenterValue = cutHalf;
      const fruitAudio = cutPlan.orderedOperations.find(
        (operation) => operation.type === 'request-fruit-audio',
      );
      if (fruitAudio !== undefined && fruitAudio.type === 'request-fruit-audio') {
        this.lifecycle.onPlayFruitAudio(fruitAudio.canonicalPath);
      }
      rollbackNavigation = (
        this.lifecycle.onNavigation(this.presentation.purpose) ?? null
      );
      this.processObjectiveNotificationsOnce();

      // Hide reversible nodes now; destruction waits for the host transaction commit.
      this.wrapperCutValue = true;
      this.blurNode.active = false;
      this.fruitNode.active = false;
      this.circleCutElapsedSeconds = 0;
      return true;
    } catch (error) {
      let navigationRollbackError: unknown | null = null;
      try {
        rollbackNavigation?.();
      } catch (rollbackError) {
        navigationRollbackError = rollbackError;
      }
      cutHalf?.dispose();
      if (this.cutHalfPresenterValue === cutHalf) {
        this.cutHalfPresenterValue = null;
      }
      this.cutAcceptedValue = false;
      this.wrapperCutValue = false;
      this.blurNode.active = true;
      this.fruitNode.active = true;
      this.circleCutElapsedSeconds = null;
      this.circleNode.setScale(1, 1, 1);
      if (navigationRollbackError !== null) {
        throw new MainMenuFruitCutRollbackError(error, navigationRollbackError);
      }
      throw error;
    }
  }

  /** Commits the accepted cut only after the destination host transaction succeeds. */
  commitCut(): boolean {
    if (
      this.disposedValue
      || !this.cutAcceptedValue
      || this.cutCommittedValue
    ) {
      return false;
    }
    this.cutCommittedValue = true;
    if (isValid(this.blurNode, true)) {
      this.blurNode.destroy();
    }
    this.queueIntactFruitDisposal();
    return true;
  }

  /** Restores the exact intact fruit when the destination host transaction rolls back. */
  rollbackCut(): boolean {
    if (
      this.disposedValue
      || !this.cutAcceptedValue
      || this.cutCommittedValue
    ) {
      return false;
    }
    this.cutHalfPresenterValue?.dispose();
    this.cutHalfPresenterValue = null;
    this.cutAcceptedValue = false;
    this.wrapperCutValue = false;
    this.circleCutElapsedSeconds = null;
    this.circleNode.setScale(1, 1, 1);
    this.blurNode.active = true;
    this.fruitNode.active = true;
    return true;
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.activatedValue = false;
    this.attachedValue = false;
    this.cutHalfPresenterValue?.dispose();
    this.cutHalfPresenterValue = null;
    if (isValid(this.root, true)) {
      this.root.destroy();
    }
    return true;
  }

  // Rotation begins with entry and remains perpetual after the fade completes.
  private rotationElapsedSeconds = 0;

  private queueIntactFruitDisposal(): void {
    const collider = this.collider;
    try {
      this.lifecycle.callAfterStep(() => {
        if (isValid(this.fruitNode, true)) {
          this.fruitNode.destroy();
        }
        this.lifecycle.onColliderDisposed(collider);
      });
    } catch (error) {
      // The fruit remains cut-disabled; retrying a cut cannot duplicate halves/navigation.
      throw error;
    }
  }

  private processObjectiveNotificationsOnce(): void {
    if (!this.globalObjectiveProcessed) {
      // Progression can mutate before its popup callback throws, so latch before invocation.
      this.globalObjectiveProcessed = true;
      this.lifecycle.onGlobalFruitCut();
    }
    if (!this.fruitTypeObjectiveProcessed) {
      this.fruitTypeObjectiveProcessed = true;
      this.lifecycle.onFruitTypeCut(this.presentation.fruitId);
    }
  }
}

export class MainMenuFruitCutRollbackError extends Error {
  readonly failures: readonly [unknown, unknown];

  constructor(cutFailure: unknown, rollbackFailure: unknown) {
    super('Main Menu FruitButton cut and navigation rollback both failed');
    this.name = 'MainMenuFruitCutRollbackError';
    this.failures = Object.freeze([cutFailure, rollbackFailure]);
  }
}

/** Explicit recovered signed-delta adapter for Creator's 2D z-angle API. */
export function mainMenuLegacyRotationToCreatorDegrees(deltaDegrees: number): number {
  if (!Number.isFinite(deltaDegrees)) {
    throw new RangeError('legacy rotation delta must be finite');
  }
  return Math.fround(deltaDegrees);
}

function createSpriteNode(
  name: string,
  resource: LoadedGameRasterResource,
  initialOpacity: number,
): Readonly<{ readonly node: Node; readonly opacity: UIOpacity; readonly sprite: Sprite }> {
  const node = new Node(name);
  const transform = node.addComponent(UITransform);
  transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
  transform.setAnchorPoint(0.5, 0.5);
  const opacity = node.addComponent(UIOpacity);
  opacity.opacity = initialOpacity;
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  return Object.freeze({ node, opacity, sprite });
}

function configureFruitBody(
  body: RigidBody2D,
  fixture: FruitFixtureConfiguration,
): void {
  const definition = fixture.body;
  body.type = ERigidBody2DType.Dynamic;
  body.allowSleep = definition.allowSleep;
  body.awakeOnLoad = definition.awake;
  body.bullet = definition.bullet;
  body.fixedRotation = definition.fixedRotation;
  body.gravityScale = 0;
  body.linearDamping = definition.linearDamping;
  body.angularDamping = definition.angularDamping;
  body.linearVelocity = new Vec2(0, 0);
  body.angularVelocity = Math.fround(2);
  body.group = fixture.fixture.filter.categoryBits;
}

function addFruitCollider(
  node: Node,
  fixture: FruitFixtureConfiguration,
): Collider2D {
  const definition = fixture.fixture;
  let collider: Collider2D;
  if (definition.shape.type === 'box') {
    const box = node.addComponent(BoxCollider2D);
    box.size = new Size(
      definition.shape.creatorSizeWorldUnits.width,
      definition.shape.creatorSizeWorldUnits.height,
    );
    box.offset = new Vec2(
      definition.shape.centerMetres.x * LEGACY_WORLD_UNITS_PER_METRE,
      definition.shape.centerMetres.y * LEGACY_WORLD_UNITS_PER_METRE,
    );
    collider = box;
  } else {
    const circle = node.addComponent(CircleCollider2D);
    circle.radius = definition.shape.creatorRadiusWorldUnits;
    circle.offset = new Vec2(
      definition.shape.centerMetres.x * LEGACY_WORLD_UNITS_PER_METRE,
      definition.shape.centerMetres.y * LEGACY_WORLD_UNITS_PER_METRE,
    );
    collider = circle;
  }
  collider.density = definition.density;
  collider.friction = definition.friction;
  collider.restitution = definition.restitution;
  collider.sensor = definition.sensor;
  collider.group = definition.filter.categoryBits;
  collider.tag = 0;
  return collider;
}

function readBodyAngleRadians(body: RigidBody2D, node: Node): number {
  const rawBody: unknown = body.impl?.impl;
  if (
    rawBody !== null
    && typeof rawBody === 'object'
    && 'GetAngle' in rawBody
    && typeof rawBody.GetAngle === 'function'
  ) {
    const angle = rawBody.GetAngle.call(rawBody) as unknown;
    if (typeof angle === 'number' && Number.isFinite(angle)) {
      return angle;
    }
  }
  return node.eulerAngles.z / RADIANS_TO_DEGREES;
}

function applyLayerToChildren(node: Node, layer: number): void {
  for (const child of node.children) {
    child.layer = layer;
    applyLayerToChildren(child, layer);
  }
}

function assertInput(input: MainMenuFruitPresenterInput): void {
  assertObject(input, 'input');
  assertObject(input.presentation, 'input.presentation');
  assertObject(input.resources, 'input.resources');
  if (input.resources.assetTree !== input.assetTree) {
    throw new Error('Main Menu FruitButton resource profile must match its assetTree');
  }
  assertPositiveFinite(input.viewport.width, 'viewport.width');
  assertPositiveFinite(input.viewport.height, 'viewport.height');
}

function assertLifecycle(lifecycle: MainMenuFruitPresenterLifecycle): void {
  assertObject(lifecycle, 'lifecycle');
  for (const callback of [
    lifecycle.callAfterStep,
    lifecycle.onColliderDisposed,
    lifecycle.onGlobalFruitCut,
    lifecycle.onNavigation,
    lifecycle.onPlayFruitAudio,
    lifecycle.onFruitTypeCut,
  ]) {
    if (typeof callback !== 'function') {
      throw new TypeError('Main Menu FruitButton lifecycle callbacks must be functions');
    }
  }
}

function assertSegment(segment: CutSegment): void {
  assertObject(segment, 'segment');
  assertPoint(segment.start, 'segment.start');
  assertPoint(segment.end, 'segment.end');
  if (segment.start.x === segment.end.x && segment.start.y === segment.end.y) {
    throw new RangeError('Main Menu cut segment must have non-zero length');
  }
}

function assertPoint(value: MainMenuPoint, label: string): void {
  assertObject(value, label);
  assertFinite(value.x, `${label}.x`);
  assertFinite(value.y, `${label}.y`);
}

function assertObject(value: unknown, label: string): asserts value is object {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
}

function assertPositiveFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}
