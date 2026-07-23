# Code Review: Crazy Runtime Checkpoint

Date: 2026-07-23
Decision: **CHANGES_REQUIRED**
Resource checkpoint: **AMBER**
Route safety: **safe only while Crazy remains fail-closed**

## Code Review Summary

### Scope

- Files: 51 Crazy/Bonus/TimeManager domain, Creator, and focused test files; shared
  `classic-physics-adapter.ts`; Mode Select/app-shell routing boundary.
- Reviewed LOC: 20,591 in the Crazy/Bonus/TimeManager implementation and focused tests.
- Focus: current shared-tree checkpoint, prior registry/contact findings, direction ABI,
  Dragon runtime/registry coverage, error convergence, Physics2D ownership, prohibited runtime
  paths, and the state-1 fail-closed route.
- Tester checkpoint:
  `tester-2026-07-23-crazy-contract-direction-checkpoint.md`, source/test fingerprint
  `7052eae372d8c0110d1279965aa9d5cdf84a465fcd2a048fd80f7aad004a4b62`.
- Reviewer pre-report tree hash:
  `16d3a0085effbd83a47f4ddd6cbd6b4e1a2308b7953d2f87bae083eda5ced265`.

### Overall Assessment

**CHANGES_REQUIRED.**

The isolated Crazy modules are materially safer than the registry/contact review snapshot:
contact dispatch now crosses the after-step boundary, bonus enable/entity state converges, registry
cleanup drains best-effort, and shared physics configuration/restoration is transactional and
retryable. The recovered `af`/`ae`/`ad` Down ABI is correct.

The checkpoint is not a complete Crazy runtime. The scheduler and command batcher produce a valid
Dragon spawn, but `CrazyEntityRegistry` rejects that same command by contract. The standalone
Dragon presenter also has no owner for parent-attached counter and terminal-piece nodes once the
original entity is disposed. These gaps make opening state 1 unsafe. The app shell still returns
`false` for Crazy preparation, so the current checkpoint is safe to retain while fail-closed.

## Pass 1: Critical / Blocking Review

### Critical Issues

None found in the currently unreachable checkpoint. No authentication boundary applies to this
local game runtime, and no original APK, `libgame.so`, JNI, JSB, legacy Cocos2d-x runtime, or
compatibility bridge is imported by production Crazy TypeScript.

### High Priority

#### High — The valid `ad` Dragon spawn path terminates at a deliberate registry exception

The recovered controller table emits `ad` as Down ABI `direction: 1`, `tossType: 6`
(`game/assets/scripts/domain/crazy-toss-config.ts:175-181`). The runtime partitioner explicitly
accepts `create-dragon-fruit` as a classic spawn command
(`game/assets/scripts/domain/crazy-runtime-command-batches.ts:22-35`). The next public boundary
excludes Dragon from `CrazyGeneratedEntity` and `ValidatedClassicSpawnPlan`
(`game/assets/scripts/creator/crazy-entity-registry.ts:42-45,172-176`) and throws
`Crazy DragonFruit runtime entity is not implemented`
(`game/assets/scripts/creator/crazy-entity-registry.ts:680-690`). The registry test asserts that
rejection as expected behavior
(`tests/reconstruction/vertical-slice/crazy-entity-registry.test.ts:1073-1101`).

Impact: once the Crazy route is opened, the first scheduled `ad` turn can propagate a synchronous
spawn failure through the runtime command callback. The standalone
`CrazyGeneratedDragonFruit` implementation and its passing tests do not make it reachable.

This is a mandatory runtime defect, not merely evidence that the route is intentionally closed:
the upstream scheduler/batcher contracts promise support and the downstream public registry
contract rejects it. It must be fixed before a Crazy gameplay owner may report ready.

Required fix: add Dragon to the registry entity/kind/disposal unions; provide its exact font,
shared RNG, lifecycle, score/objective/audio, and critical-particle ports; preserve its custom
non-Fruit ray behavior; and add one coordinator -> partitioner -> registry -> cut/completion
integration test. Remove the test that institutionalizes rejection only after that path passes.

#### High — Dragon disposal does not own its parent-attached presentation/physics children

