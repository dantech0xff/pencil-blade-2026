#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadPublicationContext,
} from './generate-case-study-data.mjs';
import chapterValidationFragment from './case-study-validation/chapters.mjs';
import aiLabValidationFragment from './case-study-validation/ai-lab.mjs';
import playValidationFragment from './case-study-validation/play.mjs';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const DEFAULT_BASE = '/pencil-blade-2026/';
const SUPPORTED_LOCALES = Object.freeze(['en', 'vi']);

export const validationFragments = Object.freeze([
  chapterValidationFragment,
  aiLabValidationFragment,
  playValidationFragment,
]);

export function createValidationFinding(code, path, message) {
  if (
    typeof code !== 'string'
    || code.length === 0
    || typeof path !== 'string'
    || path.length === 0
    || typeof message !== 'string'
    || message.length === 0
  ) {
    throw new Error('Validation findings require non-empty code, path, and message strings.');
  }
  return Object.freeze({ code, path, message });
}

export function sortValidationFindings(findings) {
  return [...findings].sort((left, right) =>
    `${left.code}\0${left.path}\0${left.message}`.localeCompare(
      `${right.code}\0${right.path}\0${right.message}`,
    ));
}

function isFinding(value) {
  return value
    && typeof value === 'object'
    && typeof value.code === 'string'
    && value.code.length > 0
    && typeof value.path === 'string'
    && value.path.length > 0
    && typeof value.message === 'string'
    && value.message.length > 0;
}

export function aggregateValidationFragments(context = {}, fragments = validationFragments) {
  const findings = [];
  const seenIds = new Set();

  fragments.forEach((fragment, index) => {
    const pointer = `$.validationFragments[${index}]`;
    if (
      !fragment
      || typeof fragment.id !== 'string'
      || fragment.id.length === 0
      || typeof fragment.validate !== 'function'
    ) {
      findings.push(
        createValidationFinding(
          'INVALID_VALIDATION_FRAGMENT',
          pointer,
          'Validation fragment requires a non-empty id and validate function.',
        ),
      );
      return;
    }
    if (seenIds.has(fragment.id)) {
      findings.push(
        createValidationFinding(
          'DUPLICATE_VALIDATION_FRAGMENT',
          `${pointer}.id`,
          `Duplicate validation fragment ${fragment.id}.`,
        ),
      );
      return;
    }
    seenIds.add(fragment.id);

    let fragmentFindings;
    try {
      fragmentFindings = fragment.validate(context);
    } catch (error) {
      findings.push(
        createValidationFinding(
          'VALIDATION_FRAGMENT_ERROR',
          pointer,
          `${fragment.id} failed: ${error.message}`,
        ),
      );
      return;
    }
    if (!Array.isArray(fragmentFindings)) {
      findings.push(
        createValidationFinding(
          'INVALID_FRAGMENT_RESULT',
          pointer,
          `${fragment.id} must return an array of findings.`,
        ),
      );
      return;
    }
    fragmentFindings.forEach((entry, findingIndex) => {
      if (isFinding(entry)) {
        findings.push({
          code: entry.code,
          path: entry.path,
          message: entry.message,
        });
      } else {
        findings.push(
          createValidationFinding(
            'INVALID_FRAGMENT_FINDING',
            `${pointer}.findings[${findingIndex}]`,
            `${fragment.id} returned a malformed finding.`,
          ),
        );
      }
    });
  });

  return sortValidationFindings(findings);
}

function flattenEntries(entries) {
  if (entries === undefined || entries === null) {
    return [];
  }
  if (Array.isArray(entries)) {
    return entries;
  }
  if (typeof entries !== 'object') {
    return [entries];
  }
  if (Array.isArray(entries.entries)) {
    return entries.entries;
  }
  return Object.entries(entries).flatMap(([collection, collectionEntries]) => (
    Array.isArray(collectionEntries)
      ? collectionEntries.map((entry) => (
        entry && typeof entry === 'object' && !entry.collection
          ? { ...entry, collection }
          : entry
      ))
      : []
  ));
}

function entryData(entry) {
  return entry?.data && typeof entry.data === 'object' ? entry.data : entry;
}

function entryCollection(entry) {
  return entry?.collection ?? entryData(entry)?.collection ?? 'content';
}

