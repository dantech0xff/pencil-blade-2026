import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

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
  OPTIONS_ATTACHMENT_ORDER,
  OPTIONS_BACKGROUND_REVEAL_AT_SECONDS,
  OPTIONS_BACK_ENTRY_SECONDS,
  OPTIONS_BLADE_REVEAL_AT_SECONDS,
  OPTIONS_COIN_ENTRY_SECONDS,
  OPTIONS_HEADER_MOVE_SECONDS,
  OPTIONS_OFFLINE_POLICY,
  OPTIONS_ROW_ORDER,
  OPTIONS_ROW_REVEAL_BOUNDARIES,
  OPTIONS_THEME_REVEAL_AT_SECONDS,
  OPTIONS_TITLE_MOVE_SECONDS,
  createOptionsPresentation,
} = await import('../../../game/assets/scripts/domain/options-presentation.ts');

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const BACKGROUND_PRICES = Object.freeze([
  0, 500, 1000, 1000, 2000, 2000, 2500, 4500,
]);
const BLADE_PRICES = Object.freeze([
  0, 100, 200, 300, 400, 500, 600, 700, 800,
  900, 1000, 1500, 2000, 2500, 2500, 2500, 2500, 5000,
]);

const COMPACT_VIEWPORT = Object.freeze({
  logicalHeight: 800,
  logicalWidth: 480,
  visibleRect: {
    bottom: { x: 240, y: 0 },
    center: { x: 240, y: 400 },
    left: { x: 0, y: 400 },
    right: { x: 480, y: 400 },
    top: { x: 240, y: 800 },
  },
});

const HIGH_VIEWPORT = Object.freeze({
  logicalHeight: 1280,
  logicalWidth: 720,
  visibleRect: {
    bottom: { x: 360, y: 0 },
    center: { x: 360, y: 640 },
    left: { x: 0, y: 640 },
    right: { x: 720, y: 640 },
    top: { x: 360, y: 1280 },
  },
});

const OFFSET_VIEWPORT = Object.freeze({
  logicalHeight: 900,
  logicalWidth: 600,
  visibleRect: {
    bottom: { x: 280, y: 10 },
    center: { x: 280, y: 460 },
    left: { x: -20, y: 460 },
    right: { x: 580, y: 460 },
    top: { x: 280, y: 910 },
  },
});

test('onEnter uses recovered title, coin, back geometry and excludes the randomized ad schedule', () => {
  const presentation = createOptionsPresentation(
    '480x800',
    COMPACT_VIEWPORT,
    -25,
    selectedState(),
  );

  assert.equal(OPTIONS_TITLE_MOVE_SECONDS, Math.fround(1.25));
  assert.equal(OPTIONS_COIN_ENTRY_SECONDS, Math.fround(0.75));
  assert.equal(OPTIONS_BACK_ENTRY_SECONDS, Math.fround(0.85));
  assert.deepEqual(presentation.title.anchor, {
    evidence: 'recovered-setter',
    x: Math.fround(0.5),
    y: 0,
  });
  assert.deepEqual(presentation.title.initialPosition, { x: 240, y: 800 });
  assert.deepEqual(presentation.title.finalPosition, { x: 240, y: 682 });
  assert.deepEqual(presentation.title.actions, [
    {
      delta: { x: 0, y: -118 },
      durationSeconds: Math.fround(1.25),
      type: 'move-by',
    },
    { callback: 'reveal-background-row', type: 'invoke-callback' },
  ]);

  const coinY = addF32(0, multiplyF32(800, Math.fround(0.835)));
  assert.deepEqual(presentation.coins.panel.initialPosition, { x: -167, y: coinY });
  assert.deepEqual(presentation.coins.panel.finalPosition, {
    x: multiplyF32(480, Math.fround(0.285)),
    y: coinY,
  });
  assert.deepEqual(presentation.coins.panel.actions, [
    {
      durationSeconds: Math.fround(0.75),
      target: presentation.coins.panel.finalPosition,
      type: 'move-to',
    },
    { durationSeconds: Math.fround(0.75), type: 'fade-in' },
  ]);
  assert.deepEqual(presentation.coins.label.initialPosition, { x: -167, y: coinY });
  assert.deepEqual(presentation.coins.label.finalPosition, {
    x: multiplyF32(480, Math.fround(0.185)),
    y: coinY,
  });
  assert.equal(presentation.coins.label.fontCanonicalPath, 'Fonts/SlabThing.ttf');
  assert.equal(presentation.coins.label.fontPointSize, 34);
  assert.equal(presentation.coins.label.text, '-25');

  assert.deepEqual(presentation.back.menuContainerPosition, { x: 0, y: 0 });
  assert.deepEqual(presentation.back.initialPosition, { x: 600, y: coinY });
  assert.deepEqual(presentation.back.finalPosition, { x: 408, y: coinY });
  assert.deepEqual(presentation.back.action, {
    durationSeconds: Math.fround(0.85),
    target: { x: 408, y: coinY },
    type: 'move-to',
  });
  assert.deepEqual(OPTIONS_OFFLINE_POLICY, {
    adBridgeExcluded: true,
    randomizedShowAdsScheduleExcluded: true,
    rowChainSource: 'title-moveby-callback',
  });
  assert.equal(
    JSON.stringify(presentation).includes('2.75'),
    false,
    'ShowAds randomized delay must not leak into the offline row chain',
  );
});

