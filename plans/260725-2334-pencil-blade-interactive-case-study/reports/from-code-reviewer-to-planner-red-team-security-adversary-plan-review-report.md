# Red-Team Security Adversary Plan Review

Date: 2026-07-26
Review target: `plans/260725-2334-pencil-blade-interactive-case-study/`
Lens: trust boundaries, public-data exposure, supply chain, release authorization, rollback integrity, and factual publication safety
Execution constraint: read-only review; no lint, build, or test command was run

## Assessment

**CHANGES_REQUIRED.**

The amended academic-waiver decision is verified and is not a finding. The current repository
does distinguish the owner-approved academic Pages release from the still-blocked commercial
variant (`docs/release-rights-checklist.md:3-13`,
`release/public-release-variant-manifest.json:13-18`). The frozen H5 facts also match the recorded
runtime evidence: 2,539 files, 39,613,694 bytes, tree digest
`90f0fed3042364f02cfb6dbe888d32561c71ca9a2218d4316f2ae8a879cb2b54`, and exactly six
tracked production captures (`plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/h5-runtime-matrix.json:9-14`,
`plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/production-pages/production-pages-runtime.json:72-84,138-150`).

The plan still has one critical gate-order defect and six high-risk security/reliability defects.
The most serious problem is structural: Phase 7 publishes to the production Pages environment,
while Phase 8 performs attribution, translation, rights-scope, copy, accessibility, and owner
approval afterward. That is not a fail-closed release process.

## Findings

### 1. Critical — The plan deploys publicly before the owner/editorial/rights release gate

**Severity:** Critical
**Location:** `plan.md:124-133,164-174`;
`phase-07-unify-testing-build-and-github-pages-deployment.md:200-222,255-264`;
`phase-08-complete-launch-qa-legal-review-and-editorial-release.md:163-219`

**Flaw**

The phase graph is explicitly `7 → 8`, Phase 7 uploads and deploys the composed artifact, and only
Phase 8 freezes the title, credits, correction channel, attribution, Vietnamese reviewer,
rights-scope review, comprehension results, and owner sign-off. The main plan also orders the
production gate before the owner gate.

Plan evidence:

- `plan.md:127-130`: Phase 7 precedes Phase 8.
- `plan.md:171-174`: production deployment is gate 5; exact-tree owner approval is gate 6.
- `phase-07-unify-testing-build-and-github-pages-deployment.md:215-220`: upload and deploy happen
  in Phase 7.
- `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:165-167`: missing release
  inputs are supposed to keep the site in preview.
- `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:193-219`: live production
  validation, rights review, and owner sign-off occur later.

Actual-repository evidence:

- `.github/workflows/deploy-web-mobile-pages.yml:140-163` configures and deploys directly to the
  `github-pages` environment; there is no preview deployment stage.
- `docs/cocos-creator-build-audit.md:105-119` confirms this workflow's deployment URL is the live
  public Pages URL.

**Failure scenario**

Phase 7 succeeds with a composed artifact whose Vietnamese copy has not received factual review,
whose attribution/correction owner is incomplete, or whose media manifest accidentally expanded
past the frozen waiver. The artifact becomes publicly indexable. Phase 8 then detects the problem,
but the unsafe version has already been distributed and may remain cached or archived.

**Suggested fix**

Split release work into a pre-public approval gate and a post-deploy smoke gate:

1. Build and audit one immutable candidate.
2. Run all static/bilingual/a11y/rights/media checks against that candidate.
3. Record owner/editorial/translation approval against the candidate tree digest.
4. Make the deploy job require that signed digest record and deploy exactly that artifact.
5. After deployment, run only production-specific smoke and identity checks. A failure must
   automatically stop release completion and restore the last approved deployment.

Move all Phase 8 items that can be checked before publication—including waiver scope, credits,
copy, routes, accessibility, SEO, and owner sign-off—before the Phase 7 deploy job.

### 2. High — The same-origin iframe is described as an isolation boundary even though it is not one

**Severity:** High
**Location:** `phase-06-integrate-playable-h5-game-experience.md:145-148,198-212`;
`phase-07-unify-testing-build-and-github-pages-deployment.md:268-288`

**Flaw**

Phase 6 correctly says the frame is not a hostile sandbox, but immediately claims the child
"receives no DOM handles." Phase 7 then says to "treat it as an isolation boundary." A same-origin
frame automatically has access to `window.parent`, the parent DOM, and the same origin storage.
Not passing an application-level handle does not remove those browser capabilities.

Plan evidence:

- `phase-06-integrate-playable-h5-game-experience.md:145-148`: same-origin, no hostile sandbox,
  but claimed absence of DOM handles.
- `phase-07-unify-testing-build-and-github-pages-deployment.md:272-273,286-288`: storage coupling is
  acknowledged while the frame is still called an isolation boundary.

Actual-repository evidence:

- `game/assets/scripts/creator/classic-settings-runtime.ts:311-319` binds game state directly to
  `sys.localStorage`.
