import {
  BoxCollider2D,
  CircleCollider2D,
  Collider2D,
  ERigidBody2DType,
  HingeJoint2D,
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
  MODE_SELECT_ENTRY_FADE_SECONDS,
  MODE_SELECT_FRUIT_CIRCLE_CUT_SECONDS,
  MODE_SELECT_FRUIT_CIRCLE_ROTATION_DEGREES,
  MODE_SELECT_FRUIT_CIRCLE_ROTATION_SECONDS,
  createModeSelectFruitCutPresentationPlan,
  type ModeSelectPoint,
  type ModeSelectRopeButtonPresentation,
} from '../domain/mode-select-presentation';
import { getModeSelectRasterResources } from '../domain/mode-select-resource-contract';
import type { ModeSelectIndex } from '../domain/mode-select-state';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import type { LoadedGameRasterResource } from './game-resource-loader';
import {
  ModeSelectCutHalfPresenter,
  type ModeSelectCutHalfPresenterLifecycle,
} from './mode-select-cut-half-presenter';
import type { LoadedModeSelectResources } from './mode-select-resource-loader';

export interface ModeSelectRopeButtonPresenterInput {
  readonly assetTree: ClassicAssetTree;
  readonly physicsHost: Node;
  readonly presentation: ModeSelectRopeButtonPresentation;
  readonly resources: LoadedModeSelectResources;
  readonly viewport: Readonly<{ readonly height: number; readonly width: number }>;
}

export interface ModeSelectRopeButtonPresenterLifecycle
  extends ModeSelectCutHalfPresenterLifecycle {
  readonly onColliderDisposed: (collider: Collider2D) => void;
  readonly onColliderRestored: (
    collider: Collider2D,
    presenter: ModeSelectRopeButtonPresenter,
  ) => void;
  readonly onModeSelected: (modeIndex: ModeSelectIndex) => void;
  readonly onPlayFruitAudio: (canonicalPath: string) => void;
  readonly onUnlockRequested: () => void;
}

export interface ModeSelectRopeButtonPresenterState {
  readonly activated: boolean;
  readonly attached: boolean;
  readonly cutAccepted: boolean;
  readonly disposed: boolean;
  readonly locked: boolean;
  readonly wrapperCut: boolean;
}

export class ModeSelectRopeButtonCleanupError extends Error {
  readonly causes: readonly unknown[];

  constructor(message: string, causes: readonly unknown[]) {
    super(message);
    this.name = 'ModeSelectRopeButtonCleanupError';
    this.causes = Object.freeze([...causes]);
  }
}

export interface PresentedModeSelectRopeLink {
  readonly body: RigidBody2D;
  readonly joint: HingeJoint2D;
  readonly node: Node;
  readonly sprite: Sprite;
}

export interface PresentedModeSelectFruitButton {
  readonly body: RigidBody2D;
  readonly circleNode: Node;
  readonly collider: Collider2D;
  readonly root: Node;
}

const MAX_OPACITY = 255;
const MAX_MODE_SELECT_ROPE_BUTTON_UPDATE_SECONDS = 60;
const RADIANS_TO_DEGREES = 180 / Math.PI;

/** One exact visual RopeButton backed by a static anchor and eight Creator hinge joints. */
export class ModeSelectRopeButtonPresenter {
  readonly connectorNode: Node;
  readonly descriptionNode: Node;
  readonly fruitButton: PresentedModeSelectFruitButton;
  readonly lowerWheelNode: Node;
  readonly modeIndex: ModeSelectIndex;
  readonly presentation: ModeSelectRopeButtonPresentation;
  readonly root: Node;
  readonly ropeLinks: readonly PresentedModeSelectRopeLink[];
  readonly shaderNode: Node;
  readonly staticAnchorBody: RigidBody2D;
  readonly staticAnchorNode: Node;
  readonly targetId: string;
  readonly upperWheelNode: Node;

