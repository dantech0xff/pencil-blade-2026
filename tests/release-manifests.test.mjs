import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recovered = readJson('release/recovered-reconstruction-manifest.json');
const publicVariant = readJson('release/public-release-variant-manifest.json');
const staging = readJson('assets/catalog/creator-staging-manifest.json');
const ledger = readJson('assets/catalog/resource-reconciliation-ledger.json');

test('recovered manifest pins the current APK-only authority chain', () => {
  assert.equal(recovered.evidenceMode, 'static-only');
  assert.equal(recovered.originalRuntime.executed, false);
  assert.equal(recovered.manifestVersion, '1.1.0');
  assert.equal(recovered.resourceCorpus.scope, 'recovered-apk-assets');
  assert.equal(
    recovered.resourceCorpus.sourceApkSha256,
    '95225733d46473f2b155737e8c83b567e028342257c747c0faac6ed4ab87e7aa',
  );
  assert.deepEqual(
    recovered.resourceCorpus.canonicalDenominator,
    {
      status: 'approved',
      sourceType: 'sole-source-apk',
      approvedBy: 'project-owner',
      approvedAt: '2026-07-25',
      decisionRecord: 'docs/decisions/apk-corpus-canonical-denominator.md',
      decisionSha256: '43295ebd992918146239515547389a9e47f0d8364dc1fbe6ebf18cf5bf161018',
      assetCount: 862,
      byteCount: 32945747,
    },
  );
  assert.equal(
    recovered.resourceCorpus.canonicalDenominator.decisionSha256,
    sha256(recovered.resourceCorpus.canonicalDenominator.decisionRecord),
  );
  assert.equal(recovered.resourceCorpus.externalSampleProject.includedInDenominator, false);
  assert.equal(
    recovered.resourceCorpus.externalSampleProject.status,
    'confirmed-not-existent',
  );
  assert.deepEqual(
    recovered.resourceCorpus.androidResPng,
    {
      total: 107,
      launcher: 3,
      vendorUi: 104,
      game: 0,
      includedInGameResourceDenominator: false,
    },
  );
  assert.equal(staging.summary.canonicalCorpusCompleteness, 'complete');
  assert.equal(
    staging.summary.canonicalSampleProjectCompleteness,
    'not-applicable-no-external-sample-project',
  );
  assert.equal(
    recovered.resourceCorpus.resourceMapSha256,
    sha256('forensics/resources/resource-usage-map.json'),
  );
  assert.equal(
    recovered.resourceCorpus.stagingManifestSha256,
    sha256('assets/catalog/creator-staging-manifest.json'),
  );
  assert.equal(
    recovered.resourceCorpus.reconciliationLedgerSha256,
    sha256('assets/catalog/resource-reconciliation-ledger.json'),
  );
});

test('recovered manifest counts exactly match the immutable staging and ledger rows', () => {
  assert.equal(staging.entries.length, recovered.resourceCorpus.assetCount);
  assert.equal(
    staging.entries.reduce((total, entry) => total + entry.bytes, 0),
    recovered.resourceCorpus.byteCount,
  );
  assert.deepEqual(countFormats(staging.entries), recovered.resourceCorpus.formats);
  assert.equal(ledger.entries.length, recovered.resourceCorpus.assetCount);
  assert.deepEqual(
    countStatuses(ledger.entries),
    recovered.resourceCorpus.classification,
  );
});

test('public variant is separate and fails closed while rights remain unresolved', () => {
  assert.equal(
    publicVariant.reconstructionManifest,
    'release/recovered-reconstruction-manifest.json',
  );
  assert.equal(publicVariant.releaseDecision.status, 'blocked');
  assert.equal(publicVariant.target.platform, 'web-mobile');
  assert.equal(publicVariant.target.repositoryPrefix, '/pencil-blade-2026/');
  assert.ok(publicVariant.records.length > 0);
  assert.ok(publicVariant.records.every((record) => record.included === true));
  assert.ok(publicVariant.records.every((record) => record.shipReady === false));
  assert.ok(publicVariant.records.every((record) => record.rightsStatus !== 'approved'));
  assert.deepEqual(publicVariant.releaseExceptions.approved, []);
  assert.deepEqual(
    publicVariant.releaseExceptions.pending.map((entry) => entry.id),
    ['unsupported-cooper-black-otf-treatment'],
  );
  assert.ok(
    publicVariant.releaseExceptions.pending.every(
      (entry) => entry.status === 'pending-user-decision',
    ),
  );
});

test('public resource records cover every recovered resource exactly once', () => {
  const records = new Map(publicVariant.records.map((record) => [record.category, record]));
  assert.equal(records.get('graphics').itemCount, recovered.resourceCorpus.formats.png);
  assert.equal(
    records.get('audio').itemCount,
    recovered.resourceCorpus.formats.wav + recovered.resourceCorpus.formats.mp3,
  );
  assert.equal(
    records.get('fonts').itemCount,
    recovered.resourceCorpus.formats.ttf + recovered.resourceCorpus.formats.otf,
  );
  assert.equal(
    records.get('graphics').itemCount
      + records.get('audio').itemCount
      + records.get('fonts').itemCount,
    recovered.resourceCorpus.assetCount,
  );
});

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(projectRoot, relativePath), 'utf8'));
}

function sha256(relativePath) {
  return createHash('sha256')
    .update(readFileSync(join(projectRoot, relativePath)))
    .digest('hex');
}

function countFormats(entries) {
  const counts = { png: 0, wav: 0, mp3: 0, ttf: 0, otf: 0 };
  for (const entry of entries) {
    const format = entry.extension.slice(1).toLowerCase();
    assert.ok(Object.hasOwn(counts, format), `unexpected recovered format: ${format}`);
    counts[format] += 1;
  }
  return counts;
}

function countStatuses(entries) {
  const counts = { consumed: 0, excluded: 0, unsupported: 0, unknown: 0 };
  for (const entry of entries) {
    assert.ok(
      Object.hasOwn(counts, entry.status),
      `unexpected reconciliation status: ${entry.status}`,
    );
    counts[entry.status] += 1;
  }
  return counts;
}
