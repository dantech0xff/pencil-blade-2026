# Crazy Domain Production-Readiness Re-review

## Code Review Summary

### Scope

- Verdict: **CHANGES_REQUIRED**
- Focus: Crazy domain implementation and corresponding Crazy/TimeManager tests, with
  scout-discovered Creator consumers checked where they determine whether domain commands can
  execute safely.
- Primary implementation reviewed:
  - `game/assets/scripts/domain/crazy-*.ts`
  - `game/assets/scripts/domain/time-manager-service.ts`
  - `game/assets/scripts/domain/double-toss-strategy.ts`
  - `game/assets/scripts/domain/bonus-toss-strategy.ts`
  - `game/assets/scripts/domain/recovered-result-ranking.ts`
- Contract/evidence reviewed:
  - `forensics/contracts/crazy-mode-contract.md`
  - `forensics/contracts/classic-time-state-contract.md`
  - `forensics/contracts/classic-toss-contract.md`
  - the three requested Crazy research/architecture reports
- Tests reviewed: Crazy domain, intro, toss, resource, result, ranking, and TimeManager vertical
  slice tests.
- Scout-discovered consumers checked:
  - `game/assets/scripts/creator/crazy-scene-controller.ts`
  - `game/assets/scripts/creator/crazy-intro-presenter.ts`
  - `game/assets/scripts/creator/crazy-resource-loader.ts`
  - `game/assets/scripts/creator/time-manager-presenter.ts`
- Scoped implementation/test size: 4,651 lines before the scout-discovered Creator consumers.

### Overall Assessment

The blocking score/order defects found during review were corrected and reverified: bomb score
mutation now precedes the double-score flush, Time Up sends the completed authoritative score, and
the Result command sequence captures Crazy's parent before construction/removal. The remaining
issues are lifecycle/error atomicity and a non-executable loader test. They are real production
readiness gaps, so this staged slice should not yet be marked Crazy-ready or used to open the route.

### Critical Issues

None.

### High Priority

None after review fixes.

### Medium Priority

#### Terminal and callback methods accept illegal or repeated transitions

The lifecycle has only `intro`, `running`, and `result-removed`
(`game/assets/scripts/domain/crazy-session.ts:28-36`). `timeUp()` and `timeUpFinish()` do not check
or advance through a Time Up phase (`game/assets/scripts/domain/crazy-session.ts:297-329`).
`timeUpFinish()` also marks the session removed before any external command succeeds. Early,
duplicate, or reentrant callbacks can therefore emit repeated cleanup/attachment batches or leave
the domain marked removed after a failed swap. A direct probe confirmed that calling
`timeUpFinish()` before `enterScene()` and calling it again both return the complete eight-command
Result replacement batch.

The associated architecture test plan requires one terminal gate and illegal-transition rejection
(`plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-23-crazy-architecture-map.md:382-388`),
but the session test covers only repeated entry/intro completion.

Recommended fix: represent Time Up presentation and Result replacement phases explicitly, consume
the finish transition once, and commit `result-removed` only after the adapter confirms attachment.
Test early, duplicate, and throwing completion callbacks.

#### Runtime validation can throw after partially corrupting strategy state

Injected ports are validated after mutation in several paths:

- `DoubleTossStrategy.start()` marks active and starts the base timer before validating
  `effectsEnabled()` (`game/assets/scripts/domain/double-toss-strategy.ts:260-273`);
- `DoubleTossStrategy.stop()` clears/stops state before the same port read
  (`game/assets/scripts/domain/double-toss-strategy.ts:348-356`);
- `TimeManagerService.freeze()` changes freeze state before its port read
  (`game/assets/scripts/domain/time-manager-service.ts:223-230`).

For example, the malformed-effects test at
`tests/reconstruction/vertical-slice/crazy-double-bonus-toss.test.ts:333-347` proves `start()`
throws but does not check that the strategy is now incorrectly active with no stop request; the
next `start()` becomes a no-op. A direct probe confirmed exactly that partial state: base timer
scheduled, both children unscheduled, `active=true`, no stop request, and a second `start()` returns
an empty batch. The equivalent TimeManager probe throws while leaving `frozen=true` even though no
freeze-start command was delivered.

Recommended fix: preserve the recovered port-call/RNG order but rollback state and timers when a
port throws or returns an invalid value. Add post-error invariant tests, not only `assert.throws`.

#### The resource-loader failure test is source-text matching, not an executable test

