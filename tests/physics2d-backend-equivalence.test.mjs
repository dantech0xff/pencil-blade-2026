#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  probePhysics2dBackendEquivalence,
} from '../scripts/probe-physics2d-backend-equivalence.mjs';

test('selected Cocos Box2D backend satisfies recovered trajectory/raycast/contact/lifecycle contract', () => {
  const report = probePhysics2dBackendEquivalence();

  assert.equal(report.status, 'pass');
  assert.equal(report.equivalenceDecision.originalRuntimeObservation, false);
  assert.equal(report.equivalenceDecision.status, 'pass');
  assert.equal(report.trajectory.rows.length, 3);
  assert.ok(report.trajectory.rows.every((row) => row.status === 'pass'));
  assert.equal(report.raycast.duplicateFixtureOccurrencesPreserved, true);
  assert.equal(report.contactAndLifecycle.acceptedBombElectric.beginContacts, 1);
  assert.equal(
    report.contactAndLifecycle.acceptedBombElectric.directDestroyRejectedWhileLocked,
    true,
  );
  assert.equal(
    report.contactAndLifecycle.acceptedBombElectric.bodyCountAfterDeferredFlush,
    1,
  );
  assert.equal(report.contactAndLifecycle.rejectedFruitBomb.beginContacts, 0);
  assert.ok(report.residuals.length > 0);
  assert.ok(report.residuals.every((residual) => residual.effectOnCoverage));
});
