---
role: implementer
date: 2026-07-24
scope: gn-style-runtime
status: complete
---

# GN Style Runtime

## Summary

GN Style is implemented as the independent mode-2 production route in the static-only
Cocos Creator 3.8.8 project. It uses no original APK/native runtime at execution time.

The checkpoint passes `1151/1151` vertical-slice tests, `43/43` script/resource tests,
strict Creator TypeScript, and diff hygiene. Fresh Browser Preview completes entry,
gameplay, pause/replay/quit, repeated entry, natural Result, Retry, and Menu with zero
application/runtime errors.

## Production Contract

- Mode `2`; standard four-slot BasicBlade; ordinary fruit only.
- Exact `150`-second Free/Wave/Concurrent graph and `2.60`-second intro.
- Only outer toss schedulers stop at Time Up. Input, physics, entities, score, combo, and an
  armed Wave child remain live through the three-second late-cut window.
- Dedicated non-looping `Sounds/GangnamStyle.mp3`, mutually exclusive with shared background
  music and transactionally paused/resumed/stopped.
- Exact 439 source-ordered particle parents generated from the pinned native evidence artifact:
  `223/128/32/30/17/9` across the six recovered families.
- Objective selector `6` uses payloads `0/1/2`; the completed Result dispatch uses selector
  `2` exactly once.
- Ranking keys are `gnstyle_best_1..3`; reward is float32 `score * 0.6`, truncation toward zero,
  then signed-int32 accounting.
- Replay, Retry, Pause Quit, Result Menu, activation failure, and stale navigation preserve
  one current screen and explicit rollback/fatal ownership.
- Missing/corrupt/unreadable save defaults to `999999` coins; a valid persisted balance wins
  and normal unlock costs/rewards remain active.

## Evidence And Resource Pipeline

- `forensics/contracts/gn-style-mode-contract.md` records the clean-room contract.
- `forensics/native/gn-style-particle-choreography.json` pins the exact 439-call artifact.
- `scripts/extract-gn-style-particle-choreography.mjs` validates function bounds, call count,
  hashes, tuples, and generated TypeScript.
- Both resolution trees retain the exact intro rasters, six particle-family rasters, music,
  shared fonts, and ordinary gameplay resources.
- `classic.scene` serializes passive GN scene/gameplay components beside the persistent shell.

## Preview Defect Found And Fixed

Mode Select cut correctly reached GN activation, but the transaction rolled back because the
intro presenter required `activeInHierarchy` during detached construction. Cocos keeps the
transactional mode root locally active but outside the scene hierarchy at that boundary.

`GnStyleIntroPresenter.attach()` now accepts a valid locally active parent. `activate()` still
requires hierarchy ownership after the shell commits the screen. A regression proves detached
attachment succeeds and premature activation fails. Creator's stale packed chunk was explicitly
reimported before the successful Preview run.

## Validation

| Gate | Result |
|---|---:|
| Full vertical slice | `1151/1151` pass |
| `tests/*.mjs` | `43/43` pass |
| Creator 3.8.8 bundled strict TypeScript | exit `0`; no diagnostics |
| `git diff --check` | exit `0`; no findings |
| Creator metadata | zero structural errors; zero duplicate UUIDs |
| Fresh Creator Browser Preview | full GN lifecycle pass; zero application/runtime errors |

The metadata audit remains `fidelity-blocked` only because preserved
`Fonts/CooperBlackStd.otf` is not a supported Creator Font consumer.

## Remaining Gates

- Full cosmetics, progression/save schema, menus/settings, and global asset-consumer mapping.
- Complete scene/prefab coverage and deterministic Physics2D equivalence checks.
- Real Creator Android build plus APK/AAB audit.
- Rights clearance for art, music, fonts, name, and trademarks.

## Unresolved Questions

- Redistribution rights for `GangnamStyle.mp3`, original art, fonts, and product identity.
- Canonical sample-project resource root and final `99%` fidelity denominator.

Status: DONE
Summary: GN Style mode 2 is integrated, regression-tested, and Preview-verified across its
full transactional lifecycle.
Concerns/Blockers: Global fidelity, Android build, and release-rights gates remain outside this
gameplay-route checkpoint.
