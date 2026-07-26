# Red-Team Failure-Mode Plan Review

## Review scope

- Lens: Full-tier Flow Tracer / Murphy's Law.
- Plan reviewed: `plan.md` and all `phase-01` through `phase-08` files, refreshed after the in-review rights/snapshot edits.
- Runtime/release path inspected: workflow dispatch → protected-main guard → Creator build → tests → raw audit → prefix verification → artifact upload → Pages deploy; planned site/game split → composition → nested H5 runtime → production smoke → rollback.
- Read-only implementation evidence: `.github/workflows/deploy-web-mobile-pages.yml`, `game/build-configs/web-mobile-pages.json`, `scripts/audit-web-build.mjs`, `scripts/verify-web-mobile-build.mjs`, `scripts/run-h5-runtime-matrix.mjs`, `scripts/generate-technical-closeout-manifest.mjs`, relevant tests, generated H5 entry HTML, and build/compatibility docs.
- Commands deliberately not run: lint, build, and test, per the plan-review assignment.

## Flow verification summary

- Flows traced: 4 — current raw-game release, planned site build, planned game build, and composed deploy/live-runtime flow.
- Existing guard/branch families inspected: 12 — event/ref, toolchain, output cleanup, Creator exit status, portable-test selection, raw-file policy, essential payload, prefix routing, unchanged-file hash, MIME, browser/runtime state, and deploy dependency.
- Findings: 9 total — 1 Critical, 6 High, 2 Medium.
- Disposition: reject the plan for execution until the Critical dependency cycle and High runtime/release gaps are resolved.

## Findings

### 1. Phase 7 requires and deploys files that Phase 8 has not created

- **Severity:** Critical
- **Location:** Phase 7 Architecture, Function Checklist, and deployment steps; Phase 8 Overview, File Inventory, and Release Rule.
- **Flaw:** Phase 7's composed artifact already requires `/about/*`, verifies every launch route, and deploys the result. Phase 8 depends on Phase 7 but is where `/about/`, robots, SEO mappings, social previews, favicons, and launch tests are first created. Phase 8 simultaneously says it adds no new routes and operates on the artifact Phase 7 already produced. This is a hard dependency cycle, not editorial cleanup.
- **Failure scenario:** Phase 7 either fails because `/about/` is absent, weakens its route verifier and publishes an incomplete artifact, or passes against one commit and becomes stale as soon as Phase 8 adds source files. Phase 8 then cannot truthfully call its result a redeploy of the same known-good commit/artifact pair.
- **Evidence:**
  - Plan: `plan.md:36-37` includes `/about/` in launch routes; `phase-07-unify-testing-build-and-github-pages-deployment.md:120-128` includes `/about/*` in the final artifact before deploy; `phase-07-unify-testing-build-and-github-pages-deployment.md:167-174` requires every launch route before upload.
  - Plan contradiction: `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:32-35` says Phase 8 adds no routes after deployment, while `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:129-148` creates `/about/`, SEO, robots, media, tests, scripts, and docs; `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:119-123` says it accepts only Phase 7's artifact.
  - Actual release path: `.github/workflows/deploy-web-mobile-pages.yml:143-163` uploads one finished tree and immediately deploys it; there is no post-deploy source augmentation path.
- **Suggested fix:** Split launch work into a pre-deploy phase and a post-deploy verification phase. Move `/about/`, SEO/robots/social assets, launch browser tests, publication/media updates, and owner/editorial/translation inputs before Phase 7. Let Phase 7 build and deploy that frozen source. Keep Phase 8 read-only except for the QA report and verified documentation updates, or introduce explicit `8a → 7 → 8b` dependencies.

### 2. The H5 runtime gate can report `pass` with suspended audio, lost storage, or a dead resumed canvas

- **Severity:** High
- **Location:** Phase 6 runtime-matrix contract; Phase 7 runtime smoke; current H5 matrix implementation.
- **Flaw:** The current runner asserts only that some audio backend object exists. It records storage retention and post-resume canvas visibility but never asserts either. Every row then receives `status: 'pass'`, and the overall report passes by checking only row status. The planned changes parameterize paths; they do not require correcting these pass predicates.
- **Failure scenario:** The nested iframe creates a suspended `AudioContext`, browser lifecycle handling loses `localStorage`, or the canvas stays invisible after background/foreground. No page error or request failure occurs. The runner writes a passing report and Phase 7 deploys the broken H5.
- **Evidence:**
  - Plan: `phase-06-integrate-playable-h5-game-experience.md:112-116` limits the runtime-runner change/tests to options and route contracts; `phase-07-unify-testing-build-and-github-pages-deployment.md:208-210` treats the runtime smoke as a deployment gate.
  - Actual runner: `scripts/run-h5-runtime-matrix.mjs:245-250` accepts any created audio backend regardless of state; `scripts/run-h5-runtime-matrix.mjs:252-275` records but does not assert the storage sentinel; `scripts/run-h5-runtime-matrix.mjs:335-358` records resume visibility and then unconditionally returns `status: 'pass'`; `scripts/run-h5-runtime-matrix.mjs:404-426` derives overall pass only from row status.
  - Actual test quality: `tests/runtime-matrix-runner.test.mjs:20-28` merely regex-matches that audio, storage, viewport, and error APIs occur in source.
