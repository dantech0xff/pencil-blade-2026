# Leaderboard runtime checkpoint

## Summary
Implemented the Leaderboard checkpoint as the exact six-board local/offline read-only screen in native order: Classic, Crazy, Gangnam Style, Classic Bird, Crazy Bird, Combo Bird.

Source evidence:
- [Leaderboard native contract](./researcher-2026-07-24-leaderboard-native-contract.md)
- [Leaderboard architecture map](./explorer-2026-07-24-leaderboard-architecture-map.md)

## Implementation behavior
- The screen snapshots process-owned Settings once and preserves native board order.
- It performs no ranking, mutation, load/save, network, JNI/platform, particles, or RNG.
- Main Menu target ID `13` waits `0.75s` before the Leaderboard handoff.
- Back returns immediately to a fresh Main Menu.
- The Back click is effects-gated and runs only after the destination commit succeeds.
- Reversible shell failures rearm the same screen, rail, and input state.
- Fatal cleanup releases ambiguous foreground ownership, disposes best effort, and leaves the shell failed.
- Post-commit click failure cannot roll back committed navigation.

## Validation
- Focused Main Menu + Leaderboard + shell/viewport tests: `139/139`.
- Full vertical-slice tests: `1354/1354`.
- Resource/build tests: `43/43`.
- Creator 3.8.8 bundled strict TypeScript: zero diagnostics.
- `git diff --check`: clean.
- Creator Preview passes physical cut entry, aligned labels/scores, drag/flick board selection,
  and Back in the internal compact `480x800` branch and high `720x1280` profile.

## Remaining gaps or Unresolved questions
- Objectives is the next open shared-contract surface.
- Broader staged-resource consumer reconciliation remains unresolved for the Leaderboard subset.
- No unresolved question remains inside the Leaderboard checkpoint.

## Status
Status: DONE
