import type { ClassicAssetTree } from './resolution-profile-service';

export const OBJECTIVES_SCREEN_RASTER_RESOURCE_COUNT = 10 as const;
export const OBJECTIVES_SCREEN_SHARED_RESOURCE_COUNT = 2 as const;
export const OBJECTIVES_SCREEN_TOTAL_RESOURCE_COUNT = 12 as const;

export const OBJECTIVES_SCREEN_FONT_CANONICAL_PATH = 'Fonts/Arial.ttf' as const;
export const OBJECTIVES_SCREEN_MENU_BUTTON_AUDIO_CANONICAL_PATH
  = 'Sounds/menubuttonclick.wav' as const;
export const OBJECTIVES_SCREEN_BACK_AUDIO_CANONICAL_PATH
  = OBJECTIVES_SCREEN_MENU_BUTTON_AUDIO_CANONICAL_PATH;
export const OBJECTIVES_SCREEN_SKIP_AUDIO_CANONICAL_PATH
  = OBJECTIVES_SCREEN_MENU_BUTTON_AUDIO_CANONICAL_PATH;

export type ObjectivesScreenRasterConsumerClassification =
  | 'attached-visible'
  | 'unattached-probe-and-attached-visible';

export interface ObjectivesScreenRasterResource {
  readonly bytes: number;
  readonly canonicalPath: string;
  readonly consumerClassification: ObjectivesScreenRasterConsumerClassification;
  readonly dimensions: Readonly<{
    readonly height: number;
    readonly width: number;
  }>;
  readonly hasUnattachedProbeInstance: boolean;
  readonly sha256: string;
}

export interface ObjectivesScreenSharedFileResource {
  readonly bytes: number;
  readonly canonicalPath: string;
  readonly kind: 'audio' | 'font';
  readonly sha256: string;
}

export interface ObjectivesScreenTwoFrameRasterSet {
  readonly normal: ObjectivesScreenRasterResource;
  readonly selected: ObjectivesScreenRasterResource;
}

export interface ObjectivesScreenOrdinaryRowRasterSet {
  readonly finished: ObjectivesScreenRasterResource;
  readonly unfinished: ObjectivesScreenRasterResource;
}

export interface ObjectivesScreenRasterProfile {
  readonly back: ObjectivesScreenTwoFrameRasterSet;
  readonly background: ObjectivesScreenRasterResource;
  readonly fixedCurrentRow: ObjectivesScreenRasterResource;
  readonly footer: ObjectivesScreenRasterResource;
  readonly header: ObjectivesScreenRasterResource;
  readonly ordinaryRows: ObjectivesScreenOrdinaryRowRasterSet;
  readonly skip: ObjectivesScreenTwoFrameRasterSet;
}

interface ObjectivesScreenRasterIdentity {
  readonly bytes: readonly [number, number];
  readonly classification: ObjectivesScreenRasterConsumerClassification;
  readonly dimensions: readonly [
    readonly [number, number],
    readonly [number, number],
  ];
  readonly sha256: readonly [string, string];
}

