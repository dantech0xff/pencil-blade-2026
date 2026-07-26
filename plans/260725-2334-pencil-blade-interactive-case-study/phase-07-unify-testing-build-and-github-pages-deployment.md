---
phase: 7
title: "Build Audited Release Candidate and GitHub Pages Pipeline"
status: completed
priority: P1
dependencies: [4, 5, 6]
effort: "8-11 days"
---

# Phase 7: Build Audited Release Candidate and GitHub Pages Pipeline

## Context Links

- [Phase 2 Astro platform and content pipeline](./phase-02-build-astro-platform-and-content-pipeline.md)
- [Phase 4 story/forensics/reconstruction chapters](./phase-04-produce-story-forensics-and-reconstruction-chapters.md)
- [Phase 5 AI Lab and evidence explorer](./phase-05-build-ai-lab-and-evidence-explorer.md)
- [Phase 6 playable H5 integration](./phase-06-integrate-playable-h5-game-experience.md)
- [Site/H5/Pages architecture report](./reports/site-h5-pages-architecture.md)
- [Editorial experience spec](./reports/editorial-experience-spec.md)
- [.github/workflows/deploy-web-mobile-pages.yml](../../.github/workflows/deploy-web-mobile-pages.yml)
- [scripts/audit-web-build.mjs](../../scripts/audit-web-build.mjs)
- [scripts/verify-web-mobile-build.mjs](../../scripts/verify-web-mobile-build.mjs)
- [scripts/run-h5-runtime-matrix.mjs](../../scripts/run-h5-runtime-matrix.mjs)
- [tests/github-pages-workflow.test.mjs](../../tests/github-pages-workflow.test.mjs)
- [tests/audit-web-build.test.mjs](../../tests/audit-web-build.test.mjs)
- [tests/verify-web-mobile-build.test.mjs](../../tests/verify-web-mobile-build.test.mjs)
- [docs/cocos-creator-build-audit.md](../../docs/cocos-creator-build-audit.md)
- [docs/compatibility-matrix.md](../../docs/compatibility-matrix.md)

## Overview

Unify the editorial Astro site and the clean-room Cocos H5 runtime into one immutable Pages
candidate without collapsing the current game-only release audits. The candidate tree lives at
the repository Pages base `/pencil-blade-2026/`, with the Astro site at the root and the audited
raw Cocos output copied into `/play/game/`. The `/play/` page is the launch surface; the
same-origin iframe supplies lifecycle/performance containment only and must not use parent-DOM
coupling.

This phase owns the integration seam and release-pipeline implementation, not content authorship
or production approval. It builds, tests, uploads, and exposes the exact candidate digests for
review; the deploy job waits on the protected `github-pages` environment. Phase 8 reviews that
candidate, approves the waiting job, and verifies production. No site source is added after this
phase begins.

## Key Insights

- The current workflow assumes the game build is the deployable root. That assumption is no
  longer valid once Astro owns `/`.
- The raw game tree is still the authoritative output of the Creator runner. Do not move the
  site build onto that runner.
- The final artifact needs two layers of verification: one for the raw Cocos subtree and one
  for the composed Pages tree.
- Local synthetic MIME checks prove the verifier mapping only. Production must fetch every
  manifest file and verify hosting behavior; do not treat local headers as Pages evidence.
- The editorial site legitimately discusses `libgame.so`, Cocos2d-x, Ghidra/JADX, decompilers,
  evidence, and reports. Those terms remain forbidden inside the raw runtime but are not
  forbidden prose in the site; the composite policy must distinguish content from payload.
- The release-rights gate remains separate from technical deployability. Do not use it as a
  proxy for build validation.
- The restoration-era fidelity/technical-closeout files are immutable historical evidence.
  Website workflow/test changes belong to `caseStudyReleaseManifest`; do not regenerate the old
  frozen fixture manifest or reinterpret its game-only Pages proof as the composed release.
- Because the site and game will share one origin, launcher-page and iframe storage behavior
  must be explicit, minimal, and tested.

## Requirements

### Functional

