---
type: tester
date: 2026-07-23
status: pass
scope: crazy-contract-direction-checkpoint
---

# Test Report: Crazy Contract Direction Checkpoint

## Summary

Checkpoint PASS. Focused Crazy/TimeManager tests, the complete deterministic vertical-slice
suite, Cocos Creator 3.8.8 bundled TypeScript check, and `git diff --check` all passed.
Source/test fingerprint stayed
`7052eae372d8c0110d1279965aa9d5cdf84a465fcd2a048fd80f7aad004a4b62`
before and after every gate.

Contract direction remains **PASS**, resource checkpoint remains **AMBER**, and the Mode Select
Crazy route remains fail-closed at the app shell.

## Snapshot Stability

- Monitored trees: `game/assets/scripts/`, `tests/reconstruction/vertical-slice/`.
- Latest observed pre-run mtime:
  `2026-07-23T13:13:56+0800 tests/reconstruction/vertical-slice/mode-select-presenter.test.ts`.
- First accepted gate start: `2026-07-23T13:15:33+0800`
  (`2026-07-23T05:15:33Z`), 97 seconds after that mtime.
- Fingerprint before and after each gate: unchanged.
- Files changed during accepted certification: none.
- Earlier in-flight results were excluded; no count below was reused from a moving snapshot.

## Test Results

| Gate | UTC interval | Passed | Failed | Skipped | Duration | Status |
|---|---|---:|---:|---:|---:|---|
| Focused Crazy + TimeManager | `05:15:33Z` - `05:15:34Z` | 159 | 0 | 0 | 611.054125 ms | PASS |
| Full vertical slice | `05:15:45Z` - `05:15:47Z` | 580 | 0 | 0 | 2110.238958 ms | PASS |
| Creator 3.8.8 bundled `tsc` | `05:15:58Z` - `05:16:00Z` | n/a | 0 diagnostics | n/a | n/a | PASS |
| `git diff --check` | `05:16:08Z` | n/a | 0 findings | n/a | n/a | PASS |

Focused command:

```sh
node --test tests/reconstruction/vertical-slice/crazy-*.test.ts tests/reconstruction/vertical-slice/time-manager-*.test.ts
```

Focused totals: `159` tests, `159` passed, `0` failed, `0` cancelled, `0` skipped,
`0` todo.

Full command:

```sh
node --test tests/reconstruction/vertical-slice/*.test.ts
```

Full totals: `580` tests, `580` passed, `0` failed, `0` cancelled, `0` skipped,
`0` todo.

Typecheck command:

```sh
node /Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js -p game/tsconfig.json --pretty false --noEmit
```

Typecheck exit: `0`; no diagnostics.

Diff command:

```sh
git diff --check
```

Diff-check exit: `0`; no findings.

## Direction ABI Regression

Recovered contract rows bind the three special Free controllers to Down direction:

| Controller | Direction | Toss type | Runtime object |
|---|---:|---:|---|
| `af` | `1` (Down) | `3` | electric fruit ID `13` |
| `ae` | `1` (Down) | `4` | magnet fruit ID `14` |
| `ad` | `1` (Down) | `6` | DragonFruit |

Evidence:

- `forensics/contracts/crazy-mode-contract.md:113-115`
- `game/assets/scripts/domain/crazy-toss-config.ts:157-181`
- `tests/reconstruction/vertical-slice/crazy-toss-coordinator.test.ts:173-185`

The named regression `Electric, magnet, and Dragon schedulers preserve the recovered Down ABI`
passed. It asserts planner requests `(direction: 1, tossType: 3)`,
`(direction: 1, tossType: 4)`, and `(direction: 1, tossType: 6)` for `af`, `ae`, and `ad`.

## Contract And Resource Direction

- Latest independent contract rereview:
  `plans/260721-2253-pencil-blade-restoration/reports/reviewer-2026-07-23-crazy-contract-rereview.md`.
- Contract decision: **PASS**.
- Resource checkpoint: **AMBER**.
- Resource authority:
  `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-resource-map.md:203-211`.
- No GREEN resource, Phase 4 completion, Phase 6 authorization, or original-runtime identity
  claim is implied by these passing code gates.

## Fail-Closed Route

`ModeSelectPresenter` now dispatches `CrazyModeLayer` through the explicit
`onCrazyRequested` lifecycle port. The current app shell supplies
`onCrazyRequested: () => false` at
`game/assets/scripts/creator/recovered-app-shell-controller.ts:314-315`, so it rejects the
transaction until a prepared Crazy gameplay owner exists.

Regression coverage at
`tests/reconstruction/vertical-slice/mode-select-presenter.test.ts:359-397` proves a rejected
Crazy transaction restores all cut cards and permits a later recut. This test passed within
the full `580 / 580` run.

## Warnings

- Focused run: 22 `MODULE_TYPELESS_PACKAGE_JSON` warnings and one
  `stripTypeScriptTypes` experimental warning.
- Full run: 74 `MODULE_TYPELESS_PACKAGE_JSON` warnings and two
  `stripTypeScriptTypes` experimental warnings.
- Warnings are non-failing and do not change the checkpoint verdict.

## Recommendations

1. Keep the app-shell Crazy callback returning `false` until complete runtime preparation can
   commit transactionally.
2. Keep the resource checkpoint AMBER until the exact remaining canonical-path consumer map is
   complete.

## Unresolved Questions

- What is the exact per-path consumer map for the remaining shared Crazy result, presentation,
  and audio dependencies?