const OBJECTIVES_SCREEN_RASTER_IDENTITIES = {
  'Objectives/button-skip-selected.png': {
    bytes: [4_035, 7_056],
    classification: 'attached-visible',
    dimensions: [[149, 110], [189, 129]],
    sha256: [
      '4a24cf6a0db35c8d5114f3e5d5e69bb95bdb33afaca9554c797950ef77c39df2',
      '8c411809d1f3ae4c219bf4113bb7f4935e23e42982778953232fd235017ab2ed',
    ],
  },
  'Objectives/button-skip.png': {
    bytes: [6_284, 11_510],
    classification: 'attached-visible',
    dimensions: [[149, 110], [189, 129]],
    sha256: [
      'de05d83e008a1b8d7eb8ab99d2309741fe9145ae5e658e3b8d25bf023d4c111f',
      '071e74023f0004e9473db1d059e300055960b90eb31bb71d09136d5889b3a5a3',
    ],
  },
  'Objectives/objectives-active.png': {
    bytes: [6_430, 11_070],
    classification: 'attached-visible',
    dimensions: [[375, 81], [563, 122]],
    sha256: [
      '1d8431889001d991834046ae2ed32d644e883f32361acc0d3ededf27c1bd8a3c',
      '61b86b3011c6bfb0638dd61351e601cd94031feea2fa5c0d4a1c0c75b1f8adfd',
    ],
  },
  'Objectives/objectives-background.png': {
    bytes: [4_907, 8_235],
    classification: 'attached-visible',
    dimensions: [[496, 872], [752, 1352]],
    sha256: [
      '91df698b7f6c27cfc3b4b221596c20302ea28f98aa96896787a848a8d5f87dd6',
      '08eac19740445e86c5cd5214c97ef4d040653a0b833b652692441c5da75f6a22',
    ],
  },
  'Objectives/objectives-inactive.png': {
    bytes: [4_535, 7_624],
    classification: 'attached-visible',
    dimensions: [[375, 81], [563, 122]],
    sha256: [
      'f4dd59d8e1ab3390a0a27abc81e4dfd6fafef299dbf914f0eafd361c86bc7e89',
      '5d5038952e6b367eaa3676ceaa8ec8e1b4bcca27e20d8256e64ef30a6132d495',
    ],
  },
  'Objectives/objectives-next-background.png': {
    bytes: [9_415, 17_008],
    classification: 'unattached-probe-and-attached-visible',
    dimensions: [[420, 240], [672, 384]],
    sha256: [
      '82e4aaaed62fb74018efb45e386593db603083abfb365663f5c39f46d10668e9',
      '14583a400588fc509e43bc00c821bfc4118f3760442acd3cbb3cced454a83d2b',
    ],
  },
  'Objectives/objectives-next.png': {
    bytes: [4_732, 7_772],
    classification: 'unattached-probe-and-attached-visible',
    dimensions: [[375, 81], [563, 122]],
    sha256: [
      '5160323b9aee164aa5f2052f3b1ada8f6af7a8165823a97173dbc1fcb13a3a90',
      '190cf0426687217ded8dc79847e3b8ee380ea3c6936c34b59caebf620a6ae798',
    ],
  },
  'Objectives/objectives-objectives-background.png': {
    bytes: [13_534, 23_926],
    classification: 'unattached-probe-and-attached-visible',
    dimensions: [[420, 150], [672, 240]],
    sha256: [
      '3defe3ebf50d68c62612e7e77096d704c086a69cd37fd6efdad75ea8648a741d',
      '0ff94e730b8854d0c499afcf18d4ba1911621b2fd582c8a10630cd1143899c5e',
    ],
  },
  'Buttons/button-blue-back-normal.png': {
    bytes: [7_691, 12_033],
    classification: 'attached-visible',
    dimensions: [[144, 124], [180, 150]],
    sha256: [
      'a978ec6a5f7ee20f54c077bd13f94177e233dbb9cded18af239896e4a87066ef',
      '451a19fde28ef07ce3df1991ab2adfb24e65a19279c0e59860ec5c6a67a9dbec',
    ],
  },
  'Buttons/button-back-selected.png': {
    bytes: [6_304, 9_445],
    classification: 'attached-visible',
    dimensions: [[144, 124], [181, 150]],
    sha256: [
      '15afb10b1f0c49731a30ae9c1e1b1def410c55b4f9101e95b8ff6d4b190a8641',
      '1b2bffab9db409a92ad97b8fae0a9d866fc6baaf49698e3ab97a38d5826d26ab',
    ],
  },
} as const satisfies Readonly<Record<string, ObjectivesScreenRasterIdentity>>;

type ObjectivesScreenRasterLogicalPath =
  keyof typeof OBJECTIVES_SCREEN_RASTER_IDENTITIES;

export const OBJECTIVES_SCREEN_RASTER_LOGICAL_PATHS = Object.freeze(
  Object.keys(OBJECTIVES_SCREEN_RASTER_IDENTITIES),
) as readonly ObjectivesScreenRasterLogicalPath[];

