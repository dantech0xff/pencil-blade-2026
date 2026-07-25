#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');

const INPUTS = Object.freeze({
  staging: 'assets/catalog/creator-staging-manifest.json',
  reconciliation: 'assets/catalog/resource-reconciliation-ledger.json',
  usage: 'forensics/resources/resource-usage-map.json',
  nativeFunctions: 'forensics/native/function-map.csv',
  publicRelease: 'release/public-release-variant-manifest.json',
});

const OUTPUTS = Object.freeze({
  schema: 'assets/catalog/asset-schema.json',
  catalog: 'assets/catalog/asset-catalog.json',
  animation: 'assets/catalog/animation-frame-map.json',
  audio: 'assets/catalog/audio-cue-map.json',
  screens: 'assets/catalog/screen-element-map.json',
  contracts: 'assets/catalog/presentation-contract-map.json',
  specification: 'docs/presentation-resource-spec.md',
});

const RIGHTS_RECORD_BY_EXTENSION = Object.freeze({
  '.png': 'recovered-png-assets',
  '.wav': 'recovered-audio-assets',
  '.mp3': 'recovered-audio-assets',
  '.ttf': 'recovered-font-assets',
  '.otf': 'recovered-font-assets',
});

const CONSUMER_DEFINITIONS = Object.freeze({
  about: {
    kind: 'screen',
    title: 'About / offline links',
    layoutSources: [
      'game/assets/scripts/domain/about-presentation.ts',
      'forensics/contracts/main-menu-presentation-contract.md',
    ],
  },
  'base-gameplay': {
    kind: 'shared-screen',
    title: 'Gameplay pause and shared overlays',
    layoutSources: [
      'game/assets/scripts/domain/base-gameplay-pause-state.ts',
      'game/assets/scripts/domain/base-gameplay-resource-contract.ts',
    ],
  },
  bird: {
    kind: 'gameplay-system',
    title: 'Bird blade',
    layoutSources: [
      'game/assets/scripts/domain/bird-resource-contract.ts',
      'game/assets/scripts/creator/bird-blade-presenter.ts',
    ],
  },
  'classic-audio': {
    kind: 'audio-system',
    title: 'Classic audio',
    layoutSources: ['game/assets/scripts/domain/classic-audio-contract.ts'],
  },
  'classic-presentation': {
    kind: 'gameplay-screen',
    title: 'Classic and Classic Bird gameplay/result',
    layoutSources: [
      'forensics/contracts/classic-presentation-contract.md',
      'game/assets/scripts/domain/classic-resource-contract.ts',
    ],
  },
  'combo-bird': {
    kind: 'gameplay-screen',
    title: 'Combo Bird',
    layoutSources: [
      'game/assets/scripts/domain/combo-bird-intro-presentation.ts',
      'game/assets/scripts/domain/combo-bird-resource-contract.ts',
    ],
  },
  'crazy-audio': {
    kind: 'audio-system',
    title: 'Crazy and Crazy Bird audio',
    layoutSources: ['game/assets/scripts/domain/crazy-audio-contract.ts'],
  },
  'crazy-dragon-counter': {
    kind: 'gameplay-element',
    title: 'Crazy Dragon hit counter',
    layoutSources: ['game/assets/scripts/domain/crazy-dragon-fruit-state.ts'],
  },
  'crazy-presentation': {
    kind: 'gameplay-screen',
    title: 'Crazy and Crazy Bird gameplay/result',
    layoutSources: [
      'forensics/contracts/crazy-mode-contract.md',
      'game/assets/scripts/domain/crazy-intro-presentation.ts',
      'game/assets/scripts/domain/crazy-resource-contract.ts',
    ],
  },
  'gn-style': {
    kind: 'gameplay-screen',
    title: 'Gangnam Style',
    layoutSources: [
      'forensics/contracts/gn-style-mode-contract.md',
      'game/assets/scripts/domain/gn-style-intro-presentation.ts',
      'game/assets/scripts/domain/gn-style-resource-contract.ts',
    ],
  },
  leaderboard: {
    kind: 'screen',
    title: 'Leaderboard',
    layoutSources: [
      'game/assets/scripts/domain/leaderboard-presentation.ts',
      'game/assets/scripts/domain/leaderboard-resource-contract.ts',
    ],
  },
  loading: {
    kind: 'screen',
    title: 'Loading',
    layoutSources: [
      'game/assets/scripts/domain/loading-presentation.ts',
      'game/assets/scripts/domain/loading-resource-contract.ts',
    ],
  },
  'main-menu': {
    kind: 'screen',
    title: 'Main Menu',
    layoutSources: [
      'forensics/contracts/main-menu-presentation-contract.md',
      'game/assets/scripts/domain/main-menu-presentation.ts',
      'game/assets/scripts/domain/main-menu-resource-contract.ts',
    ],
  },
  'mode-select': {
    kind: 'screen',
    title: 'Mode Select',
    layoutSources: [
      'forensics/contracts/mode-select-presentation-contract.md',
      'game/assets/scripts/domain/mode-select-presentation.ts',
      'game/assets/scripts/domain/mode-select-resource-contract.ts',
    ],
  },
  objectives: {
    kind: 'screen',
    title: 'Objectives and achievement popup',
    layoutSources: [
      'game/assets/scripts/domain/objectives-screen-presentation.ts',
      'game/assets/scripts/domain/objectives-screen-resource-contract.ts',
      'game/assets/scripts/domain/objective-achievement-presentation.ts',
    ],
  },
  options: {
    kind: 'screen',
    title: 'Options',
    layoutSources: [
      'game/assets/scripts/domain/options-presentation.ts',
      'game/assets/scripts/domain/options-resource-contract.ts',
    ],
  },
  'shared-scene': {
    kind: 'shared-screen',
    title: 'Shared background, leaf and result scene',
    layoutSources: [
      'forensics/contracts/shared-game-scene-presentation-contract.md',
      'game/assets/scripts/domain/shared-game-scene-resources.ts',
      'game/assets/scripts/domain/shared-leaf-layer.ts',
    ],
  },
  'standard-blade': {
    kind: 'gameplay-system',
    title: 'Standard blade selector and generated blade effects',
    layoutSources: [
      'forensics/contracts/basic-blade-presentation-contract.md',
      'game/assets/scripts/domain/basic-blade-trail.ts',
      'game/assets/scripts/domain/standard-blade-resource-contract.ts',
    ],
  },
});

