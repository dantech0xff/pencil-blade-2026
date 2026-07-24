import * as Cocos from 'cc';

import type { AssetManager, Font } from 'cc';

import {
  canonicalResourceToBundlePath,
  type ClassicRasterResource,
} from '../domain/classic-resource-contract';
import {
  LEADERBOARD_PLAYER_FONT_CANONICAL_PATH,
  LEADERBOARD_RASTER_RESOURCE_COUNT,
  LEADERBOARD_SCORE_FONT_CANONICAL_PATH,
  getLeaderboardRasterResources,
  type LeaderboardRasterProfile,
} from '../domain/leaderboard-resource-contract';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import {
  loadExactGameRasters,
  loadGameResourceBundle,
  type LoadedGameRasterResource,
} from './game-resource-loader';

export interface LoadedLeaderboardResources {
  readonly assetTree: ClassicAssetTree;
  readonly playerFont: Font;
  readonly rasterCount: typeof LEADERBOARD_RASTER_RESOURCE_COUNT;
  readonly scoreFont: Font;
  raster(resource: ClassicRasterResource): LoadedGameRasterResource;
}

const PROFILE_KEYS = Object.freeze(['back', 'headers', 'template', 'title'] as const);
const HEADER_KEYS = Object.freeze([
  'classic',
  'crazy',
  'gnStyle',
  'classicBird',
  'crazyBird',
  'comboBird',
] as const);
const BACK_KEYS = Object.freeze(['normal', 'selected'] as const);
const RASTER_KEYS = Object.freeze(['canonicalPath', 'dimensions'] as const);
const DIMENSION_KEYS = Object.freeze(['height', 'width'] as const);

/** Loads the complete recovered Leaderboard resource closure without fallback assets. */
export async function loadLeaderboardResources(
  assetTree: ClassicAssetTree,
): Promise<LoadedLeaderboardResources> {
  const profile = getLeaderboardRasterResources(assetTree);
  const rasterContracts = collectLeaderboardRasterContracts(profile);
  const bundle = await loadGameResourceBundle();
  const [loadedRasters, playerFont, scoreFont] = await Promise.all([
    loadExactGameRasters(rasterContracts, bundle),
    loadLeaderboardFont(
      bundle,
      LEADERBOARD_PLAYER_FONT_CANONICAL_PATH,
      'player',
    ),
    loadLeaderboardFont(
      bundle,
      LEADERBOARD_SCORE_FONT_CANONICAL_PATH,
      'score',
    ),
  ]);
  const rastersByPath = createExactRasterCatalog(rasterContracts, loadedRasters);
  const contractsByPath = new Map(
    rasterContracts.map((resource) => [resource.canonicalPath, resource]),
  );

  return Object.freeze({
    assetTree,
    playerFont,
    rasterCount: LEADERBOARD_RASTER_RESOURCE_COUNT,
    scoreFont,
    raster(resource: ClassicRasterResource): LoadedGameRasterResource {
      const expected = contractsByPath.get(resource.canonicalPath);
      if (expected === undefined) {
        throw new Error(`Leaderboard raster was not loaded: ${resource.canonicalPath}`);
      }
      if (
        resource.dimensions.width !== expected.dimensions.width
        || resource.dimensions.height !== expected.dimensions.height
      ) {
        throw new Error(`Leaderboard raster contract changed: ${resource.canonicalPath}`);
      }
      const loaded = rastersByPath.get(resource.canonicalPath);
      if (loaded === undefined) {
        throw new Error(`Leaderboard raster was not loaded: ${resource.canonicalPath}`);
      }
      return loaded;
    },
  });
}

