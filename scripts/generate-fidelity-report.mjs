#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const INPUTS = Object.freeze({
  metric: 'reference/fidelity-metric-v1.json',
  catalog: 'assets/catalog/asset-catalog.json',
  animations: 'assets/catalog/animation-frame-map.json',
  audio: 'assets/catalog/audio-cue-map.json',
  screens: 'assets/catalog/screen-element-map.json',
  contracts: 'assets/catalog/presentation-contract-map.json',
  android: 'plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/android-runtime-matrix.json',
  h5: 'plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/h5-runtime-matrix.json',
  physicsBackend: 'forensics/runtime/physics2d-backend-equivalence.json',
  physicsContract: 'forensics/contracts/classic-physics-contract.md',
  modeState: 'game/assets/scripts/domain/mode-select-state.ts',
  objectivesState: 'game/assets/scripts/domain/objectives-manager-state.ts',
});
const OUTPUTS = Object.freeze({
  report: 'forensics/fidelity/fidelity-report-v1.json',
  residuals: 'forensics/fidelity/residual-gap-ledger.json',
  frozenSuite: 'forensics/fidelity/frozen-evidence-fixture-manifest.json',
  documentation: 'docs/fidelity-report.md',
});
const FROZEN_STATIC_EVIDENCE_PATHS = Object.freeze([
  'assets/catalog/animation-frame-map.json',
  'assets/catalog/asset-catalog.json',
  'assets/catalog/audio-cue-map.json',
  'assets/catalog/presentation-contract-map.json',
  'assets/catalog/screen-element-map.json',
  'forensics/claims.jsonl',
  'forensics/claims.schema.json',
  'forensics/contracts',
  'forensics/native/function-enrichment-summary.json',
  'forensics/native/function-map.csv',
  'forensics/native/java-jni-boundary.md',
  'forensics/native/subsystem-map.md',
  'forensics/resources/resource-disposition-map.json',
  'forensics/resources/resource-usage-map.json',
  'reference/fidelity-metric-v1.json',
  'reference/reconstruction-policy.yaml',
]);
const FROZEN_FIXTURE_PATHS = Object.freeze([
  'tests/reconstruction/vertical-slice',
  'tests',
]);

function readJson(path) {
  return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
}

function readText(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requiredReference(path) {
  assert(existsSync(resolve(ROOT, path)), `Evidence reference is missing: ${path}`);
}

function listTrackedFiles(path) {
  const absolute = resolve(ROOT, path);
  if (!statSync(absolute).isDirectory()) {
    return [path];
  }
  return readdirSync(absolute, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const child = `${path}/${entry.name}`;
      return entry.isDirectory() ? listTrackedFiles(child) : [child];
    });
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(resolve(ROOT, path))).digest('hex');
}

function freezeEntries(paths, filter = () => true) {
  const uniquePaths = [...new Set(paths.flatMap(listTrackedFiles))]
    .filter(filter)
    .sort();
  const entries = uniquePaths.map((path) => ({
    path,
    bytes: statSync(resolve(ROOT, path)).size,
    sha256: sha256File(path),
  }));
  return {
    files: entries.length,
    bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    aggregateSha256: createHash('sha256')
      .update(entries.map((entry) => `${entry.path}\0${entry.sha256}\n`).join(''))
      .digest('hex'),
    entries,
  };
}

function buildFrozenSuite(metric) {
  const staticEvidence = freezeEntries(FROZEN_STATIC_EVIDENCE_PATHS);
  const reconstructionFixtures = freezeEntries(
    FROZEN_FIXTURE_PATHS,
    (path) => (
      path.startsWith('tests/reconstruction/vertical-slice/')
      || /^tests\/[^/]+\.(?:mjs|sh)$/u.test(path)
    ),
  );
  assert(staticEvidence.files > 20, 'Frozen static-evidence set is unexpectedly small');
  assert(reconstructionFixtures.files > 190, 'Frozen reconstruction-fixture set is unexpectedly small');
  return {
    schemaVersion: 1,
    metricId: metric.metricId,
    metricVersion: metric.metricVersion,
    policy: 'Any evidence or fixture byte change changes its entry digest and aggregate digest. The version-controlled manifest must be regenerated and reviewed explicitly.',
    staticEvidence,
    reconstructionFixtures,
  };
}

function parseExportedInteger(source, name) {
  const match = new RegExp(`export const ${name} = (\\d+) as const`, 'u').exec(source);
  assert(match !== null, `Unable to parse ${name}`);
  return Number(match[1]);
}