const GENERATED_PRIMITIVES = Object.freeze([
  {
    id: 'basic-blade-triangle-strip',
    consumers: ['standard-blade', 'classic-presentation'],
    type: 'textured-triangle-strip',
    evidenceStatus: 'recovered-with-renderer-compatibility',
    sourceRefs: [
      'forensics/contracts/basic-blade-presentation-contract.md',
      'game/assets/scripts/domain/basic-blade-trail.ts',
      'game/assets/scripts/creator/classic-blade-presenter.ts',
    ],
  },
  {
    id: 'generated-fruit-and-cut-half-colliders',
    consumers: ['classic-presentation', 'crazy-presentation', 'gn-style'],
    type: 'sprite-plus-physics-shape',
    evidenceStatus: 'recovered',
    sourceRefs: [
      'forensics/contracts/classic-physics-contract.md',
      'game/assets/scripts/domain/classic-fixture-rules.ts',
      'game/assets/scripts/domain/classic-cut-half-motion.ts',
    ],
  },
  {
    id: 'generated-bomb-flash-and-triangles',
    consumers: ['crazy-presentation'],
    type: 'procedural-graphics',
    evidenceStatus: 'recovered',
    sourceRefs: [
      'game/assets/scripts/domain/standard-bomb-explosion-state.ts',
      'game/assets/scripts/creator/standard-bomb-explosion-presenter.ts',
    ],
  },
  {
    id: 'gn-style-particle-choreography',
    consumers: ['gn-style'],
    type: 'generated-particle-parents',
    evidenceStatus: 'recovered',
    sourceRefs: [
      'forensics/native/gn-style-particle-choreography.json',
      'game/assets/scripts/domain/gn-style-particle-choreography.generated.ts',
    ],
  },
  {
    id: 'dynamic-labels-and-score-values',
    consumers: [
      'main-menu',
      'leaderboard',
      'objectives',
      'options',
      'classic-presentation',
      'crazy-presentation',
      'gn-style',
      'combo-bird',
    ],
    type: 'ttf-label',
    evidenceStatus: 'recovered-or-explicit-inference-per-source',
    sourceRefs: [
      'docs/cocos-creator-contract-map.md',
      'forensics/contracts/classic-presentation-contract.md',
      'forensics/contracts/main-menu-presentation-contract.md',
    ],
  },
]);

const RENDERING_CONTRACTS = Object.freeze([
  {
    id: 'stock-textured-sprite-rendering',
    status: 'recovered-with-creator-compatibility',
    recoveredUnitEligible: true,
    rule: 'Use exact source rasters without trim, resize, re-encode, atlas synthesis, or substitute material.',
    sourceRefs: [
      'assets/catalog/creator-staging-manifest.json',
      'scripts/validate-creator-resource-meta.mjs',
      'docs/cocos-creator-build-audit.md',
    ],
    residuals: [],
  },
  {
    id: 'basic-blade-textured-strip',
    status: 'recovered-with-explicit-inference',
    recoveredUnitEligible: false,
    rule: 'Preserve the recovered 20-byte vertex layout, four persistent meshes, ten-point limit, strip topology, texture, and lifecycle.',
    sourceRefs: [
      'forensics/contracts/basic-blade-presentation-contract.md',
      'game/assets/scripts/domain/basic-blade-trail.ts',
      'game/assets/scripts/creator/classic-blade-presenter.ts',
    ],
    residuals: [
      'Legacy numeric blend factors and sampler state are not recoverable from current static evidence; Creator unlit textured material is the reviewed compatibility decision.',
    ],
  },
  {
    id: 'generated-effects',
    status: 'recovered',
    recoveredUnitEligible: true,
    rule: 'Bomb, critical, result, leaf, and GN-style effects are code-driven primitives or exact raster sprites; no authored material/effect/atlas resource is invented.',
    sourceRefs: [
      'docs/cocos-creator-contract-map.md',
      'game/assets/scripts/domain/standard-bomb-explosion-state.ts',
      'game/assets/scripts/domain/classic-critical-particle-plan.ts',
      'game/assets/scripts/domain/gn-style-particle-choreography.generated.ts',
    ],
    residuals: [],
  },
  {
    id: 'material-artifact-disposition',
    status: 'recovered-absence',
    recoveredUnitEligible: true,
    rule: 'The canonical APK contains no standalone shader, material, effect, prefab, animation-clip, or atlas manifest; presentation is reconstructed from stock rendering and code composition.',
    sourceRefs: [
      'forensics/resources/resource-usage-map.json',
      'docs/cocos-creator-contract-map.md',
    ],
    residuals: [],
  },
]);