test('row chain reveals background, blade, theme at 1.25/1.50/1.75 with exact header and selector formulas', () => {
  const presentation = createOptionsPresentation(
    '480x800',
    COMPACT_VIEWPORT,
    999999,
    selectedState(),
  );
  const { background, blade, theme } = presentation.rows;

  assert.equal(OPTIONS_HEADER_MOVE_SECONDS, Math.fround(0.25));
  assert.equal(OPTIONS_BACKGROUND_REVEAL_AT_SECONDS, Math.fround(1.25));
  assert.equal(OPTIONS_BLADE_REVEAL_AT_SECONDS, Math.fround(1.5));
  assert.equal(OPTIONS_THEME_REVEAL_AT_SECONDS, Math.fround(1.75));
  assert.deepEqual(OPTIONS_ROW_REVEAL_BOUNDARIES, {
    background: Math.fround(1.25),
    blade: Math.fround(1.5),
    theme: Math.fround(1.75),
  });
  assert.deepEqual(OPTIONS_ROW_ORDER, ['background', 'blade', 'theme']);

  const backgroundY = multiplyF32(800, Math.fround(0.75));
  const bladeY = multiplyF32(800, Math.fround(0.475));
  const themeY = multiplyF32(800, Math.fround(0.2));
  assert.deepEqual(background.header.initialPosition, { x: 240, y: backgroundY });
  assert.deepEqual(background.header.finalPosition, { x: 240, y: backgroundY });
  assert.equal(background.header.continuation, 'reveal-blade-row');
  assert.equal(background.header.continuationAudioCanonicalPath, 'Sounds/mono1.wav');
  assert.deepEqual(blade.header.initialPosition, { x: 720, y: bladeY });
  assert.deepEqual(blade.header.finalPosition, { x: 240, y: bladeY });
  assert.equal(blade.header.continuation, 'reveal-theme-row');
  assert.equal(blade.header.continuationAudioCanonicalPath, 'Sounds/mono2.wav');
  assert.deepEqual(theme.header.initialPosition, { x: 240, y: themeY });
  assert.deepEqual(theme.header.finalPosition, { x: 240, y: themeY });
  assert.equal(theme.header.continuation, null);
  assert.equal(theme.header.continuationAudioCanonicalPath, null);
  for (const row of [background, blade, theme]) {
    assert.equal(row.header.action.durationSeconds, Math.fround(0.25));
    assert.deepEqual(row.header.action.target, row.header.finalPosition);
  }

  assert.equal(
    background.selector.position.y,
    selectorY(backgroundY, 74),
  );
  assert.equal(blade.selector.position.y, selectorY(bladeY, 74));
  assert.equal(theme.selector.position.y, selectorY(themeY, 74));
  for (const row of [background, blade, theme]) {
    assert.deepEqual(row.selector.initialPosition, row.selector.position);
    assert.deepEqual(row.selector.action, {
      durationSeconds: Math.fround(0.25),
      target: row.selector.position,
      type: 'move-to',
    });
  }
  assert.deepEqual(
    background.selector.controlLocalPositions,
    {
      evidence: 'recovered-select-items-on-enter',
      nextLocalPosition: { x: 139, y: 0 },
      previousLocalPosition: { x: -139, y: 0 },
    },
  );
  assert.equal(background.itemCount, 8);
  assert.equal(blade.itemCount, 18);
  assert.equal(theme.itemCount, 10);
  assert.equal(background.selector.selectedIndex, 2);
  assert.equal(blade.selector.selectedIndex, 17);
  assert.equal(theme.selector.selectedIndex, 9);
  assert.match(background.selector.iconResource.canonicalPath, /background-icon-2\.png$/);
  assert.match(blade.selector.iconResource.canonicalPath, /blade-icon-17\.png$/);
  assert.match(theme.selector.iconResource.canonicalPath, /theme-icon-9\.png$/);
});

