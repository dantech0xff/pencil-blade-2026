---
type: code-reviewer
date: 2026-07-24
status: done
---

# Code Review: Standard Blade Runtime Follow-up

## Code Review Summary

### Scope

- Core production: 4 requested files, 1,620 LOC:
  `classic-blade-presenter.ts`, `standard-blade-particle-presenter.ts`,
  `standard-blade-resource-loader.ts`, and `standard-blade-particle-plan.ts`.
- Integration boundary: standard facade/advanced presenter, BladeInput/BladeTracks, and all
  five current standard-blade owners: Classic, Crazy, GN Style, Main Menu, and Mode Select.
- Focused regression tests: 7 files, 6,332 LOC, plus the facade, state, resource-contract,
  gameplay-controller, scene-integration, and shell suites.
- Review target: verify the prior 2 P1 and 3 P2 findings, then scout lifecycle reachability and
  integration failure paths.
- Original APK/native runtime was not executed.

### Overall Assessment

All five prior findings are resolved. Follow-up scouting exposed two integration failures—the
advanced presenter rejected an intentionally inactive detached screen, and menu transition
rollback retained claimed blade slots after BladeInput reset. Both were fixed and regression
tested before this review closed.

No P0, P1, or P2 issue remains in the reviewed scope.

### Critical Issues

None.

### High Priority

None.

### Medium Priority

None.

Pre-Landing Review: No issues found.

## Prior Finding Resolution

| Prior finding | Result | Production evidence | Regression evidence |
|---|---|---|---|
| P1: ID 10/12 zero-vector rotation throws | Resolved | `standard-blade-particle-plan.ts:485-499` preserves the seven-draw stream and maps only the exact zero vector to finite rotation `0` | `standard-blade-particle-plan.test.ts:590-643` |
| P1: sparse 50-slot resource batch passes construction | Resolved | `standard-blade-resource-loader.ts:69-97` uses an indexed loop, rejects missing entries, and verifies final cardinality | `standard-blade-resource-loader.test.ts:160-177` |
| P2: Fire smoke draw/attachment order is batched | Resolved | `standard-blade-particle-plan.ts:338-362` emits each completed smoke before drawing the next; `standard-blade-particle-presenter.ts:100-127` presents through the sink and rolls back the segment on failure | `standard-blade-particle-presenter.test.ts:696-723` proves a second allocation failure stops at eight integer draws and consumes no third-smoke RNG |
| P2: Classic/particle construction can orphan engine objects | Resolved | `classic-blade-presenter.ts:73-109,205-343` transactionally tracks root, material, partial owners, meshes, and nodes; `standard-blade-particle-presenter.ts:196-250` immediately parents/tracks the sprite child and destroys the complete partial tree | `classic-blade-presenter.test.ts:656-701`; `standard-blade-particle-presenter.test.ts:725-755` |
| P2: catalog identity changes after validation | Resolved | `standard-blade-resource-loader.ts:86-99` stores frozen wrapper/dimension snapshots instead of caller-owned metadata | `standard-blade-resource-loader.test.ts:214-237` mutates path, dimensions, and wrapper SpriteFrame after construction without changing catalog output |

The zero-vector angle is an explicit **[INFERRED]** Creator safety policy. Static evidence still
shows the native helper has no guard and reaches IEEE `NaN`; exact downstream native engine
behavior remains **[UNKNOWN]**. The fix does not relabel the fallback as recovered parity.

## Follow-up Integration Findings Closed During Review

### Inactive detached parent

Main Menu and Mode Select construct their blade under an inactive detached root before the host
commits activation. The advanced presenter formerly rejected that valid assembly state.
`standard-advanced-blade-presenter.ts:127-151` now requires a valid parent without requiring it
to be active. `standard-advanced-blade-presenter.test.ts:648-664` executes attach, input, later
ancestor activation, and continued movement.

### Claimed slot retained across failed navigation

Scouting found a reachable failure sequence:

1. A blade move cuts a menu target while slot `0` is claimed.
2. The screen suspends and BladeInput resets its `BladeTracks`.
3. Destination activation fails and the source screen rearms.
4. The next touch reuses slot `0`; an unconditional `begin(0)` would throw `already claimed`.

Main Menu and Mode Select now end every claimed facade slot before resetting shared input:

- `main-menu-presenter.ts:535-560,753-759`
- `mode-select-presenter.ts:553-578,700-706`

Their blade stubs now enforce real claim semantics, so duplicate claims no longer pass as logging
no-ops. The executable regressions are
`main-menu-presenter.test.ts:332-360` and
`mode-select-presenter.test.ts:458-500`.

## Native Blocked-State Reachability

Native advanced state `1` and its no-op Push behavior are **[RECOVERED]** in
`explorer-2026-07-24-advanced-blade-static-contract.md:180-194`, but state `1` is
**[VERIFIED UNREACHABLE]** at the current Creator boundary:

- `standard-blade-presenter.ts:47-59` exposes attach, begin, move, end, ownership inspection,
  update, moved-segment presentation, and dispose. It exposes no Block/state-1 transition.
