---
phase: 8
title: "Approve Deploy and Verify the Production Release"
status: pending
priority: P1
dependencies: [7]
effort: "4-6 days"
---

# Phase 8: Approve Deploy and Verify the Production Release

## Context Links

- [Phase 7 deployment integration](./phase-07-unify-testing-build-and-github-pages-deployment.md)
- [Editorial experience spec](./reports/editorial-experience-spec.md)
- [Site/H5/Pages architecture report](./reports/site-h5-pages-architecture.md)
- [Phase 1 public narrative and evidence contract](./phase-01-establish-public-narrative-and-evidence-contract.md)
- [Phase 2 Astro platform and content pipeline](./phase-02-build-astro-platform-and-content-pipeline.md)
- [docs/project-overview-pdr.md](../../docs/project-overview-pdr.md)
- [docs/compatibility-matrix.md](../../docs/compatibility-matrix.md)
- [docs/system-architecture.md](../../docs/system-architecture.md)
- [docs/cocos-creator-build-audit.md](../../docs/cocos-creator-build-audit.md)
- [README.md](../../README.md)
- [scripts/verify-release-rights.mjs](../../scripts/verify-release-rights.mjs)
- [scripts/run-h5-runtime-matrix.mjs](../../scripts/run-h5-runtime-matrix.mjs)
- [tests/release-manifests.test.mjs](../../tests/release-manifests.test.mjs)
- [tests/verify-release-rights.test.mjs](../../tests/verify-release-rights.test.mjs)
- [tests/github-pages-workflow.test.mjs](../../tests/github-pages-workflow.test.mjs)

## Overview

Approve the public editorial release only after the immutable Phase 7 candidate has passed site,
game, composition, runtime, source-safety, and launch-source gates. This phase reviews that exact
candidate digest, records owner/editorial/Vietnamese/rights decisions, releases the waiting
protected-environment job, and verifies the deployed bytes. It adds no site source, routes,
metadata, media, tests, or smoke tooling; any source correction creates a new commit/candidate and
restarts approval.

The launch surface is bilingual, evidence-first, and clean-room strict. It must present the
editorial case study clearly, keep the playable game behind `/play/`, and avoid inflating
technical fidelity beyond the frozen evidence corpus.

## Key Insights

- Technical candidate readiness does not equal authorization to publish.
- Rights review must remain separate from build verification.
- Bilingual copy needs the same technical meaning in both languages, not a literal machine
  translation that changes claim strength.
- Performance matters at launch because the site and game are large enough to fail on weak
  mobile contexts if the launcher is too eager.
- The historical audit proves the restoration-era game-only artifact. This phase proves the new
  candidate and production deployment through the separate case-study release manifest.

## Requirements

### Functional

- Review all launch pages in English and Vietnamese for accuracy, translation parity, and
  claim strength on the exact Phase 7 candidate.
- Verify editorial paths:
  - `/`
  - `/story/`
  - `/forensics/`
  - `/reconstruction/`
  - `/ai-lab/`
  - `/evidence/`
  - `/about/`
  - `/play/`
  - every corresponding `/vi/...` route.
- Verify the embedded game flow from launcher to `/play/game/`.
- Verify the candidate content/tree-manifest digests and workflow run before approving the
  protected `github-pages` environment. The deploy job must use the waiting same-run Pages
  artifact without rebuild or mutation.
- Smoke test the live production artifact and compare every manifest-listed public file, release
  provenance, and GitHub deployment identity with the approved candidate.
- Review all claims, screenshots, captions, and citations for consistency with the publication
  manifest.
- Confirm the launch copy states the clean-room boundary, noncommercial scope, and original
  runtime non-observation clearly.
- Validate that the composed tree stays within Phase 1's frozen owner waiver for the audited H5
  and six runtime captures while preserving the commercial/public-variant manifest's fail-closed
  result. Do not reopen individual asset clearance as an academic launch gate.
- Verify the already-authored per-route social previews, canonical metadata, reciprocal
  `hreflang`, sitemap, robots, structured data, and media records; do not create them here.

### Non-functional

- Bilingual parity for launch-critical facts.
- No custom domain at launch.
- No analytics, tracking pixels, or marketing automation.
- No extra CDN dependencies.
- No hidden preload that undermines mobile performance.
- Accessibility and performance must pass on the exact candidate before approval and be sampled
  again on production after deploy.
- Editorial routes target LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1, zero axe
  serious/critical findings, and Lighthouse mobile scores ≥ 90 performance and ≥ 95 for
  accessibility, best practices, and SEO.
- No game file may be requested from a non-play route or from `/play/` before explicit activation.

