# Red-Team Scope & Complexity / Contract Verification Review

## Scope

- Plan: `plans/260725-2334-pencil-blade-interactive-case-study/plan.md` and Phases 1–8.
- Review lens: hostile Scope & Complexity Critic.
- Verification role: Full-tier Contract Verifier. All 66 named function/interface checklist bullets were inspected, and the requested existing call graphs were exhaustively searched.
- Runtime evidence read: `scripts/verify-web-mobile-build.mjs`, `scripts/run-h5-runtime-matrix.mjs`, `scripts/audit-web-build.mjs`, `.github/workflows/deploy-web-mobile-pages.yml`, `game/package.json`, and current callers/tests.
- Review only. No plan, source, workflow, config, or test was changed.
- Tests/build/lint were not run because this is a plan-contract review, not implementation validation.

## Overall Assessment

Do not implement the current phase graph unchanged. One phase-order defect makes the stated final-artifact gate impossible, and the advertised parallel work has overlapping file ownership. The two planned public interface changes do not enumerate all current callers, helper-level prefix dependencies, CLI contracts, workflow tests, or downstream runtime-report consumers. The publication pipeline also risks creating a second canonical claim system and has no executable localization shape for evidence records.

The explicit product decisions are not under review: full English plus reviewed Vietnamese, the exact owner-approved academic Pages waiver scope, a static-only reconstruction narrative, and the playable game remain required.

## Critical Issues

### 1. Phase 8 changes launch source after Phase 7 verifies and deploys the “final” artifact

- **Severity:** Critical
- **Location:** phase ordering and release contract.
- **Evidence:**
  - Phase 7 requires manual deployment and uploads only the composed artifact: `phase-07-unify-testing-build-and-github-pages-deployment.md:73-77`, `phase-07-unify-testing-build-and-github-pages-deployment.md:208-220`.
  - Phase 7's final tree and verifier already include `/about/`: `phase-07-unify-testing-build-and-github-pages-deployment.md:120-128`, `phase-07-unify-testing-build-and-github-pages-deployment.md:167-174`.
  - `/about/` does not exist until Phase 8 creates it. Phase 8 also creates SEO data, robots, social assets, browser tests, and the production-smoke script: `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:125-148`.
  - Phase 8 says it “does not add ... new routes” and accepts only the already composed Phase 7 artifact: `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:30-35`, `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:119-123`.
  - Phase 8 then requires owner, attribution, correction-channel, and Vietnamese-review inputs before release: `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:163-167`.
  - The current workflow has no candidate/staging state; upload flows directly to the one production deploy job: `.github/workflows/deploy-web-mobile-pages.yml:140-163`.
- **Failure scenario:** Phase 7 cannot pass its own route verifier because `/about/` is not created yet. If that check is weakened, Phase 7 deploys an artifact that Phase 8 subsequently changes, so Phase 8 is no longer reviewing the artifact that was verified or deployed. Owner/translation/rights failures occur after the public site was replaced.
- **Required plan correction:** Move all launch source work (`about`, SEO/robots, social assets, launch tests, smoke script) before final composition. Make Phase 7 produce and retain one immutable candidate. Run Phase 8 pre-deploy review against that exact tree hash, authorize it, then deploy the same bytes. Keep only narrow post-deploy smoke after deployment.

## High Priority

### 2. Phases 4–6 are not parallel-safe; the plan's ownership claim is false

- **Severity:** High
- **Location:** dependency graph and file ownership.
- **Evidence:**
  - The plan says Phases 4, 5, and 6 may run concurrently because ownership is separate: `plan.md:124-133`.
  - All three modify `site/src/data/routes.ts` and `scripts/validate-case-study-content.mjs`: `phase-04-produce-story-forensics-and-reconstruction-chapters.md:120-123`, `phase-05-build-ai-lab-and-evidence-explorer.md:113-119`, `phase-06-integrate-playable-h5-game-experience.md:108-116`.
  - Phases 5 and 6 both modify `site/src/layouts/base-layout.astro` and `scripts/generate-case-study-data.mjs`: `phase-05-build-ai-lab-and-evidence-explorer.md:113-118`, `phase-06-integrate-playable-h5-game-experience.md:108-111`.
  - The elapsed estimate relies on this parallelism: `plan.md:137-147`.