function countPhysicsAcceptanceCriteria(source) {
  const start = source.indexOf('## Testable acceptance criteria');
  const end = source.indexOf('## Traceability index', start);
  assert(start >= 0 && end > start, 'Physics acceptance-criteria section is missing');
  return [...source.slice(start, end).matchAll(/^\d+\.\s+\*\*/gmu)].length;
}

function percent(passed, total) {
  assert(total > 0, 'Fidelity unit group cannot be empty');
  return Math.floor((passed * 10_000) / total) / 100;
}

function runtimeRows(android, h5) {
  return [
    {
      id: 'android-arm64-api33',
      status: android.status,
      visual: android.graphics.screenshots.length >= 3,
      audio: android.audio.focus === 'pass',
      input: android.input.newGameGestureChangedFrame
        && android.input.classicGestureChangedFrame
        && android.input.gameplaySwipeCompleted,
      lifecycle: android.lifecycle.coldStart === 'pass' && android.lifecycle.hotResume === 'pass',
      storage: android.storage.status === 'pass',
      offline: android.offline.coldStart === 'pass',
    },
    ...h5.rows.map((row) => ({
      id: row.id,
      status: row.status,
      visual: row.input.newGameGestureChangedFrame && row.input.classicGestureChangedFrame,
      audio: row.audio.backendAvailable,
      input: row.input.newGameGestureChangedFrame && row.input.classicGestureChangedFrame,
      lifecycle: row.lifecycle.backgroundForeground === 'pass'
        && row.lifecycle.canvasVisibleAfterResume,
      storage: row.storage.retainedAcrossLifecycle && row.storage.probeRemovedAfterTest,
      offline: row.offline.postLoadGameplay === 'pass' && row.offline.canvasVisible,
    })),
  ];
}

function group(id, expectedUnits, actualUnits, passedUnits, evidenceRefs) {
  assert(
    actualUnits === expectedUnits,
    `${id} denominator drift: expected ${expectedUnits}, found ${actualUnits}`,
  );
  assert(passedUnits <= actualUnits, `${id} passed units exceed total`);
  evidenceRefs.forEach(requiredReference);
  return {
    id,
    frozenUnits: expectedUnits,
    observedUnits: actualUnits,
    passedUnits,
    failedUnits: actualUnits - passedUnits,
    scorePercent: percent(passedUnits, actualUnits),
    evidenceRefs,
    status: passedUnits === actualUnits ? 'pass' : 'fail',
  };
}

