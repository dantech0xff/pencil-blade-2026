import {
  Color,
  Graphics,
  Node,
  isValid,
} from 'cc';

import {
  StandardBombExplosionState,
  type StandardBombExplosionPoint,
  type StandardBombExplosionStateInput,
  type StandardBombExplosionStateSnapshot,
} from '../domain/standard-bomb-explosion-state';

export const STANDARD_BOMB_EXPLOSION_Z_ORDER = 1 as const;

const OPAQUE_CHANNEL = 255;
const RECOVERED_LINE_WIDTH = 1;

export type StandardBombExplosionPresenterInput = StandardBombExplosionStateInput;

export interface StandardBombExplosionPresenterLifecycle {
  readonly onFinished: () => void;
}

export interface StandardBombExplosionPresenterSnapshot {
  readonly attached: boolean;
  readonly disposed: boolean;
  readonly explosion: StandardBombExplosionStateSnapshot;
  readonly finishNotified: boolean;
}

export class StandardBombExplosionCleanupError extends Error {
  readonly causes: readonly unknown[];

  constructor(message: string, causes: readonly unknown[]) {
    super(message);
    this.name = 'StandardBombExplosionCleanupError';
    this.causes = Object.freeze([...causes]);
  }
}

/**
 * Opaque-white procedural standard-Bomb presentation on a world-coordinate root.
 *
 * Callers attach this node directly to the gameplay overlay/world root. Keeping the root at
 * world origin lets the recovered absolute VisibleRect and cut-time Bomb coordinates pass to
 * Graphics unchanged; attaching it as a translated Bomb child would double-translate them.
 */
export class StandardBombExplosionPresenter {
  readonly graphics: Graphics;
  readonly root: Node;

  private attachedValue = false;
  private disposedValue = false;
  private finishNotifiedValue = false;
  private finishPendingValue = false;
  private readonly lifecycle: StandardBombExplosionPresenterLifecycle;
  private readonly model: StandardBombExplosionState;

  private constructor(
    model: StandardBombExplosionState,
    lifecycle: StandardBombExplosionPresenterLifecycle,
  ) {
    this.model = model;
    this.lifecycle = lifecycle;
    this.root = new Node('StandardBombExplosion');
    this.root.active = false;

    try {
      this.graphics = this.root.addComponent(Graphics);
      this.graphics.lineWidth = RECOVERED_LINE_WIDTH;
      this.graphics.fillColor = opaqueWhite();
      this.redraw();
    } catch (error) {
      if (isValid(this.root, true)) {
        this.root.destroy();
      }
      throw error;
    }
  }

  static create(
    input: StandardBombExplosionPresenterInput,
    lifecycle: StandardBombExplosionPresenterLifecycle,
  ): StandardBombExplosionPresenter {
    assertLifecycle(lifecycle);
    const model = new StandardBombExplosionState(input);
    return new StandardBombExplosionPresenter(model, lifecycle);
  }

  /** Pure explosion state for controller diagnostics and deterministic tests. */
  get state(): StandardBombExplosionStateSnapshot {
    return this.model.snapshot();
  }

  snapshot(): StandardBombExplosionPresenterSnapshot {
    return Object.freeze({
      attached: this.attachedValue,
      disposed: this.disposedValue,
      explosion: this.model.snapshot(),
      finishNotified: this.finishNotifiedValue,
    });
  }

  attach(parent: Node, zOrder: 1 = STANDARD_BOMB_EXPLOSION_Z_ORDER): void {
    if (!isValid(parent, true) || !parent.activeInHierarchy) {
      throw new Error('Standard Bomb explosion parent must be valid and active');
    }
    if (zOrder !== STANDARD_BOMB_EXPLOSION_Z_ORDER) {
      throw new RangeError('Standard Bomb explosion only supports recovered z-order 1');
    }
    if (this.disposedValue || !isValid(this.root, true)) {
      throw new Error('Disposed Standard Bomb explosion cannot be attached');
    }
    if (this.attachedValue || this.root.parent !== null) {
      throw new Error('Standard Bomb explosion is already attached');
    }

    try {
      // Reset after any rolled-back attachment, then preserve world origin under an offset
      // gameplay root. All Graphics vertices remain absolute world coordinates.
      this.root.setWorldPosition(0, 0, 0);
      this.root.layer = parent.layer;
      this.root.setParent(parent, true);
      this.root.setSiblingIndex(zOrder);
      this.root.active = true;
      this.attachedValue = true;
      this.redraw();
    } catch (error) {
      const rollbackFailures = this.rollbackAttachment();
      if (rollbackFailures.length > 0) {
        throw new StandardBombExplosionCleanupError(
          'Standard Bomb explosion attach failed and rollback was incomplete',
          [error, ...rollbackFailures],
        );
      }
      throw error;
    }
  }

