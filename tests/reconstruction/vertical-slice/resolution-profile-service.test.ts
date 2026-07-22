import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLASSIC_HIGH_RESOLUTION_FRAME_WIDTH,
  ResolutionProfileService,
} from '../../../game/assets/scripts/domain/resolution-profile-service.ts';

test('physical frame widths below 720 select the compact Classic profile', () => {
  const profile = new ResolutionProfileService().select(719);

  assert.deepEqual(profile, {
    assetTree: '480x800',
    contentScaleFactor: 1,
    designHeight: 800,
    designWidth: 480,
    legacyPolicyArgument: 2,
  });
});

test('physical frame widths at and above 720 select the high Classic profile', () => {
  const service = new ResolutionProfileService();

  assert.equal(CLASSIC_HIGH_RESOLUTION_FRAME_WIDTH, 720);
  assert.deepEqual(service.select(720), {
    assetTree: '720x1280',
    contentScaleFactor: 1,
    designHeight: 1280,
    designWidth: 720,
    legacyPolicyArgument: 2,
  });
  assert.equal(service.select(1080), service.select(720));
});

test('resolution selection rejects non-positive and non-finite widths', () => {
  const service = new ResolutionProfileService();

  assert.throws(() => service.select(0), RangeError);
  assert.throws(() => service.select(-1), RangeError);
  assert.throws(() => service.select(Number.NaN), RangeError);
  assert.throws(() => service.select(Number.POSITIVE_INFINITY), RangeError);
});
