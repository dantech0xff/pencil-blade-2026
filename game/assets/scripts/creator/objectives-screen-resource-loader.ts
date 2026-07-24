import * as Cocos from 'cc';

import type { AssetManager, Font } from 'cc';

import {
  canonicalResourceToBundlePath,
} from '../domain/classic-resource-contract';
import {
  OBJECTIVES_SCREEN_FONT_CANONICAL_PATH,
  OBJECTIVES_SCREEN_RASTER_RESOURCE_COUNT,
  collectObjectivesScreenRasterResources,
  getObjectivesScreenRasterResources,
  type ObjectivesScreenRasterProfile,
  type ObjectivesScreenRasterResource,
} from '../domain/objectives-screen-resource-contract';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import {
  loadExactGameRasters,
  loadGameResourceBundle,
  type LoadedGameRasterResource,
} from './game-resource-loader';

export interface LoadedObjectivesScreenResources {
  readonly arialFont: Readonly<{
    readonly canonicalPath: typeof OBJECTIVES_SCREEN_FONT_CANONICAL_PATH;
    readonly font: Font;
  }>;
  readonly assetTree: ClassicAssetTree;
  readonly rasterCount: typeof OBJECTIVES_SCREEN_RASTER_RESOURCE_COUNT;
  raster(resource: ObjectivesScreenRasterResource): LoadedGameRasterResource;
}

const PROFILE_KEYS = Object.freeze([
  'back',
  'background',
  'fixedCurrentRow',
  'footer',
  'header',
  'ordinaryRows',
  'skip',
] as const);
const TWO_FRAME_KEYS = Object.freeze(['normal', 'selected'] as const);
const ORDINARY_ROW_KEYS = Object.freeze(['finished', 'unfinished'] as const);
const RASTER_KEYS = Object.freeze([
  'bytes',
  'canonicalPath',
  'consumerClassification',
  'dimensions',
  'hasUnattachedProbeInstance',
  'sha256',
] as const);
const DIMENSION_KEYS = Object.freeze(['height', 'width'] as const);
const SHA_256_PATTERN = /^[0-9a-f]{64}$/;

/** Loads the exact recovered ten-raster Objectives screen closure plus Arial. */
export async function loadObjectivesScreenResources(
  assetTree: ClassicAssetTree,
): Promise<LoadedObjectivesScreenResources> {
  const profile = getObjectivesScreenRasterResources(assetTree);
  const rasterContracts = collectObjectivesScreenRasterContracts(profile);
  const bundle = await loadGameResourceBundle();
  const [loadedRasters, font] = await Promise.all([
    loadExactGameRasters(rasterContracts, bundle),
    loadObjectivesScreenArialFont(bundle),
  ]);
  const rastersByPath = createExactRasterCatalog(
    rasterContracts,
    loadedRasters,
  );
  const contractsByPath = new Map(
    rasterContracts.map((resource) => [resource.canonicalPath, resource]),
  );

  return Object.freeze({
    arialFont: Object.freeze({
      canonicalPath: OBJECTIVES_SCREEN_FONT_CANONICAL_PATH,
      font,
    }),
    assetTree,
    rasterCount: OBJECTIVES_SCREEN_RASTER_RESOURCE_COUNT,
    raster(resource: ObjectivesScreenRasterResource): LoadedGameRasterResource {
      const expected = contractsByPath.get(resource.canonicalPath);
      if (expected === undefined) {
        throw new Error(
          `Objectives screen raster was not loaded: ${resource.canonicalPath}`,
        );
      }
      if (!sameRasterIdentity(resource, expected)) {
        throw new Error(
          `Objectives screen raster contract changed: ${resource.canonicalPath}`,
        );
      }
      const loaded = rastersByPath.get(resource.canonicalPath);
      if (loaded === undefined) {
        throw new Error(
          `Objectives screen raster was not loaded: ${resource.canonicalPath}`,
        );
      }
      return loaded;
    },
  });
}

