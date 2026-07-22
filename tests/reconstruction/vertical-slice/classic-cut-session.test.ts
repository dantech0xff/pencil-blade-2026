import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBidirectionalRayPlan,
  createCutDispatchCommands,
  type CuttableSnapshot,
} from '../../../game/assets/scripts/domain/classic-cut-query.ts';
import {
  CLASSIC_MODE_ID,
  CLASSIC_SESSION_TOSS_ORDER,
  ClassicSession,
} from '../../../game/assets/scripts/domain/classic-session.ts';

test('ray plan extends by truncated width/16 and preserves the original segment', () => {
  const original = { start: { x: 16, y: 32 }, end: { x: 48, y: 32 } };
  const plan = buildBidirectionalRayPlan(original, 481);

  assert.deepEqual(plan, {
    forward: { start: { x: -14, y: 32 }, end: { x: 78, y: 32 } },
    original,
    reverse: { start: { x: 78, y: 32 }, end: { x: -14, y: 32 } },
  });
  assert.equal(buildBidirectionalRayPlan({ start: { x: 1, y: 1 }, end: { x: 1, y: 1 } }, 480), null);
});

test('cut dispatch preserves forward/reverse duplicates, filtering, and combo-before-cut', () => {
  const original = { start: { x: 1, y: 2 }, end: { x: 3, y: 4 } };
  const plan = buildBidirectionalRayPlan(original, 480);
  assert.ok(plan);

  const fruit: CuttableSnapshot = {
    bodyWorldPosition: { x: 100, y: 200 },
    cutDisabled: false,
    id: 'fruit',
    isFruit: true,
    nodeTag: 0,
  };
  const nonFruit: CuttableSnapshot = {
    bodyWorldPosition: { x: 50, y: 60 },
    cutDisabled: false,
    id: 'bomb',
    isFruit: false,
    nodeTag: 0,
  };

  const commands = createCutDispatchCommands(
    plan,
    [
      { target: fruit },
      { target: null },
      { target: { ...fruit, id: 'excluded', nodeTag: 1437 } },
      { target: { ...fruit, cutDisabled: true, id: 'disabled' } },
      { target: nonFruit },
    ],
    [{ target: fruit }],
  );

  assert.deepEqual(commands, [
    { type: 'combo-check', position: { x: 100, y: 200 }, targetId: 'fruit' },
    { type: 'cut', segment: original, targetId: 'fruit' },
    { type: 'cut', segment: original, targetId: 'bomb' },
    { type: 'combo-check', position: { x: 100, y: 200 }, targetId: 'fruit' },
    { type: 'cut', segment: original, targetId: 'fruit' },
  ]);
});

test('cut filtering reads tag before disabled state and fruit state', () => {
  const plan = buildBidirectionalRayPlan({ start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }, 480);
  assert.ok(plan);
  const accesses: string[] = [];
  const target = new Proxy({
    bodyWorldPosition: { x: 0, y: 0 },
    cutDisabled: false,
    id: 'excluded',
    isFruit: true,
    nodeTag: 1437,
  }, {
    get(object, property, receiver) {
      accesses.push(String(property));
      return Reflect.get(object, property, receiver);
    },
  });

  assert.deepEqual(createCutDispatchCommands(plan, [{ target }], []), []);
  assert.deepEqual(accesses, ['nodeTag']);
});

test('Classic starts all nine controllers in recovered RNG-visible order', () => {
  const session = new ClassicSession();
  assert.deepEqual(session.snapshot(), {
    cutEnabled: true,
    hasTimeManager: false,
    lifecycle: 'intro',
    mode: CLASSIC_MODE_ID,
    terminalPresentationGuard: false,
    worldStopped: false,
  });

  assert.deepEqual(session.completeIntro(), [
    { type: 'set-cut-enabled', enabled: true },
    ...CLASSIC_SESSION_TOSS_ORDER.map((controller) => ({
      type: 'toss-controller' as const,
      action: 'start' as const,
      controller,
    })),
  ]);
  assert.equal(session.snapshot().lifecycle, 'running');
  assert.throws(() => session.completeIntro(), /only once/);
});

test('repeated miss callbacks repeat shutdown but arm terminal presentation once', () => {
  const session = new ClassicSession();
  session.completeIntro();
  const shutdown = [
    { type: 'set-cut-enabled', enabled: false },
    ...CLASSIC_SESSION_TOSS_ORDER.map((controller) => ({
      type: 'toss-controller' as const,
      action: 'stop' as const,
      controller,
    })),
    { type: 'stop-electric-bomb' },
  ];

  assert.deepEqual(session.gameOverFromMiss(), [...shutdown, { type: 'show-game-over' }]);
  assert.deepEqual(session.gameOverFromMiss(), shutdown);
  assert.equal(session.snapshot().terminalPresentationGuard, true);
});

test('bomb hit stops gameplay before physics hold and score, then terminal precedes resume', () => {
  const session = new ClassicSession();
  session.completeIntro();

  assert.deepEqual(session.bombHit(), [
    { type: 'set-cut-enabled', enabled: false },
    ...CLASSIC_SESSION_TOSS_ORDER.map((controller) => ({
      type: 'toss-controller' as const,
      action: 'stop' as const,
      controller,
    })),
    { type: 'stop-electric-bomb' },
    { type: 'set-physics-stopped', stopped: true },
    { type: 'add-score', value: -10 },
  ]);
  assert.equal(session.snapshot().worldStopped, true);
  assert.deepEqual(session.afterBombHit(), [
    { type: 'show-game-over' },
    { type: 'set-physics-stopped', stopped: false },
  ]);
  assert.equal(session.snapshot().worldStopped, false);
});

test('a pending miss can arm terminal during bomb hold without preventing later resume', () => {
  const session = new ClassicSession();
  session.completeIntro();
  session.bombHit();

  assert.equal(session.gameOverFromMiss().at(-1)?.type, 'show-game-over');
  assert.deepEqual(session.afterBombHit(), [{ type: 'set-physics-stopped', stopped: false }]);
  assert.equal(session.snapshot().worldStopped, false);
});

test('bomb physics hold is a last-writer boolean rather than a reference count', () => {
  const session = new ClassicSession();
  session.completeIntro();
  session.bombHit();
  session.bombHit();

  session.afterBombHit();
  assert.equal(session.snapshot().worldStopped, false);
});

test('result replacement commands preserve terminal navigation order', () => {
  const session = new ClassicSession();

  assert.deepEqual(session.displayScoreComplete(123), [
    { type: 'stop-effects' },
    { type: 'construct-result' },
    { type: 'set-result-mode', mode: 0 },
    { type: 'set-result-score', score: 123 },
    { type: 'remove-classic', cleanup: true },
    { type: 'attach-result', zOrder: 1 },
  ]);
  assert.equal(session.snapshot().lifecycle, 'result-removed');
  assert.throws(() => session.displayScoreComplete(1.5), RangeError);
});
