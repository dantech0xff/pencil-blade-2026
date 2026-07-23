---
role: simplifier
date: 2026-07-23
scope: menu-mode-runtime
status: complete
---

# Menu/Mode Runtime Simplification Review

## Summary

Reviewed `recovered-app-shell-controller.ts`, `non-classic-physics-adapter.ts`,
`main-menu-presenter.ts`, and `mode-select-presenter.ts` against their focused tests.
Made no implementation edits.

## Findings

- The highest-complexity areas are the ones that need to stay explicit: app-shell screen
  transactions, shared BladeInput lease handoff, non-Classic physics lease ownership, and
  fail-closed unsupported destination handling.
- The remaining duplication is mostly local rollback/rearm plumbing. Extracting more helpers
  here would reduce line count a little, but it would also hide commit boundaries that the
  focused tests and Phase 5 contracts treat as important.
- The current code already isolates the risky parts behind narrow methods:
  `runTransition`, presenter `suspendForTransition()`, `rearmNavigationAfterFailure()`,
  and the non-Classic collision-filter lease methods.
- Because these files are newly added and source-order-sensitive tests pin some structure,
  I did not see a simplification that clearly improved maintainability enough to justify
  touching the runtime.

## Verification

- `node --test tests/reconstruction/vertical-slice/recovered-app-shell-controller.test.ts`
- `node --test tests/reconstruction/vertical-slice/non-classic-physics-adapter.test.ts`
- `node --test tests/reconstruction/vertical-slice/main-menu-presenter.test.ts`
- `node --test tests/reconstruction/vertical-slice/mode-select-presenter.test.ts`
- `node /Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript/bin/tsc --noEmit -p game/tsconfig.json`

All passed.

## Unresolved Questions

- Node emits `MODULE_TYPELESS_PACKAGE_JSON` warnings while running these TypeScript tests.
  Non-blocking for this task; fixing it would require touching `game/package.json`, which was
  outside the owned-file scope.
