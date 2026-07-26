# Pencil Blade editorial experience specification

**Date:** 2026-07-25
**Scope:** information architecture, editorial visual system, interaction model, responsive and inclusive experience
**Product:** interactive engineering documentary for the Pencil Blade clean-room restoration
**Status:** proposed experience contract; no implementation or mockup

## Executive direction

Build a public engineering documentary, not a repository browser, docs portal, portfolio landing
page, or game marketing site.

The experience should feel like three places joined into one coherent instrument:

- **Forensic laboratory:** immutable artifacts, hashes, call paths, confidence labels, measured
  outcomes.
- **Restoration workshop:** tools, decisions, clean-room boundaries, reversible steps, visible
  craft.
- **Pencil sketchbook:** tactile marks, cut lines, paper geometry, hand-authored game character.

The memorable idea: visitors can cut through the reconstructed result and inspect the complete
evidence chain beneath it. Visual drama comes from revealing causality, not decorative spectacle.

### Narrative promise

> See how an APK that could not run on the available modern Android devices was read as static
> evidence, converted into reviewed behavior contracts, rebuilt clean-room in TypeScript and
> Cocos Creator, then verified as an Android and H5 restoration.

Required qualifier, visible early and repeated beside the fidelity result:

> “100% maximal recoverable fidelity” means conformance to the frozen recovered-contract corpus.
> It does not mean empirical identity with an executing original. The original-runtime identity
> flag remains false.

### Experience principles

1. **Evidence before assertion.** Every major technical claim links to a stable evidence ID,
   contract, implementation owner, or test artifact.
2. **Narrative before inventory.** Start with stakes and transformation; disclose the full corpus
   only when it helps answer a question.
3. **Status never hidden.** Recovered, inferred, unknown, measured, scope-decision, and
   rights-status records remain visibly distinct.
4. **Interaction explains cause.** Motion reveals layers, trace paths, or state transitions.
   Nothing moves only to decorate a scroll.
5. **The game is proof, not the only proof.** The playable H5 build is the final experiential
   artifact; the evidence chain explains what it does and what cannot be claimed.
6. **Progressive enhancement is narrative parity.** Static reading order carries the full story.
   Pointer, scroll, and motion add understanding but never gate it.
7. **Rights and technical fidelity stay separate.** Technical closure does not imply a license or
   redistribution approval.

## Evidence-grounded product facts

These facts should anchor editorial copy and data visualizations:

| Fact | Public framing |
|---|---|
| Source APK SHA-256 `95225733…87e7aa` | Immutable source artifact; never run or installed during reconstruction |
| `libgame.so` SHA-256 `55385c17…38500e` | Static native evidence; never linked or shipped in the clean-room build |
| `713/713` enriched application functions | Each includes calls, constants, string xrefs, and review state |
| `862` canonical physical assets | `761` consumed, `100` reviewed excluded, `1` unsupported, `0` unknown dispositions |
| `0/862` assets approved for public distribution | Rights record complete; approval absent; no license claim |
| Six production modes | Classic, Crazy, Gangnam Style, Classic Bird, Crazy Bird, Combo Bird |
| Five-domain score `100.00%` | Minimum-domain, binary, evidence-backed recovered units; no weighting |
| `25` residual/exception/blocker records | Disclosed outside the recovered denominator; zero unexplained divergences |
| Local test checkpoint `1,760/1,760` | `192/192` top-level Node plus `1,568/1,568` vertical-slice |
| H5 build `2,539` files, `39,613,694` bytes | Tree digest `90f0fed3…cb2b54`; click-to-load, never part of initial page payload |
| Verified runtime rows | Android 13/API 33 arm64; Chrome at `480x800` and `720x1280` |

Do not shorten the central claim to “pixel-perfect,” “identical,” “the original restored,” or
“100% accurate.” Do not create an “original vs rebuilt” visual comparison because no executing
original was observed.

## Audiences

### Primary audience

**International software, game, preservation, and reverse-engineering developers.**

They arrive skeptical. They want to know whether the method is reproducible, whether evidence
statuses are honest, how native behavior became TypeScript, and whether the verification result
survives inspection. They are comfortable with symbols, code, hashes, test matrices, and precise
limitations, but should not have to understand this repository before the story makes sense.

Success:

- Understand the clean-room method in under five minutes.
- Follow one rule from immutable artifact to runtime verification.
- Distinguish recovered facts from inference and owner decisions.
- Inspect or download authoritative evidence without losing narrative context.

### Secondary audiences

1. **Game preservation researchers and technical historians.** Care about custody, static-only
   methodology, authenticity boundaries, and durable records.
2. **Students and technically curious players.** Need plain-language explanations before deep
   details; motivated by the playable result.
3. **Technical evaluators, collaborators, and hiring reviewers.** Need architectural judgment,
   testing rigor, delivery scope, and evidence of sustained execution.
4. **Rights reviewers and original stakeholders.** Need non-affiliation, attribution, asset
   provenance, distribution status, and a clear path to contact or correction.

Do not optimize the main narrative for repository maintainers. File-tree navigation and raw
manifest browsing are secondary tools within `/evidence/`.

## Three core user journeys

| Journey | Entry and motivation | Path | Required success moment |
|---|---|---|---|
| **The skeptical engineer** | Shared evidence link, search result, or GitHub; wants to test the claim | `/` proof thesis → `/evidence/` metric scope → representative trace in `/reconstruction/` → `/play/` | Can state: “The score measures a frozen recovered corpus, residuals remain separate, and the original runtime was not observed.” |
| **The story-first learner** | Feature article or social preview; wants to understand how restoration happened | `/story/` → `/forensics/` → `/reconstruction/` → `/ai-lab/` → `/evidence/` → `/play/` | Sees one native fact become a contract, implementation, test, and verified behavior without needing repository context. |
| **The player who asks why** | Direct `/play/` link; wants to try the game first | `/play/` preflight → click-to-load game → “How this was verified” → `/evidence/` or focused trace → `/about/` | Plays without downloading the documentary payload, then reaches a concise, credible proof explanation in one action. |

Each route must support deep entry. A visitor should never be forced through a scroll sequence to
understand a linked claim.