  private activatedValue = false;
  private attachedValue = false;
  private blurNodeValue: Node;
  private blurOpacityValue: UIOpacity;
  private readonly circleOpacity: UIOpacity;
  private circleCutElapsedSeconds: number | null = null;
  private readonly circleSprite: Sprite;
  private cutAcceptedValue = false;
  private cutHalfPresenterValue: ModeSelectCutHalfPresenter | null = null;
  private disposedValue = false;
  private entryElapsedSeconds = 0;
  private fruitJoint: HingeJoint2D;
  private fruitNodeValue: Node;
  private fruitOpacityValue: UIOpacity;
  private fruitSpriteValue: Sprite;
  private readonly input: ModeSelectRopeButtonPresenterInput;
  private lockEventsRegistered = false;
  private readonly lockMenu: Node | null;
  private lockNormal: LoadedGameRasterResource | null = null;
  private lockSelected: LoadedGameRasterResource | null = null;
  private lockSprite: Sprite | null = null;
  private lockedValue: boolean;
  private readonly lifecycle: ModeSelectRopeButtonPresenterLifecycle;
  private rotationElapsedSeconds = 0;
  private wrapperCutValue = false;

  private constructor(
    input: ModeSelectRopeButtonPresenterInput,
    lifecycle: ModeSelectRopeButtonPresenterLifecycle,
  ) {
    this.input = input;
    this.lifecycle = lifecycle;
    this.presentation = input.presentation;
    this.modeIndex = input.presentation.card.destinationState;
    this.targetId = `mode-select-fruit:${this.modeIndex}`;
    this.lockedValue = input.presentation.initialLocked;
    this.root = new Node(`${input.presentation.card.purpose}-rope-button`);
    this.root.active = false;

    this.staticAnchorNode = new Node(`${input.presentation.card.purpose}-static-anchor`);
    this.staticAnchorNode.active = false;
    this.staticAnchorNode.setWorldPosition(
      input.presentation.staticAnchorBody.positionWorldUnits.x,
      input.presentation.staticAnchorBody.positionWorldUnits.y,
      0,
    );
    this.staticAnchorBody = this.staticAnchorNode.addComponent(RigidBody2D);
    configureStaticBody(this.staticAnchorBody);

    const links: PresentedModeSelectRopeLink[] = [];
    let previousBody = this.staticAnchorBody;
    for (const linkPresentation of input.presentation.ropeLinks) {
      const resource = input.resources.raster(linkPresentation.resource);
      const presented = createSpriteNode(
        `rope-link-${linkPresentation.index}`,
        resource,
        MAX_OPACITY,
      );
      presented.node.setWorldPosition(
        linkPresentation.displayPositionWorldUnits.x,
        linkPresentation.displayPositionWorldUnits.y,
        0,
      );
      const body = presented.node.addComponent(RigidBody2D);
      configureDynamicRopeBody(body);
      const joint = presented.node.addComponent(HingeJoint2D);
      configureHingeJoint(joint, previousBody);
      presented.node.setParent(this.root, true);
      presented.node.setSiblingIndex(linkPresentation.index);
      links.push(Object.freeze({
        body,
        joint,
        node: presented.node,
        sprite: presented.sprite,
      }));
      previousBody = body;
    }
    this.ropeLinks = Object.freeze(links);

    const shader = createSpriteNode(
      'description-shader',
      input.resources.raster(input.presentation.shader.resource),
      MAX_OPACITY,
    );
    this.shaderNode = shader.node;
    this.shaderNode.setWorldPosition(
      input.presentation.requestedFruitPoint.x,
      input.presentation.requestedFruitPoint.y,
      0,
    );
    this.shaderNode.setParent(this.root, true);
    this.shaderNode.setSiblingIndex(7);

    const description = createSpriteNode(
      'description-art',
      input.resources.raster(input.presentation.description.resource),
      MAX_OPACITY,
    );
    this.descriptionNode = description.node;
    this.descriptionNode.setWorldPosition(
      input.presentation.requestedFruitPoint.x,
      input.presentation.requestedFruitPoint.y,
      0,
    );
    this.descriptionNode.setParent(this.root, true);
    this.descriptionNode.setSiblingIndex(8);

    const fruitRoot = new Node('fruit-button');
    fruitRoot.active = false;
    const fruitRootTransform = fruitRoot.addComponent(UITransform);
    fruitRootTransform.setContentSize(
      input.presentation.fruitButton.resources.intact.dimensions.width,
      input.presentation.fruitButton.resources.intact.dimensions.height,
    );
    fruitRootTransform.setAnchorPoint(0.5, 0.5);
    fruitRoot.setWorldPosition(
      input.presentation.fruitButton.wrapperPosition.x,
      input.presentation.fruitButton.wrapperPosition.y,
      0,
    );
    const fruitBody = fruitRoot.addComponent(RigidBody2D);
    configureFruitBody(fruitBody, input.presentation.fruitButton.factoryFixture);
    const fruitCollider = addFruitCollider(
      fruitRoot,
      input.presentation.fruitButton.factoryFixture,
    );

    const blur = this.createBlurNode();
    this.blurNodeValue = blur.node;
    this.blurOpacityValue = blur.opacity;
    this.blurNodeValue.setParent(fruitRoot, true);
    this.blurNodeValue.setSiblingIndex(0);

    const circle = createSpriteNode(
      'circle-art',
      input.resources.raster(input.presentation.fruitButton.resources.circle),
      input.presentation.fruitButton.circle.initialOpacity,
    );
    this.circleOpacity = circle.opacity;
    this.circleSprite = circle.sprite;
    circle.node.setWorldPosition(
      input.presentation.fruitButton.circle.position.x,
      input.presentation.fruitButton.circle.position.y,
      0,
    );
    circle.node.setParent(fruitRoot, true);
    circle.node.setSiblingIndex(1);

    const fruit = this.createIntactFruitNode();
    this.fruitNodeValue = fruit.node;
    this.fruitOpacityValue = fruit.opacity;
    this.fruitSpriteValue = fruit.sprite;
    this.fruitNodeValue.setParent(fruitRoot, true);
    this.fruitNodeValue.setSiblingIndex(2);

    this.lockMenu = this.createLockMenu();
    if (this.lockMenu !== null) {
      this.lockMenu.setParent(this.fruitNodeValue, true);
      this.lockMenu.setSiblingIndex(0);
    }

    fruitRoot.setParent(this.root, true);
    fruitRoot.setSiblingIndex(9);
    this.fruitJoint = fruitRoot.addComponent(HingeJoint2D);
    configureHingeJoint(this.fruitJoint, previousBody);
    this.fruitButton = Object.freeze({
      body: fruitBody,
      circleNode: circle.node,
      collider: fruitCollider,
      root: fruitRoot,
    });

    const sync = input.presentation.scheduledSynchronization.initial;
    const upperWheel = createSpriteNode(
      'upper-wheel',
      input.resources.raster(input.presentation.wheelAssembly.upperWheelResource),
      MAX_OPACITY,
    );
    this.upperWheelNode = upperWheel.node;
    setNodeFromSync(this.upperWheelNode, sync.upperWheelPosition, sync.upperWheelRotationDegrees);
    this.upperWheelNode.setParent(this.root, true);
    this.upperWheelNode.setSiblingIndex(10);

    const lowerWheel = createSpriteNode(
      'lower-wheel',
      input.resources.raster(input.presentation.wheelAssembly.lowerWheelResource),
      MAX_OPACITY,
    );
    this.lowerWheelNode = lowerWheel.node;
    setNodeFromSync(this.lowerWheelNode, sync.lowerWheelPosition, sync.lowerWheelRotationDegrees);
    this.lowerWheelNode.setParent(this.root, true);
    this.lowerWheelNode.setSiblingIndex(11);

    const connector = createSpriteNode(
      'wheel-connector',
      input.resources.raster(input.presentation.wheelAssembly.connectorResource),
      MAX_OPACITY,
    );
    this.connectorNode = connector.node;
    this.connectorNode.setWorldPosition(sync.connectorPosition.x, sync.connectorPosition.y, 0);
    this.connectorNode.setParent(this.root, true);
    this.connectorNode.setSiblingIndex(12);

    if (this.root.children.length !== 13 || this.ropeLinks.length !== 7) {
      throw new Error('Mode Select RopeButton must contain exactly thirteen visual children');
    }
  }

