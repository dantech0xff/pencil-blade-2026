---
phase: 4
title: "Produce Story Forensics and Reconstruction Chapters"
status: complete
priority: P1
dependencies: [1, 2, 3]
effort: "8-12 days"
---

# Phase 4: Produce Story Forensics and Reconstruction Chapters

## Context Links

- [Phase 1 publication contract](./phase-01-establish-public-narrative-and-evidence-contract.md)
- [Phase 2 content pipeline](./phase-02-build-astro-platform-and-content-pipeline.md)
- [Phase 3 editorial system](./phase-03-create-editorial-design-system-and-global-experience.md)
- [Content evidence source map](./reports/content-evidence-source-map.md)
- [Editorial experience specification](./reports/editorial-experience-spec.md)
- [Static reconstruction method](../../docs/static-reconstruction-method.md)
- [Evidence register](../../docs/evidence-register.md)
- [Reconstruction report](../../docs/reconstruction-report.md)
- [Fidelity report](../../docs/fidelity-report.md)
- [Presentation/resource specification](../../docs/presentation-resource-spec.md)
- [Cocos Creator contract map](../../docs/cocos-creator-contract-map.md)
- [Classic physics contract](../../forensics/contracts/classic-physics-contract.md)
- [Classic cut/score contract](../../forensics/contracts/classic-cut-score-contract.md)
- [Restoration technical closeout](../260721-2253-pencil-blade-restoration/reports/completion-2026-07-25-technical-closeout.md)

## Overview

Author and implement the documentary spine in both languages:

1. `/story/` — why the sole surviving APK could not be run and what “static-only” means.
2. `/forensics/` — how package/native/resource evidence became explicit contracts.
3. `/reconstruction/` — how those contracts became a clean-room Cocos Creator/TypeScript game
   and were accepted through tests/runtime proof.

Each chapter follows a repeated editorial rhythm: question → artifact → method → contract/decision
→ proof → limit → next chapter. Interactions help the reader inspect a real reasoning step, but
the full story, claims, and diagram alternatives remain in static HTML.

## Key Insights

- There is no valid “original vs rebuilt runtime” comparison because the original runtime was
  never observed. Compare evidence, contract, implementation, and reconstructed proof instead.
- Disassembly/decompiler metadata is not original C++ source. Public copy may describe ARM/Thumb
  findings and mapped functions without publishing native bytes or raw decompiler output.
- Runtime screenshots depict the reconstruction. Captions must name viewport, build/manifest,
  state semantics, provenance, hash, and the original-runtime limitation.
- “100%” means the frozen maximal-recoverable-fidelity metric, not perfect historical identity.
  Keep the five denominators, 25 residuals, zero unexplained divergences, and rights status visible.
- Chapter interactions should be subject-specific: an abstract APK dissection, an evidence chain,
  and one end-to-end contract trace—not generic scroll animation.

## Requirements

### Functional

- Publish English default and reviewed Vietnamese versions of all three routes.
- Author chapter content from approved claim/source IDs; no unreferenced technical assertion.
- Implement an APK dissection using project-authored SVG/CSS metadata layers, not APK bytes,
  recovered art, or executable content.
- Implement a traversable evidence chain from sole-source APK through corpus/native analysis,
  contracts, clean-room code, deterministic tests, and runtime proof.
- Implement one detailed native-evidence → behavioral contract → TypeScript ownership → test/runtime
  trace using the blade/Physics2D path.
- Explain the six restored modes and the common-vs-mode-specific ownership boundary.
- Show resource closure, native-function enrichment, five-domain fidelity, residuals, tests,
  outputs, and runtime matrices with explicit denominators/limits. State native counters exactly:
  `713` allowlisted/auto-indexed functions, `553` with direct calls, `684` with numeric constants,
  and `91` with high-confidence string xrefs; never imply 713 manual semantic reviews.
- Use only the six hashed reconstructed runtime captures covered by the frozen academic waiver,
  plus project-authored media; separately extracted recovered assets stay excluded.
