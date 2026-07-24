import {
  EventKeyboard,
  Input,
  KeyCode,
  Node,
  Sprite,
  UIOpacity,
  UITransform,
  input as cocosInput,
  isValid,
} from 'cc';

import {
  ABOUT_BACK_AUDIO_CANONICAL_PATH,
  ABOUT_RASTER_RESOURCE_COUNT,
  type AboutRasterResource,
} from '../domain/about-resource-contract';
import {
  createAboutHeartEmissionPlan,
  createAboutPresentation,
  type AboutLocalReviewEligibilityInput,
  type AboutPresentationSnapshot,
  type AboutViewport,
} from '../domain/about-presentation';
import { createDetachedScreenRoot } from './detached-screen-root';
import type { LoadedGameRasterResource } from './game-resource-loader';
import type { LoadedAboutResources } from './about-resource-loader';

export interface AboutAudioPort {
  playOneShot(canonicalPath: string): void;
}

export interface AboutSettingsSnapshot {
  readonly effectsEnabled: () => boolean;
}

export interface AboutHeartRandomPort {
  nextDecile(): number;
  nextIntInclusive(minimum: number, maximum: number): number;
}

export type AboutRetiredAction = 'review' | 'feedback' | 'social';

export interface AboutRetiredActionEvent {
  readonly action: AboutRetiredAction;
  readonly reason: 'retired-offline';
}

export interface AboutNavigationTransaction {
  readonly destination: 'MainMenuLayer';
  readonly root: Node;
  readonly timing: 'immediate';
  readonly zOrder: 1;
}

export interface AboutPresenterLifecycle {
  readonly onMainMenuRequested: (
    transaction: AboutNavigationTransaction,
  ) => boolean | void;
  readonly onRetiredAction: (event: AboutRetiredActionEvent) => void;
}

export interface AboutPresenterInput {
  readonly audio: AboutAudioPort;
  readonly canvas: Node;
  readonly lifecycle: AboutPresenterLifecycle;
  readonly localReviewEligibility: AboutLocalReviewEligibilityInput;
  readonly random: AboutHeartRandomPort;
  readonly resources: LoadedAboutResources;
  readonly settings: AboutSettingsSnapshot;
  readonly viewport: AboutViewport;
}

export interface AboutPresenterState {
  readonly activated: boolean;
  readonly disposed: boolean;
  readonly heartCount: number;
  readonly navigationPending: boolean;
  readonly poisoned: boolean;
  readonly pulseElapsedSeconds: number;
  readonly retiredActionPending: boolean;
  readonly suspended: boolean;
}

export class AboutCleanupError extends Error {
  readonly causes: readonly unknown[];

  constructor(message: string, causes: readonly unknown[]) {
    super(`${message}: ${causes.length} failure${causes.length === 1 ? '' : 's'}`);
    this.name = 'AboutCleanupError';
    this.causes = Object.freeze([...causes]);
  }
}

/** The route committed; the disposed About source must never be restored. */
export class AboutPostCommitAudioError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super(`About navigation committed but Menu audio failed: ${errorMessage(cause)}`);
    this.name = 'AboutPostCommitAudioError';
    this.cause = cause;
  }
}

/** Dynamic effects policy failed after route commit; source ownership stays released. */
export class AboutPostCommitSettingsError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super(`About navigation committed but effects settings failed: ${errorMessage(cause)}`);
    this.name = 'AboutPostCommitSettingsError';
    this.cause = cause;
  }
}

interface RuntimeSprite {
  readonly node: Node;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

interface RuntimeButtonControl extends RuntimeSprite {
  readonly normal: LoadedGameRasterResource;
  readonly selected: LoadedGameRasterResource;
}

interface RuntimeHeart {
  readonly bornAtSeconds: number;
  readonly durationSeconds: number;
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly rise: number;
  readonly startPosition: Readonly<{
    readonly x: number;
    readonly y: number;
  }>;
}

interface RuntimeGraph {
  readonly background: RuntimeSprite;
  readonly email: RuntimeButtonControl;
  readonly gestures: Node;
  readonly like: RuntimeButtonControl;
  readonly menu: Node;
  readonly menuButton: RuntimeButtonControl;
  readonly review: RuntimeButtonControl;
}

const MAX_ABOUT_UPDATE_SECONDS = 60;
const OPAQUE_CHANNEL = 255;
const SETTINGS_KEYS = Object.freeze(['effectsEnabled'] as const);
const LOCAL_ELIGIBILITY_KEYS = Object.freeze([
  'localCompatibilityAvailable',
  'rated',
] as const);

const RETIRED_ACTION_EVENTS: Readonly<Record<
  AboutRetiredAction,
  AboutRetiredActionEvent
>> = Object.freeze({
  feedback: Object.freeze({
    action: 'feedback',
    reason: 'retired-offline',
  }),
  review: Object.freeze({
    action: 'review',
    reason: 'retired-offline',
  }),
  social: Object.freeze({
    action: 'social',
    reason: 'retired-offline',
  }),
});

/**
 * Detached, activation-gated Creator runtime for the recovered About presentation.
 *
 * Review, feedback, and social controls deliberately end at a sanitized local event.
 * The presenter has no platform, persistence, currency, or live-connectivity port.
 */
export class AboutPresenter {
  readonly presentation: AboutPresentationSnapshot;
  readonly root: Node;

