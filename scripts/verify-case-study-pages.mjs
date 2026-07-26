#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { extname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  contentTypeForWebPath,
  extractStaticWebReferences,
} from './audit-web-build.mjs';
import {
  DEFAULT_PAGES_PREFIX,
  verifyGameArtifactBinding,
} from './audit-case-study-build.mjs';
import {
  collectCandidateFiles,
} from './generate-case-study-release-manifest.mjs';
import {
  assertExactPublicRouteFiles,
  assertExactSitemapRoutes,
  assertNoForbiddenRouteFiles,
  assertNoForbiddenSitemapUrls,
  hasExpectedPublicRoutes,
  PUBLIC_ROUTES,
  REQUIRED_CASE_STUDY_ROUTES,
  routeToFile,
} from './case-study-public-routes.mjs';
import { verifyWebMobileBuild } from './verify-web-mobile-build.mjs';

export { REQUIRED_CASE_STUDY_ROUTES };

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_PUBLICATION_MANIFEST = resolve(
  REPOSITORY_ROOT,
  'reference/case-study-publication-manifest.json',
);
const REFERENCE_EXTENSIONS = new Set([
  '.css',
  '.htm',
  '.html',
  '.js',
  '.json',
  '.mjs',
  '.svg',
  '.xml',
]);
const RELEASE_METADATA_FILES = new Set([
  'case-study-release.json',
  'case-study-tree-manifest.json',
]);

function normalizePagesPrefix(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('pagesPrefix must be a non-empty absolute URL path');
  }
  const trimmed = value.trim();
  if (
    !trimmed.startsWith('/')
    || trimmed.startsWith('//')
    || trimmed.includes('\\')
    || /[?#]/u.test(trimmed)
    || /%(?:00|2e|2f|5c)/iu.test(trimmed)
  ) {
    throw new Error('pagesPrefix must be a safe absolute URL path');
  }
  const segments = trimmed.split('/').filter(Boolean);
  if (
    segments.length === 0
    || segments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error('pagesPrefix must contain a non-root path without traversal');
  }
  return `/${segments.join('/')}/`;
}

function decodeEntities(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&#x2f;', '/')
    .replaceAll('&#47;', '/')
    .trim();
}

function resolveReferencePath(reference, pagesPrefix, filePaths) {
  const value = decodeEntities(reference.value);
  if (
    value.length === 0
    || value.startsWith('#')
    || /^(?:about:blank|data:|mailto:|tel:)/iu.test(value)
    || /^https:/iu.test(value)
  ) {
    return undefined;
  }
  if (
    /^(?:http:|wss?:|blob:|file:|javascript:|vbscript:)/iu.test(value)
    || value.startsWith('//')
  ) {
    throw new Error(`${reference.source} contains a prohibited external or unsafe URL: ${value}`);
  }
  if (value.includes('\\')) {
    throw new Error(`${reference.source} contains an unsafe backslash URL: ${value}`);
  }
  const encodedPath = value.split(/[?#]/u, 1)[0];
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(encodedPath);
  } catch {
    throw new Error(`${reference.source} contains malformed URL encoding: ${value}`);
  }
  let candidate;
  if (decodedPath.startsWith('/')) {
    if (!decodedPath.startsWith(pagesPrefix)) {
      throw new Error(`${reference.source} bypasses ${pagesPrefix}: ${value}`);
    }
    candidate = decodedPath.slice(pagesPrefix.length);
  } else {
    candidate = posix.normalize(posix.join(posix.dirname(reference.source), decodedPath));
  }
  if (
    candidate === '..'
    || candidate.startsWith('../')
    || posix.isAbsolute(candidate)
    || candidate.split('/').some((segment) => segment === '..')
  ) {
    throw new Error(`${reference.source} contains an escaping URL: ${value}`);
  }
  if (candidate.length === 0 || decodedPath.endsWith('/')) {
    candidate = `${candidate}index.html`;
  } else if (!filePaths.has(candidate) && !posix.extname(candidate)) {
    candidate = `${candidate}/index.html`;
  }
  return candidate;
}

function normalizeDisplayedInteger(value, label) {
  const digits = value.replaceAll(/[.,\s]/gu, '');
  const result = Number(digits);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error(`${label} is not a safe integer`);
  }
  return result;
}

