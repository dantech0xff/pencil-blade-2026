# Codebase Summary

Generated from `repomix-output.xml` on 2026-07-22.

## Snapshot

| Metric | Value |
|---|---|
| Files packed | 1,123 |
| Total tokens | 1,586,592 |
| Total characters | 5,346,491 |
| Output format | XML |

## Current Workspace Shape

| Area | What is present |
|---|---|
| `docs/` | Program plan, evidence register, architecture decision, PDR, and supporting summaries. |
| `forensics/` | Static evidence maps, contracts, claims, and native/resource analysis outputs. |
| `game/` | Creator 3.8.8 project with pure TypeScript domain modules, Creator adapters, all 862 exact recovered APK game assets in a bundle, a `720x1280` default, and the first Editor-authored Classic scene. |
| `tests/reconstruction/vertical-slice/` | Contract tests for the recovered Classic slice plus source-boundary audits. |
| `scripts/` | Build-audit and reconstruction utility scripts. |
| `plans/260721-2253-pencil-blade-restoration/` | The restoration plan, phase specs, and dated progress reports. |

## Key Implementation Surfaces

| Surface | Role |
|---|---|
| `game/assets/scripts/domain/` | Pure Classic gameplay state, physics rules, score/combo/fail services, random sources, and toss planning. |
| `game/assets/scripts/creator/classic-physics-adapter.ts` | Creator Physics2D boundary for unit conversion, synchronized public manual stepping, and deferred lifecycle mutations. |
| `game/assets/scripts/creator/blade-input-controller.ts` | Global Cocos touch input mapped to the recovered four blade slots. |
| `game/assets/scripts/creator/classic-scene-controller.ts` | Canvas bridge for resolution, variable Physics2D stepping, blade rays, and ordered session commands. |
| `game/assets/scripts/creator/classic-gameplay-controller.ts` | Bounded Classic coordinator for resource loading, intro, normal-free tosses, cuts, exact core audio/effects, score/combo, exact miss presentation, game over, mode-0 result entry, and retry. |
| `game/assets/scripts/domain/classic-score-hud-presentation.ts`, `game/assets/scripts/creator/classic-score-hud-presenter.ts` | Exact recovered score icon, best-score cup, double-score panel, `Fonts/Linds.ttf`, entry fade, icon pulse, overlapping double-score presentation, and best-score state display. |
| `game/assets/scripts/domain/classic-result-presentation.ts`, `classic-result-ranking.ts`, `classic-result-particle-explosion.ts`, `classic-result-reward-presentation.ts`, `classic-settings-state.ts` plus their Creator presenters/runtime | Exact mode-0 result geometry/actions, `Best_1/2/3` ranking, 100-particle burst, rotating reward tree, signed-int32 coin accounting, four-key Settings persistence, result fonts/rasters, retry/menu frames, and failure-safe teardown. Main Menu/full Settings/same-parent Retry remain seams. |
| `game/assets/scripts/creator/classic-entity-registry.ts`, `classic-generated-fruit.ts` | Runtime normal-fruit ownership using exact intact rasters, recovered fixtures/kinematics, bounds, duplicate cut dispatch, and deferred disposal. |
| `game/assets/scripts/creator/classic-generated-bomb.ts`, `game/assets/scripts/domain/classic-spawn-plan-batch.ts` | Foundation-only standard Bomb ID `0` entity with exact raster/fixture/cut guard plus fail-closed partitioning of flattened Concurrent spawn batches; not yet wired into playable controllers. |
| `game/assets/scripts/creator/classic-cut-half-presenter.ts`, `classic-critical-particle-presenter.ts`, `classic-fail-presenter.ts` | Exact ordinary cut-half resources, recovered motion/fade/critical particles, and exact three-marker miss presentation. |
| `game/assets/scripts/creator/classic-audio-presenter.ts`, `classic-resource-loader.ts` | Creator bundle loading for the reviewed 27-clip audio set, exact result fonts/rasters, isolated retained bomb voices, and the current raster subset. |
| `assets/catalog/creator-staging-manifest.json`, `scripts/stage-creator-assets.mjs`, `scripts/validate-creator-resource-meta.mjs` | Exact-byte staging contract and current Creator import-metadata validation for the recovered APK corpus. |
| `game/assets/scenes/classic.scene` | Editor-serialized first scene with all three current runtime bridge components. |
| `tests/reconstruction/vertical-slice/*.test.ts` | Deterministic regression coverage for the current vertical slice. |
| `tests/reconstruction/vertical-slice/source-boundary-audit.ts` | Boundary scanner for prohibited runtime, bridge, decompiler, and legacy-engine artifacts. |
| `scripts/audit-creator-build.mjs` | Post-build archive audit for APK/AAB outputs. |
| `tests/audit-creator-build-test.mjs` | Synthetic coverage for the build-audit script. |

## What This Repository Is Doing Now

- Reconstructing Pencil Blade from static evidence only.
- Keeping the original APK, `libgame.so`, and legacy engine runtime as evidence, not runtime dependencies.
- Building the Classic slice as clean TypeScript with Creator adapters at the boundary.
- Rendering the exact Classic score HUD with authoritative best-score updates seeded from
  persisted `classic_best_1`.
- Replacing the finished Classic layer with the recovered mode-0 result-entry shell, including
  exact rank insertion/cues, delayed particle burst, reward tree, and coin-bonus callback.
  `total_coins` and `classic_best_1/2/3` persist at app hide while Retry mutations remain
  process-local until that checkpoint. Result replacement restores Creator's
  prior Physics2D state, and Retry keeps controls available across immediate/asynchronous load
  failures; full Settings, Main Menu navigation/exit-save, and same-parent Retry remain
  deliberately incomplete rather than inferred.
- Documenting unresolved gates instead of folding them into recovered behavior.
- The canonical sample-project resource root/manifest remains unresolved; presentation coverage
  cannot be finalized until that source is resolved.

## Current Open Gates

- Scene, prefab, and serialized component map completion beyond the first Canvas bridge.
- Creator Physics2D runtime-equivalence validation and electric-field compatibility.
- Full Settings coverage beyond `total_coins` and `classic_best_1/2/3`, including first-launch
  initialization and the Main Menu exit-save checkpoint.
- Eight deferred toss controllers plus bomb registry/explosion integration, specials,
  pause/Main Menu, full progression state, and remaining
  audio/effect/presentation consumers.
- Technical fidelity is separate from release rights; rights review can still block release
  even when the technical coverage target is met.
- Rights review for original assets and product identity.
- Android build validation and real APK/AAB post-build audit.