- `game/assets/scripts/domain/classic-settings-state.ts:806-820` uses generic keys such as
  `blade_price_*`, `background_price_*`, and `mode_unlock_*`, not a site/game namespace.
- `game/assets/scripts/domain/mode-select-state.ts:818-820` independently uses the same generic
  `mode_unlock_*` namespace.
- The architecture input itself states that same-origin frames share storage and the parent can
  reach the child DOM
  (`plans/260725-2334-pencil-blade-interactive-case-study/reports/site-h5-pages-architecture.md:249-255`).

**Failure scenario**

A compromised or defective H5 bundle reads or mutates future site state, replaces the documentary
UI through `parent.document`, or top-navigates the reader to a phishing page. A later site feature
chooses a generic localStorage key that collides with a game key and corrupts progress. "The parent
stores no secrets" limits one consequence but does not protect UI integrity, navigation, privacy,
or state correctness.

**Suggested fix**

Choose and document one real security model:

- **Preferred:** serve the game from a separate origin and use a narrowly versioned,
  origin-checked bridge only if needed.
- **If same origin is mandatory:** state explicitly that there is no security isolation. Keep the
  parent entirely stateless, namespace every site key, namespace/migrate game keys if gameplay
  compatibility permits it, prohibit parent DOM coupling by code policy, and test for key
  collisions. Do not call the iframe an isolation boundary.
- A sandbox without `allow-same-origin` would provide a stronger boundary but would break the
  current localStorage contract; `allow-scripts allow-same-origin` on same-origin content is not a
  dependable hostile-content sandbox. Treat that as a product trade-off, not a free mitigation.

### 3. High — Source allowlisting validates the citation path but not the content it exposes

**Severity:** High
**Location:** `phase-01-establish-public-narrative-and-evidence-contract.md:57-61,105-130,214-223`;
`phase-02-build-astro-platform-and-content-pipeline.md:56-60,160-169`

**Flaw**

The proposed `validateSourceRef` rejects an absolute *reference path*, but the source precedence
explicitly admits completed historical reports and the public site emits commit-pinned links to
them. Many tracked reports contain absolute workstation paths and links into ignored raw forensic
material. A repository-relative citation to such a report passes the proposed validator while
still exposing the forbidden data transitively.

Plan evidence:

- `phase-01-establish-public-narrative-and-evidence-contract.md:57-61`: historical progress
  reports are source candidates.
- `phase-01-establish-public-narrative-and-evidence-contract.md:118,125`: completed reports are read
  and only the source-ref path is specified as rejecting absolute/ignored/missing paths.
- `phase-01-establish-public-narrative-and-evidence-contract.md:216-223`: machine-local paths and
  raw evidence must not leak, but curated report links are allowed.
- `phase-02-build-astro-platform-and-content-pipeline.md:59`: citations become public
  commit-pinned GitHub links.

Actual-repository evidence:

- `plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-23-remaining-mode-order.md:38-44`
  links directly to `/Users/dan/.../.forensics-work/.../libgame.so` and raw native inventories.
- The same report links to ignored extracted resource trees at lines 128-137.
- `plans/260721-2253-pencil-blade-restoration/reports/android-toolchain-readiness-2026-07-22.md:27-37`
  publishes the workstation SDK path and installed toolchain inventory.
- `.gitignore:1-16` confirms the APK, `.forensics-work`, native libraries, and raw supporting
  media are deliberately non-versioned evidence.
- Repository scan found 255 tracked historical-report lines containing `/Users/dan`,
  `.forensics-work`, APK/native references, or equivalent denied evidence markers.

**Failure scenario**

An author cites a technically useful tracked report. The manifest accepts the repository-relative
source. The generated site links readers to a public GitHub permalink that reveals the user's
home-directory identity, local SDK/tool inventory, and exact ignored forensic paths. The site
passes its own "no private paths in output" check because the sensitive strings live in the linked
document rather than the generated HTML.

**Suggested fix**

Create a publication-specific source catalog:

1. Allowlist exact file plus line-range/excerpt IDs, not whole historical reports.
2. Scan the cited excerpt and all Markdown link destinations for absolute paths, usernames,
   ignored paths, secrets, raw-evidence extensions, and unsafe URL schemes.
3. Publish sanitized evidence excerpts or dedicated public-safe reports when a source fails.
4. Make commit-pinned repository links valid only for catalog entries that passed this content
   scan.
5. Add negative fixtures where a safe relative source points to a tracked report containing a
   forbidden transitive link.

Hash-freezing unsafe input prevents drift; it does not sanitize it.

### 4. High — The PR-to-self-hosted-runner security test is specified as a string check, not a workflow-graph check

**Severity:** High
**Location:** `phase-07-unify-testing-build-and-github-pages-deployment.md:176-192,224-243`

**Flaw**

The plan says to assert that the site PR workflow contains no `self-hosted` or Creator job. That
does not prove that untrusted pull-request content cannot reach a self-hosted runner. `runs-on`
expressions/matrices and reusable workflows can move the runner selection out of the file being
searched.

Plan evidence:

