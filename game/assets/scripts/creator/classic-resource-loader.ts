import * as Cocos from 'cc';

import {
  AssetManager,
  SpriteFrame,
  assetManager,
  type Font,
} from 'cc';

import {
  CLASSIC_CRITICAL_PARTICLE_RESOURCES,
  CLASSIC_NORMAL_FRUIT_RESOURCES,
  CLASSIC_SCORE_HUD_FONT_RESOURCE,
  canonicalResourceToBundlePath,
  canonicalRasterToSpriteFrameBundlePath,
  getClassicBombResource,
  getClassicCriticalParticleResource,
  getClassicNormalFruitResources,
  getClassicPresentationResources,
  type ClassicBombId,
  type ClassicCriticalParticleIndex,
  type ClassicFontResource,
  type ClassicNormalFruitId,
  type ClassicNormalFruitRasterSet,
  type ClassicRasterResource,
} from '../domain/classic-resource-contract';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';

export const CLASSIC_RESOURCE_BUNDLE_NAME = 'game';

export interface LoadedClassicRasterResource extends ClassicRasterResource {
  readonly spriteFrame: SpriteFrame;
}

export interface LoadedClassicFontResource extends ClassicFontResource {
  readonly font: Font;
}

export interface LoadedClassicNormalFruitResources {
  readonly cutBottom: LoadedClassicRasterResource;
  readonly cutTop: LoadedClassicRasterResource;
  readonly intact: LoadedClassicRasterResource;
}

export type LoadedClassicCriticalParticleResources = readonly [
  LoadedClassicRasterResource,
  LoadedClassicRasterResource,
  LoadedClassicRasterResource,
  LoadedClassicRasterResource,
];

export interface LoadedClassicPresentationResources {
  readonly background: LoadedClassicRasterResource;
  readonly bestScoreCup: LoadedClassicRasterResource;
  readonly doubleScorePanel: LoadedClassicRasterResource;
  readonly failFilled: LoadedClassicRasterResource;
  readonly failNormal: LoadedClassicRasterResource;
  readonly introGood: LoadedClassicRasterResource;
  readonly introLuck: LoadedClassicRasterResource;
  readonly scoreIcon: LoadedClassicRasterResource;
  readonly terminalGame: LoadedClassicRasterResource;
  readonly terminalOver: LoadedClassicRasterResource;
}

export class ClassicSliceResourceCatalog {
  readonly assetTree: ClassicAssetTree;
  readonly criticalParticles: LoadedClassicCriticalParticleResources;
  readonly presentation: LoadedClassicPresentationResources;
  readonly scoreFont: LoadedClassicFontResource;

  private readonly bombResource: LoadedClassicRasterResource;
  private readonly normalFruitResources: readonly LoadedClassicNormalFruitResources[];

  constructor(
    assetTree: ClassicAssetTree,
    presentation: LoadedClassicPresentationResources,
    normalFruitResources: readonly LoadedClassicNormalFruitResources[],
    criticalParticles: LoadedClassicCriticalParticleResources,
    bombResource: LoadedClassicRasterResource,
    scoreFont: LoadedClassicFontResource,
  ) {
    if (normalFruitResources.length !== CLASSIC_NORMAL_FRUIT_RESOURCES.length) {
      throw new Error('Classic resource catalog requires all nine ordinary fruits');
    }
    this.assetTree = assetTree;
    this.bombResource = bombResource;
    this.criticalParticles = criticalParticles;
    this.presentation = presentation;
    this.scoreFont = scoreFont;
    this.normalFruitResources = Object.freeze([...normalFruitResources]);
  }

  normalFruit(fruitId: number): LoadedClassicNormalFruitResources {
    if (!Number.isSafeInteger(fruitId) || fruitId < 0 || fruitId >= this.normalFruitResources.length) {
      throw new RangeError('fruitId must identify an ordinary Classic fruit from 0 through 8');
    }
    return this.normalFruitResources[fruitId];
  }

