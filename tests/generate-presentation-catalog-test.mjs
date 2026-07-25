#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generatePresentationCatalog } from '../scripts/generate-presentation-catalog.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));

const result = generatePresentationCatalog();
const catalog = readJson('assets/catalog/asset-catalog.json');
const schema = readJson('assets/catalog/asset-schema.json');
const animations = readJson('assets/catalog/animation-frame-map.json');
const audio = readJson('assets/catalog/audio-cue-map.json');
const screens = readJson('assets/catalog/screen-element-map.json');
const contracts = readJson('assets/catalog/presentation-contract-map.json');

assert.equal(result.outputs.length, 7);
assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
assert.equal(catalog.summary.physicalAssets, 862);
assert.equal(catalog.summary.logicalAssets, 473);
assert.equal(catalog.summary.sourceBytes, 32_945_747);
assert.equal(catalog.summary.consumed, 761);
assert.equal(catalog.summary.excluded, 100);
assert.equal(catalog.summary.unsupported, 1);
assert.equal(catalog.summary.unknown, 0);
assert.equal(catalog.summary.rightsRecorded, 862);
assert.equal(catalog.summary.rightsResolved, 0);
assert.equal(catalog.summary.publicShipReady, 0);
assert.equal(catalog.summary.creatorMetadataCaptured, 862);
assert.equal(catalog.summary.creatorUuidsCaptured, 862);

for (const asset of catalog.physicalAssets) {
  assert.match(asset.sha256, /^[0-9a-f]{64}$/u);
  assert.ok(asset.rights.recordId);
  assert.equal(asset.creatorImport.metadataStatus, 'captured');
  assert.equal(asset.creatorImport.uuidStatus, 'captured');
  assert.ok(asset.creatorImport.uuid);
  assert.match(asset.creatorImport.sidecarPath, /\.meta$/u);
  assert.ok(asset.reachability.evidenceRefs.length > 0);
  if (asset.reachability.status === 'consumed') {
    assert.ok(asset.reachability.consumerIds.length > 0);
    assert.equal(asset.reachability.dispositionId, null);
  } else {
    assert.ok(asset.reachability.dispositionId);
    assert.ok(asset.reachability.reason);
  }
}

assert.equal(animations.summary.groups, 50);
assert.equal(animations.summary.animationGroups, 8);
assert.equal(animations.summary.nativeEventBackedAnimationGroups, 8);
assert.equal(animations.summary.indexedVariantGroups, 42);
assert.equal(animations.summary.unresolvedGroups, 0);
for (const group of animations.groups) {
  assert.equal(group.members.length, group.frameOrVariantCount);
  assert.ok(group.evidenceRefs.length > 0);
  if (group.role === 'animation') {
    assert.ok(group.nativeEvents.length > 0);
    assert.ok(group.nativeEvents.every((event) => event.animationCalls.length >= 4));
    assert.ok(group.nativeEvents.every((event) => event.reviewState === 'auto-indexed'));
  }
}

assert.equal(audio.summary.cues, 62);
assert.equal(audio.summary.wav, 59);
assert.equal(audio.summary.mp3, 3);
assert.equal(audio.summary.classified, 62);
assert.equal(audio.summary.unknown, 0);
for (const cue of audio.cues) {
  assert.ok(cue.eventEvidenceStatus);
  assert.ok(cue.rights.recordId);
}

assert.equal(screens.summary.consumerContracts, 18);
assert.equal(screens.summary.mappedPhysicalAssets, 761);
assert.equal(screens.summary.staticScreenSignals, 9);
assert.equal(screens.summary.unclassifiedSignals, 0);
assert.ok(screens.consumers.every((consumer) => consumer.layoutSources.length > 0));
assert.ok(screens.staticScreenSignals.every((signal) => signal.disposition));

assert.equal(contracts.summary.renderingContracts, 4);
assert.equal(contracts.summary.levelLayoutProgressionContracts, 4);
assert.equal(contracts.summary.unclassifiedRecoveredEvidence, 0);
assert.ok(contracts.rendering.every((contract) => contract.sourceRefs.length > 0));
assert.ok(contracts.levelLayoutProgression.every((contract) => contract.sourceRefs.length > 0));

process.stdout.write(
  `PASS presentation catalog: ${catalog.summary.physicalAssets} assets, `
  + `${animations.summary.groups} sequences, ${audio.summary.cues} audio cues, `
  + `${screens.summary.consumerContracts} consumer maps\n`,
);
