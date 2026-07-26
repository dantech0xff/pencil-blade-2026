import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { after } from 'node:test';

import { composeCaseStudyPages } from '../scripts/compose-case-study-pages.mjs';
import {
  REQUIRED_CASE_STUDY_ROUTES,
} from '../scripts/case-study-public-routes.mjs';
import {
  collectCandidateFiles,
  digestFileRecords,
  generateCaseStudyReleaseManifest,
  RELEASE_MANIFEST_PATH,
  TREE_MANIFEST_PATH,
  verifyCaseStudyReleaseManifest,
} from '../scripts/generate-case-study-release-manifest.mjs';
import { serveCaseStudyCandidate } from '../scripts/serve-case-study-candidate.mjs';

const testRoot = mkdtempSync(join(tmpdir(), 'pencil-blade-case-study-release-'));
let fixtureIndex = 0;
const COMMIT_SHA = '0123456789abcdef0123456789abcdef01234567';
const TOOLCHAIN = Object.freeze({
  path: 'reference/case-study-build-toolchain.json',
  record: {
    schemaVersion: 1,
    node: '24.1.0',
    creator: '3.8.8',
  },
});

after(() => {
  rmSync(testRoot, { force: true, recursive: true });
});

test('release generation self-excludes metadata and binds release bytes into the tree manifest', () => {
  const fixture = createFixture();
  const result = generate(fixture);
  const verified = verifyCaseStudyReleaseManifest(fixture.candidate);
  const release = JSON.parse(readFileSync(result.releaseManifestPath, 'utf8'));
  const tree = JSON.parse(readFileSync(result.treeManifestPath, 'utf8'));

  assert.equal(release.commitSha, COMMIT_SHA);
  assert.deepEqual(release.workflow, { runAttempt: 2, runId: '123456789' });
  assert.equal(release.content.contentTreeDigest, result.contentTreeDigest);
  assert.deepEqual(release.content.excludes, [
    RELEASE_MANIFEST_PATH,
    TREE_MANIFEST_PATH,
  ]);
  assert.ok(!tree.files.some((file) => file.path === TREE_MANIFEST_PATH));
  assert.ok(tree.files.some((file) => file.path === RELEASE_MANIFEST_PATH));
  assert.equal(tree.releaseRecord.path, RELEASE_MANIFEST_PATH);
  assert.equal(tree.releaseRecord.sha256, result.releaseRecordSha256);
  assert.equal(verified.treeManifestSha256, result.treeManifestSha256);
  assert.equal(verified.contentTreeDigest, result.contentTreeDigest);
});

test('identical inputs and provenance produce byte-identical deterministic manifests', () => {
  const first = createFixture();
  const second = createFixture();
  const firstResult = generate(first);
  const secondResult = generate(second);

  assert.equal(firstResult.contentTreeDigest, secondResult.contentTreeDigest);
  assert.equal(firstResult.treeManifestSha256, secondResult.treeManifestSha256);
  assert.deepEqual(
    readFileSync(firstResult.releaseManifestPath),
    readFileSync(secondResult.releaseManifestPath),
  );
  assert.deepEqual(
    readFileSync(firstResult.treeManifestPath),
    readFileSync(secondResult.treeManifestPath),
  );
});

test('content mutation invalidates frozen metadata and cannot be disguised as the original inputs', () => {
  const fixture = createFixture();
  const original = generate(fixture);
  writeFileSync(join(fixture.candidate, 'index.html'), '<p>mutated candidate</p>');

  assert.throws(
    () => verifyCaseStudyReleaseManifest(fixture.candidate),
    /does not match candidate bytes/u,
  );
  assert.throws(
    () => generate(fixture),
    /candidate bytes differ from composed inputs/u,
  );

  writeFileSync(join(fixture.siteDist, 'index.html'), '<p>mutated candidate</p>');
  const regenerated = generate(fixture);
  assert.notEqual(regenerated.contentTreeDigest, original.contentTreeDigest);
  assert.equal(
    verifyCaseStudyReleaseManifest(fixture.candidate).contentTreeDigest,
    regenerated.contentTreeDigest,
  );
});

