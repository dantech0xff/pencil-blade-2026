# Codebase Summary

Snapshot metrics were generated from `repomix-output.xml` on 2026-07-23. Current workspace
status is maintained manually and is updated through the 2026-07-24 Crazy Bird checkpoint.

## Snapshot

| Metric | Value |
|---|---|
| Files packed | 1,450 |
| Total tokens | 2,523,203 |
| Total characters | 9,230,813 |
| Output format | XML |

## Current Workspace Shape

| Area | What is present |
|---|---|
| `docs/` | Program plan, evidence register, architecture decision, PDR, and supporting summaries. |
| `forensics/` | Static evidence maps, contracts, claims, and native/resource analysis outputs. |
| `game/` | Creator 3.8.8 project with pure TypeScript domain modules, Creator adapters, exact recovered APK assets, and production routes for Classic, Crazy, Classic Bird, and Crazy Bird. |
| `tests/reconstruction/vertical-slice/` | Contract tests for the recovered menu/shared-scene, Classic, Crazy, Classic Bird, and Crazy Bird slices plus source-boundary audits. |
| `scripts/` | Build-audit and reconstruction utility scripts. |
| `plans/260721-2253-pencil-blade-restoration/` | The restoration plan, phase specs, and dated progress reports. |

## Key Implementation Surfaces

| Surface | Role |
|---|---|
| `game/assets/scripts/domain/` | Pure Classic, Crazy, bird, menu/shared-scene, timer/bonus/objective/result, and presentation contracts. |
| `game/assets/scripts/domain/bird-blade-state.ts`, `bird-blade-particle-plan.ts`, `bird-resource-contract.ts`, `classic-bird-session.ts`, `classic-bird-toss-config.ts`, `classic-bird-toss-coordinator.ts`, `classic-bird-result-ranking.ts`, `classic-bird-result-navigation.ts` | Shared BaseBird/BirdBlade substrate, Classic Bird session/result contracts, bird-only resource closure, and the mode-3 lifecycle. |
| `game/assets/scripts/domain/crazy-timed-mode-profile.ts`, `crazy-bird-result-ranking.ts`, `crazy-bird-result-navigation.ts` | Immutable mode-1/mode-4 profile split, Crazy Bird leaderboard/reward keys, and fresh mode-4 retry/menu commands. |
| `game/assets/scripts/creator/bird-input-controller.ts`, `bird-blade-ray-adapter.ts`, `bird-blade-presenter.ts`, `bird-resource-loader.ts`, `classic-bird-scene-controller.ts`, `classic-bird-gameplay-controller.ts`, `classic-bird-word-presenter.ts` | Creator boundary for Bird touch input, ray handling, presentation, resource loading, and the production Classic Bird route. |
| `game/assets/scripts/creator/classic-physics-adapter.ts` | Creator Physics2D boundary for unit conversion, synchronized public manual stepping, and deferred lifecycle mutations. |
| `game/assets/scripts/creator/blade-input-controller.ts` | Global Cocos touch input mapped to the recovered four Classic blade slots. |
| `game/assets/scripts/creator/classic-scene-controller.ts` | Canvas bridge for resolution, variable Physics2D stepping, blade rays, and ordered session commands. |
| `game/assets/scripts/creator/classic-gameplay-controller.ts` | Bounded Classic coordinator for resource loading, intro, normal-free tosses, cuts, exact core audio/effects, score/combo, exact miss presentation, game over, mode-0 result entry, and retry. |
| `game/assets/scripts/creator/crazy-scene-controller.ts`, `crazy-gameplay-controller.ts` | Shared production coordinator for the profiled mode-1 Crazy and mode-4 Crazy Bird 60-second sessions, controller graph, pause/replay/quit, Time-Up/Result transactions, ranking/reward, and exact run ownership. |
| `game/assets/scripts/creator/crazy-entity-registry.ts` and Crazy entity/effect presenters | Runtime ownership for normal/double/bonus tosses, standard-bomb fuse/explosion, electric, magnet, special fruit, Dragon and its auxiliary pieces. |
| `game/assets/scripts/domain/classic-score-hud-presentation.ts`, `game/assets/scripts/creator/classic-score-hud-presenter.ts` | Exact recovered score icon, best-score cup, double-score panel, `Fonts/Linds.ttf`, entry fade, icon pulse, overlapping double-score presentation, and best-score state display. |
| `game/assets/scripts/domain/classic-result-presentation.ts`, `classic-result-ranking.ts`, `classic-result-particle-explosion.ts`, `classic-result-reward-presentation.ts`, `classic-settings-state.ts` plus their Creator presenters/runtime | Exact mode-0 result geometry/actions, `Best_1/2/3` ranking, 100-particle burst, rotating reward tree, signed-int32 coin accounting, the eleven-field Settings subset, result fonts/rasters, retry/menu frames, and failure-safe teardown. Missing or corrupt save now falls back to `999999` coins while a valid persisted balance wins; the historical native `2014` default remains in the research reports. |
| `game/assets/scripts/creator/classic-entity-registry.ts`, `classic-generated-fruit.ts` | Runtime normal-fruit ownership using exact intact rasters, recovered fixtures/kinematics, bounds, duplicate cut dispatch, and deferred disposal. |
| `game/assets/scripts/creator/classic-generated-bomb.ts`, standard-bomb fuse/explosion owners, `game/assets/scripts/domain/classic-spawn-plan-batch.ts` | Exact standard Bomb ID `0` entity, fuse smoke, recovered procedural explosion/completion, and fail-closed Concurrent batch partitioning; integrated in Crazy while Classic scheduling remains separate. |
| `game/assets/scripts/creator/classic-cut-half-presenter.ts`, `classic-critical-particle-presenter.ts`, `classic-fail-presenter.ts` | Exact ordinary cut-half resources, recovered motion/fade/critical particles, and exact three-marker miss presentation. |
| Classic/Crazy/Bird audio presenters and resource loaders | Creator bundle loading for reviewed mode-specific audio, result/pause/objective fonts and rasters, retained effect voices, and the current production resource subsets. |
| `assets/catalog/creator-staging-manifest.json`, `scripts/stage-creator-assets.mjs`, `scripts/validate-creator-resource-meta.mjs` | Exact-byte staging contract and current Creator import-metadata validation for the recovered APK corpus. |
| `game/assets/scenes/classic.scene` | Editor-serialized persistent Canvas with the app shell and passive Classic/Crazy/Bird runtime bridges. |
| `tests/reconstruction/vertical-slice/*.test.ts` | `952/952` deterministic regressions for the Crazy Bird checkpoint, including fault-injected Classic, Crazy, Classic Bird, and Crazy Bird lifecycle transactions. |
| `tests/reconstruction/vertical-slice/source-boundary-audit.ts` | Boundary scanner for prohibited runtime, bridge, decompiler, and legacy-engine artifacts. |
| `scripts/audit-creator-build.mjs` | Post-build archive audit for APK/AAB outputs. |
| `tests/audit-creator-build-test.mjs` | Synthetic coverage for the build-audit script. |

