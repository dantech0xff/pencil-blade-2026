#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { generateFidelityReport } from '../scripts/generate-fidelity-report.mjs';

test('five-domain metric uses a minimum score and keeps every residual outside recovered credit', () => {
  const { report, residualLedger, frozenSuite } = generateFidelityReport({
    writeOutputs: false,
  });

  assert.equal(report.metricVersion, '1.1.0');
  assert.equal(report.acceptance.weighting, 'forbidden');
  assert.equal(report.acceptance.overallRule, 'minimum-domain-score');
  assert.equal(report.domains.length, 5);
  assert.equal(report.overallScorePercent, 100);
  assert.equal(
    report.overallScorePercent,
    Math.min(...report.domains.map((domain) => domain.scorePercent)),
  );
  assert.ok(report.domains.every((domain) => domain.scorePercent >= 99));
  assert.ok(report.domains.every((domain) => domain.failedUnits === 0));
  assert.equal(report.everyDomainAtFloor, true);
  assert.equal(report.originalRuntimeIdentityClaim, false);
  assert.equal(report.unexplainedDivergences, 0);
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.scopeDisclosure, {
    canonicalAudioFiles: 62,
    recoveredAudioEventUnits: 52,
    disclosedAudioResidualUnits: 10,
    renderingAssertions: 4,
    recoveredRenderingUnits: 3,
    disclosedRenderingResidualUnits: 1,
    levelProgressionAssertions: 4,
    recoveredLevelProgressionUnits: 3,
    disclosedLevelProgressionResidualUnits: 1,
  });

  assert.ok(residualLedger.summary.total >= 20);
  assert.ok(residualLedger.summary.blockers >= 3);
  assert.equal(residualLedger.summary.unexplainedDivergences, 0);
  assert.ok(
    residualLedger.residuals.every((residual) => (
      residual.scoreEffect.length > 0
      && residual.evidenceRefs.length > 0
    )),
  );

  assert.ok(frozenSuite.staticEvidence.files > 20);
  assert.ok(frozenSuite.reconstructionFixtures.files > 190);
  assert.match(frozenSuite.staticEvidence.aggregateSha256, /^[0-9a-f]{64}$/u);
  assert.match(frozenSuite.reconstructionFixtures.aggregateSha256, /^[0-9a-f]{64}$/u);
  assert.ok(
    [...frozenSuite.staticEvidence.entries, ...frozenSuite.reconstructionFixtures.entries]
      .every((entry) => entry.bytes > 0 && /^[0-9a-f]{64}$/u.test(entry.sha256)),
  );
});

test('an unexplained divergence fails its affected unit, domain, and overall report', () => {
  const metric = JSON.parse(readFileSync('reference/fidelity-metric-v1.json', 'utf8'));
  metric.residuals.push({
    id: 'TEST-UNEXPLAINED-DIVERGENCE',
    domain: 'audio',
    affectedUnitGroupId: 'recovered-audio-event-cues',
    classification: 'unexplained-divergence',
    status: 'open',
    statement: 'Negative fixture for the divergence failure path.',
    scoreEffect: 'fails-affected-recovered-unit-and-release-gate',
    evidenceRefs: ['tests/generate-fidelity-report.test.mjs'],
  });

  const { report, residualLedger } = generateFidelityReport({
    metric,
    writeOutputs: false,
  });
  const audio = report.domains.find((domain) => domain.id === 'audio');
  const affectedGroup = audio.unitGroups.find(
    (unitGroup) => unitGroup.id === 'recovered-audio-event-cues',
  );
  assert.equal(residualLedger.summary.unexplainedDivergences, 1);
  assert.equal(affectedGroup.failedUnits, 1);
  assert.equal(affectedGroup.status, 'fail');
  assert.equal(audio.failedUnits, 1);
  assert.equal(audio.status, 'fail');
  assert.equal(report.unexplainedDivergences, 1);
  assert.equal(report.status, 'fail');
  assert.ok(report.overallScorePercent < 99);
});

test('an unexplained divergence cannot target a missing unit group', () => {
  const metric = JSON.parse(readFileSync('reference/fidelity-metric-v1.json', 'utf8'));
  metric.residuals.push({
    id: 'TEST-MISSING-DIVERGENCE-TARGET',
    domain: 'audio',
    affectedUnitGroupId: 'missing-audio-unit-group',
    classification: 'unexplained-divergence',
    status: 'open',
    statement: 'Negative fixture for a missing divergence unit-group target.',
    scoreEffect: 'must-be-rejected-before-scoring',
    evidenceRefs: ['tests/generate-fidelity-report.test.mjs'],
  });

  assert.throws(
    () => generateFidelityReport({ metric, writeOutputs: false }),
    /targets unknown unit group missing-audio-unit-group in domain audio/u,
  );
});

test('an unexplained divergence cannot target a unit group from another domain', () => {
  const metric = JSON.parse(readFileSync('reference/fidelity-metric-v1.json', 'utf8'));
  metric.residuals.push({
    id: 'TEST-CROSS-DOMAIN-DIVERGENCE-TARGET',
    domain: 'audio',
    affectedUnitGroupId: 'physics2d-backend-equivalence-domains',
    classification: 'unexplained-divergence',
    status: 'open',
    statement: 'Negative fixture for a cross-domain divergence unit-group target.',
    scoreEffect: 'must-be-rejected-before-scoring',
    evidenceRefs: ['tests/generate-fidelity-report.test.mjs'],
  });

  assert.throws(
    () => generateFidelityReport({ metric, writeOutputs: false }),
    /targets unknown unit group physics2d-backend-equivalence-domains in domain audio/u,
  );
});
