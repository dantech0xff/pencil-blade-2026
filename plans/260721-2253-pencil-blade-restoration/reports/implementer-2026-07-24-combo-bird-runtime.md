---
role: implementer
date: 2026-07-24
scope: combo-bird-runtime
status: complete
---

# Combo Bird Runtime

## Summary

Combo Bird is implemented as the independent mode-5 production route in the static-only
Cocos Creator 3.8.8 TypeScript project. The final checkpoint passed `70/70` Combo Bird tests,
`1030/1030` full vertical-slice tests, `38/38` resource/build/catalog checks, strict Creator
TypeScript with zero diagnostics, and `git diff --check`. Independent controller review found
no Critical, High, or Medium findings.

No original APK, native library, or original gameplay runtime was executed or compared.

## Production Architecture

- Combo Bird has dedicated session, toss, scene, gameplay, intro, resource, ranking, and
  navigation owners. It does not extend the Crazy mode profile or depend on Crazy readiness.
- Mode identity is exactly `5`. BirdBlade uses type `3` and its exact selected-profile
  resource closure.
- The toss graph contains only the recovered ordinary-fruit Free, Wave, and Concurrent
  controllers. It constructs no bomb, special, bonus, dragon, electric, magnet, or
  double-toss behavior.
- The recovered intro leads into a `90s` timer. Objective events, pause/resume, TIME UP,
  Result, rank, reward, replay/retry, and menu transitions are integrated.
- Result persistence uses `bird_combo_best_1..3`; rewards use the recovered float32 `0.8`
  factor.
- Screen and session ownership is transactional. Activation, replay, retry, Result, Pause
  Quit, and Main Menu transitions retain one current screen and one active Bird input owner,
  with rollback or a typed fatal boundary on failure.
- Missing, corrupt, or unreadable shared save data still falls back to `999999` coins. A
  valid persisted balance takes precedence.

## Preview Defect Found And Fixed

Live Browser Preview exposed a real ownership-order defect: the pause presenter was attached
while `ComboBirdModeRoot` was still detached and inactive, so the active run did not expose
working pause UI.

Initialization now occurs only after:

1. activation attaches `ComboBirdModeRoot` as the current screen; and
2. Pause Replay replaces the current screen with the fresh run root.

Source-order regressions assert both boundaries and assert that detached construction does not
initialize pause presentation.

## Creator Browser Preview

The post-fix Cocos Creator 3.8.8 Browser Preview completed:

1. Main Menu
2. Mode Select
3. Combo Bird
4. live mode-5 gameplay with the `1:30` timer
5. Pause and Resume
6. Pause Replay, with the timer reset
7. Pause Quit
8. Main Menu

Cocos console counters were `0/0/0/0`.

## Validation

| Check | Result |
|---|---:|
| `node --test tests/reconstruction/vertical-slice/combo-bird-*.test.ts` | `70/70` pass in `734.5515ms` |
| `node --test tests/reconstruction/vertical-slice/*.test.ts` | `1030/1030` pass in `6643.3835ms` |
| `node --test tests/*.mjs` | `38/38` pass in `16347.872ms` |
| Creator 3.8.8 bundled `tsc -p game/tsconfig.json --pretty false --noEmit` | exit `0`; 0 diagnostics |
| `git diff --check` | exit `0`; no findings |
| Independent controller review | no Critical/High/Medium findings |
| Prior full inventory/evidence workflow | `14/14` pass in `217s`; still applicable because the staging/resource corpus did not change |

## Remaining Gates And Recommendation

- Implement GN Style mode `2`.
- Produce and audit a real Creator Android build artifact and complete the broader
  build/resource release gates.
- Complete the rights review for recovered art, audio, fonts, product name, and trademarks.
- Keep original-runtime behavior outside the claim boundary. The low-resolution native alias
  mechanism for `text-juscombo.png` remains unknown; the target resolves the exact
  per-resolution files explicitly.

## Unresolved Questions

None blocking the Combo Bird checkpoint. The original low-resolution alias mechanism remains
unknown because the original runtime was not executed.

Status: DONE
Summary: Combo Bird mode 5 is implemented, Preview-verified after the pause ownership fix, and
passes the final focused, full-suite, resource/build/catalog, TypeScript, diff, and review gates.
Concerns/Blockers: GN Style mode 2 plus real build, broader resource, and release-rights gates
remain outside this checkpoint.