- `phase-07-unify-testing-build-and-github-pages-deployment.md:178-180`: the specified control is
  absence of two strings in the new workflow.
- `phase-07-unify-testing-build-and-github-pages-deployment.md:232-233`: the plan nevertheless
  treats "PR content cannot reach self-hosted" as a critical security guarantee.

Actual-repository evidence:

- `tests/github-pages-workflow.test.mjs:13-37` uses regular-expression/string assertions for
  triggers and runner labels.
- `tests/github-pages-workflow.test.mjs:62-81` infers gate ordering with `String.indexOf`, not a
  parsed job/needs graph.
- `.github/workflows/deploy-web-mobile-pages.yml:13-20` shows why runner selection is sensitive:
  the game job executes on the repository-scoped macOS Creator machine.

**Failure scenario**

The PR workflow contains no literal `self-hosted` string but calls a local reusable workflow whose
job targets the Creator runner, or computes `runs-on` through a matrix/expression. The string test
passes. Opening or updating a pull request then executes attacker-controlled repository content
on the owner's machine.

**Suggested fix**

Parse YAML and validate the transitive workflow graph:

- allowlist exact GitHub-hosted labels for every job reachable from `pull_request`;
- reject `pull_request_target`;
- reject expressions or matrices in `runs-on` for PR-reachable jobs;
- recursively resolve local reusable workflows and composite actions;
- require remote reusable workflows/actions to be full-SHA pinned and separately reviewed;
- enforce workflow-file ownership/branch protection outside the test suite.

Add adversarial fixtures for indirect reusable workflows, matrices, expressions, and
`pull_request_target`.

### 5. High — Mutable action tags are deliberately retained on privileged and self-hosted jobs

**Severity:** High
**Location:** `phase-07-unify-testing-build-and-github-pages-deployment.md:211-220`

**Flaw**

The plan preserves action major-version tags as the default. Major tags are mutable references;
they do not make the executed code reproducible or reviewable by content hash.

Plan evidence:

- `phase-07-unify-testing-build-and-github-pages-deployment.md:215-217`: keep currently proven
  action major versions unless a version change is needed.

Actual-repository evidence:

- `.github/workflows/deploy-web-mobile-pages.yml:31-34` uses `actions/checkout@v6` on the
  self-hosted runner.
- `.github/workflows/deploy-web-mobile-pages.yml:140-163` uses
  `actions/configure-pages@v5`, `actions/upload-pages-artifact@v4`, and
  `actions/deploy-pages@v4`.
- `plans/260721-2253-pencil-blade-restoration/reports/github-infrastructure-2026-07-25.md:14-21`
  records that the self-hosted runner is repository-scoped and its service runs under the local
  user.
- `tests/github-pages-workflow.test.mjs:84-92` institutionalizes the mutable tags rather than
  checking immutable SHAs.

**Failure scenario**

An action tag is retargeted after review or its upstream release is compromised. The next manual
deployment executes new code on the owner's workstation, or in the deploy job with
`pages: write`/`id-token: write`. The repository commit and lockfiles remain unchanged, so the
planned evidence snapshot cannot explain what ran.

**Suggested fix**

Pin every action and reusable workflow to a full commit SHA, with a comment recording the human
version. Add a reviewed dependency-update process and tests that require a 40-hex SHA. Preserve
`persist-credentials: false` on checkout and separately pin any future download/cache/setup
actions introduced by the split workflow.

### 6. High — “Known-good commit” rollback is not a known-good artifact under the stated toolchain

**Severity:** High
**Location:** `plan.md:190-200`;
`phase-07-unify-testing-build-and-github-pages-deployment.md:218-222,290-297`;
`phase-08-complete-launch-qa-legal-review-and-editorial-release.md:285-295`

**Flaw**

The plan explicitly supersedes artifact-only rollback with a full rebuild/redeploy from a
known-good commit. That is a valid user decision only if the rebuild is hermetic and proves the
same bytes. The current execution contract is not hermetic: Node accepts five major versions and
all workflow actions use mutable major tags. A historical commit therefore does not identify a
historical artifact.

Plan evidence:

- `phase-07-unify-testing-build-and-github-pages-deployment.md:221-222`: rebuild the entire
  pipeline; do not reuse/splice a prior artifact.
- `phase-08-complete-launch-qa-legal-review-and-editorial-release.md:287-292`: re-dispatch the split
  workflow and call the result a known-good redeploy.
- The superseded architecture input recommended keeping the last-good digest and deployment run
  specifically to avoid rebuilding under pressure
  (`plans/260725-2334-pencil-blade-interactive-case-study/reports/site-h5-pages-architecture.md:145-149`).

Actual-repository evidence:

- `.github/workflows/deploy-web-mobile-pages.yml:53-60` accepts Node `v22.*` through `v26.*`.
- `.github/workflows/deploy-web-mobile-pages.yml:32,141,144,163` resolves mutable action tags.

**Failure scenario**

