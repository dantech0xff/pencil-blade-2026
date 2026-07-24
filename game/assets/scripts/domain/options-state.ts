import type { GameplayRandom } from './gameplay-random';

export const OPTIONS_BACKGROUND_COUNT = 8 as const;
export const OPTIONS_BLADE_COUNT = 18 as const;
export const OPTIONS_THEME_COUNT = 10 as const;
export const OPTIONS_DEFAULT_BACKGROUND_INDEX = 0 as const;
export const OPTIONS_DEFAULT_BLADE_INDEX = 0 as const;
export const OPTIONS_PURCHASE_PARTICLE_TEXTURE_PATH
  = 'Blades/Particles/X-Mas/xmasfive.png' as const;
export const OPTIONS_PURCHASE_PARTICLE_COUNT = 45 as const;
export const OPTIONS_PURCHASE_PARTICLE_START_DELAY_SECONDS = Math.fround(0.05);
export const OPTIONS_PURCHASE_PARTICLE_CLEANUP_DELAY_SECONDS = Math.fround(1.4);
export const OPTIONS_PURCHASE_PARTICLE_REMOVE_AT_SECONDS = Math.fround(
  OPTIONS_PURCHASE_PARTICLE_START_DELAY_SECONDS
    + OPTIONS_PURCHASE_PARTICLE_CLEANUP_DELAY_SECONDS,
);
export const OPTIONS_PURCHASE_PARTICLE_DURATION_MINIMUM_HUNDREDTHS = 35 as const;
export const OPTIONS_PURCHASE_PARTICLE_DURATION_MAXIMUM_HUNDREDTHS = 70 as const;
export const OPTIONS_PURCHASE_PARTICLE_MINIMUM_TRAVEL_MAGNITUDE = 35 as const;
export const OPTIONS_PURCHASE_PARTICLE_MAXIMUM_TRAVEL_MAGNITUDE = 70 as const;
export const OPTIONS_PURCHASE_PARTICLE_ROOT_Z_ORDER = 1 as const;
export const OPTIONS_PURCHASE_PARTICLE_SPRITE_Z_ORDER = 0 as const;

const OPTIONS_PURCHASE_EMITTER_REFERENCE_WIDTH = Math.fround(480);
const OPTIONS_PURCHASE_EMITTER_X_FACTOR = Math.fround(50);
const OPTIONS_PURCHASE_EMITTER_Y_FACTOR = Math.fround(150);
const HUNDREDTHS_PER_SECOND = Math.fround(100);

export type OptionsSelectionCategory = 'background' | 'blade' | 'theme';
export type OptionsPurchasableCategory = Exclude<OptionsSelectionCategory, 'theme'>;

export interface OptionsStateInput {
  readonly backgroundPrices: readonly number[];
  readonly bladePrices: readonly number[];
  readonly selectedBackground: number;
  readonly selectedBlade: number;
  readonly selectedTheme: number;
  readonly totalCoins: number;
}

export interface OptionsStateSnapshot extends OptionsStateInput {}

export interface OptionsSelectionChange {
  readonly category: OptionsSelectionCategory;
  readonly changed: boolean;
  readonly nextIndex: number;
  readonly owned: boolean;
  readonly previousIndex: number;
  /** Themes have no recovered purchase-price table. */
  readonly price: number | null;
}

export interface OptionsDebitIntent {
  readonly amount: number;
  readonly nextTotalCoins: number;
  readonly previousTotalCoins: number;
  readonly reason: 'purchase-background' | 'purchase-blade';
}

export interface OptionsOwnershipIntent {
  readonly category: OptionsPurchasableCategory;
  readonly index: number;
  readonly nextPrice: 0;
  readonly previousPrice: number;
}

export type OptionsPurchaseStatus =
  | 'already-owned'
  | 'insufficient-coins'
  | 'purchased';

