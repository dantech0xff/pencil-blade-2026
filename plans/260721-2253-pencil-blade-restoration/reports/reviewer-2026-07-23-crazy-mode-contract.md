# Code Review: Crazy Mode Contract

Date: 2026-07-23
Review type: independent clean-room contract audit
Decision: **CHANGES REQUIRED**
Evidence policy: static-only; `libgame.so` was disassembled but never loaded, linked, translated,
emulated, or executed

## Code Review Summary

### Scope

- Primary artifact: `forensics/contracts/crazy-mode-contract.md`
- Shared contracts: Classic toss, time/state, cut/score, physics, and presentation
- Evidence indexes: `forensics/native/function-map.csv`
- Supporting reports:
  - `researcher-2026-07-23-crazy-native-contract.md`
  - `researcher-2026-07-23-crazy-resource-map.md`
- Immutable native evidence:
  `.forensics-work/phase-01/native/libgame.so`,
  SHA-256 `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`
- Reviewed text: 4,059 lines across the primary contract, five shared contracts, symbol map,
  and two evidence reports
- Focus: exact construction/start/time-up order and parameters; intro geometry/timing;
  FruitCut/score dispatch; bomb/magnet/freeze behavior; TimeManager binding; Result mode,
  ranking, reward, Retry/Menu; resource-evidence sufficiency
- Scout findings: the two intro tracks share constants but not those stated by the contract;
  two toss constructors retain a wider high limit than the table states; the resource report
  imports Classic-only presentation assets into Crazy's claimed consumer denominator

### Overall Assessment

The contract is not implementation-ready. Most of its lifecycle, dispatch, timer, and Result
ordering is body-verified, but two high-severity parameter errors would make a deterministic
Creator port visibly and behaviorally diverge from the static native evidence. The contract's
acceptance suite currently requires the incorrect intro duration, so tests written from it would
institutionalize the defect.

No Critical trust-boundary, data-loss, authorization, or secret-exposure issue was found. The
electric-contact safety adaptation is correctly fail-safe. The gate remains blocked by exactness
defects, not by a security issue.

## Pass 1: Blocking Findings

### Critical Issues

None.

### High Priority

#### H1 — Intro geometry and timing are contradicted by both native intro bodies

**Contract:** lines 129-145 and acceptance item 4 at lines 401-402.

The contract specifies:

- initial and final horizontal margins of `0.25 * spriteWidth`;
- `0.5s` enter, `0.5s` delay, and `0.5s` exit/fade actions;
- a nominal `3.0s` gate for `60s` followed by `GO`.

Static disassembly proves:

- the multiplier at `0x0014B59E` and `0x0014AFEA` is float32 `0.5`, so each sprite starts at
  `VisibleRect.left.x - 0.5 * spriteWidth` and exits to
  `VisibleRect.right.x + 0.5 * spriteWidth`;
- the MoveTo/FadeIn and MoveTo/FadeOut duration at `0x0014B5D0`, `0x0014B624`,
  `0x0014B648`, `0x0014B65E`, `0x0014B00E`, `0x0014B06E`, `0x0014B08C`, and
  `0x0014B0A2` is float32 `0.25`;
- the intervening delay at `0x0014B5DC`, `0x0014B654`, `0x0014B02A`, and
  `0x0014B098` is float32 `0.5`.

Therefore each card lasts `0.25 + 0.5 + 0.25 = 1.0` action seconds, and the sequential `60s`
then `GO` gate lasts nominally `2.0s`, not `3.0s`.

**Impact:** a port would place both cards too close to the viewport, animate them at half native
speed, delay gameplay start by one action second, and encode the divergence in its acceptance
tests.

**Required correction:** change the geometry to half-width margins; change both concurrent tracks
to `0.25 / 0.5 / 0.25`; change the nominal gate and acceptance test to `2.0s`.

#### H2 — Bomb Wave and magnet FreeToss upper limits are too low

**Contract:** controller table lines 111 and 114; acceptance item 2 at line 399.

Two constructor rows are contradicted by `CrazyModeLayer::onEnter()`:

| Slot | Contract | Native constructor values | Static evidence |
|---|---|---|---|
| `b3`, bomb Wave outer limits | `[15, 30]` | `[15, 35]` | high-limit literal `0x420C0000` (`35.0`) loaded at `0x0014B43A`; create call at `0x0014B44C` |
| `ae`, magnet FreeToss | `[20, 35]` | `[20, 45]` | low literal `0x41A00000` (`20.0`) at `0x0014B4B4`; retained high literal `0x42340000` (`45.0`) loaded at `0x0014B47E`; create call at `0x0014B4B8` |

