import {
  ABOUT_RASTER_RESOURCES,
  ABOUT_SHARED_RESOURCES,
} from './about-resource-contract';
import {
  BASE_GAMEPLAY_ARIAL_FONT_RESOURCE,
  BASE_GAMEPLAY_RESOURCE_PROFILES,
} from './base-gameplay-resource-contract';
import {
  BIRD_RESOURCE_PROFILES_BY_TYPE,
} from './bird-resource-contract';
import {
  CLASSIC_COMBO_AUDIO_PATHS,
  CLASSIC_CORE_AUDIO_PATHS,
  CLASSIC_FRUIT_CUT_AUDIO_PATHS,
  CLASSIC_ORDINARY_BOMB_AUDIO_PATHS,
  CLASSIC_RESULT_RANK_AUDIO_PATHS,
} from './classic-audio-contract';
import {
  CLASSIC_BOMB_RESOURCES,
  CLASSIC_BOMB_SMOKE_RESOURCES,
  CLASSIC_COMBO_FONT_RESOURCE,
  CLASSIC_CRITICAL_PARTICLE_RESOURCES,
  CLASSIC_DEFAULT_BLADE_RESOURCES,
  CLASSIC_NORMAL_FRUIT_RESOURCES,
  CLASSIC_PRESENTATION_RESOURCES,
  CLASSIC_RESULT_FONT_RESOURCES,
  CLASSIC_RESULT_RESOURCES,
  CLASSIC_SCORE_HUD_FONT_RESOURCE,
} from './classic-resource-contract';
import {
  COMBO_BIRD_SUPPLEMENTAL_RASTERS,
  COMBO_BIRD_TIME_MANAGER_FONT_RESOURCE,
} from './combo-bird-resource-contract';
import {
  CRAZY_REQUIRED_STAGED_AUDIO_PATHS,
} from './crazy-audio-contract';
import {
  CRAZY_DRAGON_COUNTER_FONT_PATH,
} from './crazy-dragon-fruit-state';
import {
  CRAZY_SPECIAL_FRUIT_RESOURCES,
  CRAZY_SUPPLEMENTAL_RASTERS,
  CRAZY_TIME_MANAGER_FONT_RESOURCE,
} from './crazy-resource-contract';
import {
  GN_STYLE_BACKGROUND_MUSIC_PATH,
  GN_STYLE_SUPPLEMENTAL_RASTERS,
} from './gn-style-resource-contract';
import {
  LEADERBOARD_RASTER_RESOURCES,
  LEADERBOARD_SHARED_RESOURCES,
} from './leaderboard-resource-contract';
import {
  LOADING_AUDIO_PRELOAD_STEPS,
  LOADING_RASTER_RESOURCES,
} from './loading-resource-contract';
import {
  MAIN_MENU_FRUIT_BUTTON_DEFINITIONS,
  MAIN_MENU_FRUIT_CUT_AUDIO_BY_ID,
  MAIN_MENU_RASTER_RESOURCES,
  MAIN_MENU_SHARED_RESOURCES,
} from './main-menu-resource-contract';
import {
  MODE_SELECT_CARD_DEFINITIONS,
  MODE_SELECT_FRUIT_CUT_AUDIO_BY_ID,
  MODE_SELECT_RASTER_RESOURCES,
  MODE_SELECT_SHARED_RESOURCES,
} from './mode-select-resource-contract';
import {
  OBJECTIVES_SCREEN_RASTER_RESOURCES,
  OBJECTIVES_SCREEN_SHARED_RESOURCES,
} from './objectives-screen-resource-contract';
import {
  OPTIONS_RASTER_RESOURCES,
  OPTIONS_SHARED_RESOURCES,
} from './options-resource-contract';
import {
  SHARED_BACKGROUND_RESOURCES,
  SHARED_LEAF_RESOURCES,
  SHARED_THEME_RESOURCES,
} from './shared-game-scene-resources';
import {
  getStandardBladeRasterResources,
} from './standard-blade-resource-contract';

export type ResourceConsumerId =
  | 'about'
  | 'base-gameplay'
  | 'bird'
  | 'classic-audio'
  | 'classic-presentation'
  | 'combo-bird'
  | 'crazy-audio'
  | 'crazy-presentation'
  | 'crazy-dragon-counter'
  | 'gn-style'
  | 'leaderboard'
  | 'loading'
  | 'main-menu'
  | 'mode-select'
  | 'objectives'
  | 'options'
  | 'shared-scene'
  | 'standard-blade';

export interface ResourceConsumerRegistryEntry {
  readonly canonicalPath: string;
  readonly consumerIds: readonly ResourceConsumerId[];
  readonly evidenceRefs: readonly string[];
}

