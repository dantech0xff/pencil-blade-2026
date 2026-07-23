# Crazy Registry and Electric Contact Review

## Code Review Summary

### Scope

- Files: `crazy-entity-registry.ts`, `crazy-electric-contact-adapter.ts`,
  `crazy-generated-special-fruit.ts`, `classic-physics-adapter.ts`, and their four focused
  vertical-slice tests.
- Reviewed implementation/test LOC: 4,432.
- Focus: production readiness, rollback convergence, Cocos Creator 3.8.8 compatibility,
  recovered native contracts, and integration readiness.
- Scout findings: callback failures can cross the manual Box2D step, bonus rollback can split
  entity and bonus-manager state, physics-global setup is not transactional, cleanup loops stop
  at the first failure, and neither new runtime boundary has a production importer.

### Overall Assessment

**CHANGES_REQUIRED.**

The focused tests pass and the code type-checks against the bundled Creator 3.8.8 declarations,
but the current happy-path coverage does not prove failure convergence. Three high-priority
defects can leave global or gameplay state inconsistent. The registry and contact adapter are
also not wired into a production gameplay owner, so this work is not integration-ready and must
not open the Crazy route.

## Pass 1: Critical and Blocking Findings

### High — Electric contacts execute an unconstrained callback inside the Box2D step

`CrazyElectricContactAdapter.onBeginContact()` calls both `resolveBomb()` and
`onBombContact()` synchronously from the Creator contact callback
(`game/assets/scripts/creator/crazy-electric-contact-adapter.ts:154-174`). The public lifecycle
port provides no `callAfterStep` boundary and `setActive()`/`dispose()` also mutate Creator
physics lifecycle directly (`:123-150`).

This conflicts with the project contract: all project-owned create/destroy/enable/disable/apply
mutations must be delayed until the manual step returns, and no contact callback may mutate
Creator physics lifecycle (`forensics/contracts/classic-physics-contract.md:288-298`). It also
creates a concrete rollback hazard: if `onBombContact()` queues entity cleanup and then throws,
the exception escapes `PhysicsSystem2D.step()` and `ClassicVariableStepRunner` clears every
queued mutation before rethrowing
(`game/assets/scripts/domain/classic-variable-step.ts:50-55`). The registry can then retain an
entity whose disposal state no longer has a runnable cleanup.

Required fix:

1. Inject the Crazy physics `callAfterStep` seam and defer the contact handoff as one mutation,
   or expose a callback contract that cannot perform or indirectly schedule physics lifecycle
   work.
2. Keep sensor activation/disposal behind the same seam when invoked during gameplay.
3. Add a test that emits a real Creator-shaped contact, proves the handoff occurs after the
   step, and proves a failing handoff cannot discard already requested cleanup.

The existing contact test is insufficient: it invokes the callback directly and even accepts a
contradictory synthetic event where neither explicit collider is the sensor but
`contact.colliderA` is (`tests/reconstruction/vertical-slice/crazy-electric-contact-adapter.test.ts:165-195`).
Creator 3.8.8 emits collider-local callbacks with the registered collider as `selfCollider`, so
that fallback does not exercise the production contract.

### High — Bonus audio failure removes the fruit after committing its enabled state

The recovered command order commits `enable-bonus` before optional audio
(`game/assets/scripts/creator/crazy-entity-registry.ts:227-249`). If audio then throws, the catch
unregisters and disposes the entity while deliberately leaving the external enable commit in
place (`:252-255`, `:536-547`).

That is not a converged transaction. `BonusManagerState` keeps the bonus enabled until an
explicit disable (`game/assets/scripts/domain/bonus-manager-state.ts:21-43`), while
`BonusTossStrategy` skips enabled bonus IDs and stops completely once all three are enabled
(`game/assets/scripts/domain/bonus-toss-strategy.ts:153-172`). The removed fruit can never be cut
to trigger its normal effect/disable lifecycle. Repeated presenter failures can therefore make
all future bonus tosses stop.

The test currently institutionalizes the defect by asserting one enabled bonus, zero registered
entities, and deferred destruction after audio failure
(`tests/reconstruction/vertical-slice/crazy-entity-registry.test.ts:1042-1077`).

Required fix: define a commit boundary. After attach plus enable succeeds, retain the registered
fruit even if optional audio fails, or add an explicit compensating disable transaction. Do not
claim rollback while preserving one half of the state transition. Test the final
`BonusManagerState` and registry together.

### High — Physics-global configuration and restoration are not transactional

`ClassicPhysicsAdapter.configureResolvedWorldProperties()` stores the snapshot and marks itself
configured before resetting and mutating several singleton properties and three collision rows
(`game/assets/scripts/creator/classic-physics-adapter.ts:78-97`). Any failure after line 85
leaves a partially configured global while future calls return early. The new electric row adds
another mutation to this failure surface.

The Crazy wrapper cannot repair this: its rollback `try` starts only after configuration returns
(`game/assets/scripts/creator/crazy-physics-adapter.ts:53-74`). Restoration is likewise a
sequence of throwing operations and clears ownership only at the end
(`classic-physics-adapter.ts:143-170`), so a restoration failure can leave both partial global
state and a permanently configured adapter.

Required fix:

1. Put configuration inside the activation rollback boundary.
2. Make configuration restore the captured snapshot on any partial failure.
3. Make restoration best-effort across every field/row, aggregate failures, and clear ownership
   only according to an explicit retry policy.