  private readonly audio: AboutAudioPort;
  private readonly graph: RuntimeGraph;
  private readonly heartResource: LoadedGameRasterResource;
  private readonly lifecycle: AboutPresenterLifecycle;
  private readonly random: AboutHeartRandomPort;
  private readonly readEffectsEnabled: () => boolean;
  private readonly resources: LoadedAboutResources;

  private activatedValue = false;
  private cleanupPoisoned = false;
  private disposedValue = false;
  private readonly hearts: RuntimeHeart[] = [];
  private listenersRegistered = false;
  private navigationPendingValue = false;
  private nextHeartEmissionOrdinal = 1;
  private pulseElapsedSecondsValue = 0;
  private retiredActionPendingValue = false;
  private suspendedValue = false;

  private constructor(input: AboutPresenterInput) {
    const localReviewEligibility = copyLocalReviewEligibility(
      input.localReviewEligibility,
    );
    this.presentation = createAboutPresentation(
      input.resources.assetTree,
      input.viewport,
      localReviewEligibility,
    );
    this.audio = input.audio;
    this.lifecycle = input.lifecycle;
    this.random = input.random;
    this.readEffectsEnabled = copyEffectsReader(input.settings);
    this.resources = input.resources;
    this.root = createDetachedScreenRoot('AboutRoot', input.canvas);

    let graph: RuntimeGraph;
    try {
      graph = constructRuntimeGraph(
        this.root,
        this.presentation,
        input.resources,
      );
      this.heartResource = requireRaster(
        input.resources,
        this.presentation.heartResource,
      );
      this.root.active = false;
    } catch (error) {
      const cleanupFailures: unknown[] = [];
      if (isValid(this.root, true)) {
        attemptCleanup(cleanupFailures, () => this.root.destroy());
      }
      if (cleanupFailures.length > 0) {
        throw new AboutCleanupError(
          'About construction rollback failed',
          [error, ...cleanupFailures],
        );
      }
      throw error;
    }
    this.graph = graph;
  }

  static create(input: AboutPresenterInput): AboutPresenter {
    assertInput(input);
    return new AboutPresenter(input);
  }

  get state(): AboutPresenterState {
    return Object.freeze({
      activated: this.activatedValue,
      disposed: this.disposedValue,
      heartCount: this.hearts.length,
      navigationPending: this.navigationPendingValue,
      poisoned: this.cleanupPoisoned,
      pulseElapsedSeconds: this.pulseElapsedSecondsValue,
      retiredActionPending: this.retiredActionPendingValue,
      suspended: this.suspendedValue,
    });
  }

  activate(): void {
    if (this.disposedValue || !isValid(this.root, true)) {
      throw new Error('Disposed About presenter cannot activate');
    }
    if (this.cleanupPoisoned) {
      throw new Error('Poisoned About presenter cannot activate');
    }
    if (this.activatedValue) {
      throw new Error('About presenter can activate only once');
    }
    assertAttachedActiveHost(
      this.root,
      'About root must be host-attached before activation',
    );

    this.resetEntryState();
    this.root.active = true;
    try {
      this.registerEvents();
      this.activatedValue = true;
    } catch (error) {
      const cleanupFailures = this.unregisterAllEvents();
      this.root.active = false;
      if (cleanupFailures.length > 0) {
        this.markCleanupPoisoned();
        throw new AboutCleanupError(
          'About activation rollback failed',
          [error, ...cleanupFailures],
        );
      }
      throw error;
    }
  }