- Build the Astro site to `site/dist/` as the Pages root.
- Build the Cocos H5 tree on the pinned self-hosted macOS ARM64 Creator runner only.
- Keep the existing raw game audit and exact-prefix verifier unchanged in purpose.
- Copy the audited raw Cocos output into the final Pages tree at `/play/game/`.
- Preserve the Astro-generated `/play/index.html` launcher and route its lazy iframe to
  `/play/game/`.
- Add a final composed-artifact audit that verifies root pages, content pages, launcher, and
  game subtree all resolve under `/pencil-blade-2026/`.
- Bind the newly audited raw game's tree digest, file count, and byte count to the H5 artifact
  recorded by the publication evidence snapshot and launcher facts. Any mismatch requires an
  explicit evidence-snapshot/content update before deployment.
- Keep the legacy H5 runtime report, fidelity report, frozen fixture manifest, and technical
  closeout bytes unchanged. The new nested/candidate/production reports have their own schema,
  path, and evidence lifetime.
- Add a GitHub-hosted pull-request workflow for site/content/unit/browser gates; it must never
  dispatch Cocos work to the self-hosted runner.
- Preserve manual `workflow_dispatch` deployment from protected `main`.
- Upload only the composed immutable Pages candidate and retain a normal Actions copy for
  digest-bound owner review.
- Keep the current commercial release-rights validator out of the academic deploy path. Run the
  new publication validator that confirms the exact existing academic decision and unchanged
  commercial fail-closed reference.
- Require every launch route, About page, SEO/robots/social asset, browser test, and production
  smoke tool to exist before candidate composition.
- Hold the deploy job at the protected `github-pages` environment until Phase 8 approves the
  exact `contentTreeDigest` and tree-manifest digest shown in the workflow summary.
- Configure and verify repository settings so `github-pages` has the sole project owner as its
  required human reviewer and only protected `main` can deploy. Because this repository has no
  independent reviewer, the environment may permit that owner to review their own dispatch, but
  authorization must still be an authenticated environment approval of the exact candidate after
  its digests are published; do not replace it with a plain workflow input.

### Non-functional

- No PR or untrusted code runs on the self-hosted Creator runner.
- GitHub-hosted Linux handles content build, composition, and final deploy.
- Cocos build commands remain isolated from Astro package installation.
- Both workflows run the exact Node patch from `.node-version`; site jobs install only the locked
  `site/` package and Playwright-managed Chromium, while game jobs run only a checked-in
  game-owned test manifest.
- Preserve the raw-game audit rigidity: fail closed on missing files, off-origin/root-relative
  runtime URLs, symlinks, source maps, legacy runtime references, or executable payloads.
- Give the editorial/composite audit its own policy: normal reviewed `https:` citations are
  allowed as anchors, while off-origin executable/media fetches, unsafe schemes, private paths,
  raw evidence artifacts, and unapproved binaries remain denied.
- Never run `audit-web-build.mjs` over the whole documentary tree. Run it only on the isolated
  `play/game/` subtree; otherwise its deliberate game-only terminology/path rules would reject
  valid case-study content.
- Keep build outputs untracked and reproducible from clean checkout.
- Pin every action/reusable workflow to a reviewed full commit SHA with its human version in a
  comment. Reject mutable tags and indirect PR-reachable self-hosted execution.
- Keep rollback as a hermetic rebuild of a known-good commit, not manual artifact mutation. A
  rollback rebuild must reproduce the approved content-tree digest before deployment.
- If only `deploy-pages` fails after the current run's immutable Pages artifact passed every
  gate, retry that deploy job against the same artifact. Do not rebuild and accidentally change
  the release candidate. This is retry, not rollback.

## Architecture

