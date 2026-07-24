import type { Node } from 'cc';

import type {
  BladePoint,
  BladeSegment,
} from '../domain/blade-tracks';
import type { StandardBladeParticleRandom } from '../domain/standard-blade-particle-plan';
import type { ClassicAssetTree } from '../domain/resolution-profile-service';
import {
  assertStandardBladeId,
  type StandardBladeId,
} from '../domain/standard-blade-resource-contract';
import {
  StandardAdvancedBladePresenter,
} from './standard-advanced-blade-presenter';
import {
  StandardBasicBladePresenter,
} from './standard-basic-blade-presenter';
import type {
  LoadedStandardBladeResourceProfile,
} from './standard-blade-resource-loader';

export type StandardBladePresenterKind =
  LoadedStandardBladeResourceProfile['kind'];

export const STANDARD_BLADE_SLOT_COUNT = 4 as const;

export interface StandardBladePresenterInput {
  readonly assetTree: ClassicAssetTree;
  readonly profile: LoadedStandardBladeResourceProfile;
  readonly random: StandardBladeParticleRandom;
  readonly viewportWidth: number;
}

type LoadedStandardBasicBladeProfile = Extract<
  LoadedStandardBladeResourceProfile,
  Readonly<{ readonly kind: 'basic' }>
>;
type LoadedStandardAdvancedBladeProfile = Extract<
  LoadedStandardBladeResourceProfile,
  Readonly<{ readonly kind: 'dragon' | 'centipede' }>
>;

interface RuntimeStandardBladeProfile {
  readonly bladeId: StandardBladeId;
  readonly kind: unknown;
}

export interface StandardBladePresentation {
  readonly kind: StandardBladePresenterKind;
  readonly selectedBladeId: StandardBladeId;

  attach(parent: Node): void;
  begin(slot: number): void;
  dispose(): boolean;
  end(slot: number): void;
  isClaimed(slot: number): boolean;
  move(slot: number, point: BladePoint): void;
  presentMovedSegment(segment: BladeSegment): void;
  update(deltaSeconds: number): void;
}

type StandardBladeOwner =
  | Readonly<{
      readonly kind: 'basic';
      readonly presenter: StandardBasicBladePresenter;
    }>
  | Readonly<{
      readonly kind: 'dragon' | 'centipede';
      readonly presenter: StandardAdvancedBladePresenter;
    }>;

/**
 * Exhaustive standard cosmetic blade facade for IDs 0 through 17.
 *
 * Basic trails retain the moved-segment particle boundary. Advanced movement is already applied
 * by `move`, so its matching boundary validates the segment and intentionally emits nothing.
 */
export class StandardBladePresenter implements StandardBladePresentation {
  readonly kind: StandardBladePresenterKind;
  readonly selectedBladeId: StandardBladeId;

  private attached = false;
  private disposed = false;
  private readonly owner: StandardBladeOwner;

  private constructor(
    owner: StandardBladeOwner,
    selectedBladeId: StandardBladeId,
  ) {
    this.kind = owner.kind;
    this.owner = owner;
    this.selectedBladeId = selectedBladeId;
  }

  static create(input: StandardBladePresenterInput): StandardBladePresenter {
    const profile = requireProfile(input);
    switch (profile.bladeId) {
      case 0:
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
      case 8:
      case 9:
      case 10:
      case 11:
      case 12: {
        if (profile.kind !== 'basic') {
          throw profileKindMismatch(profile.bladeId, 'basic', profile.kind);
        }
        const basicProfile = profile as unknown as LoadedStandardBasicBladeProfile;
        const presenter = StandardBasicBladePresenter.create({
          assetTree: input.assetTree,
          profile: basicProfile,
          random: input.random,
          viewportWidth: input.viewportWidth,
        });
        return new StandardBladePresenter(
          Object.freeze({ kind: 'basic', presenter }),
          basicProfile.bladeId,
        );
      }
      case 13:
      case 14:
      case 15:
      case 16: {
        if (profile.kind !== 'dragon') {
          throw profileKindMismatch(profile.bladeId, 'dragon', profile.kind);
        }
        const dragonProfile = profile as unknown as LoadedStandardAdvancedBladeProfile;
        const presenter = StandardAdvancedBladePresenter.create({
          assetTree: input.assetTree,
          profile: dragonProfile,
        });
        return new StandardBladePresenter(
          Object.freeze({ kind: 'dragon', presenter }),
          dragonProfile.bladeId,
        );
      }
      case 17: {
        if (profile.kind !== 'centipede') {
          throw profileKindMismatch(profile.bladeId, 'centipede', profile.kind);
        }
        const centipedeProfile = profile as unknown as LoadedStandardAdvancedBladeProfile;
        const presenter = StandardAdvancedBladePresenter.create({
          assetTree: input.assetTree,
          profile: centipedeProfile,
        });
        return new StandardBladePresenter(
          Object.freeze({ kind: 'centipede', presenter }),
          centipedeProfile.bladeId,
        );
      }
    }
  }

