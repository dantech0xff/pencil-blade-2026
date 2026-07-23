# Classic Bird Runtime

## Summary

Classic Bird is now implemented as the shared BaseBird/BirdBlade production route for mode `3`
in the static-only Cocos Creator 3.8.8 project. The checkpoint now closes with final validation
clean after the Result-entry rollback reacquisition P1 was resolved.

No original APK runtime was executed.

## Production Architecture

- Static-only reconstruction remains the rule: the production code path is Creator TypeScript,
  not native APK execution.
- Classic Bird uses the shared BaseBird/BirdBlade substrate, the bird-only resource loader,
  and the mode-3 session/result/retry chain.
- `ClassicBirdSceneController` owns the session, blade, and physics lease.
  `ClassicBirdGameplayController` owns resources, presenters, registry, pause, objectives, and
  Result.
- Production entity ownership includes the single Bird blade, cached ray path, always-running
  particle trail, result navigation, and bird-only resource loading.
- The app-shell transaction remains explicit: Mode Select routes into Classic Bird only through
  the recovered gameplay boundary, and the route is verified by Preview rather than by original
  device execution.

## Current Checkpoint

| Gate | Result |
|---|---|
| Full deterministic vertical slice | `876/876` final clean checkpoint |
| Inventory coverage | `14/14` checkpoint |
| Policy coverage | positive checkpoint, `4/4` negative hold |
| Creator TypeScript | strict `tsc` observed |
| Diff hygiene | `git diff --check` clean |
| Browser Preview | reaches Main Menu -> Mode Select -> Classic Bird -> live Bird presentation -> Game Over -> Result -> Retry/Pause Resume -> Replay/Quit with zero errors |

## Preview Outcome

A fresh Creator Preview reached the live Classic Bird route with zero page exceptions and zero
console errors through the full transaction:

1. Boot reached `MainMenuRoot`.
2. Main Menu committed to `ModeSelectRoot`.
3. Mode Select committed mode `3` to `ClassicBirdRoot`.
4. Classic Bird crossed from intro to live Bird presentation.
5. Game Over, Result, Retry, Pause/Resume, and Replay/Quit completed against the active Classic
   Bird owner.

The prior manual clean run also covered the natural Game Over -> Result -> Retry path.

## Persistence Notes

- Missing or corrupt save falls back to `999999` coins while a valid persisted balance wins.
- Normal `2500` unlock deductions and rewards remain real.
- The historical native `2014` default remains recorded in the research reports.

## Remaining Gates

- Replay/Quit path is clean.
- Result-entry rollback reacquisition P1 is resolved.
- Complete the remaining modes `2`, `4`, and `5`.
- Produce and audit a real Creator Android build artifact.
- Finish the remaining consumer map and release-rights review.

## Status / Summary / Concerns

Status: DONE
Summary: Classic Bird runtime checkpoint documented with the final 876-test clean run, bird-route preview path, and resolved validation gates.
Concerns: None.
