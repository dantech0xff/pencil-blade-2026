---
phase: 5
title: "Build Cocos Creator Architecture and Vertical Slice"
status: in-progress
priority: P1
dependencies: [3, 4]
effort: "2-4 weeks"
---

# Phase 5: Build Cocos Creator Architecture and Vertical Slice

## Overview

Create the production project in the latest stable Cocos Creator and prove one complete
Classic loop implemented independently in TypeScript with Creator Physics2D. The editor
foundation now exists under `game/`. Creator has reopened that exact root and serialized the
first `classic.scene` with resolution/session, four-slot input, and a bounded generated
normal-fruit loop. All 862 recovered APK game assets are staged and imported; the current loop
uses exact background, intro/terminal/fail-marker art, score icon, best-score cup,
double-score panel, Linds font, intact/cut fruit, critical-particle, and core-audio resources.
The exact standard-bomb raster/audio/entity foundation is also implemented and tested, but is
not scheduled into the playable loop until its unresolved procedural explosion geometry can be
restored without guessing. The `classic_best_1` persistence adapter remains deferred. The
remaining scene/prefab map, consumer coverage, and full Classic scope still need to be
completed before this phase can close.

## Context Links

- [Presentation contracts](./phase-03-catalog-resources-and-reconstruct-presentation.md)
- [Gameplay contracts](./phase-04-reverse-engineer-native-gameplay-contracts.md)
- [Cocos Creator target](./research/cocos-creator-target.md)
- [Local Creator readiness](./reports/creator-readiness-2026-07-22.md)
- [Android toolchain readiness](./reports/android-toolchain-readiness-2026-07-22.md)
- [Creator architecture decision](../../docs/decisions/cocos-creator-architecture.md)
- [Reconstruction policy](../../reference/reconstruction-policy.yaml)
- [Official Cocos Creator download](https://www.cocos.com/creator-download)
- [Official Cocos Creator 3.8 LTS manual](https://docs.cocos.com/creator/3.8/manual/en/)

## Requirements

- Verify the official stable channel immediately before project creation. Baseline is
  Cocos Creator 3.8.8, rechecked 2026-07-22; pin the exact editor, engine revision, and
  Android toolchain once, then change them only through a reviewed migration decision.
- Implement all application/gameplay behavior in TypeScript using Creator scenes, nodes,
  components, prefabs, assets, and supported engine APIs.
- Never package, load, call, wrap, emulate, translate mechanically, or port libgame.so or
  the original Cocos2d-x 2.1.4 application runtime. No JNI/JSB bridge may host old gameplay.
- Implement main menu to one Classic loop: start, swipe, cut, miss/bomb, score, pause,
  game over, and retry at canonical 480x800 and 720x1280 reference viewports.
- Start only when Phase 3 has the Classic presentation subset/reconstruction policy and
  Phase 4 has an end-to-end Classic contract/map with critical unknowns disclosed.

## Architecture

Create the editor-generated project under `game/`. Keep scoring, progression, spawn, input,
and state rules in testable TypeScript modules driven by an explicit clock/random source.
Creator components adapt those rules to scene lifecycle, rendering, audio, storage, and
platform services. Creator Physics2D is the production simulation layer behind a narrow
adapter configured from recovered gravity, timestep, body/fixture, filtering, velocity,
ray-cast, and contact contracts. Any compatibility adjustment stays explicit at that boundary.

## Related Code Files

- Create: ../../docs/decisions/cocos-creator-architecture.md
- Create: ../../docs/system-architecture.md
- Update: ../../docs/cocos-creator-contract-map.md
- Create via pinned editor: ../../game/
- Create: ../../game/assets/scenes/
- Create: ../../game/assets/prefabs/
- Create: ../../game/assets/scripts/core/
- Create: ../../game/assets/scripts/domain/
- Create: ../../game/assets/scripts/creator/
- Create: ../../game/build-config/android.json
- Create: ../../tests/reconstruction/vertical-slice/
- Read: ../../reference/reconstruction-policy.yaml

## Implementation Steps

1. Recheck the official stable release; record editor version, engine tag/revision,
   installer hash/source, JDK, SDK, NDK, Gradle/AGP, render backend, and Android ABI set.
2. Scaffold `game/` with the pinned Creator editor and commit only source/configuration
   files intended by the project boundary; never hand-copy legacy engine project files.
3. Record the one-way mapping from recovered C++ classes/functions to new TypeScript
   domain services, Creator components, scenes/prefabs, events, and validation cases.
4. Stage only the vertical-slice resource subset through the Phase 3 manifest; verify
   source hashes, Creator import metadata, dimensions, alpha, audio, and font metrics.
5. Implement `GameClock`, deterministic random, reconstruction input fixtures, and
   state/event logging; isolate the native variable-step contract from Creator's documented
   fixed-timestep boundary and test the reviewed compatibility strategy explicitly.
6. Implement Creator adapters and scenes for boot, menu, Classic gameplay, pause, result,
   audio, storage, resolution scaling, and lifecycle.
7. Run conformance tests against recovered constants, invariants, state transitions, toss
   trajectories, contacts, blade ray casts, scoring, presentation ordering, and save fixtures.
8. Generate deterministic traces from the reconstruction and verify repeatability and
   contract coverage. These fixtures are internal regression baselines, not original captures.
9. Audit source and built APK/AAB contents for prohibited original binary/runtime/code paths.
10. Fix Creator mapping or reverse-engineering gaps before expanding to additional modes.

## Todo List

- [x] Cocos Creator 3.8.8 editor and engine identity recorded
- [ ] Android SDK, NDK, JDK, Gradle, and ABI pin completed
- [x] Proposed Creator architecture and C++-to-TypeScript ownership map
- [ ] Editor-generated project structure and final serialized-component map
- [x] Deterministic time/random/input seams
- [x] Lossless Creator resource import for the slice
- [ ] Complete Classic vertical slice
- [ ] Automated contract/traceability and prohibited-runtime audit
- [x] Static-evidence readiness gates recorded with evidence IDs

## Validation

- Build-audit command: `node scripts/audit-creator-build.mjs <build.apk|build.aab>`
- Synthetic audit test: `node --test tests/audit-creator-build-test.mjs`
- Current synthetic audit result: `8/8` pass. A real generated artifact remains required.

Current Editor integration:

- Project default design resolution is `720x1280`; runtime resolution selection preserves the
  recovered physical-width `720` branch and the `480x800` fallback through `SHOW_ALL`.
- `assets/scenes/classic.scene` is Editor-serialized and attaches `BladeInputController`,
  `ClassicSceneController`, and `ClassicGameplayController` to Canvas.
- Resolved gravity/sleep/solver properties are configured. Automatic Physics2D simulation stays
  off; a custom post-update system performs the recovered one-per-frame variable step with
  explicit synchronization and a project-owned deferred-mutation boundary.
- All 862 recovered APK game assets (784 PNG, 59 WAV, 3 MP3, and 16 fonts) are staged
  byte-for-byte under the Creator bundle. The current import validator covers 934 generated
  metadata sidecars; the manifest's per-asset consumer and UUID fields still require backfill.
- The exact standard Bomb ID `0` raster is cataloged; a tested Creator entity owns its recovered
  `(0.5, 0.4)` anchor, dynamic circle fixture/filter, spawn mutations, first-cut guard, motion
  freeze, audio-before-freeze hook, callback-failure cleanup, and deferred completion seam.
  Three ordinary-bomb clips and isolated retained voice handles are loaded, while electric-only
  `boomhit` remains excluded. The physics adapter installs and restores both fruit and bomb rows.
- The exact score HUD is integrated: the score icon, best-score cup, double-score panel,
  entry fade, icon pulse, and overlap-safe double-score actions are recovered. Score display
  tracks the authoritative score service, while `classic_best_1` persistence remains deferred.
  Ordered Score HUD, World, and Fail roots prevent dynamically created gameplay nodes from
  crossing recovered equal-z presentation layers.
- The latest Preview pass opened at `720x1280` after clearing Creator's stale generated-code
  cache and demonstrated the recovered `GOOD / LUCK!` intro, exact ordinary-fruit spawning,
  score/best HUD, green-to-red fail-marker transitions, and 60 FPS with zero Creator Console
  errors. The portrait mask prevented presentation leakage into the browser pillarbox.
- The current playable slice is not presentation-complete; the exact staging gate is complete
  for the recovered APK corpus, but 100% consumer coverage and canonical sample-project
  completeness remain open. Release rights are a separate review.
- The deterministic vertical-slice suite passes `161/161`, and Creator's bundled strict
  TypeScript compiler passes.

## Current Blockers

- Completion of the remaining scene, prefab, and serialized component ownership map.
- Deterministic trajectory, contact, exact ray-order, and deferred lifecycle validation on
  the custom variable-step boundary.
- Canonical sample-project resource manifest/root resolution so the presentation coverage gate
  and `99%` metric can be finalized.
- Exact ordinary-bomb explosion point generation/rasterization plus safe registry/controller
  lifecycle integration, including the unresolved native lower-bound side effect; no sprite
  substitute, Fruit-miss substitution, or invented triangle pattern is accepted.
- The `classic_best_1` persistence adapter remains deferred/unimplemented.
- Electric-field compatibility decisions.
- Android build validation and real APK/AAB post-build audit.
- Rights review for original assets and product identity.

## Success Criteria

- [ ] Pinned Cocos Creator project builds and runs on the supported Android matrix
- [ ] All slice behavior is owned by reviewable TypeScript and Creator content
- [ ] Build contains no original APK, libgame.so, Cocos2d-x 2.1.4 runtime/source,
      decompiler artifact, native compatibility bridge, or emulator layer
- [ ] Classic scenario satisfies every recovered contract and records accepted inferences/unknowns
- [ ] Creator Physics2D tests cover recovered timestep, gravity, fixtures, contacts, ray casts,
      and contact-driven gameplay outcomes
- [ ] Automated report names reconstruction-policy and contract-evidence versions
- [ ] No legacy ad/social dependency exists in gameplay code

## Risk Assessment

- Creator/editor upgrades can alter serialization and rendering: pin once and treat upgrades
  as migrations with full reconstruction-suite reruns.
- Creator physics, scheduler, tween, fonts, blending, or audio can differ from recovered
  semantics: isolate engine boundaries and test them against the static contracts.
- Asset import may trim, recompress, or reinterpret alpha: enforce catalog-driven presets
  and rendered-output reconciliation.

## Security Considerations

Use current supported Android tooling. Keep forensic/decompiler directories outside Creator
imports and release builds. Platform adapters contain no recovered credentials, identifiers,
ad SDKs, or executable code from the APK.

## Next Steps

Proceed to Phase 6 only after the Creator vertical-slice gate passes and the Classic
presentation/gameplay/physics contracts are covered. Continue Phase 4 analysis for later modes.
