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
  LEADERBOARD_BACK_ROTATION_DEGREES,
  LEADERBOARD_CARD_CHILD_ORDER,
  LEADERBOARD_ENTRY_SECONDS,
  LEADERBOARD_INFERRED_CENTER_ANCHOR,
  LEADERBOARD_PLAYER_COLORS,
  LEADERBOARD_PLAYER_LABEL_TEXTS,
  LEADERBOARD_ROOT_CHILD_ORDER,
  LEADERBOARD_SCORE_ANCHOR,
  LEADERBOARD_SCORE_COLORS,
  LEADERBOARD_SCORE_FORMAT,
  LEADERBOARD_TEMPLATE_CHILD_ORDER,
  LEADERBOARD_TITLE_ANCHOR,
  createLeaderboardPresentation,
} = await import(
  '../../../game/assets/scripts/domain/leaderboard-presentation.ts'
);
const {
  LeaderboardState,
} = await import('../../../game/assets/scripts/domain/leaderboard-state.ts');

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface Point {
  x: number;
  y: number;
}

interface Viewport {
  logicalHeight: number;
  logicalWidth: number;
  visibleRect: {
    bottom: Point;
    center: Point;
    left: Point;
    right: Point;
    top: Point;
  };
}

const COMPACT_VIEWPORT: Viewport = {
  logicalHeight: 800,
  logicalWidth: 480,
  visibleRect: {
    bottom: { x: 240, y: 0 },
    center: { x: 240, y: 400 },
    left: { x: 0, y: 400 },
    right: { x: 480, y: 400 },
    top: { x: 240, y: 800 },
  },
};

const HIGH_VIEWPORT: Viewport = {
  logicalHeight: 1280,
  logicalWidth: 720,
  visibleRect: {
    bottom: { x: 360, y: 0 },
    center: { x: 360, y: 640 },
    left: { x: 0, y: 640 },
    right: { x: 720, y: 640 },
    top: { x: 360, y: 1280 },
  },
};

const OFFSET_VIEWPORT: Viewport = {
  logicalHeight: 900,
  logicalWidth: 600,
  visibleRect: {
    bottom: { x: 280, y: 40 },
    center: { x: 280, y: 490 },
    left: { x: -20, y: 490 },
    right: { x: 580, y: 490 },
    top: { x: 280, y: 940 },
  },
};

test('snapshot preserves native root, card, and nested template child order', () => {
  const presentation = createPresentation('480x800', COMPACT_VIEWPORT);

  assert.equal(presentation.rootZOrder, 1);
  assert.equal(presentation.ownedRootOrder, LEADERBOARD_ROOT_CHILD_ORDER);
  assert.deepEqual(
    presentation.ownedRootOrder.map(({ child, insertion, zOrder }) => ({
      child,
      insertion,
      zOrder,
    })),
    [
      { child: 'gestures-layer', insertion: 1, zOrder: 0 },
      { child: 'title', insertion: 2, zOrder: 1 },
      { child: 'back-menu', insertion: 3, zOrder: 1 },
      { child: 'classic-card', insertion: 4, zOrder: 1 },
      { child: 'crazy-card', insertion: 5, zOrder: 1 },
      { child: 'gn-style-card', insertion: 6, zOrder: 1 },
      { child: 'classic-bird-card', insertion: 7, zOrder: 1 },
      { child: 'crazy-bird-card', insertion: 8, zOrder: 1 },
      { child: 'combo-bird-card', insertion: 9, zOrder: 1 },
    ],
  );
  assert.equal(presentation.cardChildOrder, LEADERBOARD_CARD_CHILD_ORDER);
  assert.deepEqual(presentation.cardChildOrder, [
    { child: 'template', insertion: 1, zOrder: 0 },
    { child: 'header', insertion: 2, zOrder: 0 },
  ]);
  assert.equal(presentation.templateChildOrder, LEADERBOARD_TEMPLATE_CHILD_ORDER);
  assert.deepEqual(presentation.templateChildOrder, [
    { child: 'player-1', insertion: 1, zOrder: 1 },
    { child: 'player-2', insertion: 2, zOrder: 1 },
    { child: 'player-3', insertion: 3, zOrder: 1 },
    { child: 'score-1', insertion: 4, zOrder: 1 },
    { child: 'score-2', insertion: 5, zOrder: 1 },
    { child: 'score-3', insertion: 6, zOrder: 1 },
  ]);

  for (const card of presentation.cards) {
    assert.equal(card.localChildOrder, LEADERBOARD_CARD_CHILD_ORDER);
    assert.equal(card.template.childOrder, LEADERBOARD_TEMPLATE_CHILD_ORDER);
    assert.equal('playerLabels' in card, false);
    assert.equal('scoreLabels' in card, false);
    assert.equal(card.template.playerLabels.length, 3);
    assert.equal(card.template.scoreLabels.length, 3);
  }
  assert.deepEqual(presentation.audio.back, {
    canonicalPath: 'Sounds/menubuttonclick.wav',
    effectsGated: true,
    loop: false,
    timing: 'after-main-menu-attachment',
  });
  assertDeepFrozen(presentation);
});

