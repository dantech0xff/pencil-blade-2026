# Revised Pencil Blade Case-Study Plan Validation

Date: 2026-07-26
Review tier: Full
Review mode: read-only plan validation; no implementation files changed
Baseline: revised `plan.md` and Phases 01–08 after the four red-team reports

## Code Review Summary

### Scope

- Files: `README.md`, project standards, revised plan and all eight phase files, all four red-team
  reports, three plan research reports, and the existing scripts/tests/workflow/data files needed to
  verify plan claims.
- Focus: production-readiness, source truth, ownership/dependencies, candidate approval/deploy
  lifecycle, trust boundaries, artifact immutability, caller compatibility, runtime error handling,
  and rollback.
- Full-tier role lenses: evidence/spec validator, phase-flow/ownership scout,
  repository-contract/caller scout, and production security/reliability reviewer.
- Plan-contract size: 9 Markdown files, 2,755 lines.
- Scout findings: 2 High and 3 Medium unresolved issues. No Critical issue remains in the revised
  architecture.
- Claim sample: 120 claims, exactly 15 per phase where Phase `Create` targets are classified
  `UNVERIFIED/FUTURE`, not assumed to exist.

### Overall Assessment

The revised plan is materially stronger and is close to executable. It resolves the red team's
structural blockers: canonical claim projection is field-level and fail-closed; rights are
multi-dimensional; the H5 snapshot is separated from release-lifetime reports; current callers are
censused; Phases 4–6 have disjoint ownership; Phase 7 produces one immutable candidate; Phase 8
approves and deploys that same artifact without source changes; all-file live verification,
same-origin storage testing, and hermetic rollback are explicit.

Do not execute the plan unchanged. Two release-path contracts remain incomplete:

1. Phase 8 names approval verification/recording functions that no phase owns, and it requires an
   environment approval reference before the approval exists.
2. Phase 7 requires the existing technical-closeout test in a clean-runner non-writing mode that the
   current API/CLI does not provide.

Those are High-priority plan defects because they can block the release job or encourage ad hoc
approval handling. The remaining Medium findings concern public-safe/atomic runtime evidence,
source-authority wording, and broken research-report links.

### Critical Issues

None.

Critical-pass checks completed:

- No source/build/deploy cycle remains between Phases 7 and 8.
- No Phase 4–6 file-ownership collision remains.
- The public release remains academic-only; commercial release remains blocked.
- The plan does not introduce a parent/game messaging bridge or claim same-origin security
  isolation.
- The deploy job waits for protected-environment approval and consumes the already uploaded
  same-run candidate.
- Rollback is a hermetic known-good rebuild, not a splice of archived partial bytes.

### High Priority

#### H1. Candidate approval tooling has no owner, and the approval record is chronologically impossible

Phase 8 says it adds no tests or smoke tooling
(`phase-08-complete-launch-qa-legal-review-and-editorial-release.md:32-37`). Its inventory creates
only documentation and release records (`:138-157`), yet its interface checklist requires
`verifyCandidateForApproval` and `recordCandidateApproval` (`:161-167`). It also refers to an
“Existing Phase 7 `validateLaunchCopy`” (`:163-164`), but Phase 7 defines no such function or file.
Phase 7 owns the production smoke and candidate server, but not these approval interfaces
(`phase-07-unify-testing-build-and-github-pages-deployment.md:181-204,206-240`).

There is also a lifecycle contradiction. The proposed `candidate-approval.json` includes an
environment approval reference (`phase-08...:156,165-167`), but step 9 writes that file before the
human approves the protected environment (`:227-230`). A reference to the actual approval event
cannot be recorded before the event exists.

Impact: an implementer must invent unreviewed tooling during the source-frozen approval phase,
omit the checks, or record a placeholder as if it were approval evidence. Any of these weakens the
authorization/audit boundary.

Required correction:

1. Add the approval schema, verifier, recorder, and tests to Phase 7 so they exist inside the
   candidate-producing commit.
