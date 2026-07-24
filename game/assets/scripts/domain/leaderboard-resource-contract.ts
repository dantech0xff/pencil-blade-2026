import type {
  ClassicRasterResource,
} from './classic-resource-contract';
import type { ClassicAssetTree } from './resolution-profile-service';

export const LEADERBOARD_RASTER_RESOURCE_COUNT = 10 as const;

export const LEADERBOARD_PLAYER_FONT_CANONICAL_PATH = 'Fonts/Andyb.ttf' as const;
export const LEADERBOARD_SCORE_FONT_CANONICAL_PATH = 'Fonts/Century.ttf' as const;
export const LEADERBOARD_MENU_BUTTON_AUDIO_CANONICAL_PATH
  = 'Sounds/menubuttonclick.wav' as const;
export const LEADERBOARD_BACK_AUDIO_CANONICAL_PATH
  = LEADERBOARD_MENU_BUTTON_AUDIO_CANONICAL_PATH;

export interface LeaderboardSharedFileResource {
  readonly bytes: number;
  readonly canonicalPath: string;
  readonly kind: 'audio' | 'font';
  readonly sha256: string;
}

export interface LeaderboardTwoFrameRasterSet {
  readonly normal: ClassicRasterResource;
  readonly selected: ClassicRasterResource;
}

export interface LeaderboardHeaderRasterSet {
  readonly classic: ClassicRasterResource;
  readonly crazy: ClassicRasterResource;
  readonly gnStyle: ClassicRasterResource;
  readonly classicBird: ClassicRasterResource;
  readonly crazyBird: ClassicRasterResource;
  readonly comboBird: ClassicRasterResource;
}

export interface LeaderboardRasterProfile {
  readonly back: LeaderboardTwoFrameRasterSet;
  readonly headers: LeaderboardHeaderRasterSet;
  readonly template: ClassicRasterResource;
  readonly title: ClassicRasterResource;
}

export const LEADERBOARD_SHARED_RESOURCES = deepFreeze({
  playerFont: {
    bytes: 42_432,
    canonicalPath: LEADERBOARD_PLAYER_FONT_CANONICAL_PATH,
    kind: 'font' as const,
    sha256: '13cb6762ba5a38853bc338367178b1c7647ad3d2fc407e8953afdc42b1af12d6',
  },
  scoreFont: {
    bytes: 165_248,
    canonicalPath: LEADERBOARD_SCORE_FONT_CANONICAL_PATH,
    kind: 'font' as const,
    sha256: '21be61ff5289c2125dbb48e2a739fd4dd98c3e58b37abfc22cc0412dd8376d95',
  },
  menuButtonClick: {
    bytes: 32_812,
    canonicalPath: LEADERBOARD_MENU_BUTTON_AUDIO_CANONICAL_PATH,
    kind: 'audio' as const,
    sha256: '3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e',
  },
}) satisfies Readonly<Record<string, LeaderboardSharedFileResource>>;

const LEADERBOARD_RASTER_DIMENSIONS = {
  'Leaderboard/leaderboard_title.png': [[552, 118], [793, 159]],
  'Leaderboard/leaderboard_view_templete.png': [[540, 586], [773, 844]],
  'Leaderboard/leaderboard_classic.png': [[466, 115], [663, 137]],
  'Leaderboard/leaderboard_crazy.png': [[466, 115], [663, 137]],
  'Leaderboard/leaderboard_gnstyle.png': [[466, 115], [663, 138]],
  'Leaderboard/leaderboard_classic_bird.png': [[466, 115], [663, 137]],
  'Leaderboard/leaderboard_crazy_bird.png': [[466, 115], [663, 138]],
  'Leaderboard/leaderboard_combo_bird.png': [[466, 115], [663, 137]],
  'Buttons/button-blue-back-normal.png': [[144, 124], [180, 150]],
  'Buttons/button-back-selected.png': [[144, 124], [181, 150]],
} as const;

type LeaderboardRasterLogicalPath = keyof typeof LEADERBOARD_RASTER_DIMENSIONS;

export const LEADERBOARD_RASTER_RESOURCES:
Readonly<Record<ClassicAssetTree, LeaderboardRasterProfile>> = deepFreeze({
  '480x800': createRasterProfile('480x800'),
  '720x1280': createRasterProfile('720x1280'),
});

export function getLeaderboardRasterResources(
  assetTree: ClassicAssetTree,
): LeaderboardRasterProfile {
  assertAssetTree(assetTree);
  return LEADERBOARD_RASTER_RESOURCES[assetTree];
}

function createRasterProfile(tree: ClassicAssetTree): LeaderboardRasterProfile {
  return {
    back: {
      normal: raster(tree, 'Buttons/button-blue-back-normal.png'),
      selected: raster(tree, 'Buttons/button-back-selected.png'),
    },
    headers: {
      classic: raster(tree, 'Leaderboard/leaderboard_classic.png'),
      crazy: raster(tree, 'Leaderboard/leaderboard_crazy.png'),
      gnStyle: raster(tree, 'Leaderboard/leaderboard_gnstyle.png'),
      classicBird: raster(tree, 'Leaderboard/leaderboard_classic_bird.png'),
      crazyBird: raster(tree, 'Leaderboard/leaderboard_crazy_bird.png'),
      comboBird: raster(tree, 'Leaderboard/leaderboard_combo_bird.png'),
    },
    template: raster(tree, 'Leaderboard/leaderboard_view_templete.png'),
    title: raster(tree, 'Leaderboard/leaderboard_title.png'),
  };
}

function raster(
  tree: ClassicAssetTree,
  logicalPath: LeaderboardRasterLogicalPath,
): ClassicRasterResource {
  const treeIndex = tree === '480x800' ? 0 : 1;
  const [width, height] = LEADERBOARD_RASTER_DIMENSIONS[logicalPath][treeIndex];
  return {
    canonicalPath: `${tree}/${logicalPath}`,
    dimensions: { height, width },
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