  bomb(bombId: number): LoadedClassicRasterResource {
    const contract = getClassicBombResource(bombId, this.assetTree);
    if (this.bombResource.canonicalPath !== contract.canonicalPath) {
      throw new Error(`Classic bomb resource mismatch for ${contract.canonicalPath}`);
    }
    return this.bombResource;
  }
}

interface SpriteLoadDescriptor {
  readonly key: string;
  readonly resource: ClassicRasterResource;
}

export async function loadClassicSliceResourceCatalog(
  assetTree: ClassicAssetTree,
): Promise<ClassicSliceResourceCatalog> {
  const descriptors = createSpriteLoadDescriptors(assetTree);
  const bundle = await loadClassicGameResourceBundle();
  const [spriteFrames, scoreFont] = await Promise.all([
    loadSpriteFrames(bundle, descriptors),
    loadClassicScoreFont(bundle),
  ]);
  const loadedByKey = new Map<string, LoadedClassicRasterResource>();
  for (let index = 0; index < descriptors.length; index += 1) {
    const descriptor = descriptors[index];
    const spriteFrame = spriteFrames[index];
    if (descriptor === undefined || spriteFrame === undefined) {
      throw new Error('Creator returned an incomplete Classic SpriteFrame batch');
    }
    assertSpriteFrameDimensions(spriteFrame, descriptor.resource);
    loadedByKey.set(descriptor.key, Object.freeze({
      ...descriptor.resource,
      spriteFrame,
    }));
  }

  const presentation = requireLoadedPresentation(assetTree, loadedByKey);
  const bombResource = requireLoadedBomb(assetTree, loadedByKey);
  const normalFruitResources = CLASSIC_NORMAL_FRUIT_RESOURCES.map(({ fruitId }) => (
    requireLoadedNormalFruit(assetTree, fruitId, loadedByKey)
  ));
  const criticalParticles = requireLoadedCriticalParticles(assetTree, loadedByKey);
  return new ClassicSliceResourceCatalog(
    assetTree,
    presentation,
    normalFruitResources,
    criticalParticles,
    bombResource,
    scoreFont,
  );
}

function createSpriteLoadDescriptors(assetTree: ClassicAssetTree): readonly SpriteLoadDescriptor[] {
  const presentation = getClassicPresentationResources(assetTree);
  const descriptors: SpriteLoadDescriptor[] = [
    descriptor('presentation.background', presentation.background),
    descriptor('presentation.bestScoreCup', presentation.bestScoreCup),
    descriptor('presentation.doubleScorePanel', presentation.doubleScorePanel),
    descriptor('presentation.failFilled', presentation.failFilled),
    descriptor('presentation.failNormal', presentation.failNormal),
    descriptor('presentation.introGood', presentation.introGood),
    descriptor('presentation.introLuck', presentation.introLuck),
    descriptor('presentation.scoreIcon', presentation.scoreIcon),
    descriptor('presentation.terminalGame', presentation.terminalGame),
    descriptor('presentation.terminalOver', presentation.terminalOver),
    descriptor(bombKey(0), getClassicBombResource(0, assetTree)),
  ];
  for (const definition of CLASSIC_NORMAL_FRUIT_RESOURCES) {
    const resources = getClassicNormalFruitResources(definition.fruitId, assetTree);
    descriptors.push(
      descriptor(fruitKey(definition.fruitId, 'intact'), resources.intact),
      descriptor(fruitKey(definition.fruitId, 'cutTop'), resources.cutTop),
      descriptor(fruitKey(definition.fruitId, 'cutBottom'), resources.cutBottom),
    );
  }
  for (let index = 1; index <= CLASSIC_CRITICAL_PARTICLE_RESOURCES[assetTree].length; index += 1) {
    const particleIndex = index as ClassicCriticalParticleIndex;
    descriptors.push(descriptor(
      criticalParticleKey(particleIndex),
      getClassicCriticalParticleResource(particleIndex, assetTree),
    ));
  }
  return Object.freeze(descriptors);
}

