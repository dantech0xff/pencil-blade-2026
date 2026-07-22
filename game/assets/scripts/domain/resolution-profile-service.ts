/** Recovered bootstrap resolution and asset-tree selection. */

export type ClassicAssetTree = '480x800' | '720x1280';

export interface ClassicResolutionProfile {
  readonly assetTree: ClassicAssetTree;
  readonly contentScaleFactor: 1;
  readonly designHeight: 800 | 1280;
  readonly designWidth: 480 | 720;
  readonly legacyPolicyArgument: 2;
}

export const CLASSIC_HIGH_RESOLUTION_FRAME_WIDTH = 720;

const COMPACT_PROFILE: ClassicResolutionProfile = Object.freeze({
  assetTree: '480x800',
  contentScaleFactor: 1,
  designHeight: 800,
  designWidth: 480,
  legacyPolicyArgument: 2,
});

const HIGH_PROFILE: ClassicResolutionProfile = Object.freeze({
  assetTree: '720x1280',
  contentScaleFactor: 1,
  designHeight: 1280,
  designWidth: 720,
  legacyPolicyArgument: 2,
});

export class ResolutionProfileService {
  select(physicalFrameWidth: number): ClassicResolutionProfile {
    assertPositive(physicalFrameWidth, 'physicalFrameWidth');
    return physicalFrameWidth >= CLASSIC_HIGH_RESOLUTION_FRAME_WIDTH
      ? HIGH_PROFILE
      : COMPACT_PROFILE;
  }
}

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be finite and positive`);
  }
}