- **Suggested fix:** Make each runtime property a hard assertion: post-input audio must be `running` (or a verified HTMLAudio playback outcome), the sentinel must survive lifecycle, resumed canvas must be visible, restored geometry must pass, and all bad responses must be empty. Add negative behavioral tests that force each failure. Run the same assertions inside the launcher iframe, including parent visibility changes, iframe reload/removal, fullscreen enter/exit, and return navigation.

### 3. The Linux composition job has no executable runtime dependency contract, and the current failure path leaks its server

- **Severity:** High
- **Location:** Phase 6 runtime-runner parameterization; Phase 7 `compose-pages` responsibility; current H5 runner resource ordering.
- **Flaw:** Phase 7 assigns runtime smoke to GitHub-hosted Linux, but the current runner defaults to a macOS Chrome binary and a user-specific `/Users/dan/.../node_modules` bundle. Phase 6 says to remove machine defaults in CI but does not specify a pinned Linux browser install, Playwright module source, workflow install step, or CLI validation. Worse, the runner starts its loopback server before loading Playwright/launching Chrome, while cleanup begins only after launch succeeds.
- **Failure scenario:** On `ubuntu-latest`, `createRequire` cannot find the hard-coded module directory or Chrome cannot launch. The exception occurs after `server.listen()` but before the `try/finally`; the open server keeps Node alive and the composition job hangs until timeout instead of failing cleanly.
- **Evidence:**
  - Plan: `phase-06-integrate-playable-h5-game-experience.md:112-130` mentions CI path inputs but no browser/module dependency; `phase-07-unify-testing-build-and-github-pages-deployment.md:131-138` assigns runtime smoke to GitHub-hosted Linux.
  - Actual runner dependencies: `scripts/run-h5-runtime-matrix.mjs:24-29` hard-codes macOS/user paths; `scripts/run-h5-runtime-matrix.mjs:60-63` loads Playwright from that external directory; `scripts/run-h5-runtime-matrix.mjs:369-397` selects those defaults and launches Chrome.
  - Actual error boundary: `scripts/run-h5-runtime-matrix.mjs:380-397` starts the server before module load/browser launch; the cleanup `finally` does not begin until `scripts/run-h5-runtime-matrix.mjs:399-434`.
- **Suggested fix:** Pin Playwright and its browser in `site/package-lock.json`, install them explicitly in `compose-pages`, and require explicit CI browser/module inputs with existence/version checks. Put server creation, Playwright loading, and browser launch under one cleanup boundary using nullable handles so every partial initialization closes. Add failure-injection tests for missing module, bad executable, and launch failure.

### 4. The MIME gate tests a synthetic server's own headers, not GitHub Pages, and live all-file reachability is not preserved

- **Severity:** High
- **Location:** Phase 7 composed verifier; Phase 8 production smoke; current prefix verifier and audit documentation.
- **Flaw:** The local verifier manufactures `Content-Type` from the same table it later uses as the expected value. That proves internal consistency, not GitHub Pages behavior. The current release evidence separately checked all 2,539 live files, but Phase 8's planned production smoke promises routes, identity, lazy loading, and two H5 journeys—not a manifest-wide live status/MIME check.
- **Failure scenario:** GitHub Pages serves one lazy `.wasm`, `.cconb`, JSON, font, or media file with an unusable MIME type, or omits a file during publication. Local verification passes. The two Classic journeys do not request the affected mode-specific asset, so production smoke also passes; a later mode fails in public.
- **Evidence:**
  - Plan: `phase-07-unify-testing-build-and-github-pages-deployment.md:167-170` defines the local exact-MIME verifier; `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:160-161` and `:193-195` define live smoke without an all-file MIME/reachability requirement.
  - Actual verifier: `scripts/verify-web-mobile-build.mjs:159-169` sets MIME headers itself; `scripts/verify-web-mobile-build.mjs:269-280` compares the response to the same `contentTypeForWebPath` mapping.
  - Existing production bar: `docs/cocos-creator-build-audit.md:112-119` records 2,539/2,539 live reachability; `docs/compatibility-matrix.md:32-35` states every eager/lazy file was checked.
