import type { ClassicAssetTree } from './resolution-profile-service';

export const ABOUT_RASTER_RESOURCE_COUNT = 10 as const;
export const ABOUT_SHARED_RESOURCE_COUNT = 1 as const;
export const ABOUT_TOTAL_RESOURCE_COUNT = 11 as const;

export const ABOUT_MENU_BUTTON_AUDIO_CANONICAL_PATH
  = 'Sounds/menubuttonclick.wav' as const;
export const ABOUT_BACK_AUDIO_CANONICAL_PATH
  = ABOUT_MENU_BUTTON_AUDIO_CANONICAL_PATH;

export interface AboutRasterResource {
  readonly bytes: number;
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{
    readonly height: number;
    readonly width: number;
  }>;
  readonly sha256: string;
}

export interface AboutSharedFileResource {
  readonly bytes: number;
  readonly canonicalPath: string;
  readonly kind: 'audio';
  readonly sha256: string;
}

export interface AboutTwoFrameRasterSet {
  readonly normal: AboutRasterResource;
  readonly selected: AboutRasterResource;
}

export interface AboutRasterProfile {
  readonly background: AboutRasterResource;
  readonly menu: AboutTwoFrameRasterSet;
  readonly review: AboutTwoFrameRasterSet;
  readonly email: AboutTwoFrameRasterSet;
  readonly like: AboutTwoFrameRasterSet;
  readonly heart: AboutRasterResource;
}

interface AboutRasterIdentity {
  readonly bytes: readonly [number, number];
  readonly dimensions: readonly [
    readonly [number, number],
    readonly [number, number],
  ];
  readonly sha256: readonly [string, string];
}

const ABOUT_RASTER_IDENTITIES = {
  'Backgrounds/aboutbackground.png': {
    bytes: [500_401, 589_728],
    dimensions: [[481, 801], [721, 1281]],
    sha256: [
      '584698d06da37717f7273d8a84cb022e991596b086c3e9dda2344cb7894c47b1',
      'eacf6a7f6ec933d09a7c0ff3afb171b91181e476a6a3cd02d273ff34c776c9ab',
    ],
  },
  'Buttons/button-menu-normal.png': {
    bytes: [7_747, 12_700],
    dimensions: [[91, 87], [137, 129]],
    sha256: [
      '243d2e150e62898c09a6ba77c89d61ed3968f9ea54ce90e90f27d04c5c5c6c93',
      'abac9c8686c9ea40064ab07fdbe14caa5b6bcea8bc9146a4c2723a70a7fddf96',
    ],
  },
  'Buttons/button-menu-selected.png': {
    bytes: [7_503, 12_383],
    dimensions: [[91, 87], [137, 129]],
    sha256: [
      'ea26ea4b7fe9b3aa81724d9e00fd13b9c4b587fc9b61c881ae66d14e77d4a8db',
      '6ab583b99d119ad69efb2c2e7d990f154996d3863ba53b8298a1ea1e79793558',
    ],
  },
  'Buttons/button-review-normal.png': {
    bytes: [12_734, 24_496],
    dimensions: [[105, 96], [156, 142]],
    sha256: [
      'd78957b90a4f09f2866addaba19a7361d4b225f64c974cef6d4782aa9dc4c7c4',
      'c292b590a6442d86cf452204bb79b490321913a0aa7bbed59b46e3aa7a371704',
    ],
  },
  'Buttons/button-review-selected.png': {
    bytes: [13_331, 25_073],
    dimensions: [[105, 95], [156, 141]],
    sha256: [
      'ad839c70a4887165372824cfbfb2b0880fe1303288fdcde0cbd7cc62b7e3925e',
      '7127fa1b06e56c973e41dbbd975fc876e9839c1c6495937b2b1728f870d19d11',
    ],
  },
  'Buttons/button-email-normal.png': {
    bytes: [5_142, 7_977],
    dimensions: [[91, 65], [135, 97]],
    sha256: [
      'b753b91e7ffb9f0fb20f34ed1e9ac8bb11b2f39429e22dbdfc47dae999a2e989',
      'd27d3fc3bc97eb6f0175bf97d6b0564f26857cde30c447b2b1e9c2b45f6ae4c8',
    ],
  },
  'Buttons/button-email-selected.png': {
    bytes: [4_471, 7_062],
    dimensions: [[91, 65], [136, 97]],
    sha256: [
      '53ac04ac61e7c53d0b26c90b1c9eb87c0d7eb74a00600a85914b2b93660d1a05',
      'dc1b5c6ba627acddbc02a0e79ef4acaf9c534927120be467aaa002ffd3b537ba',
    ],
  },
  'Buttons/button-like-normal.png': {
    bytes: [4_086, 4_990],
    dimensions: [[134, 133], [166, 164]],
    sha256: [
      '7ee31e494f5adc6067ab8df6615901f08943a523794b1854e9bfaee359011e32',
      'fd63c38bf5afa5165287814646836f5d8d2f922477a4163b3f5c6428fb939dd5',
    ],
  },
  'Buttons/button-like-selected.png': {
    bytes: [3_940, 4_932],
    dimensions: [[134, 133], [166, 164]],
    sha256: [
      'f420810263ee555b5ad3b9310c9c280a42d1d73e715206e1f7d5526b63ad4496',
      'c6f8f86545317b318593b8150732f5b53edf22e32511a9d7704e83544ce69aa4',
    ],
  },
  'Interfaces/heart.png': {
    bytes: [1_450, 2_108],
    dimensions: [[30, 33], [44, 50]],
    sha256: [
      '0964ff4e27f16bd1563ea8740580e71e27d7cd342eaf3c75e0120594a485731f',
      '3329a1cde82e888e06fbb497579cc7dea391b56d4da322868698291665702254',
    ],
  },
} as const satisfies Readonly<Record<string, AboutRasterIdentity>>;