test('commit, workflow run, toolchain, and publication bindings fail closed', () => {
  const fixture = createFixture();
  assert.throws(
    () => generate(fixture, { commitSha: 'main' }),
    /commitSha is invalid/u,
  );
  assert.throws(
    () => generate(fixture, { runId: '0' }),
    /runId is invalid/u,
  );
  assert.throws(
    () => generate(fixture, { runAttempt: 0 }),
    /runAttempt must be a positive/u,
  );
  assert.throws(
    () => generate(fixture, { toolchain: undefined }),
    /toolchain must be a JSON/u,
  );

  const drifted = structuredClone(fixture.publication);
  drifted.media[0].provenance.bytes += 1;
  assert.throws(
    () => generate(fixture, { publicationManifest: drifted }),
    /does not match publication evidence/u,
  );
});

test('release generation rejects missing, forbidden, unexpected, and stale routes', () => {
  const missing = createFixture();
  rmSync(join(missing.candidate, 'forensics/index.html'));
  assert.throws(
    () => generate(missing),
    /missing required public route \/forensics\//u,
  );

  const forbidden = createFixture();
  writeFixtureFile(forbidden.candidate, 'story/index.html', '<p>stale story</p>');
  assert.throws(
    () => generate(forbidden),
    /contains removed public route \/story\//u,
  );

  const unexpected = createFixture();
  writeFixtureFile(unexpected.candidate, 'unexpected/index.html', '<p>unexpected</p>');
  assert.throws(
    () => generate(unexpected),
    /contains unexpected public HTML route: unexpected\/index\.html/u,
  );

  const nestedGameRoute = createFixture();
  writeFixtureFile(
    nestedGameRoute.candidate,
    'play/game/unexpected/index.html',
    '<p>unexpected</p>',
  );
  assert.throws(
    () => generate(nestedGameRoute),
    /contains unexpected public HTML route: play\/game\/unexpected\/index\.html/u,
  );

  const htmRoute = createFixture();
  writeFixtureFile(htmRoute.candidate, 'unexpected.htm', '<p>unexpected</p>');
  assert.throws(
    () => generate(htmRoute),
    /contains unexpected public HTML route: unexpected\.htm/u,
  );

  const staleSitemap = createFixture();
  writeFixtureFile(
    staleSitemap.candidate,
    'sitemap-0.xml',
    '<urlset><url><loc>https://example.test/pencil-blade-2026/vi/story/</loc></url></urlset>',
  );
  assert.throws(
    () => generate(staleSitemap),
    /sitemap contains removed public route \/story\//u,
  );

  const unexpectedSitemap = createFixture();
  writeFixtureFile(
    unexpectedSitemap.candidate,
    'sitemap-0.xml',
    sitemapXml(['/unexpected/']),
  );
  assert.throws(
    () => generate(unexpectedSitemap),
    /sitemap contains unexpected public URL: .*\/unexpected\//u,
  );
});

test('candidate server exposes only immutable GET/HEAD bytes at the exact prefix', async () => {
  const fixture = createFixture();
  generate(fixture);
  const running = await serveCaseStudyCandidate(fixture.candidate);
  try {
    assert.equal((await responseFor(running.port, '/')).statusCode, 404);
    assert.equal(
      (await responseFor(running.port, '/pencil-blade-2026')).statusCode,
      404,
    );
    const root = await responseFor(running.port, '/pencil-blade-2026/');
    assert.equal(root.statusCode, 200);
    assert.match(root.contentType, /^text\/html/u);
    assert.equal(
      (await responseFor(running.port, '/pencil-blade-2026/play/')).statusCode,
      200,
    );
    assert.equal(
      (await responseFor(
        running.port,
        '/pencil-blade-2026/%2e%2e/index.html',
      )).statusCode,
      404,
    );
    assert.equal(
      (await responseFor(running.port, '/pencil-blade-2026/', 'POST')).statusCode,
      405,
    );

    writeFileSync(join(fixture.candidate, 'index.html'), '<p>changed after audit</p>');
    assert.equal(
      (await responseFor(running.port, '/pencil-blade-2026/')).statusCode,
      404,
    );
  } finally {
    await running.close();
  }
});