export function collectObjectivesScreenRasterContracts(
  profile: ObjectivesScreenRasterProfile,
): readonly ObjectivesScreenRasterResource[] {
  assertExactProfileShape(profile);
  const resources = orderedProfileResources(profile);
  const paths = new Set<string>();
  for (let index = 0; index < resources.length; index += 1) {
    const resource = resources[index];
    assertRasterResource(resource, `profile resource ${index}`);
    if (paths.has(resource.canonicalPath)) {
      throw new Error(
        `Duplicate Objectives screen raster contract: ${resource.canonicalPath}`,
      );
    }
    paths.add(resource.canonicalPath);
  }
  if (resources.length !== OBJECTIVES_SCREEN_RASTER_RESOURCE_COUNT) {
    throw new Error(
      `Objectives screen raster profile does not contain exactly `
      + `${OBJECTIVES_SCREEN_RASTER_RESOURCE_COUNT} resources`,
    );
  }
  assertCanonicalProfile(resources);
  return Object.freeze(resources.map(cloneRasterResource));
}

function orderedProfileResources(
  profile: ObjectivesScreenRasterProfile,
): readonly ObjectivesScreenRasterResource[] {
  return [
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
  ];
}

function createExactRasterCatalog(
  contracts: readonly ObjectivesScreenRasterResource[],
  loadedRasters: readonly LoadedGameRasterResource[],
): ReadonlyMap<string, LoadedGameRasterResource> {
  if (
    !Array.isArray(loadedRasters)
    || loadedRasters.length !== OBJECTIVES_SCREEN_RASTER_RESOURCE_COUNT
  ) {
    throw new Error('Creator returned an incomplete Objectives screen raster catalog');
  }
  const rastersByPath = new Map<string, LoadedGameRasterResource>();
  for (
    let index = 0;
    index < OBJECTIVES_SCREEN_RASTER_RESOURCE_COUNT;
    index += 1
  ) {
    if (!(index in loadedRasters)) {
      throw new Error('Creator returned a sparse Objectives screen raster catalog');
    }
    const loaded = loadedRasters[index];
    const expected = contracts[index];
    if (loaded === undefined || expected === undefined) {
      throw new Error('Creator returned an incomplete Objectives screen raster catalog');
    }
    if (loaded.canonicalPath !== expected.canonicalPath) {
      throw new Error(
        `Creator substituted Objectives screen raster ${expected.canonicalPath} `
        + `with ${loaded.canonicalPath}`,
      );
    }
    if (
      loaded.dimensions.width !== expected.dimensions.width
      || loaded.dimensions.height !== expected.dimensions.height
    ) {
      throw new Error(
        `Creator changed Objectives screen raster geometry: ${expected.canonicalPath}`,
      );
    }
    if (rastersByPath.has(loaded.canonicalPath)) {
      throw new Error(
        `Creator returned duplicate Objectives screen raster: ${loaded.canonicalPath}`,
      );
    }
    rastersByPath.set(loaded.canonicalPath, loaded);
  }
  if (rastersByPath.size !== OBJECTIVES_SCREEN_RASTER_RESOURCE_COUNT) {
    throw new Error('Creator returned an incomplete Objectives screen raster catalog');
  }
  return rastersByPath;
}

function assertCanonicalProfile(
  resources: readonly ObjectivesScreenRasterResource[],
): void {
  const first = resources[0];
  if (first === undefined) {
    throw new Error('Objectives screen raster profile is empty');
  }
  const assetTree = inferAssetTree(first.canonicalPath);
  const expected = collectObjectivesScreenRasterResources(assetTree);
  for (let index = 0; index < expected.length; index += 1) {
    const actualResource = resources[index];
    const expectedResource = expected[index];
    if (
      actualResource === undefined
      || expectedResource === undefined
      || !sameRasterIdentity(actualResource, expectedResource)
    ) {
      throw new Error(
        `Objectives screen raster contract changed at profile index ${index}`,
      );
    }
  }
}

function inferAssetTree(canonicalPath: string): ClassicAssetTree {
  if (canonicalPath.startsWith('480x800/')) {
    return '480x800';
  }
  if (canonicalPath.startsWith('720x1280/')) {
    return '720x1280';
  }
  throw new Error(
    `Objectives screen raster is outside an exact profile: ${canonicalPath}`,
  );
}

