---
type: tester
date: 2026-07-23
status: pass
scope: crazy-final-checkpoint
---

# Test Report: Crazy Final Checkpoint

## Summary

The production Crazy checkpoint passes its final source, transaction, and Creator-served
Browser Preview gates. No original APK or native library was executed.

The final lifecycle follow-up also closes all three Medium findings from the checkpoint review:

- Classic audio loads under one detached owner, revalidates its parent after every await, and
  rolls back all nodes on construction or attachment failure.
- Classic runtime teardown attempts every cleanup stage and publishes cleared shared ownership
  even when a presenter or audio stop reports an error.
- An executable real-controller regression proves a post-commit Crazy bomb observer failure
  runs `afterBombHit()` once, restores cutting, and never retries `bombHit()`.

## Automated Gates

| Gate | Result |
|---|---:|
| Full deterministic vertical slice | `739/739` pass |
| Cocos Creator 3.8.8 bundled strict TypeScript | 0 diagnostics |
| Full inventory/evidence suite | `14/14` pass in 166 seconds |
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

## Fresh Creator Browser Preview

A temporary headless Chrome profile opened the live Preview served by Cocos Creator at
`http://localhost:7456/`. The probe drove production presenter/controller transactions rather
than substituting placeholder screens:

1. Boot reached `MainMenuRoot`; Crazy preparation reported `ready`.
2. Main Menu committed to `ModeSelectRoot`.
3. Mode Select committed mode `1` to `CrazyModeRoot`.
4. Crazy crossed from `intro` to `running`.
5. Pause, Resume, and Replay completed against the active Crazy owner.
6. Pause Quit committed back to `MainMenuRoot`.

The fresh run recorded zero page exceptions and zero console errors. The temporary profile
contained the reversible mode-unlock fixture only for this run and was deleted afterward.

## Remaining Release Gates

- Produce and audit a real Creator Android build artifact.
- Pin and validate exact electric contact-count/direction behavior against the selected backend.
- Complete remaining scene/prefab consumers and modes `2` through `5`.
- Complete release-rights review for recovered art, audio, fonts, name, and trademarks.

These are release/full-restoration gates, not blockers for committing the production Crazy
checkpoint.

## Unresolved Questions

None for the Crazy checkpoint. Classic Bird is the next implementation boundary.
