---
title: "Pencil Blade Cocos Creator Reconstruction Program"
description: "Static-evidence roadmap to recover Pencil Blade 1.5 from libgame.so and packaged resources, then rebuild it in current Cocos Creator."
status: in-progress
priority: P1
branch: "main"
tags: [feature, android, game-preservation, reverse-engineering, cocos-creator, typescript]
blockedBy: []
blocks: []
created: "2026-07-21"
updated: "2026-07-22"
createdBy: "ck:plan"
source: skill
---

# Pencil Blade Cocos Creator Reconstruction Program

## Overview

Reconstruct Pencil Blade 1.5 from its only known APK. The original application cannot run
on any available current Android device, so the program uses static evidence only:
`libgame.so`, packaged resources, app-owned Java, and metadata. Reimplement the recovered
and explicitly inferred behavior in Cocos Creator TypeScript with Creator Physics2D.

Verified starting point:

- APK: package uit.dev.pencilblade, version 1.5 (code 6), min SDK 9, target SDK 19.
- Engine fingerprint: embedded build paths identify Cocos2d-x 2.1.4; core logic is in 32-bit ARM lib/armeabi/libgame.so.
- Game assets: 784 PNG, 59 WAV, 3 MP3, 16 fonts; Android res/ has 107 additional PNG.
- Native dynamic symbols retain many game class and method names.
- No game level/config files found in APK assets; composition and rules likely live in C++.

## Program Decisions

- Target maximal recoverable fidelity: implement every behavior supported by static evidence,
  while never claiming empirically proven runtime identity without a runnable original.
- Original-runtime capture, instrumentation, replay, and device comparison are unavailable and
  are not dependencies or acceptance gates.
- Classify gameplay facts as `recovered`, `inferred`, or `unknown`. Record contradictions
  separately. Never label a gameplay rule as runtime-observed.
- Production target is latest stable Cocos Creator: 3.8.8 / 3.8 LTS, rechecked against the
  official channel on 2026-07-22; pin the exact local editor/engine build at Phase 5 start.
- Rebuild gameplay in TypeScript and Creator content. APK/libgame.so are evidence only: never ship, wrap, call, emulate, or port them.
- Use Cocos Creator Physics2D as the production physics layer. Recover gravity, timestep,
  bodies, fixtures, velocities, collision filters, ray casts, and scoring reactions from
  the native binary/resources and express them as testable contracts.
- Keep the exact Classic score HUD in the recovered slice, including the score icon,
  best-score cup, double-score panel, and `Fonts/Linds.ttf`; seed it from the recovered
  `classic_best_1` Settings key.
- Android is primary. Creator 3.8 requires API 21+, so original min SDK 9 is a documented platform-envelope change.
- Keep archival/decompiled material separate from ship-ready content and rights status.
- Presentation restoration is complete only after 100% inventory, staging, and consumer
  coverage for every resource actually present in the canonical user-supplied sample project.
- No canonical graphics, animation, audio, font, shader/material, level/layout, progression,
  or other game resource may be silently omitted or substituted.
- `99%` is the future acceptance target for a versioned fidelity metric spanning
  visuals/layout/animation, audio, shader/material/rendering, level/progression, and
  gameplay/physics/timing/input/state. Its denominator, weighting, and residual gaps stay
  unresolved until the canonical sample-project resource manifest/root is resolved.
- Technical fidelity and release rights are separate gates. If rights block exact reuse,
  release blocks pending an explicit user decision; do not silently omit or substitute assets.
- Recreate no ads, analytics, review, or social dependency in the gameplay core.
- A critical unknown blocks only the affected feature from being called recovered. It may be
  implemented as an explicit, reviewed inference without raising recovered-coverage metrics.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Preserve Evidence and Establish Baseline](./phase-01-preserve-evidence-and-establish-baseline.md) | In progress |
| 2 | [Establish Static Reconstruction Corpus](./phase-02-establish-static-reconstruction-corpus.md) | In progress |
| 3 | [Catalog Resources and Reconstruct Presentation](./phase-03-catalog-resources-and-reconstruct-presentation.md) | In progress |
| 4 | [Recover Gameplay, Physics, and Progression Contracts](./phase-04-reverse-engineer-native-gameplay-contracts.md) | In progress |
| 5 | [Build Cocos Creator Architecture and Vertical Slice](./phase-05-build-cocos-creator-architecture-and-vertical-slice.md) | In progress |
| 6 | [Recreate Full Game Content and Progression](./phase-06-recreate-full-game-content-and-progression.md) | Pending |
| 7 | [Validate Static Reconstruction and Prepare Release](./phase-07-validate-fidelity-and-prepare-release.md) | Pending |

## Dependencies

