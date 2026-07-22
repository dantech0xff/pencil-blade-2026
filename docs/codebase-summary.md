# Codebase Summary

Generated from `repomix-output.xml` on 2026-07-22.

## Snapshot

| Metric | Value |
|---|---|
| Files packed | 137 |
| Total tokens | 478,999 |
| Total characters | 1,749,584 |
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
| `game/assets/scripts/creator/classic-gameplay-controller.ts` | Bounded Classic coordinator for resource loading, intro, normal-free tosses, cuts, exact core audio/effects, score/combo, misses, game over, and retry. |
| `game/assets/scripts/creator/classic-entity-registry.ts`, `classic-generated-fruit.ts` | Runtime normal-fruit ownership using exact intact rasters, recovered fixtures/kinematics, bounds, duplicate cut dispatch, and deferred disposal. |
| `game/assets/scripts/creator/classic-cut-half-presenter.ts`, `classic-critical-particle-presenter.ts` | Exact ordinary cut-half resources and recovered motion/fade/critical-particle presentation. |
| `game/assets/scripts/creator/classic-audio-presenter.ts`, `classic-resource-loader.ts` | Creator bundle loading and presentation of the reviewed 20-clip audio and raster subset. |
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
- Documenting unresolved gates instead of folding them into recovered behavior.
- The canonical sample-project resource root/manifest remains unresolved; presentation coverage
  cannot be finalized until that source is resolved.

## Current Open Gates

- Scene, prefab, and serialized component map completion beyond the first Canvas bridge.
- Creator Physics2D runtime-equivalence validation and electric-field compatibility.
- Eight deferred toss controllers plus bombs, specials, pause/menu/results, and remaining
  audio/effect/presentation consumers.
- Technical fidelity is separate from release rights; rights review can still block release
  even when the technical coverage target is met.
- Rights review for original assets and product identity.
- Android build validation and real APK/AAB post-build audit.