A site compromise requires urgent rollback. Rebuilding the last known-good commit now selects a
new Node major or retargeted action release. It produces different bytes or fails, leaving no
rapid path back to the previously reviewed deployment. Worse, a newly compromised dependency can
infect the "rollback" despite the selected source commit being clean.

**Suggested fix**

Do not silently reverse the explicit rebuild decision; choose one of these concrete policies:

- **Keep full rebuild:** pin exact Node patch/runtime, action SHAs, Creator binary, package
  lockfiles, and all build inputs; store the prior signed composite digest; require the rebuilt
  tree to match that digest byte-for-byte before deployment.
- **Incident rollback:** retain an immutable, access-controlled last-good Pages bundle plus
  provenance/digest for immediate redeploy, then perform a clean rebuild as a follow-up
  verification.

Whichever policy is selected, acceptance must prove a rollback drill, not merely document four
commands.

### 7. High — The MDX/JSON-LD contract does not close build-time execution or persistent-XSS paths

**Severity:** High
**Location:** `phase-02-build-astro-platform-and-content-pipeline.md:50-71,148-170,217-230`;
`phase-03-create-editorial-design-system-and-global-experience.md:123-132`

**Flaw**

"Local authors, no raw HTML, component allowlist" is not an MDX security boundary. MDX supports
ESM/import/export and JavaScript expressions unless those syntax nodes are rejected. Separately,
JSON-LD embedded in a `<script>` needs a serializer that escapes the HTML script-closing
boundary; a generic "no raw HTML" `BaseLayout` API does not specify that invariant.

Plan evidence:

- `phase-02-build-astro-platform-and-content-pipeline.md:66-70,160-161`: only raw HTML escaping and
  a local component allowlist are required.
- `phase-02-build-astro-platform-and-content-pipeline.md:221-225`: local authors are the primary
  mitigation for executable MDX.
- `phase-03-create-editorial-design-system-and-global-experience.md:125-126`: `BaseLayout` accepts
  JSON-LD without defining a safe script serializer.

Actual-repository evidence:

- `scripts/audit-web-build.mjs:513-528` scans static JavaScript URL/network patterns, not DOM
  injection sinks, MDX syntax nodes, or JSON-in-script boundaries.
- `scripts/verify-web-mobile-build.mjs:165-170` adds `X-Content-Type-Options` only on the local
  verification server; it is not a production Pages header.
- The architecture input records that GitHub Pages offers no custom response-header control
  (`plans/260725-2334-pencil-blade-interactive-case-study/reports/site-h5-pages-architecture.md:138-143`).
- Repository/plan scan found no Content-Security-Policy contract.

**Failure scenario**

A mistaken or malicious content change uses an MDX expression/ESM import that executes during the
build, or a claim title containing `</script>` is serialized into JSON-LD without escaping `<`.
The protected-main deployment publishes persistent script execution to every reader. A component
allowlist does not intercept either path.

**Suggested fix**

Define an AST-level content policy:

- reject MDX ESM, import/export, JavaScript expressions, raw HTML, event attributes, dangerous URL
  schemes, and unapproved element/component names;
- serialize JSON-LD with a dedicated routine that escapes `<`, `>`, `&`, U+2028, and U+2029, and
  never accepts pre-serialized/raw HTML;
- add negative fixtures for MDX ESM, expressions, event handlers, `javascript:` URLs,
  `</script>` payloads, and Astro raw-HTML directives;
- add a route-appropriate CSP (meta policy if Pages headers remain unavailable), accounting
  explicitly for any hashed inline JSON-LD and for the separate game route's runtime needs.

### 8. Medium — Two preselected “source-backed” AI episodes are false or unsupported by tracked evidence

**Severity:** Medium
**Location:** `phase-05-build-ai-lab-and-evidence-explorer.md:133-156`

**Flaw**

The AI Lab requirements prestate an Electric/Magnet/Dragon toss-direction ABI error and a
deploy-service timeout as facts, while requiring public-safe repository evidence. The tracked
review evidence says the direction ABI was correct; it found a Dragon registry/lifecycle
contract defect instead. The repository records deployment attempt 2, but the tracked
infrastructure incident is a runner broker `500/502/504` episode, not a documented deploy-service
timeout.

Plan evidence:

- `phase-05-build-ai-lab-and-evidence-explorer.md:138-152`: both stories are listed as
  source-backed episode candidates.
- `phase-05-build-ai-lab-and-evidence-explorer.md:153-156`: every episode must carry a
  publishable repository report/test/commit source.

Actual-repository evidence:

- `plans/260721-2253-pencil-blade-restoration/reports/reviewer-2026-07-23-crazy-runtime-checkpoint.md:28-37`
  says the recovered `af`/`ae`/`ad` Down ABI is correct and identifies the still-fail-closed
  Dragon registry/lifecycle gap.
- The same review details the valid `ad` direction contract and downstream registry exception at
  lines 49-68.
- `plans/260721-2253-pencil-blade-restoration/reports/tester-2026-07-23-crazy-contract-direction-checkpoint.md:75-93`
  records the named Down-ABI regression as passing.
