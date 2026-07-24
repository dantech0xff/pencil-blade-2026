import type { ClassicAssetTree } from './resolution-profile-service';

export const LOADING_RASTER_RESOURCE_COUNT = 4 as const;
export const LOADING_AUDIO_PRELOAD_COUNT = 62 as const;
export const LOADING_BACKGROUND_MUSIC_PRELOAD_COUNT = 3 as const;
export const LOADING_EFFECT_PRELOAD_COUNT = 59 as const;

export interface LoadingRasterResource {
  readonly bytes: number;
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{
    readonly height: number;
    readonly width: number;
  }>;
  readonly sha256: string;
}

export interface LoadingRasterProfile {
  readonly backgroundLogo: LoadingRasterResource;
  readonly barBack: LoadingRasterResource;
  readonly barFront: LoadingRasterResource;
  readonly progress: LoadingRasterResource;
}

export interface LoadingAudioPreloadStep {
  readonly canonicalPath: string;
  readonly index: number;
  readonly kind: 'background-music' | 'effect';
}

interface LoadingRasterIdentity {
  readonly bytes: readonly [number, number];
  readonly dimensions: readonly [
    readonly [number, number],
    readonly [number, number],
  ];
  readonly sha256: readonly [string, string];
}

const LOADING_RASTER_IDENTITIES = {
  'Loading/backgroundLogo.png': {
    bytes: [269_888, 379_058],
    dimensions: [[480, 800], [775, 1280]],
    sha256: [
      'f87874212a211ee638456720078ea53584568a7ea4f9649bc27f345909e26d8f',
      '849003087172b8448318a991a6db94656213edb64d429980033bbd643350d0c2',
    ],
  },
  'Loading/loadbkback.png': {
    bytes: [509, 702],
    dimensions: [[193, 24], [275, 35]],
    sha256: [
      'c04709d69caab20c7b50961c61d47b100ba837826b9b258467ee79265fe7588b',
      'e622f620535e7f610dfade3836283847ecf1754ce45e4f53a7a85bca638a26b0',
    ],
  },
  'Loading/loadbkfront.png': {
    bytes: [975, 1_330],
    dimensions: [[197, 28], [281, 40]],
    sha256: [
      'e23aef27163f179c8a873e74a1791446e28bfcf8edd4b214d56e1e2f4575295e',
      'bd56ca543c9b9851bfc4f7f4c3ce569054b53e29be6afde44e040655b754262d',
    ],
  },
  'Loading/loadprocess.png': {
    bytes: [2_214, 2_207],
    dimensions: [[185, 20], [265, 27]],
    sha256: [
      'a1fba149efa7bc89f5ebabdc6078d10c44caae1d375d6de75363dddc9eedf068',
      '1b31334589e44850ba36eaa81642c5061212d5fd4b12bfe295e515128b04add9',
    ],
  },
} as const satisfies Readonly<Record<string, LoadingRasterIdentity>>;

export type LoadingRasterLogicalPath = keyof typeof LOADING_RASTER_IDENTITIES;

