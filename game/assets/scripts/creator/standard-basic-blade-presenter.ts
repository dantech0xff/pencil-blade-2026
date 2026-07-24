import {
  Node,
  isValid,
} from 'cc';

import type {
  BladePoint,
  BladeSegment,
} from '../domain/blade-tracks';
import type { StandardBladeParticleRandom } from '../domain/standard-blade-particle-plan';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import type { StandardBasicBladeId } from '../domain/standard-blade-resource-contract';
import { ClassicBladePresenter } from './classic-blade-presenter';
import type { LoadedGameRasterResource } from './game-resource-loader';
import {
  StandardBladeParticlePresenter,
} from './standard-blade-particle-presenter';
import type {
  LoadedStandardBladeResourceProfile,
} from './standard-blade-resource-loader';

export interface StandardBasicBladePresenterInput {
  readonly assetTree: ClassicAssetTree;
  readonly profile: LoadedStandardBladeResourceProfile;
  readonly random: StandardBladeParticleRandom;
  readonly viewportWidth: number;
}

type LoadedStandardBasicBladeProfile = Extract<
  LoadedStandardBladeResourceProfile,
  Readonly<{ readonly kind: 'basic' }>
>;

/**
 * Exact Creator owner for standard Basic blade IDs 0..12.
 *
 * Trail input and post-physics particle presentation remain deliberately separate:
 * `begin`/`move`/`end` mutate only the four-slot trail, while accepted moved segments
 * reach particles only through `presentMovedSegment`.
 */
export class StandardBasicBladePresenter {
  readonly particlePresenter: StandardBladeParticlePresenter;
  readonly selectedBladeId: StandardBasicBladeId;
  readonly trailPresenter: ClassicBladePresenter;

  private attached = false;
  private disposed = false;

  private constructor(
    selectedBladeId: StandardBasicBladeId,
    trailPresenter: ClassicBladePresenter,
    particlePresenter: StandardBladeParticlePresenter,
  ) {
    this.selectedBladeId = selectedBladeId;
    this.trailPresenter = trailPresenter;
    this.particlePresenter = particlePresenter;
  }

  static create(
    input: StandardBasicBladePresenterInput,
  ): StandardBasicBladePresenter {
    const profile = requireBasicProfile(input);
    assertClassicSpriteFrame(profile.texture);

    let particlePresenter: StandardBladeParticlePresenter | null = null;
    try {
      particlePresenter = StandardBladeParticlePresenter.create({
        assetTree: input.assetTree,
        random: input.random,
        resources: profile.particles,
        selectedBladeId: profile.bladeId,
        viewportWidth: input.viewportWidth,
      });
      const trailPresenter = ClassicBladePresenter.create({
        assetTree: input.assetTree,
        resource: profile.texture,
        selectedBladeId: profile.bladeId,
        viewportWidth: input.viewportWidth,
      });
      return new StandardBasicBladePresenter(
        profile.bladeId,
        trailPresenter,
        particlePresenter,
      );
    } catch (error) {
      particlePresenter?.dispose();
      throw error;
    }
  }

  attach(parent: Node): void {
    this.assertUsable('attach');
    if (this.attached) {
      throw new Error('Standard BasicBlade presenter is already attached');
    }
    try {
      this.particlePresenter.attach(parent);
      this.trailPresenter.attach(parent);
      this.attached = true;
    } catch (error) {
      try {
        this.dispose();
      } catch {
        // Preserve the attachment failure that selected the rollback path.
      }
      throw error;
    }
  }

  begin(slot: number): void {
    this.assertReady('begin');
    this.trailPresenter.begin(slot);
  }

  move(slot: number, point: BladePoint): void {
    this.assertReady('move');
    this.trailPresenter.move(slot, point);
  }

  presentMovedSegment(segment: BladeSegment): void {
    this.assertReady('present a moved segment');
    this.particlePresenter.presentMovedSegment(segment);
  }

  end(slot: number): void {
    this.assertReady('end');
    this.trailPresenter.end(slot);
  }

  isClaimed(slot: number): boolean {
    this.assertReady('inspect ownership');
    return this.trailPresenter.isClaimed(slot);
  }

  /** Advances one native trail-disposal frame and the elapsed particle action clock. */
  update(deltaSeconds: number): void {
    this.assertReady('update');
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    this.trailPresenter.updateFrame();
    this.particlePresenter.update(deltaSeconds);
  }

  dispose(): boolean {
    if (this.disposed) {
      return false;
    }
    this.disposed = true;
    this.attached = false;

    let firstFailure: unknown;
    let failed = false;
    try {
      this.particlePresenter.dispose();
    } catch (error) {
      firstFailure = error;
      failed = true;
    }
    try {
      this.trailPresenter.dispose();
    } catch (error) {
      if (!failed) {
        firstFailure = error;
        failed = true;
      }
    }
    if (failed) {
      throw firstFailure;
    }
    return true;
  }

  private assertUsable(operation: string): void {
    if (this.disposed) {
      throw new Error(`Disposed Standard BasicBlade presenter cannot ${operation}`);
    }
  }

  private assertReady(operation: string): void {
    this.assertUsable(operation);
    if (!this.attached) {
      throw new Error(
        `Standard BasicBlade presenter must be attached before it can ${operation}`,
      );
    }
  }
}

function requireBasicProfile(
  input: StandardBasicBladePresenterInput,
): LoadedStandardBasicBladeProfile {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Standard BasicBlade input must be an object');
  }
  const profile = input.profile;
  if (
    profile === null
    || typeof profile !== 'object'
    || profile.kind !== 'basic'
  ) {
    throw new Error('Standard BasicBlade requires an exact loaded basic profile');
  }
  return profile;
}

/**
 * ClassicBladePresenter allocates its persistent mesh owners before reading SpriteFrame UVs.
 * Validate that engine-facing value first so malformed construction cannot orphan those owners.
 */
function assertClassicSpriteFrame(resource: LoadedGameRasterResource): void {
  const spriteFrame = resource?.spriteFrame;
  const uv = spriteFrame?.uv;
  if (
    !isValid(spriteFrame, true)
    || !Array.isArray(uv)
    || uv.length < 8
    || uv.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(
      'Standard BasicBlade texture must provide a valid finite four-corner SpriteFrame UV quad',
    );
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be non-negative and finite`);
  }
}
