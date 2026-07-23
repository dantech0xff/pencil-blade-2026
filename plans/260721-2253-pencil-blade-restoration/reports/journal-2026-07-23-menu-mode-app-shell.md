# Menu/Mode App Shell Checkpoint

**Date**: 2026-07-23 10:43 +08
**Severity**: High
**Component**: Phase 5A app shell, Main Menu, Mode Select, shared scene layers, settings/runtime
**Status**: Ongoing

## What Happened

The Phase 5A checkpoint finally delivered the persistent app shell and the visible route stack on the TypeScript side: shared background/leaf/theme layers, Main Menu, Mode Select, the Result -> Main Menu / Retry transactions, and the settings/audio expansion around unlock and rated-state persistence. The shell now owns the Boot -> Main Menu -> Mode Select -> Classic handoff instead of letting Classic pretend it is the whole app.

That was the good part. The ugly part was two callback bugs that made the first implementation brittle enough to lie about ownership. One was an unbound `callAfterStep` path, where deferred physics work could escape the owning adapter boundary. The other was stale `after-physics` callbacks surviving past lease release, which meant old work could still fire after the non-Classic screen had already handed Physics2D back.

## The Brutal Truth

This was frustrating because the code looked clean until it hit the lifecycle boundary, and then it failed in the exact place we should have been paranoid about. The shell was correct on paper, but Creator’s deferred execution model does not care about paper. It cares about who still owns the lease when the callback finally runs.

## Technical Details

- Verification passed: `410/410` vertical-slice tests, `38/38` source/staging/archive tests, strict Creator TypeScript, and independent review.
- `git diff --check` was clean.
- The checkpoint is wired through `classic.scene` with the expected shell controllers and the shared current-screen host.
- `NonClassicPhysicsAdapter.callAfterStep()` now queues guarded `Director.EVENT_AFTER_PHYSICS` work and epoch-checks the lease before mutation.
- The shell now commits screen replacement transactionally instead of assuming a synchronous node swap.

## What We Tried

- Wired the app shell directly into the recovered scene graph and then tightened the handoff around explicit screen placement ownership.
- Moved deferred physics work behind the owning adapter and canceled queued callbacks on lease release.
- Kept unsupported modes fail-closed instead of inventing placeholder screens for modes 1-5.

## Root Cause Analysis

We treated async Creator lifecycle callbacks like they were local function calls. They are not. The real bug was assuming ownership stayed valid after scheduling, when the engine was free to run stale work later. The localhost Preview problem is separate but equally annoying: Cocos is still serving a stale 08:12 cache even though the source writes landed at 10:14-10:15, so the browser route cannot be trusted as fresh proof yet.

## Lessons Learned

- Never schedule deferred physics mutations without a lease and an epoch guard.
- Never trust Preview output when the editor cache is older than the source tree.
- Keep app-shell transitions transactional or you will end up debugging ghost ownership.

## Next Steps

- Re-run the full-route Browser Preview after the Cocos cache refreshes and confirm Boot -> Main Menu -> Mode Select -> Classic and Result -> Menu/Retry live end to end.
- Keep modes 1-5 fail-closed until their own contracts exist.
- Owner: phase-05 implementation. Timeline: next checkpoint, after Preview freshness is resolved.

## Unresolved Questions

- Does the stale 08:12 localhost cache clear with an editor restart, or do we need a full Preview rebuild to pick up the 10:14-10:15 source writes?