- `docs/cocos-creator-build-audit.md:105-119` records run attempt 2 but gives no timeout cause.
- `plans/260721-2253-pencil-blade-restoration/reports/github-infrastructure-2026-07-25.md:69-80`
  documents a self-hosted runner broker incident, not a Pages deploy-service timeout.

**Failure scenario**

The public case study claims that review caught an ABI direction bug even though its linked review
says the ABI was correct. Readers following the evidence find the contradiction, directly
undermining the site's "proof, not claims" premise.

**Suggested fix**

Replace the ABI story with the verified finding: review confirmed the Down ABI but caught the
Dragon batch/registry and disposal-ownership contradictions while the route remained fail-closed.
Include the deploy-timeout story only if a tracked public-safe report or immutable Actions record
identifies that exact failure; otherwise describe the verified broker-availability incident or
omit it.

## Full-Tier Fact-Check Ledger

`VERIFIED` means the claim is supported by the current repository. `FAILED` means repository
evidence contradicts it. `UNVERIFIED` means it describes a proposed artifact/interface that does
not exist yet, or a historical assertion for which the tracked repository lacks proof; this is not
automatically a defect unless the plan presents it as an established public fact.

All 104 local Markdown links across `plan.md` and the eight phase files were resolved: **104
present, 0 missing**. File inventories were also checked by action class: existing `Read`/`Modify`
targets are present; planned `Create` targets under `site/`, new scripts, new tests, and new docs
are currently absent as expected. Existing symbols/config constants were verified with direct
repository search and file reads.

### Phase 1 — 15 sampled claims

| # | Claim | Verdict | Evidence |
|---:|---|---|---|
| 1 | Project is a static-only clean-room reconstruction | VERIFIED | `README.md:1-15` |
| 2 | Cocos Creator 3.8.8 + TypeScript is the implementation baseline | VERIFIED | `README.md:11-14`; `docs/project-overview-pdr.md:55-68` |
| 3 | Exactly two technical outputs are supported | VERIFIED | `README.md:11-14`; `docs/project-overview-pdr.md:55-58` |
| 4 | Enriched application-function count is 713 | VERIFIED | `docs/reconstruction-report.md:33-38` |
| 5 | Canonical game-asset count is 862 | VERIFIED | `docs/reconstruction-report.md:38-46` |
| 6 | H5 tree is 2,539 files / 39,613,694 bytes / recorded digest | VERIFIED | `.../runtime-matrix/h5-runtime-matrix.json:9-14` |
| 7 | Exactly six production captures are the frozen media set | VERIFIED | `.../production-pages/production-pages-runtime.json:72-84,138-150`; six tracked PNGs found |
| 8 | Academic Pages release is owner-approved | VERIFIED | `docs/release-rights-checklist.md:3-13,54-60` |
| 9 | Commercial/public-variant clearance remains blocked | VERIFIED | `release/public-release-variant-manifest.json:13-18` |
| 10 | Recovered bytes are not automatically licensed by repository licensing | VERIFIED | `README.md:27-42` |
| 11 | Completed restoration reports exist as historical inputs | VERIFIED | `plans/260721-2253-pencil-blade-restoration/reports/` |
| 12 | `reference/case-study-publication-manifest.json` exists | UNVERIFIED | Planned Create target; absent |
| 13 | `validatePublicationManifest` exists | UNVERIFIED | Planned symbol; absent |
| 14 | `validateEvidenceSnapshot` exists | UNVERIFIED | Planned symbol; absent |
| 15 | Publication-policy negative tests exist | UNVERIFIED | Planned test file; absent |

Phase 1 totals: **11 VERIFIED / 0 FAILED / 4 UNVERIFIED**.

### Phase 2 — 15 sampled claims

| # | Claim | Verdict | Evidence |
|---:|---|---|---|
| 1 | Repository currently has no root web package | VERIFIED | only `game/package.json` and `game/package-lock.json` exist |
| 2 | An isolated `site/` package does not yet exist | VERIFIED | `site/` absent |
| 3 | Current Pages base is `/pencil-blade-2026/` | VERIFIED | `scripts/verify-web-mobile-build.mjs:19`; `docs/project-overview-pdr.md:69-70` |
| 4 | Current verifier is fixed to one Pages prefix | VERIFIED | `scripts/verify-web-mobile-build.mjs:19,69-113,179-204` |
| 5 | Current H5 matrix defaults to the raw game build | VERIFIED | `scripts/run-h5-runtime-matrix.mjs:24-25,369-377` |
| 6 | Fidelity JSON input path exists | VERIFIED | `forensics/fidelity/fidelity-report-v1.json` |
| 7 | Native function-summary input path exists | VERIFIED | `forensics/native/function-enrichment-summary.json` |
| 8 | Technical closeout JSON input exists | VERIFIED | `plans/260721-2253-pencil-blade-restoration/reports/technical-closeout-manifest.json` |
| 9 | `site/package.json` is implemented | UNVERIFIED | Planned Create target; absent |
| 10 | Astro static/base/i18n configuration is implemented | UNVERIFIED | `site/astro.config.mjs` absent |
| 11 | Zod-backed content collections are implemented | UNVERIFIED | `site/src/content.config.ts` absent |
| 12 | `withBase` and locale route helpers exist | UNVERIFIED | Planned symbols/files; absent |
| 13 | `repositoryPermalink` exists | UNVERIFIED | Planned symbol; absent |
| 14 | Deterministic public-facts generator exists | UNVERIFIED | Planned script; absent |
| 15 | Site content/link/locale negative tests exist | UNVERIFIED | Planned tests; absent |

