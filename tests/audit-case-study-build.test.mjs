import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { after } from 'node:test';

import { inspectWebBuildDirectory } from '../scripts/audit-web-build.mjs';
import {
  auditCaseStudyBuild,
  treeDigest,
  verifyGameArtifactBinding,
} from '../scripts/audit-case-study-build.mjs';

const testRoot = mkdtempSync(join(tmpdir(), 'pencil-blade-case-study-audit-'));
let fixtureIndex = 0;

after(() => {
  rmSync(testRoot, { force: true, recursive: true });
});

test('composite audit allows documentary terminology and reviewed HTTPS citations', () => {
  const candidate = createCandidate();
  writeFixtureFile(
    candidate,
    'index.html',
    [
      '<!doctype html>',
      '<p>JADX and Ghidra documented libgame.so and Cocos2d-x as historical evidence.</p>',
      '<a href="https://example.org/reviewed-source">Reviewed citation</a>',
      '<a href="/pencil-blade-2026/forensics/">Forensics chapter</a>',
    ].join('\n'),
  );
  writeFixtureFile(candidate, 'forensics/index.html', '<p>Documentary route</p>');

  assert.deepEqual(auditCaseStudyBuild(candidate), []);
});

test('composite audit denies off-origin payloads, unsafe schemes, private paths, and raw artifacts', () => {
  const candidate = createCandidate();
  writeFixtureFile(
    candidate,
    'index.html',
    [
      '<img src="https://cdn.example.invalid/payload.png">',
      '<script src="javascript:alert(1)"></script>',
      '<p>/Users/alice/private/reconstruction.ts</p>',
    ].join('\n'),
  );
  writeFixtureFile(candidate, 'reference/source.apk', Buffer.from([0x50, 0x4b, 0x03, 0x04]));

  const reasons = auditCaseStudyBuild(candidate).map((item) => item.reason);
  assert.ok(reasons.some((reason) => reason.includes('off-origin executable or media')));
  assert.ok(reasons.some((reason) => reason.includes('unsafe URL scheme')));
  assert.ok(reasons.some((reason) => reason.includes('private machine path')));
  assert.ok(reasons.some((reason) => reason.includes('unapproved executable')));
  assert.ok(reasons.some((reason) => reason.includes('raw evidence or development-only path')));
});

test('editorial stylesheet fetches are not mistaken for approved citation anchors', () => {
  const candidate = createCandidate();
  writeFixtureFile(
    candidate,
    'index.html',
    [
      '<a href="https://example.org/source">Citation</a>',
      '<link rel="stylesheet" href="https://example.org/remote.css">',
    ].join('\n'),
  );

  const findings = auditCaseStudyBuild(candidate);
  assert.ok(findings.some((item) => item.reason.includes('remote.css')));
});

test('an approved citation URL cannot authorize another off-origin occurrence', () => {
  const candidate = createCandidate();
  const sharedUrl = 'https://cdn.example.invalid/shared-payload';
  writeFixtureFile(
    candidate,
    'index.html',
    [
      `<a href="${sharedUrl}">Citation</a>`,
      `<script src="${sharedUrl}"></script>`,
      `<img src="${sharedUrl}">`,
      `<link rel="stylesheet" href="${sharedUrl}">`,
    ].join('\n'),
  );

  const findings = auditCaseStudyBuild(candidate)
    .filter((item) => item.reason.includes(sharedUrl));
  assert.equal(findings.length, 3);
  assert.ok(findings.every((item) =>
    item.reason.includes('off-origin executable or media')));
});

test('metadata link relations cannot smuggle an off-origin stylesheet relation', () => {
  const candidate = createCandidate();
  writeFixtureFile(
    candidate,
    'index.html',
    [
      '<link rel="alternate stylesheet" href="https://cdn.example.invalid/alternate.css">',
      '<link rel="canonical stylesheet" href="https://cdn.example.invalid/canonical.css">',
    ].join('\n'),
  );

  const reasons = auditCaseStudyBuild(candidate).map((item) => item.reason);
  assert.ok(reasons.some((reason) => reason.includes('alternate.css')));
  assert.ok(reasons.some((reason) => reason.includes('canonical.css')));
});

test('candidate symlinks fail while the game audit remains scoped to play/game', () => {
  const candidate = createCandidate();
  const outside = join(testRoot, 'outside.txt');
  writeFileSync(outside, 'outside');
  symlinkSync(outside, join(candidate, 'linked.txt'));

  const findings = auditCaseStudyBuild(candidate);
  assert.ok(findings.some((item) => (
    item.path === 'linked.txt'
    && item.reason === 'symbolic links are prohibited in a candidate'
  )));
  assert.ok(!findings.some((item) => (
    item.path === 'index.html'
    && item.reason.includes('decompiler')
  )));
});

test('raw game build is bound to publication evidence, bilingual facts, and the exact mount', () => {
  const gameDist = createValidGame();
  const publication = publicationFor(gameDist);
  const provenance = publication.media[0].provenance;
  const playFacts = {
    h5Tree: publication.media[0],
    en: { ...provenance, gameUrl: '/pencil-blade-2026/play/game/' },
    vi: { ...provenance, gameUrl: '/pencil-blade-2026/play/game/' },
  };

  const result = verifyGameArtifactBinding({
    evidenceSnapshot: publication,
    gameDist,
    playFacts,
  });
  assert.equal(result.files, provenance.files);
  assert.equal(result.bytes, provenance.bytes);
  assert.equal(result.treeDigestSha256, provenance.treeDigestSha256);
  assert.equal(result.mount, '/pencil-blade-2026/play/game/');

  assert.throws(
    () => verifyGameArtifactBinding({
      evidenceSnapshot: publication,
      gameDist,
      playFacts: {
        ...playFacts,
        vi: { ...playFacts.vi, gameUrl: '/pencil-blade-2026/play/h5/' },
      },
    }),
    /gameUrl mismatch/u,
  );
  assert.throws(
    () => verifyGameArtifactBinding({
      evidenceSnapshot: {
        ...publication,
        media: [{
          ...publication.media[0],
          provenance: { ...provenance, bytes: provenance.bytes + 1 },
        }],
      },
      gameDist,
      playFacts,
    }),
    /publication evidence bytes mismatch/u,
  );
});

function createCandidate() {
  fixtureIndex += 1;
  const candidate = join(testRoot, `candidate-${fixtureIndex}`);
  writeFixtureFile(candidate, 'index.html', '<!doctype html><p>Case study</p>');
  const game = createValidGame();
  copyGameFixture(game, join(candidate, 'play/game'));
  return candidate;
}

function createValidGame() {
  fixtureIndex += 1;
  const buildRoot = join(testRoot, `game-${fixtureIndex}`);
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
  return buildRoot;
}

function publicationFor(gameDist) {
  const audit = inspectWebBuildDirectory(gameDist);
  assert.deepEqual(audit.findings, []);
  return {
    repository: { pagesBase: '/pencil-blade-2026/' },
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

function copyGameFixture(source, destination) {
  const audit = inspectWebBuildDirectory(source);
  for (const file of audit.files) {
    writeFixtureFile(destination, file.path, readFileSync(file.absolutePath));
  }
}
