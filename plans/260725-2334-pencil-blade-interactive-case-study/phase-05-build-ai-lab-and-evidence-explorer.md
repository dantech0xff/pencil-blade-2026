---
phase: 5
title: "Build AI Lab and Evidence Explorer"
status: complete
priority: P1
dependencies: [1, 2, 3]
effort: "6-9 days"
---

# Phase 5: Build AI Lab and Evidence Explorer

## Context Links

- [Case study plan](./plan.md)
- [Phase 1 publication contract](./phase-01-establish-public-narrative-and-evidence-contract.md)
- [Phase 2 Astro platform and content pipeline](./phase-02-build-astro-platform-and-content-pipeline.md)
- [Content evidence source map](./reports/content-evidence-source-map.md)
- [Editorial experience specification](./reports/editorial-experience-spec.md)
- [Site/H5/Pages architecture](./reports/site-h5-pages-architecture.md)
- [Evidence register](../../docs/evidence-register.md)
- [Static reconstruction method](../../docs/static-reconstruction-method.md)
- [Reconstruction report](../../docs/reconstruction-report.md)
- [Fidelity report](../../docs/fidelity-report.md)
- [Release rights checklist](../../docs/release-rights-checklist.md)
- [Presentation and resource closure specification](../../docs/presentation-resource-spec.md)

## Overview

Build the AI Lab as a curated evidence workspace, not a transcript archive. The page family should expose
task, evidence, decision, verification, and limitation cards that explain how AI assistance was used to
process repository evidence and how a recorded human/automation/mixed/unknown actor decision was
verified. The evidence explorer should
let readers filter and cross-link claims, contracts, runtime rows, rights state, and screenshots without
revealing raw chats, chain-of-thought, or private source material.

The launch posture is English-first with full Vietnamese parity already enforced by Phase 1 and Phase 2
contracts. The AI Lab must preserve the same public-safe claim IDs and labels across locales, and it must
use the Phase 1 field-level authority map and canonical-claim projection as the rest of the site.

## Key Insights

| Topic | Decision |
|---|---|
| AI disclosure | Show AI as bounded assistance for evidence processing, implementation, testing, and review; never as authority or autonomous restorer |
| Evidence model | Every case file must point back to repository evidence, contract, runtime, or rights records |
| Narrative shape | Curated case files, not raw chat history, hidden prompts, or CoT dumps |
| UI shape | Fast scan, deep drill-down, keyboard-friendly filter/search, shareable anchors |
| Safety | Fail closed on missing source refs, unsafe paths, unapproved media, or locale mismatch |

## Functional Requirements

| ID | Requirement |
|---|---|
| F-1 | Create an AI Lab landing page that introduces the curated workflow, the evidence contract, and the public disclosure rule set |
| F-2 | Render evidence cards for questions, hypotheses, typed review decisions, implementation notes, verification, and lessons |
| F-3 | Render evidence explorer filters for chapter, canonical claim status, locale, source type, academic-display decision, commercial-rights state, and verification type |
| F-4 | Support deep links to claim cards, evidence cards, runtime rows, and contract sections |
| F-5 | Support English default and Vietnamese parity without locale-specific drift in claim meaning or status |
| F-6 | Show public-safe source references only; no raw chat, prompt, or private transcript fields may be displayed |
| F-7 | Preserve JS-off reading order with a usable static index and fallback list |
| F-8 | Surface academic-display scope and commercial-rights status as separate labels for every relevant media/evidence card |
| F-9 | Keep the explorer accessible by keyboard, screen reader, and reduced-motion users |
| F-10 | Reuse the publication manifest and citation validator; do not invent a second source-of-truth layer |
| F-11 | Publish a separate `/evidence/` route with stable evidence IDs, semantic fallback lists, and individual deep-link targets |
| F-12 | Curate at least five representative AI episodes, including one proposal corrected or rejected by evidence or tests |

## Non-functional Requirements

| ID | Requirement |
|---|---|
| N-1 | Static HTML must remain readable without JavaScript |
| N-2 | Enhancement scripts must be optional and small |
| N-3 | No remote data fetches, analytics, comments, or CMS dependencies at launch |
| N-4 | Content and filter state must be deterministic from tracked repository sources |
| N-5 | No raw artifact bytes or hidden prompt material may be emitted into the public site |
| N-6 | Localization must preserve technical meaning, especially recovered/inferred/unknown and rights language |
| N-7 | Explorer interactions must not block scrolling, search, or back/forward navigation |
| N-8 | Public copy must remain understandable without weakening technical accuracy |

## Architecture

```text
publication manifest + tracked evidence
                │
                v
       curated AI Lab content model
                │
     ┌──────────┼──────────┐
     v          v          v
  task cards  evidence   decision/verification cards
                │
                v
    Astro MDX pages + progressive enhancement
                │
                v
   filterable, deep-linkable AI Lab / evidence explorer
```

