# First-Launch Flag Contract

Status: DONE_WITH_CONCERNS
Summary: the recovered first-launch behavior is an in-memory app-shell gate, not a separate persisted save field; the only persisted sentinel tied to launch is `network_available`.
Concerns/Blockers: the original native naming for the launch gate is not fully recovered, so the report distinguishes recovered storage behavior from inferred runtime semantics.

## Scope

Read-only static research for the remaining first-launch `flag` contract. No APK or native binary was executed.

## Findings

### Recovered

- `network_available` is a real persisted settings key, declared in `ClassicSettingsState` alongside `rated` and the cosmetic/economy keys ([`game/assets/scripts/domain/classic-settings-state.ts:108-111`](../../../../game/assets/scripts/domain/classic-settings-state.ts#L108-L111)).
- The recovered default state sets `networkAvailable: false` and `rated: false` ([`game/assets/scripts/domain/classic-settings-state.ts:263-277`](../../../../game/assets/scripts/domain/classic-settings-state.ts#L263-L277)).
- The recovered load order reads `network_available` with a false default, after all 50 integer fields and before `rated` ([`game/assets/scripts/domain/classic-settings-state.ts:288-336`](../../../../game/assets/scripts/domain/classic-settings-state.ts#L288-L336)).
- The recovered save path always writes `network_available = false`, then writes `rated` from memory ([`game/assets/scripts/domain/classic-settings-state.ts:633-709`](../../../../game/assets/scripts/domain/classic-settings-state.ts#L633-L709)).
- The Creator runtime adapter preserves that behavior and documents the sentinel explicitly as the launch value, not the in-memory value ([`game/assets/scripts/creator/classic-settings-runtime.ts:108-236`](../../../../game/assets/scripts/creator/classic-settings-runtime.ts#L108-L236)).
- Main Menu review behavior consumes `networkAvailable && !rated` to decide whether to award the review reward and persist the rated flag ([`game/assets/scripts/domain/main-menu-state.ts:261-360`](../../../../game/assets/scripts/domain/main-menu-state.ts#L261-L360)).
- The app-shell runtime has a separate in-memory first-launch gate, `initialClassicRuntimeActivated`, which allows the first activation only from `intro` and later re-entry only after `result-removed` ([`game/assets/scripts/creator/classic-gameplay-controller.ts:400-478`](../../../../game/assets/scripts/creator/classic-gameplay-controller.ts#L400-L478)).

### Inferred

- The legacy `network_available` preference is best understood as a launch hand-off sentinel:
  - Java writes it `true` on launch only after a connectivity check (`forensics/native/java-jni-boundary.md:51`).
  - SaveData writes it `false` on save, so the persisted value does not mean durable online state (`forensics/native/java-jni-boundary.md:161-165`).
  - The native docs explicitly describe this as a hand-off/sentinel rather than proof of connectivity (`forensics/native/java-jni-boundary.md:164-165`).
- The app-shell first-launch boundary is represented in Creator by `initialClassicRuntimeActivated`, not by a separate persisted `flag` key. The matching test labels this as sharing the first-launch boundary with the legacy API ([`tests/reconstruction/vertical-slice/classic-app-shell-boundary.test.ts:86-147`](../../../../tests/reconstruction/vertical-slice/classic-app-shell-boundary.test.ts#L86-L147)).

### Unknown

- The exact original native semantic name for the app-shell first-launch gate is not recovered.
- No evidence here proves there was ever a dedicated persisted `flag` key distinct from `network_available`.
- Runtime timing of the Java launch connectivity check remains outside static evidence.

## Production Impact

No production code change is required for the current recovered contract.

- The settings schema already covers the persisted sentinel behavior.
- The app-shell already models first launch with an in-memory activation gate.
- The remaining work is documentation/contract alignment, not new storage behavior.

If product intent is to add a brand-new persisted first-launch field separate from `network_available`, that would require a schema migration, save/load tests, and a concrete consumer contract. The current evidence does not justify that change.

## Implementation / Test Map

If this needs future code work, the narrow touch points are:

1. `game/assets/scripts/domain/classic-settings-state.ts` for storage contract changes.
2. `game/assets/scripts/creator/classic-settings-runtime.ts` for persistence adapter changes.
3. `game/assets/scripts/creator/classic-gameplay-controller.ts` for first-launch activation behavior.
4. `tests/reconstruction/vertical-slice/classic-settings-state.test.ts` and `tests/reconstruction/vertical-slice/classic-settings-runtime.test.ts` for schema and runtime coverage.
5. `tests/reconstruction/vertical-slice/classic-app-shell-boundary.test.ts` for the first-launch activation boundary.

## Evidence Notes

- `ClassicSettingsState.load()` uses the recovered 50-int/4-boolean order and defaults.
- `ClassicSettingsState.save()` always writes `network_available = false`.
- `ClassicSettingsRuntime.persistRatedFlag()` is the separate immediate review reward path.
- `MainMenuState.reviewCommands()` is the consumer that depends on both `networkAvailable` and `rated`.
- `initialClassicRuntimeActivated` is a runtime lifecycle gate, not a persisted setting.

## Unresolved Questions

- Whether the original APK had any additional first-launch-only preference outside the recovered `network_available` sentinel.
- Whether the Java-side launch connectivity check was always reliable enough to be treated as a user-visible capability gate.
- Whether future product work wants a new explicit persisted launch flag, or just the current sentinel plus runtime gate.