```text
site source (Astro/MDX; all launch routes/media complete)
        │
        ├── GitHub-hosted Linux build + content tests
        │
        ├── immutable site artifact (site/dist/)
        │
        └───────────────┐
                        v
game source (Cocos Creator 3.8.8)
        │
        └── self-hosted macOS ARM64 build + raw H5 audit
                        │
                        v
                game/build/web-mobile-pages/
                        │
                        └── immutable raw-game artifact
                        │
                        v
         immutable Pages candidate staging area
                        │
                        ├── /index.html, /story/*, /forensics/*
                        ├── /reconstruction/*, /ai-lab/*, /evidence/*
                        ├── /play/index.html, /about/*, /vi/*
                        └── /play/game/*
                        │
                        v
       final audit + runtime smoke + provenance + upload
                        │
                        v
       owner/editorial/locale review of exact candidate digest
                        │
                        v
        protected environment approval + same-artifact deploy
                        │
                        v
               manifest-wide production smoke
```

Job split:

| Job | Runner | Responsibility |
|---|---|---|
| site-build | GitHub-hosted Linux | Astro install, schema validation, content build, link/citation checks, unit/browser smoke, upload site artifact |
| game-build | self-hosted macOS ARM64 with Creator 3.8.8 | Build the raw Cocos tree, run game-owned tests/audits, upload raw-game artifact |
| compose-pages | GitHub-hosted Linux | Download current-run artifacts, compose byte-preserving candidate, audit/verify/runtime-smoke, emit provenance/tree manifest, upload candidate |
| deploy-pages | GitHub-hosted Linux | Wait for protected-environment approval, then deploy the already uploaded same-run candidate without checkout/build/mutation |
| production-smoke | GitHub-hosted Linux | Fetch provenance and every manifest file, then run live editorial/launcher/direct-H5 smoke |

## File Inventory

All paths are repository-relative.

| Action | Path | Purpose | Test impact |
|---|---|---|---|
| Modify | `.github/workflows/deploy-web-mobile-pages.yml` | Split site/game build, add composition and final verification, keep protected manual deploy | Workflow contract tests |
| Create | `.github/workflows/test-case-study-site.yml` | PR/push site-only checks on GitHub-hosted Linux; no Creator runner exposure | Workflow security tests |
| Modify | `game/package.json`, `game/package-lock.json` | Mirror the exact repository Node engine without changing game dependencies | Clean install/version tests |
| Modify | `site/package.json`, `site/package-lock.json` | Pin YAML workflow parser and release/browser test tooling in the owner package | Clean install/security tests |
| Create | `reference/case-study-build-toolchain.json` | Exact Node, action SHAs, Creator, lockfiles, Playwright/Chromium, and build-input contract | Reproducibility tests |
| Create | `reference/game-release-test-manifest.json` | Exact game/reconstruction tests allowed on the self-hosted job | Test-boundary checks |
| Create | `scripts/run-game-release-tests.mjs` | Execute only the checked-in game test allowlist and reject missing/duplicate entries | Workflow/unit tests |
| Create | `scripts/compose-case-study-pages.mjs` | Copy `site/dist/` and audited raw H5 into a new final tree without byte rewriting | Composition tests |
| Create | `scripts/audit-case-study-build.mjs` | Editorial/composite policy plus delegated strict raw-game subtree audit | Positive/negative audit fixtures |
| Create | `scripts/verify-case-study-pages.mjs` | Exact-base route, reference, MIME, lazy-game-boundary, and file reachability verification | Composed artifact tests |
| Create | `scripts/serve-case-study-candidate.mjs` | Read-only exact-prefix local server for digest-bound owner/editorial review | Server/path tests |
| Create | `scripts/generate-case-study-release-manifest.mjs` | Emit public commit/run/site/game/content digests and deterministic candidate file manifest | Provenance/determinism tests |
| Create | `reference/case-study-approval.schema.json` | Versioned preapproval-request and postapproval/deployment-evidence contracts | Schema/chronology tests |
| Create | `scripts/case-study-approval.mjs` | Prepare/verify candidate approval request and record actual environment/deployment evidence after the event | Approval lifecycle tests |
| Create | `scripts/run-case-study-production-smoke.mjs` | Manifest-wide live bytes/MIME plus route/launcher/H5 identity smoke | Production-smoke fixtures |
| Create | `site/scripts/validate-workflow-trust.mjs` | Parse YAML and recursively validate PR-reachable workflow/action runner trust | Adversarial workflow fixtures |
| Modify | `tests/github-pages-workflow.test.mjs` | New job graph, permissions, runner, artifact, and deploy-source contracts | Portable Node suite |
| Create | `tests/case-study-site-workflow.test.mjs` | Prove PR workflow cannot schedule self-hosted/Creator work | Portable Node suite |
| Create | `tests/compose-case-study-pages.test.mjs` | Collision, symlink, byte/hash, mount, clean-output, determinism contracts | Portable Node suite |
| Create | `tests/audit-case-study-build.test.mjs` | Allow approved forensics prose/citations; deny raw/private/executable/network payloads | Portable Node suite |
| Create | `tests/verify-case-study-pages.test.mjs` | Final route, prefix, MIME, link, and lazy payload contracts | Portable Node suite |
| Create | `tests/generate-case-study-release-manifest.test.mjs` | Self-exclusion, digest, commit/run, and mutation fixtures | Portable Node suite |
| Create | `tests/case-study-approval.test.mjs` | Request verification, observation chronology, review-history, digest mismatch, and placeholder rejection | Portable Node suite |
| Create | `tests/run-case-study-production-smoke.test.mjs` | CLI, live manifest, MIME/bytes, identity, and negative fixtures | Portable Node suite |
| Create | `site/tests/launch-journeys.spec.ts`, `site/tests/launch-accessibility.spec.ts` | Pre-public bilingual, keyboard, reduced-motion, zoom, and no-preload candidate QA | Browser/axe suite |