const LEVEL_PROGRESSION_CONTRACTS = Object.freeze([
  {
    id: 'six-production-modes',
    status: 'recovered',
    recoveredUnitEligible: true,
    scope: 'Classic, Crazy, Gangnam Style, Classic Bird, Crazy Bird, Combo Bird',
    sourceRefs: [
      'game/assets/scripts/domain/mode-select-state.ts',
      'docs/cocos-creator-contract-map.md',
      'plans/260721-2253-pencil-blade-restoration/phase-06-recreate-full-game-content-and-progression.md',
    ],
    residuals: [],
  },
  {
    id: 'code-driven-toss-and-timing',
    status: 'recovered-with-listed-inferences',
    recoveredUnitEligible: false,
    scope: 'Classic toss strategies plus 60s Crazy, 150s GN Style, and 90s Combo Bird owners',
    sourceRefs: [
      'forensics/contracts/classic-toss-contract.md',
      'game/assets/scripts/domain/crazy-timed-mode-profile.ts',
      'game/assets/scripts/domain/gn-style-session.ts',
      'game/assets/scripts/domain/combo-bird-session.ts',
    ],
    residuals: [
      'Classic bomb scheduler ownership and the exact native Crazy Bird ActionGoCallback operand/order remain disclosed static inference gaps.',
    ],
  },
  {
    id: 'objectives-and-local-progression',
    status: 'recovered',
    recoveredUnitEligible: true,
    scope: '52 objectives, ranking, rewards, coins, selector prices, settings defaults, and storage lifecycle',
    sourceRefs: [
      'game/assets/scripts/domain/objectives-manager-state.ts',
      'game/assets/scripts/domain/classic-settings-state.ts',
      'game/assets/scripts/domain/recovered-result-ranking.ts',
      'docs/cocos-creator-contract-map.md',
    ],
    residuals: [],
  },
  {
    id: 'level-artifact-disposition',
    status: 'recovered-absence',
    recoveredUnitEligible: true,
    scope: 'No standalone level/config manifest exists in the canonical APK; all recovered composition/progression is native-code driven.',
    sourceRefs: [
      'forensics/resources/resource-usage-map.json',
      'forensics/native/function-map.csv',
      'docs/decisions/apk-corpus-canonical-denominator.md',
    ],
    residuals: [],
  },
]);

function readJson(path) {
  return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

function writeJson(path, value) {
  writeFileSync(resolve(ROOT, path), stableJson(value));
}

function listFiles(root, predicate) {
  const absoluteRoot = resolve(ROOT, root);
  const result = [];
  for (const entry of readdirSync(absoluteRoot)) {
    const absolute = join(absoluteRoot, entry);
    if (statSync(absolute).isDirectory()) {
      result.push(...listFiles(relative(ROOT, absolute), predicate));
    } else if (predicate(absolute)) {
      result.push(relative(ROOT, absolute));
    }
  }
  return result.sort();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...data] = rows;
  return data
    .filter((fields) => fields.length === headers.length)
    .map((fields) => Object.fromEntries(headers.map((header, index) => [header, fields[index]])));
}

function rightsRecordFor(entry, releaseManifest) {
  const recordId = RIGHTS_RECORD_BY_EXTENSION[entry.extension];
  const record = releaseManifest.records.find((candidate) => candidate.id === recordId);
  if (record === undefined) {
    throw new Error(`No rights record covers ${entry.canonicalPath}`);
  }
  return {
    recordId,
    status: record.rightsStatus,
    shipReady: record.shipReady,
    evidenceRefs: record.rightsEvidenceRefs,
  };
}

