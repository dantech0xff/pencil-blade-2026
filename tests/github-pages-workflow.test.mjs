import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflowPath = resolve(
  projectRoot,
  '.github/workflows/deploy-web-mobile-pages.yml',
);
const workflowSource = readFileSync(workflowPath, 'utf8');
const requireFromSite = createRequire(resolve(projectRoot, 'site/package.json'));
const { parse } = requireFromSite('yaml');
const workflow = parse(workflowSource);
const toolchain = JSON.parse(
  readFileSync(resolve(projectRoot, 'reference/case-study-build-toolchain.json'), 'utf8'),
);

const ACTIONS = Object.freeze({
  'actions/checkout': {
    sha: '3d3c42e5aac5ba805825da76410c181273ba90b1',
    tag: 'v7.0.1',
  },
  'actions/configure-pages': {
    sha: '45bfe0192ca1faeb007ade9deae92b16b8254a0d',
    tag: 'v6.0.0',
  },
  'actions/deploy-pages': {
    sha: 'cd2ce8fcbc39b97be8ca5fce6e763baed58fa128',
    tag: 'v5.0.0',
  },
  'actions/download-artifact': {
    sha: '3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c',
    tag: 'v8.0.1',
  },
  'actions/setup-node': {
    sha: '820762786026740c76f36085b0efc47a31fe5020',
    tag: 'v7.0.0',
  },
  'actions/upload-artifact': {
    sha: '043fb46d1a93c77aae656e7c1c64a875d1fc6a0a',
    tag: 'v7.0.1',
  },
  'actions/upload-pages-artifact': {
    sha: 'fc324d3547104276b827a68afc52ff2a11cc49c9',
    tag: 'v5.0.0',
  },
});

function jobSource(startJob, endJob) {
  const start = workflowSource.indexOf(`  ${startJob}:`);
  const end = endJob
    ? workflowSource.indexOf(`  ${endJob}:`, start + 1)
    : workflowSource.length;
  assert.ok(start >= 0 && end > start);
  return workflowSource.slice(start, end);
}

function actionUses() {
  return Object.values(workflow.jobs)
    .flatMap((job) => job.steps ?? [])
    .map((step) => step.uses)
    .filter(Boolean);
}

function sha256(repositoryPath) {
  return createHash('sha256')
    .update(readFileSync(resolve(projectRoot, repositoryPath)))
    .digest('hex');
}

test('deployment is manual-only and every executable job is protected-main gated', () => {
  assert.deepEqual(workflow.on, { workflow_dispatch: null });
  assert.deepEqual(workflow.permissions, {});
  assert.deepEqual(Object.keys(workflow.jobs), [
    'site-build',
    'game-build',
    'compose-pages',
    'deploy-pages',
    'record-approval-evidence',
    'production-smoke',
  ]);
  for (const job of Object.values(workflow.jobs)) {
    assert.equal(
      job.if,
      "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'",
    );
  }
  assert.match(workflowSource, /test "\$GITHUB_REF" = "refs\/heads\/main"/u);
  assert.doesNotMatch(workflowSource, /^\s+(?:pull_request|pull_request_target|push):/mu);
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
});

test('site, composition, deployment, and smoke stay on exact GitHub-hosted Linux', () => {
  for (const jobId of [
    'site-build',
    'compose-pages',
    'deploy-pages',
    'record-approval-evidence',
    'production-smoke',
  ]) {
    assert.equal(workflow.jobs[jobId]['runs-on'], 'ubuntu-24.04');
  }
  assert.deepEqual(workflow.jobs['game-build']['runs-on'], [
    'self-hosted',
    'macOS',
    'ARM64',
    'cocos-creator-3.8.8',
  ]);
  assert.match(
    workflowSource,
    /COCOS_CREATOR_BIN_SHA256: 3a8452496c03e85f2784e64679a1fd203701b0b245125efee02c7923f2bd3464/u,
  );
  assert.match(workflowSource, /plutil[\s\S]*CFBundleShortVersionString/u);
  assert.match(workflowSource, /shasum -a 256 "\$COCOS_CREATOR_BIN"/u);
  assert.doesNotMatch(workflowSource, /defaults read|codesign --verify --deep --strict/u);
});

