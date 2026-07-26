# Red-Team Assumption Destroyer Plan Review

## Scope

- Review tier: Full.
- Verification role: Scope Auditor.
- Plan reviewed: `plan.md` plus Phases 1–8, including the post-review rights-waiver and evidence-snapshot edits.
- Method: Assumption Destroyer, source-of-truth tracing, new-field lifetime/authority audit, consumer search, and release-gate ordering review.
- Explicit user decision preserved: the owner academic waiver covers the existing audited H5 demonstration and six tracked production captures; separately extracted recovered assets remain excluded; commercial clearance remains fail-closed. This report does not reopen that decision.
- Tests/build/lint: not run; review scope was plan and repository inspection only.

## Overall Assessment

Do not execute the plan as currently sequenced. The plan can publish before its owner/editorial gate, declares parallel ownership that is false in its own file inventories, and proposes new claim/rights states without a strict projection boundary around existing canonical ledgers. The nested H5 verification also depends on module-global prefix state and a machine-local browser setup that the proposed Linux jobs do not provision.

## Critical Findings

### CRITICAL-01 — Production deployment precedes the gate that is supposed to authorize it

- Plan location:
  - `plans/260725-2334-pencil-blade-interactive-case-study/plan.md:164-174`
  - `plans/260725-2334-pencil-blade-interactive-case-study/phase-07-unify-testing-build-and-github-pages-deployment.md:133-138`
  - `plans/260725-2334-pencil-blade-interactive-case-study/phase-07-unify-testing-build-and-github-pages-deployment.md:208-220`
  - `plans/260725-2334-pencil-blade-interactive-case-study/phase-08-complete-launch-qa-legal-review-and-editorial-release.md:165-167`
  - `plans/260725-2334-pencil-blade-interactive-case-study/phase-08-complete-launch-qa-legal-review-and-editorial-release.md:193-219`
- Destroyed assumption: Phase 8 can use production as a pre-release review surface while still blocking publication.
- Concrete failure: Phase 7 deploys the composed artifact to the sole Pages environment. Phase 8 then requires owner inputs, Vietnamese factual review, rights-scope confirmation, accessibility/performance checks, and participant comprehension results. If any Phase 8 gate fails, the rejected artifact has already replaced the current public site. “Keep the site in preview” is not an available state in the described workflow.
- Repository evidence:
  - The current workflow uploads and immediately deploys the artifact at `.github/workflows/deploy-web-mobile-pages.yml:140-163`.
  - There is one `github-pages` production environment in that workflow at `.github/workflows/deploy-web-mobile-pages.yml:148-158`; no candidate or staging environment is defined.
- Required fix:
  1. Make Phase 7 build, verify, hash, and retain an immutable candidate only.
  2. Run all owner, waiver-scope, attribution, translation, accessibility, SEO, and comprehension gates against that exact candidate before deployment.
  3. Put the owner approval on the candidate tree hash and enforce it as a protected deployment-environment gate.
  4. Deploy that same artifact without rebuilding.
  5. Keep only a narrow post-deploy smoke in production; on failure, redeploy the previous known-good artifact/commit.

## High Priority Findings

### HIGH-01 — A field-agnostic authority order can publish the wrong native-function claim

- Plan location:
  - `phase-01-establish-public-narrative-and-evidence-contract.md:56-60`
  - `phase-01-establish-public-narrative-and-evidence-contract.md:123-130`
  - `phase-04-produce-story-forensics-and-reconstruction-chapters.md:154-156`
  - `phase-05-build-ai-lab-and-evidence-explorer.md:138-156`
- Destroyed assumption: one total document-precedence order is valid for every field.
- Concrete failure: Phase 1 ranks the current reconstruction report above contract/runtime evidence. The report compresses native coverage to “713/713 with calls, constants, string xrefs, and review state,” while the structured summary records 553 functions with direct calls, 684 with numeric constants, 91 with string xrefs, and 713 merely auto-indexed. A generic `resolveAuthority(ref)` can select the prose statement and turn “713 indexed records” into “713 functions with each enrichment type” or imply manual review.
- Repository evidence:
  - Ambiguous prose aggregate: `docs/reconstruction-report.md:31-46`.
  - Exact machine values and review-state meaning: `forensics/native/function-enrichment-summary.json:1-11`.
  - Evidence register explicitly says automatic indexing is not manual semantic review: `docs/evidence-register.md:53-54`.
  - The reconstruction report itself lists domain-specific authorities rather than a total order: `docs/reconstruction-report.md:16-29`.
