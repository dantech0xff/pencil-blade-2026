import * as Cocos from 'cc';

import {
  AssetManager,
  SpriteFrame,
  assetManager,
  type Font,
} from 'cc';

import {
  CLASSIC_COMBO_FONT_RESOURCE,
  CLASSIC_CRITICAL_PARTICLE_RESOURCES,
  CLASSIC_NORMAL_FRUIT_RESOURCES,
  CLASSIC_RESULT_FONT_RESOURCES,
  CLASSIC_SCORE_HUD_FONT_RESOURCE,
  canonicalResourceToBundlePath,
  canonicalRasterToSpriteFrameBundlePath,
  getClassicBombResource,
  getClassicBombSmokeResource,
  getClassicCriticalParticleResource,
  getClassicDefaultBladeResource,
  getClassicNormalFruitResources,
  getClassicPresentationResources,
  getClassicResultResources,
  type ClassicBombId,
  type ClassicCriticalParticleIndex,
  type ClassicFontResource,
  type ClassicNormalFruitId,
  type ClassicNormalFruitRasterSet,
  type ClassicRasterResource,
  type ClassicResultFontSet,
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

export interface LoadedClassicResultResources {
  readonly background: LoadedClassicRasterResource;
  readonly bonusCoinsBadge: LoadedClassicRasterResource;
  readonly bonusCoinsEffect: LoadedClassicRasterResource;
  readonly bonusParticle: LoadedClassicRasterResource;
  readonly coin: LoadedClassicRasterResource;
  readonly header: LoadedClassicRasterResource;
  readonly medalNone: LoadedClassicRasterResource;
  readonly menuNormal: LoadedClassicRasterResource;
  readonly menuSelected: LoadedClassicRasterResource;
  readonly retryNormal: LoadedClassicRasterResource;
  readonly retrySelected: LoadedClassicRasterResource;
  readonly totalCoins: LoadedClassicRasterResource;
}

export interface LoadedClassicResultFonts {
  readonly agencyB: LoadedClassicFontResource;
  readonly slabThing: LoadedClassicFontResource;
}

export class ClassicSliceResourceCatalog {
  readonly assetTree: ClassicAssetTree;
  readonly bombSmoke: LoadedClassicRasterResource;
  readonly comboFont: LoadedClassicFontResource;
  readonly criticalParticles: LoadedClassicCriticalParticleResources;
  readonly defaultBlade: LoadedClassicRasterResource;
  readonly presentation: LoadedClassicPresentationResources;
  readonly result: LoadedClassicResultResources;
  readonly resultFonts: LoadedClassicResultFonts;
  readonly scoreFont: LoadedClassicFontResource;

  private readonly bombResource: LoadedClassicRasterResource;
  private readonly normalFruitResources: readonly LoadedClassicNormalFruitResources[];

  constructor(
    assetTree: ClassicAssetTree,
    presentation: LoadedClassicPresentationResources,
    normalFruitResources: readonly LoadedClassicNormalFruitResources[],
    criticalParticles: LoadedClassicCriticalParticleResources,
    bombResource: LoadedClassicRasterResource,
    bombSmoke: LoadedClassicRasterResource,
    defaultBlade: LoadedClassicRasterResource,
    scoreFont: LoadedClassicFontResource,
    comboFont: LoadedClassicFontResource,
    result: LoadedClassicResultResources,
    resultFonts: LoadedClassicResultFonts,
  ) {
    if (normalFruitResources.length !== CLASSIC_NORMAL_FRUIT_RESOURCES.length) {
      throw new Error('Classic resource catalog requires all nine ordinary fruits');
    }
    this.assetTree = assetTree;
    this.bombResource = bombResource;
    this.bombSmoke = bombSmoke;
    this.comboFont = comboFont;
    this.criticalParticles = criticalParticles;
    this.defaultBlade = defaultBlade;
    this.presentation = presentation;
    this.result = result;
    this.resultFonts = resultFonts;
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
  const [spriteFrames, scoreFont, comboFont, resultFonts] = await Promise.all([
    loadSpriteFrames(bundle, descriptors),
    loadClassicScoreFont(bundle),
    loadClassicComboFont(bundle),
    loadClassicResultFonts(bundle),
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
  const result = requireLoadedResult(assetTree, loadedByKey);
  const bombResource = requireLoadedBomb(assetTree, loadedByKey);
  const bombSmoke = requireLoadedBombSmoke(assetTree, loadedByKey);
  const normalFruitResources = CLASSIC_NORMAL_FRUIT_RESOURCES.map(({ fruitId }) => (
    requireLoadedNormalFruit(assetTree, fruitId, loadedByKey)
  ));
  const criticalParticles = requireLoadedCriticalParticles(assetTree, loadedByKey);
  const defaultBlade = requireLoadedDefaultBlade(assetTree, loadedByKey);
  return new ClassicSliceResourceCatalog(
    assetTree,
    presentation,
    normalFruitResources,
    criticalParticles,
    bombResource,
    bombSmoke,
    defaultBlade,
    scoreFont,
    comboFont,
    result,
    resultFonts,
  );
}

function createSpriteLoadDescriptors(assetTree: ClassicAssetTree): readonly SpriteLoadDescriptor[] {
  const presentation = getClassicPresentationResources(assetTree);
  const result = getClassicResultResources(assetTree);
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
    descriptor('result.background', result.background),
    descriptor('result.bonusCoinsBadge', result.bonusCoinsBadge),
    descriptor('result.bonusCoinsEffect', result.bonusCoinsEffect),
    descriptor('result.bonusParticle', result.bonusParticle),
    descriptor('result.coin', result.coin),
    descriptor('result.header', result.header),
    descriptor('result.medalNone', result.medalNone),
    descriptor('result.menuNormal', result.menuNormal),
    descriptor('result.menuSelected', result.menuSelected),
    descriptor('result.retryNormal', result.retryNormal),
    descriptor('result.retrySelected', result.retrySelected),
    descriptor('result.totalCoins', result.totalCoins),
    descriptor(bombKey(0), getClassicBombResource(0, assetTree)),
    descriptor(bombSmokeKey(), getClassicBombSmokeResource(assetTree)),
    descriptor(defaultBladeKey(0), getClassicDefaultBladeResource(0, assetTree)),
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

function loadClassicComboFont(bundle: AssetManager.Bundle): Promise<LoadedClassicFontResource> {
  const canonicalPath = CLASSIC_COMBO_FONT_RESOURCE.canonicalPath;
  const bundlePath = canonicalResourceToBundlePath(canonicalPath);
  return new Promise((resolve, reject) => {
    bundle.load(bundlePath, Cocos.Font, (error, font) => {
      if (error !== null && error !== undefined) {
        reject(new Error(`Failed to load Classic combo font: ${error.message}`));
        return;
      }
      if (font === null || font === undefined) {
        reject(new Error(`Creator returned no Classic combo font for ${canonicalPath}`));
        return;
      }
      resolve(Object.freeze({
        ...CLASSIC_COMBO_FONT_RESOURCE,
        font,
      }));
    });
  });
}

function loadClassicResultFonts(bundle: AssetManager.Bundle): Promise<LoadedClassicResultFonts> {
  return Promise.all([
    loadClassicResultFont(bundle, 'agencyB', CLASSIC_RESULT_FONT_RESOURCES.agencyB),
    loadClassicResultFont(bundle, 'slabThing', CLASSIC_RESULT_FONT_RESOURCES.slabThing),
  ]).then(([agencyB, slabThing]) => Object.freeze({ agencyB, slabThing }));
}

function loadClassicResultFont(
  bundle: AssetManager.Bundle,
  key: keyof ClassicResultFontSet,
  resource: ClassicFontResource,
): Promise<LoadedClassicFontResource> {
  const bundlePath = canonicalResourceToBundlePath(resource.canonicalPath);
  return new Promise((resolve, reject) => {
    bundle.load(bundlePath, Cocos.Font, (error, font) => {
      if (error !== null && error !== undefined) {
        reject(new Error(`Failed to load Classic result font ${key}: ${error.message}`));
        return;
      }
      if (font === null || font === undefined) {
        reject(new Error(`Creator returned no Classic result font for ${resource.canonicalPath}`));
        return;
      }
      resolve(Object.freeze({ ...resource, font }));
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

function requireLoadedResult(
  assetTree: ClassicAssetTree,
  loadedByKey: ReadonlyMap<string, LoadedClassicRasterResource>,
): LoadedClassicResultResources {
  const contract = getClassicResultResources(assetTree);
  return Object.freeze({
    background: requireLoaded('result.background', contract.background, loadedByKey),
    bonusCoinsBadge: requireLoaded(
      'result.bonusCoinsBadge',
      contract.bonusCoinsBadge,
      loadedByKey,
    ),
    bonusCoinsEffect: requireLoaded(
      'result.bonusCoinsEffect',
      contract.bonusCoinsEffect,
      loadedByKey,
    ),
    bonusParticle: requireLoaded(
      'result.bonusParticle',
      contract.bonusParticle,
      loadedByKey,
    ),
    coin: requireLoaded('result.coin', contract.coin, loadedByKey),
    header: requireLoaded('result.header', contract.header, loadedByKey),
    medalNone: requireLoaded('result.medalNone', contract.medalNone, loadedByKey),
    menuNormal: requireLoaded('result.menuNormal', contract.menuNormal, loadedByKey),
    menuSelected: requireLoaded('result.menuSelected', contract.menuSelected, loadedByKey),
    retryNormal: requireLoaded('result.retryNormal', contract.retryNormal, loadedByKey),
    retrySelected: requireLoaded('result.retrySelected', contract.retrySelected, loadedByKey),
    totalCoins: requireLoaded('result.totalCoins', contract.totalCoins, loadedByKey),
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

function requireLoadedBombSmoke(
  assetTree: ClassicAssetTree,
  loadedByKey: ReadonlyMap<string, LoadedClassicRasterResource>,
): LoadedClassicRasterResource {
  const contract = getClassicBombSmokeResource(assetTree);
  return requireLoaded(bombSmokeKey(), contract, loadedByKey);
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

function requireLoadedDefaultBlade(
  assetTree: ClassicAssetTree,
  loadedByKey: ReadonlyMap<string, LoadedClassicRasterResource>,
): LoadedClassicRasterResource {
  const selectedBladeId = 0;
  const contract = getClassicDefaultBladeResource(selectedBladeId, assetTree);
  return requireLoaded(defaultBladeKey(selectedBladeId), contract, loadedByKey);
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

function bombSmokeKey(): string {
  return 'bomb.smoke';
}

function defaultBladeKey(selectedBladeId: 0): string {
  return `blade.${selectedBladeId}`;
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
