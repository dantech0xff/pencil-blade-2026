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
updated: "2026-07-24"
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
| 6 | [Recreate Full Game Content and Progression](./phase-06-recreate-full-game-content-and-progression.md) | In progress |
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
  contract-tested, and exercised in a fresh `720x1280` Preview attempt after invalidating
  Creator's stale code cache. The score HUD is exact and its `classic_best_1` baseline now
  comes from the process-owned persistence runtime. The static contracts and Creator boundary
  now also cover the exact mode-0 result
  entry: completed-run score, result rasters/fonts, three-rank insertion and cues, selected
  retry/menu frames, independent entrance actions, and the recovered coin-bonus callback.
  The integrated continuation now adds the exact delayed 100-sprite result burst, rotating
  effect/coin/badge/bonus-label tree, signed-int32 coin accounting, and process-owned storage
  for `total_coins`, `classic_best_1/2/3`, and `enable_effect` in recovered order with default
  effect `true`. The settings runtime is now exact for the implemented slice: 50 integers and
  4 booleans, 18 blade price keys/defaults, 8 background price keys/defaults, price `0`
  sentinel ownership, and storage-first idempotent purchase writes. App-hide saves are active;
  Retry mutations remain memory-only, and unreadable target storage recovers to exact defaults
  with diagnostics while writes stay disabled for that process to prevent progression loss. The
  current Preview attempt exercises the result boundary and a same-parent Result->Retry cycle at
  the captured parent without a reload or error overlay. Result-to-Main Menu replacement is now
  implemented transactionally. Main Menu exit-save is implemented; the first-launch `flag`
  bootstrap remains open.
  Phase 5A now prioritizes fidelity gaps visible in the playable slice. The default selected
  BasicBlade has a statically recovered four-slot lifecycle, exact `blade0.png` resource,
  ten-point limit, frame-based disposal, and textured triangle-strip geometry; its exact default
  implementation is now review-passed with four persistent fixed-capacity meshes. Main Menu,
  Mode Select, and the persistent app shell are implemented; the Leaderboard screen is now the
  exact six-board local/offline read-only surface in native order Classic, Crazy, Gangnam Style,
  Classic Bird, Crazy Bird, Combo Bird. It snapshots process-owned Settings once, performs no
  ranking, mutation, load/save, network, JNI/platform, particles, or RNG, and uses the
  constrained 10-raster/two-font/`menubuttonclick` resource subset. Main Menu target ID `13`
  waits `0.75s`; Back returns immediately to a fresh Main Menu; the Back click is emitted only
  after successful commit. The current checkpoint reaches `139/139` focused Main Menu +
  Leaderboard + shell/viewport tests, `1354/1354` full vertical-slice tests, `43/43` resource/build
  tests, Creator 3.8.8 bundled strict TypeScript zero diagnostics, and clean `git diff --check`.
  Creator Preview passes physical cut entry, aligned labels/scores after native-to-Creator
  anchor conversion, drag/flick board selection, and Back in the internal compact `480x800`
  branch and high `720x1280` profile. The standard-blade
  checkpoint remains `1285/1285` as the historical route-ownership slice.
  The exact standard-bomb raster/audio/entity foundation and Concurrent batch partition are
  contract-tested. Crazy mode now owns its recovered 60-second session, controller graph,
  standard-bomb explosion/fuse-smoke path, special/electric/magnet/Dragon entities, audio,
  objectives, pause, result ranking/reward, and transactional Replay/Quit/Time-Up/Retry
  lifecycles. Pre-commit Result failures restore the exact Crazy/TimeManager owner; post-commit
  cleanup failures are retained for retry without reopening the committed session. Crazy Bird
  mode `4` profiles that shared graph with BirdBlade type `2`, the exact 17-raster type-2
  closure, distinct objective events, `bird_crazy_best_1..3`, a float32 `0.8` reward, and
  fresh mode-4 replay/retry/menu ownership. The exact native `ActionGoCallback` operand/order
  remains a disclosed static inference gap.
  Combo Bird mode `5` is a separate production owner rather than a Crazy profile. It composes
  BirdBlade type `3`, the exact type-3 and instruction/TimeManager resources, a recovered
  `90`-second timer, three ordinary-fruit toss controllers, objectives, pause, result ranking
  and reward, and transactional replay/retry/menu lifecycles. Its leaderboard keys are
  `bird_combo_best_1..3` and its recovered reward factor is float32 `0.8`. Missing or corrupt
  storage still falls back to `999999` coins while a valid persisted balance wins.
  The standard-blade runtime checkpoint is also complete: IDs `0`-`17` now route
  transactionally through Main Menu, Mode Select, Classic, the Crazy standard branch, and GN
  Style with exact Basic textures, particle plans, Dragon multipart behavior, and Centipede
  multipart behavior.
  GN Style mode `2` is an independent ordinary-fruit timed owner using the standard four-slot
  BasicBlade path. It preserves the recovered `150`-second Free/Wave/Concurrent graph, exact
  `2.60`-second intro, non-looping `GangnamStyle.mp3`, all 439 source-ordered particle parents,
  the three-second late-cut Time Up tail, objectives `6`/`2`, `gnstyle_best_1..3`, float32
  `0.6` reward, and transactional Replay/Retry/Quit/Menu lifecycles.
  Options now owns the recovered eight-background, eighteen-blade, and ten-theme selectors,
  exact two-tree resources, row timing/audio, live preview, affordability, storage-first
  ownership plus one debit, 45-particle purchase burst, transactional Main Menu handoff, and
  unpaid-selection reconciliation on Back and before app-hide save. Missing/corrupt save
  continues to default to `999999` coins while any valid persisted balance, including `0`, wins.
  Objectives and progression are now complete: all 52 ordered definitions, dual-profile screen
  resources, current/next rows, Skip, achievement popups, Main Menu/Mode Select/gameplay fruit
  notifications, fatal ownership recovery, and Main Menu transactions are integrated. The
  About/offline checkpoint is now complete as the exact ten-raster local/offline screen with
  transactional Main Menu ↔ About ownership, direct Menu/Review/Email/Like controls,
  `MOBILE_BACK`, production pulse disabled by `localCompatibilityAvailable=false`, and
  sanitized retired-offline review/feedback/social events. The checkpoint passes `169/169`
  focused tests, `1494/1494` full vertical-slice tests, `43/43` resource/build tests, Creator
  3.8.8 bundled strict TypeScript, clean diff hygiene, and real pointer
  Main Menu -> About -> Main Menu Preview in internal `480x800` plus high `720x1280`.
  Project completion still requires the remaining resource consumers and scene/prefab map,
  a pinned integration/toolchain policy, and build validation.
