import { ResolutionPolicy, screen, view } from 'cc';

import {
  ResolutionProfileService,
  type ClassicResolutionProfile,
} from '../domain/resolution-profile-service';

export interface ClassicVisibleRect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface AppliedClassicResolution {
  readonly physicalFrameWidth: number;
  readonly profile: ClassicResolutionProfile;
  readonly visibleRect: ClassicVisibleRect;
}

/** Applies the recovered bootstrap choice through Cocos Creator's public view API. */
export class ClassicResolutionAdapter {
  private readonly profiles: ResolutionProfileService;

  constructor(profiles: ResolutionProfileService = new ResolutionProfileService()) {
    this.profiles = profiles;
  }

  apply(): AppliedClassicResolution {
    const physicalFrameWidth = screen.windowSize.width;
    const profile = this.profiles.select(physicalFrameWidth);
    if (ResolutionPolicy.SHOW_ALL !== profile.legacyPolicyArgument) {
      throw new Error('Cocos SHOW_ALL no longer matches recovered resolution policy 2');
    }

    view.setDesignResolutionSize(
      profile.designWidth,
      profile.designHeight,
      ResolutionPolicy.SHOW_ALL,
    );

    const origin = view.getVisibleOrigin();
    const size = view.getVisibleSize();
    return Object.freeze({
      physicalFrameWidth,
      profile,
      visibleRect: Object.freeze({
        height: size.height,
        width: size.width,
        x: origin.x,
        y: origin.y,
      }),
    });
  }
}