## Function and Interface Checklist

- [x] `composeCaseStudyPages({ siteDist, gameDist, outDir })` copies immutable trees without
  rewriting game internals.
- [x] `composeCaseStudyPages(...)` rejects a dirty/non-empty output, path collisions, symlinks,
      non-files, and any destination escape.
- [x] `auditCaseStudyBuild(outDir)` applies editorial policy to the final tree and calls the
      strict raw-game audit on `play/game/`.
- [x] `verifyGameArtifactBinding({ gameDist, evidenceSnapshot, playFacts })` requires the same
      tree digest, file count, byte count, and mount disclosure across build and content.
- [x] `verifyCaseStudyPages(outDir, { pagesPrefix })` checks every launch route in both locales
      plus `/play/` and `/play/game/`.
- [x] `verifyCaseStudyPages(...)` rejects base bypasses, missing referenced files, wrong MIME,
      eager game requests, and missing game subtree files.
- [x] `runH5RuntimeMatrix(...)` uses the Phase 6 invocation config and hard assertions for
      raw/default and nested direct-entry paths without overwriting historical reconstruction
      reports. The composed launcher path is verified separately against the real H5 subtree.
- [x] Documentary Playwright smoke separately exercises `/play/` before and after iframe load.
- [x] `generateCaseStudyReleaseManifest(...)` writes `case-study-release.json` with schema,
      commit/run/attempt/toolchain/site/game/content digests. `contentTreeDigest` excludes release
      metadata; `case-study-tree-manifest.json` lists every deployable file except itself and
      includes the release-record hash.
- [x] `prepareCandidateApprovalRequest(...)` emits a non-deployable workflow artifact binding
      commit, run/attempt, candidate artifact name, content digest, tree-manifest digest, required
      reviewer roles, and unresolved pre-public checks. It cannot contain a future approval event.
- [x] `verifyCandidateApprovalRequest(...)` reruns candidate/release/tree-manifest checks and
      rejects a changed run, commit, artifact, digest, role set, placeholder, or failed check.
- [x] `recordEnvironmentApprovalEvidence(...)` runs only after the protected review/deploy event,
      reads the authenticated environment-review/deployment history for the current run, and emits
      a separate non-deployable evidence record with reviewer/state/observation-time/source URL
      plus deployment identity. It rejects missing/pending approval and self-review by default;
      the explicit solo-owner mode accepts only the authenticated configured-owner environment
      review and records `solo-owner-self-review` without modifying the candidate.
      GitHub's run-approvals response does not expose the approval event timestamp, so the schema
      names the authenticated post-event observation time explicitly and does not synthesize a
      `reviewedAt` value from deployment status metadata.