- **Failure scenario:** Parallel implementers resolve shared-file conflicts independently. One route family, validator rule set, generated index, or layout hook is silently dropped. Phase 7 tests the merged result but cannot prove which policy branch disappeared unless it already knows the complete expected rule registry.
- **Required plan correction:** Give the four shared files one integration owner. Either serialize a short integration phase after domain-owned Phase 4–6 outputs or define domain-owned fragments consumed by one aggregator established before parallel work. Recalculate the dependency graph and elapsed estimate. Do not claim separate ownership while listing shared modifications.

### 3. Prefix parameterization stops at the top-level signatures and misses the actual contract surface

- **Severity:** High
- **Location:** Phase 6 verifier interface.
- **Evidence:**
  - The plan changes only `verifyWebMobileBuild(buildDirectory, { pagesPrefix })` and `runH5RuntimeMatrix(options)`: `phase-06-integrate-playable-h5-game-experience.md:112-130`.
  - Prefix behavior is currently closed over module-global `PAGES_PREFIX`: `scripts/verify-web-mobile-build.mjs:19-20`.
  - `verifyWebMobileBuild` uses that global for negative routes, root request, outside-prefix filtering, and result output: `scripts/verify-web-mobile-build.mjs:35-55`, `scripts/verify-web-mobile-build.mjs:66-130`.
  - `createPagesPrefixServer()` and its private route mapper use the same global but accept no prefix: `scripts/verify-web-mobile-build.mjs:136-183`, `scripts/verify-web-mobile-build.mjs:197-230`.
  - `pagesUrlForPath()` accepts only a relative path and also uses the global: `scripts/verify-web-mobile-build.mjs:178-183`.
  - The runtime matrix imports the same global and navigates/reports/filters with it: `scripts/run-h5-runtime-matrix.mjs:14-20`, `scripts/run-h5-runtime-matrix.mjs:202-205`, `scripts/run-h5-runtime-matrix.mjs:369-426`.
- **Failure scenario:** The new verifier returns the requested nested prefix while the server, URL mapper, route mapper, runtime navigation, or request filter still uses `/pencil-blade-2026/`. A partial implementation produces nested 404s or tests the old route and reports a false pass. Making the exported global mutable would create test-order and concurrent-invocation races.
- **Required plan correction:** Define one immutable invocation config containing at least `pagesPrefix` and `entryPath`; validate/normalize it once and thread it through `verifyWebMobileBuild`, `createPagesPrefixServer`, `pagesUrlForPath`, the private route mapper, `runViewport`, report generation, request-boundary checks, and both CLIs. Retain the existing prefix only as the entry-point default. Update every caller listed in the census below.

### 4. The runtime-matrix change omits its CLI, current test, canonical report schema, and downstream consumers

- **Severity:** High
- **Location:** Phase 6–7 runtime interface.
- **Evidence:**
  - The current exported function accepts an options object, but its CLI always calls it with no arguments: `scripts/run-h5-runtime-matrix.mjs:369-378`, `scripts/run-h5-runtime-matrix.mjs:437-443`.
  - Browser navigation still hard-codes `PAGES_PREFIX`: `scripts/run-h5-runtime-matrix.mjs:202-205`.
  - The only current runner contract test reads source and regex-matches strings; it does not import or invoke the entry point: `tests/runtime-matrix-runner.test.mjs:1-30`.
  - Phase 6 creates `tests/run-h5-runtime-matrix.test.mjs` but does not list the current `tests/runtime-matrix-runner.test.mjs` for update or retirement: `phase-06-integrate-playable-h5-game-experience.md:112-116`.
  - The canonical H5 report is a fixed input to fidelity generation: `scripts/generate-fidelity-report.mjs:17-30`, `scripts/generate-fidelity-report.mjs:162-187`.
  - The same fixed report path and shape feed technical closeout, including build identity and row semantics: `scripts/generate-technical-closeout-manifest.mjs:17-30`, `scripts/generate-technical-closeout-manifest.mjs:60-81`, `scripts/generate-technical-closeout-manifest.mjs:88-98`, `scripts/generate-technical-closeout-manifest.mjs:180-197`.
  - Their current tests assert the fixed digest, rows, and report path: `tests/generate-technical-closeout-manifest.test.mjs:36-76`, `tests/generate-technical-closeout-manifest.test.mjs:79-98`.
  - The current deployment workflow does not run `run-h5-runtime-matrix.mjs`; it stops at static audit/prefix verification: `.github/workflows/deploy-web-mobile-pages.yml:133-146`.