export function loadClassicGameResourceBundle(): Promise<AssetManager.Bundle> {
  const loaded = assetManager.getBundle(CLASSIC_RESOURCE_BUNDLE_NAME);
  if (loaded !== null) {
    return Promise.resolve(loaded);
  }
  return new Promise((resolve, reject) => {
    assetManager.loadBundle(CLASSIC_RESOURCE_BUNDLE_NAME, (error, bundle) => {
      if (error !== null && error !== undefined) {
        reject(new Error(`Failed to load ${CLASSIC_RESOURCE_BUNDLE_NAME} bundle: ${error.message}`));
        return;
      }
      if (bundle === null || bundle === undefined) {
        reject(new Error(`Creator returned no ${CLASSIC_RESOURCE_BUNDLE_NAME} bundle`));
        return;
      }
      resolve(bundle);
    });
  });
}

function loadSpriteFrames(
  bundle: AssetManager.Bundle,
  descriptors: readonly SpriteLoadDescriptor[],
): Promise<readonly SpriteFrame[]> {
  // Creator 3.8.8 indexes each PNG's SpriteFrame as an explicit sub-asset.
  // Runtime getInfoWithPath(basePath, SpriteFrame) returns null in Preview, so
  // keep the generated /spriteFrame suffix in the consumer contract.
  const paths = descriptors.map(({ resource }) => (
    canonicalRasterToSpriteFrameBundlePath(resource.canonicalPath)
  ));
  return new Promise((resolve, reject) => {
    bundle.load(paths, SpriteFrame, (error, spriteFrames) => {
      if (error !== null && error !== undefined) {
        reject(new Error(`Failed to load Classic SpriteFrames: ${error.message}`));
        return;
      }
      if (spriteFrames === null || spriteFrames === undefined) {
        reject(new Error('Creator returned no Classic SpriteFrames'));
        return;
      }
      resolve(Object.freeze([...spriteFrames]));
    });
  });
}

function loadClassicScoreFont(bundle: AssetManager.Bundle): Promise<LoadedClassicFontResource> {
  const canonicalPath = CLASSIC_SCORE_HUD_FONT_RESOURCE.canonicalPath;
  const bundlePath = canonicalResourceToBundlePath(canonicalPath);
  return new Promise((resolve, reject) => {
    bundle.load(bundlePath, Cocos.Font, (error, font) => {
      if (error !== null && error !== undefined) {
        reject(new Error(`Failed to load Classic score font: ${error.message}`));
        return;
      }
      if (font === null || font === undefined) {
        reject(new Error(`Creator returned no Classic score font for ${canonicalPath}`));
        return;
      }
      resolve(Object.freeze({
        ...CLASSIC_SCORE_HUD_FONT_RESOURCE,
        font,
      }));
    });
  });
}

function requireLoadedPresentation(
  assetTree: ClassicAssetTree,
  loadedByKey: ReadonlyMap<string, LoadedClassicRasterResource>,
): LoadedClassicPresentationResources {
  const contract = getClassicPresentationResources(assetTree);
  return Object.freeze({
    background: requireLoaded('presentation.background', contract.background, loadedByKey),
    bestScoreCup: requireLoaded(
      'presentation.bestScoreCup',
      contract.bestScoreCup,
      loadedByKey,
    ),
    doubleScorePanel: requireLoaded(
      'presentation.doubleScorePanel',
      contract.doubleScorePanel,
      loadedByKey,
    ),
    failFilled: requireLoaded('presentation.failFilled', contract.failFilled, loadedByKey),
    failNormal: requireLoaded('presentation.failNormal', contract.failNormal, loadedByKey),
    introGood: requireLoaded('presentation.introGood', contract.introGood, loadedByKey),
    introLuck: requireLoaded('presentation.introLuck', contract.introLuck, loadedByKey),
    scoreIcon: requireLoaded('presentation.scoreIcon', contract.scoreIcon, loadedByKey),
    terminalGame: requireLoaded('presentation.terminalGame', contract.terminalGame, loadedByKey),
    terminalOver: requireLoaded('presentation.terminalOver', contract.terminalOver, loadedByKey),
  });
}

