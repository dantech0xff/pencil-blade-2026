# Codebase Summary

Generated from `repomix-output.xml` on 2026-07-22.

## Snapshot

| Metric | Value |
|---|---|
| Files packed | 88 |
| Total tokens | 443,095 |
| Total characters | 1,602,948 |
| Output format | XML |

## Current Workspace Shape

| Area | What is present |
|---|---|
| `docs/` | Program plan, evidence register, architecture decision, PDR, and supporting summaries. |
| `forensics/` | Static evidence maps, contracts, claims, and native/resource analysis outputs. |
| `game/` | Creator 3.8.8 project with pure TypeScript domain modules, Creator adapters, a `720x1280` default, and the first Editor-authored Classic scene. |
| `tests/reconstruction/vertical-slice/` | Contract tests for the recovered Classic slice plus source-boundary audits. |
| `scripts/` | Build-audit and reconstruction utility scripts. |
| `plans/260721-2253-pencil-blade-restoration/` | The restoration plan, phase specs, and dated progress reports. |

## Key Implementation Surfaces

| Surface | Role |
|---|---|
| `game/assets/scripts/domain/` | Pure Classic gameplay state, physics rules, score/combo/fail services, random sources, and toss planning. |
| `game/assets/scripts/creator/classic-physics-adapter.ts` | Creator Physics2D boundary for unit conversion and unresolved timestep policy. |
| `game/assets/scripts/creator/blade-input-controller.ts` | Global Cocos touch input mapped to the recovered four blade slots. |
| `game/assets/scripts/creator/classic-scene-controller.ts` | Canvas bridge for resolution, inert resolved Physics2D setup, and ordered session commands. |
| `game/assets/scenes/classic.scene` | Editor-serialized first scene with both runtime bridge components. |
| `tests/reconstruction/vertical-slice/*.test.ts` | Deterministic regression coverage for the current vertical slice. |
| `tests/reconstruction/vertical-slice/source-boundary-audit.ts` | Boundary scanner for prohibited runtime, bridge, decompiler, and legacy-engine artifacts. |
| `scripts/audit-creator-build.mjs` | Post-build archive audit for APK/AAB outputs. |
| `tests/audit-creator-build-test.mjs` | Synthetic coverage for the build-audit script. |

## What This Repository Is Doing Now

- Reconstructing Pencil Blade from static evidence only.
- Keeping the original APK, `libgame.so`, and legacy engine runtime as evidence, not runtime dependencies.
- Building the Classic slice as clean TypeScript with Creator adapters at the boundary.
- Documenting unresolved gates instead of folding them into recovered behavior.

## Current Open Gates

- Scene, prefab, and serialized component map completion beyond the first Canvas bridge.
- Creator Physics2D timestep equivalence and electric-field compatibility.
- Rights review for original assets and product identity.
- Android build validation and real APK/AAB post-build audit.
