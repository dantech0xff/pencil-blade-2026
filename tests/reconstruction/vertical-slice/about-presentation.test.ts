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
  ABOUT_GESTURES_DEFAULT_Z_ORDER,
  ABOUT_INFERRED_CENTER_ANCHOR,
  ABOUT_MENU_ITEM_ORDER,
  ABOUT_REVIEW_PULSE_APEX_SCALE,
  ABOUT_REVIEW_PULSE_CYCLE_SECONDS,
  ABOUT_REVIEW_PULSE_LEG_SECONDS,
  ABOUT_REVIEW_PULSE_PLAN,
  ABOUT_ROOT_ORDER,
  ABOUT_ROOT_Z_ORDER,
  ABOUT_VISIBLE_DRAW_ORDER,
  createAboutHeartEmissionPlan,
  createAboutPresentation,
  createAboutReviewHeartEmissionTimes,
} = await import(
  '../../../game/assets/scripts/domain/about-presentation.ts'
);

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

test('presentation preserves exact zero-origin menu layout and visible draw order', () => {
  const viewport = compactViewport();
  const presentation = createAboutPresentation(
    '480x800',
    viewport,
    { localCompatibilityAvailable: false, rated: false },
  );

  assert.deepEqual(presentation.background.position, { x: 240, y: 400 });
  assert.equal(
    presentation.background.resource.canonicalPath,
    '480x800/Backgrounds/aboutbackground.png',
  );
  assert.deepEqual(presentation.background.anchor, ABOUT_INFERRED_CENTER_ANCHOR);
  assert.equal(presentation.background.attachmentInsertion, 1);
  assert.equal(presentation.background.zOrder, ABOUT_ROOT_Z_ORDER);
  assert.deepEqual(presentation.background.entryActions, []);

  assert.deepEqual(presentation.menu.position, { x: 0, y: 0 });
  assert.equal(presentation.menu.attachmentInsertion, 2);
  assert.equal(presentation.menu.zOrder, ABOUT_ROOT_Z_ORDER);
  assert.deepEqual(presentation.menu.itemOrder, [
    'menu',
    'review',
    'email',
    'like',
  ]);
  assert.equal(presentation.menu.itemOrder, ABOUT_MENU_ITEM_ORDER);

  assert.deepEqual(controlSummary(presentation.menu.menu), {
    insertionIndex: 0,
    normal: '480x800/Buttons/button-menu-normal.png',
    position: { x: 240, y: 80 },
    purpose: 'menu',
    selected: '480x800/Buttons/button-menu-selected.png',
  });
  assert.deepEqual(controlSummary(presentation.menu.review), {
    insertionIndex: 1,
    normal: '480x800/Buttons/button-review-normal.png',
    position: { x: 72, y: 80 },
    purpose: 'review',
    selected: '480x800/Buttons/button-review-selected.png',
  });
  assert.deepEqual(controlSummary(presentation.menu.email), {
    insertionIndex: 2,
    normal: '480x800/Buttons/button-email-normal.png',
    position: { x: 408, y: 80 },
    purpose: 'email',
    selected: '480x800/Buttons/button-email-selected.png',
  });
  assert.deepEqual(controlSummary(presentation.menu.like), {
    insertionIndex: 3,
    normal: '480x800/Buttons/button-like-normal.png',
    position: { x: 360, y: Math.fround(Math.fround(800) * Math.fround(0.335)) },
    purpose: 'like',
    selected: '480x800/Buttons/button-like-selected.png',
  });
  for (const control of [
    presentation.menu.menu,
    presentation.menu.review,
    presentation.menu.email,
    presentation.menu.like,
  ]) {
    assert.deepEqual(control.anchor, ABOUT_INFERRED_CENTER_ANCHOR);
    assert.deepEqual(control.entryActions, []);
    assert.deepEqual(control.inferredInitialScale, { x: 1, y: 1 });
  }

  assert.deepEqual(ABOUT_ROOT_ORDER, [
    {
      attachmentInsertion: 1,
      key: 'background',
      visible: true,
      zOrder: 1,
    },
    {
      attachmentInsertion: 2,
      key: 'menu',
      visible: true,
      zOrder: 1,
    },
    {
      attachmentInsertion: 3,
      key: 'gestures',
      visible: false,
      zOrder: 0,
    },
  ]);
  assert.equal(ABOUT_GESTURES_DEFAULT_Z_ORDER, 0);
  assert.deepEqual(ABOUT_VISIBLE_DRAW_ORDER, [
    'background',
    'menu',
    'emitted-heart',
  ]);
  assert.equal(presentation.rootOrder, ABOUT_ROOT_ORDER);
  assert.equal(presentation.visibleDrawOrder, ABOUT_VISIBLE_DRAW_ORDER);
  assert.equal(
    presentation.heartResource.canonicalPath,
    '480x800/Interfaces/heart.png',
  );
  assertDeepFrozen(presentation);
});

