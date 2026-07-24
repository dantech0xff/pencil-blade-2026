---
phase: 6
title: "Recreate Full Game Content and Progression"
status: in-progress
priority: P2
dependencies: [4, 5]
effort: "2-4 months"
---

# Phase 6: Recreate Full Game Content and Progression

## Overview

Expand the proven slice to all statically identified modes, cosmetics, objectives,
progression, settings, audio, and lifecycle behavior without weakening contract tests.

Classic, Crazy, GN Style, Classic Bird, Crazy Bird, and Combo Bird now have production Creator routes.
Classic Bird adds the shared BaseBird/BirdBlade substrate and the mode-3 checkpoint on top of
the recovered Classic lifecycle. Crazy includes its recovered timed controller graph, standard
and electric bombs, specials, magnet, Dragon, objectives, pause, result, audio, and
transactional Replay/Quit/Time-Up/Retry lifecycle. Crazy Bird mode `4` profiles that shared
graph with BirdBlade type `2`. Combo Bird mode `5` remains independent from Crazy and composes
BirdBlade type `3`, exact type-3 resources, a recovered `90`-second timer, an ordinary-only toss
graph, objectives, pause, result ranking/reward, and transactional replay/retry/menu ownership.
Its keys are `bird_combo_best_1..3` and its reward factor is float32 `0.8`. GN Style mode `2`
owns the standard BasicBlade, `150`-second Free/Wave/Concurrent ordinary-fruit graph, exact
`2.60`-second intro, dedicated non-looping music, 439-parent particle choreography, three-second
late-cut tail, `gnstyle_best_1..3`, float32 `0.6` reward, and transactional navigation. The
standard-blade runtime checkpoint is also complete: IDs `0`-`17` now route transactionally
through Main Menu, Mode Select, Classic, the Crazy standard branch, and GN Style with exact
Basic textures, particle plans, Dragon multipart behavior, and Centipede multipart behavior.
The implemented Settings slice is now exact: 50 integers, 4 booleans, 18 blade prices, 8 background
prices, price `0` ownership persistence, field-isolated totalCoins recovery, and write-disable
on any load recovery. The recovered Options screen now provides eight backgrounds, eighteen
blades, ten themes, exact resources/audio/timing, affordability and debit, purchase particles,
transactional Main Menu navigation, and unpaid-selection reconciliation before Back or app-hide
save. The recovered Objectives surface now owns all 52 ordered definitions, exact dual-profile
resources, current/next presentation, Skip, progression popups, global and per-type fruit
notifications across every production route, and transactional Main Menu ownership. First-launch
storage is now reconciled: the recovered persisted sentinel is `network_available`, while the
app-shell first activation gate is in memory, so no new save field or migration is justified.
The global resource ledger now classifies all 862 recovered assets without treating unknown
files as live consumers. The recovered Loading surface now owns its exact four selected-profile
rasters, 62-step audio preload sequence, `/61` clamped progress, and half-second handoff to
Main Menu. Static reachability review closes the final 90 asset dispositions without inventing
consumers; only scene/prefab/composition reconciliation and final Phase 6 verification stay open.

## Context Links