## Final information architecture

### Canonical documentary spine

```text
Home / thesis
  → Story / the un-runnable artifact
    → Forensics / read without executing
      → Reconstruction / contracts become a clean-room system
        → AI Lab / assistance under evidence gates
          → Evidence / prove and qualify the result
            → Play / touch the verified output
              → About / scope, credits, rights, continuation
```

### Global navigation

Desktop:

- Persistent compact project mark and title.
- Ordered chapter rail: **Story · Forensics · Rebuild · AI Lab · Evidence · Play**.
- `About` and language control remain visually secondary.
- Current chapter uses `aria-current="page"`, a visible position marker, and text weight; not
  color alone.
- A contextual **Inspect evidence** action opens the current claim’s source drawer. It is not a
  global search box masquerading as primary navigation.

Mobile:

- 56px top bar with project mark, chapter position (`03 / 06` plus name), and menu.
- Menu opens a full-height semantic navigation sheet, not a horizontal carousel.
- Current route, completed prior chapters, and next route are textual. No hover-dependent map.
- Language appears only when a complete target translation exists for the current route.

The header must not look like a documentation sidebar. Chapter navigation is cinematic and
sequential, while every item remains a normal link.

### Route hierarchy and transitions

| Route | Chapter goal | Content hierarchy | Primary transition | Secondary transition |
|---|---|---|---|---|
| `/` | State the transformation and establish credibility | Hero thesis; scope qualifier; interactive APK cutaway; six-chapter path; proof ledger; playable preview; rights boundary | **Begin with the artifact** → `/story/` | **Inspect the proof** → `/evidence/`; **Play first** → `/play/` |
| `/story/` | Make the technical constraint and preservation stakes understandable | Artifact arrival; why it would not run; what was available; static-only rule; clean-room pledge; timeline from APK to builds; outcome and limits | **Open the APK** → `/forensics/` | **Jump to the result** → `/play/` |
| `/forensics/` | Show how reliable behavior was recovered without execution | APK anatomy; custody/hash; dual toolchain; ARM/Thumb rule; function and resource maps; evidence statuses; contract workflow; one recovered-rule teaser | **Follow one rule into the rebuild** → `/reconstruction/#trace` | **Browse source records** → `/evidence/#ledger` |
| `/reconstruction/` | Explain how reviewed contracts became a production architecture | Clean-room boundary; C++ symbol evidence → contract → TypeScript trace; domain/adapter dependency direction; Physics2D translation; six modes; resource closure; verification seams | **See where AI helped—and stopped** → `/ai-lab/` | **Inspect implementation proof** → `/evidence/#contracts` |
| `/ai-lab/` | Describe AI assistance honestly as a bounded workflow, not an authority | Why assistance was useful; role-based episode; input/output/evidence gates; rejected or corrected proposal; human/repo verification; reproducibility; privacy and limits | **Audit the evidence gates** → `/evidence/` | **Return to clean-room architecture** → `/reconstruction/` |
| `/evidence/` | Make every top-level claim inspectable and qualify the score | Evidence chain; five-domain metric; denominator rules; residual ledger; function/resource closure; runtime matrix; artifact hashes; screenshots; scope and rights decisions; downloads | **Run the verified H5 build** → `/play/` | **Open a contract trace** → `/reconstruction/#trace` |
| `/play/` | Let visitors experience the restored result with explicit technical and rights context | Preflight and load size; controls; click-to-load device frame; loading/error/offline states; verification summary; screenshot fallback; proof links | **How this run was verified** → `/evidence/#runtime` | **Scope and credits** → `/about/` |
| `/about/` | Establish authorship, intent, non-affiliation, licensing scope, and next actions | Preservation mission; contributor/AI disclosure; original-project credit if verified; technology; methodology links; noncommercial/source-available license; asset-rights boundary; repository; contact/correction | **Read the method** → `/story/` or `/forensics/` | **View repository** / **Report a correction** |

### Home content pacing

The homepage behaves like a documentary trailer:

1. **Cold open:** “The APK could no longer run here. Its evidence still could.”
2. **Transformation line:** `APK → static evidence → reviewed contracts → clean-room TypeScript
   → verified H5`.
3. **APK cutaway:** one user-controlled reveal of the evidence layers.
4. **Scope correction:** original runtime not observed; no identity claim.
5. **Six-chapter rail:** a visual map with one sentence per chapter, not feature cards.
6. **Proof ledger:** a small set of high-value, non-celebratory metrics.
7. **Playable glimpse:** static verified capture and explicit H5 load size.
8. **Rights boundary:** technical completion and distribution rights shown side by side.

The home hero should not begin with a grid of statistics. The artifact and method are the thesis;
metrics are corroboration.

## Editorial content model

### Claim unit

Every technical claim shown in prose or interaction should resolve to a structured record:

| Field | Purpose |
|---|---|
| `id` | Stable public ID, preferably existing `SRC-*`, `DER-*`, or `CLM-*` |
| `title` | Plain-language claim label |
| `statement` | Exact public claim; no inferred certainty |
| `status` | `recovered`, `inferred`, `unknown`, `measured`, `scope-decision`, or `rights-status` |
| `sourceRefs` | Immutable/derived evidence IDs |
| `contractRef` | Reviewed behavior contract, when applicable |
| `implementationRefs` | Clean-room TypeScript owners |
| `verificationRefs` | Tests, probes, runtime rows, screenshots, manifests |
| `limits` | What the claim does not prove |
| `metricEligibility` | Whether it can enter the recovered numerator |
| `localeState` | Translation source version and review status |
| `updatedAt` | Evidence snapshot date |

Statuses must use both text and form:

- **Recovered:** solid connector / square marker.
- **Measured:** double-ring marker.
- **Inferred:** dashed connector / triangle marker.
- **Unknown:** dotted connector / open marker.
- **Scope decision:** bracket marker.
- **Rights status:** document-tab marker.

Never use green/red alone to encode truth.

### Editorial voice

- Precise, active, modest.
- Explain the consequence before the implementation detail.
- Prefer “The static evidence recovers…” over “We cracked…”.
- Prefer “The clean-room build maps…” over “The original does…”.
- Use `original`, `source APK`, `static evidence`, `reconstruction`, and `restored build`
  consistently.