const RESOURCE_CONSUMER_SOURCES: readonly Readonly<{
  readonly consumerId: ResourceConsumerId;
  readonly evidenceRefs: readonly string[];
  readonly includeStrings?: true;
  readonly values: readonly unknown[];
}>[] = Object.freeze([
  {
    consumerId: 'about',
    evidenceRefs: ['game/assets/scripts/domain/about-resource-contract.ts'],
    values: [ABOUT_SHARED_RESOURCES, ABOUT_RASTER_RESOURCES],
  },
  {
    consumerId: 'base-gameplay',
    evidenceRefs: ['game/assets/scripts/domain/base-gameplay-resource-contract.ts'],
    values: [BASE_GAMEPLAY_ARIAL_FONT_RESOURCE, BASE_GAMEPLAY_RESOURCE_PROFILES],
  },
  {
    consumerId: 'bird',
    evidenceRefs: ['game/assets/scripts/domain/bird-resource-contract.ts'],
    values: [BIRD_RESOURCE_PROFILES_BY_TYPE],
  },
  {
    consumerId: 'classic-audio',
    evidenceRefs: ['game/assets/scripts/domain/classic-audio-contract.ts'],
    includeStrings: true,
    values: [
      CLASSIC_CORE_AUDIO_PATHS,
      CLASSIC_COMBO_AUDIO_PATHS,
      CLASSIC_FRUIT_CUT_AUDIO_PATHS,
      recordValues(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS),
      recordValues(CLASSIC_RESULT_RANK_AUDIO_PATHS),
    ],
  },
  {
    consumerId: 'classic-presentation',
    evidenceRefs: ['game/assets/scripts/domain/classic-resource-contract.ts'],
    values: [
      CLASSIC_SCORE_HUD_FONT_RESOURCE,
      CLASSIC_COMBO_FONT_RESOURCE,
      CLASSIC_RESULT_FONT_RESOURCES,
      CLASSIC_NORMAL_FRUIT_RESOURCES,
      CLASSIC_PRESENTATION_RESOURCES,
      CLASSIC_RESULT_RESOURCES,
      CLASSIC_BOMB_RESOURCES,
      CLASSIC_BOMB_SMOKE_RESOURCES,
      CLASSIC_DEFAULT_BLADE_RESOURCES,
      CLASSIC_CRITICAL_PARTICLE_RESOURCES,
    ],
  },
  {
    consumerId: 'combo-bird',
    evidenceRefs: ['game/assets/scripts/domain/combo-bird-resource-contract.ts'],
    values: [COMBO_BIRD_TIME_MANAGER_FONT_RESOURCE, COMBO_BIRD_SUPPLEMENTAL_RASTERS],
  },
  {
    consumerId: 'crazy-audio',
    evidenceRefs: ['game/assets/scripts/domain/crazy-audio-contract.ts'],
    includeStrings: true,
    values: [CRAZY_REQUIRED_STAGED_AUDIO_PATHS],
  },
  {
    consumerId: 'crazy-presentation',
    evidenceRefs: ['game/assets/scripts/domain/crazy-resource-contract.ts'],
    values: [CRAZY_TIME_MANAGER_FONT_RESOURCE, CRAZY_SPECIAL_FRUIT_RESOURCES, CRAZY_SUPPLEMENTAL_RASTERS],
  },
  {
    consumerId: 'gn-style',
    evidenceRefs: ['game/assets/scripts/domain/gn-style-resource-contract.ts'],
    includeStrings: true,
    values: [GN_STYLE_BACKGROUND_MUSIC_PATH, GN_STYLE_SUPPLEMENTAL_RASTERS],
  },
  {
    consumerId: 'leaderboard',
    evidenceRefs: ['game/assets/scripts/domain/leaderboard-resource-contract.ts'],
    values: [LEADERBOARD_SHARED_RESOURCES, LEADERBOARD_RASTER_RESOURCES],
  },
  {
    consumerId: 'loading',
    evidenceRefs: [
      'game/assets/scripts/domain/loading-resource-contract.ts',
      'plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-loading-static-contract.md',
    ],
    values: [LOADING_RASTER_RESOURCES, LOADING_AUDIO_PRELOAD_STEPS],
  },
  {
    consumerId: 'main-menu',
    evidenceRefs: ['game/assets/scripts/domain/main-menu-resource-contract.ts'],
    values: [MAIN_MENU_SHARED_RESOURCES, MAIN_MENU_RASTER_RESOURCES, MAIN_MENU_FRUIT_BUTTON_DEFINITIONS],
  },
  {
    consumerId: 'main-menu',
    evidenceRefs: ['game/assets/scripts/domain/main-menu-resource-contract.ts'],
    includeStrings: true,
    values: [MAIN_MENU_FRUIT_CUT_AUDIO_BY_ID],
  },
  {
    consumerId: 'mode-select',
    evidenceRefs: ['game/assets/scripts/domain/mode-select-resource-contract.ts'],
    values: [MODE_SELECT_SHARED_RESOURCES, MODE_SELECT_RASTER_RESOURCES, MODE_SELECT_CARD_DEFINITIONS],
  },
  {
    consumerId: 'mode-select',
    evidenceRefs: ['game/assets/scripts/domain/mode-select-resource-contract.ts'],
    includeStrings: true,
    values: [MODE_SELECT_FRUIT_CUT_AUDIO_BY_ID],
  },
  {
    consumerId: 'objectives',
    evidenceRefs: ['game/assets/scripts/domain/objectives-screen-resource-contract.ts'],
    values: [OBJECTIVES_SCREEN_SHARED_RESOURCES, OBJECTIVES_SCREEN_RASTER_RESOURCES],
  },
  {
    consumerId: 'options',
    evidenceRefs: ['game/assets/scripts/domain/options-resource-contract.ts'],
    values: [OPTIONS_SHARED_RESOURCES, OPTIONS_RASTER_RESOURCES],
  },
  {
    consumerId: 'shared-scene',
    evidenceRefs: ['game/assets/scripts/domain/shared-game-scene-resources.ts'],
    values: [SHARED_BACKGROUND_RESOURCES, SHARED_THEME_RESOURCES, SHARED_LEAF_RESOURCES],
  },
  {
    consumerId: 'standard-blade',
    evidenceRefs: ['game/assets/scripts/domain/standard-blade-resource-contract.ts'],
    values: [getStandardBladeRasterResources('480x800'), getStandardBladeRasterResources('720x1280')],
  },
  {
    consumerId: 'crazy-dragon-counter',
    evidenceRefs: ['game/assets/scripts/domain/crazy-dragon-fruit-state.ts'],
    includeStrings: true,
    values: [CRAZY_DRAGON_COUNTER_FONT_PATH],
  },
]);