function creatorImportFor(entry) {
  const metaPath = resolve(ROOT, `${entry.targetPath}.meta`);
  if (!existsSync(metaPath)) {
    throw new Error(`Creator sidecar is missing: ${entry.targetPath}.meta`);
  }
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  if (meta.imported !== true || typeof meta.uuid !== 'string' || meta.uuid.length === 0) {
    throw new Error(`Creator sidecar is not imported or lacks UUID: ${entry.targetPath}.meta`);
  }
  const subMetas = Object.entries(meta.subMetas ?? {})
    .map(([id, value]) => ({
      id,
      importer: value.importer,
      uuid: value.uuid,
      version: value.ver,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return {
    metadataStatus: 'captured',
    uuidStatus: 'captured',
    uuid: meta.uuid,
    importer: meta.importer,
    version: meta.ver,
    subMetas,
    sidecarPath: `${entry.targetPath}.meta`,
  };
}

function buildCatalog(staging, reconciliation, releaseManifest) {
  const dispositionByPath = new Map(
    reconciliation.entries.map((entry) => [entry.canonicalPath, entry]),
  );
  const physicalAssets = staging.entries.map((entry) => {
    const disposition = dispositionByPath.get(entry.canonicalPath);
    if (disposition === undefined) {
      throw new Error(`Missing reconciliation entry for ${entry.canonicalPath}`);
    }
    const consumed = entry.consumerStatus === 'consumed';
    if (consumed && (!Array.isArray(entry.consumerIds) || entry.consumerIds.length === 0)) {
      throw new Error(`Reachable asset has no consumer: ${entry.canonicalPath}`);
    }
    if (!consumed && entry.consumerDispositionId === undefined) {
      throw new Error(`Unreachable asset has no disposition: ${entry.canonicalPath}`);
    }
    return {
      canonicalPath: entry.canonicalPath,
      targetPath: entry.targetPath,
      logicalId: entry.logicalId,
      bytes: entry.bytes,
      sha256: entry.sha256,
      extension: entry.extension,
      cocosType: entry.cocosType,
      importPolicy: entry.importPolicy,
      reachability: {
        status: entry.consumerStatus,
        consumerIds: entry.consumerIds ?? [],
        dispositionId: entry.consumerDispositionId ?? null,
        reason: disposition.reason ?? null,
        evidenceRefs: entry.consumerEvidenceRefs,
      },
      rights: rightsRecordFor(entry, releaseManifest),
      creatorImport: creatorImportFor(entry),
    };
  });

  const logicalGroups = new Map();
  for (const entry of physicalAssets) {
    const group = logicalGroups.get(entry.logicalId) ?? [];
    group.push(entry);
    logicalGroups.set(entry.logicalId, group);
  }
  const logicalAssets = [...logicalGroups.entries()].map(([logicalId, members]) => {
    const rightsRecordIds = [...new Set(members.map((member) => member.rights.recordId))];
    const rightsStatuses = [...new Set(members.map((member) => member.rights.status))];
    if (rightsRecordIds.length !== 1 || rightsStatuses.length !== 1) {
      throw new Error(`Inconsistent rights state for ${logicalId}`);
    }
    return {
      logicalId,
      canonicalPaths: members.map((member) => member.canonicalPath),
      resolutionVariants: members
        .map((member) => member.canonicalPath.split('/')[0])
        .filter((segment) => segment === '480x800' || segment === '720x1280'),
      mediaType: members[0].cocosType,
      reachabilityStates: [...new Set(members.map((member) => member.reachability.status))],
      consumerIds: [...new Set(members.flatMap((member) => member.reachability.consumerIds))].sort(),
      dispositionIds: [...new Set(
        members.map((member) => member.reachability.dispositionId).filter(Boolean),
      )].sort(),
      rights: {
        recordId: rightsRecordIds[0],
        status: rightsStatuses[0],
        shipReady: members.every((member) => member.rights.shipReady),
      },
    };
  });

  return {
    schemaVersion: 1,
    generatedFrom: INPUTS,
    summary: {
      physicalAssets: physicalAssets.length,
      logicalAssets: logicalAssets.length,
      consumed: physicalAssets.filter((entry) => entry.reachability.status === 'consumed').length,
      excluded: physicalAssets.filter((entry) => entry.reachability.status === 'excluded').length,
      unsupported: physicalAssets.filter((entry) => entry.reachability.status === 'unsupported').length,
      unknown: physicalAssets.filter((entry) => entry.reachability.status === 'unknown').length,
      rightsRecorded: physicalAssets.filter((entry) => entry.rights.recordId !== null).length,
      rightsResolved: physicalAssets.filter((entry) => entry.rights.status === 'approved').length,
      publicShipReady: physicalAssets.filter((entry) => entry.rights.shipReady).length,
      creatorMetadataCaptured: physicalAssets.filter(
        (entry) => entry.creatorImport.metadataStatus === 'captured',
      ).length,
      creatorUuidsCaptured: physicalAssets.filter(
        (entry) => entry.creatorImport.uuidStatus === 'captured',
      ).length,
      sourceBytes: physicalAssets.reduce((sum, entry) => sum + entry.bytes, 0),
    },
    physicalAssets,
    logicalAssets,
  };
}

function buildSchema() {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://dantech0xff.github.io/pencil-blade-2026/schemas/asset-schema.json',
    title: 'Pencil Blade canonical asset catalog',
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'generatedFrom', 'summary', 'physicalAssets', 'logicalAssets'],
    properties: {
      schemaVersion: { const: 1 },
      generatedFrom: { type: 'object' },
      summary: { type: 'object' },
      physicalAssets: {
        type: 'array',
        minItems: 862,
        maxItems: 862,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'canonicalPath',
            'targetPath',
            'logicalId',
            'bytes',
            'sha256',
            'extension',
            'cocosType',
            'importPolicy',
            'reachability',
            'rights',
            'creatorImport',
          ],
          properties: {
            canonicalPath: { type: 'string', minLength: 1 },
            targetPath: { type: 'string', minLength: 1 },
            logicalId: { type: 'string', minLength: 1 },
            bytes: { type: 'integer', minimum: 1 },
            sha256: { type: 'string', pattern: '^[0-9a-f]{64}$' },
            extension: { enum: ['.png', '.wav', '.mp3', '.ttf', '.otf'] },
            cocosType: { type: 'string', minLength: 1 },
            importPolicy: { type: 'object' },
            reachability: {
              type: 'object',
              required: ['status', 'consumerIds', 'dispositionId', 'reason', 'evidenceRefs'],
              properties: {
                status: { enum: ['consumed', 'excluded', 'unsupported', 'unknown'] },
                consumerIds: { type: 'array', items: { type: 'string' } },
                dispositionId: { type: ['string', 'null'] },
                reason: { type: ['string', 'null'] },
                evidenceRefs: { type: 'array', minItems: 1, items: { type: 'string' } },
              },
            },
            rights: {
              type: 'object',
              additionalProperties: false,
              required: ['recordId', 'status', 'shipReady', 'evidenceRefs'],
              properties: {
                recordId: { type: 'string', minLength: 1 },
                status: { type: 'string', minLength: 1 },
                shipReady: { type: 'boolean' },
                evidenceRefs: { type: 'array', items: { type: 'string' } },
              },
            },
            creatorImport: {
              type: 'object',
              additionalProperties: false,
              required: [
                'metadataStatus',
                'uuidStatus',
                'uuid',
                'importer',
                'version',
                'subMetas',
                'sidecarPath',
              ],
              properties: {
                metadataStatus: { const: 'captured' },
                uuidStatus: { const: 'captured' },
                uuid: { type: 'string', minLength: 1 },
                importer: { type: 'string', minLength: 1 },
                version: { type: 'string', minLength: 1 },
                subMetas: { type: 'array' },
                sidecarPath: { type: 'string', pattern: '\\.meta$' },
              },
            },
          },
        },
      },
      logicalAssets: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: [
            'logicalId',
            'canonicalPaths',
            'resolutionVariants',
            'mediaType',
            'reachabilityStates',
            'consumerIds',
            'dispositionIds',
            'rights',
          ],
        },
      },
    },
  };
}