2. Split records into a preapproval request/review record and postapproval/deployment evidence.
   Bind both to commit, run/attempt, candidate artifact, `contentTreeDigest`, and tree-manifest
   digest.
3. Phase 8 may invoke those frozen tools and append post-event evidence, but must not add or alter
   deployable source.
4. State that rollback selects the candidate commit/digest, not a later documentation/evidence
   commit.

#### H2. “Existing closeout tests in non-writing mode” is not a clean-runner-safe contract

Phase 7 requires existing fidelity/closeout tests to run in non-writing mode
(`phase-07-unify-testing-build-and-github-pages-deployment.md:278-279`).

The fidelity test does support `writeOutputs: false`, but the technical-closeout test calls
`generateTechnicalCloseoutManifest({ writeOutput: false })`
(`tests/generate-technical-closeout-manifest.test.mjs:36-38`). That suppresses output only. The
generator still defaults `validateWorkspaceArtifacts` to true
(`scripts/generate-technical-closeout-manifest.mjs:176-178`) and requires the ignored Android APK
and H5 build to exist and match (`:60-80`). The current Pages workflow intentionally excludes this
test because it binds owner-held/ignored artifacts
(`.github/workflows/deploy-web-mobile-pages.yml:102-124`). The CLI's `--report-only` disables
workspace validation but still writes the tracked output because it does not set
`writeOutput: false` (`scripts/generate-technical-closeout-manifest.mjs:229-238`).

Impact: the planned clean workflow can fail despite a valid candidate, or mutate a historical
tracked closeout artifact while claiming non-writing behavior.

Required correction: define and test one explicit validation mode that is both
`writeOutput: false` and `validateWorkspaceArtifacts: false`, or state that Phase 7 verifies the
historical closeout record by fixed hashes/schema and continues excluding the artifact-bound test.
Name the exact command and expected inputs in Phase 7.

### Medium Priority

#### M1. The new runtime report can expose a machine path and leave plausible partial evidence

Phase 6 requires CI to resolve and record the Playwright-managed Chromium executable
(`phase-06-integrate-playable-h5-game-experience.md:142-144`), while Phase 1 forbids machine-local
paths in public material (`phase-01-establish-public-narrative-and-evidence-contract.md:95-96`).
The existing runner records the absolute executable path
(`scripts/run-h5-runtime-matrix.mjs:404-411`). Because Phase 6 creates a separately versioned
case-study runtime report (`phase-06...:189-194`), the plan must distinguish a private diagnostic
path from public-safe browser identity.

The existing runner also writes screenshots incrementally (`scripts/run-h5-runtime-matrix.mjs:
210-212,223-225,238-240`) and writes JSON before cleanup (`:428-433`). A failed run can leave a
partially refreshed directory that looks like evidence from one coherent run.

Required correction: require a fresh temporary report directory, write the JSON atomically only
after all assertions and cleanup succeed, then promote the directory. Store public-safe
Playwright/Chromium package, revision, and version fields; omit or redact the absolute executable
path from tracked/public output.

#### M2. Phase 5 reintroduces ambiguous whole-document authority wording

Phase 1 correctly requires a field-level authority map and fail-closed conflict handling
(`phase-01...:60-68`). Phase 5 nevertheless says the AI Lab must “use the same authority order as
the rest of the site” (`phase-05-build-ai-lab-and-evidence-explorer.md:36-38`). That wording can be
read as the rejected whole-document precedence model.

Required correction: replace “authority order” with “field-level authority map and canonical claim
projection defined in Phase 1.” This preserves the verified decision and removes the last stale
instruction.

#### M3. The content/evidence source map has 46 broken local links

All 108 local links in the 9 plan-contract files resolve. Across the 16 reviewed input Markdown
files (excluding this validator output), however, only 158 of 204 local links resolve. All 46
failures are in
`reports/content-evidence-source-map.md`; examples are at `:20-26`, `:42-49`, and `:114-120`.
Links such as `../../docs/...`, `../../forensics/...`, and `../../README.md` are one directory too
shallow when resolved from `plans/.../reports/`.