- Write numbers with their denominator and scope.
- Put limitations in the same visual field as the claim, not in a distant disclaimer.
- Use first person only for decisions, authorship, or reflection. Evidence speaks in neutral voice.
- Avoid resurrection hype, hacking clichés, AI magic language, and fake certainty.

### Narrative rhythm

Each chapter repeats a four-beat editorial pattern:

1. **Question:** one human, consequential question.
2. **Artifact:** the source item or observed problem.
3. **Method:** how the team converted evidence into a decision.
4. **Proof and limit:** what passed and what remains unproven.

This rhythm provides continuity without reusing generic card layouts.

## Editorial visual system

### Concept: calibrated graphite

The game’s authentic visual language is exuberant: ruled paper, hand-drawn fruit, cyan/green/red
marks, yellow headers, ropes, cuts, and pinned notes. The documentary should not imitate that
screen wholesale. It should place those recovered visuals inside a disciplined laboratory frame.

Base composition:

- Archival paper for story and reconstruction reading.
- Dark analyzer bench for forensics, raw traces, and runtime proof.
- Graphite linework for hierarchy and diagrams.
- Pencil yellow as the single brand accent.
- Cyan, green, amber, and carmine reserved for semantic evidence status.
- Fine ruled lines, registration marks, cut diagonals, pinholes, and repair tape used only when
  they encode source, sequence, attachment, or correction.
- Authentic game imagery appears as captioned evidence inside fixed-aspect figures, never as an
  uncredited decorative background.

### Color tokens

| Token | Value | Role |
|---|---:|---|
| `paper-0` | `#F4F0E6` | Primary reading surface |
| `paper-1` | `#E5DED0` | Secondary paper, figure matte |
| `graphite-950` | `#171A18` | Primary ink; contrast `15.41:1` on `paper-0` |
| `graphite-700` | `#515750` | Secondary ink; contrast `6.52:1` on `paper-0` |
| `lab-950` | `#16211E` | Forensics/evidence surface |
| `lab-100` | `#F4F0E6` | Primary ink on `lab-950`; contrast `14.53:1` |
| `pencil-yellow` | `#F2C94C` | Primary accent on dark; contrast `10.42:1` on `lab-950` |
| `pencil-yellow-paper` | `#D8B600` | Highlight fill only on paper; pair with graphite text |
| `recovered-green` | `#1B6B4B` | Recovered status; contrast `5.68:1` on `paper-0` |
| `measured-cyan` | `#006C7A` | Measured/runtime status; contrast `5.39:1` on `paper-0` |
| `inferred-amber` | `#8A4B00` | Inference status; contrast `5.98:1` on `paper-0` |
| `exception-carmine` | `#A13A2B` | Unknown/exception/rights warning; contrast `5.85:1` on `paper-0` |
| `line-paper` | `#AAB2A8` | Large dividers and diagram lines only; never body text |

On dark surfaces, use light semantic counterparts such as cyan `#78CAD2`, green `#77C89A`,
yellow `#F2C94C`, and coral `#F28A72`; all exceed `6.8:1` against `lab-950`.

Yellow is not body text on paper. Texture may not lower reading contrast. Status tokens never
become a decorative rainbow.

### Typography

All selected families must be self-hosted in WOFF2, include Vietnamese glyphs, and use
`font-display: swap`.

| Role | Family | Use |
|---|---|---|
| Display/editorial | **Be Vietnam Pro**, 600–700 | Chapter titles, strong pull lines, compact labels requiring Vietnamese support |
| Reading/interface | **Noto Sans**, 400–600 | Long-form copy, navigation, captions, bilingual UI |
| Evidence/code/data | **IBM Plex Mono** with Noto Sans fallback | Hashes, symbols, coordinates, test numerators, file paths; fallback protects Vietnamese labels |

Recommended scale:

- Hero display: `clamp(3rem, 8vw, 7.5rem)`, line-height `0.92–1.0`.
- Route title: `clamp(2.5rem, 6vw, 6rem)`.
- Section title: `clamp(1.75rem, 3vw, 3rem)`.
- Reading body: `17px/1.65` mobile, `18–20px/1.65` large screens.
- Caption: `14px/1.5`.
- Evidence utility: `12–14px/1.45`, never below `12px`.

Keep prose measure at `60–72ch`; Vietnamese lines may use the narrower end. Use balanced headings
and pretty-wrapped body copy. Do not set all utility labels in uppercase. Numbers use tabular
figures.

### Grid, spacing, and shape

- 4-column mobile, 6-column tablet, 12-column desktop editorial grid.
- Page maximum `1440px`; reading column `720–780px`; evidence workbench may use `1200px`.
- Gutters: `16px` at 320, `24px` at 375+, `40px` at tablet, `64–80px` at desktop.
- Base spacing unit `4px`; common rhythm `8 / 12 / 16 / 24 / 32 / 48 / 72 / 96`.
- Borders `1px` or `2px`; corners mostly square or `2–6px`. Do not round every container.
- Primary controls at least `44×44px`; `48px` preferred on touch.
- Shadows limited to paper overlap, tool tray, or device frame. Use restrained tinted hard or
  inset shadows, not floating SaaS-card shadows.
- Use whitespace and hairlines to group content. Do not wrap every unit in a card.

### Texture and material

- One fixed, pointer-inert noise layer at `1–2%` opacity maximum.
- Ruled-paper lines are subtle CSS/SVG and removed behind dense code or small text.
- A diagonal “blade cut” may separate major before/after states, but only one strong cut per
  route.
- Registration marks locate evidence figures; repair tape marks an explicit correction or
  owner decision.
- No blur on scrolling regions. No glass panels.

### Icon and diagram language

Use a small custom SVG set, not emoji and not a generic icon library as the sole visual voice.

Core symbols:

- APK/archive: chamfered packet with ZIP seam.
- Native library: dense chip/ELF block.
- Derived evidence: offset sheet with source notch.
- Contract: clipped paper tab with rule lines.
- TypeScript owner: bracketed module.
- Test/probe: double-ring target with check bar.
- Runtime: portrait viewport with measured corners.
- Human review: pencil annotation plus signed tick.