- [Cocos Creator vertical slice](./phase-05-build-cocos-creator-architecture-and-vertical-slice.md)
- [Gameplay contracts](./phase-04-reverse-engineer-native-gameplay-contracts.md)
- [Crazy production checkpoint](./reports/implementer-2026-07-23-crazy-mode-runtime.md)
- [Classic Bird production checkpoint](./reports/implementer-2026-07-23-classic-bird-runtime.md)
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
- [About native contract](./reports/researcher-2026-07-24-about-offline-native-contract.md)
- [About resource map](./reports/researcher-2026-07-24-about-offline-resource-map.md)
- [About architecture map](./reports/explorer-2026-07-24-about-offline-architecture-map.md)
- [About presenter checkpoint](./reports/implementer-2026-07-24-about-presenter.md)
- [About shell checkpoint](./reports/implementer-2026-07-24-about-shell-host.md)
- [About integration review](./reports/reviewer-2026-07-24-about-offline-integration.md)
- [About final verification](./reports/tester-2026-07-24-about-offline-final-checkpoint.md)
- [First-launch flag contract](./reports/researcher-2026-07-24-first-launch-flag-contract.md)
- [Resource reconciliation gap map](./reports/explorer-2026-07-24-resource-reconciliation-gap-map.md)
- [Resource ledger implementation map](./reports/explorer-2026-07-24-resource-ledger-implementation-map.md)
- [Resource ledger integration review](./reports/reviewer-2026-07-24-resource-ledger-checkpoint.md)
- [Resource ledger final verification](./reports/tester-2026-07-24-resource-ledger-final-checkpoint.md)
- [Zero-unknown resource closure review](./reports/reviewer-2026-07-24-zero-unknown-resource-closure.md)
- [Loading static contract](./reports/researcher-2026-07-24-loading-static-contract.md)
- [Loading architecture map](./reports/explorer-2026-07-24-loading-architecture-map.md)
- [Loading checkpoint review](./reports/reviewer-2026-07-24-loading-checkpoint.md)
- [Loading final verification](./reports/tester-2026-07-24-loading-final-checkpoint.md)
- [Advanced blade native contract](./reports/researcher-2026-07-24-advanced-blade-native-contract.md)
- [Advanced blade architecture map](./reports/explorer-2026-07-24-advanced-blade-architecture-map.md)
- [Nonblade unused-resource contract](./reports/researcher-2026-07-24-nonblade-unused-resource-contract.md)
- [Zero-unknown resource verification](./reports/tester-2026-07-24-zero-unknown-resource-closure.md)
- [Remaining mode order](./reports/explorer-2026-07-23-remaining-mode-order.md)

## Requirements

- Recreate all six identified modes according to recovered contracts and reviewed inferences.
- Recreate fruits, bombs, bonuses, blades, trails, particles, backgrounds, themes, and UI.
- Recreate coins, purchases/unlocks, objectives, best scores, options, and save migration.
- Keep obsolete online features outside core gameplay and define intentional replacement behavior.
- Implement every recovered subsystem in Creator TypeScript/content; never fall back to
  original native code, a C++ port, compatibility bridge, or APK emulation.

## Architecture

Add content through data and contract-backed components, not copied mode implementations.
Share scoring/physics/input primitives; specialize only verified mode rules. Version the
save schema and include reproducible fixtures for progression states.

## Related Code Files

- Modify: ../../game/assets/scripts/
- Modify: ../../game/assets/scenes/
- Modify: ../../game/assets/prefabs/
- Create: ../../game/assets/game/data/
- Create: ../../tests/fixtures/progression/
- Create: ../../tests/contracts/
- Create: ../../tests/fixtures/reconstruction/
- Update: ../../docs/gameplay-contracts/

## Implementation Steps

1. Implement shared entity, blade, physics, toss, score, combo, time, and failure systems.
2. Add Classic, Crazy, Classic Bird, Crazy Bird, Combo Bird, and GN Style one at a time.
3. Add bonuses: freeze, magnet, score multipliers, special tosses, electric/bomb behavior.
4. Add menus, results, objectives, leaderboard replacement, options, themes, blades, and backgrounds.
5. Implement save defaults, upgrades, unlocks, objectives, coins, and best scores from fixtures.
6. Restore animation, particles, fonts, and audio only from the presentation catalog.
7. Run contract, traceability, repeatability, asset, and build-boundary gates after every mode and screen.

## Current Checkpoint

- **Complete:** production Classic route and bounded Classic loop.
- **Complete:** production Crazy route with `60 / GO!`, live spawning, pause/replay/quit,
  natural Time-Up -> Result, Result Retry, exact mode-1 leaderboard/reward mapping, and
  failure-safe ownership.
