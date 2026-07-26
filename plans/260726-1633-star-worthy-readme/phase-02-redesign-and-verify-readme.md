---
phase: 2
title: "Redesign and verify README"
status: complete
priority: P1
dependencies: [1]
effort: "1-1.5d"
---

# Phase 2: Redesign and verify README

## Context links

- `README.md:1-69`
- `docs/case-study-editorial-policy.md:12-20,52-82,101-137,193-213`
- `reference/case-study-public-source-catalog.json:13-28`
- `site/package.json:15-19`
- `scripts/validate-case-study-content.mjs:12-28,182-257`
- `scripts/validate-case-study-publication.mjs:365-459,475-537,936-947`
- `site/src/data/play.ts:30-90`

## Overview

- Date: `2026-07-26`
- Description: rebuild `README.md` as an English-first GitHub landing page, wire it to Phase 1 media, update the README source-catalog record, and run the publication/content/build gates.
- Priority: `P1`
- Implementation status: `complete`
- Review status: `complete`

## Key insights

- The current README already states the clean-room, noncommercial, and non-affiliation limits, but it is not optimized for GitHub conversion or English-first scanning.
- The source catalog already tracks `README.md` by exact hash and excerpt, so README changes must be accompanied by catalog hash updates.
- The site build already chains `prepare:data`, `validate:content`, and `astro build`; Phase 2 should reuse that path instead of inventing a README-only validator.

## Requirements

- Above the fold: plain-English project summary, factual badges, Play CTA, Forensics CTA, and the key legal/identity guardrails.
- Mid-page: a polished gallery using only Phase 1 derivatives and captions that match the registered media meaning.
- Claims must stay exact: unofficial, source-available/noncommercial, not OSI open source, original APK not executed or embedded, no historical-runtime identity claim.
- Numeric badges or proof points must keep denominators separate; do not compress assets, fidelity, tests, and runtime results into one “100% restored” statement.
- File ownership for this phase: `README.md` and `reference/case-study-public-source-catalog.json` only. Phase 2 reads Phase 1 media/manifest outputs but does not edit them.

## Architecture

`Phase 1 media IDs + existing project facts -> README GitHub layout -> source-catalog hash update -> publication/content/build/test gates`

Rollback boundary:
- This phase must be revertible by restoring only `README.md` and `reference/case-study-public-source-catalog.json`.

## Related code files

| Action | Path |
|---|---|
| Modify | `README.md` |
| Modify | `reference/case-study-public-source-catalog.json` |
| Read-only validation | `reference/case-study-publication-manifest.json` |
| Read-only validation | `site/package.json` |

## Implementation steps

1. Rewrite `README.md` into an English-first GitHub flow: hero, proof/badges, prominent CTAs, bounded gallery, architecture snapshot, supported outputs, and rights/disclaimer sections.
2. Point every gallery image at stable repo-relative derivative paths created in Phase 1; do not use historical report PNGs directly in the public README.
3. Keep links focused on GitHub-safe destinations already in the repo or live Pages surface; avoid adding routes or docs that undermine the three-section public narrative.
4. Update `reference/case-study-public-source-catalog.json` with the new README hash, sanitized excerpt, and transitive link list for every README-local image/doc destination that is intentionally referenced.
5. Run validation in this order: `node scripts/validate-case-study-publication.mjs`, `node scripts/validate-case-study-content.mjs`, `npm --prefix site run build`, then focused Node tests for publication/source/play/build edges.
6. Perform a manual GitHub-render sanity check: image paths load, headings scan well, CTAs are above the fold, and no relative path escapes the repo root.

## Todo list

- [x] Rewrite README in English-first GitHub layout.
- [x] Wire README to Phase 1 gallery derivatives only.
- [x] Refresh the README source-catalog hash and transitive link metadata.
- [x] Run publication/content/build/focused test gates.
- [x] Manually verify GitHub readability and image rendering.

## Success criteria

- `README.md` is English-first and visually scannable on GitHub without broken images or links.
- Above-fold content contains the project summary, factual status, and Play/Forensics CTAs.
- Gallery images and captions map exactly to Phase 1 media records.
- Source-catalog hash drift is resolved and validators/build/tests pass.
- No route, license, runtime, or commercial-rights claim changes leak in through README copy.

## Risk assessment

| Risk | L x I | Mitigation | Rollback |
|---|---|---|---|
| README copy overstates rights or fidelity | Medium x High | Use policy language and keep denominators separate | Revert README + source catalog |
| GitHub image/link graph breaks after rewrite | Medium x Medium | Update source-catalog transitive links and manually render-check | Revert README + source catalog |
| Validation passes locally but README is still noisy on GitHub | Low x Medium | Manual GitHub-style scan after tests; trim sections before merging | Revert README layout only |

## Security considerations

- Keep README links repository-relative or official Pages/GitHub URLs only.
- Do not expose denied artifacts, raw evidence, sensitive machine values, or machine-local paths through Markdown links.
- Do not add embed code, scripts, or HTML that changes the lazy-load/security posture of `/play/`.

## Next steps

- If Phase 2 passes, stop. No follow-on scope should touch gameplay, route structure, or commercial-release records.
- If validation fails, fix Phase 2-owned files first; reopen Phase 1 only when the failure proves media/contract drift.