  attach(parent: Node): void {
    this.assertUsable('attach');
    if (this.attached) {
      throw new Error('Standard blade presenter is already attached');
    }
    try {
      this.owner.presenter.attach(parent);
      this.attached = true;
    } catch (error) {
      this.disposed = true;
      try {
        this.owner.presenter.dispose();
      } catch {
        // Preserve the attachment failure that selected this rollback path.
      }
      throw error;
    }
  }

  begin(slot: number): void {
    this.assertReady('begin');
    this.owner.presenter.begin(slot);
  }

  move(slot: number, point: BladePoint): void {
    this.assertReady('move');
    this.owner.presenter.move(slot, point);
  }

  presentMovedSegment(segment: BladeSegment): void {
    this.assertReady('present a moved segment');
    if (this.owner.kind === 'basic') {
      this.owner.presenter.presentMovedSegment(segment);
      return;
    }
    assertBladeSegment(segment);
  }

  end(slot: number): void {
    this.assertReady('end');
    this.owner.presenter.end(slot);
  }

  isClaimed(slot: number): boolean {
    this.assertReady('inspect ownership');
    return this.owner.presenter.isClaimed(slot);
  }

  update(deltaSeconds: number): void {
    this.assertReady('update');
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (this.owner.kind === 'basic') {
      this.owner.presenter.update(deltaSeconds);
      return;
    }
    this.owner.presenter.updateFrame();
  }

  dispose(): boolean {
    if (this.disposed) {
      return false;
    }
    this.disposed = true;
    this.attached = false;
    this.owner.presenter.dispose();
    return true;
  }

  private assertUsable(operation: string): void {
    if (this.disposed) {
      throw new Error(`Disposed standard blade presenter cannot ${operation}`);
    }
  }

  private assertReady(operation: string): void {
    this.assertUsable(operation);
    if (!this.attached) {
      throw new Error(
        `Standard blade presenter must be attached before it can ${operation}`,
      );
    }
  }
}

function requireProfile(
  input: StandardBladePresenterInput,
): RuntimeStandardBladeProfile {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Standard blade presenter input must be an object');
  }
  const profile = input.profile;
  if (profile === null || typeof profile !== 'object') {
    throw new TypeError('Standard blade presenter profile must be an object');
  }
  assertStandardBladeId(profile.bladeId);
  return profile as unknown as RuntimeStandardBladeProfile;
}

function profileKindMismatch(
  bladeId: StandardBladeId,
  expected: StandardBladePresenterKind,
  actual: unknown,
): Error {
  return new Error(
    `Standard blade ID ${bladeId} requires ${expected} profile, got ${String(actual)}`,
  );
}

function assertBladeSegment(segment: BladeSegment): void {
  if (
    segment === null
    || typeof segment !== 'object'
    || !Number.isFinite(segment.current?.x)
    || !Number.isFinite(segment.current?.y)
    || !Number.isFinite(segment.previous?.x)
    || !Number.isFinite(segment.previous?.y)
    || !Number.isSafeInteger(segment.slot)
    || segment.slot < 0
    || segment.slot > 3
    || !Number.isSafeInteger(segment.touchId)
    || segment.touchId === -1
  ) {
    throw new RangeError('Standard advanced blade moved segment is invalid');
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be non-negative and finite`);
  }
}
