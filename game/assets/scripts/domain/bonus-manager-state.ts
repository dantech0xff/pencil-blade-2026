import type {
  BonusTossFruitId,
  BonusTossStatePort,
} from './bonus-toss-strategy';

export const RECOVERED_BONUS_IDS = Object.freeze([10, 11, 12] as const);

export interface BonusManagerSnapshot {
  readonly doubleScoreEnabled: boolean;
  readonly doubleTossEnabled: boolean;
  readonly freezeEnabled: boolean;
}

/**
 * Process-local port of the native BonusManager's three static flags.
 *
 * Native Enable/Disable ignore IDs outside 10..12, while IsBonusEnabled treats every
 * unsupported ID as already enabled. Keeping that asymmetry is required by BonusToss's
 * retry loop.
 */
export class BonusManagerState implements BonusTossStatePort {
  private readonly enabled = new Set<BonusTossFruitId>();

  reset(): void {
    this.enabled.clear();
  }

  enableBonusType(bonusId: number): void {
    const supported = supportedBonusId(bonusId);
    if (supported !== null) {
      this.enabled.add(supported);
    }
  }

  disableBonusType(bonusId: number): void {
    const supported = supportedBonusId(bonusId);
    if (supported !== null) {
      this.enabled.delete(supported);
    }
  }

  isEnabled(bonusId: BonusTossFruitId): boolean {
    return this.enabled.has(assertSupportedBonusId(bonusId));
  }

  isBonusEnabled(bonusId: number): boolean {
    const supported = supportedBonusId(bonusId);
    return supported === null || this.enabled.has(supported);
  }

  snapshot(): BonusManagerSnapshot {
    return Object.freeze({
      doubleScoreEnabled: this.enabled.has(10),
      doubleTossEnabled: this.enabled.has(11),
      freezeEnabled: this.enabled.has(12),
    });
  }
}

function supportedBonusId(value: number): BonusTossFruitId | null {
  assertSafeInteger(value, 'bonusId');
  switch (value) {
    case 10:
    case 11:
    case 12:
      return value;
    default:
      return null;
  }
}

function assertSupportedBonusId(value: number): BonusTossFruitId {
  const supported = supportedBonusId(value);
  if (supported === null) {
    throw new RangeError('BonusToss state supports only bonus IDs 10, 11, and 12');
  }
  return supported;
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}
