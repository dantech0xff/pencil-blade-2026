# Codebase Summary

Snapshot metrics were generated from `repomix-output.xml` on 2026-07-24. Current workspace
status is maintained manually and is updated through the 2026-07-24 Objectives runtime
checkpoint.

## Snapshot

| Metric | Value |
|---|---|
| Files packed | 1,627 |
| Total tokens | 2,105,362 |
| Total characters | 7,239,732 |
| Output format | XML |

## Current Workspace Shape

| Area | What is present |
|---|---|
| `docs/` | Program plan, evidence register, architecture decision, PDR, contract map, and supporting summaries. |
| `forensics/` | Static evidence maps, contracts, claims, and native/resource analysis outputs. |
| `game/` | Creator 3.8.8 project with pure TypeScript domain modules, Creator adapters, exact recovered APK assets, Options, Leaderboard, Objectives/progression, and all six production gameplay routes: Classic, Crazy, GN Style, Classic Bird, Crazy Bird, and Combo Bird. |
| `tests/reconstruction/vertical-slice/` | Contract tests for the recovered menu/shared-scene, the six production routes, and source-boundary audits. |
| `scripts/` | Build-audit, extraction, staging, and reconstruction utility scripts. |
| `plans/260721-2253-pencil-blade-restoration/` | The restoration plan, phase specs, and dated progress reports. |

## Key Implementation Surfaces

| Surface | Role |
|---|---|
| `game/assets/scripts/domain/classic-settings-state.ts` | Pure bulk Settings model: coins, selections, all route leaderboards, objectives, the exact 18 blade price keys, the exact 8 background price keys, and load/save/recovery rules. |
| `game/assets/scripts/creator/classic-settings-runtime.ts` | Process-owned Settings runtime with storage-first cosmetic purchase writes, mode-unlock persistence, rated-flag persistence, and write-disable after any load recovery. |
| `game/assets/scripts/domain/options-*.ts`, `game/assets/scripts/creator/options-*.ts` | Recovered eight-background/eighteen-blade/ten-theme selection, affordability, storage-first purchase/debit, rollback, row presentation, exact resources, and purchase particles. |
| `game/assets/scripts/domain/classic-result-presentation.ts`, `classic-result-ranking.ts`, `classic-result-particle-explosion.ts`, `classic-result-reward-presentation.ts` | Exact mode-0 result geometry/actions, ranking, delayed particle burst, and reward tree. |
| `game/assets/scripts/domain/standard-blade-*.ts`, `game/assets/scripts/creator/standard-blade-*.ts`, `game/assets/scripts/creator/main-menu-presenter.ts`, `mode-select-presenter.ts`, `classic-gameplay-controller.ts`, `crazy-gameplay-controller.ts`, `gn-style-gameplay-controller.ts` | Transactional standard-blade route selection and ownership for Main Menu, Mode Select, Classic, the Crazy standard branch, and GN Style across IDs `0`-`17`. |
| `game/assets/scripts/domain/leaderboard-*.ts`, `game/assets/scripts/creator/leaderboard-*.ts`, `game/assets/scripts/creator/main-menu-presenter.ts`, `game/assets/scripts/creator/recovered-app-shell-controller.ts` | Exact six-board local/offline read-only Leaderboard snapshot, presentation, resource loading, and shell routing in native order Classic, Crazy, Gangnam Style, Classic Bird, Crazy Bird, Combo Bird. |
| `game/assets/scripts/domain/objectives-*.ts`, `objective-achievement-presentation.ts`, `game/assets/scripts/creator/objectives-*.ts`, `objective-achievement-*.ts`, `game/assets/scripts/creator/recovered-app-shell-controller.ts` | Exact 52-definition Objectives/progression state, dual-profile screen resources, current/next presentation, Skip, shell-owned achievement popups, all-route fruit notifications, and transactional Main Menu ownership. |
| `game/assets/scripts/domain/bird-blade-state.ts`, `bird-blade-particle-plan.ts`, `bird-resource-contract.ts`, `classic-bird-*` | Shared BaseBird/BirdBlade substrate and Classic Bird mode `3`. |
| `game/assets/scripts/domain/crazy-timed-mode-profile.ts`, `crazy-bird-result-ranking.ts`, `crazy-bird-result-navigation.ts` | Immutable mode-1/mode-4 profile split, Crazy Bird leaderboard/reward keys, and mode-4 retry/menu commands. |
| `game/assets/scripts/domain/combo-bird-*.ts` | Independent mode-5 session, three-controller ordinary-only toss graph, intro, supplemental-resource contract, and `bird_combo_best_1..3`. |
| `game/assets/scripts/domain/gn-style-*.ts` | Independent mode-2 session, `150`-second Free/Wave/Concurrent ordinary-fruit graph, exact intro, generated 439-parent choreography, and `gnstyle_best_1..3`. |
| `game/assets/scripts/creator/recovered-app-shell-controller.ts` | Persistent app shell and transactional Main Menu / Options / Leaderboard / Objectives / Mode Select / gameplay screen replacement. |
| `game/assets/scripts/creator/classic-scene-controller.ts`, `classic-gameplay-controller.ts`, `crazy-scene-controller.ts`, `crazy-gameplay-controller.ts` | Creator lifecycles for the bounded Classic route and the production Crazy routes. |
| `game/assets/scripts/creator/combo-bird-*.ts`, `game/assets/scripts/creator/gn-style-*.ts` | Production Combo Bird and GN Style owners, including pause/result/retry/menu transactions. |
| `game/assets/scenes/classic.scene` | Editor-authored persistent Canvas with the app shell and passive route owners. |
| `tests/reconstruction/vertical-slice/*.test.ts` | `1444/1444` deterministic regressions through the Objectives checkpoint and executable lifecycle faults across all routes. |
| `scripts/audit-creator-build.mjs` | Post-build archive audit for APK/AAB outputs. |
| `tests/audit-creator-build-test.mjs` | Synthetic coverage for the build-audit script. |