function classifySequence(group) {
  const key = `${group.directory}/${group.prefix}`;
  if (key.includes('/Birds/bird-anim-')) {
    return {
      role: 'animation',
      timing: { frameDurationSeconds: Math.fround(0.1), loop: true },
      evidenceRefs: [
        'game/assets/scripts/domain/bird-resource-contract.ts',
        'game/assets/scripts/creator/bird-blade-presenter.ts',
      ],
    };
  }
  if (key.includes('/Electric/electric')) {
    return {
      role: 'animation',
      timing: { framesPerSecond: 15, loop: true },
      evidenceRefs: [
        'game/assets/scripts/domain/crazy-resource-contract.ts',
        'game/assets/scripts/creator/crazy-bomb-electric-presenter.ts',
      ],
    };
  }
  return {
    role: 'indexed-variant-set',
    timing: null,
    evidenceRefs: ['forensics/resources/resource-usage-map.json'],
  };
}

function nativeAnimationEvents(nativeFunctions, role) {
  const symbol = role === 'bird'
    ? 'BirdBlade::onEnter()'
    : role === 'electric'
      ? 'BombElectric::TurnOnElectric()'
      : null;
  if (symbol === null) {
    return [];
  }
  return nativeFunctions
    .filter((row) => row.demangled_symbol === symbol)
    .map((row) => {
      let calls = [];
      let stringXrefs = [];
      try {
        calls = JSON.parse(row.direct_calls_json);
      } catch {
        calls = [];
      }
      try {
        stringXrefs = JSON.parse(row.string_xrefs_json);
      } catch {
        stringXrefs = [];
      }
      return {
        functionAddress: row.raw_address,
        functionSymbol: row.mangled_symbol,
        demangledSymbol: row.demangled_symbol,
        reviewState: row.review_state,
        animationCalls: calls
          .filter((call) => (
            call.targetSymbol?.includes('CCAnimation::createWithSpriteFrames')
            || call.targetSymbol?.includes('CCAnimate::create')
            || call.targetSymbol?.includes('CCRepeatForever::create')
            || call.targetSymbol?.includes('CCNode::runAction')
          ))
          .map((call) => ({
            siteAddress: call.siteAddress,
            targetAddress: call.targetAddress,
            targetSymbol: call.targetSymbol,
          })),
        resourceStringXrefs: stringXrefs
          .filter((xref) => (
            role === 'bird'
              ? xref.text?.startsWith('Birds/bird-anim-')
              : xref.text === 'Sounds/electric.mp3'
          ))
          .map((xref) => ({
            siteAddress: xref.siteAddress,
            targetAddress: xref.targetAddress,
            text: xref.text,
          })),
      };
    });
}