function entryLogicalId(entry) {
  const data = entryData(entry);
  return data?.id ?? entry?.id ?? data?.slug ?? entry?.slug;
}

function entryLocale(entry) {
  const data = entryData(entry);
  return data?.locale ?? entry?.locale;
}

export function validateCollectionParity(entries, options = {}) {
  const requiredLocales = options.supportedLocales ?? SUPPORTED_LOCALES;
  const findings = [];
  const groups = new Map();

  flattenEntries(entries).forEach((entry, index) => {
    const pointer = `$.entries[${index}]`;
    const data = entryData(entry);
    if (!data || typeof data !== 'object') {
      findings.push(
        createValidationFinding('INVALID_CONTENT_ENTRY', pointer, 'Content entry must be an object.'),
      );
      return;
    }
    if (data.draft === true) {
      return;
    }
    const id = entryLogicalId(entry);
    const locale = entryLocale(entry);
    if (typeof id !== 'string' || id.length === 0) {
      findings.push(
        createValidationFinding(
          'MISSING_CONTENT_ID',
          `${pointer}.id`,
          'Launch content requires a stable id.',
        ),
      );
      return;
    }
    if (!requiredLocales.includes(locale)) {
      findings.push(
        createValidationFinding(
          'INVALID_CONTENT_LOCALE',
          `${pointer}.locale`,
          `Expected one of ${requiredLocales.join(', ')}, found ${String(locale)}.`,
        ),
      );
      return;
    }
    const key = `${entryCollection(entry)}\0${id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        collection: entryCollection(entry),
        id,
        locales: new Map(),
      });
    }
    const group = groups.get(key);
    if (group.locales.has(locale)) {
      findings.push(
        createValidationFinding(
          'DUPLICATE_LOCALE_ENTRY',
          pointer,
          `Duplicate ${locale} entry for ${group.collection}/${id}.`,
        ),
      );
    } else {
      group.locales.set(locale, index);
    }
  });

  for (const group of groups.values()) {
    const missing = requiredLocales.filter((locale) => !group.locales.has(locale));
    if (missing.length > 0) {
      findings.push(
        createValidationFinding(
          'MISSING_LOCALE_PAIR',
          `$.collections.${group.collection}.${group.id}`,
          `${group.collection}/${group.id} is missing locale(s): ${missing.join(', ')}.`,
        ),
      );
    }
  }

  return sortValidationFindings(findings);
}

function manifestParts(manifestInput) {
  if (manifestInput?.publicationManifest) {
    return {
      manifest: manifestInput.publicationManifest,
      sourceCatalog: manifestInput.sourceCatalog,
      canonicalClaims: manifestInput.canonicalClaims ?? [],
    };
  }
  let sourceCatalog = manifestInput?.sourceCatalog ?? manifestInput?.sourceCatalogData;
  if (!sourceCatalog && typeof manifestInput?.sourceCatalogRef === 'string') {
    const sourceCatalogPath = resolve(REPOSITORY_ROOT, manifestInput.sourceCatalogRef);
    const fromRoot = relative(REPOSITORY_ROOT, sourceCatalogPath);
    if (
      fromRoot !== '..'
      && !fromRoot.startsWith(`..${sep}`)
      && !sourceCatalogPath.includes('\0')
      && existsSync(sourceCatalogPath)
    ) {
      sourceCatalog = JSON.parse(readFileSync(sourceCatalogPath, 'utf8'));
    }
  }
  let canonicalClaims = manifestInput?.canonicalClaims ?? [];
  if (canonicalClaims.length === 0 && Array.isArray(manifestInput?.claimPresentations)) {
    const claimsPath = resolve(REPOSITORY_ROOT, 'forensics/claims.jsonl');
    canonicalClaims = readFileSync(claimsPath, 'utf8')
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
  return {
    manifest: manifestInput ?? {},
    sourceCatalog,
    canonicalClaims,
  };
}

function referenceArray(data, names) {
  for (const name of names) {
    if (Array.isArray(data?.[name])) {
      return { name, values: data[name] };
    }
  }
  return { name: names[0], values: [] };
}

export function validateContentReferences(entries, manifestInput) {
  const { manifest, sourceCatalog, canonicalClaims } = manifestParts(manifestInput);
  const canonicalById = new Map(canonicalClaims.map((claim) => [claim.id, claim]));
  const claimIds = new Set([
    ...canonicalClaims.map((claim) => claim.id),
    ...(manifest.claimPresentations ?? []).map((record) => record.canonicalClaimId),
  ]);
  const mediaIds = new Set(
    (manifest.media ?? manifest.mediaRecords ?? []).map((record) => record.mediaId),
  );
  const sourceIds = new Set(
    (sourceCatalog?.sources ?? manifest.sources ?? []).map((record) => record.sourceId),
  );
  const contentIds = new Set(
    flattenEntries(entries)
      .map(entryLogicalId)
      .filter((id) => typeof id === 'string' && id.length > 0),
  );
  const findings = [];

  flattenEntries(entries).forEach((entry, index) => {
    const data = entryData(entry);
    const pointer = `$.entries[${index}]`;
    if (!data || typeof data !== 'object' || data.draft === true) {
      return;
    }

    const evidence = referenceArray(data, ['evidenceRefs', 'claimRefs']);
    evidence.values.forEach((reference, referenceIndex) => {
      const referenceId = typeof reference === 'string'
        ? reference
        : reference?.canonicalClaimId ?? reference?.claimId ?? reference?.id;
      if (!claimIds.has(referenceId)) {
        findings.push(
          createValidationFinding(
            'UNKNOWN_EVIDENCE_REF',
            `${pointer}.${evidence.name}[${referenceIndex}]`,
            `Unknown canonical claim reference ${String(referenceId)}.`,
          ),
        );
      } else if (
        reference
        && typeof reference === 'object'
        && reference.status !== undefined
        && canonicalById.has(referenceId)
        && reference.status !== canonicalById.get(referenceId).status
      ) {
        findings.push(
          createValidationFinding(
            'EVIDENCE_STATUS_MISMATCH',
            `${pointer}.${evidence.name}[${referenceIndex}].status`,
            `Status for ${referenceId} must come from the canonical claim ledger.`,
          ),
        );
      }
    });

    if (
      typeof data.canonicalClaimId === 'string'
      && data.status !== undefined
      && canonicalById.has(data.canonicalClaimId)
      && data.status !== canonicalById.get(data.canonicalClaimId).status
    ) {
      findings.push(
        createValidationFinding(
          'EVIDENCE_STATUS_MISMATCH',
          `${pointer}.status`,
          `Status for ${data.canonicalClaimId} must come from the canonical claim ledger.`,
        ),
      );
    }

    const media = referenceArray(data, ['mediaRefs']);
    media.values.forEach((reference, referenceIndex) => {
      if (!mediaIds.has(reference)) {
        findings.push(
          createValidationFinding(
            'UNKNOWN_MEDIA_REF',
            `${pointer}.${media.name}[${referenceIndex}]`,
            `Unknown media reference ${String(reference)}.`,
          ),
        );
      }
    });

    const sources = referenceArray(data, ['publicSourceIds', 'sourceRefs', 'reportRefs']);
    sources.values.forEach((reference, referenceIndex) => {
      if (!sourceIds.has(reference)) {
        findings.push(
          createValidationFinding(
            'UNKNOWN_SOURCE_REF',
            `${pointer}.${sources.name}[${referenceIndex}]`,
            `Unknown public source reference ${String(reference)}.`,
          ),
        );
      }
    });

    if (data.nextId !== undefined && data.nextId !== null && !contentIds.has(data.nextId)) {
      findings.push(
        createValidationFinding(
          'UNKNOWN_NEXT_CONTENT',
          `${pointer}.nextId`,
          `Unknown next content id ${String(data.nextId)}.`,
        ),
      );
    }
  });

  return sortValidationFindings(findings);
}

function normalizedBase(base) {
  if (typeof base !== 'string' || !base.startsWith('/') || !base.endsWith('/')) {
    throw new Error('Pages base must start and end with "/".');
  }
  const segments = base.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Pages base contains an unsafe segment.');
  }
  return `/${segments.join('/')}/`;
}

function normalizePublicPath(pathValue, { directory = true } = {}) {
  let pathname;
  try {
    pathname = new URL(pathValue, 'https://case-study.invalid/').pathname;
  } catch {
    return null;
  }
  pathname = pathname.replaceAll(/\/{2,}/gu, '/');
  if (directory && extname(pathname) === '' && !pathname.endsWith('/')) {
    pathname += '/';
  }
  return pathname;
}

function routeRecord(record) {
  if (typeof record === 'string') {
    return { path: record, links: [] };
  }
  return {
    path: record?.path ?? record?.pathname ?? record?.url,
    links: record?.links ?? record?.hrefs ?? [],
  };
}

function routeManifestFromDirectory(directory, base = DEFAULT_BASE) {
  const routes = [];
  const publicBase = normalizedBase(base);

  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = resolve(current, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        const fromRoot = relative(directory, absolute).split(sep).join('/');
        if (entry.name.endsWith('.html')) {
          const routePath = fromRoot === 'index.html'
            ? publicBase
            : `${publicBase}${fromRoot.replace(/index\.html$/u, '')}`;
          const html = readFileSync(absolute, 'utf8');
          const links = [...html.matchAll(
            /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/giu,
          )].map((match) => match[1] ?? match[2]);
          routes.push({ path: routePath, links });
        } else {
          routes.push({ path: `${publicBase}${fromRoot}`, links: [] });
        }
      }
    }
  }

  walk(directory);
  return { base: publicBase, routes };
}

function isExternalReference(link) {
  return /^(?:https?:|mailto:|tel:|data:)/iu.test(link) || link.startsWith('//');
}

export function validateInternalLinks(distOrRouteManifest, options = {}) {
  if (distOrRouteManifest === undefined || distOrRouteManifest === null) {
    return [];
  }

  let routeManifest = distOrRouteManifest;
  if (typeof distOrRouteManifest === 'string') {
    if (!existsSync(distOrRouteManifest) || !statSync(distOrRouteManifest).isDirectory()) {
      return [
        createValidationFinding(
          'MISSING_ROUTE_MANIFEST',
          '$.routes',
          `Route directory does not exist: ${distOrRouteManifest}`,
        ),
      ];
    }
    routeManifest = routeManifestFromDirectory(
      distOrRouteManifest,
      options.base ?? DEFAULT_BASE,
    );
  } else if (Array.isArray(distOrRouteManifest)) {
    routeManifest = { base: options.base ?? DEFAULT_BASE, routes: distOrRouteManifest };
  }

  const findings = [];
  let base;
  try {
    base = normalizedBase(options.base ?? routeManifest.base ?? DEFAULT_BASE);
  } catch (error) {
    return [createValidationFinding('INVALID_PAGES_BASE', '$.base', error.message)];
  }

  const routeRecords = routeManifest.routes ?? routeManifest.entries ?? [];
  if (!Array.isArray(routeRecords)) {
    return [
      createValidationFinding('INVALID_ROUTE_MANIFEST', '$.routes', 'routes must be an array.'),
    ];
  }

  const knownPaths = new Set();
  routeRecords.forEach((input, index) => {
    const route = routeRecord(input);
    const pointer = `$.routes[${index}].path`;
    if (typeof route.path !== 'string' || !route.path.startsWith('/')) {
      findings.push(
        createValidationFinding(
          'INVALID_ROUTE_PATH',
          pointer,
          'Route paths must be root-relative strings.',
        ),
      );
      return;
    }
    const path = normalizePublicPath(route.path);
    if (!path) {
      findings.push(createValidationFinding('INVALID_ROUTE_PATH', pointer, 'Invalid route path.'));
      return;
    }
    if (base !== '/' && !path.startsWith(base)) {
      findings.push(
        createValidationFinding(
          'BASE_BYPASS',
          pointer,
          `Route ${path} bypasses Pages base ${base}.`,
        ),
      );
    }
    if (base !== '/' && path.slice(base.length).startsWith(base.slice(1))) {
      findings.push(
        createValidationFinding(
          'DUPLICATE_PAGES_BASE',
          pointer,
          `Route ${path} contains the Pages base more than once.`,
        ),
      );
    }
    if (knownPaths.has(path)) {
      findings.push(
        createValidationFinding('DUPLICATE_ROUTE_PATH', pointer, `Duplicate route path ${path}.`),
      );
    }
    knownPaths.add(path);
  });

  for (const asset of routeManifest.assets ?? []) {
    const path = normalizePublicPath(typeof asset === 'string' ? asset : asset.path, {
      directory: false,
    });
    if (path) {
      knownPaths.add(path);
    }
  }

  routeRecords.forEach((input, routeIndex) => {
    const route = routeRecord(input);
    if (typeof route.path !== 'string') {
      return;
    }
    const sourcePath = normalizePublicPath(route.path);
    if (!sourcePath) {
      return;
    }
    if (!Array.isArray(route.links)) {
      findings.push(
        createValidationFinding(
          'INVALID_ROUTE_LINKS',
          `$.routes[${routeIndex}].links`,
          'Route links must be an array.',
        ),
      );
      return;
    }
    route.links.forEach((linkInput, linkIndex) => {
      const link = typeof linkInput === 'string' ? linkInput : linkInput?.href ?? linkInput?.src;
      const pointer = `$.routes[${routeIndex}].links[${linkIndex}]`;
      if (typeof link !== 'string' || link.length === 0) {
        findings.push(
          createValidationFinding('INVALID_INTERNAL_LINK', pointer, 'Link must be a non-empty string.'),
        );
        return;
      }
      if (link.startsWith('#') || isExternalReference(link)) {
        return;
      }
      if (/^(?:javascript|vbscript|file):/iu.test(link)) {
        findings.push(
          createValidationFinding('UNSAFE_LINK_SCHEME', pointer, `Unsafe link scheme in ${link}.`),
        );
        return;
      }

      let target;
      try {
        target = new URL(link, `https://case-study.invalid${sourcePath}`).pathname;
      } catch {
        findings.push(
          createValidationFinding('INVALID_INTERNAL_LINK', pointer, `Invalid link ${link}.`),
        );
        return;
      }
      target = normalizePublicPath(target, { directory: extname(target) === '' });
      if (base !== '/' && !target.startsWith(base)) {
        findings.push(
          createValidationFinding(
            'BASE_BYPASS',
            pointer,
            `Internal link ${link} bypasses Pages base ${base}.`,
          ),
        );
        return;
      }
      if (base !== '/' && target.slice(base.length).startsWith(base.slice(1))) {
        findings.push(
          createValidationFinding(
            'DUPLICATE_PAGES_BASE',
            pointer,
            `Internal link ${link} contains the Pages base more than once.`,
          ),
        );
        return;
      }
      if (!knownPaths.has(target)) {
        findings.push(
          createValidationFinding(
            'MISSING_INTERNAL_TARGET',
            pointer,
            `Internal link ${link} resolves to missing target ${target}.`,
          ),
        );
      }
    });
  });

  return sortValidationFindings(findings);
}