- [x] `validateWorkflowTrust(workflowPath)` parses YAML, traverses local reusable workflows and
      composite actions, rejects `pull_request_target`, dynamic/matrix `runs-on`, PR-reachable
      self-hosted jobs, and any remote action/workflow not pinned to a full 40-hex SHA.
- [x] `runGameReleaseTests(manifest)` executes the exact game-owned list and rejects discovery
      globs, missing files, site/browser/case-study tests, and duplicate paths.
- [x] `smokeProductionPages(...)` fetches and hashes every candidate-manifest path with bounded
      concurrency/cache busting, validates acceptable live MIME, then runs route, no-preload,
      real embedded-H5, iframe reload/removal, parent DOM/navigation/storage, direct-H5, and
      provenance identity journeys at both supported viewports. The same journey runs against
      the immutable local candidate before upload and against production after deploy.
- [x] `serveCaseStudyCandidate(candidateDir, { pagesPrefix })` serves only the unpacked immutable
      tree under the real base, rejects traversal/mutation, and prints the verified
      content/tree-manifest digests reviewers must match before approval.
- [x] Workflow uploads the raw/site artifacts only as current-run inputs, uploads one immutable
      composed candidate for Pages plus owner review, and deploys no bytes before environment
      approval.

## Implementation Steps

1. Freeze `reference/case-study-build-toolchain.json`: exact `.node-version`, full action SHAs,
   Creator binary/version/hash, both package-lock hashes, Playwright package/browser revision,
   and all workflow/reusable-action identities. Mirror the exact Node engine in both
   `site/package.json` and `game/package.json`; Full-SHA comments retain the human release tag.
2. Add a site-only PR workflow on GitHub-hosted Linux. Use the exact Node patch,
   `npm ci --ignore-scripts`, explicit `npx playwright install --with-deps chromium`, generated
   data/publication validation, Astro check/build, portable content tests, and documentary
   browser smoke.
3. Parse and recursively validate the complete PR-reachable workflow graph. Allow only exact
   GitHub-hosted labels, reject `pull_request_target`, expression/matrix runner selection and
   self-hosted/reusable escape paths, and require full-SHA remote actions. Add adversarial
   workflow/reusable/composite fixtures; do not rely on source-string absence.
4. Split the manual protected-main deployment workflow into build domains:
   - site build and validation on GitHub-hosted Linux;
   - raw Cocos build and audits on the self-hosted Creator runner;
   - candidate composition, protected approval, deploy, and production smoke on GitHub-hosted
     Linux.
5. Replace the root `tests/*.mjs` glob/denylist with
   `reference/game-release-test-manifest.json` plus `run-game-release-tests.mjs`. Test the exact
   resolved set and prove every site/case-study/browser/production test is absent.
6. Keep the current raw game audit flow intact in purpose:
   - build `game/build/web-mobile-pages`;
   - run only the explicit game/reconstruction allowlist;
   - run `scripts/audit-web-build.mjs`;
   - run `scripts/verify-web-mobile-build.mjs` at the current default prefix;
   - run the hard-asserting raw/default H5 runtime matrix;
   - emit the raw-game path/size/SHA-256 tree manifest and compare exact digest/count/bytes with
     Phase 1's waiver-bound H5;
   - upload the audited raw tree as a uniquely named, per-run v4 artifact.
   Before launch, certify reproducibility with two clean builds under the frozen toolchain. Both
   must match each other and the frozen H5 digest. Any mismatch blocks release and requires an
   explicit evidence/academic-decision update; no semantic-equivalence shortcut expands the
   waiver.
   Run `node --test tests/generate-fidelity-report.test.mjs`, which already uses
   `writeOutputs: false`. Continue excluding
   `tests/generate-technical-closeout-manifest.test.mjs` on clean/self-hosted release runners
   because it requires ignored owner-held Android/H5 artifacts even with `writeOutput: false`.
   Instead run
   `node scripts/validate-case-study-publication.mjs --manifest
   reference/case-study-publication-manifest.json --verify-snapshot`, which verifies the frozen
   closeout file's path/hash/schema/status without invoking its generator or workspace-artifact
   validation. The newly built H5 is independently audited/bound by the game gate above.
