import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../'))
      && extname(specifier) === ''
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const {
  OPTIONS_BACKGROUND_COUNT,
  OPTIONS_BLADE_COUNT,
  OPTIONS_PURCHASE_PARTICLE_CLEANUP_DELAY_SECONDS,
  OPTIONS_PURCHASE_PARTICLE_COUNT,
  OPTIONS_PURCHASE_PARTICLE_DURATION_MAXIMUM_HUNDREDTHS,
  OPTIONS_PURCHASE_PARTICLE_DURATION_MINIMUM_HUNDREDTHS,
  OPTIONS_PURCHASE_PARTICLE_MAXIMUM_TRAVEL_MAGNITUDE,
  OPTIONS_PURCHASE_PARTICLE_MINIMUM_TRAVEL_MAGNITUDE,
  OPTIONS_PURCHASE_PARTICLE_REMOVE_AT_SECONDS,
  OPTIONS_PURCHASE_PARTICLE_START_DELAY_SECONDS,
  OPTIONS_PURCHASE_PARTICLE_TEXTURE_PATH,
  OPTIONS_THEME_COUNT,
  OptionsState,
  createOptionsPurchaseBurstPlan,
  createOptionsPurchaseParticles,
} = await import('../../../game/assets/scripts/domain/options-state.ts');

const BACKGROUND_PRICES = Object.freeze([
  0, 500, 1000, 1000, 2000, 2000, 2500, 4500,
]);
const BLADE_PRICES = Object.freeze([
  0, 100, 200, 300, 400, 500, 600, 700, 800,
  900, 1000, 1500, 2000, 2500, 2500, 2500, 2500, 5000,
]);

test('Options state copies and freezes the exact bounded 8/18/10 snapshot', () => {
  const mutableBackgroundPrices = [...BACKGROUND_PRICES];
  const mutableBladePrices = [...BLADE_PRICES];
  const state = OptionsState.fromSnapshot({
    backgroundPrices: mutableBackgroundPrices,
    bladePrices: mutableBladePrices,
    selectedBackground: 0,
    selectedBlade: 17,
    selectedTheme: 9,
    totalCoins: 5000,
  });
  mutableBackgroundPrices[1] = 0;
  mutableBladePrices[17] = 0;

  assert.equal(OPTIONS_BACKGROUND_COUNT, 8);
  assert.equal(OPTIONS_BLADE_COUNT, 18);
  assert.equal(OPTIONS_THEME_COUNT, 10);
  assert.deepEqual(state.snapshot, {
    backgroundPrices: BACKGROUND_PRICES,
    bladePrices: BLADE_PRICES,
    selectedBackground: 0,
    selectedBlade: 17,
    selectedTheme: 9,
    totalCoins: 5000,
  });
  assertDeepFrozen(state.snapshot);
  assert.equal(state.backgroundPriceAt(7), 4500);
  assert.equal(state.bladePriceAt(17), 5000);
});

test('selection changes mutate immediately, report owned price zero, and reject every overflow', () => {
  const state = createState();

  assert.deepEqual(state.selectBackground(0), {
    category: 'background',
    changed: false,
    nextIndex: 0,
    owned: true,
    previousIndex: 0,
    price: 0,
  });
  assert.deepEqual(state.selectBackground(7), {
    category: 'background',
    changed: true,
    nextIndex: 7,
    owned: false,
    previousIndex: 0,
    price: 4500,
  });
  assert.deepEqual(state.selectBlade(1), {
    category: 'blade',
    changed: true,
    nextIndex: 1,
    owned: false,
    previousIndex: 0,
    price: 100,
  });
  assert.deepEqual(state.selectTheme(9), {
    category: 'theme',
    changed: true,
    nextIndex: 9,
    owned: true,
    previousIndex: 2,
    price: null,
  });
  assert.deepEqual({
    selectedBackground: state.snapshot.selectedBackground,
    selectedBlade: state.snapshot.selectedBlade,
    selectedTheme: state.snapshot.selectedTheme,
  }, {
    selectedBackground: 7,
    selectedBlade: 1,
    selectedTheme: 9,
  });

  assert.throws(() => state.selectBackground(-1), /0 through 7/);
  assert.throws(() => state.selectBackground(8), /0 through 7/);
  assert.throws(() => state.selectBlade(18), /0 through 17/);
  assert.throws(() => state.selectTheme(10), /0 through 9/);
});