export interface OptionsPurchaseResult {
  readonly affordable: boolean;
  readonly category: OptionsPurchasableCategory;
  readonly debitIntent: OptionsDebitIntent | null;
  readonly index: number;
  readonly nextPrice: number;
  readonly nextTotalCoins: number;
  readonly ownershipIntent: OptionsOwnershipIntent | null;
  readonly previousPrice: number;
  readonly previousTotalCoins: number;
  readonly purchased: boolean;
  readonly status: OptionsPurchaseStatus;
}

export interface OptionsSelectionSet {
  readonly background: number;
  readonly blade: number;
  readonly theme: number;
}

export interface OptionsSelectionChangedFlags {
  readonly background: boolean;
  readonly blade: boolean;
  readonly theme: false;
}

export interface OptionsExitRollbackIntent {
  readonly category: OptionsPurchasableCategory;
  readonly nextIndex: 0;
  readonly previousIndex: number;
  readonly reason: 'unowned-selection-exit-rollback';
}

export interface OptionsExitRollbackResult {
  readonly changed: OptionsSelectionChangedFlags;
  readonly nextSelections: OptionsSelectionSet;
  readonly previousSelections: OptionsSelectionSet;
  /**
   * Selection writes are intents for the process-owned Settings runtime.
   * This pure model deliberately owns no storage or save-data operation.
   */
  readonly selectionIntents: readonly OptionsExitRollbackIntent[];
  readonly themeRetained: true;
}

export interface OptionsPurchaseBurstViewport {
  /** Raw logical director width W; native code intentionally uses W for X and Y. */
  readonly logicalWidth: number;
}

export interface OptionsParticlePoint {
  readonly x: number;
  readonly y: number;
}

export interface OptionsPurchaseBurstPlan {
  readonly autoDeleteParticles: false;
  readonly cleanupDelaySeconds: number;
  /** Recovered generic ParticleExplosion Create flags. */
  readonly colorFlags: readonly [false, false];
  readonly emitterWorldPosition: OptionsParticlePoint;
  readonly fadeOutParticles: false;
  readonly maximumTravelMagnitude: 70;
  readonly minimumTravelMagnitude: 35;
  readonly particleCount: 45;
  readonly particleRootZOrder: 1;
  readonly removeAtSeconds: number;
  readonly spriteChildZOrder: 0;
  readonly startDelaySeconds: number;
  readonly textureLogicalPath: typeof OPTIONS_PURCHASE_PARTICLE_TEXTURE_PATH;
}

export type OptionsPurchaseParticleRandom = Pick<GameplayRandom, 'nextIntInclusive'>;
export type OptionsPurchaseParticleSign = -1 | 0 | 1;

export interface OptionsPurchaseParticlePlan {
  readonly actionsRunConcurrently: true;
  readonly appliesColor: false;
  readonly autoDelete: false;
  readonly deltaLocal: OptionsParticlePoint;
  readonly durationHundredths: number;
  readonly durationSeconds: number;
  readonly fadeOut: false;
  readonly horizontalMagnitude: number;
  readonly horizontalSign: OptionsPurchaseParticleSign;
  readonly index: number;
  readonly moveActionSequence: readonly [
    Readonly<{
      readonly deltaLocal: OptionsParticlePoint;
      readonly durationSeconds: number;
      readonly type: 'move-by';
    }>,
    Readonly<{
      readonly type: 'invoke-finished-callback';
    }>,
  ];
  readonly particleRootZOrder: 1;
  readonly rotateAction: Readonly<{
    readonly deltaX: 1;
    readonly deltaY: 1;
    readonly durationSeconds: number;
    readonly overload: 'three-argument';
    readonly type: 'rotate-by';
  }>;
  readonly scaleAction: Readonly<{
    readonly durationSeconds: number;
    readonly scaleX: 0;
    readonly scaleY: 0;
    readonly type: 'scale-to';
  }>;
  readonly spriteChildZOrder: 0;
  readonly verticalMagnitude: number;
  readonly verticalSign: OptionsPurchaseParticleSign;
}