test('jobs use least privilege, bounded execution, and the required dependency graph', () => {
  assert.deepEqual(workflow.jobs['site-build'].permissions, { contents: 'read' });
  assert.deepEqual(workflow.jobs['game-build'].permissions, { contents: 'read' });
  assert.deepEqual(workflow.jobs['compose-pages'].permissions, { contents: 'read' });
  assert.deepEqual(workflow.jobs['deploy-pages'].permissions, {
    actions: 'read',
    pages: 'write',
    'id-token': 'write',
  });
  assert.deepEqual(workflow.jobs['record-approval-evidence'].permissions, {
    actions: 'read',
    contents: 'read',
    deployments: 'read',
  });
  assert.deepEqual(workflow.jobs['production-smoke'].permissions, { contents: 'read' });
  assert.deepEqual(workflow.jobs['compose-pages'].needs, ['site-build', 'game-build']);
  assert.deepEqual(workflow.jobs['deploy-pages'].needs, ['compose-pages']);
  assert.deepEqual(workflow.jobs['record-approval-evidence'].needs, [
    'compose-pages',
    'deploy-pages',
  ]);
  assert.deepEqual(workflow.jobs['production-smoke'].needs, [
    'compose-pages',
    'deploy-pages',
    'record-approval-evidence',
  ]);
  for (const job of Object.values(workflow.jobs)) {
    assert.ok(
      Number.isInteger(job['timeout-minutes']) && job['timeout-minutes'] > 0,
      'every job must have a positive timeout',
    );
  }
});

test('all remote actions use reviewed full SHAs with human tag comments', () => {
  const uses = actionUses();
  assert.ok(uses.length > 0);
  for (const use of uses) {
    const [identity, sha] = use.split('@');
    assert.match(sha, /^[0-9a-f]{40}$/u);
    assert.deepEqual(ACTIONS[identity]?.sha, sha, `unreviewed action identity ${identity}`);
  }
  for (const [identity, record] of Object.entries(ACTIONS)) {
    assert.match(
      workflowSource,
      new RegExp(
        `${identity.replaceAll('/', '\\/')}@${record.sha} # ${record.tag.replaceAll('.', '\\.')}`,
        'u',
      ),
    );
  }
  assert.doesNotMatch(
    workflowSource,
    /uses:\s+(?!\.\/)[^\s@]+@(?:main|master|v?\d+(?:\.\d+){0,2})\b/u,
  );
});

test('exact Node/npm and package isolation are enforced in every build domain', () => {
  assert.match(workflowSource, /node-version-file: \.node-version/u);
  assert.match(workflowSource, /test "\$\(node --version\)" = "v24\.18\.0"/u);
  assert.match(workflowSource, /test "\$\(npm --version\)" = "11\.6\.2"/u);
  for (const jobId of [
    'site-build',
    'game-build',
    'compose-pages',
    'record-approval-evidence',
    'production-smoke',
  ]) {
    const steps = workflow.jobs[jobId].steps;
    const setupIndex = steps.findIndex((step) => step.name === 'Set up exact Node');
    const npmIndex = steps.findIndex((step) => step.name === 'Install exact npm');
    assert.ok(setupIndex >= 0 && npmIndex === setupIndex + 1);
    assert.equal(
      steps[npmIndex].run,
      'npm install --global npm@11.6.2 --ignore-scripts --no-audit --no-fund',
    );
  }

  const siteJob = jobSource('site-build', 'game-build');
  const gameJob = jobSource('game-build', 'compose-pages');
  assert.match(siteJob, /cache-dependency-path: site\/package-lock\.json/u);
  assert.match(siteJob, /working-directory: site/u);
  assert.doesNotMatch(siteJob, /working-directory: game|game\/package-lock\.json/u);
  assert.match(gameJob, /cache-dependency-path: game\/package-lock\.json/u);
  assert.match(gameJob, /working-directory: game/u);
  assert.doesNotMatch(
    gameJob,
    /working-directory: site|site\/package-lock\.json|npm --prefix site|playwright install/u,
  );
});