export function validateCaseStudyContent(options = {}) {
  const phaseOne = options.phaseOne ?? loadPublicationContext();
  const entries = options.entries ?? [];
  const findings = [
    ...validateCollectionParity(entries, options),
    ...validateContentReferences(entries, phaseOne),
    ...validateInternalLinks(options.routes, options),
    ...aggregateValidationFragments({
      entries,
      routes: options.routes,
      publicationManifest: phaseOne.publicationManifest,
      sourceCatalog: phaseOne.sourceCatalog,
      canonicalClaims: phaseOne.canonicalClaims,
    }, options.fragments),
  ];
  return sortValidationFindings(findings);
}

function readJsonFile(repositoryPath) {
  if (repositoryPath === undefined) {
    return undefined;
  }
  const absolute = resolve(REPOSITORY_ROOT, repositoryPath);
  const fromRoot = relative(REPOSITORY_ROOT, absolute);
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
    throw new Error(`Path escapes repository root: ${repositoryPath}`);
  }
  return JSON.parse(readFileSync(absolute, 'utf8'));
}

function parseArguments(arguments_) {
  const options = {};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--entries' || argument === '--routes') {
      const value = arguments_[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a repository-relative JSON path`);
      }
      options[argument.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

export function runCli(arguments_ = process.argv.slice(2)) {
  try {
    const argumentsOptions = parseArguments(arguments_);
    const findings = validateCaseStudyContent({
      entries: readJsonFile(argumentsOptions.entries) ?? [],
      routes: readJsonFile(argumentsOptions.routes),
    });
    if (findings.length > 0) {
      findings.forEach((entry) => {
        process.stderr.write(`${entry.code} ${entry.path}: ${entry.message}\n`);
      });
      return 1;
    }
    process.stdout.write('Case-study content validation passed.\n');
    return 0;
  } catch (error) {
    process.stderr.write(`CASE_STUDY_CONTENT_ERROR: ${error.message}\n`);
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli();
}