/**
 * Pure, process-local Options model.
 *
 * The Creator boundary copies successful mutation intents into the existing
 * Settings owner; this class never reads or writes persistence itself.
 */
export class OptionsState {
  private readonly backgroundPricesValue: number[];
  private readonly bladePricesValue: number[];
  private selectedBackgroundValue: number;
  private selectedBladeValue: number;
  private selectedThemeValue: number;
  private totalCoinsValue: number;

  constructor(input: OptionsStateInput) {
    const copied = copyAndValidateInput(input);
    this.backgroundPricesValue = copied.backgroundPrices;
    this.bladePricesValue = copied.bladePrices;
    this.selectedBackgroundValue = copied.selectedBackground;
    this.selectedBladeValue = copied.selectedBlade;
    this.selectedThemeValue = copied.selectedTheme;
    this.totalCoinsValue = copied.totalCoins;
  }

  static fromSnapshot(snapshot: OptionsStateInput): OptionsState {
    return new OptionsState(snapshot);
  }

  get snapshot(): OptionsStateSnapshot {
    return deepFreeze({
      backgroundPrices: [...this.backgroundPricesValue],
      bladePrices: [...this.bladePricesValue],
      selectedBackground: this.selectedBackgroundValue,
      selectedBlade: this.selectedBladeValue,
      selectedTheme: this.selectedThemeValue,
      totalCoins: this.totalCoinsValue,
    });
  }

  backgroundPriceAt(index: number): number {
    assertIndex(index, OPTIONS_BACKGROUND_COUNT, 'background index');
    return this.backgroundPricesValue[index];
  }

  bladePriceAt(index: number): number {
    assertIndex(index, OPTIONS_BLADE_COUNT, 'blade index');
    return this.bladePricesValue[index];
  }

  selectBackground(index: number): OptionsSelectionChange {
    assertIndex(index, OPTIONS_BACKGROUND_COUNT, 'selectedBackground');
    const previousIndex = this.selectedBackgroundValue;
    const price = this.backgroundPricesValue[index];
    this.selectedBackgroundValue = index;
    return freezeSelectionChange(
      'background',
      previousIndex,
      index,
      price,
    );
  }

  selectBlade(index: number): OptionsSelectionChange {
    assertIndex(index, OPTIONS_BLADE_COUNT, 'selectedBlade');
    const previousIndex = this.selectedBladeValue;
    const price = this.bladePricesValue[index];
    this.selectedBladeValue = index;
    return freezeSelectionChange('blade', previousIndex, index, price);
  }

  selectTheme(index: number): OptionsSelectionChange {
    assertIndex(index, OPTIONS_THEME_COUNT, 'selectedTheme');
    const previousIndex = this.selectedThemeValue;
    this.selectedThemeValue = index;
    return freezeSelectionChange('theme', previousIndex, index, null);
  }

  purchaseBackground(): OptionsPurchaseResult {
    return this.purchase(
      'background',
      this.selectedBackgroundValue,
      this.backgroundPricesValue,
    );
  }

  purchaseBlade(): OptionsPurchaseResult {
    return this.purchase('blade', this.selectedBladeValue, this.bladePricesValue);
  }