Phase 2 totals: **8 VERIFIED / 0 FAILED / 7 UNVERIFIED**.

### Phase 3 — 15 sampled claims

| # | Claim | Verdict | Evidence |
|---:|---|---|---|
| 1 | Editorial experience specification exists | VERIFIED | `reports/editorial-experience-spec.md` |
| 2 | Recovered game fonts must stay outside the editorial shell | VERIFIED | `README.md:27-34`; Phase 1 policy decision |
| 3 | The repository has recovered game imagery but no case-study brand asset set | VERIFIED | `game/assets/game/`; planned `site/src/assets/brand/*` absent |
| 4 | No current Astro layout/design-system implementation exists | VERIFIED | `site/` absent |
| 5 | `BaseLayout` exists with the planned metadata/JSON-LD API | UNVERIFIED | Planned file/symbol; absent |
| 6 | Header, footer, chapter rail, and locale switcher exist | UNVERIFIED | Planned components; absent |
| 7 | Evidence drawer implements focus trapping and return | UNVERIFIED | Planned component/script; absent |
| 8 | Recovered/inferred/unknown statuses have non-color encodings | UNVERIFIED | Design requirement only |
| 9 | Motion is disabled under reduced-motion | UNVERIFIED | Design requirement only |
| 10 | Print layout expands evidence details and URLs | UNVERIFIED | Design requirement only |
| 11 | `case-study-mark.svg` is project-authored and rights-safe | UNVERIFIED | Planned asset; absent |
| 12 | Shell accessibility Playwright suite exists | UNVERIFIED | Planned tests; absent |
| 13 | Responsive visual smoke exists at all stated viewports | UNVERIFIED | Planned tests; absent |
| 14 | Design-system policy test rejects external requests | UNVERIFIED | Planned test; absent |
| 15 | JSON-LD is emitted without a raw-HTML boundary | UNVERIFIED | Planned API; absent and underspecified (Finding 7) |

Phase 3 totals: **4 VERIFIED / 0 FAILED / 11 UNVERIFIED**.

### Phase 4 — 15 sampled claims

| # | Claim | Verdict | Evidence |
|---:|---|---|---|
| 1 | Source APK was never installed/executed as a project gate | VERIFIED | `docs/project-overview-pdr.md:43-53` |
| 2 | Static-only evidence classification is authoritative | VERIFIED | `docs/project-overview-pdr.md:43-50` |
| 3 | Function map contains 713/713 enriched functions | VERIFIED | `docs/reconstruction-report.md:33-38` |
| 4 | Canonical corpus is 862 assets | VERIFIED | `docs/reconstruction-report.md:38-46` |
| 5 | Runtime-consumed denominator is 761 | VERIFIED | `docs/reconstruction-report.md:41-44` |
| 6 | Residual/exception/blocker record count is 25 | VERIFIED | `docs/reconstruction-report.md:61-71` |
| 7 | Zero unexplained divergences are recorded | VERIFIED | `docs/reconstruction-report.md:70-71` |
| 8 | Original-runtime identity flag is false | VERIFIED | `docs/reconstruction-report.md:70-71` |
| 9 | PTM ratio is 32 | VERIFIED | `forensics/contracts/classic-physics-contract.md:41-42` |
| 10 | Physics step is variable `frameDt * worldSpeed` at 10/10 | VERIFIED | `forensics/contracts/classic-physics-contract.md:62-72,279-289` |
| 11 | Forward/reverse rays and deferred destruction are contract-backed | VERIFIED | `forensics/contracts/classic-physics-contract.md:202-265,286-289` |
| 12 | `/story/` bilingual chapter pages exist | UNVERIFIED | Planned `site/` routes; absent |
| 13 | `/forensics/` evidence-chain UI exists | UNVERIFIED | Planned `site/` routes; absent |
| 14 | `/reconstruction/` chapter exists | UNVERIFIED | Planned `site/` routes; absent |
| 15 | Runtime figures have generated rights-safe derivatives | UNVERIFIED | Planned media work; absent |

Phase 4 totals: **11 VERIFIED / 0 FAILED / 4 UNVERIFIED**.

### Phase 5 — 15 sampled claims

