import { Node, isValid } from 'cc';

import type {
  ObjectiveAchievementPopupEvent,
} from '../domain/objectives-manager-state';

export interface ObjectiveAchievementHostPresenter {
  readonly isComplete: boolean;
  attach(parent: Node): void;
  dispose(): boolean;
  updateAction(deltaSeconds: number): void;
}

export interface ObjectiveAchievementHostInput {
  readonly createPresenter: (
    event: ObjectiveAchievementPopupEvent,
  ) => ObjectiveAchievementHostPresenter;
  readonly effectsEnabled: () => boolean;
  readonly onFailure: (error: Error) => void;
  readonly parent: Node;
  readonly playCheer: () => void;
}

interface HostedObjectiveAchievement {
  readonly presenter: ObjectiveAchievementHostPresenter;
  readonly target: Node;
}

/**
 * Process-screen-independent owner for achievement popups emitted by shell menu presenters.
 *
 * Each popup receives an isolated target directly under the serialized shell. Foreground screen
 * replacement therefore cannot remove a popup, while a failed attachment can destroy only its
 * own target without disturbing older presentations.
 */
export class ObjectiveAchievementHost {
  private readonly input: ObjectiveAchievementHostInput;
  private readonly orphanedTargets = new Set<Node>();
  private readonly presentations = new Set<HostedObjectiveAchievement>();
  private disposedValue = false;
  private nextTargetId = 1;

  private constructor(input: ObjectiveAchievementHostInput) {
    this.input = input;
  }

  static create(input: ObjectiveAchievementHostInput): ObjectiveAchievementHost {
    assertInput(input);
    return new ObjectiveAchievementHost(input);
  }

  get activePresentationCount(): number {
    return this.presentations.size;
  }

  get isDisposed(): boolean {
    return this.disposedValue;
  }

  readonly onPopup = (event: ObjectiveAchievementPopupEvent): void => {
    if (this.disposedValue) {
      return;
    }

    let presenter: ObjectiveAchievementHostPresenter | null = null;
    let target: Node | null = null;
    try {
      // Native order is fidelity-significant: gated cheer precedes popup construction/addition.
      if (this.input.effectsEnabled()) {
        this.input.playCheer();
      }
      presenter = this.input.createPresenter(event);
      assertPresenter(presenter);
      target = this.createPresentationTarget();
      presenter.attach(target);
      this.presentations.add(Object.freeze({ presenter, target }));
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      if (presenter !== null) {
        collectFailure(rollbackFailures, () => presenter?.dispose());
      }
      if (target !== null) {
        this.collectTargetCleanupFailure(rollbackFailures, target);
      }
      this.reportFailure(aggregateFailure(
        'Objective achievement presentation failed',
        error,
        rollbackFailures,
      ));
    }
  };

  update(deltaSeconds: number): void {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (this.disposedValue) {
      return;
    }

    for (const presentation of Array.from(this.presentations)) {
      let updateFailure: unknown | null = null;
      let complete = false;
      try {
        presentation.presenter.updateAction(deltaSeconds);
        complete = presentation.presenter.isComplete;
      } catch (error) {
        updateFailure = error;
      }
      if (updateFailure !== null) {
        this.retirePresentation(
          presentation,
          normalizeError(updateFailure, 'Objective achievement update failed'),
        );
      } else if (complete) {
        this.retirePresentation(presentation, null);
      }
    }
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    const failures: unknown[] = [];
    for (const presentation of Array.from(this.presentations)) {
      this.presentations.delete(presentation);
      this.collectPresentationCleanupFailures(failures, presentation);
    }
    for (const target of Array.from(this.orphanedTargets)) {
      this.orphanedTargets.delete(target);
      collectFailure(failures, () => destroyNode(target));
    }
    if (failures.length > 0) {
      this.reportFailure(aggregateFailures(
        'Objective achievement host teardown failed',
        failures,
      ));
    }
    return true;
  }

