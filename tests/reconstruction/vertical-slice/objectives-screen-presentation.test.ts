import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

import type {
  ObjectiveDefinition,
  ObjectiveId,
} from '../../../game/assets/scripts/domain/objectives-manager-state.ts';
import type {
  ObjectivesScreenManagerPort,
  ObjectivesScreenStateSnapshot,
} from '../../../game/assets/scripts/domain/objectives-screen-state.ts';
import type {
  ObjectivesScreenViewport,
} from '../../../game/assets/scripts/domain/objectives-screen-presentation.ts';

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
  OBJECTIVES_COUNT,
  objectiveDefinitionAt,
} = await import('../../../game/assets/scripts/domain/objectives-manager-state.ts');
const {
  ObjectivesScreenState,
} = await import('../../../game/assets/scripts/domain/objectives-screen-state.ts');
const {
  OBJECTIVES_SCREEN_BACK_NAVIGATION_STEPS,
  OBJECTIVES_SCREEN_ENTRY_SECONDS,
  OBJECTIVES_SCREEN_FINISHED_DESCRIPTION_COLOR,
  OBJECTIVES_SCREEN_FINISHED_REWARD_COLOR,
  OBJECTIVES_SCREEN_ITEM_CHILD_ORDER,
  OBJECTIVES_SCREEN_LABEL_ANCHOR,
  OBJECTIVES_SCREEN_MENU_CHILD_ORDER,
  OBJECTIVES_SCREEN_PROBE_READS,
  OBJECTIVES_SCREEN_UNFINISHED_DESCRIPTION_COLOR,
  OBJECTIVES_SCREEN_UNFINISHED_REWARD_COLOR,
  createObjectivesScreenListMetrics,
  createObjectivesScreenPresentation,
} = await import(
  '../../../game/assets/scripts/domain/objectives-screen-presentation.ts'
);

class Manager implements ObjectivesScreenManagerPort {
  readonly finished = new Set<number>();
  current: number;
  lastSkipped: number | null = null;

  constructor(current: number, finished: readonly number[] = []) {
    this.current = current;
    for (const objectiveId of finished) {
      this.finished.add(objectiveId);
    }
  }

  activeObjective(): ObjectiveDefinition | null {
    return objectiveDefinitionAt(this.current);
  }

  isFinished(objectiveId: number): boolean {
    return this.finished.has(objectiveId);
  }

  skip(objectiveId: number) {
    this.lastSkipped = objectiveId;
    this.finished.add(objectiveId);
    this.current += 1;
    if (this.current >= OBJECTIVES_COUNT) {
      this.current = 0;
      this.finished.clear();
    }
    return null;
  }
}

