import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflow = readFileSync(
  resolve(projectRoot, '.github/workflows/deploy-web-mobile-pages.yml'),
  'utf8',
);

test('Pages workflow is manual-only and restricted to main', () => {
  assert.match(workflow, /^on:\n  workflow_dispatch:\s*$/mu);
  assert.doesNotMatch(workflow, /^\s+(?:pull_request|pull_request_target|push):/mu);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /test "\$GITHUB_REF" = "refs\/heads\/main"/u);
});

test('untrusted code never targets the pinned Creator runner', () => {
  assert.match(workflow, /- self-hosted/u);
  assert.match(workflow, /- macOS/u);
  assert.match(workflow, /- ARM64/u);
  assert.match(workflow, /- cocos-creator-3\.8\.8/u);
  assert.match(workflow, /Cocos\/Creator\/3\.8\.8\/CocosCreator\.app/u);
  assert.match(
    workflow,
    /plutil[\s\S]*?-extract CFBundleShortVersionString[\s\S]*?Contents\/Info\.plist/u,
  );
  assert.doesNotMatch(workflow, /defaults read/u);
  assert.match(
    workflow,
    /COCOS_CREATOR_BIN_SHA256: 3a8452496c03e85f2784e64679a1fd203701b0b245125efee02c7923f2bd3464/u,
  );
  assert.match(workflow, /shasum -a 256 "\$COCOS_CREATOR_BIN"/u);
  assert.doesNotMatch(workflow, /codesign --verify --deep --strict/u);
});

test('build and deploy jobs use least privilege and bounded execution', () => {
  assert.match(workflow, /^permissions: \{\}$/mu);
  assert.match(workflow, /build-web-mobile:[\s\S]*?permissions:\n      contents: read/u);
  assert.match(
    workflow,
    /deploy:[\s\S]*?permissions:\n      pages: write\n      id-token: write/u,
  );
  assert.match(workflow, /timeout-minutes: 60/u);
  assert.match(workflow, /timeout-minutes: 15/u);
  assert.match(workflow, /cancel-in-progress: false/u);
  assert.match(workflow, /deploy:[\s\S]*?needs: build-web-mobile/u);
  assert.match(workflow, /node --test --test-concurrency=1 tests\/\*\.mjs/u);
});

test('locked dependencies precede Creator build and every gate precedes artifact upload', () => {
  const dependencyInstall = workflow.indexOf('npm ci --ignore-scripts --no-audit --no-fund');
  const iterableSpreadAudit = workflow.indexOf('audit-creator-iterable-spreads.mjs');
  const creatorBuild = workflow.indexOf('--build "stage=build;configPath=');
  const audit = workflow.indexOf('audit-web-build.mjs');
  const prefix = workflow.indexOf('verify-web-mobile-build.mjs');
  const upload = workflow.indexOf('actions/upload-pages-artifact@v4');
  const deploy = workflow.indexOf('actions/deploy-pages@v4');

  assert.match(
    workflow,
    /name: Install locked project dependencies[\s\S]*?working-directory: game/u,
  );
  assert.ok(dependencyInstall >= 0 && dependencyInstall < creatorBuild);
  assert.ok(creatorBuild >= 0 && creatorBuild < iterableSpreadAudit);
  assert.equal(workflow.indexOf('verify-release-rights.mjs'), -1);
  assert.ok(creatorBuild < audit);
  assert.ok(audit < prefix);
  assert.ok(prefix < upload);
  assert.ok(upload < deploy);
});

test('workflow publishes the complete ignored Web Mobile output with current Pages actions', () => {
  assert.match(workflow, /actions\/checkout@v6/u);
  assert.match(workflow, /actions\/configure-pages@v5/u);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/u);
  assert.match(workflow, /actions\/deploy-pages@v4/u);
  assert.match(workflow, /path: game\/build\/web-mobile-pages/u);
  assert.match(workflow, /platform=web-mobile|web-mobile-pages\.json/u);
  assert.match(workflow, /case "\$creator_status" in[\s\S]*?36\)/u);
});