test('buy controls use selector-background spacing and exact price label geometry', () => {
  const presentation = createOptionsPresentation(
    '480x800',
    COMPACT_VIEWPORT,
    999999,
    selectedState(),
  );
  const background = presentation.rows.background;
  const blade = presentation.rows.blade;
  const theme = presentation.rows.theme;
  assert.ok(background.purchase);
  assert.ok(blade.purchase);

  const backgroundSelectorY = selectorY(multiplyF32(800, Math.fround(0.75)), 74);
  const bladeSelectorY = selectorY(multiplyF32(800, Math.fround(0.475)), 74);
  assert.deepEqual(background.purchase.position, {
    x: 240,
    y: buyY(backgroundSelectorY, 139),
  });
  assert.deepEqual(blade.purchase.position, {
    x: 240,
    y: buyY(bladeSelectorY, 139),
  });
  assert.equal(background.purchase.price, 1000);
  assert.equal(background.purchase.menuState, 'purchasable');
  assert.equal(background.purchase.buyControlVisible, true);
  assert.deepEqual(background.purchase.priceLabel.localPosition, {
    x: multiplyF32(133, Math.fround(0.4)),
    y: multiplyF32(36, Math.fround(0.5)),
  });
  assert.equal(background.purchase.priceLabel.fontPointSize, 16);
  assert.equal(background.purchase.priceLabel.text, '1000');
  assert.equal(blade.purchase.priceLabel.text, '5000');
  assert.equal(theme.purchase, null);

  const owned = createOptionsPresentation(
    '480x800',
    COMPACT_VIEWPORT,
    0,
    selectedState({ selectedBackground: 0, selectedBlade: 0 }),
  );
  assert.equal(owned.rows.background.purchase?.price, 0);
  assert.equal(owned.rows.background.purchase?.menuState, 'owned');
  assert.equal(owned.rows.background.purchase?.buyControlVisible, false);
  assert.equal(owned.rows.blade.purchase?.menuState, 'owned');
});

test('high and offset viewports preserve raw W/H formulas and VisibleRect offsets exactly', () => {
  const high = createOptionsPresentation(
    '720x1280',
    HIGH_VIEWPORT,
    7,
    selectedState(),
  );
  assert.deepEqual(high.title.initialPosition, { x: 360, y: 1280 });
  assert.deepEqual(high.title.finalPosition, { x: 360, y: 1121 });
  assert.equal(high.coins.label.fontPointSize, 51);
  assert.equal(high.rows.background.purchase?.priceLabel.fontPointSize, 24);
  assert.deepEqual(high.rows.blade.header.initialPosition, {
    x: 1080,
    y: multiplyF32(1280, Math.fround(0.475)),
  });
  assert.equal(
    high.rows.background.selector.position.y,
    selectorY(multiplyF32(1280, Math.fround(0.75)), 80),
  );
  assert.equal(
    high.rows.background.purchase?.position.y,
    buyY(high.rows.background.selector.position.y, 208),
  );
  assert.deepEqual(high.rows.background.selector.controlLocalPositions, {
    evidence: 'recovered-select-items-on-enter',
    nextLocalPosition: { x: 208, y: 0 },
    previousLocalPosition: { x: -208, y: 0 },
  });

  const offset = createOptionsPresentation(
    '480x800',
    OFFSET_VIEWPORT,
    9,
    selectedState(),
  );
  const offsetCoinY = addF32(10, multiplyF32(900, Math.fround(0.835)));
  assert.deepEqual(offset.title.initialPosition, { x: 280, y: 910 });
  assert.deepEqual(offset.title.finalPosition, { x: 280, y: 792 });
  assert.deepEqual(offset.coins.panel.initialPosition, { x: -187, y: offsetCoinY });
  assert.deepEqual(offset.coins.panel.finalPosition, {
    x: addF32(-20, multiplyF32(600, Math.fround(0.285))),
    y: offsetCoinY,
  });
  assert.deepEqual(offset.coins.label.finalPosition, {
    x: addF32(-20, multiplyF32(600, Math.fround(0.185))),
    y: offsetCoinY,
  });
  assert.deepEqual(offset.back.initialPosition, {
    x: multiplyF32(280, Math.fround(2.5)),
    y: multiplyF32(900, Math.fround(0.835)),
  });
  assert.deepEqual(offset.back.finalPosition, {
    x: multiplyF32(600, Math.fround(0.85)),
    y: multiplyF32(900, Math.fround(0.835)),
  });
  assert.equal(
    offset.rows.background.header.finalPosition.y,
    multiplyF32(900, Math.fround(0.75)),
  );
  assert.notEqual(offset.rows.background.header.finalPosition.y, addF32(
    10,
    multiplyF32(900, Math.fround(0.75)),
  ));
});