Diagram rules:

- `1.5px` technical vector stroke over a rough `0.75px` graphite underlay.
- Solid, dashed, and dotted connectors carry evidence status.
- Every line has a text label or accessible description.
- Arrow direction always matches dependency or derivation direction.
- Code colors come from syntax semantics, not the brand palette.
- Use real addresses, hashes, constants, and filenames where publication is allowed.
- Do not present native evidence as recovered C++ source. Label the first trace column
  **Native C++ symbols + Thumb evidence**, not **C++ source**.

### Image and screenshot treatment

- Runtime screenshots retain their native portrait aspect and receive a matte, caption, evidence
  ID, viewport, capture time, and SHA-256.
- An optimized derivative can serve the page; link to the exact hashed PNG separately and label
  the derivative.
- Captions must derive state from the runtime manifest and test action, not infer state from a
  filename. For example, a file named `*-classic.png` may be the frame changed by a Classic
  gesture rather than a complete gameplay scene.
- Never crop away diagnostic context when a figure is offered as evidence.
- Do not use recovered game assets in Open Graph images or decorative collages until public-use
  rights are explicitly approved.

### What to avoid

- Generic SaaS cards, bento dashboards, centered feature grids, pricing-style statistics.
- Documentation-site sidebars, breadcrumb overload, API-reference visual language.
- Purple/blue gradients, glowing orbs, neon edges, gradient text, glassmorphism.
- Claymorphism, toy-like 3D controls, bubble radii, soft candy shadows.
- Endless parallax, scroll hijacking, custom cursor, ambient floating objects.
- Terminal-green hacker clichés, skulls, padlocks, or “we cracked it” imagery.
- Decorative code that is not tied to a cited artifact.
- Donut charts celebrating 100%; the metric must expose its denominator and limits.
- “Before/after” images implying an observed original runtime.
- Recovered asset artwork used as page chrome.

## Reusable experience components

| Component | Job | Essential behavior |
|---|---|---|
| `ChapterMasthead` | State question, thesis, status, next move | One dominant line, route number, concise qualifier, next-chapter cue |
| `ChapterRail` | Preserve documentary orientation | Normal deep links, current marker, no scroll-jacking |
| `EvidenceRef` | Cite an inline claim | Stable ID + status; opens evidence drawer and remains a normal anchor |
| `EvidenceDrawer` | Show provenance without leaving the story | Source → derivation → contract → implementation → verification; deep-linkable; desktop side sheet, mobile bottom/full sheet |
| `ClaimStatusLegend` | Decode evidence confidence | Text + shape + connector sample; available on every evidence-heavy route |
| `ProofFigure` | Present screenshot, diagram, or measured output | Figure/figcaption, dimensions, capture conditions, hash, accessible description |
| `ContractTrace` | Synchronize native evidence, contract, TS owner, and test | Keyboard-selectable rows, persistent labels, stacked mobile view |
| `MetricLedger` | Explain domain score and residuals | Numerator/denominator, minimum rule, limits, data-table alternative |
| `RuntimeMatrix` | Compare supported runtime rows | Status, viewport/device, input/audio/storage/lifecycle/orientation/offline; responsive table/list |
| `DecisionPatch` | Expose a correction, inference, or owner choice | Original question, evidence, decision, consequence, current status |
| `CodeLens` | Explain a short source excerpt | Line focus, glossary, source path, copy link; never dump large files |
| `RightsBoundary` | Prevent technical/licensing conflation | Technical status beside rights status; mandatory near play and asset figures |
| `PlayableFrame` | Load and contain H5 runtime | Explicit start, progress, error/retry, fullscreen/open-new, fallback capture, proof link |
| `LocaleState` | Communicate translation coverage | Locale, source version, review state; never silently mix incomplete translation |
| `NextChapter` | Continue the narrative | Specific outcome-focused label, route summary, optional proof-first detour |

## Signature interactions

### 1. APK dissection

**Purpose:** Make the static-only method immediately understandable.

Scene:

- A sealed APK packet sits on the workbench.
- A user-controlled pencil/blade cut opens five registered layers: signing/manifest, app-owned
  Java/JNI boundary, `libgame.so`, packaged resources, and metadata.
- Selecting a layer exposes only measured facts and stable evidence IDs.
- A persistent annotation reads: **Inspected, never executed.**

Desktop:

- Pointer drag or range control moves the cut line.
- Layer tabs remain directly clickable.
- Scroll may advance the initial reveal once, but the page never traps the user.

Mobile:

- Static exploded stack followed by five large disclosure controls.
- A tap on **Open layer** expands facts inline; no precision drag required.

Keyboard/screen reader:

- Range control has a textual value such as “Layer 3 of 5: native library.”
- Arrow keys change layer; tabs and disclosures remain reachable independently.
- Semantic ordered list duplicates the visual stack.

Reduced motion:

- APK begins open. Layer selection changes by instant state or a short opacity crossfade.

Guardrail:

- Do not expose or distribute source APK bytes. Use project-authored vector geometry and curated
  metadata.

### 2. Evidence chain

**Purpose:** Let a skeptic audit causality without browsing the repository blindly.

Canonical chain:

```text
SRC-APK-001
  → registered derived view
  → recovered / inferred / unknown claim
  → reviewed contract
  → clean-room TypeScript owner
  → deterministic test or backend probe
  → Android / H5 runtime evidence
```

Interaction:

- Selecting any node highlights upstream source and downstream proof.
- The evidence drawer shows exact references, status, metric eligibility, and limits.
- URL anchors preserve the selected chain for sharing.
- Filters change only the visible subset; the total and hidden count stay announced.

Mobile/accessibility:

- Render as an ordered vertical chain, not a pan-and-zoom canvas.
- Provide a real nested list and data table beneath the visual graph.
- Arrow-key graph navigation is optional enhancement; standard Tab order remains primary.

### 3. Native evidence → contract → TypeScript trace

**Purpose:** Show the clean-room transformation at the level developers trust.

Use one representative Physics2D/blade path:

1. **Native symbol and Thumb evidence:** gravity `(0,-10)`, PTM ratio `32`, one
   `Step(frameDt * worldSpeed, 10, 10)`, forward then reverse raycasts, duplicate occurrences
   retained.
2. **Reviewed contract:** units, world-step order, filtering, deferred destruction, explicit
   inferences and unknowns.
3. **Clean-room implementation:** TypeScript domain rules plus narrow Creator Physics2D adapter;
   Creator public gravity `(0,-320)` world units/s².
4. **Verification:** deterministic adapter tests, backend equivalence at `1/120`, `1/60`, and
   `1/30`, contact/raycast/lifecycle probes, runtime matrix.

Desktop:

- Four aligned vertical lanes, not three generic cards.
- Selecting a constant highlights every corresponding occurrence and its transformation.
- A scrubber may replay execution order; user can stop it immediately.

Mobile:

- One trace step at a time with a persistent “1 Evidence / 2 Contract / 3 Build / 4 Proof”
  index.
- **Show all steps** renders the complete static article.

Guardrails:

- Never label disassembly metadata as original C++ source.
- Do not publish native instruction bytes or decompiler output beyond curated publication
  boundaries.
- Explicitly show which inference cannot raise the recovered metric.

### 4. AI laboratory episode

**Purpose:** Explain the actual role of AI without making AI the hero or authority.

Format one bounded case file from the restoration:

1. Research/scout received a specific evidence question.
2. It cited files, symbols, constants, or resource records.
3. An implementer mapped an accepted contract to owned TypeScript files.
4. A reviewer challenged behavior or ownership.
5. Tests/probes accepted, corrected, or rejected the proposal.
6. Documentation recorded the final evidence status and limit.

Interaction:

- Toggle **Workflow**, **Evidence**, and **Verification** overlays on the same episode timeline.
- One “correction patch” must show a proposal that changed after evidence or tests. This is more
  credible than a flawless AI montage.
- Each step exposes artifact references and the acceptance gate.
- An **AI hidden** view proves that source evidence and verification remain sufficient without
  trusting the model.

Do not publish private prompts, hidden reasoning, secrets, personal data, or chain-of-thought.
Publish task summaries, cited inputs, material outputs, decisions, and verification results.

Visual direction:

- Case folders, review marks, diff strips, and test stamps.
- No neural-network brain, robot mascot, glowing nodes, or magical generation animation.

### 5. Metrics and proof ledger

**Purpose:** Make “100%” harder to misunderstand than to understand.

Primary visualization:

- Five horizontal evidence rulers, one per frozen domain.
- Each ruler prints passed/frozen units:
  `813/813`, `55/55`, `6/6`, `61/61`, `33/33`.
- A bracket points to the minimum-domain rule.
- Beside—not below—the rulers: `25 residual records`, `0 unexplained divergences`,
  `original-runtime identity: false`, `rights approved: 0/862`.

Secondary views:

- Catalog closure: `761 consumed / 100 excluded / 1 unsupported / 0 unknown`.
- Test closure: `192 + 1,568 = 1,760`.
- Runtime rows: Android and both H5 viewports.
- Exact artifact hashes with copy and verification instructions.

Rules:

- No animated count-up for authoritative values.
- No confetti, celebratory ring, or misleading green wall.
- Every total has a version, date, denominator note, and link to machine-readable authority.
- Provide a semantic table and concise screen-reader summary.

### 6. Playable device frame

**Purpose:** End the documentary with a real, bounded proof artifact.

Preflight:

- Static verified capture, build date, supported orientation, pointer/touch control summary.
- Clear button: **Load restored H5 build · 39.6 MB**.
- Note that audio starts only after interaction.
- Technical status and rights status shown separately.

Load:

- H5 starts only after explicit intent. Do not preload, prefetch, or hydrate the game from other
  routes.
- Frame preserves the verified `480:800` or `720:1280` portrait ratio.
- Desktop uses a restrained workshop clamp/matte, not fake glossy phone hardware.
- Mobile uses available width, safe-area spacing, and an optional dedicated fullscreen/open-new
  action.
- Loading shows real phase/progress if exposed; otherwise determinate transferred bytes or
  honest indeterminate state.
- Error text states cause category and offers **Retry**, **Open verified deployment**, and
  **View captures**.

Proof bridge:

- A nearby **How this run was verified** opens the exact runtime row.
- Optional nonintrusive evidence markers identify menu, mode select, input, audio, storage,
  lifecycle, orientation, and offline checks.
- Do not overlay documentary UI on the game canvas in launch scope.

Accessibility:

- The iframe/canvas receives a specific title and control summary.
- Do not claim the game itself is screen-reader or keyboard accessible unless tested.
- Offer a textual state walkthrough and verified screenshots as an alternative to the canvas.

## Global interaction and motion model

### Interaction hierarchy

1. **Primary chapter action:** one per screen/section.
2. **Evidence action:** inspect source without losing place.
3. **Continuation action:** next chapter.
4. **Utility action:** copy hash, download record, change language, open repository.

Hover never carries required information. Every hover detail also appears on focus and tap.

### Motion tokens

| Token | Duration | Use |
|---|---:|---|
| `motion-feedback` | `120–160ms` | Press, focus-adjacent feedback |
| `motion-micro` | `180–240ms` | Disclosure, tooltip, selected evidence state |
| `motion-section` | `280–420ms` | Drawer, lane transition, chapter reveal |
| `motion-signature` | `420–650ms` | User-triggered APK open or trace replay only |

- Enter easing: `cubic-bezier(.22, 1, .36, 1)`.
- Exit is 60–70% of enter duration.
- Animate transform and opacity. Avoid layout properties.
- One signature motion system per route; no perpetual animation.
- Animations remain interruptible and never block input.
- Scroll observation uses `IntersectionObserver`; no continuous React state updates from scroll.
- Sticky narrative sections last no more than roughly one viewport and always have a static exit.
- No nested scroll region inside the main documentary flow.

### Reduced motion

With `prefers-reduced-motion: reduce`:

- Remove scrubbed, pinned, parallax, rotation, drawing, and count transitions.
- Begin diagrams in their informative end state.
- Replace structural motion with no transition or ≤`100ms` opacity change.
- Preserve selected state, progress text, and content order.
- Do not hide “bonus” evidence that was otherwise revealed by motion.