test('compact title and Back preserve exact one-second entrance actions', () => {
  const { shell } = createPresentation('480x800', COMPACT_VIEWPORT);

  assert.equal(LEADERBOARD_ENTRY_SECONDS, 1);
  assert.equal(LEADERBOARD_BACK_ROTATION_DEGREES, 360);
  assert.deepEqual(shell.title.anchor, LEADERBOARD_TITLE_ANCHOR);
  assert.deepEqual(shell.title.anchor, {
    evidence: 'recovered-setter',
    x: 0.5,
    y: 1,
  });
  assert.deepEqual(shell.title.initialPosition, { x: 240, y: 918 });
  assert.deepEqual(shell.title.finalPosition, { x: 240, y: 800 });
  assert.deepEqual(shell.title.actions, [{
    durationSeconds: 1,
    easing: null,
    target: { x: 240, y: 800 },
    type: 'move-to',
  }]);
  assert.equal(shell.title.actionsRunConcurrently, false);
  assert.equal(shell.title.fadeActionPresent, false);
  assert.equal(shell.title.rotationActionPresent, false);
  assert.equal(
    shell.title.resource.canonicalPath,
    '480x800/Leaderboard/leaderboard_title.png',
  );

  assert.deepEqual(shell.back.anchor, LEADERBOARD_INFERRED_CENTER_ANCHOR);
  assert.deepEqual(shell.back.initialPosition, { x: -72, y: 62 });
  assert.deepEqual(shell.back.finalPosition, { x: 72, y: 62 });
  assert.deepEqual(shell.back.menuPosition, { x: 0, y: 0 });
  assert.deepEqual(shell.back.actions, [
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
  assert.equal(shell.back.actionsRunConcurrently, true);
  assert.equal(shell.back.backKeyDelegatesToSameCallback, true);
  assert.equal(shell.back.disabledResource, null);
  assert.equal(shell.back.fadeActionPresent, false);
  assert.deepEqual({
    normal: shell.back.resources.normal.canonicalPath,
    selected: shell.back.resources.selected.canonicalPath,
  }, {
    normal: '480x800/Buttons/button-blue-back-normal.png',
    selected: '480x800/Buttons/button-back-selected.png',
  });
});

test('compact cards preserve root geometry, semantic resources, and template-local labels', () => {
  const presentation = createPresentation('480x800', COMPACT_VIEWPORT);
  assert.equal(presentation.cards.length, 6);
  assert.deepEqual(
    presentation.cards.map(({ index, modeId, rootPosition }) => ({
      index,
      modeId,
      rootPosition,
    })),
    [
      { index: 0, modeId: 'classic', rootPosition: { x: 240, y: 380 } },
      { index: 1, modeId: 'crazy', rootPosition: { x: 720, y: 380 } },
      { index: 2, modeId: 'gn-style', rootPosition: { x: 1200, y: 380 } },
      { index: 3, modeId: 'classic-bird', rootPosition: { x: 1680, y: 380 } },
      { index: 4, modeId: 'crazy-bird', rootPosition: { x: 2160, y: 380 } },
      { index: 5, modeId: 'combo-bird', rootPosition: { x: 2640, y: 380 } },
    ],
  );
  assert.deepEqual(
    presentation.cards.map(({ header }) => header.resource.canonicalPath),
    [
      '480x800/Leaderboard/leaderboard_classic.png',
      '480x800/Leaderboard/leaderboard_crazy.png',
      '480x800/Leaderboard/leaderboard_gnstyle.png',
      '480x800/Leaderboard/leaderboard_classic_bird.png',
      '480x800/Leaderboard/leaderboard_crazy_bird.png',
      '480x800/Leaderboard/leaderboard_combo_bird.png',
    ],
  );

  const classic = presentation.cards[0];
  assert.ok(classic);
  assert.deepEqual(classic.template.localPosition, { x: 0, y: 0 });
  assert.deepEqual(classic.template.anchor, LEADERBOARD_INFERRED_CENTER_ANCHOR);
  assert.equal(
    classic.template.resource.canonicalPath,
    '480x800/Leaderboard/leaderboard_view_templete.png',
  );
  assert.deepEqual(classic.header.localPosition, {
    x: 0,
    y: 317.9049987792969,
  });
  assert.deepEqual(classic.header.anchor, LEADERBOARD_INFERRED_CENTER_ANCHOR);
  assert.deepEqual(classic.template.entryActions, []);
  assert.deepEqual(classic.header.entryActions, []);

  assert.equal(classic.template.playerLabels.map(({ text }) => text).join('|'), (
    LEADERBOARD_PLAYER_LABEL_TEXTS.join('|')
  ));
  assert.deepEqual(
    classic.template.playerLabels.map((label) => ({
      anchor: label.anchor,
      attachmentInsertion: label.attachmentInsertion,
      colorRgb: label.colorRgb,
      font: label.fontCanonicalPath,
      pointSize: label.fontPointSize,
      position: label.localPosition,
      rank: label.rank,
      zOrder: label.zOrder,
    })),
    [
      {
        anchor: LEADERBOARD_INFERRED_CENTER_ANCHOR,
        attachmentInsertion: 1,
        colorRgb: { b: 0, g: 0, r: 255 },
        font: 'Fonts/Andyb.ttf',
        pointSize: 30,
        position: { x: 243, y: 498.1000061035156 },
        rank: 1,
        zOrder: 1,
      },
      {
        anchor: LEADERBOARD_INFERRED_CENTER_ANCHOR,
        attachmentInsertion: 2,
        colorRgb: { b: 255, g: 128, r: 0 },
        font: 'Fonts/Andyb.ttf',
        pointSize: 30,
        position: { x: 243, y: 322.3000183105469 },
        rank: 2,
        zOrder: 1,
      },
      {
        anchor: LEADERBOARD_INFERRED_CENTER_ANCHOR,
        attachmentInsertion: 3,
        colorRgb: { b: 0, g: 185, r: 0 },
        font: 'Fonts/Andyb.ttf',
        pointSize: 30,
        position: { x: 243, y: 161.15000915527344 },
        rank: 3,
        zOrder: 1,
      },
    ],
  );
  assert.equal(LEADERBOARD_SCORE_FORMAT, '%d');
  assert.deepEqual(
    classic.template.scoreLabels.map((label) => ({
      anchor: label.anchor,
      attachmentInsertion: label.attachmentInsertion,
      colorRgb: label.colorRgb,
      font: label.fontCanonicalPath,
      format: label.format,
      pointSize: label.fontPointSize,
      position: label.localPosition,
      rank: label.rank,
      text: label.text,
      value: label.value,
    })),
    [
      {
        anchor: LEADERBOARD_SCORE_ANCHOR,
        attachmentInsertion: 4,
        colorRgb: { b: 0, g: 0, r: 128 },
        font: 'Fonts/Century.ttf',
        format: '%d',
        pointSize: 40,
        position: { x: 243, y: 498.1000061035156 },
        rank: 1,
        text: '300',
        value: 300,
      },
      {
        anchor: LEADERBOARD_SCORE_ANCHOR,
        attachmentInsertion: 5,
        colorRgb: { b: 128, g: 56, r: 0 },
        font: 'Fonts/Century.ttf',
        format: '%d',
        pointSize: 40,
        position: { x: 243, y: 322.3000183105469 },
        rank: 2,
        text: '200',
        value: 200,
      },
      {
        anchor: LEADERBOARD_SCORE_ANCHOR,
        attachmentInsertion: 6,
        colorRgb: { b: 0, g: 28, r: 0 },
        font: 'Fonts/Century.ttf',
        format: '%d',
        pointSize: 40,
        position: { x: 243, y: 161.15000915527344 },
        rank: 3,
        text: '100',
        value: 100,
      },
    ],
  );
  assert.deepEqual(LEADERBOARD_PLAYER_COLORS, [
    { b: 0, g: 0, r: 255 },
    { b: 255, g: 128, r: 0 },
    { b: 0, g: 185, r: 0 },
  ]);
  assert.deepEqual(LEADERBOARD_SCORE_COLORS, [
    { b: 0, g: 0, r: 128 },
    { b: 128, g: 56, r: 0 },
    { b: 0, g: 28, r: 0 },
  ]);

  const gnStyleScores = presentation.cards[2]?.template.scoreLabels;
  assert.deepEqual(gnStyleScores?.map(({ text }) => text), [
    '2147483647',
    '0',
    '-2147483648',
  ]);
});

test('high profile keeps 137/138 headers, 180/181 Back frames, and float32 label scaling', () => {
  const presentation = createPresentation('720x1280', HIGH_VIEWPORT);

  assert.deepEqual(presentation.shell.title.initialPosition, { x: 360, y: 1439 });
  assert.deepEqual(presentation.shell.title.finalPosition, { x: 360, y: 1280 });
  assert.deepEqual(presentation.shell.back.initialPosition, { x: -90, y: 75 });
  assert.deepEqual(presentation.shell.back.finalPosition, { x: 90, y: 75 });
  assert.deepEqual(presentation.shell.back.resources.normal.dimensions, {
    height: 150,
    width: 180,
  });
  assert.deepEqual(presentation.shell.back.resources.selected.dimensions, {
    height: 150,
    width: 181,
  });
  assert.deepEqual(
    presentation.cards.map(({ rootPosition }) => rootPosition),
    [
      { x: 360, y: 608 },
      { x: 1080, y: 608 },
      { x: 1800, y: 608 },
      { x: 2520, y: 608 },
      { x: 3240, y: 608 },
      { x: 3960, y: 608 },
    ],
  );
  assert.deepEqual(
    presentation.cards.map(({ header }) => header.resource.dimensions.height),
    [137, 137, 138, 137, 138, 137],
  );
  assert.equal(
    presentation.cards.every(({ header }) => (
      header.localPosition.y === 457.8700256347656
    )),
    true,
  );

  const classic = presentation.cards[0];
  assert.ok(classic);
  assert.deepEqual(
    classic.template.playerLabels.map(({ fontPointSize, localPosition }) => ({
      fontPointSize,
      localPosition,
    })),
    [
      {
        fontPointSize: 45,
        localPosition: { x: 347.8499755859375, y: 717.4000244140625 },
      },
      {
        fontPointSize: 45,
        localPosition: { x: 347.8499755859375, y: 464.20001220703125 },
      },
      {
        fontPointSize: 45,
        localPosition: { x: 347.8499755859375, y: 232.10000610351562 },
      },
    ],
  );
  assert.equal(
    classic.template.scoreLabels.every(({ fontPointSize }) => fontPointSize === 60),
    true,
  );
});

test('offset VisibleRect affects only title/Back while raw W/H own cards and font sizes', () => {
  const presentation = createPresentation('480x800', OFFSET_VIEWPORT);

  assert.deepEqual(presentation.shell.title.initialPosition, { x: 280, y: 1058 });
  assert.deepEqual(presentation.shell.title.finalPosition, { x: 280, y: 940 });
  assert.deepEqual(presentation.shell.back.initialPosition, { x: -92, y: 102 });
  assert.deepEqual(presentation.shell.back.finalPosition, { x: 52, y: 102 });
  assert.deepEqual(
    presentation.cards.map(({ rootPosition }) => rootPosition.x),
    [300, 900, 1500, 2100, 2700, 3300],
  );
  assert.equal(presentation.cards.every(({ rootPosition }) => (
    rootPosition.y === 427.5
  )), true);
  assert.notEqual(presentation.cards[0]?.rootPosition.x, OFFSET_VIEWPORT.visibleRect.center.x);
  assert.equal(
    presentation.cards[0]?.template.playerLabels[0]?.fontPointSize,
    37.5,
  );
  assert.equal(
    presentation.cards[0]?.template.scoreLabels[0]?.fontPointSize,
    50,
  );
  assert.deepEqual(presentation.viewport, OFFSET_VIEWPORT);
});

test('snapshot defensively copies mutable boards and viewport before deep freezing', () => {
  const viewport = clone(COMPACT_VIEWPORT);
  const boards = clone(createBoardsSnapshot());
  const presentation = createLeaderboardPresentation(
    '480x800',
    viewport,
    boards as never,
  );

  viewport.logicalWidth = 1;
  viewport.visibleRect.top.y = -1;
  boards[0].values[0] = -999;
  boards[0].modeId = 'crazy';

  assert.equal(presentation.viewport.logicalWidth, 480);
  assert.equal(presentation.viewport.visibleRect.top.y, 800);
  assert.deepEqual(presentation.boards[0], {
    index: 0,
    modeId: 'classic',
    values: [300, 200, 100],
  });
  assert.deepEqual(
    presentation.cards[0]?.template.scoreLabels.map(({ text }) => text),
    ['300', '200', '100'],
  );
  assertDeepFrozen(presentation);
});

test('builder rejects malformed trees, viewports, board closure, mapping, and scores', () => {
  const boards = createBoardsSnapshot();
  assert.throws(
    () => createLeaderboardPresentation('phone' as never, COMPACT_VIEWPORT, boards),
    /480x800 or 720x1280/,
  );

  for (const malformedViewport of [
    null,
    [],
    { ...COMPACT_VIEWPORT, logicalWidth: 0 },
    { ...COMPACT_VIEWPORT, logicalWidth: Number.NaN },
    { ...COMPACT_VIEWPORT, logicalWidth: Number.MAX_VALUE },
    { ...COMPACT_VIEWPORT, logicalHeight: -1 },
    { ...COMPACT_VIEWPORT, visibleRect: null },
    {
      ...COMPACT_VIEWPORT,
      visibleRect: { ...COMPACT_VIEWPORT.visibleRect, top: { y: 800 } },
    },
    {
      ...COMPACT_VIEWPORT,
      visibleRect: {
        ...COMPACT_VIEWPORT.visibleRect,
        left: { x: Number.POSITIVE_INFINITY, y: 400 },
      },
    },
  ]) {
    assert.throws(
      () => createLeaderboardPresentation(
        '480x800',
        malformedViewport as never,
        boards,
      ),
    );
  }

  const malformedBoards: unknown[] = [
    null,
    [],
    clone(boards).slice(0, 5),
    (() => {
      const sparse = new Array(6);
      for (let index = 0; index < 6; index += 1) {
        if (index !== 3) sparse[index] = clone(boards[index]);
      }
      return sparse;
    })(),
    Object.assign(clone(boards), { extra: true }),
    cloneWith(boards, (value) => {
      delete value[0].modeId;
    }),
    cloneWith(boards, (value) => {
      value[0].extra = true;
    }),
    cloneWith(boards, (value) => {
      value[0].index = 1;
    }),
    cloneWith(boards, (value) => {
      value[0].modeId = 'crazy';
    }),
    cloneWith(boards, (value) => {
      value[0].values = [3, 2];
    }),
    cloneWith(boards, (value) => {
      const sparse = new Array(3);
      sparse[0] = 3;
      sparse[2] = 1;
      value[0].values = sparse;
    }),
    cloneWith(boards, (value) => {
      value[0].values = Object.assign([3, 2, 1], { extra: true });
    }),
    cloneWith(boards, (value) => {
      value[0].values = [3, 2.5, 1];
    }),
    cloneWith(boards, (value) => {
      value[0].values = [0x8000_0000, 2, 1];
    }),
    cloneWith(boards, (value) => {
      value[0].values = [1, 3, 2];
    }),
  ];
  for (const malformed of malformedBoards) {
    assert.throws(
      () => createLeaderboardPresentation(
        '480x800',
        COMPACT_VIEWPORT,
        malformed as never,
      ),
    );
  }
});

test('presentation metadata is valid and module stays local and pure', () => {
  const meta = readJson<{
    readonly files: readonly unknown[];
    readonly imported: boolean;
    readonly importer: string;
    readonly subMetas: Readonly<Record<string, unknown>>;
    readonly userData: Readonly<Record<string, unknown>>;
    readonly uuid: string;
    readonly ver: string;
  }>('game/assets/scripts/domain/leaderboard-presentation.ts.meta');
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

  const source = readText('game/assets/scripts/domain/leaderboard-presentation.ts');
  assert.doesNotMatch(source, /from ['"]cc['"]/);
  assert.doesNotMatch(source, /\b(?:assetManager|fetch|XMLHttpRequest)\b/);
  assert.doesNotMatch(source, /\b(?:apk|network|platform|placeholder)\b/i);
});

function createPresentation(
  assetTree: '480x800' | '720x1280',
  viewport: Viewport,
) {
  return createLeaderboardPresentation(
    assetTree,
    viewport,
    createBoardsSnapshot(),
  );
}

function createBoardsSnapshot() {
  return new LeaderboardState({
    boards: {
      classic: { first: 300, second: 200, third: 100 },
      crazy: { first: 0, second: 0, third: 0 },
      gnStyle: { first: 0x7fff_ffff, second: 0, third: -0x8000_0000 },
      classicBird: { first: 33, second: 22, third: 11 },
      crazyBird: { first: -1, second: -2, third: -3 },
      comboBird: { first: 999, second: 500, third: 50 },
    },
    logicalWidth: 480,
  }).snapshot.boards;
}

type MutableBoardArray = Array<{
  extra?: boolean;
  index: number;
  modeId: string;
  values: number[] & { extra?: boolean };
}>;

function cloneWith(
  boards: ReturnType<typeof createBoardsSnapshot>,
  mutate: (value: MutableBoardArray) => void,
): MutableBoardArray {
  const value = clone(boards) as MutableBoardArray;
  mutate(value);
  return value;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