  static create(
    input: ModeSelectRopeButtonPresenterInput,
    lifecycle: ModeSelectRopeButtonPresenterLifecycle,
  ): ModeSelectRopeButtonPresenter {
    assertInput(input);
    assertLifecycle(lifecycle);
    return new ModeSelectRopeButtonPresenter(input, lifecycle);
  }

  get cutHalfPresenter(): ModeSelectCutHalfPresenter | null {
    return this.cutHalfPresenterValue;
  }

  get state(): ModeSelectRopeButtonPresenterState {
    return Object.freeze({
      activated: this.activatedValue,
      attached: this.attachedValue,
      cutAccepted: this.cutAcceptedValue,
      disposed: this.disposedValue,
      locked: this.lockedValue,
      wrapperCut: this.wrapperCutValue,
    });
  }

  attach(parent: Node, siblingIndex: number): void {
    if (!isValid(parent, true) || !isValid(this.input.physicsHost, true)) {
      throw new Error('Mode Select RopeButton requires valid visual and physics hosts');
    }
    if (!Number.isSafeInteger(siblingIndex) || siblingIndex < 0) {
      throw new RangeError('RopeButton siblingIndex must be a non-negative safe integer');
    }
    if (
      this.disposedValue
      || this.attachedValue
      || this.root.parent !== null
      || this.staticAnchorNode.parent !== null
    ) {
      throw new Error('Mode Select RopeButton cannot attach from its current state');
    }
    try {
      applyLayerRecursively(this.root, parent.layer);
      this.root.setParent(parent, true);
      this.root.setSiblingIndex(siblingIndex);
      this.staticAnchorNode.layer = this.input.physicsHost.layer;
      this.staticAnchorNode.setParent(this.input.physicsHost, true);
      this.staticAnchorNode.setSiblingIndex(this.modeIndex);
      this.attachedValue = true;
    } catch (error) {
      this.root.setParent(null, true);
      this.staticAnchorNode.setParent(null, true);
      throw error;
    }
  }