Impact: this report is a declared input to multiple phases, so implementers cannot reliably follow
its evidence citations.

Required correction: change repository-root targets in that report to `../../../...` as
appropriate, then rerun the same all-work-context link check.

### Low Priority

No Low issue is promoted. Phrases such as “launcher bridge” in Phase 6 are potentially confusing,
but the explicit prohibition on parent/game messaging is repeated strongly enough that this is not
a release blocker after M2 is corrected.

## Evidence Ledger

Legend:

- `V` — verified against an existing repository artifact.
- `F` — contradicted by the current repository.
- `U` — unverified/future work; expected for a planned `Create`/`Modify` target.

### Phase 1 — 15 claims

| # | Claim | Verdict | Evidence |
|---:|---|:---:|---|
| 1 | Work is a static-only clean-room reconstruction | V | `README.md:1-15`; `docs/reconstruction-report.md` |
| 2 | Reconstructed game targets Cocos Creator 3.8.8 and TypeScript | V | `README.md`; `game/package.json` |
| 3 | Repository has Android and H5 technical outputs | V | `README.md`; existing build-audit records |
| 4 | Canonical claims ledger contains 39 claims | V | `forensics/claims.jsonl`; 39-line census against `forensics/claims.schema.json` |
| 5 | Native function total is 713 | V | `forensics/native/function-enrichment-summary.json:4-10` |
| 6 | Function enrichment has 553 direct names, 684 constants, 91 string xrefs | V | Same summary |
| 7 | Reconstruction accounts for 862 assets, 761 consumed, 25 residual, 0 unexplained | V | `docs/reconstruction-report.md:33-46` |
| 8 | Frozen H5 has 2,539 files and 39,613,694 bytes | V | `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/h5-runtime-matrix.json`; H5 audit |
| 9 | Frozen H5 tree digest is `90f0…b54` | V | H5 audit and production record |
| 10 | Runtime evidence has two rows and six screenshots | V | restoration runtime-matrix and production-pages reports |
| 11 | Academic Pages use is approved while commercial use is unresolved/blocked | V | `docs/release-rights-checklist.md:3-13`; public rights variant |
| 12 | Publication manifest exists | U | Phase 1 `Create` target |
| 13 | Public source catalog exists | U | Phase 1 `Create` target |
| 14 | Academic decision record exists | U | Phase 1 `Create` target |
| 15 | New schema/rights/content validator suite exists | U | Phase 1 `Create` targets |

Phase 1 subtotal: 11 V / 0 F / 4 U.

### Phase 2 — 15 claims

| # | Claim | Verdict | Evidence |
|---:|---|:---:|---|
| 1 | Repository currently has no root web package | V | file census; only `game/package.json` exists |
| 2 | `site/` does not yet exist | V | directory census |
| 3 | Current Pages prefix is `/pencil-blade-2026/` | V | `scripts/verify-web-mobile-build.mjs:19` |
| 4 | Current verifier uses module-global prefix state | V | verifier `:35-130,178-230,381-395` |
| 5 | Current runtime runner has machine-local browser defaults | V | `scripts/run-h5-runtime-matrix.mjs:24-28,372-377` |
| 6 | Existing fidelity report is present | V | `forensics/fidelity/fidelity-report-v1.json` |
| 7 | Existing native enrichment summary is present | V | `forensics/native/function-enrichment-summary.json` |
| 8 | Existing technical closeout manifest is present | V | `plans/260721-2253-pencil-blade-restoration/reports/technical-closeout-manifest.json` |
| 9 | Astro package exists | U | Phase 2 `Create` target |
| 10 | Exact `.node-version` exists | U | Phase 2 `Create` target |
| 11 | Astro configuration exists | U | Phase 2 `Create` target |
| 12 | Content collection schema exists | U | Phase 2 `Create` target |
| 13 | Restricted MDX renderer exists | U | Phase 2 `Create` target |
| 14 | Locale/base route helper exists | U | Phase 2 `Create` target |
| 15 | New generators and pipeline tests exist | U | Phase 2 `Create` targets |