7. Add the Astro build steps and site-level tests before composition:
   - content schema;
   - link/citation;
   - accessibility;
   - visual;
   - Playwright smoke;
   - About/SEO/robots/social/media and launch-journey coverage;
   - safe MDX/JSON-LD/CSP/public-source policy;
   - upload only `site/dist/` as a separate per-run artifact.
   Run two clean site builds and compare content bytes to prove there are no timestamps or other
   volatile inputs.
8. On a GitHub-hosted composition job, download exactly the two artifacts produced by the
   current run, verify their expected roots, and re-check the raw-game tree against the published
   evidence snapshot/play facts before use. Never accept a user-supplied artifact name/path.
9. Implement a small composition script that stages a new final artifact:
   - copy `site/dist/*` to the Pages root;
   - assert the Astro build already contains `/play/index.html`;
   - copy the audited raw Cocos tree byte-for-byte to `/play/game/`;
   - reject collisions, symlinks, path escapes, dirty output, or missing launch routes.
10. Run the separate composite audit, exact-prefix verifier, and Playwright/runtime smoke against
   the completed tree. Test the launcher before click (zero game requests), after click, and the
   direct nested entry at both `480×800` and `720×1280`. Require all Phase 6 audio/storage/resume/
   geometry/fullscreen/error predicates.
11. Generate `case-study-release.json` and `case-study-tree-manifest.json`. Compute:
   - site and game input digests;
   - content-tree digest excluding the two release metadata files;
   - release-record hash listed in the tree manifest;
   - tree-manifest hash emitted as a workflow output/summary.
   Bind commit SHA, run ID/attempt, exact toolchain record, snapshot ID, locale/route set, file
   count/bytes, and academic-decision ref. The manifest cannot digest itself.
12. Generate a separate `candidate-approval-request.json` from those frozen outputs. Validate it
   against `case-study-approval.schema.json` and upload it as a normal Actions review artifact.
   It records requested reviewer roles and candidate identity only; it must not fabricate an
   environment-approval reference, reviewer, time, or state.
13. Keep workflow permissions narrow:
   - build job `contents: read`;
   - deploy job `pages: write`, `id-token: write`;
   - no extra privileges on content or game build jobs.
14. Upload the verified candidate through both a normal immutable Actions artifact (for owner
   download/review) and `upload-pages-artifact`. Publish the candidate content digest,
   tree-manifest digest, routes, and artifact names in the workflow summary. Configure
   `deploy-pages` with the protected `github-pages` environment; it performs no checkout,
   download from arbitrary runs, build, composition, or mutation and waits for Phase 8 approval.
   Pin every action to a reviewed full SHA.
15. After approved deploy, query the authenticated workflow environment-review/deployment history
   for the current run and atomically emit `deployment-approval-evidence.json` as a second
   non-deployable workflow artifact. Require an actual approved state and reviewer identity before
   accepting it; provider event ID is recorded when GitHub exposes one, otherwise the stable
   run/environment review-history URL plus reviewer/state/time is the source reference.
16. Run the production smoke created here. Fetch the public release record
   and tree manifest with cache busting, compare them with the job outputs/GitHub deployment
   metadata, GET and hash every listed public file, validate acceptable live MIME, then exercise
   both H5 viewports and launcher/no-preload journeys.
17. Encode deploy failure semantics: a transient deploy-service failure may retry the dependent
    deploy job with the same audited artifact/run; build, audit, composition, or production-QA
    failure never reuses that candidate.
18. Preserve the full-rebuild rollback decision but make it hermetic: select/revert to a
    known-good protected-main commit, restore its exact toolchain/action SHAs/locks, re-run the
    entire pipeline, and require its content-tree digest to equal the previously approved digest
    before environment approval. Record that the sole Creator runner leaves rollback RTO
    unbounded during runner outage; do not claim a proven bounded rollback without a second runner.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Astro build succeeds but composed tree omits `/play/game/` | Final verifier fails |