## Responsive experience

### Breakpoint behavior

| Width | Experience |
|---|---|
| `320–767px` | Single reading column; 16–24px gutters; inline evidence; vertical traces; chapter sheet; no overlap/rotation |
| `768–1023px` | 6-column grid; reading plus caption rail; compact two-lane traces; device frame centered |
| `1024–1439px` | 12-column editorial grid; reading column plus evidence rail; four-lane trace available |
| `1440px+` | Max-width composition; controlled negative space; no stretched paragraphs or edge-to-edge diagrams |

### Mobile-first rules

- Core claim, qualifier, and action precede any visual interaction.
- Remove desktop overlap, diagonal crops, and decorative rotation below `768px`.
- Never require horizontal page scrolling. Wide tables become labeled row groups or scroll within
  a clearly named region with an adjacent summary.
- Evidence drawers become full-width bottom/full sheets with focus containment and clear close.
- Sticky UI reserves top/bottom space and respects safe areas.
- Use `min-height: 100dvh`, never hard `100vh`.
- Landscape remains readable. The documentary reflows; the game remains a labeled portrait
  viewport.
- Test at 320px, not only the game’s 480px and 720px runtime profiles.

### Desktop rules

- Reading text occupies 5–7 of 12 columns.
- Evidence may inhabit a 3–4-column contextual rail, but only while relevant.
- Full-width workbench interactions can break the grid once per chapter.
- Never keep both global navigation and evidence rail aggressively sticky if they compete for
  focus or viewport area.
- Pointer affordances include cursor, hover, focus, and direct labels.

## Inclusive experience contract

### Keyboard

- First focusable control is **Skip to main content**.
- Tab order follows DOM and visual reading order.
- Route change moves focus to the new `h1`/main region and announces the chapter.
- Escape closes drawers/sheets and returns focus to the trigger.
- Arrow keys operate only inside correctly announced composite widgets.
- Home/End support is optional inside evidence lists; no global single-key shortcuts.
- Drag/scrub interactions always have buttons, tabs, or range inputs.
- Focus ring: minimum 2px with 2px offset; visible on paper and lab surfaces.

### Screen reader

- One `h1` per route; sequential headings.
- Chapters use `article`, `section`, `figure`, `figcaption`, `ol`, `table`, and `details` before
  ARIA-heavy custom primitives.
- Evidence graph has an equivalent ordered list.
- Diagram descriptions state the insight and traversal order, not every decorative line.
- Status changes use polite live regions; filters announce visible and total counts.
- Hash copy confirmation is concise and does not steal focus.
- Long code excerpts provide a plain-language summary before line-level detail.
- The playable canvas has a title, load state, control note, and alternative walkthrough.

### Contrast and perception

- Normal text ≥`4.5:1`; large text and meaningful graphics ≥`3:1`.
- Focus, selected, error, recovered, inference, and rights states use text + shape + pattern.
- Reading text never sits directly on noisy texture, screenshots, or recovered art.
- Zoom to 200% preserves content and function without two-dimensional page scrolling.
- Touch targets minimum `44×44px`, with at least 8px separation where mis-taps are plausible.

### Cognitive accessibility

- Introduce acronyms on first use: APK, ELF, JNI, PTM, H5.
- Keep status vocabulary fixed across every route.
- Place a one-sentence summary before each dense diagram.
- Evidence drawers open at the cited node, not at a generic root.
- Preserve reading and selected-evidence state when returning from a deep link.
- Let users pause replay and skip signature interactions immediately.

## Performance behavior

The documentary should be static-first and island-interactive, compatible with the planned Astro
platform.

### Budgets

- Initial route JavaScript target: ≤`120 KB` gzip.
- No route except `/play/` should request the H5 build.
- Each signature interaction loads on intent or near-viewport and should remain a small isolated
  island.
- Largest Contentful Paint target: `<2.5s` p75.
- Interaction to Next Paint target: `<200ms` p75.
- Cumulative Layout Shift target: `<0.1`.
- Reserve width/height/aspect-ratio for every image, diagram, code lane, and game frame.

### Loading strategy

- Server-render all chapter prose, evidence summaries, navigation, and SEO content.
- Use CSS/SVG for diagrams before canvas/WebGL.
- Lazy-load noncritical screenshots and code excerpts.
- Serve AVIF/WebP derivatives for editorial display, while retaining separately linked exact
  evidence PNGs.
- Load only the evidence slice required by a route; lazy-load the full catalog/search index.
- Use direct imports and route/island splitting; no barrel-imported visualization bundle.
- Defer analytics and third-party scripts until after the page is interactive.
- Preload only critical type subsets; Vietnamese glyphs must not arrive as a late, shifting
  fallback.
- Use `content-visibility` carefully for distant long sections, with stable intrinsic sizes.

### H5 containment

- The verified build is `39,613,694` bytes and `2,539` files. Treat it as a separate product
  payload.
- Never prefetch the game due to route hover.
- Start audio and game initialization only after the explicit load action.
- If embedding changes its path/base behavior, re-run prefix and runtime verification rather
  than assuming the existing Pages result transfers.
- Keep documentary motion paused or static while the game has focus to protect input latency.
- Low-memory/slow-network fallback is the verified screenshot sequence plus a link to the
  audited deployment.

## Bilingual rollout

English should be the international canonical editorial source at the unprefixed routes. A
Vietnamese mirror lives under `/vi/` only when a page is fully translated and technically
reviewed.

### Staged model

**Stage 0 — source freeze and termbase**

- Freeze English claim text against stable evidence IDs.
- Create an English/Vietnamese technical glossary for clean-room reconstruction, static
  evidence, recovered/inferred/unknown, runtime, rights approval, and maximal recoverable
  fidelity.
- Store translation source version, reviewer, and evidence snapshot date.
- Never translate hashes, IDs, paths, symbol names, constants, or test numerators.

**Launch — safe partial bilingual presence**

- Full English on all canonical routes.
- Fully localized global shell, Home, Story, and About under `/vi/`.
- Each English technical route may include a clearly labeled Vietnamese abstract, but no
  `/vi/...` route or language toggle until the complete page is reviewed.
