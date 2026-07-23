import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

import type {
  MainMenuHeartRandom,
  MainMenuViewport,
} from '../../../game/assets/scripts/domain/main-menu-presentation.ts';

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
  MAIN_MENU_FRUIT_BUTTON_CHILD_ORDER,
  MAIN_MENU_FRUIT_CIRCLE_CUT_SECONDS,
  MAIN_MENU_FRUIT_CIRCLE_ROTATION_DEGREES,
  MAIN_MENU_FRUIT_CIRCLE_ROTATION_SECONDS,
  MAIN_MENU_FRUIT_CUT_CALLBACK_ORDER,
  MAIN_MENU_BLADE_DEPENDENCY_ORDER,
  MAIN_MENU_GAME_SCENE_ROOT_ORDER,
  MAIN_MENU_IMPORTED_CLEAN_COMPOSITE_ORDER,
  MAIN_MENU_IMPORTED_CLEAN_SETTINGS_DEFAULTS,
  MAIN_MENU_INFERRED_CENTER_ANCHOR,
  MAIN_MENU_MENU_ITEM_ORDER,
  MAIN_MENU_OWNED_ROOT_CHILD_ORDER,
  MAIN_MENU_REVIEW_PULSE_PLAN,
  MAIN_MENU_TOTAL_COINS_LABEL_ANCHOR,
  MAIN_MENU_TOGGLE_SUBITEM_ORDER,
  MAIN_MENU_VISIBLE_ROOT_Z1_ORDER,
  createMainMenuFruitButtonPresentations,
  createMainMenuFruitCutPresentationPlan,
  createMainMenuHeartEmissionPlan,
  createMainMenuPresentation,
  createMainMenuReviewHeartEmissionTimes,
  formatMainMenuTotalCoins,
} = await import('../../../game/assets/scripts/domain/main-menu-presentation.ts');

const LOW_VIEWPORT: MainMenuViewport = Object.freeze({
  logicalHeight: 800,
  logicalWidth: 480,
  visibleRect: Object.freeze({
    bottom: Object.freeze({ x: 240, y: 0 }),
    center: Object.freeze({ x: 240, y: 400 }),
    left: Object.freeze({ x: 0, y: 400 }),
    right: Object.freeze({ x: 480, y: 400 }),
    top: Object.freeze({ x: 240, y: 800 }),
  }),
});

const HIGH_VIEWPORT: MainMenuViewport = Object.freeze({
  logicalHeight: 1280,
  logicalWidth: 720,
  visibleRect: Object.freeze({
    bottom: Object.freeze({ x: 360, y: 0 }),
    center: Object.freeze({ x: 360, y: 640 }),
    left: Object.freeze({ x: 0, y: 640 }),
    right: Object.freeze({ x: 720, y: 640 }),
    top: Object.freeze({ x: 360, y: 1280 }),
  }),
});

const OFFSET_VIEWPORT: MainMenuViewport = Object.freeze({
  logicalHeight: 900,
  logicalWidth: 600,
  visibleRect: Object.freeze({
    bottom: Object.freeze({ x: 280, y: 40 }),
    center: Object.freeze({ x: 280, y: 490 }),
    left: Object.freeze({ x: -20, y: 490 }),
    right: Object.freeze({ x: 580, y: 490 }),
    top: Object.freeze({ x: 280, y: 940 }),
  }),
});