## What This Repository Is Doing Now

- Reconstructing Pencil Blade from static evidence only.
- Keeping the original APK, `libgame.so`, and legacy engine runtime as evidence, not runtime dependencies.
- Running all six production gameplay routes as clean TypeScript with Creator adapters at the boundary.
- Running the standard-blade runtime checkpoint across Main Menu, Mode Select, Classic, the Crazy standard branch, and GN Style with IDs `0`-`17` transactionally owned.
- Running the exact six-board Leaderboard checkpoint as the local/offline read-only screen in native order Classic, Crazy, Gangnam Style, Classic Bird, Crazy Bird, Combo Bird.
- Running the exact 52-definition Objectives screen, current/next progression, Skip, achievement
  popups, and global/per-type notifications across Main Menu, Mode Select, and all six routes.
- Preserving the user-approved missing/corrupt save fallback of `999999` coins while valid persisted balances win, including `0`.
- Keeping the exact bulk Settings slice implemented: 50 integers, 4 booleans, 18 blade prices, 8 background prices, storage-first price-0 ownership, and write-disable on any recovery.
- Running recovered Options with eight backgrounds, eighteen blades, ten themes, exact
  affordability/debit, purchase particles, live previews, exit rollback, and pre-save app-hide
  reconciliation.
- Treating Main Menu exit-save and app-hide save as implemented, while first-launch `flag` bootstrap remains open.
- Replacing the finished Classic layer with the recovered mode-0 result-entry shell, including rank insertion/cues, delayed particle burst, reward tree, and coin-bonus callback.
- Running Crazy as a separately prepared mode-1 owner with recovered `60 / GO!`, normal/double/bonus controllers, standard/electric bombs, special fruit, magnet, Dragon, objectives, pause, audio, and Result.
- Running Crazy Bird as mode `4` through the shared Crazy controllers with BirdBlade type `2`, the exact 17-raster profile, distinct objective selectors, `bird_crazy_best_1..3`, and the float32 `0.8` reward path.
- Running Combo Bird as an independent mode `5` owner with BirdBlade type `3`, exact type-3 and instruction/TimeManager resources, a `90`-second timer, three ordinary-only toss controllers, objectives, pause, result ranking/reward, and transactional Replay/Retry/Main Menu ownership.
- Running GN Style as independent mode `2` with the standard BasicBlade, exact `150`-second ordinary-fruit graph and intro, dedicated music, 439-particle choreography, late-cut Time Up, `gnstyle_best_1..3`, float32 `0.6` reward, and transactional Replay/Retry/Quit/Menu ownership.
- The Objectives/progression checkpoint is complete, including transactional screen ownership,
  fatal recovery, route-wide notification wiring, and process-independent popup lifetime.