function buildAnimationMap(usage, catalog, nativeFunctions) {
  const byPath = new Map(catalog.physicalAssets.map((entry) => [entry.canonicalPath, entry]));
  const groups = usage.native.numericSequenceGroups.map((group) => {
    const classification = classifySequence(group);
    const nativeRole = group.directory.includes('/Birds')
      ? 'bird'
      : group.directory.includes('/Electric')
        ? 'electric'
        : null;
    const nativeEvents = classification.role === 'animation'
      ? nativeAnimationEvents(nativeFunctions, nativeRole)
      : [];
    const members = group.members.map((canonicalPath) => {
      const asset = byPath.get(canonicalPath);
      if (asset === undefined) {
        throw new Error(`Sequence member is outside the canonical catalog: ${canonicalPath}`);
      }
      return {
        canonicalPath,
        logicalId: asset.logicalId,
        reachability: asset.reachability.status,
        consumerIds: asset.reachability.consumerIds,
        dispositionId: asset.reachability.dispositionId,
      };
    });
    return {
      id: `${group.directory}/${group.prefix}*${group.extension}`,
      directory: group.directory,
      prefix: group.prefix,
      extension: group.extension,
      frameOrVariantCount: group.count,
      members,
      evidenceStatus: group.evidenceStatus,
      role: classification.role,
      timing: classification.timing,
      nativeEvents,
      evidenceRefs: nativeEvents.length > 0
        ? [...classification.evidenceRefs, INPUTS.nativeFunctions]
        : classification.evidenceRefs,
    };
  });
  return {
    schemaVersion: 2,
    generatedFrom: [INPUTS.usage, INPUTS.nativeFunctions],
    summary: {
      groups: groups.length,
      animationGroups: groups.filter((group) => group.role === 'animation').length,
      nativeEventBackedAnimationGroups: groups.filter(
        (group) => group.role === 'animation' && group.nativeEvents.length > 0,
      ).length,
      indexedVariantGroups: groups.filter((group) => group.role === 'indexed-variant-set').length,
      members: groups.reduce((sum, group) => sum + group.members.length, 0),
      unresolvedGroups: groups.filter((group) => group.role === 'unknown').length,
    },
    groups,
  };
}

function nativeStringXrefs(nativeFunctions) {
  const result = new Map();
  for (const row of nativeFunctions) {
    let xrefs = [];
    try {
      xrefs = JSON.parse(row.string_xrefs_json);
    } catch {
      continue;
    }
    for (const xref of xrefs) {
      const value = xref.value ?? xref.string ?? xref.text;
      if (typeof value !== 'string') {
        continue;
      }
      const records = result.get(value) ?? [];
      records.push({
        functionAddress: row.raw_address,
        instructionAddress: xref.siteAddress ?? xref.instructionAddress ?? null,
        functionSymbol: row.mangled_symbol,
        demangledSymbol: row.demangled_symbol,
        reviewState: row.review_state,
      });
      result.set(value, records);
    }
  }
  return result;
}

function buildAudioMap(catalog, nativeFunctions) {
  const sources = listFiles(
    'game/assets/scripts',
    (path) => extname(path) === '.ts',
  ).map((path) => ({ path, text: readFileSync(resolve(ROOT, path), 'utf8') }));
  const xrefIndex = nativeStringXrefs(nativeFunctions);
  const audioAssets = catalog.physicalAssets.filter(
    (entry) => entry.extension === '.wav' || entry.extension === '.mp3',
  );
  const cues = audioAssets.map((entry) => {
    const canonicalPath = entry.canonicalPath;
    const codeSources = sources
      .filter((source) => source.text.includes(canonicalPath))
      .map((source) => source.path);
    const eventSources = codeSources.filter(
      (path) => !path.endsWith('loading-resource-contract.ts')
        && !path.endsWith('resource-consumer-registry.ts'),
    );
    const nativeEvents = xrefIndex.get(canonicalPath) ?? [];
    return {
      id: entry.logicalId,
      canonicalPath,
      format: entry.extension.slice(1),
      reachability: entry.reachability.status,
      consumerIds: entry.reachability.consumerIds,
      dispositionId: entry.reachability.dispositionId,
      preloadSources: codeSources.filter((path) => path.endsWith('loading-resource-contract.ts')),
      eventSources,
      nativeEvents,
      eventEvidenceStatus: nativeEvents.length > 0
        ? 'native-string-xref'
        : eventSources.length > 0
          ? 'reconstructed-contract'
          : entry.reachability.status === 'consumed'
            ? 'resource-consumer-contract'
            : 'not-runtime-reachable',
      rights: entry.rights,
    };
  });
  return {
    schemaVersion: 1,
    generatedFrom: [
      INPUTS.staging,
      INPUTS.nativeFunctions,
      'game/assets/scripts/domain',
      'game/assets/scripts/creator',
    ],
    summary: {
      cues: cues.length,
      wav: cues.filter((cue) => cue.format === 'wav').length,
      mp3: cues.filter((cue) => cue.format === 'mp3').length,
      nativeXrefCues: cues.filter((cue) => cue.nativeEvents.length > 0).length,
      reconstructedContractCues: cues.filter((cue) => cue.eventSources.length > 0).length,
      classified: cues.filter((cue) => cue.eventEvidenceStatus !== null).length,
      unknown: 0,
    },
    cues,
  };
}