function createFixture() {
  fixtureIndex += 1;
  const root = join(testRoot, `fixture-${fixtureIndex}`);
  const siteDist = join(root, 'site');
  const gameDist = join(root, 'game');
  for (const path of [
    'index.html',
    'forensics/index.html',
    'play/index.html',
    'vi/index.html',
    'vi/forensics/index.html',
    'vi/play/index.html',
  ]) {
    writeFixtureFile(siteDist, path, `<p>${path}</p>`);
  }
  writeFixtureFile(siteDist, 'assets/site.css', 'body { color: black; }');
  writeFixtureFile(siteDist, 'sitemap-0.xml', sitemapXml());
  writeFixtureFile(gameDist, 'index.html', '<canvas></canvas>');
  writeFixtureFile(gameDist, 'assets/game.bin', Buffer.from([0, 1, 2, 3]));
  const publication = publicationFor(gameDist);
  const candidate = join(root, 'candidate');
  composeCaseStudyPages({ gameDist, outDir: candidate, siteDist });
  return { candidate, gameDist, publication, siteDist };
}

function sitemapXml(extraRoutes = []) {
  const routes = [...REQUIRED_CASE_STUDY_ROUTES, ...extraRoutes];
  const urls = routes
    .map((route) => `<url><loc>https://example.test/pencil-blade-2026${route}</loc></url>`)
    .join('');
  return `<urlset>${urls}</urlset>`;
}

function publicationFor(gameDist) {
  const gameFiles = collectCandidateFiles(gameDist, { label: 'game fixture' });
  return {
    schemaVersion: 1,
    manifestId: 'test-publication',
    manifestVersion: '1.0.0',
    repository: { pagesBase: '/pencil-blade-2026/' },
    supportedLocales: ['en', 'vi'],
    restorationEvidenceSnapshot: { snapshotId: 'test-snapshot' },
    media: [{
      mediaId: 'MEDIA-H5-AUDITED-TREE',
      academicDisplayDecisionRef: 'reference/case-study-academic-display-decision.json',
      provenance: {
        bytes: gameFiles.reduce((sum, file) => sum + file.bytes, 0),
        files: gameFiles.length,
        treeDigestSha256: digestFileRecords(gameFiles),
      },
    }],
  };
}

function generate(fixture, overrides = {}) {
  return generateCaseStudyReleaseManifest({
    candidateDir: fixture.candidate,
    commitSha: COMMIT_SHA,
    gameDist: fixture.gameDist,
    publicationManifest: fixture.publication,
    runAttempt: 2,
    runId: '123456789',
    siteDist: fixture.siteDist,
    toolchain: TOOLCHAIN,
    ...overrides,
  });
}

function writeFixtureFile(root, path, contents) {
  const destination = join(root, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}

function responseFor(port, path, method = 'GET') {
  return new Promise((resolveResponse, rejectResponse) => {
    const outgoing = request({
      agent: false,
      host: '127.0.0.1',
      method,
      path,
      port,
    }, (incoming) => {
      const chunks = [];
      incoming.on('data', (chunk) => chunks.push(chunk));
      incoming.on('end', () => resolveResponse({
        body: Buffer.concat(chunks),
        contentType: incoming.headers['content-type'] ?? '',
        statusCode: incoming.statusCode ?? 0,
      }));
    });
    outgoing.on('error', rejectResponse);
    outgoing.end();
  });
}