export function collectLeaderboardRasterContracts(
  profile: LeaderboardRasterProfile,
): readonly ClassicRasterResource[] {
  assertExactProfileShape(profile);
  const resources: ClassicRasterResource[] = [];
  const paths = new Set<string>();
  const append = (candidate: unknown, semanticName: string): void => {
    assertRasterResource(candidate, semanticName);
    if (paths.has(candidate.canonicalPath)) {
      throw new Error(`Duplicate Leaderboard raster contract: ${candidate.canonicalPath}`);
    }
    paths.add(candidate.canonicalPath);
    resources.push(candidate);
  };

  append(profile.title, 'title');
  append(profile.template, 'template');
  append(profile.headers.classic, 'Classic header');
  append(profile.headers.crazy, 'Crazy header');
  append(profile.headers.gnStyle, 'GN Style header');
  append(profile.headers.classicBird, 'Classic Bird header');
  append(profile.headers.crazyBird, 'Crazy Bird header');
  append(profile.headers.comboBird, 'Combo Bird header');
  append(profile.back.normal, 'Back normal');
  append(profile.back.selected, 'Back selected');

  if (resources.length !== LEADERBOARD_RASTER_RESOURCE_COUNT) {
    throw new Error(
      `Leaderboard raster profile does not contain exactly `
      + `${LEADERBOARD_RASTER_RESOURCE_COUNT} resources`,
    );
  }
  assertCanonicalProfile(resources);
  return Object.freeze(resources.map(cloneRasterResource));
}

function createExactRasterCatalog(
  contracts: readonly ClassicRasterResource[],
  loadedRasters: readonly LoadedGameRasterResource[],
): ReadonlyMap<string, LoadedGameRasterResource> {
  if (
    !Array.isArray(loadedRasters)
    || loadedRasters.length !== LEADERBOARD_RASTER_RESOURCE_COUNT
  ) {
    throw new Error('Creator returned an incomplete Leaderboard raster catalog');
  }
  const rastersByPath = new Map<string, LoadedGameRasterResource>();
  for (let index = 0; index < LEADERBOARD_RASTER_RESOURCE_COUNT; index += 1) {
    if (!(index in loadedRasters)) {
      throw new Error('Creator returned a sparse Leaderboard raster catalog');
    }
    const loaded = loadedRasters[index];
    const expected = contracts[index];
    if (loaded === undefined || expected === undefined) {
      throw new Error('Creator returned an incomplete Leaderboard raster catalog');
    }
    if (loaded.canonicalPath !== expected.canonicalPath) {
      throw new Error(
        `Creator substituted Leaderboard raster ${expected.canonicalPath} `
        + `with ${loaded.canonicalPath}`,
      );
    }
    if (
      loaded.dimensions.width !== expected.dimensions.width
      || loaded.dimensions.height !== expected.dimensions.height
    ) {
      throw new Error(`Creator changed Leaderboard raster geometry: ${expected.canonicalPath}`);
    }
    if (rastersByPath.has(loaded.canonicalPath)) {
      throw new Error(`Creator returned duplicate Leaderboard raster: ${loaded.canonicalPath}`);
    }
    rastersByPath.set(loaded.canonicalPath, loaded);
  }
  if (rastersByPath.size !== LEADERBOARD_RASTER_RESOURCE_COUNT) {
    throw new Error('Creator returned an incomplete Leaderboard raster catalog');
  }
  return rastersByPath;
}

function assertCanonicalProfile(resources: readonly ClassicRasterResource[]): void {
  const title = resources[0];
  if (title === undefined) {
    throw new Error('Leaderboard raster profile is missing its title');
  }
  let assetTree: ClassicAssetTree;
  if (title.canonicalPath === '480x800/Leaderboard/leaderboard_title.png') {
    assetTree = '480x800';
  } else if (title.canonicalPath === '720x1280/Leaderboard/leaderboard_title.png') {
    assetTree = '720x1280';
  } else {
    throw new Error(`Leaderboard title raster contract changed: ${title.canonicalPath}`);
  }
  const expected = orderedProfileResources(getLeaderboardRasterResources(assetTree));
  for (let index = 0; index < expected.length; index += 1) {
    const actualResource = resources[index];
    const expectedResource = expected[index];
    if (actualResource === undefined || expectedResource === undefined) {
      throw new Error('Leaderboard raster profile is incomplete');
    }
    if (
      actualResource.canonicalPath !== expectedResource.canonicalPath
      || actualResource.dimensions.width !== expectedResource.dimensions.width
      || actualResource.dimensions.height !== expectedResource.dimensions.height
    ) {
      throw new Error(
        `Leaderboard raster contract changed: expected ${expectedResource.canonicalPath} `
        + `${expectedResource.dimensions.width}x${expectedResource.dimensions.height}`,
      );
    }
  }
}