  prepareExitRollback(): OptionsExitRollbackResult {
    const previousSelections = selectionSet(
      this.selectedBackgroundValue,
      this.selectedBladeValue,
      this.selectedThemeValue,
    );
    const backgroundUnowned = this.backgroundPricesValue[this.selectedBackgroundValue] > 0;
    const bladeUnowned = this.bladePricesValue[this.selectedBladeValue] > 0;
    const selectionIntents: OptionsExitRollbackIntent[] = [];

    if (backgroundUnowned) {
      if (this.selectedBackgroundValue !== OPTIONS_DEFAULT_BACKGROUND_INDEX) {
        selectionIntents.push({
          category: 'background',
          nextIndex: OPTIONS_DEFAULT_BACKGROUND_INDEX,
          previousIndex: this.selectedBackgroundValue,
          reason: 'unowned-selection-exit-rollback',
        });
      }
      this.selectedBackgroundValue = OPTIONS_DEFAULT_BACKGROUND_INDEX;
    }
    if (bladeUnowned) {
      if (this.selectedBladeValue !== OPTIONS_DEFAULT_BLADE_INDEX) {
        selectionIntents.push({
          category: 'blade',
          nextIndex: OPTIONS_DEFAULT_BLADE_INDEX,
          previousIndex: this.selectedBladeValue,
          reason: 'unowned-selection-exit-rollback',
        });
      }
      this.selectedBladeValue = OPTIONS_DEFAULT_BLADE_INDEX;
    }

    const nextSelections = selectionSet(
      this.selectedBackgroundValue,
      this.selectedBladeValue,
      this.selectedThemeValue,
    );
    return deepFreeze({
      changed: {
        background: previousSelections.background !== nextSelections.background,
        blade: previousSelections.blade !== nextSelections.blade,
        theme: false as const,
      },
      nextSelections,
      previousSelections,
      selectionIntents,
      themeRetained: true as const,
    });
  }

  private purchase(
    category: OptionsPurchasableCategory,
    index: number,
    prices: number[],
  ): OptionsPurchaseResult {
    const previousPrice = prices[index];
    const previousTotalCoins = this.totalCoinsValue;
    const affordable = previousTotalCoins >= previousPrice;

    if (previousPrice === 0) {
      return purchaseResult({
        affordable,
        category,
        debitIntent: null,
        index,
        nextPrice: previousPrice,
        nextTotalCoins: previousTotalCoins,
        ownershipIntent: null,
        previousPrice,
        previousTotalCoins,
        purchased: false,
        status: 'already-owned',
      });
    }
    if (!affordable) {
      return purchaseResult({
        affordable,
        category,
        debitIntent: null,
        index,
        nextPrice: previousPrice,
        nextTotalCoins: previousTotalCoins,
        ownershipIntent: null,
        previousPrice,
        previousTotalCoins,
        purchased: false,
        status: 'insufficient-coins',
      });
    }

    const nextTotalCoins = previousTotalCoins - previousPrice;
    const debitIntent: OptionsDebitIntent = {
      amount: previousPrice,
      nextTotalCoins,
      previousTotalCoins,
      reason: category === 'background' ? 'purchase-background' : 'purchase-blade',
    };
    const ownershipIntent: OptionsOwnershipIntent = {
      category,
      index,
      nextPrice: 0,
      previousPrice,
    };
    this.totalCoinsValue = nextTotalCoins;
    prices[index] = 0;
    return purchaseResult({
      affordable,
      category,
      debitIntent,
      index,
      nextPrice: 0,
      nextTotalCoins,
      ownershipIntent,
      previousPrice,
      previousTotalCoins,
      purchased: true,
      status: 'purchased',
    });
  }
}

