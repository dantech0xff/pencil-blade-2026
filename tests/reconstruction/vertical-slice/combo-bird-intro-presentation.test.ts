import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMBO_BIRD_INSTRUCTION_ATTACHMENT_ORDER,
  COMBO_BIRD_INSTRUCTION_CONSTRUCTION_ORDER,
  COMBO_BIRD_INTRO_TRANSITION_SECONDS,
  COMBO_BIRD_INTRO_TOTAL_SECONDS,
  createComboBirdIntroPresentationPlan,
} from '../../../game/assets/scripts/domain/combo-bird-intro-presentation.ts';

test('Combo Bird intro fixes 0/1.25/2.5/3.75 transitions and equal-z orders', () => {
  const plan = createPlan();

  assert.deepEqual(COMBO_BIRD_INTRO_TRANSITION_SECONDS, {
    enterGo: 2.5,
    enterInstructions: 0,
    enterNinety: 1.25,
    enterRunning: 3.75,
  });
  assert.equal(COMBO_BIRD_INTRO_TOTAL_SECONDS, 3.75);
  assert.deepEqual(plan.constructionAndActionOrder, [
    'no-bomb', 'just-combo', 'no-life',
  ]);
  assert.equal(
    plan.constructionAndActionOrder,
    COMBO_BIRD_INSTRUCTION_CONSTRUCTION_ORDER,
  );
  assert.deepEqual(plan.attachmentOrder, [
    'just-combo', 'no-bomb', 'no-life',
  ]);
  assert.equal(
    plan.attachmentOrder,
    COMBO_BIRD_INSTRUCTION_ATTACHMENT_ORDER,
  );
  assert.equal(plan.totalActionSeconds, 3.75);
});

test('three instruction cards start concurrently with exact geometry and one continuation', () => {
  const { instructions } = createPlan();
  const noBombY = Math.fround(800 * Math.fround(0.6));

  assert.deepEqual(instructions.noBomb, {
    actionSequence: [
      { durationSeconds: 0.5, position: { x: 240, y: noBombY }, type: 'move-to' },
      { durationSeconds: 0.25, type: 'delay' },
      { durationSeconds: 0.5, position: { x: 595.5, y: noBombY }, type: 'move-to' },
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
  assert.deepEqual(instructions.justCombo, {
    actionSequence: [
      { durationSeconds: 0.5, position: { x: 240, y: 400 }, type: 'move-to' },
      { durationSeconds: 0.25, type: 'delay' },
      { durationSeconds: 0.5, position: { x: -143, y: 400 }, type: 'move-to' },
    ],
    card: 'just-combo',
    completion: 'show-ninety',
    initialWorldPosition: { x: 623, y: 400 },
    resource: {
      field: 'justComboInstruction',
      type: 'semantic-resource',
    },
    startsInOnEnterFrame: true,
    zOrder: 1,
  });
  assert.deepEqual(instructions.noLife, {
    actionSequence: [
      { durationSeconds: 0.5, position: { x: 240, y: 320 }, type: 'move-to' },
      { durationSeconds: 0.25, type: 'delay' },
      { durationSeconds: 0.5, position: { x: 575, y: 320 }, type: 'move-to' },
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
    ['show-ninety'],
  );
});

test('90s and GO each use exact 1.25s left-to-right actions', () => {
  const plan = createPlan();
  assert.deepEqual(plan.ninety, {
    actionSequence: [
      { durationSeconds: 0.5, position: { x: 240, y: 400 }, type: 'move-to' },
      { durationSeconds: 0.25, type: 'delay' },
      { durationSeconds: 0.5, position: { x: 564.5, y: 400 }, type: 'move-to' },
    ],
    completion: 'show-go',
    initialWorldPosition: { x: -84.5, y: 400 },
    resource: {
      canonicalPath: 'Text/text-90s.png',
      type: 'canonical-path',
    },
    zOrder: 1,
  });
  assert.deepEqual(plan.go, {
    actionSequence: [
      { durationSeconds: 0.5, position: { x: 240, y: 400 }, type: 'move-to' },
      { durationSeconds: 0.25, type: 'delay' },
      { durationSeconds: 0.5, position: { x: 515, y: 400 }, type: 'move-to' },
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

test('intro input validation fails closed', () => {
  assert.throws(
    () => createComboBirdIntroPresentationPlan(null as never),
    /input must be an object/,
  );
  assert.throws(
    () => createComboBirdIntroPresentationPlan({
      ...input(),
      justComboSpriteWidth: 0,
    }),
    /justComboSpriteWidth must be positive/,
  );
  assert.throws(
    () => createComboBirdIntroPresentationPlan({
      ...input(),
      visibleRect: { center: { x: 0, y: 0 }, leftX: 1, rightX: 1 },
    }),
    /rightX must be greater/,
  );
});

function createPlan() {
  return createComboBirdIntroPresentationPlan(input());
}

function input() {
  return {
    goSpriteWidth: 70,
    justComboSpriteWidth: 286,
    logicalHeight: 800,
    ninetySpriteWidth: 169,
    noBombSpriteWidth: 231,
    noLifeSpriteWidth: 190,
    visibleRect: {
      center: { x: 240, y: 400 },
      leftX: 0,
      rightX: 480,
    },
  };
}