`tests/reconstruction/vertical-slice/crazy-resource-loader.test.ts:1-28` reads the loader as text
and checks for regex fragments. It never imports the loader or injects duplicate, partial, missing,
dimension-mismatched, invalid SpriteFrame, font-error, or null-font results. A catch-and-return,
wrong branch order, or unreachable guard would still pass.

This falls short of the associated exact test plan
(`explorer-2026-07-23-crazy-architecture-map.md:426-429`).

Recommended fix: use a stub Cocos bundle and execute every reject branch plus one successful exact
catalog load.

### Low Priority

None. Style-only comments omitted.

### Edge Cases Found by Scout

- Resolved during review: a saved best above the current run now still sends the completed run.
- Resolved during review: a final pending double bucket flushes before Result captures the score.
- The route integration must consume the captured-parent boundary before cleanup; the command trace
  alone is not an executable node-replacement transaction.
- Duplicate/early Time Up finish callbacks are not gated.
- A throwing or malformed injected settings/effects port leaves DoubleToss or TimeManager partially
  mutated.
- Crazy domain objects and Result navigation remain mostly unconsumed outside tests; the route must
  stay fail-closed until executable ownership is present.

### Contract Verification

The following requested behaviors were independently checked and match the reviewed contracts:

- scene entry order, all 11 controller construction/attachment pairs, TimeManager attachment,
  intro, electric support, pause UI, and initial best-score command;
- TimeManager callback factory order:
  `freeze-start -> freeze-finish -> time-up -> time-up-finish`;
- cuts remain enabled during the intro; `60s` and `GO` each run concurrent
  `0.25 / 0.5 / 0.25` tracks for a nominal total of two seconds;
- GO starts `ab,b0,b2,ac,b1,b3,ad,b5,ae,af`; `b4` is omitted;
- bomb scoring commits `-10` before the double-score flush; the signed pending-bucket regression
  now proves authoritative `12 + (5 - 10) * 2 = 2`;
- bomb hit stops only magnet controller `ae`; it does not stop the electric support object;
- immediate Time Up stops `ab,ad,ae,af,b0,b2,ac,b1,b3`; `b4` and `b5` remain omitted;
- DoubleToss Left/Right construction, base RNG perturbation, 15-second retained callback, audio,
  and bonus-11 cleanup;
- BonusToss candidates `[12,10,11]`, retry draws, direction mapping, and
  create/randomize/attach/enable/audio order;
- TimeManager warning equality, tick-before-expiry callback, freeze/thaw command order, and
  three-second Time Up action;
- Time Up captures the Crazy parent before Result construction, uses authoritative completed score
  even below the saved best, and observes a final pending double-score flush;
- Result retry/menu pure command order, effects-gated click audio, fresh construction, captured
  parent, and absence of save/delay/scene replacement;
- Crazy leaderboard insertion and float32 `0.6` reward behavior;
- unresolved `text-nobomb` and Crazy leaderboard consumer guesses remain excluded from the required
  supplemental resource catalog.

### Recommended Actions

1. Add terminal phase/one-shot guards and illegal-transition tests.
2. Make injected-port failures atomic for DoubleToss and TimeManager.
3. Replace the regex-only loader test with executable failure fixtures.
4. Add the captured-parent Result transaction/rollback consumer before opening the route.
5. Re-run the full vertical slice before
   opening the Crazy route.

### Metrics

- Type coverage: not instrumented.
- Test coverage: not instrumented.
- Focused Crazy/TimeManager verification:
  `node --test tests/reconstruction/vertical-slice/crazy-*.test.ts tests/reconstruction/vertical-slice/time-manager-*.test.ts`
  passed 67/67.
- Strict TypeScript:
  `node .../typescript/lib/tsc.js -p game/tsconfig.json --pretty false --noEmit` passed.
- Lint issues: no project lint command identified; not measured.
- Database/query/auth/data-leak checks: not applicable to these local pure game-domain modules; no
  database, network, identity, PII, or secret boundary is present.

### Plan Follow-up

Phase 6 remains `pending`, and all Phase 6 todo/success checkboxes remain open. The reviewed domain
primitives are partial implementation evidence only. Do not update the plan to claim Crazy mode,
Result lifecycle, or route completion until the Medium findings and executable integration gates
pass.

### Unresolved Questions

None for the reviewed domain contract. Remaining resource-consumer unknowns are already documented
and correctly excluded rather than invented.