- **Suggested fix:** Make production smoke walk the final tree manifest and query every public URL with cache-busting. Assert status, expected media type, length, and digest where practical; at minimum GET and hash all files whose hosting behavior is material. Preserve the existing all-file production-reachability gate instead of replacing it with two Classic journeys.

### 5. The chosen rollback strategy has an unclosed single-runner recovery dependency

- **Severity:** High
- **Location:** Phase 7/8 rollback sections; current infrastructure evidence.
- **Flaw:** The explicit product decision is full rebuild/redeploy from a known-good protected commit. This review does not reverse that decision. The plan nevertheless calls rollback “proven” without defining an RTO or providing redundancy for the only Creator runner, even though the recorded runner already suffered a broker/listener outage.
- **Failure scenario:** A composed release breaks production while the sole self-hosted runner is offline or Creator cannot launch. The known-good source exists, but the mandated complete rebuild cannot start, so rollback is unavailable for the duration of the infrastructure incident.
- **Evidence:**
  - Plan decision: `plan.md:177-181` rejects artifact-only rollback; `phase-07-unify-testing-build-and-github-pages-deployment.md:263-264` requires rollback to be proven; `phase-07-unify-testing-build-and-github-pages-deployment.md:290-301` requires the full pinned pipeline.
  - Actual runner dependency: `.github/workflows/deploy-web-mobile-pages.yml:16-27` targets the one labeled macOS/ARM64 Creator installation.
  - Actual failure history: `docs/cocos-creator-build-audit.md:130-141` records one repository-scoped runner plus a broker incident, listener restart, and transient GitHub failures.
- **Suggested fix:** Keep the rebuild decision but add and exercise a second identically pinned runner, define recovery ownership/RTO, and run a rollback drill before claiming proof. If the owner wants a lower RTO instead, present a separate decision to retain and redeploy a hash-verified Pages artifact; that would intentionally change the current no-artifact-rollback decision.

### 6. The self-hosted test boundary remains vulnerable to later root-test additions

- **Severity:** High
- **Location:** Phase 7 game-job test selection; Phase 8 root tests; current workflow glob.
- **Flaw:** The current game job discovers every `tests/*.mjs` and excludes only five named local tests. Phase 7 says to run a game-owned allowlist but defines no directory, manifest, or stable selector. Phase 8 later adds another root-level production/site test without modifying the workflow. A brittle glob/skip implementation either executes site/network tooling on the privileged Creator runner or silently stops running new game tests.
- **Failure scenario:** `tests/run-case-study-production-smoke.test.mjs` lands after the Phase 7 workflow split. The self-hosted job still expands `tests/*.mjs`; it now installs/executes site or network behavior on the protected runner, violating the runner boundary and potentially hanging deployment.
- **Evidence:**
  - Plan: `phase-07-unify-testing-build-and-github-pages-deployment.md:185-192` requires a game-owned test allowlist but does not define one; `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:135-137` later creates root-level site/production tests.
  - Actual workflow: `.github/workflows/deploy-web-mobile-pages.yml:102-124` loops over every `tests/*.mjs` and uses a five-file exclusion list.
  - Actual contract test: `tests/github-pages-workflow.test.mjs:50-59` proves only that the current exclusion strings exist, not that the executed set is game-owned.
- **Suggested fix:** Give portable game tests a dedicated directory or checked-in manifest consumed by the workflow. Make the workflow test resolve and assert the exact executed set, and add a negative assertion that every `case-study`, `site`, `production-smoke`, and browser test is absent from the self-hosted command.

### 7. `expectedCommit` is not observable from the public artifact

- **Severity:** High
- **Location:** Phase 7 tree manifest; Phase 8 production identity check; current artifact/deployment metadata.
- **Flaw:** Phase 7's deterministic manifest is specified as path, size, and SHA-256 only. Phase 8 promises to verify an `expectedCommit`, but no planned public provenance record or deployment-API comparison binds that commit to the fetched tree. A self-consistent old artifact can satisfy route/tree checks while being the wrong commit.
- **Failure scenario:** A deploy service retry or cache serves the prior composed tree. Its own manifest and files match each other, all smoke tests pass, and the script cannot prove that the bytes came from the requested commit.
- **Evidence:**
  - Plan: `phase-07-unify-testing-build-and-github-pages-deployment.md:203-207` specifies only path/size/SHA in the final manifest; `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:159-161` and `:193-195` require expected-commit identity without defining its source.
  - Actual workflow: `.github/workflows/deploy-web-mobile-pages.yml:143-163` uploads generated files but injects no commit marker.
  - Existing evidence is out-of-band: `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/production-pages/production-pages-runtime.json:5-10` records run, attempt, commit, environment, and deployment ID in a local report, not in the public artifact.