  /**
   * Advances only the locally eligible recovered pulse fixture.
   *
   * The production shell supplies localCompatibilityAvailable=false, so this method
   * performs no random draws and creates no heart nodes in production.
   */
  update(deltaSeconds: number): void {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (deltaSeconds > MAX_ABOUT_UPDATE_SECONDS) {
      throw new RangeError(
        `deltaSeconds must not exceed ${String(MAX_ABOUT_UPDATE_SECONDS)} seconds`,
      );
    }
    if (
      !this.activatedValue
      || this.suspendedValue
      || this.disposedValue
      || this.presentation.reviewPulsePlan === null
    ) {
      return;
    }

    const nextElapsedSeconds = this.pulseElapsedSecondsValue + deltaSeconds;
    while (
      emissionTimeForOrdinal(
        this.presentation,
        this.nextHeartEmissionOrdinal,
      ) <= nextElapsedSeconds
    ) {
      const emissionAtSeconds = emissionTimeForOrdinal(
        this.presentation,
        this.nextHeartEmissionOrdinal,
      );
      this.emitHeart(emissionAtSeconds);
      this.nextHeartEmissionOrdinal += 1;
    }
    this.pulseElapsedSecondsValue = nextElapsedSeconds;
    this.projectReviewPulse();
    this.projectHearts();
  }

  suspendForTransition(): boolean {
    if (
      this.disposedValue
      || !this.activatedValue
      || this.suspendedValue
    ) {
      return false;
    }

    const failures: unknown[] = [];
    attemptCleanup(failures, () => this.unregisterEvents());
    attemptCleanup(failures, () => this.resetControlFrames());
    this.retiredActionPendingValue = false;
    this.suspendedValue = true;
    if (failures.length > 0) {
      this.markCleanupPoisoned();
      throw new AboutCleanupError('About suspension failed', failures);
    }
    return true;
  }

  rearmNavigationAfterFailure(): boolean {
    if (this.cleanupPoisoned) {
      throw new AboutCleanupError(
        'Poisoned About presenter cannot rearm navigation',
        [new Error('A prior listener cleanup did not complete')],
      );
    }
    if (
      this.disposedValue
      || !this.activatedValue
      || this.root.parent === null
      || !isValid(this.root.parent, true)
      || !this.root.parent.activeInHierarchy
    ) {
      return false;
    }

    this.navigationPendingValue = false;
    this.retiredActionPendingValue = false;
    this.root.active = true;
    this.resetControlFrames();
    try {
      this.registerEvents();
      this.suspendedValue = false;
      return true;
    } catch (error) {
      const cleanupFailures = this.unregisterAllEvents();
      this.suspendedValue = true;
      this.root.active = false;
      if (cleanupFailures.length > 0) {
        this.markCleanupPoisoned();
        throw new AboutCleanupError(
          'About navigation rearm rollback failed',
          [error, ...cleanupFailures],
        );
      }
      throw error;
    }
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.activatedValue = false;
    this.navigationPendingValue = false;
    this.retiredActionPendingValue = false;

    const failures = this.unregisterAllEvents();
    if (this.listenersRegistered) {
      failures.push(...this.unregisterAllEvents());
    }
    if (isValid(this.root, true)) {
      attemptCleanup(failures, () => this.root.destroy());
    }
    if (failures.length > 0) {
      throw new AboutCleanupError('About disposal failed', failures);
    }
    return true;
  }

  private registerEvents(): void {
    if (this.listenersRegistered) {
      return;
    }
    try {
      registerControlEvents(
        this.graph.menuButton,
        this.onMenuStart,
        this.onMenuEnd,
        this.onMenuCancel,
        this,
      );
      registerControlEvents(
        this.graph.review,
        this.onReviewStart,
        this.onReviewEnd,
        this.onReviewCancel,
        this,
      );
      registerControlEvents(
        this.graph.email,
        this.onEmailStart,
        this.onEmailEnd,
        this.onEmailCancel,
        this,
      );
      registerControlEvents(
        this.graph.like,
        this.onLikeStart,
        this.onLikeEnd,
        this.onLikeCancel,
        this,
      );
      cocosInput.on(Input.EventType.KEY_UP, this.onKeyUp, this);
      this.listenersRegistered = true;
    } catch (error) {
      const cleanupFailures = this.unregisterAllEvents();
      if (cleanupFailures.length > 0) {
        this.markCleanupPoisoned();
        throw new AboutCleanupError(
          'About listener registration rollback failed',
          [error, ...cleanupFailures],
        );
      }
      throw error;
    }
  }