function assertExactProfileShape(
  profile: unknown,
): asserts profile is ObjectivesScreenRasterProfile {
  assertExactKeys(profile, PROFILE_KEYS, 'Objectives screen raster profile');
  const record = profile as unknown as Record<string, unknown>;
  assertExactKeys(record.back, TWO_FRAME_KEYS, 'Objectives screen Back profile');
  assertExactKeys(record.skip, TWO_FRAME_KEYS, 'Objectives screen Skip profile');
  assertExactKeys(
    record.ordinaryRows,
    ORDINARY_ROW_KEYS,
    'Objectives screen ordinary-row profile',
  );
}

function assertRasterResource(
  candidate: unknown,
  semanticName: string,
): asserts candidate is ObjectivesScreenRasterResource {
  assertExactKeys(
    candidate,
    RASTER_KEYS,
    `Objectives screen ${semanticName} raster`,
  );
  const record = candidate as Record<string, unknown>;
  if (
    !Number.isSafeInteger(record.bytes)
    || (record.bytes as number) <= 0
    || typeof record.canonicalPath !== 'string'
    || record.canonicalPath.length === 0
    || (
      record.consumerClassification !== 'attached-visible'
      && record.consumerClassification !== 'unattached-probe-and-attached-visible'
    )
    || typeof record.hasUnattachedProbeInstance !== 'boolean'
    || typeof record.sha256 !== 'string'
    || !SHA_256_PATTERN.test(record.sha256)
  ) {
    throw new Error(
      `Objectives screen ${semanticName} raster identity is invalid`,
    );
  }
  const expectedProbe = (
    record.consumerClassification === 'unattached-probe-and-attached-visible'
  );
  if (record.hasUnattachedProbeInstance !== expectedProbe) {
    throw new Error(
      `Objectives screen ${semanticName} raster probe classification is inconsistent`,
    );
  }
  assertExactKeys(
    record.dimensions,
    DIMENSION_KEYS,
    `Objectives screen ${semanticName} raster dimensions`,
  );
  const dimensions = record.dimensions as Record<string, unknown>;
  if (
    !Number.isSafeInteger(dimensions.width)
    || (dimensions.width as number) <= 0
    || !Number.isSafeInteger(dimensions.height)
    || (dimensions.height as number) <= 0
  ) {
    throw new RangeError(
      `Objectives screen ${semanticName} raster dimensions `
      + 'must be positive safe integers',
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

function sameRasterIdentity(
  actual: ObjectivesScreenRasterResource,
  expected: ObjectivesScreenRasterResource,
): boolean {
  return (
    actual.bytes === expected.bytes
    && actual.canonicalPath === expected.canonicalPath
    && actual.consumerClassification === expected.consumerClassification
    && actual.dimensions.height === expected.dimensions.height
    && actual.dimensions.width === expected.dimensions.width
    && actual.hasUnattachedProbeInstance === expected.hasUnattachedProbeInstance
    && actual.sha256 === expected.sha256
  );
}

function cloneRasterResource(
  resource: ObjectivesScreenRasterResource,
): ObjectivesScreenRasterResource {
  return Object.freeze({
    bytes: resource.bytes,
    canonicalPath: resource.canonicalPath,
    consumerClassification: resource.consumerClassification,
    dimensions: Object.freeze({
      height: resource.dimensions.height,
      width: resource.dimensions.width,
    }),
    hasUnattachedProbeInstance: resource.hasUnattachedProbeInstance,
    sha256: resource.sha256,
  });
}

function loadObjectivesScreenArialFont(
  bundle: AssetManager.Bundle,
): Promise<Font> {
  const bundlePath = canonicalResourceToBundlePath(
    OBJECTIVES_SCREEN_FONT_CANONICAL_PATH,
  );
  return new Promise((resolve, reject) => {
    bundle.load(bundlePath, Cocos.Font, (error, font) => {
      if (error !== null && error !== undefined) {
        reject(
          new Error(`Failed to load Objectives screen Arial font: ${error.message}`),
        );
        return;
      }
      if (font === null || font === undefined) {
        reject(new Error('Creator returned no Objectives screen Arial font'));
        return;
      }
      resolve(font);
    });
  });
}
