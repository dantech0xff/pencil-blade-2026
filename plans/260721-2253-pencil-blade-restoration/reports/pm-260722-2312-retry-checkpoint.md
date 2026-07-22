# PM Status - Retry/enable_effect Checkpoint - 2026-07-22

## Scope

Assess progress for the finalized same-parent Classic Retry + `enable_effect` checkpoint
against the restoration plan, phase specs, contract map, and current git diff.

## Plan Progress

| Phase | Todo done | Todo total | Progress | Spec status |
|---|---:|---:|---:|---|
| 1 Preserve evidence | 11 | 12 | 91.7% | in progress |
| 2 Static corpus | 13 | 14 | 92.9% | in progress |
| 3 Presentation | 8 | 21 | 38.1% | in progress |
| 4 Gameplay contracts | 7 | 18 | 38.9% | in progress |
| 5 Creator vertical slice | 5 | 16 | 31.3% | in progress |
| 6 Full game content | 0 | 13 | 0.0% | pending |
| 7 Fidelity/release | 0 | 14 | 0.0% | pending |

Overall checklist: 44 / 108 = 40.7%.

## What Actually Moved

- New contract file: `game/assets/scripts/domain/classic-result-navigation.ts`
- New tests: `tests/reconstruction/vertical-slice/classic-result-navigation.test.ts`,
  `tests/reconstruction/vertical-slice/classic-scene-restart.test.ts`
- Updated runtime boundary: `classic-gameplay-controller.ts`
  now routes result navigation through a captured-parent replacement flow instead of
  scene reload.
- Updated scene lifecycle: `classic-scene-controller.ts` now restores a fresh Classic layer
  from the recovered result boundary and resets fresh-layer blade state.
- Updated settings path: `classic-settings-state.ts`, `classic-settings-runtime.ts`, and
  related presenter tests now include canonical lowercase boolean persistence for
  `enable_effect`.
- Updated attachment tests: fail HUD and score HUD presenters now accept detached-active
  parent construction for the same-parent replacement boundary.

## Evidence Check

- Repo docs still record the key runtime evidence already reached:
  - `phase-05` foundation report documents a `720x1280` Preview pass, zero Creator console
    errors, exact `GOOD / LUCK!` intro, fail-marker transitions, and the result shell.
  - `phase-05` and `cocos-creator-contract-map.md` both record the current bounded Classic
    slice, the exact result-entry shell, and the remaining same-parent Retry gap that this
    checkpoint is closing.
  - `phase-05` validation still reports `220/220` deterministic vertical-slice tests and
    Creator strict TypeScript passing.
- Current git status shows only the intended working set plus the new navigation file/tests;
  no plan or docs edits were made.

## Phase Readout

- Phase 5 is still the active phase and is not complete.
- The new retry/navigation work closes one open Phase 5 seam, but the phase still has
  multiple blockers: Android toolchain pin, final serialized-component map, full Classic
  vertical slice, and the automated contract/traceability audit.
- Phase 6 and Phase 7 remain untouched; their checklists are still fully open.

## Stale Material

- The historical `phase-05-2026-07-22-foundation-progress.md` snapshot is now stale as a
  progress snapshot only; it predates the retry-navigation/effects-boolean checkpoint.
- No current phase checkbox is falsely marked complete from this checkpoint.

## Next Highest-Priority Checkpoint

1. Finish the remaining Phase 5 gate: final scene/prefab/component map plus the automated
   contract/prohibited-runtime audit, then re-evaluate whether the Classic slice is actually
   closeable.
2. Backfill any missing integration coverage around `enable_effect` persistence and the
   same-parent main-menu route so the result-navigation contract is symmetric.

## Unresolved Questions

- Which Android SDK / NDK / JDK / Gradle / ABI pin is the final Phase 5 target?
- Does the same-parent main-menu route need additional persistence or cleanup coverage beyond
  the recovered retry path?
- Is any legacy phase-05 snapshot expected to be updated, or should it remain historical only?