  activate(): void {
    if (
      this.disposedValue
      || !this.attachedValue
      || this.root.parent === null
      || this.staticAnchorNode.parent === null
    ) {
      throw new Error('Mode Select RopeButton must be attached before activation');
    }
    if (this.activatedValue) {
      throw new Error('Mode Select RopeButton can activate only once');
    }
    this.entryElapsedSeconds = 0;
    this.rotationElapsedSeconds = 0;
    this.root.active = true;
    this.staticAnchorNode.active = true;
    this.fruitButton.root.active = true;
    try {
      this.registerLockEvents();
      this.synchronize();
      this.activatedValue = true;
    } catch (error) {
      this.unregisterLockEvents();
      this.root.active = false;
      this.staticAnchorNode.active = false;
      this.fruitButton.root.active = false;
      throw error;
    }
  }

  /** Makes a partially activated card retry-safe without disposing its staged nodes. */
  deactivateAfterActivationFailure(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.unregisterLockEvents();
    this.activatedValue = false;
    this.entryElapsedSeconds = 0;
    this.rotationElapsedSeconds = 0;
    this.root.active = false;
    this.staticAnchorNode.active = false;
    this.fruitButton.root.active = false;
    return true;
  }

  update(deltaSeconds: number): void {
    if (!this.activatedValue || this.disposedValue) {
      return;
    }
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (deltaSeconds > MAX_MODE_SELECT_ROPE_BUTTON_UPDATE_SECONDS) {
      throw new RangeError(
        `deltaSeconds must not exceed ${String(MAX_MODE_SELECT_ROPE_BUTTON_UPDATE_SECONDS)} seconds`,
      );
    }
    this.synchronize();
    this.entryElapsedSeconds = Math.min(
      MODE_SELECT_ENTRY_FADE_SECONDS,
      this.entryElapsedSeconds + deltaSeconds,
    );
    this.rotationElapsedSeconds += deltaSeconds;
    const opacity = MAX_OPACITY * (
      this.entryElapsedSeconds / MODE_SELECT_ENTRY_FADE_SECONDS
    );
    if (isValid(this.blurNodeValue, true)) {
      this.blurOpacityValue.opacity = opacity;
    }
    this.circleOpacity.opacity = opacity;
    if (isValid(this.fruitNodeValue, true)) {
      this.fruitOpacityValue.opacity = opacity;
    }
    const rotationProgress = this.rotationElapsedSeconds
      / MODE_SELECT_FRUIT_CIRCLE_ROTATION_SECONDS;
    this.fruitButton.circleNode.setRotationFromEuler(
      0,
      0,
      MODE_SELECT_FRUIT_CIRCLE_ROTATION_DEGREES * rotationProgress,
    );
    if (this.circleCutElapsedSeconds !== null) {
      this.circleCutElapsedSeconds = Math.min(
        MODE_SELECT_FRUIT_CIRCLE_CUT_SECONDS,
        this.circleCutElapsedSeconds + deltaSeconds,
      );
      const scale = 1 - (
        this.circleCutElapsedSeconds / MODE_SELECT_FRUIT_CIRCLE_CUT_SECONDS
      );
      this.fruitButton.circleNode.setScale(scale, scale, 1);
    }
    this.cutHalfPresenterValue?.updateAction(deltaSeconds);
    this.cutHalfPresenterValue?.evaluateBounds(this.input.viewport);
  }