- Phase 6 continues after all six production gameplay routes, Options, Leaderboard, Objectives,
  and About/offline reached their contract and fresh Creator Preview gates. The remaining scope
  is first-launch `flag` bootstrap plus global asset-consumer and scene/prefab reconciliation.
  Android build validation and release-rights clearance remain Phase 7 gates.
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
- [Main Menu Creator runtime](./reports/implementer-2026-07-23-main-menu-creator-runtime.md)
- [Mode Select Creator runtime](./reports/implementer-2026-07-23-mode-select-creator-runtime.md)
- [Menu/Mode checkpoint verification](./reports/tester-2026-07-23-menu-mode-checkpoint.md)
- [Menu/Mode runtime simplification review](./reports/simplifier-2026-07-23-menu-mode-runtime.md)
- [Crazy mode production checkpoint](./reports/implementer-2026-07-23-crazy-mode-runtime.md)
- [Classic Bird production checkpoint](./reports/implementer-2026-07-23-classic-bird-runtime.md)
- [Crazy Bird architecture map](./reports/explorer-2026-07-23-crazy-bird-architecture-map.md)
- [Crazy Bird native contract](./reports/researcher-2026-07-23-crazy-bird-native-contract.md)
- [Crazy Bird resource map](./reports/researcher-2026-07-23-crazy-bird-resource-map.md)
- [Crazy Bird production checkpoint](./reports/implementer-2026-07-24-crazy-bird-runtime.md)
- [Crazy Bird final verification](./reports/tester-2026-07-24-crazy-bird-final-checkpoint.md)
- [Crazy Bird runtime review](./reports/reviewer-2026-07-24-crazy-bird-gameplay-shell.md)
- [Combo Bird architecture map](./reports/explorer-2026-07-24-combo-bird-architecture-map.md)
- [Combo Bird production checkpoint](./reports/implementer-2026-07-24-combo-bird-runtime.md)
- [Combo Bird final verification](./reports/tester-2026-07-24-combo-bird-final-checkpoint.md)
- [GN Style native contract](./reports/researcher-2026-07-24-gn-style-native-contract.md)
- [Cosmetic economy native contract](./reports/researcher-2026-07-24-cosmetic-economy-native-contract.md)
- [GN Style resource map](./reports/researcher-2026-07-24-gn-style-resource-map.md)
- [GN Style production checkpoint](./reports/implementer-2026-07-24-gn-style-runtime.md)
- [GN Style final verification](./reports/tester-2026-07-24-gn-style-final-checkpoint.md)
- [GN Style runtime review](./reports/reviewer-2026-07-24-gn-style-gameplay-shell.md)
- [Options native contract](./reports/researcher-2026-07-24-options-native-contract.md)
- [Options integration map](./reports/explorer-2026-07-24-options-integration-map.md)
- [Options resource audit](./reports/explorer-2026-07-24-options-resource-audit.md)
- [Options production checkpoint](./reports/implementer-2026-07-24-options-runtime.md)
- [Options final verification](./reports/tester-2026-07-24-options-final-checkpoint.md)
- [Options runtime review](./reports/reviewer-2026-07-24-options-runtime.md)
- [Objectives native contract](./reports/researcher-2026-07-24-objectives-native-contract.md)
- [Objectives architecture map](./reports/explorer-2026-07-24-objectives-architecture-map.md)
- [Objectives resource map](./reports/researcher-2026-07-24-objectives-resource-map.md)
- [Objectives Creator runtime](./reports/implementer-2026-07-24-objectives-creator.md)
- [Objectives shell host](./reports/implementer-2026-07-24-objectives-shell-host.md)
- [Objectives final verification](./reports/tester-2026-07-24-objectives-final-checkpoint.md)
- [Objectives shell review](./reports/reviewer-2026-07-24-objectives-shell-integration.md)
- [Remaining mode implementation order](./reports/explorer-2026-07-23-remaining-mode-order.md)
- [Creator readiness audit](./reports/creator-readiness-2026-07-22.md)
- [Android toolchain readiness audit](./reports/android-toolchain-readiness-2026-07-22.md)
- [Retry and `enable_effect` checkpoint](./reports/pm-260722-2312-retry-checkpoint.md)

The 2026-07-21 reviews are historical. Their reference-device and runtime-capture assumptions
were superseded by the 2026-07-22 static-only decision.