- A route with no full Vietnamese equivalent says **Vietnamese translation in review**; it does
  not redirect to a mixed-language page.
- Critical scope, non-affiliation, rights, and play-preflight notices receive Vietnamese review
  before any public playable launch.

**Post-launch — full parity**

- Complete `/vi/forensics/`, `/vi/reconstruction/`, `/vi/ai-lab/`, `/vi/evidence/`, and
  `/vi/play/`.
- Share evidence data records across locales; localize narrative, summaries, labels, alt text,
  and diagram descriptions.
- Run factual and accessibility QA independently in each language.

### Locale behavior

- Do not auto-redirect by browser language. Offer a dismissible suggestion.
- Language switch preserves route and anchor only when the target is complete.
- Locale preference may persist, but shared evidence URLs remain stable.
- English fallback is explicit, not silent.
- Use reciprocal `hreflang` only for complete, reviewed pairs; include `x-default` for the home
  route.
- Vietnamese typography QA must cover all diacritics: `ă â đ ê ô ơ ư` and tone combinations.

## SEO and social-preview content model

### Search model

- Every route has a server-rendered title, description, one `h1`, canonical URL, chapter
  breadcrumb data, updated date, and evidence snapshot version.
- Use `WebSite` on Home, `TechArticle` for narrative technical chapters,
  `SoftwareSourceCode` for the reconstruction artifact where accurate, and `BreadcrumbList`
  for route hierarchy.
- Evidence filters and drawer state use anchors/query state but canonicalize to the main evidence
  route. Do not index every filter permutation.
- Raw manifests remain downloadable; the page must summarize them in HTML so meaning is not
  JavaScript- or JSON-only.
- Localized complete routes are self-canonical with reciprocal language alternates.

### Recommended titles

| Route | Search title |
|---|---|
| `/` | Pencil Blade reconstruction — from un-runnable APK to verified H5 |
| `/story/` | The Pencil Blade APK that could not run — restoration story |
| `/forensics/` | Static APK and ARM/Thumb forensics — Pencil Blade |
| `/reconstruction/` | Clean-room Cocos Creator reconstruction — Pencil Blade |
| `/ai-lab/` | AI-assisted game restoration with evidence gates |
| `/evidence/` | Fidelity metric, runtime tests, and evidence ledger |
| `/play/` | Play the verified Pencil Blade H5 reconstruction |
| `/about/` | Scope, credits, license, and rights boundary |

Descriptions should include one concrete method/result and one limit. Avoid “ultimate,” “perfect,”
“revolutionary,” and “AI-powered.”

### Social preview

Create a project-authored `1200×630` composition per route:

- Abstract APK packet, evidence connectors, contract tab, and portrait runtime outline.
- Route title, one concrete number, and a small qualifier.
- Shared footer: **Static evidence · clean-room TypeScript · verified H5**.
- No recovered game artwork or screenshot until public-use rights are explicitly approved.
- No gradient, glow, logo soup, or celebratory 100% badge.

Example Home share line:

> One un-runnable APK. 713 mapped functions. 862 reconciled assets. A clean-room Cocos rebuild
> verified on Android and H5—with the limits left visible.

## Launch scope and stretch interactions

### MVP / launch nucleus

“MVP” means complete documentary credibility, not a generic placeholder site.

- All eight routes with final narrative hierarchy and route-specific chapter art direction.
- Global chapter rail, evidence references/drawer, status legend, next-chapter transitions.
- Homepage APK dissection with mobile/static and keyboard alternatives.
- One complete native-evidence → contract → TypeScript → test/runtime trace.
- One publishable AI case-file episode including a correction and verification gate.
- Evidence ledger with five-domain metric, residuals, resource closure, runtime matrix, hashes,
  and rights boundary.
- Click-to-load H5 frame with load/error/fallback states and proof bridge.
- Runtime screenshot figures with exact manifest captions and hashes.
- English canonical content; reviewed Vietnamese Home, Story, About, shell, and critical notices.
- Full responsive, keyboard, reduced-motion, contrast, and screen-reader parity for documentary
  content.
- Unique static social preview per route using project-authored graphics.

### Stretch / 10-star expansion

Layer these onto the launch system without replacing or delaying its narrative core:

1. **Exploded APK depth scene:** restrained WebGL/Three.js inspection with CSS/SVG fallback;
   user-controlled camera, no ambient orbit.
2. **Full evidence microscope:** searchable function/resource/claim graph with worker-backed
   filtering and saved deep links.
3. **Synchronized runtime proof mode:** opt-in event timeline beside a separate replay/capture,
   linking touch → raycasts → command order → score; do not instrument the production canvas
   until re-verification.
4. **Contract diff theatre:** replay how a claim changed from question to recovered/inferred
   status and show test consequences.
5. **Six-mode reconstruction atlas:** architectural/common-vs-specific comparison with mode
   timelines and resource closures.
6. **Audio evidence bench:** user-triggered event-order diagrams and waveform metadata, subject
   to rights approval.
7. **Full Vietnamese route parity** with glossary-linked code/evidence reading.
8. **Downloadable preservation packet:** curated public-safe claim, contract, metric, and runtime
   records with checksums.
9. **Guided presentation mode:** keyboard-controlled chapter cuts for talks, derived from the
   same semantic page content.

10-star safeguard: each chapter gets one subject-specific interaction. Do not substitute more
motion, more cards, or more 3D for better evidence legibility.

## Validation criteria

### Editorial and factual

- [ ] First viewport identifies the artifact, static-only method, clean-room rebuild, and verified
      outputs.
- [ ] Original-runtime identity is never implied; identity flag `false` remains adjacent to the
      fidelity claim.
- [ ] “100%” always includes metric name/version, denominator rule, and residual context.
- [ ] `25` residual records and `0` unexplained divergences are both visible.
- [ ] Technical closure and `0/862` public-rights approval appear as separate statuses.
- [ ] Every material number matches an authoritative generated report at build time.
- [ ] Every recovered/inferred/unknown label matches the repository’s registered state.
- [ ] Runtime screenshot captions use manifest/test semantics, not filenames alone.
- [ ] AI copy names evidence and verification as authority; no autonomous-recovery claim.
- [ ] No native bytes, hidden reasoning, secret, private prompt, or uncleared asset enters public
      page source.