| Critical | Raw game build succeeds but game subtree is copied to wrong mount | Final verifier fails |
| Critical | Workflow deploys raw game tree instead of composed Pages tree | Workflow test fails |
| Critical | Newly built H5 digest/count/bytes differ from the site disclosure or waiver record | Artifact binding fails |
| Critical | About/SEO/robots/social/launch test source is absent at composition time | Site/candidate gate fails |
| Critical | Self-hosted runner is used for site build or composition | Workflow test fails |
| Critical | Pull request content can reach a self-hosted runner | Workflow security test fails |
| Critical | PR workflow hides runner choice in expression/matrix/reusable workflow or uses `pull_request_target` | Parsed trust graph fails |
| Critical | Any action/reusable workflow uses a mutable tag instead of full SHA | Toolchain/workflow gate fails |
| Critical | Deploy begins before exact candidate environment approval | Workflow/environment gate fails |
| Critical | Preapproval request claims an approval event, or postapproval record lacks real review history | Approval lifecycle validation fails |
| Critical | Approval request/evidence references a different run, artifact, commit, or digest | Release blocked |
| High | Root route still serves the game instead of Astro | Route verification fails |
| High | `/play/` launcher cannot reach nested iframe game | Runtime smoke fails |
| High | Composed artifact contains off-prefix or root-absolute links | Final verifier fails |
| High | Raw game audit is weakened or repurposed into a site audit | Audit contract test fails |
| High | Safe external citation is rejected, or off-origin script/media is accepted | Composite audit fixture fails |
| High | Site/game artifact comes from a different workflow run | Artifact identity contract fails |
| High | Game job discovers a new root/site test outside explicit allowlist | Test-boundary gate fails |
| High | Clean runner invokes artifact-bound technical-closeout generator/test or writes historical output | Test-boundary/snapshot gate fails |
| High | Raw or site clean rebuild changes bytes under the same frozen inputs | Reproducibility certification fails |
| Medium | Composed artifact changes bytes without source change | Determinism test fails |
| Medium | Final deploy runs before both build jobs pass | Workflow order test fails |
| High | Deploy retry rebuilds a different artifact after a service-only timeout | Workflow/release contract fails |
| Critical | Production serves prior/wrong commit or any manifest file has wrong bytes/missing response | Production smoke fails |
| High | Local synthetic MIME passes but Pages returns unacceptable MIME for a listed file | Production smoke fails |

## Todo List

- [x] Freeze exact build toolchain and full action SHAs.
- [x] Split the workflow into site, game, compose, approval/deploy, and production-smoke stages.
- [x] Add the GitHub-hosted-only site PR workflow.
- [x] Add parsed transitive workflow-trust policy and adversarial fixtures.
- [x] Replace root test discovery with an exact game-owned manifest.
- [x] Add artifact composition script and tests.
- [x] Add separate composed audit and exact-base verifier.
- [x] Run configured runtime matrix for composed `/play/` and `/play/game/` smoke.
- [x] Generate public release provenance/tree manifests and expose approval digests.
- [x] Add frozen approval request/verifier/recorder tooling and separate post-event evidence.
- [x] Add manifest-wide live bytes/MIME/identity production smoke.
- [x] Keep the raw game verifier behavior unchanged in purpose.
- [x] Update workflow contract tests for the new job graph.
- [x] Verify final artifact path and deployment permissions in workflow contracts.

## Success Criteria

- [x] Site build and game build run on their proper runners.
- [x] The raw game tree is audited before merge.
- [x] All launch source—including About, SEO/robots/social media, and QA tools—exists before
      composition.
- [x] A local immutable candidate serves `/`, content pages, `/play/`, and `/play/game/`.
- [x] Environment approval is visibly bound to candidate content/tree-manifest digests, and
      deployment uses only that immutable artifact.
- [x] Repository/API inspection proves the `github-pages` environment has the required reviewer
      and protected-main deployment policy before any candidate is approved.
- [x] Preapproval request and postapproval evidence are separate, schema-valid, digest-bound
      artifacts; neither is part of or mutates the deployable candidate.
