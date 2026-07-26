import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { validateWorkflowTrust } from '../site/scripts/validate-workflow-trust.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflowPath = resolve(
  projectRoot,
  '.github/workflows/test-case-study-site.yml',
);
const workflowSource = readFileSync(workflowPath, 'utf8');
const requireFromSite = createRequire(resolve(projectRoot, 'site/package.json'));
const { parse } = requireFromSite('yaml');
const workflow = parse(workflowSource);

test('site workflow is PR/push-only with explicit read permission', () => {
  assert.deepEqual(workflow.on, {
    pull_request: null,
    push: {
      branches: ['main'],
    },
  });
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(Object.keys(workflow.jobs), ['site-checks']);
  assert.equal(workflow.concurrency['cancel-in-progress'], true);
  assert.doesNotMatch(workflowSource, /pull_request_target|workflow_dispatch|workflow_call/u);
});

test('PR-reachable work stays on one exact GitHub-hosted Linux runner', () => {
  const job = workflow.jobs['site-checks'];
  assert.equal(job['runs-on'], 'ubuntu-24.04');
  assert.ok(Number.isInteger(job['timeout-minutes']) && job['timeout-minutes'] > 0);
  assert.equal(job.uses, undefined);
  assert.doesNotMatch(
    workflowSource,
    /self-hosted|cocos-creator|CocosCreator|COCOS_CREATOR|runs-on:\s*\$\{\{|matrix\./iu,
  );
});

test('workflow uses exact Node/npm and installs only the locked site package', () => {
  assert.match(workflowSource, /node-version-file: \.node-version/u);
  assert.match(
    workflowSource,
    /name: Install exact npm[\s\S]*npm install --global npm@11\.6\.2 --ignore-scripts --no-audit --no-fund[\s\S]*name: Verify exact Node and npm/u,
  );
  assert.match(workflowSource, /test "\$\(node --version\)" = "v24\.18\.0"/u);
  assert.match(workflowSource, /test "\$\(npm --version\)" = "11\.6\.2"/u);
  assert.match(
    workflowSource,
    /name: Install locked site dependencies[\s\S]*working-directory: site[\s\S]*npm ci --ignore-scripts --no-audit --no-fund/u,
  );
  assert.match(
    workflowSource,
    /npx --no-install playwright install --with-deps chromium/u,
  );
  assert.doesNotMatch(
    workflowSource,
    /working-directory: game|game\/package-lock\.json|run-game-release-tests\.mjs/u,
  );
});

test('workflow validates trust, publication, content, build, unit, and browser gates', () => {
  for (const expectedCommand of [
    'site/scripts/validate-workflow-trust.mjs',
    'scripts/validate-case-study-publication.mjs',
    'npm --prefix site run prepare:data',
    'npm --prefix site run validate:content',
    'npm --prefix site run check',
    'node --test',
    'npm run build',
    'npm run test:browser',
  ]) {
    assert.ok(workflowSource.includes(expectedCommand), `missing ${expectedCommand}`);
  }
  assert.match(
    workflowSource,
    /validate-workflow-trust\.mjs[\s\S]*test-case-study-site\.yml[\s\S]*deploy-web-mobile-pages\.yml/u,
  );
});

test('every action is a reviewed full commit SHA with a human tag comment', () => {
  const uses = workflow.jobs['site-checks'].steps
    .map((step) => step.uses)
    .filter(Boolean);
  assert.deepEqual(uses, [
    'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
    'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020',
  ]);
  assert.match(
    workflowSource,
    /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7\.0\.1/u,
  );
  assert.match(
    workflowSource,
    /actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7\.0\.0/u,
  );
});

test('recursive parser independently proves the PR graph has no trust escape', () => {
  const report = validateWorkflowTrust(workflowPath);
  assert.deepEqual(report.workflows, ['.github/workflows/test-case-study-site.yml']);
  assert.deepEqual(report.actions, []);
});
