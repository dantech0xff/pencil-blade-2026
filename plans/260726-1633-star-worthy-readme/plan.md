---
title: "Star-worthy README redesign"
description: "English-first README refresh with audited gameplay captures and publication-contract updates."
status: completed
priority: P1
effort: 2-3d
branch: main
tags: [readme, publication, media, rights]
created: 2026-07-26
---

# Star-worthy README redesign

## Goal

Turn `README.md` from a Vietnamese-first repository note into an English-first GitHub landing page without changing game behavior, route surface, license, or commercial-release status.

Owner-approved scope expansion date: `2026-07-26`.

## Data flow

`game/build/web-mobile-pages` audited H5 tree -> reproducible runtime captures under this plan's `reports/` -> exact-byte README display derivatives under `site/src/assets/media/runtime/` -> updated academic-display + publication manifests -> README gallery and links -> content/publication/build validation.

## Phases

| Phase | Status | File |
|---|---|---|
| 1. Capture and register runtime media | Complete | [phase-01-capture-and-register-runtime-media.md](./phase-01-capture-and-register-runtime-media.md) |
| 2. Redesign and verify README | Complete | [phase-02-redesign-and-verify-readme.md](./phase-02-redesign-and-verify-readme.md) |

## Dependencies

- Phase 1 must finish before Phase 2 references any new image path or media ID.
- `reference/case-study-academic-display-decision.json` must expand scope before new README gallery images are published.
- `release/public-release-variant-manifest.json` stays unchanged and blocked.
- The public route set remains `/`, `/forensics/`, `/play/`, `/vi/`, `/vi/forensics/`, `/vi/play/`, and `/play/game/`.

## Acceptance criteria

- `README.md` is English-first, renders cleanly on GitHub, and explains the project above the fold.
- Play and Forensics CTAs are prominent; badges and status text are factual and source-backed.
- The gallery uses newly captured reconstruction gameplay states from the audited H5 build only.
- The gallery presents a coherent sequence: Main Menu, a settled mode selection, and true active gameplay.
- Every new capture has a stable path, SHA-256, viewport/state provenance, localized alt/caption, and exact academic/commercial reference fields.
- The academic display record explicitly expands scope on top of the existing owner-approved decision, while commercial rights remain blocked.
- README and contract text stays accurate: unofficial, noncommercial, source-available, not OSI open source, no original APK execution/embedding, no identity claim.
- README links, images, publication validators, and relevant site build checks pass.
