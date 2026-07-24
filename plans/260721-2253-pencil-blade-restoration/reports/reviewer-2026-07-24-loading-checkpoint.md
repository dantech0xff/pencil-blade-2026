---
type: reviewer
date: 2026-07-24
status: approved
---

# Code Review Summary

## Follow-up Review — 2026-07-24

**Verdict: approved. No P0-P2 finding remains.**

- The optional preparation aggregate is created and observed immediately at
  `recovered-app-shell-controller.ts:570-580`, before foreground loading can suspend the boot
  transaction. The shell still awaits the original aggregate at
  `recovered-app-shell-controller.ts:601-604`, so the observer prevents an unhandled-rejection gap
  without swallowing the boot failure.
- The executable slow-foreground regression at
  `tests/reconstruction/vertical-slice/recovered-app-shell-controller.test.ts:309-412` destroys the
  shell, releases the optional chain while foreground resources remain pending, and asserts zero
  `unhandledRejection` events both before and after the boot Promise rejects.
- `loading-presenter.ts:204-302` now attaches each completed sprite under the Loading root
  immediately and locally destroys a node when raster lookup, component setup, configuration, or
  attachment fails. The fault-injection test at
  `tests/reconstruction/vertical-slice/loading-presenter.test.ts:316-378` covers raster lookup,
  `addComponent`, and `setParent` failures and proves all transient nodes are destroyed.
- The executable same-Canvas test at
  `tests/reconstruction/vertical-slice/loading-presenter.test.ts:380-412` proves Loading remains
  above shared roots inserted at native sibling slots `0..3`.
- The retirement failure test at
  `tests/reconstruction/vertical-slice/loading-presenter.test.ts:414-438` proves the Loading root is
  inactive and presenter ownership is retired before an injected destroy failure. Shell commit
  still precedes best-effort retirement at `recovered-app-shell-controller.ts:663-695`, so that
  cleanup failure cannot roll back the committed Main Menu.
- Fresh closure gates: focused shell/presenter tests `129/129` pass; Cocos Creator 3.8.8 bundled
  strict TypeScript passes with zero diagnostics; `git diff --check` passes.

## Scope

- Files: six new Loading domain/Creator modules; Loading integration in
  `recovered-app-shell-controller.ts`, `recovered-app-viewport.ts`, and
  `resource-consumer-registry.ts`; ledger/disposition updates; six focused Loading tests and
  related shell/registry/generator/staging tests.
- LOC: 2,186 additions and 213 deletions in reviewed production/test sources, excluding generated
  catalogs, metadata sidecars, and documentation.
- Focus: recent uncommitted recovered Loading checkpoint; production lifecycle, native fidelity,
  boot commit/rollback, Canvas ordering, and resource accounting.
- Scout findings, now closed: one reproducible asynchronous lifecycle rejection, one
  partial-construction cleanup leak, and material boot-transaction test gaps. The apparent missing
  asynchronous audio callback is not a defect under the accepted dispatch-only native-fidelity
  contract.

## Overall Assessment

**Approved after follow-up.** The static Loading contract, visible timing, raster selection, audio
order, resource ledger, Main Menu commit order, and Canvas sibling ordering match the reviewed
evidence. The original lifecycle race, partial-construction cleanup defect, and executable coverage
gaps are closed with focused regressions.

## Critical Issues

None. This checkpoint adds no authentication, authorization, database, secret, PII, or external
input boundary. No data-loss or trust-boundary defect was found.

## High Priority

### P1 — Resolved: optional-preparation rejection handler was delayed

Follow-up resolution: `recovered-app-shell-controller.ts:570-580` installs an immediate observer on
the aggregate, and the slow-foreground regression proves no process-level rejection escapes.

Original pre-fix behavior: the Classic Bird → Crazy Bird → Combo Bird → GN Style chain could reject
after shell destruction, but its aggregate consumer was not installed until after the foreground
resource await.

If foreground loading is slower than the optional continuation, the final propagated rejection has
no handler for at least one event-loop turn. A static harness compiled from the actual
`initializeRecoveredApp()` method reproduced:

```text
UNHANDLED destroyed
unhandled-before-foreground 1
PromiseRejectionHandledWarning
unhandled-final 1
```

That violated the zero-unhandled-rejection lifecycle boundary and could leave the boot Promise
pending indefinitely when the foreground loader never settled. The follow-up code and regression
remove that ordering gap.

## Medium Priority

### P2 — Resolved: partial presenter construction leaked detached nodes

Follow-up resolution: `loading-presenter.ts:204-302` makes each node locally exception-safe and
attaches completed nodes immediately so root destruction owns all prior work. Raster, component,
and attachment fault injection passes.

Original pre-fix behavior: all four sprite nodes were constructed while detached and only attached
after every construction succeeded. Root-only cleanup therefore could not reach earlier nodes when
a later raster or component operation failed. That contradicted the partial-construction cleanup
matrix at `explorer-2026-07-24-loading-architecture-map.md:268-269`.