export type AboutRasterLogicalPath = keyof typeof ABOUT_RASTER_IDENTITIES;

export const ABOUT_RASTER_LOGICAL_PATHS = Object.freeze(
  Object.keys(ABOUT_RASTER_IDENTITIES),
) as readonly AboutRasterLogicalPath[];

/** Staged evidence that is deliberately outside the recovered Android closure. */
export const ABOUT_EXCLUDED_ANDROID_LOGICAL_PATHS = Object.freeze([
  'Backgrounds/aboutbackground-ios.png',
] as const);

export const ABOUT_SHARED_RESOURCES = deepFreeze({
  menuButtonClick: {
    bytes: 32_812,
    canonicalPath: ABOUT_MENU_BUTTON_AUDIO_CANONICAL_PATH,
    kind: 'audio' as const,
    sha256: '3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e',
  },
}) satisfies Readonly<Record<string, AboutSharedFileResource>>;

export const ABOUT_RASTER_RESOURCES:
Readonly<Record<ClassicAssetTree, AboutRasterProfile>> = deepFreeze({
  '480x800': createRasterProfile('480x800'),
  '720x1280': createRasterProfile('720x1280'),
});

export function getAboutRasterResources(
  assetTree: ClassicAssetTree,
): AboutRasterProfile {
  assertAssetTree(assetTree);
  return ABOUT_RASTER_RESOURCES[assetTree];
}

export function collectAboutRasterResources(
  assetTree: ClassicAssetTree,
): readonly AboutRasterResource[] {
  const profile = getAboutRasterResources(assetTree);
  return Object.freeze([
    profile.background,
    profile.menu.normal,
    profile.menu.selected,
    profile.review.normal,
    profile.review.selected,
    profile.email.normal,
    profile.email.selected,
    profile.like.normal,
    profile.like.selected,
    profile.heart,
  ]);
}

function createRasterProfile(tree: ClassicAssetTree): AboutRasterProfile {
  return {
    background: raster(tree, 'Backgrounds/aboutbackground.png'),
    menu: {
      normal: raster(tree, 'Buttons/button-menu-normal.png'),
      selected: raster(tree, 'Buttons/button-menu-selected.png'),
    },
    review: {
      normal: raster(tree, 'Buttons/button-review-normal.png'),
      selected: raster(tree, 'Buttons/button-review-selected.png'),
    },
    email: {
      normal: raster(tree, 'Buttons/button-email-normal.png'),
      selected: raster(tree, 'Buttons/button-email-selected.png'),
    },
    like: {
      normal: raster(tree, 'Buttons/button-like-normal.png'),
      selected: raster(tree, 'Buttons/button-like-selected.png'),
    },
    heart: raster(tree, 'Interfaces/heart.png'),
  };
}

function raster(
  tree: ClassicAssetTree,
  logicalPath: AboutRasterLogicalPath,
): AboutRasterResource {
  const treeIndex = tree === '480x800' ? 0 : 1;
  const identity = ABOUT_RASTER_IDENTITIES[logicalPath];
  const [width, height] = identity.dimensions[treeIndex];
  return {
    bytes: identity.bytes[treeIndex],
    canonicalPath: `${tree}/${logicalPath}`,
    dimensions: { height, width },
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