test('purchase accepts exact equality, emits debit/ownership intents, and zeroes price in memory', () => {
  const state = createState({ totalCoins: 500 });
  state.selectBackground(1);

  assert.deepEqual(state.purchaseBackground(), {
    affordable: true,
    category: 'background',
    debitIntent: {
      amount: 500,
      nextTotalCoins: 0,
      previousTotalCoins: 500,
      reason: 'purchase-background',
    },
    index: 1,
    nextPrice: 0,
    nextTotalCoins: 0,
    ownershipIntent: {
      category: 'background',
      index: 1,
      nextPrice: 0,
      previousPrice: 500,
    },
    previousPrice: 500,
    previousTotalCoins: 500,
    purchased: true,
    status: 'purchased',
  });
  assert.equal(state.snapshot.totalCoins, 0);
  assert.equal(state.snapshot.backgroundPrices[1], 0);
  assert.deepEqual(state.purchaseBackground(), {
    affordable: true,
    category: 'background',
    debitIntent: null,
    index: 1,
    nextPrice: 0,
    nextTotalCoins: 0,
    ownershipIntent: null,
    previousPrice: 0,
    previousTotalCoins: 0,
    purchased: false,
    status: 'already-owned',
  });
});

test('insufficient purchases are inert and blade purchases share the external mutation contract', () => {
  const insufficient = createState({ totalCoins: 99 });
  insufficient.selectBlade(1);
  assert.deepEqual(insufficient.purchaseBlade(), {
    affordable: false,
    category: 'blade',
    debitIntent: null,
    index: 1,
    nextPrice: 100,
    nextTotalCoins: 99,
    ownershipIntent: null,
    previousPrice: 100,
    previousTotalCoins: 99,
    purchased: false,
    status: 'insufficient-coins',
  });
  assert.equal(insufficient.snapshot.bladePrices[1], 100);
  assert.equal(insufficient.snapshot.totalCoins, 99);

  const affordable = createState({ totalCoins: 101 });
  affordable.selectBlade(1);
  const result = affordable.purchaseBlade();
  assert.equal(result.status, 'purchased');
  assert.equal(result.nextTotalCoins, 1);
  assert.deepEqual(result.debitIntent, {
    amount: 100,
    nextTotalCoins: 1,
    previousTotalCoins: 101,
    reason: 'purchase-blade',
  });
});

test('exit rolls only unowned background/blade to zero and always retains theme', () => {
  const state = createState({ totalCoins: 100 });
  state.selectBackground(2);
  state.selectBlade(1);
  state.selectTheme(8);

  assert.deepEqual(state.prepareExitRollback(), {
    changed: { background: true, blade: true, theme: false },
    nextSelections: { background: 0, blade: 0, theme: 8 },
    previousSelections: { background: 2, blade: 1, theme: 8 },
    selectionIntents: [
      {
        category: 'background',
        nextIndex: 0,
        previousIndex: 2,
        reason: 'unowned-selection-exit-rollback',
      },
      {
        category: 'blade',
        nextIndex: 0,
        previousIndex: 1,
        reason: 'unowned-selection-exit-rollback',
      },
    ],
    themeRetained: true,
  });
  assert.deepEqual(state.snapshot, {
    backgroundPrices: BACKGROUND_PRICES,
    bladePrices: BLADE_PRICES,
    selectedBackground: 0,
    selectedBlade: 0,
    selectedTheme: 8,
    totalCoins: 100,
  });
});

test('purchased selections survive exit while a remaining unowned selection rolls back', () => {
  const state = createState({ totalCoins: 600 });
  state.selectBackground(1);
  assert.equal(state.purchaseBackground().status, 'purchased');
  state.selectBlade(1);

  const rollback = state.prepareExitRollback();
  assert.deepEqual(rollback.changed, {
    background: false,
    blade: true,
    theme: false,
  });
  assert.deepEqual(rollback.nextSelections, {
    background: 1,
    blade: 0,
    theme: 2,
  });
  assert.deepEqual(rollback.selectionIntents, [{
    category: 'blade',
    nextIndex: 0,
    previousIndex: 1,
    reason: 'unowned-selection-exit-rollback',
  }]);
});