- **Failure scenario:** Phase 7 claims nested runtime smoke while CI still invokes a no-argument CLI, or a nested run overwrites the canonical legacy report. Fidelity/closeout then either consume incompatible fields or continue publishing the old root-mount proof as if it covered the composed launcher.
- **Required plan correction:** Specify the exact CLI grammar, option normalization, exit codes, report schema version, and output identity. Preserve the old raw-H5 report as historical reconstruction evidence. Emit a separately named composed/nested case-study report. Update the current source-regex test, new behavioral test, workflow and workflow tests, publication-data consumer, and—only if the canonical schema/path changes—fidelity/closeout generators and their tests.

### 5. The publication manifest can fork the existing canonical claim ledger

- **Severity:** High
- **Location:** Phase 1–2 content authority.
- **Evidence:**
  - The plan gives the new publication claim record its own ID, locale, status, copy, source refs, and proof refs: `phase-01-establish-public-narrative-and-evidence-contract.md:56-75`.
  - Phase 2 creates another Evidence record with its own status, claim, explanation, source refs, proof refs, and rights state: `phase-02-build-astro-platform-and-content-pipeline.md:101-116`.
  - `CLM-*` already means a canonical claim in `forensics/claims.jsonl`, and its evidence refs resolve through the evidence register: `docs/evidence-register.md:7-14`.
  - The existing schema already owns canonical status, evidence refs, confidence, contract eligibility, contradictions, reviewer, and review date: `forensics/claims.schema.json:7-18`, `forensics/claims.schema.json:20-79`.
  - The existing policy validator binds the claim ledger and evidence register: `tests/reconstruction-policy-test.sh:7-25`, `tests/reconstruction-policy-test.sh:57-82`.
  - Fidelity freezes both the canonical claim ledger and schema: `scripts/generate-fidelity-report.mjs:37-54`.
- **Failure scenario:** A localized publication record keeps a valid `CLM-*` ID but changes status or evidence refs. The site and explorer publish the projection while the reconstruction policy/fidelity system continues to validate the canonical ledger. Both systems pass independently and disagree publicly.
- **Required plan correction:** Model the new record as a `claimPresentation` projection keyed by mandatory `canonicalClaimId`. Derive canonical status, evidence tier, refs, contradictions, and confidence from the existing ledger. Author only locale-specific public copy, ordering, redaction, and display qualifiers. Reject unknown IDs and any author-supplied canonical-field override. Keep the exact academic-waiver data in a separate scoped publication-decision record; do not fold it into canonical technical claim status.

### 6. Full Vietnamese evidence parity has no implementable data shape

- **Severity:** High
- **Location:** Phase 1, Phase 2 Evidence contract, Phase 5 evidence routes.
- **Evidence:**
  - Phase 1 says a claim record has `locale` and validation requires locale coverage: `phase-01-establish-public-narrative-and-evidence-contract.md:62-64`, `phase-01-establish-public-narrative-and-evidence-contract.md:121-131`.
  - Phase 2's Chapter and AI Episode records include `locale`, but its Evidence record does not: `phase-02-build-astro-platform-and-content-pipeline.md:101-116`.
  - Phase 5 creates English and Vietnamese evidence detail routes and promises shared records: `phase-05-build-ai-lab-and-evidence-explorer.md:101-119`.
  - Phase 5 then proposes `validateLocaleParity(en, vi)` without defining whether evidence records are paired entries or one record with localized fields: `phase-05-build-ai-lab-and-evidence-explorer.md:121-130`.
  - The canonical claim schema contains one unlocalized `claim` string and no locale field: `forensics/claims.schema.json:19-30`.
