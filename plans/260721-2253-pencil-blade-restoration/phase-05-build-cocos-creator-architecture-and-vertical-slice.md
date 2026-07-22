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
first `classic.scene` with the resolution/session bridge and four-slot input component; the
remaining scene/prefab map still needs to be completed before this phase can close.

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
- [ ] Lossless Creator resource import for the slice
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
- `assets/scenes/classic.scene` is Editor-serialized and attaches `BladeInputController` plus
  `ClassicSceneController` to Canvas.
- Resolved gravity/sleep/solver properties are configured, while automatic Physics2D simulation
  is held off and its accumulator reset until the timestep policy is reviewed.
- Preview opens at `720x1280`, current Creator Console counters remain zero, Creator's bundled
  strict TypeScript compiler passes, and the deterministic vertical-slice suite passes `66/66`.
- No original presentation asset has been imported because content rights remain unknown.

## Current Blockers

- Completion of the remaining scene, prefab, and serialized component ownership map.
- Live Creator Physics2D timestep validation.
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