The hit counter is attached to the Dragon's gameplay parent rather than its root
(`game/assets/scripts/creator/crazy-generated-dragon-fruit.ts:648-681`). All four terminal pieces
are also attached directly to that parent
(`game/assets/scripts/creator/crazy-generated-dragon-fruit.ts:697-711`). However,
`queueDispose()` destroys only `this.node`, marks the original detached, then invokes
`onDisposed` (`:528-550`). It neither destroys nor transfers ownership of the counter or terminal
pieces.

The focused test hides the production ownership gap by retaining the disposed entity and manually
calling `entity.updateAction()` after `entity.node` has been destroyed
(`tests/reconstruction/vertical-slice/crazy-generated-dragon-fruit.test.ts:510-520`). A registry
owner would normally unregister on `onDisposed`; no production owner exists that continues
advancing those sibling actions. Forced teardown before the normal fade is worse: a first-cut
counter has no independent cleanup path.

Impact: integrating the current class can strand a counter node and up to four dynamic
terminal-piece bodies across entity removal or mode teardown.

Required fix: define an explicit auxiliary-node owner. Normal Dragon completion must transfer and
advance the counter/pieces until their deferred disposal; `registry-dispose-all` and
`spawn-failed` must best-effort destroy every auxiliary immediately. Add normal-completion and
forced-teardown tests that assert no gameplay-parent child or physics body remains without
manually updating a disposed entity.

## Pass 2: Informational Review

### Medium Priority

#### Medium — Registry/contact boundaries still have no production Crazy gameplay owner

Repository-wide production import search returns only the declaration files for
`CrazyEntityRegistry` and `CrazyElectricContactAdapter`; no gameplay controller constructs either.
Therefore no production path currently connects command batches to entities, typed electric
contacts to bomb handling, Dragon/piece updates to the post-physics loop, or teardown to the
physics lease.

Unlike the Dragon registry contradiction above, this is an intentional fail-closed integration
blocker at this checkpoint: `recovered-app-shell-controller.ts:312-316` rejects Crazy preparation.
Build the Crazy gameplay owner transactionally, keep it passive until every dependency prepares,
and add an integration test for spawn, bidirectional cut dispatch, electric contact, post-step
cleanup, Dragon completion, and deactivation rollback.

#### Medium — Electric compatibility remains an explicit Preview validation gate

The source contract recovers a zero-height non-sensor fixture and a `PreSolve` non-positive
vertical-velocity gate
(`forensics/contracts/classic-physics-contract.md:167-200`). The Creator adapter intentionally
uses a one-unit sensor and `BEGIN_CONTACT`
(`game/assets/scripts/creator/crazy-electric-contact-adapter.ts:20-24,87-100`). This is a valid
memory-safe adaptation under `crazy-mode-contract.md:273-276`, but it changes observable contact
policy and has not been validated in Creator Preview. Keep it labeled a compatibility decision,
not recovered runtime parity, until contact count/direction/lifecycle behavior is exercised on
the pinned backend.

### Low Priority

None.

## Prior Registry/Contact Finding Disposition

| Prior finding | Current verdict | Evidence |
|---|---|---|
| Contact callback ran inside Box2D step | **Fixed in isolated adapter** | `crazy-electric-contact-adapter.ts:172-181` queues the handoff; focused failure test proves the error surfaces only from the deferred drain at `crazy-electric-contact-adapter.test.ts:284-311`. Production ownership remains open. |
| Bonus audio failure split entity and BonusManager state | **Fixed** | Commit occurs after successful enable and a later audio error retains the attached registry entity at `crazy-entity-registry.ts:254-288`; convergence test at `crazy-entity-registry.test.ts:1111-1150`. |
| Physics configure/restore was non-transactional | **Fixed** | Configuration rollback at `classic-physics-adapter.ts:101-148`; best-effort restore with retained snapshot at `:193-229,294-374`; Crazy activation includes configure inside rollback at `crazy-physics-adapter.ts:70-95`. Fault-injection coverage passes. |
| Registry cleanup stopped on first error / special fruit stranded cut-disabled | **Fixed for registered non-Dragon entities** | Best-effort ray finalization and dispose-all at `crazy-entity-registry.ts:362-407,440-455`; special guard rollback at `crazy-generated-special-fruit.ts:286-298`; retry tests pass. Dragon auxiliary cleanup is the new High finding above. |
| Electric compatibility policy unresolved | **Still open** | Memory-safe policy is explicit, but pinned Creator Preview contact validation remains absent. |
| Registry/contact boundaries orphaned | **Still open** | Production import search finds no consumer; state 1 remains rejected by the app shell. |