### Journey and comprehension

- [ ] A new developer can explain the method after Home + one trace.
- [ ] A skeptic can reach denominator, residual, runtime, and rights evidence in two actions from
      any top-level claim.
- [ ] A player can load the game from `/play/` without loading evidence-explorer JavaScript.
- [ ] Back navigation restores reading position and selected evidence.
- [ ] Every route has a meaningful primary CTA into the next chapter and a proof-first detour.
- [ ] Deep-linked evidence opens with enough narrative context to understand it.

Run five moderated tests per core journey before launch. Target:

- ≥`4/5` participants complete the journey without facilitator correction.
- ≥`4/5` correctly distinguish maximal recoverable fidelity from original-runtime identity.
- `5/5` can locate the rights status from `/play/`.

### Responsive and interaction

- [ ] Test widths `320`, `375`, `480`, `768`, `1024`, and `1440`.
- [ ] Test portrait and landscape; no horizontal page overflow.
- [ ] All pointer interactions have tap and keyboard alternatives.
- [ ] Touch targets ≥`44×44px`; no precision cut/drag required.
- [ ] At most one sticky narrative region controls attention at a time.
- [ ] H5 frame preserves portrait ratio and does not obscure browser/system controls.
- [ ] The documentary remains usable if JavaScript fails; signature content renders statically.

### Accessibility

- [ ] Automated WCAG checks return zero critical/serious issues.
- [ ] Manual keyboard pass covers nav, APK layers, evidence drawer/graph, trace, filters, matrix,
      locale switch, H5 preflight, errors, and close/focus return.
- [ ] Screen-reader pass completes all three journeys using semantic alternatives.
- [ ] Reduced-motion mode contains all evidence and no scroll pinning/count-up.
- [ ] Text ≥`4.5:1`; meaningful graphics and focus ≥`3:1`.
- [ ] 200% zoom preserves reading and operation.
- [ ] Game accessibility limitations are explicit; alternative state walkthrough exists.
- [ ] English and Vietnamese diacritics survive font loading and 200% text scaling.

### Performance

- [ ] Base-route JavaScript ≤`120 KB` gzip or exception documented per interaction.
- [ ] H5 requests appear only after explicit `/play/` intent.
- [ ] LCP `<2.5s`, INP `<200ms`, CLS `<0.1` at p75 target conditions.
- [ ] No continuous scroll handler, scrolling backdrop blur, perpetual animation, or unbounded
      canvas.
- [ ] All evidence images reserve space and lazy-load below the fold.
- [ ] Documentary animation pauses while game canvas owns interaction.
- [ ] Slow-network and failed-game states expose captures and recovery actions.

### Visual quality

- [ ] Five-second test reads “forensic lab × restoration workshop × sketchbook,” not “SaaS,”
      “docs,” or “AI landing page.”
- [ ] Real evidence shapes layout and copy; no invented decorative code.
- [ ] No generic three-card feature row, bento dashboard, gradient, glow, orb, clay control, or
      stock icon wall.
- [ ] Recovered game visuals stay inside captioned evidence frames.
- [ ] One memorable interaction per chapter; supporting UI remains quiet.
- [ ] Print/PDF view keeps prose, citations, metric limits, and figure captions legible.

### SEO, locale, and sharing

- [ ] Unique titles, descriptions, canonical URLs, and authored previews per route.
- [ ] Core content and evidence summaries are present in server-rendered HTML.
- [ ] `hreflang` only links complete reviewed translations.
- [ ] Language switch never lands on incomplete mixed-language content.
- [ ] Social previews contain no uncleared recovered asset.
- [ ] Shared copy includes a qualification when referencing fidelity.

## Source mapping used for this specification

- `README.md`
- `docs/static-reconstruction-method.md`
- `docs/reconstruction-report.md`
- `docs/fidelity-report.md`
- `docs/presentation-resource-spec.md`
- `docs/evidence-register.md`
- `docs/cocos-creator-contract-map.md`
- `forensics/contracts/classic-physics-contract.md`
- `forensics/contracts/classic-cut-score-contract.md`
- `plans/260721-2253-pencil-blade-restoration/reports/completion-2026-07-25-technical-closeout.md`
- Android, local H5, and production Pages runtime manifests and representative screenshots under
  `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/`

Repository note: `docs/design-guidelines.md` and `docs/development-rules.md` were not present at
specification time. The injected project development rules were followed. This report can seed a
future project design-guidelines document, but that file is outside this task’s ownership.

## Unresolved questions

1. **Public asset/play rights:** the academic Pages deployment is technically approved and live,
   while `0/862` physical assets have public-distribution approval. May the documentary embed the
   existing H5 build and recovered screenshots, or must `/play/` link to the current deployment
   and use project-authored placeholders until rights review?
2. **Original attribution:** which original developer/publisher names, marks, and historical facts
   are verified and approved for the About page?
3. **AI episode:** which exact task thread, agent reports, prompt summaries, and correction can be
   published without exposing private process or misrepresenting authorship?
4. **Human authorship:** what contributor names, roles, review responsibilities, and contact path
   should be public?
5. **Vietnamese review:** who owns technical translation, termbase approval, and final factual QA?
6. **Game accessibility:** are keyboard controls or any accessible game-state APIs planned, or
   should launch explicitly scope accessibility to the documentary shell and alternative
   walkthrough?
7. **Evidence freshness:** should public claim data be generated directly from authoritative JSON
   at build time, and which snapshot/version should remain available when metrics evolve?
8. **Hosting boundary:** will the documentary replace the current GitHub Pages root, sit beside the
   game under a nested base path, or deploy separately? The H5 iframe/prefix and runtime matrix
   must be revalidated for the final choice.
9. **Screenshot semantics:** which runtime captures are approved as representative gameplay
   figures, given some `*-classic.png` records certify a gesture-changed frame rather than a
   complete gameplay scene?
10. **Correction channel:** where should researchers report factual, rights, attribution, or
    translation issues, and which response policy can be published?
