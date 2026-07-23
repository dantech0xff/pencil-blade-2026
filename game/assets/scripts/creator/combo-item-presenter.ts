import {
  Color,
  Label,
  Node,
  UITransform,
  isValid,
} from 'cc';

import {
  ComboItemPresentationState,
  createComboItemPresentationPlan,
  type ComboItemPoint,
  type ComboItemPresentationSnapshot,
} from '../domain/combo-item-presentation';
import type { LoadedClassicFontResource } from './classic-resource-loader';

export interface ComboItemPresenterInput {
  readonly count: number;
  readonly fontResource: LoadedClassicFontResource;
  readonly position: ComboItemPoint;
  readonly viewportWidth: number;
}

export interface ComboItemPresenterLifecycle {
  readonly onDisposed?: (presenter: ComboItemPresenter) => void;
}

/**
 * Creator owner for the recovered shared `ComboItem` label.
 *
 * Native ownership is a two-level node: ComboManager attaches ComboItem at z=1, then
 * ComboItem attaches its label at z=1 and removes both after the label action finishes.
 */
export class ComboItemPresenter {
  readonly label: Label;
  readonly labelNode: Node;
  readonly root: Node;

  private attachedValue = false;
  private disposedValue = false;
  private disposedNotified = false;
  private readonly lifecycle: ComboItemPresenterLifecycle;
  private readonly state: ComboItemPresentationState;

  private constructor(
    input: ComboItemPresenterInput,
    lifecycle: ComboItemPresenterLifecycle,
  ) {
    assertInput(input);
    this.lifecycle = lifecycle;
    this.state = new ComboItemPresentationState(
      createComboItemPresentationPlan(
        input.count,
        input.position,
        input.viewportWidth,
      ),
    );

    this.root = new Node('ComboItem');
    this.root.active = false;
    this.labelNode = new Node('ComboItemLabel');
    this.labelNode.setParent(this.root);
    this.labelNode.setSiblingIndex(this.state.plan.zOrder);
    this.labelNode.setPosition(
      this.state.plan.position.x,
      this.state.plan.position.y,
      0,
    );
    this.labelNode.setScale(0, 0, 1);
    this.labelNode.addComponent(UITransform);
    this.label = this.labelNode.addComponent(Label);
    this.label.font = input.fontResource.font;
    this.label.fontSize = this.state.plan.fontSize;
    this.label.lineHeight = this.state.plan.fontSize;
    this.label.string = this.state.plan.text;
    this.label.color = new Color(
      this.state.plan.color.r,
      this.state.plan.color.g,
      this.state.plan.color.b,
      255,
    );
  }

  static create(
    input: ComboItemPresenterInput,
    lifecycle: ComboItemPresenterLifecycle = {},
  ): ComboItemPresenter {
    assertLifecycle(lifecycle);
    return new ComboItemPresenter(input, lifecycle);
  }

  get isAttached(): boolean {
    return this.attachedValue;
  }

  get isDisposed(): boolean {
    return this.disposedValue;
  }

  get snapshot(): ComboItemPresentationSnapshot {
    return this.state.snapshot;
  }

  attach(parent: Node): void {
    if (!isValid(parent, true) || !parent.activeInHierarchy) {
      throw new Error('ComboItem parent must be valid and active');
    }
    if (this.disposedValue || !isValid(this.root, true)) {
      throw new Error('Disposed ComboItem cannot be attached');
    }
    if (this.attachedValue || this.root.parent !== null) {
      throw new Error('ComboItem is already attached');
    }

    try {
      this.root.layer = parent.layer;
      this.labelNode.layer = parent.layer;
      this.root.setParent(parent);
      this.root.setSiblingIndex(this.state.plan.zOrder);
      this.root.active = true;
      this.attachedValue = true;
    } catch (error) {
      const failures: unknown[] = [];
      collectFailure(failures, () => this.dispose());
      if (failures.length > 0) {
        throw aggregateWithPrimary(
          'ComboItem attachment rollback failed',
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
    if (!this.attachedValue || this.root.parent === null) {
      throw new Error('ComboItem must be attached before update');
    }
    const update = this.state.updateAction(deltaSeconds);
    const scale = update.snapshot.scale;
    this.labelNode.setScale(scale, scale, 1);
    if (update.completedNow) {
      this.dispose();
    }
  }

  /** Explicit cleanup and natural action completion share the same idempotent boundary. */
  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.attachedValue = false;
    this.state.dispose();
    const failures: unknown[] = [];
    // Preserve native callback order: label first, then the owning ComboItem node.
    collectFailure(failures, () => {
      if (isValid(this.labelNode, true)) {
        this.labelNode.destroy();
      }
    });
    collectFailure(failures, () => {
      if (isValid(this.root, true)) {
        this.root.destroy();
      }
    });
    collectFailure(failures, () => this.notifyDisposed());
    throwFailures('ComboItem disposal', failures);
    return true;
  }

  private notifyDisposed(): void {
    if (this.disposedNotified) {
      return;
    }
    this.disposedNotified = true;
    this.lifecycle.onDisposed?.(this);
  }
}

function assertInput(input: ComboItemPresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('ComboItem presenter input must be an object');
  }
  if (
    input.fontResource === null
    || typeof input.fontResource !== 'object'
    || input.fontResource.canonicalPath !== 'Fonts/GroBold.ttf'
    || input.fontResource.font === null
    || input.fontResource.font === undefined
  ) {
    throw new Error('ComboItem requires the recovered Fonts/GroBold.ttf resource');
  }
  // The pure plan performs the remaining numeric and content validation.
  createComboItemPresentationPlan(
    input.count,
    input.position,
    input.viewportWidth,
  );
}

function assertLifecycle(lifecycle: ComboItemPresenterLifecycle): void {
  if (lifecycle === null || typeof lifecycle !== 'object') {
    throw new TypeError('ComboItem lifecycle must be an object');
  }
  if (
    lifecycle.onDisposed !== undefined
    && typeof lifecycle.onDisposed !== 'function'
  ) {
    throw new TypeError('ComboItem onDisposed must be a function when provided');
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be non-negative and finite`);
  }
}

function collectFailure(failures: unknown[], operation: () => void): void {
  try {
    operation();
  } catch (error) {
    failures.push(error);
  }
}

function throwFailures(message: string, failures: readonly unknown[]): void {
  if (failures.length === 0) {
    return;
  }
  throw cleanupError(message, failures);
}

function cleanupError(message: string, failures: readonly unknown[]): Error {
  const details = failures.map((failure) => (
    failure instanceof Error ? failure.message : String(failure)
  )).join('; ');
  return new Error(`${message} failed: ${details}`);
}

function aggregateWithPrimary(
  message: string,
  primary: unknown,
  failures: readonly unknown[],
): Error {
  const primaryMessage = primary instanceof Error ? primary.message : String(primary);
  const cleanupMessage = failures.map((failure) => (
    failure instanceof Error ? failure.message : String(failure)
  )).join('; ');
  return new Error(`${message}: ${primaryMessage}; cleanup: ${cleanupMessage}`);
}
