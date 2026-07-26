---
phase: 1
title: "Capture and register runtime media"
status: complete
priority: P1
dependencies: []
effort: "1-1.5d"
---

# Phase 1: Capture and register runtime media

## Context links

- `docs/case-study-editorial-policy.md:12-20,30-42,121-137,193-213`
- `reference/case-study-academic-display-decision.json:14-105`
- `release/public-release-variant-manifest.json:13-117`
- `reference/case-study-publication-manifest.json:1568-1770`
- `scripts/run-h5-runtime-matrix.mjs:34-57,421-526`
- `scripts/validate-case-study-publication.mjs:365-537`
- `scripts/case-study-validation/chapters.mjs:130-169`

## Overview

- Date: `2026-07-26`
- Description: expand the owner-approved academic display scope, generate reproducible README-grade gameplay captures, and register every new media artifact without touching the blocked commercial verdict.
- Priority: `P1`
- Implementation status: `complete`
- Review status: `complete`

## Key insights

- The current academic decision covers the audited H5 tree plus six hashed captures only.
- The publication manifest already models raw runtime captures and exact-byte display derivatives.
- The validator already enforces bilingual alt/caption, transform history, and separate academic/commercial references.
- The safest path is additive: keep historical evidence immutable, add new captures under this plan, then bind new derivatives back into the publication manifest.

## Requirements

- Preserve exact runtime pixels: no crops, no mockups, no glare, no generated extension, no repainting.
- Keep `release/public-release-variant-manifest.json` read-only; `releaseDecision.status` remains `blocked`.
- Capture from the audited H5 build only. If the H5 tree digest differs from the active academic record, stop and re-audit before publishing images.
- Register 3-4 new captures spanning a settled Mode Select state and at least 2 true active-gameplay frames.
- Give every new capture a stable path, SHA-256, viewport/state provenance, localized alt/caption, `academicDisplayDecisionRef`, and `commercialRightsRecordRef`.
- File ownership for this phase: `scripts/capture-readme-gallery.mjs`, `docs/release-rights-checklist.md`, `reference/case-study-academic-display-decision.json`, `reference/case-study-publication-manifest.json`, `site/src/assets/media/runtime/*`, `site/public/social/pencil-blade-en.svg` plus its PNG derivative if refreshed, and this plan's `reports/` runtime artifacts.

## Architecture

`audited H5 tree -> capture runner -> report PNG + JSON provenance -> academic decision expansion -> publication manifest media records -> exact-byte README derivatives`

Backwards compatibility:
- Keep existing six historical captures valid.
- Additive media IDs only; do not rename current IDs consumed by the site.
- Leave commercial-rights fields and route surface untouched.

## Related code files

| Action | Path |
|---|---|
| Create | `scripts/capture-readme-gallery.mjs` |
| Create | `plans/260726-1633-star-worthy-readme/reports/runtime-captures/*.png` |
| Create | `plans/260726-1633-star-worthy-readme/reports/readme-gallery-capture-manifest.json` |
| Modify | `docs/release-rights-checklist.md` |
| Modify | `reference/case-study-academic-display-decision.json` |
| Modify | `reference/case-study-publication-manifest.json` |
| Create | `site/src/assets/media/runtime/readme-*.png` |
| Modify if needed | `site/public/social/pencil-blade-en.svg` and `site/public/social/pencil-blade-en.png` |

## Implementation steps

1. Freeze the H5 input identity from `reference/case-study-academic-display-decision.json`; if the audited file-count, byte-count, or tree digest changes, block README capture publication until the H5 artifact is re-audited.
2. Create a narrow capture utility that reuses the existing H5 viewport/toolchain assumptions and emits deterministic PNGs plus a JSON provenance ledger into this plan's `reports/`.
3. Capture a settled Mode Select frame plus at least two true active-gameplay frames from supported states; record viewport, entry gesture/state path, source build path, and SHA-256 for each PNG.
4. Copy only selected captures into `site/src/assets/media/runtime/` as exact-byte README derivatives; record `sourceMediaId` and `exact byte copy from ...` transformation history.
5. Record the `2026-07-26` owner approval in `docs/release-rights-checklist.md`, then update `reference/case-study-academic-display-decision.json` and its evidence hash while preserving the unchanged blocked commercial reference.
6. Update `reference/case-study-publication-manifest.json` with raw capture and derivative media records, bilingual alt/caption text, and both SVG/PNG hashes if the English hero is refreshed.

## Todo list

- [x] Freeze the audited H5 identity before capture work.
- [x] Add the capture runner and runtime-capture report output.
- [x] Produce 3-4 new PNGs, including at least two true gameplay frames, with SHA-256 and state provenance.
- [x] Register derivative README images in the publication manifest.
- [x] Expand the academic display decision without mutating the blocked commercial manifest.

## Success criteria

- New capture files exist under stable tracked paths with reproducible hashes.
- Every new media record passes `validate-case-study-publication.mjs` media rules.
- The academic decision explicitly names the expanded capture scope and still points at a blocked commercial record.
- No existing site consumer breaks because preexisting media IDs and route assumptions remain intact.

## Risk assessment

| Risk | L x I | Mitigation | Rollback |
|---|---|---|---|
| Capture source drifts from the audited H5 tree | High x High | Fail closed on tree digest mismatch before publishing images | Revert new captures and contract edits |
| README media accidentally expands rights claims | Medium x High | Keep academic/commercial refs separate and reuse existing disclaimer language | Revert decision/manifest edits only |
| New capture script destabilizes runtime-matrix gates | Medium x Medium | Use a separate narrow script instead of changing default matrix behavior | Remove the new script; keep old matrix untouched |

## Security considerations

- Do not expose raw APK, native, decompiler, ignored-work, or machine-local paths in any media ledger.
- Keep all new public media bound to repository-relative paths and tracked hashes.
- Do not introduce eager game loading, route changes, or browser bridge behavior while capturing.

## Next steps

- Hand Phase 2 only stable derivative image paths and finalized media IDs.
- Keep any README copy blocked until Phase 1 hashes and contract references are settled.
