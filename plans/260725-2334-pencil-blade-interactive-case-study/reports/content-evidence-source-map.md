---
title: "Content Evidence Source Map"
date: "2026-07-25"
status: "draft"
scope: "Public-safe narrative, chapter arc, source map, media inventory, rights boundaries"
---

# Content Evidence Source Map

## Summary

- The safe public story is stable: sole-source APK, static-only restoration, clean-room rebuild, rights unresolved, academic release only.
- The site should cite registered docs, runtime matrices, and closeout reports. Raw chats, decompiler output, APK bytes, and native bytes stay out.
- The AI Lab section should be an evidence explorer, not a transcript dump. Summaries should point back to source-backed cards and screenshots.

## Verified 7-Chapter Arc

| Ch | Chapter | Public purpose | Primary sources | Labeling rule |
|---|---|---|---|---|
| 1 | Origin and scope | Explain why the project exists and why it is static-only | [README](../../../README.md#L1-L24), [project overview](../../../docs/project-overview-pdr.md#L5-L18), [static method](../../../docs/static-reconstruction-method.md#L5-L18), [evidence register](../../../docs/evidence-register.md#L18-L37) | Recovered for the APK facts, unknown for provenance |
| 2 | Evidence contract | Define what counts as evidence and what does not | [forensics README](../../../forensics/README.md#L3-L18), [evidence register](../../../docs/evidence-register.md#L7-L14), [static method](../../../docs/static-reconstruction-method.md#L56-L77) | Recovered / inferred / unknown must stay explicit |
| 3 | Corpus and rights | Show the asset census and fail-closed rights boundary | [project overview](../../../docs/project-overview-pdr.md#L71-L79), [reconstruction report](../../../docs/reconstruction-report.md#L38-L46), [release rights checklist](../../../docs/release-rights-checklist.md#L15-L60) | Technical coverage is recovered; rights are unresolved |
| 4 | Native contracts | Explain how the game was reverse-engineered into contracts | [static method](../../../docs/static-reconstruction-method.md#L79-L124), [presentation spec](../../../docs/presentation-resource-spec.md#L31-L69), [reconstruction report](../../../docs/reconstruction-report.md#L48-L77) | Use contract-backed prose, not raw instruction dumps |
| 5 | Clean-room rebuild | Show the Cocos Creator rebuild and supported outputs | [project overview](../../../docs/project-overview-pdr.md#L55-L70), [compatibility matrix](../../../docs/compatibility-matrix.md#L1-L20), [technical closeout](../../../plans/260721-2253-pencil-blade-restoration/reports/completion-2026-07-25-technical-closeout.md#L15-L39) | Recovered runtime targets only; no runtime-identity claim |
| 6 | Verification and release | Present runtime proof, Pages deployment, and fidelity | [reconstruction report](../../../docs/reconstruction-report.md#L79-L120), [runtime matrix Android](../../../plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/android-runtime-matrix.json), [runtime matrix H5](../../../plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/h5-runtime-matrix.json), [production pages](../../../plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/production-pages/production-pages-runtime.json) | Verified build/runtime, not original-runtime equivalence |
| 7 | AI Lab and evidence explorer | Turn evidence into a guided editorial tool without publishing raw chats | [case-study plan](../plan.md#L16-L29), [forensics README](../../../forensics/README.md#L102-L120), [evidence register](../../../docs/evidence-register.md#L12-L14) | Source-backed summaries only; no transcript publishing |

## Page To Source Map

| Proposed page | What the page should say | Source set | Suggested media | Notes |
|---|---|---|---|---|
| `chapter-01-scope` | Why the APK is the only source and why the work is static-only | README, PDR, static method, evidence register | None or a single hash card | Keep the provenance story short and factual |
| `chapter-02-evidence` | How evidence is classified and what labels mean | forensics README, evidence register, static method | One evidence-contract diagram if created later | Do not show raw decoded output |
| `chapter-03-corpus-rights` | Asset count, staging, consumer coverage, rights gap | PDR, reconstruction report, rights checklist, presentation spec | Asset census cards, rights-warning callout | Public-safe only if rights-sensitive assets are not embedded |
| `chapter-04-contracts` | How the native game was translated into contracts | static method, contract docs, fidelity report | One workflow diagram or contract matrix | Best place for callouts and simplified diagrams |
| `chapter-05-ai-lab` | What the AI Lab does and why it does not expose raw chats | case-study plan, evidence register, forensics README | Curated evidence cards, search/filter UI, no transcripts | Use this as a guided explainer, not a chat archive |
| `chapter-06-playable` | What was rebuilt and what was verified | compatibility matrix, runtime matrices, closeout, reconstruction report | Runtime screenshots, short captions, build badges | Use the runtime screenshots already in repo |
| `chapter-07-release` | What is public, what is blocked, and why | release rights checklist, technical closeout, reconstruction report | Rights checklist summary and redaction legend | Fail-closed by default |

## Publishable Facts And Stats

- The source APK SHA-256 is `95225733d46473f2b155737e8c83b567e028342257c747c0faac6ed4ab87e7aa`, the acquisition date is unknown, and backup redundancy was owner-waived ([evidence register](../../../docs/evidence-register.md#L22-L37)).
- The canonical corpus contains 862 packaged game assets; runtime consumption is 761, exclusions are 100, and unsupported assets are 1 (`Fonts/CooperBlackStd.otf`) ([project overview](../../../docs/project-overview-pdr.md#L71-L79), [reconstruction report](../../../docs/reconstruction-report.md#L38-L46)).
- The maximal recoverable fidelity metric passes at 100.00 percent in all five frozen domains, with 25 disclosed residual/exception/blocker records and zero unexplained divergences ([reconstruction report](../../../docs/reconstruction-report.md#L53-L77), [fidelity report](../../../docs/fidelity-report.md#L1-L27)).
- The supported outputs are exactly two: Android debug APK and Web Mobile H5 ([project overview](../../../docs/project-overview-pdr.md#L55-L68), [static method](../../../docs/static-reconstruction-method.md#L5-L11), [compatibility matrix](../../../docs/compatibility-matrix.md#L1-L20)).
- The Android runtime evidence is Android 13/API 33 arm64 emulator pass; the Web evidence is Chrome 150.0.7871.182 at 480x800 and 720x1280 with zero console/page/request failures ([reconstruction report](../../../docs/reconstruction-report.md#L94-L116), [completion report](../../../plans/260721-2253-pencil-blade-restoration/reports/completion-2026-07-25-technical-closeout.md#L17-L39)).
- The project is clean-room and static-only: the original APK cannot run on current devices, and runtime capture or device comparison are not accepted gates ([project overview](../../../docs/project-overview-pdr.md#L5-L18), [static method](../../../docs/static-reconstruction-method.md#L3-L12), [technical closeout](../../../docs/journals/260725-1248-pencil-blade-technical-closeout.md#L8-L18)).
- Rights remain unresolved for recovered art, audio, fonts, identity, and engine runtime; public distribution is fail-closed ([release rights checklist](../../../docs/release-rights-checklist.md#L15-L60), [reconstruction report](../../../docs/reconstruction-report.md#L107-L116)).
- The resource closure includes 50 indexed sequences, 8 recovered animation timelines, 62 audio cues, and 18 presentation/resource consumers ([reconstruction report](../../../docs/reconstruction-report.md#L48-L51), [presentation spec](../../../docs/presentation-resource-spec.md#L1-L24)).

## Candidate Media Already Present

### Runtime screenshots

- Android runtime captures:
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/android-main-menu.png`
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/android-mode-select.png`
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/android-classic.png`
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/android-offline-cold-start.png`
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/android-landscape-request-portrait-lock.png`
- H5 runtime captures:
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/chrome-480x800-main-menu.png`
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/chrome-480x800-mode-select.png`
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/chrome-480x800-classic.png`
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/chrome-720x1280-main-menu.png`
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/chrome-720x1280-mode-select.png`
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/chrome-720x1280-classic.png`
- Production Pages captures:
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/production-pages/chrome-480x800-main-menu.png`
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/production-pages/chrome-480x800-mode-select.png`
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/production-pages/chrome-480x800-classic.png`
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/production-pages/chrome-720x1280-main-menu.png`
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/production-pages/chrome-720x1280-mode-select.png`
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/production-pages/chrome-720x1280-classic.png`

### Recovered game-art candidates

- The repo already exposes the asset families that fit a public case study:
  - `game/assets/game/720x1280/Backgrounds/`
  - `game/assets/game/720x1280/Interfaces/`
  - `game/assets/game/720x1280/Leaderboard/`
  - `game/assets/game/720x1280/Loading/`
  - `game/assets/game/720x1280/Fruits/`
  - `game/assets/game/720x1280/Objectives/`
  - `game/assets/game/720x1280/Text/`
- Good chapter-level candidates inside those families:
  - `object-score-best-cup.png`
  - `object-score-double.png`
  - `pencilbladebk.png`
  - `modeselect.png`
  - `leaderboard_*.png`
  - `text-good.png`
  - `text-time-up.png`

## Missing Media

- No dedicated chapter diagrams or evidence-flow diagrams were found in the inspected evidence surface.
- No sanitized AI Lab mockups, search/filter cards, or comparison callout templates exist yet.
- No public-safe redaction legend, rights badge set, or chapter cover art exists yet.
- No registered historical gameplay footage or documentation is available in the repo for publication use.

## Claim Labeling Rules

| Label | Meaning | Public-site rule |
|---|---|---|
| `Recovered` | Directly supported by immutable APK-derived evidence or a verified runtime matrix | May be stated plainly, with source links |
| `Inferred` | Best-supported interpretation from multiple clues, review notes, or historical memory | Must be marked as inference and not counted as recovered coverage |
| `Unknown` | Evidence is missing, conflicting, or rights-sensitive | Must stay visible; do not fill the gap with guesswork |

## AI Lab Source Material

Use these sources for the AI Lab narrative:

- [evidence register](../../../docs/evidence-register.md)
- [static reconstruction method](../../../docs/static-reconstruction-method.md)
- [reconstruction report](../../../docs/reconstruction-report.md)
- [fidelity report](../../../docs/fidelity-report.md)
- [release rights checklist](../../../docs/release-rights-checklist.md)
- [compatibility matrix](../../../docs/compatibility-matrix.md)
- [presentation resource spec](../../../docs/presentation-resource-spec.md)
- runtime matrix JSON files and screenshots under `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/`
- contract docs under `forensics/contracts/`

Do not use raw chat transcripts. The repository rules say historical media and user recollection must be registered separately before citation, and user memory only supports inference, not recovered status.

## Redaction And Rights Boundaries

Never copy these into the public site:

- the APK itself
- `libgame.so`
- decompiler output
- raw analysis databases or tool caches
- raw historical media that is not separately registered
- unredacted chat logs or prompt transcripts
- any extracted asset bytes that have not been rights-reviewed for the chosen release scope

Require explicit review before publication:

- `Fonts/CooperBlackStd.otf`
- all recovered PNG, WAV, MP3, and font assets
- the `pencil-blade-identity` / trademark treatment
- any omission, substitution, or font conversion decision
- any legacy gameplay media or documentation brought in from outside the repo

## Limitations

- I did not inspect every asset byte or generate any new visuals.
- I did not use web research.
- The report treats rights as fail-closed because the repo does.
- The AI Lab chapter is still a content design problem, not an implementation artifact.