  private createPresentationTarget(): Node {
    let target: Node | null = null;
    try {
      target = new Node(`ShellObjectiveAchievementTarget-${this.nextTargetId}`);
      this.nextTargetId += 1;
      target.layer = this.input.parent.layer;
      target.setParent(this.input.parent);
      if (
        target.parent !== this.input.parent
        || !isValid(target, true)
        || !target.activeInHierarchy
      ) {
        throw new Error('Objective achievement target failed to attach to the app shell');
      }
      return target;
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      if (target !== null) {
        this.collectTargetCleanupFailure(rollbackFailures, target);
      }
      throw aggregateFailure(
        'Objective achievement target creation failed',
        error,
        rollbackFailures,
      );
    }
  }

  private retirePresentation(
    presentation: HostedObjectiveAchievement,
    primaryFailure: Error | null,
  ): void {
    if (!this.presentations.delete(presentation)) {
      return;
    }
    const cleanupFailures: unknown[] = [];
    this.collectPresentationCleanupFailures(cleanupFailures, presentation);
    if (primaryFailure !== null || cleanupFailures.length > 0) {
      this.reportFailure(primaryFailure === null
        ? aggregateFailures(
          'Objective achievement retirement failed',
          cleanupFailures,
        )
        : aggregateFailure(
          'Objective achievement retirement failed',
          primaryFailure,
          cleanupFailures,
        ));
    }
  }

  private collectPresentationCleanupFailures(
    failures: unknown[],
    presentation: HostedObjectiveAchievement,
  ): void {
    collectFailure(failures, () => presentation.presenter.dispose());
    this.collectTargetCleanupFailure(failures, presentation.target);
  }

  private collectTargetCleanupFailure(failures: unknown[], target: Node): void {
    try {
      destroyNode(target);
    } catch (error) {
      failures.push(error);
      if (isValid(target, true)) {
        this.orphanedTargets.add(target);
      }
    }
  }

  private reportFailure(error: Error): void {
    try {
      this.input.onFailure(error);
    } catch (reportingError) {
      console.error(aggregateFailure(
        'Objective achievement diagnostic failed',
        error,
        [reportingError],
      ));
    }
  }
}

function destroyNode(node: Node): void {
  if (isValid(node, true)) {
    node.destroy();
  }
}

function collectFailure(failures: unknown[], operation: () => void): void {
  try {
    operation();
  } catch (error) {
    failures.push(error);
  }
}

function aggregateFailure(
  label: string,
  primary: unknown,
  cleanupFailures: readonly unknown[],
): Error {
  const failure = normalizeError(primary, label);
  if (cleanupFailures.length === 0) {
    return failure;
  }
  return new Error(
    `${label}: ${failure.message}; cleanup failed: `
    + cleanupFailures.map(errorMessage).join('; '),
  );
}

function aggregateFailures(label: string, failures: readonly unknown[]): Error {
  return new Error(`${label}: ${failures.map(errorMessage).join('; ')}`);
}

function normalizeError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(`${fallback}: ${String(error)}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertInput(input: ObjectiveAchievementHostInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Objective achievement host input must be an object');
  }
  if (!isValid(input.parent, true) || !input.parent.activeInHierarchy) {
    throw new Error('Objective achievement host parent must be valid and active');
  }
  for (const [label, operation] of [
    ['createPresenter', input.createPresenter],
    ['effectsEnabled', input.effectsEnabled],
    ['onFailure', input.onFailure],
    ['playCheer', input.playCheer],
  ] as const) {
    if (typeof operation !== 'function') {
      throw new TypeError(`Objective achievement host ${label} must be a function`);
    }
  }
}

function assertPresenter(
  presenter: ObjectiveAchievementHostPresenter,
): void {
  if (
    presenter === null
    || typeof presenter !== 'object'
    || typeof presenter.attach !== 'function'
    || typeof presenter.dispose !== 'function'
    || typeof presenter.updateAction !== 'function'
    || typeof presenter.isComplete !== 'boolean'
  ) {
    throw new TypeError(
      'Objective achievement host presenter must provide lifecycle and completion',
    );
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be non-negative and finite`);
  }
}