| # | Claim | Verdict | Evidence |
|---:|---|---|---|
| 1 | Java was a shell around a native Cocos2d-x/ARM surface | VERIFIED | `docs/static-reconstruction-method.md`; `docs/reconstruction-report.md:33-51` |
| 2 | 713 native application functions were mapped | VERIFIED | `docs/reconstruction-report.md:33-38` |
| 3 | Original runtime remained unavailable and method became static-only | VERIFIED | `README.md:1-15`; `docs/project-overview-pdr.md:5-8,52-53` |
| 4 | Blade/Physics2D variable-step and ray contracts exist | VERIFIED | `forensics/contracts/classic-physics-contract.md:62-72,202-289` |
| 5 | 862 resources reconcile to zero unknown dispositions | VERIFIED | `docs/reconstruction-report.md:38-46` |
| 6 | Five-domain fidelity is 100% with no inference credit | VERIFIED | `docs/reconstruction-report.md:53-77` |
| 7 | Crazy route was fail-closed at the cited checkpoint | VERIFIED | `.../reviewer-2026-07-23-crazy-runtime-checkpoint.md:28-37` |
| 8 | Dragon registry/lifecycle contradictions were caught in review | VERIFIED | same report `:49-78` |
| 9 | Production Pages run was attempt 2 | VERIFIED | `docs/cocos-creator-build-audit.md:105-119` |
| 10 | Runner broker had tracked 500/502/504 availability failures | VERIFIED | `.../github-infrastructure-2026-07-25.md:69-80` |
| 11 | Review caught an Electric/Magnet/Dragon toss-direction ABI error | FAILED | Reviewer says ABI correct; direction regression passed (Finding 8) |
| 12 | A tracked public-safe source proves a deploy-service timeout | UNVERIFIED | attempt 2 is recorded; exact cause absent |
| 13 | AI Lab pages and episode collection exist | UNVERIFIED | Planned `site/` routes/content; absent |
| 14 | Evidence-explorer URL filtering is implemented | UNVERIFIED | Planned client script; absent |
| 15 | `generateAiLabIndex` and its negative tests exist | UNVERIFIED | Planned symbol/tests; absent |

Phase 5 totals: **10 VERIFIED / 1 FAILED / 4 UNVERIFIED**.

### Phase 6 — 15 sampled claims

| # | Claim | Verdict | Evidence |
|---:|---|---|---|
| 1 | Raw H5 currently serves under `/pencil-blade-2026/` | VERIFIED | `scripts/verify-web-mobile-build.mjs:19`; runtime JSON `:9-14` |
| 2 | H5 output is ignored build state | VERIFIED | `.gitignore:18-23` |
| 3 | Current verifier assumes one fixed prefix | VERIFIED | `scripts/verify-web-mobile-build.mjs:19,179-204` |
| 4 | Current runtime matrix assumes raw-game entry at that prefix | VERIFIED | `scripts/run-h5-runtime-matrix.mjs:19-25,203,369-425` |
| 5 | Game uses localStorage in production | VERIFIED | `game/assets/scripts/creator/classic-settings-runtime.ts:311-319` |
| 6 | Runtime matrix explicitly validates localStorage | VERIFIED | `scripts/run-h5-runtime-matrix.mjs:252-275` |
| 7 | Game storage keys are not site-namespaced | VERIFIED | `classic-settings-state.ts:806-820`; `mode-select-state.ts:818-820` |
| 8 | No parent↔game postMessage bridge currently exists | VERIFIED | repository symbol search found none in production game/site code |
| 9 | Existing raw H5 audit/prefix verification passes | VERIFIED | `docs/cocos-creator-build-audit.md:105-119` |
| 10 | Production evidence has both 480x800 and 720x1280 rows | VERIFIED | production runtime JSON `:21-29,88-92` |
| 11 | Same-origin frame shares storage/DOM capability | VERIFIED | architecture input `:249-255`; browser model reflected by current storage use |
| 12 | Same-origin child “receives no DOM handles” | FAILED | `window.parent`/same-origin DOM capability contradicts claim (Finding 2) |
| 13 | `/play/` launcher and `/play/game/` nested mount exist | UNVERIFIED | Planned `site/`; absent |
| 14 | H5 verifier is parameterized for both mount paths | UNVERIFIED | Proposed interface; current prefix is fixed |
| 15 | Documentary pre/post-click iframe smoke exists | UNVERIFIED | Planned tests; absent |

Phase 6 totals: **11 VERIFIED / 1 FAILED / 3 UNVERIFIED**.

### Phase 7 — 15 sampled claims