function requireLoadedNormalFruit(
  assetTree: ClassicAssetTree,
  fruitId: ClassicNormalFruitId,
  loadedByKey: ReadonlyMap<string, LoadedClassicRasterResource>,
): LoadedClassicNormalFruitResources {
  const contract = getClassicNormalFruitResources(fruitId, assetTree);
  return Object.freeze({
    intact: requireLoaded(fruitKey(fruitId, 'intact'), contract.intact, loadedByKey),
    cutTop: requireLoaded(fruitKey(fruitId, 'cutTop'), contract.cutTop, loadedByKey),
    cutBottom: requireLoaded(fruitKey(fruitId, 'cutBottom'), contract.cutBottom, loadedByKey),
  });
}

function requireLoadedBomb(
  assetTree: ClassicAssetTree,
  loadedByKey: ReadonlyMap<string, LoadedClassicRasterResource>,
): LoadedClassicRasterResource {
  const bombId: ClassicBombId = 0;
  const contract = getClassicBombResource(bombId, assetTree);
  return requireLoaded(bombKey(bombId), contract, loadedByKey);
}

function requireLoadedCriticalParticles(
  assetTree: ClassicAssetTree,
  loadedByKey: ReadonlyMap<string, LoadedClassicRasterResource>,
): LoadedClassicCriticalParticleResources {
  return Object.freeze([1, 2, 3, 4].map((index) => {
    const particleIndex = index as ClassicCriticalParticleIndex;
    return requireLoaded(
      criticalParticleKey(particleIndex),
      getClassicCriticalParticleResource(particleIndex, assetTree),
      loadedByKey,
    );
  })) as LoadedClassicCriticalParticleResources;
}

function requireLoaded(
  key: string,
  contract: ClassicRasterResource,
  loadedByKey: ReadonlyMap<string, LoadedClassicRasterResource>,
): LoadedClassicRasterResource {
  const loaded = loadedByKey.get(key);
  if (loaded === undefined || loaded.canonicalPath !== contract.canonicalPath) {
    throw new Error(`Missing loaded Classic resource ${contract.canonicalPath}`);
  }
  return loaded;
}

function descriptor(key: string, resource: ClassicRasterResource): SpriteLoadDescriptor {
  return Object.freeze({ key, resource });
}

function fruitKey(
  fruitId: ClassicNormalFruitId,
  kind: keyof ClassicNormalFruitRasterSet,
): string {
  return `fruit.${fruitId}.${kind}`;
}

function criticalParticleKey(index: ClassicCriticalParticleIndex): string {
  return `critical-particle.${index}`;
}

function bombKey(bombId: ClassicBombId): string {
  return `bomb.${bombId}`;
}

function assertSpriteFrameDimensions(
  spriteFrame: SpriteFrame,
  resource: ClassicRasterResource,
): void {
  const original = spriteFrame.originalSize;
  if (
    original.width !== resource.dimensions.width
    || original.height !== resource.dimensions.height
    || spriteFrame.rect.width !== resource.dimensions.width
    || spriteFrame.rect.height !== resource.dimensions.height
  ) {
    throw new Error(
      `Creator SpriteFrame geometry mismatch for ${resource.canonicalPath}: `
      + `expected ${resource.dimensions.width}x${resource.dimensions.height}, `
      + `got original ${original.width}x${original.height} and rect `
      + `${spriteFrame.rect.width}x${spriteFrame.rect.height}`,
    );
  }
}