- The Objectives checkpoint is `196/196` focused Main Menu + Objectives + shell tests,
  `1444/1444` full vertical-slice tests, `43/43` resource/build/catalog tests, Creator 3.8.8
  bundled strict TypeScript zero diagnostics, and clean `git diff --check` hygiene.
- The standard-blade checkpoint is `1285/1285` full vertical-slice tests, `43/43` resource/build/catalog tests, the unchanged `14/14` inventory/evidence workflow in `217s`, reconstruction policy positive plus `4/4` negative fixtures, native static analysis `7/7`, strict Creator TypeScript, and clean diff hygiene.
- Fresh Creator Preview reaches Main Menu → Mode Select → GN Style → exact intro → live cuts,
  score, music, and particles → Pause/Resume/Replay → Pause Quit → Main Menu → repeated entry →
  natural Time Up → Result Retry → Result Menu. Options additionally passes Main Menu entry,
  selection, Buy/purchase, rollback, and Back in compact `360x800` and high `720x1280`
  profiles; the final Cocos Editor console is empty. Leaderboard additionally passes physical
  cut entry, aligned labels/scores, drag/flick board selection, and Back in the internal compact
  `480x800` branch and high `720x1280` profile. Objectives additionally passes real pointer-cut
  entry, Skip, list drag, and Back in both profiles after refreshing the stale Preview bundle,
  with zero game/Cocos browser errors.

## Checkpoint Evidence

- [Cosmetic economy native contract](../plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-cosmetic-economy-native-contract.md)
- [GN Style native contract](../plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-gn-style-native-contract.md)
- [GN Style resource map](../plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-gn-style-resource-map.md)
- [GN Style production checkpoint](../plans/260721-2253-pencil-blade-restoration/reports/implementer-2026-07-24-gn-style-runtime.md)
- [GN Style final verification](../plans/260721-2253-pencil-blade-restoration/reports/tester-2026-07-24-gn-style-final-checkpoint.md)
- [GN Style runtime review](../plans/260721-2253-pencil-blade-restoration/reports/reviewer-2026-07-24-gn-style-gameplay-shell.md)
- [Options native contract](../plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-options-native-contract.md)
- [Options integration map](../plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-options-integration-map.md)
- [Options resource audit](../plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-options-resource-audit.md)
- [Options production checkpoint](../plans/260721-2253-pencil-blade-restoration/reports/implementer-2026-07-24-options-runtime.md)
- [Options final verification](../plans/260721-2253-pencil-blade-restoration/reports/tester-2026-07-24-options-final-checkpoint.md)
- [Options runtime review](../plans/260721-2253-pencil-blade-restoration/reports/reviewer-2026-07-24-options-runtime.md)
- [Leaderboard native contract](../plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-leaderboard-native-contract.md)
- [Leaderboard architecture map](../plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-leaderboard-architecture-map.md)
- [Leaderboard runtime checkpoint](../plans/260721-2253-pencil-blade-restoration/reports/implementer-2026-07-24-leaderboard-runtime.md)
- [Leaderboard final verification](../plans/260721-2253-pencil-blade-restoration/reports/tester-2026-07-24-leaderboard-final-checkpoint.md)

## Current Open Gates

- Scene, prefab, and serialized component map completion beyond the first Canvas bridge.
- Creator Physics2D runtime-equivalence validation and electric-field compatibility.
- Full Settings coverage beyond the implemented subset and separate mode-unlock keys, including the first-launch `flag` bootstrap.
- Blade IDs `1`-`17` gameplay presentation/particles and remaining cosmetic resource consumers.
- Full progression state and the rest of the presentation/audio/effect consumers.
- Technical fidelity is separate from release rights; rights review can still block release even when the technical coverage target is met.
- Rights review for original assets and product identity.
- Android build validation and real APK/AAB post-build audit.