- No overlapping project plans found.
- Phase 2 has no hard phase dependency because Phase 1 remains open only for backup custody.
  Its artifact gate requires the already verified APK, inventory, extraction, and native hashes.
- Phases 3 and 4 depend on the Phase 2 native/resource map and then proceed in parallel.
- Phase 5 starts after the Classic presentation subset and gameplay/physics contracts are ready.
  That static subset is now registered. Creator has imported the exact recovered APK corpus,
  serialized the first `classic.scene`, and exercised exact background/text/ordinary-fruit,
  cut-half, critical-particle, score-HUD, and core-audio consumers in the bounded Classic loop.
  Exact recovered fail-marker resources and action timings are now integrated,
  contract-tested, and visually verified in a fresh `720x1280` Preview after invalidating
  Creator's stale code cache. The score HUD is exact; `classic_best_1` persistence remains
  deferred. The static contracts and Creator boundary now also cover the exact mode-0 result
  entry: completed-run score, result rasters/fonts, three-rank insertion and cues, selected
  retry/menu frames, independent entrance actions, and the recovered coin-bonus callback.
  The integrated continuation now adds the exact delayed 100-sprite result burst, rotating
  effect/coin/badge/bonus-label tree, signed-int32 coin accounting, and process-owned storage
  for `total_coins` plus `classic_best_1/2/3`. App-hide saves are active; Retry mutations remain
  memory-only, and unreadable target storage recovers to exact defaults with diagnostics while
  writes stay disabled for that process to prevent progression loss. Preview
  confirms result removal restores the prior Physics2D lifecycle and a real Retry click reloads
  a running Classic scene without an error overlay. Main Menu replacement/exit-save, full
  first-launch Settings initialization, and native same-parent Retry remain open rather than
  being approximated.
  The exact standard-bomb raster/audio/entity foundation and Concurrent batch partition are
  also contract-tested, while bomb controllers remain deferred pending non-invented procedural
  explosion geometry. Project completion still requires the remaining resource consumers and
  scene/prefab map, a pinned integration/toolchain policy, and build validation.
- Phase 6 expands only after the Cocos Creator vertical slice passes contract tests.
- Phase 1's two offline backups remain a custody closeout; they are not runtime evidence and
  do not prevent read-only static analysis from continuing against the verified workspace copy.

## Acceptance Criteria

- Every identified state and gameplay mode has a versioned contract or an explicit unknown.
- Every implemented rule links to binary/resource evidence or a reviewed inference and test.
- Every reused asset has provenance, usage, hash, and rights status.
- Every canonical game resource is inventoried, staged losslessly, and linked to a Cocos
  consumer; technical coverage is 100%, independent of the release-rights decision.
- Recovered physics constants and collision/scoring rules map to Creator Physics2D tests.
- Deterministic reconstruction fixtures cover state, timing, scoring, input, saves, and
  progression; they validate internal consistency, not identity with an unobservable runtime.
- Static corroboration, resource/layout checks, and user-memory or historical-media review
  are explicit, with uncertainty never counted as recovered coverage.
- The canonical sample-project resource manifest/root is resolved so coverage can be
  finalized without guessing at the denominator.
- The versioned cross-domain fidelity score reaches at least `99%`, with every residual gap
  listed rather than hidden by weighting or silent substitution.
- The Creator Android build contains no original binary/runtime, decompiler output, or reference bridge.
- Public release occurs only after asset, font, music, trademark, and code-rights review.

## Research

- [APK static forensics](./research/apk-static-forensics.md)
- [Restoration strategy](./research/restoration-strategy.md)
- [Cocos Creator target](./research/cocos-creator-target.md)

## Reviews

- [Red-team review](./reports/reviewer-2026-07-21-restoration-plan.md)
- [Validation](./reports/validator-2026-07-21-restoration-plan.md)
- [Static-only revision](./reports/planner-2026-07-22-static-only-revision.md)
- [Static-only validation](./reports/validator-2026-07-22-static-only-revision.md)
- [Phase 2 static corpus progress](./reports/phase-02-2026-07-22-static-corpus-progress.md)
- [Phase 3 Classic presentation progress](./reports/phase-03-2026-07-22-classic-presentation-progress.md)
- [Phase 4 Classic contract progress](./reports/phase-04-2026-07-22-classic-contract-progress.md)
- [Phase 5 foundation progress](./reports/phase-05-2026-07-22-foundation-progress.md)
- [Creator readiness audit](./reports/creator-readiness-2026-07-22.md)
- [Android toolchain readiness audit](./reports/android-toolchain-readiness-2026-07-22.md)

The 2026-07-21 reviews are historical. Their reference-device and runtime-capture assumptions
were superseded by the 2026-07-22 static-only decision.