  private unregisterEvents(): void {
    if (!this.listenersRegistered) {
      return;
    }
    const failures = this.unregisterAllEvents();
    if (failures.length > 0) {
      throw new AboutCleanupError(
        'About listener removal failed',
        failures,
      );
    }
  }

  private unregisterAllEvents(): unknown[] {
    const failures: unknown[] = [];
    unregisterControlEvents(
      failures,
      this.graph.menuButton,
      this.onMenuStart,
      this.onMenuEnd,
      this.onMenuCancel,
      this,
    );
    unregisterControlEvents(
      failures,
      this.graph.review,
      this.onReviewStart,
      this.onReviewEnd,
      this.onReviewCancel,
      this,
    );
    unregisterControlEvents(
      failures,
      this.graph.email,
      this.onEmailStart,
      this.onEmailEnd,
      this.onEmailCancel,
      this,
    );
    unregisterControlEvents(
      failures,
      this.graph.like,
      this.onLikeStart,
      this.onLikeEnd,
      this.onLikeCancel,
      this,
    );
    attemptCleanup(
      failures,
      () => cocosInput.off(Input.EventType.KEY_UP, this.onKeyUp, this),
    );
    this.listenersRegistered = failures.length > 0;
    if (failures.length > 0) {
      this.markCleanupPoisoned();
    }
    return failures;
  }

  private readonly onMenuStart = (): void => {
    this.selectControl(this.graph.menuButton);
  };

  private readonly onMenuEnd = (): void => {
    setButtonFrame(this.graph.menuButton, this.graph.menuButton.normal);
    this.requestMainMenu();
  };

  private readonly onMenuCancel = (): void => {
    setButtonFrame(this.graph.menuButton, this.graph.menuButton.normal);
  };

  private readonly onReviewStart = (): void => {
    this.selectControl(this.graph.review);
  };

  private readonly onReviewEnd = (): void => {
    setButtonFrame(this.graph.review, this.graph.review.normal);
    this.emitRetiredAction('review');
  };

  private readonly onReviewCancel = (): void => {
    setButtonFrame(this.graph.review, this.graph.review.normal);
  };

  private readonly onEmailStart = (): void => {
    this.selectControl(this.graph.email);
  };

  private readonly onEmailEnd = (): void => {
    setButtonFrame(this.graph.email, this.graph.email.normal);
    this.emitRetiredAction('feedback');
  };

  private readonly onEmailCancel = (): void => {
    setButtonFrame(this.graph.email, this.graph.email.normal);
  };

  private readonly onLikeStart = (): void => {
    this.selectControl(this.graph.like);
  };

  private readonly onLikeEnd = (): void => {
    setButtonFrame(this.graph.like, this.graph.like.normal);
    this.emitRetiredAction('social');
  };

  private readonly onLikeCancel = (): void => {
    setButtonFrame(this.graph.like, this.graph.like.normal);
  };

  private readonly onKeyUp = (event: EventKeyboard): void => {
    if (event.keyCode === KeyCode.MOBILE_BACK) {
      this.requestMainMenu();
    }
  };

  private selectControl(control: RuntimeButtonControl): void {
    if (this.canInteract()) {
      setButtonFrame(control, control.selected);
    }
  }

  private emitRetiredAction(action: AboutRetiredAction): void {
    if (!this.canInteract()) {
      return;
    }
    this.retiredActionPendingValue = true;
    try {
      this.lifecycle.onRetiredAction(RETIRED_ACTION_EVENTS[action]);
    } catch {
      // Retired observers are local diagnostics/UI hooks and cannot disable About.
    } finally {
      this.retiredActionPendingValue = false;
    }
  }