test('runner-scoped temp paths are initialized only after jobs reach a runner', () => {
  for (const job of Object.values(workflow.jobs)) {
    for (const value of Object.values(job.env ?? {})) {
      assert.doesNotMatch(String(value), /\$\{\{\s*runner\./u);
    }
  }

  const expectedInitializers = new Map([
    ['compose-pages', 'Initialize ephemeral candidate paths'],
    ['record-approval-evidence', 'Initialize ephemeral evidence paths'],
    ['production-smoke', 'Initialize ephemeral smoke path'],
  ]);
  for (const [jobId, stepName] of expectedInitializers) {
    const initializer = workflow.jobs[jobId].steps.find(
      (step) => step.name === stepName,
    );
    assert.ok(initializer, `${jobId} must initialize its runner temp paths`);
    assert.match(initializer.run, /\$RUNNER_TEMP/u);
    assert.match(initializer.run, /\$GITHUB_ENV/u);
  }

  const composeJob = workflow.jobs['compose-pages'];
  const composeInitializer = composeJob.steps.find(
    (step) => step.name === 'Initialize ephemeral candidate paths',
  );
  assert.equal(composeJob.env?.REVIEW_REPORT_DIR, undefined);
  assert.match(
    composeInitializer.run,
    /REVIEW_REPORT_DIR=%s\/case-study-work\\n' "\$RUNNER_TEMP"/u,
  );
});

test('self-hosted game job runs only the exact manifest and strict raw-game gates', () => {
  const gameJob = jobSource('game-build', 'compose-pages');
  assert.match(
    gameJob,
    /scripts\/run-game-release-tests\.mjs[\s\S]*--manifest reference\/game-release-test-manifest\.json/u,
  );
  assert.doesNotMatch(gameJob, /tests\/\*|portable_tests|case-study-.*\.test|site\/tests/u);
  assert.doesNotMatch(gameJob, /generate-technical-closeout-manifest\.test\.mjs/u);
  assert.match(gameJob, /scripts\/audit-web-build\.mjs "\$WEB_BUILD_DIR"/u);
  assert.match(gameJob, /scripts\/verify-web-mobile-build\.mjs "\$WEB_BUILD_DIR"/u);
  assert.match(
    gameJob,
    /validate-case-study-publication\.mjs[\s\S]*--verify-snapshot/u,
  );
  assert.doesNotMatch(gameJob, /verify-release-rights\.mjs/u);
  assert.ok(gameJob.indexOf('audit-web-build.mjs') < gameJob.indexOf('Upload immutable raw-game'));
});

test('site and game inputs are fixed current-run artifacts composed only on Linux', () => {
  const composeJob = jobSource('compose-pages', 'deploy-pages');
  for (const inputName of [
    'case-study-site-${{ github.run_id }}-${{ github.run_attempt }}',
    'case-study-game-${{ github.run_id }}-${{ github.run_attempt }}',
  ]) {
    assert.ok(workflowSource.includes(inputName));
    assert.ok(composeJob.includes(inputName));
  }
  assert.doesNotMatch(composeJob, /workflow_run|run-id:|repository:/u);
  assert.match(
    composeJob,
    /compose-case-study-pages\.mjs[\s\S]*--site-dist "\$SITE_DIST"[\s\S]*--game-dist "\$GAME_DIST"[\s\S]*--out-dir "\$CANDIDATE_DIR"/u,
  );
  assert.match(
    composeJob,
    /audit-case-study-build\.mjs[\s\S]*--candidate-dir "\$CANDIDATE_DIR"/u,
  );
  assert.match(
    composeJob,
    /verify-case-study-pages\.mjs[\s\S]*--pages-prefix \/pencil-blade-2026\//u,
  );
  assert.match(
    composeJob,
    /--build-dir "\$CANDIDATE_DIR\/play\/game"[\s\S]*--pages-prefix \/pencil-blade-2026\/play\/game\/[\s\S]*--entry-path index\.html/u,
  );
  assert.doesNotMatch(
    composeJob,
    /audit-web-build\.mjs "\$CANDIDATE_DIR"/u,
  );
});

test('approval request is separate and the exact candidate is uploaded for review and Pages', () => {
  const composeJob = jobSource('compose-pages', 'deploy-pages');
  assert.match(
    composeJob,
    /case-study-approval\.mjs prepare[\s\S]*candidate-approval-request\.json/u,
  );
  assert.match(
    composeJob,
    /qa_artifact_name="case-study-qa-\$GITHUB_RUN_ID-\$GITHUB_RUN_ATTEMPT"[\s\S]*--report "\$qa_artifact_name\/candidate-audit\.txt"[\s\S]*--report "\$qa_artifact_name\/runtime-nested\/case-study-h5-runtime-matrix\.json"[\s\S]*--report "\$qa_artifact_name\/candidate-smoke\/case-study-production-smoke\.json"/u,
  );
  assert.doesNotMatch(
    composeJob,
    /--report "\$REVIEW_REPORT_DIR\//u,
  );
  assert.match(
    composeJob,
    /case-study-approval\.mjs verify[\s\S]*--request "\$NONDEPLOYABLE_DIR\/candidate-approval-request\.json"/u,
  );
  assert.match(
    composeJob,
    /name: case-study-candidate-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}[\s\S]*path: \$\{\{ runner\.temp \}\}\/case-study-pages/u,
  );
  assert.match(
    composeJob,
    /name: case-study-approval-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}[\s\S]*candidate-approval-request\.json/u,
  );
  assert.match(
    composeJob,
    /release\.content\?\.contentTreeDigest[\s\S]*release\.content\.contentTreeDigest/u,
  );
  assert.match(
    composeJob,
    /actions\/upload-pages-artifact@[0-9a-f]{40}[\s\S]*name: github-pages[\s\S]*path: \$\{\{ runner\.temp \}\}\/case-study-pages/u,
  );
  const qaUpload = workflow.jobs['compose-pages'].steps.find(
    (step) => step.name === 'Upload nondeployable candidate QA reports',
  );
  assert.equal(qaUpload.with.path, '${{ runner.temp }}/case-study-work');
  assert.equal(qaUpload.with['include-hidden-files'], true);
  assert.match(
    composeJob,
    /run-case-study-production-smoke\.mjs[\s\S]*--candidate-dir "\$CANDIDATE_DIR"[\s\S]*candidate-smoke/u,
  );
});