### P2 — Resolved: boot retirement and z-order lacked executable coverage

Follow-up resolution: the same-Canvas ordering and destroy-failure retirement paths now execute
against the real Loading presenter with injected Cocos-node behavior. Combined with the shell's
commit-before-best-effort-retirement ordering, the requested invariants are covered.

Original pre-fix behavior: Loading shell tests largely proved substring order. They did not execute
the slow-foreground destruction, same-Canvas ordering, or postcommit disposal-failure paths.

The implementation currently has the intended ordering:

- Precommit tracked-owner cleanup is nested at
  `recovered-app-shell-controller.ts:668-701`; Loading remains owned until failure cleanup.
- Main Menu is activated and committed at `recovered-app-shell-controller.ts:663-667` before
  Loading retirement at `recovered-app-shell-controller.ts:692-695`.
- `LoadingPresenter.dispose()` deactivates the root before destruction at
  `loading-presenter.ts:156-166`, so a post-commit destroy exception cannot expose it.
- Loading is placed last at `loading-presenter.ts:131-135`. Later shared roots and Main Menu are
  forced to Canvas sibling indices `0..3` by `shared-game-scene-presenter.ts:50-54`,
  `shared-game-scene-presenter.ts:84-100`, and `shared-game-scene-presenter.ts:158-163`, leaving
  the pre-existing Loading node above them.

The follow-up presenter tests now execute those Cocos-node invariants directly.

## Low Priority

None.

## Edge Cases Found by Scout

- Resolved: slow foreground load + shell destruction no longer emits an unhandled optional-chain
  rejection.
- Resolved: failure during four-node graph creation destroys every transient node.
- Async `Bundle.preload()` errors are intentionally not fatal. The accepted contract defines
  progress as dispatch, forbids waiting on decode completion, and requires failure only for
  synchronous adapter throws
  (`explorer-2026-07-24-loading-architecture-map.md:233-247,270`). This matches the recovered
  fire-and-forget `SimpleAudioEngine` void preload calls. Adding fatal async behavior would be a
  contract change; a log-only callback would be an observability decision, not a review fix.
- Promise-race losers continue resource preparation after Loading failure. They cannot commit UI
  because the boot path has rejected, but the code has no cancellation token. Current architecture
  treats bundle warming as process-owned, so this is not classified as a blocker.

## Positive Observations

- Static disassembly confirms 62 native preload cases (`0..61`), first three background music,
  `/61` progress after increment, clamping, next-update delay entry, and the `0.5s` tail. The exact
  62-path source order in `loading-resource-contract.ts:77-151` matches the native literals.
- The four-raster profile identities and native insertion geometry are exact, including the
  `775x1280` high-profile background.
- Resource accounting reconciles: Loading owns 70 paths, registry coverage is `761/862`
  (`88.28%`), and classification remains `862/862` with `90 unknown`, `10 excluded`, and
  `1 unsupported`. Generated ledger and staging hashes match the updated evidence register.

## Recommended Actions

All blocking follow-ups are complete:

1. Immediate aggregate rejection observation plus slow-foreground destruction regression.
2. Exception-safe partial graph construction plus raster/component/attachment fault injection.
3. Executable same-Canvas z-order and destroy-failure retirement coverage.
4. Fresh focused tests, strict Creator TypeScript, and diff hygiene.

## Metrics

- Type coverage: not instrumented; Cocos Creator 3.8.8 bundled strict TypeScript passes with zero
  diagnostics.
- Test coverage: no statement/branch instrumentation. Reviewer reruns passed `178/178` focused
  Loading/shell/registry/ledger/staging tests and `15/15` viewport/scene-integration tests. The
  checkpoint tester reports `1520/1520` full vertical-slice and `61/61` top-level tests. Follow-up
  closure rerun passes `129/129` shell/presenter tests.
- Linting issues: no repository linter metric available; `git diff --check` passes.
- Concurrency: original P1 rejection-ordering defect is closed; no remaining finding.
- Error boundaries: synchronous Loading failures propagate and clean tracked owners; asynchronous
  shell destruction is observed without an unhandled rejection.
- API/backwards compatibility: no exported contract break found.
- Input validation: internal Loading viewport/resource/step boundaries validate shape and exact
  identity; no new external-input path.
- Auth/authz, N+1/query efficiency, and data leaks: not applicable to this local Creator boot slice;
  no finding.

## Plan Follow-ups

- Exact Loading surface, native preload/timing fidelity, ledger promotion, documentation sync, and
  two-profile Preview appear complete.
- Loading review findings are closed; the checkpoint can close from a code-review perspective.
- Phase 6 remains correctly open for the 90 unknown resource consumers and preserved unsupported
  font.

## Unresolved Questions

None.