test('imports exact shared defaults/root tags and preserves every owned append order', () => {
  assert.deepEqual(MAIN_MENU_IMPORTED_CLEAN_SETTINGS_DEFAULTS, {
    selectedBackground: 0,
    selectedTheme: 2,
  });
  assert.deepEqual(MAIN_MENU_IMPORTED_CLEAN_COMPOSITE_ORDER, [
    'paperbackground0',
    'seven-independent-leaves',
    'theme2',
    'main-menu-foreground',
  ]);
  assert.deepEqual(MAIN_MENU_GAME_SCENE_ROOT_ORDER, [
    { child: 'BackgroundLayer', insertion: 1, tag: 0, zOrder: 1 },
    { child: 'LeafLayer', insertion: 2, tag: 1, zOrder: 1 },
    { child: 'ThemeLayer', insertion: 3, tag: 2, zOrder: 1 },
    { child: 'MainMenuLayer', insertion: 4, tag: 3, zOrder: 1 },
  ]);
  assert.deepEqual(MAIN_MENU_VISIBLE_ROOT_Z1_ORDER, [
    'pencilbladebk',
    'pencilblade',
    'total-coins-panel',
    'total-coins-label',
    'menu',
    'orange-wheel',
    'black-wheel',
    'leaderboard-fruit-button',
    'objectives-fruit-button',
    'new-game-fruit-button',
  ]);
  assert.deepEqual(MAIN_MENU_OWNED_ROOT_CHILD_ORDER.at(-1), {
    child: 'gestures-layer',
    insertion: 11,
    visible: false,
    zOrder: 0,
  });
  assert.equal(
    MAIN_MENU_OWNED_ROOT_CHILD_ORDER.slice(0, 10).every(({ zOrder }) => zOrder === 1),
    true,
  );
  assert.deepEqual(MAIN_MENU_MENU_ITEM_ORDER, [
    'about',
    'review',
    'music-toggle',
    'effects-toggle',
    'blue-wheel-options',
    'exit',
  ]);
  assert.deepEqual(MAIN_MENU_FRUIT_BUTTON_CHILD_ORDER, [
    'blur',
    'circle-art',
    'intact-fruit',
  ]);
  assert.deepEqual(MAIN_MENU_FRUIT_CUT_CALLBACK_ORDER, [
    'fruit-cut-and-audio',
    'main-menu-navigation-callback',
    'fruit-button-wrapper-callback',
    'remaining-fruit-notifications',
  ]);
  assert.deepEqual(MAIN_MENU_BLADE_DEPENDENCY_ORDER, {
    selectedBladeChildCount: 4,
    selectedBladeChildrenPrecedeOwnedRoots: true,
  });
  assert.deepEqual(MAIN_MENU_TOGGLE_SUBITEM_ORDER, [
    {
      initialSelectedIndex: 0,
      normalFrameRole: 'normal',
      selectedFrameRole: 'selected',
      subitemIndex: 0,
    },
    {
      initialSelectedIndex: 0,
      normalFrameRole: 'disabled',
      selectedFrameRole: 'selected',
      subitemIndex: 1,
    },
  ]);
  assertDeepFrozen(MAIN_MENU_OWNED_ROOT_CHILD_ORDER);
});