test('same-z attachment plan makes onEnter prefix and recovered chained insertion explicit', () => {
  assert.deepEqual(
    OPTIONS_ATTACHMENT_ORDER.map(({ child, insertion, phase, revealAtSeconds, zOrder }) => ({
      child,
      insertion,
      phase,
      revealAtSeconds,
      zOrder,
    })),
    [
      { child: 'title', insertion: 1, phase: 'on-enter', revealAtSeconds: 0, zOrder: 1 },
      { child: 'total-coins-panel', insertion: 2, phase: 'on-enter', revealAtSeconds: 0, zOrder: 1 },
      { child: 'total-coins-label', insertion: 3, phase: 'on-enter', revealAtSeconds: 0, zOrder: 1 },
      { child: 'back-menu', insertion: 4, phase: 'on-enter', revealAtSeconds: 0, zOrder: 1 },
      { child: 'gestures-layer', insertion: 5, phase: 'on-enter', revealAtSeconds: 0, zOrder: 1 },
      { child: 'background-header', insertion: 6, phase: 'background-callback', revealAtSeconds: Math.fround(1.25), zOrder: 1 },
      { child: 'background-selector', insertion: 7, phase: 'background-callback', revealAtSeconds: Math.fround(1.25), zOrder: 1 },
      { child: 'background-buy-menu', insertion: 8, phase: 'background-callback', revealAtSeconds: Math.fround(1.25), zOrder: 1 },
      { child: 'blade-header', insertion: 9, phase: 'blade-callback', revealAtSeconds: Math.fround(1.5), zOrder: 1 },
      { child: 'blade-selector', insertion: 10, phase: 'blade-callback', revealAtSeconds: Math.fround(1.5), zOrder: 1 },
      { child: 'blade-buy-menu', insertion: 11, phase: 'blade-callback', revealAtSeconds: Math.fround(1.5), zOrder: 1 },
      { child: 'theme-header', insertion: 12, phase: 'theme-callback', revealAtSeconds: Math.fround(1.75), zOrder: 1 },
      { child: 'theme-selector', insertion: 13, phase: 'theme-callback', revealAtSeconds: Math.fround(1.75), zOrder: 1 },
    ],
  );
  assertDeepFrozen(OPTIONS_ATTACHMENT_ORDER);
});

test('presentation keeps exact effect-gated audio and purchase particle resources', () => {
  const presentation = createOptionsPresentation(
    '720x1280',
    HIGH_VIEWPORT,
    0,
    selectedState(),
  );
  assert.deepEqual(presentation.audio, {
    back: {
      canonicalPath: 'Sounds/menubuttonclick.wav',
      effectsGated: true,
      loop: false,
    },
    selection: {
      canonicalPath: 'Sounds/menubuttonclick.wav',
      effectsGated: true,
      loop: false,
    },
    rowReveal: {
      background: null,
      blade: {
        canonicalPath: 'Sounds/mono1.wav',
        effectsGated: true,
        loop: false,
      },
      theme: {
        canonicalPath: 'Sounds/mono2.wav',
        effectsGated: true,
        loop: false,
      },
    },
  });
  assert.equal(
    presentation.purchaseParticleResource.canonicalPath,
    '720x1280/Blades/Particles/X-Mas/xmasfive.png',
  );
  assertDeepFrozen(presentation);
});