test('same-artifact deploy retry keeps candidate attempt identity stable', () => {
  const compose = workflow.jobs['compose-pages'];
  assert.equal(
    compose.outputs['candidate-run-attempt'],
    '${{ steps.release.outputs.candidate-run-attempt }}',
  );
  assert.equal(
    compose.outputs['approval-artifact-name'],
    '${{ steps.release.outputs.approval-artifact-name }}',
  );
  const evidence = workflow.jobs['record-approval-evidence'];
  const candidateDownload = evidence.steps.find(
    (step) => step.name === 'Download exact reviewed candidate',
  );
  const approvalDownload = evidence.steps.find(
    (step) => step.name === 'Download exact approval request',
  );
  assert.equal(
    candidateDownload.with.name,
    '${{ needs.compose-pages.outputs.candidate-artifact-name }}',
  );
  assert.equal(
    approvalDownload.with.name,
    '${{ needs.compose-pages.outputs.approval-artifact-name }}',
  );
  const evidenceSource = jobSource('record-approval-evidence', 'production-smoke');
  assert.match(
    evidenceSource,
    /workflowRunAttempt: candidateRunAttempt[\s\S]*deploymentWorkflowRunAttempt: Number\(run\.run_attempt\)/u,
  );
  const smokeSource = jobSource('production-smoke');
  assert.match(
    smokeSource,
    /--expected-run-attempt "\$\{\{ needs\.compose-pages\.outputs\.candidate-run-attempt \}\}"/u,
  );
  assert.doesNotMatch(
    evidenceSource,
    /name: case-study-(?:candidate|approval)-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/u,
  );
});