test('compact profile snapshots every shell/control/wheel formula and action in recovered order', () => {
  const layout = createMainMenuPresentation('480x800', LOW_VIEWPORT, 1234);

  assert.deepEqual(layout.shell.pencilBladeBackground.initialPosition, { x: 240, y: 946 });
  assert.deepEqual(layout.shell.pencilBladeBackground.finalPosition, { x: 240, y: 654 });
  assert.deepEqual(layout.shell.pencilBladeBackground.actions, [
    { durationSeconds: 0.5, target: { x: 240, y: 654 }, type: 'move-to' },
    { durationSeconds: 0.5, type: 'fade-in' },
    { durationSeconds: 0.75, type: 'fade-in' },
  ]);
  assert.deepEqual(layout.shell.pencilBlade.initialPosition, { x: -227, y: 654.375 });
  assert.deepEqual(layout.shell.pencilBlade.finalPosition, { x: 240, y: 654.375 });
  assert.deepEqual(layout.shell.pencilBlade.actions, [{
    actions: [
      { durationSeconds: 0.25, type: 'delay' },
      { durationSeconds: 0.5, target: { x: 240, y: 654.375 }, type: 'move-to' },
    ],
    type: 'sequence',
  }]);
  assert.equal(layout.shell.pencilBlade.directForegroundFadeActionPresent, false);
  assert.equal(layout.shell.pencilBlade.titleHeightMultiplierIsVisualScale, false);

  assert.deepEqual(layout.shell.totalCoinsPanel.initialPosition, { x: -167, y: 40 });
  assert.deepEqual(layout.shell.totalCoinsPanel.finalPosition, { x: 144, y: 40 });
  assert.deepEqual(layout.shell.totalCoinsLabel.initialPosition, { x: -167, y: 40 });
  assert.deepEqual(layout.shell.totalCoinsLabel.finalPosition, {
    x: Math.fround(float32FromBits(0x3e3d70a4) * 480),
    y: 40,
  });
  assert.deepEqual(layout.shell.totalCoinsLabel.anchor, {
    evidence: 'recovered-setter',
    x: 0,
    y: 0.5,
  });
  assert.equal(layout.shell.totalCoinsLabel.fontCanonicalPath, 'Fonts/SlabThing.ttf');
  assert.equal(layout.shell.totalCoinsLabel.fontPointSize, 34);
  assert.equal(layout.shell.totalCoinsLabel.format, '%d');
  assert.equal(layout.shell.totalCoinsLabel.text, '1234');
  assert.equal(layout.shell.totalCoinsLabel.settingsReadCountBeforeConstruction, 2);
  assert.equal(layout.shell.totalCoinsLabel.secondReadResultUsed, false);
  assert.equal(layout.shell.totalCoinsLabel.inferredDefaultColor, 'white');

  assert.deepEqual(layout.controls.menuOrigin, { x: 0, y: 0 });
  assert.deepEqual(layout.controls.musicToggle.initialPosition, { x: -45.5, y: 140 });
  assert.deepEqual(layout.controls.musicToggle.finalPosition, { x: 60, y: 140 });
  assertActionPair(layout.controls.musicToggle.actions, 1.5, 1.25, 60, 140);
  assert.deepEqual(layout.controls.effectsToggle.initialPosition, { x: -40, y: 140 });
  assert.deepEqual(layout.controls.effectsToggle.finalPosition, {
    x: Math.fround(float32FromBits(0x3eb33333) * 480),
    y: 140,
  });
  assertActionPair(
    layout.controls.effectsToggle.actions,
    1,
    1.5,
    layout.controls.effectsToggle.finalPosition.x,
    140,
  );
  assert.deepEqual(layout.controls.about.initialPosition, { x: -43.5, y: 240.00001525878906 });
  assert.deepEqual(layout.controls.about.finalPosition, { x: 60, y: 240.00001525878906 });
  assertActionPair(layout.controls.about.actions, 1, 1, 60, 240.00001525878906);

  assert.deepEqual(layout.controls.blueWheelOptions.initialPosition, { x: 288, y: -160 });
  assert.deepEqual(layout.controls.blueWheelOptions.finalPosition, { x: 288, y: 140 });
  assertRotatingEntry(layout.controls.blueWheelOptions.actions, 1.25, 1.25, 12.5, 360);
  assert.deepEqual(layout.wheels.orange.initialPosition, { x: 323, y: -195 });
  assert.deepEqual(layout.wheels.orange.finalPosition, { x: 323, y: 105 });
  assertRotatingEntry(layout.wheels.orange.actions, 1.25, 1.25, 12.5, -360);
  assert.deepEqual(layout.wheels.black.initialPosition, { x: 282, y: -154 });
  assert.deepEqual(layout.wheels.black.finalPosition, { x: 282, y: 146 });
  assertRotatingEntry(layout.wheels.black.actions, 1.25, 1.25, 10.5, 360);
  assert.equal(layout.wheels.orange.finalPosition.y - layout.wheels.orange.initialPosition.y, 300);
  assert.equal(layout.wheels.black.finalPosition.y - layout.wheels.black.initialPosition.y, 300);
  assert.equal(
    layout.controls.blueWheelOptions.finalPosition.y
      - layout.controls.blueWheelOptions.initialPosition.y,
    300,
  );

  assert.deepEqual(layout.controls.exit.initialPosition, { x: 550.5, y: 140 });
  assert.deepEqual(layout.controls.exit.finalPosition, { x: 409.5, y: 140 });
  assertActionPair(layout.controls.exit.actions, 1, 1, 409.5, 140);
  assert.deepEqual(layout.controls.review.initialPosition, { x: 360, y: -66 });
  assert.deepEqual(layout.controls.review.finalPosition, {
    x: 360,
    y: Math.fround(float32FromBits(0x3d3851ec) * 800),
  });
  assert.deepEqual(layout.controls.review.actions[2], {
    plan: MAIN_MENU_REVIEW_PULSE_PLAN,
    type: 'review-pulse',
  });
  assert.equal(layout.controls.review.actionsRunConcurrently, true);
  assert.equal(layout.controls.musicToggle.resource.normal.dimensions.width, 91);
  assert.equal(layout.controls.musicToggle.initialPosition.x, -45.5);
  assertDeepFrozen(layout);
});

