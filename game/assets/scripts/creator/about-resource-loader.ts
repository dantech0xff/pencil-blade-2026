import {
  ABOUT_RASTER_RESOURCE_COUNT,
  collectAboutRasterResources,
  getAboutRasterResources,
  type AboutRasterProfile,
  type AboutRasterResource,
} from '../domain/about-resource-contract';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import {
  loadExactGameRasters,
  loadGameResourceBundle,
  type LoadedGameRasterResource,
} from './game-resource-loader';

export type AboutResourceLoaderErrorCode =
  | 'invalid-contract'
  | 'resource-load-failed'
  | 'catalog-incomplete'
  | 'catalog-sparse'
  | 'catalog-substituted'
  | 'catalog-geometry-mismatch'
  | 'catalog-duplicate'
  | 'raster-not-loaded'
  | 'raster-contract-changed';

export class AboutResourceLoaderError extends Error {
  readonly canonicalPath: string | null;
  readonly cause: unknown;
  readonly code: AboutResourceLoaderErrorCode;

  constructor(
    code: AboutResourceLoaderErrorCode,
    message: string,
    cause: unknown = null,
    canonicalPath: string | null = null,
  ) {
    super(message);
    this.name = 'AboutResourceLoaderError';
    this.canonicalPath = canonicalPath;
    this.cause = cause;
    this.code = code;
  }
}

export interface LoadedAboutResources {
  readonly assetTree: ClassicAssetTree;
  readonly rasterCount: typeof ABOUT_RASTER_RESOURCE_COUNT;
  raster(resource: AboutRasterResource): LoadedGameRasterResource;
}

const PROFILE_KEYS = Object.freeze([
  'background',
  'menu',
  'review',
  'email',
  'like',
  'heart',
] as const);
const TWO_FRAME_KEYS = Object.freeze(['normal', 'selected'] as const);
const RASTER_KEYS = Object.freeze([
  'bytes',
  'canonicalPath',
  'dimensions',
  'sha256',
] as const);
const DIMENSION_KEYS = Object.freeze(['height', 'width'] as const);
const SHA_256_PATTERN = /^[0-9a-f]{64}$/;

/** Loads and validates the exact selected-profile ten-raster About closure. */
export async function loadAboutResources(
  assetTree: ClassicAssetTree,
): Promise<LoadedAboutResources> {
  let profile: AboutRasterProfile;
  let rasterContracts: readonly AboutRasterResource[];
  try {
    profile = getAboutRasterResources(assetTree);
    rasterContracts = collectAboutRasterContracts(profile);
  } catch (error) {
    throw asLoaderError(
      error,
      'invalid-contract',
      'About raster contract validation failed',
    );
  }

  let loadedRasters: readonly LoadedGameRasterResource[];
  try {
    const bundle = await loadGameResourceBundle();
    loadedRasters = await loadExactGameRasters(rasterContracts, bundle);
  } catch (error) {
    throw asLoaderError(
      error,
      'resource-load-failed',
      `Failed to load exact About resources for ${assetTree}`,
    );
  }

  const rastersByPath = createExactRasterCatalog(
    rasterContracts,
    loadedRasters,
  );
  const contractsByPath = new Map(
    rasterContracts.map((resource) => [resource.canonicalPath, resource]),
  );

  return Object.freeze({
    assetTree,
    rasterCount: ABOUT_RASTER_RESOURCE_COUNT,
    raster(resource: AboutRasterResource): LoadedGameRasterResource {
      const expected = contractsByPath.get(resource.canonicalPath);
      if (expected === undefined) {
        throw new AboutResourceLoaderError(
          'raster-not-loaded',
          `About raster was not loaded: ${resource.canonicalPath}`,
          null,
          resource.canonicalPath,
        );
      }
      if (!sameRasterIdentity(resource, expected)) {
        throw new AboutResourceLoaderError(
          'raster-contract-changed',
          `About raster contract changed: ${resource.canonicalPath}`,
          null,
          resource.canonicalPath,
        );
      }
      const loaded = rastersByPath.get(resource.canonicalPath);
      if (loaded === undefined) {
        throw new AboutResourceLoaderError(
          'raster-not-loaded',
          `About raster was not loaded: ${resource.canonicalPath}`,
          null,
          resource.canonicalPath,
        );
      }
      return loaded;
    },
  });
}

