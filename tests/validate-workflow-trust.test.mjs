import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { validateWorkflowTrust } from '../site/scripts/validate-workflow-trust.mjs';

const CHECKOUT_SHA = '3d3c42e5aac5ba805825da76410c181273ba90b1';
const SETUP_NODE_SHA = '820762786026740c76f36085b0efc47a31fe5020';

function createRepository() {
  const root = mkdtempSync(resolve(tmpdir(), 'pencil-blade-workflow-trust-'));
  mkdirSync(resolve(root, '.github/workflows'), { recursive: true });
  mkdirSync(resolve(root, '.github/actions'), { recursive: true });
  return root;
}

function write(root, path, source) {
  const absolutePath = resolve(root, path);
  mkdirSync(resolve(absolutePath, '..'), { recursive: true });
  writeFileSync(absolutePath, source);
  return absolutePath;
}

function validPullRequestWorkflow(extraSteps = '') {
  return `
name: Site checks
on:
  pull_request:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@${CHECKOUT_SHA}
      - uses: actions/setup-node@${SETUP_NODE_SHA}
${extraSteps}`;
}

test('accepts a pinned GitHub-hosted pull-request workflow', (context) => {
  const root = createRepository();
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const workflowPath = write(
    root,
    '.github/workflows/site.yml',
    validPullRequestWorkflow(),
  );

  const report = validateWorkflowTrust(workflowPath, { repositoryRoot: root });

  assert.deepEqual(report.workflows, ['.github/workflows/site.yml']);
  assert.deepEqual(report.actions, []);
});

test('recursively accepts a pinned local reusable workflow and composite action', (context) => {
  const root = createRepository();
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const workflowPath = write(
    root,
    '.github/workflows/site.yml',
    `
name: Site checks
on:
  pull_request:
permissions:
  contents: read
jobs:
  reusable:
    uses: ./.github/workflows/reusable.yml
`,
  );
  write(
    root,
    '.github/workflows/reusable.yml',
    `
name: Reusable
on:
  workflow_call:
jobs:
  test:
    runs-on: ubuntu-22.04
    steps:
      - uses: ./.github/actions/setup
`,
  );
  write(
    root,
    '.github/actions/setup/action.yml',
    `
name: Setup
runs:
  using: composite
  steps:
    - uses: actions/setup-node@${SETUP_NODE_SHA}
`,
  );

  const report = validateWorkflowTrust(workflowPath, { repositoryRoot: root });

  assert.deepEqual(report.workflows, [
    '.github/workflows/reusable.yml',
    '.github/workflows/site.yml',
  ]);
  assert.deepEqual(report.actions, ['.github/actions/setup/action.yml']);
});

for (const fixture of [
  {
    name: 'pull_request_target',
    source: validPullRequestWorkflow().replace('pull_request:', 'pull_request_target:'),
    pattern: /must not use pull_request_target/u,
  },
  {
    name: 'mutable action tag',
    source: validPullRequestWorkflow().replace(
      `actions/checkout@${CHECKOUT_SHA}`,
      'actions/checkout@v7',
    ),
    pattern: /full 40-hex commit SHA/u,
  },
  {
    name: 'matrix-selected runner',
    source: validPullRequestWorkflow().replace(
      'runs-on: ubuntu-24.04',
      'runs-on: ${{ matrix.runner }}',
    ),
    pattern: /must not use expressions or matrix values/u,
  },
  {
    name: 'dynamic runner object',
    source: validPullRequestWorkflow().replace(
      'runs-on: ubuntu-24.04',
      'runs-on:\n      group: trusted',
    ),
    pattern: /runs-on must be a static string or static label array/u,
  },
  {
    name: 'self-hosted label',
    source: validPullRequestWorkflow().replace(
      'runs-on: ubuntu-24.04',
      'runs-on: self-hosted',
    ),
    pattern: /must use an exact GitHub-hosted Linux label/u,
  },
  {
    name: 'mutable hosted alias',
    source: validPullRequestWorkflow().replace(
      'runs-on: ubuntu-24.04',
      'runs-on: ubuntu-latest',
    ),
    pattern: /must use an exact GitHub-hosted Linux label/u,
  },
  {
    name: 'write permission',
    source: validPullRequestWorkflow().replace('contents: read', 'contents: write'),
    pattern: /permission contents must be read or none/u,
  },
  {
    name: 'implicit permissions',
    source: validPullRequestWorkflow().replace(
      'permissions:\n  contents: read\n',
      '',
    ),
    pattern: /must declare explicit read-only permissions/u,
  },
  {
    name: 'Docker action',
    source: validPullRequestWorkflow(
      '      - uses: docker://alpine:latest\n',
    ),
    pattern: /unpinned Docker action/u,
  },
]) {
  test(`rejects ${fixture.name}`, (context) => {
    const root = createRepository();
    context.after(() => rmSync(root, { force: true, recursive: true }));
    const workflowPath = write(root, '.github/workflows/site.yml', fixture.source);

    assert.throws(
      () => validateWorkflowTrust(workflowPath, { repositoryRoot: root }),
      fixture.pattern,
    );
  });
}

test('rejects a PR-reachable remote reusable workflow even when pinned', (context) => {
  const root = createRepository();
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const workflowPath = write(
    root,
    '.github/workflows/site.yml',
    `
name: Site checks
on:
  pull_request:
permissions:
  contents: read
jobs:
  escaped:
    uses: example/actions/.github/workflows/build.yml@${CHECKOUT_SHA}
`,
  );

  assert.throws(
    () => validateWorkflowTrust(workflowPath, { repositoryRoot: root }),
    /must not call a remote reusable workflow from a PR-reachable graph/u,
  );
});

test('rejects self-hosted execution hidden in a local reusable workflow', (context) => {
  const root = createRepository();
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const workflowPath = write(
    root,
    '.github/workflows/site.yml',
    `
name: Site checks
on:
  pull_request:
permissions:
  contents: read
jobs:
  escaped:
    uses: ./.github/workflows/reusable.yml
`,
  );
  write(
    root,
    '.github/workflows/reusable.yml',
    `
name: Reusable
on:
  workflow_call:
jobs:
  creator:
    runs-on:
      - self-hosted
      - macOS
      - ARM64
    steps:
      - run: echo unsafe
`,
  );

  assert.throws(
    () => validateWorkflowTrust(workflowPath, { repositoryRoot: root }),
    /is PR-reachable and must not use a label array/u,
  );
});

test('rejects mutable remote actions hidden in a local composite action', (context) => {
  const root = createRepository();
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const workflowPath = write(
    root,
    '.github/workflows/site.yml',
    validPullRequestWorkflow('      - uses: ./.github/actions/setup\n'),
  );
  write(
    root,
    '.github/actions/setup/action.yml',
    `
name: Setup
runs:
  using: composite
  steps:
    - uses: actions/setup-node@v7
`,
  );

  assert.throws(
    () => validateWorkflowTrust(workflowPath, { repositoryRoot: root }),
    /full 40-hex commit SHA/u,
  );
});

test('allows a manual workflow to use a static self-hosted runner but still requires pinned actions', (context) => {
  const root = createRepository();
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const workflowPath = write(
    root,
    '.github/workflows/deploy.yml',
    `
name: Manual deploy
on:
  workflow_dispatch:
permissions: {}
jobs:
  creator:
    runs-on:
      - self-hosted
      - macOS
      - ARM64
      - cocos-creator-3.8.8
    steps:
      - uses: actions/checkout@${CHECKOUT_SHA}
`,
  );

  assert.doesNotThrow(
    () => validateWorkflowTrust(workflowPath, { repositoryRoot: root }),
  );
});