  moveAnchor(deltaX: number): void {
    assertFinite(deltaX, 'deltaX');
    if (this.disposedValue) {
      throw new Error('Disposed Mode Select RopeButton cannot move');
    }
    const current = this.staticAnchorNode.worldPosition;
    this.staticAnchorNode.setWorldPosition(Math.fround(current.x + deltaX), current.y, 0);
  }

  snapshot(): CuttableSnapshot {
    const position = this.fruitButton.root.worldPosition;
    return Object.freeze({
      bodyWorldPosition: Object.freeze({ x: position.x, y: position.y }),
      cutDisabled: this.lockedValue || this.cutAcceptedValue || this.disposedValue,
      id: this.targetId,
      isFruit: true,
      nodeTag: this.fruitButton.collider.tag,
    });
  }

  cut(segment: CutSegment, effectsEnabled: boolean): boolean {
    assertSegment(segment);
    if (
      !this.activatedValue
      || this.disposedValue
      || this.lockedValue
      || this.cutAcceptedValue
    ) {
      return false;
    }
    let cutHalf: ModeSelectCutHalfPresenter | null = null;
    this.cutAcceptedValue = true;
    try {
      const sourcePosition = this.fruitButton.root.worldPosition;
      const sourceMass = this.fruitButton.body.getMass();
      if (!Number.isFinite(sourceMass) || sourceMass <= 0) {
        throw new Error('Mode Select FruitButton requires a positive active body mass before cut');
      }
      const resources = this.presentation.fruitButton.resources;
      const motion = createClassicCutHalfMotion({
        bottomHeightWorldUnits: resources.cutBottom.dimensions.height,
        critical: false,
        segment,
        sourceAngleRadians: readBodyAngleRadians(this.fruitButton.body, this.fruitButton.root),
        sourceAngularVelocityRadiansPerSecond: this.fruitButton.body.angularVelocity,
        sourceBodyMass: sourceMass,
        sourcePositionWorldUnits: { x: sourcePosition.x, y: sourcePosition.y },
        topHeightWorldUnits: resources.cutTop.dimensions.height,
        viewportWidthWorldUnits: this.input.viewport.width,
      });
      const cutPlan = createModeSelectFruitCutPresentationPlan(
        this.modeIndex,
        this.input.assetTree,
        effectsEnabled,
      );
      cutHalf = ModeSelectCutHalfPresenter.create({
        assetTree: this.input.assetTree,
        modeIndex: this.modeIndex,
        motion,
        resources: {
          bottom: this.input.resources.raster(resources.cutBottom),
          top: this.input.resources.raster(resources.cutTop),
        },
      }, this.lifecycle);
      const parent = this.root.parent;
      if (parent === null || !parent.activeInHierarchy) {
        throw new Error('Mode Select FruitButton cut requires its active Mode Select parent');
      }
      cutHalf.attach(parent, parent.children.length);
      this.cutHalfPresenterValue = cutHalf;
      const fruitAudio = cutPlan.orderedOperations.find(
        (operation) => operation.type === 'request-fruit-audio',
      );
      if (fruitAudio !== undefined && fruitAudio.type === 'request-fruit-audio') {
        this.lifecycle.onPlayFruitAudio(fruitAudio.canonicalPath);
      }
      this.lifecycle.onModeSelected(this.modeIndex);
    } catch (error) {
      const cleanupFailures: unknown[] = [];
      if (cutHalf !== null) {
        attemptCleanup(cleanupFailures, () => cutHalf?.dispose());
      }
      this.cutHalfPresenterValue = null;
      this.cutAcceptedValue = false;
      this.wrapperCutValue = false;
      this.circleCutElapsedSeconds = null;
      if (cleanupFailures.length > 0) {
        throw new ModeSelectRopeButtonCleanupError(
          'Mode Select FruitButton pre-navigation rollback failed',
          [error, ...cleanupFailures],
        );
      }
      throw error;
    }
    this.wrapperCutValue = true;
    if (isValid(this.blurNodeValue, true)) {
      this.blurNodeValue.destroy();
    }
    this.circleCutElapsedSeconds = 0;
    this.queueIntactFruitDisposal();
    return true;
  }