- **Complete:** shared BaseBird/BirdBlade substrate and Classic Bird mode `3`.
- **Complete:** Crazy Bird mode `4` through the shared Crazy graph, BirdBlade type `2`, exact
  type-2 resources, mode-4 objective/ranking/reward profiles, and transactional replay/result/menu.
- **Complete:** independent Combo Bird mode `5` with BirdBlade type `3`, the exact type-3 and
  instruction/TimeManager resources, a `90`-second timer, ordinary-only toss graph,
  objectives, pause, result/ranking/reward, `bird_combo_best_1..3`, float32 `0.8` reward,
  and transactional Replay/Retry/Main Menu ownership. Its resource contract preserves the
  resolution-specific `text-juscombo.png` / `text-justcombo.png` mismatch explicitly.
- **Complete:** GN Style mode `2` with the standard BasicBlade, exact `150`-second
  Free/Wave/Concurrent ordinary-fruit shell, `2.60`-second intro,
  `GangnamStyle.mp3`, direct 439-call particle choreography, Time Up late-cut tail,
  objectives `6`/`2`, `gnstyle_best_1..3`, float32 `0.6` reward, and transactional
  Replay/Retry/Quit/Menu ownership.
- **Complete:** recovered Options with eight backgrounds, eighteen blades, ten themes,
  exact per-tree 51-raster set plus font/audio, staged row entry, selectors, live preview,
  affordability, storage-first ownership plus one debit, Buy state, 45-particle purchase
  burst, Back rollback, and pre-save app-hide reconciliation.
- **Complete:** standard-blade runtime checkpoint for IDs `0`-`17` across Main Menu, Mode
  Select, Classic, the Crazy standard branch, and GN Style, including exact Basic textures,
  particle plans, Dragon multipart behavior, Centipede multipart behavior, and transactional
  ownership/rollback.
- **Complete:** Objectives and progression checkpoint with 52 ordered definitions, exact
  compact/high resources, current/next rows, Skip, shell-owned achievement popups, gameplay and
  menu fruit notifications, fatal ownership recovery, and transactional Main Menu routing.
- **Complete:** About/offline checkpoint with the exact ten-raster Android closure, direct
  Menu/Review/Email/Like controls, `MOBILE_BACK`, transactional Main Menu routing, and
  sanitized local-only retired-service events.
- **Complete:** first-launch storage/lifecycle reconciliation. `network_available` remains the
  recovered persisted launch sentinel and `initialClassicRuntimeActivated` remains an in-memory
  shell gate; current evidence does not justify a new persisted `flag`.
- **Complete:** recovered Loading surface with the exact selected-profile background/bar
  composition, 62 source-ordered audio preloads issued one per update, native `/61` clamped
  progress, `0.5`-second tail, and commit-before-retirement Main Menu handoff. Creator waits
  for real bundle readiness and intentionally does not reproduce the obsolete native cache purge.
- **Complete:** resource-ledger scaffold. Exact live contract roots account for `761/862`
  assets (`88.28%` runtime consumption); reviewed dispositions close classification to
  `862/862` with `0` unknown, `100` excluded, and `1` unsupported. All source bytes remain
  staged; classification does not promote statically unreachable files into runtime consumers.
- All six production gameplay routes, Leaderboard, Options, standard blades, save/economy,
  Objectives, About/offline, first-launch behavior, and global resource classification are
  complete. Phase 6 remains in progress only for the scene/prefab/composition map and final
  checkpoint verification.

Current certification checkpoint:

- Focused About/Main Menu/shell integration suite: `169/169`
- Full deterministic vertical slice: `1520/1520`
- Top-level resource/build/catalog/tooling tests: `61/61`
- Resource-ledger generator/registry focused tests: `18/18`
- Staging/metadata focused tests: `33/33`
- Static inventory/source/staging/archive workflow: `14/14` in `217s`
- Reconstruction policy: positive checkpoint and `4/4` negative fixtures
- Native static analysis: `7/7`
- Cocos Creator 3.8.8 bundled strict TypeScript: zero diagnostics
- Loading follow-up review: approved with no open P0-P2 finding after slow-foreground,
  partial-construction, same-Canvas, and retirement-failure regressions