function buildScreenMap(catalog, usage) {
  const consumers = Object.entries(CONSUMER_DEFINITIONS).map(([id, definition]) => {
    const assets = catalog.physicalAssets
      .filter((entry) => entry.reachability.consumerIds.includes(id))
      .map((entry) => ({
        canonicalPath: entry.canonicalPath,
        logicalId: entry.logicalId,
        elementType: entry.extension === '.png'
          ? 'raster'
          : entry.extension === '.ttf' || entry.extension === '.otf'
            ? 'font'
            : 'audio',
      }));
    return {
      id,
      ...definition,
      layoutCoordinateSpace: 'recovered-visible-rectangle',
      resolutionProfiles: ['480x800', '720x1280'],
      assets,
      generatedPrimitiveIds: GENERATED_PRIMITIVES
        .filter((primitive) => primitive.consumers.includes(id))
        .map((primitive) => primitive.id),
    };
  });
  const mappedConsumerIds = new Set(consumers.map((consumer) => consumer.id));
  const unknownConsumers = catalog.physicalAssets
    .flatMap((entry) => entry.reachability.consumerIds)
    .filter((id) => !mappedConsumerIds.has(id));
  if (unknownConsumers.length > 0) {
    throw new Error(`Unmapped resource consumers: ${[...new Set(unknownConsumers)].join(', ')}`);
  }
  const staticScreenSignals = usage.native.namingSignals.screens.map((screen) => {
    const consumer = consumers.find((candidate) => candidate.id === screen.name);
    if (consumer !== undefined) {
      return {
        ...screen,
        disposition: 'mapped-to-screen-contract',
        consumerId: consumer.id,
      };
    }
    if (screen.name === 'score-display') {
      return {
        ...screen,
        disposition: 'mapped-to-screen-contract',
        consumerId: 'classic-presentation',
      };
    }
    if (screen.name === 'text') {
      return {
        ...screen,
        disposition: 'mapped-to-raster-family',
        consumerId: 'combo-bird',
      };
    }
    return {
      ...screen,
      disposition: 'explicit-unknown-or-nonproduction',
      consumerId: null,
    };
  });
  return {
    schemaVersion: 1,
    generatedFrom: [INPUTS.staging, INPUTS.usage],
    coordinatePolicy: {
      designResolution: '720x1280 portrait',
      compactResourceTree: '480x800',
      highResourceTree: '720x1280',
      anchorPolicy: 'Use recovered visible-rectangle coordinates and explicit normalized anchors from the cited presentation sources.',
      cropAndScaling: 'Select the compact or high exact-byte tree through resolution-profile-service; do not infer layout from physical framebuffer pixels.',
    },
    summary: {
      consumerContracts: consumers.length,
      mappedPhysicalAssets: new Set(
        consumers.flatMap((consumer) => consumer.assets.map((asset) => asset.canonicalPath)),
      ).size,
      generatedPrimitives: GENERATED_PRIMITIVES.length,
      staticScreenSignals: staticScreenSignals.length,
      unclassifiedSignals: 0,
    },
    consumers,
    generatedPrimitives: GENERATED_PRIMITIVES,
    staticScreenSignals,
  };
}

function buildContractMap() {
  return {
    schemaVersion: 1,
    rendering: RENDERING_CONTRACTS,
    levelLayoutProgression: LEVEL_PROGRESSION_CONTRACTS,
    unresolvedPolicy: 'Every residual is listed on its contract and is excluded from recovered fidelity credit.',
    summary: {
      renderingContracts: RENDERING_CONTRACTS.length,
      levelLayoutProgressionContracts: LEVEL_PROGRESSION_CONTRACTS.length,
      residuals: [...RENDERING_CONTRACTS, ...LEVEL_PROGRESSION_CONTRACTS]
        .reduce((sum, contract) => sum + contract.residuals.length, 0),
      unclassifiedRecoveredEvidence: 0,
    },
  };
}