test('high profile and a noncanonical visible rect preserve logical W/H versus visible-origin formulas', () => {
  const high = createMainMenuPresentation('720x1280', HIGH_VIEWPORT, -25);
  assert.deepEqual(high.shell.pencilBladeBackground.initialPosition, { x: 360, y: 1499 });
  assert.deepEqual(high.shell.pencilBladeBackground.finalPosition, { x: 360, y: 1061 });
  assert.deepEqual(high.shell.pencilBlade.initialPosition, { x: -333.5, y: 1066.25 });
  assert.deepEqual(high.shell.pencilBlade.finalPosition, { x: 360, y: 1066.25 });
  assert.deepEqual(high.shell.totalCoinsPanel.initialPosition, { x: -232, y: 64 });
  assert.deepEqual(high.shell.totalCoinsPanel.finalPosition, { x: 216.00001525878906, y: 64 });
  assert.equal(high.shell.totalCoinsLabel.fontPointSize, 51);
  assert.equal(high.shell.totalCoinsLabel.text, '-25');
  assert.deepEqual(high.controls.musicToggle.initialPosition, { x: -68, y: 224 });
  assert.deepEqual(high.controls.review.initialPosition, { x: 540, y: -82 });
  assert.deepEqual(high.controls.exit.finalPosition, { x: 629, y: 224 });

  const offset = createMainMenuPresentation('480x800', OFFSET_VIEWPORT, 9);
  assert.deepEqual(offset.shell.pencilBladeBackground.initialPosition, { x: 280, y: 1086 });
  assert.deepEqual(offset.shell.pencilBladeBackground.finalPosition, { x: 280, y: 794 });
  assert.deepEqual(offset.shell.totalCoinsPanel.initialPosition, { x: -187, y: 85 });
  assert.deepEqual(offset.shell.totalCoinsPanel.finalPosition, { x: 160, y: 85 });
  assert.equal(offset.shell.totalCoinsLabel.initialPosition.x, -187);
  assert.equal(
    offset.shell.totalCoinsLabel.finalPosition.x,
    Math.fround(-20 + Math.fround(float32FromBits(0x3e3d70a4) * 600)),
  );
  assert.equal(offset.controls.musicToggle.initialPosition.x, -65.5);
  assert.equal(offset.controls.musicToggle.finalPosition.x, 75);
  assert.equal(offset.controls.review.finalPosition.x, 450);
  assert.equal(offset.controls.review.initialPosition.y, -66);
  assert.equal(offset.fruitButtons[0].wrapperPosition.x, 150);
  assert.equal(offset.fruitButtons[0].wrapperPosition.y, Math.fround(900 * float32FromBits(0x3f0ccccd)));
  assert.notEqual(offset.fruitButtons[0].wrapperPosition.x, OFFSET_VIEWPORT.visibleRect.left.x + 150);
});

test('review pulse emits twice per float32 cycle while entrance remains independent', () => {
  assert.deepEqual(MAIN_MENU_REVIEW_PULSE_PLAN, {
    cycleDurationSeconds: Math.fround(0.9),
    firstEmissionAtSeconds: Math.fround(0.45),
    initialScale: 1,
    initialScaleEvidence: 'inferred-legacy-default',
    repeatForever: true,
    secondEmissionAtSeconds: Math.fround(0.9),
    sequence: [
      {
        durationSeconds: Math.fround(0.45),
        scaleX: Math.fround(1.15),
        scaleY: Math.fround(1.15),
        type: 'scale-to',
      },
      { callback: 'add-heart', type: 'invoke-callback' },
      { durationSeconds: Math.fround(0.45), scaleX: 1, scaleY: 1, type: 'scale-to' },
      { callback: 'add-heart', type: 'invoke-callback' },
    ],
  });
  assert.deepEqual(createMainMenuReviewHeartEmissionTimes(2), [
    Math.fround(0.45),
    Math.fround(0.9),
    Math.fround(Math.fround(0.9) + Math.fround(0.45)),
    Math.fround(Math.fround(0.9) + Math.fround(0.9)),
  ]);
  assert.deepEqual(createMainMenuReviewHeartEmissionTimes(0), []);
  assert.throws(() => createMainMenuReviewHeartEmissionTimes(-1), /non-negative/);
  assert.throws(() => createMainMenuReviewHeartEmissionTimes(1.5), /safe integer/);
  assertDeepFrozen(MAIN_MENU_REVIEW_PULSE_PLAN);
});