/**
 * Validates a caller-supplied profile and returns an immutable canonical-order snapshot.
 */
export function collectAboutRasterContracts(
  profile: AboutRasterProfile,
): readonly AboutRasterResource[] {
  try {
    assertExactProfileShape(profile);
    const resources = orderedProfileResources(profile);
    const paths = new Set<string>();
    for (let index = 0; index < resources.length; index += 1) {
      const resource = resources[index];
      assertRasterResource(resource, `profile resource ${index}`);
      if (paths.has(resource.canonicalPath)) {
        throw new AboutResourceLoaderError(
          'invalid-contract',
          `Duplicate About raster contract: ${resource.canonicalPath}`,
          null,
          resource.canonicalPath,
        );
      }
      paths.add(resource.canonicalPath);
    }
    if (resources.length !== ABOUT_RASTER_RESOURCE_COUNT) {
      throw new AboutResourceLoaderError(
        'invalid-contract',
        `About raster profile does not contain exactly `
        + `${ABOUT_RASTER_RESOURCE_COUNT} resources`,
      );
    }
    assertCanonicalProfile(resources);
    return Object.freeze(resources.map(cloneRasterResource));
  } catch (error) {
    throw asLoaderError(
      error,
      'invalid-contract',
      'About raster contract validation failed',
    );
  }
}

function orderedProfileResources(
  profile: AboutRasterProfile,
): readonly AboutRasterResource[] {
  return [
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
  ];
}

function createExactRasterCatalog(
  contracts: readonly AboutRasterResource[],
  loadedRasters: readonly LoadedGameRasterResource[],
): ReadonlyMap<string, LoadedGameRasterResource> {
  if (
    !Array.isArray(loadedRasters)
    || loadedRasters.length !== ABOUT_RASTER_RESOURCE_COUNT
  ) {
    throw new AboutResourceLoaderError(
      'catalog-incomplete',
      'Creator returned an incomplete About raster catalog',
    );
  }
  const rastersByPath = new Map<string, LoadedGameRasterResource>();
  for (let index = 0; index < ABOUT_RASTER_RESOURCE_COUNT; index += 1) {
    if (!(index in loadedRasters)) {
      throw new AboutResourceLoaderError(
        'catalog-sparse',
        'Creator returned a sparse About raster catalog',
      );
    }
    const loaded = loadedRasters[index];
    const expected = contracts[index];
    if (loaded === undefined || expected === undefined) {
      throw new AboutResourceLoaderError(
        'catalog-incomplete',
        'Creator returned an incomplete About raster catalog',
      );
    }
    if (rastersByPath.has(loaded.canonicalPath)) {
      throw new AboutResourceLoaderError(
        'catalog-duplicate',
        `Creator returned duplicate About raster: ${loaded.canonicalPath}`,
        null,
        loaded.canonicalPath,
      );
    }
    if (loaded.canonicalPath !== expected.canonicalPath) {
      throw new AboutResourceLoaderError(
        'catalog-substituted',
        `Creator substituted About raster ${expected.canonicalPath} `
        + `with ${loaded.canonicalPath}`,
        null,
        expected.canonicalPath,
      );
    }
    if (
      loaded.dimensions.width !== expected.dimensions.width
      || loaded.dimensions.height !== expected.dimensions.height
    ) {
      throw new AboutResourceLoaderError(
        'catalog-geometry-mismatch',
        `Creator changed About raster geometry: ${expected.canonicalPath}`,
        null,
        expected.canonicalPath,
      );
    }
    rastersByPath.set(loaded.canonicalPath, loaded);
  }
  if (rastersByPath.size !== ABOUT_RASTER_RESOURCE_COUNT) {
    throw new AboutResourceLoaderError(
      'catalog-incomplete',
      'Creator returned an incomplete About raster catalog',
    );
  }
  return rastersByPath;
}

