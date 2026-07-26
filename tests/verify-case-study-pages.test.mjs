import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { after } from 'node:test';

import { inspectWebBuildDirectory } from '../scripts/audit-web-build.mjs';
import { treeDigest } from '../scripts/audit-case-study-build.mjs';
import { composeCaseStudyPages } from '../scripts/compose-case-study-pages.mjs';
import {
  REQUIRED_CASE_STUDY_ROUTES,
  verifyCaseStudyPages,
} from '../scripts/verify-case-study-pages.mjs';

const testRoot = mkdtempSync(join(tmpdir(), 'pencil-blade-case-study-verify-'));
let fixtureIndex = 0;

after(() => {
  rmSync(testRoot, { force: true, recursive: true });
});

test('verifier checks the exact bilingual route set, references, nested game, and publication binding', async () => {
  const fixture = createComposedCandidate();
  const result = await verifyCaseStudyPages(fixture.candidate, {
    publicationManifest: fixture.publication,
  });

  assert.equal(result.pagesPrefix, '/pencil-blade-2026/');
  assert.equal(result.binding.mount, '/pencil-blade-2026/play/game/');
  assert.equal(result.binding.treeDigestSha256, fixture.provenance.treeDigestSha256);
  assert.ok(result.checkedRoutes.includes('/pencil-blade-2026/play/'));
  assert.ok(result.checkedRoutes.includes('/pencil-blade-2026/vi/play/'));
  assert.ok(result.checkedRoutes.includes('/pencil-blade-2026/play/game/'));
  assert.ok(result.discoveredReferences.some((item) => item.path === 'site.css'));
  assert.equal(result.game.prefix, '/pencil-blade-2026/play/game/');
});

test('missing required bilingual launch and chapter routes fail closed', async () => {
  const fixture = createComposedCandidate();
  rmSync(join(fixture.candidate, 'vi/play/index.html'));
  await assert.rejects(
    verifyCaseStudyPages(fixture.candidate, {
      publicationManifest: fixture.publication,
    }),
    /required bilingual case-study route is missing: \/vi\/play\//u,
  );
});

test('removed routes fail verification in files, sitemap, and release metadata', async (t) => {
  await t.test('candidate file', async () => {
    const fixture = createComposedCandidate();
    writeFixtureFile(fixture.candidate, 'story/index.html', '<p>stale story</p>');
    await assert.rejects(
      verifyCaseStudyPages(fixture.candidate, {
        publicationManifest: fixture.publication,
      }),
      /contains removed public route \/story\//u,
    );
  });

  await t.test('sitemap URL', async () => {
    const fixture = createComposedCandidate();
    writeFixtureFile(
      fixture.candidate,
      'sitemap-0.xml',
      '<urlset><url><loc>https://example.test/pencil-blade-2026/vi/story/</loc></url></urlset>',
    );
    await assert.rejects(
      verifyCaseStudyPages(fixture.candidate, {
        publicationManifest: fixture.publication,
      }),
      /sitemap contains removed public route \/story\//u,
    );
  });

  await t.test('release route set', async () => {
    const fixture = createComposedCandidate();
    writeFixtureFile(
      fixture.candidate,
      'case-study-release.json',
      JSON.stringify({ publication: { routes: ['/story/'] } }),
    );
    await assert.rejects(
      verifyCaseStudyPages(fixture.candidate, {
        publicationManifest: fixture.publication,
      }),
      /release manifest has an unexpected public route set/u,
    );
  });
});

test('arbitrary extra routes fail verification in files and sitemap', async (t) => {
  await t.test('candidate file', async () => {
    const fixture = createComposedCandidate();
    writeFixtureFile(fixture.candidate, 'unexpected/index.html', '<p>unexpected</p>');
    await assert.rejects(
      verifyCaseStudyPages(fixture.candidate, {
        publicationManifest: fixture.publication,
      }),
      /contains unexpected public HTML route: unexpected\/index\.html/u,
    );
  });

  await t.test('nested game HTML', async () => {
    const fixture = createComposedCandidate();
    writeFixtureFile(
      fixture.candidate,
      'play/game/unexpected/index.html',
      '<p>unexpected</p>',
    );
    await assert.rejects(
      verifyCaseStudyPages(fixture.candidate, {
        publicationManifest: fixture.publication,
      }),
      /contains unexpected public HTML route: play\/game\/unexpected\/index\.html/u,
    );
  });

  await t.test('HTM file', async () => {
    const fixture = createComposedCandidate();
    writeFixtureFile(fixture.candidate, 'unexpected.htm', '<p>unexpected</p>');
    await assert.rejects(
      verifyCaseStudyPages(fixture.candidate, {
        publicationManifest: fixture.publication,
      }),
      /contains unexpected public HTML route: unexpected\.htm/u,
    );
  });

  await t.test('sitemap URL', async () => {
    const fixture = createComposedCandidate();
    writeFixtureFile(
      fixture.candidate,
      'sitemap-0.xml',
      sitemapXml(['/unexpected/']),
    );
    await assert.rejects(
      verifyCaseStudyPages(fixture.candidate, {
        publicationManifest: fixture.publication,
      }),
      /sitemap contains unexpected public URL: .*\/unexpected\//u,
    );
  });
});

