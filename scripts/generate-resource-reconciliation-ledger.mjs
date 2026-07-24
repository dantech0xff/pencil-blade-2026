#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import {
  CANONICAL_AUTHORITY,
  applyResourceReconciliationLedger,
  flattenResourceMap,
  readStableFile,
  resourceReconciliationSummary,
} from './stage-creator-assets.mjs';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../'))
      && path.extname(specifier) === ''
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const TREE_PROFILES = Object.freeze(['480x800', '720x1280']);
const DISPOSITION_STATUSES = new Set(['unknown', 'excluded', 'unsupported']);
const EXPECTED_COUNTS = Object.freeze({
  staged: 862,
  consumed: 743,
  unknown: 108,
  excluded: 10,
  unsupported: 1,
  dispositions: 119,
});

class ResourceReconciliationError extends Error {}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function invariant(condition, message) {
  if (!condition) throw new ResourceReconciliationError(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readFile(
  filePath,
  label,
  expectedIdentity = null,
  allowedLinks = 1n,
) {
  return readStableFile(
    filePath,
    label,
    expectedIdentity,
    allowedLinks,
  );
}

function readJson(filePath, label) {
  const file = readFile(filePath, label);
  try {
    return {
      file,
      value: JSON.parse(file.buffer.toString('utf8')),
    };
  } catch (error) {
    throw new ResourceReconciliationError(`${label} is not valid JSON: ${error.message}`);
  }
}

function assertSortedUniqueStrings(values, label, allowEmpty = false) {
  invariant(Array.isArray(values), `${label} must be an array`);
  if (!allowEmpty) invariant(values.length > 0, `${label} must not be empty`);
  const sorted = [...values].sort(compareText);
  invariant(
    values.every((value, index) => (
      typeof value === 'string'
      && value.length > 0
      && value === sorted[index]
      && (index === 0 || value !== values[index - 1])
    )),
    `${label} must contain sorted unique non-empty strings`,
  );
}

function validateRegistry(records, stagedByPath) {
  invariant(Array.isArray(records), 'resource consumer registry must be an array');
  invariant(
    records.length === EXPECTED_COUNTS.consumed,
    `resource consumer registry must contain exactly ${EXPECTED_COUNTS.consumed} records`,
  );
  const byPath = new Map();
  let previousPath = null;
  records.forEach((record, index) => {
    const label = `resource consumer registry[${index}]`;
    invariant(isPlainObject(record), `${label} must be an object`);
    invariant(
      typeof record.canonicalPath === 'string' && record.canonicalPath.length > 0,
      `${label}.canonicalPath must be a non-empty string`,
    );
    invariant(
      previousPath === null || compareText(previousPath, record.canonicalPath) < 0,
      'resource consumer registry must be sorted with unique canonical paths',
    );
    previousPath = record.canonicalPath;
    invariant(
      stagedByPath.has(record.canonicalPath),
      `${label} is not staged: ${record.canonicalPath}`,
    );
    assertSortedUniqueStrings(record.consumerIds, `${label}.consumerIds`);
    assertSortedUniqueStrings(record.evidenceRefs, `${label}.evidenceRefs`);
    byPath.set(record.canonicalPath, record);
  });
  return byPath;
}

function validateDispositionMap(dispositionMap, stagedByPath, consumedByPath) {
  invariant(isPlainObject(dispositionMap), 'resource disposition map must be an object');
  invariant(dispositionMap.schemaVersion === 1, 'resource disposition map schemaVersion must be 1');
  invariant(
    dispositionMap.scope === 'recovered-apk-assets-without-current-consumers',
    'resource disposition map scope is invalid',
  );
  invariant(isPlainObject(dispositionMap.statusPolicy), 'resource disposition statusPolicy is required');
  for (const status of DISPOSITION_STATUSES) {
    invariant(
      typeof dispositionMap.statusPolicy[status] === 'string'
        && dispositionMap.statusPolicy[status].length > 0,
      `resource disposition statusPolicy.${status} is required`,
    );
  }
  invariant(Array.isArray(dispositionMap.groups), 'resource disposition groups must be an array');

  const ids = new Set();
  const recordsByPath = new Map();
  for (const [index, group] of dispositionMap.groups.entries()) {
    const label = `resource disposition groups[${index}]`;
    invariant(isPlainObject(group), `${label} must be an object`);
    invariant(
      typeof group.id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(group.id),
      `${label}.id must be stable kebab-case`,
    );
    invariant(!ids.has(group.id), `duplicate resource disposition id: ${group.id}`);
    ids.add(group.id);
    invariant(
      DISPOSITION_STATUSES.has(group.status),
      `${label}.status is invalid: ${String(group.status)}`,
    );
    assertSortedUniqueStrings(
      group.treePairLogicalPaths,
      `${label}.treePairLogicalPaths`,
      true,
    );
    assertSortedUniqueStrings(group.canonicalPaths, `${label}.canonicalPaths`, true);
    invariant(
      group.treePairLogicalPaths.length + group.canonicalPaths.length > 0,
      `${label} must enumerate at least one path`,
    );
    invariant(
      typeof group.reason === 'string' && group.reason.length > 0,
      `${label}.reason must be a non-empty string`,
    );
    assertSortedUniqueStrings(group.evidenceRefs, `${label}.evidenceRefs`);

    const expanded = [
      ...group.treePairLogicalPaths.flatMap((logicalPath) => (
        TREE_PROFILES.map((tree) => `${tree}/${logicalPath}`)
      )),
      ...group.canonicalPaths,
    ].sort(compareText);
    for (const canonicalPath of expanded) {
      invariant(stagedByPath.has(canonicalPath), `${label} is not staged: ${canonicalPath}`);
      invariant(
        !consumedByPath.has(canonicalPath),
        `${label} overlaps a live consumer: ${canonicalPath}`,
      );
      invariant(
        !recordsByPath.has(canonicalPath),
        `${label} duplicates disposition path: ${canonicalPath}`,
      );
      recordsByPath.set(canonicalPath, {
        canonicalPath,
        dispositionId: group.id,
        evidenceRefs: [...group.evidenceRefs].sort(compareText),
        reason: group.reason,
        status: group.status,
      });
    }
  }

  invariant(
    recordsByPath.size === EXPECTED_COUNTS.dispositions,
    `resource disposition map must expand to exactly ${EXPECTED_COUNTS.dispositions} paths`,
  );
  return recordsByPath;
}

function ledgerSummary(entries) {
  const summaryEntries = entries.map((entry) => ({
    canonicalPath: entry.canonicalPath,
    consumerStatus: entry.status,
  }));
  return resourceReconciliationSummary(summaryEntries);
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function generateOutputs(rawOptions, hooks = {}) {
  const options = Object.fromEntries(
    Object.entries(rawOptions).map(([key, value]) => [key, path.resolve(value)]),
  );
  const resourceMap = readJson(options.resourceMapPath, 'resource map');
  invariant(
    resourceMap.file.sha256 === CANONICAL_AUTHORITY.resourceMapSha256,
    'resource map SHA-256 mismatch: '
      + `actual=${resourceMap.file.sha256} `
      + `expected=${CANONICAL_AUTHORITY.resourceMapSha256}`,
  );
  const dispositions = readJson(options.dispositionMapPath, 'resource disposition map');
  const registryFile = readFile(options.registryPath, 'resource consumer registry');
  hooks.afterRegistryRead?.({
    registryPath: options.registryPath,
    sha256: registryFile.sha256,
  });
  const flattened = flattenResourceMap(resourceMap.value, CANONICAL_AUTHORITY);
  const stagedByPath = new Map(
    flattened.entries.map((entry) => [entry.canonicalPath, entry]),
  );
  invariant(
    stagedByPath.size === EXPECTED_COUNTS.staged,
    `resource map must stage exactly ${EXPECTED_COUNTS.staged} assets`,
  );

  const registryModule = await import(
    `${pathToFileURL(options.registryPath).href}?sha256=${registryFile.sha256}`
  );
  const registryAfterImport = readFile(
    options.registryPath,
    'resource consumer registry',
    registryFile.identity,
  );
  invariant(
    registryAfterImport.sha256 === registryFile.sha256,
    'resource consumer registry changed during import',
  );
  invariant(
    typeof registryModule.listResourceConsumerRecords === 'function',
    'resource consumer registry must export listResourceConsumerRecords()',
  );
  invariant(
    registryModule.RESOURCE_CONSUMER_REGISTRY
      === registryModule.listResourceConsumerRecords(),
    'resource consumer registry getter must return the immutable registry authority',
  );
  const consumedByPath = validateRegistry(
    registryModule.RESOURCE_CONSUMER_REGISTRY,
    stagedByPath,
  );
  const dispositionsByPath = validateDispositionMap(
    dispositions.value,
    stagedByPath,
    consumedByPath,
  );

  const ledgerEntries = flattened.entries.map(({ canonicalPath }) => {
    const consumed = consumedByPath.get(canonicalPath);
    if (consumed) {
      return {
        canonicalPath,
        status: 'consumed',
        consumerIds: [...consumed.consumerIds],
        evidenceRefs: [...consumed.evidenceRefs],
      };
    }
    const disposition = dispositionsByPath.get(canonicalPath);
    invariant(
      disposition !== undefined,
      `staged resource lacks a consumer or explicit disposition: ${canonicalPath}`,
    );
    return disposition;
  });
  const summary = ledgerSummary(ledgerEntries);
  invariant(summary.consumers.consumed === EXPECTED_COUNTS.consumed, 'consumed count mismatch');
  invariant(summary.reconciliation.unknown === EXPECTED_COUNTS.unknown, 'unknown count mismatch');
  invariant(summary.reconciliation.excluded === EXPECTED_COUNTS.excluded, 'excluded count mismatch');
  invariant(summary.reconciliation.unsupported === EXPECTED_COUNTS.unsupported, 'unsupported count mismatch');
  invariant(summary.reconciliation.coveragePercent === 100, 'reconciliation must cover every staged asset');

  const ledger = {
    schemaVersion: 1,
    scope: 'recovered-apk-resource-reconciliation',
    source: {
      resourceMapSha256: CANONICAL_AUTHORITY.resourceMapSha256,
      sourceManifestSha256: CANONICAL_AUTHORITY.sourceManifestSha256,
      consumerRegistry: 'game/assets/scripts/domain/resource-consumer-registry.ts',
      consumerRegistrySha256: registryFile.sha256,
      dispositions: 'forensics/resources/resource-disposition-map.json',
      dispositionsSha256: dispositions.file.sha256,
    },
    summary,
    entries: ledgerEntries,
  };
  applyResourceReconciliationLedger(
    flattened.entries,
    ledger,
    CANONICAL_AUTHORITY,
  );
  const ledgerContents = serialize(ledger);
  return {
    ledger,
    ledgerContents,
  };
}

function assertGeneratedFile(filePath, expectedContents, label) {
  const actual = readFile(filePath, label);
  invariant(
    actual.buffer.toString('utf8') === expectedContents,
    `${label} is stale; regenerate it with scripts/generate-resource-reconciliation-ledger.mjs write`,
  );
}

function prepareGeneratedFile(filePath, contents, label) {
  const parent = path.dirname(filePath);
  const stat = fs.lstatSync(parent);
  invariant(stat.isDirectory() && !stat.isSymbolicLink(), `output parent must be a real directory: ${parent}`);
  invariant(!fs.existsSync(filePath), `generated output must be absent: ${filePath}`);
  const temporaryPath = path.join(
    parent,
    `.${path.basename(filePath)}.tmp-${process.pid}-${crypto.randomBytes(8).toString('hex')}`,
  );
  let descriptor;
  try {
    descriptor = fs.openSync(
      temporaryPath,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
      0o644,
    );
    fs.writeFileSync(descriptor, contents);
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    throw error;
  }
  fs.closeSync(descriptor);
  const temporary = readFile(temporaryPath, `temporary ${label}`);
  invariant(
    temporary.buffer.toString('utf8') === contents,
    `temporary ${label} content mismatch`,
  );
  return {
    contents,
    filePath,
    identity: temporary.identity,
    label,
    published: false,
    temporaryPath,
  };
}

function unlinkOwnedPath(filePath, identity, label) {
  if (!fs.existsSync(filePath)) return;
  const stat = fs.lstatSync(filePath);
  invariant(
    stat.isFile()
      && !stat.isSymbolicLink()
      && `${stat.dev}:${stat.ino}` === identity,
    `${label} identity changed; refusing cleanup: ${filePath}`,
  );
  fs.unlinkSync(filePath);
}

function publishPreparedFile(prepared) {
  invariant(
    !fs.existsSync(prepared.filePath),
    `generated output must be absent: ${prepared.filePath}`,
  );
  fs.linkSync(prepared.temporaryPath, prepared.filePath);
  prepared.published = true;
  const published = readFile(
    prepared.filePath,
    prepared.label,
    prepared.identity,
    2n,
  );
  invariant(
    published.identity === prepared.identity
      && published.buffer.toString('utf8') === prepared.contents,
    `published ${prepared.label} identity or content mismatch`,
  );
}

function writeGeneratedFile(filePath, contents, label) {
  invariant(
    !fs.existsSync(filePath),
    `generated output must be absent: ${filePath}`,
  );
  let prepared = null;
  let operationError = null;
  try {
    prepared = prepareGeneratedFile(filePath, contents, label);
    publishPreparedFile(prepared);
  } catch (error) {
    operationError = error instanceof Error ? error : new Error(String(error));
  }

  const cleanupIssues = [];
  if (operationError && prepared?.published) {
    try {
      unlinkOwnedPath(prepared.filePath, prepared.identity, `published ${prepared.label}`);
      prepared.published = false;
    } catch (error) {
      cleanupIssues.push(error.message);
    }
  }
  if (prepared) {
    try {
      unlinkOwnedPath(
        prepared.temporaryPath,
        prepared.identity,
        `temporary ${prepared.label}`,
      );
    } catch (error) {
      cleanupIssues.push(error.message);
    }
  }

  if (operationError || cleanupIssues.length > 0) {
    const message = operationError?.message ?? 'generated output cleanup failed';
    const cleanup = cleanupIssues.length > 0
      ? `; recovery required: ${cleanupIssues.join('; ')}`
      : '';
    throw new ResourceReconciliationError(`${message}${cleanup}`);
  }

  assertGeneratedFile(filePath, contents, label);
}

function parseCli(argv) {
  const [mode, ...tokens] = argv;
  invariant(mode === 'write' || mode === 'verify', 'mode must be write or verify');
  invariant(tokens.length % 2 === 0, 'every option requires a value');
  const flags = new Map([
    ['--resource-map', 'resourceMapPath'],
    ['--registry', 'registryPath'],
    ['--dispositions', 'dispositionMapPath'],
    ['--ledger', 'ledgerPath'],
  ]);
  const options = {};
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    invariant(flags.has(flag), `unknown option: ${flag}`);
    const key = flags.get(flag);
    invariant(options[key] === undefined, `duplicate option: ${flag}`);
    invariant(
      typeof value === 'string' && value.length > 0 && !value.startsWith('--'),
      `missing value for ${flag}`,
    );
    options[key] = value;
  }
  for (const [flag, key] of flags) {
    invariant(options[key] !== undefined, `missing required option: ${flag}`);
  }
  return { mode, options };
}

async function main(argv) {
  try {
    const { mode, options } = parseCli(argv);
    const generated = await generateOutputs(options);
    if (mode === 'write') {
      writeGeneratedFile(
        path.resolve(options.ledgerPath),
        generated.ledgerContents,
        'resource reconciliation ledger',
      );
    } else {
      assertGeneratedFile(
        path.resolve(options.ledgerPath),
        generated.ledgerContents,
        'resource reconciliation ledger',
      );
    }
    const summary = generated.ledger.summary;
    console.log(
      `${mode.toUpperCase()} OK staged=${summary.reconciliation.total}`
      + ` consumed=${summary.consumers.consumed}`
      + ` unknown=${summary.reconciliation.unknown}`
      + ` excluded=${summary.reconciliation.excluded}`
      + ` unsupported=${summary.reconciliation.unsupported}`
      + ` reconciliation_coverage=${summary.reconciliation.coveragePercent}%`,
    );
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}

export {
  EXPECTED_COUNTS,
  ResourceReconciliationError,
  generateOutputs,
  parseCli,
  validateDispositionMap,
  validateRegistry,
  writeGeneratedFile,
};