## Architecture

```text
immutable Phase 7 candidate
        │
        ├── pre-public editorial QA
        │   ├── bilingual copy
        │   ├── links/citations
        │   ├── accessibility
        │   └── SEO metadata
        │
        ├── pre-public launch QA
        │   ├── /play/ launcher
        │   ├── iframe /play/game/
        │   └── runtime smoke
        │
        ├── pre-public rights/owner QA
        │   ├── release manifest checks
        │   └── asset/license boundaries
        │
        └── protected environment approval
                         │
                         v
                same-artifact Pages deploy
                         │
                         v
             manifest-wide production smoke
```

Release rule:

- The launch QA phase accepts only the exact candidate and workflow run produced by Phase 7.
- Any content, media, test, tool, or metadata correction invalidates approval and requires a new
  protected-main candidate.
- Environment approval is bound to the workflow run plus displayed `contentTreeDigest` and
  tree-manifest digest.
- Deployment performs no checkout/build/composition. Post-deploy smoke is observational only.

## File Inventory

All paths are repository-relative.

| Action | Path | Purpose | Test impact |
|---|---|---|---|
| Create | `docs/case-study-deployment-guide.md` | Reproducible build, composition, deployment, and rollback operations | Docs/link review |
| Create | `docs/case-study-launch-checklist.md` | Owner, editorial, translation, rights, a11y, performance, SEO, and smoke sign-offs | Docs/link review |
| Modify | `docs/project-overview-pdr.md` | Reflect public launch facts and any approved messaging changes | Docs review |
| Modify | `docs/code-standards.md` | Record exact Node/toolchain, verifier CLI/config, site/game test boundaries | Docs/command review |
| Modify | `docs/codebase-summary.md` | Add isolated Astro package and final Pages artifact boundary | Docs review |
| Modify | `docs/compatibility-matrix.md` | Record final published route and runtime matrix | Docs review |
| Modify | `docs/system-architecture.md` | Reflect final site/game composition and production launch shape | Docs review |
| Modify | `docs/cocos-creator-build-audit.md` | Reflect final deploy path and launch audit state | Docs review |
| Modify | `docs/release-rights-checklist.md` | Record exact academic case-study sign-off without changing commercial verdict | Rights/docs review |
| Modify | `docs/reconstruction-report.md` | Link the shipped case study and final composed runtime proof | Evidence/docs review |
| Modify | `docs/evidence-register.md` | Register the new case-study candidate/production report without mutating historical H5 evidence | Evidence/docs review |
| Modify | `README.md` | Public-facing summary of the composed Pages experience | Docs review |
| Create | `plans/260725-2334-pencil-blade-interactive-case-study/reports/candidate-approval-request.json` | Archived copy of the Phase 7 preapproval request/review record; no future-event placeholder | Release record |
| Create | `plans/260725-2334-pencil-blade-interactive-case-study/reports/deployment-approval-evidence.json` | Archived post-event environment review/deployment evidence emitted by Phase 7 tooling | Release record |
| Create | `plans/260725-2334-pencil-blade-interactive-case-study/reports/launch-qa-report.md` | Exact commit/tree hash, measurements, approvals, exceptions, and production proof | Release record |

## Function and Interface Checklist

- [ ] Phase 7's frozen `case-study-approval.mjs verify` command reruns candidate/release/
      tree-manifest checks and rejects any mismatch; Phase 8 adds no approval implementation.
- [ ] Existing Phase 7 `validateLaunchCopy`, link, a11y, performance, source, and rights gates are
      rerun against the unpacked candidate; this phase does not add alternate validators.
- [ ] The Phase 7 preapproval request records accountable role IDs, required Vietnamese/rights/
      attribution/correction checklist IDs, supporting candidate reports, exact candidate digests,
      and request date—never completed human decisions or a future approval event.
- [ ] Phase 7's post-event recorder supplies the separate environment reviewer/state/time/source
      and deployment identity; Phase 8 archives it only after schema/digest verification.
- [ ] `smokeProductionPages({ baseUrl, expectedCommit, reportDir })` confirms all bilingual routes,
      fetched release/tree-manifest identity, every listed file's bytes/MIME, lazy launcher
      behavior, and both supported H5 viewports.

## Implementation Steps

1. Select the successful Phase 7 workflow run. Download its normal candidate artifact, verify its
   tree-manifest SHA against the workflow summary, verify `case-study-release.json`, and serve it
   locally under the exact Pages prefix. If any expected input differs, reject the candidate.