test('invalid snapshots reject malformed price tables, selections, and int32 coin totals', () => {
  const base = {
    backgroundPrices: BACKGROUND_PRICES,
    bladePrices: BLADE_PRICES,
    selectedBackground: 0,
    selectedBlade: 0,
    selectedTheme: 2,
    totalCoins: 999999,
  };
  assert.throws(
    () => new OptionsState({ ...base, backgroundPrices: BACKGROUND_PRICES.slice(1) }),
    /exactly 8/,
  );
  assert.throws(
    () => new OptionsState({ ...base, bladePrices: [...BLADE_PRICES.slice(0, 17), -1] }),
    /non-negative/,
  );
  assert.throws(() => new OptionsState({ ...base, selectedBackground: 8 }), /0 through 7/);
  assert.throws(() => new OptionsState({ ...base, selectedBlade: 18 }), /0 through 17/);
  assert.throws(() => new OptionsState({ ...base, selectedTheme: 10 }), /0 through 9/);
  assert.throws(() => new OptionsState({ ...base, totalCoins: 0x8000_0000 }), /signed 32-bit/);
});

test('purchase burst preserves fixed generic-particle settings and width-based emitter formulas', () => {
  const compact = createOptionsPurchaseBurstPlan({ logicalWidth: 480 });
  const high = createOptionsPurchaseBurstPlan({ logicalWidth: 720 });

  assert.equal(
    OPTIONS_PURCHASE_PARTICLE_TEXTURE_PATH,
    'Blades/Particles/X-Mas/xmasfive.png',
  );
  assert.equal(OPTIONS_PURCHASE_PARTICLE_COUNT, 45);
  assert.equal(OPTIONS_PURCHASE_PARTICLE_START_DELAY_SECONDS, Math.fround(0.05));
  assert.equal(OPTIONS_PURCHASE_PARTICLE_CLEANUP_DELAY_SECONDS, Math.fround(1.4));
  assert.equal(
    OPTIONS_PURCHASE_PARTICLE_REMOVE_AT_SECONDS,
    Math.fround(Math.fround(0.05) + Math.fround(1.4)),
  );
  assert.equal(OPTIONS_PURCHASE_PARTICLE_DURATION_MINIMUM_HUNDREDTHS, 35);
  assert.equal(OPTIONS_PURCHASE_PARTICLE_DURATION_MAXIMUM_HUNDREDTHS, 70);
  assert.equal(OPTIONS_PURCHASE_PARTICLE_MINIMUM_TRAVEL_MAGNITUDE, 35);
  assert.equal(OPTIONS_PURCHASE_PARTICLE_MAXIMUM_TRAVEL_MAGNITUDE, 70);
  assert.deepEqual(compact, {
    autoDeleteParticles: false,
    cleanupDelaySeconds: Math.fround(1.4),
    colorFlags: [false, false],
    emitterWorldPosition: { x: 50, y: 150 },
    fadeOutParticles: false,
    maximumTravelMagnitude: 70,
    minimumTravelMagnitude: 35,
    particleCount: 45,
    particleRootZOrder: 1,
    removeAtSeconds: Math.fround(Math.fround(0.05) + Math.fround(1.4)),
    spriteChildZOrder: 0,
    startDelaySeconds: Math.fround(0.05),
    textureLogicalPath: 'Blades/Particles/X-Mas/xmasfive.png',
  });
  assert.deepEqual(high.emitterWorldPosition, { x: 75, y: 225 });
  assertDeepFrozen(compact);
});