- Provide static ordered-list/table/long-description equivalents for every diagram and interaction.
- Link each major chapter claim to stable evidence IDs and commit-pinned public sources.

### Non-functional

- No raw native instruction bytes, APK/Dex download, decompiler dump, ignored forensic working
  directory, private path, or source map in output.
- No false historical imagery or invented original-game screenshot.
- Core prose/diagrams remain complete with JavaScript disabled and reduced motion.
- Dense chapter routes stay within the Phase 3 JavaScript budget and lazy-load approved media.
- All figures reserve dimensions; project-authored diagrams remain legible at 320 px, 200% zoom,
  print, and screen-reader traversal.
- English/Vietnamese claim IDs, numeric facts, evidence status, qualifiers, and figure semantics
  remain aligned.

## Architecture

```text
approved chapter MDX + generated facts + evidence IDs
                         │
                         v
              shared chapter template
                         │
        ┌────────────────┼─────────────────┐
        v                v                 v
      Story          Forensics       Reconstruction
        │                │                 │
        └──── static alternatives + optional local controllers
```

Chapter MDX owns narrative order and approved references. Components receive typed records; they
do not read arbitrary repository files or embed raw HTML. Project-authored SVG supplies the visual
model; accessible HTML supplies the authoritative explanation.

## File Inventory

| Action | Path | Purpose | Test impact |
|---|---|---|---|
| Create | `site/src/content/chapters/en/story.mdx`, `forensics.mdx`, `reconstruction.mdx` | Canonical English chapters | Content/citation tests |
| Create | `site/src/content/chapters/vi/story.mdx`, `forensics.mdx`, `reconstruction.mdx` | Reviewed Vietnamese parity | Locale/claim tests |
| Create | `site/src/pages/story/index.astro`, `forensics/index.astro`, `reconstruction/index.astro` | English route entry points | Route/browser smoke |
| Create | `site/src/pages/vi/story/index.astro`, `vi/forensics/index.astro`, `vi/reconstruction/index.astro` | Vietnamese route entry points | Locale/browser smoke |
| Create | `site/src/components/chapter/chapter-page.astro`, `chapter-masthead.astro`, `chapter-summary.astro` | Shared chapter composition using Phase 3 primitives | Component tests |
| Create | `site/src/components/forensics/apk-dissection.astro`, `evidence-chain.astro`, `native-contract-trace.astro` | Chapter-specific evidence interactions | A11y/visual/browser tests |
| Create | `site/src/components/reconstruction/reconstruction-map.astro`, `six-mode-atlas.astro`, `runtime-proof-matrix.astro` | Ownership, mode, verification explanations | A11y/content tests |
| Create | `site/src/scripts/apk-dissection.ts`, `site/src/scripts/contract-trace.ts` | Keyboard/tap/replay enhancement with static fallback | Browser/unit tests |
| Create | `site/src/assets/diagrams/apk-layers.svg`, `evidence-pipeline.svg`, `reconstruction-architecture.svg` | Sanitized project-authored diagrams | SVG/policy tests |
| Create | `site/src/assets/media/runtime/*` | Display derivatives only from the six waiver-scoped, hashed production captures | Media/hash/scope tests |
| Modify | `reference/case-study-publication-manifest.json` | Add exact hashes/transformation records for chapter runtime derivatives; sole Phase 4–6 owner of this file | Publication/media tests |
| Modify | `site/src/data/route-fragments/chapters.ts` | Domain-owned chapter routes, next/previous, locale mapping | Route merge tests |
| Modify | `scripts/case-study-validation/chapters.mjs` | Domain-owned diagram fallback, caption/provenance, chapter rhythm rules | Negative fixtures |
| Create | `tests/case-study-chapters.test.mjs` | Source, media, locale, number, route, forbidden-language contracts | Portable Node suite |
| Create | `site/tests/chapter-interactions.spec.ts` | Keyboard/touch/no-JS/reduced-motion/viewport behavior | Browser suite |
| Delete | None | — | — |

## Function and Interface Checklist