| # | Claim | Verdict | Evidence |
|---:|---|---|---|
| 1 | Current deployment workflow is manual-only | VERIFIED | `.github/workflows/deploy-web-mobile-pages.yml:1-5` |
| 2 | Game job targets the four pinned self-hosted labels | VERIFIED | workflow `:13-20` |
| 3 | Game job checks protected-main event/ref | VERIFIED | workflow `:15,39-41` |
| 4 | Checkout disables persisted credentials | VERIFIED | workflow `:30-35` |
| 5 | Creator executable has a pinned SHA-256 | VERIFIED | workflow `:24-27,50-52` |
| 6 | Node runtime is not exact-pinned | VERIFIED | workflow accepts v22-v26 at `:53-60` |
| 7 | Game install uses locked dependencies and ignores lifecycle scripts | VERIFIED | workflow `:62-65` |
| 8 | Current portable-root test selection is a shell glob/denylist | VERIFIED | workflow `:102-125` |
| 9 | Raw game audit precedes upload | VERIFIED | workflow `:133-146`; textual test `tests/github-pages-workflow.test.mjs:62-81` |
| 10 | Deploy job has Pages/OIDC permissions only | VERIFIED | workflow `:148-163` |
| 11 | Current Pages actions use mutable major tags | VERIFIED | workflow `:32,141,144,163` |
| 12 | Current workflow tests are regex/string-order based | VERIFIED | `tests/github-pages-workflow.test.mjs:13-92` |
| 13 | GitHub-hosted-only site PR workflow exists | UNVERIFIED | Planned workflow; absent |
| 14 | Composite Pages assembler/audit exists | UNVERIFIED | Planned scripts; absent |
| 15 | Workflow tests prove transitive PR runner isolation | UNVERIFIED | Planned guarantee; current tests do not prove it |

Phase 7 totals: **12 VERIFIED / 0 FAILED / 3 UNVERIFIED**.

### Phase 8 — 15 sampled claims

| # | Claim | Verdict | Evidence |
|---:|---|---|---|
| 1 | Current production URL is the stated GitHub Pages URL | VERIFIED | production runtime JSON `:3-10` |
| 2 | Recorded deployment is run 30161202889, attempt 2 | VERIFIED | production runtime JSON `:5-10` |
| 3 | Recorded deployed commit is `c942ba...` | VERIFIED | production runtime JSON `:5-10` |
| 4 | Production reachability checked 2,539/2,539 files | VERIFIED | production runtime JSON `:16-20` |
| 5 | Both supported production viewports passed | VERIFIED | production runtime JSON `:21-29,88-92,152-155` |
| 6 | Recorded rows have zero page/request/bad-response failures | VERIFIED | production runtime JSON `:68-70,134-136` |
| 7 | Six production captures have recorded hashes | VERIFIED | production runtime JSON `:72-84,138-150` |
| 8 | Academic Pages scope is owner-approved but not a license | VERIFIED | `docs/release-rights-checklist.md:3-13` |
| 9 | Commercial release decision remains blocked | VERIFIED | `release/public-release-variant-manifest.json:13-18` |
| 10 | Current workflow deploys to the production Pages environment | VERIFIED | workflow `:148-163` |
| 11 | Existing docs describe a game-only deployment | VERIFIED | `docs/cocos-creator-build-audit.md:96-119` |
| 12 | Final bilingual `/about/` routes exist | UNVERIFIED | Planned site routes; absent |
| 13 | Production case-study smoke script exists | UNVERIFIED | Planned script; absent |
| 14 | Case-study deployment guide and launch checklist exist | UNVERIFIED | Planned docs; absent |
| 15 | Final social previews/structured metadata exist and are rights-reviewed | UNVERIFIED | Planned assets/data; absent |

Phase 8 totals: **11 VERIFIED / 0 FAILED / 4 UNVERIFIED**.

## Verification Counts

- Plan documents reviewed: **9** (`plan.md` + 8 phase files)
- Research inputs reviewed: **3**
- Concrete claims sampled: **120** (**15 per phase**)
- Claim results: **78 VERIFIED / 2 FAILED / 40 UNVERIFIED**
- Existing local Markdown links checked: **104 present / 0 missing**
- Failed factual claims promoted to findings: **2**
- Findings: **8 total** — **1 Critical / 6 High / 1 Medium**
- Tests/builds/lint run: **0** (review constraint)

## Required Plan Actions

1. Move pre-public owner/editorial/rights approval before the production deploy.
2. Resolve the same-origin iframe security model and remove the false isolation claim.
3. Validate cited content and transitive links, not only repository-relative source paths.
4. Replace textual workflow assertions with transitive parsed workflow-graph policy.
5. Full-SHA pin Actions and decide a genuinely reproducible rollback policy.
6. Add an AST-level MDX policy, safe JSON-LD serialization, CSP, and adversarial fixtures.
7. Correct or remove the two unsupported AI Lab incident narratives.

## Unresolved Questions

1. Is a separate origin acceptable for the game, or is same-origin Pages hosting a fixed product
   constraint whose lack of security isolation must be explicitly accepted?
2. For rollback, does the owner prefer a fully hermetic rebuild with byte-for-byte digest equality,
   or retention of a signed last-good artifact for incident recovery?
3. Is there a tracked, public-safe Actions record proving the claimed deploy-service timeout? If
   not, that episode must not ship as fact.

Status: DONE_WITH_CONCERNS
Summary: Full red-team review completed; the amended academic waiver and frozen H5/capture scope verify, but release ordering, same-origin trust, citation leakage, workflow enforcement, supply-chain pinning, rollback reproducibility, and MDX execution require plan changes.
Concerns/Blockers: One critical pre-public gate-order defect, six high-risk security/reliability defects, and two contradicted/unsupported public-story claims.