export const RESOURCE_CONSUMER_REGISTRY: readonly ResourceConsumerRegistryEntry[]
  = Object.freeze(buildResourceConsumerRegistry());

export function listResourceConsumerRecords(): readonly ResourceConsumerRegistryEntry[] {
  return RESOURCE_CONSUMER_REGISTRY;
}

export function getResourceConsumerRegistry(): readonly ResourceConsumerRegistryEntry[] {
  return listResourceConsumerRecords();
}

function buildResourceConsumerRegistry(): ResourceConsumerRegistryEntry[] {
  const consumerIdsByPath = new Map<string, Set<ResourceConsumerId>>();
  for (const source of RESOURCE_CONSUMER_SOURCES) {
    for (const canonicalPath of collectCanonicalPaths(source.values, source.includeStrings === true)) {
      const consumerIds = consumerIdsByPath.get(canonicalPath) ?? new Set<ResourceConsumerId>();
      consumerIds.add(source.consumerId);
      consumerIdsByPath.set(canonicalPath, consumerIds);
    }
  }

  const entries = Array.from(consumerIdsByPath.entries(), ([canonicalPath, consumerIds]) => (
    Object.freeze({
      canonicalPath,
      consumerIds: Object.freeze(Array.from(consumerIds).sort(compareOrdinalStrings)) as readonly ResourceConsumerId[],
      evidenceRefs: collectEvidenceRefs(consumerIds),
    })
  ));

  entries.sort((left, right) => compareOrdinalStrings(left.canonicalPath, right.canonicalPath));
  return entries;
}

function collectCanonicalPaths(
  values: readonly unknown[],
  includeStrings: boolean,
): readonly string[] {
  const canonicalPaths = new Set<string>();
  const visited = new Set<object>();

  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      if (includeStrings) {
        canonicalPaths.add(value);
      }
      return;
    }
    if (value === null || typeof value !== 'object') {
      return;
    }
    if (visited.has(value)) {
      return;
    }
    visited.add(value);

    if ('canonicalPath' in value && typeof (value as { readonly canonicalPath?: unknown }).canonicalPath === 'string') {
      canonicalPaths.add((value as { readonly canonicalPath: string }).canonicalPath);
    }
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      visit(record[key]);
    }
  };

  for (const value of values) {
    visit(value);
  }

  return Object.freeze(Array.from(canonicalPaths));
}

function collectEvidenceRefs(
  consumerIds: ReadonlySet<ResourceConsumerId>,
): readonly string[] {
  const evidenceRefs = new Set<string>();
  for (const source of RESOURCE_CONSUMER_SOURCES) {
    if (!consumerIds.has(source.consumerId)) {
      continue;
    }
    for (const evidenceRef of source.evidenceRefs) {
      evidenceRefs.add(evidenceRef);
    }
  }
  return Object.freeze(Array.from(evidenceRefs).sort(compareOrdinalStrings));
}

function recordValues<T>(record: Readonly<Record<string, T>>): readonly T[] {
  return Object.keys(record).map((key) => record[key]);
}

function compareOrdinalStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
