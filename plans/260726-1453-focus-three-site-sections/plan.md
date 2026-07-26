---
title: Focus the public site on three sections
status: completed
date: 2026-07-26
---

# Focus the Public Site on Three Sections

## Overview

Reduce the bilingual Astro site to the three user-selected flows: Home (APK), Forensics
(`libgame.so` and resources), and Play. Remove Story, Reconstruction, AI Lab, Evidence
Explorer, and About from the generated site and publication contracts. Preserve the Cocos
game, source forensic records, and explicit-load Play boundary.

## Phases

| Phase | Status | File |
|---|---|---|
| 1. Reduce routes and content | Completed | [phase-01-reduce-routes-and-content.md](./phase-01-reduce-routes-and-content.md) |
| 2. Align publication contracts and verify | Completed | [phase-02-align-contracts-and-verify.md](./phase-02-align-contracts-and-verify.md) |

## Dependencies

- Keep locale parity for English and Vietnamese.
- Keep the GitHub Pages base prefix `/pencil-blade-2026/`.
- Keep `/play/game/` behind the existing explicit-load launcher.

## Acceptance Criteria

- Generated public routes are limited to `/`, `/vi/`, `/forensics/`,
  `/vi/forensics/`, `/play/`, `/vi/play/`, `/play/game/`, and infrastructure files.
- Story, Reconstruction, AI Lab, Evidence Explorer, and About routes are absent from the
  build, sitemap, release manifest, navigation, and deployed site; verification fails if any
  removed route family is reintroduced.
- Home still renders exactly three localized sections.
- Forensics and Play work in both locales without links to removed routes.
- Focused tests, Astro check, production build, route verification, and relevant browser
  tests pass.