function attributeValue(source, name) {
  const match = source.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'iu'),
  );
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function referencedExecutableScripts(
  pageSource,
  pagePath,
  filesByPath,
  pagesPrefix,
) {
  const sources = [];
  for (const match of pageSource.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)) {
    const attributes = match[1];
    const body = match[2].trim();
    const type = attributeValue(attributes, 'type')?.toLowerCase();
    const sourceUrl = attributeValue(attributes, 'src');
    if (!sourceUrl) {
      if (body && type !== 'application/ld+json') {
        throw new Error(`${pagePath} contains executable inline script blocked by editorial CSP`);
      }
      continue;
    }
    const scriptPath = resolveReferencePath(
      { source: pagePath, value: sourceUrl },
      pagesPrefix,
      new Set(filesByPath.keys()),
    );
    const script = scriptPath === undefined ? undefined : filesByPath.get(scriptPath);
    if (!script || extname(script.path).toLowerCase() !== '.js') {
      throw new Error(`${pagePath} references an invalid executable script: ${sourceUrl}`);
    }
    sources.push(script.bytes.toString('utf8'));
  }
  return sources.join('\n');
}

function parseLaunchFacts(source, behaviorSource, locale, expectedMount) {
  const gameUrl = attributeValue(source, 'data-game-url');
  const directLink = source.match(
    /<a\b(?=[^>]*\bdata-play-direct\b)[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/iu,
  );
  const directUrl = directLink?.[1] ?? directLink?.[2];
  if (gameUrl !== expectedMount || directUrl !== expectedMount) {
    throw new Error(`${locale} launch route does not disclose the exact ${expectedMount} mount`);
  }
  if (!/\bdata-play-load\b/iu.test(source)) {
    throw new Error(`${locale} launch route is missing its explicit load control`);
  }
  if (/<iframe\b/iu.test(source)) {
    throw new Error(`${locale} launch route eagerly embeds the game iframe`);
  }
  if (
    new RegExp(
      `<(?:iframe|img|script|source|video|audio|embed)\\b[^>]*(?:src|href)\\s*=\\s*["']${expectedMount.replaceAll('/', '\\/')}[^"']*["']`,
      'iu',
    ).test(source)
    || new RegExp(
      `<link\\b(?=[^>]*\\brel\\s*=\\s*["'][^"']*(?:preload|prefetch|modulepreload))[^>]*\\bhref\\s*=\\s*["']${expectedMount.replaceAll('/', '\\/')}[^"']*["']`,
      'iu',
    ).test(source)
    || new RegExp(
      `<object\\b[^>]*\\bdata\\s*=\\s*["']${expectedMount.replaceAll('/', '\\/')}[^"']*["']`,
      'iu',
    ).test(source)
    || new RegExp(
      `(?:fetch|importScripts)\\s*\\(\\s*["'\`]${expectedMount.replaceAll('/', '\\/')}[^"'\`]*["'\`]`,
      'u',
    ).test(source)
    || new RegExp(
      `url\\(\\s*["']?${expectedMount.replaceAll('/', '\\/')}[^)"']*["']?\\s*\\)`,
      'iu',
    ).test(source)
  ) {
    throw new Error(`${locale} launch route eagerly requests game payload bytes`);
  }
  if (
    !/createElement\(\s*(?:["'`])iframe(?:["'`])\s*\)/u.test(behaviorSource)
    || !/addEventListener\(\s*(?:["'`])click(?:["'`])/u.test(behaviorSource)
  ) {
    throw new Error(`${locale} launch route does not preserve the click-to-create iframe boundary`);
  }
  const filesMatch = source.match(/(\d[\d.,\s]*)\s+files\b/iu);
  const bytesMatch = source.match(/(\d[\d.,\s]*)\s+bytes\b/iu);
  const digestMatch = source.match(/<code[^>]*>\s*([a-f0-9]{64})\s*<\/code>/iu);
  if (!filesMatch || !bytesMatch || !digestMatch) {
    throw new Error(`${locale} launch route lacks complete published H5 provenance`);
  }
  return Object.freeze({
    bytes: normalizeDisplayedInteger(bytesMatch[1], `${locale} displayed bytes`),
    files: normalizeDisplayedInteger(filesMatch[1], `${locale} displayed files`),
    gameUrl,
    treeDigestSha256: digestMatch[1],
  });
}

function readPublicationManifest(value) {
  if (typeof value === 'string') {
    return JSON.parse(readFileSync(resolve(value), 'utf8'));
  }
  if (value && typeof value === 'object') {
    return value;
  }
  throw new Error('publicationManifest must be a JSON object or path');
}

function assertRequiredRoutes(filePaths) {
  for (const route of REQUIRED_CASE_STUDY_ROUTES) {
    const path = routeToFile(route);
    if (!filePaths.has(path)) {
      throw new Error(`required bilingual case-study route is missing: ${route}`);
    }
  }
  if (!filePaths.has('play/game/index.html')) {
    throw new Error('required direct game launch route is missing: /play/game/');
  }
}

function verifyLanguageRoots(filesByPath) {
  const english = filesByPath.get('play/index.html').bytes.toString('utf8');
  const vietnamese = filesByPath.get('vi/play/index.html').bytes.toString('utf8');
  if (!/<html\b[^>]*\blang=["']en["']/iu.test(english)) {
    throw new Error('English launch route does not declare lang="en"');
  }
  if (!/<html\b[^>]*\blang=["']vi["']/iu.test(vietnamese)) {
    throw new Error('Vietnamese launch route does not declare lang="vi"');
  }
  return { english, vietnamese };
}

function verifyReferences(files, filePaths, pagesPrefix) {
  const references = [];
  for (const file of files) {
    if (
      file.path.startsWith('play/game/')
      || RELEASE_METADATA_FILES.has(file.path)
      || !REFERENCE_EXTENSIONS.has(extname(file.path).toLowerCase())
    ) {
      continue;
    }
    const source = file.absolutePath
      ? readFileSync(file.absolutePath, 'utf8')
      : file.bytes.toString('utf8');
    const markupWithoutInlineScripts = /\.html?$/iu.test(file.path)
      ? source.replace(
        /(<script\b[^>]*>)[\s\S]*?<\/script>/giu,
        '$1</script>',
      )
      : source;
    for (const reference of extractStaticWebReferences(file.path, source)) {
      if (
        reference.kind.startsWith('markup-')
        && !markupWithoutInlineScripts.includes(reference.value)
      ) {
        continue;
      }
      const path = resolveReferencePath(reference, pagesPrefix, filePaths);
      if (path === undefined) continue;
      if (!filePaths.has(path)) {
        throw new Error(
          `${reference.source} references missing candidate file ${path} via ${reference.value}`,
        );
      }
      references.push(Object.freeze({
        path,
        source: reference.source,
        value: reference.value,
      }));
    }
  }
  return Object.freeze(references);
}

export async function verifyCaseStudyPages(outDir, options = {}) {
  const pagesPrefix = normalizePagesPrefix(options.pagesPrefix ?? DEFAULT_PAGES_PREFIX);
  if (pagesPrefix !== DEFAULT_PAGES_PREFIX) {
    throw new Error(
      `case-study candidate must use exact Pages prefix ${DEFAULT_PAGES_PREFIX}`,
    );
  }
  const files = collectCandidateFiles(outDir, { label: 'candidate directory' });
  const filesByPath = new Map(files.map((file) => [
    file.path,
    Object.freeze({ ...file, bytes: readFileSync(file.absolutePath) }),
  ]));
  const filePaths = new Set(filesByPath.keys());
  assertRequiredRoutes(filePaths);
  assertNoForbiddenRouteFiles(filePaths, 'case-study candidate');
  assertExactPublicRouteFiles(filePaths, 'case-study candidate');
  const sitemapSources = [...filesByPath.values()]
    .filter((file) => /(?:^|\/)sitemap[^/]*\.xml$/u.test(file.path))
    .map((file) => file.bytes.toString('utf8'));
  assertNoForbiddenSitemapUrls(
    sitemapSources,
    'case-study candidate sitemap',
  );
  assertExactSitemapRoutes(
    sitemapSources,
    pagesPrefix,
    'case-study candidate sitemap',
  );
  const releaseRecord = filesByPath.get('case-study-release.json');
  if (releaseRecord) {
    const release = JSON.parse(releaseRecord.bytes.toString('utf8'));
    if (!hasExpectedPublicRoutes(release.publication?.routes)) {
      throw new Error('case-study release manifest has an unexpected public route set');
    }
  }

  for (const file of files) {
    if (contentTypeForWebPath(file.path) === undefined) {
      throw new Error(`${file.path} has no acceptable static MIME mapping`);
    }
  }
  const references = verifyReferences(
    [...filesByPath.values()],
    filePaths,
    pagesPrefix,
  );
  const launchPages = verifyLanguageRoots(filesByPath);
  const expectedMount = `${pagesPrefix}play/game/`;
  const englishBehavior = referencedExecutableScripts(
    launchPages.english,
    'play/index.html',
    filesByPath,
    pagesPrefix,
  );
  const vietnameseBehavior = referencedExecutableScripts(
    launchPages.vietnamese,
    'vi/play/index.html',
    filesByPath,
    pagesPrefix,
  );
  const playFacts = {
    en: parseLaunchFacts(
      launchPages.english,
      englishBehavior,
      'English',
      expectedMount,
    ),
    vi: parseLaunchFacts(
      launchPages.vietnamese,
      vietnameseBehavior,
      'Vietnamese',
      expectedMount,
    ),
  };
  const publicationManifest = readPublicationManifest(
    options.publicationManifest ?? DEFAULT_PUBLICATION_MANIFEST,
  );
  const binding = verifyGameArtifactBinding({
    evidenceSnapshot: publicationManifest,
    gameDist: resolve(outDir, 'play/game'),
    pagesPrefix,
    playFacts,
  });
  const game = await verifyWebMobileBuild(resolve(outDir, 'play/game'), {
    entryPath: 'index.html',
    pagesPrefix: expectedMount,
  });
  return Object.freeze({
    binding,
    checkedFiles: files.length,
    checkedRoutes: Object.freeze([
      ...REQUIRED_CASE_STUDY_ROUTES.map((route) => `${pagesPrefix}${route.slice(1)}`),
      expectedMount,
    ]),
    discoveredReferences: references,
    game,
    pagesPrefix,
  });
}

function parseArguments(argv) {
  const options = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) {
      positional.push(argument);
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`missing value for ${argument}`);
    }
    index += 1;
    if (argument === '--candidate-dir') options.candidateDir = value;
    else if (argument === '--pages-prefix') options.pagesPrefix = value;
    else if (argument === '--publication-manifest') options.publicationManifest = value;
    else throw new Error(`unknown option: ${argument}`);
  }
  options.candidateDir ??= positional[0];
  options.pagesPrefix ??= positional[1];
  options.publicationManifest ??= positional[2] ?? DEFAULT_PUBLICATION_MANIFEST;
  if (positional.length > 3) throw new Error('too many positional arguments');
  return options;
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = await verifyCaseStudyPages(options.candidateDir, options);
    process.stdout.write(
      `PASS verified ${result.checkedFiles} files at ${result.pagesPrefix}; `
      + `game=${result.binding.treeDigestSha256}\n`,
    );
  } catch (error) {
    process.stderr.write(`ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
