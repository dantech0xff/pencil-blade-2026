---
type: tester
date: 2026-07-23
status: pass
scope: classic-bird-final-checkpoint
---

# Test Report: Classic Bird Final Checkpoint

## Summary

The production Classic Bird route passes its deterministic source, lifecycle, resource,
transaction, and Cocos Creator Browser Preview gates. The restoration used static evidence and
original resources only; no original APK, native library, JNI, or legacy runtime was executed.

The final failure-path follow-up closes the Result-entry rollback finding:

- failed Physics2D or Bird input reacquisition enters a fatal, inert boundary;
- newly reacquired ownership is quiesced best-effort;
- incomplete Physics2D cleanup stays owned for teardown retry; and
- the GAME/OVER owner retains and exactly rethrows the typed lifecycle failure.

The restoration convenience balance is `999999` for new, missing, corrupt, or unreadable saves.
A valid persisted balance still wins, and normal unlock deductions and rewards remain real
transactions.

## Automated Gates

| Gate | Result |
|---|---:|
| Full deterministic vertical slice | `876/876` pass |
| Focused Result rollback controllers | `42/42` pass |
| Classic Bird focused group | `81/81` pass |
| Cocos Creator 3.8.8 bundled strict TypeScript | 0 diagnostics |
| Full inventory/evidence suite | `14/14` pass |
| Build-audit synthetic cases | `8/8` pass |
| Reconstruction policy | positive pass |
| Reconstruction policy negative fixtures | `4/4` pass |
| Documentation validator | exit `0`; heuristic code-reference warnings only |
| `git diff --check` | pass |
| Independent P0/P1 review | pass |

Full deterministic command:

```sh
node --test tests/reconstruction/vertical-slice/*.test.ts
```

Creator TypeScript command:

```sh
node /Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js -p game/tsconfig.json --pretty false --noEmit
```

## Cocos Creator Browser Preview

Cocos Creator refreshed and compiled the final source before a temporary, isolated headless
Chromium profile opened the live Preview at `http://localhost:7456/`.

The clean final probe exercised production presenter/controller transactions:

1. Main Menu entered Mode Select.
2. The carousel centered the original Classic Bird card.
3. The card committed to live Classic Bird gameplay.
4. The Bird blade trail/particles, fruit, bird, score, lives, and pause control rendered.
5. Pause Replay committed a fresh run with score reset to `0`.
6. A second Pause displayed the recovered objective/options overlay.
7. Pause Quit committed back to Main Menu.
8. Main Menu displayed the `999999` restoration balance.

The run recorded zero page exceptions and zero console errors. A prior clean interactive Preview
also exercised natural GAME/OVER, Result entry, Result Retry, Pause, and Resume; the final P1
changed only rollback behavior, whose injected failure cases are covered by the focused suites.
Temporary browser state was isolated from the user's Chrome profile.

## Remaining Restoration Gates

- Restore Crazy Bird, Combo Bird, and GN Style from static evidence and original resources.
- Produce and audit a real Creator Android build artifact.
- Complete release-rights review for recovered art, audio, fonts, name, and trademarks.

These are full-restoration/release gates, not blockers for the Classic Bird checkpoint.

## Unresolved Questions

None for the Classic Bird checkpoint.
