---
role: tester
date: 2026-07-24
scope: combo-bird-final-checkpoint
status: pass
---

# Combo Bird Final Checkpoint

## Summary

The production Combo Bird checkpoint passes its focused, full vertical-slice,
resource/build/catalog, strict Creator TypeScript, diff, independent-review, and live Browser
Preview gates. The route is mode `5`, independent from Crazy, and uses BirdBlade type `3`, the
exact resource closure, a `90s` timer, and the ordinary-only toss graph.

No original APK, native library, or original gameplay runtime was executed or compared.

## Automated Gates

| Gate | Result |
|---|---:|
| Combo Bird focused suite | `70/70` pass in `734.5515ms` |
| Full deterministic vertical slice | `1030/1030` pass in `6643.3835ms` |
| Resource/build/catalog suite | `38/38` pass in `16347.872ms` |
| Cocos Creator 3.8.8 bundled strict TypeScript | exit `0`; 0 diagnostics |
| `git diff --check` | exit `0`; no findings |
| Independent controller review | no Critical/High/Medium findings |
| Prior full inventory/evidence workflow | `14/14` pass in `217s`; unchanged staging/resource corpus |

Commands:

```sh
node --test tests/reconstruction/vertical-slice/combo-bird-*.test.ts
node --test tests/reconstruction/vertical-slice/*.test.ts
node --test tests/*.mjs
node /Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js \
  -p game/tsconfig.json --pretty false --noEmit
git diff --check
```

## Live Creator Browser Preview

The final Cocos Creator 3.8.8 Browser Preview drove the production route:

1. Main Menu committed to Mode Select.
2. Mode Select committed Combo Bird to live gameplay.
3. The live timer displayed `1:30`.
4. Pause and Resume completed.
5. Pause Replay installed a fresh run and reset the timer.
6. Pause Quit returned to Main Menu.

Cocos console counters were `0/0/0/0`.

## Defect Regression

Preview found the pause presenter attached to a detached, inactive
`ComboBirdModeRoot`. The fix moved pause initialization after current-screen attachment for
initial activation and after current-screen replacement for Pause Replay.

Regression checks now require:

- detached mode construction to omit pause initialization;
- initial activation to attach and verify the current screen before pause initialization; and
- Pause Replay to replace and verify the fresh screen before pause initialization.

The final Preview flow above passed after this correction.

## Contract Coverage

- Dedicated mode-5 session and controllers remain independent from Crazy.
- BirdBlade type `3` and exact Combo Bird supplemental resources fail closed on contract
  mismatches.
- Only ordinary Free, Wave, and Concurrent tosses can spawn.
- Objective, intro, pause, Result ranking, float32 `0.8` reward, replay/retry, and menu
  lifecycles are covered.
- Screen/session transitions are transactional and preserve one current screen and active
  owner.
- Shared save fallback remains `999999` coins only for missing or corrupt data; valid
  persisted balances win.

## Remaining Release Gates

- Implement GN Style mode `2`.
- Produce and audit a real Creator Android build artifact and complete broader build/resource
  release checks.
- Complete the release-rights review for recovered assets, fonts, audio, name, and trademarks.

These are full-restoration or release gates, not blockers for the verified Combo Bird
checkpoint.

## Unresolved Questions

None for the target checkpoint. Original-runtime comparison remains intentionally unavailable,
including the native low-resolution alias mechanism for the recovered
`text-juscombo.png`/`text-justcombo.png` mismatch.

Status: DONE
Summary: Combo Bird passed the final automated and Browser Preview checkpoint, including the
post-fix pause/replay ownership ordering.
Concerns/Blockers: GN Style mode 2 plus real build, broader resource, and release-rights gates
remain outside this checkpoint.