The explorer is a presentation layer over existing evidence and publication records. It must not become a
new authority source, and it must not duplicate the release-rights manifest.

## File Inventory

| Action | Path | Purpose | Test impact |
|---|---|---|---|
| Create | `site/src/pages/ai-lab/index.astro` | AI Lab landing page and index shell | Route smoke, content smoke |
| Create | `site/src/pages/ai-lab/[slug].astro` | Individual curated case-file page | Route and deep-link smoke |
| Create | `site/src/pages/evidence/index.astro`, `site/src/pages/evidence/[id].astro` | Public evidence index and stable evidence detail routes | Route/deep-link smoke |
| Create | `site/src/pages/vi/ai-lab/*`, `site/src/pages/vi/evidence/*` | Reviewed Vietnamese route entries using the same shared records | Locale route/parity smoke |
| Create | `site/src/components/ai-lab/*.astro` | Hero, timeline, card, badge, disclosure, and filter components | Unit and visual tests |
| Create | `site/src/components/evidence-explorer/*.ts` | Optional progressive-enhancement filter/search helpers | Node and browser tests |
| Create | `site/src/content/aiEpisodes/en/*.mdx`, `site/src/content/aiEpisodes/vi/*.mdx` | Curated paired AI case files | Content schema/parity tests |
| Create | `site/src/data/ai-lab/*.ts` | Derived explorer indexes and claim/status join helpers | Determinism tests |
| Modify | `site/src/data/route-fragments/ai-lab.ts` | Domain-owned AI Lab/evidence routes and anchors | Route merge tests |
| Modify | `scripts/case-study-validation/ai-lab.mjs` | Domain-owned AI disclosure, actor, and raw-transcript rules | Negative fixtures |
| Create | `tests/ai-lab-content.test.mjs` | Schema, locale parity, source refs, disclosure rules | Portable Node suite |

## Function And Interface Checklist

- [ ] `buildAiLabIndex(manifest, content)` returns curated case-file summaries only.
- [ ] `resolveCaseFileSources(refs)` resolves repository-relative, allowlisted source refs only.
- [ ] `validateAiEpisode(record)` rejects raw transcript, prompt, or hidden-CoT fields.
- [ ] `validateLocaleParity(en, vi)` requires same claim/status meaning across locales.
- [ ] `buildExplorerFilters(entries)` derives stable filter facets from tracked evidence only.
- [ ] `renderEvidenceCard(record)` shows status, source refs, and limits together.
- [ ] `resolveDisclosureBadge(record)` distinguishes AI assistance, actor kind, review decision,
      and verification; it emits “human reviewed” only for a valid human decision reference.
- [ ] `resolveEvidencePresentation(canonicalClaimId, locale)` joins the single bilingual
      presentation to generated canonical state and never accepts an authored status/ref override.
- [ ] `resolveRightsLabels(record)` renders academic-display and commercial-rights references as
      two explicit dimensions.

## Implementation Steps

1. Freeze the AI Lab content contract from the publication manifest and editorial spec. Lock the allowed
   fields, the disclosure language, and the no-transcript rule before adding any UI.
2. Define the AI case-file content model in the Astro collections and derived data layer. Treat each case
   file as a documented investigation with question, evidence, hypothesis, decision, implementation,
   verification, failure/lesson, and source refs.
3. Curate at least five of these source-backed episodes:
   - discovering that Java was only the shell while the Cocos2d-x/ARM Thumb native surface
     exposed recoverable symbols, then auto-indexing 713 allowlisted functions and separating the
     direct-call/constant/string-xref counts;
   - replacing the early “run and compare” assumption with a static-only, pure Cocos Creator
     contract-recovery strategy after the original runtime remained unavailable;
   - deriving the blade/Physics2D contract, variable step, forward/reverse raycasts, unit
     boundaries, and deferred destruction;
   - confirming the recovered Electric/Magnet/Dragon Down ABI while review caught the actual
     Dragon batch/registry and disposal-ownership contradiction and the unfinished Crazy route
     stayed fail-closed;
   - reconciling all 862 catalog assets to zero unknown resources without confusing staging,
     consumption, fidelity, or rights denominators;
   - correcting the fidelity gate after review found inference credit, hard-coded divergence, or
     missing-artifact failure paths, then preserving those corrections with negative tests;
   - hardening the release flow after verified clean-runner ordering/dependency failures and the
     recorded self-hosted-runner broker `500/502/504` availability incident, without uploading an
     unaudited or partially fixed artifact.
   Each episode must name the question, cited inputs, typed review decision/actor, implementation
   boundary, verification, correction/limit, and public-safe source-catalog records. Task
   history may guide selection but is not a publishable source. Do not copy raw conversation text
   or name a model unless the repository contains a verified, publishable record for it.