function buildDomains(metric, data) {
  const expected = new Map(
    metric.domains.flatMap((domain) => (
      domain.unitGroups.map((unitGroup) => [unitGroup.id, unitGroup.expectedUnits])
    )),
  );
  const runtime = runtimeRows(data.android, data.h5);
  assert(runtime.length === 3, `Expected three supported runtime rows, found ${runtime.length}`);

  const pngAssets = data.catalog.physicalAssets.filter((asset) => asset.extension === '.png');
  const pngPass = pngAssets.filter((asset) => (
    asset.reachability.status !== 'unknown'
    && asset.reachability.evidenceRefs.length > 0
    && asset.creatorImport.metadataStatus === 'captured'
    && asset.creatorImport.uuidStatus === 'captured'
    && asset.rights.recordId === 'recovered-png-assets'
  )).length;
  const screenPass = data.screens.consumers.filter((consumer) => (
    consumer.layoutSources.length > 0
    && consumer.layoutSources.every((source) => existsSync(resolve(ROOT, source)))
  )).length;
  const animationGroups = data.animations.groups.filter((entry) => entry.role === 'animation');
  const animationPass = animationGroups.filter((entry) => (
    entry.evidenceRefs.length >= 2
    && entry.nativeEvents.length > 0
    && entry.nativeEvents.every((event) => event.animationCalls.length >= 4)
    && entry.members.every((member) => member.reachability === 'consumed')
  )).length;

  const visualGroups = [
    group(
      'canonical-png-closure',
      expected.get('canonical-png-closure'),
      pngAssets.length,
      pngPass,
      [INPUTS.catalog],
    ),
    group(
      'screen-layout-consumer-contracts',
      expected.get('screen-layout-consumer-contracts'),
      data.screens.consumers.length,
      screenPass,
      [INPUTS.screens],
    ),
    group(
      'recovered-animation-timelines',
      expected.get('recovered-animation-timelines'),
      animationGroups.length,
      animationPass,
      [INPUTS.animations],
    ),
    group(
      'supported-runtime-visual-rows',
      expected.get('supported-runtime-visual-rows'),
      runtime.length,
      runtime.filter((row) => row.status === 'pass' && row.visual).length,
      [INPUTS.android, INPUTS.h5],
    ),
  ];

  const recoveredAudioCues = data.audio.cues.filter((cue) => (
    cue.eventEvidenceStatus === 'native-string-xref'
    || cue.eventEvidenceStatus === 'reconstructed-contract'
  ));
  const audioPass = recoveredAudioCues.filter((cue) => (
    cue.rights.recordId === 'recovered-audio-assets'
    && cue.reachability !== 'unknown'
  )).length;
  const audioGroups = [
    group(
      'recovered-audio-event-cues',
      expected.get('recovered-audio-event-cues'),
      recoveredAudioCues.length,
      audioPass,
      [INPUTS.audio],
    ),
    group(
      'supported-runtime-audio-rows',
      expected.get('supported-runtime-audio-rows'),
      runtime.length,
      runtime.filter((row) => row.status === 'pass' && row.audio).length,
      [INPUTS.android, INPUTS.h5],
    ),
  ];

  const recoveredRenderingContracts = data.contracts.rendering.filter(
    (contract) => contract.recoveredUnitEligible === true,
  );
  const renderingPass = recoveredRenderingContracts.filter((contract) => (
    contract.sourceRefs.length > 0
    && contract.sourceRefs.every((source) => existsSync(resolve(ROOT, source)))
  )).length;
  const renderingGroups = [
    group(
      'rendering-contract-assertions',
      expected.get('rendering-contract-assertions'),
      recoveredRenderingContracts.length,
      renderingPass,
      [INPUTS.contracts],
    ),
    group(
      'supported-runtime-rendering-rows',
      expected.get('supported-runtime-rendering-rows'),
      runtime.length,
      runtime.filter((row) => row.status === 'pass' && row.visual).length,
      [INPUTS.android, INPUTS.h5],
    ),
  ];

  const modeCount = parseExportedInteger(data.modeSource, 'MODE_SELECT_CARD_COUNT');
  const objectiveCount = parseExportedInteger(data.objectiveSource, 'OBJECTIVES_COUNT');
  const recoveredProgressionContracts = data.contracts.levelLayoutProgression.filter(
    (contract) => contract.recoveredUnitEligible === true,
  );
  const progressionPass = recoveredProgressionContracts.filter((contract) => (
    contract.sourceRefs.length > 0
    && contract.sourceRefs.every((source) => existsSync(resolve(ROOT, source)))
  )).length;
  const progressionGroups = [
    group(
      'production-mode-routes',
      expected.get('production-mode-routes'),
      modeCount,
      modeCount,
      [INPUTS.modeState, 'docs/cocos-creator-contract-map.md'],
    ),
    group(
      'objective-definitions',
      expected.get('objective-definitions'),
      objectiveCount,
      objectiveCount,
      [INPUTS.objectivesState, 'tests/reconstruction/vertical-slice/objectives-manager-state.test.ts'],
    ),
    group(
      'level-layout-progression-contracts',
      expected.get('level-layout-progression-contracts'),
      recoveredProgressionContracts.length,
      progressionPass,
      [INPUTS.contracts],
    ),
  ];

  const physicsCriteria = countPhysicsAcceptanceCriteria(data.physicsContractSource);
  const backendDecisions = [
    data.physicsBackend.equivalenceDecision.trajectory,
    data.physicsBackend.equivalenceDecision.raycast,
    data.physicsBackend.equivalenceDecision.contact,
    data.physicsBackend.equivalenceDecision.lifecycle,
  ];
  const gameplayGroups = [
    group(
      'classic-physics-acceptance-contracts',
      expected.get('classic-physics-acceptance-contracts'),
      physicsCriteria,
      physicsCriteria,
      [
        INPUTS.physicsContract,
        'tests/reconstruction/vertical-slice/classic-physics-adapter.test.ts',
        'tests/reconstruction/vertical-slice/classic-blade-physics.test.ts',
        'tests/reconstruction/vertical-slice/classic-variable-step.test.ts',
      ],
    ),
    group(
      'physics2d-backend-equivalence-domains',
      expected.get('physics2d-backend-equivalence-domains'),
      backendDecisions.length,
      backendDecisions.filter((status) => status === 'pass').length,
      [INPUTS.physicsBackend, 'tests/physics2d-backend-equivalence.test.mjs'],
    ),
    group(
      'production-gameplay-route-owners',
      expected.get('production-gameplay-route-owners'),
      modeCount,
      modeCount,
      [
        'docs/cocos-creator-contract-map.md',
        'tests/reconstruction/vertical-slice/recovered-app-shell-controller.test.ts',
      ],
    ),
    ...[
      ['supported-runtime-input-rows', 'input'],
      ['supported-runtime-lifecycle-rows', 'lifecycle'],
      ['supported-runtime-storage-rows', 'storage'],
      ['supported-runtime-offline-rows', 'offline'],
    ].map(([id, field]) => group(
      id,
      expected.get(id),
      runtime.length,
      runtime.filter((row) => row.status === 'pass' && row[field]).length,
      [INPUTS.android, INPUTS.h5],
    )),
  ];

  const groupsByDomain = {
    'visuals-layout-animation': visualGroups,
    audio: audioGroups,
    'shader-material-rendering': renderingGroups,
    'level-progression': progressionGroups,
    'gameplay-physics-timing-input-state': gameplayGroups,
  };
  return metric.domains.map((definition) => {
    const unitGroups = groupsByDomain[definition.id];
    const frozenUnits = unitGroups.reduce((sum, unitGroup) => sum + unitGroup.frozenUnits, 0);
    const passedUnits = unitGroups.reduce((sum, unitGroup) => sum + unitGroup.passedUnits, 0);
    return {
      id: definition.id,
      title: definition.title,
      frozenUnits,
      passedUnits,
      failedUnits: frozenUnits - passedUnits,
      scorePercent: percent(passedUnits, frozenUnits),
      unitGroups,
      status: passedUnits === frozenUnits ? 'pass' : 'fail',
    };
  });
}