const LOADING_AUDIO_CANONICAL_PATHS = Object.freeze([
  'Sounds/electric.mp3',
  'Sounds/GangnamStyle.mp3',
  'Sounds/mainmenumusic.mp3',
  'Sounds/apple.wav',
  'Sounds/banana.wav',
  'Sounds/boomexplosion.wav',
  'Sounds/boomhit.wav',
  'Sounds/boomsound.wav',
  'Sounds/boomtoss.wav',
  'Sounds/cheer.wav',
  'Sounds/compo1.wav',
  'Sounds/compo2.wav',
  'Sounds/compo3.wav',
  'Sounds/critical.wav',
  'Sounds/doublepoint.wav',
  'Sounds/doubletoss.wav',
  'Sounds/doubletosstrum.wav',
  'Sounds/eapplecut.wav',
  'Sounds/ehit1.wav',
  'Sounds/ehit2.wav',
  'Sounds/ehit3.wav',
  'Sounds/ehit4.wav',
  'Sounds/electricexplose.wav',
  'Sounds/finishhitmusic.wav',
  'Sounds/firstplace.wav',
  'Sounds/freeze.wav',
  'Sounds/fruitfail.wav',
  'Sounds/gameplayselected.wav',
  'Sounds/get_coins.wav',
  'Sounds/hitmusic.wav',
  'Sounds/juice1.wav',
  'Sounds/juice2.wav',
  'Sounds/juice4.wav',
  'Sounds/kiwi.wav',
  'Sounds/lightning1.wav',
  'Sounds/lightning2.wav',
  'Sounds/magnet.wav',
  'Sounds/mangosteen.wav',
  'Sounds/juice3.wav',
  'Sounds/waterfruit.wav',
  'Sounds/menubuttonclick.wav',
  'Sounds/mono1.wav',
  'Sounds/mono2.wav',
  'Sounds/orange.wav',
  'Sounds/pineapple.wav',
  'Sounds/powerup.wav',
  'Sounds/scorescreen.wav',
  'Sounds/secondplace.wav',
  'Sounds/strawberry.wav',
  'Sounds/swoosh1.wav',
  'Sounds/swoosh2.wav',
  'Sounds/swoosh3.wav',
  'Sounds/swoosh4.wav',
  'Sounds/swoosh5.wav',
  'Sounds/swoosh6.wav',
  'Sounds/swoosh7.wav',
  'Sounds/swoosh8.wav',
  'Sounds/swoosh9.wav',
  'Sounds/thirdplace.wav',
  'Sounds/timetick.wav',
  'Sounds/timeup.wav',
  'Sounds/tossfruit.wav',
] as const);

export const LOADING_AUDIO_PRELOAD_STEPS: readonly LoadingAudioPreloadStep[]
  = Object.freeze(LOADING_AUDIO_CANONICAL_PATHS.map((canonicalPath, index) => (
    Object.freeze({
      canonicalPath,
      index,
      kind: index < LOADING_BACKGROUND_MUSIC_PRELOAD_COUNT
        ? 'background-music' as const
        : 'effect' as const,
    })
  )));

export const LOADING_RASTER_RESOURCES:
Readonly<Record<ClassicAssetTree, LoadingRasterProfile>> = deepFreeze({
  '480x800': createRasterProfile('480x800'),
  '720x1280': createRasterProfile('720x1280'),
});

export function getLoadingRasterResources(
  assetTree: ClassicAssetTree,
): LoadingRasterProfile {
  assertAssetTree(assetTree);
  return LOADING_RASTER_RESOURCES[assetTree];
}

export function collectLoadingRasterResources(
  assetTree: ClassicAssetTree,
): readonly LoadingRasterResource[] {
  const profile = getLoadingRasterResources(assetTree);
  return Object.freeze([
    profile.backgroundLogo,
    profile.barBack,
    profile.progress,
    profile.barFront,
  ]);
}

function createRasterProfile(assetTree: ClassicAssetTree): LoadingRasterProfile {
  return {
    backgroundLogo: raster(assetTree, 'Loading/backgroundLogo.png'),
    barBack: raster(assetTree, 'Loading/loadbkback.png'),
    barFront: raster(assetTree, 'Loading/loadbkfront.png'),
    progress: raster(assetTree, 'Loading/loadprocess.png'),
  };
}

function raster(
  assetTree: ClassicAssetTree,
  logicalPath: LoadingRasterLogicalPath,
): LoadingRasterResource {
  const treeIndex = assetTree === '480x800' ? 0 : 1;
  const identity = LOADING_RASTER_IDENTITIES[logicalPath];
  const [width, height] = identity.dimensions[treeIndex];
  return {
    bytes: identity.bytes[treeIndex],
    canonicalPath: `${assetTree}/${logicalPath}`,
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