4. Generate a normalized AI Lab index exclusively from the Phase 1
   `restorationEvidenceSnapshot`, canonical claim projection, and source catalog. Ban
   unqualified “current report” reads. Include canonical claim IDs, public source IDs, both
   rights dimensions, actor kind, and locale parity markers.
5. Build the AI Lab and evidence pages with a static reading order that works without JavaScript.
   Enhancement scripts may only add filtering, hash navigation, and drawer state.
6. Build the evidence explorer as a set of cards and facets over the derived index. Keep it keyboard-first
   and make the current filter state serializable in the URL.
7. Add bilingual content and make sure the same case file stays semantically aligned in both locales.
8. At launch, use Phase 3 primitives, CSS/data visualization, and already-registered media only;
   Phase 5 creates no new media record and does not edit the publication manifest. Any later
   visual must be bound to both the academic-display decision and unchanged commercial-rights
   reference in a separately owned change.
9. Add validator coverage for raw transcript fields, denied paths, missing source refs, unapproved media,
   locale drift, and stale source authority.
10. Review the AI Lab copy against the technical closeout and rights checklist. Remove any language that
   sounds like autonomous intelligence, hidden prompting, or runtime-observed AI behavior.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | AI episode contains raw transcript, prompt, CoT, or hidden message text | Validation fails |
| Critical | Case file cites denied or absolute local paths | Validation fails |
| Critical | English and Vietnamese status meaning drift | Validation fails |
| High | AI Lab card omits source refs or verification refs | Validation fails |
| High | Explorer filter state is not shareable by URL | Browser smoke fails |
| High | An AI claim names an unverified model/session or treats model output as evidence | Validation fails |
| High | Rights-sensitive media collapses academic approval and commercial state or lacks either ref | Validation fails |
| High | Copy says “human reviewed/accepted/rejected” without a human actor/sign-off source | Validation fails |
| High | AI index follows a changed current report outside the frozen snapshot | Generation fails |
| High | `/evidence/` requires JavaScript to expose a cited record | Static route test fails |
| Medium | JS-off view loses reading order or hides core evidence | Accessibility smoke fails |
| Medium | Source-backed card links fail to resolve | Link validation fails |
| Medium | Curated case-file search returns unstable ordering | Determinism test fails |

## Todo List

- [ ] Freeze AI Lab editorial vocabulary and disclosure text.
- [ ] Define the AI episode schema and derived index shape.
- [ ] Implement the static landing page and evidence explorer shell.
- [ ] Author and review at least five bounded AI episodes, including one visible correction.
- [ ] Add optional filtering/search with graceful JS-off fallback.
- [ ] Add locale parity and source-ref validation.
- [ ] Bind every case file to the frozen snapshot and public-safe source catalog.
- [ ] Exclude all raw transcript, prompt, and private evidence fields.

## Success Criteria

- [ ] AI Lab reads like an evidence-backed case file system, not a transcript archive.
- [ ] Every public AI claim resolves to a repository-relative evidence source or a visible limitation.
- [ ] English and Vietnamese launch content remain semantically aligned.
- [ ] Filtering and deep linking work without breaking the static reading order.
- [ ] No raw chats, chain-of-thought, or unapproved media can reach the public artifact.
- [ ] The explorer is useful with JavaScript disabled and better with JavaScript enabled.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| AI Lab drifts into prompt theater | Misleading public narrative | Lock to case-file format and visible disclosure rules |
| Locale parity breaks technical meaning | Public contradiction across languages | Shared IDs, shared source refs, one glossary |
| Evidence explorer duplicates the source of truth | Stale or conflicting data | Join canonical claims and the named frozen snapshot; presentation fields only |
| Attractive visuals expose private material | Rights/privacy breach | Deny raw transcript fields and unapproved media at validation time |
| JS-heavy explorer regresses accessibility | Reduced reach and trust | Static reading order first, enhancement second |

## Security And Rights Considerations

- Never expose raw chats, hidden prompts, chain-of-thought, or private review notes.
- Never surface APK bytes, `libgame.so`, decompiler output, or ignored analysis directories.
- Treat historical media and user recollection as inference-only until separately registered.
- Do not publish any media outside the current academic noncommercial rights scope.
- Keep academic-display scope and commercial-rights status separately visible on every media or
  evidence card that might carry publication risk.
- Do not rely on client-side hiding as a safety boundary; validation must fail closed before build.

## Rollback

This phase adds content and display contracts only. Roll back by reverting the AI Lab pages, collection
schemas, derived index generator changes, validator changes, and tests together. Do not touch the
restoration evidence or the game build artifacts.

## Next Steps

Phase 6 should consume the same publication manifest and route helpers to mount the playable H5 build
behind an explicit click, with disclosure-first fallback states. Phase 7 should then verify the composed
Pages artifact end to end.
