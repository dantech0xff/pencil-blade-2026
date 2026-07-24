# Objectives Shell Integration Code Review

Date: 2026-07-24
Decision: **PASS — no remaining P0-P2 findings**

## Code Review Summary

### Scope

- Follow-up production focus: `main-menu-fruit-presenter.ts`, `main-menu-presenter.ts`,
  `objectives-screen-presenter.ts`, `objective-achievement-host.ts`,
  `recovered-app-shell-controller.ts`, and the concrete `blade-input-controller.ts` contract.
- Supporting contracts traced: `main-menu-state.ts`, `objectives-manager-state.ts`,
  `classic-settings-state.ts`, and `classic-settings-runtime.ts`.
- Tests reviewed/executed: Main Menu fruit/presenter, achievement host/popup hosts, Objectives
  manager/presentation/presenter/resources/state, fruit-cut integration, shell, and viewport.
- Follow-up delta included 1,166 additions / 29 deletions in the principal tracked production and
  test files, plus the new Objectives presenter/achievement-host implementation and tests.
- Focus: original P1 remediation, manager failure timing, navigation ownership, retry latches,
  rollback aggregation, fatal Skip identity/exactly-once, and shell recovery.
- Runtime boundary: static and executable Node harness evidence only. Creator Preview and APK/device
  execution were not part of this review.

### Overall Assessment

Both original P1 defects are resolved.

Main Menu now treats navigation scheduling as a reversible transaction until the objective tail
finishes. The route-owning fruit can cancel the delayed route, while a follower fruit only
untracks itself and cannot cancel the first fruit's route. Objective notifications remain
at-most-once across retries, and a rollback failure retains both the objective and rollback errors.

Fatal Objectives failures now transfer ownership after local teardown through a guarded lifecycle
callback. The shell validates the exact active presenter, removes and disposes it, then either
activates a fresh Main Menu or ends in an explicit failed state. Original failure identity and
single reporting are preserved.

No remaining production-readiness defect at P0, P1, or P2 was found in the reviewed scope.

### Critical Issues (P0)

None found.

### High Priority (P1)

None remaining.

#### Resolved — Fatal Objectives ownership now reaches the shell

- Row projection, manager/commit-uncertain Skip, and post-commit refresh failures all invoke
  `poisonFatalOwnership(error)` (`objectives-screen-presenter.ts:590-598`, `:652-669`).
- Local teardown precedes notification: listeners are removed, the BladeInput lease is released,
  and the root is hidden before `onFatalOwnership(error)` runs
  (`objectives-screen-presenter.ts:913-930`).
- `fatalOwnershipNotified` is set before invoking the observer, so a throwing/reentrant observer
  cannot cause a second notification. Observer failure is retained as cleanup evidence without
  replacing the original manager/presentation error (`objectives-screen-presenter.ts:925-932`).
- The shell closure captures the exact presenter instance
  (`recovered-app-shell-controller.ts:699-728`). Recovery validates shell state, active presenter,
  shared-scene availability, and root ownership before mutation (`:1042-1065`).
- Valid recovery detaches/disposes the poisoned presenter and constructs a fresh Main Menu
  (`:1067-1101`). Destination failure releases the attempted Main Menu and leaves an explicit
  `failed` shell (`:1102-1145`). Reporting occurs once after recovery and preserves an `Error`
  primary by identity (`:1147-1151`, `:2911-2930`).
- Presenter tests prove exact original-error identity, teardown-before-callback, observer-throw
  containment, no replay, and no fatal signal for precommit audio failure
  (`objectives-screen-presenter.test.ts:398-425`, `:527-659`). Shell tests execute recovery for
  manager, post-commit refresh, and row-projection failures and cover failed destination
  activation (`recovered-app-shell-controller.test.ts:1077-1120`).

#### Resolved — Objective-tail failure no longer leaves stale delayed navigation

- `MainMenuFruitPresenter.cut()` captures a synchronous navigation rollback before invoking the
  global/type objective tail (`main-menu-fruit-presenter.ts:351-364`).
- Any tail failure invokes that rollback, removes cut halves, restores the fruit/circle visuals,
  and clears local cut acceptance (`:372-392`).
- A route owner resets navigation/model/cut gate; a fruit joining an already-pending route receives
  an untrack-only rollback (`main-menu-presenter.ts:1052-1075`, `:1093-1109`,
  `:1311-1324`). This prevents a failing follower from orphaning the first fruit's route.
- Executable regressions cover same-fruit cancellation/retry and two-fruit owner/follower behavior:
  the first route remains pending and commits once while the failed follower remains uncommitted
  (`main-menu-presenter.test.ts:589-677`).

### Medium Priority (P2)

None found.

### Low Priority (P3)

