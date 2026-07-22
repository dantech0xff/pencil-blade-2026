---
phase: 6
title: "Recreate Full Game Content and Progression"
status: pending
priority: P2
dependencies: [4, 5]
effort: "2-4 months"
---

# Phase 6: Recreate Full Game Content and Progression

## Overview

Expand the proven slice to all statically identified modes, cosmetics, objectives,
progression, settings, audio, and lifecycle behavior without weakening contract tests.

## Context Links

- [Cocos Creator vertical slice](./phase-05-build-cocos-creator-architecture-and-vertical-slice.md)
- [Gameplay contracts](./phase-04-reverse-engineer-native-gameplay-contracts.md)

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

## Todo List

- [ ] Shared systems
- [ ] Six modes
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

Freeze content and enter Phase 7 when identified states/contracts are reconciled and all
remaining unknowns are disclosed with impact.
