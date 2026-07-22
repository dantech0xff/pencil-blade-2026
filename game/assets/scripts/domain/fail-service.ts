/** Recovered three-indicator miss state, independent of terminal guarding. */

export const CLASSIC_FAIL_INDICATOR_COUNT = 3;

export interface FailPosition {
  readonly x: number;
  readonly y: number;
}

export type FailStrike = 1 | 2 | 3;

export type FailCommand =
  | Readonly<{
      type: 'queue-fail-indicator';
      missPosition: FailPosition;
      strike: FailStrike;
    }>
  | Readonly<{ type: 'increment-fail-count'; count: number }>
  | Readonly<{ type: 'game-over-callback' }>;

export interface FailSnapshot {
  readonly count: number;
}

const NO_FAIL_COMMANDS: readonly FailCommand[] = Object.freeze([]);

export class FailService {
  private countValue = 0;

  get count(): number {
    return this.countValue;
  }

  snapshot(): FailSnapshot {
    return Object.freeze({ count: this.countValue });
  }

  /**
   * The queue command is created before the count increments. Once all three
   * recovered indicators are occupied, later misses cannot address a fourth.
   */
  registerMiss(position: FailPosition): readonly FailCommand[] {
    const missPosition = copyPosition(position);
    if (this.countValue >= CLASSIC_FAIL_INDICATOR_COUNT) {
      return NO_FAIL_COMMANDS;
    }

    const strike = toFailStrike(this.countValue + 1);
    const queueCommand: FailCommand = Object.freeze({
      type: 'queue-fail-indicator',
      missPosition,
      strike,
    });

    this.countValue += 1;
    const incrementCommand: FailCommand = Object.freeze({
      type: 'increment-fail-count',
      count: this.countValue,
    });
    return Object.freeze([queueCommand, incrementCommand]);
  }

  /**
   * Every queued presentation callback checks the current shared count. There
   * is deliberately no consumed or exactly-once guard in this service.
   */
  completeIndicator(): readonly FailCommand[] {
    if (this.countValue !== CLASSIC_FAIL_INDICATOR_COUNT) {
      return NO_FAIL_COMMANDS;
    }
    return Object.freeze([
      Object.freeze({ type: 'game-over-callback' }),
    ]);
  }

  restart(): void {
    this.countValue = 0;
  }
}

function copyPosition(position: FailPosition): FailPosition {
  if (position === null || typeof position !== 'object') {
    throw new TypeError('position must be an object');
  }
  assertFinite(position.x, 'position.x');
  assertFinite(position.y, 'position.y');
  return Object.freeze({ x: position.x, y: position.y });
}

function toFailStrike(value: number): FailStrike {
  if (value === 1 || value === 2 || value === 3) {
    return value;
  }
  // Target-only validation prevents accidental access beyond three indicators.
  throw new RangeError('fail strike must identify one of the three indicators');
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}