With the shared decile sampler, the recoverable threshold sets are consequently:

- bomb Wave: `15, 17, ..., 33`, not `15, 16.5, ..., 28.5`;
- magnet FreeToss: `20, 22.5, ..., 42.5`, not `20, 21.5, ..., 33.5`.

**Impact:** the incorrect table materially increases bomb waves and magnet fruit frequency and
changes deterministic RNG-derived thresholds. Tests based on the current contract would pass a
non-fidelity implementation.

**Required correction:** set bomb Wave outer limits to `[15, 35]` and magnet FreeToss limits to
`[20, 45]`, then update construction and seeded-threshold tests.

## Pass 2: Informational Findings

### Medium Priority

#### M1 — The cited Crazy resource denominator contains Classic-only consumers

**Contract:** resource authority at lines 354-372 and resource acceptance item 16 at line 415.
**Resource report:** lines 44-62 and denominator lines 104-121.

The resource report classifies all of the following as proven Crazy gameplay dependencies:

- `Text/text-good.png` and `Text/text-luck.png`;
- `Text/text-game.png` and `Text/text-over.png`;
- `Interfaces/object-x-normal.png` and `Interfaces/object-x-filled.png`.

That classification contradicts the audited Crazy flow:

- Crazy owns the `60s` then `GO` start gate, not the Classic Good/Luck gate;
- Crazy ends through `TimeManager`'s `text-time-up` path and does not run Classic GAME/OVER
  (`crazy-mode-contract.md` lines 278-329);
- Crazy fruit and bonus misses submit objective `(4, 1)` without adding fail markers or
  terminating (`crazy-mode-contract.md` lines 251-257).

The `70 proven transitive dependencies` and `86 canonical paths` figures therefore do not
currently describe a defensible Crazy consumer surface. This does not prove the files are
unavailable; it proves the claimed consumer relationship is wrong.

The same report summarizes normal/special/electric families rather than enumerating every
mandatory path, size, and hash. It does not provide an auditable row for each of the five
special-fruit intact/top/bottom triples required by contract lines 192-202 and 363, despite
acceptance item 16 requiring path/dimension/hash assertions for every consumer.

**Impact:** resource preparation can become overbroad while still failing to prove all mandatory
Crazy-owned assets. The current report cannot support a GREEN resource gate or the exact
resource acceptance test.

**Required correction:** separate `available shared assets` from `proven Crazy consumers`; remove
the six Classic-only rows from the Crazy consumer denominator; enumerate the five special-fruit
triples, BombElectric, and MagnetAnimation resources with manifest path/dimension/hash evidence.
Keep the overall resource checkpoint AMBER until this is complete.

#### M2 — The go-callback child-removal call is observable, not behaviorally unknown

**Contract:** explicit unknown at lines 423-425.
**Native report:** lines 89-95 and open question 1.

`ActionGoCallback` and `Action60sCallback` both call the owning layer's virtual slot `+0xE8` with
the stored child and boolean `1` before advancing. `TimeUpFinishCallback` uses the same slot and
shape to remove Crazy from its parent. The shared Cocos call pattern resolves the observable
operation as remove-child-with-cleanup, which the contract already specifies correctly at lines
143 and 151.

The exact source-level wrapper spelling may remain unknown, but the operation is not an unresolved
behavioral attachment call. Retaining that wording creates evidence debt and invites an
unnecessary abstraction around a known removal operation.

**Required correction:** remove this from behavioral unknowns, or narrow it to “original
source-level wrapper spelling unknown; observable remove-child-with-cleanup behavior recovered.”

### Low Priority

None. Style-only comments were intentionally excluded.

## Verified Contract Matrix

The following high-risk claims matched the static bodies and reviewed shared contracts:

