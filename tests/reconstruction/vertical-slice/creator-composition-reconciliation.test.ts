import assert from 'node:assert/strict';
import {
  readdirSync,
  readFileSync,
  type Dirent,
} from 'node:fs';
import { extname, join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CREATOR_SOURCE_ROOT = 'game/assets/scripts/creator';

interface SerializedReference {
  readonly __id__: number;
}

interface SerializedObject {
  readonly __prefab?: unknown;
  readonly __type__?: string;
  readonly _active?: boolean;
  readonly _cameraComponent?: SerializedReference;
  readonly _children?: readonly SerializedReference[];
  readonly _components?: readonly SerializedReference[];
  readonly _enabled?: boolean;
  readonly _globals?: SerializedReference;
  readonly _name?: string;
  readonly _parent?: SerializedReference | null;
  readonly _prefab?: unknown;
  readonly ambient?: SerializedReference;
  readonly fog?: SerializedReference;
  readonly lightProbeInfo?: SerializedReference;
  readonly node?: SerializedReference;
  readonly octree?: SerializedReference;
  readonly postSettings?: SerializedReference;
  readonly scene?: SerializedReference;
  readonly shadows?: SerializedReference;
  readonly skin?: SerializedReference;
  readonly _skybox?: SerializedReference;
}

const SERIALIZED_COMPONENTS = [
  ['blade-input-controller.ts', '0fd52094-0ba7-4726-81ee-6417bdaed41d'],
  ['classic-scene-controller.ts', 'a32bc59c-ff50-4bfc-925e-f003572c7353'],
  ['classic-gameplay-controller.ts', '52b0f78c-6c03-4699-8bf4-bec5f208cbd7'],
  ['crazy-scene-controller.ts', 'ef2acde6-c3cc-4322-9541-7e6d11eb91fe'],
  ['crazy-gameplay-controller.ts', '3972394d-83f5-4afb-a873-3e73ee46db31'],
  ['bird-input-controller.ts', '321b2bf5-f4c0-44b9-9dde-c73adfcf7fc5'],
  ['classic-bird-scene-controller.ts', 'f474c5df-6006-482a-b41b-e1734d743c73'],
  ['classic-bird-gameplay-controller.ts', '2f96ac8b-934a-4c4c-8386-6c3a114f2a9c'],
  ['combo-bird-scene-controller.ts', '663d307f-fbf0-4445-80e7-2e88c9300d20'],
  ['combo-bird-gameplay-controller.ts', 'cb0501db-193e-47c9-b59d-77327ddbda57'],
  ['gn-style-scene-controller.ts', '7334546e-ceae-4335-aba7-ddaa5400dc3d'],
  ['gn-style-gameplay-controller.ts', '6e631977-fe83-490f-9e39-19ec634a4084'],
  ['recovered-app-shell-controller.ts', '12e4ed82-ce3b-48cd-adb5-203b103d61f6'],
] as const;

const DIRECT_NODE_CONSTRUCTION_FILES_BY_SURFACE = {
  shellScreens: [
    'about-presenter.ts',
    'detached-screen-root.ts',
    'leaderboard-presenter.ts',
    'loading-presenter.ts',
    'main-menu-presenter.ts',
    'mode-select-presenter.ts',
    'objectives-screen-presenter.ts',
    'options-presenter.ts',
  ],
  sharedShell: [
    'shared-background-presenter.ts',
    'shared-leaf-presenter.ts',
    'shared-theme-presenter.ts',
  ],
  menuEffects: [
    'main-menu-cut-half-presenter.ts',
    'main-menu-fruit-presenter.ts',
    'mode-select-cut-half-presenter.ts',
    'mode-select-rope-button-presenter.ts',
    'options-item-selector-presenter.ts',
    'options-purchase-particle-presenter.ts',
  ],
  pauseAndObjectives: [
    'base-gameplay-pause-presenter.ts',
    'objective-achievement-host.ts',
    'objective-achievement-presenter.ts',
  ],
  classicRuntime: [
    'classic-audio-presenter.ts',
    'classic-blade-presenter.ts',
    'classic-critical-particle-presenter.ts',
    'classic-cut-half-presenter.ts',
    'classic-fail-presenter.ts',
    'classic-gameplay-controller.ts',
    'classic-generated-bomb.ts',
    'classic-generated-fruit.ts',
    'classic-result-particle-explosion-presenter.ts',
    'classic-result-presenter.ts',
    'classic-result-reward-presenter.ts',
    'classic-score-hud-presenter.ts',
    'combo-item-presenter.ts',
  ],
  crazyRuntime: [
    'crazy-audio-presenter.ts',
    'crazy-bomb-electric-presenter.ts',
    'crazy-electric-contact-adapter.ts',
    'crazy-gameplay-controller.ts',
    'crazy-generated-dragon-fruit.ts',
    'crazy-generated-special-fruit.ts',
    'crazy-intro-presenter.ts',
    'crazy-magnet-presenter.ts',
  ],
  birdRuntime: [
    'bird-blade-presenter.ts',
    'classic-bird-gameplay-controller.ts',
    'classic-bird-word-presenter.ts',
    'combo-bird-gameplay-controller.ts',
    'combo-bird-intro-presenter.ts',
  ],
  gnStyleRuntime: [
    'gn-style-background-music-presenter.ts',
    'gn-style-gameplay-controller.ts',
    'gn-style-intro-presenter.ts',
    'gn-style-particle-presenter.ts',
  ],
  standardEffects: [
    'standard-advanced-blade-presenter.ts',
    'standard-blade-particle-presenter.ts',
    'standard-bomb-explosion-presenter.ts',
    'standard-bomb-fuse-smoke-presenter.ts',
  ],
  timedRuntime: [
    'time-manager-audio-presenter.ts',
    'time-manager-presenter.ts',
  ],
} as const;

test('the single Creator scene serializes the exact persistent controller composition', () => {
  const scene = readJson<SerializedObject[]>('game/assets/scenes/classic.scene');
  assert.equal(scene.length, 30);
  assert.deepEqual(scene.map((entry) => entry.__type__), [
    'cc.SceneAsset',
    'cc.Scene',
    'cc.Node',
    'cc.Node',
    'cc.Camera',
    'cc.UITransform',
    'cc.Canvas',
    'cc.Widget',
    ...SERIALIZED_COMPONENTS.slice(0, 10).map(([, uuid]) => compressCreatorUuid(uuid)),
    compressCreatorUuid(SERIALIZED_COMPONENTS[12][1]),
    compressCreatorUuid(SERIALIZED_COMPONENTS[10][1]),
    compressCreatorUuid(SERIALIZED_COMPONENTS[11][1]),
    'cc.SceneGlobals',
    'cc.AmbientInfo',
    'cc.ShadowsInfo',
    'cc.SkyboxInfo',
    'cc.FogInfo',
    'cc.OctreeInfo',
    'cc.SkinInfo',
    'cc.LightProbeInfo',
    'cc.PostSettingsInfo',
  ]);

  const sceneAsset = scene[0];
  const sceneRoot = scene[1];
  const canvas = scene[2];
  const cameraNode = scene[3];
  assert.deepEqual(sceneAsset?.scene, { __id__: 1 });
  assert.equal(sceneRoot?._active, true);
  assert.equal(sceneRoot?._parent, null);
  assert.deepEqual(sceneRoot?._children, [{ __id__: 2 }]);
  assert.deepEqual(sceneRoot?._components, []);
  assert.equal(sceneRoot?._prefab, null);
  assert.deepEqual(sceneRoot?._globals, { __id__: 21 });

  assert.equal(canvas?._name, 'Canvas');
  assert.equal(canvas?._active, true);
  assert.deepEqual(canvas?._parent, { __id__: 1 });
  assert.deepEqual(canvas?._children, [{ __id__: 3 }]);
  assert.deepEqual(
    canvas?._components?.map(({ __id__ }) => __id__),
    [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 18],
  );
  assert.equal(canvas?._prefab, null);

  assert.equal(cameraNode?._name, 'Camera');
  assert.equal(cameraNode?._active, true);
  assert.deepEqual(cameraNode?._parent, { __id__: 2 });
  assert.deepEqual(cameraNode?._children, []);
  assert.deepEqual(cameraNode?._components, [{ __id__: 4 }]);
  assert.equal(cameraNode?._prefab, null);

  for (let index = 4; index <= 20; index += 1) {
    const component = scene[index];
    assert.deepEqual(
      component?.node,
      { __id__: index === 4 ? 3 : 2 },
      `component ${index} changed its serialized node owner`,
    );
    assert.equal(component?._enabled, true, `component ${index} must remain enabled`);
    assert.ok(
      component !== undefined && Object.hasOwn(component, '__prefab'),
      `component ${index} lost its serialized prefab sentinel`,
    );
    assert.equal(component?.__prefab, null, `component ${index} gained a prefab reference`);
  }
  assert.deepEqual(scene[6]?._cameraComponent, { __id__: 4 });

  const globals = scene[21];
  assert.deepEqual({
    ambient: globals?.ambient,
    shadows: globals?.shadows,
    skybox: globals?._skybox,
    fog: globals?.fog,
    octree: globals?.octree,
    skin: globals?.skin,
    lightProbeInfo: globals?.lightProbeInfo,
    postSettings: globals?.postSettings,
  }, {
    ambient: { __id__: 22 },
    shadows: { __id__: 23 },
    skybox: { __id__: 24 },
    fog: { __id__: 25 },
    octree: { __id__: 26 },
    skin: { __id__: 27 },
    lightProbeInfo: { __id__: 28 },
    postSettings: { __id__: 29 },
  });

  const serializedReferences = collectSerializedReferenceIds(scene);
  assert.equal(serializedReferences.length, 49);
  assert.ok(
    serializedReferences.every((reference) => (
      Number.isInteger(reference)
      && reference >= 0
      && reference < scene.length
    )),
    'every serialized reference must resolve inside the 30-record scene',
  );

  const serializedScriptUuids = (canvas?._components ?? [])
    .map(({ __id__ }) => scene[__id__]?.__type__)
    .filter((type): type is string => typeof type === 'string' && type.length === 23)
    .map(decodeCreatorUuid);
  assert.deepEqual(
    serializedScriptUuids,
    SERIALIZED_COMPONENTS.map(([, uuid]) => uuid),
  );

  for (const [sourceFile, expectedUuid] of SERIALIZED_COMPONENTS) {
    const meta = readJson<{ imported: boolean; uuid: string }>(
      `${CREATOR_SOURCE_ROOT}/${sourceFile}.meta`,
    );
    assert.equal(meta.imported, true, `${sourceFile} must remain imported`);
    assert.equal(meta.uuid, expectedUuid, `${sourceFile} changed serialized identity`);
  }
});

test('all visual shell states and result surfaces have explicit root construction sites', () => {
  const shellSource = readText(`${CREATOR_SOURCE_ROOT}/recovered-app-shell-controller.ts`);
  const states = extractStringUnion(shellSource, 'RecoveredAppShellState');
  const visualRoots = [
    ['about', 'about-presenter.ts', 'AboutRoot'],
    ['booting', 'loading-presenter.ts', 'LoadingScene'],
    ['classic-bird', 'classic-bird-gameplay-controller.ts', 'ClassicBirdModeRoot'],
    ['classic', 'classic-gameplay-controller.ts', 'ClassicModeRoot'],
    ['combo-bird', 'combo-bird-gameplay-controller.ts', 'ComboBirdModeRoot'],
    ['crazy-bird', 'crazy-gameplay-controller.ts', 'CrazyBirdModeRoot'],
    ['crazy', 'crazy-gameplay-controller.ts', 'CrazyModeRoot'],
    ['gn-style', 'gn-style-gameplay-controller.ts', 'GnStyleModeRoot'],
    ['leaderboard', 'leaderboard-presenter.ts', 'LeaderboardRoot'],
    ['main-menu', 'main-menu-presenter.ts', 'MainMenuRoot'],
    ['mode-select', 'mode-select-presenter.ts', 'ModeSelectRoot'],
    ['objectives', 'objectives-screen-presenter.ts', 'ObjectivesRoot'],
    ['options', 'options-presenter.ts', 'OptionsRoot'],
  ] as const;

  assert.deepEqual(
    [...states].sort(),
    [...visualRoots.map(([state]) => state), 'destroyed', 'failed'].sort(),
  );
  for (const [, sourceFile, rootName] of visualRoots) {
    assertRootConstructionSite(
      `${CREATOR_SOURCE_ROOT}/${sourceFile}`,
      rootName,
    );
  }

  const resultRoots = [
    ['classic-gameplay-controller.ts', 'ClassicResultPresentationRoot'],
    ['crazy-gameplay-controller.ts', 'CrazyResultPresentationRoot'],
    ['classic-bird-gameplay-controller.ts', 'ClassicBirdResultPresentationRoot'],
    ['combo-bird-gameplay-controller.ts', 'ComboBirdResultPresentationRoot'],
    ['gn-style-gameplay-controller.ts', 'GnStyleResultPresentationRoot'],
  ] as const;
  for (const [sourceFile, rootName] of resultRoots) {
    assertRootConstructionSite(
      `${CREATOR_SOURCE_ROOT}/${sourceFile}`,
      rootName,
    );
  }
});

test('every file with direct Node construction is assigned to a recovered surface family', () => {
  const expectedConstructionFiles = Object.values(
    DIRECT_NODE_CONSTRUCTION_FILES_BY_SURFACE,
  ).flat();
  assert.equal(
    new Set(expectedConstructionFiles).size,
    expectedConstructionFiles.length,
  );

  const actualConstructionFiles = walkFiles(resolvePath(CREATOR_SOURCE_ROOT))
    .filter((path) => path.endsWith('.ts'))
    .filter((path) => {
      const source = readText(path);
      return source.includes('new Node(') || source.includes('createDetachedScreenRoot(');
    })
    .map((path) => relative(resolvePath(CREATOR_SOURCE_ROOT), resolvePath(path)))
    .sort();

  assert.deepEqual(
    actualConstructionFiles,
    [...expectedConstructionFiles].sort(),
  );
});

test('all six game modes own the recovered BaseGameplay pause surface', () => {
  const modeControllers = [
    ['classic-gameplay-controller.ts', 'CLASSIC_PAUSE_QUIT_REQUESTED_EVENT'],
    ['crazy-gameplay-controller.ts', 'CRAZY_PAUSE_QUIT_REQUESTED_EVENT'],
    ['crazy-gameplay-controller.ts', 'CRAZY_BIRD_PAUSE_QUIT_REQUESTED_EVENT'],
    ['classic-bird-gameplay-controller.ts', 'CLASSIC_BIRD_PAUSE_QUIT_REQUESTED_EVENT'],
    ['combo-bird-gameplay-controller.ts', 'COMBO_BIRD_PAUSE_QUIT_REQUESTED_EVENT'],
    ['gn-style-gameplay-controller.ts', 'GN_STYLE_PAUSE_QUIT_REQUESTED_EVENT'],
  ] as const;

  for (const [sourceFile, quitEvent] of modeControllers) {
    const relativePath = `${CREATOR_SOURCE_ROOT}/${sourceFile}`;
    assertSourceIncludes(relativePath, 'BaseGameplayPausePresenter');
    assertSourceIncludes(relativePath, quitEvent);
  }

  const pauseSource = readText(
    `${CREATOR_SOURCE_ROOT}/base-gameplay-pause-presenter.ts`,
  );
  for (const nodeName of [
    'BaseGameplayPauseOverlay',
    'BaseGameplayPauseMenu',
    'BaseGameplayPauseOptionsMenu',
    'BaseGameplayPauseResumeButton',
    'BaseGameplayPauseReplayButton',
    'BaseGameplayPauseQuitButton',
  ]) {
    assert.ok(pauseSource.includes(`'${nodeName}'`), `pause surface lost ${nodeName}`);
  }
});

test('missing prefab and authoring artifact types are intentional runtime substitutes', () => {
  const assetFiles = walkFiles(resolvePath('game/assets'))
    .filter((path) => !path.endsWith('.meta'));
  const extensionCensus: Record<string, number> = {};
  for (const path of assetFiles) {
    const extension = extname(path).slice(1).toLowerCase();
    extensionCensus[extension] = (extensionCensus[extension] ?? 0) + 1;
  }
  assert.deepEqual(extensionCensus, {
    mp3: 3,
    otf: 1,
    png: 784,
    scene: 1,
    ts: 209,
    ttf: 15,
    wav: 59,
  });

  const absentAuthoringExtensions = [
    'anim',
    'animation',
    'atlas',
    'effect',
    'material',
    'pac',
    'plist',
    'prefab',
    'spriteatlas',
  ];
  for (const extension of absentAuthoringExtensions) {
    assert.equal(extensionCensus[extension] ?? 0, 0);
  }
  assert.equal(extensionCensus.json ?? 0, 0);

  assertSourceIncludes(`${CREATOR_SOURCE_ROOT}/detached-screen-root.ts`, 'new Node(name)');
  assertSourceIncludes(
    `${CREATOR_SOURCE_ROOT}/classic-blade-presenter.ts`,
    "effectName: 'builtin-unlit'",
  );
  assertSourceIncludes(
    `${CREATOR_SOURCE_ROOT}/bird-blade-presenter.ts`,
    "effectName: 'builtin-unlit'",
  );
  const smokeSource = readText(
    `${CREATOR_SOURCE_ROOT}/standard-bomb-fuse-smoke-presenter.ts`,
  );
  assert.ok(smokeSource.includes('new SpriteFrame'));
  assert.ok(smokeSource.includes('new Rect'));
  assertSourceIncludes(
    `${CREATOR_SOURCE_ROOT}/main-menu-presenter.ts`,
    'updateAction(deltaSeconds)',
  );
  assertSourceIncludes(`${CREATOR_SOURCE_ROOT}/classic-gameplay-controller.ts`, 'tween(');
});

function resolvePath(relativePath: string): string {
  return join(REPOSITORY_ROOT, relativePath);
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

function readText(relativePath: string): string {
  return readFileSync(resolvePath(relativePath), 'utf8');
}

function collectSerializedReferenceIds(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectSerializedReferenceIds);
  }
  if (value === null || typeof value !== 'object') {
    return [];
  }
  const record = value as Record<string, unknown>;
  const ownReference = (
    Number.isInteger(record.__id__)
      ? [record.__id__ as number]
      : []
  );
  return [
    ...ownReference,
    ...Object.entries(record)
      .filter(([key]) => key !== '__id__')
      .flatMap(([, nestedValue]) => collectSerializedReferenceIds(nestedValue)),
  ];
}