- Required fix:
  - Replace the total order with a field-level authority map. Structured JSON owns counters; claim ledger owns claim status; runtime reports own runtime observations; rights manifests own commercial status; prose is explanatory only.
  - Make conflicts fail closed with both source pointers in the finding.
  - Freeze public wording to: 713 allowlisted/auto-indexed functions; 553 with direct calls, 684 with numeric constants, 91 with high-confidence string xrefs. Do not call auto-indexing manual review.

### HIGH-02 — The publication claim model can fork the existing canonical 39-record claim ledger

- Plan location:
  - `phase-01-establish-public-narrative-and-evidence-contract.md:62-63`
  - `phase-01-establish-public-narrative-and-evidence-contract.md:87-106`
  - `phase-02-build-astro-platform-and-content-pipeline.md:53-60`
  - `phase-02-build-astro-platform-and-content-pipeline.md:101-116`
- Destroyed assumption: reusing IDs is sufficient to prevent a second claim source of truth.
- Concrete failure: the plan gives the new publication manifest and Astro Evidence collection their own `status`, claim copy, and source refs. Those fields already exist in the canonical claim ledger. A localized record can retain a known `CLM-*` ID while silently changing status, evidence tier, contradiction set, or source refs. Phase 5 then treats the publication model as the explorer authority.
- Repository evidence:
  - `CLM-*` is defined as a claim in `forensics/claims.jsonl`: `docs/evidence-register.md:7-14`.
  - Canonical status is limited to `recovered | inferred | unknown`: `forensics/claims.schema.json:20-42`.
  - The ledger currently contains 39 records; representative records include phase-style reviewer IDs: `forensics/claims.jsonl:1-4`.
  - The existing frozen evidence boundary hashes both the ledger and schema: `forensics/fidelity/frozen-evidence-fixture-manifest.json:37-44` and `scripts/generate-fidelity-report.mjs:37-54`.
- Required fix:
  - Rename the new type to `claimPresentation`, keyed by mandatory `canonicalClaimId`.
  - Allow only locale/public copy, redaction, ordering, and display qualifiers in that projection.
  - Derive canonical status, tier, evidence refs, contradictions, and confidence from `forensics/claims.jsonl`; do not duplicate them in author-authored MDX.
  - Validate all 39 canonical IDs one-to-one, reject unknown IDs, and reject any projected canonical-field mismatch.

### HIGH-03 — Generic rights state conflates the accepted academic waiver with unresolved commercial rights

- Plan location:
  - `phase-01-establish-public-narrative-and-evidence-contract.md:64-69`
  - `phase-02-build-astro-platform-and-content-pipeline.md:108-116`
  - `phase-05-build-ai-lab-and-evidence-explorer.md:49-63`
  - `phase-05-build-ai-lab-and-evidence-explorer.md:157-165`
  - `phase-06-integrate-playable-h5-game-experience.md:103-113`
- Destroyed assumption: one `rightsState` or `approval state` field can safely describe both decisions.
- Concrete failure: a waiver-scoped capture or H5 artifact is “approved” for the academic case study while the same underlying recovered categories remain unresolved/not ship-ready for commercial distribution. A generic badge or copied `play.ts` value can display “approved” without its dimension and contradict the commercial ledger, or display “unresolved” and falsely deny the accepted waiver.
- Repository evidence:
  - The public-variant manifest remains blocked and all six category records are unreviewed/unresolved: `release/public-release-variant-manifest.json:13-18` and `release/public-release-variant-manifest.json:32-116`.
  - The asset catalog derives per-asset rights from that manifest: `assets/catalog/asset-catalog.json:3-22` and `assets/catalog/asset-catalog.json:52-56`.
  - The accepted separation is already documented: `docs/release-rights-checklist.md:3-13` and `docs/code-standards.md:65-77`.