  private requestMainMenu(): void {
    if (!this.canInteract()) {
      return;
    }
    this.navigationPendingValue = true;
    const previousParent = this.root.parent;
    const previousSiblingIndex = this.root.getSiblingIndex();
    const transaction: AboutNavigationTransaction = Object.freeze({
      destination: 'MainMenuLayer',
      root: this.root,
      timing: 'immediate',
      zOrder: 1,
    });

    let committed = false;
    try {
      committed = this.lifecycle.onMainMenuRequested(transaction) !== false;
    } catch (error) {
      this.navigationPendingValue = false;
      this.recoverRejectedNavigation(
        previousParent,
        previousSiblingIndex,
        error,
      );
      throw error;
    }
    if (!committed) {
      this.navigationPendingValue = false;
      this.recoverRejectedNavigation(
        previousParent,
        previousSiblingIndex,
        null,
      );
      return;
    }

    let effectsEnabled: boolean;
    try {
      effectsEnabled = this.readEffectsEnabled();
      if (typeof effectsEnabled !== 'boolean') {
        throw new TypeError('About effectsEnabled() must return a boolean');
      }
    } catch (error) {
      throw new AboutPostCommitSettingsError(error);
    }
    if (effectsEnabled) {
      try {
        this.audio.playOneShot(ABOUT_BACK_AUDIO_CANONICAL_PATH);
      } catch (error) {
        throw new AboutPostCommitAudioError(error);
      }
    }
  }

  private recoverRejectedNavigation(
    previousParent: Node | null,
    previousSiblingIndex: number,
    primaryError: unknown,
  ): void {
    const failures: unknown[] = [];
    attemptCleanup(
      failures,
      () => restoreRootAfterRejectedTransaction(
        this.root,
        previousParent,
        previousSiblingIndex,
      ),
    );
    attemptCleanup(failures, () => {
      if (!this.rearmNavigationAfterFailure()) {
        throw new Error('About navigation source could not be rearmed');
      }
    });
    if (failures.length > 0) {
      throw new AboutCleanupError(
        'About rejected-navigation recovery failed',
        primaryError === null ? failures : [primaryError, ...failures],
      );
    }
  }

  private resetEntryState(): void {
    this.navigationPendingValue = false;
    this.retiredActionPendingValue = false;
    this.pulseElapsedSecondsValue = 0;
    this.nextHeartEmissionOrdinal = 1;
    this.resetControlFrames();
    this.graph.review.node.setScale(
      this.presentation.menu.review.inferredInitialScale.x,
      this.presentation.menu.review.inferredInitialScale.y,
      1,
    );
  }

  private resetControlFrames(): void {
    setButtonFrame(this.graph.menuButton, this.graph.menuButton.normal);
    setButtonFrame(this.graph.review, this.graph.review.normal);
    setButtonFrame(this.graph.email, this.graph.email.normal);
    setButtonFrame(this.graph.like, this.graph.like.normal);
  }

  private projectReviewPulse(): void {
    const pulse = this.presentation.reviewPulsePlan;
    if (pulse === null) {
      return;
    }
    const firstAction = pulse.sequence[0];
    const secondScaleAction = pulse.sequence[2];
    if (
      firstAction?.type !== 'scale-to'
      || secondScaleAction?.type !== 'scale-to'
    ) {
      throw new Error('About review pulse scale sequence changed');
    }

    const cycleElapsed = this.pulseElapsedSecondsValue
      % pulse.cycleDurationSeconds;
    let scaleX: number;
    let scaleY: number;
    if (cycleElapsed <= pulse.firstEmissionAtSeconds) {
      const progress = cycleElapsed / pulse.firstEmissionAtSeconds;
      scaleX = interpolateFloat32(
        pulse.initialScale,
        firstAction.scaleX,
        progress,
      );
      scaleY = interpolateFloat32(
        pulse.initialScale,
        firstAction.scaleY,
        progress,
      );
    } else {
      const duration = pulse.secondEmissionAtSeconds
        - pulse.firstEmissionAtSeconds;
      const progress = (cycleElapsed - pulse.firstEmissionAtSeconds) / duration;
      scaleX = interpolateFloat32(
        firstAction.scaleX,
        secondScaleAction.scaleX,
        progress,
      );
      scaleY = interpolateFloat32(
        firstAction.scaleY,
        secondScaleAction.scaleY,
        progress,
      );
    }
    this.graph.review.node.setScale(scaleX, scaleY, 1);
  }