- `standard-advanced-blade-presenter.ts:153-181` forwards only those reachable lifecycle calls.
- Classic, Crazy, and GN Style reconcile ownership before every move:
  `classic-gameplay-controller.ts:762-775`,
  `crazy-gameplay-controller.ts:2134-2144`, and
  `gn-style-gameplay-controller.ts:1287-1300`.
- The sole production event producer claims a `BladeTracks` slot before emitting began and emits
  moved only for an owned touch:
  `blade-input-controller.ts:95-129` and `blade-tracks.ts:49-84`.
- Main Menu and Mode Select register that producer before activation. Their transition boundary
  now releases all facade claims before the producer's tracks are reset.

Adding state `1` would therefore be speculative and would not have fixed the transition bug.
Any future alternate event producer must preserve the same began/moved/ended ownership contract
or add explicit reconciliation at its consumer boundary.

## Edge Cases Found by Scout

- Exact zero movement with valid ID 10/12 sign/magnitude draws.
- Sparse arrays whose `length` is correct but whose slots are absent.
- Caller mutation after catalog validation.
- Fire smoke allocation failure between smoke 1 and smoke 2.
- Material reset, partial mesh creation, and particle-component construction failure.
- Advanced attachment under an inactive detached screen.
- Suspend/rearm while a touch is still claimed.
- Movement after asynchronous presenter attachment.
- Direct/manual moved events without a preceding began remain outside the current sole-producer
  contract; Mode Select additionally rejects unclaimed moved payloads at
  `mode-select-presenter.ts:718-726`.

## Evidence Fidelity

- **[RECOVERED, matched]** Fire smoke draw/attach ordering, exact resource closure/order,
  non-degenerate vector-angle arithmetic, standard ID/family mapping, and advanced
  state `0`/`2`/`4` lifecycle behavior.
- **[INFERRED, reviewed]** finite zero-vector rotation, Creator allocation rollback, inactive
  detached-root assembly, and releasing presenter claims before resetting shared input.
- **[UNKNOWN]** native zero-vector downstream engine handling, native RNG seed, and exact
  update/draw scheduling at disposal. These do not create an unhandled Creator path now.

## Production Checklist

- Concurrency/ordering: no shared asynchronous mutation race found. Smoke RNG/presentation is
  interleaved, and menu transition ownership is reconciled before input reset.
- Error boundaries: planner/spawn failures propagate after rollback; Classic material/mesh/node
  construction failures release tracked objects.
- API contracts/backwards compatibility: the facade adds the shared four-slot constant without
  removing an existing interface; IDs `0` through `17` retain exhaustive dispatch.
- Input validation: valid zero vectors no longer throw; sparse/mismatched batches fail at load
  construction; catalog metadata cannot be changed by later wrapper mutation.
- Auth/authz, database/N+1, PII/secrets: not applicable to this local rendering scope; no
  exposure path found.
- Scope drift: menu/controller inspection was limited to standard-blade construction, event
  ordering, transition ownership, and update/dispose call sites.

## Verification

- Final focused fix/lifecycle run: `78/78` passed, `0` failed, `0` skipped.
- Broader standard-blade and controller integration run: `223/223` passed, `0` failed,
  `0` skipped.
- Independent full vertical-slice gate: `1285/1285` passed.
- Resource/build/catalog gate: `43/43` passed.
- Strict Cocos Creator TypeScript: clean after clearing and regenerating the Creator code cache.
- Creator Preview passed in `720x1280` and compact OPPO `360x800` (internal `480x800`
  branch): selected Dragon ID `13` loaded on Main Menu, drag rendered, Main Menu -> Mode
  Select -> Back worked, and Options showed Dragon before returning to Main Menu.
- Preview console: no project runtime errors; one known unrelated Chrome-extension
  `share-modal.js` error remained outside the game.
- `git diff --check`: clean.
- Node emitted only the existing module-type/experimental TypeScript warnings.

## Metrics

- Type coverage: not instrumented.
- Test coverage: not instrumented; `1285/1285` full vertical-slice and `43/43`
  resource/build/catalog tests passed.
- Linting issues: lint not separately configured/measured; diff-check issues: `0`.
- Pre-landing result: `0` issues (`0` critical, `0` informational).

## Plan Follow-up

The reviewed implementation satisfies the Phase 6 standard blade IDs `1`-`17`
rendering/particle slice and its current Main Menu, Mode Select, Classic, Crazy, and GN Style
ownership boundaries. The repository-wide and Preview gates are green, so a project manager
may mark that bounded slice complete. Phase 6 still contains unrelated menu/progression and
global resource/build work. This review did not mutate plan state.

## Recommended Actions

1. Land the five remediations and the two integration regressions together.
2. Preserve the sole-producer lifecycle invariant if another blade event source is introduced.
3. Keep the zero-vector policy labeled **[INFERRED]** until runtime-native evidence exists.

## Unresolved Questions

- What visual behavior did the original native renderer produce after receiving the zero-vector
  `NaN` angle? The Creator fallback is safe and tested, but parity remains unobservable.

Status: DONE
Summary: Both prior P1 and all three prior P2 findings are resolved; two follow-up integration failures were found, fixed, and regression tested; no P0/P1/P2 remains.
Concerns/Blockers: None in the reviewed scope. Native zero-vector visual parity remains explicitly unknown and uses a reviewed inferred fallback.
