/**
 * Testable lifecycle around the recovered one-step-per-frame physics policy.
 *
 * Creator's public manual step does not expose its private delayed-event guard, so every
 * project-owned physics lifecycle mutation must pass through `callAfterStep`.
 */

export interface ClassicVariableStepPort {
  readonly afterStep: () => void;
  readonly beforeStep: () => void;
  readonly drawDebug: () => void;
  readonly isEnabled: () => boolean;
  readonly step: (deltaSeconds: number) => void;
  readonly syncPhysicsToScene: () => void;
  readonly syncSceneToPhysics: () => void;
}

interface DeferredMutationFailure {
  readonly error: unknown;
}

export class ClassicVariableStepRunner {
  private readonly port: ClassicVariableStepPort;
  private readonly queuedMutations: Array<() => void> = [];
  private steppingValue = false;

  constructor(port: ClassicVariableStepPort) {
    assertPort(port);
    this.port = port;
  }

  get stepping(): boolean {
    return this.steppingValue;
  }

  run(deltaSeconds: number): boolean {
    assertFiniteNonNegative(deltaSeconds, 'deltaSeconds');
    if (!this.port.isEnabled()) {
      return false;
    }
    if (this.steppingValue) {
      throw new Error('Classic variable physics step cannot be re-entered');
    }

    this.port.beforeStep();
    try {
      this.port.syncSceneToPhysics();
      this.steppingValue = true;
      try {
        this.port.step(deltaSeconds);
      } catch (error: unknown) {
        this.queuedMutations.length = 0;
        throw error;
      } finally {
        this.steppingValue = false;
      }

      const deferredFailure = this.flushQueuedMutations();
      this.port.syncPhysicsToScene();
      this.port.drawDebug();
      if (deferredFailure !== null) {
        throw deferredFailure.error;
      }
      return true;
    } finally {
      this.steppingValue = false;
      this.port.afterStep();
    }
  }

  /** Execute immediately outside a step, or after Box2D unlocks when called by a callback. */
  callAfterStep(mutation: () => void): void {
    if (typeof mutation !== 'function') {
      throw new TypeError('mutation must be a function');
    }
    if (this.steppingValue) {
      this.queuedMutations.push(mutation);
    } else {
      mutation();
    }
  }

  private flushQueuedMutations(): DeferredMutationFailure | null {
    const mutations = this.queuedMutations.splice(0, this.queuedMutations.length);
    let firstFailure: DeferredMutationFailure | null = null;
    for (const mutation of mutations) {
      try {
        mutation();
      } catch (error: unknown) {
        firstFailure ??= { error };
      }
    }
    return firstFailure;
  }
}

function assertPort(port: ClassicVariableStepPort): void {
  if (port === null || typeof port !== 'object') {
    throw new TypeError('port must be an object');
  }
  const callbacks = [
    port.afterStep,
    port.beforeStep,
    port.drawDebug,
    port.isEnabled,
    port.step,
    port.syncPhysicsToScene,
    port.syncSceneToPhysics,
  ];
  if (callbacks.some((callback) => typeof callback !== 'function')) {
    throw new TypeError('port callbacks must be functions');
  }
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}