- Required fix:
  - Model two explicit dimensions:
    - `academicDisplayDecisionRef` with exact H5/capture hashes, owner decision, scope, date, and status.
    - `commercialRightsRecordRef` resolving to the existing release record and its unchanged status.
  - Remove generic `rightsState` and `approvalState` from public contracts.
  - Generate launcher, explorer, and media views from those references; do not hand-copy rights metadata into `play.ts`.
  - Render both dimensions with unambiguous labels. This preserves, rather than reopens, the user’s waiver decision.

### HIGH-04 — Phases 4–6 are declared parallel despite overlapping ownership of four integration files

- Plan location:
  - Parallelism claim: `plan.md:124-133`.
  - Phase 4 ownership: `phase-04-produce-story-forensics-and-reconstruction-chapters.md:106-123`.
  - Phase 5 ownership: `phase-05-build-ai-lab-and-evidence-explorer.md:101-119`.
  - Phase 6 ownership: `phase-06-integrate-playable-h5-game-experience.md:99-116`.
- Destroyed assumption: the three branches have separate file ownership.
- Concrete failure:
  - All three phases modify `site/src/data/routes.ts`.
  - All three modify `scripts/validate-case-study-content.mjs`.
  - Phases 5 and 6 also both modify `site/src/layouts/base-layout.astro` and `scripts/generate-case-study-data.mjs`.
  - Parallel agents can overwrite route entries, omit validation rules, or resolve conflicts by retaining only the last branch’s schema assumptions. Phase 7 is too late to recover silently dropped behavior reliably.
- Required fix:
  - Assign one integration owner for the four shared files and remove them from parallel phase ownership.
  - Prefer domain-owned route/data fragments with one aggregator created in Phase 3, or serialize a short integration subphase after 4–6.
  - Change the dependency graph and elapsed-time estimate; “separate ownership” is factually false.
  - Add an explicit merge acceptance test that enumerates all required routes, generators, and validator rule groups.

### HIGH-05 — The nested-prefix change is modeled as an option but the current prefix is process-global

- Plan location:
  - `phase-06-integrate-playable-h5-game-experience.md:112-130`
  - `phase-06-integrate-playable-h5-game-experience.md:149-155`
  - `phase-07-unify-testing-build-and-github-pages-deployment.md:157-173`
- Destroyed assumption: changing only the two top-level entry-point signatures makes prefix behavior invocation-scoped.
- Concrete failure: `PAGES_PREFIX` is imported global state used by the verifier server, URL mapper, route mapper, runtime navigation, report output, and outside-prefix filter. A partial parameterization can claim the nested prefix in its result while the server still serves the old root, producing a nested 404 or a false-positive test against `/pencil-blade-2026/`. Mutating the exported/global value would additionally create order-dependent tests and concurrent-run races.
- Repository evidence:
  - Global declaration and verifier use: `scripts/verify-web-mobile-build.mjs:19-20`, `scripts/verify-web-mobile-build.mjs:35-55`, `scripts/verify-web-mobile-build.mjs:66-130`.
  - Server and mapping helpers close over the global: `scripts/verify-web-mobile-build.mjs:136-183` and `scripts/verify-web-mobile-build.mjs:197-204`.
  - Runtime runner imports and reports the same global: `scripts/run-h5-runtime-matrix.mjs:14-28` and `scripts/run-h5-runtime-matrix.mjs:380-425`.
  - Search found 21 `PAGES_PREFIX` references across scripts/tests.
- Required fix:
  - Introduce one immutable per-invocation config containing `pagesPrefix`, `entryPath`, and build root.
  - Thread it through verifier, server, route mapper, URL mapper, runtime viewport runner, request filter, report generator, and CLI parser.
  - Keep the current root only as a default at the public entry point.
  - Add behavior tests for both prefixes plus two concurrent verifier invocations with different prefixes; do not use source-regex assertions as proof.

### HIGH-06 — The Linux runtime-smoke jobs do not provision their browser or a reproducible Node runtime

- Plan location:
  - `phase-02-build-astro-platform-and-content-pipeline.md:64-71`
  - `phase-03-create-editorial-design-system-and-global-experience.md:116-120`
  - `phase-07-unify-testing-build-and-github-pages-deployment.md:131-138`
  - `phase-07-unify-testing-build-and-github-pages-deployment.md:176-210`