export function createOptionsPurchaseBurstPlan(
  viewport: OptionsPurchaseBurstViewport,
): OptionsPurchaseBurstPlan {
  if (viewport === null || typeof viewport !== 'object' || Array.isArray(viewport)) {
    throw new TypeError('purchase burst viewport must be an object');
  }
  const logicalWidth = positiveFiniteFloat32(
    viewport.logicalWidth,
    'viewport.logicalWidth',
  );
  const widthScale = divideFloat32(
    logicalWidth,
    OPTIONS_PURCHASE_EMITTER_REFERENCE_WIDTH,
  );
  const emitterX = Math.trunc(multiplyFloat32(
    widthScale,
    OPTIONS_PURCHASE_EMITTER_X_FACTOR,
  ));
  const emitterY = Math.trunc(multiplyFloat32(
    widthScale,
    OPTIONS_PURCHASE_EMITTER_Y_FACTOR,
  ));
  assertNonNegativeSafeInteger(emitterX, 'purchase burst emitter x');
  assertNonNegativeSafeInteger(emitterY, 'purchase burst emitter y');

  return deepFreeze({
    autoDeleteParticles: false as const,
    cleanupDelaySeconds: OPTIONS_PURCHASE_PARTICLE_CLEANUP_DELAY_SECONDS,
    colorFlags: [false, false] as const,
    emitterWorldPosition: particlePoint(emitterX, emitterY),
    fadeOutParticles: false as const,
    maximumTravelMagnitude: OPTIONS_PURCHASE_PARTICLE_MAXIMUM_TRAVEL_MAGNITUDE,
    minimumTravelMagnitude: OPTIONS_PURCHASE_PARTICLE_MINIMUM_TRAVEL_MAGNITUDE,
    particleCount: OPTIONS_PURCHASE_PARTICLE_COUNT,
    particleRootZOrder: OPTIONS_PURCHASE_PARTICLE_ROOT_Z_ORDER,
    removeAtSeconds: OPTIONS_PURCHASE_PARTICLE_REMOVE_AT_SECONDS,
    spriteChildZOrder: OPTIONS_PURCHASE_PARTICLE_SPRITE_Z_ORDER,
    startDelaySeconds: OPTIONS_PURCHASE_PARTICLE_START_DELAY_SECONDS,
    textureLogicalPath: OPTIONS_PURCHASE_PARTICLE_TEXTURE_PATH,
  });
}

/**
 * Executes the recovered synchronous five-draw construction after the 0.05s delay:
 * duration, X sign, X magnitude, Y sign, then Y magnitude.
 */
export function createOptionsPurchaseParticles(
  plan: OptionsPurchaseBurstPlan,
  random: OptionsPurchaseParticleRandom,
): readonly OptionsPurchaseParticlePlan[] {
  assertPurchaseBurstPlan(plan);
  assertPurchaseParticleRandom(random);

  const particles: OptionsPurchaseParticlePlan[] = [];
  for (let index = 0; index < plan.particleCount; index += 1) {
    const durationHundredths = drawParticleInclusive(
      random,
      OPTIONS_PURCHASE_PARTICLE_DURATION_MINIMUM_HUNDREDTHS,
      OPTIONS_PURCHASE_PARTICLE_DURATION_MAXIMUM_HUNDREDTHS,
    );
    const horizontalSign = normalizeParticleSign(
      drawParticleInclusive(random, -1, 1),
    );
    const horizontalMagnitude = drawParticleInclusive(
      random,
      plan.minimumTravelMagnitude,
      plan.maximumTravelMagnitude,
    );
    const verticalSign = normalizeParticleSign(
      drawParticleInclusive(random, -1, 1),
    );
    const verticalMagnitude = drawParticleInclusive(
      random,
      plan.minimumTravelMagnitude,
      plan.maximumTravelMagnitude,
    );
    const durationSeconds = divideFloat32(
      durationHundredths,
      HUNDREDTHS_PER_SECOND,
    );
    const deltaLocal = particlePoint(
      horizontalSign * horizontalMagnitude,
      verticalSign * verticalMagnitude,
    );

    particles.push(deepFreeze({
      actionsRunConcurrently: true as const,
      appliesColor: false as const,
      autoDelete: false as const,
      deltaLocal,
      durationHundredths,
      durationSeconds,
      fadeOut: false as const,
      horizontalMagnitude,
      horizontalSign,
      index,
      moveActionSequence: [
        {
          deltaLocal,
          durationSeconds,
          type: 'move-by' as const,
        },
        { type: 'invoke-finished-callback' as const },
      ] as const,
      particleRootZOrder: OPTIONS_PURCHASE_PARTICLE_ROOT_Z_ORDER,
      rotateAction: {
        deltaX: 1 as const,
        deltaY: 1 as const,
        durationSeconds,
        overload: 'three-argument' as const,
        type: 'rotate-by' as const,
      },
      scaleAction: {
        durationSeconds,
        scaleX: 0 as const,
        scaleY: 0 as const,
        type: 'scale-to' as const,
      },
      spriteChildZOrder: OPTIONS_PURCHASE_PARTICLE_SPRITE_Z_ORDER,
      verticalMagnitude,
      verticalSign,
    }));
  }
  return Object.freeze(particles);
}

