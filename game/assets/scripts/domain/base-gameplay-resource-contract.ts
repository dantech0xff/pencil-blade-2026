import {
  assertGameAssetTree,
  createGameRaster,
  type GameAssetTree,
  type GameFontResource,
  type GameRasterResource,
} from './game-resource-contract';

export interface BaseGameplayPauseRasterSet {
  readonly objectiveBackground: GameRasterResource;
  readonly pauseNormal: GameRasterResource;
  readonly pauseSelected: GameRasterResource;
  readonly quitNormal: GameRasterResource;
  readonly quitSelected: GameRasterResource;
  readonly replayNormal: GameRasterResource;
  readonly replaySelected: GameRasterResource;
  readonly resumeNormal: GameRasterResource;
  readonly resumeSelected: GameRasterResource;
}

export interface ObjectiveAchievementRasterSet {
  readonly completedMessage: GameRasterResource;
  readonly nextMessage: GameRasterResource;
  readonly xmasFive: GameRasterResource;
  readonly xmasFour: GameRasterResource;
}

export interface BaseGameplayResourceProfile {
  readonly objectiveAchievement: ObjectiveAchievementRasterSet;
  readonly pause: BaseGameplayPauseRasterSet;
}

export const BASE_GAMEPLAY_ARIAL_FONT_RESOURCE: GameFontResource = Object.freeze({
  canonicalPath: 'Fonts/Arial.ttf',
});

export const BASE_GAMEPLAY_RESOURCE_PROFILES: Readonly<
  Record<GameAssetTree, BaseGameplayResourceProfile>
> = Object.freeze({
  '480x800': Object.freeze({
    objectiveAchievement: Object.freeze({
      completedMessage: createGameRaster(
        '480x800/Objectives/objectives_message.png',
        [552, 138],
      ),
      nextMessage: createGameRaster(
        '480x800/Objectives/next_objectives_message.png',
        [552, 132],
      ),
      xmasFive: createGameRaster(
        '480x800/Blades/Particles/X-Mas/xmasfive.png',
        [46, 44],
      ),
      xmasFour: createGameRaster(
        '480x800/Blades/Particles/X-Mas/xmasfour.png',
        [51, 59],
      ),
    }),
    pause: Object.freeze({
      objectiveBackground: createGameRaster(
        '480x800/Objectives/objectives-pause-background.png',
        [552, 206],
      ),
      pauseNormal: createGameRaster(
        '480x800/Buttons/button-pause-normal.png',
        [38, 38],
      ),
      pauseSelected: createGameRaster(
        '480x800/Buttons/button-pause-selected.png',
        [38, 38],
      ),
      quitNormal: createGameRaster(
        '480x800/Buttons/button-quit-normal.png',
        [156, 166],
      ),
      quitSelected: createGameRaster(
        '480x800/Buttons/button-quit-selected.png',
        [155, 166],
      ),
      replayNormal: createGameRaster(
        '480x800/Buttons/button-replay-normal.png',
        [92, 89],
      ),
      replaySelected: createGameRaster(
        '480x800/Buttons/button-replay-selected.png',
        [92, 89],
      ),
      resumeNormal: createGameRaster(
        '480x800/Buttons/button-resume-normal.png',
        [92, 89],
      ),
      resumeSelected: createGameRaster(
        '480x800/Buttons/button-resume-selected.png',
        [92, 89],
      ),
    }),
  }),
  '720x1280': Object.freeze({
    objectiveAchievement: Object.freeze({
      completedMessage: createGameRaster(
        '720x1280/Objectives/objectives_message.png',
        [792, 181],
      ),
      nextMessage: createGameRaster(
        '720x1280/Objectives/next_objectives_message.png',
        [792, 180],
      ),
      xmasFive: createGameRaster(
        '720x1280/Blades/Particles/X-Mas/xmasfive.png',
        [66, 64],
      ),
      xmasFour: createGameRaster(
        '720x1280/Blades/Particles/X-Mas/xmasfour.png',
        [70, 83],
      ),
    }),
    pause: Object.freeze({
      objectiveBackground: createGameRaster(
        '720x1280/Objectives/objectives-pause-background.png',
        [792, 291],
      ),
      pauseNormal: createGameRaster(
        '720x1280/Buttons/button-pause-normal.png',
        [57, 57],
      ),
      pauseSelected: createGameRaster(
        '720x1280/Buttons/button-pause-selected.png',
        [57, 57],
      ),
      quitNormal: createGameRaster(
        '720x1280/Buttons/button-quit-normal.png',
        [197, 213],
      ),
      quitSelected: createGameRaster(
        '720x1280/Buttons/button-quit-selected.png',
        [197, 213],
      ),
      replayNormal: createGameRaster(
        '720x1280/Buttons/button-replay-normal.png',
        [138, 133],
      ),
      replaySelected: createGameRaster(
        '720x1280/Buttons/button-replay-selected.png',
        [138, 133],
      ),
      resumeNormal: createGameRaster(
        '720x1280/Buttons/button-resume-normal.png',
        [137, 134],
      ),
      resumeSelected: createGameRaster(
        '720x1280/Buttons/button-resume-selected.png',
        [137, 134],
      ),
    }),
  }),
});

export function getBaseGameplayResourceProfile(
  assetTree: GameAssetTree,
): BaseGameplayResourceProfile {
  assertGameAssetTree(assetTree);
  return BASE_GAMEPLAY_RESOURCE_PROFILES[assetTree];
}

export function listBaseGameplayRasterResources(
  assetTree: GameAssetTree,
): readonly GameRasterResource[] {
  const profile = getBaseGameplayResourceProfile(assetTree);
  return Object.freeze([
    profile.pause.objectiveBackground,
    profile.pause.pauseNormal,
    profile.pause.pauseSelected,
    profile.pause.resumeNormal,
    profile.pause.resumeSelected,
    profile.pause.replayNormal,
    profile.pause.replaySelected,
    profile.pause.quitNormal,
    profile.pause.quitSelected,
    profile.objectiveAchievement.completedMessage,
    profile.objectiveAchievement.nextMessage,
    profile.objectiveAchievement.xmasFive,
    profile.objectiveAchievement.xmasFour,
  ]);
}
