---
role: tester
date: 2026-07-24
scope: gn-style-final-checkpoint
status: pass
---

# GN Style Final Checkpoint

## Summary

The production GN Style checkpoint passes deterministic regressions, extractor/resource tests,
strict Creator TypeScript, diff hygiene, scene serialization, and a fresh Cocos Creator 3.8.8
Browser Preview. No original APK or native gameplay runtime was executed.

## Automated Gates

| Gate | Result |
|---|---:|
| `node --experimental-strip-types --test tests/reconstruction/vertical-slice/gn-style-gameplay-controller.test.ts` | `26/26` pass, including eleven executable lifecycle/fault-injection cases |
| `node --experimental-strip-types --test tests/reconstruction/vertical-slice/*.test.ts` | `1151/1151` pass |
| `node --test tests/*.mjs` | `43/43` pass |
| Creator bundled `tsc --noEmit --pretty false -p game/tsconfig.json` | exit `0`; no diagnostics |
| `git diff --check` | exit `0`; no findings |
| Creator resource metadata audit | zero structural errors; zero duplicate UUIDs |

The metadata command returns the expected `fidelity-blocked` status because
`Fonts/CooperBlackStd.otf` is preserved but unsupported as a Creator Font consumer. This is a
global fidelity gate, not a GN runtime regression.

Node emitted `MODULE_TYPELESS_PACKAGE_JSON` warnings for several TypeScript modules. Tests
still passed and no runtime failure was hidden.

## Browser Preview

Fresh Preview exercised:

1. Main Menu → Mode Select → unlocked GN Style.
2. Exact three-card → `150 SEC!` → `GOOD LUCK!` intro.
3. Live non-looping music, ordinary-fruit spawning, 439-parent particle choreography,
   standard blade cuts, and score updates.
4. Pause held timer/particles; Resume continued them.
5. Pause Replay installed a fresh score-0, time-150 run.
6. Pause Quit returned to Main Menu and stopped GN audio.
7. Re-entry succeeded without stale input/physics/music ownership.
8. Natural Time Up reached Result after the late-cut tail.
9. Result Retry installed a fresh run.
10. A second natural Result used Result Menu to return to Main Menu.

After clearing pre-existing console output and rerunning the entry/quit smoke, DevTools showed
zero game/application runtime errors. One `chrome-extension://.../share-modal.js` error belongs
to the user's Chrome extension and is outside the Preview.

## Defect Regression

The initial Preview bundle rejected detached intro attachment because it used
`parent.activeInHierarchy`. The fixed contract accepts a locally active detached screen during
construction, then retains the hierarchy-active guard at intro activation after screen commit.
The regression test covers both boundaries. Creator reimport regenerated the packed chunk with
the corrected guard.

Final review also found that the central GN controller transactions were asserted only by source
shape. Eleven executable tests now compile and invoke the production method bodies against
fault-injected ownership probes. They cover Pause Replay, Pause Quit, Time Up to Result, Result
Retry, and Result Menu, including commit irreversibility, rollback/fatal retention, fresh
input/physics ownership, exact-once ranking/objective effects, and music/particle cleanup.

## Contract Coverage

- Exact mode identity, intro timing, timer, toss graph, objectives, late-cut window, and result.
- Exact choreography cardinality/order/hash and six family counts.
- Dedicated music start/pause/resume/stop and shared-music exclusion.
- Signed-int32 leaderboard/reward/accounting and `999999` missing/corrupt-save default.
- Activation, Replay, Retry, Pause Quit, Result Menu, stale request, rollback, fatal ownership,
  and teardown paths.

## Unresolved Questions

None for the GN gameplay checkpoint. Global Physics2D equivalence, full consumer coverage,
Android artifact validation, and rights remain separate gates.

Status: DONE
Summary: GN Style passed `1151/1151` vertical-slice tests, `43/43` script tests, strict
TypeScript, metadata structure/UUID checks, diff hygiene, and full Browser Preview lifecycle.
Concerns/Blockers: Preserved unsupported font metadata and release/build/global-fidelity work
remain outside this route checkpoint.
