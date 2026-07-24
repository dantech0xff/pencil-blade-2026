# Leaderboard Runtime Production Review

## Result

**READY.** No remaining P0, P1, or P2 finding in the Leaderboard checkpoint.

The review used static native/resource evidence only. The original APK was not executed or
embedded.

## Findings Resolved

1. Shell rollback originally restored the source root without proving that its input/listener
   lease could be rearmed. Compensation now treats source rearm as a checked rollback
   postcondition. A false/throwing rearm or poisoned source detaches screen ownership, disposes
   both presenters best-effort, clears active pointers, and moves the shell to `failed`.
2. Creator `Label.lineHeight` originally retained the engine default instead of the recovered
   30/40 and 45/60 point sizes. Runtime creation now sets `lineHeight = fontSize`.
3. Creator Preview exposed a coordinate-adapter defect not represented by the first test stub:
   recovered label positions are native child coordinates inside a center-anchored template.
   The presenter now subtracts the template anchor offset before assigning Creator-local
   positions. Exact compact/high converted coordinates are executable assertions.

## Contract Review

- Six local, read-only boards remain in native order: Classic, Crazy, GN Style, Classic Bird,
  Crazy Bird, Combo Bird.
- Board values are snapshotted once at construction. The effects flag is read only after a
  successful Back commit.
- The rail preserves float32 drag, retained-segment flick, one-frame snap, and index clamping.
- Main Menu enters by the recovered delayed fruit route. Back and mobile Back share one
  immediate transaction and post-commit click boundary.
- The exact closure is ten rasters, `Fonts/Andyb.ttf`, `Fonts/Century.ttf`, and the shared
  `Sounds/menubuttonclick.wav`.
- No Leaderboard-owned save, mutation, network, authentication, platform ranking, raycast,
  blade rendering, particle, or RNG path exists.

## Verification

| Gate | Result |
|---|---|
| Focused Leaderboard/Main Menu/shell/viewport suite | `139/139` passed |
| Full vertical-slice suite | `1354/1354` passed |
| Resource/build/catalog suite | `43/43` passed |
| Creator 3.8.8 strict TypeScript | passed; zero diagnostics |
| `git diff --check` | passed |

Independent review found the first two lifecycle/layout blockers and cleared the updated
transaction implementation. The final coordinate conversion was then checked against the
native report formulas, focused assertions, strict TypeScript, the full suite, and live Creator
rendering.

## Preview

- Compact preset, internal `480x800` branch: exact art/fonts render; labels and scores align;
  physical cut opens Leaderboard; physical swipe changes board; Back returns to Main Menu.
- High design profile `720x1280`: the same checks pass with the recovered high assets and
  45/60-point labels.
- Expected recovered overflow remains visible where native assets exceed the design width;
  no label leakage into the top/right margins remains.

## Resource Reconciliation

The Leaderboard subset has complete consumer mapping. This does not change the unresolved
global staged-resource consumer reconciliation and does not justify a global percentage.

## Unresolved Questions

None for this checkpoint.