test('protected deploy has no source mutation and production smoke binds live bytes to outputs', () => {
  const deploy = workflow.jobs['deploy-pages'];
  assert.deepEqual(deploy.environment, {
    name: 'github-pages',
    url: '${{ steps.deployment.outputs.page_url }}',
  });
  assert.equal(deploy.steps.length, 2);
  assert.match(
    deploy.steps[0].run,
    /environments\/github-pages[\s\S]*required_reviewers[\s\S]*prevent_self_review[\s\S]*protected_branches/u,
  );
  assert.match(deploy.steps[0].run, /prevent_self_review !== false/u);
  assert.match(deploy.steps[0].run, /reviewers\.length !== 1/u);
  assert.match(deploy.steps[0].run, /GITHUB_ACTOR\.toLowerCase\(\)/u);
  assert.doesNotMatch(deploy.steps[0].run, /prevent_self_review !== true/u);
  assert.match(deploy.steps[0].run, /custom_branch_policies/u);
  assert.equal(
    deploy.steps[1].uses,
    `actions/deploy-pages@${ACTIONS['actions/deploy-pages'].sha}`,
  );
  assert.deepEqual(deploy.steps[1].with, { artifact_name: 'github-pages' });

  const smokeJob = jobSource('production-smoke');
  assert.match(smokeJob, /run-case-study-production-smoke\.mjs/u);
  assert.match(smokeJob, /--base-url "\$\{\{ needs\.deploy-pages\.outputs\.page-url \}\}"/u);
  assert.match(
    smokeJob,
    /--expected-content-digest "\$\{\{ needs\.compose-pages\.outputs\.content-tree-digest \}\}"/u,
  );
  assert.match(
    smokeJob,
    /--expected-tree-manifest-digest "\$\{\{ needs\.compose-pages\.outputs\.tree-manifest-digest \}\}"/u,
  );
  assert.match(smokeJob, /--ci/u);
});

test('post-deploy evidence uses authenticated review history and stays out of Pages', () => {
  const evidenceJob = jobSource('record-approval-evidence', 'production-smoke');
  assert.match(
    evidenceJob,
    /permissions:\n      actions: read\n      contents: read\n      deployments: read/u,
  );
  assert.match(
    evidenceJob,
    /actions\/runs\/\$GITHUB_RUN_ID\/approvals/u,
  );
  assert.match(evidenceJob, /Authorization: Bearer \$GITHUB_TOKEN/u);
  assert.match(
    evidenceJob,
    /case-study-approval\.mjs record-environment-evidence/u,
  );
  assert.match(
    evidenceJob,
    /--provider-history "\$EVIDENCE_OUTPUT\/provider-history\.json"/u,
  );
  assert.match(evidenceJob, /--allow-self-approval true/u);
  assert.match(evidenceJob, /deployment-statuses-api\.json/u);
  assert.match(evidenceJob, /run\.run_started_at/u);
  assert.match(evidenceJob, /isCurrentRunUrl\(record\.log_url\)/u);
  assert.match(evidenceJob, /deploymentPairs\.length !== 1/u);
  assert.match(evidenceJob, /approvalObservedAt: new Date\(\)\.toISOString\(\)/u);
  assert.doesNotMatch(evidenceJob, /reviewedAt: status\.created_at/u);
  assert.match(evidenceJob, /release\.content\.contentTreeDigest/u);
  assert.match(evidenceJob, /request\.candidate\.treeManifestDigestSha256/u);
  assert.match(
    evidenceJob,
    /name: deployment-approval-evidence-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/u,
  );
  assert.doesNotMatch(evidenceJob, /upload-pages-artifact|deploy-pages@/u);
});