const COMPACT_VIEWPORT: ObjectivesScreenViewport = deepFreeze({
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

const HIGH_VIEWPORT: ObjectivesScreenViewport = deepFreeze({
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

test('probe-derived compact/high list metrics retain exact float32 formulas', () => {
  assert.deepEqual(
    createObjectivesScreenListMetrics('480x800', COMPACT_VIEWPORT),
    {
      bottomBound: 292.5,
      logicalHeight: 800,
      rowSpacing: 101.25,
      topBound: 594.5,
    },
  );
  assert.deepEqual(
    createObjectivesScreenListMetrics('720x1280', HIGH_VIEWPORT),
    {
      bottomBound: Math.fround(
        Math.fround(Math.fround(0) + Math.fround(
          float32FromBits(0x3f86_6666) * Math.fround(384),
        )) + Math.fround(0.5 * 122),
      ),
      logicalHeight: 1280,
      rowSpacing: 152.5,
      topBound: Math.fround(
        Math.fround(Math.fround(1280) - Math.fround(
          float32FromBits(0x3f8c_cccd) * Math.fround(240),
        )) - Math.fround(0.5 * 122),
      ),
    },
  );
  assertDeepFrozen(createObjectivesScreenListMetrics(
    '480x800',
    COMPACT_VIEWPORT,
  ));
});

test('root hierarchy preserves 57 equal-z children in recovered insertion order', () => {
  const { presentation } = createFixture();

  assert.equal(presentation.ownedRootOrder.length, 57);
  assert.deepEqual(
    presentation.ownedRootOrder.map(({ insertion }) => insertion),
    Array.from({ length: 57 }, (_, index) => index + 1),
  );
  assert.equal(
    presentation.ownedRootOrder.every(({ zOrder }) => zOrder === 1),
    true,
  );
  assert.deepEqual(presentation.ownedRootOrder.slice(0, 4), [
    { child: 'background', insertion: 1, zOrder: 1 },
    { child: 'objective-row-0', insertion: 2, zOrder: 1 },
    { child: 'objective-row-1', insertion: 3, zOrder: 1 },
    { child: 'objective-row-2', insertion: 4, zOrder: 1 },
  ]);
  assert.deepEqual(presentation.ownedRootOrder.slice(-4), [
    { child: 'header', insertion: 54, zOrder: 1 },
    { child: 'footer', insertion: 55, zOrder: 1 },
    { child: 'fixed-current-item', insertion: 56, zOrder: 1 },
    { child: 'menu', insertion: 57, zOrder: 1 },
  ]);
  assert.deepEqual(OBJECTIVES_SCREEN_ITEM_CHILD_ORDER, [
    { child: 'background', insertion: 1, zOrder: 1 },
    { child: 'description', insertion: 2, zOrder: 1 },
    { child: 'reward', insertion: 3, zOrder: 1 },
  ]);
  assert.equal(
    presentation.rows.every(({ childOrder }) => (
      childOrder === OBJECTIVES_SCREEN_ITEM_CHILD_ORDER
    )),
    true,
  );
  assert.deepEqual(presentation.menu.childOrder, OBJECTIVES_SCREEN_MENU_CHILD_ORDER);
  assert.deepEqual(presentation.clipping, {
    mask: false,
    scissor: false,
    stencil: false,
  });
  assertDeepFrozen(presentation);
});

test('background, header, footer, and fixed-current card use exact static roots', () => {
  const { presentation } = createFixture();
  const fade = [{
    durationSeconds: OBJECTIVES_SCREEN_ENTRY_SECONDS,
    easing: null,
    type: 'fade-in',
  }];

  assert.deepEqual(presentation.background.position, { x: 240, y: 400 });
  assert.deepEqual(presentation.background.actions, fade);
  assert.equal(
    presentation.background.resource.canonicalPath,
    '480x800/Objectives/objectives-background.png',
  );
  assert.deepEqual(presentation.header.position, { x: 240, y: 725 });
  assert.deepEqual(presentation.header.actions, fade);
  assert.deepEqual(presentation.footer.position, { x: 240, y: 120 });
  assert.deepEqual(presentation.footer.actions, fade);
  assert.deepEqual(presentation.fixedCurrent.background.position, {
    x: 240,
    y: Math.fround(float32FromBits(0x3e19_999a) * Math.fround(800)),
  });
  assert.equal(
    presentation.fixedCurrent.background.resource.canonicalPath,
    '480x800/Objectives/objectives-next.png',
  );
  assert.equal(presentation.fixedCurrent.customBackground, true);
  assert.equal(presentation.fixedCurrent.objective.id, 50);
  assert.equal(
    presentation.fixedCurrent.description.text,
    'No bombs hit Crazy Mode',
  );
  assert.equal(presentation.fixedCurrent.reward.text, 'reward: 666 coins');
  assert.deepEqual(presentation.probeReads, OBJECTIVES_SCREEN_PROBE_READS);
});

test('all 52 rows preserve order, completion texture lookup, text, fonts, positions, and colors', () => {
  const { presentation } = createFixture(8, [0]);
  assert.equal(presentation.rows.length, 52);

  const finished = presentation.rows[0]!;
  assert.equal(finished.objective.id, 0);
  assert.equal(finished.objective.sequencePosition, 0);
  assert.equal(finished.objective.description, '15 times combo 3');
  assert.equal(finished.finished, true);
  assert.equal(
    finished.background.resource.canonicalPath,
    '480x800/Objectives/objectives-active.png',
  );
  assert.deepEqual(finished.background.position, { x: 240, y: 1404.5 });
  assert.equal(
    finished.description.position.x,
    Math.fround(Math.fround(240) - Math.fround(375 / Math.fround(3.5))),
  );
  assert.equal(finished.description.position.y, 1424.75);
  assert.equal(finished.reward.position.x, 193.125);
  assert.equal(finished.reward.position.y, 1384.25);
  assert.equal(finished.description.fontCanonicalPath, 'Fonts/Arial.ttf');
  assert.equal(finished.reward.fontCanonicalPath, 'Fonts/Arial.ttf');
  assert.equal(finished.description.fontPointSize, Math.fround(21.6));
  assert.equal(finished.reward.fontPointSize, 24);
  assert.deepEqual(finished.description.anchor, OBJECTIVES_SCREEN_LABEL_ANCHOR);
  assert.deepEqual(
    finished.description.colorRgb,
    OBJECTIVES_SCREEN_FINISHED_DESCRIPTION_COLOR,
  );
  assert.deepEqual(
    finished.reward.colorRgb,
    OBJECTIVES_SCREEN_FINISHED_REWARD_COLOR,
  );
  assert.equal(finished.reward.text, 'reward: 99 coins');

  const unfinished = presentation.rows[1]!;
  assert.equal(unfinished.objective.id, 27);
  assert.equal(
    unfinished.background.resource.canonicalPath,
    '480x800/Objectives/objectives-inactive.png',
  );
  assert.equal(unfinished.reward.text, 'reward: 111 coins');
  assert.deepEqual(
    unfinished.description.colorRgb,
    OBJECTIVES_SCREEN_UNFINISHED_DESCRIPTION_COLOR,
  );
  assert.deepEqual(
    unfinished.reward.colorRgb,
    OBJECTIVES_SCREEN_UNFINISHED_REWARD_COLOR,
  );
  assert.equal(presentation.rows[8]?.background.position.y, 594.5);
  assert.equal(presentation.rows[51]?.objective.id, 17);
  assert.equal(presentation.rows[51]?.reward.text, 'reward: 7500 coins');
});

test('high profile scales fonts and resource-derived offsets without substituting assets', () => {
  const { presentation } = createFixture(0, [], '720x1280', HIGH_VIEWPORT);
  const row = presentation.rows[0]!;

  assert.deepEqual(row.background.position, { x: 360, y: 955 });
  assert.equal(row.description.fontPointSize, Math.fround(32.4));
  assert.equal(row.reward.fontPointSize, 36);
  assert.equal(
    row.description.position.x,
    Math.fround(Math.fround(360) - Math.fround(563 / Math.fround(3.5))),
  );
  assert.equal(row.description.position.y, 985.5);
  assert.equal(row.reward.position.x, 289.625);
  assert.equal(row.reward.position.y, 924.5);
  assert.equal(
    row.background.resource.canonicalPath,
    '720x1280/Objectives/objectives-inactive.png',
  );
  assert.deepEqual(presentation.fixedCurrent.background.position, {
    x: 360,
    y: Math.fround(float32FromBits(0x3e19_999a) * Math.fround(1280)),
  });
});

test('Back and Skip ingress actions retain compact/high initial and final formulas', () => {
  const compact = createFixture().presentation.menu;
  const backDelta = Math.fround(float32FromBits(0x3f86_6666) * 144);
  assert.deepEqual(compact.back.initialPosition, {
    x: -72,
    y: Math.fround(124 / Math.fround(2.5)),
  });
  assert.deepEqual(compact.back.actions, [
    {
      deltaDegrees: 360,
      durationSeconds: 1,
      easing: null,
      type: 'rotate-by',
    },
    {
      delta: { x: backDelta, y: 0 },
      durationSeconds: 1,
      easing: null,
      type: 'move-by',
    },
  ]);
  assert.equal(compact.back.actionsRunConcurrently, true);
  assert.deepEqual(compact.back.finalPosition, {
    x: Math.fround(-72 + backDelta),
    y: Math.fround(124 / Math.fround(2.5)),
  });
  assert.deepEqual(compact.skip.initialPosition, { x: 554.5, y: 40 });
  assert.deepEqual(compact.skip.finalPosition, { x: 368.25, y: 40 });
  assert.deepEqual(compact.skip.actions, [{
    durationSeconds: 1,
    easing: null,
    target: { x: 368.25, y: 40 },
    type: 'move-to',
  }]);
  assert.equal(compact.skip.actionsRunConcurrently, false);

  const high = createFixture(0, [], '720x1280', HIGH_VIEWPORT).presentation.menu;
  assert.deepEqual(high.back.initialPosition, { x: -90, y: 60 });
  assert.deepEqual(high.skip.initialPosition, { x: 814.5, y: 64 });
  assert.deepEqual(high.skip.finalPosition, { x: 578.25, y: 64 });
  assert.equal(high.back.resources.normal.dimensions.width, 180);
  assert.equal(high.back.resources.selected.dimensions.width, 181);
  assert.equal(high.back.layoutUsesNormalFrameSize, true);
});

test('visible Back and Skip request gated click audio while hardware Back stays silent', () => {
  const { presentation } = createFixture();

  assert.deepEqual(presentation.audio, {
    hardwareBack: {
      audioRequested: false,
      delegatesToVisibleBackNavigation: true,
    },
    skip: {
      audioRequested: true,
      canonicalPath: 'Sounds/menubuttonclick.wav',
      effectsGated: true,
      loop: false,
      timing: 'before-manager-skip',
    },
    visibleBack: {
      audioRequested: true,
      canonicalPath: 'Sounds/menubuttonclick.wav',
      effectsGated: true,
      loop: false,
      timing: 'before-navigation',
    },
  });
  assert.deepEqual(
    presentation.navigation.visibleBack,
    OBJECTIVES_SCREEN_BACK_NAVIGATION_STEPS,
  );
  assert.equal(
    presentation.navigation.hardwareBack,
    presentation.navigation.visibleBack,
  );
  assert.deepEqual(presentation.interaction, {
    drag: {
      clamp: false,
      inertia: false,
      movementFormula: 'movementY = -deltaY',
      snap: false,
    },
    skip: {
      preservesLabelColors: true,
      preservesRowPositions: true,
      refreshesFixedCurrentText: true,
      refreshesRowBackgroundCompletion: true,
      target: 'authoritative-active-objective',
    },
  });
});

test('post-Skip presentation refreshes texture/card while preserving construction colors and ys', () => {
  const fixture = createFixture(8);
  fixture.state.drag(-303.75);
  const before = fixture.state.snapshot;
  fixture.state.skipActiveObjective();
  const after = createObjectivesScreenPresentation(
    '480x800',
    COMPACT_VIEWPORT,
    fixture.state.snapshot,
  );

  assert.equal(fixture.manager.lastSkipped, 50);
  assert.equal(after.fixedCurrent.objective.id, 10);
  assert.equal(after.fixedCurrent.reward.text, 'reward: 695 coins');
  assert.equal(
    after.rows[8]?.background.resource.canonicalPath,
    '480x800/Objectives/objectives-active.png',
  );
  assert.deepEqual(
    after.rows[8]?.description.colorRgb,
    OBJECTIVES_SCREEN_UNFINISHED_DESCRIPTION_COLOR,
  );
  assert.deepEqual(
    after.rows.map(({ background }) => background.position.y),
    before.rows.map(({ y }) => y),
  );
});

test('presentation validates viewport and exact state closure without mutating inputs', () => {
  const fixture = createFixture();
  const validState = fixture.state.snapshot;
  for (const viewport of [
    null,
    [],
    { ...COMPACT_VIEWPORT, logicalWidth: 0 },
    { ...COMPACT_VIEWPORT, logicalHeight: Number.NaN },
    { ...COMPACT_VIEWPORT, extra: true },
    {
      ...COMPACT_VIEWPORT,
      visibleRect: {
        ...COMPACT_VIEWPORT.visibleRect,
        left: { x: 480, y: 400 },
      },
    },
  ]) {
    assert.throws(() => createObjectivesScreenPresentation(
      '480x800',
      viewport as never,
      validState,
    ));
  }

  const plain = structuredClone(validState) as ObjectivesScreenStateSnapshot;
  const wrongMetrics = {
    ...plain,
    listMetrics: { ...plain.listMetrics, rowSpacing: 1 },
  };
  assert.throws(
    () => createObjectivesScreenPresentation(
      '480x800',
      COMPACT_VIEWPORT,
      wrongMetrics,
    ),
    /must match/,
  );

  const missingRow = {
    ...plain,
    rows: plain.rows.slice(0, 51),
  };
  assert.throws(
    () => createObjectivesScreenPresentation(
      '480x800',
      COMPACT_VIEWPORT,
      missingRow,
    ),
    /exactly 52/,
  );

  const malformedRows = structuredClone(plain.rows) as Array<
    typeof plain.rows[number]
  >;
  malformedRows[0] = {
    ...malformedRows[0]!,
    objective: {
      ...malformedRows[0]!.objective,
      description: 'invented',
    },
  };
  assert.throws(
    () => createObjectivesScreenPresentation(
      '480x800',
      COMPACT_VIEWPORT,
      { ...plain, rows: malformedRows },
    ),
    /must match recovered/,
  );

  assert.doesNotThrow(() => createObjectivesScreenPresentation(
    '480x800',
    COMPACT_VIEWPORT,
    validState,
  ));
});

test('presentation domain stays Creator-free and does not invent clipping or motion', () => {
  const source = readFileSync(new URL(
    '../../../game/assets/scripts/domain/objectives-screen-presentation.ts',
    import.meta.url,
  ), 'utf8');

  assert.doesNotMatch(source, /from\s+['"]cc['"]/);
  assert.doesNotMatch(source, /\b(snap-to|inertia-action|mask-node|clip-node)\b/);
  assert.match(source, /mask: false as const/);
  assert.match(source, /scissor: false as const/);
  assert.match(source, /stencil: false as const/);
});

function createFixture(
  current = 8,
  finished: readonly ObjectiveId[] = [],
  assetTree: '480x800' | '720x1280' = '480x800',
  viewport: ObjectivesScreenViewport = COMPACT_VIEWPORT,
) {
  const manager = new Manager(current, finished);
  const state = new ObjectivesScreenState({
    listMetrics: createObjectivesScreenListMetrics(assetTree, viewport),
    manager,
  });
  const presentation = createObjectivesScreenPresentation(
    assetTree,
    viewport,
    state.snapshot,
  );
  return { manager, presentation, state };
}

function float32FromBits(bits: number): number {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, bits, true);
  return new DataView(buffer).getFloat32(0, true);
}

function assertDeepFrozen(
  value: unknown,
  seen: Set<object> = new Set(),
): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return;
  }
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) {
    assertDeepFrozen(child, seen);
  }
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