function copyAndValidateInput(input: OptionsStateInput): {
  backgroundPrices: number[];
  bladePrices: number[];
  selectedBackground: number;
  selectedBlade: number;
  selectedTheme: number;
  totalCoins: number;
} {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Options state input must be an object');
  }
  assertPriceTable(input.backgroundPrices, OPTIONS_BACKGROUND_COUNT, 'backgroundPrices');
  assertPriceTable(input.bladePrices, OPTIONS_BLADE_COUNT, 'bladePrices');
  assertIndex(input.selectedBackground, OPTIONS_BACKGROUND_COUNT, 'selectedBackground');
  assertIndex(input.selectedBlade, OPTIONS_BLADE_COUNT, 'selectedBlade');
  assertIndex(input.selectedTheme, OPTIONS_THEME_COUNT, 'selectedTheme');
  assertSignedInt32(input.totalCoins, 'totalCoins');
  return {
    backgroundPrices: [...input.backgroundPrices],
    bladePrices: [...input.bladePrices],
    selectedBackground: input.selectedBackground,
    selectedBlade: input.selectedBlade,
    selectedTheme: input.selectedTheme,
    totalCoins: input.totalCoins,
  };
}

function assertPriceTable(
  prices: readonly number[],
  count: number,
  label: string,
): void {
  if (!Array.isArray(prices) || prices.length !== count) {
    throw new RangeError(`${label} must contain exactly ${count} prices`);
  }
  for (const price of prices) {
    assertSignedInt32(price, `${label} price`);
    if (price < 0) {
      throw new RangeError(`${label} prices must be non-negative`);
    }
  }
}

function assertIndex(index: number, count: number, label: string): void {
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError(`${label} must be an integer index from 0 through ${count - 1}`);
  }
}