test('post-deploy inline provider normalizer is valid JavaScript', () => {
  const run = workflow.jobs['record-approval-evidence'].steps.find(
    (step) => step.name === 'Normalize authenticated provider records',
  ).run;
  const match = run.match(
    /node --input-type=module -e '\n([\s\S]*?)\n' \\\n/u,
  );
  assert.ok(match, 'provider normalizer inline module was not found');
  const checked = spawnSync(
    process.execPath,
    ['--input-type=module', '--check'],
    {
      encoding: 'utf8',
      input: match[1],
    },
  );
  assert.equal(
    checked.status,
    0,
    `provider normalizer syntax failed:\n${checked.stderr}`,
  );
});

test('frozen toolchain binds exact runtimes, locks, browser, workflows, and actions', () => {
  assert.equal(toolchain.schemaVersion, 1);
  assert.deepEqual(
    {
      node: toolchain.node.version,
      npm: toolchain.npm.version,
    },
    {
      node: '24.18.0',
      npm: '11.6.2',
    },
  );
  assert.equal(toolchain.cocosCreator.version, '3.8.8');
  assert.equal(
    toolchain.cocosCreator.executableSha256,
    '3a8452496c03e85f2784e64679a1fd203701b0b245125efee02c7923f2bd3464',
  );
  assert.deepEqual(toolchain.playwright.chromium, {
    revision: '1228',
    browserVersion: '149.0.7827.55',
  });
  assert.deepEqual(toolchain.playwright.chromiumHeadlessShell, {
    revision: '1228',
    browserVersion: '149.0.7827.55',
  });
  assert.equal(toolchain.playwright.corePackage.version, '1.61.1');
  assert.deepEqual(
    {
      package: toolchain.workflowParser.package,
      version: toolchain.workflowParser.version,
    },
    {
      package: 'yaml',
      version: '2.9.0',
    },
  );

  for (const record of toolchain.packageLocks) {
    assert.equal(record.packageSha256, sha256(record.packagePath));
    assert.equal(record.lockSha256, sha256(record.lockPath));
  }
  for (const record of toolchain.workflowFiles) {
    assert.equal(record.sha256, sha256(record.path));
  }
  assert.equal(
    toolchain.cocosCreator.buildConfigSha256,
    sha256(toolchain.cocosCreator.buildConfigPath),
  );
  assert.equal(
    toolchain.siteBuild.astroConfigSha256,
    sha256(toolchain.siteBuild.astroConfigPath),
  );
  assert.equal(
    toolchain.gameReleaseTests.manifestSha256,
    sha256(toolchain.gameReleaseTests.manifestPath),
  );

  const actionRecords = Object.fromEntries(
    toolchain.actions.map((record) => [
      record.identity,
      { sha: record.commitSha, tag: record.tag },
    ]),
  );
  assert.deepEqual(actionRecords, ACTIONS);
});

test('both npm owners require the exact repository Node and npm versions', () => {
  for (const packageDirectory of ['game', 'site']) {
    const packageJson = JSON.parse(
      readFileSync(resolve(projectRoot, packageDirectory, 'package.json'), 'utf8'),
    );
    const packageLock = JSON.parse(
      readFileSync(resolve(projectRoot, packageDirectory, 'package-lock.json'), 'utf8'),
    );
    assert.equal(packageJson.packageManager, 'npm@11.6.2');
    assert.deepEqual(packageJson.engines, {
      node: '24.18.0',
      npm: '11.6.2',
    });
    assert.deepEqual(packageLock.packages[''].engines, packageJson.engines);
    for (const [packagePath, packageRecord] of Object.entries(packageLock.packages)) {
      if (packagePath) {
        assert.match(
          packageRecord.version ?? '',
          /^\d+\.\d+\.\d+(?:[-+].+)?$/u,
          `${packageDirectory}/${packagePath} must have a concrete version`,
        );
      }
    }
  }
});