- [ ] `ChapterPage` accepts only a validated chapter entry, route metadata, generated facts, and
      public evidence index.
- [ ] `ApkDissection` exposes selectable metadata layers plus a complete ordered static summary.
- [ ] `EvidenceChain` preserves a stable node/edge order, deep-link anchors, and text/table fallback.
- [ ] `NativeContractTrace` distinguishes recovered evidence, reviewed contract, clean-room
      implementation, and measured proof in four labeled lanes.
- [ ] `ReconstructionMap` separates shared orchestration/presentation/physics/audio/save ownership
      from six mode-specific rule owners.
- [ ] `RuntimeProofMatrix` requires platform, viewport/device, build/tree hash, result, date,
      failures, screenshot media ID, and limitation.
- [ ] `resolveApprovedMedia(mediaId)` rejects missing/unapproved records and validates the copied
      derivative's SHA-256/transformation record.
- [ ] Chapter controllers support click, touch, keyboard, Escape/stop/show-all, and reduced motion.

## Implementation Steps

1. Lock an outline and claim/source matrix for all six locale documents before writing prose.
   Every section must answer: what was asked, what artifact existed, how it was interpreted, what
   was built/decided, how it was verified, and what remains unknowable.
2. Author `/story/`: sole-source APK and provenance limits; why the original runtime was
   unavailable on supported modern devices and the project never installed/executed it;
   static-only and clean-room boundaries; technical reconstruction versus public rights;
   transition from “run the old game” to “recover defensible behavior.”
3. Build the APK dissection as abstract project-authored layers—package metadata, resources,
   bytecode/native surface, contracts, and exclusions. Each layer exposes public-safe counts and
   sources; “show all” renders the full static explanation. Never embed extracted bytes.
4. Author `/forensics/` around 713 explicitly allowlisted, auto-indexed functions and the
   enrichment breakdown (`553` direct calls, `684` numeric constants, `91` high-confidence
   string xrefs), ARM/Thumb/JNI/engine boundary, the 862-resource census,
   recovered/inferred/unknown discipline, reviewed contracts, and why automatic indexing or
   decompiler output is not manual semantic review/original source code.
5. Build the evidence chain with stable deep links and an equivalent ordered list. A skeptical
   reader must reach any denominator, source, or limit in two actions from the related headline.
6. Build the representative blade/physics trace:
   - recovered constants/order such as PTM ratio `32`, one variable
     `frameDt * worldSpeed` step with `10/10` iterations, filtering, forward/reverse raycasts,
     deferred destruction, and explicit inference points;
   - reviewed behavioral contract;
   - narrow TypeScript domain ownership plus Creator Physics2D adapter;
   - deterministic adapter/backend/contact/raycast/lifecycle proof.
   Confirm every displayed constant and file reference against current contracts before authoring.
7. Author `/reconstruction/`: Cocos Creator `3.8.8` + TypeScript rationale, clean-room
   architecture, six-mode ownership, asset/presentation/audio reconciliation, Android/H5 proof,
   five-domain fidelity, 25 residual records, zero unexplained divergences, and
   `original-runtime identity: false`.
8. Curate runtime figures only from Phase 1's exact waiver-scoped capture records. Produce display
   derivatives, retain source hashes/links, and caption them as reconstructed-output proof. Do
   not call a gesture-changed frame a complete gameplay comparison or imply commercial clearance.
9. Translate through the shared termbase and claim IDs. Review Vietnamese technical force,
   diacritics, alt/long descriptions, citations, and qualifiers independently.
10. Validate no-JS, reduced motion, keyboard/touch, 320–1440 px, 200% zoom, print, citations,
    media/hash/provenance, numeric parity, performance, and forbidden public payloads.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Chapter implies original runtime was run, measured, or visually compared | Content validation fails |
