---
title: "Pencil Blade Interactive Reverse Engineering Case Study"
description: "Build an evidence-backed bilingual engineering documentary around the restored Pencil Blade H5 game and deploy both as one audited GitHub Pages artifact."
status: in_progress
priority: P1
branch: "main"
tags: [feature, frontend, docs, infra, experimental, reverse-engineering, ai-case-study, astro, github-pages, web-h5]
blockedBy: []
blocks: []
created: "2026-07-25T16:35:04.240Z"
createdBy: "ck:plan"
source: skill
---

# Pencil Blade Interactive Reverse Engineering Case Study

## Overview

Turn the existing game-only Pages deployment into a bilingual interactive engineering
documentary. The site tells a seven-chapter story from a sole surviving, non-runnable APK
through static analysis of its ARM/Thumb native C++ surface, evidence contracts, clean-room
TypeScript/Cocos reconstruction, AI-assisted investigation, verification, and a playable H5
proof. It presents reverse engineering as contract recovery, never as recovery of the original
C++ source.

The case-study shell is a new Astro static site under `site/`. The existing Cocos Web Mobile
build remains independently generated and audited, then mounts at
`/pencil-blade-2026/play/game/` inside a lazy iframe. One composed artifact serves the editorial
site and game without weakening the current native/runtime exclusion gates.

## Product Decisions

- Audience: international developers first; English default, full Vietnamese route parity.
- Format: forensic laboratory × restoration workshop × pencil sketchbook; not a docs portal.
- Stack: Astro static output + MDX/content collections + framework-free client islands by default.
- Routes: `/`, `/story/`, `/forensics/`, `/reconstruction/`, `/ai-lab/`, `/evidence/`,
  `/play/`, `/about/`, plus `/vi/...`.
- Evidence authority: `forensics/claims.jsonl` remains the canonical claim ledger. The website
  stores only bilingual `claimPresentation` projections keyed by `canonicalClaimId`; authors
  cannot override status, tier, confidence, contradictions, or evidence references.
- Source safety: public citations resolve through an exact source catalog. A tracked report is
  not linkable merely because its path is relative; the cited content, surrounding public file,
  and transitive links must pass private-path/raw-evidence scanning, otherwise the site publishes
  a sanitized excerpt without a direct repository link.
- Reproducibility: historical restoration facts bind to a versioned, hash-frozen
  `restorationEvidenceSnapshot`. New site/build/deployment facts bind separately to a per-candidate
  `caseStudyReleaseManifest`; ordinary rebuilds cannot silently follow mutable “latest” reports.
- AI disclosure: curated investigation episodes; no raw chats, hidden prompts, or autonomous-AI
  claims. “Human-reviewed” wording is permitted only when a public-safe actor/sign-off record
  proves it; otherwise the site says “review decision” and names `human`, `automation`, `mixed`,
  or `unknown`.
- Release: existing academic/noncommercial scope only. No commercial-clearance claim.
- Rights decision: the owner-approved academic Pages waiver is a frozen user decision for the
  existing audited H5 demonstration and its hashed reconstructed-runtime captures. Launch records
  that exact scope once; they do not reopen per-asset commercial clearance. Separately extracted
  recovered assets remain excluded unless the owner explicitly expands the waiver.
- Rights model: academic display approval and commercial distribution rights are two independent
  references in data and UI. No generic `approved`/`rightsState` field may collapse them.
- Player trust model: GitHub Pages keeps site and game on the same origin. The iframe provides
  lifecycle and performance containment only—no security isolation. The parent stores no secrets,
  the site owns no browser storage at launch, and policy/runtime tests prohibit parent-DOM or
  top-navigation coupling by the audited game.
- Privacy: no third-party analytics, trackers, remote fonts, CMS, database, or backend at launch.
- Performance: editorial pages never preload the approximately 40 MB game tree; H5 loads only
  after explicit user action on `/play/`.