  updateAction(deltaSeconds: number): void {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (this.finishPendingValue) {
      this.completeNaturalFinish();
      return;
    }
    if (this.disposedValue) {
      return;
    }
    if (
      !this.attachedValue
      || this.root.parent === null
      || !isValid(this.root, true)
    ) {
      throw new Error('Standard Bomb explosion must be attached before updating actions');
    }

    const result = this.model.updateAction(deltaSeconds);
    this.redraw();
    if (result.finishedNow) {
      this.finishPendingValue = true;
      this.disposedValue = true;
      this.attachedValue = false;
      this.completeNaturalFinish();
    }
  }

  /** Explicit scene-teardown path. It never synthesizes the natural finish callback. */
  dispose(): boolean {
    if (this.finishPendingValue) {
      const firstDisposal = !this.disposedValue;
      this.completeNaturalFinish();
      return firstDisposal;
    }

    const firstDisposal = !this.disposedValue;
    this.disposedValue = true;
    this.attachedValue = false;
    const failures = this.cleanupRoot();
    throwCleanupFailures('Standard Bomb explosion disposal', failures);
    return firstDisposal;
  }

  private redraw(): void {
    const snapshot = this.model.snapshot();
    this.graphics.clear();
    this.graphics.lineWidth = RECOVERED_LINE_WIDTH;
    this.graphics.fillColor = opaqueWhite();

    if (snapshot.phase === 'flash') {
      fillPolygon(this.graphics, [
        frozenPoint(snapshot.visibleRect.left, snapshot.visibleRect.top),
        frozenPoint(snapshot.visibleRect.right, snapshot.visibleRect.top),
        frozenPoint(snapshot.visibleRect.right, snapshot.visibleRect.bottom),
        frozenPoint(snapshot.visibleRect.left, snapshot.visibleRect.bottom),
      ]);
      return;
    }
    if (snapshot.phase !== 'triangles') {
      return;
    }

    for (const triangle of snapshot.triangles) {
      fillPolygon(this.graphics, [
        snapshot.bombWorldPosition,
        triangle.firstEdgePoint,
        triangle.secondEdgePoint,
      ]);
    }
  }

  private completeNaturalFinish(): void {
    const failures = this.cleanupRoot();
    const parentStillAttached = this.root.parent !== null;
    if (parentStillAttached || isValid(this.root, true)) {
      throwCleanupFailures('Standard Bomb explosion finish cleanup', failures);
      throw new Error('Standard Bomb explosion finish cleanup left its root alive');
    }

    this.finishPendingValue = false;
    let callbackFailure: unknown;
    if (!this.finishNotifiedValue) {
      // Set before invoking user code so a throwing callback remains exactly-once.
      this.finishNotifiedValue = true;
      try {
        this.lifecycle.onFinished();
      } catch (error) {
        callbackFailure = error;
      }
    }
    if (callbackFailure !== undefined) {
      failures.push(callbackFailure);
    }
    throwCleanupFailures('Standard Bomb explosion natural finish', failures);
  }

  private rollbackAttachment(): unknown[] {
    const failures: unknown[] = [];
    this.attachedValue = false;
    this.root.active = false;
    if (this.root.parent !== null) {
      runCleanup(failures, () => this.root.removeFromParent());
    }
    const parentStillAttached = this.root.parent !== null;
    if (parentStillAttached && isValid(this.root, true)) {
      runCleanup(failures, () => this.root.destroy());
    }
    if (!isValid(this.root, true)) {
      this.disposedValue = true;
    } else if (this.root.parent === null) {
      runCleanup(failures, () => this.root.setWorldPosition(0, 0, 0));
    }
    return failures;
  }

  private cleanupRoot(): unknown[] {
    const failures: unknown[] = [];
    this.attachedValue = false;
    if (this.root.parent !== null) {
      runCleanup(failures, () => this.root.removeFromParent());
    }
    if (isValid(this.root, true)) {
      runCleanup(failures, () => this.root.destroy());
    }
    return failures;
  }
}

function fillPolygon(
  graphics: Graphics,
  points: readonly [
    StandardBombExplosionPoint,
    StandardBombExplosionPoint,
    StandardBombExplosionPoint,
    ...StandardBombExplosionPoint[],
  ],
): void {
  const first = points[0];
  graphics.moveTo(first.x, first.y);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    graphics.lineTo(point.x, point.y);
  }
  graphics.close();
  graphics.fill();
}

function opaqueWhite(): Color {
  return new Color(
    OPAQUE_CHANNEL,
    OPAQUE_CHANNEL,
    OPAQUE_CHANNEL,
    OPAQUE_CHANNEL,
  );
}

function frozenPoint(x: number, y: number): StandardBombExplosionPoint {
  return Object.freeze({ x, y });
}

function assertLifecycle(lifecycle: StandardBombExplosionPresenterLifecycle): void {
  if (
    lifecycle === null
    || typeof lifecycle !== 'object'
    || typeof lifecycle.onFinished !== 'function'
  ) {
    throw new TypeError('lifecycle must provide onFinished()');
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function runCleanup(failures: unknown[], cleanup: () => void): void {
  try {
    cleanup();
  } catch (error) {
    failures.push(error);
  }
}

function throwCleanupFailures(boundary: string, failures: readonly unknown[]): void {
  if (failures.length > 0) {
    throw new StandardBombExplosionCleanupError(boundary, failures);
  }
}