| Critical | APK/native/decompiler bytes or ignored forensic path enters output | Publication/composite fixture fails |
| Critical | Screenshot is outside the frozen waiver set or lacks hash/provenance/reconstruction label | Media validation fails |
| Critical | “100%” lacks metric version/denominator/residual/identity context | Content validation fails |
| High | Native disassembly is labeled original C++ source | Forbidden-language test fails |
| High | Displayed constant or control-flow claim lacks contract/source ID | Citation test fails |
| High | Interaction hides evidence with JS off or reduced motion | Browser test fails |
| High | Diagram has no ordered/table/long-description equivalent | A11y test fails |
| High | English/Vietnamese differ in status, number, qualifier, or source | Locale parity fails |
| Medium | Deep-linked evidence loses surrounding chapter context | Browser route test fails |
| Medium | 320 px/200% zoom requires two-dimensional page scroll | Responsive test fails |
| Medium | Runtime caption overstates what its matrix row proves | Editorial QA fails |

## Todo List

- [ ] Freeze bilingual outlines and claim/source matrices.
- [ ] Author Story and static APK dissection.
- [ ] Author Forensics, evidence chain, and representative contract trace.
- [ ] Author Reconstruction, architecture/mode atlas, and runtime proof.
- [ ] Review and register all media derivatives.
- [ ] Add locale, citation, number, forbidden-language, and interaction tests.
- [ ] Pass static/no-JS, keyboard, reduced-motion, responsive, print, and performance checks.

## Success Criteria

- [ ] A developer can explain the static-evidence → contract → clean-room build → proof method
      after Home plus one representative trace.
- [ ] Each major technical claim exposes evidence status, public source, verification, and limit.
- [ ] No page implies original-runtime observation or calls disassembly original C++ source.
- [ ] All three chapters have complete reviewed English/Vietnamese parity.
- [ ] APK dissection, evidence chain, and contract trace work with mouse/touch/keyboard and retain
      complete static/reduced-motion alternatives.
- [ ] Every displayed media item resolves to an approved record and labels reconstructed output.
- [ ] Chapter pages pass the JavaScript, responsive, accessibility, citation, rights, and payload
      budgets inherited from Phases 1–3.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Story simplifies away evidence limits | Misleading case study | Repeated question/artifact/proof/limit rhythm and validator |
| Raw reverse-engineering detail leaks | Rights/security/reputation harm | Curated claims only; denied roots/bytes; output audit |
| Technical density loses non-specialists | Poor comprehension | One-sentence summaries, fixed vocabulary, progressive depth |
| Interaction becomes the only explanation | No-JS/a11y failure | Author semantic fallback first, enhance same nodes |
| Six-mode/reconstruction scope grows | Delivery delay | Explain ownership and representative traces, not every code path |
| Translated qualifiers drift | Stronger false claim in Vietnamese | Shared IDs/numbers/status plus named factual reviewer |
| Screenshots imply historical comparison | False evidence | Reconstruction label, matrix semantics, no before/original panel |

## Security and Rights Considerations

- The site may describe hashes, counts, symbols, contracts, and public-safe findings; it may not
  serve the APK, native library, raw instructions, analysis database, or decompiler output.
- Sanitized authored SVG contains no scripts, event handlers, foreign objects, external refs, or
  embedded recovered art.
- Runtime derivatives inherit the exact academic/noncommercial approval record; optimization does
  not manufacture rights.
- Commit-pinned GitHub citations open safely and are not runtime data dependencies.
- Repository citations resolve only through the Phase 1 public-source catalog. Unsafe historical
  reports receive sanitized local excerpts rather than direct links.
- Historical developer/publisher names, trademarks, and contributor credits use only the
  verified wording frozen in Phase 1 and rendered by Phase 3; chapter authors do not improvise it.

## Rollback

Remove the six chapter route entries, content, chapter-specific components/controllers, diagrams,
their publication-media records, approved derivatives, and tests together. The Phase 3 Home/shell
still provides an honest overview; Phases 5 and 6 are unaffected because they depend only on
Phases 1–3.

## Next Steps

Phases 5 and 6 run in parallel from the shared Phase 3 contracts. Phase 7 begins only after all
three streams provide final static outputs and test commands for artifact composition.