test('base bypasses and missing local references are rejected', async (t) => {
  await t.test('base bypass', async () => {
    const fixture = createComposedCandidate();
    const indexPath = join(fixture.candidate, 'index.html');
    writeFileSync(
      indexPath,
      readFileSync(indexPath, 'utf8').replace(
        '/pencil-blade-2026/site.css',
        '/outside/site.css',
      ),
    );
    await assert.rejects(
      verifyCaseStudyPages(fixture.candidate, {
        publicationManifest: fixture.publication,
      }),
      /bypasses \/pencil-blade-2026\//u,
    );
  });

  await t.test('missing reference', async () => {
    const fixture = createComposedCandidate();
    const indexPath = join(fixture.candidate, 'index.html');
    writeFileSync(
      indexPath,
      readFileSync(indexPath, 'utf8').replace(
        '/pencil-blade-2026/site.css',
        '/pencil-blade-2026/missing.css',
      ),
    );
    await assert.rejects(
      verifyCaseStudyPages(fixture.candidate, {
        publicationManifest: fixture.publication,
      }),
      /references missing candidate file missing\.css/u,
    );
  });
});

test('launcher must keep game requests behind the explicit click boundary', async (t) => {
  await t.test('eager iframe', async () => {
    const fixture = createComposedCandidate();
    const launchPath = join(fixture.candidate, 'play/index.html');
    writeFileSync(
      launchPath,
      readFileSync(launchPath, 'utf8').replace(
        '<section data-play-launcher',
        '<iframe src="/pencil-blade-2026/play/game/"></iframe><section data-play-launcher',
      ),
    );
    await assert.rejects(
      verifyCaseStudyPages(fixture.candidate, {
        publicationManifest: fixture.publication,
      }),
      /eagerly embeds the game iframe/u,
    );
  });

  await t.test('missing lazy controller', async () => {
    const fixture = createComposedCandidate();
    const launchPath = join(fixture.candidate, 'launcher.js');
    writeFileSync(
      launchPath,
      readFileSync(launchPath, 'utf8').replace('createElement("iframe")', 'void 0'),
    );
    await assert.rejects(
      verifyCaseStudyPages(fixture.candidate, {
        publicationManifest: fixture.publication,
      }),
      /does not preserve the click-to-create iframe boundary/u,
    );
  });

  await t.test('game prefetch', async () => {
    const fixture = createComposedCandidate();
    const launchPath = join(fixture.candidate, 'play/index.html');
    writeFileSync(
      launchPath,
      readFileSync(launchPath, 'utf8').replace(
        '</head>',
        '<link rel="prefetch" href="/pencil-blade-2026/play/game/index.js"></head>',
      ),
    );
    await assert.rejects(
      verifyCaseStudyPages(fixture.candidate, {
        publicationManifest: fixture.publication,
      }),
      /eagerly requests game payload bytes/u,
    );
  });

  await t.test('inline executable controller', async () => {
    const fixture = createComposedCandidate();
    const launchPath = join(fixture.candidate, 'play/index.html');
    writeFileSync(
      launchPath,
      readFileSync(launchPath, 'utf8').replace(
        '<script type="module" src="/pencil-blade-2026/launcher.js"></script>',
        '<script>document.body.dataset.controller = "inline";</script>',
      ),
    );
    await assert.rejects(
      verifyCaseStudyPages(fixture.candidate, {
        publicationManifest: fixture.publication,
      }),
      /executable inline script blocked by editorial CSP/u,
    );
  });
});

test('unsupported MIME mappings and publication drift fail verification', async (t) => {
  await t.test('MIME', async () => {
    const fixture = createComposedCandidate();
    writeFixtureFile(fixture.candidate, 'payload.unsupported', 'bytes');
    await assert.rejects(
      verifyCaseStudyPages(fixture.candidate, {
        publicationManifest: fixture.publication,
      }),
      /has no acceptable static MIME mapping/u,
    );
  });

  await t.test('publication binding', async () => {
    const fixture = createComposedCandidate();
    const publication = structuredClone(fixture.publication);
    publication.media[0].provenance.files += 1;
    await assert.rejects(
      verifyCaseStudyPages(fixture.candidate, { publicationManifest: publication }),
      /publication evidence files mismatch/u,
    );
  });
});

test('non-canonical Pages prefixes are rejected', async () => {
  const fixture = createComposedCandidate();
  await assert.rejects(
    verifyCaseStudyPages(fixture.candidate, {
      pagesPrefix: '/other-project/',
      publicationManifest: fixture.publication,
    }),
    /must use exact Pages prefix/u,
  );
});