  private emitHeart(bornAtSeconds: number): void {
    const plan = createAboutHeartEmissionPlan(
      this.resources.assetTree,
      this.presentation.viewport,
      this.random,
    );
    if (
      plan.resourceCanonicalPath !== this.heartResource.canonicalPath
      || plan.actions.length !== 2
      || plan.actions[0]?.type !== 'fade-out'
      || plan.actions[1]?.type !== 'move-by'
      || plan.actionsRunConcurrently !== true
      || plan.actionsStartBeforeRootAttachment !== true
      || plan.finalState !== 'invisible-retained-child'
      || plan.perHeartCleanupAction !== false
    ) {
      throw new Error('About heart emission contract changed');
    }

    const node = new Node(`about-heart-${String(this.hearts.length + 1)}`);
    try {
      const transform = node.addComponent(UITransform);
      transform.setAnchorPoint(plan.anchor.x, plan.anchor.y);
      transform.setContentSize(
        this.heartResource.dimensions.width,
        this.heartResource.dimensions.height,
      );
      const opacity = node.addComponent(UIOpacity);
      opacity.opacity = OPAQUE_CHANNEL;
      const sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.spriteFrame = this.heartResource.spriteFrame;
      node.setWorldPosition(plan.position.x, plan.position.y, plan.zOrder);
      node.setScale(plan.scale, plan.scale, 1);

      // Keep dynamic hearts after the menu and before the nonvisual gesture layer.
      attachPreservingWorld(
        node,
        this.root,
        this.graph.gestures.getSiblingIndex(),
      );
      this.hearts.push(Object.freeze({
        bornAtSeconds,
        durationSeconds: plan.durationSeconds,
        node,
        opacity,
        rise: plan.rise,
        startPosition: Object.freeze({
          x: plan.position.x,
          y: plan.position.y,
        }),
      }));
    } catch (error) {
      const cleanupFailures: unknown[] = [];
      if (isValid(node, true)) {
        attemptCleanup(cleanupFailures, () => node.destroy());
      }
      if (cleanupFailures.length > 0) {
        throw new AboutCleanupError(
          'About heart construction rollback failed',
          [error, ...cleanupFailures],
        );
      }
      throw error;
    }
  }

  private projectHearts(): void {
    for (const heart of this.hearts) {
      if (!isValid(heart.node, true)) {
        throw new Error('About retained heart became invalid');
      }
      const ageSeconds = Math.max(
        0,
        this.pulseElapsedSecondsValue - heart.bornAtSeconds,
      );
      const progress = heart.durationSeconds === 0
        ? 1
        : Math.min(1, ageSeconds / heart.durationSeconds);
      heart.opacity.opacity = Math.fround(
        OPAQUE_CHANNEL * Math.fround(1 - progress),
      );
      heart.node.setWorldPosition(
        heart.startPosition.x,
        interpolateFloat32(
          heart.startPosition.y,
          Math.fround(heart.startPosition.y + heart.rise),
          progress,
        ),
        heart.node.worldPosition.z,
      );
    }
  }

  private markCleanupPoisoned(): void {
    this.cleanupPoisoned = true;
    this.suspendedValue = true;
    this.retiredActionPendingValue = false;
  }

