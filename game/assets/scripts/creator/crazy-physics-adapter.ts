import { ClassicPhysicsAdapter } from './classic-physics-adapter';

export const CRAZY_NORMAL_WORLD_SPEED = Math.fround(1);
export const CRAZY_FROZEN_WORLD_SPEED = Math.fround(0.5);

export interface CrazyPhysicsAdapterState {
  readonly active: boolean;
  readonly frozen: boolean;
  readonly restorePending: boolean;
  readonly worldSpeed: number;
}

export interface CrazyPhysicsDelegate {
  callAfterStep(mutation: () => void): void;
  configureResolvedWorldProperties(): void;
  raycastAll(
    startWorld: Readonly<{ readonly x: number; readonly y: number }>,
    endWorld: Readonly<{ readonly x: number; readonly y: number }>,
  ): ReturnType<ClassicPhysicsAdapter['raycastAll']>;
  restorePreviousWorldProperties(): void;
  startVariableSimulation(
    resolveVariableDelta: (frameDeltaSeconds: number) => number,
    afterVariableStep: (variableDeltaSeconds: number) => void,
  ): void;
}

export class CrazyPhysicsActivationError extends Error {
  readonly activationError: unknown;
  readonly cleanupError: unknown;
  readonly failures: readonly unknown[];

  constructor(activationError: unknown, cleanupError: unknown) {
    super(
      `Crazy physics activation failed and cleanup also failed: `
      + `${errorMessage(activationError)}; ${errorMessage(cleanupError)}`,
    );
    this.name = 'CrazyPhysicsActivationError';
    this.activationError = activationError;
    this.cleanupError = cleanupError;
    this.failures = Object.freeze([activationError, cleanupError]);
  }
}

/**
 * Crazy-owned facade over the shared recovered PhysicsLayer integration.
 * Freeze scales the variable world step to 0.5. Standard-bomb hits freeze only that bomb's
 * body; Crazy never pauses the whole Physics2D world at the bomb callback boundary.
 */
export class CrazyPhysicsAdapter {
  private activeValue = false;
  private readonly delegate: CrazyPhysicsDelegate;
  private frozenValue = false;
  private restorePendingValue = false;
  private worldSpeedValue = CRAZY_NORMAL_WORLD_SPEED;

  constructor(delegate: CrazyPhysicsDelegate = new ClassicPhysicsAdapter()) {
    assertDelegate(delegate);
    this.delegate = delegate;
  }

  get state(): CrazyPhysicsAdapterState {
    return Object.freeze({
      active: this.activeValue,
      frozen: this.frozenValue,
      restorePending: this.restorePendingValue,
      worldSpeed: this.worldSpeedValue,
    });
  }

  activate(afterVariableStep: (variableDeltaSeconds: number) => void): void {
    if (typeof afterVariableStep !== 'function') {
      throw new TypeError('afterVariableStep must be a function');
    }
    if (this.activeValue) {
      throw new Error('Crazy physics is already active');
    }
    if (this.restorePendingValue) {
      throw new Error('Crazy physics cleanup must complete before activation');
    }

    this.frozenValue = false;
    this.worldSpeedValue = CRAZY_NORMAL_WORLD_SPEED;
    try {
      this.delegate.configureResolvedWorldProperties();
      this.delegate.startVariableSimulation(
        (frameDeltaSeconds) => this.physicsStepDelta(frameDeltaSeconds),
        afterVariableStep,
      );
      this.activeValue = true;
    } catch (error: unknown) {
      try {
        this.delegate.restorePreviousWorldProperties();
      } catch (cleanupError: unknown) {
        this.restorePendingValue = true;
        throw new CrazyPhysicsActivationError(error, cleanupError);
      }
      throw error;
    }
  }

  deactivate(): boolean {
    if (!this.activeValue && !this.restorePendingValue) {
      return false;
    }
    this.delegate.restorePreviousWorldProperties();
    this.activeValue = false;
    this.frozenValue = false;
    this.restorePendingValue = false;
    this.worldSpeedValue = CRAZY_NORMAL_WORLD_SPEED;
    return true;
  }

  freezeWorld(): void {
    this.assertActive('freeze');
    this.frozenValue = true;
    this.worldSpeedValue = CRAZY_FROZEN_WORLD_SPEED;
  }

  unfreezeWorld(): void {
    this.assertActive('unfreeze');
    this.frozenValue = false;
    this.worldSpeedValue = CRAZY_NORMAL_WORLD_SPEED;
  }

  physicsStepDelta(frameDeltaSeconds: number): number {
    if (!Number.isFinite(frameDeltaSeconds) || frameDeltaSeconds < 0) {
      throw new RangeError('frameDeltaSeconds must be finite and non-negative');
    }
    return Math.fround(
      Math.fround(frameDeltaSeconds) * this.worldSpeedValue,
    );
  }

  callAfterStep(mutation: () => void): void {
    this.assertActive('queue an after-step mutation');
    this.delegate.callAfterStep(mutation);
  }

  raycastAll(
    startWorld: Readonly<{ readonly x: number; readonly y: number }>,
    endWorld: Readonly<{ readonly x: number; readonly y: number }>,
  ): ReturnType<ClassicPhysicsAdapter['raycastAll']> {
    this.assertActive('raycast');
    return this.delegate.raycastAll(startWorld, endWorld);
  }

  private assertActive(operation: string): void {
    if (!this.activeValue) {
      throw new Error(`Crazy physics must be active to ${operation}`);
    }
  }
}

function assertDelegate(delegate: CrazyPhysicsDelegate): void {
  if (delegate === null || typeof delegate !== 'object') {
    throw new TypeError('Crazy physics delegate must be an object');
  }
  for (const name of [
    'callAfterStep',
    'configureResolvedWorldProperties',
    'raycastAll',
    'restorePreviousWorldProperties',
    'startVariableSimulation',
  ] as const) {
    if (typeof delegate[name] !== 'function') {
      throw new TypeError(`Crazy physics delegate must provide ${name}()`);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
