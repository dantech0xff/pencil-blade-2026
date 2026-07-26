#!/usr/bin/env node

import {
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '../..');
const DEFAULT_WORKFLOW = '.github/workflows/test-case-study-site.yml';
const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/u;
const EXACT_GITHUB_HOSTED_LINUX_LABELS = new Set([
  'ubuntu-22.04',
  'ubuntu-24.04',
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertContainedPath(repositoryRoot, absolutePath, label) {
  const relativePath = relative(repositoryRoot, absolutePath);
  if (
    relativePath === '..'
    || relativePath.startsWith(`..${sep}`)
    || isAbsolute(relativePath)
  ) {
    throw new Error(`${label} escapes the repository root`);
  }
}

function readTrustedFile(repositoryRoot, absolutePath, label) {
  assertContainedPath(repositoryRoot, absolutePath, label);
  const metadata = lstatSync(absolutePath);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`${label} must be a regular, non-symlink file`);
  }
  const realPath = realpathSync(absolutePath);
  assertContainedPath(repositoryRoot, realPath, `${label} resolved path`);
  return readFileSync(realPath, 'utf8');
}

function parseYamlFile(repositoryRoot, absolutePath, label) {
  const source = readTrustedFile(repositoryRoot, absolutePath, label);
  const document = parseDocument(source, {
    prettyErrors: false,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new Error(
      `${label} is not valid YAML: ${document.errors.map((error) => error.message).join('; ')}`,
    );
  }
  const value = document.toJS({ maxAliasCount: 50 });
  if (!isPlainObject(value)) {
    throw new Error(`${label} must contain a YAML object`);
  }
  return value;
}

function eventNames(onValue) {
  if (typeof onValue === 'string') {
    return [onValue];
  }
  if (Array.isArray(onValue)) {
    return onValue.filter((value) => typeof value === 'string');
  }
  if (isPlainObject(onValue)) {
    return Object.keys(onValue);
  }
  return [];
}

function validatePermissions(value, label, findings, { requireExplicit = false } = {}) {
  if (value === undefined) {
    if (requireExplicit) {
      findings.push(`${label} must declare explicit read-only permissions`);
    }
    return;
  }
  if (!isPlainObject(value)) {
    findings.push(`${label} permissions must be an object, not ${String(value)}`);
    return;
  }
  for (const [permission, access] of Object.entries(value)) {
    if (access !== 'read' && access !== 'none') {
      findings.push(`${label} permission ${permission} must be read or none, found ${String(access)}`);
    }
  }
}

function validatePinnedRemoteUse(uses, label, findings) {
  if (typeof uses !== 'string' || uses.length === 0 || uses.includes('${{')) {
    findings.push(`${label} uses must be a static action or workflow reference`);
    return false;
  }
  if (uses.startsWith('docker://')) {
    findings.push(`${label} uses an unpinned Docker action: ${uses}`);
    return false;
  }

  const atIndex = uses.lastIndexOf('@');
  if (atIndex <= 0 || !FULL_COMMIT_SHA.test(uses.slice(atIndex + 1))) {
    findings.push(`${label} remote reference must use a full 40-hex commit SHA: ${uses}`);
    return false;
  }
  const repositoryPath = uses.slice(0, atIndex);
  if (
    repositoryPath.startsWith('/')
    || repositoryPath.includes('\\')
    || repositoryPath.split('/').length < 2
    || repositoryPath.split('/').some((segment) => segment.length === 0)
  ) {
    findings.push(`${label} has an invalid remote action or workflow identity: ${uses}`);
    return false;
  }
  return true;
}

function resolveLocalReference(repositoryRoot, uses, label, findings) {
  if (
    typeof uses !== 'string'
    || !uses.startsWith('./')
    || uses.includes('${{')
    || uses.includes('\0')
    || uses.includes('\\')
    || uses.includes('@')
  ) {
    findings.push(`${label} has an invalid local reference: ${String(uses)}`);
    return null;
  }
  const absolutePath = resolve(repositoryRoot, uses.slice(2));
  try {
    assertContainedPath(repositoryRoot, absolutePath, label);
  } catch (error) {
    findings.push(error.message);
    return null;
  }
  return absolutePath;
}

function validateRunner(runsOn, label, prReachable, findings) {
  if (typeof runsOn === 'string') {
    if (runsOn.includes('${{')) {
      findings.push(`${label} runs-on must not use expressions or matrix values`);
      return;
    }
    if (prReachable && !EXACT_GITHUB_HOSTED_LINUX_LABELS.has(runsOn)) {
      findings.push(
        `${label} is PR-reachable and must use an exact GitHub-hosted Linux label, found ${runsOn}`,
      );
    }
    return;
  }

  if (Array.isArray(runsOn)) {
    if (
      runsOn.length === 0
      || runsOn.some((value) => typeof value !== 'string' || value.includes('${{'))
    ) {
      findings.push(`${label} runs-on must contain only static labels`);
      return;
    }
    if (prReachable) {
      findings.push(`${label} is PR-reachable and must not use a label array`);
    }
    return;
  }
  findings.push(`${label} runs-on must be a static string or static label array`);
}

function workflowRelativePath(repositoryRoot, workflowPath) {
  return relative(repositoryRoot, workflowPath).split(sep).join('/');
}

export function validateWorkflowTrust(workflowPath = DEFAULT_WORKFLOW, options = {}) {
  const repositoryRoot = realpathSync(resolve(options.repositoryRoot ?? REPOSITORY_ROOT));
  const entryPath = isAbsolute(workflowPath)
    ? resolve(workflowPath)
    : resolve(repositoryRoot, workflowPath);
  const findings = [];
  const visitedWorkflows = new Set();
  const visitedActions = new Set();
  const workflowStack = new Set();
  const workflows = [];
  const actions = [];

  function inspectUses(uses, label, prReachable) {
    if (typeof uses === 'string' && uses.startsWith('./')) {
      inspectLocalAction(uses, label, prReachable);
      return;
    }
    validatePinnedRemoteUse(uses, label, findings);
  }

  function inspectCompositeSteps(steps, label, prReachable) {
    if (!Array.isArray(steps)) {
      findings.push(`${label} composite steps must be an array`);
      return;
    }
    for (const [index, step] of steps.entries()) {
      const stepLabel = `${label}.steps[${index}]`;
      if (!isPlainObject(step)) {
        findings.push(`${stepLabel} must be an object`);
        continue;
      }
      if (step.uses !== undefined) {
        inspectUses(step.uses, stepLabel, prReachable);
      }
    }
  }

  function inspectLocalAction(uses, label, prReachable) {
    const actionDirectory = resolveLocalReference(repositoryRoot, uses, label, findings);
    if (!actionDirectory) {
      return;
    }
    let directoryMetadata;
    try {
      directoryMetadata = lstatSync(actionDirectory);
    } catch {
      findings.push(`${label} local action does not exist: ${uses}`);
      return;
    }
    if (directoryMetadata.isSymbolicLink() || !directoryMetadata.isDirectory()) {
      findings.push(`${label} local action must be a regular, non-symlink directory: ${uses}`);
      return;
    }
    const realActionDirectory = realpathSync(actionDirectory);
    try {
      assertContainedPath(repositoryRoot, realActionDirectory, label);
    } catch (error) {
      findings.push(error.message);
      return;
    }

    const definitionCandidates = ['action.yml', 'action.yaml']
      .map((name) => resolve(realActionDirectory, name));
    let definitionPath = null;
    for (const candidate of definitionCandidates) {
      try {
        const metadata = lstatSync(candidate);
        if (!metadata.isSymbolicLink() && metadata.isFile()) {
          definitionPath = candidate;
          break;
        }
      } catch {
        // Try the next supported action metadata filename.
      }
    }
    if (!definitionPath) {
      findings.push(`${label} local action has no regular action.yml or action.yaml: ${uses}`);
      return;
    }

    const actionKey = `${definitionPath}\0${String(prReachable)}`;
    if (visitedActions.has(actionKey)) {
      return;
    }
    visitedActions.add(actionKey);
    actions.push(workflowRelativePath(repositoryRoot, definitionPath));

    let action;
    try {
      action = parseYamlFile(repositoryRoot, definitionPath, `${label} local action`);
    } catch (error) {
      findings.push(error.message);
      return;
    }
    if (!isPlainObject(action.runs) || typeof action.runs.using !== 'string') {
      findings.push(`${label} local action must declare static runs.using`);
      return;
    }
    if (action.runs.using === 'composite') {
      inspectCompositeSteps(action.runs.steps, label, prReachable);
    }
  }

  function inspectWorkflow(absolutePath, inheritedPrReachable = false, calledLocally = false) {
    let realWorkflowPath;
    try {
      realWorkflowPath = realpathSync(absolutePath);
      assertContainedPath(repositoryRoot, realWorkflowPath, 'workflow');
    } catch (error) {
      findings.push(`workflow cannot be resolved safely: ${absolutePath}: ${error.message}`);
      return;
    }
    const relativeWorkflowPath = workflowRelativePath(repositoryRoot, realWorkflowPath);
    if (!/^\.github\/workflows\/[^/]+\.ya?ml$/u.test(relativeWorkflowPath)) {
      findings.push(`local reusable workflow must be a direct file under .github/workflows/: ${relativeWorkflowPath}`);
      return;
    }

    const workflowKey = `${realWorkflowPath}\0${String(inheritedPrReachable)}`;
    if (workflowStack.has(workflowKey)) {
      findings.push(`local reusable workflow cycle detected at ${relativeWorkflowPath}`);
      return;
    }
    if (visitedWorkflows.has(workflowKey)) {
      return;
    }
    visitedWorkflows.add(workflowKey);
    workflowStack.add(workflowKey);
    workflows.push(relativeWorkflowPath);

    let workflow;
    try {
      workflow = parseYamlFile(repositoryRoot, realWorkflowPath, relativeWorkflowPath);
    } catch (error) {
      findings.push(error.message);
      workflowStack.delete(workflowKey);
      return;
    }

    const events = eventNames(workflow.on);
    if (events.includes('pull_request_target')) {
      findings.push(`${relativeWorkflowPath} must not use pull_request_target`);
    }
    if (calledLocally && !events.includes('workflow_call')) {
      findings.push(`${relativeWorkflowPath} is called as a reusable workflow but lacks workflow_call`);
    }
    const prReachable = inheritedPrReachable || events.includes('pull_request');
    if (prReachable) {
      validatePermissions(
        workflow.permissions,
        relativeWorkflowPath,
        findings,
        { requireExplicit: !calledLocally },
      );
    }

    if (!isPlainObject(workflow.jobs) || Object.keys(workflow.jobs).length === 0) {
      findings.push(`${relativeWorkflowPath} must declare at least one job`);
      workflowStack.delete(workflowKey);
      return;
    }

    for (const [jobId, job] of Object.entries(workflow.jobs)) {
      const jobLabel = `${relativeWorkflowPath} job ${jobId}`;
      if (!isPlainObject(job)) {
        findings.push(`${jobLabel} must be an object`);
        continue;
      }
      if (prReachable && job.permissions !== undefined) {
        validatePermissions(job.permissions, jobLabel, findings);
      }

      if (job.uses !== undefined) {
        if (job.runsOn !== undefined || job['runs-on'] !== undefined || job.steps !== undefined) {
          findings.push(`${jobLabel} reusable-workflow job must not also declare runs-on or steps`);
        }
        if (prReachable && job.secrets === 'inherit') {
          findings.push(`${jobLabel} must not inherit secrets from a PR-reachable caller`);
        }
        if (typeof job.uses === 'string' && job.uses.startsWith('./')) {
          const reusablePath = resolveLocalReference(
            repositoryRoot,
            job.uses,
            jobLabel,
            findings,
          );
          if (reusablePath) {
            inspectWorkflow(reusablePath, prReachable, true);
          }
        } else if (prReachable) {
          validatePinnedRemoteUse(job.uses, jobLabel, findings);
          findings.push(`${jobLabel} must not call a remote reusable workflow from a PR-reachable graph`);
        } else {
          validatePinnedRemoteUse(job.uses, jobLabel, findings);
        }
        continue;
      }

      validateRunner(job['runs-on'], jobLabel, prReachable, findings);
      if (!Array.isArray(job.steps)) {
        findings.push(`${jobLabel} must declare a steps array`);
        continue;
      }
      for (const [index, step] of job.steps.entries()) {
        const stepLabel = `${jobLabel} step ${index}`;
        if (!isPlainObject(step)) {
          findings.push(`${stepLabel} must be an object`);
          continue;
        }
        if (step.uses !== undefined) {
          inspectUses(step.uses, stepLabel, prReachable);
        }
      }
    }

    workflowStack.delete(workflowKey);
  }

  inspectWorkflow(entryPath);
  if (findings.length > 0) {
    throw new Error(
      `Workflow trust validation failed:\n${findings.map((finding) => `- ${finding}`).join('\n')}`,
    );
  }
  return Object.freeze({
    actions: Object.freeze([...new Set(actions)].sort()),
    entryWorkflow: workflowRelativePath(repositoryRoot, realpathSync(entryPath)),
    workflows: Object.freeze([...new Set(workflows)].sort()),
  });
}

function isExecutedDirectly() {
  return process.argv[1]
    && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isExecutedDirectly()) {
  const workflowPaths = process.argv.slice(2);
  const targets = workflowPaths.length > 0 ? workflowPaths : [DEFAULT_WORKFLOW];
  try {
    for (const target of targets) {
      const report = validateWorkflowTrust(target);
      process.stdout.write(
        `Workflow trust passed for ${report.entryWorkflow}: `
        + `${report.workflows.length} workflow(s), ${report.actions.length} local action(s).\n`,
      );
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