Phase 2 subtotal: 8 V / 0 F / 7 U.

### Phase 3 — 15 claims

| # | Claim | Verdict | Evidence |
|---:|---|:---:|---|
| 1 | Editorial experience specification exists | V | `reports/editorial-experience-spec.md` |
| 2 | Recovered game visual/audio assets exist | V | `game/assets/game/` |
| 3 | No case-study design-token package exists yet | V | `site/` absent |
| 4 | No current Astro layout can satisfy the proposed shell | V | `site/` absent |
| 5 | `BaseLayout` exists | U | Phase 3 `Create` target |
| 6 | Bilingual global shell exists | U | Phase 3 `Create` target |
| 7 | Evidence drawer exists | U | Phase 3 `Create` target |
| 8 | Status is encoded beyond color | U | Future component/tests |
| 9 | Reduced-motion behavior is implemented | U | Future CSS/tests |
| 10 | Print mode is implemented | U | Future CSS/tests |
| 11 | Rights-safe SVG brand set exists | U | Phase 3 `Create` target |
| 12 | About/credits/rights routes exist | U | Phase 3 `Create` targets |
| 13 | JSON serializer and CSP tests exist | U | Phase 3 `Create` targets |
| 14 | Shell browser/a11y tests exist | U | Phase 3 `Create` targets |
| 15 | Social previews and fallback graphics exist | U | Phase 3 `Create` targets |

Phase 3 subtotal: 4 V / 0 F / 11 U.

### Phase 4 — 15 claims

| # | Claim | Verdict | Evidence |
|---:|---|:---:|---|
| 1 | Original APK was not executed during reconstruction | V | `docs/project-overview-pdr.md`; reconstruction report |
| 2 | Static-analysis evidence is authoritative for native facts | V | `README.md`; evidence register |
| 3 | Function-enrichment counters are exact current data | V | native enrichment summary |
| 4 | Asset census total is 862 | V | reconstruction report |
| 5 | Consumed reconstructed assets total 761 | V | reconstruction report |
| 6 | Residual assets total 25 | V | reconstruction report |
| 7 | Unexplained assets total 0 | V | reconstruction report |
| 8 | Original-execution identity is not claimed | V | fidelity report and rights/reconstruction docs |
| 9 | Physics uses 32 legacy world units per metre | V | `forensics/contracts/classic-physics-contract.md:41-42` |
| 10 | Variable step is `dt * speed` with 10/10 iterations | V | physics contract |
| 11 | Raycast/deferred-destruction behavior is documented | V | physics contract |
| 12 | Story chapter routes exist | U | Phase 4 `Create` targets |
| 13 | Interactive forensics UI exists | U | Phase 4 `Create` targets |
| 14 | Reconstruction chapter UI exists | U | Phase 4 `Create` targets |
| 15 | Rights-safe chapter media derivatives exist | U | Phase 4 `Create` targets |

Phase 4 subtotal: 11 V / 0 F / 4 U.

### Phase 5 — 15 claims

| # | Claim | Verdict | Evidence |
|---:|---|:---:|---|
| 1 | Reconstruction combined Java shell and recovered native behavior | V | reconstruction report |
| 2 | All 713 functions are auto-indexed | V | native enrichment summary |
| 3 | Direct/constant/string-xref subcounts match current data | V | native enrichment summary |
| 4 | Static-only evidence posture is explicit | V | `README.md`; evidence register |
| 5 | Physics contract evidence exists | V | reconstruction physics contract |
| 6 | Resource corpus reports zero unknown final resources | V | reconstruction report/resource records |
| 7 | Five reviewed domains received no inference credit | V | AI reviewer report/evidence |
| 8 | Crazy Games decision was fail-closed | V | AI reviewer report/evidence |
| 9 | DragonBones batch/registry/disposal contradictions are documented | V | AI reviewer report/evidence |
| 10 | Down-gesture ABI is confirmed rather than contradicted | V | AI reviewer report/evidence |
| 11 | Passing Pages evidence is workflow attempt 2 | V | `docs/cocos-creator-build-audit.md`; production record |
| 12 | Infra evidence records broker 500/502/504 failures | V | infrastructure failure report |
| 13 | AI Lab routes exist | U | Phase 5 `Create` targets |
| 14 | Evidence-explorer filters exist | U | Phase 5 `Create` targets |
| 15 | Episode index/cards/tests exist | U | Phase 5 `Create` targets |