- **Suggested fix:** Generate a release-provenance record containing `github.sha`, run ID, run attempt, site artifact digest, game artifact digest, composed digest, and schema version. Exclude the record from its own digest or use a signed sidecar. Production smoke must compare both the fetched record and GitHub deployment metadata to the expected commit, with cache-busting.

### 8. Phase 5 reintroduces mutable “current reports” into a hash-frozen evidence pipeline

- **Severity:** Medium
- **Location:** Plan/Phase 2 evidence snapshot contract; Phase 5 AI index generation.
- **Flaw:** The program now correctly freezes all evidence inputs by commit/path/SHA, but Phase 5 still instructs its generator to use the publication manifest and “current authoritative reports.” That wording creates a second, mutable read path in the same generator Phase 2 made snapshot-bound.
- **Failure scenario:** An authoritative report changes without a publication-snapshot version bump. AI Lab facets/statuses regenerate from the changed report while chapter facts remain frozen. Both outputs are individually well-formed, but English/Vietnamese evidence cards and chapter claims disagree.
- **Evidence:**
  - Plan contract: `plan.md:40-41`; `phase-02-build-astro-platform-and-content-pipeline.md:41-42`, `:56-60`, and `:141-146` require snapshot-verified inputs.
  - Conflicting plan step: `phase-05-build-ai-lab-and-evidence-explorer.md:157-158` says to generate from “current authoritative reports”; `:117-118` modifies the shared generator/validator.
  - Actual precedent: `scripts/generate-technical-closeout-manifest.mjs:17-34` reads mutable fixed paths directly, and `:83-94` loads their current bytes. That pattern is exactly what the new snapshot contract is meant to prevent.
- **Suggested fix:** Replace “current authoritative reports” with the exact Phase 1 snapshot inputs. Require the AI index builder to accept `evidenceSnapshot`, verify every source hash before deriving records, and add a negative fixture where a report changes without a snapshot-version bump.

### 9. Phase 8 creates public media but owns no manifest mutation

- **Severity:** Medium
- **Location:** Phase 1 media contract; Phase 8 social/favicons and launch-rights validator.
- **Flaw:** Phase 1 says every planned media item is bound to an explicit publication state. Phase 8 creates final-title-dependent social previews and favicons and calls `validateLaunchRights(publicationManifest, mediaManifest)`, but its File Inventory neither modifies the Phase 1 publication manifest nor creates a media manifest. “Media manifest/size tests” have no owned source of truth.
- **Failure scenario:** The final title/credits change the social assets after Phase 1. The launch either fails on unknown media IDs, bypasses the allowlist to ship them, or validates a stale manifest whose hashes do not match the emitted English/Vietnamese previews.
- **Evidence:**
  - Plan media contract: `phase-01-establish-public-narrative-and-evidence-contract.md:64-69`, `:105-117`, and `:145-155` place media records in `reference/case-study-publication-manifest.json`.
  - Missing owner: `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:129-148` creates social/favicons but lists no publication/media manifest change; `:158-159` nevertheless expects both manifests.
  - Actual rights records contain no case-study preview category: `docs/release-rights-checklist.md:15-24` lists only the current source/recovered/runtime categories.
- **Suggested fix:** Add an explicit Phase 8 modification to `reference/case-study-publication-manifest.json`, or define a versioned `reference/case-study-media-manifest.json` in Phase 1 and make Phase 8 own its final records. Require exact emitted hash, dimensions, locale/route mapping, provenance, transformation history, and project-authored/waiver state before the site build.

## Required plan changes before execution

1. Break the Phase 7/8 build-deploy cycle; all source/media/routes must exist before the deployment phase.
2. Turn H5 audio, storage, lifecycle, and iframe state into hard pass/fail predicates.
3. Define a reproducible Linux Playwright/Chrome install and close all partially initialized runtime resources.
4. Preserve manifest-wide live Pages reachability/MIME verification.
5. Close rollback availability under loss of the sole Creator runner.
6. Replace root test globbing with an enforceable game-owned test boundary.
7. Make commit/run provenance observable and independently verifiable in production.
8. Remove mutable-report reads and assign an explicit owner to final media-manifest changes.

## Unresolved questions

- Is a non-public preview/staging target available? The plan says to keep incomplete launch inputs “in preview,” but defines only the production GitHub Pages URL.
- What rollback RTO is acceptable while retaining the explicit full-rebuild-only decision?
- Will production identity be verified through a public provenance record, GitHub deployment metadata, or both?

Status: DONE_WITH_CONCERNS

Summary: Latest plan reviewed after rights/snapshot updates. One Critical phase dependency cycle and six High production-flow defects remain.

Concerns/Blockers: Phase 7 cannot produce its required artifact before Phase 8 creates required source; runtime pass semantics, Linux runner dependencies, live MIME coverage, rollback availability, test isolation, and production provenance are not yet closed.
