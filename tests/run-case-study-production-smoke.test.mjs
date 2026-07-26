import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  PUBLIC_ROUTES,
  REQUIRED_CASE_STUDY_ROUTES,
} from '../scripts/case-study-public-routes.mjs';
import {
  fetchBrowserRouteWithRetries,
  safeReportDirectory,
  smokeProductionPages,
} from '../scripts/run-case-study-production-smoke.mjs';

const commitSha = '1'.repeat(40);
const contentDigest = 'a'.repeat(64);
const requiredFiles = [
  'index.html',
  'forensics/index.html',
  'play/index.html',
  'vi/index.html',
  'vi/forensics/index.html',
  'vi/play/index.html',
  'play/game/index.html',
];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function fixture(options = {}) {
  const release = {
    schemaVersion: 1,
    commitSha,
    workflow: {
      runId: '91357',
      runAttempt: 2,
    },
    content: {
      contentTreeDigest: contentDigest,
    },
    publication: {
      routes: PUBLIC_ROUTES,
    },
    ...options.release,
  };
  const files = new Map();
  files.set(
    'case-study-release.json',
    Buffer.from(`${JSON.stringify(release)}\n`),
  );
  for (const path of requiredFiles) {
    files.set(
      path,
      Buffer.from(`<!doctype html><title>${path}</title><main>verified</main>\n`),
    );
  }
  files.set(
    'sitemap-0.xml',
    Buffer.from(sitemapXml(options.extraSitemapRoutes)),
  );
  files.set('assets/site.css', Buffer.from('body{color:#171a18}\n'));
  files.set('play/game/assets/audio/cut.mp3', Buffer.from('verified-mp3-bytes'));
  if (options.deletePath) files.delete(options.deletePath);
  if (options.addPath) files.set(options.addPath, Buffer.from('unsafe'));

  const manifest = {
    schemaVersion: 1,
    files: [...files].map(([path, bytes]) => ({
      path,
      bytes: bytes.length,
      sha256: sha256(bytes),
    })),
  };
  if (options.mutateManifest) options.mutateManifest(manifest);
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`);
  return {
    files,
    manifest,
    manifestBytes,
    treeDigest: sha256(manifestBytes),
  };
}

function sitemapXml(extraRoutes = []) {
  const routes = [...REQUIRED_CASE_STUDY_ROUTES, ...(extraRoutes ?? [])];
  const urls = routes
    .map((route) => `<url><loc>https://example.test/pencil-blade-2026${route}</loc></url>`)
    .join('');
  return `<urlset>${urls}</urlset>`;
}

function contentType(path) {
  if (path.endsWith('.html')) return 'text/html; charset=utf-8';
  if (path.endsWith('.json')) return 'application/json; charset=utf-8';
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.mp3')) return 'audio/mpeg';
  if (path.endsWith('.xml')) return 'application/xml; charset=utf-8';
  return 'application/octet-stream';
}