- **Failure scenario:** `/vi/evidence/[id]` reuses English evidence prose, two locale entries collide on the same collection ID, or Vietnamese authors duplicate technical status/source fields and drift from English/canonical truth.
- **Required plan correction:** Choose one shape before Phase 2: either `(canonicalClaimId, locale)` presentation pairs with a composite uniqueness rule, or one presentation record with required `copy.en` and `copy.vi`. Keep canonical status/source refs outside localized authoring. Define route generation, fallback policy, slug stability, parity checks, and review-state gating for that shape. Full reviewed Vietnamese remains mandatory.

### 7. The CI/package boundary for root scripts, Astro tests, and the H5 runner is unspecified

- **Severity:** High
- **Location:** Phase 2–3 package design and Phase 7 workflows.
- **Evidence:**
  - There is no root web package; the only current package is `game/package.json`, which contains only `@cocos/box2d`: `game/package.json:1-10`. The plan itself recognizes the missing root package and creates `site/package.json`: `phase-02-build-astro-platform-and-content-pipeline.md:32-35`, `phase-02-build-astro-platform-and-content-pipeline.md:118-132`.
  - Playwright/axe are planned in the site package and site tests: `phase-03-create-editorial-design-system-and-global-experience.md:104-120`.
  - The root H5 script loads Playwright from an explicit external module directory and launches a macOS Chrome path: `scripts/run-h5-runtime-matrix.mjs:22-29`, `scripts/run-h5-runtime-matrix.mjs:60-63`, `scripts/run-h5-runtime-matrix.mjs:369-397`.
  - Phase 7 moves composition/runtime smoke to GitHub-hosted Linux but does not specify a Node action/version, browser revision/install command, Linux browser dependencies, or how the root script resolves the site package's Playwright: `phase-07-unify-testing-build-and-github-pages-deployment.md:131-138`, `phase-07-unify-testing-build-and-github-pages-deployment.md:176-217`.
  - The current workflow installs only `game` dependencies, accepts Node majors 22–26, and runs root tests: `.github/workflows/deploy-web-mobile-pages.yml:36-65`, `.github/workflows/deploy-web-mobile-pages.yml:102-130`.
- **Failure scenario:** Site tests pass locally but the Linux compose job cannot resolve Playwright or find a browser. Root portable tests accidentally import `site` dependencies that Node cannot resolve from the root test location. The game job also starts running site-dependent root tests unless the allowlist is exact.
- **Required plan correction:** Name one owner package for browser tooling, pin one Node LTS in both workflows, define the exact `npm ci` and Playwright/browser installation commands, and pass explicit browser/module paths in CI. State that root portable tests are Node-built-in-only unless invoked through the site package. Enumerate the game-job test allowlist and the site-job test list instead of relying on evolving `tests/*.mjs` discovery.

## Medium Priority

### 8. Validation policy is reimplemented repeatedly instead of composed from one authority

- **Severity:** Medium
- **Location:** Phase 1–8 validator ownership.
- **Evidence:**
  - `validateAiEpisode(record)` is proposed in both Phase 1 and Phase 5: `phase-01-establish-public-narrative-and-evidence-contract.md:121-131`, `phase-05-build-ai-lab-and-evidence-explorer.md:121-130`.
  - Locale parity is separately proposed by Phase 2, Phase 5, and Phase 8: `phase-02-build-astro-platform-and-content-pipeline.md:135-146`, `phase-05-build-ai-lab-and-evidence-explorer.md:121-130`, `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:150-161`.
  - Media/rights validation is separately proposed in Phase 1, Phase 6, and Phase 8: `phase-01-establish-public-narrative-and-evidence-contract.md:121-131`, `phase-06-integrate-playable-h5-game-experience.md:118-130`, `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:150-161`.
  - Phases 4–6 all modify the same content validator: `phase-04-produce-story-forensics-and-reconstruction-chapters.md:120-123`, `phase-05-build-ai-lab-and-evidence-explorer.md:117-119`, `phase-06-integrate-playable-h5-game-experience.md:110-116`.
- **Failure scenario:** One validator accepts an AI/media/locale record that another rejects, or three implementations produce incompatible finding shapes and severity rules. Repeated negative fixtures test copies of policy rather than one launch boundary.
- **Required plan correction:** Make Phase 1 own the publication-domain validators and deterministic finding contract. Later phases import/compose those functions and add only route/component-specific checks. Do not create a generic manager; keep a small domain module with explicit record validators and one composition entry point.