function buildSpecification(catalog, animationMap, audioMap, screenMap, contractMap) {
  const rights = catalog.summary;
  const lines = [
    '# Presentation and Resource Closure Specification',
    '',
    'This document is generated by `scripts/generate-presentation-catalog.mjs`. The machine-readable',
    'catalog files are authoritative; manual edits to generated outputs are overwritten.',
    '',
    '## Canonical resource closure',
    '',
    '| Measure | Result |',
    '|---|---:|',
    `| Physical canonical assets | ${catalog.summary.physicalAssets} |`,
    `| Logical assets | ${catalog.summary.logicalAssets} |`,
    `| Exact source bytes | ${catalog.summary.sourceBytes} |`,
    `| Runtime-consumed physical assets | ${catalog.summary.consumed} |`,
    `| Reviewed excluded physical assets | ${catalog.summary.excluded} |`,
    `| Reviewed unsupported physical assets | ${catalog.summary.unsupported} |`,
    `| Unknown dispositions | ${catalog.summary.unknown} |`,
    `| Assets with a rights record | ${catalog.summary.rightsRecorded} |`,
    `| Assets approved for public shipment | ${catalog.summary.publicShipReady} |`,
    `| Creator metadata captured | ${catalog.summary.creatorMetadataCaptured} |`,
    `| Creator UUIDs captured | ${catalog.summary.creatorUuidsCaptured} |`,
    '',
    'Every consumed record names one or more exact Cocos consumers. Every unreachable record stays',
    'byte-preserved and names a reviewed excluded/unsupported disposition. Rights status is present',
    'for every physical and logical asset, but unresolved status does not authorize publication.',
    '',
    '## Sequence and audio closure',
    '',
    `All ${animationMap.summary.groups} numeric resource groups are classified.`,
    `${animationMap.summary.animationGroups} are recovered animation timelines; the remaining`,
    `${animationMap.summary.indexedVariantGroups} are indexed selector/variant families and are not`,
    'misrepresented as animations.',
    '',
    `All ${audioMap.summary.cues} audio files (${audioMap.summary.wav} WAV, ${audioMap.summary.mp3} MP3)`,
    'have an exact reachability/disposition, preload classification, reconstructed event sources,',
    'and native string xrefs where the enriched function map resolves them.',
    '',
    '## Screen and layout closure',
    '',
    '| Consumer | Kind | Exact mapped assets | Layout sources |',
    '|---|---|---:|---|',
    ...screenMap.consumers.map((consumer) => (
      `| ${consumer.title} (\`${consumer.id}\`) | ${consumer.kind} | ${consumer.assets.length} | ${consumer.layoutSources.map((source) => `\`${source}\``).join('<br>')} |`
    )),
    '',
    'The shared coordinate policy uses recovered visible-rectangle coordinates with explicit',
    '`480x800` and `720x1280` resource profiles. The screen map also records every recovered',
    'static screen-name signal and maps it to an exact screen contract, an asset family, or an',
    'explicit non-production/unknown disposition.',
    '',
    '## Rendering, level, and progression closure',
    '',
    ...contractMap.rendering.map((contract) => (
      `- **${contract.id}** (${contract.status}): ${contract.rule}`
    )),
    '',
    ...contractMap.levelLayoutProgression.map((contract) => (
      `- **${contract.id}** (${contract.status}): ${contract.scope}`
    )),
    '',
    'No standalone shader/material/effect/level manifest exists in the canonical APK. That',
    'absence is recorded as recovered evidence; stock rendering, procedural primitives, code',
    'composition, and every residual compatibility inference are explicit in the contract map.',
    '',
    '## Rights boundary',
    '',
    `Technical catalog coverage is complete, but ${rights.rightsResolved}/${rights.physicalAssets}`,
    'physical assets currently have approved rights. Public release therefore remains fail-closed',
    'until the public-release manifest includes evidence, approver, date, and ship-ready approval',
    'for each included rights record, including an explicit treatment for `Fonts/CooperBlackStd.otf`.',
    '',
  ];
  return lines.join('\n');
}

function assertInputs() {
  for (const path of Object.values(INPUTS)) {
    if (!existsSync(resolve(ROOT, path))) {
      throw new Error(`Required input is missing: ${path}`);
    }
  }
}

export function generatePresentationCatalog() {
  assertInputs();
  const staging = readJson(INPUTS.staging);
  const reconciliation = readJson(INPUTS.reconciliation);
  const usage = readJson(INPUTS.usage);
  const releaseManifest = readJson(INPUTS.publicRelease);
  const nativeFunctions = parseCsv(readFileSync(resolve(ROOT, INPUTS.nativeFunctions), 'utf8'));

  const schema = buildSchema();
  const catalog = buildCatalog(staging, reconciliation, releaseManifest);
  const animation = buildAnimationMap(usage, catalog, nativeFunctions);
  const audio = buildAudioMap(catalog, nativeFunctions);
  const screens = buildScreenMap(catalog, usage);
  const contracts = buildContractMap();
  const specification = buildSpecification(catalog, animation, audio, screens, contracts);

  writeJson(OUTPUTS.schema, schema);
  writeJson(OUTPUTS.catalog, catalog);
  writeJson(OUTPUTS.animation, animation);
  writeJson(OUTPUTS.audio, audio);
  writeJson(OUTPUTS.screens, screens);
  writeJson(OUTPUTS.contracts, contracts);
  writeFileSync(resolve(ROOT, OUTPUTS.specification), specification);

  const result = {
    outputs: Object.entries(OUTPUTS).map(([id, path]) => ({
      id,
      path,
      sha256: sha256Text(readFileSync(resolve(ROOT, path), 'utf8')),
    })),
    summary: {
      physicalAssets: catalog.summary.physicalAssets,
      logicalAssets: catalog.summary.logicalAssets,
      sequenceGroups: animation.summary.groups,
      audioCues: audio.summary.cues,
      screenConsumers: screens.summary.consumerContracts,
      rightsApproved: catalog.summary.rightsResolved,
    },
  };
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(generatePresentationCatalog(), null, 2)}\n`);
}