test('invalid assets, viewport fields, totals, prices, and selector bounds reject before output', () => {
  const state = selectedState();
  assert.throws(
    () => createOptionsPresentation('phone' as never, COMPACT_VIEWPORT, 0, state),
    RangeError,
  );
  assert.throws(
    () => createOptionsPresentation(
      '480x800',
      { ...COMPACT_VIEWPORT, logicalWidth: 0 },
      0,
      state,
    ),
    /positive/,
  );
  assert.throws(
    () => createOptionsPresentation(
      '480x800',
      {
        ...COMPACT_VIEWPORT,
        visibleRect: {
          ...COMPACT_VIEWPORT.visibleRect,
          center: { x: Number.NaN, y: 400 },
        },
      },
      0,
      state,
    ),
    /finite/,
  );
  assert.throws(
    () => createOptionsPresentation('480x800', COMPACT_VIEWPORT, 0.5, state),
    /signed 32-bit/,
  );
  assert.throws(
    () => createOptionsPresentation(
      '480x800',
      COMPACT_VIEWPORT,
      0,
      { ...state, backgroundPrices: BACKGROUND_PRICES.slice(1) },
    ),
    /exactly 8/,
  );
  assert.throws(
    () => createOptionsPresentation(
      '480x800',
      COMPACT_VIEWPORT,
      0,
      { ...state, selectedBlade: 18 },
    ),
    /0 through 17/,
  );
});

test('Options TypeScript metadata has valid unique Creator UUIDs', () => {
  const paths = [
    'game/assets/scripts/domain/options-state.ts.meta',
    'game/assets/scripts/domain/options-resource-contract.ts.meta',
    'game/assets/scripts/domain/options-presentation.ts.meta',
  ];
  const metadata = paths.map((path) => readJson<{
    readonly files: readonly unknown[];
    readonly imported: boolean;
    readonly importer: string;
    readonly subMetas: Readonly<Record<string, unknown>>;
    readonly userData: Readonly<Record<string, unknown>>;
    readonly uuid: string;
    readonly ver: string;
  }>(path));
  assert.equal(new Set(metadata.map(({ uuid }) => uuid)).size, 3);
  for (const meta of metadata) {
    assert.match(
      meta.uuid,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    assert.deepEqual({
      files: meta.files,
      imported: meta.imported,
      importer: meta.importer,
      subMetas: meta.subMetas,
      userData: meta.userData,
      ver: meta.ver,
    }, {
      files: [],
      imported: true,
      importer: 'typescript',
      subMetas: {},
      userData: {},
      ver: '4.0.24',
    });
  }
});

test('presentation domain remains Creator-free', () => {
  const source = readText('game/assets/scripts/domain/options-presentation.ts');
  assert.doesNotMatch(source, /from\s+['"]cc['"]/);
  assert.doesNotMatch(source, /showInterstitial|RandomHelper/);
  assert.doesNotMatch(source, /Math\.fround\(2\.75\)|nextFloat|nextDecile/);
});

function selectedState(overrides: Partial<{
  selectedBackground: number;
  selectedBlade: number;
  selectedTheme: number;
}> = {}) {
  return {
    backgroundPrices: BACKGROUND_PRICES,
    bladePrices: BLADE_PRICES,
    selectedBackground: overrides.selectedBackground ?? 2,
    selectedBlade: overrides.selectedBlade ?? 17,
    selectedTheme: overrides.selectedTheme ?? 9,
  };
}

function selectorY(headerY: number, headerHeight: number): number {
  return subtractF32(
    headerY,
    multiplyF32(
      multiplyF32(headerHeight, Math.fround(1.1)),
      Math.fround(0.5),
    ),
  );
}

function buyY(selectorPositionY: number, selectorBackgroundHeight: number): number {
  return subtractF32(
    selectorPositionY,
    multiplyF32(
      multiplyF32(selectorBackgroundHeight, Math.fround(1.1)),
      Math.fround(0.5),
    ),
  );
}

function addF32(left: number, right: number): number {
  return Math.fround(Math.fround(left) + Math.fround(right));
}

function subtractF32(left: number, right: number): number {
  return Math.fround(Math.fround(left) - Math.fround(right));
}

function multiplyF32(left: number, right: number): number {
  return Math.fround(Math.fround(left) * Math.fround(right));
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

function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

function readText(relativePath: string): string {
  return readFileSync(`${REPOSITORY_ROOT}${relativePath}`, 'utf8');
}