Phase 5 subtotal: 12 V / 0 F / 3 U.

### Phase 6 — 15 claims

| # | Claim | Verdict | Evidence |
|---:|---|:---:|---|
| 1 | Raw verifier owns a fixed prefix constant | V | `scripts/verify-web-mobile-build.mjs:19` |
| 2 | H5 build is ignored technical output | V | `.gitignore` H5 entries |
| 3 | Verifier callers currently rely on global/default behavior | V | script, tests, workflow, docs caller census |
| 4 | Runtime runner also relies on the raw prefix | V | `scripts/run-h5-runtime-matrix.mjs:203,417` |
| 5 | Game writes `sys.localStorage` | V | `game/assets/scripts/creator/classic-settings-runtime.ts:311-319` |
| 6 | Existing game storage keys are unnamespaced | V | classic settings and mode-select runtime scripts |
| 7 | Production code has no parent/top/opener/postMessage bridge | V | production-source search |
| 8 | Historical H5 strict audit passed | V | `docs/cocos-creator-build-audit.md`; runtime matrix |
| 9 | Historical runtime matrix has two supported viewports | V | runtime matrix JSON |
| 10 | Same-origin launcher can collide with game storage by capability | V | storage code plus proposed same-origin mount |
| 11 | Current verifier CLI has no generalized prefix/entry/report config | V | verifier CLI block |
| 12 | Current runtime runner has machine defaults, partial cleanup, and weak pass predicates | V | runtime runner contract census |
| 13 | `/play/` and `/play/game/` routes exist | U | Phase 6 `Create` targets |
| 14 | Parameterized verifier/runtime APIs exist | U | Phase 6 `Modify` targets |
| 15 | Nested launcher/direct-game smoke exists | U | Phase 6 `Create` targets |

Phase 6 subtotal: 12 V / 0 F / 3 U.

### Phase 7 — 15 claims

| # | Claim | Verdict | Evidence |
|---:|---|:---:|---|
| 1 | Current Pages workflow is manual | V | `.github/workflows/deploy-web-mobile-pages.yml:1-5` |
| 2 | Current build uses a self-hosted Creator runner | V | workflow runner labels |
| 3 | Current workflow has a protected-main guard | V | workflow guard |
| 4 | Checkout disables credential persistence | V | workflow checkout step |
| 5 | Creator installation is hash-checked | V | workflow Creator validation |
| 6 | Current Node gate permits a range rather than exact patch | V | workflow Node validation |
| 7 | Current npm install is lockfile/ignore-scripts based | V | workflow install step |
| 8 | Current portable test list uses a glob with explicit exclusions | V | workflow `:102-125` |
| 9 | Raw H5 audit runs before Pages upload | V | workflow audit/upload sequence |
| 10 | Current deploy uses Pages/OIDC permissions | V | workflow permissions/deploy job |
| 11 | Current remote actions use mutable version tags | V | workflow `uses:` census |
| 12 | Existing workflow contract tests are primarily source/regex based | V | `tests/github-pages-workflow.test.mjs` |
| 13 | Site-only PR workflow exists | U | Phase 7 `Create` target |
| 14 | Exact toolchain/allowlist/composer set exists | U | Phase 7 `Create` targets |
| 15 | Parsed trust validator, live all-file smoke, and candidate provenance exist | U | Phase 7 `Create` targets |

Phase 7 subtotal: 12 V / 0 F / 3 U.

### Phase 8 — 15 claims