None found in code. Live rendering, touch feel, and device/build behavior remain validation gates,
not findings from this static review.

### Edge Cases Found by Scout

- **Global manager failure:** the global latch is set before invocation. A retry skips the
  commit-uncertain global call and proceeds to the still-unlatched type notification.
- **Type manager failure:** the global stage has already completed and the type latch is set before
  invocation. A retry replays neither stage.
- This is the only safe at-most-once policy exposed by the current manager port: storage calls do
  not return a precommit/postcommit status. A precommit storage failure may therefore omit one
  event, while replay could duplicate an already committed event. The implementation consistently
  chooses no duplication (`main-menu-fruit-presenter.ts:466-475`).
- Achievement presenter failures no longer escape manager calls: the persistent shell-owned host
  contains cheer/create/attach/update/retirement/teardown failures and reports them independently
  (`objective-achievement-host.ts:60-90`, `:93-139`, `:170-220`).
- If objective-tail rollback itself throws, `MainMenuFruitCutRollbackError.failures` retains the
  original failure first and rollback failure second
  (`main-menu-fruit-presenter.ts:372-390`, `:479-486`). The synthetic Main Menu input-port failure
  does not establish a production soft-lock: the shell supplies `BladeInputController`, whose
  `setCutEnabled` is a non-throwing boolean assignment (`blade-input-controller.ts:81-83`).
- One blade dispatch can contain multiple fruit cuts because the disabled gate is checked before
  the dispatch loop. The owner/follower regression now covers this boundary.
- Stale presenter/root identity, wrong route timing/z-order, destination construction/attachment/
  activation failure, source release failure, and failed recovery cleanup were inspected.
- No database, network, authentication, authorization, PII, or secret boundary exists in this
  offline slice. N+1, auth/authz, and data-leak checks are not applicable.

### Positive Observations

- The shell now owns one fresh manager and one popup host across Main Menu, Mode Select, and
  Objectives instead of coupling menu progression to a gameplay-screen popup owner
  (`recovered-app-shell-controller.ts:577-598`, `:628-729`).
- Fatal Skip recovery preserves the original error instead of replacing it with cleanup/reporting
  errors. Recovery failures are appended only when present.
- Navigation rollback separates route ownership from participation, matching the existing
  multi-fruit pending/commit contract.

### Behavioral Checklist

- [x] Concurrency/ordering: synchronous manager callbacks, multi-hit dispatch, transition lock,
      callback reentrancy, and update ordering checked.
- [x] Error boundaries: precommit, commit-uncertain, post-commit, cleanup, reporting, and recovery
      paths traced.
- [x] API contracts: manager timing/nullability, rollback closure, presenter identity, root
      ownership, route timing/z-order, and concrete BladeInput behavior verified.
- [x] Backwards compatibility: changes are additive; no exported contract or schema removal found.
- [x] Input validation: route payloads, viewport, resources, manager ports, and Creator node
      ownership remain guarded.
- [x] Auth/authz: not applicable.
- [x] N+1/query efficiency: not applicable; bounded 52-row work only.
- [x] Data leaks: no secrets, PII, network response, or externally exposed stack data.
- [x] Plan facts: `plan.md:154-163` still calls Objectives/progression open; implementation now
      satisfies the reviewed static scope, but plan status mutation belongs to the plan owner.

### Recommended Actions

1. Plan owner should reconcile the stale Phase 6 Objectives/progression status with this completed
   implementation and its reports.
2. Run Creator Preview and Android build/device gates before claiming runtime completion.
3. Optional hardening: add a dedicated per-type objective-throw regression. The shared latch and
   rollback code was verified directly, so this is not a release blocker.

### Metrics and Verification

- Focused tests: **196 passed, 0 failed**.
- Command:
  `node --test tests/reconstruction/vertical-slice/{main-menu-fruit-presenter,main-menu-presenter,objective-achievement-host,objective-achievement-popup-hosts,objectives-fruit-cut-integration,objectives-manager-state,objectives-screen-presentation,objectives-screen-presenter,objectives-screen-resource-contract,objectives-screen-resource-loader,objectives-screen-state,recovered-app-shell-controller,recovered-app-viewport}.test.ts`
- Strict typecheck: **pass**, zero diagnostics, using Cocos Creator 3.8.8 TypeScript with
  `-p game/tsconfig.json --noEmit` (`strict: true`).
- Diff hygiene: **pass**, `git diff --check`.
- Type coverage: not instrumented; strict compiler gate passed.
- Test coverage: not instrumented.
- Lint issues: no project lint script/config found in the inspected package; count unavailable.
- Runtime/build: not run; no Creator Preview or APK/device evidence claimed.

### Unresolved Questions

None for the reviewed static scope.
