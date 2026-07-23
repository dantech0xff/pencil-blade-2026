---
role: implementer
date: 2026-07-24
scope: crazy-bird-runtime
status: complete
---

# Crazy Bird Runtime

## Summary

Crazy Bird is now implemented as the mode-4 production route in the static-only Cocos Creator
3.8.8 TypeScript project. The checkpoint is clean: `952/952` vertical-slice tests passed,
`38/38` `tests/*.mjs` checks passed, inventory/evidence stayed `14/14` in `217s`, reconstruction
policy held at `4/4`, native static analysis held at `7/7`, strict Creator TypeScript reported
zero diagnostics, `git diff --check` stayed clean, and the independent runtime review was
approved with no P0/P1/P2 findings.

No original APK runtime was executed.

## Production Architecture

- Static-only reconstruction remains the rule: the production code path is Creator TypeScript,
  not native APK execution.
- Crazy Bird composes the recovered 60-second Crazy graph with BirdBlade type `2` and the exact
  17-raster Bird profile.
- `CrazySceneController` and `CrazyGameplayController` own the route's shared-screen, input,
  and Physics2D leases while the Bird-specific presenters/resources are composed into mode 4.
- The active runtime presents as `CrazyBirdModeRoot` in Creator Preview.
- Mode-4 runtime ownership includes distinct objective events/selectors,
  `bird_crazy_best_1..3`, the float32 `0.8` reward, fresh mode-4 retry, and
  Result/Pause Replay/Quit/Main Menu routing.
- The route is transactional and fail closed: it reuses the shared shell instead of inventing a
  separate ownership model.
- The exact native `ActionGoCallback` operand/order remains a static inference gap. The route is
  recorded from static evidence plus Creator Preview only.

## Exact Gates

| Gate | Result |
|---|---|
| Full deterministic vertical slice | `952/952` pass |
| `tests/*.mjs` | `38/38` pass |
| Inventory/evidence workflow | `14/14` pass in `217s` |
| Reconstruction policy | positive pass, `4/4` negative pass |
| Native static analysis | `7/7` pass |
| Creator TypeScript | strict `tsc` pass, 0 diagnostics |
| Diff hygiene | `git diff --check` clean |
| Independent runtime review | approved; no P0/P1/P2 findings |

## Preview Outcome

Fresh Creator Preview reached the live route without console errors:

1. Main Menu
2. Mode Select
3. unlock Crazy Bird for `2500`
4. live mode-4 red Bird / type-2 trail / particles / fruit / score / `60s` timer
5. Pause / Resume / Replay
6. Pause Quit
7. Main Menu

The verified valid-save case displayed `1,000,013` runtime coins and reduced the displayed
runtime balance to `997,513` after the unlock; the bulk save checkpoint was intentionally not
claimed from this run. Browser extension and autoplay startup noise appeared only during browser
launch; the game console stayed empty and post-gesture DevTools inspection showed `0` messages.

## Persistence Notes

- Missing, corrupt, or unreadable save falls back to `999999` coins while a valid persisted
  balance wins.
- Normal unlock deductions and rewards remain real.
- `bird_crazy_best_1..3` are the mode-4 leaderboard keys.

## Remaining Gaps And Order

1. Add Combo Bird mode `5`.
2. Add GN Style mode `2`.
3. Keep the exact native `ActionGoCallback` operand/order labeled as a static inference gap
   until native evidence closes it.

## Status / Summary / Concerns

Status: DONE
Summary: Crazy Bird runtime checkpoint documented with the verified mode-4 Preview path, final
gates, storage behavior, and remaining route order.
Concerns: The exact native `ActionGoCallback` operand/order is still inferred rather than runtime
executed.