  unlock(): void {
    if (this.disposedValue) {
      throw new Error('Disposed Mode Select RopeButton cannot unlock');
    }
    this.lockedValue = false;
    this.fruitButton.collider.enabled = true;
    if (this.lockMenu !== null) {
      this.lockMenu.active = false;
    }
  }

  /** Reverses irreversible cut cleanup after a host navigation transaction failed. */
  restoreAfterFailedNavigation(locked: boolean): void {
    if (this.disposedValue) {
      throw new Error('Disposed Mode Select RopeButton cannot be restored');
    }
    this.cutHalfPresenterValue?.dispose();
    this.cutHalfPresenterValue = null;
    this.cutAcceptedValue = false;
    this.wrapperCutValue = false;
    this.circleCutElapsedSeconds = null;
    this.fruitButton.circleNode.setScale(1, 1, 1);
    this.circleOpacity.opacity = MAX_OPACITY;
    this.lockedValue = locked;

    if (!isValid(this.blurNodeValue, true)) {
      const blur = this.createBlurNode(MAX_OPACITY);
      this.blurNodeValue = blur.node;
      this.blurOpacityValue = blur.opacity;
      this.blurNodeValue.setParent(this.fruitButton.root, true);
      this.blurNodeValue.setSiblingIndex(0);
    }
    if (!isValid(this.fruitNodeValue, true)) {
      const fruit = this.createIntactFruitNode(MAX_OPACITY);
      this.fruitNodeValue = fruit.node;
      this.fruitOpacityValue = fruit.opacity;
      this.fruitSpriteValue = fruit.sprite;
      this.fruitNodeValue.setParent(this.fruitButton.root, true);
      this.fruitNodeValue.setSiblingIndex(2);
      if (this.lockMenu !== null && isValid(this.lockMenu, true)) {
        this.lockMenu.setParent(this.fruitNodeValue, true);
        this.lockMenu.setSiblingIndex(0);
      }
    }
    this.fruitNodeValue.active = true;
    this.fruitButton.collider.enabled = true;
    this.fruitButton.body.gravityScale = 0;
    this.fruitButton.body.angularVelocity = Math.fround(2);
    this.fruitButton.body.wakeUp();
    if (this.lockMenu !== null) {
      this.lockMenu.active = locked;
      if (this.lockSprite !== null && this.lockNormal !== null) {
        this.lockSprite.spriteFrame = this.lockNormal.spriteFrame;
      }
    }
    this.lifecycle.onColliderRestored(this.fruitButton.collider, this);
    this.synchronize();
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.activatedValue = false;
    this.attachedValue = false;
    const failures: unknown[] = [];
    attemptCleanup(failures, () => this.unregisterLockEvents());
    if (this.cutHalfPresenterValue !== null) {
      attemptCleanup(failures, () => this.cutHalfPresenterValue?.dispose());
    }
    this.cutHalfPresenterValue = null;
    attemptCleanup(
      failures,
      () => this.lifecycle.onColliderDisposed(this.fruitButton.collider),
    );
    if (isValid(this.staticAnchorNode, true)) {
      attemptCleanup(failures, () => this.staticAnchorNode.destroy());
    }
    if (isValid(this.root, true)) {
      attemptCleanup(failures, () => this.root.destroy());
    }
    if (failures.length > 0) {
      throw new ModeSelectRopeButtonCleanupError(
        'Mode Select RopeButton disposal failed',
        failures,
      );
    }
    return true;
  }