- Creator metadata audit: zero structural errors and zero duplicate UUIDs; still
  `fidelity-blocked` only by the preserved unsupported `Fonts/CooperBlackStd.otf`
- Fresh Creator-served Browser Preview reaches Main Menu -> Mode Select -> GN Style -> exact
  intro -> live fruit cuts/score/particles -> Pause/Resume/Replay -> Pause Quit -> Main Menu ->
  repeated entry -> natural Time Up -> Result Retry -> Result Menu. DevTools records zero
  application/runtime errors; one unrelated Chrome extension error is outside the game.
- Creator Preview also reaches Main Menu -> Options -> selection/Buy/purchase/Back in compact
  `360x800` and high `720x1280` profiles with zero Cocos Editor console entries. Browser focus
  did not reliably emit Cocos app-hide, so that ordering is certified by executable tests and
  source review rather than claimed as direct Preview evidence.
- After refreshing the stale Creator Preview bundle, real pointer cuts reach Objectives in the
  internal compact `480x800` branch and high `720x1280` profile. Skip, list drag, and Back pass
  in both profiles with zero game/Cocos browser errors.
- The same two profiles pass Main Menu -> About -> Main Menu. Review, Email, and Social stay
  local/offline, preserve the `999999` balance, and emit zero Preview errors or warnings.
- The same profile pair renders recovered Loading and reaches a stable Main Menu. Compact
  physical `360x800` selects logical/resource tree `480x800`; high selects `720x1280`.
  Cocos Editor log, warning, and error counters remain zero.
- Missing or corrupt coin storage still falls back to `999999` coins; a valid persisted balance
  wins, including `0`

## Todo List

- [x] Shared Classic/Crazy systems required by the first two production modes
- [x] Shared BaseBird/BirdBlade systems
- [x] Six modes (`6/6` production routes complete)
- [x] Options selection, purchase economy, rollback, and exact screen resources
- [x] Leaderboards, objective progression, and save/economy
- [x] Full recovered-runtime content/cosmetics and exact source-resource retention
- [x] First-launch persisted-sentinel and in-memory activation-gate reconciliation
- [x] Global `862`-asset consumer/disposition ledger and schema-v2 staging manifest
- [ ] Scene/prefab/composition reconciliation and final Phase 6 verification
- [x] About screen fidelity and offline behavior for retired services

## Success Criteria

- [ ] Every statically identified state is implemented, explicitly excluded, or recorded unknown
- [ ] Recovered and inferred coverage are reported separately; inferences never raise recovered coverage
- [ ] All mode contracts and progression fixtures pass
- [x] Asset/audio usage reconciles with catalog as consumed, unknown, excluded, or unsupported
- [ ] Save reset, upgrade, and corruption behavior are defined and tested
- [ ] No copied unknown-rights content enters a public build without clearance
- [ ] Creator source/build audit proves that all application behavior is new TypeScript
      and content, with no original libgame.so/Cocos2d-x application runtime dependency

## Risk Assessment

- Shared abstractions can erase small mode differences: require per-mode reconstruction fixtures.
- Progression states are combinatorial: use curated fixtures and property tests.
- Third-party music/fonts may block release: support catalog-level replacements.
- Creator version drift may invalidate scenes/import metadata: remain on the Phase 5 pin.

## Security Considerations

Validate save data; do not restore obsolete analytics/ads SDKs. External links and
leaderboards, if retained, require new approved implementations.

## Next Steps

Build and verify the scene/prefab/composition map for the serialized Creator bridge and every
dynamically owned production surface. Then run the complete Phase 6 verification/review gate,
freeze content, and enter Phase 7 for Android build validation and release-rights clearance.