function fakeFetch(input, fixtureState, options = {}) {
  const url = new URL(input);
  const prefix = '/pencil-blade-2026/';
  const path = decodeURIComponent(url.pathname.slice(prefix.length));
  let bytes = path === 'case-study-tree-manifest.json'
    ? fixtureState.manifestBytes
    : fixtureState.files.get(path);
  if (options.corruptPath === path && bytes) {
    bytes = Buffer.from(bytes);
    bytes[0] ^= 0xff;
  }
  if (!bytes) {
    if (options.liveRemovedPath === path) {
      return Promise.resolve(new Response('<!doctype html><title>stale route</title>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }));
    }
    return Promise.resolve(new Response('missing', {
      status: 404,
      headers: { 'content-type': 'text/plain' },
    }));
  }
  const type = options.wrongMimePath === path
    ? 'text/plain'
    : options.mimeByPath?.[path] ?? contentType(path);
  return Promise.resolve(new Response(bytes, {
    status: 200,
    headers: { 'content-type': type },
  }));
}

function smokeOptions(state, overrides = {}) {
  return {
    baseUrl: 'https://dantech0xff.github.io/pencil-blade-2026/',
    expectedCommit: commitSha,
    expectedRunId: '91357',
    expectedRunAttempt: 2,
    expectedContentDigest: contentDigest,
    expectedTreeManifestDigest: state.treeDigest,
    fetchImpl: (url) => fakeFetch(url, state),
    cacheToken: 'test-run',
    filesOnly: true,
    ...overrides,
  };
}

test('production smoke verifies identity, every manifest byte/MIME, and required routes', async () => {
  const state = fixture();
  const report = await smokeProductionPages(smokeOptions(state));
  assert.equal(report.status, 'pass');
  assert.equal(report.filesVerified, state.files.size);
  assert.equal(report.identity.commitSha, commitSha);
  assert.equal(report.identity.contentTreeDigestSha256, contentDigest);
  assert.equal(report.treeManifestDigestSha256, state.treeDigest);
  assert.equal(report.journeys.status, 'not-run-files-only');
});

test('production smoke accepts the GitHub Pages audio/mp3 alias for MP3 assets', async () => {
  const state = fixture();
  const report = await smokeProductionPages(smokeOptions(state, {
    fetchImpl: (url) => fakeFetch(url, state, {
      mimeByPath: {
        'play/game/assets/audio/cut.mp3': 'audio/mp3',
      },
    }),
  }));
  assert.equal(report.status, 'pass');
});

test('production smoke retries bounded transient CDN responses without weakening failures', async () => {
  const state = fixture();
  let transientAttempts = 0;
  const transientFetch = async (url) => {
    const path = decodeURIComponent(new URL(url).pathname)
      .slice('/pencil-blade-2026/'.length);
    if (path === 'assets/site.css' && transientAttempts < 2) {
      transientAttempts += 1;
      return new Response('temporarily unavailable', {
        status: 503,
        headers: { 'content-type': 'text/plain' },
      });
    }
    return fakeFetch(url, state);
  };
  const report = await smokeProductionPages(smokeOptions(state, {
    fetchImpl: transientFetch,
    fetchAttempts: 3,
    fetchRetryDelayMs: 0,
  }));
  assert.equal(report.status, 'pass');
  assert.equal(transientAttempts, 2);

  let persistentAttempts = 0;
  await assert.rejects(
    () => smokeProductionPages(smokeOptions(state, {
      fetchImpl: async (url) => {
        const path = decodeURIComponent(new URL(url).pathname)
          .slice('/pencil-blade-2026/'.length);
        if (path === 'assets/site.css') {
          persistentAttempts += 1;
          return new Response('still unavailable', {
            status: 503,
            headers: { 'content-type': 'text/plain' },
          });
        }
        return fakeFetch(url, state);
      },
      fetchAttempts: 3,
      fetchRetryDelayMs: 0,
    })),
    /assets\/site\.css returned HTTP 503/u,
  );
  assert.equal(persistentAttempts, 3);
});

test('browser routes retry transient HTTP responses and expose persistent failures', async () => {
  const observedDelays = [];
  const disposedStatuses = [];
  const statuses = [503, 429, 200];
  let fetchCount = 0;
  const route = {
    async fetch() {
      const status = statuses[fetchCount];
      fetchCount += 1;
      return {
        status: () => status,
        async dispose() {
          disposedStatuses.push(status);
        },
      };
    },
  };
  const recovered = await fetchBrowserRouteWithRetries(route, {
    attempts: 4,
    retryDelayMs: 10,
    delayImpl: async (delayMs) => observedDelays.push(delayMs),
  });
  assert.equal(recovered.status(), 200);
  assert.equal(fetchCount, 3);
  assert.deepEqual(disposedStatuses, [503, 429]);
  assert.deepEqual(observedDelays, [10, 20]);

  let persistentFetches = 0;
  const persistent = await fetchBrowserRouteWithRetries({
    async fetch() {
      persistentFetches += 1;
      return {
        status: () => 503,
        async dispose() {},
      };
    },
  }, {
    attempts: 3,
    retryDelayMs: 0,
    delayImpl: async () => {},
  });
  assert.equal(persistent.status(), 503);
  assert.equal(persistentFetches, 3);

  let nonTransientFetches = 0;
  const nonTransient = await fetchBrowserRouteWithRetries({
    async fetch() {
      nonTransientFetches += 1;
      return {
        status: () => 404,
      };
    },
  }, {
    attempts: 4,
    retryDelayMs: 0,
    delayImpl: async () => {},
  });
  assert.equal(nonTransient.status(), 404);
  assert.equal(nonTransientFetches, 1);
});

test('production smoke runs an explicit complete browser journey contract', async () => {
  const state = fixture();
  let called = 0;
  const report = await smokeProductionPages(smokeOptions(state, {
    filesOnly: false,
    journeyRunner: async ({ baseUrl, releaseRecord, treeManifest }) => {
      called += 1;
      assert.equal(baseUrl.pathname, '/pencil-blade-2026/');
      assert.equal(releaseRecord.commitSha, commitSha);
      assert.equal(treeManifest.files.length, state.files.size);
      return {
        status: 'pass',
        launcherNoPreload: true,
        launcherActivation: true,
        launcherParentIntegrity: true,
        launcherStoragePreserved: true,
        launcherIframeReload: true,
        launcherIframeRemoval: true,
        embeddedGameViewports: ['480x800', '720x1280'],
        directGameViewports: ['480x800', '720x1280'],
      };
    },
  }));
  assert.equal(called, 1);
  assert.equal(report.journeys.status, 'pass');
});

test('production smoke rejects wrong manifest, file bytes, MIME, missing route, and identity', async () => {
  const state = fixture();
  await assert.rejects(
    () => smokeProductionPages(smokeOptions(state, {
      expectedTreeManifestDigest: 'f'.repeat(64),
    })),
    /tree-manifest bytes/u,
  );
  await assert.rejects(
    () => smokeProductionPages(smokeOptions(state, {
      fetchImpl: (url) => fakeFetch(url, state, {
        corruptPath: 'assets/site.css',
      }),
    })),
    /byte size|SHA-256/u,
  );
  await assert.rejects(
    () => smokeProductionPages(smokeOptions(state, {
      fetchImpl: (url) => fakeFetch(url, state, {
        wrongMimePath: 'assets/site.css',
      }),
    })),
    /unacceptable live MIME/u,
  );

  const missingRoute = fixture({ deletePath: 'vi/forensics/index.html' });
  await assert.rejects(
    () => smokeProductionPages(smokeOptions(missingRoute)),
    /Required production route/u,
  );
  const wrongIdentity = fixture({
    release: {
      workflow: {
        runId: '91358',
        runAttempt: 2,
      },
    },
  });
  await assert.rejects(
    () => smokeProductionPages(smokeOptions(wrongIdentity)),
    /identity does not match/u,
  );
});

test('production smoke rejects removed routes in the manifest and on the live site', async () => {
  const staleManifest = fixture({ addPath: 'story/index.html' });
  await assert.rejects(
    () => smokeProductionPages(smokeOptions(staleManifest)),
    /contains removed public route \/story\//u,
  );

  const staleLiveRoute = fixture();
  await assert.rejects(
    () => smokeProductionPages(smokeOptions(staleLiveRoute, {
      fetchImpl: (url) => fakeFetch(url, staleLiveRoute, {
        liveRemovedPath: 'story/',
      }),
    })),
    /Removed production route is still public.*\/story\//u,
  );
});

test('production smoke rejects arbitrary extra public routes in files and sitemap', async () => {
  const unexpectedManifest = fixture({ addPath: 'unexpected/index.html' });
  await assert.rejects(
    () => smokeProductionPages(smokeOptions(unexpectedManifest)),
    /contains unexpected public HTML route: unexpected\/index\.html/u,
  );

  const nestedGameRoute = fixture({
    addPath: 'play/game/unexpected/index.html',
  });
  await assert.rejects(
    () => smokeProductionPages(smokeOptions(nestedGameRoute)),
    /contains unexpected public HTML route: play\/game\/unexpected\/index\.html/u,
  );

  const htmRoute = fixture({ addPath: 'unexpected.htm' });
  await assert.rejects(
    () => smokeProductionPages(smokeOptions(htmRoute)),
    /contains unexpected public HTML route: unexpected\.htm/u,
  );

  const unexpectedSitemap = fixture({ extraSitemapRoutes: ['/unexpected/'] });
  await assert.rejects(
    () => smokeProductionPages(smokeOptions(unexpectedSitemap)),
    /production sitemap contains unexpected public URL: .*\/unexpected\//u,
  );
});

test('production smoke rejects traversal, duplicate paths, self-inclusion, and incomplete journeys', async () => {
  for (const mutateManifest of [
    (manifest) => manifest.files.push({
      path: '../private.txt',
      bytes: 1,
      sha256: 'a'.repeat(64),
    }),
    (manifest) => manifest.files.push({ ...manifest.files[0] }),
    (manifest) => manifest.files.push({
      path: 'case-study-tree-manifest.json',
      bytes: 1,
      sha256: 'a'.repeat(64),
    }),
  ]) {
    const state = fixture({ mutateManifest });
    await assert.rejects(
      () => smokeProductionPages(smokeOptions(state)),
      /traverses|Duplicate|cannot list itself/u,
    );
  }

  const state = fixture();
  await assert.rejects(
    () => smokeProductionPages(smokeOptions(state, {
      filesOnly: false,
      journeyRunner: async () => ({
        status: 'pass',
        launcherNoPreload: false,
        launcherActivation: true,
        launcherParentIntegrity: true,
        launcherStoragePreserved: true,
        launcherIframeReload: true,
        launcherIframeRemoval: true,
        embeddedGameViewports: ['480x800', '720x1280'],
        directGameViewports: ['480x800', '720x1280'],
      }),
    })),
    /did not pass completely/u,
  );
  await assert.rejects(
    () => smokeProductionPages(smokeOptions(state, {
      filesOnly: false,
      journeyRunner: undefined,
    })),
    /requires explicit browser journeys/u,
  );
});

test('manifest-wide fetch honors bounded concurrency', async () => {
  const state = fixture();
  let active = 0;
  let maximum = 0;
  const fetchImpl = async (url) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    const response = await fakeFetch(url, state);
    active -= 1;
    return response;
  };
  await smokeProductionPages(smokeOptions(state, {
    fetchImpl,
    concurrency: 2,
  }));
  assert.ok(maximum <= 2);
  assert.ok(maximum > 1);
});

test('runner-temp report directories are allowed while roots and existing targets fail closed', () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'case-study-smoke-report-'));
  const reportDirectory = join(temporaryRoot, 'production-smoke');
  assert.equal(safeReportDirectory(reportDirectory), reportDirectory);
  assert.throws(() => safeReportDirectory(temporaryRoot), /must not already exist/u);
  assert.throws(() => safeReportDirectory('/'), /filesystem root/u);
});