function createComposedCandidate() {
  fixtureIndex += 1;
  const root = join(testRoot, `fixture-${fixtureIndex}`);
  const siteDist = join(root, 'site');
  const gameDist = join(root, 'game');
  createValidGame(gameDist);
  const publication = publicationFor(gameDist);
  const provenance = publication.media[0].provenance;
  createSite(siteDist, provenance);
  const candidate = join(root, 'candidate');
  composeCaseStudyPages({ candidate, gameDist, outDir: candidate, siteDist });
  return { candidate, gameDist, provenance, publication, siteDist };
}

function createSite(siteDist, provenance) {
  for (const route of REQUIRED_CASE_STUDY_ROUTES) {
    const path = route === '/'
      ? 'index.html'
      : `${route.split('/').filter(Boolean).join('/')}/index.html`;
    const locale = route.startsWith('/vi/') || route === '/vi/' ? 'vi' : 'en';
    const source = route === '/play/' || route === '/vi/play/'
      ? launchPage(locale, provenance)
      : [
        '<!doctype html>',
        `<html lang="${locale}"><head>`,
        '<link rel="stylesheet" href="/pencil-blade-2026/site.css">',
        '</head><body>',
        '<a href="/pencil-blade-2026/forensics/">Forensics</a>',
        '<a href="https://example.org/citation">Citation</a>',
        '</body></html>',
      ].join('');
    writeFixtureFile(siteDist, path, source);
  }
  writeFixtureFile(siteDist, 'site.css', 'body { color: #111; }');
  writeFixtureFile(siteDist, 'sitemap-0.xml', sitemapXml());
  writeFixtureFile(
    siteDist,
    'launcher.js',
    [
      'document.querySelector("[data-play-load]").addEventListener("click", () => {',
      '  const gameUrl = "/pencil-blade-2026/play/game/";',
      '  const frame = document.createElement("iframe");',
      '  frame.src = gameUrl;',
      '});',
    ].join(''),
  );
}

function sitemapXml(extraRoutes = []) {
  const routes = [...REQUIRED_CASE_STUDY_ROUTES, ...extraRoutes];
  const urls = routes
    .map((route) => `<url><loc>https://example.test/pencil-blade-2026${route}</loc></url>`)
    .join('');
  return `<urlset>${urls}</urlset>`;
}

function launchPage(locale, provenance) {
  return [
    '<!doctype html>',
    `<html lang="${locale}"><head>`,
    '<link rel="stylesheet" href="/pencil-blade-2026/site.css">',
    '</head><body>',
    `<p>${provenance.files.toLocaleString('en-US')} files · `
      + `${provenance.bytes.toLocaleString('en-US')} bytes</p>`,
    `<code>${provenance.treeDigestSha256}</code>`,
    '<section data-play-launcher data-game-url="/pencil-blade-2026/play/game/">',
    '<button data-play-load>Load</button>',
    '<a data-play-direct href="/pencil-blade-2026/play/game/">Direct</a>',
    '</section>',
    '<script type="module" src="/pencil-blade-2026/launcher.js"></script>',
    '</body></html>',
  ].join('');
}

function createValidGame(buildRoot) {
  writeFixtureFile(
    buildRoot,
    'index.html',
    '<link rel="stylesheet" href="./style.css"><script src="./index.js"></script>',
  );
  writeFixtureFile(
    buildRoot,
    'style.css',
    '@font-face { src: url("./assets/game/fonts/linds.woff2"); }',
  );
  writeFixtureFile(
    buildRoot,
    'index.js',
    'System.register(["./application.js"], function () { return {}; });',
  );
  writeFixtureFile(
    buildRoot,
    'application.js',
    'const settingsPath = "src/settings.json";',
  );
  writeFixtureFile(
    buildRoot,
    'src/settings.json',
    JSON.stringify({ scripting: { scriptPackages: ['../src/chunks/bundle.js'] } }),
  );
  writeFixtureFile(
    buildRoot,
    'src/chunks/bundle.js',
    'System.register("chunks:///_virtual/box2d.umd.js", [], function () {});',
  );
  writeFixtureFile(buildRoot, 'cocos-js/cc.js', 'System.register([], function () {});');
  writeFixtureFile(buildRoot, 'assets/game/config.json', '{"name":"game"}');
  writeFixtureFile(buildRoot, 'assets/game/index.js', 'export const game = true;');
  writeFixtureFile(buildRoot, 'assets/game/fonts/linds.woff2', Buffer.from('wOF2fixture'));
}

function publicationFor(gameDist) {
  const audit = inspectWebBuildDirectory(gameDist);
  assert.deepEqual(audit.findings, []);
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
        bytes: audit.totalBytes,
        files: audit.files.length,
        treeDigestSha256: treeDigest(audit.files),
      },
    }],
  };
}

function writeFixtureFile(root, path, contents) {
  const destination = join(root, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}
