import {
  GN_STYLE_SUPPLEMENTAL_RASTER_COUNT,
  listGnStyleSupplementalRasterResources,
} from '../domain/gn-style-resource-contract';
import {
  type GameAssetTree,
  type GameRasterResource,
} from '../domain/game-resource-contract';
import {
  loadExactGameRasters,
  loadGameResourceBundle,
  type LoadedGameRasterResource,
} from './game-resource-loader';

export interface LoadedGnStyleResources {
  readonly assetTree: GameAssetTree;
  readonly rasterCount: typeof GN_STYLE_SUPPLEMENTAL_RASTER_COUNT;
  raster(resource: GameRasterResource): LoadedGameRasterResource;
}

/** Loads only the five GN intro rasters and six exact choreography sprite families. */
export async function loadGnStyleResources(
  assetTree: GameAssetTree,
): Promise<LoadedGnStyleResources> {
  const rasterContracts = listGnStyleSupplementalRasterResources(assetTree);
  if (rasterContracts.length !== GN_STYLE_SUPPLEMENTAL_RASTER_COUNT) {
    throw new Error(
      `GN Style must load exactly ${
        String(GN_STYLE_SUPPLEMENTAL_RASTER_COUNT)
      } supplemental rasters`,
    );
  }
  const bundle = await loadGameResourceBundle();
  const rasters = await loadExactGameRasters(rasterContracts, bundle);
  const rastersByPath = new Map<string, LoadedGameRasterResource>();
  for (const raster of rasters) {
    if (rastersByPath.has(raster.canonicalPath)) {
      throw new Error(
        `Creator returned duplicate GN Style raster ${raster.canonicalPath}`,
      );
    }
    rastersByPath.set(raster.canonicalPath, raster);
  }
  if (rastersByPath.size !== GN_STYLE_SUPPLEMENTAL_RASTER_COUNT) {
    throw new Error('Creator returned an incomplete GN Style supplemental raster catalog');
  }

  const raster = (resource: GameRasterResource): LoadedGameRasterResource => {
    const loaded = rastersByPath.get(resource.canonicalPath);
    if (loaded === undefined) {
      throw new Error(`GN Style raster was not loaded: ${resource.canonicalPath}`);
    }
    if (
      loaded.dimensions.width !== resource.dimensions.width
      || loaded.dimensions.height !== resource.dimensions.height
    ) {
      throw new Error(`GN Style raster contract changed: ${resource.canonicalPath}`);
    }
    return loaded;
  };

  return Object.freeze({
    assetTree,
    rasterCount: GN_STYLE_SUPPLEMENTAL_RASTER_COUNT,
    raster,
  });
}