- Release flow: build one immutable candidate, run all automated and human pre-public gates
  against its content-tree digest, approve the protected `github-pages` environment, deploy the
  same uploaded artifact without rebuilding, then run only hosting-specific production smoke.
- Rollback: retain the explicit full-rebuild decision. Pin all action SHAs, exact Node runtime,
  Creator binary, locks, and build inputs; a known-good rebuild must reproduce the previously
  approved content-tree digest before redeploy. With one Creator runner, rollback RTO is
  best-effort and explicitly unbounded during runner outage; a second pinned runner is an
  operational upgrade, not a hidden launch dependency.

## Scope

**Launch:** complete bilingual narrative, evidence explorer, AI Lab, responsive design system,
lazy/fullscreen playable H5, SEO/social metadata, accessibility, artifact audits, runtime tests,
immutable-candidate approval, and manual protected-main Pages deployment.

**Stretch after launch:** WebGL APK dissection, narrated video, custom domain, privacy-approved
analytics, deeper evidence graph, a versioned parent↔game `postMessage` bridge, a second pinned
Creator runner for bounded rollback RTO, and the 15-participant moderated comprehension study.

**Not in scope:** republishing the APK/native binary/raw decompiler output, exposing raw chat
history, claiming original-runtime identity, adding accounts/comments, or changing gameplay.

## Historical Decisions Reconfirmed

The relevant Pencil Blade task history and completed repository decisions agree on these points:

- The APK is the sole canonical source; no sample project or second resource corpus exists.
- The transformation is `APK/Cocos2d-x native C++ → evidence contracts → pure Cocos Creator
  TypeScript`, with no emulation, native bridge, or old binary at runtime.
- Only Android debug and Web Mobile/H5 are supported reconstruction outputs; this website embeds
  the already supported H5 result and documents Android as verification evidence.
- The original APK was never installed or executed. Early black-box/reference-capture ideas were
  superseded by the static-only method and must appear only as a corrected assumption.
- “100%” is the frozen maximal-recoverable-fidelity result after fail-closed audit corrections,
  not a claim of original-runtime identity or recovered original source.
- The owner waived backup/per-asset administrative gates for the academic Pages demonstration.
  That decision enables this bounded case study but does not create commercial rights or a license.
- Test/review corrections—including physics ownership, resource denominators, fidelity negative
  paths, clean-runner build ordering, and production verification—are part of the case study's
  value; the public AI narrative should show corrections, not a flawless montage.

## Delivery Architecture

```text
frozen restoration snapshot ──> publication projection ──> Astro content/data build
                                                              │
protected main ──> Cocos 3.8.8 build ──> strict game audit ───┤
                                                              v
                                          immutable composed candidate
                                      site root + /play/game/ subtree
                                                              │
                                  audit + runtime + owner/locale approval
                                                              │
                                                              v
                               protected environment approval + same-byte deploy
                                                              │
                                                              v
                                             production identity smoke
```

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Establish Public Narrative and Evidence Contract](./phase-01-establish-public-narrative-and-evidence-contract.md) | Complete |
| 2 | [Build Astro Platform and Content Pipeline](./phase-02-build-astro-platform-and-content-pipeline.md) | Complete |
| 3 | [Create Editorial Design System and Global Experience](./phase-03-create-editorial-design-system-and-global-experience.md) | Complete |
| 4 | [Produce Story Forensics and Reconstruction Chapters](./phase-04-produce-story-forensics-and-reconstruction-chapters.md) | Complete |
| 5 | [Build AI Lab and Evidence Explorer](./phase-05-build-ai-lab-and-evidence-explorer.md) | Complete |
| 6 | [Integrate Playable H5 Game Experience](./phase-06-integrate-playable-h5-game-experience.md) | Complete |
| 7 | [Build Audited Release Candidate and GitHub Pages Pipeline](./phase-07-unify-testing-build-and-github-pages-deployment.md) | In Progress |
| 8 | [Approve Deploy and Verify the Production Release](./phase-08-complete-launch-qa-legal-review-and-editorial-release.md) | Pending |

