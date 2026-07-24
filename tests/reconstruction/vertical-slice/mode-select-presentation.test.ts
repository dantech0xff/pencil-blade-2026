import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

import type {
  ModeSelectUnlockParticleRandom,
} from '../../../game/assets/scripts/domain/mode-select-state.ts';
import type {
  ModeSelectViewport,
} from '../../../game/assets/scripts/domain/mode-select-presentation.ts';

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
  MODE_SELECT_FRUIT_BUTTON_CHILD_ORDER,
  MODE_SELECT_FRUIT_CUT_CALLBACK_ORDER,
  MODE_SELECT_GESTURE_BINDINGS,
  MODE_SELECT_IMPORTED_CLEAN_SETTINGS_DEFAULTS,
  MODE_SELECT_INFERRED_CENTER_ANCHOR,
  MODE_SELECT_INITIAL_GAME_SCENE_ROOT_ORDER,
  MODE_SELECT_OWNED_ROOT_CHILD_ORDER,
  MODE_SELECT_ROPE_BUTTON_CHILD_ORDER,
  MODE_SELECT_ROPE_SYNCHRONIZATION_ORDER,
  MODE_SELECT_SURVIVING_SIBLING_ORDER,
  createModeSelectFruitCutPresentationPlan,
  createModeSelectPresentation,
  createModeSelectUnlockBurstPresentation,
} = await import('../../../game/assets/scripts/domain/mode-select-presentation.ts');