function assertSourceIncludes(relativePath: string, token: string): void {
  assert.ok(readText(relativePath).includes(token), `${relativePath} must contain ${token}`);
}

function assertRootConstructionSite(relativePath: string, rootName: string): void {
  const source = readText(relativePath);
  const constructionStarts = [
    ...source.matchAll(/(?:createDetachedScreenRoot|new Node)\(/g),
  ].map((match) => match.index);
  assert.ok(
    constructionStarts.some((index) => (
      source.slice(index, index + 500).includes(`'${rootName}'`)
    )),
    `${relativePath} must construct ${rootName}`,
  );
}

function walkFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry: Dirent) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [relative(REPOSITORY_ROOT, path)];
  });
}

function extractStringUnion(source: string, typeName: string): Set<string> {
  const declarationStart = source.indexOf(`export type ${typeName} =`);
  assert.notEqual(declarationStart, -1);
  const declarationEnd = source.indexOf(';', declarationStart);
  assert.notEqual(declarationEnd, -1);
  return new Set(
    [...source.slice(declarationStart, declarationEnd).matchAll(/\|\s*'([^']+)'/g)]
      .map((match) => match[1] ?? ''),
  );
}

function decodeCreatorUuid(compressed: string): string {
  assert.equal(compressed.length, 23);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let hex = compressed.slice(0, 5);
  for (let index = 5; index < compressed.length; index += 2) {
    const high = alphabet.indexOf(compressed[index] ?? '');
    const low = alphabet.indexOf(compressed[index + 1] ?? '');
    assert.notEqual(high, -1);
    assert.notEqual(low, -1);
    hex += ((high << 6) | low).toString(16).padStart(3, '0');
  }
  return formatUuid(hex);
}

function compressCreatorUuid(uuid: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const hex = uuid.replaceAll('-', '');
  assert.equal(hex.length, 32);
  let compressed = hex.slice(0, 5);
  for (let index = 5; index < hex.length; index += 3) {
    const value = Number.parseInt(hex.slice(index, index + 3), 16);
    compressed += alphabet[(value >> 6) & 63] ?? '';
    compressed += alphabet[value & 63] ?? '';
  }
  assert.equal(compressed.length, 23);
  return compressed;
}

function formatUuid(hex: string): string {
  assert.equal(hex.length, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