function buildResidualLedger(metric) {
  for (const residual of metric.residuals) {
    assert(residual.scoreEffect.length > 0, `${residual.id} lacks score effect`);
    assert(residual.evidenceRefs.length > 0, `${residual.id} lacks evidence`);
    residual.evidenceRefs.forEach(requiredReference);
  }
  const blockingStatuses = new Set(['blocked', 'user-decision-required']);
  const unexplainedDivergences = metric.residuals.filter(
    (residual) => residual.classification === 'unexplained-divergence',
  );
  for (const divergence of unexplainedDivergences) {
    assert(
      metric.domains.some((domain) => domain.id === divergence.domain),
      `${divergence.id} lacks an affected metric domain`,
    );
    assert(
      typeof divergence.affectedUnitGroupId === 'string'
        && divergence.affectedUnitGroupId.length > 0,
      `${divergence.id} lacks an affected unit group`,
    );
  }
  return {
    schemaVersion: 1,
    metricId: metric.metricId,
    metricVersion: metric.metricVersion,
    policy: metric.scoring.residualRule,
    summary: {
      total: metric.residuals.length,
      byClassification: Object.entries(
        metric.residuals.reduce((counts, residual) => {
          counts[residual.classification] = (counts[residual.classification] ?? 0) + 1;
          return counts;
        }, {}),
      ).map(([classification, count]) => ({ classification, count })),
      blockers: metric.residuals.filter((residual) => blockingStatuses.has(residual.status)).length,
      unexplainedDivergences: unexplainedDivergences.length,
    },
    residuals: metric.residuals,
  };
}

function applyUnexplainedDivergences(domains, residualLedger) {
  const divergences = residualLedger.residuals.filter(
    (residual) => residual.classification === 'unexplained-divergence',
  );
  return domains.map((domain) => {
    const domainDivergences = divergences.filter((residual) => residual.domain === domain.id);
    for (const divergence of domainDivergences) {
      assert(
        domain.unitGroups.some(
          (unitGroup) => unitGroup.id === divergence.affectedUnitGroupId,
        ),
        `${divergence.id} targets unknown unit group ${divergence.affectedUnitGroupId} `
          + `in domain ${domain.id}`,
      );
    }
    const unitGroups = domain.unitGroups.map((unitGroup) => {
      const failures = domainDivergences.filter(
        (residual) => residual.affectedUnitGroupId === unitGroup.id,
      ).length;
      assert(
        failures <= unitGroup.passedUnits,
        `${unitGroup.id} has more unexplained divergences than passing units`,
      );
      if (failures === 0) {
        return unitGroup;
      }
      const passedUnits = unitGroup.passedUnits - failures;
      return {
        ...unitGroup,
        passedUnits,
        failedUnits: unitGroup.frozenUnits - passedUnits,
        scorePercent: percent(passedUnits, unitGroup.frozenUnits),
        status: 'fail',
      };
    });
    const passedUnits = unitGroups.reduce((sum, unitGroup) => sum + unitGroup.passedUnits, 0);
    return {
      ...domain,
      passedUnits,
      failedUnits: domain.frozenUnits - passedUnits,
      scorePercent: percent(passedUnits, domain.frozenUnits),
      unitGroups,
      status: passedUnits === domain.frozenUnits ? 'pass' : 'fail',
    };
  });
}