4. Add fault-injection tests for `resetAccumulator`, property setters, collision-matrix writes,
   and restoration failures. The existing test covers only a fully successful seeded matrix
   (`tests/reconstruction/vertical-slice/classic-physics-adapter.test.ts:71-119`).

## Pass 2: Informational Findings

### Medium — Cleanup stops at the first failure and can strand cut-disabled entities

`runRayQueryCutBatch()` clears its pending set, then finalizes entities without per-entity error
isolation (`game/assets/scripts/creator/crazy-entity-registry.ts:329-347`). A failure from the
first `completeRayQueryCuts()` skips every later entity and replaces any exception thrown by the
query body. `disposeAll()` has the same stop-on-first-error behavior (`:380-383`).

For a special fruit, finalization sets `cutDisabled` before asking `callAfterStep` to queue
disposal (`game/assets/scripts/creator/crazy-generated-special-fruit.ts:286-292`). If that seam
throws, `queueDispose()` resets only `disposalQueued`, not `cutDisabled` (`:352-379`). The fruit
can remain registered, alive, and permanently uncuttable.

Required fix: drain all cleanup targets best-effort, preserve the original operation error while
aggregating cleanup errors, and either roll back `cutDisabled` when scheduling fails or retain a
retryable cleanup record. Add a multi-entity test with an injected queue failure.

### Medium — The electric compatibility policy is still unresolved, not recovered

The native evidence specifies a zero-height, non-sensor fixture plus a `PreSolve` vertical
velocity gate (`forensics/contracts/classic-physics-contract.md:167-200`). The Creator adapter
uses a one-unit sensor and only handles `BEGIN_CONTACT`
(`game/assets/scripts/creator/crazy-electric-contact-adapter.ts:20-24,43-49,86-99`).
Type-safe replacement of the invalid native cast is required, but this changes three observable
properties: height, physical-response mode, and the downward/non-positive velocity gate.

The architecture still labels both the unsafe `PreSolve` behavior and zero-height policy
unresolved (`docs/decisions/cocos-creator-architecture.md:132-145`). Record this adapter choice
as the reviewed safety policy and validate its contact count/direction behavior in Creator
Preview before describing it as fidelity-complete.

### Medium — New boundaries are orphaned from production runtime

Repository-wide import search finds no production consumer of either
`CrazyEntityRegistry` or `CrazyElectricContactAdapter`; only their declarations and focused tests
reference them. Consequently, no production owner connects planner commands to entities,
electric contacts to bomb hit/audio/cleanup, or teardown to the physics lease.

This is an integration gate, not a request to add coupling inside these modules. Wire both
through the future Crazy gameplay controller, keep that controller passive until activation,
and add one integration test covering spawn, ray cut, electric hit, deferred cleanup, and
deactivation rollback. Until then the Crazy route must remain fail-closed.

## Behavioral Checklist

- Concurrency/reentrancy: **failed** — contact and callback reentrancy are not bounded by the
  after-step queue.
- Error boundaries: **failed** — callback, cleanup, configure, and restore exceptions can leave
  partial state.
- API contracts: **failed** — contact lifecycle does not enforce the manual-step contract.
- Backwards compatibility: no exported contract break found in the reviewed diff; new electric
  collision row needs exact rollback coverage.
- Input validation: core plan/resource inputs are validated before allocation; no external
  network/user boundary is present.
- Auth/authz: not applicable to this local game runtime.
- N+1/query efficiency: no database or unbounded external-query loop found; registry operations
  are map lookups plus bounded in-memory entity scans.
- Data leaks: no secret, PII, or stack-trace exposure found.
- Fact-check: paths, symbols, native fixture values, and Creator 3.8.8 contact signature were
  checked against source and contracts rather than inferred from the plan.

## Plan Status Recommendation

- Isolated registry/special-fruit/contact implementations: present.
- Focused unit tests and strict Creator TypeScript check: passing.
- Rollback/error-path acceptance criteria: incomplete.
- Electric compatibility decision and Preview validation: incomplete.
- Production Crazy gameplay integration: incomplete.

Do not mark the Crazy gameplay/runtime phase complete and do not open its route.

## Verification

- `node --test` on the four focused test files: **20 passed, 0 failed**.
- Creator 3.8.8 bundled strict TypeScript, `tsc -p game/tsconfig.json --noEmit`: **passed**.
- Production importer search: **0** for both new runtime boundaries.
- Type coverage: not instrumented.
- Test coverage: not instrumented; green focused tests omit the failure paths above.
- Linting issues: not measured; no repository lint command was required for this read-only
  review.

## Recommended Actions

1. Defer electric hit dispatch through the physics after-step seam and test failure behavior.
2. Make bonus enable/entity state one commit or add explicit compensation.
3. Make physics singleton configure/restore transactional with fault-injection coverage.
4. Make batch cleanup best-effort and retry-safe.
5. Record the sensor/velocity-gate compatibility decision, wire through one gameplay owner, and
   run Creator Preview contact/lifecycle validation before opening the route.

## Unresolved Questions

- Should a trailing audio-presenter failure be non-fatal after the bonus fruit is attached and
  enabled, or should the domain add an explicit disable compensation command?
- Is the one-unit sensor with no downward-velocity gate the accepted electric compatibility
  policy, or should the adapter reproduce the gate using safe typed body data?