function assertCanonicalProfile(
  resources: readonly AboutRasterResource[],
): void {
  const first = resources[0];
  if (first === undefined) {
    throw new AboutResourceLoaderError(
      'invalid-contract',
      'About raster profile is empty',
    );
  }
  const assetTree = inferAssetTree(first.canonicalPath);
  const expected = collectAboutRasterResources(assetTree);
  for (let index = 0; index < expected.length; index += 1) {
    const actualResource = resources[index];
    const expectedResource = expected[index];
    if (
      actualResource === undefined
      || expectedResource === undefined
      || !sameRasterIdentity(actualResource, expectedResource)
    ) {
      throw new AboutResourceLoaderError(
        'invalid-contract',
        `About raster contract changed at profile index ${index}`,
        null,
        actualResource?.canonicalPath ?? null,
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
  throw new AboutResourceLoaderError(
    'invalid-contract',
    `About raster is outside an exact profile: ${canonicalPath}`,
    null,
    canonicalPath,
  );
}

function assertExactProfileShape(
  profile: unknown,
): asserts profile is AboutRasterProfile {
  assertExactKeys(profile, PROFILE_KEYS, 'About raster profile');
  const record = profile as unknown as Record<string, unknown>;
  assertExactKeys(record.menu, TWO_FRAME_KEYS, 'About Menu profile');
  assertExactKeys(record.review, TWO_FRAME_KEYS, 'About Review profile');
  assertExactKeys(record.email, TWO_FRAME_KEYS, 'About Email profile');
  assertExactKeys(record.like, TWO_FRAME_KEYS, 'About Like profile');
}

function assertRasterResource(
  candidate: unknown,
  semanticName: string,
): asserts candidate is AboutRasterResource {
  assertExactKeys(candidate, RASTER_KEYS, `About ${semanticName} raster`);
  const record = candidate as Record<string, unknown>;
  if (
    !Number.isSafeInteger(record.bytes)
    || (record.bytes as number) <= 0
    || typeof record.canonicalPath !== 'string'
    || record.canonicalPath.length === 0
    || typeof record.sha256 !== 'string'
    || !SHA_256_PATTERN.test(record.sha256)
  ) {
    throw new AboutResourceLoaderError(
      'invalid-contract',
      `About ${semanticName} raster identity is invalid`,
    );
  }
  assertExactKeys(
    record.dimensions,
    DIMENSION_KEYS,
    `About ${semanticName} raster dimensions`,
  );
  const dimensions = record.dimensions as Record<string, unknown>;
  if (
    !Number.isSafeInteger(dimensions.width)
    || (dimensions.width as number) <= 0
    || !Number.isSafeInteger(dimensions.height)
    || (dimensions.height as number) <= 0
  ) {
    throw new AboutResourceLoaderError(
      'invalid-contract',
      `About ${semanticName} raster dimensions must be positive safe integers`,
    );
  }
}

function assertExactKeys(
  candidate: unknown,
  expectedKeys: readonly string[],
  label: string,
): asserts candidate is Record<string, unknown> {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new AboutResourceLoaderError(
      'invalid-contract',
      `${label} must be an object`,
    );
  }
  const actualKeys = Object.keys(candidate).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  if (
    actualKeys.length !== sortedExpectedKeys.length
    || actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    throw new AboutResourceLoaderError(
      'invalid-contract',
      `${label} must expose exactly ${sortedExpectedKeys.join(', ')}`,
    );
  }
}

function sameRasterIdentity(
  actual: AboutRasterResource,
  expected: AboutRasterResource,
): boolean {
  return (
    actual.bytes === expected.bytes
    && actual.canonicalPath === expected.canonicalPath
    && actual.dimensions.height === expected.dimensions.height
    && actual.dimensions.width === expected.dimensions.width
    && actual.sha256 === expected.sha256
  );
}

function cloneRasterResource(
  resource: AboutRasterResource,
): AboutRasterResource {
  return Object.freeze({
    bytes: resource.bytes,
    canonicalPath: resource.canonicalPath,
    dimensions: Object.freeze({
      height: resource.dimensions.height,
      width: resource.dimensions.width,
    }),
    sha256: resource.sha256,
  });
}

function asLoaderError(
  error: unknown,
  code: AboutResourceLoaderErrorCode,
  message: string,
): AboutResourceLoaderError {
  if (error instanceof AboutResourceLoaderError) {
    return error;
  }
  return new AboutResourceLoaderError(code, message, error);
}