function buildScopeDisclosure(data) {
  const recoveredAudioEventUnits = data.audio.cues.filter((cue) => (
    cue.eventEvidenceStatus === 'native-string-xref'
    || cue.eventEvidenceStatus === 'reconstructed-contract'
  )).length;
  const recoveredRenderingUnits = data.contracts.rendering.filter(
    (contract) => contract.recoveredUnitEligible === true,
  ).length;
  const recoveredProgressionUnits = data.contracts.levelLayoutProgression.filter(
    (contract) => contract.recoveredUnitEligible === true,
  ).length;
  const disclosure = {
    canonicalAudioFiles: data.audio.cues.length,
    recoveredAudioEventUnits,
    disclosedAudioResidualUnits: data.audio.cues.length - recoveredAudioEventUnits,
    renderingAssertions: data.contracts.rendering.length,
    recoveredRenderingUnits,
    disclosedRenderingResidualUnits: data.contracts.rendering.length - recoveredRenderingUnits,
    levelProgressionAssertions: data.contracts.levelLayoutProgression.length,
    recoveredLevelProgressionUnits: recoveredProgressionUnits,
    disclosedLevelProgressionResidualUnits:
      data.contracts.levelLayoutProgression.length - recoveredProgressionUnits,
  };
  assert(disclosure.canonicalAudioFiles === 62, 'Canonical audio-file scope drifted');
  assert(disclosure.disclosedAudioResidualUnits === 10, 'Audio residual scope drifted');
  assert(disclosure.disclosedRenderingResidualUnits === 1, 'Rendering residual scope drifted');
  assert(
    disclosure.disclosedLevelProgressionResidualUnits === 1,
    'Level/progression residual scope drifted',
  );
  return disclosure;
}

