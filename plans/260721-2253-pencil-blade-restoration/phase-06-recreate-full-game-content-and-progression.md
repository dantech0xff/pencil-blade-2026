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

Classic, Crazy, and Classic Bird now have production Creator routes. Classic Bird adds the
shared BaseBird/BirdBlade substrate and the mode-3 checkpoint on top of the recovered
Classic lifecycle. Crazy includes its recovered timed controller graph, standard and electric
bombs, specials, magnet, Dragon, objectives, pause, result, audio, and transactional
Replay/Quit/Time-Up/Retry lifecycle. The next slice is Crazy Bird mode `4`, then Combo Bird
mode `5`, and GN Style mode `2`.

## Context Links

- [Cocos Creator vertical slice](./phase-05-build-cocos-creator-architecture-and-vertical-slice.md)
- [Gameplay contracts](./phase-04-reverse-engineer-native-gameplay-contracts.md)
- [Crazy production checkpoint](./reports/implementer-2026-07-23-crazy-mode-runtime.md)
- [Classic Bird production checkpoint](./reports/implementer-2026-07-23-classic-bird-runtime.md)
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
- **Next:** Crazy Bird mode `4`, then Combo Bird mode `5`, then GN Style mode `2`.
- Classic Bird is the recovered bird substrate checkpoint. Crazy Bird will compose Bird with
  the verified Crazy graph. Combo Bird follows after the shared bird/timed-result seams and
  must preserve the resolution-specific `text-juscombo.png` / `text-justcombo.png` mismatch
  explicitly. GN Style remains last because its recovered `150`-second shell,
  `GangnamStyle.mp3`, and direct 439-call particle choreography must be materialized from
  evidence instead of approximated.
- Three of six production routes are complete; modes `2`, `4`, and `5` remain fail closed.

Current certification checkpoint:

- Full deterministic vertical slice: `876/876` final clean checkpoint
- Static inventory/source/staging/archive workflow: `14/14`
- Reconstruction policy: positive checkpoint and `4/4` negative fixtures
- Cocos Creator 3.8.8 strict TypeScript: observed
- Fresh Creator-served Browser Preview reaches Classic Bird and Replay/Quit with zero errors
- Result-entry rollback reacquisition P1 resolved before final certification

## Todo List

- [x] Shared Classic/Crazy systems required by the first two production modes
- [x] Shared BaseBird/BirdBlade systems
- [ ] Six modes (`3/6` production routes complete)
- [ ] Full content/cosmetics
- [ ] Progression and saves
- [ ] Menus/settings/results/objectives
- [ ] Offline behavior for retired services

## Success Criteria

- [ ] Every statically identified state is implemented, explicitly excluded, or recorded unknown
- [ ] Recovered and inferred coverage are reported separately; inferences never raise recovered coverage
- [ ] All mode contracts and progression fixtures pass
- [ ] Asset/audio usage reconciles with catalog
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

Implement Crazy Bird mode `4`, then Combo Bird mode `5`, then GN Style mode `2`. Freeze
content and enter Phase 7 only when all identified states/contracts are reconciled and
remaining unknowns are disclosed with impact.