export const OBJECTIVES_SCREEN_UNATTACHED_PROBE_LOGICAL_PATHS = Object.freeze([
  'Objectives/objectives-next-background.png',
  'Objectives/objectives-next.png',
  'Objectives/objectives-objectives-background.png',
] as const);

export const OBJECTIVES_SCREEN_SHARED_RESOURCES = deepFreeze({
  font: {
    bytes: 755_624,
    canonicalPath: OBJECTIVES_SCREEN_FONT_CANONICAL_PATH,
    kind: 'font' as const,
    sha256: 'b97a1e2bb9fedbf9aa99f6b14ef5a7f057c6611dd71698381cc44f77797a4223',
  },
  menuButtonClick: {
    bytes: 32_812,
    canonicalPath: OBJECTIVES_SCREEN_MENU_BUTTON_AUDIO_CANONICAL_PATH,
    kind: 'audio' as const,
    sha256: '3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e',
  },
}) satisfies Readonly<Record<string, ObjectivesScreenSharedFileResource>>;

export const OBJECTIVES_SCREEN_RASTER_RESOURCES:
Readonly<Record<ClassicAssetTree, ObjectivesScreenRasterProfile>> = deepFreeze({
  '480x800': createRasterProfile('480x800'),
  '720x1280': createRasterProfile('720x1280'),
});

export function getObjectivesScreenRasterResources(
  assetTree: ClassicAssetTree,
): ObjectivesScreenRasterProfile {
  assertAssetTree(assetTree);
  return OBJECTIVES_SCREEN_RASTER_RESOURCES[assetTree];
}

export function collectObjectivesScreenRasterResources(
  assetTree: ClassicAssetTree,
): readonly ObjectivesScreenRasterResource[] {
  const profile = getObjectivesScreenRasterResources(assetTree);
  return Object.freeze([
    profile.skip.selected,
    profile.skip.normal,
    profile.ordinaryRows.finished,
    profile.background,
    profile.ordinaryRows.unfinished,
    profile.footer,
    profile.fixedCurrentRow,
    profile.header,
    profile.back.normal,
    profile.back.selected,
  ]);
}

function createRasterProfile(tree: ClassicAssetTree): ObjectivesScreenRasterProfile {
  return {
    back: {
      normal: raster(tree, 'Buttons/button-blue-back-normal.png'),
      selected: raster(tree, 'Buttons/button-back-selected.png'),
    },
    background: raster(tree, 'Objectives/objectives-background.png'),
    fixedCurrentRow: raster(tree, 'Objectives/objectives-next.png'),
    footer: raster(tree, 'Objectives/objectives-next-background.png'),
    header: raster(tree, 'Objectives/objectives-objectives-background.png'),
    ordinaryRows: {
      finished: raster(tree, 'Objectives/objectives-active.png'),
      unfinished: raster(tree, 'Objectives/objectives-inactive.png'),
    },
    skip: {
      normal: raster(tree, 'Objectives/button-skip.png'),
      selected: raster(tree, 'Objectives/button-skip-selected.png'),
    },
  };
}

function raster(
  tree: ClassicAssetTree,
  logicalPath: ObjectivesScreenRasterLogicalPath,
): ObjectivesScreenRasterResource {
  const treeIndex = tree === '480x800' ? 0 : 1;
  const identity = OBJECTIVES_SCREEN_RASTER_IDENTITIES[logicalPath];
  const [width, height] = identity.dimensions[treeIndex];
  return {
    bytes: identity.bytes[treeIndex],
    canonicalPath: `${tree}/${logicalPath}`,
    consumerClassification: identity.classification,
    dimensions: { height, width },
    hasUnattachedProbeInstance:
      identity.classification === 'unattached-probe-and-attached-visible',
    sha256: identity.sha256[treeIndex],
  };
}

function assertAssetTree(assetTree: string): asserts assetTree is ClassicAssetTree {
  if (assetTree !== '480x800' && assetTree !== '720x1280') {
    throw new RangeError('assetTree must be 480x800 or 720x1280');
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