  private synchronize(): void {
    const anchor = this.staticAnchorNode.worldPosition;
    const retainedY = this.presentation.requestedFruitPoint.y;
    this.fruitButton.root.setWorldPosition(anchor.x, retainedY, 0);
    const formula = this.presentation.scheduledSynchronization.initial.wheelRotationFormula;
    const rotation = Math.fround(
      Math.fround(anchor.x / formula.xDivisor) * formula.radiansToDegrees,
    );
    const upperYOffset = this.presentation.scheduledSynchronization.initial.upperWheelPosition.y
      - this.presentation.staticAnchorBody.positionWorldUnits.y;
    const lowerYOffset = this.presentation.scheduledSynchronization.initial.lowerWheelPosition.y
      - this.presentation.staticAnchorBody.positionWorldUnits.y;
    setNodeFromSync(
      this.upperWheelNode,
      { x: anchor.x, y: Math.fround(anchor.y + upperYOffset) },
      rotation,
    );
    setNodeFromSync(
      this.lowerWheelNode,
      { x: anchor.x, y: Math.fround(anchor.y + lowerYOffset) },
      rotation,
    );
    this.connectorNode.setWorldPosition(anchor.x, anchor.y, 0);
    const fruitPosition = this.fruitButton.root.worldPosition;
    const fruitRotation = this.fruitButton.root.eulerAngles.z;
    for (const node of [this.shaderNode, this.descriptionNode]) {
      node.setWorldPosition(fruitPosition.x, fruitPosition.y, fruitPosition.z);
      node.setRotationFromEuler(0, 0, fruitRotation);
    }
    if (isValid(this.blurNodeValue, true)) {
      const steady = this.presentation.fruitButton.blur.steadyPositionAfterFirstRopeUpdate;
      const wrapper = this.presentation.fruitButton.wrapperPosition;
      this.blurNodeValue.setPosition(
        steady.x - wrapper.x,
        steady.y - wrapper.y,
        0,
      );
    }
  }

  private createBlurNode(initialOpacity?: number): Readonly<{
    readonly node: Node;
    readonly opacity: UIOpacity;
  }> {
    const presentation = this.presentation.fruitButton;
    const blur = createSpriteNode(
      'blur',
      this.input.resources.raster(
        getModeSelectRasterResources(this.input.assetTree).fruitButtonBlur,
      ),
      initialOpacity ?? presentation.blur.initialOpacity,
    );
    blur.node.setWorldPosition(
      presentation.blur.initialPosition.x,
      presentation.blur.initialPosition.y,
      0,
    );
    return Object.freeze({ node: blur.node, opacity: blur.opacity });
  }

  private createIntactFruitNode(initialOpacity?: number): Readonly<{
    readonly node: Node;
    readonly opacity: UIOpacity;
    readonly sprite: Sprite;
  }> {
    const presentation = this.presentation.fruitButton;
    const fruit = createSpriteNode(
      'intact-fruit',
      this.input.resources.raster(presentation.resources.intact),
      initialOpacity ?? presentation.fruit.initialOpacity,
    );
    fruit.node.setWorldPosition(
      presentation.fruit.position.x,
      presentation.fruit.position.y,
      0,
    );
    return fruit;
  }

  private createLockMenu(): Node | null {
    const lock = this.presentation.fruitButton.lock;
    if (lock === null) {
      this.lockNormal = null;
      this.lockSelected = null;
      this.lockSprite = null;
      return null;
    }
    this.lockNormal = this.input.resources.raster(lock.resources.normal);
    this.lockSelected = this.input.resources.raster(lock.resources.selected);
    const menu = new Node('lock-menu');
    menu.setPosition(lock.menuPosition.x, lock.menuPosition.y, 0);
    const item = createSpriteNode('unlock-item', this.lockNormal, MAX_OPACITY);
    item.node.setWorldPosition(lock.itemPosition.x, lock.itemPosition.y, 0);
    item.node.setParent(menu, true);
    item.node.setSiblingIndex(0);
    this.lockSprite = item.sprite;
    menu.active = this.lockedValue;
    return menu;
  }

  private registerLockEvents(): void {
    const item = this.lockMenu?.children[0];
    if (item === undefined || this.lockEventsRegistered) {
      return;
    }
    item.on(Node.EventType.TOUCH_START, this.onLockStart, this);
    item.on(Node.EventType.TOUCH_END, this.onLockEnd, this);
    item.on(Node.EventType.TOUCH_CANCEL, this.onLockCancel, this);
    this.lockEventsRegistered = true;
  }

  private unregisterLockEvents(): void {
    const item = this.lockMenu?.children[0];
    if (item === undefined || !this.lockEventsRegistered) {
      return;
    }
    item.off(Node.EventType.TOUCH_START, this.onLockStart, this);
    item.off(Node.EventType.TOUCH_END, this.onLockEnd, this);
    item.off(Node.EventType.TOUCH_CANCEL, this.onLockCancel, this);
    this.lockEventsRegistered = false;
  }

  private readonly onLockStart = (): void => {
    if (this.lockedValue && this.lockSprite !== null && this.lockSelected !== null) {
      this.lockSprite.spriteFrame = this.lockSelected.spriteFrame;
    }
  };