test('purchase burst consumes 225 ordered draws and emits immutable concurrent move/scale/rotate plans', () => {
  const draws: number[] = [];
  for (let index = 0; index < 45; index += 1) {
    draws.push(index === 0 ? 35 : 70, -1, 35, index === 0 ? 0 : 1, 70);
  }
  const random = new ScriptedRandom(draws);
  const plan = createOptionsPurchaseBurstPlan({ logicalWidth: 480 });
  const particles = createOptionsPurchaseParticles(plan, random);

  assert.equal(particles.length, 45);
  assert.equal(random.consumedDrawCount, 225);
  assert.deepEqual(random.calls.slice(0, 5), [
    [35, 70],
    [-1, 1],
    [35, 70],
    [-1, 1],
    [35, 70],
  ]);
  assert.deepEqual(particles[0], {
    actionsRunConcurrently: true,
    appliesColor: false,
    autoDelete: false,
    deltaLocal: { x: -35, y: 0 },
    durationHundredths: 35,
    durationSeconds: Math.fround(35 / 100),
    fadeOut: false,
    horizontalMagnitude: 35,
    horizontalSign: -1,
    index: 0,
    moveActionSequence: [
      {
        deltaLocal: { x: -35, y: 0 },
        durationSeconds: Math.fround(35 / 100),
        type: 'move-by',
      },
      { type: 'invoke-finished-callback' },
    ],
    particleRootZOrder: 1,
    rotateAction: {
      deltaX: 1,
      deltaY: 1,
      durationSeconds: Math.fround(35 / 100),
      overload: 'three-argument',
      type: 'rotate-by',
    },
    scaleAction: {
      durationSeconds: Math.fround(35 / 100),
      scaleX: 0,
      scaleY: 0,
      type: 'scale-to',
    },
    spriteChildZOrder: 0,
    verticalMagnitude: 70,
    verticalSign: 0,
  });
  assert.deepEqual(particles[1]?.deltaLocal, { x: -35, y: 70 });
  assert.equal(particles[1]?.durationSeconds, Math.fround(70 / 100));
  assertDeepFrozen(particles);
});

test('purchase burst rejects malformed viewport, random, plan, and out-of-contract draws', () => {
  assert.throws(() => createOptionsPurchaseBurstPlan(null as never), /viewport/);
  assert.throws(() => createOptionsPurchaseBurstPlan({ logicalWidth: 0 }), /positive/);
  assert.throws(() => createOptionsPurchaseBurstPlan({ logicalWidth: Number.MAX_VALUE }));

  const plan = createOptionsPurchaseBurstPlan({ logicalWidth: 480 });
  assert.throws(() => createOptionsPurchaseParticles(plan, null as never), /random/);
  assert.throws(
    () => createOptionsPurchaseParticles(
      { ...plan, maximumTravelMagnitude: 71 } as never,
      new ScriptedRandom([35]),
    ),
    /35..70/,
  );
  assert.throws(
    () => createOptionsPurchaseParticles(plan, new ScriptedRandom([34])),
    /outside the inclusive range/,
  );
  assert.throws(
    () => createOptionsPurchaseParticles(plan, new ScriptedRandom([35, 2])),
    /outside the inclusive range/,
  );
});

function createState(overrides: Partial<{
  selectedBackground: number;
  selectedBlade: number;
  selectedTheme: number;
  totalCoins: number;
}> = {}): InstanceType<typeof OptionsState> {
  return new OptionsState({
    backgroundPrices: BACKGROUND_PRICES,
    bladePrices: BLADE_PRICES,
    selectedBackground: overrides.selectedBackground ?? 0,
    selectedBlade: overrides.selectedBlade ?? 0,
    selectedTheme: overrides.selectedTheme ?? 2,
    totalCoins: overrides.totalCoins ?? 999999,
  });
}

function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return;
  }
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) {
    assertDeepFrozen(child, seen);
  }
}

class ScriptedRandom {
  readonly calls: [number, number][] = [];
  private cursor = 0;
  private readonly values: readonly number[];

  constructor(values: readonly number[]) {
    this.values = values;
  }

  get consumedDrawCount(): number {
    return this.cursor;
  }

  nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number {
    this.calls.push([minimumInclusive, maximumInclusive]);
    const value = this.values[this.cursor];
    this.cursor += 1;
    if (value === undefined) {
      throw new Error(`missing scripted draw ${this.cursor - 1}`);
    }
    return value;
  }
}