- Destroyed assumption: adding Playwright-oriented tests and running `npm ci` is enough to make the current H5 runtime runner portable to `ubuntu-latest`.
- Concrete failure: the current runner loads Playwright from a user-local module directory and launches a macOS Chrome executable. Phase 7 moves final runtime smoke to GitHub-hosted Linux but does not pin Node, install a browser, install Linux browser dependencies, or define how the root-level runner resolves the site package’s Playwright dependency. The existing runner contract test can stay green because it only regex-matches source text.
- Repository evidence:
  - Machine-local defaults: `scripts/run-h5-runtime-matrix.mjs:22-28`.
  - Playwright resolution and Chrome launch: `scripts/run-h5-runtime-matrix.mjs:60-63` and `scripts/run-h5-runtime-matrix.mjs:369-397`.
  - CLI accepts no explicit arguments today: `scripts/run-h5-runtime-matrix.mjs:437-443`.
  - Current runner test only checks strings: `tests/runtime-matrix-runner.test.mjs:1-30`.
  - Current workflow accepts any Node major from 22 through 26 and does not install Node: `.github/workflows/deploy-web-mobile-pages.yml:36-60`.
  - Existing `game/package.json` has neither `engines` nor a browser dependency: `game/package.json:1-10`.
- Required fix:
  - Pin one Node LTS version in repository config, package `engines`, and both workflows via `actions/setup-node`.
  - Declare the browser-test dependency in one owned package and install with `npm ci`.
  - Install the exact Chromium revision plus Linux dependencies, or use a pinned browser container.
  - Pass explicit browser/module/build/mount/output values in CI; prohibit machine-local fallback in CI mode.
  - Replace the regex-only contract with a fixture-backed invocation that proves the CLI, server, browser resolution, nested mount, and failure exit codes.

### HIGH-07 — “Current reports” bypass the new frozen snapshot, and historical facts are not separated from live release facts

- Plan location:
  - Frozen-snapshot contract: `plan.md:38-41` and `phase-02-build-astro-platform-and-content-pipeline.md:41-58`.
  - Contradictory consumers: `phase-02-build-astro-platform-and-content-pipeline.md:162-169`, `phase-02-build-astro-platform-and-content-pipeline.md:209-212`, and `phase-05-build-ai-lab-and-evidence-explorer.md:153-158`.
  - New-release binding: `phase-07-unify-testing-build-and-github-pages-deployment.md:62-72`.
- Destroyed assumption: “current authoritative reports” means the same thing as a versioned snapshot.
- Concrete failure: the generator and AI Lab can read mutable current files even though the public narrative is supposed to stay bound to reviewed hashes. Separately, the current closeout/production report describes the old game-only deployment, not the future composed Astro release. Without two named state domains, the site can label an old 2,539-file deployment as current composed proof or silently rewrite history when a report changes.
- Repository evidence:
  - The closeout H5 proof is rooted at `/pencil-blade-2026/` and records 2,539 files: `plans/260721-2253-pencil-blade-restoration/reports/technical-closeout-manifest.json:21-40`.
  - Its production identity is the earlier game-only deployment/run: `plans/260721-2253-pencil-blade-restoration/reports/technical-closeout-manifest.json:67-93`.
  - The production report records that same earlier commit and file count: `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/production-pages/production-pages-runtime.json:1-20`.
- Required fix:
  - Define `restorationEvidenceSnapshot` as immutable historical input with commit/path/hash for every source.
  - Define a separate `caseStudyReleaseManifest` for the new composed tree, route set, deployment run, and post-deploy observations.
  - Ban unqualified “current” inputs from generators. Every read must name one snapshot or one per-run release manifest.
  - Historical narrative may cite the former; launch/deployment badges may cite only the latter.

## Medium Priority Findings

### MEDIUM-01 — The public “human reviewer” claim has no enforceable evidence contract

- Plan location:
  - `phase-01-establish-public-narrative-and-evidence-contract.md:70-71`
  - `phase-02-build-astro-platform-and-content-pipeline.md:113-116`
  - `phase-05-build-ai-lab-and-evidence-explorer.md:27-37`
  - `phase-05-build-ai-lab-and-evidence-explorer.md:133-156`