### 9. The 15-person moderated study is an undeclared external program and contradicts “no blocking questions”

- **Severity:** Medium
- **Location:** effort, open questions, and Phase 8 launch gate.
- **Evidence:**
  - The plan estimates 5–7 days for Phase 8 and excludes only external rights, attribution, or translation-review delays from its overall estimate: `plan.md:137-147`, `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:1-8`.
  - Phase 8 requires three moderated journeys with five participants each and quantitative pass thresholds: `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:212-215`.
  - It also requires named owner/contributor/correction/translation-review inputs and blocks preview if missing: `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:163-167`.
  - Both items are launch todos: `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:240-250`.
  - The plan says no open question blocks implementation: `plan.md:202-207`.
- **Failure scenario:** Engineering finishes, but release cannot pass because no participant pool, recruiter, moderator, Vietnamese factual reviewer, correction channel, or decision owner was scheduled. The 31–44 day elapsed estimate omits this external critical path.
- **Required plan correction:** Preserve the required owner and reviewed-Vietnamese sign-offs. For the separate 15-person comprehension study, either name owner, recruitment source, schedule, consent/data-retention policy, evidence format, and time dependency, or move it to post-launch research. Do not leave it as an unowned hard gate while claiming no blocking questions.

## Full-Tier Contract Consumer Census

### `verifyWebMobileBuild`

**Current executable callers/consumers**

1. CLI `main()` calls it with one positional build directory: `scripts/verify-web-mobile-build.mjs:381-391`.
2. `tests/verify-web-mobile-build.test.mjs` imports it and has ten direct call sites covering pass/failure behavior: `tests/verify-web-mobile-build.test.mjs:16-21`, `tests/verify-web-mobile-build.test.mjs:33-40`, `tests/verify-web-mobile-build.test.mjs:73-127`, `tests/verify-web-mobile-build.test.mjs:129-163`, `tests/verify-web-mobile-build.test.mjs:243-287`, `tests/verify-web-mobile-build.test.mjs:289-296`.
3. The Pages workflow invokes the CLI with the legacy one-argument contract: `.github/workflows/deploy-web-mobile-pages.yml:133-139`.

**Current documentation contracts**

4. Build standards publish the one-argument command: `docs/code-standards.md:65-73`.
5. The Creator build-audit guide publishes the same command/order: `docs/cocos-creator-build-audit.md:92-103`.
6. The codebase summary names it as the exact-prefix gate: `docs/codebase-summary.md:34-42`.

**Planned consumers**

7. Phase 6 raw/default and nested-prefix tests: `phase-06-integrate-playable-h5-game-experience.md:112-130`, `phase-06-integrate-playable-h5-game-experience.md:149-155`.
8. Phase 7 raw-game job at the legacy default prefix: `phase-07-unify-testing-build-and-github-pages-deployment.md:185-192`.
9. Phase 7 workflow contract tests that must preserve ordering and legacy compatibility: `phase-07-unify-testing-build-and-github-pages-deployment.md:140-155`.
10. Phase 8 documentation updates describing the final command/deploy boundary: `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:138-147`.

**Required update set:** definition, internal CLI parser/help, current verifier test module, workflow invocation/contract test if syntax changes, and published docs. Phase 7's composite verifier is a separate contract; it must not silently replace the strict raw-game verifier.

### `createPagesPrefixServer`

**Current callers**

1. `verifyWebMobileBuild`: `scripts/verify-web-mobile-build.mjs:54-56`.
2. `runH5RuntimeMatrix`: `scripts/run-h5-runtime-matrix.mjs:380-386`.
3. Mutation-after-audit test: `tests/verify-web-mobile-build.test.mjs:299-321`.

**Planned callers**

4. Phase 6 default/nested verifier behavior.
5. Phase 6/7 configurable H5 runtime matrix.
6. Existing and new verifier/runtime tests.

**Required update set:** all three current callers plus the new runtime-matrix behavioral test. If the composed-site verifier needs a server, it requires a separate composite-tree policy/server; passing the documentary tree through the raw `inspectWebBuildDirectory` contract would reject valid prose and paths.

### `pagesUrlForPath`