  private readonly onLockEnd = (): void => {
    if (this.lockSprite !== null && this.lockNormal !== null) {
      this.lockSprite.spriteFrame = this.lockNormal.spriteFrame;
    }
    if (this.lockedValue) {
      this.lifecycle.onUnlockRequested();
    }
  };

  private readonly onLockCancel = (): void => {
    if (this.lockSprite !== null && this.lockNormal !== null) {
      this.lockSprite.spriteFrame = this.lockNormal.spriteFrame;
    }
  };

  private queueIntactFruitDisposal(): void {
    const collider = this.fruitButton.collider;
    try {
      this.lifecycle.callAfterStep(() => {
        collider.enabled = false;
        if (isValid(this.fruitNodeValue, true)) {
          // Retain the disabled subtree only until the host commits or rejects navigation.
          // A rejection can then restore the exact lock-menu identity without inventing it.
          this.fruitNodeValue.active = false;
        }
        this.lifecycle.onColliderDisposed(collider);
      });
    } catch (error) {
      throw error;
    }
  }
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

function configureStaticBody(body: RigidBody2D): void {
  body.type = ERigidBody2DType.Static;
  body.gravityScale = 0;
  body.linearVelocity = new Vec2(0, 0);
  body.angularVelocity = 0;
}

function configureDynamicRopeBody(body: RigidBody2D): void {
  body.type = ERigidBody2DType.Dynamic;
  body.allowSleep = true;
  body.awakeOnLoad = true;
  body.bullet = false;
  body.fixedRotation = false;
  body.gravityScale = 1;
  body.linearDamping = 0;
  body.angularDamping = 0;
  body.linearVelocity = new Vec2(0, 0);
  body.angularVelocity = 0;
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

function configureHingeJoint(joint: HingeJoint2D, connectedBody: RigidBody2D): void {
  joint.anchor = new Vec2(0, 0);
  joint.connectedAnchor = new Vec2(0, 0);
  joint.connectedBody = connectedBody;
  joint.collideConnected = false;
  joint.enableLimit = false;
  joint.enableMotor = false;
}

function setNodeFromSync(node: Node, point: ModeSelectPoint, rotation: number): void {
  node.setWorldPosition(point.x, point.y, 0);
  node.setRotationFromEuler(0, 0, rotation);
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

function applyLayerRecursively(root: Node, layer: number): void {
  root.layer = layer;
  for (const child of root.children) {
    applyLayerRecursively(child, layer);
  }
}

function assertInput(input: ModeSelectRopeButtonPresenterInput): void {
  assertObject(input, 'input');
  assertObject(input.presentation, 'input.presentation');
  assertObject(input.resources, 'input.resources');
  if (input.resources.assetTree !== input.assetTree) {
    throw new Error('Mode Select RopeButton resource profile must match its assetTree');
  }
  if (!isValid(input.physicsHost, true)) {
    throw new Error('Mode Select RopeButton physicsHost must be a valid Creator node');
  }
  if (
    input.presentation.ropeLinks.length !== 7
    || input.presentation.joints.length !== 8
  ) {
    throw new Error('Mode Select RopeButton requires seven links and eight joints');
  }
  assertPositiveFinite(input.viewport.width, 'viewport.width');
  assertPositiveFinite(input.viewport.height, 'viewport.height');
}

function assertLifecycle(lifecycle: ModeSelectRopeButtonPresenterLifecycle): void {
  assertObject(lifecycle, 'lifecycle');
  for (const callback of [
    lifecycle.callAfterStep,
    lifecycle.onColliderDisposed,
    lifecycle.onColliderRestored,
    lifecycle.onModeSelected,
    lifecycle.onPlayFruitAudio,
    lifecycle.onUnlockRequested,
  ]) {
    if (typeof callback !== 'function') {
      throw new TypeError('Mode Select RopeButton lifecycle callbacks must be functions');
    }
  }
}

function assertSegment(segment: CutSegment): void {
  assertObject(segment, 'segment');
  assertPoint(segment.start, 'segment.start');
  assertPoint(segment.end, 'segment.end');
  if (segment.start.x === segment.end.x && segment.start.y === segment.end.y) {
    throw new RangeError('Mode Select cut segment must have non-zero length');
  }
}

function assertPoint(value: ModeSelectPoint, label: string): void {
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

function attemptCleanup(failures: unknown[], cleanup: () => unknown): void {
  try {
    cleanup();
  } catch (error) {
    failures.push(error);
  }
}
