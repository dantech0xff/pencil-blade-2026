---
role: implementer
date: 2026-07-23
scope: mode-select-creator-runtime
status: complete
---

# Mode Select Creator Runtime

## Summary

Implemented the detached Mode Select foreground, exact 42-raster/font loader, six actual physics RopeButtons, reversible cut halves, blade/raycast integration, rail and shell actions, unlock effects, and typed lifecycle navigation ports.

## Findings

- Public host API: `ModeSelectPresenter.create(input)`, `root`, `presentation`, `state`, `activate()`, `update(dt)`, `suspendForTransition()`, `rearmNavigationAfterFailure()`, and `dispose()`.
- Shared BladeInput uses an explicit lease. Suspend releases it; rearm reacquires it; suspended disposal cannot deactivate a newer owner.
- Failed or rejected routes restore every card cut by the triggering ray/timer batch and permit the same card to be cut again.
- RopeButtons use one static anchor, seven dynamic links, eight hinge joints, and one fixture-backed FruitButton. Cut halves use actual dynamic bodies and deferred physics-safe cleanup.
- Activation, cut preparation, navigation, unlock, and disposal have explicit rollback/commit boundaries. Unlock persistence is irreversible: pre-persist failures restore coins; post-persist failures converge model and UI to unlocked.
- Particle construction follows recovered command order; RNG starts at 0.05 seconds and consumes exactly 225 draws for 45 particles.
- Unsupported destinations remain typed lifecycle callbacks. No placeholder gameplay scene or total-coins label was added.

## Verification

- Focused Mode Select cluster: `54/54` passed.
- Creator 3.8.8 bundled TypeScript strict `tsc --noEmit`: passed.
- Direct runtime tests cover actual body/joint topology, cut-preparation and impulse rollback, multi-card route recovery, input lease ownership, unlock transaction boundaries, oversized frame rejection, deferred cleanup, and exact resource loading.
- Controller independent full vertical-slice run: `410/410` passed.
- Static clean-room validation only; APK/native library not executed.

## Docs Impact

None beyond this phase report; runtime behavior implements already documented Phase 5 contracts.

## Unresolved Questions

None.