**Current callers**

1. Internal file checks in `verifyWebMobileBuild`: `scripts/verify-web-mobile-build.mjs:89-100`.
2. Direct encoding contract test: `tests/verify-web-mobile-build.test.mjs:66-71`.

**Required update set:** both callers and the private `routeToBuildPath` path inverse at `scripts/verify-web-mobile-build.mjs:197-230`. The plan currently names none of these helper contracts.

### H5 runtime-matrix entry points and reports

**Current entry/call contracts**

1. Exported `runH5RuntimeMatrix(options = {})`: `scripts/run-h5-runtime-matrix.mjs:369-435`.
2. No-argument CLI: `scripts/run-h5-runtime-matrix.mjs:437-443`.
3. Source-regex runner contract: `tests/runtime-matrix-runner.test.mjs:1-30`.
4. No current workflow caller; the deploy workflow invokes only audit and prefix verification: `.github/workflows/deploy-web-mobile-pages.yml:133-146`.

**Current report consumers**

5. Fidelity generator fixed H5 input and row adapter: `scripts/generate-fidelity-report.mjs:17-30`, `scripts/generate-fidelity-report.mjs:162-187`.
6. Technical closeout fixed H5 input, workspace binding, row checks, and canonical-artifact projection: `scripts/generate-technical-closeout-manifest.mjs:17-30`, `scripts/generate-technical-closeout-manifest.mjs:60-81`, `scripts/generate-technical-closeout-manifest.mjs:88-98`, `scripts/generate-technical-closeout-manifest.mjs:180-197`.
7. Fidelity and closeout tests: `tests/generate-fidelity-report.test.mjs:7-28`, `tests/generate-technical-closeout-manifest.test.mjs:18-76`.
8. Compatibility/build docs and evidence register: `docs/compatibility-matrix.md:30-40`, `docs/cocos-creator-build-audit.md:105-118`, `docs/evidence-register.md:70`.

**Planned consumers**

9. Phase 6 new CLI/options test and nested direct entry: `phase-06-integrate-playable-h5-game-experience.md:112-130`.
10. Phase 7 compose/runtime-smoke job and documentary Playwright smoke: `phase-07-unify-testing-build-and-github-pages-deployment.md:167-174`, `phase-07-unify-testing-build-and-github-pages-deployment.md:200-210`.
11. Phase 7 workflow tests: `phase-07-unify-testing-build-and-github-pages-deployment.md:146-155`.
12. Phase 8 production smoke/docs consumers: `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:136-147`, `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:193-202`.

**Required update set:** runner implementation, CLI, current source-regex test, new behavioral test, deploy workflow, workflow tests, and case-study publication data. Fidelity/closeout generators and tests must be updated only if the legacy report path/schema is changed; the simpler contract is to keep that historical report immutable and create a separately versioned composed-site report.

### Workflow tests and frozen test/workflow consumers

1. `tests/github-pages-workflow.test.mjs` is tied to the current two-job names, runner, dependency edge, test loop, action ordering, and uploaded path: `tests/github-pages-workflow.test.mjs:13-92`.
2. Phase 7 correctly lists that file for modification and adds a site-workflow test: `phase-07-unify-testing-build-and-github-pages-deployment.md:146-155`.
3. Fidelity generation hashes the deploy workflow and the complete tests tree as reconstruction fixtures: `scripts/generate-fidelity-report.mjs:55-66`.

**Required update set:** rewrite all four current workflow test groups for the new four-job graph; add the site-only workflow test; decide whether new site tests/workflows belong to historical reconstruction-fidelity fixtures or only the new case-study snapshot. Do not silently reinterpret a changed aggregate as the old closeout evidence.

### Publication/content pipeline

**Current canonical inputs and consumers**

1. `forensics/claims.jsonl` + `forensics/claims.schema.json`, linked by `docs/evidence-register.md:7-14`.
2. Reconstruction policy validation: `tests/reconstruction-policy-test.sh:7-25`, `tests/reconstruction-policy-test.sh:57-82`.
3. Reconstruction and public-release manifests: `release/recovered-reconstruction-manifest.json:1-23`, `release/recovered-reconstruction-manifest.json:74-85`, `release/public-release-variant-manifest.json:1-24`.
4. Release-manifest/rights consumers: `tests/release-manifests.test.mjs:9-10`, `scripts/verify-release-rights.mjs:309`.
5. Fidelity and closeout consumers described above.
6. The proposed case-study files do not currently exist: `reference/case-study-publication-manifest.json`, `scripts/validate-case-study-publication.mjs`, `scripts/generate-case-study-data.mjs`, `scripts/validate-case-study-content.mjs`, and `site/`.