const COMPACT_VIEWPORT: ModeSelectViewport = Object.freeze({
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

const HIGH_VIEWPORT: ModeSelectViewport = Object.freeze({
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

const OFFSET_VIEWPORT: ModeSelectViewport = Object.freeze({
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

test('imports exact shared/screen orders and the four-child BasicBlade dependency', () => {
  assert.deepEqual(MODE_SELECT_IMPORTED_CLEAN_SETTINGS_DEFAULTS, {
    selectedBackground: 0,
    selectedBlade: 0,
    selectedTheme: 2,
  });
  assert.deepEqual(MODE_SELECT_INITIAL_GAME_SCENE_ROOT_ORDER, [
    { child: 'BackgroundLayer', insertion: 1, tag: 0, zOrder: 1 },
    { child: 'LeafLayer', insertion: 2, tag: 1, zOrder: 1 },
    { child: 'ThemeLayer', insertion: 3, tag: 2, zOrder: 1 },
    { child: 'MainMenuLayer', insertion: 4, tag: 3, zOrder: 1 },
  ]);
  assert.deepEqual(MODE_SELECT_SURVIVING_SIBLING_ORDER, [
    { child: 'BackgroundLayer', originalTag: 0, zOrder: 1 },
    { child: 'LeafLayer', originalTag: 1, zOrder: 1 },
    { child: 'ThemeLayer', originalTag: 2, zOrder: 1 },
    {
      child: 'ModeSelectLayer',
      originalTag: null,
      replacedMainMenuWithCleanup: true,
      zOrder: 1,
    },
  ]);
  assert.deepEqual(MODE_SELECT_OWNED_ROOT_CHILD_ORDER.map(({ child, insertion, zOrder }) => ({
    child,
    insertion,
    zOrder,
  })), [
    { child: 'gestures-layer', insertion: 1, zOrder: 0 },
    { child: 'title', insertion: 2, zOrder: 1 },
    { child: 'back-menu', insertion: 3, zOrder: 1 },
    { child: 'decorative-long-rope', insertion: 4, zOrder: 1 },
    { child: 'classic-rope-button', insertion: 5, zOrder: 1 },
    { child: 'crazy-rope-button', insertion: 6, zOrder: 1 },
    { child: 'gn-style-rope-button', insertion: 7, zOrder: 1 },
    { child: 'classic-bird-rope-button', insertion: 8, zOrder: 1 },
    { child: 'crazy-bird-rope-button', insertion: 9, zOrder: 1 },
    { child: 'combo-bird-rope-button', insertion: 10, zOrder: 1 },
    { child: 'insufficient-coins-label', insertion: 11, zOrder: 1 },
  ]);

  const compact = createModeSelectPresentation('480x800', COMPACT_VIEWPORT, 2500);
  assert.deepEqual(compact.bladeDependency, {
    profile: {
      bladeId: 0,
      kind: 'basic',
      particles: [],
      texture: {
        canonicalPath: '480x800/Blades/blade0.png',
        dimensions: { height: 256, width: 256 },
      },
    },
    scoreManagerRemovedBeforeOwnedRoots: true,
    scoreManagerRemovedWithCleanup: true,
    selectedBladeChildCount: 4,
    selectedBladeChildrenPrecedeOwnedRoots: true,
    selectedBladeId: 0,
    selectedBladeLocalZOrder: 1,
  });
  assert.equal(compact.ownedRootOrder, MODE_SELECT_OWNED_ROOT_CHILD_ORDER);
  assert.deepEqual(compact.gestures, {
    delegates: [
      { event: 'horizontal-drag', target: 'ModeSelectState.drag' },
      { event: 'horizontal-flick', target: 'ModeSelectState.flick' },
      { event: 'back-key', target: 'same-back-item-callback' },
    ],
    directDragDeltaX: true,
    visual: false,
    zOrder: 0,
  });
  assert.equal(compact.gestures, MODE_SELECT_GESTURE_BINDINGS);
  assert.deepEqual(compact.navigation, {
    destinationMapping: [
      { destination: 'ClassicModeLayer', destinationState: 0 },
      { destination: 'CrazyModeLayer', destinationState: 1 },
      { destination: 'GNStyleLayer', destinationState: 2 },
      { destination: 'ClassicBirdLayer', destinationState: 3 },
      { destination: 'CrazyBirdLayer', destinationState: 4 },
      { destination: 'ComboBirdLayer', destinationState: 5 },
    ],
    destinationPresentationIncluded: false,
    noPlaceholderDestinationNodes: true,
  });
  assertDeepFrozen(compact);
});

test('Mode Select blade diagnostics preserve Basic, Dragon, and Centipede selections', () => {
  const basic = createModeSelectPresentation(
    '480x800',
    COMPACT_VIEWPORT,
    0,
    {},
    12,
  );
  assert.equal(basic.bladeDependency.selectedBladeId, 12);
  assert.equal(basic.bladeDependency.profile.kind, 'basic');
  assert.equal(
    basic.bladeDependency.profile.kind === 'basic'
      ? basic.bladeDependency.profile.texture.canonicalPath
      : null,
    '480x800/Blades/rainbow.png',
  );

  const dragon = createModeSelectPresentation(
    '720x1280',
    HIGH_VIEWPORT,
    0,
    {},
    15,
  );
  assert.equal(dragon.bladeDependency.selectedBladeId, 15);
  assert.equal(dragon.bladeDependency.profile.kind, 'dragon');
  assert.equal(
    dragon.bladeDependency.profile.kind === 'dragon'
      ? dragon.bladeDependency.profile.variant
      : null,
    2,
  );

  const centipede = createModeSelectPresentation(
    '720x1280',
    HIGH_VIEWPORT,
    0,
    {},
    17,
  );
  assert.equal(centipede.bladeDependency.selectedBladeId, 17);
  assert.equal(centipede.bladeDependency.profile.kind, 'centipede');
  assert.throws(
    () => createModeSelectPresentation(
      '480x800',
      COMPACT_VIEWPORT,
      0,
      {},
      18,
    ),
    /standard blade ID/,
  );
});

test('compact shell preserves exact anchors, positions, moves, rotations, fade, and coin-label boundary', () => {
  const presentation = createModeSelectPresentation('480x800', COMPACT_VIEWPORT, 2499);
  assert.deepEqual(presentation.shell.title.initialPosition, { x: 240, y: 859 });
  assert.deepEqual(presentation.shell.title.finalPosition, { x: 240, y: 741 });
  assert.deepEqual(presentation.shell.title.actions, [{
    delta: { x: 0, y: -118 },
    durationSeconds: 1,
    easing: null,
    type: 'move-by',
  }]);
  assert.equal(presentation.shell.title.fadeActionPresent, false);
  assert.equal(presentation.shell.title.rotationActionPresent, false);

  assert.deepEqual(presentation.shell.back.initialPosition, { x: -72, y: 62 });
  assert.deepEqual(presentation.shell.back.finalPosition, { x: 72, y: 62 });
  assert.deepEqual(presentation.shell.back.menuPosition, { x: 0, y: 0 });
  assert.deepEqual(presentation.shell.back.actions, [
    {
      deltaDegrees: 360,
      durationSeconds: 1,
      easing: null,
      type: 'rotate-by',
    },
    {
      delta: { x: 144, y: 0 },
      durationSeconds: 1,
      easing: null,
      type: 'move-by',
    },
  ]);
  assert.equal(presentation.shell.back.actionsRunConcurrently, true);
  assert.equal(presentation.shell.back.disabledResource, null);
  assert.equal(presentation.shell.back.fadeActionPresent, false);
  assert.equal(presentation.shell.back.backKeyDelegatesToSameCallback, true);

  assert.deepEqual(presentation.shell.longRope.position, { x: 240, y: 660 });
  assert.deepEqual(presentation.shell.longRope.action, {
    durationSeconds: Math.fround(0.5),
    easing: null,
    type: 'fade-in',
  });
  assert.equal(presentation.shell.longRope.actionStartedBeforeAttachment, true);
  assert.deepEqual(presentation.shell.longRope.fadeSemantics, {
    finalOpacity: 255,
    firstManagerStepOpacity: 0,
    firstTickForcesNormalizedTimeZero: true,
    interpolation: 'linear-uint8-trunc-255-times-t',
    preActionOpacitySetterPresent: false,
    preFirstStepOpacity: 'unchanged-inferred-default',
    registeredPausedUntilAttachment: true,
  });

  assert.deepEqual(presentation.shell.insufficientCoinsLabel, {
    addedBeforeHidden: true,
    anchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
    colorRgb: { b: 0, g: 0, r: 250 },
    failureActionSequence: [
      { durationSeconds: 0.5, easing: null, type: 'fade-in' },
      { durationSeconds: 1, type: 'delay' },
      { durationSeconds: 0.5, easing: null, type: 'fade-out' },
    ],
    failureInitialOpacity: 0,
    failureSequencesCancelExisting: false,
    failureSequencesMayOverlap: true,
    fontCanonicalPath: 'Fonts/SlabThing.ttf',
    fontPointSize: 32,
    position: { x: 240, y: 280 },
    text: 'Not enough coins!',
    visibleAfterConstruction: false,
    zOrder: 1,
  });
  assert.equal(presentation.shell.totalCoinsLabelPresent, false);
  assert.deepEqual(presentation.unlock, {
    initialTotalCoins: 2499,
    particleContainer: presentation.unlock.particleContainer,
    price: 2500,
    successComparison: 'totalCoins > 2499',
    totalCoinsLabelPresent: false,
    totalCoinsPurpose: 'unlock-state-input-only',
  });
});

test('high profile and offset VisibleRect keep T/L/B/C formulas separate from raw W/H formulas', () => {
  const high = createModeSelectPresentation('720x1280', HIGH_VIEWPORT, -25, {
    1: true,
    2: false,
    4: true,
    5: false,
  });
  assert.deepEqual(high.shell.title.initialPosition, { x: 360, y: 1359.5 });
  assert.deepEqual(high.shell.title.finalPosition, { x: 360, y: 1200.5 });
  assert.deepEqual(high.shell.back.initialPosition, { x: -90, y: 75 });
  assert.deepEqual(high.shell.back.finalPosition, { x: 90, y: 75 });
  assert.deepEqual(high.shell.longRope.position, { x: 360, y: 1056 });
  assert.deepEqual(high.shell.insufficientCoinsLabel.position, { x: 360, y: 448 });
  assert.equal(high.shell.insufficientCoinsLabel.fontPointSize, 48);
  assert.deepEqual(high.unlock.particleContainer.burstPlan.emitterWorldPosition, {
    x: 360,
    y: 320,
  });
  assert.equal(high.unlock.particleContainer.burstPlan.minimumTravelMagnitude, 75);
  assert.equal(high.unlock.particleContainer.burstPlan.maximumTravelMagnitude, 225);

  const offset = createModeSelectPresentation('480x800', OFFSET_VIEWPORT, 7);
  assert.deepEqual(offset.shell.title.initialPosition, { x: 280, y: 999 });
  assert.deepEqual(offset.shell.title.finalPosition, { x: 280, y: 881 });
  assert.deepEqual(offset.shell.back.initialPosition, { x: -92, y: 102 });
  assert.deepEqual(offset.shell.back.finalPosition, { x: 52, y: 102 });
  assert.deepEqual(offset.shell.longRope.position, { x: 280, y: 742.5 });
  assert.deepEqual(offset.shell.insufficientCoinsLabel.position, { x: 280, y: 315 });
  assert.equal(offset.shell.insufficientCoinsLabel.fontPointSize, 40);
  assert.deepEqual(offset.cards.map(({ requestedFruitPoint }) => requestedFruitPoint.x), [
    -2720,
    -2120,
    -1520,
    -920,
    -320,
    280,
  ]);
  assert.equal(offset.cards[5].requestedFruitPoint.x, OFFSET_VIEWPORT.visibleRect.center.x);
  assert.equal(offset.cards[5].requestedFruitPoint.y, Math.fround(900 * Math.fround(0.35)));
  assert.notEqual(offset.cards[5].requestedFruitPoint.y, OFFSET_VIEWPORT.visibleRect.bottom.y + 315);
  assert.deepEqual(offset.unlock.particleContainer.burstPlan.emitterWorldPosition, {
    x: 280,
    y: 225,
  });
});

test('initial Combo centering still targets Classic/currentIndex zero on the first unpressed frame', () => {
  const compact = createModeSelectPresentation('480x800', COMPACT_VIEWPORT, 0);
  assert.deepEqual(compact.rail.initialState.anchorXs, [
    -2160,
    -1680,
    -1200,
    -720,
    -240,
    240,
  ]);
  assert.deepEqual(compact.rail.initialState.cardLocks, [false, true, true, false, true, true]);
  assert.equal(compact.rail.initialState.currentIndex, 0);
  assert.equal(compact.rail.initialState.destinationState, -1);
  assert.equal(compact.rail.initiallyVisuallyCenteredCardIndex, 5);
  assert.equal(compact.cards[5].staticAnchorBody.positionWorldUnits.x, 240);
  assert.deepEqual(compact.rail.firstUnpressedFrame, {
    appliedDeltaX: 241,
    centerDifference: 2400,
    pressed: false,
  });
  assert.deepEqual(compact.rail.anchorXsAfterFirstUnpressedFrame, [
    -1919,
    -1439,
    -959,
    -479,
    1,
    481,
  ]);
  assert.equal(compact.rail.firstUnpressedFrameTargetIndex, 0);
  assert.equal(compact.rail.snapThreshold, 2);
  assert.equal(compact.rail.noDeltaTimeNormalization, true);

  const high = createModeSelectPresentation('720x1280', HIGH_VIEWPORT, 0);
  assert.deepEqual(high.rail.firstUnpressedFrame, {
    appliedDeltaX: 361,
    centerDifference: 3600,
    pressed: false,
  });
  assert.deepEqual(high.rail.anchorXsAfterFirstUnpressedFrame, [
    -2879,
    -2159,
    -1439,
    -719,
    1,
    721,
  ]);
});

test('six RopeButtons preserve card order, thirteen children, seven links, and eight revolute joints', () => {
  const presentation = createModeSelectPresentation('480x800', COMPACT_VIEWPORT, 0);
  assert.deepEqual(presentation.cards.map(({ card }) => ({
    description: card.rasters['480x800'].description.canonicalPath,
    destination: card.destination,
    fruitId: card.fruitId,
    index: card.destinationState,
  })), [
    {
      description: '480x800/Interfaces/object-classic-des.png',
      destination: 'ClassicModeLayer',
      fruitId: 0,
      index: 0,
    },
    {
      description: '480x800/Interfaces/object-crazy-des.png',
      destination: 'CrazyModeLayer',
      fruitId: 1,
      index: 1,
    },
    {
      description: '480x800/Interfaces/object-combo-des.png',
      destination: 'GNStyleLayer',
      fruitId: 2,
      index: 2,
    },
    {
      description: '480x800/Interfaces/object-classic-bird-des.png',
      destination: 'ClassicBirdLayer',
      fruitId: 7,
      index: 3,
    },
    {
      description: '480x800/Interfaces/object-crazy-bird-des.png',
      destination: 'CrazyBirdLayer',
      fruitId: 14,
      index: 4,
    },
    {
      description: '480x800/Interfaces/object-combo-bird-des.png',
      destination: 'ComboBirdLayer',
      fruitId: 6,
      index: 5,
    },
  ]);
  assert.equal(MODE_SELECT_ROPE_BUTTON_CHILD_ORDER.length, 13);
  assert.deepEqual(MODE_SELECT_ROPE_BUTTON_CHILD_ORDER.map(({ child }) => child), [
    'rope-link-0',
    'rope-link-1',
    'rope-link-2',
    'rope-link-3',
    'rope-link-4',
    'rope-link-5',
    'rope-link-6',
    'description-shader',
    'description-art',
    'fruit-button',
    'upper-wheel',
    'lower-wheel',
    'wheel-connector',
  ]);
  assert.equal(MODE_SELECT_ROPE_BUTTON_CHILD_ORDER.every(({ zOrder }) => zOrder === 1), true);
  assert.deepEqual(MODE_SELECT_FRUIT_BUTTON_CHILD_ORDER, [
    'blur',
    'circle-art',
    'intact-fruit',
  ]);

  const classic = presentation.cards[0];
  assert.deepEqual(classic.staticAnchorBody, {
    angleRadians: 0,
    bodyType: 'static',
    positionMetres: { x: -67.5, y: 20.875 },
    positionWorldUnits: { x: -2160, y: 668 },
  });
  assert.deepEqual(classic.ropeLinks.map((link) => ({
    bodyType: link.bodyType,
    index: link.index,
    position: link.displayPositionWorldUnits,
    resource: link.resource.canonicalPath,
    zOrder: link.zOrder,
  })), [661, 647, 633, 619, 605, 591, 577].map((y, index) => ({
    bodyType: 'dynamic',
    index,
    position: { x: -2160, y },
    resource: '480x800/Interfaces/object-rope-node.png',
    zOrder: 1,
  })));
  assert.deepEqual(classic.joints, [
    { bodyA: 'static-anchor', bodyB: 'rope-link-0', chainIndex: 0, type: 'revolute' },
    { bodyA: 'rope-link-0', bodyB: 'rope-link-1', chainIndex: 1, type: 'revolute' },
    { bodyA: 'rope-link-1', bodyB: 'rope-link-2', chainIndex: 2, type: 'revolute' },
    { bodyA: 'rope-link-2', bodyB: 'rope-link-3', chainIndex: 3, type: 'revolute' },
    { bodyA: 'rope-link-3', bodyB: 'rope-link-4', chainIndex: 4, type: 'revolute' },
    { bodyA: 'rope-link-4', bodyB: 'rope-link-5', chainIndex: 5, type: 'revolute' },
    { bodyA: 'rope-link-5', bodyB: 'rope-link-6', chainIndex: 6, type: 'revolute' },
    { bodyA: 'rope-link-6', bodyB: 'fruit-body', chainIndex: 7, type: 'revolute' },
  ]);
  assert.deepEqual(classic.moveContract, {
    anglePreservedRadians: 0,
    movesOnlyStaticAnchorBody: true,
    translationInputDivisor: 32,
  });
  assert.equal(classic.shader.attachedTo, 'fruit-body');
  assert.equal(classic.description.attachedTo, 'fruit-body');
  assert.equal(classic.scheduledSynchronization.runsEveryScheduledFrame, true);
  assert.equal(
    classic.scheduledSynchronization.operationOrder,
    MODE_SELECT_ROPE_SYNCHRONIZATION_ORDER,
  );
  assert.deepEqual(classic.scheduledSynchronization.operationOrder, [
    'read-static-anchor-and-convert-by-32',
    'set-fruit-x-and-retain-requested-y',
    'set-upper-wheel-position',
    'set-lower-wheel-position',
    'set-connector-position',
    'set-wheel-rotations-from-current-x',
  ]);
  assert.equal(classic.ropeLinks.every(({ anchor }) => (
    anchor === MODE_SELECT_INFERRED_CENTER_ANCHOR
  )), true);
  assert.equal(classic.ropeLinks.every(({ entryActions }) => entryActions.length === 0), true);
  assert.equal(classic.shader.anchor, MODE_SELECT_INFERRED_CENTER_ANCHOR);
  assert.deepEqual(classic.shader.entryActions, []);
  assert.equal(classic.description.anchor, MODE_SELECT_INFERRED_CENTER_ANCHOR);
  assert.deepEqual(classic.description.entryActions, []);
  assert.equal(classic.wheelAssembly.upperWheelAnchor, MODE_SELECT_INFERRED_CENTER_ANCHOR);
  assert.equal(classic.wheelAssembly.lowerWheelAnchor, MODE_SELECT_INFERRED_CENTER_ANCHOR);
  assert.equal(classic.wheelAssembly.connectorAnchor, MODE_SELECT_INFERRED_CENTER_ANCHOR);
  assert.deepEqual(classic.wheelAssembly.entryActions, []);
  assert.deepEqual(classic.scheduledSynchronization.initial.upperWheelPosition, {
    x: -2160,
    y: 688,
  });
  assert.deepEqual(classic.scheduledSynchronization.initial.lowerWheelPosition, {
    x: -2160,
    y: 648,
  });
  assert.deepEqual(classic.scheduledSynchronization.initial.fruitPosition, {
    x: -2160,
    y: 280,
  });
  assert.equal(
    classic.scheduledSynchronization.initial.upperWheelRotationDegrees,
    Math.fround(
      Math.fround(-2160 / float32FromBits(0x4196cbe4))
        * float32FromBits(0x42652ee1),
    ),
  );
});

test('FruitButtons preserve 0.09 entry/0.08 steady offsets, body state, fades, rotations, and locks', () => {
  const compact = createModeSelectPresentation('480x800', COMPACT_VIEWPORT, 0);
  const classic = compact.cards[0].fruitButton;
  assert.deepEqual(classic.blur.initialPosition, {
    x: Math.fround(-2160 - Math.fround(float32FromBits(0x3db851ec) * 235)),
    y: 267.5,
  });
  assert.deepEqual(classic.blur.steadyPositionAfterFirstRopeUpdate, {
    x: Math.fround(-2160 - Math.fround(float32FromBits(0x3da3d70a) * 235)),
    y: 267.5,
  });
  assert.deepEqual(classic.circle.entryActions, [
    { durationSeconds: 1.25, easing: null, type: 'fade-in' },
    {
      action: {
        deltaDegrees: -360,
        durationSeconds: 15,
        easing: null,
        type: 'rotate-by',
      },
      type: 'repeat-forever',
    },
  ]);
  assert.deepEqual(classic.circle.cutScaleAction, {
    durationSeconds: 0.75,
    easing: null,
    scaleX: 0,
    scaleY: 0,
    type: 'scale-to',
  });
  assert.deepEqual(classic.bodyOnEntry, {
    angleRadians: 0,
    angularVelocityRadiansPerSecond: 2,
    awake: true,
    bodyType: 'dynamic',
    gravityScale: 0,
    jointedToLastRopeLink: true,
    positionMetres: { x: -67.5, y: 8.75 },
    positionWorldUnits: { x: -2160, y: 280 },
    worldUnitConversionOwner: 'rope-physics-adapter',
  });
  assert.equal(classic.factoryFixture.fixture.shape.type, 'circle');
  assert.equal(compact.cards[1].fruitButton.factoryFixture.fixture.shape.type, 'box');
  assert.equal(compact.cards[2].fruitButton.factoryFixture.fixture.shape.type, 'box');
  assert.equal(compact.cards[4].fruitButton.factoryFixture.fixture.shape.type, 'circle');
  assert.equal(classic.lock, null);
  assert.equal(compact.cards[3].fruitButton.lock, null);
  assert.deepEqual(compact.cards.map(({ initialLocked }) => initialLocked), [
    false,
    true,
    true,
    false,
    true,
    true,
  ]);
  const crazyLock = compact.cards[1].fruitButton.lock;
  assert.ok(crazyLock);
  assert.deepEqual(crazyLock.itemPosition, { x: -1680, y: 140 });
  assert.deepEqual(crazyLock.menuPosition, { x: 0, y: 0 });
  assert.equal(crazyLock.resources.normal.canonicalPath, '480x800/Buttons/button-unlock.png');
  assert.equal(
    crazyLock.resources.selected.canonicalPath,
    '480x800/Buttons/button-unlock-selected.png',
  );
  assert.equal(crazyLock.parent, 'contained-intact-fruit');
  assert.equal(crazyLock.senderIdentityUsed, false);
  assert.equal(crazyLock.currentIndexCoupled, true);
  assert.equal(crazyLock.hiddenNotRemovedOnUnlock, true);

  const persisted = createModeSelectPresentation('720x1280', HIGH_VIEWPORT, 0, {
    1: true,
    2: false,
    4: true,
    5: false,
  });
  assert.deepEqual(persisted.cards.map(({ initialLocked }) => initialLocked), [
    false,
    false,
    true,
    false,
    false,
    true,
  ]);
  assert.deepEqual(persisted.cards.map(({ fruitButton }) => fruitButton.lock !== null), [
    false,
    false,
    true,
    false,
    false,
    true,
  ]);
});

test('cut plans map only destinations and preserve Fruit audio/state/wrapper callback order', () => {
  assert.deepEqual(MODE_SELECT_FRUIT_CUT_CALLBACK_ORDER, [
    'fruit-cut-halves-and-effects-gated-fruit-audio',
    'mode-select-state-write-and-mode-selected',
    'fruit-button-wrapper-callback',
    'remaining-fruit-notifications',
  ]);
  const expected = [
    ['Sounds/apple.wav', 'ClassicModeLayer'],
    ['Sounds/banana.wav', 'CrazyModeLayer'],
    ['Sounds/strawberry.wav', 'GNStyleLayer'],
    ['Sounds/strawberry.wav', 'ClassicBirdLayer'],
    ['Sounds/mangosteen.wav', 'CrazyBirdLayer'],
    ['Sounds/apple.wav', 'ComboBirdLayer'],
  ] as const;

  for (let index = 0; index < expected.length; index += 1) {
    const plan = createModeSelectFruitCutPresentationPlan(index, '480x800', true);
    assert.equal(plan.modeIndex, index);
    assert.equal(plan.layerWideNavigationGuardPresent, false);
    assert.equal(plan.selectionDelayMayBeAttachedAgain, true);
    assert.equal(plan.stopsModeSelectActions, false);
    assert.deepEqual(plan.orderedOperations.map(({ type }) => type), [
      'attach-cut-bottom-half',
      'attach-cut-top-half',
      'request-fruit-audio',
      'write-mode-select-destination-state',
      'invoke-mode-selected',
      'mark-fruit-button-cut',
      'remove-fruit-button-blur',
      'run-fruit-button-circle-action',
      'continue-shared-fruit-notifications',
    ]);
    assert.deepEqual(plan.orderedOperations[2], {
      canonicalPath: expected[index][0],
      loop: false,
      type: 'request-fruit-audio',
    });
    assert.deepEqual(plan.orderedOperations[3], {
      destination: expected[index][1],
      destinationState: index,
      type: 'write-mode-select-destination-state',
    });
    assert.equal(
      JSON.stringify(plan).includes('placeholder'),
      false,
      `mode ${index} must not invent a destination screen`,
    );
    assertDeepFrozen(plan);
  }

  const disabled = createModeSelectFruitCutPresentationPlan(4, '720x1280', false);
  assert.equal(
    disabled.orderedOperations.some(({ type }) => type === 'request-fruit-audio'),
    false,
  );
  assert.deepEqual(disabled.orderedOperations[2], {
    destination: 'CrazyBirdLayer',
    destinationState: 4,
    type: 'write-mode-select-destination-state',
  });
});

test('unlock burst maps the exact 45 state plans, 225 draws, concurrent actions, and cleanup timeline', () => {
  const calls: { maximum: number; minimum: number }[] = [];
  const random: ModeSelectUnlockParticleRandom = {
    nextIntInclusive(minimum, maximum): number {
      calls.push({ maximum, minimum });
      return minimum;
    },
  };
  const burst = createModeSelectUnlockBurstPresentation(
    '480x800',
    COMPACT_VIEWPORT,
    random,
  );
  assert.equal(calls.length, 225);
  for (let particle = 0; particle < 45; particle += 1) {
    assert.deepEqual(calls.slice(particle * 5, particle * 5 + 5), [
      { maximum: 70, minimum: 35 },
      { maximum: 1, minimum: -1 },
      { maximum: 150, minimum: 50 },
      { maximum: 1, minimum: -1 },
      { maximum: 150, minimum: 50 },
    ]);
  }
  assert.equal(burst.randomDrawCount, 225);
  assert.equal(burst.particles.length, 45);
  assert.deepEqual(burst.container.timeline, [
    { durationSeconds: Math.fround(0.05), type: 'delay' },
    {
      callback: 'create-45-particle-explosion',
      synchronous: true,
      type: 'invoke-callback',
    },
    { durationSeconds: Math.fround(1.4), type: 'delay' },
    { cleanup: true, type: 'remove-container' },
  ]);
  assert.deepEqual(burst.container.burstPlan.emitterWorldPosition, { x: 240, y: 200 });
  assert.equal(burst.container.burstPlan.removeAtSeconds, Math.fround(
    Math.fround(0.05) + Math.fround(1.4),
  ));
  assert.equal(
    burst.container.resource.canonicalPath,
    '480x800/Blades/Particles/X-Mas/xmasfive.png',
  );
  assert.deepEqual(burst.particles[0], {
    actionPlan: {
      actionsRunConcurrently: true,
      appliesColor: false,
      autoDelete: false,
      deltaLocal: { x: -50, y: -50 },
      durationHundredths: 35,
      durationSeconds: Math.fround(Math.fround(35) / Math.fround(100)),
      fadeOut: false,
      horizontalMagnitude: 50,
      horizontalSign: -1,
      index: 0,
      moveActionSequence: [
        {
          deltaLocal: { x: -50, y: -50 },
          durationSeconds: Math.fround(Math.fround(35) / Math.fround(100)),
          type: 'move-by',
        },
        { type: 'invoke-finished-callback' },
      ],
      particleRootZOrder: 1,
      rotateAction: {
        deltaX: 1,
        deltaY: 1,
        durationSeconds: Math.fround(Math.fround(35) / Math.fround(100)),
        overload: 'three-argument',
        type: 'rotate-by',
      },
      scaleAction: {
        durationSeconds: Math.fround(Math.fround(35) / Math.fround(100)),
        scaleX: 0,
        scaleY: 0,
        type: 'scale-to',
      },
      spriteChildZOrder: 0,
      verticalMagnitude: 50,
      verticalSign: -1,
    },
    anchor: MODE_SELECT_INFERRED_CENTER_ANCHOR,
    defaultColor: 'white-inferred-legacy-default',
    initialOpacity: 'full-inferred-legacy-default',
    resource: {
      canonicalPath: '480x800/Blades/Particles/X-Mas/xmasfive.png',
      dimensions: { height: 44, width: 46 },
    },
    retainedUntilContainerCleanup: true,
    rootZOrder: 1,
    spriteBlend: 'ordinary-inferred-legacy-default',
    spriteChildZOrder: 0,
  });
  assert.equal(burst.particles.every(({ actionPlan }) => (
    actionPlan.actionsRunConcurrently
      && !actionPlan.fadeOut
      && !actionPlan.autoDelete
      && !actionPlan.appliesColor
  )), true);
  assertDeepFrozen(burst);
});

test('all profile/input validation finishes before RNG and invalid presentation inputs are rejected', () => {
  let draws = 0;
  const random: ModeSelectUnlockParticleRandom = {
    nextIntInclusive(minimum): number {
      draws += 1;
      return minimum;
    },
  };
  assert.throws(
    () => createModeSelectUnlockBurstPresentation('invalid' as never, COMPACT_VIEWPORT, random),
    /assetTree/,
  );
  assert.equal(draws, 0);
  assert.throws(
    () => createModeSelectUnlockBurstPresentation(
      '480x800',
      { ...COMPACT_VIEWPORT, logicalHeight: Number.NaN },
      random,
    ),
    /logicalHeight/,
  );
  assert.equal(draws, 0);
  assert.throws(
    () => createModeSelectUnlockBurstPresentation(
      '480x800',
      COMPACT_VIEWPORT,
      {} as never,
    ),
    /nextIntInclusive/,
  );
  assert.equal(draws, 0);

  assert.throws(
    () => createModeSelectPresentation('invalid' as never, COMPACT_VIEWPORT, 0),
    /assetTree/,
  );
  assert.throws(
    () => createModeSelectPresentation(
      '480x800',
      { ...COMPACT_VIEWPORT, visibleRect: null as never },
      0,
    ),
    /visibleRect/,
  );
  assert.throws(
    () => createModeSelectPresentation('480x800', COMPACT_VIEWPORT, 1.5),
    /signed 32-bit/,
  );
  assert.throws(
    () => createModeSelectPresentation(
      '480x800',
      COMPACT_VIEWPORT,
      0,
      { 3: true } as never,
    ),
    /only mode indices 1, 2, 4, and 5/,
  );
  assert.throws(
    () => createModeSelectFruitCutPresentationPlan(6, '480x800', true),
    /six Mode Select cards/,
  );
  assert.throws(
    () => createModeSelectFruitCutPresentationPlan(0, 'invalid' as never, true),
    /assetTree/,
  );
  assert.throws(
    () => createModeSelectFruitCutPresentationPlan(0, '480x800', 'yes' as never),
    /boolean/,
  );
});

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