- Destroyed assumption: a non-empty reviewer string or a “human decision” field proves that a person accepted or rejected the AI output.
- Concrete failure: the case study can state that AI work was accepted/rejected by a human even when the only record is a phase label or automated review state. That is an attribution and evidence-integrity failure in the page whose purpose is AI disclosure.
- Repository evidence:
  - The claim schema requires only an arbitrary non-empty reviewer string: `forensics/claims.schema.json:61-67`.
  - Existing records use values such as `phase-01-static-review`, not a typed human identity or approval record: `forensics/claims.jsonl:1-4`.
  - Function review state is explicitly automatic, not manual semantic review: `docs/evidence-register.md:53-54`.
- Required fix:
  - Use neutral “review decision” language unless a public-safe approval record proves a human actor.
  - Add `decisionActorKind: human | automation | mixed | unknown`, decision reference, role/accountability, date, and verification refs.
  - Make the validator reject “human-reviewed/accepted/rejected” copy when `decisionActorKind !== human` or its source reference is absent.

## Scope and Lifetime Audit

| State | Intended lifetime | Authority | Required constraint |
|---|---|---|---|
| Canonical claim ledger | Repository-persistent, frozen | `forensics/claims.jsonl` + schema | Publication is a projection only |
| Publication manifest | Repository-persistent public allowlist | New Phase 1 contract | Cannot override canonical claim or commercial-rights fields |
| Academic display waiver | Repository-persistent owner decision | Exact H5/capture hashes | Orthogonal to commercial clearance |
| Commercial rights | Repository-persistent release ledger | Existing public-variant manifest | Remains fail-closed |
| Generated facts | Build-derived | Named evidence snapshot | Never follows unqualified “current” files |
| Pages prefix | Invocation-scoped config | Verifier/runtime caller | No shared mutable/module-global override |
| Runtime result | Per build/deploy run | Runtime report | Must name artifact/tree/commit |
| Production publication | External persistent state | Protected deployment gate | Owner gate must precede mutation |

## Verification Counts

- Plan documents inspected: 9/9.
- Plan lines inspected: 2,243.
- Repository authority/config/runtime artifacts sampled: 24.
- Canonical claim records counted: 39.
- Tracked waiver-scoped production captures counted: 6.
- Prefix consumers found across scripts/tests: 21.
- Shared planned integration files across purportedly parallel Phases 4–6: 4; 2 are touched by all three phases.
- Assumptions explicitly attacked: 12.
  - Survived: 3 — bounded academic waiver, six-capture boundary, separate recovered-asset exclusion/commercial fail-closed posture.
  - Failed: 7 — release ordering, source precedence, claim authority, rights dimensions, phase ownership, prefix lifetime, CI portability.
  - Unresolved: 2 — fresh Cocos-build byte reproducibility and accountable Vietnamese/human review inputs.
- Findings: 9 total — 1 Critical, 7 High, 1 Medium.

## Required Plan Corrections Before Implementation

1. Move owner/editorial/waiver approval before the production mutation and bind approval to the candidate tree hash.
2. Replace total document precedence with field-level authority and conflict failure.
3. Make publication claims strict localized projections of the canonical claim ledger.
4. Split academic display decisions from commercial rights in schema and UI.
5. Remove false parallel ownership or create one explicit integration owner/subphase.
6. Make mount-prefix state immutable and invocation-scoped through every consumer.
7. Specify and pin Node, Playwright, browser installation, and executable resolution for Linux CI.
8. Separate immutable historical evidence from per-release live deployment evidence.
9. Require typed actor evidence before publishing “human reviewer” language.

## Unresolved Assumptions

- Does a clean Cocos Creator 3.8.8 rebuild reproduce the exact frozen H5 tree digest byte-for-byte, or does Phase 7 need a semantic/allowlisted binding distinct from the waiver’s audited artifact hash?
- Who is accountable for Vietnamese factual review, and where is that sign-off stored without exposing personal data?
- Where is the canonical, hashable owner-waiver decision record that the new publication manifest references rather than paraphrases?
- What mechanism retains and serves the exact pre-deploy candidate for Phase 8 QA without publishing it to the sole production Pages environment?

Status: DONE_WITH_CONCERNS

Summary: Full-tier Assumption Destroyer/Scope Auditor review found one release-blocking gate-order defect, seven high-risk authority/ownership/configuration defects, and one unsupported attribution contract.

Concerns/Blockers: Do not start parallel implementation or replace the production Pages artifact until CRITICAL-01 and HIGH-01 through HIGH-07 are corrected in the plan.