## Dependencies

- Historical input: completed restoration plan
  [`260721-2253-pencil-blade-restoration`](../260721-2253-pencil-blade-restoration/plan.md).
  It is evidence, not an active blocker.
- Current production URL: `https://dantech0xff.github.io/pencil-blade-2026/`.
- Cocos Creator `3.8.8` remains pinned on the protected self-hosted runner.
- Official implementation references:
  [Astro GitHub Pages](https://docs.astro.build/en/guides/deploy/github/),
  [Astro testing](https://docs.astro.build/en/guides/testing/),
  [Astro i18n API](https://docs.astro.build/en/reference/modules/astro-i18n/),
  [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Phase Dependency Graph

```text
1 → 2 → 3 ─┬→ 4 ─┐
            ├→ 5 ─┼→ 7 → 8
            └→ 6 ─┘
```

Phases 4, 5, and 6 may execute concurrently after Phase 3 only because Phase 2 creates
domain-owned route/data/validation fragments and a fixed aggregator, while Phase 3 creates every
shared layout/metadata slot. Those three phases may not edit the aggregator, base layout, or each
other's fragments. Phase 4 is the sole concurrent owner allowed to append chapter-derivative media
records to the publication manifest; Phases 5 and 6 consume already registered/project-authored
media and do not edit that file. Phase 7 owns the explicit merge acceptance test and is the first
integration gate.

## Delivery Strategy

| Milestone | Phases | Exit signal | Estimated effort |
|---|---|---|---:|
| Evidence foundation | 1 | Canonical projections, source catalog, media, rights, and redaction contracts validate fail-closed | 4–5 days |
| Platform foundation | 2–3 | Bilingual static shell, safe MDX pipeline, launch metadata, and editorial system build without game payload | 12–16 days |
| Documentary production | 4–6 | Narrative, AI/evidence tools, and click-to-load playable proof are complete in separate fragments | 20–29 days |
| Release integration | 7–8 | One immutable candidate is approved, deployed unchanged, and verified in production | 12–17 days |

Sequential effort is approximately 48–67 engineering/editorial days. With Phases 4–6 assigned
to independent domain fragments after Phase 3, the realistic elapsed target is approximately
36–50 working days. The owner, attribution/correction contact, and Vietnamese factual reviewer
must be scheduled in Phase 1; their availability can extend elapsed time. Estimates include
implementation and phase-level verification, not stretch work.

## Ownership Boundaries

| Area | Primary ownership | Shared contract |
|---|---|---|
| Publication policy and facts | Evidence/editorial | Canonical claim projections, field authority map, source catalog |
| Astro platform and design system | Frontend | Fixed route/data/validator aggregators, locale/base helpers, accessibility |
| Story and diagrams | Editorial + frontend | Typed chapter schema and approved evidence |
| AI Lab and evidence explorer | Evidence + frontend | Public-safe episode/evidence schemas |
| Playable H5 | Game/runtime | `/play/game/` mount, invocation-scoped verifier config, no parent-DOM coupling |
| Candidate pipeline | Release engineering | Separate site/game artifacts, provenance, final composition gate |
| Launch approval | Project owner + reviewers | Exact candidate digest, academic waiver, attribution, locale QA |
| Production release | Release engineering | Protected environment approval, same-artifact deploy, live-tree smoke |

The site must consume the game as a verified artifact boundary. Editorial components do not
import `game/assets/`, and gameplay code does not depend on the documentary shell.

## Release Gates

1. **Evidence gate:** every presentation projects canonical claims, and every media/source item
   resolves through the frozen publication/source contracts.
2. **Editorial gate:** both locales pass factual, semantic, responsive, accessibility, SEO, and
   public-source-safety QA before composition.
3. **Game gate:** the unchanged-in-purpose Cocos audit and hard-asserting direct H5 runtime matrix
   pass on a clean build that matches the frozen waiver-bound tree facts.
4. **Composition gate:** exact Pages base, all routes, live-equivalent MIME map, links,
   file-policy, provenance, and payload boundaries pass on one immutable candidate.
5. **Candidate owner gate:** owner/editorial/Vietnamese reviewers approve the exact
   `contentTreeDigest`, attribution/credits/correction text, and unchanged academic-waiver scope.
   No per-asset commercial clearance is reopened.
6. **Production authorization gate:** a protected `github-pages` environment reviewer releases
   the already-uploaded candidate; the deploy job performs no rebuild or mutation.
7. **Production smoke gate:** fetched provenance matches expected commit/run/digests, every file
   in the candidate manifest is reachable with acceptable MIME and matching bytes, and both
   launcher/direct H5 journeys pass. Failure blocks release completion and triggers the documented
   hermetic known-good rebuild path.

## Program Acceptance Criteria

- [ ] Both locales expose all launch routes with locale-preserving navigation and `hreflang`.
- [ ] Every public claim resolves to an approved source and visible evidence status.
- [ ] Public claim status/evidence fields are projections of the canonical 39-record ledger, not
      independently authored duplicates.
- [ ] Raw APK/native/decompiler/private-path material is absent from the composed artifact.
- [ ] Every public repository citation passes full-file/transitive-link safety review or is
      replaced by a sanitized local excerpt.
- [ ] Editorial shell passes WCAG 2.2 AA review, keyboard flow, reduced motion, and screen-reader checks.
- [ ] Non-play routes issue zero requests for Cocos/game assets.
- [ ] `/play/` lazy-loads a working H5 iframe from `/play/game/`, supports touch, mouse, and fullscreen.
- [ ] Original strict Cocos build audit still passes unchanged in meaning.
- [ ] Composed site passes content, route, link, MIME, artifact, Playwright, and runtime gates.
- [ ] Manual protected-main workflow exposes one immutable candidate digest for review, pins all
      actions to full SHAs, and deploys the same artifact with least privilege.
- [ ] Production smoke tests pass at both supported game viewports and representative site viewports.
- [ ] Public copy states clean-room, static-only, noncommercial/academic, unofficial, and rights limits.

## Research Inputs

- [Content evidence source map](./reports/content-evidence-source-map.md)
- [Site/H5/Pages architecture](./reports/site-h5-pages-architecture.md)
- [Editorial experience specification](./reports/editorial-experience-spec.md)

Research reports are inputs, not the final contract. Where early reports propose
`/case-studies/*`, `/play/h5/`, partial Vietnamese launch, launch-time `postMessage`, or
artifact-only rollback, this plan supersedes them with the product decisions above:
chapter-specific routes, `/play/game/`, full reviewed locale parity, no launch bridge, and a
hermetic rebuild/redeploy from a known-good protected commit.

## Red Team Review

Review session: `2026-07-25` local project time. Four independent hostile reviews inspected the
master plan, all eight phases, repository authorities, current workflows/scripts/tests, and the
proposed public contracts:

| Lens | Raw findings | Disposition | Report |
|---|---:|---|---|
| Failure Mode / Murphy's Law | 1 Critical, 6 High, 2 Medium | 8 accepted; rollback finding accepted with bounded single-runner trade-off | [Failure-mode review](./reports/from-code-reviewer-to-planner-red-team-failure-mode-plan-review-report.md) |
| Assumption Destroyer / Scope Auditor | 1 Critical, 7 High, 1 Medium | 9 accepted | [Assumption review](./reports/from-code-reviewer-to-planner-red-team-assumption-destroyer-plan-review-report.md) |
| Security Adversary / Fact Checker | 1 Critical, 6 High, 1 Medium | 8 accepted | [Security review](./reports/from-code-reviewer-to-planner-red-team-security-adversary-plan-review-report.md) |
| Scope & Complexity / Contract Verifier | 1 Critical, 6 High, 2 Medium | 9 accepted; 15-person study moved to owned post-launch research | [Scope/contract review](./reports/from-code-reviewer-to-planner-red-team-scope-complexity-plan-review-report.md) |

Raw total: **35 findings** (`4 Critical`, `25 High`, `6 Medium`). Overlapping findings were
consolidated into these implemented plan corrections:

- immutable candidate → pre-public human/rights/locale approval → protected environment →
  same-artifact deploy → production smoke;
- all About/SEO/social/test/smoke source moved before candidate composition;
- canonical 39-claim projection, field-level authorities, safe source catalog, and two rights
  dimensions;
- domain-owned Phase 4–6 fragments with fixed aggregators and one explicit media-manifest owner;
- invocation-scoped H5 prefix/config through every helper/caller/CLI, separate legacy/new runtime
  reports, hard runtime assertions, locked Linux browser, and partial-init cleanup;
- parsed transitive workflow trust, exact game-test allowlist, full action SHAs, exact Node/
  toolchain record, public provenance, and manifest-wide live byte/MIME verification;
- explicit same-origin **no-security-isolation** model, AST-level MDX policy, safe JSON-LD/CSP,
  and corrected source-backed AI episodes;
- hermetic full-rebuild rollback retained per user decision, with the single Creator runner's
  unbounded outage RTO disclosed instead of hidden.

No red-team recommendation reversed the user's full bilingual launch, static-only narrative,
playable H5, exact academic H5/six-capture waiver, commercial fail-closed state, or full-rebuild
rollback decision.

## Validation Log

Full-tier validation completed on `2026-07-25` after the red-team corrections:

- 120 sampled claims: **81 verified**, **0 failed**, **39 future implementation claims**;
- targeted current-state tests: **76/76 passed**;
- current H5 evidence: strict audit and prefix verification passed for all **2,539 files**;
- plan structure: **8 phases**, `0 errors`, `0 warnings` under strict plan validation;
- documentation sweep: **17 Markdown files**, **160 local links**, `0 missing`;
- initial validator findings: `0 Critical`, `2 High`, `3 Medium`; all five were corrected in the
  plan by separating preapproval from postapproval evidence, defining a clean-runner historical
  closeout verification mode, making runtime reports atomic and public-safe, restoring the
  field-level authority wording, and repairing the research source-map paths.

The post-remediation sweep found no remaining contradiction in dependencies, parallel ownership,
candidate/approval/deploy ordering, rights dimensions, evidence lifetimes, same-origin trust,
runtime-report lifetimes, prefix propagation, or hermetic rollback. Historical red-team and
validator reports remain unchanged as the audit trail:

- [Full-tier validator report](./reports/validator-2026-07-25-case-study-plan.md)
- [Failure-mode review](./reports/from-code-reviewer-to-planner-red-team-failure-mode-plan-review-report.md)
- [Assumption review](./reports/from-code-reviewer-to-planner-red-team-assumption-destroyer-plan-review-report.md)
- [Security review](./reports/from-code-reviewer-to-planner-red-team-security-adversary-plan-review-report.md)
- [Scope/contract review](./reports/from-code-reviewer-to-planner-red-team-scope-complexity-plan-review-report.md)

## Open Questions

No architecture question blocks implementation. Fixed defaults are same-origin GitHub Pages,
English canonical/default locale, current Pages URL, system serif/sans/mono stacks, no analytics,
no launch bridge, full-rebuild rollback, and working title “Pencil Blade: Reconstructing a Lost
Game.”

Three named release inputs must be recorded during Phase 1 and may block candidate approval, not
platform implementation: accountable project owner/approver, public correction/contact channel,
and Vietnamese factual reviewer. The current single Creator runner means rollback has no bounded
RTO during runner outage; Phase 8 records that accepted limitation. The 15-person moderated study
is post-launch research with separate recruitment/consent ownership, not a hidden release gate.
