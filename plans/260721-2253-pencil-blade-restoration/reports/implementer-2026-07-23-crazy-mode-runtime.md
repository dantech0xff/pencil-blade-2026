---
role: implementer
date: 2026-07-23
scope: crazy-mode-runtime
status: complete
---

# Crazy Mode Runtime

## Summary

Crazy runtime is now implemented as a static-only Cocos Creator 3.8.8 TypeScript
architecture with a Physics2D-backed production layer and an `@cocos/box2d` `1.0.2`
dependency. The checkpoint stayed reproducible: 202/202 focused Crazy+TimeManager tests passed,
719/719 full vertical-slice tests passed, the recovered inventory stayed 14/14, the policy set
held at 4/4 negative with positive coverage preserved, Creator 3.8.8 strict `tsc` passed,
`git diff --check` was clean, and an independent review found no P0/P1 issues.

No original APK runtime was executed.

## Production Architecture

- Static-only reconstruction remains the rule: the production code path is Creator TypeScript,
  not native APK execution.
- Crazy lives on the shared gameplay/controller surface and reuses the restored `TimeManager`
  contract rather than inventing a parallel timer model.
- `CrazySession` and `CrazyTossCoordinator` own the recovered 60-second domain/controller graph.
  `CrazySceneController` owns the session, blade, and physics lease.
  `CrazyGameplayController` owns resources, presenters, registry, pause, objectives, and Result.
- Production entity ownership includes normal/double/bonus tosses, standard-bomb fuse/explosion,
  electric contacts, magnet, special fruit, Dragon and its auxiliary presentation nodes.
- The runtime target is Cocos Creator 3.8.8 with Physics2D and the pinned Box2D package
  `@cocos/box2d@1.0.2`.
- The app-shell transaction remains explicit: Mode Select routes into Crazy only through the
  recovered gameplay boundary, and the route is verified by Preview rather than by original
  device execution.

## Exact Gates

| Gate | Result |
|---|---|
| Focused Crazy + TimeManager | `202/202` pass |
| Full vertical slice | `719/719` pass |
| Inventory coverage | `14/14` pass |
| Policy coverage | positive preserved, `4/4` negative pass |
| Creator TypeScript | strict `tsc` pass |
| Dependency pin | `@cocos/box2d` `1.0.2` |
| Diff hygiene | `git diff --check` clean |
| Independent review | no P0/P1 findings |

## Preview Outcome

Fresh Creator Preview passed the locked-card flow with the Crazy card at `2130` coins. The
reversible fixture used `5000+mode_unlock_1` to exercise the route, then restored the exact
starting state.

Observed Preview path:

1. `ModeSelect -> Crazy`
2. `60/GO`
3. spawning
4. `Pause Replay`
5. `Pause Quit -> Main`
6. re-entry
7. natural `0:00` Time-Up -> Result
8. Result Retry
9. exact restore to `2130` / locked

That outcome is the current production proof for the runtime transaction semantics, not an
original-runtime identity claim.

## Transaction Semantics

- App-shell entry, Pause Replay, Pause Quit, Result Retry, and Result Menu keep reversible work
  separate from committed cleanup. Failed cleanup never tears down a replacement run.
- Time-Up drains the recovered ordered command suffix once even when one or more listeners
  throw. Original error objects remain available to diagnostics and no already-issued command
  is replayed.
- Time-Up Finish uses a two-phase Result participant. Result is provisionally attached while
  the exact Crazy root, scene, Physics2D/input leases, and TimeManager are retained. A
  pre-commit failure removes and disposes provisional Result, restores that same owner, rolls
  the session back to `time-up`, and permits a later successful finish.
- After the session commits `result-removed`, the leaderboard records once and old-run cleanup
  becomes post-commit work. A failed disposal moves to explicit retired ownership, which Result
  Retry drains before constructing a new run. A post-commit snapshot observer failure is
  reported without rollback or rearming the disposed TimeManager.
- The unlocked fixture was temporary. Storage restoration was exact: `2130` coins and the
  locked Crazy card state returned after Preview.

## Storage Fixture And Restore

The reversible `5000+mode_unlock_1` fixture was used to open the Crazy route for Preview. After
the route exercise, storage restored exactly to the original `2130` coins and locked card state.
That confirms the fixture is test-only and does not leak into the persisted baseline.

## Remaining Gaps And Order

1. Implement shared BaseBird/BirdBlade and Classic Bird mode `3`.
2. Compose the verified Bird and Crazy foundations for Crazy Bird mode `4`.
3. Add Combo Bird mode `5`, preserving the explicit low-resolution
   `text-juscombo.png` / high-resolution `text-justcombo.png` resource mismatch.
4. Restore GN Style mode `2` last from its exact 150-second/music contract and direct
   439-call particle choreography.
5. Final `99%` fidelity denominator and consumer coverage stay open. The recovered APK corpus
   is staged, but canonical sample-project completeness and release rights are not closed.

## Recommendation

Keep the Crazy runtime on the current static-only Creator path, and treat the Preview result as
the current production checkpoint while the final `99%` fidelity closure remains open.

## Status / Summary / Concerns

Status: DONE
Summary: Crazy runtime checkpoint report created with the requested facts, Preview outcome, storage restore, and remaining-gaps ordering.
Concerns: None beyond the explicitly open `99%` fidelity / consumer-coverage closure.