test('layout uses raw logical W/H while background uses visible center', () => {
  const viewport = {
    logicalHeight: 1280,
    logicalWidth: 720,
    visibleRect: {
      bottom: { x: 41, y: -7 },
      center: { x: 401, y: 633 },
      left: { x: 41, y: 633 },
      right: { x: 761, y: 633 },
      top: { x: 401, y: 1273 },
    },
  };
  const presentation = createAboutPresentation(
    '720x1280',
    viewport,
    { localCompatibilityAvailable: false, rated: true },
  );

  assert.deepEqual(presentation.background.position, { x: 401, y: 633 });
  assert.deepEqual(presentation.menu.menu.position, {
    x: f32Multiply(720, 0.5),
    y: f32Multiply(1280, 0.1),
  });
  assert.deepEqual(presentation.menu.review.position, {
    x: f32Multiply(720, 0.15),
    y: f32Multiply(1280, 0.1),
  });
  assert.deepEqual(presentation.menu.email.position, {
    x: f32Multiply(720, 0.85),
    y: f32Multiply(1280, 0.1),
  });
  assert.deepEqual(presentation.menu.like.position, {
    x: f32Multiply(720, 0.75),
    y: f32Multiply(1280, 0.335),
  });

  viewport.logicalWidth = 1;
  viewport.visibleRect.center.x = 1;
  assert.equal(presentation.viewport.logicalWidth, 720);
  assert.deepEqual(presentation.background.position, { x: 401, y: 633 });
});

test('review pulse eligibility is explicit local state with no live or external request', () => {
  for (const [
    localCompatibilityAvailable,
    rated,
    expectedEligible,
  ] of [
    [false, false, false],
    [false, true, false],
    [true, true, false],
    [true, false, true],
  ] as const) {
    const presentation = createAboutPresentation(
      '480x800',
      compactViewport(),
      { localCompatibilityAvailable, rated },
    );
    assert.deepEqual(presentation.reviewPulseEligibility, {
      eligible: expectedEligible,
      externalActionRequested: false,
      liveConnectivityRequested: false,
      localCompatibilityAvailable,
      rated,
      source: 'local-compatibility-snapshot',
    });
    assert.equal(
      presentation.reviewPulsePlan,
      expectedEligible ? ABOUT_REVIEW_PULSE_PLAN : null,
    );
  }
});

test('eligible review pulse preserves both exact float32 legs and emission points', () => {
  assert.equal(ABOUT_REVIEW_PULSE_LEG_SECONDS, Math.fround(0.45));
  assert.equal(ABOUT_REVIEW_PULSE_CYCLE_SECONDS, Math.fround(0.9));
  assert.equal(ABOUT_REVIEW_PULSE_APEX_SCALE, Math.fround(1.15));
  assert.deepEqual(ABOUT_REVIEW_PULSE_PLAN, {
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
      {
        durationSeconds: Math.fround(0.45),
        scaleX: 1,
        scaleY: 1,
        type: 'scale-to',
      },
      { callback: 'add-heart', type: 'invoke-callback' },
    ],
  });
  assert.deepEqual(createAboutReviewHeartEmissionTimes(0), []);
  assert.deepEqual(createAboutReviewHeartEmissionTimes(2), [
    Math.fround(0.45),
    Math.fround(0.9),
    f32Add(Math.fround(0.9), Math.fround(0.45)),
    f32Add(Math.fround(0.9), Math.fround(0.9)),
  ]);
  assert.throws(
    () => createAboutReviewHeartEmissionTimes(-1),
    RangeError,
  );
  assertDeepFrozen(ABOUT_REVIEW_PULSE_PLAN);
});

test('one heart uses five ordered draws and the authoritative 0.05H y lower bound', () => {
  const calls: Array<
    | readonly ['decile']
    | readonly ['inclusive', number, number]
  > = [];
  let inclusiveIndex = 0;
  let decileIndex = 0;
  const inclusiveResults: number[] = [48, 40, 200];
  const decileResults: number[] = [0.8, 0.3];
  const random = {
    nextIntInclusive(minimumInclusive: number, maximumInclusive: number): number {
      calls.push(['inclusive', minimumInclusive, maximumInclusive]);
      return inclusiveResults[inclusiveIndex++] ?? minimumInclusive;
    },
    nextDecile(): number {
      calls.push(['decile']);
      return decileResults[decileIndex++] ?? 0;
    },
  };

  const plan = createAboutHeartEmissionPlan(
    '480x800',
    compactViewport(),
    random,
  );
  assert.deepEqual(calls, [
    ['inclusive', 48, 96],
    ['inclusive', 40, 120],
    ['decile'],
    ['decile'],
    ['inclusive', 80, 200],
  ]);
  assert.deepEqual(plan.position, { x: 48, y: 40 });
  assert.equal(plan.rise, 200);
  assert.equal(plan.scale, f32Add(f32Multiply(0.8, 0.5), 0.5));
  assert.equal(plan.durationSeconds, f32Add(0.3, 1));
  assert.equal(plan.resourceCanonicalPath, '480x800/Interfaces/heart.png');
  assert.equal(plan.zOrder, 1);
  assert.equal(plan.actionsRunConcurrently, true);
  assert.equal(plan.actionsStartBeforeRootAttachment, true);
  assert.equal(plan.perHeartCleanupAction, false);
  assert.equal(plan.finalState, 'invisible-retained-child');
  assert.equal(plan.seedParityClaimed, false);
  assert.deepEqual(plan.actions, [
    { durationSeconds: f32Add(0.3, 1), type: 'fade-out' },
    {
      delta: { x: 0, y: 200 },
      durationSeconds: f32Add(0.3, 1),
      type: 'move-by',
    },
  ]);
  assert.deepEqual(
    plan.randomDraws.map(({ name, value }) => ({ name, value })),
    [
      { name: 'x', value: 48 },
      { name: 'y', value: 40 },
      { name: 'qScale', value: 0.8 },
      { name: 'qDuration', value: 0.3 },
      { name: 'rise', value: 200 },
    ],
  );
  assertDeepFrozen(plan);
});