## What This Repository Is Doing Now

- Reconstructing Pencil Blade from static evidence only.
- Keeping the original APK, `libgame.so`, and legacy engine runtime as evidence, not runtime dependencies.
- Building Classic, Crazy, Classic Bird, and Crazy Bird as clean TypeScript with Creator adapters at the boundary.
- Rendering the exact Classic score HUD with authoritative best-score updates seeded from persisted `classic_best_1`.
- Running the shared BaseBird/BirdBlade substrate for Classic Bird mode `3` and Crazy Bird
  mode `4`; modes `2` and `5` remain fail closed.
- Preserving the user-approved missing/corrupt save fallback of `999999` coins while valid persisted balances win and normal `2500` unlock deductions/rewards remain real.
- Replacing the finished Classic layer with the recovered mode-0 result-entry shell, including exact rank insertion/cues, delayed particle burst, reward tree, and coin-bonus callback.
- Running Crazy as a separately prepared mode-1 owner with recovered `60 / GO!`, normal/double/bonus controllers, standard/electric bombs, special fruit, magnet, Dragon, objectives, pause, audio, and Result.
- Running Crazy Bird as mode `4` through the shared Crazy controllers with BirdBlade type `2`,
  the exact 17-raster profile, distinct objective selectors, `bird_crazy_best_1..3`, and the
  float32 `0.8` reward path.
- The Crazy Bird checkpoint is `952/952` deterministic tests, `38/38` resource/build/catalog
  tests, `14/14` inventory/evidence cases in `217s`, reconstruction policy positive plus
  `4/4` negative fixtures, native static analysis `7/7`, strict Creator TypeScript, clean diff
  hygiene, and an approved independent runtime review with no P0/P1/P2 finding.
- Fresh Creator Preview reaches Main Menu → Mode Select → Crazy Bird → live Bird/type-2
  presentation → Pause/Resume/Replay → Pause Quit → Main Menu; the final post-gesture DevTools
  check reports `0` messages.

## Current Open Gates

- Scene, prefab, and serialized component map completion beyond the first Canvas bridge.
- Creator Physics2D runtime-equivalence validation and electric-field compatibility.
- Full Settings coverage beyond the eleven implemented fields and separate mode-unlock keys, including first-launch initialization and the Main Menu exit-save checkpoint.
- Combo Bird is next, then GN Style.
- Full progression state and remaining audio/effect/presentation consumers.
- The Classic Bird Preview replay/quit path is clean.
- Technical fidelity is separate from release rights; rights review can still block release even when the technical coverage target is met.
- Rights review for original assets and product identity.
- Android build validation and real APK/AAB post-build audit.