| # | Claim | Verdict | Evidence |
|---:|---|:---:|---|
| 1 | A production Pages URL is recorded | V | production Pages record |
| 2 | Passing release is workflow attempt 2 | V | production record/build audit |
| 3 | Passing release is bound to commit `c942ba…` | V | production record |
| 4 | Live record reports 2,539/2,539 files | V | production record |
| 5 | Both supported viewports passed | V | production record/runtime matrix |
| 6 | Recorded runtime errors are zero | V | production record/runtime matrix |
| 7 | Six production captures are recorded | V | production record |
| 8 | Academic approval is not a general asset licence | V | rights checklist |
| 9 | Commercial publication remains blocked | V | public rights variant |
| 10 | Current workflow deploys to the `github-pages` environment | V | current workflow |
| 11 | Existing documentation describes the game-only Pages shape | V | architecture/build-audit/codebase docs |
| 12 | Final bilingual About/legal routes exist | U | Earlier phase targets, not current source |
| 13 | Candidate/release manifests exist | U | Phase 7 future targets |
| 14 | Manifest-wide production smoke exists | U | Phase 7 future target |
| 15 | Deployment guide/checklist/approval/launch report exist | U | Phase 8 `Create` targets |

Phase 8 subtotal: 11 V / 0 F / 4 U.

Claim-ledger total: **81 V / 0 F / 39 U = 120 claims**.

## Edge Cases Found by Scout

- Environment approval is an event, not a value known while preparing the approval request.
- An immutable deployable candidate and mutable post-event audit evidence need separate lifetimes.
- “Non-writing” and “no workspace artifact validation” are two independent generator options.
- A Playwright executable path is useful privately but unsafe as a public/tracked machine identity.
- A failing runtime capture can leave mixed-run screenshots unless the report directory is promoted
  atomically.
- Same-origin embedding removes browser-origin isolation; shell storage must be tested as an exact
  before/after key snapshot, not merely by checking one sentinel.
- All-file production verification must validate manifest identity first and fetch files with
  bounded concurrency/cache busting; the revised plan now specifies this.
- One self-hosted Creator runner makes rollback RTO unbounded during runner outage; the revised plan
  now records this rather than promising a false target.

## Red-Team Fix Verification

| Area | Result | Evidence |
|---|---|---|
| Canonical claims | Pass | Phase 1 field-level authority map; Phase 2 canonical join owns status/tier/evidence/confidence/contradictions |
| Rights dimensions | Pass | Academic decision, per-record ship readiness, media rights, and commercial status remain separate |
| Snapshot vs release lifetime | Pass | Historical H5/fidelity/closeout artifacts remain immutable; new case-study reports are separate |
| Caller census | Pass | Phase 6 enumerates verifier APIs, private mapper, CLI, runtime matrix, tests, workflow, reports, and docs |
| Report separation | Pass | Phase 6 forbids overwriting/reinterpreting historical `h5-runtime-matrix.json` |
| Phase 4–6 ownership | Pass | Phase 2 owns aggregators; Phase 4 owns publication-manifest chapter changes; Phases 5/6 own disjoint fragments/runtime files |
| Candidate approval/deploy | Pass with H1 | Phase 7 uploads one immutable candidate and waiting Pages artifact; Phase 8 deploys no rebuilt bytes |
| Toolchain trust | Pass as future contract | Exact Node/toolchain/actions/Creator/locks/Playwright fields and full action SHAs are Phase 7 gates |
| All-file live verification | Pass as future contract | Phase 7 owns manifest-wide smoke; Phase 8 invokes it against production |
| Same-origin/no isolation | Pass | No bridge is introduced; storage collision and direct/launcher H5 journeys are required |
| Rollback | Pass | Hermetic known-good rebuild; no partial-byte artifact rollback; unbounded single-runner RTO disclosed |
| Phase 7–8 source cycle | Pass | Launch source is final by Phase 3; Phase 8 adds no site source/media/tests/tools |
| Old contradictory terms | Pass with M2 | Partial-copy/bridge/artifact-rollback terms survive only in explicit prohibitions; one stale “authority order” phrase remains |

## Positive Observations

Only risk-calibrating observations:

- The revised phase graph is coherent: `1 → 2 → 3 → {4,5,6} → 7 → 8`.
- Phase 7 is now the sole owner of composition, release manifests, production smoke tooling, and
  workflow trust validation.
- Phase 8 is explicitly observational/approval-oriented and invalidates the candidate on any
  source correction.
- Runtime pass criteria now require audio, storage, resume/canvas geometry, fullscreen, and empty
  error/request/bad-response sets instead of unconditional row success.
- The plan preserves explicit user decisions: static-only evidence, academic-only release,
  same-origin launch without a messaging bridge, immutable candidate deployment, and hermetic
  rollback.

## Recommended Actions

1. Fix H1 by assigning approval schema/verifier/recorder/tests to Phase 7 and separating preapproval
   request evidence from postapproval event evidence.
2. Fix H2 by specifying a real clean-runner-safe closeout validation mode and exact command.
3. Add public-safe and atomic runtime-report requirements to Phase 6.
4. Replace Phase 5's “authority order” wording with the Phase 1 field-level authority contract.
5. Repair the 46 links in `reports/content-evidence-source-map.md` and rerun the link checker.
6. Revalidate only the changed contracts, then begin Phase 1. Do not relax the verified candidate,
   rights, same-origin, or rollback decisions while applying these fixes.

## Plan Status Recommendations

- Plan structure and dependencies: complete.
- Red-team disposition mapping: complete, subject to the five findings above.
- Phases 1–8 implementation: not started by design; all `Create`/`Modify` outcomes remain
  `UNVERIFIED/FUTURE`.
- Recommended execution status: **hold before Phase 1 until H1 and H2 are corrected**. Medium items
  should be corrected in the same plan revision because they affect public evidence and source
  traceability.
- Documentation mutation: validator did not edit plan or task state.

## Metrics

- Claim verification: 120 sampled; 81 verified, 0 failed, 39 unverified/future.
- Contract-link integrity: 108/108 local links resolve across `plan.md` and Phases 01–08.
- Reviewed-input link integrity: 158/204 local links resolve; 46 broken, all in one research
  report. This validator output adds no Markdown links.
- Targeted current-state tests: 76/76 passed in the repository-contract scout.
- Current H5 verification: 2,539 files passed strict audit and exact-prefix verification in the
  repository-contract scout.
- Type coverage: N/A for plan-only review; planned implementation does not exist.
- Test coverage: N/A for future site implementation; current targeted tests passed as above.
- Linting issues: N/A; no implementation was changed and no plan-specific linter exists.

## Behavioral Checklist

- [x] Concurrency: phase ownership, async initialization/cleanup, candidate ordering, and report
  promotion checked.
- [x] Error boundaries: server/import/browser partial initialization and generator side effects
  checked.
- [x] API contracts: verifier/runtime callers and closeout options checked against source.
- [x] Backwards compatibility: historical report consumers and CLI/default behavior checked.
- [x] Input validation: content/rights/MDX/CSP/path/workflow/candidate boundaries checked.
- [x] Auth/authz: protected environment requires identity and reviewer permission; H1 records the
  remaining event-evidence gap.
- [x] N+1/query efficiency: no database exists; all-file network checks require bounded
  concurrency.
- [x] Data leaks: private/raw evidence and machine-local executable-path handling checked.
- [x] Fact-checked: paths, symbols, dependencies, counts, and behavioral claims were grep/source
  verified rather than accepted from plan prose.

## Unresolved Questions

1. What stable public identifier does GitHub expose for the protected-environment approval event,
   and where should the postapproval record live without changing the approved deployable
   candidate?
2. Should Phase 7 validate the historical technical closeout semantically in a new no-workspace
   API mode, or only verify its frozen bytes/hash/schema?

Status: DONE_WITH_CONCERNS
Summary: revised plan is structurally sound and resolves the red-team architecture blockers, but
two High release-contract gaps and three Medium evidence/documentation gaps remain.
Concerns/Blockers: approval tooling/event chronology; clean-runner closeout mode; runtime report
privacy/atomicity; stale authority wording; 46 broken research-report links.
