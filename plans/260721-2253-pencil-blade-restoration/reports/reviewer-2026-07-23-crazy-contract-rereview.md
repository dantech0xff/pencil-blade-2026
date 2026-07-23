# Code Review: Crazy Mode Contract Re-review

Date: 2026-07-23
Review type: independent clean-room static contract re-review
Decision: **PASS**
Resource checkpoint: **AMBER**
Evidence policy: static-only

## Summary

The sole Medium finding from the first re-review is resolved. The cited native report now
consistently identifies the early `ActionGoCallback` operation as removal of the stored `GO`
child with cleanup. It retains only the original source-level wrapper spelling as unknown.

The Crazy contract is promoted to an independently reviewed static contract. This decision
does not make the Crazy resource checkpoint GREEN, complete Phase 4, authorize Phase 6, or
claim identity with an executed original runtime.

## Scope

- `forensics/contracts/crazy-mode-contract.md`
- `forensics/native/function-map.csv`
- `forensics/contracts/classic-toss-contract.md`
- `forensics/contracts/classic-time-state-contract.md`
- `forensics/contracts/classic-cut-score-contract.md`
- `forensics/contracts/classic-physics-contract.md`
- `forensics/contracts/classic-presentation-contract.md`
- `forensics/contracts/mode-select-presentation-contract.md`
- `reports/researcher-2026-07-23-crazy-native-contract.md`
- `reports/researcher-2026-07-23-crazy-resource-map.md`
- `reports/reviewer-2026-07-23-crazy-mode-contract.md`
- focused Crazy and shared-TimeManager tests as corroboration only

The APK and `libgame.so` were not installed, loaded, linked, translated, emulated, or
executed during this review.

## Prior Finding Closure

| Finding | Verdict | Evidence |
|---|---|---|
| H1: intro geometry and timing | PASS | Contract lines 129-145 use half-width margins, concurrent `0.25 / 0.5 / 0.25` tracks, and a nominal `2.0s` gate. Acceptance item 4 requires the same values. |
| H2: `b3` and `ae` upper limits | PASS | Contract line 111 specifies bomb Wave `[15,35]`; line 114 specifies magnet FreeToss `[20,45]`. |
| M1: invalid resource denominator | PASS with AMBER retained | Resource report lines 9-30 exclude the six Classic-only logical paths, withdraw the `70 / 86` figures, assert no replacement numeric denominator, and set the checkpoint to AMBER. Lines 203-211 repeat that gate explicitly. |
| M2: child-removal wording | PASS | Native report lines 13, 19, 91-93, and 177 now agree that remove-child-with-cleanup is recovered and only the source wrapper spelling is unknown. Contract lines 427-429 preserve the same boundary. |

## Behavioral Gate

No contradiction remains in the reviewed CrazyMode contract:

- scene construction and eleven-controller attachment order;
- exact GO start order and deliberate omission of `DoubleToss`;
- `60.0s` TimeManager construction, callback order, start, freeze, expiry, and delayed finish;
- IDs `10...14`, effect-before-score ordering, and double-score flush behavior;
- non-terminal fruit/bonus misses and Crazy bomb handling;
- magnet limit mutation and bomb pause/resume without threshold resampling;
- immediate time-up stop order, including the retained active `DoubleToss`/`BonusToss` quirk;
- completed-run Result score, mode `1`, ranking, float32 `0.6` reward, and signed-int32 coin addition;
- fresh Crazy Retry and same-parent Main Menu navigation.

The electric-contact layout conflict remains an explicit safety adaptation. No unsafe native
pointer reinterpretation is authorized.

## Two-Pass Review

Pre-Landing Review: No issues found.

- Critical pass: no trust-boundary, data-loss, concurrency, or evidence-integrity blocker.
- Informational pass: no remaining High, Medium, or Low finding in the reviewed contract package.

## Verification

Fresh focused command:

```text
node --test tests/reconstruction/vertical-slice/crazy-mode-domain.test.ts tests/reconstruction/vertical-slice/crazy-intro-presentation.test.ts tests/reconstruction/vertical-slice/crazy-resource-contract.test.ts tests/reconstruction/vertical-slice/crazy-result-ranking.test.ts tests/reconstruction/vertical-slice/crazy-result-navigation.test.ts tests/reconstruction/vertical-slice/time-manager-service.test.ts tests/reconstruction/vertical-slice/crazy-toss-coordinator.test.ts
```

Result: `46` tests, `46` passed, `0` failed, `0` skipped. Node emitted only the existing
`MODULE_TYPELESS_PACKAGE_JSON` warnings. These tests prove internal contract consistency, not
original-runtime identity.

## Promotion Boundary

- Contract status: independently reviewed static contract.
- Crazy gameplay/native module contract: implementation-ready from static evidence.
- Crazy resource checkpoint: **AMBER** until the exact remaining per-path consumer map is complete.
- Mode Select Crazy route: remains fail-closed until the complete Creator runtime prepares.
- Phase 4 and Phase 6: no completion claim.

## Metrics

- Critical findings: `0`
- High findings: `0`
- Medium findings: `0`
- Low findings: `0`
- Focused tests: `46 / 46`
- Type coverage: not applicable to this documentation-only re-review
- Lint issues: not measured; no source-code change

## Unresolved Questions

- What was the original source-level wrapper spelling for the recovered remove-child-with-cleanup
  operation at virtual slot `+0xE8`?
- What human-readable names correspond to Crazy objective event pairs?
- What is the exact per-path consumer map for the remaining shared Crazy result, presentation,
  and audio dependencies?
- What was the player-visible consequence of the unsafe original electric contact layout?