2. Confirm the Phase 1 release inputs embedded in the candidate: final title, project-owner role,
   contributor roles, public correction/contact channel, attribution, non-affiliation,
   academic/noncommercial scope, and Vietnamese factual reviewer. Missing/changed input requires a
   new source commit and candidate; do not invent or patch the artifact.
3. Review the exact candidate in both languages:
   - headings;
   - chapter order;
   - evidence labels;
   - rights disclaimer;
   - player entry points;
   - links and citations.
4. Rerun accessibility and keyboard smoke against the candidate:
   - landmarks;
   - skip links;
   - heading order;
   - focus visibility;
   - iframe accessibility labels.
   - drawers/dialog focus trapping and focus return;
   - reduced-motion informative end states;
   - screen-reader alternatives for every diagram and the canvas;
   - 200% zoom and 320 px width without page-level horizontal overflow.
5. Rerun performance smoke on the candidate:
   - editorial home;
   - `/play/` launcher;
   - iframe load path;
   - no unnecessary network fan-out;
   - acceptable mobile rendering.
   - no game requests outside `/play/` or before activation;
   - editorial Web Vitals and Lighthouse budgets.
6. Review rights and scope language:
   - noncommercial/source-available positioning;
   - original runtime not observed;
   - recovered vs inferred vs unknown;
   - no commercial-clearance claim.
   - exact H5 and six capture records match the frozen academic owner waiver;
   - commercial/public-variant verdict remains unresolved/fail-closed.
7. Verify launch SEO metadata and project-authored media:
   - canonical URLs;
   - title/description;
   - social metadata;
   - sitemap coverage;
   - robots behavior.
   - reciprocal `hreflang` for every reviewed pair;
   - `TechArticle`, `SoftwareSourceCode` where accurate, and `BreadcrumbList` structured data;
   - rights-safe `1200×630` route previews.
8. Execute the three scripted candidate journeys—skeptical engineer, story learner, and
   player-first—with the project owner/editorial reviewer. Record task completion and corrections
   as qualitative sign-off, not invented statistical evidence. Schedule the separate
   15-participant study post-launch only with named recruitment, consent, retention, and research
   ownership.
9. Download the Phase 7 `candidate-approval-request.json`, run the frozen approval verifier, and
   confirm its commit/run/artifact/content/tree-manifest digests, required checklist IDs, roles,
   and supporting reports exactly match the waiting workflow. Complete every requested
   Vietnamese/rights/attribution/correction check, inspect repository environment/branch
   protection state, and require the configured human reviewer; then approve the protected
   `github-pages` environment. That protected review event is the human decision—the request
   contains no approval-event placeholder, and a plain workflow input is not approval.
10. After deployment, require the Phase 7 post-event job to emit
    `deployment-approval-evidence.json` from authenticated environment-review/deployment history.
    Verify actual approved state, reviewer/time/source reference, deployment identity, and the
    same request/candidate digests before treating authorization as evidenced.
11. Fetch `case-study-release.json` and the tree manifest with cache busting,
    compare expected commit/run/digests and GitHub deployment metadata, GET/hash every
    manifest-listed file with bounded concurrency, and validate acceptable live MIME. Then run
    both direct `/play/game/` and launcher-to-iframe journeys at `480×800` and `720×1280`; require
    all hard audio/storage/resume/geometry/fullscreen/error predicates.
12. On post-deploy failure, do not mark release complete. If a same-run deploy-service retry is
    valid, retry only the waiting immutable artifact. Otherwise execute the documented hermetic
    known-good rebuild; do not splice or patch artifacts. Record the single-runner RTO limitation.
13. After production verification, archive the verified preapproval request and postapproval
    evidence under this plan's reports, then finish the QA report. These later documentation
    commits are not release candidates; rollback selects the approved candidate commit and
    content digest recorded inside the evidence.
14. Update repository documentation only after production bytes and measurements are verified.
    Do not rewrite the historical restoration closeout as if it had covered the site.
15. Confirm no custom domain, analytics, tracking, or postMessage bridge shipped. Freeze the
    launch QA report and owner sign-off before marking release complete.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | English and Vietnamese pages disagree on claim strength | QA fails |