  private canInteract(): boolean {
    return (
      this.activatedValue
      && !this.suspendedValue
      && !this.cleanupPoisoned
      && !this.disposedValue
      && !this.navigationPendingValue
      && !this.retiredActionPendingValue
    );
  }
}

function constructRuntimeGraph(
  root: Node,
  presentation: AboutPresentationSnapshot,
  resources: LoadedAboutResources,
): RuntimeGraph {
  const background = createSpriteNode(
    'background',
    requireRaster(resources, presentation.background.resource),
    presentation.background.anchor,
  );
  background.node.setWorldPosition(
    presentation.background.position.x,
    presentation.background.position.y,
    0,
  );
  attachPreservingWorld(
    background.node,
    root,
    presentation.background.attachmentInsertion - 1,
  );

  const menu = new Node('menu');
  menu.setWorldPosition(
    presentation.menu.position.x,
    presentation.menu.position.y,
    0,
  );
  attachPreservingWorld(
    menu,
    root,
    presentation.menu.attachmentInsertion - 1,
  );

  const menuButton = createButtonControl(
    'menu-item',
    presentation.menu.menu,
    resources,
  );
  const review = createButtonControl(
    'review-item',
    presentation.menu.review,
    resources,
  );
  const email = createButtonControl(
    'email-item',
    presentation.menu.email,
    resources,
  );
  const like = createButtonControl(
    'like-item',
    presentation.menu.like,
    resources,
  );
  for (const [control, plan] of [
    [menuButton, presentation.menu.menu],
    [review, presentation.menu.review],
    [email, presentation.menu.email],
    [like, presentation.menu.like],
  ] as const) {
    control.node.setPosition(plan.position.x, plan.position.y, 0);
    control.node.setScale(
      plan.inferredInitialScale.x,
      plan.inferredInitialScale.y,
      1,
    );
    attachLocal(control.node, menu, plan.insertionIndex);
  }

  const gestures = new Node('gestures-layer');
  const gesturesTransform = gestures.addComponent(UITransform);
  gesturesTransform.setAnchorPoint(0.5, 0.5);
  gesturesTransform.setContentSize(
    presentation.viewport.logicalWidth,
    presentation.viewport.logicalHeight,
  );
  gestures.setWorldPosition(
    presentation.viewport.visibleRect.center.x,
    presentation.viewport.visibleRect.center.y,
    0,
  );
  attachPreservingWorld(gestures, root, 2);

  if (
    root.children.length !== 3
    || menu.children.length !== 4
    || root.children[0] !== background.node
    || root.children[1] !== menu
    || root.children[2] !== gestures
    || menu.children[0] !== menuButton.node
    || menu.children[1] !== review.node
    || menu.children[2] !== email.node
    || menu.children[3] !== like.node
  ) {
    throw new Error('About presenter must construct the exact background/menu/gesture graph');
  }
  return Object.freeze({
    background,
    email,
    gestures,
    like,
    menu,
    menuButton,
    review,
  });
}

function createSpriteNode(
  name: string,
  resource: LoadedGameRasterResource,
  anchor: Readonly<{ readonly x: number; readonly y: number }>,
): RuntimeSprite {
  const node = new Node(name);
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(anchor.x, anchor.y);
  transform.setContentSize(
    resource.dimensions.width,
    resource.dimensions.height,
  );
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  return Object.freeze({ node, sprite, transform });
}

function createButtonControl(
  name: string,
  presentation: AboutPresentationSnapshot['menu']['menu'],
  resources: LoadedAboutResources,
): RuntimeButtonControl {
  const normal = requireRaster(resources, presentation.resources.normal);
  const selected = requireRaster(resources, presentation.resources.selected);
  return Object.freeze({
    ...createSpriteNode(name, normal, presentation.anchor),
    normal,
    selected,
  });
}

function requireRaster(
  resources: LoadedAboutResources,
  expected: AboutRasterResource,
): LoadedGameRasterResource {
  const loaded = resources.raster(expected);
  if (
    loaded === null
    || typeof loaded !== 'object'
    || loaded.canonicalPath !== expected.canonicalPath
    || loaded.dimensions.width !== expected.dimensions.width
    || loaded.dimensions.height !== expected.dimensions.height
    || !isValid(loaded.spriteFrame, true)
  ) {
    throw new Error(`About raster contract changed: ${expected.canonicalPath}`);
  }
  return loaded;
}

function setButtonFrame(
  control: RuntimeButtonControl,
  resource: LoadedGameRasterResource,
): void {
  control.sprite.spriteFrame = resource.spriteFrame;
  control.transform.setContentSize(
    resource.dimensions.width,
    resource.dimensions.height,
  );
}

function registerControlEvents(
  control: RuntimeButtonControl,
  start: () => void,
  end: () => void,
  cancel: () => void,
  target: AboutPresenter,
): void {
  control.node.on(Node.EventType.TOUCH_START, start, target);
  control.node.on(Node.EventType.TOUCH_END, end, target);
  control.node.on(Node.EventType.TOUCH_CANCEL, cancel, target);
}

function unregisterControlEvents(
  failures: unknown[],
  control: RuntimeButtonControl,
  start: () => void,
  end: () => void,
  cancel: () => void,
  target: AboutPresenter,
): void {
  attemptCleanup(
    failures,
    () => control.node.off(Node.EventType.TOUCH_START, start, target),
  );
  attemptCleanup(
    failures,
    () => control.node.off(Node.EventType.TOUCH_END, end, target),
  );
  attemptCleanup(
    failures,
    () => control.node.off(Node.EventType.TOUCH_CANCEL, cancel, target),
  );
}

function emissionTimeForOrdinal(
  presentation: AboutPresentationSnapshot,
  ordinal: number,
): number {
  const pulse = presentation.reviewPulsePlan;
  if (pulse === null) {
    return Number.POSITIVE_INFINITY;
  }
  const cycleIndex = Math.floor((ordinal - 1) / 2);
  const withinCycle = ordinal % 2 === 1
    ? pulse.firstEmissionAtSeconds
    : pulse.secondEmissionAtSeconds;
  return Math.fround(
    Math.fround(cycleIndex * pulse.cycleDurationSeconds) + withinCycle,
  );
}

function copyEffectsReader(settings: AboutSettingsSnapshot): () => boolean {
  assertExactObject(settings, SETTINGS_KEYS, 'About settings snapshot');
  if (typeof settings.effectsEnabled !== 'function') {
    throw new TypeError('About effectsEnabled must be a function');
  }
  return settings.effectsEnabled.bind(settings);
}

function copyLocalReviewEligibility(
  input: AboutLocalReviewEligibilityInput,
): AboutLocalReviewEligibilityInput {
  assertExactObject(
    input,
    LOCAL_ELIGIBILITY_KEYS,
    'About local review eligibility',
  );
  if (
    typeof input.localCompatibilityAvailable !== 'boolean'
    || typeof input.rated !== 'boolean'
  ) {
    throw new TypeError('About local review eligibility values must be boolean');
  }
  return Object.freeze({
    localCompatibilityAvailable: input.localCompatibilityAvailable,
    rated: input.rated,
  });
}

function restoreRootAfterRejectedTransaction(
  root: Node,
  previousParent: Node | null,
  siblingIndex: number,
): void {
  if (!isValid(root, true)) {
    throw new Error('About root was destroyed during a rejected transaction');
  }
  if (
    previousParent === null
    || !isValid(previousParent, true)
    || !previousParent.activeInHierarchy
  ) {
    throw new Error('About transaction lost its active source host');
  }
  if (root.parent !== previousParent) {
    root.setParent(previousParent, true);
  }
  root.setSiblingIndex(siblingIndex);
  if (
    root.parent !== previousParent
    || root.getSiblingIndex() !== siblingIndex
  ) {
    throw new Error('About transaction could not restore its source sibling index');
  }
  root.active = true;
}

function attachPreservingWorld(
  node: Node,
  parent: Node,
  siblingIndex: number,
): void {
  applyLayerRecursively(node, parent.layer);
  node.setParent(parent, true);
  node.setSiblingIndex(siblingIndex);
}

function attachLocal(node: Node, parent: Node, siblingIndex: number): void {
  applyLayerRecursively(node, parent.layer);
  node.setParent(parent);
  node.setSiblingIndex(siblingIndex);
}

function applyLayerRecursively(root: Node, layer: number): void {
  root.layer = layer;
  for (const child of root.children) {
    applyLayerRecursively(child, layer);
  }
}

function assertInput(input: AboutPresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('About presenter input must be an object');
  }
  if (!isValid(input.canvas, true) || !input.canvas.activeInHierarchy) {
    throw new Error('About canvas must be valid and active');
  }
  if (
    input.resources === null
    || typeof input.resources !== 'object'
    || input.resources.rasterCount !== ABOUT_RASTER_RESOURCE_COUNT
  ) {
    throw new Error('About presenter requires the complete 10-raster catalog');
  }
  assertFunctions(input.resources, ['raster'], 'resources');
  assertFunctions(input.audio, ['playOneShot'], 'audio');
  assertFunctions(
    input.lifecycle,
    ['onMainMenuRequested', 'onRetiredAction'],
    'lifecycle',
  );
  assertFunctions(
    input.random,
    ['nextDecile', 'nextIntInclusive'],
    'random',
  );
  copyEffectsReader(input.settings);
  copyLocalReviewEligibility(input.localReviewEligibility);
  createAboutPresentation(
    input.resources.assetTree,
    input.viewport,
    input.localReviewEligibility,
  );
}

function assertFunctions(
  value: unknown,
  names: readonly string[],
  label: string,
): void {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`About ${label} port must be an object`);
  }
  for (const name of names) {
    if (
      !(name in value)
      || typeof (value as Record<string, unknown>)[name] !== 'function'
    ) {
      throw new TypeError(`About ${label} port requires ${name}()`);
    }
  }
}

function assertExactObject(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== expectedKeys.length
    || expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(value, key))
  ) {
    throw new RangeError(`${label} must contain exactly ${expectedKeys.join(', ')}`);
  }
}

function assertAttachedActiveHost(root: Node, message: string): void {
  if (
    root.parent === null
    || !isValid(root.parent, true)
    || !root.parent.activeInHierarchy
  ) {
    throw new Error(message);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number`);
  }
}

function interpolateFloat32(
  start: number,
  end: number,
  progress: number,
): number {
  return Math.fround(
    Math.fround(start)
    + Math.fround(Math.fround(end - start) * Math.fround(progress)),
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function attemptCleanup(failures: unknown[], cleanup: () => unknown): void {
  try {
    cleanup();
  } catch (error) {
    failures.push(error);
  }
}