**Planned consumers**

7. Phase 1 manifest validator and policy test: `phase-01-establish-public-narrative-and-evidence-contract.md:108-131`.
8. Phase 2 generator, content validator, content schema/collections, route helpers, base layout, and generated facts: `phase-02-build-astro-platform-and-content-pipeline.md:73-99`, `phase-02-build-astro-platform-and-content-pipeline.md:118-146`.
9. Phase 3 evidence/status/metric/rights primitives and Home routes: `phase-03-create-editorial-design-system-and-global-experience.md:104-120`, `phase-03-create-editorial-design-system-and-global-experience.md:149-168`.
10. Phase 4 chapters, approved media resolver, route table, and content validator: `phase-04-produce-story-forensics-and-reconstruction-chapters.md:106-140`.
11. Phase 5 AI/evidence content, derived indexes, schema, generator, route table, and validator: `phase-05-build-ai-lab-and-evidence-explorer.md:101-130`.
12. Phase 6 launcher facts, route table, generator, and validator: `phase-06-integrate-playable-h5-game-experience.md:99-130`.
13. Phase 7 game-artifact binding and composite verification: `phase-07-unify-testing-build-and-github-pages-deployment.md:157-174`.
14. Phase 8 copy/rights validation, production smoke, and documentation: `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:125-161`.

**Required update set:** establish one canonical-claim projection boundary before any planned consumer is implemented; define the bilingual Evidence shape; make all Phase 3–8 consumers import/consume the same validated generated contract; retain the commercial manifest verdict unchanged; represent the exact academic waiver in its own scoped record.

## Preserved User Decisions

- Full English launch plus reviewed Vietnamese parity remains mandatory.
- The owner-approved academic Pages waiver remains frozen to the existing audited H5 demonstration and its exact hashed reconstructed-runtime captures. Separately extracted recovered assets remain excluded unless the owner expands that scope.
- Commercial clearance remains unresolved/fail-closed; the academic waiver is not a license.
- The narrative remains static-only and must not imply original-runtime execution, observed parity, or recovered original C++ source.
- The playable H5 experience remains a launch requirement.

## Recommended Actions

1. Repair the Phase 7/8 candidate, approval, and deploy order; move all launch source before final composition.
2. Remove false Phase 4–6 file-ownership parallelism and assign an integration owner.
3. Specify one invocation-scoped prefix contract and update every listed caller/helper/test.
4. Separate immutable legacy H5 runtime evidence from the new composed-site runtime report.
5. Make the publication model a localized projection of canonical `CLM-*` records, not a second claim ledger.
6. Define the exact bilingual Evidence schema and route identity.
7. Pin the CI package/Node/browser contract and explicit test ownership.
8. Collapse duplicate publication validators into one small domain authority.
9. Resolve the external participant-study dependency or move that study out of the launch gate.

## Unresolved Questions

1. Is the 15-person moderated study an explicit owner launch decision, or may it move to post-launch research?
2. Which exact owner-approved record supplies approver/date/evidence for the academic H5-and-six-capture waiver? The plan protects the decision, but the current commercial public-variant manifest intentionally remains blocked.
3. Should the new nested/composed runtime matrix contribute to reconstruction fidelity, or is it only case-study release evidence? The plan currently mixes those two evidence lifetimes.

Status: DONE_WITH_CONCERNS

Summary: Full-tier scope/contract review found one Critical phase-order blocker, six High contract/ownership/feasibility defects, and two Medium YAGNI/dependency issues. All requested current and planned callers/consumers are enumerated above.

Concerns/Blockers: Do not execute the current dependency graph until the Phase 7/8 artifact order, Phases 4–6 ownership, prefix/runtime caller contracts, canonical claim projection, and bilingual Evidence shape are corrected.
