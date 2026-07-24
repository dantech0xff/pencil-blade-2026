# Objectives Popup Hardening

## Status

Done with integration concerns. Gameplay-owned popup boundaries and natural retirement are
implemented and covered. Concurrent app-shell host work still owns two final shared checks.

## Root Cause

- `ObjectivesManagerState.finish()` commits value, reward, and current-position state before
  invoking its synchronous popup observer.
- Classic, Crazy, Combo Bird, and GN Style executed cheer/create outside their attachment
  rollback boundary, then rethrew attachment or rollback failures. A presentation fault could
  therefore escape after objective commit and abort the remaining Fruit cut tail.
- The original popup state from commit `41b84d3` had no completion signal. Gameplay controllers
  updated retained presenter sets every frame and removed entries only during teardown.

## Implementation

- Added exact natural completion at `7.5s`:
  `4.0 delay + 0.5 ingress + 2.5 hold + 0.5 egress`.
- Exposed `ObjectiveAchievementPresentationSnapshot.complete` and
  `ObjectiveAchievementPresenter.isComplete`.
- Added one shared gameplay registry updater. It:
  - updates a snapshot of the registry;
  - removes ownership before disposal;
  - retires naturally complete presenters immediately;
  - contains update/disposal faults and reports each fault once through `console.error`.
- Wrapped each gameplay popup callback around all optional observer work:
  cheer, viewport/resource lookup, presenter creation, attachment, registry insertion, and
  rollback. Failures return normally after one diagnostic report.
- Classic rolls back only a target created by the failed callback. Existing target ownership is
  preserved.
- Exposed Classic's already-loaded `sharedBaseGameplayResources` for the app-shell popup host.
- Kept objective manager/storage calls and global -> mode -> per-type Fruit ordering unchanged.
  Crazy and GN Style Result commit/cleanup transactions are unchanged.

## Tests

New executable coverage:

- all four gameplay callbacks contain injected cheer failures;
- all four contain injected presenter-creation failures;
- all four contain injected attachment plus presenter-rollback failures;
- Classic also contains failed target rollback;
- every fault reports once and leaves no presenter registry entry;
- natural completion retires at `7.5s`, disposes once, and receives no later update;
- failed natural disposal still removes ownership and reports once.

Fresh verification:

- Affected popup, Classic, Crazy, Combo Bird, GN Style, and Classic transaction suite:
  `103/103` passed.
- `git diff --check`: passed.
- Creator 3.8.8 bundled strict TypeScript passed after the popup implementation. The final
  integrated rerun is temporarily blocked by concurrent shell-host code at
  `recovered-app-shell-controller.ts:715`, which references its not-yet-added
  `recoverFromObjectivesFatalOwnership` method.
- Broad `*objective*.test.ts`: `75/76` passed. The sole failure is the concurrent shell-host
  source assertion still expecting two `gameplay.sharedObjectivesManager` injections after the
  architecture-correct host changed both to `requireObjectivesManager()`. Shell-host owner
  accepted that update.

## Docs Impact

Minor. This report records the lifecycle/public adapter additions. No plan phase is marked
complete; app-shell integration remains under its separate owner.

## Unresolved Questions

None in the gameplay-owned popup scope. Final integrated TypeScript and shared Objectives suite
must be rerun after the shell-host owner completes its concurrent edits.
