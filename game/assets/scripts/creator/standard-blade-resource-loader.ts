import type { AssetManager } from 'cc';

import {
  STANDARD_BLADE_RASTER_RESOURCE_COUNT,
  getStandardBasicBladeResource,
  getStandardBladeParticleResources,
  getStandardBladeResourceProfile,
  getStandardBladeRasterResources,
  getStandardCentipedeBladeResources,
  getStandardDragonBladeResources,
  type StandardBasicBladeId,
  type StandardBladeMultipartResources,
  type StandardDragonBladeId,
  type StandardDragonBladeVariant,
} from '../domain/standard-blade-resource-contract';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import {
  loadExactGameRasters,
  type LoadedGameRasterResource,
} from './game-resource-loader';

export interface LoadedStandardBladeMultipartResources {
  readonly body: LoadedGameRasterResource;
  readonly bodySegmentCount: 15 | 20;
  readonly head: LoadedGameRasterResource;
  readonly pointCapacity: 32;
  readonly tail: LoadedGameRasterResource;
}

export type LoadedStandardBladeResourceProfile =
  | Readonly<{
      readonly bladeId: StandardBasicBladeId;
      readonly kind: 'basic';
      readonly particles: readonly LoadedGameRasterResource[];
      readonly texture: LoadedGameRasterResource;
    }>
  | Readonly<{
      readonly bladeId: StandardDragonBladeId;
      readonly kind: 'dragon';
      readonly particles: readonly [];
      readonly resources: LoadedStandardBladeMultipartResources;
      readonly variant: StandardDragonBladeVariant;
    }>
  | Readonly<{
      readonly bladeId: 17;
      readonly kind: 'centipede';
      readonly particles: readonly [];
      readonly resources: LoadedStandardBladeMultipartResources;
    }>;

/** Process-owned exact raster closure for all standard cosmetic blade IDs. */
export class LoadedStandardBladeResources {
  readonly assetTree: ClassicAssetTree;

  private readonly loadedByCanonicalPath: ReadonlyMap<string, LoadedGameRasterResource>;

  constructor(
    assetTree: ClassicAssetTree,
    loaded: readonly LoadedGameRasterResource[],
  ) {
    const contracts = getStandardBladeRasterResources(assetTree);
    if (
      loaded.length !== STANDARD_BLADE_RASTER_RESOURCE_COUNT
      || loaded.length !== contracts.length
    ) {
      throw new Error('Loaded standard blade closure must contain exactly 50 rasters');
    }
    const loadedByCanonicalPath = new Map<string, LoadedGameRasterResource>();
    for (let index = 0; index < contracts.length; index += 1) {
      const resource = loaded[index];
      const contract = contracts[index];
      if (
        resource === undefined
        || contract === undefined
        || resource.canonicalPath !== contract.canonicalPath
        || resource.dimensions.width !== contract.dimensions.width
        || resource.dimensions.height !== contract.dimensions.height
      ) {
        throw new Error(
          `Loaded standard blade resource ${index} does not match its exact contract`,
        );
      }
      if (loadedByCanonicalPath.has(resource.canonicalPath)) {
        throw new Error(`Duplicate loaded standard blade resource ${resource.canonicalPath}`);
      }
      loadedByCanonicalPath.set(resource.canonicalPath, Object.freeze({
        canonicalPath: resource.canonicalPath,
        dimensions: Object.freeze({
          height: resource.dimensions.height,
          width: resource.dimensions.width,
        }),
        spriteFrame: resource.spriteFrame,
      }));
    }
    if (loadedByCanonicalPath.size !== STANDARD_BLADE_RASTER_RESOURCE_COUNT) {
      throw new Error('Loaded standard blade closure must contain exactly 50 rasters');
    }
    this.assetTree = assetTree;
    this.loadedByCanonicalPath = loadedByCanonicalPath;
  }

  basic(bladeId: StandardBasicBladeId): LoadedGameRasterResource {
    return this.requireLoaded(getStandardBasicBladeResource(bladeId, this.assetTree));
  }

  dragon(bladeId: StandardDragonBladeId): LoadedStandardBladeMultipartResources {
    return this.requireMultipart(
      getStandardDragonBladeResources(bladeId, this.assetTree),
    );
  }

  centipede(): LoadedStandardBladeMultipartResources {
    return this.requireMultipart(getStandardCentipedeBladeResources(this.assetTree));
  }

  particles(bladeId: StandardBasicBladeId): readonly LoadedGameRasterResource[] {
    return Object.freeze(
      getStandardBladeParticleResources(bladeId, this.assetTree)
        .map((resource) => this.requireLoaded(resource)),
    );
  }

  profile(bladeId: number): LoadedStandardBladeResourceProfile {
    const contract = getStandardBladeResourceProfile(bladeId, this.assetTree);
    switch (contract.kind) {
      case 'basic':
        return Object.freeze({
          bladeId: contract.bladeId,
          kind: contract.kind,
          particles: this.particles(contract.bladeId),
          texture: this.basic(contract.bladeId),
        });
      case 'dragon':
        return Object.freeze({
          bladeId: contract.bladeId,
          kind: contract.kind,
          particles: Object.freeze([]) as readonly [],
          resources: this.dragon(contract.bladeId),
          variant: contract.variant,
        });
      case 'centipede':
        return Object.freeze({
          bladeId: contract.bladeId,
          kind: contract.kind,
          particles: Object.freeze([]) as readonly [],
          resources: this.centipede(),
        });
    }
  }

  private requireMultipart(
    contract: StandardBladeMultipartResources,
  ): LoadedStandardBladeMultipartResources {
    return Object.freeze({
      body: this.requireLoaded(contract.body),
      bodySegmentCount: contract.bodySegmentCount,
      head: this.requireLoaded(contract.head),
      pointCapacity: contract.pointCapacity,
      tail: this.requireLoaded(contract.tail),
    });
  }

  private requireLoaded(
    contract: Readonly<{
      readonly canonicalPath: string;
      readonly dimensions: Readonly<{ readonly height: number; readonly width: number }>;
    }>,
  ): LoadedGameRasterResource {
    const loaded = this.loadedByCanonicalPath.get(contract.canonicalPath);
    if (
      loaded === undefined
      || loaded.dimensions.width !== contract.dimensions.width
      || loaded.dimensions.height !== contract.dimensions.height
    ) {
      throw new Error(`Missing loaded standard blade resource ${contract.canonicalPath}`);
    }
    return loaded;
  }
}

export async function loadStandardBladeResources(
  assetTree: ClassicAssetTree,
  bundle?: AssetManager.Bundle,
): Promise<LoadedStandardBladeResources> {
  const contracts = getStandardBladeRasterResources(assetTree);
  const loaded = await loadExactGameRasters(contracts, bundle);
  return new LoadedStandardBladeResources(assetTree, loaded);
}
