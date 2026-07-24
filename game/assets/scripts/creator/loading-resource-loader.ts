import {
  LOADING_RASTER_RESOURCE_COUNT,
  collectLoadingRasterResources,
  type LoadingRasterResource,
} from '../domain/loading-resource-contract';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import {
  loadExactGameRasters,
  loadGameResourceBundle,
  type LoadedGameRasterResource,
} from './game-resource-loader';

export interface LoadedLoadingResources {
  readonly assetTree: ClassicAssetTree;
  readonly rasterCount: typeof LOADING_RASTER_RESOURCE_COUNT;
  raster(resource: LoadingRasterResource): LoadedGameRasterResource;
}

/** Loads the exact selected-profile four-raster native Loading closure. */
export async function loadLoadingResources(
  assetTree: ClassicAssetTree,
): Promise<LoadedLoadingResources> {
  const contracts = collectLoadingRasterResources(assetTree);
  const bundle = await loadGameResourceBundle();
  const loaded = await loadExactGameRasters(contracts, bundle);
  if (loaded.length !== LOADING_RASTER_RESOURCE_COUNT) {
    throw new Error('Creator returned an incomplete Loading raster catalog');
  }

  const loadedByPath = new Map<string, LoadedGameRasterResource>();
  for (let index = 0; index < contracts.length; index += 1) {
    const contract = contracts[index];
    const resource = loaded[index];
    if (contract === undefined || resource === undefined) {
      throw new Error('Creator returned an incomplete Loading raster catalog');
    }
    if (
      resource.canonicalPath !== contract.canonicalPath
      || resource.dimensions.width !== contract.dimensions.width
      || resource.dimensions.height !== contract.dimensions.height
    ) {
      throw new Error(`Creator substituted Loading raster ${contract.canonicalPath}`);
    }
    if (loadedByPath.has(resource.canonicalPath)) {
      throw new Error(`Creator returned duplicate Loading raster ${resource.canonicalPath}`);
    }
    loadedByPath.set(resource.canonicalPath, resource);
  }

  const contractsByPath = new Map(
    contracts.map((resource) => [resource.canonicalPath, resource] as const),
  );
  return Object.freeze({
    assetTree,
    rasterCount: LOADING_RASTER_RESOURCE_COUNT,
    raster(resource: LoadingRasterResource): LoadedGameRasterResource {
      const expected = contractsByPath.get(resource.canonicalPath);
      if (
        expected === undefined
        || !sameRasterIdentity(resource, expected)
      ) {
        throw new Error(`Loading raster contract changed: ${resource.canonicalPath}`);
      }
      const result = loadedByPath.get(resource.canonicalPath);
      if (result === undefined) {
        throw new Error(`Loading raster was not loaded: ${resource.canonicalPath}`);
      }
      return result;
    },
  });
}

function sameRasterIdentity(
  left: LoadingRasterResource,
  right: LoadingRasterResource,
): boolean {
  return (
    left.bytes === right.bytes
    && left.canonicalPath === right.canonicalPath
    && left.dimensions.width === right.dimensions.width
    && left.dimensions.height === right.dimensions.height
    && left.sha256 === right.sha256
  );
}