## Edge Cases Found by Scout

- `ad` crosses scheduler and batching successfully but fails at registry validation.
- Dragon is `isFruit: false`, so integration must not accidentally apply generic fruit
  query-completion disposal or combo behavior.
- Dragon completion disposes the original before its sibling counter/piece animations finish;
  lifecycle ownership must survive registry removal.
- A failed physics restore retains the snapshot and blocks simulation restart until retry; current
  implementation and fault tests preserve this invariant.
- Optional bonus audio failure occurs after the native enable commit; current registry correctly
  keeps the cuttable entity instead of rolling back only half the transition.

## Behavioral Checklist

- Concurrency/reentrancy: isolated contact callback is deferred; production owner still absent.
- Error boundaries: physics, registry drain, bonus commit, and special-fruit scheduling failures
  converge; Dragon auxiliary teardown does not.
- API contracts: `af`/`ae`/`ad` direction ABI matches the contract; Dragon batch/registry contracts
  contradict each other.
- Backwards compatibility: no exported contract regression found; all changes are additive while
  the route remains closed.
- Input validation: external/runtime command inputs are validated before allocation in reviewed
  boundaries.
- Auth/authz: not applicable to this offline local game runtime.
- N+1/query efficiency: no database/API query path; registry scans are bounded in-memory gameplay
  entity sets.
- Data leaks: no PII, secret, stack response, or prohibited native runtime path found.
- Fact-check: paths, symbols, ABI values, Creator 3.8.8 types, plan status, and fail-closed routing
  were grep-verified against current source.

## Plan Status Recommendation

- Contract direction: **PASS**.
- Resource checkpoint: **AMBER**.
- Isolated Crazy domain/presenter/runtime components: present, with the Dragon integration gaps
  above.
- Complete Crazy gameplay owner and production integration: incomplete.
- Mode Select state 1: keep fail-closed.
- Phase 4: no completion claim.
- Phase 6: remains unauthorized/pending.

## Verification

- Tester stable checkpoint: focused `159 / 159`, full vertical slice `580 / 580`, Creator 3.8.8
  bundled TypeScript `0` diagnostics, and `git diff --check` clean at fingerprint `7052eae...`.
- Fresh independent focused run:
  `node --test tests/reconstruction/vertical-slice/crazy-*.test.ts tests/reconstruction/vertical-slice/time-manager-*.test.ts`
  — `159` passed, `0` failed, `0` skipped.
- Fresh independent Creator 3.8.8 bundled `tsc -p game/tsconfig.json --noEmit`: exit `0`, no
  diagnostics.
- Fresh independent `git diff --check`: exit `0`.
- Production importer search: `0` consumers for both registry and electric contact adapter.

## Metrics

- Critical findings: 0
- High findings: 2
- Medium findings: 2
- Low findings: 0
- Type coverage: not instrumented; strict bundled TypeScript check passed.
- Test coverage: not instrumented; deterministic counts above are test totals, not line coverage.
- Linting issues: not measured; repository has no required lint gate for this checkpoint.

## Recommended Actions

1. Integrate Dragon into the entity registry and prove the complete scheduler-to-completion path.
2. Give Dragon counter/terminal pieces explicit lifecycle and teardown ownership.
3. Build the production Crazy gameplay owner around registry, contact, physics, presenters, and
   rollback.
4. Validate the electric safety adaptation in Creator Preview.
5. Keep state 1 fail-closed and the resource checkpoint AMBER until these gates close.

## Unresolved Questions

- Which owner retains and advances Dragon counter/terminal pieces after original-body disposal?
- Is the one-unit sensor without the recovered velocity gate the accepted Creator compatibility
  policy after Preview validation?
- What is the exact remaining per-path Crazy resource consumer map?