| Critical | Launch page hides rights or clean-room boundary | QA fails |
| Critical | Production `/play/` cannot reach `/play/game/` | Smoke fails |
| Critical | Live Pages URL differs from known-good commit/artifact pair | Release blocked |
| Critical | Candidate source/digest differs between human review and environment approval | Release blocked |
| Critical | Any launch-source change is made after candidate composition | Old approval invalid; new candidate required |
| Critical | Publication/media manifest expands beyond or cannot identify the frozen H5/capture waiver | Release blocked |
| Critical | Commercial rights manifest is changed to pass the academic launch | Rights regression; release blocked |
| High | Accessibility landmarks or headings are broken | QA fails |
| High | Production artifact emits off-origin requests | Smoke fails |
| High | Any manifest-listed production file is missing, has wrong bytes, or unacceptable MIME | Smoke fails |
| High | Canonical or metadata points outside the Pages base | SEO QA fails |
| High | Release manifest or rights records are stale | Rights QA fails |
| High | Non-play route or unopened launcher requests any game asset | Performance boundary fails |
| High | Axe reports serious/critical issue or keyboard/reduced-motion journey fails | Accessibility QA fails |
| Medium | Page load is obviously heavy on mobile | Performance QA fails |
| Medium | Site mentions custom domain or analytics at launch | Scope QA fails |

## Todo List

- [ ] Review all launch copy in both locales.
- [ ] Verify and locally serve the exact candidate/run/digests.
- [ ] Run accessibility, keyboard, and performance QA before environment approval.
- [ ] Confirm production URL and deployment identity.
- [ ] Validate rights and release manifest state.
- [ ] Freeze SEO metadata and canonical routes.
- [ ] Run all three scripted owner/editorial journeys and record qualitative sign-off.
- [ ] Confirm owner, contributor, attribution, correction, and translation-review inputs already
      frozen in the candidate.
- [ ] Approve the protected environment only for the recorded candidate digests.
- [ ] Archive distinct preapproval-request and postapproval/deployment-evidence records after the
      real event; neither mutates the deployed candidate.
- [ ] Fetch/hash/MIME-check every production manifest file.
- [ ] Publish launch QA report.
- [ ] Mark release complete only after all gates pass.

## Success Criteria

- [ ] The public site is readable, navigable, and technically honest in both languages.
- [ ] `/play/` clearly launches the game in `/play/game/` without leaking editorial chrome into
  the runtime.
- [ ] Accessibility, performance, and production smoke pass on the live artifact.
- [ ] Editorial pages meet the numeric Web Vitals/Lighthouse/axe thresholds.
- [ ] Non-play pages and unopened `/play/` issue zero game requests.
- [ ] Release-rights records are reviewed and remain separate from technical validation.
- [ ] No custom domain or analytics are introduced at launch.
- [ ] Launch docs reflect the actual shipped behavior.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Bilingual copy drifts semantically | Misleading public claim | Side-by-side review with shared claim IDs |
| Rights language overstates approval | Legal misrepresentation | Keep rights status explicit and separate from technical success |
| Missing contributor/translation/correction owner | Incorrect public attribution or unreviewed copy | Explicit sign-off fields; preview remains blocked |
| Production smoke differs from candidate smoke | Hosting-specific regression | Manifest-wide live bytes/MIME + route/runtime smoke |
| Human approval drifts from deployed bytes | Unauthorized publication | Bind environment review to run/content/tree-manifest digests |
| Accessibility regressions in launch shell | Poor public usability | Keyboard and semantic checks on the composed artifact |
| Performance regression due to the game iframe | Slow mobile load | Launcher-first flow, lazy iframe load, no extra dependencies |
| Editorial docs become stale after launch | Confusion for maintainers | Update docs only after verifying actual behavior |

## Security and Rights Considerations

- Do not publish raw APK, `libgame.so`, decompiler output, or private evidence paths.
- Do not claim original-runtime identity.
- Keep asset rights and technical fidelity separate in every launch-facing doc. The existing
  academic waiver permits only the approved case-study scope; it is not a commercial license.
- Avoid analytics, third-party embeds, and tracking scripts at launch.
- Keep the launch page copy safe for public indexing, but never turn it into a rights waiver.

## Rollback

Rollback is a hermetic known-good rebuild:

1. Select the last verified **candidate** commit and its approved content-tree digest/toolchain
   record, not a later documentation/evidence commit.
2. Re-dispatch the complete split build/composition workflow for that commit with exact Node,
   action SHAs, Creator hash, lockfiles, and browser/toolchain inputs.
3. Require the rebuilt content-tree digest to equal the prior approved digest.
4. Repeat protected-environment approval and deploy only after all current gates pass.

If the launch QA report fails, do not publish partial fixes. Fix the source, rerun the gates, and
produce a new candidate. Do not reuse a prior approval. The sole Creator runner means rollback
has no guaranteed RTO during runner outage; this is an explicit accepted limitation until a
second pinned runner exists.

## Next Steps

- Approve only the exact Phase 7 candidate.
- Keep docs updates tied to verified production behavior.
- Do not add analytics or a custom domain during launch.