- [x] Public provenance binds expected commit/run/site/game/content/tree digests and is verified
      against GitHub deployment metadata.
- [x] Every manifest-listed production file is reachable with acceptable MIME and matching bytes.
- [x] The current clean-room boundary remains intact and there is no bridge back to the source
  APK or native runtime.
- [x] A rollback drill proves a full pinned rebuild reproduces the known-good content digest;
      documentation explicitly states the single-runner RTO limitation.

Completion evidence: workflow
[`30190536530`](https://github.com/dantech0xff/pencil-blade-2026/actions/runs/30190536530)
passed the split runners, duplicate deterministic builds, raw/composed audits, runtime matrices,
authenticated environment gate, immutable deployment, and manifest-wide production smoke. The
same pinned source was also rebuilt and smoked locally before release; later content-digest
changes came only from reviewed source changes. See the
[launch QA report](./reports/launch-qa-report.md).

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Workflow drift breaks protected release gates | Deployment blocked or unsafe | Contract tests on job order, permissions, and artifact paths |
| Composition rewrites game URLs incorrectly | Broken nested iframe runtime | Keep game subtree copy-only; verify nested path reachability |
| Shared-origin storage blurs site/game boundaries | Privacy and state coupling | Explicit storage namespace, no implicit parent-child DOM access |
| Final tree verification becomes too weak | Broken Pages site passes CI | Separate composite audit + exact-base route/reference verifier |
| New root tests silently run on the Creator runner | Slower or failing privileged build | Explicit game-owned test allowlist and workflow contract test |
| Artifact mix-up crosses commits/runs | Unreviewed output deployed | Compose only dependencies from current run with fixed artifact names |
| Self-hosted runner receives non-game work | Trust boundary violation | Separate job ownership and runner labels |
| Indirect workflow escapes string-based checks | Untrusted PR reaches owner machine | Parsed recursive workflow/action graph + full-SHA pins |
| Browser tooling resolves local workstation defaults | Linux job hangs or false-passes | Exact Node, locked Playwright Chromium, explicit CI inputs, failure cleanup |
| Pages hosting drops/mis-types a lazy file | Late game-mode failure | GET/hash/MIME every candidate-manifest file in production |
| Sole Creator runner is offline during rollback | No bounded recovery time | Pre-release health check, accepted best-effort RTO, optional second pinned runner |
| Release-rights gate gets conflated with deploy gate | Unclear approval state | Keep `verify-release-rights.mjs` separate and out of the technical deploy path |

## Security and Rights Considerations

- Do not allow the site build to copy raw APK, `libgame.so`, decompiler output, or native
  bridge artifacts into the Pages tree.
- Preserve the academic/owner-approved Pages boundary as a technical deploy, not a rights
  conclusion.
- Do not introduce analytics, ads, or external scripts in the launch path.
- Keep the game iframe on the same origin only because the deployment target requires it. It is
  not a security boundary; keep the parent stateless/secret-free and fail parent/top/storage
  coupling tests.
- Keep the self-hosted Creator runner isolated from site authoring content and untrusted PRs.

## Rollback

Rollback means:

1. Revert or select the last known-good commit.
2. Restore the exact Node patch, action SHAs, Creator binary/hash, lockfiles, and toolchain record
   owned by that commit.
3. Re-run the complete split site/game builds on their pinned runners.
4. Re-compose and require the rebuilt content-tree digest to equal the prior approved digest.
5. Re-deploy only after all current gates and protected environment approval pass.

Do not patch a broken deployment artifact in place. If the composed artifact is bad, treat it as
an invalid build, not a mutable release object. A same-run retry is allowed only when the audited
artifact succeeded and the deploy service alone failed. With one Creator runner this has no
guaranteed RTO during runner outage; the launch checklist must acknowledge that fact.

## Next Steps

- Freeze the workflow graph and one immutable candidate in Phase 7.
- Keep Phase 8 focused on exact-candidate human approval, environment release, production smoke,
  and evidence-backed documentation; it adds no launch source.
- Do not expand scope into custom domain or analytics during this phase.
