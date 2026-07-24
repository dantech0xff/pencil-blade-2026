import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GN_STYLE_GO_MOVE_SECONDS,
  GN_STYLE_INSTRUCTION_ATTACHMENT_ORDER,
  GN_STYLE_INSTRUCTION_CONSTRUCTION_ORDER,
  GN_STYLE_INTRO_TOTAL_SECONDS,
  GN_STYLE_INTRO_TRANSITION_SECONDS,
  GN_STYLE_ONE_HUNDRED_FIFTY_MOVE_SECONDS,
  createGnStyleIntroPresentationPlan,
} from '../../../game/assets/scripts/domain/gn-style-intro-presentation.ts';

test('GN Style intro fixes 0/.75/1.70/2.60 transitions and equal-z orders', () => {
  const plan = createPlan();

  assert.deepEqual(GN_STYLE_INTRO_TRANSITION_SECONDS, {
    enterGo: Math.fround(1.7),
    enterInstructions: 0,
    enterOneHundredFifty: 0.75,
    enterRunning: Math.fround(2.6),
  });
  assert.equal(GN_STYLE_INTRO_TOTAL_SECONDS, Math.fround(2.6));
  assert.deepEqual(plan.constructionAndActionOrder, [
    'no-bomb', 'gn-style', 'no-life',
  ]);
  assert.equal(
    plan.constructionAndActionOrder,
    GN_STYLE_INSTRUCTION_CONSTRUCTION_ORDER,
  );
  assert.deepEqual(plan.attachmentOrder, [
    'gn-style', 'no-bomb', 'no-life',
  ]);
  assert.equal(
    plan.attachmentOrder,
    GN_STYLE_INSTRUCTION_ATTACHMENT_ORDER,
  );
  assert.equal(plan.totalActionSeconds, Math.fround(2.6));
});

test('three instruction cards start concurrently with exact geometry and one continuation', () => {
  const { instructions } = createPlan();
  const noBombY = Math.fround(800 * Math.fround(0.6));

  assert.deepEqual(instructions.noBomb, {
    actionSequence: [
      { durationSeconds: 0.25, position: { x: 240, y: noBombY }, type: 'move-to' },
      { durationSeconds: 0.25, type: 'delay' },
      { durationSeconds: 0.25, position: { x: 595.5, y: noBombY }, type: 'move-to' },
    ],
    card: 'no-bomb',
    completion: null,
    initialWorldPosition: { x: -115.5, y: noBombY },
    resource: {
      canonicalPath: 'Text/text-nobomb.png',
      type: 'canonical-path',
    },
    startsInOnEnterFrame: true,
    zOrder: 1,
  });
  assert.deepEqual(instructions.gnStyle, {
    actionSequence: [
      { durationSeconds: 0.25, position: { x: 240, y: 400 }, type: 'move-to' },
      { durationSeconds: 0.25, type: 'delay' },
      { durationSeconds: 0.25, position: { x: -171, y: 400 }, type: 'move-to' },
    ],
    card: 'gn-style',
    completion: 'show-one-hundred-fifty',
    initialWorldPosition: { x: 651, y: 400 },
    resource: {
      canonicalPath: 'Text/text-gnstyle.png',
      type: 'canonical-path',
    },
    startsInOnEnterFrame: true,
    zOrder: 1,
  });
  assert.deepEqual(instructions.noLife, {
    actionSequence: [
      { durationSeconds: 0.25, position: { x: 240, y: 320 }, type: 'move-to' },
      { durationSeconds: 0.25, type: 'delay' },
      { durationSeconds: 0.25, position: { x: 575, y: 320 }, type: 'move-to' },
    ],
    card: 'no-life',
    completion: null,
    initialWorldPosition: { x: -95, y: 320 },
    resource: {
      canonicalPath: 'Text/text-nolive.png',
      type: 'canonical-path',
    },
    startsInOnEnterFrame: true,
    zOrder: 1,
  });
  assert.deepEqual(
    Object.values(instructions).filter(({ completion }) => completion !== null)
      .map(({ completion }) => completion),
    ['show-one-hundred-fifty'],
  );
});

test('150s and GO use their distinct native float32 actions', () => {
  const plan = createPlan();
  assert.equal(
    GN_STYLE_ONE_HUNDRED_FIFTY_MOVE_SECONDS,
    0.3499999940395355,
  );
  assert.equal(GN_STYLE_GO_MOVE_SECONDS, 0.32499998807907104);
  assert.deepEqual(plan.oneHundredFifty, {
    actionSequence: [
      {
        durationSeconds: GN_STYLE_ONE_HUNDRED_FIFTY_MOVE_SECONDS,
        position: { x: 240, y: 400 },
        type: 'move-to',
      },
      { durationSeconds: 0.25, type: 'delay' },
      {
        durationSeconds: GN_STYLE_ONE_HUNDRED_FIFTY_MOVE_SECONDS,
        position: { x: 576, y: 400 },
        type: 'move-to',
      },
    ],
    completion: 'show-go',
    initialWorldPosition: { x: -96, y: 400 },
    resource: {
      canonicalPath: 'Text/text-150s.png',
      type: 'canonical-path',
    },
    zOrder: 1,
  });
  assert.deepEqual(plan.go, {
    actionSequence: [
      {
        durationSeconds: GN_STYLE_GO_MOVE_SECONDS,
        position: { x: 240, y: 400 },
        type: 'move-to',
      },
      { durationSeconds: 0.25, type: 'delay' },
      {
        durationSeconds: GN_STYLE_GO_MOVE_SECONDS,
        position: { x: 515, y: 400 },
        type: 'move-to',
      },
    ],
    completion: 'start-game',
    initialWorldPosition: { x: -35, y: 400 },
    resource: {
      canonicalPath: 'Text/text-go.png',
      type: 'canonical-path',
    },
    zOrder: 1,
  });
});

test('intro plan and nested action contracts are immutable', () => {
  const plan = createPlan();
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.instructions), true);
  assert.equal(Object.isFrozen(plan.instructions.gnStyle), true);
  assert.equal(Object.isFrozen(plan.instructions.gnStyle.actionSequence), true);
  assert.equal(plan.instructions.gnStyle.actionSequence.every(Object.isFrozen), true);
});

test('intro input validation fails closed', () => {
  assert.throws(
    () => createGnStyleIntroPresentationPlan(null as never),
    /input must be an object/,
  );
  assert.throws(
    () => createGnStyleIntroPresentationPlan({
      ...input(),
      gnStyleSpriteWidth: 0,
    }),
    /gnStyleSpriteWidth must be positive/,
  );
  assert.throws(
    () => createGnStyleIntroPresentationPlan({
      ...input(),
      visibleRect: { center: { x: 0, y: 0 }, leftX: 1, rightX: 1 },
    }),
    /rightX must be greater/,
  );
});

function createPlan() {
  return createGnStyleIntroPresentationPlan(input());
}

function input() {
  return {
    gnStyleSpriteWidth: 342,
    goSpriteWidth: 70,
    logicalHeight: 800,
    noBombSpriteWidth: 231,
    noLifeSpriteWidth: 190,
    oneHundredFiftySpriteWidth: 192,
    visibleRect: {
      center: { x: 240, y: 400 },
      leftX: 0,
      rightX: 480,
    },
  };
}