test('one heart consumes exact five-draw protocol and plans concurrent retained actions', () => {
  const log: unknown[] = [];
  const integers = [347, 60, 200];
  const deciles = [0.4, 0.9];
  const random: MainMenuHeartRandom = {
    nextDecile(): number {
      log.push(['decile']);
      const value = deciles.shift();
      assert.notEqual(value, undefined);
      return value as number;
    },
    nextIntInclusive(minimum: number, maximum: number): number {
      log.push(['int', minimum, maximum]);
      const value = integers.shift();
      assert.notEqual(value, undefined);
      return value as number;
    },
  };

  const heart = createMainMenuHeartEmissionPlan('480x800', LOW_VIEWPORT, random);
  assert.deepEqual(log, [
    ['int', 347, 384],
    ['int', 20, 60],
    ['decile'],
    ['decile'],
    ['int', 80, 200],
  ]);
  assert.deepEqual(heart.position, { x: 347, y: 60 });
  assert.equal(heart.scale, Math.fround(Math.fround(0.4 * 0.5) + 0.5));
  assert.equal(heart.durationSeconds, Math.fround(Math.fround(0.9) + 1));
  assert.deepEqual(heart.actions, [
    { durationSeconds: heart.durationSeconds, type: 'fade-out' },
    {
      delta: { x: 0, y: 200 },
      durationSeconds: heart.durationSeconds,
      type: 'move-by',
    },
  ]);
  assert.deepEqual(heart.randomDraws.map(({ name, value }) => ({ name, value })), [
    { name: 'x', value: 347 },
    { name: 'y', value: 60 },
    { name: 'qScale', value: 0.4 },
    { name: 'qDuration', value: 0.9 },
    { name: 'rise', value: 200 },
  ]);
  assert.equal(heart.resourceCanonicalPath, '480x800/Interfaces/heart.png');
  assert.deepEqual(heart.anchor, MAIN_MENU_INFERRED_CENTER_ANCHOR);
  assert.equal(heart.actionsRunConcurrently, true);
  assert.equal(heart.actionsStartBeforeRootAttachment, true);
  assert.equal(heart.perHeartCleanupAction, false);
  assert.equal(heart.finalState, 'invisible-retained-child');
  assert.equal(heart.seedParityClaimed, false);
  assert.equal(heart.zOrder, 1);
  assertDeepFrozen(heart);
});

test('heart planner validates all inputs before RNG and rejects invalid returned draws', () => {
  let calls = 0;
  const countingRandom: MainMenuHeartRandom = {
    nextDecile(): number {
      calls += 1;
      return 0;
    },
    nextIntInclusive(minimum: number): number {
      calls += 1;
      return minimum;
    },
  };
  assert.throws(
    () => createMainMenuHeartEmissionPlan(
      '480x800',
      { ...LOW_VIEWPORT, logicalWidth: Number.NaN },
      countingRandom,
    ),
    /logicalWidth/,
  );
  assert.equal(calls, 0);
  assert.throws(
    () => createMainMenuHeartEmissionPlan('invalid' as never, LOW_VIEWPORT, countingRandom),
    /assetTree/,
  );
  assert.equal(calls, 0);
  assert.throws(
    () => createMainMenuHeartEmissionPlan(
      '480x800',
      LOW_VIEWPORT,
      { nextDecile: () => 0 } as never,
    ),
    /nextIntInclusive/,
  );
  assert.equal(calls, 0);

  const invalidDecile: MainMenuHeartRandom = {
    nextDecile: () => 0.25,
    nextIntInclusive: (minimum) => minimum,
  };
  assert.throws(
    () => createMainMenuHeartEmissionPlan('480x800', LOW_VIEWPORT, invalidDecile),
    /tenths/,
  );
  const invalidInteger: MainMenuHeartRandom = {
    nextDecile: () => 0,
    nextIntInclusive: (_minimum, maximum) => maximum + 1,
  };
  assert.throws(
    () => createMainMenuHeartEmissionPlan('480x800', LOW_VIEWPORT, invalidInteger),
    /outside/,
  );
});