function assertSignedInt32(value: number, label: string): void {
  if (
    !Number.isSafeInteger(value)
    || value < -0x8000_0000
    || value > 0x7fff_ffff
  ) {
    throw new RangeError(`${label} must be a signed 32-bit integer`);
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
}

function assertPurchaseBurstPlan(plan: OptionsPurchaseBurstPlan): void {
  if (plan === null || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new TypeError('purchase burst plan must be an object');
  }
  if (plan.textureLogicalPath !== OPTIONS_PURCHASE_PARTICLE_TEXTURE_PATH) {
    throw new RangeError('purchase burst plan must use the recovered xmasfive texture');
  }
  if (
    plan.startDelaySeconds !== OPTIONS_PURCHASE_PARTICLE_START_DELAY_SECONDS
    || plan.cleanupDelaySeconds !== OPTIONS_PURCHASE_PARTICLE_CLEANUP_DELAY_SECONDS
    || plan.removeAtSeconds !== OPTIONS_PURCHASE_PARTICLE_REMOVE_AT_SECONDS
  ) {
    throw new RangeError('purchase burst plan must preserve the recovered timeline');
  }
  if (
    plan.particleCount !== OPTIONS_PURCHASE_PARTICLE_COUNT
    || plan.particleRootZOrder !== OPTIONS_PURCHASE_PARTICLE_ROOT_Z_ORDER
    || plan.spriteChildZOrder !== OPTIONS_PURCHASE_PARTICLE_SPRITE_Z_ORDER
  ) {
    throw new RangeError('purchase burst plan must preserve particle counts and z-orders');
  }
  if (
    plan.minimumTravelMagnitude !== OPTIONS_PURCHASE_PARTICLE_MINIMUM_TRAVEL_MAGNITUDE
    || plan.maximumTravelMagnitude !== OPTIONS_PURCHASE_PARTICLE_MAXIMUM_TRAVEL_MAGNITUDE
  ) {
    throw new RangeError('purchase burst plan must preserve 35..70 travel bounds');
  }
  if (plan.autoDeleteParticles !== false || plan.fadeOutParticles !== false) {
    throw new RangeError('purchase particles must remain retained and must not fade');
  }
  if (
    !Array.isArray(plan.colorFlags)
    || plan.colorFlags.length !== 2
    || plan.colorFlags[0] !== false
    || plan.colorFlags[1] !== false
  ) {
    throw new RangeError('purchase burst plan must preserve both false color flags');
  }
  if (
    plan.emitterWorldPosition === null
    || typeof plan.emitterWorldPosition !== 'object'
    || Array.isArray(plan.emitterWorldPosition)
  ) {
    throw new TypeError('purchase burst emitterWorldPosition must be an object');
  }
  finiteFloat32(plan.emitterWorldPosition.x, 'purchase burst emitterWorldPosition.x');
  finiteFloat32(plan.emitterWorldPosition.y, 'purchase burst emitterWorldPosition.y');
}

function assertPurchaseParticleRandom(random: OptionsPurchaseParticleRandom): void {
  if (
    random === null
    || typeof random !== 'object'
    || typeof random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('random must provide nextIntInclusive(minimum, maximum)');
  }
}

function drawParticleInclusive(
  random: OptionsPurchaseParticleRandom,
  minimumInclusive: number,
  maximumInclusive: number,
): number {
  const value = random.nextIntInclusive(minimumInclusive, maximumInclusive);
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(
      `nextIntInclusive(${minimumInclusive}, ${maximumInclusive}) must return a safe integer`,
    );
  }
  if (value < minimumInclusive || value > maximumInclusive) {
    throw new RangeError(
      `nextIntInclusive(${minimumInclusive}, ${maximumInclusive}) returned ${value} outside the inclusive range`,
    );
  }
  return value;
}

function normalizeParticleSign(value: number): OptionsPurchaseParticleSign {
  if (value === -1) {
    return -1;
  }
  if (value === 1) {
    return 1;
  }
  return 0;
}

function particlePoint(x: number, y: number): OptionsParticlePoint {
  return Object.freeze({
    x: finiteFloat32(x, 'point.x'),
    y: finiteFloat32(y, 'point.y'),
  });
}

function positiveFiniteFloat32(value: number, label: string): number {
  const result = finiteFloat32(value, label);
  if (result <= 0) {
    throw new RangeError(`${label} must be positive in float32`);
  }
  return result;
}

function finiteFloat32(value: number, label: string): number {
  const result = Math.fround(value);
  if (!Number.isFinite(value) || !Number.isFinite(result)) {
    throw new RangeError(`${label} must be finite in float32`);
  }
  return result;
}

function multiplyFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) * Math.fround(right));
}

function divideFloat32(numerator: number, denominator: number): number {
  return Math.fround(Math.fround(numerator) / Math.fround(denominator));
}

function freezeSelectionChange(
  category: OptionsSelectionCategory,
  previousIndex: number,
  nextIndex: number,
  price: number | null,
): OptionsSelectionChange {
  return Object.freeze({
    category,
    changed: previousIndex !== nextIndex,
    nextIndex,
    owned: price === null || price === 0,
    previousIndex,
    price,
  });
}

function selectionSet(
  background: number,
  blade: number,
  theme: number,
): OptionsSelectionSet {
  return Object.freeze({ background, blade, theme });
}

function purchaseResult(input: OptionsPurchaseResult): OptionsPurchaseResult {
  return deepFreeze({ ...input });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      deepFreeze(record[key]);
    }
    Object.freeze(value);
  }
  return value;
}