function orderedProfileResources(
  profile: LeaderboardRasterProfile,
): readonly ClassicRasterResource[] {
  return [
    profile.title,
    profile.template,
    profile.headers.classic,
    profile.headers.crazy,
    profile.headers.gnStyle,
    profile.headers.classicBird,
    profile.headers.crazyBird,
    profile.headers.comboBird,
    profile.back.normal,
    profile.back.selected,
  ];
}

function assertExactProfileShape(
  profile: unknown,
): asserts profile is LeaderboardRasterProfile {
  assertExactKeys(profile, PROFILE_KEYS, 'Leaderboard raster profile');
  const record = profile as unknown as Record<string, unknown>;
  assertExactKeys(record.headers, HEADER_KEYS, 'Leaderboard header profile');
  assertExactKeys(record.back, BACK_KEYS, 'Leaderboard Back profile');
}

function assertRasterResource(
  candidate: unknown,
  semanticName: string,
): asserts candidate is ClassicRasterResource {
  assertExactKeys(candidate, RASTER_KEYS, `Leaderboard ${semanticName} raster`);
  const record = candidate as Record<string, unknown>;
  if (typeof record.canonicalPath !== 'string' || record.canonicalPath.length === 0) {
    throw new TypeError(`Leaderboard ${semanticName} raster needs a canonical path`);
  }
  assertExactKeys(
    record.dimensions,
    DIMENSION_KEYS,
    `Leaderboard ${semanticName} raster dimensions`,
  );
  const dimensions = record.dimensions as Record<string, unknown>;
  if (
    !Number.isSafeInteger(dimensions.width)
    || (dimensions.width as number) <= 0
    || !Number.isSafeInteger(dimensions.height)
    || (dimensions.height as number) <= 0
  ) {
    throw new RangeError(
      `Leaderboard ${semanticName} raster dimensions must be positive safe integers`,
    );
  }
}

function assertExactKeys(
  candidate: unknown,
  expectedKeys: readonly string[],
  label: string,
): asserts candidate is Record<string, unknown> {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actualKeys = Object.keys(candidate).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  if (
    actualKeys.length !== sortedExpectedKeys.length
    || actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    throw new Error(`${label} must expose exactly ${sortedExpectedKeys.join(', ')}`);
  }
}

function cloneRasterResource(resource: ClassicRasterResource): ClassicRasterResource {
  return Object.freeze({
    canonicalPath: resource.canonicalPath,
    dimensions: Object.freeze({
      height: resource.dimensions.height,
      width: resource.dimensions.width,
    }),
  });
}

function loadLeaderboardFont(
  bundle: AssetManager.Bundle,
  canonicalPath: string,
  role: 'player' | 'score',
): Promise<Font> {
  const bundlePath = canonicalResourceToBundlePath(canonicalPath);
  return new Promise((resolve, reject) => {
    bundle.load(bundlePath, Cocos.Font, (error, font) => {
      if (error !== null && error !== undefined) {
        reject(new Error(`Failed to load Leaderboard ${role} font: ${error.message}`));
        return;
      }
      if (font === null || font === undefined) {
        reject(new Error(`Creator returned no Leaderboard ${role} font for ${canonicalPath}`));
        return;
      }
      resolve(font);
    });
  });
}