test('FruitButtons preserve ID position, fixture, body, blur, fade, rotation, and audio branches', () => {
  const compact = createMainMenuFruitButtonPresentations('480x800', LOW_VIEWPORT);
  assert.deepEqual(compact.map(({ purpose, fruitId, wrapperPosition }) => ({
    fruitId,
    purpose,
    wrapperPosition,
  })), [
    {
      fruitId: 13,
      purpose: 'leaderboard',
      wrapperPosition: { x: 120, y: Math.fround(800 * float32FromBits(0x3f0ccccd)) },
    },
    {
      fruitId: 7,
      purpose: 'objectives',
      wrapperPosition: { x: 360, y: Math.fround(800 * float32FromBits(0x3f228f5c)) },
    },
    { fruitId: 2, purpose: 'new-game', wrapperPosition: { x: 288, y: 300 } },
  ]);

  for (const button of compact) {
    assert.deepEqual(button.localChildOrder, ['blur', 'circle-art', 'intact-fruit']);
    assert.equal(button.wrapperRootZOrder, 1);
    assert.equal(button.blur.initialOpacity, 0);
    assert.equal(button.blur.fadeInSeconds, 1.25);
    assert.equal(button.blur.removedOnCutWithCleanup, true);
    assert.equal(button.circle.initialOpacity, 0);
    assert.equal(button.circle.entryActionsRunConcurrently, true);
    assert.deepEqual(button.circle.entryActions, [
      { durationSeconds: 1.25, type: 'fade-in' },
      {
        action: { deltaDegrees: -360, durationSeconds: 15, type: 'rotate-by' },
        type: 'repeat-forever',
      },
    ]);
    assert.deepEqual(button.circle.cutScaleAction, {
      durationSeconds: 0.75,
      scaleX: 0,
      scaleY: 0,
      type: 'scale-to',
    });
    assert.equal(button.fruit.initialOpacity, 0);
    assert.equal(button.fruit.fadeInSeconds, 1.25);
    assert.equal(button.fruit.cutEventRegisteredOnEnter, true);
    assert.deepEqual(button.bodyOnEntry.positionWorldUnits, button.wrapperPosition);
    assert.deepEqual(button.bodyOnEntry.positionMetres, {
      x: Math.fround(button.wrapperPosition.x / 32),
      y: Math.fround(button.wrapperPosition.y / 32),
    });
    assert.equal(button.bodyOnEntry.angleRadians, 0);
    assert.equal(button.bodyOnEntry.gravityScale, 0);
    assert.equal(button.bodyOnEntry.awake, true);
    assert.equal(button.bodyOnEntry.angularVelocityRadiansPerSecond, 2);
    assert.equal(button.bodyOnEntry.worldUnitConversionOwner, 'existing-physics-adapter');
    assert.notEqual(button.blur.initialPosition.x, button.blur.postEntrySetPosition.x);
    assert.equal(button.blur.initialPosition.y, button.blur.postEntrySetPosition.y);
  }

  assert.equal(compact[0].factoryFixture.fixture.shape.type, 'circle');
  assert.deepEqual(compact[0].factoryFixture.fixture.shape, {
    centerMetres: { x: 0, y: 0 },
    creatorRadiusWorldUnits: 44.5,
    radiusMetres: 1.390625,
    type: 'circle',
  });
  assert.equal(compact[1].factoryFixture.fixture.shape.type, 'circle');
  assert.equal(compact[1].factoryFixture.fixture.shape.radiusMetres, 1.375);
  assert.deepEqual(compact[2].factoryFixture.fixture.shape, {
    centerMetres: { x: 0, y: 0 },
    creatorSizeWorldUnits: { height: 128, width: 166 },
    halfExtentsMetres: { x: Math.fround(83 / 32), y: 2 },
    type: 'box',
  });
  assert.equal(compact[0].audio.canonicalPath, 'Sounds/mangosteen.wav');
  assert.equal(compact[1].audio.canonicalPath, 'Sounds/strawberry.wav');
  assert.equal(compact[2].audio.canonicalPath, 'Sounds/strawberry.wav');
  assert.equal(MAIN_MENU_FRUIT_CIRCLE_ROTATION_SECONDS, 15);
  assert.equal(MAIN_MENU_FRUIT_CIRCLE_ROTATION_DEGREES, -360);
  assert.equal(MAIN_MENU_FRUIT_CIRCLE_CUT_SECONDS, 0.75);

  const leaderboard = compact[0];
  assert.equal(
    leaderboard.blur.initialPosition.x,
    Math.fround(
      leaderboard.wrapperPosition.x
        - Math.fround(float32FromBits(0x3db851ec) * 235),
    ),
  );
  assert.equal(
    leaderboard.blur.postEntrySetPosition.x,
    Math.fround(
      leaderboard.wrapperPosition.x
        - Math.fround(float32FromBits(0x3da3d70a) * 235),
    ),
  );
  assertDeepFrozen(compact);
});