| Area | Verdict | Evidence summary |
|---|---|---|
| Mode identity/replay | verified | `GetGameMode()` returns `1`; replay allocates `0x2E0` and constructs fresh Crazy |
| Scene construction/add order | verified except H2 limits | Base enter, Bonus reset, `(8,0)`, `(4,0)`, eleven controller adds, TimeManager, `60s`, BombElectric, pause init, CrazyBest1 |
| TimeManager binding | verified | `60.0`; target is Crazy; callback arguments bind in exact order freeze-start, freeze-finish, immediate-time-up, time-up-finish at `0x0014B520-0x0014B556` |
| GO start order | verified | remove GO, timer Start, `DisableCut(false)`, then `ab,b0,b2,ac,b1,b3,ad,b5,ae,af`; `b4` absent |
| FruitCut IDs `10...14` | verified | exact effect-before-score order; ID `10` adds no score; IDs `11...14` add `10` |
| Magnet | verified | normal limits mutate to `[0.25,0.5]`; `ac,b1,b3` pause/resume in order; armed thresholds are not resampled |
| Freeze | verified | TimeManager owns repeated/restarted `15.0s` freeze; callbacks set world speed `0.5` then `1.0` |
| Misses/bomb | verified | non-terminal `(4,1)` misses; bomb order is cut disable, base hold, `-10`, double-score disable/flush, `ae` Stop, `(8,1)` |
| Immediate time-up | verified | stop `ab,ad,ae,af,b0,b2,ac,b1,b3`; stop electric; finish double score; `(8,2)`, `(4,2)`; `b4/b5` and cuts remain active |
| Time-up finish | verified | disable cuts, stop effects, mode-1 Result with ScoreManager best score, remove Crazy cleanup, add Result at z `1` |
| Rank/reward | verified | CrazyBest1/2/3 `>=` insertion; float32 `0.6`; float conversion/multiply then truncation; signed-int32 coin addition |
| Retry/Menu | verified | remove Result cleanup; fresh Crazy or Main Menu added to captured parent at z `1`; no settings save/reseed/scene replacement |
| Electric boundary | verified safety concern | native contact layout remains unsafe; type-safe Creator adaptation is mandatory and correctly documented |

## Edge Cases Found by Scout

- **Handled:** `b4` and `b5` are not stopped at immediate time-up and cuts remain enabled until
  the finish callback. The contract explicitly preserves and tests this three-second overlap.
- **Handled:** changing normal-fruit limits during magnet does not rearm its current threshold;
  paused bomb schedulers retain elapsed time and threshold.
- **Handled:** repeated Freeze restarts the shared 15-second hold rather than stacking durations.
- **Handled:** bomb-hit double-score disable flushes the pending bucket before the objective event.
- **Handled as adaptation:** BombElectric's native contact-layout conflict must not be reproduced.
- **Unresolved by resource evidence:** the exact Crazy special-effect consumer inventory is not
  sufficiently enumerated for deterministic preload failure/rollback testing.

## Behavioral Checklist

- [x] Concurrency/shared state: GO ordering, magnet pause/resume, freeze restart, bomb hold, and
  time-up `b4/b5` overlap checked
- [x] Error boundaries: no executable contract error path; Creator fail-closed preparation and
  rollback requirement retained
- [x] API contracts: toss sampler, timer callbacks, score flushing, physics speed, and Result
  assumptions checked against shared callees
- [x] Backwards compatibility: no exported code/schema change in this review; fidelity-impacting
  contract contradictions identified before implementation
- [x] Input validation: no external input surface in the reviewed contract
- [x] Auth/authz: not applicable to this offline local game mode
- [x] Query efficiency: no database/query surface; no N+1 path
- [x] Data leaks: no PII, credentials, secrets, or external stack-trace surface found
- [x] Fact-checking: paths, symbols, offsets, callback order, literals, and phase scope checked
  against repository files and static native evidence

## Recommended Actions

1. Correct H1 intro geometry/timing and its deterministic acceptance test.
2. Correct H2 controller limits and seeded threshold expectations.
3. Reconcile the resource consumer map and provide per-asset evidence for every mandatory
   Crazy-owned special/effect resource.
4. Narrow or remove the obsolete `+0xE8` behavioral unknown.
5. Re-run an independent static review before changing the contract status from draft or opening
   the implementation gate.

## Plan Follow-up

Phase 4's remaining-mode contract task is **not complete** for Crazy while H1 and H2 remain.
Construction, callback order, special dispatch, time-up, and Result recovery appear complete.
Resource mapping remains AMBER. The lead/project manager should update task status only after the
contract corrections and a fresh review; this reviewer did not modify plan state.

## Metrics

- Type coverage: not applicable; documentation/static contract review
- Test coverage: not applicable; no Crazy implementation or runnable contract suite reviewed
- Linting issues: not measured; no source code changed
- Findings: `0 Critical`, `2 High`, `2 Medium`, `0 Low`
- Native identity check: SHA-256 matched the contract's `DER-NATIVE-001` value

## Unresolved Questions

None requiring product judgment. The remaining work is evidence reconciliation and correction of
contradicted values.

Status: DONE_WITH_CONCERNS
Summary: Most Crazy lifecycle and Result claims are statically verified, but incorrect intro
geometry/timing and two toss limits block implementation readiness.
Concerns/Blockers: H1 and H2 must be corrected and independently re-reviewed; resource consumer
coverage remains AMBER.