test('high profile heart bounds retain inclusive truncation and 0.05H minimum', () => {
  const calls: Array<readonly [number, number]> = [];
  const plan = createAboutHeartEmissionPlan(
    '720x1280',
    highViewport(),
    {
      nextIntInclusive(minimumInclusive, maximumInclusive) {
        calls.push([minimumInclusive, maximumInclusive]);
        return minimumInclusive;
      },
      nextDecile() {
        return 0;
      },
    },
  );
  assert.deepEqual(calls, [
    [72, 144],
    [64, 192],
    [128, 320],
  ]);
  assert.deepEqual(plan.position, { x: 72, y: 64 });
  assert.equal(plan.scale, 0.5);
  assert.equal(plan.durationSeconds, 1);
});

test('presentation validates local inputs and random outputs without hidden fallbacks', () => {
  assert.throws(
    () => createAboutPresentation(
      '480x800',
      { ...compactViewport(), logicalWidth: 0 },
      { localCompatibilityAvailable: false, rated: false },
    ),
    /logicalWidth must be positive/,
  );
  assert.throws(
    () => createAboutPresentation(
      '480x800',
      compactViewport(),
      { localCompatibilityAvailable: 1 as never, rated: false },
    ),
    /boolean localCompatibilityAvailable and rated/,
  );
  assert.throws(
    () => createAboutHeartEmissionPlan(
      '480x800',
      compactViewport(),
      {
        nextIntInclusive() {
          return Number.NaN;
        },
        nextDecile() {
          return 0;
        },
      },
    ),
    /safe integer/,
  );
  assert.throws(
    () => createAboutHeartEmissionPlan(
      '480x800',
      compactViewport(),
      {
        nextIntInclusive(minimumInclusive) {
          return minimumInclusive;
        },
        nextDecile() {
          return 0.25;
        },
      },
    ),
    /0.0 through 0.9 in tenths/,
  );
});

test('About foundation contains no live service or platform bridge', () => {
  const runtimeSources = [
    'game/assets/scripts/domain/about-resource-contract.ts',
    'game/assets/scripts/domain/about-presentation.ts',
    'game/assets/scripts/creator/about-resource-loader.ts',
  ].map((path) => readFileSync(`${REPOSITORY_ROOT}${path}`, 'utf8')).join('\n');

  assert.doesNotMatch(runtimeSources, /\bfetch\s*\(/);
  assert.doesNotMatch(runtimeSources, /\bXMLHttpRequest\b/);
  assert.doesNotMatch(runtimeSources, /\bJniHelper\b/i);
  assert.doesNotMatch(runtimeSources, /\bopenURL\b/i);
  assert.doesNotMatch(runtimeSources, /\bmarket:\/\//i);
  assert.doesNotMatch(runtimeSources, /\bhttps?:\/\//i);
  assert.doesNotMatch(runtimeSources, /\b(?:advert|analytics)\b/i);
});

function compactViewport() {
  return {
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
}

function highViewport() {
  return {
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
}

function controlSummary(control: {
  readonly insertionIndex: number;
  readonly position: Readonly<{ readonly x: number; readonly y: number }>;
  readonly purpose: string;
  readonly resources: {
    readonly normal: { readonly canonicalPath: string };
    readonly selected: { readonly canonicalPath: string };
  };
}) {
  return {
    insertionIndex: control.insertionIndex,
    normal: control.resources.normal.canonicalPath,
    position: control.position,
    purpose: control.purpose,
    selected: control.resources.selected.canonicalPath,
  };
}

function f32Add(left: number, right: number): number {
  return Math.fround(Math.fround(left) + Math.fround(right));
}

function f32Multiply(left: number, right: number): number {
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