test('cut plan preserves half/audio/callback order, cleanup, and no menu click', () => {
  const enabled = createMainMenuFruitCutPresentationPlan(
    'leaderboard',
    '720x1280',
    true,
  );
  assert.deepEqual(enabled.orderedOperations, [
    {
      canonicalPath: '720x1280/Fruits/fruit-electric-apple-cut-bottom.png',
      type: 'attach-cut-bottom-half',
    },
    {
      canonicalPath: '720x1280/Fruits/fruit-electric-apple-cut-top.png',
      type: 'attach-cut-top-half',
    },
    { canonicalPath: 'Sounds/mangosteen.wav', loop: false, type: 'request-fruit-audio' },
    { type: 'invoke-main-menu-navigation-callback' },
    { type: 'mark-fruit-button-cut' },
    { cleanup: true, type: 'remove-fruit-button-blur' },
    {
      action: { durationSeconds: 0.75, scaleX: 0, scaleY: 0, type: 'scale-to' },
      type: 'run-fruit-button-circle-action',
    },
    { type: 'continue-shared-fruit-notifications' },
  ]);
  assert.equal(enabled.menuButtonClickRequested, false);

  for (const purpose of ['objectives', 'new-game'] as const) {
    const disabled = createMainMenuFruitCutPresentationPlan(purpose, '480x800', false);
    assert.equal(
      disabled.orderedOperations.some(({ type }) => type === 'request-fruit-audio'),
      false,
    );
    assert.equal(
      disabled.orderedOperations.some((operation) => (
        'canonicalPath' in operation
        && operation.canonicalPath === 'Sounds/menubuttonclick.wav'
      )),
      false,
    );
  }
  assert.throws(
    () => createMainMenuFruitCutPresentationPlan('leaderboard', '480x800', 1 as never),
    /boolean/,
  );
  assertDeepFrozen(enabled);
});

test('presentation rejects invalid viewport/coins before producing a snapshot', () => {
  assert.throws(
    () => createMainMenuPresentation(
      '480x800',
      { ...LOW_VIEWPORT, logicalHeight: 0 },
      0,
    ),
    /logicalHeight/,
  );
  assert.throws(
    () => createMainMenuPresentation(
      '480x800',
      {
        ...LOW_VIEWPORT,
        visibleRect: { ...LOW_VIEWPORT.visibleRect, top: { x: 240, y: Number.POSITIVE_INFINITY } },
      },
      0,
    ),
    /top.y/,
  );
  assert.throws(
    () => createMainMenuPresentation('480x800', LOW_VIEWPORT, 0.5),
    /signed 32-bit/,
  );
  assert.throws(
    () => createMainMenuPresentation('invalid' as never, LOW_VIEWPORT, 0),
    /assetTree/,
  );
  assert.throws(() => formatMainMenuTotalCoins(0x80000000), /signed 32-bit/);
  assert.equal(formatMainMenuTotalCoins(-2147483648), '-2147483648');
  assert.deepEqual(MAIN_MENU_TOTAL_COINS_LABEL_ANCHOR, {
    evidence: 'recovered-setter',
    x: 0,
    y: 0.5,
  });
});

function assertActionPair(
  actions: readonly unknown[],
  moveSeconds: number,
  fadeSeconds: number,
  x: number,
  y: number,
): void {
  assert.deepEqual(actions, [
    { durationSeconds: moveSeconds, target: { x, y }, type: 'move-to' },
    { durationSeconds: fadeSeconds, type: 'fade-in' },
  ]);
}

function assertRotatingEntry(
  actions: readonly unknown[],
  moveSeconds: number,
  fadeSeconds: number,
  rotationSeconds: number,
  deltaDegrees: number,
): void {
  assert.deepEqual(actions, [
    {
      durationSeconds: moveSeconds,
      target: (actions[0] as { readonly target: unknown }).target,
      type: 'move-to',
    },
    { durationSeconds: fadeSeconds, type: 'fade-in' },
    {
      action: { deltaDegrees, durationSeconds: rotationSeconds, type: 'rotate-by' },
      type: 'repeat-forever',
    },
  ]);
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

function float32FromBits(bits: number): number {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, bits, false);
  return view.getFloat32(0, false);
}