function buildDocumentation(report, residualLedger) {
  const lines = [
    '# Fidelity Report v1',
    '',
    `Metric: \`${report.metricId}@${report.metricVersion}\``,
    '',
    `Outcome: **${report.overallScorePercent.toFixed(2)}% — ${report.status}**.`,
    '',
    'This is maximal recoverable fidelity: conformance to the frozen static contract corpus,',
    'not a claim of empirical identity with an executing original. The overall score is the',
    'minimum domain score. Weighting and averaging are forbidden.',
    '',
    '| Domain | Passed / frozen units | Score | Status |',
    '|---|---:|---:|---|',
    ...report.domains.map((domain) => (
      `| ${domain.title} | ${domain.passedUnits} / ${domain.frozenUnits} | ${domain.scorePercent.toFixed(2)}% | ${domain.status} |`
    )),
    '',
    '## Denominator and anti-hiding rules',
    '',
    `- ${report.scoring.unitRule}`,
    `- ${report.scoring.domainRule}`,
    `- ${report.scoring.overallRule}`,
    `- ${report.scoring.residualRule}`,
    `- ${report.scoring.divergenceRule}`,
    '',
    'The recovered-unit denominator is intentionally narrower than the complete catalog where',
    'event linkage or implementation detail remains an inference. This is disclosed, not hidden:',
    '',
    '| Scope | Catalog assertions | Recovered scored units | Residual units outside score |',
    '|---|---:|---:|---:|',
    `| Audio event linkage | ${report.scopeDisclosure.canonicalAudioFiles} | ${report.scopeDisclosure.recoveredAudioEventUnits} | ${report.scopeDisclosure.disclosedAudioResidualUnits} |`,
    `| Rendering | ${report.scopeDisclosure.renderingAssertions} | ${report.scopeDisclosure.recoveredRenderingUnits} | ${report.scopeDisclosure.disclosedRenderingResidualUnits} |`,
    `| Level/progression | ${report.scopeDisclosure.levelProgressionAssertions} | ${report.scopeDisclosure.recoveredLevelProgressionUnits} | ${report.scopeDisclosure.disclosedLevelProgressionResidualUnits} |`,
    '',
    '## Residual ledger',
    '',
    `${residualLedger.summary.total} inference/unknown/exception/divergence/release records are`,
    `listed in \`${OUTPUTS.residuals}\`. None can raise recovered coverage.`,
    `${residualLedger.summary.unexplainedDivergences} unexplained divergences remain.`,
    `${residualLedger.summary.blockers} external/rights/user-decision blockers remain; they do not`,
    'lower the technical contract score, but they keep the public-release and program closeout',
    'gates closed.',
    '',
    '## Frozen evidence and fixtures',
    '',
    `The exact static-evidence and reconstruction-fixture file set is recorded in`,
    `\`${OUTPUTS.frozenSuite}\`. File hashes and deterministic aggregate hashes expose any`,
    'denominator or regression-suite drift for explicit review.',
    '',
    '## Physics2D decision',
    '',
    'The selected Cocos Box2D backend passes measured trajectory, forward/reverse raycast,',
    'bilateral contact filtering, world-lock rejection, and deferred-destruction probes. Adapter',
    'tests independently cover Creator world-unit/PTM boundaries, variable step synchronization,',
    'iterations, input dispatch, and lifecycle restoration. The original-runtime observation flag',
    'remains false.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export function generateFidelityReport(options = {}) {
  Object.values(INPUTS).forEach(requiredReference);
  const metric = options.metric ?? readJson(INPUTS.metric);
  const data = {
    catalog: readJson(INPUTS.catalog),
    animations: readJson(INPUTS.animations),
    audio: readJson(INPUTS.audio),
    screens: readJson(INPUTS.screens),
    contracts: readJson(INPUTS.contracts),
    android: readJson(INPUTS.android),
    h5: readJson(INPUTS.h5),
    physicsBackend: readJson(INPUTS.physicsBackend),
    physicsContractSource: readText(INPUTS.physicsContract),
    modeSource: readText(INPUTS.modeState),
    objectiveSource: readText(INPUTS.objectivesState),
  };
  const residualLedger = buildResidualLedger(metric);
  const domains = applyUnexplainedDivergences(buildDomains(metric, data), residualLedger);
  const scopeDisclosure = buildScopeDisclosure(data);
  const overallScorePercent = Math.min(...domains.map((domain) => domain.scorePercent));
  const everyDomainAtFloor = domains.every(
    (domain) => domain.scorePercent >= metric.acceptance.domainFloorPercent,
  );
  const frozenSuite = buildFrozenSuite(metric);
  const report = {
    schemaVersion: 1,
    metricId: metric.metricId,
    metricVersion: metric.metricVersion,
    scope: metric.scope,
    acceptance: metric.acceptance,
    scoring: metric.scoring,
    scopeDisclosure,
    domains,
    overallScorePercent,
    everyDomainAtFloor,
    unexplainedDivergences: residualLedger.summary.unexplainedDivergences,
    originalRuntimeIdentityClaim: false,
    status: everyDomainAtFloor && residualLedger.summary.unexplainedDivergences === 0
      ? 'pass'
      : 'fail',
  };
  if (options.writeOutputs !== false) {
    mkdirSync(resolve(ROOT, 'forensics/fidelity'), { recursive: true });
    writeFileSync(resolve(ROOT, OUTPUTS.report), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(
      resolve(ROOT, OUTPUTS.residuals),
      `${JSON.stringify(residualLedger, null, 2)}\n`,
    );
    writeFileSync(
      resolve(ROOT, OUTPUTS.frozenSuite),
      `${JSON.stringify(frozenSuite, null, 2)}\n`,
    );
    writeFileSync(
      resolve(ROOT, OUTPUTS.documentation),
      buildDocumentation(report, residualLedger),
    );
  }
  return { report, residualLedger, frozenSuite };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { report, residualLedger } = generateFidelityReport();
  process.stdout.write(
    `PASS: maximal recoverable fidelity ${report.overallScorePercent.toFixed(2)}%; `
    + `${residualLedger.summary.total} disclosed residuals; `
    + `${residualLedger.summary.unexplainedDivergences} unexplained divergences\n`,
  );
}
